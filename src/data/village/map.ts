// 村（おんJタウン）の地図。DOM も保存も使わない 組み立てだけ（src/sim/villageTests.ts で 形と 歩ける道を 調べる）。
// スクリプトは ui/village/villageEvents.ts が id ごとに 付ける。
//
// 地図は 63×52 マス（1文字 = 16px の 1マス）。港（南）から 山（北）への 坂の 町（TOWN.md §0）。
// まんなかに 町の 区画（22×18）を 置く（OX, OY だけ ずらす）。西の 空き地・東の 商店街・北の 丘・
// 南の 池と 浜へ 抜けられる（OUTSKIRTS_ROWS・EDGE_CELLS）。下の 図と 区画の 関数は 町の 区画の 座標で、
// VILLAGE_SPOTS と 住人の 家（data/people/mobs.ts の spot）は 地図の 座標（区画の 座標 ＋ 9, 7）。
// - 北に 崖。まんなかに おんJ 本館（縦の 道が 扉 10〜11 に 突きあたる。段で 集会所 幅4 → レンガ 幅6 → 本館 幅10。
//   扉を 踏むと 中の 地図へ。中は data/village/hall.ts）。
//   東の 崖の 切れ目を 道が 北の 丘へ 抜ける。村の 出口は 南の 桟橋の 先（港）だけ。出口を 踏むと 全体マップで 行き先の 板を 選ぶ。
// - 崖の下に 道（区画 y=4）。そこから 町の 通り（y=12）まで 道（x=10〜11）が のびる。
// - 西に 店の区画（x=1〜8）、まんなかに 小屋（x=12〜15）、東に 倉庫の区画（x=16〜20）。その下が 広場（掲示板・蓄音機）。
//   売り場は「囲い（y=10。売る人が立つ）＋ 台（y=11）」。キリコは 通り（y=12）から 台ごしに 話しかける。
//   常識堂の 奥・倉庫の 扉は 台の 横の 細道の 奥（常識堂は 右・倉庫は 左）。踏むと 中へ（data/village/rooms.ts）。
// - やきうは 小屋の前（12,11）で 大工。人は 町の段と 役目で 立つ（5人とも はじめから いる）。段7 は 野次馬が 3人。
// - おんJマイナーズ（data/people/mobs.ts）は 町が 育つと 1人ずつ 越してくる。ぷゆゆは 段0 から 広場の 下を うろうろ。
// - 町の まわりも 段で かわる：段2 で 北西の 森に おんJ神社（おみくじ）、
//   段3 で 池の そばに 音楽室、段5 で 西の 空き地に 喫茶。銭湯は 東の 商店街の 南に いつも ある。
// - 帰ってきたとき 仲間が 出口の前に 並ぶ マス（lineupSpots）と、町が 育ったとき カメラを 向ける 所（VILLAGE_SPOTS.growth）。
//
// 段ごとの 区画（前の段の物は 形を かえて 残る）
//   店   0 空き地（ロゼと 麻婆豆腐の鍋）  1 屋台（台と品物・本の看板）  2〜4 日よけ・ランプ・木箱
//        5〜6 小さな店（常識堂。白い壁・赤い屋根）  7 2階建ての 大きな店（窓の花・ちょうちん）
//   小屋 3〜 わら屋根・煙突（6〜 窓の下に 花の箱。7 灰色の 瓦屋根・黄色い 板壁＝tiles.ts の HUT_CITY）
//   倉庫 2〜3 小さな 物置  4〜5 板張りの 倉庫  6 石造りの 倉庫  7 銀行（貸金庫）。シヨが 台の うしろに 立つ
//   道   0〜4 土  5〜 石だたみ（広場も 石畳に。井戸）。6〜 花。7 桜と 野次馬
//   中心 6 住宅街（通りに 路側帯・マンホール・電柱、本館への 道は 2車線、広場の 南に 刈りこんだ 生け垣）
//        7 都市（歩道・レンガの 広場・遊歩道・横断歩道・信号機・街灯、崖は 擁壁、池は 柵。区画の あと coreCity が 書きかえる）
//
// 段7 の 町の 区画の 形（ほかの段は 区画を 差しかえる。@ は 人と 蓄音機。字は data/village/tiles.ts）
//    0123456789012345678901
//  0 111111##########1A.V11  崖の上・本館の 屋根（段6〜 は 幅10）
//  1 2y2222++++++++++2D.j22  崖のふち（y 桜）
//  2 3333330$0$00$0$03F.s33  岩肌・本館の 壁（ちょうちん）
//  3 44444466665566664I.t44  本館の 扉（10〜11。踏むと 中へ）・崖の 切れ目（18,3 が 村の 出口。立て札 19,5）
//  4 H....................H  崖の下の道
//  5 h,nnnnnn,,..,,,,,,,,,h  店の 屋根                  （倉庫が 建つまで シヨ 17,5）
//  6 H,NNNNNN,,..,,,,rrrrrH                               倉庫の 屋根
//  7 h,ffOfff,,..,,,,RRRRRh  2階（窓の花・本の看板）
//  8 H,l((wl(,,..,Cz,{{{g{H  1階（ちょうちん）  小屋（煙突）  倉庫の 壁（袋の看板）
//  9 h,)))aad,,..,ZZ,7}}}}h  日よけ・勝手口 7,9            倉庫の 扉 16,9
// 10 H,X,@,L,,,..*J[,,x@,xH  ロゼ 4,10                    シヨ 18,10
// 11 h,XqQ>u,,,..@Ee&,<->xh  台           やきう 12,11・小屋の扉 14,11
// 12 H....................H  町の通り
// 13 h,,,::::::..::::::@,,h  広場（野次馬）
// 14 H,Y,::Kk@:@::::U::,Y,H  まとめ掲示板 6..7・ゼロ 8・蓄音機 10・井戸 15
// 15 h,,,:@::::::::::@:,,,h  キリコ（起きる所）10・フェリス 16
// 16 H*,,,,,,@,,,,@,,,,,,*H  ぷゆゆ 8（うろうろ）
// 17 HhHhHhHhHhHhHhHhHhHhHh

import { TOWN_STAGES } from "../../core/town";
import type { DungeonId } from "../../core/types";
import type { TileDef } from "../../engine/defs";
import type { Dir } from "../../engine/types";
import { CAST, YAJI_WALK } from "../people/cast";
import { MOB_IDS, MOBS, type MobId } from "../people/mobs";
import { shiyoAtMaid } from "../people/shiyoShift";
import { BOOKSTORE_FROM, LIBRARY_FROM } from "../story/glossary";
import type { Speaker } from "../story/quotes";
import { nowHour, today } from "../town/calendar";
import {
	activeIncidents,
	activeVisitors,
	incidentPlaceId,
} from "../town/incidents";
import { type CorePlace, isRevived, revivedBoards } from "../town/revival";
import {
	doorId,
	facilitiesAt,
	facilityBlock,
	facilityDoor,
	facilityDoor2,
	facilityTiles,
	outdoorId,
	stampFacilities,
} from "./facilities";
import { folkPlaces } from "./folk";
import { ROOM_FROM } from "./rooms";
import { art, ri } from "./rpgenArt";
import {
	ASPHALT,
	BANK,
	BATH,
	BEACH,
	BOOKS,
	BRICK,
	base,
	basePx,
	big,
	C_ASPHALT,
	C_BRICK,
	C_DIRT,
	C_GRASS,
	C_PLAZA,
	C_STONE,
	CAFE,
	CITY,
	CITY_CLIFF,
	CITY7,
	CLIFF,
	DIRT,
	FARM,
	floor,
	GROUND,
	HUT,
	HUT_CITY,
	hallTier,
	hallTiles,
	MUSIC,
	OUTSKIRTS,
	PLAZA,
	ROADS,
	SHED,
	SHOP,
	SHRINE,
	STALL,
	STONE,
	STOREHOUSE,
	solid,
	TURF,
} from "./tiles";

export const VILLAGE_W = 63;
export const VILLAGE_H = 52;

/**
 * 町（22×18 の 区画。下の 図の 座標）を 地図の どこに 置くか。まわりは 森で、西の 空き地・東の 商店街・
 * 南の 池へ 抜けられる（OUTSKIRTS）。VILLAGE_SPOTS と 住人の 家（data/people/mobs.ts の spot）は 地図の 座標。
 */
const OX = 9;
const OY = 7;
const TOWN_W = 22;
const TOWN_H = 18;

/**
 * 村の形を決める物（町の段・開いたダンジョン・持ち帰ったダンジョン）。
 * 町は はじめから 都市の 姿（ui/village/villageReturn.ts の villageView は stage を いちばん上に する）。
 * 開いて いる 店は 持ち帰った 板で 決まる（data/town/revival.ts）。
 */
export type VillageView = {
	stage: number;
	unlocked: readonly DungeonId[];
	cleared: readonly DungeonId[];
};

export type Cell = readonly [x: number, y: number];

/** 村の 決まった場所。 */
export const VILLAGE_SPOTS = {
	/** 町の 出口（桟橋の 先の 港。船で 全体マップの 板へ 出る）。はじめの 場面・開いた 知らせで 見る 所。 */
	exit: [20, 51] as Cell,
	/** 出口の 立て札（桟橋の 付け根の 砂浜。板の 札を 読む）。 */
	exitSign: [21, 35] as Cell,
	/** 喫茶「おんJ」の 扉（段5 から。踏むと 中へ。data/village/rooms.ts）。 */
	cafeDoor: [4, 18] as Cell,
	/**
	 * おんJ 本館の 扉（2マス。踏むと 中へ。data/village/hall.ts）。出てくると 入った 扉の 1つ下（崖の 下の 道）。
	 */
	hallDoors: [
		[19, 10],
		[20, 10],
	] as readonly Cell[],
	/** 本館の 形が かわったとき（段3・6）カメラを 向ける 所（2つの 扉の あいだの 壁）。 */
	hallLook: [19.5, 9] as Cell,
	/** 起きたとき・倒れて もどったときに 立つ所（蓄音機の前）。 */
	boot: [19, 22] as Cell,
	phono: [19, 21] as Cell,
	/** まとめ掲示板（2マス）。 */
	board: [
		[15, 21],
		[16, 21],
	] as readonly Cell[],
	/** ゼロ（ライバル。3機で 町を 数える ラボの そば。店の 仕事は しない：TOWN.md §0.4）。 */
	zero: [26, 23] as Cell,
	/** 広場の 井戸（段5 から）。過去ログの底へは ここから 降りる。 */
	well: [24, 21] as Cell,
	/** フェリス（ライバル。海の家の ステージで 不死鳥アイドル。店の 前の 砂浜）。 */
	feris: [12, 35] as Cell,
	/** ロゼ（ライバル。スタジオ帰りに 広場の 西で 休む）。 */
	roze: [8, 20] as Cell,
	/** シヨ（ライバル。自宅スタジオの そば）。 */
	shiyo: [28, 22] as Cell,
	/** やきう（町に 残った 名無し。家の 前）。 */
	nanj: (_v: VillageView): Cell => [21, 18],
	/** 音楽室「ピアノ機能」の 扉（段3 から。週末だけ 踏むと 中へ）。 */
	musicDoor: [22, 28] as Cell,
	/** 本屋（段3〜5）・図書館（段6 から。同じ 所に 建てかえ）の 扉。下の 草地 y=23 から 踏む。 */
	booksDoor: [4, 22] as Cell,
	/** おんJ神社の 賽銭箱（段2 から。お参りすると おみくじ）。 */
	shrine: [3, 9] as Cell,
	/** 銭湯の のれんの 扉（踏むと 中へ。data/village/rooms.ts の bath）。 */
	bath: [35, 29] as Cell,
	/** 小屋の扉（段3から。踏むと 中へ）。 */
	hutDoor: [23, 18] as Cell,
	/** 倉庫の 扉（段2 から。台の 左の 細道の 奥。踏むと 中へ。出ると 1つ下）。 */
	storeDoor: [25, 16] as Cell,
	/** 常識堂の 勝手口（段5 から。台の 右の 細道の 奥。踏むと 奥へ。出ると 1つ下）。 */
	shopDoor: [16, 16] as Cell,
	/** 段7 の 野次馬（うろうろ する）。 */
	yaji: [
		[14, 22],
		[22, 23],
		[27, 20],
	] as readonly Cell[],
} as const;

/** 地図の形に使う 町の段（0〜7 に 丸める）。 */
export const layoutStage = (v: VillageView): number =>
	Math.max(0, Math.min(TOWN_STAGES - 1, Math.floor(v.stage) || 0));

// ───────────────── 行 ─────────────────

// まんなかに おんJ 本館（hallBlock。縦の 道が 扉に 突きあたる）。東（x=18）の 崖の 切れ目が 村の 出口
const CLIFF_ROWS: readonly string[] = [
	"11111111111111111A.V11",
	"22222222222222222D.j22",
	"33333333333333333F.s33",
	"44444444444444444I.t44",
];

/**
 * おんJ 本館の 外観（崖の 4段に はめこむ。扉 5 は いつも 区画の 10〜11）。本館の 段（hallTier）で 横に 広がる：
 * 集会所 幅4（x=9〜12）・レンガ 幅6（8〜13）・本館 幅10（6〜15）。下へは のばせない（崖の 下は 道）。
 */
const hallBlock = (stage: number): { x: number; rows: readonly string[] } =>
	[
		{ x: 9, rows: ["####", "++++", "$00$", "6556"] },
		{ x: 8, rows: ["######", "++++++", "0$00$0", "665566"] },
		{
			x: 6,
			rows: ["##########", "++++++++++", "0$0$00$0$0", "6666556666"],
		},
	][hallTier(stage)];
/** 崖の下の道（y=4）と 町の通り（y=12）。 */
const ROAD = "H....................H";
/** 崖の下から 通りの上まで（y=5〜11）。空き地（雑草）。x=10〜11 は 道。 */
const LOT_ROWS: readonly string[] = [
	"h,,v,,,,,,..,,,,,,,v,h",
	"H,,,,,,v,,..,,,v,,,,,H",
	"h,v,,,,,,,..,,,,,,,,,h",
	"H,,,,,v,,,..,,v,,,,v,H",
	"h,,,v,,,,,..,,,,,,,,,h",
	"H,,,,,,,v,..,,,,v,,,,H",
	"h,,,,,,,,,..,,,,,,,,,h",
];
/** 広場（y=13〜16）。4段までは 草、5段から 石畳と 井戸、7段は 桜と 花。 */
const plazaRows = (stage: number): string[] =>
	stage >= 7
		? [
				"h,,,::::::..::::::,,,h",
				"H,Y,::Kk:::::::U::,Y,H",
				"h,,,::::::::::::::,,,h",
				"H*,,,,,,,,,,,,,,,,,,*H",
			]
		: stage >= 5
			? [
					"h,,,::::::..::::::,,,h",
					"H,T,::Kk:::::::U::,T,H",
					"h,,,::::::::::::::,,,h",
					"H,,,,,,,,,,,,,,,,,,,,H",
				]
			: [
					"h,,,,,,,,,,,,,,,,,,,,h",
					"H,T,,,Kk,,,,,,,,,,,T,H",
					"h,,,,,,,,,,,,,,,,,,,,h",
					"H,,,,,,,,,,,,,,,,,,,,H",
				];
const BOTTOM = "HhHhHhHhHhHhHhHhHhHhHh";

// ───────────────── 区画（" " は 下の 空き地を そのまま 残す） ─────────────────

/** 店の区画（x=1〜8, y=5〜11）。 */
const shopBlock = (stage: number): readonly string[] => {
	if (stage === 0)
		// ロゼ（4,11）と 麻婆豆腐の鍋
		return ["", "", "", "", "", "", "    u   "];
	if (stage === 1)
		// 屋根の ない 屋台（台と 品物、本の 立て看板、鍋）
		return ["", "", "", "", "  ,,,   ", " b,,,o, ", " bqQ>u, "];
	if (stage <= 4)
		// 日よけ（柱つき）・その上に 本の看板・ランプ・木箱
		return ["", "", "", "  ,o,   ", "  ccc   ", " bp,PL, ", " bqQ>ux "];
	if (stage <= 6)
		// 小さな店（常識堂）。勝手口は 右はし（台の 右の 細道から 踏む。囲いは ランプと 鍋で とじる）
		return [
			"",
			" nnnnnn ",
			" NNNNNN ",
			" ((O(w( ",
			" )))aad ",
			" X,,,L, ",
			" XqQ>u, ",
		];
	// 2階建ての 大きな店（右の ちょうちんは 勝手口の 絵に かからないよう 1つ 左）
	return [
		" nnnnnn ",
		" NNNNNN ",
		" ffOfff ",
		" l((wl( ",
		" )))aad ",
		" X,,,L, ",
		" XqQ>u, ",
	];
};

/** 小屋の区画（x=12〜15, y=8〜11）。段3から。煙突は 棟に 重ねる。 */
const hutBlock = (stage: number): readonly string[] => {
	if (stage < 3) return [];
	const low = stage >= 6 ? " Ee " : " ]e ";
	return [" Cz ", " ZZ ", " J[ ", low];
};

/** 倉庫の区画（x=16〜20, y=5〜11）。段2から（物置 → 倉庫 → 石造り → 銀行）。 */
const storeBlock = (stage: number): readonly string[] => {
	if (stage < 2) return [];
	// 扉は 左はし（台の 左の 細道から 踏む）。囲いは 木箱で とじる（シヨの 左右へは 入れない）
	const stall = [",x,,x", ",<->x"];
	// 小屋ていどの 物置（屋根と 扉だけ）
	if (stage <= 3) return ["", "", "", "rrrr ", "7}}} ", ...stall];
	if (stage <= 5) return ["", "rrrr ", "RRRR ", "{{{g ", "7}}} ", ...stall];
	return ["", "rrrrr", "RRRRR", "{{{g{", "7}}}}", ...stall];
};

/** そのマスの文字を 差しかえる。 */
const put = (rows: string[], [x, y]: Cell, ch: string): void => {
	const r = [...rows[y]];
	r[x] = ch;
	rows[y] = r.join("");
};

/** (x0, y0) から 区画を 重ねる（" " と 行の 足りない所は そのまま）。 */
const stamp = (
	rows: string[],
	x0: number,
	y0: number,
	block: readonly string[],
): void => {
	block.forEach((line, dy) => {
		[...line].forEach((ch, dx) => {
			if (ch !== " ") put(rows, [x0 + dx, y0 + dy], ch);
		});
	});
};

/** 森（村の まわり）の 木と しげみ（決まった 並び。乱数は 使わない）。 */
const forestAt = (x: number, y: number): string =>
	(x * 3 + y * 5) % 7 === 0 ? "^" : (x + y * 2) % 3 === 0 ? "T" : "b";

/**
 * 村の まわりに 置く 物（地図の 座標 x, y から 右へ 字の 並び）。字は data/village/tiles.ts の OUTSKIRTS。
 * 北の 丘（崖の 切れ目の 上）、西の 空き地（切り株・丸太・花）、東の 商店街、南の 池。
 */
const OUTSKIRTS_ROWS: readonly [number, number, string][] = [
	// 北の 丘（部室棟・分譲住宅・立ち食いそば・グラウンド。道は 丘の 上で 行きどまり）
	[27, 0, ","],
	[26, 1, ",.,"],
	[22, 2, ",,*,,.;,,"],
	[20, 3, ",,,,Y,,.,,*,"],
	[8, 4, ",,,,,,,,,,,,,,,,,,,*,,,,,.,,,,b"],
	[20, 5, ",,,,=,,.,,;,"],
	[21, 6, ",,,,,,.,,,"],
	// 西の 空き地
	[2, 15, ",,,,,,"],
	[1, 16, ",=,,;,,"],
	[1, 17, ",,_,,,v,"],
	[1, 18, ";,,,*,,,"],
	[1, 19, "........"],
	[1, 20, ",,v,,%,,"],
	[1, 21, ",*,,,,,,"],
	[2, 22, ",,B,,;"],
	[3, 23, ",,,,"],
	// 東の 商店街（x=31〜61。y=19 は 町の 通りの 続き、店先は レンガ。店は data/village/facilities.ts の MOVED）
	...Array.from({ length: 21 }, (_, i): [number, number, string] => [
		31,
		11 + i,
		i === 8 ? ".".repeat(31) : ":".repeat(31),
	]),
	// 北東の 丘（リサイクル・質屋。グラウンドの 東）
	...Array.from({ length: 8 }, (_, i): [number, number, string] => [
		39,
		3 + i,
		",".repeat(23),
	]),
	// 南の 池
	[10, 25, ",,%,,,,,,,.,,,;,,,*,,"],
	[10, 26, ",~~~~~,,,,.,,,,,~~~,,"],
	[10, 27, "~~~~~~~,,;.,,&,~~~~~,"],
	[10, 28, ",~~~~~~,,,.,,,,,~~~,,"],
	[10, 29, ",,~~~,,B,,.,,=,,,,,,,"],
	[11, 30, ",,,,,,,,,.,,,,,,,"],
	[10, 31, ",,,,,,,,,,.,,,,,,,,,"],
];

/**
 * 南の 浜（地図の y=32〜51。hayabusa 島の 南の 岸。STORY.md §5.7）。字は data/village/tiles.ts の BEACH。
 * 池の 下の 道が 砂浜へ 抜け、まんなかの 桟橋（x=20）が 海へ のびる。桟橋の 先（20,51）が 南の 出口＝港
 * （おーぷぬの 南の 島の 板へは 船で わたる）。先の 5×3 は 船着き場（帰ってきた ときに 仲間が 並べる 広さ）。
 */
const SHORE_ROWS: readonly string[] = [
	"TbさささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささbT",
	"bささやさささなささささささなささささささささささささなさささやささささなささささささささなささささささやさささささなさささささささやささささささなささささささやさささささb",
	"さささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささささ",
	"ささなさささささささささささささささささささささささなささささささささささささささささささささささなささささささささささささささささささささなささささささささささささささささ",
	"ささいささささささささささささささささささささささささささささささささささささささささささささいささささささささささささいささささささささささささささささいさささささささささ",
	"ううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううう",
	"ううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううう",
	"ううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううう",
	"ううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううう",
	"ううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううう",
	"ううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううう",
	"ううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううう",
	"ううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううう",
	"ううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううう",
	"ううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううう",
	"ううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううう",
	"ううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううう",
	"ううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううう",
	"ううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううう",
	"ううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううううう",
];
const SHORE_Y = 32;
/** 桟橋（x=20 を 砂浜の へり y=36 から 港 y=51 まで。先の 5×3 は 船着き場：帰ってきた ときに 仲間が 並ぶ）。 */
const PIER_CELLS: readonly Cell[] = [
	...Array.from({ length: 13 }, (_, i): Cell => [20, 36 + i]),
	...[49, 50, 51].flatMap((y) => [19, 20, 21, 22, 23].map((x): Cell => [x, y])),
];

/**
 * 町の 区画の へりを 開ける・木を 植える（地図の 座標）。四角く 見えないように、生け垣を ところどころ
 * 抜いて まわりへ つなぎ、残りも 木や しげみに かえる。
 */
const EDGE_CELLS: readonly [number, number, string][] = [
	// 西：町の 通りと 広場から 空き地へ
	[9, 18, ","],
	[9, 19, "."],
	[9, 20, ","],
	[9, 21, ","],
	[9, 13, "T"],
	[9, 15, "b"],
	[9, 23, "T"],
	// 東：崖下の 道・町の 通りから 畑へ
	[30, 11, "."],
	[30, 12, ","],
	[30, 13, ","],
	[30, 17, ","],
	[30, 18, ","],
	[30, 19, "."],
	[30, 20, ","],
	[30, 15, "T"],
	[30, 22, "^"],
	// 南：広場の 下から 池へ
	[18, 24, ","],
	[19, 24, ","],
	[20, 24, "."],
	[21, 24, ","],
	[11, 24, "T"],
	[14, 24, "^"],
	[24, 24, "T"],
	[27, 24, "b"],
];

/** 通りの マンホール。 */
const MANHOLES: readonly Cell[] = [
	[13, 11],
	[25, 11],
	[6, 19],
	[14, 19],
	[25, 19],
	[35, 19],
];
/** 住宅街（段6）の 電柱（通りの わきの 草地）。 */
const CORE_POLES: readonly Cell[] = [
	[12, 12],
	[17, 12],
	[22, 12],
	[26, 12],
	[21, 15],
	[8, 18],
	[18, 18],
	[30, 18],
	[36, 20],
];
/** 住宅街（段6）の 広場の 南の 刈りこんだ 生け垣（y=24。" " は そのまま）。 */
const CORE_HEDGE6 = "  マム マミム    マム マミミミム";
/** 都市（段7）の 池（柵で 囲った 四角い 池。岩・切り株は 片づける）。地図の x, y から 右へ。 */
const CITY_PONDS: readonly (readonly [number, number, string])[] = [
	[10, 25, "ヤメメメメメメユ"],
	[24, 25, "ヤメメメメユ"],
	[10, 26, "モ~~~~~~モ"],
	[24, 26, "モ~~~~モ"],
	[10, 27, "モ~~~~~~モ,,"],
	[24, 27, "モ~~~~モ"],
	[10, 28, "モ~~~~~~モ"],
	[24, 28, "ヨメメメメロ"],
	[10, 29, "ヨメメメメメメロ"],
	[23, 29, ","],
	[13, 30, "ヘホ"],
];
/** 縦に 並べる（x, 上の y, 上から 字）。 */
const down = (x: number, y0: number, s: string): [number, number, string][] =>
	[...s].map((ch, i) => [x, y0 + i, ch]);
/** 都市（段7）に 置く 物（地図の x, y から 右へ 字。" " は そのまま）。 */
const CITY_CELLS: readonly (readonly [number, number, string])[] = [
	// 擁壁の はし（町の 区画の 両はし）・本館の 両わきの 柵の はし
	...down(9, 7, "Vjst"),
	...down(30, 7, "ADFI"),
	[14, 8, "ガ"],
	[25, 8, "グ"],
	// 区画の へりの 刈りこんだ 生け垣（縦）
	...down(9, 11, "ザジジジジジズ"),
	...down(9, 22, "ザジズ"),
	...down(30, 14, "ザジズ"),
	...down(30, 21, "ザジジズ"),
	// 広場の 南の 植えこみ（両はしに 街灯、まんなかは 池への 道）
	[10, 24, "ギべぺぽゾべぽぼ::ゆ:ぼべぽゼべぺぽギ"],
	// 広場の 桜は 根元に 格子・角は レンガ・店先に 花の 鉢
	[11, 21, "ぷ"],
	[28, 21, "ぷ"],
	[10, 23, ":"],
	[29, 23, ":"],
	[21, 17, "ぶ"],
	[24, 18, "ぶ"],
	// 横断歩道と その 前の 点字ブロック（本館の 扉・出口の 立て札・広場へ わたる 所）
	[19, 11, "わわ"],
	[27, 11, "わ"],
	[19, 19, "わわ"],
	[19, 12, "ぴぴ"],
	[19, 18, "ぴぴ"],
	[19, 20, "ぴぴ"],
	// 信号機・街灯（歩道と 広場）・池の まわりの 道の 街灯（草地）
	[18, 12, "ゔ"],
	[21, 12, "ゔ"],
	[18, 18, "ゔ"],
	[21, 20, "ゔ"],
	[10, 12, "ゃ"],
	[23, 12, "ゃ"],
	[26, 12, "ゃ"],
	[18, 14, "ゲ"],
	[21, 14, "ゲ"],
	[13, 20, "ゃ"],
	[24, 20, "ゃ"],
	[8, 18, "ゃ"],
	[19, 27, "ゲ"],
	[21, 30, "ゲ"],
	// ベンチ・のぼり・自転車
	[11, 23, "ダヂ"],
	[27, 23, "ダヂ"],
	[17, 17, "パ"],
	[10, 13, "デ"],
	[10, 14, "ド"],
	// 西の 空き地・擁壁の 上の 切り株と 草を 片づける（花と 桜は 残す）
	[6, 20, ","],
	[7, 17, ","],
	[7, 22, ","],
	[24, 5, ","],
	[28, 2, ","],
	[30, 5, ","],
];

/**
 * 町の 中心（本館・広場・商店街と すぐ まわり）の 都市化（地図の 座標。TOWN.md）。段5 までは 何も しない。
 * 字と 絵は data/village/tiles.ts の CITY（CITY_CLIFF・HUT_CITY・CITY7 は 段7 の パレットで 上書き）。
 * - 住宅街（段6）：崖下の 道と 町の 通りに 路側帯（ゑ）と マンホール（ヴ）、本館への 道は 2車線（る れ）、
 *   通りの わきに 電柱、広場の 南は 刈りこんだ 生け垣。
 * - 都市（段7）：電柱を 抜いて（無電柱化）歩道・レンガの 広場、本館への 道は 点字ブロックの ある 遊歩道、
 *   横断歩道・信号機・街灯・ベンチ・植えこみ・自転車・のぼり。崖は 擁壁（上は 歩道）、池は 柵で 囲う。
 * 段の 区画を 敷いた あと・施設の 前に 置く（施設は 自分の マスを 上書きする。郵便ポスト・時計などは facilities.ts）。
 * 歩ける 道は 残す：東の 広場の すみへは (26,20)・(29,20)、神社へは x=7 の y=15〜18、図書館・碁会所へは (6,22)・(6,23)、
 * バス停は (30,20)、出口の 立て札は (27,12) から 調べる。ここに 物を 置かない。
 */
const coreCity = (rows: string[], stage: number): void => {
	if (stage < 6) return;
	const at = (x: number, y: number) => [...rows[y]][x];
	// 崖下の 道（y=11）と 町の 通り（y=19）に 路側帯。本館への 道・出口への 道と 交わる 所は そのまま
	for (let x = 10; x <= 29; x++)
		if (at(x, 11) === "." && ![19, 20, 27].includes(x))
			put(rows, [x, 11], "ゑ");
	put(rows, [30, 11], "ゑ");
	for (let x = 0; x <= 39; x++)
		if (at(x, 19) === "." && ![19, 20].includes(x)) put(rows, [x, 19], "ゑ");
	for (const c of MANHOLES) put(rows, c, "ヴ");
	if (stage < 7) {
		// 本館への 道は 2車線・電柱・生け垣
		for (let y = 12; y <= 18; y++) {
			put(rows, [19, y], "る");
			put(rows, [20, y], "れ");
		}
		for (const c of CORE_POLES) put(rows, c, "ぢ");
		stamp(rows, 10, 24, [CORE_HEDGE6]);
		return;
	}
	// 歩道（通りに 面した 草地だけ：崖下の 道の 下 y=12・町の 通りの 上 y=18。あいだの 芝は 残す。
	// みんな 歩道に すると 歩道ばかりに 見えた：作者の 指示）・西の 空き地の 入り口・広場の 北の へり
	for (const y of [12, 18])
		for (let x = 9; x <= 30; x++) if (at(x, y) === ",") put(rows, [x, y], "ゆ");
	put(rows, [7, 18], "ゆ");
	put(rows, [8, 18], "ゆ");
	stamp(rows, 7, 20, ["ゆ".repeat(24)]);
	// 広場は 草も 道も レンガ
	for (let y = 21; y <= 23; y++)
		for (let x = 9; x <= 29; x++)
			if ([",", ".", ":"].includes(at(x, y))) put(rows, [x, y], ":");
	// 本館への 道は レンガの 遊歩道。北の 丘の 道・南の 池への 道は 歩道
	for (let y = 13; y <= 17; y++) stamp(rows, 19, y, ["::"]);
	for (let y = 0; y <= 10; y++) put(rows, [27, y], "ゆ");
	for (let y = 24; y <= 31; y++) put(rows, [20, y], "ゆ");
	// 池（物を 置く 前に。池の 行が 街灯を 消さないよう）
	for (const [x0, y, line] of CITY_PONDS) stamp(rows, x0, y, [line]);
	for (const [x0, y, line] of CITY_CELLS) stamp(rows, x0, y, [line]);
};

/**
 * 町の 中心の 建物の 影（住宅街から。facilities.ts の facilityShadows と 同じ 形。ui/village/shadows.ts の shadowGround が 描く）。
 * 本館・商店街の 店・小屋・倉庫（銀行）・喫茶・図書館・音楽室・銭湯の 右がわ。
 */
export const coreShadows = (
	stage: number,
): { x: number; top: number; bottom: number }[] => {
	if (stage < 6) return [];
	return [
		{ x: 25, top: 8, bottom: 11 },
		{ x: 17, top: stage >= 7 ? 13 : 14, bottom: 17 },
		{ x: 24, top: 16, bottom: 19 },
		{ x: 30, top: 14, bottom: 17 },
		{ x: 7, top: 16, bottom: 19 },
		{ x: 6, top: 21, bottom: 23 },
		{ x: 24, top: 26, bottom: 29 },
		{ x: 38, top: 27, bottom: 30 },
	];
};

/** 喫茶「おんJ」が 建つ 町の 段。 */
export const CAFE_FROM = 5;

/** 音楽室「ピアノ機能」が 建つ 町の 段（開くのは 週末だけ。ui/village/rooms.ts）。 */
export const MUSIC_FROM = 3;

/** 音楽室（地図の 21, 25 から。池の そばの 道の 東。扉 22,28 は 下の 草地 y=29 から 踏む）。 */
const MUSIC_BLOCK: readonly string[] = ["ααα", "βββ", "δγδ", "εζε"];

/**
 * 本屋（地図の 3, 20 から。町の 段3〜5）と 図書館（2, 20 から。段6 から 建てかえて 1マス 広い）。
 * 広場の 西の 草地。屋根は 軒だけの 低い 建物（上の 道に かからないように）。扉 4,22 は 下の 草地 y=23 から 踏む。
 * 字は data/village/tiles.ts の BOOKS。ことばの 辞典は data/story/glossary.ts（本屋で 板の ことば、図書館で 深い ネタが ふえる）。
 */
const BOOKS_BLOCK: readonly string[] = ["アアア", "イウイ", "エオエ"];
const LIBRARY_BLOCK: readonly string[] = ["カカカカ", "キククキ", "ケケコケ"];

/** 喫茶「おんJ」（地図の 2, 15 から。扉 4,18 は 下の 道 y=19 から 踏む）。 */
const CAFE_BLOCK: readonly string[] = ["99999", "/////", "@|`|@", "''?''"];

/** おんJ神社が 建つ 町の 段（北西の 森の 奥。お参りすると おみくじ）。 */
export const SHRINE_FROM = 2;

/** 銭湯が 建つ 町の 段（南東。池の 東の 森を 開いた 所）。 */
export const BATH_FROM = 4;

/**
 * おんJ神社（地図の 1, 4 から。字は data/village/tiles.ts の SHRINE）。拝殿の 前に 賽銭箱（3,9。下の 3,10 から 調べる）、
 * 鳥居（3,13。絵は 11〜13 に かかる）を くぐって 下の 空き地（x=7 の 草）へ 抜ける。
 */
const SHRINE_BLOCK: readonly string[] = [
	",ΓΓΓ,b,",
	",ΔΔΔ,,,",
	"ΠΛΛΛΠ,,",
	",ΛΛΛ,;,",
	",ΛΘΛ,,,",
	"*,Σ,,,b",
	",,,,,,,",
	",,,,,,,",
	",,,,,,,",
	",ΛΦΛ,,,",
	",,,,,,,",
];

/** 銭湯（地図の 31, 26 から。字は BATH）。のれんの 扉（35,29）を 踏むと 中へ（出ると 35,30）。広場の 東の 草地に つながる。 */
const BATH_BLOCK: readonly string[] = [
	",,БЦБББ,",
	",,ДДДДД,",
	",,ЖЗЖЗЖ,",
	",,ИИЛИИ,",
	",,,,,,,b",
	",,,,,,,b",
];

/**
 * 噴水の 小広場（広場の 南の 生け垣を 開けた 先。東の 池の あと。地図の 24, 24 から。広場から だけ 入る 行きどまり：まわりは しげみで とじる）。噴水は 3×3（下の まんなかに 絵）。
 * パン板を 持ち帰るまで 水が 止まって いる（data/town/revival.ts の fountain。乾いた 絵は scripts/make-fountain.mjs）。
 */
const FOUNTAIN_AT: Cell = [24, 24];
const fountainBlock = (wet: boolean): readonly string[] => [
	":::::",
	":::::b",
	":滝滝滝:b",
	":滝滝滝:b",
	`b滝${wet ? "泉" : "涸"}滝bb`,
];

/**
 * パン屋（地図の 59, 25 から。商店街の 東の はし。パン松の 店）。中は ない（扉は しまって いる）。
 * きのこ板を 持ち帰るまで シャッター（data/town/revival.ts の bakery）。
 */
const BAKERY_AT: Cell = [59, 25];
const bakeryBlock = (open: boolean): readonly string[] => [
	"麦麦麦",
	"麭麭麭",
	"焼窓焼",
	`窯${open ? "扉" : "閉"}窯`,
];

/** 港の 船着き場の 小屋（地図の 24, 46 から。桟橋の 先の 東。下に 板の 足場）。入れない。 */
const HARBOR_HUT: readonly (readonly [number, number, string])[] = [
	[24, 46, "港湾渡"],
	[24, 47, "湊津浦"],
	[24, 48, "舟窓舟"],
	[24, 49, "舟戸舟"],
	[24, 50, "ははは"],
	[24, 51, "ははは"],
];

/** 北の 丘の やぐら広場（地図の 9, 5 から。神社の 東・部室棟の 前の 通りの 下。祭りの やぐらと 太鼓・ちょうちん・石灯籠）。 */
const YAGURA_PLAZA: readonly (readonly [number, number, string])[] = [
	[9, 5, "灯櫓楼閣灯,"],
	[9, 6, "提棚柵架鼓,"],
];

/** RPGEN の 切妻屋根（3×2）の 1段を 3字に（左から）。 */
const gable = (
	chars: string,
	row: number,
	color: string,
	ground: string,
): Record<string, TileDef> =>
	Object.fromEntries(
		[...chars].map((ch, col) => [
			ch,
			solid(color, ground, art("jpGable", col, row)),
		]),
	);
const C_PIER = "#a8804c";
const PIER_FLOOR = base(0, 46);

/** 噴水・パン屋・港の 小屋・やぐらの 絵（村の パレットに まぜる）。 */
const TOWN_PARTS: Record<string, TileDef> = {
	滝: solid(C_BRICK, BRICK),
	泉: big(C_BRICK, BRICK, base(0, 132, 3, 3)),
	涸: big(C_BRICK, BRICK, "pub:sprites/fountain-dry.png#0,0,48,48"),
	麦: solid("#8a5a3a", base(1, 82)),
	麭: solid("#9a6a4a", base(1, 84)),
	焼: solid("#8a5a4a", base(1, 61)),
	窓: solid("#8a5a4a", base(1, 61), basePx(48, 1382)),
	窯: solid("#8a5a4a", base(1, 62)),
	扉: solid("#8a5a4a", base(1, 62), base(7, 61, 1, 2)),
	閉: solid("#6a6a72", base(1, 62), art("shutter", 1)),
	...gable("港湾渡", 0, C_PIER, PIER_FLOOR),
	...gable("湊津浦", 1, C_PIER, PIER_FLOOR),
	舟: solid(C_PIER, PIER_FLOOR, base(1, 56)),
	戸: solid(C_PIER, PIER_FLOOR, base(1, 56), base(7, 55, 1, 2)),
	...gable("櫓楼閣", 0, C_GRASS, TURF),
	...gable("棚柵架", 1, C_GRASS, TURF),
	鼓: solid(C_GRASS, TURF, ri("taiko")),
	提: solid(C_GRASS, TURF, art("redLamp")),
	灯: solid(C_GRASS, TURF, art("lanternStone")),
};

/** 村の 出口（地図の 四方の はし。踏むと 全体マップ）。inward は 村へ もどる 向き。 */
export type VillageExit = {
	side: "n" | "s" | "w" | "e";
	cell: Cell;
	inward: Dir;
	/** Story.move の 1歩（村へ 1歩 もどる）。 */
	step: "u" | "d" | "l" | "r";
};

/** 町の 出口は 桟橋の 先の 港 だけ（船で 全体マップの 板へ。TOWN.md §0.1）。 */
export const VILLAGE_EXITS: readonly VillageExit[] = [
	{ side: "s", cell: [20, 51], inward: "up", step: "u" },
];

/**
 * 村の 中から 降りる 隠しの 板の 帰り口（2026-10-13 作者：「帰還したときに 井戸から 出てこない」）。
 * 過去ログの底は 広場の 古井戸の すぐ 下に 出る（仲間も 井戸の まわりで 迎える）。
 * 跡地・1901年の スレは 結で 口から 人が 歩いてくる 場面が あるので、口の まま。
 */
const INNER_EXITS: Partial<Record<DungeonId, VillageExit>> = {
	hidden: { side: "s", cell: [24, 22], inward: "down", step: "d" },
};

/** その 植民地から 帰ってくる 出口（どの 板も 港。隠しの 板は 村の 中の 入口）。 */
export const exitFor = (d: DungeonId): VillageExit =>
	INNER_EXITS[d] ?? VILLAGE_EXITS[0];

/** 出口の セルか（そこの 出口）。 */
export const exitAt = (x: number, y: number): VillageExit | undefined =>
	VILLAGE_EXITS.find((e) => e.cell[0] === x && e.cell[1] === y);

/** 町の 区画（22×18）。区画の 中の 座標は 上の 図の とおり。 */
const townRows = (v: VillageView): string[] => {
	const stage = layoutStage(v);
	// 町が 小さな店に なったら 雑草は 抜いてある
	const lot = LOT_ROWS.map((r) => (stage >= 5 ? r.replaceAll("v", ",") : r));
	const rows = [...CLIFF_ROWS, ROAD, ...lot, ROAD, ...plazaRows(stage), BOTTOM];
	put(rows, [19, 5], "i");
	const hall = hallBlock(stage);
	stamp(rows, hall.x, 0, hall.rows);
	stamp(rows, 1, 5, shopBlock(stage));
	stamp(rows, 12, 8, hutBlock(stage));
	stamp(rows, 16, 5, storeBlock(stage));
	if (stage >= 6) {
		// 小屋と 倉庫の あいだ・小屋の 前に 花
		put(rows, [15, 11], "&");
		put(rows, [12, 10], "*");
	}
	// 崖の上の 桜（段7）
	if (stage >= 7) put(rows, [1, 1], "y");
	return rows;
};

/** 村の地図（52行 × 87文字）。森の 中に 町の 区画を 置き、まわりへ 抜ける 道を 開ける。南は 浜と 海。 */
export const villageRows = (v: VillageView): string[] => {
	const town = townRows(v);
	const rows: string[] = [];
	for (let y = 0; y < VILLAGE_H; y++) {
		let r = "";
		for (let x = 0; x < VILLAGE_W; x++) {
			const tx = x - OX;
			const ty = y - OY;
			r +=
				tx >= 0 && ty >= 0 && tx < TOWN_W && ty < TOWN_H
					? town[ty][tx]
					: forestAt(x, y);
		}
		rows.push(r);
	}
	for (const [x0, y, line] of OUTSKIRTS_ROWS) stamp(rows, x0, y, [line]);
	stamp(
		rows,
		0,
		SHORE_Y,
		SHORE_ROWS.map((r) => [...r].slice(0, VILLAGE_W).join("")),
	);
	for (const c of PIER_CELLS) put(rows, c, "は");
	// 喫茶「おんJ」（段5 から。西の 空き地の 奥。扉は 下の 道から）
	if (layoutStage(v) >= CAFE_FROM) stamp(rows, 2, 15, CAFE_BLOCK);
	if (layoutStage(v) >= SHRINE_FROM) stamp(rows, 1, 4, SHRINE_BLOCK);
	stamp(rows, 31, 26, BATH_BLOCK);
	// 音楽室「ピアノ機能」（段3 から。南の 池の そば）
	if (layoutStage(v) >= MUSIC_FROM) stamp(rows, 21, 25, MUSIC_BLOCK);
	// 本屋（段3〜5）→ 図書館（段6 から）。広場の 西
	if (layoutStage(v) >= LIBRARY_FROM) stamp(rows, 2, 20, LIBRARY_BLOCK);
	else if (layoutStage(v) >= BOOKSTORE_FROM) stamp(rows, 3, 20, BOOKS_BLOCK);
	for (const [x, y, ch] of EDGE_CELLS) put(rows, [x, y], ch);
	// 町の 中心の 都市化（住宅街・都市。へりの 木を 植えた あと、施設の 前）
	coreCity(rows, layoutStage(v));
	// 町が 育つと 建つ 施設（data/village/facilities.ts。浜の 海の家・碁会所・グラウンドなど）
	stampFacilities(rows, layoutStage(v), put);
	// 広場の 噴水・商店街の パン屋・港の 小屋・北の 丘の やぐら広場（TOWN.md §0.2）
	stamp(
		rows,
		...FOUNTAIN_AT,
		fountainBlock(isRevived("fountain", revivedBoards(v))),
	);
	stamp(rows, ...BAKERY_AT, bakeryBlock(isRevived("bakery", revivedBoards(v))));
	for (const [x0, y, line] of [...HARBOR_HUT, ...YAGURA_PLAZA])
		stamp(rows, x0, y, [line]);
	// まだ 生き返って いない 所の 扉は シャッター（data/town/revival.ts。踏むと 札を 読んで 1歩 もどる）
	for (const c of shutDoors(v)) put(rows, c, SHUTTER_CH);
	thinStrips(rows, villagePalette(v));
	return rows;
};

/** 下りた シャッター（扉の 上に 描く。扉と 同じく 踏める）。 */
const SHUTTER_CH = "ｼ";
const SHUTTER: Record<string, TileDef> = {
	[SHUTTER_CH]: floor("#6a6a72", art("shutter", 1)),
};

/** 町の まんなかの 建物の 扉（data/town/revival.ts の CorePlace）。 */
const CORE_DOORS: readonly [CorePlace, Cell][] = [
	["cafe", VILLAGE_SPOTS.cafeDoor],
	["music", VILLAGE_SPOTS.musicDoor],
	["library", VILLAGE_SPOTS.booksDoor],
	["bath", VILLAGE_SPOTS.bath],
];

/** シャッターの 下りた 扉の マス。 */
const shutDoors = (v: VillageView): Cell[] => [
	...facilitiesAt(layoutStage(v))
		.filter((f) => !isRevived(f.id, revivedBoards(v)))
		.flatMap((f) =>
			[facilityDoor(f), facilityDoor2(f)].filter((d): d is Cell => !!d),
		),
	...CORE_DOORS.filter(([id]) => !isRevived(id, revivedBoards(v))).map(
		([, c]) => c,
	),
];

/** 町の まんなかの 建物の 外観の 四角（x, y, 幅, 高さ。夜の 窓を 消す 範囲）。 */
const CORE_RECTS: readonly [CorePlace, number, number, number, number][] = [
	["shrine", 1, 4, 5, 6],
	["music", 21, 25, 3, 4],
	["bath", 33, 26, 5, 4],
	["library", 2, 20, 4, 3],
	["bookstore", 3, 20, 3, 3],
	["cafe", 2, 15, 5, 4],
	["bakery", ...BAKERY_AT, 3, 4],
];

/**
 * 生き返って いない 建物の マス（y * VILLAGE_W + x）。夜も 窓が 灯らない（ui/village/village.ts の drawLights）。
 * 施設の 外観と 町の まんなかの 建物。
 */
export const unlitCells = (v: VillageView): Set<number> => {
	const out = new Set<number>();
	for (const f of facilitiesAt(layoutStage(v))) {
		if (isRevived(f.id, revivedBoards(v))) continue;
		facilityBlock(f).forEach((line, dy) => {
			[...line].forEach((ch, dx) => {
				if (ch !== " ") out.add((f.at[1] + dy) * VILLAGE_W + f.at[0] + dx);
			});
		});
	}
	for (const [id, x0, y0, w, h] of CORE_RECTS) {
		if (isRevived(id, revivedBoards(v))) continue;
		for (let y = y0; y < y0 + h; y++)
			for (let x = x0; x < x0 + w; x++) out.add(y * VILLAGE_W + x);
	}
	return out;
};

/** 抜いてよい 木・しげみ・生け垣（森と 町の へり）。 */
const GREENERY = new Set(["T", "b", "^", "H", "h"]);

/**
 * 歩ける 所に はさまれた 細い 木の 帯（幅 1〜2マス）を 芝に する（作者「壁を 減らして ストレスなく 通れるように」）。
 * 区画と 区画の あいだに 残った 森の 列などで 遠回り させない。ぽつんと 立つ 1本（帯でない）は 飾りなので 残す。
 */
const thinStrips = (rows: string[], pal: Record<string, TileDef>): void => {
	const g = rows.map((r) => [...r]);
	const H = g.length;
	const W = g[0].length;
	const at = (x: number, y: number) =>
		x < 0 || y < 0 || x >= W || y >= H ? undefined : g[y][x];
	const walk = (x: number, y: number) => {
		const c = at(x, y);
		return c !== undefined && pal[c]?.passable === true;
	};
	const green = (x: number, y: number) => GREENERY.has(at(x, y) ?? "");
	// dx,dy の 向きに 歩ける 所に はさまれた 帯か（となり、か 1つ 先の 木を こえて）
	const between = (x: number, y: number, dx: number, dy: number) => {
		const a = walk(x - dx, y - dy);
		const b = walk(x + dx, y + dy);
		return (
			(a && b) ||
			(a && green(x + dx, y + dy) && walk(x + 2 * dx, y + 2 * dy)) ||
			(b && green(x - dx, y - dy) && walk(x - 2 * dx, y - 2 * dy))
		);
	};
	const out: Cell[] = [];
	// 地図の はしの 2列は 森の 縁として 残す
	for (let y = 2; y < H - 2; y++)
		for (let x = 2; x < W - 2; x++) {
			if (!green(x, y)) continue;
			// 町の 区画の 中（売り場の 囲いの しげみ など）は さわらない。へりの 生け垣は 抜く
			if (x > OX && y > OY && x < OX + TOWN_W - 1 && y < OY + TOWN_H - 1)
				continue;
			// 帯の 向き：左右に はさまれて 上下に 木が 続く（縦の 帯）か、その 逆
			const v = between(x, y, 1, 0) && (green(x, y - 1) || green(x, y + 1));
			const h = between(x, y, 0, 1) && (green(x - 1, y) || green(x + 1, y));
			if (v || h) out.push([x, y]);
		}
	for (const c of out) put(rows, c, ",");
};

/** 村の パレット（道・広場・倉庫の 絵は 町の段で かわる）。 */
export const villagePalette = (v: VillageView): Record<string, TileDef> => {
	const stage = layoutStage(v);
	const paved = stage >= 5;
	// 掲示板の 足もと（広場が 石畳に なったら 石畳）
	const boardGround: [string, string] = paved
		? [C_PLAZA, PLAZA]
		: [C_GRASS, TURF];
	return {
		...GROUND,
		...OUTSKIRTS,
		...BEACH,
		...ROADS,
		...CITY,
		...facilityTiles(),
		...FARM,
		...SHRINE,
		...BATH,
		...CLIFF,
		...STALL,
		...SHOP,
		...HUT,
		...(stage >= 7 ? BANK : stage >= 6 ? STOREHOUSE : SHED),
		...hallTiles(stage),
		...CAFE,
		...MUSIC,
		...BOOKS,
		...SHUTTER,
		...TOWN_PARTS,
		// 道：土 → 石だたみ（段5）→ アスファルト（住宅街＝段6 から）
		".":
			stage >= 6
				? floor(C_ASPHALT, ASPHALT)
				: paved
					? floor(C_STONE, STONE)
					: floor(C_DIRT, DIRT),
		":": floor(C_PLAZA, PLAZA),
		U: solid(C_PLAZA, PLAZA, base(2, 37)),
		K: solid(boardGround[0], boardGround[1], base(6, 37, 1, 2)),
		k: solid(boardGround[0], boardGround[1], base(7, 37, 1, 2)),
		// 都市（段7）：崖は 擁壁・小屋は 瓦屋根・広場は レンガ（道「.」は 上の アスファルトの まま）
		...(stage >= 7 ? { ...CITY_CLIFF, ...HUT_CITY, ...CITY7 } : {}),
	};
};

/** 蓄音機（キリコの。16x16 の1枚絵なので 向きのない置物として 切り出しで指す）。 */
export const PHONO_SPRITE = "pub:sprites/phono.png#0,0,16,16";

/** 村に置く イベント（人・看板・口）。スクリプトは ui/village/villageEvents.ts が id で 付ける。 */
export type VillagePlace = {
	id: string;
	x: number;
	y: number;
	trigger: "talk" | "touch";
	/** 見た目（無ければ 見えない イベント。タイルの絵を そのまま 調べる）。 */
	sprite?: string;
	dir?: Dir;
	wander?: boolean;
	/** 仲間なら その人。 */
	who?: Speaker;
	/** 村の 出口か その 立て札。 */
	exit?: true;
	/** おんJマイナーズなら その子。 */
	mob?: MobId;
};

const friend = (who: Speaker, [x, y]: Cell, wander = false): VillagePlace => ({
	id: who,
	x,
	y,
	trigger: "talk",
	sprite: CAST[who].walk,
	dir: "down",
	wander,
	who,
});

/** 寄り道の 板から 来る 名無しの 歩行グラ（RPGEN「陽すこ民」。本館の 名無しと 同じ 絵の 1つ。data/village/hall.ts の NANASHI_WALK）。 */
export const VISITOR_WALK = "sa:C2hS8U";

/** 村に置く イベントの 一覧。 */
export const villagePlaces = (v: VillageView): VillagePlace[] => {
	const stage = layoutStage(v);
	// 夜・深夜（crowd.ts の timeBand の night と late。20時〜翌5時）
	const hour = nowHour();
	const night = hour >= 20 || hour < 5;
	const out: VillagePlace[] = [];
	// 町の 出口（桟橋の 先の 港。出ると 全体マップで 行き先を 選ぶ）と その 立て札
	for (const e of VILLAGE_EXITS)
		out.push({
			id: e.side === "n" ? "exit" : `exit_${e.side}`,
			x: e.cell[0],
			y: e.cell[1],
			trigger: "touch",
			exit: true,
			dir: e.inward,
		});
	const [sx, sy] = VILLAGE_SPOTS.exitSign;
	out.push({ id: "exit_sign", x: sx, y: sy, trigger: "talk", exit: true });
	VILLAGE_SPOTS.board.forEach(([x, y], i) => {
		out.push({ id: `board_${i}`, x, y, trigger: "talk" });
	});
	if (stage >= 5) {
		const [wx, wy] = VILLAGE_SPOTS.well;
		out.push({ id: "well", x: wx, y: wy, trigger: "talk" });
	}
	const [px, py] = VILLAGE_SPOTS.phono;
	out.push({
		id: "phono",
		x: px,
		y: py,
		trigger: "talk",
		sprite: PHONO_SPRITE,
	});
	// おんJ 本館の 扉（踏むと 中へ。前で A でも）
	VILLAGE_SPOTS.hallDoors.forEach(([x, y], i) => {
		out.push({ id: `door_hall_${i}`, x, y, trigger: "touch" });
	});
	if (stage >= CAFE_FROM) {
		const [cx, cy] = VILLAGE_SPOTS.cafeDoor;
		out.push({ id: "door_cafe", x: cx, y: cy, trigger: "touch" });
	}
	if (stage >= MUSIC_FROM) {
		const [mx, my] = VILLAGE_SPOTS.musicDoor;
		out.push({ id: "door_music", x: mx, y: my, trigger: "touch" });
	}
	if (stage >= BOOKSTORE_FROM) {
		const [bx, by] = VILLAGE_SPOTS.booksDoor;
		out.push({ id: "door_books", x: bx, y: by, trigger: "touch" });
	}
	if (stage >= SHRINE_FROM) {
		const [x, y] = VILLAGE_SPOTS.shrine;
		out.push({ id: "shrine", x, y, trigger: "talk" });
	}
	{
		const [x, y] = VILLAGE_SPOTS.bath;
		out.push({ id: "door_bath", x, y, trigger: "touch" });
	}
	if (stage >= 3) {
		const [hx, hy] = VILLAGE_SPOTS.hutDoor;
		out.push({ id: "door_hut", x: hx, y: hy, trigger: "touch" });
	}
	// 倉庫・常識堂の 奥の 扉（台の 横の 細道の 奥。店番に たのまなくても 踏むと 中へ）
	if (stage >= ROOM_FROM.store) {
		const [x, y] = VILLAGE_SPOTS.storeDoor;
		out.push({ id: "door_store", x, y, trigger: "touch" });
	}
	if (stage >= ROOM_FROM.shop) {
		const [x, y] = VILLAGE_SPOTS.shopDoor;
		out.push({ id: "door_shop", x, y, trigger: "touch" });
	}
	// ライバル 4人と やきう（みんな はじめから 町に いる。店の 仕事は しない：TOWN.md §0.4）
	out.push(friend("roze", VILLAGE_SPOTS.roze));
	// シヨは 金・土・日の 夜は メイド喫茶で アルバイト（data/people/shiyoShift.ts）
	if (
		!(
			isRevived("maid", revivedBoards(v)) &&
			shiyoAtMaid(stage, today(), nowHour())
		)
	)
		out.push(friend("shiyo", VILLAGE_SPOTS.shiyo));
	out.push(friend("zero", VILLAGE_SPOTS.zero));
	// やきうは 町に 残った 名無し（家の 前）
	out.push(friend("nanj", VILLAGE_SPOTS.nanj(v)));
	// フェリスは 海の家の ステージ（不死鳥アイドル）
	out.push(friend("feris", VILLAGE_SPOTS.feris, true));
	// 施設の 扉（中が ある 施設）と 外に 置く 物（釣り場の 竿・グラウンドの マウンドなど）
	for (const f of facilitiesAt(stage)) {
		const d = facilityDoor(f);
		if (d) out.push({ id: doorId(f), x: d[0], y: d[1], trigger: "touch" });
		// 両開きの もう 1枚（どちらを 踏んでも 入れる）
		const d2 = facilityDoor2(f);
		if (d2)
			out.push({ id: doorId(f, true), x: d2[0], y: d2[1], trigger: "touch" });
		for (const t of f.outdoor ?? []) {
			// 夜・深夜は 家に 入る 人（マイクラの 島の 新規 など）
			if (t.dayOnly && night) continue;
			out.push({
				id: outdoorId(f, t),
				x: t.at[0],
				y: t.at[1],
				trigger: "talk",
				// 屋台の 店番など 見える 人
				...(t.sprite ? { sprite: t.sprite, dir: t.dir } : {}),
			});
		}
	}
	// おんJマイナーズ（町が 育つと 越してくる。ぷゆゆは 段0 から）
	for (const id of MOB_IDS) {
		const d = MOBS[id];
		out.push({
			id: `mob_${id}`,
			x: d.spot[0],
			y: d.spot[1],
			trigger: "talk",
			sprite: d.sprite,
			dir: d.dir,
			wander: d.wander,
			mob: id,
		});
	}
	// 祭り（最終話の あと。よその 板から 見に 来た 野次馬が うろうろ している）
	if (stage >= 7 && v.cleared.includes("deep"))
		VILLAGE_SPOTS.yaji.forEach(([x, y], i) => {
			out.push({
				id: `yaji_${i}`,
				x,
				y,
				trigger: "talk",
				sprite: YAJI_WALK[i % YAJI_WALK.length],
				dir: "down",
				wander: true,
			});
		});
	// 村の はしの 名無したち（data/village/folk.ts。話し方は ui/village/folk.ts）
	out.push(...folkPlaces(stage));
	// 町の 騒ぎの 人（板が 開いて から 持ち帰るまで）と ご近所（持ち帰った あと。data/town/incidents.ts）
	for (const p of [
		...activeIncidents(v).flatMap((i) => i.people),
		...activeVisitors(v),
	])
		out.push({
			id: incidentPlaceId(p),
			x: p.at[0],
			y: p.at[1],
			trigger: "talk",
			sprite: p.sprite,
			dir: p.dir,
		});
	return out;
};

/** 村の 場面で 人を 呼ぶ・どかす マスを 引く 道具（spotsAround・asideSpot）。 */
const spotTools = (v: VillageView) => {
	const rows = villageRows(v).map((r) => [...r]);
	const tiles = villagePalette(v);
	const places = villagePlaces(v);
	const pass = (x: number, y: number): boolean =>
		!!tiles[rows[y]?.[x] ?? ""]?.passable;
	/** 人や 看板の いない、踏んでも 動かない 通れる マス。 */
	const vacant = ([x, y]: Cell): boolean =>
		pass(x, y) &&
		!places.some(
			(p) => p.x === x && p.y === y && (p.sprite || p.trigger === "touch"),
		) &&
		!exitAt(x, y);
	/** start から block を 通らずに 歩いて 行ける マス（y * VILLAGE_W + x。場面の 人は ほかの人を すりぬけるので 地形だけ）。 */
	const reach = (start: Cell, block?: Cell): Set<number> => {
		const seen = new Set([start[1] * VILLAGE_W + start[0]]);
		const queue: Cell[] = [start];
		for (let head = 0; head < queue.length; head++) {
			const [x, y] = queue[head];
			for (const [nx, ny] of [
				[x, y - 1],
				[x + 1, y],
				[x, y + 1],
				[x - 1, y],
			] as const) {
				const k = ny * VILLAGE_W + nx;
				if (nx < 0 || ny < 0 || nx >= VILLAGE_W || ny >= VILLAGE_H) continue;
				if (seen.has(k) || !pass(nx, ny)) continue;
				if (block && nx === block[0] && ny === block[1]) continue;
				seen.add(k);
				queue.push([nx, ny]);
			}
		}
		return seen;
	};
	/** 広場（蓄音機の 前。そこに 立つ 人が いれば となり）。 */
	const hub = ([x, y]: Cell): Cell => {
		const [bx, by] = VILLAGE_SPOTS.boot;
		return x === bx && y === by ? [bx + 1, by] : [bx, by];
	};
	/** (px, py) の まわりの マス（1〜4 マス。近い 順）。 */
	const ring = ([px, py]: Cell): Cell[] => {
		const out: Cell[] = [];
		for (let r = 1; r <= 4; r++)
			for (let dy = -r; dy <= r; dy++)
				for (let dx = -r; dx <= r; dx++)
					if (Math.max(Math.abs(dx), Math.abs(dy)) === r)
						out.push([px + dx, py + dy]);
		return out;
	};
	return { vacant, reach, hub, ring };
};

/** マスの 番号（spotTools の reach の 中に あるか 見る）。 */
const cellKey = ([x, y]: Cell): number => y * VILLAGE_W + x;

/** c が taken（場面で 置いた 人の マス）に あるか。 */
const isTaken = (taken: readonly Cell[], [x, y]: Cell): boolean =>
	taken.some(([tx, ty]) => tx === x && ty === y);

/**
 * (x, y) の まわりの 空いた マス（近い 順に n こ）。村の 場面で 話す 仲間を キリコの そばに 呼ぶ ときに 使う
 * （ui/village/villageReturn.ts の gather）。人や 看板の いる マス・踏むと 動く マスは さける。
 * 広場（蓄音機の 前）から (x, y) を 通らずに 歩いて 来られる マスだけ（店の 台の うしろ・キリコが 立つと
 * ふさがる 細道の 先には 呼ばない。そこだと 呼ばれた 人が 歩いて 来られず、遠くから 話す ことに なる）。
 * taken は 場面で もう 人を 置いた マス（口の 前に 並んだ 仲間・呼んだ 仲間。地図の 人では ないので ここで 外す）。
 */
export const spotsAround = (
	v: VillageView,
	n: number,
	at: readonly [number, number],
	taken: readonly Cell[] = [],
): Cell[] => {
	const t = spotTools(v);
	const open = t.reach(t.hub(at), at);
	return t
		.ring(at)
		.filter((c) => t.vacant(c) && open.has(cellKey(c)) && !isTaken(taken, c))
		.slice(0, n);
};

/**
 * 口の 前に 立つ キリコが どく マス（となりから 近い 順の 空いた マス。ui/village/villageReturn.ts の stepAside）。
 * そこに 立っても 口から 広場まで 歩いて 行ける マスだけ（口から 歩いてくる 人の 道を ふさがない。
 * 細道なら 横の 行き止まりへ よける）。taken（場面で 人を 置いた マス）にも 立たない。なければ undefined。
 */
export const asideSpot = (
	v: VillageView,
	at: Cell,
	gate: Cell,
	taken: readonly Cell[] = [],
): Cell | undefined => {
	const t = spotTools(v);
	const mine = t.reach(at);
	return t
		.ring(at)
		.find(
			(c) =>
				t.vacant(c) &&
				!isTaken(taken, c) &&
				mine.has(cellKey(c)) &&
				t.reach(gate, c).has(cellKey(t.hub(c))),
		);
};

/**
 * 帰ってきたとき 口の前に 仲間が 並んで 待つ マス（n 人ぶん）。
 * 出口の 1つ下（キリコが 出てくる マス）の 左右に 近い順で、崖の下の道に 並ぶ（たりなければ その下の段）。
 * 通れない マス・人や 置物の いる マス・踏むと もぐる 口は とばす。
 */
export const lineupSpots = (
	v: VillageView,
	n: number,
	exit: VillageExit = VILLAGE_EXITS[0],
): Cell[] => {
	const rows = villageRows(v).map((r) => [...r]);
	const tiles = villagePalette(v);
	const places = villagePlaces(v);
	const [mx, my] = exit.cell;
	const ix = exit.inward === "right" ? 1 : exit.inward === "left" ? -1 : 0;
	const iy = exit.inward === "down" ? 1 : exit.inward === "up" ? -1 : 0;
	const free = (x: number, y: number): boolean =>
		!!tiles[rows[y]?.[x] ?? ""]?.passable &&
		!places.some(
			(p) => p.x === x && p.y === y && (p.sprite || p.trigger === "touch"),
		);
	const out: Cell[] = [];
	// 出口から 村へ 1〜3歩 入った 所の、横（出口に 向かって 左右）に 近い順
	for (const d of [1, 2, 3])
		for (let k = 1; k < VILLAGE_W && out.length < n; k++)
			for (const side of [-k, k]) {
				const x = mx + ix * d + iy * side;
				const y = my + iy * d + ix * side;
				if (out.length < n && free(x, y)) out.push([x, y]);
			}
	return out;
};
