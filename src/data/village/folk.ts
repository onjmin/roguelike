// 保守村の 小さな 名物（folk）の 置き場所（地図の 座標）と 機能の 墓場の 外観。DOM も 保存も 使わない。
// 文と 決まりは data/folk.ts、話し方は ui/folk.ts（村の イベントは ui/villageEvents.ts の eventFor から folkEvent）。
// ここからは map.ts・facilities.ts の 値を 読まない（どちらも ここを 読むので、まわりこむと 読みこみの 順で こわれる）。
//
//   ひらがなニキ   (8,17)  西の 空き地（段5 からは 喫茶の 東）。x=7 の 道の となりの くぼみ。段0 から。
//                  段6 からは すぐ 下に 街灯が 立つので、図書館の 入口の 西の すみ (3,23) へ（FOLK_MOVES）
//   なぞなぞ仮面   (29,23) 広場の 南東の すみ（x=29 の 細道の 行き止まり）。段0 から。
//                  段7 は すぐ 下の 植えこみに 街灯が 立つので、柵の かど (30,25) へ（FOLK_MOVES）
//   モフちゃん     (1,16)  西の 空き地の 北西の すみの くぼみ（段5 からは 喫茶の 裏の 路地の 行き止まり）。段0 から。
//                  絵は 段ごとに 少し かわる。(7,22) は 西口の 乗り場・図書館・碁会所への 近道なので 置かない（map.ts の 片づけ）。
//                  (1,21) は すぐ 下の 木の 葉に かくれて 白い 体が 見えない
//   おどちゃん     (16,30) 池の 南の 原っぱ。夜（20〜4時）だけ 見える（ui/folk.ts の when）。段0 から。うろうろ する
//   機能の 墓場    神社の 上の 森（x1〜7, y1〜3）。神社の 東の わき道（5,4）（7,4）から 入る。段2 から（神社と 同じ）
//     y1  墓 ×7（タグ機能・ロリード・草ボタン・GPS・バルス・弾幕・イイ！ボタン）  y2  玉砂利の 道
//     y3  森・森・森・供養碑・道・新しい 墓（!okpic）・道
// どの 人も 道を ふさがない・遠回りに しない・木の 葉や 街灯に かくれない（くぼみ・行き止まり・原っぱ。src/sim/folkTests.ts の F6）。

import type { Dir } from "../../engine/types";
import type { Facility } from "./facilities";
import type { Cell, VillagePlace } from "./map";
import { base } from "./tiles";

/** 墓場の 絵（scripts/make-folk.mjs が 書き出す public/sprites/folk.png の 16x16 の マス）。 */
const FOLK_IMG = "pub:sprites/folk.png";
const cell = (i: number): string => `${FOLK_IMG}#${i * 16},0,16,16`;
export const FOLK_ART = {
	grave: cell(0),
	graveKusa: cell(1),
	graveTag: cell(2),
	graveNew: cell(3),
	memo: cell(4),
	monument: cell(5),
} as const;

/** 歩行グラ（RPGEN の CDN と 手描き・ぬりかえ）。ほかの 人・敵・通行人と かぶらない（folkTests F10）。 */
export const FOLK_WALK = {
	/** RPGEN「彡(●)(●)」29aYeF を 水色に ぬりかえ（黄色の まま だと やきうに 見える。scripts/make-folk.mjs）。 */
	hira: "pub:sprites/folk_hira.png",
	/** RPGEN「察しの悪そうな仮面男」。 */
	nazo: "sa:RDwegQ",
	/** RPGEN「サイクロJ民」（本館の すみの バルス失敗ニキ）。 */
	balus: "sa:DUfPo9",
	/** RPGEN「白衣」（図書館の 人工無能ニキ）。 */
	idea: "sa:XdQbwb",
	/** 手描き（scripts/make-folk.mjs）。 */
	odoru: "pub:sprites/folk_odoru.png",
} as const;

/** モフちゃん（段ごとに 少し ちがう 絵。段 0〜7）。 */
export const mofuWalk = (stage: number): string =>
	`pub:sprites/folk_mofu${Math.max(0, Math.min(7, Math.floor(stage) || 0))}.png`;

export const FOLK_SPOTS = {
	hira: [8, 17] as Cell,
	nazo: [29, 23] as Cell,
	mofu: [1, 16] as Cell,
	odoru: [16, 30] as Cell,
} as const;

type FolkWho = keyof typeof FOLK_SPOTS;

/**
 * 段 from から 立つ マスを かえる 人（すぐ 下の マスに 新市街の 街灯が 立ち、頭が 街灯の 上に かくれるので）。
 * ひらがなニキは 図書館の 入口の 西の すみ、なぞなぞ仮面は 広場の 南東の 柵の かど。
 */
export const FOLK_MOVES: Partial<
	Record<FolkWho, { from: number; at: Cell; dir: Dir }>
> = {
	hira: { from: 6, at: [3, 23], dir: "right" },
	nazo: { from: 7, at: [30, 25], dir: "right" },
};

/** その 段で 立つ マスと 向き。 */
export const folkSpot = (
	who: FolkWho,
	stage: number,
	dir: Dir,
): { x: number; y: number; dir: Dir } => {
	const m = FOLK_MOVES[who];
	if (m && stage >= m.from) return { x: m.at[0], y: m.at[1], dir: m.dir };
	return { x: FOLK_SPOTS[who][0], y: FOLK_SPOTS[who][1], dir };
};

/** 墓場の 立つ 段（神社と 同じ）。 */
export const BOCHI_FROM = 2;

/** 墓（地図の 座標）。 */
export const GRAVES: readonly { id: string; at: Cell }[] = [
	{ id: "tag", at: [1, 1] },
	{ id: "rolli", at: [2, 1] },
	{ id: "kusa", at: [3, 1] },
	{ id: "gps", at: [4, 1] },
	{ id: "balus", at: [5, 1] },
	{ id: "danmaku", at: [6, 1] },
	{ id: "iine", at: [7, 1] },
	{ id: "okpic", at: [6, 3] },
];
export const MONUMENT: Cell = [4, 3];

/** 玉砂利（Base.png の 地面の 灰色）。 */
const GRAVEL = base(7, 4);

/** 機能の 墓場（森を 開いた 小さな 墓地。中は ない）。FACILITIES の いちばん うしろに 足す。 */
export const FOLK_FACILITIES: readonly Facility[] = [
	{
		id: "bochi",
		name: "機能の　墓場",
		from: BOCHI_FROM,
		at: [1, 1],
		look: {
			kind: "grid",
			ground: "grass",
			shadow: false,
			floor: ".",
			rows: ["GGkGtGt", ".......", "   S.n."],
			keys: {
				".": [GRAVEL],
				G: [GRAVEL, FOLK_ART.grave],
				k: [GRAVEL, FOLK_ART.graveKusa],
				t: [GRAVEL, FOLK_ART.graveTag],
				n: [GRAVEL, FOLK_ART.graveNew],
				S: [GRAVEL, FOLK_ART.monument],
			},
		},
	},
];

/** 村に 置く folk の イベント（id は folk_ で はじまる。ui/folk.ts の folkEvent が 話し方を つける）。 */
export const folkPlaces = (stage: number): VillagePlace[] => {
	const out: VillagePlace[] = [
		{
			id: "folk_hira",
			...folkSpot("hira", stage, "left"),
			trigger: "talk",
			sprite: FOLK_WALK.hira,
		},
		{
			id: "folk_nazo",
			...folkSpot("nazo", stage, "up"),
			trigger: "talk",
			sprite: FOLK_WALK.nazo,
		},
		{
			id: "folk_mofu",
			x: FOLK_SPOTS.mofu[0],
			y: FOLK_SPOTS.mofu[1],
			trigger: "talk",
			sprite: mofuWalk(stage),
			// 絵は 4方向とも 正面（板トップの 絵と 同じく いつも こちらを 見ている）
			dir: "down",
		},
		{
			id: "folk_odoru",
			x: FOLK_SPOTS.odoru[0],
			y: FOLK_SPOTS.odoru[1],
			trigger: "talk",
			sprite: FOLK_WALK.odoru,
			dir: "down",
			wander: true,
		},
	];
	if (stage >= BOCHI_FROM) {
		for (const g of GRAVES)
			out.push({
				id: `folk_grave_${g.id}`,
				x: g.at[0],
				y: g.at[1],
				trigger: "talk",
			});
		out.push({
			id: "folk_monument",
			x: MONUMENT[0],
			y: MONUMENT[1],
			trigger: "talk",
		});
	}
	return out;
};
