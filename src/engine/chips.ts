// カジノ「ガチャ」の チップ入れ（2026-10-15 作者：「ポケモン・ドラクエの カジノみたいに、換金所が 設定され、
// そこで 一元的に 換金の やり取りが できると わかりやすい。ゲームを やる 場所で やる ものじゃない」）。
//
// - 持って いる チップの 枚数を ここに 残す（kiriko-roguelike/chips）。財布（engine/wallet.ts）とは 別。
// - 円と チップの やり取りは 入口の 換金所だけ（ui/arcade/casinoChips.ts の cashierScript）。台では チップを 出して、
//   のこった 分が ここに もどる。
// - balls は パチンコの はんぱの 玉（チップ 1枚 ＝ 玉 25発に 足りない 分。次に パチンコに 座ると 足す）。

const KEY = "kiriko-roguelike/chips";

type ChipMemo = { v: 1; chips: number; balls: number };

let memo: ChipMemo | null = null;

const nat = (v: unknown): number =>
	typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

const load = (): ChipMemo => {
	if (memo) return { ...memo };
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as {
			v?: unknown;
			chips?: unknown;
			balls?: unknown;
		} | null;
		if (raw && raw.v === 1)
			return { v: 1, chips: nat(raw.chips), balls: nat(raw.balls) };
	} catch {
		// 読めなければ 0枚
	}
	return { v: 1, chips: 0, balls: 0 };
};

const save = (m: ChipMemo, noSave: boolean): void => {
	memo = { ...m };
	if (noSave) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(m));
	} catch {
		// 保存できなくても この 回は 覚えている
	}
};

/** 持って いる チップの 枚数。 */
export const chipsOwned = (): number => load().chips;

/** パチンコの はんぱの 玉（25発 未満）。 */
export const ballsKept = (): number => load().balls;

/** チップを 足す（換金所で 買った・台から もどった）。noSave は 下見（この 回だけ 覚える）。 */
export const addChips = (n: number, noSave = false): void => {
	const k = nat(n);
	if (!k) return;
	const m = load();
	m.chips += k;
	save(m, noSave);
};

/** チップを 出す（足りなければ 何も せず false）。noSave は 下見。 */
export const takeChips = (n: number, noSave = false): boolean => {
	const k = nat(n);
	if (k === 0) return true;
	const m = load();
	if (m.chips < k) return false;
	m.chips -= k;
	save(m, noSave);
	return true;
};

/** はんぱの 玉を 置きかえる（パチンコ）。noSave は 下見。 */
export const keepBalls = (n: number, noSave = false): void => {
	const m = load();
	m.balls = nat(n);
	save(m, noSave);
};

/** 試験用：覚えている 写しを 捨てる。 */
export const forgetChipMemo = (): void => {
	memo = null;
};
