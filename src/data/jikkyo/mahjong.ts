// 保守リーグ（麻雀の プロリーグの 中継。ゲームセンター「連コ」の 壁の 大画面。PROGRAMS §1.6「役満・オーラス、長い partスレ」）。
// 4チームの 4人が 1半荘を 打つ。東1局の 先制（リーチか ダマか）→ リーチ合戦 → 北家が 押して 放銃（ロン　親満）→ 南場で
// ラス目に 沈む → オーラスの トップ争い（2着目の リーチに トップ目が 押すか オリるか）→ ラス目の 親が 四暗刻 単騎を
// テンパイし、ほかの 3人の 打牌（合図 3回）の あとの 4拍目に「ツモ」（Cue）。16000オールで ラスから トップへ → 最終の 着順と
// 勝利者インタビュー。
// - 長い part スレ：スレタイは「【実況】保守リーグ　part{p}」。p は 1月1日から 数えた 本番の 回で 高い 数から はじまる
//   （束の slot が 回を day に 入れる）。オーラスの あいだに 立つ 次スレは【オーラス】つき。
// - 番組の 動詞：卓を 見て 打ち手の 選び（リーチ／ダマ・押す／オリる）を 言いあてる（乱数で 分かれる）・ツモの 拍で 1語。
// - お金・賭けの 話は 出さない（点数の 話だけ）。チーム・選手は 架空（板の 語から）。実在の リーグ・チーム・団体の 名前は deny で 守る。
// - キリコが 書ける 文（候補・当番・山場の 1語）に「保守」「立てといた」「立てたる」「立てたで」を 入れない。
//   群衆・題・字幕・会場の 文の「保守」は 固有名詞（保守リーグ・チーム保守）の 中だけ。
// - 日：月曜と 木曜は 本番（★4）、ほかの 日は 再放送（★2。群衆に「再放送　乙」が まざる）。
// - 文の 幅：レス 12・候補 10・スレタイ・字幕・pin・絵の 字 22（全角）。試験は src/sim/jikkyoProgTests.ts。
// TV は ui/jikkyoMahjongTv.ts（場面の 鍵は MAHJONG_SCENES、絵に 出す 文は MAHJONG_ART）。

import type {
	JkFit,
	JkOpt,
	JkScript,
	JkScriptSeg,
	JkSlot,
} from "../../core/jikkyo";
import type { Today } from "../calendar";
import type { JkPack } from "./pack";

const o = (text: string, fit: JkFit, boo?: string): JkOpt =>
	boo ? { text, fit, boo } : { text, fit };
const B = (t: string) => o(t, "best");
const K = (t: string) => o(t, "ok");
const X = (t: string, boo?: string) => o(t, "miss", boo);

/** 場面の 鍵（札・選手紹介・卓・役満の 寄り・結果と インタビュー）。 */
export const MAHJONG_SCENES = [
	"card",
	"intro",
	"taku",
	"yakuman",
	"result",
] as const;

/** 牌（m 萬子・p 筒子・s 索子 1〜9、z 字牌 1〜7＝東南西北白發中）。 */
export type MjTile = string;

/** 場面の 小さな 中身（TV が 読む。at は 区切りの 頭からの 名目の ms、負なら 区切りの 前）。 */
export type MahjongData = {
	readonly phase?:
		| "soon"
		| "next"
		| "end"
		| "ton1"
		| "gassen"
		| "push"
		| "ron"
		| "nan"
		| "ooras"
		| "tenpai"
		| "cue"
		| "boom"
		| "result"
		| "iv";
	/** card の 文。 */
	readonly card?: string;
	readonly kyoku?: string;
	/** 親の 席（0〜3。席 0 が 起家）。 */
	readonly dealer?: number;
	/** 局の はじめの 点（席の 順。リーチは TV が 1000 ひく）。 */
	readonly scores?: readonly number[];
	/** ロンの あとの 点。 */
	readonly after?: readonly number[];
	/** 右の 手牌の 席と 手（13枚）と ツモ。 */
	readonly focus?: number;
	readonly hand?: readonly MjTile[];
	readonly draw?: MjTile;
	/** 卓の 捨て牌の 進み（区切りの 頭の 巡目）。 */
	readonly turn0?: number;
	readonly riichi?: readonly { readonly seat: number; readonly at: number }[];
	/** ダマの テンパイ（手が 光る）。 */
	readonly tenpai?: { readonly seat: number; readonly at: number };
	/** 打牌の 選び（idx は 手の 番。13 は ツモ。push＝無スジを 押す、false＝現物で オリる）。 */
	readonly cut?: {
		readonly at: number;
		readonly idx: number;
		readonly push: boolean;
	};
	readonly ron?: {
		readonly at: number;
		readonly from: number;
		readonly to: number;
		readonly pts: number;
	};
	/** ラス目の 席。 */
	readonly ras?: number;
	/** 山場の ちょうどの 名目の ms（役満の 寄り）。 */
	readonly exact?: number;
};

/** 打ち手（席の 順。名前・チームは 架空）。 */
export const MAHJONG_PLAYERS = [
	{ name: "age山", team: "age烈火", ink: "#e0483a" },
	{ name: "sage川", team: "sageドルフィンズ", ink: "#3a86e0" },
	{ name: "名無野", team: "名無しサクラ", ink: "#e888b8" },
	{ name: "埋田", team: "チーム保守", ink: "#4cc070" },
] as const;

/** 絵に 出す 文（どれも 全角 22字まで）。 */
export const MAHJONG_ART = {
	logo: "保守リーグ",
	soon: "まもなく　対局　開始",
	next: "次の　対局も　お楽しみに",
	end: "本日の　中継は　おわりました",
	riichi: "リーチ",
	ron: "ロン",
	tsumo: "ツモ",
	tenpai: "テンパイ",
	dama: "ダマ",
	danger: "無スジ",
	safe: "現物",
	ras: "ラス",
	oya: "親",
	yakuman: "役満",
	hand: "四暗刻　16000オール",
	result: "最終結果",
	iv: "勝利者　インタビュー",
	say: "応援　ありがとう",
	kyoku: ["東1局", "南2局", "南4局"],
	winds: ["東", "南", "西", "北"],
	seats: ["東家", "南家", "西家", "北家"],
	ranks: ["1位", "2位", "3位", "4位"],
} as const;

/** 局の 点（席の 順）。 */
const START = [25000, 25000, 25000, 25000] as const;
const NAN = [33000, 31000, 24000, 12000] as const;
/** 四暗刻 16000オール（リーチ棒 1本 つき）の あと。 */
export const MAHJONG_FINAL = [17000, 14000, 8000, 61000] as const;
/** 最終の 着順（1位 から 席）。 */
export const MAHJONG_RANK = [3, 0, 1, 2] as const;

/** 手（空白で 区切った 13枚）。 */
const hand = (s: string): readonly MjTile[] => s.split(" ");
/** 手（席 0 の 東1局・席 3 の 東1局と 南場・席 0 の オーラス・席 3 の 四暗刻 単騎）。 */
export const MAHJONG_HANDS = {
	ton1: hand("m2 m3 m4 m6 m7 m8 p5 p5 p6 p7 s3 s4 s5"),
	ume1: hand("m1 m1 m1 m5 p2 p9 p9 s5 s5 s7 z1 z1 z6"),
	nan: hand("m1 m1 m1 p9 p9 p9 s5 s5 s5 s7 s8 z1 z1"),
	ooras: hand("m2 m3 m4 p4 p5 p6 s6 s7 s8 z5 z5 m9 p1"),
	suuankou: hand("m1 m1 m1 p9 p9 p9 s5 s5 s5 z1 z1 z1 s7"),
} as const;
/** 四暗刻の ツモ（単騎の 待ち）。 */
export const MAHJONG_TSUMO = "s7";

/** 群衆の 文（手で 書いた 白い 一覧。レスは 全角 12字まで）。 */
export const MAHJONG_POOLS = {
	wait: [
		"31",
		"サンイチ",
		"たておつ",
		"待機",
		"はよ",
		"くるぞ…",
		"あと　5分",
		"今日も　見るで",
		"対局　まだ？",
		"卓　きれいや",
	],
	intro: [
		"きたあ",
		"待ってた",
		"ええ　面子",
		"かっこええ",
		"推し　きた",
		"緊張　するな",
		"はじまた",
		"今日の　面子",
		"がんばえー",
	],
	ton1: [
		"配牌　どうや",
		"親から　やな",
		"手が　重い",
		"字牌　多いな",
		"早そうや",
		"まっすぐや",
		"ドラ　どこや",
		"ええ　手や",
		"おお",
	],
	gassen: [
		"熱い",
		"こわ",
		"めくり合い",
		"一発　あるか",
		"待ち　どこや",
		"ひえっ",
		"胃が　痛い",
		"リーチ合戦",
		"どっちや",
	],
	push: [
		"あぶな",
		"押すんか",
		"攻めるなあ",
		"ひえっ",
		"無スジや",
		"通るか？",
		"こわい",
		"強気や",
		"胃が　痛い",
	],
	ron: [
		"痛い",
		"高い",
		"親満や",
		"あかん",
		"ひえっ",
		"放銃や",
		"ロン",
		"押した　結果や",
		"裏　乗った？",
	],
	nan: [
		"南場や",
		"ラス目　きつい",
		"まだ　わからん",
		"トップ目　かたい",
		"ここから　やで",
		"点差　ひらいた",
		"巻き返せ",
		"南場は　長い",
		"親　流れた",
	],
	ooras: [
		"オーラス",
		"トップ争い",
		"胃が　痛い",
		"条件　どうや",
		"熱い",
		"震える",
		"ここ　大事",
		"トップ目　こわ",
		"押すんか",
		"ベタオリ",
	],
	yaku: [
		"役満　くるぞ",
		"四暗刻？",
		"ひえっ",
		"まさか",
		"お前ら　レス止めろ！",
		"指　つった",
		"くるぞ…",
		"準備できた",
		"単騎や",
		"震える",
	],
	flood: [
		"ツモ",
		"ツモ！",
		"役満！",
		"ツモったあ",
		"四暗刻！",
		"うおおお",
		"ツモ",
	],
	after: [
		"役満や",
		"四暗刻や",
		"鳥肌",
		"鯖が　重い",
		"生きてる？",
		"おめでとう",
		"すごい",
		"逆転や",
		"伝説や",
		"親の　役満",
	],
	result: [
		"逆転トップ",
		"おめでとう",
		"8888",
		"ナイス　トップ",
		"何が　起きた",
		"すごい",
		"ええ　試合",
		"劇的や",
		"ラスから　トップ",
	],
	iv: [
		"泣ける",
		"ええ　話や",
		"8888",
		"おめでとう",
		"ええ　顔",
		"しびれた",
		"ナイス　トップ",
		"ありがとう",
	],
	next: ["たのしみ", "また　見るで", "次も　見る", "次は　だれや", "はよ　次"],
	hansei: [
		"反省会や",
		"乙",
		"ほな",
		"おやすみ",
		"解散",
		"ええ　試合やった",
		"また　見るで",
		"役満　見れた",
	],
	rerun: [
		"再放送　乙",
		"結果　知っとる",
		"何回　見ても　ええ",
		"ネタバレ　すんな",
		"この　回　すき",
	],
	gap: ["次スレ　どこ？", "乱立すな", "950ちうい", "誰か踏め"],
	open: ["31", "サンイチ", "たておつ", "スレ立て　乙"],
	boo: ["は？", "なんて？"],
	booStart: ["はじまった　ばっかや", "まだ　早い"],
	booEarly: ["まだ　早い", "は？"],
	booLate: ["もう　終わったで", "は？"],
	booTsumo: ["まだ　ツモって　ない", "気が　早い"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ　見とるんや"],
	/** 1000 の 流れの 予備（群衆の 区切りが ない とき）。 */
	nanashi: ["くるぞ…", "はよ"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句（{p} は part の 数）。 */
export const MAHJONG_THREAD = {
	live: "【実況】保守リーグ　part{p}",
	rerun: "【再放送】保守リーグ　part{p}",
	liveOoras: "【実況】保守リーグ　part{p}【オーラス】",
	rerunOoras: "【再放送】保守リーグ　part{p}【オーラス】",
	liveHansei: "【反省会】保守リーグ　part{p}",
	rerunHansei: "【再放送・反省会】保守リーグ　part{p}",
	get1000: "1000なら　次も　役満",
	praise: ">>{n}　神ツモ",
	crossGap: "次スレで　ツモ",
	crossFresh: "新スレで　ツモ　できた",
	tsumoPost: "埋田　四暗刻　16000オール",
	quit: "もう一度　Bで　出る",
} as const;

/** 山場の 1語（四暗刻 単騎の ツモ）。 */
export const MAHJONG_WORD = "ツモ";
/** 山場の 合図（ほかの 3人の 打牌）・拍・ちょうど（4拍目の ツモ。名目の ms）。 */
export const MAHJONG_CUE = { at: 84500, beat: 800, pulses: 3 } as const;
export const MAHJONG_EXACT =
	MAHJONG_CUE.at + MAHJONG_CUE.pulses * MAHJONG_CUE.beat;

// ───────────────── 日と part の 数 ─────────────────

/** 本番の 曜日（月曜・木曜）。 */
const LIVE_DAYS: readonly number[] = [1, 4];
const isLive = (t: Today): boolean => LIVE_DAYS.includes(t.w);
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** 1月1日から その 日までの 本番の 回（月曜と 木曜。その 日も 数える。再放送の 日は 前の 本番の 回）。 */
export const mahjongRound = (t: Today): number => {
	let doy = t.d;
	for (let m = 1; m < t.m; m++) doy += MONTH_DAYS[m - 1] ?? 30;
	let n = 0;
	for (let k = 0; k < doy; k++)
		if (LIVE_DAYS.includes((((t.w - k) % 7) + 7) % 7)) n++;
	return Math.max(1, n);
};

/** part の 数（本番 1回で 2つ ずつ のびる 長い スレ。1月の はじめでも part101 から、10月なら part260 あたり）。 */
const partOf = (n: number, slot: JkSlot): number =>
	98 + 2 * (slot.day ?? 1) + n;

const fillP = (s: string, n: number, slot: JkSlot) =>
	s.replace("{p}", String(partOf(n, slot)));

// ───────────────── 台本 ─────────────────

/** 台本（145秒。pick 13 ＋ Cue）。 */
const mahjongTimeline: JkScript["timeline"] = (rand, slot) => {
	const live = slot.live;
	const title = (k: "Ooras" | "Hansei") => (n: number, s: JkSlot) =>
		fillP(MAHJONG_THREAD[`${live ? "live" : "rerun"}${k}` as const], n, s);
	// 東1局の 親が 先制リーチか ダマか、オーラスの トップ目が 押すか オリるか（TV と ◎ が 分かれる）
	const reach = rand() < 0.5;
	const push = rand() < 0.5;
	const H = MAHJONG_HANDS;
	const K0 = MAHJONG_ART.kyoku;
	const before = -1;
	const riichi1 = reach
		? [
				{ seat: 0, at: before },
				{ seat: 1, at: 2000 },
			]
		: [
				{ seat: 1, at: 500 },
				{ seat: 2, at: 2500 },
			];
	const riichiBefore = riichi1.map((r) => ({ ...r, at: before }));
	const dama = reach ? {} : { tenpai: { seat: 0, at: before } };
	const segments: JkScriptSeg[] = [
		{
			at: 0,
			scene: "card",
			pool: "wait",
			rate: 0.5,
			bgm: null,
			data: { phase: "soon", card: MAHJONG_ART.soon } satisfies MahjongData,
		},
		{
			at: 6000,
			scene: "intro",
			pool: "intro",
			rate: 1,
			bgm: "title",
			caption: "選手紹介",
		},
		{
			at: 16000,
			scene: "taku",
			pool: "ton1",
			rate: 1,
			bgm: "stone",
			caption: "東1局",
			data: {
				phase: "ton1",
				kyoku: K0[0],
				dealer: 0,
				scores: START,
				focus: 0,
				hand: H.ton1,
				draw: "z3",
				turn0: 0,
				...(reach
					? { riichi: [{ seat: 0, at: 3500 }] }
					: { tenpai: { seat: 0, at: 3500 } }),
			} satisfies MahjongData,
		},
		{
			at: 27000,
			scene: "taku",
			pool: "gassen",
			rate: 1.3,
			bgm: "tense",
			caption: "リーチ合戦",
			data: {
				phase: "gassen",
				kyoku: K0[0],
				dealer: 0,
				scores: START,
				focus: 3,
				hand: H.ume1,
				draw: "s8",
				turn0: 18,
				riichi: riichi1,
				...dama,
			} satisfies MahjongData,
		},
		{
			at: 36000,
			scene: "taku",
			pool: "push",
			rate: 1.3,
			caption: "押すか　オリるか",
			data: {
				phase: "push",
				kyoku: K0[0],
				dealer: 0,
				scores: START,
				focus: 3,
				hand: H.ume1,
				draw: "s8",
				turn0: 31,
				riichi: riichiBefore,
				cut: { at: 1500, idx: 13, push: true },
				...dama,
			} satisfies MahjongData,
		},
		{
			at: 44000,
			scene: "taku",
			pool: "ron",
			rate: 1.4,
			data: {
				phase: "ron",
				kyoku: K0[0],
				dealer: 0,
				scores: START,
				after: reach
					? [38000, 24000, 25000, 13000]
					: [39000, 24000, 24000, 13000],
				focus: 0,
				hand: H.ton1,
				draw: "p8",
				turn0: 43,
				riichi: riichiBefore,
				ron: { at: 2500, from: 3, to: 0, pts: 12000 },
				...dama,
			} satisfies MahjongData,
		},
		{
			at: 53000,
			scene: "taku",
			pool: "nan",
			rate: 1.1,
			bgm: "kumori",
			caption: "南場",
			data: {
				phase: "nan",
				kyoku: K0[1],
				dealer: 1,
				scores: NAN,
				focus: 3,
				hand: H.nan,
				draw: "m9",
				turn0: 6,
				tenpai: { seat: 3, at: 2500 },
				ras: 3,
			} satisfies MahjongData,
		},
		{
			at: 63000,
			scene: "taku",
			pool: "ooras",
			rate: 1.4,
			bgm: "tense",
			caption: "オーラス　トップ争い",
			title: { next: title("Ooras") },
			data: {
				phase: "ooras",
				kyoku: K0[2],
				dealer: 3,
				scores: NAN,
				focus: 0,
				hand: H.ooras,
				draw: "s2",
				turn0: 20,
				riichi: [{ seat: 1, at: 1500 }],
				cut: { at: 4500, idx: push ? 13 : 9, push },
				ras: 3,
			} satisfies MahjongData,
		},
		{
			at: 76000,
			scene: "yakuman",
			pool: "yaku",
			rate: 1.6,
			bgm: "fukyowa",
			caption: "四暗刻　単騎　テンパイ",
			data: { phase: "tenpai", exact: MAHJONG_EXACT } satisfies MahjongData,
		},
		{
			at: 83500,
			scene: "yakuman",
			pool: "yaku",
			rate: 3.5,
			bgm: null,
			data: { phase: "cue", exact: MAHJONG_EXACT } satisfies MahjongData,
		},
		{
			at: 88500,
			scene: "yakuman",
			pool: "after",
			rate: 1.2,
			bgm: "title",
			stall: 1500,
			posts: [
				{
					at: 2300,
					who: "nanashi",
					text: MAHJONG_THREAD.tsumoPost,
					pin: 3000,
				},
			],
			data: { phase: "boom", exact: MAHJONG_EXACT } satisfies MahjongData,
		},
		{
			at: 99000,
			scene: "result",
			pool: "result",
			rate: 1.1,
			bgm: "ending",
			title: { next: null },
			data: { phase: "result" } satisfies MahjongData,
		},
		{
			at: 112000,
			scene: "result",
			pool: "iv",
			rate: 1,
			data: { phase: "iv" } satisfies MahjongData,
		},
		{
			at: 122000,
			scene: "card",
			pool: "next",
			rate: 0.9,
			data: { phase: "next", card: MAHJONG_ART.next } satisfies MahjongData,
		},
		{
			at: 131000,
			scene: "card",
			pool: "hansei",
			rate: 0.7,
			title: { now: title("Hansei") },
			data: { phase: "end", card: MAHJONG_ART.end } satisfies MahjongData,
		},
	];
	const W = MAHJONG_WORD;
	return {
		segments,
		picks: [
			{
				at: 2000,
				boo: "booStart",
				sets: [
					[B("31"), K("はよ"), X(W, "booTsumo")],
					[B("待機"), K("くるぞ…"), X("おめでとう")],
					[B("あと　1分"), K("はよ"), X("逆転トップ")],
				],
			},
			{
				at: 11000,
				boo: "booStart",
				sets: [
					[B("きたあ"), K("待ってた"), X("乙")],
					[B("ええ　面子"), K("がんばえー"), X("ラス目　きつい")],
					[B("待ってた"), K("推し　きた"), X("親満や")],
				],
			},
			// 東1局：親の テンパイ。曲げて リーチか、だまって ダマか（TV を 見て 言う）
			{
				at: 21000,
				boo: "boo",
				sets: reach
					? [
							[B("先制リーチ"), K("はやいな"), X("ダマか")],
							[B("親リーチや"), K("こわ"), X("ベタオリ")],
						]
					: [
							[B("ダマか"), K("渋いな"), X("先制リーチ")],
							[B("ダマか"), K("リーチ　かけろ"), X("親リーチや")],
						],
			},
			// 追っかけ（リーチ 2本）
			{
				at: 31000,
				boo: "boo",
				sets: reach
					? [
							[B("追っかけや"), K("熱い"), X("ダマか")],
							[B("リーチ合戦"), K("めくり合い"), X("ベタオリ")],
						]
					: [
							[B("リーチ合戦"), K("熱い"), X("先制リーチ")],
							[B("追っかけや"), K("めくり合い"), X(W, "booTsumo")],
						],
			},
			// 北家が 2人の リーチに 無スジを 押す
			{
				at: 40000,
				boo: "boo",
				sets: [
					[B("押すんか"), K("強気や"), X("ベタオリ")],
					[B("押すんか"), K("あぶな"), X("リーチ　かけろ")],
					[B("押すんか"), K("通るか？"), X("ダマか")],
				],
			},
			// ロン（親満。押した 北家から）
			{
				at: 49000,
				boo: "boo",
				sets: [
					[B("痛い"), K("高い"), X(W, "booTsumo")],
					[B("親満や"), K("痛い"), X("押すんか")],
					[B("ロンや"), K("あかん"), X("役満　くるぞ")],
				],
			},
			// 南場：ラス目に 沈んだ 北家（テンパイは ダマ）
			{
				at: 58000,
				boo: "boo",
				sets: [
					[B("ラス目　きつい"), K("まだ　南場や"), X("逆転トップ")],
					[B("リーチ　かけろ"), K("ラス目　きつい"), X("ベタオリ")],
				],
			},
			// オーラス：2着目の リーチに トップ目が 押すか オリるか
			{
				at: 69000,
				boo: "boo",
				sets: push
					? [
							[B("押すんか"), K("強気や"), X("ベタオリ")],
							[B("押すんか"), K("トップ争い"), X("ダマか")],
						]
					: [
							[B("ベタオリ"), K("かたいな"), X("押すんか")],
							[B("ベタオリ"), K("トップ争い"), X("リーチ　かけろ")],
						],
			},
			// ラス目の 親が 四暗刻 単騎 テンパイ（ツモは まだ 早い）
			{
				at: 78500,
				boo: "booEarly",
				sets: [
					[B("役満　くるぞ"), K("四暗刻？"), X(W, "booTsumo")],
					[B("役満　くるぞ"), K("まさか"), X("ベタオリ")],
					[B("役満　くるぞ"), K("単騎や"), X("押すんか")],
				],
			},
			{
				at: 95000,
				boo: "booLate",
				sets: [
					[B("おめでとう"), K("鳥肌"), X("役満　くるぞ")],
					[B("サンキュー速記ニキ"), K("すごい"), X("ラス目　きつい")],
					[B("四暗刻や"), K("逆転や"), X(W)],
				],
			},
			// 最終結果：ラスから トップ
			{
				at: 105000,
				boo: "boo",
				sets: [
					[B("逆転トップ"), K("おめでとう"), X("ラス目　きつい")],
					[B("ナイス　トップ"), K("8888"), X("ベタオリ")],
					[B("ラスから　トップ"), K("すごい"), X("先制リーチ")],
				],
			},
			// 勝利者インタビュー
			{
				at: 116000,
				boo: "boo",
				sets: [
					[B("泣ける"), K("ええ　話や"), X("押すんか")],
					[B("8888"), K("おめでとう"), X("ダマか")],
					[B("ええ　話や"), K("泣ける"), X("親満や")],
				],
			},
			{
				at: 134000,
				boo: "boo",
				sets: [
					[B("乙"), K("反省会や"), X("先制リーチ")],
					[B("ほな"), K("解散"), X("待機")],
					[B("おやすみ"), K("役満　見れた"), X("31")],
				],
			},
		],
		cues: [
			{
				...MAHJONG_CUE,
				word: W,
				flood: "flood",
				praise: MAHJONG_THREAD.praise,
				cross: {
					gap: MAHJONG_THREAD.crossGap,
					fresh: MAHJONG_THREAD.crossFresh,
				},
			},
		],
	};
};

/** 保守リーグ（台本）。 */
export const MAHJONG: JkScript = {
	id: "mahjong",
	venue: "arcade",
	length: 145000,
	goal: { live: 4, rerun: 2 },
	pools: MAHJONG_POOLS,
	title: (n, slot) =>
		fillP(slot.live ? MAHJONG_THREAD.live : MAHJONG_THREAD.rerun, n, slot),
	at1000: () => MAHJONG_THREAD.get1000,
	open: "open",
	gapPool: "gap",
	duty: {
		pin: "950ちうい",
		first: [B("立ててくる"), K("誰か踏め"), X("ksk")],
		variants: [
			{
				pin: "スレ立て　規制中です",
				opts: [B("誰か　頼む"), K("誰か踏め"), X("立ててくる")],
			},
			{
				pin: "次スレ　できたで",
				opts: [B("たておつ"), K("乙"), X("立ててくる")],
			},
			{
				pin: "次スレが　2つ　あるぞ",
				opts: [B("誘導　しとく"), K("どっちや"), X("両方に　書く")],
			},
		],
	},
	replies: {
		best: { pool: "reply:best", n: [1, 2] },
		ok: { pool: "reply:ok", n: [1, 1] },
		miss: { pool: "reply:miss", n: [1, 1] },
	},
	echoN: [1, 2],
	extra: [{ pool: "rerun", p: 0.15, when: (slot: JkSlot) => !slot.live }],
	quitNote: MAHJONG_THREAD.quit,
	// 帯（sora と 同じ はば。P4 の 種で 回した）：本番 上手 77%・初心者 28%、再放送 77%・26%
	// （見るだけ 0.57G・神 1.35〜1.4G・random 1% まで）。初心者の 完走は sora と 同じく 帯の 下の 端に 近い。
	tune: { post: 0.11, boost: 3, comboMin: 20 },
	bands: {
		p50: { miru: [0.52, 0.6], kami: [1.08, 99] },
		kanso: { jouzu: [0.65, 0.8], shoshin: [0.25, 0.45], random: [0, 0.099] },
	},
	timeline: mahjongTimeline,
};

// ───────────────── 束 ─────────────────

const liveLine = (lines: readonly string[]) => [{ when: isLive, lines }];

/** 保守リーグ（麻雀）。 */
export const MAHJONG_PACK: JkPack = {
	script: MAHJONG,
	venue: "arcade",
	from: 6,
	menu: "保守リーグ",
	slot: (t) => ({ live: isLive(t), day: mahjongRound(t) }),
	scenes: MAHJONG_SCENES,
	// 壁の 大画面は 新作発表会（水曜）と 分けあう：本番の 日（月曜・木曜）だけ 書く
	venueLines: {
		tv: liveLine(["壁の　大画面。\n今夜は　保守リーグの　中継。"]),
	},
	staffLines: {
		arcade_a: liveLine([
			"今夜は　保守リーグの　中継や。\n……格ゲーは　そのあとや",
		]),
		arcade_b: liveLine(["大画面で　麻雀の　中継や。\n……役満、出えへんかなあ"]),
	},
	staffOnce: {
		arcade_b: {
			kami: "この前の　ツモ、\nぴったり　やったな",
			rerun: "この前は　★{n}まで　のびたな。\n月曜と　木曜は　本番やで",
		},
	},
	msgs: {
		seat: "キリコは　大画面の　前に　立った。\n……スマホで、実況スレを　ひらく。",
		over: "対局が　おわった。\n実況は　★{n}まで　のびた。",
		kami: "あの「ツモ」は、\nぴったりの　一瞬だった。",
		left: "……対局の　とちゅうで、\nそっと　大画面を　はなれた。",
	},
	art: [
		...Object.values(MAHJONG_ART).flatMap((v) =>
			typeof v === "string" ? [v] : [...v],
		),
		...MAHJONG_PLAYERS.flatMap((p) => [p.name, p.team]),
	],
	deny: [
		"Mリーグ",
		"ABEMA",
		"ドリブンズ",
		"雷電",
		"フェニックス",
		"サクラナイツ",
		"風林火山",
		"パイレーツ",
		"Pirates",
		"ビーストX",
		"BEAST",
		"麻雀格闘倶楽部",
		"日本プロ麻雀連盟",
		"最高位戦",
		"雀魂",
		"天鳳",
	],
	names: ["保守リーグ", "チーム保守"],
};
