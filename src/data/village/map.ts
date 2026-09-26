// 村（保守村）の地図。DOM も保存も使わない 組み立てだけ（src/sim/villageTests.ts で 形と 歩ける道を 調べる）。
// スクリプトは ui/villageEvents.ts が id ごとに 付ける。
//
// 22×18 マス（1文字 = 16px の 1マス）。町の帯（ui/town.ts）と 同じ 並び。
// - 北に 崖。口が 3つ（ちょっと (4,3)・本編 (11,3)・もっと (18,3)）。口の右の 崖の足もとに 立て札。
// - 崖の下に 道（y=4）。そこから 町の 通り（y=12）まで 土の道（x=10〜11）が のびる。
// - 西に 店の区画、まんなかに 小屋、東に 倉庫の区画。その下が 広場（掲示板・蓄音機）。
// - 本編が まだ 開いていないうちは、おんJ民が 本編の口の前（11,4）に 立って ふさぐ（そこしか 口へ 行けない）。
//   もっとの口は 開くまで 板で ふさぐ（m）。
// - 人は 町の段と 役目で 立つ（5人とも はじめから いる）。
//
// いまは 段0（空き地）の形だけ。段ごとの 建物（屋台・小屋・倉庫・店）は 次の段で 足す（layoutStage）。
//
//    0123456789012345678901
//  0 1111111111111111111111  崖の上
//  1 2222222222222222222222  崖のふち
//  2 3333333333333333333333  岩肌
//  3 4444M!44444M!44444m!44  口と 立て札
//  4 H....................H  崖の下の道（おんJ民 11,4）
//  5 h,,v,,,,,,..,,,,,,,v,h  （テト 17,5）
//  … 空き地（雑草）。x=10〜11 は 土の道
// 11 h,,,,u,,,,..,,,,,,,,,h  ロゼ 4,11 と 麻婆豆腐の鍋 5,11
// 12 H....................H  町の通り
// 14 H,,,,,Kk,,,,,,,,,,,,,H  まとめ掲示板 6..7,14・レイ 8,14・蓄音機 10,14
// 15 h,,,,,,,,,,,,,,,,,,,,h  キリコ（起きる所）10,15・フェリス 16,15
// 16 H,,,,,,,,,,,,,,,,,,,,H  とうすこ 8,16
// 17 HhHhHhHhHhHhHhHhHhHhHh

import { DUNGEON_IDS } from "../../core/data/dungeons";
import type { DungeonId } from "../../core/types";
import type { TileDef } from "../../engine/defs";
import type { Dir } from "../../engine/types";
import { CAST, TOUSUKO_WALK } from "../cast";
import type { Speaker } from "../quotes";
import {
	base,
	C_DIRT,
	C_GRASS,
	CLIFF,
	COUNTERS,
	DIRT,
	floor,
	LOT,
	solid,
	TOWN,
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
	/** テト（倉庫が 建つまでは 崖の そば）。 */
	teto: (stage: number): Cell => (stage >= 4 ? [18, 10] : [17, 5]),
	/** おんJ民（本編が 開くまでは 口の前で ふさぐ。開いたら 小屋の前）。 */
	nanj: (v: VillageView): Cell =>
		v.unlocked.includes("main") ? [12, 11] : [11, 4],
} as const;

/** 地図の形に使う 町の段（いまは 段0 だけ。段ごとの 建物は 次の段で）。 */
const layoutStage = (_v: VillageView): number => 0;

/** 段0（空き地）。崖の3段目の口は あとで 差しかえる。 */
const LOT_ROWS: readonly string[] = [
	"1111111111111111111111",
	"2222222222222222222222",
	"3333333333333333333333",
	"4444M!44444M!44444M!44",
	"H....................H",
	"h,,v,,,,,,..,,,,,,,v,h",
	"H,,,,,,v,,..,,,v,,,,,H",
	"h,v,,,,,,,..,,,,,,,,,h",
	"H,,,,,v,,,..,,v,,,,v,H",
	"h,,,v,,,,,..,,,,,,,,,h",
	"H,,,,,,,v,..,,,,v,,,,H",
	"h,,,,u,,,,..,,,,,,,,,h",
	"H....................H",
	"h,,,,,,,,,,,,,,,,,,,,h",
	"H,,,,,Kk,,,,,,,,,,,,,H",
	"h,,,,,,,,,,,,,,,,,,,,h",
	"H,,,,,,,,,,,,,,,,,,,,H",
	"HhHhHhHhHhHhHhHhHhHhHh",
];

/** そのマスの文字を 差しかえる。 */
const put = (rows: string[], [x, y]: Cell, ch: string): void => {
	const r = [...rows[y]];
	r[x] = ch;
	rows[y] = r.join("");
};

/** 村の地図（18行 × 22文字）。 */
export const villageRows = (v: VillageView): string[] => {
	const rows = [...LOT_ROWS];
	// もっとの口は 開くまで 板で ふさぐ
	if (!v.unlocked.includes("deep")) put(rows, VILLAGE_SPOTS.mouth.deep, "m");
	return rows;
};

/** 村の パレット（町の段で 道が 石だたみに なるのは 次の段で）。 */
export const villagePalette = (_v: VillageView): Record<string, TileDef> => {
	return {
		...TOWN,
		...CLIFF,
		...COUNTERS,
		...LOT,
		// 村の道は 土（町の段5から 石だたみ）。掲示板は 草の上に立つ
		".": floor(C_DIRT, DIRT),
		K: solid(C_GRASS, TURF, base(6, 37, 1, 2)),
		k: solid(C_GRASS, TURF, base(7, 37, 1, 2)),
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
	return out;
};
