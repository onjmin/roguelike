// キリコの 家の 遊べる 家具「ぷゆゆの ぬいぐるみ」の ぷゆゆ なでなで（板は ui/arcade/home/clicker.ts）。
// ぷゆゆを なでると 1匹 ふえる。ふえた ぷゆゆで なで手を やとうと 毎秒 ふえる。手袋で なでる 1回の 数が ふえる。
// 値段は 買う たびに 上がる（なで手 ×1.15・手袋 ×1.6）。60秒。スコア＝それまでに ふえた ぷゆゆの 合計（使った 分も 数える）。
// DOM に 触らない（試験できる）。

export const CK = {
	time: 60,
	/** なで手の 値上がり。 */
	grow: 1.15,
	/** 手袋の 値上がり。 */
	gloveGrow: 1.6,
} as const;

/** 店の 品（rate＝毎秒 ふえる 数。glove は なでる 1回に +1）。 */
export const CK_SHOP: readonly {
	name: string;
	cost: number;
	rate: number;
	glove?: boolean;
}[] = [
	{ name: "手袋", cost: 20, rate: 0, glove: true },
	{ name: "名無し", cost: 15, rate: 1 },
	{ name: "保守係", cost: 90, rate: 5 },
	{ name: "まとめ民", cost: 450, rate: 22 },
	{ name: "スレ立て職人", cost: 2200, rate: 90 },
];

export const CLICKER_TEXT = {
	note: "上下で　えらぶ　右で　やとう　A で　なでる",
	short: "ぷゆゆが　たりない",
	bought: "{name}を　やとった",
	glove: "なでる　手が　うまくなった",
	timeUp: "TIME UP",
	perSec: "毎秒",
} as const;

export type CkState = {
	t: number;
	/** 手もちの ぷゆゆ（小数も ためる）。 */
	puyu: number;
	/** ふえた 合計。 */
	total: number;
	/** 品ごとの 数。 */
	own: number[];
	/** 店の えらんで いる 行。 */
	sel: number;
	clicks: number;
	over: boolean;
};

export type CkEvent = "click" | "buy" | "short" | "time";

export const ckStart = (): CkState => ({
	t: 0,
	puyu: 0,
	total: 0,
	own: CK_SHOP.map(() => 0),
	sel: 1,
	clicks: 0,
	over: false,
});

export const ckScore = (s: CkState): number => Math.floor(s.total);
export const ckTimeLeft = (s: CkState): number =>
	Math.max(0, Math.ceil(CK.time - s.t));

/** なでる 1回の 数。 */
export const ckPower = (s: CkState): number => 1 + (s.own[0] ?? 0);

/** 毎秒 ふえる 数。 */
export const ckRate = (s: CkState): number =>
	CK_SHOP.reduce((a, it, i) => a + it.rate * (s.own[i] ?? 0), 0);

export const ckCost = (s: CkState, i: number): number => {
	const it = CK_SHOP[i];
	if (!it) return Number.POSITIVE_INFINITY;
	const g = it.glove ? CK.gloveGrow : CK.grow;
	return Math.ceil(it.cost * g ** (s.own[i] ?? 0));
};

const gain = (s: CkState, n: number): void => {
	s.puyu += n;
	s.total += n;
};

/** なでる（ふえた 数を 返す）。 */
export const ckClick = (s: CkState): number => {
	if (s.over) return 0;
	const n = ckPower(s);
	gain(s, n);
	s.clicks++;
	return n;
};

/** 買う（たりなければ false）。 */
export const ckBuy = (s: CkState, i: number): boolean => {
	if (s.over || !CK_SHOP[i]) return false;
	const c = ckCost(s, i);
	if (s.puyu < c) return false;
	s.puyu -= c;
	s.own[i] = (s.own[i] ?? 0) + 1;
	return true;
};

export const ckStep = (s: CkState, dt: number): CkEvent[] => {
	if (s.over) return [];
	const d = Math.min(dt, CK.time - s.t);
	s.t += dt;
	gain(s, ckRate(s) * Math.max(0, d));
	if (s.t >= CK.time) {
		s.over = true;
		return ["time"];
	}
	return [];
};
