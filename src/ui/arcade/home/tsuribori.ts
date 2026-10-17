// おんJ釣り堀 の 板（決まりは data/arcade/home/tsuribori.ts）。横から 見た 釣り堀。左の 岸に キリコ。
// A／タップ：力を ためる → 投げる → 浮きが 沈んだら 合わせる → 押しつづけて（くり返し・つづけて タップ）巻く。
// 右上に 釣果、引きあいの あいだは 上に 糸の はりの 目もり。

import {
	TB,
	TB_KIND,
	TB_TEXT,
	type TbState,
	tbScore,
	tbStart,
	tbStep,
	tbTimeLeft,
} from "../../../data/arcade/home/tsuribori";
import { AH, AW } from "../../../data/arcade/logic";
import { ARCADE_BOARD } from "../../../data/arcade/text";
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

/** 竿先。 */
const TIP = [36, 26] as const;

/** 浮きの 高さ（投げて いる あいだは 弧を えがく）。 */
const floatY = (s: TbState, clock: number): number => {
	if (s.phase === "cast") {
		const k = Math.min(1, s.timer / TB.castSec);
		return TIP[1] + (TB.waterY - 3 - TIP[1]) * k - Math.sin(k * Math.PI) * 34;
	}
	if (s.phase === "ready" || s.phase === "power") return TIP[1] + 14;
	const bob = s.phase === "wait" ? Math.sin(clock * 2.4) * 0.6 : 0;
	return TB.waterY - 3 + s.sink * 7 + bob;
};

const ripple = (g: G, x: number, r: number, a: number): void => {
	g.strokeStyle = `rgba(220,240,255,${a})`;
	g.lineWidth = 0.6;
	g.beginPath();
	g.ellipse(x, TB.waterY, r, r * 0.25, 0, 0, Math.PI * 2);
	g.stroke();
};

/** 水の 中の 影（引きあいの 魚）。 */
const shadow = (g: G, s: TbState, clock: number): void => {
	const k = TB_KIND[s.kind];
	const len = k.size[1] === 0 ? 8 : 6 + s.cm / 6;
	const y = TB.waterY + 14 + Math.sin(clock * 3) * 2;
	const wig = Math.sin(clock * (s.run > 0 ? 18 : 6)) * 1.5;
	g.fillStyle =
		s.kind === "gold" ? "rgba(255,210,80,0.55)" : "rgba(10,20,30,0.5)";
	g.beginPath();
	g.ellipse(
		s.fx + len * 0.3,
		y,
		len / 2,
		len / 6 + 1,
		wig * 0.05,
		0,
		Math.PI * 2,
	);
	g.fill();
	g.fillRect(s.fx + len * 0.75, y - 2 + wig, 3, 4);
};

export const playTsuribori = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	const j = juice();
	/** 巻いて いる のこり 秒（くり返しで のびる）。 */
	let held = 0;
	let rip = 0;
	return playBoard(ctx, "tsuribori", {
		start: tbStart,
		step: (s, f) => {
			let press = false;
			for (const e of f.evs) {
				if ("k" in e && e.k === "a") {
					if (!e.repeat) press = true;
					held = Math.max(held, e.repeat ? 0.15 : 0.4);
				} else if (isTap(e)) {
					press = true;
					held = Math.max(held, 0.28);
				}
			}
			held = Math.max(0, held - f.dt);
			const n0 = s.catches.length;
			for (const e of tbStep(s, f.dt, { press, reel: held > 0 }, rnd)) {
				if (e === "power") f.se("cursor");
				else if (e === "cast") f.se("throw");
				else if (e === "land") {
					f.se("bubble");
					rip = 1;
				} else if (e === "nibble") rip = 0.6;
				else if (e === "bite") {
					f.se("decide");
					rip = 1;
					f.say(TB_TEXT.bite);
				} else if (e === "hook") {
					f.se("hit_fist");
					quake(j, 2);
					f.say(TB_TEXT.hook);
				} else if (e === "run") f.se("swing_fist");
				else if (e === "early" || e === "late" || e === "escape") {
					f.se("enemyMiss");
					f.say(s.msg);
				} else if (e === "snap") {
					f.se("breakTool");
					quake(j, 3);
					f.say(s.msg);
				} else if (e === "catch") {
					const c = s.catches[n0];
					const big = c && (c.kind === "gold" || c.pts >= 100);
					f.se(big ? "caught" : "item");
					if (c) {
						pop(j, TB.shoreX + 30, TB.waterY - 14, `+${c.pts}`);
						burst(
							j,
							TB.shoreX + 10,
							TB.waterY,
							c.kind === "gold" ? "#ffd040" : "#c8e8ff",
							10,
							50,
						);
					}
					if (c?.kind === "gold") j.flash = 0.3;
					f.say(s.msg);
				}
			}
			if (s.phase === "fight" && s.t >= TB.time) f.say(TB_TEXT.last);
			rip = Math.max(0, rip - f.dt * 1.2);
			juiceStep(j, f.dt);
		},
		draw: (g, s, clock) => {
			shaken(g, j, () => {
				// 空・向こう岸・水
				g.fillStyle = "#9ccff0";
				g.fillRect(0, 14, AW, TB.waterY - 14);
				g.fillStyle = "#4a8a4a";
				g.fillRect(0, TB.waterY - 8, AW, 8);
				g.fillStyle = "#3a7040";
				for (let x = 40; x < AW; x += 22)
					g.fillRect(x, TB.waterY - 13 - (x % 3) * 2, 10, 6);
				g.fillStyle = "#2c6a88";
				g.fillRect(0, TB.waterY, AW, AH - TB.waterY);
				g.fillStyle = "#245a76";
				g.fillRect(0, TB.waterY + 30, AW, AH - TB.waterY - 30);
				g.fillStyle = "#1c4a62";
				g.fillRect(0, TB.waterY + 66, AW, AH - TB.waterY - 66);
				// 水面の きらめき
				g.fillStyle = "rgba(255,255,255,0.35)";
				for (let i = 0; i < 9; i++) {
					const x = (i * 29 + clock * 6) % AW;
					g.fillRect(x, TB.waterY + 2 + (i % 3) * 3, 5, 1);
				}
				// 岸（板の 足場）
				g.fillStyle = "#6a4a2a";
				g.fillRect(0, 44, TB.shoreX - 6, AH - 44);
				g.fillStyle = "#8a6238";
				g.fillRect(0, 44, TB.shoreX - 6, 2);
				// キリコ（すわって 竿を もつ）
				g.fillStyle = "#e8c8a8";
				g.fillRect(12, 26, 6, 6);
				g.fillStyle = "#3a3a5a";
				g.fillRect(11, 23, 8, 3);
				g.fillStyle = "#d84a4a";
				g.fillRect(11, 32, 8, 8);
				g.fillStyle = "#2a2a3a";
				g.fillRect(11, 40, 10, 4);
				// クーラー
				g.fillStyle = "#e8e8f0";
				g.fillRect(2, 36, 8, 8);
				g.fillStyle = "#3a7ae0";
				g.fillRect(2, 36, 8, 2);
				// 竿（引きあいで しなる）
				const bend = s.phase === "fight" ? 3 + s.tension * 6 : 0;
				const tx = TIP[0];
				const ty = TIP[1] + bend;
				g.strokeStyle = "#5a3a1a";
				g.lineWidth = 1;
				g.beginPath();
				g.moveTo(18, 36);
				g.quadraticCurveTo(28, 26, tx, ty);
				g.stroke();
				// 糸と 浮き
				const fy = floatY(s, clock);
				g.strokeStyle =
					s.phase === "fight" && s.tension > 0.8
						? "#ff8080"
						: "rgba(255,255,255,0.8)";
				g.lineWidth = 0.5;
				g.beginPath();
				g.moveTo(tx, ty);
				const sag = s.phase === "fight" ? (1 - s.tension) * 10 : 8;
				g.quadraticCurveTo((tx + s.fx) / 2, Math.max(ty, fy) + sag, s.fx, fy);
				g.stroke();
				if (s.phase === "fight") shadow(g, s, clock);
				else if (s.phase !== "result") {
					// 沈みが 深いと 赤い 頭だけ
					g.fillStyle = "#e83030";
					g.fillRect(s.fx - 1, fy - 3, 3, 3);
					if (s.sink < 0.8) {
						g.fillStyle = "#f4f4f4";
						g.fillRect(s.fx - 1, fy, 3, 3);
					}
					// 水の 下は 青く かぶせる
					if (fy > TB.waterY - 4) {
						g.fillStyle = "rgba(44,106,136,0.7)";
						g.fillRect(s.fx - 2, TB.waterY, 5, 8);
					}
				}
				if (rip > 0) {
					ripple(g, s.fx, 3 + (1 - rip) * 12, rip * 0.8);
					ripple(g, s.fx, 1 + (1 - rip) * 6, rip * 0.6);
				}
			});
			// 力の 目もり（岸の 上）
			if (s.phase === "power") {
				g.fillStyle = "#1a1a24";
				g.fillRect(40, 18, 62, 7);
				g.fillStyle = s.power > 0.8 ? "#ff6040" : "#40c060";
				g.fillRect(41, 19, Math.round(60 * s.power), 5);
				txt(g, TB_TEXT.power, 104, 17, 7, "#1a1a24");
			}
			// 糸の はり
			if (s.phase === "fight") {
				const t = Math.min(1, s.tension);
				g.fillStyle = "#1a1a24";
				g.fillRect(40, 18, 82, 8);
				g.fillStyle =
					t > 0.8
						? "#ff4040"
						: t < TB.slack
							? "#808090"
							: t > 0.55
								? "#f0a030"
								: "#40c060";
				g.fillRect(41, 19, Math.round(80 * t), 6);
				g.fillStyle = "#ff4040";
				g.fillRect(41 + 64, 18, 1, 8);
				txt(g, TB_TEXT.tension, 124, 18, 7, "#1a1a24");
			}
			// 釣果（右上）
			g.fillStyle = "rgba(10,20,30,0.55)";
			g.fillRect(150, 16, 88, 34);
			txt(g, `${TB_TEXT.log} ${s.catches.length}`, 154, 17, 7, "#f0e0a0");
			s.catches.slice(-3).forEach((c, i) => {
				const k = TB_KIND[c.kind];
				const name =
					c.cm > 0
						? `${k.name.replace("　", "")} ${c.cm}${TB_TEXT.cm}`
						: k.name;
				txt(
					g,
					name,
					154,
					26 + i * 8,
					7,
					c.kind === "gold" ? "#ffd040" : "#e8e8f0",
				);
				txt(g, String(c.pts), 235, 26 + i * 8, 7, "#e8e8f0", "right");
			});
			juiceDraw(g, j, AW, AH);
			hud(
				g,
				`${ARCADE_BOARD.score} ${tbScore(s)}`,
				`${ARCADE_BOARD.time} ${Math.ceil(tbTimeLeft(s))}`,
			);
		},
		over: (s) => s.over,
		score: tbScore,
	});
};
