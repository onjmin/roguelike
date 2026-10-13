// カジノ「ガチャ」の ビデオポーカー（poker）の 決まり。板は ui/arcade/home/poker.ts、文は data/arcade/text.ts。
// - ジャックス・オア・ベター。↑↓ で 賭ける 枚数（1〜5）、A で 5枚 配る。
// - 残す 札を 選んで（HOLD）A で 交換。役の 払いだしは 表の 倍率 × 賭けた 枚数（ロイヤルは 5枚 賭けなら 800倍）。
// - チップが なくなるか、B（板の 外を 2回）で やめると その ときの 枚数が スコア。
// トランプの 札（Card）と 山の 切りかたは ブラックジャック・バカラも ここから 使う。
// DOM に 触らない（試験できる）。乱数は 渡された rnd（山の 切りかたも）。

import type { Rnd } from "../logic";

// ───────────────── トランプ ─────────────────

/** 札（r：1＝A … 11＝J 12＝Q 13＝K、s：0♠ 1♥ 2♦ 3♣）。 */
export type Card = { r: number; s: number };

export const SUITS = ["♠", "♥", "♦", "♣"] as const;
export const RANKS = [
	"",
	"A",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"J",
	"Q",
	"K",
] as const;
/** 赤い 札か（♥♦）。 */
export const isRed = (c: Card): boolean => c.s === 1 || c.s === 2;

/** 切った 52枚の 山（後ろから 引く）。 */
export const newDeck = (rnd: Rnd): Card[] => {
	const d: Card[] = [];
	for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ r, s });
	for (let i = d.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1)) % (i + 1);
		const t = d[i] as Card;
		d[i] = d[j] as Card;
		d[j] = t;
	}
	return d;
};
/** 山から 1枚（なくなったら 切りなおす）。 */
export const drawCard = (deck: Card[], rnd: Rnd): Card => {
	if (!deck.length) deck.push(...newDeck(rnd));
	return deck.pop() as Card;
};

// ───────────────── ビデオポーカー ─────────────────

export const PK = {
	start: 20,
	cap: 9999,
	minBet: 1,
	maxBet: 5,
	/** 5枚 賭けた ときの ロイヤルの 倍率。 */
	royalMax: 800,
	/** チップが なくなってから おわる までの 間（秒）。 */
	bustWait: 1.2,
} as const;

export const PK_HANDS = [
	"royal",
	"sf",
	"four",
	"full",
	"flush",
	"straight",
	"three",
	"two",
	"jacks",
] as const;
export type PkHand = (typeof PK_HANDS)[number];
/** 1枚 あたりの 払いだし。 */
export const PK_PAY: Record<PkHand, number> = {
	royal: 250,
	sf: 50,
	four: 25,
	full: 9,
	flush: 6,
	straight: 4,
	three: 3,
	two: 2,
	jacks: 1,
};

/** 板の 字。 */
export const PK_TEXT = {
	hands: {
		royal: "ロイヤル",
		sf: "ストフラ",
		four: "4カード",
		full: "フルハウス",
		flush: "フラッシュ",
		straight: "ストレート",
		three: "3カード",
		two: "2ペア",
		jacks: "J以上の　1ペア",
	} as Record<PkHand, string>,
	bet: "BET",
	hold: "HOLD",
	deal: "配る",
	draw: "交換",
	win: "{n}枚！",
	lose: "役なし",
	pick: "残す　札を　選んで　A",
} as const;

/** 役（なしは null）。 */
export const pkEval = (hand: readonly Card[]): PkHand | null => {
	const rs = hand.map((c) => c.r).sort((a, b) => a - b);
	const flush = hand.every((c) => c.s === hand[0]?.s);
	const uniq = new Set(rs).size === 5;
	const wheel = rs.join() === "1,2,3,4,5";
	const broadway = rs.join() === "1,10,11,12,13";
	const straight =
		uniq && ((rs[4] ?? 0) - (rs[0] ?? 0) === 4 || wheel || broadway);
	if (flush && broadway) return "royal";
	if (flush && straight) return "sf";
	const counts = new Map<number, number>();
	for (const r of rs) counts.set(r, (counts.get(r) ?? 0) + 1);
	const cs = [...counts.values()].sort((a, b) => b - a);
	if (cs[0] === 4) return "four";
	if (cs[0] === 3 && cs[1] === 2) return "full";
	if (flush) return "flush";
	if (straight) return "straight";
	if (cs[0] === 3) return "three";
	if (cs[0] === 2 && cs[1] === 2) return "two";
	for (const [r, n] of counts)
		if (n === 2 && (r === 1 || r >= 11)) return "jacks";
	return null;
};

/** 役の 払いだし（賭けた 枚数 込み）。 */
export const pkPay = (h: PkHand | null, bet: number): number =>
	h === null
		? 0
		: h === "royal" && bet >= PK.maxBet
			? PK.royalMax * bet
			: PK_PAY[h] * bet;

export type PkPhase = "bet" | "hold";
export type PkState = {
	chips: number;
	bet: number;
	phase: PkPhase;
	deck: Card[];
	hand: Card[];
	held: boolean[];
	/** えらんで いる 札（0〜4）。 */
	cur: number;
	/** 前の 手の 役と 払いだし（配る 前に 見せる）。 */
	last: PkHand | null;
	lastWin: number;
	/** 1回でも 交換まで したか。 */
	shown: boolean;
	t: number;
	over: boolean;
};
export type PkInput = {
	/** 賭ける 枚数を ふやす／へらす。 */
	bet?: -1 | 1;
	/** A：配る／交換。 */
	go?: boolean;
	/** 札を えらぶ（0〜4）。 */
	cur?: number;
	/** 札の HOLD を 切りかえる。 */
	toggle?: number;
};
export type PkEvent = "bet" | "deal" | "hold" | "cursor" | "win" | "lose";

export const pkStart = (): PkState => ({
	chips: PK.start,
	bet: 1,
	phase: "bet",
	deck: [],
	hand: [],
	held: [false, false, false, false, false],
	cur: 0,
	last: null,
	lastWin: 0,
	shown: false,
	t: 0,
	over: false,
});

export const pkStep = (
	s: PkState,
	dt: number,
	inp: PkInput,
	rnd: Rnd,
): PkEvent[] => {
	const ev: PkEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	if (s.phase === "bet") {
		if (s.chips < PK.minBet) {
			if (s.t >= PK.bustWait) s.over = true;
			return ev;
		}
		if (inp.bet) {
			const b = Math.max(
				PK.minBet,
				Math.min(PK.maxBet, s.chips, s.bet + inp.bet),
			);
			if (b !== s.bet) ev.push("bet");
			s.bet = b;
		}
		s.bet = Math.min(s.bet, s.chips);
		if (inp.go) {
			s.chips -= s.bet;
			s.deck = newDeck(rnd);
			s.hand = [];
			for (let i = 0; i < 5; i++) s.hand.push(drawCard(s.deck, rnd));
			s.held = [false, false, false, false, false];
			s.cur = 0;
			s.last = null;
			s.lastWin = 0;
			s.phase = "hold";
			s.t = 0;
			ev.push("deal");
		}
		return ev;
	}
	// 残す 札を えらぶ
	if (inp.cur !== undefined && inp.cur !== s.cur) {
		s.cur = Math.max(0, Math.min(4, inp.cur));
		ev.push("cursor");
	}
	if (inp.toggle !== undefined && inp.toggle >= 0 && inp.toggle < 5) {
		s.held[inp.toggle] = !s.held[inp.toggle];
		s.cur = inp.toggle;
		ev.push("hold");
	}
	if (inp.go) {
		for (let i = 0; i < 5; i++)
			if (!s.held[i]) s.hand[i] = drawCard(s.deck, rnd);
		const h = pkEval(s.hand);
		const pay = pkPay(h, s.bet);
		s.chips = Math.min(PK.cap, s.chips + pay);
		s.last = h;
		s.lastWin = pay;
		s.shown = true;
		s.phase = "bet";
		s.bet = Math.max(PK.minBet, Math.min(s.bet, s.chips));
		s.t = 0;
		ev.push(pay > 0 ? "win" : "lose");
	}
	return ev;
};
