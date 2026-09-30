// 植民地（ダンジョン）の物語の部品。
// - 名前と板の決まり・見た目と曲、目的の品、はじめて入る前の語り（intro）と 持ち帰ったあとの語り（ending）、
//   ボスを たおして 一瞬で 帰ったときの 語り（BOSS_RETURN）、
//   次のダンジョンが開いたときの ひとこと、起動の札と 村の ひとことの たまり。
// - 本編（main）の intro / ending は quotes.ts の INTRO / ENDING をそのまま使う。
// 話すのは 外で待っている仲間だけ（キリコはしゃべらない。ナレーションで動作だけ描く）。
// 1行は全角22字・2行まで。説明せず、行間を読ませる（rpg README「セリフの書き方」）。

import type { DungeonId } from "../core/types";
import type { Story } from "../engine/defs";
import {
	ENDING,
	INTRO,
	type KirikoMode,
	SPEAKERS,
	type Speaker,
	type StoryPage,
} from "./quotes";

export type { StoryPage };

/** 仲間の ひとこと（起動の札・村・開いたときの ひとこと）。 */
export type Line = { who: Speaker; text: string };

/** 語りの 1ページを 窓に 出す（仲間の セリフ・ナレーション・キリコの 独白）。 */
export const playPage = (
	st: Story,
	p: { who: Speaker | null; text: string; kiriko?: KirikoMode },
): Promise<void> =>
	p.kiriko
		? st.kiriko(p.text, p.kiriko)
		: p.who
			? st.say(p.who, p.text)
			: st.narrate(p.text);

// ───────────────── 村に いない 仲間（まだ 来ていない・出ていった） ─────────────────
/**
 * 仲間が 村に 来る 町の 段（STORY.md §5「伸びた スレには 人が 来る」）。はじめの 保守村には やきうだけ
 * （と、前から いる ぷゆゆ）。建物と いっしょに 越してくる：屋台で 売る ロゼと 帳簿の ゼロ、屋根つき屋台の
 * 看板と 客よせの フェリス、倉庫番の シヨ。越してくる 場面は 町が 育つ とき（ui/villageReturn.ts の stageUp）。
 */
export const FRIEND_FROM: Record<Speaker, number> = {
	nanj: 0,
	roze: 1,
	zero: 1,
	feris: 2,
	shiyo: 4,
};

/**
 * 村に いない 仲間。まだ 来ていない（stage が FRIEND_FROM より 前）か、出ていった
 * （過去ログの底の 結末で やきうは 外へ 出ていく。STORY.md §5。そのあとは 村に 立たず、ひとことも 言わない。
 * 小屋の 前には キリコが 書いた「保守」の 札。潜る ときの やきうの 一言は キリコの 独白に 変わる）。
 * いない 人は 村に 立たず、語り・知らせ・喫茶・起動の札でも 話さない。stage を 省くと いちばん上の 段（みんな 来ている）。
 */
export const awayFriends = (
	cleared: readonly DungeonId[],
	stage = Number.POSITIVE_INFINITY,
): Speaker[] => [
	...(Object.keys(FRIEND_FROM) as Speaker[]).filter(
		(w) => stage < FRIEND_FROM[w],
	),
	...(cleared.includes("hidden") && stage >= FRIEND_FROM.nanj
		? (["nanj"] as Speaker[])
		: []),
];

/**
 * 文に 村に いない 仲間の 名前が 出てくるか（まだ 越してきていない 人・出ていった 人の 話を しない）。
 * 「フェリスちゃん」「ゼロさん」なども 名前を ふくむので 数える。
 */
export const mentionsAway = (text: string, away: readonly Speaker[]): boolean =>
	away.some((w) => text.includes(SPEAKERS[w].name));

/** 村に いない 人が 話す・出てくる（名前を 呼ばれる）ページか。 */
const gone = (p: StoryPage, away: readonly Speaker[]): boolean =>
	(!!p.who && away.includes(p.who)) ||
	(!!p.about && away.includes(p.about)) ||
	mentionsAway(p.text, away);

/** 村に いない 人の ページを かわりに かえる（かわりが 無ければ 出さない）。だれも いなければ そのまま。 */
export const withoutAway = (
	pages: readonly StoryPage[],
	away: readonly Speaker[],
): readonly StoryPage[] =>
	away.length
		? pages.flatMap((p) =>
				!gone(p, away) ? [p] : p.instead ? [p.instead] : [],
			)
		: pages;

/**
 * 持ち帰りの 語り。一度きりの 出来事（電池板・過去ログの底）は 見おえたら again に かわる。
 * 出来事に 出てくる 人が もう 村に いなければ、はじめから again。
 */
export const endingFor = (
	d: DungeonId,
	seen: boolean,
	away: readonly Speaker[],
): readonly StoryPage[] => {
	const { ending, again } = STORY[d];
	return again && (seen || ending.some((p) => gone(p, away))) ? again : ending;
};

/** 潜る ときの 一言（口で 行き先を 決めた あと）。やきうが 出ていった あとは キリコの 独白。 */
export const DEPART = {
	nanj: "ほな、上で　保守しとくわ",
	kiriko: "……保守、しとくンゴ",
	/** 村に 帰って 持ち物が からっぽの とき、ぷゆゆパンを 持たせる 地の文（ぷゆゆは 村から 去らない）。 */
	puyu: "ぷゆゆが　かけてきて、\nぷゆゆパンを　持たせてくれた。",
} as const;

/** やきうの いた 所の 札（やきうが 出ていった あと）。 */
export const HOSHU_SIGN =
	"小屋の　前の　札。\nキリコの　字で「保守」と　書いてある。";

const q = (who: Speaker, text: string): Line => ({ who, text });
const n = (text: string): StoryPage => ({ who: null, text });
const s = (who: Speaker, text: string): StoryPage => ({ who, text });
/** 地の文に 出てくる 人（about）と、その 人が 村に いないときの かわりの 地の文。 */
const nAbout = (text: string, about: Speaker, instead: string): StoryPage => ({
	who: null,
	text,
	about,
	instead: n(instead),
});
/** 話す 人が 村に いないときは、かわりの 人が 言う。 */
const sOr = (p: StoryPage, instead: StoryPage): StoryPage => ({
	...p,
	instead,
});
/** キリコの 独白（（　）で 出る。だれにも 聞こえない）。 */
const k = (text: string): StoryPage => ({ who: null, text, kiriko: "think" });

// ───────────────── 名前 ─────────────────
/**
 * 植民地（ダンジョン）の 名前・通称・マスコット・板の 決まり（村の 立て札と あそびかたに 出す）。
 * 板の 気風は おんJwiki（3代目）と 植民地一覧スレ（awabi.open2ch.net/test/read.cgi/bath/1442242433/）から。
 */
export const DUNGEON_NAMES: Record<
	DungeonId,
	{
		name: string;
		/** 記録の 一覧に 出す 短い 札。 */
		short: string;
		nick: string;
		mascot: string;
		/** 板の 決まり（1つ 1行）。 */
		rules: readonly string[];
	}
> = {
	shallow: {
		name: "パン板",
		short: "パン板",
		nick: "ぱんJ",
		mascot: "パン松　|｀°Ο°´|",
		rules: [
			"いちばん　栄えた　植民地。入門の　4階",
			"パン松の　縄張り：パンが　よく　出る",
			"杖だけ　未識別。のろいも　祭りも　ない",
		],
	},
	main: {
		name: "風呂板",
		short: "風呂板",
		nick: "おふJ",
		mascot: "おふ郎くん　[o'ω'f]",
		rules: [
			"植民地で　いちばん　雰囲気が　ええ。20階",
			"湯治：HPの　自然回復が　1.5倍",
			"帰還スレが　出る：途中で　帰れる",
		],
	},
	deep: {
		name: "電池板",
		short: "電池板",
		nick: "でんJ",
		mascot: "でんちゃん　{+'w'-]",
		rules: [
			"過疎で　謎が　多い　植民地。30階",
			"充電：杖の　回数が　1　多い",
			"ぜんぶ　未識別。ぷゆゆパンは　出ない。罠と　祭りが　多い",
		],
	},
	kinoko: {
		name: "きのこ板",
		short: "きのこ板",
		nick: "きのこ",
		mascot: "きのにゃん　[ｷ・Д・ﾉ]",
		rules: [
			"パン板が　植民した、植民地の　植民地。6階",
			"きのこの　当たり外れ：草が　多い。毒も　多い",
			"草と　杖が　未識別。のろいは　ない",
		],
	},
	tropical: {
		name: "離島・沖縄板",
		short: "離島板",
		nick: "おんトロ",
		mascot: "ココ・ナツコ　~｀i,/ ﾟヮﾟﾉヽi´~",
		rules: [
			"総島民　6人の　島。9階",
			"過疎：敵も　道具も　少ない",
			"ぜんぶ　未識別。祭りは　ない",
		],
	},
	konamono: {
		name: "おんたこ",
		short: "おんたこ",
		nick: "たこ焼き板",
		mascot: "たこのみん　∬*ﾟ ヮﾟル",
		rules: [
			"レスの　末尾に　😡が　つく　板。13階",
			"😡：どの　敵も　弱ると　怒って　倍速",
			"ぜんぶ　未識別",
		],
	},
	festival: {
		name: "お祭り会場",
		short: "お祭り",
		nick: "おまC",
		mascot: "マシー　(o M c)",
		rules: [
			"猛虎弁の　使える　雑談板。13階",
			"祭り：3階から　3つに　1つの　階が　祭り",
			"ぜんぶ　未識別",
		],
	},
	// 隠し（電池板を 持ち帰ると 開く）。植民地では なく、おんJ（保守村）の 真下
	hidden: {
		name: "過去ログの底",
		short: "ログの底",
		nick: "おんJの　真下",
		mascot: "1001（どの　スレも　最後は　これ）",
		rules: [
			"保守村の　下の　古井戸。99階",
			"層ごとに　景色と　曲が　かわる",
			"底の　品を　持ったまま　帰還スレで　帰れる",
		],
	},
};

/** ui/theme.ts の Theme.name。 */
export type ThemeName =
	| "earth"
	| "stone"
	| "ruins"
	| "white"
	| "beach"
	| "lattice"
	| "forge"
	| "moss"
	| "crystal"
	| "cyber"
	| "lava"
	| "gold";

/** 植民地の 見た目と 曲（板ごとに 1つ。全フロア 同じ。ui/theme.ts が 読む）。 */
export type BoardLook = {
	theme: ThemeName;
	bgm: string;
	ambient: string;
	/** 層（深さで 見た目と 曲が 変わる 板だけ。隠しの 過去ログの底）。 */
	zones?: readonly ZoneSpec[];
};

/** 層：この階（last）までが 同じ 見た目・同じ 曲。 */
export type ZoneSpec = {
	last: number;
	name: string;
	/** その 層に 入った ときの 階の 札に 出す 1行（落ちた スレの 最後の レス。説明は しない）。 */
	note?: string;
	theme: ThemeName;
	bgm: string;
	ambient: string;
};

/**
 * 隠しの 過去ログの底（99階）の 層。浅い ところは 植民地に 似た 景色、深くなるほど 2ch の
 * 奥（規制・落ちた鯖・炎上）へ。いちばん底は 1001 の 金。どの 層にも ちがう 曲。
 */
const HIDDEN_ZONES: readonly ZoneSpec[] = [
	{
		last: 5,
		name: "過去ログの浅瀬",
		note: "「保守」",
		theme: "earth",
		bgm: "deep1",
		ambient: "dust",
	},
	{
		last: 10,
		name: "dat の石室",
		note: "「まだ　見てる　やつ　おる？」",
		theme: "stone",
		bgm: "stone",
		ambient: "dust",
	},
	{
		last: 15,
		name: "埋もれた dat",
		note: "「落ちる前に　言っとく。楽しかった」",
		theme: "stone",
		bgm: "deep_dat",
		ambient: "dust",
	},
	{
		last: 20,
		name: "苔むしたスレ跡",
		note: "「ほな、また」",
		theme: "moss",
		bgm: "field",
		ambient: "spores",
	},
	{
		last: 25,
		name: "崩れたまとめ",
		note: "「まとめられて、それきり」",
		theme: "ruins",
		bgm: "deep_matome",
		ambient: "spores",
	},
	{
		last: 30,
		name: "保守の墓場",
		note: "「保守」「保守」「保守」",
		theme: "ruins",
		bgm: "ruins",
		ambient: "spores",
	},
	{
		last: 40,
		name: "凍結された書庫",
		note: "「このスレは　凍結されました」",
		theme: "crystal",
		bgm: "deep2",
		ambient: "snow",
	},
	{
		last: 50,
		name: "白紙の回廊",
		note: "「　」",
		theme: "white",
		bgm: "deep_hakushi",
		ambient: "snow",
	},
	{
		last: 60,
		name: "文字化けの海",
		note: "「縺ｾ縺溘・縺ｭ」",
		theme: "crystal",
		bgm: "deep3",
		ambient: "snow",
	},
	{
		last: 70,
		name: "規制の檻",
		note: "「規制で　書けん。……見てるで」",
		theme: "lattice",
		bgm: "deep_kisei",
		ambient: "data",
	},
	{
		last: 80,
		name: "落ちた鯖",
		note: "「鯖落ち？」",
		theme: "cyber",
		bgm: "deep4",
		ambient: "data",
	},
	{
		last: 90,
		name: "焦げた回線",
		note: "「燃えた。でも、ここに　おった」",
		theme: "forge",
		bgm: "deep_koge",
		ambient: "embers",
	},
	{
		last: 98,
		name: "炎上の底",
		note: "「次スレ　立てられる人　おる？」",
		theme: "lava",
		bgm: "deep5",
		ambient: "embers",
	},
	{
		last: 99,
		name: "1001",
		note: "「このスレッドは　1000を　超えました」",
		theme: "gold",
		bgm: "deep6",
		ambient: "glitter",
	},
];

export const BOARD_LOOKS: Record<DungeonId, BoardLook> = {
	// 焼き色の 土。はじめの 曲
	shallow: { theme: "earth", bgm: "dungeon", ambient: "dust" },
	// 湯気の 立つ 青白い 石
	main: { theme: "crystal", bgm: "field2", ambient: "snow" },
	// 回路の 床（漏電の 火花）。名無し155さんの 曲
	deep: { theme: "cyber", bgm: "retro", ambient: "data" },
	// 苔と 胞子。地下の 菌床（曲は ずれる 地層）
	kinoko: { theme: "moss", bgm: "deq_strata", ambient: "spores" },
	// 砂浜と 南国の 緑（水晶の 洞窟では 島に 見えないので）。水の しずく（曲は 水底に さす 光）
	tropical: { theme: "beach", bgm: "deq_sea", ambient: "glitter" },
	// 鉄板の 焦げ（曲は 活火山の 底）
	konamono: { theme: "lava", bgm: "deq_volcano", ambient: "embers" },
	// 提灯の 赤。都節の 曲
	festival: { theme: "lattice", bgm: "deep_kisei", ambient: "glitter" },
	// 隠し：層ごとに かわる（theme・bgm は 層が 無い ときの 予備）
	hidden: {
		theme: "earth",
		bgm: "deep1",
		ambient: "dust",
		zones: HIDDEN_ZONES,
	},
};

// ───────────────── 目的の品 ─────────────────
/** 本編の「長湯スレ」は core/data/items.ts にある（desc は同じ書き方）。 */
export const GOAL_ITEMS: Record<
	"shallow" | "deep",
	{ id: string; name: string; desc: string }
> = {
	shallow: {
		id: "hari",
		name: "植民地化宣言",
		desc: "パン板に　おんJ民が　乗りこんだ　日の　レス。持ち帰って　貼ろう",
	},
	deep: {
		id: "tsuzuki",
		name: "鉄塔の保守スレ",
		desc: "送電鉄塔の　てっぺんで、だれかが　保守しつづけた　スレ。持ち帰って　貼ろう",
	},
};

// ───────────────── 語り ─────────────────
/**
 * intro：そのダンジョンに はじめて入る前の ナレーション。パン板の intro が このゲームの いちばん最初の前口上。
 * ending：目的の品を 持ち帰ったとき（記録の札の前）。
 * again：一度きりの 出来事の ある 板だけ。ending を 見おえた あとに 持ち帰ったとき（endingFor）。
 */
export const STORY: Record<
	DungeonId,
	{
		intro: readonly string[];
		ending: readonly StoryPage[];
		again?: readonly StoryPage[];
	}
> = {
	shallow: {
		intro: [
			// 前口上は 最初の 村（data/town.ts の OPENING）で 見せたので、ここは 中の 決まり
			"パン板の　過去ログ。\nおんJ民が　いちばん　栄えさせた　植民地。",
			"キリコが　1歩　すすむと、\n下の　ものたちも　1歩　すすむ。",
			"1つの　階は、1本の　スレ。\n1000を　こえたら、つぎへ　落とされる。",
			"たおれたら、持ち物も　レベルも\n置いて、地上へ　もどされる。",
			"キリコは　蓄音機を　かかえた。\n……まず、パン板から　降りる。",
		],
		ending: [
			nAbout(
				"村に　帰りつくと、\n山吹色が　うでを　組んで　待っていた。",
				"nanj",
				"村に　帰りつくと、\n小屋の　前の　札が　風に　ゆれていた。",
			),
			s("nanj", "取ってきたんか。\n……ほな、貼るで"),
			n(
				"キリコは　拾った　レスを　蓄音機に　かけた。\n「ここは　おんJの　植民地や！」",
			),
			s("nanj", "……なつかしいな。昔は　遊びで\n侵略しとった　だけやのにな"),
			s("feris", "あ、レスが　ついた〜。\n……ひとつ、ふたつ〜"),
			s("roze", "落とした　ものを　ひろって　くるのは\n常識アル。……えらいアル"),
			s("shiyo", "……見てなかったわよ。\nつぎも　行くんでしょ。知ってるわよ"),
			s("zero", "スレ、伸びました！\n……ひさしぶりに、数字が　動きました"),
			k("……伸びたンゴ"),
		],
	},
	main: { intro: INTRO, ending: ENDING },
	deep: {
		intro: [
			"過疎の　電池板。\n住む　人は　いないのに、スレは　落ちない。",
			"だれかが　保守して　ageた　スレが、\n送電鉄塔の　上へ　つもっていく。",
			"鉄塔の　てっぺんには、いちばん　長く\n保守された　スレが　あるという。",
			"キリコは　蓄音機を　かかえた。",
			"……でん、と　鳴った。",
		],
		ending: [
			// 転（STORY.md §5）：村が いちばん にぎやかに なったのに、去った 人は 帰らない。やきうが 外へ 出ると 言う
			n("村に　帰りつくと、\n村は　人で　いっぱいだった。"),
			s(
				"zero",
				"スレ、1000まで　あと　すこしです！\n……こんなの、ひさしぶりです",
			),
			s("feris", "知らない　人、いっぱい〜。\n……みんな、はじめまして　だね〜"),
			s("roze", "……前に　いた　人は、\nひとりも　来て　ないアル"),
			n("キリコは　鉄塔の　保守スレを　かけた。\n「保守」「保守」「保守」……"),
			s("nanj", "……ワイの　書きこみや、これ"),
			s(
				"nanj",
				"……ワイも、そろそろ　外、行くわ。\n外にも　ワイの　暮らしが　あるんや",
			),
			s("shiyo", "……な、なに　言ってんのよ"),
			s("nanj", "すぐや　ない。\n……古井戸の　底、知っとるか"),
			s(
				"nanj",
				"完走した　スレは、あそこに\nしまわれとる。……キリコの　スレもや",
			),
			k("……吾輩の、スレンゴ"),
		],
		again: [
			n("村に　帰りつくと、\n村は　今日も　人で　いっぱいだった。"),
			n("キリコは　鉄塔の　保守スレを　かけた。\n「保守」「保守」「保守」……"),
			s("feris", "看板の　前、今日も　人だかり〜。\n……知らない　人ばっかり〜"),
			k("……保守ンゴ"),
		],
	},
	kinoko: {
		intro: [
			"きのこ板の　過去ログ。\nパン板が　植民した、植民地の　植民地。",
			"生えている　ものは、\n食べるまで　当たりか　わからない。",
			"キリコは　蓄音機を　かかえた。\n……ふんぞりかえった　声が　する。",
		],
		ending: [
			nAbout(
				"村に　帰りつくと、\nゼロが　かけよってきた。",
				"zero",
				"村に　帰りつくと、\n広場は　しずかだった。",
			),
			s("zero", "きのにゃん、ですね！\n……持ったら、にらまれました"),
			s("nanj", "態度　でかすぎやろ。\n……パン板の　植民地の　くせに"),
			n("きのにゃんは　蓄音機の　上に\nすわりこんだ。……どかない。"),
		],
	},
	tropical: {
		intro: [
			"離島・沖縄板。\n総島民は、6人。",
			"だれも　来ない　島の　山の　上に、\nヤシの実が　ひとつ　引っかかっているという。",
			"キリコは　蓄音機を　かかえた。\n……波の　音が、下から　する。",
		],
		ending: [
			nAbout(
				"村に　帰りつくと、\nフェリスが　手を　ふっていた。",
				"feris",
				"村に　帰りつくと、\n潮の　においが　ついてきた。",
			),
			s("feris", "ヤシの実〜！　ねえ、\n耳に　あてたら　波の　音　する〜？"),
			n("キリコは　ヤシの実を　蓄音機に\nのせてみた。……回らない。"),
			s(
				"roze",
				"それは　レコードじゃ　ないアル。\n……割って　飲むのが　常識アル",
			),
		],
	},
	konamono: {
		intro: [
			"おんたこの　雑居ビル。\nレスの　末尾に、😡が　つく　板。",
			"怒って　いるのでは　ない。\nたこ焼きの　顔、らしい。",
			"キリコは　蓄音機を　かかえた。\n……上の　階から、ソースの　においが　する。",
		],
		ending: [
			nAbout(
				"村に　帰りつくと、\nやきうが　鼻を　ひくつかせていた。",
				"nanj",
				"村に　帰りつくと、\nロゼが　鼻を　ひくつかせていた。",
			),
			s(
				"nanj",
				"たこ焼きやんけ！　……😡の　顔しとる。\nやきう→猛虎弁→大阪→たこ焼きや",
			),
			s("roze", "麻婆豆腐と　いっしょに\n出すアル。……合わないアル？"),
			n("たこ焼きは、まだ　あたたかかった。"),
		],
	},
	festival: {
		intro: [
			"お祭り会場の　やぐら。\n猛虎弁の　使える、雑談の　板。",
			"にぎやかだった　ころの　祭りが、\nやぐらの　上で　まだ　続いている。",
			"キリコは　蓄音機を　かかえた。\n……太鼓の　音が、上から　する。",
		],
		ending: [
			nAbout(
				"村に　帰りつくと、\nシヨが　腕を　組んで　待っていた。",
				"shiyo",
				"村に　帰りつくと、\n太鼓の　音が　耳に　のこっていた。",
			),
			s(
				"shiyo",
				"うちわ？　……祭りに　行ってたの。\nあたすは　呼ばれて　ないけど",
			),
			n("キリコは　うちわで、\nシヨを　あおいだ。"),
			s("shiyo", "……べ、べつに　暑くないわよ。\n……もう　少し　あおいで"),
		],
	},
	hidden: {
		intro: [
			"保守村の　下に、古い　井戸が　ある。\nおんJの　スレも、ここへ　落ちてきた。",
			"落ちて、落ちて、いちばん　下。\nどの　スレも、最後は　同じ　レスで　終わる。",
			"「このスレッドは　1000を\n超えました。」",
			"完走した　スレも、ここに　しまわれる。\nキリコの　生まれた　スレも。",
			"キリコは　蓄音機の　ハンドルを　まわした。\n……ひとりで、降りる。",
		],
		ending: [
			// 結・頂点（STORY.md §5・§5.9）：1作目の スレを やきうと 読み、やきうは 外へ。キリコが「保守」と 書く
			n("村に　帰りつくと、\nやきうが　井戸の　そばに　すわっていた。"),
			s("nanj", "……ほんまに　拾ってきたんか"),
			n("ふたりで　スレを　読んだ。\n安価、角刈り、100トン、34キロ。"),
			n("……「1000　名前：蓄音キリコ」"),
			n("その　下に、ひとつ。\n「次スレ　立てといたで」"),
			s("nanj", "……草。ワイや"),
			s("nanj", "……ほな、次スレは　おまえが\n保守せえ"),
			n("朝。やきうは　入口に　立った。"),
			s("nanj", "外で、見とるわ"),
			n("山吹色の　背中が、\n小さく　なっていった。"),
			n("キリコは　小屋の　前の　札に　書いた。\n「保守」"),
		],
		again: [
			n("村に　帰りつくと、\n井戸の　そばには　だれも　いなかった。"),
			n("キリコは　古い　スレを　ひらいた。\n「次スレ　立てといたで」"),
			k("……保守ンゴ"),
		],
	},
};

// ───────────────── ボスを たおして 帰ったとき ─────────────────
/**
 * 目的が boss の 板で ボスを たおし、一瞬で 入口へ 帰って きたとき（ending の 1枚目＝「村に　帰りつくと、…」の
 * 着いた 語りの あとに 村で 話す。ui/villageReturn.ts）。どう 帰って きたかが わかる 1〜2枚。
 * 品を 持ち帰った ことは そのあとの ending の 残りで。
 */
export const BOSS_RETURN: Partial<Record<DungeonId, readonly StoryPage[]>> = {
	shallow: [
		n("キリコの　服に、\nパンくずが　いっぱい　ついていた。"),
		sOr(
			s(
				"nanj",
				"パン兵に　かつがれて　帰ってきたんか。\n……パン松の　手下やんけ",
			),
			s("shiyo", "……パンくず　だらけじゃない。\nは、はらって　あげるわよ"),
		),
	],
	main: [
		n("キリコの　髪から、\nまだ　湯気が　立ちのぼっていた。"),
		s("roze", "湯柱で　飛んできたアル？\n……湯冷め　する前に　着がえるアル"),
	],
	kinoko: [
		n("キリコの　肩に、\nちいさな　きのこが　生えていた。"),
		s(
			"zero",
			"きのこに　押し上げられて　きたんですか？\n……胞子、保存しておきますね",
		),
	],
	tropical: [
		n("キリコの　服は、\nまだ　しおからかった。"),
		s("feris", "島の　人たちに　送ってもらったの〜？\n……いいな〜、小舟〜"),
	],
	konamono: [
		n("キリコの　髪は、\nソースと　焦げの　においが　した。"),
		sOr(
			s("nanj", "……焦げくさっ。\n鉄板が　噴火でも　したんか？"),
			s("roze", "……焦げくさいアル。\n鉄板の　火加減も　常識アル"),
		),
	],
	festival: [
		n("遠くで、神輿の　かけ声が\nまだ　聞こえていた。"),
		s(
			"shiyo",
			"……神輿で　運ばれて　きたの？\nべ、べつに　うらやましく　ないわよ",
		),
	],
};

/**
 * ボスを たおして どう 帰ったか（冒険の記録の 札・リプレイの 終わりに「（品）ごと、〜」で 出す）。
 * 帰り方の 行は core/data/dungeons.ts の boss.lines。
 */
export const BOSS_HOME: Partial<Record<DungeonId, string>> = {
	shallow: "パン兵たちに　かつがれて　帰った",
	main: "湯柱に　押し上げられて　帰った",
	kinoko: "きのこに　押し上げられて　帰った",
	tropical: "島民の　小舟で　送ってもらった",
	konamono: "鉄板の　噴火で　吹き飛ばされた",
	festival: "神輿に　のせられて　帰った",
};

// ───────────────── 次が開いたとき ─────────────────
/**
 * 持ち帰って 次のダンジョンが開いたときの ひとこと（ending のあと・記録の札の前に）。
 * relief は パン板 で10回 倒れて 本編が開いたとき（パン板の ネタは シヨが 貼っておく）。
 */
export const UNLOCK_LINES: Record<
	"main" | "deep" | "relief" | "colony" | "hidden",
	readonly Line[]
> = {
	main: [
		q("nanj", "約束や。風呂板、行ってええで。\n……のぼせんなよ"),
		q(
			"zero",
			"風呂板への　入口、開きました！\nゼロ、いっしょには　行けませんが……",
		),
	],
	deep: [
		q("zero", "電池板から、音が　します。\n……サブ機たちも、ビリビリ　してます"),
		q("nanj", "電池板て　なんやねん。\n……延長戦や。延長戦"),
	],
	relief: [
		q(
			"shiyo",
			"パン板の　ネタは　あたすが　貼ったわ。\n……あなたの　ためじゃ　ないから",
		),
		q("zero", "10回の　挑戦、ぜんぶ　見てました。\n……11回目も、応援します！"),
	],
	// 隠しの 過去ログの底（保守村の 下の 古井戸）
	hidden: [
		q("zero", "村の　古井戸から、音が　します。\n……いちばん　下から、です"),
		q("nanj", "過去ログの底や。\n……行くんやったら、読ませてや"),
	],
	// 口の ない 植民地（{name} は 板の 名前）。口から 一覧で 行ける
	colony: [
		q("zero", "新しい　植民地が　見つかりました！\n{name}、です"),
		q(
			"nanj",
			"おんJ民、どこにでも　住みつくな。\n……口から　えらんで　行けるで",
		),
	],
};

/**
 * 寄り道の 植民地が 開く ときの 小さな 出来事：その 板の 名無しが 村の 口から 歩いてきて、キリコに 板の ようすを
 * 話し、帰っていく（ui/villageReturn.ts の visitScript）。who が "visitor" は その 名無し、null は 地の文。
 * 名無しは 1人で 来て キリコとだけ 話す（離れた 仲間は 出てこない）。
 */
export const UNLOCK_VISIT: Partial<
	Record<DungeonId, readonly { who: "visitor" | null; text: string }[]>
> = {
	kinoko: [
		{
			who: null,
			text: "村の　口から、だれか　来た。\n頭に　きのこが　生えている。",
		},
		{
			who: "visitor",
			text: "きのこ板から　来たで。\nパン板の、そのまた　植民地や",
		},
		{
			who: "visitor",
			text: "親玉きのにゃんが　居座っとる。\n……だれか、どかしてくれんか",
		},
		{ who: null, text: "名無しは　きのこを　1本　置いて、\n帰っていった。" },
	],
	tropical: [
		{ who: null, text: "村の　口から、だれか　来た。\n潮の　においが　する。" },
		{ who: "visitor", text: "離島板の　島民や。\n総島民　6人の、うちの　1人" },
		{
			who: "visitor",
			text: "ナツコが　怒って　山に　こもった。\n……小舟、出しとくで",
		},
		{ who: null, text: "名無しは　ヤシの　葉を　ふって、\n帰っていった。" },
	],
	konamono: [
		{
			who: null,
			text: "村の　口から、だれか　来た。\nソースの　においが　する。",
		},
		{
			who: "visitor",
			text: "おんたこから　来たで。\n……ちょっと　腹　立っとるけど",
		},
		{
			who: "visitor",
			text: "たこのみんが　ビルの　上で\n大きなって　もうたんや",
		},
		{
			who: null,
			text: "名無しは　怒った　顔の　まま、\nていねいに　おじぎして　帰った。",
		},
	],
	festival: [
		{ who: null, text: "村の　口から、太鼓の　音が\nちかづいてくる。" },
		{ who: "visitor", text: "祭りや　祭りや！\nお祭り会場から　来たで" },
		{
			who: "visitor",
			text: "マシーの　親分が　やぐらから\n降りてこん。祭りが　終わらんのや",
		},
		{ who: null, text: "名無しは　うちわを　あおぎながら、\n帰っていった。" },
	],
};

// ───────────────── 起動の札と 村の ひとこと ─────────────────
/** 持ち帰ったあと（ダンジョンごと）。 */
export const CLEAR: Record<DungeonId, readonly Line[]> = {
	shallow: [
		q("nanj", "パン板の　ネタ、伸びとるで。\n……ほな、次は　本番やな"),
		q("roze", "パン板でも、下は　下アル。\n……おつかれアル"),
		q(
			"feris",
			"ネタ、見つかって　よかったね〜。\n私、目が　いいから　見えてたよ〜",
		),
		q("shiyo", "パン板、でしょ。……ふん。\nま、まあ、よく　やったんじゃない"),
		q(
			"zero",
			"植民地化宣言、30レス　つきました！\n……ケーキは、焼けませんでした",
		),
	],
	main: [
		q("nanj", "長湯スレ、また　伸びとる。\n……のぼせんなよ、みんな"),
		q("roze", "おかえりアル。……蓄音機、\nずっと　まわってるアル"),
		q("feris", "長湯スレ、もう1回　きこ〜。\n……もう1回だけ〜"),
		q("shiyo", "知らない　人が　書きこんでるわ。\n……まあ、わるくないわよ"),
		q("zero", "長湯スレ、今日も　読みました。\n……閲覧数、ゼロが　1位です"),
	],
	deep: [
		q(
			"nanj",
			"鉄塔の　てっぺんまで　行った子、\nワイが　名付けたんやで（自称）",
		),
		q("roze", "村、人で　いっぱいアル。\n……麻婆豆腐、足りないアル"),
		q("feris", "看板、ほめられた〜。\n……知らない　人に〜"),
		q("shiyo", "……やきうの　ばか。\nべ、べつに　気に　してないわよ"),
		q("zero", "1000まで、あと　すこしです。\n……でも、ゼロは　まだ　数えます"),
	],
	kinoko: [
		q("zero", "きのにゃん、まだ　蓄音機の\n上です。……どいて　くれません"),
		q("nanj", "植民地の　植民地や。\n……どっちが　えらいねん"),
	],
	tropical: [
		q("feris", "ヤシの実、波の　音　した〜。\n……たぶん〜"),
		q("roze", "島民が　7人に　なったアル。\n……キリコも　数えたアル"),
	],
	konamono: [
		q("nanj", "たこ焼き、うまかったで😡\n……あ、勝手に　ついた"),
		q("roze", "麻婆豆腐に　たこ、\n……入れて　みたアル"),
	],
	festival: [
		q("shiyo", "うちわ、あたすが　あずかってるわ。\n……使っては　ないわよ"),
		q("nanj", "祭りのあとの　うちわや。\n……ええ　祭りやった"),
	],
	hidden: [
		q("roze", "小屋の　前の　札、\n……毎朝　だれかが　見てるアル"),
		q("zero", "スレに、外からの　書きこみが\nあります。……「保守」だけ、です"),
		q("shiyo", "……あの　ばか、外で\nちゃんと　ごはん　食べてるのかしら"),
		q("feris", "やきうくんの　ぶんも、\n私が　おかえり　言うね〜"),
	],
};

/** まだ一度も もぐっていない（パン板の ネタを 取りにいく前）。quotes.ts の FIRST の パン板 版。 */
export const FIRST_SHALLOW: readonly Line[] = [
	q("nanj", "パン板やで。パン松が　おるで。\n……ほな、上で　保守しとくわ"),
	q("roze", "ネタは　底に　あるアル。\nよく　見て　さがすアル。常識アル"),
	q("feris", "パン板なら、私も\n飛んで　行けるかな〜。……行かないけど〜"),
	q("shiyo", "心配なんか　してないわよ。\n……ちゃんと　帰って　きなさいよね"),
	q(
		"zero",
		"いってらっしゃいの　練習、\n100回　しました。……いってらっしゃい！",
	),
];

/** パン板で倒れたとき（たおれ方の たまりより 前に見る）。 */
export const SHALLOW_DEATH: readonly Line[] = [
	q("nanj", "パン板やで？　入門の。\n……いや、パン板でも　下は　下か"),
	q("roze", "パン板は　ちいさいアル。\nあわてないのが　常識アル"),
	q("feris", "パン板でも、ころぶよね〜。\n私も　よく　ころぶ〜"),
	q("shiyo", "杖は、ふるまで　わからないの。\n……教えて　あげたんだからね"),
	q("zero", "パン板の　ログ、読みました。\n……短いけど、ゼロは　好きです"),
];
