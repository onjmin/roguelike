// デイトレ・FX の 板に 共通の 道具（ui/minigames/minigameBoard.ts の board() と ui/neta/netaBoard.ts の 2倍の 下地の 上）。
// - runTrade：READY → 毎こま step と 描画 → 場が 終わる（over）→ 結果。B（板の 外の タップ）を 1.5秒 以内に 2回で
//   やめる（やめても 持ち高は その 場の 値で 決済する ので、結果は かならず 返す）。
// - 入力：十字キー・A（くり返しの ない もの）と キャンバスの タップ（240x150 の 座標）。
// - 値の 線（drawLine）・帯（hud）・下の 字（say）。

import { ARCADE } from "../../data/arcade/text";
import type { Key } from "../../engine/input";
import type { UiCtx } from "../list";
import { board, sleep, tick } from "../minigames/minigameBoard";
import { BH, BW, crisp, type G, twoB, txt } from "../neta/netaBoard";

export type TradeEv =
	| { k: Key; at: number }
	| { tap: readonly [number, number]; at: number };

export type TradeFrame = {
	dt: number;
	clock: number;
	evs: TradeEv[];
	say: (s: string) => void;
	se: (name: string) => void;
};

export type TradeSpec<S> = {
	title: string;
	hint: string;
	note: string;
	start: () => S;
	step: (s: S, f: TradeFrame) => void;
	draw: (g: G, s: S) => void;
	over: (s: S) => boolean;
	/** おわりの 大きな 字。 */
	end: (s: S) => string;
	/** やめた ときに 持ち高を 閉じる。 */
	quit: (s: S) => void;
};

const input = (
	ctx: UiCtx,
	canvas: HTMLCanvasElement,
): { take: () => TradeEv[]; stop: () => void } => {
	let q: TradeEv[] = [];
	const pop = ctx.input.push(
		(k, repeat) => {
			if (!repeat) q.push({ k, at: performance.now() });
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

/** まんなかの 大きな 字。 */
export const banner = (g: G, s: string, ink = "#f4f2ea"): void => {
	g.fillStyle = "rgba(0,0,0,0.6)";
	g.fillRect(0, 60, BW, 30);
	txt(g, s, BW / 2, 67, 16, ink, "center");
};

/** 上の 帯（左に 題、右に 字）。 */
export const hud = (g: G, left: string, right: string): void => {
	g.fillStyle = "#06060c";
	g.fillRect(0, 0, BW, 14);
	txt(g, left, 4, 3, 8, "#f0c040");
	txt(g, right, BW - 4, 3, 8, "#e8e8f0", "right");
};

/**
 * 値の 線（x, y, w, h の 枠に、vals を 左から。いちばん 右が いま）。lines は 横の 線（建値など）。
 * 上げは 緑、下げは 赤（はじめの 値と くらべる）。
 */
export const drawLine = (
	g: G,
	vals: readonly number[],
	box: { x: number; y: number; w: number; h: number; slots: number },
	lines: readonly { v: number; ink: string }[] = [],
): void => {
	const { x, y, w, h, slots } = box;
	g.fillStyle = "#0c1018";
	g.fillRect(x, y, w, h);
	g.strokeStyle = "#1c2430";
	g.lineWidth = 1;
	for (let i = 1; i < 4; i++) {
		const yy = Math.round(y + (h * i) / 4) + 0.5;
		g.beginPath();
		g.moveTo(x, yy);
		g.lineTo(x + w, yy);
		g.stroke();
	}
	if (!vals.length) return;
	const all = [...vals, ...lines.map((l) => l.v)];
	let lo = Math.min(...all);
	let hi = Math.max(...all);
	const pad = Math.max((hi - lo) * 0.1, Math.abs(hi) * 0.002, 1e-6);
	lo -= pad;
	hi += pad;
	const yOf = (v: number) => y + h - ((v - lo) / (hi - lo)) * h;
	const xOf = (i: number) => x + (i / Math.max(1, slots - 1)) * w;
	for (const l of lines) {
		g.strokeStyle = l.ink;
		g.setLineDash([3, 2]);
		g.beginPath();
		g.moveTo(x, Math.round(yOf(l.v)) + 0.5);
		g.lineTo(x + w, Math.round(yOf(l.v)) + 0.5);
		g.stroke();
		g.setLineDash([]);
	}
	const first = vals[0] ?? 0;
	const last = vals[vals.length - 1] ?? 0;
	g.strokeStyle = last >= first ? "#50e090" : "#ff6060";
	g.lineWidth = 1.5;
	g.beginPath();
	vals.forEach((v, i) => {
		if (i === 0) g.moveTo(xOf(i), yOf(v));
		else g.lineTo(xOf(i), yOf(v));
	});
	g.stroke();
	g.lineWidth = 1;
	g.fillStyle = "#ffffff";
	g.fillRect(
		Math.round(xOf(vals.length - 1)) - 1,
		Math.round(yOf(last)) - 1,
		3,
		3,
	);
};

/** 板を 出して 場を 回す（B×2 で やめても quit で 決済して 返す）。 */
export const runTrade = async <S>(
	ctx: UiCtx,
	spec: TradeSpec<S>,
): Promise<S> => {
	const b = board(ctx, spec.title, spec.hint);
	const g = crisp(b);
	const inp = input(ctx, b.canvas);
	const quit = twoB();
	const say = (s: string) => {
		b.note.textContent = s;
	};
	const s = spec.start();
	try {
		spec.draw(g, s);
		banner(g, ARCADE.ready);
		say(spec.note);
		await sleep(900);
		ctx.se("arcStart");
		inp.take();
		const t0 = performance.now();
		let last = t0;
		for (;;) {
			const now = await tick();
			const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
			last = now;
			const evs: TradeEv[] = [];
			for (const e of inp.take()) {
				if ("k" in e && e.k === "b") {
					if (quit.press(e.at)) {
						spec.quit(s);
						spec.draw(g, s);
						banner(g, spec.end(s));
						await sleep(1000);
						return s;
					}
					say(ARCADE.quit1);
				} else evs.push(e);
			}
			if (quit.lapsed(now)) say(spec.note);
			spec.step(s, { dt, clock: (now - t0) / 1000, evs, say, se: ctx.se });
			spec.draw(g, s);
			if (spec.over(s)) {
				banner(g, spec.end(s));
				await sleep(1600);
				return s;
			}
		}
	} finally {
		inp.stop();
		b.close();
	}
};
