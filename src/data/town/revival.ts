// 寂れた 町が 板の 話ごとに 生き返る（TOWN.md §0.6。2026-10-17 作者「この 案で 実装して」）。
// 決まり：その 話の 事件が 町に 残した 爪あとの 所が、その 板の 底の 品を 持ち帰ると 生き返る。
// 生き返って いない 所は シャッター（扉を 踏むと 1歩 もどる・外の 物も 使えない・通行人も 入らない）。
// ここに ない 施設は はじめから 開いて いる（港の 桟橋・本館・常識堂・倉庫・喫茶・碁会所・マイクラの 島・芋煮の かまど）。
// DOM も 保存も 使わない（src/sim/revivalTests.ts）。

import type { DungeonId } from "../../core/types";

export type ReviveArea = {
	id: string;
	/** この 板を 持ち帰ると 生き返る。 */
	dungeon: DungeonId;
	/** 通りの 名前（知らせの 窓に 出す）。 */
	name: string;
	/** 生き返った ときの 地の文（村の 窓。全角 22字・2行まで）。 */
	line: string;
	/** 施設の id（data/village/facilities.ts）と 町の まんなかの 建物の id（REVIVE_CORE）。 */
	places: readonly string[];
};

/** 町の まんなかに じかに 描く 建物（data/village/map.ts）の id。 */
export type CorePlace =
	| "shrine"
	| "music"
	| "bath"
	| "library"
	| "bookstore"
	| "cafe"
	| "fountain"
	| "bakery";

/** 本筋の 板の 順（パン → きのこ → 風呂 → 電池）。 */
export const MAIN_BOARDS: readonly DungeonId[] = [
	"shallow",
	"kinoko",
	"main",
	"deep",
];

export const REVIVE_AREAS: readonly ReviveArea[] = [
	{
		id: "plaza",
		dungeon: "shallow",
		name: "広場",
		line: "宣戦布告の貼り紙がはがされ、\n広場に人がもどってきた。",
		places: ["clock", "post_city", "library", "bookstore", "music", "fountain"],
	},
	{
		id: "street",
		dungeon: "kinoko",
		name: "商店街",
		line: "踏まれた商店街のシャッターが、\nつぎつぎにあがっていく。",
		places: [
			"konbini",
			"arcade",
			"otaku",
			"cinema",
			"theater",
			"maid",
			"casino",
			"ramen",
			"famires",
			"shoken",
			"bakery",
		],
	},
	{
		id: "bath",
		dungeon: "main",
		name: "銭湯の並び",
		line: "銭湯のえんとつから湯けむり。\nのれんがあがった。",
		places: ["bath", "bank", "dojo", "gym", "netcafe"],
	},
	{
		id: "lights",
		dungeon: "deep",
		name: "町の明かり",
		line: "町じゅうの街灯がともった。\n丘の上まで、明るい。",
		places: [
			"bar",
			"izakaya",
			"ground",
			"bushitsu",
			"myhome",
			"house_a",
			"house_b",
			"recycle",
			"pawn",
		],
	},
	{
		id: "beach",
		dungeon: "tropical",
		name: "浜",
		line: "浜のテントが片づいて、\n海の家が店をあけた。",
		places: ["umi", "vend_beach", "restaurant"],
	},
	{
		id: "tako",
		dungeon: "konamono",
		name: "たこ八",
		line: "屋台からソースのにおい。\nたこ焼きがもどってきた。",
		places: ["tako"],
	},
	{
		id: "shrine",
		dungeon: "festival",
		name: "丘の神社",
		line: "丘の神社にちょうちんがともり、\n祭りばやしがきこえる。",
		places: ["shrine", "soba"],
	},
];

const AREA_OF = new Map(
	REVIVE_AREAS.flatMap((a) => a.places.map((p) => [p, a] as const)),
);

/** その 所を 生き返らせる 通り（はじめから 開いて いる 所は null）。 */
export const reviveAreaOf = (place: string): ReviveArea | null =>
	AREA_OF.get(place) ?? null;

/** 持ち帰った 板で その 所が 開いて いるか。 */
export const isRevived = (
	place: string,
	cleared: readonly DungeonId[],
): boolean => {
	const a = reviveAreaOf(place);
	return !a || cleared.includes(a.dungeon);
};

/** 街灯が 灯るか（町の 明かり＝電池板を 持ち帰って から。それまで 街灯は 立って いるが 消えて いる）。 */
export const lampsLit = (cleared: readonly DungeonId[]): boolean =>
	REVIVE_AREAS.some((a) => a.id === "lights" && cleared.includes(a.dungeon));

/** 持ち帰った 板で 生き返った 通り（表の 順）。 */
export const revivedAreas = (cleared: readonly DungeonId[]): ReviveArea[] =>
	REVIVE_AREAS.filter((a) => cleared.includes(a.dungeon));

/**
 * 町の 段（倉庫の 広さ・持ちこめる 数。core/town.ts の STORAGE_CAP・CARRY_MAX）。
 * 本筋の 板を 持ち帰る たびに 上がる：0 → 3 → 5 → 6 → 7。
 */
export const stageOfCleared = (cleared: readonly DungeonId[]): number =>
	[0, 3, 5, 6, 7][MAIN_BOARDS.filter((d) => cleared.includes(d)).length];
