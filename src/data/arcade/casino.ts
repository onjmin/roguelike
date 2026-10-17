// カジノ「ガチャ」の チップの 値段と 窓の 文（2026-10-14 作者：「「お金を 賭けない」という 方針は 撤廃して 良い」）。
// 2026-10-15 作者：「ポケモン・ドラクエの カジノみたいに、換金所が 設定され、そこで 一元的に 換金の やり取りが
// できると わかりやすい。ゲームを やる 場所で やる ものじゃない」→ 円と チップの やり取りは 入口の 換金所だけ。
// - 換金所（部屋の 窓口 "cashier"）：財布（engine/wallet.ts）の お金で チップを 買う・チップを 円に もどす。
//   どちらも 1枚 100円。持って いる チップは チップ入れ（engine/chips.ts）に 残る。
// - 台：持って いる チップから 何枚 出すかを えらんで 遊び、のこった 分は チップ入れに もどる（ui/arcade/casinoChips.ts）。
// - パチンコも チップで 座る（1枚 ＝ 玉 25発 ＝ 100円。前の 1発 4円と 同じ 値うち）。立つと 玉を 25発ごとに
//   チップに もどし、はんぱの 玉は チップ入れに あずかって 次に 座ると 足す（なにも 消えない）。
// 窓は 22字×2行、ボタンは 9字まで（src/sim/arcadeTests.ts が 測る）。
// 置き字：{n} 枚数、{price} 円、{have} 財布、{chips} チップ入れの 枚数、{b} 玉、{r} はんぱの 玉、{diff} 増減。

import { ARCADE_HOME, type ArcadeGame } from "./types";

/** チップ 1枚の 円。 */
export const CHIP_YEN = 100;
/** チップ 1枚の 玉（パチンコ）。玉 1発 4円。 */
export const BALLS_PER_CHIP = 25;

/** 換金所の 窓。 */
export const CASHIER = {
	/** 窓口を 調べると 毎回（いまの 枚数と 財布）。 */
	status: "「いらっしゃいませ」\nチップ　{chips}枚・財布　{have}",
	menu: ["チップを買う", "換金する", "やめる"],
	buyins: [10, 50, 100, 500],
	buyAsk: "何枚お買い求めですか？\n（1枚100円。財布　{have}）",
	option: "{n}枚　{price}",
	short: "お金がたりない。\n（10枚　{price}から。財布　{have}）",
	bought: "チップを{n}枚買った。（−{price}）\nチップ　{chips}枚",
	cashAsk: "何枚換金しますか？\n（チップ　{chips}枚。1枚100円）",
	cashOuts: [10, 50, 100, 500],
	cashOption: "{n}枚",
	all: "全部　{n}枚",
	cashed: "チップ　{n}枚を換金した。\n+{price}のこり　{chips}枚",
	noChips: "「チップをお持ちではないようです」",
} as const;

/** 台の 窓（チップを 出す・もどる）。 */
export const CASINO_TABLE = {
	/** チップが 1枚も ない。 */
	none: "チップを持っていない。\n入口の換金所で買える。",
	ask: "チップを何枚出す？\n（チップ　{chips}枚）",
	ballAsk: "チップを何枚玉にかえる？\n（1枚＝玉25発。チップ　{chips}枚）",
	/** 出す 枚数の えらび（持って いる 分より 少ない ものだけ。さいごに 全部）。 */
	bring: [10, 30, 100],
	option: "{n}枚",
	all: "全部　{n}枚",
	balls: "チップ　{n}枚を玉　{b}発にかえた。",
	ballsKept:
		"チップ　{n}枚を玉　{b}発にかえた。\n（あずけていた玉　{r}発も足した）",
	back: "チップ　{n}枚がもどった。\nチップ　{chips}枚（{diff}）",
	lost: "チップは1枚ものこらなかった。\nチップ　{chips}枚（{diff}）",
	ballBack: "玉　{b}発をチップ　{n}枚にかえた。\nチップ　{chips}枚（{diff}）",
	keep: "はんぱの玉　{r}発はあずかった。\n次に座ると足される。",
	/** おわった あとの「もう一回」（同じ 枚数を また 出す。ui/arcade/arcade.ts）。 */
	again: "もう一回　{n}枚",
} as const;

/** 増減の 書き方（+12枚・−3枚・±0）。 */
export const chipDiff = (d: number): string =>
	d > 0 ? `+${d}枚` : d < 0 ? `−${-d}枚` : "±0";

/** カジノの 台か（チップを 出して 遊ぶ）。 */
export const isCasinoGame = (g: ArcadeGame): boolean =>
	ARCADE_HOME[g] === "casino";

/** 玉で 遊ぶ 台か（パチンコだけ）。 */
export const usesBalls = (g: ArcadeGame): boolean => g === "pachinko";
