// カジノ「ガチャ」の バカラの 板（決まりは data/arcade/home/baccarat.ts、文は data/arcade/text.ts）。
// - ←→ で 賭け先、↑↓ で 枚数、A で 配る。札は 1枚ずつ めくる。
// - タップは 賭け先の 札・−／＋・配るの 札。
// 見た目の 乱数は Math.random（冒険の 乱数に さわらない）。

import {
	BC,
	BC_SIDES,
	BC_TEXT,
	type BcInput,
	type BcSide,
	bcShown,
	bcStart,
	bcStep,
	bcTotal,
} from "../../../data/arcade/home/baccarat";
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

const CW = 22;
const CH = 30;
const SIDE_INK: Record<BcSide, string> = {
	player: "#2a4a9a",
	tie: "#2a7a3a",
	banker: "#9a2a2a",
};
const sideRect = (i: number): Rect => [8 + i * 76, 94, 72, 18];
const BET_DN: Rect = [10, 120, 22, 20];
const BET_UP: Rect = [82, 120, 22, 20];
const DEAL: Rect = [140, 120, 90, 20];

const row = (g: G, x0: number, cards: readonly Card[]): void => {
	cards.forEach((c, i) => {
		cardFace(g, x0 + i * 26, 30, CW, CH, c);
	});
};

export const playBaccarat = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let flash = "";
	return playBoard(ctx, "baccarat", {
		start: bcStart,
		quitScores: true,
		step: (s, f) => {
			const inp: BcInput = {};
			const si = BC_SIDES.indexOf(s.side);
			if (s.phase === "bet")
				for (const e of f.evs) {
					if (isKey(e, "left")) inp.side = BC_SIDES[(si + 2) % 3];
					else if (isKey(e, "right")) inp.side = BC_SIDES[(si + 1) % 3];
					else if (isKey(e, "up", true)) inp.bet = 1;
					else if (isKey(e, "down", true)) inp.bet = -1;
					else if (isKey(e, "a")) inp.deal = true;
					else if (isTap(e)) {
						for (let i = 0; i < 3; i++)
							if (inside(e.tap, sideRect(i))) inp.side = BC_SIDES[i];
						if (inside(e.tap, BET_DN)) inp.bet = -1;
						else if (inside(e.tap, BET_UP)) inp.bet = 1;
						else if (inside(e.tap, DEAL)) inp.deal = true;
					}
				}
			for (const e of bcStep(s, f.dt, inp, rnd)) {
				if (e === "pick") f.se("cursor");
				else if (e === "bet") f.se("arcCoin");
				else if (e === "deal") {
					f.se("decide");
					flash = "";
				} else if (e === "flip") f.se("cardFlip");
				else {
					const w = s.winner ?? "tie";
					const head =
						w === "tie"
							? BC_TEXT.side.tie
							: fill(BC_TEXT.win, { side: BC_TEXT.side[w] });
					if (e === "win") {
						f.se(w === "tie" ? "victory" : "levelup");
						flash = `${head}　${fill(BC_TEXT.paid, { n: s.lastWin })}`;
					} else if (e === "push") {
						f.se("decide");
						flash = BC_TEXT.push;
					} else {
						f.se("miss");
						flash = s.chips > 0 ? `${head}　${BC_TEXT.lose}` : B.bust;
					}
				}
			}
		},
		draw: (g, s) => {
			felt(g, "#0e3a24");
			// PLAYER と BANKER の 場
			for (const [side, x] of [
				["player", 62],
				["banker", 178],
			] as const) {
				g.strokeStyle = SIDE_INK[side];
				g.strokeRect(x - 52.5, 17.5, 105, 60);
				const won = s.phase === "bet" && s.winner === side;
				txt(
					g,
					BC_TEXT.side[side],
					x,
					19,
					8,
					won ? "#ffe060" : "#e8e8f0",
					"center",
				);
			}
			const shown = bcShown(s);
			row(g, 24, shown.player);
			row(g, 140, shown.banker);
			if (shown.player.length)
				txt(g, String(bcTotal(shown.player)), 62, 63, 12, "#ffe060", "center");
			if (shown.banker.length)
				txt(g, String(bcTotal(shown.banker)), 178, 63, 12, "#ffe060", "center");
			if (flash) txt(g, flash, AW / 2, 81, 8, "#ffe060", "center");
			const betting = s.phase === "bet";
			BC_SIDES.forEach((side, i) => {
				button(
					g,
					sideRect(i),
					`${BC_TEXT.side[side]} ${BC_TEXT.odds[side]}`,
					s.side === side,
					SIDE_INK[side],
					!betting && s.side !== side,
				);
			});
			button(g, BET_DN, "−", false, "#3a2a10", !betting);
			txt(g, `${BC_TEXT.bet} ${s.bet}`, 57, 126, 8, "#f4e8c8", "center");
			button(g, BET_UP, "＋", false, "#3a2a10", !betting);
			button(g, DEAL, `A ${BC_TEXT.deal}`, false, "#5a3a10", !betting);
			hud(g, `${B.chips} ${s.chips}`, `${BC_TEXT.bet} ${s.bet}／${BC.maxBet}`);
		},
		over: (s) => s.over,
		score: (s) => s.chips,
		end: () => ARCADE.over,
	});
};
