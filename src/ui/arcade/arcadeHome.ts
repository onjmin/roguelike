// キリコの 家に 置く ゲームの 板（決まりは data/arcade/homeLogic.ts、文は data/arcade/text.ts）。
// - 横スクロール「スーパーキリコ」：←→ で 歩く、A・↑ で 跳ぶ。タップは 左 1/3 で 左・まんなかで 跳ぶ・右 1/3 で 右。
// - ボンバー「荒らし爆破」：十字キーで 動く、A で 爆弾。タップは キリコの マスなら 爆弾、ほかは その 向きへ 1マス。
// 見た目の 乱数は Math.random（冒険の 乱数に さわらない）。

import {
	BM,
	bmOrigin,
	bmScore,
	bmStart,
	bmStep,
	bmTimeLeft,
	PF,
	pfCam,
	pfGoalX,
	pfScore,
	pfScreenY,
	pfStart,
	pfStep,
	pfTimeLeft,
} from "../../data/arcade/homeLogic";
import { AH, AW } from "../../data/arcade/logic";
import { ARCADE, ARCADE_BOARD } from "../../data/arcade/text";
import type { UiCtx } from "../list";
import type { G } from "../neta/netaBoard";
import { txt } from "../neta/netaBoard";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "./arcadeKit";

const rnd = Math.random;

/** 横から 見た 小さな キリコ。 */
const kiriko = (g: G, x: number, y: number, step: number): void => {
	const X = Math.round(x);
	const Y = Math.round(y);
	g.fillStyle = "#7a3a20";
	g.fillRect(X - 4, Y - 14, 8, 4);
	g.fillStyle = "#f2d0a8";
	g.fillRect(X - 3, Y - 11, 6, 4);
	g.fillStyle = "#4060c0";
	g.fillRect(X - 4, Y - 7, 8, 4);
	g.fillStyle = "#303040";
	g.fillRect(X - 3 + step, Y - 3, 2, 3);
	g.fillRect(X + 1 - step, Y - 3, 2, 3);
};

/** ぷゆゆ（黄色い 丸に 🥺 の 目）。 */
const puyu = (g: G, x: number, y: number, flat: boolean): void => {
	const X = Math.round(x);
	const Y = Math.round(y);
	g.fillStyle = "#f0c838";
	if (flat) {
		g.fillRect(X - 5, Y - 3, 10, 3);
		return;
	}
	g.fillRect(X - 5, Y - 9, 10, 9);
	g.fillRect(X - 4, Y - 10, 8, 1);
	g.fillStyle = "#2a1408";
	g.fillRect(X - 3, Y - 7, 2, 2);
	g.fillRect(X + 1, Y - 7, 2, 2);
	g.fillStyle = "#ffffff";
	g.fillRect(X - 3, Y - 7, 1, 1);
	g.fillRect(X + 1, Y - 7, 1, 1);
};

// ───────────────── 横スクロール ─────────────────

export const playPlatform = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let dir: -1 | 0 | 1 = 0;
	let held = 0;
	return playBoard(ctx, "platform", {
		start: () => pfStart(rnd),
		step: (s, f) => {
			let jump = false;
			for (const e of f.evs) {
				if (isKey(e, "left", true)) {
					dir = -1;
					held = 0.18;
				} else if (isKey(e, "right", true)) {
					dir = 1;
					held = 0.18;
				} else if (isKey(e, "a") || isKey(e, "up")) jump = true;
				else if (isTap(e)) {
					if (e.tap[0] < AW / 3) {
						dir = -1;
						held = 0.35;
					} else if (e.tap[0] > (AW * 2) / 3) {
						dir = 1;
						held = 0.35;
					} else jump = true;
				}
			}
			// 押しっぱなしは くり返しで 届く。とぎれたら 止まる
			held -= f.dt;
			if (held <= 0) dir = 0;
			for (const e of pfStep(s, f.dt, { dir, jump })) {
				if (e === "jump") f.se("arcJump");
				else if (e === "coin") f.se("arcCoin");
				else if (e === "stomp") f.se("hit_fist");
				else if (e === "fall" || e === "hit") f.se("arcCrash");
			}
		},
		draw: (g, s, clock) => {
			const cam = pfCam(s);
			const c = PF.cell;
			const gy = pfScreenY(0);
			g.fillStyle = "#7ac0f0";
			g.fillRect(0, 0, AW, AH);
			// 雲（ゆっくり）
			g.fillStyle = "#f4f8ff";
			for (let i = 0; i < 6; i++) {
				const x = ((i * 97 - cam * 0.3) % (AW + 60)) - 30;
				g.fillRect(
					Math.round(x < -30 ? x + AW + 60 : x),
					24 + (i % 3) * 14,
					22,
					6,
				);
			}
			// 地面（穴は 空のまま）
			for (let mx = Math.floor(cam / c); mx < (cam + AW) / c + 1; mx++) {
				if (!s.floor[mx]) continue;
				const x = Math.round(mx * c - cam);
				g.fillStyle = "#5a9a3a";
				g.fillRect(x, gy, c, 3);
				g.fillStyle = "#9a6a3a";
				g.fillRect(x, gy + 3, c, AH - gy - 3);
			}
			// 足場（レンガ）
			for (const b of s.blocks) {
				const x = Math.round(b.x * c - cam);
				if (x < -c || x > AW) continue;
				g.fillStyle = "#c8703a";
				g.fillRect(x, pfScreenY(b.h * c), c, c);
				g.fillStyle = "#7a3a1a";
				g.fillRect(x, pfScreenY(b.h * c) + c / 2, c, 1);
			}
			// 旗
			const fx = Math.round(pfGoalX() - cam);
			g.fillStyle = "#e8e8f0";
			g.fillRect(fx, gy - 60, 2, 60);
			g.fillStyle = "#e04040";
			g.fillRect(fx + 2, gy - 60, 12, 8);
			// 🥺（黄色い 丸）
			for (const k of s.coins) {
				if (k.got) continue;
				const x = Math.round(k.x - cam);
				const y = Math.round(gy - k.y);
				g.fillStyle = "#ffe14d";
				g.fillRect(x - 3, y - 3, 6, 6);
				g.fillStyle = "#2a1408";
				g.fillRect(x - 2, y - 1, 1, 1);
				g.fillRect(x + 1, y - 1, 1, 1);
			}
			for (const e of s.enemies) puyu(g, e.x - cam, gy - e.y, e.dead > 0);
			const step = s.ground ? Math.floor(clock * 10) % 2 : 0;
			kiriko(g, s.x - cam, gy - s.y, step);
			hud(
				g,
				`${ARCADE_BOARD.score} ${pfScore(s)}　●${s.coinsGot}`,
				`TIME ${pfTimeLeft(s)}`,
			);
		},
		over: (s) => s.over,
		score: pfScore,
		end: (s) => (s.clear ? ARCADE.clear : ARCADE.over),
	});
};

// ───────────────── ボンバー ─────────────────

export const playBomber = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let dx = 0;
	let dy = 0;
	let held = 0;
	return playBoard(ctx, "bomber", {
		start: () => bmStart(rnd),
		step: (s, f) => {
			let bomb = false;
			const [ox, oy] = bmOrigin();
			for (const e of f.evs) {
				if (isKey(e, "left", true)) [dx, dy, held] = [-1, 0, 0.2];
				else if (isKey(e, "right", true)) [dx, dy, held] = [1, 0, 0.2];
				else if (isKey(e, "up", true)) [dx, dy, held] = [0, -1, 0.2];
				else if (isKey(e, "down", true)) [dx, dy, held] = [0, 1, 0.2];
				else if (isKey(e, "a")) bomb = true;
				else if (isTap(e)) {
					const tx = Math.floor((e.tap[0] - ox) / BM.cell);
					const ty = Math.floor((e.tap[1] - oy) / BM.cell);
					if (tx === s.px && ty === s.py) bomb = true;
					else {
						const ax = tx - s.px;
						const ay = ty - s.py;
						if (Math.abs(ax) >= Math.abs(ay)) [dx, dy] = [Math.sign(ax), 0];
						else [dx, dy] = [0, Math.sign(ay)];
						held = 0.12;
					}
				}
			}
			held -= f.dt;
			if (held <= 0) [dx, dy] = [0, 0];
			for (const e of bmStep(s, f.dt, { dx, dy, bomb }, rnd)) {
				if (e === "bomb") f.se("put");
				else if (e === "boom") f.se("explosion");
				else if (e === "kill") f.se("enemyDown");
				else if (e === "dead") f.se("arcCrash");
			}
		},
		draw: (g, s, clock) => {
			const [ox, oy] = bmOrigin();
			const c = BM.cell;
			g.fillStyle = "#1c2a1c";
			g.fillRect(0, 0, AW, AH);
			for (let y = 0; y < BM.rows; y++)
				for (let x = 0; x < BM.cols; x++) {
					const X = ox + x * c;
					const Y = oy + y * c;
					const k = s.grid[y][x];
					if (k === "#") {
						g.fillStyle = "#5a5a66";
						g.fillRect(X, Y, c, c);
						g.fillStyle = "#3a3a44";
						g.fillRect(X, Y + c - 2, c, 2);
					} else if (k === "r") {
						g.fillStyle = "#e8e0c8";
						g.fillRect(X + 1, Y + 1, c - 2, c - 2);
						g.fillStyle = "#8a8070";
						g.fillRect(X + 3, Y + 4, c - 6, 1);
						g.fillRect(X + 3, Y + 7, c - 6, 1);
					} else {
						g.fillStyle = "#3a6a3a";
						g.fillRect(X, Y, c, c);
					}
				}
			for (const b of s.bombs) {
				const blink = b.t < 0.6 && Math.floor(clock * 12) % 2 === 0;
				g.fillStyle = blink ? "#ff5040" : "#141418";
				g.fillRect(ox + b.x * c + 2, oy + b.y * c + 2, c - 4, c - 4);
				g.fillStyle = "#f0c040";
				g.fillRect(ox + b.x * c + c / 2, oy + b.y * c, 1, 3);
			}
			for (const f of s.blasts) {
				g.fillStyle = f.t > BM.blastLife / 2 ? "#ffe060" : "#ff8040";
				g.fillRect(ox + f.x * c, oy + f.y * c, c, c);
			}
			for (const e of s.enemies) {
				if (!e.alive) continue;
				const X = ox + e.x * c + c / 2;
				const Y = oy + e.y * c + c / 2;
				g.fillStyle = "#c83030";
				g.fillRect(X - 4, Y - 4, 8, 8);
				txt(g, "荒", X, Y - 4, 7, "#ffffff", "center");
			}
			const X = ox + s.px * c + c / 2;
			const Y = oy + s.py * c + c;
			kiriko(g, X, Y, 0);
			hud(
				g,
				`${ARCADE_BOARD.score} ${bmScore(s)}`,
				`荒らし ${s.enemies.filter((e) => e.alive).length}　TIME ${bmTimeLeft(s)}`,
			);
		},
		over: (s) => s.over,
		score: bmScore,
		end: (s) => (s.clear ? ARCADE.clear : ARCADE.over),
	});
};
