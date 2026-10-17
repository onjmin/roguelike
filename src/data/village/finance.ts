// おんJ証券 商店街支店と ネットカフェ「ROM専」（2026-10-15 作者：「デイトレ・株・FX って ATM で やるような もの？」
// →「本物っぽく するなら 証券口座の 開設から」）。
// - 支店（段4〜。東の 商店街、町の 通りの 南の 並びの 東の はし）：窓口で 口座を 作り、入金・出金。端末で 売り買い。壁の 電光の 株価ボード。
// - おんJ銀行（段5〜。東の 商店街の 南、銭湯の 東）：窓口で 定期預金と 家の ローンの 繰り上げ返済（data/trade/bank.ts）。
// - ネットカフェ（段5〜。広場の 南、前は 浜）：ブースの パソコンで ネットと トレード
//   （村に いる あいだ 1回 NETCAFE_YEN。家の パソコンが なくても 売り買い できる 所）。
// おんJマートの ATM は 入金・出金だけ。口座と 売り買いの 決まりは data/trade/trade.ts・ui/trade/trade.ts。
// 名前は 2ch の「ROM専」（書きこまず 読むだけの 人）。実在の 店の 名前は 使わない。
// ここからは facilities.ts の 値を 読まない（facilities.ts が ここを 読む）。

import type { TileDef } from "../../engine/defs";
import type { Facility, FacilityRoom, RoomKit } from "./facilities";
import { art, ri, riCell } from "./rpgenArt";
import { base, onUpper, RECEPTION } from "./tiles";

/** ネットカフェの 1回の 料金（円。村に いる あいだ 出入り 自由）。 */
export const NETCAFE_YEN = 200;

/** ネットカフェの ブースの 文（{price} 料金）。 */
export const NETCAFE_MSG = {
	ask: "「ブースは1回　{price}です。\nフリードリンクつき」",
	askMenu: ["払う　{price}", "やめる"],
	paid: "ブースに入った。\n……となりからいびきが聞こえる。",
	menu: ["ネット", "トレード", "やめる"],
} as const;

/** 名無し（本館の 中の 人と 同じ 絵）。 */
const NANASHI = ["sa:xjuotB", "sa:qPN3cT", "sa:C2hS8U", "sa:VaBXqn"] as const;
/** 台（台ごしに 向こうの 人と 話せる。人の となりの 台には 調べる 物を 置かない）。 */
const ctr = <T extends object>(t: T) => ({ ...t, counter: true });
/** 事務の 机（3x2）の col 列目。pc なら 天板に パソコン。 */
const desk = (k: RoomKit, col: number, pc: boolean): TileDef =>
	pc
		? onUpper(k.on(ri("deskDark", col)), ri("pcTop"))
		: k.on(ri("deskDark", col));
/** 受付の 台（左はし・まんなか・右はし）。 */
const reception = (k: RoomKit): Record<string, TileDef> => ({
	"[": ctr(k.on(RECEPTION[0])),
	"=": ctr(k.on(RECEPTION[1])),
	"]": ctr(k.on(RECEPTION[2])),
});

// ───────────────── 商店街支店 ─────────────────

// 灰色の 床と 白い 壁。奥の 壁に 電光の 株価ボード、左に 窓口（台の うしろに 係）、右に 端末 3台（手前に いす）、
// 左の 手前に 待合の ソファ、入口の 右に パンフレットの 立て札（はじめての 人への 説明）、右の 手前に 観葉植物と ごみ箱
const SHOKEN_ROOM: FacilityRoom = {
	look: {
		floor: ri("flGrey"),
		floorColor: "#c8cad0",
		up: base(0, 507),
		low: base(0, 508),
		wallColor: "#e8e8e4",
	},
	rows: [
		"############",
		"#HHHHHHHHHH#",
		"#hhh1234hmh#",
		"#f.........#",
		"#[==]...tuv#",
		"#.......ccc#",
		"#sr........#",
		"#SR...p..Fq#",
		"####DD######",
	],
	tiles: (k) => ({
		p: k.on(ri("standSign")),
		"1": k.low(art("led")),
		"2": k.low(art("led", 1)),
		"3": k.low(art("led", 2)),
		"4": k.low(art("led", 3)),
		f: k.on(ri("bonsai")),
		...reception(k),
		// 端末 3台：事務の 机の 天板に パソコンを 1台ずつ
		t: desk(k, 0, true),
		u: desk(k, 1, true),
		v: desk(k, 2, true),
		c: k.floor(ri("chairDarkUp")),
		// 待合の 白い ソファ（2x2）
		s: k.on(riCell("sofaWhite", 0, 0)),
		r: k.on(riCell("sofaWhite", 1, 0)),
		S: k.on(riCell("sofaWhite", 0, 1)),
		R: k.on(riCell("sofaWhite", 1, 1)),
		q: k.on(ri("trash")),
	}),
	things: {
		"1": "board",
		"2": "board",
		"3": "board",
		"4": "board",
		m: "notice",
		f: "plant",
		"[": "window",
		"]": "window",
		t: "terminal",
		u: "terminal",
		v: "terminal",
		s: "sofa",
		r: "sofa",
		F: "plant",
		q: "trash",
		p: "guide",
	},
	lines: {
		guide: ["パンフレットの立て札。\n「はじめてのおんJ証券」"],
		board: ["電光の株価ボード。\n数字がちかちか流れている。"],
		notice: ["はり紙。\n「投資は余裕資金で」"],
		plant: ["観葉植物。\n……葉っぱが右肩あがりにのびている。"],
		window: ["窓口。\n「口座開設・入金・出金」の札。"],
		terminal: ["お客さま用の端末。\n「ご自由にお使いください」"],
		sofa: ["待合のソファ。\n……株価ボードがよく見える。"],
		trash: ["ごみ箱。\n……くしゃくしゃの取引報告書。"],
	},
	// 窓口：口座の 開設・入金・出金。端末：株・デイトレ・FX。ボード：いまの 株価。
	// パンフ：口座・株・デイトレ・FX の 説明（ui/trade/trade.ts）
	plays: {
		window: "shoken",
		terminal: "trade",
		board: "stockboard",
		guide: "tradeguide",
	},
	people: [
		{
			id: "shoken_clerk",
			walk: NANASHI[3],
			at: [2, 3],
			dir: "down",
			name: "係",
			lines: [
				"口座の開設・入金・出金は\nとなりの窓口へどうぞ",
				"株価はお客さまが冒険から\n帰るたびに動きます",
			],
		},
		{
			id: "shoken_a",
			walk: NANASHI[0],
			at: [6, 5],
			dir: "up",
			name: "名無し",
			lines: ["保守電、ずっと塩漬けや。\n……漬けすぎてもう漬物や"],
		},
		{
			id: "shoken_b",
			walk: NANASHI[2],
			at: [9, 6],
			dir: "up",
			name: "名無し",
			lines: ["ワイが買うと下がる。\nワイが売ると上がる。……なんでや"],
		},
	],
};

// ───────────────── おんJ銀行 ─────────────────

// 灰色の 床と 白い 壁。奥に 窓口の 長い 台（うしろに 行員と 金庫 2つ）、右の 壁ぎわに ATM と 番号札の 機械、
// 入口から 窓口まで 赤い じゅうたん、左の 手前に 待合の ソファ、右の 手前に 観葉植物と ごみ箱
const BANK_ROOM: FacilityRoom = {
	look: {
		floor: ri("flGrey"),
		floorColor: "#c8cad0",
		up: base(0, 507),
		low: base(0, 508),
		wallColor: "#e8e8e4",
	},
	rows: [
		"############",
		"#HHHHHHHHHH#",
		"#hhhhhhphmh#",
		"#$$.......a#",
		"#[====]...A#",
		"#...~~....k#",
		"#sr.~~.....#",
		"#SR.~~...Fq#",
		"####DD######",
	],
	tiles: (k) => ({
		p: k.low(ri("poster")),
		$: k.on(ri("safe")),
		a: k.on(riCell("atm", 0, 0)),
		A: k.on(riCell("atm", 0, 1)),
		k: k.on(ri("kiosk")),
		"~": k.floor(ri("runner")),
		...reception(k),
		s: k.on(riCell("sofaWhite", 0, 0)),
		r: k.on(riCell("sofaWhite", 1, 0)),
		S: k.on(riCell("sofaWhite", 0, 1)),
		R: k.on(riCell("sofaWhite", 1, 1)),
		F: k.on(ri("bonsai")),
		q: k.on(ri("trash")),
	}),
	things: {
		p: "poster",
		m: "notice",
		$: "safe",
		"[": "window",
		"]": "window",
		a: "atm",
		A: "atm",
		k: "ticket",
		s: "sofa",
		r: "sofa",
		F: "plant",
		q: "trash",
	},
	lines: {
		poster: ["ポスター。\n「保守も貯金もコツコツと」"],
		notice: [
			"はり紙。\n「振り込め詐欺にご注意ください」",
			"……「スレ立て代行の振込は\nお受けできません」ともある。",
		],
		safe: ["金庫。\n……ダイヤルが1000で止まっている。"],
		window: ["窓口。\n「定期預金・住宅ローン」の札。"],
		atm: ["ATM。\n「定期預金のお手続きは窓口へ」"],
		ticket: ["番号札の機械。\n……1001番。呼ばれる気配はない。"],
		sofa: ["待合のソファ。\n……テレビはずっと天気予報。"],
		plant: ["観葉植物。\n……鉢に「開店祝」の札。"],
		trash: ["ごみ箱。\n……くしゃくしゃの番号札。"],
	},
	// 窓口：定期預金と 家の ローン（ui/trade/bank.ts）
	plays: { window: "bank" },
	people: [
		{
			id: "bank_clerk",
			walk: NANASHI[2],
			at: [3, 3],
			dir: "down",
			name: "行員",
			lines: [
				"定期預金の利息は\n冒険からお帰りのたびにつきます",
				"番号札はお取りにならなくて\n大丈夫です。……いつもすいてますので",
			],
		},
		{
			id: "bank_a",
			walk: NANASHI[0],
			at: [8, 5],
			dir: "up",
			name: "名無し",
			lines: ["定期に入れとけば\n使わずに済むやろ。……たぶん"],
		},
		{
			id: "bank_guard",
			walk: NANASHI[3],
			at: [7, 7],
			dir: "down",
			name: "警備員",
			lines: ["……。", "……銀行強盗のスレは\n立てないでください"],
		},
	],
};

// ───────────────── ネットカフェ ─────────────────

// 赤い じゅうたんと 白い 壁。奥に 個室 4つ（仕切りの 壁と 入口。リクライニング 2つ・畳の フラット・ペアの パソコン 2台）と
// すみの シャワー室、まんなかに 漫画の 棚の 通路 3本と ドリンクバー（コーヒー・冷たい 飲み物・ソフトクリーム）、
// 入口の 正面に 受付（台の うしろに 店員）。個室は 机の パソコンを 調べると 払って ネットと トレード。
export const NETCAFE_ROOM: FacilityRoom = {
	look: {
		floor: ri("flCarpet"),
		floorColor: "#a8452f",
		up: base(0, 507),
		low: base(0, 508),
		wallColor: "#e8e8e4",
	},
	rows: [
		"################",
		"#HH#HH#HH#HH#HH#",
		"#hm#hh#hh#hh#Sh#",
		"#P.#P.#lf#PP#~U#",
		"#c.#c.#tt#cc#~~#",
		"#h.#h.#h.#h.#.##",
		"#..............#",
		"#KK.KK.KK..dE..#",
		"#kk.kk.kk..ie..#",
		"#..............#",
		"#......[==]..F.#",
		"#.............q#",
		"######DD########",
	],
	tiles: (k) => ({
		// 個室：机の 上の パソコンと、手前の いす（いすには 座れる）
		P: k.on(ri("tableBeige"), ri("pcTop")),
		c: k.floor(ri("chairDarkUp")),
		// フラット席：畳に ちゃぶ台の ノートパソコン
		l: k.on(ri("flTatami"), ri("laptop")),
		f: k.floor(ri("flTatami")),
		t: k.floor(ri("flTatami")),
		// シャワー室（タイルの 床・洗面台・壁の 札）
		S: k.low(ri("signRestroom")),
		"~": k.floor(ri("flBlue")),
		U: k.on(ri("flBlue"), ri("sink")),
		K: k.on(riCell("bookshelf", 0, 0)),
		k: k.on(riCell("bookshelf", 0, 1)),
		d: k.on(ri("podium"), ri("coffeeMaker")),
		E: k.on(riCell("drinkCase", 0, 0)),
		e: k.on(riCell("drinkCase", 0, 1)),
		i: k.on(ri("kakigoriMachine")),
		...reception(k),
		q: k.on(ri("trash")),
	}),
	things: {
		m: "notice",
		P: "booth",
		l: "booth",
		S: "shower",
		U: "shower",
		K: "manga",
		k: "manga",
		d: "drink",
		E: "cold",
		e: "cold",
		i: "softcream",
		"[": "reception",
		"]": "reception",
		F: "plant",
		q: "trash",
	},
	lines: {
		notice: ["はり紙。\n「完全個室鍵つきナイトパックあります」"],
		booth: ["個室のパソコン。\nリクライニングのいすがぎしっと鳴る。"],
		shower: ["シャワー室。\n「ご利用は30分まで」の札。"],
		manga: [
			"漫画の棚。\n長い連載が1巻からぜんぶ。",
			"……最新刊だけない。\nだれかが個室に持ちこんでいる。",
		],
		drink: ["フリードリンク。\nコーンスープのボタンがすりへっている。"],
		cold: ["冷たい飲み物のケース。\nメロンソーダだけすぐなくなる。"],
		softcream: ["ソフトクリームの機械。\n……巻くのがむずかしい。"],
		reception: ["受付。\n「個室は1回200円」"],
		plant: ["観葉植物。\n……ちょっとほこりっぽい。"],
		trash: ["ごみ箱。\n……カップ麺の容器でいっぱい。"],
	},
	// 個室の パソコン：払って ネットと トレード（ui/village/facilities.ts の netcafeBooth）
	plays: { booth: "netcafe" },
	people: [
		{
			id: "netcafe_clerk",
			walk: NANASHI[1],
			at: [8, 9],
			dir: "down",
			name: "店員",
			lines: [
				"いらっしゃいませー。\n個室は空いてますよ",
				"ここでスレ立ててもええけど\n……IPは店のやで",
			],
		},
		{
			id: "netcafe_a",
			walk: NANASHI[0],
			at: [4, 4],
			dir: "up",
			name: "名無し",
			lines: ["家の回線より速いんや。\n……家、ないけどな"],
		},
		{
			id: "netcafe_b",
			walk: NANASHI[2],
			at: [7, 4],
			dir: "down",
			name: "名無し",
			lines: ["……（寝息）", "……ナイトパック……延長……"],
		},
		{
			id: "netcafe_c",
			walk: NANASHI[3],
			at: [3, 8],
			dir: "left",
			name: "名無し",
			lines: ["この漫画、来るたびにつづきから\n読んどる。……もう3年や"],
		},
	],
};

// ───────────────── 施設 ─────────────────

/** ネットカフェの 左上（広場の 南。前は 浜。2026-10-15 道を ふさがない 所を 試験で えらんだ）。 */
const NETCAFE_AT = [26, 29] as const;

/** 平らな 屋根（コンクリートの 上。facilities.ts の ROOF_FLAT と 同じ 字）。 */
const ROOF: Record<string, readonly string[]> = {
	"(": [art("concrete"), art("roofFlat")],
	"-": [art("concrete"), art("roofFlat", 1)],
	"~": [art("concrete"), art("roofFlat", 1), base(3, 394)],
	")": [art("concrete"), art("roofFlat", 2)],
	"[": [art("concrete"), art("roofFlat", 0, 1)],
	"=": [art("concrete"), art("roofFlat", 1, 1)],
	"]": [art("concrete"), art("roofFlat", 2, 1)],
};

export const FINANCE_FACILITIES: readonly Facility[] = [
	// ── おんJ証券 商店街支店（段4〜。東の 商店街、町の 通りの 南の 並びの 東の はし）
	{
		id: "shoken",
		name: "おんJ証券商店街支店",
		from: 4,
		at: [60, 31],
		// 平らな 屋根・白い 壁・電光の 株価の 看板（横 4マス）・ガラスの 店先と 自動ドア
		look: {
			kind: "grid",
			rows: ["(-~)", "[==]", "1234", "aDbc"],
			door: "D",
			keys: {
				...ROOF,
				"1": [art("white", 0, 1), art("led")],
				"2": [art("white", 1, 1), art("led", 1)],
				"3": [art("white", 1, 1), art("led", 2)],
				"4": [art("white", 2, 1), art("led", 3)],
				a: [art("white", 0, 2), art("shopGlass", 0)],
				D: [art("white", 1, 2), art("autoDoor", 0, 1)],
				b: [art("white", 1, 2), art("shopGlass", 1)],
				c: [art("white", 2, 2), art("shopGlass", 2)],
			},
		},
		door: "おんJ証券商店街支店。\n株価の看板がちかちかしている。",
		doorSe: "autoDoor",
		room: SHOKEN_ROOM,
		outdoor: [
			{
				id: "ticker",
				at: [62, 34],
				lines: ["ガラスごしに株価のボード。\n……数字が右から左へ流れていく。"],
			},
		],
	},
	// ── おんJ銀行（段5〜。東の 商店街の 南。data/trade/bank.ts）
	{
		id: "bank",
		name: "おんJ銀行",
		from: 5,
		at: [70, 9],
		// 平らな 屋根の へり・灰色の 石・両はしに 白い 柱・アーチの 窓・両開きの 扉（どちらからも 入れる）
		look: {
			kind: "grid",
			rows: ["[====]", "PwssWP", "QxssXQ", "RsLDsR"],
			door: "D",
			door2: "L",
			keys: {
				...ROOF,
				s: [art("wallTex", 2)],
				P: [art("wallTex", 2), art("pillar")],
				Q: [art("wallTex", 2), art("pillar", 0, 1)],
				R: [art("wallTex", 2), art("pillar", 0, 2)],
				w: [art("wallTex", 2), art("archTall")],
				x: [art("wallTex", 2), art("archTall", 0, 1)],
				W: [art("wallTex", 2), art("archTall")],
				X: [art("wallTex", 2), art("archTall", 0, 1)],
				L: [art("wallTex", 2), base(2, 92, 1, 2)],
				D: [art("wallTex", 2), base(3, 92, 1, 2)],
			},
		},
		door: "おんJ銀行。\n扉の横にATMの灯り。",
		doorSe: "autoDoor",
		room: BANK_ROOM,
	},
	// ── ネットカフェ「ROM専」（段5〜。広場の 南。前は 浜）
	{
		id: "netcafe",
		name: "ネットカフェ「ROM専」",
		from: 5,
		at: NETCAFE_AT,
		// 平らな 屋根の へり（看板を かける）・灰色の 壁・電光の 看板・自動ドア（3段の 小さな 店）
		look: {
			kind: "grid",
			rows: ["[==]", "g12h", "iDIj"],
			door: "D",
			keys: {
				...ROOF,
				g: [art("gray"), art("win108", 2)],
				h: [art("gray", 2), art("win108", 2)],
				"1": [art("gray", 1), art("ledGray")],
				"2": [art("gray", 1), art("ledGray", 3)],
				i: [art("gray", 0, 1), art("pot", 2)],
				I: [art("gray", 1, 1), art("shopGlass", 1)],
				D: [art("gray", 1, 1), art("autoDoor", 0, 1)],
				j: [art("gray", 2, 1)],
			},
		},
		door: "ネットカフェ「ROM専」。\n……店の中はしずかだ。",
		doorSe: "autoDoor",
		room: NETCAFE_ROOM,
		outdoor: [
			{
				id: "sign",
				at: [NETCAFE_AT[0] + 2, NETCAFE_AT[1] + 2],
				lines: ["ガラスのはり紙。\n「ネット・漫画・シャワー24時間」"],
			},
		],
	},
];
