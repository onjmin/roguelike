// カジノ「ガチャ」の ポーカーの 板（決まりは data/arcade/home/poker.ts、文は data/arcade/text.ts）。
// - ↑↓ で 賭ける 枚数、A で 配る。←→ で 札、↑ で 残す、A で 交換。
// - タップは 札で 残す、下の −／＋ で 枚数、右の 札で 配る／交換。
// - 札の 下に 「残す／かえる」、台の 下に いま する ことを 出す（初めてでも 押し方が わかる）。
// トランプの 札・ボタン・緑の 台の 描き方は ブラックジャック・バカラの 板も ここから 使う。
// 見た目の 乱数は Math.random（冒険の 乱数に さわらない）。

import {
	type Card,
	isRed,
	PK,
	PK_HANDS,
	PK_TEXT,
	type PkEvent,
	type PkInput,
	type PkState,
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

// ───────────────── 配る・めくる 演出 ─────────────────
// 決まりは 一瞬で 決まるので、板の 側で 札を 1枚ずつ 見せる（その あいだ 押しは A で とばすだけ）。
// 配る：前の 札を 消す → 山から 1枚ずつ 飛んでくる → 左から めくる。
// 交換：かえる 札を 消す → 飛んでくる → 1枚ずつ めくる（さいごの 1枚は ためてから）→ 役と 払い。

/** めくる・消す・飛ぶ 長さ（秒）。 */
const FLIP = 0.14;
const SLIDE = 0.16;
/** さいごの 1枚を めくる 前の ため（秒）。 */
const TAME = 0.32;

type Slot = {
	/** 前の 札（消える。null は 配る 前の 裏）。 */
	old: Card | null;
	/** 前の 札が 消えはじめる 時刻。 */
	away: number;
	/** 新しい 札が 着く 時刻。 */
	land: number;
	/** 表に なりきる 時刻。 */
	open: number;
};
type Show = {
	t: number;
	slots: (Slot | null)[];
	/** 交換の とき 残した 札（演出の あいだも 残す 札を 見せる）。 */
	held: boolean[];
	end: number;
	/** おわったら 出す 結果（win／lose）。 */
	after: PkEvent | null;
	/** その 結果の 払い（おわる まで 手もとに 足さない）。 */
	pay: number;
};

const showDeal = (prev: readonly Card[]): Show => {
	const slots: Slot[] = [];
	for (let i = 0; i < 5; i++) {
		const land = 0.28 + i * 0.07 + SLIDE;
		slots.push({ old: prev[i] ?? null, away: i * 0.03, land, open: 0 });
	}
	const base = (slots[4]?.land ?? 0) + 0.12;
	slots.forEach((sl, i) => {
		sl.open = base + i * 0.08 + FLIP;
	});
	return {
		t: 0,
		slots,
		held: [false, false, false, false, false],
		end: (slots[4]?.open ?? 0) + 0.05,
		after: null,
		pay: 0,
	};
};

const showDraw = (
	prev: readonly Card[],
	held: readonly boolean[],
	after: PkEvent,
	pay: number,
): Show => {
	const slots: (Slot | null)[] = [];
	let k = 0;
	for (let i = 0; i < 5; i++) {
		if (held[i]) {
			slots.push(null);
			continue;
		}
		slots.push({
			old: prev[i] ?? null,
			away: k * 0.05,
			land: 0.14 + k * 0.08 + SLIDE,
			open: 0,
		});
		k++;
	}
	const moving = slots.filter((x): x is Slot => x !== null);
	const base = Math.max(0, ...moving.map((x) => x.land)) + 0.18;
	moving.forEach((sl, j) => {
		sl.open = base + j * 0.16 + (j === moving.length - 1 ? TAME : 0) + FLIP;
	});
	const last = Math.max(0.3, ...moving.map((x) => x.open));
	return { t: 0, slots, held: [...held], end: last + 0.12, after, pay };
};

/** 札を 横に つぶして 描く（めくる・消える。p：0＝幅 なし … 1＝ふつう）。 */
const squeeze = (
	g: G,
	x: number,
	y: number,
	p: number,
	c: Card | null,
): void => {
	const w = Math.max(1, Math.round(CW * p));
	const X = x + (CW - w) / 2;
	g.save();
	g.beginPath();
	g.rect(X, y, w, CH);
	g.clip();
	cardFace(g, X, y, w, CH, c);
	g.restore();
};

const easeOut = (p: number): number => 1 - (1 - p) * (1 - p);
const clamp01 = (p: number): number => Math.max(0, Math.min(1, p));

/** 演出 中の 札 1枚。 */
const drawSlot = (g: G, x: number, sl: Slot, t: number, c: Card): void => {
	if (t < sl.land - SLIDE) {
		// 前の 札が 消える（つぶれて なくなる）
		if (t >= sl.away + FLIP) return;
		const p = clamp01((t - sl.away) / FLIP);
		squeeze(g, x, CY, 1 - p, sl.old);
		return;
	}
	if (t < sl.land) {
		// 山（上の まんなか）から 飛んでくる
		const p = easeOut(clamp01((t - (sl.land - SLIDE)) / SLIDE));
		const fx = AW / 2 - CW / 2;
		const fy = ATOP - CH;
		cardFace(g, fx + (x - fx) * p, fy + (CY - fy) * p, CW, CH, null);
		return;
	}
	if (t < sl.open - FLIP) {
		cardFace(g, x, CY, CW, CH, null);
		return;
	}
	if (t < sl.open) {
		// めくる：前半は 裏が つぶれ、後半は 表が ひらく
		const p = (t - (sl.open - FLIP)) / FLIP;
		if (p < 0.5) squeeze(g, x, CY, 1 - p * 2, null);
		else squeeze(g, x, CY, (p - 0.5) * 2, c);
		return;
	}
	cardFace(g, x, CY, CW, CH, c);
};

export const playPoker = (
	ctx: UiCtx,
	stake?: number,
): Promise<ArcadeResult | null> => {
	let flash = "";
	let show: Show | null = null;
	/** 演出の おわりに 結果を 出す。 */
	const finish = (s: PkState, sh: Show, se: (n: string) => void): void => {
		if (sh.after === "win") {
			se(s.lastWin >= s.bet * 25 ? "victory" : "levelup");
			flash = `${s.last ? PK_TEXT.hands[s.last] : ""}　${fill(PK_TEXT.win, { n: s.lastWin })}`;
		} else if (sh.after === "lose") {
			// 音は さいごに めくった 札で 足りる
			flash = s.chips > 0 ? PK_TEXT.lose : B.bust;
		}
	};
	return playBoard(ctx, "poker", {
		start: () => pkStart(stake),
		quitScores: true,
		cash: (s) => s.chips,
		step: (s, f) => {
			if (show) {
				const sh = show;
				const t0 = sh.t;
				// A・タップで 演出を とばす
				const skip = (f.evs as ArcEv[]).some((e) => isKey(e, "a") || isTap(e));
				sh.t = skip ? sh.end : sh.t + f.dt;
				if (!skip)
					for (const sl of sh.slots)
						if (sl && t0 < sl.open && sh.t >= sl.open) f.se("cardFlip");
				if (sh.t >= sh.end) {
					show = null;
					finish(s, sh, f.se);
				}
				return;
			}
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
			const prev = s.hand.slice();
			const held = s.held.slice();
			for (const e of pkStep(s, f.dt, inp, rnd)) {
				if (e === "bet") f.se("arcCoin");
				else if (e === "deal") {
					f.se("arcCoin");
					flash = "";
					show = showDeal(prev);
				} else if (e === "cursor") f.se("cursor");
				else if (e === "hold") f.se("decide");
				else if (e === "win" || e === "lose") {
					f.se("decide");
					flash = "";
					show = showDraw(prev, held, e, s.lastWin);
				}
			}
		},
		draw: (g, s, clock) => {
			const sh = show;
			felt(g, "#101a38");
			// 役の 表（いまの 枚数で の 払いだし）
			PK_HANDS.forEach((h, i) => {
				const col = Math.floor(i / 3);
				const row = i % 3;
				const x = 7 + col * 76;
				const y = 20 + row * 8;
				const hit = !sh && s.phase === "bet" && s.shown && s.last === h;
				if (hit && Math.floor(clock * 4) % 2 === 0) {
					g.fillStyle = "#5a4010";
					g.fillRect(x - 1, y - 1, 74, 8);
				}
				const ink = hit ? "#ffe060" : "#c8c0e0";
				txt(g, PK_TEXT.hands[h], x, y, 7, ink);
				txt(g, String(pkPay(h, s.bet)), x + 72, y, 7, ink, "right");
			});
			// 札
			const choosing = !sh && s.phase === "hold";
			for (let i = 0; i < 5; i++) {
				const x = cardX(i);
				const c = s.hand[i];
				const sl = sh?.slots[i];
				if (sh && sl && c) drawSlot(g, x, sl, sh.t, c);
				else cardFace(g, x, CY, CW, CH, c ?? null);
				// 札の 下：残す（金）／かえる（うすい 枠）。交換の 演出 中も 残した 札は 見せる
				const keep = choosing ? s.held[i] : sh?.held[i];
				const ly = CY + CH + 2;
				if (keep) {
					g.fillStyle = "#f0c040";
					g.fillRect(x, ly, CW, 9);
					txt(g, PK_TEXT.hold, x + CW / 2, ly + 1, 7, "#201000", "center");
				} else if (choosing) {
					g.strokeStyle = "#6a6a90";
					g.lineWidth = 1;
					g.strokeRect(x + 0.5, ly + 0.5, CW - 1, 8);
					txt(g, PK_TEXT.swap, x + CW / 2, ly + 1, 7, "#8a8ab0", "center");
				}
				if (choosing && i === s.cur) {
					g.strokeStyle = "#ffe060";
					g.lineWidth = 1;
					g.strokeRect(x - 1.5, CY - 1.5, CW + 3, CH + 3);
				}
			}
			// 案内：結果が なければ いま すること
			const guide = sh
				? ""
				: flash ||
					(s.phase === "hold"
						? PK_TEXT.howHold
						: s.chips
							? PK_TEXT.howBet
							: "");
			if (guide)
				txt(g, guide, AW / 2, 107, 8, flash ? "#ffe060" : "#c8c0e0", "center");
			const betting = s.phase === "bet";
			const swaps = s.held.filter((h) => !h).length;
			button(g, BET_DN, "−", false, "#3a2a10", !betting || !!sh);
			txt(
				g,
				`${PK_TEXT.bet} ${s.bet}`,
				(BET_DN[0] + BET_UP[0] + BET_UP[2]) / 2,
				126,
				8,
				"#f4e8c8",
				"center",
			);
			button(g, BET_UP, "＋", false, "#3a2a10", !betting || !!sh);
			const go = betting
				? PK_TEXT.deal
				: swaps
					? fill(PK_TEXT.draw, { n: swaps })
					: PK_TEXT.stand;
			button(g, GO, `A ${go}`, false, "#5a3a10", !!sh);
			// 払いは めくり おわって から 手もとに 足す
			const chips = s.chips - (sh?.pay ?? 0);
			hud(g, `${B.chips} ${chips}`, `${PK_TEXT.bet} ${s.bet}／${PK.maxBet}`);
		},
		over: (s) => s.over,
		score: (s) => s.chips,
		end: () => ARCADE.over,
	});
};
