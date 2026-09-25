// 階の見た目（タイルシートの切り出し）。rpg と同じ同梱シート Base.png の「ダン 床・壁・階段」を使う。
//
// 壁は 3/4 見下ろしの2段（上の面・下の面）。床のすぐ上の壁マスに「下の面」、
// その上に「上の面」、それ以外の壁は闇の色で塗る。

const BASE = "pub:assets/rpg-reze/Base.png";
const cut = (c: number, r: number, w = 1, h = 1): string =>
	`${BASE}#${c * 16},${r * 16},${w * 16},${h * 16}`;

export type Theme = {
	name: string;
	floor: string;
	corridor: string;
	stairs: string;
	wallUpper: string[];
	wallLower: string[];
	/** 壁の奥（闇）の色。 */
	dark: string;
	/** 画像が読めないときの床の色。 */
	floorColor: string;
	/** 見たことはあるが今は見えない所に重ねる色。 */
	fog: string;
};

const walls = (row: number): string[] =>
	[0, 1, 2, 3, 4, 5].map((x) => cut(x, row));

/** 土の洞窟（上層）。 */
const EARTH: Theme = {
	name: "earth",
	floor: cut(0, 162),
	corridor: cut(1, 162),
	stairs: cut(0, 163),
	wallUpper: walls(169),
	wallLower: walls(170),
	dark: "#0b0908",
	floorColor: "#6b5a3e",
	fog: "rgba(4, 3, 10, 0.58)",
};

/** 青い水晶（中層）。 */
const CRYSTAL: Theme = {
	name: "crystal",
	floor: cut(0, 164),
	corridor: cut(1, 164),
	stairs: cut(0, 165),
	wallUpper: walls(173),
	wallLower: walls(174),
	dark: "#05070e",
	floorColor: "#3c5a78",
	fog: "rgba(2, 3, 12, 0.6)",
};

/** 赤い溶岩（深層）。 */
const LAVA: Theme = {
	name: "lava",
	floor: cut(4, 162),
	corridor: cut(5, 162),
	stairs: cut(4, 163),
	wallUpper: walls(171),
	wallLower: walls(172),
	dark: "#0d0505",
	floorColor: "#6e3a2c",
	fog: "rgba(8, 2, 4, 0.6)",
};

/** 最下層（金）。 */
const GOLD: Theme = {
	name: "gold",
	floor: cut(0, 168),
	corridor: cut(1, 168),
	stairs: cut(0, 167),
	wallUpper: walls(177),
	wallLower: walls(178),
	dark: "#0a0804",
	floorColor: "#7a6630",
	fog: "rgba(6, 4, 2, 0.58)",
};

export const themeFor = (depth: number, last: number): Theme => {
	if (depth >= last) return GOLD;
	if (depth <= 8) return EARTH;
	if (depth <= 16) return CRYSTAL;
	return LAVA;
};

/** 罠の見た目（見つけたものだけ描く）。 */
export const TRAP_ICON: Record<string, string> = {
	pit: cut(2, 190),
	mine: cut(0, 250),
	arrow: cut(2, 187),
	sleep: cut(6, 13),
	spin: cut(7, 13),
	warp: cut(7, 13),
	rust: cut(4, 187),
	hunger: cut(6, 187),
	summon: cut(0, 187),
};
