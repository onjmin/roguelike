// 町が 育つと 建つ 施設（STORY.md §5.75 の 町割り）。1つの 施設を ここに 1つ 書けば、村の 地図の 外観・扉・
// 中の 部屋・調べる 物・中の 人・外の 物（釣り場など）が そろう。DOM も 保存も 使わない
// （スクリプトは ui/facilities.ts、試験は src/sim/villageTests.ts）。
//
// - 建つ 段（from）から、建てかえの 段（until）の 前まで 立つ（交番 → 警察署 のように 同じ 所で 建てかわる）。
// - 外観は 3つの 書き方：
//     grid      絵を マスごとに 並べる（店・役所・家・車。RPGEN の 部品＝rpgenArt.ts の art() と Base.png）。字は 自動で 割りふる。
//     building  ふつうの 家（屋根の 棟・軒、壁の 上段・下段。扉は 下段。Base.png の 家・壁・屋根）。字は 自動で 割りふる。
//     block     自分で 字を 並べる（グラウンド・桟橋など。字と 絵は tiles に）。
// - clear は 外観の 前に 敷く 地面（森を 開いた 草地・道。地図の 座標で 左上から 右へ）。
// - 中（room）が あれば 扉を 踏むと 入る。部屋の 形は 本館・建物の 中と 同じ（上に 天井と 壁 2段、下に マット 2マス）。
//   家具・小物は RPGEN の 部品（rpgenArt.ts の ri・riCell。rpgen-interior.png）と Base.png。幅の ある 物（台・車）は
//   riCell で マスごとに、背の 高い 物（冷蔵ケース・ロッカー）は ri で 下から 1本に 切って 上の マスへ はみ出させる。
// - 外の 物（outdoor）は 地図の マスに 見えない イベントを 置き、そこの 絵を 調べる。fishing・batting は 遊べる 物。
//   sprite が あれば 見える 人（屋台の 店番）。
// - 飲食店は data/village/eateries.ts（FACILITIES の うしろに 足す）。店番・券売機の eat で 品書き（ui/eat.ts）。
// どれも 寄り道で、強さには 何も 効かない（冒険に 力を 持ちこまない）。

import type { TileDef } from "../../engine/defs";
import type { Dir } from "../../engine/types";
import { EATERIES } from "./eateries";
import type { Cell } from "./map";
import { art, ri, riCell } from "./rpgenArt";
import {
	ASPHALT,
	BRICK,
	base,
	basePx,
	big,
	C_ASPHALT,
	C_BRICK,
	C_WALK,
	counter,
	floor,
	INDOOR,
	onTop,
	road,
	SIDEWALK,
	solid,
} from "./tiles";

/** 立つ 所と 向き。 */
export type FacilitySpot = { x: number; y: number; dir: Dir };

/** ふつうの 家の 外観（幅 w。屋根 2段 ＋ 壁 tall＋1 段）。 */
export type BuildingLook = {
	kind: "building";
	w: number;
	/** 屋根の 色（Base.png 81〜84 行の 列。0 木・1 橙・2 青・3 赤・4 灰の 瓦・5 灰の 板・6 わら・7 黒い 石）。 */
	roof: number;
	/** 壁（Base.png の 上段の 行。55 板・57 和室・59 白・61 赤レンガ・63 白レンガ・65 緑の レンガ・67 石・69 灰・71 ビルの 窓・73 黄色・75 しま・77 白と 腰板）。 */
	wall: number;
	/** 壁の 上段の 数（ふつう 1。ビルは 2〜3）。 */
	tall?: number;
	/** 扉の 位置（左から。省くと まんなか）。 */
	door?: number;
	/** 扉の 絵の 列（Base.png の 壁の 行の 列。省くと 7）。 */
	doorCol?: number;
	/** 扉の 上の 看板（Base.png 95〜96 行の 店看板など）。 */
	sign?: string;
	/** 上段に 窓を あける（省くと あける。71 ビルは もとから 窓）。 */
	windows?: boolean;
	/** 扉は しまって いて 入れない（家・海上レストラン。扉の マスを 調べると 外の 物の 文）。 */
	closed?: boolean;
};

/** 字を 並べた 外観（グラウンド・桟橋など）。door は 区画の 中の 扉の マス（中が ある ときだけ）。 */
export type BlockLook = {
	kind: "block";
	rows: readonly string[];
	tiles: Record<string, TileDef>;
	door?: Cell;
};

/**
 * 絵を 並べた 外観（RPGEN の 部品と Base.png を マスごとに 重ねる）。rows の 字は この 施設の 中だけの キーで、
 * " " は 地図の まま（L 字の 建物の すき間など）。字は 施設ごとに 自動で 割りふる（facilityBlock）。
 */
export type GridLook = {
	kind: "grid";
	rows: readonly string[];
	/** キー → 下から 重ねる 絵（art() / base() / basePx()）。地面は 自動で いちばん 下に 敷く。 */
	keys: Record<string, readonly string[]>;
	/** 透けた 部品の 下の 地面（省くと 芝。none は 敷かない＝車の キーに 車線の 絵を 自分で 入れる）。 */
	ground?: "grass" | "sand" | "pier" | "quay" | "none";
	/**
	 * 扉の キー（rows に 1つだけ）。中（room）が ある 施設だけ 通れて、踏むと 入る。中が ない 施設（家・海上レストラン・
	 * 中の ない 店）は 通れない 扉の 絵で、そこに 外の 物（表札・品書き）を 置く。
	 */
	door?: string;
	/** 通れる キー（並べた 字。屋台の 台の うしろ＝店番の 立つ 所）。 */
	floor?: string;
	/** 台の キー（並べた 字。向こうの 人・物に 台ごしに 話しかけられる。屋台の 台）。 */
	counter?: string;
	/** 影を 落とすか（省くと 落とす。車・バス停は false）。 */
	shadow?: boolean;
};

export type RoomLook = {
	floor: string;
	floorColor: string;
	up: string;
	low: string;
	wallColor: string;
};

/** 部屋の 絵の 道具（床に 置く 物・壁の 上段・下段・通れる 床）。 */
export type RoomKit = {
	on: (...refs: string[]) => TileDef;
	up: (...refs: string[]) => TileDef;
	low: (...refs: string[]) => TileDef;
	floor: (...refs: string[]) => TileDef;
};

export type FacilityPerson = {
	id: string;
	walk: string;
	at: Cell;
	dir: Dir;
	/** 名前欄（名無しの 店番なら「店主」など）。 */
	name: string;
	lines: readonly string[];
	/**
	 * 話すと 品書きが 出る 店番（eat。data/eateries.ts の EAT_MENUS[施設の id]。話す たびに lines を 1つ
	 * 出して から 品書き。ui/eat.ts）。
	 */
	play?: "eat";
};

export type FacilityRoom = {
	rows: readonly string[];
	look: RoomLook;
	tiles?: (k: RoomKit) => Record<string, TileDef>;
	/** 字 → 調べる 物の id（同じ 物が 何マスでも 1つの 話）。 */
	things: Record<string, string>;
	/** 物の id → 文（窓ごと）。 */
	lines: Record<string, readonly string[]>;
	people?: readonly FacilityPerson[];
	/**
	 * 調べると 遊べる 物（物の id → 遊び。駅の 改札＝電車で どの 板へも 出かけられる・ファミレスの
	 * ドリンクバー＝1杯 注いで その場で 飲む・飲食店の 券売機＝品書き。ui/eat.ts）。
	 */
	plays?: Record<string, "depart" | "drinkbar" | "eat">;
};

export type OutdoorThing = {
	id: string;
	at: Cell;
	lines: readonly string[];
	/** 遊べる 物（釣り・1打席・バス＝どの 板へも 出かけられる・eat＝その 施設の 品書き）。 */
	play?: "fishing" | "batting" | "bus" | "vend" | "eat";
	/** 見える 人（屋台の 店番の 歩行グラ）。あれば 地図に 立って 通れない。lines は その 人の セリフ。 */
	sprite?: string;
	dir?: Dir;
	/** 見える 人の 名前欄。 */
	name?: string;
};

export type Facility = {
	id: string;
	/** 中に 入った ときの 札・扉の 名前。 */
	name: string;
	from: number;
	until?: number;
	/** 外観の 左上（地図の 座標）。 */
	at: Cell;
	look: BuildingLook | BlockLook | GridLook;
	/** 地面（x, y, 字の 並び, この 段から 敷かない）。 */
	clear?: readonly (readonly [number, number, string, number?])[];
	/** 扉を 踏んで 入る ときの 1窓（村に いる あいだ 1回）。 */
	door?: string;
	room?: FacilityRoom;
	outdoor?: readonly OutdoorThing[];
};

// ───────────────── 部屋の 見た目 ─────────────────

// 床と 壁は Base.png（壁は 上段・下段の 行）と、RPGEN の 床（rpgen-interior.png の fl〜。ri）
const look = (
	floor: string,
	floorColor: string,
	up: string,
	low: string,
	wallColor: string,
): RoomLook => ({ floor, floorColor, up, low, wallColor });
/** 白い 壁と 腰の 幅木（Base.png 507・508 行。コンビニ・交番・病院・警察署・港湾事務所）。 */
const MODERN_UP = base(0, 507);
const MODERN_LOW = base(0, 508);

const LOOKS = {
	// 板の 床と 黄色い 板の 壁（海の家）
	beach: look(base(0, 46), "#b8905a", base(1, 73), base(1, 74), "#c8a86a"),
	// 畳（Base.png 434〜436 行）と 和室の 壁（碁会所）
	tatami: look(base(0, 436), "#b8b878", base(1, 57), base(1, 58), "#8a6a3a"),
	konbini: look(ri("flWhite"), "#e4e4e0", MODERN_UP, MODERN_LOW, "#e8e8e4"),
	koban: look(base(3, 48), "#9a9a9a", MODERN_UP, MODERN_LOW, "#e8e8e4"),
	// 水色の タイル（診療所・総合病院）
	clinic: look(ri("flBlue"), "#c8e0f0", MODERN_UP, MODERN_LOW, "#e8e8e4"),
	// 灰色の タイル（警察署・港湾事務所）
	office: look(ri("flGrey"), "#b0b0b0", MODERN_UP, MODERN_LOW, "#e8e8e4"),
	dojo: look(base(0, 46), "#b8905a", base(1, 57), base(1, 58), "#8a6a3a"),
	// 濃い 板の 床と しっくいの 壁（質屋）
	wafu: look(base(0, 47), "#5a4030", base(1, 57), base(1, 58), "#8a6a3a"),
	wood: look(base(0, 46), "#b8905a", base(1, 73), base(1, 74), "#9a7a4a"),
	plank: look(base(0, 46), "#b8905a", base(1, 55), base(1, 56), "#6a4a2a"),
	// 灰色の 壁と コンクリートの 床（ガレージ・整備工場）
	garage: look(base(3, 46), "#9a9a9a", base(1, 69), base(1, 70), "#a8a8a8"),
	arcade: look(ri("flRed"), "#a03018", base(1, 69), base(1, 70), "#a8a8a8"),
	gym: look(base(4, 48), "#4a4a4a", base(1, 63), base(1, 64), "#d8d8d8"),
	bar: look(base(0, 47), "#5a4030", base(1, 61), base(1, 62), "#a84a3a"),
	court: look(base(0, 47), "#5a4030", base(1, 55), base(1, 56), "#6a4a2a"),
	// 映画館：黒い 幕の 壁（Base.png 358〜360 行の 黒い カーテン）
	cinema: look(base(4, 48), "#3a3a3a", base(3, 359), base(3, 360), "#202020"),
	theater: look(base(0, 47), "#5a4030", base(1, 61), base(1, 62), "#a84a3a"),
	// カジノ：赤い 幕の 壁と 金の 模様の じゅうたん
	casino: look(
		ri("flCarpet"),
		"#c04010",
		base(6, 359),
		base(6, 360),
		"#a01010",
	),
	fireStation: look(
		base(3, 46),
		"#9a9a9a",
		base(1, 61),
		base(1, 62),
		"#a84a3a",
	),
	station: look(base(3, 48), "#9a9a9a", base(1, 63), base(1, 64), "#d8d8d8"),
} as const satisfies Record<string, RoomLook>;

const PAPER = basePx(32, 1446);
const WINDOW = basePx(48, 1382);
/** 台（台ごしに 向こうの 人・物と 話せる。ui/village.ts は 台の マスの 物を 先に 読むので、人の 前の 台に 物は 置かない）。 */
const ctr = <T extends object>(t: T) => ({ ...t, counter: true });
/** 壁の 丸い 時計（Base.png 507 行）。 */
const CLOCK = base(7, 507);

// ───────────────── 施設 ─────────────────

/** 名無し（本館の 中の 人と 同じ 絵。data/village/hall.ts の NANASHI_WALK）。 */
const NANASHI = ["sa:xjuotB", "sa:qPN3cT", "sa:C2hS8U", "sa:VaBXqn"] as const;

const C_PIER = "#a8804c";
const C_FIELD = "#b08a5a";
const C_GRASS = "#97bc25";
const TURF = base(0, 4);

/** 絵を 並べた 外観の 扉の マス（外観の 左上から。扉の キーが 無ければ null）。 */
const gridDoor = (g: GridLook): Cell | null => {
	if (!g.door) return null;
	for (const [y, r] of g.rows.entries()) {
		const x = [...r].indexOf(g.door);
		if (x >= 0) return [x, y];
	}
	return null;
};

/** 住宅街の 家（入れない。扉の マスに 表札。until の 段で 都市の 建物に 建てかわる）。 */
const house = (
	id: string,
	at: Cell,
	look: GridLook,
	plate: readonly string[],
	until?: number,
): Facility => {
	const [dx, dy] = gridDoor(look) ?? [0, look.rows.length - 1];
	return {
		id,
		name: "家",
		from: 6,
		until,
		at,
		look,
		outdoor: [{ id: "plate", at: [at[0] + dx, at[1] + dy], lines: plate }],
	};
};

// ───────────────── 外観の 部品（RPGEN。scripts/pack-rpgen.mjs） ─────────────────

/**
 * 平らな 屋根の 2段（上の ふち ( - )・下の ふち [ = ]。* 給水タンク・~ 室外機・% 天窓・& 下の ふちに 室外機）。
 * ROOF_FLAT は 白い ふちの 屋上（店・役所）、ROOF_SLAB は 灰色の 板の 屋上（工場・倉庫・ビル）。
 * 施設の キーと かぶらない よう、この 字は 屋根だけに 使う。
 */
const roofKeys = (
	under: readonly string[],
	name: "roofFlat" | "roofSlab",
): Record<string, readonly string[]> => ({
	"(": [...under, art(name)],
	"-": [...under, art(name, 1)],
	")": [...under, art(name, 2)],
	"[": [...under, art(name, 0, 1)],
	"=": [...under, art(name, 1, 1)],
	"]": [...under, art(name, 2, 1)],
	"*": [...under, art(name, 1), art("waterTank")],
	"~": [...under, art(name, 1), base(3, 394)],
	"%": [...under, art(name, 1, 1), art("skylight")],
	"&": [...under, art(name, 1, 1), base(3, 394)],
});
const ROOF_FLAT = roofKeys([art("concrete")], "roofFlat");
const ROOF_SLAB = roofKeys([], "roofSlab");
/** 赤い 提灯（Base.png。半マス ずれて いるので 画素で 切る）。 */
const LANTERN = basePx(35, 4754, 10, 13);

/** 止まっている 車（4×2 マス。上の 段と 下の 段の 車線の 絵の 上に 車。どの マスも 通れない）。 */
const car = (
	id: string,
	at: Cell,
	name: "sedanE" | "sedanBlueW" | "wagonE" | "wagonWhiteW",
	lanes: readonly [number, number],
): Facility => ({
	id,
	name: "車",
	from: 6,
	at,
	look: {
		kind: "grid",
		ground: "none",
		shadow: false,
		rows: ["0123", "4567"],
		keys: Object.fromEntries(
			Array.from({ length: 8 }, (_, i) => [
				String(i),
				[road(lanes[i >> 2]), art(name, i % 4, i >> 2)],
			]),
		),
	},
});

const STREET_IMG = "pub:sprites/street.png";
/** 自販機の 字（施設ごとに 1字。地面の 上に 立てる）。コンビニと ゲームセンターの 自販機は 外観の 中（2マス幅）。 */
const VENDING_CHARS: Record<string, string> = {
	vend_beach: "じ",
	vend_bus: "ぜ",
};

/** 自販機（16x32。色は 0 赤・1 青・2 白。scripts/make-street.mjs）。 */
const vending = (
	id: string,
	at: Cell,
	color: 0 | 1 | 2,
	from: number,
	ground: "sand" | "grass",
): Facility => {
	const ch = VENDING_CHARS[id] ?? "じ";
	const img = `${STREET_IMG}#${176 + color * 16},0,16,32`;
	return {
		id,
		name: "自販機",
		from,
		at,
		look: {
			kind: "block",
			rows: [ch],
			tiles: {
				[ch]:
					ground === "sand"
						? solid("#ecd9a0", base(4, 4), img)
						: solid(C_GRASS, TURF, img),
			},
		},
		outdoor: [
			{
				id: "vend",
				at,
				lines: ["自販機。\n……ちょうど、のどが　かわいていた。"],
				play: "vend",
			},
		],
	};
};

/**
 * 町の 中心の 道ばたの 調べる 物（1マス。郵便ポスト・広場の 時計・電話ボックス。絵は scripts/make-street.mjs）。
 * 足もとの 地面は 施設の 絵に 入れるので、地面が かわる 段で 別の 施設に 分ける（郵便ポストは 草地 → 歩道）。
 */
const fixture = (
	id: string,
	name: string,
	at: Cell,
	from: number,
	ch: string,
	tile: TileDef,
	lines: readonly string[],
	until?: number,
): Facility => ({
	id,
	name,
	from,
	until,
	at,
	look: { kind: "block", rows: [ch], tiles: { [ch]: tile } },
	outdoor: [{ id: "it", at, lines }],
});
const POST_ART = `${STREET_IMG}#288,0,16,32`;
const POST_LINES = [
	"郵便ポスト。\n取り集めは　1日　2回。",
	"はがきが　1枚　はみ出している。\n宛名は「>>1さんへ」。",
];

/** 畑の あとの 立て札（市民農園と 公園で 同じ 板）。 */
const NAME_BOARD: TileDef = solid(C_GRASS, TURF, base(3, 38));
/** 市民農園の 区画（丸い 土の 畝に 作物）。 */
const plot = (crop: string): TileDef => solid(C_GRASS, TURF, base(3, 28), crop);
/** 公園の 噴水（3×3 の まわりの 道の どこから 調べても 同じ）。 */
const FOUNTAIN: readonly string[] = [
	"噴水。\n底に　小銭が　たくさん　沈んでいる。",
	"……10円玉に、油性ペンで「age」。",
];
/** 公園の ベンチ（2マス幅。どちらの 半分を 調べても 同じ）。 */
const BENCH: readonly string[] = [
	"ベンチ。\n座ると、噴水の　しぶきが　すこし　かかる。",
	"背もたれに「>>1乙」と　彫ってある。",
];

export const FACILITIES: readonly Facility[] = [
	// ── 釣り場（はじめから。桟橋の 西の 突堤。キリコの 趣味は 釣り：公式の プロフィール）
	{
		id: "pier",
		name: "釣り場",
		from: 0,
		at: [15, 39],
		look: {
			kind: "block",
			rows: ["ぬははははは"],
			tiles: {
				は: floor(C_PIER, base(0, 46)),
				// 竿立てと バケツ（突堤の はし。通れない）
				ぬ: solid(C_PIER, base(0, 46), base(4, 123)),
			},
		},
		outdoor: [
			{
				id: "rod",
				at: [15, 39],
				lines: ["突堤の　はしの　釣り場。\n竿が　1本、立てかけてある。"],
				play: "fishing",
			},
		],
	},
	// ── 海の家「age」（村。浜の 西。看板娘は フェリス：おんJの マスコット）
	{
		id: "umi",
		name: "海の家「age」",
		from: 2,
		at: [5, 32],
		// わら屋根・青い 日よけ・氷の 旗・よしず
		look: {
			kind: "grid",
			ground: "sand",
			rows: ["aaaaaa", "dddddd", "kLMRSk", "rwwDwr"],
			door: "D",
			keys: {
				a: [base(6, 82)],
				d: [base(6, 84)],
				L: [art("plank"), art("canopy")],
				M: [art("plank"), art("canopy", 1)],
				R: [art("plank"), art("canopy", 2)],
				k: [art("plank"), art("kooriFlag")],
				S: [art("plank"), base(3, 95)],
				r: [art("reed")],
				D: [art("plank", 0, 1), base(7, 55, 1, 2)],
				w: [art("reed"), art("small25", 3)],
			},
		},
		door: "海の家「age」。\n鉄板の　音と、ソースの　におい。",
		// 中：奥に 冷蔵ケース・かき氷機・クーラー、左に 鉄板の 台（台の うしろに 店主）、
		// 手前に ござの 席 2つ（低い 机に ラムネ）、入口の 床に 砂、すみに ヤシ。壁に 品書き・浮き輪・「氷」の のぼり
		room: {
			look: LOOKS.beach,
			rows: [
				"############",
				"#HiHHAHHWHH#",
				"#hhhhmhkhhh#",
				"#...R...tu.#",
				"#[=].......#",
				"#..........#",
				"#~~~...~~~.#",
				"#~o~...~o~P#",
				"#~~~,,,~~~.#",
				"####DD######",
			],
			tiles: (k) => ({
				i: k.up(ri("iceFlag")),
				A: k.up(base(3, 95)),
				k: k.low(base(7, 297)),
				R: k.on(ri("drinkCase")),
				u: k.on(ri("cooler")),
				t: k.on(ri("ramuneTub")),
				"[": ctr(k.on(riCell("counterLong", 0, 0), ri("yakisoba"))),
				"=": ctr(k.on(riCell("counterLong", 1, 0))),
				"]": ctr(k.on(riCell("counterLong", 2, 0), ri("kakigoriMachine"))),
				"~": k.floor(base(1, 436)),
				o: k.on(base(1, 436), base(5, 312), ri("ramune")),
				",": k.floor(base(4, 4)),
				P: k.on(base(6, 362, 1, 2)),
			}),
			things: {
				m: "menu",
				k: "ukiwa",
				R: "drinks",
				u: "cooler",
				t: "ramune",
				"[": "grill",
				"]": "kakigori",
				o: "table",
				P: "plant",
			},
			lines: {
				menu: [
					"品書き。\n焼きそば・かき氷・ラムネ・イカ焼き。",
					"すみに　小さく「age　て　いこ〜」。\n……フェリスの　字だ。",
				],
				ukiwa: ["浮き輪が　つるしてある。\n「貸し出し　無料。返してや」"],
				drinks: ["冷蔵ケース。\nラムネと　麦茶が　冷えている。"],
				kakigori: ["かき氷機。\nシロップは　いちご・メロン・ブルーハワイ。"],
				cooler: ["クーラーボックス。\nスイカが　まるごと　冷やしてある。"],
				ramune: [
					"たらいの　氷水に　ラムネ。\n「1本　100円。ビー玉は　返してや」",
				],
				grill: [
					"鉄板で　焼きそばが　鳴っている。\n……ソースの　こげる　におい。",
				],
				table: [
					"ござの　席。\nラムネの　ビー玉が　ころがっている。",
					"砂が　すこし　ざらざらする。",
				],
				plant: ["ヤシの　鉢植え。\n葉の　先が　すこし　こげている。"],
			},
			people: [
				{
					id: "umi_master",
					walk: NANASHI[0],
					at: [2, 3],
					dir: "down",
					name: "店主",
					lines: [
						"いらっしゃい。\n焼きそば、大盛りしか　ないで",
						"看板娘？　ああ、外の　鳥の　子な。\n……客、ほんまに　増えたわ",
					],
				},
			],
		},
	},
	// ── 碁会所（村。広場の 西の 森を 開いた 所。キリコの もう 1つの 趣味は 囲碁）
	{
		id: "go",
		name: "碁会所「本因坊」",
		from: 3,
		at: [2, 25],
		clear: [
			[1, 24, ",,,,,,,"],
			[1, 25, ",,,,,,,"],
			[1, 26, ",,,,,,,"],
			[1, 27, ",,,,,,,"],
			[1, 28, ",,,,,,,"],
			[1, 29, ",,,,,,;"],
			[2, 30, ",,,,,"],
		],
		// 灰色の 瓦・和の 店先
		look: {
			kind: "grid",
			rows: ["aaaaa", "ddddd", "01234", "fFDGg"],
			door: "D",
			keys: {
				a: [base(4, 82)],
				d: [base(4, 84)],
				"0": [art("jpLow")],
				"1": [art("jpLow", 1)],
				"2": [art("jpLow", 2)],
				"3": [art("jpLow", 3)],
				"4": [art("jpLow", 4)],
				f: [art("jpFront")],
				F: [art("jpFront", 1)],
				D: [art("jpFront", 2)],
				G: [art("jpFront", 3)],
				g: [art("jpFront", 4)],
			},
		},
		door: "碁会所「本因坊」。\n石を　打つ　音が、ぱちり。",
		// 中：畳に 碁盤 2面と 将棋盤（座布団に すわって 打つ）、奥に 額「本因坊」・柱時計・掛け軸・盆栽、
		// すみに 碁笥の かご・お茶の 台。左の 壁は 松の ふすま
		room: {
			look: LOOKS.tatami,
			rows: [
				"############",
				"#qQHHabHHHH#",
				"#vVhmhhhkhs#",
				"#........B.#",
				"#.zgz..zgz.#",
				"#..........#",
				"#.zgz..zSz.#",
				"#u.......T.#",
				"####DD######",
			],
			tiles: (k) => ({
				q: k.up(base(2, 437)),
				Q: k.up(base(3, 437)),
				v: k.low(base(2, 438)),
				V: k.low(base(3, 438)),
				a: k.up(base(6, 422)),
				b: k.up(base(7, 422)),
				k: k.low(base(2, 116)),
				s: k.low(ri("scroll")),
				B: k.on(base(5, 312), ri("bonsai")),
				z: k.floor(base(3, 311)),
				g: k.on(ri("goban")),
				S: k.on(ri("shogiban")),
				u: k.on(base(1, 124)),
				T: k.on(base(5, 312), ri("kettleBase")),
			}),
			things: {
				a: "plaque",
				b: "plaque",
				m: "rules",
				k: "clock",
				s: "scroll",
				B: "bonsai",
				g: "board",
				S: "shogi",
				u: "stones",
				T: "tea",
			},
			lines: {
				plaque: [
					"額に「本因坊」の　三文字。\n……字が　ちょっと　ゆがんでいる。",
				],
				board: [
					"碁盤。黒と　白の　石が、\nとちゅうまで　ならんでいる。",
					"キリコは　黒を　1つ　置いた。\n……ぱちり。",
				],
				shogi: ["将棋盤。\n王の　まわりが　すかすかだ。"],
				rules: ["はり紙。\n「待った　なし。持ち時間　なし」"],
				clock: ["柱時計。\n……ここだけ、時間が　ゆっくりだ。"],
				scroll: ["掛け軸。\n「一手　入魂」"],
				bonsai: ["盆栽。\n……だれも　手入れの　しかたを　知らない。"],
				stones: ["碁笥（ごけ）の　かご。\n白い　石が　1つ　たりない。"],
				tea: ["お茶の　台。\n急須の　お茶が　すっかり　ぬるい。"],
			},
			people: [
				{
					id: "go_a",
					walk: NANASHI[3],
					at: [2, 4],
					dir: "right",
					name: "名無し",
					lines: [
						"……そこ、打つんか。\nほな、こっちは　ここや",
						"囲碁は　1000手も　かからん。\n……スレより　はよ　終わる",
					],
				},
				{
					id: "go_b",
					walk: NANASHI[1],
					at: [9, 6],
					dir: "left",
					name: "名無し",
					lines: ["ワイ、投了するわ。\n……いや、まだや。まだ　打てる"],
				},
			],
		},
	},
	// ── グラウンド（村。北東の 森を 開いた 野球場。おんJ は 野球の 板）
	{
		id: "ground",
		name: "グラウンド",
		from: 3,
		at: [31, 2],
		// 新市街が できる（段4）までは 森を 開いた 道。そのあとは 北の 通りの 車線
		clear: [[31, 10, ",,,.,,,,", 4]],
		look: {
			kind: "block",
			rows: [
				"へへへへへへへへ",
				"ふふふふふふふふ",
				"ふふふほほふふふ",
				"ふふほほほほふふ",
				"ふほほまほほほふ",
				"ふふほほほほふふ",
				"ふふふほほふふふ",
				"みふふふふふふみ",
			],
			tiles: {
				// バックネット（通れない）・外野の 芝・内野の 土・マウンド・ベンチ
				へ: solid(C_GRASS, TURF, base(3, 30)),
				ふ: floor(C_GRASS, TURF),
				ほ: floor(C_FIELD, base(5, 4)),
				ま: solid(C_FIELD, base(5, 4), basePx(7 * 16, 13 * 16 + 4, 16, 12)),
				み: solid(C_GRASS, TURF, base(0, 121)),
			},
		},
		outdoor: [
			{
				id: "mound",
				at: [34, 6],
				lines: ["マウンド。\n白い　ボールが　1つ　ころがっている。"],
				play: "batting",
			},
			{
				id: "bench",
				at: [31, 9],
				lines: ["ベンチ。\n「保守村　やきう部」と　彫ってある。"],
			},
			{
				id: "net",
				at: [34, 2],
				lines: ["バックネット。\nボールの　あとで、あちこち　へこんでいる。"],
			},
		],
	},
	// ── 交番（街。新市街の 大通りの 北。都市で 警察署に 建てかえ）
	{
		id: "koban",
		name: "保守村　交番",
		from: 4,
		until: 7,
		at: [40, 15],
		// 灰色の 箱・赤い 灯り・鉄の 扉・掲示板・自転車
		look: {
			kind: "grid",
			rows: ["(-~-)", "[===]", "gwRwh", "iPDBb"],
			door: "D",
			keys: {
				...ROOF_SLAB,
				g: [art("gray")],
				h: [art("gray", 2)],
				R: [art("gray", 1), art("redLamp")],
				w: [art("gray", 1), art("win108", 2)],
				i: [art("gray", 0, 1), art("pot", 2)],
				P: [art("gray", 1, 1), art("sign92", 1)],
				D: [art("gray", 1, 1), art("door108")],
				B: [art("gray", 1, 1), art("bike")],
				b: [art("gray", 2, 1), art("bike", 1)],
			},
		},
		door: "交番。\n赤い　灯りが　ともっている。",
		// 中：奥に 掲示板と 休憩室の 扉、左に ロッカー、まんなかの 机（台ごしに 巡査）、
		// 入口の そばに 落とし物の 箱・電気ポット・「パトロール中」の 札
		room: {
			look: LOOKS.koban,
			rows: [
				"##########",
				"#HwHHbcgH#",
				"#hhmhBCGd#",
				"#LJ......#",
				"#lj..n...#",
				"#...[=]..#",
				"#........#",
				"#x....oP.#",
				"####DD####",
			],
			tiles: (k) => ({
				w: k.up(ri("winModern")),
				b: k.up(riCell("corkBoard", 0, 0)),
				c: k.up(riCell("corkBoard", 1, 0)),
				g: k.up(riCell("corkBoard", 2, 0)),
				B: k.low(riCell("corkBoard", 0, 1)),
				C: k.low(riCell("corkBoard", 1, 1)),
				G: k.low(riCell("corkBoard", 2, 1)),
				d: k.low(base(4, 507, 1, 2)),
				L: k.on(riCell("lockers", 0, 0)),
				J: k.on(riCell("lockers", 1, 0)),
				l: k.on(riCell("lockers", 0, 1)),
				j: k.on(riCell("lockers", 1, 1)),
				n: k.floor(ri("chairDarkDown")),
				"[": ctr(k.on(riCell("deskDark", 0, 0), ri("phone"))),
				"=": ctr(k.on(riCell("deskDark", 1, 0))),
				"]": ctr(k.on(riCell("deskDark", 2, 0), ri("laptop"))),
				x: k.on(ri("boxesB")),
				o: k.on(base(2, 108), ri("riceCooker")),
				P: k.on(ri("standSign")),
			}),
			things: {
				m: "wanted",
				B: "board",
				C: "board",
				G: "board",
				d: "door",
				J: "locker",
				l: "locker",
				j: "locker",
				"[": "desk",
				"]": "desk",
				x: "lost",
				o: "pot",
				P: "patrol",
			},
			lines: {
				wanted: ["手配書。\n「荒らしを　見かけたら　通報を」"],
				board: [
					"掲示板。\n「自転車の　鍵かけ　強化月間」",
					"すみに「スレの　鍵も　かけよう」。",
				],
				door: ["奥の　扉。\n「休憩室」。……いびきが　聞こえる。"],
				locker: ["ロッカー。\n名札は「巡査」「巡査長」「予備」。"],
				desk: ["机。\n日誌に「本日も　異常なし。保守　1件」"],
				lost: ["落とし物の　箱。\n片方だけの　手袋と、トリップの　メモ。"],
				pot: ["電気ポット。\n湯のみが　2つ　ふせてある。"],
				patrol: ["立て札「パトロール中」。\n……巡査は　机に　いる。"],
			},
			people: [
				{
					id: "koban_cop",
					walk: NANASHI[2],
					at: [5, 4],
					dir: "down",
					name: "巡査",
					lines: [
						"事件？　ないない。\n……あるのは　レスバ　くらいや",
						"IP　抜かれたら　ここに　来てな。\n……冗談や",
					],
				},
			],
		},
	},
	// ── 消防団の 詰所（街。大通りの 北の 東。都市で 消防署に 建てかえ）
	{
		id: "fire",
		name: "消防団の　詰所",
		from: 4,
		until: 7,
		at: [70, 15],
		// 赤い 軒・板壁・半鐘・赤い シャッター・防火用水の 樽
		look: {
			kind: "grid",
			rows: ["aaaaa", "ddddd", "BggLM", "igDlm"],
			door: "D",
			keys: {
				a: [art("eave")],
				d: [art("eave", 0, 1)],
				B: [base(1, 55), base(4, 88)],
				g: [base(1, 55)],
				L: [base(1, 55), art("shutterRed")],
				M: [base(1, 55), art("shutterRed", 1)],
				i: [base(1, 56), base(3, 125)],
				D: [base(1, 56), base(7, 55, 1, 2)],
				l: [base(1, 56), art("shutterRed")],
				m: [base(1, 56), art("shutterRed", 1)],
			},
		},
		door: "消防団の　詰所。\n法被が　かけてある。",
		// 中：奥に 半鐘・法被・当番表、防火用水の 樽と バケツ、まんなかに 小上がりの 畳
		// （将棋盤と やかん）、すみに 消火器と ホースの 巻き。窓の 上に ちょうちん
		room: {
			look: LOOKS.plank,
			rows: [
				"############",
				"#HHlHHWHHlH#",
				"#hkhhppphmh#",
				"#e.UU.....b#",
				"#..........#",
				"#....~~~~..#",
				"#....~oO~..#",
				"#xx.......F#",
				"####DD######",
			],
			tiles: (k) => ({
				l: k.up(LANTERN),
				k: k.low(base(4, 88)),
				p: k.low(base(1, 349)),
				b: k.on(ri("bucket")),
				"~": k.floor(base(0, 436)),
				o: k.on(base(0, 436), ri("shogiban")),
				O: k.on(base(0, 436), base(5, 312), ri("kettle")),
				e: k.on(ri("extinguisher")),
				x: k.on(base(0, 489)),
			}),
			things: {
				k: "bell",
				p: "happi",
				m: "duty",
				U: "water",
				b: "buckets",
				o: "shogi",
				O: "kettle",
				e: "extinguisher",
				x: "hose",
				F: "plant",
			},
			lines: {
				bell: ["半鐘。\n……鳴らすのは、火事の　ときだけ。"],
				happi: ["法被が　かけてある。\n背中に「保守」の　白い　字。"],
				duty: ["当番表。\n「火の用心　見回り：名無し」"],
				water: ["防火用水の　樽。\nなみなみと　水が　入っている。"],
				buckets: ["バケツの　山。\n「消火用」と　赤い　字。"],
				shogi: ["将棋盤。\n……待機中の　勝負の　とちゅう。"],
				kettle: ["やかん。\n湯のみが　2つ　ならんでいる。"],
				extinguisher: ["消火器。\nスレが　燃えたら　つかうらしい。"],
				hose: ["ホースの　巻き。\n……ちょっと　かびくさい。"],
				plant: ["鉢植え。\n……水は　たっぷり　もらっている。"],
			},
			people: [
				{
					id: "fire_man",
					walk: NANASHI[0],
					at: [3, 5],
					dir: "down",
					name: "団員",
					lines: [
						"火事は　ないで。\n……炎上なら　毎日　しとるけどな",
						"消火器は　入口や。\nスレが　燃えたら　つかってな",
					],
				},
			],
		},
	},
	// ── コンビニ「おんJマート」（街。南の 通りの 西）
	{
		id: "konbini",
		name: "おんJマート",
		from: 4,
		at: [40, 26],
		// 白い 箱・青い 帯に SHOP・ガラスの 店先・自動ドア・屋上の 室外機。右の 角に 赤い 自販機（2マス幅）
		look: {
			kind: "grid",
			rows: ["(-~-) ", "[=&=] ", "gSGGh ", "iIDIVW"],
			door: "D",
			keys: {
				...ROOF_FLAT,
				g: [art("white", 0, 1), art("band")],
				G: [art("white", 1, 1), art("band", 1)],
				h: [art("white", 2, 1), art("band", 2)],
				S: [art("white", 1, 1), art("band", 1), art("sign25")],
				i: [art("white", 0, 2), art("glass", 1), art("shopGlass")],
				I: [art("white", 1, 2), art("glass", 1), art("shopGlass", 1)],
				D: [art("white", 1, 2), art("autoDoor", 0, 1)],
				V: [art("white", 2, 2), art("vend", 0, 0, 1, 2)],
				W: [art("vend", 1, 0, 1, 2)],
			},
		},
		door: "おんJマート。\n入店の　チャイムが　鳴った。",
		// 中：奥の 壁に 飲み物の 冷蔵ケース、まんなかに 棚 2列、入口の 左に レジ（店員は 台の うしろ）、
		// 右の 奥に コピー機・ATM・お手洗い、右に アイスの ケース、入口の そばに 分別の ゴミ箱と 雑誌
		room: {
			look: LOOKS.konbini,
			rows: [
				"##############",
				"#HHpHHpHQHHgH#",
				"#hhhhhhhhhmhd#",
				"#RRRRRR..c.P.#",
				"#............#",
				"#CyySTST.STiI#",
				"#...stst.st..#",
				"#[=].........#",
				"#.......bBvMN#",
				"#####DD#######",
			],
			tiles: (k) => ({
				p: k.up(ri("poster")),
				Q: k.up(CLOCK),
				g: k.up(ri("signRestroom")),
				d: k.low(base(5, 507, 1, 2)),
				R: k.on(ri("drinkCase")),
				c: k.on(base(1, 393, 1, 2)),
				P: k.on(ri("atm")),
				C: k.on(riCell("whiteCounter", 0, 0), ri("coffeeMaker")),
				y: k.on(riCell("yellowCounter", 0, 0)),
				S: k.on(riCell("shelfGoods", 0, 0)),
				T: k.on(riCell("shelfGoods", 1, 0)),
				s: k.on(riCell("shelfGoods", 0, 1)),
				t: k.on(riCell("shelfGoods", 1, 1)),
				"[": ctr(k.on(riCell("whiteCounter", 0, 0))),
				"=": ctr(k.on(riCell("whiteCounter", 1, 0), ri("register"))),
				"]": ctr(k.on(riCell("whiteCounter", 1, 0))),
				i: k.on(riCell("iceChest", 0, 0)),
				I: k.on(riCell("iceChest", 1, 0)),
				M: k.on(riCell("lowShelfB", 0, 0)),
				N: k.on(riCell("lowShelfB", 1, 0)),
				b: k.on(ri("binCans")),
				B: k.on(ri("binPet")),
				v: k.on(ri("binBurn")),
			}),
			things: {
				R: "fridge",
				Q: "clock",
				m: "notice",
				d: "toilet",
				c: "copier",
				P: "atm",
				C: "coffee",
				y: "hot",
				S: "shelf",
				T: "shelf",
				s: "shelf",
				t: "shelf",
				"[": "register",
				"]": "register",
				i: "ice",
				I: "ice",
				M: "magazine",
				N: "magazine",
				b: "bins",
				B: "bins",
				v: "bins",
			},
			lines: {
				fridge: [
					"冷蔵ケース。\nラムネ・麦茶・エナドリが　ならぶ。",
					"いちばん　下の　段に「保守水」。\n……ラベルが　手書きだ。",
				],
				clock: ["時計。\n……5分　進めてある。"],
				notice: ["はり紙。\n「24時間　営業。保守も　24時間」"],
				toilet: [
					"お手洗い。\n「使用中」の　札が　かかっている。",
					"中から「……もう　ちょい」と　声。",
				],
				copier: ["コピー機。\n……スレの　まとめを　刷った　あと。"],
				atm: ["ATM。\n画面に「ただいま　保守中」。"],
				coffee: ["コーヒーマシン。\n「S　100円。Lは　気持ち」"],
				hot: [
					"ホットスナックの　ケース。\n「おんJチキ」が　1つだけ　残っている。",
				],
				shelf: [
					"棚。\nカップ麺と、のり弁と、電池。",
					"「新商品」の　札。\n……去年から　ずっと　新商品だ。",
				],
				register: ["レジ。\n「ポイントカードは　お持ちですか」"],
				ice: ["アイスの　ケース。\nソーダ味の　棒アイスが　ぎっしり。"],
				magazine: [
					"雑誌の　棚。\n「月刊　保守」「週刊　おんJ」。",
					"「立ち読み　ご遠慮ください」\n……キリコは　そっと　棚に　もどした。",
				],
				bins: ["ゴミ箱。\n「缶」「ペットボトル」「燃える」。"],
			},
			people: [
				{
					id: "konbini_clerk",
					walk: NANASHI[1],
					at: [2, 6],
					dir: "down",
					name: "店員",
					lines: [
						"いらっしゃいませー。\n……あたため　ますか？",
						"深夜は　ワンオペなんですよ。\n……おんJ　見ながら　です",
					],
				},
			],
		},
		// 店の 右の 角の 自販機（右の 半分の 前から 調べる）
		outdoor: [
			{
				id: "vend",
				at: [45, 29],
				lines: ["自販機。\n……ちょうど、のどが　かわいていた。"],
				play: "vend",
			},
		],
	},
	// ── 診療所（街。大通りの 北の まんなか。都市で 総合病院に 建てかえ）
	{
		id: "clinic",
		name: "保守村　診療所",
		from: 5,
		until: 7,
		at: [55, 15],
		// 青い 軒・白い 壁・緑の 十字の 看板・ガラスの 扉・植えこみ
		look: {
			kind: "grid",
			rows: ["aaaaa", "ddddd", "gGTGX", "iIDIj"],
			door: "D",
			keys: {
				a: [art("eave", 1)],
				d: [art("eave", 1, 1)],
				g: [art("white", 0, 1), art("win24")],
				G: [art("white", 1, 1), art("win24")],
				X: [art("white", 2, 1), base(1, 96)],
				T: [art("white", 1, 1), art("autoDoor")],
				i: [art("white", 0, 2), art("planter")],
				I: [art("white", 1, 2), art("planter", 2)],
				j: [art("white", 2, 2), art("pot", 2)],
				D: [art("white", 1, 2), art("autoDoor", 0, 1)],
			},
		},
		door: "診療所。\n消毒の　におい。",
		// 中：奥に ベッドと 心電図、先生の 机、薬の 棚、体重計。壁に 視力検査の 表・時計・はり紙。
		// 手前は 待合（長いす・受付の 呼び鈴・テレビ・観葉植物）
		room: {
			look: LOOKS.clinic,
			rows: [
				"############",
				"#HwHHHHHHwH#",
				"#hhehhkhhmh#",
				"#Zg.TU.MM.S#",
				"#z...n.....#",
				"#..........#",
				"#bB...[]..F#",
				"#.........V#",
				"####DD######",
			],
			tiles: (k) => ({
				w: k.up(ri("winModern")),
				e: k.low(ri("notice")),
				k: k.low(CLOCK),
				Z: k.on(base(2, 112)),
				z: k.on(base(2, 113)),
				g: k.on(ri("ecg")),
				T: k.on(riCell("deskDark", 0, 0), ri("laptop")),
				U: k.on(riCell("deskDark", 2, 0)),
				n: k.floor(ri("stoolWhite")),
				M: k.on(base(1, 337, 1, 2)),
				S: k.on(ri("scale")),
				b: k.on(riCell("bench", 0, 0)),
				B: k.on(riCell("bench", 1, 0)),
				"[": ctr(k.on(riCell("whiteCounter", 0, 0), ri("bell"))),
				"]": ctr(k.on(riCell("whiteCounter", 1, 0))),
				V: k.on(ri("tvCrt")),
			}),
			things: {
				e: "chart",
				k: "clock",
				m: "notice",
				z: "bed",
				g: "ecg",
				T: "desk",
				U: "desk",
				M: "medicine",
				S: "scale",
				b: "bench",
				B: "bench",
				"[": "reception",
				"]": "reception",
				V: "tv",
				F: "plant",
			},
			lines: {
				chart: ["視力検査の　表。\n……いちばん　下は「保守」。"],
				clock: ["時計。\n……待ち時間は　0分。"],
				notice: ["はり紙。\n「インフルエンザ　予防接種　受付中」"],
				bed: ["診察台。\n白い　シーツが　ぴんと　張ってある。"],
				ecg: ["心電図の　モニター。\nピッ……ピッ……と、規則正しい。"],
				desk: ["先生の　机。\nカルテに「腱鞘炎」が　ずらり。"],
				medicine: ["薬の　棚。\n「水分補給の草　煎じ薬」"],
				scale: ["体重計。\n……キリコは　乗らずに　通りすぎた。"],
				bench: ["待合の　長いす。\n古い　週刊誌が　1冊。"],
				reception: ["受付の　呼び鈴。\n「ご用の　方は　鳴らして　ください」"],
				tv: ["待合の　テレビ。\nナイター中継が　小さな　音で　流れる。"],
				plant: ["観葉植物。\n葉っぱが　つやつや　している。"],
			},
			people: [
				{
					id: "clinic_doc",
					walk: NANASHI[3],
					at: [5, 4],
					dir: "down",
					name: "先生",
					lines: [
						"どこが　痛いん？\n……書きこみすぎて　腱鞘炎やな",
						"ダンジョンの　ケガは　治せんで。\n……帰ったら　ちゃんと　寝え",
					],
				},
			],
		},
	},
	// ── 道場（街。南の 通りの まんなか）
	{
		id: "dojo",
		name: "保守道場",
		from: 5,
		at: [53, 26],
		// 和の 大屋根・心技体の 額・暗い 入口
		look: {
			kind: "grid",
			rows: ["01234", "56789", "pqBCs", "wlDrW"],
			door: "D",
			keys: {
				"0": [art("jpRoof")],
				"1": [art("jpRoof", 1)],
				"2": [art("jpRoof", 2)],
				"3": [art("jpRoof", 3)],
				"4": [art("jpRoof", 4)],
				"5": [art("jpRoof", 0, 1)],
				"6": [art("jpRoof", 1, 1)],
				"7": [art("jpRoof", 2, 1)],
				"8": [art("jpRoof", 3, 1)],
				"9": [art("jpRoof", 4, 1)],
				p: [art("jpLow")],
				q: [art("jpLow", 1)],
				B: [art("jpLow", 2), art("banner")],
				C: [art("jpLow", 2), art("banner", 1)],
				s: [art("jpLow", 4)],
				l: [art("jpEnt")],
				D: [art("jpEnt", 1)],
				r: [art("jpEnt", 2)],
				w: [art("jpWood")],
				W: [art("jpWood", 1)],
			},
		},
		door: "保守道場。\n「押忍！」と　声が　ひびく。",
		// 中：板の 間。奥に 額「保守」と 横断幕「心技体」、竹刀掛け・木刀掛け、すみに 太鼓と 水の 樽。格子の 窓
		room: {
			look: LOOKS.dojo,
			rows: [
				"############",
				"#HWHHabHHWH#",
				"#hhhhhsShmh#",
				"#RR....~~~U#",
				"#......~~~~#",
				"#z.....~~~~#",
				"#z.....~~~~#",
				"#TOo..d....#",
				"####DD######",
			],
			tiles: (k) => ({
				a: k.up(base(6, 422)),
				b: k.up(base(7, 422)),
				s: k.low(riCell("banner", 0, 0)),
				S: k.low(riCell("banner", 1, 0)),
				R: k.on(base(5, 411, 1, 2)),
				T: k.on(ri("taiko")),
				d: k.on(base(4, 411, 1, 2)),
				"~": k.floor(base(0, 436)),
				z: k.floor(base(3, 311)),
				o: k.on(base(3, 349, 1, 2)),
				O: k.on(base(3, 349, 1, 2)),
			}),
			things: {
				a: "plaque",
				b: "plaque",
				s: "banner",
				S: "banner",
				m: "motto",
				R: "shinai",
				U: "water",
				T: "taiko",
				d: "bokken",
				o: "bogu",
			},
			lines: {
				plaque: ["額に「保守」の　二文字。\n師範が　書いたらしい。"],
				banner: ["横断幕「心技体」。\n……その　下に　小さく「レス」。"],
				motto: ["道場訓。\n「レスバは　礼に　始まり　礼に　終わる」"],
				shinai: ["竹刀掛け。\n……1本　だけ、ささくれている。"],
				water: ["水の　樽。\n稽古の　あとの　一杯。"],
				taiko: ["太鼓。\n稽古の　はじめに　1回　たたく。"],
				bokken: ["木刀掛け。\n「素振り　1000本」の　札。"],
				bogu: ["防具。\n胴に「保守」と　白い　字。"],
			},
			people: [
				{
					id: "dojo_master",
					walk: NANASHI[0],
					at: [5, 4],
					dir: "down",
					name: "師範",
					lines: ["押忍。\n……レスバの　稽古なら、よそで　やれ"],
				},
				{
					id: "dojo_pupil",
					walk: NANASHI[2],
					at: [8, 5],
					dir: "left",
					name: "門下生",
					lines: ["1000本　素振り　しとる。\n……いま　324本目"],
				},
			],
		},
	},
	// ── 質屋（街。南の 通りの まんなかの 東）
	{
		id: "pawn",
		name: "質屋「流れ」",
		from: 5,
		at: [58, 26],
		// 蔵の 形（白い 漆喰・木の 腰・格子窓）・小判の 看板・のれん
		look: {
			kind: "grid",
			rows: ["aaaa", "dddd", "gGSh", "iIDj"],
			door: "D",
			keys: {
				a: [base(4, 82)],
				d: [base(4, 84)],
				g: [art("white"), art("win108", 4)],
				G: [art("white", 1)],
				S: [art("white", 1), base(4, 96)],
				h: [art("white", 2), art("win108", 4)],
				i: [art("shin", 0, 1)],
				I: [art("shin", 1, 1)],
				j: [art("shin", 2, 1), art("pot", 4)],
				D: [art("shin", 1, 1), art("jpEnt", 1), base(4, 297)],
			},
		},
		door: "質屋「流れ」。\n鈴が　ちりん、と　鳴った。",
		// 中：濃い 板の 床と しっくいの 壁。奥に 箪笥・柱時計・金庫、まんなかに 帳場（台の うしろに 店主）、
		// 左に ガラスの ケース 2つ、右に つぼ・ギター・レコードの 箱（流れ品）
		room: {
			look: LOOKS.wafu,
			rows: [
				"############",
				"#HHHHHHHHWH#",
				"#hhchmhhshh#",
				"#Tt.......K#",
				"#.....n....#",
				"#....[=]...#",
				"#gG.......u#",
				"#qQ....rR..#",
				"####DD######",
			],
			tiles: (k) => ({
				T: k.on(base(0, 309, 1, 2)),
				t: k.on(base(1, 309, 1, 2)),
				c: k.low(base(2, 116)),
				s: k.low(ri("scroll")),
				K: k.on(ri("safe")),
				n: k.floor(base(3, 311)),
				"[": ctr(k.on(riCell("counterDark", 0, 0), onTop(1, 156))),
				"=": ctr(k.on(riCell("counterDark", 1, 0))),
				"]": ctr(k.on(riCell("counterDark", 2, 0), onTop(6, 158))),
				g: k.on(riCell("glassCase", 0, 0)),
				G: k.on(riCell("glassCase", 1, 0)),
				q: k.on(riCell("glassCase", 0, 0)),
				Q: k.on(riCell("glassCase", 1, 0)),
				u: k.on(base(0, 123)),
				r: k.on(ri("guitar")),
				R: k.on(ri("records")),
			}),
			things: {
				m: "notice",
				T: "tansu",
				t: "tansu",
				c: "clock",
				s: "scroll",
				K: "safe",
				"[": "counter",
				"]": "counter",
				g: "case",
				G: "case",
				Q: "case",
				u: "pot",
				r: "guitar",
				R: "records",
			},
			lines: {
				notice: ["はり紙。\n「流れ　3か月。利息は　良心的」"],
				tansu: ["箪笥。\n引き出しごとに　質札が　貼ってある。"],
				clock: ["柱時計。\n……3か月ごとに、ボーンと　鳴る。"],
				safe: ["金庫。\n……ダイヤルに、指の　あとが　ない。"],
				scroll: ["掛け軸。\n「質札　3か月で　流れます」"],
				counter: ["帳場の　台。\nそろばんと、数えかけの　小銭。"],
				case: ["ガラスの　ケース。\n古い　レコードの　針が　ならんでいる。"],
				pot: ["つぼ。\n「売約済み」の　札。"],
				guitar: ["ギター。\n弦が　1本　たりない。「流れ品」の　札。"],
				records: ["レコードの　箱。\n……どれも　針の　あとが　深い。"],
			},
			people: [
				{
					id: "pawn_owner",
					walk: NANASHI[3],
					at: [6, 4],
					dir: "down",
					name: "店主",
					lines: [
						"質入れ？　あんたの　それ、\nダンジョンで　拾った　もんやろ",
						"うちは　なんでも　預かるで。\n……思い出　以外はな",
					],
				},
			],
		},
	},
	// ── 住宅街（段6）：新市街の 空いた 区画に 家が 並ぶ。都市（段7）で 役所や 盛り場に 建てかわる
	// 赤い 寄棟・桃色の カーテンの 窓・郵便受け
	house(
		"house_a",
		[53, 4],
		{
			kind: "grid",
			rows: ["abbbc", "deeef", "12wwW", "34Dmp"],
			door: "D",
			keys: {
				a: [art("hipRed")],
				b: [art("hipRed", 1)],
				c: [art("hipRed", 2)],
				d: [art("hipRed", 0, 1)],
				e: [art("hipRed", 1, 1)],
				f: [art("hipRed", 2, 1)],
				"1": [art("white", 0, 1), art("winPink")],
				"2": [art("white", 1, 1), art("winPink", 1)],
				w: [art("white", 1, 1)],
				W: [art("white", 2, 1), art("win24", 2)],
				"3": [art("white", 0, 2), art("winPink", 0, 1)],
				"4": [art("white", 1, 2), art("winPink", 1, 1)],
				D: [art("white", 1, 2), base(4, 507, 1, 2)],
				m: [art("white", 1, 2), art("small25")],
				p: [art("white", 2, 2), art("pot", 1)],
			},
		},
		["表札「名無し」。\n……留守のようだ。"],
		7,
	),
	// 青い 軒・ベージュの 壁・花の 箱
	house(
		"house_b",
		[58, 4],
		{
			kind: "grid",
			rows: ["aaaaa", "ddddd", "gGGGh", "iIDpj"],
			door: "D",
			keys: {
				a: [art("eave", 1)],
				d: [art("eave", 1, 1)],
				g: [art("beige"), art("win24", 2)],
				G: [art("beige", 1)],
				h: [art("beige", 2), art("win24", 2)],
				i: [art("beige", 0, 1), art("flowerBox")],
				I: [art("beige", 1, 1)],
				p: [art("beige", 1, 1), art("pot", 2)],
				j: [art("beige", 2, 1)],
				D: [art("beige", 1, 1), base(7, 75, 1, 2)],
			},
		},
		["表札「ななしのごんべえ」。\n窓から　テレビの　音。"],
		7,
	),
	// 和の 切妻・格子・石灯籠
	house(
		"house_c",
		[53, 37],
		{
			kind: "grid",
			rows: ["x012x", "y345y", "suSut", "vVDVz"],
			door: "D",
			keys: {
				"0": [art("jpGable")],
				"1": [art("jpGable", 1)],
				"2": [art("jpGable", 2)],
				"3": [art("jpGable", 0, 1)],
				"4": [art("jpGable", 1, 1)],
				"5": [art("jpGable", 2, 1)],
				x: [base(4, 82)],
				y: [base(4, 84)],
				s: [art("shin")],
				S: [art("shin", 1)],
				t: [art("shin", 2)],
				u: [art("shin", 1), art("win108", 6)],
				v: [art("shin", 0, 1), art("lanternStone")],
				V: [art("shin", 1, 1)],
				z: [art("shin", 2, 1)],
				D: [art("shin", 1, 1), art("jpEnt", 1)],
			},
		},
		["表札「やきう民」。\n中から　ナイター中継の　音。"],
		7,
	),
	// 木の 家（板壁・木の 窓）
	house(
		"house_d",
		[58, 37],
		{
			kind: "grid",
			rows: ["aaaaa", "ddddd", "gGGGg", "ipDii"],
			door: "D",
			keys: {
				a: [base(0, 82)],
				d: [base(0, 84)],
				g: [base(1, 55), art("win24", 3)],
				G: [base(1, 55)],
				D: [base(1, 56), base(7, 55, 1, 2)],
				i: [base(1, 56)],
				p: [base(1, 56), art("pot")],
			},
		},
		["表札「ROM」。\n……カーテンが　すこし　ゆれた。"],
		7,
	),
	// 平らな 屋根の 今風の 家（室外機・自転車）
	house(
		"house_e",
		[70, 37],
		{
			kind: "grid",
			rows: ["(-*--)", "[====]", "gWGGWh", "iIIDBb"],
			door: "D",
			keys: {
				...ROOF_FLAT,
				g: [art("gray"), art("win24")],
				G: [art("gray", 1)],
				h: [art("gray", 2), art("win24")],
				W: [art("gray", 1), art("win24")],
				i: [art("gray", 0, 1), base(3, 394)],
				I: [art("gray", 1, 1)],
				B: [art("gray", 1, 1), art("bike")],
				b: [art("gray", 2, 1), art("bike", 1)],
				D: [art("gray", 1, 1), base(5, 507, 1, 2)],
			},
		},
		["表札「VIP」。\n……ポストに　チラシが　たまっている。"],
		7,
	),
	// ── リサイクルショップ「おさがり」（住宅街。北の 通りの 西）
	{
		id: "recycle",
		name: "リサイクルショップ「おさがり」",
		from: 6,
		at: [40, 4],
		// 鉄の 屋根・開いた 搬入口・SHOP の 札・段ボール
		look: {
			kind: "grid",
			rows: ["aaaaaa", "dddddd", "gGGLMS", "ikDxXj"],
			door: "D",
			keys: {
				a: [base(5, 82)],
				d: [base(5, 84)],
				g: [art("gray"), art("win108", 1)],
				G: [art("gray", 1)],
				S: [art("gray", 1), art("sign25")],
				L: [art("gray", 1), art("shutter")],
				M: [art("gray", 1), art("shutter", 1)],
				i: [art("gray", 0, 1), art("box")],
				k: [art("gray", 1, 1), art("box", 1)],
				D: [art("gray", 1, 1), base(4, 507, 1, 2)],
				x: [art("gray", 1, 1), art("bay")],
				X: [art("gray", 1, 1), art("bay", 1)],
				j: [art("gray", 2, 1)],
			},
		},
		door: "リサイクルショップ「おさがり」。\nほこりと、古い　紙の　におい。",
		// 中：古着（壁）・マネキン・冷蔵庫・洗濯機・ギター、まんなかに 棚・ブラウン管・自転車・ソファ・
		// おさがりの 箱、右に レジ（台の うしろに 店主）、すみに レコードの 樽
		room: {
			look: LOOKS.wood,
			rows: [
				"############",
				"#HHWHHHHWHH#",
				"#hhhhyyyhmh#",
				"#MNfw.....g#",
				"#..........#",
				"#.SZ.vV.bB.#",
				"#.sz.eE....#",
				"#xX.....[=]#",
				"#U.........#",
				"####DD######",
			],
			tiles: (k) => ({
				y: k.low(base(0, 349)),
				M: k.on(base(2, 349, 1, 2)),
				N: k.on(base(6, 349, 1, 2)),
				f: k.on(base(0, 393, 1, 2)),
				w: k.on(base(2, 393, 1, 2)),
				g: k.on(ri("guitarB")),
				S: k.on(riCell("shelfGoods", 0, 0)),
				Z: k.on(riCell("shelfGoods", 1, 0)),
				s: k.on(riCell("shelfGoods", 0, 1)),
				z: k.on(riCell("shelfGoods", 1, 1)),
				v: k.on(ri("tvCrt")),
				V: k.on(ri("tvCrtB")),
				b: k.on(riCell("bike", 0, 0)),
				B: k.on(riCell("bike", 1, 0)),
				e: k.on(riCell("sofaWhite", 0, 0)),
				E: k.on(riCell("sofaWhite", 1, 0)),
				x: k.on(ri("crate")),
				X: k.on(ri("crateB")),
				"[": ctr(k.on(riCell("whiteCounter", 0, 0))),
				"=": ctr(k.on(riCell("whiteCounter", 1, 0), ri("register"))),
				"]": ctr(k.on(riCell("whiteCounter", 1, 0))),
			}),
			things: {
				y: "clothes",
				m: "notice",
				M: "mannequin",
				N: "mannequin",
				f: "fridge",
				w: "washer",
				g: "guitar",
				S: "shelf",
				Z: "shelf",
				s: "shelf",
				z: "shelf",
				v: "tv",
				V: "tv",
				b: "bike",
				B: "bike",
				e: "sofa",
				E: "sofa",
				x: "box",
				X: "box",
				"[": "register",
				"]": "register",
				U: "records",
			},
			lines: {
				clothes: ["古着。\n「おんJ」と　胸に　書いた　Tシャツ。"],
				notice: ["はり紙。\n「買取　強化中：思い出の　品」"],
				mannequin: ["マネキン。\nなぜか　季節はずれの　服を　着ている。"],
				fridge: ["冷蔵庫。\n「動作品　3000円」。……ぶーん、と　鳴る。"],
				washer: ["洗濯機。\n「脱水の　とき　踊ります」の　メモ。"],
				guitar: ["ギター。\n「弾けなくても　かっこいい」の　札。"],
				shelf: ["棚。\n古い　ゲーム機と、だれかの　卒業アルバム。"],
				tv: ["ブラウン管の　テレビ。\n「動作未確認　100円」"],
				bike: ["自転車。\nサドルが　ちょっと　高すぎる。"],
				sofa: ["ソファ。\n「すわり心地　保証」の　札。"],
				box: ["段ボール。\n「おさがり　ご自由に」"],
				register: ["レジ。\n値札の　シールが　山積み。"],
				records: [
					"樽に　レコードが　つめこんである。\n……どれも　針の　あとが　深い。",
				],
			},
			people: [
				{
					id: "recycle_clerk",
					walk: NANASHI[1],
					at: [9, 6],
					dir: "down",
					name: "店主",
					lines: [
						"いらっしゃい。\n……捨てる　神あれば、拾う　神や",
						"このテレビ？　映るで。\n……たぶん、昭和の　なにかが",
					],
				},
			],
		},
	},
	// ── ガレージ（住宅街。北の 通りの 東。都市で 自動車整備工場に 建てかえ）
	{
		id: "garage",
		name: "ガレージ",
		from: 6,
		until: 7,
		at: [70, 4],
		// シャッター 2つ・タイヤ
		look: {
			kind: "grid",
			rows: ["aaaaaa", "dddddd", "gGGLMh", "tIDlmj"],
			door: "D",
			keys: {
				a: [base(5, 82)],
				d: [base(5, 84)],
				g: [art("gray")],
				G: [art("gray", 1)],
				h: [art("gray", 2)],
				L: [art("gray", 1), art("shutter")],
				M: [art("gray", 1), art("shutter", 1)],
				t: [art("gray", 0, 1), base(1, 490)],
				I: [art("gray", 1, 1)],
				D: [art("gray", 1, 1), base(5, 507, 1, 2)],
				l: [art("gray", 1, 1), art("shutter")],
				m: [art("gray", 1, 1), art("shutter", 1)],
				j: [art("gray", 2, 1), base(3, 125)],
			},
		},
		door: "ガレージ。\nオイルの　におい。",
		// 中：灰色の 壁と コンクリートの 床、奥に シャッター。赤い セダン（横向き 4x2）、作業台と 工具箱、
		// ドラム缶・ポリタンク・タイヤの 山
		room: {
			look: LOOKS.garage,
			rows: [
				"############",
				"#HHHHHHHHWH#",
				"#hhhSThhhmh#",
				"#oo...wkj..#",
				"#..........#",
				"#..abce....#",
				"#..ABCE....#",
				"#F......ii.#",
				"####DD######",
			],
			tiles: (k) => ({
				S: k.low(riCell("shutter", 0, 0)),
				T: k.low(riCell("shutter", 1, 0)),
				o: k.on(base(5, 491)),
				w: k.on(riCell("tableLong", 0, 0), ri("toolboxTop")),
				k: k.on(riCell("tableLong", 2, 0)),
				j: k.on(ri("jerrycan")),
				a: k.on(riCell("sedan", 0, 0)),
				b: k.on(riCell("sedan", 1, 0)),
				c: k.on(riCell("sedan", 2, 0)),
				e: k.on(riCell("sedan", 3, 0)),
				A: k.on(riCell("sedan", 0, 1)),
				B: k.on(riCell("sedan", 1, 1)),
				C: k.on(riCell("sedan", 2, 1)),
				E: k.on(riCell("sedan", 3, 1)),
				i: k.on(base(0, 491)),
			}),
			things: {
				S: "shutter",
				T: "shutter",
				m: "notice",
				o: "drum",
				w: "bench",
				k: "bench",
				j: "tank",
				a: "car",
				b: "car",
				c: "car",
				e: "car",
				i: "tires",
			},
			lines: {
				shutter: ["シャッター。\n……半分だけ　開いている。"],
				notice: ["はり紙。\n「洗車　1回　500円」"],
				drum: ["ドラム缶。\n……オイルが　にじんでいる。"],
				bench: ["作業台。\n工具箱の　ふたが　開けっぱなし。"],
				tank: ["ポリタンク。\n「水」と　マジックで　書いてある。"],
				car: ["赤い　セダン。\n……ナンバーは「1000」。"],
				tires: ["タイヤの　山。\nすりへった　溝に、浜の　砂。"],
			},
			people: [
				{
					id: "garage_mech",
					walk: NANASHI[0],
					at: [8, 4],
					dir: "down",
					name: "整備士",
					lines: ["車？　村の　中は　歩けば　ええ。\n……でも、夢は　あるやろ"],
				},
			],
		},
	},
	// ── ゲームセンター「連コ」（住宅街。南の 通りの 東）
	{
		id: "arcade",
		name: "ゲームセンター「連コ」",
		from: 6,
		at: [70, 26],
		// 黒レンガ・桃色の ネオンの 帯・紫の ガラス・額の ポスター。右の 角に 青い 自販機（2マス幅）
		look: {
			kind: "grid",
			rows: ["(-~--)", "[====]", "mMMMMn", "gPDgVW"],
			door: "D",
			keys: {
				...ROOF_FLAT,
				m: [art("wallTex", 1), art("band", 0, 4)],
				M: [art("wallTex", 1), art("band", 1, 4)],
				n: [art("wallTex", 1), art("band", 2, 4)],
				g: [art("wallTex", 1), art("glass"), base(4, 367)],
				D: [art("wallTex", 1), art("autoDoor", 0, 1)],
				P: [art("wallTex", 1), art("sign92", 2)],
				V: [art("wallTex", 1), art("vendBlue", 0, 0, 1, 2)],
				W: [art("wallTex", 1), art("vendBlue", 1, 0, 1, 2)],
			},
		},
		door: "ゲームセンター「連コ」。\n電子音と、レバーを　たたく　音。",
		// 中：赤い 柄の じゅうたん。奥に 筐体 5台（色ちがい）と 音ゲー・プリクラ、
		// まんなかに 筐体 3台・レトロゲームの 台・自販機、入口の そばに 両替機。筐体の 前に 丸いす
		room: {
			look: LOOKS.arcade,
			rows: [
				"##############",
				"#HHpHHHHHpHHH#",
				"#hhhhhhhhhhmh#",
				"#AbCKE..vV..P#",
				"#nnnnn..nn...#",
				"#..........wW#",
				"#.GJI..tT..xX#",
				"#.nnn........#",
				"#a..........F#",
				"#####DD#######",
			],
			tiles: (k) => ({
				p: k.up(ri("posterB")),
				A: k.on(base(0, 519, 1, 2)),
				b: k.on(base(1, 519, 1, 2)),
				C: k.on(base(2, 519, 1, 2)),
				K: k.on(base(3, 519, 1, 2)),
				E: k.on(base(4, 519, 1, 2)),
				G: k.on(base(3, 519, 1, 2)),
				J: k.on(base(4, 519, 1, 2)),
				I: k.on(base(0, 519, 1, 2)),
				v: k.on(riCell("tvBig", 0, 0)),
				V: k.on(riCell("tvBig", 1, 0)),
				P: k.on(base(0, 358, 1, 3)),
				n: k.floor(ri("stoolBrown")),
				t: k.on(ri("tvCrt")),
				T: k.on(ri("console")),
				w: k.on(riCell("vend", 0, 0)),
				W: k.on(riCell("vend", 1, 0)),
				x: k.on(riCell("vend", 0, 1)),
				X: k.on(riCell("vend", 1, 1)),
				a: k.on(ri("atm")),
			}),
			things: {
				m: "notice",
				A: "cabinet",
				C: "cabinet",
				K: "cabinet",
				E: "cabinet",
				G: "cabinet",
				J: "cabinet",
				I: "cabinet",
				v: "rhythm",
				V: "rhythm",
				P: "booth",
				t: "retro",
				T: "retro",
				w: "vend",
				W: "vend",
				X: "vend",
				a: "change",
				F: "plant",
			},
			lines: {
				notice: ["はり紙。\n「1プレイ　100円。連コイン　禁止」"],
				cabinet: ["古い　アーケード台。\n画面に「INSERT COIN」。"],
				rhythm: ["音ゲーの　台。\nランキングの　1位は「>>1」。"],
				booth: ["プリクラの　機械。\nカーテンに「盛れる」の　文字。"],
				retro: ["レトロゲームの　台。\n「1プレイ　無料。2Pは　あなた」"],
				vend: ["自販機。\nエナドリの　ボタンだけ「売切」。"],
				change: ["両替機。\n千円札が　100円玉に　なる。"],
				plant: ["観葉植物。\n……鉢に　メダルが　1枚　埋まっている。"],
			},
			people: [
				{
					id: "arcade_a",
					walk: NANASHI[3],
					at: [2, 4],
					dir: "up",
					name: "名無し",
					lines: ["格ゲーの　対戦台や。\n……乱入、待っとるで"],
				},
				{
					id: "arcade_b",
					walk: NANASHI[2],
					at: [2, 7],
					dir: "up",
					name: "名無し",
					lines: ["メダル、ぜんぶ　すった。\n……来月まで　ROM　やわ"],
				},
			],
		},
		// 店の 右の 角の 自販機（右の 半分の 前から 調べる）
		outdoor: [
			{
				id: "vend",
				at: [75, 29],
				lines: ["自販機。\n……ちょうど、のどが　かわいていた。"],
				play: "vend",
			},
		],
	},
	// ── ageジム（住宅街。浜への 道の 西）
	{
		id: "gym",
		name: "ageジム",
		from: 6,
		at: [40, 37],
		// 紫の 帯・灰色の ガラス
		look: {
			kind: "grid",
			rows: ["(~--~)", "[====]", "sSSSSt", "iIDIIj"],
			door: "D",
			keys: {
				...ROOF_FLAT,
				s: [art("white", 1, 1), art("band", 0, 2)],
				S: [art("white", 1, 1), art("band", 1, 2)],
				t: [art("white", 1, 1), art("band", 2, 2)],
				i: [art("gray", 0, 1), art("glass", 2)],
				I: [art("gray", 1, 1), art("glass", 2)],
				j: [art("gray", 2, 1), art("glass", 2)],
				D: [art("gray", 1, 1), art("autoDoor", 0, 1)],
			},
		},
		door: "ageジム。\n「ふんっ……！」と　声が　する。",
		// 中：黒い ゴムの 床と 白い 石の 壁、奥の 壁は 鏡。ベンチ 2台・ダンベル・ロッカー・体重計・
		// プロテインの 冷蔵庫・ストレッチの マット
		room: {
			look: LOOKS.gym,
			rows: [
				"############",
				"#HHHHHHHHWH#",
				"#MMMMMMmhhh#",
				"#.......FLJ#",
				"#.bB..bB.lj#",
				"#..........#",
				"#.dd.yyyy.S#",
				"#R...yyyy..#",
				"####DD######",
			],
			tiles: (k) => ({
				M: k.low(ri("mirror")),
				L: k.on(riCell("lockers", 0, 0)),
				J: k.on(riCell("lockers", 1, 0)),
				l: k.on(riCell("lockers", 0, 1)),
				j: k.on(riCell("lockers", 1, 1)),
				b: k.on(riCell("bench", 0, 0)),
				B: k.on(riCell("bench", 1, 0)),
				d: k.on(ri("dumbbells")),
				y: k.floor(base(1, 50)),
				S: k.on(ri("scale")),
				R: k.on(ri("drinkCase")),
			}),
			things: {
				M: "mirror",
				m: "notice",
				l: "locker",
				j: "locker",
				b: "bench",
				B: "bench",
				d: "weight",
				S: "scale",
				R: "fridge",
				F: "plant",
			},
			lines: {
				mirror: ["大きな　鏡。\nキリコが　映っている。……細い。"],
				notice: ["はり紙。\n「1日　1000回　スクワット」"],
				locker: ["ロッカー。\n「プロテイン　共用」の　はり紙。"],
				bench: ["ベンチプレスの　台。\nバーが　汗で　光っている。"],
				weight: ["ダンベルの　台。\n「1000kg」と　書いた　うそ札。"],
				scale: ["体重計。\n針が「計測不能」で　止まっている。"],
				fridge: ["冷蔵庫。\nプロテインの　ボトルが　ぎっしり。"],
				plant: ["観葉植物。\n……いちばん　鍛えて　なさそう。"],
			},
			people: [
				{
					id: "gym_trainer",
					walk: NANASHI[0],
					at: [5, 5],
					dir: "down",
					name: "トレーナー",
					lines: ["筋肉は　うらぎらない。\n……スレの　勢いは　うらぎるけどな"],
				},
			],
		},
	},
	// ── バー「次スレ」（住宅街。浜の 東。海を 見ながら 飲む）
	{
		id: "bar",
		name: "バー「次スレ」",
		from: 6,
		at: [33, 32],
		// 木の 屋根・黒レンガ・灯りの 窓・ジョッキの 看板・赤い 扉
		look: {
			kind: "grid",
			ground: "sand",
			rows: ["aaaaa", "ddddd", "gGGSg", "iIDIi"],
			door: "D",
			keys: {
				a: [base(0, 82)],
				d: [base(0, 84)],
				g: [art("wallTex", 1), art("win108", 3)],
				G: [art("wallTex", 1)],
				S: [art("wallTex", 1), base(4, 95)],
				i: [art("wallTex", 1), art("pot", 3)],
				I: [art("wallTex", 1), art("win108", 3)],
				D: [art("wallTex", 1), art("door108", 1)],
			},
		},
		door: "バー「次スレ」。\n低い　ジャズと、波の　音。",
		// 中：レンガの 壁と 濃い 板の 床。奥の 壁に 酒棚、台（台の うしろに マスター）と 丸いす、
		// 右に 海の 見える 窓と 丸テーブル、すみに 樽・レコードプレーヤー・観葉植物
		room: {
			look: LOOKS.bar,
			rows: [
				"############",
				"#bbbbbHwvHH#",
				"#XXXBBhWVmh#",
				"#.........U#",
				"#[===]...O.#",
				"#nnnnn.....#",
				"#......O...#",
				"#P........F#",
				"####DD######",
			],
			tiles: (k) => ({
				b: k.up(base(1, 337)),
				B: k.low(base(1, 338)),
				X: k.low(base(1, 338)),
				w: k.up(riCell("winBlue", 0, 0)),
				v: k.up(riCell("winBlue", 1, 0)),
				W: k.low(riCell("winBlue", 0, 1)),
				V: k.low(riCell("winBlue", 1, 1)),
				"[": ctr(k.on(riCell("counterDark", 0, 0), ri("wine"))),
				"=": ctr(k.on(riCell("counterDark", 1, 0))),
				"]": ctr(k.on(riCell("counterDark", 2, 0), ri("beer"))),
				n: k.floor(ri("stoolRed")),
				O: k.on(ri("roundTable")),
				P: k.on(base(2, 108), ri("turntableTop")),
			}),
			things: {
				B: "bottles",
				W: "window",
				V: "window",
				m: "menu",
				U: "barrel",
				"[": "glass",
				"]": "glass",
				O: "table",
				P: "record",
				F: "plant",
			},
			lines: {
				bottles: ["酒棚。\nラベルに「次スレ」と　書かれた　瓶。"],
				window: ["窓。\n夜の　海に、桟橋の　灯りが　ゆれる。"],
				menu: ["品書き。\n「完走」「次スレ」「保守（ノンアル）」"],
				barrel: ["樽。\n……海の　においが　しみている。"],
				glass: ["台の　上の　グラス。\n……だれかの　飲みかけ。"],
				table: ["丸テーブル。\nコースターに「>>1000」の　落書き。"],
				record: ["レコードプレーヤー。\n古い　ジャズが　回っている。"],
				plant: ["観葉植物。\n……葉に　コースターが　はさまっている。"],
			},
			people: [
				{
					id: "bar_master",
					walk: NANASHI[3],
					at: [3, 3],
					dir: "down",
					name: "マスター",
					lines: [
						"いらっしゃい。\n……キリコちゃんは　ミルクやな",
						"スレが　1000で　終わったら、\nみんな　ここで　次スレを　待つんや",
					],
				},
			],
		},
	},
	// ── 海上レストラン「1000」（住宅街。桟橋の 東の 海の 上。見るだけ：予約で いっぱい）
	{
		id: "restaurant",
		name: "海上レストラン「1000」",
		from: 6,
		at: [23, 37],
		clear: [
			[21, 37, "ははははははははははは"],
			[21, 38, "ははははははははははは"],
			[21, 39, "ははははははははははは"],
			[21, 40, "ははははははははははは"],
			[21, 41, "ははははははははははは"],
			[21, 42, "ははははははははははは"],
		],
		// 青い 寄棟・赤い カーテンの 大きな 窓（扉は しまっている）
		look: {
			kind: "grid",
			ground: "pier",
			rows: ["abbbbbc", "deeeeef", "123S123", "456D456"],
			door: "D",
			keys: {
				a: [art("hipBlue")],
				b: [art("hipBlue", 1)],
				c: [art("hipBlue", 2)],
				d: [art("hipBlue", 0, 1)],
				e: [art("hipBlue", 1, 1)],
				f: [art("hipBlue", 2, 1)],
				"1": [art("white", 1, 1), art("curtainBig")],
				"2": [art("white", 1, 1), art("curtainBig", 1)],
				"3": [art("white", 1, 1), art("curtainBig", 2)],
				"4": [art("white", 1, 2), art("curtainBig", 0, 1)],
				"5": [art("white", 1, 2), art("curtainBig", 1, 1)],
				"6": [art("white", 1, 2), art("curtainBig", 2, 1)],
				S: [art("white", 1, 1), base(3, 95)],
				D: [art("white", 1, 2), art("door108", 2)],
			},
		},
		outdoor: [
			{
				id: "door",
				at: [26, 40],
				lines: [
					"海上レストラン「1000」。\n窓ぎわの　席から、海が　見える。",
					"今日は　予約で　いっぱいだ。\n……おすすめの　看板だけ　読める。",
					"「本日の　おすすめ：\n麻婆豆腐（ロゼ監修）」",
				],
			},
		],
	},
	// ── 麺屋「乙」（街から。線路の 東の 南の 区画。台の 前の 丸いすで 食べる 店。店主か 券売機で 品書き：ui/eat.ts）
	{
		id: "ramen",
		name: "麺屋「乙」",
		from: 4,
		at: [80, 26],
		// 灰色の 瓦・赤い 日よけ・赤い 提灯・障子・のれん・どんぶりの 看板
		look: {
			kind: "grid",
			rows: ["aaaaaa", "dddddd", "LMMMMR", "csDsbk"],
			door: "D",
			keys: {
				a: [base(4, 82)],
				d: [base(4, 84)],
				L: [art("jpWood"), art("canopy", 0, 1)],
				M: [art("jpWood"), art("canopy", 1, 1)],
				R: [art("jpWood"), art("canopy", 2, 1)],
				c: [art("jpWood"), LANTERN],
				s: [art("jpWood"), art("win108", 6)],
				b: [art("jpWood"), art("ramenBowl")],
				D: [art("jpEnt", 1), base(4, 297)],
				k: [art("jpWood", 1), LANTERN],
			},
		},
		door: "麺屋「乙」。\nのれんの　奥から、しょうゆの　におい。",
		// 中：奥に 冷蔵庫と 戸棚、台の うしろに 寸胴の コンロ・流し・店主（どれも 台ごしに 読む）、台に どんぶり・餃子・
		// 調味料、丸いす 7つ。入口の そばに 券売機と お冷や。壁に 品書きと テレビ
		room: {
			look: look(base(2, 48), "#d8c08a", base(1, 57), base(1, 58), "#8a6a3a"),
			rows: [
				"############",
				"#HppHHtHHWH#",
				"#hhhhhhhhmh#",
				"#Rcccccc...#",
				"#OO...SS|..#",
				"#[=b=b==]..#",
				"#nnnnnnn...#",
				"#Q........w#",
				"####DD######",
			],
			tiles: (k) => ({
				p: k.up(ri("memo")),
				t: k.up(ri("tvSmall")),
				R: k.on(base(0, 393, 1, 2)),
				c: k.on(riCell("cabWood", 1, 0)),
				O: k.on(riCell("stove", 0, 0), ri("potFire")),
				S: k.on(riCell("sink", 0, 0)),
				"|": ctr(k.on(riCell("counterLong", 2, 0), ri("condiments"))),
				"[": ctr(k.on(riCell("counterLong", 0, 0))),
				"=": ctr(k.on(riCell("counterLong", 1, 0))),
				b: ctr(k.on(riCell("counterLong", 1, 0), ri("ramen"))),
				"]": ctr(k.on(riCell("counterLong", 2, 0), ri("gyoza"))),
				n: k.floor(ri("stoolRed")),
				Q: k.on(ri("atm")),
				w: k.on(ri("coffeeMaker")),
			}),
			things: {
				m: "notice",
				O: "pot",
				S: "sink",
				"|": "condiments",
				"]": "gyoza",
				Q: "ticket",
				w: "water",
			},
			lines: {
				notice: [
					"はり紙。\n「替え玉　無料。スープは　飲みほし　推奨」",
					"店の　名前は、おつかれの「乙」。\n……>>1に　かける　ことばだ。",
				],
				pot: ["寸胴。\n鶏ガラの　スープが　ぐらぐら　煮えている。"],
				sink: ["流し。\nどんぶりが　山に　なっている。"],
				condiments: ["調味料。\n紅しょうが・にんにく・ラー油・胡椒。"],
				gyoza: ["焼きたての　餃子。\n……となりの　客の　ぶん。"],
				ticket: ["券売機。\n「ラーメン」「替え玉」「保守（大盛）」"],
				water: ["お冷やの　サーバー。\n「セルフで　どうぞ」"],
			},
			plays: { ticket: "eat" },
			people: [
				{
					id: "ramen_master",
					walk: NANASHI[0],
					at: [4, 4],
					dir: "down",
					name: "店主",
					play: "eat",
					lines: [
						"らっしゃい！\n食券でも　口でも　ええで",
						"替え玉は　何回でも　ええで。\n……スレと　ちがって　無限や",
						"スープは　鶏ガラ　しょうゆ　一本や。\n……なんに　する？",
					],
				},
			],
		},
	},
	// ── ファミレス「ドリンクバー」（住宅街。線路の 東の 北の 区画。いつも 満席：窓ぎわで 名無しが 粘っている）
	{
		id: "famires",
		name: "ファミレス「ドリンクバー」",
		from: 6,
		at: [80, 4],
		// 赤い 軒・だいだいの 帯に ナイフと フォークの 看板・黄色い 枠の 窓・自動ドア
		look: {
			kind: "grid",
			rows: ["aaaaa", "ddddd", "oOOSp", "WwDwP"],
			door: "D",
			keys: {
				a: [art("eave")],
				d: [art("eave", 0, 1)],
				o: [art("white", 0, 1), art("band", 0, 1)],
				O: [art("white", 1, 1), art("band", 1, 1)],
				p: [art("white", 2, 1), art("band", 2, 1)],
				S: [art("white", 1, 1), art("band", 1, 1), base(3, 95)],
				w: [art("white", 1, 2), art("win24", 1)],
				W: [art("white", 0, 2), art("win24", 1)],
				D: [art("white", 1, 2), art("autoDoor", 0, 1)],
				P: [art("white", 2, 2), art("win24", 1)],
			},
		},
		door: "ファミレス「ドリンクバー」。\n窓ぎわで、だれかが　ずっと　粘っている。",
		// 中：窓ぎわに ボックス席 2つ（ソファに はさまれた 机）、手前にも 2つ。右の 奥に ドリンクバー（グラス・コーヒー・
		// メロンソーダ・冷蔵ケース。調べると 1杯 飲める）、手前に レジ（台の うしろに 店員）と 食品サンプルの ケース、
		// 入口の そばに 順番待ちの 紙。窓ぎわの 席に 粘る 名無し
		room: {
			look: look(
				ri("flWoodLight"),
				"#d8b070",
				base(1, 77),
				base(1, 78),
				"#e8e4dc",
			),
			rows: [
				"##############",
				"#HwHHHwHHHQHH#",
				"#hhhhmhhhhhhh#",
				"#<Y>.<T>.cCMR#",
				"#............#",
				"#<U>.<Z>....F#",
				"#............#",
				"#gG......[=].#",
				"#...P.......F#",
				"######DD######",
			],
			tiles: (k) => ({
				w: k.up(ri("winModern")),
				Q: k.up(CLOCK),
				// ソファ（すわれる。背もたれが 外がわ）
				"<": k.floor(ri("boothR")),
				">": k.floor(ri("boothL")),
				Y: k.on(ri("tableBeige"), ri("glasses")),
				T: k.on(ri("tableBeige"), ri("hamburg")),
				U: k.on(ri("tableBeige"), ri("omurice")),
				Z: k.on(ri("tableBeige"), ri("cake")),
				c: k.on(riCell("whiteCounter", 0, 0), ri("glasses")),
				C: k.on(riCell("whiteCounter", 1, 0), ri("coffeeMaker")),
				M: k.on(riCell("whiteCounter", 1, 0), ri("melonSoda")),
				R: k.on(ri("drinkCase")),
				g: k.on(riCell("glassCase", 0, 0)),
				G: k.on(riCell("glassCase", 1, 0)),
				"[": ctr(k.on(riCell("whiteCounter", 0, 0))),
				"=": ctr(k.on(riCell("whiteCounter", 1, 0), ri("register"))),
				"]": ctr(k.on(riCell("whiteCounter", 1, 0))),
				P: k.on(ri("standSign")),
			}),
			things: {
				m: "menu",
				Y: "glasses",
				T: "hamburg",
				U: "omurice",
				Z: "cake",
				c: "drinkbar",
				C: "drinkbar",
				M: "drinkbar",
				R: "drinkbar",
				g: "sample",
				G: "sample",
				"[": "register",
				"]": "register",
				P: "waitlist",
				F: "plant",
			},
			lines: {
				menu: ["はり紙。\n「本日の　おすすめ：目玉焼きハンバーグ」"],
				glasses: [
					"空の　グラスが　ずらり。\nメロンソーダの　あとが　13こ。",
					"伝票には「ドリンクバー　1」だけ。",
				],
				hamburg: ["ハンバーグの　鉄板。\n……じゅうじゅう　まだ　鳴っている。"],
				omurice: ["オムライス。\nケチャップで「>>1」と　書いてある。"],
				cake: ["ショートケーキ。\nいちごが　最後まで　残してある。"],
				drinkbar: [
					"ドリンクバー。\nメロン・コーラ・烏龍茶・コーヒー。",
					"ボタンを　ぜんぶ　押した　あとが　ある。\n……まぜるのは　自己責任。",
				],
				sample: ["食品サンプルの　ケース。\nハンバーグが　実物より　大きい。"],
				register: ["レジ。\nつまようじと　ミントの　ガム。"],
				waitlist: [
					"順番待ちの　紙。\n「名無し」「名無し」「名無し」……",
					"キリコは　名前を　書かずに、\nそっと　ペンを　置いた。",
				],
				plant: ["観葉植物。\n葉の　かげに　お子さまランチの　旗。"],
			},
			plays: { drinkbar: "drinkbar" },
			people: [
				{
					id: "famires_clerk",
					walk: NANASHI[1],
					at: [10, 6],
					dir: "down",
					name: "店員",
					lines: [
						"いらっしゃいませー。\nただいま　満席で　ございますー",
						"窓ぎわの　お客さま、\n朝から　ドリンクバー　だけで……",
					],
				},
				{
					id: "famires_regular",
					walk: NANASHI[2],
					at: [1, 3],
					dir: "right",
					name: "名無し",
					lines: [
						"ドリンクバーで　6時間や。\n……メロンソーダ、13杯目",
						"家より　ここの　ほうが　スレが　はかどる。\n……電源も　あるしな",
					],
				},
			],
		},
	},
	// ── 止まっている 車（住宅街から。東の 通りの 車線。左を 走るので 東向きは 上の 2車線・西向きは 下の 2車線）
	car("car_a", [56, 9], "sedanE", [6, 10]),
	car("car_b", [55, 20], "wagonE", [6, 10]),
	car("car_c", [72, 22], "sedanBlueW", [11, 7]),
	car("car_d", [57, 33], "wagonWhiteW", [11, 7]),
	// ── バス停（住宅街。広場の 東の はし。ここからも どの 板へも 出かけられる：出口を 遠く しない）
	{
		id: "bus",
		name: "バス停",
		from: 6,
		at: [31, 20],
		// だいだいの 丸い 札の バス停（16x32）
		look: {
			kind: "grid",
			shadow: false,
			rows: ["b"],
			keys: { b: [art("busStop", 0, 0, 1, 2)] },
		},
		outdoor: [
			{
				id: "stop",
				at: [31, 20],
				lines: [
					"バス停「保守村　広場前」。\n全体マップの　どの　板へも　行ける。",
				],
				play: "bus",
			},
		],
	},
	// ── 市民農園（住宅街。東の 畑を 小さな 区画に 分けて 住人に 貸す。まんなかに 歩道。都市で 公園に。
	//    段5 までの 畑は data/village/map.ts の farmRows）
	{
		id: "garden",
		name: "保守村　市民農園",
		from: 6,
		until: 7,
		at: [31, 12],
		look: {
			kind: "block",
			rows: [
				",Ω,,ゆ,,b",
				",,,,ゆ,,,",
				",サスシゆセサス",
				",,,,ゆ,,,",
				",シセサゆスシセ",
				",,,,ゆ,,,",
				",ψ,ソゆ,タω",
			],
			tiles: {
				// 区画（丸い 畝に 芽・若い葉・キャベツ・トマト）・立て札・水を くんだ バケツ
				サ: plot(base(6, 26)),
				シ: plot(base(6, 28)),
				ス: plot(base(7, 27)),
				セ: plot(base(7, 28)),
				ソ: NAME_BOARD,
				タ: solid(C_GRASS, TURF, base(0, 124)),
			},
		},
		outdoor: [
			{
				id: "sign",
				at: [34, 18],
				lines: [
					"立て札「保守村　市民農園」。\n畑を　区画に　分けて、住人に　貸している。",
					"区画の　番号は　レス番。\n……>>1から　順に　埋まっている。",
				],
			},
			{
				id: "plot",
				at: [36, 14],
				lines: [
					"区画の　札「>>1」。\n……トマトに　支柱が　立ててある。",
					"となりの　札は「>>2」。\n……「2げと」の　旗が　立っている。",
				],
			},
			{
				id: "bucket",
				at: [37, 18],
				lines: ["水を　くんだ　バケツ。\n「水やり　当番：今日は　>>3」"],
			},
		],
	},
	// ── 都市（段7）：交番 → 警察署・診療所 → 総合病院・消防団 → 消防署、家 → 裁判所・映画館・劇場・カジノ
	{
		id: "police",
		name: "保守警察署",
		from: 7,
		at: [40, 14],
		// 3階建ての 白い ビル・青い 窓・赤い 灯り・鉄の 両開き（右が 扉）・自転車・給水タンク
		look: {
			kind: "grid",
			rows: ["(-*-~)", "[==&=]", "awbRwc", "pqrrqs", "YyLDtu"],
			door: "D",
			keys: {
				...ROOF_FLAT,
				a: [art("white"), art("win108", 2)],
				w: [art("white", 1), art("win108", 2)],
				b: [art("white", 1)],
				R: [art("white", 1), art("redLamp")],
				c: [art("white", 2), art("win108", 2)],
				p: [art("white", 0, 1), art("win108")],
				q: [art("white", 1, 1), art("win108")],
				r: [art("white", 1, 1)],
				s: [art("white", 2, 1), art("win108")],
				Y: [art("gray", 0, 1), art("bike")],
				y: [art("gray", 1, 1), art("bike", 1)],
				L: [art("gray", 1, 1), base(2, 92, 1, 2)],
				D: [art("gray", 1, 1), base(3, 92, 1, 2)],
				t: [art("gray", 1, 1), art("pot", 2)],
				u: [art("gray", 2, 1), art("win108", 2)],
			},
		},
		door: "保守警察署。\n電話の　音が　鳴りやまない。",
		// 中：灰色の タイルと 白い 壁。奥に 手配書・事件の 板・時計・取調室の 扉、書類の 棚、
		// 机 2つ（パソコン・電話）、手前を 横切る 台（左が 受付＝台の うしろに 警察官、右が 落とし物の 窓口）、
		// 入口の そばに 待合の 長いすと 観葉植物
		room: {
			look: LOOKS.office,
			rows: [
				"##############",
				"#HwHHbcgHHwHH#",
				"#hmhhBCGhkhhd#",
				"#f...........#",
				"#f..TUV.TUV..#",
				"#....n...n...#",
				"#............#",
				"#[==]...(---)#",
				"#............#",
				"#jJ.......F..#",
				"#####DD#######",
			],
			tiles: (k) => ({
				w: k.up(ri("winModern")),
				b: k.up(riCell("corkBoard", 0, 0)),
				c: k.up(riCell("corkBoard", 1, 0)),
				g: k.up(riCell("corkBoard", 2, 0)),
				B: k.low(riCell("corkBoard", 0, 1)),
				C: k.low(riCell("corkBoard", 1, 1)),
				G: k.low(riCell("corkBoard", 2, 1)),
				k: k.low(CLOCK),
				d: k.low(base(5, 507, 1, 2)),
				f: k.on(ri("cabinetGreyB")),
				T: k.on(riCell("deskDark", 0, 0), ri("phone")),
				U: k.on(riCell("deskDark", 1, 0), ri("pcTop")),
				V: k.on(riCell("deskDark", 2, 0), onTop(1, 156)),
				n: k.floor(ri("chairDarkUp")),
				"[": ctr(k.on(riCell("whiteCounter", 0, 0), ri("bell"))),
				"=": ctr(k.on(riCell("whiteCounter", 1, 0))),
				"]": ctr(k.on(riCell("whiteCounter", 1, 0))),
				"(": ctr(k.on(riCell("whiteCounter", 0, 0))),
				"-": ctr(k.on(riCell("whiteCounter", 1, 0))),
				")": ctr(k.on(riCell("whiteCounter", 1, 0), onTop(4, 158))),
				j: k.on(riCell("bench", 0, 0)),
				J: k.on(riCell("bench", 1, 0)),
			}),
			things: {
				m: "wanted",
				B: "board",
				C: "board",
				G: "board",
				k: "clock",
				d: "door",
				f: "cabinet",
				T: "desk",
				U: "desk",
				V: "desk",
				"[": "counter",
				")": "lost",
				j: "bench",
				J: "bench",
				F: "plant",
			},
			lines: {
				wanted: ["指名手配。\n「コピペ荒らし　身長　不明」"],
				board: ["事件の　板。\n……どの　事件も「解決：保守」。"],
				clock: ["時計。\n……当直の　交代まで　あと　3時間。"],
				door: ["扉に「取調室」。\n……カツ丼の　においが　する。"],
				cabinet: ["書類の　棚。\n「過去ログ　事件簿　1〜1000」"],
				desk: ["机。\n被害届「スレを　埋め立てられました」"],
				counter: ["受付。\n「落とし物・荒らしの　相談」"],
				lost: ["落とし物の　窓口。\n「片方だけの　靴下：7足」"],
				bench: ["待合の　長いす。\n「順番に　お呼びします」の　札。"],
				plant: ["観葉植物。\n葉の　かげに「防犯カメラ作動中」。"],
			},
			people: [
				{
					id: "police_a",
					walk: NANASHI[2],
					at: [2, 6],
					dir: "down",
					name: "警察官",
					lines: ["生活安全課や。\n……荒らしの　通報、1000件　たまっとる"],
				},
				{
					id: "police_b",
					walk: NANASHI[0],
					at: [9, 5],
					dir: "up",
					name: "刑事",
					lines: ["犯人は　この　村の　中に　おる。\n……たぶん、ROM専や"],
				},
			],
		},
	},
	{
		id: "hospital",
		name: "保守村　総合病院",
		from: 7,
		at: [53, 14],
		// 横に 長い 白い ビル・赤十字・自動ドア（左は 開かない 扉）・非常口・植えこみ・給水タンク・天窓
		look: {
			kind: "grid",
			rows: [
				"(-*--~--*)",
				"[==%==%==]",
				"awwwbXwwwc",
				"lqqqTUqqqe",
				"789xEDg789",
			],
			door: "D",
			keys: {
				...ROOF_FLAT,
				a: [art("white")],
				w: [art("white", 1), art("win24")],
				b: [art("white", 1)],
				X: [art("white", 1), art("redCross")],
				c: [art("white", 2)],
				l: [art("white", 0, 1)],
				q: [art("white", 1, 1), art("win24")],
				e: [art("white", 2, 1)],
				T: [art("white", 1, 1), art("autoDoor")],
				U: [art("white", 1, 1), art("autoDoor", 1)],
				"7": [art("white", 0, 2), art("planter")],
				"8": [art("white", 1, 2), art("planter", 1)],
				"9": [art("white", 2, 2), art("planter", 2)],
				g: [art("white", 1, 2), art("glass", 1), art("shopGlass", 1)],
				x: [art("white", 1, 2), art("glass", 1), art("sign92")],
				E: [art("white", 1, 2), art("autoDoor", 0, 1)],
				D: [art("white", 1, 2), art("autoDoor", 1, 1)],
			},
		},
		door: "総合病院。\n白い　廊下が、まっすぐ　のびている。",
		// 中：水色の タイル。奥は 病室（ベッド 3台に 心電図）と 検査の 機械・公衆電話、
		// 右に 受付（台の うしろに 看護師）、手前は 待合（長いす 2つ・自販機・観葉植物）
		room: {
			look: LOOKS.clinic,
			rows: [
				"################",
				"#HwHHwHHHwHHHwH#",
				"#hhmhhhhhhhhkhh#",
				"#Zg.Zg.Zg.NO.P.#",
				"#z..z..z.......#",
				"#..............#",
				"#...........[=]#",
				"#..............#",
				"#vV.bB....bB...#",
				"#yY...........F#",
				"#######DD#######",
			],
			tiles: (k) => ({
				w: k.up(ri("winModern")),
				k: k.low(CLOCK),
				Z: k.on(base(2, 112)),
				z: k.on(base(2, 113)),
				g: k.on(ri("ecg")),
				N: k.on(ri("medPanelB")),
				O: k.on(ri("medPanel")),
				P: k.on(ri("payphone")),
				"[": ctr(k.on(riCell("whiteCounter", 0, 0), ri("bell"))),
				"=": ctr(k.on(riCell("whiteCounter", 1, 0))),
				"]": ctr(k.on(riCell("whiteCounter", 1, 0), ri("pcTop"))),
				v: k.on(riCell("vend", 0, 0)),
				V: k.on(riCell("vend", 1, 0)),
				y: k.on(riCell("vend", 0, 1)),
				Y: k.on(riCell("vend", 1, 1)),
				b: k.on(riCell("bench", 0, 0)),
				B: k.on(riCell("bench", 1, 0)),
			}),
			things: {
				m: "sign",
				k: "clock",
				z: "bed",
				g: "ecg",
				N: "scanner",
				O: "scanner",
				P: "phone",
				"[": "counter",
				"]": "counter",
				v: "vend",
				V: "vend",
				Y: "vend",
				b: "bench",
				B: "bench",
				F: "plant",
			},
			lines: {
				sign: ["はり紙。\n「院内では　sage　進行で」"],
				clock: ["時計。\n……面会時間は　いつでも。"],
				bed: ["ベッド。\nシーツの　すみに「sage」と　刺しゅう。"],
				ecg: ["心電図の　モニター。\n波が　ゆっくり　上下している。"],
				scanner: ["検査の　機械。\n「MRI　予約　3か月待ち」"],
				phone: ["公衆電話。\n受話器の　横に　テレカが　1枚。"],
				counter: ["受付。\n「保険証は　ROM　ですか」"],
				vend: ["自販機。\n麦茶と　経口補水液だけ　売っている。"],
				bench: ["待合の　いす。\n名前を　呼ばれるのを　待つ　人。"],
				plant: ["観葉植物。\n「お見舞いの　花は　受付へ」の　札。"],
			},
			people: [
				{
					id: "hospital_nurse",
					walk: NANASHI[1],
					at: [13, 5],
					dir: "down",
					name: "看護師",
					lines: ["夜勤は　ずっと　おんJ　見とる。\n……いや、カルテ　見とる"],
				},
				{
					id: "hospital_doc",
					walk: NANASHI[3],
					at: [6, 5],
					dir: "left",
					name: "院長",
					lines: ["診療所から　大きく　なったんや。\n……患者は、ほぼ　腱鞘炎"],
				},
			],
		},
	},
	{
		id: "firestation",
		name: "保守消防署",
		from: 7,
		at: [70, 14],
		// 白い 壁・赤い シャッターの 車庫 2つ・赤い 灯り・消火器
		look: {
			kind: "grid",
			rows: ["(-~--*)", "[=====]", "awwRwwc", "lLMtLMr", "4NODNO6"],
			door: "D",
			keys: {
				...ROOF_FLAT,
				a: [art("white")],
				w: [art("white", 1), art("win108", 2)],
				R: [art("white", 1), art("redLamp")],
				c: [art("white", 2)],
				l: [art("white", 0, 1)],
				L: [art("white", 1, 1), art("shutterRed")],
				M: [art("white", 1, 1), art("shutterRed", 1)],
				r: [art("white", 2, 1)],
				t: [art("white", 1, 1)],
				"4": [art("white", 0, 2), art("small25", 1)],
				N: [art("white", 1, 2), art("shutterRed")],
				O: [art("white", 1, 2), art("shutterRed", 1)],
				"6": [art("white", 2, 2)],
				D: [art("white", 1, 2), base(5, 507, 1, 2)],
			},
		},
		door: "保守消防署。\n赤い　車が、出動を　待っている。",
		// 中：レンガの 壁と コンクリートの 床。奥に 警報の ベル・当番表・車庫の シャッター（消防車は 向こう）、
		// 防火服の ロッカー、すべり棒、待機の ソファ、台所、入口の そばに 消火器
		room: {
			look: LOOKS.fireStation,
			rows: [
				"##############",
				"#HwHHHHHHHHwH#",
				"#hkhmhSTSThhh#",
				"#.........LJ.#",
				"#.p.......lj.#",
				"#............#",
				"#.so....iK...#",
				"#............#",
				"#ee.......F..#",
				"#####DD#######",
			],
			tiles: (k) => ({
				w: k.up(ri("winModern")),
				k: k.low(base(4, 88)),
				S: k.low(riCell("shutter", 0, 0)),
				T: k.low(riCell("shutter", 1, 0)),
				L: k.on(riCell("lockers", 0, 0)),
				J: k.on(riCell("lockers", 1, 0)),
				l: k.on(riCell("lockers", 0, 1)),
				j: k.on(riCell("lockers", 1, 1)),
				p: k.on(ri("pole")),
				s: k.on(riCell("sofaWhite", 0, 0)),
				o: k.on(riCell("sofaWhite", 1, 0)),
				i: k.on(riCell("stove", 0, 0)),
				K: k.on(riCell("sink", 0, 0)),
				e: k.on(ri("extinguisher")),
			}),
			things: {
				k: "bell",
				m: "duty",
				S: "shutter",
				T: "shutter",
				L: "locker",
				l: "locker",
				j: "locker",
				p: "pole",
				s: "sofa",
				o: "sofa",
				i: "kitchen",
				K: "kitchen",
				e: "extinguisher",
				F: "plant",
			},
			lines: {
				bell: ["警報の　ベル。\n……鳴るのは、炎上の　ときだけ。"],
				duty: ["当番表。\n「消防団から　ひきつぎ：名無し」"],
				shutter: ["車庫の　シャッター。\n向こうで　赤い　車が　待っている。"],
				locker: ["防火服の　ロッカー。\n長靴が　きれいに　ならんでいる。"],
				pole: ["すべり棒。\n上の　階から　1秒で　降りられる。"],
				sofa: ["待機の　ソファ。\n……出動の　ベルを　待つ　席。"],
				kitchen: ["台所。\n今夜の　当番飯は「カレー」。"],
				extinguisher: ["消火器。\n点検の　シールが　今月の　日付。"],
				plant: ["観葉植物。\n消防団の　ころから　育てている。"],
			},
			people: [
				{
					id: "fire_chief",
					walk: NANASHI[0],
					at: [6, 4],
					dir: "down",
					name: "隊長",
					lines: ["はしご車、出動　準備よし。\n……燃えとるのは　スレだけか"],
				},
			],
		},
	},
	{
		id: "court",
		name: "保守地方裁判所",
		from: 7,
		at: [53, 3],
		// 灰色の 石・白い 柱 4本・アーチの 窓・鉄の 両開き（右が 扉）
		look: {
			kind: "grid",
			rows: [
				"(--------)",
				"[==%==%==]",
				"sPwPssPwPs",
				"sQWQssQWQs",
				"sRsRLDRsRs",
			],
			door: "D",
			keys: {
				...ROOF_FLAT,
				s: [art("wallTex", 2)],
				P: [art("wallTex", 2), art("pillar")],
				Q: [art("wallTex", 2), art("pillar", 0, 1)],
				R: [art("wallTex", 2), art("pillar", 0, 2)],
				w: [art("wallTex", 2), art("archTall")],
				W: [art("wallTex", 2), art("archTall", 0, 1)],
				L: [art("wallTex", 2), base(2, 92, 1, 2)],
				D: [art("wallTex", 2), base(3, 92, 1, 2)],
			},
		},
		door: "保守地方裁判所。\nしんと　静まりかえっている。",
		// 中：木の 壁と 濃い 板の 床。奥に 額、裁判官の 席（台の うしろに 裁判官）、左右に 検察と 弁護の 机、
		// まんなかに 証言台、木の 柵の 手前は 傍聴席（まんなかに 赤い じゅうたんの 通路）
		room: {
			look: LOOKS.court,
			rows: [
				"##############",
				"#HHHHHabHHHHH#",
				"#hhhhhhhhhhmh#",
				"#.....n......#",
				"#....[=].....#",
				"#.TU......VW.#",
				"#......s.....#",
				"#fffff..fffff#",
				"#............#",
				"#BBBB.~~.BBBB#",
				"######DD######",
			],
			tiles: (k) => ({
				a: k.up(base(6, 422)),
				b: k.up(base(7, 422)),
				n: k.floor(ri("chairDarkDown")),
				"[": ctr(k.on(riCell("counterDark", 0, 0))),
				"=": ctr(k.on(riCell("counterDark", 1, 0))),
				"]": ctr(k.on(riCell("counterDark", 2, 0))),
				T: k.on(riCell("deskDark", 0, 0), onTop(1, 156)),
				U: k.on(riCell("deskDark", 2, 0)),
				V: k.on(riCell("deskDark", 0, 0)),
				W: k.on(riCell("deskDark", 2, 0), onTop(2, 156)),
				s: k.on(ri("podium")),
				f: k.on(base(1, 44)),
				B: k.on(base(0, 121)),
				"~": k.floor(ri("runner")),
			}),
			things: {
				m: "rule",
				"[": "bench",
				"]": "bench",
				T: "prosecutor",
				U: "prosecutor",
				V: "defense",
				W: "defense",
				s: "stand",
				f: "rail",
				B: "gallery",
			},
			lines: {
				rule: ["はり紙。\n「法廷では　お静かに。レスバ　禁止」"],
				bench: ["裁判官の　席。\nガイドラインの　本が　ひらいてある。"],
				prosecutor: ["検察官の　机。\n分厚い　ログの　束。"],
				defense: ["弁護人の　机。\n「異議あり」の　付せんが　1枚。"],
				stand: ["証言台。\n「スクショは　あります」と　書いた　メモ。"],
				rail: ["木の　柵。\n……ここから　先は　入れない。"],
				gallery: ["傍聴席。\n……ほとんど　ROM専の　席。"],
			},
			people: [
				{
					id: "court_judge",
					walk: NANASHI[3],
					at: [6, 3],
					dir: "down",
					name: "裁判官",
					lines: ["被告人、ガイドライン違反。\n……判決、規制　3日"],
				},
				{
					id: "court_watcher",
					walk: NANASHI[1],
					at: [5, 9],
					dir: "up",
					name: "傍聴人",
					lines: ["実況　したい。\n……でも　ここ、スマホ　禁止やねん"],
				},
			],
		},
	},
	{
		id: "repair",
		name: "自動車整備工場",
		from: 7,
		at: [70, 4],
		// 開いた 車庫に 正面を 向いた 黒い 車・シャッター・タイヤ
		look: {
			kind: "grid",
			rows: ["(-~---)", "[=&===]", "ABwgLMh", "CEtDlmj"],
			door: "D",
			keys: {
				...ROOF_SLAB,
				A: [art("gray"), art("bay"), art("carFront")],
				B: [art("gray", 1), art("bay", 1), art("carFront", 1)],
				C: [art("gray", 0, 1), art("carFront", 0, 1)],
				E: [art("gray", 1, 1), art("carFront", 1, 1)],
				g: [art("gray", 1)],
				w: [art("gray", 1), art("win108", 1)],
				h: [art("gray", 2)],
				L: [art("gray", 1), art("shutter")],
				M: [art("gray", 1), art("shutter", 1)],
				l: [art("gray", 1, 1), art("shutter")],
				m: [art("gray", 1, 1), art("shutter", 1)],
				D: [art("gray", 1, 1), base(5, 507, 1, 2)],
				t: [art("gray", 1, 1), base(1, 490)],
				j: [art("gray", 2, 1)],
			},
		},
		door: "自動車整備工場。\nエンジンの　音と、オイルの　におい。",
		// 中：ガレージの 3倍。奥に シャッター 2枚分と 工具の キャビネット・事務の 机、
		// 赤い セダンと 黄色い ワゴン、手前に ドラム缶と タイヤの 山
		room: {
			look: LOOKS.garage,
			rows: [
				"##############",
				"#HHHHHHHHHHWH#",
				"#hhhhSTSThmhh#",
				"#NNN.......dk#",
				"#............#",
				"#.abce..uvwy.#",
				"#.ABCE..UVXY.#",
				"#............#",
				"#oo.....ii.zz#",
				"#####DD#######",
			],
			tiles: (k) => ({
				S: k.low(riCell("shutter", 0, 0)),
				T: k.low(riCell("shutter", 1, 0)),
				N: k.on(riCell("cabNavy", 1, 0)),
				d: k.on(riCell("deskDark", 0, 0), ri("laptop")),
				k: k.on(riCell("deskDark", 2, 0), ri("phone")),
				a: k.on(riCell("sedan", 0, 0)),
				b: k.on(riCell("sedan", 1, 0)),
				c: k.on(riCell("sedan", 2, 0)),
				e: k.on(riCell("sedan", 3, 0)),
				A: k.on(riCell("sedan", 0, 1)),
				B: k.on(riCell("sedan", 1, 1)),
				C: k.on(riCell("sedan", 2, 1)),
				E: k.on(riCell("sedan", 3, 1)),
				u: k.on(riCell("wagon", 0, 0)),
				v: k.on(riCell("wagon", 1, 0)),
				w: k.on(riCell("wagon", 2, 0)),
				y: k.on(riCell("wagon", 3, 0)),
				U: k.on(riCell("wagon", 0, 1)),
				V: k.on(riCell("wagon", 1, 1)),
				X: k.on(riCell("wagon", 2, 1)),
				Y: k.on(riCell("wagon", 3, 1)),
				o: k.on(base(5, 491)),
				i: k.on(base(0, 491)),
				z: k.on(ri("jerrycan")),
			}),
			things: {
				S: "shutter",
				T: "shutter",
				m: "notice",
				N: "tools",
				d: "desk",
				k: "desk",
				a: "car",
				b: "car",
				c: "car",
				e: "car",
				u: "wagon",
				v: "wagon",
				w: "wagon",
				y: "wagon",
				o: "drum",
				i: "tires",
				z: "tank",
			},
			lines: {
				shutter: ["シャッター。\n奥に　もう　1台、順番を　待つ　車。"],
				notice: ["はり紙。\n「車検　受付中」"],
				tools: [
					"工具の　キャビネット。\nガレージの　ころより　3倍に　ふえた。",
				],
				desk: ["事務の　机。\n見積書に「保守　割引」。"],
				car: ["赤い　セダン。\n底に、浜の　砂が　びっしり。"],
				drum: ["ドラム缶。\n……オイルが　にじんでいる。"],
				tires: ["タイヤの　山。\n「スタッドレス　あります」"],
				wagon: ["黄色い　ワゴン。\nうしろの　席に　バットが　3本。"],
				tank: ["ポリタンク。\n「ガソリン　入れるな」の　札。"],
			},
			people: [
				{
					id: "repair_mech",
					walk: NANASHI[0],
					at: [7, 4],
					dir: "down",
					name: "整備士",
					lines: ["車検の　時期やで。\n……キリコちゃん、車　持っとらんか"],
				},
			],
		},
	},
	{
		id: "cinema",
		name: "映画館「スクリーン1000」",
		from: 7,
		at: [53, 36],
		// 電光の 看板・額の ポスター・赤い ロープの 柱
		look: {
			kind: "grid",
			rows: ["(-~-)", "[===]", "1234l", "pqTqP", "rRDRr"],
			door: "D",
			keys: {
				...ROOF_FLAT,
				l: [art("wallTex", 1)],
				"1": [art("wallTex", 1), art("led")],
				"2": [art("wallTex", 1), art("led", 1)],
				"3": [art("wallTex", 1), art("led", 2)],
				"4": [art("wallTex", 1), art("led", 3)],
				p: [art("wallTex", 1), art("sign92", 2)],
				P: [art("wallTex", 1), art("sign92", 4)],
				q: [art("wallTex", 1), art("sign92", 3)],
				T: [art("wallTex", 1), art("autoDoor")],
				D: [art("wallTex", 1), art("autoDoor", 0, 1)],
				r: [art("wallTex", 1), art("rope")],
				R: [art("wallTex", 1), art("rope", 1)],
			},
		},
		door: "映画館「スクリーン1000」。\nポップコーンの　におい。",
		// 中：黒い 幕の 壁と 赤い じゅうたん。奥に スクリーン（両わきに 赤い 幕）、客席 3列（背中から 見た いす）、
		// 手前に 上映中の 札と ゴミ箱
		room: {
			look: LOOKS.cinema,
			rows: [
				"##############",
				"#HcSSSSSSSScH#",
				"#hCssssssssCh#",
				"#......~.....#",
				"#.ooooo~ooooo#",
				"#.ooooo~ooooo#",
				"#......~.....#",
				"#.ooooo~ooooo#",
				"#P.....~....b#",
				"######DD######",
			],
			tiles: (k) => ({
				c: k.up(),
				S: k.up(base(4, 504)),
				s: k.low(base(4, 504)),
				C: k.low(base(6, 359, 1, 2)),
				o: k.on(ri("seatBack")),
				"~": k.floor(base(5, 46)),
				P: k.on(ri("standSign")),
				b: k.on(ri("trash")),
			}),
			things: {
				s: "screen",
				C: "curtain",
				o: "seat",
				P: "poster",
				b: "trash",
			},
			lines: {
				screen: ["スクリーン。\n予告編「1000レスの　夏」。"],
				curtain: ["赤い　幕。\n上映が　始まると　閉じるらしい。"],
				seat: ["客席。\nひじかけに　ドリンクの　あと。"],
				poster: ["上映中「スレ立て　ヒーロー」\n「さらば　過去ログ」"],
				trash: ["ゴミ箱。\nポップコーンの　カップが　あふれている。"],
			},
			people: [
				{
					id: "cinema_staff",
					walk: NANASHI[2],
					at: [1, 3],
					dir: "right",
					name: "係員",
					lines: ["上映中は　お静かに。\n……実況は　実況スレで"],
				},
			],
		},
	},
	{
		id: "theater",
		name: "保守劇場",
		from: 7,
		at: [58, 36],
		// 赤い 軒・赤レンガ・柱・赤い 幕の 大きな 窓
		look: {
			kind: "grid",
			rows: ["aaaaa", "ddddd", "P123P", "Q456Q", "RbDbR"],
			door: "D",
			keys: {
				a: [art("eave")],
				d: [art("eave", 0, 1)],
				"1": [art("wallTex"), art("curtainBig")],
				"2": [art("wallTex"), art("curtainBig", 1)],
				"3": [art("wallTex"), art("curtainBig", 2)],
				"4": [art("wallTex"), art("curtainBig", 0, 1)],
				"5": [art("wallTex"), art("curtainBig", 1, 1)],
				"6": [art("wallTex"), art("curtainBig", 2, 1)],
				P: [art("wallTex"), art("pillar")],
				Q: [art("wallTex"), art("pillar", 0, 1)],
				R: [art("wallTex"), art("pillar", 0, 2)],
				b: [art("wallTex")],
				D: [art("wallTex"), art("door108", 1)],
			},
		},
		door: "保守劇場。\n開演の　ブザーが　鳴っている。",
		// 中：レンガの 壁と 濃い 板の 床。奥に 赤い 舞台（上に 赤い 幕の かざり、うしろに 金の ふすまの 背景、
		// 両わきに 赤い 幕）、客席 1列、すみに ピアノ
		room: {
			look: LOOKS.theater,
			rows: [
				"##############",
				"#HHHvvvvvvHHH#",
				"#hhhbbbbbbhmh#",
				"#..c788889c..#",
				"#PpC455556C.F#",
				"#...122223...#",
				"#............#",
				"#.ooooo.ooooo#",
				"#............#",
				"######DD######",
			],
			tiles: (k) => ({
				v: k.up(base(6, 357)),
				b: k.low(base(6, 440)),
				c: k.on(),
				C: k.on(base(6, 358, 1, 3)),
				o: k.on(ri("seatBack")),
				P: k.on(base(3, 120, 1, 2)),
				p: k.on(base(4, 120, 1, 2)),
			}),
			things: {
				m: "playbill",
				C: "curtain",
				"1": "stage",
				"3": "stage",
				o: "seat",
				P: "piano",
				p: "piano",
				F: "plant",
			},
			lines: {
				playbill: ["演目の　はり紙。\n「やきう　物語　〜1000本ノック〜」"],
				curtain: ["赤い　幕。\n……すこし　ほつれている。"],
				stage: ["舞台。\n今夜の　演目「やきう　物語」。"],
				seat: ["客席。\n「満員御礼」の　札が　さがっている。"],
				piano: ["ピアノ。\n伴奏の　楽譜が　ひらいたまま。"],
				plant: ["スタンド花。\n「祝　初日　名無し一同」"],
			},
			people: [
				{
					id: "theater_actor",
					walk: NANASHI[1],
					at: [6, 4],
					dir: "down",
					name: "役者",
					lines: ["セリフ、忘れた。\n……カンペ　どこや"],
				},
			],
		},
	},
	{
		id: "casino",
		name: "カジノ「ガチャ」",
		from: 7,
		at: [70, 36],
		// 金の 帯・赤レンガ・電光の 看板・赤い じゅうたんに 金の 両開き（右が 扉）・ロープの 柱
		look: {
			kind: "grid",
			rows: ["(~-*-~)", "[=====]", "yYYYYYz", "g1234sg", "grLDRrg"],
			door: "D",
			keys: {
				...ROOF_FLAT,
				y: [art("band", 0, 3)],
				Y: [art("band", 1, 3)],
				z: [art("band", 2, 3)],
				"1": [art("wallTex"), art("led")],
				"2": [art("wallTex"), art("led", 1)],
				"3": [art("wallTex"), art("led", 2)],
				"4": [art("wallTex"), art("led", 3)],
				s: [art("wallTex"), base(4, 96)],
				g: [art("wallTex"), art("win108", 3)],
				L: [art("wallTex"), base(4, 92, 1, 2)],
				D: [art("redCarpet"), base(5, 92, 1, 2)],
				r: [art("wallTex"), art("rope")],
				R: [art("wallTex"), art("rope", 1)],
			},
		},
		door: "カジノ「ガチャ」。\nコインの　音が　鳴りひびく。",
		// 中：赤い 幕の 壁と 金の ふちの じゅうたん。奥に スロット 10台（色ちがい）と 丸いす、
		// まんなかに ルーレット（盤と 賭けの 台）と カードの 台（横に ディーラー）、手前に チップの 窓口
		room: {
			look: LOOKS.casino,
			rows: [
				"##############",
				"#HHHHHHHHHHHH#",
				"#hhhhhhmhhhhh#",
				"#ABCKE..EKCBA#",
				"#nnnnn..nnnnn#",
				"#......TUV...#",
				"#.RrL..tuv...#",
				"#............#",
				"#F......[=].F#",
				"######DD######",
			],
			tiles: (k) => ({
				A: k.on(base(0, 519, 1, 2)),
				B: k.on(base(1, 519, 1, 2)),
				C: k.on(base(2, 519, 1, 2)),
				K: k.on(base(3, 519, 1, 2)),
				E: k.on(base(4, 519, 1, 2)),
				n: k.floor(ri("stoolRed")),
				T: k.on(base(3, 514)),
				U: k.on(base(4, 514)),
				V: k.on(base(5, 514)),
				t: k.on(base(3, 515)),
				u: k.on(base(4, 515)),
				v: k.on(base(5, 515)),
				R: k.on(base(3, 516, 1, 2)),
				r: k.on(base(4, 516, 1, 2)),
				L: k.on(base(5, 516, 1, 2)),
				"[": ctr(k.on(riCell("counterDark", 0, 0), ri("bell"))),
				"=": ctr(k.on(riCell("counterDark", 1, 0))),
				"]": ctr(k.on(riCell("counterDark", 2, 0))),
			}),
			things: {
				m: "rule",
				A: "slot",
				B: "slot",
				C: "slot",
				K: "slot",
				E: "slot",
				T: "cards",
				U: "cards",
				V: "cards",
				t: "cards",
				u: "cards",
				v: "cards",
				R: "roulette",
				r: "roulette",
				L: "roulette",
				"[": "cashier",
				"]": "cashier",
				F: "plant",
			},
			lines: {
				rule: ["はり紙。\n「チップの　販売は　ありません」"],
				slot: ["スロット台。\n……777は、出そうで　出ない。"],
				cards: ["カードの　台。\nディーラーが　じっと　見ている。"],
				roulette: ["ルーレット。\n赤か　黒か。……緑も　ある。"],
				cashier: ["チップの　窓口。\n「本日の　両替は　終了しました」"],
				plant: ["観葉植物。\n鉢の　ふちに　チップが　1枚。"],
			},
			people: [
				{
					id: "casino_dealer",
					walk: NANASHI[3],
					at: [10, 6],
					dir: "left",
					name: "ディーラー",
					lines: [
						"ここは　見るだけの　カジノや。\n……賭けるなら、冒険に　賭けえ",
					],
				},
			],
		},
	},
	// ── 駅（都市。線路の 東。改札から 電車で どの 板へも 出かけられる：出口を 遠く しない）
	{
		id: "station",
		name: "保守村駅",
		from: 7,
		at: [80, 14],
		// 時計・発車の 板・青い ひさし・ガラスの 正面に 自動ドア（左は 開かない 扉）・非常口
		look: {
			kind: "grid",
			rows: ["(-~--)", "[====]", "lpPqQr", "nNNNNn", "xITDIj"],
			door: "D",
			keys: {
				...ROOF_FLAT,
				l: [art("white", 0, 1), art("sign25", 2)],
				r: [art("white", 2, 1)],
				p: [art("white", 1, 1), art("depart")],
				P: [art("white", 1, 1), art("depart", 1)],
				q: [art("white", 1, 1), art("depart", 2)],
				Q: [art("white", 1, 1), art("depart", 3)],
				n: [art("glass", 1), art("eave", 1)],
				N: [art("glass", 1), art("eave", 1, 1)],
				x: [art("gray", 0, 1), art("glass", 1), art("sign92")],
				I: [art("gray", 1, 1), art("glass", 1), art("shopGlass", 1)],
				j: [art("gray", 2, 1), art("glass", 1), art("shopGlass", 2)],
				T: [art("gray", 1, 1), art("autoDoor", 0, 1)],
				D: [art("gray", 1, 1), art("autoDoor", 1, 1)],
			},
		},
		door: "保守村駅。\n発車ベルが、遠くで　鳴っている。",
		// 中：白い 石の 壁と 灰色の タイル。奥が ホーム（発車標・時計・路線図・ベンチ・ゴミ箱、黄色い 点字ブロック）、
		// まんなかに 改札 4台と 柵、右に 駅員室の 窓口（台の うしろに 駅員）、手前が コンコース
		// （券売機・コインロッカー・売店・観葉植物）。改札を 調べると 電車で 出かけられる
		room: {
			look: LOOKS.station,
			rows: [
				"##############",
				"#HwHHHHHabcdH#",
				"#hhhQhhm1234h#",
				"#.eE........v#",
				"#~~~~~~~~~~~~#",
				"#g.g.g.gfff[]#",
				"#............#",
				"#KK....LJsS..#",
				"#......lj...F#",
				"#####DD#######",
			],
			tiles: (k) => ({
				w: k.up(ri("winModern")),
				a: k.up(riCell("departures", 0, 0)),
				b: k.up(riCell("departures", 1, 0)),
				c: k.up(riCell("departures", 2, 0)),
				d: k.up(riCell("departures", 3, 0)),
				"1": k.low(riCell("departures", 0, 1)),
				"2": k.low(riCell("departures", 1, 1)),
				"3": k.low(riCell("departures", 2, 1)),
				"4": k.low(riCell("departures", 3, 1)),
				Q: k.low(CLOCK),
				"~": k.floor(ri("braille")),
				g: k.on(ri("medPanel")),
				f: k.on(ri("fenceIron")),
				"[": ctr(k.on(riCell("whiteCounter", 0, 0), ri("bell"))),
				"]": ctr(k.on(riCell("whiteCounter", 1, 0))),
				K: k.on(ri("atm")),
				L: k.on(riCell("lockers", 0, 0)),
				J: k.on(riCell("lockers", 1, 0)),
				l: k.on(riCell("lockers", 0, 1)),
				j: k.on(riCell("lockers", 1, 1)),
				s: k.on(riCell("lowShelf", 0, 0)),
				S: k.on(riCell("lowShelf", 1, 0)),
				v: k.on(ri("binCans")),
				e: k.on(riCell("bench", 0, 0)),
				E: k.on(riCell("bench", 1, 0)),
			}),
			things: {
				"1": "board",
				"2": "board",
				"3": "board",
				"4": "board",
				Q: "clock",
				m: "map",
				g: "gate",
				"[": "window",
				K: "machine",
				L: "locker",
				J: "locker",
				l: "locker",
				j: "locker",
				s: "kiosk",
				S: "kiosk",
				v: "bins",
				e: "bench",
				E: "bench",
				F: "plant",
			},
			lines: {
				board: [
					"発車標。\n「各駅停車　全体マップ　どこでも」",
					"……どの　板へも、すぐ　出る。",
				],
				clock: ["駅の　時計。\n……1秒も　ずれていない。"],
				map: ["路線図。\n島から　島へ、線が　のびている。"],
				gate: ["改札。\n電車で、どの　板へも　出かけられる。"],
				window: ["駅員室の　窓口。\n「忘れ物は　こちら」"],
				machine: ["券売機。\n「保守村　→　全体マップの　どこでも」"],
				locker: ["コインロッカー。\n1つだけ、鍵が　ささったまま。"],
				kiosk: ["売店。\nスポーツ新聞の　見出しは「やきう」。"],
				bins: ["分別の　ゴミ箱。\n「新聞・雑誌」の　口が　あふれている。"],
				bench: ["ホームの　ベンチ。\n……潮の　におい。"],
				plant: ["観葉植物。\n……潮の　においが　ここまで　届く。"],
			},
			plays: { gate: "depart" },
			people: [
				{
					id: "station_staff",
					walk: NANASHI[2],
					at: [12, 4],
					dir: "down",
					name: "駅員",
					lines: [
						"まもなく　電車が　まいります。\n……白線の　内がわで　お待ちください",
					],
				},
			],
		},
	},
	// ── 港（都市。東の 海を 埋め立てた 岸壁：コンテナ・クレーン・港湾事務所・工場。岸の 上に 発電所）
	{
		id: "port",
		name: "保守港",
		from: 7,
		at: [44, 43],
		look: {
			kind: "block",
			rows: [
				"こここここここここここここここここここここここここここここここここここここここここここ",
				"こここここここここここここここここここここここここここここここここここここここここここ",
				"こここここここここぎぐげぎぐげここここここここここここここここここここここここここここ",
				"こここここここここげぎぐげぎぐここここここここここここここここここここここここここここ",
				"こここここここここここここここここここここここここここここここここここここここここここ",
				"こここここここここここここここここここここここここここここここここここここここここここ",
				"ここここここここここここここここここここここここここここここごこここここごここここここ",
				"こここここここここここここここここここここここここここここここここここここここここここ",
				"こここここここここここここここここここここここここここここここここここここここここここ",
			],
			tiles: {},
		},
		outdoor: [
			{
				id: "container",
				at: [53, 45],
				lines: ["コンテナ。\n「おーぷん　→　保守村」と　書いてある。"],
			},
			{
				id: "crane",
				at: [74, 49],
				lines: ["クレーン。\n……コンテナを　つり上げている。"],
			},
		],
	},
	{
		id: "harbor",
		name: "港湾事務所",
		from: 7,
		at: [46, 44],
		// 青い 軒・白い 壁・掲示板・消火器・木箱
		look: {
			kind: "grid",
			ground: "quay",
			rows: ["aaaaa", "ddddd", "gGSGh", "iIDIj"],
			door: "D",
			keys: {
				a: [art("eave", 1)],
				d: [art("eave", 1, 1)],
				g: [art("white", 0, 1), art("win24")],
				G: [art("white", 1, 1), art("win24")],
				h: [art("white", 2, 1), art("win24")],
				S: [art("white", 1, 1), art("sign92", 1)],
				i: [art("white", 0, 2), art("small25", 1)],
				I: [art("white", 1, 2)],
				j: [art("white", 2, 2), art("box")],
				D: [art("white", 1, 2), base(5, 507, 1, 2)],
			},
		},
		door: "港湾事務所。\n無線の　声が　流れている。",
		// 中：灰色の タイルと 白い 壁。海の 見える 窓、入港予定の 掲示板、浮き輪、書類の 棚、無線機、
		// 机 2つ（右の 机の うしろに 職員）、すみに 段ボールと 観葉植物
		room: {
			look: LOOKS.office,
			rows: [
				"############",
				"#HwvHHbcgHH#",
				"#hWVhhBCGqh#",
				"#f........r#",
				"#.......n..#",
				"#.TUY..TUY.#",
				"#..........#",
				"#F.......xX#",
				"####DD######",
			],
			tiles: (k) => ({
				w: k.up(riCell("winBlue", 0, 0)),
				v: k.up(riCell("winBlue", 1, 0)),
				W: k.low(riCell("winBlue", 0, 1)),
				V: k.low(riCell("winBlue", 1, 1)),
				b: k.up(riCell("corkBoard", 0, 0)),
				c: k.up(riCell("corkBoard", 1, 0)),
				g: k.up(riCell("corkBoard", 2, 0)),
				B: k.low(riCell("corkBoard", 0, 1)),
				C: k.low(riCell("corkBoard", 1, 1)),
				G: k.low(riCell("corkBoard", 2, 1)),
				q: k.low(base(7, 297)),
				f: k.on(ri("cabinetGreyB")),
				r: k.on(base(2, 108), ri("radioTop")),
				n: k.floor(ri("chairDarkDown")),
				T: ctr(k.on(riCell("deskDark", 0, 0), ri("pcTop"))),
				U: ctr(k.on(riCell("deskDark", 1, 0))),
				Y: ctr(k.on(riCell("deskDark", 2, 0), onTop(1, 156))),
				x: k.on(ri("boxes")),
				X: k.on(ri("boxesB")),
			}),
			things: {
				W: "window",
				V: "window",
				B: "chart",
				C: "chart",
				G: "chart",
				q: "buoy",
				f: "cabinet",
				r: "radio",
				T: "desk",
				x: "boxes",
				F: "plant",
			},
			lines: {
				window: ["窓。\nコンテナ船が　ゆっくり　入ってくる。"],
				chart: ["入港予定の　表。\n「乗っ取り屋の　船：入港　禁止」"],
				buoy: ["浮き輪。\n「保守港」と　書いてある。"],
				cabinet: ["書類の　棚。\n積み荷の　台帳が　ぎっしり。"],
				radio: ["無線機。\n「こちら　保守港。どうぞ」"],
				desk: ["机。\n積み荷の　帳面が　山積み。"],
				boxes: ["段ボール。\n「天地無用」「ネタ　在中」。"],
				plant: ["観葉植物。\n……塩で　葉が　すこし　白い。"],
			},
			people: [
				{
					id: "harbor_staff",
					walk: NANASHI[0],
					at: [8, 4],
					dir: "down",
					name: "職員",
					lines: ["外の　島から、毎日　コンテナや。\n……中身は、たいてい　ネタ"],
				},
			],
		},
	},
	{
		id: "factory",
		name: "工場",
		from: 7,
		at: [62, 44],
		// 鉄板の 壁・シャッター・注意の 札（入れない）
		look: {
			kind: "grid",
			ground: "quay",
			rows: ["(-~--~-)", "[======]", "mwmwmwmw", "cLMmDLMc"],
			keys: {
				...ROOF_SLAB,
				m: [art("wallTex", 4)],
				w: [art("wallTex", 4), art("win108", 5)],
				L: [art("wallTex", 4), art("shutter")],
				M: [art("wallTex", 4), art("shutter", 1)],
				c: [art("wallTex", 4), art("caution")],
				D: [art("wallTex", 4), art("door108")],
			},
		},
		outdoor: [
			{
				id: "door",
				at: [66, 47],
				lines: ["工場。\n「保守用　スレ　製造中。立入禁止」"],
			},
		],
	},
	{
		id: "power",
		name: "発電所",
		from: 7,
		at: [80, 36],
		// 黄と 黒の しま・格子・金網の 柵・注意の 札（入れない）
		look: {
			kind: "grid",
			rows: ["(-~~-)", "[====]", "hhhhhh", "mgmgmg", "FGcDGH"],
			keys: {
				...ROOF_SLAB,
				m: [art("wallTex", 4)],
				h: [art("wallTex", 4), base(7, 480)],
				g: [art("wallTex", 4), art("wallTex", 5)],
				F: [art("fence")],
				G: [art("fence", 1)],
				H: [art("fence", 2)],
				c: [art("fence", 1), art("caution")],
				D: [art("wallTex", 4), art("door108")],
			},
		},
		outdoor: [
			{
				id: "door",
				at: [83, 40],
				lines: ["発電所。\n村の　灯りは　ここから。……保守の　電気。"],
			},
		],
	},
	// ── 保守中央公園（都市。市民農園の あと。噴水を 道が 一周し、北に ベンチ、西に 砂場、南の 入口に 立て札と きまりの 板）
	{
		id: "park",
		name: "保守中央公園",
		from: 7,
		at: [31, 12],
		look: {
			kind: "block",
			rows: [
				",,テトゆテトb",
				"ささゆゆゆゆゆニ",
				"さヒゆツツツゆ,",
				"ゆゆゆツツツゆノ",
				",ハゆツチツゆ,",
				",,ゆゆゆゆゆヌ",
				",ノナソゆフネ,",
			],
			tiles: {
				ソ: NAME_BOARD,
				// 噴水（3×3。下の まんなかに 絵、ほかの 8マスは 通れない 草）
				チ: big(C_GRASS, TURF, base(0, 132, 3, 3)),
				ツ: solid(C_GRASS, TURF),
				// ベンチ（左・右）
				テ: solid(C_GRASS, TURF, base(0, 121)),
				ト: solid(C_GRASS, TURF, base(2, 121)),
				// 花壇（黄・桃・白・青）
				ナ: solid(C_GRASS, TURF, base(2, 362)),
				ニ: solid(C_GRASS, TURF, base(3, 362)),
				ヌ: solid(C_GRASS, TURF, base(4, 362)),
				ネ: solid(C_GRASS, TURF, base(5, 362)),
				// 白い 花の 木（2マス幅）・草地の 街灯・砂場の バケツ・きまりの 板
				ノ: big(C_GRASS, TURF, base(4, 375, 2, 2)),
				ハ: solid(C_GRASS, TURF, `${STREET_IMG}#80,0,16,32`),
				ヒ: solid("#ecd9a0", base(4, 4), base(1, 124)),
				フ: solid(C_GRASS, TURF, base(4, 38)),
			},
		},
		outdoor: [
			{
				id: "sign",
				at: [34, 18],
				lines: ["立て札「保守中央公園」。\n畑の　あとに　できた　公園。"],
			},
			{
				id: "rules",
				at: [36, 18],
				lines: [
					"公園の　きまり。\n「ボール遊び　禁止。スレ立て　禁止」",
					"……下に　小さく「ROMるのは　可」。",
				],
			},
			// 噴水は 下の まんなか（絵の ある マス）の ほかに、道に 面した 7マスでも 調べられる（まんなかは 道に 面さない）
			{ id: "fountain", at: [35, 16], lines: FOUNTAIN },
			{ id: "fountain_nw", at: [34, 14], lines: FOUNTAIN },
			{ id: "fountain_n", at: [35, 14], lines: FOUNTAIN },
			{ id: "fountain_ne", at: [36, 14], lines: FOUNTAIN },
			{ id: "fountain_w", at: [34, 15], lines: FOUNTAIN },
			{ id: "fountain_e", at: [36, 15], lines: FOUNTAIN },
			{ id: "fountain_sw", at: [34, 16], lines: FOUNTAIN },
			{ id: "fountain_se", at: [36, 16], lines: FOUNTAIN },
			// 北の ベンチ 2つ（西・東。どちらも 左右の 半分）
			{ id: "bench", at: [33, 12], lines: BENCH },
			{ id: "bench_r", at: [34, 12], lines: BENCH },
			{ id: "bench_e", at: [36, 12], lines: BENCH },
			{ id: "bench_e_r", at: [37, 12], lines: BENCH },
			{
				id: "sandbox",
				at: [32, 14],
				lines: [
					"砂場。\nだれかの　作りかけの　お城が　ある。",
					"てっぺんに　つまようじの　旗。\n「完成まで　保守　よろ」",
				],
			},
		],
	},
	// ── 自販機（浜の 海の家の 横・バス停の 横。調べると 飲み物が 出る。コンビニと ゲームセンターの 自販機は 外観の 中）
	vending("vend_beach", [11, 35], 0, 2, "sand"),
	vending("vend_bus", [32, 20], 2, 6, "grass"),
	// ── 町の 中心の 道ばた（住宅街・都市。data/village/map.ts の coreCity）。ここより 前に 足すと ふつうの 家の 字が ずれる
	fixture(
		"post",
		"郵便ポスト",
		[9, 18],
		6,
		"ヅ",
		solid(C_GRASS, TURF, POST_ART),
		POST_LINES,
		7,
	),
	fixture(
		"post_city",
		"郵便ポスト",
		[9, 18],
		7,
		"ゴ",
		solid(C_WALK, SIDEWALK, POST_ART),
		POST_LINES,
	),
	fixture(
		"clock",
		"広場の 時計",
		[23, 22],
		7,
		"バ",
		solid(C_BRICK, BRICK, `${STREET_IMG}#304,0,16,48`),
		[
			"広場の　時計。\n待ち合わせは　だいたい　ここ。",
			"柱に　小さく\n「1000年　保守」と　彫ってある。",
		],
	),
	fixture(
		"phone",
		"電話ボックス",
		[30, 18],
		7,
		"ビ",
		solid(C_WALK, SIDEWALK, `${STREET_IMG}#336,0,16,32`),
		[
			"公衆電話。\n返却口に　10円玉が　1枚。",
			"……テレホーダイの　時間は\n23時から。",
		],
	),
	// ── タクシー乗り場（都市。バス停の 東。草地の 花の 鉢を 標識に、道ばたに タクシー）
	{
		id: "taxi",
		name: "タクシー乗り場",
		from: 7,
		at: [33, 20],
		look: {
			kind: "block",
			rows: ["プペポ"],
			tiles: {
				プ: solid(C_GRASS, TURF, `${STREET_IMG}#416,0,16,32`),
				ペ: solid(C_ASPHALT, ASPHALT, `${STREET_IMG}#384,0,16,16`),
				ポ: solid(C_ASPHALT, ASPHALT, `${STREET_IMG}#400,0,16,16`),
			},
		},
		outdoor: [
			{
				id: "sign",
				at: [33, 20],
				lines: ["タクシー乗り場。\n運転手は　スマホで　スレを　見ている。"],
			},
		],
	},
	// ── 擁壁の 上の ビル（都市。崖の 上の 森を 開いた 所。入れない）
	{
		id: "hills",
		name: "保守ヒルズ",
		from: 7,
		at: [9, 1],
		// ガラスの 塔（入れない）
		look: {
			kind: "grid",
			rows: ["(-*-)", "[===]", "GgGgG", "GgGgG", "GgGgG", "iiDii"],
			keys: {
				...ROOF_SLAB,
				g: [art("wallTex", 3)],
				G: [art("glass", 1)],
				D: [art("gray", 1, 1), art("door108")],
				i: [art("gray", 1, 1)],
			},
		},
	},
	// 足もとは 本館の 屋根なので 正面に 扉は 描かない（扉の 列を 灰色の 壁に）。看板は 右はしの 下の 段（東の 草地から 読む）
	{
		id: "zakkyo",
		name: "雑居ビル",
		from: 7,
		at: [15, 0],
		// 灰色の ビル・電光の 看板・室外機。右はしの 下の 段に 青い 看板（19,5）
		look: {
			kind: "grid",
			rows: ["(-~-)", "[===]", "gGuGh", "g12Gh", "gGuGh", "g3Go4", "iIIIj"],
			keys: {
				...ROOF_SLAB,
				g: [art("gray"), art("win108", 2)],
				G: [art("gray", 1), art("win108", 2)],
				h: [art("gray", 2), art("win108", 2)],
				o: [art("gray", 1)],
				"1": [art("gray", 1), art("ledGray")],
				"2": [art("gray", 1), art("ledGray", 1)],
				u: [art("gray", 1), base(3, 394)],
				"3": [art("gray", 1), art("sign25")],
				"4": [art("gray", 2), art("sign25", 1)],
				i: [art("gray", 0, 1)],
				I: [art("gray", 1, 1)],
				j: [art("gray", 2, 1)],
			},
		},
		outdoor: [
			{
				id: "sign",
				at: [19, 5],
				lines: [
					"雑居ビルの　看板。\n「2F　スレ立て代行　3F　空き」",
					"4Fは　ずっと「準備中」。\n……もう　3年も　たつらしい。",
				],
			},
		],
	},
	// ── 飲食店（data/village/eateries.ts。たこ焼き屋台・立ち食いそば・牛丼・居酒屋・寿司・中華）
	...EATERIES,
];

/** その 段に 立っている 施設。 */
export const facilitiesAt = (stage: number): Facility[] =>
	FACILITIES.filter(
		(f) => stage >= f.from && (f.until === undefined || stage < f.until),
	);

export const facilityById = (id: string): Facility | undefined =>
	FACILITIES.find((f) => f.id === id);

// ───────────────── 外観 ─────────────────

/** ふつうの 家の 字（施設ごとに 8字。CJK 拡張A の 字を 割りふる：ほかの パレットと かぶらない）。 */
const PARTS = [
	"ridge",
	"eave",
	"up",
	"upWin",
	"upSign",
	"low",
	"door",
	"lowDeco",
] as const;
const partChar = (i: number, part: (typeof PARTS)[number]): string =>
	String.fromCodePoint(0x3400 + i * PARTS.length + PARTS.indexOf(part));

/**
 * 絵を 並べた 外観の 字（施設ごとに 96字。CJK 統合漢字の 頭 U+4E00 から。村の ほかの パレットは この 範囲を
 * 使わない）。k は キーの 番号（keys の 並び）。
 */
const GRID_SPAN = 96;
const gridChar = (i: number, k: number): string =>
	String.fromCodePoint(0x4e00 + i * GRID_SPAN + k);
const gridKeyIndex = (g: GridLook): Map<string, number> =>
	new Map(Object.keys(g.keys).map((k, n) => [k, n]));
/** 透けた 部品の 下に 敷く 地面（色と 絵）。 */
const GRID_GROUND: Record<
	NonNullable<GridLook["ground"]>,
	readonly [string, string?]
> = {
	grass: [C_GRASS, TURF],
	sand: ["#ecd9a0", base(4, 4)],
	pier: [C_PIER, base(0, 46)],
	quay: ["#a8a8a4", `${STREET_IMG}#112,16,16,16`],
	none: [C_ASPHALT],
};

/** 外観の 行（施設の 左上から）。 */
export const facilityBlock = (f: Facility): readonly string[] => {
	if (f.look.kind === "block") return f.look.rows;
	if (f.look.kind === "grid") {
		const i = FACILITIES.indexOf(f);
		const idx = gridKeyIndex(f.look);
		return f.look.rows.map((r) =>
			[...r]
				.map((k) => (k === " " ? " " : gridChar(i, idx.get(k) ?? 0)))
				.join(""),
		);
	}
	const b = f.look;
	const i = FACILITIES.indexOf(f);
	const ch = (p: (typeof PARTS)[number]) => partChar(i, p);
	const door = b.door ?? Math.floor(b.w / 2);
	const win = b.windows ?? b.wall !== 71;
	// 看板は 扉の となりの 上段（扉の 絵は 2マスの 高さで 上段に かかるので、扉の 真上には 置かない）
	const signX = door + 1 < b.w ? door + 1 : door - 1;
	const ups = Array.from({ length: b.tall ?? 1 }, (_, k) =>
		Array.from({ length: b.w }, (_, x) =>
			k === (b.tall ?? 1) - 1 && x === signX && b.sign
				? ch("upSign")
				: win && x !== door && x % 2 === (door + 1) % 2
					? ch("upWin")
					: ch("up"),
		).join(""),
	);
	return [
		ch("ridge").repeat(b.w),
		ch("eave").repeat(b.w),
		...ups,
		Array.from({ length: b.w }, (_, x) =>
			x === door ? ch("door") : ch("low"),
		).join(""),
	];
};

/** 扉の マス（地図の 座標。中が ない 施設は null）。 */
export const facilityDoor = (f: Facility): Cell | null => {
	if (!f.room) return null;
	if (f.look.kind === "block") {
		const d = f.look.door;
		return d ? [f.at[0] + d[0], f.at[1] + d[1]] : null;
	}
	if (f.look.kind === "grid") {
		const d = gridDoor(f.look);
		return d ? [f.at[0] + d[0], f.at[1] + d[1]] : null;
	}
	const rows = facilityBlock(f);
	return [
		f.at[0] + (f.look.door ?? Math.floor(f.look.w / 2)),
		f.at[1] + rows.length - 1,
	];
};

/** 出たときに 立つ 所（扉の 1つ下。下を 向く）。 */
export const facilityOutside = (f: Facility): FacilitySpot => {
	const d = facilityDoor(f) ?? f.at;
	return { x: d[0], y: d[1] + 1, dir: "down" };
};

/** 外観の 絵（絵を 並べた 外観・ふつうの 家の 字と、block の 字）。村の パレットに まぜる。 */
export const facilityTiles = (): Record<string, TileDef> => {
	const out: Record<string, TileDef> = {};
	FACILITIES.forEach((f, i) => {
		if (f.look.kind === "block") {
			Object.assign(out, f.look.tiles);
			return;
		}
		if (f.look.kind === "grid") {
			const g = f.look;
			const [color, ground] = GRID_GROUND[g.ground ?? "grass"];
			for (const [k, n] of gridKeyIndex(g)) {
				const layers = [...(ground ? [ground] : []), ...g.keys[k]];
				// 扉は 中が ある ときだけ 通れる（踏むと 入る）。屋台の 台の うしろも 通れる
				out[gridChar(i, n)] =
					(k === g.door && f.room) || g.floor?.includes(k)
						? floor(color, ...layers)
						: g.counter?.includes(k)
							? counter(color, ...layers)
							: solid(color, ...layers);
			}
			return;
		}
		const b = f.look;
		const ch = (p: (typeof PARTS)[number]) => partChar(i, p);
		const wallColor = "#8a7a6a";
		const up = base(1, b.wall);
		const low = base(1, b.wall + 1);
		out[ch("ridge")] = solid("#6a4a3a", base(b.roof, 82));
		out[ch("eave")] = solid("#7a5a4a", base(b.roof, 84));
		out[ch("up")] = solid(wallColor, up);
		out[ch("upWin")] = solid(wallColor, up, WINDOW);
		out[ch("upSign")] = solid(wallColor, up, b.sign ?? "");
		out[ch("low")] = solid(wallColor, low);
		const doorArt = base(b.doorCol ?? 7, b.wall, 1, 2);
		out[ch("door")] = b.closed
			? solid(wallColor, low, doorArt)
			: floor(wallColor, low, doorArt);
		out[ch("lowDeco")] = solid(wallColor, low, base(3, 362));
	});
	return out;
};

/**
 * 建物の 影（マス単位。光は 左上から：建物の 右がわの 地面に、軒から 足もとまで）。ふつうの 家と 絵を 並べた
 * 外観（車・バス停は 落とさない。block の 外観＝グラウンド・港なども 影なし）。ui/facilities.ts の shadowDecor が 描く。
 * 絵を 並べた 外観は 右はしの 同じ 行を まとめて 1本ずつ（コンビニの 自販機のような 出っぱりにも 影）。
 */
export const facilityShadows = (
	stage: number,
): { x: number; top: number; bottom: number }[] =>
	facilitiesAt(stage).flatMap((f) => {
		const look = f.look;
		if (look.kind === "building") {
			const rows = facilityBlock(f).length;
			return [
				{ x: f.at[0] + look.w, top: f.at[1] + 1, bottom: f.at[1] + rows },
			];
		}
		if (look.kind !== "grid" || look.shadow === false) return [];
		const out: { x: number; top: number; bottom: number }[] = [];
		look.rows.forEach((r, y) => {
			const x = f.at[0] + [...r.trimEnd()].length;
			const last = out[out.length - 1];
			if (last && last.x === x && last.bottom === f.at[1] + y)
				last.bottom = f.at[1] + y + 1;
			else
				out.push({
					x,
					top: f.at[1] + Math.max(y, 1),
					bottom: f.at[1] + y + 1,
				});
		});
		return out;
	});

/** 地図に 施設を 置く（地面 → 外観。村の 行を 書きかえる）。 */
export const stampFacilities = (
	rows: string[],
	stage: number,
	put: (rows: string[], c: Cell, ch: string) => void,
): void => {
	for (const f of facilitiesAt(stage)) {
		for (const [x0, y, line, until] of f.clear ?? []) {
			if (until !== undefined && stage >= until) continue;
			[...line].forEach((ch, dx) => {
				put(rows, [x0 + dx, y], ch);
			});
		}
		facilityBlock(f).forEach((line, dy) => {
			[...line].forEach((ch, dx) => {
				if (ch !== " ") put(rows, [f.at[0] + dx, f.at[1] + dy], ch);
			});
		});
	}
};

// ───────────────── 中 ─────────────────

const CEIL = "#1b1410";

/** 部屋の 行。 */
export const facilityRoomRows = (f: Facility): string[] => [
	...(f.room?.rows ?? []),
];

/** 出口の マット（2マス）。 */
export const facilityMats = (f: Facility): readonly Cell[] => {
	const rows = f.room?.rows ?? [];
	const y = rows.length - 1;
	const x = [...(rows[y] ?? "")].indexOf("D");
	return [
		[x, y],
		[x + 1, y],
	];
};

/** 入ったときに 立つ 所（左の マットの 1つ上。上を 向く）。 */
export const facilityEntry = (f: Facility): FacilitySpot => {
	const [x, y] = facilityMats(f)[0];
	return { x, y: y - 1, dir: "up" };
};

/** 部屋の パレット（屋内 INDOOR が 下地。施設ごとの 物を 上書き）。 */
export const facilityRoomPalette = (f: Facility): Record<string, TileDef> => {
	const room = f.room;
	if (!room) return {};
	const l = room.look;
	const kit: RoomKit = {
		on: (...refs) => solid(l.floorColor, l.floor, ...refs),
		up: (...refs) => solid(l.wallColor, l.up, ...refs),
		low: (...refs) => solid(l.wallColor, l.low, ...refs),
		floor: (...refs) => floor(l.floorColor, l.floor, ...refs),
	};
	return {
		...INDOOR,
		"#": solid(CEIL),
		H: kit.up(),
		h: kit.low(),
		W: kit.up(WINDOW),
		m: kit.low(PAPER),
		".": kit.floor(),
		D: floor("#a01818", l.floor, base(2, 49)),
		F: kit.on(base(7, 129, 1, 2)),
		U: kit.on(base(3, 125)),
		x: kit.on(base(4, 123)),
		t: kit.on(base(2, 108)),
		n: kit.floor(base(2, 109)),
		...(room.tiles?.(kit) ?? {}),
	};
};

/** 部屋に 置く 物（出口の マットと 調べる 物）。人は facilityPeople。 */
export const facilityRoomPlaces = (
	f: Facility,
): { id: string; x: number; y: number; trigger: "talk" | "touch" }[] => {
	const room = f.room;
	if (!room) return [];
	const out: { id: string; x: number; y: number; trigger: "talk" | "touch" }[] =
		facilityMats(f).map(([x, y], i) => ({
			id: `mat_${i}`,
			x,
			y,
			trigger: "touch",
		}));
	const count: Record<string, number> = {};
	room.rows.forEach((r, y) => {
		[...r].forEach((ch, x) => {
			const kind = room.things[ch];
			if (!kind) return;
			// 上段の 物（窓・看板）は 真下の 下段に（1つ下の 床から 読む）。下段に ほかの 物が あれば 読まない
			if (y === 1 && room.rows[y + 1]?.[x] !== "h") return;
			const at = y === 1 ? 2 : y;
			const n = count[kind] ?? 0;
			count[kind] = n + 1;
			out.push({ id: `${kind}_${n}`, x, y: at, trigger: "talk" });
		});
	});
	return out;
};

/** 外に 置く 物の イベントの id（施設の id と 物の id）。 */
export const outdoorId = (f: Facility, t: OutdoorThing): string =>
	`fthing_${f.id}_${t.id}`;

/**
 * イベントの id から 外に 置く 物と その 施設。id は ぴったり 合わせる
 * （「post」と「post_city」の ように 頭が 同じ 施設が あるので、頭だけ 見ると 前の 施設に 取られる）。
 */
export const outdoorThingOf = (
	id: string,
): { f: Facility; t: OutdoorThing } | undefined => {
	for (const f of FACILITIES)
		for (const t of f.outdoor ?? [])
			if (outdoorId(f, t) === id) return { f, t };
	return undefined;
};

/** 扉の イベントの id。 */
export const doorId = (f: Facility): string => `door_f_${f.id}`;

/** 地図の id（村の 地図と 部屋を 切りかえる 名前）。 */
export const facilityMapId = (f: Facility): string => `f_${f.id}`;

/** 地図の id から 施設（施設の 部屋で なければ undefined）。 */
export const facilityOfMap = (map: string): Facility | undefined =>
	map.startsWith("f_") ? facilityById(map.slice(2)) : undefined;
