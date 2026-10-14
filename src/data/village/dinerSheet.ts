// scripts/make-diner.mjs が 書き出す（手で 書きかえない。絵を かえる ときは make-diner.mjs）。
// バーガー屋「ワイバーガー」と メイド喫茶「メイドの土産」の 手描きの 絵（data/village/eateries.ts・data/town/eateries.ts）。

/** 品と 品書きの 板（public/sprites/diner.png。256x32）。 */
export const DINER_IMG = "pub:sprites/diner.png";
export const DINER_SIZE = [256, 32] as const;

/** 絵の 名前 → [列, 行]（16x16 の マス）。 */
export const DINER_CELLS = {
	burger: [0, 0],
	kusaBurger: [1, 0],
	fries: [2, 0],
	nugget: [3, 0],
	shake: [4, 0],
	set: [5, 0],
	omurice: [6, 0],
	parfait: [7, 0],
	creamSoda: [8, 0],
	shortcake: [9, 0],
	latte: [10, 0],
	menuL: [11, 0],
	menuM: [12, 0],
	menuR: [13, 0],
	maidBoard: [14, 0],
	burgerSign: [15, 0],
	heartSign: [0, 1],
} as const;

export type DinerName = keyof typeof DINER_CELLS;

/** 絵（16x16）。 */
export const diner = (name: DinerName): string => {
	const [c, r] = DINER_CELLS[name];
	return `${DINER_IMG}#${c * 16},${r * 16},16,16`;
};

/** メイドさんの 歩行グラ（手描き。32x64）。 */
export const MAID_WALK = "pub:sprites/maid_walk.png";
