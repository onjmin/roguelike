// 弾幕スレ の 板（決まりは data/arcade/home/danmaku.ts）。
// 十字キーで 動く（押しっぱなしは くり返しで 届くので、とぎれる まで 動く）。弾は ひとりでに 撃つ。
// タップは その 点へ 向かって 動く（着くまで。指を 置いた ところへ 寄って いく）。

import {
	DM,
	DM_TEXT,
	dmBoss,
	dmScore,
	dmStart,
	dmStep,
} from "../../../data/arcade/home/danmaku";
import { AH, AW } from "../../../data/arcade/logic";
import { ARCADE, ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import type { G } from "../../neta/netaBoard";
import { txt } from "../../neta/netaBoard";
import { type ArcadeResult, chip, hud, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

/** 弾の 色（0 名無し・1 荒らし・2〜4 スレ主）。 */
const BULLET = ["#70f070", "#ff6060", "#c080ff", "#ffe060", "#60c0ff"];

/** 小さな キリコ（まんなかが 当たり判定の 点）。 */
const kiriko = (g: G, x: number, y: number): void => {
	const X = Math.round(x);
	const Y = Math.round(y);
	g.fillStyle = "#72241f";
	g.fillRect(X - 3, Y - 7, 7, 3);
	g.fillRect(X - 3, Y - 4, 1, 3);
	g.fillRect(X + 3, Y - 4, 1, 3);
	g.fillStyle = "#28a131";
	g.fillRect(X - 2, Y - 7, 5, 1);
	g.fillStyle = "#f0c8a8";
	g.fillRect(X - 2, Y - 4, 5, 2);
	g.fillStyle = "#28a131";
	g.fillRect(X - 3, Y - 2, 7, 3);
	g.fillStyle = "#926855";
	g.fillRect(X - 3, Y + 1, 7, 2);
	g.fillStyle = "#353333";
	g.fillRect(X - 2, Y + 3, 2, 2);
	g.fillRect(X + 1, Y + 3, 2, 2);
	// 当たり判定の 点
	g.fillStyle = "#ff3040";
	g.fillRect(X - 1, Y - 1, 3, 3);
	g.fillStyle = "#ffffff";
	g.fillRect(X, Y, 1, 1);
};

export const playDanmaku = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let hx = 0;
	let hy = 0;
	let hxT = 0;
	let hyT = 0;
	return playBoard(ctx, "danmaku", {
		start: dmStart,
		step: (s, f) => {
			for (const e of f.evs) {
				if ("k" in e) {
					// はじめの 1回は くり返しが 来るまで 少し 長めに 持つ
					const h = e.repeat ? 0.12 : 0.25;
					if (e.k === "left") [hx, hxT] = [-1, h];
					else if (e.k === "right") [hx, hxT] = [1, h];
					else if (e.k === "up") [hy, hyT] = [-1, h];
					else if (e.k === "down") [hy, hyT] = [1, h];
				} else if (isTap(e)) {
					s.goal = [e.tap[0], e.tap[1]];
					hxT = 0;
					hyT = 0;
				}
			}
			hxT -= f.dt;
			hyT -= f.dt;
			if (hxT <= 0) hx = 0;
			if (hyT <= 0) hy = 0;
			let shot = false;
			for (const e of dmStep(s, f.dt, { dx: hx, dy: hy }, rnd)) {
				if (e === "shot") shot = true;
				else if (e === "kill") f.se("enemyDown");
				else if (e === "graze") f.se("cursor");
				else if (e === "hurt") f.se("damage");
				else if (e === "boss") f.se("encounter");
				else if (e === "clear") f.se("explosion");
			}
			// 撃つ 音は 小さく 間引く
			if (shot && Math.floor(s.t / DM.shotEvery) % 4 === 0) f.se("arcShot");
		},
		draw: (g, s, clock) => {
			g.fillStyle = "#100818";
			g.fillRect(0, 0, AW, AH);
			// 場（流れる 罫）
			const W = DM.right - DM.left;
			g.fillStyle = "#1c1030";
			g.fillRect(DM.left, DM.top, W, DM.bottom - DM.top);
			g.fillStyle = "#2a1a44";
			for (let i = 0; i < 9; i++) {
				const y = DM.top + ((i * 16 + clock * 30) % (DM.bottom - DM.top));
				g.fillRect(DM.left + 4, Math.round(y), W - 8, 1);
			}
			// 敵
			for (const f of s.foes) {
				if (f.kind === "boss") {
					const hot = f.flash > 0;
					g.fillStyle = "#3a0a2a";
					g.fillRect(Math.round(f.x - 12), Math.round(f.y - 12), 24, 24);
					chip(
						g,
						f.x,
						f.y,
						20,
						20,
						hot ? "#ffffff" : "#c02060",
						DM_TEXT.boss,
						hot ? "#c02060" : "#ffffff",
						14,
					);
					txt(g, DM_TEXT.bossName, f.x, f.y + 12, 7, "#ffc0e0", "center");
				} else {
					const w = DM.size[f.kind] * 2;
					const fill =
						f.flash > 0 ? "#ffffff" : f.kind === "are" ? "#c83030" : "#228822";
					chip(g, f.x, f.y, w, w, fill, DM_TEXT[f.kind], "#ffffff", 8);
				}
			}
			// キリコの 弾
			g.fillStyle = "#a0e0ff";
			for (const p of s.shots)
				g.fillRect(Math.round(p.x), Math.round(p.y), 1, 4);
			// キリコ（無敵の あいだは 点滅）
			if (!(s.invuln > 0 && Math.floor(clock * 16) % 2 === 0))
				kiriko(g, s.x, s.y);
			// 敵の 弾
			for (const b of s.bullets) {
				const X = Math.round(b.x);
				const Y = Math.round(b.y);
				g.fillStyle = BULLET[b.c] ?? BULLET[0];
				g.fillRect(X - 2, Y - 1, 5, 3);
				g.fillRect(X - 1, Y - 2, 3, 5);
				g.fillStyle = "#ffffff";
				g.fillRect(X, Y, 1, 1);
			}
			// スレ主の 体力
			const boss = dmBoss(s);
			if (boss) {
				g.fillStyle = "#3a1a2a";
				g.fillRect(DM.left + 4, DM.top + 2, W - 8, 3);
				g.fillStyle = "#ff4080";
				g.fillRect(
					DM.left + 4,
					DM.top + 2,
					Math.round(((W - 8) * boss.hp) / DM.hp.boss),
					3,
				);
			}
			if (s.bossOut && s.t < DM.bossAt + 2 && Math.floor(clock * 4) % 2 === 0)
				txt(g, DM_TEXT.warn, AW / 2, 70, 10, "#ff6090", "center");
			// 左右の 枠：残機・かすり
			g.fillStyle = "#06060c";
			g.fillRect(0, DM.top, DM.left, AH);
			g.fillRect(DM.right, DM.top, AW - DM.right, AH);
			txt(g, DM_TEXT.lives, DM.left / 2, DM.top + 8, 8, "#e8e8f0", "center");
			for (let i = 0; i < DM.lives; i++) {
				g.fillStyle = i < s.lives ? "#28a131" : "#2a2a36";
				g.fillRect(8 + i * 9, DM.top + 22, 6, 6);
			}
			txt(g, DM_TEXT.graze, DM.right + 20, DM.top + 8, 8, "#e8e8f0", "center");
			txt(
				g,
				String(s.grazes),
				DM.right + 20,
				DM.top + 20,
				8,
				"#ffe060",
				"center",
			);
			hud(
				g,
				`${ARCADE_BOARD.score} ${dmScore(s)}`,
				`${ARCADE_BOARD.time} ${Math.floor(s.t)}`,
			);
		},
		over: (s) => s.over,
		score: dmScore,
		end: (s) => (s.clear ? ARCADE.clear : ARCADE.over),
	});
};
