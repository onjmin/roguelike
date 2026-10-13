// ぷゆゆ なでなでの 板（決まりは data/arcade/home/clicker.ts）。左に 大きな ぷゆゆ、右に 店。
// A か ぷゆゆを タップで なでる（つぶれて 数が はねる）。十字キー 上下で 店の 行を えらび 右で 買う。行の タップでも 買う。
// ぷゆゆは うるんだ 目で 見あげて いる。なで手が いると ぷゆゆの まわりを 小さな ぷゆゆが はねる。

import {
	CK,
	CK_SHOP,
	type CkState,
	CLICKER_TEXT,
	ckBuy,
	ckClick,
	ckCost,
	ckPower,
	ckRate,
	ckScore,
	ckStart,
	ckStep,
	ckTimeLeft,
} from "../../../data/arcade/home/clicker";
import { AH, AW } from "../../../data/arcade/logic";
import { ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import { type G, txt } from "../../neta/netaBoard";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";

/** ぷゆゆの まんなか（足もと）。 */
const PX = 58;
const PY = 112;
const PW = 46;
const PH = 40;
/** 店の 欄。 */
const SX = 118;
const SY = 17;
const ROW = 21;

const fmt = (n: number): string =>
	n >= 100000 ? `${Math.floor(n / 1000)}k` : String(Math.floor(n));

/** 大きな ぷゆゆ（sq＝つぶれ 0〜1。🥺 の 目）。 */
const bigPuyu = (g: G, sq: number, clock: number): void => {
	const w = PW * (1 + sq * 0.22);
	const h = PH * (1 - sq * 0.25);
	// 影
	g.fillStyle = "rgba(0,0,0,0.25)";
	g.fillRect(Math.round(PX - w / 2), PY, Math.round(w), 3);
	// からだ（下が 平らな まんじゅう）
	for (let y = 0; y < h; y++) {
		const k = (h - y) / h;
		const half =
			(w / 2) *
			Math.min(1, Math.sqrt(Math.max(0, 1 - (k * 1.05 - 0.05) ** 4)) + 0.02);
		g.fillStyle = y > h * 0.8 ? "#f0c838" : y < 4 ? "#ffe880" : "#f8d448";
		g.fillRect(
			Math.round(PX - half),
			Math.round(PY - h + y),
			Math.round(half * 2),
			1,
		);
	}
	// ふち
	g.fillStyle = "#c89820";
	g.fillRect(Math.round(PX - w / 2), PY - 1, Math.round(w), 1);
	const top = PY - h;
	const ey = Math.round(top + h * 0.38);
	const dx = Math.round(w * 0.2);
	// 眉（内がわが 上がる）
	g.fillStyle = "#6a4010";
	g.fillRect(PX - dx - 4, ey - 6, 3, 1);
	g.fillRect(PX - dx - 1, ey - 7, 3, 1);
	g.fillRect(PX + dx - 2, ey - 7, 3, 1);
	g.fillRect(PX + dx + 1, ey - 6, 3, 1);
	// うるんだ 目
	for (const ex of [PX - dx, PX + dx]) {
		g.fillStyle = "#2a1408";
		g.fillRect(ex - 4, ey - 4, 8, 10);
		g.fillRect(ex - 5, ey - 2, 10, 6);
		g.fillStyle = "#4a2a50";
		g.fillRect(ex - 3, ey + 2, 6, 3);
		// 光
		g.fillStyle = "#ffffff";
		g.fillRect(ex - 3, ey - 3, 3, 3);
		g.fillRect(ex + 1, ey + 2, 2, 2);
		// 下の ふちの 涙
		g.fillStyle = "#8ad0ff";
		g.fillRect(ex - 4, ey + 5, 8, 1);
	}
	// 涙の しずく（ときどき つたう）
	const tear = (clock * 0.7) % 1;
	if (tear < 0.6) {
		g.fillStyle = "#8ad0ff";
		g.fillRect(PX + dx + 4, ey + 6 + Math.round(tear * 14), 2, 3);
	}
	// ほお
	g.fillStyle = "#ffa080";
	g.fillRect(PX - dx - 8, ey + 8, 4, 2);
	g.fillRect(PX + dx + 4, ey + 8, 4, 2);
	// 口（への字の 小さな 口）
	g.fillStyle = "#6a4010";
	g.fillRect(PX - 2, ey + 9, 4, 1);
	g.fillRect(PX - 3, ey + 10, 1, 1);
	g.fillRect(PX + 2, ey + 10, 1, 1);
};

/** 小さな ぷゆゆ（なで手）。 */
const miniPuyu = (g: G, x: number, y: number): void => {
	const X = Math.round(x);
	const Y = Math.round(y);
	g.fillStyle = "#f0c838";
	g.fillRect(X - 3, Y - 5, 6, 5);
	g.fillRect(X - 2, Y - 6, 4, 1);
	g.fillStyle = "#2a1408";
	g.fillRect(X - 2, Y - 4, 1, 2);
	g.fillRect(X + 1, Y - 4, 1, 2);
};

type Pop = { x: number; y: number; t: number; s: string };

const hitPuyu = (x: number, y: number): boolean =>
	x < SX - 2 && y > PY - PH - 14 && y < PY + 6;

const rowAt = (x: number, y: number): number =>
	x >= SX && y >= SY ? Math.floor((y - SY) / ROW) : -1;

export const playClicker = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let squish = 0;
	let pops: Pop[] = [];
	let shortFx = 0;
	let boughtFx = 0;
	const buy = (
		s: CkState,
		i: number,
		f: { se: (n: string) => void; say: (t: string) => void },
	) => {
		s.sel = i;
		const it = CK_SHOP[i];
		if (!it) return;
		if (ckBuy(s, i)) {
			f.se("put");
			boughtFx = 0.3;
			f.say(
				it.glove
					? CLICKER_TEXT.glove
					: CLICKER_TEXT.bought.replace("{name}", it.name),
			);
		} else {
			f.se("cancel");
			shortFx = 0.3;
			f.say(CLICKER_TEXT.short);
		}
	};
	const click = (s: CkState, x: number, y: number, se: (n: string) => void) => {
		const n = ckClick(s);
		if (n <= 0) return;
		squish = 1;
		se("bubble");
		pops.push({ x, y, t: 0, s: `+${n}` });
		if (pops.length > 12) pops = pops.slice(-12);
	};
	return playBoard(ctx, "clicker", {
		start: ckStart,
		note: CLICKER_TEXT.note,
		step: (s, f) => {
			for (const e of f.evs) {
				if (isKey(e, "a"))
					click(s, PX + (Math.random() - 0.5) * 30, PY - PH - 2, f.se);
				else if (isKey(e, "up", true)) {
					s.sel = (s.sel + CK_SHOP.length - 1) % CK_SHOP.length;
					f.se("cursor");
				} else if (isKey(e, "down", true)) {
					s.sel = (s.sel + 1) % CK_SHOP.length;
					f.se("cursor");
				} else if (isKey(e, "right")) buy(s, s.sel, f);
				else if (isTap(e)) {
					const [x, y] = e.tap;
					const r = rowAt(x, y);
					if (r >= 0 && r < CK_SHOP.length) buy(s, r, f);
					else if (hitPuyu(x, y)) click(s, x, y - 6, f.se);
				}
			}
			ckStep(s, f.dt);
			squish = Math.max(0, squish - f.dt * 8);
			shortFx = Math.max(0, shortFx - f.dt);
			boughtFx = Math.max(0, boughtFx - f.dt);
			for (const p of pops) p.t += f.dt;
			pops = pops.filter((p) => p.t < 0.7);
		},
		draw: (g, s, clock) => {
			// 部屋の 壁と 床
			g.fillStyle = "#3a2a4a";
			g.fillRect(0, 0, AW, AH);
			g.fillStyle = "#4a3a5a";
			for (let x = 0; x < SX; x += 12) g.fillRect(x, 14, 1, PY - 14);
			g.fillStyle = "#5a4030";
			g.fillRect(0, PY, SX, AH - PY);
			// 手もち
			txt(g, fmt(s.puyu), PX, 18, 16, "#ffe880", "center");
			txt(g, "ぷゆゆ", PX, 35, 8, "#e8d8f0", "center");
			// なで手の 小さな ぷゆゆ（はねる）
			const helpers = s.own.reduce((a, n, i) => a + (i === 0 ? 0 : n), 0);
			const shown = Math.min(helpers, 14);
			for (let i = 0; i < shown; i++) {
				const side = i % 2 === 0 ? -1 : 1;
				const col = Math.floor(i / 2);
				const x = PX + side * (PW / 2 + 6 + (col % 4) * 7);
				const hop = Math.abs(Math.sin(clock * 6 + i * 1.3)) * 4;
				miniPuyu(g, x, PY - (col >= 4 ? 10 : 0) - hop);
			}
			bigPuyu(g, squish, clock);
			// はねる 数
			for (const p of pops) {
				const a = 1 - p.t / 0.7;
				txt(g, p.s, p.x, p.y - p.t * 26, 8, `rgba(255,255,255,${a})`, "center");
			}
			// 毎秒
			txt(
				g,
				`${CLICKER_TEXT.perSec} ${ckRate(s)}　なで ${ckPower(s)}`,
				PX,
				PY + 8,
				8,
				"#f0e0c0",
				"center",
			);
			// 店
			g.fillStyle = "#1a1424";
			g.fillRect(SX - 2, 14, AW - SX + 2, AH - 14);
			CK_SHOP.forEach((it, i) => {
				const y = SY + i * ROW;
				const cost = ckCost(s, i);
				const can = s.puyu >= cost;
				const sel = i === s.sel;
				g.fillStyle = sel
					? shortFx > 0
						? "#6a2030"
						: boughtFx > 0
							? "#3a6a3a"
							: "#3a3460"
					: "#24203a";
				g.fillRect(SX, y, AW - SX - 2, ROW - 2);
				if (sel) {
					g.fillStyle = "#f0c040";
					g.fillRect(SX, y, 2, ROW - 2);
				}
				const ink = can ? "#f4f2ea" : "#8a84a0";
				txt(g, it.name, SX + 5, y + 2, 8, ink);
				txt(g, `${s.own[i] ?? 0}`, AW - 5, y + 2, 8, "#c8c0e0", "right");
				const what = it.glove ? "なで +1" : `毎秒 +${it.rate}`;
				txt(g, what, SX + 5, y + 11, 8, "#a8c8a8");
				txt(
					g,
					fmt(cost),
					AW - 5,
					y + 11,
					8,
					can ? "#ffe880" : "#a06070",
					"right",
				);
			});
			hud(g, `${ckScore(s)}匹`, `${ARCADE_BOARD.time} ${ckTimeLeft(s)}`);
			if (ckTimeLeft(s) <= 5 && s.t < CK.time) {
				g.fillStyle = "#ff7060";
				g.fillRect(0, 13, Math.round((AW * (CK.time - s.t)) / 5), 1);
			}
		},
		over: (s) => s.over,
		score: ckScore,
		end: () => CLICKER_TEXT.timeUp,
	});
};
