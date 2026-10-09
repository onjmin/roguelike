// ネタスレの 遊びの 板に 共通の 道具（ui/minigameBoard.ts の board() の 上に のせる）。
// - crisp：キャンバスを 2倍の 下地に（字が にじまない。描く 座標は 240x150 の まま）。
// - スレの 欄（drawPosts）・字（txt）・neta.png の 絵（drawNeta）。
// - 入力：twoB（B を 1.5秒 以内に 2回で やめる。過ぎたら「もう　1回で〜」を もどす）、pressesB（minigameBoard の
//   presses と 同じ。ただし 板の 外の タップは B）、mash（連打を 数える。presses() は 1つしか 覚えない。連打の 直後の B は
//   捨てる）、pad（十字キー・A・B と キャンバスの タップの マス）。
//   どれも stop() で 外す（finally で 呼ぶ）。
// - 板を 出して いる あいだ、スマホの 十字キーと A・B は 隠れる（main.ts の .hud.modal）。そこで やめる・そっ閉じ・
//   投了の ある 板は、板の 外（フィールド）の タップを B に する（ctx.input.push の tap: "b"。メニューの 窓と 同じ）。
//   板の 中の タップは A（pad は キャンバスの マス）。

import { NETA_CELLS, NETA_IMG, type NetaCell } from "../data/neta/art";
import { loadImage } from "../engine/assets";
import type { Key } from "../engine/input";
import type { UiCtx } from "./list";
import { type board, sleep } from "./minigameBoard";

export type Board = ReturnType<typeof board>;
export type G = CanvasRenderingContext2D;
export const BW = 240;
export const BH = 150;

/** 2倍の 下地（board() の すぐ あと）。 */
export const crisp = (b: Board): G => {
	b.canvas.width = BW * 2;
	b.canvas.height = BH * 2;
	b.g.setTransform(2, 0, 0, 2, 0, 0);
	b.g.imageSmoothingEnabled = false;
	return b.g;
};

export const font = (px: number): string => `${px}px 'DotGothic16', monospace`;

export const txt = (
	g: G,
	s: string,
	x: number,
	y: number,
	px: number,
	ink: string,
	align: CanvasTextAlign = "left",
): void => {
	g.font = font(px);
	g.textAlign = align;
	g.textBaseline = "top";
	g.fillStyle = ink;
	g.fillText(s, x, y);
};

export type Post = { name: string; body: string; ink?: string };

/** スレの 欄（下が 新しい。入りきらない 古い 書きこみは 出さない）。1行 = 名前 と 本文。 */
export const drawPosts = (
	g: G,
	posts: readonly Post[],
	x: number,
	y: number,
	w: number,
	h: number,
	px = 8,
): void => {
	g.fillStyle = "#0c0c14";
	g.fillRect(x, y, w, h);
	const lh = px + 3;
	const n = Math.floor((h - 4) / lh);
	const shown = posts.slice(-n);
	g.save();
	g.beginPath();
	g.rect(x, y, w, h);
	g.clip();
	shown.forEach((p, i) => {
		const ty = y + 2 + i * lh;
		g.font = font(px);
		const nw = g.measureText(p.name).width;
		txt(g, p.name, x + 3, ty, px, "#8ab48a");
		txt(g, p.body, x + 3 + nw + 3, ty, px, p.ink ?? "#e8e8f0");
	});
	g.restore();
};

/** neta.png（1秒 待って 読めなければ null。その ときは 四角で 描く）。 */
export const loadNetaImg = async (): Promise<HTMLImageElement | null> =>
	Promise.race([loadImage(NETA_IMG), sleep(1000).then(() => null)]);

export const drawNeta = (
	g: G,
	img: HTMLImageElement | null,
	k: NetaCell,
	dx: number,
	dy: number,
	scale = 1,
): void => {
	const [sx, sy, sw, sh] = NETA_CELLS[k];
	if (!img) {
		g.fillStyle = "#6a6a72";
		g.fillRect(dx, dy, sw * scale, sh * scale);
		return;
	}
	g.drawImage(img, sx, sy, sw, sh, dx, dy, sw * scale, sh * scale);
};

/**
 * B を ms 以内に 2回で やめる。press は 2回目なら true（1回目は false。呼ぶ 側が「もう　1回で〜」を 出す）。
 * lapsed は 1回目から ms を 過ぎた とき 1度だけ true（呼ぶ 側が「もう　1回で〜」を もとの 字に もどす。
 * 出した ままだと、次の B が「1回目」なのに 字は「あと 1回」の ままに なる）。
 */
export const twoB = (
	ms = 1500,
): { press: (at: number) => boolean; lapsed: (now: number) => boolean } => {
	let last = Number.NEGATIVE_INFINITY;
	return {
		press: (at) => {
			const hit = at - last <= ms;
			last = hit ? Number.NEGATIVE_INFINITY : at;
			return hit;
		},
		lapsed: (now) => {
			if (last === Number.NEGATIVE_INFINITY || now - last <= ms) return false;
			last = Number.NEGATIVE_INFINITY;
			return true;
		},
	};
};

/**
 * A か 板の タップで 押されるのを 待つ（take で 取る）。minigameBoard の presses と 同じで、板の 外の タップだけ B。
 * at は 取られて いない 押しの うち 1つ目が 来た 時刻（performance.now）。
 */
export const pressesB = (
	ctx: UiCtx,
	root: HTMLElement,
): {
	take: () => "a" | "b" | null;
	stop: () => void;
	at: () => number;
} => {
	let pressed: "a" | "b" | null = null;
	let at = 0;
	const press = (k: "a" | "b") => {
		if (pressed === null) at = performance.now();
		pressed = k;
	};
	const pop = ctx.input.push(
		(k, repeat) => {
			if (repeat) return;
			if (k === "a" || k === "b") press(k);
		},
		{ tap: "b" },
	);
	const onDown = (e: PointerEvent) => {
		e.preventDefault();
		press("a");
	};
	root.addEventListener("pointerdown", onDown);
	return {
		take: () => {
			const p = pressed;
			pressed = null;
			return p;
		},
		stop: () => {
			pop();
			root.removeEventListener("pointerdown", onDown);
		},
		at: () => at,
	};
};

/** 連打の あと これより 早い B は 捨てる（スマホで 連打の 指が 板から はみ出した タップ）。 */
export const MASH_B_GUARD_MS = 300;

/**
 * 連打の 数（A・板の タップ。キーの くり返しは 数えない）。板の 外の タップは B（そっ閉じ）。
 * 数えた 押しから MASH_B_GUARD_MS 以内の B は 数えない（わざと やめる ときは 手を 止めてから）。
 */
export const mash = (
	ctx: UiCtx,
	root: HTMLElement,
): { take: () => { a: number; b: boolean }; stop: () => void } => {
	let a = 0;
	let b = false;
	let lastA = Number.NEGATIVE_INFINITY;
	const hit = () => {
		a++;
		lastA = performance.now();
	};
	const pop = ctx.input.push(
		(k, repeat) => {
			if (repeat) return;
			if (k === "a") hit();
			else if (k === "b" && performance.now() - lastA > MASH_B_GUARD_MS)
				b = true;
		},
		{ tap: "b" },
	);
	const onDown = (e: PointerEvent) => {
		e.preventDefault();
		hit();
	};
	root.addEventListener("pointerdown", onDown);
	return {
		take: () => {
			const got = { a, b };
			a = 0;
			b = false;
			return got;
		},
		stop: () => {
			pop();
			root.removeEventListener("pointerdown", onDown);
		},
	};
};

export type PadEv =
	| { k: Key; at: number }
	/** touch＝指（マウス・ペンでは ない）。指は ねらいが ずれるので、リバーシは 1回目で カーソルだけ 動かす。 */
	| { tap: readonly [number, number]; at: number; touch: boolean };

/** 十字キー（くり返しも）・A・B と、キャンバスの タップ（240x150 の 座標）。板の 外の タップは B。 */
export const pad = (
	ctx: UiCtx,
	canvas: HTMLCanvasElement,
): { take: () => PadEv[]; stop: () => void } => {
	let q: PadEv[] = [];
	const pop = ctx.input.push(
		(k, repeat) => {
			const at = performance.now();
			if (k === "a" || k === "b") {
				if (!repeat) q.push({ k, at });
				return;
			}
			if (k === "up" || k === "down" || k === "left" || k === "right")
				q.push({ k, at });
		},
		{ tap: "b" },
	);
	const onDown = (e: PointerEvent) => {
		e.preventDefault();
		const r = canvas.getBoundingClientRect();
		q.push({
			tap: [
				((e.clientX - r.left) * BW) / r.width,
				((e.clientY - r.top) * BH) / r.height,
			],
			at: performance.now(),
			touch: e.pointerType === "touch",
		});
	};
	canvas.addEventListener("pointerdown", onDown);
	return {
		take: () => {
			const got = q;
			q = [];
			return got;
		},
		stop: () => {
			pop();
			canvas.removeEventListener("pointerdown", onDown);
		},
	};
};
