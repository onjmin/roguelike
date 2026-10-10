// ゲームセンターの 筐体の 板（動かして よける・撃つ 台）。決まりは data/arcade/logic.ts、文は data/arcade/text.ts。
// - シューティング「荒らし撃退」：←→ で 動く（くり返しで 進む）、A で 撃つ。タップは その 横位置へ 動いて 撃つ。
// - レースゲーム「保守ドライブ」：←→ で 車線を かえる。タップは 車より 左なら 左、右なら 右。
// - ブロックくずし「スレ崩し」：←→ で 板を 動かす、A で 球を 打つ。タップは その 横位置へ（球が のって いれば 打つ）。
// - ジャンプアクション「なんJラン」：A・↑・タップで 跳ぶ。
// 見た目の 乱数は Math.random（冒険の 乱数に さわらない）。

import {
	AH,
	ATOP,
	AW,
	BK,
	bkRect,
	bkStart,
	bkStep,
	DR,
	drScore,
	drSpeed,
	drStart,
	drStep,
	RN,
	rnScore,
	rnStart,
	rnStep,
	SH,
	SH_KIND,
	shStart,
	shStep,
} from "../data/arcade/logic";
import { ARCADE, ARCADE_BOARD } from "../data/arcade/text";
import {
	type ArcadeResult,
	chip,
	hud,
	isKey,
	isTap,
	playBoard,
} from "./arcadeKit";
import type { UiCtx } from "./list";
import type { G } from "./netaBoard";
import { txt } from "./netaBoard";
import { fill } from "./villageTalk";

const rnd = Math.random;

/** 小さな キリコ（上から 見た 自機・横から 見た 走る 姿）。 */
const kiriko = (g: G, x: number, y: number, step = 0): void => {
	const X = Math.round(x);
	const Y = Math.round(y);
	g.fillStyle = "#7a3a20"; // 髪
	g.fillRect(X - 4, Y - 7, 8, 4);
	g.fillStyle = "#f2d0a8"; // 顔
	g.fillRect(X - 3, Y - 4, 6, 4);
	g.fillStyle = "#4060c0"; // 服
	g.fillRect(X - 4, Y, 8, 4);
	g.fillStyle = "#303040"; // 足
	g.fillRect(X - 3 + (step ? 1 : 0), Y + 4, 2, 3);
	g.fillRect(X + 1 - (step ? 1 : 0), Y + 4, 2, 3);
};

// ───────────────── シューティング ─────────────────

export const playShooter = (ctx: UiCtx): Promise<ArcadeResult | null> =>
	playBoard(ctx, "shooter", {
		start: shStart,
		step: (s, f) => {
			let fire = false;
			let target: number | undefined;
			for (const e of f.evs) {
				if (isKey(e, "left", true)) target = (target ?? s.target) - 16;
				else if (isKey(e, "right", true)) target = (target ?? s.target) + 16;
				else if (isKey(e, "a")) fire = true;
				else if (isTap(e)) {
					target = e.tap[0];
					fire = true;
				}
			}
			for (const e of shStep(s, f.dt, { target, fire }, rnd)) {
				if (e === "shot") f.se("arcShot");
				else if (e === "hit") f.se("hit_fist");
				else if (e === "kill") f.se("arcBlock");
				else if (e === "hurt" || e === "breach") f.se("arcCrash");
			}
		},
		draw: (g, s, clock) => {
			g.fillStyle = "#0a0a1c";
			g.fillRect(0, 0, AW, AH);
			// 星（流れる）
			g.fillStyle = "#3a3a5a";
			for (let i = 0; i < 24; i++) {
				const y = (i * 37 + clock * (20 + (i % 3) * 14)) % (AH - ATOP);
				g.fillRect((i * 53) % AW, ATOP + y, 1, 1);
			}
			for (const f of s.foes) {
				const k = SH_KIND[f.kind];
				const fillc =
					f.flash > 0
						? "#ffffff"
						: f.kind === "aori"
							? "#d04080"
							: f.kind === "neba"
								? f.hp > 1
									? "#806020"
									: "#b08840"
								: "#c03030";
				chip(g, f.x, f.y, SH.foeW, SH.foeH, fillc, k.glyph);
			}
			g.fillStyle = "#ffe060";
			for (const b of s.shots)
				g.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 3, 2, 5);
			if (s.hurt === 0 || Math.floor(clock * 10) % 2 === 0)
				kiriko(g, s.x, SH.shipY);
			// 線（ここを 越えると 残機が 減る）
			g.fillStyle = "#30304a";
			g.fillRect(0, SH.shipY + 9, AW, 1);
			hud(
				g,
				`${ARCADE_BOARD.score} ${s.score}`,
				`${ARCADE_BOARD.lives} ${"♥".repeat(s.lives)}　${ARCADE_BOARD.time} ${Math.max(0, Math.ceil(SH.time - s.t))}`,
			);
		},
		over: (s) => s.over,
		score: (s) => s.score,
		end: (s) => (s.lives > 0 ? ARCADE.clear : ARCADE.over),
	});

// ───────────────── レースゲーム ─────────────────

export const playDrive = (ctx: UiCtx): Promise<ArcadeResult | null> =>
	playBoard(ctx, "drive", {
		start: drStart,
		step: (s, f) => {
			let move: -1 | 0 | 1 = 0;
			for (const e of f.evs) {
				if (isKey(e, "left")) move = -1;
				else if (isKey(e, "right")) move = 1;
				else if (isTap(e))
					move = e.tap[0] < (DR.lanes[s.lane] ?? AW / 2) ? -1 : 1;
				if (move !== 0) {
					for (const ev of drStep(s, 0, move, rnd))
						if (ev === "move") f.se("cursor");
					move = 0;
				}
			}
			for (const e of drStep(s, f.dt, 0, rnd)) {
				if (e === "pickup") f.se("item");
				else if (e === "crash") f.se("arcCrash");
			}
			if (s.over) f.say(ARCADE_BOARD.driveCrash);
		},
		draw: (g, s) => {
			g.fillStyle = "#2f7a32"; // 草地
			g.fillRect(0, 0, AW, AH);
			g.fillStyle = "#4a4a52";
			g.fillRect(DR.roadL, ATOP, DR.roadR - DR.roadL, AH - ATOP);
			g.fillStyle = "#e8e8e8";
			g.fillRect(DR.roadL, ATOP, 2, AH - ATOP);
			g.fillRect(DR.roadR - 2, ATOP, 2, AH - ATOP);
			// 車線の 点線（走った ぶん 流れる）
			g.fillStyle = "#c8c8c8";
			const off = s.dist % 16;
			for (const x of [105, 135])
				for (let y = ATOP - 16 + off; y < AH; y += 16) g.fillRect(x, y, 1, 8);
			for (const o of s.things) {
				const x = DR.lanes[o.lane] ?? 0;
				if (o.kind === "cone")
					chip(g, x, o.y, 10, DR.obH, "#f07020", "▲", "#ffffff", 7);
				else if (o.kind === "car")
					chip(g, x, o.y, 14, DR.obH + 2, "#c03030", "荒");
				else chip(g, x, o.y, 16, DR.obH, "#2060c0", "保守", "#ffffff", 6);
			}
			const cx = (DR.lanes[s.lane] ?? 0) + s.slide * 30;
			g.fillStyle = "#f0f0f0";
			g.fillRect(
				Math.round(cx) - DR.carW / 2,
				DR.carY - DR.carH / 2,
				DR.carW,
				DR.carH,
			);
			g.fillStyle = "#4060c0";
			g.fillRect(Math.round(cx) - 4, DR.carY - 3, 8, 6);
			hud(
				g,
				`${ARCADE_BOARD.score} ${drScore(s)}`,
				`${Math.round(drSpeed(s.t))} km/h`,
			);
		},
		over: (s) => s.over,
		score: drScore,
	});

// ───────────────── ブロックくずし ─────────────────

const BRICK_INK = ["#d04040", "#e08030", "#d0c040", "#40a050", "#4070d0"];

export const playBreakout = (ctx: UiCtx): Promise<ArcadeResult | null> =>
	playBoard(ctx, "breakout", {
		start: bkStart,
		step: (s, f) => {
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
			for (const e of bkStep(s, f.dt, { target, launch }, rnd)) {
				if (e === "launch" || e === "paddle") f.se("decide");
				else if (e === "brick") f.se("arcBlock");
				else if (e === "lost") f.se("miss");
				else if (e === "wave") {
					f.se("levelup");
					f.say(fill(ARCADE_BOARD.breakoutWave, { n: s.wave }));
				}
			}
		},
		draw: (g, s) => {
			g.fillStyle = "#101020";
			g.fillRect(0, 0, AW, AH);
			s.bricks.forEach((on, i) => {
				if (!on) return;
				const [x, y, w, h] = bkRect(i);
				g.fillStyle =
					BRICK_INK[Math.floor(i / BK.cols) % BRICK_INK.length] ?? "#888";
				g.fillRect(x, y, w, h);
				g.fillStyle = "rgba(255,255,255,0.25)";
				g.fillRect(x, y, w, 1);
			});
			g.fillStyle = "#e8e8f0";
			g.fillRect(Math.round(s.pad - BK.padW / 2), BK.padY, BK.padW, 4);
			g.fillStyle = "#ffe060";
			g.fillRect(
				Math.round(s.ball.x) - BK.r,
				Math.round(s.ball.y) - BK.r,
				BK.r * 2,
				BK.r * 2,
			);
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

// ───────────────── ジャンプアクション ─────────────────

export const playRunner = (ctx: UiCtx): Promise<ArcadeResult | null> =>
	playBoard(ctx, "runner", {
		start: rnStart,
		step: (s, f) => {
			const press = f.evs.some(
				(e) => isKey(e, "a") || isKey(e, "up") || isTap(e),
			);
			for (const e of rnStep(s, f.dt, press, rnd)) {
				if (e === "jump") f.se("arcJump");
				else if (e === "crash") f.se("arcCrash");
			}
		},
		draw: (g, s, clock) => {
			g.fillStyle = "#88c8f0"; // 空
			g.fillRect(0, 0, AW, AH);
			// 遠くの 山（ゆっくり 流れる）
			g.fillStyle = "#70a8c8";
			const far = (s.dist * 0.2) % 80;
			for (let x = -far; x < AW + 80; x += 80) {
				g.beginPath();
				g.moveTo(x, RN.groundY);
				g.lineTo(x + 40, RN.groundY - 30);
				g.lineTo(x + 80, RN.groundY);
				g.fill();
			}
			g.fillStyle = "#5a9a3a";
			g.fillRect(0, RN.groundY, AW, AH - RN.groundY);
			g.fillStyle = "#4a7a2a";
			const near = s.dist % 12;
			for (let x = -near; x < AW; x += 12)
				g.fillRect(Math.round(x), RN.groundY + 4, 6, 1);
			for (const r of s.rocks) {
				g.fillStyle = "#6a6a72";
				g.fillRect(Math.round(r.x), RN.groundY - r.h, r.w, r.h);
				if (r.h >= 15)
					txt(
						g,
						"荒",
						Math.round(r.x + r.w / 2),
						RN.groundY - r.h + 2,
						7,
						"#f0e0e0",
						"center",
					);
			}
			const step = s.y === 0 ? Math.floor(clock * 10) % 2 : 0;
			kiriko(g, RN.x, RN.groundY - 7 - s.y, step);
			hud(g, `${ARCADE_BOARD.score} ${rnScore(s)}`, "");
		},
		over: (s) => s.over,
		score: rnScore,
	});
