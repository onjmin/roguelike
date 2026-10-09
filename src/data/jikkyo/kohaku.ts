// 第15回　紅白スレ合戦 → 年越し（保守劇場の 舞台。PROGRAMS §5.3・ENGINE §5.3）。
// 大みそかの 夜、保守劇場の 舞台で 紅組と 白組が 1曲ずつ 出しあい、名物の ageリレー・大トリ・審査の あと、
// 雪の 寺の 除夜の 鐘へ 切りかわる。年越しレスを かいて 0時ちょうどに「あけおめ」。ことよろの 波と 初日の出で 幕。
// - この 番組の 動詞：歌に 合う ひとこと・得点板を 読んで 早く 言いきる（勝ち組の 札が 先に かたむく）・
//   除夜の 鐘では 黙る（答えない ことが ◎＝timeoutFit）・0時ちょうどに 1語（Cue。beat 1000）。CM は ない。
// - キリコの 名前欄：0時までは 番組の 時計「新年まで＠HH:MM:SS」（公開リハは「仮の0時まで＠」）。
//   山場の あとは おみくじ（神エイム＝あけおめ＠大吉 … フライング＝まだ　去年や）。
// - 12/31 は 本番（★5、回 = 年 − 2011。次スレごとに 回を 1つ 足す ボケ）、12/1〜30 は 公開リハ（★3）、
//   1/1〜7 は 去年の 回の 録画（★2）。日程は data/jikkyo/schedule.ts。
// - 番組名は 架空の パロディで、実在の 番組・局・歌い手とは 関係が ない。曲・歌詞・人の 名前は 使わない。
//   名物は 名無しが 札を 列で わたす「ageリレー」（失敗を 願う 窓は 置かない。v1 は いつも 成功）。
// - キリコが 書ける 文（候補・当番・山場の 1語）に「保守」「立てといた」「立てたる」「立てたで」を 入れない。
//   群衆・題・字幕の「保守」は 固有名詞の 中だけ。
// - 文の 幅：レス 12・候補 10・スレタイ・字幕・pin・名前欄 22（全角）。試験は src/sim/jikkyoTests.ts の K 節。
// 絵は ui/jikkyoKohakuTv.ts（場面の 鍵は KOHAKU_SCENES、絵に 出す 文は KOHAKU_ART）。

import type {
	JkCueGrade,
	JkFit,
	JkOpt,
	JkRand,
	JkScript,
	JkScriptSeg,
	JkSlot,
} from "../../core/jikkyo";

const o = (text: string, fit: JkFit, boo?: string): JkOpt =>
	boo ? { text, fit, boo } : { text, fit };
const B = (t: string) => o(t, "best");
const K = (t: string) => o(t, "ok");
const X = (t: string, boo?: string) => o(t, "miss", boo);

/** 場面の 鍵。 */
export const KOHAKU_SCENES = [
	"wait",
	"kaimaku",
	"aka",
	"shiro",
	"relay",
	"tori",
	"shinsa",
	"kane",
	"toshi",
	"cue",
	"kotoyoro",
	"hinode",
	"maku",
] as const;
export type KohakuScene = (typeof KOHAKU_SCENES)[number];

export type KohakuTeam = "aka" | "shiro";

/** 場面の 小さな 中身（TV が 読む）。 */
export type KohakuData = {
	/** 審査：札（はじめから 順に 得点板へ）・数えはじめる 名目の ms・1枚の 間・勝ち組。 */
	readonly cards?: readonly KohakuTeam[];
	readonly countAt?: number;
	readonly step?: number;
	readonly winner?: KohakuTeam;
	/** 0時ちょうどの 名目の ms（年越しレス・山場の 時計）。 */
	readonly exact?: number;
	/** 明けた 年（ことよろの 札）。 */
	readonly year?: number;
	/** 公開リハ（0時は「仮の　0時」）。 */
	readonly reha?: boolean;
};

/** 絵に 出す 文（どれも 全角 22字まで）。 */
export const KOHAKU_ART = {
	soon: "まもなく　開演",
	aka: "紅組",
	shiro: "白組",
	baton: "age",
	board: "得点",
	win: { aka: "紅組　優勝", shiro: "白組　優勝" },
	bell: "ゴーン",
	newYear: "謹賀新年",
	akeome: "あけおめ",
	kari: "仮の　0時",
	end: "本日の　公演は　おわりました",
} as const;

/** 審査の 言いきり（勝つ 組が ◎、負ける 組が ×）。 */
export const KOHAKU_SAY: Readonly<Record<KohakuTeam, string>> = {
	aka: "紅やろ",
	shiro: "白やろ",
};

/** 0時の あとの キリコの 名前欄（おみくじ）。 */
export const KOHAKU_NAMES: Readonly<Record<JkCueGrade, string>> = {
	kami: "あけおめ＠大吉",
	oshii: "あけおめ＠吉",
	late: "あけおめ＠小吉",
	flying: "まだ　去年や",
	none: "あけおめ＠末吉",
};

/** 群衆の 文（手で 書いた 白い 一覧。レスは 全角 12字まで）。 */
export const KOHAKU_POOLS = {
	// 群衆の pool は 10 前後（直近 4行と 次の 窓の 候補を よけても 決まった 順に ならない ように）
	wait: [
		"31",
		"サンイチ",
		"たておつ",
		"待機",
		"はよ",
		"待ってた",
		"きたきた",
		"あと　5分",
		"今年も　来たな",
		"そろそろや",
		"紅白や",
	],
	kaimaku: [
		"はじまた",
		"きたきた",
		"待ってた",
		"豪華やな",
		"おお",
		"勢い　速すぎ",
		"CM　ないの　ええな",
		"幕　あがった",
		"全員　ならんだ",
		"ええ　衣装やな",
	],
	aka: [
		"懐かしい",
		"知らん　曲や",
		"ええやん",
		"こぶし　すごい",
		"声　でとる",
		"ゆれとる",
		"しみるわ",
		"演歌や",
		"大人の　歌や",
		"ええ　声",
		"しぶい",
	],
	shiro: [
		"かっけえ",
		"知らん　曲や",
		"ええやん",
		"キレッキレ",
		"光　すごい",
		"ノリノリや",
		"ダンス　すごい",
		"そろってる",
		"ええ　動き",
		"おどれる",
	],
	relay: [
		"いけ！",
		"がんばえー",
		"あと　1人",
		"つなげ",
		"ええぞ",
		"落とすなよ",
		"名物や",
		"わたせ！",
		"息　ぴったり",
		"ナイス",
	],
	tori: [
		"泣ける",
		"鳥肌",
		"ええやん",
		"豪華やな",
		"大トリや",
		"でかい",
		"まぶしい",
		"さすが",
		"貫禄や",
		"ラスボスや",
		"歌　うまい",
	],
	shinsa: [
		"どっちや",
		"紅やろ",
		"白やろ",
		"接戦や",
		"はよ　数えて",
		"ドキドキ",
		"息　止めた",
		"祈っとる",
		"札が　でた",
		"見えへん",
	],
	win: ["おめでとう", "せやろな", "紙ふぶきや", "ええ　勝負やった"],
	kane: [
		"静かに　なった",
		"ゴーン",
		"しっ",
		"静かやな",
		"雪や",
		"寒そう",
		"風情　ある",
		"除夜や",
		"心が　洗われる",
		"一年　早かった",
	],
	bellOk: ["静かに　なった", "ゴーン", "心に　しみる"],
	toshi: [
		"年越しレス　かいとけ",
		"くるうううう",
		"くるぞ…",
		"良いお年を",
		"今年も　乙",
		"あと　少し",
		"準備できた",
		"あと　ちょい",
		"今年も　終わる",
		"そわそわ",
	],
	// 0時の 洪水（ほかの pool と 文を 重ねない：洪水の 行は 直近の くりかえしに 数えないので）
	flood: [
		"あけおめ！",
		"あけおめ",
		"新年だああああ",
		"あけおめ！！",
		"はやすぎ",
		"おそかった",
	],
	kotoyoro: [
		"ことよろ",
		"ジャンプ　したで",
		"おみくじ　どうや",
		"大吉！",
		"今年も　よろしく",
		"初詣　行く？",
		"雑煮　食う",
		"今年も　頼む",
		"新年や",
		"年　明けた",
	],
	hinode: [
		"きれい",
		"みんな　サンガツ",
		"初日の出や",
		"まぶしい",
		"今年も　よろしく",
		"ねむい",
		"朝や",
		"寝てない",
		"ええ　年に",
		"拝んどく",
	],
	maku: [
		"乙",
		"おやすみ",
		"ほな",
		"楽しかった",
		"来年も　見るで",
		"解散",
		"ええ　年越し",
		"ねる",
		"おつかれ",
	],
	reha: ["リハやで", "本番は　まだや", "仮の　0時", "練習　大事"],
	rec: ["去年の　やつや", "録画　組", "結果　知っとる", "何回　見ても　ええ"],
	gap: [
		"次スレ　どこ？",
		"乱立すな",
		"950ちうい",
		"誰か踏め",
		"イッチ　次スレ",
	],
	open: ["31", "サンイチ", "たておつ", "スレ立て　乙"],
	boo: ["は？", "なんて？"],
	booEarly: ["まだ　早い", "まだ　去年や", "気が　早い"],
	booCm: ["この　番組、CM　ないで"],
	booLate: ["もう　年　明けたで", "は？"],
	booBell: ["しっ", "静かに　せえ"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ　見とるんや"],
	/** 1000 の 流れの 予備（群衆の 区切りが ない とき）。 */
	nanashi: ["くるぞ…", "はよ"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句。{kai} は 回、{n} は スレ番。 */
export const KOHAKU_THREAD = {
	live: "【実況】第{kai}回　紅白スレ合戦→年越し",
	reha: "【公開リハ】紅白スレ合戦　実況★{n}",
	rec: "【録画】紅白スレ合戦　実況★{n}",
	liveNew: "【実況】年越し→初日の出　★{n}",
	rehaNew: "【公開リハ】年越し→初日の出　★{n}",
	recNew: "【録画】年越し→初日の出　★{n}",
	get1000: "1000なら　平和",
	praise: ">>{n}　神エイム",
	crossGap: "次スレで　あけおめ",
	crossFresh: "新スレで　あけおめ！",
	quiet: "静かに　見よ",
	quit: "もう一度　Bで　出る",
	/** 名前欄の 時計（{c} は HH:MM:SS）。 */
	clock: "新年まで＠{c}",
	clockReha: "仮の0時まで＠{c}",
} as const;

/** 回（2012年が 第1回）。 */
export const kohakuKai = (y: number): number => y - 2011;

/** 山場の 合図（1つめ）・拍（0時の 3秒 前から 1秒ずつ）。ちょうどが 0時。 */
export const KOHAKU_CUE = { at: 104000, beat: 1000, pulses: 3 } as const;
export const KOHAKU_EXACT = KOHAKU_CUE.at + KOHAKU_CUE.pulses * KOHAKU_CUE.beat;

/** 時計の はじめ（04:45:00）と、1秒＝1秒に なる 残り（10秒）。 */
const CLOCK_START = 4 * 3600 + 45 * 60;
const CLOCK_REAL = 10;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 新年までの 残り（秒）。0時ちょうどの 10秒 前までは 04:45:00 → 00:00:10 を まっすぐ 縮め、
 * 最後の 10秒は 1秒＝1秒（合図の 3拍が 00:00:03 → 02 → 01、ちょうどで 00:00:00）。0時を 過ぎたら null。
 */
export const kohakuLeft = (t: number, exact = KOHAKU_EXACT): number | null => {
	if (t > exact + 1e-9) return null;
	const real = exact - CLOCK_REAL * 1000;
	if (t >= real) return Math.ceil((exact - t) / 1000 - 1e-9);
	const p = Math.max(0, t) / real;
	return Math.floor(CLOCK_START - (CLOCK_START - CLOCK_REAL) * p + 1e-9);
};

/** 「HH:MM:SS」（null は 0時を 過ぎた）。 */
export const kohakuClock = (t: number, exact = KOHAKU_EXACT): string | null => {
	const s = kohakuLeft(t, exact);
	if (s === null) return null;
	return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
};

/** キリコの 名前欄（0時までの 時計。公開リハは 仮の 0時）。0時を 過ぎたら null（おみくじは Cue が 決める）。 */
export const kohakuName = (t: number, slot: JkSlot): string | null => {
	const c = kohakuClock(t);
	if (c === null) return null;
	return (
		slot.mode === "reha" ? KOHAKU_THREAD.clockReha : KOHAKU_THREAD.clock
	).replace("{c}", c);
};

const fillN = (s: string, n: number) => s.replace("{n}", String(n));

/** 枠の スレタイ（本番は 回を スレごとに 1つ 足す）。 */
const titleOf = (n: number, slot: JkSlot): string =>
	slot.live
		? KOHAKU_THREAD.live.replace("{kai}", String(kohakuKai(slot.y) + n - 1))
		: fillN(slot.mode === "rec" ? KOHAKU_THREAD.rec : KOHAKU_THREAD.reha, n);

/** 0時の あとの スレタイ（次の スレから ずっと）。 */
const newTitleOf = (n: number, slot: JkSlot): string =>
	fillN(
		slot.live
			? KOHAKU_THREAD.liveNew
			: slot.mode === "rec"
				? KOHAKU_THREAD.recNew
				: KOHAKU_THREAD.rehaNew,
		n,
	);

const shuffled = <T>(list: readonly T[], rand: JkRand): T[] => {
	const a = [...list];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
};

/** 審査の 札の 数と、1枚ずつ 数える 間（窓が 開いて 2秒で 差が 見え、4秒で 決まる）。 */
export const KOHAKU_CARDS = 9;
export const KOHAKU_COUNT = { lead: 300, step: 400 } as const;

/**
 * 審査の 札（はじめから 順に）。勝ち組は 乱数。7割は はじめの 3枚が 勝ち組に 2対1 で かたむき
 * （早く 読む 人が 言いきれる）、のこりの 3割は 1対2 から 逆転する。勝ち組は 9枚の うち 5か 6。
 */
export const kohakuCards = (
	rand: JkRand,
): { winner: KohakuTeam; cards: KohakuTeam[] } => {
	const winner: KohakuTeam = rand() < 0.5 ? "aka" : "shiro";
	const loser: KohakuTeam = winner === "aka" ? "shiro" : "aka";
	const lean = rand() < 0.7;
	const first = shuffled(
		lean ? [winner, winner, loser] : [winner, loser, loser],
		rand,
	);
	const total = rand() < 0.5 ? 5 : 6;
	const left = total - first.filter((c) => c === winner).length;
	const rest = shuffled(
		[
			...Array.from({ length: left }, () => winner),
			...Array.from({ length: KOHAKU_CARDS - 3 - left }, () => loser),
		],
		rand,
	);
	return { winner, cards: [...first, ...rest] };
};

/** 審査の 窓が 開く 名目の ms（札は ここから 数える）。 */
const SHINSA_PICK = 70000;

/** 台本（140秒。pick 12 ＋ Cue）。 */
const kohakuTimeline: JkScript["timeline"] = (rand, slot) => {
	const { winner, cards } = kohakuCards(rand);
	const loser: KohakuTeam = winner === "aka" ? "shiro" : "aka";
	const reha = slot.mode === "reha";
	const year = slot.y + 1;
	const segments: JkScriptSeg[] = [
		{
			at: 0,
			scene: "wait",
			pool: "wait",
			rate: 0.5,
			bgm: null,
			data: { reha } satisfies KohakuData,
		},
		{ at: 8000, scene: "kaimaku", pool: "kaimaku", rate: 1, bgm: "title" },
		{
			at: 18000,
			scene: "aka",
			pool: "aka",
			rate: 1.1,
			bgm: "sad",
			caption: "紅組　一番手",
		},
		{
			at: 29000,
			scene: "shiro",
			pool: "shiro",
			rate: 1.2,
			bgm: "battle",
			caption: "白組　一番手",
		},
		{
			at: 40000,
			scene: "relay",
			pool: "relay",
			rate: 1.2,
			bgm: "field",
			caption: "名物　ageリレー",
		},
		{
			at: 54000,
			scene: "tori",
			pool: "tori",
			rate: 1.3,
			bgm: "ending",
			caption: "大トリ",
		},
		{
			at: 66000,
			scene: "shinsa",
			pool: "shinsa",
			rate: 1.5,
			bgm: "tense",
			caption: "審査",
			data: {
				cards,
				winner,
				countAt: SHINSA_PICK + KOHAKU_COUNT.lead,
				step: KOHAKU_COUNT.step,
			} satisfies KohakuData,
		},
		// 雪の 寺へ 急に 切りかわる（曲は 無音）。鐘の あいだ「静かに　見よ」を 上に 止める
		{
			at: 80000,
			scene: "kane",
			pool: "kane",
			rate: 0.3,
			bgm: null,
			caption: "除夜の　鐘",
			posts: [{ at: 0, who: "nanashi", text: KOHAKU_THREAD.quiet, pin: 7000 }],
		},
		{
			at: 92000,
			scene: "toshi",
			pool: "toshi",
			rate: 1.6,
			bgm: "retro2",
			react: [{ who: "nanashi", text: "年越しレス　かいとけ" }],
			data: { exact: KOHAKU_EXACT, reha } satisfies KohakuData,
		},
		{
			at: 102000,
			scene: "cue",
			pool: "toshi",
			rate: 3.2,
			bgm: null,
			data: { exact: KOHAKU_EXACT, year, reha } satisfies KohakuData,
		},
		{
			at: 109000,
			scene: "kotoyoro",
			pool: "kotoyoro",
			rate: 1.6,
			bgm: "title",
			title: { later: newTitleOf },
			data: { year } satisfies KohakuData,
		},
		{
			at: 124000,
			scene: "hinode",
			pool: "hinode",
			rate: 1,
			bgm: "town",
			caption: "初日の出",
		},
		{
			at: 136000,
			scene: "maku",
			pool: "maku",
			rate: 0.7,
			data: { year } satisfies KohakuData,
		},
	];
	return {
		segments,
		picks: [
			{
				at: 2000,
				boo: "booEarly",
				sets: [
					[B("31"), K("はよ"), X("あけおめ")],
					[B("待機"), K("きたきた"), X("ことよろ")],
					[B("あと　5分"), K("はよ"), X("良いお年を")],
				],
			},
			{
				at: 11000,
				boo: "booEarly",
				sets: [
					[B("はじまた"), K("おお"), X("あけおめ")],
					[B("待ってた"), K("はよ"), X("CMまだ？", "booCm")],
					[B("きたきた"), K("豪華やな"), X("ジャンプ　したで")],
				],
			},
			{
				at: 22000,
				boo: "boo",
				sets: [
					[B("こぶし　すごい"), K("懐かしい"), X("かっけえ")],
					[B("懐かしい"), K("知らん　曲や"), X("ジャンプ　したで")],
					[B("こぶし　すごい"), K("ええやん"), X("あけおめ")],
				],
			},
			{
				at: 33000,
				boo: "boo",
				sets: [
					[B("かっけえ"), K("ええやん"), X("こぶし　すごい")],
					[B("知らん　曲や"), K("懐かしい"), X("良いお年を")],
					[B("かっけえ"), K("キレッキレ"), X("泣ける")],
				],
			},
			// 名物の ageリレー：最後の 1人の 前（いつも 成功する。失敗を 願う 文は 置かない）
			{
				at: 46000,
				boo: "boo",
				sets: [
					[B("いけ！"), K("あと　1人"), X("泣ける")],
					[B("がんばえー"), K("ええぞ"), X("ことよろ")],
					[B("いけ！"), K("おお"), X("待機")],
				],
			},
			// 大トリ（区切りの 6秒 後。前の 窓との あいだで 950 の 当番が 出せる ように）
			{
				at: 60000,
				boo: "booEarly",
				sets: [
					[B("泣ける"), K("ええやん"), X("あけおめ")],
					[B("ええやん"), K("豪華やな"), X("ことよろ")],
					[B("鳥肌"), K("泣ける"), X("31")],
				],
			},
			// 審査：得点板を 読んで 勝つ 組を 早く 言いきる（勝ち組は 乱数。札は 窓が 開いてから 1枚ずつ）
			{
				at: SHINSA_PICK,
				boo: "boo",
				cheer: "win",
				sets: [[B(KOHAKU_SAY[winner]), K("接戦や"), X(KOHAKU_SAY[loser])]],
			},
			// 除夜の 鐘：黙って 聞くのが ◎（答えないと ◎、ゴーン は ○、さわぐと ×）
			{
				at: 84000,
				open: 5000,
				timeoutFit: "best",
				boo: "booBell",
				cheer: "bellOk",
				sets: [
					[X("うおおお"), K("ゴーン")],
					[X("あけおめ"), K("ゴーン")],
					[X("くるぞ…"), K("静かやな")],
				],
			},
			{
				at: 96000,
				boo: "booEarly",
				sets: [
					[B("良いお年を"), K("今年も　乙"), X("あけおめ")],
					[B("くるぞ…"), K("良いお年を"), X("あけおめ")],
					[B("年越しレス"), K("くるぞ…"), X("ことよろ")],
				],
			},
			// ことよろ（0時の 山場の 6秒 後と この 窓の 4.5秒 前の あいだに 950 の 当番が 出せる ように、少し あとに）
			{
				at: 120500,
				boo: "booLate",
				sets: [
					[B("ことよろ"), K("新年や"), X("良いお年を")],
					[B("ジャンプ　したで"), K("ことよろ"), X("待機")],
					[B("おみくじ　どうや"), K("大吉！"), X("良いお年を")],
				],
			},
			{
				at: 128000,
				boo: "booLate",
				sets: [
					[B("みんな　サンガツ"), K("ことよろ"), X("待機")],
					[B("きれい"), K("まぶしい"), X("こぶし　すごい")],
					[B("初日の出や"), K("きれい"), X("はじまた")],
				],
			},
		],
		cues: [
			{
				...KOHAKU_CUE,
				word: KOHAKU_ART.akeome,
				flood: "flood",
				praise: KOHAKU_THREAD.praise,
				cross: {
					gap: KOHAKU_THREAD.crossGap,
					fresh: KOHAKU_THREAD.crossFresh,
				},
				names: KOHAKU_NAMES,
			},
		],
	};
};

/** 第15回　紅白スレ合戦 → 年越し。 */
export const KOHAKU: JkScript = {
	id: "kohaku",
	venue: "theater",
	length: 140000,
	goal: { live: 5, rerun: 2, reha: 3, rec: 2 },
	pools: KOHAKU_POOLS,
	title: titleOf,
	at1000: () => KOHAKU_THREAD.get1000,
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
	extra: [
		{ pool: "reha", p: 0.15, when: (slot: JkSlot) => slot.mode === "reha" },
		{ pool: "rec", p: 0.15, when: (slot: JkSlot) => slot.mode === "rec" },
	],
	quitNote: KOHAKU_THREAD.quit,
	name: kohakuName,
	tune: { post: 0.1, boost: 3, comboMin: 20 },
	bands: {
		p50: { miru: [0.52, 0.6], kami: [1.08, 99] },
		kanso: { jouzu: [0.65, 0.8], shoshin: [0.25, 0.45], random: [0, 0.099] },
	},
	timeline: kohakuTimeline,
};
