// カジノ「ガチャ」の ブラックジャックの 板（決まりは data/arcade/home/blackjack.ts、文は data/arcade/text.ts）。
// - 賭ける 前：↑↓ で 枚数、A で 配る。配った あと：A ヒット、→ スタンド、↓ ダブル。
// - タップは 下の 札（−／＋・配る、ヒット・スタンド・ダブル）。
// 見た目の 乱数は Math.random（冒険の 乱数に さわらない）。

import {
	BJ,
	BJ_TEXT,
	type BjInput,
	bjStart,
	bjStep,
	bjTotal,
} from "../../../data/arcade/home/blackjack";
import type { Card } from "../../../data/arcade/home/poker";
import { AW } from "../../../data/arcade/logic";
import { ARCADE, ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import { type G, txt } from "../../neta/netaBoard";
import { fill } from "../../village/villageTalk";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";
import { button, cardFace, felt, inside, type Rect } from "./poker";

const rnd = Math.random;
const B = ARCADE_BOARD;

const CW = 26;
const CH = 36;
const BET_DN: Rect = [10, 120, 22, 20];
const BET_UP: Rect = [82, 120, 22, 20];
const DEAL: Rect = [140, 120, 90, 20];
const HIT: Rect = [8, 120, 70, 20];
const STAND: Rect = [84, 120, 72, 20];
const DOUBLE: Rect = [162, 120, 70, 20];

/** 手を 横に ならべる（多いと 重ねる）。 */
const hand = (
	g: G,
	y: number,
	cards: readonly Card[],
	hideSecond: boolean,
): void => {
	const gap = cards.length > 1 ? Math.min(28, 160 / (cards.length - 1)) : 0;
	cards.forEach((c, i) => {
		cardFace(g, 56 + i * gap, y, CW, CH, hideSecond && i === 1 ? null : c);
	});
};

export const playBlackjack = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let flash = "";
	return playBoard(ctx, "blackjack", {
		start: bjStart,
		quitScores: true,
		step: (s, f) => {
			const inp: BjInput = {};
			for (const e of f.evs) {
				if (s.phase === "bet") {
					if (isKey(e, "up", true)) inp.bet = 1;
					else if (isKey(e, "down", true)) inp.bet = -1;
					else if (isKey(e, "a")) inp.deal = true;
					else if (isTap(e)) {
						if (inside(e.tap, BET_DN)) inp.bet = -1;
						else if (inside(e.tap, BET_UP)) inp.bet = 1;
						else if (inside(e.tap, DEAL)) inp.deal = true;
					}
				} else if (s.phase === "play") {
					if (isKey(e, "a")) inp.hit = true;
					else if (isKey(e, "right")) inp.stand = true;
					else if (isKey(e, "down")) inp.double = true;
					else if (isTap(e)) {
						if (inside(e.tap, HIT)) inp.hit = true;
						else if (inside(e.tap, STAND)) inp.stand = true;
						else if (inside(e.tap, DOUBLE)) inp.double = true;
					}
				}
			}
			for (const e of bjStep(s, f.dt, inp, rnd)) {
				if (e === "bet") f.se("arcCoin");
				else if (e === "deal") {
					f.se("cardFlip");
					flash = "";
				} else if (e === "card" || e === "open") f.se("cardFlip");
				else if (e === "bj") {
					f.se("victory");
					flash = `${BJ_TEXT.bj}　${fill(B.gachaWin, { n: s.lastWin })}`;
				} else if (e === "win") {
					f.se("levelup");
					flash = `${s.dealerBust ? `${BJ_TEXT.dealerBust}　` : ""}${fill(BJ_TEXT.win, { n: s.lastWin })}`;
				} else if (e === "push") {
					f.se("decide");
					flash = BJ_TEXT.push;
				} else if (e === "lose" || e === "bust") {
					f.se("miss");
					flash =
						s.chips > 0 ? (e === "bust" ? BJ_TEXT.bust : BJ_TEXT.lose) : B.bust;
				}
			}
		},
		draw: (g, s) => {
			felt(g);
			// 半円の 台の ふち
			g.strokeStyle = "#2a5a30";
			g.beginPath();
			g.arc(AW / 2, -40, 150, 0.2, Math.PI - 0.2);
			g.stroke();
			const dealt = s.player.length > 0;
			txt(g, BJ_TEXT.dealer, 8, 20, 8, "#e8e8f0");
			if (dealt)
				txt(
					g,
					s.open ? String(bjTotal(s.dealer).total) : "?",
					8,
					32,
					12,
					"#ffe060",
				);
			hand(g, 18, s.dealer, !s.open);
			txt(g, BJ_TEXT.you, 8, 60, 8, "#e8e8f0");
			if (dealt) {
				const p = bjTotal(s.player);
				txt(
					g,
					String(p.total),
					8,
					72,
					12,
					p.total > 21 ? "#ff7070" : "#ffe060",
				);
			}
			hand(g, 58, s.player, false);
			if (flash) txt(g, flash, AW / 2, 98, 8, "#ffe060", "center");
			if (s.phase === "bet") {
				button(g, BET_DN, "−", false);
				txt(g, `${BJ_TEXT.bet} ${s.bet}`, 57, 126, 8, "#f4e8c8", "center");
				button(g, BET_UP, "＋", false);
				button(g, DEAL, `A ${BJ_TEXT.deal}`, false, "#5a3a10");
			} else {
				const play = s.phase === "play";
				button(g, HIT, `A ${BJ_TEXT.hit}`, false, "#5a3a10", !play);
				button(g, STAND, `→ ${BJ_TEXT.stand}`, false, "#3a2a10", !play);
				const canDouble = play && s.player.length === 2 && s.chips >= s.stake;
				button(g, DOUBLE, `↓ ${BJ_TEXT.double}`, false, "#3a2a10", !canDouble);
			}
			hud(
				g,
				`${B.chips} ${s.chips}`,
				`${BJ_TEXT.bet} ${s.phase === "bet" ? s.bet : s.stake}／${BJ.maxBet}`,
			);
		},
		over: (s) => s.over,
		score: (s) => s.chips,
		end: () => ARCADE.over,
	});
};
