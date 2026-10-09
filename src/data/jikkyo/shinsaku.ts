// 保守ゲームス　新作発表会（ゲームセンター「連コ」の 壁の 大画面。PROGRAMS §5.4）。
// 架空の 会社「保守ゲームス」の 配信。広報が あいさつ → 影の ティザー 3本（1本ずつ 正体が 出る）→ 延期の お詫び →
// 「最後に　もう　1つ」で 蓄音機の 影 → キリコの 新作（このゲーム 自身の 目くばせ）→ まとめ。
// - この 番組の 動詞：**影で 当てる**。正体が 出る 前に「新作！？」「リマスターかよ」「新キャラ！？」を 決める。
//   影の 手がかりは NEW の 印（新作）・「HD」の 札（リマスター）・人の 形（新キャラ）。3本は 1つずつで 順は 乱数、
//   1打席と 碁盤は どちらが 新作で どちらが HD かも 乱数（形で なく 印を 読む）。当てると 群衆が わき（cheer）、
//   外すと 正体が 出た とき「は？」（窓の boo）。正体は 窓が 閉じた とき TV に 出る（ui/jikkyoShinsakuTv.ts）。
// - 山場（Cue）：蓄音機の 影に 合図の 光が 3回、4拍目で 正体が 出る ところで「きたあああ」。鯖が 重く なる。
// - 正体は 村の 遊び（1打席・碁盤・釣り）だけ。延期の 1本は 架空の『埋め立て　パズル』。
// - 実在の 会社・機種・配信・ゲームの 名前は 出さない（deny で 試験が 守る）。トルネコや 不思議のダンジョンへの 目くばせも しない。
// - キリコが 書ける 文（候補・当番・山場の 1語）には「保守」「立てといた」「立てたる」「立てたで」を 入れない。
//   群衆・題・字幕の「保守」は 固有名詞（保守ゲームス）の 中だけ。
// - 水曜は 生配信（★4）、ほかの 日は アーカイブ（★3。群衆に「アーカイブ　乙」が まざる）。
//   会場の 文の 上書きは 水曜だけ（アーカイブの 日は 部屋の いつもの 文。同じ 大画面の 麻雀の 日と ぶつけない）。
// - 文の 幅：レス 12・候補 10・スレタイ・字幕・pin・絵の 字 22（全角）。試験は src/sim/jikkyoProgTests.ts。
// 絵は ui/jikkyoShinsakuTv.ts（場面の 鍵は SHINSAKU_SCENES、絵に 出す 文は SHINSAKU_ART）。

import type {
	JkFit,
	JkOpt,
	JkRand,
	JkScript,
	JkScriptPick,
	JkScriptSeg,
	JkSlot,
} from "../../core/jikkyo";
import { type JkPack, liveOr, onWeekdays } from "./pack";

const o = (text: string, fit: JkFit): JkOpt => ({ text, fit });
const B = (t: string) => o(t, "best");
const K = (t: string) => o(t, "ok");
const X = (t: string) => o(t, "miss");

/** 場面の 鍵。 */
export const SHINSAKU_SCENES = [
	"card",
	"op",
	"host",
	"teaser",
	"reveal",
	"phono",
	"matome",
] as const;
export type ShinsakuScene = (typeof SHINSAKU_SCENES)[number];

/** 影の 種類（手がかり：NEW の 印・HD の 札・人の 形）。 */
export type ShinsakuKind = "new" | "hd" | "chara";
/** 正体の 物（1打席の バット・碁盤・釣りの 新キャラ）。 */
export type ShinsakuObj = "bat" | "board" | "angler";
export type ShinsakuShow = {
	readonly kind: ShinsakuKind;
	readonly obj: ShinsakuObj;
};

/** 場面の 小さな 中身（TV が 読む）。 */
export type ShinsakuData = {
	/** card：まもなく・おわり／host：あいさつ・お詫び・もう　1つ／phono：影・合図・正体。 */
	readonly phase?:
		| "soon"
		| "end"
		| "greet"
		| "owabi"
		| "motto"
		| "pre"
		| "cue"
		| "boom";
	/** card の 大きな 文。 */
	readonly card?: string;
	/** teaser・reveal：その 1本。 */
	readonly show?: ShinsakuShow;
	/** matome：発表の 順。 */
	readonly list?: readonly ShinsakuShow[];
	/** 山場の ちょうどの 名目の ms（phono）。 */
	readonly exact?: number;
};

/** 絵に 出す 文（どれも 全角 22字まで）。 */
export const SHINSAKU_ART = {
	logo: "保守ゲームス",
	show: "新作発表会",
	soon: "まもなく　配信　開始",
	end: "配信は　おわりました",
	live: "LIVE",
	archive: "アーカイブ",
	newMark: "NEW",
	hdMark: "HD",
	hatena: "？？？",
	title: { bat: "『1打席』", board: "『碁盤』", angler: "『釣り』" },
	sub: {
		new: "新作　発売日　未定",
		hd: "HDリマスター",
		chara: "新キャラ　登場",
	},
	stamp: "発売日　未定",
	tag: { new: "NEW", hd: "HD", chara: "キャラ" },
	owabi: "お詫び",
	delayed: "『埋め立て　パズル』",
	delay: "発売日　延期",
	motto: "最後に　もう　1つ",
	kiriko: "蓄音キリコ",
	kirikoSub: "新作　制作中",
	matome: "本日の　まとめ",
} as const;

/** 3本の 正体の 1行（pin・まとめ）。 */
export const showLine = (s: ShinsakuShow): string =>
	`${SHINSAKU_ART.title[s.obj]}　${SHINSAKU_ART.sub[s.kind]}`;

/** 影の 窓（◎ は 影の 種類。× は ほかの 種類の ◎）。 */
const TEASER: Readonly<Record<ShinsakuKind, readonly (readonly JkOpt[])[]>> = {
	new: [
		[B("新作！？"), K("影や"), X("リマスターかよ")],
		[B("新作！？"), K("なんや？"), X("新キャラ！？")],
	],
	hd: [
		[B("リマスターかよ"), K("影や"), X("新作！？")],
		[B("リマスターかよ"), K("なんや？"), X("新キャラ！？")],
	],
	chara: [
		[B("新キャラ！？"), K("影や"), X("リマスターかよ")],
		[B("新キャラ！？"), K("なんや？"), X("新作！？")],
	],
};

/** 正体への ひとこと（◎ は 種類、○ は 物）。 */
const OBJ_OK: Readonly<Record<ShinsakuObj, readonly [string, string]>> = {
	bat: ["やきうや", "打ちたい"],
	board: ["碁盤か", "渋い"],
	angler: ["釣りか", "ええやん"],
};
const reaction = (s: ShinsakuShow): (readonly JkOpt[])[] => {
	const [k1, k2] = OBJ_OK[s.obj];
	switch (s.kind) {
		case "new":
			return [
				[B("未定かよ"), K(k1), X("画質　ええな")],
				[B("いつ　出るんや"), K(k2), X("かわいい")],
			];
		case "hd":
			return [
				[B("画質　ええな"), K(k1), X("未定かよ")],
				[B("ぬるぬる　動く"), K(k2), X("かわいい")],
			];
		case "chara":
			return [
				[B("かわいい"), K(k1), X("画質　ええな")],
				[B("誰や　これ"), K(k2), X("未定かよ")],
			];
	}
};

/** 正体が 出た ときの 群衆の 1行（物ごと。窓の 候補と 重ならない 文）。 */
const OBJ_REACT: Readonly<Record<ShinsakuObj, string>> = {
	bat: "バットや",
	board: "碁盤や",
	angler: "釣り人や",
};

/** 群衆の 文（手で 書いた 白い 一覧。レスは 全角 12字まで）。 */
export const SHINSAKU_POOLS = {
	wait: [
		"31",
		"サンイチ",
		"たておつ",
		"待機",
		"あと　5分",
		"はよ",
		"くるぞ…",
		"水曜は　これや",
		"今年は　何が　出る",
		"予想　しとこ",
		"楽しみ",
	],
	op: [
		"はじまた",
		"きたあ",
		"ロゴ　すき",
		"おお",
		"音　でかい",
		"この音　すき",
		"うおおお",
		"はじまった",
		"待ってた",
		"わくわく",
	],
	host: [
		"司会　きた",
		"はよ　新作",
		"挨拶　ながい",
		"いつもの　挨拶",
		"数字の　話　いらん",
		"ええ　声",
		"続編　まだ？",
		"去年の　あれ　まだ？",
		"はよ",
		"前置き　ええから",
		"巻きで　頼む",
	],
	teaser: [
		"影や",
		"なんの　影や",
		"見えへん",
		"明るく　して",
		"じらすな",
		"くるぞ…",
		"新作やろ",
		"HDやろ",
		"新キャラ　やろ",
		"どっちや",
		"拡大した",
		"シルエット",
	],
	"rv:new": [
		"新作や！",
		"新作　きた",
		"未定は　草",
		"出す　気　あるんか",
		"来年かな",
		"予約　したい",
		"知らん　ゲーム",
		"待つで",
		"ほしい",
		"続報　まだ？",
	],
	"rv:hd": [
		"HDや",
		"またHDか",
		"解像度　すごい",
		"ぬるぬるや",
		"なつかしい",
		"昔　やった",
		"くっきりや",
		"また　買うんか",
		"移植　まだ？",
		"ええやん",
	],
	"rv:chara": [
		"新キャラや",
		"竿　持っとる",
		"ウキに　顔　ある",
		"使いたい",
		"強そう",
		"名前　なんや",
		"釣りや",
		"声　ついとる？",
		"続報　まだ？",
		"好き",
	],
	// 影を 当てた（○ も）あとの 群衆
	"ch:new": ["うおおお", "新作や！", "せやろな", "NEWの　印や", "読めとる"],
	"ch:hd": ["知ってた", "せやろな", "HDの　札や", "読めとる", "またか"],
	"ch:chara": ["うおおお", "人影やった", "せやろな", "読めとる", "新キャラや"],
	// 外した ときは 正体が 出た とき「は？」
	"bo:new": ["は？", "なんて？", "新作やん", "NEW　出とるやん", "印　見とけ"],
	"bo:hd": ["は？", "なんて？", "HDの　札　見とけ", "ただの　HDや", "札　見て"],
	"bo:chara": [
		"は？",
		"なんて？",
		"人の　形　やったやん",
		"新キャラ　やん",
		"どう　見ても　人",
	],
	owabi: [
		"知ってた",
		"またか",
		"待つで",
		"ええんやで",
		"ゆっくり　作って",
		"頭　さげとる",
		"延期は　定番",
		"去年も　聞いた",
		"まだ　かかるんか",
		"パズル　まだ？",
	],
	motto: [
		"まさか",
		"ざわ…",
		"ほんまか",
		"息　止めた",
		"来い　来い",
		"何や　何や",
		"嘘やろ",
		"まだ　あるんか",
		"もう1つ！？",
	],
	phono: [
		"蓄音機？",
		"あの　影…",
		"まさか",
		"くるぞ…",
		"嘘やろ",
		"ほんまに？",
		"見覚え　ある",
		"手が　ふるえる",
		"ざわ…",
	],
	flood: [
		"きたあああ",
		"きたあああ",
		"うおおおお",
		"ファッ！？",
		"マジか",
		"キリコ！？",
		"きたあああ",
	],
	after: [
		"鯖が　重い",
		"生きてる？",
		"落ち着け",
		"キリコ　きたあ",
		"蓄音機や",
		"ほんまに　出るんか",
		"本人　見とる？",
		"泣ける",
		"8888",
		"これは　買う",
	],
	matome: [
		"まとめ　助かる",
		"1打席　楽しみ",
		"碁盤　ええな",
		"釣り　やりたい",
		"キリコが　1位",
		"満足",
		"延期は　許す",
		"来年も　見る",
		"財布　空や",
		"豊作やな",
	],
	hansei: [
		"反省会や",
		"ほな",
		"解散",
		"おやすみ",
		"ええ　発表会　やった",
		"キリコ　楽しみ",
		"未定　多すぎ",
		"また　水曜",
		"満足や",
	],
	rerun: [
		"アーカイブ　乙",
		"2回目や",
		"知っとる　けど",
		"何回　見ても　ええ",
		"まだ　未定や",
		"もう　1回",
	],
	gap: ["次スレ　どこ？", "乱立すな", "950ちうい", "誰か踏め"],
	open: ["31", "サンイチ", "たておつ", "スレ立て　乙"],
	boo: ["は？", "なんて？"],
	booStart: ["はじまって　ないで", "まだ　早い"],
	booEarly: ["まだ　早い", "は？"],
	booLate: ["もう　出たで", "は？"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ　見とるんや"],
	/** 1000 の 流れの 予備（群衆の 区切りが ない とき）。 */
	nanashi: ["くるぞ…", "はよ"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句。 */
export const SHINSAKU_THREAD = {
	live: "【実況】保守ゲームス　新作発表会★{n}",
	rerun: "【アーカイブ】保守ゲームス　新作発表会★{n}",
	hansei: "【反省会】保守ゲームス　新作発表会★{n}",
	get1000: "1000なら　発売日　決まる",
	praise: ">>{n}　神エイム",
	crossGap: "次スレで　きたあああ",
	crossFresh: "新スレで　間に合った",
	owabiPin: "【お詫び】『埋め立て　パズル』　延期",
	kirikoPin: "【速報】蓄音キリコ　新作　制作中",
	quit: "もう一度　Bで　出る",
} as const;

const fillN = (s: string, n: number) => s.replace("{n}", String(n));

/** 山場の 1語（蓄音機の 影が ほどけて キリコの 新作が 出る ところ）。 */
export const SHINSAKU_WORD = "きたあああ";

/** 山場の 合図（1つめ）・拍・ちょうど（名目の ms）。 */
export const SHINSAKU_CUE = { at: 101500, beat: 800, pulses: 3 } as const;
export const SHINSAKU_EXACT =
	SHINSAKU_CUE.at + SHINSAKU_CUE.pulses * SHINSAKU_CUE.beat;

/** 影の 1本の 頭（影 → 窓 1.5秒後 → 正体 6.3秒後 → 正体への 窓 8秒後）。 */
const ROUNDS = [29000, 48000, 67500] as const;
const TEASE_PICK = 1500;
const REVEAL_AT = 6300;
const REACT_PICK = 8000;

const shuffle = <T>(xs: readonly T[], rand: JkRand): T[] => {
	const a = [...xs];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
};

/** その 回の 3本（新作・HD・新キャラを 1つずつ。1打席と 碁盤の どちらが 新作かも 乱数）。 */
export const shinsakuShows = (rand: JkRand): ShinsakuShow[] => {
	const kinds = shuffle(["new", "hd", "chara"] as const, rand);
	const batNew = rand() < 0.5;
	return kinds.map((kind) => ({
		kind,
		obj:
			kind === "chara"
				? "angler"
				: (kind === "new") === batNew
					? "bat"
					: "board",
	}));
};

/** 台本（140秒。pick 14 ＋ Cue）。 */
const shinsakuTimeline: JkScript["timeline"] = (rand) => {
	const shows = shinsakuShows(rand);
	const hansei = (n: number) => fillN(SHINSAKU_THREAD.hansei, n);
	const rounds = shows.map((show, i) => {
		const t = ROUNDS[i];
		const segs: JkScriptSeg[] = [
			{
				at: t,
				scene: "teaser",
				pool: "teaser",
				rate: 1,
				bgm: "tense",
				caption: "この　影は……",
				data: { show } satisfies ShinsakuData,
			},
			{
				at: t + REVEAL_AT,
				scene: "reveal",
				pool: `rv:${show.kind}`,
				rate: 1,
				bgm: "retro2",
				posts: [
					{
						at: 400,
						who: "nanashi",
						text: `【速報】${showLine(show)}`,
						pin: 2200,
					},
				],
				react: [{ who: "nanashi", text: OBJ_REACT[show.obj] }],
				data: { show } satisfies ShinsakuData,
			},
		];
		const picks: JkScriptPick[] = [
			// 影を 読む（正体が 出る 前に 答える。外すと 正体が 出た とき「は？」）
			{
				at: t + TEASE_PICK,
				cheer: `ch:${show.kind}`,
				boo: `bo:${show.kind}`,
				sets: TEASER[show.kind],
			},
			{ at: t + REACT_PICK, boo: "boo", sets: reaction(show) },
		];
		return { segs, picks };
	});
	const segments: JkScriptSeg[] = [
		{
			at: 0,
			scene: "card",
			pool: "wait",
			rate: 0.5,
			bgm: null,
			data: { phase: "soon", card: SHINSAKU_ART.soon } satisfies ShinsakuData,
		},
		{ at: 7000, scene: "op", pool: "op", rate: 1, bgm: "retro" },
		{
			at: 17000,
			scene: "host",
			pool: "host",
			rate: 1,
			bgm: "town",
			caption: "広報の　あいさつ",
			data: { phase: "greet" } satisfies ShinsakuData,
		},
		...rounds.flatMap((r) => r.segs),
		{
			at: 80500,
			scene: "host",
			pool: "owabi",
			rate: 1,
			bgm: "sad",
			caption: "広報から　お知らせ",
			pin: SHINSAKU_THREAD.owabiPin,
			data: { phase: "owabi" } satisfies ShinsakuData,
		},
		{
			at: 92500,
			scene: "host",
			pool: "motto",
			rate: 1.4,
			bgm: "tense",
			caption: SHINSAKU_ART.motto,
			data: { phase: "motto" } satisfies ShinsakuData,
		},
		{
			at: 97000,
			scene: "phono",
			pool: "phono",
			rate: 1.5,
			bgm: null,
			caption: "最後の　影",
			data: { phase: "pre", exact: SHINSAKU_EXACT } satisfies ShinsakuData,
		},
		{
			at: 101000,
			scene: "phono",
			pool: "phono",
			rate: 3.5,
			bgm: null,
			data: { phase: "cue", exact: SHINSAKU_EXACT } satisfies ShinsakuData,
		},
		{
			at: SHINSAKU_EXACT,
			scene: "phono",
			pool: "after",
			rate: 1.6,
			bgm: "title",
			stall: 1500,
			posts: [
				{
					at: 1600,
					who: "nanashi",
					text: SHINSAKU_THREAD.kirikoPin,
					pin: 2600,
				},
			],
			data: { phase: "boom", exact: SHINSAKU_EXACT } satisfies ShinsakuData,
		},
		{
			at: 107500,
			scene: "phono",
			pool: "after",
			rate: 1.4,
			caption: "最後の　1本は　キリコの　新作",
			data: { phase: "boom", exact: SHINSAKU_EXACT } satisfies ShinsakuData,
		},
		{
			at: 117500,
			scene: "matome",
			pool: "matome",
			rate: 1,
			bgm: "retro2",
			caption: SHINSAKU_ART.matome,
			data: { list: shows } satisfies ShinsakuData,
		},
		{
			at: 128500,
			scene: "card",
			pool: "hansei",
			rate: 0.7,
			bgm: "town",
			title: { now: hansei },
			data: { phase: "end", card: SHINSAKU_ART.end } satisfies ShinsakuData,
		},
	];
	return {
		segments,
		picks: [
			{
				at: 2000,
				boo: "booStart",
				sets: [
					[B("待機"), K("はよ"), X("乙")],
					[B("31"), K("くるぞ…"), X("おつかれ")],
					[B("あと　1分"), K("はよ"), X("神発表会")],
				],
			},
			{
				at: 11000,
				boo: "booStart",
				sets: [
					[B("はじまた"), K("おお"), X("31")],
					[B("きたあ"), K("音　でかい"), X("乙")],
					[B("ロゴ　すき"), K("おお"), X("待機")],
				],
			},
			{
				at: 21500,
				boo: "boo",
				sets: [
					[B("はよ　新作"), K("司会　きた"), X("新作！？")],
					[B("前置き　ええから"), K("挨拶　ながい"), X("きたあ")],
					[B("巻きで　頼む"), K("ええ　声"), X("未定かよ")],
				],
			},
			...rounds.flatMap((r) => r.picks),
			{
				at: 82500,
				boo: "boo",
				sets: [
					[B("延期かよ"), K("待つで"), X("きたあ")],
					[B("知ってた"), K("ええんやで"), X("かわいい")],
					[B("またか"), K("延期かよ"), X("神発表会")],
				],
			},
			{
				at: 94000,
				boo: "booEarly",
				sets: [
					[B("まだ　あるんか"), K("くるぞ…"), X("おつかれ")],
					[B("もう1つ！？"), K("ざわ…"), X("乙")],
				],
			},
			{
				at: 106500,
				boo: "booLate",
				sets: [
					[B("待ってた"), K("ほんまか"), X("延期かよ")],
					[B("ありがとう"), K("泣ける"), X("画質　ええな")],
					[B("神発表会"), K("ええやん"), X("リマスターかよ")],
				],
			},
			{
				at: 121000,
				boo: "boo",
				sets: [
					[B("今年は　豊作"), K("まあまあ"), X("新作！？")],
					[B("ええ　発表会"), K("満足や"), X("待機")],
					[B("全部　ほしい"), K("忙しく　なる"), X("31")],
				],
			},
			{
				at: 131500,
				boo: "boo",
				sets: [
					[B("乙"), K("反省会や"), X("はじまた")],
					[B("おつかれ"), K("ほな"), X("待機")],
					[B("次回も　見る"), K("解散"), X("31")],
				],
			},
		],
		cues: [
			{
				...SHINSAKU_CUE,
				word: SHINSAKU_WORD,
				flood: "flood",
				praise: SHINSAKU_THREAD.praise,
				cross: {
					gap: SHINSAKU_THREAD.crossGap,
					fresh: SHINSAKU_THREAD.crossFresh,
				},
			},
		],
	};
};

/** 保守ゲームス　新作発表会。 */
export const SHINSAKU: JkScript = {
	id: "shinsaku",
	venue: "arcade",
	length: 140000,
	goal: { live: 4, rerun: 3 },
	pools: SHINSAKU_POOLS,
	title: (n, slot) =>
		fillN(slot.live ? SHINSAKU_THREAD.live : SHINSAKU_THREAD.rerun, n),
	at1000: () => SHINSAKU_THREAD.get1000,
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
	quitNote: SHINSAKU_THREAD.quit,
	// 帯（sora と 同じ はば。pick 14 ＋ Cue で P 16）：生配信 上手 76%・初心者 31%、アーカイブ 76%・31%
	// （見るだけ 0.57G・神 1.41〜1.48G・random 0%）。アーカイブを ★2 に すると 上手が 84% まで 開くので ★3。
	// 影と 正体の 区切りは rate 1、山場の あとを 1.4〜1.6（窓の ある 区切りに 予算が 寄ると 上手が 開きすぎる）。
	// 見るだけでも 950 の 当番が 出る ように 窓の 間を 空けた（アーカイブの 950 は 86秒 前後、生配信は 115秒 前後）。
	tune: { post: 0.1, boost: 3, comboMin: 20 },
	bands: {
		p50: { miru: [0.52, 0.6], kami: [1.08, 99] },
		kanso: { jouzu: [0.65, 0.8], shoshin: [0.25, 0.45], random: [0, 0.099] },
	},
	timeline: shinsakuTimeline,
};

/**
 * 生配信の 日（水曜）。会場の 文の 上書きも 水曜だけ（アーカイブの 日は いつもの「配信の　画面」の 文。
 * 同じ 大画面の 麻雀の 日の 文と ぶつからない）。
 */
const isLive = onWeekdays(3);

/** 絵に 出す 文の 一覧（試験）。 */
const artList = (): string[] =>
	Object.values(SHINSAKU_ART).flatMap((v) =>
		typeof v === "string" ? [v] : Object.values(v),
	);

/** 保守ゲームス　新作発表会。 */
export const SHINSAKU_PACK: JkPack = {
	script: SHINSAKU,
	venue: "arcade",
	from: 6,
	menu: "新作発表会",
	slot: liveOr(isLive),
	scenes: SHINSAKU_SCENES,
	venueLines: {
		tv: [
			{
				when: isLive,
				lines: ["壁の　大画面。\n保守ゲームスの　新作発表会、生配信中。"],
			},
		],
	},
	staffLines: {
		arcade_a: [
			{
				when: isLive,
				lines: ["今日は　水曜、新作発表会の　日や。\n……乱入より　大画面や"],
			},
		],
		arcade_b: [
			{
				when: isLive,
				lines: ["メダル、ぜんぶ　すった。\n……せやから　発表会を　見とる"],
			},
		],
	},
	staffOnce: {
		arcade_a: {
			kami: "この前の　発表会、\n蓄音機の　とこ　ぴったり　やったな",
			rerun:
				"アーカイブでも　★{n}まで　のびたな。\n水曜の　生配信は、もっと　のびるで",
		},
	},
	msgs: {
		howto:
			"見せ場に　合う　レスで　スレが　のびる。\n影の　正体は、出る　前に。目標：★{n}",
		seat: "キリコは　大画面の　前に　立った。\n……スマホで、実況スレを　ひらく。",
		over: "配信が　おわった。\n実況は　★{n}まで　のびた。",
		kami: "蓄音機の　影が　ほどけた　瞬間、\nぴったり　書きこめた。",
		left: "……配信の　とちゅうで、\nそっと　大画面の　前を　はなれた。",
	},
	art: artList(),
	names: ["保守ゲームス"],
	deny: [
		"Switch",
		"スイッチ2",
		"PlayStation",
		"プレステ",
		"ソニー",
		"SONY",
		"Xbox",
		"スクエニ",
		"カプコン",
		"セガ",
		"バンナム",
		"コナミ",
		"ポケモン",
		"マリオ",
		"ゼルダ",
		"ドラクエ",
		"トルネコ",
		"不思議のダンジョン",
		"State of Play",
		"ゲームショウ",
		"スマブラ",
		"参戦",
		"社長が訊く",
	],
};
