// 板の 小さな 地上（TOWN.md §0.3。1画面ずつ）。全体マップで 板を えらぶと ここに 着き、入口の マスを 踏むと 地下へ 降りる。
// 本筋の 4つ（パン板・きのこ板・風呂板・電池板）と 寄り道の 離島板・おんたこ・お祭り会場。過去ログの底（古井戸）と
// おーぷぬの 板は 地上なし（いまの まま 着いたら 降りる）。
// 地図は 村の タイル（data/village/tiles.ts）を 並べる だけ。DOM も 保存も 使わない（src/sim/villageTests.ts）。

import type { DungeonId } from "../../core/types";
import type { TileDef } from "../../engine/defs";
import { art } from "../village/rpgenArt";
import {
	BATH,
	BEACH,
	base,
	C_ASPHALT,
	C_DIRT,
	C_GRASS,
	CITY,
	CITY7,
	CLIFF,
	DIRT,
	floor,
	GROUND,
	HUT,
	HUT_CITY,
	OUTSKIRTS,
	ROADS,
	road,
	SHRINE,
	solid,
	TURF,
} from "../village/tiles";

type Cell = readonly [x: number, y: number];

export type Surface = {
	dungeon: DungeonId;
	/** 地名（着いた ときの 札）。 */
	name: string;
	rows: readonly string[];
	/** 行の 字の 絵（村の タイルの まぜあわせ）。 */
	tiles: Record<string, TileDef>;
	/** 着く マス（船・道の はし。上を 向く）。 */
	arrive: Cell;
	/** 町へ もどる マス（着く マスの 1つ下）。 */
	back: Cell;
	/** ダンジョンの 入口（踏むと 降りる）。 */
	mouth: Cell;
	/** 立て札。 */
	sign: Cell;
	/** 立て札の 文。 */
	line: string;
};

/** 旗（独立の 旗・祭りの のぼり）。 */
const FLAG = solid(C_GRASS, TURF, art("banner"));

const dirt = { ".": floor(C_DIRT, DIRT) };
const asphalt = { ".": floor(C_ASPHALT, road(0)) };

// 立て札の 文（その 板の 事件の 入り口。STORY.md §4.9）
export const SURFACES: readonly Surface[] = [
	{
		dungeon: "shallow",
		name: "パン板国境の関所",
		// パン屋（扉が 地下の 窯への 入口）・関所の 柵と 独立の 旗
		rows: [
			"bbbbbbbbbbbbbbb",
			"b,,,zzCzz,,,,,b",
			"b,,,ZZZZZ,,,,,b",
			"b,,,[J[J[,,,,,b",
			"b,,,]]e]],i,,,b",
			"b,,,,,.,,,,,,,b",
			"b,^,,,.,,,,^,,b",
			"メメメメメ,.,メメメメメメメ",
			"b,,,旗,.,旗,,,,,b",
			"b,,,,,.,,,,,,,b",
			"b,%,,,.,,,,%,,b",
			"bbbbbb.bbbbbbbb",
		],
		tiles: {
			...GROUND,
			...OUTSKIRTS,
			...CITY,
			...CLIFF,
			...HUT,
			...dirt,
			旗: FLAG,
		},
		arrive: [6, 10],
		back: [6, 11],
		mouth: [6, 4],
		sign: [10, 4],
		line: "国境の関所。『パン国独立』の旗がゆれている。",
	},
	{
		dungeon: "kinoko",
		name: "きのこ板森の入口",
		// きのこの 森（行進の 出発点）。崖の 口が 地下の 菌床
		rows: [
			"111111111111111",
			"222222222222222",
			"333333333333333",
			"4444444M4444444",
			"b^,,,,;.;,i,,^b",
			"bT,,%,,.,,,%,Tb",
			"b,,^,,,.,,,^,,b",
			"bT,,,;,.,;,,,Tb",
			"b,,%,,,.,,,%,,b",
			"b^,,,,,.,,,,,^b",
			"b,,,,,,.,,,,,,b",
			"bbbbbbb.bbbbbbb",
		],
		tiles: { ...GROUND, ...OUTSKIRTS, ...CLIFF, ...dirt },
		arrive: [7, 10],
		back: [7, 11],
		mouth: [7, 3],
		sign: [10, 4],
		line: "きのこの森。ここから行進が出ていったらしい。",
	},
	{
		dungeon: "main",
		name: "風呂板銭湯街",
		// 銭湯の 並ぶ 通り。まんなかの 銭湯の のれんが 源泉への 入口
		rows: [
			"bbbbbbbbbbbbbbb",
			"b,,,,БЦБББ,,,,b",
			"b,,,,ДДДДД,,,,b",
			"b,,,,ЖЗЖЗЖ,,,,b",
			"b,,,,ИИЛИИ,,,,b",
			"bゆゆゆゆゆゆゆゆゆiゆゆゆb",
			"b,ゃ,,,,.,,,,ゃ,b",
			"b,,,,,,.,,,,,,b",
			"b,%,,,,.,,,,%,b",
			"b,,,,,,.,,,,,,b",
			"b,,,,,,.,,,,,,b",
			"bbbbbbb.bbbbbbb",
		],
		tiles: {
			...GROUND,
			...OUTSKIRTS,
			...ROADS,
			...BATH,
			...dirt,
			i: CITY7.i,
		},
		arrive: [7, 10],
		back: [7, 11],
		mouth: [7, 4],
		sign: [10, 5],
		line: "銭湯街。のれんに『42℃以外お断り』。",
	},
	{
		dungeon: "deep",
		name: "電池板発電所の町",
		// 消えかけの 発電所の 町。電柱の 先、崖の 口が 送電鉄塔への 入口
		rows: [
			"111111111111111",
			"222222222222222",
			"333333333333333",
			"4444444M4444444",
			"bぢ,,,,ゆ.ゆ,i,,ぢb",
			"b,,,,,ゆ.ゆ,,,,,b",
			"bぢ,,,,ゆ.ゆ,,,,ぢb",
			"b,,=,,ゆ.ゆ,,=,,b",
			"bぢ,,,,ゆ.ゆ,,,,ぢb",
			"b,,,,,ゆ.ゆ,,,,,b",
			"b,,,,,ゆ.ゆ,,,,,b",
			"bbbbbbb.bbbbbbb",
		],
		tiles: {
			...GROUND,
			...OUTSKIRTS,
			...ROADS,
			...CITY,
			...CLIFF,
			...asphalt,
		},
		arrive: [7, 10],
		back: [7, 11],
		mouth: [7, 3],
		sign: [10, 4],
		line: "発電所の町。町の電気はここから来ている。",
	},
	{
		dungeon: "tropical",
		name: "離島板島の浜",
		// 島の 浜（船で 桟橋に 着く）。崖の 口が 島の 山への 入口
		rows: [
			"111111111111111",
			"222222222222222",
			"333333333333333",
			"4444444M4444444",
			"b,,,,,,.,i,,,,b",
			"さささささささ.さささささささ",
			"さなささいささ.さささいさなさ",
			"さささささささ.さささささささ",
			"ささなささささ.ささささなささ",
			"うううううううはううううううう",
			"うううううううはううううううう",
			"うううううううはううううううう",
		],
		tiles: {
			...GROUND,
			...BEACH,
			...CLIFF,
			".": BEACH.さ,
		},
		arrive: [7, 10],
		back: [7, 11],
		mouth: [7, 3],
		sign: [9, 4],
		line: "島の浜。総島民は6人らしい。",
	},
	{
		dungeon: "konamono",
		name: "おんたこ雑居ビルの前",
		// 大阪の 雑居ビル（扉が 入口）。たこパ会場の 看板
		rows: [
			"bbbbbbbbbbbbbbb",
			"b,,,,zzCzz,,,,b",
			"b,,,,ZZZZZ,,,,b",
			"b,,,,J[看[J,,,,b",
			"b,,,,]]e]],,,,b",
			"bゆゆゆゆゆゆゆゆゆiゆゆゆb",
			"b.............b",
			"b.............b",
			"bゆゆゃゆゆゆゆゆゆゆゃゆゆb",
			"b,,,,,,ゆ,,,,,,b",
			"b,,,,,,ゆ,,,,,,b",
			"bbbbbbbゆbbbbbbb",
		],
		tiles: {
			...GROUND,
			...ROADS,
			...HUT_CITY,
			...asphalt,
			i: CITY7.i,
			看: solid("#c8aa4a", base(1, 73), art("signRed")),
		},
		arrive: [7, 10],
		back: [7, 11],
		mouth: [7, 4],
		sign: [10, 5],
		line: "雑居ビルの前。『たこパ会場こちら』のはり紙。",
	},
	{
		dungeon: "festival",
		name: "お祭り会場やぐらの下",
		// 祭りの 参道（鳥居・ちょうちん・のぼり）。崖の 口が やぐらへの 入口
		rows: [
			"111111111111111",
			"222222222222222",
			"333333333333333",
			"4444444M4444444",
			"b,旗,,,,.,i,,旗,b",
			"b,,,L,,.,,L,,,b",
			"b,,,,,,Φ,,,,,,b",
			"b,,,L,,.,,L,,,b",
			"b,旗,,,,.,,,,旗,b",
			"b,,,L,,.,,L,,,b",
			"b,,,,,,.,,,,,,b",
			"bbbbbbb.bbbbbbb",
		],
		tiles: {
			...GROUND,
			...CLIFF,
			...SHRINE,
			...dirt,
			旗: FLAG,
		},
		arrive: [7, 10],
		back: [7, 11],
		mouth: [7, 3],
		sign: [9, 4],
		line: "祭りの参道。太鼓の音が鳴りやまない。",
	},
];

/** その 板の 地上（無ければ null＝いまの まま 着いたら 降りる）。 */
export const surfaceOf = (d: DungeonId): Surface | null =>
	SURFACES.find((s) => s.dungeon === d) ?? null;

/** 地上の 地図の id。 */
export const surfaceMapId = (d: DungeonId): string => `s_${d}`;

/** 地図の id から 地上（地上の 地図で なければ null）。 */
export const surfaceOfMap = (map: string): Surface | null =>
	SURFACES.find((s) => surfaceMapId(s.dungeon) === map) ?? null;
