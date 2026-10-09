// 台本の 番組の TV（映画館の 実況上映：金曜ロード保守『空飛ぶ鯖』）。ui/jikkyoWatch.ts の 板の 上の キャンバス。
// 480x270 の 2倍の 下地に 240x135 の 座標で 描く（字が にじまない）。野球の TV（ui/jikkyoYakyuTv.ts）と 同じ 形。
// - 会場の 枠（cinema）：赤い 幕・まんなかに スクリーン・下に 客の 頭と スマホの 光（金曜は 多く、洪水では みんな 光る）。
// - 場面（data/jikkyo/sora.ts の SORA_SCENES）：カード（まもなく・予告・おわり）・オープニング（本館の 映写機と 1→1000 の 数字 →
//   番組ロゴ）・港・連投規制の 嵐・コピペの 群れ と 安価・雲の 上の 鯖（大将が 来る）・CM・山場（◆トリップの 札と「!バルス」の 欄 →
//   合図ごとに 光る → 白い 光 → マスに 割れて 崩壊 → アク禁）・エンディング（スタッフロール）。字幕は スクリーンの 下に。
// - 絵は 同梱の 物（sprites/projector.png・copipe.png・enjo.png）と 塗り（ui/cinemaDecor.ts の 鯖の 絵）。絵に 出す 文は SORA_ART。
// - 場面の 進みは 名目の 時計（JkView.t。見えない あいだ 止まる・開発の 速さにも 合う）、点滅は 実際の 時計。
// - 動きを へらす 設定：稲光・点滅・崩壊の 飛びちりを 止める（止まった 絵で 見せる）。読めない 絵は 四角で 描く（止まらない）。
// 字・数字・小さな 人の 道具（text・num・person）と 判定の 色は 劇場の TV（ui/jikkyoKohakuTv.ts）も 使う。

import type { JkCueGrade, JkEv, JkView } from "../core/jikkyo";
import { SORA_ART, type SoraData } from "../data/jikkyo/sora";
import { JK_PROG_TV } from "../data/jikkyo/text";
import { loadImage } from "../engine/assets";
import { blit, hash, RACK, RACK_INK, SABA, SABA_INK } from "./cinemaDecor";

export type SceneTv = {
	/** 絵を 先に 読む（1秒まで 待つ）。 */
	load(): Promise<void>;
	onEv(ev: JkEv, now: number): void;
	draw(now: number, v: JkView): void;
};

type G = CanvasRenderingContext2D;

const FONT = (px: number) => `${px}px 'DotGothic16', monospace`;

/** スクリーン（240x135 の 中）。 */
const SX = 24;
const SY = 7;
const SW = 192;
const SH = 104;

/** 3×5 の 数字。 */
const DIGIT: Readonly<Record<string, readonly string[]>> = {
	"0": ["###", "#.#", "#.#", "#.#", "###"],
	"1": [".#.", "##.", ".#.", ".#.", "###"],
	"2": ["###", "..#", "###", "#..", "###"],
	"3": ["###", "..#", "###", "..#", "###"],
	"4": ["#.#", "#.#", "###", "..#", "..#"],
	"5": ["###", "#..", "###", "..#", "###"],
	"6": ["###", "#..", "###", "#.#", "###"],
	"7": ["###", "..#", "..#", "..#", "..#"],
	"8": ["###", "#.#", "###", "#.#", "###"],
	"9": ["###", "#.#", "###", "..#", "###"],
};

export const numW = (s: string, k: number) => (s.length * 4 - 1) * k;

export const num = (
	g: G,
	s: string,
	x: number,
	y: number,
	k: number,
	ink: string,
) =>
	[...s].forEach((ch, i) => {
		const art = DIGIT[ch];
		if (art) blit(g, art, x + i * 4 * k, y, { "#": ink }, k);
	});

/** 字（outline が あれば 4方向に ふちどり）。 */
export const text = (
	g: G,
	s: string,
	x: number,
	y: number,
	px: number,
	ink: string,
	o: { align?: CanvasTextAlign; outline?: string } = {},
) => {
	g.font = FONT(px);
	g.textAlign = o.align ?? "center";
	g.textBaseline = "top";
	if (o.outline) {
		g.fillStyle = o.outline;
		for (const [dx, dy] of [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1],
		])
			g.fillText(s, x + dx, y + dy);
	}
	g.fillStyle = ink;
	g.fillText(s, x, y);
};

/** 上から 下への 帯（色の 並び）。 */
const bands = (g: G, cols: readonly string[], y0: number, h: number) => {
	const b = h / cols.length;
	cols.forEach((c, i) => {
		g.fillStyle = c;
		g.fillRect(0, Math.floor(y0 + i * b), SW, Math.ceil(b) + 1);
	});
};

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

type Imgs = {
	projector: HTMLImageElement | null;
	copipe: HTMLImageElement | null;
	enjo: HTMLImageElement | null;
};

/** 場面を 描く ための 中身。lt は 区切りの 頭から（名目の ms）。 */
type Ctx = {
	readonly lt: number;
	readonly t: number;
	readonly now: number;
	readonly still: boolean;
	readonly data: SoraData;
	readonly imgs: Imgs;
	/** 合図の 実際の 時刻。 */
	readonly pulses: readonly number[];
};

/** 歩行グラの 1コマ（16x16。向きの 行：上 0・右 1・下 2・左 3）。 */
const walker = (
	g: G,
	img: HTMLImageElement | null,
	row: number,
	frame: number,
	x: number,
	y: number,
	k = 1,
	fallback = "#2a3a5a",
) => {
	if (img) {
		g.drawImage(img, frame * 16, row * 16, 16, 16, x, y, 16 * k, 16 * k);
		return;
	}
	g.fillStyle = fallback;
	g.fillRect(x + 4 * k, y + 3 * k, 8 * k, 12 * k);
};

/** 小さな 人（塗り。体の 色・頭）。 */
export const person = (
	g: G,
	x: number,
	y: number,
	body: string,
	hair: string,
) => {
	g.fillStyle = hair;
	g.fillRect(x + 1, y, 4, 2);
	g.fillStyle = "#f2c8a0";
	g.fillRect(x + 1, y + 2, 4, 3);
	g.fillStyle = body;
	g.fillRect(x, y + 5, 6, 5);
	g.fillStyle = "#2a2a36";
	g.fillRect(x + 1, y + 10, 1, 2);
	g.fillRect(x + 4, y + 10, 1, 2);
};

// ───────────────── カード ─────────────────

const filmHoles = (g: G, c: Ctx) => {
	g.fillStyle = "#1c1a18";
	g.fillRect(0, 0, SW, 8);
	g.fillRect(0, SH - 8, SW, 8);
	g.fillStyle = "#6a6458";
	const off = c.still ? 0 : Math.floor(c.now / 80) % 8;
	for (let x = -off; x < SW; x += 8) {
		g.fillRect(x + 2, 2, 4, 4);
		g.fillRect(x + 2, SH - 6, 4, 4);
	}
};

const drawCard = (g: G, c: Ctx) => {
	g.fillStyle = "#0a0a10";
	g.fillRect(0, 0, SW, SH);
	const card = c.data.card ?? "";
	if (c.data.phase === "soon") {
		// 映写の 秒読み（円と まわる 線、5 → 1）
		const cx = SW / 2;
		const cy = 44;
		g.fillStyle = "#2a2622";
		g.beginPath();
		g.arc(cx, cy, 26, 0, Math.PI * 2);
		g.fill();
		const a = c.still ? 0 : ((c.lt % 1200) / 1200) * Math.PI * 2;
		g.fillStyle = "#4a443a";
		g.beginPath();
		g.moveTo(cx, cy);
		g.arc(cx, cy, 26, -Math.PI / 2, -Math.PI / 2 + a);
		g.closePath();
		g.fill();
		g.fillStyle = "#8a8070";
		g.fillRect(cx - 30, cy, 60, 1);
		g.fillRect(cx, cy - 30, 1, 60);
		const n = String(Math.max(1, 5 - Math.floor(c.lt / 1200)));
		num(g, n, cx - numW(n, 5) / 2, cy - 12, 5, "#e8e0c8");
		text(g, card, cx, 78, 8, "#e8e0c8");
	} else if (c.data.phase === "preview") {
		const summer = card.includes("夏");
		if (summer) {
			bands(g, ["#2c2350", "#5a2f62", "#a0466a", "#d86a52", "#f29a52"], 8, 50);
			g.fillStyle = "#2e3a6a";
			g.fillRect(0, 58, SW, 16);
			g.fillStyle = "#ffd890";
			g.fillRect(126, 52, 20, 6);
			g.fillStyle = "#b88a5a";
			g.fillRect(0, 74, SW, SH - 82);
		} else {
			bands(g, ["#3f9ad8", "#58aee2", "#74c0ea", "#92d0f0"], 8, SH - 16);
			blit(g, SABA, 48, 30, SABA_INK, 4);
		}
		text(g, card, SW / 2, 40, 12, "#ffffff", { outline: "#141018" });
	} else {
		text(g, card, SW / 2, 46, 10, "#a8a090");
	}
	filmHoles(g, c);
};

// ───────────────── オープニング ─────────────────

const LOGO_AT = 5500;

const drawLogo = (g: G, c: Ctx, x: number, y: number, w: number, h: number) => {
	g.fillStyle = "#0b0b0f";
	g.fillRect(x, y, w, h);
	const fh = 34;
	g.fillStyle = "#1c1a18";
	g.fillRect(x, y + 4, w, fh);
	g.fillStyle = "#bdb6a6";
	const off = c.still ? 0 : Math.floor(c.now / 50) % 8;
	for (let px = x - off; px < x + w; px += 8) {
		g.fillRect(px, y + 6, 3, 3);
		g.fillRect(px, y + fh - 1, 3, 3);
	}
	const cw = 52;
	const cx = x + (w - cw) / 2;
	g.fillStyle = "#4a4436";
	g.fillRect(cx - cw - 4, y + 11, cw, 20);
	g.fillRect(cx + cw + 4, y + 11, cw, 20);
	g.fillStyle = "#f2e6c8";
	g.fillRect(cx, y + 11, cw, 20);
	num(g, "1000", cx + (cw - numW("1000", 3)) / 2, y + 14, 3, "#2a2218");
	g.fillStyle = "#14213a";
	g.fillRect(x, y + fh + 8, w, 20);
	text(g, SORA_ART.logo, x + w / 2, y + fh + 11, 12, "#ffe7a0");
	// きらめき
	if (!c.still) {
		const k = Math.floor(c.now / 140);
		g.fillStyle = "#ffffff";
		for (let i = 0; i < 4; i++) {
			if (hash(i, k, 5) > 0.5) continue;
			g.fillRect(
				x + Math.floor(hash(i, k, 6) * w),
				y + fh + 8 + Math.floor(hash(i, k, 7) * 20),
				1,
				1,
			);
		}
	}
};

const drawOp = (g: G, c: Ctx) => {
	g.fillStyle = "#050507";
	g.fillRect(0, 0, SW, SH);
	if (c.lt >= LOGO_AT) {
		drawLogo(g, c, 0, 18, SW, 70);
		return;
	}
	const on = clamp01(c.lt / 800);
	// 本館の 映写機と 光の 筋
	if (c.imgs.projector)
		g.drawImage(c.imgs.projector, 0, 0, 16, 16, 6, 50, 32, 32);
	else {
		g.fillStyle = "#3a3a44";
		g.fillRect(10, 58, 24, 18);
	}
	g.fillStyle = `rgba(255, 244, 210, ${(0.12 * on).toFixed(3)})`;
	g.beginPath();
	g.moveTo(36, 62);
	g.lineTo(76, 16);
	g.lineTo(76, 88);
	g.lineTo(36, 68);
	g.closePath();
	g.fill();
	if (!c.still) {
		g.fillStyle = `rgba(255, 250, 230, ${(0.6 * on).toFixed(3)})`;
		for (let i = 0; i < 8; i++) {
			const p = ((c.now * 0.004 + i * 13) % 40) / 40;
			g.fillRect(
				Math.floor(38 + p * 36),
				Math.floor(64 + (hash(i, 3) - 0.5) * p * 60),
				1,
				1,
			);
		}
	}
	// 映る コマ：数字が 1 → 1000（はじめ ゆっくり、あとで 速く）
	g.fillStyle = `rgba(242, 230, 200, ${on.toFixed(3)})`;
	g.fillRect(76, 16, 108, 72);
	const p = clamp01((c.lt - 800) / (LOGO_AT - 1300));
	const n = String(Math.max(1, Math.min(1000, Math.round(1 + 999 * p ** 3))));
	const k = n.length >= 4 ? 5 : 6;
	num(g, n, 130 - numW(n, k) / 2, 52 - (5 * k) / 2, k, "#2a2218");
};

// ───────────────── 港 ─────────────────

const drawMinato = (g: G, c: Ctx) => {
	bands(g, ["#5ab0e8", "#74c0ec", "#92d0f2", "#b4e0f8", "#cfeefa"], 0, 50);
	// 空を 鯖の 影が よぎる（7秒ごと）
	const sp = c.lt % 7000;
	if (sp < 5000) {
		const x = -50 + (sp / 5000) * (SW + 100);
		blit(
			g,
			SABA,
			Math.round(x),
			10,
			{
				"#": "#5a7ab0",
				"=": "#5a7ab0",
				"-": "#5a7ab0",
				o: "#5a7ab0",
			},
			2,
		);
	}
	// かもめ
	g.fillStyle = "#ffffff";
	for (let i = 0; i < 3; i++) {
		const gx = Math.round((c.now * 0.01 + i * 70) % (SW + 20)) - 10;
		const gy = 24 + i * 6 + Math.round(Math.sin(c.now / 500 + i) * 2);
		g.fillRect(gx, gy, 2, 1);
		g.fillRect(gx + 3, gy, 2, 1);
		g.fillRect(gx + 2, gy + 1, 1, 1);
	}
	// 海と 波
	g.fillStyle = "#2a78c0";
	g.fillRect(0, 50, SW, 28);
	g.fillStyle = "#3a8ad0";
	g.fillRect(0, 58, SW, 6);
	g.fillStyle = "#cfe8ff";
	for (let i = 0; i < 6; i++) {
		const wx = Math.round((c.now * 0.008 + i * 37) % (SW + 12)) - 6;
		g.fillRect(wx, 54 + (i % 3) * 7, 6, 1);
	}
	// 浜と 桟橋
	g.fillStyle = "#e2c890";
	g.fillRect(0, 78, SW, SH - 78);
	g.fillStyle = "#8a5a34";
	g.fillRect(120, 70, 72, 6);
	for (let x = 124; x < SW; x += 12) g.fillRect(x, 76, 2, 8);
	// 海の家（赤白の 屋根と 看板）
	for (let i = 0; i < 6; i++) {
		g.fillStyle = i % 2 ? "#ffffff" : "#d84040";
		g.fillRect(18 + i * 9, 46, 9, 8);
	}
	g.fillStyle = "#f0e0c0";
	g.fillRect(22, 54, 46, 24);
	g.fillStyle = "#2a4a8a";
	g.fillRect(30, 56, 30, 9);
	text(g, SORA_ART.hut, 45, 56, 8, "#ffffff");
	g.fillStyle = "#6a4020";
	g.fillRect(40, 68, 10, 10);
	// 焼きそばを 食べる 名無し（湯気）
	for (let i = 0; i < 3; i++) {
		const px = 74 + i * 12;
		person(g, px, 78, ["#4a6aa0", "#6a8a4a", "#8a5a8a"][i], "#2a2020");
		if (!c.still && hash(i, Math.floor(c.now / 300)) > 0.4) {
			g.fillStyle = "rgba(255, 255, 255, 0.7)";
			g.fillRect(px + 2, 74 - ((c.now / 200 + i) % 3), 1, 2);
		}
	}
	// はじめの 2秒は 題名
	if (c.lt < 2600) {
		g.globalAlpha = c.lt < 2000 ? 1 : 1 - (c.lt - 2000) / 600;
		text(g, SORA_ART.title, SW / 2, 26, 16, "#ffffff", { outline: "#1a2a4a" });
		g.globalAlpha = 1;
	}
};

// ───────────────── 連投規制の 嵐 ─────────────────

const WALL_ROWS = [
	{ y: 8, v: 0.03 },
	{ y: 26, v: -0.045 },
	{ y: 44, v: 0.038 },
] as const;

const drawKisei = (g: G, c: Ctx) => {
	bands(g, ["#1e1a2c", "#2a2438", "#3a3050", "#4a3a5a"], 0, 80);
	// 赤い 文字の 壁（横に 流れる）
	WALL_ROWS.forEach((r, ri) => {
		const span = 60;
		const off = c.still ? ri * 20 : (c.now * r.v) % span;
		for (let x = -span + off; x < SW + span; x += span) {
			g.fillStyle = "#c01828";
			g.fillRect(Math.round(x), r.y, 52, 12);
			text(g, SORA_ART.kisei, Math.round(x) + 26, r.y + 2, 8, "#ffe0e0");
		}
	});
	// 雨
	if (!c.still) {
		g.fillStyle = "rgba(170, 180, 220, 0.5)";
		for (let i = 0; i < 30; i++) {
			const rx = Math.round((hash(i, 1) * SW + c.now * 0.12) % SW);
			const ry = Math.round((hash(i, 2) * SH + c.now * 0.2) % SH);
			g.fillRect(rx, ry, 1, 3);
		}
	}
	// 海と 小舟（ゆれる）
	g.fillStyle = "#141c34";
	g.fillRect(0, 84, SW, 20);
	g.fillStyle = "#3a4a7a";
	for (let i = 0; i < 8; i++)
		g.fillRect(
			Math.round((i * 29 + c.now * 0.02) % SW),
			86 + (i % 2) * 6,
			8,
			1,
		);
	const bx = Math.round(96 + Math.sin(c.lt / 900) * 6);
	const by = Math.round(78 + Math.sin(c.lt / 400) * 2);
	person(g, bx - 8, by - 6, "#2a3a6a", "#1a1414");
	person(g, bx + 2, by - 6, "#b03040", "#4a2a1a");
	if (!c.still && Math.floor(c.now / 400) % 2) {
		g.fillStyle = "#ffe060";
		g.fillRect(bx + 8, by - 4, 1, 1);
	}
	g.fillStyle = "#7a4a28";
	g.beginPath();
	g.moveTo(bx - 16, by + 6);
	g.lineTo(bx + 16, by + 6);
	g.lineTo(bx + 12, by + 11);
	g.lineTo(bx - 12, by + 11);
	g.closePath();
	g.fill();
	// 稲光（3.7秒ごと）
	if (!c.still && c.now % 3700 < 120) {
		g.fillStyle = "rgba(255, 255, 255, 0.5)";
		g.fillRect(0, 0, SW, SH);
	}
};

// ───────────────── コピペの 群れと 安価 ─────────────────

const ANCHOR_AT = 6000;

const drawCopipe = (g: G, c: Ctx) => {
	g.fillStyle = "#dfe7f0";
	g.fillRect(0, 0, SW, SH);
	g.fillStyle = "#cbd6e4";
	for (let x = 0; x < SW; x += 8) g.fillRect(x, 0, 1, SH);
	for (let y = 0; y < SH; y += 8) g.fillRect(0, y, SW, 1);
	// 少年と スレ主（左）
	person(g, 10, 66, "#2a3a6a", "#1a1414");
	person(g, 20, 66, "#b03040", "#4a2a1a");
	const back = c.lt >= ANCHOR_AT;
	// 群れ：はじめは 左へ 押しよせ、安価の あとは 回れ右で「別スレ→」へ
	const x0 = back ? 118 + (c.lt - ANCHOR_AT) * 0.04 : 190 - c.lt * 0.012;
	const row = back ? 1 : 3;
	for (let r = 0; r < 3; r++)
		for (let k = 0; k < 6; k++) {
			const x = Math.round(x0 + k * 16 + (r % 2) * 8);
			if (x > SW + 16) continue;
			const frame = c.still ? 0 : (Math.floor(c.now / 220) + k + r) % 2;
			walker(g, c.imgs.copipe, row, frame, x, 30 + r * 20);
		}
	if (back) {
		const pop = clamp01((c.lt - ANCHOR_AT) / 200);
		// 少年の 書きこみ（安価）
		g.fillStyle = "#ffffff";
		g.fillRect(6, 44, 70, 14 * pop);
		g.fillStyle = "#3a5a9a";
		g.fillRect(6, 44, 70, 1);
		g.fillRect(6, 44 + 14 * pop - 1, 70, 1);
		if (pop >= 1) text(g, SORA_ART.anchor, 41, 47, 8, "#1a2a5a");
		// 「別スレ→」の 札
		g.fillStyle = "#8a5a34";
		g.fillRect(158, 30, 2, 26);
		g.fillStyle = "#c08a50";
		g.fillRect(140, 18, 46, 14);
		text(g, SORA_ART.sign, 163, 21, 8, "#2a1a0a");
	}
};

// ───────────────── 雲の 上の 鯖（大将が 来る） ─────────────────

const drawSaba = (g: G, c: Ctx) => {
	bands(g, ["#16306a", "#24488a", "#3a64a8", "#5a8ad0", "#7aaae2"], 0, 74);
	// 古い 書きこみが 蛍の ように 浮く
	for (let i = 0; i < 10; i++) {
		const fy = SH - ((c.now * 0.008 + i * 29) % (SH + 10));
		const fx = Math.round(hash(i, 4) * SW + Math.sin(c.now / 900 + i) * 4);
		const a = c.still ? 0.7 : 0.4 + 0.4 * Math.sin(c.now / 400 + i);
		g.fillStyle = `rgba(255, 246, 160, ${a.toFixed(2)})`;
		g.fillRect(fx, Math.round(fy), 3, 2);
	}
	// 大きな 鯖
	const k = 4;
	const sx = Math.round(48 + Math.sin(c.lt / 2400) * 6);
	const sy = Math.round(28 + Math.sin(c.lt / 900) * 2);
	blit(g, SABA, sx, sy, SABA_INK, k);
	const tk = Math.floor(c.now / 300);
	RACK.forEach(([rx, ry], i) => {
		if (c.still ? i % 3 !== 0 : hash(i, tk, 9) >= 0.45) return;
		g.fillStyle = RACK_INK[i % 2];
		g.fillRect(sx + rx * k + 1, sy + ry * k + 1, 2, 2);
	});
	// 雲の 海
	g.fillStyle = "#f2f6ff";
	g.fillRect(0, 80, SW, SH - 80);
	g.fillStyle = "#ffffff";
	for (let i = 0; i < 9; i++) {
		const cx =
			Math.round((i * 26 - c.now * 0.01) % (SW + 26)) + (i * 26 < 0 ? SW : 0);
		g.beginPath();
		g.arc((cx + SW + 26) % (SW + 26), 80, 10 + (i % 3) * 3, 0, Math.PI * 2);
		g.fill();
	}
	// 小舟が 近づく
	if (c.data.phase !== "ume") {
		const bx = Math.round(4 + Math.min(40, c.lt * 0.003));
		g.fillStyle = "#7a4a28";
		g.fillRect(bx, 74, 14, 3);
		person(g, bx + 2, 63, "#2a3a6a", "#1a1414");
		person(g, bx + 7, 63, "#b03040", "#4a2a1a");
		return;
	}
	// 大将と コピペの 山（だんだん 積もる）
	const n = Math.min(14, 2 + Math.floor(c.lt / 500));
	for (let i = 0; i < n; i++) {
		const layer = i < 6 ? 0 : i < 10 ? 1 : i < 13 ? 2 : 3;
		const inLayer = i - [0, 6, 10, 13][layer];
		const x = 62 + layer * 8 + inLayer * 14;
		const y = 54 - layer * 10;
		const frame = c.still ? 0 : (Math.floor(c.now / 260) + i) % 2;
		walker(g, c.imgs.copipe, 2, frame, x, y);
	}
	walker(
		g,
		c.imgs.enjo,
		2,
		c.still ? 0 : Math.floor(c.now / 300) % 2,
		140,
		18,
		2,
		"#a03020",
	);
	if (!c.still) {
		g.fillStyle = `rgba(255, 40, 40, ${(0.08 + 0.06 * Math.sin(c.now / 200)).toFixed(3)})`;
		g.fillRect(0, 0, SW, SH);
	}
};

// ───────────────── CM ─────────────────

const CM_INK = [
	{ bg: "#ffe8a0", wall: "#f6f0e0", board: "#2a6ab0" },
	{ bg: "#e2ecff", wall: "#ffffff", board: "#d84a2a" },
	{ bg: "#ffd8d8", wall: "#f0f0f0", board: "#2a2a2a" },
	{ bg: "#d8f0e0", wall: "#f4f4ec", board: "#2a7a4a" },
] as const;

const drawCm = (g: G, c: Ctx) => {
	const i = Math.max(0, Math.min(SORA_ART.cm.length - 1, c.data.cm ?? 0));
	const cm = SORA_ART.cm[i];
	const ink = CM_INK[i];
	g.fillStyle = ink.bg;
	g.fillRect(0, 0, SW, SH);
	// 店の 絵（壁・看板・窓・入口）
	g.fillStyle = ink.wall;
	g.fillRect(46, 22, 100, 50);
	g.fillStyle = ink.board;
	g.fillRect(42, 14, 108, 14);
	text(g, cm.shop, 96, 17, 8, "#ffffff");
	g.fillStyle = "#9ac8e8";
	g.fillRect(54, 36, 22, 16);
	g.fillRect(116, 36, 22, 16);
	g.fillStyle = "#6a5a4a";
	g.fillRect(86, 44, 20, 28);
	// 小さな しるし（海・24・鉄アレイ・線路）
	g.fillStyle = ink.board;
	if (i === 0) {
		g.fillRect(8, 60, 30, 3);
		g.fillRect(14, 10, 10, 10);
	} else if (i === 1) num(g, "24", 12, 12, 3, ink.board);
	else if (i === 2) {
		g.fillRect(10, 18, 4, 10);
		g.fillRect(14, 22, 16, 2);
		g.fillRect(30, 18, 4, 10);
	} else {
		g.fillRect(0, 84, SW, 2);
		g.fillRect(0, 90, SW, 2);
		for (let x = 0; x < SW; x += 8) g.fillRect(x, 84, 2, 8);
	}
	// 1行
	g.fillStyle = "rgba(255, 255, 255, 0.92)";
	g.fillRect(0, 74, SW, 14);
	text(g, cm.line, SW / 2, 77, 8, "#1a1a24");
	g.fillStyle = "#1a1a24";
	g.fillRect(SW - 22, 4, 18, 10);
	text(g, SORA_ART.cmTag, SW - 13, 5, 8, "#ffffff");
};

// ───────────────── 山場 ─────────────────

/** 崩壊の マス（ちょうどの あと。ms は ちょうどからの 名目の 時）。 */
const drawCollapse = (g: G, c: Ctx, ms: number) => {
	const cols = 16;
	const rows = 9;
	const tw = SW / cols;
	const th = SH / rows;
	const pal = [
		"#0c1430",
		"#3a5a9a",
		"#f2f2f2",
		"#c01828",
		"#6a8ad0",
		"#ffe060",
	];
	for (let r = 0; r < rows; r++)
		for (let k = 0; k < cols; k++) {
			const delay = hash(k, r, 11) * 900;
			const s = Math.max(0, ms - 500 - delay) / 1000;
			if (c.still && s > 0) continue;
			const y = r * th + 120 * s * s;
			if (y > SH) continue;
			const x = k * tw + (hash(k, r, 12) - 0.5) * 40 * s;
			g.fillStyle = pal[Math.floor(hash(k, r, 13) * pal.length)];
			g.fillRect(
				Math.round(x),
				Math.round(y),
				Math.ceil(tw) - 1,
				Math.ceil(th) - 1,
			);
		}
};

/** 初代スレ（書きかえられずに のこる。光る 札）。 */
const drawOldest = (g: G, c: Ctx, x: number, y: number, a: number) => {
	if (a <= 0) return;
	g.globalAlpha = a;
	g.fillStyle = "rgba(255, 240, 180, 0.25)";
	g.fillRect(x - 6, y - 6, 52, 40);
	g.fillStyle = "#efe2c0";
	g.fillRect(x, y, 40, 28);
	g.fillStyle = "#8a7a5a";
	for (let i = 0; i < 4; i++)
		g.fillRect(x + 4, y + 12 + i * 4, 32 - (i % 2) * 8, 1);
	text(g, SORA_ART.oldest, x + 20, y + 2, 8, "#3a2a1a");
	if (!c.still && Math.floor(c.now / 500) % 2) {
		g.fillStyle = "#ffffff";
		g.fillRect(x + 36, y + 2, 1, 1);
	}
	g.globalAlpha = 1;
};

const drawBarusu = (g: G, c: Ctx, v: JkView) => {
	const phase = c.data.phase;
	const exact = c.data.exact ?? Number.POSITIVE_INFINITY;
	const since = v.t - exact;
	if (phase === "akukin") {
		g.fillStyle = "#101828";
		g.fillRect(0, 0, SW, SH);
		drawOldest(g, c, 22, 36, clamp01(c.lt / 1500));
		const fade = 1 - clamp01((c.lt - 5000) / 2000);
		if (fade > 0) {
			g.globalAlpha = fade;
			for (let i = 0; i < 5; i++)
				walker(g, c.imgs.copipe, 2, 0, 100 + i * 14, 66 - (i % 2) * 6);
			walker(g, c.imgs.enjo, 2, 0, 132, 24, 2, "#a03020");
			// 赤い「アク禁」の 判（押して 少し はねる）
			const s = c.still ? 1 : 1 + 0.6 * (1 - clamp01((c.lt - 400) / 250));
			if (c.lt >= 400 || c.still) {
				g.save();
				g.translate(150, 52);
				g.rotate(-0.15);
				g.scale(s, s);
				g.fillStyle = "#e02030";
				g.fillRect(-28, -10, 56, 2);
				g.fillRect(-28, 8, 56, 2);
				g.fillRect(-28, -10, 2, 20);
				g.fillRect(26, -10, 2, 20);
				text(g, SORA_ART.akukin, 0, -6, 12, "#e02030");
				g.restore();
			}
			g.globalAlpha = 1;
		}
		return;
	}
	if (phase === "boom" || since >= 0) {
		g.fillStyle = "#04060c";
		g.fillRect(0, 0, SW, SH);
		drawCollapse(g, c, Math.max(0, since));
		// 白い 光「禁断呪文　バルス　発動！」
		const a = 1 - clamp01(since / 1200);
		if (a > 0) {
			g.fillStyle = `rgba(255, 255, 255, ${a.toFixed(3)})`;
			g.fillRect(0, 0, SW, SH);
			g.globalAlpha = a;
			text(g, SORA_ART.flash, SW / 2, 46, 10, "#3a2a10");
			g.globalAlpha = 1;
		}
		if (phase === "boom")
			drawOldest(g, c, 76, 38, clamp01((since - 3500) / 1500) * 0.6);
		return;
	}
	// 山場の 前と 合図：◆トリップの 札・「!バルス」の 欄・うしろに 大将と コピペの 山
	g.fillStyle = "#0c1430";
	g.fillRect(0, 0, SW, SH);
	for (let i = 0; i < 8; i++)
		walker(
			g,
			c.imgs.copipe,
			2,
			c.still ? 0 : (Math.floor(c.now / 260) + i) % 2,
			96 + (i % 4) * 16,
			4 + Math.floor(i / 4) * 12,
		);
	walker(
		g,
		c.imgs.enjo,
		2,
		c.still ? 0 : Math.floor(c.now / 300) % 2,
		160,
		4,
		2,
		"#a03020",
	);
	g.fillStyle = "rgba(12, 20, 48, 0.55)";
	g.fillRect(0, 0, SW, SH);
	// ◆トリップの 札
	g.fillStyle = "#f4f2ea";
	g.fillRect(10, 30, 76, 14);
	text(g, SORA_ART.trip, 48, 33, 8, "#1a2a5a");
	// 書きこみ欄（合図ごとに 光る）
	const lit = c.pulses.some((p) => c.now - p >= 0 && c.now - p < 220);
	g.fillStyle = lit ? "#ffe060" : "#5a6a9a";
	g.fillRect(22, 54, 148, 20);
	g.fillStyle = "#ffffff";
	g.fillRect(24, 56, 144, 16);
	text(g, SORA_ART.command, 28, 60, 8, "#1a1a24", { align: "left" });
	const caret = lit || (!c.still && Math.floor(c.now / 500) % 2 === 0);
	if (caret) {
		g.fillStyle = lit ? "#e02030" : "#1a1a24";
		g.fillRect(28 + 30, 59, 1, 10);
	}
	// 合図の 点（3つ）
	if (phase === "cue")
		for (let i = 0; i < 3; i++) {
			g.fillStyle = i < c.pulses.length ? "#ffe060" : "#3a4a7a";
			g.fillRect(SW / 2 - 14 + i * 12, 82, 6, 6);
		}
};

// ───────────────── エンディング ─────────────────

const drawEd = (g: G, c: Ctx) => {
	bands(g, ["#05071a", "#0a0e26", "#121a38", "#1a2448"], 0, SH);
	for (let i = 0; i < 24; i++) {
		const a = c.still ? 0.8 : 0.3 + 0.6 * hash(i, Math.floor(c.now / 600));
		g.fillStyle = `rgba(255, 255, 255, ${a.toFixed(2)})`;
		g.fillRect(
			Math.floor(hash(i, 21) * SW),
			Math.floor(hash(i, 22) * 70),
			1,
			1,
		);
	}
	// 鯖が 右上へ 泳いで 去る（小さく なる）
	const p = clamp01(c.lt / 14000);
	const k = Math.max(1, Math.round(3 - p * 2));
	blit(g, SABA, Math.round(96 + p * 70), Math.round(40 - p * 34), SABA_INK, k);
	// スタッフロール（役は ぜんぶ 名無しさん）
	SORA_ART.staff.forEach((s, i) => {
		const y = SH + 4 - c.lt * 0.012 + i * 16;
		if (y < -10 || y > SH) return;
		text(g, s, 56, Math.round(y), 8, "#e0e8ff");
	});
};

// ───────────────── 会場の 枠（映画館） ─────────────────

const HEADS = [12, 36, 60, 84, 108, 132, 156, 180, 204, 228] as const;

const drawFrame = (
	g: G,
	now: number,
	v: JkView,
	live: boolean,
	still: boolean,
) => {
	// 赤い 幕（左右）と 上の 飾り
	for (const x0 of [0, SX + SW]) {
		const w = x0 === 0 ? SX : 240 - x0;
		g.fillStyle = "#6a0c1c";
		g.fillRect(x0, 0, w, 135);
		g.fillStyle = "#4a0814";
		for (let x = x0 + 2; x < x0 + w; x += 5) g.fillRect(x, 0, 2, 135);
		g.fillStyle = "#9a2234";
		for (let x = x0 + 4; x < x0 + w; x += 5) g.fillRect(x, 0, 1, 135);
	}
	g.fillStyle = "#7a1424";
	g.fillRect(0, 0, 240, SY - 1);
	g.fillStyle = "#c8a040";
	g.fillRect(0, SY - 2, 240, 1);
	// 客の 頭と スマホの 光（金曜は 半分、ほかの 日は 少し、洪水では みんな）
	HEADS.forEach((x, i) => {
		const y = 126 + (i % 2) * 3;
		g.fillStyle = "#0a0708";
		g.beginPath();
		g.arc(x, y, 9, Math.PI, 0);
		g.fill();
		g.fillRect(x - 13, y, 26, 135 - y);
		const lit = v.flood || hash(i, 31) < (live ? 0.5 : 0.2);
		if (!lit) return;
		const a = still ? 0.9 : 0.6 + 0.4 * Math.sin(now / 1100 + i * 1.7);
		g.globalAlpha = a;
		g.fillStyle = "rgba(120, 190, 255, 0.25)";
		g.fillRect(x + 3, y - 4, 8, 5);
		g.fillStyle = "#eaf6ff";
		g.fillRect(x + 5, y - 2, 3, 2);
		g.globalAlpha = 1;
	});
};

export const GRADE_INK: Readonly<Record<JkCueGrade, string>> = {
	kami: "#ffe060",
	oshii: "#9ad0ff",
	late: "#9ad0ff",
	flying: "#c0c0d0",
	none: "#a0a0b0",
};

/** 『空飛ぶ鯖』の TV。live は 金曜の 本放送（客席の 光が 多い）。 */
export const soraTv = (
	canvas: HTMLCanvasElement,
	opt: { reduced: boolean; live: boolean },
): SceneTv => {
	canvas.width = 480;
	canvas.height = 270;
	const g0 = canvas.getContext("2d");
	if (!g0) throw new Error("canvas");
	const g = g0;
	const imgs: Imgs = { projector: null, copipe: null, enjo: null };
	let pulses: number[] = [];
	let grade: { g: JkCueGrade; at: number } | null = null;
	let kanso: { at: number } | null = null;
	/** 終わった あと（結果カードの あいだ）は 最後の 場面の まま。 */
	let lastSeg: JkView["seg"] = null;
	const still = opt.reduced;
	return {
		load: async () => {
			const one = async (k: keyof Imgs, ref: string) => {
				imgs[k] = await loadImage(ref).catch(() => null);
			};
			await Promise.race([
				Promise.all([
					one("projector", "pub:sprites/projector.png"),
					one("copipe", "pub:sprites/copipe.png"),
					one("enjo", "pub:sprites/enjo.png"),
				]),
				new Promise((r) => setTimeout(r, 1000)),
			]);
		},
		onEv: (ev, now) => {
			if (ev.t === "open") pulses = [];
			if (ev.t === "pulse") pulses.push(now);
			if (ev.t === "grade") grade = { g: ev.grade, at: now };
			if (ev.t === "kanso") kanso = { at: now };
		},
		draw: (now, v) => {
			g.setTransform(2, 0, 0, 2, 0, 0);
			g.imageSmoothingEnabled = false;
			g.fillStyle = "#120c10";
			g.fillRect(0, 0, 240, 135);
			const seg = v.seg ?? lastSeg;
			lastSeg = seg;
			const data = (seg?.data ?? {}) as SoraData;
			const c: Ctx = {
				lt: Math.max(0, v.t - (seg?.start ?? 0)),
				t: v.t,
				now,
				still,
				data,
				imgs,
				pulses,
			};
			g.save();
			g.translate(SX, SY);
			g.beginPath();
			g.rect(0, 0, SW, SH);
			g.clip();
			switch (seg?.scene) {
				case "op":
					drawOp(g, c);
					break;
				case "minato":
					drawMinato(g, c);
					break;
				case "kisei":
					drawKisei(g, c);
					break;
				case "copipe":
					drawCopipe(g, c);
					break;
				case "saba":
					drawSaba(g, c);
					break;
				case "cm":
					drawCm(g, c);
					break;
				case "barusu":
					drawBarusu(g, c, v);
					break;
				case "ed":
					drawEd(g, c);
					break;
				default:
					drawCard(g, c);
			}
			// 字幕（説明だけ。カードには 出さない）
			if (seg?.caption && seg.scene !== "card") {
				g.fillStyle = "rgba(0, 0, 0, 0.55)";
				g.fillRect(0, SH - 13, SW, 13);
				text(g, seg.caption, SW / 2, SH - 11, 8, "#ffffff");
			}
			g.restore();
			drawFrame(g, now, v, opt.live, still);
			// 山場の 判定・完走の 札
			if (grade && now - grade.at < 1800) {
				text(g, JK_PROG_TV.grade[grade.g], 236, 10, 10, GRADE_INK[grade.g], {
					align: "right",
					outline: "#000000",
				});
			}
			if (kanso && now - kanso.at < 2200) {
				text(g, JK_PROG_TV.kansoTv, 120, 10, 10, "#ffe060", {
					outline: "#000000",
				});
			}
		},
	};
};
