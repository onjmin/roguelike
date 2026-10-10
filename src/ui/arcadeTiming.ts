// ゲームセンターの 筐体の 板（ねらって たたく・間合いを はかる 台）。決まりは data/arcade/logic.ts、文は data/arcade/text.ts。
// - もぐらたたき「ROMたたき」：十字キーで カーソル、A で たたく。穴を タップすると その 穴を たたく。
// - 格ゲー「レスバトル」：A・タップで 返す（相手の「！」の あと、なぐられる 直前）。
// - メダルゲーム「メダルスロット」：A・タップで 回す・止める。B（板の 外を 2回）で やめる（その ときの 枚数で 記録）。
// - 音ゲー「保守ビート」：←↓↑→ が 左から 4つの 道。道を タップでも たたける。押した 時刻で 判定する
//   （描画の こまで はかると 50ms の 刻みで ずれる）。

import {
	AH,
	ATOP,
	AW,
	FT_FOES,
	type FtState,
	ftStart,
	ftStep,
	ML,
	mlStart,
	mlStep,
	RH,
	rhStart,
	rhStep,
	SL,
	slAt,
	slStart,
	slStep,
} from "../data/arcade/logic";
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
import { type G, txt } from "./netaBoard";
import { fill } from "./villageTalk";

const rnd = Math.random;

// ───────────────── もぐらたたき ─────────────────

const MX = 60;
const MY = 26;
const MW = 40;
const MH = 38;

const holeAt = (x: number, y: number): number => {
	const c = Math.floor((x - MX) / MW);
	const r = Math.floor((y - MY) / MH);
	return c >= 0 && c < 3 && r >= 0 && r < 3 ? r * 3 + c : -1;
};

export const playMole = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let cur = 4;
	return playBoard(ctx, "mole", {
		start: mlStart,
		step: (s, f) => {
			const hits: number[] = [];
			for (const e of f.evs) {
				if (isKey(e, "left", true) && cur % 3 > 0) cur--;
				else if (isKey(e, "right", true) && cur % 3 < 2) cur++;
				else if (isKey(e, "up", true) && cur >= 3) cur -= 3;
				else if (isKey(e, "down", true) && cur < 6) cur += 3;
				else if (isKey(e, "a")) hits.push(cur);
				else if (isTap(e)) {
					const i = holeAt(e.tap[0], e.tap[1]);
					if (i >= 0) {
						cur = i;
						hits.push(i);
					}
				}
			}
			for (const e of mlStep(s, f.dt, hits, rnd)) {
				if (e === "bonk") {
					f.se("hit_club");
					f.say("");
				} else if (e === "ouch") {
					f.se("cancel");
					f.say(ARCADE_BOARD.moleOuch);
				} else if (e === "whiff") f.se("swing_fist");
			}
		},
		draw: (g, s) => {
			g.fillStyle = "#3a2a1a";
			g.fillRect(0, 0, AW, AH);
			s.holes.forEach((h, i) => {
				const x = MX + (i % 3) * MW + MW / 2;
				const y = MY + Math.floor(i / 3) * MH + MH - 10;
				// 穴
				g.fillStyle = "#140c06";
				g.fillRect(x - 14, y - 2, 28, 8);
				if (h.kind) {
					const icchi = h.kind === "icchi";
					chip(
						g,
						x,
						y - 10,
						28,
						18,
						icchi ? "#e0c060" : "#c8c8d0",
						icchi ? "イッチ" : "ROM",
						"#202020",
						8,
					);
				} else if (h.bonkKind) {
					chip(g, x, y - 4, 22, 8, "#806060", "");
					txt(
						g,
						h.bonkKind === "rom" ? ARCADE_BOARD.moleBonk : "！？",
						x,
						y - 20,
						8,
						"#ffe060",
						"center",
					);
				}
				if (i === cur) {
					g.strokeStyle = "#ffe060";
					g.lineWidth = 1;
					g.strokeRect(x - MW / 2 + 2.5, y - MH + 12.5, MW - 5, MH - 5);
				}
			});
			hud(
				g,
				`${ARCADE_BOARD.score} ${s.score}`,
				`${ARCADE_BOARD.time} ${Math.max(0, Math.ceil(ML.time - s.t))}`,
			);
		},
		over: (s) => s.over,
		score: (s) => s.score,
		end: () => ARCADE.clear,
	});
};

// ───────────────── 格ゲー ─────────────────

const bar = (
	g: G,
	x: number,
	y: number,
	n: number,
	max: number,
	ink: string,
	right = false,
): void => {
	for (let i = 0; i < max; i++) {
		const bx = right ? x - (i + 1) * 9 : x + i * 9;
		g.fillStyle = i < n ? ink : "#303038";
		g.fillRect(bx, y, 8, 5);
	}
};

const fighter = (
	g: G,
	x: number,
	y: number,
	body: string,
	flip: boolean,
	punch: boolean,
): void => {
	const d = flip ? -1 : 1;
	g.fillStyle = "#f2d0a8";
	g.fillRect(x - 5, y - 30, 10, 9);
	g.fillStyle = body;
	g.fillRect(x - 7, y - 21, 14, 14);
	g.fillStyle = "#303040";
	g.fillRect(x - 6, y - 7, 5, 7);
	g.fillRect(x + 1, y - 7, 5, 7);
	g.fillStyle = "#f2d0a8";
	if (punch) g.fillRect(flip ? x - 22 : x + 7, y - 19, 15, 4);
	else g.fillRect(x + 7 * d - (flip ? 4 : 0), y - 18, 4, 6);
};

export const playFighter = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let flash = "";
	let flashT = 0;
	const show = (s: string) => {
		flash = s;
		flashT = 0.6;
	};
	return playBoard<FtState>(ctx, "fighter", {
		start: ftStart,
		step: (s, f) => {
			const press = f.evs.some((e) => isKey(e, "a") || isTap(e));
			flashT = Math.max(0, flashT - f.dt);
			for (const e of ftStep(s, f.dt, press, rnd)) {
				if (e === "wind") f.se("cursor");
				else if (e === "counter") {
					f.se("hit_fist");
					show(ARCADE_BOARD.fighterCounter);
				} else if (e === "early") {
					f.se("damage");
					show(ARCADE_BOARD.fighterEarly);
				} else if (e === "hit") {
					f.se("damage");
					show(ARCADE_BOARD.fighterHit);
				} else if (e === "ko") {
					f.se("critical");
					show(ARCADE_BOARD.fighterKo);
				} else if (e === "next")
					f.say(
						fill(ARCADE_BOARD.fighterNext, {
							name: FT_FOES[s.foe]?.name ?? "",
						}),
					);
			}
		},
		draw: (g, s) => {
			const foe = FT_FOES[s.foe];
			g.fillStyle = "#2a1838";
			g.fillRect(0, 0, AW, AH);
			g.fillStyle = "#4a3050";
			g.fillRect(0, 118, AW, AH - 118);
			txt(g, ARCADE_BOARD.fighterYou, 8, 18, 8, "#e8e8f0");
			bar(g, 8, 29, s.hp, 5, "#40c060");
			txt(g, foe?.name ?? "", AW - 8, 18, 8, "#e8e8f0", "right");
			bar(g, AW - 8, 29, s.foeHp, foe?.hp ?? 3, "#e04040", true);
			const kiriPunch = s.phase === "counter";
			const foePunch = s.phase === "stun";
			const ko = s.phase === "ko";
			fighter(g, 80, 118, "#4060c0", false, kiriPunch);
			if (!ko) fighter(g, 160, 118, "#a03030", true, foePunch);
			else {
				g.fillStyle = "#a03030";
				g.fillRect(150, 112, 26, 6);
			}
			if (s.phase === "wind" || s.phase === "feint")
				txt(g, "！", 160, 66, 16, "#ffe060", "center");
			if (flashT > 0) txt(g, flash, AW / 2, 46, 12, "#ffffff", "center");
			hud(
				g,
				`${ARCADE_BOARD.score} ${s.score}`,
				`${s.foe + 1}／${FT_FOES.length}`,
			);
		},
		over: (s) => s.over,
		score: (s) => s.score,
		end: (s) => (s.clear ? ARCADE.clear : ARCADE.over),
	});
};

// ───────────────── メダルスロット ─────────────────

const SYM_INK: Record<string, string> = {
	"7": "#e03030",
	ID: "#3060d0",
	鯖: "#30a0a0",
	草: "#40a040",
	ｗ: "#a050c0",
	乙: "#806040",
};

export const playSlot = (ctx: UiCtx): Promise<ArcadeResult | null> =>
	playBoard(ctx, "slot", {
		start: slStart,
		quitScores: true,
		step: (s, f) => {
			const press = f.evs.some((e) => isKey(e, "a") || isTap(e));
			for (const e of slStep(s, f.dt, press)) {
				if (e === "bet") {
					f.se("arcCoin");
					f.say("");
				} else if (e === "stop") f.se("decide");
				else if (e === "win") {
					f.se(s.lastWin >= 50 ? "victory" : "levelup");
					f.say(fill(ARCADE_BOARD.slotWin, { n: s.lastWin }));
				} else if (e === "bust") f.say(ARCADE_BOARD.slotBust);
			}
		},
		draw: (g, s) => {
			g.fillStyle = "#301018";
			g.fillRect(0, 0, AW, AH);
			for (let i = 0; i < 3; i++) {
				const x = 54 + i * 46;
				g.fillStyle = "#f4f0e4";
				g.fillRect(x, 32, 40, 84);
				const pos = s.pos[i] ?? 0;
				const frac = pos - Math.round(pos);
				g.save();
				g.beginPath();
				g.rect(x, 32, 40, 84);
				g.clip();
				for (let k = -2; k <= 2; k++) {
					const sym = slAt(i, Math.round(pos) + k);
					const y = 74 + (k - frac) * 26;
					txt(
						g,
						sym,
						x + 20,
						y - 7,
						sym.length > 1 ? 12 : 14,
						SYM_INK[sym] ?? "#202020",
						"center",
					);
				}
				g.restore();
				if (s.stopped[i] && s.phase !== "idle") {
					g.fillStyle = "rgba(0,0,0,0.08)";
					g.fillRect(x, 32, 40, 84);
				}
			}
			// まんなかの 列
			g.strokeStyle = "#ffe060";
			g.lineWidth = 1;
			g.strokeRect(50.5, 61.5, 140, 26);
			txt(
				g,
				"7=50 ID=20 鯖=12 草=8 ｗ=5 乙=3",
				AW / 2,
				124,
				7,
				"#d0b0a0",
				"center",
			);
			hud(
				g,
				`${ARCADE_BOARD.medals} ${s.medals}`,
				`${ARCADE_BOARD.hi} ${s.best}`,
			);
		},
		over: (s) => s.over,
		score: (s) => s.best,
		end: (s) => (s.medals >= SL.cap ? ARCADE.clear : ARCADE.over),
	});

// ───────────────── 音ゲー ─────────────────

const LX = 64;
const LW = 28;
const LANE_KEYS = ["left", "down", "up", "right"] as const;
const LANE_INK = ["#e05080", "#40a0e0", "#60c060", "#e0a030"];

export const playRhythm = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let judge = "";
	let judgeT = 0;
	const lit = [0, 0, 0, 0];
	return playBoard(ctx, "rhythm", {
		start: rhStart,
		step: (s, f) => {
			const hits: { lane: number; at: number }[] = [];
			for (const e of f.evs) {
				const k = LANE_KEYS.findIndex((d) => isKey(e, d));
				if (k >= 0) hits.push({ lane: k, at: f.secOf(e.at) });
				else if (isTap(e)) {
					const l = Math.floor((e.tap[0] - LX) / LW);
					if (l >= 0 && l < RH.lanes) hits.push({ lane: l, at: f.secOf(e.at) });
				}
			}
			for (const h of hits) lit[h.lane] = 0.12;
			for (let i = 0; i < lit.length; i++)
				lit[i] = Math.max(0, (lit[i] ?? 0) - f.dt);
			judgeT = Math.max(0, judgeT - f.dt);
			// 時計どおりに 進める（こまが 遅れても 札の 時刻は ずれない）
			for (const e of rhStep(s, Math.max(0, f.clock - s.t), hits)) {
				if (e.judge !== "miss") f.se("cursor");
				judge = ARCADE_BOARD.rhythmJudge[e.judge];
				judgeT = 0.5;
			}
			if (s.over && s.counts.miss === 0) f.say(ARCADE_BOARD.rhythmFull);
		},
		draw: (g, s) => {
			g.fillStyle = "#0c0c1c";
			g.fillRect(0, 0, AW, AH);
			for (let l = 0; l < RH.lanes; l++) {
				const x = LX + l * LW;
				g.fillStyle = (lit[l] ?? 0) > 0 ? "#2a2a4a" : "#16162a";
				g.fillRect(x, ATOP, LW - 1, AH - ATOP);
				txt(
					g,
					["←", "↓", "↑", "→"][l] ?? "",
					x + LW / 2,
					RH.judgeY + 8,
					8,
					"#606080",
					"center",
				);
			}
			g.fillStyle = "#e8e8f0";
			g.fillRect(LX, RH.judgeY, LW * RH.lanes - 1, 1);
			for (const n of s.notes) {
				if (n.judged && n.judged !== "miss") continue;
				const y = RH.judgeY - (n.at - s.t) * RH.speed;
				if (y < ATOP - 4 || y > AH + 4) continue;
				g.fillStyle =
					n.judged === "miss" ? "#404050" : (LANE_INK[n.lane] ?? "#fff");
				g.fillRect(LX + n.lane * LW + 2, Math.round(y) - 2, LW - 5, 4);
			}
			if (judgeT > 0) txt(g, judge, AW / 2, 60, 12, "#ffe060", "center");
			if (s.combo >= 5)
				txt(
					g,
					fill(ARCADE_BOARD.rhythmCombo, { n: s.combo }),
					AW / 2,
					76,
					8,
					"#e8e8f0",
					"center",
				);
			hud(g, `${ARCADE_BOARD.score} ${s.score}`, `MAX ${s.maxCombo}`);
		},
		over: (s) => s.over,
		score: (s) => s.score,
		end: () => ARCADE.clear,
	});
};
