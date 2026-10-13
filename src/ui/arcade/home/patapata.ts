// ぱたぱたぷゆゆ の 板（決まりは data/arcade/home/patapata.ts）。
// A か タップ（どこでも）で はばたく。十字キーの ↑ も はばたく。

import {
	PP,
	PP_TEXT,
	type PpPillar,
	type PpState,
	ppMedal,
	ppScore,
	ppStart,
	ppStep,
} from "../../../data/arcade/home/patapata";
import { AH, ATOP, AW } from "../../../data/arcade/logic";
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

/** メダルの 色（銅・銀・金・白金）。 */
const MEDAL_INK = ["#c87838", "#c8ccd8", "#f0c838", "#e8f4ff"];

/** ぷゆゆ（丸い 体に うるんだ 目。はばたくと つぶれて、羽が 上がる）。 */
const drawPuyu = (g: G, s: PpState, clock: number): void => {
	const X = PP.x;
	const Y = Math.round(s.y);
	// つぶれ（はばたいた すぐ あと は 横に、速く 下る ときは 縦に）
	const sq = s.flapT < 0.12 ? 2 : s.vy > 150 ? -1 : 0;
	const w = 11 + sq;
	const h = 10 - sq;
	const L = X - Math.floor(w / 2);
	const T = Y - Math.floor(h / 2);
	// 羽（うしろ）
	const up = s.flapT < 0.15 || (!s.started && Math.floor(clock * 6) % 2 === 0);
	g.fillStyle = "#fff4c0";
	if (up) g.fillRect(L - 3, T - 1, 4, 3);
	else g.fillRect(L - 3, T + h / 2, 4, 3);
	// 体
	g.fillStyle = "#c89818";
	g.fillRect(L, T + 1, w, h - 1);
	g.fillRect(L + 1, T, w - 2, h);
	g.fillStyle = "#f0c838";
	g.fillRect(L + 1, T + 1, w - 2, h - 2);
	g.fillStyle = "#fff0a0";
	g.fillRect(L + 2, T + 1, 3, 1);
	// 目（うるうる）：大きい 黒目に 白い 光 2つ、下に 涙
	if (s.hit > 0) {
		g.fillStyle = "#2a1408";
		g.fillRect(X - 3, T + 3, 1, 1);
		g.fillRect(X - 1, T + 3, 1, 1);
		g.fillRect(X - 2, T + 4, 1, 1);
		g.fillRect(X + 2, T + 3, 1, 1);
		g.fillRect(X + 4, T + 3, 1, 1);
		g.fillRect(X + 3, T + 4, 1, 1);
	} else {
		g.fillStyle = "#2a1408";
		g.fillRect(X - 3, T + 2, 3, 4);
		g.fillRect(X + 2, T + 2, 3, 4);
		g.fillStyle = "#ffffff";
		g.fillRect(X - 3, T + 2, 1, 1);
		g.fillRect(X + 2, T + 2, 1, 1);
		g.fillRect(X - 1, T + 4, 1, 1);
		g.fillRect(X + 4, T + 4, 1, 1);
		// 八の字の まゆ
		g.fillStyle = "#8a5a10";
		g.fillRect(X - 3, T + 1, 1, 1);
		g.fillRect(X - 2, T, 1, 1);
		g.fillRect(X + 4, T + 1, 1, 1);
		g.fillRect(X + 3, T, 1, 1);
	}
	g.fillStyle = "#70c0f8";
	const drip = Math.floor(clock * 3) % 3;
	g.fillRect(X - 3, T + 6 + (drip === 2 ? 1 : 0), 1, 1 + (drip > 0 ? 1 : 0));
	g.fillRect(X + 4, T + 6, 1, 1);
	// 口
	g.fillStyle = "#8a4a10";
	g.fillRect(X, T + h - 3, 2, 1);
};

/** スレの 柱（ベージュの 欄に 名前の 緑と 本文の 罫）。 */
const drawColumn = (
	g: G,
	x: number,
	top: number,
	bottom: number,
	seed: number,
): void => {
	if (bottom <= top) return;
	const W = PP.pillarW;
	g.fillStyle = "#a89870";
	g.fillRect(x, top, W, bottom - top);
	g.fillStyle = "#f2ead6";
	g.fillRect(x + 1, top, W - 2, bottom - top);
	for (let y = top + 3, i = 0; y < bottom - 2; y += 4, i++) {
		const k = (seed * 7 + i * 3) % 5;
		if (k === 0) {
			g.fillStyle = "#2a8a2a";
			g.fillRect(x + 3, y, 6, 1);
			g.fillStyle = "#b0a890";
			g.fillRect(x + 11, y, 6, 1);
		} else {
			g.fillStyle = "#8a8070";
			g.fillRect(x + 4, y, 8 + ((seed + i * 5) % 7), 1);
		}
	}
};

const drawPillar = (g: G, p: PpPillar, seed: number, clock: number): void => {
	const X = Math.round(p.x);
	const W = PP.pillarW;
	const gTop = Math.round(p.gapY - p.gap / 2);
	const gBot = Math.round(p.gapY + p.gap / 2);
	const floor = AH - PP.ground;
	drawColumn(g, X, ATOP, gTop - 5, seed);
	drawColumn(g, X, gBot + 5, floor, seed + 3);
	// すきまの ふちの 見出し
	for (const y of [gTop - 5, gBot]) {
		g.fillStyle = "#7a6a48";
		g.fillRect(X - 2, y, W + 4, 5);
		g.fillStyle = "#d8c8a0";
		g.fillRect(X - 1, y + 1, W + 2, 3);
		g.fillStyle = "#c03030";
		g.fillRect(X + 2, y + 2, 3, 1);
	}
	// 玉
	if (p.coin) {
		const cx = X + W / 2;
		const cy = p.coin.y + Math.round(Math.sin(clock * 5 + seed));
		g.fillStyle = "#c09020";
		g.fillRect(cx - 3, cy - 4, 7, 9);
		g.fillRect(cx - 4, cy - 3, 9, 7);
		g.fillStyle = "#f8d850";
		g.fillRect(cx - 3, cy - 3, 7, 7);
		g.fillStyle = "#2a1408";
		g.fillRect(cx - 2, cy - 1, 2, 2);
		g.fillRect(cx + 1, cy - 1, 2, 2);
		g.fillStyle = "#ffffff";
		g.fillRect(cx - 2, cy - 1, 1, 1);
		g.fillRect(cx + 1, cy - 1, 1, 1);
	}
};

/** 町の 影（遠い・近い の 2段。dist で ずれる）。 */
const drawTown = (g: G, dist: number, clock: number): void => {
	const floor = AH - PP.ground;
	// 空（上から 夕方の 色へ）
	const sky = [
		"#202850",
		"#2c3868",
		"#46487a",
		"#6a5684",
		"#9a6484",
		"#c87a7a",
	];
	const band = (floor - ATOP) / sky.length;
	sky.forEach((ink, i) => {
		g.fillStyle = ink;
		g.fillRect(0, Math.floor(ATOP + i * band), AW, Math.ceil(band) + 1);
	});
	// 星
	g.fillStyle = "#d0d8ff";
	for (let i = 0; i < 12; i++) {
		if ((i + Math.floor(clock * 2)) % 7 === 0) continue;
		const x = Math.round((i * 53 - dist * 0.03) % AW);
		g.fillRect(x < 0 ? x + AW : x, ATOP + 4 + ((i * 17) % 34), 1, 1);
	}
	const row = (
		rate: number,
		base: string,
		lit: string,
		unit: number,
		tall: number,
	) => {
		const off = (dist * rate) % unit;
		for (let i = -1; i < AW / unit + 2; i++) {
			const k = Math.floor((dist * rate) / unit) + i;
			const hgt = tall * (0.45 + ((k * 37) % 11) / 20);
			const x = Math.round(i * unit - off);
			const y = Math.round(floor - hgt);
			g.fillStyle = base;
			g.fillRect(x, y, unit - 3, floor - y);
			g.fillStyle = lit;
			for (let wy = y + 4; wy < floor - 4; wy += 6)
				for (let wx = x + 3; wx < x + unit - 6; wx += 5)
					if ((k * 13 + wx * 3 + wy) % 7 < 2) g.fillRect(wx, wy, 2, 2);
		}
	};
	row(0.15, "#2a2a4a", "#6a6a90", 26, 60);
	row(0.4, "#181830", "#f0d070", 34, 44);
	// 地面
	g.fillStyle = "#3a3048";
	g.fillRect(0, floor, AW, PP.ground);
	g.fillStyle = "#5a4a68";
	g.fillRect(0, floor, AW, 1);
	const off = Math.floor(dist) % 8;
	g.fillStyle = "#2a2238";
	for (let x = -off; x < AW; x += 8) g.fillRect(x, floor + 4, 4, 2);
};

export const playPatapata = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	const j = juice();
	return playBoard(ctx, "patapata", {
		start: ppStart,
		step: (s, f) => {
			let flap = false;
			for (const e of f.evs)
				if (isKey(e, "a") || isKey(e, "up") || isTap(e)) flap = true;
			juiceStep(j, f.dt);
			const m0 = ppMedal(ppScore(s));
			for (const e of ppStep(s, f.dt, { flap }, rnd)) {
				if (e === "flap") f.se("arcJump");
				else if (e === "pass") f.se("arcCoin");
				else if (e === "coin") {
					f.se("item");
					burst(j, PP.x, s.y, "#f8d850", 8, 50);
					pop(j, PP.x, s.y - 10, "+1");
				} else if (e === "hit") {
					f.se("arcCrash");
					quake(j, 4);
					j.flash = 0.25;
					burst(j, PP.x, s.y, "#f0c838", 12, 70);
				}
			}
			const m = ppMedal(ppScore(s));
			if (m > m0) {
				f.se("arcBest");
				pop(
					j,
					PP.x,
					s.y - 14,
					`${PP_TEXT.medals[m]}${PP_TEXT.medal}`,
					MEDAL_INK[m],
				);
			}
		},
		draw: (g, s, clock) => {
			g.fillStyle = "#202850";
			g.fillRect(0, 0, AW, AH);
			shaken(g, j, () => {
				drawTown(g, s.dist, clock);
				s.pillars.forEach((p) => {
					drawPillar(g, p, p.id, clock);
				});
				drawPuyu(g, s, clock);
				// 大きな 点
				const n = String(ppScore(s));
				txt(g, n, AW / 2 + 1, ATOP + 5, 16, "#000000", "center");
				txt(g, n, AW / 2, ATOP + 4, 16, "#ffffff", "center");
				if (!s.started)
					txt(g, PP_TEXT.start, AW / 2, AH - 40, 8, "#ffe8a0", "center");
			});
			juiceDraw(g, j, AW, AH);
			const m = ppMedal(ppScore(s));
			hud(
				g,
				`${ARCADE_BOARD.score} ${ppScore(s)}`,
				m >= 0 ? `${PP_TEXT.medals[m]}${PP_TEXT.medal}` : "",
			);
		},
		over: (s) => s.over,
		score: ppScore,
		end: (s) => {
			const m = ppMedal(ppScore(s));
			return m >= 0 ? `${PP_TEXT.medals[m]}${PP_TEXT.medal}` : ARCADE.over;
		},
	});
};
