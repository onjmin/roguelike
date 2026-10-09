// 金曜ロード保守『空飛ぶ鯖』（映画館「スクリーン1000」の 実況上映。PROGRAMS §5.2・ENGINE §5.3）。
// 雲の 上を 泳ぐ 大きな 鯖（さばの 形の サーバー）の 中には 板で いちばん 古い「初代スレ」が 眠っている。
// 名無しの 少年と ◆トリップの スレ主が 港から 小舟で 空へ 出て、連投規制の 嵐を ぬけ、安価で コピペの 群れを 別スレへ 誘導し、
// 鯖に つく。荒らしの 大将が 初代スレに コピペの 山を 積みはじめ、スレ主は スレ主だけが 打てる「!バルス」を 打つ。
// スレは 崩壊して だれも 書けなくなり、荒らしは アク禁で 消える。初代スレは 書きかえられずに のこり、鯖は 雲の 上へ 泳いで いく。
// - 番組名・題は 架空の パロディ（実在の 番組・局・映画とは 関係が ない）。借りた 語は おーぷんの コマンドとしての「バルス」だけ。
//   台詞・曲・人物の 名前は 使わない。群衆の 文は 手で 書いた 一覧だけ。
// - キリコが 書ける 文（候補・当番・山場の 1語）には「保守」「立てといた」「立てたる」「立てたで」を 入れない。
//   群衆・題・字幕の「保守」は 固有名詞（金曜ロード保守・金保守・保守村）の 中だけ。
// - 金曜は 本放送（★4）、ほかの 日は 再上映（★2。群衆に「何回　やるねん」が まざる）。中身は 曜日で 閉じない。
// - 文の 幅：レス 12・候補 10・スレタイ・字幕・pin 22（全角）。試験は src/sim/jikkyoTests.ts の S 節。
// 絵は ui/jikkyoScenes.ts（場面の 鍵は SORA_SCENES、絵に 出す 文は SORA_ART）。

import type {
	JkFit,
	JkOpt,
	JkScript,
	JkScriptSeg,
	JkSlot,
} from "../../core/jikkyo";

const o = (text: string, fit: JkFit): JkOpt => ({ text, fit });
const B = (t: string) => o(t, "best");
const K = (t: string) => o(t, "ok");
const X = (t: string) => o(t, "miss");

/** 場面の 鍵（物語 6つ ＋ CM・カード・山場）。 */
export const SORA_SCENES = [
	"card",
	"op",
	"minato",
	"kisei",
	"copipe",
	"saba",
	"cm",
	"barusu",
	"ed",
] as const;
export type SoraScene = (typeof SORA_SCENES)[number];

/** 場面の 小さな 中身（TV が 読む）。 */
export type SoraData = {
	/** card：まもなく・予告・おわり／saba：大将が 来る／barusu：山場の 前・合図・崩壊・アク禁。 */
	readonly phase?:
		| "soon"
		| "preview"
		| "end"
		| "ume"
		| "pre"
		| "cue"
		| "boom"
		| "akukin";
	/** cm：SORA_ART.cm の 番。 */
	readonly cm?: number;
	/** card の 大きな 文。 */
	readonly card?: string;
	/** 山場の ちょうどの 名目の ms（barusu の 光）。 */
	readonly exact?: number;
};

/** 絵に 出す 文（どれも 全角 22字まで）。 */
export const SORA_ART = {
	logo: "金曜ロード保守",
	title: "『空飛ぶ鯖』",
	soon: "まもなく　はじまります",
	end: "本日の　上映は　おわりました",
	hut: "age",
	kisei: "連投規制中",
	anchor: "安価：別スレへ",
	sign: "別スレ→",
	oldest: "初代スレ",
	trip: "◆SabaSora10",
	command: "!バルス",
	flash: "禁断呪文　バルス　発動！",
	akukin: "アク禁",
	cmTag: "CM",
	/** CM（店の 看板と 1行。村の 店だけ）。 */
	cm: [
		{ shop: "海の家「age」", line: "焼きそば、大盛りしか　ないで" },
		{ shop: "おんJマート", line: "24時間　営業中" },
		{ shop: "ageジム", line: "1日　1000回" },
		{ shop: "保守村駅", line: "どの　板へも" },
	],
	/** スタッフロール（役は ぜんぶ 名無しさん）。 */
	staff: [
		"原作　名無しさん",
		"脚本　名無しさん",
		"作画　名無しさん",
		"音楽　名無しさん",
		"実況　名無しさん",
		"監督　名無しさん",
	],
} as const;

/** 予告（dyn：予告の 中身で ◎ が かわる）。来週も 同じ 映画か、近日の 新しい 映画か。 */
export const SORA_PREVIEW = [
	{
		card: "来週も『空飛ぶ鯖』",
		set: [B("また　それかよ"), K("たのしみ"), X("31")],
	},
	{
		card: "近日『1000レスの　夏』",
		set: [B("たのしみ"), K("来週は？"), X("また　それかよ")],
	},
] as const;

/** 群衆の 文（手で 書いた 白い 一覧。レスは 全角 12字まで）。 */
export const SORA_POOLS = {
	wait: [
		"31",
		"サンイチ",
		"たておつ",
		"待機",
		"あと　5分",
		"はよ",
		"くるぞ…",
		"金曜は　これや",
	],
	op: ["はじまた", "きたあ", "懐かしい", "何回目や", "この曲　すき", "おお"],
	minato: [
		"うまそう",
		"腹へった",
		"保守村やん",
		"飯テロ",
		"平和やな",
		"焼きそば　食いたい",
	],
	kisei: ["ひえっ", "あぶな", "こわい", "規制　つらい", "ゆれとる"],
	copipe: ["ひえっ", "はやい", "有能", "誘導　うまい", "にげろ", "安価　すき"],
	saba: ["きれい", "名シーン", "鳥肌", "ここすき", "作画　ええな", "でかい"],
	ume: [
		"埋めろ",
		"ksk",
		"くるぞ…",
		"お前ら　レス止めろ！",
		"指　つった",
		"準備できた",
	],
	cm: [
		"ここで　CM",
		"CM　なげえ",
		"トイレ　行ってくる",
		"カップ麺　作るわ",
		"今北産業",
		"CMの間に　300　進んどる",
		"ここで　CMは　ずるい",
	],
	flood: ["バルス", "バルス！", "バルス", "はやすぎ", "おそかった"],
	after: ["鯖が　重い", "生きてる？", "やりきった", "ありがとう", "有能"],
	ed: ["神曲", "8888", "いい　映画やった", "終わっちゃった", "泣ける"],
	preview: ["来週は？", "また　それかよ", "何回　やるねん", "たのしみ"],
	hansei: ["反省会や", "乙", "ほな", "おやすみ", "解散", "来週も　見るで"],
	rerun: ["何回　やるねん", "もう　覚えとる", "何回　見ても　ええ"],
	gap: ["次スレ　どこ？", "乱立すな", "950ちうい", "誰か踏め"],
	open: ["31", "サンイチ", "たておつ", "スレ立て　乙"],
	boo: ["は？", "なんて？"],
	booStart: ["はじまった　ばっかや", "まだ　早い"],
	booEarly: ["まだ　早い", "は？"],
	booLate: ["まだ　バルス　しとる", "は？"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ　見とるんや"],
	/** 1000 の 流れの 予備（群衆の 区切りが ない とき）。 */
	nanashi: ["くるぞ…", "はよ"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句。 */
export const SORA_THREAD = {
	live: "【金保守実況】空飛ぶ鯖★{n}",
	rerun: "【再上映】空飛ぶ鯖　実況★{n}",
	liveBarusu: "【金保守実況】空飛ぶ鯖★{n}【バルス用】",
	rerunBarusu: "【再上映】空飛ぶ鯖★{n}【バルス用】",
	liveHansei: "【金保守実況・反省会】空飛ぶ鯖★{n}",
	rerunHansei: "【再上映・反省会】空飛ぶ鯖★{n}",
	get1000: "1000なら　来週も　鯖",
	praise: ">>{n}　神エイム",
	crossGap: "次スレで　バルス",
	crossFresh: "新スレで　バルス　できた",
	failed: "禁断呪文　バルス　発動失敗。。",
	cannot: "実況スレは　バルス　できぬいの刑",
	quit: "もう一度　Bで　出る",
} as const;

const fillN = (s: string, n: number) => s.replace("{n}", String(n));

/** 映画の 山場の 1語（スレ主の !バルス に あわせて 書く）。 */
export const SORA_WORD = "バルス";

/** 山場の 合図（1つめ）・拍・ちょうど（名目の ms）。 */
export const SORA_CUE = { at: 93000, beat: 800, pulses: 3 } as const;
export const SORA_EXACT = SORA_CUE.at + SORA_CUE.pulses * SORA_CUE.beat;

/** 台本（146秒。pick 13 ＋ Cue）。 */
const soraTimeline: JkScript["timeline"] = (rand, slot) => {
	const live = slot.live;
	const title = (k: "Barusu" | "Hansei") => (n: number) =>
		fillN(SORA_THREAD[`${live ? "live" : "rerun"}${k}` as const], n);
	const cm = Math.floor(rand() * SORA_ART.cm.length);
	const preview = SORA_PREVIEW[Math.floor(rand() * SORA_PREVIEW.length)];
	const segments: JkScriptSeg[] = [
		{
			at: 0,
			scene: "card",
			pool: "wait",
			rate: 0.5,
			bgm: null,
			caption: SORA_ART.soon,
			data: { phase: "soon", card: SORA_ART.soon } satisfies SoraData,
		},
		{ at: 6000, scene: "op", pool: "op", rate: 1, bgm: "title" },
		{ at: 16000, scene: "minato", pool: "minato", rate: 1.1, bgm: "town" },
		{
			at: 30000,
			scene: "kisei",
			pool: "kisei",
			rate: 1.2,
			bgm: "deep_kisei",
			caption: "連投規制の　嵐を　ぬける",
		},
		{
			at: 42000,
			scene: "copipe",
			pool: "copipe",
			rate: 1.3,
			bgm: "tense",
			caption: "安価で　群れを　別スレへ",
		},
		{
			at: 56000,
			scene: "saba",
			pool: "saba",
			rate: 1.1,
			bgm: "island",
			caption: "雲の　上を　泳ぐ　鯖",
		},
		{
			at: 70000,
			scene: "saba",
			pool: "ume",
			rate: 1.6,
			bgm: "tense",
			caption: "大将が　初代スレを　ねらう",
			title: { next: title("Barusu") },
			data: { phase: "ume" } satisfies SoraData,
		},
		{
			at: 78000,
			scene: "cm",
			pool: "cm",
			rate: 0.8,
			bgm: "retro",
			caption: "CMの　あとで",
			react: [{ who: "nanashi", text: "ここで　CMは　ずるい" }],
			data: { cm } satisfies SoraData,
		},
		{
			at: 86000,
			scene: "barusu",
			pool: "ume",
			rate: 1.4,
			bgm: "tense",
			caption: "初代スレに　コピペの　山",
			data: { phase: "pre" } satisfies SoraData,
		},
		{
			at: 92000,
			scene: "barusu",
			pool: "ume",
			rate: 3.5,
			bgm: null,
			data: { phase: "cue", exact: SORA_EXACT } satisfies SoraData,
		},
		{
			at: 97000,
			scene: "barusu",
			pool: "after",
			rate: 1.2,
			stall: 1500,
			posts: [
				{ at: 1700, who: "nanashi", text: SORA_ART.command },
				{ at: 2300, who: "sys", text: SORA_THREAD.failed, pin: 2200 },
				{ at: 4600, who: "sys", text: SORA_THREAD.cannot, pin: 2500 },
			],
			data: { phase: "boom", exact: SORA_EXACT } satisfies SoraData,
		},
		{
			at: 102000,
			scene: "barusu",
			pool: "after",
			rate: 1.3,
			bgm: "title",
			caption: "荒らしは　アク禁に　なった",
			title: { next: null },
			data: { phase: "akukin" } satisfies SoraData,
		},
		{
			at: 114000,
			scene: "ed",
			pool: "ed",
			rate: 1.1,
			bgm: "ending",
			caption: "鯖は　雲の　上へ　泳いで　いった",
		},
		{
			at: 128000,
			scene: "card",
			pool: "preview",
			rate: 0.9,
			caption: preview.card,
			data: { phase: "preview", card: preview.card } satisfies SoraData,
		},
		{
			at: 136000,
			scene: "card",
			pool: "hansei",
			rate: 0.7,
			caption: SORA_ART.end,
			title: { now: title("Hansei") },
			data: { phase: "end", card: SORA_ART.end } satisfies SoraData,
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
					[B("待機"), K("くるぞ…"), X("乙")],
					[B("あと　1分"), K("はよ"), X("いい　映画やった")],
				],
			},
			{
				at: 11000,
				boo: "booStart",
				sets: [
					[B("はじまた"), K("おお"), X("31")],
					[B("きたあ"), K("懐かしい"), X("乙")],
					[B("この曲　すき"), K("何回目や"), X("8888")],
				],
			},
			{
				at: 22000,
				boo: "boo",
				sets: [
					[B("港町やん"), K("平和やな"), X("こわい")],
					[B("うまそう"), K("腹へった"), X("ひえっ")],
					[B("平和やな"), K("飯テロ"), X("あぶな")],
				],
			},
			{
				at: 34000,
				boo: "boo",
				sets: [
					[B("あぶな"), K("ゆれとる"), X("平和やな")],
					[B("ひえっ"), K("規制　つらい"), X("うまそう")],
					[B("こわい"), K("ここすき"), X("飯テロ")],
				],
			},
			{
				at: 49000,
				boo: "boo",
				sets: [
					[B("有能"), K("はやい"), X("おやすみ")],
					[B("誘導　うまい"), K("安価　すき"), X("ここで　CM")],
					[B("有能"), K("にげろ"), X("CM　なげえ")],
				],
			},
			{
				at: 61000,
				boo: "boo",
				sets: [
					[B("きれい"), K("でかい"), X("乙")],
					[B("名シーン"), K("作画　ええな"), X("解散")],
					[B("鳥肌"), K("ここすき"), X("はじまた")],
				],
			},
			{
				at: 71000,
				boo: "boo",
				sets: [
					[B("埋めろ"), K("待機"), X("31")],
					[B("ksk"), K("指　つった"), X("乙")],
					[B("くるぞ…"), K("準備できた"), X("解散")],
				],
			},
			{
				at: 79000,
				boo: "booEarly",
				sets: [
					[B("ここで　CM"), K("トイレ　行く"), X(SORA_WORD)],
					[B("CM　なげえ"), K("カップ麺　作るわ"), X(SORA_WORD)],
					[B("トイレ　行く"), K("CM　なげえ"), X("有能")],
				],
			},
			{
				at: 86500,
				boo: "booEarly",
				sets: [
					[B("待機"), K("くるぞ…"), X("今北産業")],
					[B("準備できた"), K("指　つった"), X(SORA_WORD)],
					[B("お前ら　レス止めろ！"), K("埋めろ"), X("ありがとう")],
				],
			},
			{
				at: 106000,
				boo: "booLate",
				sets: [
					[B("やりきった"), K("生きてる？"), X(SORA_WORD)],
					[B("ありがとう"), K("鯖が　重い"), X("待機")],
					[B("有能"), K("スカッと　した"), X("くるぞ…")],
				],
			},
			{
				at: 118000,
				boo: "boo",
				sets: [
					[B("神曲"), K("泣ける"), X("はじまた")],
					[B("8888"), K("終わっちゃった"), X("31")],
					[B("いい　映画やった"), K("ありがとう"), X("埋めろ")],
				],
			},
			// 予告の 中身で ◎ が かわる（来週も 同じ なら「また　それかよ」、新しい 映画なら「たのしみ」）
			{ at: 131000, boo: "boo", sets: [preview.set] },
			{
				at: 137000,
				boo: "boo",
				sets: [
					[B("乙"), K("反省会や"), X("はじまた")],
					[B("ほな"), K("解散"), X("待機")],
					[B("おやすみ"), K("来週も　見るで"), X("31")],
				],
			},
		],
		cues: [
			{
				...SORA_CUE,
				word: SORA_WORD,
				flood: "flood",
				praise: SORA_THREAD.praise,
				cross: { gap: SORA_THREAD.crossGap, fresh: SORA_THREAD.crossFresh },
			},
		],
	};
};

/** 金曜ロード保守『空飛ぶ鯖』。 */
export const SORA: JkScript = {
	id: "sora",
	venue: "cinema",
	length: 146000,
	goal: { live: 4, rerun: 2 },
	pools: SORA_POOLS,
	title: (n, slot) =>
		fillN(slot.live ? SORA_THREAD.live : SORA_THREAD.rerun, n),
	at1000: () => SORA_THREAD.get1000,
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
	quitNote: SORA_THREAD.quit,
	// 帯（当番と 切れ目を 入れて 400 の 種で 回した）：書きこみの 波を 小さく、コンボを 1つ 0.15 ずつ 効かせる
	// （comboMin 20 は 窓の 数より 多いので 頭打ちに ならない）。
	// 本放送 上手 77%・初心者 35%、再上映 69%・31%（見るだけ 0.57G・神 1.38G・random 2% まで）。
	// 2択の 窓だと 上手と 初心者の 差が 開きすぎて 帯に 入らないので、どの 組も ◎○× の 3択に した
	tune: { post: 0.1, boost: 3, comboMin: 20 },
	bands: {
		p50: { miru: [0.52, 0.6], kami: [1.08, 99] },
		kanso: { jouzu: [0.65, 0.8], shoshin: [0.25, 0.45], random: [0, 0.099] },
	},
	timeline: soraTimeline,
};
