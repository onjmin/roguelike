// 別ゲーの 板（ui/minigames.ts の 1000取り・ui/batting.ts の 1打席）に 共通の 道具。
// 村の 窓の 上に 240x150 の 板を 1枚 置き、A／タップ 1つで 遊ぶ。色は style.css の .mgame。

import { el } from "./dom";
import type { UiCtx } from "./list";

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
 * A か タップで 押されるのを 待つ 仕組み（take で 取る：押されて いなければ null）。
 * at は 取られて いない 押しの うち 1つ目が 来た 時刻（performance.now）。1打席は これで 振った 時を はかる
 * （描画の 時刻で はかると、ペインが 隠れた ときの 50ms の 刻みで ずれる）。
 */
export const presses = (
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
		{ tap: "a" },
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
