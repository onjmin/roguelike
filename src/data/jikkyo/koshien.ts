// 夏の　おんJ園（夏の 高校野球。海の家「age」の 壁の テレビ。PROGRAMS §1.6）。
// 8月は 本大会の 決勝（本番 ★4）、ほかの 月は 名勝負の 総集編（再放送 ★2）。中身は 同じ 決勝の 流れで、字幕と 題が かわる。
// - 芯は スレ番：題は「その{N}」で、高い 数から 始まり（本番 その96・総集編 その98）、目標の ★ に 届くと ちょうど
//   その100（題に【大台】、TV では スタンドの ウェーブと 札）。完走の 窓も「その100に　とどいた」。
// - 試合：整列と 礼 → 1回表 → アルプスの ブラバン（曲名は 出さない）→ 熱中症に 気をつけて（クーリング）→ 7回の 伝令 →
//   8回表に 2点 取られる → 9回裏 2アウト 満塁 → チャンスの 応援 → 山場（Cue。投手の セット・足・リリースが 合図、
//   4拍目の 打った 瞬間に「打った！」）→ 走者一掃の 逆転サヨナラ → 負けた 側は 砂を 集める → 勝った 側の 校歌 → 反省会。
// - 学校は 板の 語で 作った 架空の 名前だけ（KOSHIEN_SCHOOLS。乱数で 2校）。選手の 名前は 出さない。
//   実在の 大会・球場・新聞社・学校・応援曲の 名前は 出さない（deny）。「保守」は おんJ園・おんJ実業 の 中だけ。
// - キリコが 書ける 文（候補・当番・山場の 1語）には「保守」「立てといた」「立てたる」「立てたで」を 入れない。
// - 文の 幅：レス 12・候補 10・スレタイ・字幕・pin・絵の 字 22（全角）。試験は src/sim/jikkyoProgTests.ts。
// TV は ui/jikkyo/jikkyoKoshienTv.ts（場面の 鍵は KOSHIEN_SCENES、絵に 出す 文は KOSHIEN_ART）。

import type {
	JkFit,
	JkOpt,
	JkScript,
	JkScriptSeg,
	JkSlot,
} from "../../core/jikkyo";
import { type JkPack, liveOr } from "./pack";

const o = (text: string, fit: JkFit): JkOpt => ({ text, fit });
const B = (t: string) => o(t, "best");
const K = (t: string) => o(t, "ok");
const X = (t: string) => o(t, "miss");

/** 場面の 鍵（札・整列・試合・アルプス・給水・伝令・山場・サヨナラ・砂・校歌）。 */
export const KOSHIEN_SCENES = [
	"card",
	"aisatsu",
	"field",
	"alps",
	"kyusui",
	"denrei",
	"cue",
	"sayonara",
	"suna",
	"kouka",
] as const;

/** 架空の 学校（name は 字幕、short は 得点板）。 */
export const KOSHIEN_SCHOOLS = [
	{ name: "おんJ実業", short: "J実" },
	{ name: "sage学園", short: "sage" },
	{ name: "age商業", short: "age" },
	{ name: "名無し農業", short: "名農" },
	{ name: "過去ログ工業", short: "ログ" },
] as const;

/** 場面の 小さな 中身（TV が 読む）。away は 先攻、home は 後攻（逆転サヨナラで 勝つ）の 学校の 番。 */
export type KoshienData = {
	readonly away: number;
	readonly home: number;
	/** card：まもなく・おわり／cue：山場（exact は 打つ 瞬間の 名目の ms）。 */
	readonly phase?: "soon" | "end" | "cue";
	readonly card?: string;
	/** 得点板（回・[先攻, 後攻]・アウト・塁 1=一塁 2=二塁 4=三塁）。 */
	readonly inn?: string;
	readonly score?: readonly [number, number];
	readonly outs?: number;
	readonly bases?: number;
	readonly exact?: number;
	/** アルプスの チャンスの 応援（タオルが まわる）。 */
	readonly chance?: boolean;
};

/** 絵に 出す 文（どれも 全角 22字まで）。 */
export const KOSHIEN_ART = {
	logo: "夏のおんJ園",
	soon: "まもなく決勝",
	soushu: "名勝負総集編",
	end: "夏がおわった",
	endSoushu: "総集編おわり",
	tag: "総集編",
	live: "LIVE",
	hit: "カキーン",
	sayonara: "サヨナラ",
	hissho: "必勝",
	temp: "35℃",
	kouka: "校歌",
	sono100: "その100",
	taidai: "大台到達",
	siren: "ウーー",
} as const;

/** 群衆の 文（手で 書いた 白い 一覧。レスは 全角 12字まで）。 */
export const KOSHIEN_POOLS = {
	wait: [
		"31",
		"サンイチ",
		"たておつ",
		"待機",
		"はよ",
		"あと5分",
		"決勝や",
		"今年も来たな",
		"暑そう",
		"くるぞ…",
	],
	kaishi: [
		"はじまた",
		"礼！",
		"サイレンや",
		"きたきた",
		"ついに決勝",
		"帽子とった",
		"審判も暑そう",
		"待ってた",
		"全員ならんだ",
		"おお",
	],
	shiai: [
		"ええ球",
		"はやい",
		"ナイス",
		"ストライク",
		"球が走っとる",
		"1回から熱い",
		"守備うまい",
		"ええスイング",
		"冷静やな",
		"ファウルや",
	],
	alps: [
		"ブラバンええな",
		"音がええ",
		"アルプスすごい",
		"応援すごい",
		"この曲すき",
		"鳥肌",
		"声でとる",
		"メガホンゆれとる",
		"全校応援や",
		"楽器暑そう",
	],
	atsui: [
		"暑そう",
		"水飲め",
		"かげろう見える",
		"熱中症気いつけや",
		"ちゃんと休め",
		"給水大事",
		"クーリングタイム",
		"日かげほしい",
		"35度あるで",
		"見とるだけで暑い",
	],
	denrei: [
		"伝令や",
		"落ち着け",
		"何話しとる？",
		"深呼吸や",
		"ええ間や",
		"笑っとる",
		"ピンチや",
		"ここ大事",
		"間をとった",
		"マウンドに集まった",
	],
	pinch: [
		"あかん",
		"きついな",
		"まだわからん",
		"2点差か",
		"粘れ",
		"夏はこれから",
		"ここからやぞ",
		"流れ悪い",
		"相手うまい",
		"切りかえや",
	],
	ura: [
		"ここからや",
		"頼む",
		"あと1人",
		"祈っとる",
		"満塁や",
		"最後まで見る",
		"手汗すごい",
		"うそやろ",
		"ドキドキ",
		"息止めた",
	],
	chance: [
		"チャンスや",
		"鳥肌",
		"アルプスゆれとる",
		"打てる打てる",
		"いけるで",
		"かっとばせ",
		"音でかい",
		"応援すごい",
		"ここで打て",
		"球場がゆれとる",
	],
	// 打った 瞬間の 洪水（ほかの pool と 文を 重ねない：洪水の 行は 直近の くりかえしに 数えないので）
	flood: [
		"打った！",
		"打ったああ",
		"うおおおお",
		"いったあ！",
		"逆転や！",
		"はやすぎ",
		"おそかった",
	],
	after: [
		"おめでとう",
		"すごい夏や",
		"サイレン鳴った",
		"ドラマや",
		"走者一掃や",
		"鳥肌止まらん",
		"信じとった",
		"マジか",
		"鯖が重い",
		"優勝や",
	],
	// 砂は 集めすぎて 話が ふくらむ（袋 → ダンプ → 地図が かわる。負けた 人は 笑わない。笑うのは 砂の 量）
	suna: [
		"砂多すぎ",
		"胸張れ",
		"ええチームや",
		"袋でかない？",
		"ダンプ来た",
		"ようやった",
		"グラウンド減っとる",
		"地図かわる",
		"砂で山できた",
		"拍手や",
	],
	kouka: [
		"校歌や",
		"ええ校歌",
		"歌詞ええな",
		"1番だけやな",
		"声でとる",
		"知らん校歌",
		"全員歌っとる",
		"砂まだ運んどる",
		"旗があがる",
		"おめでとう",
	],
	hansei: [
		"乙",
		"ええ夏やった",
		"来年も見る",
		"ありがとう",
		"ほな",
		"解散",
		"おやすみ",
		"砂どこ行った",
		"反省会や",
		"楽しかった",
	],
	rerun: [
		"再放送乙",
		"結果知っとる",
		"何回見ても砂",
		"名勝負や",
		"総集編すき",
		"もう覚えとる",
	],
	gap: ["次スレどこ？", "乱立すな", "950ちうい", "誰か踏め", "スレはやすぎ"],
	open: [
		"31",
		"サンイチ",
		"たておつ",
		"スレ立て乙",
		"伸びる伸びる",
		"長丁場や",
	],
	boo: ["は？", "なんて？"],
	booStart: ["まだ試合前や", "気が早い"],
	booEarly: ["まだ投げとらん", "フライング", "気が早い"],
	booLate: ["もう終わったで", "は？"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ見とるんや"],
	/** 1000 の 流れの 予備（群衆の 区切りが ない とき）。 */
	nanashi: ["くるぞ…", "はよ"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句（{N} は その の 数）。 */
export const KOSHIEN_THREAD = {
	live: "【実況】夏のおんJ園その{N}",
	rerun: "【総集編】夏のおんJ園その{N}",
	liveUra: "【実況】夏のおんJ園9回裏その{N}",
	rerunUra: "【総集編】夏のおんJ園9回裏その{N}",
	hansei: "【反省会】夏のおんJ園その{N}",
	/** その100 の スレの 題の うしろ。 */
	taidai: "【大台】",
	label: "その{N}",
	get1000: "1000なら逆転サヨナラ",
	praise: ">>{n}　神エイム",
	crossGap: "次スレはよ9回裏や",
	crossFresh: "新スレ間に合った",
	quit: "もう一度Bで出る",
} as const;

/** 目標の ★（本番・総集編）。届くと ちょうど その100。 */
const GOAL = { live: 4, rerun: 2 } as const;

/** その の 数（★{n} → その{N}。目標の 次の スレが その100）。 */
export const koshienSono = (n: number, live: boolean): number =>
	100 - (live ? GOAL.live : GOAL.rerun) - 1 + n;

const sonoText = (s: string, n: number, live: boolean): string => {
	const N = koshienSono(n, live);
	return `${s.replace("{N}", String(N))}${N === 100 ? KOSHIEN_THREAD.taidai : ""}`;
};

const titleOf = (n: number, slot: JkSlot): string =>
	sonoText(
		slot.live ? KOSHIEN_THREAD.live : KOSHIEN_THREAD.rerun,
		n,
		slot.live,
	);
const uraTitle = (n: number, slot: JkSlot): string =>
	sonoText(
		slot.live ? KOSHIEN_THREAD.liveUra : KOSHIEN_THREAD.rerunUra,
		n,
		slot.live,
	);
const hanseiTitle = (n: number, slot: JkSlot): string =>
	sonoText(KOSHIEN_THREAD.hansei, n, slot.live);

/** 山場の 合図（投手の セット・足・リリース）と 拍。4拍目が 打つ 瞬間。 */
export const KOSHIEN_CUE = { at: 96500, beat: 800, pulses: 3 } as const;
export const KOSHIEN_EXACT =
	KOSHIEN_CUE.at + KOSHIEN_CUE.pulses * KOSHIEN_CUE.beat;
/** 山場の 1語。 */
export const KOSHIEN_WORD = "打った！";

/** 台本（148秒。pick 13 ＋ Cue）。 */
const koshienTimeline: JkScript["timeline"] = (rand, slot) => {
	const live = slot.live;
	const home = Math.floor(rand() * KOSHIEN_SCHOOLS.length);
	const away =
		(home + 1 + Math.floor(rand() * (KOSHIEN_SCHOOLS.length - 1))) %
		KOSHIEN_SCHOOLS.length;
	const H = KOSHIEN_SCHOOLS[home].name;
	const A = KOSHIEN_SCHOOLS[away].name;
	const d = (x: Omit<KoshienData, "away" | "home"> = {}): KoshienData => ({
		away,
		home,
		...x,
	});
	const ura = { inn: "9回裏", score: [3, 1], outs: 2, bases: 7 } as const;
	const segments: JkScriptSeg[] = [
		{
			at: 0,
			scene: "card",
			pool: "wait",
			rate: 0.5,
			bgm: null,
			data: d({
				phase: "soon",
				card: live ? KOSHIEN_ART.soon : KOSHIEN_ART.soushu,
			}),
		},
		{
			at: 7000,
			scene: "aisatsu",
			pool: "kaishi",
			rate: 1.1,
			bgm: "title",
			caption: `${live ? "決勝" : "名勝負"}　${A}　対　${H}`,
			data: d(),
		},
		{
			at: 18000,
			scene: "field",
			pool: "shiai",
			rate: 1.2,
			bgm: "field",
			caption: `1回表　${A}の攻撃`,
			data: d({ inn: "1回表", score: [0, 0], outs: 0, bases: 0 }),
		},
		{
			at: 30000,
			scene: "alps",
			pool: "alps",
			rate: 1.2,
			bgm: "retro",
			caption: "アルプスのブラバン",
			data: d(),
		},
		{
			at: 42000,
			scene: "kyusui",
			pool: "atsui",
			rate: 1,
			bgm: "island",
			caption: "熱中症に気をつけて",
			react: [{ who: "nanashi", text: "こっちも暑い" }],
			data: d(),
		},
		{
			at: 53000,
			scene: "denrei",
			pool: "denrei",
			rate: 1.2,
			bgm: "tense",
			caption: "7回表ピンチで伝令",
			data: d(),
		},
		{
			at: 64000,
			scene: "field",
			pool: "pinch",
			rate: 1.2,
			bgm: "battle",
			caption: `8回表　${A}が2点`,
			posts: [{ at: 2500, who: "nanashi", text: "2点追加3－1", pin: 2500 }],
			data: d({ inn: "8回表", score: [3, 1], outs: 1, bases: 0 }),
		},
		{
			at: 77000,
			scene: "field",
			pool: "ura",
			rate: 1.5,
			bgm: "tense",
			caption: "9回裏2アウト満塁",
			title: { next: uraTitle },
			data: d(ura),
		},
		{
			at: 87000,
			scene: "alps",
			pool: "chance",
			rate: 1.6,
			bgm: "boss",
			caption: "アルプスのチャンスの応援",
			data: d({ chance: true }),
		},
		{
			at: 95500,
			scene: "cue",
			pool: "ura",
			rate: 3.5,
			bgm: null,
			data: d({ ...ura, phase: "cue", exact: KOSHIEN_EXACT }),
		},
		{
			at: 100100,
			scene: "sayonara",
			pool: "after",
			rate: 1.3,
			bgm: "title",
			stall: 1500,
			caption: "走者一掃の逆転サヨナラ",
			posts: [
				{
					at: 1700,
					who: "nanashi",
					text: "走者一掃4－3　サヨナラ",
					pin: 2500,
				},
				{ at: 4400, who: "nanashi", text: `${H}　優勝！`, pin: 2500 },
			],
			title: { next: null },
			data: d({ inn: "9回裏", score: [3, 4], outs: 2, bases: 0 }),
		},
		{
			at: 112000,
			scene: "suna",
			pool: "suna",
			rate: 0.9,
			bgm: "battle",
			caption: `${A}は砂を集める`,
			posts: [
				{ at: 3000, who: "nanashi", text: "砂、ダンプ3台目" },
				{ at: 6500, who: "nanashi", text: "球場が地図から消えそう" },
			],
			data: d(),
		},
		{
			at: 123000,
			scene: "kouka",
			pool: "kouka",
			rate: 0.8,
			bgm: "ending",
			caption: `${H}の校歌`,
			data: d(),
		},
		{
			at: 135000,
			scene: "card",
			pool: "hansei",
			rate: 0.7,
			title: { now: hanseiTitle },
			data: d({
				phase: "end",
				card: live ? KOSHIEN_ART.end : KOSHIEN_ART.endSoushu,
			}),
		},
	];
	return {
		segments,
		picks: [
			{
				at: 2000,
				boo: "booStart",
				sets: [
					[B("31"), K("はよ"), X("おめでとう")],
					[B("待機"), K("くるぞ…"), X(KOSHIEN_WORD)],
					[B("あと1分"), K("はよ"), X("ええ夏やった")],
				],
			},
			{
				at: 11500,
				boo: "booStart",
				sets: [
					[B("礼！"), K("はじまた"), X("乙")],
					[B("はじまた"), K("きたきた"), X("校歌や")],
					[B("きたきた"), K("おお"), X("水飲め")],
				],
			},
			{
				at: 22500,
				boo: "boo",
				sets: [
					[B("ええ球"), K("はやい"), X("ダンプ来た")],
					[B("ストライク"), K("ナイス"), X("伝令や")],
					[B("ナイス"), K("守備うまい"), X("胸張れ")],
				],
			},
			// アルプスの ブラバン（曲名は 出さない）
			{
				at: 34000,
				boo: "boo",
				sets: [
					[B("ブラバンええな"), K("音がええ"), X("ストライク")],
					[B("応援すごい"), K("この曲すき"), X("落ち着け")],
					[B("鳥肌"), K("声でとる"), X("31")],
				],
			},
			// 熱中症に 気をつけて（クーリング タイム）
			{
				at: 45500,
				boo: "boo",
				sets: [
					[B("水飲め"), K("暑そう"), X("ブラバンええな")],
					[B("熱中症注意"), K("日かげほしい"), X("礼！")],
					[B("ちゃんと休め"), K("給水大事"), X("いけるで")],
				],
			},
			{
				at: 57000,
				boo: "boo",
				sets: [
					[B("伝令や"), K("ピンチや"), X("おめでとう")],
					[B("落ち着け"), K("深呼吸や"), X("鳥肌")],
					[B("深呼吸や"), K("間をとった"), X("ええ球")],
				],
			},
			{
				at: 72000,
				boo: "boo",
				sets: [
					[B("まだわからん"), K("あかん"), X("8888")],
					[B("粘れ"), K("きついな"), X("ナイス")],
					[B("ここからやぞ"), K("2点差か"), X("はじまた")],
				],
			},
			// 9回裏 2アウト 満塁（まだ 投げて いない ので「打った！」は 早い）
			{
				at: 83000,
				boo: "booEarly",
				sets: [
					[B("ここからや"), K("頼む"), X(KOSHIEN_WORD)],
					[B("最後まで見る"), K("祈っとる"), X("乙")],
					[B("頼む"), K("ドキドキ"), X("おめでとう")],
				],
			},
			{
				at: 90500,
				boo: "booEarly",
				sets: [
					[B("いけるで"), K("鳥肌"), X(KOSHIEN_WORD)],
					[B("かっとばせ"), K("音でかい"), X("水飲め")],
					[B("打てる打てる"), K("アルプスすごい"), X("胸張れ")],
				],
			},
			{
				at: 105000,
				boo: "booLate",
				sets: [
					[B("おめでとう"), K("マジか"), X("頼む")],
					[B("ドラマや"), K("鳥肌止まらん"), X("まだわからん")],
					[B("走者一掃や"), K("信じとった"), X("落ち着け")],
				],
			},
			// 負けた 側が 砂を 集める（人を 笑わない）
			{
				at: 116500,
				boo: "boo",
				sets: [
					[B("胸張れ"), K("砂多すぎ"), X("かっとばせ")],
					[B("ダンプ来た"), K("砂多すぎ"), X("ストライク")],
					[B("ようやった"), K("拍手や"), X("いけるで")],
				],
			},
			{
				at: 128000,
				boo: "boo",
				sets: [
					[B("校歌や"), K("ええ校歌"), X("伝令や")],
					[B("8888"), K("声でとる"), X("粘れ")],
					[B("歌詞ええな"), K("1番だけやな"), X("水飲め")],
				],
			},
			{
				at: 137500,
				boo: "boo",
				sets: [
					[B("乙"), K("反省会や"), X("はじまた")],
					[B("ええ夏やった"), K("ありがとう"), X("31")],
					[B("来年も見る"), K("ほな"), X("礼！")],
				],
			},
		],
		cues: [
			{
				...KOSHIEN_CUE,
				word: KOSHIEN_WORD,
				flood: "flood",
				praise: KOSHIEN_THREAD.praise,
				cross: {
					gap: KOSHIEN_THREAD.crossGap,
					fresh: KOSHIEN_THREAD.crossFresh,
				},
			},
		],
	};
};

/** 夏の　おんJ園（台本）。 */
export const KOSHIEN: JkScript = {
	id: "koshien",
	venue: "umi",
	length: 148000,
	goal: GOAL,
	pools: KOSHIEN_POOLS,
	title: titleOf,
	label: (n, slot) =>
		KOSHIEN_THREAD.label.replace("{N}", String(koshienSono(n, slot.live))),
	at1000: () => KOSHIEN_THREAD.get1000,
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
				pin: "次スレが2つあるぞ",
				opts: [B("誘導しとく"), K("どっちや"), X("両方に書く")],
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
	quitNote: KOSHIEN_THREAD.quit,
	// 帯（空飛ぶ鯖と 同じ tune）：本番 上手 71%・初心者 33%、総集編 71%・23%（見るだけ 0.57G・神 1.33〜1.37G・random 1% まで）。
	// 総集編（★2）の 初心者は どの tune でも 23〜24% に とどまり（上げると 上手が 80% を 超える）、下の はばだけ 0.2 に 広げた。
	// 7回の 伝令と 8回の 窓の あいだを 広く とり、見るだけでも 950 の 当番が 出る。
	tune: { post: 0.1, boost: 3, comboMin: 20 },
	bands: {
		p50: { miru: [0.52, 0.6], kami: [1.08, 99] },
		kanso: { jouzu: [0.65, 0.8], shoshin: [0.2, 0.45], random: [0, 0.099] },
	},
	timeline: koshienTimeline,
};

const isAug = (t: { m: number }) => t.m === 8;
/** 8月の 土曜は 同じ テレビで 人力機の 本番も ある（その 日の 文は 人力機の 束に ゆずる）。 */
const isAugLive = (t: { m: number; w: number }) => t.m === 8 && t.w !== 6;

/** 夏の　おんJ園（束）。 */
export const KOSHIEN_PACK: JkPack = {
	script: KOSHIEN,
	venue: "umi",
	from: 2,
	menu: "夏のおんJ園",
	slot: liveOr(isAug),
	scenes: KOSHIEN_SCENES,
	// 会場の 文：8月（土曜を のぞく）は 決勝、ほかの 月は 総集編。8月の 土曜は 人力機の 束が 書く
	venueLines: {
		tv: [
			{
				when: isAugLive,
				lines: ["小さなテレビ。\n夏のおんJ園、決勝の中継。"],
			},
			{
				when: (t) => !isAug(t),
				lines: ["小さなテレビ。\nおんJ園の名勝負、総集編。"],
			},
		],
	},
	staffLines: {
		umi_master: [
			{
				when: isAugLive,
				lines: [
					"8月は夏のおんJ園や。\n……焼きそば焼きながら見とる",
					"選手も客も、水飲みや。\n……熱中症はあかんで",
				],
			},
			{
				when: (t) => !isAug(t),
				lines: ["テレビはおんJ園の総集編や。\n……夏がまた来るで"],
			},
		],
	},
	staffOnce: {
		umi_master: {
			kami: "この前のサヨナラ、\nぴったり書いとったな",
			rerun: "この前は★{n}までのびたな。\n8月の決勝は、もっとのびるで",
		},
	},
	msgs: {
		howto: "見せ場に合うレスをえらぶと、\nスレがのびる。★{n}　完走でその100",
		seat: "キリコはござの席についた。\n……スマホで、実況スレをひらく。",
		over: "試合がおわった。\n実況は★{n}までのびた。",
		kanso: "……完走。\nスレはその100にとどいた。",
		kami: "あのひとことは、\n打球といっしょだった。",
		left: "……試合のとちゅうで、\nそっとござを立った。",
	},
	art: [
		...Object.values(KOSHIEN_ART),
		...KOSHIEN_SCHOOLS.flatMap((s) => [s.name, s.short, `必勝　${s.name}`]),
	],
	deny: [
		"甲子園",
		"高野連",
		"朝日新聞",
		"毎日新聞",
		"熱闘",
		"阪神",
		"大阪桐蔭",
		"智弁",
		"PL学園",
		"横浜高校",
		"早実",
		"栄冠は君に輝く",
		"センバツ",
		"選抜",
		"タイガース",
		"ジョックロック",
		"アフリカン",
		"サウスポー",
		"狙いうち",
		"ルパン",
		"アゲアゲホイホイ",
	],
	names: ["おんJ園", "おんJ実業"],
};
