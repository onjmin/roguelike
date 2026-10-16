// 植民地（ダンジョン）の物語の部品。
// - 名前と板の決まり・見た目と曲、目的の品、はじめて入る前の語り（intro）と 持ち帰ったあとの語り（ending）、
//   ボスを たおして 一瞬で 帰ったときの 語り（BOSS_RETURN）、
//   次のダンジョンが開いたときの ひとこと、起動の札と 村の ひとことの たまり。
// - 本編（main）の intro / ending は quotes.ts の INTRO / ENDING をそのまま使う。
// 筋は STORY.md §5「おんJマスコット 総選挙」。キリコも 会話に 加わる（吾輩・ンゴで 短く。望みは 台詞で 言う）。
// 1行は全角22字・2行まで。笑いが 先、シリアスは 落差で（STORY.md §0）。

import type { DungeonId } from "../../core/types";
import type { Story } from "../../engine/defs";
import { type Cue, cueOf } from "../../engine/emote";
import type { MobId } from "../people/mobs";
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
/**
 * 仲間が 村に 来る 町の 段（STORY.md §5「選挙事務所が 大きく なると 陣営に 人が 入る」）。はじめの おんJタウンには
 * 現職の やきうだけ（と、前から いる ぷゆゆ）。建物と いっしょに 越してくる：屋台で 売る ロゼと 帳簿の ゼロ、屋根つき屋台の
 * 看板と 客よせの フェリスと 物置（倉庫）番の シヨ。越してくる 場面は 町が 育つ とき（ui/village/villageReturn.ts の stageUp）。
 */
export const FRIEND_FROM: Record<Speaker, number> = {
	nanj: 0,
	roze: 1,
	zero: 1,
	feris: 2,
	shiyo: 2,
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
	// 持ち帰って いない 板の 頁（寄り道「残機」の 開票の 頁）は 出さない
	const here = (pages: readonly StoryPage[]) =>
		pages.filter((p) => !p.needCleared || cleared.includes(p.needCleared));
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
	shallow: { no: "第一話", title: "告示" },
	kinoko: { no: "第二話", title: "怪文書" },
	main: { no: "第三話", title: "裸の　討論会" },
	deep: { no: "最終話", title: "開票" },
	hidden: { no: "後日談", title: "初代の　安価" },
};

/** 話の おわりの 1窓（はじめて 持ち帰った とき。章の 音と いっしょに）。 */
export const episodeEnd = (d: DungeonId): StoryPage | null => {
	const e = EPISODES[d];
	return e
		? { who: null, text: `${e.no}「${e.title}」　完`, cue: "chapterEnd" }
		: null;
};

/**
 * 潜る ときの やきうの 一言（口で 行き先を 決めた あと）。開票（電池板）までは 確定して いるので 毎回 同じ
 * （STORY.md §5「転の 証拠を はじめから 見せて おく」）。開票の あとは free から 毎回 ちがう 一言。
 */
export const DEPART = {
	nanj: "ほな、今年も　ワイが　勝つで",
	/** やきうが そばに いない とき（遠くから 声だけ）。 */
	nanjFar: "遠くから、やきうの　声。\n「ほな、今年も　ワイが　勝つで」",
	/** 確定が とけた あと（電池板を 持ち帰った あと）。潜った 回数で 回す。 */
	free: [
		"公式さん、いってら。\n……ワイは　草野球や",
		"今日は　ちがう　こと　言うたろ。\n……思いつかんわ。草",
		"いってこい。\n来年は、本気で　負かしたる",
		"ほな、ワイは　昼寝や。\n……毎日　ちがう　昼寝や",
		"おう。……今日の　ワイ、\n昨日と　ちがう　顔　しとるやろ",
	],
	/** 村に 帰って 持ち物が からっぽの とき、ぷゆゆパンを 持たせる 地の文（ぷゆゆは 村から 去らない）。 */
	puyu: "ぷゆゆが　かけてきて、\nぷゆゆパンを　持たせてくれた。",
	/** ぷゆゆソードを 渡した すぐ あとで、もう となりに いる とき（かけてこない）。 */
	puyuToo: "ぷゆゆは、ぷゆゆパンも\n持たせてくれた。",
} as const;

/**
 * 寄り道「残機」（STORY.md §5）：やきうの 頭の 上の 数を 本人が 言う。きのこ板（「残機：1」が 出た）から 開票まで は 1。
 * 開票の あとは、遺影祭り（お祭り会場）を 持ち帰って いれば 99（確定が とけて 遺影が 数に なった）。
 */
export const zankiLine = (cleared: readonly DungeonId[]): string | null =>
	!cleared.includes("kinoko")
		? null
		: !cleared.includes("deep")
			? "……頭の　上の「残機：1」か。\n気に　すんな"
			: cleared.includes("festival")
				? "頭の　上、「残機：99」や。\n……多すぎて、使い道が　ないわ"
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
/** 住人（data/people/mobs.ts）の 1窓。needCleared を つけると、その 板を 持ち帰って いる ときだけ 出る。 */
const mob = (
	id: MobId,
	text: string,
	needCleared?: DungeonId,
	c?: Cue,
): StoryPage => ({
	who: null,
	text,
	mob: id,
	...(needCleared ? { needCleared } : {}),
	...c,
});
/** 名無しの 1窓（名前欄だけ）。 */
const nanashi = (name: string, text: string): StoryPage => ({
	who: null,
	text,
	nanashi: name,
});
/** パン板の 持ち帰り（毎回）。はじめての ときは この あとに 現職との 顔あわせ。 */
const SHALLOW_BASE: readonly StoryPage[] = [
	nAbout(
		"村に　帰りつくと、\n山吹色が　うでを　組んで　待っていた。",
		"nanj",
		"村に　帰りつくと、\n広場に　パンの　においが　した。",
	),
	s("nanj", "パン兵長の　推薦か。\n……ほな、貼っとき"),
	n(
		"キリコは　推薦状を　ポスターに　貼った。\n「パン板は　キリコを　推す（パンで）」",
	),
	// 迎えの 掛け合いは 2〜3人まで（だれが だれか 知らない 人が 流し読み しないように）
	s("zero", "支持者、ふえました！\n……はじめて、数字が　動きました", {
		emote: "!",
	}),
];

/**
 * 転（STORY.md §5）：風呂板の 語りを 見おえた 帰りに 1回だけ（ui/village/villageReturn.ts の tenScript）。
 * ゼロが 告示の 小さい 字（規則の 2つ目）を 読み、告示を 貼ったのは やきう だと わかる。キリコは 勝って 確定を 消すと 決める
 * （最初の 望み「名前を　おぼえて　ほしい」は 勝てば 確定で かなう。それを 捨てて 消す 側を えらぶ）。
 */
export const TEN_NEWS = {
	pages: [
		n("朝。広場の　告示の　貼り紙の　前で、\nゼロが　しゃがみこんでいた。"),
		s("zero", "キリコさん。いちばん下に、\n小さい　字が　あります", {
			emote: "!",
		}),
		s("zero", "ちいさい　字も、\n数えるのが　ゼロの　仕事です"),
		n("「当選した　公式は、設定が　確定する。\n毎年　同じ　一日を　くり返す」"),
		n("「安価でも、もう　変えられない」"),
		s("roze", "……だから　毎年　同じ　こと\n言う　わけアル。「ほな、今年も」", {
			emote: "!",
		}),
		n("貼り紙の　すみに、山吹色の\n指の　あとが　ついていた。"),
		s("nanj", "……せや。告示、貼ったんは　ワイや。\n毎年　な", { emote: "…" }),
		s("nanj", "2012年に　勝って、確定した。\nそれから　ずっと、同じ　一年や"),
		s(
			"nanj",
			"だれかが　本気の　ワイに　勝って、\n最初の　日に　確定を　消さな　あかん",
		),
		s(
			"nanj",
			"……せやけど、勝った　やつは\nその　場で　確定や。勝ったら　あかんで",
		),
		s("nanj", "ワイは、手　抜けへんけどな"),
		s(
			"feris",
			"……だから　言ったでしょ〜。\n公式って、たのしい　だけじゃ　ないよ〜",
		),
		k("……吾輩が　勝って、\n最初の　日に　消すンゴ"),
		s("nanj", "……名前、おぼえて　もらうんや\nなかったんか"),
		k("……あとで、ふつうに\nおぼえて　もらうンゴ"),
		s("nanj", "……草。ほな、電池板や。\nいちばん下に、投票箱が　ある"),
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
		mascot: "パン松　|｀°Ο°´|",
		rules: [
			"いちばん　栄えた　植民地。入門の　3階",
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
			"植民地で　いちばん　雰囲気が　ええ。14階",
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
			"過疎で　謎が　多い　植民地。20階",
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
			"パン板が　植民した、植民地の　植民地。5階",
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
			"総島民　6人の　島。7階",
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
			"レスの　末尾に　😡が　つく　板。10階",
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
			"猛虎弁の　使える　雑談板。10階",
			"祭り：3階から　3つに　1つの　階が　祭り",
			"ぜんぶ　未識別",
		],
	},
	// 隠し（電池板を 持ち帰ると 開く）。植民地では なく、おんJ（おんJタウン）の 真下
	hidden: {
		name: "過去ログの底",
		short: "ログの底",
		nick: "おんJの　真下",
		mascot: "1001（どの　スレも　最後は　これ）",
		rules: [
			"おんJタウンの　下の　古井戸。99階",
			"層ごとに　景色と　曲が　かわる",
			"底の　品を　持ったまま　帰還スレで　帰れる",
		],
	},
	mercury: {
		name: "なんでも実況（マーキュリー）",
		short: "マーキュリー",
		nick: "水星",
		mascot: "水星の名無し",
		rules: [
			"おんJに　飽きた　人の　ほのぼの板。6階",
			"宝の　板：道具が　多く、罠は　安価だけ",
			"祭りも　ない。敵は　少ない",
			"HPの　自然回復が　はやい。杖だけ　未識別",
		],
	},
	onmu: {
		name: "なんでも実況（ムー大陸）",
		short: "おんMu",
		nick: "おんMu",
		mascot: "ムーミン谷の名無し　§^ム^§",
		rules: [
			"呑気な　おんJを　求めて　作られた　板。7〜17階",
			"沈む　大陸：底の　深さが　潜るたびに　かわる",
			"過疎：敵も　道具も　少ない。草・スレ・杖が　未識別",
		],
	},
	onkimu: {
		name: "おんキム",
		short: "おんキム",
		nick: "キムチ板",
		mascot: "キムりん　🌶",
		rules: [
			"キムチを　愛する　板から　始まった。10階",
			"植民地戦争の　最前線：1階から　敵が　強い",
			"倉庫の　装備で　挑め。祭りが　多い。ぜんぶ　未識別",
		],
	},
	inferno: {
		name: "†ダークネスインフェルノ†板",
		short: "†闇の板†",
		nick: "中二病　専用板",
		mascot: "†名も無き暗黒の使い†",
		rules: [
			"邪気眼に　魅入られし　者の　塔。50階",
			"†闇の　試練†：倉庫の　道具は　持ちこめない",
			"魔導書を　持ったまま　帰還スレで　帰れる",
			"杖の　回数が　1　多い。ぜんぶ　未識別。解呪スレが　多い",
		],
	},
	// 束音ロゼの 依頼（engine/heroes.ts）
	vocalo: {
		name: "ボカロ作り避難所",
		short: "ボカロ避難所",
		nick: "ロゼの　避難先",
		mascot: "文字化け",
		rules: [
			"荒らされた　総合スレの　避難所。6階",
			"文字化けが　多い。荒らしが　追ってきた",
			"草と　杖が　未識別。のろいは　ない",
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
		note: "「告示、まだ？」",
		theme: "stone",
		bgm: "stone",
		ambient: "dust",
	},
	{
		last: 15,
		name: "埋もれた dat",
		note: "「今年も　やきうか。草」",
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
		note: "「公約：毎日　ナイター」",
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
		note: "「規制で　書けん。投票は　した」",
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
		note: "「怪文書、燃やしといたで」",
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
			"1歩　すすむと、下の　ものたちも　1歩。\nたおれたら、持ち物も　レベルも　なくす。",
			// 階が スレで 1000 で 終わる わけ（STORY.md §5「しくみと 話の つなぎ」）
			"階は、遊説の　スレ。動くたび、レスが　つく。\n……1000まで　埋まると、追い出される。",
		],
		ending: [
			...SHALLOW_BASE,
			// 現職との 顔あわせ。やきうは 毎年 新入りの 名前を おぼえる（確定した 一年の くり返し。転の 前ぶれ）
			s("nanj", "……ワイの　ポスターの　横に、\n新入りの　顔か。ええやん"),
			k("吾輩の　名前、\nおぼえたンゴ？"),
			s("nanj", "おぼえたで。……毎年　な、\nだれかの　名前は　おぼえるんや", {
				emote: "…",
			}),
		],
		again: SHALLOW_BASE,
	},
	main: { intro: INTRO, ending: ENDING, again: ENDING_AGAIN },
	deep: {
		intro: [
			"電池板。でんちゃんの　板。\n最後の　遊説先。",
			"いちばん　下に、\n村の　投票箱が　しずんでいるという。",
			"キリコは　蓄音機を　かかえた。",
			"……でん、と　鳴った。",
		],
		ending: [
			// 頂点（STORY.md §5「開票」）：にぃちぇの 1票で キリコが 当選し、最初の 変更で 確定を 消す
			n("投票日。村に　帰りつくと、\n村は　支持者で　いっぱいだった。"),
			s("zero", "支持者、いっぱいです！\n……まとめ掲示板が、見えません", {
				emote: "!",
			}),
			// シヨが まだ 越してきて いなければ かわりの 頁（山場が 短い 語りに 化けない ように）
			nAbout(
				"シヨが　投票箱の　ふたを　あけた。",
				"shiyo",
				"ゼロが　投票箱の　ふたを　あけた。",
			),
			sOr(
				s("shiyo", "……数え　まちがえたら、\nゼロの　せいだからね"),
				s("roze", "……数え　まちがえたら、\n麻婆豆腐　ぬきアル"),
			),
			s("zero", "数えます。……ゼロ、\nちゃんと　数えます"),
			n("ゼロが　票を　読みあげる。\n「キリコ」「やきう」「キリコ」……"),
			{
				...s("zero", "……同じ　数です。\nのこり、1票", { emote: "!" }),
				cue: "res999",
			},
			{
				...n("……「キリコ」\n書いたのは、にぃちぇだった。"),
				cue: "res1000",
			},
			// 承から 置いた 小ネタ（にぃちぇは 毎回 日を まちがえる）の 回収
			mob("nichie", "今日、投票日　だったニィ？\n……はじめて　合ってたニィ"),
			s("zero", "ちゃんと　数えました。\n……1票　差です"),
			s(
				"nanj",
				"……草。にぃちぇが　日付\nまちがえとったら、ワイの　勝ちやったわ",
			),
			s("roze", "今日は、麻婆豆腐\nひと鍋じゃ　足りないアル", { emote: "♪" }),
			mob("hinary", "当選者は、確定の　前に\n規則を　1つ　変えられます"),
			k("……確定は、なしンゴ。\n公式も、安価で　変わって　ええンゴ"),
			mob("hinary", "……規則上、有効です"),
			{ ...n("やきうの　肩から、\nなにかが　ほどけた。"), se: "uncurse" },
			// 寄り道「残機」を 終えて いれば、確定が とけた その 場で（祭りで 書いた 遺影が、やっと 数に なる）。
			// 本気の 一言の あと、笑いで 落とす（遺影は、みんなが 構って くれた 数）
			{
				...n("やきうの　頭の　上で、1UPの　音が\n鳴りはじめた。"),
				needCleared: "festival",
				se: "arcBest",
				seRepeat: 4,
			},
			{
				...s("nanj", "……みんな、書いとって\nくれたんやな", { emote: "…" }),
				needCleared: "festival",
			},
			{
				...n("1UPの　音は、まだ　鳴っていた。\n……98回　鳴った。「残機：99」"),
				needCleared: "festival",
				se: "arcBest",
				seRepeat: 4,
			},
			{
				...s("nanj", "うるさいわ！　……草", { emote: "怒" }),
				needCleared: "festival",
			},
			s("nanj", "……拙者、草野球に\n行くで　ござる", { emote: "?" }),
			s("nanj", "……やっぱ、これが　ええわ。\nほな、草野球でも　してくるわ", {
				emote: "汗",
			}),
			s("nanj", "来年は、本気で　負かしたる。\n……来年は、ちゃんと　来年や"),
			n("さっそく、村じゅうから\nキリコに　安価が　とんできた。"),
			nanashi("名無しさん", ">>1　語尾　アルに　しろ"),
			k("……わかったアル"),
			s("roze", "それ、わたしのアル！", { emote: "怒" }),
			n("みんなが、キリコの　名前を\n呼んで　笑った。"),
			n("まとめ掲示板には、もう\n来年の　ポスターが　貼ってあった。"),
		],
		again: [
			n("村に　帰りつくと、\n村は　今日も　支持者で　いっぱいだった。"),
			s("nanj", "公式さん、おかえり。\n……今日の　語尾は　なんや"),
			k("……まだ、ンゴンゴ"),
		],
	},
	kinoko: {
		intro: [
			"きのこ板。\nきのこと　たけのこが、ずっと　もめる　板。",
			"着くなり、紙が　降ってきた。\n「キリコは　たけのこ派」",
			"2枚目。「キリコは　たけのこ」",
			"3枚目。「たけのこが　本体」",
			"キリコは　蓄音機を　かかえた。\n……きのこ民の　目が、つめたい。",
		],
		ending: [
			nAbout(
				"村に　帰りつくと、\nゼロが　かけよってきた。",
				"zero",
				"村に　帰りつくと、\n広場は　しずかだった。",
			),
			s("zero", "きのにゃん、ですね！\n……推薦、もらえたんですか？", {
				emote: "!",
			}),
			n("きのにゃんは　蓄音機の　上に\nすわりこんだ。……推す、らしい。"),
		],
		// 怪文書（小さな 問い。第三話で 犯人が わかる）と、寄り道「残機」の 入口（STORY.md §5）
		once: [
			n(
				"きのにゃんの　毛に、紙が　1枚\nからまっていた。「キリコは　たけのこ派」",
			),
			s("roze", "怪文書アル。\n……だれが　まいたアル？", { emote: "怒" }),
			s("nanj", "ワイや　ないで。\n……選挙には、こういうの　つきもんや"),
			n("やきうの　頭の　上に、小さく\n「残機：1」と　出ていた。"),
			{ ...k("……その　数字、\nなにンゴ？"), about: "nanj" },
			s("nanj", "……気に　すんな。\n毎年、ひとつずつ　へるんや", {
				emote: "…",
			}),
		],
	},
	tropical: {
		intro: [
			"離島・沖縄板。\n総島民は、6人。",
			"うわさでは、島の　山の　上に\n1UPが　ひとつ　あるという。",
			"キリコは　蓄音機を　かかえた。\n……波の　音が、下から　する。",
		],
		ending: [
			nAbout(
				"村に　帰りつくと、\nフェリスが　手を　ふっていた。",
				"feris",
				"村に　帰りつくと、\n潮の　においが　ついてきた。",
			),
			s("feris", "ヤシの実〜！　ねえ、\n耳に　あてたら　波の　音　する〜？", {
				gesture: "hop",
			}),
			n("キリコは　ヤシの実を　蓄音機に\nのせてみた。……回らない。"),
			s(
				"roze",
				"それは　レコードじゃ　ないアル。\n……割って　飲むのが　常識アル",
			),
		],
		// 寄り道「残機」①：1UP は にせもの（ナツコの 自由研究）
		once: [
			n("ヤシの実に、マジックで\n「1UP」と　書いてあった。"),
			s("feris", "それ、ナツコちゃんの　字〜。\n夏休みの　自由研究だよ〜", {
				emote: "汗",
			}),
			s("nanj", "……にせもんか。草。\nまあ、ええわ"),
			{ ...k("……残機、どうやったら\nふえるンゴ？"), about: "nanj" },
			s("nanj", "さあな。……昔は、勝手に\nふえとったんやけどな", { emote: "…" }),
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
				{ emote: "!" },
			),
			s("roze", "麻婆豆腐と　いっしょに\n出すアル。……合わないアル？", {
				emote: "?",
			}),
			n("たこ焼きは、まだ　あたたかかった。"),
		],
		// 寄り道「残機」②：供託の 帳簿。残機の 正体は 遺影スレの 書きこみ
		once: [
			n("たこ焼きの　包み紙は、\n古い　帳簿の　切れはしだった。"),
			n("「供託　残機1　やきう」\n「供託　残機1　やきう」……毎年。"),
			s("roze", "……お金の　かわりに、\n残機を　預けてたアル？", { emote: "!" }),
			s("nanj", "……せや。返ってこん　やつや"),
			n("帳簿の　うらに、走り書き。\n「残機は、遺影スレの　書きこみの　数」"),
			s("zero", "遺影スレ……みんなで\nやきうさんを　殺す　スレ、ですね"),
			s(
				"nanj",
				"昔は　毎日　何十回も　殺されとった。\n……もう、だれも　書かへん",
			),
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
				{ emote: "怒" },
			),
			n("キリコは　うちわで、\nシヨを　あおいだ。"),
			s("shiyo", "……べ、べつに　暑くないわよ。\n……もう　少し　あおいで", {
				emote: "花",
			}),
		],
		// 寄り道「残機」③：遺影祭り。書いても 数は 動かない（確定。開票の あとに 回収）
		once: [
			n("うちわの　裏に、マシーの　字。\n「今夜　やきうの　遺影祭り」"),
			n("その　夜、村じゅうで\nやきうの　遺影を　書いた。"),
			s("feris", "はい〜、遺影〜。\nやきうくん、成仏して〜", { emote: "♪" }),
			s("nanj", "生きとるわ！", { emote: "怒" }),
			n("……やきうの　頭の　上は、\n「残機：1」の　まま　だった。"),
			s("zero", "書きこみ、98件。数えました。\n……表示が、動きません", {
				emote: "?",
			}),
			s("nanj", "……確定、やからな"),
		],
	},
	hidden: {
		intro: [
			"おんJタウンの　下に、古い　井戸が　ある。\n古い　告示は、ここへ　しずむ。",
			"いちばん　下には、2012年の\n最初の　告示が　あるという。",
			"キリコは　蓄音機の　ハンドルを　まわした。\n……ひとりで、降りる。",
		],
		ending: [
			// 後日談（STORY.md §5「初代の　安価」）：規則を 決めたのは 名無しの ふざけた 安価
			n("村に　帰りつくと、\n広場は　今日も　にぎやかだった。"),
			n("キリコは　井戸の　そばで、\n最初の　告示を　ひらいた。"),
			n("2012年。なんでも実況J。\n「公式マスコット　決めようや」"),
			nanashi("名無しさん", ">>5　公式は　1人な。確定な"),
			n("……名無しの、ふざけた　安価だった。"),
			s("nanj", "……草。こんな　レスで、ワイは\nずっと　同じ　一年やったんか", {
				emote: "汗",
			}),
			s("zero", "安価は、絶対　ですからね"),
			{ ...n("広場じゅうで、草が　生えた。"), se: "laughCrowd" },
			k("……>>1、来年も　選挙ンゴ"),
		],
		again: [
			n("村に　帰りつくと、\n井戸の　そばには　だれも　いなかった。"),
			n("キリコは　最初の　告示を　ひらいた。\n「公式は　1人な。確定な」"),
			think("……草ンゴ"),
		],
	},
	mercury: {
		intro: [
			"なんでも実況（マーキュリー）。\nおんJに　飽きた　人が　立てた　板。",
			"コテハンも　ぬとらじも　ここでは　合法。\n……書きこみは、だれも　怒らない。",
			"キリコは　蓄音機を　かかえた。\n……下から、のんびりした　あいさつが　する。",
		],
		ending: [
			nAbout(
				"村に　帰りつくと、\nフェリスが　空を　見上げていた。",
				"feris",
				"村に　帰りつくと、\n夜空が　すこし　明るかった。",
			),
			s("feris", "水星の　かけら〜？\n……ちいさいのに、あったかいね〜", {
				emote: "花",
			}),
			s(
				"zero",
				"おんJに　飽きた　人の　板、ですか。\n……飽きても、近くに　いるんですね",
			),
			n("かけらは、蓄音機の　横で\nほのかに　光りつづけた。"),
		],
	},
	onmu: {
		intro: [
			"なんでも実況（ムー大陸）。\n呑気な　おんJを　求めて　作られた　板。",
			"板の　トップには「新境地への　旅行」。\n……大陸ごと、沈んでしまった　らしい。",
			"キリコは　蓄音機を　かかえた。\n……水の　底で、空港の　放送が　ひびく。",
		],
		ending: [
			nAbout(
				"村に　帰りつくと、\nシヨが　搭乗券を　のぞきこんだ。",
				"shiyo",
				"村に　帰りつくと、\n潮の　においが　ついてきた。",
			),
			s(
				"shiyo",
				"行き先、書いてないじゃない。\n……どこへ　行く　つもりだったのよ",
				{ emote: "?" },
			),
			s("roze", "呑気な　おんJを　さがして、\n遠くまで　行きすぎたアル"),
			n("搭乗券の　はしに、ちいさく\n「§^ム^§」と　書いてあった。"),
		],
	},
	onkimu: {
		intro: [
			"おんキム。\nキムチを　愛する　板から　始まった。",
			"植民地を　ふやし、おんMuと　争い、\n今日も　だれかを　勧誘している。",
			"キリコは　蓄音機を　かかえた。\n……「おんキムに　来ませんか？」の　声が　する。",
		],
		ending: [
			nAbout(
				"村に　帰りつくと、\nロゼが　壺の　ふたを　あけた。",
				"roze",
				"村に　帰りつくと、\n壺から　辛い　においが　した。",
			),
			s("roze", "いい　漬かりぐあいアル。\n……麻婆豆腐に　のせるアル", {
				emote: "♪",
			}),
			s("zero", "壺の　底に、「管理部32」の　紙。\n……1000まで　続いたんですね"),
			n("植民地は　いくつに　なっても、\nキムチは　1つだった。"),
		],
	},
	inferno: {
		intro: [
			"†ダークネスインフェルノ†板。\n邪気眼に　魅入られし　者の　集う　板。",
			"「ワイ」と　名乗る　うっかり者が\nときどき　まざる。……おんJの　ゆかりらしい。",
			"キリコは　蓄音機を　かかえた。\n……上の　ほうで、だれかが　詠唱している。",
		],
		ending: [
			nAbout(
				"村に　帰りつくと、\nゼロが　黒い　本を　ひらいた。",
				"zero",
				"村に　帰りつくと、\n黒い　本が　ひとりでに　ひらいた。",
			),
			s("zero", "「†我が　右腕に　封じられし……†」\n……ゼロ、右腕は　ふつうです"),
			s(
				"shiyo",
				"……ちょっと、声に　出して　読まないで。\nこっちまで　はずかしいわよ",
				{ emote: "汗" },
			),
			n("魔導書の　さいごの　ページには、\n「ワイ」と　書いて　消した　あと。"),
		],
	},
	// 束音ロゼの 依頼：ボカロ作り避難所（engine/heroes.ts）
	vocalo: {
		intro: [
			"おんJボカロ作り避難所。総合スレが\n荒れはてた　あとの、おーぷぬの　板。",
			"声を　直す　話が　つづいていた。\n……ある　月末、だれも　書かなく　なった。",
			"いちばん　奥に、ロゼの　忘れ物。\n……文字化けの　足あとが、まだ　ある。",
			"キリコは　蓄音機を　かかえた。\n……どこかで、「アル？」と　声が　する。",
		],
		ending: [
			n("村に　帰りつくと、\nロゼが　店の　前で　待っていた。"),
			s(
				"roze",
				"それ……わたしの　原音設定アル。\n……ずっと、置いてきた　ままだったアル",
				{ emote: "!" },
			),
			n("キリコは　原音設定を　ロゼに　わたした。"),
			k("……とどけたンゴ"),
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
		n("キリコの　服に、\nパンくずが　いっぱい　ついていた。"),
		sOr(
			s(
				"nanj",
				"パン兵に　かつがれて　帰ってきたんか。\n……パン松の　手下やんけ",
			),
			s("shiyo", "……パンくず　だらけじゃない。\nは、はらって　あげるわよ", {
				emote: "汗",
			}),
		),
	],
	main: [
		n("キリコの　髪から、\nまだ　湯気が　立ちのぼっていた。"),
		s("roze", "湯柱で　飛んできたアル？\n……湯冷め　する前に　着がえるアル", {
			emote: "?",
		}),
	],
	kinoko: [
		s(
			"zero",
			"きのこに　押し上げられて　きたんですか？\n……胞子、保存しておきますね",
		),
	],
	tropical: [
		n("キリコの　服は、\nまだ　しおからかった。"),
		s("feris", "島の　人たちに　送ってもらったの〜？\n……いいな〜、小舟〜", {
			emote: "♪",
		}),
	],
	konamono: [
		n("キリコの　髪は、\nソースと　焦げの　においが　した。"),
		sOr(
			s("nanj", "……焦げくさっ。\n鉄板が　噴火でも　したんか？", {
				gesture: "startle",
			}),
			s("roze", "……焦げくさいアル。\n鉄板の　火加減も　常識アル"),
		),
	],
	festival: [
		n("遠くで、神輿の　かけ声が\nまだ　聞こえていた。"),
		s(
			"shiyo",
			"……神輿で　運ばれて　きたの？\nべ、べつに　うらやましく　ないわよ",
			{ emote: "汗" },
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
 * relief は きのこ板 で5回 倒れて 本編が開いたとき（きのこ板の ネタは シヨが 貼っておく）。
 */
export const UNLOCK_LINES: Record<
	"main" | "deep" | "relief" | "colony" | "hidden",
	readonly Line[]
> = {
	main: [
		q("nanj", "次は　風呂板の　討論会や。\n……のぼせんなよ"),
		q(
			"zero",
			"風呂板への　入口、開きました！\nゼロ、いっしょには　行けませんが……",
			{ emote: "!" },
		),
	],
	// 転（tenScript）の すぐ あと。最後の 遊説先
	deep: [
		q(
			"zero",
			"電池板から、音が　します。\n……サブ機たちも、ビリビリ　してます",
			{ gesture: "shiver" },
		),
		q("nanj", "最後の　遊説や。\n……ワイも、本気で　回るで"),
	],
	relief: [
		q(
			"shiyo",
			"きのこ板の　推薦は　あたすが　頼んだわ。\n……あなたの　ためじゃ　ないから",
			{ emote: "汗" },
		),
		q("zero", "5回の　挑戦、ぜんぶ　見てました。\n……6回目も、応援します！", {
			gesture: "hop",
		}),
	],
	// 隠しの 過去ログの底（おんJタウンの 下の 古井戸）。開くのは 開票の あと
	hidden: [
		q("zero", "村の　古井戸から、音が　します。\n……いちばん　下から、です"),
		q("nanj", "古い　告示は、井戸に　しずむんや。\n……いちばん　古いのも、な"),
	],
	// 口の ない 植民地（{name} は 板の 名前）。口から 一覧で 行ける
	colony: [
		q("zero", "新しい　植民地が　見つかりました！\n{name}、です", {
			emote: "!",
		}),
		q(
			"nanj",
			"おんJ民、どこにでも　住みつくな。\n……口から　えらんで　行けるで",
		),
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
			text: "村の　口から、だれか　来た。\n頭に　きのこが　生えている。",
		},
		// 次の 遊説先の 名無し（第二話「怪文書」の 前ぶれ）
		{
			who: "visitor",
			text: "きのこ板から　来たで。\n……あんた、たけのこ派　なんやって？",
		},
		{
			who: "visitor",
			text: "親玉きのにゃんが　底で　怒っとる。\n……推薦は、むずかしいで",
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
		q("nanj", "パン板の　推薦か。\n……ほな、次は　本番やな"),
		q("roze", "パン板でも、下は　下アル。\n……おつかれアル"),
		q(
			"feris",
			"推薦、もらえて　よかったね〜。\n私、目が　いいから　見えてたよ〜",
		),
		q("shiyo", "パン板、でしょ。……ふん。\nま、まあ、よく　やったんじゃない", {
			emote: "汗",
		}),
		q("zero", "推薦状、30人　読みました！\n……ケーキは、焼けませんでした"),
	],
	main: [
		q("nanj", "討論会、ええ　勝負やったな。\n……今年も　ワイが　勝つけどな"),
		q("roze", "おかえりアル。……蓄音機、\nずっと　まわってるアル"),
		q("feris", "長湯スレ、もう1回　きこ〜。\n……もう1回だけ〜", { emote: "♪" }),
		q("shiyo", "知らない　人が　支持してるわ。\n……まあ、わるくないわよ"),
		q("zero", "長湯スレ、今日も　読みました。\n……閲覧数、ゼロが　1位です"),
	],
	// 開票の あと（キリコは 公式。やきうは 確定が とけた）
	deep: [
		q("nanj", "公式さん、今日も　安価　来とるで。\n……語尾、どれに　するんや"),
		q("roze", "今日は　ちがう　麻婆豆腐アル。\n……変わるのも、ええアル"),
		q("feris", "公式マスコット〜。\n……元マスコットから、おめでと〜"),
		q("shiyo", "投票箱、倉庫に　しまったわ。\n……来年まで、あずかってあげる"),
		q("zero", "来年の　選挙まで、あと　365日。\n……ゼロは、また　数えます"),
	],
	kinoko: [
		q("zero", "きのにゃん、まだ　蓄音機の\n上です。……どいて　くれません"),
		q("zero", "きのこ板の　名無しさん、毎日\nキリコさんを　推してます"),
		q("nanj", "植民地の　植民地や。\n……どっちが　えらいねん", { emote: "怒" }),
	],
	tropical: [
		q("feris", "ヤシの実、波の　音　した〜。\n……たぶん〜", { emote: "♪" }),
		q("roze", "島民が　7人に　なったアル。\n……キリコも　数えたアル"),
	],
	konamono: [
		q("nanj", "たこ焼き、うまかったで😡\n……あ、勝手に　ついた", {
			emote: "汗",
		}),
		q("roze", "麻婆豆腐に　たこ、\n……入れて　みたアル"),
	],
	festival: [
		q("shiyo", "うちわ、あたすが　あずかってるわ。\n……使っては　ないわよ"),
		q("nanj", "祭りのあとの　うちわや。\n……ええ　祭りやった"),
	],
	hidden: [
		q("roze", "あんな　安価で　決まるのが、\nおんJの　常識アル"),
		q("zero", "最初の　告示の　レス、数えました。\n……5番目で、決まってます"),
		q("shiyo", "……あの　告示、倉庫で　あずかるわ。\n額に　入れて　あげる"),
		q("nanj", "安価は　絶対や。\n……せやけど、次の　安価も　絶対や"),
	],
	mercury: [
		q("feris", "水星の　板、のんびりしてたね〜。\n……また　行こ〜"),
		q("zero", "かけら、まだ　光ってます。\n……ゼロ、夜に　見ています"),
	],
	onmu: [
		q("shiyo", "搭乗券、倉庫に　しまったわ。\n……いつか　使うかも　しれないし"),
		q("roze", "呑気な　板も、ええアル。\n……荒らしが　来ないのが　常識アル"),
	],
	onkimu: [
		q("roze", "キムチ、ぜんぶ　なくなったアル。\n……また　漬けるアル"),
		q("zero", "おんキムから　勧誘の　書きこみ。\n……ゼロは、ここに　います"),
	],
	inferno: [
		q("zero", "魔導書、3ページ　読みました。\n……右腕は、まだ　ふつうです"),
		q("feris", "†キリコ†って　書くと、\nかっこいいね〜。……ふふ〜", {
			emote: "♪",
		}),
	],
	vocalo: [
		q("roze", "避難所、まだ　あったアル。\n……あのころの　スレも、常識アル"),
		q("shiyo", "ロゼの　忘れ物、とどけたの？\n……ふーん、やるじゃない"),
	],
};

/** まだ一度も もぐっていない（パン板の ネタを 取りにいく前）。quotes.ts の FIRST の パン板 版。 */
export const FIRST_SHALLOW: readonly Line[] = [
	q("nanj", "パン板やで。おんJ民　お断りや。\n……ほな、今年も　ワイが　勝つで"),
	q("roze", "推薦は　底で　もらうアル。\nよく　見て　さがすアル。常識アル"),
	q("feris", "パン板なら、私も\n飛んで　行けるかな〜。……行かないけど〜"),
	q("shiyo", "心配なんか　してないわよ。\n……ちゃんと　帰って　きなさいよね"),
	q(
		"zero",
		"いってらっしゃいの　練習、\n100回　しました。……いってらっしゃい！",
		{ gesture: "hop" },
	),
];

/** パン板で倒れたとき（たおれ方の たまりより 前に見る）。 */
export const SHALLOW_DEATH: readonly Line[] = [
	q("nanj", "パン板やで？　入門の。\n……いや、パン板でも　下は　下か"),
	q("roze", "パン板は　ちいさいアル。\nあわてないのが　常識アル"),
	q("feris", "パン板でも、ころぶよね〜。\n私も　よく　ころぶ〜", {
		emote: "汗",
	}),
	q("shiyo", "杖は、ふるまで　わからないの。\n……教えて　あげたんだからね"),
	q("zero", "パン板の　ログ、読みました。\n……短いけど、ゼロは　好きです"),
];
