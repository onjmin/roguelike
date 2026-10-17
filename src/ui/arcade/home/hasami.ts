// はさみ将棋の 板（決まりは data/arcade/home/hasami.ts）。木の 将棋盤に 歩（キリコ）と と（名無し）。
// 十字キーで カーソル、A で 駒を 選び、行き先で もう 一度 A。タップは 駒 → 行き先の 順に。
// 選んだ 駒を もう 一度 選ぶと 取りけす。名無しは 少し 考えてから 指す。

import {
	HS,
	HS_SAY,
	type HsState,
	hsCpu,
	hsDests,
	hsMove,
	hsScore,
	hsStart,
} from "../../../data/arcade/home/hasami";
import { AH, ATOP, AW } from "../../../data/arcade/logic";
import { ARCADE } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import type { G } from "../../neta/netaBoard";
import { txt } from "../../neta/netaBoard";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

const C = 14;
const SIZE = HS.n * C;
const OX = Math.floor((AW - SIZE) / 2);
const OY = ATOP + Math.floor((AH - ATOP - SIZE) / 2);

type View = {
	s: HsState;
	cx: number;
	cy: number;
	/** 選んだ 駒（-1 なし）。 */
	sel: number;
	cpuT: number;
	endT: number;
	/** 取られた 駒が 光る のこり（秒）。 */
	flash: number;
	/** 動いた 駒（すべって いく あいだは 取られた 駒を 残す）。 */
	mv: { from: number; to: number; t: number; got: boolean } | null;
};

/** 駒が すべる 長さ（秒）。 */
const SLIDE = 0.22;
/** 取られた 駒が 光る 長さ（秒）。 */
const FLASH = 0.6;

/** 駒（五角形）。名無しの 駒は 逆さ。 */
const piece = (g: G, cx: number, cy: number, who: 1 | 2): void => {
	const X = Math.round(cx);
	const Y = Math.round(cy);
	const d = who === 1 ? 1 : -1;
	// [上からの 段, 半分の 幅]（キリコの 向き。名無しは 上下を 返す）
	const rows: readonly (readonly [number, number])[] = [
		[-6, 1],
		[-5, 3],
		[-4, 4],
		[-3, 4],
		[-2, 5],
		[-1, 5],
		[0, 5],
		[1, 5],
		[2, 5],
		[3, 5],
		[4, 5],
	];
	g.fillStyle = "#f0d498";
	for (const [o, w] of rows) g.fillRect(X - w, Y + o * d, w * 2, 1);
	g.fillStyle = "#a07840";
	g.fillRect(X - 5, Y + 5 * d, 10, 1);
	if (who === 1) txt(g, "歩", X, Y - 4, 8, "#141418", "center");
	else {
		g.save();
		g.translate(X, Y + 1);
		g.rotate(Math.PI);
		txt(g, "と", 0, -4, 8, "#c02020", "center");
		g.restore();
	}
};

const at = (i: number): [number, number] => [
	OX + (i % HS.n) * C + C / 2,
	OY + Math.floor(i / HS.n) * C + C / 2,
];

export const playHasami = (ctx: UiCtx): Promise<ArcadeResult | null> =>
	playBoard<View>(ctx, "hasami", {
		start: () => ({
			s: hsStart(),
			cx: 4,
			cy: HS.n - 1,
			sel: -1,
			cpuT: 0,
			endT: 0,
			flash: 0,
			mv: null,
		}),
		step: (v, f) => {
			const s = v.s;
			v.flash = Math.max(0, v.flash - f.dt);
			if (v.mv) {
				v.mv.t += f.dt;
				// すべりおえて から 取った 音
				if (v.mv.t >= SLIDE) {
					if (v.mv.got) f.se("hit_copper");
					v.flash = Math.min(v.flash, FLASH);
					v.mv = null;
				}
				return;
			}
			// v.s で 見る（s.winner の 絞りこみを 後に 残さない）
			if (v.s.winner) {
				v.endT += f.dt;
				return;
			}
			if (s.turn === 2) {
				v.cpuT -= f.dt;
				if (v.cpuT > 0) return;
				const [from, to] = hsCpu(s, rnd);
				const got = hsMove(s, from, to);
				f.se("put");
				v.mv = { from, to, t: 0, got: got > 0 };
				if (got > 0) v.flash = FLASH + SLIDE;
				if (s.winner === 2) f.say(HS_SAY.cpuWin);
				else if (s.winner === 1) f.say(HS_SAY.meWin);
				else if (s.winner === 3) f.say(HS_SAY.draw);
				else if (got > 0) f.say(HS_SAY.took);
				return;
			}
			const n = HS.n;
			let pick = -1;
			for (const e of f.evs) {
				if (isKey(e, "left", true)) v.cx = (v.cx + n - 1) % n;
				else if (isKey(e, "right", true)) v.cx = (v.cx + 1) % n;
				else if (isKey(e, "up", true)) v.cy = (v.cy + n - 1) % n;
				else if (isKey(e, "down", true)) v.cy = (v.cy + 1) % n;
				else if (isKey(e, "a")) pick = v.cy * n + v.cx;
				else if (isTap(e)) {
					const x = Math.floor((e.tap[0] - OX) / C);
					const y = Math.floor((e.tap[1] - OY) / C);
					if (x < 0 || y < 0 || x >= n || y >= n) continue;
					[v.cx, v.cy] = [x, y];
					pick = y * n + x;
				}
				if ("k" in e && e.k !== "a") f.se("cursor");
				if (pick >= 0) break;
			}
			if (pick < 0) return;
			if (s.cells[pick] === 1) {
				// 選ぶ・選びなおす・取りけす
				if (v.sel === pick) {
					v.sel = -1;
					f.se("cancel");
				} else {
					v.sel = pick;
					f.se("decide");
				}
				return;
			}
			if (v.sel < 0) return;
			const got = hsMove(s, v.sel, pick);
			if (got < 0) {
				v.sel = -1;
				f.se("cancel");
				return;
			}
			v.mv = { from: v.sel, to: pick, t: 0, got: got > 0 };
			v.sel = -1;
			f.se("put");
			if (got > 0) v.flash = FLASH + SLIDE;
			if (s.winner === 1) f.say(HS_SAY.meWin);
			else if (s.winner === 2) f.say(HS_SAY.cpuWin);
			else if (s.winner === 3) f.say(HS_SAY.draw);
			else {
				if (got > 0) f.say(HS_SAY.lost);
				v.cpuT = HS.think;
			}
		},
		draw: (g, v, clock) => {
			const s = v.s;
			g.fillStyle = "#2a1c12";
			g.fillRect(0, 0, AW, AH);
			g.fillStyle = "#e0b870";
			g.fillRect(OX - 2, OY - 2, SIZE + 4, SIZE + 4);
			g.fillStyle = "#6a4a20";
			for (let k = 0; k <= HS.n; k++) {
				g.fillRect(OX, OY + k * C, SIZE + 1, 1);
				g.fillRect(OX + k * C, OY, 1, SIZE + 1);
			}
			// 最後の 手
			if (s.last)
				for (const i of s.last) {
					g.fillStyle = "rgba(255,120,40,0.35)";
					g.fillRect(
						OX + (i % HS.n) * C + 1,
						OY + Math.floor(i / HS.n) * C + 1,
						C - 1,
						C - 1,
					);
				}
			// 取られた 駒（すべりおえて から 光って 消える）
			if (v.flash > 0 && v.flash <= FLASH && Math.floor(clock * 12) % 2 === 0)
				for (const i of s.gone) {
					g.fillStyle = "#ffffff";
					g.fillRect(
						OX + (i % HS.n) * C + 1,
						OY + Math.floor(i / HS.n) * C + 1,
						C - 1,
						C - 1,
					);
				}
			// 選んだ 駒と 行き先
			if (v.sel >= 0) {
				g.fillStyle = "rgba(64,128,255,0.45)";
				g.fillRect(
					OX + (v.sel % HS.n) * C + 1,
					OY + Math.floor(v.sel / HS.n) * C + 1,
					C - 1,
					C - 1,
				);
				g.fillStyle = "#3060d0";
				for (const d of hsDests(s.cells, v.sel)) {
					const [X, Y] = at(d);
					g.fillRect(X - 1, Y - 1, 3, 3);
				}
			}
			const mv = v.mv;
			for (let i = 0; i < s.cells.length; i++) {
				const c = s.cells[i];
				if (c === 0 || (mv && i === mv.to)) continue;
				const [X, Y] = at(i);
				piece(g, X, Y, c);
			}
			if (mv) {
				const who = s.cells[mv.to] === 2 ? 2 : 1;
				// 挟まれる 駒は すべりおえる まで 残す
				for (const i of s.gone) {
					const [X, Y] = at(i);
					piece(g, X, Y, who === 1 ? 2 : 1);
				}
				const [x0, y0] = at(mv.from);
				const [x1, y1] = at(mv.to);
				const p = Math.min(1, mv.t / SLIDE);
				const e = 1 - (1 - p) * (1 - p);
				piece(g, x0 + (x1 - x0) * e, y0 + (y1 - y0) * e, who);
			}
			if (!s.winner && s.turn === 1) {
				const X = OX + v.cx * C;
				const Y = OY + v.cy * C;
				g.fillStyle = "#2050ff";
				g.fillRect(X, Y, C + 1, 1);
				g.fillRect(X, Y + C, C + 1, 1);
				g.fillRect(X, Y, 1, C + 1);
				g.fillRect(X + C, Y, 1, C + 1);
			}
			// 両わきの 駒台（取った 駒）
			const side = (x: number, label: string, n: number, who: 1 | 2) => {
				txt(g, label, x, 24, 8, "#f4f2ea", "center");
				txt(g, `${n}／${HS.goal}`, x, 34, 8, "#f0c040", "center");
				for (let k = 0; k < n; k++)
					piece(g, x - 8 + (k % 2) * 16, 56 + Math.floor(k / 2) * 16, who);
			};
			// 名無しが 取った キリコの 駒は 左（名無しの 台）、キリコが 取った 駒は 右
			side(OX / 2, "名無し", s.took[2], 1);
			side(AW - OX / 2, "キリコ", s.took[1], 2);
			const right = s.winner
				? ""
				: s.turn === 1
					? v.sel >= 0
						? "行き先を選ぶ"
						: "動かす駒を選ぶ"
					: `名無し考え中${".".repeat(Math.floor(clock * 4) % 4)}`;
			hud(g, `${s.ply}／${HS.maxPly}手`, right);
		},
		over: (v) => v.s.winner !== 0 && v.endT >= HS.endWait,
		score: (v) => hsScore(v.s),
		end: (v) =>
			v.s.winner === 1
				? ARCADE.clear
				: v.s.winner === 3
					? "引き分け"
					: ARCADE.over,
	});
