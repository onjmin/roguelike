// 穴掘りキリコ の 板（決まりは data/arcade/home/digkiriko.ts）。
// 十字キーは 押している あいだ 掘りすすむ（短く 押しても 1マスは すすむ）。A で ポンプ（押しっぱなしでも ふくらむ）。
// タップは キリコの まわりなら ポンプ、ほかは その マスへ 向かって 掘りすすむ（縦と 横の 遠い ほうから）。

import { DX, DY } from "../../../core/geom";
import {
	DK,
	DK_DIRS,
	DK_TEXT,
	type DkDir,
	type DkFoe,
	type DkState,
	dkFireCells,
	dkLayer,
	dkOpen,
	dkOrigin,
	dkPos,
	dkRockAt,
	dkScore,
	dkStart,
	dkStep,
} from "../../../data/arcade/home/digkiriko";
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

/** 土の 色（浅い → 深い）と その 粒。 */
const DIRT = ["#d8a858", "#c07838", "#9a5028", "#6a3020"];
const GRAIN = ["#b88840", "#a05e28", "#7a3c1c", "#4a2014"];

/** ヘルメットの キリコ（cx, cy は マスの まんなか）。 */
const drawKiriko = (
	g: G,
	cx: number,
	cy: number,
	step: number,
	face: DkDir,
): void => {
	const X = Math.round(cx);
	const Y = Math.round(cy);
	// ヘルメット（前に 明かり）
	g.fillStyle = "#e8a020";
	g.fillRect(X - 3, Y - 5, 7, 2);
	g.fillRect(X - 4, Y - 3, 9, 1);
	g.fillStyle = "#fff8b0";
	g.fillRect(face === 3 ? X - 3 : X + 2, Y - 5, 1, 1);
	// 髪と 顔
	g.fillStyle = "#72241f";
	g.fillRect(X - 3, Y - 2, 1, 3);
	g.fillRect(X + 3, Y - 2, 1, 3);
	g.fillStyle = "#f0c8a8";
	g.fillRect(X - 2, Y - 2, 5, 2);
	g.fillStyle = "#031c3e";
	g.fillRect(X - 1, Y - 2, 1, 1);
	g.fillRect(X + 1, Y - 2, 1, 1);
	// 緑の 服・黄土色の スカート・足
	g.fillStyle = "#28a131";
	g.fillRect(X - 3, Y, 7, 2);
	g.fillStyle = "#926855";
	g.fillRect(X - 3, Y + 2, 7, 1);
	g.fillStyle = "#353333";
	g.fillRect(X - 2 + step, Y + 3, 2, 1);
	g.fillRect(X + 1 - step, Y + 3, 2, 1);
};

/** 荒らし・炎上（目だけ・ふくらみ・火を ためる）。 */
const drawFoe = (
	g: G,
	f: DkFoe,
	cx: number,
	cy: number,
	clock: number,
): void => {
	const X = Math.round(cx);
	const Y = Math.round(cy);
	if (f.ghost > 0) {
		if (Math.floor(clock * 10) % 3 === 0) return;
		g.fillStyle = "#ffffff";
		g.fillRect(X - 3, Y - 1, 2, 2);
		g.fillRect(X + 1, Y - 1, 2, 2);
		g.fillStyle = f.kind === "enjo" ? "#40e050" : "#ff4040";
		g.fillRect(X - 2, Y, 1, 1);
		g.fillRect(X + 2, Y, 1, 1);
		return;
	}
	const base = f.kind === "enjo" ? "#30a040" : "#c83030";
	if (f.inflate > 0) {
		const w = 8 + f.inflate * 3;
		const lit = f.kind === "enjo" ? "#80e080" : "#f08080";
		g.fillStyle = base;
		g.fillRect(X - w / 2, Y - w / 2, w, w);
		g.fillStyle = lit;
		g.fillRect(X - w / 2 + 1, Y - w / 2 + 1, w - 2, w - 2);
		g.fillStyle = "#ffffff";
		g.fillRect(X - w / 2 + 2, Y - w / 2 + 2, 2, 2);
		g.fillStyle = "#401010";
		g.fillRect(X - 3, Y - 1, 2, 2);
		g.fillRect(X + 2, Y - 1, 2, 2);
		return;
	}
	const wind = f.fire?.phase === "wind" && Math.floor(clock * 12) % 2 === 0;
	chip(
		g,
		X,
		Y,
		8,
		8,
		wind ? "#ffd040" : base,
		f.kind === "enjo" ? DK_TEXT.enjo : DK_TEXT.arashi,
		"#ffffff",
		7,
	);
	// 目（ゴーグル）
	g.fillStyle = "#ffffff";
	const ex = f.dir === 3 ? -3 : f.dir === 1 ? 1 : -1;
	g.fillRect(X + ex, Y - 4, 3, 1);
};

export const playDigkiriko = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	const j = juice();
	// タップで 決めた 行き先・短く 押した 向き
	let target: readonly [number, number] | null = null;
	let nudge: DkDir | null = null;
	let nudgeT = 0;
	let walk = 0;
	return playBoard(ctx, "digkiriko", {
		note: DK_TEXT.note,
		start: () => dkStart(rnd),
		step: (s, f) => {
			const [ox, oy] = dkOrigin();
			const c = DK.cell;
			let pump = false;
			for (const e of f.evs) {
				if (isKey(e, "a", true)) pump = true;
				else if (isTap(e)) {
					const [px, py] = dkPos(s.player);
					const tx = (e.tap[0] - ox) / c - 0.5;
					const ty = (e.tap[1] - oy) / c - 0.5;
					if (Math.hypot(tx - px, ty - py) < 1.3) {
						pump = true;
						target = null;
					} else
						target = [
							Math.max(0, Math.min(DK.cols - 1, Math.round(tx))),
							Math.max(0, Math.min(DK.rows - 1, Math.round(ty))),
						];
				} else {
					const k = KEYS.findIndex((k) => isKey(e, k));
					if (k >= 0) {
						nudge = k as DkDir;
						nudgeT = 0.2;
						target = null;
					}
				}
			}
			nudgeT -= f.dt;
			let dir: DkDir | null = nudgeT > 0 ? nudge : null;
			const hd = ctx.input.heldDir();
			if (hd !== null) {
				target = null;
				const dx = DX[hd];
				const dy = DY[hd];
				if (dx) dir = dx > 0 ? 1 : 3;
				else if (dy) dir = dy > 0 ? 2 : 0;
			} else if (target && s.phase === "play") {
				const p = s.player;
				const ddx = target[0] - p.x;
				const ddy = target[1] - p.y;
				if (ddx === 0 && ddy === 0) {
					if (p.t === 0) target = null;
				} else {
					const h: DkDir = ddx > 0 ? 1 : 3;
					const v: DkDir = ddy > 0 ? 2 : 0;
					const first = Math.abs(ddx) >= Math.abs(ddy) ? h : v;
					const second = first === h ? v : h;
					const free = (d: DkDir): boolean => {
						const [ax, ay] = DK_DIRS[d];
						return !dkRockAt(s, p.x + ax, p.y + ay);
					};
					dir =
						p.t > 0
							? p.dir
							: free(first) || (first === h ? ddy === 0 : ddx === 0)
								? first
								: second;
				}
			}
			juiceStep(j, f.dt);
			const moving0 = s.player.t;
			const ev = dkStep(s, f.dt, { dir, pump }, rnd);
			if (s.player.t !== moving0) walk += f.dt;
			const [px, py] = dkPos(s.player);
			const PX = ox + px * c + c / 2;
			const PY = oy + py * c + c / 2;
			let digSe = false;
			for (const e of ev) {
				if (e === "dig") digSe = true;
				else if (e === "hose") f.se("throw");
				else if (e === "hit") f.se("hit_fist");
				else if (e === "pump") f.se("bubble");
				else if (e === "pop") {
					f.se("enemyDown");
					const p = s.pops[s.pops.length - 1];
					if (p) {
						const X = ox + p.x * c + c / 2;
						const Y = oy + p.y * c + c / 2;
						burst(j, X, Y, "#ffffff", 14, 80);
						burst(j, X, Y, "#f08080", 8, 50);
					}
					quake(j, 2);
				} else if (e === "wobble") f.se("tripOn");
				else if (e === "crumble") {
					f.se("arcBlock");
					const r = s.rocks.find((r) => r.state === "fall");
					if (r)
						pop(
							j,
							ox + r.x * c + c / 2,
							oy + r.fy * c - 2,
							DK_TEXT.crush,
							"#f0e0c0",
						);
				} else if (e === "crush") {
					f.se("explosion");
					quake(j, 4);
					j.flash = 0.2;
				} else if (e === "fire") f.se("fire");
				else if (e === "die") {
					f.se("arcCrash");
					quake(j, 4);
					burst(j, PX, PY, "#f0c8a8", 14, 70);
					target = null;
				} else if (e === "clear") f.se("victory");
				else if (e === "round") f.se("arcStart");
			}
			if (digSe && Math.floor(s.t * 6) % 2 === 0) f.se("cursor");
			// 崩れた 岩の くだける 粉
			for (const r of s.rocks)
				if (r.state === "break" && r.t > DK.rockBreak - f.dt * 1.5)
					burst(
						j,
						ox + r.x * c + c / 2,
						oy + r.fy * c + c / 2,
						"#a0a0a8",
						10,
						50,
					);
		},
		draw: (g, s, clock) => {
			const [ox, oy] = dkOrigin();
			const c = DK.cell;
			g.fillStyle = "#08060a";
			g.fillRect(0, 0, AW, AH);
			shaken(g, j, () => {
				// 空と 地上
				g.fillStyle = "#78b8e8";
				g.fillRect(0, 14, AW, oy + c - 14);
				g.fillStyle = "#a8d8f8";
				for (let i = 0; i < 4; i++) {
					const x = Math.round(((i * 70 + clock * 4) % (AW + 40)) - 20);
					g.fillRect(x, 16 + (i % 2) * 2, 14, 2);
				}
				// 土（深い ほど 濃い）と 掘った 穴
				for (let y = 1; y < DK.rows; y++)
					for (let x = 0; x < DK.cols; x++) {
						const X = ox + x * c;
						const Y = oy + y * c;
						if (s.dug[y][x]) {
							g.fillStyle = "#140c0a";
							g.fillRect(X, Y, c, c);
							continue;
						}
						const L = dkLayer(y);
						g.fillStyle = DIRT[L];
						g.fillRect(X, Y, c, c);
						g.fillStyle = GRAIN[L];
						g.fillRect(
							X + ((x * 5 + y * 3) % 6),
							Y + ((x * 3 + y) % 5) + 1,
							2,
							1,
						);
						// 穴の ふちを 濃く
						if (dkOpen(s, x, y - 1) && y > 1) {
							g.fillStyle = GRAIN[L];
							g.fillRect(X, Y, c, 1);
						}
					}
				// 地上の 草
				g.fillStyle = "#48a038";
				for (let x = 0; x < DK.cols; x++)
					if (!s.dug[1][x]) g.fillRect(ox + x * c, oy + c, c, 2);
				// 地面の 外の ふち
				g.fillStyle = "#3a2018";
				g.fillRect(0, oy + c, ox, AH - oy - c);
				g.fillRect(
					ox + DK.cols * c,
					oy + c,
					AW - ox - DK.cols * c,
					AH - oy - c,
				);
				// 岩
				for (const r of s.rocks) {
					if (r.state === "break") continue;
					const wob =
						r.state === "wobble" ? (Math.floor(clock * 20) % 2 ? 1 : -1) : 0;
					const X = ox + r.x * c + wob;
					const Y = Math.round(oy + r.fy * c);
					g.fillStyle = "#505058";
					g.fillRect(X + 1, Y, c - 2, c);
					g.fillRect(X, Y + 1, c, c - 2);
					g.fillStyle = "#9898a4";
					g.fillRect(X + 1, Y + 1, c - 3, c - 3);
					g.fillStyle = "#c8c8d4";
					g.fillRect(X + 2, Y + 1, 2, 1);
				}
				// 火
				for (const f of s.foes)
					for (const [x, y] of dkFireCells(f)) {
						const X = ox + x * c;
						const Y = oy + y * c;
						const flick = Math.floor(clock * 16 + x) % 2;
						g.fillStyle = "#e84010";
						g.fillRect(X, Y + 1 + flick, c, c - 2);
						g.fillStyle = "#ffc030";
						g.fillRect(X + 1, Y + 3 - flick, c - 2, 2);
					}
				// 敵
				for (const f of s.foes) {
					const [fx, fy] = dkPos(f);
					drawFoe(g, f, ox + fx * c + c / 2, oy + fy * c + c / 2, clock);
				}
				// ポンプ
				const [px, py] = dkPos(s.player);
				const PX = ox + px * c + c / 2;
				const PY = oy + py * c + c / 2;
				const h = s.hose;
				if (h && s.phase === "play") {
					const [dx, dy] = DK_DIRS[h.dir];
					const L = Math.round(h.len * c);
					g.fillStyle = "#f0f0f8";
					if (dx) g.fillRect(dx > 0 ? PX + 3 : PX - 3 - L, PY, L, 1);
					else g.fillRect(PX, dy > 0 ? PY + 3 : PY - 3 - L, 1, L);
					g.fillStyle = "#60c0f0";
					g.fillRect(PX + dx * (L + 3) - 1, PY + dy * (L + 3) - 1, 3, 3);
				}
				const dying = s.phase === "die";
				if (!dying || Math.floor(clock * 10) % 2 === 0)
					drawKiriko(g, PX, PY, Math.floor(walk * 8) % 2, s.face);
				for (const p of s.pops) {
					const X = ox + p.x * c + c / 2;
					const Y = Math.round(oy + p.y * c - 4 - p.t * 10);
					txt(g, p.text, X + 1, Y + 1, 7, "#000000", "center");
					txt(g, p.text, X, Y, 7, "#ffffff", "center");
				}
				if (s.phase === "ready")
					txt(g, ARCADE.ready, AW / 2, oy + 7 * c, 8, "#ffe060", "center");
				else if (s.phase === "clear")
					txt(g, DK_TEXT.next, AW / 2, oy + 7 * c, 8, "#ffe060", "center");
			});
			juiceDraw(g, j, AW, AH);
			hud(
				g,
				`${ARCADE_BOARD.score} ${dkScore(s)}`,
				`${s.round}${DK_TEXT.round}　${ARCADE_BOARD.lives} ${Math.max(0, s.lives)}`,
			);
		},
		over: (s: DkState) => s.over,
		score: dkScore,
	});
};
