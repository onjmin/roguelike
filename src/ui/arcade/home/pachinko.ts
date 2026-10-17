// カジノ「ガチャ」の パチンコ台 CRおんJタウン の 板（決まりは data/arcade/home/pachinko.ts、文は data/arcade/text.ts）。
// - A を 押しっぱなしで 打つ（くり返しが 来る あいだ）。↑↓ で 強さ。
// - タップは 右の 強さの 目もりで 強さ、それ 以外は 打つ／止めるの 切りかえ（ハンドルを にぎる かわり）。
// - 液晶の 絵は ぷゆゆ（🥺 の 目、4色）・キリコの 蓄音機・草・>>1。
// 見た目の 乱数は Math.random（冒険の 乱数に さわらない）。

import {
	PC,
	PC_SYM_KIND,
	PC_TEXT,
	type PcInput,
	pcSpinEnd,
	pcStart,
	pcStep,
} from "../../../data/arcade/home/pachinko";
import { AH, AW } from "../../../data/arcade/logic";
import { ARCADE } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import { type G, txt } from "../../neta/netaBoard";
import { fill } from "../../village/villageTalk";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";
import { inside, type Rect } from "./poker";

const rnd = Math.random;

/** 強さの 目もり。 */
const METER: Rect = [225, 18, 12, 118];
/** 打つ／止めるの 札（場の どこを タップしても 切りかわる）。 */
const FIRE: Rect = [10, 134, 40, 13];
/** A の くり返しが 来て いる と みなす 間（秒）。 */
const HOLD_A = 0.55;

/** ぷゆゆ（丸い 体に うるんだ 目）。 */
const puyu = (
	g: G,
	x: number,
	y: number,
	body: string,
	face: "teary" | "smile" | "sleepy",
	gold = false,
): void => {
	g.fillStyle = body;
	g.beginPath();
	g.ellipse(x, y + 1, 7, 6, 0, 0, Math.PI * 2);
	g.fill();
	g.fillRect(x - 3, y - 6, 6, 2);
	if (gold) {
		g.fillStyle = "#fff8c0";
		g.fillRect(x - 5, y - 3, 2, 2);
	}
	g.fillStyle = "#2a1408";
	if (face === "teary") {
		g.fillRect(x - 4, y - 1, 3, 3);
		g.fillRect(x + 1, y - 1, 3, 3);
		g.fillStyle = "#ffffff";
		g.fillRect(x - 4, y - 1, 1, 1);
		g.fillRect(x + 1, y - 1, 1, 1);
		g.fillStyle = "#80c8ff";
		g.fillRect(x - 4, y + 2, 1, 2);
		g.fillRect(x + 3, y + 2, 1, 2);
		g.fillStyle = "#2a1408";
		g.fillRect(x - 1, y + 4, 2, 1);
	} else if (face === "smile") {
		g.fillRect(x - 4, y, 1, 1);
		g.fillRect(x - 3, y - 1, 1, 1);
		g.fillRect(x - 2, y, 1, 1);
		g.fillRect(x + 2, y, 1, 1);
		g.fillRect(x + 3, y - 1, 1, 1);
		g.fillRect(x + 4, y, 1, 1);
		g.fillRect(x - 1, y + 3, 3, 1);
	} else {
		g.fillRect(x - 4, y, 3, 1);
		g.fillRect(x + 1, y, 3, 1);
		g.fillRect(x, y + 3, 1, 1);
	}
};

/** キリコの 蓄音機（ラッパと 箱）。 */
const horn = (g: G, x: number, y: number): void => {
	g.fillStyle = "#6a3a1c";
	g.fillRect(x - 6, y + 2, 10, 5);
	g.fillStyle = "#3a2010";
	g.fillRect(x - 5, y + 1, 8, 1);
	g.fillStyle = "#c8a040";
	g.fillRect(x - 1, y - 1, 2, 3);
	g.fillStyle = "#e8c050";
	g.beginPath();
	g.moveTo(x, y - 1);
	g.lineTo(x + 7, y - 8);
	g.lineTo(x + 8, y - 1);
	g.closePath();
	g.fill();
	g.fillStyle = "#8a6020";
	g.fillRect(x + 6, y - 7, 1, 6);
};

/** 液晶の 絵 1つ。 */
const symbol = (g: G, x: number, y: number, n: number, dim: boolean): void => {
	const kind = PC_SYM_KIND[n] ?? "puyu";
	g.globalAlpha = dim ? 0.55 : 1;
	if (kind === "horn") horn(g, x, y);
	else if (kind === "kusa") txt(g, "草", x, y - 7, 14, "#40c050", "center");
	else if (kind === "res1") txt(g, ">>1", x, y - 4, 8, "#7090ff", "center");
	else if (n === 1) puyu(g, x, y, "#f0c838", "teary");
	else if (n === 3) puyu(g, x, y, "#f088b8", "smile");
	else if (n === 5) puyu(g, x, y, "#78a8f0", "sleepy");
	else puyu(g, x, y, "#ffd040", "teary", true);
	txt(g, String(n), x + 7, y + 6, 6, n === 7 ? "#ff6060" : "#e8e8f0", "center");
	g.globalAlpha = 1;
};

export const playPachinko = (
	ctx: UiCtx,
	stake?: number,
): Promise<ArcadeResult | null> => {
	let auto = false;
	let held = 0;
	let flash = "";
	let flashT = 0;
	const show = (s: string, t = 1.6) => {
		flash = s;
		flashT = t;
	};
	return playBoard(ctx, "pachinko", {
		start: () => pcStart(stake),
		quitScores: true,
		cash: (s) => s.balls,
		step: (s, f) => {
			const inp: PcInput = {};
			let power = s.power;
			for (const e of f.evs) {
				if (isKey(e, "a", true)) held = HOLD_A;
				else if (isKey(e, "up", true)) power += 0.04;
				else if (isKey(e, "down", true)) power -= 0.04;
				else if (isTap(e)) {
					const [mx, my, , mh] = METER;
					if (inside(e.tap, [mx - 4, my - 4, 20, mh + 8]))
						power = 1 - (e.tap[1] - my) / mh;
					else {
						auto = !auto;
						f.se(auto ? "decide" : "cancel");
					}
				}
			}
			if (power !== s.power) inp.power = power;
			held = Math.max(0, held - f.dt);
			flashT = Math.max(0, flashT - f.dt);
			inp.fire = auto || held > 0;
			for (const e of pcStep(s, f.dt, inp, rnd)) {
				if (e === "heso") f.se("arcCoin");
				else if (e === "stop") f.se("cursor");
				else if (e === "reach") {
					f.se("mix");
					show(PC_TEXT.reach, 3);
				} else if (e === "jackpot") {
					f.se("victory");
					show(PC_TEXT.jackpot, 2);
				} else if (e === "attacker") f.se("item");
				else if (e === "bonusEnd") {
					f.se("payout");
					show(fill(PC_TEXT.bonusEnd, { n: s.lastBonus }), 2.5);
				}
			}
			if (s.balls <= 0 && !s.over) auto = false;
		},
		draw: (g, s, clock) => {
			g.fillStyle = "#2a1a10";
			g.fillRect(0, 0, AW, AH);
			// 盤面（上の 角は 丸い レール）
			g.fillStyle = "#0e1a30";
			g.beginPath();
			g.moveTo(PC.left, AH);
			g.lineTo(PC.left, 40);
			g.quadraticCurveTo(PC.left, PC.top, 40, PC.top);
			g.lineTo(PC.right - 30, PC.top);
			g.quadraticCurveTo(PC.right, PC.top, PC.right, 40);
			g.lineTo(PC.right, AH);
			g.closePath();
			g.fill();
			g.strokeStyle = "#c8a040";
			g.lineWidth = 1;
			g.stroke();
			// 釘
			g.fillStyle = "#c8c8d0";
			for (const [x, y] of s.nails)
				g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
			// 液晶
			const [lx, ly, lw, lh] = PC.lcd;
			g.fillStyle = s.bonus
				? Math.floor(clock * 6) % 2
					? "#402060"
					: "#602040"
				: "#080810";
			g.fillRect(lx, ly, lw, lh);
			g.strokeStyle =
				s.spin?.reach && Math.floor(clock * 8) % 2 ? "#ff5070" : "#9090c0";
			g.strokeRect(lx + 0.5, ly + 0.5, lw - 1, lh - 1);
			const sp = s.spin;
			const stopAt = sp ? [PC.stopL, pcSpinEnd(sp), PC.stopR] : [];
			for (let i = 0; i < 3; i++) {
				const x = lx + lw / 6 + (i * lw) / 3;
				const y = ly + lh / 2 + 2;
				const still = !sp || sp.t >= (stopAt[i] ?? 0);
				const n = still
					? ((sp ? sp.reels[i] : s.reels[i]) ?? 1)
					: 1 + (Math.floor(clock * 14 + i * 3) % 7);
				// リーチの まんなかは ゆっくり 光る
				if (sp?.reach && i === 1 && !still) {
					g.fillStyle = Math.floor(clock * 6) % 2 ? "#40300a" : "#200a20";
					g.fillRect(x - 9, ly + 2, 18, lh - 4);
				}
				symbol(g, x, y, n, !still);
			}
			if (s.bonus)
				txt(
					g,
					fill(PC_TEXT.round, { n: s.bonus.count, max: PC.attackerCount }),
					lx + lw / 2,
					ly + 2,
					6,
					"#ffe060",
					"center",
				);
			if (flashT > 0 && Math.floor(clock * 6) % 4 !== 0)
				txt(g, flash, lx + lw / 2, ly + lh - 9, 7, "#ffe060", "center");
			// 保留
			for (let i = 0; i < PC.hold; i++) {
				g.fillStyle = i < s.queue ? "#f0a030" : "#303048";
				g.fillRect(lx + lw / 2 - 11 + i * 6, ly + lh + 2, 4, 3);
			}
			// ヘソ
			g.fillStyle = "#f0c040";
			g.fillRect(PC.hesoX - 4, PC.hesoY, 8, 2);
			g.fillRect(PC.hesoX - 4, PC.hesoY + 2, 1, 3);
			g.fillRect(PC.hesoX + 3, PC.hesoY + 2, 1, 3);
			// アタッカー
			const [ax, ay, aw, ah] = PC.attacker;
			if (s.bonus) {
				g.fillStyle = Math.floor(clock * 8) % 2 ? "#ff4060" : "#ffe060";
				g.fillRect(ax - 2, ay + ah, aw + 4, 3);
				g.fillRect(ax - 2, ay - 2, 2, ah + 5);
				g.fillRect(ax + aw, ay - 2, 2, ah + 5);
			} else {
				g.fillStyle = "#a02030";
				g.fillRect(ax, ay, aw, ah);
			}
			// 玉
			g.fillStyle = "#e8eef8";
			for (const b of s.flying)
				g.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3);
			// 強さの 目もり
			const [mx, my, mw, mh] = METER;
			g.fillStyle = "#101018";
			g.fillRect(mx, my, mw, mh);
			const ph = Math.round(mh * s.power);
			g.fillStyle = s.power > 0.85 ? "#e04040" : "#40c060";
			g.fillRect(mx + 2, my + mh - ph, mw - 4, ph);
			g.strokeStyle = "#c8a040";
			g.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);
			txt(g, PC_TEXT.power, mx + mw / 2, AH - 3 - 6, 6, "#e8e8f0", "center");
			// 打つ／止める
			const firing = auto || held > 0;
			g.fillStyle = firing ? "#f0c040" : "#3a2a10";
			g.fillRect(...FIRE);
			txt(
				g,
				firing ? PC_TEXT.stop : PC_TEXT.fire,
				FIRE[0] + FIRE[2] / 2,
				FIRE[1] + 3,
				7,
				firing ? "#201000" : "#f4e8c8",
				"center",
			);
			hud(
				g,
				`${PC_TEXT.balls} ${s.balls}`,
				`${PC_TEXT.hold} ${s.queue}　${PC_TEXT.hits} ${s.jackpots}`,
			);
		},
		over: (s) => s.over,
		score: (s) => s.balls,
		end: () => ARCADE.over,
	});
};
