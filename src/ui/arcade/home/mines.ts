// キリコの 家の ゲーム「地雷スレ」の 板（決まりは data/arcade/home/mines.ts、文は data/arcade/text.ts）。
// - 古い パソコンの 窓。十字キーで カーソル、A で 開く。カーソルを 右はしの 先へ 出すと「旗」の ボタン、A で 切りかえ。
// - タップは マスを 開く（旗の ときは 立てる）。右の「旗」の ボタンを タップで 切りかえ。
// - 開いた 数字を もう 1回 押すと まわりを まとめて 開く。
// 見た目の 乱数は Math.random（冒険の 乱数に さわらない）。

import {
	MS,
	MS_TEXT,
	type MsEvent,
	msFlag,
	msFlags,
	msOpen,
	msScore,
	msStart,
	msTick,
	msTimeLeft,
} from "../../../data/arcade/home/mines";
import { ARCADE, ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import type { G } from "../../neta/netaBoard";
import { txt } from "../../neta/netaBoard";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

/** 窓と マスと ボタンの 位置（画素）。 */
const WIN = { x: 2, y: 15, w: 236, h: 134 } as const;
const GX = 5;
const GY = 27;
const BTN = { x: 217, y: 30, w: 18, h: 26 } as const;

/** 数字の 色（むかしの 窓の 色）。 */
const INK = [
	"",
	"#1010e0",
	"#108010",
	"#e01010",
	"#101080",
	"#801010",
	"#108080",
	"#101010",
	"#707070",
];

/** 盛りあがった ふち（押された ときは 逆）。 */
const bevel = (
	g: G,
	x: number,
	y: number,
	w: number,
	h: number,
	sunk = false,
): void => {
	g.fillStyle = "#c0c0c0";
	g.fillRect(x, y, w, h);
	g.fillStyle = sunk ? "#808080" : "#ffffff";
	g.fillRect(x, y, w, 1);
	g.fillRect(x, y, 1, h);
	g.fillStyle = sunk ? "#ffffff" : "#808080";
	g.fillRect(x, y + h - 1, w, 1);
	g.fillRect(x + w - 1, y, 1, h);
};

const flagIcon = (g: G, x: number, y: number): void => {
	g.fillStyle = "#101010";
	g.fillRect(x, y - 4, 1, 8);
	g.fillRect(x - 2, y + 4, 5, 1);
	g.fillStyle = "#e01010";
	g.fillRect(x - 3, y - 4, 3, 3);
	g.fillRect(x - 2, y - 1, 2, 1);
};

const mineIcon = (g: G, x: number, y: number): void => {
	g.fillStyle = "#101010";
	g.fillRect(x - 3, y - 2, 6, 4);
	g.fillRect(x - 2, y - 3, 4, 6);
	g.fillRect(x - 4, y, 8, 1);
	g.fillRect(x, y - 4, 1, 8);
	g.fillStyle = "#ffffff";
	g.fillRect(x - 1, y - 1, 1, 1);
};

export const playMines = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let cx = 0;
	let cy = 0;
	/** true なら 押すと 旗。 */
	let flagMode = false;
	/** おわってからの 秒（踏んだ 所から 地雷を 順に 見せて から おわる）。 */
	let endT = 0;
	/** 踏んだ 所から 地雷が 見えて いく 速さ（マス／秒）。 */
	const SPREAD = 14;
	return playBoard(ctx, "mines", {
		start: () => {
			endT = 0;
			cx = Math.floor(MS.cols / 2);
			cy = Math.floor(MS.rows / 2);
			flagMode = false;
			return msStart();
		},
		step: (s, f) => {
			if (s.over) endT += f.dt;
			const evs: MsEvent[] = [...msTick(s, f.dt)];
			const act = (x: number, y: number) => {
				evs.push(...(flagMode ? msFlag : msOpen)(s, x, y, rnd));
			};
			const toggle = () => {
				flagMode = !flagMode;
				f.se("decide");
			};
			for (const e of f.evs) {
				if (s.over) break;
				if (isKey(e, "left", true)) {
					cx = Math.max(0, cx - 1);
					f.se("cursor");
				} else if (isKey(e, "right", true)) {
					// 右はしの 先は「旗」の ボタン
					cx = Math.min(MS.cols, cx + 1);
					f.se("cursor");
				} else if (isKey(e, "up", true)) {
					if (cx < MS.cols) cy = Math.max(0, cy - 1);
					f.se("cursor");
				} else if (isKey(e, "down", true)) {
					if (cx < MS.cols) cy = Math.min(MS.rows - 1, cy + 1);
					f.se("cursor");
				} else if (isKey(e, "a")) {
					if (cx === MS.cols) toggle();
					else act(cx, cy);
				} else if (isTap(e)) {
					const [tx, ty] = e.tap;
					if (
						tx >= BTN.x - 2 &&
						tx < BTN.x + BTN.w + 2 &&
						ty >= BTN.y - 2 &&
						ty < BTN.y + BTN.h + 2
					) {
						toggle();
						continue;
					}
					const gx = Math.floor((tx - GX) / MS.cell);
					const gy = Math.floor((ty - GY) / MS.cell);
					if (gx < 0 || gy < 0 || gx >= MS.cols || gy >= MS.rows) continue;
					cx = gx;
					cy = gy;
					act(gx, gy);
				}
			}
			for (const e of evs) {
				if (e === "open") f.se("put");
				else if (e === "flag") f.se("cardFlip");
				else if (e === "unflag") f.se("cancel");
				else if (e === "boom") f.se("explosion");
			}
		},
		draw: (g, s, clock) => {
			const c = MS.cell;
			// 机（窓の 外）
			g.fillStyle = "#008080";
			g.fillRect(0, 0, 240, 150);
			bevel(g, WIN.x, WIN.y, WIN.w, WIN.h);
			// 題の 帯
			g.fillStyle = "#000080";
			g.fillRect(WIN.x + 2, WIN.y + 2, WIN.w - 4, 9);
			txt(g, MS_TEXT.window, WIN.x + 5, WIN.y + 3, 7, "#ffffff");
			bevel(g, WIN.x + WIN.w - 11, WIN.y + 3, 8, 7);
			txt(g, "x", WIN.x + WIN.w - 7, WIN.y + 2, 7, "#101010", "center");
			// マス
			g.fillStyle = "#808080";
			g.fillRect(GX - 1, GY - 1, MS.cols * c + 2, MS.rows * c + 2);
			for (let y = 0; y < MS.rows; y++)
				for (let x = 0; x < MS.cols; x++) {
					const m = s.grid[y][x];
					const X = GX + x * c;
					const Y = GY + y * c;
					const near = s.boom
						? Math.hypot(x - s.boom[0], y - s.boom[1]) <= endT * SPREAD
						: true;
					const show = m.open || (s.over && m.mine && !m.flag && near);
					if (!show) {
						bevel(g, X, Y, c, c);
						if (m.flag) flagIcon(g, X + 7, Y + 6);
						continue;
					}
					const hit = s.boom && s.boom[0] === x && s.boom[1] === y;
					g.fillStyle = hit ? "#ff3030" : "#c8c8c8";
					g.fillRect(X, Y, c, c);
					g.fillStyle = "#909090";
					g.fillRect(X, Y, c, 1);
					g.fillRect(X, Y, 1, c);
					if (m.mine) mineIcon(g, X + 7, Y + 7);
					else if (m.n)
						txt(g, String(m.n), X + 7, Y + 2, 9, INK[m.n], "center");
				}
			// 「旗」の ボタン
			bevel(g, BTN.x, BTN.y, BTN.w, BTN.h, flagMode);
			if (flagMode) {
				g.fillStyle = "#f0d0d0";
				g.fillRect(BTN.x + 1, BTN.y + 1, BTN.w - 2, BTN.h - 2);
			}
			flagIcon(g, BTN.x + BTN.w / 2 + 1, BTN.y + 8);
			txt(
				g,
				MS_TEXT.flag,
				BTN.x + BTN.w / 2,
				BTN.y + 15,
				8,
				flagMode ? "#c01010" : "#303030",
				"center",
			);
			txt(
				g,
				flagMode ? MS_TEXT.flag : MS_TEXT.open,
				BTN.x + BTN.w / 2,
				BTN.y + BTN.h + 4,
				7,
				"#101010",
				"center",
			);
			// カーソル（点滅）
			if (!s.over && Math.floor(clock * 3) % 3 !== 0) {
				const [X, Y, W, H] =
					cx === MS.cols
						? [BTN.x - 1, BTN.y - 1, BTN.w + 2, BTN.h + 2]
						: [GX + cx * c - 1, GY + cy * c - 1, c + 2, c + 2];
				g.fillStyle = "#e02020";
				g.fillRect(X, Y, W, 1);
				g.fillRect(X, Y + H - 1, W, 1);
				g.fillRect(X, Y, 1, H);
				g.fillRect(X + W - 1, Y, 1, H);
			}
			hud(
				g,
				`${ARCADE_BOARD.score} ${msScore(s)}　${MS_TEXT.mines} ${MS.mines - msFlags(s)}`,
				`TIME ${msTimeLeft(s)}`,
			);
		},
		// 踏んだら 地雷が 広がって 見えおわる まで 待つ
		over: (s) => s.over && endT >= (s.boom ? 1.2 : 0.3),
		score: msScore,
		end: (s) => (s.clear ? ARCADE.clear : ARCADE.over),
	});
};
