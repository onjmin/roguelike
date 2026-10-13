// キリコの 家の 遊べる 家具「花札」の こいこい（板は ui/arcade/home/koikoi.ts）。
// 札は 48枚（12か月 × 4枚。光・タネ・短冊・カス）。札の 番号 id の 月は floor(id/4)、その 月の 何枚目かは id%4。
// 配り：手札 8枚ずつ・場 8枚・山 24枚（場か 手札に 同じ 月が 4枚 そろったら 配りなおす）。
// 1手：手札を 1枚 出す（場に 同じ 月が あれば 取る、なければ 場に 置く）→ 山から 1枚 めくって 同じく。
//   同じ 月が 場に 2枚 あれば どちらを 取るか えらぶ。3枚 あれば 4枚 まとめて 取る。
// 役（点）：五光10・四光8・雨四光7・三光5・猪鹿蝶5・花見で一杯5・月見で一杯5・赤短5・青短5・
//   短冊（5枚で 1、1枚 ふえるごとに ＋1）・タネ（同じ）・カス（10枚で 1、＋1ずつ）。役は 足し算。
// 役が できた（ふえた）ら あがるか こいこいか。あがると その 点。相手が こいこいした あとに あがると 2倍。
//   手札が もう ない ときは そのまま あがり。どちらも あがらず 手札が つきたら 流れ（0点）。
// 3か月（3回）で おわり。あがった ほうが 次の 月の 親（先に 打つ）。
// 名無し（CPU）：役に なる 札・点の 高い 札を 取り、キリコの 役に なる 札は 先に 取る。
//   こいこいは 点が 低く 手札が 残り、キリコの 役が 近くない ときだけ。
// スコア：キリコの 点の 合計×100（名無しより 多ければ ＋1000）。DOM に 触らない（試験できる）。

import type { Rnd } from "../logic";

export const KK = {
	/** 何か月 打つか。 */
	months: 3,
	hand: 8,
	field: 8,
	/** 名無しが 考える 間（秒）。 */
	think: 0.6,
	/** 手札を 出してから 山を めくるまでの 間（秒）。 */
	flipWait: 0.5,
	/** 点 1つの スコア。 */
	unit: 100,
	/** 名無しに 勝った ときの ボーナス。 */
	winBonus: 1000,
} as const;

export type KkKind = "hikari" | "tane" | "tan" | "kasu";
/** 役に かかわる 札の しるし。 */
export type KkTag =
	| ""
	| "rain"
	| "aka"
	| "ao"
	| "ino"
	| "shika"
	| "cho"
	| "sake"
	| "maku"
	| "tsuki";

/** 月の 名（札の 上に 出す 1字）と 草花。 */
export const KK_MONTH = [
	"松",
	"梅",
	"桜",
	"藤",
	"菖",
	"牡",
	"萩",
	"芒",
	"菊",
	"紅",
	"柳",
	"桐",
] as const;

/** 各月の 4枚（光・タネ・短冊・カス と しるし）。 */
const DEF: readonly (readonly (readonly [KkKind, KkTag])[])[] = [
	[
		["hikari", ""], // 松に 鶴
		["tan", "aka"],
		["kasu", ""],
		["kasu", ""],
	],
	[
		["tane", ""], // 梅に 鶯
		["tan", "aka"],
		["kasu", ""],
		["kasu", ""],
	],
	[
		["hikari", "maku"], // 桜に 幕
		["tan", "aka"],
		["kasu", ""],
		["kasu", ""],
	],
	[
		["tane", ""], // 藤に ほととぎす
		["tan", ""],
		["kasu", ""],
		["kasu", ""],
	],
	[
		["tane", ""], // 菖蒲に 八橋
		["tan", ""],
		["kasu", ""],
		["kasu", ""],
	],
	[
		["tane", "cho"], // 牡丹に 蝶
		["tan", "ao"],
		["kasu", ""],
		["kasu", ""],
	],
	[
		["tane", "ino"], // 萩に 猪
		["tan", ""],
		["kasu", ""],
		["kasu", ""],
	],
	[
		["hikari", "tsuki"], // 芒に 月
		["tane", ""], // 芒に 雁
		["kasu", ""],
		["kasu", ""],
	],
	[
		["tane", "sake"], // 菊に 盃
		["tan", "ao"],
		["kasu", ""],
		["kasu", ""],
	],
	[
		["tane", "shika"], // 紅葉に 鹿
		["tan", "ao"],
		["kasu", ""],
		["kasu", ""],
	],
	[
		["hikari", "rain"], // 柳に 小野道風
		["tane", ""], // 柳に 燕
		["tan", ""],
		["kasu", ""],
	],
	[
		["hikari", ""], // 桐に 鳳凰
		["kasu", ""],
		["kasu", ""],
		["kasu", ""],
	],
];

export const kkMonth = (id: number): number => Math.floor(id / 4);
export const kkKind = (id: number): KkKind =>
	DEF[kkMonth(id)]?.[id % 4]?.[0] ?? "kasu";
export const kkTag = (id: number): KkTag =>
	DEF[kkMonth(id)]?.[id % 4]?.[1] ?? "";

/** 札の 番号（月 0〜11、何枚目 0〜3）。 */
export const kkId = (month: number, k: number): number => month * 4 + k;

export type KkYaku = { name: string; pts: number };

const has = (take: readonly number[], tag: KkTag): boolean =>
	take.some((c) => kkTag(c) === tag);

/** 取った 札の 役（足し算）。 */
export const kkYaku = (take: readonly number[]): KkYaku[] => {
	const out: KkYaku[] = [];
	const n = (k: KkKind) => take.filter((c) => kkKind(c) === k).length;
	const hikari = n("hikari");
	const rain = has(take, "rain");
	if (hikari === 5) out.push({ name: "五光", pts: 10 });
	else if (hikari === 4)
		out.push(rain ? { name: "雨四光", pts: 7 } : { name: "四光", pts: 8 });
	else if (hikari === 3 && !rain) out.push({ name: "三光", pts: 5 });
	if (has(take, "ino") && has(take, "shika") && has(take, "cho"))
		out.push({ name: "猪鹿蝶", pts: 5 });
	if (has(take, "sake")) {
		if (has(take, "maku")) out.push({ name: "花見で一杯", pts: 5 });
		if (has(take, "tsuki")) out.push({ name: "月見で一杯", pts: 5 });
	}
	if (take.filter((c) => kkTag(c) === "aka").length === 3)
		out.push({ name: "赤短", pts: 5 });
	if (take.filter((c) => kkTag(c) === "ao").length === 3)
		out.push({ name: "青短", pts: 5 });
	const tan = n("tan");
	if (tan >= 5) out.push({ name: "短冊", pts: tan - 4 });
	const tane = n("tane");
	if (tane >= 5) out.push({ name: "タネ", pts: tane - 4 });
	const kasu = n("kasu");
	if (kasu >= 10) out.push({ name: "カス", pts: kasu - 9 });
	return out;
};

export const kkPts = (take: readonly number[]): number =>
	kkYaku(take).reduce((a, y) => a + y.pts, 0);

/** 札の 値うち（名無しの 見つもり）。 */
export const kkValue = (id: number): number => {
	const k = kkKind(id);
	const t = kkTag(id);
	if (k === "hikari") return t === "rain" ? 14 : 20;
	if (k === "tane") return t ? 14 : 8;
	if (k === "tan") return t ? 10 : 6;
	return 1;
};

/** 役の 組（あと 1枚で そろうか 見る）。 */
const SETS: readonly (readonly number[])[] = [
	[kkId(6, 0), kkId(9, 0), kkId(5, 0)], // 猪鹿蝶
	[kkId(0, 1), kkId(1, 1), kkId(2, 1)], // 赤短
	[kkId(5, 1), kkId(8, 1), kkId(9, 1)], // 青短
	[kkId(2, 0), kkId(8, 0)], // 花見で一杯
	[kkId(7, 0), kkId(8, 0)], // 月見で一杯
];
const LIGHTS = [0, 2, 7, 10, 11].map((m) => kkId(m, 0));

/** take に その 札が 入ると 役に 近づく 度あい（あと 1枚で 12、2枚で 4）。 */
export const kkNear = (take: readonly number[], id: number): number => {
	let v = 0;
	for (const set of [...SETS, LIGHTS]) {
		if (!set.includes(id)) continue;
		const got = set.filter((c) => take.includes(c)).length;
		const need = set === LIGHTS ? 3 : set.length;
		if (got >= need - 1) v = Math.max(v, 12);
		else if (got >= need - 2) v = Math.max(v, 4);
	}
	return v;
};

/** 相手が あと 1枚で 役の 組を そろえそうか。 */
const threat = (take: readonly number[]): boolean =>
	[...SETS, LIGHTS].some((set) => {
		const need = set === LIGHTS ? 3 : set.length;
		const got = set.filter((c) => take.includes(c)).length;
		return got >= need - 1 && got < need;
	});

export type KkSide = {
	hand: number[];
	take: number[];
	/** こいこいした 数。 */
	koi: number;
	/** こいこいした ときの 点（これを こえたら また 聞く）。 */
	base: number;
};

/**
 * hand 手札を えらぶ・pickHand 出した 札の 取り先を えらぶ・flip 山を めくる 前・
 * pickFlip めくった 札の 取り先を えらぶ・koi あがるか こいこいか・end その 月が おわった。
 */
export type KkPhase = "hand" | "pickHand" | "flip" | "pickFlip" | "koi" | "end";

export type KkState = {
	deck: number[];
	field: number[];
	/** 0 キリコ・1 名無し。 */
	side: [KkSide, KkSide];
	turn: 0 | 1;
	oya: 0 | 1;
	/** 何か月め（0 から）。 */
	month: number;
	phase: KkPhase;
	/** 取り先を えらぶ 札（-1 なし）。 */
	pending: number;
	/** えらべる 場の 札。 */
	picks: number[];
	/** 合計の 点。 */
	pts: [number, number];
	/** その 月の あがり（-1 流れ）と 点。 */
	roundWin: -1 | 0 | 1;
	roundPts: number;
};

/** 1枚 出した（めくった）結果。took は 取った 札（出した 札も ふくむ。置いた ときは 空）。 */
export type KkPlay = { card: number; took: number[] };

const shuffle = (a: number[], rnd: Rnd): number[] => {
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[a[i], a[j]] = [a[j] as number, a[i] as number];
	}
	return a;
};

/** 4枚 同じ 月が あるか。 */
const four = (cards: readonly number[]): boolean => {
	const c = new Array(12).fill(0);
	for (const id of cards) c[kkMonth(id)]++;
	return c.some((n) => n >= 4);
};

const deal = (s: KkState, rnd: Rnd): void => {
	for (;;) {
		const d = shuffle(
			Array.from({ length: 48 }, (_, i) => i),
			rnd,
		);
		const a = d.splice(0, KK.hand);
		const b = d.splice(0, KK.hand);
		const f = d.splice(0, KK.field);
		if (four(a) || four(b) || four(f)) continue;
		s.side = [
			{ hand: a.sort((x, y) => x - y), take: [], koi: 0, base: 0 },
			{ hand: b.sort((x, y) => x - y), take: [], koi: 0, base: 0 },
		];
		s.field = f;
		s.deck = d;
		break;
	}
	s.turn = s.oya;
	s.phase = "hand";
	s.pending = -1;
	s.picks = [];
	s.roundWin = -1;
	s.roundPts = 0;
};

export const kkStart = (rnd: Rnd): KkState => {
	const s: KkState = {
		deck: [],
		field: [],
		side: [
			{ hand: [], take: [], koi: 0, base: 0 },
			{ hand: [], take: [], koi: 0, base: 0 },
		],
		turn: 0,
		oya: 0,
		month: 0,
		phase: "hand",
		pending: -1,
		picks: [],
		pts: [0, 0],
		roundWin: -1,
		roundPts: 0,
	};
	deal(s, rnd);
	return s;
};

/** 場の 同じ 月の 札。 */
export const kkMatches = (field: readonly number[], id: number): number[] =>
	field.filter((c) => kkMonth(c) === kkMonth(id));

/** 札を 場に 合わせる（2枚 あれば 取り先を 待つ）。 */
const land = (s: KkState, card: number, pick: KkPhase): KkPlay => {
	const m = kkMatches(s.field, card);
	if (m.length === 2) {
		s.pending = card;
		s.picks = m;
		s.phase = pick;
		return { card, took: [] };
	}
	const me = s.side[s.turn];
	if (m.length === 0) {
		s.field.push(card);
		return { card, took: [] };
	}
	// 1枚なら それと、3枚なら まとめて
	s.field = s.field.filter((c) => !m.includes(c));
	me.take.push(card, ...m);
	return { card, took: [card, ...m] };
};

/** 1手の おわり（役を 見て、あがり・こいこい・次の 番・流れ を 決める）。 */
const afterTurn = (s: KkState): void => {
	const me = s.side[s.turn];
	const p = kkPts(me.take);
	if (p > me.base) {
		if (me.hand.length === 0) agari(s);
		else s.phase = "koi";
		return;
	}
	const foe = s.side[s.turn === 0 ? 1 : 0];
	if (me.hand.length === 0 && foe.hand.length === 0) {
		s.phase = "end";
		s.roundWin = -1;
		s.roundPts = 0;
		return;
	}
	s.turn = s.turn === 0 ? 1 : 0;
	s.phase = "hand";
};

/** 手札の i 枚目を 出す（hand の とき だけ）。 */
export const kkPlay = (s: KkState, i: number): KkPlay | null => {
	if (s.phase !== "hand") return null;
	const me = s.side[s.turn];
	const card = me.hand[i];
	if (card === undefined) return null;
	me.hand.splice(i, 1);
	const r = land(s, card, "pickHand");
	if (s.phase === "hand") s.phase = "flip";
	return r;
};

/** 取り先を えらぶ（pickHand・pickFlip の とき。picks に ない 札は null）。 */
export const kkPick = (s: KkState, target: number): KkPlay | null => {
	if (s.phase !== "pickHand" && s.phase !== "pickFlip") return null;
	if (!s.picks.includes(target)) return null;
	const card = s.pending;
	s.field = s.field.filter((c) => c !== target);
	s.side[s.turn].take.push(card, target);
	const was = s.phase;
	s.pending = -1;
	s.picks = [];
	if (was === "pickHand") s.phase = "flip";
	else afterTurn(s);
	return { card, took: [card, target] };
};

/** 山から 1枚 めくる（flip の とき）。 */
export const kkFlip = (s: KkState): KkPlay | null => {
	if (s.phase !== "flip") return null;
	const card = s.deck.shift();
	if (card === undefined) {
		afterTurn(s);
		return null;
	}
	s.phase = "hand";
	const r = land(s, card, "pickFlip");
	if (s.phase === "hand") afterTurn(s);
	return r;
};

/** 番の ほうが あがる（相手が こいこいして いたら 2倍）。 */
const agari = (s: KkState): void => {
	const me = s.side[s.turn];
	const foe = s.side[s.turn === 0 ? 1 : 0];
	const p = kkPts(me.take);
	const pts = foe.koi > 0 ? p * 2 : p;
	s.pts[s.turn] += pts;
	s.roundWin = s.turn;
	s.roundPts = pts;
	s.phase = "end";
};

/** あがる（true）か こいこい（false）か（koi の とき）。 */
export const kkKoi = (s: KkState, up: boolean): void => {
	if (s.phase !== "koi") return;
	if (up) {
		agari(s);
		return;
	}
	const me = s.side[s.turn];
	me.koi++;
	me.base = kkPts(me.take);
	s.turn = s.turn === 0 ? 1 : 0;
	s.phase = "hand";
};

/** 最後の 月が おわった。 */
export const kkOver = (s: KkState): boolean =>
	s.phase === "end" && s.month >= KK.months - 1;

/** 次の 月（あがった ほうが 親。流れは そのまま）。 */
export const kkNext = (s: KkState, rnd: Rnd): void => {
	if (s.phase !== "end" || kkOver(s)) return;
	if (s.roundWin >= 0) s.oya = s.roundWin === 0 ? 0 : 1;
	s.month++;
	deal(s, rnd);
};

export const kkScore = (s: KkState): number =>
	s.pts[0] * KK.unit + (kkOver(s) && s.pts[0] > s.pts[1] ? KK.winBonus : 0);

// ───────────────── 名無し ─────────────────

/** 札を 取った ときの 得（役の ふえ・値うち・相手の 役つぶし）。 */
const gainOf = (s: KkState, cards: readonly number[]): number => {
	const me = s.side[s.turn];
	const foe = s.side[s.turn === 0 ? 1 : 0];
	const before = kkPts(me.take);
	const after = kkPts([...me.take, ...cards]);
	let v = (after - before) * 15;
	for (const c of cards)
		v += kkValue(c) + kkNear(me.take, c) + kkNear(foe.take, c);
	return v;
};

/** 2枚の うち 取る ほう。 */
export const kkCpuPick = (s: KkState): number => {
	let best = s.picks[0] ?? -1;
	let bestV = -Infinity;
	for (const t of s.picks) {
		const v = gainOf(s, [s.pending, t]);
		if (v > bestV) {
			bestV = v;
			best = t;
		}
	}
	return best;
};

/** 出す 手札の 番め。 */
export const kkCpuPlay = (s: KkState, rnd: Rnd): number => {
	const me = s.side[s.turn];
	const foe = s.side[s.turn === 0 ? 1 : 0];
	let best = 0;
	let bestV = -Infinity;
	me.hand.forEach((c, i) => {
		const m = kkMatches(s.field, c);
		let v: number;
		if (m.length === 0)
			// 場に 置く：値うちの 高い 札・相手の 役に なる 札は 出したくない
			v = -kkValue(c) * 0.6 - kkNear(foe.take, c) * 1.5;
		else if (m.length === 3) v = gainOf(s, [c, ...m]);
		else v = Math.max(...m.map((t) => gainOf(s, [c, t])));
		v += rnd() * 2;
		if (v > bestV) {
			bestV = v;
			best = i;
		}
	});
	return best;
};

/** 名無しが こいこいするか（点が 低く、手札が 残り、相手の 役が 近くない とき）。 */
export const kkCpuKoi = (s: KkState): boolean => {
	const me = s.side[s.turn];
	const foe = s.side[s.turn === 0 ? 1 : 0];
	const p = kkPts(me.take);
	if (me.koi > 0 || foe.koi > 0) return false;
	return p <= 3 && me.hand.length >= 4 && !threat(foe.take);
};
