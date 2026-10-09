// 保守ゲームス　新作発表会の TV（ui/jikkyoWatch.ts の 板の 上の キャンバス）。台本は data/jikkyo/shinsaku.ts。
// 形は ui/jikkyoTvKit.ts（480x270 の 2倍の 下地に 240x135 の 座標）。枠は ゲームセンターの 壁の 大画面（bigFrame）に
// 本番は 赤い「LIVE」、アーカイブの 日は 灰色の 札。
// - 場面：待機と おわりの 札・ロゴ・広報（あいさつ・お詫び・もう　1つ）・影（ティザー）・正体・蓄音機の 山場・まとめ。
// - 影（凝った 絵の 1つめ）：スポットライトの 中に 物の 影と 手がかり（NEW の 印・HD の 札・人の 形）。
//   窓が 閉じた とき（答えた とき・時間切れ）に 正体へ かわる（群衆の「は？」と 同じ 時）。
// - 山場（凝った 絵の 2つめ）：蓄音機の 影に 合図ごとの 光 → ちょうどで 白く 光って 蓄音機（sprites/phono.png）と
//   「蓄音キリコ」の ロゴ。釣りの ウキは sprites/tsuri.png。読めない 絵は 塗りで 描く。
// - 人は 塗りの 四角を 3倍で 描く。動きは 名目の 時計（c.lt・c.t）、点滅だけ 実際の 時計（c.now）。
//   動きを へらす 設定（still）では 点滅・ゆれ・紙ふぶき・光を 止める。

import {
	SHINSAKU_ART as A,
	type ShinsakuData,
	type ShinsakuKind,
	type ShinsakuObj,
} from "../data/jikkyo/shinsaku";
import {
	bands,
	bigFrame,
	blit,
	clamp01,
	type G,
	hash,
	makeTv,
	pulseGlow,
	type TvCtx,
	text,
	walker,
} from "./jikkyoTvKit";

type C = TvCtx<ShinsakuData>;
/** 塗りの 色（影の ときは どれも 黒）。 */
type Ink = (col: string) => string;
type Rect = [number, number, number, number];

const REAL: Ink = (col) => col;
const SIL = "#04040a";
const SHADOW: Ink = () => SIL;

const box = (g: G, col: string, ...r: Rect) => {
	g.fillStyle = col;
	g.fillRect(...r);
};
const at = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

/** 1px の 線（竿・釣り糸）。 */
const pxLine = (g: G, col: string, ...[x0, y0, x1, y1]: Rect) => {
	const n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0));
	g.fillStyle = col;
	for (let i = 0; i <= n; i++)
		g.fillRect(at(x0, x1, i / n), at(y0, y1, i / n), 1, 1);
};

/** 上からの スポットライトの 光の 筋。 */
const cone = (g: G, fill: string) => {
	g.fillStyle = fill;
	g.beginPath();
	g.moveTo(88, 0);
	g.lineTo(120, 0);
	g.lineTo(162, 90);
	g.lineTo(46, 90);
	g.closePath();
	g.fill();
};

// ───────────────── 物の 絵（影と 正体で 同じ 形） ─────────────────

/** 「字色 字色 …」→ 字の 絵の 色。 */
const inkOf = (s: string): Record<string, string> =>
	Object.fromEntries(s.split(" ").map((p) => [p[0], p.slice(1)]));
const silOf = (ink: Readonly<Record<string, string>>) =>
	Object.fromEntries(Object.keys(ink).map((k) => [k, SIL]));

/** 1打席の バットと 球（16x16）。 */
const BAT = [
	"................",
	".oo.........WW..",
	"orro.......WwwW.",
	"oooo......WwwwW.",
	".oo......WwwwW..",
	"........WwwwW...",
	".......WwwwW....",
	"......WwwW......",
	".....WwW........",
	"....WwW.........",
	"...ggW..........",
	"..ggg...........",
	".ggg............",
	"kgg.............",
	"kk..............",
	"................",
];
const BAT_INK = inkOf("W#a8763a w#e0b070 g#3a3a48 k#2a2a30 o#f4f4f0 r#d83a3a");

/** 蓄音機（sprites/phono.png と 同じ 形。影と 読めない ときの 絵）。 */
const PHONO = [
	"..aaaa..........",
	".abcccaa........",
	"abcccccca.......",
	"acccdcccca......",
	"accdadcccca.....",
	".acdaadccca.....",
	"..aaa.adcca.....",
	"......aadca.....",
	".......ada......",
	"..aaaaaaeaaaa...",
	".afgfgfhfgfgfa..",
	".aaaaaaaaaaaaa..",
	".aiiiiiiiiiiia..",
	".aijiiiiiiijia..",
	".aiiiiiiiiiiia..",
	".aaaaaaaaaaaaa..",
];
const PHONO_INK = inkOf(
	"a#2b1a0e b#fff0b0 c#f2c14e d#b98322 e#c8c8c8 f#1a1a1a g#4a4a4a h#d8352a i#9a5b2c j#6a3a18",
);

/** 碁盤の 石（目の 横・縦・b 黒／w 白）。 */
const STONES = "21b32w51b63w43b13w71w";

/** 碁盤（足つき。54x45）。 */
const drawBoard = (g: G, ink: Ink, x: number, y: number) => {
	box(g, ink("#6a4020"), x + 6, y + 36, 6, 9);
	box(g, ink("#6a4020"), x + 42, y + 36, 6, 9);
	box(g, ink("#b07a3a"), x, y + 27, 54, 9);
	box(g, ink("#e6b868"), x, y, 54, 27);
	if (ink !== REAL) return;
	box(g, "#f2d898", x, y, 54, 1);
	g.fillStyle = "#7a5428";
	for (let i = 0; i < 9; i++) g.fillRect(x + 3 + i * 6, y + 2, 1, 24);
	for (let j = 0; j < 5; j++) g.fillRect(x + 3, y + 2 + j * 6, 49, 1);
	for (let s = 0; s < STONES.length; s += 3) {
		const sx = x + 3 + Number(STONES[s]) * 6;
		const sy = y + 2 + Number(STONES[s + 1]) * 6;
		g.fillStyle = STONES[s + 2] === "b" ? "#1a1a1a" : "#f4f4f0";
		g.fillRect(sx - 2, sy - 1, 5, 3);
		g.fillRect(sx - 1, sy - 2, 3, 5);
	}
};

/** 釣り人（新キャラ。27x54 の 体の 部品：色・横・縦・幅・高さ。単位は 3px）。 */
const ANGLER: readonly (readonly [string, ...Rect])[] = [
	["#2a6a8a", 2, 0, 4, 2],
	["#1e5068", 1, 2, 6, 1],
	["#f2c8a0", 2, 3, 4, 3],
	["#e08a3a", 1, 6, 6, 6],
	["#e08a3a", 0, 6, 1, 5],
	["#f2c8a0", 0, 11, 1, 1],
	["#e08a3a", 7, 6, 1, 3],
	["#e08a3a", 8, 5, 1, 2],
	["#f2c8a0", 8, 4, 1, 1],
	["#3a4a6a", 2, 12, 4, 5],
	["#2a2a30", 1, 17, 3, 1],
	["#2a2a30", 4, 17, 3, 1],
];
const ANGLER_FACE: readonly (readonly [string, ...Rect])[] = [
	["#2a2a36", 3, 4, 1, 1],
	["#2a2a36", 5, 4, 1, 1],
	["#b86a2a", 2, 8, 1, 1],
	["#b86a2a", 5, 8, 1, 1],
];

/** 釣り人と 竿（竿の 先を 返す）。 */
const drawAngler = (g: G, ink: Ink, x: number, y: number) => {
	const parts = ink === REAL ? [...ANGLER, ...ANGLER_FACE] : ANGLER;
	for (const [col, ux, uy, w, h] of parts)
		box(g, ink(col), x + ux * 3, y + uy * 3, w * 3, h * 3);
	const hx = x + 25;
	const hy = y + 13;
	pxLine(g, ink("#6a4020"), hx, hy, hx + 40, hy - 26);
	return { tx: hx + 40, ty: hy - 26 };
};

/** 物を 1つ（影なら 黒く）。 */
const drawObj = (
	g: G,
	obj: ShinsakuObj,
	sil: boolean,
	x: number,
	y: number,
) => {
	if (obj === "bat") blit(g, BAT, x, y, sil ? silOf(BAT_INK) : BAT_INK, 4);
	else if (obj === "board") drawBoard(g, sil ? SHADOW : REAL, x, y);
	else drawAngler(g, sil ? SHADOW : REAL, x, y);
};

/** 影の 置き場と 手がかりの 位置（物ごと：影の 横・縦・印の 横・縦）。 */
const AT: Readonly<Record<ShinsakuObj, Rect>> = {
	bat: [72, 14, 152, 24],
	board: [77, 32, 146, 26],
	angler: [88, 16, 146, 26],
};

// ───────────────── 手がかり ─────────────────

/** NEW の 印（黄色い 星。ゆれは 実際の 時計）。 */
const newMark = (g: G, c: C, x: number, y: number, r = 13) => {
	const s = c.still ? 1 : 1 + 0.08 * Math.sin(c.now / 150);
	g.fillStyle = "#ffd23a";
	g.beginPath();
	for (let i = 0; i < 16; i++) {
		const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
		const rr = (i % 2 ? r * 0.68 : r) * s;
		g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
	}
	g.closePath();
	g.fill();
	text(g, A.newMark, x, y - 4, 8, "#7a2a00");
};

/** HD の 札（銀の 板。照りが 走る）。 */
const hdTag = (g: G, c: C, x: number, y: number) => {
	box(g, "#8a90a0", x, y, 24, 13);
	box(g, "#d8dce8", x + 1, y + 1, 22, 11);
	text(g, A.hdMark, x + 12, y + 2, 8, "#1a1a2a");
	const gx = Math.floor(c.now / 40) % 60;
	if (!c.still && gx < 22)
		box(g, "rgba(255, 255, 255, 0.7)", x + 1 + gx, y + 1, 2, 11);
};

// ───────────────── 舞台・ロゴ ─────────────────

/** 暗い 舞台と 上からの スポットライト（強さ 0〜1）。 */
const spot = (g: G, c: C, a = 1) => {
	bands(g, c.W, ["#08080e", "#0c0c16", "#10101e", "#141426"], 0, c.H);
	cone(g, `rgba(255, 240, 200, ${(0.12 * a).toFixed(3)})`);
	g.fillStyle = `rgba(80, 72, 110, ${(0.6 * a).toFixed(3)})`;
	g.beginPath();
	g.ellipse(104, 86, 58, 6, 0, 0, Math.PI * 2);
	g.fill();
};

/** 小さな ゲームパッドの 絵（13x7 × k）。 */
const pad = (g: G, x: number, y: number, k: number) => {
	box(g, "#e8e8f0", x + k, y, 11 * k, 7 * k);
	box(g, "#e8e8f0", x, y + k, 13 * k, 5 * k);
	box(g, "#2a2a40", x + 2 * k, y + 3 * k, 3 * k, k);
	box(g, "#2a2a40", x + 3 * k, y + 2 * k, k, 3 * k);
	box(g, "#d8352a", x + 9 * k, y + 2 * k, k, k);
	box(g, "#2a8a4a", x + 10 * k, y + 4 * k, k, k);
};

/** 会社の ロゴ（パッドと 名前、下に 番組名）。 */
const logo = (g: G, cx: number, y: number) => {
	pad(g, cx - 58, y, 2);
	text(g, A.logo, cx + 8, y, 12, "#ffe080", { outline: "#2a1a08" });
	text(g, A.show, cx + 8, y + 17, 8, "#e8e8f0");
};

const drawCard = (g: G, c: C) => {
	box(g, "#08080e", 0, 0, c.W, c.H);
	const end = c.data.phase === "end";
	g.globalAlpha = end ? 0.5 : 1;
	logo(g, c.W / 2, 24);
	g.globalAlpha = 1;
	text(g, c.data.card ?? A.soon, c.W / 2, 60, 8, end ? "#9a9ab0" : "#ffffff");
	if (end) return;
	const n = c.still ? 3 : Math.floor(c.lt / 400) % 4;
	for (let i = 0; i < 3; i++)
		box(g, i < n ? "#ffd25a" : "#2a2a40", c.W / 2 - 10 + i * 8, 76, 4, 4);
};

const NEON = ["#ff5aa0", "#5ad0ff", "#ffd25a"];

const drawOp = (g: G, c: C) => {
	box(g, "#120a1e", 0, 0, c.W, c.H);
	// ネオンの 帯（左右に 流れる）
	g.globalAlpha = 0.35;
	for (let i = 0; i < 7; i++) {
		const off = c.still ? 0 : ((c.lt * 0.05 * (i % 2 ? 1 : -1)) % 40) + 40;
		g.fillStyle = NEON[i % 3];
		for (let x = -40 + (off % 40); x < c.W; x += 40)
			g.fillRect(Math.round(x), 6 + i * 13, 24, 2);
	}
	g.globalAlpha = 1;
	// 点が 集まって ロゴ（still は はじめから ロゴ）
	const p = c.still ? 1 : clamp01((c.lt - 300) / 1500);
	if (p >= 1) {
		logo(g, c.W / 2, 32);
		return;
	}
	for (let i = 0; i < 24; i++) {
		const x = at(hash(i, 1) * c.W, 56 + (i % 12) * 8, p);
		const y = at(hash(i, 2) * c.H, 36 + Math.floor(i / 12) * 8, p);
		box(g, NEON[i % 3], x, y, 4, 4);
	}
};

// ───────────────── 広報（あいさつ・お詫び・もう　1つ） ─────────────────

type Pose = "stand" | "wave" | "bow" | "point";

/** 広報の 人（3倍の 四角。pose：立つ・手を 振る・頭を 下げる・指を 立てる）。 */
const presenter = (g: G, x: number, y: number, pose: Pose) => {
	const u = (col: string, ux: number, uy: number, w: number, h: number) =>
		box(g, col, x + ux * 3, y + uy * 3, w * 3, h * 3);
	const SUIT = "#3c4a78";
	const SKIN = "#f2c8a0";
	if (pose === "bow") {
		u("#2a2020", 1, 3, 4, 3);
		u(SUIT, 0, 6, 6, 5);
		u(SUIT, 0, 8, 1, 3);
		u(SUIT, 5, 8, 1, 3);
		return;
	}
	u("#2a2020", 1, 0, 4, 2);
	u(SKIN, 1, 2, 4, 3);
	u("#2a2a36", 2, 3, 1, 1);
	u("#2a2a36", 4, 3, 1, 1);
	u(SUIT, 0, 5, 6, 6);
	u("#f0f0f0", 2, 5, 2, 1);
	u("#d8352a", 2, 6, 1, 3);
	u(SUIT, -1, 5, 1, 4);
	u(SKIN, -1, 9, 1, 1);
	if (pose === "stand") {
		u(SUIT, 6, 5, 1, 4);
		u(SKIN, 6, 9, 1, 1);
		return;
	}
	u(SUIT, 6, 2, 1, 4);
	u(SKIN, 6, 1, 1, 1);
	if (pose === "point") u(SKIN, 6, 0, 1, 1);
};

const drawHost = (g: G, c: C) => {
	box(g, "#0c0c18", 0, 0, c.W, c.H);
	// 壁の 電光板
	box(g, "#2a2a50", 22, 4, 164, 54);
	box(g, "#141430", 24, 6, 160, 50);
	g.fillStyle = "#18183a";
	for (let y = 7; y < 56; y += 3) g.fillRect(24, y, 160, 1);
	const phase = c.data.phase;
	if (phase === "owabi") {
		text(g, A.owabi, c.W / 2, 7, 12, "#ffffff");
		text(g, A.delayed, c.W / 2, 22, 8, "#e8e8f0");
		text(g, A.delay, c.W / 2, 33, 10, "#ff7a6a");
	} else if (phase === "motto") {
		g.globalAlpha = c.still ? 1 : clamp01(c.lt / 500);
		text(g, A.motto, c.W / 2, 22, 12, "#ffe080", { outline: "#2a1a08" });
		g.globalAlpha = 1;
	} else logo(g, c.W / 2, 8);
	// 床
	box(g, "#2a2238", 0, 74, c.W, c.H - 74);
	box(g, "#4a3a5a", 0, 74, c.W, 1);
	// 人（あいさつは 手を 振る・お詫びは 頭を 下げる・もう　1つは 指を 立てる）
	let pose: Pose = "stand";
	if (phase === "owabi") pose = c.still || c.lt > 1200 ? "bow" : "stand";
	else if (phase === "motto") pose = "point";
	else if (!c.still && Math.floor(c.lt / 600) % 2) pose = "wave";
	presenter(g, 95, 36, pose);
	// 演台
	box(g, "#5a5a6a", 82, 64, 44, 3);
	box(g, "#3a3a4a", 84, 67, 40, 26);
	pad(g, 98, 74, 1);
};

// ───────────────── 影と 正体 ─────────────────

/** 影の 窓が 閉じたか（TV ごとに、閉じた 区切りの 頭を 覚える）。 */
const shownSeg = new WeakMap<object, number>();
const isShown = (c: C): boolean => {
	const start = c.seg?.start ?? -1;
	const w = c.v.win;
	if (w?.kind === "pick" && w.reveal) shownSeg.set(c.imgs, start);
	return shownSeg.get(c.imgs) === start;
};

const drawTeaser = (g: G, c: C) => {
	const s = c.data.show;
	if (!s || isShown(c)) {
		drawReveal(g, c);
		return;
	}
	spot(g, c);
	text(g, A.hatena, c.W / 2, 4, 8, "#6a6a88");
	const [x, y, mx, my] = AT[s.obj];
	drawObj(g, s.obj, true, x, y);
	if (s.kind === "new") newMark(g, c, mx, my);
	else if (s.kind === "hd") hdTag(g, c, mx - 12, my + 34);
};

const REVEAL_BG: Readonly<Record<ShinsakuKind, readonly string[]>> = {
	new: ["#3a1a2a", "#4a2032", "#5a2a3a", "#6a323e"],
	hd: ["#0a2a4a", "#0e3458", "#12406a", "#1a4c7a"],
	chara: ["#5ab0e8", "#74c0ec", "#92d0f2", "#b4e0f8"],
};

/** 釣りの 場面（海・桟橋・釣り人・糸と ウキ）。 */
const drawFishing = (g: G, c: C) => {
	box(g, "#2a78c0", 0, 74, c.W, c.H - 74);
	for (let i = 0; i < 5; i++) {
		const wx = Math.round((i * 47 + (c.still ? 0 : c.lt * 0.01)) % c.W);
		box(g, "#cfe8ff", wx, 80 + (i % 2) * 6, 6, 1);
	}
	box(g, "#8a5a34", 8, 74, 50, 4);
	const tip = drawAngler(g, REAL, 18, 20);
	const bob = c.still ? 0 : Math.round(Math.sin(c.lt / 400) * 1.5);
	pxLine(g, "#e8eef8", tip.tx, tip.ty, tip.tx, 70 + bob);
	const f = c.still ? 0 : Math.floor(c.lt / 500) % 2;
	walker(g, c.imgs.tsuri, 2, f, tip.tx - 8, 66 + bob, 1, "#e0463c");
};

const drawReveal = (g: G, c: C) => {
	const s = c.data.show;
	if (!s) return;
	bands(g, c.W, REVEAL_BG[s.kind], 0, c.H);
	g.globalAlpha = c.still ? 1 : clamp01(c.lt / 300 + 0.4);
	if (s.obj === "angler") drawFishing(g, c);
	else if (s.obj === "bat") drawObj(g, "bat", false, 14, 14);
	else drawObj(g, "board", false, 12, 30);
	g.globalAlpha = 1;
	// 題と しるし（新作は「発売日　未定」の 判、HD は 札と 照り、新キャラは 赤い 帯）
	text(g, A.title[s.obj], 150, 18, 12, "#ffffff", { outline: "#000000" });
	if (s.kind === "new") {
		newMark(g, c, 194, 13, 9);
		g.save();
		g.translate(150, 52);
		g.rotate(-0.18);
		box(g, "#f4ecd8", -29, -8, 58, 18);
		g.strokeStyle = "#e02030";
		g.lineWidth = 2;
		g.strokeRect(-29, -8, 58, 18);
		text(g, A.stamp, 0, -4, 8, "#d01828");
		g.restore();
	} else if (s.kind === "hd") {
		hdTag(g, c, 138, 38);
		text(g, A.sub.hd, 150, 56, 8, "#e8f4ff");
		if (c.still) return;
		// 照りが 物の 上を 走る
		const sx = Math.floor(c.lt * 0.08) % 160;
		g.fillStyle = "rgba(255, 255, 255, 0.18)";
		g.beginPath();
		g.moveTo(sx, 0);
		g.lineTo(sx + 10, 0);
		g.lineTo(sx - 20, 93);
		g.lineTo(sx - 30, 93);
		g.closePath();
		g.fill();
	} else {
		box(g, "#d8352a", 118, 38, 64, 12);
		text(g, A.sub.chara, 150, 40, 8, "#ffffff");
	}
};

// ───────────────── 山場：蓄音機の 影 → キリコの 新作 ─────────────────

const CONFETTI = ["#ffd23a", "#ff5aa0", "#5ad0ff", "#ffffff", "#7ae07a"];

/** 正体（ms は ちょうどからの 名目の 時）。 */
const drawKiriko = (g: G, c: C, ms: number) => {
	bands(g, c.W, ["#1a1008", "#24160c", "#2e1c10", "#382214"], 0, c.H);
	// 後光（still は 止める）
	const rot = c.still ? 0 : ms / 4000;
	g.fillStyle = "rgba(255, 210, 120, 0.12)";
	for (let i = 0; i < 12; i += 2) {
		const a0 = rot + (i / 12) * Math.PI * 2;
		const a1 = rot + ((i + 1) / 12) * Math.PI * 2;
		g.beginPath();
		g.moveTo(104, 36);
		g.lineTo(104 + Math.cos(a0) * 140, 36 + Math.sin(a0) * 140);
		g.lineTo(104 + Math.cos(a1) * 140, 36 + Math.sin(a1) * 140);
		g.closePath();
		g.fill();
	}
	if (c.imgs.phono) g.drawImage(c.imgs.phono, 0, 0, 16, 16, 72, 2, 64, 64);
	else blit(g, PHONO, 72, 2, PHONO_INK, 4);
	text(g, A.kiriko, c.W / 2, 66, 12, "#ffe080", { outline: "#2a1a08" });
	text(g, A.kirikoSub, c.W / 2, 81, 8, "#ffffff");
	if (c.still) return;
	// 紙ふぶき
	for (let i = 0; i < 28; i++) {
		const y = ((ms * 0.04 + hash(i, 2) * (c.H + 10)) % (c.H + 10)) - 10;
		const x = hash(i, 1) * c.W + Math.sin(ms / 300 + i) * 3;
		box(g, CONFETTI[i % 5], Math.round(x), Math.round(y), 2, 3);
	}
	// ちょうどの 白い 光
	const w = 1 - clamp01(ms / 1000);
	if (w > 0) box(g, `rgba(255, 255, 255, ${w.toFixed(3)})`, 0, 0, c.W, c.H);
};

const drawPhono = (g: G, c: C) => {
	const since = c.t - (c.data.exact ?? Number.POSITIVE_INFINITY);
	if (c.data.phase === "boom" || since >= 0) {
		drawKiriko(g, c, Math.max(0, since));
		return;
	}
	const pre = c.data.phase === "pre";
	const a = c.still || !pre ? 1 : clamp01(c.lt / 1500);
	spot(g, c, a);
	// 影（はじめは うすく、だんだん はっきり）
	g.globalAlpha = 0.3 + 0.7 * a;
	blit(g, PHONO, 72, 12, silOf(PHONO_INK), 4);
	g.globalAlpha = 1;
	// 合図ごとに スポットライトが 白く 光る
	const glow = pulseGlow(c);
	if (glow > 0) cone(g, `rgba(255, 250, 220, ${(0.4 * glow).toFixed(3)})`);
	if (pre) return;
	for (let i = 0; i < 3; i++)
		box(g, i < c.pulses.length ? "#ffe060" : "#3a3a5a", 90 + i * 12, 84, 6, 6);
};

// ───────────────── まとめ ─────────────────

const TAG_INK: Readonly<Record<ShinsakuKind, string>> = {
	new: "#ffd23a",
	hd: "#d8dce8",
	chara: "#ff8a9a",
};

const drawMatome = (g: G, c: C) => {
	box(g, "#0c0c18", 0, 0, c.W, c.H);
	box(g, "#16163a", 16, 2, 176, 88);
	const rows = [
		...(c.data.list ?? []).map((s) => ({
			tag: A.tag[s.kind],
			ink: TAG_INK[s.kind],
			line: A.title[s.obj],
			sub: A.sub[s.kind],
		})),
		{ tag: A.newMark, ink: "#ffd23a", line: A.kiriko, sub: A.kirikoSub },
	];
	rows.forEach((r, i) => {
		if (!c.still && c.lt < 500 + i * 700) return;
		const y = 17 + i * 18;
		box(g, r.ink, 22, y, 28, 11);
		text(g, r.tag, 36, y + 1, 8, "#1a1a2a");
		text(g, r.line, 56, y + 1, 8, "#ffffff", { align: "left" });
		text(g, r.sub, 186, y + 1, 8, "#c8c8e0", { align: "right" });
	});
};

// ───────────────── TV ─────────────────

export const shinsakuTv = makeTv<ShinsakuData>({
	images: { phono: "pub:sprites/phono.png", tsuri: "pub:sprites/tsuri.png" },
	screen: bigFrame.screen,
	frame: (g, c) => {
		bigFrame.draw(g, c);
		const { x, y } = bigFrame.screen;
		if (!c.live) {
			box(g, "#3a3a48", x + 3, y + 3, 44, 10);
			text(g, A.archive, x + 25, y + 4, 8, "#c8c8d8");
			return;
		}
		box(g, "#d8352a", x + 3, y + 3, 30, 10);
		text(g, A.live, x + 20, y + 4, 8, "#ffffff");
		if (c.still || Math.floor(c.now / 600) % 2)
			box(g, "#ffffff", x + 6, y + 7, 2, 2);
	},
	scenes: {
		card: drawCard,
		op: drawOp,
		host: drawHost,
		teaser: drawTeaser,
		reveal: drawReveal,
		phono: drawPhono,
		matome: drawMatome,
	},
	noCaption: ["card"],
});
