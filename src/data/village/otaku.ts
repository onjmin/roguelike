// ヲタショップ「神降臨」（段7〜。盛り場の 劇場と カジノの あいだ。2026-10-15 作者「オタク系の ショップ施設が あっても よさそう」）。
// 名前は 2ch の「神降臨」（すごい 絵や 新作が 投下された ときの 決まり文句）。実在の 店の 名前・ロゴは 使わない。
// 外観は だいだいの 看板の 帯・ポスターの 貼られた 窓・ガラスの 店先と 自動ドア。
// 中は 壁の ポスター・フィギュアケース・同人誌の 棚・タペストリー・ガチャガチャ・同人誌の 平台（立ち読みできる）・レジ。
// レジで グッズを 買うと キリコの 家の 収納に 届く（家具に なる。data/village/myhome.ts の OTAKU_GOODS。
// 家を 買う 前は すすめるだけ：飾る 家が ないので）。ガチャは 1回 500円で アクスタ 全4種（ダブりあり。OTAKU_GACHA）。
// 買う・回すは ui/village/otaku.ts（play "otaku"）。絵は scripts/make-otaku.mjs の public/sprites/otaku.png。
// ポスター・フィギュア・アクスタの 絵柄は この ゲームの 人（ゼロ・レン・リノ・アル）の 歩行グラ。
// ここからは facilities.ts の 値を 読まない（facilities.ts が ここを 読む）。

import type { Facility, FacilityRoom } from "./facilities";
import type { BaseFurnitureId } from "./myhome";
import { art, ri } from "./rpgenArt";
import { base } from "./tiles";

/** ヲタショップの 絵（public/sprites/otaku.png。272x32）。 */
export const OTAKU_IMG = "pub:sprites/otaku.png";

/** otaku.png の (列, 行) から w×h マス。縦 2マスの 物は h=2（下端そろえで 上の マスへ はみ出す）。 */
export const otakuArt = (c: number, r: number, w = 1, h = 1): string =>
	`${OTAKU_IMG}#${c * 16},${r * 16},${w * 16},${h * 16}`;

/** otaku.png の 絵の 場所（scripts/make-otaku.mjs の 見出しと 同じ）。 */
export const OTAKU_CELLS = {
	figureCase: [0, 0, 1, 2],
	tapestry: [1, 0, 1, 2],
	doujinShelf: [2, 0, 1, 2],
	gacha: [3, 0, 1, 2],
	posterZero: [4, 0, 1, 1],
	posterRino: [5, 0, 1, 1],
	posterAru: [6, 0, 1, 1],
	posterRen: [7, 0, 1, 1],
	register: [4, 1, 1, 1],
	figZero: [5, 1, 1, 1],
	figRino: [6, 1, 1, 1],
	figAru: [7, 1, 1, 1],
	acstZero: [8, 0, 1, 1],
	acstRen: [8, 1, 1, 1],
	acstRino: [9, 0, 1, 1],
	acstAru: [9, 1, 1, 1],
	winZero: [10, 0, 1, 1],
	winAru: [11, 0, 1, 1],
	hiradai: [10, 1, 2, 1],
	sign: [12, 0, 5, 1],
	pop: [12, 1, 1, 1],
} as const;

export type OtakuArtName = keyof typeof OTAKU_CELLS;

/** 絵の 1本（縦 2マスの 物は 16x32 の まま。部屋の 床に 置くと 上の マスへ はみ出す）。 */
export const oa = (name: OtakuArtName): string => {
	const [c, r, , h] = OTAKU_CELLS[name];
	return otakuArt(c, r, 1, h);
};
/** 絵の (col, row) の 1マス（16x16。家具の マスごとの 絵・看板の 帯）。 */
export const oaCell = (name: OtakuArtName, col = 0, row = 0): string => {
	const [c, r] = OTAKU_CELLS[name];
	return otakuArt(c + col, r + row);
};

// ───────────────── 売り物 ─────────────────

/** レジで 買える グッズ（家具。値段は data/village/myhome.ts の FURNITURE_PRICE）。リサイクルショップでは 売らない。 */
export const OTAKU_GOODS: readonly BaseFurnitureId[] = [
	"figZero",
	"figRino",
	"figAru",
	"otakuTapestry",
	"doujinShelf",
	"figureCase",
];

/** ガチャの 景品（アクスタ 全4種。店では 売らない）。 */
export const OTAKU_GACHA: readonly BaseFurnitureId[] = [
	"acstZero",
	"acstRen",
	"acstRino",
	"acstAru",
];

/** ガチャ 1回の 値段（円）。 */
export const GACHA_PRICE = 500;

/** 店の 文（{price} 値段・{name} 品の 名前）。 */
export const OTAKU_MSG = {
	clerk: "店員",
	shop: "「グッズはお家にお届けします。\n配送料はサービスです」",
	shopTitle: "グッズを買う",
	shopNoHome: "「グッズはお家に飾るものですよ。\nまずは住むところから……」",
	shopEmpty: "「うちのグッズ、もうぜんぶ\nお持ちですね。……神客です」",
	shopShort: "「……{price}、たりないですね。\nまた来てください」",
	gachaMenu: ["回す", "やめる"],
	gachaNoHome: "……景品を飾る家がない。\n（キリコの家を買ってから）",
	gachaShort: "……500円たりない。",
	gachaSpin: "ガチャ……ガチャ……ころん。",
	gachaGot: "{name}が出た！\n家の収納に送っておこう。",
	gachaDup: "{name}が出た。\n……ダブった。",
	gachaComp: "アクスタは全4種そろっている。\n……もう回さなくていい。",
} as const;

// ───────────────── 中 ─────────────────

/** 名無し（本館の 中の 人と 同じ 絵）。 */
const NANASHI = ["sa:xjuotB", "sa:qPN3cT", "sa:C2hS8U", "sa:VaBXqn"] as const;
/** 台（台ごしに 向こうの 人と 話せる。人の となりの 台には 調べる 物を 置かない）。 */
const ctr = <T extends object>(t: T) => ({ ...t, counter: true });

// 白い 床と 白い 壁。上の 壁に ポスター 4枚、奥に フィギュアケース・同人誌の 棚・タペストリー・ガチャガチャ、
// まんなかに フィギュアの 見本と 新刊の 平台（立ち読み）、右に レジ（台の うしろに 店員）
const OTAKU_ROOM: FacilityRoom = {
	look: {
		floor: ri("flWhite"),
		floorColor: "#e4e4e0",
		up: base(0, 507),
		low: base(0, 508),
		wallColor: "#e8e8e4",
	},
	rows: [
		"############",
		"#HaHbHHcHdH#",
		"#hhhhhhhhhh#",
		"#C.B.BT.G.C#",
		"#..........#",
		"#.xyz.P12..#",
		"#..........#",
		"#.34....[R]#",
		"#..........#",
		"#q........F#",
		"####DD######",
	],
	tiles: (k) => ({
		a: k.up(oa("posterZero")),
		b: k.up(oa("posterRino")),
		c: k.up(oa("posterAru")),
		d: k.up(oa("posterRen")),
		C: k.on(oa("figureCase")),
		B: k.on(oa("doujinShelf")),
		T: k.on(oa("tapestry")),
		G: k.on(oa("gacha")),
		// 見本の フィギュア：3マスの 台に のせる（半マス 上に ずらして 天板に 立たせる）
		x: k.on(base(1, 98), `${oa("figZero")},0,-6`),
		y: k.on(base(2, 98), `${oa("figRino")},0,-6`),
		z: k.on(base(3, 98), `${oa("figAru")},0,-6`),
		P: k.on(oa("pop")),
		"1": k.on(oaCell("hiradai", 0)),
		"2": k.on(oaCell("hiradai", 1)),
		"3": k.on(oaCell("hiradai", 0)),
		"4": k.on(oaCell("hiradai", 1)),
		"[": ctr(k.on(base(1, 98))),
		R: ctr(k.on(oa("register"))),
		"]": ctr(k.on(base(3, 98))),
		q: k.on(ri("trash")),
	}),
	things: {
		a: "posterZero",
		b: "posterRino",
		c: "posterAru",
		d: "posterRen",
		C: "case",
		B: "shelf",
		T: "tapestry",
		G: "gacha",
		x: "figure",
		y: "figure",
		z: "figure",
		P: "pop",
		"1": "bookHoshu",
		"2": "bookZero",
		"3": "bookYakiu",
		"4": "bookPuyu",
		"[": "register",
		q: "trash",
		F: "plant",
	},
	lines: {
		posterZero: ["ポスター。\nゼロの新作。……目がキラキラ。"],
		posterRino: ["ポスター。\nリノと「本日の治安情報」。"],
		posterAru: ["ポスター。\nアルがこっちをじっと見ている。"],
		posterRen: ["ポスター。\n「レンはじめてのライブ」。"],
		case: ["フィギュアケース。\n……ガラスに指のあとがひとつ。"],
		shelf: ["同人誌の棚。\n薄い本がぎっしり。……健全です。"],
		tapestry: ["タペストリー。\n夏の限定版。……もう秋だ。"],
		gacha: ["ガチャガチャ。\n「アクスタ全4種1回500円」"],
		figure: ["フィギュアの見本。\n「レジにてお求めください」"],
		pop: ["手書きのPOP。\n「神降臨！新刊入荷」"],
		bookHoshu: [
			"新刊『保守』。\n……全ページ「保守」と書いてある。",
			"最後のページ「1000なら次回作」。\n……次も出るらしい。",
		],
		bookZero: [
			"新刊『収支合同誌』。\n……中身はほぼ家計簿だ。",
			"あとがき「今年は黒字でした」。\n……よかったね。",
		],
		bookYakiu: [
			"『ワイ、優勝の夢を見る』。\n開幕10連勝……で目がさめる。",
			"奥付「なお、現実」。\n……作者の気持ちがわかる。",
		],
		bookPuyu: [
			"『ぷゆゆ観察日記』。\n1日目「ぷゆ」2日目「ぷゆゆ」。",
			"最終日「ぷゆゆゆ」。\n……成長が見られる。",
		],
		register: [
			"レジ。\n「グッズはご自宅へ配送します」",
			"グッズは店員に声をかけて買う。",
		],
		trash: ["ごみ箱。\n……レシートと、ガチャの空カプセル。"],
		plant: ["鉢植え。\n……葉っぱにアクスタが1枚。"],
	},
	// ガチャを 回す（ui/village/otaku.ts）
	plays: { gacha: "otaku" },
	people: [
		{
			id: "otaku_clerk",
			walk: NANASHI[3],
			at: [9, 6],
			dir: "down",
			name: "店員",
			// レジの 店員に 話して グッズを 買う（ui/village/otaku.ts）
			play: "otaku",
			lines: [
				"いらっしゃいませー。\n新刊、入っとります",
				"フィギュアはお家に飾れますよ。\n……ホコリにはお気をつけて",
			],
		},
		{
			id: "otaku_a",
			walk: NANASHI[0],
			at: [7, 6],
			dir: "up",
			name: "名無し",
			lines: ["新刊落ちたと思ったら\n委託で出とった。……神降臨や"],
		},
		{
			id: "otaku_b",
			walk: NANASHI[2],
			at: [1, 4],
			dir: "up",
			name: "名無し",
			lines: ["アクスタ4種……\nレンだけ出えへん"],
		},
	],
};

// ───────────────── 施設 ─────────────────

export const OTAKU_FACILITIES: readonly Facility[] = [
	// ── ヲタショップ「神降臨」（段7〜。盛り場の 劇場と カジノの あいだの 空き地。前は 南の 通り）
	{
		id: "otaku",
		name: "ヲタショップ「神降臨」",
		from: 7,
		at: [64, 36],
		// 灰色の 屋根・だいだいの 看板の 帯・ポスターの 窓・ガラスの 店先・自動ドア
		look: {
			kind: "grid",
			rows: ["aaaaa", "SUVWX", "pqwqp", "cdefg", "hhDhh"],
			door: "D",
			keys: {
				a: [base(5, 82)],
				S: [base(1, 59), oaCell("sign", 0)],
				U: [base(1, 59), oaCell("sign", 1)],
				V: [base(1, 59), oaCell("sign", 2)],
				W: [base(1, 59), oaCell("sign", 3)],
				X: [base(1, 59), oaCell("sign", 4)],
				p: [base(1, 59), oa("winZero")],
				q: [base(1, 59), oa("winAru")],
				w: [base(1, 59)],
				c: [base(1, 59), art("shopGlass", 0)],
				d: [base(1, 59), art("shopGlass", 1)],
				e: [base(1, 59), art("autoDoor")],
				f: [base(1, 59), art("shopGlass", 1)],
				g: [base(1, 59), art("shopGlass", 2)],
				h: [base(1, 60)],
				D: [base(1, 60), art("autoDoor", 0, 1)],
			},
		},
		door: "ヲタショップ「神降臨」。\n……新刊のポスターがずらり。",
		doorSe: "autoDoor",
		room: OTAKU_ROOM,
		outdoor: [
			{
				id: "window",
				at: [65, 40],
				lines: [
					"ガラスごしにフィギュアが見える。\n……だれかがずっと見とれている。",
				],
			},
			{
				id: "pop",
				at: [67, 40],
				lines: ["はり紙。\n「グッズご自宅まで配送します」"],
			},
		],
	},
];
