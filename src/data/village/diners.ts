// 商店街の 飲食店（data/village/eateries.ts の EATERIES の うしろに 足す。書き方は 同じ）。
// 2026-10-15 作者：「マック風の建物施設・メイドカフェ等もあってもいいかもしれません」。名前は どれも 自前
// （実在の 店の 名前・印は 使わない。赤と 黄色の 店構え・メイドさんの お出迎え だけ 借りる）。
//
//   段7 メイド喫茶「メイドの土産」（東の 商店街。町の 通り y=19 の 南）
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
	// ── メイド喫茶「メイドの土産」（段7〜。東の 商店街）
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
