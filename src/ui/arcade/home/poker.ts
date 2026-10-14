// カジノ「ガチャ」の ポーカーの 板（決まりは data/arcade/home/poker.ts、文は data/arcade/text.ts）。
// - ↑↓ で 賭ける 枚数、A で 配る。←→ で 札、↑ で 残す（HOLD）、A で 交換。
// - タップは 札で 残す、下の −／＋ で 枚数、右の 札で 配る／交換。
// トランプの 札・ボタン・緑の 台の 描き方は ブラックジャック・バカラの 板も ここから 使う。
// 見た目の 乱数は Math.random（冒険の 乱数に さわらない）。

import {
	type Card,
	isRed,
	PK,
	PK_HANDS,
	PK_TEXT,
	type PkInput,
	pkPay,
	pkStart,
	pkStep,
	RANKS,
	SUITS,
} from "../../../data/arcade/home/poker";
import { AH, ATOP, AW } from "../../../data/arcade/logic";
import { ARCADE, ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import { type G, txt } from "../../neta/netaBoard";
import { fill } from "../../village/villageTalk";
import {
	type ArcadeResult,
	type ArcEv,
	hud,
	isKey,
	isTap,
	playBoard,
} from "../arcadeKit";

const rnd = Math.random;
const B = ARCADE_BOARD;

export type Rect = readonly [number, number, number, number];

/** 四角の 中か。 */
export const inside = (p: readonly [number, number], [x, y, w, h]: Rect) =>
	p[0] >= x && p[0] < x + w && p[1] >= y && p[1] < y + h;

/** 札（ボタン）。 */
export const button = (
	g: G,
	[x, y, w, h]: Rect,
	label: string,
	on: boolean,
	fillc = "#3a2a10",
	dim = false,
): void => {
	g.fillStyle = on ? "#f0c040" : fillc;
	g.fillRect(x, y, w, h);
	g.strokeStyle = dim ? "#6a5a30" : "#f0c040";
	g.lineWidth = 1;
	g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
	txt(
		g,
		label,
		x + w / 2,
		y + h / 2 - 4,
		8,
		on ? "#201000" : dim ? "#8a7a60" : "#f4e8c8",
		"center",
	);
};

/** 緑の 台と 金の ふち。 */
export const felt = (g: G, ink = "#123018"): void => {
	g.fillStyle = ink;
	g.fillRect(0, 0, AW, AH);
	g.strokeStyle = "#c8a040";
	g.lineWidth = 1;
	g.strokeRect(3.5, ATOP + 3.5, AW - 7, AH - ATOP - 7);
};

/** トランプの 札（null は 裏）。左上に 数、まんなかに 印。 */
export const cardFace = (
	g: G,
	x: number,
	y: number,
	w: number,
	h: number,
	c: Card | null,
): void => {
	const X = Math.round(x);
	const Y = Math.round(y);
	g.fillStyle = c ? "#f8f4ea" : "#7a2030";
	g.fillRect(X, Y, w, h);
	g.strokeStyle = "#202020";
	g.lineWidth = 1;
	g.strokeRect(X + 0.5, Y + 0.5, w - 1, h - 1);
	if (!c) {
		g.strokeStyle = "#e0b050";
		g.strokeRect(X + 2.5, Y + 2.5, w - 5, h - 5);
		txt(g, "？", X + w / 2, Y + h / 2 - 5, 10, "#f0c040", "center");
		return;
	}
	const ink = isRed(c) ? "#c82030" : "#181818";
	const big = w >= 30;
	txt(g, RANKS[c.r] ?? "?", X + 2, Y + 2, big ? 10 : 8, ink);
	const sp = big ? 16 : 11;
	txt(
		g,
		SUITS[c.s] ?? "",
		X + w / 2,
		Y + h - sp - (big ? 4 : 2),
		sp,
		ink,
		"center",
	);
};

// ───────────────── 置き場 ─────────────────

const CW = 34;
const CH = 46;
const CY = 47;
const cardX = (i: number): number => 23 + i * 40;
const cardRect = (i: number): Rect => [cardX(i), CY, CW, CH + 10];
const BET_DN: Rect = [10, 120, 22, 20];
const BET_UP: Rect = [82, 120, 22, 20];
const GO: Rect = [140, 120, 90, 20];

export const playPoker = (
	ctx: UiCtx,
	stake?: number,
): Promise<ArcadeResult | null> => {
	let flash = "";
	return playBoard(ctx, "poker", {
		start: () => pkStart(stake),
		quitScores: true,
		cash: (s) => s.chips,
		step: (s, f) => {
			const inp: PkInput = {};
			for (const e of f.evs as ArcEv[]) {
				if (s.phase === "bet") {
					if (isKey(e, "up", true)) inp.bet = 1;
					else if (isKey(e, "down", true)) inp.bet = -1;
				} else {
					if (isKey(e, "left", true)) inp.cur = (s.cur + 4) % 5;
					else if (isKey(e, "right", true)) inp.cur = (s.cur + 1) % 5;
					else if (isKey(e, "up") || isKey(e, "down")) inp.toggle = s.cur;
				}
				if (isKey(e, "a")) inp.go = true;
				else if (isTap(e)) {
					if (inside(e.tap, GO)) inp.go = true;
					else if (s.phase === "bet") {
						if (inside(e.tap, BET_DN)) inp.bet = -1;
						else if (inside(e.tap, BET_UP)) inp.bet = 1;
					} else
						for (let i = 0; i < 5; i++)
							if (inside(e.tap, cardRect(i))) inp.toggle = i;
				}
			}
			for (const e of pkStep(s, f.dt, inp, rnd)) {
				if (e === "bet") f.se("arcCoin");
				else if (e === "deal") {
					f.se("cardFlip");
					flash = PK_TEXT.pick;
				} else if (e === "cursor") f.se("cursor");
				else if (e === "hold") f.se("decide");
				else if (e === "win") {
					f.se(s.lastWin >= s.bet * 25 ? "victory" : "levelup");
					flash = `${s.last ? PK_TEXT.hands[s.last] : ""}　${fill(PK_TEXT.win, { n: s.lastWin })}`;
				} else if (e === "lose") {
					f.se("cardFlip");
					flash = s.chips > 0 ? PK_TEXT.lose : B.bust;
				}
			}
		},
		draw: (g, s, clock) => {
			felt(g, "#101a38");
			// 役の 表（いまの 枚数で の 払いだし）
			PK_HANDS.forEach((h, i) => {
				const col = Math.floor(i / 3);
				const row = i % 3;
				const x = 7 + col * 76;
				const y = 20 + row * 8;
				const hit = s.phase === "bet" && s.shown && s.last === h;
				if (hit && Math.floor(clock * 4) % 2 === 0) {
					g.fillStyle = "#5a4010";
					g.fillRect(x - 1, y - 1, 74, 8);
				}
				const ink = hit ? "#ffe060" : "#c8c0e0";
				txt(g, PK_TEXT.hands[h], x, y, 7, ink);
				txt(g, String(pkPay(h, s.bet)), x + 72, y, 7, ink, "right");
			});
			// 札
			for (let i = 0; i < 5; i++) {
				const x = cardX(i);
				const c = s.hand[i];
				cardFace(g, x, CY, CW, CH, c ?? null);
				if (s.phase === "hold") {
					if (s.held[i]) {
						g.fillStyle = "#f0c040";
						g.fillRect(x, CY + CH + 2, CW, 9);
						txt(
							g,
							PK_TEXT.hold,
							x + CW / 2,
							CY + CH + 3,
							7,
							"#201000",
							"center",
						);
					}
					if (i === s.cur) {
						g.strokeStyle = "#ffe060";
						g.lineWidth = 1;
						g.strokeRect(x - 1.5, CY - 1.5, CW + 3, CH + 3);
					}
				}
			}
			if (flash) txt(g, flash, AW / 2, 107, 8, "#ffe060", "center");
			const betting = s.phase === "bet";
			button(g, BET_DN, "−", false, "#3a2a10", !betting);
			txt(
				g,
				`${PK_TEXT.bet} ${s.bet}`,
				(BET_DN[0] + BET_UP[0] + BET_UP[2]) / 2,
				126,
				8,
				"#f4e8c8",
				"center",
			);
			button(g, BET_UP, "＋", false, "#3a2a10", !betting);
			button(
				g,
				GO,
				`A ${betting ? PK_TEXT.deal : PK_TEXT.draw}`,
				false,
				"#5a3a10",
			);
			hud(g, `${B.chips} ${s.chips}`, `${PK_TEXT.bet} ${s.bet}／${PK.maxBet}`);
		},
		over: (s) => s.over,
		score: (s) => s.chips,
		end: () => ARCADE.over,
	});
};
