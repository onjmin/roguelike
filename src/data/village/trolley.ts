// 保守トロッコ（作者の 指示「まだ 広大な 保守村なので ワープポイント的な ものも」「トロッコで 特定の 地点まで 高速に 移動」）。
//
// 村の あちこちに 乗り場（黄色い 札と とまった トロッコ）。調べると 行き先を えらび、キリコが トロッコに 乗って
// 道なりに 速く 走って 着く（ui/village.ts の ride。人は すりぬけ、扉・口は 踏まない）。
// 乗り場は はじめから 5つ（広場・浜・西口・北の 峠・東口）、新市街（段4〜）と 港（段7）で ふえる。
// 町割りが かわる 所（東口・新市街）は 段で 乗り場が 移る。どれも 寄り道で、強さには 効かない。
// 乗り場の 絵は scripts/make-trolley.mjs。

import type { Cell } from "./map";

export type TrolleyStop = {
	id: string;
	/** 行き先の 名前（えらぶ 窓と 着いた ときの 知らせ）。 */
	name: string;
	/** 乗り場の マス（札と トロッコ。通れない）。降りて 立つのは その 1つ下。 */
	at: Cell;
};

type StopDef = {
	id: string;
	name: string;
	/** 町の 段ごとの 乗り場（[この 段から, マス]。段が 上がると 町割りに 合わせて 移る）。 */
	at: readonly (readonly [from: number, cell: Cell])[];
};

const STOPS: readonly StopDef[] = [
	// 広場の 南（蓄音機の 左下。下の 池への 道の 入り口）
	{ id: "plaza", name: "広場", at: [[0, [18, 23]]] },
	// 浜の まんなか（桟橋の 東）
	{ id: "beach", name: "浜", at: [[0, [27, 34]]] },
	// 西の 空き地（西の 口の そば。本屋 → 図書館の 前）
	{ id: "west", name: "西口", at: [[0, [6, 21]]] },
	// 北の 丘（峠の 口の 下。立ち食いそばの となり）
	{ id: "north", name: "北の　峠", at: [[0, [26, 5]]] },
	// 東の 口の そば（はじめは 森の 中の 空き地、新市街で 区画の すみ、住宅街から 線路ぎわの 草地）
	{
		id: "east",
		name: "東口",
		at: [
			[0, [84, 20]],
			[4, [84, 18]],
			[6, [77, 25]],
		],
	},
	// 新市街（大通りの 北の 区画 → 住宅街から 大通りの 南の 植えこみ）
	{
		id: "newtown",
		name: "新市街",
		at: [
			[4, [54, 18]],
			[6, [62, 25]],
		],
	},
	// 都市の 港（コンテナの 岸壁）
	{ id: "port", name: "港", at: [[7, [56, 48]]] },
];

/** その 段の 乗り場（決まった 並び：えらぶ 窓も この 順）。 */
export const trolleyStops = (stage: number): TrolleyStop[] =>
	STOPS.flatMap((s) => {
		const hit = [...s.at].reverse().find(([from]) => stage >= from);
		return hit ? [{ id: s.id, name: s.name, at: hit[1] }] : [];
	});

/** 乗り場の 名前（どの 段でも）。 */
export const TROLLEY_NAMES: readonly string[] = STOPS.map((s) => s.name);

/** 降りて 立つ マス（乗り場の 1つ下。下を 向く）。 */
export const trolleyStand = (s: TrolleyStop): Cell => [s.at[0], s.at[1] + 1];

/** 乗り場の 絵（16x32。札と とまった トロッコ）と、乗っている ときの トロッコ（キリコの 足に かぶせる）。 */
export const TROLLEY_SPRITE = "pub:sprites/trolley.png#0,0,16,32";
export const TROLLEY_CART = "pub:sprites/trolley.png#16,16,16,16";

export const TROLLEY_MSG = {
	/** 調べた とき（ここの 名前）。 */
	ask: (here: string): string =>
		`保守トロッコ　${here}　乗り場。\nどこへ　行く？`,
	/** 調べた とき（はじめて。村に いる あいだ 1回）。 */
	first: "古い　トロッコが　とまっている。\n……村の　あちこちへ　走るらしい",
	cancel: "やめる",
	/** 着いた ときの 知らせ。 */
	arrive: (name: string): string => `保守トロッコ　${name}`,
} as const;
