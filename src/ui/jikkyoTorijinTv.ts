// 人力機　保守杯の TV（ui/jikkyoWatch.ts の 板の 上の キャンバス）。海の家「age」の 壁の 小さな テレビ。
// 形は ui/jikkyoTvKit.ts（480x270 の 2倍の 下地に 240x135 の 座標。場面は スクリーン 180x104 の 左上が 0,0）。
// - 枠：部屋の テレビ（crtFrame）＋ 壁に うちわ・すみに 風鈴。
// - 場面（data/jikkyo/torijin.ts の TORIJIN_SCENES）：札（まもなく・おわり）・オープニング（湖・遠くの 台・桟橋の うちわ・題）・
//   発進台（山場。台の 上の 機体・チームの 幕・旗の 人。合図ごとに 旗が 上がり、数字 3→2→1、4拍目で 台を けって 飛びだす）・
//   空（飛ぶ 機体を 追う。飛びかたで 高さが かわる・距離の 札・着水の しぶき。最後の 機は 折りかえしの ブイで 旋回して
//   台へ もどる）・記録（板に 数が のぼる。最後は「大会記録」の 判と 紙ふぶき）・風待ち（吹き流しと 白波）。
// - 専用の 凝った 絵は 発進台と 空の 2つ。ほかは 湖の 下地を 使いまわす。どれも 塗りの ドット絵。
// - 進みは 名目の 時計（c.t・c.lt）、うちわ・きらめき・風鈴の 点滅と ゆれは 実際の 時計（c.now）。still では 止める。

import {
	recText,
	TORIJIN_ART,
	TORIJIN_LAST,
	type TorijinData,
	type TorijinKind,
} from "../data/jikkyo/torijin";
import {
	bands,
	clamp01,
	crtFrame,
	type G,
	hash,
	makeTv,
	num,
	numW,
	person,
	pulseGlow,
	type TvCtx,
	text,
} from "./jikkyoTvKit";

type C = TvCtx<TorijinData>;

const SKY = ["#3f9ae6", "#56a8ec", "#6eb8f0", "#88c8f4", "#a6d8f8"] as const;
const WATER = ["#2a72c0", "#2f7ec8", "#3a8ad0", "#4696d6"] as const;
const SUNSET = ["#2c2350", "#5a2f62", "#a0466a", "#d86a52", "#f29a52"] as const;
/** 機体の 色（チームごと）。 */
const INK: Readonly<Record<TorijinKind, string>> = {
	short: "#e04848",
	low: "#3a6ad8",
	high: "#f0a020",
	mid: "#38a868",
	last: "#8a4ad8",
};
const FANS = ["#ff6a6a", "#ffd24a", "#6ac8ff", "#ffffff", "#ff9ad0"] as const;
/** 機体が 水に つく 高さ（空の 場面）。 */
const SURF = 84;
/** 飛びだしてから 着水まで（名目の ms。距離の 札）。 */
const SPLASH: Readonly<Record<TorijinKind, number>> = {
	short: 500,
	low: 8800,
	high: 9600,
	mid: 8800,
	last: 27300,
};
/** 最後の 機が 台へ もどる 区切りの 長さ。 */
const BACK_MS = TORIJIN_LAST.chaku - TORIJIN_LAST.back;

// ───────────────── 部品 ─────────────────

/** 生中継／録画の 札（スクリーンの 左上）。 */
const liveTag = (g: G, c: C) => {
	const s = c.live ? TORIJIN_ART.live : TORIJIN_ART.rec;
	g.fillStyle = c.live ? "#d83030" : "#505860";
	g.fillRect(2, 2, s.length * 8 + 4, 11);
	text(g, s, 4, 3, 8, "#ffffff", { align: "left" });
};

const cloud = (g: G, x: number, y: number, w: number) => {
	g.fillStyle = "#ffffff";
	g.fillRect(x, y + 2, w * 2, 3);
	g.fillRect(x + 2, y, w, 3);
	g.fillRect(x + w, y + 1, w - 1, 2);
};

/** 夏の 湖（空・雲・向こう岸の 山・水・きらめき）。scroll は 横の 進み（px）。 */
const lake = (g: G, c: C, hz: number, scroll = 0) => {
	bands(g, c.W, SKY, 0, hz);
	const span = c.W + 40;
	for (let i = 0; i < 4; i++) {
		const off = (c.still ? 0 : c.t * 0.002) + scroll * 0.2;
		const x = ((((i * 53 - off) % span) + span) % span) - 20;
		cloud(g, Math.round(x), 6 + (i % 2) * 9, 6 + (i % 3) * 2);
	}
	for (let x = 0; x < c.W; x += 2) {
		const wx = x + scroll * 0.1;
		const h = 5 + Math.round(3 * Math.sin(wx / 19) + 2 * Math.sin(wx / 7));
		g.fillStyle = "#6a9ac0";
		g.fillRect(x, hz - h, 2, h);
		g.fillStyle = "#4f86a8";
		g.fillRect(x, hz - Math.max(1, h - 4), 2, Math.max(1, h - 4));
	}
	bands(g, c.W, WATER, hz, c.H - hz);
	const k = Math.floor(c.now / 300);
	g.fillStyle = "#e8f6ff";
	for (let i = 0; i < 12; i++) {
		if (!c.still && hash(i, k, 3) > 0.55) continue;
		const x = (((hash(i, 1) * c.W - scroll * 0.8) % c.W) + c.W) % c.W;
		const y = hz + 3 + Math.floor(hash(i, 2) * (c.H - hz - 6));
		g.fillRect(Math.round(x), y, 3, 1);
	}
};

/** 桟橋の 客と うちわ（x0〜x1。hot は 大きく あおぐ）。 */
const fans = (g: G, c: C, x0: number, x1: number, y: number, hot: boolean) => {
	g.fillStyle = "#8a5a34";
	g.fillRect(x0 - 4, y + 10, x1 - x0 + 8, 3);
	const n = Math.max(1, Math.floor((x1 - x0) / 12));
	for (let i = 0; i < n; i++) {
		const x = x0 + i * 12 + (i % 2) * 2;
		g.fillStyle = "#1a1410";
		g.fillRect(x + 1, y, 6, 6);
		g.fillRect(x, y + 6, 8, 4);
		const bob = c.still
			? 0
			: Math.round(
					Math.sin(c.now / (hot ? 110 : 240) + i * 1.3) * (hot ? 3 : 1.5),
				);
		const fx = x + 8;
		const fy = y - 4 + bob;
		g.fillStyle = "#8a6a40";
		g.fillRect(fx + 1, fy + 4, 1, 4);
		g.fillStyle = FANS[i % FANS.length];
		g.fillRect(fx - 1, fy, 5, 4);
		g.fillRect(fx, fy - 1, 3, 6);
	}
};

/** 発進台（木の 床と 白い 足場。x0 から 幅 w、床の 高さ deck、足は bottom まで、足の 間 step）。 */
const platform = (
	g: G,
	x0: number,
	deck: number,
	bottom: number,
	w: number,
	step: number,
) => {
	for (let x = x0 + 2; x < x0 + w - 1; x += step) {
		g.fillStyle = "#e8ecf0";
		g.fillRect(x, deck + 3, 2, bottom - deck - 3);
		g.fillStyle = "#b8c0c8";
		const h = bottom - deck - 3;
		for (let i = 0; i < h; i += 1) {
			const dx = Math.round(((i % (step * 2)) / (step * 2)) * step);
			if (x + 2 + dx < x0 + w) g.fillRect(x + 2 + dx, deck + 3 + i, 1, 1);
		}
	}
	g.fillStyle = "#d8d2c4";
	g.fillRect(x0, deck, w, 2);
	g.fillStyle = "#a89c88";
	g.fillRect(x0, deck + 2, w, 1);
	g.fillStyle = "#f4f4f0";
	for (let x = x0 + 1; x < x0 + w; x += 6) g.fillRect(x, deck - 3, 1, 3);
	g.fillRect(x0, deck - 3, w, 1);
};

/**
 * 人力機（ななめ 横から。長い 主翼・まんなかの ポッド・前の プロペラ・うしろの 尾）。
 * s は 向き（1 右向き・−1 左向き）、flex は 翼の そり、k は 大きさ（整数の 倍）。
 */
const plane = (
	g: G,
	c: C,
	x: number,
	y: number,
	ink: string,
	s = 1,
	flex = 2,
	k = 1,
) => {
	const R = (lx: number, ly: number, w: number, h: number, col: string) => {
		g.fillStyle = col;
		g.fillRect(
			Math.round(s > 0 ? x + lx * k : x - (lx + w) * k),
			Math.round(y + ly * k),
			w * k,
			h * k,
		);
	};
	R(-24, 4, 20, 1, "#c8ccd4");
	R(-27, -1, 3, 6, ink);
	R(-29, 3, 7, 1, "#f8f8f4");
	R(1, -2, 1, 4, "#8a96a8");
	for (let i = 0; i <= 56; i++) {
		const e = (i - 28) / 28;
		const ly = -Math.round((i * 6) / 56) - Math.round(e * e * flex);
		R(-28 + i, ly, 1, 2, "#f8f8f4");
		R(-28 + i, ly + 2, 1, 1, "#9aa6bc");
	}
	R(-4, 2, 11, 5, ink);
	R(2, 3, 4, 2, "#cfeaff");
	R(3, 3, 1, 1, "#2a2a36");
	R(7, 4, 1, 1, "#404040");
	if (c.still) R(8, 1, 1, 7, "rgba(230, 224, 208, 0.5)");
	else {
		const L = [7, 4, 1][Math.floor(c.t / 70) % 3] ?? 7;
		R(8, 4 - Math.floor(L / 2), 1, L, "#e8e0d0");
	}
};

/** 着水の しぶき（ms は 着水からの 名目の 時）。 */
const splash = (g: G, c: C, x: number, y: number, ms: number) => {
	if (ms < 0) return;
	g.fillStyle = "#e8f4ff";
	const r = Math.round(6 + Math.min(ms, 3000) * 0.006);
	g.fillRect(x - r - 3, y + 2, 4, 1);
	g.fillRect(x + r, y + 2, 4, 1);
	g.fillRect(x - r - 9, y + 4, 3, 1);
	g.fillRect(x + r + 7, y + 4, 3, 1);
	if (c.still || ms > 1300) return;
	g.fillStyle = "#ffffff";
	for (let i = 0; i < 14; i++) {
		const vx = (hash(i, 3) - 0.5) * 0.09;
		const vy = -(0.05 + hash(i, 4) * 0.07);
		const py = y + vy * ms + 0.00011 * ms * ms;
		if (py > y + 2) continue;
		g.fillRect(Math.round(x + vx * ms), Math.round(py), 2, 1);
	}
};

/** 空の 場面の 機体の 大きさと、水に つく ときの 高さ（ポッドの 下が 少し しずむ）。 */
const K = 2;
const ON_WATER = SURF + 3 - 7 * K;

/** 浮いた 機体（ポッドの 下を 水に しずめ、まわりに 波紋）。 */
const floating = (g: G, c: C, x: number, ink: string, s = 1) => {
	plane(g, c, x, ON_WATER, ink, s, 0, K);
	g.fillStyle = WATER[3];
	g.fillRect(x - 12 * K, SURF + 2, 24 * K, 3);
	g.fillStyle = "#cfe8ff";
	const w = c.still ? 0 : Math.round(Math.sin(c.now / 400) * 2);
	g.fillRect(x - 14 * K - w, SURF + 2, 6, 1);
	g.fillRect(x + 12 * K + w, SURF + 2, 6, 1);
};

/** 距離の 札（スクリーンの 右上）。 */
const distTag = (g: G, c: C, v: number, unit: string) => {
	const s = `${TORIJIN_ART.dist}　${recText(v, unit)}`;
	g.fillStyle = "rgba(10, 20, 40, 0.7)";
	g.fillRect(c.W - 70, 2, 68, 11);
	text(g, s, c.W - 4, 3, 8, "#ffffff", { align: "right" });
};

// ───────────────── 札 ─────────────────

const drawCard = (g: G, c: C) => {
	const end = c.data.phase === "end";
	bands(g, c.W, end ? SUNSET : SKY, 0, 66);
	g.fillStyle = end ? "#ffd890" : "#fff6c0";
	g.fillRect(end ? 120 : 140, end ? 58 : 10, end ? 22 : 14, end ? 8 : 14);
	bands(g, c.W, end ? ["#2e3a6a", "#24305a"] : WATER, 66, c.H - 66);
	if (end) {
		g.fillStyle = "#e8a060";
		for (let i = 0; i < 4; i++)
			g.fillRect(122 + (i % 2) * 4, 68 + i * 5, 18 - i * 4, 1);
		plane(g, c, 56, SURF - 4, "#141428", 1, 0);
	}
	const a = c.still ? 1 : clamp01(c.lt / 600);
	g.globalAlpha = a;
	text(g, c.data.card ?? TORIJIN_ART.logo, c.W / 2, 36, 10, "#ffffff", {
		outline: "#1a2a4a",
	});
	g.globalAlpha = 1;
};

// ───────────────── オープニング ─────────────────

const drawOp = (g: G, c: C) => {
	lake(g, c, 48);
	platform(g, 116, 40, 78, 34, 8);
	g.fillStyle = "#f8f8f4";
	g.fillRect(122, 35, 22, 1);
	g.fillStyle = INK.last;
	g.fillRect(131, 36, 4, 2);
	// ボートが 2そう
	for (let i = 0; i < 2; i++) {
		const bx = Math.round(
			30 + i * 46 + (c.still ? 0 : Math.sin(c.t / 1500 + i) * 3),
		);
		g.fillStyle = "#ffffff";
		g.fillRect(bx, 66 + i * 4, 10, 2);
		g.fillStyle = "#d84040";
		g.fillRect(bx + 2, 64 + i * 4, 4, 2);
	}
	fans(g, c, 8, c.W - 8, 86, false);
	if (c.lt >= 800 || c.still) {
		text(g, TORIJIN_ART.logo, c.W / 2, 10, 16, "#ffffff", {
			outline: "#1a3a6a",
		});
		text(g, TORIJIN_ART.lake, c.W / 2, 30, 8, "#ffffff", {
			outline: "#1a3a6a",
		});
	}
	liveTag(g, c);
};

// ───────────────── 発進台（山場） ─────────────────

const drawDai = (g: G, c: C) => {
	const d = c.data;
	const kind = d.kind ?? "mid";
	const ink = INK[kind];
	const since = c.t - (d.launch ?? Number.POSITIVE_INFINITY);
	const cue = d.phase === "cue";
	const gone = cue && since >= 0;
	lake(g, c, 34);
	platform(g, -4, 54, c.H, 96, 14);
	// チームの 幕
	g.fillStyle = "#ffffff";
	g.fillRect(4, 62, 82, 12);
	g.fillStyle = ink;
	g.fillRect(4, 62, 82, 1);
	g.fillRect(4, 73, 82, 1);
	text(g, d.team ?? "", 45, 64, 8, "#1a2a4a");
	// 桟橋の 客（スタートで 大きく あおぐ）
	fans(g, c, 108, c.W - 4, 84, gone);
	// 押さえる 人・旗の 人
	const up = gone ? 1 : 0;
	person(g, 18, 42 - up, "#ffffff", "#2a2020");
	person(g, 32, 42 - up, ink, "#3a2a1a");
	person(g, 82, 42, "#f0d040", "#2a2020");
	g.fillStyle = "#6a5a4a";
	g.fillRect(89, 28, 1, 16);
	const lit = c.still
		? c.pulses.length > 0
		: c.pulses.some((p) => c.now - p >= 0 && c.now - p < 320);
	g.fillStyle = "#ffffff";
	if (lit || gone) g.fillRect(90, 28, 9, 6);
	else g.fillRect(90, 37, 3, 6);
	// 機体（ちょうどで 台を けり、床の はしを 出ると 少し 下がる）
	let px = 54;
	let py = 44;
	if (gone) {
		px += since * 0.035;
		const over = Math.max(0, px - 92);
		py += over * over * (kind === "short" ? 0.02 : 0.003);
	}
	plane(g, c, Math.round(px), Math.round(py), ink, 1, gone ? 2 : 0);
	// 何機目
	if (!cue) {
		const s = TORIJIN_ART.nth.replace("{n}", String(d.no ?? 1));
		g.fillStyle = "rgba(10, 20, 40, 0.7)";
		g.fillRect(c.W - 44, 2, 42, 11);
		text(g, s, c.W - 23, 3, 8, "#ffffff");
	}
	if (!cue) return liveTag(g, c);
	// 合図：数字 3 → 2 → 1、合図の 点、ちょうどで「スタート！」
	const n = Math.min(3, c.pulses.length);
	const glow = pulseGlow(c, 300);
	if (!gone && n > 0) {
		const s = String(4 - n);
		g.fillStyle = `rgba(10, 20, 40, ${(0.6 + 0.3 * glow).toFixed(2)})`;
		g.fillRect(c.W - 32, 4, 28, 30);
		num(
			g,
			s,
			c.W - 18 - numW(s, 4) / 2,
			9,
			4,
			glow > 0 ? "#ffe060" : "#ffffff",
		);
	}
	for (let i = 0; i < 3; i++) {
		g.fillStyle = i < n ? "#ffe060" : "#3a4a7a";
		g.fillRect(c.W / 2 - 14 + i * 12, c.H - 10, 6, 6);
	}
	if (gone && since < 1800) {
		const a = c.still ? 1 : 1 - clamp01((since - 1200) / 600);
		g.globalAlpha = a;
		text(g, TORIJIN_ART.start, c.W / 2 + 20, 8, 16, "#ffe060", {
			outline: "#7a2a10",
		});
		g.globalAlpha = 1;
	}
	liveTag(g, c);
};

// ───────────────── 空（飛ぶ 機体を 追う） ─────────────────

/** 折りかえしの ブイ（赤白の 柱と 札）。 */
const pylon = (g: G, x: number, y: number) => {
	for (let i = 0; i < 5; i++) {
		g.fillStyle = i % 2 ? "#ffffff" : "#e03030";
		g.fillRect(x, y + i * 3, 4, 3);
	}
	g.fillStyle = "#ffd24a";
	g.fillRect(x - 2, y + 15, 8, 2);
	text(g, TORIJIN_ART.turn, x + 2, y + 19, 8, "#ffffff", {
		outline: "#1a3a6a",
	});
};

const drawSora = (g: G, c: C) => {
	const d = c.data;
	const kind = d.kind ?? "mid";
	const ink = INK[kind];
	const tau = c.t - (d.launch ?? 0);
	const phase = d.phase ?? "fly";
	const last = kind === "last";
	// 着水の 時（名目の ms。区切りの 頭から）
	const fall = kind === "high" ? 2000 : 1200;
	const sink = phase === "chaku" ? Math.max(0, c.lt - fall) : 0;
	const v = 0.05;
	let scroll = v * (tau - sink);
	if (phase === "turn" || phase === "back" || (phase === "chaku" && last))
		scroll = 0;
	if (phase === "back") scroll = -v * c.lt;
	lake(g, c, 40, scroll);
	// 距離の ブイ（流れて いく）
	for (let i = 0; i < 4; i++) {
		const span = c.W + 40;
		const x = ((((i * 52 - scroll) % span) + span) % span) - 20;
		g.fillStyle = "#ff8a20";
		g.fillRect(Math.round(x), SURF + 2, 3, 3);
		g.fillStyle = "#ffffff";
		g.fillRect(Math.round(x) + 1, SURF, 1, 2);
	}
	const dist = (ms: number) => clamp01(ms / SPLASH[kind]) * (d.rec ?? 0);
	// 下がって 水に つく（y0 から ON_WATER まで ms かけて）
	const fallTo = (x: number, y0: number, ms: number, s: number) => {
		const p = clamp01(c.lt / ms);
		if (p < 1)
			plane(g, c, x, Math.round(y0 + (ON_WATER - y0) * p * p), ink, s, 1, K);
		else floating(g, c, x, ink, s);
		splash(g, c, x, SURF, c.lt - ms);
		// 着水の テロップ（1.6秒）
		if (p >= 1 && c.lt - ms < 1600)
			text(g, TORIJIN_ART.chaku, c.W / 2, 22, 12, "#ffffff", {
				outline: "#1a3a6a",
			});
	};
	if (kind === "short") {
		// 台を 出て すぐ：左に 台、目の 前で 着水
		platform(g, -60, 50, c.H, 80, 14);
		if (phase === "fly") fallTo(70, 50, 300, 1);
		else floating(g, c, 70, ink);
		distTag(g, c, d.rec ?? 0, d.unit ?? "m");
		return liveTag(g, c);
	}
	if (phase === "turn") {
		// 折りかえしの ブイ：遠くへ 行って 小さく なり、ブイの 先で 向きを かえて もどる
		const p = clamp01(c.lt / 7000);
		const far = Math.sin(Math.PI * p);
		pylon(g, 150, 34);
		const k = p > 0.3 && p < 0.7 ? 1 : K;
		const [x, y] = [Math.round(76 + 44 * far), Math.round(40 - 14 * far)];
		plane(g, c, x, y, ink, p < 0.5 ? 1 : -1, 2, k);
		distTag(g, c, dist(tau), d.unit ?? "km");
		return liveTag(g, c);
	}
	if (phase === "back" || (last && phase === "chaku")) {
		// 台へ もどる：左から 台と 桟橋が 近づく
		const p = phase === "back" ? clamp01(c.lt / BACK_MS) : 1;
		const px = Math.round(-90 + 100 * p);
		platform(g, px, 46, c.H, 70, 12);
		if (px > -60) fans(g, c, Math.max(4, px + 4), px + 66, 88, true);
		if (phase === "back") {
			const y = Math.round(42 + 8 * p + Math.sin(c.t / 900) * 1.5);
			plane(g, c, 110, y, ink, -1, 2, K);
		} else fallTo(110, 50, 1200, -1);
		distTag(g, c, dist(tau), d.unit ?? "km");
		return liveTag(g, c);
	}
	// 飛ぶ（飛びかたで 高さが かわる）・着水
	const x = 76;
	const y0 = { low: ON_WATER - 5, high: 22, mid: 40, last: 40, short: 50 }[
		kind
	];
	let y = 40 + Math.sin(tau / 900) * 2;
	if (kind === "low") y = y0 + Math.sin(tau / 300);
	if (kind === "high") y = 50 - 28 * clamp01((tau - 1000) / 5000);
	if (kind === "mid")
		y = 46 - 6 * clamp01(tau / 3000) + Math.sin(tau / 900) * 2;
	if (phase === "chaku") fallTo(x, y0, fall, 1);
	else {
		// 水に うつる 影
		g.fillStyle = "rgba(20, 50, 100, 0.35)";
		g.fillRect(x - 12 * K, SURF + 4, 24 * K, 2);
		plane(g, c, x, Math.round(y), ink, 1, 2, K);
		if (kind === "low" && !c.still) {
			g.fillStyle = "#ffffff";
			for (let i = 0; i < 5; i++) {
				const j = (Math.floor(c.t / 90) + i) % 5;
				g.fillRect(x - 12 - j * 8, SURF + 1 - (j % 2), 2, 1);
			}
		}
	}
	distTag(g, c, dist(tau), d.unit ?? "m");
	liveTag(g, c);
};

// ───────────────── 記録 ─────────────────

const drawKiroku = (g: G, c: C) => {
	const d = c.data;
	const last = d.kind === "last";
	lake(g, c, 52);
	g.fillStyle = "#e8eef8";
	g.fillRect(17, 9, 146, 58);
	g.fillStyle = "#14285a";
	g.fillRect(18, 10, 144, 56);
	text(g, d.team ?? "", c.W / 2, 14, 8, "#ffffff");
	text(g, TORIJIN_ART.kiroku, 46, 38, 8, "#ffe060");
	const p = c.still ? 1 : clamp01(c.lt / (last ? 2000 : 1000));
	const s = recText((d.rec ?? 0) * p, d.unit ?? "m");
	text(g, s, 116, 32, 16, p >= 1 ? "#ffffff" : "#a8c0e8");
	fans(g, c, 8, c.W - 8, 84, last);
	if (!last || (c.lt < 2200 && !c.still)) return liveTag(g, c);
	// 大会記録の 判（押して 少し はねる）と 紙ふぶき
	const k = c.still ? 1 : 1 + 0.5 * (1 - clamp01((c.lt - 2200) / 250));
	g.save();
	g.translate(c.W / 2, 74);
	g.rotate(-0.12);
	g.scale(k, k);
	g.fillStyle = "#ffffff";
	g.fillRect(-36, -9, 72, 18);
	g.fillStyle = "#e02030";
	g.fillRect(-36, -9, 72, 2);
	g.fillRect(-36, 7, 72, 2);
	text(g, TORIJIN_ART.taikai, 0, -6, 12, "#e02030");
	g.restore();
	if (c.still) return liveTag(g, c);
	for (let i = 0; i < 24; i++) {
		const y = (hash(i, 7) * c.H + c.t * (0.02 + hash(i, 8) * 0.02)) % c.H;
		const x = hash(i, 9) * c.W + Math.sin(c.now / 300 + i) * 3;
		g.fillStyle = FANS[i % FANS.length];
		g.fillRect(Math.round(x), Math.round(y), 2, 2);
	}
	liveTag(g, c);
};

// ───────────────── 風待ち ─────────────────

const drawKaze = (g: G, c: C) => {
	lake(g, c, 46, c.still ? 0 : c.t * 0.04);
	platform(g, 118, 38, 70, 40, 8);
	// 白波
	g.fillStyle = "#e8f4ff";
	for (let i = 0; i < 14; i++) {
		const x = (hash(i, 5) * c.W + (c.still ? 0 : c.t * 0.05)) % c.W;
		g.fillRect(Math.round(x), 52 + Math.floor(hash(i, 6) * 44), 4, 1);
	}
	// 吹き流し（はためく）
	g.fillStyle = "#6a5a4a";
	g.fillRect(28, 18, 2, c.H - 18);
	for (let k = 0; k < 5; k++) {
		const dy = c.still ? 0 : Math.round(Math.sin(c.now / 120 + k) * 1.5);
		g.fillStyle = k % 2 ? "#ffffff" : "#e03030";
		g.fillRect(
			30 + k * 7,
			19 + dy + Math.floor(k / 2),
			7,
			6 - Math.floor(k / 2),
		);
	}
	g.fillStyle = "#d83030";
	g.fillRect(c.W - 44, 2, 42, 11);
	text(g, TORIJIN_ART.stop, c.W - 23, 3, 8, "#ffffff");
	text(g, TORIJIN_ART.kaze, c.W / 2, 28, 12, "#ffffff", { outline: "#1a3a6a" });
	liveTag(g, c);
};

// ───────────────── 枠（海の家の 壁の テレビ） ─────────────────

const drawFrame = (g: G, c: C) => {
	crtFrame.draw(g, c);
	// 左の 壁の うちわ
	g.fillStyle = "#8a6a40";
	g.fillRect(11, 44, 2, 12);
	g.fillStyle = "#6ac8ff";
	g.fillRect(6, 32, 12, 12);
	g.fillRect(8, 30, 8, 16);
	g.fillStyle = "#ffffff";
	g.fillRect(9, 35, 6, 1);
	g.fillRect(9, 38, 6, 1);
	// 右の すみの 風鈴（短冊が ゆれる）
	g.fillStyle = "#c8c0a8";
	g.fillRect(226, 6, 1, 6);
	g.fillStyle = "rgba(190, 230, 255, 0.85)";
	g.fillRect(223, 12, 7, 5);
	const sway = c.still ? 0 : Math.round(Math.sin(c.now / 500) * 1.5);
	g.fillStyle = "#e04848";
	g.fillRect(226 + sway, 18, 2, 8);
};

export const torijinTv = makeTv<TorijinData>({
	screen: crtFrame.screen,
	frame: drawFrame,
	noCaption: ["card"],
	scenes: {
		card: drawCard,
		op: drawOp,
		dai: drawDai,
		sora: drawSora,
		kiroku: drawKiroku,
		kaze: drawKaze,
	},
});
