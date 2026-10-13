// キリコの 家の ゲーム「おんJピクロス」の 板（決まりは data/arcade/home/picross.ts、文は data/arcade/text.ts）。
// - 方眼ノート。十字キーで カーソル、A で 塗る（× の ときは × を つける）。もう 1回で 消す。
// - キーボードで A を 押した まま 動かすと、同じ はたらきで 1列 つづけて 塗れる（くり返しも）。
// - カーソルを 右はしの 先へ 出すと 右の ボタン（上半分＝塗る／×、下半分＝判定 あり／なし）。A で 切りかえ。
// - タップは マスに いまの はたらき、右の ボタンを タップで 切りかえ。
// - とけると 絵が 色つきで 出て、名前を 出す。
// 見た目の 乱数は Math.random（冒険の 乱数に さわらない）。

import {
	PX_PUZZLES,
	PX_TEXT,
	type PxEvent,
	type PxMode,
	type PxPuzzle,
	pxApply,
	pxClues,
	pxH,
	pxPuzzle,
	pxScore,
	pxStart,
	pxTick,
	pxTimeLeft,
	pxW,
} from "../../../data/arcade/home/picross";
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

/** ノートの 幅（右は ボタンの 欄）。 */
const NOTE_W = 182;
const MODE_BTN = { x: 186, y: 66, w: 50, h: 22 } as const;
const JUDGE_BTN = { x: 186, y: 98, w: 50, h: 22 } as const;

const PAPER = "#f4f0e0";
const RULE = "#a8c0e0";
const INK = "#283040";

type Lay = {
	cell: number;
	ox: number;
	oy: number;
	leftW: number;
	topH: number;
};
type Clues = { rows: number[][]; cols: number[][] };

/** 問題の 置き方（数字の 欄と マスの 大きさ）。 */
const layout = (p: PxPuzzle, c: Clues): Lay => {
	const w = pxW(p);
	const h = pxH(p);
	const topH = Math.max(...c.cols.map((r) => r.length)) * 7 + 2;
	const leftW = Math.max(...c.rows.map((r) => r.length)) * 6 + 3;
	const cell = Math.min(
		18,
		Math.floor((AH - ATOP - 4 - topH) / h),
		Math.floor((NOTE_W - 6 - leftW) / w),
	);
	const ox = Math.floor((NOTE_W - (leftW + w * cell)) / 2) + leftW;
	const oy = Math.floor((AH - ATOP - (topH + h * cell)) / 2) + ATOP + topH;
	return { cell, ox, oy, leftW, topH };
};

/** 塗った マスの 続き（数字と くらべる）。 */
const runsOf = (cells: readonly number[]): string => {
	const r: number[] = [];
	let n = 0;
	for (const c of cells) {
		if (c === 1) n++;
		else if (n) {
			r.push(n);
			n = 0;
		}
	}
	if (n) r.push(n);
	return (r.length ? r : [0]).join(",");
};

const inside = (
	t: readonly [number, number],
	b: { x: number; y: number; w: number; h: number },
): boolean =>
	t[0] >= b.x - 2 &&
	t[0] < b.x + b.w + 2 &&
	t[1] >= b.y - 2 &&
	t[1] < b.y + b.h + 2;

const cross = (g: G, x: number, y: number, c: number, ink: string): void => {
	g.strokeStyle = ink;
	g.lineWidth = 1;
	g.beginPath();
	const m = Math.max(2, Math.floor(c / 4));
	g.moveTo(x + m, y + m);
	g.lineTo(x + c - m, y + c - m);
	g.moveTo(x + c - m, y + m);
	g.lineTo(x + m, y + c - m);
	g.stroke();
};

const button = (
	g: G,
	b: { x: number; y: number; w: number; h: number },
	label: string,
	value: string,
	on: boolean,
	focus: boolean,
): void => {
	g.fillStyle = on ? "#384868" : "#d8d4c4";
	g.fillRect(b.x, b.y, b.w, b.h);
	g.fillStyle = focus ? "#e02020" : "#806c50";
	g.fillRect(b.x, b.y, b.w, 1);
	g.fillRect(b.x, b.y + b.h - 1, b.w, 1);
	g.fillRect(b.x, b.y, 1, b.h);
	g.fillRect(b.x + b.w - 1, b.y, 1, b.h);
	const ink = on ? "#f4f0e0" : INK;
	txt(g, label, b.x + b.w / 2, b.y + 2, 7, ink, "center");
	txt(g, value, b.x + b.w / 2, b.y + 11, 8, ink, "center");
};

export const playPicross = async (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let cx = 0;
	let cy = 0;
	let mode: PxMode = "paint";
	/** A を 押した まま 動かした ときに そろえる 向き（null なら そろえない）。 */
	let dragTo: boolean | null = null;
	let aHeld = false;
	let clues: Clues = pxClues(PX_PUZZLES[0]);
	let lay: Lay = layout(PX_PUZZLES[0], clues);
	let shown = 0;
	const j = juice();
	// キーボードの A（Z・Enter・Space）を 押さえて いるか（入力の 道は 押した ことしか 知らせない）
	const A_CODES = new Set(["KeyZ", "Enter", "NumpadEnter", "Space"]);
	const onDown = (e: KeyboardEvent) => {
		if (A_CODES.has(e.code)) aHeld = true;
	};
	const onUp = (e: KeyboardEvent) => {
		if (A_CODES.has(e.code)) {
			aHeld = false;
			dragTo = null;
		}
	};
	const onBlur = () => {
		aHeld = false;
		dragTo = null;
	};
	window.addEventListener("keydown", onDown);
	window.addEventListener("keyup", onUp);
	window.addEventListener("blur", onBlur);
	const center = (x: number, y: number): [number, number] => [
		lay.ox + x * lay.cell + lay.cell / 2,
		lay.oy + y * lay.cell + lay.cell / 2,
	];
	try {
		return await playBoard(ctx, "picross", {
			start: () => {
				cx = 0;
				cy = 0;
				mode = "paint";
				dragTo = null;
				shown = 0;
				clues = pxClues(PX_PUZZLES[0]);
				lay = layout(PX_PUZZLES[0], clues);
				return pxStart();
			},
			step: (s, f) => {
				const evs: PxEvent[] = [...pxTick(s, f.dt)];
				const p = pxPuzzle(s);
				const w = pxW(p);
				const h = pxH(p);
				if (shown !== s.i) {
					shown = s.i;
					clues = pxClues(p);
					lay = layout(p, clues);
					cx = Math.min(cx, w - 1);
					cy = Math.min(cy, h - 1);
					dragTo = null;
				}
				const toggleMode = () => {
					mode = mode === "paint" ? "cross" : "paint";
					f.se("decide");
				};
				const toggleJudge = () => {
					s.strict = !s.strict;
					f.se("decide");
				};
				const act = (x: number, y: number) => {
					const before = s.cells[y][x];
					const ev = pxApply(s, x, y, mode);
					evs.push(...ev);
					const mark = mode === "paint" ? 1 : 2;
					dragTo = ev.length && !ev.includes("miss") ? before !== mark : null;
				};
				const moved = () => {
					f.se("cursor");
					if (aHeld && dragTo !== null && cx < w)
						evs.push(...pxApply(s, cx, cy, mode, dragTo));
				};
				for (const e of f.evs) {
					if (s.over) break;
					if (isKey(e, "left", true)) {
						cx = Math.max(0, cx - 1);
						moved();
					} else if (isKey(e, "right", true)) {
						// 右はしの 先は ボタン
						cx = Math.min(w, cx + 1);
						moved();
					} else if (isKey(e, "up", true)) {
						cy = Math.max(0, cy - 1);
						moved();
					} else if (isKey(e, "down", true)) {
						cy = Math.min(h - 1, cy + 1);
						moved();
					} else if (isKey(e, "a")) {
						if (cx === w) {
							if (cy < h / 2) toggleMode();
							else toggleJudge();
						} else act(cx, cy);
					} else if (isTap(e)) {
						if (inside(e.tap, MODE_BTN)) {
							toggleMode();
							continue;
						}
						if (inside(e.tap, JUDGE_BTN)) {
							toggleJudge();
							continue;
						}
						const gx = Math.floor((e.tap[0] - lay.ox) / lay.cell);
						const gy = Math.floor((e.tap[1] - lay.oy) / lay.cell);
						if (gx < 0 || gy < 0 || gx >= w || gy >= h) continue;
						cx = gx;
						cy = gy;
						act(gx, gy);
						dragTo = null;
					}
				}
				for (const e of evs) {
					if (e === "paint") f.se("put");
					else if (e === "cross") f.se("cardFlip");
					else if (e === "erase" || e === "uncross") f.se("cancel");
					else if (e === "miss") {
						f.se("damage");
						quake(j, 3);
						const [x, y] = center(cx, cy);
						pop(j, x, y - 4, PX_TEXT.miss, "#ff5050");
					} else if (e === "solve") {
						f.se("levelup");
						j.flash = 0.25;
						const [x, y] = center((w - 1) / 2, (h - 1) / 2);
						burst(j, x, y, p.ink[Object.keys(p.ink)[0]], 18, 90);
						f.say(PX_TEXT.done.replace("{name}", p.name));
						dragTo = null;
					} else if (e === "timeup") f.se("miss");
				}
				juiceStep(j, f.dt);
			},
			draw: (g, s, clock) => {
				const p = pxPuzzle(s);
				const w = pxW(p);
				const h = pxH(p);
				const { cell: c, ox, oy } = lay;
				const done = s.reveal > 0;
				g.fillStyle = "#5a4630";
				g.fillRect(0, 0, AW, AH);
				shaken(g, j, () => {
					// ノート
					g.fillStyle = PAPER;
					g.fillRect(2, ATOP + 1, NOTE_W - 2, AH - ATOP - 2);
					g.fillStyle = "#d86060";
					g.fillRect(10, ATOP + 1, 1, AH - ATOP - 2);
					// 数字（カーソルの 行・列は 色を つけ、そろった 行・列は うすく）
					const showCur = !done && cx < w;
					for (let y = 0; y < h; y++) {
						const cl = clues.rows[y];
						const fit = runsOf(s.cells[y]) === cl.join(",");
						if (showCur && y === cy) {
							g.fillStyle = "#f0e0a0";
							g.fillRect(ox - lay.leftW, oy + y * c, lay.leftW - 1, c);
						}
						for (let k = 0; k < cl.length; k++)
							txt(
								g,
								String(cl[cl.length - 1 - k]),
								ox - 3 - k * 6,
								oy + y * c + Math.floor((c - 7) / 2),
								7,
								fit ? "#a8a090" : INK,
								"right",
							);
					}
					for (let x = 0; x < w; x++) {
						const cl = clues.cols[x];
						const fit = runsOf(s.cells.map((r) => r[x])) === cl.join(",");
						if (showCur && x === cx) {
							g.fillStyle = "#f0e0a0";
							g.fillRect(ox + x * c, oy - lay.topH, c, lay.topH - 1);
						}
						for (let k = 0; k < cl.length; k++)
							txt(
								g,
								String(cl[cl.length - 1 - k]),
								ox + x * c + c / 2,
								oy - 9 - k * 7,
								7,
								fit ? "#a8a090" : INK,
								"center",
							);
					}
					// マス
					for (let y = 0; y < h; y++)
						for (let x = 0; x < w; x++) {
							const X = ox + x * c;
							const Y = oy + y * c;
							const v = s.cells[y][x];
							const ch = p.rows[y][x];
							if (done) {
								g.fillStyle = ch === "." ? "#fffaf0" : p.ink[ch];
								g.fillRect(X, Y, c, c);
								continue;
							}
							g.fillStyle = v === 1 ? INK : "#fffcf4";
							g.fillRect(X, Y, c, c);
							if (v === 2) cross(g, X, Y, c, "#8890a0");
							else if (v === 3) cross(g, X, Y, c, "#e03030");
						}
					if (!done) {
						// 方眼（5マスごとに 太く）
						for (let x = 0; x <= w; x++) {
							g.fillStyle = x % 5 === 0 ? "#6080b0" : RULE;
							g.fillRect(ox + x * c, oy, 1, h * c + 1);
						}
						for (let y = 0; y <= h; y++) {
							g.fillStyle = y % 5 === 0 ? "#6080b0" : RULE;
							g.fillRect(ox, oy + y * c, w * c + 1, 1);
						}
					} else {
						// 数字を 消して、絵の 上に 名前
						g.fillStyle = PAPER;
						g.fillRect(12, ATOP + 1, NOTE_W - 12, oy - ATOP - 1);
						g.fillRect(12, oy, ox - 12, h * c);
						const ny = Math.max(ATOP + 2, oy - 15);
						g.fillStyle = "rgba(20,20,30,0.8)";
						g.fillRect(12, ny, NOTE_W - 12, 13);
						txt(g, p.name, (NOTE_W + 12) / 2, ny + 2, 9, "#ffe060", "center");
					}
					// カーソル（点滅）
					if (!s.over && !done && cx < w && Math.floor(clock * 3) % 3 !== 0) {
						const X = ox + cx * c - 1;
						const Y = oy + cy * c - 1;
						g.fillStyle = "#e02020";
						g.fillRect(X, Y, c + 3, 2);
						g.fillRect(X, Y + c + 1, c + 3, 2);
						g.fillRect(X, Y, 2, c + 3);
						g.fillRect(X + c + 1, Y, 2, c + 3);
					}
					// 右の 欄：何問め・小さな 絵・ボタン
					txt(
						g,
						`${s.i + 1}/${PX_PUZZLES.length}`,
						211,
						ATOP + 3,
						8,
						"#f4f0e0",
						"center",
					);
					const tc = 3;
					const tx = Math.round(211 - (w * tc) / 2);
					const ty = ATOP + 14 + Math.round((30 - h * tc) / 2);
					g.fillStyle = PAPER;
					g.fillRect(tx - 1, ty - 1, w * tc + 2, h * tc + 2);
					for (let y = 0; y < h; y++)
						for (let x = 0; x < w; x++) {
							const ch = p.rows[y][x];
							if (done) g.fillStyle = ch === "." ? PAPER : p.ink[ch];
							else g.fillStyle = s.cells[y][x] === 1 ? INK : PAPER;
							g.fillRect(tx + x * tc, ty + y * tc, tc, tc);
						}
					const onBtns = !done && cx === w;
					button(
						g,
						MODE_BTN,
						PX_TEXT.mode,
						mode === "paint" ? PX_TEXT.paint : PX_TEXT.cross,
						mode === "paint",
						onBtns && cy < h / 2 && Math.floor(clock * 3) % 3 !== 0,
					);
					button(
						g,
						JUDGE_BTN,
						PX_TEXT.judge,
						s.strict ? PX_TEXT.on : PX_TEXT.off,
						s.strict,
						onBtns && cy >= h / 2 && Math.floor(clock * 3) % 3 !== 0,
					);
					if (s.misses)
						txt(
							g,
							`× ${s.misses}`,
							211,
							JUDGE_BTN.y + JUDGE_BTN.h + 4,
							7,
							"#ff9090",
							"center",
						);
				});
				juiceDraw(g, j, AW, AH);
				hud(
					g,
					`${ARCADE_BOARD.score} ${pxScore(s)}　${PX_TEXT.solvedN.replace("{n}", String(s.solved.length))}`,
					`${ARCADE_BOARD.time} ${pxTimeLeft(s)}`,
				);
			},
			over: (s) => s.over,
			score: pxScore,
			end: (s) =>
				s.solved.length === PX_PUZZLES.length ? ARCADE.clear : ARCADE.over,
		});
	} finally {
		window.removeEventListener("keydown", onDown);
		window.removeEventListener("keyup", onUp);
		window.removeEventListener("blur", onBlur);
	}
};
