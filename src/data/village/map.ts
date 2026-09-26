// 村（保守村）の地図。DOM も保存も使わない 組み立てだけ（src/sim/villageTests.ts で 形と 歩ける道を 調べる）。
// スクリプトは ui/villageEvents.ts が id ごとに 付ける。
//
// 22×18 マス（1文字 = 16px の 1マス）。町の帯（ui/town.ts）と 同じ 並び・同じ絵で、町の段（0〜7）で 建物が ふえる。
// - 北に 崖。口が 3つ（ちょっと (4,3)・本編 (11,3)・もっと (18,3)）。口の右の 崖の足もとに 立て札。
// - 崖の下に 道（y=4）。そこから 町の 通り（y=12）まで 道（x=10〜11）が のびる。
// - 西に 店の区画（x=1〜8）、まんなかに 小屋（x=12〜15）、東に 倉庫の区画（x=16〜20）。その下が 広場（掲示板・蓄音機）。
//   売り場は「囲い（y=10。売る人が立つ）＋ 台（y=11）」。キリコは 通り（y=12）から 台ごしに 話しかける。
// - 本編が まだ 開いていないうちは、おんJ民が 本編の口の前（11,4）に 立って ふさぐ（そこしか 口へ 行けない）。
//   開いたら 小屋の前（12,11）で 大工を する。もっとの口は 開くまで 板で ふさぐ（m）。
// - 人は 町の段と 役目で 立つ（5人とも はじめから いる）。段7 は 野次馬が 3人 うろうろ する。
// - 帰ってきたとき 仲間が 口の前に 並ぶ マス（lineupSpots）と、町が 育ったとき カメラを 向ける 所（VILLAGE_SPOTS.growth）。
//
// 段ごとの 区画（前の段の物は 形を かえて 残る）
//   店   0 空き地（ロゼと 麻婆豆腐の鍋）  1 屋台（台と品物・本の看板）  2〜4 日よけ・ランプ・木箱
//        5〜6 小さな店（常識堂。白い壁・赤い屋根）  7 2階建ての 大きな店（窓の花・ちょうちん）
//   小屋 3〜 わら屋根・煙突（6〜 窓の下に 花の箱）
//   倉庫 4〜5 板張りの 物置  6〜 石造りの 倉庫。テトが 台の うしろに 立つ（それまでは 崖の そば）
//   道   0〜4 土  5〜 石だたみ（広場も 石畳に。井戸）。6〜 花。7 桜と 野次馬
//
// 段7・3つとも 開いたときの 形（ほかの段は 区画を 差しかえる。@ は 人と 蓄音機。字は data/village/tiles.ts）
//    0123456789012345678901
//  0 1111111111111111111111  崖の上
//  1 2y22222222222222222222  崖のふち（y 桜）
//  2 3333333333333333333333  岩肌
//  3 4444M!44444M!44444M!44  口と 立て札
//  4 H....................H  崖の下の道（本編が 開くまで おんJ民 11,4）
//  5 h,nnnnnn,,..,,,,,,,,,h  店の 屋根                  （倉庫が 建つまで テト 17,5）
//  6 H,NNNNNN,,..,,,,rrrrrH                               倉庫の 屋根
//  7 h,ffOfff,,..,,,,RRRRRh  2階（窓の花・本の看板）
//  8 H,l((w(l,,..,Cz,{{{g{H  1階（ちょうちん）  小屋（煙突）  倉庫の 壁（袋の看板）
//  9 h,)d)aa),,..,ZZ,}78}}h  扉・日よけ                   扉（7 8）
// 10 H,X,@,Lx,,..*J[,x,@,xH  ロゼ 4,10                    テト 18,10
// 11 h,XqQ>ux,,..@Ee&x<->xh  台           おんJ民 12,11・小屋の扉 14,11
// 12 H....................H  町の通り
// 13 h,,,::::::..::::::@,,h  広場（野次馬）
// 14 H,Y,::Kk@:@::::U::,Y,H  まとめ掲示板 6..7・レイ 8・蓄音機 10・井戸 15
// 15 h,,,:@::::::::::@:,,,h  キリコ（起きる所）10・フェリス 16
// 16 H*,,,,,,@,,,,@,,,,,,*H  とうすこ 8
// 17 HhHhHhHhHhHhHhHhHhHhHh

import { DUNGEON_IDS } from "../../core/data/dungeons";
import { TOWN_STAGES } from "../../core/town";
import type { DungeonId } from "../../core/types";
import type { TileDef } from "../../engine/defs";
import type { Dir } from "../../engine/types";
import { CAST, TOUSUKO_WALK, YAJI_WALK } from "../cast";
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
	PLAZA,
	SHED,
	SHOP,
	STALL,
	STONE,
	STOREHOUSE,
	solid,
	TURF,
} from "./tiles";

export const VILLAGE_W = 22;
export const VILLAGE_H = 18;

/** 村の形を決める物（町の段・開いたダンジョン・持ち帰ったダンジョン）。 */
export type VillageView = {
	stage: number;
	unlocked: readonly DungeonId[];
	cleared: readonly DungeonId[];
};

export type Cell = readonly [x: number, y: number];

/** 村の 決まった場所。 */
export const VILLAGE_SPOTS = {
	/** ダンジョンの口（踏むと もぐる）。 */
	mouth: { shallow: [4, 3], main: [11, 3], deep: [18, 3] } as Record<
		DungeonId,
		Cell
	>,
	/** 口の 立て札（崖の足もと。下の道から 上を向いて 読む）。 */
	sign: { shallow: [5, 3], main: [12, 3], deep: [19, 3] } as Record<
		DungeonId,
		Cell
	>,
	/** 起きたとき・倒れて もどったときに 立つ所（蓄音機の前）。 */
	boot: [10, 15] as Cell,
	phono: [10, 14] as Cell,
	/** まとめ掲示板（2マス）。 */
	board: [
		[6, 14],
		[7, 14],
	] as readonly Cell[],
	rei: [8, 14] as Cell,
	feris: [16, 15] as Cell,
	tousuko: [8, 16] as Cell,
	/** ロゼ（段0は 鍋の となり、屋台が出たら 台の うしろ）。 */
	roze: (stage: number): Cell => (stage === 0 ? [4, 11] : [4, 10]),
	/** テト（倉庫が 建つまでは 崖の そば。建ったら 台の うしろ）。 */
	teto: (stage: number): Cell => (stage >= 4 ? [18, 10] : [17, 5]),
	/** おんJ民（本編が 開くまでは 口の前で ふさぐ。開いたら 小屋の前で 大工）。 */
	nanj: (v: VillageView): Cell =>
		v.unlocked.includes("main") ? [12, 11] : [11, 4],
	/** 小屋の扉（段3から。見るだけ）。 */
	hutDoor: [14, 11] as Cell,
	/** 段7 の 野次馬（うろうろ する）。 */
	yaji: [
		[5, 15],
		[13, 16],
		[18, 13],
	] as readonly Cell[],
	/**
	 * 町が その段に なったとき カメラを 向ける 所（建った・変わった 建物）。
	 * 小屋（3）・倉庫（4・6）・大きな店と 広場の 桜（7）・ほかは 店。
	 */
	growth: (stage: number): Cell =>
		stage === 3
			? [13, 9]
			: stage === 4 || stage === 6
				? [18, 8]
				: stage >= 7
					? [6, 10]
					: [5, 9],
} as const;

/** 地図の形に使う 町の段（0〜7 に 丸める）。 */
const layoutStage = (v: VillageView): number =>
	Math.max(0, Math.min(TOWN_STAGES - 1, Math.floor(v.stage) || 0));

// ───────────────── 行 ─────────────────

const CLIFF_ROWS: readonly string[] = [
	"1111111111111111111111",
	"2222222222222222222222",
	"3333333333333333333333",
	"4444M!44444M!44444M!44",
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

/** 村の地図（18行 × 22文字）。 */
export const villageRows = (v: VillageView): string[] => {
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
	// もっとの口は 開くまで 板で ふさぐ
	if (!v.unlocked.includes("deep")) put(rows, VILLAGE_SPOTS.mouth.deep, "m");
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
	/** 口・立て札なら その ダンジョン。 */
	dungeon?: DungeonId;
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
	for (const d of DUNGEON_IDS) {
		const [mx, my] = VILLAGE_SPOTS.mouth[d];
		// 踏むと もぐる（本編は 開くまで おんJ民が 前に立つので 行けない。念のため 踏んでも 開いていなければ もどす）
		if (d !== "deep" || v.unlocked.includes(d))
			out.push({
				id: `mouth_${d}`,
				x: mx,
				y: my,
				trigger: "touch",
				dungeon: d,
			});
		// 板で ふさいだ口は 調べられる
		else
			out.push({
				id: `boarded_${d}`,
				x: mx,
				y: my,
				trigger: "talk",
				dungeon: d,
			});
		const [sx, sy] = VILLAGE_SPOTS.sign[d];
		out.push({ id: `sign_${d}`, x: sx, y: sy, trigger: "talk", dungeon: d });
	}
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
	out.push(friend("teto", VILLAGE_SPOTS.teto(stage)));
	out.push(friend("rei", VILLAGE_SPOTS.rei));
	out.push(friend("nanj", VILLAGE_SPOTS.nanj(v)));
	out.push(friend("feris", VILLAGE_SPOTS.feris, true));
	const [tx, ty] = VILLAGE_SPOTS.tousuko;
	out.push({
		id: "tousuko",
		x: tx,
		y: ty,
		trigger: "talk",
		sprite: TOUSUKO_WALK,
		dir: "down",
		wander: true,
	});
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
 * 口の 1つ下（キリコが 出てくる マス）の 左右に 近い順で、崖の下の道に 並ぶ（たりなければ その下の段）。
 * 通れない マス・人や 置物の いる マス・踏むと もぐる 口は とばす。
 */
export const lineupSpots = (
	v: VillageView,
	d: DungeonId,
	n: number,
): Cell[] => {
	const rows = villageRows(v).map((r) => [...r]);
	const tiles = villagePalette(v);
	const places = villagePlaces(v);
	const [mx, my] = VILLAGE_SPOTS.mouth[d];
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
