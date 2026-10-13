// スレ積み の 板（決まりは data/arcade/home/stack.ts）。
// ←→ で 動く、↑・A で 回す、↓ で はやく 降る。
// タップは 左 1/3 で 左・右 1/3 で 右・まんなかの 上で 回す・まんなかの 下で はやく 降る。

import {
	ST,
	ST_TEXT,
	stCells,
	stLevel,
	stOrigin,
	stPieceCells,
	stScore,
	stStart,
	stStep,
} from "../../../data/arcade/home/stack";
import { AH, ATOP, AW } from "../../../data/arcade/logic";
import { ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import type { G } from "../../neta/netaBoard";
import { txt } from "../../neta/netaBoard";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

/** レスの 色（1〜7）。[面, 光, 影]。 */
const TONES: readonly (readonly [string, string, string])[] = [
	["#000000", "#000000", "#000000"],
	["#40c8e0", "#a0f0ff", "#2080a0"],
	["#e0c040", "#fff0a0", "#a08020"],
	["#b060d0", "#e0a0f0", "#703090"],
	["#50c050", "#a0f0a0", "#308030"],
	["#e05050", "#ffa0a0", "#a03030"],
	["#4070e0", "#a0c0ff", "#2040a0"],
	["#e08830", "#ffc890", "#a05818"],
];

const block = (g: G, x: number, y: number, k: number, c: number): void => {
	const [f, hi, lo] = TONES[k];
	g.fillStyle = lo;
	g.fillRect(x, y, c, c);
	g.fillStyle = f;
	g.fillRect(x, y, c - 1, c - 1);
	g.fillStyle = hi;
	g.fillRect(x, y, c - 1, 1);
	g.fillRect(x, y, 1, c - 1);
};

export const playStack = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let soft = 0;
	return playBoard(ctx, "stack", {
		start: () => stStart(rnd),
		step: (s, f) => {
			let dx = 0;
			let rotate = false;
			const [, oy] = stOrigin();
			const midY = oy + (ST.rows * ST.cell) / 2;
			for (const e of f.evs) {
				if (isKey(e, "left", true)) dx--;
				else if (isKey(e, "right", true)) dx++;
				else if (isKey(e, "up") || isKey(e, "a")) rotate = true;
				else if (isKey(e, "down", true)) soft = 0.12;
				else if (isTap(e)) {
					if (e.tap[0] < AW / 3) dx--;
					else if (e.tap[0] > (AW * 2) / 3) dx++;
					else if (e.tap[1] < midY) rotate = true;
					else soft = 0.4;
				}
			}
			soft = Math.max(0, soft - f.dt);
			// 1こまで いくつも 押されたら 1マスずつ
			const steps = Math.max(1, Math.abs(dx));
			for (let i = 0; i < steps; i++) {
				const evs = stStep(
					s,
					i === 0 ? f.dt : 0,
					{
						dx: Math.sign(dx),
						rotate: rotate && i === 0,
						soft: soft > 0,
					},
					rnd,
				);
				for (const e of evs) {
					if (e === "move" || e === "rotate") f.se("cursor");
					else if (e === "lock") f.se("arcBlock");
					else if (e === "clear") f.se("arcCoin");
					else if (e === "four") f.se("explosion");
				}
			}
		},
		draw: (g, s) => {
			const [ox, oy] = stOrigin();
			const c = ST.cell;
			const W = ST.cols * c;
			const H = ST.rows * c;
			g.fillStyle = "#14141e";
			g.fillRect(0, 0, AW, AH);
			// スレの 枠
			g.fillStyle = "#c8c0a8";
			g.fillRect(ox - 3, oy - 1, W + 6, H + 4);
			g.fillStyle = "#0a0a12";
			g.fillRect(ox, oy, W, H);
			g.fillStyle = "#181826";
			for (let x = 1; x < ST.cols; x++) g.fillRect(ox + x * c, oy, 1, H);
			for (let y = 0; y < ST.rows; y++)
				for (let x = 0; x < ST.cols; x++)
					if (s.grid[y][x]) block(g, ox + x * c, oy + y * c, s.grid[y][x], c);
			if (!s.over)
				for (const [x, y] of stPieceCells(s.cur))
					if (y >= 0) block(g, ox + x * c, oy + y * c, s.cur.k + 1, c);
			// 右：次の レス
			const nx = ox + W + 16;
			const ny = ATOP + 14;
			txt(g, ST_TEXT.next, nx, ny, 8, "#e8e8f0");
			g.fillStyle = "#0a0a12";
			g.fillRect(nx - 2, ny + 11, 4 * c + 4, 4 * c + 4);
			for (const [x, y] of stCells(s.next, 0))
				block(g, nx + x * c, ny + 13 + y * c, s.next + 1, c);
			// 左：列と 段
			const lx = ox - 16;
			txt(
				g,
				`${ST_TEXT.lines} ${s.lines}`,
				lx,
				ATOP + 14,
				8,
				"#e8e8f0",
				"right",
			);
			txt(
				g,
				`${ST_TEXT.level} ${stLevel(s) + 1}`,
				lx,
				ATOP + 28,
				8,
				"#e8e8f0",
				"right",
			);
			hud(g, `${ARCADE_BOARD.score} ${stScore(s)}`, "");
		},
		over: (s) => s.over,
		score: stScore,
	});
};
