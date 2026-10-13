// 道路わたり の 板（決まりは data/arcade/home/crossing.ts）。
// 十字キーで 1マス。タップは キリコから 見た 向き（縦と 横の 大きい ほう）へ 1マス。

import {
	CR,
	CR_TEXT,
	crOrigin,
	crScore,
	crStart,
	crStep,
	crTimeLeft,
} from "../../../data/arcade/home/crossing";
import { AH, AW } from "../../../data/arcade/logic";
import { ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import type { G } from "../../neta/netaBoard";
import { txt } from "../../neta/netaBoard";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

const CARS = ["#e05050", "#4070e0", "#e0e0e8", "#50b060"] as const;

/** 上から 見た 小さな キリコ（赤茶の 髪に 緑の 髪かざり・緑の 服・黄土色の スカート。ui/arcade/arcadeHome.ts と 同じ 色）。 */
const kiriko = (g: G, x: number, y: number, c: number): void => {
	g.fillStyle = "#72241f";
	g.fillRect(x + 2, y + 1, c - 4, 3);
	g.fillStyle = "#28a131";
	g.fillRect(x + 3, y + 1, c - 6, 1);
	g.fillStyle = "#f0c8a8";
	g.fillRect(x + 3, y + 3, c - 6, 2);
	g.fillStyle = "#28a131";
	g.fillRect(x + 2, y + 5, c - 4, 2);
	g.fillStyle = "#926855";
	g.fillRect(x + 2, y + 7, c - 4, 1);
	g.fillStyle = "#353333";
	g.fillRect(x + 3, y + 8, 1, 2);
	g.fillRect(x + c - 4, y + 8, 1, 2);
};

export const playCrossing = (ctx: UiCtx): Promise<ArcadeResult | null> =>
	playBoard(ctx, "crossing", {
		start: () => crStart(rnd),
		step: (s, f) => {
			const [ox, oy] = crOrigin();
			const c = CR.cell;
			let dx = 0;
			let dy = 0;
			for (const e of f.evs) {
				if (isKey(e, "left")) [dx, dy] = [-1, 0];
				else if (isKey(e, "right")) [dx, dy] = [1, 0];
				else if (isKey(e, "up")) [dx, dy] = [0, -1];
				else if (isKey(e, "down")) [dx, dy] = [0, 1];
				else if (isTap(e)) {
					const ax = e.tap[0] - (ox + s.px * c + c / 2);
					const ay = e.tap[1] - (oy + s.py * c + c / 2);
					if (Math.abs(ax) >= Math.abs(ay)) [dx, dy] = [Math.sign(ax), 0];
					else [dx, dy] = [0, Math.sign(ay)];
				}
			}
			for (const e of crStep(s, f.dt, { dx, dy }, rnd)) {
				if (e === "hop") f.se("cursor");
				else if (e === "goal") f.se("arcCoin");
				else if (e === "crash") f.se("arcCrash");
				else if (e === "splash" || e === "timeout") f.se("miss");
			}
		},
		draw: (g, s, clock) => {
			const [ox, oy] = crOrigin();
			const c = CR.cell;
			const W = CR.cols * c;
			g.fillStyle = "#101010";
			g.fillRect(0, 0, AW, AH);
			for (const l of s.lanes) {
				const Y = oy + l.y * c;
				if (l.kind === "g") {
					g.fillStyle = "#3a8a3a";
					g.fillRect(ox, Y, W, c);
					txt(g, CR_TEXT.goal, ox + W / 2, Y + 1, 8, "#f4f2ea", "center");
				} else if (l.kind === "w") {
					g.fillStyle = "#2a5ab0";
					g.fillRect(ox, Y, W, c);
					g.fillStyle = "#4a7ad0";
					const off = Math.floor(clock * 8 + l.y * 5) % 12;
					for (let x = -off; x < W; x += 12) g.fillRect(ox + x, Y + 4, 4, 1);
				} else if (l.kind === "r") {
					g.fillStyle = "#3a3a42";
					g.fillRect(ox, Y, W, c);
					if (s.lanes[l.y + 1]?.kind === "r") {
						g.fillStyle = "#c8c8b0";
						for (let x = 0; x < W; x += 10) g.fillRect(ox + x, Y + c - 1, 5, 1);
					}
				} else {
					g.fillStyle = l.kind === "s" ? "#6a9a4a" : "#9a9080";
					g.fillRect(ox, Y, W, c);
					g.fillStyle = l.kind === "s" ? "#5a8a3a" : "#8a8070";
					for (let x = 0; x < W; x += 8) g.fillRect(ox + x, Y + c - 1, 7, 1);
				}
				for (const it of l.items) {
					const X = Math.round(ox + it.x * c);
					const w = it.w * c;
					if (l.kind === "w") {
						g.fillStyle = "#7a4a22";
						g.fillRect(X, Y + 1, w, c - 2);
						g.fillStyle = "#a06a3a";
						g.fillRect(X, Y + 2, w, 1);
						g.fillStyle = "#5a3418";
						g.fillRect(X + w - 2, Y + 1, 2, c - 2);
					} else {
						g.fillStyle = CARS[it.tone % CARS.length];
						g.fillRect(X + 1, Y + 1, w - 2, c - 2);
						g.fillStyle = "#9ad0f0";
						const front = l.speed > 0 ? X + w - 5 : X + 2;
						g.fillRect(front, Y + 2, 3, c - 4);
						g.fillStyle = "#141418";
						g.fillRect(X + 2, Y, 3, 1);
						g.fillRect(X + w - 5, Y, 3, 1);
						g.fillRect(X + 2, Y + c - 1, 3, 1);
						g.fillRect(X + w - 5, Y + c - 1, 3, 1);
					}
				}
			}
			// 盤の 外に はみだした 物を 隠す
			g.fillStyle = "#101010";
			g.fillRect(0, oy, ox, CR.rows * c);
			g.fillRect(ox + W, oy, AW - ox - W, CR.rows * c);
			const px = Math.round(ox + s.px * c);
			const py = oy + s.py * c;
			if (s.deadT > 0) {
				if (Math.floor(clock * 10) % 2 === 0) {
					g.fillStyle = "#ffe060";
					g.fillRect(px + 1, py + 1, c - 2, c - 2);
					g.fillStyle = "#ff5040";
					g.fillRect(px + 3, py + 3, c - 6, c - 6);
				}
			} else kiriko(g, px, py, c);
			hud(
				g,
				`${ARCADE_BOARD.score} ${crScore(s)}　${ARCADE_BOARD.lives} ${Math.max(0, s.lives)}`,
				`${s.lap + 1}${CR_TEXT.lap}　${ARCADE_BOARD.time} ${crTimeLeft(s)}`,
			);
		},
		over: (s) => s.over,
		score: crScore,
	});
