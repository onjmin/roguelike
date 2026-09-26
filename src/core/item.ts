// 道具を作る・名前を出す・識別の状態を見る。

import { dungeonById } from "./data/dungeons";
import { ITEMS } from "./data/items";
import type { DeckEntry } from "./deck";
import type { Rng } from "./rng";
import {
	type Item,
	type ItemDef,
	type RunState,
	UNIDENTIFIED_CATS,
} from "./types";

export const defOf = (kind: string): ItemDef => {
	const d = ITEMS[kind];
	if (!d) throw new Error(`unknown item kind: ${kind}`);
	return d;
};

/** 未識別になりうる種類か（めずらしい道具は はじめから わかる）。 */
export const isUnidentifiedCat = (kind: string): boolean => {
	const d = defOf(kind);
	return UNIDENTIFIED_CATS.includes(d.cat) && !d.rare;
};

/**
 * この冒険の山札。冒険を作ったあとで 山札に足された 未識別の種類（仮の名前が無い）は、
 * 配られていないので のぞく（前の版の中断セーブで、帰還スレが 候補や 釣りに出ないように）。
 */
export const deckOf = (s: RunState): readonly DeckEntry[] =>
	dungeonById(s.dungeon).deck.filter(
		(e) =>
			!UNIDENTIFIED_CATS.includes(defOf(e.kind).cat) || e.kind in s.ids.fake,
	);

/** 種類の正体がわかっているか。 */
export const isKnownKind = (s: RunState, kind: string): boolean =>
	!isUnidentifiedCat(kind) || !!s.ids.known[kind];

/**
 * 新しい道具（修正値・呪い・回数・本数はここで決める）。
 * curses が false なら のろわれた道具は出ない（乱数の引き方は同じ。−1 は +0 に、のろいの指輪は ふつうに）。
 */
export const rollItem = (
	rng: Rng,
	uid: number,
	kind: string,
	opt: { curses: boolean } = { curses: true },
): Item => {
	const d = defOf(kind);
	const it: Item = {
		uid,
		kind,
		plus: 0,
		cursed: false,
		charges: 0,
		known: false,
		count: 1,
	};
	if (d.cat === "weapon" || d.cat === "shield") {
		// +0 が 11/16、+1 が 1/8、+2 と +3 が 1/16、−1（のろい）が 1/16
		const r = rng.int(16);
		if (r < 11) it.plus = 0;
		else if (r < 13) it.plus = 1;
		else if (r < 14) it.plus = 2;
		else if (r < 15) it.plus = 3;
		else if (opt.curses) {
			it.plus = -1;
			it.cursed = true;
		}
	} else if (d.cat === "ring") {
		// 指輪の 1/4 はのろわれている。剛力の指輪は のろいなら −3
		it.cursed = rng.chance(1 / 4) && opt.curses;
		if (kind === "r_might") it.plus = it.cursed ? -3 : 3;
	} else if (d.cat === "staff") {
		const [lo, hi] = d.charges ?? [3, 5];
		it.charges = rng.range(lo, hi);
	} else if (d.cat === "arrow") {
		it.count = kind === "a_iron" ? rng.range(5, 15) : rng.range(10, 20);
		it.known = true;
	} else {
		it.known = true;
	}
	return it;
};

/** 種類の呼び名（未識別なら仮の名前か、つけた名前）。 */
export const kindName = (s: RunState, kind: string): string => {
	const d = defOf(kind);
	if (isKnownKind(s, kind)) return d.name;
	const named = s.ids.named[kind];
	if (named) return `${named}？`;
	return s.ids.fake[kind] ?? d.name;
};

const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `${n}` : "");

/** 道具の呼び名（修正値・回数・本数つき）。 */
export const itemName = (s: RunState, it: Item): string => {
	const d = defOf(it.kind);
	let name = kindName(s, it.kind);
	if ((d.cat === "weapon" || d.cat === "shield") && it.known)
		name += signed(it.plus);
	if (it.kind === "r_might" && it.known && isKnownKind(s, it.kind))
		name += signed(it.plus);
	if (d.cat === "staff" && it.known && isKnownKind(s, it.kind))
		name += `［${it.charges}］`;
	if (d.cat === "arrow") name += ` ${it.count}本`;
	return name;
};

/** 種類を識別する（同じ種類はぜんぶ正体がわかる）。 */
export const identifyKind = (s: RunState, kind: string): boolean => {
	if (!isUnidentifiedCat(kind) || s.ids.known[kind]) return false;
	s.ids.known[kind] = true;
	delete s.ids.named[kind];
	return true;
};

/** 投げたり置いたりできない（目的の品）。 */
export const isKeyItem = (kind: string): boolean => defOf(kind).cat === "goal";
