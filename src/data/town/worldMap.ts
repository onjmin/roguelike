// 全体マップ（おーぷん2ch の 地図）。島は おーぷんの サーバー（寿司ネタの 名前）で、
// 植民地は 実際に 置かれている サーバーの 島に 建つ（植民地一覧スレの URL より）。
// まん中の hayabusa に おんJ（おんJタウン）。座標は 地図の 画素（MAP_W × MAP_H）。ui/village/worldMap.ts が 描く。

import type { DungeonId } from "../../core/types";

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
	// おーぷぬ（だれでも 板を 立てられた。open.open2ch.net）。南西の 海に ちらばる 小島
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
	// 南の 海の おーぷぬの 板（だれでも 立てられる。おんJ関連板：マーキュリー・おんMu・おんキム・闇の板）
	{
		name: "",
		label: [0, 0],
		blobs: [
			[114, 198, 13],
			[98, 194, 8],
			[132, 206, 9],
			[122, 186, 6],
		],
	},
];

/** おんJタウン（おんJ）の 位置。道は ここから 出る。 */
export const VILLAGE_PT: Pt = [110, 128];

/** 建物の 絵の 種類（ui/village/worldMap.ts の drawBuilding）。 */
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
	| "studio";

export type ColonySpot = {
	/** 置かれている サーバー。 */
	server: string;
	/** 建物・地形（着いたときの 札に 出す）。 */
	place: string;
	building: BuildingKind;
	/** おんJタウンから 建物までの 道（最後の 点が 建物の 足もと）。 */
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
	// 束音ロゼの 依頼：ボカロ作り避難所（引き受けると 開く。北東の 島、きのこ板の 右下の 宅録スタジオ）
	vocalo: {
		server: "uni",
		place: "避難所の　スタジオ",
		building: "studio",
		route: [
			[126, 108],
			[148, 88],
			[160, 78],
			[176, 84],
		],
	},
	// 隠し：おんJタウンの 下の 古井戸（開くまで 地図に 出ない）
	hidden: {
		server: "hayabusa",
		place: "おんJタウンの　下の　古井戸",
		building: "well",
		route: [
			[106, 138],
			[98, 144],
		],
	},
	// おーぷぬの おんJ関連板（南の 海の 島）
	mercury: {
		server: "open",
		place: "水星の　観測所",
		building: "studio",
		route: [
			[110, 142],
			[108, 164],
			[100, 182],
			[98, 192],
		],
	},
	onmu: {
		server: "open",
		place: "沈んだ　大陸の　空港",
		building: "island",
		route: [
			[110, 142],
			[110, 164],
			[114, 182],
			[114, 200],
		],
	},
	onkimu: {
		server: "open",
		place: "管理部の　ビル",
		building: "building",
		route: [
			[110, 142],
			[110, 164],
			[120, 186],
			[132, 204],
		],
	},
	inferno: {
		server: "open",
		place: "闇の　塔",
		building: "lighthouse",
		route: [
			[110, 142],
			[110, 164],
			[122, 184],
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
