// ピンポンの 板（決まりは data/arcade/home/pong.ts）。緑の ブラウン管の 見た目。
// ↑↓ で ラケットを 動かす（押しっぱなしは くり返しで 届く）。タップは その 高さへ ラケットが 向かう。

import {
	PONG,
	PONG_TEXT,
	pongScore,
	pongStart,
	pongStep,
	pongWon,
} from "../../../data/arcade/home/pong";
import { AH, ATOP, AW } from "../../../data/arcade/logic";
import { ARCADE } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import { txt } from "../../neta/netaBoard";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

const INK = "#60ff90";
const DIM = "#1c6a34";

export const playPong = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let dy: -1 | 0 | 1 = 0;
	let held = 0;
	let target: number | null = null;
	return playBoard(ctx, "pong", {
		start: () => pongStart(rnd),
		note: PONG_TEXT.note,
		step: (s, f) => {
			for (const e of f.evs) {
				if (isKey(e, "up", true)) {
					[dy, held, target] = [-1, 0.18, null];
				} else if (isKey(e, "down", true)) {
					[dy, held, target] = [1, 0.18, null];
				} else if (isTap(e) && e.tap[1] >= ATOP) {
					target = e.tap[1];
					dy = 0;
				}
			}
			// 押しっぱなしは くり返しで 届く。とぎれたら 止まる
			held -= f.dt;
			if (held <= 0) dy = 0;
			for (const e of pongStep(s, f.dt, { dy, target }, rnd)) {
				if (e === "hit") f.se("arcBlock");
				else if (e === "wall") f.se("cursor");
				else if (e === "point") f.se("arcCoin");
				else if (e === "lost") f.se("miss");
			}
		},
		draw: (g, s, clock) => {
			g.fillStyle = "#04120a";
			g.fillRect(0, 0, AW, AH);
			// まんなかの 点線
			g.fillStyle = DIM;
			for (let y = ATOP + 2; y < AH; y += 8) g.fillRect(AW / 2 - 1, y, 2, 4);
			// 点
			txt(g, `${s.mePts}`, AW / 2 - 24, ATOP + 4, 16, DIM, "center");
			txt(g, `${s.cpuPts}`, AW / 2 + 24, ATOP + 4, 16, DIM, "center");
			// ラケットと 球
			g.fillStyle = INK;
			g.fillRect(PONG.meX, Math.round(s.me), PONG.padW, PONG.padH);
			g.fillRect(PONG.cpuX, Math.round(s.cpu), PONG.padW, PONG.padH);
			const blink = s.wait > 0 && Math.floor(clock * 8) % 2 === 0;
			if (!blink) {
				const r = Math.floor(PONG.ball / 2);
				g.fillRect(
					Math.round(s.bx) - r,
					Math.round(s.by) - r,
					PONG.ball,
					PONG.ball,
				);
			}
			// 走査線（ブラウン管）
			g.fillStyle = "rgba(0,0,0,0.28)";
			for (let y = ATOP; y < AH; y += 2) g.fillRect(0, y, AW, 1);
			// 四すみを 暗く
			g.fillStyle = "rgba(0,0,0,0.35)";
			g.fillRect(0, ATOP, 3, AH - ATOP);
			g.fillRect(AW - 3, ATOP, 3, AH - ATOP);
			hud(
				g,
				`${PONG_TEXT.me} ${s.mePts} - ${s.cpuPts} ${PONG_TEXT.cpu}`,
				`先に${PONG.goal}点`,
			);
		},
		over: (s) => s.over,
		score: pongScore,
		end: (s) => (pongWon(s) ? ARCADE.clear : PONG_TEXT.lose),
	});
};
