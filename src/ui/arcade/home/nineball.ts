// ナインボール の 板（決まりは data/arcade/home/nineball.ts）。左に 上から 見た 台、右に 力の 目もりと「打つ」。
// ←→ で 向きを 回す（押しっぱなしは だんだん 速く）、↑↓ は 細かく。A で 力を ためはじめ、もう 1回 A で 打つ。
// タップは 台の 上なら その 点へ 向ける、右の「打つ」で ためはじめる・打つ。
// ねらいの 線は はじめに 当たる 所まで 点線で、当たる 所に ゴーストの 球と、当たった 球の 進む 向き。

import {
	NB,
	NB_HEAD,
	NB_POCKETS,
	NB_TEXT,
	type NbBall,
	nbGuide,
	nbLowest,
	nbScore,
	nbStart,
	nbStep,
} from "../../../data/arcade/home/nineball";
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
import { type ArcadeResult, hud, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

/** 球の 色（9番は 白に 帯）。 */
const INK: readonly string[] = [
	"#f4f2ea",
	"#f0c020",
	"#2050d0",
	"#d02828",
	"#6a2a9a",
	"#f07a20",
	"#1a8a3a",
	"#7a1a1a",
	"#141418",
	"#f0c020",
];

/** 右の 欄（力の 目もりと「打つ」）。 */
const PANEL = { x: 208, gaugeTop: 34, gaugeBot: 112, btnTop: 120 } as const;

const disc = (g: G, x: number, y: number, r: number, ink: string): void => {
	g.fillStyle = ink;
	g.beginPath();
	g.arc(x, y, r, 0, Math.PI * 2);
	g.fill();
};

const drawBall = (g: G, b: NbBall): void => {
	if (b.n === 9) {
		disc(g, b.x, b.y, NB.r, "#f4f2ea");
		g.fillStyle = INK[9] as string;
		g.fillRect(b.x - NB.r + 0.5, b.y - 1.2, NB.r * 2 - 1, 2.4);
	} else disc(g, b.x, b.y, NB.r, INK[b.n] as string);
	g.fillStyle = "rgba(255,255,255,0.6)";
	g.fillRect(b.x - 1.5, b.y - 1.5, 1, 1);
};

/** 点線。 */
const dotted = (
	g: G,
	ax: number,
	ay: number,
	bx: number,
	by: number,
	ink: string,
): void => {
	const n = Math.floor(Math.hypot(bx - ax, by - ay) / 3);
	g.fillStyle = ink;
	for (let i = 1; i <= n; i += 1) {
		if (i % 2) continue;
		const x = ax + ((bx - ax) * i) / n;
		const y = ay + ((by - ay) * i) / n;
		g.fillRect(x - 0.5, y - 0.5, 1, 1);
	}
};

export const playNineball = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	const j = juice();
	/** ←→ を 押しつづけた こま数（くり返しで ふえる）。 */
	let hold = 0;
	let lastDir = 0;
	return playBoard(ctx, "nineball", {
		start: () => nbStart(rnd),
		step: (s, f) => {
			let rot = 0;
			let aimAt: readonly [number, number] | null = null;
			let press = false;
			for (const e of f.evs) {
				if ("k" in e) {
					if (e.k === "left" || e.k === "right") {
						const dir = e.k === "left" ? -1 : 1;
						hold = e.repeat && dir === lastDir ? hold + 1 : 0;
						lastDir = dir;
						const deg = Math.min(4, 0.6 + hold * 0.25);
						rot += (dir * deg * Math.PI) / 180;
					} else if (e.k === "up" || e.k === "down")
						rot += ((e.k === "up" ? -1 : 1) * 0.15 * Math.PI) / 180;
					else if (e.k === "a") press = true;
				} else if (isTap(e)) {
					if (e.tap[0] >= PANEL.x - 1) press = true;
					else aimAt = e.tap;
				}
			}
			const before = s.balls.map((b) => b.in);
			const rack = s.rack;
			const pts0 = s.points;
			const msgT0 = s.msgT;
			const evs = nbStep(s, f.dt, { rot, aimAt, press }, rnd);
			const seen = new Set(evs);
			if (seen.has("power")) f.se("cursor");
			if (seen.has("shot")) f.se("arcShot");
			if (seen.has("clack")) f.se("arcBlock");
			if (seen.has("pocket")) {
				f.se("item");
				s.balls.forEach((b, i) => {
					if (!b.in || before[i]) return;
					burst(j, b.x, b.y, INK[b.n] as string, 6, 40);
				});
			}
			if (seen.has("foul")) {
				f.se("miss");
				quake(j, 2);
			}
			if (s.points > pts0) pop(j, 104, 60, `+${s.points - pts0}`);
			if (seen.has("nine")) {
				f.se("levelup");
				j.flash = 0.25;
			}
			if (s.rack !== rack && !s.over) f.say(NB_TEXT.next);
			if (s.msgT > msgT0) f.say(s.msg);
			juiceStep(j, f.dt);
		},
		draw: (g, s, clock) => {
			g.fillStyle = "#16161e";
			g.fillRect(0, 0, AW, AH);
			shaken(g, j, () => {
				// 木の わく と ラシャ
				g.fillStyle = "#5a3418";
				g.fillRect(2, 16, 204, 132);
				g.fillStyle = "#7a4a24";
				g.fillRect(2, 16, 204, 2);
				g.fillStyle = "#1f6b3a";
				g.fillRect(NB.left, NB.top, NB.right - NB.left, NB.bottom - NB.top);
				g.fillStyle = "#1a5c32";
				g.fillRect(NB.left, NB.top, NB.right - NB.left, 2);
				// ポイント（わくの 白い 点）
				g.fillStyle = "#e8dcc0";
				for (let i = 1; i < 8; i++) {
					if (i === 4) continue;
					const x = NB.left + ((NB.right - NB.left) * i) / 8;
					g.fillRect(x - 0.5, 20, 1, 1);
					g.fillRect(x - 0.5, 143, 1, 1);
				}
				for (let i = 1; i < 4; i++) {
					const y = NB.top + ((NB.bottom - NB.top) * i) / 4;
					g.fillRect(6, y - 0.5, 1, 1);
					g.fillRect(201, y - 0.5, 1, 1);
				}
				// ヘッドライン（手玉が もどる 所）
				g.fillStyle = "rgba(255,255,255,0.12)";
				for (let y = NB.top + 2; y < NB.bottom; y += 4)
					g.fillRect(NB_HEAD[0], y, 1, 2);
				g.fillRect(NB_HEAD[0] - 1, NB_HEAD[1], 3, 1);
				// ポケット
				for (const p of NB_POCKETS) disc(g, p.x, p.y, p.r - 0.5, "#08080a");
				// 球
				for (const b of s.balls) if (!b.in) drawBall(g, b);
				// 次に 当てる 球（光る 輪）
				const low = nbLowest(s);
				const lb = s.balls[low];
				if (
					lb &&
					!lb.in &&
					s.phase !== "roll" &&
					Math.floor(clock * 3) % 2 === 0
				) {
					g.strokeStyle = "#ffffff";
					g.lineWidth = 0.6;
					g.beginPath();
					g.arc(lb.x, lb.y, NB.r + 1.5, 0, Math.PI * 2);
					g.stroke();
				}
				// ねらい
				const c = s.balls[0] as NbBall;
				if (s.phase !== "roll" && !s.over && !c.in) {
					const gd = nbGuide(s);
					const okHit = gd.ball === null || gd.ball === low;
					dotted(g, c.x, c.y, gd.x, gd.y, "#f4f2ea");
					g.strokeStyle = okHit ? "rgba(255,255,255,0.8)" : "#ff6060";
					g.lineWidth = 0.6;
					g.beginPath();
					g.arc(gd.x, gd.y, NB.r, 0, Math.PI * 2);
					g.stroke();
					if (gd.ball !== null) {
						const tb = s.balls[gd.ball] as NbBall;
						dotted(
							g,
							tb.x,
							tb.y,
							tb.x + gd.nx * 18,
							tb.y + gd.ny * 18,
							okHit ? "#80e0ff" : "#ff6060",
						);
					}
					// キュー（ためると 引く）
					const back = 5 + (s.phase === "power" ? s.power * 10 : 0);
					const ux = Math.cos(s.aim);
					const uy = Math.sin(s.aim);
					g.strokeStyle = "#d8b070";
					g.lineWidth = 1.6;
					g.beginPath();
					g.moveTo(c.x - ux * back, c.y - uy * back);
					g.lineTo(c.x - ux * (back + 48), c.y - uy * (back + 48));
					g.stroke();
					g.strokeStyle = "#3a5aa0";
					g.beginPath();
					g.moveTo(c.x - ux * back, c.y - uy * back);
					g.lineTo(c.x - ux * (back + 2), c.y - uy * (back + 2));
					g.stroke();
				}
			});
			// 右の 欄
			const px = PANEL.x;
			txt(g, NB_TEXT.power, px + 15, 22, 7, "#e8e8f0", "center");
			g.fillStyle = "#2a2a36";
			g.fillRect(px + 9, PANEL.gaugeTop, 12, PANEL.gaugeBot - PANEL.gaugeTop);
			const pw = s.phase === "power" ? s.power : 0;
			const gh = Math.round((PANEL.gaugeBot - PANEL.gaugeTop - 2) * pw);
			g.fillStyle = pw > 0.85 ? "#ff5040" : pw > 0.5 ? "#f0a030" : "#40c060";
			g.fillRect(px + 10, PANEL.gaugeBot - 1 - gh, 10, gh);
			const on = s.phase === "power";
			g.fillStyle = on ? "#c03030" : s.phase === "aim" ? "#3a6ad0" : "#3a3a48";
			g.fillRect(px + 1, PANEL.btnTop, 28, 24);
			txt(g, NB_TEXT.shoot, px + 15, PANEL.btnTop + 8, 8, "#ffffff", "center");
			juiceDraw(g, j, AW, AH);
			if (s.msgT > 0) {
				g.fillStyle = "rgba(0,0,0,0.65)";
				g.fillRect(14, 120, 180, 13);
				txt(g, s.msg, 104, 122, 8, "#ffe060", "center");
			}
			hud(
				g,
				`${ARCADE_BOARD.score} ${nbScore(s)}`,
				`${NB_TEXT.rack} ${Math.min(NB.racks, s.rack + 1)}/${NB.racks}　${s.shotsLeft}${NB_TEXT.shots}`,
			);
		},
		over: (s) => s.over,
		score: nbScore,
		end: (s) => (s.cleared ? ARCADE.clear : ARCADE.over),
	});
};
