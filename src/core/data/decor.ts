// 板ごとの 装飾（ふつうの 階の 部屋に 散らばる、その 板に ゆかりの ある 物）。見た目だけで 通れる
// （風呂板の 湯だまり＝DungeonDef.pools と 同じ。core/floor.ts の placeDecor・ui/dungeon/render.ts）。
// 道具と まちがえない よう、拾える 物（パン・きのこ・たこ焼き・キムチ・巻物・本）に 見える 絵は 床に 置かない。
//
// wall の 物は 部屋の 北の 壁ぎわ（真上が 壁の 床）に 立てる。背の 高い 絵は 壁の 面に はみ出して 描く。
// それ以外は 部屋の 中ほど（まわり 4マスも 同じ 部屋の 床。通路の 口を ふさいで 見せない）に 置く。

import type { DungeonId } from "../types";
import type { PlaceArt } from "./places";

export type DecorKind = {
	/** 下から 順に 重ねる 絵（マスの 下の 中ほどに 合わせる。scale・lift は 置物と 同じ）。 */
	art: readonly PlaceArt[];
	/** 北の 壁ぎわに 立てる。 */
	wall?: true;
	/** 床に じかに 描く 平たい 物（影を つけない）。 */
	flat?: true;
	/** 出やすさ（既定 1）。 */
	weight?: number;
};

export type DecorSet = {
	/** 1階に 置く 数。 */
	count: readonly [number, number];
	kinds: readonly DecorKind[];
};

const cut = (img: string, c: number, r: number, w = 1, h = 1): string =>
	`${img}#${c * 16},${r * 16},${w * 16},${h * 16}`;
const BASE = "pub:assets/rpg-reze/Base.png";
const INTERIOR = "pub:sprites/rpgen-interior.png";
const b = (c: number, r: number, w = 1, h = 1) => cut(BASE, c, r, w, h);
const i = (c: number, r: number, w = 1, h = 1) => cut(INTERIOR, c, r, w, h);

const art = (ref: string, scale?: number): PlaceArt =>
	scale ? { ref, scale } : { ref };
const wall = (ref: string, scale?: number, weight?: number): DecorKind => ({
	art: [art(ref, scale)],
	wall: true,
	...(weight ? { weight } : {}),
});
const floor = (ref: string, scale?: number, weight?: number): DecorKind => ({
	art: [art(ref, scale)],
	...(weight ? { weight } : {}),
});
const flat = (ref: string, weight?: number): DecorKind => ({
	art: [{ ref }],
	flat: true,
	...(weight ? { weight } : {}),
});

// 共通の 絵
const RED_LANTERN = b(2, 297);
const BARREL = i(13, 15);
const FLOUR_SACK = b(2, 495, 2, 2);
const TOMB = b(3, 13);
const SKULLS = b(0, 189);

export const BOARD_DECOR: Readonly<Record<DungeonId, DecorSet>> = {
	// パン板：パン屋の 裏方。れんがの 窯・麦の 束・小麦粉の 袋・樽
	shallow: {
		count: [3, 6],
		kinds: [
			wall(`${BASE}#88,5424,40,64`, 0.5, 2),
			wall(b(5, 26, 1, 2), undefined, 2),
			floor(FLOUR_SACK, 0.5, 2),
			floor(BARREL),
		],
	},
	// 風呂板：湯だまり（pools）の ほかに、湯桶・竹垣・石灯籠
	main: {
		count: [2, 5],
		kinds: [
			floor(b(0, 124), undefined, 2),
			floor(b(1, 124)),
			wall(b(0, 397, 1, 3), undefined, 2),
			wall(b(0, 411, 1, 2)),
		],
	},
	// 電池板：電池（ボンベ）・計器盤・砂嵐の テレビ・赤い 弁
	deep: {
		count: [3, 6],
		kinds: [
			wall(b(2, 482, 1, 2), undefined, 2),
			wall(b(3, 482, 1, 2)),
			wall(b(5, 193, 1, 2)),
			wall(b(2, 485, 2, 2), 0.5),
			floor(b(3, 479)),
		],
	},
	// きのこ板：壁から 生える きのこ（床には 置かない）と 紫の 菌糸
	kinoko: {
		count: [4, 7],
		kinds: [
			wall(b(0, 363), undefined, 2),
			wall(b(1, 363), undefined, 2),
			wall(b(2, 363)),
			wall(b(3, 363)),
			wall(b(3, 581, 1, 2), undefined, 2),
		],
	},
	// 離島・沖縄板：椰子・ハイビスカス・岩
	tropical: {
		count: [3, 5],
		kinds: [
			wall(b(0, 601, 2, 3), 0.75, 3),
			floor(b(6, 603), undefined, 2),
			floor(b(7, 603)),
			floor(b(1, 604, 2, 2), 0.5),
		],
	},
	// おんたこ（たこ焼き板）：赤ちょうちん・粉の 袋・鉄板・油の ドラム缶
	konamono: {
		count: [3, 6],
		kinds: [
			wall(RED_LANTERN, undefined, 2),
			floor(FLOUR_SACK, 0.5, 2),
			flat(b(0, 342)),
			wall(b(5, 491)),
		],
	},
	// お祭り会場：野点傘・ちょうちん・ヨーヨー（床の 赤に 沈まない 色）
	festival: {
		count: [4, 7],
		kinds: [
			wall(b(5, 297, 2, 2), 0.75, 2),
			wall(RED_LANTERN),
			floor(b(5, 572), undefined, 2),
			floor(b(4, 572)),
			floor(b(5, 571)),
		],
	},
	// 過去ログの底：1001 の 墓・十字・骨・ログの 書庫
	hidden: {
		count: [3, 6],
		kinds: [
			floor(TOMB, undefined, 2),
			floor(b(4, 13)),
			floor(SKULLS),
			wall(i(0, 15, 1, 2), undefined, 2),
			wall(i(1, 14, 1, 2)),
		],
	},
	// ボカロ作り避難所：ギター・レコード・ピアノ
	vocalo: {
		count: [3, 6],
		kinds: [
			wall(i(4, 4), undefined, 2),
			wall(i(5, 4)),
			floor(i(6, 4)),
			wall(b(3, 120, 2, 2), 0.5, 2),
		],
	},
	// なんでも実況（マーキュリー）：水星の 鉱石（水晶）と 氷の とげ
	mercury: {
		count: [4, 7],
		kinds: [
			floor(b(2, 343), undefined, 2),
			floor(b(1, 343), undefined, 2),
			floor(b(0, 343)),
			wall(b(7, 604, 1, 2), undefined, 2),
		],
	},
	// おんMu：沈んだ 大陸の 遺跡。折れた 柱・欠けた 石像と 台・紫の 珊瑚・がれき
	onmu: {
		count: [3, 6],
		kinds: [
			wall(b(1, 281, 1, 3), undefined, 2),
			wall(b(5, 285, 1, 2)),
			wall(b(3, 284, 1, 2)),
			wall(b(3, 581, 1, 2), undefined, 2),
			flat(b(1, 288)),
		],
	},
	// おんキム：キムチの 甕と、植民地戦争の 最前線の 土のう・タイヤ
	onkimu: {
		count: [3, 6],
		kinds: [
			floor(b(2, 497, 2, 2), 0.5, 3),
			floor(b(0, 495, 2, 2), 0.5),
			wall(b(1, 490, 1, 2)),
		],
	},
	// †闇の板†：赤い 目の ガーゴイル・抜けない 剣・魔法陣・燭台・彼岸花
	inferno: {
		count: [4, 7],
		kinds: [
			wall(b(1, 352, 1, 2), undefined, 2),
			wall(b(6, 352, 1, 2)),
			flat(b(7, 13), 2),
			floor(b(4, 142)),
			wall(b(0, 403)),
			floor(SKULLS),
		],
	},
};
