// キリコの 財布（2026-10-13 作者：「稼いだ 金で 何か 買えるように。町の 発展・住民の 引っ越しは 累計の 売り上げで」）。
//
// - 町の 売り上げ（Town.points）は 累計の まま（町の 段・越してくる 住人は これで 決まる。使っても へらない）。
// - 使える お金 ＝ 累計の 売り上げ − 使った 額。使った 額だけ ここに 残す（kiriko-roguelike/wallet）。
// - 使い道は ローグライクの 本編に 関係ない 物だけ（キリコの 家の 頭金と 返済・家具）。強さには 何も 効かない。
// - カジノの 換金（earnYen）は 使った 額を へらす（2026-10-14 作者：「お金を 賭けない 方針は 撤廃」）。
//   勝てば 使った 額は マイナスに なる（売り上げより 多く 持てる）。町の 段・住人は 売り上げの まま。

import { loadTown } from "./save";

const KEY = "kiriko-roguelike/wallet";

type WalletMemo = { v: 1; spent: number };

let memo: WalletMemo | null = null;

const load = (): WalletMemo => {
	if (memo) return { ...memo };
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as {
			v?: unknown;
			spent?: unknown;
		} | null;
		if (
			raw &&
			raw.v === 1 &&
			typeof raw.spent === "number" &&
			Number.isFinite(raw.spent)
		)
			return { v: 1, spent: Math.floor(raw.spent) };
	} catch {
		// 読めなければ 使って いない ことに
	}
	return { v: 1, spent: 0 };
};

/** 使える お金（円）。 */
export const walletYen = (): number =>
	Math.max(0, loadTown().points - load().spent);

/** 払う（足りなければ 何も せず false）。noSave は 下見（この 回だけ 覚える）。 */
export const spendYen = (yen: number, noSave = false): boolean => {
	if (yen <= 0) return true;
	if (walletYen() < yen) return false;
	const m = load();
	m.spent += yen;
	memo = { ...m };
	if (!noSave)
		try {
			localStorage.setItem(KEY, JSON.stringify(m));
		} catch {
			// 保存できなくても この 回は 覚えている
		}
	return true;
};

/** もらう（カジノの 換金。使った 額を へらす。マイナスも あり）。noSave は 下見。 */
export const earnYen = (yen: number, noSave = false): void => {
	if (!(yen > 0) || !Number.isFinite(yen)) return;
	const m = load();
	m.spent -= Math.floor(yen);
	memo = { ...m };
	if (!noSave)
		try {
			localStorage.setItem(KEY, JSON.stringify(m));
		} catch {
			// 保存できなくても この 回は 覚えている
		}
};

/** 試験用：覚えている 写しを 捨てる。 */
export const forgetWalletMemo = (): void => {
	memo = null;
};

/** 円の 書き方（3けたごとに 区切る）。 */
export const yen = (n: number): string => `${n.toLocaleString("ja-JP")}円`;
