// 床に落ちている道具の見た目（種類ごとではなく、カテゴリごとに1つ。見た目で正体はわからない）。

import { defOf } from "../core/item";
import type { ItemCat } from "../core/types";

const BASE = "pub:assets/rpg-reze/Base.png";
const cut = (c: number, r: number): string =>
	`${BASE}#${c * 16},${r * 16},16,16`;

export const CAT_ICON: Record<ItemCat, string> = {
	weapon: cut(6, 352),
	shield: cut(7, 146),
	ring: cut(4, 571),
	herb: cut(0, 140),
	scroll: cut(0, 139),
	staff: cut(7, 144),
	arrow: cut(2, 143),
	food: cut(6, 139),
	goal: "pub:sprites/phono.png#0,0,16,16",
};

export const itemIcon = (kind: string): string => CAT_ICON[defOf(kind).cat];

/** 階段（下り・上り）。上りは下りの絵を上下に反転して描く代わりに、同じ絵を使う。 */
export const STAIRS_UP_TINT = "rgba(120, 200, 255, 0.35)";
