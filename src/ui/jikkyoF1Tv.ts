// 保守グランプリの TV（ui/jikkyoWatch.ts の 板の 上の キャンバス）。整備工場の 事務所の テレビ（crtFrame）。
// 形は ui/jikkyoTvKit.ts（480x270 の 2倍の 下地に 240x135 の 座標。スクリーンは 180x104）。
// - 場面（data/jikkyo/f1.ts の F1_SCENES）：札（まもなく・おわり）・グリッド（上から）・スタート（赤い 灯 5つ。山場）・
//   レース（横から。周回と 順位の 札・雨・団子から ばらける・審議・前の 2台の 抜きあい）・ピット（雨雲の レーダーと 板）・
//   セーフティカー（部品を 拾う マーシャル）・チェッカー（ふられる 旗。もう 1つの 凝った 絵）・表彰台。
// - 車は 塗り（番号と 単色の 車体）。絵に 出す 文は F1_ART・F1_CARS。
// - 進みは 名目の 時計（c.lt・c.t）、点滅だけ 実際の 時計（c.now）。動きを へらす 設定（still）では 背景の 流れ・点滅・旗の ゆれを 止める。
// - 再放送は テレビの ふちに「再放送」の 札。

import { F1_ART, F1_CARS, type F1Data, f1Car } from "../data/jikkyo/f1";
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
	type SceneFn,
	type TvCtx,
	text,
} from "./jikkyoTvKit";

type C = TvCtx<F1Data>;

const wrap = (v: number, m: number) => ((v % m) + m) % m;
const ease = (p: number) => p * p * (3 - 2 * p);
/** 塗りの 四角（色・x・y・幅・高さ）。 */
const box = (g: G, ink: string, x: number, y: number, w: number, h: number) => {
	g.fillStyle = ink;
	g.fillRect(x, y, w, h);
};
const WHITE = "#f4f4f4";
const INK = "#101014";
const TIRE = "#16161a";
const ASPHALT = "#4a4a52";
const WET = "#34363e";
const GRASS = "#3a7a3a";
const YELLOW = "#ffe060";
const CONFETTI = [YELLOW, "#ff6a5a", "#5ac8ff", "#7ae08a", "#ffffff"];

// ───────────────── 車 ─────────────────

/** 横から（右向き。22x8）。番号は 上に。 */
const carSide = (g: G, x: number, y: number, no: number, tag = true) => {
	const k = f1Car(no);
	for (const [dx, dy, w, h] of [
		[0, 0, 4, 2],
		[2, 2, 1, 2],
		[5, 2, 9, 2],
		[3, 4, 19, 2],
		[18, 6, 4, 1],
	])
		box(g, k.body, x + dx, y + dy, w, h);
	box(g, k.dark, x + 5, y + 5, 9, 1);
	box(g, WHITE, x + 10, y + 1, 2, 2);
	for (const wx of [1, 14]) {
		box(g, TIRE, x + wx, y + 3, 4, 5);
		box(g, "#6a6a72", x + wx + 1, y + 5, 2, 1);
	}
	const s = String(no);
	if (tag) num(g, s, x + 9 - numW(s, 1) / 2, y - 7, 1, WHITE);
};

/** 上から（上向き。8x14）。 */
const carTop = (g: G, x: number, y: number, no: number) => {
	const k = f1Car(no);
	box(g, k.body, x, y, 8, 1);
	box(g, k.body, x + 3, y + 1, 2, 4);
	box(g, k.body, x + 2, y + 5, 4, 7);
	box(g, k.body, x + 1, y + 13, 6, 1);
	box(g, k.dark, x + 1, y + 7, 6, 3);
	box(g, WHITE, x + 3, y + 6, 2, 2);
	for (const [dx, dy, h] of [
		[0, 2, 3],
		[6, 2, 3],
		[-1, 9, 4],
		[7, 9, 4],
	])
		box(g, TIRE, x + dx, y + dy, 2, h);
};

/** うしろから（12x7 × s）。 */
const carRear = (g: G, x: number, y: number, no: number, s: number) => {
	const k = f1Car(no);
	const r = (ink: string, dx: number, dy: number, w: number, h: number) =>
		box(g, ink, x + dx * s, y + dy * s, w * s, h * s);
	r(k.body, 3, 2, 6, 4);
	r(WHITE, 4, 1, 4, 1);
	r(k.body, 0, 0, 12, 2);
	r(k.dark, 0, 0, 1, 3);
	r(k.dark, 11, 0, 1, 3);
	r(TIRE, 0, 3, 3, 4);
	r(TIRE, 9, 3, 3, 4);
	r("#ff3030", 5, 5, 2, 1);
};

// ───────────────── 背景 ─────────────────

const skyOf = (rain: number) =>
	rain === 2
		? ["#4a5260", "#58606e", "#666e7c"]
		: rain === 1
			? ["#6a7a92", "#7a8aa2", "#8c9ab0"]
			: ["#4a9ae0", "#62aee8", "#82c2f0"];

/** 観客席（off で 流れる）。 */
const stands = (g: G, c: C, y: number, h: number, off: number) => {
	box(g, "#3a3a46", 0, y, c.W, h);
	box(g, "#24242e", 0, y, c.W, 3);
	for (let i = 0; i < 64; i++) {
		const x = Math.floor(wrap(i * 13 + hash(i, 3) * 9 - off, c.W + 12)) - 6;
		const ink = CONFETTI[Math.floor(hash(i, 4) * CONFETTI.length)];
		box(g, ink, x, y + 5 + (i % 4) * 3, 2, 2);
	}
};

/** 赤白の 縁石。 */
const kerb = (g: G, c: C, y: number, off: number) => {
	for (let x = -Math.floor(wrap(off, 16)); x < c.W; x += 16) {
		box(g, "#d83a30", x, y, 8, 3);
		box(g, WHITE, x + 8, y, 8, 3);
	}
};

/** 横から 見た コース（空・観客席・村の 店の 看板・縁石・路面）。 */
const trackSide = (g: G, c: C, rain: number, speed: number) => {
	const off = c.still ? 0 : c.t * speed;
	bands(g, c.W, skyOf(rain), 0, 24);
	stands(g, c, 18, 20, off * 0.3);
	F1_ART.ads.forEach((ad, i) => {
		const x = Math.floor(wrap(i * 66 - off * 0.6, 198)) - 9;
		box(g, ["#1a3a8a", "#8a1a2a", "#1a6a4a"][i], x, 39, 60, 10);
		text(g, ad, x + 30, 40, 8, WHITE);
	});
	kerb(g, c, 50, off);
	box(g, rain ? WET : ASPHALT, 0, 53, c.W, 35);
	for (let i = 0; rain && i < 6; i++) {
		const x = Math.floor(wrap(i * 37 - off, c.W + 30)) - 15;
		box(g, "rgba(200, 210, 230, 0.12)", x, 56 + i * 5, 24, 1);
	}
	for (let x = -Math.floor(wrap(off, 24)); x < c.W; x += 24)
		box(g, WHITE, x, 70, 12, 1);
	kerb(g, c, 88, off);
	box(g, GRASS, 0, 91, c.W, c.H - 91);
};

const rainDrops = (g: G, c: C, rain: number) => {
	const t = c.still ? 0 : c.t;
	for (let i = 0; i < (rain === 2 ? 48 : rain ? 16 : 0); i++) {
		const x = Math.floor(wrap(hash(i, 1, 7) * c.W - t * 0.05, c.W));
		const y = Math.floor(wrap(hash(i, 2, 7) * c.H + t * 0.22, c.H));
		box(g, "rgba(210, 220, 240, 0.6)", x, y, 1, rain === 2 ? 4 : 3);
	}
};

/** 雨の しぶき（車の うしろ）。 */
const spray = (g: G, c: C, x: number, y: number, rain: number) => {
	if (!rain) return;
	const f = c.still ? 0 : Math.floor(c.now / 90) % 2;
	const ink = `rgba(220, 224, 236, ${rain === 2 ? 0.45 : 0.25})`;
	box(g, ink, x - 12 - f * 2, y + 2, 13 + f * 2, 5);
	box(g, ink, x - 20, y + 3, 8, 3);
};

/** 周回の 札（左上）と 順位の 札（右上）。 */
const hud = (g: G, c: C, lap: number, order: readonly number[]) => {
	box(g, "rgba(0, 0, 0, 0.6)", 2, 2, 44, 11);
	const s = `${F1_ART.lap} ${lap}/${F1_ART.laps}`;
	const ink = lap >= F1_ART.laps ? YELLOW : WHITE;
	text(g, s, 5, 3, 8, ink, { align: "left" });
	order.slice(0, 3).forEach((no, i) => {
		const y = 2 + i * 8;
		box(g, "rgba(0, 0, 0, 0.6)", c.W - 24, y, 22, 7);
		num(g, String(i + 1), c.W - 22, y + 1, 1, YELLOW);
		box(g, f1Car(no).body, c.W - 17, y + 1, 2, 5);
		num(g, String(no), c.W - 13, y + 1, 1, WHITE);
	});
};

// ───────────────── 札 ─────────────────

const drawCard: SceneFn<F1Data> = (g, c) => {
	box(g, "#0c0c12", 0, 0, c.W, c.H);
	for (let r = 0; r < 2; r++)
		for (let x = 0; x * 6 < c.W; x++)
			box(g, (x + r) % 2 ? INK : WHITE, x * 6, 4 + r * 6, 6, 6);
	g.globalAlpha = c.still ? 1 : clamp01(c.lt / 600);
	text(g, F1_ART.logo, c.W / 2, 24, 16, WHITE, { outline: "#c02020" });
	if (c.data.phase === "soon") {
		box(g, c.live ? "#c02020" : "#5a5a62", c.W / 2 - 18, 45, 36, 11);
		text(g, c.live ? F1_ART.sub : F1_ART.rerun, c.W / 2, 46, 8, WHITE);
		// 小さな 赤い 灯（1つずつ つく）
		const k = c.still ? 5 : Math.floor(c.now / 400) % 6;
		for (let i = 0; i < 5; i++)
			box(g, i < k ? "#ff3030" : "#3a1414", c.W / 2 - 28 + i * 12, 62, 8, 8);
	} else text(g, c.data.card ?? "", c.W / 2, 56, 8, "#a8a8b0");
	g.globalAlpha = 1;
};

// ───────────────── グリッド ─────────────────

const SLOTS = [
	[68, 10],
	[104, 22],
	[68, 36],
	[104, 48],
	[68, 62],
] as const;

const drawGrid: SceneFn<F1Data> = (g, c) => {
	box(g, GRASS, 0, 0, c.W, c.H);
	box(g, ASPHALT, 24, 0, 132, c.H);
	for (let y = 0; y < c.H; y += 8) {
		const ink = (y / 8) % 2 ? WHITE : "#d83a30";
		box(g, ink, 20, y, 4, 8);
		box(g, ink, 156, y, 4, 8);
	}
	box(g, WHITE, 24, 5, 132, 1);
	F1_CARS.forEach((car, i) => {
		const [sx, sy] = SLOTS[i];
		box(g, WHITE, sx - 3, sy - 2, 14, 1);
		box(g, WHITE, sx - 3, sy - 2, 1, 4);
		box(g, WHITE, sx + 10, sy - 2, 1, 4);
		carTop(g, sx, sy, car.no);
		const s = String(car.no);
		num(g, s, sx - 6 - numW(s, 1), sy + 5, 1, WHITE);
		// 整備の 人（グリッドを はなれる）
		const leave = c.still ? 0 : Math.max(0, c.lt - 5000) * 0.03;
		const side = i % 2 ? 1 : -1;
		const px = Math.round(sx + (side > 0 ? 14 : -16) + side * leave);
		if (px > 0 && px < c.W - 6) person(g, px, sy + 1, car.dark, "#2a2020");
	});
};

// ───────────────── スタート（山場） ─────────────────

/** スタートの 並び（うしろから。番号・x・y・大きさ・発進の 速さ）。 */
const LINE = [
	[1, 62, 46, 1, 1],
	[7, 104, 50, 1, 1.3],
	[5, 34, 60, 2, 0.95],
	[3, 114, 68, 2, 0.9],
] as const;
/** 奥の 消える 点（コースの 先）。 */
const HORIZON = 43;
const VP = 90;

const drawStart: SceneFn<F1Data> = (g, c) => {
	// 灯が 消えた あとの 区切りは 横から（1コーナーへ。ageが 次スレを 抜く）
	if (c.data.phase === "go") {
		drawRace(g, {
			...c,
			data: { lap: 1, rain: 0, order: [1, 7, 5, 3, 10], event: "start" },
		});
		return;
	}
	const exact = c.data.exact ?? Number.POSITIVE_INFINITY;
	const since = c.t - exact;
	const beat = 1000;
	bands(g, c.W, skyOf(0), 0, 30);
	stands(g, c, 26, 16, 0);
	box(g, ASPHALT, 0, 42, c.W, c.H - 42);
	for (const [, x, y, s] of LINE)
		box(g, WHITE, x - 2, y + 7 * s + 1, 12 * s + 4, 1);
	// 車（灯が 消えたら 奥へ。小さく なって 消える 点へ。ageが いちばん 速い）
	for (const [no, x, y, s, v] of LINE) {
		const f = since > 0 ? Math.exp(-((since / 1000) ** 1.5) * 1.1 * v) : 1;
		const cx = Math.round(VP + (x + 6 * s - VP) * f);
		const cy = Math.round(HORIZON + (y - HORIZON) * f);
		const ss = s * f;
		const k = ss >= 1.4 ? 2 : 1;
		if (ss >= 0.7) carRear(g, cx - 6 * k, cy, no, k);
		else if (ss > 0.3) box(g, f1Car(no).body, cx - 2, cy, 4, 2);
		else box(g, f1Car(no).body, cx - 1, cy, 2, 1);
		if (!c.still && since > 0 && since < 900) {
			const ink = `rgba(240, 240, 240, ${(0.6 * (1 - since / 900)).toFixed(2)})`;
			box(g, ink, x - 3 * s, y + 6 * s, 6 * s, 3 * s);
			box(g, ink, x + 9 * s, y + 6 * s, 6 * s, 3 * s);
		}
	}
	// 門と 赤い 灯（1つめ・2つめは 合図の 前の 拍、3つめから 合図、ちょうどで ぜんぶ 消える）
	box(g, "#1c1c22", 24, 6, 132, 4);
	box(g, "#1c1c22", 28, 6, 3, 38);
	box(g, "#1c1c22", 149, 6, 3, 38);
	const nominal = Math.floor((c.t - (exact - 5 * beat)) / beat) + 1;
	const byPulse = c.data.phase === "cue" ? 2 + c.pulses.length : 0;
	const lit =
		since >= 0 ? 0 : Math.max(0, Math.min(5, Math.max(nominal, byPulse)));
	const glow = pulseGlow(c);
	for (let i = 0; i < 5; i++) {
		const bx = 47 + i * 18;
		const on = i < lit;
		box(g, "#0c0c10", bx, 4, 14, 22);
		if (on && i === lit - 1 && glow > 0)
			box(
				g,
				`rgba(255, 60, 40, ${(0.35 * glow).toFixed(3)})`,
				bx - 3,
				1,
				20,
				28,
			);
		for (const ly of [6, 15]) {
			box(g, on ? "#ff2a20" : "#3a1212", bx + 3, ly, 8, 8);
			if (on) box(g, "#ffb0a0", bx + 4, ly + 1, 2, 2);
		}
	}
};

// ───────────────── レース（横から） ─────────────────

const LANE = [60, 74] as const;

const drawRace: SceneFn<F1Data> = (g, c) => {
	const d = c.data;
	const rain = d.rain ?? 0;
	const order = d.order ?? F1_CARS.map((k) => k.no);
	trackSide(g, c, rain, 0.12);
	const wob = (i: number) =>
		c.still ? 0 : Math.round(Math.sin(c.t / 900 + i * 1.7) * 3);
	const cars: [number, number, number][] = [];
	const duel = d.event === "start" || d.event === "pass" || d.event === "hold";
	// 前の 2台の 抜きあい（2位が 並びかけて 抜く か、もどる か）
	const [def, atk] = order;
	const passed = d.event !== "hold" && duel && c.lt >= 1500;
	if (duel) {
		const e = ease(clamp01(c.lt / 2600));
		const dx =
			d.event === "hold" ? -26 + 20 * Math.sin(Math.PI * e) : -26 + 56 * e;
		cars.push(
			[order[2], 28 + wob(2), LANE[0]],
			[def, 108, LANE[0]],
			[atk, Math.round(108 + dx), LANE[1]],
		);
	} else {
		const gap = d.event === "restart" ? 12 + 16 * clamp01(c.lt / 6000) : 28;
		order.forEach((no, r) => {
			cars.push([no, Math.round(126 - r * gap) + wob(r), LANE[r % 2]]);
		});
	}
	for (const [no, x, y] of cars) {
		spray(g, c, x, y, rain);
		carSide(g, x, y, no);
	}
	rainDrops(g, c, rain);
	hud(g, c, d.lap ?? 1, passed ? [atk, def, ...order.slice(2)] : order);
	if (d.event === "shingi") {
		const done = c.lt >= (d.decideAt ?? Number.POSITIVE_INFINITY);
		const car = cars.find(([no]) => no === 5);
		if (car && !done && (c.still || Math.floor(c.now / 400) % 2 === 0)) {
			g.strokeStyle = YELLOW;
			g.lineWidth = 1;
			g.strokeRect(car[1] - 2.5, car[2] - 9.5, 27, 19);
		}
		box(g, "rgba(0, 0, 0, 0.7)", c.W / 2 - 34, 3, 68, 13);
		const s = done ? F1_ART.clear : F1_ART.shingi;
		text(g, s, c.W / 2, 5, 8, done ? "#7ae08a" : YELLOW);
	}
};

// ───────────────── ピット（雨雲の レーダー） ─────────────────

const radar = (g: G, rain: number) => {
	const x = 124;
	const y = 3;
	const heavy = rain === 2;
	box(g, "#101a14", x - 1, y - 1, 52, 42);
	box(g, "#24402c", x, y, 50, 40);
	for (let i = 8; i < 50; i += 10) box(g, "#2e5038", x + i, y, 1, 40);
	g.strokeStyle = "#d8d8d0";
	g.lineWidth = 1;
	g.strokeRect(x + 12.5, y + 12.5, 22, 12);
	// 雲（大雨は 広く 濃い、まんなかが 黄色）
	for (let i = 0; i < (heavy ? 26 : 8); i++) {
		const cx = x + 8 + Math.floor(hash(i, 5) * (heavy ? 34 : 18));
		const cy = y + 11 + Math.floor(hash(i, 6) * (heavy ? 16 : 10));
		const ink = heavy ? (i % 4 === 0 ? YELLOW : "#3a70e0") : "#7ab0f0";
		box(g, ink, cx, cy, 4, 4);
	}
	text(g, F1_ART.radar, x + 2, y + 1, 8, WHITE, { align: "left" });
	box(g, "rgba(0, 0, 0, 0.6)", x + 26, y + 29, 23, 10);
	const s = heavy ? F1_ART.heavy : F1_ART.light;
	text(g, s, x + 37, y + 30, 8, heavy ? YELLOW : "#a8d8ff");
};

const drawPit: SceneFn<F1Data> = (g, c) => {
	const d = c.data;
	const rain = d.rain ?? 1;
	const heavy = rain === 2;
	const k = f1Car(7);
	// ガレージの 壁と 中の 灯
	box(g, "#2a2a32", 0, 0, c.W, 52);
	box(g, "#4a4a56", 14, 12, 96, 40);
	box(g, k.body, 0, 6, c.W, 3);
	for (let x = 20; x < 108; x += 22) box(g, "#e8e0c0", x, 14, 10, 2);
	// ピットの 路面と 枠・タイヤ（インターは 緑の すじ）
	box(g, rain ? WET : ASPHALT, 0, 52, c.W, 39);
	box(g, "#ffd040", 40, 56, 1, 30);
	box(g, "#ffd040", 84, 56, 1, 30);
	box(g, "#ffd040", 40, 56, 45, 1);
	box(g, WHITE, 0, 88, c.W, 1);
	for (let i = 0; i < 4; i++) {
		box(g, TIRE, 18 + i * 7, 44, 6, 8);
		box(g, "#3ac05a", 18 + i * 7, 47, 6, 1);
	}
	// 車：大雨は 入って 止まり、小雨は そのまま 通りすぎる
	const t = c.lt - (d.decideAt ?? Number.POSITIVE_INFINITY);
	const stop = (u: number) =>
		u < 1200
			? -24 + 76 * ease(u / 1200)
			: u < 4200
				? 52
				: 52 + (u - 4200) * 0.12;
	const cx = t < 0 ? -40 : Math.round(heavy ? stop(t) : -24 + t * 0.06);
	carSide(g, cx, heavy ? 66 : 78, 7, false);
	// 整備の 人（大雨で 止まったら タイヤへ）
	const work = heavy && t >= 1200 && t < 4200;
	for (let i = 0; i < 4; i++) {
		const px = work ? 50 + (i % 2) * 19 : 44 + i * 10;
		const py = work ? 62 + Math.floor(i / 2) * 12 : 58;
		const bob = work && !c.still && Math.floor(c.now / 150 + i) % 2 ? 1 : 0;
		person(g, px, py - bob, k.dark, "#1a1a1a");
	}
	// 板（判断の あと）
	if (t >= 0) {
		box(g, INK, 96, 60, 26, 12);
		box(g, "#8a8a92", 108, 72, 2, 10);
		const s = heavy ? F1_ART.box : F1_ART.stay;
		text(g, s, 109, 62, 8, heavy ? YELLOW : WHITE);
	}
	radar(g, rain);
	rainDrops(g, c, rain);
	hud(g, c, d.lap ?? 20, []);
};

// ───────────────── セーフティカー ─────────────────

const drawSc: SceneFn<F1Data> = (g, c) => {
	const d = c.data;
	const rain = d.rain ?? 1;
	trackSide(g, c, rain, 0.04);
	// 部品を 拾う マーシャル（ゆっくり うしろへ）
	const mx = Math.round(176 - c.lt * 0.012);
	const got = c.lt >= 3000;
	box(g, "#6a6a72", got ? mx + 6 : mx - 4, got ? 48 : 56, 4, 2);
	person(g, mx, got ? 42 : 46, "#ff8a20", "#ff8a20");
	// SC（白い 車と 屋根の 灯）と その うしろの 列
	const sx = 132;
	box(g, "#e4e4ea", sx, 63, 22, 4);
	box(g, "#e4e4ea", sx + 5, 60, 10, 3);
	box(g, "#2a3a5a", sx + 7, 61, 6, 2);
	const blink = c.still ? 2 : Math.floor(c.now / 250) % 2;
	box(g, blink !== 1 ? "#ffb020" : "#5a3a10", sx + 6, 58, 3, 2);
	box(g, blink !== 0 ? "#ffb020" : "#5a3a10", sx + 11, 58, 3, 2);
	box(g, TIRE, sx + 2, 66, 4, 3);
	box(g, TIRE, sx + 16, 66, 4, 3);
	(d.order ?? []).forEach((no, r) => {
		spray(g, c, 104 - r * 25, 61, rain);
		carSide(g, 104 - r * 25, 61, no);
	});
	rainDrops(g, c, rain);
	hud(g, c, d.lap ?? 22, d.order ?? []);
	// 黄色い 旗の 札「SC」
	box(g, "#ffd020", 2, 15, 18, 11);
	text(g, F1_ART.sc, 11, 16, 8, INK);
};

// ───────────────── チェッカー（旗） ─────────────────

const drawChecker: SceneFn<F1Data> = (g, c) => {
	const win = c.data.win ?? 1;
	bands(g, c.W, skyOf(0), 0, 24);
	stands(g, c, 18, 22, 0);
	kerb(g, c, 43, 0);
	box(g, ASPHALT, 0, 46, c.W, 42);
	kerb(g, c, 88, 0);
	box(g, GRASS, 0, 91, c.W, c.H - 91);
	// ゴールの 線
	for (let y = 46; y < 88; y += 3)
		for (let x = 0; x < 2; x++)
			box(g, ((y - 46) / 3 + x) % 2 ? INK : WHITE, 128 + x * 3, y, 3, 3);
	// 勝った 車が 線を 越え、もう 1台が つづく
	carSide(g, Math.round(-24 + c.lt * 0.11), 56, win);
	carSide(g, Math.round(-24 + (c.lt - 450) * 0.11), 70, win === 1 ? 7 : 1);
	// ふられる 旗（列ごとに ゆれる）
	box(g, "#8a8a92", 20, 6, 2, 46);
	for (let col = 0; col < 10; col++) {
		const wave = Math.sin(c.t / 160 - col * 0.7) * 2 * (col / 9);
		const dy = c.still ? 0 : Math.round(wave);
		for (let row = 0; row < 6; row++)
			box(
				g,
				(col + row) % 2 ? INK : WHITE,
				22 + col * 5,
				6 + row * 5 + dy,
				5,
				5,
			);
	}
	person(g, 14, 50, "#ff8a20", "#2a2020");
	if (c.lt >= 1400) {
		const k = f1Car(win);
		box(g, "rgba(0, 0, 0, 0.55)", 78, 1, 94, 30);
		text(g, F1_ART.win, 124, 2, 16, k.body, { outline: INK });
		text(g, `#${k.no}　${k.team}`, 124, 21, 8, WHITE, { outline: INK });
	}
};

// ───────────────── 表彰台 ─────────────────

/** 台（まんなか 1位・左 2位・右 3位。x・y・幅）。 */
const STEPS = [
	[70, 56, 40],
	[30, 66, 40],
	[110, 72, 40],
] as const;

const drawPodium: SceneFn<F1Data> = (g, c) => {
	const win = c.data.win ?? 1;
	const top = [win, win === 1 ? 7 : 1, 5];
	bands(g, c.W, ["#101830", "#16224a", "#1e2e60"], 0, c.H);
	text(g, F1_ART.logo, c.W / 2, 4, 8, YELLOW);
	STEPS.forEach(([x, y, w], i) => {
		box(g, "#c8c8d0", x, y, w, 91 - y);
		box(g, "#e8e8f0", x, y, w, 2);
		num(g, String(i + 1), x + w / 2 - 3, y + 6, 2, "#5a5a66");
		// 人（2倍の 塗りの 人。チームの 色）
		g.save();
		g.translate(x + w / 2 - 6, y - 24);
		g.scale(2, 2);
		person(g, 0, 0, f1Car(top[i]).body, "#2a2020");
		g.restore();
	});
	// 1位の トロフィー（かかげる）
	const lift = c.still ? 0 : Math.round(clamp01((c.lt - 1500) / 600) * 4);
	if (c.lt >= 1500) {
		box(g, "#f0c040", 85, 22 - lift, 10, 6);
		box(g, "#f0c040", 88, 28 - lift, 4, 4);
		box(g, "#fff0a0", 86, 23 - lift, 2, 2);
	}
	// 紙ふぶき
	const t = c.still ? 0 : c.t;
	for (let i = 0; i < 36; i++) {
		const x = wrap(hash(i, 1, 3) * c.W + Math.sin(t / 500 + i) * 4, c.W);
		const y = wrap(hash(i, 2, 3) * c.H + t * 0.03, 92);
		box(g, CONFETTI[i % CONFETTI.length], Math.floor(x), Math.floor(y), 2, 2);
	}
};

/** 保守グランプリの TV。 */
export const f1Tv = makeTv<F1Data>({
	screen: crtFrame.screen,
	frame: (g, c) => {
		crtFrame.draw(g, c);
		if (!c.live) text(g, F1_ART.rerun, 160, 114, 8, "#c8c0a8");
	},
	scenes: {
		card: drawCard,
		grid: drawGrid,
		start: drawStart,
		race: drawRace,
		pit: drawPit,
		sc: drawSc,
		checker: drawChecker,
		podium: drawPodium,
	},
});
