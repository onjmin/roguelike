// 飲食店（町が 育つと 1軒ずつ ふえる 寄り道。食べても 何も 持ちこまない）。施設の 書き方は facilities.ts と
// 同じで、facilities.ts の FACILITIES の うしろに 足す（外観の 字も そこで 割りふる）。
// 店番に 話すか 券売機を 調べると 品書き（data/town/eateries.ts の EAT_MENUS・ui/minigames/eat.ts）。
// 麺屋「乙」と ファミレス「ドリンクバー」は facilities.ts（ファミレスは ドリンクバーだけ）。
//
//   段2 たこ焼き屋台「たこ八」（浜。桟橋の 東。中は なく、台ごしに 店番）
//   段3 立ち食いそば「2げと」（北の 峠の 道の 西）
//   段4 麺屋「乙」（facilities.ts。東の 商店街の 南の 並び）
//   段6 居酒屋「草」（浜の 西。海の家と 桟橋の あいだ）
//   段7 メイド喫茶「メイドの土産」（東の 商店街。data/village/diners.ts）
//
// 絵は RPGEN の 部品（rpgenArt.ts の art・ri・riCell。scripts/pack-rpgen.mjs）と 同梱の Base.png。
// ここからは facilities.ts の 値を 読まない（facilities.ts が ここを 読むので、まわりこむと 読みこみの 順で こわれる）。

import { DINERS } from "./diners";
import type { Facility, FacilityRoom, RoomLook } from "./facilities";
import { art, ri, riCell } from "./rpgenArt";
import { base, basePx, onUpper } from "./tiles";

/** 赤い 提灯（Base.png。半マス ずれて いるので 画素で 切る。facilities.ts の LANTERN と 同じ）。 */
const LANTERN = basePx(35, 4754, 10, 13);
/** 台（台ごしに 向こうの 人と 話せる。人の となりの 台には 調べる 物を 置かない）。 */
const ctr = <T extends object>(t: T) => ({ ...t, counter: true });
/** 名無し（本館の 中の 人と 同じ 絵）。 */
const NANASHI = ["sa:xjuotB", "sa:qPN3cT", "sa:C2hS8U", "sa:VaBXqn"] as const;
const look = (
	floor: string,
	floorColor: string,
	up: string,
	low: string,
	wallColor: string,
): RoomLook => ({ floor, floorColor, up, low, wallColor });

// ───────────────── 中 ─────────────────

// 立ち食いそば：白い 格子の タイルと 和室の 壁。奥に 寸胴の コンロ・天かすの 箱・流し・冷蔵庫、
// 立って 食べる 台（台の うしろに 店主）、入口の そばに 券売機と ごみ箱
const SOBA_ROOM: FacilityRoom = {
	look: look(ri("flBeige"), "#c8b890", base(1, 57), base(1, 58), "#8a6a3a"),
	rows: [
		"##########",
		"#HaHaHHWH#",
		"#hhhhhhhm#",
		"#SsPKjR..#",
		"#........#",
		"#.[===]..#",
		"#........#",
		"#q.....V.#",
		"#.F......#",
		"####DD####",
	],
	tiles: (k) => ({
		a: k.up(ri("memo")),
		S: onUpper(k.on(ri("stove")), ri("potFire")),
		s: k.on(ri("stove", 1)),
		P: onUpper(k.on(ri("cabWood", 2)), ri("korokke")),
		K: k.on(ri("sink")),
		j: k.on(ri("sink", 1)),
		R: k.on(ri("fridgeWhite")),
		"[": ctr(k.on(base(1, 98), ri("tanuki"))),
		"=": ctr(k.on(base(2, 98))),
		"]": ctr(k.on(base(3, 98), ri("kitsune"))),
		V: k.on(ri("kiosk")),
		q: k.on(ri("trash")),
	}),
	things: {
		W: "window",
		m: "notice",
		S: "pot",
		s: "pot",
		P: "tenkasu",
		K: "sink",
		R: "fridge",
		V: "ticket",
		"[": "shichimi",
		q: "trash",
		F: "plant",
	},
	lines: {
		fridge: ["冷蔵庫。\n生卵が　ぎっしり。月見　用らしい。"],
		notice: ["はり紙。\n「2ゲット　ズザー　禁止（店内は　歩いて）」"],
		plant: ["鉢植え。\n峠の　風で　すこし　かたむいている。"],
		pot: ["寸胴で　だしが　ぐらぐら　煮えている。\n……かつおの　香り。"],
		shichimi: ["七味の　瓶。\n……ふたが　ゆるい。気をつけよう。"],
		sink: ["流し。\nどんぶりが　ぴかぴかに　洗ってある。"],
		tenkasu: ["天かすの　箱。\n「入れ放題。入れすぎたら　たぬき」"],
		ticket: ["券売機。\nかけ・きつね・たぬき・月見・コロッケ。"],
		trash: ["ごみ箱。\n割りばしの　袋で　いっぱいだ。"],
		window: [
			"窓から　北の　峠が　見える。\n……みんな　ここから　出かけていく。",
		],
	},
	plays: { ticket: "eat" },
	people: [
		{
			id: "soba_master",
			walk: "sa:HM9Vej",
			at: [5, 4],
			dir: "down",
			name: "店主",
			play: "eat",
			lines: [
				"へい、らっしゃい。\n出かける　前なら　早いで。3分や",
				"店の　名前？　スレに　2番目に　書く\nあれや。……早さだけが　とりえや",
				"なんに　する？\n……券は　あとで　ええで",
			],
		},
		{
			id: "soba_a",
			walk: "sa:f6k97v",
			at: [3, 6],
			dir: "up",
			name: "名無し",
			lines: ["ワイ、峠を　こえる　前は\nここで　かけを　すするんや"],
		},
		{
			id: "soba_b",
			walk: "sa:dID4NE",
			at: [4, 6],
			dir: "up",
			name: "名無し",
			lines: [
				"たぬきと　きつねの　ちがい？\n……その　スレは　荒れるから　やめとけ",
			],
		},
	],
};

// 居酒屋：濃い 板の 床と 板壁。奥に 酒棚・もつ煮の コンロ・流し、台（台の うしろに 大将）と 丸いす、
// 右に 小上がりの 畳と 座卓、壁に 提灯と ナイターの テレビ、すみに 樽と ビールケース
const IZAKAYA_ROOM: FacilityRoom = {
	look: look(ri("flDarkWood"), "#5a4030", base(1, 55), base(1, 56), "#6a4a2a"),
	rows: [
		"############",
		"#HlHHlHHTtH#",
		"#hhhhhhhVvm#",
		"#BbSsKj.ZZZ#",
		"#.......ZzZ#",
		"#.[===].ZZZ#",
		"#.nnnnn.ZzZ#",
		"#.......ZZZ#",
		"#Ucc......F#",
		"####DD######",
	],
	tiles: (k) => ({
		l: k.up(LANTERN),
		// ナイターの テレビ（上の 段が 画面の 上、下の 段が 画面の 下と 台）
		T: k.up(riCell("tvGame", 0, 0)),
		t: k.up(riCell("tvGame", 1, 0)),
		V: k.low(riCell("tvGame", 0, 1)),
		v: k.low(riCell("tvGame", 1, 1)),
		B: k.on(ri("shelfBottles")),
		b: k.on(ri("shelfBottles", 1)),
		S: onUpper(k.on(ri("stoveBlack")), ri("potFire")),
		s: k.on(ri("stoveBlack", 1)),
		K: k.on(ri("sink")),
		j: k.on(ri("sink", 1)),
		Z: k.floor(ri("flTatami")),
		z: k.on(ri("flTatami"), ri("roundTable"), ri("sakeSet")),
		"[": ctr(k.on(riCell("counterLong", 0, 0), ri("yakitori"))),
		"=": ctr(k.on(riCell("counterLong", 1, 0))),
		"]": ctr(k.on(riCell("counterLong", 2, 0), ri("edamame"))),
		n: k.floor(ri("stoolBrown")),
		U: k.on(ri("barrel")),
		c: k.on(ri("bottleCrate")),
	}),
	things: {
		T: "tv",
		t: "tv",
		V: "tv",
		v: "tv",
		m: "notice",
		B: "bottles",
		b: "bottles",
		S: "pot",
		z: "zashiki",
		"[": "yakitori",
		U: "barrel",
		c: "crate",
		F: "plant",
	},
	lines: {
		barrel: ["樽。\n……中身は　たぶん　ぬか床だ。"],
		bottles: ["酒の　瓶が　ならぶ。\nラベルに「草」「大草原」「w」。"],
		crate: ["ビールケース。\n……いすの　かわりにも　なる。"],
		notice: ["はり紙。\n「本日の　おすすめ：釣りたての　アジ」"],
		plant: ["鉢植え。\n枝に　当たりくじが　結んである。"],
		pot: ["鍋で　もつ煮が　ことこと　煮えている。\n……みその　におい。"],
		tv: ["テレビで　ナイター中継。\n……スコアは　見ないで　おこう。"],
		yakitori: ["焼き鳥の　皿。\n……串だけ　きれいに　残っている。"],
		zashiki: ["小上がりの　座卓。\nとっくりが　ならぶ。……みんな　ごきげんだ。"],
	},
	people: [
		{
			id: "izakaya_master",
			walk: "sa:P9PNOA",
			at: [5, 4],
			dir: "down",
			name: "大将",
			play: "eat",
			lines: [
				"らっしゃい！　草ァ！\n……あ、いや、店の　名前や",
				"釣り帰りの　客が　多いんや。\n魚、持ってきたら　さばいたるで",
				"なんに　する？\nキリコちゃんは　ジュースな",
			],
		},
		{
			id: "izakaya_a",
			walk: "sa:8DXRgk",
			at: [3, 6],
			dir: "up",
			name: "名無し",
			lines: ["今日の　試合？　負けとる。\n……でも　ビールは　うまい"],
		},
		{
			id: "izakaya_b",
			walk: NANASHI[3],
			at: [8, 4],
			dir: "right",
			name: "名無し",
			lines: ["9回裏　2アウト　満塁や。\nここで　打ったら　ワイが　おごる"],
		},
		{
			id: "izakaya_c",
			walk: NANASHI[0],
			at: [10, 6],
			dir: "up",
			name: "名無し",
			lines: [
				"実況スレ、店で　見とるんや。\n……テレビより　スレの　ほうが　早い",
			],
		},
	],
};

// ───────────────── 店 ─────────────────

export const EATERIES: readonly Facility[] = [
	// ── たこ焼き屋台「たこ八」（段2〜。浜の 桟橋の 東。中は なく、台の うしろに 店番が 立つ。台の 前から 話す）
	{
		id: "tako",
		name: "たこ焼き屋台「たこ八」",
		from: 2,
		at: [22, 32],
		// 赤い 日よけ・柱（左に ラムネの 氷水、右に 鉄板）・台と、左に 品書きの 立て札
		look: {
			kind: "grid",
			ground: "sand",
			shadow: false,
			rows: [" abc", " PeQ", "Mxyz"],
			floor: "e",
			counter: "xyz",
			keys: {
				a: [art("canopy", 0, 1)],
				b: [art("canopy", 1, 1)],
				c: [art("canopy", 2, 1)],
				P: [art("stallPole", 0)],
				e: [base(4, 4)],
				Q: [art("stallPole", 1)],
				M: [art("menuStand")],
				x: [art("stallCounter", 0)],
				y: [art("stallCounter", 1)],
				z: [art("stallCounter", 2)],
			},
		},
		outdoor: [
			{
				id: "keeper",
				at: [24, 33],
				sprite: "sa:Tdk1m9",
				dir: "down",
				name: "屋台の　兄ちゃん",
				play: "eat",
				lines: [
					"らっしゃい！　たこ焼き　焼けとるで。\nタコは　さっき　突堤で　釣ってきたんや",
					"浜で　食う　たこ焼きは　格別やで。\n……なんぼでも　焼いたる",
					"どれに　する？\n……熱いうちに　食べや",
				],
			},
			{
				id: "menu",
				at: [22, 34],
				lines: [
					"立て札の　品書き。\nたこ焼き・ねぎだこ・焼きそば・ラムネ。",
					"すみに　小さく\n「タコ　入ってへんかったら　言うてな」",
				],
			},
			{
				id: "ramune",
				at: [23, 33],
				lines: [
					"ラムネの　瓶が　氷水で　冷えている。\nビー玉が　からん、と　鳴った。",
				],
			},
			{
				id: "griddle",
				at: [25, 33],
				lines: [
					"鉄板の　穴で　生地が　じゅう。\n……千枚通しで、くるっと　返した。",
				],
			},
		],
	},
	// ── 立ち食いそば「2げと」（段3〜。北の 峠の 道（村の 北の 口）の 西。桜は 残す。(20,6) の しげみを 抜いて
	// 西の 草地（雑居ビルの 看板 19,5 の 前）へ 通す）
	{
		id: "soba",
		name: "立ち食いそば「2げと」",
		from: 3,
		at: [21, 3],
		clear: [[20, 6, ","]],
		// 黒い 瓦の 切妻・木の 店先・紺の のれん・赤い 提灯、右に 赤い 縁台と 傘
		look: {
			kind: "grid",
			rows: ["abc  ", "def  ", "gDhij"],
			door: "D",
			keys: {
				a: [art("jpGable")],
				b: [art("jpGable", 1)],
				c: [art("jpGable", 2)],
				d: [art("jpGable", 0, 1)],
				e: [art("jpGable", 1, 1)],
				f: [art("jpGable", 2, 1)],
				g: [art("jpEnt")],
				D: [art("jpEnt", 1), base(4, 297)],
				h: [art("jpEnt", 2), LANTERN],
				i: [base(2, 298), basePx(80, 4752, 16, 32)],
				j: [base(4, 298), basePx(96, 4752, 16, 32)],
			},
		},
		door: "立ち食いそば「2げと」。\nだしの　におい。……出かける　前に　一杯。",
		doorSe: "slideDoor",
		room: SOBA_ROOM,
		outdoor: [
			{
				id: "menu",
				at: [21, 5],
				lines: ["品書きの　札。\nかけ・きつね・たぬき・月見・コロッケ。"],
			},
			{
				id: "bench",
				at: [24, 5],
				lines: ["縁台と　赤い　傘。\n……峠の　風が　気持ちいい。"],
			},
		],
	},
	// ── 居酒屋「草」（段6〜。浜の 西（海の家と 桟橋の あいだ）。フェリスの 立つ 12,35 と 自販機は そのまま）
	{
		id: "izakaya",
		name: "居酒屋「草」",
		from: 6,
		at: [14, 32],
		// 灰色の 瓦・板壁・赤い 提灯・格子・木の 看板・すだれ・茶の のれん、右に 黒板の 立て札
		look: {
			kind: "grid",
			ground: "sand",
			rows: ["aaaaa", "bbbbb", "cklmcG", "nopqr"],
			door: "p",
			keys: {
				a: [base(4, 82)],
				b: [base(4, 84)],
				c: [base(1, 55), LANTERN],
				k: [base(1, 55), art("lattice", 0)],
				l: [base(1, 55), art("boardWood")],
				m: [base(1, 55), art("lattice", 3)],
				G: [art("boardWood", 1)],
				n: [base(1, 56), art("plank", 0, 1)],
				o: [base(1, 56), art("lattice", 0, 1)],
				p: [base(1, 56), base(7, 55, 1, 2), art("norenBrown")],
				q: [base(1, 56), art("lattice", 3, 1)],
				r: [base(1, 56), art("reed")],
			},
		},
		door: "居酒屋「草」。\n……ナイター中継と、笑い声。",
		doorSe: "slideDoor",
		room: IZAKAYA_ROOM,
		outdoor: [
			{
				id: "menu",
				at: [19, 34],
				lines: ["黒板。\n「本日：アジフライ・もつ煮・焼き鳥」"],
			},
			{
				id: "sudare",
				at: [14, 35],
				lines: ["すだれ。\n……すきまから　テレビの　光が　もれる。"],
			},
		],
	},
	// ── メイド喫茶「メイドの土産」（段7）。東の 商店街（data/village/diners.ts）
	...DINERS,
];
