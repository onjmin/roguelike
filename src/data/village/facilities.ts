// 町が 育つと 建つ 施設（STORY.md §5.75 の 町割り）。1つの 施設を ここに 1つ 書けば、村の 地図の 外観・扉・
// 中の 部屋・調べる 物・中の 人・外の 物（釣り場など）が そろう。DOM も 保存も 使わない
// （スクリプトは ui/facilities.ts、試験は src/sim/villageTests.ts）。
//
// - 建つ 段（from）から、建てかえの 段（until）の 前まで 立つ（交番 → 警察署 のように 同じ 所で 建てかわる）。
// - 外観は 2つの 書き方：
//     building  ふつうの 家（屋根の 棟・軒、壁の 上段・下段。扉は 下段。Base.png の 家・壁・屋根）。字は 自動で 割りふる。
//     block     自分で 字を 並べる（グラウンド・桟橋など。字と 絵は tiles に）。
// - clear は 外観の 前に 敷く 地面（森を 開いた 草地・道。地図の 座標で 左上から 右へ）。
// - 中（room）が あれば 扉を 踏むと 入る。部屋の 形は 本館・建物の 中と 同じ（上に 天井と 壁 2段、下に マット 2マス）。
// - 外の 物（outdoor）は 地図の マスに 見えない イベントを 置き、そこの 絵を 調べる。fishing・batting は 遊べる 物。
// どれも 寄り道で、強さには 何も 効かない（冒険に 力を 持ちこまない）。

import type { TileDef } from "../../engine/defs";
import type { Dir } from "../../engine/types";
import type { Cell } from "./map";
import { base, basePx, floor, INDOOR, solid } from "./tiles";

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
	/** 調べると 遊べる 物（物の id → 遊び。駅の 改札＝電車で どの 板へも 出かけられる）。 */
	plays?: Record<string, "depart">;
};

export type OutdoorThing = {
	id: string;
	at: Cell;
	lines: readonly string[];
	/** 遊べる 物（釣り・1打席・バス＝どの 板へも 出かけられる）。 */
	play?: "fishing" | "batting" | "bus";
};

export type Facility = {
	id: string;
	/** 中に 入った ときの 札・扉の 名前。 */
	name: string;
	from: number;
	until?: number;
	/** 外観の 左上（地図の 座標）。 */
	at: Cell;
	look: BuildingLook | BlockLook;
	/** 地面（x, y, 字の 並び, この 段から 敷かない）。 */
	clear?: readonly (readonly [number, number, string, number?])[];
	/** 扉を 踏んで 入る ときの 1窓（村に いる あいだ 1回）。 */
	door?: string;
	room?: FacilityRoom;
	outdoor?: readonly OutdoorThing[];
};

// ───────────────── 部屋の 見た目 ─────────────────

const LOOKS = {
	wood: {
		floor: base(0, 46),
		floorColor: "#b8905a",
		up: base(1, 55),
		low: base(1, 56),
		wallColor: "#6a4a2a",
	},
	beach: {
		floor: base(0, 46),
		floorColor: "#b8905a",
		up: base(1, 73),
		low: base(1, 74),
		wallColor: "#c8a86a",
	},
	tatami: {
		floor: base(0, 484),
		floorColor: "#b8b070",
		up: base(1, 57),
		low: base(1, 58),
		wallColor: "#8a6a3a",
	},
	// 白い 壁と 灰色の タイル（診療所・コンビニ・質屋）
	white: {
		floor: base(3, 48),
		floorColor: "#c8c8c8",
		up: base(1, 77),
		low: base(1, 78),
		wallColor: "#e8e4dc",
	},
	// 白い 石の 壁と 石の 床（交番・消防）
	stone: {
		floor: base(3, 46),
		floorColor: "#9a9a9a",
		up: base(1, 63),
		low: base(1, 64),
		wallColor: "#d8d8d8",
	},
	// ビルの 中：灰色の 壁と 白い タイル（警察署・病院・駅・裁判所）
	office: {
		floor: base(0, 504),
		floorColor: "#c8b090",
		up: base(1, 69),
		low: base(1, 70),
		wallColor: "#a8a8a8",
	},
	// 赤レンガの 壁（消防署・劇場・カジノ）
	brick: {
		floor: base(0, 47),
		floorColor: "#5a4030",
		up: base(1, 61),
		low: base(1, 62),
		wallColor: "#a84a3a",
	},
	// 濃い 板の 床と 板の 壁（道場）
	dojo: {
		floor: base(0, 47),
		floorColor: "#5a4030",
		up: base(1, 55),
		low: base(1, 56),
		wallColor: "#6a4a2a",
	},
} as const satisfies Record<string, RoomLook>;

const PAPER = basePx(32, 1446);
const WINDOW = basePx(48, 1382);
/** 小物（位置微調整用の 行の 絵を 4px 上げて、台の 上に のせる）。 */
const onTop = (c: number, r: number) => basePx(c * 16, r * 16 + 4);

// ───────────────── 施設 ─────────────────

/** 名無し（本館の 中の 人と 同じ 絵。data/village/hall.ts の NANASHI_WALK）。 */
const NANASHI = ["sa:xjuotB", "sa:qPN3cT", "sa:C2hS8U", "sa:VaBXqn"] as const;

const C_PIER = "#a8804c";
const C_FIELD = "#b08a5a";
const C_GRASS = "#97bc25";
const TURF = base(0, 4);

/** 住宅街の 家（入れない。扉の マスに 表札。until の 段で 都市の 建物に 建てかわる）。 */
const house = (
	id: string,
	at: Cell,
	w: number,
	roof: number,
	wall: number,
	plate: readonly string[],
	until?: number,
): Facility => {
	const door = Math.floor(w / 2);
	return {
		id,
		name: "家",
		from: 6,
		until,
		at,
		look: { kind: "building", w, roof, wall, door, closed: true },
		outdoor: [{ id: "plate", at: [at[0] + door, at[1] + 3], lines: plate }],
	};
};

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
		look: {
			kind: "building",
			w: 6,
			roof: 2,
			wall: 73,
			door: 3,
			sign: base(3, 95),
		},
		door: "海の家「age」。\n鉄板の　音と、ソースの　におい。",
		room: {
			look: LOOKS.beach,
			rows: [
				"############",
				"#HHWHHAHHWH#",
				"#hhhmhhhkhh#",
				"#.....O...u#",
				"#[==]......#",
				"#..........#",
				"#.tt...tt..#",
				"#.nn...nn..#",
				"#F........F#",
				"####DD######",
			],
			tiles: (k) => ({
				A: k.up(base(3, 95)),
				k: k.low(base(7, 297)),
				"[": { ...k.on(base(1, 98)), counter: true },
				"=": { ...k.on(base(2, 98), onTop(1, 160)), counter: true },
				"]": { ...k.on(base(3, 98)), counter: true },
				O: k.on(base(3, 108)),
				u: k.on(base(4, 123)),
			}),
			things: {
				m: "menu",
				k: "ukiwa",
				"[": "grill",
				"=": "grill",
				O: "table",
				t: "goza",
				u: "cooler",
				F: "plant",
			},
			lines: {
				menu: [
					"品書き。\n焼きそば・かき氷・ラムネ・イカ焼き。",
					"すみに　小さく「age　て　いこ〜」。\n……フェリスの　字だ。",
				],
				ukiwa: ["浮き輪が　つるしてある。\n「貸し出し　無料。返してや」"],
				grill: [
					"鉄板で　焼きそばが　鳴っている。\n……ソースの　こげる　におい。",
				],
				table: ["白い　丸テーブル。\nラムネの　ビー玉が　ころがっている。"],
				goza: ["ござの　席。\n砂が　すこし　ざらざらする。"],
				cooler: ["クーラーボックス。\nラムネが　氷に　うまっている。"],
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
		look: {
			kind: "building",
			w: 5,
			roof: 4,
			wall: 57,
			door: 2,
			windows: false,
		},
		door: "碁会所「本因坊」。\n石を　打つ　音が、ぱちり。",
		room: {
			look: LOOKS.tatami,
			rows: [
				"##########",
				"#HHWHHWHH#",
				"#hhmhhhkh#",
				"#.n.n...u#",
				"#.g.g....#",
				"#.n.n..g.#",
				"#......n.#",
				"#F......F#",
				"####DD####",
			],
			tiles: (k) => ({
				// 碁盤（低い 机に 白と 黒の 石）
				g: k.on(base(2, 108), basePx(6 * 16, 13 * 16 + 4, 16, 12)),
				k: k.low(base(2, 116, 1, 2)),
				u: k.on(base(5, 125)),
			}),
			things: { g: "board", m: "rules", k: "clock", u: "stones" },
			lines: {
				board: [
					"碁盤。黒と　白の　石が、\nとちゅうまで　ならんでいる。",
					"キリコは　黒を　1つ　置いた。\n……ぱちり。",
				],
				rules: ["はり紙。\n「待った　なし。持ち時間　なし」"],
				clock: ["柱時計。\n……ここだけ、時間が　ゆっくりだ。"],
				stones: ["碁笥（ごけ）の　かご。\n白い　石が　1つ　たりない。"],
			},
			people: [
				{
					id: "go_a",
					walk: NANASHI[3],
					at: [2, 3],
					dir: "down",
					name: "名無し",
					lines: [
						"……そこ、打つんか。\nほな、こっちは　ここや",
						"囲碁は　1000手も　かからん。\n……スレより　はよ　終わる",
					],
				},
				{
					id: "go_b",
					walk: NANASHI[1],
					at: [4, 5],
					dir: "up",
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
		look: {
			kind: "building",
			w: 5,
			roof: 4,
			wall: 63,
			door: 2,
			sign: base(7, 95),
		},
		door: "交番。\n赤い　灯りが　ともっている。",
		room: {
			look: LOOKS.stone,
			rows: [
				"##########",
				"#HHWHHWHH#",
				"#hmhhkhhh#",
				"#.......x#",
				"#.[=]....#",
				"#........#",
				"#.....tn.#",
				"#F......F#",
				"####DD####",
			],
			tiles: (k) => ({
				k: k.low(base(4, 90)),
			}),
			things: {
				m: "wanted",
				k: "map",
				x: "lost",
				"[": "log",
				"=": "log",
				"]": "log",
				t: "desk",
			},
			lines: {
				wanted: ["手配書。\n「荒らしを　見かけたら　通報を」"],
				map: ["村の　地図。\n浜から　崖まで、赤い　ピンが　ささっている。"],
				lost: ["落とし物の　箱。\n片方だけの　手袋と、トリップの　メモ。"],
				log: ["日誌。\n「本日も　異常なし。保守　1件」"],
				desk: ["パイプいすと　机。\n湯のみが　冷めている。"],
			},
			people: [
				{
					id: "koban_cop",
					walk: NANASHI[2],
					at: [3, 3],
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
		look: { kind: "building", w: 5, roof: 3, wall: 55, door: 2 },
		door: "消防団の　詰所。\n法被が　かけてある。",
		room: {
			look: LOOKS.wood,
			rows: [
				"##########",
				"#HHWHHHWH#",
				"#hhkhhmhh#",
				"#UU....xx#",
				"#........#",
				"#..tt....#",
				"#..nn....#",
				"#F......F#",
				"####DD####",
			],
			tiles: (k) => ({
				k: k.low(base(4, 88)),
			}),
			things: { k: "bell", m: "duty", U: "water", x: "hose", t: "desk" },
			lines: {
				bell: ["半鐘。\n……鳴らすのは、火事の　ときだけ。"],
				duty: ["当番表。\n「火の用心　見回り：名無し」"],
				water: ["防火用水の　樽。\nなみなみと　水が　入っている。"],
				hose: ["ホースの　巻き。\n……ちょっと　かびくさい。"],
				desk: ["詰所の　机。\n湯のみが　2つ。将棋盤が　1つ。"],
			},
			people: [
				{
					id: "fire_man",
					walk: NANASHI[0],
					at: [6, 4],
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
		look: {
			kind: "building",
			w: 5,
			roof: 5,
			wall: 59,
			door: 2,
			sign: base(2, 96),
		},
		door: "おんJマート。\n入店の　チャイムが　鳴った。",
		room: {
			look: LOOKS.white,
			rows: [
				"############",
				"#HHWHHHHHWH#",
				"#hhhhhmhhhh#",
				"#RRR....SSS#",
				"#..........#",
				"#.SS..SS...#",
				"#..........#",
				"#[=]......F#",
				"#.........x#",
				"####DD######",
			],
			tiles: (k) => ({
				R: k.on(base(0, 393, 1, 2)),
				S: k.on(base(3, 104, 1, 2)),
			}),
			things: {
				R: "fridge",
				S: "shelf",
				m: "notice",
				x: "copier",
				"[": "register",
				"=": "register",
			},
			lines: {
				fridge: ["冷蔵ケース。\nラムネと　麦茶と　エナドリ。"],
				shelf: ["棚。\nカップ麺と、のり弁と、電池。"],
				notice: ["はり紙。\n「24時間　営業。保守も　24時間」"],
				copier: ["コピー機。\n……スレの　まとめを　刷った　あと。"],
				register: ["レジ。\n「ポイントカードは　お持ちですか」"],
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
	},
	// ── 診療所（街。大通りの 北の まんなか。都市で 総合病院に 建てかえ）
	{
		id: "clinic",
		name: "保守村　診療所",
		from: 5,
		until: 7,
		at: [55, 15],
		look: {
			kind: "building",
			w: 5,
			roof: 2,
			wall: 77,
			door: 2,
			sign: base(1, 96),
		},
		door: "診療所。\n消毒の　におい。",
		room: {
			look: LOOKS.white,
			rows: [
				"##########",
				"#HHWHHWHH#",
				"#hmhkhhhh#",
				"#Z.....u.#",
				"#z...[=].#",
				"#........#",
				"#nn......#",
				"#F......F#",
				"####DD####",
			],
			tiles: (k) => ({
				k: k.low(base(2, 116, 1, 2)),
				u: k.on(base(0, 123)),
			}),
			things: {
				Z: "bed",
				z: "bed",
				m: "chart",
				k: "clock",
				u: "medicine",
				n: "bench",
			},
			lines: {
				bed: ["診察台。\n白い　シーツが　ぴんと　張ってある。"],
				chart: ["視力検査の　表。\n……いちばん　下は「保守」。"],
				clock: ["時計。\n……待ち時間は　0分。"],
				medicine: ["薬の　つぼ。\n「水分補給の草　煎じ薬」"],
				bench: ["待合の　いす。\n古い　週刊誌が　1冊。"],
			},
			people: [
				{
					id: "clinic_doc",
					walk: NANASHI[3],
					at: [6, 3],
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
		look: {
			kind: "building",
			w: 5,
			roof: 7,
			wall: 57,
			door: 2,
			windows: false,
		},
		door: "保守道場。\n「押忍！」と　声が　ひびく。",
		room: {
			look: LOOKS.dojo,
			rows: [
				"############",
				"#HHHHAHHHHH#",
				"#hhkhhhhmhh#",
				"#..........#",
				"#..........#",
				"#..........#",
				"#..........#",
				"#U........U#",
				"####DD######",
			],
			tiles: (k) => ({
				A: k.up(base(4, 90)),
				k: k.low(base(3, 92)),
			}),
			things: { k: "shinai", m: "motto", U: "water" },
			lines: {
				shinai: ["竹刀掛け。\n……1本　だけ、ささくれている。"],
				motto: ["道場訓。\n「レスバは　礼に　始まり　礼に　終わる」"],
				water: ["水の　樽。\n稽古の　あとの　一杯。"],
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
		look: {
			kind: "building",
			w: 4,
			roof: 0,
			wall: 67,
			door: 2,
			sign: base(4, 96),
		},
		door: "質屋「流れ」。\n鈴が　ちりん、と　鳴った。",
		room: {
			look: LOOKS.wood,
			rows: [
				"##########",
				"#HHWHHHHH#",
				"#hhhmhhhh#",
				"#.g....gK#",
				"#...[=]..#",
				"#........#",
				"#u......u#",
				"#F......F#",
				"####DD####",
			],
			tiles: (k) => ({
				g: k.on(base(3, 108), onTop(4, 190)),
				K: k.on(base(6, 123)),
				u: k.on(base(0, 123)),
			}),
			things: {
				g: "case",
				m: "notice",
				K: "safe",
				u: "pot",
				"[": "counter",
				"=": "counter",
			},
			lines: {
				case: ["ガラスの　ケース。\n古い　レコードの　針が　ならんでいる。"],
				notice: ["はり紙。\n「流れ　3か月。利息は　良心的」"],
				safe: ["金庫。\n……ダイヤルに、指の　あとが　ない。"],
				pot: ["つぼ。\n「売約済み」の　札。"],
				counter: ["帳場の　台。\nそろばんが　1つ。"],
			},
			people: [
				{
					id: "pawn_owner",
					walk: NANASHI[3],
					at: [5, 3],
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
	house(
		"house_a",
		[53, 4],
		5,
		1,
		59,
		["表札「名無し」。\n……留守のようだ。"],
		7,
	),
	house(
		"house_b",
		[58, 4],
		5,
		3,
		73,
		["表札「ななしのごんべえ」。\n窓から　テレビの　音。"],
		7,
	),
	house(
		"house_c",
		[53, 37],
		5,
		2,
		77,
		["表札「やきう民」。\n中から　ナイター中継の　音。"],
		7,
	),
	house(
		"house_d",
		[58, 37],
		5,
		0,
		55,
		["表札「ROM」。\n……カーテンが　すこし　ゆれた。"],
		7,
	),
	house(
		"house_e",
		[70, 37],
		6,
		4,
		63,
		["表札「VIP」。\n……ポストに　チラシが　たまっている。"],
		7,
	),
	// ── リサイクルショップ「おさがり」（住宅街。北の 通りの 西）
	{
		id: "recycle",
		name: "リサイクルショップ「おさがり」",
		from: 6,
		at: [40, 4],
		look: {
			kind: "building",
			w: 6,
			roof: 1,
			wall: 73,
			door: 2,
			sign: base(5, 96),
		},
		door: "リサイクルショップ「おさがり」。\nほこりと、古い　紙の　におい。",
		room: {
			look: LOOKS.wood,
			rows: [
				"############",
				"#HHWHHHHHWH#",
				"#hhhmhhhhhh#",
				"#SSS..VV.uu#",
				"#..........#",
				"#.xx..UU...#",
				"#..........#",
				"#[=]......F#",
				"#..........#",
				"####DD######",
			],
			tiles: (k) => ({
				S: k.on(base(3, 104, 1, 2)),
				u: k.on(base(0, 123)),
			}),
			things: {
				S: "shelf",
				V: "tv",
				u: "pot",
				x: "box",
				U: "records",
				m: "notice",
				"[": "register",
				"=": "register",
			},
			lines: {
				shelf: ["棚。\n古い　ゲーム機と、だれかの　卒業アルバム。"],
				tv: ["ブラウン管の　テレビ。\n「動作未確認　100円」"],
				pot: ["つぼ。\n……中に　ビー玉が　ぎっしり。"],
				box: ["木箱。\n「おさがり　ご自由に」"],
				records: [
					"樽に　レコードが　つめこんである。\n……どれも　針の　あとが　深い。",
				],
				notice: ["はり紙。\n「買取　強化中：思い出の　品」"],
				register: ["レジ。\n値札の　シールが　山積み。"],
			},
			people: [
				{
					id: "recycle_clerk",
					walk: NANASHI[1],
					at: [2, 6],
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
		look: { kind: "building", w: 6, roof: 5, wall: 69, door: 2 },
		door: "ガレージ。\nオイルの　におい。",
		room: {
			look: LOOKS.stone,
			rows: [
				"############",
				"#HHHHHHHHWH#",
				"#hhkhhhhmhh#",
				"#UU......xx#",
				"#..........#",
				"#..cc......#",
				"#..cc......#",
				"#F.........#",
				"####DD######",
			],
			tiles: (k) => ({
				k: k.low(base(6, 358)),
				c: k.on(base(5, 48)),
			}),
			things: { k: "tools", m: "notice", U: "drum", x: "tires", c: "car" },
			lines: {
				tools: ["工具の　板。\nスパナが　大きい　順に　ならんでいる。"],
				notice: ["はり紙。\n「洗車　1回　500円」"],
				drum: ["ドラム缶。\n……オイルが　にじんでいる。"],
				tires: ["タイヤの　山。\nすりへった　溝に、浜の　砂。"],
				car: ["シートを　かぶった　車。\n……ナンバーは「1000」。"],
			},
			people: [
				{
					id: "garage_mech",
					walk: NANASHI[0],
					at: [6, 4],
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
		look: {
			kind: "building",
			w: 6,
			roof: 5,
			wall: 69,
			door: 2,
			sign: base(5, 95),
		},
		door: "ゲームセンター「連コ」。\n電子音と、レバーを　たたく　音。",
		room: {
			look: LOOKS.stone,
			rows: [
				"############",
				"#HHHHAHHHHH#",
				"#hhhhhhhhmh#",
				"#G.G..G.G..#",
				"#..........#",
				"#.G.G...G..#",
				"#..........#",
				"#.........F#",
				"####DD######",
			],
			tiles: (k) => ({
				A: k.up(base(5, 95)),
				G: k.on(base(1, 485)),
			}),
			things: { G: "cabinet", m: "notice" },
			lines: {
				cabinet: ["古い　アーケード台。\n画面に「INSERT COIN」。"],
				notice: ["はり紙。\n「1プレイ　100円。連コイン　禁止」"],
			},
			people: [
				{
					id: "arcade_a",
					walk: NANASHI[3],
					at: [1, 4],
					dir: "up",
					name: "名無し",
					lines: ["格ゲーの　対戦台や。\n……乱入、待っとるで"],
				},
				{
					id: "arcade_b",
					walk: NANASHI[2],
					at: [8, 6],
					dir: "up",
					name: "名無し",
					lines: ["メダル、ぜんぶ　すった。\n……来月まで　ROM　やわ"],
				},
			],
		},
	},
	// ── ageジム（住宅街。浜への 道の 西）
	{
		id: "gym",
		name: "ageジム",
		from: 6,
		at: [40, 37],
		look: { kind: "building", w: 6, roof: 4, wall: 69, door: 2 },
		door: "ageジム。\n「ふんっ……！」と　声が　する。",
		room: {
			look: LOOKS.stone,
			rows: [
				"############",
				"#HHWHHHHWHH#",
				"#hkkhhhhmhh#",
				"#..........#",
				"#.bb...bb..#",
				"#..........#",
				"#.bb...uu..#",
				"#F........F#",
				"####DD######",
			],
			tiles: (k) => ({
				k: k.low(base(0, 110)),
				b: k.on(base(2, 108)),
				u: k.on(base(0, 123)),
			}),
			things: { k: "mirror", b: "bench", u: "weight", m: "notice" },
			lines: {
				mirror: ["大きな　鏡。\nキリコが　映っている。……細い。"],
				bench: ["ベンチプレスの　台。\nバーが　汗で　光っている。"],
				weight: ["ダンベルの　山。\n「1000kg」と　書いた　うそ札。"],
				notice: ["はり紙。\n「1日　1000回　スクワット」"],
			},
			people: [
				{
					id: "gym_trainer",
					walk: NANASHI[0],
					at: [5, 3],
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
		look: {
			kind: "building",
			w: 5,
			roof: 7,
			wall: 61,
			door: 2,
			sign: base(4, 95),
		},
		door: "バー「次スレ」。\n低い　ジャズと、波の　音。",
		room: {
			look: LOOKS.dojo,
			rows: [
				"############",
				"#HHWHHAHHWH#",
				"#bbbbbbhmhh#",
				"#......U...#",
				"#[=====]...#",
				"#nnnnnnn...#",
				"#........O.#",
				"#F.........#",
				"####DD######",
			],
			tiles: (k) => ({
				A: k.up(base(4, 95)),
				b: k.low(base(5, 204)),
				"[": { ...k.on(base(5, 98)), counter: true },
				"=": { ...k.on(base(6, 98)), counter: true },
				"]": { ...k.on(base(7, 98)), counter: true },
				n: k.floor(base(3, 109)),
				O: k.on(base(3, 108)),
			}),
			// 酒棚は 台の うしろ（台ごしに 読む）
			things: {
				"[": "bottles",
				"=": "bottles",
				m: "menu",
				U: "barrel",
				O: "table",
			},
			lines: {
				bottles: ["酒棚。\nラベルに「次スレ」と　書かれた　瓶。"],
				menu: ["品書き。\n「完走」「次スレ」「保守（ノンアル）」"],
				barrel: ["樽。\n……海の　においが　しみている。"],
				table: ["丸テーブル。\n窓から　夜の　海が　見える。"],
			},
			people: [
				{
					id: "bar_master",
					walk: NANASHI[3],
					at: [4, 3],
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
		look: {
			kind: "building",
			w: 7,
			roof: 3,
			wall: 77,
			door: 3,
			sign: base(3, 95),
			closed: true,
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
	// ── バス停（住宅街。広場の 東の はし。ここからも どの 板へも 出かけられる：出口を 遠く しない）
	{
		id: "bus",
		name: "バス停",
		from: 6,
		at: [31, 20],
		look: {
			kind: "block",
			rows: ["ば"],
			tiles: { ば: solid("#97bc25", base(0, 4), base(5, 37, 1, 2)) },
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
	// ── 都市（段7）：交番 → 警察署・診療所 → 総合病院・消防団 → 消防署、家 → 裁判所・映画館・劇場・カジノ
	{
		id: "police",
		name: "保守警察署",
		from: 7,
		at: [40, 14],
		look: {
			kind: "building",
			w: 6,
			roof: 5,
			wall: 71,
			tall: 2,
			sign: base(7, 95),
		},
		door: "保守警察署。\n電話の　音が　鳴りやまない。",
		room: {
			look: LOOKS.office,
			rows: [
				"############",
				"#HHWHHWHHWH#",
				"#mhhhkhhhhh#",
				"#.tn..tn...#",
				"#..........#",
				"#.[====]...#",
				"#..........#",
				"#F........F#",
				"####DD######",
			],
			tiles: (k) => ({ k: k.low(base(4, 90)) }),
			things: {
				m: "wanted",
				k: "board",
				t: "desk",
				"[": "counter",
				"=": "counter",
			},
			lines: {
				wanted: ["指名手配。\n「コピペ荒らし　身長　不明」"],
				board: ["事件の　板。\n……どの　事件も「解決：保守」。"],
				desk: ["机。\n被害届「スレを　埋め立てられました」"],
				counter: ["受付。\n「落とし物・荒らしの　相談」"],
			},
			people: [
				{
					id: "police_a",
					walk: NANASHI[2],
					at: [4, 4],
					dir: "down",
					name: "警察官",
					lines: ["生活安全課や。\n……荒らしの　通報、1000件　たまっとる"],
				},
				{
					id: "police_b",
					walk: NANASHI[0],
					at: [9, 3],
					dir: "left",
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
		look: {
			kind: "building",
			w: 10,
			roof: 2,
			wall: 63,
			tall: 2,
			sign: base(1, 96),
		},
		door: "総合病院。\n白い　廊下が、まっすぐ　のびている。",
		room: {
			look: LOOKS.white,
			rows: [
				"##############",
				"#HHWHHWHHWHHH#",
				"#hmhhhhkhhhhh#",
				"#Z.Z.Z.......#",
				"#z.z.z..[==].#",
				"#............#",
				"#.nnn...nnn..#",
				"#F..........F#",
				"######DD######",
			],
			tiles: (k) => ({ k: k.low(base(2, 116, 1, 2)) }),
			things: {
				Z: "bed",
				z: "bed",
				m: "sign",
				k: "clock",
				n: "bench",
				"[": "counter",
				"=": "counter",
				"]": "counter",
			},
			lines: {
				bed: ["ベッド。\nシーツの　すみに「sage」と　刺しゅう。"],
				sign: ["はり紙。\n「院内では　sage　進行で」"],
				clock: ["時計。\n……面会時間は　いつでも。"],
				bench: ["待合の　いす。\n名前を　呼ばれるのを　待つ　人。"],
				counter: ["受付。\n「保険証は　ROM　ですか」"],
			},
			people: [
				{
					id: "hospital_nurse",
					walk: NANASHI[1],
					at: [9, 3],
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
		look: { kind: "building", w: 7, roof: 3, wall: 61, tall: 2 },
		door: "保守消防署。\n赤い　車が、出動を　待っている。",
		room: {
			look: LOOKS.brick,
			rows: [
				"############",
				"#HHWHHHHWHH#",
				"#hhhhkhhmhh#",
				"#vvv......P#",
				"#ccc.......#",
				"#.....UU...#",
				"#..........#",
				"#F........F#",
				"####DD######",
			],
			tiles: (k) => ({
				k: k.low(base(4, 88)),
				c: k.on(base(5, 164)),
				v: k.on(base(5, 164)),
				P: k.on(base(2, 179, 1, 2)),
			}),
			things: { k: "bell", m: "duty", c: "truck", P: "pole", U: "water" },
			lines: {
				bell: ["警報の　ベル。\n……鳴るのは、炎上の　ときだけ。"],
				duty: ["当番表。\n「消防団から　ひきつぎ：名無し」"],
				truck: ["消防車。\nピカピカに　みがいてある。"],
				pole: ["すべり棒。\n上の　階から　1秒で　降りられる。"],
				water: ["防火用水の　樽。\n消防団の　ころからの　もの。"],
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
		look: { kind: "building", w: 10, roof: 4, wall: 67, tall: 2 },
		door: "保守地方裁判所。\nしんと　静まりかえっている。",
		room: {
			look: LOOKS.office,
			rows: [
				"##############",
				"#HHHHHAHHHHHH#",
				"#hhhhhhhhmhhh#",
				"#............#",
				"#....[==]....#",
				"#..t.....t...#",
				"#............#",
				"#.nnnn..nnnn.#",
				"#F..........F#",
				"######DD######",
			],
			tiles: (k) => ({ A: k.up(base(5, 88)) }),
			things: {
				m: "rule",
				t: "stand",
				n: "gallery",
				"[": "bench",
				"=": "bench",
			},
			lines: {
				rule: ["はり紙。\n「法廷では　お静かに。レスバ　禁止」"],
				stand: ["証言台。\n「スクショは　あります」と　書いた　メモ。"],
				gallery: ["傍聴席。\n……ほとんど　ROM専の　席。"],
				bench: ["裁判官の　席。\nガイドラインの　本が　ひらいてある。"],
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
					at: [6, 7],
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
		look: { kind: "building", w: 7, roof: 5, wall: 69 },
		door: "自動車整備工場。\nエンジンの　音と、オイルの　におい。",
		room: {
			look: LOOKS.stone,
			rows: [
				"############",
				"#HHHHHHHHWH#",
				"#hhhhkhhmhh#",
				"#.cc..cc.xx#",
				"#.cc..cc...#",
				"#..........#",
				"#UU........#",
				"#F........F#",
				"####DD######",
			],
			tiles: (k) => ({
				k: k.low(base(6, 358)),
				c: k.on(base(5, 48)),
			}),
			things: { k: "tools", m: "notice", c: "car", x: "tires", U: "drum" },
			lines: {
				tools: ["工具の　板。\nガレージの　ころより　3倍に　ふえた。"],
				notice: ["はり紙。\n「車検　受付中」"],
				car: ["リフトに　車が　上がっている。\n底に、浜の　砂が　びっしり。"],
				tires: ["タイヤの　山。\n「スタッドレス　あります」"],
				drum: ["ドラム缶。\n……オイルが　にじんでいる。"],
			},
			people: [
				{
					id: "repair_mech",
					walk: NANASHI[0],
					at: [5, 5],
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
		look: { kind: "building", w: 5, roof: 3, wall: 75, tall: 2 },
		door: "映画館「スクリーン1000」。\nポップコーンの　におい。",
		room: {
			look: LOOKS.dojo,
			rows: [
				"############",
				"#HHHHHHHHHH#",
				"#hmXXXXXXhh#",
				"#..........#",
				"#.nnnn.nnn.#",
				"#.nnnn.nnn.#",
				"#..........#",
				"#F........F#",
				"####DD######",
			],
			tiles: (k) => ({
				X: k.low(base(0, 546)),
				n: k.floor(base(3, 109)),
			}),
			things: { X: "screen", m: "poster", n: "seat" },
			lines: {
				screen: ["スクリーン。\n予告編「1000レスの　夏」。"],
				poster: ["上映中「スレ立て　ヒーロー」\n「さらば　過去ログ」"],
				seat: ["客席。\nひじかけに　ドリンクの　あと。"],
			},
			people: [
				{
					id: "cinema_staff",
					walk: NANASHI[2],
					at: [6, 6],
					dir: "up",
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
		look: { kind: "building", w: 5, roof: 3, wall: 63, tall: 2 },
		door: "保守劇場。\n開演の　ブザーが　鳴っている。",
		room: {
			look: LOOKS.brick,
			rows: [
				"############",
				"#HHHHHHHHHH#",
				"#hhChhhhChh#",
				"#..788889..#",
				"#..122223..#",
				"#..........#",
				"#.nnnnnnnn.#",
				"#F........F#",
				"####DD######",
			],
			tiles: (k) => ({ n: k.floor(base(3, 109)) }),
			things: {
				C: "curtain",
				"7": "stage",
				"8": "stage",
				"9": "stage",
				n: "seat",
			},
			lines: {
				curtain: ["赤い　幕。\n……すこし　ほつれている。"],
				stage: ["舞台。\n今夜の　演目「やきう　物語」。"],
				seat: ["客席。\n「満員御礼」の　札が　さがっている。"],
			},
			people: [
				{
					id: "theater_actor",
					walk: NANASHI[1],
					at: [5, 4],
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
		look: {
			kind: "building",
			w: 7,
			roof: 7,
			wall: 61,
			tall: 2,
			sign: base(4, 96),
		},
		door: "カジノ「ガチャ」。\nコインの　音が　鳴りひびく。",
		room: {
			look: LOOKS.brick,
			rows: [
				"##############",
				"#HHWHHHHHHWHH#",
				"#hhhhhhmhhhhh#",
				"#SSSS....SSSS#",
				"#............#",
				"#..RR...TT...#",
				"#..RR...TT...#",
				"#............#",
				"#F..........F#",
				"######DD######",
			],
			tiles: (k) => ({
				S: k.on(base(0, 519, 1, 2)),
				R: k.on(base(2, 516)),
				T: k.on(base(3, 514)),
			}),
			things: { S: "slot", R: "roulette", T: "cards", m: "rule" },
			lines: {
				slot: ["スロット台。\n……777は、出そうで　出ない。"],
				roulette: ["ルーレット。\n赤か　黒か。……緑も　ある。"],
				cards: ["カードの　台。\nディーラーが　じっと　見ている。"],
				rule: ["はり紙。\n「チップの　販売は　ありません」"],
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
		look: { kind: "building", w: 6, roof: 5, wall: 69, tall: 2 },
		door: "保守村駅。\n発車ベルが、遠くで　鳴っている。",
		room: {
			look: LOOKS.office,
			rows: [
				"############",
				"#HHWHHHHWHH#",
				"#hmhhhhhkhh#",
				"#..nnnn....#",
				"#..........#",
				"#.||||.KK..#",
				"#..........#",
				"#F........F#",
				"####DD######",
			],
			tiles: (k) => ({
				k: k.low(base(4, 90)),
				"|": k.on(base(4, 30)),
				K: k.on(base(2, 540)),
			}),
			things: {
				"|": "gate",
				K: "machine",
				m: "timetable",
				k: "map",
				n: "bench",
			},
			lines: {
				gate: ["改札。\n電車で、どの　板へも　出かけられる。"],
				machine: ["券売機。\n「保守村　→　全体マップの　どこでも」"],
				timetable: ["時刻表。\n……どの　板へも、すぐ　出る。"],
				map: ["路線図。\n島から　島へ、線が　のびている。"],
				bench: ["ホームの　ベンチ。\n……潮の　におい。"],
			},
			plays: { gate: "depart" },
			people: [
				{
					id: "station_staff",
					walk: NANASHI[2],
					at: [7, 4],
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
		look: { kind: "building", w: 5, roof: 5, wall: 69 },
		door: "港湾事務所。\n無線の　声が　流れている。",
		room: {
			look: LOOKS.office,
			rows: [
				"##########",
				"#HHWHHWHH#",
				"#mhhhkhhh#",
				"#.t...t..#",
				"#.n...n..#",
				"#........#",
				"#F......F#",
				"####DD####",
			],
			tiles: (k) => ({ k: k.low(base(4, 540)) }),
			things: { m: "chart", k: "radio", t: "desk" },
			lines: {
				chart: ["入港予定の　表。\n「乗っ取り屋の　船：入港　禁止」"],
				radio: ["無線機。\n「こちら　保守港。どうぞ」"],
				desk: ["机。\n積み荷の　帳面が　山積み。"],
			},
			people: [
				{
					id: "harbor_staff",
					walk: NANASHI[0],
					at: [4, 4],
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
		look: { kind: "building", w: 8, roof: 5, wall: 69, closed: true },
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
		look: { kind: "building", w: 6, roof: 7, wall: 71, tall: 2, closed: true },
		outdoor: [
			{
				id: "door",
				at: [83, 40],
				lines: ["発電所。\n村の　灯りは　ここから。……保守の　電気。"],
			},
		],
	},
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

/** 外観の 行（施設の 左上から）。 */
export const facilityBlock = (f: Facility): readonly string[] => {
	if (f.look.kind === "block") return f.look.rows;
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

/** 外観の 絵（ふつうの 家の 字と、block の 字）。村の パレットに まぜる。 */
export const facilityTiles = (): Record<string, TileDef> => {
	const out: Record<string, TileDef> = {};
	FACILITIES.forEach((f, i) => {
		if (f.look.kind === "block") {
			Object.assign(out, f.look.tiles);
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
 * 建物の 影（マス単位。光は 左上から：建物の 右がわの 地面に、軒から 足もとまで）。ふつうの 家の 外観だけ
 * （block の 外観＝グラウンド・港などは 影なし）。ui/facilities.ts の shadowDecor が 描く。
 */
export const facilityShadows = (
	stage: number,
): { x: number; top: number; bottom: number }[] =>
	facilitiesAt(stage)
		.filter((f) => f.look.kind === "building")
		.map((f) => {
			const rows = facilityBlock(f).length;
			const w = f.look.kind === "building" ? f.look.w : 0;
			return { x: f.at[0] + w, top: f.at[1] + 1, bottom: f.at[1] + rows };
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

/** 扉の イベントの id。 */
export const doorId = (f: Facility): string => `door_f_${f.id}`;

/** 地図の id（村の 地図と 部屋を 切りかえる 名前）。 */
export const facilityMapId = (f: Facility): string => `f_${f.id}`;

/** 地図の id から 施設（施設の 部屋で なければ undefined）。 */
export const facilityOfMap = (map: string): Facility | undefined =>
	map.startsWith("f_") ? facilityById(map.slice(2)) : undefined;
