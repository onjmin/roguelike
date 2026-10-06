// 階の見た目（タイルシートの切り出し）。rpg と同じ同梱シート Base.png の「ダン 床・壁・階段」を使う。
//
// 壁は 3/4 見下ろしの2段（上の面・下の面）。床のすぐ上の壁マスに「下の面」、
// その上に「上の面」、それ以外の壁は闇の色で塗る。
// 階は 層（ZONES）に分かれていて、層ごとに 見た目・曲・ただよう粒 が変わる。

import { dungeonById } from "../core/data/dungeons";
import type { DungeonId, TrapKind } from "../core/types";
import { BOARD_LOOKS, DUNGEON_NAMES, type ThemeName } from "../data/story";

const BASE = "pub:assets/rpg-reze/Base.png";
/** 野外の シート（WOLF の 地形。砂浜の 砂だけ ここから）。 */
const FIELD = "pub:assets/rpg-reze/field.png";
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

/** 砂浜（field.png の 砂の まんなかの マスに 南国の 緑の 壁。離島・沖縄板）。 */
const BEACH: Theme = {
	name: "beach",
	floor: `${FIELD}#112,32,16,16`,
	stairs: cut(0, 163),
	wallUpper: walls(175),
	wallLower: walls(176),
	dark: "#050a05",
	floorColor: "#f4be8a",
	fog: "rgba(2, 6, 10, 0.58)",
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

/** 植民地の 見た目と 曲（last は いちばん 底の 階）。 */
export type Zone = {
	/** この層の いちばん深い階。 */
	last: number;
	name: string;
	theme: Theme;
	bgm: string;
	ambient: Ambient;
	/** 層に 入った 階の 札に 出す 1行（層の ある 板だけ）。 */
	note?: string;
};

const THEMES: Record<ThemeName, Theme> = {
	earth: EARTH,
	stone: STONE,
	ruins: RUINS,
	white: WHITE,
	beach: BEACH,
	lattice: LATTICE,
	forge: FORGE,
	moss: MOSS,
	crystal: CRYSTAL,
	cyber: CYBER,
	lava: LAVA,
	gold: GOLD,
};

/** 植民地ごとの 見た目と 曲（板ごとに 1つ。全フロア 同じ。data/story.ts の BOARD_LOOKS）。 */
const lookOf = (dungeon: DungeonId): Zone => {
	const d = dungeonById(dungeon);
	const look = BOARD_LOOKS[d.id];
	return {
		last: d.floors,
		name: DUNGEON_NAMES[d.id].name,
		theme: THEMES[look.theme],
		bgm: look.bgm,
		ambient: look.ambient as Ambient,
	};
};

/**
 * その階の 見た目と 曲。植民地は 板ごとに 1つ（depth は 見ない）。層の ある 板（隠しの 過去ログの底）は
 * 深さで 変わる。
 */
export const zoneFor = (dungeon: DungeonId, depth = 1): Zone => {
	const zones = BOARD_LOOKS[dungeonById(dungeon).id].zones;
	if (!zones?.length) return lookOf(dungeon);
	const z = zones.find((x) => depth <= x.last) ?? zones[zones.length - 1];
	const i = zones.indexOf(z);
	const first = i > 0 ? zones[i - 1].last + 1 : 1;
	return {
		last: z.last,
		name: z.name,
		note: depth === first ? z.note : undefined,
		theme: THEMES[z.theme],
		bgm: z.bgm,
		ambient: z.ambient as Ambient,
	};
};

export const themeFor = (dungeon: DungeonId, depth: number): Theme =>
	zoneFor(dungeon, depth).theme;

/** 罠の見た目（見つけたものだけ描く）。罠の種類が ふえたら ここも（型で 抜けを見つける）。 */
export const TRAP_ICON: Record<TrapKind, string> = {
	bear: "pub:sprites/traps.png#0,0,16,16", // 口を 開けた 鉄の あご（scripts/make-traps.mjs）
	acid: "pub:sprites/traps.png#16,0,16,16", // 緑の 酸の 水たまり（scripts/make-traps.mjs）
	sleep: "pub:sprites/traps.png#32,0,16,16", // 噴き出し口と 紫の 眠りガス（scripts/make-traps.mjs）
	trip: "pub:sprites/traps.png#48,0,16,16", // 床から 突き出た 石（scripts/make-traps.mjs）
	mine: "sp:eqO76tJ", // RPGEN「ロビー地雷(埋設)」
	arrow: "pub:sprites/traps.png#64,0,16,16", // 石の 踏み板と 矢（scripts/make-traps.mjs）
	dart: "pub:sprites/traps.png#80,0,16,16", // 矢の罠の 毒の 矢じり版（scripts/make-traps.mjs）
	warp: "pub:sprites/traps.png#96,0,16,16", // 青く 光る 輪（scripts/make-traps.mjs）
	pit: "sp:87bRbg", // RPGEN「落とし穴」
	anka: "pub:sprites/anka_trap.png#0,0,16,16", // >> の 踏み板（scripts/make-anka-trap.mjs）
};

/** 踏んだ あとの 安価の罠（沈んで >> が 赤く 光る。Floor.pressed）。 */
export const ANKA_PRESSED = "pub:sprites/anka_trap.png#16,0,16,16";
