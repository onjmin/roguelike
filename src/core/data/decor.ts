// 板ごとの 装飾（ふつうの 階の 部屋に 散らばる、その 板に ゆかりの ある 物。過去ログの底は 層ごと）。見た目だけで 通れる
// （風呂板の 湯だまり＝DungeonDef.pools と 同じ。core/floor.ts の placeDecor・ui/dungeon/render.ts）。
// 道具と まちがえない よう、置物は 部屋の 北の 壁ぎわ（真上が 壁の 床）に しか 置かず、床に 立てる 物は 2マス 以上
// （縦に 2マス ぶんの 背丈か、横 2マス）に する。1マスの 小物は 壁の 面に かける（hang。テレビ・ちょうちん・きのこ）。
// 部屋の 中ほどには 温泉と 同じ 広がる 水たまり（liquid。はちみつ・水銀・血の池 など）を わかす。
// 大きさの 決まりは src/sim/placeTests.ts で 調べる。

import type { DungeonId } from "../types";
import type { PlaceArt } from "./places";

export type DecorKind = {
	/** 下から 順に 重ねる 絵（占める マスの 下の 中ほどに 合わせる。scale・lift は 置物と 同じ）。 */
	art: readonly PlaceArt[];
	/** 壁の 面に かける 1マスの 小物（床には 立てない）。 */
	hang?: true;
	/** 横に 占める 壁ぎわの マス（既定 1）。 */
	w?: 1 | 2;
	/** 出やすさ（既定 1）。 */
	weight?: number;
};

export type DecorSet = {
	/** 1階に 置く 壁ぎわの 置物の 数。 */
	count: readonly [number, number];
	kinds: readonly DecorKind[];
	/**
	 * 部屋に わく 水たまり（見た目だけ。通れる）。pond は 岸の オートタイル（scripts/make-pond.mjs の pond-<名前>.png）、
	 * count は 1階の 数。風呂板の 湯だまりは DungeonDef.pools（湯気が 立つ）。
	 */
	liquid?: { pond: string; count: readonly [number, number] };
};

/** 層の ある 板（過去ログの底）の 装飾：この 階（last）までが 同じ 置物。層の 区切りは data/story/story.ts の zones と そろえる。 */
export type ZonedDecor = { zones: readonly (DecorSet & { last: number })[] };

/** その 階の 装飾（層の ある 板は 深さで 選ぶ）。 */
export const decorAt = (id: DungeonId, depth: number): DecorSet | undefined => {
	const d = BOARD_DECOR[id];
	if (!d || !("zones" in d)) return d;
	return d.zones.find((z) => depth <= z.last) ?? d.zones[d.zones.length - 1];
};

const cut = (img: string, c: number, r: number, w = 1, h = 1): string =>
	`${img}#${c * 16},${r * 16},${w * 16},${h * 16}`;
const BASE = "pub:assets/rpg-reze/Base.png";
const INTERIOR = "pub:sprites/rpgen-interior.png";
const b = (c: number, r: number, w = 1, h = 1) => cut(BASE, c, r, w, h);
const i = (c: number, r: number, w = 1, h = 1) => cut(INTERIOR, c, r, w, h);

const art = (ref: string, scale?: number): PlaceArt =>
	scale ? { ref, scale } : { ref };
const opt = (weight?: number) => (weight ? { weight } : {});
/** 床に 立てる 背の 高い 物（1マス 幅で 縦 2マス ぶん 以上）。 */
const stand = (ref: string, scale?: number, weight?: number): DecorKind => ({
	art: [art(ref, scale)],
	...opt(weight),
});
/** 床に 置く 横 2マスの 物。 */
const wide = (ref: string, scale?: number, weight?: number): DecorKind => ({
	art: [art(ref, scale)],
	w: 2,
	...opt(weight),
});
/** 壁の 面に かける 小物。 */
const hang = (ref: string, scale?: number, weight?: number): DecorKind => ({
	art: [art(ref, scale)],
	hang: true,
	...opt(weight),
});
/** name が 空なら 村の 池と 同じ 水。 */
const pond = (name: string, lo = 1, hi = 2) => ({
	pond: `pub:assets/rpg-reze/pond${name ? `-${name}` : ""}.png#0,0,16,80`,
	count: [lo, hi] as const,
});

// 共通の 絵
const RED_LANTERN = b(2, 297);
const FLOUR_SACKS = b(2, 495, 2, 2);
const SKULLS = b(0, 189);

export const BOARD_DECOR: Readonly<Record<DungeonId, DecorSet | ZonedDecor>> = {
	// パン板：パン屋の 裏方。れんがの 窯・麦の 束・小麦粉の 袋の 山。こぼれた はちみつ
	shallow: {
		count: [3, 6],
		kinds: [
			wide(`${BASE}#88,5424,40,64`, 0.75, 2),
			stand(b(5, 26, 1, 2), undefined, 2),
			wide(FLOUR_SACKS, undefined, 2),
		],
		liquid: pond("honey"),
	},
	// 風呂板：湯だまり（DungeonDef.pools）の ほかに、竹垣・石灯籠・大桶
	main: {
		count: [2, 5],
		kinds: [
			stand(b(0, 397, 1, 3), undefined, 2),
			stand(b(0, 411, 1, 2)),
			wide(b(0, 124), 2),
		],
	},
	// 電池板：電池（ボンベ）・計器盤、壁に 砂嵐の テレビと 赤い 弁。漏れた 電解液
	deep: {
		count: [3, 6],
		kinds: [
			stand(b(2, 482, 1, 2), undefined, 2),
			stand(b(3, 482, 1, 2)),
			stand(b(5, 193, 1, 2)),
			hang(b(2, 485, 2, 2), 0.5),
			hang(b(3, 479)),
		],
		liquid: pond("acid"),
	},
	// きのこ板：壁から 生える きのこと 紫の 菌糸。胞子の 沼
	kinoko: {
		count: [4, 7],
		kinds: [
			hang(b(0, 363), undefined, 2),
			hang(b(1, 363), undefined, 2),
			hang(b(2, 363)),
			hang(b(3, 363)),
			stand(b(3, 581, 1, 2), undefined, 2),
		],
		liquid: pond("spore"),
	},
	// 離島・沖縄板：椰子・大岩。潮だまり
	tropical: {
		count: [3, 5],
		kinds: [stand(b(0, 601, 2, 3), 0.75, 3), wide(b(1, 604, 2, 2))],
		liquid: pond("tide", 1, 3),
	},
	// おんたこ（たこ焼き板）：壁の 赤ちょうちん・小麦粉の 袋の 山・鉄板の 台。こぼれた ソース
	konamono: {
		count: [3, 6],
		kinds: [
			hang(RED_LANTERN, undefined, 2),
			wide(FLOUR_SACKS),
			wide(i(2, 13, 2, 1)),
		],
		liquid: pond("sauce"),
	},
	// お祭り会場：野点傘・壁の ちょうちん。金魚すくいの 水
	festival: {
		count: [4, 7],
		kinds: [
			wide(b(5, 297, 2, 2), undefined, 2),
			hang(RED_LANTERN, undefined, 2),
		],
		liquid: pond(""),
	},
	// 過去ログの底：層（曲と 見た目が 変わる 区切り）ごとに 置物も 変わる
	hidden: {
		zones: [
			// 過去ログの浅瀬：掘りかけの 土の 山・木箱・丸太の 柱。浅い 水たまり
			{
				last: 5,
				count: [3, 5],
				kinds: [
					wide(b(2, 191, 2, 2), undefined, 2),
					wide(b(6, 126, 2, 3), 0.75),
					stand(b(0, 129, 1, 3)),
				],
				liquid: pond(""),
			},
			// dat の石室：石の 柱と 石像、壁に 石板。墨の たまり
			{
				last: 10,
				count: [3, 6],
				kinds: [
					stand(b(1, 129, 1, 3), undefined, 2),
					stand(b(2, 129, 1, 3)),
					stand(b(4, 129, 1, 2)),
					hang(b(5, 88)),
				],
				liquid: pond("ink"),
			},
			// 埋もれた dat：土と 炭の 山、樽の 山、壁に 古い 貼り紙
			{
				last: 15,
				count: [3, 6],
				kinds: [
					wide(b(2, 191, 2, 2), undefined, 2),
					wide(b(4, 191, 2, 2)),
					wide(b(4, 126, 2, 3), 0.75),
					hang(b(2, 90), undefined, 2),
					hang(b(3, 90)),
				],
			},
			// 苔むしたスレ跡：若木と 生け垣、壁から きのこ。胞子の 沼
			{
				last: 20,
				count: [4, 7],
				kinds: [
					stand(b(0, 606, 1, 2), undefined, 2),
					wide(b(1, 600, 2, 1)),
					hang(b(0, 363), undefined, 2),
					hang(b(1, 363)),
				],
				liquid: pond("spore"),
			},
			// 崩れたまとめ：壊れた 本棚・食器棚・ピアノ、壁に 割れた 窓
			{
				last: 25,
				count: [3, 6],
				kinds: [
					wide(b(5, 272, 2, 2), undefined, 2),
					wide(b(0, 272, 2, 2)),
					wide(b(5, 274, 2, 2)),
					hang(b(4, 265)),
					hang(b(5, 265)),
				],
			},
			// 保守の墓場：墓石・折れた 柱・崩れた 石の 台、壁に 十字と 骨
			{
				last: 30,
				count: [4, 7],
				kinds: [
					wide(b(3, 133, 2, 2), undefined, 3),
					stand(b(3, 284, 1, 2)),
					wide(b(6, 283, 2, 2)),
					hang(b(7, 88)),
					hang(SKULLS),
				],
			},
			// 凍結された書庫：雪に 埋もれた 石板と 雪の 山・雪を かぶった 柱と 石像、壁に 氷の 結晶
			{
				last: 40,
				count: [3, 6],
				kinds: [
					wide(b(6, 246, 2, 2), undefined, 2),
					wide(b(6, 191, 2, 2)),
					stand(b(3, 245, 1, 3), undefined, 2),
					stand(b(5, 245, 1, 2)),
					hang(b(0, 343)),
				],
			},
			// 白紙の回廊：白い 柱が まばらに、壁に 白い 板
			{
				last: 50,
				count: [1, 3],
				kinds: [stand(b(2, 129, 1, 3), undefined, 2), hang(b(0, 88))],
			},
			// 文字化けの海：沈んだ 柱と 珊瑚、壁に 色の 崩れた 画面と 水晶。海水
			{
				last: 60,
				count: [3, 6],
				kinds: [
					stand(b(3, 581, 1, 2), undefined, 2),
					stand(b(3, 284, 1, 2)),
					hang(b(7, 486), undefined, 2),
					hang(b(1, 343)),
				],
				liquid: pond("sea", 2, 3),
			},
			// 規制の檻：鉄格子・鉄の 処女、壁に 鎖と 錠前
			{
				last: 70,
				count: [3, 6],
				kinds: [
					wide(b(0, 368, 2, 3), 0.75, 2),
					stand(b(0, 373, 1, 2)),
					hang(b(2, 373, 1, 2), undefined, 2),
					hang(b(3, 372)),
				],
			},
			// 落ちた鯖：鯖の 棚・ボンベ、壁に 消えた 画面と 計器。漏れた 電解液
			{
				last: 80,
				count: [3, 6],
				kinds: [
					stand(b(4, 193, 1, 2), undefined, 2),
					stand(b(6, 193, 1, 2)),
					stand(b(2, 482, 1, 2)),
					hang(b(6, 486)),
					hang(b(6, 485)),
				],
				liquid: pond("acid"),
			},
			// 焦げた回線：燃える 暖炉・溶けた 管・焦げた 柱と 炭の 山、壁に 赤い 弁
			{
				last: 90,
				count: [3, 6],
				kinds: [
					wide(b(5, 340, 3, 3), 0.67),
					stand(b(4, 458, 1, 3), undefined, 2),
					stand(b(1, 281, 1, 3)),
					wide(b(4, 191, 2, 2)),
					hang(b(3, 479)),
				],
			},
			// 炎上の底：かがり火・彼岸花・赤い 目の ガーゴイル、壁に 骨。血の池
			{
				last: 98,
				count: [4, 7],
				kinds: [
					stand(b(3, 129, 1, 2), undefined, 2),
					stand(b(0, 403, 1, 2), undefined, 2),
					stand(b(1, 352, 1, 2)),
					hang(SKULLS),
				],
				liquid: pond("blood"),
			},
			// 1001：金の 棺・1001 の 墓・金の 錫杖、壁に 金の 山
			{
				last: 99,
				count: [3, 5],
				kinds: [
					stand(b(5, 623, 1, 2), undefined, 2),
					stand(b(7, 623, 1, 2)),
					wide(b(3, 133, 2, 2)),
					stand(b(7, 352, 1, 2)),
					hang(b(5, 189)),
				],
			},
		],
	},
	// ボカロ作り避難所：ピアノ、壁に パソコンと エレキ・アコギ。ミク色の 水
	vocalo: {
		count: [3, 6],
		kinds: [
			hang(i(4, 4), undefined, 2),
			hang(i(5, 4)),
			hang(i(6, 4)),
			wide(b(3, 120, 2, 2), undefined, 2),
		],
		liquid: pond("miku"),
	},
	// なんでも実況（マーキュリー）：壁から 生える 水星の 鉱石（水晶）と 氷の とげ。水銀の たまり
	mercury: {
		count: [4, 7],
		kinds: [
			hang(b(2, 343), undefined, 2),
			hang(b(1, 343), undefined, 2),
			hang(b(0, 343)),
			stand(b(7, 604, 1, 2), undefined, 2),
		],
		liquid: pond("mercury", 1, 3),
	},
	// おんMu：沈む 大陸の 遺跡。折れた 柱・欠けた 石像と 台・紫の 珊瑚。しみ出した 海水
	onmu: {
		count: [3, 6],
		kinds: [
			stand(b(1, 281, 1, 3), undefined, 2),
			stand(b(5, 285, 1, 2)),
			stand(b(3, 284, 1, 2)),
			stand(b(3, 581, 1, 2), undefined, 2),
		],
		liquid: pond("sea", 1, 3),
	},
	// おんキム：キムチの 甕と、植民地戦争の 最前線の 土のう・タイヤ。こぼれた キムチの 汁
	onkimu: {
		count: [3, 6],
		kinds: [
			wide(b(2, 497, 2, 2), undefined, 3),
			wide(b(0, 495, 2, 2)),
			stand(b(1, 490, 1, 2)),
		],
		liquid: pond("kimchi"),
	},
	// †闇の板†：赤い 目の ガーゴイル・抜けない 剣・彼岸花、壁に 燭台と 骨。血の池
	inferno: {
		count: [4, 7],
		kinds: [
			stand(b(1, 352, 1, 2), undefined, 2),
			stand(b(6, 352, 1, 2)),
			stand(b(0, 403, 1, 2)),
			hang(b(4, 142)),
			hang(SKULLS),
		],
		liquid: pond("blood"),
	},
};
