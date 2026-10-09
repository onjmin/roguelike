// 漫才スレ王　決定戦の TV（ui/jikkyoWatch.ts の 板の 上の キャンバス）。形は ui/jikkyoTvKit.ts（480x270 の 2倍の 下地に
// 240x135 の 座標）。
// - 会場の 枠（保守劇場）：両わきに 赤い 幕・上に 幕の かざり（劇場の 部屋と 同じ Base.png の 絵）・金の 額ぶち・
//   下に 客の 頭（本番は スマホの 光が 多い。ボケと 草の 洪水では 頭が ゆれて 笑う）。
// - 場面（data/jikkyo/manzai.ts の MANZAI_SCENES）：幕（まもなく・おわり）・開演（看板と 司会）・ネタ（まんなかの マイクと
//   コンビ。ボケで「！」）・点数（客の 笑いの マスと 審査員の 点の マス。点の マスは 窓が 開いてから 1つずつ ともる）・
//   敗者復活（名無しズが わきから 出てくる）・最終決戦（3組の 札）・山場（ボケ・ツッコミ・ボケの 吹き出し → 決めで 光って
//   舞台に 草が 生える＝大草原）・CM（村の 店）・投票と 優勝（審査員の 札・金の 杯・紙ふぶき）。
// - 凝った 絵は 2つ（点数の 札と 山場の 大草原）。人は 同梱の rpgen の 歩行グラ（読めなければ 塗りの 人）と、
//   名無しズは 顔の ない 灰色の 塗り。絵に 出す 文は MANZAI_ART・MANZAI_COMBOS。
// - 進みは 名目の 時計（c.lt・c.t）、点滅だけ 実際の 時計。動きを へらす 設定では 点滅・ゆれ・紙ふぶきを 止める。

import {
	MANZAI_ART,
	MANZAI_COMBOS,
	MANZAI_CUE,
	MANZAI_WORD,
	type ManzaiData,
} from "../data/jikkyo/manzai";
import {
	clamp01,
	type G,
	hash,
	makeTv,
	num,
	numW,
	person,
	type SceneFn,
	type TvCtx,
	text,
	walker,
} from "./jikkyoTvKit";

type C = TvCtx<ManzaiData>;

/** 舞台（240x135 の 中）。 */
const SCREEN = { x: 20, y: 10, w: 200, h: 100 } as const;
const SW = SCREEN.w;
const SH = SCREEN.h;
/** 舞台の 床（足もと）。 */
const FLOOR = 64;
const FEET = 88;

const BASE = "pub:assets/rpg-reze/Base.png";
/** Base.png の 中の 劇場の 絵（px）：赤い 幕の かざり・赤い 幕（16x48）。 */
const VALANCE = [96, 5712] as const;
const CURTAIN = [96, 5728] as const;

const CHAR = (f: string) => `pub:assets/rpgen/char/${f}.png`;
/** コンビの 絵（ボケ・ツッコミ。名無しズは 塗り）・札の 色。 */
const LOOK = [
	{ a: "c0a", b: "c0b", ink: "#4a78c8", body: "#3a5a9a" },
	{ a: "c1a", b: "c1b", ink: "#e0a030", body: "#c07a2a" },
	{ a: "", b: "", ink: "#8a8a98", body: "#7a7a88" },
] as const;

const IMAGES = {
	base: BASE,
	c0a: CHAR("14-man-a"),
	c0b: CHAR("16-man-b"),
	c1a: CHAR("04-child"),
	c1b: CHAR("15-woman-c"),
	host: CHAR("02-merchant"),
	j0: CHAR("03-elderly-a"),
	j1: CHAR("05-elderly-b"),
	j2: CHAR("10-elderly-c"),
} as const;

const comboOf = (c: C) => Math.max(0, Math.min(2, c.data.combo ?? 0));

// ───────────────── 小さな 道具 ─────────────────

/** 顔の ない 灰色の 人（名無しズ。2倍で 16x32 ほど）。 */
const nanashi = (g: G, x: number, y: number, k: number, ink: string) => {
	g.fillStyle = ink;
	g.fillRect(x + 5 * k, y + 2 * k, 6 * k, 5 * k);
	g.fillRect(x + 4 * k, y + 7 * k, 8 * k, 6 * k);
	// 頭の 照りと 首・腕の 影（顔は 描かない）
	g.fillStyle = "rgba(255, 255, 255, 0.25)";
	g.fillRect(x + 6 * k, y + 3 * k, 2 * k, k);
	g.fillStyle = "rgba(0, 0, 0, 0.3)";
	g.fillRect(x + 5 * k, y + 7 * k, 6 * k, k);
	g.fillRect(x + 4 * k, y + 8 * k, k, 5 * k);
	g.fillRect(x + 11 * k, y + 8 * k, k, 5 * k);
	g.fillStyle = "#5a5a66";
	g.fillRect(x + 5 * k, y + 13 * k, 2 * k, 3 * k);
	g.fillRect(x + 9 * k, y + 13 * k, 2 * k, 3 * k);
};

/** コンビの 1人（i：0 ボケ・1 ツッコミ）。足もとが FEET。 */
const member = (
	g: G,
	c: C,
	combo: number,
	i: 0 | 1,
	x: number,
	o: { k?: number; hop?: number; fast?: boolean } = {},
) => {
	const k = o.k ?? 2;
	const y = FEET - 16 * k - (o.hop ?? 0);
	const L = LOOK[combo];
	if (combo === 2) {
		nanashi(g, x, y, k, i ? "#9a9aa8" : "#80808e");
		return;
	}
	const frame = c.still ? 0 : Math.floor(c.now / (o.fast ? 200 : 600)) % 2;
	walker(g, c.imgs[i ? L.b : L.a], 2, frame, x, y, k, L.body);
};

/** 舞台の 奥（紺の 壁・電球の 看板・板の 床）。sign が あれば 看板の 字。 */
const backdrop = (g: G, c: C, sign: string = MANZAI_ART.logo, px = 12) => {
	g.fillStyle = "#141838";
	g.fillRect(0, 0, SW, SH);
	g.fillStyle = "#1c2250";
	for (let x = 6; x < SW; x += 24) g.fillRect(x, 0, 10, FLOOR);
	// 看板（金の ふちと 電球）
	const w = 116;
	const x0 = (SW - w) / 2;
	g.fillStyle = "#c8a040";
	g.fillRect(x0, 6, w, 26);
	g.fillStyle = "#3a1018";
	g.fillRect(x0 + 2, 8, w - 4, 22);
	const blink = c.still ? 0 : Math.floor(c.now / 250) % 2;
	for (let i = 0; i < 15; i++) {
		g.fillStyle = (i + blink) % 2 ? "#fff0a0" : "#c89040";
		g.fillRect(x0 + 2 + i * 8, 4, 2, 2);
		g.fillRect(x0 + 2 + i * 8, 32, 2, 2);
	}
	text(g, sign, SW / 2, 19 - px / 2, px, "#ffe070");
	// 床
	g.fillStyle = "#5a3418";
	g.fillRect(0, FLOOR, SW, SH - FLOOR);
	g.fillStyle = "#6e4222";
	for (let y = FLOOR + 4; y < SH; y += 7) g.fillRect(0, y, SW, 1);
	g.fillStyle = "#8a5a30";
	g.fillRect(0, FLOOR, SW, 2);
};

/** 光の 柱（上が 細く 下が 広い）。 */
const beam = (g: G, x: number, ink: string, a: number) => {
	if (a <= 0) return;
	g.globalAlpha = a;
	g.fillStyle = ink;
	g.beginPath();
	g.moveTo(x - 3, 0);
	g.lineTo(x + 3, 0);
	g.lineTo(x + 18, FEET);
	g.lineTo(x - 18, FEET);
	g.closePath();
	g.fill();
	g.globalAlpha = 1;
};

/** まんなかの マイク（1本の スタンド）。 */
const mic = (g: G, x: number) => {
	g.fillStyle = "#9a9aa8";
	g.fillRect(x, 54, 1, FEET - 54);
	g.fillRect(x - 4, FEET - 1, 9, 1);
	g.fillStyle = "#d8d8e0";
	g.fillRect(x - 1, 50, 3, 4);
};

/** コンビの 名前の 札（色の 地に 白い 字）。 */
const plate = (
	g: G,
	combo: number,
	cx: number,
	y: number,
	gold = false,
	px = 8,
) => {
	const name = MANZAI_COMBOS[combo].name;
	const w = Math.max(40, name.length * px + 6);
	g.fillStyle = gold ? "#c8a040" : "#ffffff";
	g.fillRect(Math.round(cx - w / 2) - 1, y - 1, w + 2, px + 5);
	g.fillStyle = LOOK[combo].ink;
	g.fillRect(Math.round(cx - w / 2), y, w, px + 3);
	text(g, name, cx, y + 1, px, "#ffffff", { outline: "#00000060" });
};

/** 吹き出し（who：0 ボケは 左わき・1 ツッコミは 右わき。名前の 札に かからない。s は 1字）。 */
const talk = (g: G, who: 0 | 1, s: string, ink = "#ffffff") => {
	const x = who ? SW / 2 + 38 : SW / 2 - 56;
	const y = 44;
	g.fillStyle = ink;
	g.fillRect(x, y, 18, 11);
	g.fillRect(who ? x : x + 15, y + 11, 3, 3);
	text(g, s, x + 9, y + 1, 9, "#1a1a28");
};

/** 紙ふぶき（動きを へらす 設定では 止まった 粒）。 */
const confetti = (g: G, c: C, inks: readonly string[], n = 36) => {
	for (let i = 0; i < n; i++) {
		const sp = 0.02 + hash(i, 41) * 0.025;
		const t = c.still ? hash(i, 44) * 400 : c.now * sp;
		const x = Math.round(
			hash(i, 42) * SW + (c.still ? 0 : Math.sin(c.now / 500 + i) * 4),
		);
		const y = Math.round(((t + hash(i, 43) * 120) % (SH + 10)) - 8);
		g.fillStyle = inks[i % inks.length];
		g.fillRect(x, y, 2, i % 3 ? 2 : 1);
	}
};

/** 閉じた 赤い 幕（open は 上がった 割合）。 */
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

/** コンビが マイクの 両わきに 立つ（talk：しゃべって いる 人）。 */
const pair = (
	g: G,
	c: C,
	combo: number,
	o: { talk?: 0 | 1 | null; hop?: boolean } = {},
) => {
	const cx = SW / 2;
	const hop = (i: number) =>
		o.hop && !c.still && (Math.floor(c.now / 180) + i) % 2 ? 2 : 0;
	member(g, c, combo, 0, cx - 34, { hop: hop(0), fast: o.talk === 0 });
	member(g, c, combo, 1, cx + 2, { hop: hop(1), fast: o.talk === 1 });
	mic(g, cx);
};

// ───────────────── 場面 ─────────────────

const drawCard: SceneFn<ManzaiData> = (g, c) => {
	curtain(g, 0);
	const end = c.data.phase === "end";
	// すきまから もれる 光（はじまる 前だけ）
	if (!end) {
		const a = c.still ? 0.3 : 0.2 + 0.12 * Math.sin(c.now / 700);
		g.fillStyle = `rgba(255, 230, 160, ${a.toFixed(3)})`;
		g.fillRect(SW / 2 - 1, 0, 2, SH);
	}
	const s = end ? MANZAI_ART.end : MANZAI_ART.soon;
	const w = end ? 128 : 92;
	g.fillStyle = "#f4ead0";
	g.fillRect(SW / 2 - w / 2, 30, w, 34);
	g.fillStyle = "#5a3418";
	g.fillRect(SW / 2 - w / 2, 30, w, 1);
	g.fillRect(SW / 2 - w / 2, 63, w, 1);
	text(g, `${MANZAI_ART.logo}　${MANZAI_ART.sub}`, SW / 2, 34, 8, "#a01828");
	text(g, s, SW / 2, 47, end ? 8 : 10, "#3a1a10");
};

const drawOp: SceneFn<ManzaiData> = (g, c) => {
	backdrop(g, c, `${MANZAI_ART.logo}　${MANZAI_ART.sub}`, 10);
	const sweep = c.still ? 0 : Math.sin(c.now / 900) * 40;
	beam(g, SW / 2 + sweep, "#fff0c0", 0.16);
	beam(g, SW / 2 - sweep, "#c0d0ff", 0.12);
	// 3組が ならぶ（小さく）と 司会
	for (let i = 0; i < 3; i++) {
		const x = 92 + i * 34;
		if (i === 2) {
			nanashi(g, x, 70, 1, "#80808e");
			nanashi(g, x + 10, 70, 1, "#9a9aa8");
		} else {
			walker(g, c.imgs[LOOK[i].a], 2, 0, x, 70, 1, LOOK[i].body);
			walker(g, c.imgs[LOOK[i].b], 2, 0, x + 10, 70, 1, LOOK[i].body);
		}
	}
	const f = c.still ? 0 : Math.floor(c.now / 500) % 2;
	walker(g, c.imgs.host, 2, f, 30, FEET - 32, 2, "#3a8a4a");
	g.fillStyle = "#d8d8e0";
	g.fillRect(52, 66, 2, 3);
	text(g, MANZAI_ART.host, 46, 46, 7, "#ffffff", { outline: "#000000" });
	curtain(g, clamp01(c.lt / 2000));
};

const drawNeta: SceneFn<ManzaiData> = (g, c) => {
	const combo = comboOf(c);
	backdrop(g, c);
	beam(g, SW / 2, c.data.final ? "#ffe0a0" : "#fff0d0", 0.2);
	const boke = c.data.phase === "boke";
	// 1.2秒ごとに ボケ・ツッコミを くりかえす（ボケの 区切りは 吹き出しと、ツッコミで 跳ねる）
	const beat = Math.floor(c.lt / 1200) % 2;
	pair(g, c, combo, { talk: beat ? 1 : 0, hop: boke && beat === 1 });
	plate(g, combo, SW / 2, 40, c.data.final);
	if (boke) talk(g, beat ? 1 : 0, beat ? "！" : "…");
	if (c.data.final)
		text(g, MANZAI_ART.kessen, 26, FLOOR + 4, 8, "#ffe070", {
			outline: "#3a1018",
		});
	else {
		const k = combo < 2 ? combo : 2;
		text(g, MANZAI_ART.order[k], 22, FLOOR + 4, 8, "#ffffff", {
			outline: "#000000",
		});
	}
};

/** 点数の 札（客の 笑いと 審査員の 点の 5マス）。 */
const drawScore: SceneFn<ManzaiData> = (g, c) => {
	const combo = comboOf(c);
	const laugh = c.data.laugh ?? 3;
	const score = c.data.score ?? 3;
	const at = c.data.at ?? Number.POSITIVE_INFINITY;
	const step = c.data.step ?? 300;
	const lit = c.t < at ? 0 : Math.min(score, Math.floor((c.t - at) / step) + 1);
	const done = c.t >= at + score * step;
	g.fillStyle = "#0e1028";
	g.fillRect(0, 0, SW, SH);
	// 札
	g.fillStyle = "#c8a040";
	g.fillRect(18, 4, SW - 36, 62);
	g.fillStyle = "#101018";
	g.fillRect(20, 6, SW - 40, 58);
	plate(g, combo, SW / 2, 8);
	const X0 = 74;
	const CW = 18;
	const rows = [
		{ label: MANZAI_ART.laugh, y: 24, n: laugh, ink: "#ffd040" },
		{ label: MANZAI_ART.judge, y: 40, n: lit, ink: "#ff6a7a" },
	];
	for (const r of rows) {
		text(g, r.label, 48, r.y + 1, 7, "#c8c0a0");
		for (let i = 0; i < 5; i++) {
			g.fillStyle = i < r.n ? r.ink : "#2a2a3a";
			g.fillRect(X0 + i * CW, r.y, CW - 3, 10);
		}
	}
	// 数えて いる あいだは 次の マスが 白く 点る
	if (!done && c.t >= at && !c.still && Math.floor(c.now / 120) % 2) {
		g.fillStyle = "rgba(255, 255, 255, 0.7)";
		g.fillRect(X0 + lit * CW, 40, CW - 3, 1);
	}
	// 客の 笑いの 線（ここを こえたら 高すぎ、2つ 手前なら 辛すぎ）
	g.fillStyle = "#ffe060";
	const lx = X0 + laugh * CW - 2;
	for (let y = 21; y < 54; y += 3) g.fillRect(lx, y, 1, 2);
	if (done) {
		const s = String(c.data.total ?? 0);
		const w = numW(s, 2);
		const blink = !c.still && Math.floor(c.now / 300) % 2;
		num(g, s, SW / 2 - w / 2 - 5, 54, 2, blink ? "#ffffff" : "#ffe060");
		text(g, MANZAI_ART.ten, SW / 2 + w / 2 + 2, 53, 7, "#ffe060");
	}
	// 審査員（背中）と 上げる 札
	for (let i = 0; i < 3; i++) {
		const x = 36 + i * 52;
		walker(g, c.imgs[`j${i}`], 0, 0, x, 70, 1.5, "#5a4a3a");
		if (done) {
			g.fillStyle = "#f4f4f8";
			g.fillRect(x + 6, 64, 12, 7);
			g.fillStyle = "#9a9aa8";
			g.fillRect(x + 11, 71, 1, 3);
		}
	}
};

const drawFukkatsu: SceneFn<ManzaiData> = (g, c) => {
	backdrop(g, c, MANZAI_ART.fukkatsu);
	// わきの 扉から 光
	g.fillStyle = "#fff0c0";
	g.globalAlpha = 0.5;
	g.fillRect(0, 30, 14, FEET - 30);
	g.globalAlpha = 1;
	const p = clamp01(c.lt / 2500);
	const x = Math.round(-30 + p * (SW / 2 - 4));
	const step = !c.still && p < 1 ? (Math.floor(c.now / 160) % 2) * 2 : 0;
	nanashi(g, x - 18, FEET - 32 - step, 2, "#80808e");
	nanashi(g, x + 8, FEET - 32 - (step ? 0 : 2 * (p < 1 ? 1 : 0)), 2, "#9a9aa8");
	if (p >= 1) {
		beam(g, SW / 2, "#fff0c0", 0.22);
		plate(g, 2, SW / 2, 40);
		if (!c.still) confetti(g, c, ["#ffffff", "#c0c0d0", "#ffe060"], 18);
	}
};

const drawKessen: SceneFn<ManzaiData> = (g, c) => {
	backdrop(g, c, MANZAI_ART.kessen);
	const hl = c.still ? -1 : Math.floor(c.now / 700) % 3;
	for (let i = 0; i < 3; i++) {
		const cx = 38 + i * 62;
		if (i === hl) beam(g, cx, "#fff0c0", 0.2);
		plate(g, i, cx, 40, false, 7);
		if (i === 2) {
			nanashi(g, cx - 24, 56, 2, "#80808e");
			nanashi(g, cx - 6, 56, 2, "#9a9aa8");
		} else {
			walker(g, c.imgs[LOOK[i].a], 2, 0, cx - 16, 56, 2, LOOK[i].body);
			walker(g, c.imgs[LOOK[i].b], 2, 0, cx - 2, 56, 2, LOOK[i].body);
		}
	}
};

/** 山場：ボケ・ツッコミ・ボケの 吹き出し → 決めの ツッコミで 光り、舞台に 草が 生える（大草原）。 */
const drawCue: SceneFn<ManzaiData> = (g, c) => {
	const combo = comboOf(c);
	const exact = c.data.exact ?? MANZAI_CUE.at + 3 * MANZAI_CUE.beat;
	const beat = MANZAI_CUE.beat;
	const from = exact - MANZAI_CUE.pulses * beat;
	backdrop(g, c);
	beam(g, SW / 2, "#ffe0a0", 0.24);
	const since = c.t - exact;
	if (since < 0) {
		// 合図ごとに 吹き出し（ボケ「…」・ツッコミ「？」・ボケ「…」）
		const k = c.t < from ? -1 : Math.floor((c.t - from) / beat);
		const who = k === 1 ? 1 : 0;
		pair(g, c, combo, { talk: who });
		plate(g, combo, SW / 2, 40, true);
		if (k >= 0) talk(g, who, ["…", "？", "…"][k] ?? "…");
		return;
	}
	// 決めの ツッコミ（跳ねて「！」）と 光
	pair(g, c, combo, { talk: 1, hop: since < 4000 });
	if (since < 2500) talk(g, 1, "！", "#ffe060");
	const flash = c.still ? 0 : clamp01(1 - since / 400);
	if (flash > 0) {
		g.fillStyle = `rgba(255, 255, 255, ${(flash * 0.8).toFixed(3)})`;
		g.fillRect(0, 0, SW, SH);
	}
	// 大草原：下から 草の 葉と「草」の 字が 生える（1.5秒で 舞台の 下を うめる）
	const grow = c.still ? 1 : clamp01(since / 1500);
	const top = Math.round(SH - 2 - grow * 22);
	g.fillStyle = "#2f8a3a";
	g.fillRect(0, top + 6, SW, SH - top);
	for (let x = 0; x < SW; x += 4) {
		const h = 4 + Math.floor(hash(x, 7) * 6);
		const sway = c.still ? 0 : Math.round(Math.sin(c.now / 300 + x) * 1);
		g.fillStyle = hash(x, 8) < 0.5 ? "#4ab84a" : "#6ad060";
		g.fillRect(x + sway, top + 6 - h, 2, h);
		g.fillRect(x + 2 + sway, top + 6 - h + 2, 1, h - 2);
	}
	const n = Math.floor(grow * 14);
	for (let i = 0; i < n; i++) {
		const x = 10 + Math.floor(hash(i, 21) * (SW - 20));
		const y = top + 6 + Math.floor(hash(i, 22) * Math.max(1, SH - top - 16));
		text(g, MANZAI_WORD, x, y, 9, "#d8ffc8", { outline: "#1a5a20" });
	}
};

const CM_INK = ["#2a6ac8", "#c83a3a", "#2a9a7a"] as const;

const drawCm: SceneFn<ManzaiData> = (g, c) => {
	const i = Math.max(0, Math.min(MANZAI_ART.cm.length - 1, c.data.cm ?? 0));
	const ad = MANZAI_ART.cm[i];
	g.fillStyle = CM_INK[i];
	g.fillRect(0, 0, SW, SH);
	g.fillStyle = "rgba(255, 255, 255, 0.12)";
	for (let x = -SH; x < SW; x += 16) {
		g.beginPath();
		g.moveTo(x, SH);
		g.lineTo(x + 8, SH);
		g.lineTo(x + 8 + SH, 0);
		g.lineTo(x + SH, 0);
		g.closePath();
		g.fill();
	}
	g.fillStyle = "#ffffff";
	g.fillRect(SW / 2 - 70, 26, 140, 40);
	text(g, ad.shop, SW / 2, 32, 12, CM_INK[i]);
	text(g, ad.line, SW / 2, 50, 8, "#2a2a36");
	g.fillStyle = "#000000";
	g.fillRect(SW - 22, 4, 18, 10);
	text(g, MANZAI_ART.cmTag, SW - 13, 5, 8, "#ffffff");
	// 揚げパン（茶色の 楕円と 砂糖の 点）
	if (i === 0) {
		g.fillStyle = "#c8842a";
		g.fillRect(SW / 2 - 10, 72, 20, 8);
		g.fillRect(SW / 2 - 12, 74, 24, 4);
		g.fillStyle = "#fff4d8";
		for (let k = 0; k < 6; k++)
			g.fillRect(SW / 2 - 9 + k * 3, 73 + (k % 2) * 3, 1, 1);
	} else {
		g.save();
		g.translate(SW / 2 - 6, 70);
		g.scale(2, 2);
		person(g, 0, 0, i === 1 ? "#c83a3a" : "#2a9a7a", "#2a2020");
		g.restore();
	}
};

/** 金の 杯。 */
const cup = (g: G, cx: number, y: number) => {
	g.fillStyle = "#c8a040";
	g.fillRect(cx - 10, y, 20, 4);
	g.fillRect(cx - 8, y + 4, 16, 8);
	g.fillRect(cx - 5, y + 12, 10, 3);
	g.fillRect(cx - 2, y + 15, 4, 6);
	g.fillRect(cx - 8, y + 21, 16, 3);
	g.fillRect(cx - 13, y + 2, 3, 7);
	g.fillRect(cx + 10, y + 2, 3, 7);
	g.fillStyle = "#ffe890";
	g.fillRect(cx - 6, y + 2, 3, 9);
};

const drawYusho: SceneFn<ManzaiData> = (g, c) => {
	const champ = Math.max(0, Math.min(2, c.data.champ ?? 0));
	const votes = c.data.votes ?? [champ, champ, champ];
	const at = c.data.at ?? Number.POSITIVE_INFINITY;
	const step = c.data.step ?? 600;
	const shown =
		c.t < at ? 0 : Math.min(votes.length, Math.floor((c.t - at) / step) + 1);
	const win = c.data.phase === "win" || c.t >= at + votes.length * step;
	if (!win) {
		backdrop(g, c, MANZAI_ART.vote);
		for (let i = 0; i < 3; i++) {
			const x = 36 + i * 52;
			const up = i < shown;
			walker(g, c.imgs[`j${i}`], 2, 0, x, 66, 1.5, "#5a4a3a");
			const v = votes[i] ?? champ;
			g.fillStyle = up ? LOOK[v].ink : "#3a3040";
			g.fillRect(x - 8, up ? 40 : 56, 40, 12);
			if (up)
				text(g, MANZAI_COMBOS[v].name, x + 12, 42, 7, "#ffffff", {
					outline: "#00000080",
				});
		}
		return;
	}
	backdrop(g, c, MANZAI_ART.yusho);
	beam(g, SW / 2, "#fff0c0", 0.26);
	pair(g, c, champ, { hop: true });
	cup(g, SW / 2 + 52, 58);
	plate(g, champ, SW / 2, 40, true);
	confetti(g, c, ["#ffe060", "#ff6a7a", "#ffffff", LOOK[champ].ink]);
};

// ───────────────── 会場の 枠（保守劇場） ─────────────────

const drawFrame: SceneFn<ManzaiData> = (g, c) => {
	const { x: SX, y: SY } = SCREEN;
	const base = c.imgs.base;
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
	// 客の 頭（本番は スマホの 光が 多い。ボケと 洪水では 笑って ゆれる）
	const laughing =
		c.v.flood || (c.data.phase === "boke" && Math.floor(c.lt / 1200) % 2 === 1);
	g.fillStyle = "#08060a";
	g.fillRect(0, 114, 240, 21);
	for (let i = 0; i < 12; i++) {
		const x = 10 + i * 20;
		const bob = laughing && !c.still ? (Math.floor(c.now / 140) + i) % 2 : 0;
		const y = 124 + (i % 2) * 3 - bob;
		g.fillStyle = "#0e0a10";
		g.beginPath();
		g.arc(x, y, 8, Math.PI, 0);
		g.fill();
		g.fillRect(x - 11, y, 22, 135 - y);
		if (hash(i, 91) >= (c.live ? 0.55 : 0.25)) continue;
		g.globalAlpha = c.still ? 0.9 : 0.6 + 0.4 * Math.sin(c.now / 1100 + i);
		g.fillStyle = "rgba(120, 190, 255, 0.25)";
		g.fillRect(x + 3, y - 4, 8, 5);
		g.fillStyle = "#eaf6ff";
		g.fillRect(x + 5, y - 2, 3, 2);
		g.globalAlpha = 1;
	}
};

export const manzaiTv = makeTv<ManzaiData>({
	images: IMAGES,
	screen: SCREEN,
	bg: "#0e080c",
	frame: drawFrame,
	scenes: {
		card: drawCard,
		op: drawOp,
		neta: drawNeta,
		score: drawScore,
		fukkatsu: drawFukkatsu,
		kessen: drawKessen,
		cue: drawCue,
		cm: drawCm,
		yusho: drawYusho,
	},
});
