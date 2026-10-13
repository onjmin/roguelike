// カジノ「ガチャ」の 台と、海の家・バーの 遊びの 板。決まりは data/arcade/parlor.ts、文は data/arcade/text.ts。
// - ガチャスロット：A・タップで 引く（リールは 自動で 止まる）。予告・リーチ・天井・確変で 光る。
// - ハイ＆ロー：← ロー・→ ハイ・↑↓ 賭ける 枚数・A 降りる。タップは 下の 札（ロー・降りる・ハイ）と 左の 枚数。
// - ルーレット：右の 札を 十字で えらんで A（タップは その 札）。賭けの 札に 置く・枚数・戻す・回す。
// - スイカ割り：十字キーで 1歩、A で 棒を ふる。タップは キリコから 見た 方へ 1歩（キリコの マスなら ふる）。
// - グラス滑らせ：A・タップで 力を 決める。
// チップは 店が 貸す 遊びの チップ（ゴールドとは 別）。B（板の 外を 2回）で やめると その ときの いちばんで 記録する。

import { AH, ATOP, AW } from "../../data/arcade/logic";
import {
	GC,
	GC_PAY,
	GC_SYMS,
	type GcSym,
	GS,
	gcStart,
	gcStep,
	gcToCeiling,
	gsStart,
	gsStep,
	HL,
	type HlChoice,
	hlCash,
	hlMult,
	hlScore,
	hlStart,
	hlStep,
	RL_AMOUNTS,
	RL_WHEEL,
	type RlBet,
	type RlColor,
	type RlInput,
	rlColorOf,
	rlNumber,
	rlStart,
	rlStep,
	rlTotal,
	rlWins,
	SK_H,
	SK_W,
	SW,
	type SwDir,
	swStart,
	swStep,
} from "../../data/arcade/parlor";
import { ARCADE, ARCADE_BOARD } from "../../data/arcade/text";
import type { UiCtx } from "../list";
import { drawPosts, type G, type Post, txt } from "../neta/netaBoard";
import { fill } from "../village/villageTalk";
import {
	type ArcadeResult,
	chip,
	hud,
	isKey,
	isTap,
	playBoard,
} from "./arcadeKit";

const rnd = Math.random;
const B = ARCADE_BOARD;

type Rect = readonly [number, number, number, number];

/** 四角の 中か。 */
const inside = (p: readonly [number, number], [x, y, w, h]: Rect): boolean =>
	p[0] >= x && p[0] < x + w && p[1] >= y && p[1] < y + h;

/** 札（ボタン）。 */
const button = (
	g: G,
	[x, y, w, h]: Rect,
	label: string,
	on: boolean,
	fillc = "#3a2a10",
	px = 8,
): void => {
	g.fillStyle = on ? "#f0c040" : fillc;
	g.fillRect(x, y, w, h);
	g.strokeStyle = "#f0c040";
	g.lineWidth = 1;
	g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
	txt(
		g,
		label,
		x + w / 2,
		y + h / 2 - px / 2,
		px,
		on ? "#201000" : "#f4e8c8",
		"center",
	);
};

const casinoFloor = (g: G, felt = "#123018", rim = "#c8a040"): void => {
	g.fillStyle = felt;
	g.fillRect(0, 0, AW, AH);
	g.strokeStyle = rim;
	g.lineWidth = 1;
	g.strokeRect(3.5, ATOP + 3.5, AW - 7, AH - ATOP - 7);
};

/** 虹の 色（光る ふちに）。 */
const rainbow = (clock: number, k = 0): string =>
	`hsl(${Math.floor((clock * 360 + k * 60) % 360)},90%,60%)`;

/** 手もとの 枚数を 数え上げて 見せる（増えたら 少しずつ、減ったら すぐ）。 */
const counter = () => {
	let shown = Number.NaN;
	let at = 0;
	return (v: number, clock: number): number => {
		const dt = Math.max(0, clock - at);
		at = clock;
		if (Number.isNaN(shown) || v < shown) shown = v;
		else if (v > shown)
			shown = Math.min(v, shown + Math.max(20 * dt, (v - shown) * 4 * dt));
		return Math.floor(shown);
	};
};

// ───────────────── ガチャスロット ─────────────────

const GC_INK: Record<GcSym, string> = {
	UR: "#ff5070",
	SSR: "#f0c040",
	SR: "#c070f0",
	R: "#50a0f0",
	N: "#a0a0a8",
};
const GC_TABLE = GC_SYMS.map((s) => `${s}=${GC_PAY[s]}`).join(" ");

export const playGacha = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let flash = "";
	let hot = false;
	const shown = counter();
	return playBoard(ctx, "gacha", {
		start: gcStart,
		quitScores: true,
		step: (s, f) => {
			const press = f.evs.some((e) => isKey(e, "a") || isTap(e));
			for (const e of gcStep(s, f.dt, press, rnd)) {
				if (e === "pull") {
					f.se("arcCoin");
					flash = "";
					hot = false;
				} else if (e === "omen") {
					f.se("spell");
					flash = B.gachaOmen;
					hot = true;
				} else if (e === "ceiling") {
					f.se("critical");
					flash = B.gachaCeiling;
					hot = true;
				} else if (e === "stop") f.se("decide");
				else if (e === "reach") {
					const top = s.reels[0];
					f.se(top === "SR" ? "mix" : "critical");
					if (!s.ceilingPull)
						flash =
							top === "UR"
								? B.gachaUr
								: top === "SSR"
									? B.gachaSsr
									: B.gachaReach;
					if (top !== "SR") hot = true;
				} else if (e === "win") {
					f.se(s.lastWin >= GC_PAY.SSR ? "victory" : "levelup");
					flash = fill(s.lastWin >= GC_PAY.SR ? B.gachaBig : B.gachaWin, {
						n: s.lastWin,
					});
				} else if (e === "fever") f.se("arcBest");
				else if (e === "pair") {
					f.se("item");
					flash = B.gachaPair;
				} else if (e === "lose") hot = false;
				else if (e === "bust") flash = B.bust;
			}
		},
		draw: (g, s, clock) => {
			const fever = s.fever > 0 || (s.feverPull && s.phase !== "idle");
			casinoFloor(
				g,
				fever ? "#301040" : "#123018",
				fever ? "#f070f0" : "#c8a040",
			);
			const blink = Math.floor(clock * 8) % 2 === 1;
			// 予告・激アツの ときは 台の ふちが 虹に 光る
			if (hot && s.phase === "spin") {
				g.lineWidth = 2;
				g.strokeStyle = rainbow(clock);
				g.strokeRect(40, 34, 160, 62);
			}
			for (let i = 0; i < 3; i++) {
				const x = 46 + i * 52;
				const y = 40;
				g.fillStyle = "#0a0a12";
				g.fillRect(x, y, 44, 50);
				const still = s.phase !== "spin" || i < s.stopped;
				const sym: GcSym = still
					? (s.reels[i] ?? "N")
					: (GC_SYMS[Math.floor(clock * 14 + i * 3) % GC_SYMS.length] ?? "N");
				// リーチの 3つ目は 光る ふち（SSR 以上は 虹）
				if (s.phase === "spin" && s.reach && i === 2 && !still) {
					g.strokeStyle =
						s.reels[0] === "SR"
							? blink
								? "#ffe060"
								: "#ff5070"
							: rainbow(clock, 2);
					g.lineWidth = 2;
					g.strokeRect(x - 1, y - 1, 46, 52);
				}
				// そろった 目は 光る
				const lit =
					s.phase === "pay" &&
					s.lastWin > GC.pair &&
					blink &&
					s.reels[0] === sym;
				if (lit) {
					g.fillStyle = "#3a3010";
					g.fillRect(x, y, 44, 50);
				}
				txt(
					g,
					sym,
					x + 22,
					y + 18,
					sym.length > 2 ? 12 : 14,
					still ? GC_INK[sym] : "#606070",
					"center",
				);
			}
			if (flash) {
				const big = s.phase === "pay" && s.lastWin >= GC_PAY.SR;
				txt(
					g,
					flash,
					AW / 2,
					100,
					12,
					big || hot ? rainbow(clock) : "#ffe060",
					"center",
				);
			}
			txt(g, GC_TABLE, AW / 2, 116, 7, "#c8b890", "center");
			// 天井の 目もりと 確変
			const left = gcToCeiling(s);
			txt(
				g,
				s.fever > 0
					? fill(B.gachaFever, { n: s.fever })
					: fill(B.gachaToCeil, { n: left }),
				AW / 2,
				126,
				7,
				s.fever > 0 ? "#f0a0f0" : left <= 20 ? "#ff8060" : "#a8a090",
				"center",
			);
			g.fillStyle = "#202418";
			g.fillRect(46, 136, 148, 3);
			g.fillStyle = left <= 20 && blink ? "#ff8060" : "#c8a040";
			g.fillRect(
				46,
				136,
				Math.round((148 * (GC.ceiling - left)) / GC.ceiling),
				3,
			);
			hud(g, `${B.chips} ${shown(s.chips, clock)}`, `${B.hi} ${s.best}`);
		},
		over: (s) => s.over,
		score: (s) => s.best,
		end: () => ARCADE.over,
	});
};

// ───────────────── ハイ＆ロー ─────────────────

const HL_LOW: Rect = [16, 116, 64, 22];
const HL_TAKE: Rect = [88, 116, 64, 22];
const HL_HIGH: Rect = [160, 116, 64, 22];
const hlBetBtn = (i: number): Rect => [10, 34 + i * 18, 48, 15];
const RANK = [
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
];

const card = (g: G, x: number, y: number, n: number | null): void => {
	g.fillStyle = n === null ? "#6a2a2a" : "#f8f4ea";
	g.fillRect(x, y, 36, 50);
	g.strokeStyle = "#202020";
	g.strokeRect(x + 0.5, y + 0.5, 35, 49);
	if (n !== null)
		txt(
			g,
			RANK[n] ?? "?",
			x + 18,
			y + 17,
			16,
			n > 10 || n === 1 ? "#c02030" : "#202020",
			"center",
		);
	else txt(g, "？", x + 18, y + 17, 16, "#f0c040", "center");
};

const multLabel = (m: number): string => (m > 0 ? `×${m.toFixed(2)}` : "—");

export const playHighLow = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let flash = "";
	const shown = counter();
	return playBoard(ctx, "highlow", {
		start: () => hlStart(rnd),
		quitScores: true,
		step: (s, f) => {
			let c: HlChoice | null = null;
			let bet: number | undefined;
			const bi = Math.max(0, HL.bets.indexOf(s.bet));
			for (const e of f.evs) {
				if (isKey(e, "left")) c = "low";
				else if (isKey(e, "right")) c = "high";
				else if (isKey(e, "a")) c = "take";
				else if (isKey(e, "up"))
					bet = HL.bets[Math.min(HL.bets.length - 1, bi + 1)];
				else if (isKey(e, "down")) bet = HL.bets[Math.max(0, bi - 1)];
				else if (isTap(e)) {
					if (inside(e.tap, HL_LOW)) c = "low";
					else if (inside(e.tap, HL_HIGH)) c = "high";
					else if (inside(e.tap, HL_TAKE)) c = "take";
					HL.bets.forEach((b, i) => {
						if (inside(e.tap, hlBetBtn(i))) bet = b;
					});
				}
			}
			const before = s.chips;
			for (const e of hlStep(s, f.dt, c, rnd, bet)) {
				if (e === "flip") f.se("cardFlip");
				else if (e === "pick") f.se("cursor");
				else if (e === "win") {
					f.se(s.streak >= 5 ? "levelup" : "item");
					flash = fill(B.hlWin, { n: s.lastMult.toFixed(2) });
				} else if (e === "push") flash = B.hlPush;
				else if (e === "lose") {
					f.se("miss");
					flash = B.hlLose;
				} else if (e === "take") {
					const n = s.chips - before;
					f.se(n >= 50 ? "victory" : "levelup");
					flash = fill(B.hlTook, { n });
				} else if (e === "bust") flash = B.bust;
				else if (e === "bet") f.se("arcCoin");
			}
		},
		draw: (g, s, clock) => {
			casinoFloor(g);
			card(g, 82, 36, s.card);
			// 開く ときは 少し 裏の まま（めくる 間）
			card(g, 146, 36, s.phase === "reveal" && s.t > 0.15 ? s.next : null);
			txt(g, "→", 132, 54, 12, "#f0c040", "center");
			// 賭ける 枚数（賭けの ない ときだけ 変えられる）
			txt(g, B.hlBet, 34, 24, 7, "#c8b890", "center");
			HL.bets.forEach((b, i) => {
				button(
					g,
					hlBetBtn(i),
					fill(B.hlBetN, { n: b }),
					s.bet === b,
					s.pot > 0 ? "#2a2010" : "#3a2a10",
				);
			});
			if (s.pot > 0) {
				const hotPot = s.streak >= 5 && Math.floor(clock * 6) % 2 === 1;
				txt(
					g,
					fill(B.hlPot, { n: hlCash(s.pot) }),
					AW / 2 + 16,
					92,
					8,
					hotPot ? "#ffe060" : "#ffffff",
					"center",
				);
				txt(
					g,
					`${fill(B.hlStreak, { n: s.streak })}／${HL.maxStreak}`,
					AW / 2 + 16,
					102,
					7,
					"#c8b890",
					"center",
				);
			}
			if (flash) txt(g, flash, AW / 2, 20, 8, "#ffe060", "center");
			// 倍率は 札の 上に（当たる 札が ない 方は —）
			const ml = s.phase === "guess" ? hlMult(s.card, "low") : 0;
			const mh = s.phase === "guess" ? hlMult(s.card, "high") : 0;
			if (s.phase === "guess") {
				txt(g, multLabel(ml), 48, 107, 7, "#f4e8c8", "center");
				txt(g, multLabel(mh), 192, 107, 7, "#f4e8c8", "center");
			}
			button(g, HL_LOW, `← ${B.hlLow}`, false, ml > 0 ? "#3a2a10" : "#201808");
			button(
				g,
				HL_TAKE,
				`A ${B.hlTake}`,
				false,
				s.pot > 0 ? "#5a3a10" : "#2a2010",
			);
			button(
				g,
				HL_HIGH,
				`${B.hlHigh} →`,
				false,
				mh > 0 ? "#3a2a10" : "#201808",
			);
			hud(
				g,
				`${B.chips} ${shown(s.chips, clock)}`,
				`${B.hi} ${Math.max(s.best, s.chips)}`,
			);
		},
		over: (s) => s.over,
		score: hlScore,
		end: () => ARCADE.over,
	});
};

// ───────────────── ルーレット ─────────────────

const RL_INK: Record<RlColor, string> = {
	red: "#c02030",
	black: "#202028",
	green: "#20a040",
};
type RlCell =
	| { k: "bet"; bet: RlBet; r: Rect }
	| { k: "amount"; n: number; r: Rect }
	| { k: "clear"; r: Rect }
	| { k: "spin"; r: Rect };
type RlCellKind =
	| { k: "bet"; bet: RlBet }
	| { k: "amount"; n: number }
	| { k: "clear" }
	| { k: "spin" };
const RL_X = 128;
const RL_W = 108;
/** 右の 札の 並び（行ごと、幅は 行の 中で 等分）。 */
const RL_GRID: readonly RlCell[][] = (
	[
		[
			{ k: "bet", bet: "red" },
			{ k: "bet", bet: "black" },
			{ k: "bet", bet: "zero" },
		],
		[
			{ k: "bet", bet: "odd" },
			{ k: "bet", bet: "even" },
		],
		[
			{ k: "bet", bet: "low" },
			{ k: "bet", bet: "high" },
		],
		[
			{ k: "bet", bet: "d1" },
			{ k: "bet", bet: "d2" },
			{ k: "bet", bet: "d3" },
		],
		[
			...RL_AMOUNTS.map((n): RlCellKind => ({ k: "amount", n })),
			{ k: "clear" },
		],
		[{ k: "spin" }],
	] as RlCellKind[][]
).map((row, ri) =>
	row.map((c, i): RlCell => {
		const n = row.length;
		const x0 = Math.round((i * (RL_W + 2)) / n);
		const x1 = Math.round(((i + 1) * (RL_W + 2)) / n);
		return { ...c, r: [RL_X + x0, 17 + ri * 21, x1 - x0 - 2, 19] } as RlCell;
	}),
);

const rlBetInk = (b: RlBet): string =>
	b === "red"
		? RL_INK.red
		: b === "black"
			? RL_INK.black
			: b === "zero"
				? RL_INK.green
				: "#3a2a10";

export const playRoulette = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let flash = "";
	let cr = 0;
	let cc = 0;
	const shown = counter();
	const act = (c: RlCell | undefined, ip: RlInput): void => {
		if (!c) return;
		if (c.k === "bet") ip.place = c.bet;
		else if (c.k === "amount") ip.amount = c.n;
		else if (c.k === "clear") ip.clear = true;
		else ip.spin = true;
	};
	return playBoard(ctx, "roulette", {
		start: rlStart,
		quitScores: true,
		step: (s, f) => {
			const ip: RlInput = { spin: false };
			let moved = false;
			for (const e of f.evs) {
				const rowLen = (r: number) => RL_GRID[r]?.length ?? 1;
				if (isKey(e, "left", true)) {
					cc = Math.max(0, cc - 1);
					moved = true;
				} else if (isKey(e, "right", true)) {
					cc = Math.min(rowLen(cr) - 1, cc + 1);
					moved = true;
				} else if (isKey(e, "up", true) || isKey(e, "down", true)) {
					// 行の 幅が ちがうので 横の 位置の 割合で 移る
					const k = (cc + 0.5) / rowLen(cr);
					cr = isKey(e, "up", true)
						? Math.max(0, cr - 1)
						: Math.min(RL_GRID.length - 1, cr + 1);
					cc = Math.min(rowLen(cr) - 1, Math.floor(k * rowLen(cr)));
					moved = true;
				} else if (isKey(e, "a")) act(RL_GRID[cr]?.[cc], ip);
				else if (isTap(e))
					RL_GRID.forEach((row, ri) => {
						row.forEach((c, ci) => {
							if (!inside(e.tap, c.r)) return;
							cr = ri;
							cc = ci;
							act(c, ip);
						});
					});
			}
			if (moved) f.se("cursor");
			for (const e of rlStep(s, f.dt, ip, rnd)) {
				if (e === "pick") f.se("cursor");
				else if (e === "place") f.se("arcCoin");
				else if (e === "clear") f.se("cancel");
				else if (e === "spin") {
					f.se("mix");
					flash = "";
				} else if (e === "tick") {
					// 止まる まぎわだけ カチカチ（回り はじめは うるさい）
					if (s.t > 2.2) f.se("cursor");
				} else if (e === "win") {
					f.se(s.lastWin >= rlTotal(s.bets) * 3 ? "victory" : "levelup");
					flash = fill(s.lastWin >= rlTotal(s.bets) * 3 ? B.rlBig : B.rlWin, {
						n: s.lastWin,
					});
				} else if (e === "lose") {
					f.se("miss");
					flash = B.rlLose;
				} else if (e === "bust") flash = B.bust;
			}
		},
		draw: (g, s, clock) => {
			casinoFloor(g);
			// 盤（円に 37の ポケット。上の 印が 止まる 所）
			const cx = 64;
			const cy = 84;
			const R = 48;
			const step = (Math.PI * 2) / 37;
			for (let i = 0; i < 37; i++) {
				const n = RL_WHEEL[i] ?? 0;
				const a = -Math.PI / 2 + (i - s.pos) * step;
				g.fillStyle = RL_INK[rlColorOf(n)];
				g.beginPath();
				g.moveTo(cx, cy);
				g.arc(cx, cy, R, a - step / 2, a + step / 2);
				g.fill();
			}
			g.fillStyle = "#6a4a20";
			g.beginPath();
			g.arc(cx, cy, R - 14, 0, Math.PI * 2);
			g.fill();
			const n = rlNumber(s);
			if (s.phase === "pay") {
				g.fillStyle = RL_INK[rlColorOf(n)];
				g.beginPath();
				g.arc(cx, cy, 14, 0, Math.PI * 2);
				g.fill();
			}
			txt(
				g,
				String(n),
				cx,
				cy - 8,
				16,
				s.phase === "spin" ? "#d0c0a0" : "#ffffff",
				"center",
			);
			// 印
			g.fillStyle = "#ffe060";
			g.beginPath();
			g.moveTo(cx - 4, cy - R - 6);
			g.lineTo(cx + 4, cy - R - 6);
			g.lineTo(cx, cy - R + 2);
			g.fill();
			// 出た 目（新しい ほうが 左）
			s.history.forEach((h, i) => {
				chip(
					g,
					12 + i * 13,
					22,
					12,
					9,
					RL_INK[rlColorOf(h)],
					String(h),
					"#ffffff",
					7,
				);
			});
			// 札
			const blink = Math.floor(clock * 6) % 2 === 1;
			const total = rlTotal(s.bets);
			RL_GRID.forEach((row, ri) => {
				row.forEach((c, ci) => {
					if (c.k === "bet") {
						const lit = s.phase === "pay" && rlWins(c.bet, n) && blink;
						button(g, c.r, B.rlBets[c.bet], lit, rlBetInk(c.bet));
						const v = s.bets[c.bet];
						if (v > 0) {
							const [x, y, w] = c.r;
							g.fillStyle = "#f0c040";
							g.beginPath();
							g.arc(x + w - 4, y + 4, 5, 0, Math.PI * 2);
							g.fill();
							txt(g, String(v), x + w - 4, y + 1, 7, "#201000", "center");
						}
					} else if (c.k === "amount")
						button(g, c.r, String(c.n), s.amount === c.n);
					else if (c.k === "clear")
						button(g, c.r, B.rlClear, false, total > 0 ? "#5a3a10" : "#2a2010");
					else
						button(
							g,
							c.r,
							`A ${total === 0 && rlTotal(s.lastBets) > 0 ? B.rlAgain : B.rlSpin}`,
							s.phase !== "bet",
						);
					// 十字の いる 札
					if (ri === cr && ci === cc && s.phase === "bet") {
						const [x, y, w, h] = c.r;
						g.strokeStyle = "#ffffff";
						g.lineWidth = 1;
						g.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
					}
				});
			});
			if (flash) txt(g, flash, cx, 136, 7, "#ffe060", "center");
			hud(
				g,
				`${B.chips} ${shown(s.chips, clock)}${total > 0 ? `　${fill(B.hlPot, { n: total })}` : ""}`,
				`${B.hi} ${s.best}`,
			);
		},
		over: (s) => s.over,
		score: (s) => s.best,
		end: () => ARCADE.over,
	});
};

// ───────────────── スイカ割り ─────────────────

const SC = 12;
const SX0 = 4;
const SY0 = 24;

export const playSuika = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	const posts: Post[] = [];
	let seen = 0;
	let hitAt = -9;
	return playBoard(ctx, "suika", {
		start: () => swStart(rnd),
		step: (s, f) => {
			let move: SwDir | undefined;
			let swing = false;
			for (const e of f.evs) {
				for (const d of ["up", "down", "left", "right"] as const)
					if (isKey(e, d, true)) move = d;
				if (isKey(e, "a")) swing = true;
				else if (isTap(e)) {
					const tx = Math.floor((e.tap[0] - SX0) / SC);
					const ty = Math.floor((e.tap[1] - SY0) / SC);
					const dx = tx - s.x;
					const dy = ty - s.y;
					if (dx === 0 && dy === 0) swing = true;
					else if (tx >= 0 && tx < SK_W && ty >= 0 && ty < SK_H)
						move =
							Math.abs(dx) >= Math.abs(dy)
								? dx > 0
									? "right"
									: "left"
								: dy > 0
									? "down"
									: "up";
				}
			}
			for (const e of swStep(s, f.dt, { move, swing }, rnd)) {
				if (e === "step") f.se("cursor");
				else if (e === "bump") f.se("cancel");
				else if (e === "hit") {
					f.se("hit_club");
					f.say(fill(B.swHit, { n: s.lastPts }));
					hitAt = f.clock;
				} else if (e === "near") {
					f.se("swing_blunt");
					f.say(B.swNear1);
				} else if (e === "miss") {
					f.se("swing_blunt");
					f.say(B.swMiss);
				} else if (e === "timeup") f.say(B.swTimeup);
			}
			// 新しい 声を スレに 足す
			for (; seen < s.hints.length; seen++) {
				const h = s.hints[seen];
				if (!h) continue;
				if (h.who === "gaya") {
					const list = B.swGaya;
					posts.push({
						name: B.swNanashi,
						body: list[Math.floor((h.pick ?? 0) * list.length)] ?? "",
					});
					continue;
				}
				const dir = h.dir ? B.swDirs[h.dir] : "";
				posts.push({
					name: h.who === "troll" ? B.swTroll : B.swNanashi,
					body: fill(B.swNear[h.near] ?? "", { dir }),
					ink: h.who === "troll" ? "#f08080" : undefined,
				});
			}
		},
		draw: (g, s, clock) => {
			// 目かくし：浜は 暗く、キリコの 足もとだけ 見える。割った スイカと おわりの スイカは 見える
			g.fillStyle = "#1a1408";
			g.fillRect(0, 0, AW, AH);
			for (let y = 0; y < SK_H; y++)
				for (let x = 0; x < SK_W; x++) {
					g.fillStyle = (x + y) % 2 ? "#3a3018" : "#342a14";
					g.fillRect(SX0 + x * SC, SY0 + y * SC, SC - 1, SC - 1);
				}
			if (s.prev && clock - hitAt < 1.2) {
				const px = SX0 + s.prev[0] * SC + SC / 2;
				const py = SY0 + s.prev[1] * SC + SC / 2;
				chip(g, px, py, 12, 8, "#e04040", "");
				chip(g, px - 5, py + 3, 4, 4, "#30a040", "");
				chip(g, px + 5, py + 3, 4, 4, "#30a040", "");
			}
			if (s.over)
				chip(
					g,
					SX0 + s.sx * SC + SC / 2,
					SY0 + s.sy * SC + SC / 2,
					10,
					10,
					"#30a040",
					"",
				);
			// キリコ（目かくしの 白い 帯）。空ぶりの あとは ふらつく
			const wob = s.stun > 0 ? Math.round(Math.sin(clock * 20) * 2) : 0;
			const kx = SX0 + s.x * SC + SC / 2 + wob;
			const ky = SY0 + s.y * SC + SC / 2;
			g.fillStyle = "#7a3a20";
			g.fillRect(kx - 4, ky - 6, 8, 3);
			g.fillStyle = "#f2d0a8";
			g.fillRect(kx - 3, ky - 3, 6, 4);
			g.fillStyle = "#ffffff";
			g.fillRect(kx - 4, ky - 3, 8, 2);
			g.fillStyle = "#4060c0";
			g.fillRect(kx - 4, ky + 1, 8, 5);
			drawPosts(g, posts, 140, 18, 96, 128, 7);
			const left = Math.max(0, Math.ceil(SW.time - s.t));
			hud(
				g,
				`${ARCADE_BOARD.time} ${left}`,
				`${fill(B.swCount, { n: s.melons })} ${B.score} ${s.score}`,
			);
			if (left <= 5 && !s.over && Math.floor(clock * 4) % 2 === 1)
				txt(g, String(left), 70, 110, 16, "#ff6060", "center");
		},
		over: (s) => s.over,
		score: (s) => s.score,
		end: (s) => (s.melons > 0 ? ARCADE.clear : ARCADE.over),
	});
};

// ───────────────── グラス滑らせ ─────────────────

export const playGlassSlide = (ctx: UiCtx): Promise<ArcadeResult | null> =>
	playBoard(ctx, "glassSlide", {
		start: () => gsStart(rnd),
		step: (s, f) => {
			const press = f.evs.some((e) => isKey(e, "a") || isTap(e));
			for (const e of gsStep(s, f.dt, press, rnd)) {
				if (e === "release") f.se("decide");
				else if (e === "stop") {
					const p = s.last ?? 0;
					f.se(p === 100 ? (s.combo >= 2 ? "levelup" : "item") : "glass");
					f.say(
						p === 100
							? s.combo >= 2
								? fill(B.gsCombo, { n: s.combo, b: s.bonus })
								: B.gsExact
							: fill(p >= 80 ? B.gsClose : B.gsPoints, { n: p }),
					);
				} else if (e === "break") {
					f.se("glassBreak");
					f.say(B.gsBreak);
				} else if (e === "next") f.say(fill(B.gsRound, { n: s.round + 1 }));
			}
		},
		draw: (g, s, clock) => {
			g.fillStyle = "#1c1210";
			g.fillRect(0, 0, AW, AH);
			// 酒棚
			g.fillStyle = "#2c1c14";
			g.fillRect(0, ATOP, AW, 40);
			for (let i = 0; i < 18; i++) {
				g.fillStyle =
					["#3a6a3a", "#6a3a2a", "#c8a050", "#3a4a7a"][i % 4] ?? "#888";
				g.fillRect(8 + i * 13, ATOP + 10 + (i % 3) * 2, 6, 18 - (i % 3) * 2);
			}
			// カウンター（はしの 先は 床）
			g.fillStyle = "#6a3a1c";
			g.fillRect(4, GS.counterY, GS.endX - 4, 10);
			g.fillStyle = "#8a5228";
			g.fillRect(4, GS.counterY, GS.endX - 4, 2);
			// 客（名無し。酔っぱらいは 顔が 赤く ゆれる）と その 前の 印
			const t = Math.round(s.target);
			g.fillStyle = s.drunk ? "#f0a0a0" : "#e8e8e8";
			g.fillRect(t - 4, GS.counterY - 26, 8, 8);
			g.fillStyle = s.drunk ? "#705060" : "#606870";
			g.fillRect(t - 6, GS.counterY - 18, 12, 14);
			g.fillStyle = "#ffe060";
			g.fillRect(t - 1, GS.counterY + 2, 2, 4);
			if (s.drunk && Math.floor(clock * 1.5) % 3 === 0)
				txt(g, B.gsDrunk, t, GS.counterY - 38, 7, "#f0c0c0", "center");
			// グラス
			if (!s.broke) {
				const x = Math.round(Math.min(s.x, GS.endX));
				g.fillStyle = "rgba(220,240,255,0.85)";
				g.fillRect(x - 3, GS.counterY - 9, 6, 9);
				g.fillStyle = "#e0a030";
				g.fillRect(x - 2, GS.counterY - 5, 4, 4);
			} else
				txt(g, "＊", GS.endX + 2, GS.counterY + 14, 8, "#d0e0f0", "center");
			// 力の ゲージ
			if (s.phase === "aim") {
				txt(g, B.gsPower, 12, 116, 8, "#e8e8f0");
				g.fillStyle = "#303038";
				g.fillRect(34, 118, 160, 6);
				g.fillStyle = s.power > 0.8 ? "#e04040" : "#40c060";
				g.fillRect(34, 118, Math.round(160 * s.power), 6);
			}
			if (s.combo >= 2)
				txt(
					g,
					fill(B.gsChain, { n: s.combo }),
					AW / 2,
					132,
					7,
					"#ffe060",
					"center",
				);
			hud(
				g,
				`${B.score} ${s.score}`,
				fill(B.gsRound, { n: Math.min(GS.rounds, s.round + 1) }) +
					`／${GS.rounds}`,
			);
		},
		over: (s) => s.over,
		score: (s) => s.score,
		end: () => ARCADE.clear,
	});
