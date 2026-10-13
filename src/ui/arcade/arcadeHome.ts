// キリコの 家に 置く ゲームの 板（決まりは data/arcade/homeLogic.ts、文は data/arcade/text.ts）。
// - 横スクロール「スーパーキリコ」：←→ で 歩く（押している あいだ）、A・↑ で 跳ぶ。
//   タップは 右 1/3 で 右へ 歩きつづける・左 1/3 で 止まる（止まって いれば 左へ）・まんなかで 跳ぶ。
// - ボンバー「荒らし爆破」：十字キーで 動く（押している あいだ）、A で 爆弾。
//   タップは キリコの マスなら 爆弾、ほかは その マス（通れなければ となり）まで 歩く。
// 見た目の 乱数は Math.random（冒険の 乱数に さわらない）。

import { DX, DY } from "../../core/geom";
import {
	BM,
	BM_TEXT,
	type BmState,
	bmOrigin,
	bmPathStep,
	bmScore,
	bmStart,
	bmStep,
	bmTimeLeft,
	PF,
	PF_POLE_H,
	PF_TEXT,
	type PfState,
	PT,
	pfCam,
	pfGoalX,
	pfLiftX,
	pfScore,
	pfScreenY,
	pfStart,
	pfStep,
	pfTile,
	pfTimeLeft,
} from "../../data/arcade/homeLogic";
import { AH, AW } from "../../data/arcade/logic";
import { ARCADE, ARCADE_BOARD } from "../../data/arcade/text";
import type { UiCtx } from "../list";
import type { G } from "../neta/netaBoard";
import { txt } from "../neta/netaBoard";
import {
	type ArcadeResult,
	banner,
	chip,
	hud,
	isKey,
	isTap,
	playBoard,
} from "./arcadeKit";

const rnd = Math.random;

/**
 * 小さな キリコ。色は 歩行グラ（data/people/cast.ts の KIRIKO_WALK）から：赤茶の 髪に 緑の 髪かざり、
 * 緑の 服、黄土色の スカート、紺の 目。
 */
const kiriko = (g: G, x: number, y: number, step: number): void => {
	const X = Math.round(x);
	const Y = Math.round(y);
	// 髪（両わきは 顔の 横まで）と 緑の 髪かざり
	g.fillStyle = "#72241f";
	g.fillRect(X - 4, Y - 14, 8, 3);
	g.fillRect(X - 4, Y - 11, 1, 4);
	g.fillRect(X + 3, Y - 11, 1, 4);
	g.fillStyle = "#28a131";
	g.fillRect(X - 3, Y - 14, 6, 1);
	g.fillStyle = "#9f5753";
	g.fillRect(X - 2, Y - 13, 4, 1);
	// 顔と 目
	g.fillStyle = "#f0c8a8";
	g.fillRect(X - 3, Y - 11, 6, 3);
	g.fillStyle = "#031c3e";
	g.fillRect(X - 2, Y - 10, 1, 1);
	g.fillRect(X + 1, Y - 10, 1, 1);
	// 緑の 服（すそは 濃い 緑）
	g.fillStyle = "#28a131";
	g.fillRect(X - 4, Y - 8, 8, 3);
	g.fillStyle = "#105516";
	g.fillRect(X - 4, Y - 6, 8, 1);
	// 黄土色の スカート
	g.fillStyle = "#926855";
	g.fillRect(X - 4, Y - 5, 8, 2);
	g.fillStyle = "#353333";
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

/** 荒らし（赤い 札に「荒」、足つき）。 */
const arashi = (g: G, x: number, y: number, flat: boolean): void => {
	const X = Math.round(x);
	const Y = Math.round(y);
	g.fillStyle = "#c83030";
	if (flat) {
		g.fillRect(X - 5, Y - 3, 10, 3);
		return;
	}
	g.fillRect(X - 5, Y - 10, 10, 8);
	g.fillStyle = "#401010";
	g.fillRect(X - 4, Y - 2, 2, 2);
	g.fillRect(X + 2, Y - 2, 2, 2);
	txt(g, BM_TEXT.arashi, X, Y - 10, 7, "#ffffff", "center");
};

/** 浮かぶ 点（影つき）。 */
const popText = (g: G, s: string, x: number, y: number, t: number): void => {
	if (t > 0.7 && Math.floor(t * 20) % 2) return;
	txt(g, s, Math.round(x) + 1, Math.round(y) + 1, 7, "#141418", "center");
	txt(g, s, Math.round(x), Math.round(y), 7, "#ffffff", "center");
};

// ───────────────── 横スクロール ─────────────────

/** 1マス 描く（左上 x, y）。 */
const tile = (
	g: G,
	s: PfState,
	k: number,
	mx: number,
	r: number,
	x: number,
	y: number,
	clock: number,
): void => {
	const c = PF.cell;
	const above = pfTile(s, mx, r + 1);
	if (k === PT.ground) {
		g.fillStyle = "#9a6a3a";
		g.fillRect(x, y, c, c);
		g.fillStyle = "#7a4a22";
		g.fillRect(x + ((mx * 5) % 9), y + 5 + (r & 1) * 3, 2, 1);
		if (above === PT.empty) {
			g.fillStyle = "#5a9a3a";
			g.fillRect(x, y, c, 3);
			g.fillStyle = "#7aba4a";
			g.fillRect(x, y, c, 1);
		}
	} else if (k === PT.brick) {
		g.fillStyle = "#7a3a1a";
		g.fillRect(x, y, c, c);
		g.fillStyle = "#c8703a";
		g.fillRect(x, y, c - 1, 5);
		g.fillRect(x, y + 6, 5, 5);
		g.fillRect(x + 6, y + 6, c - 7, 5);
	} else if (k === PT.q || k === PT.oneUp) {
		const lit = Math.floor(clock * 3) % 3 !== 0;
		g.fillStyle = "#7a4a10";
		g.fillRect(x, y, c, c);
		g.fillStyle = lit ? "#f8c040" : "#d89a28";
		g.fillRect(x, y, c - 1, c - 1);
		txt(g, "?", x + c / 2, y + 2, 8, "#7a4a10", "center");
	} else if (k === PT.used) {
		g.fillStyle = "#4a3020";
		g.fillRect(x, y, c, c);
		g.fillStyle = "#8a6040";
		g.fillRect(x + 1, y + 1, c - 2, c - 2);
	} else if (k === PT.pipe) {
		const left = pfTile(s, mx - 1, r) === PT.pipe;
		const lip = above !== PT.pipe;
		g.fillStyle = "#1e6a28";
		g.fillRect(x, y, c, c);
		g.fillStyle = "#38b048";
		g.fillRect(left ? x : x + 2, y, left ? c - 2 : c - 2, c);
		g.fillStyle = "#8ae090";
		if (!left) g.fillRect(x + 4, y, 2, c);
		if (lip) {
			g.fillStyle = "#1e6a28";
			g.fillRect(x - (left ? 0 : 1), y, c + 1, 5);
			g.fillStyle = "#48c858";
			g.fillRect(x - (left ? 0 : 1), y, c, 4);
		}
	} else if (k === PT.stone) {
		g.fillStyle = "#5a5a66";
		g.fillRect(x, y, c, c);
		g.fillStyle = "#a0a0b0";
		g.fillRect(x, y, c - 1, c - 1);
		g.fillStyle = "#c8c8d4";
		g.fillRect(x, y, c - 1, 1);
		g.fillRect(x, y, 1, c - 1);
	}
};

export const playPlatform = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	// タップで 決めた 歩き（キーを 押すと 取り消す）
	let latch: -1 | 0 | 1 = 0;
	return playBoard(ctx, "platform", {
		note: PF_TEXT.note,
		start: () => pfStart(rnd),
		step: (s, f) => {
			let jump = false;
			for (const e of f.evs) {
				if (isKey(e, "a") || isKey(e, "up")) jump = true;
				else if (isTap(e)) {
					if (e.tap[0] < AW / 3) latch = latch === 1 ? 0 : -1;
					else if (e.tap[0] > (AW * 2) / 3) latch = 1;
					else jump = true;
				}
			}
			let dir = latch;
			const hd = ctx.input.heldDir();
			if (hd !== null && DX[hd] !== 0) {
				dir = DX[hd] as -1 | 1;
				latch = 0;
			}
			for (const e of pfStep(s, f.dt, { dir, jump })) {
				if (e === "jump") f.se("arcJump");
				else if (e === "coin" || e === "bump") f.se("arcCoin");
				else if (e === "block") f.se("arcBlock");
				else if (e === "oneup") f.se("arcBest");
				else if (e === "stomp") f.se("hit_fist");
				else if (e === "check") f.se("item");
				else if (e === "fall" || e === "hit") {
					f.se("arcCrash");
					latch = 0;
				}
			}
		},
		draw: (g, s, clock) => {
			const cam = pfCam(s);
			const c = PF.cell;
			const gy = pfScreenY(0);
			g.fillStyle = "#7ac0f0";
			g.fillRect(0, 0, AW, AH);
			// 遠くの 丘と 雲（ゆっくり）
			g.fillStyle = "#8ad0a0";
			for (let i = 0; i < 5; i++) {
				const w = 70 + (i % 2) * 30;
				let x = (i * 110 - cam * 0.4) % (AW + 140);
				if (x < -140) x += AW + 140;
				const X = Math.round(x);
				g.fillRect(X, gy - 18, w, 18);
				g.fillRect(X + 10, gy - 26, w - 20, 8);
				g.fillRect(X + 22, gy - 31, w - 44, 5);
			}
			g.fillStyle = "#f4f8ff";
			for (let i = 0; i < 6; i++) {
				const x = ((i * 97 - cam * 0.25) % (AW + 60)) - 30;
				const X = Math.round(x < -30 ? x + AW + 60 : x);
				g.fillRect(X, 24 + (i % 3) * 14, 22, 6);
				g.fillRect(X + 5, 21 + (i % 3) * 14, 12, 3);
			}
			// マス
			for (let mx = Math.floor(cam / c) - 1; mx < (cam + AW) / c + 1; mx++)
				for (let r = -2; r < 9; r++) {
					const k = pfTile(s, mx, r);
					if (k === PT.empty || mx < 0) continue;
					tile(
						g,
						s,
						k,
						mx,
						r,
						Math.round(mx * c - cam),
						pfScreenY((r + 1) * c),
						clock,
					);
				}
			// 動く 足場
			for (const l of s.lifts) {
				const x = Math.round(pfLiftX(l, s.t) - cam);
				if (x < -l.w || x > AW) continue;
				const y = pfScreenY(l.y);
				g.fillStyle = "#e8e0d0";
				g.fillRect(x, y, l.w, 4);
				g.fillStyle = "#a07850";
				g.fillRect(x, y + 4, l.w, 2);
			}
			// 中間旗
			const cx = Math.round(s.check - cam);
			if (s.check > c * 3 && cx > -20 && cx < AW + 4) {
				g.fillStyle = "#e8e8f0";
				g.fillRect(cx, gy - 30, 2, 30);
				g.fillStyle = s.checkGot ? "#40c060" : "#9090a0";
				g.fillRect(cx + 2, gy - 30, 10, 7);
			}
			// 旗竿（つかまったら 旗が その 高さへ）
			const fx = Math.round(pfGoalX() - cam);
			g.fillStyle = "#e8e8f0";
			g.fillRect(fx, gy - PF_POLE_H, 2, PF_POLE_H);
			g.fillStyle = "#40c060";
			g.fillRect(fx - 1, gy - PF_POLE_H - 3, 4, 4);
			const flagY = s.flagY >= 0 ? s.flagY + 12 : PF_POLE_H - 2;
			g.fillStyle = "#e04040";
			g.fillRect(fx - 12, gy - flagY, 12, 8);
			// 🥺（黄色い 丸。ふわふわ）
			for (const k of s.coins) {
				if (k.got) continue;
				const x = Math.round(k.x - cam);
				if (x < -6 || x > AW + 6) continue;
				const y = Math.round(gy - k.y + Math.sin(clock * 4 + k.x) * 1.2);
				g.fillStyle = "#ffe14d";
				g.fillRect(x - 3, y - 3, 6, 6);
				g.fillStyle = "#2a1408";
				g.fillRect(x - 2, y - 1, 1, 1);
				g.fillRect(x + 1, y - 1, 1, 1);
			}
			for (const e of s.enemies) {
				const x = e.x - cam;
				if (x < -10 || x > AW + 10) continue;
				if (e.kind === "puyu") puyu(g, x, gy - e.y, e.dead > 0);
				else arashi(g, x, gy - e.y, e.dead > 0);
			}
			// キリコ（無敵の あいだは 点滅、やられたら 赤く 光る）
			const blink = s.inv > 0 && Math.floor(clock * 14) % 2 === 0;
			if (s.deadT > 0) {
				if (Math.floor(clock * 10) % 2 === 0) {
					g.fillStyle = "#ff5040";
					g.fillRect(Math.round(s.x - cam) - 5, gy - s.y - 15, 10, 15);
				}
			} else if (!blink) {
				const step = s.ground ? Math.floor(clock * 10) % 2 : 0;
				kiriko(g, s.x - cam, gy - s.y, step);
			}
			for (const p of s.pops)
				popText(g, p.text, p.x - cam, gy - p.y - p.t * 18, p.t);
			hud(
				g,
				`${ARCADE_BOARD.score} ${pfScore(s)}　●${s.coinsGot}`,
				`${ARCADE_BOARD.lives} ${Math.max(0, s.lives)}　${ARCADE_BOARD.time} ${pfTimeLeft(s)}`,
			);
		},
		over: (s) => s.over,
		score: pfScore,
		end: (s) => (s.clear ? ARCADE.clear : ARCADE.over),
	});
};

// ───────────────── ボンバー ─────────────────

const ITEM_TONE = {
	fire: "#e05030",
	bomb: "#30303a",
	speed: "#3070d0",
} as const;

/** 通れる マス（爆弾の ない 通路）。 */
const walkable = (s: BmState, x: number, y: number): boolean =>
	s.grid[y]?.[x] === "." && !s.bombs.some((b) => b.x === x && b.y === y);

export const playBomber = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	// タップで 決めた 行き先
	let target: readonly [number, number] | null = null;
	let shake = 0;
	return playBoard(ctx, "bomber", {
		note: BM_TEXT.note,
		start: () => bmStart(rnd),
		step: (s, f) => {
			let bomb = false;
			const [ox, oy] = bmOrigin();
			for (const e of f.evs) {
				if (isKey(e, "a")) bomb = true;
				else if (isTap(e)) {
					const tx = Math.floor((e.tap[0] - ox) / BM.cell);
					const ty = Math.floor((e.tap[1] - oy) / BM.cell);
					if (tx === s.px && ty === s.py) {
						bomb = true;
						target = null;
					} else if (walkable(s, tx, ty)) target = [tx, ty];
					else {
						// レスや かべを タップしたら、その となりの 届く マスへ
						const near = (
							[
								[0, -1],
								[0, 1],
								[-1, 0],
								[1, 0],
							] as const
						)
							.map(([dx, dy]) => [tx + dx, ty + dy] as const)
							.filter(
								([x, y]) =>
									(x === s.px && y === s.py) ||
									bmPathStep(s, s.px, s.py, x, y) !== null,
							)
							.sort(
								(a, b) =>
									Math.abs(a[0] - s.px) +
									Math.abs(a[1] - s.py) -
									Math.abs(b[0] - s.px) -
									Math.abs(b[1] - s.py),
							);
						target = near[0] ?? null;
					}
				}
			}
			let dx = 0;
			let dy = 0;
			const hd = ctx.input.heldDir();
			if (hd !== null) {
				target = null;
				dx = DX[hd];
				dy = DY[hd];
				// 斜めは 通れる ほうへ
				if (dx && dy) {
					if (walkable(s, s.px + dx, s.py)) dy = 0;
					else dx = 0;
				}
			} else if (target) {
				const st = bmPathStep(s, s.px, s.py, target[0], target[1]);
				if (st) [dx, dy] = st;
				else target = null;
			}
			if (s.deadT > 0 || s.pause > 0) target = null;
			shake = Math.max(0, shake - f.dt);
			for (const e of bmStep(s, f.dt, { dx, dy, bomb }, rnd)) {
				if (e === "bomb") f.se("put");
				else if (e === "boom") {
					f.se("explosion");
					shake = 0.18;
				} else if (e === "kill") f.se("enemyDown");
				else if (e === "power") f.se("item");
				else if (e === "dead") f.se("arcCrash");
				else if (e === "clear" && !s.over) f.se("levelup");
				else if (e === "stage") f.se("arcStart");
			}
		},
		draw: (g, s, clock) => {
			const [ox, oy] = bmOrigin();
			const c = BM.cell;
			g.fillStyle = "#1c2a1c";
			g.fillRect(0, 0, AW, AH);
			g.save();
			if (shake > 0)
				g.translate(
					Math.round((Math.random() - 0.5) * 3),
					Math.round((Math.random() - 0.5) * 3),
				);
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
						g.fillStyle = "#3a6a3a";
						g.fillRect(X, Y, c, c);
						g.fillStyle = "#e8e0c8";
						g.fillRect(X + 1, Y + 1, c - 2, c - 2);
						g.fillStyle = "#8a8070";
						g.fillRect(X + 3, Y + 4, c - 6, 1);
						g.fillRect(X + 3, Y + 7, c - 6, 1);
					} else {
						g.fillStyle = (x + y) % 2 ? "#3a6a3a" : "#3e703e";
						g.fillRect(X, Y, c, c);
					}
				}
			// 行き先の 印
			if (target) {
				g.fillStyle = "rgba(255,255,255,0.35)";
				g.fillRect(ox + target[0] * c + 4, oy + target[1] * c + 4, 4, 4);
			}
			for (const it of s.items) {
				if (!it.shown) continue;
				const lit = Math.floor(clock * 6) % 2 === 0;
				chip(
					g,
					ox + it.x * c + c / 2,
					oy + it.y * c + c / 2,
					c - 2,
					c - 2,
					lit ? ITEM_TONE[it.kind] : "#f4f2ea",
					BM_TEXT[it.kind],
					lit ? "#ffffff" : ITEM_TONE[it.kind],
					7,
				);
			}
			for (const b of s.bombs) {
				const blink = b.t < 0.6 && Math.floor(clock * 12) % 2 === 0;
				const swell = b.t < 0.6 ? 1 : 0;
				g.fillStyle = blink ? "#ff5040" : "#141418";
				g.fillRect(
					ox + b.x * c + 2 - swell,
					oy + b.y * c + 2 - swell,
					c - 4 + swell * 2,
					c - 4 + swell * 2,
				);
				g.fillStyle = "#f0c040";
				g.fillRect(ox + b.x * c + c / 2, oy + b.y * c, 1, 3);
			}
			for (const f of s.blasts) {
				g.fillStyle = f.t > BM.blastLife / 2 ? "#ffe060" : "#ff8040";
				g.fillRect(ox + f.x * c, oy + f.y * c, c, c);
				g.fillStyle = "#fff8d0";
				g.fillRect(ox + f.x * c + 3, oy + f.y * c + 3, c - 6, c - 6);
			}
			for (const e of s.enemies) {
				if (!e.alive) continue;
				const X = ox + e.x * c + c / 2;
				const Y = oy + e.y * c + c / 2;
				const bob = Math.floor(clock * 4 + e.x) % 2;
				g.fillStyle = e.kind === "nenchaku" ? "#8a40b0" : "#c83030";
				g.fillRect(X - 4, Y - 4 - bob, 8, 8);
				txt(g, BM_TEXT[e.kind], X, Y - 4 - bob, 7, "#ffffff", "center");
			}
			const X = ox + s.px * c + c / 2;
			const Y = oy + s.py * c + c;
			if (s.deadT > 0) {
				if (Math.floor(clock * 10) % 2 === 0) {
					g.fillStyle = "#ff5040";
					g.fillRect(X - 5, Y - 12, 10, 12);
				}
			} else if (!(s.inv > 0 && Math.floor(clock * 14) % 2 === 0))
				kiriko(g, X, Y, 0);
			for (const p of s.pops)
				popText(
					g,
					p.text,
					ox + p.x * c + c / 2,
					oy + p.y * c - 2 - p.t * 14,
					p.t,
				);
			g.restore();
			if (s.pause > 0)
				banner(g, BM_TEXT.stage.replace("{n}", String(s.stage + 1)));
			hud(
				g,
				`${ARCADE_BOARD.score} ${bmScore(s)}　${BM_TEXT.fire}${s.range} ${BM_TEXT.bomb}${s.maxBombs} ${BM_TEXT.speed}${s.speed + 1}`,
				`${s.stage}${BM_TEXT.stageUnit}　${ARCADE_BOARD.lives} ${Math.max(0, s.lives)}　${ARCADE_BOARD.time} ${bmTimeLeft(s)}`,
			);
		},
		over: (s) => s.over,
		score: bmScore,
		end: (s) => (s.clear ? ARCADE.clear : ARCADE.over),
	});
};
