// 保守駅伝（保守村駅の 待合の 壁の テレビ。PROGRAMS §1.6 の 正月の 大学駅伝を 架空の 大会に した もの）。
// 1/2 は 往路、1/3 は 復路の 本番（★4）、ほかの 日は 去年の 復路の 再放送（★2）。2日を 縮めた 形：
// スタート → 1区（沿道の 旗）→ 給水 → 中継所 → 山（往路は 5区の 山上りと 山の神、復路は 6区の 山下りの VTR）→
// 繰り上げ → ゴール → 優勝 → 反省会。往路と 復路は 字幕・背景・優勝の 名前が かわる（筋は 同じ）。
// - 番組の 芯：
//   - 襷の 繰り上げ（山場の 1語）：地元の 保守大の 襷が 中継所に 届くか。繰り上げの 号砲の 拍で 1語
//     （届けば「つないだ」、届かなければ「繰り上げ」で 次の 走者は 白い 襷）。届くかは 乱数で、
//     その 前の 窓で 道の 先を 読む（走者が 見えれば「見えた！」、見えなければ「見えへん」）。
//   - 名前欄の おみくじ：号砲までは キリコの 名前欄が「繰り上げまで＠0:30」の 時計、号砲の あとは おみくじ
//     （神エイム＝名無し＠大吉・おしい＝中吉・おくれた＝小吉・見てただけ＝末吉・フライング＝まだ　鳴ってへん）。
//   - 回で 数える ボケ：スレタイ「【実況】保守駅伝　第{回}回」の 回は 101 から スレごとに 1つ 足す
//     （立った スレの 頭の 波に「回　増えすぎ」）。スタートで「実况」の 打ちまちがいと「さんずい　足りんぞ」。
// - 大学は 架空（板の 語）。選手の 名前は 出さない。1区の 先頭と 優勝は 保守大 以外の 4校から 乱数（ちがう 学校）。
//   学校の 名前は かな・漢字 5字まで（候補に 入れても 全角スペースで 区切らずに すむ）。
// - キリコが 書ける 文（候補・当番・山場の 1語）に「保守」「立てといた」「立てたる」「立てたで」を 入れない
//   （保守大を 呼ぶ のは 群衆・字幕だけ）。群衆・題・字幕の「保守」は names の 固有名詞の 中だけ。
// - けが・転倒・途中棄権は 出さない。繰り上げは「よう　走った」で 送る（人を 笑わない）。
// - 文の 幅：レス 12・候補 10・スレタイ・字幕・pin・名前欄・絵の 字 22（全角）。試験は src/sim/jikkyoProgTests.ts。
// 絵は ui/jikkyoEkidenTv.ts（場面の 鍵は EKIDEN_SCENES、絵に 出す 文は EKIDEN_ART）。

import type {
	JkCueGrade,
	JkFit,
	JkOpt,
	JkScript,
	JkScriptSeg,
	JkSlot,
} from "../../core/jikkyo";
import type { Today } from "../calendar";
import type { JkPack } from "./pack";
import type { DayLines } from "./text";

const o = (text: string, fit: JkFit): JkOpt => ({ text, fit });
const B = (t: string) => o(t, "best");
const K = (t: string) => o(t, "ok");
const X = (t: string) => o(t, "miss");

/** 場面の 鍵（札・スタート・道・中継所・山・ゴール）。 */
export const EKIDEN_SCENES = [
	"card",
	"start",
	"road",
	"chukei",
	"yama",
	"goal",
] as const;

/** 大学（架空）。ink は シャツ、sash は 襷の 色（繰り上げの 襷は 白）。 */
export type EkidenUni = {
	readonly name: string;
	readonly ink: string;
	readonly sash: string;
};

/** 1区の 先頭と 優勝を 引く 4校。 */
export const EKIDEN_UNIS: readonly EkidenUni[] = [
	{ name: "sage大", ink: "#3a6ad8", sash: "#f0d040" },
	{ name: "age学院", ink: "#d84848", sash: "#ffe0a0" },
	{ name: "過去ログ大", ink: "#b07a30", sash: "#4a2a10" },
	{ name: "名無し大", ink: "#8a58c0", sash: "#f0c0f0" },
];

/** 地元の 保守大（繰り上げの 山場の 学校。群衆と 字幕だけが 名前を 呼ぶ）。 */
export const HOSHU_UNI: EkidenUni = {
	name: "保守大",
	ink: "#2a9a5a",
	sash: "#ffd040",
};

/** 場面の 小さな 中身（TV が 読む）。 */
export type EkidenData = {
	/**
	 * card：まもなく・予告・おわり／road：走る・給水／chukei：ふつうの 受けわたし・繰り上げの 前・合図・あと／
	 * yama：上り（下り）・山の神／goal：テープ・胴上げ。
	 */
	readonly phase?:
		| "soon"
		| "preview"
		| "end"
		| "run"
		| "kyusui"
		| "normal"
		| "pre"
		| "cue"
		| "after"
		| "climb"
		| "kami"
		| "goal"
		| "yusho";
	/** card の 大きな 文。 */
	readonly card?: string;
	/** 復路（山は 下りの VTR、スタートは 湖・ゴールは 駅前）。 */
	readonly down?: boolean;
	/** 1区の 先頭・優勝（EKIDEN_UNIS の 番）。 */
	readonly lead?: number;
	readonly win?: number;
	/** 保守大の 襷が 号砲までに 届く。 */
	readonly arrive?: boolean;
	/** 号砲の 名目の ms。 */
	readonly exact?: number;
	/** 中継所の 札・優勝の 札。 */
	readonly label?: string;
};

/** 絵に 出す 文（どれも 全角 22字まで）。 */
export const EKIDEN_ART = {
	logo: "保守駅伝",
	machiai: "待合",
	soon: "まもなく　スタート",
	end: "本日の　中継は　おわりました",
	station: "保守村駅",
	start: "スタート",
	goal: "ゴール",
	kuriage: "繰り上げまで",
	pan: "パーン",
	tsunagi: "つないだ",
	shiro: "白い　襷",
	vtr: "VTR",
	kami: "山の神",
	/** 往路・復路の 優勝の 札。 */
	yusho: ["往路優勝", "総合優勝"],
	/** 予告の 札（往路の 日は 復路、復路と 再放送は 来年）。 */
	preview: ["あすは　復路", "来年も　保守駅伝"],
} as const;

/** 往路（0）と 復路（1）の 字幕（{u} は 学校）。 */
const CAP = [
	{
		start: "往路　スタート　保守村駅前",
		road: "1区　先頭は　{u}",
		chukei: "第1中継所",
		ku: "2区や",
		yama: "5区　山上り",
		kuriage: "そのころ　第4中継所",
		relay: "第4中継所",
		goal: "往路　ゴール",
	},
	{
		start: "復路　スタート",
		road: "7区　先頭は　{u}",
		chukei: "第7中継所",
		ku: "8区や",
		yama: "6区　山下りを　ふりかえる",
		kuriage: "第9中継所　繰り上げが　せまる",
		relay: "第9中継所",
		goal: "保守村駅前に　ゴール",
	},
] as const;

/** 群衆の 文（手で 書いた 白い 一覧。レスは 全角 12字まで）。 */
export const EKIDEN_POOLS = {
	// 群衆の pool は 10 前後（直近 4行と 次の 窓の 候補を よけても 決まった 順に ならない ように）
	wait: [
		"31",
		"サンイチ",
		"たておつ",
		"待機",
		"はよ",
		"あと　5分",
		"正月は　これや",
		"こたつで　待機",
		"雑煮　食いながら",
		"今年も　来たな",
		"寒そう",
	],
	start: [
		"はじまた",
		"きたきた",
		"号砲や",
		"いっせいに　出た",
		"おお",
		"団子や",
		"白い　息",
		"正月や",
		"みんな　はやい",
		"寒そう",
	],
	road: [
		"旗　すごい",
		"沿道　すごい",
		"小旗　ふっとる",
		"はやい",
		"ええぞ",
		"白バイ　かっこええ",
		"海　きれい",
		"先頭　はやい",
		"集団　ばらけた",
		"ペース　速い",
		"寒そう",
	],
	kyusui: [
		"給水や",
		"水　わたせ",
		"ナイス",
		"並走　しとる",
		"ええぞ",
		"がんばれ",
		"給水　うまい",
		"落とすなよ",
		"はやい",
		"息　ぴったり",
	],
	chukei: [
		"襷　わたった",
		"ナイス　リレー",
		"つなげ",
		"ええ　リレー",
		"いけ！",
		"中継所や",
		"受け取った",
		"手　あげとる",
		"ええぞ",
		"一礼　しとる",
	],
	climb: [
		"山や",
		"坂　えぐい",
		"登っとる",
		"がんばれ",
		"霧　でとる",
		"きつそう",
		"ええ　フォーム",
		"まだ　登るんか",
		"寒そう",
		"山　高すぎ",
	],
	down: [
		"下っとる",
		"こわい",
		"坂　えぐい",
		"飛んどる",
		"VTRや",
		"去年の　区間賞",
		"ええ　フォーム",
		"がんばれ",
		"霧　でとる",
		"ブレーキ　なしや",
	],
	kami: [
		"山の神や",
		"ごぼう抜き",
		"抜いた！",
		"神や",
		"えぐい",
		"なんやこれ",
		"鳥肌",
		"伝説や",
		"異次元や",
		"また　抜いた",
	],
	kuriage: [
		"間に合え！",
		"あと　少し",
		"頼む",
		"時計　見ろ",
		"保守大　いけ！",
		"地元の　意地や",
		"祈っとる",
		"あと　何秒や",
		"見えるか？",
		"がんばれ",
		"息　止めた",
	],
	// 号砲の 洪水（届いても 届かなくても 同じ pool。ほかの pool と 文を 重ねない：洪水の 行は くりかえしに 数えないので）
	gun: [
		"号砲！",
		"鳴った",
		"うおおお",
		"ああああ",
		"どっちや",
		"パーン",
		"はやすぎ",
		"おそかった",
	],
	tsunagi: [
		"つながった",
		"ようやった",
		"泣ける",
		"保守大　ようやった",
		"ギリギリや",
		"ええもん　見た",
		"地元の　意地",
		"セーフや",
		"よう　走った",
		"心臓に　悪い",
	],
	shiro: [
		"白い　襷や",
		"よう　走った",
		"泣ける",
		"あと　少しやった",
		"無念",
		"また　来年",
		"胸　張れ",
		"ええ　走りやった",
		"保守大　来年や",
		"拍手",
	],
	goal: [
		"ゴールや",
		"テープ　切った",
		"おめでとう",
		"はやい",
		"強すぎ",
		"駅前　すごい人",
		"8888",
		"ええぞ",
		"完勝や",
		"笑顔や",
	],
	yusho: [
		"胴上げや",
		"おめでとう",
		"強かった",
		"王者や",
		"8888",
		"ええ　チームや",
		"紙ふぶきや",
		"泣ける",
		"監督　飛んどる",
		"おめ",
	],
	preview: ["たのしみ", "もう　来年か", "あしたも　見る", "正月　終わる"],
	hansei: [
		"乙",
		"おつかれ",
		"ほな",
		"解散",
		"反省会や",
		"寒かった",
		"雑煮　食う",
		"ええ　正月やった",
		"二度寝する",
		"ええ　レースや",
	],
	rerun: [
		"再放送　乙",
		"結果　知っとる",
		"何回　見ても　ええ",
		"録画　組",
		"もう　正月　終わったで",
	],
	gap: ["次スレ　どこ？", "乱立すな", "950ちうい", "誰か踏め", "襷　つなげ"],
	// 立った スレの 頭の 波（回で 数える ボケ：スレごとに 回が 1つ 増える）
	open: [
		"31",
		"サンイチ",
		"たておつ",
		"スレ立て　乙",
		"もう　次の　回か",
		"回　増えすぎ",
		"1日で　何回　やるねん",
	],
	boo: ["は？", "なんて？"],
	booStart: ["はじまった　ばっかや", "まだ　早い"],
	booPre: ["よう　見い", "どこ　見とんねん"],
	booLate: ["もう　鳴ったで", "は？"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ　見とるんや"],
	/** 1000 の 流れの 予備（群衆の 区切りが ない とき）。 */
	nanashi: ["くるぞ…", "はよ"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句。{kai} は 回（101 から スレごとに 1つ 足す）。 */
export const EKIDEN_THREAD = {
	live: "【実況】保守駅伝　第{kai}回",
	rerun: "【再放送】保守駅伝　第{kai}回",
	liveHansei: "【実況・反省会】保守駅伝　第{kai}回",
	rerunHansei: "【再放送・反省会】保守駅伝　第{kai}回",
	get1000: "1000なら　襷　つながる",
	praise: ">>{n}　神エイム",
	/** スタートの 打ちまちがい（実況 → 実况）と つっこみ。 */
	typo: ["実况　はじまた", "さんずい　足りんぞ"],
	quit: "もう一度　Bで　出る",
	/** 名前欄の 時計（{c} は M:SS）。 */
	clock: "繰り上げまで＠{c}",
} as const;

/** スレの 番号 → 大会の 回。 */
export const ekidenKai = (n: number): number => 100 + n;

const kaiOf = (s: string, n: number) =>
	s.replace("{kai}", String(ekidenKai(n)));

/** 山場の 1語（届けば つないだ、届かなければ 繰り上げ）。 */
export const EKIDEN_WORDS = { arrive: "つないだ", miss: "繰り上げ" } as const;

/** 山の 区切りの 頭（上りと 山の神は 1本の 時計で 走る。TV が 読む）。 */
export const YAMA_AT = 50000;

/** 繰り上げの 中継所の 区切り・合図（1つめ）・拍。ちょうどが 号砲。 */
export const KURIAGE_AT = 74000;
export const EKIDEN_CUE = { at: 87000, beat: 800, pulses: 3 } as const;
export const EKIDEN_EXACT = EKIDEN_CUE.at + EKIDEN_CUE.pulses * EKIDEN_CUE.beat;

/** 号砲の あとの キリコの 名前欄（おみくじ）。 */
export const EKIDEN_NAMES: Readonly<Record<JkCueGrade, string>> = {
	kami: "名無し＠大吉",
	oshii: "名無し＠中吉",
	late: "名無し＠小吉",
	none: "名無し＠末吉",
	flying: "まだ　鳴ってへん",
};

/** 時計の はじめ（繰り上げの 区切りで 0:30）。 */
const CLOCK_FROM = 30;

/**
 * 号砲までの 残り（秒）。繰り上げの 区切りの 頭で 30、合図の 1つめで 3 まで まっすぐ 縮め、
 * 合図の 3拍が 3 → 2 → 1、号砲で 0。区切りの 前と 号砲の あとは null。
 */
export const ekidenLeft = (t: number): number | null => {
	if (t < KURIAGE_AT || t > EKIDEN_EXACT + 1e-9) return null;
	if (t >= EKIDEN_CUE.at)
		return Math.ceil((EKIDEN_EXACT - t) / EKIDEN_CUE.beat - 1e-9);
	const p = (t - KURIAGE_AT) / (EKIDEN_CUE.at - KURIAGE_AT);
	return Math.max(
		EKIDEN_CUE.pulses,
		Math.ceil(CLOCK_FROM - (CLOCK_FROM - EKIDEN_CUE.pulses) * p - 1e-9),
	);
};

/** 「0:SS」（null は 時計を 出さない）。 */
export const ekidenClock = (t: number): string | null => {
	const s = ekidenLeft(t);
	return s === null
		? null
		: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** キリコの 名前欄（繰り上げの 時計。号砲の あとは Cue の おみくじ）。 */
export const ekidenName = (t: number): string | null => {
	const c = ekidenClock(t);
	return c === null ? null : EKIDEN_THREAD.clock.replace("{c}", c);
};

/** 往路（0）か 復路（1）か（再放送は 去年の 復路）。 */
export const ekidenLeg = (slot: JkSlot): 0 | 1 =>
	slot.live && (slot.day ?? 1) === 1 ? 0 : 1;

/** 台本（146秒。pick 13 ＋ Cue）。 */
const ekidenTimeline: JkScript["timeline"] = (rand, slot) => {
	const live = slot.live;
	const leg = ekidenLeg(slot);
	const cap = CAP[leg];
	const down = leg === 1;
	const lead = Math.floor(rand() * EKIDEN_UNIS.length);
	const win =
		(lead + 1 + Math.floor(rand() * (EKIDEN_UNIS.length - 1))) %
		EKIDEN_UNIS.length;
	const arrive = rand() < 0.55;
	const L = EKIDEN_UNIS[lead].name;
	const W = EKIDEN_UNIS[win].name;
	const yusho = EKIDEN_ART.yusho[leg];
	const word = arrive ? EKIDEN_WORDS.arrive : EKIDEN_WORDS.miss;
	const hansei = (n: number) =>
		kaiOf(live ? EKIDEN_THREAD.liveHansei : EKIDEN_THREAD.rerunHansei, n);
	const preview = EKIDEN_ART.preview[leg];
	const segments: JkScriptSeg[] = [
		{
			at: 0,
			scene: "card",
			pool: "wait",
			rate: 0.5,
			bgm: null,
			caption: EKIDEN_ART.soon,
			data: { phase: "soon", card: EKIDEN_ART.soon } satisfies EkidenData,
		},
		{
			at: 6000,
			scene: "start",
			pool: "start",
			rate: 1,
			bgm: "title",
			caption: cap.start,
			react: EKIDEN_THREAD.typo.map((text) => ({ who: "nanashi", text })),
			data: { down } satisfies EkidenData,
		},
		{
			at: 16000,
			scene: "road",
			pool: "road",
			rate: 1.1,
			bgm: "field",
			caption: cap.road.replace("{u}", L),
			data: { phase: "run", lead } satisfies EkidenData,
		},
		{
			at: 28000,
			scene: "road",
			pool: "kyusui",
			rate: 1.1,
			caption: "給水",
			data: { phase: "kyusui", lead } satisfies EkidenData,
		},
		{
			at: 39000,
			scene: "chukei",
			pool: "chukei",
			rate: 1.2,
			bgm: "town",
			caption: cap.chukei,
			data: { phase: "normal", lead, label: cap.chukei } satisfies EkidenData,
		},
		{
			at: YAMA_AT,
			scene: "yama",
			pool: down ? "down" : "climb",
			rate: 1.2,
			bgm: down ? "field2" : "stone",
			caption: cap.yama,
			data: { phase: "climb", down, win, lead } satisfies EkidenData,
		},
		{
			at: 62000,
			scene: "yama",
			pool: "kami",
			rate: 1.4,
			bgm: "battle",
			caption: `${W}　ごぼう抜き`,
			data: { phase: "kami", down, win, lead } satisfies EkidenData,
		},
		// 繰り上げ：号砲までは 名前欄が 時計、道の 先に 保守大が 見えるか（届くかは 乱数）
		{
			at: KURIAGE_AT,
			scene: "chukei",
			pool: "kuriage",
			rate: 1.4,
			bgm: "tense",
			caption: cap.kuriage,
			data: {
				phase: "pre",
				arrive,
				exact: EKIDEN_EXACT,
				label: cap.relay,
			} satisfies EkidenData,
		},
		{
			at: 86000,
			scene: "chukei",
			pool: "kuriage",
			rate: 3.4,
			bgm: null,
			data: {
				phase: "cue",
				arrive,
				exact: EKIDEN_EXACT,
				label: cap.relay,
			} satisfies EkidenData,
		},
		{
			at: 91000,
			scene: "chukei",
			pool: arrive ? "tsunagi" : "shiro",
			rate: 1.2,
			bgm: arrive ? "title" : "sad",
			stall: 1200,
			caption: arrive
				? "保守大　襷を　つないだ"
				: "保守大　白い　襷で　スタート",
			posts: [
				{
					at: 1500,
					who: "nanashi",
					text: arrive ? "保守大、間に合った！" : "保守大、繰り上げ……",
					pin: 2500,
				},
			],
			data: {
				phase: "after",
				arrive,
				exact: EKIDEN_EXACT,
				label: cap.relay,
			} satisfies EkidenData,
		},
		{
			at: 101000,
			scene: "goal",
			pool: "goal",
			rate: 1.2,
			bgm: "field",
			caption: cap.goal,
			data: { phase: "goal", down, win } satisfies EkidenData,
		},
		{
			at: 113000,
			scene: "goal",
			pool: "yusho",
			rate: 1.1,
			bgm: "ending",
			caption: `${yusho}　${W}`,
			data: { phase: "yusho", down, win, label: yusho } satisfies EkidenData,
		},
		{
			at: 124000,
			scene: "card",
			pool: "preview",
			rate: 0.9,
			caption: preview,
			data: { phase: "preview", card: preview } satisfies EkidenData,
		},
		{
			at: 133000,
			scene: "card",
			pool: "hansei",
			rate: 0.7,
			caption: EKIDEN_ART.end,
			title: { now: hansei },
			data: { phase: "end", card: EKIDEN_ART.end } satisfies EkidenData,
		},
	];
	const seen = arrive
		? [
				[B("見えた！"), K("間に合え！"), X("見えへん")],
				[B("来た！"), K("いけ！"), X("まだか…")],
			]
		: [
				[B("見えへん"), K("間に合え！"), X("見えた！")],
				[B("まだか…"), K("いけ！"), X("来た！")],
			];
	const after = arrive
		? [
				[B("つながった"), K("泣ける"), X("見えへん")],
				[B("ようやった"), K("鳥肌"), X(EKIDEN_WORDS.miss)],
				[B("泣ける"), K("ギリギリや"), X("号砲や")],
			]
		: [
				[B("よう　走った"), K("泣ける"), X(EKIDEN_WORDS.arrive)],
				[B("白い　襷や"), K("無念や"), X("見えた！")],
				[B("泣ける"), K("また　来年"), X("ナイス　リレー")],
			];
	const other = EKIDEN_ART.yusho[1 - leg];
	return {
		segments,
		picks: [
			{
				at: 2000,
				boo: "booStart",
				sets: [
					[B("31"), K("はよ"), X("ゴールや")],
					[B("待機"), K("寒そう"), X(EKIDEN_WORDS.arrive)],
					[B("あと　1分"), K("はよ"), X("おめでとう")],
				],
			},
			{
				at: 10500,
				boo: "booStart",
				sets: [
					[B("号砲や"), K("はじまた"), X("31")],
					[B("はじまた"), K("きたきた"), X("ゴールや")],
					[B("いっせいに　出た"), K("おお"), X("胴上げや")],
				],
			},
			// 沿道の 旗・先頭の 学校（字幕と シャツの 札を 読む）
			{
				at: 21000,
				boo: "boo",
				sets: [
					[B("旗　すごい"), K("寒そう"), X("山の神や")],
					[B("沿道　すごい"), K("ええぞ"), X("胴上げや")],
					[B(`${L}　速い`), K("はやい"), X("給水や")],
				],
			},
			{
				at: 32000,
				boo: "boo",
				sets: [
					[B("給水や"), K("ナイス"), X("襷　わたった")],
					[B("水　わたせ"), K("給水や"), X("山の神や")],
					[B("ナイス　給水"), K("ええぞ"), X("号砲や")],
				],
			},
			{
				at: 44000,
				boo: "boo",
				sets: [
					[B("襷　わたった"), K("ええぞ"), X(EKIDEN_WORDS.miss)],
					[B("ナイス　リレー"), K("いけ！"), X("給水や")],
					[B(cap.ku), K("つなげ"), X("31")],
				],
			},
			{
				at: 55000,
				boo: "boo",
				sets: down
					? [
							[B("下っとる"), K("こわい"), X("給水や")],
							[B("坂　えぐい"), K("飛んどる"), X("ゴールや")],
							[B("VTRや"), K("山や"), X("旗　すごい")],
						]
					: [
							[B("坂　えぐい"), K("寒そう"), X("給水や")],
							[B("登っとる"), K("がんばれ"), X("ゴールや")],
							[B("山や"), K("坂　えぐい"), X("旗　すごい")],
						],
			},
			// 山の神（優勝する 学校が 2人を 抜く）
			{
				at: 70500,
				boo: "boo",
				sets: [
					[B("山の神や"), K("ごぼう抜き"), X("襷　わたった")],
					[B("ごぼう抜き"), K("抜いた！"), X("号砲や")],
					[B(`${W}　来た`), K("山の神や"), X(`${L}　速い`)],
				],
			},
			// 繰り上げの 前：道の 先に 保守大が 見えるか（見えれば 届く）
			{ at: 78500, boo: "booPre", sets: seen },
			{ at: 96000, boo: "booLate", sets: after },
			{
				at: 106000,
				boo: "boo",
				sets: [
					[B("ゴールや"), K("おめでとう"), X("号砲や")],
					[B("テープ　切った"), K("ゴールや"), X("坂　えぐい")],
					[B(`${W}　強い`), K("はやい"), X(`${L}　強い`)],
				],
			},
			{
				at: 121000,
				boo: "boo",
				sets: [
					[B("胴上げや"), K("おめでとう"), X("見えへん")],
					[B("おめでとう"), K("強かった"), X("給水や")],
					[B(yusho), K("胴上げや"), X(other)],
				],
			},
			// 予告（往路の 日は あすの 復路、復路と 再放送は 来年）
			{
				at: 127500,
				boo: "boo",
				sets: [
					leg === 0
						? [B("あしたも　見る"), K("たのしみ"), X("また　来年")]
						: [B("また　来年"), K("たのしみ"), X("あしたも　見る")],
				],
			},
			{
				at: 137000,
				boo: "booLate",
				sets: [
					[B("乙"), K("反省会や"), X("号砲や")],
					[B("おつかれ"), K("寒かった"), X("待機")],
					[B("ほな"), K("解散"), X("31")],
				],
			},
		],
		cues: [
			{
				...EKIDEN_CUE,
				word,
				flood: "gun",
				praise: EKIDEN_THREAD.praise,
				cross: arrive
					? { gap: "次スレで　つなげ", fresh: "新スレで　つないだ！" }
					: { gap: "次スレで　見とどけろ", fresh: "新スレで　繰り上げ……" },
				names: EKIDEN_NAMES,
			},
		],
	};
};

/** 保守駅伝の 台本。 */
export const EKIDEN: JkScript = {
	id: "ekiden",
	venue: "station",
	length: 146000,
	goal: { live: 4, rerun: 2 },
	pools: EKIDEN_POOLS,
	title: (n, slot) =>
		kaiOf(slot.live ? EKIDEN_THREAD.live : EKIDEN_THREAD.rerun, n),
	at1000: () => EKIDEN_THREAD.get1000,
	open: "open",
	gapPool: "gap",
	duty: {
		pin: "950ちうい　襷を　つなげ",
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
	quitNote: EKIDEN_THREAD.quit,
	name: ekidenName,
	tune: { post: 0.1, boost: 3, comboMin: 20 },
	bands: {
		p50: { miru: [0.52, 0.6], kami: [1.08, 99] },
		kanso: { jouzu: [0.65, 0.8], shoshin: [0.25, 0.45], random: [0, 0.099] },
	},
	timeline: ekidenTimeline,
};

// ───────────────── 会場（保守村駅の 待合） ─────────────────

const isDay = (m: number, d: number) => (t: Today) => t.m === m && t.d === d;
/** 年の 暮れ（12/26〜1/1）：駅員が 駅伝の 日を 知らせる。 */
const isEve = (t: Today): boolean =>
	(t.m === 12 && t.d >= 26) || (t.m === 1 && t.d === 1);

const TV_LINES: DayLines = [
	{
		when: isDay(1, 2),
		lines: ["待合の　テレビ。\n保守駅伝の　往路を　中継している。"],
	},
	{
		when: isDay(1, 3),
		lines: ["待合の　テレビ。\n保守駅伝の　復路を　中継している。"],
	},
	{
		when: () => true,
		lines: ["待合の　テレビ。\n保守駅伝の　再放送を　流している。"],
	},
];

const STAFF: DayLines = [
	{
		when: isDay(1, 2),
		lines: ["本日は　保守駅伝の　往路です。\n……駅前は　大変　混み合います"],
	},
	{
		when: isDay(1, 3),
		lines: ["本日は　保守駅伝の　復路です。\n……ゴールは　駅前で　ございます"],
	},
	{
		when: isEve,
		lines: ["1月2日と　3日は　保守駅伝です。\n……駅前を　選手が　走ります"],
	},
];

/** 保守駅伝。 */
export const EKIDEN_PACK: JkPack = {
	script: EKIDEN,
	venue: "station",
	from: 7,
	menu: "保守駅伝",
	slot: (t) =>
		t.m === 1 && (t.d === 2 || t.d === 3)
			? { live: true, day: t.d - 1 }
			: { live: false },
	scenes: EKIDEN_SCENES,
	venueLines: { tv: TV_LINES },
	staffLines: { station_staff: STAFF },
	staffOnce: {
		station_staff: {
			kami: "この前の　号砲の　ひとこと、\nぴったりで　ございました",
			rerun: "この前は　★{n}まで　のびましたね。\n1月2日は、もっと　のびますよ",
		},
	},
	msgs: {
		seat: "キリコは　待合の　ベンチに　すわった。\n……スマホで、実況スレを　ひらく。",
		over: "中継が　おわった。\n実況は　★{n}まで　のびた。",
		kanso: "……完走。\nスレの　襷は　つながった。",
		kami: "名前欄に「名無し＠大吉」。\n……ぴったりの　号砲だった。",
		left: "……中継の　とちゅうで、\nそっと　ベンチを　立った。",
	},
	art: [
		...Object.values(EKIDEN_ART).flatMap((v) =>
			typeof v === "string" ? [v] : [...v],
		),
		...EKIDEN_UNIS.map((u) => u.name),
		HOSHU_UNI.name,
	],
	names: ["保守駅伝", "保守村駅", "保守大"],
	deny: [
		"箱根",
		"芦ノ湖",
		"大手町",
		"読売",
		"関東学連",
		"学連",
		"青山学院",
		"青学",
		"駒澤",
		"駒大",
		"早稲田",
		"東洋大",
		"中央大",
		"順天堂",
		"國學院",
		"國学院",
		"創価",
		"城西",
		"帝京",
		"東海大",
		"法政",
		"明治大",
		"日体大",
		"山梨学院",
		"東京国際",
		"神奈川大",
		"大東文化",
		"日テレ",
	],
};
