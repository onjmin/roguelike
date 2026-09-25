// 3つのダンジョン（トルネコ1の ちょっと／不思議／もっと）の物語の部品。
// - 名前と層の名前、目的の品、はじめて入る前の語り（intro）と 持ち帰ったあとの語り（ending）、
//   次のダンジョンが開いたときの ひとこと、タイトルの ひとことの たまり、タイトルに出る仲間。
// - 本編（main）の intro / ending は quotes.ts の INTRO / ENDING をそのまま使う。
// 話すのは 外で待っている仲間だけ（キリコはしゃべらない。ナレーションで動作だけ描く）。
// 1行は全角22字・2行まで。説明せず、行間を読ませる（rpg README「セリフの書き方」）。

import type { DungeonId } from "../core/types";
import { ENDING, INTRO, type Speaker } from "./quotes";

/** 仲間の ひとこと（タイトルや 開いたときの ひとこと）。 */
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
			"落ちた　スレは、下へ　行く。\n読まれなく　なった　レスも、いっしょに。",
			"ずっと　下の、過去ログの底に、\n一枚の　レコードが　あるという。",
			"キリコは　蓄音機を　かかえた。\n……針が、無い。",
			"針なら、ちょっと下に　落ちているという。",
			"「それ　取ってこれたら、底も　行けるやろ」\n見なれた　山吹色が、そう　言った。",
			"キリコは　蓄音機の　ハンドルを　まわした。\n……鳴らない。",
			"……まず、ちょっとだけ、降りる。",
		],
		ending: [
			n("階段を　のぼりきると、\n山吹色が　うでを　組んで　待っていた。"),
			s("nanj", "取ってきたんか。\n……ワイは　疑ってへんかったで（自称）"),
			s("feris", "おかえり〜。針、ちっちゃいね〜。\n……なくさないでね〜"),
			s("roze", "落とした　ものを　ひろって　くるのは\n常識アル。……えらいアル"),
			s("teto", "べ、別に　見てなかった。\n……針、さびてないか。見せろ"),
			s("rei", "帰還を　記録。「おかえりなさい」は、\n……まだ、とっておきます"),
			n("キリコは　蓄音機に　針を　つけた。\nハンドルを　まわす。"),
			n("ざらざら、と　音が　した。\n……それだけ、だった。"),
			s("nanj", "……なんも　のってへんやん。草"),
			n("キリコは　しばらく、\nその　ざらざらを　聞いていた。"),
			s("rei", "……ざらざら、を　記録しました"),
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
			s("teto", "……あー。\nべ、別に、歌わないからな"),
			s("rei", "あー、あー。\n……当機の　声も、記録されました"),
			n("針が、あがる。"),
		],
	},
};

// ───────────────── 次が開いたとき ─────────────────
/**
 * 持ち帰って 次のダンジョンが開いたときの ひとこと（ending のあと・記録の札の前に）。
 * relief は ちょっと で10回 倒れて 本編が開いたとき（針は テトが 用意する）。
 */
export const UNLOCK_LINES: Record<"main" | "deep" | "relief", readonly Line[]> =
	{
		main: [
			q("nanj", "約束や。底、行ってええで。\n……行ってええ、けど"),
			q("rei", "深い階への　入場を、\n記録しました"),
		],
		deep: [
			q(
				"rei",
				"底の　さらに　下から、ログを　検知。\n……解析は、あとで　します",
			),
			q("nanj", "底の　下って　なんやねん。\n……延長戦や。延長戦"),
		],
		relief: [
			q(
				"teto",
				"……針なら、ボクの　ドリルを　けずった。\nべ、別に、ひまだった　だけだ",
			),
			q("rei", "10回の　入場を　確認。\n……深い階への　入場も、記録しました"),
		],
	};

// ───────────────── タイトルの ひとこと ─────────────────
/** 持ち帰ったあと（ダンジョンごと）。 */
export const CLEAR: Record<DungeonId, readonly Line[]> = {
	shallow: [
		q("nanj", "針、取ってきたんか。\n……ほな、次は　本番やな"),
		q("roze", "ちょっと下でも、下は　下アル。\n……おつかれアル"),
		q(
			"feris",
			"針、見つかって　よかったね〜。\n私、目が　いいから　見えてたよ〜",
		),
		q("teto", "ちょっと　下だろ。……ふん。\nべ、別に、すごくない。……すごくない"),
		q("rei", "針の　回収を　確認。\n……深い階の　記録も、用意します"),
	],
	main: [
		q("nanj", "「あー、あー」て。\n……何回　聞いても　草"),
		q("roze", "おかえりアル。……蓄音機、\nずっと　まわってるアル"),
		q("feris", "レコード、もう1回　きこ〜。\n……もう1回だけ〜"),
		q("teto", "「あー、あー」しか　入ってない。\n……わるくない。わるくないぞ"),
		q("rei", "原盤の　再生を、また　記録。\n……当機は、聞くたびに　記録します"),
	],
	deep: [
		q("nanj", "底の　下まで　行った子、\nワイが　名付けたんやで（自称）"),
		q("roze", "わたしの　「アル」、\nちゃんと　入ってたアル？"),
		q("feris", "私の　くしゃみ、入ってない〜？\n……入ってても、いいか〜"),
		q("teto", "……ボクの　「あー」、聞き返すな。\nべ、別に　はずかしくない"),
		q("rei", "当機の　声の　再生を　確認。\n……正弦波、でしたか"),
	],
};

/** まだ一度も降りていない（針を 取りにいく前）。quotes.ts の FIRST の ちょっと 版。 */
export const FIRST_SHALLOW: readonly Line[] = [
	q("nanj", "ちょっと下やで。ちょっと。\n……ほな、上で　保守しとくわ"),
	q("roze", "針は　ちいさいアル。\nよく　見て　さがすアル。常識アル"),
	q("feris", "ちょっと　下なら、私も\n飛んで　行けるかな〜。……行かないけど〜"),
	q("teto", "べ、別に　心配してない。\n……針、なくすなよ"),
	q("rei", "入場を　記録しました。\n「おかえりなさい」は、用意して　あります"),
];

/** ちょっと で倒れたとき（たおれ方の たまりより 前に見る）。 */
export const SHALLOW_DEATH: readonly Line[] = [
	q("nanj", "ちょっと下やで？　ちょっと。\n……いや、ちょっとでも　下は　下か"),
	q("roze", "針は　ちいさいアル。\nあわてないのが　常識アル"),
	q("feris", "ちょっと下でも、ころぶよね〜。\n私も　よく　ころぶ〜"),
	q("teto", "……杖は、ふって　みるまで　わからない。\nべ、別に　教えてない"),
	q("rei", "浅い　ログを　記録。\n……短くても、読みます"),
];

// ───────────────── タイトルに出る仲間 ─────────────────
/**
 * 持ち帰るたびに タイトルの キリコの列に 仲間が ふえる（トルネコの 店が 大きくなるのに あたる）。
 * 前の段の 仲間は そのまま残る（もっと を持ち帰ると 5人 そろう）。
 */
export const TITLE_CAMEOS: readonly {
	after: DungeonId;
	who: readonly Speaker[];
}[] = [
	{ after: "shallow", who: ["nanj"] },
	{ after: "main", who: ["feris", "roze"] },
	{ after: "deep", who: ["teto", "rei"] },
];
