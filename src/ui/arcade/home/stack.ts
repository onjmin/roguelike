// スレ積み の 板（決まりは data/arcade/home/stack.ts）。
// ←→ で 動く、A で 回す、↑ で 一気に 置く、↓ で はやく 降る。
// タップは 左 1/3 で 左・右 1/3 で 右・まんなかの 上で 回す・まんなかの 下で 一気に 置く。
// 置く 先は 影で 見せる。消えた 列は 白く 光る。

import {
	ST,
	ST_TEXT,
	stCells,
	stGhost,
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
		note: ST_TEXT.note,
		start: () => stStart(rnd),
		step: (s, f) => {
			let dx = 0;
			let rotate = false;
			let drop = false;
			const [, oy] = stOrigin();
			const midY = oy + (ST.rows * ST.cell) / 2;
			for (const e of f.evs) {
				if (isKey(e, "left", true)) dx--;
				else if (isKey(e, "right", true)) dx++;
				else if (isKey(e, "a")) rotate = true;
				else if (isKey(e, "up")) drop = true;
				else if (isKey(e, "down", true)) soft = 0.12;
				else if (isTap(e)) {
					if (e.tap[0] < AW / 3) dx--;
					else if (e.tap[0] > (AW * 2) / 3) dx++;
					else if (e.tap[1] < midY) rotate = true;
					else drop = true;
				}
			}
			soft = Math.max(0, soft - f.dt);
			// 1こまで いくつも 押されたら 1マスずつ（一気に 置くのは 動かした あと）
			const steps = Math.max(1, Math.abs(dx));
			for (let i = 0; i < steps; i++) {
				const last = i === steps - 1;
				const evs = stStep(
					s,
					i === 0 ? f.dt : 0,
					{
						dx: Math.sign(dx),
						rotate: rotate && i === 0,
						soft: soft > 0,
						drop: drop && last,
					},
					rnd,
				);
				for (const e of evs) {
					if (e === "move" || e === "rotate") f.se("cursor");
					else if (e === "drop") f.se("put");
					else if (e === "lock") f.se("arcBlock");
					else if (e === "clear") f.se("arcCoin");
					else if (e === "four") f.se("explosion");
					else if (e === "level") f.se("rustproof");
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
			// スレの 枠（4列や 段上げの ときは 光る）
			const big = s.flashT > 0 && s.cleared.length >= 4;
			g.fillStyle =
				big && Math.floor(s.flashT * 30) % 2 ? "#fff0a0" : "#c8c0a8";
			g.fillRect(ox - 3, oy - 1, W + 6, H + 4);
			g.fillStyle = "#0a0a12";
			g.fillRect(ox, oy, W, H);
			g.fillStyle = "#181826";
			for (let x = 1; x < ST.cols; x++) g.fillRect(ox + x * c, oy, 1, H);
			for (let y = 0; y < ST.rows; y++)
				for (let x = 0; x < ST.cols; x++)
					if (s.grid[y][x]) block(g, ox + x * c, oy + y * c, s.grid[y][x], c);
			// 消えた 列の 光（消えた 段の 位置に 白い 帯）
			if (s.flashT > 0) {
				g.fillStyle = `rgba(255,255,255,${(s.flashT / 0.3) * 0.8})`;
				for (const y of s.cleared) g.fillRect(ox, oy + y * c, W, c);
			}
			if (!s.over) {
				// 影（置く 先）
				const gh = stGhost(s);
				g.fillStyle = "#3a3a52";
				for (const [x, y] of stPieceCells(gh))
					if (y >= 0) {
						g.fillRect(ox + x * c, oy + y * c, c - 1, 1);
						g.fillRect(ox + x * c, oy + y * c + c - 2, c - 1, 1);
						g.fillRect(ox + x * c, oy + y * c, 1, c - 1);
						g.fillRect(ox + x * c + c - 2, oy + y * c, 1, c - 1);
					}
				for (const [x, y] of stPieceCells(s.cur))
					if (y >= 0) block(g, ox + x * c, oy + y * c, s.cur.k + 1, c);
			}
			// 右：次の レス
			const nx = ox + W + 16;
			const ny = ATOP + 14;
			txt(g, ST_TEXT.next, nx, ny, 8, "#e8e8f0");
			g.fillStyle = "#0a0a12";
			g.fillRect(nx - 2, ny + 11, 4 * c + 4, 4 * c + 4);
			for (const [x, y] of stCells(s.next, 0))
				block(g, nx + x * c, ny + 13 + y * c, s.next + 1, c);
			// 左：列と 段と 次の 段までの 列
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
			// 段の 進み（10列で 1段）
			const prog = (s.lines % ST.linesPerLevel) / ST.linesPerLevel;
			g.fillStyle = "#2a2a3a";
			g.fillRect(lx - 30, ATOP + 40, 30, 3);
			g.fillStyle = "#60c0f0";
			g.fillRect(lx - 30, ATOP + 40, Math.round(30 * prog), 3);
			// 連続・4列 などの 字（消えた あと しばらく）
			if (s.flashText && s.textT > 0)
				txt(g, s.flashText, lx, ATOP + 56, 8, "#ffe060", "right");
			else if (s.combo > 0)
				txt(
					g,
					ST_TEXT.combo.replace("{n}", String(s.combo + 1)),
					lx,
					ATOP + 56,
					8,
					"#c0c0d0",
					"right",
				);
			hud(g, `${ARCADE_BOARD.score} ${stScore(s)}`, "");
		},
		over: (s) => s.over,
		score: stScore,
	});
};
