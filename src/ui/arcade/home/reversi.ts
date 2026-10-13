// リバーシの 板（決まりは data/arcade/home/reversi.ts）。緑の 盤に 黒（キリコ）と 白（名無し）。
// 十字キーで カーソル、A で 置く。タップは その マスに じかに 置く。置ける マスには 点を 出す。
// 返る 石は 置いた ところから 順に くるっと 回る。名無しは 回り おわって 少し 考えてから 置く。
// 勝ち抜き：勝つと 名無しが 強く なって 次の 局（3局。点は 足して いく）。負け・引き分けで おわり。

import {
	RV,
	RV_LV,
	RV_SAY,
	type RvMove,
	type RvState,
	type RvStone,
	rvCorner,
	rvCount,
	rvCpu,
	rvMoves,
	rvPlace,
	rvScore,
	rvStart,
} from "../../../data/arcade/home/reversi";
import { AH, ATOP, AW } from "../../../data/arcade/logic";
import { ARCADE } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import type { G } from "../../neta/netaBoard";
import { txt } from "../../neta/netaBoard";
import {
	burst,
	type Juice,
	juice,
	juiceDraw,
	juiceStep,
	pop,
	quake,
	shaken,
} from "../arcadeJuice";
import {
	type ArcadeResult,
	banner,
	hud,
	isKey,
	isTap,
	playBoard,
} from "../arcadeKit";

const rnd = Math.random;

const C = RV.cell;
const SIZE = RV.n * C;
const OX = Math.floor((AW - SIZE) / 2);
const OY = ATOP + Math.floor((AH - ATOP - SIZE) / 2);
/** 両わきの 名札の まんなか。 */
const LX = OX / 2;
const RX = AW - OX / 2;

type View = {
	s: RvState;
	cx: number;
	cy: number;
	cpuT: number;
	endT: number;
	total: number;
	/** 回って いる 石の のこり（秒。0 で 止まって いる）。 */
	flip: number[];
	/** 回る 前の 色。 */
	from: RvStone[];
	j: Juice;
};

const NEXT_WAIT = RV.endWait + 0.8;

const goesOn = (s: RvState): boolean => s.winner === 1 && s.lv < RV.levels - 1;

const cellXY = (i: number): [number, number] => [
	OX + (i % RV.n) * C + C / 2,
	OY + Math.floor(i / RV.n) * C + C / 2,
];

/** 石（w は 横の 広さの わりあい。回る ときに 細く なる）。 */
const disc = (g: G, x: number, y: number, who: 1 | 2, w = 1): void => {
	const X = Math.round(x);
	const Y = Math.round(y);
	const hw = Math.max(1, Math.round(6 * w));
	g.fillStyle = "#0a2a14";
	g.fillRect(X - hw, Y - 4, hw * 2, 10);
	g.fillStyle = who === 1 ? "#141418" : "#f4f2ea";
	g.fillRect(X - hw, Y - 5, hw * 2, 10);
	if (hw >= 4) {
		g.fillRect(X - hw - 1, Y - 4, hw * 2 + 2, 8);
		g.fillStyle = who === 1 ? "#4a4a56" : "#ffffff";
		g.fillRect(X - hw + 2, Y - 3, 2, 2);
	}
};

/** 置いた 手の 石を 回し はじめる（置いた ところから 近い 順）。 */
const startFlip = (v: View, at: number, mv: RvMove): void => {
	const ax = at % RV.n;
	const ay = Math.floor(at / RV.n);
	for (const i of mv.flips) {
		const d = Math.max(
			Math.abs((i % RV.n) - ax),
			Math.abs(Math.floor(i / RV.n) - ay),
		);
		v.from[i] = v.s.cells[i] === 1 ? 2 : 1;
		v.flip[i] = RV.flipT + d * 0.05;
	}
};

const busy = (v: View): boolean => v.flip.some((t) => t > 0);

/** 置いた あとの 声・手ごたえ。 */
const react = (
	v: View,
	at: number,
	mv: RvMove,
	f: { say: (s: string) => void },
) => {
	const s = v.s;
	const [X, Y] = cellXY(at);
	const who = s.cells[at] === 1 ? 1 : 2;
	pop(v.j, X, Y - 6, `+${mv.flips.length}`, who === 1 ? "#a0c8ff" : "#ffb0a0");
	if (rvCorner(at)) {
		burst(v.j, X, Y, "#ffe060", 10);
		quake(v.j, 2);
	}
	if (s.winner === 1) f.say(RV_SAY.meWin);
	else if (s.winner === 2) f.say(RV_SAY.cpuWin);
	else if (s.winner === 3) f.say(RV_SAY.draw);
	else if (mv.pass === 1) f.say(RV_SAY.mePass);
	else if (mv.pass === 2) f.say(RV_SAY.cpuPass);
	else if (rvCorner(at)) f.say(who === 2 ? RV_SAY.corner : RV_SAY.meCorner);
	else if (who === 2 && mv.flips.length >= 6) f.say(RV_SAY.many);
};

const fresh = (
	lv: number,
): Pick<View, "s" | "cx" | "cy" | "flip" | "from"> => ({
	s: rvStart(lv),
	cx: 2,
	cy: 3,
	flip: Array.from({ length: RV.n * RV.n }, () => 0),
	from: Array.from({ length: RV.n * RV.n }, () => 0 as RvStone),
});

export const playReversi = (ctx: UiCtx): Promise<ArcadeResult | null> =>
	playBoard<View>(ctx, "reversi", {
		start: () => ({ ...fresh(0), cpuT: 0, endT: 0, total: 0, j: juice() }),
		step: (v, f) => {
			juiceStep(v.j, f.dt);
			for (let i = 0; i < v.flip.length; i++)
				v.flip[i] = Math.max(0, (v.flip[i] ?? 0) - f.dt);
			if (v.s.winner) {
				if (busy(v)) return;
				v.endT += f.dt;
				if (goesOn(v.s) && v.endT >= NEXT_WAIT) {
					const lv = v.s.lv;
					v.total += rvScore(v.s);
					Object.assign(v, fresh(lv + 1));
					v.endT = 0;
					f.se("jingle");
					f.say(RV_SAY.next[lv] ?? "");
				}
				return;
			}
			const s = v.s;
			if (s.turn === 2) {
				if (busy(v)) return;
				v.cpuT -= f.dt;
				if (v.cpuT > 0) return;
				const i = rvCpu(s, rnd);
				const mv = rvPlace(s, i);
				if (!mv) return;
				f.se("put");
				startFlip(v, i, mv);
				react(v, i, mv, f);
				if (s.turn === 2) v.cpuT = RV.think + 0.4;
				if (goesOn(s)) f.se("victory");
				return;
			}
			let place = -1;
			for (const e of f.evs) {
				if (isKey(e, "left", true)) v.cx = (v.cx + RV.n - 1) % RV.n;
				else if (isKey(e, "right", true)) v.cx = (v.cx + 1) % RV.n;
				else if (isKey(e, "up", true)) v.cy = (v.cy + RV.n - 1) % RV.n;
				else if (isKey(e, "down", true)) v.cy = (v.cy + 1) % RV.n;
				else if (isKey(e, "a")) place = v.cy * RV.n + v.cx;
				else if (isTap(e)) {
					const x = Math.floor((e.tap[0] - OX) / C);
					const y = Math.floor((e.tap[1] - OY) / C);
					if (x < 0 || y < 0 || x >= RV.n || y >= RV.n) continue;
					[v.cx, v.cy] = [x, y];
					place = y * RV.n + x;
				}
				if ("k" in e && e.k !== "a") f.se("cursor");
			}
			if (place < 0 || busy(v)) return;
			const mv = rvPlace(s, place);
			if (!mv) {
				f.se("cancel");
				return;
			}
			f.se("put");
			startFlip(v, place, mv);
			react(v, place, mv, f);
			if (v.s.turn === 2) v.cpuT = RV.think;
			if (goesOn(s)) f.se("victory");
		},
		draw: (g, v, clock) => {
			const s = v.s;
			g.fillStyle = "#1a1410";
			g.fillRect(0, 0, AW, AH);
			shaken(g, v.j, () => {
				// 盤（緑）と 線
				g.fillStyle = "#3a2a1a";
				g.fillRect(OX - 3, OY - 3, SIZE + 6, SIZE + 6);
				g.fillStyle = "#1e7a3e";
				g.fillRect(OX, OY, SIZE, SIZE);
				g.fillStyle = "#0e4a24";
				for (let k = 0; k <= RV.n; k++) {
					g.fillRect(OX, OY + k * C, SIZE, 1);
					g.fillRect(OX + k * C, OY, 1, SIZE);
				}
				for (const [x, y] of [
					[2, 2],
					[6, 2],
					[2, 6],
					[6, 6],
				])
					g.fillRect(OX + (x ?? 0) * C - 1, OY + (y ?? 0) * C - 1, 3, 3);
				// 置ける マスの 点（キリコの 番で 石が 止まって いる とき）
				const mine = !s.winner && s.turn === 1 && !busy(v);
				if (mine)
					for (const i of rvMoves(s.cells, 1)) {
						const [X, Y] = cellXY(i);
						g.fillStyle = "#7ad89a";
						g.fillRect(X - 1, Y - 1, 3, 3);
					}
				for (let i = 0; i < s.cells.length; i++) {
					const c = s.cells[i];
					if (!c) continue;
					const [X, Y] = cellXY(i);
					const t = v.flip[i] ?? 0;
					if (t <= 0) disc(g, X, Y, c);
					else if (t > RV.flipT) disc(g, X, Y, v.from[i] === 1 ? 1 : 2);
					else {
						// 半分までは 前の 色が 細く、のこりは 新しい 色が 広がる
						const p = 1 - t / RV.flipT;
						const w = Math.abs(Math.cos(p * Math.PI));
						disc(g, X, Y, p < 0.5 ? (v.from[i] === 1 ? 1 : 2) : c, w);
					}
				}
				if (s.last >= 0) {
					const [X, Y] = cellXY(s.last);
					g.fillStyle = "#e04040";
					g.fillRect(X - 1, Y - 1, 2, 2);
				}
				if (mine) {
					const [X, Y] = cellXY(v.cy * RV.n + v.cx);
					g.fillStyle = "#60a0ff";
					g.fillRect(X - 8, Y - 8, 5, 1);
					g.fillRect(X - 8, Y - 8, 1, 5);
					g.fillRect(X + 4, Y - 8, 5, 1);
					g.fillRect(X + 8, Y - 8, 1, 5);
					g.fillRect(X - 8, Y + 8, 5, 1);
					g.fillRect(X - 8, Y + 4, 1, 5);
					g.fillRect(X + 4, Y + 8, 5, 1);
					g.fillRect(X + 8, Y + 4, 1, 5);
				}
			});
			// 両わきの 名札と 石の 数
			disc(g, LX, 40, 1);
			txt(g, "キリコ", LX, 50, 8, "#f4f2ea", "center");
			txt(g, `${rvCount(s.cells, 1)}`, LX, 60, 8, "#f0c040", "center");
			disc(g, RX, 40, 2);
			txt(g, "名無し", RX, 50, 8, "#f4f2ea", "center");
			txt(g, `${rvCount(s.cells, 2)}`, RX, 60, 8, "#f0c040", "center");
			txt(g, RV_LV[s.lv] ?? "", RX, 74, 8, "#f0c040", "center");
			if (!s.winner) {
				const mx = s.turn === 1 ? LX : RX;
				g.fillStyle = "#f0c040";
				g.fillRect(mx - 3, 26, 7, 2);
				g.fillRect(mx - 2, 28, 5, 1);
				g.fillRect(mx - 1, 29, 3, 1);
			}
			if (v.total > 0) {
				txt(g, "勝ち抜き", LX, 96, 8, "#f0c040", "center");
				txt(g, `${v.total}点`, LX, 106, 8, "#f4f2ea", "center");
			}
			const right = s.winner
				? ""
				: s.turn === 1
					? "キリコの　番"
					: `名無し　考え中${".".repeat(Math.floor(clock * 4) % 4)}`;
			hud(g, `第${s.lv + 1}局`, right);
			juiceDraw(g, v.j, AW, AH);
			if (goesOn(s) && v.endT >= RV.endWait)
				banner(g, `次は　${RV_LV[s.lv + 1]}　名無し`, "#ffe060");
		},
		over: (v) => v.s.winner !== 0 && !goesOn(v.s) && v.endT >= RV.endWait,
		score: (v) => v.total + rvScore(v.s),
		end: (v) =>
			v.s.winner === 1
				? ARCADE.clear
				: v.s.winner === 3
					? "引き分け"
					: ARCADE.over,
	});
