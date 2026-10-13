// キリコの 家の ゲーム「大草原2048」の 板（決まりは data/arcade/home/grass.ts、文は data/arcade/text.ts）。
// - 十字キーで 寄せる。タップは 盤の まんなかから 見て、タップした 向きへ 寄せる。
// - くっついた 草と 生えた 草は ぽんと 弾む。
// 見た目の 乱数は Math.random（冒険の 乱数に さわらない）。

import {
	GR,
	GR_TEXT,
	type GrDir,
	grBest,
	grMove,
	grName,
	grScore,
	grStart,
} from "../../../data/arcade/home/grass";
import { ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import { txt } from "../../neta/netaBoard";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

const TILE = 30;
const GAP = 3;
const SIDE = GR.size * TILE + (GR.size + 1) * GAP;
const OX = Math.floor((240 - SIDE) / 2);
const OY = 15;

/** 段ごとの 色（地の 色・字の 色）。 */
const TONES: readonly (readonly [string, string])[] = [
	["#e4f0c8", "#3a5020"],
	["#cce8a0", "#2e4818"],
	["#a8dc78", "#264010"],
	["#88cc58", "#1e3408"],
	["#68b840", "#ffffff"],
	["#4ea030", "#ffffff"],
	["#3a8828", "#ffffff"],
	["#2c7020", "#ffffff"],
	["#205a1c", "#e8f8d0"],
	["#184618", "#e8f8d0"],
	["#0e3414", "#f0d870"],
	["#3a2c60", "#f0e8ff"],
];

/** 字の 大きさ（長い 名前ほど 小さく）。 */
const pxOf = (s: string): number =>
	s.length <= 1
		? 13
		: s.length === 2
			? 11
			: s.length === 3
				? 9
				: s.length === 4
					? 7
					: 6;

export const playGrass = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let movedAt = -1;
	let goalAt = -9;
	/** いちばん 育った 草。 */
	let top = 4;
	return playBoard(ctx, "grass", {
		start: () => grStart(rnd),
		step: (s, f) => {
			for (const e of f.evs) {
				let dir: GrDir | null = null;
				if (isKey(e, "left", true)) dir = "left";
				else if (isKey(e, "right", true)) dir = "right";
				else if (isKey(e, "up", true)) dir = "up";
				else if (isKey(e, "down", true)) dir = "down";
				else if (isTap(e)) {
					const dx = e.tap[0] - (OX + SIDE / 2);
					const dy = e.tap[1] - (OY + SIDE / 2);
					if (Math.abs(dx) >= Math.abs(dy)) dir = dx < 0 ? "left" : "right";
					else dir = dy < 0 ? "up" : "down";
				}
				if (!dir) continue;
				const ev = grMove(s, dir, rnd);
				if (!ev.length) continue;
				movedAt = f.clock;
				if (ev.includes("goal")) {
					goalAt = f.clock;
					f.se("levelup");
				} else if (ev.includes("merge")) f.se("bubble");
				else f.se("cursor");
				// 新しい 段に 届いたら 名を 出す（草草・大草原 までは 出さない）
				const best = grBest(s);
				if (best > top) {
					top = best;
					if (best >= 32 && !ev.includes("goal")) {
						f.se("jingle");
						f.say(GR_TEXT.grew.replace("{name}", grName(best)));
					}
				}
				if (s.over) break;
			}
		},
		draw: (g, s, clock) => {
			g.fillStyle = "#1a2a14";
			g.fillRect(0, 0, 240, 150);
			// 盤
			g.fillStyle = "#8a7a50";
			g.fillRect(OX, OY, SIDE, SIDE);
			const since = movedAt < 0 ? 1 : clock - movedAt;
			for (let y = 0; y < GR.size; y++)
				for (let x = 0; x < GR.size; x++) {
					const X = OX + GAP + x * (TILE + GAP);
					const Y = OY + GAP + y * (TILE + GAP);
					g.fillStyle = "#a8986a";
					g.fillRect(X, Y, TILE, TILE);
					const v = s.grid[y][x];
					if (!v) continue;
					// 弾み：くっついた 草は ふくらみ、生えた 草は 小さく 出る
					let k = 1;
					if (since < 0.14) {
						const u = since / 0.14;
						if (s.merged.some(([mx, my]) => mx === x && my === y))
							k = 1 + 0.16 * (1 - u);
						else if (s.born && s.born[0] === x && s.born[1] === y)
							k = 0.4 + 0.6 * u;
					}
					const w = Math.round(TILE * k);
					const lv = Math.min(TONES.length - 1, Math.log2(v) - 1);
					const [bg, ink] = TONES[lv];
					const L = X + Math.round((TILE - w) / 2);
					const T = Y + Math.round((TILE - w) / 2);
					g.fillStyle = bg;
					g.fillRect(L, T, w, w);
					g.fillStyle = "rgba(0,0,0,0.18)";
					g.fillRect(L, T + w - 2, w, 2);
					if (k < 0.8) continue;
					const name = grName(v);
					const px = pxOf(name);
					txt(g, name, X + TILE / 2, Y + 15 - px / 2 - 2, px, ink, "center");
					txt(g, String(v), X + TILE - 2, Y + TILE - 8, 5, ink, "right");
				}
			hud(
				g,
				`${ARCADE_BOARD.score} ${grScore(s)}`,
				`${GR_TEXT.best} ${grName(grBest(s))}`,
			);
			if (clock - goalAt < 1.5)
				txt(g, GR_TEXT.goal, 120, OY + SIDE / 2 - 6, 12, "#f0d870", "center");
		},
		over: (s) => s.over,
		score: grScore,
	});
};
