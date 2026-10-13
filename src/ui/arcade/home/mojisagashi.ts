// キリコさがしの 板（決まりは data/arcade/home/mojisagashi.ts）。左に 9×7 の 文字の 盤、右に さがす 名前。
// 十字キーで カーソル、A で はじめの 文字 → もう 1回 A で おわりの 文字。タップは その マスを えらぶ。
// えらんだ はじめの マスから カーソルまで 線を 引いて 見せる。見つけたら 線を 光らせて 次の 盤。

import {
	MOJI_TEXT,
	MS,
	type MsEvent,
	msLine,
	msMove,
	msPick,
	msScore,
	msStart,
	msStep,
	msTimeLeft,
	msWord,
} from "../../../data/arcade/home/mojisagashi";
import { AH, AW } from "../../../data/arcade/logic";
import { ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import { txt } from "../../neta/netaBoard";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;
const CELL = 16;
const OX = 6;
const OY = 19;

export const playMojisagashi = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	/** ちがった ときの 赤い 光（秒）。 */
	let missFx = 0;
	return playBoard(ctx, "mojisagashi", {
		start: () => msStart(rnd),
		note: MOJI_TEXT.note,
		step: (s, f) => {
			const evs: MsEvent[] = [];
			for (const e of f.evs) {
				if (isKey(e, "left", true)) evs.push(...msMove(s, -1, 0));
				else if (isKey(e, "right", true)) evs.push(...msMove(s, 1, 0));
				else if (isKey(e, "up", true)) evs.push(...msMove(s, 0, -1));
				else if (isKey(e, "down", true)) evs.push(...msMove(s, 0, 1));
				else if (isKey(e, "a")) evs.push(...msPick(s, s.cx, s.cy));
				else if (isTap(e)) {
					const x = Math.floor((e.tap[0] - OX) / CELL);
					const y = Math.floor((e.tap[1] - OY) / CELL);
					evs.push(...msPick(s, x, y));
				}
			}
			evs.push(...msStep(s, f.dt, rnd));
			missFx = Math.max(0, missFx - f.dt);
			for (const e of evs) {
				if (e === "move") f.se("cursor");
				else if (e === "anchor") {
					f.se("decide");
					f.say(MOJI_TEXT.pick);
				} else if (e === "unanchor") {
					f.se("cancel");
					f.say(MOJI_TEXT.note);
				} else if (e === "found") {
					f.se("levelup");
					f.say(`${MOJI_TEXT.found}　+${msWord(s).length * MS.perChar}`);
				} else if (e === "miss") {
					f.se("miss");
					f.say(MOJI_TEXT.miss);
					missFx = 0.35;
				}
			}
		},
		draw: (g, s, clock) => {
			// 冊子の 紙
			g.fillStyle = "#3a2e22";
			g.fillRect(0, 0, AW, AH);
			g.fillStyle = "#f2ead8";
			g.fillRect(OX - 3, OY - 3, MS.w * CELL + 6, MS.h * CELL + 6);
			// 引いて いる 線（はじめ → カーソル）と 見つけた 線
			const cur = s.cy * MS.w + s.cx;
			const pending =
				s.anchor >= 0 ? (msLine(s.anchor, cur) ?? [s.anchor]) : [];
			const lit = new Set(s.hit.length ? s.hit : pending);
			const word = msWord(s);
			for (let y = 0; y < MS.h; y++)
				for (let x = 0; x < MS.w; x++) {
					const i = y * MS.w + x;
					const px = OX + x * CELL;
					const py = OY + y * CELL;
					if (s.hit.length && lit.has(i)) {
						const k = Math.floor(clock * 10) % 2;
						g.fillStyle = k ? "#ff9a3a" : "#ffc85a";
						g.fillRect(px, py, CELL, CELL);
					} else if (lit.has(i)) {
						g.fillStyle =
							pending.length === word.length ? "#a8d8f0" : "#d8e4ec";
						g.fillRect(px, py, CELL, CELL);
					} else if ((x + y) % 2 === 0) {
						g.fillStyle = "#ebe2cc";
						g.fillRect(px, py, CELL, CELL);
					}
					if (i === s.anchor) {
						g.fillStyle = "#3a8ac8";
						g.fillRect(px, py, CELL, CELL);
					}
					const ink = i === s.anchor ? "#ffffff" : "#2a2018";
					txt(g, s.cells[i] ?? "", px + CELL / 2, py + 2, 12, ink, "center");
				}
			if (missFx > 0) {
				g.fillStyle = `rgba(220,40,40,${missFx})`;
				g.fillRect(OX, OY, MS.w * CELL, MS.h * CELL);
			}
			// カーソル（点滅する わく）
			if (s.flash <= 0 && Math.floor(clock * 4) % 4 !== 0) {
				const px = OX + s.cx * CELL;
				const py = OY + s.cy * CELL;
				g.fillStyle = "#e03a3a";
				g.fillRect(px, py, CELL, 2);
				g.fillRect(px, py + CELL - 2, CELL, 2);
				g.fillRect(px, py, 2, CELL);
				g.fillRect(px + CELL - 2, py, 2, CELL);
			}
			// 右の 欄：さがす 名前
			const rx = OX + MS.w * CELL + 6;
			const rw = AW - rx - 4;
			const cx = rx + rw / 2;
			txt(g, MOJI_TEXT.find, cx, 22, 8, "#e8d8b8", "center");
			g.fillStyle = "#f2ead8";
			g.fillRect(rx, 34, rw, 26);
			const big = word.length >= 4 ? 14 : 16;
			txt(g, word.join(""), cx, 39, big, "#c02a3a", "center");
			txt(g, `${word.length}文字`, cx, 64, 8, "#c8b898", "center");
			txt(g, `見つけた　${s.found}`, cx, 96, 8, "#e8d8b8", "center");
			txt(g, `${msScore(s)}点`, cx, 110, 12, "#ffe8a0", "center");
			hud(g, `${msScore(s)}点`, `${ARCADE_BOARD.time} ${msTimeLeft(s)}`);
		},
		over: (s) => s.over,
		score: msScore,
		end: () => MOJI_TEXT.timeUp,
	});
};
