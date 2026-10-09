// 飲食店（町が 育つと 1軒ずつ ふえる 寄り道。食べても 何も 持ちこまない）。施設の 書き方は facilities.ts と
// 同じで、facilities.ts の FACILITIES の うしろに 足す（外観の 字も そこで 割りふる）。
// 店番に 話すか 券売機を 調べると 品書き（data/eateries.ts の EAT_MENUS・ui/eat.ts）。
// 麺屋「乙」と ファミレス「ドリンクバー」は facilities.ts（ファミレスは ドリンクバーだけ）。
//
//   段2 たこ焼き屋台「たこ八」（浜。桟橋の 東。中は なく、台ごしに 店番）
//   段3 立ち食いそば「2げと」（北の 峠の 道の 西）
//   段4 麺屋「乙」（facilities.ts。線路の 東の 南の 区画）
//   段5 牛丼「つゆだく」（新市街の 北の 通りの 突きあたり。縦の 通りの 北）
//   段6 居酒屋「草」（浜の 西。海の家と 桟橋の あいだ）
//   段7 寿司「鯖」・中華「炎上」（港の 岸壁。クレーンの 北）
//
// 絵は RPGEN の 部品（rpgenArt.ts の art・ri・riCell。scripts/pack-rpgen.mjs）と 同梱の Base.png。
// ここからは facilities.ts の 値を 読まない（facilities.ts が ここを 読むので、まわりこむと 読みこみの 順で こわれる）。

import type { Facility, FacilityRoom, RoomLook } from "./facilities";
import { art, ri, riCell } from "./rpgenArt";
import { base, basePx } from "./tiles";

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
		S: k.on(riCell("stove", 0, 0), ri("potFire")),
		s: k.on(riCell("stove", 1, 0)),
		P: k.on(riCell("cabWood", 2, 0), ri("korokke")),
		K: k.on(riCell("sink", 0, 0)),
		j: k.on(riCell("sink", 1, 0)),
		R: k.on(ri("fridgeWhite")),
		"[": ctr(k.on(base(1, 98), ri("tanuki"))),
		"=": ctr(k.on(base(2, 98))),
		"]": ctr(k.on(base(3, 98), ri("kitsune"))),
		V: k.on(ri("atm")),
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

// 牛丼：白い タイルと 白い 壁。奥に 冷蔵庫・大鍋の コンロ・流し・炊飯器と 皿と やかんの 戸棚、
// コの字の 台（中に 店員 ひとり）と だいだいの 丸いす
const GYUDON_ROOM: FacilityRoom = {
	look: look(ri("flWhite"), "#d8d8d8", base(1, 59), base(1, 60), "#e8e8e8"),
	rows: [
		"############",
		"#HHHHHHHHWl#",
		"#hhhhhhhhhh#",
		"#RSsKjGgQ..#",
		"#..........#",
		"#n|....|n..#",
		"#n|....|n..#",
		"#n[====]n..#",
		"#.nnnnnn...#",
		"#........F.#",
		"####DD######",
	],
	tiles: (k) => ({
		l: k.up(art("signOrange")),
		R: k.on(ri("fridgeWhite")),
		S: k.on(riCell("stove", 0, 0), ri("potFire")),
		s: k.on(riCell("stove", 1, 0)),
		K: k.on(riCell("sink", 0, 0)),
		j: k.on(riCell("sink", 1, 0)),
		G: k.on(riCell("cabNavyB", 0, 0), ri("riceCooker")),
		g: k.on(riCell("cabNavyB", 1, 0), ri("plateStack")),
		Q: k.on(riCell("cabNavyB", 2, 0), ri("kettle")),
		"|": ctr(k.on(base(0, 98))),
		"[": ctr(k.on(base(1, 98), ri("gyudon"))),
		"=": ctr(k.on(base(2, 98))),
		"]": ctr(k.on(base(3, 98), ri("motsu"))),
		n: k.floor(ri("stoolOrange")),
	}),
	things: {
		W: "window",
		l: "sign",
		R: "fridge",
		S: "pot",
		s: "pot",
		K: "sink",
		G: "rice",
		g: "rice",
		Q: "kettle",
		"[": "bowl",
		F: "plant",
	},
	lines: {
		bowl: ["食べおわった　どんぶり。\n紅しょうがだけ　山もり　残っている。"],
		fridge: ["冷蔵庫。\n生卵と、紅しょうがの　大きな　袋。"],
		kettle: ["お茶の　やかん。\n……熱すぎて、まだ　飲めない。"],
		plant: ["鉢植え。\n……ここだけ　時間が　ゆっくりだ。"],
		pot: ["大鍋で　牛肉と　玉ねぎが　煮えている。\n……甘い　におい。"],
		rice: ["炊飯器と　どんぶり。\nごはんが　ずっと　保温されている。"],
		sign: ["看板。\n「並・大盛り・特盛り　つゆだく　無料」"],
		sink: ["流し。\nどんぶりが　山に　なっている。……ワンオペ。"],
		window: ["窓から　通りが　見える。\n……夜中でも　あかりが　ついている。"],
	},
	people: [
		{
			id: "gyudon_clerk",
			walk: "sa:S2cI2P",
			at: [4, 6],
			dir: "down",
			name: "店員",
			play: "eat",
			lines: [
				"いらっしゃいませー。\n……今日も　ワンオペです",
				"つゆだく？　ねぎだく？\n……通は　だいたい　両方です",
				"ご注文、どうぞ。\n……券売機は　こわれてます",
			],
		},
		{
			id: "gyudon_a",
			walk: "sa:dID4NE",
			at: [1, 5],
			dir: "right",
			name: "名無し",
			lines: ["大盛り　ねぎだく　ギョク。\n……これ　最強"],
		},
		{
			id: "gyudon_b",
			walk: "sa:Rn1eai",
			at: [6, 8],
			dir: "up",
			name: "名無し",
			lines: ["牛丼屋は　もっと　殺伐と　してる\nべきなんや。……知らんけど"],
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
		B: k.on(riCell("shelfBottles", 0, 0)),
		b: k.on(riCell("shelfBottles", 1, 0)),
		S: k.on(riCell("stoveBlack", 0, 0), ri("potFire")),
		s: k.on(riCell("stoveBlack", 1, 0)),
		K: k.on(riCell("sink", 0, 0)),
		j: k.on(riCell("sink", 1, 0)),
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

// 寿司：明るい 板の 床と 和室の 壁。奥に 冷蔵庫・皿と やかんの 戸棚・流し・生け簀、ネタケースの ある 台
// （台の うしろに 大将）と 丸いす、手前に 卓と いす、壁に 提灯と 掛け軸
const SUSHI_ROOM: FacilityRoom = {
	look: look(ri("flWoodLight"), "#d8b878", base(1, 57), base(1, 58), "#8a6a3a"),
	rows: [
		"############",
		"#HHlHHHKHHH#",
		"#hhhhhhhhhh#",
		"#RCcSj..TuV#",
		"#..........#",
		"#.[gG==]...#",
		"#.nnnnnn...#",
		"#..........#",
		"#.On...On.F#",
		"####DD######",
	],
	tiles: (k) => ({
		l: k.up(LANTERN),
		K: k.up(ri("scroll")),
		R: k.on(ri("fridgeWhite")),
		C: k.on(riCell("cabWood", 0, 0), ri("plateStack")),
		c: k.on(riCell("cabWood", 1, 0), ri("kettle")),
		S: k.on(riCell("sink2", 0, 0)),
		j: k.on(riCell("sink2", 1, 0)),
		T: k.on(riCell("fishTank", 0, 0)),
		u: k.on(riCell("fishTank", 1, 0)),
		V: k.on(riCell("fishTank", 2, 0)),
		"[": ctr(k.on(riCell("counterLong", 0, 0), ri("maguro"))),
		g: ctr(k.on(riCell("glassCase", 0, 0))),
		G: ctr(k.on(riCell("glassCase", 1, 0))),
		"=": ctr(k.on(riCell("counterLong", 1, 0))),
		"]": ctr(k.on(riCell("counterLong", 2, 0), ri("edamame"))),
		n: k.floor(ri("stoolBrown")),
		O: k.on(ri("roundTable"), ri("edamame")),
	}),
	things: {
		K: "scroll",
		R: "fridge",
		C: "plates",
		c: "plates",
		S: "sink",
		T: "tank",
		u: "tank",
		V: "tank",
		g: "case",
		G: "case",
		O: "table",
		F: "plant",
	},
	lines: {
		case: ["ネタケース。\nikura・uni・awabi……どれも　つやつや。"],
		fridge: ["冷蔵庫。\n……中は　ネタで　ぎっしりだ。"],
		plates: ["重ねた　皿と　やかん。\n出前の　予約の　札が　はさまっている。"],
		plant: ["鉢植え。\n……竹。すっと　まっすぐ。"],
		scroll: ["掛け軸。\n「鯖は　落ちても　スレは　落とすな」"],
		sink: ["流し。\n……包丁が　ぴかぴかに　研いである。"],
		table: ["卓。\n湯のみの　お茶が　あつい。"],
		tank: ["生け簀。\nアジと　鯖が　ぐるぐる　泳いでいる。"],
	},
	people: [
		{
			id: "sushi_master",
			walk: "sa:HMyV1k",
			at: [5, 4],
			dir: "down",
			name: "大将",
			play: "eat",
			lines: [
				"らっしゃい。\n……うちは　鯖が　自慢でね",
				"鯖が　落ちる？　落ちやしねえよ。\n毎朝、港で　仕入れてるからな",
				"何に　しやしょう。\n……鯖は　外せねえよ",
			],
		},
		{
			id: "sushi_a",
			walk: "sa:Rqde67",
			at: [2, 6],
			dir: "up",
			name: "名無し",
			lines: ["ワシは　むかしから　ikura　派じゃ。\n……鯖の　名前の　話じゃよ"],
		},
		{
			id: "sushi_b",
			walk: NANASHI[3],
			at: [7, 6],
			dir: "up",
			name: "名無し",
			lines: [
				"おまかせの「hayabusa」、たのんでみ。\n……この　島の　名前の　握りや",
			],
		},
	],
};

// 中華：赤い 床と 赤い 格子の 壁。奥に 中華鍋の コンロ・流し・赤い 戸棚（チャーハン・餃子）・冷蔵庫、
// 台（台の うしろに 大将）と 赤い 丸いす、手前に 丸い 卓と 赤い いす、壁に 提灯・丸窓・ロゼ直伝の はり紙
const CHUKA_ROOM: FacilityRoom = {
	look: look(ri("flRed"), "#a83a2a", base(4, 294), base(4, 295), "#a82020"),
	rows: [
		"############",
		"#HlHrHHlHrH#",
		"#hhhhhhhRhh#",
		"#WwKjSsQ.q.#",
		"#..........#",
		"#.[====]...#",
		"#.nnnnnn...#",
		"#......cOc.#",
		"#.cOc......#",
		"#F.......F.#",
		"####DD######",
	],
	tiles: (k) => ({
		l: k.up(LANTERN),
		r: k.up(base(6, 295)),
		R: k.low(ri("paperNote")),
		W: k.on(riCell("stoveBlack", 0, 0), ri("potFire")),
		w: k.on(riCell("stoveBlack", 1, 0)),
		K: k.on(riCell("sink2", 0, 0)),
		j: k.on(riCell("sink2", 1, 0)),
		S: k.on(riCell("cabRed", 0, 0), ri("chahan")),
		s: k.on(riCell("cabRed", 1, 0), ri("gyoza")),
		Q: k.on(riCell("cabRed", 2, 0)),
		q: k.on(ri("fridgeWhite")),
		"[": ctr(k.on(riCell("counterLong", 0, 0), ri("ebichili"))),
		"=": ctr(k.on(riCell("counterLong", 1, 0))),
		"]": ctr(k.on(riCell("counterLong", 2, 0), ri("mabo"))),
		n: k.floor(ri("stoolRed")),
		O: k.on(ri("roundTable")),
		c: k.floor(ri("chairRed")),
	}),
	things: {
		R: "recipe",
		W: "wok",
		w: "wok",
		S: "dish",
		s: "dish",
		Q: "cabinet",
		q: "fridge",
		"[": "ebichili",
		O: "table",
		F: "plant",
	},
	lines: {
		cabinet: ["食器棚。\nれんげが　100本は　ある。"],
		dish: ["できたての　皿。\nチャーハンと　ぎょうざ。"],
		ebichili: ["エビチリの　皿。\n……赤い。見るからに　辛そうだ。"],
		fridge: ["冷蔵庫。\n豆腐が　ぎっしり。……麻婆の　ため　らしい。"],
		plant: ["鉢植え。\n……金の　なる木。"],
		recipe: ["はり紙。「麻婆豆腐　ロゼ直伝」\n……ていねいな　字だ。"],
		table: ["丸い　卓。\nまわる　台が　ついている。"],
		wok: ["中華鍋。\n……ごうっと　火が　あがる。"],
	},
	people: [
		{
			id: "chuka_master",
			walk: "sa:P2dNvQ",
			at: [3, 4],
			dir: "down",
			name: "大将",
			play: "eat",
			lines: [
				"いらっしゃい！\nうちは　毎日　炎上や。……鍋の　話やで",
				"麻婆は　ロゼ　いう　子に　習うた。\n……あの　味には、まだ　かなわん",
				"何に　する！\n……おすすめは　麻婆や",
			],
		},
		{
			id: "chuka_a",
			walk: "sa:UT7LXB",
			at: [4, 6],
			dir: "up",
			name: "名無し",
			lines: ["麻婆、辛い！　辛い！\n……でも　れんげが　止まらん"],
		},
		{
			id: "chuka_b",
			walk: NANASHI[1],
			at: [9, 7],
			dir: "left",
			name: "名無し",
			lines: [
				"ここの　チャーハンは　パラパラや。\n……過疎スレくらい　パラパラや",
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
	// ── 牛丼「つゆだく」（段5〜。新市街の 北の 通りの 北。西の 縦の 通りの 突きあたり）
	{
		id: "gyudon",
		name: "牛丼「つゆだく」",
		from: 5,
		at: [47, 4],
		// 灰色の 屋根・だいだいの しまの 日よけ・ガラスの 店先・自動ドア・だいだいの 看板
		look: {
			kind: "grid",
			rows: ["aaaaa", "bbbbb", "cdefg", "hhhDh"],
			door: "D",
			keys: {
				a: [base(5, 82)],
				b: [base(1, 59), art("awningOrange")],
				c: [base(1, 59), art("shopGlass", 0)],
				d: [base(1, 59), art("shopGlass", 1)],
				e: [base(1, 59), art("shopGlass", 2)],
				f: [base(1, 59), art("autoDoor")],
				g: [base(1, 59), art("signOrange")],
				h: [base(1, 60)],
				D: [base(1, 60), art("autoDoor", 0, 1)],
			},
		},
		door: "牛丼「つゆだく」。\n……いらっしゃいませー、と　ひとりの　声。",
		room: GYUDON_ROOM,
		outdoor: [
			{
				id: "window",
				at: [48, 7],
				lines: [
					"ガラスごしに　コの字の　台が　見える。\n……店員が　ひとりで　走りまわっている。",
				],
			},
			{
				id: "menu",
				at: [51, 7],
				lines: ["看板。\n「24時間　営業。つゆだく　無料」"],
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
	// ── 寿司「鯖」（段7〜。港の 岸壁。クレーン 74・80 の 北。前は 岸壁、うしろは 遊歩道）
	{
		id: "sushi",
		name: "寿司「鯖」",
		from: 7,
		at: [74, 43],
		// 和の 大屋根・格子と 障子・木の 看板・紺の のれん、左に 石の 灯籠
		look: {
			kind: "grid",
			ground: "quay",
			rows: [" abcde", " fghij", " klmno", "PqrSst"],
			door: "S",
			keys: {
				a: [art("jpRoof")],
				b: [art("jpRoof", 1)],
				c: [art("jpRoof", 2)],
				d: [art("jpRoof", 3)],
				e: [art("jpRoof", 4)],
				f: [art("jpRoof", 0, 1)],
				g: [art("jpRoof", 1, 1)],
				h: [art("jpRoof", 2, 1)],
				i: [art("jpRoof", 3, 1)],
				j: [art("jpRoof", 4, 1)],
				k: [art("lattice", 0)],
				l: [art("lattice", 1)],
				m: [art("lattice", 1, 1), art("boardWood", 1)],
				n: [art("lattice", 2)],
				o: [art("lattice", 3)],
				P: [art("lanternStone")],
				q: [art("lattice", 0, 1)],
				r: [art("lattice", 1, 1)],
				S: [art("jpEnt", 1), base(4, 297)],
				s: [art("lattice", 2, 1)],
				t: [art("lattice", 3, 1)],
			},
		},
		door: "寿司「鯖」。\n……ひのきの　香り。しずかな　店。",
		room: SUSHI_ROOM,
		outdoor: [
			{
				id: "lantern",
				at: [74, 46],
				lines: ["石の　灯籠。\n……港の　風で　火が　ゆれている。"],
			},
			{
				id: "window",
				at: [75, 46],
				lines: ["格子の　窓。\n……中で　包丁の　音が　する。"],
			},
		],
	},
	// ── 中華「炎上」（段7〜。港の 岸壁の 東はし。前は 岸壁）
	{
		id: "chuka",
		name: "中華「炎上」",
		from: 7,
		at: [81, 43],
		// 赤い 瓦・赤い 格子の 壁・提灯・丸窓・赤い 看板・赤い 扉、両はしに 赤い 柱
		look: {
			kind: "grid",
			ground: "quay",
			rows: ["aaaaa", "bbbbb", "cdedc", "FgDgF"],
			door: "D",
			keys: {
				a: [base(3, 82)],
				b: [base(3, 84)],
				c: [base(4, 294), LANTERN],
				d: [base(4, 294), base(6, 295)],
				e: [base(4, 294), art("signRed")],
				F: [base(3, 296)],
				g: [base(4, 295), base(7, 295)],
				D: [base(4, 295), base(1, 298)],
			},
		},
		door: "中華「炎上」。\n……鍋から　火柱が　あがった。",
		room: CHUKA_ROOM,
		outdoor: [
			{
				id: "window",
				at: [82, 46],
				lines: ["丸い　窓。\n……中から　油の　はじける　音。"],
			},
			{
				id: "pillar",
				at: [81, 46],
				lines: ["赤い　柱。\n金の　字で「炎上　上等」。"],
			},
		],
	},
];
