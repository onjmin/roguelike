// おんJマートの「今日の 入荷」（町の お金を 潜る 準備に つなぐ。2026-10-17 作者 了承）。
// 帰るたびに 1品だけ 入荷し、カウンターの 店員から 買える（買い物は 店員に 話して する）。買った 物は 倉庫へ
// （持ちこみは いつもの 決まり：段の CARRY_MAX・持ちこめない 板・倒れたら なくす に したがう）。
// 入荷は 食べものだけ：倉庫の 道具は 正体つきなので、薬草などを 売ると 識別の 手間ごと 省けて 強すぎる
// （提案の sim：きのこ板で 薬草を 持ちこむと クリアが 61.5% → 71.5%）。飢え死にを へらす 方に 効かせる。
// DOM も 保存も 使わない。

export type StockEntry = {
	kind: string;
	price: number;
	weight: number;
};

/** 入荷する 品（重みで 引く）。値段は 買い取りの 5倍ほど（core/town.ts の PRICE）。 */
export const DAILY_STOCK: readonly StockEntry[] = [
	{ kind: "f_bread", price: 120, weight: 2 },
	{ kind: "f_large", price: 300, weight: 1 },
];

/** n 回目の 帰りの 入荷（同じ 帰りは 同じ 品。乱数は 使わない）。 */
export const stockFor = (n: number): StockEntry => {
	const total = DAILY_STOCK.reduce((a, e) => a + e.weight, 0);
	let x = (Math.imul(n + 1, 2654435761) >>> 0) % total;
	for (const e of DAILY_STOCK) {
		if (x < e.weight) return e;
		x -= e.weight;
	}
	return DAILY_STOCK[0];
};

export const STOCK_MSG = {
	/** 店員の ひとこと（{item} 品の 名前・{price} 値段）。 */
	offer: "店員「今日の入荷は、{item}。\n{price}です。倉庫まで届けますよ」",
	bought: "{item}を買った。\n倉庫に届いた。",
	soldOut: "店員「今日の入荷は売り切れです。\nまた帰ってきたら、どうぞ」",
	full: "店員「倉庫がいっぱいみたいです。\nあけてから、どうぞ」",
	noStorage: "店員「倉庫がまだないみたいです」",
	menu: ["買う", "やめる"],
} as const;
