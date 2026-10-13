// ぷゆぷゆ の 板（決まりは data/arcade/home/puyupuyu.ts）。
// ←→ で 動く、↑・A で 回す、↓ で はやく 降る。
// タップは 左 1/3 で 左・右 1/3 で 右・まんなかの 上で 回す・まんなかの 下で はやく 降る。

import {
	PY,
	PY_TEXT,
	pyCells,
	pyOrigin,
	pyScore,
	pyStart,
	pyStep,
} from "../../../data/arcade/home/puyupuyu";
import { AH, ATOP, AW } from "../../../data/arcade/logic";
import { ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import type { G } from "../../neta/netaBoard";
import { txt } from "../../neta/netaBoard";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

/** ぷゆゆの 色（1〜4）。[面, 光, 影]。1 が もとの 黄。 */
const TONES: readonly (readonly [string, string, string])[] = [
	["#000000", "#000000", "#000000"],
	["#f0c838", "#fff0a0", "#b08818"],
	["#e85858", "#ffb0a8", "#a02c30"],
	["#4f86e8", "#b0d0ff", "#2850a8"],
	["#54c060", "#b0f0a8", "#2c8034"],
];

/** 1匹の ぷゆゆ（11px の マスの 左上 x・y）。大きな うるんだ 目（🥺）。pop は 消える とき。 */
const puyu = (g: G, x: number, y: number, k: number, pop = 0): void => {
	const [f, hi, lo] = TONES[k];
	const X = Math.round(x);
	const Y = Math.round(y);
	if (pop > 0) {
		// 消える とき：白く 光って ちぢむ
		const m = Math.round((1 - pop) * 4);
		g.fillStyle = Math.floor(pop * 10) % 2 ? "#ffffff" : f;
		g.fillRect(X + 1 + m, Y + 1 + m, 9 - m * 2, 9 - m * 2);
		return;
	}
	// まるい からだ
	g.fillStyle = lo;
	g.fillRect(X + 2, Y + 1, 7, 10);
	g.fillRect(X + 1, Y + 2, 9, 8);
	g.fillRect(X, Y + 4, 11, 5);
	g.fillStyle = f;
	g.fillRect(X + 2, Y + 1, 7, 9);
	g.fillRect(X + 1, Y + 2, 9, 7);
	g.fillRect(X, Y + 4, 11, 4);
	g.fillStyle = hi;
	g.fillRect(X + 3, Y + 2, 2, 1);
	g.fillRect(X + 2, Y + 3, 1, 1);
	// 大きな 目（白い 光が 2つ。下に 涙）
	g.fillStyle = "#2a1408";
	g.fillRect(X + 2, Y + 4, 3, 3);
	g.fillRect(X + 6, Y + 4, 3, 3);
	g.fillStyle = "#ffffff";
	g.fillRect(X + 2, Y + 4, 1, 1);
	g.fillRect(X + 6, Y + 4, 1, 1);
	g.fillRect(X + 4, Y + 6, 1, 1);
	g.fillRect(X + 8, Y + 6, 1, 1);
	g.fillStyle = "#a8e0ff";
	g.fillRect(X + 2, Y + 7, 3, 1);
	g.fillRect(X + 6, Y + 7, 3, 1);
	// への字の 口
	g.fillStyle = "#2a1408";
	g.fillRect(X + 5, Y + 8, 1, 1);
};

export const playPuyupuyu = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let soft = 0;
	return playBoard(ctx, "puyupuyu", {
		start: () => pyStart(rnd),
		step: (s, f) => {
			let dx = 0;
			let rotate = false;
			const [, oy] = pyOrigin();
			const midY = oy + (PY.rows * PY.cell) / 2;
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
				const evs = pyStep(
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
					else if (e === "lock") f.se("put");
					else if (e === "pop") f.se("bubble");
					else if (e === "chain") f.se(s.chain >= 4 ? "explosion" : "arcCoin");
				}
			}
			// 置いた あとは ↓ を はなす（次の 組が すぐ 降らない ように）
			if (!s.cur) soft = 0;
		},
		draw: (g, s, clock) => {
			const [ox, oy] = pyOrigin();
			const c = PY.cell;
			const W = PY.cols * c;
			const H = PY.rows * c;
			g.fillStyle = "#1a1426";
			g.fillRect(0, 0, AW, AH);
			// 背景の 水玉
			g.fillStyle = "#231c34";
			for (let i = 0; i < 24; i++)
				g.fillRect((i * 53) % AW, ATOP + ((i * 37) % (AH - ATOP)), 3, 3);
			// 枠
			g.fillStyle = "#c8a8e0";
			g.fillRect(ox - 3, oy - 1, W + 6, H + 3);
			g.fillStyle = "#0c0a14";
			g.fillRect(ox, oy, W, H);
			// 3列目の 上（ここが うまると おわり）
			g.fillStyle = "#3a1420";
			g.fillRect(ox + PY.spawnX * c, oy, c, c);
			txt(g, "×", ox + PY.spawnX * c + c / 2, oy + 1, 8, "#803040", "center");
			const pop = s.popping.length ? s.popT / PY.popTime : 0;
			const popSet = new Set(s.popping.map(([x, y]) => `${x},${y}`));
			for (let y = 0; y < PY.rows; y++)
				for (let x = 0; x < PY.cols; x++) {
					const k = s.grid[y][x];
					if (!k) continue;
					puyu(g, ox + x * c, oy + y * c, k, popSet.has(`${x},${y}`) ? pop : 0);
				}
			if (s.cur)
				for (const [x, y, k] of pyCells(s.cur))
					if (y >= 0) puyu(g, ox + x * c, oy + y * c, k);
			// 右：次の 組
			const nx = ox + W + 16;
			const ny = ATOP + 14;
			txt(g, PY_TEXT.next, nx, ny, 8, "#e8e8f0");
			g.fillStyle = "#0c0a14";
			g.fillRect(nx - 2, ny + 11, c + 4, c * 2 + 4);
			puyu(g, nx, ny + 13, s.next[1]);
			puyu(g, nx, ny + 13 + c, s.next[0]);
			// 左：最大 連鎖
			txt(
				g,
				`${PY_TEXT.best} ${s.maxChain}`,
				ox - 14,
				ATOP + 14,
				8,
				"#e8e8f0",
				"right",
			);
			// 連鎖の 字（ゆれる）
			if (s.chainT > 0 && s.shownChain >= 2) {
				const bob = Math.round(Math.sin(clock * 14) * 1.5);
				const sx = ox + W / 2;
				const sy = oy + H / 2 - 10 + bob;
				g.fillStyle = "rgba(0,0,0,0.6)";
				g.fillRect(sx - 34, sy - 2, 68, 15);
				txt(
					g,
					PY_TEXT.chain.replace("{n}", String(s.shownChain)),
					sx,
					sy,
					10,
					s.shownChain >= 4 ? "#ff8060" : "#ffe060",
					"center",
				);
			}
			hud(g, `${ARCADE_BOARD.score} ${pyScore(s)}`, "");
		},
		over: (s) => s.over,
		score: pyScore,
	});
};
