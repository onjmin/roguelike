// ゲームセンターの 筐体の 板に 共通の 道具（ui/minigames/minigameBoard.ts の board() と ui/neta/netaBoard.ts の 2倍の 下地の 上）。
// - playBoard：コインの 音 → READY → 毎こま step と 描画 → GAME OVER／CLEAR（0.9秒。A・タップで とばす）→ { score }。
//   強い 当たりは f.hitStop(ms) で 板の 時を すこし 止める（ヒットストップ）。
//   B（板の 外の タップ）を 1.5秒 以内に 2回で やめる（null。メダルスロットは やめても 枚数が 残る）。
// - 入力（ArcEv）：十字キー（くり返しは repeat）・A・キャンバスの タップ（240x150 の 座標）。
//   スマホでは 板を 出す あいだ 十字キーと A・B が 隠れる（main.ts の .hud.modal）ので、どの 台も タップだけで 遊べる。
// - 帯（hud）：上の 14px に 題・スコア などを 出す。

import { ARCADE, ARCADE_TEXT } from "../../data/arcade/text";
import type { ArcadeGame } from "../../data/arcade/types";
import type { Key } from "../../engine/input";
import type { UiCtx } from "../list";
import { board, evStamps, sleep, tick } from "../minigames/minigameBoard";
import { BH, BW, crisp, type G, twoB, txt } from "../neta/netaBoard";

/** cash は カジノの 台で やめた ときの 手もとの 枚数（チップ入れに もどす。ui/arcade/casinoChips.ts）。 */
export type ArcadeResult = { score: number; cash?: number };

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
	// 押した 時刻は 出来事の 時刻（e.timeStamp）。音ゲー・格ゲー・ダーツは これで 押した 瞬間を はかる
	const ev = evStamps();
	const pop = ctx.input.push(
		(k, repeat) => {
			q.push({ k, at: ev.stamp().at, repeat });
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
			at: ev.stamp(e).at,
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
			ev.stop();
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
	/** はじめてからの 秒（時計どおり。音ゲーの 押した 時刻と あわせる）。止めた（hitStop）ぶんは 数えない。 */
	clock: number;
	/** その こまの 入力（B は 取りのぞいて ある）。 */
	evs: ArcEv[];
	/** 押した 時刻（performance.now）→ はじめてからの 秒（clock と 同じ 時計）。 */
	secOf: (at: number) => number;
	say: (s: string) => void;
	se: (name: string) => void;
	/**
	 * ヒットストップ：ms の あいだ 板の 時を 止める（描画と ゆれは つづく。止めた あいだの 押しは あとで 渡す）。
	 * 強い 当たりに 60〜100ms。曲の 時計で 進む 台（音ゲー・太鼓）では 使わない（曲は 止まらない）。
	 */
	hitStop: (ms: number) => void;
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
	/** カジノの 台：やめた ときの 手もと（換金する 枚数）。 */
	cash?: (s: S) => number;
	/** はじめの 下の 字（既定は 押し方）。 */
	note?: string;
	/**
	 * 曲の 時計で 動く 台（音ゲー・太鼓）。止める 演出（hitStop・勝ちの 音で 止める）を しない
	 * （曲は 止まらないので、止めると 譜面と 音が ずれる）。
	 */
	songClock?: boolean;
};

/**
 * 大事な 音を 鳴らした 瞬間に 板を 止める 長さ（ms）。victory は 勝ち・役が そろった、
 * levelup は ステージ・ボーナスの 節目。どの 台でも 同じ 手ざわりに（台ごとに 書かない）。
 */
const SE_STOP_MS: Record<string, number> = { victory: 160, levelup: 90 };
/** 決着（おわり）の 瞬間を 止めて 見せてから おわりの 字を 出す（ms）。 */
const END_STOP_MS = 280;

/** おわりの 字を 見せる 長さ（ms）と、A・タップで とばせる までの 間（遊びの 押しの 名残で とばさない）。 */
const END_MS = 900;
const END_GRACE_MS = 250;

/** おわりの 字を 出した まま 待つ（A か タップで 先へ）。 */
const endWait = async (input: { take: () => ArcEv[] }): Promise<void> => {
	const from = performance.now();
	input.take();
	for (;;) {
		const now = await tick();
		if (now - from >= END_MS) return;
		const evs = input.take();
		if (
			now - from >= END_GRACE_MS &&
			evs.some(
				(e) => e.at - from >= END_GRACE_MS && (isKey(e, "a") || isTap(e)),
			)
		)
			return;
	}
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
		// 板の 時（ms）：止めた ぶんを 引く。before は さいごの 止めより 前に 止めた 合計、
		// stopFrom〜stopTo は さいごの 止め（その あいだの 押しは 止めた 時刻に 押した ことに）
		let before = 0;
		let stopFrom = 0;
		let stopTo = 0;
		const gameMs = (at: number): number =>
			at - t0 - before - Math.max(0, Math.min(at, stopTo) - stopFrom);
		let last = 0;
		let now = t0;
		const hitStop = (ms: number) => {
			if (spec.songClock) return;
			if (stopFrom === now) stopTo = Math.max(stopTo, now + ms);
			else {
				before += stopTo - stopFrom;
				stopFrom = now;
				stopTo = now + ms;
			}
		};
		for (;;) {
			now = await tick();
			// 止めて いる あいだは 描くだけ（押しは 取らずに 残す）
			if (now < stopTo) {
				spec.draw(g, s, gameMs(now) / 1000);
				continue;
			}
			const gt = gameMs(now);
			const dt = Math.min(0.05, Math.max(0, (gt - last) / 1000));
			last = gt;
			const evs: ArcEv[] = [];
			for (const e of input.take()) {
				if (isKey(e, "b")) {
					if (quit.press(e.at)) {
						if (!spec.quitScores) return null;
						await sleep(300);
						return { score: spec.score(s), cash: spec.cash?.(s) };
					}
					say(ARCADE.quit1);
				} else evs.push(e);
			}
			if (quit.lapsed(now)) say(spec.note ?? "");
			spec.step(s, {
				dt,
				clock: gt / 1000,
				evs,
				secOf: (at) => gameMs(at) / 1000,
				say,
				se: (name) => {
					ctx.se(name);
					const ms = SE_STOP_MS[name];
					if (ms) hitStop(ms);
				},
				hitStop,
			});
			spec.draw(g, s, gt / 1000);
			if (spec.over(s)) {
				// 決着の 絵の まま 一瞬 止めてから 字を 出す（何が 起きて おわったかを 見る 間）
				if (!spec.songClock) await sleep(END_STOP_MS);
				const end = spec.end?.(s) ?? ARCADE.over;
				banner(g, end, end === ARCADE.clear ? "#ffe060" : "#f4f2ea");
				ctx.se(end === ARCADE.clear ? "victory" : "miss");
				await endWait(input);
				return { score: spec.score(s), cash: spec.cash?.(s) };
			}
		}
	} finally {
		input.stop();
		b.close();
	}
};
