// カジノ「ガチャ」の チップ・玉の 値段と 窓の 文（2026-10-14 作者：「「お金を 賭けない」という 方針は 撤廃して 良い」）。
// 前は 店が 貸す 遊びの チップ（お金は 賭けない）だった。いまは 財布（engine/wallet.ts）の お金で 買い、
// 席を 立つと 手もとの 枚数を 同じ 値段で 換金する（ui/arcade/casinoChips.ts）。
// - チップ 1枚 100円（スロット・ハイ＆ロー・ルーレット・ポーカー・ブラックジャック・バカラ）。
// - パチンコの 玉 1発 4円（ほんものの 4円パチンコと 同じ）。
// 買う 額は 3つから（いちばん 安いのは どれも 1,000円）。窓は 22字×2行、ボタンは 9字まで（src/sim/arcadeTests.ts が 測る）。
// 置き字：{n} 枚数、{price} 円、{have} 手もと。

import { ARCADE_HOME, type ArcadeGame } from "./types";

export type CasinoKind = "chip" | "ball";

export type CasinoMoney = {
	/** 1枚（1発）の 円。 */
	rate: number;
	/** 買える 枚数（安い 順）。 */
	buyins: readonly number[];
	/** 品書きの「〜を　買う」。 */
	buy: string;
	/** 買う 前の 窓（値段と 手もと）。 */
	ask: string;
	/** 買う 項目。 */
	option: string;
	/** どれも 買えない。 */
	short: string;
	bought: string;
	cashed: string;
	/** 手もとに 1枚も ない。 */
	none: string;
	/** おわった あとの「もう一回」（同じ 枚数を また 買う。ui/arcade/arcade.ts）。 */
	again: string;
};

export const CASINO: Record<CasinoKind, CasinoMoney> = {
	chip: {
		rate: 100,
		buyins: [10, 30, 100],
		buy: "チップを　買う",
		ask: "チップは　1枚　100円。\n（手もと　{have}）",
		option: "{n}枚　{price}",
		short: "お金が　たりない。\n（10枚　{price}から。手もと　{have}）",
		bought: "チップを　{n}枚　買った。（−{price}）",
		cashed: "チップ　{n}枚を　換金した。（+{price}）",
		none: "チップは　1枚も　のこらなかった。",
		again: "もう一回　{n}枚",
	},
	ball: {
		rate: 4,
		buyins: [250, 500, 1250],
		buy: "玉を　買う",
		ask: "玉は　1発　4円。\n（手もと　{have}）",
		option: "{n}発　{price}",
		short: "お金が　たりない。\n（250発　{price}から。手もと　{have}）",
		bought: "玉を　{n}発　買った。（−{price}）",
		cashed: "玉　{n}発を　換金した。（+{price}）",
		none: "玉は　1発も　のこらなかった。",
		again: "もう一回　{n}発",
	},
};

/** 差し引き（買った 額と 換金した 額の ちがい）。2行目に つなぐ。 */
export const CASINO_NET = {
	win: "差し引き　{price}の　勝ち。",
	lose: "差し引き　{price}の　負け。",
	even: "差し引き　とんとん。",
} as const;

/** カジノの 台か（チップを 買って 遊ぶ）。 */
export const isCasinoGame = (g: ArcadeGame): boolean =>
	ARCADE_HOME[g] === "casino";

/** チップか 玉か（パチンコだけ 玉）。 */
export const casinoKind = (g: ArcadeGame): CasinoKind =>
	g === "pachinko" ? "ball" : "chip";
