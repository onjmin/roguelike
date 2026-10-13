// 湾岸ナイトラン の 板（決まりは data/arcade/home/wangan.ts）。
// - うしろから 見た キリコの 車。道は 5m の 区切りを 前から 奥へ 映して、行ごとに 色を ぬる（昔の 体感レースの やり方）。
//   道は 小さな キャンバス（240x150）の ImageData に 横の 帯で 塗り、2倍の 板へ drawImage で 写す。道の 外は 透かして 後ろの 海を 見せる。
// - 後ろの 絵（夜空・街の 灯・湾の 橋・海の 映りこみ）は はじめに 1回 描いて、曲がりに あわせて 横へ ずらす。
// - 街灯は 8区切りに 1本。灯の 下の 路面だけ 橙に 明るく なり、走ると 明暗が 流れる。トンネルの 中は 4区切りに 1つ。
// - 速いと 外へ 流れる 線、街灯の 光の 尾。壁に こすると 火花、ぶつけると ゆれる。
// - 十字キー：↑・A で アクセル（押しっぱなし。くり返しが 来るまで 長めに 持つ）、↓ で ブレーキ、←→ で ハンドル。
//   タップ：左 3分の1＝左へ 切る・右 3分の1＝右へ 切る（1回で 少しの あいだ）・まんなか＝アクセルの 入り切り。

import { DX, DY } from "../../../core/geom";
import {
	WN,
	WN_RIVALS,
	WN_TEXT,
	WN_TRACK,
	type WnState,
	wnScore,
	wnSeg,
	wnStart,
	wnStep,
} from "../../../data/arcade/home/wangan";
import { AH, AW } from "../../../data/arcade/logic";
import { ARCADE, ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import type { G } from "../../neta/netaBoard";
import { txt } from "../../neta/netaBoard";
import {
	burst,
	juice,
	juiceDraw,
	juiceStep,
	pop,
	quake,
	shaken,
} from "../arcadeJuice";
import { type ArcadeResult, hud, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

/** 景色の 大きさ・地平の 行・投影の 距離（px）・カメラの 高さと 車の うしろへの 距離（m）。 */
const VW = AW;
const VH = AH;
const HOR = 64;
const CX = VW / 2;
const D = 150;
const CAMH = 2.4;
const BACK = 5;
/** 映す 区切りの 数・曲がりの 強さ（1区切りあたりの 横の ずれの 増え）・トンネルの 天井と 入口の 高さ（m）。 */
const DRAW = 120;
const CURVE_K = 0.06;
const TUN_H = 6.5;
const FACE_H = 13;
/** 後ろの 絵の はば（くり返す）。 */
const BGW = 480;

const rgb = (hex: string): [number, number, number] => {
	const n = Number.parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** ImageData の 1画素（ABGR）。 */
const pack = (r: number, g: number, b: number): number =>
	((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
/** a と b を k で まぜて、さらに 霧へ f だけ 寄せる。 */
const tone = (a: string, b: string, k: number, f: number): number => {
	const A = rgb(a);
	const B = rgb(b);
	const F = rgb("#0a0c1c");
	const c = [0, 1, 2].map((i) => {
		const m = (A[i] ?? 0) + ((B[i] ?? 0) - (A[i] ?? 0)) * k;
		return Math.round(m + ((F[i] ?? 0) - m) * f);
	});
	return pack(c[0] ?? 0, c[1] ?? 0, c[2] ?? 0);
};

/** 決まった ゆらぎ（0〜1）。 */
const hash = (x: number, k = 0): number => {
	let h = Math.imul(x * 374761393 + k * 668265263, 1274126177);
	h = Math.imul(h ^ (h >>> 13), 1103515245);
	return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
};

const canvas = (
	w: number,
	h: number,
	fn: (g: G) => void,
): HTMLCanvasElement => {
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	const g = c.getContext("2d") as G;
	g.imageSmoothingEnabled = false;
	fn(g);
	return c;
};
const R = (g: G, c: string, x: number, y: number, w: number, h: number) => {
	g.fillStyle = c;
	g.fillRect(x, y, w, h);
};

// ---- 後ろの 絵（夜空・街・橋・海） ----

const makeBg = (): HTMLCanvasElement =>
	canvas(BGW, VH, (g) => {
		const sky = g.createLinearGradient(0, 0, 0, HOR);
		sky.addColorStop(0, "#04040e");
		sky.addColorStop(0.7, "#141238");
		sky.addColorStop(1, "#3a2450");
		g.fillStyle = sky;
		g.fillRect(0, 0, BGW, HOR);
		for (let i = 0; i < 70; i++)
			R(
				g,
				hash(i, 9) < 0.2 ? "#c8c8f0" : "#6a6a9a",
				Math.floor(hash(i, 1) * BGW),
				Math.floor(hash(i, 2) * (HOR - 26)),
				1,
				1,
			);
		// 月
		g.fillStyle = "#e8e4c8";
		g.beginPath();
		g.arc(70, 14, 6, 0, Math.PI * 2);
		g.fill();
		g.fillStyle = "#04040e";
		g.beginPath();
		g.arc(73, 12, 5, 0, Math.PI * 2);
		g.fill();
		// 海
		const sea = g.createLinearGradient(0, HOR, 0, VH);
		sea.addColorStop(0, "#141430");
		sea.addColorStop(1, "#04060e");
		g.fillStyle = sea;
		g.fillRect(0, HOR, BGW, VH - HOR);
		// 街（橋の あたりは 低く）
		const lights: [number, string][] = [];
		for (let x = 0; x < BGW; ) {
			const w = 6 + Math.floor(hash(x, 3) * 12);
			const bridge = x > 270 && x < 450;
			const h = bridge
				? 3 + Math.floor(hash(x, 4) * 5)
				: 6 + Math.floor(hash(x, 4) * hash(x, 5) * 30);
			R(g, hash(x, 6) < 0.5 ? "#0c0e22" : "#10132a", x, HOR - h, w, h);
			for (let wy = HOR - h + 2; wy < HOR - 1; wy += 3)
				for (let wx = x + 1; wx < x + w - 1; wx += 2) {
					const k = hash(wx * 31 + wy, 7);
					if (k < 0.18) {
						const ink = k < 0.05 ? "#a0c8ff" : "#f0c880";
						R(g, ink, wx, wy, 1, 1);
						if (k < 0.08) lights.push([wx, ink]);
					}
				}
			// 高い ビルの 赤い 灯
			if (h > 24) R(g, "#ff3030", x + Math.floor(w / 2), HOR - h - 1, 1, 1);
			x += w + (hash(x, 8) < 0.3 ? 2 : 0);
		}
		// 湾の 吊り橋（塔 2本・ケーブル・橋げたの 灯）
		const deck = HOR - 7;
		const t1 = 310;
		const t2 = 410;
		R(g, "#1a1c34", 270, deck, 180, 2);
		for (const tx of [t1, t2]) {
			R(g, "#1e2040", tx - 2, HOR - 40, 4, 40);
			R(g, "#1e2040", tx - 4, HOR - 30, 8, 1);
			R(g, "#ff3030", tx - 1, HOR - 42, 2, 2);
		}
		g.strokeStyle = "#5a5c90";
		g.lineWidth = 1;
		g.beginPath();
		g.moveTo(272, deck);
		g.quadraticCurveTo(295, deck - 14, t1, HOR - 39);
		g.quadraticCurveTo((t1 + t2) / 2, deck + 6, t2, HOR - 39);
		g.quadraticCurveTo(425, deck - 14, 448, deck);
		g.stroke();
		g.strokeStyle = "rgba(90,92,144,0.5)";
		for (let x = 276; x < 448; x += 6) {
			const u = (x - t1) / (t2 - t1);
			const cy =
				x < t1 || x > t2
					? deck - 10
					: HOR - 39 + (deck + 6 - (HOR - 39)) * 2 * u * (1 - u) * 1.6;
			g.beginPath();
			g.moveTo(x + 0.5, Math.min(cy, deck));
			g.lineTo(x + 0.5, deck);
			g.stroke();
		}
		for (let x = 272; x < 450; x += 4) R(g, "#ffb050", x, deck - 1, 1, 1);
		// 海の 映りこみ（灯の 下に ゆれる 線）
		for (const [wx, ink] of lights) {
			g.globalAlpha = 0.35;
			for (
				let y = HOR + 2;
				y < HOR + 30;
				y += 2 + Math.floor(hash(wx + y, 2) * 3)
			)
				R(g, ink, wx - 1 + Math.floor(hash(wx * 7 + y, 1) * 3), y, 2, 1);
		}
		g.globalAlpha = 0.5;
		for (let x = 272; x < 450; x += 4)
			for (let y = HOR + 1; y < HOR + 40; y += 3)
				if (hash(x * 13 + y, 4) < 0.4) R(g, "#ffb050", x, y, 2, 1);
		g.globalAlpha = 1;
	});

// ---- 車の 絵（うしろ姿） ----

const TRAFFIC_INK = [
	"#6a7080",
	"#8a3030",
	"#304a80",
	"#c8c8cc",
	"#405a40",
	"#7a6a50",
];

type CarArt = { img: HTMLCanvasElement; w: number; lights: number[][] };

/** 乗用車（sports は 低くて 羽根つき）。幅 48・高さ 28。 */
const sedan = (body: string, sports: boolean, hair = false): CarArt => {
	const lights = [
		[3, 14, 9, 3],
		[36, 14, 9, 3],
	];
	const img = canvas(48, 28, (g) => {
		const top = sports ? 8 : 3;
		R(g, "#000000", 0, 25, 48, 3); // 影
		R(g, "#101014", 4, 22, 9, 6); // 車輪
		R(g, "#101014", 35, 22, 9, 6);
		R(g, body, 9, top, 30, 12 - top + 2); // 屋根と 窓まわり
		R(g, "#141c2c", 11, top + 2, 26, 12 - top - 2); // うしろの 窓
		R(g, "rgba(160,190,255,0.35)", 12, top + 2, 10, 1);
		if (hair) {
			R(g, "#7a3a20", 19, top + 4, 10, 5); // 運転する キリコの 髪
			R(g, "#5a2810", 20, top + 8, 8, 2);
		}
		R(g, body, 2, 12, 44, 12); // 胴
		R(g, "rgba(255,255,255,0.18)", 2, 12, 44, 1);
		R(g, "rgba(0,0,0,0.35)", 2, 20, 44, 4); // バンパー
		R(g, "#c8c8b0", 19, 17, 10, 4); // 番号札
		for (const [x, y, w, h] of lights) R(g, "#801818", x, y, w, h);
		if (sports) {
			R(g, body, 4, 5, 40, 2); // 羽根
			R(g, "#101014", 8, 7, 2, 5);
			R(g, "#101014", 38, 7, 2, 5);
		}
	});
	return { img, w: 1.9, lights };
};

const van = (body: string): CarArt => {
	const lights = [
		[3, 15, 5, 5],
		[40, 15, 5, 5],
	];
	const img = canvas(48, 28, (g) => {
		R(g, "#000000", 0, 25, 48, 3);
		R(g, "#101014", 5, 22, 8, 6);
		R(g, "#101014", 35, 22, 8, 6);
		R(g, body, 3, 0, 42, 24);
		R(g, "#141c2c", 7, 2, 34, 9);
		R(g, "rgba(0,0,0,0.3)", 3, 20, 42, 4);
		R(g, "#c8c8b0", 19, 16, 10, 4);
		for (const [x, y, w, h] of lights) R(g, "#801818", x, y, w, h);
	});
	return { img, w: 2, lights };
};

const truck = (): CarArt => {
	const lights = [
		[2, 21, 5, 2],
		[41, 21, 5, 2],
	];
	const img = canvas(48, 34, (g) => {
		R(g, "#000000", 0, 31, 48, 3);
		R(g, "#101014", 4, 28, 10, 6);
		R(g, "#101014", 34, 28, 10, 6);
		R(g, "#b8b8be", 1, 0, 46, 27);
		R(g, "#8a8a92", 23, 1, 2, 25); // 扉の 合わせ目
		R(g, "#9a9aa2", 1, 0, 46, 2);
		R(g, "#30303a", 1, 23, 46, 4);
		R(g, "#e8a020", 4, 24, 40, 1); // 反射の 帯
		for (const [x, y, w, h] of lights) R(g, "#801818", x, y, w, h);
	});
	return { img, w: 2.4, lights };
};

/** キリコの 車（大きく 描く。0 まっすぐ・1 左・2 右）。 */
const playerArt = (): HTMLCanvasElement[] =>
	[0, -2, 2].map((lean) =>
		canvas(64, 34, (g) => {
			R(g, "rgba(0,0,0,0.6)", 2, 30, 60, 4);
			R(g, "#101014", 5, 25, 12, 9);
			R(g, "#101014", 47, 25, 12, 9);
			R(g, "#2c4890", 13 + lean, 5, 38, 12); // 屋根
			R(g, "#141c2c", 15 + lean, 7, 34, 9); // 窓
			R(g, "rgba(160,190,255,0.35)", 16 + lean, 7, 12, 1);
			R(g, "#7a3a20", 26 + lean, 9, 12, 6); // キリコの 髪
			R(g, "#5a2810", 27 + lean, 13, 10, 3);
			R(g, "#4060c0", 2, 15, 60, 14); // 胴
			R(g, "#6080e0", 2, 15, 60, 1);
			R(g, "#2c4890", 2, 25, 60, 4);
			R(g, "#4060c0", 6, 3, 52, 2); // 羽根
			R(g, "#202840", 10, 5, 2, 10);
			R(g, "#202840", 52, 5, 2, 10);
			R(g, "#c8c8b0", 26, 20, 12, 4);
			R(g, "#801818", 4, 17, 12, 4);
			R(g, "#801818", 48, 17, 12, 4);
			R(g, "#404048", 20, 29, 4, 2); // マフラー
			R(g, "#404048", 40, 29, 4, 2);
		}),
	);

// ---- 道の 色 ----

type Pal = {
	road: number;
	rumble: number;
	line: number;
	barrier: number;
	wall: number;
	ceil: number;
	lamp: number;
};

const FOG = 8;
const palCache = new Map<number, Pal>();
/** 霧の 段・灯の 強さ（0〜3）・帯（0・1）・トンネル。 */
const pal = (fog: number, light: number, band: number, tun: number): Pal => {
	const key = ((fog * 4 + light) * 2 + band) * 2 + tun;
	const hit = palCache.get(key);
	if (hit) return hit;
	const f = (fog / FOG) * 0.85;
	const k = [0, 0.18, 0.4, 0.62][light] ?? 0;
	const lampInk = "#ffa040";
	const p: Pal = {
		road: tone(band ? "#26262e" : "#2c2c35", lampInk, k * 0.55, f),
		rumble: tone(band ? "#a02828" : "#c8c8c8", lampInk, k * 0.3, f),
		line: tone("#c8c8c0", lampInk, k * 0.3, f),
		barrier: tone(band ? "#4a4a56" : "#585864", lampInk, k * 0.5, f),
		wall: tone(band ? "#4a3420" : "#563c24", "#f0a040", k * 0.7, f),
		ceil: tone(band ? "#1a1612" : "#201a14", "#a07030", k * 0.3, f),
		lamp: tone("#ffd080", "#ffffff", 0.3, f * 0.6),
	};
	palCache.set(key, p);
	return p;
};

/** 横の 帯を ぬる（行 r の a〜b）。 */
const span = (
	buf: Uint32Array,
	r: number,
	a: number,
	b: number,
	c: number,
): void => {
	const x0 = Math.max(0, Math.round(a));
	const x1 = Math.min(VW, Math.round(b));
	if (x1 > x0) buf.fill(c, r * VW + x0, r * VW + x1);
};

/** 映した 区切りの 線（前から 奥へ）。 */
type Lines = {
	x: Float32Array;
	y: Float32Array;
	w: Float32Array;
	cy: Float32Array;
	fy: Float32Array;
	xo: Float32Array;
	wy: Float32Array;
	clip: Float32Array;
};
const lines = (): Lines => ({
	x: new Float32Array(DRAW + 2),
	y: new Float32Array(DRAW + 2),
	w: new Float32Array(DRAW + 2),
	cy: new Float32Array(DRAW + 2),
	fy: new Float32Array(DRAW + 2),
	xo: new Float32Array(DRAW + 2),
	wy: new Float32Array(DRAW + 2),
	clip: new Float32Array(DRAW + 2),
});

type Cam = { base: number; frac: number; camX: number; camY: number };

const yAt = (n: number): number => WN_TRACK.y[wnSeg(n * WN.seg)] ?? 0;

/** 道を 画素に ぬる。後ろが 見える ところは 0（透明）の まま。 */
const render = (buf: Uint32Array, L: Lines, s: WnState, cam: Cam): void => {
	buf.fill(0);
	const T = WN_TRACK;
	const cz = s.z - BACK;
	const base = Math.floor(cz / WN.seg);
	const frac = cz / WN.seg - base;
	const camX = s.x * WN.roadW;
	const camY = yAt(base) + (yAt(base + 1) - yAt(base)) * frac + CAMH;
	Object.assign(cam, { base, frac, camX, camY });
	let xoff = 0;
	let dxs = -(T.curve[wnSeg(base * WN.seg)] ?? 0) * CURVE_K * frac;
	for (let i = 0; i <= DRAW + 1; i++) {
		const n = base + i;
		const dz = Math.max(0.6, (i - frac) * WN.seg);
		const sc = D / dz;
		const wy = yAt(n);
		L.xo[i] = xoff;
		L.wy[i] = wy;
		L.x[i] = CX + (xoff - camX) * sc;
		L.y[i] = HOR - (wy - camY) * sc;
		L.w[i] = WN.roadW * sc;
		L.cy[i] = HOR - (wy + TUN_H - camY) * sc;
		L.fy[i] = HOR - (wy + FACE_H - camY) * sc;
		xoff += dxs;
		dxs += (T.curve[wnSeg(n * WN.seg)] ?? 0) * CURVE_K;
	}
	// 道（前から 奥へ。前の 行に 隠れる ところは ぬらない）
	let maxy = VH;
	L.clip[0] = VH;
	for (let i = 1; i <= DRAW; i++) {
		const n = base + i - 1;
		const seg = wnSeg(n * WN.seg);
		const tun = T.tunnel[seg] ?? 0;
		const y0 = L.y[i] ?? 0;
		const y1 = L.y[i - 1] ?? 0;
		L.clip[i] = maxy;
		if (y0 >= maxy || y1 <= y0) continue;
		const fog = Math.min(FOG - 1, Math.floor((i / DRAW) * FOG * 1.1));
		const ph = tun ? ((n % 4) + 4) % 4 : ((n % 8) + 8) % 8;
		const near = Math.min(ph, (tun ? 4 : 8) - ph);
		const light = tun ? ([3, 2, 1][near] ?? 1) : ([3, 2, 1][near] ?? 0);
		const band = Math.floor(n / 3) & 1;
		const p = pal(fog, light, band, tun);
		const dash = (n & 3) < 2;
		const r0 = Math.max(0, Math.ceil(y0));
		const r1 = Math.min(maxy, Math.ceil(y1));
		const ax = L.x[i] ?? 0;
		const bx = L.x[i - 1] ?? 0;
		const aw = L.w[i] ?? 0;
		const bw = L.w[i - 1] ?? 0;
		for (let r = r0; r < r1; r++) {
			const t = (r + 0.5 - y0) / (y1 - y0);
			const cx = ax + (bx - ax) * t;
			const hw = aw + (bw - aw) * t;
			if (tun) {
				span(buf, r, 0, VW, p.wall);
				if (light === 3) {
					span(buf, r, cx - hw * 1.6, cx - hw * 1.22, p.lamp);
					span(buf, r, cx + hw * 1.22, cx + hw * 1.6, p.lamp);
				}
			}
			span(buf, r, cx - hw * 1.18, cx + hw * 1.18, p.barrier);
			span(buf, r, cx - hw * 1.07, cx + hw * 1.07, p.rumble);
			span(buf, r, cx - hw, cx + hw, p.road);
			const lw = Math.max(0.6, hw * 0.018);
			span(buf, r, cx - hw * 0.93 - lw, cx - hw * 0.93 + lw, p.line);
			span(buf, r, cx + hw * 0.93 - lw, cx + hw * 0.93 + lw, p.line);
			if (dash) {
				span(buf, r, cx - hw * 0.32 - lw, cx - hw * 0.32 + lw, p.line);
				span(buf, r, cx + hw * 0.32 - lw, cx + hw * 0.32 + lw, p.line);
			}
		}
		maxy = Math.min(maxy, r0);
	}
	// トンネルの 天井と 入口（前から 奥へ。上は 前の 天井が 隠す）
	let top = 0;
	for (let i = 1; i <= DRAW; i++) {
		const n = base + i - 1;
		const seg = wnSeg(n * WN.seg);
		if (!T.tunnel[seg]) continue;
		const roadTop = Math.ceil(L.y[i] ?? 0);
		const c0 = Math.ceil(L.cy[i - 1] ?? 0);
		const c1 = Math.min(Math.ceil(L.cy[i] ?? 0), roadTop, VH);
		const fog = Math.min(FOG - 1, Math.floor((i / DRAW) * FOG * 1.1));
		const ph = ((n % 4) + 4) % 4;
		const p = pal(fog, ph === 0 ? 3 : 1, Math.floor(n / 3) & 1, 1);
		const prevTun = T.tunnel[wnSeg((n - 1) * WN.seg)];
		if (!prevTun && i > 1) {
			// 入口の 顔（コンクリートの 壁）
			const f0 = Math.max(top, Math.ceil(L.fy[i - 1] ?? 0));
			const fc = pal(fog, 0, 0, 0).barrier;
			for (let r = Math.max(0, f0); r < Math.min(c0, VH); r++)
				span(buf, r, 0, VW, fc);
		}
		const ax = L.x[i] ?? 0;
		const bx = L.x[i - 1] ?? 0;
		const aw = L.w[i] ?? 0;
		const bw = L.w[i - 1] ?? 0;
		const cyA = L.cy[i] ?? 0;
		const cyB = L.cy[i - 1] ?? 0;
		for (let r = Math.max(top, c0, 0); r < c1; r++) {
			span(buf, r, 0, VW, p.ceil);
			if (ph === 0) {
				const t = cyA === cyB ? 0 : (r + 0.5 - cyA) / (cyB - cyA);
				const cx = ax + (bx - ax) * t;
				const hw = aw + (bw - aw) * t;
				span(buf, r, cx - hw * 0.1, cx + hw * 0.1, p.lamp);
			}
		}
		top = Math.max(top, c1);
		// 奥まで トンネルが 続く ときは 先を 暗く
		if (i === DRAW)
			for (let r = Math.max(0, c1); r < Math.min(roadTop, VH); r++)
				span(buf, r, 0, VW, p.ceil);
	}
};

/** 区切り i（小数）の 位置の 道の 上の 点（横は x、高さは h m）。sc は 1m の px。 */
const at = (
	L: Lines,
	cam: Cam,
	dz: number,
	x: number,
	h = 0,
): { sx: number; sy: number; sc: number; i: number } | null => {
	if (dz < 1 || dz > DRAW * WN.seg) return null;
	const fi = dz / WN.seg + cam.frac;
	const i = Math.floor(fi);
	const t = fi - i;
	const xo = (L.xo[i] ?? 0) + ((L.xo[i + 1] ?? 0) - (L.xo[i] ?? 0)) * t;
	const wy = (L.wy[i] ?? 0) + ((L.wy[i + 1] ?? 0) - (L.wy[i] ?? 0)) * t;
	const sc = D / dz;
	return {
		sx: CX + (xo + x - cam.camX) * sc,
		sy: HOR - (wy + h - cam.camY) * sc,
		sc,
		i,
	};
};

const drawCar = (
	g: G,
	art: CarArt,
	sx: number,
	sy: number,
	sc: number,
	brake: boolean,
): void => {
	const w = art.w * sc;
	if (w < 3) {
		g.fillStyle = brake ? "#ff4040" : "#c02020";
		g.fillRect(Math.round(sx - 1), Math.round(sy - 1), 1, 1);
		g.fillRect(Math.round(sx + 1), Math.round(sy - 1), 1, 1);
		return;
	}
	const k = w / art.img.width;
	const h = art.img.height * k;
	const x = Math.round(sx - w / 2);
	const y = Math.round(sy - h);
	g.drawImage(art.img, x, y, Math.round(w), Math.round(h));
	// 尾灯（夜は いつも 点く。ブレーキで 強く）
	g.fillStyle = brake ? "#ff6050" : "#e02828";
	for (const [lx = 0, ly = 0, lw = 1, lh = 1] of art.lights)
		g.fillRect(
			Math.round(x + lx * k),
			Math.round(y + ly * k),
			Math.max(1, Math.round(lw * k)),
			Math.max(1, Math.round(lh * k)),
		);
	if (w > 10) {
		g.fillStyle = brake ? "rgba(255,60,40,0.35)" : "rgba(255,40,40,0.18)";
		for (const [lx = 0, ly = 0, lw = 1, lh = 1] of art.lights)
			g.fillRect(
				Math.round(x + (lx - 2) * k),
				Math.round(y + (ly - 2) * k),
				Math.round((lw + 4) * k),
				Math.round((lh + 4) * k),
			);
	}
};

export const playWangan = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	const j = juice();
	const bg = makeBg();
	const view = document.createElement("canvas");
	view.width = VW;
	view.height = VH;
	const vg = view.getContext("2d") as G;
	const img = vg.createImageData(VW, VH);
	const buf = new Uint32Array(img.data.buffer);
	const L = lines();
	const cam: Cam = { base: 0, frac: 0, camX: 0, camY: 0 };
	const traffic = TRAFFIC_INK.map((ink) => [
		sedan(ink, false),
		van(ink),
		truck(),
	]);
	const rivalArt = [
		sedan("#e8e8ec", false),
		sedan("#18181e", true),
		sedan("#2a2458", true),
	];
	const me = playerArt();
	// 押して いる もの（キーの くり返し・タップで のばす）
	let gasT = 0;
	let brakeT = 0;
	let steer = 0;
	let steerT = 0;
	let latch = false;
	let lean = 0;
	let bgX = 0;
	let braking = false;
	let gassing = false;
	let scrapeN = 0;
	/** あとで 出す 字と のこり 秒。 */
	let later: [string, number] | null = null;
	return playBoard(ctx, "wangan", {
		note: WN_TEXT.note,
		start: () => {
			const s = wnStart(rnd);
			if (import.meta.env.DEV)
				(window as unknown as { __wangan: WnState }).__wangan = s;
			return s;
		},
		step: (s, f) => {
			juiceStep(j, f.dt);
			for (const e of f.evs) {
				if ("k" in e) {
					// はじめの 1回は くり返しが 来るまで 長めに 持つ
					const h = e.repeat ? 0.16 : 0.55;
					if (e.k === "a" || e.k === "up") gasT = h;
					else if (e.k === "down") brakeT = h;
					else if (e.k === "left" || e.k === "right") {
						steer = e.k === "left" ? -1 : 1;
						steerT = e.repeat ? 0.12 : 0.2;
					}
				} else if (isTap(e)) {
					const x = e.tap[0];
					if (x < AW / 3) [steer, steerT] = [-1, 0.28];
					else if (x > (AW * 2) / 3) [steer, steerT] = [1, 0.28];
					else latch = !latch;
				}
			}
			gasT = Math.max(0, gasT - f.dt);
			brakeT = Math.max(0, brakeT - f.dt);
			steerT = Math.max(0, steerT - f.dt);
			let st = steerT > 0 ? steer : 0;
			let gas = gasT > 0 || latch;
			let brake = brakeT > 0;
			const hd = ctx.input.heldDir();
			if (hd !== null) {
				if (DX[hd]) st = DX[hd] ?? 0;
				if (DY[hd] === -1) gas = true;
				if (DY[hd] === 1) brake = true;
			}
			if (brake) {
				gas = false;
				latch = false;
			}
			braking = brake;
			gassing = gas;
			lean += (st - lean) * Math.min(1, f.dt * 10);
			const curve = WN_TRACK.curve[wnSeg(s.z)] ?? 0;
			bgX += curve * s.v * f.dt * 0.03 - st * s.v * f.dt * 0.004;
			const ri = s.ri;
			for (const e of wnStep(s, f.dt, { gas, brake, steer: st }, rnd)) {
				if (e === "crash") {
					f.se("arcCrash");
					f.say(WN_TEXT.crash);
					quake(j, 4);
					j.flash = 0.15;
					burst(j, CX, VH - 24, "#ff9040", 14, 80);
				} else if (e === "scrape") {
					if (scrapeN++ % 3 === 0) f.se("hit_steel");
					const side = Math.sign(s.x);
					burst(j, CX + side * 30, VH - 14, "#ffd060", 5, 70);
					quake(j, 1);
				} else if (e === "slip") {
					f.se("rustproof");
					f.say(WN_TEXT.slip);
				} else if (e === "overtake") {
					f.se("cursor");
					pop(j, CX, VH - 44, `+${WN.overtake}`, "#80c0ff");
				} else if (e === "beat") {
					f.se("levelup");
					const R0 = WN_RIVALS[ri];
					if (R0) f.say(WN_TEXT.beat.replace("{name}", R0.name));
					pop(j, CX, 50, `+${1000 * (ri + 1)}`);
					j.flash = 0.2;
				} else if (e === "rival") {
					f.se("encounter");
					const R1 = WN_RIVALS[s.ri];
					if (R1) later = [WN_TEXT.ahead.replace("{name}", R1.name), 1.6];
				} else if (e === "extend") {
					const n = WN_RIVALS[s.ri]?.extend ?? 0;
					pop(j, CX, 36, WN_TEXT.extend.replace("{n}", String(n)), "#80ff80");
				} else if (e === "clear") f.say(WN_TEXT.clear);
				else if (e === "timeup") f.say(WN_TEXT.timeup);
			}
			if (later) {
				later[1] -= f.dt;
				if (later[1] <= 0) {
					f.say(later[0]);
					later = null;
				}
			}
			if (s.t < f.dt * 1.5 && s.ri === 0) {
				const R0 = WN_RIVALS[0];
				if (R0) f.say(WN_TEXT.ahead.replace("{name}", R0.name));
			}
		},
		draw: (g, s, clock) => {
			shaken(g, j, () => {
				// 後ろ（くり返す）
				const ox = -(((Math.round(bgX) % BGW) + BGW) % BGW);
				g.drawImage(bg, ox, 0);
				g.drawImage(bg, ox + BGW, 0);
				render(buf, L, s, cam);
				vg.putImageData(img, 0, 0);
				g.drawImage(view, 0, 0);
				// 街灯と 車（奥から）
				type Spr = { dz: number; fn: () => void };
				const sprs: Spr[] = [];
				const fast = s.v / WN.vmax;
				for (let i = DRAW; i >= 1; i--) {
					const n = cam.base + i;
					if (((n % 8) + 8) % 8 !== 0) continue;
					if (WN_TRACK.tunnel[wnSeg(n * WN.seg)]) continue;
					const dz = (i - cam.frac) * WN.seg;
					for (const side of [-1, 1]) {
						const p = at(L, cam, dz, side * WN.roadW * 1.3);
						if (!p) continue;
						sprs.push({
							dz,
							fn: () => {
								if (p.sy > (L.clip[p.i] ?? VH) + 2) return;
								const top = p.sy - 10 * p.sc;
								const pw = Math.max(1, 0.3 * p.sc);
								g.fillStyle = "#30303c";
								g.fillRect(
									Math.round(p.sx - pw / 2),
									Math.round(top),
									Math.round(pw),
									Math.round(p.sy - top),
								);
								const hx = p.sx - side * 2.2 * p.sc;
								g.fillRect(
									Math.round(Math.min(hx, p.sx)),
									Math.round(top),
									Math.round(Math.abs(hx - p.sx)),
									Math.max(1, Math.round(0.25 * p.sc)),
								);
								// 光の 尾（速いと 外へ 流れる）
								if (fast > 0.5 && p.sc > 0.4) {
									const k = (fast - 0.5) * 0.5;
									g.strokeStyle = "rgba(255,180,80,0.35)";
									g.lineWidth = Math.max(1, 0.5 * p.sc);
									g.beginPath();
									g.moveTo(hx, top);
									g.lineTo(hx + (hx - CX) * k, top + (top - HOR) * k);
									g.stroke();
								}
								const r = Math.max(1, Math.min(3, 1.6 * p.sc));
								g.fillStyle = "rgba(255,170,60,0.22)";
								g.beginPath();
								g.arc(hx, top + 0.5, r * 2, 0, Math.PI * 2);
								g.fill();
								g.fillStyle = "#ffd080";
								g.fillRect(
									Math.round(hx - r / 2),
									Math.round(top),
									Math.max(1, Math.round(r)),
									Math.max(1, Math.round(r / 2)),
								);
							},
						});
					}
				}
				for (const c of s.cars) {
					const dz = c.z - (s.z - BACK);
					const p = at(L, cam, dz, c.x * WN.roadW);
					const art = traffic[c.ink % traffic.length]?.[c.kind];
					if (!p || !art) continue;
					sprs.push({
						dz,
						fn: () => {
							if (p.sy > (L.clip[p.i] ?? VH) + 3) return;
							drawCar(g, art, p.sx, p.sy, p.sc, false);
						},
					});
				}
				const r = s.rival;
				if (r) {
					const dz = r.z - (s.z - BACK);
					const p = at(L, cam, dz, r.x * WN.roadW);
					const art = rivalArt[s.ri];
					if (p && art)
						sprs.push({
							dz,
							fn: () => {
								if (s.ri === 2 && p.sc > 0.3) {
									// 主の 青い 下の 灯
									g.fillStyle = "rgba(80,120,255,0.35)";
									g.fillRect(
										Math.round(p.sx - 1.2 * p.sc),
										Math.round(p.sy - 0.2 * p.sc),
										Math.round(2.4 * p.sc),
										Math.max(1, Math.round(0.4 * p.sc)),
									);
								}
								drawCar(g, art, p.sx, p.sy, p.sc, r.braking);
								// 目じるし（赤い 三角）
								if (Math.floor(clock * 4) % 2 === 0) {
									const top = Math.round(p.sy - 1.6 * p.sc - 6);
									g.fillStyle = "#ff4060";
									g.fillRect(Math.round(p.sx) - 2, top, 5, 1);
									g.fillRect(Math.round(p.sx) - 1, top + 1, 3, 1);
									g.fillRect(Math.round(p.sx), top + 2, 1, 1);
								}
							},
						});
				}
				sprs.sort((a, b) => b.dz - a.dz);
				for (const sp of sprs) sp.fn();
				// 速さの 線
				if (fast > 0.55) {
					const n = Math.floor((fast - 0.55) * 30) + (s.slip >= 0.5 ? 6 : 0);
					g.strokeStyle =
						s.slip >= 0.5 ? "rgba(160,200,255,0.4)" : "rgba(255,255,255,0.22)";
					g.lineWidth = 1;
					g.beginPath();
					for (let i = 0; i < n; i++) {
						const a = Math.random() * Math.PI * 2;
						const r0 = 70 + Math.random() * 40;
						const r1 = r0 + 20 + fast * 40;
						const ca = Math.cos(a);
						const sa = Math.sin(a) * 0.6;
						g.moveTo(CX + ca * r0, HOR + sa * r0);
						g.lineTo(CX + ca * r1, HOR + sa * r1);
					}
					g.stroke();
				}
				// キリコの 車
				const fi = lean < -0.3 ? 1 : lean > 0.3 ? 2 : 0;
				const bob = s.v > 20 && Math.random() < fast * 0.4 ? 1 : 0;
				const px = Math.round(CX - 32 + lean * 3);
				const py = VH - 36 + bob + (s.crashT > 0.35 ? 1 : 0);
				const art = me[fi];
				if (art) g.drawImage(art, px, py);
				g.fillStyle = braking ? "#ff5040" : "#d02020";
				g.fillRect(px + 4, py + 17, 12, 4);
				g.fillRect(px + 48, py + 17, 12, 4);
				if (braking) {
					g.fillStyle = "rgba(255,60,40,0.3)";
					g.fillRect(px + 1, py + 14, 18, 10);
					g.fillRect(px + 45, py + 14, 18, 10);
				}
				if (gassing && Math.floor(clock * 20) % 2 === 0) {
					g.fillStyle = "rgba(120,160,255,0.7)";
					g.fillRect(px + 21, py + 31, 2, 2);
					g.fillRect(px + 41, py + 31, 2, 2);
				}
				juiceDraw(g, j, AW, AH);
			});
			// 帯
			const t = Math.ceil(s.time);
			hud(g, `${ARCADE_BOARD.score} ${wnScore(s)}`, "");
			txt(
				g,
				`${ARCADE_BOARD.time} ${t}`,
				AW - 4,
				3,
				8,
				t <= 10 && Math.floor(clock * 4) % 2 === 0 ? "#ff6060" : "#e8e8f0",
				"right",
			);
			const R = WN_RIVALS[s.ri];
			if (R && s.rival) {
				const d = Math.max(0, Math.round(s.rival.z - s.z));
				g.fillStyle = "rgba(0,0,0,0.5)";
				g.fillRect(0, 14, 128, 11);
				txt(
					g,
					`${s.ri + 1}/${WN_RIVALS.length} ${R.short}　${WN_TEXT.to}　${d}m`,
					4,
					16,
					7,
					s.ri === 2 ? "#c0a0ff" : "#f0f0f0",
				);
			}
			// 速さ（右下）
			const kmh = Math.round(s.v * 3.6);
			g.fillStyle = "rgba(0,0,0,0.5)";
			g.fillRect(AW - 46, AH - 26, 46, 26);
			const seg = Math.round((s.v / (WN.vmax * WN.slipBoost)) * 10);
			for (let i = 0; i < 10; i++) {
				g.fillStyle =
					i < seg
						? i >= 8
							? "#ff5050"
							: i >= 6
								? "#ffb040"
								: "#60e0a0"
						: "#2a2a36";
				g.fillRect(AW - 43 + i * 4, AH - 24, 3, 3);
			}
			txt(g, String(kmh), AW - 18, AH - 19, 12, "#f0f0f0", "right");
			txt(g, WN_TEXT.kmh, AW - 3, AH - 14, 6, "#a0a0c0", "right");
			if (s.slip >= 0.5)
				txt(
					g,
					"SLIP",
					4,
					AH - 12,
					8,
					Math.floor(clock * 8) % 2 ? "#80c0ff" : "#ffffff",
				);
			else if (latch) txt(g, "A", 4, AH - 12, 8, "#60e0a0");
		},
		over: (s) => s.over,
		score: wnScore,
		end: (s) => (s.clear ? ARCADE.clear : ARCADE.over),
	});
};
