// 安価スネーク の 板（決まりは data/arcade/home/snake.ts）。
// 十字キーで 向きを かえる。タップは 頭から 見た 向き（縦と 横の 大きい ほう）へ。

import {
	SN,
	SN_TEXT,
	type SnDir,
	snOrigin,
	snScore,
	snStart,
	snStep,
} from "../../../data/arcade/home/snake";
import { AH, AW } from "../../../data/arcade/logic";
import { ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import { txt } from "../../neta/netaBoard";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

const KEYS = ["up", "right", "down", "left"] as const;

export const playSnake = (ctx: UiCtx): Promise<ArcadeResult | null> =>
	playBoard(ctx, "snake", {
		start: () => snStart(rnd),
		step: (s, f) => {
			const [ox, oy] = snOrigin();
			const c = SN.cell;
			for (const e of f.evs) {
				let dir: SnDir | null = null;
				const k = KEYS.findIndex((k) => isKey(e, k));
				if (k >= 0) dir = k as SnDir;
				else if (isTap(e)) {
					const [hx, hy] = s.body[0];
					const ax = e.tap[0] - (ox + hx * c + c / 2);
					const ay = e.tap[1] - (oy + hy * c + c / 2);
					if (Math.abs(ax) >= Math.abs(ay)) dir = ax < 0 ? 3 : 1;
					else dir = ay < 0 ? 0 : 2;
				}
				if (dir === null) continue;
				snStep(s, 0, { dir }, rnd);
			}
			for (const e of snStep(s, f.dt, { dir: null }, rnd)) {
				if (e === "eat") f.se("arcCoin");
				else if (e === "dead") f.se("arcCrash");
			}
		},
		draw: (g, s) => {
			const [ox, oy] = snOrigin();
			const c = SN.cell;
			g.fillStyle = "#101418";
			g.fillRect(0, 0, AW, AH);
			// 盤（市松の 薄い 目）
			for (let y = 0; y < SN.rows; y++)
				for (let x = 0; x < SN.cols; x++) {
					g.fillStyle = (x + y) % 2 ? "#1e2a22" : "#22302a";
					g.fillRect(ox + x * c, oy + y * c, c, c);
				}
			g.fillStyle = "#6a7a70";
			g.fillRect(ox - 1, oy - 1, SN.cols * c + 2, 1);
			g.fillRect(ox - 1, oy + SN.rows * c, SN.cols * c + 2, 1);
			g.fillRect(ox - 1, oy - 1, 1, SN.rows * c + 2);
			g.fillRect(ox + SN.cols * c, oy - 1, 1, SN.rows * c + 2);
			// 安価の 札
			const [fx, fy] = s.food;
			g.fillStyle = "#f0f0f4";
			g.fillRect(ox + fx * c - 1, oy + fy * c, c + 2, c);
			g.fillStyle = "#3050c0";
			g.fillRect(ox + fx * c - 1, oy + fy * c + c - 1, c + 2, 1);
			txt(
				g,
				SN_TEXT.food,
				ox + fx * c + c / 2,
				oy + fy * c + 1,
				6,
				"#2040c0",
				"center",
			);
			// 名無しの 列（頭は 明るく、目を つける）
			s.body.forEach(([x, y], i) => {
				g.fillStyle = i === 0 ? "#80e070" : i % 2 ? "#3a9a40" : "#48a84c";
				g.fillRect(ox + x * c + 1, oy + y * c + 1, c - 2, c - 2);
			});
			const [hx, hy] = s.body[0];
			g.fillStyle = "#102010";
			if (s.dir === 0 || s.dir === 2) {
				const ey = oy + hy * c + (s.dir === 0 ? 2 : c - 3);
				g.fillRect(ox + hx * c + 2, ey, 1, 1);
				g.fillRect(ox + hx * c + c - 3, ey, 1, 1);
			} else {
				const ex = ox + hx * c + (s.dir === 3 ? 2 : c - 3);
				g.fillRect(ex, oy + hy * c + 2, 1, 1);
				g.fillRect(ex, oy + hy * c + c - 3, 1, 1);
			}
			hud(
				g,
				`${ARCADE_BOARD.score} ${snScore(s)}`,
				`${SN_TEXT.eaten} ${s.eaten}　${ARCADE_BOARD.time} ${Math.floor(s.t)}`,
			);
		},
		over: (s) => s.over,
		score: snScore,
	});
