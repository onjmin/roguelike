// 過去ログの世紀（おんJ図書館の 視聴覚コーナーの テレビ。PROGRAMS §1.6「三大実況の 1つ」）。
// 重い 語りの ドキュメンタリーで、村（保守村＝おんJ）と 板の 歴史だけを 語る。映像は モノクロの 古い フィルム：
// 2012年の 夏に 最初の スレが 立ち、ある 日 人が あふれて 1000に 届く。規制の 冬に 次スレが 立たず、
// 人は 遊びで 旗を 立てた 植民地へ、やがて 本当に 散る。スレは 沈んで 過去ログに なる。
// それでも 名無しが 次スレ「おんJ　はじめました　Part2」を 立てる。スレタイが 出る 拍に「おかえり」（Cue。beat 1000）、
// その 拍から 画面に 色が もどり、いまの 保守村を 映して 幕。
// - この 番組の 動詞：時代ごとに 合う ひとこと・過去ログが 沈む あいだは 黙る（答えない ことが ◎＝timeoutFit。
//   図書館は sage 進行）・スレタイの 拍に 1語。CM は ない。速記ニキが 語りを 書きおこす（posts）。
// - 月曜は 本放送（★4）、ほかの 日は 再放送（★2。群衆に「再放送　乙」が まざる）。中身は 曜日で 閉じない。
// - 実在の 人・事件・戦争・政治は 出さない（板の 歴史だけ）。年の 字幕は 村の 話に 合わせる（おんJが できた
//   2012年・植民地の 2014〜15年。過去ログの 場面は 年が 進むだけ）。裏シナリオの ネタ（いちばん 古い スレの 名・
//   そこに いた 人たち）にも 触れない。番組名は 架空の パロディで、実在の 番組・局・曲・語りとは 関係が ない。
//   群衆の 文は 手で 書いた 一覧だけ。
// - キリコが 書ける 文（候補・当番・山場の 1語）に「保守」「立てといた」「立てたる」「立てたで」を 入れない。
//   群衆・題・字幕の「保守」は 固有名詞（保守村）の 中だけ。
// - 文の 幅：レス 12・候補 10・スレタイ・字幕・pin・絵の 字 22（全角）。試験は src/sim/jikkyoProgTests.ts。
// 絵は ui/jikkyoKakologTv.ts（場面の 鍵は KAKOLOG_SCENES、絵に 出す 文は KAKOLOG_ART）。

import type {
	JkFit,
	JkOpt,
	JkScript,
	JkScriptSeg,
	JkSlot,
} from "../../core/jikkyo";
import type { Today } from "../calendar";
import { LIBRARY_FROM } from "../glossary";
import { type JkPack, liveOr, onWeekdays } from "./pack";

const o = (text: string, fit: JkFit): JkOpt => ({ text, fit });
const B = (t: string) => o(t, "best");
const K = (t: string) => o(t, "ok");
const X = (t: string) => o(t, "miss");

/** 場面の 鍵（カード・OP・時代 5つ・山場・いま・ED）。 */
export const KAKOLOG_SCENES = [
	"card",
	"op",
	"hajime",
	"matsuri",
	"fuyu",
	"shokumin",
	"kakolog",
	"tsugi",
	"ima",
	"ed",
] as const;
export type KakologScene = (typeof KAKOLOG_SCENES)[number];

/** 場面の 小さな 中身（TV が 読む）。 */
export type KakologData = {
	/**
	 * card：まもなく・予告・おわり／shokumin：旗を 立てる・散る／
	 * tsugi：山場の 前・合図（スレタイを 打つ）・スレタイが 出た あと。
	 */
	readonly phase?:
		| "soon"
		| "preview"
		| "end"
		| "hata"
		| "chiru"
		| "pre"
		| "cue"
		| "title";
	/** card の 大きな 文。 */
	readonly card?: string;
	/** フィルムの 年の 字幕。 */
	readonly year?: number;
	/** 山場の ちょうどの 名目の ms（スレタイが 出る 拍）。 */
	readonly exact?: number;
};

/** 絵に 出す 文（どれも 全角 22字まで）。 */
export const KAKOLOG_ART = {
	title: "過去ログの世紀",
	sub: "沈んだ　スレたちの　記録",
	soon: "まもなく　はじまります",
	end: "本日の　放送は　おわりました",
	board: "おんJ",
	first: "おんJ　はじめました",
	next: "おんJ　はじめました　Part2",
	kisei: "スレ立て　規制中",
	sengen: "植民地化宣言",
	boards: ["パン板", "きのこ板", "風呂板", "電池板"],
	/** 沈む スレ（架空の 題。TV では いちばん 上に 最初の スレを 足す）。 */
	sunk: [
		"今日の　晩飯スレ",
		"ワイの　日記　Part3",
		"眠れない　やつ　おる？",
		"雑談スレ　★58",
		"パン板　移住計画",
		"規制　解除まち",
		"朝まで　起きとる　スレ",
	],
	form: "スレッド　タイトル",
	submit: "書きこむ",
	years: ["2012年", "2014年", "2015年"],
	village: "保守村",
	/** スタッフロール（役は ぜんぶ 名無しさん と 村の 施設）。 */
	staff: [
		"語り　名無しさん",
		"音楽　名無しさん",
		"資料　過去ログ倉庫",
		"協力　おんJ　図書館",
		"制作　保守村",
	],
} as const;

/** 予告（どれも 板の 話）。 */
export const KAKOLOG_PREVIEW = [
	"次回『植民地の　旗』",
	"次回『1000の　向こう』",
	"次回『規制の　冬　ふたたび』",
] as const;

/** 群衆の 文（手で 書いた 白い 一覧。レスは 全角 12字まで。pool は 10 前後）。 */
export const KAKOLOG_POOLS = {
	wait: [
		"31",
		"サンイチ",
		"たておつ",
		"待機",
		"はよ",
		"月曜は　これや",
		"あと　5分",
		"くるぞ…",
		"しずかに　待つ",
		"ヘッドホン　した",
	],
	op: [
		"はじまた",
		"この曲　すき",
		"重い",
		"OP　ずるい",
		"鳥肌",
		"きたきた",
		"モノクロや",
		"フィルムや",
		"この　入り　すき",
		"重厚やな",
	],
	hajime: [
		"懐かしい",
		"当時　おったわ",
		"レス　少な",
		"2012年か",
		"ここすき",
		"語りが　ええ",
		"まだ　31も　ない",
		"はじまりや",
		"よう　残っとる",
		"サンキュー速記ニキ",
	],
	matsuri: [
		"当時　おったわ",
		"祭りや",
		"勢い　すごい",
		"人　多すぎ",
		"鯖が　重い",
		"ワイも　おった",
		"楽しかった",
		"懐かしい",
		"1000　いった",
		"あの　頃や",
	],
	fuyu: [
		"規制　つらい",
		"寒そう",
		"書けへん",
		"冬の　時代や",
		"耐えた",
		"重い",
		"スレ立て　無理",
		"さむい",
		"ここすき",
		"BGM　ずるい",
	],
	hata: [
		"植民地や",
		"旗　立てとる",
		"すぐ　飽きる",
		"遊びで　行った",
		"パン板や",
		"きのこ板や",
		"侵略や",
		"懐かしい",
		"宣言　しとる",
		"ワイも　行った",
	],
	chiru: [
		"散ったなあ",
		"帰って　こない",
		"みんな　どこ？",
		"さみしい",
		"重い",
		"泣ける",
		"しずかに　なった",
		"ここすき",
		"語りが　ええ",
		"サンキュー速記ニキ",
	],
	kakolog: [
		"……",
		"しずかや",
		"沈んだな",
		"見覚え　ある",
		"あの　スレ…",
		"sage",
		"重い",
		"しっ",
		"晩飯スレや",
		"どこも　沈んだ",
	],
	pre: [
		"くるぞ…",
		"泣ける",
		"BGM　ずるい",
		"ここすき",
		"語りが　ええ",
		"まさか",
		"だれや",
		"…あっ",
		"鳥肌",
		"まって",
	],
	// 山場の 洪水（ほかの pool と 文を 重ねない：洪水の 行は 直近の くりかえしに 数えないので）
	flood: [
		"おかえり",
		"おかえり！",
		"おかえり…",
		"おかえり！！",
		"待っとった",
		"はやすぎ",
		"おそかった",
	],
	after: [
		"泣ける",
		"語りが　ええ",
		"BGM　ずるい",
		"鳥肌",
		"ここすき",
		"名無し…",
		"ありがとう",
		"色が　ついた",
		"Part2や",
		"サンキュー速記ニキ",
	],
	ima: [
		"保守村や",
		"色が　ついた",
		"ワイらや",
		"いまや",
		"ここに　おる",
		"しみる",
		"今日も　おるで",
		"ええ　村や",
		"映っとる",
		"見たこと　ある",
	],
	ed: [
		"神回",
		"泣ける",
		"8888",
		"この曲　すき",
		"ええ　回やった",
		"語りが　ええ",
		"来週も　見る",
		"重い",
		"よかった",
		"しみたわ",
	],
	preview: [
		"来週も　見る",
		"たのしみ",
		"次は　なんや",
		"重そう",
		"来週も　泣く",
		"録画　した",
	],
	hansei: [
		"乙",
		"反省会や",
		"ほな",
		"おやすみ",
		"ええ　回やった",
		"寝る",
		"泣いたわ",
		"来週も　見るで",
		"解散",
	],
	rerun: [
		"再放送　乙",
		"また　見とる",
		"何回　見ても　泣く",
		"知っとる　のに　泣く",
	],
	gap: ["次スレ　どこ？", "乱立すな", "950ちうい", "誰か踏め", "次スレは？"],
	open: ["31", "サンイチ", "たておつ", "スレ立て　乙"],
	boo: ["は？", "なんて？"],
	booStart: ["はじまった　ばっかや", "まだ　早い"],
	booEarly: ["まだ　早い", "気が　早い"],
	booQuiet: ["しっ", "sage　進行で"],
	quietOk: ["……", "しずかや", "沈んだな"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ　見とるんや"],
	/** 1000 の 流れの 予備（群衆の 区切りが ない とき）。 */
	nanashi: ["くるぞ…", "はよ"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句。 */
export const KAKOLOG_THREAD = {
	live: "【実況】過去ログの世紀★{n}",
	rerun: "【再放送】過去ログの世紀★{n}",
	liveHansei: "【実況・反省会】過去ログの世紀★{n}",
	rerunHansei: "【再放送・反省会】過去ログの世紀★{n}",
	get1000: "1000なら　来週も　見る",
	praise: ">>{n}　神エイム",
	crossGap: "次スレで　おかえり",
	crossFresh: "新スレで　おかえり",
	quiet: "しずかに　見よ",
	thanks: "名無し、ありがとう",
	quit: "もう一度　Bで　出る",
} as const;

/** 速記ニキの 書きおこし（語りの 1行。架空の 語り）。 */
export const KAKOLOG_SOKKI = {
	hajime: "語り「はじめは、1本の　スレだった」",
	chiru: "語り「だれも、悪く　なかった」",
	after: "語り「帰る　場所は、のこった」",
} as const;

const fillN = (s: string, n: number) => s.replace("{n}", String(n));

/** 山場の 1語（スレタイが 出る 拍に）。 */
export const KAKOLOG_WORD = "おかえり";

/** 山場の 合図（1つめ）・拍（重く ゆっくり 1秒）。ちょうどで スレタイが 出る。 */
export const KAKOLOG_CUE = { at: 93000, beat: 1000, pulses: 3 } as const;
export const KAKOLOG_EXACT =
	KAKOLOG_CUE.at + KAKOLOG_CUE.pulses * KAKOLOG_CUE.beat;

/** 台本（149秒。pick 13 ＋ Cue）。 */
const kakologTimeline: JkScript["timeline"] = (rand, slot) => {
	const hansei = (n: number) =>
		fillN(
			slot.live ? KAKOLOG_THREAD.liveHansei : KAKOLOG_THREAD.rerunHansei,
			n,
		);
	const preview =
		KAKOLOG_PREVIEW[Math.floor(rand() * KAKOLOG_PREVIEW.length)] ??
		KAKOLOG_PREVIEW[0];
	const exact = KAKOLOG_EXACT;
	const segments: JkScriptSeg[] = [
		{
			at: 0,
			scene: "card",
			pool: "wait",
			rate: 0.5,
			bgm: null,
			caption: KAKOLOG_ART.soon,
			data: { phase: "soon", card: KAKOLOG_ART.soon } satisfies KakologData,
		},
		{ at: 6000, scene: "op", pool: "op", rate: 1, bgm: "deep2" },
		{
			at: 17000,
			scene: "hajime",
			pool: "hajime",
			rate: 0.9,
			bgm: "ruins",
			caption: "2012年　夏。最初の　スレが　立った",
			posts: [{ at: 7500, who: "nanashi", text: KAKOLOG_SOKKI.hajime }],
			data: { year: 2012 } satisfies KakologData,
		},
		{
			at: 29000,
			scene: "matsuri",
			pool: "matsuri",
			rate: 1.4,
			bgm: "stone",
			caption: "ある　日、人が　あふれた",
			data: { year: 2014 } satisfies KakologData,
		},
		{
			at: 41000,
			scene: "fuyu",
			pool: "fuyu",
			rate: 1,
			bgm: "deep_kisei",
			caption: "規制の　冬。次スレは　立たなかった",
		},
		{
			at: 53000,
			scene: "shokumin",
			pool: "hata",
			rate: 1.1,
			bgm: "sad",
			caption: "遊びで　旗を　立てた　植民地",
			data: { phase: "hata", year: 2015 } satisfies KakologData,
		},
		{
			at: 63000,
			scene: "shokumin",
			pool: "chiru",
			rate: 0.9,
			caption: "やがて、人は　本当に　散った",
			posts: [{ at: 7000, who: "nanashi", text: KAKOLOG_SOKKI.chiru }],
			data: { phase: "chiru" } satisfies KakologData,
		},
		// 過去ログが 沈む あいだ「しずかに　見よ」を 上に 止める（図書館は sage 進行。黙るのが ◎）
		{
			at: 73000,
			scene: "kakolog",
			pool: "kakolog",
			rate: 0.4,
			bgm: "shallow3",
			caption: "スレは　沈み、過去ログに　なった",
			posts: [
				{ at: 3500, who: "nanashi", text: KAKOLOG_THREAD.quiet, pin: 7000 },
			],
		},
		{
			at: 84500,
			scene: "tsugi",
			pool: "pre",
			rate: 1.3,
			bgm: "deep_hakushi",
			caption: "それでも、",
			data: { phase: "pre", exact } satisfies KakologData,
		},
		{
			at: 92000,
			scene: "tsugi",
			pool: "pre",
			rate: 3.2,
			bgm: null,
			data: { phase: "cue", exact } satisfies KakologData,
		},
		{
			at: 97500,
			scene: "tsugi",
			pool: "after",
			rate: 1.3,
			bgm: "deep6",
			caption: "次スレを　立てた　名無しが　いた",
			react: [{ who: "nanashi", text: KAKOLOG_THREAD.thanks }],
			posts: [{ at: 6500, who: "nanashi", text: KAKOLOG_SOKKI.after }],
			data: { phase: "title", exact } satisfies KakologData,
		},
		{
			at: 109000,
			scene: "ima",
			pool: "ima",
			rate: 1,
			bgm: "kumori",
			caption: "そして、いま。",
		},
		{ at: 119000, scene: "ed", pool: "ed", rate: 1.1, bgm: "ending" },
		{
			at: 133000,
			scene: "card",
			pool: "preview",
			rate: 0.9,
			caption: preview,
			data: { phase: "preview", card: preview } satisfies KakologData,
		},
		{
			at: 140000,
			scene: "card",
			pool: "hansei",
			rate: 0.7,
			caption: KAKOLOG_ART.end,
			title: { now: hansei },
			data: { phase: "end", card: KAKOLOG_ART.end } satisfies KakologData,
		},
	];
	return {
		segments,
		picks: [
			{
				at: 2000,
				boo: "booStart",
				sets: [
					[B("31"), K("はよ"), X(KAKOLOG_WORD)],
					[B("待機"), K("くるぞ…"), X("乙")],
					[B("あと　1分"), K("はよ"), X("8888")],
				],
			},
			{
				at: 11500,
				boo: "booStart",
				sets: [
					[B("はじまた"), K("きたきた"), X("31")],
					[B("この曲　すき"), K("鳥肌"), X("乙")],
					[B("重い"), K("OP　ずるい"), X("8888")],
				],
			},
			{
				at: 22500,
				boo: "boo",
				sets: [
					[B("懐かしい"), K("レス　少な"), X("祭りや")],
					[B("当時　おったわ"), K("ここすき"), X("散ったなあ")],
					[B("語りが　ええ"), K("懐かしい"), X("勢い　すごい")],
				],
			},
			{
				at: 34500,
				boo: "boo",
				sets: [
					[B("祭りや"), K("鯖が　重い"), X("寒そう")],
					[B("勢い　すごい"), K("当時　おったわ"), X(KAKOLOG_WORD)],
					[B("当時　おったわ"), K("祭りや"), X("規制　つらい")],
				],
			},
			{
				at: 47500,
				boo: "boo",
				sets: [
					[B("規制　つらい"), K("寒そう"), X("祭りや")],
					[B("寒そう"), K("書けへん"), X("勢い　すごい")],
					[B("BGM　ずるい"), K("規制　つらい"), X("8888")],
				],
			},
			{
				at: 55500,
				boo: "boo",
				sets: [
					[B("植民地や"), K("懐かしい"), X("散ったなあ")],
					[B("宣言　しとる"), K("植民地や"), X("寒そう")],
					[B("遊びで　行った"), K("すぐ　飽きる"), X("泣ける")],
				],
			},
			{
				at: 68000,
				boo: "boo",
				sets: [
					[B("散ったなあ"), K("さみしい"), X("祭りや")],
					[B("帰って　こない"), K("重い"), X("宣言　しとる")],
					[B("泣ける"), K("みんな　どこ？"), X("植民地や")],
				],
			},
			// 過去ログが 沈む：黙って 見るのが ◎（答えないと ◎、sage・…… は ○、さわぐと ×）
			{
				at: 77000,
				open: 5000,
				timeoutFit: "best",
				boo: "booQuiet",
				cheer: "quietOk",
				sets: [
					[X(KAKOLOG_WORD), K("sage")],
					[X("勢い　すごい"), K("……")],
					[X("8888"), K("しずかや")],
				],
			},
			{
				at: 87000,
				boo: "booEarly",
				sets: [
					[B("くるぞ…"), K("まって"), X(KAKOLOG_WORD)],
					[B("泣ける"), K("BGM　ずるい"), X(KAKOLOG_WORD)],
					[B("BGM　ずるい"), K("くるぞ…"), X("8888")],
				],
			},
			// スレタイが 出た あと（山場の 窓が 閉じて 6秒 あと）
			{
				at: 104000,
				boo: "boo",
				sets: [
					[B("泣ける"), K("ありがとう"), X("31")],
					[B("語りが　ええ"), K("鳥肌"), X("待機")],
					[B("鳥肌"), K("泣ける"), X("規制　つらい")],
				],
			},
			{
				at: 114000,
				boo: "boo",
				sets: [
					[B("色が　ついた"), K("ワイらや"), X("寒そう")],
					[B("今日も　おるで"), K("色が　ついた"), X("31")],
					[B("ワイらや"), K("しみる"), X("植民地や")],
				],
			},
			{
				at: 128000,
				boo: "boo",
				sets: [
					[B("8888"), K("泣ける"), X("はじまた")],
					[B("神回"), K("この曲　すき"), X("31")],
					[B("この曲　すき"), K("8888"), X("祭りや")],
				],
			},
			// 予告の あいだは 窓を 置かない（950 の 当番の 間）
			{
				at: 142500,
				boo: "boo",
				sets: [
					[B("乙"), K("反省会や"), X("はじまた")],
					[B("おやすみ"), K("泣いたわ"), X("待機")],
					[B("ほな"), K("来週も　見る"), X("31")],
				],
			},
		],
		cues: [
			{
				...KAKOLOG_CUE,
				word: KAKOLOG_WORD,
				flood: "flood",
				praise: KAKOLOG_THREAD.praise,
				cross: {
					gap: KAKOLOG_THREAD.crossGap,
					fresh: KAKOLOG_THREAD.crossFresh,
				},
			},
		],
	};
};

/** 過去ログの世紀（台本）。 */
export const KAKOLOG: JkScript = {
	id: "kakolog",
	venue: "library",
	length: 149000,
	goal: { live: 4, rerun: 2 },
	pools: KAKOLOG_POOLS,
	title: (n, slot) =>
		fillN(slot.live ? KAKOLOG_THREAD.live : KAKOLOG_THREAD.rerun, n),
	at1000: () => KAKOLOG_THREAD.get1000,
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
	quitNote: KAKOLOG_THREAD.quit,
	// 帯（sora と 同じ はば・同じ tune）：本放送 上手 76%・初心者 31%、再放送 79%・27%（見るだけ 0.57〜0.58G・
	// 神 1.34〜1.37G・random 0%）。上手と 初心者の 差は boost・post・comboMin を 動かしても 45〜50 で
	// かわらない。950 の 当番は 窓の 間（とくに 予告の あいだ）で 出る
	tune: { post: 0.1, boost: 3, comboMin: 20 },
	bands: {
		p50: { miru: [0.52, 0.6], kami: [1.08, 99] },
		kanso: { jouzu: [0.65, 0.8], shoshin: [0.25, 0.45], random: [0, 0.099] },
	},
	timeline: kakologTimeline,
};

/** 本放送の 日（月曜）。 */
const isLiveDay = onWeekdays(1);
const anyDay = (_t: Today): boolean => true;

/** 過去ログの世紀。 */
export const KAKOLOG_PACK: JkPack = {
	script: KAKOLOG,
	venue: "library",
	from: LIBRARY_FROM,
	menu: "過去ログの世紀",
	slot: liveOr(isLiveDay),
	scenes: KAKOLOG_SCENES,
	venueLines: {
		tv: [
			{
				when: isLiveDay,
				lines: ["視聴覚コーナーの　テレビ。\n月曜の　夜は『過去ログの世紀』。"],
			},
			{
				when: anyDay,
				lines: [
					"視聴覚コーナーの　テレビ。\n『過去ログの世紀』の　再放送　中。",
				],
			},
		],
	},
	msgs: {
		seat: "キリコは　ヘッドホンを　つけた。\n……スマホで、実況スレを　ひらく。",
		over: "ヘッドホンを　はずした。\n実況は　★{n}まで　のびた。",
		kanso: "……完走。\nsage　進行の　まま、しずかに。",
		kami: "スレタイが　出た　その　拍に、\n「おかえり」と　書けた。",
		left: "……放送の　とちゅうで、\nそっと　ヘッドホンを　はずした。",
	},
	art: [
		KAKOLOG_ART.title,
		KAKOLOG_ART.sub,
		KAKOLOG_ART.soon,
		KAKOLOG_ART.end,
		KAKOLOG_ART.board,
		KAKOLOG_ART.first,
		KAKOLOG_ART.next,
		KAKOLOG_ART.kisei,
		KAKOLOG_ART.sengen,
		KAKOLOG_ART.form,
		KAKOLOG_ART.submit,
		KAKOLOG_ART.village,
		...KAKOLOG_ART.boards,
		...KAKOLOG_ART.sunk,
		...KAKOLOG_ART.years,
		...KAKOLOG_ART.staff,
		...KAKOLOG_PREVIEW,
	],
	deny: [
		"映像の世紀",
		"パリは燃えているか",
		"加古隆",
		"なんJ民",
		"さとる",
		"ひろゆき",
		"野球ch",
		"原住民",
	],
};
