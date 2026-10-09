// キリコの ID（おーぷんの 4文字の ID。帰りごとに 1つ＝おーぷんの「日ごとに かわる ID」）と ID腹筋の 回数。
// 同じ 帰り（記録の 時刻 at）なら いつも 同じ ID。見た目だけの 数で、冒険の 乱数には さわらない。
// ダンジョンの 巻物「腹筋スレ」（core/data/items.ts の s_whet。「IDの 数字が 小さいことを いのる」）と 同じ 決まり：
// ID の 数字を 左から ならべた 数が 回数（足し算では ない）、数字が なければ 休み。

export const ID_CHARS =
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** 32bit FNV-1a。 */
export const fnv1a = (s: string): number => {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h >>> 0;
};

/** 32bit を よく まぜる。 */
export const mix32 = (x: number): number => {
	let h = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
	h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
	return (h ^ (h >>> 16)) >>> 0;
};

/** この 回数 から 上は、トレーナーが「……そっ閉じ定期や」。 */
export const FUKKIN_SOTTOJI = 1000;

/** 回数に しない 数（淫夢の 数）と、ID に しない 字の 並び。出たら 塩を かえて 引きなおす。 */
export const DENY_REPS: ReadonlySet<number> = new Set([
	114, 364, 514, 810, 931, 1145, 1919, 4514, 4545,
]);
export const DENY_WORD =
	/fuck|shit|sex|cock|dick|cunt|nig|porn|anal|rape|fag|kkk|unko|unti|kuso|sine/i;

/** ID の 数字を 左から ならべた 数（数字が なければ null＝今日は 休み）。"3y9n" → 39、"a0bc" → 0。 */
export const fukkinReps = (id: string): number | null => {
	const d = id.replace(/\D/g, "");
	return d === "" ? null : Number(d);
};

const idTry = (at: number, salt: number): string => {
	let h = fnv1a(`kiriko:${at}:${salt}`);
	let s = "";
	for (let i = 0; i < 4; i++) {
		h = mix32(h + i);
		s += ID_CHARS[h % ID_CHARS.length];
	}
	return s;
};

/** その 帰り（at）の キリコの ID（4文字）。 */
export const kirikoId = (at: number): string => {
	for (let salt = 0; salt < 64; salt++) {
		const s = idTry(at, salt);
		const n = fukkinReps(s);
		if ((n !== null && DENY_REPS.has(n)) || DENY_WORD.test(s)) continue;
		return s;
	}
	return "ROMm";
};

/** 板の 書きこみの 名前（コンマで ゾロ目を 出したら ▲第一当選者）。 */
export const kirikoName = (title: boolean): string =>
	title ? "蓄音キリコ▲第一当選者" : "蓄音キリコ";
