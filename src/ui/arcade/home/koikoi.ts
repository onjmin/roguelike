// 花札 こいこいの 板（決まりは data/arcade/home/koikoi.ts）。黒い 台に 小さな 花札（16×22）。
// 上の 段：名無しの 手札（裏）。まんなか：山と 場。下の 段：キリコの 手札。右の 列：取った 札（光・タネ・短冊・カス）。
// ←→ で 手札、A で 出す。場に 同じ 月が 2枚 あれば ←→ で 取る ほう、A。役が できたら ←→ で あがり／こいこい、A。
// タップ：手札は 1回目で えらび、2回目で 出す。場の 札を タップすると 合う 手札を 出して それを 取る。
// 札の 絵は 月の 地の 色・月の 1字・草花・光や 動物の 小さな 印（松に 鶴、桜に 幕、芒に 月、柳に 小野道風 など）。

import {
	KK,
	KK_MONTH,
	type KkKind,
	type KkPlay,
	type KkState,
	kkCpuKoi,
	kkCpuPick,
	kkCpuPlay,
	kkFlip,
	kkKind,
	kkKoi,
	kkMatches,
	kkMonth,
	kkNear,
	kkNext,
	kkOver,
	kkPick,
	kkPlay,
	kkPts,
	kkScore,
	kkStart,
	kkTag,
	kkYaku,
} from "../../../data/arcade/home/koikoi";
import { AH, AW } from "../../../data/arcade/logic";
import { ARCADE } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import { type G, txt } from "../../neta/netaBoard";
import {
	burst,
	type Juice,
	juice,
	juiceDraw,
	juiceStep,
	pop,
	quake,
	shaken,
} from "../arcadeJuice";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";
import { button, inside, type Rect } from "./poker";

const rnd = Math.random;

const CW = 16;
const CH = 22;
/** 名無しの 手札（裏）の 段。 */
const CPU_Y = 17;
/** 場の 2段。 */
const FIELD_Y = [34, 59] as const;
const FIELD_X = 26;
const FIELD_W = 138;
/** 山と 出した 札。 */
const DECK: Rect = [4, 34, CW, CH];
const SHOW_X = 4;
const SHOW_Y = 62;
/** キリコの 手札の 段。 */
const HAND_Y = 98;
const handX = (i: number): number => 6 + i * 20;
/** 取った 札の 列（右）。 */
const TAKE_X = 168;
const TAKE_Y = [17, 88] as const;
/** あがり／こいこいの 札。 */
const BTN: readonly Rect[] = [
	[38, 70, 52, 14],
	[100, 70, 52, 14],
];

/** 名無しの ひとこと。 */
const SAY = {
	koi: "こいこいや！",
	agari: "ほな　あがりや",
	meKoi: "強気やな",
	meAgari: "やられたわ",
	nagare: "流れやな",
	hikari: "光　もろたで",
	block: "それは　やらんで",
	meHikari: "げっ　光　取られた",
	next: "次の　月や",
} as const;

type View = {
	s: KkState;
	/** 手札の カーソル。 */
	hi: number;
	/** 取り先の カーソル。 */
	pi: number;
	/** 0 あがり・1 こいこい。 */
	ki: number;
	/** 名無し・山の 動きまでの のこり（秒）。 */
	wait: number;
	/** その 月が おわってからの 秒。 */
	endT: number;
	/** 出した・めくった 札（見せる。-1 なし）と のこり秒。 */
	show: number;
	showT: number;
	j: Juice;
};

// ───────────────── 札の 絵 ─────────────────

/** 月の 地の 色と 草花の 色。 */
const MONTH_INK: readonly (readonly [string, string])[] = [
	["#f0e8d0", "#2a6a3a"], // 松
	["#f4e4e0", "#d03050"], // 梅
	["#f8e8f0", "#f070a0"], // 桜
	["#ece4f4", "#7050b0"], // 藤
	["#e4ecf4", "#3050b0"], // 菖蒲
	["#f4e4e4", "#c02040"], // 牡丹
	["#f0ecdc", "#a03070"], // 萩
	["#e8a868", "#302820"], // 芒
	["#f4f0e0", "#d89020"], // 菊
	["#f4e8d8", "#d04010"], // 紅葉
	["#c8d8c0", "#2a6a2a"], // 柳
	["#f0e8f0", "#8060a0"], // 桐
];

const rect = (g: G, x: number, y: number, w: number, h: number, c: string) => {
	g.fillStyle = c;
	g.fillRect(x, y, w, h);
};

/** 草花（下の 絵の 場所に）。 */
const plant = (g: G, m: number, x: number, y: number): void => {
	const ink = MONTH_INK[m]?.[1] ?? "#404040";
	const r = (dx: number, dy: number, w: number, h: number, c = ink) =>
		rect(g, x + dx, y + dy, w, h, c);
	switch (m) {
		case 0: // 松：緑の かたまりと 幹
			r(2, 6, 10, 3);
			r(4, 4, 6, 2);
			r(6, 9, 2, 3, "#6a4020");
			break;
		case 1: // 梅：赤い 点と 枝
			r(1, 9, 12, 1, "#5a3020");
			for (const [a, b] of [
				[2, 6],
				[6, 7],
				[10, 5],
			])
				r(a ?? 0, b ?? 0, 2, 2);
			break;
		case 2: // 桜：桃色の 花
			r(1, 6, 4, 3);
			r(6, 8, 4, 3);
			r(10, 5, 3, 3);
			break;
		case 3: // 藤：たれる 紫
			r(2, 2, 2, 6);
			r(6, 3, 2, 7);
			r(10, 2, 2, 5);
			break;
		case 4: // 菖蒲：青い 花と 葉
			r(3, 5, 3, 3);
			r(9, 4, 3, 3);
			r(4, 8, 1, 4, "#2a7a3a");
			r(10, 7, 1, 5, "#2a7a3a");
			break;
		case 5: // 牡丹：大きな 赤い 花
			r(4, 5, 6, 5);
			r(5, 4, 4, 1);
			r(2, 10, 10, 2, "#2a6a3a");
			break;
		case 6: // 萩：小さな 花と 葉
			r(1, 4, 2, 2);
			r(5, 6, 2, 2);
			r(9, 3, 2, 2);
			r(1, 9, 12, 1, "#3a6a2a");
			break;
		case 7: // 芒：黒い 丘
			r(0, 8, 14, 4);
			r(3, 6, 8, 2);
			break;
		case 8: // 菊：花
			r(4, 5, 6, 4);
			r(6, 4, 2, 6);
			r(6, 6, 2, 2, "#a05010");
			break;
		case 9: // 紅葉：赤い 葉
			r(2, 4, 3, 3);
			r(7, 6, 3, 3);
			r(10, 3, 3, 3);
			break;
		case 10: // 柳：たれる 枝
			r(2, 0, 1, 10);
			r(6, 0, 1, 8);
			r(11, 0, 1, 11);
			break;
		default: // 桐：紫の 花と 大きな 葉
			r(5, 2, 4, 4);
			r(2, 7, 10, 4, "#4a7a3a");
			break;
	}
};

/** 光・タネの 印。 */
const motif = (g: G, id: number, x: number, y: number): void => {
	const r = (dx: number, dy: number, w: number, h: number, c: string) =>
		rect(g, x + dx, y + dy, w, h, c);
	const m = kkMonth(id);
	const k = kkKind(id);
	if (k === "tan") {
		const t = kkTag(id);
		const ink = t === "ao" ? "#2848c0" : "#d02020";
		r(5, 0, 4, 11, ink);
		r(5, 0, 4, 1, "#f8f0e0");
		if (t === "aka" || t === "ao")
			for (let dy = 2; dy < 10; dy += 2) r(6, dy, 2, 1, "#201418");
		return;
	}
	if (k !== "hikari" && k !== "tane") return;
	switch (m) {
		case 0: // 松に 鶴：赤い 日と 白い 鶴
			r(8, 0, 5, 4, "#e03020");
			r(2, 5, 7, 3, "#ffffff");
			r(8, 3, 1, 3, "#201418");
			r(8, 2, 2, 1, "#e03020");
			break;
		case 1: // 梅に 鶯
			r(4, 4, 6, 3, "#6a9a2a");
			r(9, 3, 2, 2, "#6a9a2a");
			r(10, 3, 1, 1, "#201418");
			break;
		case 2: // 桜に 幕
			for (let i = 0; i < 7; i++)
				r(i * 2, 6, 2, 5, i % 2 ? "#f8f8f8" : "#d02030");
			r(0, 5, 14, 1, "#201418");
			break;
		case 3: // 藤に ほととぎす
			r(9, 0, 3, 3, "#f0d080");
			r(2, 4, 6, 2, "#403040");
			r(7, 3, 2, 2, "#403040");
			break;
		case 4: // 菖蒲に 八橋
			r(0, 9, 7, 2, "#8a5a2a");
			r(6, 7, 8, 2, "#8a5a2a");
			break;
		case 5: // 牡丹に 蝶
			r(1, 0, 3, 3, "#4080e0");
			r(5, 0, 3, 3, "#f060a0");
			r(4, 1, 1, 3, "#201418");
			break;
		case 6: // 萩に 猪
			r(3, 5, 8, 4, "#6a4020");
			r(10, 6, 2, 2, "#6a4020");
			r(4, 9, 1, 2, "#3a2010");
			r(9, 9, 1, 2, "#3a2010");
			break;
		case 7:
			if (k === "hikari") {
				// 芒に 月：赤い 空に 白い 月
				r(0, 0, 14, 8, "#c83020");
				r(4, 0, 6, 7, "#f8f0d0");
				r(3, 1, 8, 5, "#f8f0d0");
			}
			// 芒に 雁：三羽
			else
				for (const [a, b] of [
					[1, 1],
					[5, 3],
					[9, 1],
				]) {
					r(a ?? 0, b ?? 0, 4, 1, "#201418");
					r((a ?? 0) + 1, (b ?? 0) + 1, 2, 1, "#201418");
				}
			break;
		case 8: // 菊に 盃
			r(3, 4, 8, 2, "#c02020");
			r(4, 6, 6, 2, "#c02020");
			r(6, 8, 2, 2, "#c02020");
			r(6, 4, 2, 1, "#f0c040");
			break;
		case 9: // 紅葉に 鹿
			r(3, 5, 7, 3, "#a06030");
			r(9, 2, 2, 4, "#a06030");
			r(8, 0, 1, 2, "#5a3010");
			r(11, 0, 1, 2, "#5a3010");
			r(4, 8, 1, 3, "#5a3010");
			r(8, 8, 1, 3, "#5a3010");
			break;
		case 10:
			if (k === "hikari") {
				// 柳に 小野道風：傘と 人と 蛙
				r(1, 2, 8, 2, "#403060");
				r(3, 1, 4, 1, "#403060");
				r(4, 4, 2, 5, "#e8d8b0");
				r(4, 9, 2, 2, "#403060");
				r(10, 9, 2, 2, "#4ab040");
			} else {
				// 柳に 燕
				r(3, 4, 7, 2, "#181828");
				r(1, 3, 3, 1, "#181828");
				r(9, 3, 2, 1, "#181828");
				r(7, 6, 2, 1, "#e03020");
			}
			break;
		default: // 桐に 鳳凰
			r(2, 3, 6, 4, "#d03020");
			r(7, 2, 2, 2, "#d03020");
			r(8, 5, 5, 2, "#4ab040");
			r(9, 7, 4, 2, "#f0c040");
			break;
	}
};

/** 花札 1枚（16×22。id < 0 は 裏）。 */
const card = (g: G, x: number, y: number, id: number): void => {
	const X = Math.round(x);
	const Y = Math.round(y);
	rect(g, X, Y, CW, CH, "#201418");
	if (id < 0) {
		rect(g, X + 1, Y + 1, CW - 2, CH - 2, "#6a1a1a");
		rect(g, X + 3, Y + 3, CW - 6, CH - 6, "#3a0e0e");
		rect(g, X + 6, Y + 8, 4, 6, "#c08040");
		return;
	}
	const m = kkMonth(id);
	rect(g, X + 1, Y + 1, CW - 2, CH - 2, MONTH_INK[m]?.[0] ?? "#f0f0f0");
	txt(g, KK_MONTH[m] ?? "", X + 1, Y + 1, 8, "#201418");
	plant(g, m, X + 1, Y + 10);
	motif(g, id, X + 1, Y + 10);
	if (kkKind(id) === "hikari") {
		// 光の 印（右上の 金の 丸）
		rect(g, X + 10, Y + 2, 4, 4, "#f0c040");
		rect(g, X + 11, Y + 3, 2, 2, "#d02020");
	}
};

/** 小さな 札（取った 札の 列。6×9）。 */
const mini = (g: G, x: number, y: number, id: number): void => {
	const m = kkMonth(id);
	rect(g, x, y, 6, 9, "#201418");
	rect(g, x + 1, y + 1, 4, 7, MONTH_INK[m]?.[0] ?? "#f0f0f0");
	rect(g, x + 1, y + 5, 4, 3, MONTH_INK[m]?.[1] ?? "#404040");
	const k = kkKind(id);
	if (k === "hikari") rect(g, x + 1, y + 1, 4, 3, "#f0c040");
	else if (k === "tan")
		rect(g, x + 2, y + 1, 2, 6, kkTag(id) === "ao" ? "#2848c0" : "#d02020");
	else if (k === "tane") rect(g, x + 2, y + 2, 2, 2, "#201418");
};

const KINDS: readonly (readonly [KkKind, string])[] = [
	["hikari", "光"],
	["tane", "タ"],
	["tan", "短"],
	["kasu", "カ"],
];

/** 取った 札の 列（種類ごとに 1行）。 */
const takePile = (g: G, take: readonly number[], y0: number): void => {
	KINDS.forEach(([k, label], row) => {
		const y = y0 + row * 10;
		const cs = take.filter((c) => kkKind(c) === k).sort((a, b) => a - b);
		txt(g, label, TAKE_X, y, 8, cs.length ? "#f4e8c8" : "#5a5040");
		const step = cs.length > 17 ? 48 / (cs.length - 1) : 3;
		cs.forEach((c, i) => {
			mini(g, Math.round(TAKE_X + 10 + i * step), y, c);
		});
	});
};

// ───────────────── 置き場 ─────────────────

/** 場の i 枚目の 左上。 */
const fieldXY = (i: number, n: number): [number, number] => {
	const cols = Math.max(4, Math.ceil(n / 2));
	const step = Math.min(18, (FIELD_W - CW) / (cols - 1));
	const row = i < cols ? 0 : 1;
	const col = i < cols ? i : i - cols;
	return [FIELD_X + col * step, FIELD_Y[row]];
};

const fieldAt = (s: KkState, p: readonly [number, number]): number => {
	for (let i = s.field.length - 1; i >= 0; i--) {
		const [x, y] = fieldXY(i, s.field.length);
		if (inside(p, [x, y, CW, CH])) return s.field[i] ?? -1;
	}
	return -1;
};

const handAt = (s: KkState, p: readonly [number, number]): number => {
	const n = s.side[0].hand.length;
	for (let i = n - 1; i >= 0; i--)
		if (inside(p, [handX(i), HAND_Y - 4, CW, CH + 4])) return i;
	return -1;
};

type Fx = {
	say: (s: string) => void;
	se: (n: string) => void;
};

/** 打った 結果の 手ごたえ（取った 札の 粒・光の 声・役の 光）。 */
const effect = (
	v: View,
	who: 0 | 1,
	r: KkPlay | null,
	before: readonly number[],
	foeTake: readonly number[],
	f: Fx,
): void => {
	if (!r) return;
	v.show = r.card;
	v.showT = 0.9;
	if (!r.took.length) {
		f.se("put");
		return;
	}
	f.se("decide");
	for (const c of r.took) {
		const i = before.indexOf(c);
		if (i < 0) continue;
		const [x, y] = fieldXY(i, before.length);
		burst(
			v.j,
			x + CW / 2,
			y + CH / 2,
			kkKind(c) === "hikari" ? "#ffe060" : "#f4e8c8",
			6,
			40,
		);
	}
	const lit = r.took.find((c) => kkKind(c) === "hikari");
	if (lit !== undefined) {
		const [x, y] = who === 0 ? [80, HAND_Y - 6] : [80, CPU_Y + 14];
		pop(v.j, x, y, "光", "#ffe060");
		f.say(who === 1 ? SAY.hikari : SAY.meHikari);
	} else if (who === 1 && r.took.some((c) => kkNear(foeTake, c) >= 12))
		f.say(SAY.block);
};

/** 役が できた・あがった ときの 光。 */
const yakuFx = (v: View, f: Fx): void => {
	const s = v.s;
	if (s.phase === "koi" || (s.phase === "end" && s.roundWin >= 0)) {
		v.j.flash = 0.25;
		quake(v.j, 2);
		f.se("jingle");
		const ys = kkYaku(s.side[s.turn].take);
		pop(v.j, 95, 52, ys.map((y) => y.name).join("　"), "#ffe060");
	}
	if (s.phase === "end") {
		v.endT = 0;
		if (s.roundWin === 1) f.say(SAY.agari);
		else if (s.roundWin === 0) f.say(SAY.meAgari);
		else f.say(SAY.nagare);
	}
};

/** 手札を 出す（ふるまいは キリコも 名無しも 同じ）。 */
const doPlay = (v: View, i: number, f: Fx, target = -1): void => {
	const s = v.s;
	const who = s.turn;
	const before = s.field.slice();
	const foeTake = s.side[who === 0 ? 1 : 0].take.slice();
	const r = kkPlay(s, i);
	f.se("cardFlip");
	if (s.phase === "pickHand" && target >= 0 && s.picks.includes(target)) {
		const r2 = kkPick(s, target);
		effect(v, who, r2, before, foeTake, f);
	} else effect(v, who, r, before, foeTake, f);
	if (s.phase === "pickHand") {
		v.show = s.pending;
		v.showT = 99;
		v.pi = 0;
	}
	v.wait = s.phase === "flip" ? KK.flipWait : KK.think;
	v.hi = Math.max(0, Math.min(v.hi, s.side[0].hand.length - 1));
};

const doPick = (v: View, target: number, f: Fx): void => {
	const s = v.s;
	const who = s.turn;
	const before = s.field.slice();
	const foeTake = s.side[who === 0 ? 1 : 0].take.slice();
	const r = kkPick(s, target);
	effect(v, who, r, before, foeTake, f);
	v.wait = s.phase === "flip" ? KK.flipWait : KK.think;
	yakuFx(v, f);
};

const doFlip = (v: View, f: Fx): void => {
	const s = v.s;
	const who = s.turn;
	const before = s.field.slice();
	const foeTake = s.side[who === 0 ? 1 : 0].take.slice();
	const r = kkFlip(s);
	f.se("cardFlip");
	effect(v, who, r, before, foeTake, f);
	if (s.phase === "pickFlip") {
		v.show = s.pending;
		v.showT = 99;
		v.pi = 0;
	}
	v.wait = KK.think;
	yakuFx(v, f);
};

const doKoi = (v: View, up: boolean, f: Fx): void => {
	const s = v.s;
	const who = s.turn;
	kkKoi(s, up);
	if (!up) {
		f.se("item");
		f.say(who === 1 ? SAY.koi : SAY.meKoi);
		pop(v.j, 95, 52, "こいこい", "#ff9060");
	}
	v.wait = KK.think;
	yakuFx(v, f);
};

// ───────────────── 板 ─────────────────

export const playKoikoi = (ctx: UiCtx): Promise<ArcadeResult | null> =>
	playBoard<View>(ctx, "koikoi", {
		start: () => ({
			s: kkStart(rnd),
			hi: 0,
			pi: 0,
			ki: 0,
			wait: 0.4,
			endT: 0,
			show: -1,
			showT: 0,
			j: juice(),
		}),
		step: (v, f) => {
			juiceStep(v.j, f.dt);
			const s = v.s;
			if (v.showT < 50) v.showT = Math.max(0, v.showT - f.dt);
			if (s.phase === "end") {
				v.endT += f.dt;
				if (kkOver(s)) return;
				const go =
					v.endT > 6 ||
					(v.endT > 0.6 && f.evs.some((e) => isKey(e, "a") || isTap(e)));
				if (go) {
					kkNext(s, rnd);
					v.hi = 0;
					v.show = -1;
					v.wait = KK.think;
					f.se("cardFlip");
					f.say(SAY.next);
				}
				return;
			}
			if (s.phase === "flip") {
				v.wait -= f.dt;
				if (v.wait <= 0) doFlip(v, f);
				return;
			}
			if (s.turn === 1) {
				// 名無しの 番
				v.wait -= f.dt;
				if (v.wait > 0) return;
				if (s.phase === "hand") doPlay(v, kkCpuPlay(s, rnd), f);
				else if (s.phase === "pickHand" || s.phase === "pickFlip")
					doPick(v, kkCpuPick(s), f);
				else if (s.phase === "koi") doKoi(v, !kkCpuKoi(s), f);
				return;
			}
			// キリコの 番
			const hand = s.side[0].hand;
			for (const e of f.evs) {
				if (v.s.phase === "hand") {
					if (isKey(e, "left", true)) {
						v.hi = (v.hi + hand.length - 1) % hand.length;
						f.se("cursor");
					} else if (isKey(e, "right", true)) {
						v.hi = (v.hi + 1) % hand.length;
						f.se("cursor");
					} else if (isKey(e, "a")) doPlay(v, v.hi, f);
					else if (isTap(e)) {
						const i = handAt(s, e.tap);
						if (i >= 0) {
							if (i === v.hi) doPlay(v, i, f);
							else {
								v.hi = i;
								f.se("cursor");
							}
							continue;
						}
						// 場の 札：合う 手札（えらんで いる 札を 先に）を 出して それを 取る
						const t = fieldAt(s, e.tap);
						if (t < 0) continue;
						const fits = (c: number | undefined) =>
							c !== undefined && kkMonth(c) === kkMonth(t);
						const i2 = fits(hand[v.hi]) ? v.hi : hand.findIndex(fits);
						if (i2 < 0) f.se("cancel");
						else doPlay(v, i2, f, t);
					}
				} else if (v.s.phase === "pickHand" || v.s.phase === "pickFlip") {
					const picks = v.s.picks;
					if (isKey(e, "left", true) || isKey(e, "right", true)) {
						v.pi = (v.pi + 1) % picks.length;
						f.se("cursor");
					} else if (isKey(e, "a")) doPick(v, picks[v.pi] ?? -1, f);
					else if (isTap(e)) {
						const t = fieldAt(s, e.tap);
						if (picks.includes(t)) doPick(v, t, f);
					}
				} else if (v.s.phase === "koi") {
					if (isKey(e, "left", true) || isKey(e, "right", true)) {
						v.ki = 1 - v.ki;
						f.se("cursor");
					} else if (isKey(e, "a")) doKoi(v, v.ki === 0, f);
					else if (isTap(e)) {
						if (inside(e.tap, BTN[0] as Rect)) doKoi(v, true, f);
						else if (inside(e.tap, BTN[1] as Rect)) doKoi(v, false, f);
					}
				}
			}
		},
		draw: (g, v, clock) => {
			const s = v.s;
			const blink = Math.floor(clock * 4) % 2 === 0;
			g.fillStyle = "#14100c";
			g.fillRect(0, 0, AW, AH);
			shaken(g, v.j, () => {
				// 台（赤い 毛氈）
				rect(g, 2, 31, 164, 56, "#5a1a1a");
				rect(g, 2, 31, 164, 1, "#8a3030");
				// 名無しの 手札（裏）
				s.side[1].hand.forEach((_, i) => {
					rect(g, 4 + i * 9, CPU_Y, 8, 11, "#201418");
					rect(g, 5 + i * 9, CPU_Y + 1, 6, 9, "#6a1a1a");
				});
				const nk = s.side[1].koi;
				txt(g, "名無し", 80, CPU_Y + 1, 8, "#f4f2ea");
				if (nk) txt(g, `こいこい${nk}`, 112, CPU_Y + 1, 8, "#ff9060");
				// 山
				if (s.deck.length) {
					card(g, DECK[0] + 1, DECK[1] + 1, -1);
					card(g, DECK[0], DECK[1], -1);
				}
				txt(
					g,
					`${s.deck.length}`,
					DECK[0] + CW / 2,
					DECK[1] + CH + 1,
					7,
					"#c8b890",
					"center",
				);
				// 出した・めくった 札
				if (v.show >= 0 && v.showT > 0) card(g, SHOW_X, SHOW_Y, v.show);
				// 場
				const sel =
					s.turn === 0 && s.phase === "hand" ? s.side[0].hand[v.hi] : undefined;
				const match = sel === undefined ? [] : kkMatches(s.field, sel);
				s.field.forEach((c, i) => {
					const [x, y] = fieldXY(i, s.field.length);
					card(g, x, y, c);
					const picking =
						(s.phase === "pickHand" || s.phase === "pickFlip") &&
						s.picks.includes(c);
					const cur = picking && s.turn === 0 && s.picks[v.pi] === c;
					if (match.includes(c) || (picking && (cur ? true : blink))) {
						g.strokeStyle = cur ? "#60a0ff" : "#f0c040";
						g.lineWidth = 1;
						g.strokeRect(x - 0.5, y - 0.5, CW + 1, CH + 1);
					}
				});
				// キリコの 手札
				s.side[0].hand.forEach((c, i) => {
					const up = s.turn === 0 && s.phase === "hand" && i === v.hi;
					const x = handX(i);
					const y = HAND_Y - (up ? 4 : 0);
					card(g, x, y, c);
					if (up) {
						g.strokeStyle = "#60a0ff";
						g.lineWidth = 1;
						g.strokeRect(x - 0.5, y - 0.5, CW + 1, CH + 1);
					}
				});
				const mk = s.side[0].koi;
				txt(g, "キリコ", 6, 124, 8, "#f4f2ea");
				if (mk) txt(g, `こいこい${mk}`, 38, 124, 8, "#ff9060");
				const my = kkYaku(s.side[0].take);
				if (my.length)
					txt(
						g,
						my.map((y) => `${y.name}${y.pts}`).join("　"),
						6,
						136,
						7,
						"#ffe060",
					);
				// 取った 札
				rect(g, TAKE_X - 3, 15, 1, AH - 17, "#3a3028");
				takePile(g, s.side[1].take, TAKE_Y[0]);
				txt(
					g,
					`${kkPts(s.side[1].take)}点`,
					AW - 4,
					TAKE_Y[0] + 41,
					7,
					"#c8b890",
					"right",
				);
				takePile(g, s.side[0].take, TAKE_Y[1]);
				txt(
					g,
					`${kkPts(s.side[0].take)}点`,
					AW - 4,
					TAKE_Y[1] + 41,
					7,
					"#c8b890",
					"right",
				);
			});
			// 役が できた（キリコ）：あがり／こいこい
			if (s.phase === "koi" && s.turn === 0) {
				rect(g, 26, 32, 138, 56, "rgba(10,6,4,0.88)");
				g.strokeStyle = "#f0c040";
				g.strokeRect(26.5, 32.5, 137, 55);
				const ys = kkYaku(s.side[0].take);
				txt(
					g,
					`役が　できた　${kkPts(s.side[0].take)}点`,
					95,
					36,
					8,
					"#ffe060",
					"center",
				);
				txt(
					g,
					ys.map((y) => `${y.name}${y.pts}`).join("　"),
					95,
					48,
					7,
					"#f4e8c8",
					"center",
				);
				if (s.side[1].koi)
					txt(g, "あがると　2倍", 95, 58, 7, "#ff9060", "center");
				button(g, BTN[0] as Rect, "あがり", v.ki === 0);
				button(g, BTN[1] as Rect, "こいこい", v.ki === 1);
			}
			// 月の おわり
			if (s.phase === "end" && v.endT > 0.4) {
				rect(g, 26, 32, 138, 56, "rgba(10,6,4,0.9)");
				g.strokeStyle = "#f0c040";
				g.strokeRect(26.5, 32.5, 137, 55);
				const w = s.roundWin;
				const head =
					w < 0
						? "流れ"
						: `${w === 0 ? "キリコ" : "名無し"}の　あがり　${s.roundPts}点`;
				txt(g, head, 95, 37, 8, w === 0 ? "#ffe060" : "#f4f2ea", "center");
				if (w >= 0) {
					const ys = kkYaku(s.side[w === 0 ? 0 : 1].take);
					txt(
						g,
						ys.map((y) => `${y.name}${y.pts}`).join("　"),
						95,
						50,
						7,
						"#f4e8c8",
						"center",
					);
					if (s.side[w === 0 ? 1 : 0].koi)
						txt(g, "こいこい返しで　2倍", 95, 60, 7, "#ff9060", "center");
				}
				if (!kkOver(s) && blink)
					txt(g, "A／タップで　次の　月へ", 95, 74, 7, "#c8b890", "center");
			}
			const turn =
				s.phase === "end"
					? ""
					: s.turn === 0
						? "キリコの　番"
						: `名無し${".".repeat(Math.floor(clock * 4) % 4)}`;
			hud(g, `${s.month + 1}／${KK.months}月　${s.pts[0]}対${s.pts[1]}`, turn);
			juiceDraw(g, v.j, AW, AH);
		},
		over: (v) => kkOver(v.s) && v.endT >= 2.6,
		score: (v) => kkScore(v.s),
		end: (v) =>
			v.s.pts[0] > v.s.pts[1]
				? ARCADE.clear
				: v.s.pts[0] === v.s.pts[1]
					? "引き分け"
					: ARCADE.over,
	});
