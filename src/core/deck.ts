// 山札（1回の冒険で出る道具の、中身の決まった束）。
//
// - 中身（何が何枚）は公開。並びは冒険ごとに切る。
// - 種類ごとに上・中・下の3つの層へ均等に分けてから、層ごとに切って各階へ配る
//   （同じ種類が浅い階にかたまったり、深い階にしか無かったりしにくい）。
// - 札は増えない：モンスターの落とし物も、その階に配られた札の一部。

import type { Rng } from "./rng";

export type DeckEntry = { kind: string; count: number };

/** 層の区切り（その層の最後の階）。 */
export const bandsFor = (floors: number): number[] => {
	const a = Math.round(floors / 3);
	const b = Math.round((floors * 2) / 3);
	return [a, b, floors];
};

/**
 * 山札を階ごとに配る。戻り値の [d] が d 階（1 始まり。[0] は空）に配る種類の並び。
 */
export const dealDeck = (
	rng: Rng,
	deck: readonly DeckEntry[],
	floors: number,
): string[][] => {
	const bands = bandsFor(floors);
	const bandCards: string[][] = bands.map(() => []);
	for (const e of deck) {
		const base = Math.floor(e.count / bands.length);
		const counts = bands.map(() => base);
		// 余りは、ちがう層にばらけるように配る
		const order = rng.shuffle(bands.map((_, i) => i));
		for (let r = 0; r < e.count - base * bands.length; r++)
			counts[order[r % order.length]]++;
		counts.forEach((c, bi) => {
			for (let i = 0; i < c; i++) bandCards[bi].push(e.kind);
		});
	}
	const out: string[][] = [[]];
	let first = 1;
	bands.forEach((last, bi) => {
		const cards = rng.shuffle(bandCards[bi]);
		const n = last - first + 1;
		const base = Math.floor(cards.length / n);
		const per = Array.from({ length: n }, () => base);
		const extra = rng.shuffle([...Array(n).keys()]);
		for (let r = 0; r < cards.length - base * n; r++) per[extra[r % n]]++;
		let k = 0;
		for (let i = 0; i < n; i++) {
			out.push(cards.slice(k, k + per[i]));
			k += per[i];
		}
		first = last + 1;
	});
	return out;
};

export const deckSize = (deck: readonly DeckEntry[]): number =>
	deck.reduce((a, e) => a + e.count, 0);
