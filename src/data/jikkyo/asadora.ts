// 朝の　スレ小説『あげは』（喫茶「おんJ」の 壁の テレビ。PROGRAMS §1.6「15秒の 小さな 毎朝の 実況」）。
// 村の 娘 あげはが、村で 揚げパンの 店を ひらく 夢を 追う 15分の 連続ドラマ（架空）。毎朝 1話、86秒：
// まもなく → オープニング → 本編（その 日の 出来事 2つ と 引き。3通りから 乱数で 1話）→「つづく」→ 予告 →
// ニュースの 人の 受け（架空。実在の アナウンサーは 出さない）。画面の すみの 時計は 7:14 → 7:30。
// - 芯：終わる 直前（7:28）の 引きで 画面に「つづく」が 出る 拍に「ここで　つづくんか」（Cue）。群衆は ここが いちばん 多い。
//   予告の 窓は 曜日で ◎ が かわる：月〜金は「明日が　待てん」、土曜と 日曜の まとめは「来週が　つらい」
//   （予告の 札に「明日の　あげは」／「来週の　あげは」）。もう 1組は 予告の 絵（晴れ／雨）で ◎ が かわる。
// - 日：月〜土は 本放送（第N話。1月1日の ある 週を 第1週、週は 月曜から 数えて N = 6 × (週 − 1) ＋ 曜日）、
//   日曜は その 週の まとめ（再放送。★を 下げ、群衆に「再放送　乙」が まざる）。中身は 曜日で 閉じない。
// - 題・人物は 架空（板の「age」から あげは・揚げパン）。曲名・歌は 出さない。
// - キリコが 書ける 文（候補・当番・山場の 1語）には「保守」「立てといた」「立てたる」「立てたで」を 入れない。
// - 文の 幅：レス 12・候補 10・スレタイ・字幕・pin・絵の 字 22（全角）。村の 窓は 22字 × 2行。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyo/jikkyoAsadoraTv.ts。

import type {
	JkFit,
	JkOpt,
	JkScript,
	JkScriptSeg,
	JkSlot,
} from "../../core/jikkyo";
import type { Today } from "../town/calendar";
import type { JkPack, JkPackSlot } from "./pack";

const o = (text: string, fit: JkFit): JkOpt => ({ text, fit });
const B = (t: string) => o(t, "best");
const K = (t: string) => o(t, "ok");
const X = (t: string) => o(t, "miss");

/** 場面の 鍵（札・オープニング・本編・引き・受け）。 */
export const ASADORA_SCENES = [
	"card",
	"op",
	"mise",
	"tsuzuku",
	"news",
] as const;

/** 本編の 出来事（屋台の 絵の 人と 小物）。 */
export type AsaEv =
	| "kanban"
	| "maekake"
	| "kage"
	| "kyaku"
	| "koin"
	| "tegami"
	| "koge"
	| "tomo"
	| "retsu";

/** 場面の 小さな 中身（TV が 読む）。 */
export type AsadoraData = {
	/** 画面の すみの 時計（7時 min 分 → to 分）。 */
	readonly min?: number;
	readonly to?: number;
	/** card：まもなく・予告／tsuzuku：引き・合図・つづいた あと。 */
	readonly phase?: "soon" | "preview" | "pre" | "cue" | "after";
	/** card の 大きな 文。 */
	readonly card?: string;
	/** card・op の 小さな 文（副題）。 */
	readonly sub?: string;
	/** op の 話数（第N話・第N週の　まとめ）。 */
	readonly ep?: string;
	/** mise・tsuzuku の 出来事。 */
	readonly ev?: AsaEv;
	/** 「つづく」が 出る 名目の ms と 拍。 */
	readonly exact?: number;
	readonly beat?: number;
	/** 予告の 空が 雨。 */
	readonly rain?: boolean;
	/** 受けの 顔（0 にこにこ・1 涙を ふく・2 おなかが すいた）。 */
	readonly face?: 0 | 1 | 2;
};

/** 絵に 出す 文（どれも 全角 22字まで。{n} は 話数・週）。 */
export const ASADORA_ART = {
	show: "朝のスレ小説",
	title: "『あげは』",
	soon: "まもなくはじまります",
	author: "作名無しさん",
	sign: "あげパン",
	tsuzuku: "つづく",
	yokoku: "次回予告",
	tomorrow: "明日のあげは",
	nextWeek: "来週のあげは",
	news: "あさのニュース",
	ep: "第{n}話",
	week: "第{n}週のまとめ",
} as const;

/** 1話（本編の 出来事 2つ と 引き、受け）。窓の 組は 2通り（乱数で 1つ）。 */
type Beat = {
	readonly cap: string;
	readonly ev: AsaEv;
	readonly pool: string;
	readonly sets: readonly (readonly JkOpt[])[];
};
type Episode = {
	readonly sub: string;
	readonly a: Beat;
	readonly b: Beat;
	readonly hiki: Beat;
	/** ニュースの 人の 受け（字幕）。 */
	readonly uke: string;
	readonly face: 0 | 1 | 2;
};

/** 話（3通り。毎朝 乱数で 1つ）。 */
export const ASADORA_EPISODES: readonly Episode[] = [
	{
		sub: "看板の日",
		a: {
			cap: "あげは、店の看板を描く",
			ev: "kanban",
			pool: "mise",
			sets: [
				[B("今日もえらい"), K("字うまいな"), X("朝から泣かすな")],
				[B("がんばれ"), K("ええ看板"), X("ここでつづくんか")],
			],
		},
		b: {
			cap: "ばあちゃんの古い前かけ",
			ev: "maekake",
			pool: "naki",
			sets: [
				[B("朝から泣かすな"), K("ええ話や"), X("今日もえらい")],
				[B("ばあちゃん…"), K("泣ける"), X("はじまた")],
			],
		},
		hiki: {
			cap: "店の前に知らない人が……",
			ev: "kage",
			pool: "hiki",
			sets: [
				[B("だれや"), K("不穏"), X("ほっこり")],
				[B("えっ"), K("気になる"), X("おはよう")],
			],
		},
		uke: "「いい字でしたね」",
		face: 0,
	},
	{
		sub: "はじめてのお客",
		a: {
			cap: "はじめてのお客は小さな子",
			ev: "kyaku",
			pool: "hokko",
			sets: [
				[B("ほっこり"), K("ええ客や"), X("だれや")],
				[B("初のお客"), K("よかったな"), X("あかん")],
			],
		},
		b: {
			cap: "あげは、はじめてのお金をかざる",
			ev: "koin",
			pool: "naki",
			sets: [
				[B("朝から泣かすな"), K("泣ける"), X("こげとる")],
				[B("目から汗"), K("ええ話や"), X("仕事行ってくる")],
			],
		},
		hiki: {
			cap: "大家さんが手紙を持ってきた",
			ev: "tegami",
			pool: "hiki",
			sets: [
				[B("手紙？"), K("不穏"), X("ほっこり")],
				[B("だれからや"), K("えっ"), X("今日もえらい")],
			],
		},
		uke: "「……泣いてませんよ」",
		face: 1,
	},
	{
		sub: "こげたパン",
		a: {
			cap: "揚げパンがまっ黒にこげた",
			ev: "koge",
			pool: "koge",
			sets: [
				[B("あかん"), K("がんばれ"), X("ほっこり")],
				[B("こげとる"), K("あるある"), X("今日もえらい")],
			],
		},
		b: {
			cap: "幼なじみがこげたパンを食べる",
			ev: "tomo",
			pool: "hokko",
			sets: [
				[B("ほっこり"), K("ええやつ"), X("だれや")],
				[B("ええ友達や"), K("やさしい"), X("こげとる")],
			],
		},
		hiki: {
			cap: "朝の店の前に行列……？",
			ev: "retsu",
			pool: "hiki",
			sets: [
				[B("行列！？"), K("えっ"), X("朝から泣かすな")],
				[B("なんで？"), K("気になる"), X("あかん")],
			],
		},
		uke: "「揚げパン、食べたくなりました」",
		face: 2,
	},
];

/** 予告（晴れ／雨。絵で ◎ が かわる 組の 中身）。 */
export const ASADORA_PREVIEW = [
	{
		sub: "次回「開店の朝」",
		rain: false,
		best: "開店や！",
		miss: "不穏やな",
	},
	{ sub: "次回「雨の日」", rain: true, best: "不穏やな", miss: "開店や！" },
] as const;

/** 群衆の 文（手で 書いた 白い 一覧。レスは 全角 12字まで）。 */
export const ASADORA_POOLS = {
	wait: [
		"おはよう",
		"待機",
		"朝や",
		"コーヒーいれた",
		"はよ",
		"あと1分",
		"今日も見るで",
		"眠い",
		"パン焼いとる",
	],
	op: [
		"はじまた",
		"OP　きた",
		"この絵すき",
		"朝や",
		"目さめた",
		"蝶きれい",
		"今日もはじまた",
	],
	mise: [
		"あげはがんばれ",
		"えらい",
		"うまそう",
		"朝から腹へった",
		"揚げパン食いたい",
		"飯テロ",
		"手際ええな",
	],
	// 窓の あとに 950 の 当番が 来うる 区切りの pool には その 窓の ◎ を 入れない
	// （◎ は 群衆が なぞって 書く。当番を はさんで 同じ 行が 4行 以内に ならない ように）
	koge: [
		"まっ黒や",
		"煙出とる",
		"炭や",
		"次がんばれ",
		"やってもうた",
		"火強すぎ",
		"あるある",
	],
	naki: [
		"泣ける",
		"涙出た",
		"しみる",
		"あかん泣く",
		"ええ話や",
		"ティッシュどこ",
		"目がかすむ",
		"朝からこれは",
	],
	hokko: [
		"ええ話や",
		"やさしい",
		"朝からええもん見た",
		"平和や",
		"ここすき",
		"ええ子や",
		"なごむ",
	],
	hiki: ["だれや", "えっ", "気になる", "不穏", "まさか", "あと2分", "ここで？"],
	ume: [
		"くるぞ…",
		"あと1分",
		"ここで切るんか",
		"まさか",
		"7時28分や",
		"息止まる",
	],
	flood: [
		"ここでつづくんか",
		"つづくんか",
		"ええとこで",
		"うそやろ",
		"ここで！？",
		"生殺しや",
	],
	after: [
		"ええとこで切るな",
		"15分短い",
		"引きがうまい",
		"ずるい",
		"気になる",
		"続きはよ",
		"あああ",
	],
	preview: ["予告きた", "たのしみ", "雨か", "えっ", "次も見る", "どうなるんや"],
	news: [
		"受けきた",
		"ニュースの人すき",
		"出勤や",
		"乙",
		"ほな",
		"今日もがんばろ",
		"また見よう",
		"受けもええな",
	],
	rerun: [
		"再放送乙",
		"まとめでええわ",
		"見逃してた",
		"日曜はこれ",
		"1週間早い",
		"まとめ助かる",
	],
	gap: ["次スレどこ？", "乱立すな", "950ちうい", "誰か踏め"],
	open: ["31", "サンイチ", "たておつ", "スレ立て乙", "おはよう"],
	boo: ["は？", "なんて？"],
	booStart: ["はじまったばっかや", "まだ早い"],
	booLate: ["もうつづいとる", "は？"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ見とるんや"],
	/** 1000 の 流れの 予備（群衆の 区切りが ない とき）。 */
	nanashi: ["くるぞ…", "はよ"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句。 */
export const ASADORA_THREAD = {
	live: "【朝スレ部】あげは第{d}話★{n}",
	rerun: "【朝スレ部】あげは第{d}週★{n}",
	after: "【朝スレ部】あげは感想★{n}",
	get1000: "1000ならあげは開店",
	praise: ">>{n}　神エイム",
	crossGap: "つづくは次スレで",
	crossFresh: "新スレで間に合った",
	quit: "もう一度Bで出る",
} as const;

const fill = (s: string, k: string, v: number) =>
	s.replace(`{${k}}`, String(v));
/** 区切りの data（型を 見る だけ）。 */
const D = (x: AsadoraData): AsadoraData => x;

/** 山場の 1語（画面に「つづく」が 出る 拍に 書く）。 */
export const ASADORA_WORD = "ここでつづくんか";

/** 山場の 合図（1つめ）・拍・ちょうど（名目の ms。7:28）。 */
export const ASADORA_CUE = { at: 50500, beat: 800, pulses: 3 } as const;
export const ASADORA_EXACT =
	ASADORA_CUE.at + ASADORA_CUE.pulses * ASADORA_CUE.beat;

// ───────────────── 日（第N話） ─────────────────

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** 1月1日から 何日目（0 から。うるう年は 見ない）。 */
const yday = (t: Today): number =>
	MONTH_DAYS.slice(0, t.m - 1).reduce((a, b) => a + b, 0) + t.d - 1;

/** 第何週か（1月1日の ある 週が 第1週。週は 月曜から）。 */
export const asadoraWeek = (t: Today): number => {
	const mon = (t.w + 6) % 7;
	const back = (((mon - yday(t)) % 7) + 7) % 7;
	return (yday(t) - mon + back) / 7 + 1;
};

/** その 日の 枠：月〜土は 第N話（day）、日曜は その 週の まとめ（day は 週の 土曜の 話数）。 */
export const asadoraSlot = (t: Today): JkPackSlot => {
	const wk = asadoraWeek(t);
	return t.w === 0
		? { live: false, day: wk * 6 }
		: { live: true, day: (wk - 1) * 6 + t.w };
};

/** 来週へ つづく 日（土曜の 本放送と 日曜の まとめ）。 */
const toNextWeek = (slot: JkSlot): boolean =>
	!slot.live || (slot.day ?? 1) % 6 === 0;

/** 話数の 文（第N話・第N週の　まとめ）。 */
const epText = (slot: JkSlot): string =>
	slot.live
		? fill(ASADORA_ART.ep, "n", slot.day ?? 1)
		: fill(ASADORA_ART.week, "n", Math.max(1, Math.round((slot.day ?? 6) / 6)));

// ───────────────── 台本 ─────────────────

/** 台本（86秒。pick 7 ＋ Cue）。 */
const asadoraTimeline: JkScript["timeline"] = (rand, slot) => {
	const ep = ASADORA_EPISODES[Math.floor(rand() * ASADORA_EPISODES.length)];
	const pv = ASADORA_PREVIEW[Math.floor(rand() * ASADORA_PREVIEW.length)];
	const week = toNextWeek(slot);
	const exact = ASADORA_EXACT;
	const beat = ASADORA_CUE.beat;
	const segments: JkScriptSeg[] = [
		{
			at: 0,
			scene: "card",
			pool: "wait",
			rate: 0.5,
			bgm: null,
			caption: ASADORA_ART.soon,
			data: D({ phase: "soon", min: 14, to: 15 }),
		},
		{
			at: 5000,
			scene: "op",
			pool: "op",
			rate: 1,
			bgm: "field",
			// まとめ（日曜）は 話の 副題を 出さない
			data: D({
				min: 15,
				to: 16,
				ep: epText(slot),
				...(slot.live ? { sub: ep.sub } : {}),
			}),
		},
		{
			at: 15000,
			scene: "mise",
			pool: ep.a.pool,
			rate: 1,
			bgm: "town",
			caption: ep.a.cap,
			data: D({ min: 16, to: 21, ev: ep.a.ev }),
		},
		{
			at: 27000,
			scene: "mise",
			pool: ep.b.pool,
			rate: 1.1,
			bgm: "sad",
			caption: ep.b.cap,
			data: D({ min: 21, to: 26, ev: ep.b.ev }),
		},
		{
			at: 38000,
			scene: "mise",
			pool: "hiki",
			rate: 1.4,
			bgm: "tense",
			caption: ep.hiki.cap,
			data: D({ min: 26, to: 27, ev: ep.hiki.ev }),
		},
		{
			at: 47000,
			scene: "tsuzuku",
			pool: "ume",
			rate: 1.8,
			bgm: null,
			data: D({ min: 27, to: 28, ev: ep.hiki.ev, phase: "pre", exact, beat }),
		},
		{
			at: 50000,
			scene: "tsuzuku",
			pool: "ume",
			rate: 3.5,
			bgm: null,
			data: D({ min: 28, ev: ep.hiki.ev, phase: "cue", exact, beat }),
		},
		{
			at: 54000,
			scene: "tsuzuku",
			pool: "after",
			rate: 1.6,
			bgm: "ending",
			data: D({ min: 28, to: 29, ev: ep.hiki.ev, phase: "after", exact, beat }),
		},
		{
			at: 61000,
			scene: "card",
			pool: "preview",
			rate: 1,
			bgm: "town",
			caption: pv.sub,
			data: D({
				phase: "preview",
				card: week ? ASADORA_ART.nextWeek : ASADORA_ART.tomorrow,
				sub: pv.sub,
				rain: pv.rain,
				min: 29,
				to: 30,
			}),
		},
		{
			at: 70000,
			scene: "news",
			pool: "news",
			rate: 1.2,
			bgm: "retro",
			caption: ep.uke,
			title: { now: (n) => fill(ASADORA_THREAD.after, "n", n) },
			posts: [{ at: 1500, who: "nanashi", text: `受け${ep.uke}` }],
			data: D({ min: 30, to: 31, face: ep.face }),
		},
	];
	const day = week
		? [B("来週がつらい"), K("たのしみ"), X("明日が待てん")]
		: [B("明日が待てん"), K("たのしみ"), X("来週がつらい")];
	return {
		segments,
		picks: [
			{
				at: 1500,
				boo: "booStart",
				sets: [
					[B("おはよう"), K("待機"), X("仕事行ってくる")],
					[B("待機"), K("コーヒーいれた"), X("ここでつづくんか")],
					[B("今日も見るで"), K("はよ"), X("来週がつらい")],
				],
			},
			{
				at: 9500,
				boo: "booStart",
				sets: [
					[B("はじまた"), K("OP　すき"), X("ここでつづくんか")],
					[B("OP　きた"), K("目さめた"), X("仕事行ってくる")],
					[B("今日もはじまた"), K("朝や"), X("来週がつらい")],
				],
			},
			{ at: 19500, boo: "boo", sets: ep.a.sets },
			{ at: 31000, boo: "boo", sets: ep.b.sets },
			{ at: 41000, boo: "boo", sets: ep.hiki.sets },
			// 予告：明日／来週（土曜と 日曜の まとめは 来週）か、予告の 絵（晴れ／雨）で ◎ が かわる
			{
				at: 63500,
				boo: "booLate",
				sets: [
					day,
					[B(pv.best), K(week ? "来週がつらい" : "明日が待てん"), X(pv.miss)],
				],
			},
			{
				at: 78500,
				boo: "booLate",
				sets: [
					[B("わかる"), K("受けすき"), X("はじまた")],
					[B("仕事行ってくる"), K("ほな行くわ"), X("おはよう")],
					[B("ほな行くわ"), K("乙"), X("今日も見るで")],
				],
			},
		],
		cues: [
			{
				...ASADORA_CUE,
				word: ASADORA_WORD,
				flood: "flood",
				praise: ASADORA_THREAD.praise,
				cross: {
					gap: ASADORA_THREAD.crossGap,
					fresh: ASADORA_THREAD.crossFresh,
				},
			},
		],
	};
};

/** 朝の　スレ小説『あげは』の 台本。 */
export const ASADORA: JkScript = {
	id: "asadora",
	venue: "cafe",
	length: 86000,
	goal: { live: 4, rerun: 2 },
	pools: ASADORA_POOLS,
	title: (n, slot) =>
		fill(
			fill(slot.live ? ASADORA_THREAD.live : ASADORA_THREAD.rerun, "n", n),
			"d",
			slot.live
				? (slot.day ?? 1)
				: Math.max(1, Math.round((slot.day ?? 6) / 6)),
		),
	at1000: () => ASADORA_THREAD.get1000,
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
			{
				pin: "出勤前にだれか頼む",
				opts: [B("立ててくる"), K("誰か踏め"), X("仕事行ってくる")],
			},
		],
	},
	replies: {
		best: { pool: "reply:best", n: [1, 2] },
		ok: { pool: "reply:ok", n: [1, 1] },
		miss: { pool: "reply:miss", n: [1, 1] },
	},
	// ◎ を なぞる 群衆は 1行（窓が 閉じて すぐ 950 の 当番が 開くと、2行目が 当番の あとに 出る ため）
	echoN: [1, 1],
	extra: [{ pool: "rerun", p: 0.15, when: (slot: JkSlot) => !slot.live }],
	quitNote: ASADORA_THREAD.quit,
	// 帯（試験の 種で 回した）：窓が 7つ＋山場と 少ないので、1つの 窓の 波を sora より 少し 大きく（post 0.13）。
	// 本放送 上手 74%・初心者 35%、まとめ 75%・36%（見るだけ 0.56G・神 1.09G・random 0%）。
	// 本放送の ★4 は 見るだけでも 2本目の 950 が 予告と 受けの あいだに 来る ため（★3 だと 引きの 山場に かかる）
	tune: { post: 0.13, boost: 3, comboMin: 20 },
	bands: {
		p50: { miru: [0.52, 0.6], kami: [1.08, 99] },
		kanso: { jouzu: [0.65, 0.8], shoshin: [0.25, 0.45], random: [0, 0.099] },
	},
	timeline: asadoraTimeline,
};

/** 朝の　スレ小説（喫茶の 壁の テレビ）。 */
export const ASADORA_PACK: JkPack = {
	script: ASADORA,
	venue: "cafe",
	from: 5,
	menu: "朝のスレ小説",
	slot: asadoraSlot,
	scenes: ASADORA_SCENES,
	venueLines: {
		tv: [
			{
				when: (t) => t.w === 0,
				lines: ["壁のテレビ。\n日曜は『あげは』の1週間のまとめ。"],
			},
			{
				when: () => true,
				lines: ["壁のテレビ。\n朝のスレ小説『あげは』が流れる。"],
			},
		],
	},
	msgs: {
		seat: "キリコはモーニングをたのんだ。\n……スマホで、実況スレをひらく。",
		over: "ドラマがおわった。\n実況は★{n}までのびた。",
		kanso: "……完走。\nコーヒーがさめていた。",
		kami: "「ここでつづくんか」。\n……ぴったりの一瞬だった。",
		left: "……ドラマのとちゅうで、\nそっとスマホをふせた。",
	},
	art: Object.values(ASADORA_ART),
	deny: [
		"連続テレビ小説",
		"朝ドラ",
		"朝ドラ受け",
		"あさイチ",
		"ちむどんどん",
		"あまちゃん",
		"おしん",
		"虎に翼",
		"ばけばけ",
	],
};
