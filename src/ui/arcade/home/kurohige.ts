// イッチ危機一髪の 板（決まりは data/arcade/home/kurohige.ts）。樽の 正面に 穴が 横 1列、てっぺんに イッチ。
// ←→ で 穴を 選び、A で 刺す。タップは 1度めで 穴を 選び、同じ 穴を もう 一度で 刺す。
// 選んだ 穴が ピクッと する 穴なら イッチが 目を むく（穴の 下に 汗の しるしが 残る）。
// 刺したら 少し 間を おいて 結果（樽が ゆれる）。当たりなら イッチが 上へ 飛んでいく。

import {
	KH,
	KH_SAY,
	type KhState,
	khCpu,
	khScore,
	khStab,
	khStart,
} from "../../../data/arcade/home/kurohige";
import { AH, AW } from "../../../data/arcade/logic";
import { ARCADE } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import type { G } from "../../neta/netaBoard";
import { txt } from "../../neta/netaBoard";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

const CX = AW / 2;
const BX = 46;
const BW_ = AW - BX * 2;
const BTOP = 60;
const SLOT_Y = 92;
const GAP = 11;

const slotX = (i: number): number =>
	Math.round(CX + (i - (KH.slots - 1) / 2) * GAP);

type View = {
	s: KhState;
	cur: number;
	phase: "pick" | "wait" | "cpu" | "fly";
	/** その 場面の のこり（秒）。 */
	t: number;
	/** 刺している 穴（wait の あいだ）。 */
	pend: number;
	who: 1 | 2;
	/** キリコが 剣を 当てて ピクッを 見た 穴。 */
	seen: boolean[];
};

/** 刺さった 剣の 柄（穴から 上に 出る）。 */
const hilt = (g: G, x: number, y: number, who: 1 | 2, depth: number): void => {
	const up = Math.round((1 - depth) * 8);
	g.fillStyle = "#c8ccd8";
	if (up > 0) g.fillRect(x - 1, y - up, 2, up);
	g.fillStyle = "#d0a030";
	g.fillRect(x - 3, y - up - 2, 7, 2);
	g.fillStyle = who === 1 ? "#4060c0" : "#3a9a4a";
	g.fillRect(x - 1, y - up - 8, 3, 6);
	g.fillStyle = "#d0a030";
	g.fillRect(x - 1, y - up - 10, 3, 2);
};

/** イッチの 顔（てっぺんから のぞく）。 */
const itchi = (g: G, x: number, y: number, scared: boolean): void => {
	const X = Math.round(x);
	const Y = Math.round(y);
	g.fillStyle = "#f2d0a8";
	g.fillRect(X - 8, Y - 14, 16, 14);
	g.fillRect(X - 9, Y - 12, 18, 10);
	g.fillStyle = "#202020";
	g.fillRect(X - 8, Y - 16, 16, 4);
	// はちまき
	g.fillStyle = "#e04040";
	g.fillRect(X - 9, Y - 12, 18, 3);
	g.fillRect(X + 9, Y - 12, 4, 2);
	txt(g, "1", X, Y - 13, 5, "#ffffff", "center");
	g.fillStyle = "#202020";
	if (scared) {
		g.fillRect(X - 5, Y - 8, 3, 3);
		g.fillRect(X + 2, Y - 8, 3, 3);
		g.fillRect(X - 2, Y - 4, 4, 3);
	} else {
		g.fillRect(X - 5, Y - 7, 3, 1);
		g.fillRect(X + 2, Y - 7, 3, 1);
		g.fillRect(X - 2, Y - 3, 4, 1);
	}
	g.fillStyle = "#e89070";
	g.fillRect(X - 7, Y - 5, 2, 1);
	g.fillRect(X + 5, Y - 5, 2, 1);
};

export const playKurohige = (ctx: UiCtx): Promise<ArcadeResult | null> =>
	playBoard<View>(ctx, "kurohige", {
		start: () => ({
			s: khStart(rnd),
			cur: Math.floor(KH.slots / 2),
			phase: "pick",
			t: 0,
			pend: -1,
			who: 1,
			seen: Array.from({ length: KH.slots }, () => false),
		}),
		step: (v, f) => {
			const s = v.s;
			v.t -= f.dt;
			if (v.phase === "fly") return;
			if (v.phase === "wait") {
				if (v.t > 0) return;
				const r = khStab(s, v.pend);
				v.pend = -1;
				if (r === "pop") {
					f.se("explosion");
					f.say(v.who === 1 ? KH_SAY.meLose : KH_SAY.cpuLose);
					v.phase = "fly";
					v.t = KH.fly;
				} else if (v.who === 1) {
					f.se("item");
					f.say(KH_SAY.safe);
					v.phase = "cpu";
					v.t = KH.think;
				} else {
					f.se("put");
					f.say(KH_SAY.cpuSafe);
					v.phase = "pick";
				}
				return;
			}
			if (v.phase === "cpu") {
				if (v.t > 0) return;
				v.pend = khCpu(s, rnd);
				v.who = 2;
				v.phase = "wait";
				v.t = KH.suspense;
				f.se("swing_blade");
				return;
			}
			let stab = -1;
			for (const e of f.evs) {
				if (isKey(e, "left", true)) {
					v.cur = (v.cur + KH.slots - 1) % KH.slots;
					f.se("cursor");
				} else if (isKey(e, "right", true)) {
					v.cur = (v.cur + 1) % KH.slots;
					f.se("cursor");
				} else if (isKey(e, "a")) stab = v.cur;
				else if (isTap(e)) {
					const [x, y] = e.tap;
					if (y < BTOP || x < BX || x > BX + BW_) continue;
					const i = Math.max(
						0,
						Math.min(
							KH.slots - 1,
							Math.round((x - CX) / GAP + (KH.slots - 1) / 2),
						),
					);
					// 1度めは 選ぶだけ（ピクッを 見る）。同じ 穴を もう 一度で 刺す
					if (i === v.cur) stab = i;
					else {
						v.cur = i;
						f.se("cursor");
					}
				}
				if (stab >= 0) break;
			}
			if (v.s.twitch[v.cur] && !s.stabbed[v.cur] && !v.seen[v.cur]) {
				v.seen[v.cur] = true;
				f.say(KH_SAY.twitch);
			}
			if (stab < 0) return;
			if (s.stabbed[stab]) {
				f.se("cancel");
				return;
			}
			v.pend = stab;
			v.who = 1;
			v.phase = "wait";
			v.t = KH.suspense;
			f.se("swing_blade");
		},
		draw: (g, v, clock) => {
			const s = v.s;
			g.fillStyle = "#24304a";
			g.fillRect(0, 0, AW, AH);
			g.fillStyle = "#3a2a1c";
			g.fillRect(0, AH - 8, AW, 8);
			// ゆれ（刺している 間）
			const shake =
				v.phase === "wait"
					? Math.round(Math.sin(clock * 70) * (v.t < 0.3 ? 2 : 1))
					: 0;
			// イッチ（飛ぶ ときは 上へ）
			const fly = v.phase === "fly" ? 1 - Math.max(0, v.t) / KH.fly : 0;
			const hx = CX + shake + Math.sin(fly * 20) * fly * 10;
			const hy = BTOP + 2 - fly * fly * 180 - fly * 20;
			if (v.phase === "fly") {
				g.fillStyle = "#f4f2ea";
				for (let k = 0; k < 5; k++)
					g.fillRect(
						Math.round(hx - 10 + k * 5),
						Math.round(hy + 6 + ((k * 7 + clock * 90) % 24)),
						1,
						6,
					);
			}
			// 選んだ 穴で ピクッ（目を むく）
			const twitch = v.phase === "pick" && !s.stabbed[v.cur] && s.twitch[v.cur];
			itchi(
				g,
				hx + (twitch ? Math.round(Math.sin(clock * 50)) : 0),
				hy,
				twitch || (v.phase !== "pick" && v.phase !== "cpu"),
			);
			if (twitch) txt(g, KH_SAY.twitch, CX + 24, BTOP - 18, 8, "#ffe060");
			// 樽
			const x0 = BX + shake;
			g.fillStyle = "#8a5428";
			g.fillRect(x0, BTOP, BW_, AH - 8 - BTOP);
			g.fillStyle = "#a86a34";
			g.fillRect(x0 - 3, BTOP + 10, BW_ + 6, AH - 8 - BTOP - 20);
			g.fillStyle = "#6a3e1c";
			for (let k = 1; k < 10; k++)
				g.fillRect(x0 + Math.round((BW_ * k) / 10), BTOP, 1, AH - 8 - BTOP);
			g.fillStyle = "#3a3a44";
			g.fillRect(x0 - 2, BTOP, BW_ + 4, 4);
			g.fillRect(x0 - 3, BTOP + 22, BW_ + 6, 3);
			g.fillRect(x0 - 3, AH - 8 - 26, BW_ + 6, 3);
			g.fillStyle = "#1a1008";
			g.fillRect(x0 + 6, BTOP - 2, BW_ - 12, 3);
			// 穴と 剣
			for (let i = 0; i < KH.slots; i++) {
				const x = slotX(i) + shake;
				g.fillStyle = "#1a1008";
				g.fillRect(x - 2, SLOT_Y - 4, 4, 9);
				const by = s.stabbed[i];
				// ピクッを 見た 穴（汗の しるし）
				if (!by && v.seen[i]) {
					g.fillStyle = "#80c8ff";
					g.fillRect(x - 1, SLOT_Y + 15, 2, 2);
					g.fillRect(x, SLOT_Y + 14, 1, 1);
				}
				if (by) hilt(g, x, SLOT_Y - 4, by, 1);
				else if (i === v.pend && v.phase === "wait")
					hilt(
						g,
						x,
						SLOT_Y - 4,
						v.who,
						Math.min(1, 1 - v.t / KH.suspense + 0.3),
					);
			}
			// カーソル（キリコの 番）
			if (v.phase === "pick") {
				const x = slotX(v.cur);
				const b = Math.floor(clock * 4) % 2;
				g.fillStyle = "#ffe060";
				g.fillRect(x - 3, SLOT_Y + 10 + b, 7, 2);
				g.fillRect(x - 2, SLOT_Y + 8 + b, 5, 2);
				g.fillRect(x - 1, SLOT_Y + 6 + b, 3, 2);
			}
			const right =
				v.phase === "fly"
					? ""
					: v.phase === "pick" || (v.phase === "wait" && v.who === 1)
						? "キリコの　番"
						: "名無しの　番";
			hud(g, `刺した　${s.safe}本`, right);
			if (v.phase === "fly" && fly > 0.15)
				txt(g, KH_SAY.fly, CX, 28, 8, "#ffe060", "center");
		},
		over: (v) => v.phase === "fly" && v.t <= 0,
		score: (v) => khScore(v.s),
		end: (v) => (v.s.loser === 2 ? ARCADE.clear : ARCADE.over),
	});
