// 大相撲『保守場所』（銭湯「ゆ」の 脱衣所の テレビ。PROGRAMS §5.4）。実況の 中で いちばん 静かな 番組。
// 取組は 3つ：1番目（速記ニキが 結果を 書き写す）・2番目（長い 相撲 → 物言い → 同体で 取り直し）・
// 結び（横綱 千レス山 と 平幕 名無ノ里。立ち合いが 山場で、横綱が 負けると 座布団が 舞う）。そのあと 弓取式。
// - この 番組の 動詞：取組の 見せ場に 合う ひとこと・速記ニキへの「サンキュー速記ニキ」・
//   立ち合い（Cue。2人が 4つの こぶしを つく 拍。合図 3回、4つめの こぶしで「はっけよい」。早すぎると 待った）。
// - 日：奇数月の 8〜22日は 本場所（N日目 ＝ 日 − 7。8日目は 中日、22日は 千秋楽）。千秋楽は 結びが 優勝を かけた 一番で、
//   弓取式の かわりに 表彰式。ほかの 日は「名勝負　アンコール」（再放送。目標を 下げ、群衆に「再放送　乙」が まざる）。
// - しこ名は 板の 語で 作った 架空の 名前だけ（実在の 力士・親方・協会・会場・局の 名前は deny で 守る）。
//   懸賞旗は 村の 店の 名前だけ。座布団は「投げないで」の 空気（場内の 字幕）も 出す。
// - キリコが 書ける 文（候補・当番・山場の 1語）に「保守」「立てといた」「立てたる」「立てたで」を 入れない。
//   群衆・題・字幕の「保守」は 固有名詞（保守場所・保守ノ海）の 中だけ。
// - 文の 幅：レス 12・候補 10・スレタイ・字幕・pin・絵の 字 22（全角）。試験は src/sim/jikkyoProgTests.ts。
// 絵は ui/jikkyoSumoTv.ts（場面の 鍵は SUMO_SCENES、絵に 出す 文は SUMO_ART）。

import type {
	JkFit,
	JkOpt,
	JkScript,
	JkScriptSeg,
	JkSlot,
} from "../../core/jikkyo";
import type { Today } from "../calendar";
import type { JkPack } from "./pack";

const o = (text: string, fit: JkFit): JkOpt => ({ text, fit });
const B = (t: string) => o(t, "best");
const K = (t: string) => o(t, "ok");
const X = (t: string) => o(t, "miss");

/** 場面の 鍵（TV が 描く）。 */
export const SUMO_SCENES = [
	"card",
	"op",
	"dohyo",
	"monoii",
	"tachiai",
	"zabuton",
	"yumitori",
	"hyosho",
] as const;
export type SumoScene = (typeof SUMO_SCENES)[number];

/** 取組の 勝ち（東・西・同体）。 */
export type SumoWin = "e" | "w" | "dotai";

/** 場面の 小さな 中身（TV が 読む）。 */
export type SumoData = {
	/** dohyo：仕切り・取組・勝ち名乗り・結びの 懸賞・時間いっぱい。card：まもなく・おわり。 */
	readonly phase?:
		| "soon"
		| "end"
		| "shikiri"
		| "bout"
		| "kekka"
		| "musubi"
		| "jikan";
	/** card の 大きな 文。 */
	readonly card?: string;
	/** op の 下の 文（N日目・名勝負　アンコール）。 */
	readonly sub?: string;
	readonly east?: string;
	readonly west?: string;
	/** 東が 横綱（綱を しめる）。 */
	readonly yokozuna?: boolean;
	readonly win?: SumoWin;
	/** 取組の 長さ（名目の ms。立ち合いから 勝負が つくまで）。 */
	readonly dur?: number;
	/** 懸賞旗（SUMO_ART.kensho の 番）。 */
	readonly kensho?: readonly number[];
	/** 立ち合い：4つめの こぶしの 名目の ms と 拍。 */
	readonly exact?: number;
	readonly beat?: number;
};

/** 日の 名前（1〜15。初日・中日・千秋楽）。 */
const KANJI = [
	"",
	"一",
	"二",
	"三",
	"四",
	"五",
	"六",
	"七",
	"八",
	"九",
	"十",
	"十一",
	"十二",
	"十三",
	"十四",
] as const;
export const sumoDayName = (d: number): string =>
	d <= 1 ? "初日" : d === 8 ? "中日" : d >= 15 ? "千秋楽" : `${KANJI[d]}日目`;

/** しこ名（板の 語で 作った 架空の 名前だけ）。 */
export const SUMO_NAMES = {
	hoshu: "保守ノ海",
	sage: "sage錦",
	age: "age富士",
	kanso: "完走山",
	jisure: "次スレ丸",
	kakolog: "過去ログ嶽",
	yokozuna: "千レス山",
	nanashi: "名無ノ里",
} as const;
const N = SUMO_NAMES;

/** 絵に 出す 文（どれも 全角 22字まで）。 */
export const SUMO_ART = {
	logo: "大相撲",
	basho: "保守場所",
	encore: "名勝負　アンコール",
	soon: "まもなく　中継",
	soonEncore: "まもなく　名勝負",
	end: "本日の　中継は　おわり",
	endRaku: "また　来場所",
	endEncore: "また　本場所で",
	east: "東",
	west: "西",
	yokozuna: "横綱",
	hiramaku: "平幕",
	kyogi: "協議中",
	matta: "待った！",
	yusho: "優勝",
	yu: "ゆ",
	/** 懸賞旗（村の 店の 名前だけ）。 */
	kensho: [
		"海の家「age」",
		"ageジム",
		"おんJマート",
		"麺屋「乙」",
		"牛丼「つゆだく」",
		"銭湯「ゆ」",
	],
	/** 懸賞旗の 字（kensho の 番）。 */
	kenshoMark: ["海", "ジ", "マ", "乙", "牛", "ゆ"],
	days: Array.from({ length: 15 }, (_, i) => sumoDayName(i + 1)),
	names: Object.values(SUMO_NAMES),
} as const;

/** 群衆の 文（手で 書いた 白い 一覧。レスは 全角 12字まで）。 */
export const SUMO_POOLS = {
	wait: [
		"31",
		"サンイチ",
		"たておつ",
		"待機",
		"はよ",
		"きょうも　見る",
		"あと　5分",
	],
	op: ["はじまた", "きたきた", "おお", "渋い", "落ち着く", "この　時間　すき"],
	shikiri: [
		"見合って",
		"まだ　仕切る",
		"塩　まいた",
		"ええ　顔や",
		"謎に　人多いよな",
		"静かやな",
		"がんばれ",
	],
	torikumi: [
		"のこった",
		"おお",
		"うおお",
		"粘れ",
		"いけ！",
		"あぶな",
		"はやい",
	],
	kekka: [
		"つよい",
		"完勝や",
		"ええ　相撲",
		"手刀　きれい",
		"善戦定期",
		"これは大関",
	],
	monoii: [
		"物言いや",
		"どっちや",
		"同体やろ",
		"長いな",
		"審判　集まった",
		"スロー　見せて",
		"微妙やな",
	],
	torinaoshi: ["取り直しや", "もう　1回", "得した", "ええぞ", "仕切り　直しや"],
	musubi: [
		"結びや",
		"横綱　来た",
		"懸賞　すごい",
		"旗　多すぎ",
		"名無ノ里　がんばれ",
		"スポンサー　多い",
	],
	jikan: [
		"時間　いっぱい",
		"くるぞ…",
		"静かに　しろ",
		"息　止まる",
		"はよ　立て",
	],
	flood: ["はっけよい", "はっけよい！", "のこった！", "立った！"],
	zabuton: [
		"座布団　舞っとる",
		"投げるな",
		"危ないで",
		"舞った　舞った",
		"片づけ　大変そう",
		"わかるけど　あかん",
	],
	kinboshi: [
		"金星や！",
		"うおおお",
		"名無ノ里　すげえ",
		"横綱　負けた",
		"大金星",
		"やりおった",
	],
	yumitori: ["弓取り　すき", "くるくる", "ええな", "弓　すごい", "締めや"],
	hyosho: [
		"平幕優勝や",
		"名無ノ里　おめでとう",
		"優勝杯　でかい",
		"泣ける",
		"ええ　場所やった",
	],
	hansei: ["乙", "ほな", "おやすみ", "解散", "明日も　見るで", "風呂　入るか"],
	rerun: [
		"名勝負や",
		"何回　見ても　ええ",
		"再放送　乙",
		"懐かしい",
		"知っとる　けど　見る",
	],
	gap: ["次スレ　どこ？", "乱立すな", "950ちうい", "誰か踏め"],
	open: ["31", "サンイチ", "たておつ", "スレ立て　乙"],
	boo: ["は？", "なんて？"],
	booStart: ["はじまった　ばっかや", "まだ　早い"],
	booEarly: ["まだ　仕切っとる", "まだ　早い"],
	booLate: ["もう　終わったで", "は？"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ　見とるんや"],
	/** 1000 の 流れの 予備（群衆の 区切りが ない とき）。 */
	nanashi: ["静かやな", "渋い"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句。 */
export const SUMO_THREAD = {
	live: "【中継】大相撲総合スレ　保守場所　Part{n}",
	rerun: "【再放送】大相撲総合スレ　保守場所　Part{n}",
	get1000: "1000なら　結びで　座布団",
	praise: ">>{n}　ええ　立ち合い",
	crossGap: "次スレで　はっけよい",
	crossFresh: "新スレで　立ち合えた",
	/** 場内の 字幕（座布団は 投げないで）。 */
	zabuton: "座布団を　投げないで　ください",
	quit: "もう一度　Bで　出る",
} as const;

/** 山場の 1語（4つめの こぶしで 書く）。 */
export const SUMO_WORD = "はっけよい";

/** 立ち合いの 合図（1つめ）・拍・ちょうど（名目の ms）。合図は ゆっくり。 */
export const SUMO_CUE = { at: 92000, beat: 900, pulses: 3 } as const;
export const SUMO_EXACT = SUMO_CUE.at + SUMO_CUE.pulses * SUMO_CUE.beat;

/** 1番目の 取組（乱数で 1つ。速記ニキが 書き写す）。 */
const FIRST = [
	{ east: N.hoshu, west: N.sage, win: "e", how: "寄り切り" },
	{ east: N.jisure, west: N.kakolog, win: "w", how: "はたき込み" },
] as const;

/** 速記ニキの 書き写し（○ 勝ち・● 負け。東が 左）。 */
const sokki = (east: string, how: string, west: string, win: "e" | "w") =>
	`${win === "e" ? "○" : "●"}${east}　${how}　${west}${win === "w" ? "○" : "●"}`;

/**
 * 台本（142秒。pick 13 ＋ Cue）。950 の 当番は 見るだけの スレが 950 に 届く ころ（本番は 時間いっぱい、
 * 再放送は 結びの 勝ち名乗り）に 窓の ない 間を あけて ある（src/sim/jikkyoProgTests.ts の P5）。
 */
const sumoTimeline: JkScript["timeline"] = (rand, slot) => {
	const live = slot.live;
	const day = Math.max(1, Math.min(15, slot.day ?? 1));
	const raku = live && day === 15;
	const first = FIRST[Math.floor(rand() * FIRST.length)];
	// 1番目の 懸賞旗 2本（ちがう 店）と 結びの 懸賞旗（ぜんぶ）
	const k1 = Math.floor(rand() * SUMO_ART.kensho.length);
	const k2 =
		(k1 + 1 + Math.floor(rand() * (SUMO_ART.kensho.length - 1))) %
		SUMO_ART.kensho.length;
	const all = SUMO_ART.kensho.map((_, i) => i);
	const sub = live ? sumoDayName(day) : SUMO_ART.encore;
	const musubi = { east: N.yokozuna, west: N.nanashi, yokozuna: true };
	const bout2 = { east: N.age, west: N.kanso };
	const endCard = !live
		? SUMO_ART.endEncore
		: raku
			? SUMO_ART.endRaku
			: SUMO_ART.end;
	const endWord = !live
		? "また　本場所で"
		: raku
			? "また　来場所"
			: "明日も　見るで";
	const segments: JkScriptSeg[] = [
		{
			at: 0,
			scene: "card",
			pool: "wait",
			rate: 0.5,
			bgm: null,
			data: {
				phase: "soon",
				card: live ? SUMO_ART.soon : SUMO_ART.soonEncore,
			} satisfies SumoData,
		},
		{
			at: 6000,
			scene: "op",
			pool: "op",
			rate: 0.8,
			bgm: "deep_kisei",
			caption: live ? `大相撲　保守場所　${sub}` : SUMO_ART.encore,
			data: { sub } satisfies SumoData,
		},
		// 1番目：仕切り（懸賞旗 2本）→ 取組 → 勝ち名乗り（速記ニキ）
		{
			at: 15000,
			scene: "dohyo",
			pool: "shikiri",
			rate: 0.9,
			bgm: "deep_hakushi",
			caption: "仕切り",
			data: {
				phase: "shikiri",
				east: first.east,
				west: first.west,
				kensho: [k1, k2],
			} satisfies SumoData,
		},
		{
			at: 22500,
			scene: "dohyo",
			pool: "torikumi",
			rate: 1.2,
			data: {
				phase: "bout",
				east: first.east,
				west: first.west,
				win: first.win,
				dur: 2400,
			} satisfies SumoData,
		},
		{
			at: 26500,
			scene: "dohyo",
			pool: "kekka",
			rate: 1,
			posts: [
				{
					at: 700,
					who: "sokki",
					text: sokki(first.east, first.how, first.west, first.win),
					pin: 3500,
				},
			],
			data: {
				phase: "kekka",
				east: first.east,
				west: first.west,
				win: first.win,
				kensho: [k1, k2],
			} satisfies SumoData,
		},
		// 2番目：長い 相撲 → 同体 → 物言い → 取り直し → 関脇の 突き出し
		{
			at: 36500,
			scene: "dohyo",
			pool: "shikiri",
			rate: 0.9,
			caption: "関脇　age富士",
			data: { phase: "shikiri", ...bout2 } satisfies SumoData,
		},
		{
			at: 40000,
			scene: "dohyo",
			pool: "torikumi",
			rate: 1.4,
			caption: "長い　相撲",
			data: {
				phase: "bout",
				...bout2,
				win: "dotai",
				dur: 4800,
			} satisfies SumoData,
		},
		{
			at: 45500,
			scene: "monoii",
			pool: "monoii",
			rate: 1.1,
			bgm: "tense",
			caption: "物言い",
			react: [{ who: "nanashi", text: "物言い　ついた" }],
			data: bout2 satisfies SumoData,
		},
		{
			at: 54500,
			scene: "dohyo",
			pool: "torinaoshi",
			rate: 1.1,
			bgm: "deep_hakushi",
			caption: "同体と　みて　取り直し",
			data: { phase: "shikiri", ...bout2 } satisfies SumoData,
		},
		{
			at: 61500,
			scene: "dohyo",
			pool: "torikumi",
			rate: 1.3,
			data: { phase: "bout", ...bout2, win: "e", dur: 2000 } satisfies SumoData,
		},
		{
			at: 65000,
			scene: "dohyo",
			pool: "kekka",
			rate: 1,
			caption: "関脇　age富士　大関取りへ",
			data: { phase: "kekka", ...bout2, win: "e" } satisfies SumoData,
		},
		// 結び：懸賞旗 ぜんぶ → 時間いっぱい → 立ち合い（山場）→ 横綱が 負けて 座布団 → 速記ニキ
		{
			at: 72500,
			scene: "dohyo",
			pool: "musubi",
			rate: 1.1,
			bgm: "deep_kisei",
			caption: raku
				? "千秋楽　結びの　一番"
				: live
					? "結びの　一番"
					: "名勝負　結びの　一番",
			data: { phase: "musubi", ...musubi, kensho: all } satisfies SumoData,
		},
		{
			at: 81000,
			scene: "dohyo",
			pool: "jikan",
			rate: 1.3,
			bgm: "tense",
			caption: raku ? "勝てば　優勝" : "時間　いっぱい",
			data: { phase: "jikan", ...musubi } satisfies SumoData,
		},
		{
			at: 90500,
			scene: "tachiai",
			pool: "jikan",
			rate: 2.5,
			bgm: null,
			data: {
				...musubi,
				exact: SUMO_EXACT,
				beat: SUMO_CUE.beat,
			} satisfies SumoData,
		},
		{
			at: 97000,
			scene: "zabuton",
			pool: "zabuton",
			rate: 1.6,
			bgm: "town",
			stall: 1200,
			caption: SUMO_THREAD.zabuton,
			data: musubi satisfies SumoData,
		},
		{
			at: 106000,
			scene: "dohyo",
			pool: "kinboshi",
			rate: 1.1,
			caption: raku ? "名無ノ里　平幕優勝" : "名無ノ里　金星",
			posts: [
				{
					at: 5500,
					who: "sokki",
					text: sokki(N.yokozuna, "押し出し", N.nanashi, "w"),
					pin: 4000,
				},
			],
			data: {
				phase: "kekka",
				...musubi,
				win: "w",
				kensho: all,
			} satisfies SumoData,
		},
		raku
			? {
					at: 117500,
					scene: "hyosho",
					pool: "hyosho",
					rate: 0.9,
					bgm: "ending",
					caption: "表彰式",
					data: { west: N.nanashi } satisfies SumoData,
				}
			: {
					at: 117500,
					scene: "yumitori",
					pool: "yumitori",
					rate: 0.9,
					bgm: "ending",
					caption: "弓取式",
				},
		{
			at: 129000,
			scene: "card",
			pool: "hansei",
			rate: 0.6,
			bgm: null,
			data: { phase: "end", card: endCard } satisfies SumoData,
		},
	];
	return {
		segments,
		picks: [
			{
				at: 2000,
				boo: "booStart",
				sets: [
					[B("31"), K("はよ"), X(SUMO_WORD)],
					[B("待機"), K("くるぞ…"), X("乙")],
					[B("きょうも　見る"), K("はよ"), X("金星や！")],
				],
			},
			{
				at: 10000,
				boo: "booStart",
				sets: [
					[B("はじまた"), K("おお"), X("31")],
					[B("きたきた"), K("落ち着く"), X("座布団　投げるな")],
					[B("渋い"), K("この　時間　すき"), X("おやすみ")],
				],
			},
			// 仕切り（まだ 立たない。静かに 見る）
			{
				at: 18000,
				boo: "booEarly",
				sets: [
					[B("見合って"), K("渋い"), X("のこった")],
					[B("塩　まいた"), K("見合って"), X("物言いや")],
					[B("謎に　人多いよな"), K("静かやな"), X("金星や！")],
				],
			},
			// 速記ニキの 書き写しが 上に 止まって いる
			{
				at: 29000,
				boo: "boo",
				sets: [
					[B("サンキュー速記ニキ"), K("つよい"), X("見合って")],
					[B("サンキュー速記ニキ"), K("完勝や"), X("取り直しや")],
					[B("サンキュー速記ニキ"), K("ええ　相撲"), X("31")],
				],
			},
			// 長い 相撲（まだ 勝負は ついて いない）
			{
				at: 40500,
				boo: "boo",
				sets: [
					[B("のこった"), K("うおお"), X("サンキュー速記ニキ")],
					[B("粘れ"), K("のこった"), X("塩　まいた")],
					[B("あぶな"), K("おお"), X("おやすみ")],
				],
			},
			// 物言い（審判が 集まって 協議中）
			{
				at: 49000,
				boo: "boo",
				sets: [
					[B("物言いや"), K("どっちや"), X("サンキュー速記ニキ")],
					[B("同体やろ"), K("長いな"), X("金星や！")],
					[B("スロー　見せて"), K("どっちや"), X("のこった")],
				],
			},
			// 取り直し
			{
				at: 57500,
				boo: "boo",
				sets: [
					[B("取り直しや"), K("もう　1回"), X("物言いや")],
					[B("得した"), K("取り直しや"), X("同体やろ")],
					[B("もう　1回"), K("ええぞ"), X(SUMO_WORD)],
				],
			},
			// 関脇の 突き出し（大関取りへ）
			{
				at: 67500,
				boo: "boo",
				sets: [
					[B("これは大関"), K("ええ　相撲"), X("取り直しや")],
					[B("これは大関"), K("善戦定期"), X("同体やろ")],
					[B("これは大関"), K("つよい"), X("見合って")],
				],
			},
			// 結びの 懸賞旗（立ち合いの 1語は まだ 早い）。このあと 時間いっぱいまでは 窓を 置かない
			// （静かに 待つ 間。950 の 当番が 出られる）
			{
				at: 77500,
				boo: "booEarly",
				sets: [
					[B("懸賞　すごい"), K("結びや"), X(SUMO_WORD)],
					[B("旗　多すぎ"), K("横綱　来た"), X("取り直しや")],
					[B("横綱　来た"), K("名無ノ里　がんばれ"), X("金星や！")],
				],
			},
			// 横綱が 負けて 座布団が 舞う
			{
				at: 99500,
				boo: "booLate",
				sets: [
					[B("金星や！"), K("うおおお"), X("懸賞　すごい")],
					[B("座布団　投げるな"), K("金星や！"), X(SUMO_WORD)],
					[B("大金星"), K("横綱　負けた"), X("塩　まいた")],
				],
			},
			// 速記ニキの 書き写し（結び）。前の 窓との あいだで 950 の 当番が 出られる ように 少し あとに
			{
				at: 113500,
				boo: "boo",
				sets: [
					[B("サンキュー速記ニキ"), K("これは横綱"), X("横綱　来た")],
					[B("サンキュー速記ニキ"), K("名無ノ里　すげえ"), X("見合って")],
				],
			},
			// 弓取式（千秋楽は 表彰式）
			{
				at: 122000,
				boo: "boo",
				sets: raku
					? [
							[B("名無ノ里　おめでとう"), K("優勝杯　でかい"), X("取り直しや")],
							[B("平幕優勝や"), K("泣ける"), X("見合って")],
						]
					: [
							[B("弓取り　すき"), K("ええな"), X("金星や！")],
							[B("ええな"), K("くるくる"), X("物言いや")],
						],
			},
			{
				at: 133000,
				boo: "boo",
				sets: [
					[B("乙"), K("ほな"), X("はじまた")],
					[B("おやすみ"), K("解散"), X("待機")],
					[B(endWord), K("乙"), X("31")],
				],
			},
		],
		cues: [
			{
				...SUMO_CUE,
				word: SUMO_WORD,
				flood: "flood",
				praise: SUMO_THREAD.praise,
				cross: { gap: SUMO_THREAD.crossGap, fresh: SUMO_THREAD.crossFresh },
			},
		],
	};
};

/** スレの 番号（本場所は 日ごとに 続く：初日 Part11 から。再放送は 1 から）。 */
const partOf = (n: number, slot: JkSlot): number =>
	slot.live ? n + 9 + Math.max(1, Math.min(15, slot.day ?? 1)) : n;

/** 大相撲『保守場所』の 台本。 */
export const SUMO: JkScript = {
	id: "sumo",
	venue: "bath",
	length: 142000,
	goal: { live: 3, rerun: 2 },
	pools: SUMO_POOLS,
	title: (n, slot) =>
		(slot.live ? SUMO_THREAD.live : SUMO_THREAD.rerun).replace(
			"{n}",
			String(partOf(n, slot)),
		),
	at1000: () => SUMO_THREAD.get1000,
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
	quitNote: SUMO_THREAD.quit,
	tune: { post: 0.1, boost: 3, comboMin: 20 },
	bands: {
		p50: { miru: [0.52, 0.6], kami: [1.08, 99] },
		kanso: { jouzu: [0.65, 0.8], shoshin: [0.25, 0.45], random: [0, 0.099] },
	},
	timeline: sumoTimeline,
};

/** 本場所（奇数月の 8〜22日）。 */
const isBasho = (t: Today): boolean => t.m % 2 === 1 && t.d >= 8 && t.d <= 22;
const isRaku = (t: Today): boolean => isBasho(t) && t.d === 22;

/** 大相撲『保守場所』。 */
export const SUMO_PACK: JkPack = {
	script: SUMO,
	venue: "bath",
	from: 4,
	menu: "大相撲",
	slot: (t) => (isBasho(t) ? { live: true, day: t.d - 7 } : { live: false }),
	scenes: SUMO_SCENES,
	venueLines: {
		tv: [
			{
				when: isRaku,
				lines: ["脱衣所の　テレビ。\n今日は　保守場所の　千秋楽。"],
			},
			{
				when: isBasho,
				lines: ["脱衣所の　テレビ。\n大相撲『保守場所』の　中継が　映る。"],
			},
			{
				when: () => true,
				lines: ["脱衣所の　テレビ。\n大相撲の　名勝負　アンコール。"],
			},
		],
	},
	msgs: {
		howto: "取組に　合う　レスを　えらぶと、\nスレが　のびる。目標：★{n}　完走",
		seat: "キリコは　脱衣所の　長いすに　すわった。\n……スマホで、実況スレを　ひらく。",
		over: "テレビの　中継が　おわった。\n実況は　★{n}まで　のびた。",
		kanso: "……完走。\n番台の　名無しが、小さく　うなずいた。",
		kami: "あの　はっけよい、\nぴったりの　立ち合いだった。",
		left: "……中継の　とちゅうで、\nそっと　長いすを　立った。",
	},
	art: [
		...Object.values(SUMO_ART).flatMap((v) =>
			typeof v === "string" ? [v] : [...v],
		),
		SUMO_THREAD.zabuton,
	],
	deny: [
		"白鵬",
		"照ノ富士",
		"大の里",
		"豊昇龍",
		"朝青龍",
		"貴乃花",
		"若乃花",
		"千代の富士",
		"大鵬",
		"北の湖",
		"稀勢の里",
		"曙",
		"武蔵丸",
		"日本相撲協会",
		"相撲協会",
		"国技館",
		"両国",
		"大相撲中継",
		"賜杯",
	],
	names: ["保守場所", "保守ノ海"],
};
