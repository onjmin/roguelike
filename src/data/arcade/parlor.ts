// カジノ「ガチャ」の 台と、海の家・バーの 遊びの 決まり（板＝ui/arcadeParlor.ts は 描く だけ）。
// data/arcade/logic.ts と 同じく 状態 + step(状態, 秒, 入力, 乱数) の 形（src/sim/arcadeTests.ts が 回す）。
// カジノの チップは 店が 貸す 遊びの チップ（ゴールドとは 別。席を 立つと 返す）。スコアは 手もとに 持った いちばん 多い 枚数。

import type { Rnd } from "./logic";

const clamp = (v: number, lo: number, hi: number): number =>
	Math.max(lo, Math.min(hi, v));

// ───────────────── ガチャスロット ─────────────────
// A で 1枚 入れて 引く。リールは 左から 自動で 止まる（目押し なし）。左 2つが SR 以上で そろうと リーチ（3つ目が おそい）。
// 3つ そろうと 払いだし、左 2つ だけ そろうと 1枚 もどる。

export const GC_SYMS = ["UR", "SSR", "SR", "R", "N"] as const;
export type GcSym = (typeof GC_SYMS)[number];
/** 出やすさ（1つの リールで）。 */
export const GC_WEIGHT: Record<GcSym, number> = {
	UR: 1,
	SSR: 2,
	SR: 4,
	R: 6,
	N: 8,
};
/** 3つ そろった ときの 払いだし。 */
export const GC_PAY: Record<GcSym, number> = {
	UR: 300,
	SSR: 60,
	SR: 15,
	R: 5,
	N: 2,
};
export const GC = {
	start: 30,
	cap: 9999,
	/** 左 2つ だけ そろった ときの もどり。 */
	pair: 1,
	/** リールの 止まる 時刻（引いてから。リーチなら 3つ目に reach を 足す）。 */
	stops: [0.6, 0.95, 1.3] as readonly number[],
	reach: 0.9,
	pay: 0.9,
} as const;

export type GcPhase = "idle" | "spin" | "pay";
export type GcState = {
	chips: number;
	best: number;
	phase: GcPhase;
	t: number;
	reels: GcSym[];
	stopped: number;
	reach: boolean;
	lastWin: number;
	pulls: number;
	over: boolean;
};
export type GcEvent =
	| "pull"
	| "stop"
	| "reach"
	| "win"
	| "pair"
	| "lose"
	| "bust";

export const gcStart = (): GcState => ({
	chips: GC.start,
	best: GC.start,
	phase: "idle",
	t: 0,
	reels: ["N", "R", "SR"],
	stopped: 3,
	reach: false,
	lastWin: 0,
	pulls: 0,
	over: false,
});

export const gcRoll = (rnd: Rnd): GcSym => {
	const total = GC_SYMS.reduce((n, s) => n + GC_WEIGHT[s], 0);
	let r = rnd() * total;
	for (const s of GC_SYMS) {
		r -= GC_WEIGHT[s];
		if (r < 0) return s;
	}
	return "N";
};

const gcRare = (s: GcSym | undefined): boolean =>
	s === "UR" || s === "SSR" || s === "SR";

/** そろい方の 払いだし（3つ → 表、左 2つ → 1枚、ほか 0）。 */
export const gcPayout = (r: readonly GcSym[]): number => {
	const [a, b, c] = r;
	if (!a) return 0;
	if (a === b && b === c) return GC_PAY[a];
	if (a === b) return GC.pair;
	return 0;
};

/** その リールが 止まる 時刻。 */
export const gcStopAt = (s: GcState, i: number): number =>
	(GC.stops[i] ?? 0) + (i === 2 && s.reach ? GC.reach : 0);

export const gcStep = (
	s: GcState,
	dt: number,
	press: boolean,
	rnd: Rnd,
): GcEvent[] => {
	const ev: GcEvent[] = [];
	if (s.over) return ev;
	if (s.phase === "idle" && press && s.chips > 0) {
		s.chips--;
		s.pulls++;
		s.reels = [gcRoll(rnd), gcRoll(rnd), gcRoll(rnd)];
		s.reach = s.reels[0] === s.reels[1] && gcRare(s.reels[0]);
		s.stopped = 0;
		s.t = 0;
		s.phase = "spin";
		s.lastWin = 0;
		ev.push("pull");
		return ev;
	}
	if (s.phase === "spin") {
		s.t += dt;
		while (s.stopped < 3 && s.t >= gcStopAt(s, s.stopped)) {
			s.stopped++;
			ev.push("stop");
			if (s.stopped === 2 && s.reach) ev.push("reach");
		}
		if (s.stopped === 3) {
			s.lastWin = gcPayout(s.reels);
			s.chips = Math.min(GC.cap, s.chips + s.lastWin);
			s.best = Math.max(s.best, s.chips);
			ev.push(s.lastWin > GC.pair ? "win" : s.lastWin > 0 ? "pair" : "lose");
			s.phase = "pay";
			s.t = 0;
		}
	} else if (s.phase === "pay") {
		s.t += dt;
		if (s.t >= GC.pay) {
			s.phase = "idle";
			if (s.chips <= 0) {
				s.over = true;
				ev.push("bust");
			} else if (s.chips >= GC.cap) s.over = true;
		}
	}
	return ev;
};

// ───────────────── ハイ＆ロー ─────────────────
// 場の カードより 次が 高いか 低いか。当たれば 賭けが 倍、同じ 数なら そのまま、はずれたら 賭けが なくなる。
// 1回ごとに 1枚 賭けて はじめ、当てつづけて いつでも「降りる」で 手もとへ。10連勝で 自動で 降りる。

export const HL = {
	start: 20,
	cap: 9999,
	bet: 1,
	maxStreak: 10,
	reveal: 0.8,
} as const;

export type HlChoice = "high" | "low" | "take";
export type HlPhase = "guess" | "reveal";
export type HlOutcome = "win" | "push" | "lose";
export type HlState = {
	chips: number;
	best: number;
	/** 賭けて いる 枚数（0 なら 次の 当てで 1枚 賭ける）。 */
	pot: number;
	streak: number;
	card: number;
	next: number | null;
	phase: HlPhase;
	t: number;
	last: HlOutcome | null;
	over: boolean;
};
export type HlEvent = "bet" | "flip" | HlOutcome | "take" | "bust";

export const hlDraw = (rnd: Rnd): number => 1 + Math.floor(rnd() * 13);

export const hlStart = (rnd: Rnd): HlState => ({
	chips: HL.start,
	best: HL.start,
	pot: 0,
	streak: 0,
	card: 2 + Math.floor(rnd() * 11),
	next: null,
	phase: "guess",
	t: 0,
	last: null,
	over: false,
});

/** 当たりか（同じ 数は push）。 */
export const hlJudge = (
	card: number,
	next: number,
	c: "high" | "low",
): HlOutcome =>
	next === card ? "push" : next > card === (c === "high") ? "win" : "lose";

/** やめた ときも 賭けて いる 分は 手もとに（降りたのと 同じ）。 */
export const hlScore = (s: HlState): number =>
	Math.max(s.best, s.chips + s.pot);

const hlTake = (s: HlState, ev: HlEvent[]): void => {
	s.chips = Math.min(HL.cap, s.chips + s.pot);
	s.best = Math.max(s.best, s.chips);
	s.pot = 0;
	s.streak = 0;
	ev.push("take");
};

export const hlStep = (
	s: HlState,
	dt: number,
	c: HlChoice | null,
	rnd: Rnd,
): HlEvent[] => {
	const ev: HlEvent[] = [];
	if (s.over) return ev;
	if (s.phase === "reveal") {
		s.t += dt;
		if (s.t < HL.reveal) return ev;
		s.card = s.next ?? s.card;
		s.next = null;
		s.phase = "guess";
		if (s.streak >= HL.maxStreak) hlTake(s, ev);
		if (s.pot === 0 && s.chips <= 0) {
			s.over = true;
			ev.push("bust");
		}
		return ev;
	}
	if (!c) return ev;
	if (c === "take") {
		if (s.pot > 0) hlTake(s, ev);
		return ev;
	}
	if (s.pot === 0) {
		if (s.chips < HL.bet) return ev;
		s.chips -= HL.bet;
		s.pot = HL.bet;
		ev.push("bet");
	}
	const next = hlDraw(rnd);
	const r = hlJudge(s.card, next, c);
	s.next = next;
	s.last = r;
	s.phase = "reveal";
	s.t = 0;
	if (r === "win") {
		s.pot *= 2;
		s.streak++;
	} else if (r === "lose") {
		s.pot = 0;
		s.streak = 0;
	}
	ev.push("flip", r);
	return ev;
};

// ───────────────── ルーレット ─────────────────
// 赤・黒・緑（0）の どれかに 1・5・10枚 賭けて 回す。赤・黒は 2倍、緑は 14倍（37の ポケット）。

/** 盤の 並び（ヨーロッパ式）。 */
export const RL_WHEEL: readonly number[] = [
	0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
	16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
export const RL_RED: ReadonlySet<number> = new Set([
	1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);
export type RlColor = "red" | "black" | "green";
export const RL_COLORS: readonly RlColor[] = ["red", "black", "green"];
export const RL_AMOUNTS: readonly number[] = [1, 5, 10];
export const RL_PAY: Record<RlColor, number> = { red: 2, black: 2, green: 14 };
export const RL = {
	start: 30,
	cap: 9999,
	spin: 3.2,
	pay: 1.3,
	/** 回る あいだに 少なくとも まわる 周（ポケットの 数で）。 */
	laps: 3,
} as const;

export const rlColorOf = (n: number): RlColor =>
	n === 0 ? "green" : RL_RED.has(n) ? "red" : "black";

export type RlPhase = "bet" | "spin" | "pay";
export type RlState = {
	chips: number;
	best: number;
	color: RlColor;
	amount: number;
	phase: RlPhase;
	t: number;
	/** 盤の 位置（RL_WHEEL の 番。小数は 回って いる 途中）。 */
	pos: number;
	from: number;
	total: number;
	/** 止まる ポケットの 番（RL_WHEEL の）。 */
	result: number;
	lastWin: number;
	spins: number;
	over: boolean;
};
export type RlEvent = "pick" | "spin" | "tick" | "win" | "lose" | "bust";

export const rlStart = (): RlState => ({
	chips: RL.start,
	best: RL.start,
	color: "red",
	amount: 1,
	phase: "bet",
	t: 0,
	pos: 0,
	from: 0,
	total: 0,
	result: 0,
	lastWin: 0,
	spins: 0,
	over: false,
});

/** 止まった 数。 */
export const rlNumber = (s: RlState): number =>
	RL_WHEEL[((Math.round(s.pos) % 37) + 37) % 37] ?? 0;

export const rlStep = (
	s: RlState,
	dt: number,
	ip: { color?: RlColor; amount?: number; spin: boolean },
	rnd: Rnd,
): RlEvent[] => {
	const ev: RlEvent[] = [];
	if (s.over) return ev;
	if (s.phase === "bet") {
		if (ip.color && ip.color !== s.color) {
			s.color = ip.color;
			ev.push("pick");
		}
		if (ip.amount !== undefined && ip.amount !== s.amount) {
			s.amount = ip.amount;
			ev.push("pick");
		}
		if (ip.spin) {
			const bet = Math.min(s.amount, s.chips);
			if (bet <= 0) return ev;
			s.amount = bet;
			s.chips -= bet;
			s.spins++;
			s.result = Math.floor(rnd() * 37);
			s.from = ((Math.round(s.pos) % 37) + 37) % 37;
			const ahead = (s.result - s.from + 37) % 37;
			s.total = 37 * RL.laps + ahead;
			s.t = 0;
			s.lastWin = 0;
			s.phase = "spin";
			ev.push("spin");
		}
		return ev;
	}
	if (s.phase === "spin") {
		const before = Math.floor(s.pos);
		s.t = Math.min(RL.spin, s.t + dt);
		const k = s.t / RL.spin;
		// だんだん おそく（3乗で 止まる）
		s.pos = s.from + s.total * (1 - (1 - k) ** 3);
		if (Math.floor(s.pos) !== before) ev.push("tick");
		if (s.t >= RL.spin) {
			s.pos = s.result;
			const n = RL_WHEEL[s.result] ?? 0;
			if (rlColorOf(n) === s.color) {
				s.lastWin = s.amount * RL_PAY[s.color];
				s.chips = Math.min(RL.cap, s.chips + s.lastWin);
				s.best = Math.max(s.best, s.chips);
				ev.push("win");
			} else ev.push("lose");
			s.phase = "pay";
			s.t = 0;
		}
		return ev;
	}
	s.t += dt;
	if (s.t >= RL.pay) {
		s.phase = "bet";
		s.amount = Math.min(s.amount, Math.max(1, s.chips));
		if (s.chips <= 0) {
			s.over = true;
			ev.push("bust");
		} else if (s.chips >= RL.cap) s.over = true;
	}
	return ev;
};

// ───────────────── スイカ割り ─────────────────
// 目かくしの キリコが 浜（11×7マス）を 1歩ずつ 歩き、名無したちの 声を たよりに スイカの 上で 棒を ふる。
// ときどき 荒らしが うその 方を 言う（名前で わかる）。25秒。当たれば 100点 ＋ 残り 秒×4、となりなら かすり 30点。

export const SK_W = 11;
export const SK_H = 7;
export const SW = {
	time: 25,
	hint: 1.3,
	troll: 0.22,
	hit: 100,
	near: 30,
	perSec: 4,
} as const;

export type SwDir = "up" | "down" | "left" | "right";
export type SwHint = {
	who: "nanashi" | "troll";
	/** 言った 方（荒らしは うそ）。null は「そこ」。 */
	dir: SwDir | null;
	/** 距離の ことば（0＝そこ、1＝あと 1歩、2＝ちかい、3＝まだまだ）。 */
	near: 0 | 1 | 2 | 3;
};
export type SwResult = "hit" | "near" | "miss";
export type SwState = {
	t: number;
	x: number;
	y: number;
	sx: number;
	sy: number;
	next: number;
	hints: SwHint[];
	result: SwResult | null;
	score: number;
	over: boolean;
};
export type SwEvent = "step" | "bump" | "hint" | SwResult | "timeup";

const DIRV: Record<SwDir, readonly [number, number]> = {
	up: [0, -1],
	down: [0, 1],
	left: [-1, 0],
	right: [1, 0],
};

export const swStart = (rnd: Rnd): SwState => {
	const x = Math.floor(SK_W / 2);
	const y = SK_H - 1;
	// スイカは 4歩より 遠くに
	let sx = 0;
	let sy = 0;
	for (let i = 0; i < 100; i++) {
		sx = Math.floor(rnd() * SK_W);
		sy = Math.floor(rnd() * (SK_H - 1));
		if (Math.abs(sx - x) + Math.abs(sy - y) >= 4) break;
	}
	return {
		t: 0,
		x,
		y,
		sx,
		sy,
		next: 0.4,
		hints: [],
		result: null,
		score: 0,
		over: false,
	};
};

export const swDistance = (s: SwState): number =>
	Math.abs(s.sx - s.x) + Math.abs(s.sy - s.y);

/** ほんとうの 声（遠い ほうの 軸を 先に 言う）。 */
export const swTruth = (s: SwState): SwHint => {
	const dx = s.sx - s.x;
	const dy = s.sy - s.y;
	const d = Math.abs(dx) + Math.abs(dy);
	const dir: SwDir | null =
		d === 0
			? null
			: Math.abs(dx) >= Math.abs(dy)
				? dx > 0
					? "right"
					: "left"
				: dy > 0
					? "down"
					: "up";
	return {
		who: "nanashi",
		dir,
		near: d === 0 ? 0 : d === 1 ? 1 : d <= 3 ? 2 : 3,
	};
};

const OPP: Record<SwDir, SwDir> = {
	up: "down",
	down: "up",
	left: "right",
	right: "left",
};

export const swStep = (
	s: SwState,
	dt: number,
	ip: { move?: SwDir; swing: boolean },
	rnd: Rnd,
): SwEvent[] => {
	const ev: SwEvent[] = [];
	if (s.over) return ev;
	if (ip.move) {
		const [dx, dy] = DIRV[ip.move];
		const nx = clamp(s.x + dx, 0, SK_W - 1);
		const ny = clamp(s.y + dy, 0, SK_H - 1);
		if (nx === s.x && ny === s.y) ev.push("bump");
		else {
			s.x = nx;
			s.y = ny;
			ev.push("step");
			// 歩いたら すぐ 次の 声（待たせない）
			s.next = Math.min(s.next, 0.35);
		}
	}
	if (ip.swing) {
		const d = swDistance(s);
		s.result = d === 0 ? "hit" : d === 1 ? "near" : "miss";
		s.score =
			s.result === "hit"
				? SW.hit + Math.ceil(Math.max(0, SW.time - s.t)) * SW.perSec
				: s.result === "near"
					? SW.near
					: 0;
		s.over = true;
		ev.push(s.result);
		return ev;
	}
	s.t += dt;
	s.next -= dt;
	if (s.next <= 0) {
		s.next = SW.hint;
		const truth = swTruth(s);
		// はじめの 2つは ほんとう。そこに いる ときは 荒らしも だまる
		const lie = s.hints.length >= 2 && truth.dir && rnd() < SW.troll;
		s.hints.push(
			lie && truth.dir
				? { who: "troll", dir: OPP[truth.dir], near: truth.near }
				: truth,
		);
		ev.push("hint");
	}
	if (s.t >= SW.time) {
		s.result = "miss";
		s.over = true;
		ev.push("timeup");
	}
	return ev;
};

// ───────────────── グラス滑らせ ─────────────────
// バーの カウンターで グラスを 滑らせ、客の 前で 止める。A で 力を 決める（ゲージは 行ったり 来たり）。
// 5杯。ぴったり（3px 以内）で 100点、はなれる ほど 減る。カウンターの はしを 越えると 割れて 0点。

export const GS = {
	rounds: 5,
	startX: 16,
	endX: 232,
	counterY: 92,
	/** 減速（px／秒²）。 */
	decel: 100,
	vMin: 60,
	vSpan: 190,
	exact: 3,
	perPx: 4,
	result: 1.1,
} as const;

export type GsPhase = "aim" | "slide" | "result";
export type GsState = {
	round: number;
	phase: GsPhase;
	t: number;
	/** 力のゲージ（0〜1）。 */
	power: number;
	x: number;
	v: number;
	target: number;
	last: number | null;
	broke: boolean;
	score: number;
	over: boolean;
};
export type GsEvent = "release" | "stop" | "break" | "next";

/** ゲージが 1往復する 秒（杯ごとに 速く）。 */
export const gsPeriod = (round: number): number =>
	Math.max(0.8, 1.4 - round * 0.15);

export const gsTarget = (rnd: Rnd): number => 140 + Math.floor(rnd() * 76);

export const gsStart = (rnd: Rnd): GsState => ({
	round: 0,
	phase: "aim",
	t: 0,
	power: 0,
	x: GS.startX,
	v: 0,
	target: gsTarget(rnd),
	last: null,
	broke: false,
	score: 0,
	over: false,
});

/** 力 p で 滑らせた ときに 止まる 位置。 */
export const gsStopX = (p: number): number => {
	const v = GS.vMin + clamp(p, 0, 1) * GS.vSpan;
	return GS.startX + (v * v) / (2 * GS.decel);
};

/** 止まった 位置の 点。 */
export const gsPoints = (x: number, target: number): number => {
	const d = Math.abs(x - target);
	return d <= GS.exact
		? 100
		: Math.max(0, Math.round(100 - (d - GS.exact) * GS.perPx));
};

export const gsStep = (
	s: GsState,
	dt: number,
	press: boolean,
	rnd: Rnd,
): GsEvent[] => {
	const ev: GsEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	if (s.phase === "aim") {
		// 押した ときは 見えて いた ゲージの まま（進めてから 読むと 1こま ずれる）
		if (press) {
			s.v = GS.vMin + s.power * GS.vSpan;
			s.phase = "slide";
			s.t = 0;
			ev.push("release");
		} else {
			const per = gsPeriod(s.round);
			const k = (s.t % per) / per;
			s.power = k < 0.5 ? k * 2 : 2 - k * 2;
		}
	} else if (s.phase === "slide") {
		s.x += s.v * dt;
		s.v -= GS.decel * dt;
		if (s.x > GS.endX) {
			s.broke = true;
			s.last = 0;
			s.phase = "result";
			s.t = 0;
			ev.push("break");
		} else if (s.v <= 0) {
			s.v = 0;
			s.last = gsPoints(s.x, s.target);
			s.score += s.last;
			s.phase = "result";
			s.t = 0;
			ev.push("stop");
		}
	} else if (s.t >= GS.result) {
		s.round++;
		if (s.round >= GS.rounds) {
			s.over = true;
			return ev;
		}
		s.phase = "aim";
		s.t = 0;
		s.x = GS.startX;
		s.v = 0;
		s.broke = false;
		s.last = null;
		s.target = gsTarget(rnd);
		ev.push("next");
	}
	return ev;
};
