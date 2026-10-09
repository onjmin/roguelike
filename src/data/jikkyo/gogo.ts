// 午後の　B級映画『メガ荒らしザメ』（映画館「スクリーン1000」の 昼の部。PROGRAMS §1.6 の サメ映画の パロディ）。
// 夏の 保守浜に、なぜか 竜巻に 乗って 荒らしザメが 来る。サメは 陸に 上がって ヒレで 歩き、頭が 3つに 増え、
// 海の家の 焼きそばを 荒らす。海の家の 店主が 特大の 打ち上げ花火を 投げると、サメは それを のみこんで 空へ ——
// 昼の 空で 花火に なって 解決（爆発で 解決）。エンドロールの あと、海に また ヒレが 1つ（続編の 予告）。
// - 芯：B級の お約束（竜巻・陸に 上がる・頭が 増える・爆発で 解決・続編の 予告・安い CG）に 群衆の 定番で つっこむ 窓と、
//   いちばん バカな 場面（サメが 花火に なる）で 1語「たまやー」（Cue。導火線の 火花が 3回、4拍目で 打つ）。
// - 番号ボケ：スレタイは 続編の 番号（★2 は『メガ荒らしザメ2』、★3 は『メガ荒らしザメ3』…）。
// - 題・筋は 板の しゃれで 作った 架空の もの（荒らし＋サメ、荒らし＝嵐）。実在の 映画の 題・台詞・人物・曲・局は 使わない。
//   群衆の 文は 手で 書いた 一覧だけ。だれも けがを しない（サメは 焼きそばを 荒らす だけ、花火に なって 消える）。
// - キリコが 書ける 文（候補・当番・山場の 1語）には「保守」「立てといた」「立てたる」「立てたで」を 入れない。
//   群衆・題・字幕・会場の 文の「保守」は 固有名詞（保守村・保守浜）の 中だけ。
// - 月〜金は 昼の部の 本上映（★4）、土日は 再上映（★2。群衆に「再放送　乙」が まざる）。
// - 文の 幅：レス 12・候補 10・スレタイ・字幕・pin・絵の 字 22（全角）。試験は src/sim/jikkyoProgTests.ts。
// 絵は ui/jikkyoGogoTv.ts（場面の 鍵は GOGO_SCENES、絵に 出す 文は GOGO_ART）。

import type {
	JkFit,
	JkOpt,
	JkScript,
	JkScriptSeg,
	JkSlot,
} from "../../core/jikkyo";
import type { Today } from "../calendar";
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
	logo: "午後の　B級映画",
	title: "『メガ荒らしザメ』",
	soon: "まもなく　はじまります",
	end: "本日の　上映は　おわりました",
	hut: "age",
	sign: "サメ　注意",
	fin: "おわり……？",
	cmTag: "CM",
	/** CM（午後は 通販が 多い。村の 店だけ）。 */
	cm: [
		{ shop: "麺屋「乙」", line: "昼は　大盛り　無料" },
		{
			shop: "リサイクルショップ「おさがり」",
			line: "今なら　もう1つ　ついてくる",
		},
		{ shop: "ファミレス「ドリンクバー」", line: "午後は　ドリンクバーで" },
	],
	/** スタッフロール（役は ぜんぶ 名無しさん）。 */
	staff: [
		"サメ　名無しさん",
		"竜巻　名無しさん",
		"CG　名無しさん",
		"爆発　名無しさん",
		"脚本　名無しさん",
		"監督　名無しさん",
	],
} as const;

/** 予告（dyn：予告の 中身で ◎ が かわる）。同じ サメの 続編か、別の サメか。 */
export const GOGO_PREVIEW = [
	{
		card: "次回『メガ荒らしザメ2』",
		set: [B("続編　あるんか"), K("たのしみ"), X("また　サメか")],
	},
	{
		card: "次回『過去ログザメ』",
		set: [B("また　サメか"), K("たのしみ"), X("続編　あるんか")],
	},
] as const;

/** 群衆の 文（手で 書いた 白い 一覧。レスは 全角 12字まで）。 */
export const GOGO_POOLS = {
	wait: [
		"31",
		"サンイチ",
		"待機",
		"はよ",
		"午後は　これや",
		"仕事　しろ",
		"サボりか？",
		"昼飯　食った",
		"B級の　時間や",
	],
	op: [
		"はじまた",
		"きたあ",
		"B級すぎる",
		"題で　わかる",
		"安そう",
		"サメや！",
		"予算　どこ",
	],
	hama: [
		"平和やな",
		"保守村やん",
		"海　きれい",
		"ヒレ　出とる",
		"フラグや",
		"泳ぐな",
		"絶対　来る",
	],
	tatsumaki: [
		"竜巻？",
		"なんでや",
		"サメ　飛んどる",
		"なんで　竜巻",
		"物理　どこ",
		"空から　サメ",
		"B級すぎる",
	],
	riku: [
		"サメ　なんで　陸に",
		"歩いとる",
		"ヒレで　歩くな",
		"CG　しょぼい",
		"合成　バレバレ",
		"足　ないやろ",
		"陸は　ずるい",
	],
	atama: [
		"頭　増えたぞ",
		"なんで　増える",
		"3つ　あるやん",
		"首　どう　なっとる",
		"欲ばり　セット",
		"B級すぎる",
		"もう　1個　来た",
	],
	ume: [
		"くるぞ…",
		"まさか",
		"花火？",
		"なにする　気や",
		"嫌な　予感",
		"店主　有能",
		"ksk",
	],
	cm: [
		"ここで　CM",
		"CM　なげえ",
		"トイレ　行ってくる",
		"通販　多いな",
		"今北産業",
		"昼寝　しそう",
		"ここで　CMは　ずるい",
	],
	/** 洪水（ほかの pool・react と 同じ 文を 入れない：直近の 数えかたが 試験と ずれる）。 */
	flood: ["たまやー", "たまやー！", "かぎやー", "たまや〜", "草"],
	after: [
		"爆発オチ",
		"なんでや",
		"解決した",
		"雑すぎる",
		"ええんか　これ",
		"昼やのに　花火",
		"B級すぎる",
	],
	ed: [
		"8888",
		"いい　B級やった",
		"終わっちゃった",
		"なんや　これ",
		"時間　返せ",
		"嫌いじゃ　ない",
		"ヒレ　出とる",
		"続編　あるんか",
	],
	preview: [
		"続編　あるんか",
		"また　サメか",
		"また　それかよ",
		"たのしみ",
		"見るで",
	],
	hansei: [
		"反省会や",
		"乙",
		"ほな",
		"仕事　戻るわ",
		"解散",
		"次も　見るで",
		"夕飯　なんや",
	],
	rerun: [
		"再放送　乙",
		"これ　見たで",
		"何回　やるねん",
		"2回目や",
		"土日も　サメ",
	],
	gap: ["次スレ　どこ？", "乱立すな", "950ちうい", "誰か踏め"],
	open: ["31", "サンイチ", "たておつ", "スレ立て　乙"],
	boo: ["は？", "なんて？"],
	booStart: ["はじまった　ばっかや", "まだ　早い"],
	booEarly: ["まだ　早い", "は？"],
	booLate: ["もう　爆発したで", "は？"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ　見とるんや"],
	/** 1000 の 流れの 予備（群衆の 区切りが ない とき）。 */
	nanashi: ["くるぞ…", "はよ"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句（{n} は 続編の 番号。★1 は 番号なし）。 */
export const GOGO_THREAD = {
	live: "【午後B実況】メガ荒らしザメ{n}",
	rerun: "【再上映】メガ荒らしザメ{n}",
	liveHansei: "【反省会】メガ荒らしザメ{n}",
	rerunHansei: "【再上映・反省会】メガ荒らしザメ{n}",
	get1000: "1000なら　続編　決定",
	praise: ">>{n}　神エイム",
	crossGap: "次スレで　たまやー",
	crossFresh: "新スレで　たまやー　できた",
	quit: "もう一度　Bで　出る",
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
			caption: "夏の　保守浜に　ヒレが　1つ",
		},
		{
			at: 30000,
			scene: "tatsumaki",
			pool: "tatsumaki",
			rate: 1.2,
			bgm: "deep_kisei",
			caption: "なぜか　竜巻が　サメを　運ぶ",
		},
		{
			at: 42000,
			scene: "riku",
			pool: "riku",
			rate: 1.3,
			bgm: "battle",
			caption: "サメが　陸に　上がった",
		},
		{
			at: 56000,
			scene: "riku",
			pool: "atama",
			rate: 1.3,
			bgm: "boss",
			caption: "サメの　頭が　増えていく",
			data: { phase: "atama" } satisfies GogoData,
		},
		{
			at: 70000,
			scene: "riku",
			pool: "ume",
			rate: 1.6,
			bgm: "tense",
			caption: "海の家の　店主が　花火を　かつぐ",
			data: { phase: "ume" } satisfies GogoData,
		},
		{
			at: 78000,
			scene: "cm",
			pool: "cm",
			rate: 0.8,
			bgm: "retro",
			caption: "この　あと　サメが　空へ！",
			react: [{ who: "nanashi", text: "ここで　CMは　ずるい" }],
			data: { cm } satisfies GogoData,
		},
		{
			at: 86000,
			scene: "hanabi",
			pool: "ume",
			rate: 1.4,
			bgm: "tense",
			caption: "サメが　花火を　のみこんだ",
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
			react: [{ who: "nanashi", text: "昼やのに　花火" }],
			data: { phase: "boom", exact: GOGO_EXACT } satisfies GogoData,
		},
		{
			at: 102000,
			scene: "hanabi",
			pool: "after",
			rate: 1.3,
			bgm: "town",
			caption: "保守浜に　平和が　もどった",
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
					[B("午後は　これや"), K("待機"), X(GOGO_WORD)],
					[B("仕事　しろ"), K("サボりか？"), X("8888")],
				],
			},
			// タイトル：安い CG の 題が 出る
			{
				at: 11000,
				boo: "booStart",
				sets: [
					[B("はじまた"), K("安そう"), X("31")],
					[B("B級すぎる"), K("題で　わかる"), X("乙")],
					[B("CG　しょぼい"), K("サメや！"), X("8888")],
				],
			},
			// 浜：泳ぐ 人の 向こうを ヒレが 横切る
			{
				at: 22000,
				boo: "boo",
				sets: [
					[B("平和やな"), K("海　きれい"), X("サメ　なんで　陸に")],
					[B("ヒレ　出とる"), K("泳ぐな"), X("頭　増えたぞ")],
					[B("フラグや"), K("平和やな"), X(GOGO_WORD)],
				],
			},
			// なぜか 竜巻
			{
				at: 34000,
				boo: "boo",
				sets: [
					[B("なんで　竜巻"), K("空から　サメ"), X("平和やな")],
					[B("サメ　飛んどる"), K("物理　どこ"), X("仕事　しろ")],
					[B("B級すぎる"), K("なんでや"), X("フラグや")],
				],
			},
			// 陸に 上がる（ヒレで 歩く。緑の ふちの 合成）
			{
				at: 49000,
				boo: "boo",
				sets: [
					[B("サメ　なんで　陸に"), K("歩いとる"), X("なんで　竜巻")],
					[B("CG　しょぼい"), K("合成　バレバレ"), X("平和やな")],
					[B("ヒレで　歩くな"), K("足　ないやろ"), X(GOGO_WORD)],
				],
			},
			// 頭が 増える（1.5秒ごとに 1つ）
			{
				at: 61000,
				boo: "boo",
				sets: [
					[B("頭　増えたぞ"), K("3つ　あるやん"), X("サメ　飛んどる")],
					[B("なんで　増える"), K("B級すぎる"), X("はじまた")],
					[B("3つ　あるやん"), K("欲ばり　セット"), X("平和やな")],
				],
			},
			// 店主が 花火を かついで 前に 出る（区切りの 2秒 あと。再上映の 帯は この 位置で 合わせた）
			{
				at: 72000,
				boo: "boo",
				sets: [
					[B("くるぞ…"), K("まさか"), X("8888")],
					[B("店主　有能"), K("花火？"), X("仕事　しろ")],
					[B("なにする　気や"), K("嫌な　予感"), X("頭　増えたぞ")],
				],
			},
			{
				at: 79000,
				boo: "booEarly",
				sets: [
					[B("ここで　CM"), K("トイレ　行く"), X(GOGO_WORD)],
					[B("CM　なげえ"), K("通販　多いな"), X(GOGO_WORD)],
					[B("通販　多いな"), K("CM　なげえ"), X("店主　有能")],
				],
			},
			// のみこむ（山場の 前）
			{
				at: 86500,
				boo: "booEarly",
				sets: [
					[B("くるぞ…"), K("まさか"), X("今北産業")],
					[B("食いよった"), K("嫌な　予感"), X(GOGO_WORD)],
					[B("まさか"), K("くるぞ…"), X("8888")],
				],
			},
			// 花火の あと（爆発で 解決）
			{
				at: 106000,
				boo: "booLate",
				sets: [
					[B("爆発オチ"), K("解決した"), X(GOGO_WORD)],
					[B("雑すぎる"), K("昼やのに　花火"), X("くるぞ…")],
					[B("解決した"), K("ええんか　これ"), X("頭　増えたぞ")],
				],
			},
			// エンドロール（海に また ヒレ）
			{
				at: 118000,
				boo: "boo",
				sets: [
					[B("8888"), K("終わっちゃった"), X("はじまた")],
					[B("嫌いじゃ　ない"), K("時間　返せ"), X("くるぞ…")],
					[B("続編　あるんか"), K("ヒレ　出とる"), X("31")],
				],
			},
			// 予告の 中身で ◎ が かわる（続編なら「続編　あるんか」、別の サメなら「また　サメか」）
			{ at: 131000, boo: "boo", sets: [preview.set] },
			{
				at: 137000,
				boo: "boo",
				sets: [
					[B("乙"), K("反省会や"), X("はじまた")],
					[B("仕事　戻るわ"), K("解散"), X("くるぞ…")],
					[B("ほな"), K("次も　見るで"), X("31")],
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
				pin: "スレ立て　規制中です",
				opts: [B("誰か　頼む"), K("誰か踏め"), X("立ててくる")],
			},
			{
				pin: "次スレ　できたで",
				opts: [B("たておつ"), K("乙"), X("立ててくる")],
			},
			// 乱立も サメの 頭の ように 3つ
			{
				pin: "★{m}が　3つ　あるぞ",
				opts: [B("誘導　しとく"), K("サメの　頭か"), X("全部に　書く")],
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
				lines: ["スクリーン。\n昼は『メガ荒らしザメ』、夜は　再上映。"],
			},
			{
				when: weekend,
				lines: ["スクリーン。\n今日は　昼も　夜も　再上映。"],
			},
		],
		poster: [
			{
				when: monThu,
				lines: ["昼の部『メガ荒らしザメ』\n平日の　午後は　実況上映"],
			},
			{ when: weekend, lines: ["昼の部『メガ荒らしザメ』\n土日は　再上映"] },
		],
		seat: [
			{
				when: monThu,
				lines: ["客席。\n平日の　昼間なのに、けっこう　いる。"],
			},
			{ when: weekend, lines: ["客席。\nサメ映画の　常連が　すわっている。"] },
		],
	},
	staffLines: {
		cinema_staff: [
			{
				when: monThu,
				lines: ["昼の部は　B級映画の　実況上映や。\n……今週も　サメやで"],
			},
		],
	},
	staffOnce: {
		cinema_staff: {
			kami: "この前の　たまやー、\nぴったり　やったな",
			rerun:
				"この前の　サメは　★{n}まで　のびたな。\n平日の　昼は、もっと　のびるで",
		},
	},
	msgs: {
		seat: "キリコは　昼の部の　席に　ついた。\n……スマホで、実況スレを　ひらく。",
		over: "エンドロールが　おわった。\n実況は　★{n}まで　のびた。",
		kanso: "……完走。\n外は　まだ　明るい。",
		kami: "あの　たまやーは、\nぴったりの　一瞬だった。",
		left: "……サメの　とちゅうで、\nそっと　席を　立った。",
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
	names: ["保守浜"],
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
