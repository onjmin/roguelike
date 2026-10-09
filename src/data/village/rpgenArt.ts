// scripts/pack-rpgen.mjs が 書き出す（手で 書きかえない。部品を かえる ときは pack-rpgen.mjs の GROUPS）。
// 絵は RPGEN（https://rpgen.us/）の スプライトセットから 選んで 1枚に まとめた もの
// （検索: https://rpgen-search.pages.dev/）。赤い 灯り・赤十字の 2つだけ 手描き。

/** まとめた 絵（public/sprites/rpgen-modern.png。256x288）。 */
export const RPGEN_IMG = "pub:sprites/rpgen-modern.png";
export const RPGEN_SIZE = [256, 288] as const;

/** 群の 名前 → [列, 行, 幅, 高さ]（アトラスの マス）。 */
export const RPGEN_CELLS = {
	roofFlat: [0, 0, 3, 2],
	concrete: [3, 0, 1, 1],
	roofSlab: [4, 0, 3, 2],
	skylight: [7, 0, 1, 1],
	waterTank: [8, 0, 1, 1],
	eave: [9, 0, 2, 2],
	hipRed: [11, 0, 3, 2],
	hipBlue: [0, 2, 3, 2],
	jpRoof: [3, 2, 5, 2],
	jpGable: [8, 2, 3, 2],
	white: [11, 2, 3, 3],
	gray: [0, 4, 3, 2],
	beige: [3, 4, 3, 2],
	shin: [6, 4, 3, 2],
	wallTex: [9, 5, 6, 1],
	glass: [0, 6, 3, 1],
	shutter: [14, 0, 2, 1],
	shutterRed: [7, 1, 2, 1],
	bay: [14, 1, 2, 1],
	jpLow: [3, 6, 5, 1],
	jpFront: [8, 6, 5, 1],
	jpEnt: [13, 6, 3, 1],
	jpWood: [14, 2, 2, 1],
	plank: [14, 3, 1, 2],
	reed: [3, 1, 1, 1],
	band: [0, 7, 3, 5],
	win24: [3, 7, 4, 1],
	win108: [7, 7, 7, 1],
	shopGlass: [3, 8, 3, 1],
	autoDoor: [14, 7, 2, 2],
	curtainBig: [6, 8, 3, 2],
	winPink: [9, 8, 2, 2],
	flowerBox: [9, 4, 2, 1],
	door108: [11, 8, 3, 1],
	archTall: [15, 3, 1, 2],
	pillar: [3, 9, 1, 3],
	led: [11, 9, 4, 1],
	ledGray: [4, 10, 4, 1],
	banner: [4, 9, 2, 1],
	sign92: [8, 10, 5, 1],
	depart: [4, 11, 4, 1],
	sign25: [13, 10, 3, 1],
	kooriFlag: [15, 5, 1, 1],
	lanternStone: [15, 9, 1, 1],
	caution: [8, 11, 1, 1],
	canopy: [9, 11, 3, 2],
	ramenBowl: [12, 11, 1, 1],
	vend: [13, 11, 2, 2],
	vendBlue: [0, 12, 2, 2],
	busStop: [15, 11, 1, 2],
	small25: [2, 12, 4, 1],
	bike: [6, 12, 2, 1],
	pot: [2, 13, 5, 1],
	box: [7, 13, 2, 1],
	planter: [9, 13, 3, 1],
	fence: [12, 13, 3, 1],
	rope: [0, 14, 2, 1],
	redCarpet: [8, 12, 1, 1],
	carFront: [2, 14, 2, 2],
	sedanE: [4, 14, 4, 2],
	sedanBlueW: [8, 14, 4, 2],
	wagonWhiteW: [12, 14, 4, 2],
	wagonE: [0, 16, 4, 2],
	redLamp: [12, 12, 1, 1],
	redCross: [15, 13, 1, 1],
} as const;

export type RpgenName = keyof typeof RPGEN_CELLS;

/**
 * 群の 中の (x, y) マスから w×h マス。縦に 2マスの 物は h=2 で 16x32 に 切る
 * （下端そろえで 上の マスへ はみ出す。data/village/tiles.ts の 書き方と 同じ）。
 */
export const art = (name: RpgenName, x = 0, y = 0, w = 1, h = 1): string => {
	const [c, r] = RPGEN_CELLS[name];
	return `${RPGEN_IMG}#${(c + x) * 16},${(r + y) * 16},${w * 16},${h * 16}`;
};
