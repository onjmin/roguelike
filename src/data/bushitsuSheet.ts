// scripts/make-bushitsu.mjs が 書き出す（手で 書きかえない）。部室棟の 絵（public/sprites/bushitsu.png）の 場所。
export const BS_IMG = "pub:sprites/bushitsu.png";
export const BS_SIZE = [256, 80] as const;
/** 絵の 名前 → [x, y, w, h]（画素）。 */
export const BS_CELLS = {
	bbTL: [0, 0, 16, 16],
	bbTM: [16, 0, 16, 16],
	bbTR: [32, 0, 16, 16],
	bbBL: [48, 0, 16, 16],
	bbBM: [64, 0, 16, 16],
	bbBR: [80, 0, 16, 16],
	painting: [96, 0, 16, 16],
	palette: [112, 0, 16, 16],
	mixer: [128, 0, 16, 16],
	mic: [144, 0, 16, 16],
	boombox: [160, 0, 16, 16],
	glass: [176, 0, 16, 16],
	pcTL: [192, 0, 16, 16],
	pcTR: [208, 0, 16, 16],
	pcBL: [224, 0, 16, 16],
	pcBR: [240, 0, 16, 16],
	sink: [0, 16, 16, 16],
	lampOff: [16, 16, 16, 16],
	lampOn: [32, 16, 16, 16],
	eta: [48, 16, 16, 16],
	synth: [64, 16, 16, 16],
	speaker: [80, 16, 16, 16],
	fumendai: [96, 16, 16, 16],
	getaL: [112, 16, 16, 16],
	getaR: [128, 16, 16, 16],
	paint: [144, 16, 16, 16],
	graffiti: [160, 16, 16, 16],
	posterOut: [176, 16, 16, 16],
	roster: [192, 16, 32, 16],
	plateJinro: [0, 32, 16, 16],
	plateOekaki: [16, 32, 16, 16],
	plateHoso: [32, 32, 16, 16],
	plateVoca: [48, 32, 16, 16],
	plateGame: [64, 32, 16, 16],
	nanashi0: [80, 32, 16, 16],
	nanashi1: [96, 32, 16, 16],
	nanashi2: [112, 32, 16, 16],
	nanashi3: [128, 32, 16, 16],
	nanashi4: [144, 32, 16, 16],
	kirikoBack: [160, 32, 16, 16],
	gassho0: [176, 32, 16, 16],
	gassho1: [192, 32, 16, 16],
	gassho2: [208, 32, 16, 16],
	bucho: [224, 32, 16, 16],
	easel: [0, 48, 16, 32],
	kouka: [16, 48, 16, 32],
	cabinet: [32, 48, 16, 32],
	kosatsu: [48, 48, 16, 32],
} as const;
export type BsName = keyof typeof BS_CELLS;
/** 絵の 参照（pub:…#x,y,w,h。縦長は 下端そろえで 上の マスへ はみ出す）。 */
export const bs = (name: BsName): string =>
	`${BS_IMG}#${BS_CELLS[name].join(",")}`;
/** 幅の ある 絵の (col, row) の 1マス（16x16。ボカロ一覧の 額など）。 */
export const bsCell = (name: BsName, col: number, row = 0): string => {
	const [x, y] = BS_CELLS[name];
	return `${BS_IMG}#${x + col * 16},${y + row * 16},16,16`;
};
