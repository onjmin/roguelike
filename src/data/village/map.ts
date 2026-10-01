// 村（保守村）の地図。DOM も保存も使わない 組み立てだけ（src/sim/villageTests.ts で 形と 歩ける道を 調べる）。
// スクリプトは ui/villageEvents.ts が id ごとに 付ける。
//
// 地図は 40×32 マス（1文字 = 16px の 1マス）。森の 中に 町の 区画（22×18）を 置く（OX, OY だけ ずらす）。
// まわりの 森は 四角く ならないよう 木と しげみで 囲み、西の 空き地（切り株・丸太）・東の 畑（かかし・畝・麦）・
// 南の 池へ 抜けられる（OUTSKIRTS_ROWS・EDGE_CELLS）。下の 図と 区画の 関数は 町の 区画の 座標で、
// VILLAGE_SPOTS と 住人の 家（data/mobs.ts の spot）は 地図の 座標（区画の 座標 ＋ 9, 7）。
// - 北に 崖。まんなかに おんJ 本館（縦の 道が 扉 10〜11 に 突きあたる。段で 集会所 幅4 → レンガ 幅6 → 本館 幅10。
//   扉を 踏むと 中の 地図へ。中は data/village/hall.ts）。
//   東の 崖の 切れ目を 道が 北へ 抜ける（区画 18,3 が 村の 出口。立て札は 19,5）。出口を 踏むと 全体マップで 行き先の 植民地を 選ぶ。
// - 崖の下に 道（区画 y=4）。そこから 町の 通り（y=12）まで 道（x=10〜11）が のびる。
// - 西に 店の区画（x=1〜8）、まんなかに 小屋（x=12〜15）、東に 倉庫の区画（x=16〜20）。その下が 広場（掲示板・蓄音機）。
//   売り場は「囲い（y=10。売る人が立つ）＋ 台（y=11）」。キリコは 通り（y=12）から 台ごしに 話しかける。
// - やきうは 小屋の前（12,11）で 大工。人は 町の段と 役目で 立つ（5人とも はじめから いる）。段7 は 野次馬が 3人。
// - おんJマイナーズ（data/mobs.ts）は 町が 育つと 1人ずつ 越してくる。ぷゆゆは 段0 から 広場の 下を うろうろ。
// - 町の まわりも 段で かわる：東の 畑は 荒れ地から 豊作へ（farmRows）、段2 で 北西の 森に 保守神社（おみくじ）、
//   段3 で 池の そばに 音楽室、段4 で 南東に 銭湯、段5 で 西の 空き地に 喫茶。
// - 帰ってきたとき 仲間が 出口の前に 並ぶ マス（lineupSpots）と、町が 育ったとき カメラを 向ける 所（VILLAGE_SPOTS.growth）。
//
// 段ごとの 区画（前の段の物は 形を かえて 残る）
//   店   0 空き地（ロゼと 麻婆豆腐の鍋）  1 屋台（台と品物・本の看板）  2〜4 日よけ・ランプ・木箱
//        5〜6 小さな店（常識堂。白い壁・赤い屋根）  7 2階建ての 大きな店（窓の花・ちょうちん）
//   小屋 3〜 わら屋根・煙突（6〜 窓の下に 花の箱）
//   倉庫 2〜3 小さな 物置  4〜5 板張りの 倉庫  6 石造りの 倉庫  7 銀行（貸金庫）。シヨが 台の うしろに 立つ
//   道   0〜4 土  5〜 石だたみ（広場も 石畳に。井戸）。6〜 花。7 桜と 野次馬
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
//  8 H,l((w(l,,..,Cz,{{{g{H  1階（ちょうちん）  小屋（煙突）  倉庫の 壁（袋の看板）
//  9 h,)d)aa),,..,ZZ,}78}}h  扉・日よけ                   扉（7 8）
// 10 H,X,@,Lx,,..*J[,x,@,xH  ロゼ 4,10                    シヨ 18,10
// 11 h,XqQ>ux,,..@Ee&x<->xh  台           やきう 12,11・小屋の扉 14,11
// 12 H....................H  町の通り
// 13 h,,,::::::..::::::@,,h  広場（野次馬）
// 14 H,Y,::Kk@:@::::U::,Y,H  まとめ掲示板 6..7・ゼロ 8・蓄音機 10・井戸 15
// 15 h,,,:@::::::::::@:,,,h  キリコ（起きる所）10・フェリス 16
// 16 H*,,,,,,@,,,,@,,,,,,*H  ぷゆゆ 8（うろうろ）
// 17 HhHhHhHhHhHhHhHhHhHhHh

import { lastStepOf, TOWN_STAGES } from "../../core/town";
import type { DungeonId } from "../../core/types";
import type { TileDef } from "../../engine/defs";
import type { Dir } from "../../engine/types";
import { CAST, YAJI_WALK } from "../cast";
import { MOB_IDS, MOBS, type MobId } from "../mobs";
import type { Speaker } from "../quotes";
import { awayFriends, FRIEND_FROM } from "../story";
import { COLONY_SPOTS, VILLAGE_PT } from "../worldMap";
import {
	BANK,
	BATH,
	base,
	C_DIRT,
	C_GRASS,
	C_PLAZA,
	C_STONE,
	CAFE,
	CLIFF,
	DIRT,
	FARM,
	floor,
	GROUND,
	HUT,
	hallTier,
	hallTiles,
	MUSIC,
	OUTSKIRTS,
	PLAZA,
	SHED,
	SHED_SMALL,
	SHOP,
	SHRINE,
	STALL,
	STONE,
	STOREHOUSE,
	solid,
	TURF,
} from "./tiles";

export const VILLAGE_W = 40;
export const VILLAGE_H = 32;

/**
 * 町（22×18 の 区画。下の 図の 座標）を 地図の どこに 置くか。まわりは 森で、西の 空き地・東の 畑・
 * 南の 池へ 抜けられる（OUTSKIRTS）。VILLAGE_SPOTS と 住人の 家（data/mobs.ts の spot）は 地図の 座標。
 */
const OX = 9;
const OY = 7;
const TOWN_W = 22;
const TOWN_H = 18;

/** 村の形を決める物（町の段・開いたダンジョン・持ち帰ったダンジョン）。 */
export type VillageView = {
	stage: number;
	unlocked: readonly DungeonId[];
	cleared: readonly DungeonId[];
	/** 町の 小段（core/town.ts の TOWN_STEPS。住人が 何人 越してきたか）。省くと その段の いちばん上。 */
	step?: number;
};

/** その 村の 小段（省いたら その 段の いちばん上）。 */
export const stepOf = (v: VillageView): number =>
	v.step ?? lastStepOf(layoutStage(v));

export type Cell = readonly [x: number, y: number];

/** 村の 決まった場所。 */
export const VILLAGE_SPOTS = {
	/** 北の 出口（崖の 切れ目を 抜けた 丘の 先。地図の 上はし）。はじめの 場面・開いた 知らせで 見る 所。 */
	exit: [27, 0] as Cell,
	/** 出口の 立て札（崖の足もと。下の道から 上を向いて 読む）。 */
	exitSign: [28, 12] as Cell,
	/** 喫茶「保守」の 扉（段5 から。踏むと 中へ。data/village/rooms.ts）。 */
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
	zero: [17, 21] as Cell,
	/** 広場の 井戸（段5 から）。過去ログの底へは ここから 降りる。 */
	well: [24, 21] as Cell,
	feris: [25, 22] as Cell,
	/** ロゼ（段0は 鍋の となり、屋台が出たら 台の うしろ）。 */
	roze: (stage: number): Cell => (stage === 0 ? [13, 18] : [13, 17]),
	/** シヨ（倉庫が 建つまでは 崖の そば。建ったら 台の うしろ）。 */
	shiyo: (stage: number): Cell => (stage >= 2 ? [27, 17] : [26, 12]),
	/** やきう（小屋の前で 大工）。 */
	nanj: (_v: VillageView): Cell => [21, 18],
	/** 音楽室「ピアノ機能」の 扉（段3 から。週末だけ 踏むと 中へ）。 */
	musicDoor: [22, 28] as Cell,
	/** 保守神社の 賽銭箱（段2 から。お参りすると おみくじ）。 */
	shrine: [3, 9] as Cell,
	/** 銭湯の のれん（段4 から。見るだけ）。 */
	bath: [35, 27] as Cell,
	/** 小屋の扉（段3から。踏むと 中へ）。 */
	hutDoor: [23, 18] as Cell,
	/** 段7 の 野次馬（うろうろ する）。 */
	yaji: [
		[14, 22],
		[22, 23],
		[27, 20],
	] as readonly Cell[],
	/**
	 * 町が その段に なったとき カメラを 向ける 所（建った・変わった 建物）。
	 * 小屋（3）・倉庫（4・6）・大きな店と 広場の 桜（7）・ほかは 店。
	 */
	growth: (stage: number): Cell =>
		stage === 3
			? [22, 16]
			: stage === 4 || stage === 6
				? [27, 15]
				: stage >= 7
					? [15, 17]
					: [14, 16],
} as const;

/** 地図の形に使う 町の段（0〜7 に 丸める）。 */
const layoutStage = (v: VillageView): number =>
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
		// 小さな店（常識堂）。扉は 囲いの中、日よけは ロゼの 上
		return [
			"",
			" nnnnnn ",
			" NNNNNN ",
			" ((O(w( ",
			" )d)aa) ",
			" X,,,Lx ",
			" XqQ>ux ",
		];
	// 2階建ての 大きな店
	return [
		" nnnnnn ",
		" NNNNNN ",
		" ffOfff ",
		" l((w(l ",
		" )d)aa) ",
		" X,,,Lx ",
		" XqQ>ux ",
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
	// 小屋ていどの 物置（屋根と 扉だけ）
	if (stage <= 3) return ["", "", "", " rrr ", " }7} ", "x,,,x", "x<->x"];
	if (stage <= 5)
		return ["", " rrr ", " RRR ", " {{g ", " 78} ", "x,,,x", "x<->x"];
	return ["", "rrrrr", "RRRRR", "{{{g{", "}78}}", "x,,,x", "x<->x"];
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
 * 北の 丘（崖の 切れ目の 上）、西の 空き地（切り株・丸太・花）、東の 畑（かかし・畝・麦）、南の 池。
 * どこからも 地図の はしへ 道が 抜けて、はしが 村の 出口（VILLAGE_EXITS）。
 */
const OUTSKIRTS_ROWS: readonly [number, number, string][] = [
	// 北の 丘
	[27, 0, "."],
	[26, 1, ",.,"],
	[22, 2, ",,*,,.;,,"],
	[20, 3, ",,,,Y,,.,,*,"],
	[19, 4, "b,*,,,,,.,,,,b"],
	[20, 5, ",,,,=,,.,,;,"],
	[21, 6, ",,,,,,.,,,"],
	// 西の 空き地
	[2, 15, ",,,,,,"],
	[1, 16, ",=,,;,,"],
	[1, 17, ",,_,,,v,"],
	[1, 18, ";,,,*,,,"],
	[0, 19, "........."],
	[1, 20, ",,v,,%,,"],
	[1, 21, ",*,,,,,,"],
	[2, 22, ",,B,,;"],
	[3, 23, ",,,,"],
	// 東の 畑（町の 段で 育つ。farmRows）。y=19 は 東の 出口への 道
	[31, 19, "........."],
	[32, 22, ",,,bb"],
	// 南の 池
	[10, 25, ",,%,,,,,,,.,,,;,,,*,,"],
	[10, 26, ",~~~~~,,,,.,,,,,~~~,,"],
	[10, 27, "~~~~~~~,,;.,,&,~~~~~,"],
	[10, 28, ",~~~~~~,,,.,,,,,~~~,,"],
	[10, 29, ",,~~~,,B,,.,,=,,,,,,,"],
	[11, 30, ",,,,,,,,,.,,,,,,,"],
	[20, 31, "."],
];

/**
 * 東の 畑（地図の x=31〜38, y=11〜22。y=19 の 道は OUTSKIRTS_ROWS）。町の 段で 育つ：
 * 0 雑草だらけの 荒れ地 → 1 畝 1つに 芽 → 2 畝 2つ・かかし → 3〜4 キャベツと 麦（4 で 干し草）→
 * 5〜6 トマト・りんごの 木・収穫の かご → 7 豊作（実った 麦・実の なった 木・麻袋）。字は data/village/tiles.ts の FARM。
 * x=31 の 列は いつも 草（町の へりの 切れ目から 歩ける）。
 */
const FARM_X = 31;
const farmRows = (stage: number): readonly [number, string][] => {
	const foot: [number, string][] = [
		[20, stage >= 5 ? ",,Ξ,,,,b" : ",,;,v,,b"],
		[21, "*,,,,,bb"],
	];
	if (stage === 0)
		return [
			[11, ",v,,b"],
			[12, ",,v,;,,b"],
			[13, ",v,,,%v,"],
			[14, ";,,=,,,,"],
			[15, ",,v,,;v,"],
			[16, ",%,,v,,,"],
			[17, ",,;,,,v,"],
			[18, ",v,,,%,,"],
			...foot,
		];
	if (stage <= 2)
		return [
			[11, ",,,,b"],
			[12, ",,v,,,,b"],
			[13, stage >= 2 ? ",ηθθι,S," : ",ηθθι,v,"],
			[14, stage >= 2 ? ",κπολ,,," : ",κοολ,,,"],
			[15, ",μννξ,;,"],
			[16, ",,,v,,,,"],
			[17, stage >= 2 ? ",ηθθθι,," : ",%,,,,v,"],
			[18, stage >= 2 ? ",μνννξ,," : ",,,;,,,,"],
			...foot,
		];
	if (stage <= 4)
		return [
			[11, ",,,,b"],
			[12, ",,,,,,,b"],
			[13, ",ηθθθιS,"],
			[14, ",κρρρλ,,"],
			[15, ",μνννξ,;"],
			[16, ",,,,,,,,"],
			[17, ",WWWW,,,"],
			[18, stage >= 4 ? ",WWWW,υ," : ",WWWW,,,"],
			...foot,
		];
	if (stage <= 6)
		return [
			[11, ",,,,b"],
			[12, stage >= 6 ? ",Ω,,Ω,,b" : ",Ω,,,,,b"],
			[13, ",ηθθθθι,"],
			[14, ",κρρσσλ,"],
			[15, ",μννννξS"],
			[16, ",,,,,,χ,"],
			[17, ",WWWWW,,"],
			[18, ",WWWWWυ,"],
			...foot,
		];
	return [
		[11, ",,,,b"],
		[12, ",Ψ,,Ψ,φ,"],
		[13, ",ηθθθθι,"],
		[14, ",κρσρσλ,"],
		[15, ",μννννξS"],
		[16, ",ψ,χ,,ω,"],
		[17, ",τττττ,,"],
		[18, ",τττττυ,"],
		...foot,
	];
};

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

/** 喫茶「保守」が 建つ 町の 段。 */
export const CAFE_FROM = 5;

/** 音楽室「ピアノ機能」が 建つ 町の 段（開くのは 週末だけ。ui/rooms.ts）。 */
export const MUSIC_FROM = 3;

/** 音楽室（地図の 21, 25 から。池の そばの 道の 東。扉 22,28 は 下の 草地 y=29 から 踏む）。 */
const MUSIC_BLOCK: readonly string[] = ["ααα", "βββ", "δγδ", "εζε"];

/** 喫茶「保守」（地図の 2, 15 から。扉 4,18 は 下の 道 y=19 から 踏む）。 */
const CAFE_BLOCK: readonly string[] = ["99999", "/////", "@|`|@", "''?''"];

/** 保守神社が 建つ 町の 段（北西の 森の 奥。お参りすると おみくじ）。 */
export const SHRINE_FROM = 2;

/** 銭湯が 建つ 町の 段（南東。池の 東の 森を 開いた 所）。 */
export const BATH_FROM = 4;

/**
 * 保守神社（地図の 1, 4 から。字は data/village/tiles.ts の SHRINE）。拝殿の 前に 賽銭箱（3,9。下の 3,10 から 調べる）、
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

/** 銭湯（地図の 31, 24 から。字は BATH）。のれんの 扉（35,27）は 下の 35,28 から 調べる。池の 東の 草地に つながる。 */
const BATH_BLOCK: readonly string[] = [
	",,БЦБББ,",
	",,ДДДДД,",
	",,ЖЗЖЗЖ,",
	",,ИИЛИИ,",
	",,,,,,,b",
	",,,,,,,b",
];

/** 村の 出口（地図の 四方の はし。踏むと 全体マップ）。inward は 村へ もどる 向き。 */
export type VillageExit = {
	side: "n" | "s" | "w" | "e";
	cell: Cell;
	inward: Dir;
	/** Story.move の 1歩（村へ 1歩 もどる）。 */
	step: "u" | "d" | "l" | "r";
};

export const VILLAGE_EXITS: readonly VillageExit[] = [
	{ side: "n", cell: [27, 0], inward: "down", step: "d" },
	{ side: "w", cell: [0, 19], inward: "right", step: "r" },
	{ side: "e", cell: [39, 19], inward: "left", step: "l" },
	{ side: "s", cell: [20, 31], inward: "up", step: "u" },
];

/** その 植民地から 帰ってくる 出口（全体マップで 村から 見た 植民地の 方角）。 */
export const exitFor = (d: DungeonId): VillageExit => {
	const r = COLONY_SPOTS[d].route;
	const [x, y] = r[r.length - 1];
	const dx = x - VILLAGE_PT[0];
	const dy = y - VILLAGE_PT[1];
	const side =
		Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "w" : "e") : dy < 0 ? "n" : "s";
	return VILLAGE_EXITS.find((e) => e.side === side) ?? VILLAGE_EXITS[0];
};

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

/** 村の地図（32行 × 40文字）。森の 中に 町の 区画を 置き、まわりへ 抜ける 道を 開ける。 */
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
	for (const [y, line] of farmRows(layoutStage(v)))
		stamp(rows, FARM_X, y, [line]);
	// 喫茶「保守」（段5 から。西の 空き地の 奥。扉は 下の 道から）
	if (layoutStage(v) >= CAFE_FROM) stamp(rows, 2, 15, CAFE_BLOCK);
	if (layoutStage(v) >= SHRINE_FROM) stamp(rows, 1, 4, SHRINE_BLOCK);
	if (layoutStage(v) >= BATH_FROM) stamp(rows, 31, 24, BATH_BLOCK);
	// 音楽室「ピアノ機能」（段3 から。南の 池の そば）
	if (layoutStage(v) >= MUSIC_FROM) stamp(rows, 21, 25, MUSIC_BLOCK);
	for (const [x, y, ch] of EDGE_CELLS) put(rows, [x, y], ch);
	return rows;
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
		...FARM,
		...SHRINE,
		...BATH,
		...CLIFF,
		...STALL,
		...SHOP,
		...HUT,
		...(stage >= 7
			? BANK
			: stage >= 6
				? STOREHOUSE
				: stage >= 4
					? SHED
					: SHED_SMALL),
		...hallTiles(stage),
		...CAFE,
		...MUSIC,
		".": paved ? floor(C_STONE, STONE) : floor(C_DIRT, DIRT),
		":": floor(C_PLAZA, PLAZA),
		U: solid(C_PLAZA, PLAZA, base(2, 37)),
		K: solid(boardGround[0], boardGround[1], base(6, 37, 1, 2)),
		k: solid(boardGround[0], boardGround[1], base(7, 37, 1, 2)),
	};
};

/** 蓄音機（キリコの。16x16 の1枚絵なので 向きのない置物として 切り出しで指す）。 */
export const PHONO_SPRITE = "pub:sprites/phono.png#0,0,16,16";

/** 村に置く イベント（人・看板・口）。スクリプトは ui/villageEvents.ts が id で 付ける。 */
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
	const out: VillagePlace[] = [];
	// 村の 出口（四方の はし。出ると 全体マップで 行き先を 選ぶ）と その 立て札
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
	if (stage >= SHRINE_FROM) {
		const [x, y] = VILLAGE_SPOTS.shrine;
		out.push({ id: "shrine", x, y, trigger: "talk" });
	}
	if (stage >= BATH_FROM) {
		const [x, y] = VILLAGE_SPOTS.bath;
		out.push({ id: "bath", x, y, trigger: "talk" });
	}
	if (stage >= 3) {
		const [hx, hy] = VILLAGE_SPOTS.hutDoor;
		out.push({ id: "door_hut", x: hx, y: hy, trigger: "touch" });
	}
	// 仲間は 越してきてから（data/story.ts の FRIEND_FROM。はじめの 保守村には やきうだけ）
	const here = (w: Speaker) => stage >= FRIEND_FROM[w];
	if (here("roze")) out.push(friend("roze", VILLAGE_SPOTS.roze(stage)));
	if (here("shiyo")) out.push(friend("shiyo", VILLAGE_SPOTS.shiyo(stage)));
	if (here("zero")) out.push(friend("zero", VILLAGE_SPOTS.zero));
	// やきうは 過去ログの底の 結末で 外へ 出ていく。そのあとは 小屋の 前に「保守」の 札（data/story.ts）
	if (awayFriends(v.cleared).includes("nanj")) {
		const [nx, ny] = VILLAGE_SPOTS.nanj(v);
		out.push({ id: "hoshu_sign", x: nx, y: ny, trigger: "talk" });
	} else out.push(friend("nanj", VILLAGE_SPOTS.nanj(v)));
	if (here("feris")) out.push(friend("feris", VILLAGE_SPOTS.feris, true));
	// おんJマイナーズ（町が 育つと 越してくる。ぷゆゆは 段0 から）
	for (const id of MOB_IDS) {
		const d = MOBS[id];
		if (stepOf(v) < d.from) continue;
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
	// 祭り（段7）：野次馬が うろうろ している
	if (stage >= 7)
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
	return out;
};

/**
 * 帰ってきたとき 口の前に 仲間が 並んで 待つ マス（n 人ぶん）。
 * 出口の 1つ下（キリコが 出てくる マス）の 左右に 近い順で、崖の下の道に 並ぶ（たりなければ その下の段）。
 * 通れない マス・人や 置物の いる マス・踏むと もぐる 口は とばす。
 */
/**
 * (x, y) の まわりの 空いた マス（近い 順に n こ）。村の 場面で 話す 仲間を キリコの そばに 呼ぶ ときに 使う
 * （ui/villageReturn.ts の gather）。人や 看板の いる マス・踏むと 動く マスは さける。
 */
export const spotsAround = (
	v: VillageView,
	n: number,
	[px, py]: readonly [number, number],
): Cell[] => {
	const rows = villageRows(v).map((r) => [...r]);
	const tiles = villagePalette(v);
	const places = villagePlaces(v);
	const free = (x: number, y: number): boolean =>
		!(x === px && y === py) &&
		!!tiles[rows[y]?.[x] ?? ""]?.passable &&
		!places.some(
			(p) => p.x === x && p.y === y && (p.sprite || p.trigger === "touch"),
		) &&
		!exitAt(x, y);
	const out: Cell[] = [];
	for (let r = 1; r <= 4 && out.length < n; r++)
		for (let dy = -r; dy <= r; dy++)
			for (let dx = -r; dx <= r; dx++) {
				if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
				if (out.length < n && free(px + dx, py + dy))
					out.push([px + dx, py + dy]);
			}
	return out;
};

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
