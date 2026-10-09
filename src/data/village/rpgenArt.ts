// scripts/pack-rpgen.mjs が 書き出す（手で 書きかえない。部品を かえる ときは pack-rpgen.mjs の GROUPS・ROOM_PIECES・FOOD）。
// 絵は RPGEN（https://rpgen.us/）の スプライトセットから 選んで まとめた もの
// （検索: https://rpgen-search.pages.dev/）。赤い 灯り・赤十字・たこ焼きの 3つだけ 手描き。
// 部屋の 絵の 少し（台の 上の 家電・ダンベル）と 外観の のれん・日よけの 色がえは 同梱の Base.png から 切って 詰めた もの。

/** まとめた 絵（public/sprites/rpgen-modern.png。256x304）。施設の 外観・街の 物。 */
export const RPGEN_IMG = "pub:sprites/rpgen-modern.png";
export const RPGEN_SIZE = [256, 304] as const;

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
	stallPole: [13, 11, 2, 1],
	stallCounter: [0, 12, 3, 1],
	menuStand: [15, 11, 1, 1],
	signYellow: [3, 12, 1, 1],
	signOrange: [4, 12, 1, 1],
	signRed: [5, 12, 1, 1],
	boardWood: [6, 12, 2, 1],
	lattice: [12, 12, 4, 2],
	yellowWindow: [8, 12, 1, 1],
	norenRed: [0, 13, 1, 1],
	norenBrown: [1, 13, 1, 1],
	awningOrange: [2, 13, 1, 1],
	vend: [3, 13, 2, 2],
	vendBlue: [5, 13, 2, 2],
	busStop: [7, 13, 1, 2],
	small25: [8, 13, 4, 1],
	bike: [0, 14, 2, 1],
	pot: [8, 14, 5, 1],
	box: [13, 14, 2, 1],
	planter: [0, 15, 3, 1],
	fence: [3, 15, 3, 1],
	rope: [6, 15, 2, 1],
	redCarpet: [2, 14, 1, 1],
	carFront: [8, 15, 2, 2],
	sedanE: [10, 15, 4, 2],
	sedanBlueW: [0, 16, 4, 2],
	wagonWhiteW: [4, 16, 4, 2],
	wagonE: [8, 17, 4, 2],
	redLamp: [15, 14, 1, 1],
	redCross: [14, 15, 1, 1],
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

/** 部屋の 家具・小物を まとめた 絵（public/sprites/rpgen-interior.png。256x240）。施設の 中。 */
export const ROOM_IMG = "pub:sprites/rpgen-interior.png";
export const ROOM_SIZE = [256, 240] as const;

/** 物の 名前 → [列, 行, 幅, 高さ]（アトラスの マス）。 */
export const ROOM_CELLS = {
	shelfGoods: [0, 0, 2, 2],
	drinkCase: [2, 0, 1, 2],
	iceChest: [3, 0, 2, 1],
	whiteCounter: [5, 0, 2, 1],
	yellowCounter: [7, 0, 2, 1],
	lowShelf: [9, 0, 2, 1],
	lowShelfB: [11, 0, 2, 1],
	glassCase: [13, 0, 2, 1],
	safe: [15, 0, 1, 1],
	atm: [3, 1, 1, 1],
	register: [4, 1, 1, 1],
	boxes: [5, 1, 1, 2],
	boxesB: [6, 1, 1, 2],
	crate: [7, 1, 1, 1],
	crateB: [8, 1, 1, 1],
	binCans: [9, 1, 1, 1],
	binPet: [10, 1, 1, 1],
	binBurn: [11, 1, 1, 1],
	trash: [12, 1, 1, 1],
	extinguisher: [13, 1, 1, 1],
	payphone: [14, 1, 1, 2],
	corkBoard: [0, 2, 3, 2],
	departures: [7, 2, 4, 2],
	lockers: [3, 2, 2, 2],
	braille: [15, 1, 1, 1],
	memo: [11, 2, 1, 1],
	notice: [12, 2, 1, 1],
	poster: [13, 2, 1, 1],
	posterB: [15, 2, 1, 1],
	banner: [5, 3, 2, 1],
	scroll: [11, 3, 1, 1],
	scale: [12, 3, 1, 2],
	signRestroom: [13, 3, 1, 1],
	tvSmall: [14, 3, 1, 1],
	tvBig: [0, 4, 2, 1],
	tvCrt: [15, 3, 1, 1],
	tvCrtB: [2, 4, 1, 1],
	console: [3, 4, 1, 1],
	guitar: [4, 4, 1, 1],
	guitarB: [5, 4, 1, 1],
	records: [6, 4, 1, 1],
	ecg: [7, 4, 1, 1],
	medPanel: [8, 4, 1, 1],
	medPanelB: [9, 4, 1, 1],
	stoolWhite: [10, 4, 1, 1],
	cooler: [11, 4, 1, 1],
	bucket: [13, 4, 1, 1],
	cabinetGreyB: [14, 4, 1, 1],
	bench: [0, 5, 2, 1],
	counterLong: [2, 5, 3, 1],
	tableLong: [5, 5, 3, 1],
	deskDark: [8, 5, 3, 1],
	counterDark: [11, 5, 3, 1],
	roundTable: [15, 4, 1, 1],
	stoolRed: [14, 5, 1, 1],
	stoolBrown: [15, 5, 1, 1],
	chairDarkDown: [0, 6, 1, 1],
	chairDarkUp: [1, 6, 1, 1],
	sofaWhite: [2, 6, 2, 1],
	seatBack: [4, 6, 1, 1],
	bonsai: [5, 6, 1, 1],
	fenceIron: [6, 6, 1, 1],
	runner: [7, 6, 1, 1],
	stove: [8, 6, 2, 1],
	sink: [10, 6, 2, 1],
	cabNavy: [12, 6, 3, 1],
	cabWood: [0, 7, 3, 1],
	winBlue: [3, 7, 2, 2],
	flWhite: [15, 6, 1, 1],
	flBlue: [5, 7, 1, 1],
	flGrey: [6, 7, 1, 1],
	flRed: [7, 7, 1, 1],
	flCarpet: [8, 7, 1, 1],
	ramen: [9, 7, 1, 1],
	potFire: [10, 7, 1, 1],
	gyoza: [11, 7, 1, 1],
	yakitori: [12, 7, 1, 1],
	sakeSet: [13, 7, 1, 1],
	sakeBottle: [14, 7, 1, 1],
	condiments: [15, 7, 1, 1],
	yakisoba: [0, 8, 1, 1],
	beer: [1, 8, 1, 1],
	wine: [2, 8, 1, 1],
	ramune: [5, 8, 1, 1],
	ramuneTub: [6, 8, 1, 1],
	iceFlag: [7, 8, 1, 1],
	kakigoriMachine: [8, 8, 1, 1],
	winModern: [9, 8, 1, 1],
	mirror: [10, 8, 1, 1],
	standSign: [11, 8, 1, 1],
	sedan: [12, 8, 4, 2],
	wagon: [0, 9, 4, 2],
	bike: [4, 9, 2, 1],
	vend: [6, 9, 2, 2],
	jerrycan: [8, 9, 1, 1],
	kettle: [9, 9, 1, 1],
	bell: [10, 9, 1, 1],
	taiko: [11, 9, 1, 1],
	shutter: [4, 10, 2, 1],
	toolboxTop: [8, 10, 1, 1],
	pcTop: [9, 10, 1, 1],
	turntableTop: [10, 10, 1, 1],
	radioTop: [11, 10, 1, 1],
	podium: [12, 10, 1, 1],
	pole: [13, 10, 1, 2],
	goban: [14, 10, 1, 1],
	dumbbells: [15, 10, 1, 1],
	shogiban: [0, 11, 1, 1],
	laptop: [1, 11, 1, 1],
	kettleBase: [2, 11, 1, 1],
	phone: [3, 11, 1, 1],
	riceCooker: [4, 11, 1, 1],
	coffeeMaker: [5, 11, 1, 1],
	boothR: [6, 11, 1, 1],
	boothL: [7, 11, 1, 1],
	tableBeige: [8, 11, 1, 1],
	hamburg: [9, 11, 1, 1],
	omurice: [10, 11, 1, 1],
	glasses: [11, 11, 1, 1],
	cake: [12, 11, 1, 1],
	melonSoda: [14, 11, 1, 1],
	flWoodLight: [15, 11, 1, 1],
	stoveBlack: [0, 12, 2, 1],
	sink2: [2, 12, 2, 1],
	cabNavyB: [4, 12, 3, 1],
	cabRed: [7, 12, 3, 1],
	fridgeWhite: [10, 12, 1, 1],
	fridgeSilver: [11, 12, 1, 1],
	plateStack: [12, 12, 1, 1],
	shelfBottles: [13, 12, 2, 1],
	bookshelf: [0, 13, 2, 1],
	tvGame: [2, 13, 2, 1],
	stoolOrange: [15, 12, 1, 1],
	stoolSmall: [4, 13, 1, 1],
	chairRed: [5, 13, 1, 1],
	paperNote: [6, 13, 1, 1],
	fishTank: [7, 13, 3, 1],
	barrel: [10, 13, 1, 1],
	bottleCrate: [11, 13, 1, 1],
	flDarkWood: [12, 13, 1, 1],
	flBeige: [13, 13, 1, 1],
	flTatami: [14, 13, 1, 1],
	tanuki: [15, 13, 1, 1],
	kitsune: [0, 14, 1, 1],
	korokke: [1, 14, 1, 1],
	gyudon: [2, 14, 1, 1],
	motsu: [3, 14, 1, 1],
	beerMug: [4, 14, 1, 1],
	maguro: [5, 14, 1, 1],
	edamame: [6, 14, 1, 1],
	ebichili: [7, 14, 1, 1],
	mabo: [8, 14, 1, 1],
	chahan: [9, 14, 1, 1],
} as const;

export type RoomArtName = keyof typeof ROOM_CELLS;

/**
 * 物の col 列目を 下まで 1本（16 × 物の 高さ）。背の 高い 物（冷蔵ケース・ロッカー）は 下端そろえで
 * 上の マスへ はみ出して 描かれる（壁ぎわに 置くと 壁の 上段に 立つ）。
 */
export const ri = (name: RoomArtName, col = 0): string => {
	const [c, r, , h] = ROOM_CELLS[name];
	return `${ROOM_IMG}#${(c + col) * 16},${r * 16},16,${h * 16}`;
};

/** 物の (col, row) の 1マス（16x16）。幅の ある 物（台・車）は マスごとに 置く（となりへ はみ出さない）。 */
export const riCell = (name: RoomArtName, col: number, row: number): string => {
	const [c, r] = ROOM_CELLS[name];
	return `${ROOM_IMG}#${(c + col) * 16},${(r + row) * 16},16,16`;
};

/** 飲食店の 品（public/sprites/rpgen-food.png。256x32）。出てきた 一品の 絵（ui/eat.ts）。たこ焼きは 手描き。 */
export const FOOD_IMG = "pub:sprites/rpgen-food.png";
export const FOOD_SIZE = [256, 32] as const;

/** 品の 名前 → [列, 行, 幅, 高さ]（アトラスの マス）。 */
export const FOOD_CELLS = {
	takoyaki: [0, 0, 1, 1],
	ramune: [1, 0, 1, 1],
	kake: [2, 0, 1, 1],
	kitsune: [3, 0, 1, 1],
	tanuki: [4, 0, 1, 1],
	tsukimi: [5, 0, 1, 1],
	korokke: [6, 0, 1, 1],
	ramen: [7, 0, 1, 1],
	ramenRed: [8, 0, 1, 1],
	gyoza: [9, 0, 1, 1],
	gyudon: [10, 0, 1, 1],
	motsu: [11, 0, 1, 1],
	yakitori: [12, 0, 1, 1],
	edamame: [13, 0, 1, 1],
	fried: [14, 0, 1, 1],
	orange: [15, 0, 1, 1],
	saba: [0, 1, 1, 1],
	ikura: [1, 1, 1, 1],
	uni: [2, 1, 1, 1],
	maguro: [3, 1, 1, 1],
	mabo: [4, 1, 1, 1],
	chahan: [5, 1, 1, 1],
	ebichili: [6, 1, 1, 1],
	tenshin: [7, 1, 1, 1],
} as const;

export type FoodName = keyof typeof FOOD_CELLS;

/** 品の 絵（16x16）。 */
export const food = (name: FoodName): string => {
	const [c, r] = FOOD_CELLS[name];
	return `${FOOD_IMG}#${c * 16},${r * 16},16,16`;
};
