// 午後の　B級映画『メガ荒らしザメ』（映画館「スクリーン1000」の 昼の部。PROGRAMS §1.6 の サメ映画の パロディ）。
// 夏の おんJ浜に、なぜか 竜巻に 乗って 荒らしザメが 来る。サメは 陸に 上がって ヒレで 歩き、頭が 3つに 増え、
// 海の家の 焼きそばを 荒らす。海の家の 店主が 特大の 打ち上げ花火を 投げると、サメは それを のみこんで 空へ ——
// 昼の 空で 花火に なって 解決（爆発で 解決）。エンドロールの あと、海に また ヒレが 1つ（続編の 予告）。
// - 芯：B級の お約束（竜巻・陸に 上がる・頭が 増える・爆発で 解決・続編の 予告・安い CG）に 群衆の 定番で つっこむ 窓と、
//   いちばん バカな 場面（サメが 花火に なる）で 1語「たまやー」（Cue。導火線の 火花が 3回、4拍目で 打つ）。
// - 番号ボケ：スレタイは 続編の 番号（★2 は『メガ荒らしザメ2』、★3 は『メガ荒らしザメ3』…）。
// - 題・筋は 板の しゃれで 作った 架空の もの（荒らし＋サメ、荒らし＝嵐）。実在の 映画の 題・台詞・人物・曲・局は 使わない。
//   群衆の 文は 手で 書いた 一覧だけ。だれも けがを しない（サメは 焼きそばを 荒らす だけ、花火に なって 消える）。
// - キリコが 書ける 文（候補・当番・山場の 1語）には「保守」「立てといた」「立てたる」「立てたで」を 入れない。
//   群衆・題・字幕・会場の 文の「保守」は 固有名詞（おんJタウン・おんJ浜）の 中だけ。
// - 月〜金は 昼の部の 本上映（★4）、土日は 再上映（★2。群衆に「再放送　乙」が まざる）。
// - 文の 幅：レス 12・候補 10・スレタイ・字幕・pin・絵の 字 22（全角）。試験は src/sim/jikkyoProgTests.ts。
// 絵は ui/jikkyo/jikkyoGogoTv.ts（場面の 鍵は GOGO_SCENES、絵に 出す 文は GOGO_ART）。

import type {
	JkFit,
	JkOpt,
	JkScript,
	JkScriptSeg,
	JkSlot,
} from "../../core/jikkyo";
import type { Today } from "../town/calendar";
import { type JkPack, liveOr, onWeekdays } from "./pack";

const o = (text: string, fit: JkFit): JkOpt => ({ text, fit });
const B = (t: string) => o(t, "best");
const K = (t: string) => o(t, "ok");
const X = (t: string) => o(t, "miss");

/** 場面の 鍵（カード・OP・浜・竜巻・陸・CM・山場・エンディング）。 */
export const GOGO_SCENES = [
	"card",
	"op",
	"hama",
	"tatsumaki",
	"riku",
	"cm",
	"hanabi",
	"ed",
] as const;

/** 場面の 小さな 中身（TV が 読む）。 */
export type GogoData = {
	/**
	 * card：まもなく・予告・おわり／riku：頭が 増える・店主が 花火を かつぐ／
	 * hanabi：のみこむ・合図・花火・平和。
	 */
	readonly phase?:
		| "soon"
		| "preview"
		| "end"
		| "atama"
		| "ume"
		| "pre"
		| "cue"
		| "boom"
		| "after";
	/** cm：GOGO_ART.cm の 番。 */
	readonly cm?: number;
	/** card の 大きな 文。 */
	readonly card?: string;
	/** 山場の ちょうどの 名目の ms。 */
	readonly exact?: number;
};

/** 絵に 出す 文（どれも 全角 22字まで）。 */
export const GOGO_ART = {
	logo: "午後のB級映画",
	title: "『メガ荒らしザメ』",
	soon: "まもなくはじまります",
	end: "本日の上映はおわりました",
	hut: "age",
	sign: "サメ注意",
	fin: "おわり……？",
	cmTag: "CM",
	/** CM（午後は 通販が 多い。村の 店だけ）。 */
	cm: [
		{ shop: "麺屋「乙」", line: "昼は大盛り無料" },
		{
			shop: "リサイクルショップ「おさがり」",
			line: "今ならもう1つついてくる",
		},
		{ shop: "ファミレス「ドリンクバー」", line: "午後はドリンクバーで" },
	],
	/** スタッフロール（役は ぜんぶ 名無しさん）。 */
	staff: [
		"サメ名無しさん",
		"竜巻名無しさん",
		"CG　名無しさん",
		"爆発名無しさん",
		"脚本名無しさん",
		"監督名無しさん",
	],
} as const;

/** 予告（dyn：予告の 中身で ◎ が かわる）。同じ サメの 続編か、別の サメか。 */
export const GOGO_PREVIEW = [
	{
		card: "次回『メガ荒らしザメ2』",
		set: [B("続編あるんか"), K("たのしみ"), X("またサメか")],
	},
	{
		card: "次回『過去ログザメ』",
		set: [B("またサメか"), K("たのしみ"), X("続編あるんか")],
	},
] as const;

/** 群衆の 文（手で 書いた 白い 一覧。レスは 全角 12字まで）。 */
export const GOGO_POOLS = {
	wait: [
		"31",
		"サンイチ",
		"待機",
		"はよ",
		"午後はこれや",
		"仕事しろ",
		"サボりか？",
		"昼飯食った",
		"B級の時間や",
	],
	op: [
		"はじまた",
		"きたあ",
		"B級すぎる",
		"題でわかる",
		"安そう",
		"サメや！",
		"予算どこ",
	],
	hama: [
		"平和やな",
		"おんJタウンやん",
		"海きれい",
		"ヒレ出とる",
		"フラグや",
		"泳ぐな",
		"絶対来る",
	],
	tatsumaki: [
		"竜巻？",
		"なんでや",
		"サメ飛んどる",
		"なんで竜巻",
		"物理どこ",
		"空からサメ",
		"B級すぎる",
	],
	riku: [
		"サメなんで陸に",
		"歩いとる",
		"ヒレで歩くな",
		"CG　しょぼい",
		"合成バレバレ",
		"足ないやろ",
		"陸はずるい",
	],
	atama: [
		"頭増えたぞ",
		"なんで増える",
		"3つあるやん",
		"首どうなっとる",
		"欲ばりセット",
		"B級すぎる",
		"もう1個来た",
	],
	ume: [
		"くるぞ…",
		"まさか",
		"花火？",
		"なにする気や",
		"嫌な予感",
		"店主有能",
		"ksk",
	],
	cm: [
		"ここでCM",
		"CM　なげえ",
		"トイレ行ってくる",
		"通販多いな",
		"今北産業",
		"昼寝しそう",
		"ここでCMはずるい",
	],
	/** 洪水（ほかの pool・react と 同じ 文を 入れない：直近の 数えかたが 試験と ずれる）。 */
	flood: ["たまやー", "たまやー！", "かぎやー", "たまや〜", "草"],
	after: [
		"爆発オチ",
		"なんでや",
		"解決した",
		"雑すぎる",
		"ええんかこれ",
		"昼やのに花火",
		"B級すぎる",
	],
	ed: [
		"8888",
		"いいB級やった",
		"終わっちゃった",
		"なんやこれ",
		"時間返せ",
		"嫌いじゃない",
		"ヒレ出とる",
		"続編あるんか",
	],
	preview: ["続編あるんか", "またサメか", "またそれかよ", "たのしみ", "見るで"],
	hansei: [
		"反省会や",
		"乙",
		"ほな",
		"仕事戻るわ",
		"解散",
		"次も見るで",
		"夕飯なんや",
	],
	rerun: ["再放送乙", "これ見たで", "何回やるねん", "2回目や", "土日もサメ"],
	gap: ["次スレどこ？", "乱立すな", "950ちうい", "誰か踏め"],
	open: ["31", "サンイチ", "たておつ", "スレ立て乙"],
	boo: ["は？", "なんて？"],
	booStart: ["はじまったばっかや", "まだ早い"],
	booEarly: ["まだ早い", "は？"],
	booLate: ["もう爆発したで", "は？"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ見とるんや"],
	/** 1000 の 流れの 予備（群衆の 区切りが ない とき）。 */
	nanashi: ["くるぞ…", "はよ"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句（{n} は 続編の 番号。★1 は 番号なし）。 */
export const GOGO_THREAD = {
	live: "【午後B実況】メガ荒らしザメ{n}",
	rerun: "【再上映】メガ荒らしザメ{n}",
	liveHansei: "【反省会】メガ荒らしザメ{n}",
	rerunHansei: "【再上映・反省会】メガ荒らしザメ{n}",
	get1000: "1000なら続編決定",
	praise: ">>{n}　神エイム",
	crossGap: "次スレでたまやー",
	crossFresh: "新スレでたまやーできた",
	quit: "もう一度Bで出る",
} as const;

/** 続編の 番号（★1 は 番号なし、★2 から『…2』）。 */
const sequel = (s: string, n: number) =>
	s.replace("{n}", n <= 1 ? "" : String(n));

/** いちばん バカな 場面（サメが 花火に なる）の 1語。 */
export const GOGO_WORD = "たまやー";

/** 山場の 合図（1つめ）・拍・ちょうど（名目の ms）。 */
export const GOGO_CUE = { at: 93000, beat: 800, pulses: 3 } as const;
export const GOGO_EXACT = GOGO_CUE.at + GOGO_CUE.pulses * GOGO_CUE.beat;

/** 台本（146秒。pick 13 ＋ Cue）。 */
const gogoTimeline: JkScript["timeline"] = (rand, slot) => {
	const hansei = (n: number) =>
		sequel(slot.live ? GOGO_THREAD.liveHansei : GOGO_THREAD.rerunHansei, n);
	const cm = Math.floor(rand() * GOGO_ART.cm.length);
	const preview = GOGO_PREVIEW[Math.floor(rand() * GOGO_PREVIEW.length)];
	const segments: JkScriptSeg[] = [
		{
			at: 0,
			scene: "card",
			pool: "wait",
			rate: 0.5,
			bgm: null,
			caption: GOGO_ART.soon,
			data: { phase: "soon", card: GOGO_ART.soon } satisfies GogoData,
		},
		{ at: 6000, scene: "op", pool: "op", rate: 1, bgm: "retro2" },
		{
			at: 16000,
			scene: "hama",
			pool: "hama",
			rate: 1.1,
			bgm: "island",
			caption: "夏のおんJ浜にヒレが1つ",
		},
		{
			at: 30000,
			scene: "tatsumaki",
			pool: "tatsumaki",
			rate: 1.2,
			bgm: "deep_kisei",
			caption: "なぜか竜巻がサメを運ぶ",
		},
		{
			at: 42000,
			scene: "riku",
			pool: "riku",
			rate: 1.3,
			bgm: "battle",
			caption: "サメが陸に上がった",
		},
		{
			at: 56000,
			scene: "riku",
			pool: "atama",
			rate: 1.3,
			bgm: "boss",
			caption: "サメの頭が増えていく",
			data: { phase: "atama" } satisfies GogoData,
		},
		{
			at: 70000,
			scene: "riku",
			pool: "ume",
			rate: 1.6,
			bgm: "tense",
			caption: "海の家の店主が花火をかつぐ",
			data: { phase: "ume" } satisfies GogoData,
		},
		{
			at: 78000,
			scene: "cm",
			pool: "cm",
			rate: 0.8,
			bgm: "retro",
			caption: "このあとサメが空へ！",
			react: [{ who: "nanashi", text: "ここでCMはずるい" }],
			data: { cm } satisfies GogoData,
		},
		{
			at: 86000,
			scene: "hanabi",
			pool: "ume",
			rate: 1.4,
			bgm: "tense",
			caption: "サメが花火をのみこんだ",
			data: { phase: "pre" } satisfies GogoData,
		},
		{
			at: 92000,
			scene: "hanabi",
			pool: "ume",
			rate: 3.5,
			bgm: null,
			data: { phase: "cue", exact: GOGO_EXACT } satisfies GogoData,
		},
		{
			at: 97000,
			scene: "hanabi",
			pool: "after",
			rate: 1.2,
			react: [{ who: "nanashi", text: "昼やのに花火" }],
			data: { phase: "boom", exact: GOGO_EXACT } satisfies GogoData,
		},
		{
			at: 102000,
			scene: "hanabi",
			pool: "after",
			rate: 1.3,
			bgm: "town",
			caption: "おんJ浜に平和がもどった",
			data: { phase: "after" } satisfies GogoData,
		},
		{ at: 114000, scene: "ed", pool: "ed", rate: 1.1, bgm: "ending" },
		{
			at: 128000,
			scene: "card",
			pool: "preview",
			rate: 0.9,
			bgm: "retro2",
			caption: preview.card,
			data: { phase: "preview", card: preview.card } satisfies GogoData,
		},
		{
			at: 136000,
			scene: "card",
			pool: "hansei",
			rate: 0.7,
			bgm: null,
			caption: GOGO_ART.end,
			title: { now: hansei },
			data: { phase: "end", card: GOGO_ART.end } satisfies GogoData,
		},
	];
	return {
		segments,
		picks: [
			{
				at: 2000,
				boo: "booStart",
				sets: [
					[B("31"), K("はよ"), X("はじまた")],
					[B("午後はこれや"), K("待機"), X(GOGO_WORD)],
					[B("仕事しろ"), K("サボりか？"), X("8888")],
				],
			},
			// タイトル：安い CG の 題が 出る
			{
				at: 11000,
				boo: "booStart",
				sets: [
					[B("はじまた"), K("安そう"), X("31")],
					[B("B級すぎる"), K("題でわかる"), X("乙")],
					[B("CG　しょぼい"), K("サメや！"), X("8888")],
				],
			},
			// 浜：泳ぐ 人の 向こうを ヒレが 横切る
			{
				at: 22000,
				boo: "boo",
				sets: [
					[B("平和やな"), K("海きれい"), X("サメなんで陸に")],
					[B("ヒレ出とる"), K("泳ぐな"), X("頭増えたぞ")],
					[B("フラグや"), K("平和やな"), X(GOGO_WORD)],
				],
			},
			// なぜか 竜巻
			{
				at: 34000,
				boo: "boo",
				sets: [
					[B("なんで竜巻"), K("空からサメ"), X("平和やな")],
					[B("サメ飛んどる"), K("物理どこ"), X("仕事しろ")],
					[B("B級すぎる"), K("なんでや"), X("フラグや")],
				],
			},
			// 陸に 上がる（ヒレで 歩く。緑の ふちの 合成）
			{
				at: 49000,
				boo: "boo",
				sets: [
					[B("サメなんで陸に"), K("歩いとる"), X("なんで竜巻")],
					[B("CG　しょぼい"), K("合成バレバレ"), X("平和やな")],
					[B("ヒレで歩くな"), K("足ないやろ"), X(GOGO_WORD)],
				],
			},
			// 頭が 増える（1.5秒ごとに 1つ）
			{
				at: 61000,
				boo: "boo",
				sets: [
					[B("頭増えたぞ"), K("3つあるやん"), X("サメ飛んどる")],
					[B("なんで増える"), K("B級すぎる"), X("はじまた")],
					[B("3つあるやん"), K("欲ばりセット"), X("平和やな")],
				],
			},
			// 店主が 花火を かついで 前に 出る（区切りの 2秒 あと。再上映の 帯は この 位置で 合わせた）
			{
				at: 72000,
				boo: "boo",
				sets: [
					[B("くるぞ…"), K("まさか"), X("8888")],
					[B("店主有能"), K("花火？"), X("仕事しろ")],
					[B("なにする気や"), K("嫌な予感"), X("頭増えたぞ")],
				],
			},
			{
				at: 79000,
				boo: "booEarly",
				sets: [
					[B("ここでCM"), K("トイレ行く"), X(GOGO_WORD)],
					[B("CM　なげえ"), K("通販多いな"), X(GOGO_WORD)],
					[B("通販多いな"), K("CM　なげえ"), X("店主有能")],
				],
			},
			// のみこむ（山場の 前）
			{
				at: 86500,
				boo: "booEarly",
				sets: [
					[B("くるぞ…"), K("まさか"), X("今北産業")],
					[B("食いよった"), K("嫌な予感"), X(GOGO_WORD)],
					[B("まさか"), K("くるぞ…"), X("8888")],
				],
			},
			// 花火の あと（爆発で 解決）
			{
				at: 106000,
				boo: "booLate",
				sets: [
					[B("爆発オチ"), K("解決した"), X(GOGO_WORD)],
					[B("雑すぎる"), K("昼やのに花火"), X("くるぞ…")],
					[B("解決した"), K("ええんかこれ"), X("頭増えたぞ")],
				],
			},
			// エンドロール（海に また ヒレ）
			{
				at: 118000,
				boo: "boo",
				sets: [
					[B("8888"), K("終わっちゃった"), X("はじまた")],
					[B("嫌いじゃない"), K("時間返せ"), X("くるぞ…")],
					[B("続編あるんか"), K("ヒレ出とる"), X("31")],
				],
			},
			// 予告の 中身で ◎ が かわる（続編なら「続編　あるんか」、別の サメなら「また　サメか」）
			{ at: 131000, boo: "boo", sets: [preview.set] },
			{
				at: 137000,
				boo: "boo",
				sets: [
					[B("乙"), K("反省会や"), X("はじまた")],
					[B("仕事戻るわ"), K("解散"), X("くるぞ…")],
					[B("ほな"), K("次も見るで"), X("31")],
				],
			},
		],
		cues: [
			{
				...GOGO_CUE,
				word: GOGO_WORD,
				flood: "flood",
				praise: GOGO_THREAD.praise,
				cross: { gap: GOGO_THREAD.crossGap, fresh: GOGO_THREAD.crossFresh },
			},
		],
	};
};

/** 午後の　B級映画『メガ荒らしザメ』。 */
export const GOGO: JkScript = {
	id: "gogo",
	venue: "cinema",
	length: 146000,
	goal: { live: 4, rerun: 2 },
	pools: GOGO_POOLS,
	title: (n, slot) =>
		sequel(slot.live ? GOGO_THREAD.live : GOGO_THREAD.rerun, n),
	at1000: () => GOGO_THREAD.get1000,
	open: "open",
	gapPool: "gap",
	duty: {
		pin: "950ちうい",
		first: [B("立ててくる"), K("誰か踏め"), X("ksk")],
		variants: [
			{
				pin: "スレ立て規制中です",
				opts: [B("誰か頼む"), K("誰か踏め"), X("立ててくる")],
			},
			{
				pin: "次スレできたで",
				opts: [B("たておつ"), K("乙"), X("立ててくる")],
			},
			// 乱立も サメの 頭の ように 3つ
			{
				pin: "★{m}が3つあるぞ",
				opts: [B("誘導しとく"), K("サメの頭か"), X("全部に書く")],
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
	quitNote: GOGO_THREAD.quit,
	// 帯：『空飛ぶ鯖』と 同じ 決まりと 同じ はば（P4 の 種で 本上映 上手 76%・初心者 32%、再上映 76%・26%、
	// 見るだけ 0.57G・神 1.35G・random 0%）。再上映の 初心者は 店主の 窓（72秒）の 位置で 帯に 入れた
	tune: { post: 0.1, boost: 3, comboMin: 20 },
	bands: {
		p50: { miru: [0.52, 0.6], kami: [1.08, 99] },
		kanso: { jouzu: [0.65, 0.8], shoshin: [0.25, 0.45], random: [0, 0.099] },
	},
	timeline: gogoTimeline,
};

// ───────────────── 会場の 文 ─────────────────

/** 月〜木（金曜は 前からの 表の 金曜ロード保守が 先に 出る）。 */
const monThu = (t: Today): boolean => t.w >= 1 && t.w <= 4;
const weekend = (t: Today): boolean => t.w === 0 || t.w === 6;

/** 午後の　B級映画（映画館の 昼の部）。 */
export const GOGO_PACK: JkPack = {
	script: GOGO,
	venue: "cinema",
	from: 7,
	menu: "昼の部",
	slot: liveOr(onWeekdays(1, 2, 3, 4, 5)),
	scenes: GOGO_SCENES,
	venueLines: {
		screen: [
			{
				when: monThu,
				lines: ["スクリーン。\n昼は『メガ荒らしザメ』、夜は再上映。"],
			},
			{
				when: weekend,
				lines: ["スクリーン。\n今日は昼も夜も再上映。"],
			},
		],
		poster: [
			{
				when: monThu,
				lines: ["昼の部『メガ荒らしザメ』\n平日の午後は実況上映"],
			},
			{ when: weekend, lines: ["昼の部『メガ荒らしザメ』\n土日は再上映"] },
		],
		seat: [
			{
				when: monThu,
				lines: ["客席。\n平日の昼間なのに、けっこういる。"],
			},
			{ when: weekend, lines: ["客席。\nサメ映画の常連がすわっている。"] },
		],
	},
	staffLines: {
		cinema_staff: [
			{
				when: monThu,
				lines: ["昼の部はB級映画の実況上映や。\n……今週もサメやで"],
			},
		],
	},
	staffOnce: {
		cinema_staff: {
			kami: "この前のたまやー、\nぴったりやったな",
			rerun: "この前のサメは★{n}までのびたな。\n平日の昼は、もっとのびるで",
		},
	},
	msgs: {
		seat: "キリコは昼の部の席についた。\n……スマホで、実況スレをひらく。",
		over: "エンドロールがおわった。\n実況は★{n}までのびた。",
		kanso: "……完走。\n外はまだ明るい。",
		kami: "あのたまやーは、\nぴったりの一瞬だった。",
		left: "……サメのとちゅうで、\nそっと席を立った。",
	},
	art: [
		GOGO_ART.logo,
		GOGO_ART.title,
		GOGO_ART.soon,
		GOGO_ART.end,
		GOGO_ART.hut,
		GOGO_ART.sign,
		GOGO_ART.fin,
		GOGO_ART.cmTag,
		...GOGO_ART.cm.flatMap((c) => [c.shop, c.line]),
		...GOGO_ART.staff,
		...GOGO_PREVIEW.map((p) => p.card),
	],
	names: ["おんJ浜"],
	deny: [
		"ジョーズ",
		"JAWS",
		"シャークネード",
		"ディープ・ブルー",
		"ディープブルー",
		"MEG",
		"メガロドン",
		"メガ・シャーク",
		"シャークトパス",
		"アサイラム",
		"午後のロードショー",
		"午後ロー",
		"テレビ東京",
		"テレ東",
	],
};
