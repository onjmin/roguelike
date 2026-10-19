// リサイクルショップの セール品（data/village/furnSale.ts）。ダンジョンから 帰って はじめて 店に 来た ときに
// まだ 持って いない 家具から 選び、次に 帰るまで 同じ 品・同じ 割引。買った 品は 抜けるだけ（補充しない）。
// 保存は kiriko-roguelike/furnsale だけ（段の 下見の あいだは 書かない）。

import { type FurnSaleItem, pickSale } from "../../data/village/furnSale";
import { loadRecords } from "../../engine/save";

const KEY = "kiriko-roguelike/furnsale";

type SaleMemo = { at: number; items: FurnSaleItem[] };

let memo: SaleMemo | null = null;

const load = (): SaleMemo | null => {
	if (memo) return memo;
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as SaleMemo;
		if (
			raw &&
			typeof raw.at === "number" &&
			Array.isArray(raw.items) &&
			raw.items.every(
				(x) => x && typeof x.id === "string" && typeof x.off === "number",
			)
		)
			return raw;
	} catch {
		// 読めなければ 選びなおす
	}
	return null;
};

/** 試験用：覚えている 写しを 捨てる。 */
export const forgetFurnSale = (): void => {
	memo = null;
};

/**
 * いまの セール品（売る 品 ids の うち、持って いない 物）。前の 帰りの ままなら 選びなおす。
 * noSave なら この回だけ 覚える。
 */
export const currentSale = <T extends string>(
	ids: readonly T[],
	owned: (id: T) => boolean,
	noSave: boolean,
): FurnSaleItem<T>[] => {
	const at = loadRecords()[0]?.at ?? -1;
	let m = load();
	if (!m || m.at !== at) {
		m = {
			at,
			items: pickSale(
				at,
				ids.filter((id) => !owned(id)),
			),
		};
		memo = m;
		if (!noSave) {
			try {
				localStorage.setItem(KEY, JSON.stringify(m));
			} catch {
				// 保存できなくても この回は memo で 覚えている
			}
		}
	}
	memo = m;
	return (m.items as FurnSaleItem<T>[]).filter(
		(it) => ids.includes(it.id) && !owned(it.id),
	);
};
