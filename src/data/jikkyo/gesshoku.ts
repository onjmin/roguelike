// 皆既月食　観察部（保守中央公園の 北の ベンチ。PROGRAMS §1.6「空を 見上げる 静かな 実況」）。
// テレビは ない：キリコは ベンチに すわって 夜空を 見上げ、スマホで 実況スレを ひらく。月が 左から 欠けはじめ、
// 半分 → 雲が 横切る → 細く なって 皆既（赤銅色の 赤い 月）→ 左から 光が 戻り → 満月に もどる。
// - この 番組の 動詞：月の 形に 合う ひとこと（雲が かかれば「雲　どけ」、どいたら「雲　どいた」）・
//   皆既の 瞬間を 1語で 書く（Cue「皆既」。beat 1000 の ゆっくりした 合図）・皆既の あいだ しばらく 黙って 見る
//   （答えない ことが ◎＝timeoutFit。kohaku の 除夜の 鐘と 同じ 形）。勢いは 実況の 中で いちばん 低い（群衆の 重みを 小さく）。
// - 月の 形は 名目の 時計で かわる（GESSHOKU_ECLIPSE。TV は ui/jikkyoGesshokuTv.ts）。欠けた 割合は 時間に 比例。
// - 日：毎月 15日（満月の 夜）は 本番（★3）、ほかの 日は 前の 月食の 過去ログ（★2。群衆に「過去ログ　乙」が まざる）。
// - 実在の 天文台・中継・天気の 会社の 名前は 出さない（deny）。群衆の 文は 手で 書いた 一覧だけ。
// - キリコが 書ける 文（候補・当番・山場の 1語）に「保守」「立てといた」「立てたる」「立てたで」を 入れない。
//   「保守」は 固有名詞（保守中央公園・保守村）の 中だけ。
// - 文の 幅：レス 12・候補 10・スレタイ・字幕・pin・絵の 字 22（全角）。試験は src/sim/jikkyoProgTests.ts。

import type {
	JkFit,
	JkOpt,
	JkScript,
	JkScriptSeg,
	JkSlot,
} from "../../core/jikkyo";
import type { Today } from "../calendar";
import { type JkPack, liveOr } from "./pack";
import type { DayLines } from "./text";

const o = (text: string, fit: JkFit, boo?: string): JkOpt =>
	boo ? { text, fit, boo } : { text, fit };
const B = (t: string) => o(t, "best");
const K = (t: string) => o(t, "ok");
const X = (t: string, boo?: string) => o(t, "miss", boo);

/** 場面の 鍵（どれも 同じ 夜空。月の 形は 名目の 時計、雲と 合図は 場面で）。 */
export const GESSHOKU_SCENES = [
	"matsu",
	"kake",
	"hanbun",
	"kumo",
	"mae",
	"cue",
	"kaiki",
	"modori",
	"mangetsu",
	"owari",
] as const;
export type GesshokuScene = (typeof GESSHOKU_SCENES)[number];

/** 絵に 出す 文（どれも 全角 22字まで）。 */
export const GESSHOKU_ART = {
	/** 再放送の 札（左上）。 */
	kakolog: "過去ログ",
} as const;

/** 山場の 1語（皆既の 瞬間）。 */
export const GESSHOKU_WORD = "皆既";

/** 山場の 合図（1つめ）・拍（ゆっくり 1秒）。ちょうどが 皆既の はじまり。 */
export const GESSHOKU_CUE = { at: 77000, beat: 1000, pulses: 3 } as const;
export const GESSHOKU_EXACT =
	GESSHOKU_CUE.at + GESSHOKU_CUE.pulses * GESSHOKU_CUE.beat;

/**
 * 月食の 時刻（名目の ms）。u1 欠けはじめ・half 半分・u2 皆既の はじまり（山場の ちょうど）・u3 皆既の おわり・
 * half2 半分・u4 満月に もどる。欠けた 割合は あいだを まっすぐ 結ぶ（TV が 影の 位置に なおす）。
 */
export const GESSHOKU_ECLIPSE = {
	u1: 9000,
	half: 31000,
	u2: GESSHOKU_EXACT,
	u3: 102000,
	half2: 114000,
	u4: 126000,
} as const;

/** 欠けた 割合（0〜1。皆既の あいだは 1）。 */
export const gesshokuCover = (t: number): number => {
	const E = GESSHOKU_ECLIPSE;
	const lerp = (a: number, b: number, x: number, y: number) =>
		x + ((y - x) * (t - a)) / (b - a);
	if (t <= E.u1 || t >= E.u4) return 0;
	if (t < E.half) return lerp(E.u1, E.half, 0, 0.5);
	if (t < E.u2) return lerp(E.half, E.u2, 0.5, 1);
	if (t <= E.u3) return 1;
	if (t < E.half2) return lerp(E.u3, E.half2, 1, 0.5);
	return lerp(E.half2, E.u4, 0.5, 0);
};

/** 群衆の 文（手で 書いた 白い 一覧。レスは 全角 12字まで）。 */
export const GESSHOKU_POOLS = {
	wait: [
		"31",
		"サンイチ",
		"たておつ",
		"待機",
		"晴れた",
		"寒い",
		"月　でかい",
		"まだ　まるい",
		"はよ　欠けろ",
		"ベランダ　組",
		"保守村は　晴れ",
		"双眼鏡　出した",
	],
	kake: [
		"欠けてきた",
		"おお",
		"左から　きた",
		"ほんまに　欠けとる",
		"わかる？",
		"かじられた",
		"肉眼で　見えた",
		"まだ　うすい",
		"寒い",
		"スマホじゃ　写らん",
	],
	hanbun: [
		"半分や",
		"クッキー　みたい",
		"影　まるいな",
		"地球の　影や",
		"寒い",
		"雲　出てきた",
		"肉眼で　見えた",
		"スマホじゃ　写らん",
		"首　いたい",
		"ええ　形",
	],
	kumo: [
		"雲　どけ",
		"曇ってて　見えん",
		"雲　くんな",
		"見えへん",
		"あかん",
		"ここで　雲か",
		"はよ　どけ",
		"こっちは　晴れ",
		"風　吹け",
	],
	mae: [
		"あと　少し",
		"細く　なった",
		"くるぞ…",
		"赤く　なってきた",
		"そろそろや",
		"息　止めた",
		"雲　どいた",
		"まだか",
		"寒い",
		"準備できた",
	],
	// 皆既の 洪水（ほかの pool と 文を 重ねない：洪水の 行は 直近の くりかえしに 数えないので）
	flood: ["皆既！", "皆既きた", "赤い！", "皆既や", "はやすぎ", "おそかった"],
	kaiki: [
		"赤い",
		"きれい",
		"赤銅色や",
		"星が　ふえた",
		"暗く　なった",
		"不気味やな",
		"ええな",
		"見とれる",
		"肉眼で　見えた",
		"スマホじゃ　写らん",
		"しっ",
	],
	/** 皆既の あいだ 黙って 見た あと。 */
	kaikiOk: ["静かに　なった", "ええ　夜や", "見とれてた"],
	modori: [
		"光った",
		"戻ってきた",
		"左から　光った",
		"明るく　なってきた",
		"おかえり",
		"まぶしい",
		"はやいな",
		"もう　終わりか",
		"ええもん　見た",
		"寒い",
	],
	mangetsu: [
		"まるい",
		"満月や",
		"おかえり",
		"次は　何年後や",
		"来月も　あるで",
		"ええもん　見た",
		"寒かった",
		"まぶしい",
		"首　いたい",
		"肉眼で　見えた",
	],
	owari: [
		"乙",
		"おやすみ",
		"ほな",
		"解散",
		"風邪　ひくなよ",
		"寒かった",
		"また　見よな",
		"ねる",
		"観察　乙",
		"来月も　見るで",
	],
	rerun: [
		"過去ログ　乙",
		"前の　月食や",
		"見逃した　組",
		"何回　見ても　ええ",
		"当日は　曇っとった",
	],
	gap: ["次スレ　どこ？", "乱立すな", "950ちうい", "誰か踏め", "月　見とる？"],
	open: ["31", "サンイチ", "たておつ", "スレ立て　乙"],
	boo: ["は？", "なんて？"],
	booEarly: ["まだ　早い", "気が　早い", "は？"],
	booLate: ["もう　戻っとる", "遅いで", "は？"],
	booQuiet: ["しっ", "静かに　見よ"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ　見とるんや"],
	/** 1000 の 流れの 予備（群衆の 区切りが ない とき）。 */
	nanashi: ["くるぞ…", "寒い"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句。 */
export const GESSHOKU_THREAD = {
	live: "おんJ皆既月食観察部★{n}",
	rerun: "【過去ログ】おんJ皆既月食観察部★{n}",
	get1000: "1000なら　来月も　晴れ",
	praise: ">>{n}　神エイム",
	crossGap: "次スレで　皆既",
	crossFresh: "新スレで　皆既！",
	quiet: "スマホ　置いて　空　見よ",
	quit: "もう一度　Bで　出る",
} as const;

const fillN = (s: string, n: number) => s.replace("{n}", String(n));

/** 台本（150秒。pick 13 ＋ Cue）。 */
const gesshokuTimeline: JkScript["timeline"] = () => {
	const E = GESSHOKU_ECLIPSE;
	const segments: JkScriptSeg[] = [
		{
			at: 0,
			scene: "matsu",
			pool: "wait",
			rate: 0.4,
			bgm: "stone",
			caption: "保守中央公園　北の　ベンチ",
		},
		{
			at: 4000,
			scene: "matsu",
			pool: "wait",
			rate: 0.4,
			caption: "まもなく　欠けはじめ",
		},
		{
			at: E.u1,
			scene: "kake",
			pool: "kake",
			rate: 0.7,
			bgm: "deq_ice",
			caption: "欠けはじめ",
		},
		{
			at: 26000,
			scene: "hanbun",
			pool: "hanbun",
			rate: 0.8,
			caption: "半分　欠けた",
		},
		// 雲が 月の 前を 横切る（区切りの まんなかで 月を かくす）
		{
			at: 40000,
			scene: "kumo",
			pool: "kumo",
			rate: 0.9,
			caption: "雲が　きた",
			react: [{ who: "nanashi", text: "雲　きた" }],
		},
		{
			at: 50000,
			scene: "mae",
			pool: "mae",
			rate: 0.9,
			caption: "皆既まで　あと　少し",
		},
		{ at: 76000, scene: "cue", pool: "mae", rate: 2, bgm: null },
		// 皆既：曲は 無音のまま、群衆も 静か。しばらく「スマホ　置いて　空　見よ」を 上に 止める
		{
			at: 82000,
			scene: "kaiki",
			pool: "kaiki",
			rate: 0.3,
			caption: "皆既　赤い　月",
			posts: [
				{ at: 0, who: "nanashi", text: GESSHOKU_THREAD.quiet, pin: 7000 },
			],
		},
		{
			at: E.u3,
			scene: "modori",
			pool: "modori",
			rate: 0.5,
			bgm: "deq_sea",
			caption: "戻りはじめ",
		},
		{
			at: E.u4,
			scene: "mangetsu",
			pool: "mangetsu",
			rate: 0.4,
			bgm: "ending",
			caption: "満月に　もどった",
		},
		{
			at: 141000,
			scene: "owari",
			pool: "owari",
			rate: 0.3,
			caption: "観察　おわり",
		},
	];
	return {
		segments,
		picks: [
			{
				at: 2500,
				boo: "booEarly",
				sets: [
					[B("待機"), K("寒い"), X("赤い")],
					[B("31"), K("はよ　欠けろ"), X("おかえり")],
					[B("晴れた"), K("待機"), X(GESSHOKU_WORD)],
				],
			},
			{
				at: 13500,
				boo: "boo",
				sets: [
					[B("欠けてきた"), K("おお"), X("満月や")],
					[B("左から　きた"), K("わかる？"), X("戻ってきた")],
					[B("かじられた"), K("おお"), X("おやすみ")],
				],
			},
			{
				at: 24000,
				boo: "boo",
				sets: [
					[B("肉眼で　見えた"), K("双眼鏡　出した"), X("赤い")],
					[B("スマホじゃ　写らん"), K("わかる"), X("まるい")],
					[B("ほんまに　欠けとる"), K("おお"), X("おかえり")],
				],
			},
			{
				at: 34500,
				boo: "boo",
				sets: [
					[B("半分や"), K("クッキー　みたい"), X("待機")],
					[B("影　まるいな"), K("地球の　影や"), X("満月や")],
					[B("地球の　影や"), K("半分や"), X("31")],
				],
			},
			// 雲が 月を かくす（窓の あいだ ずっと かかって いる）
			{
				at: 44000,
				boo: "boo",
				sets: [
					[B("雲　どけ"), K("見えへん"), X("きれい")],
					[B("曇ってて　見えん"), K("あかん"), X("半分や")],
					[B("雲　どけ"), K("ここで　雲か"), X("赤い")],
				],
			},
			// 雲が どいた（さっきの「雲　どけ」は もう ×）
			{
				at: 55000,
				boo: "boo",
				sets: [
					[B("雲　どいた"), K("おお"), X("雲　どけ")],
					[B("細く　なった"), K("寒い"), X("満月や")],
					[B("雲　どいた"), K("細く　なった"), X("おやすみ")],
				],
			},
			{
				at: 63000,
				boo: "booEarly",
				sets: [
					[B("赤く　なってきた"), K("あと　少し"), X(GESSHOKU_WORD)],
					[B("くるぞ…"), K("息　止めた"), X("雲　どけ")],
					[B("あと　少し"), K("くるぞ…"), X("まるい")],
				],
			},
			// 皆既の あいだ：黙って 見るのが ◎（答えないと ◎、ひとことは ○、さわぐと ×）
			{
				at: 87500,
				open: 5000,
				timeoutFit: "best",
				boo: "booQuiet",
				cheer: "kaikiOk",
				sets: [
					[X(GESSHOKU_WORD), K("きれい")],
					[X("くるぞ…"), K("赤い")],
					[X("おかえり"), K("赤銅色や")],
				],
			},
			{
				at: 97000,
				boo: "boo",
				sets: [
					[B("きれい"), K("星が　ふえた"), X("待機")],
					[B("赤銅色や"), K("不気味やな"), X("半分や")],
					[B("赤い"), K("暗く　なった"), X("雲　どいた")],
				],
			},
			// 左から 光が 戻る（皆既の 文は もう おそい）
			{
				at: 105500,
				boo: "boo",
				sets: [
					[B("光った"), K("おお"), X("赤い", "booLate")],
					[B("戻ってきた"), K("まぶしい"), X(GESSHOKU_WORD, "booLate")],
					[B("左から　光った"), K("おかえり"), X("31")],
				],
			},
			{
				at: 118500,
				boo: "boo",
				sets: [
					[B("おかえり"), K("はやいな"), X("雲　どけ")],
					[
						B("明るく　なってきた"),
						K("戻ってきた"),
						X("あと　少し", "booLate"),
					],
					[B("まぶしい"), K("おかえり"), X("赤銅色や", "booLate")],
				],
			},
			{
				at: 129500,
				boo: "boo",
				sets: [
					[B("まるい"), K("満月や"), X("欠けてきた", "booLate")],
					[B("満月や"), K("ええもん　見た"), X("半分や")],
					[B("ええもん　見た"), K("まるい"), X("あと　少し", "booLate")],
				],
			},
			// 満月から 観察おわりへ（あとは 950 の 当番が 出せる ように あけて おく）
			{
				at: 140000,
				boo: "boo",
				sets: [
					[B("次は　何年後や"), K("寒かった"), X("待機")],
					[B("おやすみ"), K("寒かった"), X("31")],
					[B("また　見よな"), K("次は　何年後や"), X("くるぞ…")],
				],
			},
		],
		cues: [
			{
				...GESSHOKU_CUE,
				word: GESSHOKU_WORD,
				flood: "flood",
				praise: GESSHOKU_THREAD.praise,
				cross: {
					gap: GESSHOKU_THREAD.crossGap,
					fresh: GESSHOKU_THREAD.crossFresh,
				},
			},
		],
	};
};

/** 皆既月食　観察部（台本）。 */
export const GESSHOKU: JkScript = {
	id: "gesshoku",
	venue: "park",
	length: 150000,
	goal: { live: 3, rerun: 2 },
	pools: GESSHOKU_POOLS,
	title: (n, slot) =>
		fillN(slot.live ? GESSHOKU_THREAD.live : GESSHOKU_THREAD.rerun, n),
	at1000: () => GESSHOKU_THREAD.get1000,
	open: "open",
	gapPool: "gap",
	duty: {
		pin: "950ちうい",
		first: [B("立ててくる"), K("誰か踏め"), X("月　見とく")],
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
	// ◎ を かさねる 群衆は 1人（窓の すぐ あとに 950 の 当番が 開いても、かさねる 行が 当番の あとに のこらない ように）
	echoN: [1, 1],
	extra: [{ pool: "rerun", p: 0.15, when: (slot: JkSlot) => !slot.live }],
	quitNote: GESSHOKU_THREAD.quit,
	// 帯（sora と 同じ tune）：本番 上手 76%・初心者 32%、過去ログ 76%・31%（見るだけ 0.58G・神 1.30G・random 0%）。
	// 群衆の 重みは 見るだけの 950 が 皆既の 前の あき（63〜71秒）と 戻りはじめの あき（110〜114秒）に 来る ように 置いた
	tune: { post: 0.1, boost: 3, comboMin: 20 },
	bands: {
		p50: { miru: [0.52, 0.6], kami: [1.08, 99] },
		kanso: { jouzu: [0.65, 0.8], shoshin: [0.25, 0.45], random: [0, 0.099] },
	},
	timeline: gesshokuTimeline,
};

/** 本番の 夜（毎月 15日。満月）。 */
const isEclipseNight = (t: Today): boolean => t.d === 15;

/** ベンチ（外の 物。左右の 半分と 東の ベンチも 同じ 文）。 */
const BENCH_LINES: DayLines = [
	{
		when: isEclipseNight,
		lines: ["ベンチ。\n今夜は　皆既月食。空が　よく　見える。"],
	},
];

/** 皆既月食　観察部。 */
export const GESSHOKU_PACK: JkPack = {
	script: GESSHOKU,
	venue: "park",
	from: 7,
	menu: "皆既月食",
	slot: liveOr(isEclipseNight),
	scenes: GESSHOKU_SCENES,
	venueLines: {
		bench: BENCH_LINES,
		bench_r: BENCH_LINES,
		bench_e: BENCH_LINES,
		bench_e_r: BENCH_LINES,
	},
	msgs: {
		howto:
			"合う　レスで　スレが　のびる。皆既の　間は\n黙って　見るのも　ええ。目標：★{n}　完走",
		seat: "キリコは　ベンチで　空を　見上げた。\n……スマホで、実況スレを　ひらく。",
		over: "月が　まるく　もどった。\n実況は　★{n}まで　のびた。",
		kanso: "……完走。\n夜風が　つめたい。",
		kami: "「皆既」の　ひとことは、\n月が　赤く　なった　一瞬だった。",
		left: "……観察の　とちゅうで、\nそっと　ベンチを　立った。",
	},
	art: Object.values(GESSHOKU_ART),
	deny: [
		"国立天文台",
		"天文台",
		"ウェザーニュース",
		"ウェザーニューズ",
		"アストロアーツ",
		"星ナビ",
		"天文ガイド",
	],
	names: ["保守中央公園"],
};
