// 保守名人戦　おやつ実況（碁会所「本因坊」の 壁の テレビ。将棋の タイトル戦の 中継。PROGRAMS §1.6「昼食の 注文だけで 1000」）。
// 2日制の 対局を 2分半に まとめた 中継：対局開始 → 長考（群衆は 盤より 昼めしの 予想）→ 昼食の 注文の 発表 →
// 昼食休憩（盤だけ 映る）→ 午後 → 3時の おやつ → 封じ手（1日目 おわり）→ 2日目の 終盤 → 投了「ありません」→ 感想戦。
// - 芯：勝負めし・おやつの 発表に 反応する 実況。
//   山場 1（pick）：記録係が 運ぶ お盆の 布が 下から めくれて いく あいだに、昼めしを 当てる（札が 出る 前）。
//   山場 2（Cue）：柱時計が 3つ 鳴って、4拍目に「おやつ」。札が 出たら、前局と 同じ 品なら「またそれ　頼むんか」、
//   はじめての 品なら「ええ　チョイス」（札の 判で 読む）。終盤は 評価値の 札が かたむく 先を 言いきる（7割は はじめから、
//   3割は 逆転）。Cue の あとの 名前欄は「おやつ＠一番乗り」など。
// - 品は 村の 店の もの（麺屋「乙」・海の家「age」・おんJマート・喫茶「保守」）。棋士は 架空（名無し八段・千レス名人）。
//   盤面は 評価値の 数字と 塗りの 駒だけで、本物の 棋譜は 写さない。実在の 棋士・棋戦・団体・配信の 名前は 使わない（deny）。
// - 土日は 本番（★4）、ほかの 日は 再放送（★2。群衆に「再放送　乙」が まざる）。中身は 曜日で 閉じない。
// - キリコが 書ける 文（候補・当番・山場の 1語）には「保守」「立てといた」「立てたる」「立てたで」を 入れない。
//   群衆・題・字幕の「保守」は 固有名詞（保守名人戦・喫茶「保守」）の 中だけ。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyoOyatsuTv.ts。

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
		ok: "ソースの　におい",
	},
	onigiri: {
		name: "おにぎり",
		shop: "おんJマート",
		say: "おにぎりや",
		ok: "しぶい",
	},
	cake: {
		name: "ケーキ",
		shop: "喫茶「保守」",
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
	logo: "保守名人戦",
	sub: "おやつ実況",
	soon: "まもなく　対局開始",
	end: "本日の　中継は　おわりました",
	sen: "名無し八段",
	go: "千レス名人",
	senShort: "八段",
	goShort: "名人",
	hyoka: "評価値",
	nokori: "残り",
	choko: "長考中",
	byoyomi: "秒読み",
	lunch: "昼食の　注文",
	snack: "おやつ",
	same: "前局と　同じ",
	fresh: "はじめての　品",
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
		"あと　5分",
		"おやつ部　集合",
		"将棋　わからん",
		"今日の　おやつは",
		"正座して　待つ",
	],
	kaishi: [
		"はじまた",
		"お願い　します",
		"礼　きれい",
		"振り駒や",
		"和服　ええな",
		"空気　ピリピリ",
		"正座　つらそう",
		"きたきた",
		"盤　ええな",
	],
	choko: [
		"長考　入った",
		"動かん",
		"静止画か",
		"時計　見とる",
		"形勢　わからん",
		"AI　何％や",
		"昼　なに　頼むやろ",
		"ラーメンに　1票",
		"腹へった",
		"将棋　わからん",
		"互角や",
	],
	hiru: [
		"きたきた",
		"発表　はよ",
		"これを　待っとった",
		"本番や",
		"腹へった",
		"なに　頼んだんや",
		"わくわく",
		"布　はよ　とって",
		"記録係　ええ人",
	],
	meshiSame: [
		"またそれ　頼むんか",
		"知ってた",
		"いつもの　やつ",
		"ブレへんな",
		"うまそう",
		"飯テロ",
		"ワイも　それ",
		"勝負めしや",
		"大盛りか？",
	],
	meshiNew: [
		"ええ　チョイス",
		"攻めとる",
		"はじめて　見た",
		"意外や",
		"うまそう",
		"飯テロ",
		"ワイも　それ",
		"勝負めしや",
		"大盛りか？",
	],
	kyukei: [
		"盤しか　映らん",
		"誰も　おらん",
		"静止画や",
		"休憩中",
		"腹へった",
		"ワイも　昼めし",
		"盤　ええな",
		"見とるで",
		"放送事故か",
	],
	gogo: [
		"再開や",
		"おやつ　なにやろ",
		"ケーキに　1票",
		"かき氷　ありそう",
		"肉まん　やろ",
		"長考　入った",
		"形勢　わからん",
		"AI　何％や",
		"3時　まだか",
		"眠い",
	],
	oyatsuPre: [
		"くるぞ…",
		"時計　見とる",
		"準備できた",
		"そわそわ",
		"お前ら　静かに",
		"3時　まだか",
		"指　スタンバイ",
		"息　止めた",
	],
	// 3時の 洪水（ほかの pool と 文を 重ねない：洪水の 行は 直近の くりかえしに 数えないので）
	flood: [
		"おやつ",
		"おやつ！",
		"おやつ　きた",
		"3時や！",
		"はやすぎ",
		"おそかった",
	],
	oyatsuSame: [
		"またそれ　頼むんか",
		"知ってた",
		"いつもの　やつ",
		"ブレへんな",
		"うまそう",
		"ワイも　食いたい",
		"甘いもん　ええな",
		"3時は　これや",
		"頭　使うからな",
	],
	oyatsuNew: [
		"ええ　チョイス",
		"攻めとる",
		"はじめて　見た",
		"意外や",
		"うまそう",
		"ワイも　食いたい",
		"甘いもん　ええな",
		"3時は　これや",
		"頭　使うからな",
	],
	fuji: [
		"封じ手や",
		"明日　はよ",
		"封筒　きた",
		"1日目　乙",
		"どっちが　封じた？",
		"続きは　明日",
		"夕方か",
		"なに　書いたんや",
		"ええ　勝負",
	],
	shuban: [
		"秒読みや",
		"形勢　わからん",
		"AI　何％や",
		"ひえっ",
		"手が　ふるえとる",
		"逆転　あるで",
		"息　止めた",
		"はやい",
		"見えへん",
		"ドキドキ",
	],
	toryo: [
		"ありません",
		"終わった",
		"投了や",
		"頭　下げた",
		"おつかれ",
		"ええ　勝負やった",
		"しびれた",
		"8888",
	],
	kansou: [
		"感想戦や",
		"なかよし",
		"笑っとる",
		"ここ　ちゃうか",
		"おつかれ",
		"すごかった",
		"勉強に　なる",
		"8888",
	],
	hansei: [
		"乙",
		"おやすみ",
		"ほな",
		"解散",
		"来週も　見るで",
		"おやつ　うまそう　やった",
		"おつかれ",
		"腹へった",
	],
	rerun: [
		"再放送　乙",
		"結果　知っとる",
		"おやつだけ　見に　来た",
		"何回　見ても　ええ",
	],
	atari: ["当たりや", "エスパーか", "読んどる", "さすが"],
	yomi: ["読んどる", "さすが", "せやろな"],
	gap: ["次スレ　どこ？", "乱立すな", "950ちうい", "誰か踏め"],
	open: ["31", "サンイチ", "たておつ", "スレ立て　乙"],
	boo: ["は？", "なんて？"],
	booStart: ["はじまった　ばっかや", "まだ　早い"],
	booEarly: ["まだ　昼前や", "気が　早い"],
	booMeshi: ["ちゃうで", "おしい", "残念"],
	booLate: ["おやつは　昨日や", "は？"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ　見とるんや"],
	/** 1000 の 流れの 予備（群衆の 区切りが ない とき）。 */
	nanashi: ["くるぞ…", "はよ"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句。 */
export const OYATSU_THREAD = {
	live: "【実況】保守名人戦　おやつ部★{n}",
	rerun: "【再放送】保守名人戦　おやつ部★{n}",
	live2: "【実況】保守名人戦　2日目★{n}",
	rerun2: "【再放送】保守名人戦　2日目★{n}",
	liveKansou: "【実況・感想戦】保守名人戦★{n}",
	rerunKansou: "【再放送・感想戦】保守名人戦★{n}",
	get1000: "1000なら　おやつ　2個",
	praise: ">>{n}　3時　ぴったり",
	crossGap: "次スレで　おやつ",
	crossFresh: "新スレで　おやつ！",
	quit: "もう一度　Bで　出る",
	/** 投了の あとの 結果（システムの 書きこみ）。 */
	result: { go: "千レス名人　防衛", sen: "名無し八段　名人　奪取" },
} as const;

/** 札の あとの 返し（前局と 同じ 品／はじめての 品）。 */
const SAME = "またそれ　頼むんか";
const FRESH = "ええ　チョイス";

/** 終盤の 言いきり（勝つ 側が ◎、負ける 側が ×）。 */
export const OYATSU_SAY: Readonly<Record<OyatsuSide, string>> = {
	sen: "八段　勝ちや",
	go: "名人　勝ちや",
};

/** 山場の 1語（柱時計の 3つの 鐘の 次の 拍）。 */
export const OYATSU_WORD = "おやつ";

/** Cue の あとの キリコの 名前欄。 */
export const OYATSU_NAMES: Readonly<Record<JkCueGrade, string>> = {
	kami: "おやつ＠一番乗り",
	oshii: "おやつ＠二番手",
	late: "おやつ＠のこり物",
	flying: "まだ　2時や",
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
			caption: "1日目　対局開始",
		},
		{
			at: 17000,
			scene: "choko",
			pool: "choko",
			rate: 1,
			bgm: "kumori",
			caption: "名人　長考",
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
			caption: `勝負めしは　${L.name}`,
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
			caption: "午後の　対局　再開",
			data: { ev: [49, 56] } satisfies OyatsuData,
		},
		{
			at: 74000,
			scene: "oyatsu",
			pool: "oyatsuPre",
			rate: 1.5,
			bgm: "tense",
			caption: "まもなく　3時",
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
			caption: `おやつは　${S.name}`,
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
			bgm: "sad",
			caption: "夕方　封じ手",
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
			caption: "2日目　終盤",
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
					[B("31"), K("あと　5分"), X("感想戦や")],
					[B("おやつ部　集合"), K("はよ"), X(OYATSU_WORD)],
				],
			},
			{
				at: 10000,
				boo: "booStart",
				sets: [
					[B("はじまた"), K("和服　ええな"), X("ありません")],
					[B("お願い　します"), K("きたきた"), X("感想戦や")],
					[B("礼　きれい"), K("空気　ピリピリ"), X(OYATSU_WORD)],
				],
			},
			{
				at: 21000,
				boo: "boo",
				sets: [
					[B("長考　入った"), K("動かん"), X("はじまた")],
					[B("静止画か"), K("長考　入った"), X("ありません")],
					[B("長考　入った"), K("時計　見とる"), X(OYATSU_WORD, "booEarly")],
				],
			},
			{
				at: 29000,
				boo: "boo",
				sets: [
					[B("形勢　わからん"), K("AI　何％や"), X("ありません")],
					[B("互角や"), K("形勢　わからん"), X(FRESH)],
					[B("形勢　わからん"), K("むずい"), X("封じ手や")],
				],
			},
			// 山場 1：布が 下から めくれる あいだに 昼めしを 当てる（札は 窓が 閉じた あと）
			{
				at: HIRU_PICK,
				boo: "booMeshi",
				cheer: "atari",
				sets: [
					[B(L.say), K("腹へった"), X(OYATSU_FOOD[o1].say)],
					[B(L.say), K("はよ　発表"), X(OYATSU_FOOD[o2].say)],
				],
			},
			// 札の 判（前局と 同じ／はじめての 品）を 読む
			{ at: 46500, boo: "boo", sets: react(lunchSame, L.ok, "長考　入った") },
			{
				at: 55500,
				boo: "boo",
				sets: [
					[B("盤しか　映らん"), K("誰も　おらん"), X("長考　入った")],
					[B("誰も　おらん"), K("腹へった"), X("はじまた")],
					[B("盤しか　映らん"), K("ワイも　昼めし"), X("形勢　わからん")],
				],
			},
			{
				at: 66000,
				boo: "boo",
				sets: [
					[B("おやつ　なにやろ"), K("3時　まだか"), X("盤しか　映らん")],
					[B("おやつ　なにやろ"), K("ケーキに　1票"), X("ありません")],
					[B("3時　まだか"), K("眠い"), X("感想戦や")],
				],
			},
			{ at: 88000, boo: "boo", sets: react(snackSame, S.ok, "盤しか　映らん") },
			{
				at: 99500,
				boo: "boo",
				sets: [
					[B("封じ手や"), K("明日　はよ"), X("ありません")],
					[B("封筒　きた"), K("続きは　明日"), X("おやつ　なにやろ")],
					[B("封じ手や"), K("1日目　乙"), X(FRESH)],
				],
			},
			// 終盤：評価値の 札が かたむく 先を 言いきる（7割は はじめから、3割は いったん 逆へ）
			{
				at: SHUBAN_PICK,
				boo: "boo",
				cheer: "yomi",
				sets: [
					[B(OYATSU_SAY[winner]), K("形勢　わからん"), X(OYATSU_SAY[loser])],
					[B(OYATSU_SAY[winner]), K("秒読みや"), X(OYATSU_SAY[loser])],
				],
			},
			{
				at: 124000,
				boo: "boo",
				sets: [
					[B("ありません"), K("おつかれ"), X("長考　入った")],
					[B("ありません"), K("8888"), X(OYATSU_WORD, "booLate")],
					[B("投了や"), K("ありません"), X("封じ手や")],
				],
			},
			{
				at: 133000,
				boo: "boo",
				sets: [
					[B("感想戦や"), K("なかよし"), X("長考　入った")],
					[B("感想戦や"), K("おつかれ"), X("おやつ　なにやろ")],
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

/** 保守名人戦　おやつ実況の 台本。 */
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
		first: [B("立ててくる"), K("誰か踏め"), X("おやつ　食べてから")],
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
				pin: "★{m}が　2つ　あるぞ",
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

/** 保守名人戦　おやつ実況。 */
export const OYATSU_PACK: JkPack = {
	script: OYATSU,
	venue: "go",
	from: 3,
	menu: "保守名人戦",
	slot: liveOr(weekend),
	scenes: OYATSU_SCENES,
	// 会場の 文は 本番の 土日だけ（平日の 再放送は いつもの「対局の　中継を　流している」。
	// 10月の 金・火に 映画館の ほかの 上書きを 置かない 試験 jikkyoTests A3 が あるので）
	venueLines: {
		tv: [
			{
				when: weekend,
				lines: [
					"テレビ。保守名人戦の　中継。\n……碁会所で、将棋を　流している。",
				],
			},
		],
	},
	staffLines: {
		go_a: [
			{
				when: weekend,
				lines: ["保守名人戦、つけといたで。\n……囲碁の　店で　将棋や。ええやろ"],
			},
		],
		go_b: [
			{
				when: weekend,
				lines: ["名人の　昼めし、\nワイは　ラーメンに　1票や"],
			},
		],
	},
	staffOnce: {
		go_a: {
			kami: "この前の　おやつ、\n3時　ぴったり　やったな",
			rerun: "この前は　★{n}まで　のびたな。\n土日の　中継は、もっと　のびるで",
		},
	},
	msgs: {
		howto: "おやつの　発表に　合う　レスで、\nスレが　のびる。目標：★{n}　完走",
		seat: "キリコは　座布団に　すわった。\n……スマホで、実況スレを　ひらく。",
		over: "中継が　おわった。\n実況は　★{n}まで　のびた。",
		kami: "あの　ひとことは、\n3時の　鐘に　ぴったり　だった。",
		left: "……中継の　とちゅうで、\nそっと　座布団を　立った。",
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
	names: ["保守名人戦", "喫茶「保守」"],
};
