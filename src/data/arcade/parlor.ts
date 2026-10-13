// カジノ「ガチャ」の 台と、海の家・バーの 遊びの 決まり（板＝ui/arcade/arcadeParlor.ts は 描く だけ）。
// data/arcade/logic.ts と 同じく 状態 + step(状態, 秒, 入力, 乱数) の 形（src/sim/arcadeTests.ts が 回す）。
// カジノの チップは 財布の お金で 買い、席を 立つと 換金する（2026-10-14 作者：「お金を 賭けない 方針は 撤廃」。
// 1枚 100円。ui/arcade/casinoChips.ts）。はじめの 枚数は 買った 枚数（xxStart の 引数）。
// スコアは 手もとに 持った いちばん 多い 枚数、換金は やめた ときの 手もと（xxCash）。

import type { Rnd } from "./logic";

const clamp = (v: number, lo: number, hi: number): number =>
	Math.max(lo, Math.min(hi, v));

// ───────────────── ガチャスロット ─────────────────
// A で 1枚 入れて 引く。リールは 左から 自動で 止まる（目押し なし）。左 2つが SR 以上で そろうと リーチ（3つ目が おそい）。
// 3つ そろうと 払いだし、左 2つ だけ そろうと 1枚 もどる。
// - 予告：SR 以上が そろう 引きは ときどき 引いた とたんに 光る（たまに ガセ）。
// - 天井：SSR 以上が そろわないまま GC.ceiling 回 引くと、次は SSR 以上 確定。
// - 確変：SSR 以上が そろうと、つづく GC.fever 回は N が 出ない（そろいやすい）。
// 払いもどしは 平均で 入れた 枚数より すこし 少ない（いつかは なくなる。スコアは いちばん 多い ときの 枚数）。

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
	R: 6,
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
	/** SSR 以上が そろわないまま 引ける 回数（これを 越えた 引きは SSR 確定）。 */
	ceiling: 200,
	/** 確変の 回数。 */
	fever: 5,
	/** 予告（SR 以上が そろう 引きで 出る 割合・ほかの 引きで 出る ガセの 割合）。 */
	omen: 0.5,
	fakeOmen: 0.03,
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
	/** SSR 以上が そろってから 引いた 回数（天井の 数え）。 */
	since: number;
	/** のこりの 確変の 回数。 */
	fever: number;
	/** この 引きが 確変中か・天井か・予告が 出たか。 */
	feverPull: boolean;
	ceilingPull: boolean;
	omen: boolean;
	over: boolean;
};
export type GcEvent =
	| "pull"
	| "omen"
	| "ceiling"
	| "stop"
	| "reach"
	| "win"
	| "big"
	| "fever"
	| "pair"
	| "lose"
	| "bust";

export const gcStart = (chips: number = GC.start): GcState => ({
	chips,
	best: chips,
	phase: "idle",
	t: 0,
	reels: ["N", "R", "SR"],
	stopped: 3,
	reach: false,
	lastWin: 0,
	pulls: 0,
	since: 0,
	fever: 0,
	feverPull: false,
	ceilingPull: false,
	omen: false,
	over: false,
});

/** 1つの リールの 目（確変中は N が 出ない）。 */
export const gcRoll = (rnd: Rnd, fever = false): GcSym => {
	const syms = fever ? GC_SYMS.filter((s) => s !== "N") : GC_SYMS;
	const total = syms.reduce((n, s) => n + GC_WEIGHT[s], 0);
	let r = rnd() * total;
	for (const s of syms) {
		r -= GC_WEIGHT[s];
		if (r < 0) return s;
	}
	return fever ? "R" : "N";
};

const gcRare = (s: GcSym | undefined): boolean =>
	s === "UR" || s === "SSR" || s === "SR";
const gcPremium = (s: GcSym | undefined): boolean => s === "UR" || s === "SSR";

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

/** 天井まで あと 何回（0 なら 次が 確定）。 */
export const gcToCeiling = (s: GcState): number =>
	Math.max(0, GC.ceiling - s.since);

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
		s.feverPull = s.fever > 0;
		if (s.feverPull) s.fever--;
		s.ceilingPull = s.since >= GC.ceiling;
		if (s.ceilingPull) s.reels = ["SSR", "SSR", "SSR"];
		else
			s.reels = [
				gcRoll(rnd, s.feverPull),
				gcRoll(rnd, s.feverPull),
				gcRoll(rnd, s.feverPull),
			];
		s.since++;
		s.reach = s.reels[0] === s.reels[1] && gcRare(s.reels[0]);
		const big = gcPayout(s.reels) >= GC_PAY.SR;
		s.omen =
			!s.ceilingPull && rnd() < (big ? GC.omen : s.reach ? 0 : GC.fakeOmen);
		s.stopped = 0;
		s.t = 0;
		s.phase = "spin";
		s.lastWin = 0;
		ev.push("pull");
		if (s.ceilingPull) ev.push("ceiling");
		else if (s.omen) ev.push("omen");
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
			if (s.lastWin > GC.pair) {
				ev.push("win");
				if (s.lastWin >= GC_PAY.SR) ev.push("big");
				if (gcPremium(s.reels[0])) {
					s.since = 0;
					s.fever = GC.fever;
					ev.push("fever");
				}
			} else ev.push(s.lastWin > 0 ? "pair" : "lose");
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
// 場の カードより 次が 高いか 低いか。当たれば 賭けに 倍率が かかる（当たりにくい ほど 高い）、同じ 数なら そのまま、
// はずれたら 賭けが なくなる。賭けの ない ときは ↑↓ で はじめに 賭ける 枚数（1・5・10）を えらぶ。
// 当てつづけて いつでも「降りる」で 手もとへ（端数は 切りすて）。10連勝で 自動で 降りる。
// 倍率は 当たる 札の 数から 決めて 店が すこし 取る（どの 札でも 平均は 賭けより すこし 少ない。端の 札だけ ほぼ 五分）。

export const HL = {
	start: 20,
	cap: 9999,
	bets: [1, 5, 10] as readonly number[],
	maxStreak: 10,
	reveal: 0.8,
	/** 店の 取り分（公平な 倍率に かける）。 */
	edge: 0.92,
	/** いちばん 低い 倍率。 */
	minMult: 1.05,
} as const;

export type HlChoice = "high" | "low" | "take";
export type HlPhase = "guess" | "reveal";
export type HlOutcome = "win" | "push" | "lose";
export type HlState = {
	chips: number;
	best: number;
	/** はじめに 賭ける 枚数。 */
	bet: number;
	/** 賭けて いる 枚数（小数あり。0 なら 次の 当てで bet 枚 賭ける）。 */
	pot: number;
	streak: number;
	card: number;
	next: number | null;
	phase: HlPhase;
	t: number;
	last: HlOutcome | null;
	/** いま 当てた 倍率。 */
	lastMult: number;
	over: boolean;
};
export type HlEvent = "bet" | "pick" | "flip" | HlOutcome | "take" | "bust";

export const hlDraw = (rnd: Rnd): number => 1 + Math.floor(rnd() * 13);

export const hlStart = (rnd: Rnd, chips: number = HL.start): HlState => ({
	chips,
	best: chips,
	bet: 1,
	pot: 0,
	streak: 0,
	card: 2 + Math.floor(rnd() * 11),
	next: null,
	phase: "guess",
	t: 0,
	last: null,
	lastMult: 0,
	over: false,
});

/** 当たりか（同じ 数は push）。 */
export const hlJudge = (
	card: number,
	next: number,
	c: "high" | "low",
): HlOutcome =>
	next === card ? "push" : next > card === (c === "high") ? "win" : "lose";

/** その 札で その 方に 当たったときの 倍率（当たる 札が ない 方は 0）。 */
export const hlMult = (card: number, c: "high" | "low"): number => {
	const wins = c === "high" ? 13 - card : card - 1;
	if (wins <= 0) return 0;
	return Math.max(HL.minMult, Math.floor((12 / wins) * HL.edge * 100) / 100);
};

/** 降りたら 手もとに 来る 枚数。 */
export const hlCash = (pot: number): number => Math.floor(pot + 1e-9);

/** やめた ときも 賭けて いる 分は 手もとに（降りたのと 同じ）。 */
export const hlScore = (s: HlState): number =>
	Math.max(s.best, s.chips + hlCash(s.pot));

/** やめた ときに 換金する 枚数（賭けて いる 分は 降りたのと 同じ）。 */
export const hlLeft = (s: HlState): number => s.chips + hlCash(s.pot);

const hlTake = (s: HlState, ev: HlEvent[]): void => {
	s.chips = Math.min(HL.cap, s.chips + hlCash(s.pot));
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
	bet?: number,
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
	if (bet !== undefined && s.pot === 0 && HL.bets.includes(bet)) {
		if (bet !== s.bet) ev.push("pick");
		s.bet = bet;
	}
	if (!c) return ev;
	if (c === "take") {
		if (s.pot > 0) hlTake(s, ev);
		return ev;
	}
	const mult = hlMult(s.card, c);
	if (mult <= 0) return ev;
	if (s.pot === 0) {
		const b = Math.min(s.bet, s.chips);
		if (b <= 0) return ev;
		s.chips -= b;
		s.pot = b;
		ev.push("bet");
	}
	const next = hlDraw(rnd);
	const r = hlJudge(s.card, next, c);
	s.next = next;
	s.last = r;
	s.phase = "reveal";
	s.t = 0;
	s.lastMult = r === "win" ? mult : 0;
	if (r === "win") {
		s.pot = Math.min(HL.cap, s.pot * mult);
		s.streak++;
	} else if (r === "lose") {
		s.pot = 0;
		s.streak = 0;
	}
	ev.push("flip", r);
	return ev;
};

// ───────────────── ルーレット ─────────────────
// 盤の 札に チップを 置いて（いくつでも）回す。赤・黒・奇数・偶数・前半・後半は 2倍、3つ割り（1-12 など）は 3倍、
// 0 は 36倍（37の ポケット）。置いた 札は 回すと 消え、何も 置かずに 回すと 前と 同じ 置き方を くり返す。

/** 盤の 並び（ヨーロッパ式）。 */
export const RL_WHEEL: readonly number[] = [
	0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
	16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
export const RL_RED: ReadonlySet<number> = new Set([
	1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);
export type RlColor = "red" | "black" | "green";
export const RL_BETS = [
	"red",
	"black",
	"zero",
	"odd",
	"even",
	"low",
	"high",
	"d1",
	"d2",
	"d3",
] as const;
export type RlBet = (typeof RL_BETS)[number];
export const RL_AMOUNTS: readonly number[] = [1, 5, 10];
/** 当たった ときの 払いもどし（賭けた 分を ふくむ 倍率）。 */
export const RL_PAY: Record<RlBet, number> = {
	red: 2,
	black: 2,
	zero: 36,
	odd: 2,
	even: 2,
	low: 2,
	high: 2,
	d1: 3,
	d2: 3,
	d3: 3,
};
export const RL = {
	start: 30,
	cap: 9999,
	spin: 3.2,
	pay: 1.3,
	/** 回る あいだに 少なくとも まわる 周（ポケットの 数で）。 */
	laps: 3,
	/** 1回に 置ける 合計。 */
	maxBet: 100,
	/** 出た 目の 記録の 数。 */
	history: 8,
} as const;

export const rlColorOf = (n: number): RlColor =>
	n === 0 ? "green" : RL_RED.has(n) ? "red" : "black";

/** その 札が 数 n で 当たるか。 */
export const rlWins = (b: RlBet, n: number): boolean => {
	if (n === 0) return b === "zero";
	switch (b) {
		case "red":
			return RL_RED.has(n);
		case "black":
			return !RL_RED.has(n);
		case "zero":
			return false;
		case "odd":
			return n % 2 === 1;
		case "even":
			return n % 2 === 0;
		case "low":
			return n <= 18;
		case "high":
			return n >= 19;
		case "d1":
			return n <= 12;
		case "d2":
			return n >= 13 && n <= 24;
		case "d3":
			return n >= 25;
	}
};

export type RlBets = Record<RlBet, number>;
const rlNoBets = (): RlBets =>
	Object.fromEntries(RL_BETS.map((b) => [b, 0])) as RlBets;
export const rlTotal = (b: RlBets): number =>
	RL_BETS.reduce((n, k) => n + b[k], 0);

export type RlPhase = "bet" | "spin" | "pay";
export type RlState = {
	chips: number;
	best: number;
	/** 置いて いる チップ。 */
	bets: RlBets;
	/** 前の 回の 置き方（何も 置かずに 回すと くり返す）。 */
	lastBets: RlBets;
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
	/** 出た 目（新しい ほうが 先）。 */
	history: number[];
	spins: number;
	over: boolean;
};
export type RlEvent =
	| "pick"
	| "place"
	| "clear"
	| "spin"
	| "tick"
	| "win"
	| "big"
	| "lose"
	| "bust";
export type RlInput = {
	place?: RlBet;
	amount?: number;
	clear?: boolean;
	spin: boolean;
};

export const rlStart = (chips: number = RL.start): RlState => ({
	chips,
	best: chips,
	bets: rlNoBets(),
	lastBets: rlNoBets(),
	amount: 1,
	phase: "bet",
	t: 0,
	pos: 0,
	from: 0,
	total: 0,
	result: 0,
	lastWin: 0,
	history: [],
	spins: 0,
	over: false,
});

/** やめた ときに 換金する 枚数（回す 前に 置いた 分は もどす。回って いる 間の 賭けは 返らない）。 */
export const rlLeft = (s: RlState): number =>
	s.chips + (s.phase === "bet" ? rlTotal(s.bets) : 0);

/** 止まった 数。 */
export const rlNumber = (s: RlState): number =>
	RL_WHEEL[((Math.round(s.pos) % 37) + 37) % 37] ?? 0;

/** その 置き方で 数 n が 出た ときの 払いもどし。 */
export const rlPayout = (b: RlBets, n: number): number =>
	RL_BETS.reduce((p, k) => p + (rlWins(k, n) ? b[k] * RL_PAY[k] : 0), 0);

export const rlStep = (
	s: RlState,
	dt: number,
	ip: RlInput,
	rnd: Rnd,
): RlEvent[] => {
	const ev: RlEvent[] = [];
	if (s.over) return ev;
	if (s.phase === "bet") {
		if (ip.amount !== undefined && ip.amount !== s.amount) {
			s.amount = ip.amount;
			ev.push("pick");
		}
		if (ip.clear && rlTotal(s.bets) > 0) {
			s.chips += rlTotal(s.bets);
			s.bets = rlNoBets();
			ev.push("clear");
		}
		if (ip.place) {
			const n = Math.min(s.amount, s.chips, RL.maxBet - rlTotal(s.bets));
			if (n > 0) {
				s.chips -= n;
				s.bets[ip.place] += n;
				ev.push("place");
			}
		}
		if (ip.spin) {
			// 何も 置いて いなければ 前の 置き方を くり返す（足りなければ 回さない）
			if (rlTotal(s.bets) === 0) {
				const again = rlTotal(s.lastBets);
				if (again <= 0 || again > s.chips) return ev;
				s.chips -= again;
				s.bets = { ...s.lastBets };
				ev.push("place");
			}
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
			s.history = [n, ...s.history].slice(0, RL.history);
			s.lastWin = rlPayout(s.bets, n);
			if (s.lastWin > 0) {
				s.chips = Math.min(RL.cap, s.chips + s.lastWin);
				s.best = Math.max(s.best, s.chips);
				ev.push("win");
				if (s.lastWin >= rlTotal(s.bets) * 3) ev.push("big");
			} else ev.push("lose");
			s.phase = "pay";
			s.t = 0;
		}
		return ev;
	}
	s.t += dt;
	if (s.t >= RL.pay) {
		s.phase = "bet";
		s.lastBets = s.bets;
		s.bets = rlNoBets();
		s.amount = Math.min(s.amount, Math.max(1, s.chips));
		if (!RL_AMOUNTS.includes(s.amount)) s.amount = 1;
		if (s.chips <= 0) {
			s.over = true;
			ev.push("bust");
		} else if (s.chips >= RL.cap) s.over = true;
	}
	return ev;
};

// ───────────────── スイカ割り ─────────────────
// 目かくしの キリコが 浜（11×7マス）を 1歩ずつ 歩き、名無したちの 声を たよりに スイカの 上で 棒を ふる。
// 40秒で いくつ 割れるか。割ると 次の スイカが 置かれる（100点 ＋ はやく 割るほど ボーナス）。
// 空ぶり・かすりは 点に ならず、しばらく ふらつく（歩けない）。
// ときどき 荒らしが うその 方を 言う（名前で わかる。スイカが 進むほど 多い）。関係ない ガヤも まざる。

export const SK_W = 11;
export const SK_H = 7;
export const SW = {
	time: 40,
	hint: 1.3,
	/** 荒らしの 出る 割合（何個目の スイカか で。最後の 値の あとは そのまま）。 */
	troll: [0.15, 0.25, 0.35, 0.45] as readonly number[],
	/** 声の あとに ガヤが まざる 割合。 */
	chatter: 0.3,
	hit: 100,
	/** はやく 割った ボーナス（スイカが 置かれてから quickSecs 秒より はやい 1秒ごと）。 */
	quickSecs: 10,
	perSec: 10,
	/** 空ぶり・かすりの あと 歩けない 秒。 */
	missStun: 1.5,
	nearStun: 0.8,
	/** 割った あと 次の スイカまで（声が 止まる）。 */
	pause: 0.7,
} as const;

export type SwDir = "up" | "down" | "left" | "right";
export type SwHint = {
	who: "nanashi" | "troll" | "gaya";
	/** 言った 方（荒らしは うそ）。null は「そこ」。 */
	dir: SwDir | null;
	/** 距離の ことば（0＝そこ、1＝あと 1歩、2＝ちかい、3＝まだまだ）。 */
	near: 0 | 1 | 2 | 3;
	/** ガヤの 文を えらぶ 数（0〜1）。 */
	pick?: number;
};
export type SwResult = "hit" | "near" | "miss";
export type SwState = {
	t: number;
	x: number;
	y: number;
	sx: number;
	sy: number;
	/** いまの スイカが 置かれてからの 秒。 */
	mt: number;
	next: number;
	/** ふらついて 歩けない 残り 秒。 */
	stun: number;
	hints: SwHint[];
	/** いまの スイカで 出た 声の 数（はじめの 2つは ほんとう）。 */
	told: number;
	/** 割った 数。 */
	melons: number;
	/** 前に 割った スイカの 場所（板が 割れた 絵を 出す）。 */
	prev: [number, number] | null;
	result: SwResult | null;
	/** いま 割った 点。 */
	lastPts: number;
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

/** スイカを (x,y) から 4歩より 遠くに 置く。 */
const swPlace = (rnd: Rnd, x: number, y: number): [number, number] => {
	let sx = 0;
	let sy = 0;
	for (let i = 0; i < 100; i++) {
		sx = Math.floor(rnd() * SK_W);
		sy = Math.floor(rnd() * SK_H);
		if (Math.abs(sx - x) + Math.abs(sy - y) >= 4) break;
	}
	return [sx, sy];
};

export const swStart = (rnd: Rnd): SwState => {
	const x = Math.floor(SK_W / 2);
	const y = SK_H - 1;
	const [sx, sy] = swPlace(rnd, x, y);
	return {
		t: 0,
		x,
		y,
		sx,
		sy,
		mt: 0,
		next: 0.4,
		stun: 0,
		hints: [],
		told: 0,
		melons: 0,
		prev: null,
		result: null,
		lastPts: 0,
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

/** いまの スイカで 荒らしの 出る 割合。 */
export const swTrollRate = (melons: number): number =>
	SW.troll[Math.min(melons, SW.troll.length - 1)] ?? 0;

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
	const stunned = s.stun > 0;
	if (ip.move && !stunned) {
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
	if (ip.swing && !stunned) {
		const d = swDistance(s);
		s.result = d === 0 ? "hit" : d === 1 ? "near" : "miss";
		ev.push(s.result);
		if (s.result === "hit") {
			s.lastPts =
				SW.hit + Math.max(0, Math.ceil(SW.quickSecs - s.mt)) * SW.perSec;
			s.score += s.lastPts;
			s.melons++;
			s.prev = [s.sx, s.sy];
			[s.sx, s.sy] = swPlace(rnd, s.x, s.y);
			s.mt = 0;
			s.told = 0;
			s.next = SW.pause;
		} else s.stun = s.result === "near" ? SW.nearStun : SW.missStun;
	}
	s.t += dt;
	s.mt += dt;
	s.stun = Math.max(0, s.stun - dt);
	s.next -= dt;
	if (s.next <= 0) {
		s.next = SW.hint;
		const truth = swTruth(s);
		// はじめの 2つは ほんとう。そこに いる ときは 荒らしも だまる
		const lie = s.told >= 2 && truth.dir && rnd() < swTrollRate(s.melons);
		s.hints.push(
			lie && truth.dir
				? { who: "troll", dir: OPP[truth.dir], near: truth.near }
				: truth,
		);
		s.told++;
		ev.push("hint");
		if (rnd() < SW.chatter) {
			s.hints.push({ who: "gaya", dir: null, near: 3, pick: rnd() });
			ev.push("hint");
		}
	}
	if (s.t >= SW.time) {
		s.over = true;
		ev.push("timeup");
	}
	return ev;
};

// ───────────────── グラス滑らせ ─────────────────
// バーの カウンターで グラスを 滑らせ、客の 前で 止める。A で 力を 決める（ゲージは 行ったり 来たり）。
// 6杯。ぴったり（3px 以内）で 100点、はなれる ほど 減る。カウンターの はしを 越えると 割れて 0点。
// ぴったりが 続くと ボーナス（2杯目から 1つごとに ＋50）。4杯目からは 酔っぱらいの 客が まざり、
// 左右に ゆれる（止まった ときの 客の 前で 点を つける）。

export const GS = {
	rounds: 6,
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
	/** ぴったりが 続いた ときの ボーナス（続いた 数 − 1 に かける）。 */
	combo: 50,
	/** 酔っぱらいが まざる 杯（0 から 数えて）と 割合。 */
	drunkFrom: 3,
	drunk: 0.6,
	/** 酔っぱらいの ゆれ（はば px・1秒の 角度）。 */
	sway: 16,
	swaySpeed: 1.7,
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
	/** 客の いる 所（酔っぱらいは ゆれる）。 */
	target: number;
	/** 客の まんなか。 */
	base: number;
	/** 酔っぱらいか（ゆれる）。 */
	drunk: boolean;
	/** 客の ゆれの 時計。 */
	ct: number;
	last: number | null;
	/** ぴったりが 続いて いる 数。 */
	combo: number;
	/** いま ついた ボーナス。 */
	bonus: number;
	broke: boolean;
	score: number;
	over: boolean;
};
export type GsEvent = "release" | "stop" | "exact" | "break" | "next";

/** ゲージが 1往復する 秒（杯ごとに 速く）。 */
export const gsPeriod = (round: number): number =>
	Math.max(0.8, 1.4 - round * 0.12);

export const gsTarget = (rnd: Rnd): number => 140 + Math.floor(rnd() * 76);

/** 客の いる 所（ゆれは カウンターの はしを 越えない）。 */
const gsGuestX = (s: GsState): number =>
	s.drunk
		? clamp(
				s.base + Math.sin(s.ct * GS.swaySpeed) * GS.sway,
				GS.startX + 40,
				GS.endX - 6,
			)
		: s.base;

const gsGuest = (s: GsState, rnd: Rnd): void => {
	s.base = gsTarget(rnd);
	s.drunk = s.round >= GS.drunkFrom && rnd() < GS.drunk;
	s.ct = rnd() * Math.PI * 2;
	s.target = gsGuestX(s);
};

export const gsStart = (rnd: Rnd): GsState => {
	const s: GsState = {
		round: 0,
		phase: "aim",
		t: 0,
		power: 0,
		x: GS.startX,
		v: 0,
		target: 0,
		base: 0,
		drunk: false,
		ct: 0,
		last: null,
		combo: 0,
		bonus: 0,
		broke: false,
		score: 0,
		over: false,
	};
	gsGuest(s, rnd);
	return s;
};

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
	// 結果の あいだは 客も 止まる（止まった 所で 点を 見せる）
	if (s.phase !== "result") {
		s.ct += dt;
		s.target = gsGuestX(s);
	}
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
			s.combo = 0;
			s.bonus = 0;
			s.phase = "result";
			s.t = 0;
			ev.push("break");
		} else if (s.v <= 0) {
			s.v = 0;
			s.last = gsPoints(s.x, s.target);
			s.combo = s.last === 100 ? s.combo + 1 : 0;
			s.bonus = Math.max(0, s.combo - 1) * GS.combo;
			s.score += s.last + s.bonus;
			s.phase = "result";
			s.t = 0;
			ev.push("stop");
			if (s.last === 100) ev.push("exact");
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
		s.bonus = 0;
		gsGuest(s, rnd);
		ev.push("next");
	}
	return ev;
};
