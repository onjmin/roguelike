// ゲームセンターの 筐体の 板に 共通の 道具（ui/minigameBoard.ts の board() と ui/netaBoard.ts の 2倍の 下地の 上）。
// - playBoard：コインの 音 → READY → 毎こま step と 描画 → GAME OVER／CLEAR → { score }。
//   B（板の 外の タップ）を 1.5秒 以内に 2回で やめる（null。メダルスロットは やめても 枚数が 残る）。
// - 入力（ArcEv）：十字キー（くり返しは repeat）・A・キャンバスの タップ（240x150 の 座標）。
//   スマホでは 板を 出す あいだ 十字キーと A・B が 隠れる（main.ts の .hud.modal）ので、どの 台も タップだけで 遊べる。
// - 帯（hud）：上の 14px に 題・スコア などを 出す。

import { ARCADE, ARCADE_TEXT } from "../data/arcade/text";
import type { ArcadeGame } from "../data/arcade/types";
import type { Key } from "../engine/input";
import type { UiCtx } from "./list";
import { board, sleep, tick } from "./minigameBoard";
import { BH, BW, crisp, type G, twoB, txt } from "./netaBoard";

export type ArcadeResult = { score: number };

export type ArcEv =
	| { k: Key; at: number; repeat: boolean }
	| { tap: readonly [number, number]; at: number };

/** 十字キー・A（くり返しの ない もの）・タップ。 */
export const isKey = (e: ArcEv, k: Key, repeatOk = false): boolean =>
	"k" in e && e.k === k && (repeatOk || !e.repeat);
export const isTap = (
	e: ArcEv,
): e is { tap: readonly [number, number]; at: number } => "tap" in e;

const arcInput = (
	ctx: UiCtx,
	canvas: HTMLCanvasElement,
): { take: () => ArcEv[]; stop: () => void } => {
	let q: ArcEv[] = [];
	const pop = ctx.input.push(
		(k, repeat) => {
			q.push({ k, at: performance.now(), repeat });
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

/** 上の 帯（左に 題、右に 字）。 */
export const hud = (g: G, left: string, right: string): void => {
	g.fillStyle = "#06060c";
	g.fillRect(0, 0, BW, 14);
	txt(g, left, 4, 3, 8, "#f0c040");
	txt(g, right, BW - 4, 3, 8, "#e8e8f0", "right");
};

/** まんなかの 大きな 字（READY・GAME OVER など）。 */
export const banner = (g: G, s: string, ink = "#f4f2ea"): void => {
	g.fillStyle = "rgba(0,0,0,0.55)";
	g.fillRect(0, 60, BW, 30);
	txt(g, s, BW / 2, 67, 16, ink, "center");
};

/** 四角の 中に 1字（荒らしの レス・札 など）。 */
export const chip = (
	g: G,
	x: number,
	y: number,
	w: number,
	h: number,
	fill: string,
	s: string,
	ink = "#ffffff",
	px = 8,
): void => {
	g.fillStyle = fill;
	g.fillRect(Math.round(x - w / 2), Math.round(y - h / 2), w, h);
	if (s) txt(g, s, Math.round(x), Math.round(y - px / 2), px, ink, "center");
};

export type Frame = {
	/** 前の こまからの 秒（0.05秒まで）。 */
	dt: number;
	/** はじめてからの 秒（時計どおり。音ゲーの 押した 時刻と あわせる）。 */
	clock: number;
	/** その こまの 入力（B は 取りのぞいて ある）。 */
	evs: ArcEv[];
	/** 押した 時刻（performance.now）→ はじめてからの 秒。 */
	secOf: (at: number) => number;
	say: (s: string) => void;
	se: (name: string) => void;
};

export type BoardSpec<S> = {
	start: () => S;
	step: (s: S, f: Frame) => void;
	draw: (g: G, s: S, clock: number) => void;
	over: (s: S) => boolean;
	score: (s: S) => number;
	/** おわりの 字（既定は GAME OVER）。 */
	end?: (s: S) => string;
	/** B で やめても スコアに する（メダルスロットの 払いもどし）。 */
	quitScores?: boolean;
	/** はじめの 下の 字（既定は 押し方）。 */
	note?: string;
};

/** 板を 出して 遊ぶ（やめたら null）。 */
export const playBoard = async <S>(
	ctx: UiCtx,
	game: ArcadeGame,
	spec: BoardSpec<S>,
): Promise<ArcadeResult | null> => {
	const t = ARCADE_TEXT[game];
	const b = board(ctx, t.title, t.hint);
	const g = crisp(b);
	const input = arcInput(ctx, b.canvas);
	const quit = twoB();
	const say = (s: string) => {
		b.note.textContent = s;
	};
	const s = spec.start();
	try {
		ctx.se("arcCoin");
		spec.draw(g, s, 0);
		banner(g, ARCADE.ready);
		say(spec.note ?? "");
		await sleep(900);
		ctx.se("arcStart");
		input.take();
		const t0 = performance.now();
		let last = t0;
		for (;;) {
			const now = await tick();
			const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
			last = now;
			const evs: ArcEv[] = [];
			for (const e of input.take()) {
				if (isKey(e, "b")) {
					if (quit.press(e.at)) {
						if (!spec.quitScores) return null;
						await sleep(300);
						return { score: spec.score(s) };
					}
					say(ARCADE.quit1);
				} else evs.push(e);
			}
			if (quit.lapsed(now)) say(spec.note ?? "");
			spec.step(s, {
				dt,
				clock: (now - t0) / 1000,
				evs,
				secOf: (at) => (at - t0) / 1000,
				say,
				se: ctx.se,
			});
			spec.draw(g, s, (now - t0) / 1000);
			if (spec.over(s)) {
				const end = spec.end?.(s) ?? ARCADE.over;
				banner(g, end, end === ARCADE.clear ? "#ffe060" : "#f4f2ea");
				ctx.se(end === ARCADE.clear ? "victory" : "miss");
				await sleep(1600);
				return { score: spec.score(s) };
			}
		}
	} finally {
		input.stop();
		b.close();
	}
};
