// ネタスレの 遊びの 絵（scripts/make-neta.mjs が 作る public/sprites/neta.png・neta_kabe.png）。
// 部屋の 物は facilities.ts の 部屋の 絵（k.on）に、ベンチの 札は グラウンドの 外観の 字に、板の 絵は ui/neta*.ts で
// 使う。ゲームは CDN を 見ない。

export const NETA_IMG = "pub:sprites/neta.png";
export const NETA_SIZE = [64, 64] as const;

/** neta.png の どこに 何が あるか（x, y, w, h）。 */
export const NETA_CELLS = {
	/** リバーシ盤（碁会所の 部屋の 物。16x16） */
	othello: [0, 0, 16, 16],
	/** コンマの 台（ゲームセンターの 部屋の 物。16x32＝上の マスへ はみ出す） */
	comma: [16, 0, 16, 32],
	/** 腹筋台（ageジムの 部屋の 物） */
	fukkin: [32, 0, 16, 16],
	/** 文机（保守道場の 部屋の 物） */
	desk: [48, 0, 16, 16],
	/** 「!random」の 札（グラウンドの 三塁側の ベンチの 絵に 重ねる） */
	fuda: [0, 16, 16, 16],
	/** サイコロ（!sk 習字の 板） */
	dice: [32, 16, 16, 16],
	/** 筆（!sk 習字の 板） */
	brush: [48, 16, 16, 16],
	/** 腹筋の 子（ID腹筋の 板。寝た／起きた 24x24） */
	koDown: [0, 32, 24, 24],
	koUp: [24, 32, 24, 24],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type NetaCell = keyof typeof NETA_CELLS;

/** 絵の 参照（pub:sprites/neta.png#x,y,w,h）。 */
export const netaArt = (k: NetaCell): string =>
	`${NETA_IMG}#${NETA_CELLS[k].join(",")}`;

/** グラウンドの 5割の壁の 歩行グラ（32x128＝16x32 が 2コマ×4方向。行は 後・右・前・左）。 */
export const NETA_KABE_WALK = "pub:sprites/neta_kabe.png";
export const NETA_KABE_SIZE = [32, 128] as const;
