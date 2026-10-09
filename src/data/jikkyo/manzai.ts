// 漫才スレ王　決定戦（保守劇場の 舞台。PROGRAMS §1.6 の 漫才コンテスト）。
// 日曜の 夜、保守劇場の 舞台で 3組の コンビが ネタを かけ、審査員 3人が 点を つける。
// 流れ（縮めた 形）：開演 → 司会 → 1組目 → 点数 → 2組目 → 点数 → 敗者復活 → 最終決戦（優勝する 組の 2本目）→
// CM → 投票 → 優勝発表 → 反省会。
// - この 番組の 芯：
//   1. 「草」を 笑いの 山で 書く（最終決戦の ネタ。ボケ・ツッコミ・ボケの 3拍の あと、4拍目の 決めの ツッコミで Cue）。
//      フリの うちに「草」を 書くと ×（まだ　フリや）、笑いが 引いてから 書いても ×（遅い）。
//   2. 点数発表で 割れる：審査員の 点が 出きる 前に「妥当」「辛すぎ」「高すぎ」を 決める。舞台の 札に
//      客の 笑い（ネタの あいだに 決まる 5マスの うち いくつ）が 先に 出ていて、窓が 開くと 審査員の 点の マスが
//      1つずつ ともる。笑いの マスを こえたら 高すぎ、2つ 手前で 止まれば 辛すぎ、同じ なら 妥当。
//      点が 出た あとは 群衆が 割れる（wari）。当てた ときの 群衆は その 答えの 側（cheer:…）。
// - コンビ・審査員・司会は 架空（板の 語：sageリーマン・ageパン・名無しズ・司会の 次スレ丸）。ネタは 板の ことば
//   （誤爆・安価・コピペ・規制・名無し）。容姿いじり・差別・下ネタは 入れない。実在の 芸人・事務所・大会・局の 名前、
//   本物の ネタの 台詞は 使わない（deny で 試験が 守る）。
// - キリコが 書ける 文（候補・当番・山場の 1語）に「保守」「立てといた」「立てたる」「立てたで」を 入れない。
// - 日曜は 本番（★4）、ほかの 日は 録画（★3。群衆に「録画　組」が まざる）。12月と 1/1〜7 は 紅白スレ合戦の 枠なので 流さない。
//   優勝は 3組から 乱数（最終決戦の ネタ・字幕・優勝の 窓が かわる）。点数の 見たても 組ごとに 乱数。
//   この ファイルは kohaku.ts・text.ts を import しない（text.ts → packs.ts → ここ の 循環に なる）。
// - 文の 幅：レス 12・候補 10・スレタイ・字幕・pin・絵の 字 22（全角）。試験は src/sim/jikkyoProgTests.ts。
// 絵は ui/jikkyoManzaiTv.ts（場面の 鍵は MANZAI_SCENES、絵に 出す 文は MANZAI_ART）。

import type {
	JkFit,
	JkOpt,
	JkRand,
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

/** 場面の 鍵（TV が 描く）。 */
export const MANZAI_SCENES = [
	"card",
	"op",
	"neta",
	"score",
	"fukkatsu",
	"kessen",
	"cue",
	"cm",
	"yusho",
] as const;
export type ManzaiScene = (typeof MANZAI_SCENES)[number];

/** 点数の 見たて（◎ に なる 答え）。 */
export type ManzaiVerdict = "dato" | "karai" | "takai";

/** コンビ（0 sageリーマン・1 ageパン・2 名無しズ＝敗者復活）。 */
export const MANZAI_COMBOS = [
	{ name: "sageリーマン", neta: "誤爆", final: "コピペ" },
	{ name: "ageパン", neta: "安価", final: "規制" },
	{ name: "名無しズ", neta: "名無し", final: "名無し" },
] as const;

/** 場面の 小さな 中身（TV が 読む）。 */
export type ManzaiData = {
	/** card：まもなく・おわり／neta：フリ・ボケ／yusho：投票・優勝。 */
	readonly phase?: "soon" | "end" | "furi" | "boke" | "vote" | "win";
	/** card の 大きな 文。 */
	readonly card?: string;
	/** 舞台の コンビ（MANZAI_COMBOS の 番）。 */
	readonly combo?: number;
	/** 最終決戦の ネタ（舞台の 札が 金）。 */
	readonly final?: boolean;
	/** score：客の 笑い（ネタの あいだに 決まる）と 審査員の 点（5マスの いくつ）。 */
	readonly laugh?: number;
	readonly score?: number;
	/** score：審査員の 点の 合計（300点 満点）。 */
	readonly total?: number;
	/** score・yusho：マス（票）を ともしはじめる 名目の ms と、1つの 間。 */
	readonly at?: number;
	readonly step?: number;
	/** yusho：審査員 3人の 票（コンビの 番）と 優勝した 組。 */
	readonly votes?: readonly number[];
	readonly champ?: number;
	/** cue：決めの ツッコミの ちょうどの 名目の ms。 */
	readonly exact?: number;
	/** cm：MANZAI_ART.cm の 番。 */
	readonly cm?: number;
};

/** 絵に 出す 文（どれも 全角 22字まで）。 */
export const MANZAI_ART = {
	logo: "漫才スレ王",
	sub: "決定戦",
	soon: "まもなく　開演",
	end: "本日の　公演は　おわりました",
	host: "司会　次スレ丸",
	order: ["1組目", "2組目", "敗者復活"],
	laugh: "客の　笑い",
	judge: "審査員",
	ten: "点",
	fukkatsu: "敗者復活",
	kessen: "最終決戦",
	vote: "投票",
	yusho: "優勝",
	cmTag: "CM",
	/** CM（村の 店の 看板と 1行）。 */
	cm: [
		{ shop: "おんJマート", line: "揚げパン　あります" },
		{ shop: "ageジム", line: "笑うと　腹筋に　効く" },
		{ shop: "海の家「age」", line: "ネタの　練習に　どうぞ" },
	],
} as const;

/** 群衆の 文（手で 書いた 白い 一覧。レスは 全角 12字まで）。 */
export const MANZAI_POOLS = {
	// 群衆の pool は 10 前後（直近 4行と 窓の 候補を よけても 決まった 順に ならない ように）
	wait: [
		"31",
		"サンイチ",
		"たておつ",
		"待機",
		"はよ",
		"あと　5分",
		"今週も　来たな",
		"日曜は　これや",
		"待ってた",
		"そろそろや",
		"ネタ　楽しみ",
	],
	op: [
		"はじまた",
		"きたきた",
		"司会　きた",
		"豪華やな",
		"おお",
		"出囃子　すき",
		"ええ　衣装",
		"全組　ならんだ",
		"緊張　する",
		"今日は　どこや",
	],
	furi: [
		"どうなる",
		"つかみ　ええな",
		"声　でかい",
		"堂々と　しとる",
		"テンポ　ええ",
		"ほう",
		"聞いとるで",
		"設定　ええな",
		"フリ　長い",
		"知らん　コンビ",
	],
	gobaku: [
		"誤爆　あるある",
		"わかる",
		"社長　かわいそう",
		"kskは　あかん",
		"ワロタ",
		"腹いたい",
		"声　出た",
		"リーマンの　鑑",
		"ツボった",
		"身に　覚え　ある",
	],
	anka: [
		"揚げパン　かよ",
		"名前　やんけ",
		"安価は　絶対",
		"ワロタ",
		"腹いたい",
		"あかん",
		"給食やん",
		"天才か",
		"ツボった",
		"安価　すき",
	],
	shinsa: [
		"はよ　点数",
		"何点や",
		"ドキドキ",
		"どうや",
		"審査員の　顔",
		"祈っとる",
		"見えへん",
		"高そう",
		"低そう",
		"息　止めた",
	],
	// 点が 出た あと（群衆が 割れる）
	wari: [
		"妥当",
		"辛すぎ",
		"高すぎ",
		"割れとる",
		"荒れるで",
		"いや　妥当やろ",
		"低すぎやろ",
		"甘すぎや",
		"せやろか",
		"納得",
		"審査員　仕事しろ",
		"好みの　問題",
	],
	"cheer:dato": ["せやろな", "妥当やな", "わかっとる"],
	"cheer:karai": ["辛すぎやろ", "厳しいな", "もっと　上や"],
	"cheer:takai": ["甘いな", "盛りすぎ", "高すぎや"],
	fukkatsu: [
		"敗者復活　きた",
		"名無しズや",
		"外で　待っとった",
		"おかえり",
		"下剋上　あるで",
		"応援　しとった",
		"ここから　や",
		"ええぞ",
		"勢い　ある",
		"がんばえー",
	],
	kessen: [
		"最終決戦や",
		"くるぞ…",
		"どこが　勝つ",
		"ラストや",
		"胃が　いたい",
		"ドキドキ",
		"3組　ならんだ",
		"勝負や",
		"名無しズ　頼む",
		"ageパン　推し",
	],
	// 最終決戦の ネタの フリ と 決めの 前（Cue の 前）
	tame: [
		"くるぞ…",
		"フリ　長い",
		"ここから　や",
		"笑う　準備",
		"溜めとる",
		"間が　ええ",
		"来るで",
		"息　止めた",
		"最後や",
		"頼むで",
	],
	// 決めの ツッコミの 洪水（ほかの pool と 文を 重ねない：洪水の 行は 直近の くりかえしに 数えないので）
	flood: ["草", "草草", "大草原", "くさ", "ｗｗｗ", "はやすぎ", "おそかった"],
	after: [
		"腹いたい",
		"優勝やろ",
		"天才か",
		"涙　出た",
		"強すぎ",
		"文句なし",
		"ツボった",
		"声　出た",
		"神ネタ",
		"息　できん",
	],
	cm: [
		"ここで　CM",
		"CM　なげえ",
		"引っぱるな",
		"トイレ　行く",
		"はよ　結果",
		"CMの間に　飯",
		"結果　まだ？",
		"焦らすな",
		"毎回　これ",
		"心臓に　悪い",
	],
	touhyou: [
		"どこや",
		"ドキドキ",
		"はよ",
		"割れるか",
		"全員　一致？",
		"札　あがった",
		"見えへん",
		"祈っとる",
		"息　止めた",
		"来い",
	],
	yusho: [
		"おめでとう",
		"8888",
		"せやろな",
		"泣ける",
		"紙ふぶきや",
		"ええ　大会",
		"納得",
		"強かった",
		"おめ",
		"優勝や",
	],
	hansei: [
		"反省会や",
		"乙",
		"ほな",
		"おやすみ",
		"解散",
		"来週も　見るで",
		"ええ　大会やった",
		"審査　荒れたな",
		"楽しかった",
		"ねる",
	],
	rec: ["録画　組", "結果　知っとる", "何回　見ても　ええ", "ネタバレ　すな"],
	gap: [
		"次スレ　どこ？",
		"乱立すな",
		"950ちうい",
		"誰か踏め",
		"イッチ　次スレ",
	],
	open: ["31", "サンイチ", "たておつ", "スレ立て　乙"],
	boo: ["は？", "なんて？"],
	booFuri: ["まだ　フリや", "早い　早い", "気が　早い"],
	booLate: ["遅い", "もう　次や", "は？"],
	booScore: ["点数　見ろ", "は？", "どこ　見とるんや"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ　見とるんや"],
	/** 1000 の 流れの 予備（群衆の 区切りが ない とき）。 */
	nanashi: ["くるぞ…", "はよ"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句。 */
export const MANZAI_THREAD = {
	live: "【実況】漫才スレ王　決定戦★{n}",
	rec: "【録画】漫才スレ王　決定戦★{n}",
	liveKessen: "【実況】漫才スレ王　最終決戦★{n}",
	recKessen: "【録画】漫才スレ王　最終決戦★{n}",
	liveHansei: "【反省会】漫才スレ王　決定戦★{n}",
	recHansei: "【録画・反省会】漫才スレ王★{n}",
	get1000: "1000なら　来週も　爆笑",
	praise: ">>{n}　神タイミング",
	crossGap: "次スレで　草",
	crossFresh: "新スレで　草　生えた",
	quit: "もう一度　Bで　出る",
} as const;

/** 山場の 1語（決めの ツッコミに あわせて 書く）。 */
export const MANZAI_WORD = "草";

/** 山場の 合図（ボケ・ツッコミ・ボケ の 3拍）・拍。4拍目が 決めの ツッコミ。 */
export const MANZAI_CUE = { at: 101500, beat: 800, pulses: 3 } as const;
export const MANZAI_EXACT = MANZAI_CUE.at + MANZAI_CUE.pulses * MANZAI_CUE.beat;

/** 点数の 窓（2つ）が 開く 名目の ms と、マスを ともす 間（窓が 開いて 0.3秒から 1つずつ）。 */
const SCORE_PICKS = [40000, 73000] as const;
export const MANZAI_STEP = { lead: 300, step: 300 } as const;
/** 投票の 区切りと 札の 間（1枚ずつ、3枚目の 次で 優勝）。 */
const VOTE_AT = 126000;
const VOTE_STEP = { lead: 800, step: 600 } as const;

/** 1組の 点数（見たて・客の 笑い・審査員の 点。5マスの いくつ）と 合計。 */
export const manzaiScore = (
	rand: JkRand,
): {
	verdict: ManzaiVerdict;
	laugh: number;
	score: number;
	total: number;
} => {
	const r = rand();
	const verdict: ManzaiVerdict = r < 0.4 ? "dato" : r < 0.7 ? "karai" : "takai";
	const k = Math.floor(rand() * 3);
	// 妥当は 笑い 2〜4 と 同じ、辛すぎは 笑い 3〜5 の 2つ 手前、高すぎは 笑い 1〜3 の 2つ 先
	const laugh =
		verdict === "dato" ? 2 + k : verdict === "karai" ? 3 + k : 1 + k;
	const score =
		verdict === "dato" ? laugh : verdict === "karai" ? laugh - 2 : laugh + 2;
	const total = 3 * (80 + score * 3) + Math.floor(rand() * 5) - 2;
	return { verdict, laugh, score, total };
};

/** 点数の 字幕（窓の 前は 見かた、点が 出た あとは 割れる 群衆）。 */
const SCORE_CAP = {
	ask: "客の　笑いと　くらべて、点は　妥当？",
	split: "点数が　出た。会場が　割れている",
} as const;

/** 点数の 組（◎ は 見たて。2通り）。 */
const SCORE_SETS: Readonly<Record<ManzaiVerdict, readonly JkOpt[][]>> = {
	dato: [
		[B("妥当"), K("せやろな"), X("辛すぎ")],
		[B("妥当"), K("納得"), X("高すぎ")],
	],
	karai: [
		[B("辛すぎ"), K("低くない？"), X("高すぎ")],
		[B("辛すぎ"), K("厳しいな"), X("妥当")],
	],
	takai: [
		[B("高すぎ"), K("甘いな"), X("辛すぎ")],
		[B("高すぎ"), K("盛りすぎ"), X("妥当")],
	],
};

/** 最終決戦の ネタ（優勝する 組の 2本目）：フリの 字幕・決めの ツッコミ・フリの 窓。 */
const FINAL: readonly {
	furi: string;
	punch: string;
	sets: readonly JkOpt[][];
	win: readonly JkOpt[];
}[] = [
	{
		furi: "相方の　返事が　ぜんぶ　コピペ",
		punch: "「それ　さっきの　レスや！」",
		sets: [
			[B("それ　コピペや"), K("見た　ことある"), X(MANZAI_WORD, "booFuri")],
			[B("コピペ　ネタや"), K("くるぞ…"), X("おめでとう")],
		],
		win: [B("リーマンの　星"), K("8888"), X("CM　なげえ")],
	},
	{
		furi: "相方が　連投規制で　しゃべれない",
		punch: "「規制　とけて　それかい！」",
		sets: [
			[B("規制　つらい"), K("しゃべれや"), X(MANZAI_WORD, "booFuri")],
			[B("規制　ネタや"), K("くるぞ…"), X("おめでとう")],
		],
		win: [B("揚げパン　祭りや"), K("8888"), X("CM　なげえ")],
	},
	{
		furi: "2人とも　名無しで　名乗れない",
		punch: "「結局　どっちが　どっちや！」",
		sets: [
			[B("名前　ないんか"), K("どっちや"), X(MANZAI_WORD, "booFuri")],
			[B("名無し　ネタや"), K("くるぞ…"), X("おめでとう")],
		],
		win: [B("下剋上や"), K("8888"), X("CM　なげえ")],
	},
];

const fillN = (s: string, n: number) => s.replace("{n}", String(n));

/** 枠の スレタイ（本番・録画）。 */
const titleOf =
	(k: "" | "Kessen" | "Hansei") =>
	(n: number, slot: JkSlot): string =>
		fillN(MANZAI_THREAD[`${slot.live ? "live" : "rec"}${k}` as const], n);

/**
 * 台本（152秒。pick 13 ＋ Cue）。窓の あいだは 9〜13秒（950 の 当番が 出せる すきまを 1つおきに）。
 * CM（116〜126秒）は 窓なしで、結果を 引っぱる あいだに 当番が 来やすい。
 */
const manzaiTimeline: JkScript["timeline"] = (rand) => {
	const s1 = manzaiScore(rand);
	const s2 = manzaiScore(rand);
	// 優勝は 3組から（敗者復活の 名無しズも 勝てる）。投票は 2票 以上が 優勝した 組（札の 順は まぜる）
	const champ = Math.floor(rand() * 3);
	const third = rand() < 0.5 ? champ : (champ + 1 + Math.floor(rand() * 2)) % 3;
	const votes = [champ, champ, third];
	for (let i = votes.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[votes[i], votes[j]] = [votes[j], votes[i]];
	}
	const final = FINAL[champ];
	const cm = Math.floor(rand() * MANZAI_ART.cm.length);
	const scoreData = (combo: number, s: typeof s1, at: number): ManzaiData => ({
		combo,
		laugh: s.laugh,
		score: s.score,
		total: s.total,
		at: at + MANZAI_STEP.lead,
		step: MANZAI_STEP.step,
	});
	const sd1 = scoreData(0, s1, SCORE_PICKS[0]);
	const sd2 = scoreData(1, s2, SCORE_PICKS[1]);
	const yd: ManzaiData = {
		champ,
		votes,
		at: VOTE_AT + VOTE_STEP.lead,
		step: VOTE_STEP.step,
	};
	const segments: JkScriptSeg[] = [
		{
			at: 0,
			scene: "card",
			pool: "wait",
			rate: 0.5,
			bgm: null,
			caption: MANZAI_ART.soon,
			data: { phase: "soon" } satisfies ManzaiData,
		},
		{
			at: 7000,
			scene: "op",
			pool: "op",
			rate: 1,
			bgm: "title",
			caption: "司会は　次スレ丸",
		},
		{
			at: 16000,
			scene: "neta",
			pool: "furi",
			rate: 1,
			bgm: "town",
			caption: "1組目　sageリーマン「誤爆」",
			data: { combo: 0, phase: "furi" } satisfies ManzaiData,
		},
		{
			at: 26000,
			scene: "neta",
			pool: "gobaku",
			rate: 1.3,
			caption: "社長に「ksk」と　誤爆",
			data: { combo: 0, phase: "boke" } satisfies ManzaiData,
		},
		{
			at: 36000,
			scene: "score",
			pool: "shinsa",
			rate: 1.2,
			bgm: "tense",
			caption: SCORE_CAP.ask,
			data: sd1,
		},
		{
			at: 46000,
			scene: "score",
			pool: "wari",
			rate: 1.4,
			caption: SCORE_CAP.split,
			data: sd1,
		},
		{
			at: 50000,
			scene: "neta",
			pool: "furi",
			rate: 1,
			bgm: "field2",
			caption: "2組目　ageパン「安価」",
			data: { combo: 1, phase: "furi" } satisfies ManzaiData,
		},
		{
			at: 60000,
			scene: "neta",
			pool: "anka",
			rate: 1.3,
			caption: "安価>>5で　晩ごはん　→　揚げパン",
			data: { combo: 1, phase: "boke" } satisfies ManzaiData,
		},
		{
			at: 69000,
			scene: "score",
			pool: "shinsa",
			rate: 1.2,
			bgm: "tense",
			caption: SCORE_CAP.ask,
			data: sd2,
		},
		{
			at: 79000,
			scene: "score",
			pool: "wari",
			rate: 1.4,
			caption: SCORE_CAP.split,
			data: sd2,
		},
		{
			at: 82000,
			scene: "fukkatsu",
			pool: "fukkatsu",
			rate: 1.2,
			bgm: "battle",
			caption: "敗者復活は　名無しズ！",
			data: { combo: 2 } satisfies ManzaiData,
		},
		{
			at: 89000,
			scene: "kessen",
			pool: "kessen",
			rate: 1.3,
			bgm: "boss",
			caption: `最終決戦　ラストは　${MANZAI_COMBOS[champ].name}`,
			title: { later: titleOf("Kessen") },
		},
		{
			at: 94000,
			scene: "neta",
			pool: "tame",
			rate: 1.4,
			bgm: "tense",
			caption: final.furi,
			data: { combo: champ, phase: "furi", final: true } satisfies ManzaiData,
		},
		{
			at: 100500,
			scene: "cue",
			pool: "tame",
			rate: 3.5,
			bgm: null,
			data: { combo: champ, exact: MANZAI_EXACT } satisfies ManzaiData,
		},
		{
			at: 105500,
			scene: "cue",
			pool: "after",
			rate: 1.3,
			bgm: "title",
			stall: 1200,
			caption: final.punch,
			data: { combo: champ, exact: MANZAI_EXACT } satisfies ManzaiData,
		},
		{
			at: 116000,
			scene: "cm",
			pool: "cm",
			rate: 0.8,
			bgm: "retro",
			caption: "結果は　CMの　あとで",
			react: [{ who: "nanashi", text: "ここで　CMかよ" }],
			data: { cm } satisfies ManzaiData,
		},
		{
			at: VOTE_AT,
			scene: "yusho",
			pool: "touhyou",
			rate: 1.5,
			bgm: "tense",
			caption: "審査員の　投票",
			data: { ...yd, phase: "vote" } satisfies ManzaiData,
		},
		{
			at: 134000,
			scene: "yusho",
			pool: "yusho",
			rate: 1.1,
			bgm: "ending",
			caption: `優勝は　${MANZAI_COMBOS[champ].name}！`,
			data: { ...yd, phase: "win" } satisfies ManzaiData,
		},
		{
			at: 141000,
			scene: "card",
			pool: "hansei",
			rate: 0.7,
			caption: MANZAI_ART.end,
			title: { now: titleOf("Hansei") },
			data: { phase: "end" } satisfies ManzaiData,
		},
	];
	const scorePick = (at: number, v: ManzaiVerdict) => ({
		at,
		boo: "booScore",
		cheer: `cheer:${v}`,
		sets: SCORE_SETS[v],
	});
	return {
		segments,
		picks: [
			{
				at: 2000,
				boo: "boo",
				sets: [
					[B("31"), K("はよ"), X("はじまた")],
					[B("待機"), K("きたきた"), X("乙")],
					[B("あと　5分"), K("はよ"), X("おめでとう")],
				],
			},
			{
				at: 11000,
				boo: "boo",
				sets: [
					[B("はじまた"), K("おお"), X("31")],
					[B("きたきた"), K("出囃子　すき"), X("乙")],
					[B("司会　きた"), K("豪華やな"), X("8888")],
				],
			},
			// フリの うちの「草」は 早い（まだ　フリや）
			{
				at: 20000,
				boo: "boo",
				sets: [
					[B("誤爆　あるある"), K("おもろい"), X(MANZAI_WORD, "booFuri")],
					[B("スーツ　ええな"), K("きたきた"), X("ワロタ", "booFuri")],
					[B("sageリーマンや"), K("知らん　コンビ"), X("妥当")],
				],
			},
			{
				at: 30000,
				boo: "boo",
				sets: [
					[B("ワロタ"), K("誤爆　あるある"), X("待機")],
					[B("社長　かわいそう"), K("腹いたい"), X("31")],
					[B("腹いたい"), K("ワロタ"), X("はじまた")],
				],
			},
			// 点数：審査員の 点の マスが 客の 笑いを こえたら 高すぎ、2つ 手前で 止まれば 辛すぎ、同じ なら 妥当
			scorePick(SCORE_PICKS[0], s1.verdict),
			{
				at: 53500,
				boo: "boo",
				sets: [
					[B("安価　すき"), K("おもろい"), X(MANZAI_WORD, "booFuri")],
					[B("ageパンや"), K("待ってた"), X("辛すぎ")],
					[B("安価　なら　任せろ"), K("きたきた"), X("ワロタ", "booFuri")],
				],
			},
			{
				at: 63500,
				boo: "boo",
				sets: [
					[B("揚げパン　かよ"), K("ワロタ"), X("待機")],
					[B("名前　やんけ"), K("腹いたい"), X("31")],
					[B("ワロタ"), K("揚げパン　かよ"), X("CM　なげえ")],
				],
			},
			scorePick(SCORE_PICKS[1], s2.verdict),
			{
				at: 84500,
				boo: "boo",
				sets: [
					[B("敗者復活　きたぞ"), K("名無しズや"), X("妥当")],
					[B("下剋上　あるで"), K("おかえり"), X("31")],
					[B("名無しズ　きた"), K("ええぞ"), X("乙")],
				],
			},
			// 最終決戦の フリ（優勝する 組の ネタ。ここでも「草」は 早い）
			{ at: 95500, boo: "boo", sets: final.sets },
			// 笑いが 引いてから の「草」は 遅い
			{
				at: 110000,
				boo: "boo",
				sets: [
					[B("天才か"), K("腹いたい"), X("待機")],
					[B("優勝やろ"), K("文句なし"), X("辛すぎ")],
					[B("腹いたい"), K("涙　出た"), X(MANZAI_WORD, "booLate")],
				],
			},
			// CM の あいだは 窓なし（結果を 引っぱる あいだに 950 の 当番が 来やすい）
			{
				at: 130500,
				boo: "boo",
				sets: [
					[B("おめでとう"), K("せやろな"), X("辛すぎ")],
					[B("8888"), K("おめでとう"), X("待機")],
					final.win,
				],
			},
			{
				at: 143500,
				boo: "boo",
				sets: [
					[B("乙"), K("反省会や"), X("はじまた")],
					[B("ほな"), K("解散"), X("待機")],
					[B("来週も　見るで"), K("おやすみ"), X("31")],
				],
			},
		],
		cues: [
			{
				...MANZAI_CUE,
				word: MANZAI_WORD,
				flood: "flood",
				praise: MANZAI_THREAD.praise,
				cross: {
					gap: MANZAI_THREAD.crossGap,
					fresh: MANZAI_THREAD.crossFresh,
				},
			},
		],
	};
};

/** 漫才スレ王　決定戦の 台本。 */
export const MANZAI: JkScript = {
	id: "manzai",
	venue: "theater",
	length: 152000,
	goal: { live: 4, rerun: 3 },
	pools: MANZAI_POOLS,
	title: titleOf(""),
	at1000: () => MANZAI_THREAD.get1000,
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
	extra: [{ pool: "rec", p: 0.15, when: (slot: JkSlot) => !slot.live }],
	quitNote: MANZAI_THREAD.quit,
	// 帯（P4 の 種で 回した）：sora と 同じ 形。録画を ★2 に すると 上手が 帯を こえる（本番 77%・録画 84%）ので
	// 録画は ★3。本番 上手 77%・初心者 28%、録画 78%・29%（見るだけ 0.57G・神 1.42G・random 0%）
	tune: { post: 0.1, boost: 3, comboMin: 20 },
	bands: {
		p50: { miru: [0.52, 0.6], kami: [1.08, 99] },
		kanso: { jouzu: [0.65, 0.8], shoshin: [0.25, 0.45], random: [0, 0.099] },
	},
	timeline: manzaiTimeline,
};

// ───────────────── 束（会場・日・文） ─────────────────

/** 紅白スレ合戦の 枠（12月と 1/1〜7）。この 日は 流さない。 */
const isKohakuDay = (t: Today): boolean =>
	t.m === 12 || (t.m === 1 && t.d <= 7);
const isLiveDay = (t: Today): boolean => !isKohakuDay(t) && t.w === 0;

/**
 * 漫才スレ王　決定戦。会場の 文の 上書きは 日曜の 本番だけ（録画の 日は 舞台・はり紙・役者とも いつもの
 * 「やきう　物語」の 文の まま。舞台を 調べると 録画を 見るか 選べる）。
 */
export const MANZAI_PACK: JkPack = {
	script: MANZAI,
	venue: "theater",
	from: 7,
	menu: "漫才スレ王",
	slot: (t) => (isKohakuDay(t) ? null : { live: t.w === 0 }),
	scenes: MANZAI_SCENES,
	venueLines: {
		stage: [
			{
				when: isLiveDay,
				lines: ["舞台。\n今夜は『漫才スレ王　決定戦』の　本番。"],
			},
		],
		playbill: [
			{
				when: isLiveDay,
				lines: ["演目の　はり紙。\n今夜『漫才スレ王　決定戦』"],
			},
		],
		seat: [
			{
				when: isLiveDay,
				lines: ["客席。\nスマホの　光が　ならんでいる。"],
			},
		],
	},
	staffLines: {
		theater_actor: [
			{
				when: isLiveDay,
				lines: ["今夜は　漫才スレ王の　本番や。\n……ツッコミ、忘れた"],
			},
		],
	},
	staffOnce: {
		theater_actor: {
			kami: "この前の　草、\nいちばん　笑う　とこ　やったな",
			rerun:
				"この前の　録画、★{n}まで　のびたな。\n日曜の　本番は、もっと　のびるで",
		},
	},
	msgs: {
		howto:
			"見せ場に　合う　レスで　スレが　のびる。\n笑いの　山で「草」。目標：★{n}　完走",
		seat: "キリコは　客席に　ついた。\n……スマホで、実況スレを　ひらく。",
		over: "幕が　おりた。\n実況は　★{n}まで　のびた。",
		kami: "あの　草は、\nいちばん　ウケた　一瞬だった。",
		left: "……漫才の　とちゅうで、\nそっと　席を　立った。",
	},
	art: [
		MANZAI_ART.logo,
		MANZAI_ART.sub,
		MANZAI_ART.soon,
		MANZAI_ART.end,
		MANZAI_ART.host,
		...MANZAI_ART.order,
		MANZAI_ART.laugh,
		MANZAI_ART.judge,
		MANZAI_ART.ten,
		MANZAI_ART.fukkatsu,
		MANZAI_ART.kessen,
		MANZAI_ART.vote,
		MANZAI_ART.yusho,
		MANZAI_ART.cmTag,
		...MANZAI_ART.cm.flatMap((c) => [c.shop, c.line]),
		...MANZAI_COMBOS.flatMap((c) => [
			c.name,
			`「${c.neta}」`,
			`「${c.final}」`,
		]),
	],
	deny: [
		"M-1",
		"Ｍ－1",
		"Ｍ－１",
		"M－1",
		"Ｍ-1",
		"M1グランプリ",
		"グランプリ",
		"オートバックス",
		"吉本",
		"よしもと",
		"松本",
		"ダウンタウン",
		"テレビ朝日",
		"ABC",
		"笑い飯",
		"ミルクボーイ",
		"霜降り",
		"笑神籤",
		"えみくじ",
		"サンパチ",
	],
};
