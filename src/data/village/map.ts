// 村（保守村）の地図。DOM も保存も使わない 組み立てだけ（src/sim/villageTests.ts で 形と 歩ける道を 調べる）。
// スクリプトは ui/villageEvents.ts が id ごとに 付ける。
//
// 地図は 30×24 マス（1文字 = 16px の 1マス）。森の 中に 町の 区画（22×18）を 置く（OX, OY だけ ずらす）。
// まわりの 森は 四角く ならないよう 木と しげみで 囲み、西の 空き地（切り株・丸太）・東の 畑（かかし・畝・麦）・
// 南の 池へ 抜けられる（OUTSKIRTS_ROWS・EDGE_CELLS）。下の 図と 区画の 関数は 町の 区画の 座標で、
// VILLAGE_SPOTS と 住人の 家（data/mobs.ts の spot）は 地図の 座標（区画の 座標 ＋ 4, 2）。
// - 北に 崖。まん中に 村の 出口（区画 11,3）と 立て札。出口を 踏むと 全体マップで 行き先の 植民地を 選ぶ。
// - 崖の下に 道（区画 y=4）。そこから 町の 通り（y=12）まで 道（x=10〜11）が のびる。
// - 西に 店の区画（x=1〜8）、まんなかに 小屋（x=12〜15）、東に 倉庫の区画（x=16〜20）。その下が 広場（掲示板・蓄音機）。
//   売り場は「囲い（y=10。売る人が立つ）＋ 台（y=11）」。キリコは 通り（y=12）から 台ごしに 話しかける。
// - おんJ民は 小屋の前（12,11）で 大工。人は 町の段と 役目で 立つ（5人とも はじめから いる）。段7 は 野次馬が 3人。
// - おんJマイナーズ（data/mobs.ts）は 町が 育つと 1人ずつ 越してくる。ぷゆゆは 段0 から 広場の 下を うろうろ。
// - 帰ってきたとき 仲間が 出口の前に 並ぶ マス（lineupSpots）と、町が 育ったとき カメラを 向ける 所（VILLAGE_SPOTS.growth）。
//
// 段ごとの 区画（前の段の物は 形を かえて 残る）
//   店   0 空き地（ロゼと 麻婆豆腐の鍋）  1 屋台（台と品物・本の看板）  2〜4 日よけ・ランプ・木箱
//        5〜6 小さな店（常識堂。白い壁・赤い屋根）  7 2階建ての 大きな店（窓の花・ちょうちん）
//   小屋 3〜 わら屋根・煙突（6〜 窓の下に 花の箱）
//   倉庫 4〜5 板張りの 物置  6〜 石造りの 倉庫。シヨが 台の うしろに 立つ（それまでは 崖の そば）
//   道   0〜4 土  5〜 石だたみ（広場も 石畳に。井戸）。6〜 花。7 桜と 野次馬
//
// 段7 の 町の 区画の 形（ほかの段は 区画を 差しかえる。@ は 人と 蓄音機。字は data/village/tiles.ts）
//    0123456789012345678901
//  0 1111111111111111111111  崖の上
//  1 2y22222222222222222222  崖のふち（y 桜）
//  2 3333333333333333333333  岩肌
//  3 44444444444M!444444444  村の 出口と 立て札
//  4 H....................H  崖の下の道
//  5 h,nnnnnn,,..,,,,,,,,,h  店の 屋根                  （倉庫が 建つまで シヨ 17,5）
//  6 H,NNNNNN,,..,,,,rrrrrH                               倉庫の 屋根
//  7 h,ffOfff,,..,,,,RRRRRh  2階（窓の花・本の看板）
//  8 H,l((w(l,,..,Cz,{{{g{H  1階（ちょうちん）  小屋（煙突）  倉庫の 壁（袋の看板）
//  9 h,)d)aa),,..,ZZ,}78}}h  扉・日よけ                   扉（7 8）
// 10 H,X,@,Lx,,..*J[,x,@,xH  ロゼ 4,10                    シヨ 18,10
// 11 h,XqQ>ux,,..@Ee&x<->xh  台           おんJ民 12,11・小屋の扉 14,11
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
import { CAST, YAJI_WALK } from "../cast";
import { MOB_IDS, MOBS, type MobId } from "../mobs";
import type { Speaker } from "../quotes";
import {
	base,
	C_DIRT,
	C_GRASS,
	C_PLAZA,
	C_STONE,
	CLIFF,
	DIRT,
	floor,
	GROUND,
	HUT,
	OUTSKIRTS,
	PLAZA,
	SHED,
	SHOP,
	STALL,
	STONE,
	STOREHOUSE,
	solid,
	TURF,
} from "./tiles";

export const VILLAGE_W = 30;
export const VILLAGE_H = 24;

/**
 * 町（22×18 の 区画。下の 図の 座標）を 地図の どこに 置くか。まわりは 森で、西の 空き地・東の 畑・
 * 南の 池へ 抜けられる（OUTSKIRTS）。VILLAGE_SPOTS と 住人の 家（data/mobs.ts の spot）は 地図の 座標。
 */
const OX = 4;
const OY = 2;
const TOWN_W = 22;
const TOWN_H = 18;

/** 村の形を決める物（町の段・開いたダンジョン・持ち帰ったダンジョン）。 */
export type VillageView = {
	stage: number;
	unlocked: readonly DungeonId[];
	cleared: readonly DungeonId[];
};

export type Cell = readonly [x: number, y: number];

/** 村の 決まった場所。 */
export const VILLAGE_SPOTS = {
	/** 村の 出口（崖の 切れ目。踏むと 全体マップで 行き先の 植民地を 選ぶ）。 */
	exit: [15, 5] as Cell,
	/** 出口の 立て札（崖の足もと。下の道から 上を向いて 読む）。 */
	exitSign: [16, 5] as Cell,
	/** 起きたとき・倒れて もどったときに 立つ所（蓄音機の前）。 */
	boot: [14, 17] as Cell,
	phono: [14, 16] as Cell,
	/** まとめ掲示板（2マス）。 */
	board: [
		[10, 16],
		[11, 16],
	] as readonly Cell[],
	zero: [12, 16] as Cell,
	feris: [20, 17] as Cell,
	/** ロゼ（段0は 鍋の となり、屋台が出たら 台の うしろ）。 */
	roze: (stage: number): Cell => (stage === 0 ? [8, 13] : [8, 12]),
	/** シヨ（倉庫が 建つまでは 崖の そば。建ったら 台の うしろ）。 */
	shiyo: (stage: number): Cell => (stage >= 4 ? [22, 12] : [21, 7]),
	/** おんJ民（小屋の前で 大工）。 */
	nanj: (_v: VillageView): Cell => [16, 13],
	/** 小屋の扉（段3から。見るだけ）。 */
	hutDoor: [18, 13] as Cell,
	/** 段7 の 野次馬（うろうろ する）。 */
	yaji: [
		[9, 17],
		[17, 18],
		[22, 15],
	] as readonly Cell[],
	/**
	 * 町が その段に なったとき カメラを 向ける 所（建った・変わった 建物）。
	 * 小屋（3）・倉庫（4・6）・大きな店と 広場の 桜（7）・ほかは 店。
	 */
	growth: (stage: number): Cell =>
		stage === 3
			? [17, 11]
			: stage === 4 || stage === 6
				? [22, 10]
				: stage >= 7
					? [10, 12]
					: [9, 11],
} as const;

/** 地図の形に使う 町の段（0〜7 に 丸める）。 */
const layoutStage = (v: VillageView): number =>
	Math.max(0, Math.min(TOWN_STAGES - 1, Math.floor(v.stage) || 0));

// ───────────────── 行 ─────────────────

const CLIFF_ROWS: readonly string[] = [
	"1111111111111111111111",
	"2222222222222222222222",
	"3333333333333333333333",
	"44444444444M!444444444",
];
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

/** 倉庫の区画（x=16〜20, y=5〜11）。段4から。 */
const storeBlock = (stage: number): readonly string[] => {
	if (stage < 4) return [];
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
 * 西の 空き地（切り株・丸太・花）、東の 畑（かかし・畝・麦）、南の 池（岩と 草の へり）。
 */
const OUTSKIRTS_ROWS: readonly [number, number, string][] = [
	[0, 12, "bb,,"],
	[0, 13, "b=,;"],
	[0, 14, "b,.."],
	[0, 15, "b,v,"],
	[0, 16, "b_,,"],
	[0, 17, "b;*,"],
	[0, 18, "bb,,"],
	[0, 19, "bb,,"],
	[26, 6, ",,bb"],
	[26, 7, ",;,b"],
	[26, 8, ",,Sb"],
	[26, 9, "GGGb"],
	[26, 10, "GGGb"],
	[26, 11, "WWWb"],
	[26, 12, ",,,b"],
	[26, 13, "*,;b"],
	[26, 14, "..,b"],
	[26, 15, ",,bb"],
	[4, 20, "b,,%,,~~~,;,;,,,,*,,,bb"],
	[4, 21, "b,B,~~~~~~~,,&,,=,;,,bb"],
	[4, 22, "bb,,;,~~~~,%,,,,,,,,bbb"],
];

/**
 * 町の 区画の へりを 開ける・木を 植える（地図の 座標）。四角く 見えないように、生け垣を ところどころ
 * 抜いて まわりへ つなぎ、残りも 木や しげみに かえる。
 */
const EDGE_CELLS: readonly [number, number, string][] = [
	// 西：町の 通りと 広場から 空き地へ
	[4, 13, ","],
	[4, 14, "."],
	[4, 15, ","],
	[4, 16, ","],
	[4, 8, "T"],
	[4, 10, "b"],
	[4, 18, "T"],
	// 東：崖下の 道・町の 通りから 畑へ
	[25, 6, "."],
	[25, 7, ","],
	[25, 8, ","],
	[25, 12, ","],
	[25, 13, ","],
	[25, 14, "."],
	[25, 10, "T"],
	[25, 17, "^"],
	// 南：広場の 下から 池へ
	[13, 19, ","],
	[14, 19, ","],
	[15, 19, ","],
	[16, 19, ","],
	[6, 19, "T"],
	[9, 19, "^"],
	[19, 19, "T"],
	[22, 19, "b"],
];

/** 町の 区画（22×18）。区画の 中の 座標は 上の 図の とおり。 */
const townRows = (v: VillageView): string[] => {
	const stage = layoutStage(v);
	// 町が 小さな店に なったら 雑草は 抜いてある
	const lot = LOT_ROWS.map((r) => (stage >= 5 ? r.replaceAll("v", ",") : r));
	const rows = [...CLIFF_ROWS, ROAD, ...lot, ROAD, ...plazaRows(stage), BOTTOM];
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

/** 村の地図（24行 × 30文字）。森の 中に 町の 区画を 置き、まわりへ 抜ける 道を 開ける。 */
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
		...CLIFF,
		...STALL,
		...SHOP,
		...HUT,
		...(stage >= 6 ? STOREHOUSE : SHED),
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

/** 村に置く イベントの 一覧。 */
export const villagePlaces = (v: VillageView): VillagePlace[] => {
	const stage = layoutStage(v);
	const out: VillagePlace[] = [];
	// 村の 出口（1つ。出ると 全体マップで 行き先を 選ぶ）と その 立て札
	const [ex, ey] = VILLAGE_SPOTS.exit;
	out.push({ id: "exit", x: ex, y: ey, trigger: "touch", exit: true });
	const [sx, sy] = VILLAGE_SPOTS.exitSign;
	out.push({ id: "exit_sign", x: sx, y: sy, trigger: "talk", exit: true });
	VILLAGE_SPOTS.board.forEach(([x, y], i) => {
		out.push({ id: `board_${i}`, x, y, trigger: "talk" });
	});
	const [px, py] = VILLAGE_SPOTS.phono;
	out.push({
		id: "phono",
		x: px,
		y: py,
		trigger: "talk",
		sprite: PHONO_SPRITE,
	});
	if (stage >= 3) {
		const [hx, hy] = VILLAGE_SPOTS.hutDoor;
		out.push({ id: "door_hut", x: hx, y: hy, trigger: "talk" });
	}
	out.push(friend("roze", VILLAGE_SPOTS.roze(stage)));
	out.push(friend("shiyo", VILLAGE_SPOTS.shiyo(stage)));
	out.push(friend("zero", VILLAGE_SPOTS.zero));
	out.push(friend("nanj", VILLAGE_SPOTS.nanj(v)));
	out.push(friend("feris", VILLAGE_SPOTS.feris, true));
	// おんJマイナーズ（町が 育つと 越してくる。ぷゆゆは 段0 から）
	for (const id of MOB_IDS) {
		const d = MOBS[id];
		if (stage < d.from) continue;
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
export const lineupSpots = (v: VillageView, n: number): Cell[] => {
	const rows = villageRows(v).map((r) => [...r]);
	const tiles = villagePalette(v);
	const places = villagePlaces(v);
	const [mx, my] = VILLAGE_SPOTS.exit;
	const free = (x: number, y: number): boolean =>
		!!tiles[rows[y]?.[x] ?? ""]?.passable &&
		!places.some(
			(p) => p.x === x && p.y === y && (p.sprite || p.trigger === "touch"),
		);
	const out: Cell[] = [];
	for (const y of [my + 1, my + 2])
		for (let k = 1; k < VILLAGE_W && out.length < n; k++)
			for (const x of [mx - k, mx + k])
				if (out.length < n && free(x, y)) out.push([x, y]);
	return out;
};
