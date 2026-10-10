// カジノ「ガチャ」の 台と、海の家・バーの 遊びの 板。決まりは data/arcade/parlor.ts、文は data/arcade/text.ts。
// - ガチャスロット：A・タップで 引く（リールは 自動で 止まる）。
// - ハイ＆ロー：← ロー・→ ハイ・A 降りる。タップは 左の 札＝ロー、右の 札＝ハイ、まんなか＝降りる。
// - ルーレット：←→ で 色、↑↓ で 枚数、A で 回す。タップは 色・枚数・回すの 札。
// - スイカ割り：十字キーで 1歩、A で 棒を ふる。タップは キリコから 見た 方へ 1歩（キリコの マスなら ふる）。
// - グラス滑らせ：A・タップで 力を 決める。
// チップは 店が 貸す 遊びの チップ（ゴールドとは 別）。B（板の 外を 2回）で やめると その ときの いちばんで 記録する。

import { AH, ATOP, AW } from "../data/arcade/logic";
import {
	GC_SYMS,
	type GcSym,
	GS,
	gcStart,
	gcStep,
	gsStart,
	gsStep,
	HL,
	type HlChoice,
	hlScore,
	hlStart,
	hlStep,
	RL_AMOUNTS,
	RL_COLORS,
	RL_WHEEL,
	type RlColor,
	rlColorOf,
	rlNumber,
	rlStart,
	rlStep,
	SK_H,
	SK_W,
	SW,
	type SwDir,
	swStart,
	swStep,
} from "../data/arcade/parlor";
import { ARCADE, ARCADE_BOARD } from "../data/arcade/text";
import {
	type ArcadeResult,
	chip,
	hud,
	isKey,
	isTap,
	playBoard,
} from "./arcadeKit";
import type { UiCtx } from "./list";
import { drawPosts, type G, type Post, txt } from "./netaBoard";
import { fill } from "./villageTalk";

const rnd = Math.random;
const B = ARCADE_BOARD;

/** 四角の 中か。 */
const inside = (
	p: readonly [number, number],
	[x, y, w, h]: readonly [number, number, number, number],
): boolean => p[0] >= x && p[0] < x + w && p[1] >= y && p[1] < y + h;

/** 札（ボタン）。 */
const button = (
	g: G,
	[x, y, w, h]: readonly [number, number, number, number],
	label: string,
	on: boolean,
	fillc = "#3a2a10",
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
		y + h / 2 - 4,
		8,
		on ? "#201000" : "#f4e8c8",
		"center",
	);
};

const casinoFloor = (g: G): void => {
	g.fillStyle = "#123018";
	g.fillRect(0, 0, AW, AH);
	g.strokeStyle = "#c8a040";
	g.lineWidth = 1;
	g.strokeRect(3.5, ATOP + 3.5, AW - 7, AH - ATOP - 7);
};

// ───────────────── ガチャスロット ─────────────────

const GC_INK: Record<GcSym, string> = {
	UR: "#ff5070",
	SSR: "#f0c040",
	SR: "#c070f0",
	R: "#50a0f0",
	N: "#a0a0a8",
};

export const playGacha = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let flash = "";
	return playBoard(ctx, "gacha", {
		start: gcStart,
		quitScores: true,
		step: (s, f) => {
			const press = f.evs.some((e) => isKey(e, "a") || isTap(e));
			for (const e of gcStep(s, f.dt, press, rnd)) {
				if (e === "pull") {
					f.se("arcCoin");
					flash = "";
				} else if (e === "stop") f.se("decide");
				else if (e === "reach") {
					f.se("mix");
					flash = s.reels[0] === "UR" ? B.gachaUr : B.gachaReach;
				} else if (e === "win") {
					f.se(s.lastWin >= 60 ? "victory" : "levelup");
					flash = fill(B.gachaWin, { n: s.lastWin });
				} else if (e === "pair") flash = B.gachaPair;
				else if (e === "bust") flash = B.bust;
			}
		},
		draw: (g, s, clock) => {
			casinoFloor(g);
			for (let i = 0; i < 3; i++) {
				const x = 46 + i * 52;
				const y = 40;
				g.fillStyle = "#0a0a12";
				g.fillRect(x, y, 44, 50);
				const still = s.phase !== "spin" || i < s.stopped;
				const sym: GcSym = still
					? (s.reels[i] ?? "N")
					: (GC_SYMS[Math.floor(clock * 14 + i * 3) % GC_SYMS.length] ?? "N");
				// リーチの 3つ目は 光る ふち
				if (s.phase === "spin" && s.reach && i === 2 && !still) {
					g.strokeStyle = Math.floor(clock * 8) % 2 ? "#ffe060" : "#ff5070";
					g.lineWidth = 2;
					g.strokeRect(x - 1, y - 1, 46, 52);
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
			if (flash) txt(g, flash, AW / 2, 100, 12, "#ffe060", "center");
			txt(
				g,
				"UR=300 SSR=60 SR=15 R=5 N=2",
				AW / 2,
				124,
				7,
				"#c8b890",
				"center",
			);
			hud(g, `${B.chips} ${s.chips}`, `${B.hi} ${s.best}`);
		},
		over: (s) => s.over,
		score: (s) => s.best,
		end: () => ARCADE.over,
	});
};

// ───────────────── ハイ＆ロー ─────────────────

const HL_LOW: readonly [number, number, number, number] = [16, 112, 64, 22];
const HL_TAKE: readonly [number, number, number, number] = [88, 112, 64, 22];
const HL_HIGH: readonly [number, number, number, number] = [160, 112, 64, 22];
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

export const playHighLow = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let flash = "";
	return playBoard(ctx, "highlow", {
		start: () => hlStart(rnd),
		quitScores: true,
		step: (s, f) => {
			let c: HlChoice | null = null;
			for (const e of f.evs) {
				if (isKey(e, "left")) c = "low";
				else if (isKey(e, "right")) c = "high";
				else if (isKey(e, "a")) c = "take";
				else if (isTap(e)) {
					if (inside(e.tap, HL_LOW)) c = "low";
					else if (inside(e.tap, HL_HIGH)) c = "high";
					else if (inside(e.tap, HL_TAKE)) c = "take";
				}
			}
			for (const e of hlStep(s, f.dt, c, rnd)) {
				if (e === "flip") f.se("cardFlip");
				else if (e === "win") {
					f.se("item");
					flash = B.hlWin;
				} else if (e === "push") flash = B.hlPush;
				else if (e === "lose") {
					f.se("miss");
					flash = B.hlLose;
				} else if (e === "take") {
					f.se("levelup");
					flash = fill(B.hlTook, { n: s.chips });
				} else if (e === "bust") flash = B.bust;
				else if (e === "bet") f.se("arcCoin");
			}
		},
		draw: (g, s) => {
			casinoFloor(g);
			card(g, 70, 36, s.card);
			card(g, 134, 36, s.phase === "reveal" ? s.next : null);
			txt(g, "→", 120, 54, 12, "#f0c040", "center");
			if (s.pot > 0)
				txt(
					g,
					`${fill(B.hlPot, { n: s.pot })}　${s.streak}/${HL.maxStreak}`,
					AW / 2,
					92,
					8,
					"#ffffff",
					"center",
				);
			if (flash) txt(g, flash, AW / 2, 20, 8, "#ffe060", "center");
			button(g, HL_LOW, `← ${B.hlLow}`, false);
			button(
				g,
				HL_TAKE,
				`A ${B.hlTake}`,
				false,
				s.pot > 0 ? "#5a3a10" : "#2a2010",
			);
			button(g, HL_HIGH, `${B.hlHigh} →`, false);
			hud(g, `${B.chips} ${s.chips}`, `${B.hi} ${Math.max(s.best, s.chips)}`);
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
const colorBtn = (i: number): readonly [number, number, number, number] => [
	140 + i * 32,
	40,
	30,
	20,
];
const amountBtn = (i: number): readonly [number, number, number, number] => [
	140 + i * 32,
	70,
	30,
	20,
];
const RL_GO: readonly [number, number, number, number] = [140, 100, 94, 22];

export const playRoulette = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let flash = "";
	return playBoard(ctx, "roulette", {
		start: rlStart,
		quitScores: true,
		step: (s, f) => {
			let color: RlColor | undefined;
			let amount: number | undefined;
			let spin = false;
			const ci = RL_COLORS.indexOf(s.color);
			const ai = RL_AMOUNTS.indexOf(s.amount);
			for (const e of f.evs) {
				if (isKey(e, "left")) color = RL_COLORS[(ci + 2) % 3];
				else if (isKey(e, "right")) color = RL_COLORS[(ci + 1) % 3];
				else if (isKey(e, "up"))
					amount = RL_AMOUNTS[Math.min(2, Math.max(0, ai) + 1)];
				else if (isKey(e, "down")) amount = RL_AMOUNTS[Math.max(0, ai - 1)];
				else if (isKey(e, "a")) spin = true;
				else if (isTap(e)) {
					for (let i = 0; i < 3; i++) {
						if (inside(e.tap, colorBtn(i))) color = RL_COLORS[i];
						if (inside(e.tap, amountBtn(i))) amount = RL_AMOUNTS[i];
					}
					if (inside(e.tap, RL_GO)) spin = true;
				}
			}
			for (const e of rlStep(s, f.dt, { color, amount, spin }, rnd)) {
				if (e === "pick") f.se("cursor");
				else if (e === "spin") {
					f.se("mix");
					flash = "";
				} else if (e === "win") {
					f.se(s.color === "green" ? "victory" : "levelup");
					flash = fill(B.rlWin, { n: s.lastWin });
				} else if (e === "lose") {
					f.se("miss");
					flash = B.rlLose;
				} else if (e === "bust") flash = B.bust;
			}
		},
		draw: (g, s) => {
			casinoFloor(g);
			// 盤（円に 37の ポケット。上の 印が 止まる 所）
			const cx = 70;
			const cy = 82;
			const R = 50;
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
			const labels = [B.rlRed, B.rlBlack, B.rlGreen];
			RL_COLORS.forEach((c, i) => {
				button(g, colorBtn(i), labels[i] ?? "", s.color === c, RL_INK[c]);
			});
			RL_AMOUNTS.forEach((a, i) => {
				button(g, amountBtn(i), String(a), s.amount === a);
			});
			button(g, RL_GO, `A ${B.rlSpin}`, s.phase !== "bet");
			if (flash) txt(g, flash, 187, 128, 8, "#ffe060", "center");
			hud(g, `${B.chips} ${s.chips}`, `${B.hi} ${s.best}`);
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
				else if (e === "hint") {
					const h = s.hints[s.hints.length - 1];
					if (!h) continue;
					const dir = h.dir ? B.swDirs[h.dir] : "";
					posts.push({
						name: h.who === "troll" ? B.swTroll : B.swNanashi,
						body: fill(B.swNear[h.near] ?? "", { dir }),
						ink: h.who === "troll" ? "#f08080" : undefined,
					});
				} else if (e === "hit") {
					f.se("hit_club");
					f.say(B.swHit);
				} else if (e === "near") {
					f.se("swing_blunt");
					f.say(B.swNear1);
				} else if (e === "miss") {
					f.se("swing_blunt");
					f.say(B.swMiss);
				} else if (e === "timeup") f.say(B.swTimeup);
			}
		},
		draw: (g, s) => {
			// 目かくし：浜は 暗く、キリコの 足もとだけ 見える。割った あとは スイカも 見える
			g.fillStyle = "#1a1408";
			g.fillRect(0, 0, AW, AH);
			for (let y = 0; y < SK_H; y++)
				for (let x = 0; x < SK_W; x++) {
					g.fillStyle = (x + y) % 2 ? "#3a3018" : "#342a14";
					g.fillRect(SX0 + x * SC, SY0 + y * SC, SC - 1, SC - 1);
				}
			if (s.over)
				chip(
					g,
					SX0 + s.sx * SC + SC / 2,
					SY0 + s.sy * SC + SC / 2,
					10,
					10,
					s.result === "hit" ? "#e04040" : "#30a040",
					"",
				);
			// キリコ（目かくしの 白い 帯）
			const kx = SX0 + s.x * SC + SC / 2;
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
			hud(
				g,
				`${ARCADE_BOARD.time} ${Math.max(0, Math.ceil(SW.time - s.t))}`,
				s.over ? `${B.score} ${s.score}` : "",
			);
		},
		over: (s) => s.over,
		score: (s) => s.score,
		end: (s) => (s.result === "hit" ? ARCADE.clear : ARCADE.over),
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
					f.se("glass");
					f.say(
						s.last === 100 ? B.gsExact : fill(B.gsPoints, { n: s.last ?? 0 }),
					);
				} else if (e === "break") {
					f.se("glassBreak");
					f.say(B.gsBreak);
				} else if (e === "next") f.say(fill(B.gsRound, { n: s.round + 1 }));
			}
		},
		draw: (g, s) => {
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
			// 客（名無し）と その 前の 印
			const t = Math.round(s.target);
			g.fillStyle = "#e8e8e8";
			g.fillRect(t - 4, GS.counterY - 26, 8, 8);
			g.fillStyle = "#606870";
			g.fillRect(t - 6, GS.counterY - 18, 12, 14);
			g.fillStyle = "#ffe060";
			g.fillRect(t - 1, GS.counterY + 2, 2, 4);
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
