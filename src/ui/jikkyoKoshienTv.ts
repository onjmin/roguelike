// 夏の　保守園（高校野球）の TV（海の家「age」の 壁の テレビ。ui/jikkyoWatch.ts の 板の 上の キャンバス）。
// 形は ui/jikkyoTvKit.ts（480x270 の 2倍の 下地に 240x135 の 座標）。枠は 部屋の テレビ（crtFrame）。
// - 場面（data/jikkyo/koshien.ts の KOSHIEN_SCENES）：札（夏空と 入道雲・夕焼け）・整列と 礼（サイレン）・
//   センターカメラ（投手の 背中・打者・捕手・審判と 得点板）・アルプス（全校の 応援と ブラバン、チャンスは タオル）・
//   クーリング（ベンチの 日かげと 35℃ の 札・かげろう）・伝令（マウンドの 輪）・山場（合図ごとに セット → 足 → 投げる、
//   4拍目で カキーン）・サヨナラ（俯瞰：打球と 走者一掃、点が 1つずつ 入り、ベンチから 飛び出す）・砂（夕日と ひざを つく 背中）・
//   校歌（校旗が あがる）。凝った 絵は 山場と サヨナラの 2つ。
// - 重ね物：得点板（試合の 場面）・LIVE／総集編 の 札・その100 に 届いた とき（roll の 題）の 札と スタンドの ウェーブ。
// - 人は 塗りの 小さな 人（person）と 塗りの 投手。学校の 色は INK（KOSHIEN_SCHOOLS の 順）。絵に 出す 文は KOSHIEN_ART。
// - 場面の 進みは 名目の 時計（c.lt・c.t）、点滅と ウェーブは 実際の 時計（c.now）。動きを へらす 設定では ゆれ・光・ウェーブを 止める。

import type { JkEv } from "../core/jikkyo";
import {
	KOSHIEN_ART,
	KOSHIEN_CUE,
	KOSHIEN_SCHOOLS,
	type KoshienData,
} from "../data/jikkyo/koshien";
import {
	bands,
	clamp01,
	crtFrame,
	type G,
	hash,
	makeTv,
	person,
	pulseGlow,
	type TvCtx,
	text,
} from "./jikkyoTvKit";

type C = TvCtx<KoshienData>;

const SC = crtFrame.screen;
const W = SC.w;
const H = SC.h;

/** 学校の 色（帽子・ベルト・アルプスの シャツ。KOSHIEN_SCHOOLS の 順）。 */
const INK = ["#22348a", "#1e6a3a", "#c02a2a", "#8a5a1a", "#5a2a7a"] as const;
const inkOf = (i: number): string => INK[i] ?? INK[0];
const school = (i: number) => KOSHIEN_SCHOOLS[i] ?? KOSHIEN_SCHOOLS[0];
const HOME_UNI = "#f4f4ee";
const AWAY_UNI = "#c4c8d4";
const SKIN = "#e8b890";
const GRASS = "#3e9a3a";
const GRASS2 = "#47a642";
const DIRT = "#c4884e";
const CHALK = "#f4f0e4";
const GLOVE = "#7a4a20";
const SUMMER = ["#3a8ee0", "#56a6ea", "#74bcf0", "#98d0f6", "#bce2fa"];
const SUNSET = ["#2c2350", "#6a3a6a", "#c0566a", "#f08a52", "#f8b860"];
/** 大きな 字の ふち。 */
const OUT = { outline: "#1a1a24" };

const uniOf = (c: C, i: number): string =>
	i === c.data.home ? HOME_UNI : AWAY_UNI;

/** 塗りの 四角。 */
const box = (g: G, ink: string, x: number, y: number, w: number, h: number) => {
	g.fillStyle = ink;
	g.fillRect(x, y, w, h);
};

/** ひし形（内野。上下の 点は cx、左右の 点は cy の 高さ）。 */
const rhombus = (
	g: G,
	ink: string,
	cx: number,
	cy: number,
	rx: number,
	top: number,
	bottom: number,
) => {
	g.fillStyle = ink;
	g.beginPath();
	g.moveTo(cx, bottom);
	g.lineTo(cx + rx, cy);
	g.lineTo(cx, top);
	g.lineTo(cx - rx, cy);
	g.closePath();
	g.fill();
};

const oval = (
	g: G,
	x: number,
	y: number,
	rx: number,
	ry: number,
	ink: string,
): void => {
	g.fillStyle = ink;
	g.beginPath();
	g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
	g.fill();
};

/** 客席の 点（色の 並びは 決め打ち。amp が あれば 波の ように ゆれる）。 */
const crowd = (
	g: G,
	c: C,
	x0: number,
	y0: number,
	w: number,
	h: number,
	inks: readonly string[],
	amp = 0,
): void => {
	for (let y = y0; y < y0 + h; y += 4)
		for (let x = x0 + ((y >> 2) % 2) * 2; x < x0 + w; x += 4) {
			g.fillStyle = inks[Math.floor(hash(x, y, 7) * inks.length)];
			const dy =
				amp && !c.still ? Math.round(Math.sin(c.lt / 260 + x * 0.15) * amp) : 0;
			g.fillRect(x, y + dy, 2, 2);
		}
};

/** 芝の 縞。 */
const grass = (g: G, y0: number, step = 6): void => {
	for (let y = y0; y < H; y += step) {
		box(g, Math.floor(y / step) % 2 ? GRASS : GRASS2, 0, y, W, step);
	}
};

/** 入道雲（白い 丸の かたまり）。 */
const cloud = (g: G, x: number, y: number, k: number): void => {
	oval(g, x, y, 14 * k, 7 * k, "#f6f8ff");
	oval(g, x - 9 * k, y + 3 * k, 9 * k, 5 * k, "#f6f8ff");
	oval(g, x + 10 * k, y + 2 * k, 10 * k, 6 * k, "#f6f8ff");
	oval(g, x + 2 * k, y - 7 * k, 9 * k, 7 * k, "#ffffff");
};

/** 得点板（左上。score・bases を 渡せば その 値）。 */
const board = (
	g: G,
	c: C,
	score = c.data.score,
	bases = c.data.bases ?? 0,
): void => {
	const d = c.data;
	if (!score) return;
	const top = (d.inn ?? "").includes("表");
	box(g, "rgba(10, 30, 20, 0.85)", 2, 2, 78, 22);
	[d.away, d.home].forEach((s, i) => {
		const y = 3 + i * 10;
		if ((i === 0) === top) {
			box(g, "#ffe060", 3, y + 3, 2, 3);
		}
		text(g, school(s).short, 7, y, 8, "#ffffff", { align: "left" });
		text(g, String(score[i]), 39, y, 8, "#ffe060");
	});
	box(g, "#5a7a6a", 45, 4, 1, 18);
	text(g, d.inn ?? "", 62, 3, 8, "#ffffff");
	for (let i = 0; i < 2; i++) {
		box(g, i < (d.outs ?? 0) ? "#ff5040" : "#30483c", 49 + i * 5, 16, 3, 3);
	}
	for (const [bit, bx, by] of [
		[1, 74, 17],
		[2, 70, 13],
		[4, 66, 17],
	] as const) {
		box(g, bases & bit ? "#ffe060" : "#30483c", bx, by, 3, 3);
	}
};

// ───────────────── 札 ─────────────────

const drawCard = (g: G, c: C): void => {
	const end = c.data.phase === "end";
	bands(g, W, end ? SUNSET : SUMMER, 0, H);
	if (end) oval(g, 128, 84, 14, 14, "#ffd890");
	else oval(g, 150, 18, 9, 9, "#fff6c0");
	const drift = c.still ? 0 : Math.round(c.lt * 0.002);
	cloud(g, 34 + drift, 70, 1.2);
	cloud(g, 150 - drift, 66, 0.8);
	box(g, end ? "#3a2a3a" : GRASS, 0, 84, W, H - 84);
	const a = c.still ? 1 : clamp01(c.lt / 600);
	g.globalAlpha = a;
	text(g, KOSHIEN_ART.logo, W / 2, 22, 16, "#ffffff", {
		outline: end ? "#3a1a2a" : "#1a4a8a",
	});
	text(g, c.data.card ?? "", W / 2, 48, 10, "#fffbe8", { outline: "#1a2a4a" });
	g.globalAlpha = 1;
};

// ───────────────── 整列と 礼 ─────────────────

const drawAisatsu = (g: G, c: C): void => {
	const d = c.data;
	box(g, "#4a5a52", 0, 0, W, 16);
	crowd(g, c, 0, 1, W, 14, [inkOf(d.away), inkOf(d.home), "#f0f0e8"]);
	box(g, "#1e4a2e", 0, 16, W, 4);
	grass(g, 20);
	// 内野の 土（本塁が 下の ひし形）
	rhombus(g, DIRT, 90, 70, 60, 42, 100);
	rhombus(g, GRASS, 90, 70, 38, 52, 88);
	// 両軍が 本塁の 前で 向きあい、まんなかに 審判
	const bow = c.still ? c.lt >= 1800 : c.lt >= 1800 && c.lt < 3200;
	for (let i = 0; i < 9; i++) {
		const y = 76 + (bow ? 1 : 0);
		person(g, 28 + i * 6, y, AWAY_UNI, inkOf(d.away));
		person(g, 98 + i * 6, y, HOME_UNI, inkOf(d.home));
	}
	for (let i = 0; i < 4; i++) person(g, 80 + i * 5, 70, "#2a2a36", "#1a1a22");
	// サイレン
	if (c.lt >= 1000 && c.lt < 4200) {
		g.globalAlpha = c.still ? 1 : 1 - clamp01((c.lt - 3400) / 800);
		text(g, KOSHIEN_ART.siren, W / 2, 24, 12, "#ffffff", {
			outline: "#1a3a2a",
		});
		g.globalAlpha = 1;
	}
};

// ───────────────── センターカメラ（投球） ─────────────────

/** 投手の 背中（16x28。pose 0 セット・1 足を 上げる・2 投げる・3 投げおわり）。 */
const pitcher = (
	g: G,
	x: number,
	y: number,
	pose: number,
	uni: string,
	cap: string,
): void => {
	const R = (ink: string, rx: number, ry: number, w: number, h: number) => {
		box(g, ink, x + rx, y + ry, w, h);
	};
	const dy = pose === 3 ? 2 : 0;
	if (pose === 1) {
		R(uni, 9, 19, 4, 8);
		R(cap, 9, 27, 4, 1);
		R(uni, 1, 15, 7, 4);
		R(cap, 0, 15, 2, 4);
	} else if (pose >= 2) {
		R(uni, 1, 19 + dy, 4, 8 - dy);
		R(uni, 11, 18 + dy, 4, 9 - dy);
		R(cap, 1, 27, 4, 1);
		R(cap, 11, 27, 4, 1);
	} else {
		R(uni, 3, 19, 4, 8);
		R(uni, 9, 19, 4, 8);
		R(cap, 3, 27, 4, 1);
		R(cap, 9, 27, 4, 1);
	}
	R(uni, 2, 8 + dy, 12, 11);
	R(cap, 2, 18 + dy, 12, 1);
	R(cap, 6, 10 + dy, 4, 5);
	if (pose === 2) {
		R(uni, 13, -2, 3, 11);
		R(SKIN, 13, -4, 3, 2);
	} else if (pose === 3) R(uni, 1, 12 + dy, 11, 2);
	else R(uni, 14, 9, 2, 7);
	R(GLOVE, -1, 12 + dy, 3, 4);
	R(SKIN, 6, 7 + dy, 4, 1);
	R("#3a2a20", 4, 3 + dy, 8, 4);
	R(cap, 4, dy, 8, 3);
};

/**
 * 本塁の うしろの スタンド・土・芝・打者・捕手・審判・マウンドの 投手。
 * ball は 球の 位置と 大きさ、swing は 打者が 振った あと。
 */
const drawPitch = (
	g: G,
	c: C,
	pose: number,
	ball: readonly [number, number, number] | null,
	swing: boolean,
): void => {
	const d = c.data;
	const top = (d.inn ?? "").includes("表");
	const bat = top ? d.away : d.home;
	const fld = top ? d.home : d.away;
	box(g, "#4a5a52", 0, 0, W, 26);
	crowd(g, c, 0, 1, W, 24, [inkOf(bat), inkOf(fld), "#f0f0e8", "#e8c8a0"]);
	g.fillStyle = "rgba(255, 255, 255, 0.12)";
	for (let x = 0; x < W; x += 6) g.fillRect(x, 0, 1, 26);
	box(g, "#1e4a2e", 0, 26, W, 6);
	box(g, DIRT, 0, 32, W, 18);
	grass(g, 50);
	// 打席の 白線と 本塁
	box(g, CHALK, 70, 45, 14, 1);
	g.fillRect(96, 45, 14, 1);
	g.fillRect(87, 44, 6, 2);
	person(g, 87, 28, "#2a2a36", "#1a1a22");
	// 捕手（しゃがんだ 形）
	box(g, inkOf(fld), 86, 34, 8, 2);
	box(g, "#2a2a30", 86, 36, 8, 3);
	box(g, uniOf(c, fld), 85, 39, 10, 5);
	box(g, GLOVE, 92, 38, 3, 3);
	// 打者（右打ち。振った あとは バットが 横）
	person(g, 74, 32, uniOf(c, bat), inkOf(bat));
	g.fillStyle = "#d8b070";
	if (swing) g.fillRect(79, 38, 11, 1);
	else g.fillRect(79, 27, 1, 8);
	oval(g, 90, 84, 26, 6, DIRT);
	pitcher(g, 82, 56, pose, uniOf(c, fld), inkOf(fld));
	const [bx, by, bk] = ball ?? [0, 0, 0];
	if (ball) box(g, "#ffffff", Math.round(bx), Math.round(by), bk, bk);
};

/** ふだんの 試合（2.6秒ごとに 1球。ときどき 振って ファウル）。 */
const PITCH_MS = 2600;
const drawField = (g: G, c: C): void => {
	const k = Math.floor(c.lt / PITCH_MS);
	const m = c.lt % PITCH_MS;
	const pose = c.still ? 0 : m < 700 ? 0 : m < 1100 ? 1 : m < 1500 ? 2 : 3;
	const q = (m - 1300) / 400;
	const swung = hash(k, 3) < 0.4;
	let ball: [number, number, number] | null = null;
	if (!c.still && q >= 0 && q < 1)
		ball = [96 - q * 6, 54 - q * 14, q < 0.5 ? 3 : 2];
	else if (!c.still && swung && q >= 1 && q < 2.2)
		ball = [90 - (q - 1) * 60, 40 - (q - 1) * 30, 1];
	drawPitch(g, c, pose, ball, swung && q >= 1);
	board(g, c);
};

// ───────────────── 山場：9回裏 2アウト 満塁 ─────────────────

const drawCue = (g: G, c: C): void => {
	const ex = c.data.exact ?? Number.POSITIVE_INFINITY;
	const beat = KOSHIEN_CUE.beat;
	const since = c.t - ex;
	if (since < 0) {
		// 合図：1つめで セット、2つめで 足、3つめで 投げる（球は 4拍目に 本塁）
		const p = (c.t - (ex - KOSHIEN_CUE.pulses * beat)) / beat;
		const q = (p - 2.4) / 0.6;
		const ball = [96 - q * 6, 54 - q * 14, q < 0.5 ? 3 : 2] as const;
		drawPitch(g, c, p < 1 ? 0 : p < 2 ? 1 : 2, q >= 0 ? ball : null, false);
	} else {
		const q = since / 900;
		const ball = [88 + q * 40, 38 - q * 50, q < 0.6 ? 2 : 1] as const;
		drawPitch(g, c, 3, q < 1.4 ? ball : null, true);
		const a = c.still ? 0 : 1 - clamp01(since / 350);
		if (a > 0)
			box(g, `rgba(255, 255, 255, ${(0.85 * a).toFixed(3)})`, 0, 0, W, H);
		if (since < 1400 || c.still)
			text(g, KOSHIEN_ART.hit, W / 2, 56, 16, "#ffe060", OUT);
	}
	board(g, c);
	for (let i = 0; i < KOSHIEN_CUE.pulses; i++) {
		const ink = i < c.pulses.length ? "#ffe060" : "#30483c";
		box(g, ink, W / 2 - 14 + i * 12, 94, 6, 6);
	}
	const glow = pulseGlow(c);
	if (glow > 0) {
		box(g, `rgba(255, 230, 120, ${(0.6 * glow).toFixed(3)})`, 0, 0, W, 2);
		g.fillRect(0, H - 2, W, 2);
		g.fillRect(0, 0, 2, H);
		g.fillRect(W - 2, 0, 2, H);
	}
};

// ───────────────── サヨナラ（俯瞰） ─────────────────

/** 本塁・一塁・二塁・三塁。 */
const BASE_AT = [
	[90, 92],
	[124, 66],
	[90, 40],
	[56, 66],
] as const;

/** 塁を from → to（4 は 本塁）へ 回る 途中の 位置。 */
const runAt = (from: number, to: number, q: number): [number, number] => {
	const n = to - from;
	const s = clamp01(q) * n;
	const k = Math.min(n - 1, Math.floor(s));
	const f = s - k;
	const a = BASE_AT[(from + k) % 4];
	const b = BASE_AT[(from + k + 1) % 4];
	return [
		Math.round(a[0] + (b[0] - a[0]) * f),
		Math.round(a[1] + (b[1] - a[1]) * f),
	];
};

/** 走者（はじめの 塁・帰る 名目の ms の はば）。三塁 → 二塁 → 一塁 の 順に 本塁へ。 */
const RUNNERS = [
	{ from: 3, to: 4, t0: 0, t1: 1300 },
	{ from: 2, to: 4, t0: 200, t1: 2500 },
	{ from: 1, to: 4, t0: 400, t1: 3700 },
	{ from: 0, to: 2, t0: 500, t1: 3000 },
] as const;
const WIN_AT = 3700;

/** 守る 側の 位置（投・捕・一・二・遊・三・左・中・右）。 */
const FIELDERS = [
	[88, 66],
	[88, 96],
	[118, 58],
	[104, 46],
	[72, 46],
	[60, 58],
	[42, 24],
	[88, 16],
	[134, 24],
] as const;

const drawSayonara = (g: G, c: C): void => {
	const d = c.data;
	const lt = c.still ? WIN_AT + 1000 : c.lt;
	box(g, "#4a5a52", 0, 0, W, 8);
	const fans = [inkOf(d.home), "#f0f0e8", "#e8c8a0"];
	crowd(g, c, 0, 1, W, 6, fans, lt > WIN_AT ? 1 : 0);
	box(g, "#1e4a2e", 0, 8, W, 3);
	grass(g, 11);
	rhombus(g, DIRT, 90, 66, 44, 32, 100);
	oval(g, 90, 66, 18, 12, GRASS);
	oval(g, 88, 66, 5, 3, DIRT);
	g.fillStyle = CHALK;
	for (const [bx, by] of BASE_AT) g.fillRect(bx - 1, by - 1, 3, 3);
	// 守る 側（打球の あとは ひざを つく）
	FIELDERS.forEach(([fx, fy], i) => {
		const chase = i === 8 ? clamp01((lt - 300) / 1800) : 0;
		const x = Math.round(fx + chase * 14);
		const y = Math.round(fy - chase * 10);
		if (lt > WIN_AT + 600) {
			box(g, inkOf(d.away), x + 1, y + 4, 4, 2);
			box(g, AWAY_UNI, x, y + 6, 6, 4);
		} else person(g, x, y, AWAY_UNI, inkOf(d.away));
	});
	// 打球（右中間を 破って フェンスまで）
	const bq = clamp01(lt / 1500);
	const bx = 90 + bq * 60;
	const by = 92 - bq * 80;
	const up = Math.round(Math.sin(Math.PI * bq) * 14);
	box(g, "rgba(0, 0, 0, 0.3)", Math.round(bx), Math.round(by), 2, 1);
	box(g, "#ffffff", Math.round(bx), Math.round(by) - up, 2, 2);
	// 走者一掃（点は 1人ずつ 入る）
	let runs = 0;
	for (const r of RUNNERS) {
		const q = (lt - r.t0) / (r.t1 - r.t0);
		if (r.to === 4 && q >= 1) {
			runs++;
			continue;
		}
		const [x, y] = runAt(r.from, r.to, q);
		person(g, x - 3, y - 11, HOME_UNI, inkOf(d.home));
	}
	// ベンチから 飛び出して 二塁の 打者に かけよる
	if (lt > WIN_AT) {
		const p = clamp01((lt - WIN_AT) / 1400);
		for (let i = 0; i < 10; i++) {
			const tx = 84 + (i % 5) * 4 - 6;
			const ty = 28 + Math.floor(i / 5) * 6;
			const x = Math.round(150 + (tx - 150) * p);
			const y = Math.round(92 + (ty - 92) * p);
			const hop =
				p >= 1 && !c.still
					? Math.round(Math.abs(Math.sin(c.now / 160 + i)) * -2)
					: 0;
			person(g, x, y + hop, HOME_UNI, inkOf(d.home));
		}
		text(g, KOSHIEN_ART.sayonara, W / 2, 60, 16, "#ffe060", OUT);
	}
	const base = d.score ?? [3, 4];
	board(g, c, [base[0], base[1] - 3 + runs], 0);
};

// ───────────────── アルプス ─────────────────

const drawAlps = (g: G, c: C): void => {
	const d = c.data;
	const ink = inkOf(d.home);
	const fast = d.chance ? 180 : 320;
	bands(g, W, ["#5aaeea", "#7cc0f0"], 0, 8);
	box(g, "#8a8a84", 0, 8, W, 58);
	for (let r = 0; r < 8; r++) {
		const y = 10 + r * 7;
		for (let x = 2 + (r % 2) * 3; x < W; x += 6) {
			const dy = c.still
				? 0
				: Math.round(Math.sin(c.lt / fast + x * 0.12 + r) * 1);
			box(g, "#ffffff", x + 1, y + dy, 2, 1);
			box(g, SKIN, x + 1, y + 1 + dy, 2, 1);
			box(g, ink, x, y + 2 + dy, 4, 3);
			// チャンスは タオルを まわす
			if (d.chance && !c.still && hash(x, r, Math.floor(c.now / 200)) < 0.5) {
				box(g, "#ffffff", x - 1, y - 2 + dy, 6, 1);
			}
		}
	}
	// 横断幕
	box(g, "#f8f4e8", 14, 62, W - 28, 11);
	text(g, `${KOSHIEN_ART.hissho}　${school(d.home).name}`, W / 2, 63, 8, ink);
	// 最前列の ブラバン と 大太鼓・団長
	box(g, "#6a6a64", 0, 73, W, H - 73);
	for (let i = 0; i < 13; i++) {
		const x = 40 + i * 10;
		person(g, x, 76, "#2a2a40", "#1a1a1a");
		const glint = !c.still && hash(i, Math.floor(c.now / 220)) < 0.3;
		box(g, glint ? "#fff4b0" : "#d8b040", x + 4, 80, 4, 2);
	}
	oval(g, 22, 84, 8, 8, "#e8e0d0");
	box(g, "#a02a2a", 14, 83, 16, 2);
	const up = !c.still && Math.floor(c.lt / fast) % 2 === 0;
	person(g, 32, 78, "#101014", "#101014");
	box(g, "#101014", up ? 30 : 38, up ? 74 : 82, 2, 5);
};

// ───────────────── クーリング（熱中症に 気をつけて） ─────────────────

const drawKyusui = (g: G, c: C): void => {
	const d = c.data;
	box(g, "#2e3a30", 0, 0, W, 12);
	box(g, "#1c2620", 0, 12, W, 46);
	box(g, "#7a5a3a", 16, 50, 140, 4);
	// 給水の タンク
	box(g, "#e87a2a", 4, 38, 10, 14);
	box(g, "#ffffff", 4, 36, 10, 3);
	for (let i = 0; i < 9; i++) {
		const x = 22 + i * 15;
		person(g, x, 40, HOME_UNI, inkOf(d.home));
		box(g, "#ffffff", x, 45, 6, 1);
		// 水を 飲む（順に ボトルを 口へ）
		const drink = !c.still && Math.floor(c.lt / 700 + i * 0.6) % 3 === 0;
		box(g, "#9ad8f8", x + (drink ? 2 : 6), drink ? 40 : 46, 2, 4);
	}
	box(g, "#c8c8c0", 0, 58, W, 2);
	box(g, "#e0a868", 0, 60, W, H - 60);
	// かげろう
	g.fillStyle = "rgba(255, 255, 255, 0.25)";
	for (let i = 0; i < 6; i++) {
		const y = 64 + i * 5;
		const off = c.still ? 0 : Math.round(Math.sin(c.now / 300 + i) * 3);
		for (let x = (i % 2) * 8; x < W; x += 16) g.fillRect(x + off, y, 8, 1);
	}
	// 温度の 札
	box(g, "#ffffff", 146, 16, 30, 14);
	text(g, KOSHIEN_ART.temp, 161, 18, 10, "#e02020");
};

// ───────────────── 伝令（マウンドの 輪） ─────────────────

/** 輪の 位置と、集まる 前の 守備位置（一・二・遊・三・捕）。 */
const RING = [
	[78, 46],
	[100, 46],
	[72, 54],
	[106, 54],
	[90, 60],
] as const;
const FROM = [
	[40, 30],
	[140, 30],
	[30, 62],
	[150, 62],
	[90, 98],
] as const;

const drawDenrei = (g: G, c: C): void => {
	const d = c.data;
	grass(g, 0);
	box(g, DIRT, 0, 0, W, 10);
	oval(g, 90, 50, 30, 15, DIRT);
	box(g, CHALK, 88, 48, 5, 1);
	const lt = c.still ? 4000 : c.lt;
	// 守備が 集まり（9秒で ちる）、伝令が ベンチから 走って くる
	const p = clamp01(lt / 1600) * (1 - clamp01((lt - 9000) / 1500));
	const huddle = p >= 1 && !c.still;
	const hop = (i: number) =>
		huddle ? Math.round(Math.abs(Math.sin(c.now / 300 + i)) * -1) : 0;
	const cap = inkOf(d.home);
	RING.forEach(([rx, ry], i) => {
		const [fx, fy] = FROM[i];
		const x = Math.round(fx + (rx - fx) * p);
		person(g, x, Math.round(fy + (ry - fy) * p) + hop(i), HOME_UNI, cap);
	});
	person(g, 87, 40 + hop(9), HOME_UNI, cap);
	const q = clamp01(lt / 2600) * (1 - clamp01((lt - 9000) / 1500));
	person(g, Math.round(-8 + q * 92), 56 + hop(7), HOME_UNI, cap);
	// グラブで 口を かくして 話す
	if (p >= 1) for (const [rx, ry] of RING) box(g, GLOVE, rx + 1, ry + 2, 3, 2);
};

// ───────────────── 砂（負けた 側） ─────────────────

const drawSuna = (g: G, c: C): void => {
	const d = c.data;
	bands(g, W, SUNSET, 0, 36);
	box(g, "#3a2a3a", 0, 28, W, 10);
	box(g, "#c8804a", 0, 38, W, H - 38);
	g.fillStyle = "rgba(60, 30, 20, 0.25)";
	for (let i = 0; i < 6; i++) {
		const x = 16 + i * 26;
		const y = 60 + (i % 2) * 12;
		g.fillRect(x + 6, y + 8, 14, 2);
		// ひざを つく 背中（帽子・頭・胴）と 手と 袋
		box(g, inkOf(d.away), x + 1, y, 4, 2);
		box(g, "#3a2a20", x + 1, y + 2, 4, 2);
		box(g, AWAY_UNI, x, y + 4, 6, 6);
		const scoop = c.still ? 0 : Math.floor(c.lt / 500 + i) % 2;
		box(g, SKIN, x + 6, y + 6 + scoop * 3, 2, 2);
		box(g, "#f0f0e8", x + 9, y + 7, 4, 4);
		g.fillStyle = "rgba(60, 30, 20, 0.25)";
	}
	// 舞う 砂
	if (!c.still) {
		g.fillStyle = "#e8b080";
		for (let i = 0; i < 8; i++) {
			const t = (c.lt / 1200 + hash(i, 5)) % 1;
			g.fillRect(Math.round(hash(i, 6) * W), Math.round(90 - t * 30), 1, 1);
		}
	}
};

// ───────────────── 校歌 ─────────────────

const drawKouka = (g: G, c: C): void => {
	const d = c.data;
	bands(g, W, SUMMER, 0, 62);
	const drift = c.still ? 0 : Math.round(c.lt * 0.002);
	cloud(g, 40 + drift, 30, 1);
	box(g, "#1e4a2e", 0, 58, W, 6);
	grass(g, 64);
	// 校旗が あがる
	box(g, "#d8d8d8", 136, 6, 1, 52);
	const fy = Math.round(46 - 38 * (c.still ? 1 : clamp01(c.lt / 8000)));
	box(g, inkOf(d.home), 137, fy, 16, 10);
	box(g, "#ffffff", 143, fy + 3, 4, 4);
	// 帽子を とって 並ぶ（背中）
	for (let i = 0; i < 10; i++) {
		const x = 30 + i * 12;
		person(g, x, 74, HOME_UNI, "#2a2020");
		box(g, inkOf(d.home), x + 5, 80, 2, 2);
	}
	// 音の しるし（字は 出さない）
	if (!c.still)
		for (let i = 0; i < 4; i++) {
			const t = (c.lt / 2400 + i / 4) % 1;
			const x = Math.round(20 + i * 30 + Math.sin(t * 6 + i) * 4);
			const y = Math.round(58 - t * 40);
			box(g, `rgba(255, 255, 255, ${(1 - t).toFixed(2)})`, x, y + 4, 3, 2);
			g.fillRect(x + 2, y, 1, 5);
		}
	text(g, KOSHIEN_ART.kouka, 32, 8, 10, "#ffffff", { outline: "#1a4a8a" });
};

// ───────────────── その100 の 札と ウェーブ・番組の 札 ─────────────────

/** その100 の スレが 立った 実際の 時刻（roll の 題で 知る）。 */
let sono100At = Number.NEGATIVE_INFINITY;
const SONO100_MS = 3400;

const onEv = (ev: JkEv, now: number): void => {
	if (ev.t === "roll" && ev.title.includes(KOSHIEN_ART.sono100))
		sono100At = now;
};

const drawOver = (g: G, c: C): void => {
	crtFrame.draw(g, c);
	const { x, y, w, h } = SC;
	// LIVE（本大会）／総集編 の 札
	const tag = c.live ? KOSHIEN_ART.live : KOSHIEN_ART.tag;
	box(g, c.live ? "#d02020" : "#3a3a44", x + w - 30, y + 2, 28, 11);
	text(g, tag, x + w - 16, y + 3, 8, "#ffffff");
	const el = c.now - sono100At;
	if (!(el >= 0 && el < SONO100_MS)) return;
	// スタンドの ウェーブ（左から 右へ 立ちあがる）
	for (let i = 0; i < 18; i++) {
		const hx = x + 5 + i * 10;
		const rise = c.still
			? 1
			: Math.max(0, Math.sin(clamp01((el - i * 60) / 700) * Math.PI));
		const hy = y + h - 4 - Math.round(rise * 10);
		box(g, "#101014", hx, hy, 6, y + h - hy);
		g.fillRect(hx + 1, hy - 3, 4, 3);
		if (rise > 0.5) {
			box(g, "#ffe060", hx - 1, hy - 6, 2, 3);
			g.fillRect(hx + 5, hy - 6, 2, 3);
		}
	}
	box(g, "rgba(10, 10, 30, 0.88)", x, y + 22, w, 36);
	text(g, KOSHIEN_ART.sono100, x + w / 2, y + 28, 16, "#ffe060", OUT);
	text(g, KOSHIEN_ART.taidai, x + w / 2, y + 45, 8, "#ffffff");
};

export const koshienTv = makeTv<KoshienData>({
	screen: SC,
	frame: drawOver,
	onEv,
	noCaption: ["card"],
	scenes: {
		card: drawCard,
		aisatsu: drawAisatsu,
		field: drawField,
		alps: drawAlps,
		kyusui: drawKyusui,
		denrei: drawDenrei,
		cue: drawCue,
		sayonara: drawSayonara,
		suna: drawSuna,
		kouka: drawKouka,
	},
});
