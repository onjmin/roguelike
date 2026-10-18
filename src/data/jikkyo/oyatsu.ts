// おんJ名人戦　おやつ実況（碁会所「本因坊」の 壁の テレビ。将棋の タイトル戦の 中継。PROGRAMS §1.6「昼食の 注文だけで 1000」）。
// 2日制の 対局を 2分半に まとめた 中継：対局開始 → 長考（群衆は 盤より 昼めしの 予想）→ 昼食の 注文の 発表 →
// 昼食休憩（盤だけ 映る）→ 午後 → 3時の おやつ → 封じ手（1日目 おわり）→ 2日目の 終盤 → 投了「ありません」→ 感想戦。
// - 芯：勝負めし・おやつの 発表に 反応する 実況。
//   山場 1（pick）：記録係が 運ぶ お盆の 布が 下から めくれて いく あいだに、昼めしを 当てる（札が 出る 前）。
//   山場 2（Cue）：柱時計が 3つ 鳴って、4拍目に「おやつ」。札が 出たら、前局と 同じ 品なら「またそれ　頼むんか」、
//   はじめての 品なら「ええ　チョイス」（札の 判で 読む）。終盤は 評価値の 札が かたむく 先を 言いきる（7割は はじめから、
//   3割は 逆転）。Cue の あとの 名前欄は「おやつ＠一番乗り」など。
// - 品は 村の 店の もの（麺屋「乙」・海の家「age」・おんJマート・喫茶「おんJ」）。棋士は 架空（名無し八段・千レス名人）。
//   盤面は 評価値の 数字と 塗りの 駒だけで、本物の 棋譜は 写さない。実在の 棋士・棋戦・団体・配信の 名前は 使わない（deny）。
// - 土日は 本番（★4）、ほかの 日は 再放送（★2。群衆に「再放送　乙」が まざる）。中身は 曜日で 閉じない。
// - キリコが 書ける 文（候補・当番・山場の 1語）には「保守」「立てといた」「立てたる」「立てたで」を 入れない。
//   群衆・題・字幕の「保守」は 固有名詞（おんJ名人戦・喫茶「おんJ」）の 中だけ。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyo/jikkyoOyatsuTv.ts。

import type {
	JkCueGrade,
	JkFit,
	JkOpt,
	JkScript,
	JkScriptSeg,
	JkSlot,
} from "../../core/jikkyo";
import { type JkPack, liveOr, onWeekdays } from "./pack";

const o = (text: string, fit: JkFit, boo?: string): JkOpt =>
	boo ? { text, fit, boo } : { text, fit };
const B = (t: string) => o(t, "best");
const K = (t: string) => o(t, "ok");
const X = (t: string, boo?: string) => o(t, "miss", boo);

/** 場面の 鍵（TV が 描く）。 */
export const OYATSU_SCENES = [
	"card",
	"kaikyoku",
	"choko",
	"hiru",
	"kyukei",
	"oyatsu",
	"fuji",
	"shuban",
	"toryo",
	"kansou",
] as const;
export type OyatsuScene = (typeof OYATSU_SCENES)[number];

/** 品（昼めし 3つ・おやつ 3つ。どれも 村の 店）。say は 当てる 1語、ok は 札の あとの ○。 */
export const OYATSU_FOOD = {
	ramen: {
		name: "ラーメン",
		shop: "麺屋「乙」",
		say: "ラーメンや",
		ok: "すすりたい",
	},
	yakisoba: {
		name: "焼きそば",
		shop: "海の家「age」",
		say: "焼きそばや",
		ok: "ソースのにおい",
	},
	onigiri: {
		name: "おにぎり",
		shop: "おんJマート",
		say: "おにぎりや",
		ok: "しぶい",
	},
	cake: {
		name: "ケーキ",
		shop: "喫茶「おんJ」",
		say: "ケーキや",
		ok: "あまそう",
	},
	kakigori: {
		name: "かき氷",
		shop: "海の家「age」",
		say: "かき氷や",
		ok: "つめたそう",
	},
	nikuman: {
		name: "肉まん",
		shop: "おんJマート",
		say: "肉まんや",
		ok: "ほかほかや",
	},
} as const;
export type OyatsuFood = keyof typeof OYATSU_FOOD;

const LUNCH: readonly OyatsuFood[] = ["ramen", "yakisoba", "onigiri"];
const SNACK: readonly OyatsuFood[] = ["cake", "kakigori", "nikuman"];

/** 勝つ 側（先手＝名無し八段、後手＝千レス名人）。 */
export type OyatsuSide = "sen" | "go";

/** 場面の 小さな 中身（TV が 読む）。時刻は どれも 番組の 頭からの 名目の ms。 */
export type OyatsuData = {
	/** card：まもなく・おわり／oyatsu：3時の 前・合図・札。 */
	readonly phase?: "soon" | "end" | "pre" | "cue" | "show";
	/** card の 文。 */
	readonly card?: string;
	/** 札の 品と、前局と 同じ 品か。 */
	readonly item?: OyatsuFood;
	readonly same?: boolean;
	/** hiru：お盆の 布が めくれはじめる 時（窓が 開く 時）と 札が 出る 時。 */
	readonly pickAt?: number;
	readonly showAt?: number;
	/** oyatsu：4拍目（ちょうど）。 */
	readonly exact?: number;
	/** choko：評価値（先手の ％）の はじめと おわり。 */
	readonly ev?: readonly [number, number];
	/** shuban：勝つ 側と、窓の はじめから かたむくか（false は いったん 逆へ ふれてから）。 */
	readonly winner?: OyatsuSide;
	readonly lean?: boolean;
	/** toryo・kansou：勝つ 側。 */
	readonly side?: OyatsuSide;
};

/** 絵に 出す 文（どれも 全角 22字まで）。 */
export const OYATSU_ART = {
	logo: "おんJ名人戦",
	sub: "おやつ実況",
	soon: "まもなく対局開始",
	end: "本日の中継はおわりました",
	sen: "名無し八段",
	go: "千レス名人",
	senShort: "八段",
	goShort: "名人",
	hyoka: "評価値",
	nokori: "残り",
	choko: "長考中",
	byoyomi: "秒読み",
	lunch: "昼食の注文",
	snack: "おやつ",
	same: "前局と同じ",
	fresh: "はじめての品",
	kyukei: "昼食休憩中",
	bon: "ボーン",
	fu: "封",
	arimasen: "……ありません",
	chukei: "中継",
} as const;

/** 群衆の 文（手で 書いた 白い 一覧。レスは 全角 12字まで）。 */
export const OYATSU_POOLS = {
	wait: [
		"31",
		"サンイチ",
		"たておつ",
		"待機",
		"はよ",
		"あと5分",
		"おやつ部集合",
		"将棋わからん",
		"今日のおやつは",
		"正座して待つ",
	],
	kaishi: [
		"はじまた",
		"お願いします",
		"礼きれい",
		"振り駒や",
		"和服ええな",
		"空気ピリピリ",
		"正座つらそう",
		"きたきた",
		"盤ええな",
	],
	choko: [
		"長考入った",
		"動かん",
		"静止画か",
		"時計見とる",
		"形勢わからん",
		"AI　何％や",
		"昼なに頼むやろ",
		"ラーメンに1票",
		"腹へった",
		"将棋わからん",
		"互角や",
	],
	hiru: [
		"きたきた",
		"発表はよ",
		"これを待っとった",
		"本番や",
		"腹へった",
		"なに頼んだんや",
		"わくわく",
		"布はよとって",
		"記録係ええ人",
	],
	meshiSame: [
		"またそれ頼むんか",
		"知ってた",
		"いつものやつ",
		"ブレへんな",
		"うまそう",
		"飯テロ",
		"ワイもそれ",
		"勝負めしや",
		"大盛りか？",
	],
	meshiNew: [
		"ええチョイス",
		"攻めとる",
		"はじめて見た",
		"意外や",
		"うまそう",
		"飯テロ",
		"ワイもそれ",
		"勝負めしや",
		"大盛りか？",
	],
	kyukei: [
		"盤しか映らん",
		"誰もおらん",
		"静止画や",
		"休憩中",
		"腹へった",
		"ワイも昼めし",
		"盤ええな",
		"見とるで",
		"放送事故か",
	],
	gogo: [
		"再開や",
		"おやつなにやろ",
		"ケーキに1票",
		"かき氷ありそう",
		"肉まんやろ",
		"長考入った",
		"形勢わからん",
		"AI　何％や",
		"3時まだか",
		"眠い",
	],
	oyatsuPre: [
		"くるぞ…",
		"時計見とる",
		"準備できた",
		"そわそわ",
		"お前ら静かに",
		"3時まだか",
		"指スタンバイ",
		"息止めた",
	],
	// 3時の 洪水（ほかの pool と 文を 重ねない：洪水の 行は 直近の くりかえしに 数えないので）
	flood: [
		"おやつ",
		"おやつ！",
		"おやつきた",
		"3時や！",
		"はやすぎ",
		"おそかった",
	],
	oyatsuSame: [
		"またそれ頼むんか",
		"知ってた",
		"いつものやつ",
		"ブレへんな",
		"うまそう",
		"ワイも食いたい",
		"甘いもんええな",
		"3時はこれや",
		"頭使うからな",
	],
	oyatsuNew: [
		"ええチョイス",
		"攻めとる",
		"はじめて見た",
		"意外や",
		"うまそう",
		"ワイも食いたい",
		"甘いもんええな",
		"3時はこれや",
		"頭使うからな",
	],
	fuji: [
		"封じ手や",
		"明日はよ",
		"封筒きた",
		"1日目乙",
		"どっちが封じた？",
		"続きは明日",
		"金庫ごと運ぶな",
		"なに書いたんや",
		"封筒が成層圏",
		"ロケット出たぞ",
	],
	shuban: [
		"秒読みや",
		"形勢わからん",
		"AI　何％や",
		"ひえっ",
		"手がふるえとる",
		"逆転あるで",
		"息止めた",
		"はやい",
		"封筒が帰還した",
		"ドキドキ",
	],
	toryo: [
		"ありません",
		"終わった",
		"投了や",
		"頭下げた",
		"おつかれ",
		"ええ勝負やった",
		"しびれた",
		"8888",
	],
	kansou: [
		"感想戦や",
		"なかよし",
		"笑っとる",
		"ここちゃうか",
		"おつかれ",
		"すごかった",
		"勉強になる",
		"8888",
	],
	hansei: [
		"乙",
		"おやすみ",
		"ほな",
		"解散",
		"来週も見るで",
		"おやつうまそうやった",
		"おつかれ",
		"腹へった",
	],
	rerun: ["再放送乙", "結果知っとる", "おやつだけ見に来た", "何回見てもええ"],
	atari: ["当たりや", "エスパーか", "読んどる", "さすが"],
	yomi: ["読んどる", "さすが", "せやろな"],
	gap: ["次スレどこ？", "乱立すな", "950ちうい", "誰か踏め"],
	open: ["31", "サンイチ", "たておつ", "スレ立て乙"],
	boo: ["は？", "なんて？"],
	booStart: ["はじまったばっかや", "まだ早い"],
	booEarly: ["まだ昼前や", "気が早い"],
	booMeshi: ["ちゃうで", "おしい", "残念"],
	booLate: ["おやつは昨日や", "は？"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ見とるんや"],
	/** 1000 の 流れの 予備（群衆の 区切りが ない とき）。 */
	nanashi: ["くるぞ…", "はよ"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句。 */
export const OYATSU_THREAD = {
	live: "【実況】おんJ名人戦おやつ部★{n}",
	rerun: "【再放送】おんJ名人戦おやつ部★{n}",
	live2: "【実況】おんJ名人戦2日目★{n}",
	rerun2: "【再放送】おんJ名人戦2日目★{n}",
	liveKansou: "【実況・感想戦】おんJ名人戦★{n}",
	rerunKansou: "【再放送・感想戦】おんJ名人戦★{n}",
	get1000: "1000ならおやつ2個",
	praise: ">>{n}　3時ぴったり",
	crossGap: "次スレでおやつ",
	crossFresh: "新スレでおやつ！",
	quit: "もう一度Bで出る",
	/** 投了の あとの 結果（システムの 書きこみ）。 */
	result: { go: "千レス名人防衛", sen: "名無し八段名人奪取" },
} as const;

/** 札の あとの 返し（前局と 同じ 品／はじめての 品）。 */
const SAME = "またそれ頼むんか";
const FRESH = "ええチョイス";

/** 終盤の 言いきり（勝つ 側が ◎、負ける 側が ×）。 */
export const OYATSU_SAY: Readonly<Record<OyatsuSide, string>> = {
	sen: "八段勝ちや",
	go: "名人勝ちや",
};

/** 山場の 1語（柱時計の 3つの 鐘の 次の 拍）。 */
export const OYATSU_WORD = "おやつ";

/** Cue の あとの キリコの 名前欄。 */
export const OYATSU_NAMES: Readonly<Record<JkCueGrade, string>> = {
	kami: "おやつ＠一番乗り",
	oshii: "おやつ＠二番手",
	late: "おやつ＠のこり物",
	flying: "まだ2時や",
	none: "おやつ＠見てた",
};

/** 山場の 合図（1つめ）・拍。ちょうどが 3時。 */
export const OYATSU_CUE = { at: 80000, beat: 900, pulses: 3 } as const;
export const OYATSU_EXACT = OYATSU_CUE.at + OYATSU_CUE.pulses * OYATSU_CUE.beat;

/** 昼めしの 窓（布が めくれはじめる）と 札。 */
const HIRU_PICK = 38500;
const HIRU_SHOW = 43500;
/** 終盤の 窓（評価値が かたむきはじめる）。 */
const SHUBAN_PICK = 112000;

const fillN = (s: string, n: number) => s.replace("{n}", String(n));

/** 台本（148秒。pick 13 ＋ Cue）。 */
const oyatsuTimeline: JkScript["timeline"] = (rand, slot) => {
	const live = slot.live;
	const lunch = LUNCH[Math.floor(rand() * LUNCH.length)];
	const lunchSame = rand() < 0.6;
	const snack = SNACK[Math.floor(rand() * SNACK.length)];
	const snackSame = rand() < 0.5;
	const winner: OyatsuSide = rand() < 0.5 ? "sen" : "go";
	const loser: OyatsuSide = winner === "sen" ? "go" : "sen";
	const lean = rand() < 0.7;
	const [o1, o2] = LUNCH.filter((k) => k !== lunch);
	const L = OYATSU_FOOD[lunch];
	const S = OYATSU_FOOD[snack];
	const react = (same: boolean, ok: string, x: string) => [
		[B(same ? SAME : FRESH), K(ok), X(same ? FRESH : SAME)],
		[B(same ? SAME : FRESH), K("うまそう"), X(x)],
	];
	const segments: JkScriptSeg[] = [
		{
			at: 0,
			scene: "card",
			pool: "wait",
			rate: 0.5,
			bgm: null,
			data: { phase: "soon", card: OYATSU_ART.soon } satisfies OyatsuData,
		},
		{
			at: 6000,
			scene: "kaikyoku",
			pool: "kaishi",
			rate: 1,
			bgm: "white",
			caption: "1日目対局開始",
		},
		{
			at: 17000,
			scene: "choko",
			pool: "choko",
			rate: 1,
			bgm: "kumori",
			caption: "名人長考",
			data: { ev: [52, 49] } satisfies OyatsuData,
		},
		{
			at: 34000,
			scene: "hiru",
			pool: "hiru",
			rate: 1.4,
			bgm: "town",
			caption: OYATSU_ART.lunch,
			data: {
				item: lunch,
				same: lunchSame,
				pickAt: HIRU_PICK,
				showAt: HIRU_SHOW,
			} satisfies OyatsuData,
		},
		{
			at: HIRU_SHOW,
			scene: "hiru",
			pool: lunchSame ? "meshiSame" : "meshiNew",
			rate: 1.3,
			caption: `勝負めしは${L.name}`,
			data: {
				item: lunch,
				same: lunchSame,
				pickAt: HIRU_PICK,
				showAt: HIRU_SHOW,
			} satisfies OyatsuData,
		},
		{
			at: 51500,
			scene: "kyukei",
			pool: "kyukei",
			rate: 0.8,
			bgm: "retro",
			caption: "昼食休憩",
		},
		{
			at: 62000,
			scene: "choko",
			pool: "gogo",
			rate: 1.1,
			bgm: "kumori",
			caption: "午後の対局再開",
			data: { ev: [49, 56] } satisfies OyatsuData,
		},
		{
			at: 74000,
			scene: "oyatsu",
			pool: "oyatsuPre",
			rate: 1.5,
			bgm: "tense",
			caption: "まもなく3時",
			data: {
				phase: "pre",
				exact: OYATSU_EXACT,
				item: snack,
				same: snackSame,
			} satisfies OyatsuData,
		},
		{
			at: 79000,
			scene: "oyatsu",
			pool: "oyatsuPre",
			rate: 3.5,
			bgm: null,
			data: {
				phase: "cue",
				exact: OYATSU_EXACT,
				item: snack,
				same: snackSame,
			} satisfies OyatsuData,
		},
		{
			at: 84500,
			scene: "oyatsu",
			pool: snackSame ? "oyatsuSame" : "oyatsuNew",
			rate: 1.3,
			bgm: "town",
			caption: `おやつは${S.name}`,
			data: {
				phase: "show",
				item: snack,
				same: snackSame,
				exact: OYATSU_EXACT,
			} satisfies OyatsuData,
		},
		{
			at: 96000,
			scene: "fuji",
			pool: "fuji",
			rate: 1,
			bgm: "retro",
			caption: "夕方封じ手。封筒は宇宙で保管",
			title: {
				later: (n: number, s: JkSlot) =>
					fillN(s.live ? OYATSU_THREAD.live2 : OYATSU_THREAD.rerun2, n),
			},
		},
		{
			at: 106000,
			scene: "shuban",
			pool: "shuban",
			rate: 1.5,
			bgm: "tense",
			caption: "2日目終盤",
			data: { winner, lean, pickAt: SHUBAN_PICK } satisfies OyatsuData,
		},
		{
			at: 121000,
			scene: "toryo",
			pool: "toryo",
			rate: 1.3,
			bgm: null,
			caption: "投了",
			data: { side: winner } satisfies OyatsuData,
		},
		{
			at: 130000,
			scene: "kansou",
			pool: "kansou",
			rate: 1,
			bgm: "white",
			caption: "感想戦",
			title: {
				now: (n: number) =>
					fillN(live ? OYATSU_THREAD.liveKansou : OYATSU_THREAD.rerunKansou, n),
			},
			posts: [
				{ at: 600, who: "sys", text: OYATSU_THREAD.result[winner], pin: 2500 },
			],
			data: { side: winner } satisfies OyatsuData,
		},
		{
			at: 140000,
			scene: "card",
			pool: "hansei",
			rate: 0.7,
			bgm: "ending",
			data: { phase: "end", card: OYATSU_ART.end } satisfies OyatsuData,
		},
	];
	return {
		segments,
		picks: [
			{
				at: 2000,
				boo: "booStart",
				sets: [
					[B("待機"), K("はよ"), X("ありません")],
					[B("31"), K("あと5分"), X("感想戦や")],
					[B("おやつ部集合"), K("はよ"), X(OYATSU_WORD)],
				],
			},
			{
				at: 10000,
				boo: "booStart",
				sets: [
					[B("はじまた"), K("和服ええな"), X("ありません")],
					[B("お願いします"), K("きたきた"), X("感想戦や")],
					[B("礼きれい"), K("空気ピリピリ"), X(OYATSU_WORD)],
				],
			},
			{
				at: 21000,
				boo: "boo",
				sets: [
					[B("長考入った"), K("動かん"), X("はじまた")],
					[B("静止画か"), K("長考入った"), X("ありません")],
					[B("長考入った"), K("時計見とる"), X(OYATSU_WORD, "booEarly")],
				],
			},
			{
				at: 29000,
				boo: "boo",
				sets: [
					[B("形勢わからん"), K("AI　何％や"), X("ありません")],
					[B("互角や"), K("形勢わからん"), X(FRESH)],
					[B("形勢わからん"), K("むずい"), X("封じ手や")],
				],
			},
			// 山場 1：布が 下から めくれる あいだに 昼めしを 当てる（札は 窓が 閉じた あと）
			{
				at: HIRU_PICK,
				boo: "booMeshi",
				cheer: "atari",
				sets: [
					[B(L.say), K("腹へった"), X(OYATSU_FOOD[o1].say)],
					[B(L.say), K("はよ発表"), X(OYATSU_FOOD[o2].say)],
				],
			},
			// 札の 判（前局と 同じ／はじめての 品）を 読む
			{ at: 46500, boo: "boo", sets: react(lunchSame, L.ok, "長考入った") },
			{
				at: 55500,
				boo: "boo",
				sets: [
					[B("盤しか映らん"), K("誰もおらん"), X("長考入った")],
					[B("誰もおらん"), K("腹へった"), X("はじまた")],
					[B("盤しか映らん"), K("ワイも昼めし"), X("形勢わからん")],
				],
			},
			{
				at: 66000,
				boo: "boo",
				sets: [
					[B("おやつなにやろ"), K("3時まだか"), X("盤しか映らん")],
					[B("おやつなにやろ"), K("ケーキに1票"), X("ありません")],
					[B("3時まだか"), K("眠い"), X("感想戦や")],
				],
			},
			{ at: 88000, boo: "boo", sets: react(snackSame, S.ok, "盤しか映らん") },
			{
				at: 99500,
				boo: "boo",
				sets: [
					[B("封じ手や"), K("明日はよ"), X("ありません")],
					[B("封筒きた"), K("続きは明日"), X("おやつなにやろ")],
					[B("宇宙で保管て"), K("封じ手や"), X(FRESH)],
				],
			},
			// 終盤：評価値の 札が かたむく 先を 言いきる（7割は はじめから、3割は いったん 逆へ）
			{
				at: SHUBAN_PICK,
				boo: "boo",
				cheer: "yomi",
				sets: [
					[B(OYATSU_SAY[winner]), K("形勢わからん"), X(OYATSU_SAY[loser])],
					[B(OYATSU_SAY[winner]), K("秒読みや"), X(OYATSU_SAY[loser])],
				],
			},
			{
				at: 124000,
				boo: "boo",
				sets: [
					[B("ありません"), K("おつかれ"), X("長考入った")],
					[B("ありません"), K("8888"), X(OYATSU_WORD, "booLate")],
					[B("投了や"), K("ありません"), X("封じ手や")],
				],
			},
			{
				at: 133000,
				boo: "boo",
				sets: [
					[B("感想戦や"), K("なかよし"), X("長考入った")],
					[B("感想戦や"), K("おつかれ"), X("おやつなにやろ")],
					[B("なかよし"), K("笑っとる"), X("はじまた")],
				],
			},
		],
		cues: [
			{
				...OYATSU_CUE,
				word: OYATSU_WORD,
				flood: "flood",
				praise: OYATSU_THREAD.praise,
				cross: { gap: OYATSU_THREAD.crossGap, fresh: OYATSU_THREAD.crossFresh },
				names: OYATSU_NAMES,
			},
		],
	};
};

/** おんJ名人戦　おやつ実況の 台本。 */
export const OYATSU: JkScript = {
	id: "oyatsu",
	venue: "go",
	length: 148000,
	goal: { live: 4, rerun: 2 },
	pools: OYATSU_POOLS,
	title: (n, slot) =>
		fillN(slot.live ? OYATSU_THREAD.live : OYATSU_THREAD.rerun, n),
	at1000: () => OYATSU_THREAD.get1000,
	open: "open",
	gapPool: "gap",
	duty: {
		pin: "950ちうい",
		first: [B("立ててくる"), K("誰か踏め"), X("おやつ食べてから")],
		variants: [
			{
				pin: "スレ立て規制中です",
				opts: [B("誰か頼む"), K("誰か踏め"), X("立ててくる")],
			},
			{
				pin: "次スレできたで",
				opts: [B("たておつ"), K("乙"), X("立ててくる")],
			},
			{
				pin: "★{m}が2つあるぞ",
				opts: [B("誘導しとく"), K("どっちや"), X("両方に書く")],
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
	quitNote: OYATSU_THREAD.quit,
	// 帯：空飛ぶ鯖と 同じ 形（窓 13・Cue 1・148秒）。boost 3 だと 上手が 82% で 帯を こえたので 2.7 に した
	// （本番 上手 75%・初心者 31%、再放送 76%・28%。見るだけ 0.57G・神 1.30G・random 0%）
	tune: { post: 0.1, boost: 2.7, comboMin: 20 },
	bands: {
		p50: { miru: [0.52, 0.6], kami: [1.08, 99] },
		kanso: { jouzu: [0.65, 0.8], shoshin: [0.25, 0.45], random: [0, 0.099] },
	},
	timeline: oyatsuTimeline,
};

const weekend = onWeekdays(0, 6);

/** おんJ名人戦　おやつ実況。 */
export const OYATSU_PACK: JkPack = {
	script: OYATSU,
	venue: "go",
	from: 3,
	menu: "おんJ名人戦",
	slot: liveOr(weekend),
	scenes: OYATSU_SCENES,
	// 会場の 文は 本番の 土日だけ（平日の 再放送は いつもの「対局の　中継を　流している」。
	// 10月の 金・火に 映画館の ほかの 上書きを 置かない 試験 jikkyoTests A3 が あるので）
	venueLines: {
		tv: [
			{
				when: weekend,
				lines: ["テレビ。おんJ名人戦の中継。\n……碁会所で、将棋を流している。"],
			},
		],
	},
	staffLines: {
		go_a: [
			{
				when: weekend,
				lines: ["おんJ名人戦、つけといたで。\n……囲碁の店で将棋や。ええやろ"],
			},
		],
		go_b: [
			{
				when: weekend,
				lines: ["名人の昼めし、\nワイはラーメンに1票や"],
			},
		],
	},
	staffOnce: {
		go_a: {
			kami: "この前のおやつ、\n3時ぴったりやったな",
			rerun: "この前は★{n}までのびたな。\n土日の中継は、もっとのびるで",
		},
	},
	msgs: {
		howto: "おやつの発表に合うレスで、\nスレがのびる。目標：★{n}　完走",
		seat: "キリコは座布団にすわった。\n……スマホで、実況スレをひらく。",
		over: "中継がおわった。\n実況は★{n}までのびた。",
		kami: "あのひとことは、\n3時の鐘にぴったりだった。",
		left: "……中継のとちゅうで、\nそっと座布団を立った。",
	},
	art: [
		...Object.values(OYATSU_ART),
		...Object.values(OYATSU_FOOD).flatMap((f) => [f.name, f.shop]),
	],
	deny: [
		"藤井",
		"羽生",
		"渡辺",
		"豊島",
		"永瀬",
		"ひふみん",
		"加藤一二三",
		"日本将棋連盟",
		"将棋連盟",
		"ABEMA",
		"竜王戦",
		"叡王",
		"王将戦",
		"棋聖戦",
		"王位戦",
		"王座戦",
		"棋王戦",
	],
	names: ["おんJ名人戦", "喫茶「おんJ」"],
};
