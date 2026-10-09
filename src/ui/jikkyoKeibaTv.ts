// 保守記念（G1）の TV（ui/jikkyoWatch.ts の 板の 上の キャンバス）。カジノ「ガチャ」の 壁の 大画面（bigFrame）。
// 形は ui/jikkyoTvKit.ts（480x270 の 2倍の 下地に 240x135 の 座標）。場面は data/jikkyo/keiba.ts の KEIBA_SCENES。
// - 馬は 塗りの ドット絵（右向き 22x20。毛の 色・単色の 勝負服・白い ゼッケンに 馬番）。騎手は 名前を 出さない。
// - 場面：札（まもなく・おわり）・本馬場入場（1頭ずつ 名前と 脚質の 札）・ファンファーレ（旗を ふる 係）と ゲートイン
//   （正面の ゲートに 1頭ずつ）・スタート（横から。出遅れた 馬は ゲートに のこる）・道中（ハイペースは 縦長、スローは 団子。
//   1000m 通過の 時計）・4コーナー（差し馬の 前に 壁が できるか 外へ 出せるか）・最後の 直線（山場：逃げ馬と 差し馬の
//   差が data/jikkyo/keiba.ts の keibaGap で 縮む。ゴール板が 右から 来る）・ゴール（板の 前を 2頭が ならんで ぬける）・
//   写真判定（スリット写真と 掲示板の「写真」の ランプ。合図ごとに 光り、ちょうどで「確定」）・確定（掲示板）・表彰式（レイ）。
// - 凝った 絵は 直線と 写真判定の 2つ。ほかは 同じ 部品（走路・馬）の くみあわせ。
// - 進みは 名目の 時計（c.t・c.lt）、点滅だけ 実際の 時計（c.now）。動きを へらす 設定（still）では 脚・旗・紙ふぶき・光を 止める。

import {
	KEIBA_ART,
	KEIBA_AT,
	KEIBA_EXACT,
	KEIBA_HORSES,
	KEIBA_LINE,
	type KeibaData,
	type KeibaRace,
	keibaGap,
	keibaOrder,
} from "../data/jikkyo/keiba";
import {
	bands,
	bigFrame,
	clamp01,
	type G,
	hash,
	makeTv,
	num,
	numW,
	person,
	pulseGlow,
	type SceneFn,
	type TvCtx,
	text,
} from "./jikkyoTvKit";

type C = TvCtx<KeibaData>;

const W = bigFrame.screen.w;
const H = bigFrame.screen.h;

/** data が 無い とき（試験・終わった あと）の 筋。 */
const R0: KeibaRace = {
	lead: 2,
	closer: 4,
	late: -1,
	fast: true,
	tsumari: false,
	sashi: true,
	fake: false,
	third: 6,
};
const raceOf = (c: C): KeibaRace => c.data.race ?? R0;

/** 馬番の 字の 色（勝負服の 上）。 */
const SILK_INK = [
	"#1a1a1a",
	"#ffffff",
	"#ffffff",
	"#ffffff",
	"#1a1a1a",
	"#ffffff",
	"#1a1a1a",
	"#1a1a1a",
];

// ───────────────── 馬 ─────────────────

type Rect = readonly [number, number, number, number];
/** 脚（0：のびた、1：あつめた）。 */
const LEGS: readonly (readonly Rect[])[] = [
	[
		[3, 14, 1, 2],
		[2, 16, 1, 3],
		[5, 14, 1, 5],
		[14, 14, 1, 5],
		[16, 14, 1, 2],
		[17, 16, 1, 2],
		[18, 17, 1, 1],
	],
	[
		[6, 14, 1, 5],
		[8, 14, 1, 4],
		[11, 14, 1, 4],
		[13, 14, 1, 5],
	],
];
const COAT: readonly Rect[] = [
	[0, 9, 3, 1],
	[0, 10, 2, 3],
	[3, 9, 13, 5],
	[14, 6, 3, 5],
	[16, 5, 4, 3],
	[19, 7, 3, 2],
	[16, 4, 1, 1],
];

/** 右向きの 馬（22x20 × k。x・y は 左上）。i は 馬番 − 1、leg は 脚の 形。 */
const horse = (
	g: G,
	x: number,
	y: number,
	i: number,
	k: number,
	leg: number,
): void => {
	const h = KEIBA_HORSES[i] ?? KEIBA_HORSES[0];
	const r = ([a, b, w, hh]: Rect, col: string) => {
		g.fillStyle = col;
		g.fillRect(Math.round(x) + a * k, Math.round(y) + b * k, w * k, hh * k);
	};
	for (const p of COAT) r(p, h.coat);
	for (const p of LEGS[leg % 2]) r(p, h.coat);
	r([18, 6, 1, 1], "#140c08");
	// ゼッケン（白に 馬番）
	r([4, 9, 5, 5], "#f4f4f0");
	num(
		g,
		String(i + 1),
		Math.round(x) + 5 * k,
		Math.round(y) + 9 * k,
		k,
		"#1a1a1a",
	);
	// 鞍上（前に かがむ。勝負服は 単色）
	r([9, 3, 6, 3], h.silk);
	r([14, 1, 3, 2], h.silk);
	r([14, 5, 3, 1], h.silk);
	r([10, 6, 3, 3], "#d4d4cc");
};

/** 正面の 馬の 頭（10x13。ゲートの 中）。 */
const headFront = (g: G, x: number, y: number, i: number): void => {
	const h = KEIBA_HORSES[i] ?? KEIBA_HORSES[0];
	g.fillStyle = h.silk;
	g.fillRect(x + 2, y, 6, 3);
	g.fillStyle = h.coat;
	g.fillRect(x + 1, y + 2, 1, 2);
	g.fillRect(x + 8, y + 2, 1, 2);
	g.fillRect(x + 2, y + 3, 6, 10);
	g.fillStyle = "#f0ece0";
	g.fillRect(x + 4, y + 4, 2, 6);
	g.fillStyle = "#1a100a";
	g.fillRect(x + 3, y + 11, 4, 2);
};

/** 脚の 形（名目の 時計。still は 止める）。 */
const legOf = (c: C, ms: number, off = 0): number =>
	c.still ? 0 : Math.floor((c.t + off) / ms) % 2;

/** 差し馬の 上の 小さな 印。 */
const mark = (g: G, x: number, y: number): void => {
	g.fillStyle = "#ffffff";
	g.fillRect(x - 2, y, 5, 1);
	g.fillRect(x - 1, y + 1, 3, 1);
	g.fillRect(x, y + 2, 1, 1);
};

// ───────────────── 走路（横から） ─────────────────

const CROWD = [
	"#e06060",
	"#6080e0",
	"#f0d060",
	"#ffffff",
	"#60b070",
	"#d080c0",
];

/** 空・スタンド・外ラチ・芝・内ラチ。scroll は 名目の 進み（px）。 */
const track = (g: G, c: C, scroll: number): void => {
	const sc = c.still ? 0 : scroll;
	bands(g, W, ["#62a8e4", "#84bcec", "#a6d0f2"], 0, 14);
	const s = Math.floor(sc * 0.3);
	g.fillStyle = "#4a5262";
	g.fillRect(0, 10, W, 3);
	g.fillStyle = "#bab6ae";
	g.fillRect(0, 13, W, 18);
	for (let row = 0; row < 4; row++)
		for (let x = -(s % 3); x < W; x += 3) {
			const k = Math.floor((x + s) / 3);
			g.fillStyle = CROWD[Math.floor(hash(k, row, 3) * CROWD.length)];
			g.fillRect(x, 15 + row * 4, 2, 2);
		}
	g.fillStyle = "#8a8680";
	for (let x = -(s % 40); x < W; x += 40) g.fillRect(x, 13, 2, 18);
	g.fillStyle = "#3c9444";
	g.fillRect(0, 31, W, H - 31);
	g.fillStyle = "#46a24e";
	const f = Math.floor(sc) % 32;
	for (let x = -f; x < W; x += 32) g.fillRect(x, 33, 16, H - 33);
	// 外ラチ（奥）と 内ラチ（手前）
	g.fillStyle = "#f2f2f2";
	g.fillRect(0, 31, W, 2);
	g.fillRect(0, H - 6, W, 2);
	const p = Math.floor(sc * 1.4) % 12;
	for (let x = -p; x < W; x += 12) g.fillRect(x, H - 6, 1, 6);
};

/** 走路の 札（数字の 柱。残りの 距離や コーナーの 番）。 */
const pole = (g: G, x: number, s: string): void => {
	if (x < -20 || x > W + 20) return;
	g.fillStyle = "#f2f2f2";
	g.fillRect(x, 34, 2, 30);
	g.fillStyle = "#d83030";
	const w = numW(s, 1) + 6;
	g.fillRect(x - w / 2 + 1, 26, w, 9);
	num(g, s, x - w / 2 + 4, 28, 1, "#ffffff");
};

/** 道中・4コーナーの 並び（逃げ馬・中の 馬・差し馬・出遅れた 馬）。 */
const orderOf = (r: KeibaRace): number[] => {
	const rest = [0, 1, 2, 3, 4, 5, 6, 7]
		.filter((i) => i !== r.lead && i !== r.closer && i !== r.late)
		.sort((a, b) => hash(a, 17) - hash(b, 17));
	return [
		r.lead,
		...rest,
		r.closer,
		...(r.late >= 0 && r.late !== r.closer ? [r.late] : []),
	];
};

/** 横から 見た 隊列（spacing は 馬の 間、pull は 差し馬が 前へ 出る 量、out は 差し馬の 外への ふり）。 */
const field = (
	g: G,
	c: C,
	r: KeibaRace,
	spacing: number,
	o: { pull?: number; out?: number; wall?: boolean } = {},
): void => {
	const order = orderOf(r);
	const ci = order.indexOf(r.closer);
	const at = order.map((i, rank) => {
		const late = i === r.late ? 14 : 0;
		const wob = c.still ? 0 : Math.sin(c.t / 700 + i * 1.3) * 1.5;
		let x = 150 - rank * spacing - late + wob;
		let y = 38 + (rank % 3) * 9;
		if (i === r.closer) {
			x += o.pull ?? 0;
			y = o.wall ? 47 : 47 + (o.out ?? 0);
		}
		return { i, x, y };
	});
	// 壁：差し馬の すぐ 前と すぐ 外に 1頭ずつ（差し馬は 脚が 鈍る）
	if (o.wall && ci > 1) {
		const front = at[ci - 1];
		front.x = at[ci].x + 17;
		front.y = 47;
		const side = at[ci - 2];
		side.x = at[ci].x + 4;
		side.y = 56;
	}
	for (const h of [...at].sort((a, b) => a.y - b.y))
		horse(
			g,
			h.x,
			h.y,
			h.i,
			1,
			legOf(c, o.wall && h.i === r.closer ? 220 : 90, h.i * 37),
		);
	const cl = at[ci];
	mark(g, Math.round(cl.x) + 13, Math.round(cl.y) - 5);
};

// ───────────────── 場面 ─────────────────

const card: SceneFn<KeibaData> = (g, c) => {
	bands(g, W, ["#0a2414", "#103220", "#16402a"], 0, H);
	text(g, KEIBA_ART.title, W / 2, 20, 12, "#ffe7a0", { outline: "#06140a" });
	text(g, KEIBA_ART.course, W / 2, 38, 8, "#cfe8d0");
	const end = c.data.phase === "end";
	const blink = !end && !c.still && Math.floor(c.now / 700) % 2 === 1;
	if (!blink) text(g, c.data.card ?? KEIBA_ART.soon, W / 2, 56, 8, "#ffffff");
	// 下を 走る 馬（おわりと 動きを へらす 設定では 止まる）
	const still = end || c.still;
	g.fillStyle = "#2a6a36";
	g.fillRect(0, 98, W, 8);
	for (let i = 0; i < 4; i++) {
		const i8 = (i * 3) % 8;
		const x = still ? 20 + i * 48 : ((c.lt * 0.04 + i * 62) % (W + 44)) - 44;
		horse(g, x, 78, i8, 1, still ? 0 : legOf(c, 90, i * 40));
	}
};

const styleOf = (r: KeibaRace, i: number): string =>
	i === r.lead
		? KEIBA_ART.style.nige
		: i === r.closer
			? KEIBA_ART.style.sashi
			: hash(i, 3) < 0.5
				? KEIBA_ART.style.senko
				: KEIBA_ART.style.oikomi;

/** 本馬場入場：1頭 1.5秒ずつ、名前と 脚質の 札。 */
const honba: SceneFn<KeibaData> = (g, c) => {
	const r = raceOf(c);
	track(g, c, c.t * 0.03);
	const i = Math.min(7, Math.floor(c.lt / 1500));
	const p = clamp01((c.lt - i * 1500) / 1500);
	horse(g, Math.round(-44 + p * (W + 44)), 46, i, 2, legOf(c, 160));
	const h = KEIBA_HORSES[i];
	g.fillStyle = "rgba(0, 0, 0, 0.62)";
	g.fillRect(4, 4, 124, 14);
	g.fillStyle = h.silk;
	g.fillRect(6, 6, 10, 10);
	num(g, String(i + 1), 9, 8, 1, SILK_INK[i]);
	text(g, h.name, 20, 7, 8, "#ffffff", { align: "left" });
	text(g, styleOf(r, i), 125, 7, 8, "#ffe060", { align: "right" });
};

const ORDER_IN = [0, 2, 4, 6, 1, 3, 5, 7];

/** 正面の ゲート（in は 入った 馬の 数）。 */
const gateFront = (g: G, x0: number, y0: number, inN: number): void => {
	g.fillStyle = "#2a8a4a";
	g.fillRect(x0 - 2, y0, 8 * 24 + 4, 7);
	for (let k = 0; k < 8; k++) {
		const x = x0 + k * 24;
		num(g, String(k + 1), x + 10, y0 + 1, 1, "#ffffff");
		g.fillStyle = "#1e6a38";
		g.fillRect(x, y0 + 7, 2, 52);
		const loaded = ORDER_IN.indexOf(k) < inN;
		if (loaded) headFront(g, x + 7, y0 + 16, k);
		g.fillStyle = "#9aa0a8";
		g.fillRect(x + 3, y0 + 30, 19, 29);
		g.fillStyle = "#5a6068";
		g.fillRect(x + 6, y0 + 34, 13, 6);
	}
	g.fillStyle = "#1e6a38";
	g.fillRect(x0 + 8 * 24, y0 + 7, 2, 52);
};

/** ファンファーレ（係が 旗を ふる）と ゲートイン（1頭ずつ）。 */
const gate: SceneFn<KeibaData> = (g, c) => {
	track(g, c, 0);
	if (c.data.phase === "in") {
		const inN = c.still ? 8 : Math.min(8, Math.floor(c.lt / 450) + 1);
		gateFront(g, 8, 26, inN);
		return;
	}
	// 奥の ゲート（からっぽ）と 手前の 台
	g.fillStyle = "#2a8a4a";
	g.fillRect(100, 34, 100, 4);
	for (let x = 100; x <= 200; x += 12) g.fillRect(x, 38, 2, 22);
	g.fillStyle = "#c8ccd0";
	for (let x = 102; x < 200; x += 12) g.fillRect(x + 1, 48, 9, 12);
	g.fillStyle = "#d84040";
	g.fillRect(24, 62, 32, 6);
	g.fillStyle = "#ffffff";
	for (let x = 24; x < 56; x += 8) g.fillRect(x, 62, 4, 6);
	g.fillStyle = "#8a8a90";
	g.fillRect(28, 68, 2, 26);
	g.fillRect(50, 68, 2, 26);
	person(g, 37, 50, "#2a3a6a", "#1a1414");
	// 旗（拍ごとに 上げ下げ）
	const up = c.still || Math.floor(c.lt / 600) % 2 === 0;
	g.fillStyle = "#f2f2f2";
	g.fillRect(43, up ? 38 : 50, 1, 12);
	g.fillStyle = "#e02030";
	g.fillRect(44, up ? 38 : 50, 9, 6);
	// 音符
	if (!c.still)
		for (let i = 0; i < 3; i++) {
			const p = (((c.lt / 1600 + i / 3) % 1) + 1) % 1;
			const nx = 62 + i * 10;
			const ny = Math.round(54 - p * 30);
			g.fillStyle = `rgba(255, 255, 255, ${(1 - p).toFixed(2)})`;
			g.fillRect(nx, ny, 2, 2);
			g.fillRect(nx + 1, ny - 5, 1, 5);
		}
};

/** スタート：横から。出遅れた 馬は 0.9秒 ゲートに のこる。 */
const start: SceneFn<KeibaData> = (g, c) => {
	const r = raceOf(c);
	const v = 0.05;
	const cam = Math.max(0, c.lt - 1200) * v;
	track(g, c, cam);
	// 枠は ななめに 並ぶ（奥が 1番）。奥の 枠から 順に：上の 梁・馬・前の 柱と 開いた 扉
	KEIBA_HORSES.forEach((_, i) => {
		const sx = Math.round(18 + i * 5 - cam);
		const sy = 30 + i * 7;
		const delay = (i === r.late ? 900 : 0) + hash(i, 5) * 120;
		const run = Math.max(0, c.lt - delay);
		const bias = i === r.lead ? 0.006 : i === r.closer ? -0.004 : 0;
		g.fillStyle = "#2a8a4a";
		g.fillRect(sx - 2, sy + 1, 28, 2);
		horse(
			g,
			sx + run * (v + bias),
			sy,
			i,
			1,
			run > 0 ? legOf(c, 90, i * 31) : 0,
		);
		g.fillStyle = "#8a9098";
		g.fillRect(sx + 24, sy + 3, 2, 17);
		g.fillStyle = "#c8ccd0";
		g.fillRect(sx + 26, sy + 6, 1, 11);
	});
};

/** 道中（ハイペースは 縦長、スローは 団子。pace の 区切りで 1000m 通過の 時計）。 */
const dochu: SceneFn<KeibaData> = (g, c) => {
	const r = raceOf(c);
	track(g, c, c.t * 0.05);
	pole(g, Math.round(W + 20 - ((c.t * 0.05) % 360)), "1000");
	field(g, c, r, r.fast ? 17 : 9);
	if (c.data.phase !== "pace" || c.lt < 500) return;
	g.fillStyle = "rgba(0, 0, 0, 0.7)";
	g.fillRect(W - 62, 4, 58, 24);
	text(g, KEIBA_ART.split, W - 33, 5, 8, "#cfe0ff");
	text(g, r.fast ? "58.4" : "62.1", W - 33, 15, 10, "#ffe060");
};

/** 4コーナー：隊列が つまる。差し馬は 壁（詰まり）か 外へ。 */
const corner: SceneFn<KeibaData> = (g, c) => {
	const r = raceOf(c);
	track(g, c, c.t * 0.05);
	pole(g, Math.round(W + 10 - c.lt * 0.03), "4");
	const p = clamp01(c.lt / 2500);
	const spacing =
		(r.fast ? 17 : 9) + ((r.fast ? 9 : 8) - (r.fast ? 17 : 9)) * p;
	if (r.tsumari) field(g, c, r, spacing, { wall: p >= 0.4 });
	else field(g, c, r, spacing, { out: Math.round(19 * p), pull: 24 * p });
};

/** 逃げ馬の 鼻の 位置（直線）。 */
const LX = 112;
const LEN = 14;

/** 最後の 直線（山場）：逃げ馬（内）と 差し馬（外）の 差、ほかの 馬は 下がる。ゴール板が 右から。 */
const chokusen: SceneFn<KeibaData> = (g, c) => {
	const r = raceOf(c);
	const lt = c.lt;
	track(g, c, c.t * 0.09);
	pole(g, Math.round(W + 20 - (lt - 6000) * 0.06), "200");
	pole(g, Math.round(W + 20 - (lt - 10000) * 0.06), "100");
	const all = orderOf(r).filter((i) => i !== r.lead && i !== r.closer);
	// 詰まり：差し馬の すぐ 前の 馬（2.5秒 目から 内へ よれて 下がり、前が 開く）
	const blocker = r.tsumari
		? (all.filter((i) => i !== r.late).at(-1) ?? -1)
		: -1;
	all
		.filter((i) => i !== blocker)
		.forEach((i, j) => {
			const x = LX - 40 - j * 15 - lt * 0.004;
			if (x > -24) horse(g, x, 32 + (j % 2) * 4, i, 1, legOf(c, 80, i * 29));
		});
	const gap = keibaGap(r, lt);
	const cx = LX - gap * LEN;
	horse(g, LX, 38, r.lead, 2, legOf(c, 75));
	const q = clamp01((lt - 2500) / 3500);
	const bx = cx + 24 - q * 60 - Math.max(0, lt - 6000) * 0.02;
	const front = blocker >= 0 && q < 0.25;
	const drawBlocker = () => {
		if (blocker >= 0 && bx > -44)
			horse(g, bx, 58 - q * 16, blocker, 2, legOf(c, 80, 11));
	};
	if (!front) drawBlocker();
	horse(g, cx, 58, r.closer, 2, legOf(c, r.sashi ? 62 : 75, 40));
	if (front) drawBlocker();
	if (lt < KEIBA_LINE) mark(g, Math.round(cx) + 26, 53);
	goalPost(g, Math.round(LX + 44 + (KEIBA_LINE - lt) * 0.06));
};

/** ゴール板（白い 柱に 赤い 丸の 板）。 */
const goalPost = (g: G, x: number): void => {
	if (x > W + 10) return;
	g.fillStyle = "#f2f2f2";
	g.fillRect(x, 20, 2, 76);
	g.fillStyle = "#ffffff";
	g.fillRect(x - 5, 12, 12, 10);
	g.fillStyle = "#d83030";
	g.fillRect(x - 3, 14, 8, 6);
};

/** ゴール：板の 前を ならんで ぬける（白く 光る）。 */
const goal: SceneFn<KeibaData> = (g, c) => {
	const r = raceOf(c);
	track(g, c, 0);
	const post = 150;
	goalPost(g, post);
	const lx = post - 44 - (800 - c.lt) * 0.06;
	const gap = keibaGap(r, KEIBA_AT.goal - KEIBA_AT.chokusen + c.lt);
	const rest = orderOf(r).filter((i) => i !== r.lead && i !== r.closer);
	rest.forEach((i, j) => {
		horse(g, lx - 50 - j * 15, 32 + (j % 2) * 4, i, 1, legOf(c, 80, i * 29));
	});
	horse(g, lx, 38, r.lead, 2, legOf(c, 75));
	horse(g, lx - gap * LEN, 58, r.closer, 2, legOf(c, 70, 40));
	const a = c.still ? 0 : 1 - clamp01((c.lt - 800) / 500);
	if (c.lt >= 800 && a > 0) {
		g.fillStyle = `rgba(255, 255, 255, ${(0.7 * a).toFixed(3)})`;
		g.fillRect(0, 0, W, H);
	}
};

/** 掲示板の ランプ（写真・確定）。 */
const lamp = (
	g: G,
	x: number,
	y: number,
	s: string,
	on: boolean,
	ink: string,
): void => {
	g.fillStyle = on ? ink : "#3a3a40";
	g.fillRect(x, y, 22, 11);
	text(g, s, x + 11, y + 1, 8, on ? "#1a1010" : "#6a6a70");
};

/** 写真判定（山場の あと）：スリット写真で 2頭の 鼻が 線の 上。ランプは 合図ごとに 光り、ちょうどで 確定。 */
const photo: SceneFn<KeibaData> = (g, c) => {
	const r = raceOf(c);
	const exact = c.data.exact ?? KEIBA_EXACT;
	const done = c.t >= exact;
	g.fillStyle = "#d8d0bc";
	g.fillRect(0, 0, W, H);
	g.fillStyle = "#cbc2ac";
	for (let x = 0; x < W; x += 6) g.fillRect(x, 0, 2, H);
	// 写真の 中の 2頭（内が 上）。鼻の 差は 1〜2px（ハナ差）
	const line = 128;
	const p = clamp01((c.t - KEIBA_AT.photo) / 3000);
	const slide = c.still ? 0 : Math.round((1 - p) * -24);
	const nose = (i: number) => (keibaOrder(r)[0] === i ? 2 : -1);
	horse(g, line - 44 + nose(r.lead) + slide, 4, r.lead, 2, 0);
	horse(g, line - 44 + nose(r.closer) + slide, 48, r.closer, 2, 1);
	g.fillStyle = "rgba(196, 176, 136, 0.38)";
	g.fillRect(0, 0, W, H);
	g.fillStyle = "#ffffff";
	g.fillRect(line, 0, 1, H);
	g.fillStyle = "#c02020";
	g.fillRect(line + 1, 0, 1, H);
	// 掲示板（左上）
	g.fillStyle = "#14201a";
	g.fillRect(4, 4, 58, 44);
	const glow = pulseGlow(c, 300);
	const blink = c.still || glow > 0 || Math.floor(c.now / 500) % 2 === 0;
	lamp(g, 8, 8, KEIBA_ART.photo, !done && blink, "#ffb040");
	lamp(g, 36, 8, KEIBA_ART.kakutei, done, "#ff4a3a");
	const [a, b] = keibaOrder(r);
	for (const [k, i] of [a, b].entries()) {
		num(g, String(k + 1), 10, 24 + k * 11, 1, "#e0e0e0");
		if (done) num(g, String(i + 1), 26, 23 + k * 11, 2, "#ffb040");
		else text(g, "？", 30, 22 + k * 11, 8, "#6a6a70");
	}
	// 合図の 点（3つ）
	if (c.data.phase === "cue" && !done)
		for (let k = 0; k < 3; k++) {
			g.fillStyle = k < c.pulses.length ? "#ffe060" : "#3a4a3a";
			g.fillRect(14 + k * 12, 52, 6, 6);
		}
};

/** 確定（大きな 掲示板）：1〜3着・着差・時計。 */
const kakutei: SceneFn<KeibaData> = (g, c) => {
	const r = raceOf(c);
	bands(g, W, ["#0a1410", "#101c16"], 0, H);
	g.fillStyle = "#2a3a30";
	g.fillRect(24, 6, 160, 84);
	g.fillStyle = "#14201a";
	g.fillRect(27, 9, 154, 78);
	text(g, KEIBA_ART.title, 70, 12, 8, "#cfe0d0");
	lamp(g, 150, 12, KEIBA_ART.kakutei, true, "#ff4a3a");
	const margins = ["", KEIBA_ART.hana, "1/2"];
	keibaOrder(r).forEach((i, k) => {
		const y = 28 + k * 18;
		num(g, String(k + 1), 36, y + 2, 2, "#e0e0e0");
		g.fillStyle = KEIBA_HORSES[i].silk;
		g.fillRect(54, y, 14, 14);
		num(g, String(i + 1), 58, y + 2, 2, SILK_INK[i]);
		text(g, KEIBA_HORSES[i].name, 74, y + 3, 8, "#ffffff", { align: "left" });
		if (margins[k])
			text(g, margins[k], 174, y + 3, 8, "#ffb040", { align: "right" });
	});
	text(g, r.fast ? "1:58.7" : "2:01.3", 150, 76, 8, "#ffe060");
};

/** 表彰式：勝った 馬に レイ、トロフィー、紙ふぶき。 */
const hyosho: SceneFn<KeibaData> = (g, c) => {
	const r = raceOf(c);
	const [w] = keibaOrder(r);
	bands(g, W, ["#62a8e4", "#84bcec"], 0, 30);
	g.fillStyle = "#3c9444";
	g.fillRect(0, 30, W, H - 30);
	g.fillStyle = "#f4f2ea";
	g.fillRect(40, 4, 128, 24);
	text(g, KEIBA_ART.title, 104, 6, 8, "#1a3a22");
	text(g, `${KEIBA_ART.win}　${KEIBA_HORSES[w].name}`, 104, 16, 8, "#a02020");
	const hx = 52;
	const hy = 40;
	horse(g, hx, hy, w, 2, 0);
	// レイ（首に かける 花の 輪）
	for (let k = 0; k < 10; k++) {
		const a = (k / 10) * Math.PI * 2;
		g.fillStyle = k % 2 ? "#ffe060" : "#e03040";
		g.fillRect(
			Math.round(hx + 31 + Math.cos(a) * 5),
			Math.round(hy + 22 + Math.sin(a) * 7),
			2,
			2,
		);
	}
	// トロフィーと 台
	g.fillStyle = "#8a5a34";
	g.fillRect(150, 70, 30, 4);
	g.fillStyle = "#e8c040";
	g.fillRect(158, 54, 14, 10);
	g.fillRect(162, 64, 6, 4);
	g.fillRect(159, 68, 12, 2);
	g.fillRect(155, 56, 3, 5);
	g.fillRect(172, 56, 3, 5);
	for (let k = 0; k < 3; k++)
		person(
			g,
			120 + k * 10,
			74,
			["#2a2a3a", "#3a3a4a", "#e4e4dc"][k],
			"#1a1414",
		);
	if (c.still) return;
	for (let k = 0; k < 18; k++) {
		const fy = ((c.t * 0.02 + hash(k, 9) * H) % (H + 10)) - 10;
		const fx = Math.round(hash(k, 8) * W + Math.sin(c.t / 500 + k) * 3);
		g.fillStyle = CROWD[k % CROWD.length];
		g.fillRect(fx, Math.round(fy), 2, 1);
	}
};

export const keibaTv = makeTv<KeibaData>({
	screen: bigFrame.screen,
	frame: bigFrame.draw,
	noCaption: ["card", "chokusen", "goal"],
	scenes: {
		card,
		honba,
		gate,
		start,
		dochu,
		corner,
		chokusen,
		goal,
		photo,
		kakutei,
		hyosho,
	},
});
