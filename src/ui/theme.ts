// 階の見た目（タイルシートの切り出し）。rpg と同じ同梱シート Base.png の「ダン 床・壁・階段」を使う。
//
// 壁は 3/4 見下ろしの2段（上の面・下の面）。床のすぐ上の壁マスに「下の面」、
// その上に「上の面」、それ以外の壁は闇の色で塗る。
// 階は 層（ZONES）に分かれていて、層ごとに 見た目・曲・ただよう粒 が変わる。

import type { DungeonId, TrapKind } from "../core/types";
import { type ThemeName, ZONE_NAMES, type ZoneSpec } from "../data/story";

const BASE = "pub:assets/rpg-reze/Base.png";
const cut = (c: number, r: number, w = 1, h = 1): string =>
	`${BASE}#${c * 16},${r * 16},${w * 16},${h * 16}`;

export type Theme = {
	name: string;
	/** 床（部屋も通路も同じ。通路の入口が壁に見えないように）。 */
	floor: string;
	stairs: string;
	wallUpper: string[];
	wallLower: string[];
	/** 壁の奥（闇）の色。 */
	dark: string;
	/** 画像が読めないときの床の色。 */
	floorColor: string;
	/** 見たことはあるが今は見えない所に重ねる色。 */
	fog: string;
};

const walls = (row: number): string[] =>
	[0, 1, 2, 3, 4, 5].map((x) => cut(x, row));

/** 土の洞窟（上層）。 */
const EARTH: Theme = {
	name: "earth",
	floor: cut(0, 162),
	stairs: cut(0, 163),
	wallUpper: walls(169),
	wallLower: walls(170),
	dark: "#0b0908",
	floorColor: "#6b5a3e",
	fog: "rgba(4, 3, 10, 0.58)",
};

/** 青い水晶（中層）。 */
const CRYSTAL: Theme = {
	name: "crystal",
	floor: cut(0, 164),
	stairs: cut(0, 165),
	wallUpper: walls(173),
	wallLower: walls(174),
	dark: "#05070e",
	floorColor: "#3c5a78",
	fog: "rgba(2, 3, 12, 0.6)",
};

/** 赤い溶岩（深層）。 */
const LAVA: Theme = {
	name: "lava",
	floor: cut(4, 162),
	stairs: cut(4, 163),
	wallUpper: walls(171),
	wallLower: walls(172),
	dark: "#0d0505",
	floorColor: "#6e3a2c",
	fog: "rgba(8, 2, 4, 0.6)",
};

/** 苔（緑）。 */
const MOSS: Theme = {
	name: "moss",
	floor: cut(4, 164),
	stairs: cut(4, 165),
	wallUpper: walls(175),
	wallLower: walls(176),
	dark: "#050a05",
	floorColor: "#3f5e34",
	fog: "rgba(2, 8, 4, 0.6)",
};

/** 電脳（紫）。 */
const CYBER: Theme = {
	name: "cyber",
	floor: cut(4, 166),
	stairs: cut(4, 167),
	wallUpper: walls(181),
	wallLower: walls(182),
	dark: "#07040d",
	floorColor: "#3a2a5a",
	fog: "rgba(6, 2, 14, 0.62)",
};

/** 最下層（金）。 */
const GOLD: Theme = {
	name: "gold",
	floor: cut(0, 168),
	stairs: cut(0, 167),
	wallUpper: walls(177),
	wallLower: walls(178),
	dark: "#0a0804",
	floorColor: "#7a6630",
	fog: "rgba(6, 4, 2, 0.58)",
};

/** 石組み（灰色。本編の 2つめの層。トルネコ1の 石組みのダンジョン）。 */
const STONE: Theme = {
	name: "stone",
	floor: cut(0, 166),
	stairs: cut(0, 167),
	wallUpper: walls(179),
	wallLower: walls(180),
	dark: "#070708",
	floorColor: "#55565c",
	fog: "rgba(3, 3, 8, 0.6)",
};

/** 朽ちた板張り（茶色のタイルに 土の壁。トルネコ1の くさった板のダンジョン）。 */
const RUINS: Theme = {
	name: "ruins",
	floor: cut(4, 168),
	stairs: cut(0, 163),
	wallUpper: walls(169),
	wallLower: walls(170),
	dark: "#0a0706",
	floorColor: "#6a5446",
	fog: "rgba(6, 3, 4, 0.6)",
};

/** 白（あぼーんの跡。白い床に 氷の壁）。 */
const WHITE: Theme = {
	name: "white",
	floor: cut(2, 168),
	stairs: cut(0, 165),
	wallUpper: walls(173),
	wallLower: walls(174),
	dark: "#06080c",
	floorColor: "#b8bcc4",
	fog: "rgba(4, 6, 14, 0.6)",
};

/** 赤い格子（紫の壁。もっと の 規制の檻）。 */
const LATTICE: Theme = {
	name: "lattice",
	floor: cut(6, 168),
	stairs: cut(4, 167),
	wallUpper: walls(181),
	wallLower: walls(182),
	dark: "#0c0408",
	floorColor: "#7a3038",
	fog: "rgba(8, 2, 8, 0.62)",
};

/** 焦げ（灰色の床に 赤い壁。もっと の 焦げた回線）。 */
const FORGE: Theme = {
	name: "forge",
	floor: cut(0, 166),
	stairs: cut(0, 167),
	wallUpper: walls(171),
	wallLower: walls(172),
	dark: "#0c0605",
	floorColor: "#4e4648",
	fog: "rgba(8, 2, 2, 0.6)",
};

/** 空気の中を ただようもの（階の雰囲気）。 */
export type Ambient =
	| "dust"
	| "spores"
	| "snow"
	| "data"
	| "embers"
	| "glitter";

/** 層：何階から何階までが同じ見た目・同じ曲か。深くなるほど 景色も曲も 出る敵も変わる。 */
export type Zone = {
	/** この層の いちばん深い階。 */
	last: number;
	name: string;
	theme: Theme;
	bgm: string;
	ambient: Ambient;
};

const THEMES: Record<ThemeName, Theme> = {
	earth: EARTH,
	stone: STONE,
	ruins: RUINS,
	white: WHITE,
	lattice: LATTICE,
	forge: FORGE,
	moss: MOSS,
	crystal: CRYSTAL,
	cyber: CYBER,
	lava: LAVA,
	gold: GOLD,
};

/** 物語の側（data/story.ts）の層の名前・見た目の名前 → 層。 */
const fromSpec = (list: readonly ZoneSpec[]): Zone[] =>
	list.map((z) => ({
		...z,
		theme: THEMES[z.theme],
		ambient: z.ambient as Ambient,
	}));

/**
 * 層の並び（ダンジョンごと。last の昇順で、最後の層は いちばん底の階で終わる）。
 * 本編は ここ、ちょっと・もっと の名前と見た目は data/story.ts。
 */
export const ZONES: Record<DungeonId, readonly Zone[]> = {
	shallow: fromSpec(ZONE_NAMES.shallow),
	// トルネコ1（27階）の 刻み（B1〜2・3〜4・5〜6 と 2階ずつ、そのあと 3階ずつ）を 20階に 縮めた 9層
	main: [
		{
			last: 2,
			name: "過去ログの浅瀬",
			theme: EARTH,
			bgm: "dungeon",
			ambient: "dust",
		},
		{
			last: 4,
			name: "dat の石室",
			theme: STONE,
			bgm: "stone",
			ambient: "dust",
		},
		{
			last: 6,
			name: "苔むしたスレ跡",
			theme: MOSS,
			bgm: "field",
			ambient: "spores",
		},
		{
			last: 9,
			name: "朽ちたまとめ跡",
			theme: RUINS,
			bgm: "ruins",
			ambient: "spores",
		},
		{
			last: 12,
			name: "凍結された書庫",
			theme: CRYSTAL,
			bgm: "field2",
			ambient: "snow",
		},
		// 名無し155さんの 手書きメロディの曲。アップテンポなので 序盤ではなく 中盤の 電子の廃墟に
		{ last: 15, name: "鯖の深部", theme: CYBER, bgm: "retro", ambient: "data" },
		{
			last: 17,
			name: "あぼーんの白野",
			theme: WHITE,
			bgm: "white",
			ambient: "snow",
		},
		{ last: 19, name: "炎上の底", theme: LAVA, bgm: "boss", ambient: "embers" },
		{
			last: 20,
			name: "はじまりの原盤",
			theme: GOLD,
			bgm: "lastboss",
			ambient: "glitter",
		},
	],
	deep: fromSpec(ZONE_NAMES.deep),
};

export const zoneFor = (dungeon: DungeonId, depth: number): Zone => {
	const list = ZONES[dungeon] ?? ZONES.main;
	return list.find((z) => depth <= z.last) ?? list[list.length - 1];
};

export const themeFor = (dungeon: DungeonId, depth: number): Theme =>
	zoneFor(dungeon, depth).theme;

/** 罠の見た目（見つけたものだけ描く）。罠の種類が ふえたら ここも（型で 抜けを見つける）。 */
export const TRAP_ICON: Record<TrapKind, string> = {
	bear: cut(5, 13), // とげの輪
	acid: cut(3, 189), // 緑の あわ
	sleep: cut(6, 13),
	trip: cut(0, 13), // 小石
	mine: cut(0, 250),
	arrow: cut(2, 187),
	dart: cut(3, 187), // 矢の罠の 色ちがい
	warp: cut(7, 13),
	pit: cut(2, 190),
};
