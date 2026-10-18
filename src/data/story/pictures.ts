// 実物の 絵（engine/sceneCard.ts の PictureSpec）。台詞や 地の文に 出てきた 物・所を、そのまま 拡大して 見せる
// （2026-10-18 作者「セリフで『見出し』って説明されても分からないから、どういうところについている『見出し』か
// 画像をもってこい」）。仕組みの 説明の 矢印図は 作らない。
// - 広場の まとめ掲示板（data/village/map.ts の K・k の 絵）に 見出しの 紙が 貼って ある 絵。語りが
//   「掲示板に、見出しがひとつ。『…』」と 言う 頁に そえる（村の 冒頭・持ち帰りの 語り・転）。
// - 持ち帰った 品（public/sprites/items/）の 拡大図に、文に 出てきた 書きこみの 紙。
// - 名所の 階の 置物（案内板・石像）の 拡大図（core/data/places.ts の 絵と 同じ 切り出し）。

import type { PictureSpec } from "../../engine/sceneCard";
import { base } from "../village/tiles";

/** 広場の まとめ掲示板（2マス 幅・2マス 高さ。data/village/map.ts の villagePalette の K・k）。 */
export const BOARD_ART = base(6, 37, 2, 2);

/** まとめ掲示板に 見出しの 紙が 1枚 貼って ある 絵。 */
export const boardPicture = (headline: string, note?: string): PictureSpec => ({
	kind: "picture",
	title: "広場のまとめ掲示板",
	art: BOARD_ART,
	scale: 4,
	paper: { text: headline },
	...(note ? { note } : {}),
});

/** 地の文の 『…』 の 中（見出し）。無ければ null。 */
export const headlineIn = (text: string): string | null =>
	/『([^』]+)』/.exec(text)?.[1] ?? null;

/**
 * 「掲示板に、見出しがひとつ。『…』」の 地の文に そえる 掲示板の 絵（見出しは 文から 取るので 一字も ちがわない）。
 * 『』が なければ 書きまちがいなので 落とす（src/sim/villageTests.ts でも 見る）。
 */
export const boardOf = (text: string): PictureSpec => {
	const h = headlineIn(text);
	if (!h) throw new Error(`見出しの 『』 が ない: ${text}`);
	return boardPicture(h);
};

/** 持ち帰った 品（public/sprites/items/<png>.png）の 拡大図。paper は 文に 出てきた 書きこみ。 */
export const itemPicture = (
	png: string,
	title: string,
	paper?: PictureSpec["paper"],
	note?: string,
): PictureSpec => ({
	kind: "picture",
	title,
	art: `pub:sprites/items/${png}.png`,
	scale: 4,
	...(paper ? { paper } : {}),
	...(note ? { note } : {}),
});

/** 置物の 絵（core/data/places.ts と 同じ 参照）の 拡大図。 */
export const propPicture = (
	art: string,
	title: string,
	paper?: PictureSpec["paper"],
	scale = 4,
): PictureSpec => ({
	kind: "picture",
	title,
	art,
	scale,
	...(paper ? { paper } : {}),
});
