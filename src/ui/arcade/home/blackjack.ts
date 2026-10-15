// カジノ「ガチャ」の ブラックジャックの 板（決まりは data/arcade/home/blackjack.ts、文は data/arcade/text.ts）。
// - 賭ける 前：↑↓ で 枚数、A で 配る。配った あと：A ヒット、→ スタンド、↓ ダブル。
// - タップは 下の 札（−／＋・配る、ヒット・スタンド・ダブル）。
// - 決まりは 一瞬で 進むので、板の 側で 札を 1枚ずつ 飛ばし、伏せ札は めくって 見せる。
//   勝ち負けと 払いは 札が そろって 一息 おいて から（その あいだ 押しは A で とばすだけ）。
// 見た目の 乱数は Math.random（冒険の 乱数に さわらない）。

import {
	BJ,
	BJ_TEXT,
	type BjEvent,
	type BjInput,
	type BjState,
	bjStart,
	bjStep,
	bjTotal,
} from "../../../data/arcade/home/blackjack";
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

const CW = 26;
const CH = 36;
const BET_DN: Rect = [10, 120, 22, 20];
const BET_UP: Rect = [82, 120, 22, 20];
const DEAL: Rect = [140, 120, 90, 20];
const HIT: Rect = [8, 120, 70, 20];
const STAND: Rect = [84, 120, 72, 20];
const DOUBLE: Rect = [162, 120, 70, 20];

/** 配る ときの 札と 札の 間（秒）。 */
const DEAL_GAP = 0.2;
/** 札が そろって から 勝ち負けを 出す までの 間（秒）。 */
const SETTLE = 0.35;

/** 札ごとの 飛びはじめる 時刻と、伏せ札を めくりおえる 時刻。 */
type Fx = {
	at: Map<Card, number>;
	open: number;
	/** さいごに 動きおえる 時刻。 */
	last: number;
	/** 札が そろったら 出す 結果。 */
	result: { e: BjEvent; pay: number } | null;
};
const newFx = (): Fx => ({
	at: new Map(),
	open: Number.POSITIVE_INFINITY,
	last: 0,
	result: null,
});

const handX = (n: number, i: number): number =>
	56 + i * (n > 1 ? Math.min(28, 160 / (n - 1)) : 0);

/** 手を 横に ならべる（多いと 重ねる）。まだ 来て いない 札は 描かない。 */
const hand = (
	g: G,
	y: number,
	cards: readonly Card[],
	fx: Fx,
	now: number,
	hole: boolean,
): void => {
	cards.forEach((c, i) => {
		const at = fx.at.get(c) ?? 0;
		if (now < at) return;
		const x = handX(cards.length, i);
		const back = hole && i === 1;
		if (now < at + SLIDE) {
			// 山（上の まんなか）から 飛んでくる
			const p = easeOut(clamp01((now - at) / SLIDE));
			const fx0 = AW / 2 - CW / 2;
			const fy0 = ATOP - CH;
			cardFace(
				g,
				fx0 + (x - fx0) * p,
				fy0 + (y - fy0) * p,
				CW,
				CH,
				back ? null : c,
			);
			return;
		}
		if (back) {
			const p = clamp01((now - (fx.open - FLIP)) / FLIP);
			flipCard(g, x, y, p, null, c, CW, CH);
			return;
		}
		cardFace(g, x, y, CW, CH, c);
	});
};

/** 見えて いる 札だけの 合計（来て いない 札・伏せ札は 数えない）。 */
const shownTotal = (
	cards: readonly Card[],
	fx: Fx,
	now: number,
	hole: boolean,
): number =>
	bjTotal(
		cards.filter(
			(c, i) =>
				now >= (fx.at.get(c) ?? 0) + SLIDE &&
				!(hole && i === 1 && now < fx.open),
		),
	).total;

export const playBlackjack = (
	ctx: UiCtx,
	stake?: number,
): Promise<ArcadeResult | null> => {
	let flash = "";
	let fx = newFx();
	let now = 0;
	/** 新しく 来た 札を 順に 並べる。 */
	const queue = (cards: readonly Card[], gap: number): void => {
		for (const c of cards) {
			if (fx.at.has(c)) continue;
			const at = Math.max(now, fx.last + gap - SLIDE);
			fx.at.set(c, at);
			fx.last = at + SLIDE;
		}
	};
	const finish = (s: BjState, f: { se: (n: string) => void }): void => {
		const r = fx.result;
		fx.result = null;
		if (!r) return;
		const e = r.e;
		if (e === "bj") {
			f.se("victory");
			flash = `${BJ_TEXT.bj}　${fill(B.gachaWin, { n: r.pay })}`;
		} else if (e === "win") {
			f.se("levelup");
			flash = `${s.dealerBust ? `${BJ_TEXT.dealerBust}　` : ""}${fill(BJ_TEXT.win, { n: r.pay })}`;
		} else if (e === "push") {
			f.se("decide");
			flash = BJ_TEXT.push;
		} else {
			f.se("miss");
			flash =
				s.chips > 0 ? (e === "bust" ? BJ_TEXT.bust : BJ_TEXT.lose) : B.bust;
		}
	};
	return playBoard(ctx, "blackjack", {
		start: () => bjStart(stake),
		quitScores: true,
		cash: (s) => s.chips,
		step: (s, f) => {
			const t0 = now;
			now += f.dt;
			// 札が 着いた 音（伏せ札を めくる 音も）
			for (const at of fx.at.values())
				if (t0 < at + SLIDE && now >= at + SLIDE) f.se("cardFlip");
			if (t0 < fx.open && now >= fx.open) f.se("cardFlip");
			// 札が 動いて いる あいだは 待つ（A・タップで とばす）
			const busy = now < fx.last || (fx.result && now < fx.last + SETTLE);
			if (busy) {
				if (f.evs.some((e) => isKey(e, "a") || isTap(e))) {
					now = fx.last + SETTLE;
				}
				return;
			}
			if (fx.result) finish(s, f);
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
					f.se("arcCoin");
					flash = "";
					fx = newFx();
					fx.last = now;
					// 配る 順：キリコ、名無し、キリコ、名無し
					const [p0, p1] = s.player;
					const [d0, d1] = s.dealer;
					queue(
						[p0, d0, p1, d1].filter((c): c is Card => !!c),
						DEAL_GAP,
					);
				} else if (e === "card") {
					queue(s.player, 0.05);
					queue(s.dealer, 0.05);
				} else if (e === "open") {
					// 伏せ札を めくる（めくって から 親が 引く）
				} else fx.result = { e, pay: s.lastWin };
			}
			// 伏せ札を 開いたら、そろった あとで めくる
			if (s.open && fx.open === Number.POSITIVE_INFINITY && s.dealer.length) {
				fx.open = Math.max(now, fx.last) + 0.15 + FLIP;
				fx.last = fx.open;
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
			const opened = now >= fx.open;
			txt(g, BJ_TEXT.dealer, 8, 20, 8, "#e8e8f0");
			if (dealt)
				txt(
					g,
					opened ? String(shownTotal(s.dealer, fx, now, true)) : "?",
					8,
					32,
					12,
					"#ffe060",
				);
			hand(g, 18, s.dealer, fx, now, true);
			txt(g, BJ_TEXT.you, 8, 60, 8, "#e8e8f0");
			if (dealt) {
				const p = shownTotal(s.player, fx, now, false);
				txt(g, String(p), 8, 72, 12, p > 21 ? "#ff7070" : "#ffe060");
			}
			hand(g, 58, s.player, fx, now, false);
			const moving = now < fx.last || !!fx.result;
			// 案内：結果が なければ いま すること
			const guide = moving
				? ""
				: flash ||
					(s.phase === "bet"
						? s.chips
							? BJ_TEXT.howBet
							: ""
						: s.phase === "play"
							? BJ_TEXT.howPlay
							: "");
			if (guide)
				txt(g, guide, AW / 2, 98, 8, flash ? "#ffe060" : "#c8e0c8", "center");
			// 結果を 出す まで 前の 回の 賭け画面に もどさない
			if (s.phase === "bet" && !fx.result) {
				button(g, BET_DN, "−", false, "#3a2a10", moving);
				txt(g, `${BJ_TEXT.bet} ${s.bet}`, 57, 126, 8, "#f4e8c8", "center");
				button(g, BET_UP, "＋", false, "#3a2a10", moving);
				button(g, DEAL, `A ${BJ_TEXT.deal}`, false, "#5a3a10", moving);
			} else {
				const play = s.phase === "play" && !moving;
				button(g, HIT, `A ${BJ_TEXT.hit}`, false, "#5a3a10", !play);
				button(g, STAND, `→ ${BJ_TEXT.stand}`, false, "#3a2a10", !play);
				const canDouble = play && s.player.length === 2 && s.chips >= s.stake;
				button(g, DOUBLE, `↓ ${BJ_TEXT.double}`, false, "#3a2a10", !canDouble);
			}
			// 払いは 結果を 出して から 手もとに 足す
			const chips = s.chips - (fx.result?.pay ?? 0);
			hud(
				g,
				`${B.chips} ${chips}`,
				`${BJ_TEXT.bet} ${s.phase === "bet" && !fx.result ? s.bet : s.stake}／${BJ.maxBet}`,
			);
		},
		over: (s) => s.over && !fx.result,
		score: (s) => s.chips,
		end: () => ARCADE.over,
	});
};
