// キリコの 家の ゲーム「過去ログ倉庫番」の 板（決まりは data/arcade/home/soko.ts、文は data/arcade/text.ts）。
// - 過去ログ 倉庫。十字キーで 1歩（箱が あれば 押す）。A で 1手 もどす（押しっぱなしで 続けて もどす）。
// - タップは キリコから 見た 向き（縦と 横の 大きい ほう）へ 1歩。右の「もどす」「やりなおし」を タップでも。
// - 段ボールに「dat」、印は 棚の 前の 赤い 札。しまうと 手数と 最短を 出して 次の 面へ。
// 見た目の 乱数は Math.random（冒険の 乱数に さわらない）。

import {
	SK_LEVELS,
	SK_TEXT,
	type SkDir,
	type SkEvent,
	skLevel,
	skLevelScore,
	skMove,
	skReset,
	skScore,
	skStart,
	skTick,
	skUndo,
} from "../../../data/arcade/home/soko";
import { AH, ATOP, AW } from "../../../data/arcade/logic";
import { ARCADE, ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import { type G, txt } from "../../neta/netaBoard";
import {
	burst,
	juice,
	juiceDraw,
	juiceStep,
	pop,
	quake,
	shaken,
} from "../arcadeJuice";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";

/** 倉庫の 幅（右は 手数と ボタンの 欄）。 */
const MAP_W = 178;
const UNDO_BTN = { x: 184, y: 78, w: 52, h: 20 } as const;
const RESET_BTN = { x: 184, y: 106, w: 52, h: 20 } as const;

type Rect = { x: number; y: number; w: number; h: number };
const inside = (t: readonly [number, number], b: Rect): boolean =>
	t[0] >= b.x - 2 &&
	t[0] < b.x + b.w + 2 &&
	t[1] >= b.y - 2 &&
	t[1] < b.y + b.h + 2;

/** 上から 見た 小さな キリコ（ui/arcade/home/crossing.ts と 同じ 色）。 */
const kiriko = (g: G, x: number, y: number, c: number): void => {
	const o = Math.floor((c - 10) / 2);
	x += o;
	y += o;
	const k = 10;
	g.fillStyle = "#72241f";
	g.fillRect(x + 2, y + 1, k - 4, 3);
	g.fillStyle = "#28a131";
	g.fillRect(x + 3, y + 1, k - 6, 1);
	g.fillStyle = "#f0c8a8";
	g.fillRect(x + 3, y + 3, k - 6, 2);
	g.fillStyle = "#28a131";
	g.fillRect(x + 2, y + 5, k - 4, 2);
	g.fillStyle = "#926855";
	g.fillRect(x + 2, y + 7, k - 4, 1);
	g.fillStyle = "#353333";
	g.fillRect(x + 3, y + 8, 1, 2);
	g.fillRect(x + k - 4, y + 8, 1, 2);
};

/** 「dat」の 段ボール（印の 上なら 明るく）。 */
const box = (g: G, x: number, y: number, c: number, onGoal: boolean): void => {
	g.fillStyle = onGoal ? "#e0b060" : "#b88848";
	g.fillRect(x + 1, y + 1, c - 2, c - 2);
	g.fillStyle = onGoal ? "#a07028" : "#806030";
	g.fillRect(x + 1, y + c - 2, c - 2, 1);
	g.fillRect(x + c - 2, y + 1, 1, c - 2);
	// ガムテープ
	g.fillStyle = "#d8c8a0";
	g.fillRect(x + Math.floor(c / 2) - 1, y + 1, 2, 3);
	txt(
		g,
		SK_TEXT.box,
		x + c / 2,
		y + Math.floor(c / 2) - 2,
		6,
		"#3a2410",
		"center",
	);
	if (onGoal) {
		g.fillStyle = "#30a040";
		g.fillRect(x + 2, y + 2, 2, 2);
	}
};

const button = (g: G, b: Rect, label: string, hot: boolean): void => {
	g.fillStyle = hot ? "#e8d8b0" : "#c8b890";
	g.fillRect(b.x, b.y, b.w, b.h);
	g.fillStyle = "#5a4630";
	g.fillRect(b.x, b.y + b.h - 2, b.w, 2);
	g.fillRect(b.x + b.w - 1, b.y, 1, b.h);
	txt(g, label, b.x + b.w / 2, b.y + 6, 8, "#2a1c10", "center");
};

const DIRS: Record<SkDir, readonly [number, number]> = {
	up: [0, -1],
	right: [1, 0],
	down: [0, 1],
	left: [-1, 0],
};

export const playSoko = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	const j = juice();
	/** ボタンを 押した 光（秒）。 */
	let hotUndo = 0;
	let hotReset = 0;
	const lay = (w: number, h: number) => {
		const c = Math.min(
			14,
			Math.floor((MAP_W - 6) / w),
			Math.floor((AH - ATOP - 6) / h),
		);
		return {
			c,
			ox: Math.floor((MAP_W - w * c) / 2),
			oy: ATOP + Math.floor((AH - ATOP - h * c) / 2),
		};
	};
	return playBoard(ctx, "soko", {
		start: () => skStart(),
		note: SK_TEXT.note,
		quitScores: true,
		step: (s, f) => {
			const evs: SkEvent[] = [...skTick(s, f.dt)];
			const { c, ox, oy } = lay(s.map.w, s.map.h);
			const undo = () => {
				evs.push(...skUndo(s));
				hotUndo = 0.15;
			};
			for (const e of f.evs) {
				if (s.over) break;
				let dir: SkDir | null = null;
				if (isKey(e, "up", true)) dir = "up";
				else if (isKey(e, "down", true)) dir = "down";
				else if (isKey(e, "left", true)) dir = "left";
				else if (isKey(e, "right", true)) dir = "right";
				else if (isKey(e, "a", true)) undo();
				else if (isTap(e)) {
					if (inside(e.tap, UNDO_BTN)) {
						undo();
						continue;
					}
					if (inside(e.tap, RESET_BTN)) {
						evs.push(...skReset(s));
						hotReset = 0.15;
						continue;
					}
					// キリコから 見た 向き
					const px = ox + (s.p % s.map.w) * c + c / 2;
					const py = oy + Math.floor(s.p / s.map.w) * c + c / 2;
					const dx = e.tap[0] - px;
					const dy = e.tap[1] - py;
					if (Math.max(Math.abs(dx), Math.abs(dy)) < c / 2) continue;
					dir =
						Math.abs(dx) > Math.abs(dy)
							? dx > 0
								? "right"
								: "left"
							: dy > 0
								? "down"
								: "up";
				}
				if (dir) evs.push(...skMove(s, dir));
			}
			for (const e of evs) {
				if (e === "walk") f.se("cursor");
				else if (e === "push") f.se("trolley");
				else if (e === "goal") {
					f.se("put");
					const [dx, dy] = DIRS[s.face];
					const b = s.p + dy * s.map.w + dx;
					burst(
						j,
						ox + (b % s.map.w) * c + c / 2,
						oy + Math.floor(b / s.map.w) * c + c / 2,
						"#ffe080",
						6,
						40,
					);
				} else if (e === "bump") {
					f.se("cancel");
					quake(j, 1);
				} else if (e === "undo") f.se("cardFlip");
				else if (e === "reset") f.se("read");
				else if (e === "clear") {
					f.se("victory");
					const d = s.done[s.done.length - 1];
					const par = skLevel(s).par;
					f.say(
						d.moves <= par
							? SK_TEXT.best
							: SK_TEXT.clear.replace("{n}", String(d.moves)),
					);
					pop(j, MAP_W / 2, AH / 2 - 10, `+${skLevelScore(par, d.moves)}`);
					burst(j, MAP_W / 2, AH / 2, "#ffe060", 20, 90);
					j.flash = 0.2;
				} else if (e === "next") f.say(SK_TEXT.note);
			}
			hotUndo = Math.max(0, hotUndo - f.dt);
			hotReset = Math.max(0, hotReset - f.dt);
			juiceStep(j, f.dt);
		},
		draw: (g, s) => {
			const m = s.map;
			const { c, ox, oy } = lay(m.w, m.h);
			g.fillStyle = "#1c1814";
			g.fillRect(0, 0, AW, AH);
			shaken(g, j, () => {
				for (let y = 0; y < m.h; y++)
					for (let x = 0; x < m.w; x++) {
						const i = y * m.w + x;
						const X = ox + x * c;
						const Y = oy + y * c;
						if (m.wall[i]) {
							// まわりに 床の ある 壁だけ 棚に（外は 暗い まま）
							const near = [
								[0, -1],
								[1, 0],
								[0, 1],
								[-1, 0],
								[1, 1],
								[-1, -1],
								[1, -1],
								[-1, 1],
							].some(([dx, dy]) => {
								const nx = x + dx;
								const ny = y + dy;
								return (
									nx >= 0 &&
									ny >= 0 &&
									nx < m.w &&
									ny < m.h &&
									!m.wall[ny * m.w + nx]
								);
							});
							if (!near) continue;
							g.fillStyle = "#4a3624";
							g.fillRect(X, Y, c, c);
							g.fillStyle = "#6a5034";
							g.fillRect(X, Y + Math.floor(c / 3), c, 1);
							g.fillRect(X, Y + Math.floor((c * 2) / 3), c, 1);
							g.fillStyle = "#2e2216";
							g.fillRect(X, Y + c - 1, c, 1);
							continue;
						}
						// 床（板の 目）
						g.fillStyle = (x + y) % 2 ? "#9c8462" : "#a68c68";
						g.fillRect(X, Y, c, c);
						if (m.goal[i]) {
							// 棚の 印（赤い 札）
							g.fillStyle = "#d04030";
							g.fillRect(X + 3, Y + 3, c - 6, c - 6);
							g.fillStyle = "#f0e0d0";
							g.fillRect(X + 5, Y + Math.floor(c / 2) - 1, c - 10, 2);
						}
					}
				for (const b of s.boxes)
					box(
						g,
						ox + (b % m.w) * c,
						oy + Math.floor(b / m.w) * c,
						c,
						m.goal[b],
					);
				kiriko(g, ox + (s.p % m.w) * c, oy + Math.floor(s.p / m.w) * c, c);
				// 右の 欄
				const lv = skLevel(s);
				g.fillStyle = "#2c241c";
				g.fillRect(MAP_W + 2, ATOP + 2, AW - MAP_W - 4, AH - ATOP - 4);
				txt(
					g,
					SK_TEXT.level.replace("{n}", String(s.li + 1)),
					210,
					ATOP + 6,
					9,
					"#f0c040",
					"center",
				);
				txt(g, `/${SK_LEVELS.length}`, 210, ATOP + 18, 7, "#a09080", "center");
				txt(
					g,
					SK_TEXT.moves.replace("{n}", String(s.moves)),
					210,
					ATOP + 34,
					8,
					"#f4f0e8",
					"center",
				);
				txt(
					g,
					SK_TEXT.par.replace("{n}", String(lv.par)),
					210,
					ATOP + 46,
					8,
					s.moves > lv.par * 2 ? "#a09080" : "#a0d8a0",
					"center",
				);
				button(g, UNDO_BTN, SK_TEXT.undo, hotUndo > 0);
				button(g, RESET_BTN, SK_TEXT.reset, hotReset > 0);
				if (s.wait > 0) {
					const d = s.done[s.done.length - 1];
					g.fillStyle = "rgba(0,0,0,0.6)";
					g.fillRect(0, AH / 2 - 12, MAP_W, 24);
					txt(
						g,
						d.moves <= lv.par
							? SK_TEXT.best
							: SK_TEXT.clear.replace("{n}", String(d.moves)),
						MAP_W / 2,
						AH / 2 - 6,
						10,
						"#ffe060",
						"center",
					);
				}
			});
			juiceDraw(g, j, AW, AH);
			hud(
				g,
				`${ARCADE_BOARD.score} ${skScore(s)}`,
				`${s.done.length}/${SK_LEVELS.length}`,
			);
		},
		over: (s) => s.over,
		score: skScore,
		end: () => ARCADE.clear,
	});
};
