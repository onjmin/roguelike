// ゲームセンターの 筐体の 板（動かして よける・撃つ 台）。決まりは data/arcade/logic.ts、文は data/arcade/text.ts。
// - シューティング「荒らし撃退」：←→ で 動く（くり返しで 進む）、A で 撃つ（押しっぱなしで 連射）。タップは その 横位置へ 動いて 撃つ。
// - ブロックくずし「スレ崩し」：←→ で 板を 動かす、A で 球を 打つ。タップは その 横位置へ（球が のって いれば 打つ）。
// 点が 入ると 数字が 浮かび、粒が はじける。ぶつかると 画面が ゆれる（ui/arcade/arcadeJuice.ts）。
// 見た目の 乱数は Math.random（冒険の 乱数に さわらない）。

import {
	AH,
	ATOP,
	AW,
	BK,
	BK_CAP,
	bkRect,
	bkStart,
	bkStep,
	SH,
	SH_KIND,
	shMult,
	shStart,
	shStep,
} from "../../data/arcade/logic";
import { ARCADE, ARCADE_BOARD } from "../../data/arcade/text";
import type { UiCtx } from "../list";
import type { G } from "../neta/netaBoard";
import { txt } from "../neta/netaBoard";
import { fill } from "../village/villageTalk";
import {
	burst,
	juice,
	juiceDraw,
	juiceStep,
	pop,
	quake,
	shaken,
} from "./arcadeJuice";
import {
	type ArcadeResult,
	chip,
	hud,
	isKey,
	isTap,
	playBoard,
} from "./arcadeKit";

const rnd = Math.random;

/** 小さな キリコ（上から 見た 自機・横から 見た 走る 姿）。 */
const kiriko = (
	g: G,
	x: number,
	y: number,
	step = 0,
	cloth = "#4060c0",
): void => {
	const X = Math.round(x);
	const Y = Math.round(y);
	g.fillStyle = "#7a3a20"; // 髪
	g.fillRect(X - 4, Y - 7, 8, 4);
	g.fillStyle = "#f2d0a8"; // 顔
	g.fillRect(X - 3, Y - 4, 6, 4);
	g.fillStyle = cloth; // 服
	g.fillRect(X - 4, Y, 8, 4);
	g.fillStyle = "#303040"; // 足
	g.fillRect(X - 3 + (step ? 1 : 0), Y + 4, 2, 3);
	g.fillRect(X + 1 - (step ? 1 : 0), Y + 4, 2, 3);
};

// ───────────────── シューティング ─────────────────

const SH_INK: Record<string, string> = {
	are: "#c03030",
	aori: "#d04080",
	kopipe: "#3a9a8a",
};

export const playShooter = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	const j = juice();
	return playBoard(ctx, "shooter", {
		start: shStart,
		step: (s, f) => {
			juiceStep(j, f.dt);
			let fire = false;
			let target: number | undefined;
			for (const e of f.evs) {
				if (isKey(e, "left", true)) target = (target ?? s.target) - 16;
				else if (isKey(e, "right", true)) target = (target ?? s.target) + 16;
				else if (isKey(e, "a", true)) fire = true;
				else if (isTap(e)) {
					target = e.tap[0];
					fire = true;
				}
			}
			const boss = s.boss;
			for (const e of shStep(s, f.dt, { target, fire }, rnd)) {
				if (e === "shot") f.se("arcShot");
				else if (e === "hit" || e === "bossHit") f.se("hit_fist");
				else if (e === "kill") f.se("arcBlock");
				else if (e === "mult") {
					f.se("decide");
					f.say(fill(ARCADE_BOARD.shMult, { n: shMult(s) }));
				} else if (e === "power") {
					f.se("rustproof");
					f.say(ARCADE_BOARD.shPower);
				} else if (e === "boss") {
					f.se("encounter");
					f.say(ARCADE_BOARD.shBoss);
					quake(j, 3);
				} else if (e === "bossDown") {
					f.se("explosion");
					f.say(ARCADE_BOARD.shBossDown);
					quake(j, 6);
					j.flash = 0.3;
					f.hitStop(100);
					if (boss) burst(j, boss.x, SH.bossY, "#e080ff", 24, 90);
				} else if (e === "hurt" || e === "breach") {
					f.se("arcCrash");
					f.say("");
					quake(j, 4);
					j.flash = 0.12;
				}
			}
			for (const p of s.pops) {
				pop(j, p.x, p.y, `+${p.pts}`);
				burst(j, p.x, p.y, "#ffb060", 6);
			}
		},
		draw: (g, s, clock) => {
			shaken(g, j, () => {
				g.fillStyle = "#0a0a1c";
				g.fillRect(0, 0, AW, AH);
				// 星（流れる）
				g.fillStyle = "#3a3a5a";
				for (let i = 0; i < 24; i++) {
					const y = (i * 37 + clock * (20 + (i % 3) * 14)) % (AH - ATOP);
					g.fillRect((i * 53) % AW, ATOP + y, 1, 1);
				}
				const b = s.boss;
				if (b) {
					chip(
						g,
						b.x,
						SH.bossY,
						SH.bossW,
						SH.bossH,
						b.flash > 0 ? "#ffffff" : "#6a2a8a",
						"自演",
						"#ffe0ff",
						10,
					);
					g.fillStyle = "#30203a";
					g.fillRect(
						Math.round(b.x - SH.bossW / 2),
						SH.bossY + 10,
						SH.bossW,
						2,
					);
					g.fillStyle = "#e060c0";
					g.fillRect(
						Math.round(b.x - SH.bossW / 2),
						SH.bossY + 10,
						Math.round((SH.bossW * b.hp) / SH.bossHp),
						2,
					);
				}
				for (const f of s.foes) {
					const k = SH_KIND[f.kind];
					const fillc =
						f.flash > 0
							? "#ffffff"
							: f.kind === "neba"
								? f.hp > 1
									? "#806020"
									: "#b08840"
								: (SH_INK[f.kind] ?? "#c03030");
					chip(g, f.x, f.y, SH.foeW, SH.foeH, fillc, k.glyph);
				}
				if (s.item) {
					const blink = Math.floor(clock * 8) % 2 === 0;
					chip(
						g,
						s.item.x,
						s.item.y,
						12,
						11,
						blink ? "#3070e0" : "#60a0ff",
						"規",
					);
				}
				g.fillStyle = s.power > 0 ? "#80e0ff" : "#ffe060";
				for (const sh of s.shots)
					g.fillRect(Math.round(sh.x) - 1, Math.round(sh.y) - 3, 2, 5);
				if (s.hurt === 0 || Math.floor(clock * 10) % 2 === 0)
					kiriko(g, s.x, SH.shipY, 0, s.power > 0 ? "#30a0e0" : "#4060c0");
				// 線（ここを 越えると 残機が 減る）
				g.fillStyle = "#30304a";
				g.fillRect(0, SH.shipY + 9, AW, 1);
				juiceDraw(g, j, AW, AH);
			});
			const m = shMult(s);
			hud(
				g,
				`${ARCADE_BOARD.score} ${s.score}${m > 1 ? ` ×${m}` : ""}`,
				`${ARCADE_BOARD.lives} ${"♥".repeat(s.lives)}　${ARCADE_BOARD.time} ${Math.max(0, Math.ceil(SH.time - s.t))}`,
			);
		},
		over: (s) => s.over,
		score: (s) => s.score,
		end: (s) => (s.lives > 0 ? ARCADE.clear : ARCADE.over),
	});
};

// ───────────────── ブロックくずし ─────────────────

const BRICK_INK = ["#d04040", "#e08030", "#d0c040", "#40a050", "#4070d0"];
const BRICK_HARD = ["#802020", "#904818", "#807420", "#206030", "#203c80"];

export const playBreakout = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	const j = juice();
	return playBoard(ctx, "breakout", {
		start: bkStart,
		step: (s, f) => {
			juiceStep(j, f.dt);
			let launch = false;
			let target: number | undefined;
			for (const e of f.evs) {
				if (isKey(e, "left", true)) target = (target ?? s.target) - 18;
				else if (isKey(e, "right", true)) target = (target ?? s.target) + 18;
				else if (isKey(e, "a")) launch = true;
				else if (isTap(e)) {
					target = e.tap[0];
					if (s.held) launch = true;
				}
			}
			const lives = s.lives;
			const wide = s.wide;
			const pierce = s.pierce;
			for (const e of bkStep(s, f.dt, { target, launch }, rnd)) {
				if (e === "launch" || e === "paddle") f.se("decide");
				else if (e === "brick") f.se("arcBlock");
				else if (e === "dent") {
					f.se("hit_fist");
					burst(j, s.ball.x, s.ball.y, "#c0c0d0", 3, 40);
				} else if (e === "cap") {
					f.se("item");
					f.say(
						s.lives > lives
							? ARCADE_BOARD.bkLife
							: s.pierce > pierce
								? ARCADE_BOARD.bkPierce
								: s.wide > wide
									? ARCADE_BOARD.bkWide
									: "",
					);
				} else if (e === "lost") {
					f.se("miss");
					quake(j, 4);
				} else if (e === "wave") {
					f.se("clear");
					j.flash = 0.25;
					f.say(fill(ARCADE_BOARD.breakoutWave, { n: s.wave }));
				}
			}
			for (const p of s.pops) {
				pop(j, p.x, p.y, `+${p.pts}`);
				burst(j, p.x, p.y, "#ffe060", 5);
			}
		},
		draw: (g, s, clock) => {
			shaken(g, j, () => {
				g.fillStyle = "#101020";
				g.fillRect(0, 0, AW, AH);
				s.bricks.forEach((hp, i) => {
					if (hp <= 0) return;
					const [x, y, w, h] = bkRect(i);
					const row = Math.floor(i / BK.cols) % BRICK_INK.length;
					g.fillStyle = (hp > 1 ? BRICK_HARD[row] : BRICK_INK[row]) ?? "#888";
					g.fillRect(x, y, w, h);
					g.fillStyle = "rgba(255,255,255,0.25)";
					g.fillRect(x, y, w, 1);
					if (hp > 1) {
						g.strokeStyle = "rgba(255,255,255,0.45)";
						g.lineWidth = 1;
						g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
					}
				});
				for (const c of s.caps) {
					const k = BK_CAP[c.kind];
					chip(g, c.x, c.y, 14, 8, k.ink, k.glyph, "#ffffff", 7);
				}
				const ending = s.wide > 0 && s.wide < 1.5 && Math.floor(clock * 10) % 2;
				g.fillStyle = s.wide > 0 && !ending ? "#80c0ff" : "#e8e8f0";
				g.fillRect(Math.round(s.pad - s.padW / 2), BK.padY, s.padW, 4);
				if (s.pierce > 0 && !s.held) {
					// 貫く 球は 赤く、尾を 引く
					g.fillStyle = "rgba(255,80,80,0.4)";
					g.fillRect(
						Math.round(s.ball.x - s.ball.vx * 0.03) - BK.r,
						Math.round(s.ball.y - s.ball.vy * 0.03) - BK.r,
						BK.r * 2,
						BK.r * 2,
					);
				}
				g.fillStyle = s.pierce > 0 ? "#ff5050" : "#ffe060";
				g.fillRect(
					Math.round(s.ball.x) - BK.r,
					Math.round(s.ball.y) - BK.r,
					BK.r * 2,
					BK.r * 2,
				);
				juiceDraw(g, j, AW, AH);
			});
			hud(
				g,
				`${ARCADE_BOARD.score} ${s.score}`,
				`WAVE ${s.wave}　${ARCADE_BOARD.lives} ${"●".repeat(s.lives)}`,
			);
			if (s.held && !s.over)
				txt(
					g,
					ARCADE_BOARD.breakoutLaunch,
					AW / 2,
					100,
					8,
					"#a0a0c0",
					"center",
				);
		},
		over: (s) => s.over,
		score: (s) => s.score,
	});
};
