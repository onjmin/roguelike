// 映画館「スクリーン1000」の 飾り（地図の decor）。スクリーンに 映る 絵と、客席の スマホの 光。
// - 金曜の 夜（金曜ロード保守の 実況上映）：映画の コマ（空・雲・ゆっくり 泳ぐ 鯖の 影・ときどき 光る ラックの 灯り）。
//   6秒ごとに 番組の ロゴ（フィルムの コマに「1000」、下に 番組名の 小さな 帯）を 1.5秒。
//   右から 左へ 実況の 書きこみの 線が 流れる。上映中なので 場内は 暗く、客席は 半分の 席に スマホの 光。
// - ほかの 日：予告編（夕焼けの 浜と「1000」の 文字の 影）。書きこみの 線も スマホの 光も 少し。
// スクリーンの 絵（Base.png の 4,504）は 白い 1色の マスなので、ふちを 1px 残して その 内側に 塗る。
// 同梱の チップに 映写の 絵が ないので 塗って 描く（絵の 参照は 増やさない）。ui/hallEvents.ts の monitorDecor と 同じ 作り。
// 動きを へらす 設定（prefers-reduced-motion）では 明滅を とめる。文は data/jikkyo/text.ts。

import { type Today, today } from "../data/calendar";
import { isRoadshowNight } from "../data/jikkyo/text";
import type { Facility } from "../data/village/facilities";
import type { MapDef } from "../engine/defs";
import { TILE } from "../engine/types";

type G = CanvasRenderingContext2D;
type Cell = readonly [number, number];

/** 行の 中の その 字の マス。 */
const cellsOf = (rows: readonly string[], chars: string): Cell[] =>
	rows.flatMap((r, y) =>
		[...r].flatMap((c, x) => (chars.includes(c) ? [[x, y] as const] : [])),
	);

/** マスの 決め打ちの 乱数（0〜1。席えらびと 灯りの 明滅）。 */
export const hash = (x: number, y: number, k = 0): number => {
	let h =
		Math.imul(x, 374761393) +
		Math.imul(y, 668265263) +
		Math.imul(k, 1442695041);
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** 字の 絵を 塗る（字 → 色。色の ない 字は 塗らない）。 */
export const blit = (
	g: G,
	art: readonly string[],
	x: number,
	y: number,
	ink: Readonly<Record<string, string>>,
	scale = 1,
): void => {
	art.forEach((row, dy) => {
		[...row].forEach((ch, dx) => {
			const c = ink[ch];
			if (!c) return;
			g.fillStyle = c;
			g.fillRect(x + dx * scale, y + dy * scale, scale, scale);
		});
	});
};

/** 3×5 の 数字（「1000」だけ 描く）。 */
const GLYPH: Readonly<Record<string, readonly string[]>> = {
	"0": ["###", "#.#", "#.#", "#.#", "###"],
	"1": [".#.", "##.", ".#.", ".#.", "###"],
};

/** 数字の 並びの 幅（字の あいだは 1目盛り）。 */
const numberWidth = (s: string, scale: number): number =>
	(s.length * 4 - 1) * scale;

const drawNumber = (
	g: G,
	s: string,
	x: number,
	y: number,
	scale: number,
	color: string,
): void => {
	[...s].forEach((ch, i) => {
		const art = GLYPH[ch];
		if (art) blit(g, art, x + i * 4 * scale, y, { "#": color }, scale);
	});
};

// ───────────────── 金曜：映画の コマ ─────────────────

/** 空（上から 下へ 明るく。6px ずつの 帯）。 */
const SKY = ["#3f9ad8", "#58aee2", "#74c0ea", "#92d0f0", "#b4e0f6"];

const CLOUD_BIG = [
	"....####......",
	"..########....",
	".############.",
	"##############",
	".------------.",
];
const CLOUD_SMALL = ["..###...", ".######.", "########", ".------."];
const CLOUD_INK = { "#": "#ffffff", "-": "#d6eaf6" };
/** 雲（絵・高さ・速さ px/ms・ずらし。front は 鯖より 手前）。 */
const CLOUDS = [
	{ art: CLOUD_BIG, y: 3, v: 0.0016, off: 20, front: false },
	{ art: CLOUD_SMALL, y: 13, v: 0.0024, off: 90, front: false },
	{ art: CLOUD_SMALL, y: 22, v: 0.0036, off: 45, front: true },
] as const;

/** 鯖（さばの 形の サーバー）の 影。右を 向いて 泳ぐ。= は 背中の 波の 模様、- は 腹、o は 目。 */
export const SABA = [
	"...........#.#..........",
	"#.......#==##==##=#.....",
	"##...#==##==##==#####...",
	".##################o###.",
	".#######################",
	"##...#-----------------.",
	"#.......-------------...",
	"...........#.#..........",
];
export const SABA_INK = {
	"#": "#253a5e",
	"=": "#3a5a88",
	"-": "#3d5478",
	o: "#d8e6ff",
};
const SABA_W = SABA[0].length;
/** うろこの ラックの 灯り（鯖の 中の マス）。 */
export const RACK: readonly Cell[] = [
	[8, 2],
	[11, 3],
	[14, 2],
	[17, 3],
	[10, 4],
	[13, 4],
	[16, 4],
	[9, 5],
];
export const RACK_INK = ["#7dffa0", "#ffd25a"];

const drawCloud = (
	g: G,
	c: (typeof CLOUDS)[number],
	X: number,
	Y: number,
	W: number,
	t: number,
): void => {
	const w = c.art[0].length;
	const span = W + w + 4;
	const x = X + W - Math.round((t * c.v + c.off) % span);
	blit(g, c.art, x, Y + c.y, CLOUD_INK);
};

const drawFilm = (
	g: G,
	X: number,
	Y: number,
	W: number,
	H: number,
	t: number,
	still: boolean,
): void => {
	const band = Math.ceil(H / SKY.length);
	SKY.forEach((c, i) => {
		g.fillStyle = c;
		g.fillRect(X, Y + i * band, W, Math.min(band, H - i * band));
	});
	for (const c of CLOUDS) if (!c.front) drawCloud(g, c, X, Y, W, t);
	// 鯖は 左から 右へ ゆっくり（20秒ほどで 横切る）、上下に すこし ゆれる
	const span = W + SABA_W + 10;
	const sx = X - SABA_W - 5 + Math.round((t * 0.008) % span);
	const sy = Y + 9 + Math.round(Math.sin(t / 650) * 1.5);
	blit(g, SABA, sx, sy, SABA_INK);
	const tick = Math.floor(t / 350);
	RACK.forEach(([rx, ry], i) => {
		if (still ? i % 3 !== 0 : hash(i, tick, 7) >= 0.3) return;
		g.fillStyle = RACK_INK[i % 2];
		g.fillRect(sx + rx, sy + ry, 1, 1);
	});
	for (const c of CLOUDS) if (c.front) drawCloud(g, c, X, Y, W, t);
};

/** 番組の ロゴ（フィルムの 帯の まんなかの コマに「1000」、下に 番組名の 帯）。 */
const drawLogo = (
	g: G,
	X: number,
	Y: number,
	W: number,
	H: number,
	t: number,
): void => {
	g.fillStyle = "#0b0b0f";
	g.fillRect(X, Y, W, H);
	// フィルムの 帯（穴は 左へ 送る）
	const fy = Y + 1;
	const fh = 19;
	g.fillStyle = "#1c1a18";
	g.fillRect(X, fy, W, fh);
	g.fillStyle = "#bdb6a6";
	const off = Math.floor(t / 60) % 5;
	for (let x = X - off; x < X + W; x += 5) {
		g.fillRect(x, fy + 1, 2, 2);
		g.fillRect(x, fy + fh - 3, 2, 2);
	}
	// コマ（まんなかは 明るく、両どなりは 暗い）
	const cw = 36;
	const ch = 12;
	const cy = fy + 4;
	const cx = X + Math.floor((W - cw) / 2);
	g.fillStyle = "#4a4436";
	g.fillRect(cx - cw - 3, cy, cw, ch);
	g.fillRect(cx + cw + 3, cy, cw, ch);
	g.fillStyle = "#f2e6c8";
	g.fillRect(cx, cy, cw, ch);
	drawNumber(
		g,
		"1000",
		cx + Math.floor((cw - numberWidth("1000", 2)) / 2),
		cy + 1,
		2,
		"#2a2218",
	);
	// 番組名の 帯
	g.fillStyle = "#14213a";
	g.fillRect(X, fy + fh + 1, W, H - fh - 2);
	g.font = "7px 'DotGothic16', monospace";
	g.textAlign = "center";
	g.textBaseline = "top";
	g.fillStyle = "#ffe7a0";
	g.fillText("金曜ロード保守", X + W / 2, fy + fh + 2);
};

// ───────────────── ほかの 日：予告編 ─────────────────

/** 夕焼けの 空（上から）。 */
const DUSK = ["#2c2350", "#5a2f62", "#a0466a", "#d86a52", "#f29a52"];

const drawTrailer = (
	g: G,
	X: number,
	Y: number,
	W: number,
	H: number,
	t: number,
	still: boolean,
): void => {
	const horizon = Y + 20;
	DUSK.forEach((c, i) => {
		g.fillStyle = c;
		g.fillRect(X, Y + i * 4, W, 4);
	});
	// 沈む 日（水平線の 上の 半円）
	const sunX = X + Math.round(W * 0.7);
	g.fillStyle = "#ffd890";
	for (let dy = 0; dy < 5; dy++) {
		const half = Math.round(Math.sqrt(25 - dy * dy));
		g.fillRect(sunX - half, horizon - 1 - dy, half * 2, 1);
	}
	// 海と 日の 照りかえし
	g.fillStyle = "#2e3a6a";
	g.fillRect(X, horizon, W, 5);
	g.fillStyle = "#f2a860";
	for (let dy = 0; dy < 5; dy += 2) {
		const sway = still ? 0 : Math.round(Math.sin(t / 400 + dy) * 1.5);
		const len = 8 - dy;
		g.fillRect(sunX - len / 2 + sway, horizon + dy, len, 1);
	}
	// 浜（寄せては 返す 波の 白い 線）
	const shore = horizon + 5;
	g.fillStyle = "#b88a5a";
	g.fillRect(X, shore, W, Y + H - shore);
	g.fillStyle = "#d8a868";
	g.fillRect(X, shore, W, 1);
	const reach = still ? 0 : Math.round((Math.sin(t / 1200) + 1) * 1.5);
	g.fillStyle = "#f0e0c0";
	g.fillRect(X, shore + reach, W, 1);
	// 題の「1000」の 影（ゆっくり 濃く 淡く）
	const a = still ? 0.45 : 0.4 + 0.15 * Math.sin(t / 1500);
	drawNumber(g, "1000", X + 10, Y + 3, 3, `rgba(20, 10, 28, ${a.toFixed(2)})`);
};

// ───────────────── 書きこみの 線・客席の 光 ─────────────────

/** 実況の 書きこみの 線（高さ・長さ・速さ px/ms・色）。 */
const LANES = [
	{ y: 2, len: 9, v: 0.022, ink: "#ffffff" },
	{ y: 6, len: 5, v: 0.03, ink: "#ffe060" },
	{ y: 10, len: 7, v: 0.026, ink: "#ffffff" },
	{ y: 14, len: 4, v: 0.036, ink: "#ffffff" },
	{ y: 18, len: 8, v: 0.024, ink: "#a8f0ff" },
] as const;

const drawPosts = (
	g: G,
	X: number,
	Y: number,
	W: number,
	t: number,
	busy: boolean,
): void => {
	const lanes = busy ? LANES : [LANES[0], LANES[2]];
	const per = busy ? 2 : 1;
	const speed = busy ? 1 : 0.7;
	lanes.forEach((l, i) => {
		const span = W + l.len + 12;
		for (let k = 0; k < per; k++) {
			const x = Math.round(
				X + W - ((t * l.v * speed + i * 37 + (k * span) / per) % span),
			);
			g.fillStyle = "rgba(10, 20, 40, 0.45)";
			g.fillRect(x, Y + l.y + 1, l.len, 1);
			g.fillStyle = l.ink;
			g.fillRect(x, Y + l.y, l.len, 1);
		}
	});
};

const PHONE = "#eaf6ff";
const PHONE_HALO = "rgba(120, 190, 255, 0.16)";
const PHONE_GLOW = "rgba(170, 220, 255, 0.32)";
/** 上映中の 場内の 暗さ（スクリーンの ほか。キリコも 人も 暗く なる）。 */
const DIM = "rgba(4, 6, 18, 0.42)";

/** スマホの 光（席の 背もたれの 上に 2×1px と 淡い にじみ。ゆっくり 明滅）。 */
const drawPhones = (
	g: G,
	seats: readonly Cell[],
	ox: number,
	oy: number,
	t: number,
	still: boolean,
): void => {
	seats.forEach(([sx, sy], i) => {
		const x = sx * TILE - ox + 4 + Math.floor(hash(sx, sy, 3) * 7);
		const y = sy * TILE - oy;
		g.globalAlpha = still ? 0.9 : 0.6 + 0.4 * Math.sin(t / 1100 + i * 1.7);
		g.fillStyle = PHONE_HALO;
		g.fillRect(x - 3, y - 3, 8, 4);
		g.fillStyle = PHONE_GLOW;
		g.fillRect(x - 1, y - 2, 4, 2);
		g.fillStyle = PHONE;
		g.fillRect(x, y - 1, 2, 1);
	});
	g.globalAlpha = 1;
};

/** 金曜の ロゴの 間（6秒ごとに 1.5秒）。 */
const LOGO_EVERY = 6000;
const LOGO_FOR = 1500;

/**
 * 映画館の 飾り。スクリーンは 行の S（上段）と s（下段）の マス、客席は o の マス。
 * night は 金曜ロード保守の 夜（実況上映）。
 */
export const cinemaDecor = (
	rows: readonly string[],
	night: boolean,
): MapDef["decor"] => {
	const screen = cellsOf(rows, "Ss");
	if (!screen.length) return undefined;
	const xs = screen.map(([x]) => x);
	const ys = screen.map(([, y]) => y);
	// ふちを 1px 残す
	const x0 = Math.min(...xs) * TILE + 1;
	const y0 = Math.min(...ys) * TILE + 1;
	const W = (Math.max(...xs) + 1) * TILE - 1 - x0;
	const H = (Math.max(...ys) + 1) * TILE - 1 - y0;
	// 光る 席：金曜は 半分、ほかの 日は 2つ（どちらも マスの 乱数の 順で 決め打ち）
	const seats = cellsOf(rows, "o").sort(
		([ax, ay], [bx, by]) => hash(ax, ay) - hash(bx, by),
	);
	const lit = seats.slice(0, night ? Math.floor(seats.length / 2) : 2);
	const still =
		typeof matchMedia === "function" &&
		matchMedia("(prefers-reduced-motion: reduce)").matches;
	const roomW = Math.max(...rows.map((r) => [...r].length)) * TILE;
	const roomH = rows.length * TILE;
	return (g, ox, oy, t) => {
		const X = x0 - ox;
		const Y = y0 - oy;
		// 金曜は 上映中：スクリーン（白い ふちまで）の ほかを 暗く
		if (night) {
			g.fillStyle = DIM;
			g.beginPath();
			g.rect(-ox, -oy, roomW, roomH);
			g.rect(X - 1, Y - 1, W + 2, H + 2);
			g.fill("evenodd");
		}
		g.save();
		g.beginPath();
		g.rect(X, Y, W, H);
		g.clip();
		const logo = night && t % LOGO_EVERY < LOGO_FOR;
		if (logo) drawLogo(g, X, Y, W, H, t);
		else {
			if (night) drawFilm(g, X, Y, W, H, t, still);
			else drawTrailer(g, X, Y, W, H, t, still);
			drawPosts(g, X, Y, W, t, night);
		}
		g.restore();
		drawPhones(g, lit, ox, oy, t, still);
	};
};

/** 施設の 部屋の 飾り（いまは 映画館だけ。ほかは undefined）。t は 曜日を 見る 日。 */
export const facilityDecor = (
	f: Facility,
	rows: readonly string[],
	t: Today = today(),
): MapDef["decor"] =>
	f.id === "cinema" ? cinemaDecor(rows, isRoadshowNight(t)) : undefined;
