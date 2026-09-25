// 階の見た目（タイルシートの切り出し）。rpg と同じ同梱シート Base.png の「ダン 床・壁・階段」を使う。
//
// 壁は 3/4 見下ろしの2段（上の面・下の面）。床のすぐ上の壁マスに「下の面」、
// その上に「上の面」、それ以外の壁は闇の色で塗る。
// 階は 層（ZONES）に分かれていて、層ごとに 見た目・曲・ただよう粒 が変わる。

import type { DungeonId } from "../core/types";
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
	main: [
		{
			last: 4,
			name: "過去ログの浅瀬",
			theme: EARTH,
			bgm: "dungeon",
			ambient: "dust",
		},
		{
			last: 8,
			name: "苔むしたスレ跡",
			theme: MOSS,
			bgm: "field",
			ambient: "spores",
		},
		{
			last: 12,
			name: "凍結された書庫",
			theme: CRYSTAL,
			bgm: "field2",
			ambient: "snow",
		},
		{ last: 16, name: "鯖の深部", theme: CYBER, bgm: "tense", ambient: "data" },
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

/** 罠の見た目（見つけたものだけ描く）。 */
export const TRAP_ICON: Record<string, string> = {
	pit: cut(2, 190),
	mine: cut(0, 250),
	arrow: cut(2, 187),
	sleep: cut(6, 13),
	spin: cut(7, 13),
	warp: cut(7, 13),
	rust: cut(4, 187),
	hunger: cut(6, 187),
	summon: cut(0, 187),
};
