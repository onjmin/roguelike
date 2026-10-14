// 別ゲーの 板（ui/minigames/minigames.ts の 1000取り・ui/minigames/batting.ts の 1打席）に 共通の 道具。
// 村の 窓の 上に 240x150 の 板を 1枚 置き、A／タップ 1つで 遊ぶ。色は style.css の .mgame。

import { el } from "../dom";
import type { UiCtx } from "../list";

/** 板を 1枚 置いて、閉じる 手を 返す。 */
export const board = (
	ctx: UiCtx,
	title: string,
	hint: string,
): {
	root: HTMLElement;
	canvas: HTMLCanvasElement;
	g: CanvasRenderingContext2D;
	note: HTMLElement;
	close: () => void;
} => {
	const canvas = el("canvas", { class: "mgame-canvas" });
	canvas.width = 240;
	canvas.height = 150;
	const note = el("div", { class: "mgame-note", text: "" });
	const root = el("div", { class: "mgame window" }, [
		el("div", { class: "mgame-title", text: title }),
		canvas,
		note,
		el("div", { class: "mgame-hint", text: hint }),
	]);
	ctx.ui.appendChild(root);
	const g = canvas.getContext("2d");
	if (!g) throw new Error("canvas");
	g.imageSmoothingEnabled = false;
	return { root, canvas, g, note, close: () => root.remove() };
};

/** 次の 描画か 50ms（ペインが 隠れて rAF が 止まっても 進む）。 */
export const tick = (): Promise<number> =>
	new Promise((r) => {
		const id = setTimeout(() => r(performance.now()), 50);
		requestAnimationFrame((t) => {
			clearTimeout(id);
			r(t);
		});
	});

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 押しの 時刻と 出どころを 取る 仕組み。窓の 上で キー・指の 押しを 先に（capture で）見て おき、
 * 同じ 押しの 中で 呼ばれた stamp() は その 出来事の 時刻（e.timeStamp。performance.now と 同じ 時計）を 返す。
 * engine/input.ts の 手（キー・画面の A・フィールドの タップ）は 出来事を 渡さないので、ここで 拾う。
 * パッドなど 出来事の ない 押しは いまの 時刻・キー あつかい。
 */
export const evStamps = (): {
	stamp: (e?: Event) => { at: number; touch: boolean };
	stop: () => void;
} => {
	let last: { ts: number; seen: number; touch: boolean } | null = null;
	const tsOf = (e: Event, now: number): number =>
		// 古い ブラウザの 時刻（1970年からの ms など）は 使わない
		e.timeStamp > 0 && e.timeStamp <= now && now - e.timeStamp < 1000
			? e.timeStamp
			: now;
	const touchOf = (e: Event): boolean =>
		e instanceof PointerEvent && e.pointerType !== "mouse";
	const onEv = (e: Event) => {
		const now = performance.now();
		last = { ts: tsOf(e, now), seen: now, touch: touchOf(e) };
	};
	window.addEventListener("keydown", onEv, true);
	window.addEventListener("pointerdown", onEv, true);
	return {
		stamp: (e) => {
			const now = performance.now();
			if (e) return { at: tsOf(e, now), touch: touchOf(e) };
			// 同じ 押しの 中（すぐ あと）なら その 出来事の 時刻
			if (last && now - last.seen < 4)
				return { at: last.ts, touch: last.touch };
			return { at: now, touch: false };
		},
		stop: () => {
			window.removeEventListener("keydown", onEv, true);
			window.removeEventListener("pointerdown", onEv, true);
		},
	};
};

/**
 * A か タップで 押されるのを 待つ 仕組み（take で 取る：押されて いなければ null）。
 * at は 取られて いない 押しの うち 1つ目が 来た 時刻（performance.now の 時計。出来事の 時刻）。1打席は これで 振った 時を はかる
 * （描画の 時刻で はかると、ペインが 隠れた ときの 50ms の 刻みで ずれる）。touch は その 押しが 指（ペン）か。
 */
export const presses = (
	ctx: UiCtx,
	root: HTMLElement,
): {
	take: () => "a" | "b" | null;
	stop: () => void;
	at: () => number;
	touch: () => boolean;
} => {
	let pressed: "a" | "b" | null = null;
	let at = 0;
	let touch = false;
	const ev = evStamps();
	const press = (k: "a" | "b", e?: Event) => {
		if (pressed === null) ({ at, touch } = ev.stamp(e));
		pressed = k;
	};
	const pop = ctx.input.push(
		(k, repeat) => {
			if (repeat) return;
			if (k === "a" || k === "b") press(k);
		},
		{ tap: "a" },
	);
	const onDown = (e: PointerEvent) => {
		e.preventDefault();
		press("a", e);
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
			ev.stop();
			root.removeEventListener("pointerdown", onDown);
		},
		at: () => at,
		touch: () => touch,
	};
};
