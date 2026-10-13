// 五目並べの 板（決まりは data/arcade/home/gomoku.ts）。木の 碁盤の 見た目。
// 十字キーで カーソル、A で 置く。タップは その マスに じかに 置く。名無しは 少し 考えてから 打つ。

import {
	GM,
	GM_SAY,
	type GmState,
	gmBlocks,
	gmCpu,
	gmLongest,
	gmPlace,
	gmScore,
	gmStart,
} from "../../../data/arcade/home/gomoku";
import { AH, ATOP, AW } from "../../../data/arcade/logic";
import { ARCADE } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import type { G } from "../../neta/netaBoard";
import { txt } from "../../neta/netaBoard";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

const SIZE = GM.n * GM.cell;
const OX = Math.floor((AW - SIZE) / 2);
const OY = ATOP + Math.floor((AH - ATOP - SIZE) / 2);

type View = {
	s: GmState;
	cx: number;
	cy: number;
	/** 名無しが 打つまでの のこり（秒）。 */
	cpuT: number;
	/** 勝ちが 決まってからの 秒。 */
	endT: number;
};

const stone = (g: G, x: number, y: number, who: 1 | 2): void => {
	const X = Math.round(x);
	const Y = Math.round(y);
	g.fillStyle = who === 1 ? "#141418" : "#f4f2ea";
	g.fillRect(X - 4, Y - 5, 8, 10);
	g.fillRect(X - 5, Y - 4, 10, 8);
	g.fillStyle = who === 1 ? "#5a5a66" : "#ffffff";
	g.fillRect(X - 3, Y - 3, 2, 2);
	if (who === 2) {
		g.fillStyle = "#b8b4a8";
		g.fillRect(X - 4, Y + 4, 8, 1);
	}
};

const cellXY = (i: number): [number, number] => [
	OX + (i % GM.n) * GM.cell + GM.cell / 2,
	OY + Math.floor(i / GM.n) * GM.cell + GM.cell / 2,
];

export const playGomoku = (ctx: UiCtx): Promise<ArcadeResult | null> =>
	playBoard<View>(ctx, "gomoku", {
		start: () => {
			const c = (GM.n - 1) / 2;
			return { s: gmStart(), cx: c, cy: c, cpuT: 0, endT: 0 };
		},
		step: (v, f) => {
			const s = v.s;
			// v.s で 見る（s.winner の 絞りこみを 後に 残さない）
			if (v.s.winner) {
				v.endT += f.dt;
				return;
			}
			if (s.turn === 2) {
				v.cpuT -= f.dt;
				if (v.cpuT > 0) return;
				const i = gmCpu(s, rnd);
				const block = gmBlocks(s, i);
				gmPlace(s, i);
				f.se("put");
				if (s.winner === 2) f.say(GM_SAY.cpuWin);
				else if (s.winner === 3) f.say(GM_SAY.draw);
				else if (gmLongest(s, 2) >= 4 && !block) f.say(GM_SAY.four);
				else if (block) f.say(GM_SAY.block);
				return;
			}
			let place = -1;
			for (const e of f.evs) {
				if (isKey(e, "left", true)) v.cx = (v.cx + GM.n - 1) % GM.n;
				else if (isKey(e, "right", true)) v.cx = (v.cx + 1) % GM.n;
				else if (isKey(e, "up", true)) v.cy = (v.cy + GM.n - 1) % GM.n;
				else if (isKey(e, "down", true)) v.cy = (v.cy + 1) % GM.n;
				else if (isKey(e, "a")) place = v.cy * GM.n + v.cx;
				else if (isTap(e)) {
					const x = Math.floor((e.tap[0] - OX) / GM.cell);
					const y = Math.floor((e.tap[1] - OY) / GM.cell);
					if (x < 0 || y < 0 || x >= GM.n || y >= GM.n) continue;
					[v.cx, v.cy] = [x, y];
					place = y * GM.n + x;
				}
				if ("k" in e && e.k !== "a") f.se("cursor");
			}
			if (place < 0) return;
			if (!gmPlace(s, place)) {
				f.se("cancel");
				return;
			}
			f.se("put");
			if (s.winner === 1) f.say(GM_SAY.meWin);
			else if (s.winner === 3) f.say(GM_SAY.draw);
			else v.cpuT = GM.think;
		},
		draw: (g, v, clock) => {
			const s = v.s;
			g.fillStyle = "#2a1c12";
			g.fillRect(0, 0, AW, AH);
			// 碁盤（木）と 線
			g.fillStyle = "#d8a860";
			g.fillRect(OX - 3, OY - 3, SIZE + 6, SIZE + 6);
			g.fillStyle = "#8a5a2a";
			g.fillRect(OX - 3, OY + SIZE + 3, SIZE + 6, 2);
			g.fillStyle = "#5a3a1a";
			const h = GM.cell / 2;
			for (let k = 0; k < GM.n; k++) {
				const p = k * GM.cell + h;
				g.fillRect(OX + h, OY + p, SIZE - GM.cell + 1, 1);
				g.fillRect(OX + p, OY + h, 1, SIZE - GM.cell + 1);
			}
			// 星（天元と 四すみ）
			for (const [x, y] of [
				[5, 5],
				[2, 2],
				[8, 2],
				[2, 8],
				[8, 8],
			]) {
				const [X, Y] = cellXY(y * GM.n + x);
				g.fillRect(X - 1, Y - 1, 3, 3);
			}
			for (let i = 0; i < s.cells.length; i++) {
				const c = s.cells[i];
				if (c === 0) continue;
				const [X, Y] = cellXY(i);
				stone(g, X, Y, c);
			}
			// 最後の 手・勝った 列
			if (s.last >= 0) {
				const [X, Y] = cellXY(s.last);
				g.fillStyle = "#e04040";
				g.fillRect(X - 1, Y - 1, 2, 2);
			}
			if (s.line.length && Math.floor(clock * 6) % 2 === 0)
				for (const i of s.line) {
					const [X, Y] = cellXY(i);
					g.fillStyle = "#ff5040";
					g.fillRect(X - 6, Y - 6, 12, 1);
					g.fillRect(X - 6, Y + 5, 12, 1);
				}
			// カーソル（キリコの 番だけ）
			if (!s.winner && s.turn === 1) {
				const [X, Y] = cellXY(v.cy * GM.n + v.cx);
				g.fillStyle = "#4080ff";
				g.fillRect(X - 6, Y - 6, 4, 1);
				g.fillRect(X - 6, Y - 6, 1, 4);
				g.fillRect(X + 3, Y - 6, 4, 1);
				g.fillRect(X + 6, Y - 6, 1, 4);
				g.fillRect(X - 6, Y + 6, 4, 1);
				g.fillRect(X - 6, Y + 3, 1, 4);
				g.fillRect(X + 3, Y + 6, 4, 1);
				g.fillRect(X + 6, Y + 3, 1, 4);
			}
			// 両わきの 名札
			stone(g, OX / 2, 50, 1);
			txt(g, "キリコ", OX / 2, 60, 8, "#f4f2ea", "center");
			stone(g, AW - OX / 2, 50, 2);
			txt(g, "名無し", AW - OX / 2, 60, 8, "#f4f2ea", "center");
			if (!s.winner) {
				const mx = s.turn === 1 ? OX / 2 : AW - OX / 2;
				g.fillStyle = "#f0c040";
				g.fillRect(mx - 3, 36, 7, 2);
				g.fillRect(mx - 2, 38, 5, 1);
				g.fillRect(mx - 1, 39, 3, 1);
			}
			const right = s.winner
				? ""
				: s.turn === 1
					? "キリコの　番"
					: `名無し　考え中${".".repeat(Math.floor(clock * 4) % 4)}`;
			hud(g, `黒　${s.moves}手`, right);
		},
		over: (v) => v.s.winner !== 0 && v.endT >= GM.endWait,
		score: (v) => gmScore(v.s),
		end: (v) =>
			v.s.winner === 1
				? ARCADE.clear
				: v.s.winner === 3
					? "引き分け"
					: ARCADE.over,
	});
