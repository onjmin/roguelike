// 劇場の 紅白スレ合戦の TV（ui/jikkyoWatch.ts の 板の 上の キャンバス）。映画館の TV（ui/jikkyoScenes.ts）と 同じ 形：
// 480x270 の 2倍の 下地に 240x135 の 座標で 描く。
// - 会場の 枠（stage）：上に 赤い 幕の かざり、両わきに 赤い 幕（劇場の 部屋と 同じ Base.png の 絵）、金の 額ぶち、
//   下に 客の 頭と ペンライト（紅と 白。本番は 多く、0時の 洪水では みんな ふる）。
// - 場面（data/jikkyo/kohaku.ts の KOHAKU_SCENES）：開演前の 幕・幕が 上がって 両組が ならぶ・紅組の 一番手（演歌。
//   長い 音で 画面が 少し ゆれる）・白組の 一番手（ダンス。光が 拍で 光る）・名物の ageリレー（名無しが 札を 列で わたす。
//   いつも 成功）・大トリ（大きな 金の 扇）・審査（得点板に 札が 1枚ずつ。勝った 組の 色の 紙ふぶき）・
//   除夜の 鐘（雪の 寺へ 急に 切りかわる）・年越しレス（舞台の 時計）・0時（3・2・1 → 花火と「あけおめ」）・
//   ことよろの 波・初日の出（保守村の 海）・幕。字幕は 舞台の 下に。
// - 人の 絵は 同梱の rpgen の 歩行グラ（紅組 08-princess・09-woman-a、白組 00-hero・14-man-a、大トリ 20-king、
//   審査員 03-elderly-a）。服の 青を 組の 色に 塗りなおす。ほかは 塗り。絵に 出す 文は KOHAKU_ART。
// - 場面の 進みは 名目の 時計（JkView.t）、点滅は 実際の 時計。動きを へらす 設定では ゆれ・点滅・紙ふぶきを 止める。
//   読めない 絵は 四角で 描く（止まらない）。

import type { JkCueGrade, JkEv, JkView } from "../core/jikkyo";
import {
	KOHAKU_ART,
	type KohakuData,
	type KohakuTeam,
	kohakuLeft,
} from "../data/jikkyo/kohaku";
import { JK_PROG_TV } from "../data/jikkyo/text";
import { loadImage } from "../engine/assets";
import { hash } from "./cinemaDecor";
import {
	clamp01,
	GRADE_INK,
	num,
	numW,
	person,
	type SceneTv,
	text,
} from "./jikkyoScenes";

type G = CanvasRenderingContext2D;
type Img = CanvasImageSource;

/** 舞台（240x135 の 中）。 */
const SX = 20;
const SY = 10;
const SW = 200;
const SH = 100;

const BASE = "pub:assets/rpg-reze/Base.png";
/** Base.png の 中の 劇場の 絵（px）：赤い 幕の かざり・赤い 幕（16x48）・金の ふすま 7枚。 */
const VALANCE = [96, 5712] as const;
const CURTAIN = [96, 5728] as const;
const FUSUMA_Y = 7040;

const CHARS = {
	princess: "pub:assets/rpgen/char/08-princess.png",
	woman: "pub:assets/rpgen/char/09-woman-a.png",
	hero: "pub:assets/rpgen/char/00-hero.png",
	man: "pub:assets/rpgen/char/14-man-a.png",
	king: "pub:assets/rpgen/char/20-king.png",
	judge: "pub:assets/rpgen/char/03-elderly-a.png",
} as const;
type CharKey = keyof typeof CHARS;

type Imgs = {
	base: HTMLImageElement | null;
	chars: Partial<Record<CharKey, Img>>;
};

const TEAM_INK: Readonly<Record<KohakuTeam, string>> = {
	aka: "#d8283c",
	shiro: "#f4f4f8",
};

/** 場面を 描く ための 中身。lt は 区切りの 頭から（名目の ms）。 */
type Ctx = {
	readonly lt: number;
	readonly t: number;
	readonly now: number;
	readonly still: boolean;
	readonly data: KohakuData;
	readonly imgs: Imgs;
	readonly live: boolean;
	readonly pulses: readonly number[];
};

// ───────────────── 塗りなおし（服の 青 → 組の 色） ─────────────────

const rgb2hsl = (r: number, g: number, b: number): [number, number, number] => {
	const x = Math.max(r, g, b) / 255;
	const n = Math.min(r, g, b) / 255;
	const l = (x + n) / 2;
	if (x === n) return [0, 0, l];
	const d = x - n;
	const s = l > 0.5 ? d / (2 - x - n) : d / (x + n);
	const [R, Gg, Bb] = [r / 255, g / 255, b / 255];
	const h =
		x === R
			? ((Gg - Bb) / d + (Gg < Bb ? 6 : 0)) * 60
			: x === Gg
				? ((Bb - R) / d + 2) * 60
				: ((R - Gg) / d + 4) * 60;
	return [h, s, l];
};

const hsl2rgb = (h: number, s: number, l: number): [number, number, number] => {
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const f = (t0: number) => {
		const t = (t0 + 1) % 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};
	const k = h / 360;
	return [f(k + 1 / 3), f(k), f(k - 1 / 3)].map((v) => Math.round(v * 255)) as [
		number,
		number,
		number,
	];
};

/** 青い 服を 組の 色に（紅組は 赤、白組は 白）。読めなければ もとの 絵。 */
const tinted = (img: HTMLImageElement, team: KohakuTeam): Img => {
	if (typeof document === "undefined") return img;
	const cv = document.createElement("canvas");
	cv.width = img.width;
	cv.height = img.height;
	const c = cv.getContext("2d");
	if (!c) return img;
	c.drawImage(img, 0, 0);
	try {
		const d = c.getImageData(0, 0, cv.width, cv.height);
		const p = d.data;
		for (let i = 0; i < p.length; i += 4) {
			if (p[i + 3] === 0) continue;
			const [h, s, l] = rgb2hsl(p[i], p[i + 1], p[i + 2]);
			if (h < 190 || h > 265 || s < 0.25) continue;
			const [r, g, b] =
				team === "aka"
					? hsl2rgb(352, 0.72, Math.min(0.62, l * 0.95))
					: hsl2rgb(220, 0.08, 0.6 + 0.38 * l);
			p[i] = r;
			p[i + 1] = g;
			p[i + 2] = b;
		}
		c.putImageData(d, 0, 0);
		return cv;
	} catch {
		return img;
	}
};

// ───────────────── 小さな 道具 ─────────────────

/** 歩行グラの 1コマ（16x16。向きの 行：上 0・右 1・下 2・左 3）。無ければ 塗った 人。 */
const chara = (
	g: G,
	img: Img | undefined,
	row: number,
	frame: number,
	x: number,
	y: number,
	k: number,
	fallback: string,
) => {
	if (img) {
		g.drawImage(img, frame * 16, row * 16, 16, 16, x, y, 16 * k, 16 * k);
		return;
	}
	g.fillStyle = fallback;
	g.fillRect(x + 4 * k, y + 3 * k, 8 * k, 12 * k);
};

/** 上から 下への 帯（舞台の 幅）。 */
const bands = (g: G, cols: readonly string[], y0: number, h: number) => {
	const b = h / cols.length;
	cols.forEach((col, i) => {
		g.fillStyle = col;
		g.fillRect(0, Math.floor(y0 + i * b), SW, Math.ceil(b) + 1);
	});
};

/** 光の 柱（上が 細く 下が 広い）。 */
const pillar = (g: G, x: number, ink: string, a: number) => {
	if (a <= 0) return;
	g.globalAlpha = a;
	g.fillStyle = ink;
	g.beginPath();
	g.moveTo(x - 3, 0);
	g.lineTo(x + 3, 0);
	g.lineTo(x + 16, SH - 12);
	g.lineTo(x - 16, SH - 12);
	g.closePath();
	g.fill();
	g.globalAlpha = 1;
};

/** 紙ふぶき（inks の 色。動きを へらす 設定では 止まった 粒）。 */
const confetti = (g: G, c: Ctx, inks: readonly string[], n = 40) => {
	for (let i = 0; i < n; i++) {
		const sp = 0.02 + hash(i, 41) * 0.025;
		const t = c.still ? hash(i, 44) * 400 : c.now * sp;
		const x = Math.round(
			hash(i, 42) * SW + (c.still ? 0 : Math.sin(c.now / 300 + i) * 3),
		);
		const y = Math.round(((t + hash(i, 43) * (SH + 20)) % (SH + 20)) - 10);
		g.fillStyle = inks[i % inks.length];
		g.fillRect(x, y, 2, i % 3 ? 2 : 1);
	}
};

/** 奥の 壁・金の ふすま（2倍）・板の 床。 */
const backdrop = (g: G, c: Ctx, tiles: readonly number[]) => {
	g.fillStyle = "#1c0e16";
	g.fillRect(0, 0, SW, SH);
	const base = c.imgs.base;
	const w = 32;
	const x0 = Math.round((SW - tiles.length * w) / 2);
	tiles.forEach((tx, i) => {
		if (base) g.drawImage(base, tx, FUSUMA_Y, 16, 16, x0 + i * w, 8, w, w);
		else {
			g.fillStyle = "#e8b040";
			g.fillRect(x0 + i * w + 1, 8, w - 2, w);
		}
	});
	g.fillStyle = "#5a3418";
	g.fillRect(0, 62, SW, SH - 62);
	g.fillStyle = "#6e4222";
	for (let y = 66; y < SH; y += 7) g.fillRect(0, y, SW, 1);
	g.fillStyle = "#8a5a30";
	g.fillRect(0, 62, SW, 2);
};

/** 立つ 人（2倍、足もとが y=88 ほど）。frame は ゆっくり 足ぶみ。 */
const stand = (
	g: G,
	c: Ctx,
	k: CharKey,
	x: number,
	o: { hop?: number; scale?: number; fast?: boolean; row?: number } = {},
) => {
	const s = o.scale ?? 2;
	const frame = c.still ? 0 : Math.floor(c.now / (o.fast ? 220 : 520)) % 2;
	const y = 88 - 16 * s - (o.hop ?? 0);
	chara(g, c.imgs.chars[k], o.row ?? 2, frame, x, y, s, "#6a5a8a");
};

const FUSUMA_ALL = [0, 16, 32, 48, 64, 80, 96] as const;

// ───────────────── 場面 ─────────────────

/** 閉じた 幕（open は 上がった 割合）。 */
const curtain = (g: G, open: number) => {
	const y = Math.round(-SH * open);
	g.fillStyle = "#8a1020";
	g.fillRect(0, y, SW, SH);
	for (let x = 0; x < SW; x += 10) {
		g.fillStyle = "#6a0a18";
		g.fillRect(x + 6, y, 3, SH);
		g.fillStyle = "#b02838";
		g.fillRect(x + 2, y, 2, SH);
	}
	g.fillStyle = "#c8a040";
	g.fillRect(0, y + SH - 3, SW, 3);
};

const drawWait = (g: G, c: Ctx) => {
	curtain(g, 0);
	// すきまから もれる 光
	const a = c.still ? 0.3 : 0.2 + 0.12 * Math.sin(c.now / 700);
	g.fillStyle = `rgba(255, 230, 160, ${a.toFixed(3)})`;
	g.fillRect(SW / 2 - 1, 0, 2, SH);
	g.fillStyle = "#f4ead0";
	g.fillRect(SW / 2 - 44, 36, 88, 22);
	g.fillStyle = "#5a3418";
	g.fillRect(SW / 2 - 44, 36, 88, 1);
	g.fillRect(SW / 2 - 44, 57, 88, 1);
	text(g, KOHAKU_ART.soon, SW / 2, 42, 10, "#3a1a10");
	if (c.data.reha) text(g, KOHAKU_ART.kari, SW / 2, 64, 8, "#ffe0a0");
};

/** 両組の ならび（開幕・年越し・ことよろ）。hop は はねる 高さ。 */
const lineup = (g: G, c: Ctx, hop = 0) => {
	const h = (i: number) =>
		hop && !c.still ? Math.abs(Math.sin(c.now / 180 + i)) * hop : 0;
	stand(g, c, "princess", 14, { hop: h(0) });
	stand(g, c, "woman", 46, { hop: h(1) });
	stand(g, c, "hero", 122, { hop: h(2) });
	stand(g, c, "man", 154, { hop: h(3) });
};

const banners = (g: G) => {
	g.fillStyle = TEAM_INK.aka;
	g.fillRect(16, 44, 62, 12);
	text(g, KOHAKU_ART.aka, 47, 46, 8, "#ffffff");
	g.fillStyle = TEAM_INK.shiro;
	g.fillRect(122, 44, 62, 12);
	text(g, KOHAKU_ART.shiro, 153, 46, 8, "#c01828");
};

const drawKaimaku = (g: G, c: Ctx) => {
	backdrop(g, c, FUSUMA_ALL);
	const sweep = c.still ? 0 : Math.sin(c.now / 900) * 30;
	pillar(g, 60 + sweep, "#ff6a7a", 0.18);
	pillar(g, 140 - sweep, "#e8f0ff", 0.18);
	banners(g);
	lineup(g, c);
	curtain(g, clamp01(c.lt / 2000));
};

const drawAka = (g: G, c: Ctx) => {
	// 長い 音で 画面が 少し ゆれる（2.4秒ごとに 0.5秒）
	const shake =
		!c.still && c.lt % 2400 < 500 ? (Math.floor(c.now / 60) % 2 ? 1 : -1) : 0;
	g.save();
	g.translate(shake, 0);
	backdrop(g, c, [0, 32, 32, 32, 32, 32, 0]);
	pillar(g, SW / 2, "#ff4060", 0.28);
	g.fillStyle = "rgba(255, 60, 90, 0.18)";
	g.beginPath();
	g.ellipse(SW / 2, 88, 26, 5, 0, 0, Math.PI * 2);
	g.fill();
	stand(g, c, "princess", SW / 2 - 24, { scale: 3 });
	// 舞う 花びら
	for (let i = 0; i < 14; i++) {
		const t = c.still ? hash(i, 51) * 200 : c.now * 0.015;
		const y = Math.round(((t + hash(i, 52) * 120) % 110) - 6);
		const x = Math.round(
			hash(i, 53) * SW + (c.still ? 0 : Math.sin(c.now / 600 + i) * 5),
		);
		g.fillStyle = i % 2 ? "#ff9ab0" : "#ffd0dc";
		g.fillRect(x, y, 2, 1);
	}
	g.restore();
};

const drawShiro = (g: G, c: Ctx) => {
	backdrop(g, c, [16, 48, 48, 16, 48, 48, 16]);
	// 拍（0.5秒）で 光る 柱
	const beat = c.still ? 0 : Math.floor(c.now / 500);
	const inks = ["#80c0ff", "#ffffff", "#c080ff", "#80ffd0"];
	for (let i = 0; i < 4; i++)
		pillar(g, 30 + i * 46, inks[(i + beat) % 4], (i + beat) % 2 ? 0.28 : 0.1);
	const hop = (i: number) =>
		c.still ? 0 : (Math.floor(c.now / 250) + i) % 2 ? 3 : 0;
	stand(g, c, "man", 34, { fast: true, hop: hop(1) });
	stand(g, c, "hero", SW / 2 - 24, { scale: 3, fast: true, hop: hop(0) });
	stand(g, c, "man", 134, { fast: true, hop: hop(1) });
};

/** ageリレー：6人が 札を 右へ わたす（1.3秒ごと。最後の 人が 上に かかげて 紙ふぶき）。 */
const RELAY_STEP = 1300;
const RELAY_N = 6;

const drawRelay = (g: G, c: Ctx) => {
	backdrop(g, c, [0, 16, 64, 16, 64, 16, 0]);
	const xs = Array.from({ length: RELAY_N }, (_, i) => 14 + i * 32);
	const step = Math.min(RELAY_N - 1, Math.floor(c.lt / RELAY_STEP));
	const into = c.lt - step * RELAY_STEP;
	const raise = clamp01((c.lt - (RELAY_N - 1) * RELAY_STEP - 900) / 400);
	// 名無しの 列（2倍。札を 持つ 人は 少し はねる）
	xs.forEach((x, i) => {
		const body = [
			"#4a6aa0",
			"#6a8a4a",
			"#8a5a8a",
			"#a0704a",
			"#4a8a8a",
			"#7a4a4a",
		][i];
		const hop = i === step && !c.still && into < 300 ? 2 : 0;
		g.save();
		g.translate(x, 62 - hop);
		g.scale(2, 2);
		person(g, 0, 0, body, "#2a2020");
		g.restore();
	});
	// 札の 位置（わたす 0.3秒で となりへ。最後の 人は 頭の 上に かかげる）
	const passing = step > 0 && into < 300;
	const from = xs[passing ? step - 1 : step];
	const to = xs[step];
	const p = passing ? into / 300 : 1;
	const bx = Math.round(from + (to - from) * p) + 6;
	const by = Math.round(70 - raise * 18);
	g.fillStyle = "#ffffff";
	g.fillRect(bx, by, 14, 9);
	g.fillStyle = "#2a2a36";
	g.fillRect(bx, by, 14, 1);
	text(g, KOHAKU_ART.baton, bx + 7, by + 1, 7, "#c01828");
	if (raise >= 1) confetti(g, c, ["#ffe060", "#ff6a7a", "#ffffff", "#80c0ff"]);
};

/** 大トリ：大きな 金の 扇が ひらく。 */
const drawTori = (g: G, c: Ctx) => {
	backdrop(g, c, [96, 96, 96, 96, 96, 96, 96]);
	const open = clamp01(c.lt / 1500);
	const cx = SW / 2;
	const cy = 80;
	const rays = 13;
	for (let i = 0; i < rays; i++) {
		const a = Math.PI + (Math.PI * i) / (rays - 1);
		const a0 = Math.PI * 1.5 + (a - Math.PI * 1.5) * open;
		g.fillStyle = i % 2 ? "#ffd860" : "#e8a830";
		g.beginPath();
		g.moveTo(cx, cy);
		g.arc(cx, cy, 62, a0 - 0.13, a0 + 0.13);
		g.closePath();
		g.fill();
	}
	g.fillStyle = "#c8282c";
	g.beginPath();
	g.arc(cx, cy, 18, Math.PI, 0);
	g.fill();
	pillar(g, cx - 50, "#fff0a0", 0.2);
	pillar(g, cx + 50, "#fff0a0", 0.2);
	stand(g, c, "king", cx - 24, { scale: 3 });
	if (!c.still) {
		const k = Math.floor(c.now / 120);
		g.fillStyle = "#ffffff";
		for (let i = 0; i < 8; i++) {
			if (hash(i, k, 61) > 0.5) continue;
			g.fillRect(
				Math.floor(hash(i, k, 62) * SW),
				Math.floor(hash(i, k, 63) * 70),
				1,
				1,
			);
		}
	}
};

/** 審査：得点板に 札が 1枚ずつ（勝った 組の 色の 紙ふぶき）。 */
const drawShinsa = (g: G, c: Ctx) => {
	backdrop(g, c, [0, 16, 16, 16, 16, 16, 0]);
	const cards = c.data.cards ?? [];
	const at = c.data.countAt ?? Number.POSITIVE_INFINITY;
	const step = c.data.step ?? 400;
	const shown =
		c.t < at ? 0 : Math.min(cards.length, Math.floor((c.t - at) / step) + 1);
	const n = { aka: 0, shiro: 0 };
	for (let i = 0; i < shown; i++) n[cards[i]]++;
	const done = shown >= cards.length && cards.length > 0;
	// 得点板
	g.fillStyle = "#101018";
	g.fillRect(36, 6, 128, 54);
	g.fillStyle = "#c8a040";
	g.fillRect(36, 6, 128, 1);
	g.fillRect(36, 59, 128, 1);
	text(g, KOHAKU_ART.board, SW / 2, 8, 8, "#c8c0a0");
	for (const [team, x] of [
		["aka", 44],
		["shiro", 104],
	] as const) {
		g.fillStyle = TEAM_INK[team];
		g.fillRect(x, 20, 52, 9);
		text(
			g,
			KOHAKU_ART[team],
			x + 26,
			21,
			7,
			team === "aka" ? "#ffffff" : "#c01828",
		);
		const s = String(n[team]);
		const win = done && c.data.winner === team;
		const blink = win && !c.still && Math.floor(c.now / 300) % 2;
		num(
			g,
			s,
			x + 26 - numW(s, 4) / 2,
			34,
			4,
			blink ? "#ffe060" : TEAM_INK[team],
		);
	}
	// 札の 列（数えた 順）
	for (let i = 0; i < cards.length; i++) {
		const x = 52 + i * 11;
		g.fillStyle = i < shown ? TEAM_INK[cards[i]] : "#3a3040";
		g.fillRect(x, 64, 8, 10);
		if (i === shown - 1 && !done && !c.still) {
			g.fillStyle = "rgba(255, 255, 255, 0.6)";
			g.fillRect(x - 1, 63, 10, 1);
		}
	}
	// 審査員（背中）
	for (let i = 0; i < 3; i++)
		chara(g, c.imgs.chars.judge, 0, 0, 40 + i * 48, 76, 1.5, "#5a4a3a");
	if (done && c.data.winner) {
		const w = c.data.winner;
		confetti(
			g,
			c,
			w === "aka"
				? ["#d8283c", "#ff8090", "#ffd0d8"]
				: ["#ffffff", "#e0e4f0", "#c0c8e0"],
		);
		// 両組の 数の あいだに 札（数に かからない 幅）
		g.fillStyle = "rgba(0, 0, 0, 0.7)";
		g.fillRect(SW / 2 - 23, 37, 46, 13);
		text(g, KOHAKU_ART.win[w], SW / 2, 39, 8, TEAM_INK[w], {
			outline: "#000000",
		});
	}
};

/** 除夜の 鐘：雪の 寺（2.6秒ごとに 撞く）。 */
const BELL_EVERY = 2600;

const drawKane = (g: G, c: Ctx) => {
	bands(g, ["#060818", "#0a1028", "#121a3a", "#1a2448"], 0, SH);
	// 月
	g.fillStyle = "rgba(255, 244, 200, 0.18)";
	g.beginPath();
	g.arc(176, 16, 11, 0, Math.PI * 2);
	g.fill();
	g.fillStyle = "#f4ecc8";
	g.beginPath();
	g.arc(176, 16, 6, 0, Math.PI * 2);
	g.fill();
	// 遠くの 山と 寺の 屋根
	g.fillStyle = "#0a0e1e";
	g.beginPath();
	g.moveTo(0, 70);
	g.lineTo(50, 52);
	g.lineTo(100, 66);
	g.lineTo(150, 50);
	g.lineTo(SW, 64);
	g.lineTo(SW, SH);
	g.lineTo(0, SH);
	g.closePath();
	g.fill();
	g.fillStyle = "#141826";
	g.fillRect(118, 54, 70, 30);
	g.beginPath();
	g.moveTo(108, 56);
	g.lineTo(153, 38);
	g.lineTo(198, 56);
	g.closePath();
	g.fill();
	g.fillStyle = "#e8eef8";
	g.fillRect(112, 54, 82, 2);
	// 寺の あかり（ゆっくり ゆらぐ）
	const glow = c.still ? 0.3 : 0.24 + 0.08 * Math.sin(c.now / 500);
	g.fillStyle = `rgba(255, 180, 90, ${glow.toFixed(3)})`;
	g.fillRect(124, 60, 58, 20);
	g.fillStyle = "#f0b060";
	for (const wx of [130, 146, 162, 176]) g.fillRect(wx, 64, 4, 9);
	// 鐘つき堂（柱・屋根・鐘・撞木）
	g.fillStyle = "#2a1c14";
	g.fillRect(36, 30, 3, 58);
	g.fillRect(85, 30, 3, 58);
	g.fillStyle = "#1a1418";
	g.beginPath();
	g.moveTo(26, 32);
	g.lineTo(62, 14);
	g.lineTo(98, 32);
	g.closePath();
	g.fill();
	g.fillStyle = "#e8eef8";
	g.fillRect(30, 30, 64, 2);
	const k = Math.floor(c.lt / BELL_EVERY);
	const since = c.lt - k * BELL_EVERY;
	const swing = c.still
		? 0
		: Math.max(0, 1 - since / 700) * Math.sin(since / 60);
	const bx = 62 + Math.round(swing);
	g.fillStyle = "#7a5a2a";
	g.fillRect(bx - 9, 38, 18, 24);
	g.fillRect(bx - 11, 58, 22, 4);
	g.fillStyle = "#9a7a3a";
	g.fillRect(bx - 7, 40, 3, 18);
	g.fillStyle = "#5a3a1a";
	g.fillRect(bx - 1, 34, 2, 4);
	// 撞木（打つ 前に 引いて、打つ）
	const pull =
		since > BELL_EVERY - 600 ? (since - (BELL_EVERY - 600)) / 600 : 0;
	const lx = 6 - Math.round(pull * 8) + (since < 120 ? 4 : 0);
	g.fillStyle = "#8a6a4a";
	g.fillRect(lx, 48, 40, 4);
	// 鳴った 輪と 文字
	if (since < 1600) {
		const r = 10 + since * 0.04;
		const a = 1 - since / 1600;
		g.strokeStyle = `rgba(220, 230, 255, ${(a * 0.6).toFixed(3)})`;
		g.lineWidth = 1;
		g.beginPath();
		g.arc(62, 50, r, 0, Math.PI * 2);
		g.stroke();
		g.globalAlpha = a;
		text(g, KOHAKU_ART.bell, 62, 6, 8, "#dfe6ff");
		g.globalAlpha = 1;
	}
	// 雪（屋根に つもる）
	g.fillStyle = "#ffffff";
	for (let i = 0; i < 40; i++) {
		const t = c.still ? hash(i, 71) * 300 : c.now * (0.01 + hash(i, 72) * 0.01);
		const y = Math.round((t + hash(i, 73) * SH) % SH);
		const x = Math.round(
			(hash(i, 74) * SW + (c.still ? 0 : Math.sin(c.now / 800 + i) * 4) + SW) %
				SW,
		);
		g.fillRect(x, y, i % 4 ? 1 : 2, 1);
	}
	g.fillStyle = "#e8eef8";
	g.fillRect(0, 88, SW, SH - 88);
};

/** 舞台の 時計（その 日の 時刻 = 24:00 − 新年までの 残り）。 */
const ledClock = (g: G, c: Ctx, cx: number, y: number, k: number) => {
	const left = kohakuLeft(c.t, c.data.exact);
	const s = left === null ? 0 : Math.max(0, 86400 - left) % 86400;
	const parts = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(
		(n) => String(n).padStart(2, "0"),
	);
	const w = numW("00", k);
	const gap = 3 * k;
	const total = w * 3 + gap * 2;
	const x0 = Math.round(cx - total / 2);
	g.fillStyle = "#0a0a12";
	g.fillRect(x0 - 4, y - 3, total + 8, 5 * k + 6);
	parts.forEach((p, i) => {
		const x = x0 + i * (w + gap);
		num(g, p, x, y, k, "#ff8040");
		if (i < 2) {
			g.fillStyle = "#ff8040";
			g.fillRect(x + w + k, y + k, k, k);
			g.fillRect(x + w + k, y + 3 * k, k, k);
		}
	});
};

const drawToshi = (g: G, c: Ctx) => {
	backdrop(g, c, FUSUMA_ALL);
	ledClock(g, c, SW / 2, 14, 3);
	if (c.data.reha) text(g, KOHAKU_ART.kari, SW / 2, 36, 7, "#ffe0a0");
	lineup(g, c);
	stand(g, c, "king", SW / 2 - 16);
	const a = c.still ? 0.2 : 0.14 + 0.08 * Math.sin(c.now / 300);
	pillar(g, 40, "#ffffff", a);
	pillar(g, SW - 40, "#ffffff", a);
};

/** 花火（1つの 玉。ms は 上がってから）。 */
const firework = (g: G, x: number, y: number, ms: number, ink: string) => {
	if (ms < 0 || ms > 1400) return;
	const r = Math.min(1, ms / 500) * 22;
	const a = 1 - Math.max(0, (ms - 600) / 800);
	g.globalAlpha = Math.max(0, a);
	g.fillStyle = ink;
	for (let i = 0; i < 14; i++) {
		const t = (i / 14) * Math.PI * 2;
		g.fillRect(
			Math.round(x + Math.cos(t) * r),
			Math.round(y + Math.sin(t) * r),
			2,
			2,
		);
	}
	g.globalAlpha = 1;
};

const drawCue = (g: G, c: Ctx) => {
	const exact = c.data.exact ?? Number.POSITIVE_INFINITY;
	const left = exact - c.t;
	if (left > 0) {
		backdrop(g, c, FUSUMA_ALL);
		g.fillStyle = "rgba(0, 0, 0, 0.55)";
		g.fillRect(0, 0, SW, SH);
		if (left > 3000) {
			ledClock(g, c, SW / 2, 30, 5);
			return;
		}
		// 3・2・1（合図ごとに 大きく）
		const d = String(Math.ceil(left / 1000 - 1e-9));
		const into = 1 - ((left / 1000) % 1 || 1);
		const k = c.still ? 10 : Math.round(12 - into * 3);
		const lit = c.pulses.some((p) => c.now - p >= 0 && c.now - p < 200);
		num(
			g,
			d,
			SW / 2 - numW(d, k) / 2,
			SH / 2 - (5 * k) / 2,
			k,
			lit ? "#ffffff" : "#ffe060",
		);
		return;
	}
	// 0時：白い 光 → 花火と「あけおめ」
	const since = -left;
	bands(g, ["#05071a", "#0a0e26", "#141a3a", "#1c2448"], 0, SH);
	if (!c.still)
		for (let i = 0; i < 6; i++) {
			const t0 = i * 450;
			const per = 2700;
			const ms = (since - t0 + per * 4) % per;
			firework(
				g,
				30 + hash(i, 81) * 140,
				20 + hash(i, 82) * 40,
				ms,
				["#ff6a7a", "#ffe060", "#80c0ff", "#ffffff", "#c080ff", "#80ffd0"][i],
			);
		}
	text(g, KOHAKU_ART.akeome, SW / 2, 40, 16, "#ffffff", { outline: "#c01828" });
	text(g, KOHAKU_ART.newYear, SW / 2, 64, 9, "#ffe060");
	const yr = String(c.data.year ?? "");
	num(g, yr, SW / 2 - numW(yr, 2) / 2, 78, 2, "#ffe060");
	const a = 1 - clamp01(since / 900);
	if (a > 0) {
		g.fillStyle = `rgba(255, 255, 255, ${a.toFixed(3)})`;
		g.fillRect(0, 0, SW, SH);
	}
};

const drawKotoyoro = (g: G, c: Ctx) => {
	backdrop(g, c, FUSUMA_ALL);
	g.fillStyle = "#c01828";
	g.fillRect(SW / 2 - 46, 42, 92, 13);
	text(g, KOHAKU_ART.newYear, SW / 2, 44, 9, "#ffe060");
	lineup(g, c, 6);
	stand(g, c, "king", SW / 2 - 16, {
		hop: c.still ? 0 : Math.abs(Math.sin(c.now / 200)) * 4,
	});
	const beat = c.still ? 0 : Math.floor(c.now / 400);
	const inks = ["#ff6a7a", "#ffffff", "#ffe060", "#80c0ff"];
	for (let i = 0; i < 4; i++)
		pillar(g, 26 + i * 50, inks[(i + beat) % 4], 0.16);
	confetti(g, c, ["#d8283c", "#ffffff", "#ffe060"]);
};

/** 初日の出（保守村の 海。映画館の 予告と 同じ 色で）。 */
const drawHinode = (g: G, c: Ctx) => {
	bands(g, ["#2c2350", "#5a2f62", "#a0466a", "#d86a52", "#f29a52"], 0, 66);
	const up = clamp01(c.lt / 12000);
	const sy = Math.round(78 - up * 40);
	g.fillStyle = "#ffe8a0";
	g.beginPath();
	g.arc(SW / 2 + 20, sy, 13, 0, Math.PI * 2);
	g.fill();
	g.fillStyle = "#fff6d8";
	g.beginPath();
	g.arc(SW / 2 + 20, sy, 9, 0, Math.PI * 2);
	g.fill();
	// 海と 光の 道
	g.fillStyle = "#2e3a6a";
	g.fillRect(0, 66, SW, SH - 66);
	g.fillStyle = "#ffd890";
	for (let i = 0; i < 6; i++) {
		const w = 18 - i * 2;
		const off = c.still ? 0 : Math.round(Math.sin(c.now / 400 + i) * 2);
		g.fillRect(SW / 2 + 20 - w / 2 + off, 68 + i * 5, w, 1);
	}
	// 桟橋の 影と かもめ
	g.fillStyle = "#141020";
	g.fillRect(0, 74, 54, 4);
	for (let x = 4; x < 54; x += 10) g.fillRect(x, 78, 2, 10);
	g.fillStyle = "#1a1424";
	for (let i = 0; i < 3; i++) {
		const gx = c.still
			? 60 + i * 30
			: Math.round((c.now * 0.01 + i * 70) % (SW + 20)) - 10;
		const gy = 24 + i * 7;
		g.fillRect(gx, gy, 2, 1);
		g.fillRect(gx + 3, gy, 2, 1);
		g.fillRect(gx + 2, gy + 1, 1, 1);
	}
	// 浜に ならぶ 名無し
	for (let i = 0; i < 5; i++) person(g, 70 + i * 12, 86, "#1a1424", "#100c18");
};

const drawMaku = (g: G, c: Ctx) => {
	backdrop(g, c, FUSUMA_ALL);
	lineup(g, c);
	curtain(g, 1 - clamp01(c.lt / 1500));
	if (c.lt >= 1500) text(g, KOHAKU_ART.end, SW / 2, 44, 8, "#f4ead0");
};

// ───────────────── 会場の 枠（劇場） ─────────────────

const drawFrame = (
	g: G,
	now: number,
	v: JkView,
	imgs: Imgs,
	live: boolean,
	still: boolean,
) => {
	const base = imgs.base;
	// 両わきの 赤い 幕
	for (const x0 of [0, SX + SW]) {
		const w = x0 === 0 ? SX : 240 - x0;
		g.fillStyle = "#5a0a16";
		g.fillRect(x0, 0, w, 135);
		if (base)
			for (let y = 6; y < 112; y += 48)
				g.drawImage(
					base,
					CURTAIN[0],
					CURTAIN[1],
					16,
					48,
					x0 + (w - 16) / 2,
					y,
					16,
					48,
				);
		else {
			g.fillStyle = "#8a1020";
			g.fillRect(x0 + 2, 0, w - 4, 112);
		}
	}
	// 上の 幕の かざり
	if (base)
		for (let x = 0; x < 240; x += 16)
			g.drawImage(base, VALANCE[0], VALANCE[1], 16, 16, x, -6, 16, 16);
	else {
		g.fillStyle = "#8a1020";
		g.fillRect(0, 0, 240, SY);
	}
	// 金の 額ぶちと 舞台の へり
	g.fillStyle = "#c8a040";
	g.fillRect(SX - 1, SY, 1, SH);
	g.fillRect(SX + SW, SY, 1, SH);
	g.fillStyle = "#3a2010";
	g.fillRect(0, SY + SH, 240, 4);
	g.fillStyle = "#8a5a30";
	g.fillRect(0, SY + SH, 240, 1);
	// 客の 頭と ペンライト（紅と 白。本番は 多く、洪水では みんな ふる）
	g.fillStyle = "#08060a";
	g.fillRect(0, 114, 240, 21);
	for (let i = 0; i < 12; i++) {
		const x = 10 + i * 20;
		const y = 124 + (i % 2) * 3;
		g.fillStyle = "#0e0a10";
		g.beginPath();
		g.arc(x, y, 8, Math.PI, 0);
		g.fill();
		g.fillRect(x - 11, y, 22, 135 - y);
		const lit = v.flood || hash(i, 91) < (live ? 0.7 : 0.35);
		if (!lit) continue;
		const sway = still ? 0 : Math.sin(now / (v.flood ? 160 : 420) + i * 1.3);
		const tx = x + 6 + Math.round(sway * 3);
		g.fillStyle =
			i % 2 ? "rgba(255, 90, 110, 0.35)" : "rgba(230, 240, 255, 0.35)";
		g.fillRect(tx - 2, y - 13, 5, 9);
		g.fillStyle = i % 2 ? "#ff5a6e" : "#f0f4ff";
		g.fillRect(tx, y - 12, 1, 8);
		g.fillStyle = "#3a3a44";
		g.fillRect(x + 6, y - 4, 1, 4);
	}
};

/** 紅白スレ合戦の TV。live は 大みそかの 本番（ペンライトが 多い）。 */
export const kohakuTv = (
	canvas: HTMLCanvasElement,
	opt: { reduced: boolean; live: boolean },
): SceneTv => {
	canvas.width = 480;
	canvas.height = 270;
	const g0 = canvas.getContext("2d");
	if (!g0) throw new Error("canvas");
	const g = g0;
	const imgs: Imgs = { base: null, chars: {} };
	let pulses: number[] = [];
	let grade: { g: JkCueGrade; at: number } | null = null;
	let kanso: { at: number } | null = null;
	let lastSeg: JkView["seg"] = null;
	const still = opt.reduced;
	const TINT: Partial<Record<CharKey, KohakuTeam>> = {
		princess: "aka",
		woman: "aka",
		hero: "shiro",
		man: "shiro",
	};
	return {
		load: async () => {
			const one = async (k: CharKey) => {
				const img = await loadImage(CHARS[k]).catch(() => null);
				if (!img) return;
				const team = TINT[k];
				imgs.chars[k] = team ? tinted(img, team) : img;
			};
			await Promise.race([
				Promise.all([
					loadImage(BASE)
						.then((img) => {
							imgs.base = img;
						})
						.catch(() => undefined),
					...(Object.keys(CHARS) as CharKey[]).map(one),
				]),
				new Promise((r) => setTimeout(r, 1000)),
			]);
		},
		onEv: (ev: JkEv, now: number) => {
			if (ev.t === "open") pulses = [];
			if (ev.t === "pulse") pulses.push(now);
			if (ev.t === "grade") grade = { g: ev.grade, at: now };
			if (ev.t === "kanso") kanso = { at: now };
		},
		draw: (now: number, v: JkView) => {
			g.setTransform(2, 0, 0, 2, 0, 0);
			g.imageSmoothingEnabled = false;
			g.fillStyle = "#0e080c";
			g.fillRect(0, 0, 240, 135);
			const seg = v.seg ?? lastSeg;
			lastSeg = seg;
			const c: Ctx = {
				lt: Math.max(0, v.t - (seg?.start ?? 0)),
				t: v.t,
				now,
				still,
				data: (seg?.data ?? {}) as KohakuData,
				imgs,
				live: opt.live,
				pulses,
			};
			g.save();
			g.translate(SX, SY);
			g.beginPath();
			g.rect(0, 0, SW, SH);
			g.clip();
			switch (seg?.scene) {
				case "kaimaku":
					drawKaimaku(g, c);
					break;
				case "aka":
					drawAka(g, c);
					break;
				case "shiro":
					drawShiro(g, c);
					break;
				case "relay":
					drawRelay(g, c);
					break;
				case "tori":
					drawTori(g, c);
					break;
				case "shinsa":
					drawShinsa(g, c);
					break;
				case "kane":
					drawKane(g, c);
					break;
				case "toshi":
					drawToshi(g, c);
					break;
				case "cue":
					drawCue(g, c);
					break;
				case "kotoyoro":
					drawKotoyoro(g, c);
					break;
				case "hinode":
					drawHinode(g, c);
					break;
				case "maku":
					drawMaku(g, c);
					break;
				default:
					drawWait(g, c);
			}
			if (seg?.caption) {
				g.fillStyle = "rgba(0, 0, 0, 0.55)";
				g.fillRect(0, SH - 13, SW, 13);
				text(g, seg.caption, SW / 2, SH - 11, 8, "#ffffff");
			}
			g.restore();
			drawFrame(g, now, v, imgs, opt.live, still);
			if (grade && now - grade.at < 1800)
				text(g, JK_PROG_TV.grade[grade.g], 236, 12, 10, GRADE_INK[grade.g], {
					align: "right",
					outline: "#000000",
				});
			if (kanso && now - kanso.at < 2200)
				text(g, JK_PROG_TV.kansoTv, 120, 12, 10, "#ffe060", {
					outline: "#000000",
				});
		},
	};
};
