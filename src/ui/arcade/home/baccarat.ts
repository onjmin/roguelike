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
	type BcState,
	bcShown,
	bcStart,
	bcStep,
	bcTotal,
} from "../../../data/arcade/home/baccarat";
import type { Card } from "../../../data/arcade/home/poker";
import { ATOP, AW } from "../../../data/arcade/logic";
import { ARCADE, ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import { type G, txt } from "../../neta/netaBoard";
import { fill } from "../../village/villageTalk";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";
import {
	button,
	cardFace,
	clamp01,
	easeOut,
	FLIP,
	felt,
	flipCard,
	inside,
	type Rect,
	SLIDE,
} from "./poker";

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

const CY = 30;

/**
 * 片がわの 札。めくる 前の はじめの 2枚は 裏で 置き（配った 直後は 山から 飛んでくる）、
 * いちばん 新しく めくった 札は 裏から 返す。
 */
const row = (
	g: G,
	x0: number,
	s: BcState,
	side: "p" | "b",
	shown: readonly Card[],
): void => {
	const dealing = s.phase === "deal";
	const last = s.order[s.shown - 1];
	// 配る 順（p b p b）での 何枚目か
	const nth = (i: number): number => i * 2 + (side === "b" ? 1 : 0);
	for (let i = 0; i < (dealing ? 2 : 0); i++) {
		if (i < shown.length) continue;
		const x = x0 + i * 26;
		const at = nth(i) * 0.08;
		if (s.t < at && s.shown === 0) continue;
		const p = s.shown === 0 ? easeOut(clamp01((s.t - at) / SLIDE)) : 1;
		const fx0 = AW / 2 - CW / 2;
		const fy0 = ATOP - CH;
		cardFace(g, fx0 + (x - fx0) * p, fy0 + (CY - fy0) * p, CW, CH, null);
	}
	shown.forEach((c, i) => {
		const x = x0 + i * 26;
		const fresh = dealing && last === side && i === shown.length - 1;
		if (fresh) flipCard(g, x, CY, clamp01(s.t / FLIP), null, c, CW, CH);
		else cardFace(g, x, CY, CW, CH, c);
	});
};

export const playBaccarat = (
	ctx: UiCtx,
	stake?: number,
): Promise<ArcadeResult | null> => {
	let flash = "";
	return playBoard(ctx, "baccarat", {
		start: () => bcStart(stake),
		quitScores: true,
		cash: (s) => s.chips,
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
			row(g, 24, s, "p", shown.player);
			row(g, 140, s, "b", shown.banker);
			if (shown.player.length)
				txt(g, String(bcTotal(shown.player)), 62, 63, 12, "#ffe060", "center");
			if (shown.banker.length)
				txt(g, String(bcTotal(shown.banker)), 178, 63, 12, "#ffe060", "center");
			const betting = s.phase === "bet";
			// 案内：結果が なければ いま すること
			const guide =
				flash || (betting ? (s.chips ? BC_TEXT.howBet : "") : BC_TEXT.howDeal);
			if (guide)
				txt(g, guide, AW / 2, 81, 8, flash ? "#ffe060" : "#c8e0c8", "center");
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
