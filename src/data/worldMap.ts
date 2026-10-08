// 全体マップ（おーぷん2ch の 地図）。島は おーぷんの サーバー（寿司ネタの 名前）で、
// 植民地は 実際に 置かれている サーバーの 島に 建つ（植民地一覧スレの URL より）。
// まん中の hayabusa に おんJ（保守村）。座標は 地図の 画素（MAP_W × MAP_H）。ui/worldMap.ts が 描く。

import type { DungeonId } from "../core/types";

export const MAP_W = 224;
export const MAP_H = 224;

export type Pt = readonly [number, number];

/** 島（サーバー）。blobs は 円の 重なり（x, y, 半径）。 */
export type Island = {
	name: string;
	label: Pt;
	blobs: readonly (readonly [number, number, number])[];
};

export const ISLANDS: readonly Island[] = [
	{
		name: "hayabusa",
		label: [112, 158],
		blobs: [
			[112, 120, 32],
			[134, 104, 17],
			[96, 132, 18],
		],
	},
	{
		name: "ikura",
		label: [36, 112],
		blobs: [
			[52, 70, 28],
			[38, 92, 17],
			[42, 54, 18],
		],
	},
	// ikura の 沖の 小島（離島・沖縄板）
	{ name: "", label: [0, 0], blobs: [[20, 24, 12]] },
	{
		name: "uni",
		label: [180, 96],
		blobs: [
			[172, 62, 28],
			[190, 42, 16],
			[160, 76, 14],
		],
	},
	{
		name: "awabi",
		label: [182, 214],
		blobs: [
			[178, 186, 22],
			[190, 176, 12],
		],
	},
	// おーぷぬ（だれでも 板を 立てられた。open.open2ch.net）。南西の 海に ちらばる 小島＝乗っ取り事件で
	// 「〜〜諸島」に 名前を 変えられた 板たち。裏シナリオの 灯台は いちばん 大きい 島に、乗っ取られた 小島 3つは
	// まわりの 小さな 島に（STORY.md §5.98）
	{
		name: "open",
		label: [52, 216],
		blobs: [
			[54, 190, 11],
			[38, 204, 7],
			[72, 204, 6],
			[30, 184, 5],
		],
	},
	// 北東の 沖の 小島：過疎の 専門板の 列（避難J。第三ルート）
	{ name: "", label: [0, 0], blobs: [[203, 17, 9]] },
];

/** 保守村（おんJ）の 位置。道は ここから 出る。 */
export const VILLAGE_PT: Pt = [110, 128];

/** 建物の 絵の 種類（ui/worldMap.ts の drawBuilding）。 */
export type BuildingKind =
	| "village"
	| "bakery"
	| "mushroom"
	| "bathhouse"
	| "pylon"
	| "island"
	| "building"
	| "yagura"
	| "well"
	| "lighthouse"
	| "islet"
	| "tent"
	| "boat";

export type ColonySpot = {
	/** 置かれている サーバー。 */
	server: string;
	/** 建物・地形（着いたときの 札に 出す）。 */
	place: string;
	building: BuildingKind;
	/** 保守村から 建物までの 道（最後の 点が 建物の 足もと）。 */
	route: readonly Pt[];
};

export const COLONY_SPOTS: Record<DungeonId, ColonySpot> = {
	shallow: {
		server: "ikura",
		place: "パン屋の　地下の　窯",
		building: "bakery",
		route: [
			[96, 110],
			[76, 86],
			[50, 66],
		],
	},
	konamono: {
		server: "ikura",
		place: "大阪の　雑居ビル",
		building: "building",
		route: [
			[96, 110],
			[76, 86],
			[62, 90],
			[40, 96],
		],
	},
	tropical: {
		server: "ikura",
		place: "島の　山",
		building: "island",
		route: [
			[96, 110],
			[76, 86],
			[50, 66],
			[40, 48],
			[28, 34],
			[20, 26],
		],
	},
	festival: {
		server: "hayabusa",
		place: "祭りの　やぐら",
		building: "yagura",
		route: [
			[120, 116],
			[136, 106],
		],
	},
	deep: {
		server: "uni",
		place: "送電鉄塔",
		building: "pylon",
		route: [
			[126, 108],
			[148, 88],
			[170, 66],
			[190, 46],
		],
	},
	kinoko: {
		server: "uni",
		place: "地下の　菌床",
		building: "mushroom",
		route: [
			[126, 108],
			[148, 88],
			[160, 78],
		],
	},
	// 隠し：保守村の 下の 古井戸（開くまで 地図に 出ない）
	hidden: {
		server: "hayabusa",
		place: "保守村の　下の　古井戸",
		building: "well",
		route: [
			[106, 138],
			[98, 144],
		],
	},
	// 裏シナリオ：おーぷぬの 諸島の 灯台（小島を 3つ 取り返すと 開く。扉は パスワード）
	opunu: {
		server: "open",
		place: "諸島の　灯台",
		building: "lighthouse",
		route: [
			[104, 140],
			[90, 158],
			[74, 174],
			[58, 184],
		],
	},
	// 乗っ取られた 小島 3つ（裏シナリオの 承。パン板の あとに 1つ目が 開く）
	isle1: {
		server: "open",
		place: "小島の　丘",
		building: "islet",
		route: [
			[104, 140],
			[90, 158],
			[74, 174],
			[58, 184],
			[46, 196],
			[38, 204],
		],
	},
	isle2: {
		server: "open",
		place: "小島の　洞",
		building: "islet",
		route: [
			[104, 140],
			[90, 158],
			[80, 180],
			[74, 196],
			[72, 204],
		],
	},
	isle3: {
		server: "open",
		place: "小島の　岩山",
		building: "islet",
		route: [
			[104, 140],
			[90, 158],
			[74, 174],
			[58, 184],
			[42, 186],
			[30, 184],
		],
	},
	// 裏シナリオの 結：野球chの 跡地（本館の 奥の 札から 降りる。地図には 出ない。北＝本館の 向き）
	ato: {
		server: "hayabusa",
		place: "本館の　奥の　床下",
		building: "well",
		route: [
			[110, 118],
			[110, 110],
		],
	},
	// 裏の 2段目：1901年の スレ（本館の 古い 札の さらに 下。全体マップには 出ない）
	y1901: {
		server: "hayabusa",
		place: "本館の　床下の　さらに　下",
		building: "well",
		route: [
			[110, 118],
			[110, 110],
		],
	},
	// 第三ルート：避難J（北東の 沖の 過疎板の 列）
	hinan: {
		server: "",
		place: "避難所の　テント",
		building: "tent",
		route: [
			[126, 108],
			[148, 88],
			[170, 66],
			[190, 46],
			[198, 30],
			[203, 18],
		],
	},
	main: {
		server: "awabi",
		place: "銭湯の　地下の　源泉",
		building: "bathhouse",
		route: [
			[124, 142],
			[152, 164],
			[176, 186],
		],
	},
};
