// カジノ「ガチャ」の ブラックジャック（blackjack）の 決まり。板は ui/arcade/home/blackjack.ts、文は data/arcade/text.ts。
// - ↑↓ で 賭ける 枚数（1〜5）、A で 配る。A ヒット、→ スタンド、↓ ダブル（はじめの 2枚の ときだけ）。
// - 親（名無しの ディーラー）は 16 以下で 引き、17 で 止まる（ソフト 17 でも 止まる）。
// - 勝ち 1倍、ブラックジャック 1.5倍（切りすて）、引き分けは もどる。
// - チップが なくなるか、B（板の 外を 2回）で やめると その ときの 枚数が スコア。
// DOM に 触らない（試験できる）。乱数は 渡された rnd（山は 1回ごとに 切りなおす）。

import type { Rnd } from "../logic";
import { type Card, drawCard, newDeck } from "./poker";

export const BJ = {
	start: 20,
	cap: 9999,
	minBet: 1,
	maxBet: 5,
	/** 親が 1枚 引く 間（秒）。 */
	dealerGap: 0.55,
	bustWait: 1.2,
} as const;

/** 板の 字。 */
export const BJ_TEXT = {
	dealer: "名無し",
	you: "キリコ",
	bet: "BET",
	deal: "配る",
	hit: "ヒット",
	stand: "スタンド",
	double: "ダブル",
	bj: "ブラックジャック！",
	win: "勝ち　{n}枚！",
	push: "引き分け",
	lose: "負け",
	bust: "バースト",
	dealerBust: "名無しが　バースト！",
	/** 配る 前の 案内。 */
	howBet: "↑↓で　賭ける　枚数、Aで　配る",
	/** 配った あとの 案内。 */
	howPlay: "21に　近づける。こえたら　負け",
} as const;

/** 札の 点（A は 1、絵札は 10）。 */
const pt = (c: Card): number => Math.min(10, c.r);

/** 手の 合計と、A を 11 と 数えて いるか（ソフト）。 */
export const bjTotal = (
	cards: readonly Card[],
): { total: number; soft: boolean } => {
	let t = 0;
	let ace = false;
	for (const c of cards) {
		t += pt(c);
		if (c.r === 1) ace = true;
	}
	if (ace && t + 10 <= 21) return { total: t + 10, soft: true };
	return { total: t, soft: false };
};
export const bjIsBlackjack = (cards: readonly Card[]): boolean =>
	cards.length === 2 && bjTotal(cards).total === 21;
/** 親が もう 1枚 引くか（16 以下で 引く、ソフト 17 でも 止まる）。 */
export const bjDealerHits = (cards: readonly Card[]): boolean =>
	bjTotal(cards).total < 17;

export type BjResult = "bj" | "win" | "push" | "lose" | "bust";
export type BjPhase = "bet" | "play" | "dealer";
export type BjState = {
	chips: number;
	bet: number;
	/** この 回に 賭けた 枚数（ダブルで 2倍）。 */
	stake: number;
	phase: BjPhase;
	deck: Card[];
	player: Card[];
	dealer: Card[];
	/** 親の 伏せ札を 開いたか。 */
	open: boolean;
	result: BjResult | null;
	dealerBust: boolean;
	lastWin: number;
	t: number;
	over: boolean;
};
export type BjInput = {
	bet?: -1 | 1;
	deal?: boolean;
	hit?: boolean;
	stand?: boolean;
	double?: boolean;
};
export type BjEvent = "bet" | "deal" | "card" | "open" | BjResult;

export const bjStart = (chips: number = BJ.start): BjState => ({
	chips,
	bet: 1,
	stake: 0,
	phase: "bet",
	deck: [],
	player: [],
	dealer: [],
	open: false,
	result: null,
	dealerBust: false,
	lastWin: 0,
	t: 0,
	over: false,
});

/** 勝ち負けを 決めて 払う。 */
const settle = (s: BjState, r: BjResult, ev: BjEvent[]): void => {
	const pay =
		r === "bj"
			? s.stake + Math.floor((s.stake * 3) / 2)
			: r === "win"
				? s.stake * 2
				: r === "push"
					? s.stake
					: 0;
	s.chips = Math.min(BJ.cap, s.chips + pay);
	s.lastWin = pay;
	s.result = r;
	s.open = true;
	s.phase = "bet";
	s.bet = Math.max(BJ.minBet, Math.min(s.bet, s.chips));
	s.t = 0;
	ev.push(r);
};

/** 親が 引き おわった あとの 比べ。 */
const compare = (s: BjState, ev: BjEvent[]): void => {
	const p = bjTotal(s.player).total;
	const d = bjTotal(s.dealer).total;
	s.dealerBust = d > 21;
	settle(s, d > 21 || p > d ? "win" : p === d ? "push" : "lose", ev);
};

export const bjStep = (
	s: BjState,
	dt: number,
	inp: BjInput,
	rnd: Rnd,
): BjEvent[] => {
	const ev: BjEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	if (s.phase === "bet") {
		if (s.chips < BJ.minBet) {
			if (s.t >= BJ.bustWait) s.over = true;
			return ev;
		}
		if (inp.bet) {
			const b = Math.max(
				BJ.minBet,
				Math.min(BJ.maxBet, s.chips, s.bet + inp.bet),
			);
			if (b !== s.bet) ev.push("bet");
			s.bet = b;
		}
		s.bet = Math.min(s.bet, s.chips);
		if (!inp.deal) return ev;
		s.chips -= s.bet;
		s.stake = s.bet;
		s.deck = newDeck(rnd);
		s.player = [drawCard(s.deck, rnd)];
		s.dealer = [drawCard(s.deck, rnd)];
		s.player.push(drawCard(s.deck, rnd));
		s.dealer.push(drawCard(s.deck, rnd));
		s.open = false;
		s.result = null;
		s.dealerBust = false;
		s.lastWin = 0;
		s.phase = "play";
		s.t = 0;
		ev.push("deal");
		const pb = bjIsBlackjack(s.player);
		const db = bjIsBlackjack(s.dealer);
		if (pb || db) settle(s, pb && db ? "push" : pb ? "bj" : "lose", ev);
		return ev;
	}
	if (s.phase === "play") {
		if (inp.double && s.player.length === 2 && s.chips >= s.stake) {
			s.chips -= s.stake;
			s.stake *= 2;
			s.player.push(drawCard(s.deck, rnd));
			ev.push("card");
			if (bjTotal(s.player).total > 21) settle(s, "bust", ev);
			else {
				s.phase = "dealer";
				s.open = true;
				s.t = 0;
				ev.push("open");
			}
		} else if (inp.hit) {
			s.player.push(drawCard(s.deck, rnd));
			ev.push("card");
			const p = bjTotal(s.player).total;
			if (p > 21) settle(s, "bust", ev);
			else if (p === 21) inp.stand = true;
		}
		if (s.phase === "play" && inp.stand) {
			s.phase = "dealer";
			s.open = true;
			s.t = 0;
			ev.push("open");
		}
		return ev;
	}
	// 親の 番：間を あけて 1枚ずつ
	if (s.t < BJ.dealerGap) return ev;
	s.t = 0;
	if (bjDealerHits(s.dealer)) {
		s.dealer.push(drawCard(s.deck, rnd));
		ev.push("card");
	} else compare(s, ev);
	return ev;
};
