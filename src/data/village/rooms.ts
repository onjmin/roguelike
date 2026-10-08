// 村の 建物の 中（喫茶「保守」・やきうの 小屋・常識堂の 奥・倉庫）。DOM も 保存も 使わない 組み立てだけ
// （src/sim/villageTests.ts で 形と 歩ける道を 調べる）。スクリプトは ui/rooms.ts（喫茶は ui/cafe.ts）が id で 付ける。
// おんJ 本館の 中は data/village/hall.ts（段で 育つので 別）。
//
// 部屋の 形は 本館と 同じ（上に 天井 # と 壁 2段 H h、下の 壁に 出口の マット D が 2マス）。
// 壁に かけた 物は 壁の 下段に 見えない イベントを 置き、1つ下の 床から 上を 向いて 調べる。
// 2マスの 高さの 物（本棚・植木鉢・トルソー など）は 上の マスに はみ出して 手前に 描くので、
// その 真上の マスには 物を 置かない（はみ出しに かくれる。src/sim/villageTests.ts で 調べる）。
// 入り方：どの 部屋も 村の 扉を 踏む（前で A でも）。出ると 扉の 1つ下（下を 向く）。
//   常識堂の 奥・倉庫の 扉は 台の 横の 細道の 奥（常識堂は 右・倉庫は 左。店番の ロゼ・シヨは 話すだけ）。
//
// 音楽室「ピアノ機能」（町の 段3 から。南の 池の そば。開くのは 週末だけ）
//   おーぷんの 消えた 機能（kome の 週末限定の ピアノ）を 供養する 部屋。ピアノで 村の 曲を 選んで 鳴らせる。
//   字：7 8 9 / 1 2 3  赤い ステージ   P p ピアノ   L スピーカー   n 客席の いす（通れる）   m 供養の 札
//       e 拍手の はり紙   d 楽屋の 扉   f スタンド花   B 楽譜の 棚   t 物販の 机
//
// 銭湯「ゆ」（町の 段4 から。南東の 池の そば。人と 会話は ui/bath.ts）
//   下が 入口（番台）、のれんの 先が 脱衣所、戸の 先が 浴室。左が 男湯・右が 女湯で、まんなかの 仕切りの 上に 番台。
//   キリコは 女湯へ（男湯の のれんを くぐろうと すると 番台に 止められる）。浴室の 仕切りは 台と 同じで、
//   壁ごしに 男湯の 人と 話せる。湯（~）に 入ると 体の 下半分が 湯に かくれる（タイルの above）。
//   字：~ 湯   . 洗い場の タイル   | 浴室の 仕切り（壁ごしに 話せる）   I 脱衣所の 仕切り   Q 富士山の 壁画
//       k 鏡と 蛇口   o 桶   s 浴室の 戸（通れる）   , 脱衣所の 床   L ロッカー   c 脱衣かご   M 牛乳の 冷蔵庫
//       N n のれん（男湯・女湯。通れる）   b 番台の 席   B 番台（台ごしに 話す）   : 入口の 土間
//       m 浴室の はり紙   P 料金表   C マッサージ椅子   G 下駄箱   e 消火器   ( ) 長いす（左・右）
//   入口（番台より 下）は 男女 いっしょなので、左がわの 物も 調べられる。
//
// 喫茶「保守」（町の 段5 から）
//   左に カウンター（台の うしろに マスター、台の 前に 丸いす）。右に ソファの 席。下に 丸テーブルと ピアノ。
//   客は 冒険から 帰るたびに 抽選（ui/cafe.ts の cafeLayout）。仲間は 席（CAFE_SLOTS）に すわり、
//   となりが 空いていれば キリコが すわって 話す。となりに だれか いれば 話しこんでいる（そばで 聞ける）。
//   住人（おんJマイナーズ）は 越してきた 子の なかから 帰りごとに 何人か 来ている（CAFE_PATRON_SPOTS）。
//   字：b 酒棚（壁の 下段。瓶は ui/cafe.ts の decor が 描く）  A 杯の 看板  m 品書き  k 柱時計  Q 絵
//       [ = ]  カウンター（台ごしに マスターと 話す）  U 樽  s S ソファ  t 低い 机  n 丸いす（通れる）
//       O 白い 丸テーブル  P p ピアノ  F 観葉植物  r 開店の 日の 写真  e サイン色紙  B 漫画の 棚
//       R 入口の そばの レジ（席・グラスの 置き場とは 重ならない 空きマスだけ）
//
// 本屋（町の 段3〜5。広場の 西）→ 図書館（段6 から。同じ 所に 建てかえ）
//   ことばの 辞典（data/glossary.ts）を 立ち読みする 店（売り場では ない。お金を 使う 所は 作らない）。
//   本棚（B）を 調べると 辞典。本屋で 板の ことば、図書館で 深い ネタが ふえる。壁の はり紙（m）は 監修の ヒナリー。
//   中の 人は 名無しの 店番・司書（ヒナリーは 村で 話す。ui/rooms.ts の booksPeople）。
//   字：B 本棚   T 机   t 読書の 机   n いす（通れる）

import type { TileDef } from "../../engine/defs";
import type { Dir } from "../../engine/types";
import { BOOKSTORE_FROM, LIBRARY_FROM } from "../glossary";
import type { Speaker } from "../quotes";
import type { Cell } from "./map";
import { base, basePx, floor, INDOOR, solid } from "./tiles";

export type RoomId =
	| "cafe"
	| "hut"
	| "shop"
	| "store"
	| "music"
	| "bath"
	| "bookstore"
	| "library";

export const ROOM_IDS: readonly RoomId[] = [
	"cafe",
	"hut",
	"shop",
	"store",
	"music",
	"bath",
	"bookstore",
	"library",
];

export const isRoom = (id: string): id is RoomId =>
	(ROOM_IDS as readonly string[]).includes(id);

/** 音楽室の 人（ステージの 上・客席）。 */
export const MUSIC_STAGE: Cell = [4, 3];

/** 立つ 所と 向き。 */
export type Spot = { x: number; y: number; dir: Dir };

/** 音楽室の 客席（帰りごとに 名無しと 住人が すわる。ui/guests.ts）。 */
export const MUSIC_SEATS: readonly Spot[] = [
	{ x: 2, y: 6, dir: "up" },
	{ x: 3, y: 6, dir: "up" },
	{ x: 4, y: 6, dir: "up" },
	{ x: 8, y: 6, dir: "up" },
	{ x: 9, y: 6, dir: "up" },
	{ x: 10, y: 6, dir: "up" },
];

/**
 * 本屋・図書館で 立ち読み している 住人の 所（本棚の 前。帰りごとに ui/guests.ts が 決める）。
 * 本棚の 絵は 2マスの 高さなので、本棚の 1つ上の マスに 立つと 絵に かくれる。そこは 使わない。
 */
export const BOOKS_BROWSE: Record<"bookstore" | "library", readonly Spot[]> = {
	bookstore: [
		{ x: 1, y: 4, dir: "up" },
		{ x: 8, y: 4, dir: "up" },
		{ x: 12, y: 4, dir: "up" },
	],
	library: [
		{ x: 1, y: 4, dir: "up" },
		{ x: 8, y: 4, dir: "up" },
		{ x: 13, y: 4, dir: "up" },
	],
};

/** 部屋に 置く イベント（壁の 物・家具・出口）。人は 部屋ごとの ui が 置く。 */
export type RoomPlace = {
	id: string;
	x: number;
	y: number;
	trigger: "talk" | "touch";
	sprite?: string;
	dir?: Dir;
};

// ───────────────── 行 ─────────────────

const ROWS: Record<RoomId, readonly string[]> = {
	cafe: [
		"####################",
		"#HHWHHAHHHWHHHQHHWH#",
		"#bbbbbbhmrhhkhhehhh#",
		"#......U..sS.F..sS.#",
		"#[=====]..tt....tt.#",
		"#nnnnnnn...........#",
		"#..................#",
		"#..................#",
		"#Pp...nOn..nOn.sS.B#",
		"#..............tt..#",
		"#F.........R......F#",
		"#########DD#########",
	],
	// やきうの 小屋：寝床・道具掛け・ラジオ・ストーブ・作業台・釘の 樽・薪割り台・薪・水桶・ボールかご。
	// 壁に ペナント・日めくり・設計図・かえの ユニフォーム
	hut: [
		"#############",
		"#HHWHHHHHWHH#",
		"#hPhhcmhyhhh#",
		"#Z.R...L..xK#",
		"#z..........#",
		"#....tt...U.#",
		"#...........#",
		"#.Aw.....go.#",
		"#F.........F#",
		"#####DD######",
	],
	// 常識堂の 奥：本棚（4つめは 物理）・白衣・かまど・流し・麻婆豆腐の 鍋・調味料の 棚・まかないの 机・
	// 実験の 机・仕入れの 箱。壁に 式で うまった 黒板と 常識 十か条
	shop: [
		"###############",
		"#HWHAH456HHHHW#",
		"#hhhhh123hhhmh#",
		"#BBBBw...KSu.y#",
		"#.............#",
		"#.nTTn...kk...#",
		"#.............#",
		"#.........xxU.#",
		"#F...........F#",
		"#####DD########",
	],
	// 音楽室「ピアノ機能」：ステージ・スタンド花・楽譜の 棚・ピアノ・スピーカー・客席・物販の 机。
	// 壁に 拍手の はり紙・供養の 札・楽屋の 扉
	music: [
		"##############",
		"#HHWHHHHHHWHH#",
		"#hehhhmhhhhdh#",
		"#L.789.fBPp.L#",
		"#..123.......#",
		"#............#",
		"#.nnn...nnn..#",
		"#............#",
		"#F.......tt.F#",
		"######DD######",
	],
	// 銭湯「ゆ」：上が 浴室、なかが 脱衣所、下が 入口。左が 男湯・右が 女湯
	bath: [
		"#################",
		"#HHHHHHHHHHHHHHH#",
		"#hhhQhhhhhhhQhmh#",
		"#~~~~~~~|~~~~~~~#",
		"#~~~~~~~|~~~~~~~#",
		"#.......|.......#",
		"#ko..ko.|.ok..ok#",
		"#hhhshhhhhhhshhh#",
		"#,,,,,,,IC,,,,,,#",
		"#LLc,,M,I,M,,cLL#",
		"#,,,,,,,I,,,,,,,#",
		"#hhhNhhhbhPhnhhh#",
		"#GG:::::B::::eGG#",
		"#:::::::::::::::#",
		"#F:::::::::()::F#",
		"#######DD########",
	],
	// 本屋：壁ぞいと まんなかに 本棚、平台（新刊）・雑誌の 棚・店番の 机。壁に 監修の はり紙と ポスター、上に 本の 看板
	bookstore: [
		"##############",
		"#HHWHHAHHHWHH#",
		"#hhhhmkhhhhhh#",
		"#BBBB..BBBBBB#",
		"#............#",
		"#.BB.ss..T...#",
		"#............#",
		"#.BB.ss..MM..#",
		"#F..........F#",
		"######DD######",
	],
	// 図書館：壁の 本棚と 本棚の 列、金の じゅうたんの 読書の 机、地球儀・新聞・目録・司書の 机・返却ポスト、
	// 2階（過去ログ書庫）への 階段。壁に 監修の はり紙・時計・初代館長の 肖像
	library: [
		"##################",
		"#HHWHHWHHHQHWHHWH#",
		"#hhhhmhhhhhhhhkhh#",
		"#BBBB.BBBB.BBB.<{#",
		"#...............Y#",
		"#.BB.BB..----....#",
		"#.......-tttt-.R.#",
		"#.BB.BB.-nnnn-...#",
		"#.......------.C.#",
		"#.BB.BB.......T..#",
		"#F.....X........F#",
		"########DD########",
	],
	// 倉庫：あずかった 物の 棚・帰ってこない 人の 棚・替えの メイド服・シヨの 机と いす・壺・袋・掃除機・木箱・樽。
	// 壁に 鍵の 板・『生きてこそだ』の 額・奥の 扉（段で 金庫の 扉）・あずかり帳・伝言板
	store: [
		"##############",
		"#HWHHH()HHH[]#",
		"#hhhhkhhhvmhh#",
		"#SsQq...d....#",
		"#............#",
		"#.uu..Tn.gg..#",
		"#...........c#",
		"#........xxUU#",
		"#F...........#",
		"####DD########",
	],
};

/** 部屋の 行。 */
export const roomRows = (id: RoomId): string[] => [...ROWS[id]];

/** 喫茶の カウンターの 丸いす（台の 前の n）か。「あちらの　お客様から」は ここだけ（ui/cafe.ts）。 */
export const onCafeCounter = (x: number, y: number): boolean =>
	ROWS.cafe[y]?.[x] === "n" && "[=]".includes(ROWS.cafe[y - 1]?.[x] || "#");

/** 出口の マット（2マス）。 */
export const roomMats = (id: RoomId): readonly Cell[] => {
	const rows = ROWS[id];
	const y = rows.length - 1;
	const x = [...rows[y]].indexOf("D");
	return [
		[x, y],
		[x + 1, y],
	];
};

/** 入ったときに 立つ 所（左の マットの 1つ上。上を 向く）。 */
export const roomEntry = (id: RoomId): Spot => {
	const [x, y] = roomMats(id)[0];
	return { x, y: y - 1, dir: "up" };
};

/**
 * 出たときに 立つ 村の 所（どの 部屋も 村の 扉の 1つ下。下を 向く）。
 * 扉の 所（data/village/map.ts の VILLAGE_SPOTS）を 書き写す（map.ts が ここの ROOM_FROM を 読むので、
 * ここからは 読まない。ずれは src/sim/villageTests.ts で 見る）。
 */
export const ROOM_OUTSIDE: Record<RoomId, Spot> = {
	cafe: { x: 4, y: 19, dir: "down" },
	hut: { x: 23, y: 19, dir: "down" },
	shop: { x: 16, y: 17, dir: "down" },
	store: { x: 25, y: 17, dir: "down" },
	music: { x: 22, y: 29, dir: "down" },
	bath: { x: 35, y: 28, dir: "down" },
	bookstore: { x: 4, y: 23, dir: "down" },
	library: { x: 4, y: 23, dir: "down" },
};

/** 入れる 町の 段（常識堂は 小さな 店に なってから。屋台には 奥が ない）。 */
export const ROOM_FROM: Record<RoomId, number> = {
	cafe: 5,
	hut: 3,
	shop: 5,
	store: 2,
	music: 3,
	bath: 4,
	bookstore: BOOKSTORE_FROM,
	library: LIBRARY_FROM,
};

/** 本屋・図書館の 店番・司書の 立つ 所（机の となり）。 */
export const BOOKS_KEEPER: Record<"bookstore" | "library", Spot> = {
	bookstore: { x: 10, y: 5, dir: "left" },
	library: { x: 15, y: 9, dir: "left" },
};

// ───────────────── パレット ─────────────────

const CEIL = "#1b1410";
/** 銭湯の 湯（池の 岸の オートタイルの まんなか）と、人の 下半分を かくす 湯の おもて。 */
const BATH_WATER = "pub:assets/rpg-reze/pond.png#0,64,16,16";
const BATH_WATER_LOW = "pub:assets/rpg-reze/pond.png#0,72,16,8";
const PAPER = basePx(32, 1446);
const WINDOW = basePx(48, 1382);
const PICTURE = basePx(80, 1446);
/**
 * 小物（位置微調整用の 行 149〜160 の 絵を、台の 上に のせる）。その 行の 絵は 下はしが r 行の 上から 4〜6px に
 * あるので、r 行の 8px 上から 切ると 下はしが マスの 下から 2〜4px 上に くる。
 */
const onTop = (c: number, r: number) => basePx(c * 16, r * 16 - 8);

/** 銭湯の 仕切りの x（これより 左が 男湯）・番台の 席・男湯の のれん。 */
export const BATH_WALL = 8;
export const BATH_BANDAI: Cell = [8, 11];
export const BATH_NOREN_M: Cell = [4, 11];

/** 銭湯で 人の 立つ 所（湯に つかる・脱衣所で 着がえる。左が 男湯）。 */
export const BATH_SPOTS = {
	/** 女湯の 湯船。 */
	soak: [
		{ x: 10, y: 3, dir: "down" },
		{ x: 13, y: 3, dir: "down" },
		{ x: 15, y: 4, dir: "left" },
		{ x: 11, y: 4, dir: "down" },
	],
	/** 女湯の 脱衣所（ロッカー・冷蔵庫の 前）。 */
	dress: [
		{ x: 14, y: 10, dir: "up" },
		{ x: 10, y: 10, dir: "up" },
		{ x: 15, y: 8, dir: "left" },
	],
	/** 男湯の 湯船（仕切りの となり。女湯の 9 から 壁ごしに 話す）。 */
	menSoak: [
		{ x: 7, y: 3, dir: "right" },
		{ x: 7, y: 4, dir: "right" },
	],
	/** 男湯の 奥（話せない。にぎやかし）。 */
	menBack: [
		{ x: 3, y: 3, dir: "down" },
		{ x: 5, y: 10, dir: "up" },
	],
} as const satisfies Record<string, readonly Spot[]>;

type Look = {
	floor: string;
	floorColor: string;
	up: string;
	low: string;
	wallColor: string;
};

const LOOK: Record<RoomId | "shed" | "bank", Look> = {
	// 喫茶：しま模様の 壁紙と 腰板、こげ茶の 寄せ木
	cafe: {
		floor: base(0, 49),
		floorColor: "#6a4a30",
		up: base(1, 75),
		low: base(1, 76),
		wallColor: "#e8d8a0",
	},
	hut: {
		floor: base(0, 46),
		floorColor: "#b8905a",
		up: base(1, 55),
		low: base(1, 56),
		wallColor: "#6a4a2a",
	},
	shop: {
		floor: base(2, 48),
		floorColor: "#d8c08a",
		up: base(1, 59),
		low: base(1, 60),
		wallColor: "#e8e8e8",
	},
	// 石造りの 倉庫（段6 から）
	store: {
		floor: base(3, 46),
		floorColor: "#9a9a9a",
		up: base(1, 67),
		low: base(1, 68),
		wallColor: "#8a8a8a",
	},
	// 銭湯：白い 石の 壁、入口は 板の 間
	bath: {
		floor: base(0, 46),
		floorColor: "#b8905a",
		up: base(1, 63),
		low: base(1, 64),
		wallColor: "#d8d8d8",
	},
	// 音楽室：白い 壁と 濃い 板の 床
	music: {
		floor: base(0, 47),
		floorColor: "#5a4030",
		up: base(1, 77),
		low: base(1, 78),
		wallColor: "#e8e4dc",
	},
	// 銀行の 貸金庫（段7）：白い 石の 壁と 石の 床
	bank: {
		floor: base(3, 46),
		floorColor: "#b8b4a8",
		up: base(1, 63),
		low: base(1, 64),
		wallColor: "#d8d4c8",
	},
	// 本屋：板の 壁と 木の 床
	bookstore: {
		floor: base(0, 46),
		floorColor: "#b8905a",
		up: base(1, 55),
		low: base(1, 56),
		wallColor: "#6a4a2a",
	},
	// 図書館：石の 壁と 濃い 板の 床
	library: {
		floor: base(0, 47),
		floorColor: "#5a4030",
		up: base(1, 67),
		low: base(1, 68),
		wallColor: "#8a8a8a",
	},
	// 板張りの 物置・倉庫（段2〜5）
	shed: {
		floor: base(0, 46),
		floorColor: "#b8905a",
		up: base(1, 73),
		low: base(1, 74),
		wallColor: "#9a7a4a",
	},
};

/** 部屋の パレット（rpg の 屋内 INDOOR が 下地。stage は 倉庫の 見た目だけ かえる）。 */
export const roomPalette = (id: RoomId, stage = 7): Record<string, TileDef> => {
	const l =
		LOOK[
			id !== "store" ? id : stage >= 7 ? "bank" : stage >= 6 ? "store" : "shed"
		];
	const on = (...refs: string[]) => solid(l.floorColor, l.floor, ...refs);
	const up = (...refs: string[]) => solid(l.wallColor, l.up, ...refs);
	const low = (...refs: string[]) => solid(l.wallColor, l.low, ...refs);
	const common: Record<string, TileDef> = {
		...INDOOR,
		"#": solid(CEIL),
		H: up(),
		h: low(),
		W: up(WINDOW),
		m: low(PAPER),
		".": floor(l.floorColor, l.floor),
		D: floor("#a01818", l.floor, base(2, 49)),
		F: on(base(7, 129, 1, 2)),
		U: on(base(3, 125)),
		x: on(base(4, 123)),
		u: on(base(0, 123)),
		t: on(base(2, 108)),
		n: floor(l.floorColor, l.floor, base(2, 109)),
	};
	switch (id) {
		case "cafe": {
			const bar = "#5a3a22";
			return {
				...common,
				A: up(base(5, 95)),
				Q: up(PICTURE),
				b: low(),
				k: low(base(2, 116, 1, 2)),
				"[": { ...solid(bar, l.floor, base(5, 98)), counter: true },
				"=": { ...solid(bar, l.floor, base(6, 98)), counter: true },
				"]": { ...solid(bar, l.floor, base(7, 98)), counter: true },
				// 赤い 丸いす（通れる。すわる ときは となりに）
				n: floor(l.floorColor, l.floor, base(3, 109)),
				s: on(base(3, 115)),
				S: on(base(4, 115)),
				t: on(base(2, 108), onTop(7, 154)),
				O: on(base(3, 108)),
				P: on(base(3, 120, 1, 2)),
				p: on(base(4, 120, 1, 2)),
				// 開店の 日の 写真・サイン色紙（壁の 下段）、漫画の 棚、入口の そばの レジ（台の 上）
				r: low(base(0, 527)),
				e: low(base(0, 529)),
				B: on(base(1, 318, 1, 2)),
				R: on(base(2, 108), basePx(48, 394 * 16 + 2)),
			};
		}
		case "hut":
			return {
				...common,
				Z: on(base(0, 112)),
				z: on(base(0, 113)),
				R: on(base(3, 146, 1, 2)),
				L: on(base(4, 540)),
				K: on(base(1, 110, 1, 2)),
				// 作業台（作りかけの 看板と 小刀）
				t: on(base(2, 108), onTop(7, 158)),
				// ペナント・日めくり・かえの ユニフォーム（壁の 下段）
				P: low(base(4, 118, 1, 2)),
				c: low(base(5, 313)),
				y: low(base(1, 349)),
				// 薪割り台・薪の 山・水桶・ボールかご
				A: on(base(3, 124)),
				w: on(base(2, 124)),
				o: on(base(0, 124)),
				g: on(base(4, 125)),
			};
		case "shop":
			return {
				...common,
				A: up(base(3, 96)),
				B: on(base(3, 104, 1, 2)),
				K: on(base(1, 110, 1, 2)),
				S: on(base(2, 110, 1, 2)),
				u: on(base(7, 141)),
				// まかないの 机（赤い 皿。麻婆豆腐）
				T: on(base(2, 108), onTop(7, 152)),
				// 黒板（3マス。壁の 上段 4 5 6・下段 1 2 3 に またがる。テンキーの 並び）
				"4": up(base(0, 320)),
				"5": up(base(1, 320)),
				"6": up(base(2, 320)),
				"1": low(base(0, 321)),
				"2": low(base(1, 321)),
				"3": low(base(2, 321)),
				// 白衣（トルソー）・調味料の 棚・実験の 机（試験管立て）
				w: on(base(2, 349, 1, 2)),
				y: on(base(0, 337, 1, 2)),
				k: on(base(2, 108), basePx(48, 340 * 16 + 4)),
			};
		case "bookstore":
			return {
				...common,
				A: up(base(6, 96)),
				k: low(base(5, 90)),
				B: on(base(3, 104, 1, 2)),
				// 店番の 机（羽ペンと インク）
				T: on(base(2, 108), onTop(3, 156)),
				// 平台（新刊の 山）・雑誌の 棚
				s: on(base(2, 108), onTop(2, 150)),
				M: on(base(2, 104, 1, 2)),
			};
		case "library":
			return {
				...common,
				Q: up(PICTURE),
				k: low(base(2, 116, 1, 2)),
				B: on(base(3, 104, 1, 2)),
				// 司書の 机（まっしろな 貸し出しの 帳面）・読書の 机（読みかけの 本）
				T: on(base(2, 108), onTop(5, 150)),
				t: on(base(2, 108), onTop(1, 150)),
				// 新聞の 棚・目録の 引き出し・返却ポスト
				R: on(base(2, 104, 1, 2)),
				C: on(base(0, 104, 1, 2)),
				X: on(base(4, 123)),
			};
		case "music":
			return {
				...common,
				P: on(base(3, 120, 1, 2)),
				p: on(base(4, 120, 1, 2)),
				L: on(base(4, 540)),
				// 拍手の はり紙・楽屋の 扉（壁の 下段）、スタンド花・楽譜の 棚・物販の 机（CD）
				e: low(base(5, 313)),
				d: low(base(4, 507, 1, 2)),
				f: on(base(7, 133)),
				B: on(base(3, 104, 1, 2)),
				t: on(base(2, 108), onTop(4, 150)),
			};
		case "bath": {
			const tile = base(3, 48);
			const wash = (...refs: string[]) => solid("#e0e8f0", tile, ...refs);
			return {
				...common,
				"~": {
					layers: [tile, BATH_WATER],
					above: [BATH_WATER_LOW],
					color: "#4a8ac8",
					passable: true,
				},
				".": floor("#e0e8f0", tile),
				"|": { ...low(), counter: true },
				I: low(),
				Q: low(base(4, 90)),
				k: wash(base(0, 110)),
				o: wash(base(0, 124)),
				s: floor(l.wallColor, l.low, base(7, 63, 1, 2)),
				",": floor("#c8a86a", base(0, 46)),
				L: solid("#c8a86a", base(0, 46), base(0, 104, 1, 2)),
				c: solid("#c8a86a", base(0, 46), base(4, 125)),
				M: solid("#c8a86a", base(0, 46), base(0, 393, 1, 2)),
				N: floor(l.wallColor, l.low, base(4, 297)),
				n: floor(l.wallColor, l.low, base(3, 297)),
				b: floor(l.floorColor, l.floor),
				B: { ...on(base(6, 98)), counter: true },
				":": floor("#a89878", base(3, 50)),
				// 料金表（入口の 壁）・マッサージ椅子（脱衣所）
				P: low(PAPER),
				C: solid("#c8a86a", base(0, 46), base(4, 116, 1, 2)),
				// 入口の 下駄箱・消火器・長いす（左・右）
				G: solid("#a89878", base(3, 50), base(1, 316, 1, 2)),
				e: solid("#a89878", base(3, 50), base(6, 393)),
				"(": solid("#a89878", base(3, 50), base(0, 121)),
				")": solid("#a89878", base(3, 50), base(2, 121)),
			};
		}
		case "store":
			return {
				...common,
				k: low(base(6, 373), base(2, 372)),
				S: on(base(0, 108, 1, 2)),
				s: on(base(1, 108, 1, 2)),
				Q: on(base(0, 108, 1, 2)),
				q: on(base(1, 108, 1, 2)),
				T: on(base(2, 108), onTop(6, 154)),
				g: on(base(0, 125)),
				// 『生きてこそだ』の 額（壁の 上段 2マス）・伝言板（同じく 2マス）
				"(": up(base(3, 313)),
				")": up(base(4, 313)),
				"[": up(base(5, 509)),
				"]": up(base(7, 509)),
				// 替えの メイド服（トルソー）・掃除機
				d: on(base(4, 349, 1, 2)),
				c: on(base(5, 393, 1, 2)),
				// 奥の 扉（物置は 板戸、石の 倉庫は 鉄の 扉）
				v: low(base(7, stage >= 6 ? 67 : 73, 1, 2)),
				// 銀行（段7）：棚は 貸金庫の 引き出し、袋は 金庫、奥の 扉は 金庫の 扉
				...(stage >= 7 && {
					S: on(base(0, 104, 1, 2)),
					s: on(base(0, 104, 1, 2)),
					Q: on(base(0, 104, 1, 2)),
					q: on(base(0, 104, 1, 2)),
					g: on(base(6, 123)),
					v: low(base(2, 92, 1, 2)),
				}),
			};
	}
};

// ───────────────── 置く 物 ─────────────────

/** 字 → 調べる 物の id（部屋ごと。同じ 物が 何マスでも 1つの 話）。 */
const THING_IDS: Record<RoomId, Record<string, string>> = {
	cafe: {
		b: "bottles",
		m: "menu",
		k: "clock",
		Q: "picture",
		// ピアノは 右半分から（左の 前は ピアノを 弾く 住人）
		p: "piano",
		U: "barrel",
		r: "photo",
		e: "autograph",
		B: "manga",
		R: "register",
	},
	hut: {
		Z: "bed",
		z: "bed",
		R: "tools",
		L: "radio",
		K: "stove",
		t: "bench",
		U: "nails",
		x: "chips",
		m: "plan",
		P: "pennant",
		c: "calendar",
		y: "uniform",
		A: "axe",
		w: "firewood",
		o: "bucket",
		g: "balls",
	},
	shop: {
		B: "books",
		K: "stove",
		S: "sink",
		u: "pot",
		T: "table",
		x: "stock",
		U: "barrel",
		m: "rules",
		"1": "board",
		"2": "board",
		"3": "board",
		w: "coat",
		y: "spices",
		k: "lab",
	},
	bookstore: {
		B: "shelf",
		m: "notice",
		T: "desk",
		k: "poster",
		s: "new",
		M: "magazine",
	},
	library: {
		B: "shelf",
		m: "notice",
		T: "desk",
		t: "table",
		Q: "portrait",
		k: "clock",
		"<": "stairs",
		"{": "stairs",
		Y: "globe",
		R: "news",
		C: "catalog",
		X: "returns",
	},
	music: {
		m: "plaque",
		P: "piano",
		p: "piano",
		L: "speaker",
		e: "clap",
		d: "greenroom",
		f: "flowers",
		B: "scores",
		t: "merch",
	},
	bath: {
		Q: "mural",
		k: "mirror",
		o: "oke",
		"|": "partition",
		L: "locker",
		c: "basket",
		M: "milk",
		F: "plant",
		m: "notice",
		P: "price",
		C: "massage",
		G: "shoes",
		e: "extinguisher",
		"(": "bench",
		")": "bench",
	},
	store: {
		S: "shelf",
		s: "shelf",
		Q: "lost",
		q: "lost",
		k: "keys",
		m: "ledger",
		T: "desk",
		g: "sacks",
		U: "barrel",
		x: "crate",
		u: "pots",
		"(": "motto",
		")": "motto",
		"[": "board",
		"]": "board",
		d: "dress",
		c: "cleaner",
		v: "door",
	},
};

/** 部屋に 置く 物（出口の マットと 調べる 物）。人は ui が 足す。 */
export const roomPlaces = (id: RoomId): RoomPlace[] => {
	const rows = ROWS[id];
	const out: RoomPlace[] = [];
	roomMats(id).forEach(([x, y], i) => {
		out.push({ id: `mat_${i}`, x, y, trigger: "touch" });
	});
	const ids = THING_IDS[id];
	const count: Record<string, number> = {};
	const add = (kind: string, x: number, y: number) => {
		const n = count[kind] ?? 0;
		count[kind] = n + 1;
		out.push({ id: `${kind}_${n}`, x, y, trigger: "talk" });
	};
	rows.forEach((r, y) => {
		[...r].forEach((ch, x) => {
			const kind = ids[ch];
			if (!kind) return;
			// 銭湯の 男湯がわ（キリコは 入らない）の 物は 置かない（番台より 下の 入口は 男女 いっしょ）。
			// 仕切りは 男湯に 人の いない 段だけ
			if (id === "bath") {
				if (x < BATH_WALL && y < BATH_BANDAI[1]) return;
				if (ch === "|" && y < 5) return;
			}
			// 喫茶の 酒棚は 台の うしろ。台ごしに 読むので 棚の 前の 床に 置く
			// （空いている 丸いす 1・3・5 の 向かいだけ。2・6 は やきう・ゼロの 席、4 は マスター）
			if (id === "cafe" && ch === "b") {
				if (x % 2 === 1 && x !== CAFE_MASTER[0]) add(kind, x, y + 1);
				return;
			}
			// 上段の 物（窓・絵）は 真下の 下段に 置く（1つ下の 床から 読む）。下段に ほかの 物が あれば 読まない
			if (y === 1) {
				if (rows[y + 1]?.[x] === "h") add(kind, x, y + 1);
				return;
			}
			add(kind, x, y);
		});
	});
	return out;
};

// ───────────────── 喫茶の 席 ─────────────────

/**
 * 仲間の すわる 席（帰りごとに 抽選で 割りふる）。at に すわり（dir を 向く）、となりの kiriko に キリコか
 * 話し相手が すわる。talk は となりと 話す ときの 向き（カウンターは 顔を 見あわせる、ソファは 前を 向く）。
 * guest は 3人目が 来て 立つ 所（掛け合いの 相手・話しこんでいる ところを そばで 聞く キリコ）、
 * stand は 席を 立った キリコの 所。
 */
export type CafeSeat = {
	at: Cell;
	dir: Dir;
	kiriko: Cell;
	/** 話す ときの 向き（席の 人・となり）。 */
	talk: readonly [Dir, Dir];
	guest: Cell;
	guestDir: Dir;
	stand: Spot;
};

export const CAFE_SLOTS: readonly CafeSeat[] = [
	// カウンターの 丸いす（台の 向こうに マスター）
	{
		at: [2, 5],
		dir: "up",
		kiriko: [3, 5],
		talk: ["right", "left"],
		guest: [1, 5],
		guestDir: "right",
		stand: { x: 3, y: 6, dir: "up" },
	},
	{
		at: [6, 5],
		dir: "up",
		kiriko: [5, 5],
		talk: ["left", "right"],
		guest: [7, 5],
		guestDir: "left",
		stand: { x: 5, y: 6, dir: "up" },
	},
	// ソファ（ならんで すわる）
	{
		at: [10, 3],
		dir: "down",
		kiriko: [11, 3],
		talk: ["down", "down"],
		guest: [12, 3],
		guestDir: "left",
		stand: { x: 12, y: 4, dir: "left" },
	},
	{
		at: [17, 3],
		dir: "down",
		kiriko: [16, 3],
		talk: ["down", "down"],
		guest: [18, 3],
		guestDir: "left",
		stand: { x: 15, y: 3, dir: "right" },
	},
	{
		at: [16, 8],
		dir: "down",
		kiriko: [15, 8],
		talk: ["down", "down"],
		guest: [17, 8],
		guestDir: "left",
		stand: { x: 14, y: 8, dir: "right" },
	},
];

/** みんなの 話（5人 ぜんぶ）は カウンターに 並ぶ（キリコは まんなか。マスターの 前）。 */
export const CAFE_ALL_SEATS: Record<Speaker | "kiriko", Cell> = {
	shiyo: [1, 5],
	roze: [2, 5],
	nanj: [3, 5],
	kiriko: [4, 5],
	zero: [5, 5],
	feris: [6, 5],
};

/** マスター（台の うしろ）と、注文する 所（台の 前の 丸いす）。 */
export const CAFE_MASTER: Cell = [4, 3];
export const CAFE_ORDER: Spot = { x: 4, y: 5, dir: "up" };

/**
 * 住人の 来る 所（帰りごとに 何人か）。話すと キリコは kiriko に（丸テーブルなら 向かいの 丸いす、
 * ピアノの 前・窓ぎわ・通路なら となりに 立つ）。掛け合いの 相手は guest に 来る。話し終えたら stand。
 */
export type PatronSpot = {
	at: Cell;
	dir: Dir;
	kiriko: Cell;
	kdir: Dir;
	guest: Cell;
	guestDir: Dir;
	stand: Spot;
};

export const CAFE_PATRON_SPOTS: readonly PatronSpot[] = [
	{
		at: [6, 8],
		dir: "right",
		kiriko: [8, 8],
		kdir: "left",
		guest: [7, 9],
		guestDir: "up",
		stand: { x: 8, y: 9, dir: "up" },
	},
	{
		at: [13, 8],
		dir: "left",
		kiriko: [11, 8],
		kdir: "right",
		guest: [12, 9],
		guestDir: "up",
		stand: { x: 11, y: 9, dir: "up" },
	},
	// ピアノの 前（弾いている）
	{
		at: [2, 9],
		dir: "up",
		kiriko: [3, 9],
		kdir: "left",
		guest: [3, 10],
		guestDir: "up",
		stand: { x: 3, y: 9, dir: "left" },
	},
	// 窓ぎわ
	{
		at: [18, 6],
		dir: "left",
		kiriko: [17, 6],
		kdir: "right",
		guest: [17, 7],
		guestDir: "up",
		stand: { x: 17, y: 6, dir: "right" },
	},
	// 通路の まんなか
	{
		at: [9, 6],
		dir: "down",
		kiriko: [9, 7],
		kdir: "up",
		guest: [10, 7],
		guestDir: "left",
		stand: { x: 9, y: 7, dir: "up" },
	},
];
