// ダーツ の 板（決まりは data/arcade/home/darts.ts）。左に 的、右に のこりの 点・ラウンド・あがりの ねらい。
// A か タップで 横の ゆれを 止め、もう 1回で 縦の ゆれを 止めると 矢が 飛ぶ。

import {
	DT,
	DT_ORDER,
	DT_TEXT,
	type DtState,
	dtCheckout,
	dtScore,
	dtStart,
	dtStep,
} from "../../../data/arcade/home/darts";
import { AH, AW } from "../../../data/arcade/logic";
import { ARCADE, ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import { type G, txt } from "../../neta/netaBoard";
import {
	burst,
	juice,
	juiceDraw,
	juiceStep,
	pop,
	quake,
	shaken,
} from "../arcadeJuice";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

/** 輪の 1こま（扇形の 帯）。a は 上から 右まわりの 度。 */
const band = (
	g: G,
	r0: number,
	r1: number,
	a0: number,
	a1: number,
	ink: string,
): void => {
	const k = Math.PI / 180;
	g.fillStyle = ink;
	g.beginPath();
	g.arc(DT.cx, DT.cy, r1, (a0 - 90) * k, (a1 - 90) * k);
	g.arc(DT.cx, DT.cy, r0, (a1 - 90) * k, (a0 - 90) * k, true);
	g.closePath();
	g.fill();
};

const circle = (g: G, r: number, ink: string): void => {
	g.fillStyle = ink;
	g.beginPath();
	g.arc(DT.cx, DT.cy, r, 0, Math.PI * 2);
	g.fill();
};

const drawBoard = (g: G): void => {
	circle(g, DT.doubleOut + 10, "#1a1a1e");
	DT_ORDER.forEach((n, i) => {
		const a0 = i * 18 - 9;
		const a1 = a0 + 18;
		const dark = i % 2 === 0;
		const single = dark ? "#1c1c1c" : "#e6d8b0";
		const ring = dark ? "#c82828" : "#1a8a3a";
		band(g, DT.doubleIn, DT.doubleOut, a0, a1, ring);
		band(g, DT.tripleOut, DT.doubleIn, a0, a1, single);
		band(g, DT.tripleIn, DT.tripleOut, a0, a1, ring);
		band(g, DT.outer, DT.tripleIn, a0, a1, single);
		// 数字
		const a = ((i * 18 - 90) * Math.PI) / 180;
		const r = DT.doubleOut + 5;
		txt(
			g,
			String(n),
			DT.cx + Math.cos(a) * r,
			DT.cy + Math.sin(a) * r - 3,
			6,
			"#f0f0f0",
			"center",
		);
	});
	circle(g, DT.outer, "#1a8a3a");
	circle(g, DT.bull, "#c82828");
	// 区切りの 針金
	g.strokeStyle = "rgba(200,200,210,0.45)";
	g.lineWidth = 0.4;
	for (const r of [
		DT.doubleOut,
		DT.doubleIn,
		DT.tripleOut,
		DT.tripleIn,
		DT.outer,
	]) {
		g.beginPath();
		g.arc(DT.cx, DT.cy, r, 0, Math.PI * 2);
		g.stroke();
	}
};

/** 刺さった 矢（羽は 右下へ）。 */
const dart = (g: G, x: number, y: number, ink: string): void => {
	g.fillStyle = "#c0c0c8";
	g.fillRect(x, y, 1, 1);
	g.fillRect(x + 1, y + 1, 2, 1);
	g.fillStyle = ink;
	g.fillRect(x + 3, y + 1, 3, 3);
};

const routeText = (s: DtState): string => {
	if (s.phase === "between" || s.over) return DT_TEXT.none;
	return dtCheckout(s.remain, DT.darts - s.hits.length).join(" ");
};

export const playDarts = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	const j = juice();
	return playBoard(ctx, "darts", {
		start: dtStart,
		step: (s, f) => {
			const press = f.evs.some((e) => isKey(e, "a") || isTap(e));
			const n0 = s.hits.length;
			for (const e of dtStep(s, f.dt, press, rnd)) {
				if (e === "stopX") f.se("cursor");
				else if (e === "throw") f.se("throw");
				else if (e === "hit" || e === "out") {
					const h = s.hits[n0] ?? s.hits[s.hits.length - 1];
					if (!h) continue;
					const x = DT.cx + h.x;
					const y = DT.cy + h.y;
					if (e === "hit") {
						const big = h.pts >= 40;
						f.se(big ? "critical" : "hit_steel");
						burst(j, x, y, big ? "#ffe060" : "#f0f0f0", big ? 10 : 5, 40);
						pop(j, x, y - 6, `${h.label} ${h.pts}`);
						if (big) quake(j, 1.5);
					} else {
						f.se("enemyMiss");
						pop(j, x, y - 6, DT_TEXT.out, "#a0a0b0");
					}
				} else if (e === "bust") {
					f.se("miss");
					quake(j, 3);
					f.say(DT_TEXT.bust);
				} else if (e === "finish") {
					f.se("levelup");
					j.flash = 0.3;
					f.say(DT_TEXT.finish);
				} else if (e === "round")
					f.say(DT_TEXT.nextRound.replace("{n}", String(s.round)));
			}
			juiceStep(j, f.dt);
		},
		draw: (g, s, clock) => {
			g.fillStyle = "#20242c";
			g.fillRect(0, 0, AW, AH);
			shaken(g, j, () => {
				drawBoard(g);
				for (const h of s.hits)
					dart(g, Math.round(DT.cx + h.x), Math.round(DT.cy + h.y), "#3a7ae0");
				// 飛んでいる 矢（右下から）
				if (s.phase === "fly") {
					const k = 1 - Math.max(0, s.timer) / DT.fly;
					const x = DT.cx + s.fx + (1 - k) * 60;
					const y = DT.cy + s.fy + (1 - k) * 50;
					dart(g, Math.round(x), Math.round(y), "#3a7ae0");
				}
				// 照準
				if (s.phase === "x" || s.phase === "y") {
					const x = DT.cx + s.ax;
					const y = DT.cy + s.ay;
					g.fillStyle = "rgba(255,255,255,0.25)";
					if (s.phase === "x")
						g.fillRect(DT.cx - DT.sway, DT.cy, DT.sway * 2, 1);
					else g.fillRect(x, DT.cy - DT.sway, 1, DT.sway * 2);
					const blink = Math.floor(clock * 6) % 2 === 0 ? "#ffffff" : "#ff5050";
					g.strokeStyle = blink;
					g.lineWidth = 0.7;
					g.beginPath();
					g.arc(x, y, 3.5, 0, Math.PI * 2);
					g.moveTo(x - 6, y);
					g.lineTo(x + 6, y);
					g.moveTo(x, y - 6);
					g.lineTo(x, y + 6);
					g.stroke();
				}
			});
			// 右の 欄
			const px = 160;
			txt(g, DT_TEXT.left, px, 20, 7, "#a0a8b8");
			txt(
				g,
				String(s.remain),
				196,
				28,
				16,
				s.bust ? "#ff6060" : "#ffffff",
				"center",
			);
			txt(g, `${DT_TEXT.round} ${s.round}/${DT.rounds}`, px, 50, 8, "#e8e8f0");
			for (let i = 0; i < DT.darts; i++) {
				const used = i < s.hits.length;
				g.fillStyle = used ? "#3a3a48" : "#3a7ae0";
				g.fillRect(px + 44 + i * 10, 52, 6, 3);
			}
			s.hits.forEach((h, i) => {
				txt(
					g,
					h.label,
					px + 2,
					64 + i * 10,
					8,
					h.pts > 0 ? "#f0e0a0" : "#808090",
				);
				txt(g, String(h.pts), 234, 64 + i * 10, 8, "#f0e0a0", "right");
			});
			if (s.bust) txt(g, DT_TEXT.bust, 196, 96, 8, "#ff6060", "center");
			txt(g, DT_TEXT.aim, px, 110, 7, "#a0a8b8");
			txt(g, routeText(s), 196, 122, 8, "#80e0ff", "center");
			juiceDraw(g, j, AW, AH);
			hud(
				g,
				`${ARCADE_BOARD.score} ${dtScore(s)}`,
				`${DT_TEXT.round} ${s.round}`,
			);
		},
		over: (s) => s.over,
		score: dtScore,
		end: (s) => (s.finished ? ARCADE.clear : ARCADE.over),
	});
};
