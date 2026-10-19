// リサイクルショップの セール品（ui/village/furnSale.ts）：ダンジョンから 帰るたびに 特選品を 選びなおし、何割か 引く。

import { Rng } from "../../core/rng";

/** 特選品の 数。 */
export const FURN_SALE_COUNT = 4;
/** 割引（%）。1品ごとに この中から 選ぶ。 */
export const FURN_SALE_OFF: readonly number[] = [20, 30, 30, 40, 50];

/** 店の 字（店主の 口調は data/village/myhome.ts の HOME_MSG.shop と そろえる）。 */
export const FURN_SALE_MSG = {
	/** 一覧の 札。 */
	tab: "セール",
	/** セール品が あるとき、あいさつの あと（{name} は いちばん 引いて いる 品・{off} は その 割引）。 */
	hello: "「いまは特選品のセールや。\n{name}なんか{off}引きやで」",
	/** 一覧の 行の 説明（{off}）。 */
	row: "特選　{off}引き",
};

export type FurnSaleItem<T extends string = string> = { id: T; off: number };

/** 割り引いた 値段（100円 未満は 切り捨て）。 */
export const salePrice = (price: number, off: number): number =>
	Math.floor((price * (100 - off)) / 10000) * 100;

/** 割引の 呼び方（30 → 「3割」・25 → 「25%」）。 */
export const offLabel = (off: number): string =>
	off % 10 === 0 ? `${off / 10}割` : `${off}%`;

/** seed（帰りの 時刻）から 特選品を 選ぶ（同じ seed なら 同じ 品・同じ 割引）。 */
export const pickSale = <T extends string>(
	seed: number | string,
	ids: readonly T[],
): FurnSaleItem<T>[] => {
	const rng = Rng.fromSeed(`furnsale:${seed}`);
	const pool = [...ids];
	const out: FurnSaleItem<T>[] = [];
	while (pool.length && out.length < FURN_SALE_COUNT) {
		const id = pool.splice(Math.floor(rng.float() * pool.length), 1)[0];
		const off = FURN_SALE_OFF[Math.floor(rng.float() * FURN_SALE_OFF.length)];
		out.push({ id, off });
	}
	return out;
};
