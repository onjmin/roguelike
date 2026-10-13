// 保守ピンボール の 板（決まりは data/arcade/home/pinball.ts）。2ch の 板の 色（灰白の 地・緑の 名前・赤い スレタイ）。
// ← で 左の フリッパー、→ で 右、A・↑ で 両方。タップは 左半分で 左・右半分で 右。
// 押しっぱなしは くり返しで 届くので、とぎれる まで 上げた まま にする。

import {
	PB,
	PB_TEXT,
	PB_WALLS,
	pbFlipper,
	pbScore,
	pbStart,
	pbStep,
} from "../../../data/arcade/home/pinball";
import { AH, AW } from "../../../data/arcade/logic";
import { ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import type { G } from "../../neta/netaBoard";
import { txt } from "../../neta/netaBoard";
import { type ArcadeResult, hud, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

/** 太い 線（四角を 並べる）。 */
const line = (
	g: G,
	ax: number,
	ay: number,
	bx: number,
	by: number,
	w: number,
	ink: string,
): void => {
	g.fillStyle = ink;
	const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
	for (let i = 0; i <= n; i++) {
		const x = ax + ((bx - ax) * i) / n;
		const y = ay + ((by - ay) * i) / n;
		g.fillRect(Math.round(x - w / 2), Math.round(y - w / 2), w, w);
	}
};

const disc = (g: G, x: number, y: number, r: number, ink: string): void => {
	g.fillStyle = ink;
	for (let dy = -r; dy <= r; dy++) {
		const w = Math.round(Math.sqrt(r * r - dy * dy));
		g.fillRect(Math.round(x - w), Math.round(y + dy), w * 2 + 1, 1);
	}
};

/** 坂の 下（台の 外）を ぬる。 */
const corner = (g: G, side: "l" | "r"): void => {
	const wx = side === "l" ? PB.left : PB.right;
	const [px, py] = side === "l" ? PB.pivotL : PB.pivotR;
	g.beginPath();
	g.moveTo(wx, 112);
	g.lineTo(px, py);
	g.lineTo(px, AH);
	g.lineTo(wx, AH);
	g.closePath();
	g.fill();
};

export const playPinball = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let lHeld = 0;
	let rHeld = 0;
	return playBoard(ctx, "pinball", {
		start: pbStart,
		step: (s, f) => {
			for (const e of f.evs) {
				if ("k" in e) {
					// はじめの 1回は くり返しが 来るまで 長めに 持つ
					const h = e.repeat ? 0.15 : 0.4;
					if (e.k === "left") lHeld = h;
					else if (e.k === "right") rHeld = h;
					else if (e.k === "a" || e.k === "up") {
						lHeld = h;
						rHeld = h;
					}
				} else if (isTap(e)) {
					if (e.tap[0] < AW / 2) lHeld = 0.25;
					else rHeld = 0.25;
				}
			}
			lHeld = Math.max(0, lHeld - f.dt);
			rHeld = Math.max(0, rHeld - f.dt);
			for (const e of pbStep(
				s,
				f.dt,
				{ left: lHeld > 0, right: rHeld > 0 },
				rnd,
			)) {
				if (e === "flip") f.se("swing_fist");
				else if (e === "hoshu") f.se("arcCoin");
				else if (e === "age") f.se("arcBlock");
				else if (e === "anka") f.se("cardFlip");
				else if (e === "tate") f.se("levelup");
				else if (e === "lane") f.se("jingle");
				else if (e === "launch") f.se("arcShot");
				else if (e === "drain") f.se("arcCrash");
			}
		},
		draw: (g, s, clock) => {
			// 外と 台（灰白の 地）
			g.fillStyle = "#24242e";
			g.fillRect(0, 0, AW, AH);
			g.fillStyle = "#efefef";
			g.beginPath();
			g.moveTo(PB.left, 40);
			g.lineTo(88, 16);
			g.lineTo(152, 16);
			g.lineTo(PB.right, 40);
			g.lineTo(PB.right, AH);
			g.lineTo(PB.left, AH);
			g.closePath();
			g.fill();
			// 地の レスの 罫（うすい 横線）
			g.fillStyle = "#e0e0e6";
			for (let y = 46; y < 124; y += 10) g.fillRect(PB.left + 6, y, 100, 1);
			g.fillStyle = "#3a3a46";
			corner(g, "l");
			corner(g, "r");
			// 壁（緑）。さいごの 1本は「次スレ」レーンの ふた（赤）
			PB_WALLS.forEach(([ax, ay, bx, by], i) => {
				const lid = i === PB_WALLS.length - 1;
				line(g, ax, ay, bx, by, lid ? 3 : 2, lid ? "#cc2020" : "#228822");
			});
			// 「次スレ」レーン
			const [p0, p1] = PB.posts;
			g.fillStyle = "#cc2020";
			g.fillRect(p0.x - 1, 28, 2, p0.y - 28);
			g.fillRect(p1.x - 1, 28, 2, p1.y - 28);
			disc(g, p0.x, p0.y, p0.r, "#cc2020");
			disc(g, p1.x, p1.y, p1.r, "#cc2020");
			const laneHot = s.laneCd > 0;
			txt(
				g,
				PB_TEXT.lane,
				120,
				18,
				7,
				laneHot ? "#ff4040" : "#cc2020",
				"center",
			);
			// バンパー（保守・age・sage）
			PB.bumpers.forEach((b, i) => {
				const hit = s.flash[i] > 0;
				disc(g, b.x, b.y, b.r + 1, "#14551c");
				disc(g, b.x, b.y, b.r, hit ? "#ffe060" : "#228822");
				if (i === 0)
					txt(
						g,
						b.label,
						b.x,
						b.y - 4,
						7,
						hit ? "#14551c" : "#ffffff",
						"center",
					);
				else txt(g, b.label, b.x, b.y + b.r + 2, 7, "#228822", "center");
			});
			// 「安価」の 的（点いた ものは 青い 安価の 色）
			PB.anka.forEach(([y0, y1], i) => {
				const hit = s.flash[3 + i] > 0;
				g.fillStyle = hit ? "#ffe060" : s.lit[i] ? "#2040e0" : "#a0a0b0";
				g.fillRect(PB.ankaX - 1, y0, 3, y1 - y0);
			});
			txt(g, PB_TEXT.anka, PB.left - 4, 66, 7, "#8090ff", "right");
			// フリッパー
			for (const [side, a] of [
				["l", s.fl],
				["r", s.fr],
			] as const) {
				const [ax, ay, bx, by] = pbFlipper(side, a);
				line(g, ax, ay, bx, by, 4, "#14551c");
				line(g, ax, ay, bx, by, 2, "#40b040");
			}
			// 球
			if (s.wait <= 0 && !s.over) {
				disc(g, s.x, s.y, PB.r, "#404050");
				g.fillStyle = "#c0c0d0";
				g.fillRect(Math.round(s.x - 1), Math.round(s.y - 2), 1, 1);
			}
			// 字
			if (s.msgT > 0) {
				const bob = Math.round(Math.sin(clock * 12));
				g.fillStyle = "rgba(0,0,0,0.65)";
				g.fillRect(AW / 2 - 40, 90 + bob, 80, 13);
				txt(g, s.msg, AW / 2, 92 + bob, 8, "#ffe060", "center");
			}
			// のこりの 球（右の 外）
			txt(g, PB_TEXT.balls, PB.right + 8, 50, 8, "#e8e8f0");
			for (let i = 0; i < PB.balls; i++)
				disc(
					g,
					PB.right + 12 + i * 8,
					66,
					2,
					i < s.balls ? "#c8ccd8" : "#3a3a48",
				);
			hud(
				g,
				`${ARCADE_BOARD.score} ${pbScore(s)}`,
				`${PB_TEXT.balls} ${Math.max(0, s.balls)}`,
			);
		},
		over: (s) => s.over,
		score: pbScore,
	});
};
