// ゲームセンターの 筐体の 板（ねらって たたく・間合いを はかる 台）。決まりは data/arcade/logic.ts、文は data/arcade/text.ts。
// - もぐらたたき「ROMたたき」：十字キーで カーソル、A で たたく。穴を タップすると その 穴を たたく。
// - 格ゲー「レスバトル」：A・タップで 返す（相手の「！」の あと、なぐられる 直前。ぎりぎりほど 強い）。
// - メダルゲーム「メダルスロット」：A・タップで 回す・止める。B（板の 外を 2回）で やめる（その ときの 枚数で 記録）。
// - 音ゲー「おんJビート」：←↓↑→ が 左から 4つの 道。道を タップでも たたける。押した 時刻で 判定する
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
	ML_KIND,
	mlFever,
	mlMult,
	mlStart,
	mlStep,
	RH,
	rhStart,
	rhStep,
	SL,
	slAt,
	slStart,
	slStep,
} from "../../data/arcade/logic";
import { BEAT_OPTS } from "../../data/arcade/songChart";
import { ARCADE, ARCADE_BOARD } from "../../data/arcade/text";
import type { UiCtx } from "../list";
import { type G, txt } from "../neta/netaBoard";
import { fill } from "../village/villageTalk";
import {
	burst,
	juice,
	juiceDraw,
	juiceStep,
	pop,
	quake,
	shaken,
} from "./arcadeJuice";
import {
	type ArcadeResult,
	chip,
	hud,
	isKey,
	isTap,
	playBoard,
} from "./arcadeKit";
import {
	pickSong,
	SONG_LOADING,
	type SongClock,
	saveSongBest,
	startSong,
} from "./songPlay";

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

/** 穴の まんなか（顔の 足もと）。 */
const holeXY = (i: number): [number, number] => [
	MX + (i % 3) * MW + MW / 2,
	MY + Math.floor(i / 3) * MH + MH - 10,
];

const MOLE_INK: Record<string, string> = {
	rom: "#c8c8d0",
	icchi: "#e0c060",
	kote: "#f0a0c0",
	ara: "#a03030",
};

export const playMole = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let cur = 4;
	const j = juice();
	return playBoard(ctx, "mole", {
		start: mlStart,
		step: (s, f) => {
			juiceStep(j, f.dt);
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
					if (!mlFever(s)) f.say("");
				} else if (e === "kote") {
					f.se("critical");
					f.say(ARCADE_BOARD.moleKote);
				} else if (e === "armor") {
					f.se("hit_fist");
					f.say(ARCADE_BOARD.moleArmor);
					quake(j, 1);
				} else if (e === "ouch") {
					f.se("cancel");
					f.say(ARCADE_BOARD.moleOuch);
					quake(j, 3);
				} else if (e === "whiff") f.se("swing_fist");
				else if (e === "fever") {
					f.se("levelup");
					f.say(ARCADE_BOARD.moleFever);
					j.flash = 0.2;
				}
			}
			for (const p of s.gains) {
				const [x, y] = holeXY(p.hole);
				const good = p.pts > 0;
				pop(
					j,
					x,
					y - 22,
					good ? `+${p.pts}` : `${p.pts}`,
					good ? "#ffe060" : "#ff6060",
				);
				if (good)
					burst(j, x, y - 10, p.pts >= ML.kote ? "#ffe060" : "#f0f0f0", 6);
			}
		},
		draw: (g, s, clock) => {
			shaken(g, j, () => {
				const fever = mlFever(s);
				g.fillStyle =
					fever && Math.floor(clock * 4) % 2 ? "#4a2a1a" : "#3a2a1a";
				g.fillRect(0, 0, AW, AH);
				s.holes.forEach((h, i) => {
					const [x, y] = holeXY(i);
					// 穴
					g.fillStyle = "#140c06";
					g.fillRect(x - 14, y - 2, 28, 8);
					if (h.kind) {
						const ara = h.kind === "ara";
						// 引っこむ 前は 沈む
						const sink = Math.max(0, 0.2 - h.left) * 30;
						chip(
							g,
							x,
							y - 10 + sink,
							28,
							18,
							MOLE_INK[h.kind] ?? "#c8c8d0",
							ML_KIND[h.kind].glyph,
							ara ? "#ffffff" : "#202020",
							ara ? 7 : 8,
						);
						// 荒らしの 残り（2回 たたく）
						if (ara && h.hp > 1) {
							g.fillStyle = "#ffffff";
							g.fillRect(x + 10, y - 18 + sink, 2, 2);
						}
					} else if (h.bonkKind) {
						chip(g, x, y - 4, 22, 8, "#806060", "");
						txt(
							g,
							h.bonkKind === "icchi" ? "！？" : ARCADE_BOARD.moleBonk,
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
				juiceDraw(g, j, AW, AH);
			});
			const m = mlMult(s);
			hud(
				g,
				`${ARCADE_BOARD.score} ${s.score}${m > 1 ? ` ×${m}` : ""}`,
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
	const j = juice();
	let flash = "";
	let flashT = 0;
	let flashInk = "#ffffff";
	const show = (s: string, ink = "#ffffff") => {
		flash = s;
		flashT = 0.6;
		flashInk = ink;
	};
	return playBoard<FtState>(ctx, "fighter", {
		start: ftStart,
		step: (s, f) => {
			juiceStep(j, f.dt);
			const press = f.evs.some((e) => isKey(e, "a") || isTap(e));
			flashT = Math.max(0, flashT - f.dt);
			const before = s.score;
			for (const e of ftStep(s, f.dt, press, rnd)) {
				if (e === "wind") f.se("cursor");
				else if (e === "counter") {
					f.se("hit_fist");
					show(ARCADE_BOARD.fighterCounter);
					burst(j, 150, 92, "#ffffff", 8);
					quake(j, 2);
				} else if (e === "perfect") {
					f.se("critical");
					show(ARCADE_BOARD.fighterPerfect, "#ffe060");
					burst(j, 150, 92, "#ffe060", 18, 90);
					quake(j, 4);
					j.flash = 0.15;
				} else if (e === "early") {
					f.se("damage");
					show(ARCADE_BOARD.fighterEarly);
					quake(j, 3);
				} else if (e === "hit") {
					f.se("damage");
					show(ARCADE_BOARD.fighterHit, "#ff8080");
					quake(j, 4);
					burst(j, 90, 92, "#ff6060", 8);
				} else if (e === "ko") {
					f.se("explosion");
					show(ARCADE_BOARD.fighterKo, "#ffe060");
					quake(j, 6);
					j.flash = 0.3;
				} else if (e === "next")
					f.say(
						fill(ARCADE_BOARD.fighterNext, {
							name: FT_FOES[s.foe]?.name ?? "",
						}),
					);
			}
			if (s.score > before && s.phase === "counter") {
				pop(j, 160, 70, `+${s.score - before}`);
				if (s.streak >= 3)
					f.say(fill(ARCADE_BOARD.fighterStreak, { n: s.streak }));
			}
		},
		draw: (g, s, clock) => {
			const foe = FT_FOES[s.foe];
			shaken(g, j, () => {
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
				// 構えの あいだ 相手は 少し 後ろへ（ためる）
				const lean =
					s.phase === "wind" || s.phase === "feint" ? Math.min(4, s.t * 12) : 0;
				// 返された 相手は のけぞる
				const back = s.phase === "counter" ? Math.max(0, 6 - s.t * 20) : 0;
				fighter(g, 80, 118, "#4060c0", false, kiriPunch);
				if (!ko)
					fighter(
						g,
						Math.round(160 + lean + back),
						118,
						foe?.ink ?? "#a03030",
						true,
						foePunch,
					);
				else {
					g.fillStyle = foe?.ink ?? "#a03030";
					g.fillRect(150, 112, 26, 6);
				}
				if (s.phase === "wind" || s.phase === "feint") {
					// 「！」は 点滅（返せる はばは 色で 教えない：構えの 長さを 体で おぼえる）
					const blink = Math.floor(clock * 20) % 2 === 0;
					txt(
						g,
						s.chained ? "！！" : "！",
						160,
						66,
						16,
						blink ? "#ffe060" : "#fff0a0",
						"center",
					);
				}
				if (flashT > 0) txt(g, flash, AW / 2, 46, 12, flashInk, "center");
				juiceDraw(g, j, AW, AH);
			});
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

export const playSlot = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	const j = juice();
	let winT = 0;
	return playBoard(ctx, "slot", {
		start: slStart,
		quitScores: true,
		step: (s, f) => {
			juiceStep(j, f.dt);
			winT = Math.max(0, winT - f.dt);
			const press = f.evs.some((e) => isKey(e, "a") || isTap(e));
			for (const e of slStep(s, f.dt, press)) {
				if (e === "bet") {
					f.se("arcCoin");
					f.say(
						s.bonus ? fill(ARCADE_BOARD.slotBigLeft, { n: s.big + 1 }) : "",
					);
				} else if (e === "stop") f.se("decide");
				else if (e === "reach") {
					f.se("spell");
					f.say(ARCADE_BOARD.slotReach);
				} else if (e === "win") {
					f.se(s.lastWin >= 50 ? "victory" : "levelup");
					f.say(fill(ARCADE_BOARD.slotWin, { n: s.lastWin }));
					winT = 0.9;
					burst(j, AW / 2, 74, "#ffe060", Math.min(30, 6 + s.lastWin / 3), 90);
					pop(j, AW / 2, 56, `+${s.lastWin}`);
				} else if (e === "big") {
					f.say(ARCADE_BOARD.slotBig);
					quake(j, 4);
					j.flash = 0.3;
				} else if (e === "bust") f.say(ARCADE_BOARD.slotBust);
			}
		},
		draw: (g, s, clock) => {
			shaken(g, j, () => {
				g.fillStyle = s.big > 0 || s.bonus ? "#401838" : "#301018";
				g.fillRect(0, 0, AW, AH);
				// 枠の 電飾（当たりと BIG で 速く 回る）
				const fast = winT > 0 || s.bonus;
				for (let i = 0; i < 16; i++) {
					const on = (i + Math.floor(clock * (fast ? 16 : 3))) % 4 === 0;
					g.fillStyle = on ? "#ffe060" : "#603040";
					g.fillRect(46 + i * 9.5, 26, 3, 3);
					g.fillRect(46 + i * 9.5, 119, 3, 3);
				}
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
					// リーチの 3つめは 光る
					if (i === 2 && s.reach && !s.stopped[2]) {
						g.strokeStyle = Math.floor(clock * 10) % 2 ? "#ff4040" : "#ffe060";
						g.lineWidth = 2;
						g.strokeRect(x - 1, 31, 42, 86);
					}
				}
				// まんなかの 列
				g.strokeStyle =
					winT > 0 && Math.floor(clock * 10) % 2 ? "#ffffff" : "#ffe060";
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
				juiceDraw(g, j, AW, AH);
			});
			hud(
				g,
				`${ARCADE_BOARD.medals} ${s.medals}${s.big > 0 || s.bonus ? "　BIG" : ""}`,
				`${ARCADE_BOARD.hi} ${s.best}`,
			);
		},
		over: (s) => s.over,
		score: (s) => s.best,
		end: (s) => (s.medals >= SL.cap ? ARCADE.clear : ARCADE.over),
	});
};

// ───────────────── 音ゲー ─────────────────

const LX = 64;
const LW = 28;
const LANE_KEYS = ["left", "down", "up", "right"] as const;
const LANE_INK = ["#e05080", "#40a0e0", "#60c060", "#e0a030"];

/**
 * 音ゲー：町で 聞いた 曲を えらび、その 曲の 旋律から 作った 譜面で 遊ぶ（ui/arcade/songPlay.ts）。
 * 時計は 鳴っている 曲の 位置。曲が 作れない ときは 決まった 1曲（rhChart）で 音なし。
 */
export const playRhythm = async (ctx: UiCtx): Promise<ArcadeResult | null> => {
	const song = await pickSong(ctx, "rhythm", BEAT_OPTS);
	if (!song) return null;
	let judge = "";
	let judgeT = 0;
	const lit = [0, 0, 0, 0];
	let clock: SongClock | null = null;
	let loading = false;
	const r = await playBoard(ctx, "rhythm", {
		start: () => rhStart(song.chart),
		note: song.label,
		step: (s, f) => {
			// はじめの こまで 曲を 鳴らす（READY の あと）
			clock ??= startSong(ctx, song);
			const now = clock.now(f.clock);
			const wait = clock.waiting() && f.clock > 0.4;
			if (wait !== loading) f.say(wait ? SONG_LOADING : song.label);
			loading = wait;
			const hits: { lane: number; at: number }[] = [];
			for (const e of f.evs) {
				const k = LANE_KEYS.findIndex((d) => isKey(e, d));
				const at = clock.at(e.at, f.clock);
				if (k >= 0) hits.push({ lane: k, at });
				else if (isTap(e)) {
					const l = Math.floor((e.tap[0] - LX) / LW);
					if (l >= 0 && l < RH.lanes) hits.push({ lane: l, at });
				}
			}
			for (const h of hits) lit[h.lane] = 0.12;
			for (let i = 0; i < lit.length; i++)
				lit[i] = Math.max(0, (lit[i] ?? 0) - f.dt);
			judgeT = Math.max(0, judgeT - f.dt);
			// 曲の 時計どおりに 進める（こまが 遅れても 札の 時刻は ずれない）
			for (const e of rhStep(s, Math.max(0, now - s.t), hits)) {
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
	}).finally(() => clock?.stop());
	if (r) saveSongBest("rhythm", song.bgm, r.score);
	return r;
};
