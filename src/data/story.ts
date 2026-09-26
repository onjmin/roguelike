// 3つのダンジョン（トルネコ1の ちょっと／不思議／もっと）の物語の部品。
// - 名前と層の名前、目的の品、はじめて入る前の語り（intro）と 持ち帰ったあとの語り（ending）、
//   次のダンジョンが開いたときの ひとこと、起動の札と 村の ひとことの たまり。
// - 本編（main）の intro / ending は quotes.ts の INTRO / ENDING をそのまま使う。
// 話すのは 外で待っている仲間だけ（キリコはしゃべらない。ナレーションで動作だけ描く）。
// 1行は全角22字・2行まで。説明せず、行間を読ませる（rpg README「セリフの書き方」）。

import type { DungeonId } from "../core/types";
import { ENDING, INTRO, type Speaker } from "./quotes";

/** 仲間の ひとこと（起動の札・村・開いたときの ひとこと）。 */
export type Line = { who: Speaker; text: string };

/** 語りの1ページ（who が null なら ナレーション）。 */
export type StoryPage = { who: Speaker | null; text: string };

const q = (who: Speaker, text: string): Line => ({ who, text });
const n = (text: string): StoryPage => ({ who: null, text });
const s = (who: Speaker, text: string): StoryPage => ({ who, text });

// ───────────────── 名前 ─────────────────
/** ダンジョンの名前と、記録の一覧に出す短い札。 */
export const DUNGEON_NAMES: Record<DungeonId, { name: string; short: string }> =
	{
		shallow: { name: "ちょっと過去ログの底", short: "ちょっと" },
		main: { name: "過去ログの底", short: "ログの底" },
		deep: { name: "もっと過去ログの底", short: "もっと" },
	};

/** ui/theme.ts の Theme.name。 */
export type ThemeName =
	| "earth"
	| "moss"
	| "crystal"
	| "cyber"
	| "lava"
	| "gold";

export type ZoneSpec = {
	/** この層の いちばん深い階。 */
	last: number;
	name: string;
	theme: ThemeName;
	/** 本編の同じ見た目の層に合わせた 曲と ただよう粒（ui/theme.ts の ZONES と同じ語）。 */
	bgm: string;
	ambient: string;
};

/**
 * 層の名前（本編の6層は ui/theme.ts の ZONES にある）。
 * - ちょっと：落ちたばかりの スレが つもる浅い穴。針は 過去ログ倉庫（rpg で 落ちたスレが ねむる所）に。
 * - もっと：底の さらに下。だれかが 掘りかけた穴から はじまり、いちばん下は 本編の B20 と同じ 金。
 */
export const ZONE_NAMES: Record<"shallow" | "deep", readonly ZoneSpec[]> = {
	shallow: [
		{
			last: 4,
			name: "落ちたてのスレ",
			theme: "earth",
			bgm: "dungeon",
			ambient: "dust",
		},
		{
			last: 8,
			name: "草の生えたスレ",
			theme: "moss",
			bgm: "field",
			ambient: "spores",
		},
		{
			last: 10,
			name: "過去ログ倉庫",
			theme: "crystal",
			bgm: "shallow3",
			ambient: "snow",
		},
	],
	deep: [
		{
			last: 6,
			name: "掘りかけの穴",
			theme: "earth",
			bgm: "deep1",
			ambient: "dust",
		},
		{
			last: 12,
			name: "保守の墓場",
			theme: "moss",
			bgm: "deep2",
			ambient: "spores",
		},
		{
			last: 18,
			name: "文字化けの海",
			theme: "crystal",
			bgm: "deep3",
			ambient: "snow",
		},
		{
			last: 24,
			name: "落ちた鯖",
			theme: "cyber",
			bgm: "deep4",
			ambient: "data",
		},
		{
			last: 29,
			name: "名無しの荒野",
			theme: "lava",
			bgm: "deep5",
			ambient: "embers",
		},
		{
			last: 30,
			name: "つづきの原盤",
			theme: "gold",
			bgm: "deep6",
			ambient: "glitter",
		},
	],
};

// ───────────────── 目的の品 ─────────────────
/** 本編の「はじまりの原盤」は core/data/items.ts にある（desc は同じ書き方）。 */
export const GOAL_ITEMS: Record<
	"shallow" | "deep",
	{ id: string; name: string; desc: string }
> = {
	shallow: {
		id: "hari",
		name: "蓄音機の針",
		desc: "ちょっと下に　落ちていた　針。持ち帰ろう",
	},
	deep: {
		id: "tsuzuki",
		name: "つづきの原盤",
		desc: "底の　さらに　下の　レコード。まだ、なにも　入っていない",
	},
};

// ───────────────── 語り ─────────────────
/**
 * intro：そのダンジョンに はじめて入る前の ナレーション。ちょっと の intro が このゲームの いちばん最初の前口上。
 * ending：目的の品を 持ち帰ったとき（記録の札の前）。
 */
export const STORY: Record<
	DungeonId,
	{ intro: readonly string[]; ending: readonly StoryPage[] }
> = {
	shallow: {
		intro: [
			// 前口上は 最初の 村（data/town.ts の OPENING）で 見せたので、ここは 中の 決まり
			"ちょっと過去ログの底。\n落ちた　ばかりの　スレが　つもる　穴。",
			"キリコが　1歩　すすむと、\n下の　ものたちも　1歩　すすむ。",
			"たおれたら、持ち物も　レベルも\n置いて、地上へ　もどされる。",
			"キリコは　蓄音機を　かかえた。\n……まず、ちょっとだけ、降りる。",
		],
		ending: [
			n("階段を　のぼりきると、\n山吹色が　うでを　組んで　待っていた。"),
			s("nanj", "取ってきたんか。\n……ワイは　疑ってへんかったで（自称）"),
			s("feris", "おかえり〜。針、ちっちゃいね〜。\n……なくさないでね〜"),
			s("roze", "落とした　ものを　ひろって　くるのは\n常識アル。……えらいアル"),
			s("shiyo", "……見てなかったわよ。\n針、さびてない？　見せなさい"),
			s("zero", "おかえりなさい！　……あ、針の\nほうにも　言っちゃいました"),
			n("キリコは　蓄音機に　針を　つけた。\nハンドルを　まわす。"),
			n("ざらざら、と　音が　した。\n……それだけ、だった。"),
			s("nanj", "……なんも　のってへんやん。草"),
			n("キリコは　しばらく、\nその　ざらざらを　聞いていた。"),
			s(
				"zero",
				"……ざらざらも、保存しました。\nゼロには、雨の　音に　聞こえます",
			),
		],
	},
	main: { intro: INTRO, ending: ENDING },
	deep: {
		intro: [
			"底の　さらに　下から、\nちいさな　ログが　聞こえるという。",
			"落ちた　スレの、そのまた　下。\nなにが　あるのか、だれも　知らない。",
			"はじまりの　原盤は、地上で\nまだ、ちいさく　鳴っている。",
			"キリコは　蓄音機の　ハンドルを　まわした。\n……針は、ある。",
			"……もっと、降りる。",
		],
		ending: [
			n("階段を　のぼりきると、\n五つの　色が、ならんで　立っていた。"),
			s("nanj", "延長戦、おつかれさん。\n……サヨナラは、まだ　言わへんで"),
			n("キリコは　蓄音機に　つづきの原盤を　のせた。\n針が、おりる。"),
			n("ざらざら、と　音が　した。\nその　むこうには、まだ　なにも　ない。"),
			s("nanj", "……なんも　入ってへんやん。\nまた　草"),
			n("キリコは　ラッパを、\nみんなの　ほうへ　向けた。"),
			s("nanj", "え、ワイから？\n……あー、あー。マイクテスト、マイクテスト"),
			s("feris", "あー、あー〜。\n……ふぇ……ふぇ……"),
			s("roze", "あー、あー、アル。\n……これで　いいアル？"),
			s("shiyo", "……あ、あーっ！\nいまの　なし！　録らないで！"),
			s(
				"zero",
				"あー、あー。……ゼロの　声も、\nみんなと　同じ　レコードに　入った",
			),
			n("針が、あがる。"),
		],
	},
};

// ───────────────── 次が開いたとき ─────────────────
/**
 * 持ち帰って 次のダンジョンが開いたときの ひとこと（ending のあと・記録の札の前に）。
 * relief は ちょっと で10回 倒れて 本編が開いたとき（針は シヨが 用意する）。
 */
export const UNLOCK_LINES: Record<"main" | "deep" | "relief", readonly Line[]> =
	{
		main: [
			q("nanj", "約束や。底、行ってええで。\n……行ってええ、けど"),
			q(
				"zero",
				"底への　入口、開きました！\nゼロ、いっしょには　行けませんが……",
			),
		],
		deep: [
			q(
				"zero",
				"底の　さらに　下から、音が　します。\n……サブ機たちも、ざわざわ　してます",
			),
			q("nanj", "底の　下って　なんやねん。\n……延長戦や。延長戦"),
		],
		relief: [
			q(
				"shiyo",
				"針なら、あたすが　用意したわよ。\n……あなたの　ためじゃ　ないから",
			),
			q("zero", "10回の　挑戦、ぜんぶ　見てました。\n……11回目も、応援します！"),
		],
	};

// ───────────────── 起動の札と 村の ひとこと ─────────────────
/** 持ち帰ったあと（ダンジョンごと）。 */
export const CLEAR: Record<DungeonId, readonly Line[]> = {
	shallow: [
		q("nanj", "針、取ってきたんか。\n……ほな、次は　本番やな"),
		q("roze", "ちょっと下でも、下は　下アル。\n……おつかれアル"),
		q(
			"feris",
			"針、見つかって　よかったね〜。\n私、目が　いいから　見えてたよ〜",
		),
		q(
			"shiyo",
			"ちょっと下、でしょ。……ふん。\nま、まあ、よく　やったんじゃない",
		),
		q(
			"zero",
			"針の　回収、おめでとうございます！\n……ケーキは、焼けませんでした",
		),
	],
	main: [
		q("nanj", "「あー、あー」て。\n……何回　聞いても　草"),
		q("roze", "おかえりアル。……蓄音機、\nずっと　まわってるアル"),
		q("feris", "レコード、もう1回　きこ〜。\n……もう1回だけ〜"),
		q("shiyo", "「あー、あー」しか　入ってない。\n……まあ、わるくないわよ"),
		q("zero", "原盤、今日も　聞きました。\n……再生回数、ゼロが　1位です"),
	],
	deep: [
		q("nanj", "底の　下まで　行った子、\nワイが　名付けたんやで（自称）"),
		q("roze", "わたしの　「アル」、\nちゃんと　入ってたアル？"),
		q("feris", "私の　くしゃみ、入ってない〜？\n……入ってても、いいか〜"),
		q("shiyo", "……あたすの　「あー」、\n聞き返さないで。声、大きすぎ"),
		q("zero", "ゼロの　声、ちゃんと　みなさんと\n混ざって　ましたか？"),
	],
};

/** まだ一度も降りていない（針を 取りにいく前）。quotes.ts の FIRST の ちょっと 版。 */
export const FIRST_SHALLOW: readonly Line[] = [
	q("nanj", "ちょっと下やで。ちょっと。\n……ほな、上で　保守しとくわ"),
	q("roze", "針は　ちいさいアル。\nよく　見て　さがすアル。常識アル"),
	q("feris", "ちょっと　下なら、私も\n飛んで　行けるかな〜。……行かないけど〜"),
	q("shiyo", "心配なんか　してないわよ。\n……針、なくさないでよね"),
	q(
		"zero",
		"いってらっしゃいの　練習、\n100回　しました。……いってらっしゃい！",
	),
];

/** ちょっと で倒れたとき（たおれ方の たまりより 前に見る）。 */
export const SHALLOW_DEATH: readonly Line[] = [
	q("nanj", "ちょっと下やで？　ちょっと。\n……いや、ちょっとでも　下は　下か"),
	q("roze", "針は　ちいさいアル。\nあわてないのが　常識アル"),
	q("feris", "ちょっと下でも、ころぶよね〜。\n私も　よく　ころぶ〜"),
	q("shiyo", "杖は、ふるまで　わからないの。\n……教えて　あげたんだからね"),
	q("zero", "ちょっと下の　ログ、読みました。\n……短いけど、ゼロは　好きです"),
];
