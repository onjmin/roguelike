// 金魚すくいの 板（決まりは data/arcade/home/kingyo.ts）。上から 見た たらい。
// 十字キーで ポイを 動かす（押しっぱなしは くり返しで 届く）、A で すくう。
// タップは ポイの 上なら すくう、ほかは その 場所へ ポイが 向かう。
// すくうと その 場所に 点が 浮かぶ（まとめて すくうと 名無しが 声を かける）。

import {
	KG,
	KG_KIND,
	type KgFish,
	KINGYO_TEXT,
	kgScore,
	kgStart,
	kgStep,
	kgTimeLeft,
} from "../../../data/arcade/home/kingyo";
import { AH, AW } from "../../../data/arcade/logic";
import { ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import { type G, txt } from "../../neta/netaBoard";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

/** 上から 見た 金魚（頭が 進む 向き）。 */
const fishArt = (g: G, f: KgFish, clock: number): void => {
	const r = KG_KIND[f.kind].r;
	const X = Math.round(f.x);
	const Y = Math.round(f.y);
	const body = f.kind === "black" ? "#1a1a24" : "#e8402a";
	const fin = f.kind === "black" ? "#3a3a4a" : "#ff8a60";
	const sp = Math.hypot(f.vx, f.vy) || 1;
	const ux = f.vx / sp;
	const uy = f.vy / sp;
	// 尾びれ（ゆらゆら）
	const wag = Math.sin(clock * 12 + f.x) * r * 0.5;
	g.fillStyle = fin;
	const tx = Math.round(X - ux * r * 1.6 - uy * wag);
	const ty = Math.round(Y - uy * r * 1.6 + ux * wag);
	g.fillRect(tx - Math.ceil(r / 2), ty - Math.ceil(r / 2), r, r);
	// からだ
	g.fillStyle = body;
	g.fillRect(X - r, Y - r, r * 2, r * 2);
	g.fillRect(
		Math.round(X + ux * r * 0.8) - Math.ceil(r * 0.6),
		Math.round(Y + uy * r * 0.8) - Math.ceil(r * 0.6),
		Math.ceil(r * 1.2),
		Math.ceil(r * 1.2),
	);
	if (f.kind === "big") {
		g.fillStyle = "#ffffff";
		g.fillRect(X - 2, Y - 1, 4, 2);
	}
	// 目（出目金は 飛びでた 目）
	const ex = Math.round(X + ux * r - uy * (r * 0.6));
	const ey = Math.round(Y + uy * r + ux * (r * 0.6));
	const fx = Math.round(X + ux * r + uy * (r * 0.6));
	const fy = Math.round(Y + uy * r - ux * (r * 0.6));
	const eye = f.kind === "black" ? 2 : 1;
	g.fillStyle = f.kind === "black" ? "#8a8aa0" : "#1a0a08";
	g.fillRect(ex, ey, eye, eye);
	g.fillRect(fx, fy, eye, eye);
};

export const playKingyo = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let dx = 0;
	let dy = 0;
	let held = 0;
	let target: readonly [number, number] | null = null;
	/** 浮かぶ 点（t は のこりの 秒）。 */
	let pops: { x: number; y: number; s: string; t: number }[] = [];
	let warned = false;
	return playBoard(ctx, "kingyo", {
		start: () => kgStart(rnd),
		note: KINGYO_TEXT.note,
		step: (s, f) => {
			let scoop = false;
			for (const e of f.evs) {
				if (isKey(e, "left", true))
					[dx, dy, held, target] = [-1, 0, 0.18, null];
				else if (isKey(e, "right", true))
					[dx, dy, held, target] = [1, 0, 0.18, null];
				else if (isKey(e, "up", true))
					[dx, dy, held, target] = [0, -1, 0.18, null];
				else if (isKey(e, "down", true))
					[dx, dy, held, target] = [0, 1, 0.18, null];
				else if (isKey(e, "a")) scoop = true;
				else if (isTap(e)) {
					const [x, y] = e.tap;
					if ((x - s.px) ** 2 + (y - s.py) ** 2 <= (KG.poiR + 4) ** 2) {
						scoop = true;
						target = null;
					} else target = [x, y];
				}
			}
			// 押しっぱなしは くり返しで 届く。とぎれたら 止まる
			held -= f.dt;
			if (held <= 0) [dx, dy] = [0, 0];
			for (const p of pops) p.t -= f.dt;
			pops = pops.filter((p) => p.t > 0);
			const evs = kgStep(s, f.dt, { dx, dy, target, scoop }, rnd);
			for (const e of evs) {
				if (e === "dip") f.se("bubble");
				else if (e === "catch") f.se("item");
				else if (e === "bigCatch") f.se("arcCoin");
				else if (e === "empty") f.se("cursor");
				else if (e === "torn") f.se("glassBreak");
			}
			const got = s.lastScoop;
			if (got && evs.some((e) => e === "catch" || e === "bigCatch")) {
				pops.push({ x: got.x, y: got.y - 14, s: `+${got.pts}`, t: 0.9 });
				if (got.n >= 2) {
					f.se("jingle");
					f.say(KINGYO_TEXT.multi.replace("{n}", `${got.n}`));
				}
			}
			if (!warned && !s.over && s.paper < 30) {
				warned = true;
				f.say(KINGYO_TEXT.thin);
			}
		},
		draw: (g, s, clock) => {
			// 畳と たらいの ふち
			g.fillStyle = "#6a5a3a";
			g.fillRect(0, 0, AW, AH);
			g.fillStyle = "#3a6ab0";
			g.fillRect(
				KG.left - 6,
				KG.top - 6,
				KG.right - KG.left + 12,
				KG.bottom - KG.top + 12,
			);
			g.fillStyle = "#2a5a9a";
			g.fillRect(
				KG.left - 3,
				KG.top - 3,
				KG.right - KG.left + 6,
				KG.bottom - KG.top + 6,
			);
			// 水
			g.fillStyle = "#7ac8e8";
			g.fillRect(KG.left, KG.top, KG.right - KG.left, KG.bottom - KG.top);
			g.fillStyle = "#a8e0f4";
			for (let i = 0; i < 9; i++) {
				const x = KG.left + ((i * 53 + clock * 6) % (KG.right - KG.left - 12));
				const y = KG.top + 8 + ((i * 37) % (KG.bottom - KG.top - 16));
				g.fillRect(Math.round(x), y, 8, 1);
			}
			// 金魚（ポイの 下に 見える）
			for (const f of s.fish) fishArt(g, f, clock);
			// ポイ（つけて いる ときは 紙が 濃い）
			const X = Math.round(s.px);
			const Y = Math.round(s.py);
			const R = KG.poiR;
			const ring = s.torn ? "#8a8a8a" : "#e04a8a";
			g.fillStyle = ring;
			for (let a = 0; a < 32; a++) {
				const t = (a / 32) * Math.PI * 2;
				g.fillRect(
					Math.round(X + Math.cos(t) * R) - 1,
					Math.round(Y + Math.sin(t) * R) - 1,
					2,
					2,
				);
			}
			g.fillStyle =
				s.dipping > 0 ? "rgba(240,240,255,0.25)" : "rgba(255,255,255,0.45)";
			for (let y = -R + 2; y <= R - 2; y += 1) {
				const w = Math.floor(Math.sqrt((R - 2) ** 2 - y * y));
				g.fillRect(X - w, Y + y, w * 2, 1);
			}
			// 持ち手（右下へ）
			g.fillStyle = ring;
			g.fillRect(X + R - 1, Y + R - 3, 3, 3);
			g.fillRect(X + R + 1, Y + R - 1, 3, 3);
			g.fillRect(X + R + 3, Y + R + 1, 3, 3);
			for (const p of pops)
				txt(
					g,
					p.s,
					Math.round(p.x),
					Math.round(p.y - (0.9 - p.t) * 12),
					8,
					"#ffe060",
					"center",
				);
			const bw = 40;
			hud(
				g,
				`${kgScore(s)}点 ${s.caught}匹`,
				`${ARCADE_BOARD.time} ${kgTimeLeft(s)}`,
			);
			// 紙の のこり（帯の まんなか）
			txt(g, KINGYO_TEXT.paper, AW / 2 - bw / 2 - 3, 3, 8, "#e8e8f0", "right");
			g.fillStyle = "#30303a";
			g.fillRect(AW / 2 - bw / 2 - 1, 4, bw + 2, 6);
			g.fillStyle = s.paper > 30 ? "#f4f2ea" : "#ff7060";
			g.fillRect(AW / 2 - bw / 2, 5, Math.round((bw * s.paper) / KG.paper), 4);
		},
		over: (s) => s.over,
		score: kgScore,
		end: (s) => (s.torn ? KINGYO_TEXT.torn : KINGYO_TEXT.timeUp),
	});
};
