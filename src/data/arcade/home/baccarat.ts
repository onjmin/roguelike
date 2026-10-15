// カジノ「ガチャ」の バカラ（baccarat）の 決まり。板は ui/arcade/home/baccarat.ts、文は data/arcade/text.ts。
// - ←→ で 賭け先（PLAYER／TIE／BANKER）、↑↓ で 枚数（1〜5）、A で 配る。
// - 札の 点は A＝1、2〜9 は その まま、10・絵札は 0。合計の 1の 位が 9に 近い ほうが 勝ち。
// - 3枚目は ふつうの 決まり（ナチュラル 8・9 は 両方 止まる、PLAYER は 5以下で 引く、BANKER は 表どおり）。
// - 払いだし：PLAYER 1倍、BANKER 0.95倍（切りすて）、TIE 8倍。TIE の とき PLAYER／BANKER の 賭けは もどる。
// - 札は 1枚ずつ めくる（PLAYER、BANKER、PLAYER、BANKER、3枚目）。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import type { Rnd } from "../logic";
import { type Card, drawCard, newDeck } from "./poker";

export const BC = {
	start: 20,
	cap: 9999,
	minBet: 1,
	maxBet: 5,
	/** 1枚 めくる 間（秒）。 */
	flip: 0.5,
	/** さいごの 1枚を めくる 前の ため（秒）。 */
	tame: 0.45,
	bustWait: 1.2,
} as const;

export const BC_SIDES = ["player", "tie", "banker"] as const;
export type BcSide = (typeof BC_SIDES)[number];

/** 板の 字。 */
export const BC_TEXT = {
	side: { player: "PLAYER", tie: "TIE", banker: "BANKER" } as Record<
		BcSide,
		string
	>,
	odds: { player: "1倍", tie: "8倍", banker: "0.95倍" } as Record<
		BcSide,
		string
	>,
	bet: "BET",
	deal: "配る",
	win: "{side}の　勝ち",
	paid: "{n}枚！",
	push: "TIE　賭けは　もどった",
	lose: "はずれ",
	natural: "ナチュラル！",
	/** 配る 前の 案内。 */
	howBet: "←→で　賭け先、↑↓で　枚数、Aで　配る",
	/** めくって いる あいだの 案内。 */
	howDeal: "9に　近い　ほうが　勝ち",
} as const;

/** 札の 点。 */
export const bcPoint = (c: Card): number => (c.r >= 10 ? 0 : c.r);
/** 手の 点（1の 位）。 */
export const bcTotal = (cards: readonly Card[]): number =>
	cards.reduce((n, c) => n + bcPoint(c), 0) % 10;

/** BANKER が 3枚目を 引くか（PLAYER の 3枚目の 点、PLAYER が 止まったら null）。 */
export const bcBankerDraws = (banker: number, p3: number | null): boolean => {
	if (p3 === null) return banker <= 5;
	if (banker <= 2) return true;
	if (banker === 3) return p3 !== 8;
	if (banker === 4) return p3 >= 2 && p3 <= 7;
	if (banker === 5) return p3 >= 4 && p3 <= 7;
	if (banker === 6) return p3 === 6 || p3 === 7;
	return false;
};

/** 1回分を 配る（めくる 順に ならべた 札も 返す）。 */
export const bcDeal = (
	deck: Card[],
	rnd: Rnd,
): { player: Card[]; banker: Card[]; order: ("p" | "b")[] } => {
	const player = [drawCard(deck, rnd)];
	const banker = [drawCard(deck, rnd)];
	player.push(drawCard(deck, rnd));
	banker.push(drawCard(deck, rnd));
	const order: ("p" | "b")[] = ["p", "b", "p", "b"];
	const pt = bcTotal(player);
	const bt = bcTotal(banker);
	if (pt >= 8 || bt >= 8) return { player, banker, order };
	let p3: number | null = null;
	if (pt <= 5) {
		const c = drawCard(deck, rnd);
		player.push(c);
		order.push("p");
		p3 = bcPoint(c);
	}
	if (bcBankerDraws(bt, p3)) {
		banker.push(drawCard(deck, rnd));
		order.push("b");
	}
	return { player, banker, order };
};

/** 勝った 側。 */
export const bcWinner = (
	player: readonly Card[],
	banker: readonly Card[],
): BcSide => {
	const p = bcTotal(player);
	const b = bcTotal(banker);
	return p > b ? "player" : b > p ? "banker" : "tie";
};

/** 払いだし（賭けた 枚数 込み）。 */
export const bcPay = (side: BcSide, winner: BcSide, bet: number): number => {
	if (winner === "tie") return side === "tie" ? bet * 9 : bet;
	if (side !== winner) return 0;
	return side === "player" ? bet * 2 : bet + Math.floor(bet * 0.95);
};

export type BcPhase = "bet" | "deal";
export type BcState = {
	chips: number;
	bet: number;
	side: BcSide;
	phase: BcPhase;
	deck: Card[];
	player: Card[];
	banker: Card[];
	order: ("p" | "b")[];
	/** めくった 枚数。 */
	shown: number;
	winner: BcSide | null;
	lastWin: number;
	t: number;
	over: boolean;
};
export type BcInput = {
	side?: BcSide;
	bet?: -1 | 1;
	deal?: boolean;
};
export type BcEvent =
	| "pick"
	| "bet"
	| "deal"
	| "flip"
	| "win"
	| "push"
	| "lose";

export const bcStart = (chips: number = BC.start): BcState => ({
	chips,
	bet: 1,
	side: "player",
	phase: "bet",
	deck: [],
	player: [],
	banker: [],
	order: [],
	shown: 0,
	winner: null,
	lastWin: 0,
	t: 0,
	over: false,
});

/** めくった ぶんの 札（PLAYER、BANKER）。 */
export const bcShown = (s: BcState): { player: Card[]; banker: Card[] } => {
	let p = 0;
	let b = 0;
	for (const o of s.order.slice(0, s.shown)) o === "p" ? p++ : b++;
	return { player: s.player.slice(0, p), banker: s.banker.slice(0, b) };
};

export const bcStep = (
	s: BcState,
	dt: number,
	inp: BcInput,
	rnd: Rnd,
): BcEvent[] => {
	const ev: BcEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	if (s.phase === "bet") {
		if (s.chips < BC.minBet) {
			if (s.t >= BC.bustWait) s.over = true;
			return ev;
		}
		if (inp.side && inp.side !== s.side) {
			s.side = inp.side;
			ev.push("pick");
		}
		if (inp.bet) {
			const b = Math.max(
				BC.minBet,
				Math.min(BC.maxBet, s.chips, s.bet + inp.bet),
			);
			if (b !== s.bet) ev.push("bet");
			s.bet = b;
		}
		s.bet = Math.min(s.bet, s.chips);
		if (!inp.deal) return ev;
		s.chips -= s.bet;
		s.deck = newDeck(rnd);
		const d = bcDeal(s.deck, rnd);
		s.player = d.player;
		s.banker = d.banker;
		s.order = d.order;
		s.shown = 0;
		s.winner = null;
		s.lastWin = 0;
		s.phase = "deal";
		s.t = 0;
		ev.push("deal");
		return ev;
	}
	// 1枚ずつ めくる（勝負が 決まる さいごの 1枚は ためてから）
	const tame = s.shown === s.order.length - 1 ? BC.tame : 0;
	if (s.t < BC.flip + tame) return ev;
	s.t = 0;
	if (s.shown < s.order.length) {
		s.shown++;
		ev.push("flip");
		return ev;
	}
	const w = bcWinner(s.player, s.banker);
	const pay = bcPay(s.side, w, s.bet);
	s.chips = Math.min(BC.cap, s.chips + pay);
	s.winner = w;
	s.lastWin = pay;
	s.phase = "bet";
	s.bet = Math.max(BC.minBet, Math.min(s.bet, s.chips));
	ev.push(s.side === w ? "win" : pay > 0 ? "push" : "lose");
	return ev;
};
