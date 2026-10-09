// 人力機　保守杯（海の家「age」の 壁の テレビ。夏の 湖の 人力飛行機の 大会。PROGRAMS §1.6）。
// 湖に 突きでた 高い 台から、人が こいで とぶ 飛行機が 1機ずつ 飛びだす。はじめの 3機（4チームから 乱数で 3つ・
// 順も 乱数）が とんで 着水し、記録が 出る。風待ちの 中断を はさみ、最後の 保守大学　人力機部が 折りかえしで
// 旋回して 台の 前まで もどり、大会記録。
// - この 番組の 動詞：1機ごとの スタート（Cue。台の 旗が 3回 上がり、4拍目で 台を けって 飛びだす。1語「とべ！」）・
//   飛びかたを 見て 言う（すぐ 着水＝チーム次スレ・水面 すれすれ＝sage航空部・高く 上がる＝age工房・のびる＝名無しエアロ）・
//   記録の 発表で わく。風待ち（中断）には 窓を 置かない（950 の 当番が 出る 間）。
// - 勢いは 低め（本番 ★3・録画 ★2）。機体が 水に おりるのは「着水」。けが・事故の 話は しない。
// - 8月の 土曜は 生中継、ほかの 日は 録画（群衆に「録画　乙」が まざる）。中身は 曜日で 閉じない。
// - 大会・湖・大学・チームは 架空（板の 語から）。実在の 大会・湖・町・局・会社の 名前は 使わない（deny で 守る）。
// - キリコが 書ける 文（候補・当番・山場の 1語）には「保守」「立てといた」「立てたる」「立てたで」を 入れない。
//   群衆・題・字幕・会場の 文の「保守」は 固有名詞（保守杯・保守大学・保守湖）の 中だけ。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyoTorijinTv.ts。

import type {
	JkFit,
	JkOpt,
	JkRand,
	JkScript,
	JkScriptCue,
	JkScriptPick,
	JkScriptSeg,
	JkSlot,
} from "../../core/jikkyo";
import type { Today } from "../calendar";
import { type JkPack, liveOr } from "./pack";

const o = (text: string, fit: JkFit): JkOpt => ({ text, fit });
const B = (t: string) => o(t, "best");
const K = (t: string) => o(t, "ok");
const X = (t: string) => o(t, "miss");

/** 場面の 鍵（札・オープニング・発進台・空・記録・風待ち）。 */
export const TORIJIN_SCENES = [
	"card",
	"op",
	"dai",
	"sora",
	"kiroku",
	"kaze",
] as const;

/** 飛びかた（short：台から すぐ 着水・low：水面 すれすれ・high：高く 上がる・mid：のびる・last：旋回して もどる）。 */
export type TorijinKind = "short" | "low" | "high" | "mid" | "last";

/** 場面の 小さな 中身（TV が 読む）。 */
export type TorijinData = {
	/** card：まもなく・おわり／dai：紹介・スタート／sora：飛ぶ・旋回・もどる・着水。 */
	readonly phase?:
		| "soon"
		| "end"
		| "intro"
		| "cue"
		| "fly"
		| "turn"
		| "back"
		| "chaku";
	readonly card?: string;
	readonly kind?: TorijinKind;
	/** 何機目か。 */
	readonly no?: number;
	readonly team?: string;
	/** 記録（数と 単位）。 */
	readonly rec?: number;
	readonly unit?: "m" | "km";
	/** 台を けって 飛びだす 名目の ms（山場の ちょうど）。 */
	readonly launch?: number;
};

/** チームと 記録（架空。板の 語から）。 */
export const TORIJIN_TEAMS: Readonly<
	Record<TorijinKind, { team: string; rec: number; unit: "m" | "km" }>
> = {
	short: { team: "チーム次スレ", rec: 9.8, unit: "m" },
	low: { team: "sage航空部", rec: 386.4, unit: "m" },
	high: { team: "age工房", rec: 241.7, unit: "m" },
	mid: { team: "名無しエアロ", rec: 1234.5, unit: "m" },
	last: { team: "保守大学　人力機部", rec: 40, unit: "km" },
};

/** 記録の 字（9.8m・40.0km）。 */
export const recText = (rec: number, unit: string): string =>
	`${rec.toFixed(1)}${unit}`;

/** 絵に 出す 文（どれも 全角 22字まで）。 */
export const TORIJIN_ART = {
	logo: "人力機　保守杯",
	lake: "夏の　保守湖",
	soon: "まもなく　はじまります",
	end: "本日の　中継は　おわりました",
	live: "生中継",
	rec: "録画",
	nth: "{n}機目",
	start: "スタート！",
	chaku: "着水",
	kiroku: "記録",
	taikai: "大会記録",
	dist: "距離",
	turn: "折りかえし",
	kaze: "風待ち",
	stop: "中断中",
} as const;

/** 群衆の 文（手で 書いた 白い 一覧。レスは 全角 12字まで）。 */
export const TORIJIN_POOLS = {
	wait: [
		"待機",
		"はよ",
		"あと　5分",
		"夏や",
		"今年も　来たか",
		"うちわ　用意",
		"毎年　見とる",
		"くるぞ…",
		"そろそろか",
		"楽しみ",
	],
	op: [
		"はじまた",
		"きたあ",
		"夏やな",
		"空　青い",
		"湖　ひろい",
		"ええ　天気",
		"今年も　見るで",
		"台　でかい",
		"ボート　おる",
		"夏の　風物詩",
	],
	dai: [
		"がんばれ",
		"緊張する",
		"風　どうや",
		"台　高いな",
		"こわそう",
		"うちわ　ふっとる",
		"応援　してる",
	],
	dai2: [
		"本命や",
		"保守大学　きた",
		"優勝候補",
		"がんばれ",
		"風　ええ　感じ",
		"去年も　すごかった",
	],
	/** スタートの 洪水（ほかの pool・◎ と 同じ 文は 入れない）。 */
	tobe: ["とべ！", "いけ！", "とんだ！", "いけえ", "スタート！", "とべえ"],
	short: [
		"あっ",
		"はやい",
		"台から　すぐ",
		"ドンマイ",
		"来年や",
		"ぷかぷか　しとる",
		"がんばった",
		"勇気　ある",
		"台の　すぐ　下や",
		"また　来年",
	],
	low: [
		"低い　低い",
		"sage　すぎ",
		"水面　ギリ",
		"低空飛行や",
		"sage進行や",
		"ねばる",
		"しぶとい",
		"水　さわりそう",
		"まだ　とんどる",
	],
	high: [
		"たかい！",
		"age　すぎ",
		"上がっとる",
		"空　高い",
		"age進行や",
		"ええぞ",
		"どこまで　行く",
		"高度　すごい",
		"雲に　とどく",
	],
	mid: [
		"のびる",
		"まだ　いける",
		"きれい",
		"ええぞ",
		"その　まま",
		"安定　しとる",
		"ええ　フォーム",
		"すーっと　いく",
		"がんばれ",
	],
	chaku: [
		"おつかれ",
		"ナイス　ファイト",
		"ドンマイ",
		"水しぶき",
		"よう　とんだ",
		"ええ　フライト",
	],
	kiroku: [
		"おお",
		"8888",
		"ええやん",
		"ナイス",
		"記録　出た",
		"ええ　記録",
		"のびたな",
		"拍手",
		"やるやん",
		"去年より　上",
	],
	fight: [
		"ナイス　ファイト",
		"ドンマイ",
		"来年や",
		"おつかれ",
		"がんばった",
		"8888",
		"拍手",
		"勇気　ある",
		"ええ　チーム",
		"また　見たい",
	],
	kaze: [
		"風待ちか",
		"風　強いな",
		"まったり",
		"待機",
		"麦茶　うまい",
		"うちわ　あおぐ",
		"湖　白波や",
	],
	fly: [
		"のびる",
		"まだ　いける",
		"さすがや",
		"速い",
		"ペダル　軽そう",
		"その　まま",
		"きれい",
		"本命や",
		"安定　しとる",
		"ええ　風",
	],
	turn: [
		"旋回　した！",
		"まがった",
		"うまい",
		"ゆっくり　ゆっくり",
		"あと　半分",
		"まだ　いける",
		"ブイ　まわった",
		"きれいな　弧",
		"慎重や",
	],
	back: [
		"おかえり",
		"もどって　きた",
		"台　見えた",
		"あと　すこし",
		"がんばれ",
		"泣ける",
		"ふんばれ",
		"ペダル　重そう",
		"帰って　くる",
		"いけるで",
	],
	chaku2: [
		"おかえり",
		"おつかれ",
		"台の　前や",
		"すごすぎ",
		"泣ける",
		"ようやった",
	],
	taikai: [
		"大会記録や！",
		"8888",
		"すごすぎ",
		"伝説や",
		"鳥肌",
		"おめでとう",
		"保守大学　すごい",
		"拍手",
		"歴史や",
		"泣いた",
	],
	hansei: [
		"おつかれ",
		"乙",
		"ええ　夏やった",
		"来年も　見る",
		"反省会や",
		"ほな",
		"解散",
		"おやすみ",
		"ええ　大会",
		"夏　おわった",
	],
	rerun: ["録画　乙", "結果　知っとる", "何回　見ても　ええ", "録画　やな"],
	gap: ["次スレ　どこ？", "乱立すな", "950ちうい", "誰か踏め"],
	open: ["31", "サンイチ", "たておつ", "スレ立て　乙"],
	boo: ["は？", "なんて？"],
	booStart: ["はじまった　ばっかや", "まだ　早い"],
	booLate: ["もう　おわったで", "は？"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ　見とるんや"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句。 */
export const TORIJIN_THREAD = {
	live: "【実況】人力機　保守杯★{n}",
	rerun: "【録画】人力機　保守杯★{n}",
	liveLast: "【実況】人力機　保守杯★{n}【最終機】",
	rerunLast: "【録画】人力機　保守杯★{n}【最終機】",
	liveHansei: "【実況・反省会】保守杯★{n}",
	rerunHansei: "【録画・反省会】保守杯★{n}",
	get1000: "1000なら　来年も　とぶ",
	praise: ">>{n}　ナイス　スタート",
	crossGap: "次スレで　とべ！",
	crossFresh: "新スレで　とべた",
	quit: "もう一度　Bで　出る",
} as const;

const fillN = (s: string, n: number) => s.replace("{n}", String(n));

/** スタートの 1語（台を けって 飛びだす 拍に 書く）。 */
export const TORIJIN_WORD = "とべ！";

/** 1機の 区切りの 頭から 合図の 1つめ・拍・合図の 数・飛びだす ちょうど。 */
export const TORIJIN_CUE = { in: 5500, beat: 800, pulses: 3 } as const;
const LAUNCH_IN = TORIJIN_CUE.in + TORIJIN_CUE.pulses * TORIJIN_CUE.beat;

/**
 * はじめの 3機の 頭（名目の ms）・風待ち（最後の 機の 前）・最後の 機・おわりの 札・長さ。
 * 窓の ない 間（風待ち・最後の 機の 旋回の あと）は 見るだけの 950 が 来る あたりに 置いた（当番が 出せる）。
 */
const AT = {
	flights: [16000, 40000, 64000],
	kaze: 88000,
	last: 96000,
	end: 140000,
	length: 150000,
} as const;

/** 最後の 機の 区切りと 窓（機の 頭からの ms）。 */
export const TORIJIN_LAST = {
	cue: 5000,
	fly: 9000,
	turn: 17000,
	back: 24000,
	chaku: 34000,
	kiroku: 36000,
	pFly: 10000,
	pTurn: 18000,
	pBack: 30000,
	pRec: 36500,
} as const;

/** 飛びかたの 字幕。 */
const FLY_CAPTION: Readonly<Record<TorijinKind, string>> = {
	short: "あっと　いう間に　着水",
	low: "水面　すれすれを　とぶ",
	high: "ぐんぐん　高度を　上げる",
	mid: "すーっと　のびて　いく",
	last: "風に　のって　ぐんぐん　のびる",
};

/** 飛んで いる あいだの 窓（飛びかたで ◎ が かわる）。 */
const FLY_SETS: Readonly<
	Record<Exclude<TorijinKind, "last">, readonly (readonly JkOpt[])[]>
> = {
	short: [
		[B("あっ"), K("ドンマイ"), X("のびる")],
		[B("ドンマイ"), K("おつかれ"), X("たかい！")],
		[B("おつかれ"), K("あっ"), X("低い　低い")],
	],
	low: [
		[B("低い　低い"), K("がんばれ"), X("たかい！")],
		[B("sage　すぎ"), K("まだ　いける"), X("あっ")],
		[B("ねばる"), K("のびる"), X("旋回　した！")],
	],
	high: [
		[B("たかい！"), K("のびる"), X("低い　低い")],
		[B("age　すぎ"), K("がんばれ"), X("ドンマイ")],
		[B("上がっとる"), K("ええぞ"), X("おかえり")],
	],
	mid: [
		[B("のびる"), K("ええぞ"), X("あっ")],
		[B("まだ　いける"), K("がんばれ"), X("おつかれ")],
		[B("きれい"), K("のびる"), X("低い　低い")],
	],
};

/** 記録の 発表（すぐ 着水なら あたたかく、のびた 機体には わく）。 */
const REC_SETS: readonly (readonly JkOpt[])[] = [
	[B("おお"), K("8888"), X("あっ")],
	[B("8888"), K("ええやん"), X("まだ　いける")],
	[B("ええ　記録"), K("おつかれ"), X(TORIJIN_WORD)],
];
const FIGHT_SETS: readonly (readonly JkOpt[])[] = [
	[B("来年も　待っとる"), K("ドンマイ"), X("のびる")],
	[B("ナイス　ファイト"), K("おつかれ"), X("まだ　いける")],
];

/** スタートの 山場（どの 機体も 同じ 1語。最後の 機は 重み 2）。 */
const cueAt = (at: number, weight: number): JkScriptCue => ({
	at,
	beat: TORIJIN_CUE.beat,
	pulses: TORIJIN_CUE.pulses,
	word: TORIJIN_WORD,
	flood: "tobe",
	weight,
	praise: TORIJIN_THREAD.praise,
	cross: { gap: TORIJIN_THREAD.crossGap, fresh: TORIJIN_THREAD.crossFresh },
});

type Part = {
	segments: JkScriptSeg[];
	picks: JkScriptPick[];
	cues: JkScriptCue[];
};

/** 速記の 1行（チームと 記録。スレの 上に 止める）。 */
const recPost = (team: string, rec: number, unit: string) => ({
	at: 1400,
	who: "nanashi",
	text: `${team}　${recText(rec, unit)}`,
	pin: 2500,
});

/** はじめの 3機の 1機（24秒）：紹介 → スタート（Cue）→ 飛ぶ → 着水 → 記録。 */
const flight = (
	T: number,
	no: number,
	kind: Exclude<TorijinKind, "last">,
): Part => {
	const { team, rec, unit } = TORIJIN_TEAMS[kind];
	const base = { kind, no, team, rec, unit, launch: T + LAUNCH_IN };
	const short = kind === "short";
	return {
		segments: [
			{
				at: T,
				scene: "dai",
				pool: "dai",
				rate: 0.8,
				bgm: "field",
				caption: `${no}機目　${team}`,
				data: { ...base, phase: "intro" } satisfies TorijinData,
			},
			{
				at: T + 5000,
				scene: "dai",
				pool: "dai",
				rate: 1.5,
				bgm: null,
				data: { ...base, phase: "cue" } satisfies TorijinData,
			},
			{
				at: T + 9000,
				scene: "sora",
				pool: kind,
				rate: 1,
				bgm: "field2",
				caption: FLY_CAPTION[kind],
				data: { ...base, phase: "fly" } satisfies TorijinData,
			},
			{
				at: T + 15500,
				scene: "sora",
				pool: short ? "short" : "chaku",
				rate: 1,
				...(short ? {} : { caption: "ここで　着水" }),
				data: { ...base, phase: "chaku" } satisfies TorijinData,
			},
			{
				at: T + 18000,
				scene: "kiroku",
				pool: short ? "fight" : "kiroku",
				rate: 1.1,
				posts: [recPost(team, rec, unit)],
				data: base satisfies TorijinData,
			},
		],
		picks: [
			{ at: T + 10000, boo: "boo", sets: FLY_SETS[kind] },
			{ at: T + 18500, boo: "boo", sets: short ? FIGHT_SETS : REC_SETS },
		],
		cues: [cueAt(T + TORIJIN_CUE.in, 1)],
	};
};

/**
 * 最後の 機（44秒）：紹介 → スタート → のびる → 折りかえしで 旋回 → 台へ もどる → 台の 前で 着水 → 大会記録。
 * 群衆の 重みは 見るだけの 950 が 窓の ない 間に 来るように 合わせた（生中継は 風待ち、録画は 旋回の あと）。
 */
const lastFlight = (F: number, live: boolean): Part => {
	const { team, rec, unit } = TORIJIN_TEAMS.last;
	const base = {
		kind: "last" as const,
		no: 4,
		team,
		rec,
		unit,
		launch: F + LAUNCH_IN,
	};
	const last = live ? TORIJIN_THREAD.liveLast : TORIJIN_THREAD.rerunLast;
	const L = TORIJIN_LAST;
	return {
		segments: [
			{
				at: F,
				scene: "dai",
				pool: "dai2",
				rate: 1.2,
				bgm: "field",
				caption: "最後は　保守大学　人力機部",
				title: { next: (n) => fillN(last, n) },
				react: [{ who: "nanashi", text: "本命　きた" }],
				data: { ...base, phase: "intro" } satisfies TorijinData,
			},
			{
				at: F + L.cue,
				scene: "dai",
				pool: "dai2",
				rate: 2,
				bgm: null,
				data: { ...base, phase: "cue" } satisfies TorijinData,
			},
			{
				at: F + L.fly,
				scene: "sora",
				pool: "fly",
				rate: 1.4,
				bgm: "island",
				caption: FLY_CAPTION.last,
				data: { ...base, phase: "fly" } satisfies TorijinData,
			},
			{
				at: F + L.turn,
				scene: "sora",
				pool: "turn",
				rate: 1.4,
				caption: "折りかえしで　ゆっくり　旋回",
				data: { ...base, phase: "turn" } satisfies TorijinData,
			},
			{
				at: F + L.back,
				scene: "sora",
				pool: "back",
				rate: 1,
				caption: "台へ　もどって　くる",
				data: { ...base, phase: "back" } satisfies TorijinData,
			},
			{
				at: F + L.chaku,
				scene: "sora",
				pool: "chaku2",
				rate: 1.3,
				caption: "台の　前で　着水",
				data: { ...base, phase: "chaku" } satisfies TorijinData,
			},
			{
				at: F + L.kiroku,
				scene: "kiroku",
				pool: "taikai",
				rate: 1.5,
				bgm: "title",
				title: { next: null },
				posts: [recPost(team, rec, unit)],
				data: base satisfies TorijinData,
			},
		],
		picks: [
			{
				at: F + L.pFly,
				boo: "boo",
				sets: [
					[B("まだ　いける"), K("がんばれ"), X("あっ")],
					[B("のびる"), K("きれい"), X("おつかれ")],
					[B("さすがや"), K("のびる"), X("低い　低い")],
				],
			},
			{
				at: F + L.pTurn,
				boo: "boo",
				sets: [
					[B("旋回　した！"), K("うまい"), X("おかえり")],
					[B("まがった！"), K("ゆっくり"), X("ドンマイ")],
					[B("うまい"), K("あと　半分"), X("あっ")],
				],
			},
			{
				at: F + L.pBack,
				boo: "boo",
				sets: [
					[B("おかえり"), K("あと　すこし"), X("旋回　した！")],
					[B("もどって　きた"), K("がんばれ"), X("待機")],
					[B("あと　すこし"), K("おかえり"), X("はじまた")],
				],
			},
			{
				at: F + L.pRec,
				boo: "boo",
				sets: [
					[B("大会記録や！"), K("8888"), X("ドンマイ")],
					[B("8888"), K("すごすぎ"), X("今北産業")],
					[B("伝説や"), K("おめでとう"), X("あっ")],
				],
			},
		],
		cues: [cueAt(F + TORIJIN_CUE.in, 2)],
	};
};

/** はじめの 3機（4チームから 乱数で 3つ・順も 乱数）。 */
const pickKinds = (rand: JkRand): Exclude<TorijinKind, "last">[] => {
	const ks: Exclude<TorijinKind, "last">[] = ["short", "low", "high", "mid"];
	for (let i = ks.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[ks[i], ks[j]] = [ks[j], ks[i]];
	}
	return ks.slice(0, 3);
};

/** 台本（150秒。pick 13 ＋ スタートの Cue 4）。 */
const torijinTimeline: JkScript["timeline"] = (rand, slot) => {
	const live = slot.live;
	const hansei = live ? TORIJIN_THREAD.liveHansei : TORIJIN_THREAD.rerunHansei;
	const parts = [
		...pickKinds(rand).map((k, i) => flight(AT.flights[i], i + 1, k)),
		lastFlight(AT.last, live),
	];
	const segments: JkScriptSeg[] = [
		{
			at: 0,
			scene: "card",
			pool: "wait",
			rate: 0.5,
			bgm: null,
			data: { phase: "soon", card: TORIJIN_ART.soon } satisfies TorijinData,
		},
		{
			at: 6000,
			scene: "op",
			pool: "op",
			rate: 0.9,
			bgm: "island",
			caption: "夏の　保守湖から　おとどけします",
		},
		{
			at: AT.kaze,
			scene: "kaze",
			pool: "kaze",
			rate: 1,
			bgm: "kumori",
			caption: "風待ちで　中断中",
			react: [{ who: "nanashi", text: "風待ちか" }],
		},
		...parts.flatMap((p) => p.segments),
		{
			at: AT.end,
			scene: "card",
			pool: "hansei",
			rate: 0.35,
			bgm: "ending",
			title: { now: (n) => fillN(hansei, n) },
			data: { phase: "end", card: TORIJIN_ART.end } satisfies TorijinData,
		},
	];
	segments.sort((a, b) => a.at - b.at);
	const picks: JkScriptPick[] = [
		{
			at: 1500,
			boo: "booStart",
			sets: [
				[B("待機"), K("はよ"), X("おつかれ")],
				[B("あと　1分"), K("くるぞ…"), X("8888")],
				[B("今年も　来た"), K("待機"), X("おかえり")],
			],
		},
		{
			at: 10500,
			boo: "booStart",
			sets: [
				[B("はじまた"), K("夏やな"), X("待機")],
				[B("きたあ"), K("ええ　天気"), X("おつかれ")],
				[B("夏やな"), K("湖　きれい"), X("ドンマイ")],
			],
		},
		...parts.flatMap((p) => p.picks),
		{
			at: AT.end + 1500,
			boo: "booLate",
			sets: [
				[B("おつかれ"), K("反省会や"), X("はじまた")],
				[B("ええ　夏やった"), K("乙"), X("待機")],
				[B("乙"), K("来年も　見る"), X(TORIJIN_WORD)],
			],
		},
	];
	picks.sort((a, b) => a.at - b.at);
	return { segments, picks, cues: parts.flatMap((p) => p.cues) };
};

/** 人力機　保守杯の 台本。 */
export const TORIJIN: JkScript = {
	id: "torijin",
	venue: "umi",
	length: AT.length,
	goal: { live: 3, rerun: 2 },
	pools: TORIJIN_POOLS,
	title: (n, slot) =>
		fillN(slot.live ? TORIJIN_THREAD.live : TORIJIN_THREAD.rerun, n),
	at1000: () => TORIJIN_THREAD.get1000,
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
	quitNote: TORIJIN_THREAD.quit,
	// 帯：窓が 13 と スタートが 4つ（P が 空飛ぶ鯖より 大きい）ので、書きこみの 波を 0.08、コンボを 2.4 に 下げた。
	// 生中継 上手 77%・初心者 29%、録画 74%・37%（見るだけ 0.57G・神 1.29G・random 0%）。
	tune: { post: 0.08, boost: 2.4, comboMin: 20 },
	bands: {
		p50: { miru: [0.52, 0.6], kami: [1.08, 99] },
		kanso: { jouzu: [0.65, 0.8], shoshin: [0.25, 0.45], random: [0, 0.099] },
	},
	timeline: torijinTimeline,
};

/** 生中継の 日（8月の 土曜）。 */
const isLiveDay = (t: Today): boolean => t.m === 8 && t.w === 6;

/** 人力機　保守杯。 */
export const TORIJIN_PACK: JkPack = {
	script: TORIJIN,
	venue: "umi",
	from: 2,
	menu: "人力機　保守杯",
	slot: liveOr(isLiveDay),
	scenes: TORIJIN_SCENES,
	// 同じ テレビで 夏の 保守園も 流れるので、テレビと 店主の 文は 生中継の 日だけ
	venueLines: {
		tv: [
			{
				when: isLiveDay,
				lines: ["小さな　テレビ。\n人力機　保守杯の　生中継。"],
			},
		],
	},
	staffLines: {
		umi_master: [
			{
				when: isLiveDay,
				lines: [
					"今日は　テレビで　人力機の　大会や。\n……うちわ、あおいで　見とき",
				],
			},
		],
	},
	staffOnce: {
		umi_master: {
			kami: "最後の　機体の　スタート、\nぴったり　やったな",
			rerun: "録画で　★{n}まで　のびたな。\n8月の　土曜は　生中継やで",
		},
	},
	msgs: {
		howto: "飛びだす　拍と、合う　レスで、\nスレが　のびる。目標：★{n}　完走",
		seat: "キリコは　ござに　すわった。\n……スマホで、実況スレを　ひらく。",
		over: "中継が　おわった。\n実況は　★{n}まで　のびた。",
		kami: "最後の　機体は、\nぴったりの　拍で　飛びだした。",
		left: "……中継の　とちゅうで、\nそっと　席を　立った。",
	},
	art: [
		...Object.values(TORIJIN_ART),
		...Object.values(TORIJIN_TEAMS).map((t) => t.team),
		...Object.values(TORIJIN_TEAMS).map((t) => recText(t.rec, t.unit)),
	],
	deny: [
		"鳥人間",
		"琵琶湖",
		"彦根",
		"読売",
		"岩谷",
		"竹生島",
		"多景島",
		"松原",
	],
	names: ["保守杯", "保守大学", "保守湖"],
};
