// レス食い の 板（決まりは data/arcade/home/resukui.ts）。
// 十字キーで 曲がる 向きを 決める（曲がれる ところまで 覚えて おく）。
// タップは キリコから 見た その 点の 向き（縦と 横の 大きい ほう）。

import {
	RK,
	RK_DIRS,
	RK_MAZE,
	RK_TEXT,
	type RkDir,
	type RkGhost,
	type RkState,
	rkFrightTime,
	rkOrigin,
	rkPos,
	rkScore,
	rkStart,
	rkStep,
} from "../../../data/arcade/home/resukui";
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
import {
	type ArcadeResult,
	chip,
	hud,
	isKey,
	isTap,
	playBoard,
} from "../arcadeKit";

const rnd = Math.random;

const KEYS = ["up", "right", "down", "left"] as const;

/** 荒らしの 色（追う・先回り・気まぐれ・はずかしがり）。 */
const GHOST_INK = ["#e83838", "#f088c8", "#40d0e0", "#f0a040"];

const isWall = (x: number, y: number): boolean =>
	x >= 0 && x < RK.cols && y >= 0 && y < RK.rows && RK_MAZE[y][x] === "#";

/** 迷路の 壁（内がわの ふちを 明るく）。 */
const drawMaze = (g: G, ox: number, oy: number, lit: boolean): void => {
	const c = RK.cell;
	for (let y = 0; y < RK.rows; y++)
		for (let x = 0; x < RK.cols; x++) {
			const k = RK_MAZE[y][x];
			const X = ox + x * c;
			const Y = oy + y * c;
			if (k === "-") {
				g.fillStyle = "#f0a0c0";
				g.fillRect(X, Y + 4, c, 2);
				continue;
			}
			if (k !== "#") continue;
			g.fillStyle = "#141c48";
			g.fillRect(X, Y, c, c);
			g.fillStyle = lit ? "#ffffff" : "#4a70e0";
			if (!isWall(x, y - 1) && y > 0) g.fillRect(X, Y, c, 1);
			if (!isWall(x, y + 1) && y < RK.rows - 1) g.fillRect(X, Y + c - 1, c, 1);
			if (!isWall(x - 1, y) && x > 0) g.fillRect(X, Y, 1, c);
			if (!isWall(x + 1, y) && x < RK.cols - 1) g.fillRect(X + c - 1, Y, 1, c);
		}
};

/** キリコ（赤茶の 髪に 緑の 髪かざり。向きへ 口を ぱくぱく）。 */
const drawKiriko = (
	g: G,
	cx: number,
	cy: number,
	dir: RkDir,
	open: boolean,
): void => {
	const X = Math.round(cx);
	const Y = Math.round(cy);
	g.fillStyle = "#72241f";
	g.fillRect(X - 4, Y - 4, 8, 3);
	g.fillRect(X - 4, Y - 1, 1, 4);
	g.fillRect(X + 3, Y - 1, 1, 4);
	g.fillStyle = "#28a131";
	g.fillRect(X - 3, Y - 4, 3, 1);
	g.fillStyle = "#f0c8a8";
	g.fillRect(X - 3, Y - 1, 6, 4);
	g.fillRect(X - 2, Y + 3, 4, 1);
	g.fillStyle = "#031c3e";
	g.fillRect(X - 2, Y, 1, 1);
	g.fillRect(X + 1, Y, 1, 1);
	if (open) {
		g.fillStyle = "#601020";
		const [dx, dy] = RK_DIRS[dir];
		if (dy === 0) g.fillRect(X + (dx > 0 ? 2 : -3), Y + 2, 1, 2);
		else g.fillRect(X - 1, Y + (dy > 0 ? 3 : 1), 2, 1);
		if (dy === 0) g.fillRect(X - 1, Y + 2, 2, 1);
	}
};

/** 荒らし（色の 札に すそ。目は 進む 向きを 見る）。 */
const drawGhost = (
	g: G,
	s: RkState,
	h: RkGhost,
	cx: number,
	cy: number,
	clock: number,
): void => {
	const X = Math.round(cx);
	const Y = Math.round(cy);
	const [dx, dy] = RK_DIRS[h.dir];
	if (h.mode !== "eyes") {
		const ending = h.blue && s.fright < 2 && Math.floor(clock * 6) % 2 === 0;
		g.fillStyle = h.blue ? (ending ? "#f0f0f0" : "#2838c8") : GHOST_INK[h.kind];
		g.fillRect(X - 3, Y - 4, 7, 1);
		g.fillRect(X - 4, Y - 3, 9, 6);
		// すそ（ゆらゆら）
		const w = Math.floor(clock * 8) % 2;
		for (let i = 0; i < 3; i++) g.fillRect(X - 4 + i * 3 + w, Y + 3, 2, 1);
		if (h.blue) {
			g.fillStyle = ending ? "#e83838" : "#f0d0a0";
			g.fillRect(X - 2, Y - 1, 1, 1);
			g.fillRect(X + 2, Y - 1, 1, 1);
			g.fillRect(X - 2, Y + 1, 5, 1);
			return;
		}
	}
	g.fillStyle = "#ffffff";
	g.fillRect(X - 3, Y - 2, 3, 3);
	g.fillRect(X + 1, Y - 2, 3, 3);
	g.fillStyle = "#1830a0";
	g.fillRect(X - 2 + dx, Y - 1 + dy, 1, 1);
	g.fillRect(X + 2 + dx, Y - 1 + dy, 1, 1);
};

export const playResukui = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	const j = juice();
	let mouth = 0;
	return playBoard(ctx, "resukui", {
		start: rkStart,
		step: (s, f) => {
			const [ox, oy] = rkOrigin();
			const c = RK.cell;
			let dir: RkDir | null = null;
			for (const e of f.evs) {
				const k = KEYS.findIndex((k) => isKey(e, k, true));
				if (k >= 0) dir = k as RkDir;
				else if (isTap(e)) {
					const [px, py] = rkPos(s.pac);
					const ax = e.tap[0] - (ox + px * c + c / 2);
					const ay = e.tap[1] - (oy + py * c + c / 2);
					if (Math.abs(ax) > Math.abs(ay)) dir = ax < 0 ? 3 : 1;
					else dir = ay < 0 ? 0 : 2;
				}
			}
			juiceStep(j, f.dt);
			const before = s.pac.t;
			const ev = rkStep(s, f.dt, { dir }, rnd);
			if (s.phase === "play" && (before !== s.pac.t || s.pac.t > 0))
				mouth += f.dt;
			const [px, py] = rkPos(s.pac);
			const X = ox + px * c + c / 2;
			const Y = oy + py * c + c / 2;
			let dotSe = false;
			for (const e of ev) {
				if (e === "dot") dotSe = true;
				else if (e === "pellet") {
					f.se("rustproof");
					burst(j, X, Y, "#ff6060", 10, 50);
				} else if (e === "ghost") {
					f.se("enemyDown");
					burst(j, X, Y, "#80a0ff", 12, 70);
					quake(j, 2);
				} else if (e === "bonusShow") f.se("item");
				else if (e === "bonus") {
					f.se("arcBest");
					burst(j, X, Y, "#70e070", 10, 60);
				} else if (e === "die") {
					f.se("arcCrash");
					quake(j, 4);
					burst(j, X, Y, "#f0c8a8", 14, 80);
					pop(j, X, Y - 8, RK_TEXT.caught, "#ffb0b0");
				} else if (e === "clear") {
					f.se("victory");
					j.flash = 0.3;
				} else if (e === "level") f.se("arcStart");
			}
			if (dotSe && Math.floor(s.t * 8) % 2 === 0) f.se("cursor");
		},
		draw: (g, s, clock) => {
			const [ox, oy] = rkOrigin();
			const c = RK.cell;
			g.fillStyle = "#04040c";
			g.fillRect(0, 0, AW, AH);
			shaken(g, j, () => {
				const lit = s.phase === "clear" && Math.floor(clock * 6) % 2 === 0;
				drawMaze(g, ox, oy, lit);
				// レスと 通報
				for (let y = 0; y < RK.rows; y++)
					for (let x = 0; x < RK.cols; x++) {
						const d = s.dots[y][x];
						const X = ox + x * c;
						const Y = oy + y * c;
						if (d === ".") {
							g.fillStyle = "#e8e0c8";
							g.fillRect(X + 3, Y + 4, 3, 1);
						} else if (d === "o" && Math.floor(clock * 4) % 2 === 0)
							chip(
								g,
								X + c / 2,
								Y + c / 2,
								8,
								8,
								"#d83030",
								RK_TEXT.pellet,
								"#ffffff",
								7,
							);
					}
				// 草
				if (s.bonus && (s.bonus.t > 2 || Math.floor(clock * 8) % 2 === 0)) {
					const [bx, by] = RK.bonus;
					chip(
						g,
						ox + bx * c + c / 2,
						oy + by * c + c / 2,
						9,
						9,
						"#2a8a30",
						RK_TEXT.bonus,
						"#d0ffc0",
						7,
					);
				}
				// 迷路の 外へ はみ出た ぶんは 描かない（抜け道）
				g.save();
				g.beginPath();
				g.rect(ox, oy, RK.cols * c, RK.rows * c);
				g.clip();
				const wrap = (px: number): number =>
					px > RK.cols - 0.5 ? px - RK.cols : px < -0.5 ? px + RK.cols : px;
				if (!(s.phase === "die" && s.pause < RK.dieTime - 0.6)) {
					for (const h of s.ghosts) {
						if (s.phase === "die" && h.mode !== "eyes") continue;
						const [gx, gy] = rkPos(h);
						const bob =
							h.mode === "house" ? Math.round(Math.sin(clock * 6 + h.kind)) : 0;
						drawGhost(
							g,
							s,
							h,
							ox + wrap(gx) * c + c / 2,
							oy + gy * c + c / 2 + bob,
							clock,
						);
					}
				}
				const [px, py] = rkPos(s.pac);
				const dying = s.phase === "die";
				if (!dying || Math.floor(clock * 10) % 2 === 0)
					drawKiriko(
						g,
						ox + wrap(px) * c + c / 2,
						oy + py * c + c / 2,
						s.pac.dir,
						!dying && Math.floor(mouth * 10) % 2 === 0,
					);
				g.restore();
				for (const p of s.pops) {
					const X = ox + p.x * c + c / 2;
					const Y = Math.round(oy + p.y * c - 2 - p.t * 10);
					txt(g, p.text, X + 1, Y + 1, 7, "#000000", "center");
					txt(g, p.text, X, Y, 7, "#80e0ff", "center");
				}
				if (s.phase === "ready") {
					txt(
						g,
						ARCADE.ready,
						ox + 9.5 * c,
						oy + 9 * c + 1,
						7,
						"#ffe060",
						"center",
					);
				} else if (s.phase === "clear")
					txt(
						g,
						RK_TEXT.next,
						ox + 9.5 * c,
						oy + 7 * c + 1,
						7,
						"#ffe060",
						"center",
					);
			});
			juiceDraw(g, j, AW, AH);
			// 青い 残りの 帯
			if (s.fright > 0) {
				g.fillStyle = "#2838c8";
				g.fillRect(0, AH - 2, Math.round((AW * s.fright) / rkFrightTime(s)), 2);
			}
			hud(
				g,
				`${ARCADE_BOARD.score} ${rkScore(s)}`,
				`${RK_TEXT.level} ${s.level}　${ARCADE_BOARD.lives} ${Math.max(0, s.lives)}`,
			);
		},
		over: (s) => s.over,
		score: rkScore,
	});
};
