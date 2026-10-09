// 午後の　B級映画『メガ荒らしザメ』の TV（ui/jikkyoWatch.ts の 板の 上の キャンバス）。
// 形は ui/jikkyoTvKit.ts（480x270 の 2倍の 下地に 240x135 の 座標）。会場の 枠は 映画館の TV（ui/jikkyoScenes.ts）と
// 同じ 雰囲気：赤い 幕・まんなかに スクリーン・下に 客の 頭と スマホの 光（平日の 昼は 少し、洪水では みんな）。
// - 場面（data/jikkyo/gogo.ts の GOGO_SCENES）：カード（まもなく・予告・おわり）・OP（午後の　B級映画の ロゴ → 安い CG の 題）・
//   浜（泳ぐ 人の 向こうを ヒレ）・竜巻（サメが 回る）・陸（ヒレで 歩く → 頭が 増える → 店主が 花火を かつぐ）・CM・
//   山場（のみこむ → 導火線の 火花が 合図ごとに 光る → 昼の 空で 花火 → 平和な 浜）・エンディング（スタッフロールと また ヒレ）。
// - 凝った 絵は 2つ：陸の 頭が 増える サメ と 山場の 花火。サメは 塗りの 字の 絵（SAME）に 緑の ふち（安い 合成）。
// - 絵に 出す 文は GOGO_ART。場面の 進みは 名目の 時計（c.lt・c.t）、点滅だけ 実際の 時計（c.now）。
// - 動きを へらす 設定（c.still）：ゆれ・点滅・稲光・飛びちりを 止めて 止まった 絵で 見せる。

import { GOGO_ART, type GogoData } from "../data/jikkyo/gogo";
import {
	bands,
	blit,
	clamp01,
	type G,
	hash,
	makeTv,
	num,
	numW,
	person,
	pulseGlow,
	type Screen,
	type TvCtx,
	text,
} from "./jikkyoTvKit";

type C = TvCtx<GogoData>;

/** スクリーン（240x135 の 中。映画館の TV と 同じ 場所）。 */
const SCREEN: Screen = { x: 24, y: 7, w: 192, h: 104 };
const SW = SCREEN.w;
const SH = SCREEN.h;

// ───────────────── サメ（左向き。安い CG） ─────────────────

/** サメ（20x9。# 体・w 腹・f ヒレ・e 目・t 歯・m 口）。 */
const SAME = [
	"........f...........",
	".......ff.........ff",
	"....#######......ff.",
	"..###########...ff..",
	".#e############ff...",
	"################f...",
	"#tmt#wwwwwww####ff..",
	".##wwwwwwwww##...ff.",
	"...wwwwwwww.......ff",
] as const;

/** 増えた 頭（8x6）。 */
const HEAD = [
	"..#####.",
	".#e#####",
	"########",
	"#tmt####",
	".##wwww#",
	"...www..",
] as const;

const FIN = ["..f", ".ff", "fff"] as const;

const SAME_INK = {
	"#": "#7a8a9a",
	w: "#e8eef2",
	f: "#5a6a7a",
	e: "#101418",
	t: "#ffffff",
	m: "#5a1a22",
} as const;

/** 1色で 塗る（緑の ふち・影・花火の 形）。 */
const mono = (ink: string) =>
	({ "#": ink, w: ink, f: ink, e: ink, t: ink, m: ink }) as const;

const FRINGE = mono("#3ae060");

/** サメを 描く（k 倍。heads は 頭の 数、fringe は 安い 合成の 緑の ふち、walk は ヒレの 足の コマ）。 */
const shark = (
	g: G,
	x: number,
	y: number,
	k: number,
	o: {
		heads?: number;
		fringe?: boolean;
		walk?: number;
		ink?: Readonly<Record<string, string>>;
	} = {},
): void => {
	const heads = o.heads ?? 1;
	const ink: Readonly<Record<string, string>> = o.ink ?? SAME_INK;
	const extra: [number, number][] = [];
	if (heads >= 2) extra.push([x - k, y - 6 * k]);
	if (heads >= 3) extra.push([x - k, y + 6 * k]);
	if (o.fringe)
		for (const [dx, dy] of [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1],
		]) {
			blit(g, SAME, x + dx, y + dy, FRINGE, k);
			for (const [hx, hy] of extra) blit(g, HEAD, hx + dx, hy + dy, FRINGE, k);
		}
	// 首（増えた 頭と 体を つなぐ）
	g.fillStyle = ink["#"];
	for (const [hx, hy] of extra)
		g.fillRect(hx + 6 * k, Math.min(hy, y) + 3 * k, 4 * k, Math.abs(hy - y));
	blit(g, SAME, x, y, ink, k);
	for (const [hx, hy] of extra) blit(g, HEAD, hx, hy, ink, k);
	// ヒレの 足（陸を 歩く）
	if (o.walk !== undefined) {
		g.fillStyle = ink.f;
		const a = o.walk % 2;
		g.fillRect(x + 5 * k, y + 9 * k, 2 * k, (2 + a) * k);
		g.fillRect(x + 11 * k, y + 9 * k, 2 * k, (3 - a) * k);
	}
};

/** 海を 横切る ヒレ（白い 波を ひく）。 */
const fin = (g: G, x: number, y: number, k = 2): void => {
	blit(g, FIN, x, y, { f: "#4a5a6a" }, k);
	g.fillStyle = "#e8f4ff";
	g.fillRect(x + 3 * k, y + 3 * k - 1, 6 * k, 1);
};

// ───────────────── 浜（浜・竜巻・山場の 下地） ─────────────────

const wave = (c: C, i: number, span: number) =>
	Math.round((c.t * 0.008 + i * 37) % span);

/** 空・海・砂（sea は 海の 上の 線、sand は 砂の 上の 線）。 */
const beach = (
	g: G,
	c: C,
	sky: readonly string[],
	sea: number,
	sand: number,
): void => {
	bands(g, SW, sky, 0, sea);
	g.fillStyle = "#2a78c0";
	g.fillRect(0, sea, SW, sand - sea);
	g.fillStyle = "#3a8ad0";
	g.fillRect(0, sea + 6, SW, 4);
	g.fillStyle = "#cfe8ff";
	for (let i = 0; i < 6; i++)
		g.fillRect(wave(c, i, SW + 12) - 6, sea + 3 + (i % 3) * 5, 6, 1);
	g.fillStyle = "#e2c890";
	g.fillRect(0, sand, SW, SH - sand);
	g.fillStyle = "#f2dcaa";
	g.fillRect(0, sand, SW, 2);
};

const DAY = ["#5ab0e8", "#74c0ec", "#92d0f2", "#b4e0f8"] as const;

/** 海の家「age」（赤白の 屋根と 看板）。 */
const hut = (g: G, x: number, y: number): void => {
	for (let i = 0; i < 5; i++) {
		g.fillStyle = i % 2 ? "#ffffff" : "#d84040";
		g.fillRect(x + i * 9, y, 9, 7);
	}
	g.fillStyle = "#f0e0c0";
	g.fillRect(x + 3, y + 7, 39, 20);
	g.fillStyle = "#2a4a8a";
	g.fillRect(x + 9, y + 9, 26, 9);
	text(g, GOGO_ART.hut, x + 22, y + 9, 8, "#ffffff");
	g.fillStyle = "#6a4020";
	g.fillRect(x + 17, y + 19, 10, 8);
};

/** 海の家の 店主（白い シャツ・はちまき）。 */
const owner = (g: G, x: number, y: number): void => {
	person(g, x, y, "#f4f4f4", "#2a2020");
	g.fillStyle = "#d84040";
	g.fillRect(x + 1, y + 1, 4, 1);
};

/** 打ち上げ花火（赤い 筒と 導火線）。 */
const rocket = (g: G, x: number, y: number, lit: boolean): void => {
	g.fillStyle = "#c82a2a";
	g.fillRect(x, y, 5, 12);
	g.fillStyle = "#ffffff";
	g.fillRect(x, y + 4, 5, 2);
	g.fillStyle = "#3a2a1a";
	g.fillRect(x + 2, y - 3, 1, 3);
	if (lit) {
		g.fillStyle = "#ffe060";
		g.fillRect(x + 1, y - 5, 3, 2);
	}
};

// ───────────────── カード ─────────────────

const filmHoles = (g: G, c: C): void => {
	g.fillStyle = "#1c1a18";
	g.fillRect(0, 0, SW, 8);
	g.fillRect(0, SH - 8, SW, 8);
	g.fillStyle = "#6a6458";
	const off = c.still ? 0 : Math.floor(c.lt / 80) % 8;
	for (let x = -off; x < SW; x += 8) {
		g.fillRect(x + 2, 2, 4, 4);
		g.fillRect(x + 2, SH - 6, 4, 4);
	}
};

const card = (g: G, c: C): void => {
	g.fillStyle = "#0a0a10";
	g.fillRect(0, 0, SW, SH);
	const s = c.data.card ?? GOGO_ART.logo;
	if (c.data.phase === "soon") {
		// 映写の 秒読み（5 → 1）
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
		text(g, s, cx, 78, 8, "#e8e0c8");
	} else if (c.data.phase === "preview") {
		// 続編は 青い 海と 大きな サメ、過去ログは セピアの 海
		const old = s.includes("過去ログ");
		bands(
			g,
			SW,
			old
				? ["#8a7a5a", "#a08a64", "#b49c72", "#c8b084"]
				: ["#2a5aa0", "#3a78c0", "#4a8ad0", "#5aa0e0"],
			8,
			SH - 16,
		);
		const x = Math.round(150 - clamp01(c.lt / 6000) * 60);
		shark(g, x, 58, 2, {
			fringe: !old,
			ink: old ? mono("#5a4a32") : SAME_INK,
		});
		text(g, s, SW / 2, 26, 12, "#ffffff", { outline: "#141018" });
	} else {
		text(g, s, SW / 2, 46, 10, "#a8a090");
	}
	filmHoles(g, c);
};

// ───────────────── OP ─────────────────

const LOGO_MS = 4500;

const op = (g: G, c: C): void => {
	if (c.lt < LOGO_MS) {
		// 午後の　B級映画（夕方 まえの 空と 太陽。VHS の 線）
		bands(g, SW, ["#f8d878", "#f6c068", "#f2a858", "#ea9050"], 0, SH);
		g.fillStyle = "#fff4c0";
		g.beginPath();
		g.arc(150, 30, 14, 0, Math.PI * 2);
		g.fill();
		const a = c.still ? 1 : clamp01(c.lt / 600);
		g.globalAlpha = a;
		text(g, GOGO_ART.logo, SW / 2, 42, 16, "#ffffff", { outline: "#a04010" });
		g.globalAlpha = 1;
		if (!c.still) {
			g.fillStyle = "rgba(255, 255, 255, 0.25)";
			g.fillRect(0, Math.floor(c.now / 30) % SH, SW, 2);
		}
		return;
	}
	// 題：海を ヒレが 横切り、安い CG の サメが 跳ねて 題が 出る
	const lt = c.lt - LOGO_MS;
	bands(g, SW, ["#0a1a3a", "#12284e", "#1a3a66", "#22507e"], 0, SH);
	g.fillStyle = "#3a6a9a";
	for (let i = 0; i < 8; i++)
		g.fillRect(wave(c, i, SW + 12) - 6, 70 + (i % 4) * 7, 8, 1);
	if (lt < 2000) fin(g, Math.round(SW - lt * 0.1), 64, 3);
	else {
		const p = clamp01((lt - 2000) / 1200);
		const y = Math.round(70 - Math.sin(p * Math.PI) * 50);
		if (p < 1) shark(g, Math.round(130 - p * 70), y, 2, { fringe: true });
		const shake = c.still ? 0 : Math.round(Math.sin(c.t / 40));
		g.globalAlpha = clamp01((lt - 2400) / 500);
		text(g, GOGO_ART.title, SW / 2 + shake, 30, 16, "#ffffff", {
			outline: "#c01828",
		});
		g.globalAlpha = 1;
	}
};

// ───────────────── 浜 ─────────────────

const hama = (g: G, c: C): void => {
	beach(g, c, DAY, 40, 70);
	g.fillStyle = "#fff6c0";
	g.beginPath();
	g.arc(26, 14, 8, 0, Math.PI * 2);
	g.fill();
	hut(g, 140, 43);
	// パラソル
	for (const [px, col] of [
		[40, "#e85a8a"],
		[96, "#f0c040"],
	] as const) {
		g.fillStyle = col;
		g.fillRect(px - 9, 72, 18, 3);
		g.fillRect(px - 6, 70, 12, 2);
		g.fillStyle = "#6a5a4a";
		g.fillRect(px, 75, 1, 12);
	}
	person(g, 48, 80, "#4a8ad0", "#2a2020");
	person(g, 104, 82, "#e07040", "#4a2a1a");
	// 泳ぐ 人（頭だけ。ゆれる）
	for (let i = 0; i < 3; i++) {
		const bob = c.still ? 0 : Math.round(Math.sin(c.t / 500 + i) * 1);
		g.fillStyle = "#2a2020";
		g.fillRect(30 + i * 34, 56 + bob, 4, 2);
		g.fillStyle = "#f2c8a0";
		g.fillRect(30 + i * 34, 58 + bob, 4, 2);
	}
	// 沖を ヒレが 横切る（誰も 気づかない）
	const fx = Math.round(SW + 10 - ((c.lt % 12000) / 12000) * (SW + 40));
	fin(g, fx, 44);
	// 「サメ　注意」の 札
	g.fillStyle = "#6a5a4a";
	g.fillRect(24, 86, 2, 12);
	g.fillStyle = "#f6e05a";
	g.fillRect(2, 76, 46, 11);
	g.fillStyle = "#c82a2a";
	g.fillRect(2, 76, 46, 1);
	text(g, GOGO_ART.sign, 25, 78, 8, "#2a1a0a");
};

// ───────────────── 竜巻 ─────────────────

const tatsumaki = (g: G, c: C): void => {
	beach(g, c, ["#2a2a3a", "#3a3a4a", "#4a4a5a", "#5a5a6a"], 62, 84);
	const cx = 96;
	// うずの 帯（下へ 細く。ゆれる）
	const rows = 13;
	for (let i = 0; i < rows; i++) {
		const w = 76 - i * 5;
		const sway = c.still ? 0 : Math.round(Math.sin(c.t / 300 + i * 0.6) * 3);
		g.fillStyle = i % 2 ? "#8a8a96" : "#a8a8b4";
		g.fillRect(cx - w / 2 + sway, 2 + i * 5, w, 5);
	}
	g.fillStyle = "rgba(220, 230, 255, 0.5)";
	g.fillRect(cx - 12, 64, 24, 4);
	// 回る サメ（4ひき）
	for (let j = 0; j < 4; j++) {
		const a = c.t / 700 + (j * Math.PI) / 2;
		const level = 6 + j * 12;
		const r = (76 - (level / 5) * 5) / 2;
		const sx = Math.round(cx + Math.cos(a) * r - 10);
		const sy = Math.round(level + Math.sin(a) * 3);
		shark(g, sx, sy, 1, { fringe: true });
	}
	// 雨と 稲光
	if (!c.still) {
		g.fillStyle = "rgba(190, 200, 230, 0.5)";
		for (let i = 0; i < 24; i++) {
			const rx = Math.round((hash(i, 1) * SW + c.t * 0.1) % SW);
			const ry = Math.round((hash(i, 2) * SH + c.t * 0.18) % SH);
			g.fillRect(rx, ry, 1, 3);
		}
		if (c.now % 4100 < 110) {
			g.fillStyle = "rgba(255, 255, 255, 0.45)";
			g.fillRect(0, 0, SW, SH);
		}
	}
	hut(g, 8, 70);
};

// ───────────────── 陸（ヒレで 歩く → 頭が 増える → 店主が 花火を かつぐ） ─────────────────

const HEAD_MS = 1500;

/** 浜の 通り（上に 海、下に 道）。 */
const street = (g: G, c: C): void => {
	bands(g, SW, DAY, 0, 22);
	g.fillStyle = "#2a78c0";
	g.fillRect(0, 22, SW, 12);
	g.fillStyle = "#cfe8ff";
	for (let i = 0; i < 5; i++) g.fillRect(wave(c, i, SW + 12) - 6, 26, 6, 1);
	g.fillStyle = "#b8b0a0";
	g.fillRect(0, 34, SW, 6);
	g.fillStyle = "#9a9488";
	g.fillRect(0, 40, SW, SH - 40);
	g.fillStyle = "#e8e4d8";
	for (let x = 4; x < SW; x += 20) g.fillRect(x, 74, 10, 2);
};

const riku = (g: G, c: C): void => {
	street(g, c);
	const phase = c.data.phase;
	const frame = c.still ? 0 : Math.floor(c.t / 260) % 2;
	const bob = c.still ? 0 : frame;
	if (phase === "atama") {
		// 頭が 1.5秒ごとに 1つ 増える（増えた 瞬間に 白く 光る）
		const heads = Math.min(3, 1 + Math.floor(c.lt / HEAD_MS));
		shark(g, 70, 52 + bob, 3, { heads, fringe: true, walk: frame });
		const since = c.lt - (heads - 1) * HEAD_MS;
		if (!c.still && heads > 1 && since < 250) {
			g.fillStyle = `rgba(255, 255, 255, ${(0.6 * (1 - since / 250)).toFixed(3)})`;
			g.fillRect(0, 0, SW, SH);
		}
		return;
	}
	if (phase === "ume") {
		hut(g, 140, 42);
		shark(g, 20, 54 + bob, 3, { heads: 3, fringe: true, walk: frame });
		// 店主が 花火を かついで 前に 出る
		const ox = Math.round(150 - clamp01(c.lt / 2000) * 20);
		owner(g, ox, 76);
		g.save();
		g.translate(ox + 4, 72);
		g.rotate(-0.5);
		rocket(g, 0, 0, false);
		g.restore();
		return;
	}
	// ヒレで 歩いて 来る（人は にげる）
	const x = Math.round(SW - 20 - clamp01(c.lt / 12000) * 110);
	shark(g, x, 52 + bob, 3, { fringe: true, walk: frame });
	for (let i = 0; i < 3; i++) {
		const px = Math.round(x - 30 - i * 14 - c.lt * 0.01 * (1 + i * 0.3));
		if (px > -8) person(g, px, 80 + (i % 2) * 6, "#4a6aa0", "#2a2020");
	}
};

// ───────────────── CM ─────────────────

const CM_INK = [
	{ bg: "#ffe8a0", board: "#c84a2a" },
	{ bg: "#e2ecff", board: "#2a6ab0" },
	{ bg: "#d8f0e0", board: "#2a7a4a" },
] as const;

const cm = (g: G, c: C): void => {
	const i = Math.max(0, Math.min(GOGO_ART.cm.length - 1, c.data.cm ?? 0));
	const ad = GOGO_ART.cm[i];
	const ink = CM_INK[i];
	g.fillStyle = ink.bg;
	g.fillRect(0, 0, SW, SH);
	g.fillStyle = "#f6f0e0";
	g.fillRect(40, 26, 112, 44);
	g.fillStyle = ink.board;
	g.fillRect(20, 12, 152, 14);
	text(g, ad.shop, SW / 2, 15, 8, "#ffffff");
	g.fillStyle = "#9ac8e8";
	g.fillRect(50, 36, 24, 16);
	g.fillRect(118, 36, 24, 16);
	g.fillStyle = "#6a5a4a";
	g.fillRect(86, 44, 20, 26);
	// 通販の 星（ちかちか）
	if (c.still || Math.floor(c.now / 400) % 2) {
		g.fillStyle = "#ffd040";
		g.fillRect(10, 40, 6, 6);
		g.fillRect(176, 48, 6, 6);
	}
	g.fillStyle = "rgba(255, 255, 255, 0.92)";
	g.fillRect(0, 74, SW, 14);
	text(g, ad.line, SW / 2, 77, 8, "#1a1a24");
	g.fillStyle = "#1a1a24";
	g.fillRect(SW - 22, 4, 18, 10);
	text(g, GOGO_ART.cmTag, SW - 13, 5, 8, "#ffffff");
};

// ───────────────── 山場（のみこむ → 合図 → 花火 → 平和） ─────────────────

const FIRE = ["#ffe060", "#ff7a5a", "#7ad0ff", "#b8ff7a", "#ff9ad8"] as const;

/** 花火の 輪（ms は 開いてからの 名目の 時）。 */
const burst = (
	g: G,
	c: C,
	cx: number,
	cy: number,
	ms: number,
	seed: number,
): void => {
	if (ms < 0) return;
	const p = c.still ? 0.8 : clamp01(ms / 900);
	const fade = c.still ? 1 : 1 - clamp01((ms - 900) / 900);
	if (fade <= 0) return;
	const r = 6 + p * 34;
	g.globalAlpha = fade;
	for (let i = 0; i < 20; i++) {
		const a = (i / 20) * Math.PI * 2 + seed;
		g.fillStyle = FIRE[(i + seed) % FIRE.length];
		for (const f of [1, 0.7, 0.45])
			g.fillRect(
				Math.round(cx + Math.cos(a) * r * f),
				Math.round(cy + Math.sin(a) * r * f + p * p * 6),
				2,
				2,
			);
	}
	g.globalAlpha = 1;
};

const hanabi = (g: G, c: C): void => {
	const phase = c.data.phase;
	const since = c.t - (c.data.exact ?? Number.POSITIVE_INFINITY);
	if (phase === "boom" || since >= 0) {
		// 昼の 空で 花火（サメが 昇って 開く。サメの 形の 火花）
		bands(g, SW, DAY, 0, 80);
		g.fillStyle = "#2a78c0";
		g.fillRect(0, 80, SW, SH - 80);
		const rise = clamp01(since / 500);
		if (rise < 1 && !c.still)
			shark(g, 76, Math.round(56 - rise * 30), 2, { heads: 3, fringe: true });
		const ms = since - 500;
		burst(g, c, 96, 34, ms, 0);
		burst(g, c, 50, 24, ms - 900, 2);
		burst(g, c, 146, 28, ms - 1700, 4);
		burst(g, c, 116, 44, ms - 2600, 1);
		// サメの 形の 火花 → 白い 煙の サメ（安い CG。のこって ゆっくり 流れる）
		const spark = c.still
			? 0.8
			: clamp01(ms / 300) * (1 - clamp01((ms - 2000) / 1200));
		const smoke = c.still ? 0 : 0.45 * clamp01((ms - 1800) / 1200);
		if (smoke > 0) {
			g.globalAlpha = smoke;
			const drift = Math.round(Math.max(0, ms - 1800) * 0.004);
			shark(g, 76 + drift, 24, 2, { heads: 3, ink: mono("#f4f8ff") });
		}
		if (spark > 0) {
			g.globalAlpha = spark;
			shark(g, 76, 24, 2, { heads: 3, ink: mono("#ffe060") });
		}
		g.globalAlpha = 1;
		return;
	}
	beach(g, c, DAY, 30, 60);
	hut(g, 146, 34);
	if (phase === "after") {
		// 平和な 浜：店主は 焼きそば、泳ぐ 人が もどる、火の粉が 降る
		owner(g, 158, 76);
		g.fillStyle = "#3a3a3a";
		g.fillRect(150, 86, 20, 3);
		g.fillStyle = "#c8843a";
		g.fillRect(152, 84, 16, 2);
		for (let i = 0; i < 4; i++) {
			g.fillStyle = "#2a2020";
			g.fillRect(24 + i * 30, 44, 4, 2);
			g.fillStyle = "#f2c8a0";
			g.fillRect(24 + i * 30, 46, 4, 2);
		}
		for (let i = 0; i < 8; i++) {
			const y = Math.round((c.lt * 0.01 + i * 13) % 30);
			g.fillStyle = FIRE[i % FIRE.length];
			g.fillRect(Math.round(hash(i, 8) * SW), y, 1, 1);
		}
		return;
	}
	// のみこむ（花火が 弧を えがいて サメの 口へ）
	owner(g, 160, 76);
	const lift = phase === "cue" ? c.pulses.length * 3 : 0;
	const shake =
		phase === "cue" && !c.still ? Math.round(Math.sin(c.t / 30)) : 0;
	const sx = 60 + shake;
	const sy = 54 - lift;
	shark(g, sx, sy, 3, { heads: 3, fringe: true });
	const p = clamp01(c.lt / 1500);
	if (phase === "pre" && p < 1)
		rocket(
			g,
			Math.round(158 - p * 92),
			Math.round(70 - Math.sin(p * Math.PI) * 40),
			true,
		);
	// のみこんだ あと：腹が 光る（合図ごとに 強く）
	if (phase === "cue" || p >= 1) {
		const glow = phase === "cue" ? pulseGlow(c, 300) : 0;
		const beat = c.still ? 0.5 : 0.35 + 0.25 * Math.sin(c.now / 160);
		g.fillStyle = `rgba(255, 160, 40, ${clamp01(beat + glow).toFixed(3)})`;
		g.fillRect(sx + 15, sy + 18, 24, 6);
		// 口から 導火線の 火花
		if (phase === "cue") {
			g.fillStyle = glow > 0 ? "#ffffff" : "#ffe060";
			for (let i = 0; i < 4; i++)
				g.fillRect(
					sx - 4 - Math.round(hash(i, Math.floor(c.now / 90)) * 6),
					sy + 18 + i * 2 - 3,
					2,
					1,
				);
			// 合図の 点（3つ）
			for (let i = 0; i < 3; i++) {
				g.fillStyle = i < c.pulses.length ? "#ffe060" : "#3a4a7a";
				g.fillRect(SW / 2 - 14 + i * 12, 92, 6, 6);
			}
			if (glow > 0) {
				g.fillStyle = `rgba(255, 255, 255, ${(0.3 * glow).toFixed(3)})`;
				g.fillRect(0, 0, SW, SH);
			}
		}
	}
};

// ───────────────── エンディング ─────────────────

const ROLL_MS = 11000;

const ed = (g: G, c: C): void => {
	bands(g, SW, ["#3a2a5a", "#6a3a6a", "#a0506a", "#d8785a", "#f0a050"], 0, 64);
	g.fillStyle = "#2a3a6a";
	g.fillRect(0, 64, SW, SH - 64);
	g.fillStyle = "#f0a050";
	for (let i = 0; i < 5; i++)
		g.fillRect(wave(c, i, SW + 12) - 6, 68 + i * 6, 8, 1);
	// また ヒレ（2秒 あとから ゆっくり）
	if (c.lt >= 2000) {
		const fx = Math.round(SW + 10 - ((c.lt - 2000) / 12000) * (SW - 40));
		fin(g, fx, 76, 3);
	}
	// スタッフロール（役は ぜんぶ 名無しさん。11秒で 流れきる）
	GOGO_ART.staff.forEach((s, i) => {
		const y = SH + 4 - c.lt * 0.018 + i * 16;
		if (y < -10 || y > SH) return;
		text(g, s, 64, Math.round(y), 8, "#ffffff", { outline: "#2a1a3a" });
	});
	if (c.lt >= ROLL_MS) {
		g.globalAlpha = c.still ? 1 : clamp01((c.lt - ROLL_MS) / 600);
		text(g, GOGO_ART.fin, SW / 2, 40, 12, "#ffffff", { outline: "#2a1a3a" });
		g.globalAlpha = 1;
	}
};

// ───────────────── 会場の 枠（映画館） ─────────────────

const HEADS = [12, 36, 60, 84, 108, 132, 156, 180, 204, 228] as const;

const frame = (g: G, c: C): void => {
	const { x: SX, y: SY } = SCREEN;
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
	// 客の 頭と スマホの 光（平日の 昼は 少し、土日は もっと 少し、洪水では みんな）
	HEADS.forEach((x, i) => {
		const y = 126 + (i % 2) * 3;
		g.fillStyle = "#0a0708";
		g.beginPath();
		g.arc(x, y, 9, Math.PI, 0);
		g.fill();
		g.fillRect(x - 13, y, 26, 135 - y);
		const lit = c.v.flood || hash(i, 37) < (c.live ? 0.35 : 0.15);
		if (!lit) return;
		g.globalAlpha = c.still
			? 0.9
			: 0.6 + 0.4 * Math.sin(c.now / 1100 + i * 1.7);
		g.fillStyle = "rgba(120, 190, 255, 0.25)";
		g.fillRect(x + 3, y - 4, 8, 5);
		g.fillStyle = "#eaf6ff";
		g.fillRect(x + 5, y - 2, 3, 2);
		g.globalAlpha = 1;
	});
};

export const gogoTv = makeTv<GogoData>({
	screen: SCREEN,
	frame,
	noCaption: ["card"],
	scenes: { card, op, hama, tatsumaki, riku, cm, hanabi, ed },
});
