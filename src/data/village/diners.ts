// 新市街の 中庭の 飲食店（data/village/eateries.ts の EATERIES の うしろに 足す。書き方は 同じ）。
// 2026-10-15 作者：「マック風の建物施設・メイドカフェ等もあってもいいかもしれません」。名前は どれも 自前
// （実在の 店の 名前・印は 使わない。赤と 黄色の 店構え・メイドさんの お出迎え だけ 借りる）。
//
//   段6 バーガー「ワイバーガー」（緑道 x=63〜69 の 北の 中庭。扉は 下の 芝 y=13 へ。緑道の 木の あいだ）
//   段7 メイド喫茶「メイドの土産」（緑道の 南の 中庭。大通りの 南の 小道 y=30 の 下。扉は 下の 芝 y=35 へ。
//        南どなりは ヲタショップ「神降臨」（data/village/otaku.ts））
//
// 店番に 話すか 注文の 端末・品書きを 調べると 品書き（data/town/eateries.ts の EAT_MENUS・ui/minigames/eat.ts）。
// メイド喫茶の オムライス・パフェ・ラテは 出す 前に おまじない（品の magic。メイドさんの 頭に ♥）。
// 手描きの 絵（品・品書きの 板・看板・メイドさんの 歩行グラ）は scripts/make-diner.mjs（dinerSheet.ts）。
// ここからも facilities.ts の 値は 読まない（eateries.ts と 同じ わけ）。

import { diner, MAID_WALK } from "./dinerSheet";
import type { Facility, FacilityRoom, RoomLook } from "./facilities";
import { art, ri, riCell } from "./rpgenArt";
import { base } from "./tiles";

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

// バーガー：赤い 床と 白い レンガの 壁。奥に フライヤー（揚げ鍋の コンロ）・流し・保温の ケース・冷蔵庫、
// 壁に 写真つきの 品書きの 板（台の 上）。台に レジ（台の うしろに 店員）、
// 手前に ボックス席 2つずつ、入口の そばに 注文の 端末と ごみ箱
const BURGER_ROOM: FacilityRoom = {
	look: look(ri("flRed"), "#a84a3a", base(1, 63), base(1, 64), "#d8d8d8"),
	rows: [
		"############",
		"#HHHHMmNHHH#",
		"#hhhhhhhhhh#",
		"#SsKj...gGR#",
		"#..........#",
		"#...[=$=]..#",
		"#..........#",
		"#<T>....<Y>#",
		"#..........#",
		"#<U>....Pq.#",
		"####DD######",
	],
	tiles: (k) => ({
		M: k.up(diner("menuL")),
		m: k.up(diner("menuM")),
		N: k.up(diner("menuR")),
		S: k.on(ri("stove"), ri("potFire")),
		s: k.on(ri("stove", 1)),
		K: k.on(ri("sink")),
		j: k.on(ri("sink", 1)),
		g: k.on(ri("yellowCounter")),
		G: k.on(ri("yellowCounter", 1)),
		R: k.on(ri("fridgeSilver")),
		// 注文の 台（まんなかの レジの うしろに 店員。店員の 前の 台には 調べる 物を 置かない）
		"[": ctr(k.on(riCell("counterLong", 0, 0), diner("set"))),
		"=": ctr(k.on(riCell("counterLong", 1, 0))),
		$: ctr(k.on(ri("regiCounter"))),
		"]": ctr(k.on(riCell("counterLong", 2, 0))),
		// ボックス席（ソファに はさまれた 机）
		"<": k.floor(ri("boothR")),
		">": k.floor(ri("boothL")),
		T: k.on(ri("tableBeige"), diner("fries")),
		Y: k.on(ri("tableBeige"), diner("shake")),
		U: k.on(ri("tableBeige"), diner("burger")),
		P: k.on(ri("kiosk")),
		q: k.on(ri("trash")),
	}),
	things: {
		M: "menu",
		m: "menu",
		N: "menu",
		S: "fryer",
		s: "fryer",
		K: "sink",
		g: "warmer",
		G: "warmer",
		R: "fridge",
		"[": "tray",
		T: "table",
		Y: "table",
		U: "table",
		P: "kiosk",
		q: "trash",
	},
	lines: {
		menu: [
			"写真つきの　品書き。\nバーガー・ageポテト・シェイク……",
			"写真の　バーガーは、\n……実物より　ちょっと　ぶあつい。",
		],
		fryer: ["揚げ鍋が　ぱちぱち　鳴っている。\n……ポテトが　いま　ageられた。"],
		sink: ["流し。\nトレーが　山に　なっている。"],
		warmer: ["保温の　ケース。\n包んだ　バーガーが　ならんで　待っている。"],
		fridge: ["冷蔵庫。\nピクルスの　大きな　びん。"],
		tray: [
			"受けとりの　トレー。\n「ご一緒に　ポテトは　いかがですか」の　札。",
		],
		table: ["食べかけの　トレー。\n……ポテトだけ　先に　なくなっている。"],
		kiosk: ["注文の　端末。\n画面を　さわると　品書きが　出る。"],
		trash: ["ごみ箱。\n「トレーは　上に　のせてください」"],
	},
	plays: { kiosk: "eat" },
	people: [
		{
			id: "burger_clerk",
			walk: "sa:jkswZA",
			at: [6, 4],
			dir: "down",
			name: "店員",
			play: "eat",
			lines: [
				"いらっしゃいませ！\nこちらで　お召しあがりですか？",
				"ポテトは　age　たてです。\n……揚げたて、の　ことです",
				"ご注文　どうぞ！\n……笑顔は　無料です",
			],
		},
		{
			id: "burger_a",
			walk: NANASHI[2],
			at: [1, 7],
			dir: "right",
			name: "名無し",
			lines: ["ワイバーガー　3つ　たのんだ。\n……店の　名前に　つられたんや"],
		},
		{
			id: "burger_b",
			walk: "sa:XW7bn0",
			at: [10, 7],
			dir: "left",
			name: "学生",
			lines: ["放課後は　ここで　ポテトや。\n……1本ずつ　ゆっくり　食べる"],
		},
	],
};

// メイド喫茶：明るい 板の 床と クリームの しまの 壁紙。奥に 冷蔵庫と 戸棚（コーヒーの 機械・ケーキ・グラス）、
// 壁に ハートの 黒板と 窓。台に レジ（台の うしろに メイドさん）、手前に 丸いすの 丸い 卓が 4つ、すみに 鉢植え
const MAID_ROOM: FacilityRoom = {
	look: look(ri("flWoodLight"), "#d8b878", base(1, 75), base(1, 76), "#f0d890"),
	rows: [
		"############",
		"#HwHHHHBwHH#",
		"#hhhhhhhhhh#",
		"#R.CcE.....#",
		"#..........#",
		"#...[=$=]..#",
		"#..........#",
		"#.nOn..nOn.#",
		"#..........#",
		"#.nOn..nOn.#",
		"#F........F#",
		"####DD######",
	],
	tiles: (k) => ({
		w: k.up(ri("winModern")),
		B: k.up(diner("maidBoard")),
		R: k.on(ri("fridgeWhite")),
		C: k.on(ri("cabWood"), ri("coffeeMaker")),
		c: k.on(ri("cabWood", 1), ri("cake")),
		E: k.on(ri("cabWood", 2), ri("glasses")),
		// 台（まんなかの レジの うしろに メイドさん。メイドさんの 前の 台には 調べる 物を 置かない）
		"[": ctr(k.on(riCell("counterLong", 0, 0), ri("melonSoda"))),
		"=": ctr(k.on(riCell("counterLong", 1, 0))),
		$: ctr(k.on(ri("regiCounter"))),
		"]": ctr(k.on(riCell("counterLong", 2, 0), diner("parfait"))),
		n: k.floor(ri("stoolBrown")),
		O: k.on(ri("roundTable")),
	}),
	things: {
		w: "window",
		B: "board",
		R: "fridge",
		C: "coffee",
		c: "cake",
		E: "glasses",
		"[": "soda",
		"]": "parfait",
		O: "table",
		F: "plant",
	},
	lines: {
		window: ["窓に　レースの　カーテン。\n……外の　浜の　音が　とおい。"],
		board: [
			"ハートの　黒板。\n「おまじない　無料♥　写真は　ひかえめに」",
			"すみに　小さく\n「冥土の　土産に　どうぞ」",
		],
		fridge: ["冷蔵庫。\nいちごと　生クリームで　ぎっしり。"],
		cake: ["ケーキの　ケース。\nいちごが　ひとつずつ　つやつや。"],
		coffee: ["コーヒーの　機械。\n……泡の　ハートの　練習の　あと。"],
		glasses: ["グラスが　ぴかぴか。\n「スタンプ　10こで　お名前を　呼びます」"],
		soda: ["クリームソーダの　見本。\n……さくらんぼが　ななめに　のっている。"],
		parfait: ["パフェの　見本。\n……いちごの　数が　かぞえきれない。"],
		table: ["丸い　卓。\nレースの　しきもの。……ここだけ　お城だ。"],
		plant: ["鉢植え。\n葉っぱが　ハートの　形に　切ってある。"],
	},
	plays: { board: "eat" },
	people: [
		{
			id: "maid_cocoa",
			walk: MAID_WALK,
			at: [6, 4],
			dir: "down",
			name: "メイドの　ここあ",
			play: "eat",
			lines: [
				"おかえりなさいませ、お嬢さま！\n……お席へ　ご案内しますね♪",
				"お店の　名前は「メイドの土産」です。\n……冥土じゃ　ないですよ？",
				"ご注文、お決まりですか？\n……おまじないも　おつけします",
			],
		},
		{
			id: "maid_milk",
			walk: MAID_WALK,
			at: [8, 8],
			dir: "up",
			name: "メイドの　みるく",
			lines: [
				"おいしく　なあれ……\nあっ、おかえりなさいませ！",
				"町の　倉庫の　メイドさん、\nいつか　お店に　来てほしいなあ",
			],
		},
		{
			id: "maid_a",
			walk: NANASHI[0],
			at: [2, 7],
			dir: "right",
			name: "名無し",
			lines: ["ワイ、ここの　常連や。\n……おまじない、ちゃんと　効くで"],
		},
		{
			id: "maid_b",
			walk: NANASHI[3],
			at: [9, 7],
			dir: "left",
			name: "名無し",
			lines: [
				"「おかえり」って　言われると、\n……なんか　帰ってきた　気が　するんや",
			],
		},
	],
};

// ───────────────── 店 ─────────────────

export const DINERS: readonly Facility[] = [
	// ── バーガー「ワイバーガー」（段6〜。緑道の 北の 中庭。扉は 下の 芝へ。左の 列は 緑道の 木と 歩く 道）
	{
		id: "burger",
		name: "バーガー「ワイバーガー」",
		from: 6,
		at: [64, 9],
		// 赤い 寄棟・黄色い 帯に 丸い バーガーの 看板・ガラスの 店先・自動ドア
		look: {
			kind: "grid",
			rows: ["abbbc", "deeef", "gGSGh", "iIDJj"],
			door: "D",
			keys: {
				a: [art("hipRed")],
				b: [art("hipRed", 1)],
				c: [art("hipRed", 2)],
				d: [art("hipRed", 0, 1)],
				e: [art("hipRed", 1, 1)],
				f: [art("hipRed", 2, 1)],
				g: [art("white", 0, 1), art("band", 0, 3)],
				G: [art("white", 1, 1), art("band", 1, 3)],
				S: [art("white", 1, 1), art("band", 1, 3), diner("burgerSign")],
				h: [art("white", 2, 1), art("band", 2, 3)],
				i: [art("white", 0, 2), art("glass", 1), art("shopGlass")],
				I: [art("white", 1, 2), art("glass", 1), art("shopGlass", 1)],
				D: [art("white", 1, 2), art("autoDoor", 0, 1)],
				J: [art("white", 1, 2), art("glass", 1), art("shopGlass", 1)],
				j: [art("white", 2, 2), art("glass", 1), art("shopGlass", 2)],
			},
		},
		door: "バーガー「ワイバーガー」。\n……揚げたての　においが　する。",
		doorSe: "autoDoor",
		room: BURGER_ROOM,
		outdoor: [
			{
				id: "window",
				at: [65, 12],
				lines: [
					"ガラスごしに　ボックス席。\n……学生が　ポテトを　分けあっている。",
				],
			},
			{
				id: "sign",
				at: [67, 12],
				lines: ["店先の　はり紙。\n「ワイセット　650円　ageポテト　増量中」"],
			},
		],
	},
	// ── メイド喫茶「メイドの土産」（段7〜。緑道の 南の 中庭。前の 芝の 小道を はさんで ヲタショップ）
	{
		id: "maid",
		name: "メイド喫茶「メイドの土産」",
		from: 7,
		at: [64, 31],
		// 白い 軒・桃色の しまの 帯に ハートの 看板・桃色の カーテンの 窓 2つ・白い 扉
		look: {
			kind: "grid",
			rows: ["aaaaa", "pPSPq", "12w12", "34D34"],
			door: "D",
			keys: {
				a: [art("eave")],
				p: [art("white", 0, 1), art("band", 0, 4)],
				P: [art("white", 1, 1), art("band", 1, 4)],
				S: [art("white", 1, 1), art("band", 1, 4), diner("heartSign")],
				q: [art("white", 2, 1), art("band", 2, 4)],
				"1": [art("white", 0, 1), art("winPink")],
				"2": [art("white", 1, 1), art("winPink", 1)],
				w: [art("white", 1, 1)],
				"3": [art("white", 0, 2), art("winPink", 0, 1)],
				"4": [art("white", 1, 2), art("winPink", 1, 1)],
				D: [art("white", 1, 2), base(4, 507, 1, 2)],
			},
		},
		door: "メイド喫茶「メイドの土産」。\n「おかえりなさいませ！」の　声。",
		room: MAID_ROOM,
		outdoor: [
			{
				id: "window",
				at: [65, 34],
				lines: [
					"桃色の　カーテンの　窓。\n……中で　だれかが「きゅん」と　言った。",
				],
			},
			{
				id: "sign",
				at: [67, 34],
				lines: ["扉の　札。\n「お嬢さま・ご主人さま　おかえりなさいませ」"],
			},
		],
	},
];
