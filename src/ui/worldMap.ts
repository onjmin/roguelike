// 全体マップ（おーぷん2ch の 地図）。村の 口に 立つと 開き、行き先の 植民地を 選ぶ。
// 選んだら キリコが 保守村から 道を たどって 歩いていき、着くと 建物の 札が 出る（travelTo）。
// 持ち帰って もどるときは 逆向きに 短く 歩く（travelHome）。島と 道と 建物の 置き場は data/worldMap.ts。
//
// 絵は 小さな キャンバス（MAP_W × MAP_H）に 画素で 描いて、CSS で 引きのばす（ぼかさない）。
// 島の 形は はじめに 1回だけ 描いて しまっておく。建物は ここの drawBuilding が 矩形で 描く ドット絵。

import { DUNGEON_IDS, DUNGEONS } from "../core/data/dungeons";
import type { DungeonId } from "../core/types";
import { KIRIKO_WALK } from "../data/cast";
import { eventText, goalText, type ObjectiveInfo } from "../data/objectives";
import { DUNGEON_NAMES } from "../data/story";
import {
	type BuildingKind,
	COLONY_SPOTS,
	ISLANDS,
	MAP_H,
	MAP_W,
	type Pt,
	VILLAGE_PT,
} from "../data/worldMap";
import { loadImage } from "../engine/assets";
import { drawWalk, stepFrame } from "../engine/sprite";
import type { Dir } from "../engine/types";
import type { Ctx } from "./ctx";
import { el, nextFrame } from "./dom";
import { isUpBoard } from "./floorName";
import { ChoiceWindow } from "./message";
import { DUNGEON_DESC } from "./villageTalk";

// ───────────────── 色 ─────────────────

const SEA = "#1d3b5c";
const SEA_LIGHT = "#2f5a82";
const SAND = "#d9c690";
const GRASS = "#5d9b4a";
const GRASS_DARK = "#4b8540";
const ROAD = "#c8a468";
const ROAD_EDGE = "#8a6a3c";
const BRIDGE = "#8a6038";

/** 画素ごとの 決まった 乱れ（草の 濃淡・波）。 */
const hash = (x: number, y: number): number => {
	let h = (x * 374761393 + y * 668265263) >>> 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
	return (h ^ (h >>> 16)) / 4294967296;
};

// ───────────────── 島（はじめに 1回だけ） ─────────────────

let landMask: Uint8Array | null = null;
let baseLayer: HTMLCanvasElement | null = null;

/** 陸か（0：海・1：砂浜・2：草）。 */
const land = (): Uint8Array => {
	if (landMask) return landMask;
	const m = new Uint8Array(MAP_W * MAP_H);
	for (const is of ISLANDS)
		for (const [cx, cy, r] of is.blobs)
			for (let y = Math.max(0, cy - r); y <= Math.min(MAP_H - 1, cy + r); y++)
				for (
					let x = Math.max(0, cx - r);
					x <= Math.min(MAP_W - 1, cx + r);
					x++
				) {
					const d = Math.hypot(x - cx, y - cy);
					const i = y * MAP_W + x;
					if (d <= r - 3) m[i] = 2;
					else if (d <= r && m[i] === 0) m[i] = 1;
				}
	landMask = m;
	return m;
};

const onLand = (x: number, y: number): boolean =>
	(land()[Math.round(y) * MAP_W + Math.round(x)] ?? 0) > 0;

/** 海と 島の 絵（波は 描くたびに 足す）。 */
const base = (): HTMLCanvasElement => {
	if (baseLayer) return baseLayer;
	const c = document.createElement("canvas");
	c.width = MAP_W;
	c.height = MAP_H;
	const g = c.getContext("2d");
	if (!g) return c;
	const img = g.createImageData(MAP_W, MAP_H);
	const m = land();
	const rgb = (hex: string) => [
		Number.parseInt(hex.slice(1, 3), 16),
		Number.parseInt(hex.slice(3, 5), 16),
		Number.parseInt(hex.slice(5, 7), 16),
	];
	const sea = rgb(SEA);
	const sand = rgb(SAND);
	const grass = rgb(GRASS);
	const grassDark = rgb(GRASS_DARK);
	for (let i = 0; i < m.length; i++) {
		const x = i % MAP_W;
		const y = Math.floor(i / MAP_W);
		const col =
			m[i] === 2
				? hash(x, y) < 0.18
					? grassDark
					: grass
				: m[i] === 1
					? sand
					: sea;
		img.data.set([...col, 255], i * 4);
	}
	g.putImageData(img, 0, 0);
	// サーバーの 名前
	g.font = "8px 'DotGothic16', monospace";
	g.textAlign = "center";
	g.fillStyle = "rgba(255,255,255,0.55)";
	for (const is of ISLANDS)
		if (is.name) g.fillText(is.name, is.label[0], is.label[1]);
	baseLayer = c;
	return c;
};

// ───────────────── 道 ─────────────────

/** 保守村から その 植民地までの 道（村の 点を 先頭に）。 */
const pathOf = (d: DungeonId): Pt[] => [VILLAGE_PT, ...COLONY_SPOTS[d].route];

const spotOf = (d: DungeonId): Pt => {
	const r = COLONY_SPOTS[d].route;
	return r[r.length - 1];
};

const pathLength = (p: readonly Pt[]): number => {
	let n = 0;
	for (let i = 1; i < p.length; i++)
		n += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
	return n;
};

/** 道の 上の 位置（0〜1）と、進む 向き。 */
const pointAt = (p: readonly Pt[], t: number): { at: Pt; dir: Dir } => {
	let left = pathLength(p) * Math.max(0, Math.min(1, t));
	for (let i = 1; i < p.length; i++) {
		const [ax, ay] = p[i - 1];
		const [bx, by] = p[i];
		const len = Math.hypot(bx - ax, by - ay);
		const dx = bx - ax;
		const dy = by - ay;
		const dir: Dir =
			Math.abs(dx) > Math.abs(dy)
				? dx > 0
					? "right"
					: "left"
				: dy > 0
					? "down"
					: "up";
		if (left <= len || i === p.length - 1) {
			const k = len ? Math.min(1, left / len) : 1;
			return { at: [ax + dx * k, ay + dy * k], dir };
		}
		left -= len;
	}
	return { at: p[p.length - 1], dir: "down" };
};

/** 道を 描く（陸は 土の 道、海は 板の 橋）。 */
const drawRoad = (g: CanvasRenderingContext2D, p: readonly Pt[]): void => {
	for (let i = 1; i < p.length; i++) {
		const [ax, ay] = p[i - 1];
		const [bx, by] = p[i];
		const n = Math.ceil(Math.hypot(bx - ax, by - ay));
		for (let k = 0; k <= n; k++) {
			const x = Math.round(ax + ((bx - ax) * k) / Math.max(1, n));
			const y = Math.round(ay + ((by - ay) * k) / Math.max(1, n));
			const sea = !onLand(x, y);
			g.fillStyle = sea ? BRIDGE : ROAD_EDGE;
			g.fillRect(x - 1, y - 1, 3, 3);
			g.fillStyle = sea ? (k % 3 === 0 ? ROAD_EDGE : BRIDGE) : ROAD;
			g.fillRect(x, y, 1, 1);
		}
	}
};

// ───────────────── 建物（ドット絵） ─────────────────

type Px = (x: number, y: number, w: number, h: number, c: string) => void;

/**
 * 建物を 描く。(x, y) は 足もとの まん中。s は 大きさ（着いたときの 札は 大きく）。
 * dark なら まだ 開いていない 植民地（黒い 影）。t は 時刻（湯気・提灯・雷の 動き）。
 */
export const drawBuilding = (
	g: CanvasRenderingContext2D,
	kind: BuildingKind,
	x: number,
	y: number,
	s: number,
	t: number,
	dark = false,
): void => {
	const r: Px = (dx, dy, w, h, c) => {
		g.fillStyle = dark ? "rgba(10,12,20,0.8)" : c;
		g.fillRect(
			Math.round(x + dx * s),
			Math.round(y + dy * s),
			Math.ceil(w * s),
			Math.ceil(h * s),
		);
	};
	const blink = Math.floor(t / 400) % 2 === 0;
	switch (kind) {
		case "village":
			// 小屋 ふたつ
			r(-7, -11, 4, 1, "#a8402c");
			r(-8, -10, 6, 1, "#a8402c");
			r(-9, -9, 8, 1, "#a8402c");
			r(-11, -8, 12, 1, "#8a3020");
			r(-10, -7, 10, 7, "#e8d8b0");
			r(-6, -4, 2, 4, "#5a3a20");
			r(2, -8, 9, 1, "#3a6a9a");
			r(3, -9, 7, 1, "#3a6a9a");
			r(2, -7, 9, 7, "#d8c8a0");
			r(5, -4, 2, 4, "#5a3a20");
			break;
		case "bakery":
			// パン屋（地下へ 降りる 窯の 口）
			r(-8, -12, 16, 2, "#7a3a1a");
			r(-7, -14, 14, 2, "#8a4a22");
			r(-7, -10, 14, 10, "#c8864a");
			r(-4, -19, 8, 4, "#e8b060");
			r(-3, -18, 1, 1, "#b07030");
			r(0, -18, 1, 1, "#b07030");
			r(-2, -5, 4, 5, "#1a1010");
			r(-6, -8, 2, 2, "#ffe0a0");
			r(4, -8, 2, 2, "#ffe0a0");
			break;
		case "mushroom":
			// 大きな きのこ（根もとに 菌床への 穴）
			r(-2, -8, 4, 8, "#efe6d0");
			r(-7, -13, 14, 3, "#d0302a");
			r(-6, -15, 12, 2, "#d0302a");
			r(-4, -16, 8, 1, "#d0302a");
			r(-8, -10, 16, 2, "#b02820");
			r(-5, -14, 2, 2, "#fff");
			r(2, -13, 2, 2, "#fff");
			r(-1, -16, 1, 1, "#fff");
			r(-1, -3, 2, 3, "#201010");
			break;
		case "bathhouse": {
			// 銭湯（のれんと 湯気）
			r(-9, -12, 18, 2, "#3a4a6a");
			r(-8, -14, 16, 2, "#4a5a7a");
			r(-8, -10, 16, 10, "#d8cfb8");
			r(-4, -9, 8, 3, "#3060c0");
			r(-1, -9, 1, 3, "#1a3a80");
			r(-2, -5, 4, 5, "#2a2018");
			const up = Math.floor(t / 300) % 3;
			r(-5, -17 - up, 1, 2, "rgba(255,255,255,0.8)");
			r(0, -18 - ((up + 1) % 3), 1, 2, "rgba(255,255,255,0.8)");
			r(5, -17 - ((up + 2) % 3), 1, 2, "rgba(255,255,255,0.8)");
			break;
		}
		case "pylon":
			// 送電鉄塔（てっぺんで 漏電）
			for (let i = 0; i < 22; i++) {
				const w = Math.max(1, Math.round(6 - i / 4));
				r(-w, -i - 1, 1, 1, "#9aa4b0");
				r(w - 1, -i - 1, 1, 1, "#9aa4b0");
				if (i % 4 === 2) r(-w, -i - 1, w * 2, 1, "#7a8490");
			}
			r(-7, -16, 14, 1, "#9aa4b0");
			r(-5, -20, 10, 1, "#9aa4b0");
			if (blink) {
				r(-1, -25, 2, 2, "#ffe040");
				r(1, -27, 1, 2, "#ffe040");
				r(-2, -23, 1, 2, "#ffe040");
			}
			break;
		case "island":
			// 島の 岩山（草と まぎれないよう 茶色）と ヤシの木
			for (let i = 0; i < 12; i++)
				r(-12 + i, -i - 1, 24 - i * 2, 1, i < 3 ? "#7a6440" : "#9a8252");
			r(-2, -12, 4, 1, "#c8b890");
			r(6, -12, 1, 10, "#8a5a2a");
			r(3, -13, 7, 1, "#2f8a3a");
			r(4, -14, 5, 1, "#2f8a3a");
			r(2, -12, 2, 1, "#2f8a3a");
			r(9, -12, 2, 1, "#2f8a3a");
			r(7, -11, 2, 2, "#8a5a2a");
			break;
		case "building":
			// 大阪の 雑居ビル（たこ焼きの 赤ちょうちん）
			r(-5, -24, 10, 24, "#7a7a88");
			r(-5, -24, 10, 1, "#5a5a66");
			for (let yy = 0; yy < 5; yy++)
				for (let xx = 0; xx < 3; xx++)
					r(
						-4 + xx * 3,
						-22 + yy * 4,
						2,
						2,
						(xx + yy) % 2 ? "#ffe07a" : "#3a3a48",
					);
			r(-2, -3, 4, 3, "#2a2020");
			r(5, -14, 3, 5, blink ? "#ff4a2a" : "#d03a20");
			r(6, -12, 1, 1, "#ffe0a0");
			break;
		case "well": {
			// 古井戸（石の ふちと 暗い 口。つるべ）
			r(-7, -5, 14, 5, "#8a8a92");
			r(-6, -6, 12, 1, "#a4a4ae");
			r(-5, -4, 10, 2, "#0a0810");
			r(-6, -13, 1, 8, "#6a4a2a");
			r(5, -13, 1, 8, "#6a4a2a");
			r(-7, -14, 14, 1, "#7a5a32");
			r(-1, -12, 2, 3, "#9a7a4a");
			break;
		}
		case "lighthouse": {
			// 諸島の 灯台（白と 赤の しま。てっぺんの 明かりが 回る）
			r(-6, -2, 12, 2, "#7a7a88");
			for (let i = 0; i < 18; i++) {
				const w = 5 - Math.floor(i / 6);
				r(-w, -3 - i, w * 2, 1, Math.floor(i / 3) % 2 ? "#d8382a" : "#f4f2ea");
			}
			r(-4, -22, 8, 1, "#3a4a6a");
			r(-3, -26, 6, 4, "#2a3040");
			r(-3, -27, 6, 1, "#3a4a6a");
			r(-1, -29, 2, 2, "#8a3a2a");
			{
				const turn = Math.floor(t / 300) % 4;
				const lamp = "#ffe060";
				r(-2, -25, 4, 2, lamp);
				// 回る 光（4方向）
				if (turn === 0) r(3, -26, 5, 1, "rgba(255,224,96,0.6)");
				else if (turn === 2) r(-8, -26, 5, 1, "rgba(255,224,96,0.6)");
				else if (turn === 1) r(-1, -33, 1, 6, "rgba(255,224,96,0.45)");
			}
			r(-1, -6, 2, 4, "#2a2020");
			break;
		}
		case "yagura": {
			// 祭りの やぐら（提灯が ゆれる）
			r(-6, -14, 1, 14, "#8a5a2a");
			r(5, -14, 1, 14, "#8a5a2a");
			r(-4, -8, 8, 1, "#6a4020");
			r(-7, -15, 14, 2, "#a06a30");
			r(-6, -20, 12, 1, "#8a2a2a");
			r(-5, -21, 10, 1, "#8a2a2a");
			r(-5, -19, 1, 4, "#8a5a2a");
			r(4, -19, 1, 4, "#8a5a2a");
			const sway = Math.floor(t / 350) % 2;
			for (let i = 0; i < 5; i++)
				r(-9 + i * 4 + (i % 2 ? sway : 0), -13, 2, 3, "#ff4a3a");
			break;
		}
	}
};

/** 持ち帰った 植民地の ★（建物の 右上）。 */
const drawStar = (g: CanvasRenderingContext2D, x: number, y: number): void => {
	g.fillStyle = "#ffe040";
	g.fillRect(x, y - 1, 1, 3);
	g.fillRect(x - 1, y, 3, 1);
};

// ───────────────── 地図の 画面 ─────────────────

type Mode =
	| { k: "pick"; cur: DungeonId }
	| { k: "walk"; path: Pt[]; t: number }
	| { k: "idle" };

/** カーソルが 次の 建物へ すべる 時間（ms）。 */
const GLIDE_MS = 220;

/** ▼ を 建物の 上に 置けない（地図の 上の はし）なら 下に ▲。 */
const cursorBelow = (y: number): boolean => y - 30 < 2;

/** 地図の 画面（キャンバスと 下の 札）。 */
export class MapView {
	readonly box: HTMLElement;
	private readonly title: HTMLElement;
	readonly canvas: HTMLCanvasElement;
	readonly panel: HTMLElement;
	/** えらんでいる 行き先の フキダシ（カーソルに ついていく。タップは 通す）。 */
	readonly bubble: HTMLElement;
	/** カーソルの すべり（from → to を GLIDE_MS で）。 */
	private glide: { from: Pt; to: Pt; t0: number } | null = null;
	private readonly g: CanvasRenderingContext2D | null;
	private raf = 0;
	private alive = true;
	mode: Mode = { k: "idle" };
	/** 行き先に 選べる（開いた）植民地。 */
	open: DungeonId[] = [];
	cleared: DungeonId[] = [];
	/** 板ごとの 目的（行き先を 選ぶ ときだけ。村で 決めた 値。data/objectives.ts）。 */
	goals: Partial<Record<DungeonId, ObjectiveInfo>> = {};
	/** 倉庫から 持ちこめる 数（0 なら 札に 持ちこみを 出さない）。 */
	carryMax = 0;

	constructor(ctx: Ctx, title: string) {
		this.canvas = el("canvas", { class: "wm-canvas" });
		this.canvas.width = MAP_W;
		this.canvas.height = MAP_H;
		this.g = this.canvas.getContext("2d");
		if (this.g) this.g.imageSmoothingEnabled = false;
		this.panel = el("div", { class: "wm-panel window" });
		this.bubble = el("div", { class: "wm-bubble" });
		this.title = el("div", { class: "wm-title", text: title });
		this.box = el("div", { class: "worldmap" }, [
			this.title,
			el("div", { class: "wm-stage" }, [this.canvas, this.bubble]),
			this.panel,
		]);
		ctx.ui.appendChild(this.box);
		void loadImage(KIRIKO_WALK);
		const loop = (t: number) => {
			if (!this.alive) return;
			this.draw(t);
			this.raf = requestAnimationFrame(loop);
		};
		this.raf = requestAnimationFrame(loop);
	}

	async show(): Promise<void> {
		this.draw(performance.now());
		await nextFrame();
		this.box.classList.add("shown");
	}

	setTitle(text: string): void {
		this.title.textContent = text;
	}

	async close(): Promise<void> {
		// 地図の 上に 出していた 窓を もとの 重なりに
		this.box.parentElement?.classList.remove("wm-keep");
		this.box.classList.remove("shown");
		await new Promise((r) => setTimeout(r, 300));
		this.alive = false;
		cancelAnimationFrame(this.raf);
		this.box.remove();
	}

	/** キャンバスの 上の 位置 → 地図の 画素。 */
	toMap(e: PointerEvent): Pt {
		const b = this.canvas.getBoundingClientRect();
		return [
			((e.clientX - b.left) / b.width) * MAP_W,
			((e.clientY - b.top) / b.height) * MAP_H,
		];
	}

	/** カーソルを その 建物へ（はじめは その場に。あとは すべらせる）。 */
	aim(d: DungeonId): void {
		const to = spotOf(d);
		const now = performance.now();
		const from = this.glide ? this.cursorAt(now) : to;
		this.glide = { from, to, t0: now };
	}

	/** いまの カーソルの 位置（建物の 足もと。すべり中は あいだ）。 */
	private cursorAt(t: number): Pt {
		const gl = this.glide;
		if (!gl) return VILLAGE_PT;
		const k = Math.max(0, Math.min(1, (t - gl.t0) / GLIDE_MS));
		const e = 1 - (1 - k) ** 3;
		return [
			gl.from[0] + (gl.to[0] - gl.from[0]) * e,
			gl.from[1] + (gl.to[1] - gl.from[1]) * e,
		];
	}

	/** フキダシの 中身（名前と 階・向き・ボス・期間限定。まだ 開いていなければ ？？？）。 */
	say(d: DungeonId): void {
		const open = this.open.includes(d);
		const n = DUNGEON_NAMES[d];
		const g = this.goals[d];
		const boss = g?.objective === "boss" ? "・ボス" : "";
		this.bubble.innerHTML = open
			? `<b>${n.name}</b><small>${DUNGEONS[d].floors}階・${isUpBoard(d) ? "上り" : "下り"}${boss}</small>` +
				(g?.event ? `<small class="wm-limited">期間限定</small>` : "")
			: "<b>？？？</b><small>まだ　行けない</small>";
		this.bubble.classList.toggle("locked", !open);
		// 変わるたびに ぽんと 出す
		this.bubble.classList.remove("pop");
		void this.bubble.offsetWidth;
		this.bubble.classList.add("pop");
	}

	/** フキダシを カーソルの 上（上の はしでは 下）に。横は 地図から はみ出さない。 */
	private placeBubble(at: Pt): void {
		const b = this.bubble;
		const w = this.canvas.clientWidth;
		const h = this.canvas.clientHeight;
		if (!w || !h) return;
		const below = cursorBelow(at[1]);
		const px = (at[0] / MAP_W) * w;
		const py = ((below ? at[1] + 8 : at[1] - 32) / MAP_H) * h;
		const half = b.offsetWidth / 2;
		const left = Math.max(half + 2, Math.min(w - half - 2, px));
		b.classList.toggle("below", below);
		b.style.left = `${left}px`;
		b.style.top = `${py}px`;
		b.style.setProperty(
			"--tail",
			`${Math.max(-half + 10, Math.min(half - 10, px - left))}px`,
		);
	}

	draw(t: number): void {
		const g = this.g;
		if (!g) return;
		g.drawImage(base(), 0, 0);
		// 波（ゆっくり 流れる）
		const shift = Math.floor(t / 600);
		g.fillStyle = SEA_LIGHT;
		for (let y = 3; y < MAP_H; y += 9)
			for (let x = (y * 7 + shift) % 13; x < MAP_W; x += 13)
				if (!onLand(x, y) && !onLand(x + 2, y) && hash(x - shift, y) < 0.5)
					g.fillRect(x, y, 3, 1);
		// 開いた 植民地への 道
		for (const d of this.open) drawRoad(g, pathOf(d));
		// 建物（まだ 開いていない 植民地は 影だけ）
		const [vx, vy] = VILLAGE_PT;
		// 村の 絵は 道の 出口（キリコの 立つ 所）の 左上に
		drawBuilding(g, "village", vx - 13, vy - 3, 1, t);
		g.font = "8px 'DotGothic16', monospace";
		g.textAlign = "center";
		g.fillStyle = "#fff";
		g.fillText("保守村", vx - 13, vy + 6);
		for (const d of DUNGEON_IDS) {
			const [x, y] = spotOf(d);
			const open = this.open.includes(d);
			if (DUNGEONS[d].secret) continue;
			drawBuilding(g, COLONY_SPOTS[d].building, x, y, 1, t, !open);
			if (!open) {
				g.fillStyle = "rgba(255,255,255,0.7)";
				g.fillText("？", x, y - 5);
			}
			if (this.cleared.includes(d)) drawStar(g, x + 8, y - 16);
		}
		// えらんでいる 植民地の 目印（▼ が はねる。えらび直すと すべって いく。上の はしでは 下に ▲）
		if (this.mode.k === "pick") {
			const at = this.cursorAt(t);
			const x = Math.round(at[0]);
			const bob = Math.floor(t / 300) % 2;
			g.fillStyle = "#ffe040";
			if (cursorBelow(at[1])) {
				const top = Math.round(at[1]) + 3 + bob;
				for (let i = 0; i < 4; i++) g.fillRect(x - i, top + i, 1 + i * 2, 1);
			} else {
				const top = Math.round(at[1]) - 30 - bob;
				for (let i = 0; i < 4; i++)
					g.fillRect(x - 3 + i, top + i, 7 - i * 2, 1);
			}
			this.placeBubble(at);
		}
		// キリコ（歩いている あいだ。選んでいる あいだは 村の 前）
		const walk = this.mode.k === "walk" ? this.mode : null;
		const { at, dir } = walk
			? pointAt(walk.path, walk.t)
			: { at: VILLAGE_PT, dir: "down" as Dir };
		drawWalk(
			g,
			KIRIKO_WALK,
			dir,
			stepFrame(t, !!walk),
			Math.round(at[0] - 8),
			Math.round(at[1] - 14),
		);
	}

	/** 下の 札（行き先の 名前・階・向き・目的（期間限定なら その 名前と 残り）・決まり）。 */
	info(d: DungeonId): void {
		const n = DUNGEON_NAMES[d];
		const open = this.open.includes(d);
		const dg = DUNGEONS[d];
		const star = this.cleared.includes(d) ? "　★" : "";
		const g = this.goals[d];
		this.panel.innerHTML = open
			? `<div class="wm-name">${n.name}<small>（${n.nick}）${star}</small></div>` +
				`<div class="wm-sub">${dg.floors}階・${isUpBoard(d) ? "上り" : "下り"}　${COLONY_SPOTS[d].place}</div>` +
				(g
					? `<div class="wm-goal${g.objective === "boss" ? " boss" : ""}">目的：${goalText(d, g.objective)}</div>` +
						(g.event ? `<div class="wm-limited">${eventText(g)}</div>` : "")
					: "") +
				`<div class="wm-desc">${DUNGEON_DESC[d]}</div>` +
				// 決まり（未識別など）と 倉庫の 道具の 持ちこみ（倉庫が 建ってから）
				`<div class="wm-desc">${n.rules[2] ?? ""}</div>` +
				(this.carryMax > 0
					? `<div class="wm-carry${dg.noCarry ? " no" : ""}">持ちこみ：${dg.noCarry ? "できない（引き取った　道具は　シヨが　預かる）" : `できる（${this.carryMax}つまで）`}</div>`
					: "")
			: `<div class="wm-name">？？？</div><div class="wm-desc">${this.howToOpen(d)}</div>`;
	}

	/** まだ 開いていない 植民地の 開き方（開く もとの 板が まだ 行けなければ その名も ？？？）。 */
	private howToOpen(d: DungeonId): string {
		const dg = DUNGEONS[d];
		const after = dg.unlockAfter;
		if (!after) return "まだ　行けない";
		const known = this.open.includes(after);
		const name = known ? DUNGEON_NAMES[after].name : "？？？";
		const relief =
			known && dg.reliefAfter
				? `<br>（${name}で　${dg.reliefAfter}回　たおれても　開く）`
				: "";
		return `${name}を　持ち帰ると　開く${relief}`;
	}
}

/** 次の 描画か 50ms（ペインが 隠れて rAF が 止まっても 進むように）。 */
const tick = (): Promise<void> =>
	new Promise((r) => {
		const id = setTimeout(r, 50);
		requestAnimationFrame(() => {
			clearTimeout(id);
			r();
		});
	});

// ───────────────── 行き先を 選ぶ ─────────────────

/**
 * 地図を 開いた ままに する（村の 口：選ぶ → 本当に 行くか → 持ち物 → 向かう まで 同じ 地図）。
 * そのあいだ 語りの 窓・選択肢・一覧は 地図の 上に 出す（#ui.wm-keep。close で もどる）。
 */
export const openWorldMap = (
	ctx: Ctx,
	o: {
		open: DungeonId[];
		cleared: DungeonId[];
		goals?: Partial<Record<DungeonId, ObjectiveInfo>>;
		carryMax?: number;
	},
): MapView => {
	const v = new MapView(ctx, "どの　植民地へ？");
	v.open = o.open;
	v.cleared = o.cleared;
	v.goals = o.goals ?? {};
	v.carryMax = o.carryMax ?? 0;
	ctx.ui.classList.add("wm-keep");
	void v.show();
	return v;
};

/**
 * 全体マップで 行き先の 植民地を 選ぶ（やめたら null）。下の 選択肢（植民地と やめる）の カーソルに
 * 地図の ▼ と フキダシと 札が ついていく。A か 選択肢を 押すか、同じ 建物を もう一度 タップで 決める
 * （建物を タップすると 選択肢の カーソルも そこへ）。まだ 開いていない 植民地も 選べて、開き方が 出る。
 * view を わたすと その 地図で 選び、閉じない（openWorldMap）。
 */
export const pickColony = async (
	ctx: Ctx,
	o: {
		open: DungeonId[];
		cleared: DungeonId[];
		start: DungeonId;
		/** 板ごとの 目的（村で 1回だけ 決めた 値。札と フキダシに 出す）。 */
		goals?: Partial<Record<DungeonId, ObjectiveInfo>>;
		view?: MapView;
	},
): Promise<DungeonId | null> => {
	const v = o.view ?? new MapView(ctx, "どの　植民地へ？");
	if (!o.view) {
		v.open = o.open;
		v.cleared = o.cleared;
		v.goals = o.goals ?? {};
	}
	// 地図に 出る 植民地（隠しの 板は 出さない。過去ログの底は 村の 井戸から）と、さいごに やめる。
	// 目的を 1度でも はたした 板には 地図・札と 同じく ★
	const spots = DUNGEON_IDS.filter((d) => !DUNGEONS[d].secret);
	const labels = [
		...spots.map((d) =>
			o.open.includes(d)
				? `${DUNGEON_NAMES[d].name}${o.cleared.includes(d) ? "　★" : ""}`
				: "？？？",
		),
		"やめる",
	];
	const cancel = spots.length;
	const first = o.open.includes(o.start) ? o.start : o.open[0];
	const onMove = (i: number) => {
		const d = spots[i];
		if (!d) {
			// やめる：▼ と フキダシを しまう
			v.mode = { k: "idle" };
			v.bubble.innerHTML = "";
			v.panel.innerHTML = `<div class="wm-name">やめる</div><div class="wm-desc">保守村に　のこる。</div>`;
			return;
		}
		v.mode = { k: "pick", cur: d };
		v.aim(d);
		v.info(d);
		v.say(d);
	};
	const ctl: { move?: (i: number) => void; pick?: (i: number) => void } = {};
	const onTap = (e: PointerEvent) => {
		const [mx, my] = v.toMap(e);
		let near = -1;
		let nd = 18;
		spots.forEach((d, i) => {
			const [x, y] = spotOf(d);
			const dd = Math.hypot(mx - x, my - (y - 8));
			if (dd < nd) {
				nd = dd;
				near = i;
			}
		});
		if (near < 0) return;
		const m = v.mode;
		if (m.k === "pick" && m.cur === spots[near]) ctl.pick?.(near);
		else ctl.move?.(near);
	};
	v.canvas.addEventListener("pointerup", onTap);
	if (!o.view) void v.show();
	const choice = new ChoiceWindow(ctx.ui, ctx.input, () => ctx.audio.seHeld);
	// 一覧は 札ごと 下に 浮かせる（style.css の .wm-listing）。地図を 上の あきへ 寄せるので 高さを 渡す
	const listed = new ResizeObserver((es) => {
		for (const e of es) {
			const t = e.target as HTMLElement;
			v.box.style.setProperty(
				t === v.panel ? "--wm-panel-h" : "--wm-list-h",
				`${t.offsetHeight}px`,
			);
		}
	});
	const picking = choice.choose(
		labels,
		cancel,
		(name) => ctx.se(name),
		Math.max(0, spots.indexOf(first)),
		{
			parent: v.box,
			className: "wm-choice",
			cols: 2,
			onMove,
			disabled: (i) => i < cancel && !o.open.includes(spots[i]),
			ctl,
			// 歩いて 口に 入った 押しっぱなしで すぐに カーソルが 動かないように 長めに 待つ
			waitMs: 400,
			// 押しっぱなしで 行き先が 走りまわらないように ゆっくり
			repeatMs: 320,
		},
	);
	const list = v.box.querySelector<HTMLElement>(".wm-choice");
	if (list) listed.observe(list);
	listed.observe(v.panel);
	v.box.classList.add("wm-listing");
	const i = await picking;
	listed.disconnect();
	v.box.classList.remove("wm-listing");
	v.canvas.removeEventListener("pointerup", onTap);
	if (!o.view) await v.close();
	return spots[i] ?? null;
};

// ───────────────── 向かう・もどる ─────────────────

/** 道を 歩く（タップ・A・B で とばす）。 */
const walkAlong = async (
	ctx: Ctx,
	v: MapView,
	path: Pt[],
	speed: number,
): Promise<void> => {
	let skip = false;
	const pop = ctx.input.push(
		(k, repeat) => {
			if ((k === "a" || k === "b") && !repeat) skip = true;
		},
		{ tap: null },
	);
	const onTap = () => {
		skip = true;
	};
	v.box.addEventListener("pointerup", onTap);
	const ms = (pathLength(path) / speed) * 1000;
	const t0 = performance.now();
	v.mode = { k: "walk", path, t: 0 };
	while (!skip) {
		const t = Math.min(1, (performance.now() - t0) / ms);
		v.mode = { k: "walk", path, t };
		if (t >= 1) break;
		await tick();
	}
	v.mode = { k: "walk", path, t: 1 };
	pop();
	v.box.removeEventListener("pointerup", onTap);
};

/** 着いたときの 建物の 札（タップか 1.6秒で 閉じる）。 */
const arrivalCard = async (ctx: Ctx, d: DungeonId): Promise<void> => {
	const n = DUNGEON_NAMES[d];
	const c = el("canvas", { class: "wm-arrive-art" });
	c.width = 96;
	c.height = 96;
	const g = c.getContext("2d");
	const up = isUpBoard(d);
	const card = el("div", { class: "wm-arrive" }, [
		c,
		el("div", { class: "wm-arrive-name", text: n.name }),
		el("div", {
			class: "wm-arrive-sub",
			text: `${COLONY_SPOTS[d].place}を　${up ? "上る" : "降りる"}　${DUNGEONS[d].floors}階`,
		}),
		el("div", { class: "wm-arrive-mascot", text: n.mascot }),
	]);
	ctx.ui.appendChild(card);
	let alive = true;
	const t0 = performance.now();
	const paint = (t: number) => {
		if (!alive || !g) return;
		g.imageSmoothingEnabled = false;
		// 上りは 空を 見上げ、下りは 足もとの 暗い 口を のぞきこむ
		g.fillStyle = up ? "#6aa8e0" : "#1a1420";
		g.fillRect(0, 0, 96, 96);
		g.fillStyle = up ? "#5d9b4a" : "#3a2a24";
		g.fillRect(0, up ? 84 : 80, 96, 16);
		// 着いてから 少し 近づく
		const k = Math.min(1, (t - t0) / 500);
		drawBuilding(
			g,
			COLONY_SPOTS[d].building,
			48,
			up ? 86 : 82,
			2.6 + k * 0.6,
			t,
		);
		requestAnimationFrame(paint);
	};
	requestAnimationFrame(paint);
	await nextFrame();
	card.classList.add("shown");
	ctx.se("stairs");
	await new Promise<void>((resolve) => {
		let done = false;
		const end = () => {
			if (done) return;
			done = true;
			clearTimeout(timer);
			pop();
			card.removeEventListener("pointerup", end);
			resolve();
		};
		const timer = setTimeout(end, 1600);
		const pop = ctx.input.push(
			(k, repeat) => {
				if ((k === "a" || k === "b") && !repeat) end();
			},
			{ tap: null },
		);
		card.addEventListener("pointerup", end);
	});
	card.classList.remove("shown");
	await new Promise((r) => setTimeout(r, 300));
	alive = false;
	card.remove();
};

/**
 * 行き先へ 向かう（保守村から 道を 歩いて、着いたら 建物の 札）。fast は 前に 行ったことの ある 板（速く 歩く）。
 * view を わたすと 開いている 地図の まま 歩く（最後に 閉じる）。
 */
export const travelTo = async (
	ctx: Ctx,
	d: DungeonId,
	o: {
		open: DungeonId[];
		cleared: DungeonId[];
		fast: boolean;
		view?: MapView;
		/**
		 * 地図を 閉じる 前（着いた 札の あと）。村を 下で 暗くしておけば、地図が そのまま 暗転する
		 * （いちど 村が 見えてから 暗く なるのを さける）。
		 */
		beforeClose?: () => Promise<void>;
	},
): Promise<void> => {
	const v = o.view ?? new MapView(ctx, DUNGEON_NAMES[d].name);
	v.setTitle(DUNGEON_NAMES[d].name);
	v.bubble.innerHTML = "";
	v.open = o.open;
	v.cleared = o.cleared;
	v.info(d);
	if (!o.view) await v.show();
	await walkAlong(ctx, v, pathOf(d), o.fast ? 150 : 75);
	await arrivalCard(ctx, d);
	await o.beforeClose?.();
	await v.close();
};

/** 植民地から 保守村へ もどる（短く。タップで とばす）。 */
export const travelHome = async (
	ctx: Ctx,
	d: DungeonId,
	o: { open: DungeonId[]; cleared: DungeonId[] },
): Promise<void> => {
	const v = new MapView(ctx, "保守村へ");
	v.open = o.open;
	v.cleared = o.cleared;
	v.panel.remove();
	await v.show();
	await walkAlong(ctx, v, [...pathOf(d)].reverse(), 170);
	await v.close();
};
