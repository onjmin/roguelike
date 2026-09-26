// 床に落ちている道具の見た目（種類ごとではなく、カテゴリごとに1つ。見た目で正体はわからない）。
// 絵は src/ui/itemArt.ts のドットから scripts/make-items.mjs で書き出した public/sprites/items/<名前>.png。
// めずらしい道具（忍法帖の実）だけは 正体がわかっているので 専用の絵。

import { defOf } from "../core/item";
import type { ItemCat } from "../core/types";

const art = (name: string): string => `pub:sprites/items/${name}.png`;

export const CAT_ICON: Record<ItemCat, string> = {
	weapon: art("weapon"), // ガッのバット
	shield: art("shield"), // 板（釘と名札）
	ring: art("ring"), // トリップの ◆
	herb: art("herb"), // www の草
	scroll: art("scroll"), // スレ（赤い【 と 緑の名前欄）
	staff: art("staff"), // AA の顔の彫り物の杖
	arrow: art("arrow"), // ＞＞ の矢羽
	food: art("food"), // パン
	goal: "pub:sprites/phono.png#0,0,16,16",
};

export const itemIcon = (kind: string): string => {
	const d = defOf(kind);
	return d.rare ? art("growth") : CAT_ICON[d.cat];
};

/** 階段（下り・上り）。上りは下りの絵を上下に反転して描く代わりに、同じ絵を使う。 */
export const STAIRS_UP_TINT = "rgba(120, 200, 255, 0.35)";
