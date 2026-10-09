// 保守記念（G1）（カジノ「ガチャ」の 壁の 大画面。見るだけ。PROGRAMS §5.4）。
// 日曜の 午後、8頭が 本馬場入場 → ファンファーレ → ゲートイン → スタート → 道中 → 4コーナー → 最後の 直線 →
// ゴール → 写真判定 → 確定 → 表彰式。おんJ競馬部の 実況スレで 見る。
// - この 番組の 動詞：レースを 読んで 早く 言いきる。直線で 逃げ馬が 粘るか 差し馬が 届くかを 読んで
//   「そのまま！」か「差せ！」（芯の 窓。重み 2。窓の あいだに 差し馬の 伸びが 見える。4つに 1つは はじめの 2秒が 逆）。
//   ほかに 読む 窓：スタートの 出遅れ・1000m 通過の 時計（ハイペースか スローか。直線の 読みの 手がかり）・
//   4コーナーで 詰まったか。写真判定の あいだの「確定や」は ×（気が 早い）で、確定の ランプに 合わせて 1語（Cue）。
// - 起きる ことは 出遅れ・詰まり・差し／粘り・写真判定 だけ（どれも 乱数）。落馬・故障・競走中止・失格は 作らない。
// - 賭けの 話は 出さない（予想は「どの 馬が 勝つか」まで）。馬は 板の 語から 作った 架空の 名前、勝負服は 単色と 番号、
//   騎手は 名前を 出さない。レースの 名前・競馬場・曲・局は 架空（ファンファーレは ゲームの 曲）。
// - キリコが 書ける 文（候補・当番・山場の 1語）に「保守」「立てといた」「立てたる」「立てたで」を 入れない。
//   群衆・題・字幕の「保守」は 固有名詞（保守記念）の 中だけ。馬の 名前は 絵と 字幕と 書きこみだけ（レスに 入れない）。
// - 日曜は 本番（★4）、ほかの 日は 再放送（★2。群衆に「結果　知っとる」が まざる）。
// - スレタイは「おんJ競馬部　1717R」から（次スレは R を 1つ 足す）。終わりの 区切りで【反省会】に かわる。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyoKeibaTv.ts。
import type {
	JkFit,
	JkOpt,
	JkRand,
	JkScript,
	JkScriptSeg,
	JkSlot,
} from "../../core/jikkyo";
import type { Today } from "../calendar";
import { type JkPack, liveOr, onWeekdays } from "./pack";

const o = (text: string, fit: JkFit, boo?: string): JkOpt =>
	boo ? { text, fit, boo } : { text, fit };
const B = (t: string) => o(t, "best");
const K = (t: string) => o(t, "ok");
const X = (t: string, boo?: string) => o(t, "miss", boo);

/** 場面の 鍵（TV が 描く）。 */
export const KEIBA_SCENES = [
	"card",
	"honba",
	"gate",
	"start",
	"dochu",
	"corner",
	"chokusen",
	"goal",
	"photo",
	"kakutei",
	"hyosho",
] as const;
export type KeibaScene = (typeof KEIBA_SCENES)[number];

/** 馬（馬番 1〜8。架空の 名前・毛の 色・勝負服の 色）。 */
export const KEIBA_HORSES = [
	{ name: "ジスレタテタ", coat: "#7a4a24", silk: "#f0f0ec" },
	{ name: "ホシュノヒカリ", coat: "#5a3218", silk: "#2a2a34" },
	{ name: "カコログダケ", coat: "#9a5a2a", silk: "#d83030" },
	{ name: "アゲアゲボーイ", coat: "#3a2416", silk: "#3060d0" },
	{ name: "センレスオー", coat: "#a8a49c", silk: "#e8c020" },
	{ name: "カンソウキング", coat: "#6a3c1c", silk: "#30a050" },
	{ name: "サンイチボシ", coat: "#8a4e22", silk: "#f08020" },
	{ name: "ハヨタテロ", coat: "#4a2c18", silk: "#f070b0" },
] as const;

/** 絵に 出す 文（どれも 全角 22字まで）。 */
export const KEIBA_ART = {
	title: "保守記念（G1）",
	course: "芝　2000m",
	soon: "まもなく　発走",
	end: "本日の　中継は　おわりました",
	split: "1000m",
	photo: "写真",
	kakutei: "確定",
	hana: "ハナ",
	win: "優勝",
	/** 脚質（本馬場入場の 札）。 */
	style: { nige: "逃げ", sashi: "差し", senko: "先行", oikomi: "追込" },
} as const;

/** 1つの レースの 筋（乱数で 決める。区切りの data で TV に わたす）。馬は 0〜7（馬番 − 1）。 */
export type KeibaRace = {
	/** 逃げ馬。 */
	readonly lead: number;
	/** 差し馬（直線で 逃げ馬を 追う）。 */
	readonly closer: number;
	/** 出遅れた 馬（−1 は なし）。 */
	readonly late: number;
	/** 1000m 通過が 速い（ハイペース。差しが 届きやすい）。 */
	readonly fast: boolean;
	/** 4コーナーで 差し馬が 詰まる（直線の 頭で 開く）。 */
	readonly tsumari: boolean;
	/** 差しきる（false は 逃げ馬が 粘る）。 */
	readonly sashi: boolean;
	/** 直線の 窓の はじめの 2秒が 逆に 見える。 */
	readonly fake: boolean;
	/** 3着。 */
	readonly third: number;
};

/** 場面の 小さな 中身（TV が 読む）。 */
export type KeibaData = {
	readonly race?: KeibaRace;
	/** card：まもなく・おわり／gate：ファンファーレ・ゲートイン／dochu：1000m 通過／photo：確定の 合図。 */
	readonly phase?: "soon" | "end" | "fanfare" | "in" | "pace" | "cue";
	/** card の 大きな 文。 */
	readonly card?: string;
	/** 確定の ちょうどの 名目の ms（photo の ランプ）。 */
	readonly exact?: number;
};

/** 群衆の 文（手で 書いた 白い 一覧。レスは 全角 12字まで）。 */
export const KEIBA_POOLS = {
	wait: [
		"31",
		"サンイチ",
		"たておつ",
		"待機",
		"はよ",
		"あと　5分",
		"そろそろや",
		"日曜は　これや",
		"G1や",
		"予想　した？",
	],
	honba: [
		"きたきた",
		"ええ　馬体",
		"毛づや　ええな",
		"返し馬　ええ",
		"かっこええ",
		"冷静や",
		"どれが　勝つ？",
		"ワイは　逃げ馬",
		"ワイは　差し馬",
		"でかい　馬や",
	],
	gate: [
		"この曲　すき",
		"鳥肌",
		"いよいよや",
		"ドキドキ",
		"静かに",
		"くるぞ…",
		"緊張　する",
		"ゲート　入った",
		"大丈夫か",
	],
	start: [
		"スタート！",
		"いった！",
		"はじまった",
		"おお",
		"いけ！",
		"飛び出した",
		"たのむで",
	],
	dochu: [
		"逃げとる",
		"ペース　どうや",
		"折り合い　ええ",
		"まだ　動くな",
		"落ち着け",
		"我慢　や",
		"ええ　位置",
		"後ろ　大丈夫か",
		"向こう　正面",
		"時計　どうや",
	],
	corner: [
		"4コーナー！",
		"動いた",
		"仕掛けた",
		"くるぞ…",
		"外　回せ",
		"前　あけ",
		"いけるか",
		"勝負　どころ",
		"手応え　どうや",
	],
	chokusen: [
		"直線や！",
		"いけ！",
		"粘れ！",
		"届け！",
		"くるうううう",
		"うおおお",
		"がんばれ",
		"あと　少し",
		"そのまま！",
		"差せ！",
	],
	goal: [
		"うおおお",
		"ゴール！",
		"並んだ！",
		"どっちや！",
		"わからん",
		"きわどい",
		"ああああ",
	],
	photo: [
		"長いな",
		"どっちや",
		"鼻差か",
		"ドキドキ",
		"写真判定や",
		"はよ　して",
		"祈っとる",
		"息　止めた",
		"わからん",
	],
	// 確定の 洪水（ほかの pool と 文を 重ねない：洪水の 行は 直近の くりかえしに 数えないので）
	flood: [
		"確定や！",
		"確定！",
		"きたあああ",
		"よっしゃ",
		"はやすぎ",
		"おそかった",
	],
	kakutei: [
		"おめでとう",
		"強い",
		"ええ　レース",
		"すごい",
		"やるやん",
		"感動した",
		"鳥肌",
		"ナイス",
		"さすがや",
	],
	hyosho: [
		"おめでとう",
		"8888",
		"ええ　レイ",
		"レイ　似合う",
		"かっこええ",
		"泣ける",
		"ええ　顔",
		"記念写真や",
		"また　見たい",
	],
	hansei: [
		"乙",
		"反省会や",
		"ほな",
		"おつかれ",
		"来週も　見るで",
		"解散",
		"ええ　レース　やった",
		"次の　G1　いつ？",
	],
	rerun: [
		"再放送　乙",
		"結果　知っとる",
		"ネタバレ　すな",
		"何回　見ても　ええ",
	],
	gap: ["次スレ　どこ？", "乱立すな", "950ちうい", "誰か踏め"],
	open: ["31", "サンイチ", "たておつ", "スレ立て　乙"],
	boo: ["は？", "なんて？"],
	booEarly: ["まだ　早い", "気が　早い", "まだ　走っとる"],
	booPhoto: ["まだ　写真判定や", "気が　早い", "ランプ　見ろ"],
	booLate: ["もう　終わった", "は？"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ　見とるんや"],
	/** 1000 の 流れの 予備（群衆の 区切りが ない とき）。 */
	nanashi: ["くるぞ…", "はよ"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句。{r} は R の 数（1716 ＋ スレの 番）。 */
export const KEIBA_THREAD = {
	live: "おんJ競馬部　{r}R",
	rerun: "【再放送】おんJ競馬部　{r}R",
	liveHansei: "【反省会】おんJ競馬部　{r}R",
	rerunHansei: "【再放送・反省会】おんJ競馬部　{r}R",
	get1000: "1000なら　来週も　G1",
	praise: ">>{n}　神エイム",
	crossGap: "次スレで　確定や",
	crossFresh: "新スレで　確定や！",
	quit: "もう一度　Bで　出る",
} as const;

/** スレの 番 → R の 数（1本目が 1717R）。 */
export const keibaR = (n: number): number => 1716 + n;

const titleOf =
	(k: "" | "Hansei") =>
	(n: number, slot: JkSlot): string =>
		KEIBA_THREAD[`${slot.live ? "live" : "rerun"}${k}` as const].replace(
			"{r}",
			String(keibaR(n)),
		);

/** 確定の 1語（Cue）。 */
export const KEIBA_WORD = "確定や";

/** 区切りの 時（名目の ms）。直線の 窓・ゴール・確定の 合図。 */
export const KEIBA_AT = {
	chokusen: 70000,
	core: 78000,
	goal: 86000,
	photo: 89000,
	kakutei: 102000,
} as const;

/** 確定の 合図（1つめ）・拍（写真の ランプが 3回 光って、4拍目に 確定の ランプ）。 */
export const KEIBA_CUE = { at: 97000, beat: 1000, pulses: 3 } as const;
export const KEIBA_EXACT = KEIBA_CUE.at + KEIBA_CUE.pulses * KEIBA_CUE.beat;

/** 直線の 頭から ゴール板まで（名目の ms。ゴールの 区切りの 0.8秒 目）。 */
export const KEIBA_LINE = KEIBA_AT.goal + 800 - KEIBA_AT.chokusen;

/** 0〜7 から ex を のぞいて 1つ。 */
const other = (rand: JkRand, ex: readonly number[]): number => {
	const xs = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => !ex.includes(i));
	return xs[Math.floor(rand() * xs.length)] ?? 0;
};

/** レースの 筋（ハイペースなら 7割 差しきり、スローなら 7割 逃げ粘り）。 */
export const keibaRace = (rand: JkRand): KeibaRace => {
	const lead = Math.floor(rand() * 8);
	const closer = other(rand, [lead]);
	const late = rand() < 0.5 ? other(rand, [lead]) : -1;
	const fast = rand() < 0.5;
	const sashi = rand() < (fast ? 0.7 : 0.3);
	const tsumari = rand() < 0.5;
	const fake = rand() < 0.25;
	const third = other(rand, [lead, closer]);
	return { lead, closer, late, fast, tsumari, sashi, fake, third };
};

/** 1着・2着・3着（0〜7）。 */
export const keibaOrder = (r: KeibaRace): readonly [number, number, number] =>
	r.sashi ? [r.closer, r.lead, r.third] : [r.lead, r.closer, r.third];

/**
 * 直線の 頭からの 名目の ms → 逃げ馬と 差し馬の 差（馬身。負は 差し馬が 前）。
 * 窓（8〜12秒）の あいだに 差しきりは 2 → 0.3、粘りは 2 → 1.6。fake は はじめの 2秒が 逆。
 * ゴール板（KEIBA_LINE）では どちらも ハナ差（写真判定）。
 */
export const keibaGap = (r: KeibaRace, lt: number): number => {
	const core = KEIBA_AT.core - KEIBA_AT.chokusen;
	const mid = r.sashi ? (r.fake ? 1.9 : 1.15) : r.fake ? 1.2 : 1.85;
	const keys: [number, number][] = [
		[0, 3.4],
		...(r.tsumari ? ([[2500, 3.4]] as [number, number][]) : []),
		[core, 2],
		[core + 2000, mid],
		[core + 4000, r.sashi ? 0.3 : 1.6],
		[KEIBA_LINE, r.sashi ? -0.15 : 0.12],
		[KEIBA_LINE + 3000, r.sashi ? -0.9 : -0.5],
	];
	if (lt <= 0) return keys[0][1];
	for (let i = 1; i < keys.length; i++) {
		const [t1, g1] = keys[i];
		const [t0, g0] = keys[i - 1];
		if (lt <= t1) return g0 + ((g1 - g0) * (lt - t0)) / (t1 - t0);
	}
	return keys[keys.length - 1][1];
};

/** 台本（140秒。pick 12 ＋ Cue。950 の 当番が 出せる ように 直線の 前と 表彰式の 前は 窓を あける）。 */
const keibaTimeline: JkScript["timeline"] = (rand) => {
	const race = keibaRace(rand);
	const [first] = keibaOrder(race);
	const winner = `1着　${first + 1}番　${KEIBA_HORSES[first].name}`;
	const d = (x: Omit<KeibaData, "race"> = {}): KeibaData => ({ race, ...x });
	const segments: JkScriptSeg[] = [
		{
			at: 0,
			scene: "card",
			pool: "wait",
			rate: 0.5,
			bgm: null,
			data: d({ phase: "soon", card: KEIBA_ART.soon }),
		},
		{
			at: 7000,
			scene: "honba",
			pool: "honba",
			rate: 1,
			bgm: "field",
			caption: "本馬場入場",
			data: d(),
		},
		// ファンファーレは ゲームの 曲。ゲートインで 曲を 止めて 静かに
		{
			at: 19000,
			scene: "gate",
			pool: "gate",
			rate: 1.1,
			bgm: "title",
			caption: "ファンファーレ",
			data: d({ phase: "fanfare" }),
		},
		{
			at: 27000,
			scene: "gate",
			pool: "gate",
			rate: 1.2,
			bgm: null,
			caption: "ゲートイン",
			data: d({ phase: "in" }),
		},
		{
			at: 32000,
			scene: "start",
			pool: "start",
			rate: 1.6,
			bgm: "battle",
			caption: "スタート",
			data: d(),
		},
		{
			at: 39000,
			scene: "dochu",
			pool: "dochu",
			rate: 1.1,
			caption: "向こう正面",
			data: d(),
		},
		{
			at: 50000,
			scene: "dochu",
			pool: "dochu",
			rate: 1.2,
			caption: "1000m　通過",
			data: d({ phase: "pace" }),
		},
		{
			at: 60000,
			scene: "corner",
			pool: "corner",
			rate: 1.4,
			bgm: "tense",
			caption: "4コーナー",
			data: d(),
		},
		{
			at: KEIBA_AT.chokusen,
			scene: "chokusen",
			pool: "chokusen",
			rate: 2.2,
			bgm: "boss",
			// 詰まった 差し馬の 前が 開く（直線の 2.5秒 目）
			...(race.tsumari
				? { posts: [{ at: 2600, who: "nanashi", text: "開いた！" }] }
				: {}),
			data: d(),
		},
		// ゴール（鯖が 重い）
		{
			at: KEIBA_AT.goal,
			scene: "goal",
			pool: "goal",
			rate: 3,
			bgm: null,
			stall: 1500,
			data: d(),
		},
		{
			at: KEIBA_AT.photo,
			scene: "photo",
			pool: "photo",
			rate: 1.3,
			bgm: "tense",
			caption: "写真判定",
			data: d({ exact: KEIBA_EXACT }),
		},
		{
			at: KEIBA_CUE.at - 1000,
			scene: "photo",
			pool: "photo",
			rate: 3.2,
			bgm: null,
			data: d({ phase: "cue", exact: KEIBA_EXACT }),
		},
		{
			at: KEIBA_AT.kakutei,
			scene: "kakutei",
			pool: "kakutei",
			rate: 1.5,
			bgm: "title",
			caption: winner,
			posts: [{ at: 600, who: "nanashi", text: winner, pin: 3000 }],
			data: d(),
		},
		{
			at: 110000,
			scene: "hyosho",
			pool: "hyosho",
			rate: 1.3,
			bgm: "ending",
			caption: "表彰式",
			data: d(),
		},
		{
			at: 124000,
			scene: "card",
			pool: "hansei",
			rate: 1,
			title: { now: titleOf("Hansei") },
			data: d({ phase: "end", card: KEIBA_ART.end }),
		},
	];
	return {
		segments,
		picks: [
			{
				at: 2000,
				boo: "booEarly",
				sets: [
					[B("待機"), K("はよ"), X("確定や")],
					[B("あと　5分"), K("そろそろや"), X("おめでとう")],
					[B("31"), K("待機"), X("乙")],
				],
			},
			{
				at: 12000,
				boo: "booEarly",
				sets: [
					[B("きたきた"), K("ええ　馬体"), X("出遅れた")],
					[B("ええ　馬体"), K("毛づや　ええ"), X("差せ！")],
					[B("返し馬　ええ"), K("冷静や"), X("おめでとう")],
				],
			},
			{
				at: 21500,
				boo: "booEarly",
				sets: [
					[B("この曲　すき"), K("鳥肌"), X("確定や")],
					[B("鳥肌"), K("いよいよや"), X("差しきった")],
					[B("いよいよや"), K("ドキドキ"), X("乙")],
				],
			},
			// スタート：ゲートに 1頭 のこるか（出遅れ）
			{
				at: 32500,
				boo: "boo",
				sets:
					race.late >= 0
						? [
								[B("出遅れた"), K("あっ"), X("ええ　スタート")],
								[B("出遅れた"), K("あかん"), X("そろった")],
							]
						: [
								[B("ええ　スタート"), K("そろった"), X("出遅れた")],
								[B("そろった"), K("いった！"), X("出遅れた")],
							],
			},
			{
				at: 42500,
				boo: "boo",
				sets: [
					[B("逃げとる"), K("ええ　位置"), X("確定や")],
					[B("折り合い　ええ"), K("我慢　や"), X("差せ！")],
					[B("まだ　動くな"), K("落ち着け"), X("おめでとう")],
				],
			},
			// 1000m 通過の 時計と 隊列（縦長か 団子か）を 読む
			{
				at: 52000,
				boo: "boo",
				sets: race.fast
					? [
							[B("ハイペース"), K("縦長や"), X("スローや")],
							[B("速いな"), K("ハイペース"), X("遅いな")],
						]
					: [
							[B("スローや"), K("団子や"), X("ハイペース")],
							[B("遅いな"), K("スローや"), X("速いな")],
						],
			},
			// 4コーナー：差し馬の 前に 壁が できるか
			{
				at: 62500,
				boo: "boo",
				sets: race.tsumari
					? [
							[B("詰まった"), K("あかん"), X("手応え　ええ")],
							[B("前　壁や"), K("詰まった"), X("外　回せた")],
						]
					: [
							[B("手応え　ええ"), K("くるぞ…"), X("詰まった")],
							[B("外　回せた"), K("手応え　ええ"), X("前　壁や")],
						],
			},
			// 芯：差し馬が 届くか、逃げ馬が 粘るか。早く 正しく 言いきるほど 高い（重み 2）
			{
				at: KEIBA_AT.core,
				weight: 2,
				boo: "boo",
				sets: race.sashi
					? [
							[B("差せ！"), K("届け！"), X("そのまま！")],
							[B("差せ！"), K("くるうううう"), X("そのまま！")],
						]
					: [
							[B("そのまま！"), K("粘れ！"), X("差せ！")],
							[B("そのまま！"), K("残れ！"), X("差せ！")],
						],
			},
			// 写真判定：まだ 決まって いない（「確定や」は 気が 早い）
			{
				at: 90500,
				boo: "boo",
				sets: [
					[B("どっちや"), K("長いな"), X("確定や", "booPhoto")],
					[B("写真判定や"), K("ドキドキ"), X("確定や", "booPhoto")],
					[B("鼻差か"), K("どっちや"), X("おめでとう", "booPhoto")],
				],
			},
			// 確定：逃げきりか 差しきりか
			{
				at: 104000,
				boo: "booLate",
				sets: race.sashi
					? [
							[B("差しきった"), K("強い"), X("逃げきった")],
							[B("差しきった"), K("おめでとう"), X("粘った")],
						]
					: [
							[B("逃げきった"), K("強い"), X("差しきった")],
							[B("粘った"), K("おめでとう"), X("差しきった")],
						],
			},
			{
				at: 120000,
				boo: "booLate",
				sets: [
					[B("おめでとう"), K("8888"), X("差せ！")],
					[B("8888"), K("ええ　レイ"), X("そのまま！")],
					[B("レイ　似合う"), K("かっこええ"), X("出遅れた")],
				],
			},
			{
				at: 131000,
				boo: "booLate",
				sets: [
					[B("乙"), K("反省会や"), X("待機")],
					[B("おつかれ"), K("ほな"), X("いよいよや")],
					[B("来週も　見るで"), K("解散"), X("31")],
				],
			},
		],
		cues: [
			{
				...KEIBA_CUE,
				word: KEIBA_WORD,
				flood: "flood",
				praise: KEIBA_THREAD.praise,
				cross: { gap: KEIBA_THREAD.crossGap, fresh: KEIBA_THREAD.crossFresh },
			},
		],
	};
};

/** 保守記念（G1）の 台本。 */
export const KEIBA: JkScript = {
	id: "keiba",
	venue: "casino",
	length: 140000,
	goal: { live: 4, rerun: 2 },
	pools: KEIBA_POOLS,
	title: titleOf(""),
	at1000: () => KEIBA_THREAD.get1000,
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
	quitNote: KEIBA_THREAD.quit,
	// 帯（sora と 同じ tune）：本番 上手 74%・初心者 34%、再放送 82%・29%（見るだけ 0.56〜0.57G・神 1.32G〜・random 1%）。
	// 再放送は 上手と 初心者の 差が 開きやすく（post・boost・comboMin を どう 動かしても 上手 ≤80% で 初心者 ≤26%）、
	// 初心者の 側を 残して 上手の 上の はばを 0.85 に 広げた
	tune: { post: 0.1, boost: 3, comboMin: 20 },
	bands: {
		p50: { miru: [0.52, 0.6], kami: [1.08, 99] },
		kanso: { jouzu: [0.65, 0.85], shoshin: [0.25, 0.45], random: [0, 0.099] },
	},
	timeline: keibaTimeline,
};

/** 日曜（本番）。 */
const isSunday = (t: Today): boolean => t.w === 0;

/**
 * 保守記念（G1）。会場の 文は 日曜だけ 上書き（ほかの 日は いつもの「レースの　中継が　映る」と
 * ディーラーの いつもの 1行。jikkyoTests A3：10月の 金・火は 映画館の ほかに 上書きを 置かない）。
 */
export const KEIBA_PACK: JkPack = {
	script: KEIBA,
	venue: "casino",
	from: 7,
	menu: "保守記念",
	slot: liveOr(onWeekdays(0)),
	scenes: KEIBA_SCENES,
	venueLines: {
		tv: [
			{ when: isSunday, lines: ["大画面。\n今日は『保守記念』の　生中継。"] },
		],
	},
	staffLines: {
		casino_dealer: [
			{
				when: isSunday,
				lines: ["今日は　保守記念の　中継や。\n……ここは　見るだけの　店やで"],
			},
		],
	},
	staffOnce: {
		casino_dealer: {
			kami: "この前の　確定や、\nランプと　ぴったり　やったな",
			rerun: "この前は　★{n}まで　のびたな。\n日曜の　本番は、もっと　のびるで",
		},
	},
	msgs: {
		howto:
			"見せ場に　合う　レスで　スレが　のびる。\n直線は　早めに。目標：★{n}　完走",
		seat: "キリコは　大画面の　前に　立った。\n……スマホで、実況スレを　ひらく。",
		over: "中継が　おわった。\n実況は　★{n}まで　のびた。",
		kami: "確定の　ランプと　同時に。\n……ぴったりの　一瞬だった。",
		left: "……中継の　とちゅうで、\nそっと　大画面を　はなれた。",
	},
	art: [
		KEIBA_ART.title,
		KEIBA_ART.course,
		KEIBA_ART.soon,
		KEIBA_ART.end,
		KEIBA_ART.split,
		KEIBA_ART.photo,
		KEIBA_ART.kakutei,
		KEIBA_ART.hana,
		...Object.values(KEIBA_ART.style),
		...KEIBA_HORSES.map((h) => h.name),
		...KEIBA_HORSES.map((h) => `${KEIBA_ART.win}　${h.name}`),
		"1/2",
		"？",
		"58.4",
		"62.1",
		"1:58.7",
		"2:01.3",
	],
	deny: [
		// レース・競馬場・団体・お金の 話
		"東京優駿",
		"天皇賞",
		"ジャパンカップ",
		"宝塚記念",
		"菊花賞",
		"桜花賞",
		"皐月賞",
		"オークス",
		"東京競馬場",
		"中山",
		"阪神",
		"京都",
		"府中",
		"馬券",
		"オッズ",
		"払い戻し",
		"払戻",
		"単勝",
		"複勝",
		"馬連",
		"三連単",
		"三連複",
		"配当",
		"万馬券",
		"的中",
		"当たった",
		"夢見れ",
		"いくら",
		"人気",
		"賭け",
		// 実在の 名馬・騎手・遊び
		"ディープインパクト",
		"オルフェーヴル",
		"キタサンブラック",
		"イクイノックス",
		"ゴールドシップ",
		"ウオッカ",
		"アーモンドアイ",
		"ドウデュース",
		"シンボリルドルフ",
		"トウカイテイオー",
		"オグリキャップ",
		"ナリタブライアン",
		"サイレンススズカ",
		"スペシャルウィーク",
		"テイエムオペラオー",
		"メジロマックイーン",
		"コントレイル",
		"ハルウララ",
		"武豊",
		"ウマ娘",
	],
	names: ["保守記念"],
};
