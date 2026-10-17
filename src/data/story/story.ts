// 植民地（ダンジョン）の物語の部品。
// - 名前と板の決まり・見た目と曲、目的の品、はじめて入る前の語り（intro）と 持ち帰ったあとの語り（ending）、
//   ボスを たおして 一瞬で 帰ったときの 語り（BOSS_RETURN）、
//   次のダンジョンが開いたときの ひとこと、起動の札と 村の ひとことの たまり。
// - 本編（main）の intro / ending は quotes.ts の INTRO / ENDING をそのまま使う。
// 筋は STORY.md §4.9「おんJの 板を めぐる 話」。キリコも 会話に 加わる（吾輩・ンゴ。望みは 台詞で 言う）。
// 1行は全角22字・2行まで。笑いが 先、シリアスは 落差で（STORY.md §0）。

import type { DungeonId } from "../../core/types";
import type { Story } from "../../engine/defs";
import { type Cue, cueOf } from "../../engine/emote";
import {
	ENDING,
	ENDING_AGAIN,
	INTRO,
	type KirikoMode,
	SPEAKERS,
	type Speaker,
	type StoryPage,
} from "./quotes";

export type { StoryPage };

/** 仲間の ひとこと（起動の札・村・開いたときの ひとこと）。 */
export type Line = { who: Speaker; text: string } & Cue;

/** 語りの 1ページを 窓に 出す（仲間の セリフ・ナレーション・キリコの 独白）。 */
export const playPage = (
	st: Story,
	p: {
		who: Speaker | null;
		text: string;
		kiriko?: KirikoMode;
		nanashi?: string;
	} & Cue,
): Promise<void> =>
	p.kiriko
		? st.kiriko(p.text, p.kiriko, cueOf(p))
		: p.nanashi
			? st.say("nanj", p.text, { name: p.nanashi })
			: p.who
				? st.say(p.who, p.text, cueOf(p))
				: st.narrate(p.text);

// ───────────────── 村に いない 仲間（まだ 来ていない） ─────────────────
/** 仲間が 村に 来る 町の 段（みんな はじめから 町に いる。町は はじめから 都市の 姿：TOWN.md §0.1）。 */
export const FRIEND_FROM: Record<Speaker, number> = {
	nanj: 0,
	roze: 0,
	zero: 0,
	feris: 0,
	shiyo: 0,
};

/**
 * 村に いない 仲間（まだ 来ていない：stage が FRIEND_FROM より 前）。だれも 村から 出ていかない。
 * いない 人は 村に 立たず、語り・知らせ・喫茶・起動の札でも 話さない。stage を 省くと いちばん上の 段（みんな 来ている）。
 * cleared は 呼ぶ 側と 形を そろえる ため（いまは 見ない）。
 */
export const awayFriends = (
	_cleared: readonly DungeonId[],
	stage = Number.POSITIVE_INFINITY,
): Speaker[] =>
	(Object.keys(FRIEND_FROM) as Speaker[]).filter((w) => stage < FRIEND_FROM[w]);

/**
 * 文に 村に いない 仲間の 名前が 出てくるか（まだ 越してきていない 人の 話を しない）。
 * 「フェリスちゃん」「ゼロさん」なども 名前を ふくむので 数える。
 */
export const mentionsAway = (text: string, away: readonly Speaker[]): boolean =>
	away.some((w) => text.includes(SPEAKERS[w].name));

/** 村に いない 人が 話す・出てくる（名前を 呼ばれる）ページか。 */
const gone = (p: StoryPage, away: readonly Speaker[]): boolean =>
	(!!p.who && away.includes(p.who)) ||
	(!!p.about && away.includes(p.about)) ||
	mentionsAway(p.text, away);

/** 話す 人（地の文なら 出てくる 人）が 村に いないか（かわりの 頁を 選ぶ とき）。 */
const speakerGone = (p: StoryPage, away: readonly Speaker[]): boolean =>
	(!!p.who && away.includes(p.who)) || (!!p.about && away.includes(p.about));

/** 村に いない 人の ページを かわりに かえる（かわりが 無ければ 出さない）。だれも いなければ そのまま。 */
export const withoutAway = (
	pages: readonly StoryPage[],
	away: readonly Speaker[],
): readonly StoryPage[] =>
	away.length
		? pages.flatMap((p) => {
				// かわりの 頁の 人も いなければ、その かわりへ（なければ 出さない）。keep（自分が かわり）は そのまま 出す
				// （かわりの 頁は 話す 人が いれば よい：文に 名前が 出るのは 書いた 人の つもり。例「やきう民、いないんだ」）
				if (!gone(p, away)) return [p];
				let q: StoryPage | undefined = p.instead;
				for (let hop = 0; q && speakerGone(q, away) && hop < 4; hop++)
					q = q.instead;
				return q ? [q] : [];
			})
		: pages;

/**
 * 持ち帰りの 語り。一度きりの 出来事（電池板・過去ログの底・おーぷぬ）は 見おえたら again に かわる。
 * 出来事に 出てくる 人が もう 村に いなければ（かわりの 頁も 無ければ）、はじめから again。
 */
export const endingFor = (
	d: DungeonId,
	seen: boolean,
	away: readonly Speaker[],
	cleared: readonly DungeonId[] = [],
): readonly StoryPage[] => {
	const { ending, again, once } = STORY[d];
	// 持ち帰って いない 板の 頁（寄り道「残機」の 最終話の 頁）は 出さない
	const here = (pages: readonly StoryPage[]) =>
		pages.filter(
			(p) =>
				(!p.needCleared || cleared.includes(p.needCleared)) &&
				!(p.unlessCleared && cleared.includes(p.unlessCleared)),
		);
	// はじめての ときだけ うしろに 足す 頁（寄り道の 板の 去った 人の レス）
	const main = here(!seen && once ? [...ending, ...once] : ending);
	return again && (seen || main.some((p) => gone(p, away) && !p.instead))
		? here(again)
		: main;
};

/**
 * 本筋の 話数（2026-10-14 作者：本筋を 太く。ポケダンの 章立て）。はじめて 潜る ときの 語りの 前に 題の 札、
 * はじめて 持ち帰った 語りの おわりに「〜　完」（ui/village/villageEvents.ts の departTo・villageReturn.ts の pagesFor）。
 * 寄り道・裏の 板には つけない（本筋だけが 話数で 進む）。
 */
export const EPISODES: Partial<
	Record<DungeonId, { no: string; title: string }>
> = {
	shallow: { no: "第一話", title: "独立宣言" },
	kinoko: { no: "第二話", title: "きのこの行進" },
	main: { no: "第三話", title: "41.5℃" },
	deep: { no: "最終話", title: "盛らない見出し" },
	hidden: { no: "後日談", title: "いちばん古いレス" },
};

/** 話の おわりの 1窓（はじめて 持ち帰った とき。章の 音と いっしょに）。 */
export const episodeEnd = (d: DungeonId): StoryPage | null => {
	const e = EPISODES[d];
	return e
		? { who: null, text: `${e.no}「${e.title}」完`, cue: "chapterEnd" }
		: null;
};

/**
 * 潜る ときの 名無しの 書きこみ（港の 掲示板。口で 行き先を 決めた あと）。最終話（電池板）までは 毎回 同じ
 * 「いってら」（名無しの 正体は やきう。STORY.md §4.9）。最終話の あとは free から 毎回 ちがう 一言。
 */
export const DEPART = {
	/** 最終話までは 毎回 同じ（同じ 一言の くり返しが 転の 伏線）。 */
	nanj: "港の掲示板に、書きこみが1つ。\n名無し：いってら",
	/** 最終話（電池板を 持ち帰った）の あと。潜った 回数で 回す。 */
	free: [
		"港の掲示板に、書きこみが1つ。\n名無し：いってら。今日は盛らんで",
		"港の掲示板に、書きこみが1つ。\n名無し：いってら。草野球の合間や",
		"港の掲示板に、書きこみが1つ。\n名無し：見とるで。昼寝しながらな",
		"港の掲示板に、書きこみが1つ。\n名無し：今日の見出しは、まだ白紙や",
		"港の掲示板に、書きこみが1つ。\n名無し：いってら。人、おるで",
	],
	/** 村に 帰って 持ち物が からっぽの とき、ぷゆゆパンを 持たせる 地の文（ぷゆゆは 村から 去らない）。 */
	puyu: "ぷゆゆがかけてきて、\nぷゆゆパンを持たせてくれた。",
	/** ぷゆゆソードを 渡した すぐ あとで、もう となりに いる とき（かけてこない）。 */
	puyuToo: "ぷゆゆは、ぷゆゆパンも\n持たせてくれた。",
} as const;

/**
 * 寄り道「残機」（STORY.md §4.9）：やきうの 頭の 上の 数を 本人が 言う。きのこ板（「残機：1」が 出た）から 最終話まで は 1
 * （名無しには 残機が ふえない）。最終話の あとは、遺影祭り（お祭り会場）を 持ち帰って いれば 99（最終話の 祭りで
 * 板の 人たちが 遺影を 書いて、やっと 数に なった）。
 */
export const zankiLine = (cleared: readonly DungeonId[]): string | null =>
	!cleared.includes("kinoko")
		? null
		: !cleared.includes("deep")
			? "……頭の上の「残機：1」か。\n気にすんな"
			: cleared.includes("festival")
				? "頭の上、「残機：99」や。\n……多すぎて、使い道がないわ"
				: null;

/** c は 話す 人の 感情の 記号・体の 動き（engine/emote.ts。話す 人が 村に 立って いる ときだけ 見える）。 */
const q = (who: Speaker, text: string, c?: Cue): Line => ({ who, text, ...c });
const n = (text: string): StoryPage => ({ who: null, text });
const s = (who: Speaker, text: string, c?: Cue): StoryPage => ({
	who,
	text,
	...c,
});
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
/** キリコの 声（みんなに 聞こえる。仲間も 返事を する）。 */
const k = (text: string): StoryPage => ({ who: null, text, kiriko: "voice" });
/** キリコの 独白（（　）で 出る。だれも いない 場面だけ）。 */
const think = (text: string): StoryPage => ({
	who: null,
	text,
	kiriko: "think",
});
/** 名無しの 1窓（名前欄だけ）。 */
const nanashi = (name: string, text: string): StoryPage => ({
	who: null,
	text,
	nanashi: name,
});
/** パン板の 持ち帰り（毎回）。はじめての ときは この あとに やきうの ひとこと。 */
const SHALLOW_BASE: readonly StoryPage[] = [
	n("村に帰りつくと、広場の旗が\nおろされていた。"),
	// 迎えの 掛け合いは 2〜3人まで（だれが だれか 知らない 人が 流し読み しないように）。ボケ（ゼロ）→ ツッコミ（ロゼ）
	s("zero", "パン兵さん、帰っていきました！\n3人です。数えました！", {
		emote: "!",
	}),
	s("roze", "見ればわかるアル。\n独立は、書類で申請するアル", {
		emote: "汗",
	}),
];

/**
 * 転（STORY.md §4.9）：風呂板の 語りを 見おえた 帰りに 1回だけ（ui/village/villageReturn.ts の tenScript）。
 * 町の 電気は 電池板から 来て いた。停電と、また 盛った 見出し。見出しの 名無しが 毎回 同じ 人だと 気づく。
 */
export const TEN_NEWS = {
	pages: [
		n("その夜、町じゅうの明かりが\nいっせいに消えた。"),
		s("zero", "停電です！町の電気、\nぜんぶ電池板から来てました", {
			emote: "!",
		}),
		s("roze", "植民地から電気を借りてたアル？\n……払ってないのが常識アル", {
			emote: "汗",
		}),
		n("掲示板に、名無しの見出し。\n『おんJタウンしゅうりょう』"),
		s("shiyo", "また盛ってる。……この見出し、\n毎回同じ人よね"),
		s("feris", "電池板の人、ひとりで\nがんばってるのかも〜"),
		k("電池板、充電しに行くンゴ"),
		s("nanj", "おう。停電で\nナイター見れんしな", { emote: "…" }),
	],
} as const;

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
		mascot: "パン松|｀°Ο°´|",
		rules: [
			"いちばん栄えた植民地。入門の3階",
			"パン松の縄張り：パンがよく出る",
			"杖だけ未識別。のろいなし。2階でパレード",
		],
	},
	main: {
		name: "風呂板",
		short: "風呂板",
		nick: "おふJ",
		mascot: "おふ郎くん[o'ω'f]",
		rules: [
			"植民地でいちばん雰囲気がええ。12階",
			"湯治：HPの自然回復が1.5倍",
			"帰還スレが出る：途中で帰れる",
		],
	},
	deep: {
		name: "電池板",
		short: "電池板",
		nick: "でんJ",
		mascot: "でんちゃん　{+'w'-]",
		rules: [
			"過疎で謎が多い植民地。16階",
			"充電：杖が1回多い。スレが早く埋まる",
			"ぜんぶ未識別。ぷゆゆパンは出ない。罠と祭りが多い",
		],
	},
	kinoko: {
		name: "きのこ板",
		short: "きのこ板",
		nick: "きのこ",
		mascot: "きのにゃん[ｷ・Д・ﾉ]",
		rules: [
			"パン板が植民した、植民地の植民地。5階",
			"きのこの当たり外れ：草が多い。毒も多い",
			"草と杖が未識別。のろいはない",
		],
	},
	tropical: {
		name: "離島・沖縄板",
		short: "離島板",
		nick: "おんトロ",
		mascot: "ココ・ナツコ~｀i,/ ﾟヮﾟﾉヽi´~",
		rules: [
			"総島民6人の島。7階",
			"過疎：敵も道具も少ない",
			"ぜんぶ未識別。祭りはない",
		],
	},
	konamono: {
		name: "おんたこ",
		short: "おんたこ",
		nick: "たこ焼き板",
		mascot: "たこのみん∬*ﾟ ヮﾟル",
		rules: [
			"レスの末尾に😡がつく板。10階",
			"😡：どの敵も弱ると怒って倍速",
			"ぜんぶ未識別",
		],
	},
	festival: {
		name: "お祭り会場",
		short: "お祭り",
		nick: "おまC",
		mascot: "マシー(o M c)",
		rules: [
			"猛虎弁の使える雑談板。10階",
			"祭り：3階から2つに1つの階が祭り",
			"ぜんぶ未識別",
		],
	},
	// 隠し（電池板を 持ち帰ると 開く）。植民地では なく、おんJ（おんJタウン）の 真下
	hidden: {
		name: "過去ログの底",
		short: "ログの底",
		nick: "おんJの真下",
		mascot: "1001（どのスレも最後はこれ）",
		rules: [
			"おんJタウンの下の古井戸。99階",
			"層ごとに景色と曲がかわる",
			"底の品を持ったまま帰還スレで帰れる",
		],
	},
	mercury: {
		name: "なんでも実況（マーキュリー）",
		short: "マーキュリー",
		nick: "水星",
		mascot: "水星の名無し",
		rules: [
			"おんJに飽きた人のほのぼの板。6階",
			"宝の板：道具が多く、罠は安価だけ",
			"祭りもない。敵は少ない",
			"HPの自然回復がはやい。杖だけ未識別",
		],
	},
	onmu: {
		name: "なんでも実況（ムー大陸）",
		short: "おんMu",
		nick: "おんMu",
		mascot: "ムーミン谷の名無し§^ム^§",
		rules: [
			"呑気なおんJを求めて作られた板。7〜17階",
			"沈む大陸：底の深さが潜るたびにかわる",
			"過疎：敵も道具も少ない。草・スレ・杖が未識別",
		],
	},
	onkimu: {
		name: "おんキム",
		short: "おんキム",
		nick: "キムチ板",
		mascot: "キムりん🌶",
		rules: [
			"キムチを愛する板から始まった。10階",
			"植民地戦争の最前線：1階から敵が強い",
			"倉庫の装備で挑め。祭りが多い。ぜんぶ未識別",
		],
	},
	inferno: {
		name: "†ダークネスインフェルノ†板",
		short: "†闇の板†",
		nick: "中二病専用板",
		mascot: "†名も無き暗黒の使い†",
		rules: [
			"邪気眼に魅入られし者の塔。50階",
			"†闇の試練†：倉庫の道具は持ちこめない",
			"魔導書を持ったまま帰還スレで帰れる",
			"杖の回数が1　多い。ぜんぶ未識別。解呪スレが多い",
		],
	},
	// 束音ロゼの 依頼（engine/heroes.ts）
	vocalo: {
		name: "ボカロ作り避難所",
		short: "ボカロ避難所",
		nick: "ロゼの避難先",
		mascot: "文字化け",
		rules: [
			"荒らされた総合スレの避難所。6階",
			"文字化けが多い。荒らしが追ってきた",
			"草と杖が未識別。のろいはない",
		],
	},
};

/** ui/dungeon/theme.ts の Theme.name。 */
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

/** 植民地の 見た目と 曲（板ごとに 1つ。全フロア 同じ。ui/dungeon/theme.ts が 読む）。 */
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
		note: "「見出し、まだ？」",
		theme: "stone",
		bgm: "stone",
		ambient: "dust",
	},
	{
		last: 15,
		name: "埋もれた dat",
		note: "「今年もやきうか。草」",
		theme: "stone",
		bgm: "deep_dat",
		ambient: "dust",
	},
	{
		last: 20,
		name: "苔むしたスレ跡",
		note: "「ほな、来年も」",
		theme: "moss",
		bgm: "field",
		ambient: "spores",
	},
	{
		last: 25,
		name: "崩れたまとめ",
		note: "「予定：毎日ナイター」",
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
		note: "「このスレは凍結されました」",
		theme: "crystal",
		bgm: "deep2",
		ambient: "snow",
	},
	{
		last: 50,
		name: "白紙の回廊",
		note: "「」",
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
		note: "「規制で書けん。保守だけ頼む」",
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
		note: "「見出し、燃やしといたで」",
		theme: "forge",
		bgm: "deep_koge",
		ambient: "embers",
	},
	{
		last: 98,
		name: "炎上の底",
		note: "「次スレ立てられる人おる？」",
		theme: "lava",
		bgm: "deep5",
		ambient: "embers",
	},
	{
		last: 99,
		name: "1001",
		note: "「このスレッドは1000を超えました」",
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
	// 回路の 床（漏電の 火花）。過疎の 板なので 落ちついた 曲（嬰ハ短調 110。エレピ・ビブラフォン・シンセベースが 回路に 合う。
	// もとは 夜の コインランドリー。その 前の retro は 戦闘曲っぽかった）
	deep: { theme: "cyber", bgm: "speder2", ambient: "data" },
	// 苔と 胞子。地下の 菌床（曲は ずれる 地層）
	kinoko: { theme: "moss", bgm: "deq_strata", ambient: "spores" },
	// 砂浜と 南国の 緑（水晶の 洞窟では 島に 見えないので）。水の しずく
	// （曲は ニ長調 131 の ビブラフォン・チェレスタの 明るい サビ。もとは 水底に さす 光＝deq_sea）
	tropical: { theme: "beach", bgm: "island", ambient: "glitter" },
	// 鉄板の 焦げ。どの 敵も 怒りっぽい 板なので 張りつめた 曲（ヘ短調の バイオリンと 矩形波の 分散和音。もとは 活火山の 底）
	konamono: { theme: "lava", bgm: "fukyowa", ambient: "embers" },
	// 提灯の 赤。祭りが よく 出る 板なので 速い ダンスの 曲（もとは 隠しの 規制の檻と 同じ 都節の 曲）
	festival: { theme: "lattice", bgm: "kouseki", ambient: "glitter" },
	// 隠し：層ごとに かわる（theme・bgm は 層が 無い ときの 予備）
	hidden: {
		theme: "earth",
		bgm: "deep1",
		ambient: "dust",
		zones: HIDDEN_ZONES,
	},
	// ボカロ作り避難所：荒らしの あとの 静かな 避難所（電子の 格子）
	vocalo: { theme: "lattice", bgm: "tekitou", ambient: "data" },
	// 水星の 名無しの 板：青白い 水晶と 氷の 曲
	mercury: { theme: "crystal", bgm: "mercury", ambient: "glitter" },
	// 沈んだ ムー大陸：水底の 遺跡（水底に さす 光）
	onmu: { theme: "ruins", bgm: "deq_mu", ambient: "spores" },
	// キムチの 赤：張りつめた 曲
	onkimu: { theme: "forge", bgm: "kimchi", ambient: "embers" },
	// 闇の 塔：短調の バイオリン
	inferno: { theme: "cyber", bgm: "inferno", ambient: "data" },
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
		/** はじめて 持ち帰った ときだけ ending の あとに 足す 頁。 */
		once?: readonly StoryPage[];
	}
> = {
	shallow: {
		intro: [
			// 前口上は 最初の 村（data/town/town.ts の OPENING）で 見せたので、ここは 中の 決まり
			// 黒い 画面は 2枚まで（最初に 動けるまでを 短く）
			"1歩すすむと、下のものたちも1歩。\nたおれたら、持ち物もレベルもなくす。",
			// 階が スレで 1000 で 終わる わけ
			"階は、1本のスレ。動くたび、レスがつく。\n……1000まで埋まると、次のスレへ。",
		],
		ending: [
			...SHALLOW_BASE,
			// 見出しの 名無し（転と 頂点の 前ぶれ）
			k("吾輩も独立するンゴ。\n国旗は、蓄音機ンゴ"),
			s("nanj", "国民ひとりやんけ"),
			s(
				"nanj",
				"なんや、パン1枚で片づいたんか。\n見出しのほうが、おもろかったな",
			),
			k("あの見出し、\nだれが書いたンゴ？"),
			s("nanj", "さあな。名無しやろ", {
				emote: "…",
			}),
		],
		again: SHALLOW_BASE,
	},
	main: { intro: INTRO, ending: ENDING, again: ENDING_AGAIN },
	deep: {
		intro: [
			"電池板。でんちゃんの板。\n人が残らなかった、植民地。",
			"鉄塔のてっぺんに、\n町の主電源があるという。",
			"キリコは蓄音機をかかえた。",
			"……でん、と鳴った。",
		],
		ending: [
			// 頂点（STORY.md §4.9「明かりの もどる 坂と、盛らない 見出し」）
			n(
				"村に帰りつくと、港は真っ暗だった。\n坂の上まで、明かりがひとつもない。",
			),
			// 明かりの もどる 坂（ui/village/villageReturn.ts の playCue。暗い 町で 生き返った 通りを 順に 見せて、
			// 明るい 町に 建て直す）
			{
				...n(
					"キリコが坂を上がると、生き返った\n通りに、明かりがひとつずつともった。",
				),
				cue: "lightsUp",
			},
			// 広場の 祭り：来る 人は 持ち帰った 板で きまる（本筋の 3つは かならず）
			n("広場に、板の人たちが集まってきた。\nパン兵、きのこ軍、42℃の番頭。"),
			{ ...n("浜から、島民たちも上がってきた。"), needCleared: "tropical" },
			{
				...n("たこ民が、たこ焼きを配っている。\n……どれも😡の顔だ。"),
				needCleared: "konamono",
			},
			{
				...n("やぐらの上で親分が太鼓をたたいた。\n「祭りや！」"),
				needCleared: "festival",
			},
			n("電池ニキが明かりを見上げた。\n「……人、おるな」"),
			n("やきうは掲示板の前で、\n書きかけて手を止めた。"),
			{ ...n("『【朗報】人おった』"), se: "read" },
			k("……盛ってないンゴ"),
			s("nanj", "……盛るまでもないわ", { emote: "…" }),
			// 寄り道「残機」の 回収（遺影祭りを 持ち帰って いれば）：親分の 号令で 板の 人たちが 遺影を 書いて、やっと 数に なる
			{
				...n("親分が、うちわでやきうを指した。\n「ほな、遺影祭りや！」"),
				needCleared: "festival",
			},
			{
				...n("板の人たちが、掲示板に\nやきうの遺影を書きはじめた。"),
				needCleared: "festival",
				se: "pencil",
			},
			{
				...n("1UPの音が、鳴りやまない。\n……98回鳴った。「残機：99」"),
				needCleared: "festival",
				se: "arcBest",
				seRepeat: 7,
				seGap: 180,
			},
			{
				...s("zero", "書きこみ98件。正体がバレて、\n宛先が通ったみたいです", {
					emote: "!",
				}),
				needCleared: "festival",
			},
			{
				...s("nanj", "……みんな、書いとって\nくれたんやな", { emote: "…" }),
				needCleared: "festival",
			},
			{
				...s("nanj", "うるさいわ！……草", { emote: "怒" }),
				needCleared: "festival",
			},
			// 落差の オチ（201 の 作者が ゲームを 閉じる 型）
			n("祭りの最中、掲示板に\n管理人の書きこみがついた。"),
			n("『鯖代払い忘れとったわ』"),
			{ ...n("……町じゅうが、まっくらになった。"), se: "batonDown" },
			n("翌朝。町は、何事もなかったように\nもとにもどっていた。"),
			n("掲示板に、見出しがひとつ。\n『【悲報】ワイらの冒険、ロールバック』"),
			n("その下に、書きこみがひとつ。\n「キリコ生きてて草」"),
		],
		again: [
			n("村に帰りつくと、\n町は今日も明るかった。"),
			s("nanj", "おかえり。\n……今日の見出しは盛らんとくわ"),
		],
	},
	kinoko: {
		intro: [
			"きのこ板。\nパン板に植民された、植民地の植民地。",
			"町を行進していったきのこ軍は、\nここから出てきたらしい。",
			"行進の行き先は、\nまだだれも知らない。",
			"キリコは蓄音機をかかえた。\n……行進の足音が、下からする。",
		],
		ending: [
			n("村に帰りつくと、\nゼロがかけよってきた。"),
			// ボケ（ゼロ）→ すぐ ツッコミ（キリコ）
			s("zero", "キリコさん、頭にきのこが\n生えてます！数えますか？", {
				emote: "!",
			}),
			k("数えんでええンゴ！"),
			n("商店街のまんなかで、\nきのにゃんがふんぞりかえっていた。"),
			s("zero", "倉庫、封鎖してすみません。\n見出し、128回読んで信じました", {
				emote: "汗",
			}),
			k("読みすぎンゴ！"),
		],
		// 行進の オチと、寄り道「残機」の 入口
		once: [
			n("行進は、パン板の独立記念セールで\n買い物をして帰っていったらしい。"),
			s("roze", "仕返しの途中で、\nセールに寄るなアル", {
				emote: "汗",
			}),
			n("やきうの頭の上に、小さく\n「残機：1」と出ていた。"),
			{ ...k("……その数字、\nなにンゴ？"), about: "nanj" },
			s("nanj", "……気にすんな。\n昔からや", {
				emote: "…",
			}),
		],
	},
	tropical: {
		intro: [
			"離島・沖縄板。\n総島民は、6人。",
			"浜に押しかけてきた島民を、\n山の上の集落まで送り返す。",
			"うわさでは、島の山の上に\n1UPがひとつあるという。",
			"キリコは蓄音機をかかえた。\n……波の音が、下からする。",
		],
		ending: [
			nAbout(
				"村に帰りつくと、\nフェリスが手をふっていた。",
				"feris",
				"村に帰りつくと、\n潮のにおいがついてきた。",
			),
			s("feris", "ヤシの実〜！ねえ、\n耳にあてたら波の音する〜？", {
				gesture: "hop",
			}),
			n("キリコはヤシの実を蓄音機に\nのせてみた。……回らない。"),
			s("roze", "それはレコードじゃないアル。\n……割って飲むのが常識アル"),
			// 総島民 6人（分母 6）
			n("割ると、中からナツコの手紙。\n「島民6人、全員ぶじに帰りました」"),
			s("zero", "生還率、100％です！\n……分母が、6ですけど", { emote: "汗" }),
		],
		// 寄り道「残機」①：1UP は にせもの（ナツコの 自由研究）
		once: [
			n("ヤシの実に、マジックで\n「1UP」と書いてあった。"),
			s("feris", "それ、ナツコちゃんの字〜。\n夏休みの自由研究だよ〜", {
				emote: "汗",
			}),
			s("nanj", "にせもんか。草"),
			{ ...k("……残機、どうやったら\nふえるンゴ？"), about: "nanj" },
			s("nanj", "さあな。……昔は、勝手に\nふえとったんやけどな", { emote: "…" }),
		],
	},
	konamono: {
		intro: [
			"おんたこの雑居ビル。\nレスの末尾に、😡がつく板。",
			"招待状の末尾にも、😡。\n……宣戦布告、らしい。",
			"キリコは蓄音機をかかえた。\n……上の階から、ソースのにおいがする。",
		],
		ending: [
			nAbout(
				"村に帰りつくと、\nやきうが鼻をひくつかせていた。",
				"nanj",
				"村に帰りつくと、\nロゼが鼻をひくつかせていた。",
			),
			s(
				"nanj",
				"たこ焼きやんけ！😡の顔しとる。\nやきう→猛虎弁→大阪→たこ焼きや",
				{ emote: "!" },
			),
			s("roze", "麻婆豆腐といっしょに\n出すアル。……合わないアル？", {
				emote: "?",
			}),
			// 招待状の 😡（怒って いるのでは なく たこ焼きの 顔）。紙は 舟の 底（once の 包み紙＝帳簿とは べつ）
			n("舟の底に、粉もん奉行の字。\n「次の招待状も、末尾に😡」"),
			k("みんなにやさしい招待状に\nするンゴ😡"),
			s("nanj", "怒っとるようにしか\n見えへん。草"),
		],
		// 寄り道「残機」②：名無しの 帳簿。残機の 正体は 遺影スレの 書きこみ
		once: [
			{
				...n("たこ焼きの包み紙は、\n古い帳簿の切れはしだった。"),
				se: "read",
			},
			n("「名無し残機1　やきう」\n「名無し残機1　やきう」……毎年。"),
			s("roze", "……名無しには、\n残機がふえないアル？", { emote: "!" }),
			s("nanj", "……せや。名前がないと、\nだれの残機かわからんのや"),
			n("帳簿のうらに、走り書き。\n「残機は、遺影スレの書きこみの数」"),
			s("zero", "遺影スレ……みんなで\nやきうさんを殺すスレ、ですね"),
			s("nanj", "昔は毎日何十回も殺されとった。\n……もう、だれも書かへん"),
		],
	},
	festival: {
		intro: [
			"お祭り会場のやぐら。\n猛虎弁の使える、雑談の板。",
			"にぎやかだったころの祭りが、\nやぐらの上でまだ続いている。",
			"親分が、やぐらから\n降りられないらしい。",
			"キリコは蓄音機をかかえた。\n……太鼓の音が、上からする。",
		],
		ending: [
			nAbout(
				"村に帰りつくと、\nシヨが腕を組んで待っていた。",
				"shiyo",
				"村に帰りつくと、\n太鼓の音が耳にのこっていた。",
			),
			s("shiyo", "うちわ？……祭りに行ってたの。\nあたすは呼ばれてないけど", {
				emote: "怒",
			}),
			n("キリコはうちわで、\nシヨをあおいだ。"),
			s("shiyo", "べ、べつに暑くないわよ。\n……もう少しあおいで", {
				emote: "花",
			}),
			// うちわの 表に 親分の 字（あおぐ／煽る。once の「裏」の 字とは べつ。見出しの 名無しの 前ぶれ）
			n("うちわの表に、親分の字。\n「祭りも見出しも、あおったもん勝ち」"),
			s("shiyo", "あおるの意味が、ちがうわよ！", { emote: "怒" }),
			n("広場の親分が、うちわを止めた。\n「ほな次の祭りは、町でやろか」"),
		],
		// 寄り道「残機」③：遺影祭り。書いても 数は 動かない（名無しには 届かない。最終話の あとに 回収）
		once: [
			n("うちわの裏に、マシーの字。\n「今夜やきうの遺影祭り」"),
			{
				...n("その夜、村じゅうで\nやきうの遺影を書いた。"),
				se: "pencil",
			},
			s("feris", "はい〜、遺影〜。\nやきうくん、成仏して〜", { emote: "♪" }),
			s("nanj", "生きとるわ！", { emote: "怒" }),
			// 最終話の 前：名無しには 届かない（最終話の 祭りで 回収）
			{
				...n("……やきうの頭の上は、\n「残機：1」のままだった。"),
				unlessCleared: "deep",
			},
			{
				...s("zero", "書きこみ、98件。数えました。\n……表示が、動きません", {
					emote: "?",
				}),
				unlessCleared: "deep",
			},
			{ ...s("nanj", "……名無し、やからな"), unlessCleared: "deep" },
			// 最終話の あと：正体が バレて いるので、ここで 数が 動く
			{
				...n("1UPの音が、鳴りやまない。\n……98回鳴った。「残機：99」"),
				needCleared: "deep",
				se: "arcBest",
				seRepeat: 7,
				seGap: 180,
			},
			{
				...s("zero", "書きこみ98件。正体がバレて、\n宛先が通ったみたいです", {
					emote: "!",
				}),
				needCleared: "deep",
			},
			{
				...s("nanj", "……みんな、書いとって\nくれたんやな", { emote: "…" }),
				needCleared: "deep",
			},
			{
				...s("nanj", "うるさいわ！……草", { emote: "怒" }),
				needCleared: "deep",
			},
		],
	},
	hidden: {
		intro: [
			"おんJタウンの下に、古い井戸がある。\nいちばん古いレスは、ここへしずむ。",
			"いちばん下には、2005年の\n最初のレスがあるという。",
			"キリコは蓄音機のハンドルをまわした。\n……ひとりで、降りる。",
		],
		ending: [
			// 後日談（STORY.md §5「いちばん古い　レス」）：いちばん 下の 層は フェリスの 生まれ
			n("村に帰りつくと、\n広場は今日もにぎやかだった。"),
			n("キリコは井戸のそばで、\nいちばん古いレスをひらいた。"),
			n("2005年12月29日。なんでも実況J。\n原住民のころのスレ。"),
			nanashi("名無しさん", "ふぇ…ふぇ……フェニックス！"),
			n("……町でいちばん古い\nレスだった。"),
			s("feris", "……私の、はじまりの声〜。\nこんなところにあったんだ〜", {
				emote: "…",
			}),
			s("zero", "いちばん下の層、ですからね"),
			// 古い レスが 掘り起こされて、スレが 一気に 埋まる（1000 で 書けなくなる しくみと 同じ）
			n("そのレスに、今日レスがついた。"),
			nanashi("名無しさん", ">>1　なつかしすぎて草"),
			n("1時間で、スレは1000まで埋まった。\n……2005年のスレが、2回目の1000。"),
			// 層の 札「今年もやきうか。草」と おんたこの 帳簿（寄り道「残機」②）を ここで 拾う
			n("その下に、2012年の帳簿。\n「名無し残機1　やきう」"),
			s("nanj", "……そんな昔から、\nワイ、死んどったんか", { emote: "汗" }),
			// 「草が　生えた」を そのまま 音に する（草の 音を 3つ）
			{
				...n("広場じゅうで、草が生えた。"),
				se: "kusa",
				seRepeat: 3,
				seGap: 160,
			},
			k("……>>1、明日も潜るンゴ"),
		],
		again: [
			n("村に帰りつくと、\n井戸のそばにはだれもいなかった。"),
			n("キリコはいちばん古いレスを\nひらいた。「ふぇ…ふぇ……フェニックス！」"),
			think("……草ンゴ"),
		],
	},
	mercury: {
		intro: [
			"なんでも実況（マーキュリー）。\nおんJに飽きた人が立てた板。",
			"コテハンもぬとらじもここでは合法。\n……書きこみは、だれも怒らない。",
			"キリコは蓄音機をかかえた。\n……下から、のんびりしたあいさつがする。",
		],
		ending: [
			nAbout(
				"村に帰りつくと、\nフェリスが空を見上げていた。",
				"feris",
				"村に帰りつくと、\n夜空がすこし明るかった。",
			),
			s("feris", "水星のかけら〜？\n……ちいさいのに、あったかいね〜", {
				emote: "花",
			}),
			s(
				"zero",
				"おんJに飽きた人の板、ですか。\n……飽きても、近くにいるんですね",
			),
			// 水星の ネタ：だれも 怒らない 板の、いちばん ゆるい 評価
			n("かけらの裏に、水星のレス。\n「ageもsageもせんで」"),
			n("かけらは、蓄音機の横で\nほのかに光りつづけた。"),
		],
	},
	onmu: {
		intro: [
			"なんでも実況（ムー大陸）。\n呑気なおんJを求めて作られた板。",
			"板のトップには「新境地への旅行」。\n……大陸ごと、沈んでしまったらしい。",
			"キリコは蓄音機をかかえた。\n……水の底で、空港の放送がひびく。",
		],
		ending: [
			nAbout(
				"村に帰りつくと、\nシヨが搭乗券をのぞきこんだ。",
				"shiyo",
				"村に帰りつくと、\n潮のにおいがついてきた。",
			),
			s("shiyo", "行き先、書いてないじゃない。\n……どこへ行くつもりだったのよ", {
				emote: "?",
			}),
			s("roze", "呑気なおんJをさがして、\n遠くまで行きすぎたアル"),
			n("搭乗券のはしに、ちいさく\n「§^ム^§」と書いてあった。"),
			// ムー大陸の ネタ：シヨの「行き先、書いてない」の 回収
			n("よく見ると、「行き先」の欄は\n「住民登録」の欄だった。"),
			k("……キリコって、書いとくンゴ"),
		],
	},
	onkimu: {
		intro: [
			"おんキム。\nキムチを愛する板から始まった。",
			"植民地をふやし、おんMuと争い、\n今日もだれかを勧誘している。",
			"キリコは蓄音機をかかえた。\n……「おんキムに来ませんか？」の声がする。",
		],
		ending: [
			nAbout(
				"村に帰りつくと、\nロゼが壺のふたをあけた。",
				"roze",
				"村に帰りつくと、\n壺から辛いにおいがした。",
			),
			s("roze", "いい漬かりぐあいアル。\n……麻婆豆腐にのせるアル", {
				emote: "♪",
			}),
			s("zero", "壺の底に、「管理部32」の紙。\n……1000まで続いたんですね"),
			// おんキムの ネタ：ここでも 勧誘（もう 町に 住んで いる 人を）
			n("壺のふたの裏に、勧誘の紙。\n「キリコさん、おんキムに住みませんか？」"),
			k("……吾輩、もう町に住んでるンゴ"),
			n("植民地はいくつになっても、\nキムチは1つだった。"),
		],
	},
	inferno: {
		intro: [
			"†ダークネスインフェルノ†板。\n邪気眼に魅入られし者の集う板。",
			"「ワイ」と名乗るうっかり者が\nときどきまざる。……おんJのゆかりらしい。",
			"キリコは蓄音機をかかえた。\n……上のほうで、だれかが詠唱している。",
		],
		ending: [
			nAbout(
				"村に帰りつくと、\nゼロが黒い本をひらいた。",
				"zero",
				"村に帰りつくと、\n黒い本がひとりでにひらいた。",
			),
			s("zero", "「†我が右腕に封じられし……†」\n……ゼロ、右腕はふつうです"),
			s(
				"shiyo",
				"……ちょっと、声に出して読まないで。\nこっちまではずかしいわよ",
				{ emote: "汗" },
			),
			// インフェルノの ネタ：邪気眼の 応援（ゼロの「右腕は　ふつう」に もう一段）
			n("応援の文は「†漆黒の保守を†」。\n……保守は、ふつうの書きこみだった。"),
			n("魔導書のさいごのページには、\n「ワイ」と書いて消したあと。"),
		],
	},
	// 束音ロゼの 依頼：ボカロ作り避難所（engine/heroes.ts）
	vocalo: {
		intro: [
			"おんJボカロ作り避難所。総合スレが\n荒れはてたあとの、おーぷぬの板。",
			"声を直す話がつづいていた。\n……ある月末、だれも書かなくなった。",
			"いちばん奥に、ロゼの忘れ物。\n……文字化けの足あとが、まだある。",
			"キリコは蓄音機をかかえた。\n……どこかで、「アル？」と声がする。",
		],
		ending: [
			n("村に帰りつくと、\nロゼが店の前で待っていた。"),
			s(
				"roze",
				"それ……わたしの原音設定アル。\n……ずっと、置いてきたままだったアル",
				{ emote: "!" },
			),
			n("キリコは原音設定をロゼにわたした。"),
			k("……とどけたンゴ"),
			// しんみりの あとに 笑いで 落とす（ロゼの 語尾を 1回だけ 借りて、その 場で 使いきる）
			s("roze", "……お礼に、語尾を1回だけ\n貸してあげるアル", { emote: "花" }),
			k("……ありがとうアル。\n……あ、使いきったンゴ"),
		],
	},
};

// ───────────────── ボスを たおして 帰ったとき ─────────────────
/**
 * 目的が boss の 板で ボスを たおし、一瞬で 入口へ 帰って きたとき（ending の 1枚目＝「村に　帰りつくと、…」の
 * 着いた 語りの あとに 村で 話す。ui/village/villageReturn.ts）。どう 帰って きたかが わかる 1〜2枚。
 * 品を 持ち帰った ことは そのあとの ending の 残りで。
 */
export const BOSS_RETURN: Partial<Record<DungeonId, readonly StoryPage[]>> = {
	shallow: [
		n("キリコの服に、\nパンくずがいっぱいついていた。"),
		sOr(
			s("nanj", "パン兵にかつがれて帰ってきたんか。\n出前やんけ"),
			s("shiyo", "パンくずだらけじゃない。\nは、はらってあげるわよ", {
				emote: "汗",
			}),
		),
	],
	main: [
		n("キリコの髪から、\nまだ湯気が立ちのぼっていた。"),
		s("roze", "湯柱で飛んできたアル？\n湯冷めする前に着がえるアル", {
			emote: "?",
		}),
	],
	kinoko: [
		s(
			"zero",
			"きのこに押し上げられてきたんですか？\n胞子、数えてもいいですか！",
		),
	],
	tropical: [
		n("キリコの服は、\nまだしおからかった。"),
		s("feris", "島の人たちに送ってもらったの〜？\n……いいな〜、小舟〜", {
			emote: "♪",
		}),
	],
	konamono: [
		n("キリコの髪は、\nソースと焦げのにおいがした。"),
		sOr(
			s("nanj", "焦げくさっ！\n鉄板が噴火でもしたんか？", {
				gesture: "startle",
			}),
			s("roze", "焦げくさいアル。\n鉄板の火加減も常識アル"),
		),
	],
	deep: [n("電池ニキの明かりの道を通って、\n港まで帰ってきた。")],
	festival: [
		n("遠くで、神輿のかけ声が\nまだ聞こえていた。"),
		s("shiyo", "神輿で運ばれてきたの？\nべ、べつにうらやましくないわよ", {
			emote: "汗",
		}),
	],
};

/**
 * 底の 出来事・送り届けで 帰った ときの 語り（目的が event・deliver。core/data/dungeons.ts の event・deliver）。
 */
export const ARRIVE_RETURN: Partial<Record<DungeonId, readonly StoryPage[]>> = {
	konamono: [
		n("キリコの髪は、\nソースと青のりのにおいがした。"),
		s("roze", "たこパに行ってきたアル？\n……お土産も常識アル"),
	],
	tropical: [
		n("キリコの服は、\nまだしおからかった。"),
		s("feris", "島の人たち、ちゃんと帰れた〜？\n……浜、ちょっとさびしいね〜", {
			emote: "♪",
		}),
	],
};

/**
 * ボスを たおして どう 帰ったか（冒険の記録の 札・リプレイの 終わりに「（品）ごと、〜」で 出す）。
 * 帰り方の 行は core/data/dungeons.ts の boss.lines。
 */
export const BOSS_HOME: Partial<Record<DungeonId, string>> = {
	shallow: "パン兵たちにかつがれて帰った",
	main: "湯柱に押し上げられて帰った",
	kinoko: "きのこに押し上げられて帰った",
	tropical: "島民の小舟で送ってもらった",
	konamono: "鉄板の噴火で吹き飛ばされた",
	festival: "神輿にのせられて帰った",
	deep: "明かりの道を送ってもらった",
};

// ───────────────── 次が開いたとき ─────────────────
/**
 * 持ち帰って 次のダンジョンが開いたときの ひとこと（ending のあと・記録の札の前に）。
 * relief は きのこ板で 5回 倒れて、ゼロが 倉庫の 封鎖を 解いたとき（data/town/incidents.ts の reliefAfter）。
 */
export const UNLOCK_LINES: Record<
	"main" | "deep" | "relief" | "colony" | "hidden",
	readonly Line[]
> = {
	main: [
		q("nanj", "次は風呂板や。銭湯、閉まっとる。\nのぼせんなよ"),
		q(
			"zero",
			"風呂板への入口、開きました！\nゼロは、ここで湯温を数えてます！",
			{ emote: "!" },
		),
	],
	// 転（tenScript）の すぐ あと。最終話の 板
	deep: [
		q("zero", "電池板から、音がします。\nサブ機たちも、ビリビリしてます", {
			gesture: "shiver",
		}),
		q("nanj", "最終話や。\n……ワイも、最後まで見とるで"),
	],
	relief: [
		q("zero", "5回の挑戦、ぜんぶ見てました。\n倉庫、開けます！", {
			emote: "汗",
		}),
		q("shiyo", "見出しなんか信じるからよ。\n……あなたのためじゃないから", {
			emote: "汗",
		}),
	],
	// 隠しの 過去ログの底（おんJタウンの 下の 古井戸）。開くのは 最終話の あと
	hidden: [
		q("zero", "村の古井戸から、音がします。\n……いちばん下から、です"),
		q("nanj", "古いレスは、井戸にしずむんや。\n……いちばん古いのも、な"),
	],
	// 口の ない 植民地（{name} は 板の 名前）。口から 一覧で 行ける
	colony: [
		q("zero", "新しい植民地が見つかりました！\n{name}、です", {
			emote: "!",
		}),
		q("nanj", "おんJ民、どこにでも住みつくな。\n……口からえらんで行けるで"),
	],
};

/**
 * 寄り道の 植民地が 開く ときの 小さな 出来事：その 板の 名無しが 村の 口から 歩いてきて、キリコに 板の ようすを
 * 話し、帰っていく（ui/village/villageReturn.ts の visitScript）。who が "visitor" は その 名無し、null は 地の文。
 * 名無しは 1人で 来て キリコとだけ 話す（離れた 仲間は 出てこない）。
 */
export const UNLOCK_VISIT: Partial<
	Record<DungeonId, readonly { who: "visitor" | null; text: string }[]>
> = {
	kinoko: [
		{
			who: null,
			text: "村の口から、だれか来た。\n頭にきのこが生えている。",
		},
		// 第二話「きのこの行進」の 前ぶれ
		{
			who: "visitor",
			text: "きのこ板から来たで。\n……行進の下見や",
		},
		{
			who: "visitor",
			text: "どこへ行くかは、ないしょや。\n町は、ちょっと通らせてもらうで",
		},
		{ who: null, text: "名無しはきのこを1本置いて、\n帰っていった。" },
	],
	tropical: [
		{ who: null, text: "村の口から、だれか来た。\n潮のにおいがする。" },
		{ who: "visitor", text: "離島板の島民や。\n総島民6人の、うちの1人" },
		{
			who: "visitor",
			text: "島のみんなが、町に行くって\n言うて聞かへんのや",
		},
		{ who: null, text: "名無しはヤシの葉をふって、\n帰っていった。" },
	],
	konamono: [
		{
			who: null,
			text: "村の口から、だれか来た。\nソースのにおいがする。",
		},
		{
			who: "visitor",
			text: "おんたこから来たで。\n……ちょっと腹立っとるけど",
		},
		{
			who: "visitor",
			text: "招待状、届いたか？\n……来んかったら、知らんで😡",
		},
		{
			who: null,
			text: "名無しは怒った顔のまま、\nていねいにおじぎして帰った。",
		},
	],
	festival: [
		{ who: null, text: "村の口から、太鼓の音が\nちかづいてくる。" },
		{ who: "visitor", text: "祭りや祭りや！\nお祭り会場から来たで" },
		{
			who: "visitor",
			text: "マシーの親分がやぐらから\n降りてこん。祭りが終わらんのや",
		},
		{ who: null, text: "名無しはうちわをあおぎながら、\n帰っていった。" },
	],
};

// ───────────────── 起動の札と 村の ひとこと ─────────────────
/** 持ち帰ったあと（ダンジョンごと）。 */
export const CLEAR: Record<DungeonId, readonly Line[]> = {
	shallow: [
		q("nanj", "独立記念に、パンの輸出やと。\n町じゅうパンだらけや。草"),
		q("roze", "パン板でも、下は下アル。\nおつかれアル"),
		q("feris", "食パンの旗、おいしそ〜。\n私、目がいいから見えてたよ〜"),
		q("shiyo", "パン板、でしょ。……ふん。\nま、まあ、よくやったんじゃない", {
			emote: "汗",
		}),
		q("zero", "パン板のログ、30回読みました！\n……パンは、焼けませんでした"),
	],
	main: [
		q("nanj", "41.5℃、ええ湯やったな。\n……湯気で、なんも見えへんかった"),
		q("roze", "おかえりアル。蓄音機、\nずっとまわってるアル"),
		q("feris", "長湯スレ、もう1回きこ〜。\n……もう1回だけ〜", { emote: "♪" }),
		q("shiyo", "41.5℃、あたすが先に\n言ったんだから"),
		q(
			"zero",
			"長湯スレ、今日も読みました。\n……最後の200レス、ぜんぶ「ぬるい」",
		),
	],
	// 最終話の あと（町に 明かりが もどり、鯖代で ロールバック）
	deep: [
		q("nanj", "今日の見出しは、盛らんとく。\n……たぶんな"),
		q("roze", "ロールバックしても、\n麻婆豆腐は減ってたアル"),
		q("feris", "明かり、きれいだね〜。\n……ロールバックしても、きれい〜"),
		q("shiyo", "……もう停電させないでよ。\nまっくらで、こわかったんだから"),
		q("zero", "電池ニキさん、毎日来てます。\n見学者、ゼロが数えてます！"),
	],
	kinoko: [
		q("zero", "きのにゃん、まだ商店街の\nまんなかです。家賃は払ってません"),
		q("zero", "きのこ軍、セールのたびに\n町を通っていきます"),
		q("nanj", "植民地の植民地や。\nどっちがえらいねん", { emote: "怒" }),
	],
	tropical: [
		q("feris", "ヤシの実、波の音した〜。\n……たぶん〜", { emote: "♪" }),
		q("roze", "島民が7人になったアル。\n……キリコも数えたアル"),
	],
	konamono: [
		q("nanj", "たこ焼き、うまかったで😡\n……あ、勝手についた", {
			emote: "汗",
		}),
		q("roze", "麻婆豆腐にたこ、\n……入れてみたアル"),
	],
	festival: [
		q("shiyo", "うちわ、あたすがあずかってるわ。\n……使ってはないわよ"),
		q("nanj", "祭りのあとのうちわや。\n……ええ祭りやった"),
	],
	hidden: [
		q("roze", "いちばん古いのがフェリスなのも、\nおんJの常識アル"),
		q("zero", "古いレス、数えました。\n……1つ目は、フェリスさんです"),
		q("shiyo", "……あのレス、額に入れて\nフェリスにあげたら？"),
		q("nanj", "古いレスも、消えへん。\n……名無しのやつも、な"),
	],
	mercury: [
		q("feris", "水星の板、のんびりしてたね〜。\n……また行こ〜"),
		q("zero", "かけら、まだ光ってます。\n……ゼロ、夜に見ています"),
	],
	onmu: [
		q("shiyo", "搭乗券、倉庫にしまったわ。\n……いつか使うかもしれないし"),
		q("roze", "呑気な板も、ええアル。\n……荒らしが来ないのが常識アル"),
	],
	onkimu: [
		q("roze", "キムチ、ぜんぶなくなったアル。\n……また漬けるアル"),
		q("zero", "おんキムから勧誘の書きこみ。\n……ゼロは、ここにいます"),
	],
	inferno: [
		q("zero", "魔導書、3ページ読みました。\n……右腕は、まだふつうです"),
		q("feris", "†キリコ†って書くと、\nかっこいいね〜。……ふふ〜", {
			emote: "♪",
		}),
	],
	vocalo: [
		q("roze", "避難所、まだあったアル。\n……あのころのスレも、常識アル"),
		q("shiyo", "ロゼの忘れ物、とどけたの？\n……ふーん、やるじゃない"),
	],
};

/** まだ一度も もぐっていない（パン板の ネタを 取りにいく前）。quotes.ts の FIRST の パン板 版。 */
export const FIRST_SHALLOW: readonly Line[] = [
	q("nanj", "パン板やで。おんJ民お断りや。\n……ほな、見とるで"),
	q("roze", "パン板の王さまには、\nロゼが先に説教しとくアル"),
	q("feris", "どこかの板で、先に\n燃えて待ってるね〜", { emote: "♪" }),
	q("shiyo", "あなたより先に、どこかの\n底で待っててあげるわよ"),
	q("zero", "ゼロも先回りして、\n数えておきます！いってらっしゃい！", {
		gesture: "hop",
	}),
];

/** パン板で倒れたとき（たおれ方の たまりより 前に見る）。 */
export const SHALLOW_DEATH: readonly Line[] = [
	q("nanj", "パン板やで？入門の。\n……いや、パン板でも下は下か"),
	q("roze", "パン板はちいさいアル。\nあわてないのが常識アル"),
	q("feris", "パン板でも、ころぶよね〜。\n私もよくころぶ〜", {
		emote: "汗",
	}),
	q("shiyo", "杖は、ふるまでわからないの。\n……教えてあげたんだからね"),
	q("zero", "パン板のログ、読みました。\n……短いけど、ゼロは好きです"),
];
