// ホシュクラ（保守村の 島）の 絵（public/sprites/saba.png）の どこに 何が あるか。scripts/make-saba.mjs が 書く（手で 直さない）。
// マスは 16x16 の [列, 行]。sb(name) は 1マス、sb(name, 2) は 下の マスまで（16x32。ドア）。

export const SABA_IMG = "pub:sprites/saba.png";
export const SABA_SIZE = [256, 64] as const;
/** 匠の 歩行グラ（手描き。32x64）。 */
export const TAKUMI_WALK = "pub:sprites/saba_takumi.png";

export const SABA_CELLS = {
	grassTop: [0, 0],
	grassSide: [1, 0],
	dirt: [2, 0],
	stone: [3, 0],
	cobble: [4, 0],
	pathTop: [5, 0],
	planks: [6, 0],
	logTop: [7, 0],
	white: [8, 0],
	glass: [9, 0],
	stoneBrick: [10, 0],
	farmland: [11, 0],
	bedrock: [12, 0],
	darkPlanks: [13, 0],
	jack: [14, 0],
	lampOn: [15, 0],
	ironBlock: [0, 1],
	spawner: [1, 1],
	craftTop: [2, 1],
	furnaceLit: [3, 1],
	torch: [4, 1],
	ladder: [5, 1],
	bed: [6, 1],
	jukebox: [7, 1],
	lava: [8, 1],
	coalOre: [9, 1],
	diamondOre: [10, 1],
	diamond: [11, 1],
	crack: [12, 1],
	doorTop: [15, 1],
	doorBottom: [15, 2],
	sign: [0, 2],
	hole: [1, 2],
	fence: [2, 2],
	wheat: [3, 2],
	chest: [4, 2],
	ballot: [5, 2],
	pickaxe: [6, 2],
	plate: [7, 2],
	post: [8, 2],
	water: [9, 2],
	townSign: [10, 2],
	takumi: [11, 2],
	takumiFlash: [12, 2],
	kirikoUp0: [0, 3],
	kirikoUp1: [1, 3],
	kirikoRight0: [2, 3],
	kirikoRight1: [3, 3],
	kirikoDown0: [4, 3],
	kirikoDown1: [5, 3],
	kirikoLeft0: [6, 3],
	kirikoLeft1: [7, 3],
} as const;

export type SabaCell = keyof typeof SABA_CELLS;

/** 絵の 参照（pub:…#x,y,16,16。h=2 で 16x32）。 */
export const sb = (name: SabaCell, h: 1 | 2 = 1): string => {
	const [c, r] = SABA_CELLS[name];
	return `${SABA_IMG}#${c * 16},${r * 16},16,${h * 16}`;
};
