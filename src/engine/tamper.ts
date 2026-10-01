// セーブの 書きかえ（チート）を 見つける。書きかえは とめない（読みこんで そのまま 遊べる）。
// 見つけたら 覚えておき、仲間が がっかりする（ui/villageReturn.ts の tamperScript、ui/villageTalk.ts、ui/villageMobs.ts）。
// 書きかえた 中断セーブで もぐると、各階に 削除人が 1体 出る（RunState.cheat。core/floor.ts）。
//
// 見るのは「ゲームが 決して 作らない 値」だけ（HP が 最大HPより 多い など）。
// 版を 上げても まちがえて 見つけない ように：
// - 調整で かわる 数（経験値の 表・満腹度の 上限・倉庫の 広さ など）とは くらべない。
// - 上限は ゲームの 上限より ずっと 上（999 など）。前の 版の セーブに 無い 欄（undefined・null）は 見ない。

import type { Item, RunState } from "../core/types";

/** 整数で lo〜hi か（無い・null なら 見ない）。 */
const odd = (x: unknown, lo: number, hi: number): boolean =>
	x !== undefined &&
	x !== null &&
	!(typeof x === "number" && Number.isInteger(x) && x >= lo && x <= hi);

const oddItem = (it: Item): boolean =>
	odd(it.plus, -999, 999) ||
	odd(it.charges, -999, 999) ||
	odd(it.count, 0, 9999);

/** 中断セーブに ありえない 値が あるか。 */
export const oddRun = (s: RunState): boolean => {
	const p = s.player;
	if (
		odd(p.maxHp, 1, 9999) ||
		odd(p.hp, 0, 9999) ||
		odd(p.maxStr, 1, 999) ||
		odd(p.str, 0, 999) ||
		odd(p.lv, 1, 99) ||
		odd(p.exp, 0, 999999) ||
		odd(p.hunger, 0, 99999)
	)
		return true;
	// 回復は いつも 最大までで 止まり、最大が 下がる ときは いっしょに 下がる
	if (typeof p.hp === "number" && typeof p.maxHp === "number" && p.hp > p.maxHp)
		return true;
	if (
		typeof p.str === "number" &&
		typeof p.maxStr === "number" &&
		p.str > p.maxStr
	)
		return true;
	return p.items.some(oddItem);
};

/** 町の 保存に ありえない 値が あるか（読みこむ 前の 生の 中身で）。 */
export const oddTown = (o: {
	points?: unknown;
	stage?: unknown;
	storage?: unknown;
	bag?: unknown;
}): boolean =>
	odd(o.points, 0, Number.MAX_SAFE_INTEGER) ||
	odd(o.stage, 0, 99) ||
	[o.storage, o.bag].some(
		(a) => Array.isArray(a) && a.some((it) => it && oddItem(it as Item)),
	);

// ───────────────── 見つけた ことを 覚える ─────────────────

const KEY = "kiriko-roguelike/tamper";

export type TamperMemo = {
	/** 見つけた 回数（同じ 書きかえは 1回と 数える）。 */
	n: number;
	/** 数えた 書きかえ（中断セーブは シード、町は 中身）。新しい 20こ まで。 */
	ids: string[];
	/** 村で まだ 見せていない（帰ってきたら 仲間が 気づく 場面）。 */
	news: boolean;
	/** さいごに 見つけた ときの もぐった 回数（そこから しばらく 仲間が がっかり している）。 */
	runs: number;
};

/** がっかりが つづく 帰りの 数（見つけてから この回数 もぐり おえるまで）。 */
export const LINGER = 3;

const empty = (): TamperMemo => ({ n: 0, ids: [], news: false, runs: 0 });

/** 保存できない ときの この回の 写し。 */
let memo: TamperMemo | null = null;

export const loadTamper = (): TamperMemo => {
	let raw: unknown;
	try {
		raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
	} catch {
		// 読めない（プライベートモード等）ときは この回の 写し
		return memo ? { ...memo, ids: [...memo.ids] } : empty();
	}
	if (!raw || typeof raw !== "object") return empty();
	const o = raw as Partial<TamperMemo>;
	return {
		n: typeof o.n === "number" ? o.n : 0,
		ids: Array.isArray(o.ids)
			? o.ids.filter((x): x is string => typeof x === "string")
			: [],
		news: o.news === true,
		runs: typeof o.runs === "number" ? o.runs : 0,
	};
};

const saveTamper = (t: TamperMemo): void => {
	memo = { ...t, ids: [...t.ids] };
	try {
		localStorage.setItem(KEY, JSON.stringify(t));
	} catch {
		// 保存できなくても この回は 写しで
	}
};

/** 試験用：この回の 写しを 忘れる。 */
export const forgetTamperMemo = (): void => {
	memo = null;
};

/** 書きかえを 見つけた（id が 前と 同じなら 数えない）。runs は いまの もぐった 回数。 */
export const noteTamper = (id: string, runs: number): void => {
	const t = loadTamper();
	if (t.ids.includes(id)) return;
	t.n++;
	t.ids = [...t.ids, id].slice(-20);
	t.news = true;
	t.runs = runs;
	saveTamper(t);
};

/** 村で 気づく 場面を 見せた。 */
export const doneTamperNews = (): void => {
	const t = loadTamper();
	if (!t.news) return;
	t.news = false;
	saveTamper(t);
};

/** いま 仲間が がっかり しているか（見つけた 回数。していなければ 0）。runs は いまの もぐった 回数。 */
export const disappointed = (runs: number): number => {
	const t = loadTamper();
	return t.n > 0 && (t.news || runs < t.runs + LINGER) ? t.n : 0;
};
