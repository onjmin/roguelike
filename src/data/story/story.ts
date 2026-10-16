// 植民地（ダンジョン）の物語の部品。
// - 名前と板の決まり・見た目と曲、目的の品、はじめて入る前の語り（intro）と 持ち帰ったあとの語り（ending）、
//   ボスを たおして 一瞬で 帰ったときの 語り（BOSS_RETURN）、
//   次のダンジョンが開いたときの ひとこと、起動の札と 村の ひとことの たまり。
// - 本編（main）の intro / ending は quotes.ts の INTRO / ENDING をそのまま使う。
// 筋は STORY.md §5「ダンジョン配信」。キリコも 会話に 加わる（吾輩・ンゴで 短く。望みは 台詞で 言う）。
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
	shallow: { no: "第一話", title: "初配信" },
	kinoko: { no: "第二話", title: "切り抜き" },
	main: { no: "第三話", title: "湯けむり　コラボ" },
	deep: { no: "最終話", title: "同時配信" },
	hidden: { no: "後日談", title: "いちばん古い　コメント" },
};

/** 話の おわりの 1窓（はじめて 持ち帰った とき。章の 音と いっしょに）。 */
export const episodeEnd = (d: DungeonId): StoryPage | null => {
	const e = EPISODES[d];
	return e
		? { who: null, text: `${e.no}「${e.title}」　完`, cue: "chapterEnd" }
		: null;
};

/**
 * 潜る ときの 名無しの 視聴者（やきう）の コメント（口で 行き先を 決めた あと）。最終話（電池板）までは 毎回 同じ
 * 「見とるで」（STORY.md §5。頂点で 蓄音機が 鳴らす 1つ）。最終話の あとは free から 毎回 ちがう 一言。
 */
export const DEPART = {
	/**
	 * 配信を はじめると いちばんに つく コメント（名無しの 視聴者 ＝ やきう。STORY.md §5）。最終話までは 毎回 同じ
	 * （同じ 一言の くり返しが 頂点の 伏線）。
	 */
	nanj: "配信　開始。……コメントが　1つ。\n名無し：見とるで",
	/** 最終話（電池板を 持ち帰った）の あと。潜った 回数で 回す。 */
	free: [
		"配信　開始。……いちばんの　コメント。\n名無し：見とるで。今日も　1番乗りや",
		"配信　開始。……いちばんの　コメント。\n名無し：いってら。……草野球の　合間や",
		"配信　開始。……いちばんの　コメント。\n名無し：見とるで。昼寝しながらな",
		"配信　開始。……いちばんの　コメント。\n名無し：今日は　ちがう　こと　言うで。草",
		"配信　開始。……いちばんの　コメント。\n名無し：見とるで。何万人　おっても　1番や",
	],
	/** 村に 帰って 持ち物が からっぽの とき、ぷゆゆパンを 持たせる 地の文（ぷゆゆは 村から 去らない）。 */
	puyu: "ぷゆゆが　かけてきて、\nぷゆゆパンを　持たせてくれた。",
	/** ぷゆゆソードを 渡した すぐ あとで、もう となりに いる とき（かけてこない）。 */
	puyuToo: "ぷゆゆは、ぷゆゆパンも\n持たせてくれた。",
} as const;

/**
 * 寄り道「残機」（STORY.md §5）：やきうの 頭の 上の 数を 本人が 言う。きのこ板（「残機：1」が 出た）から 最終話まで は 1
 * （名無しには 残機が ふえない）。最終話の あとは、遺影祭り（お祭り会場）を 持ち帰って いれば 99（キリコが 配信で
 * 名無しの コメントを 鳴らして、遺影の 書きこみが やっと 数に なった）。
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
/** パン板の 持ち帰り（毎回）。はじめての ときは この あとに やきうの「見とったで」。 */
const SHALLOW_BASE: readonly StoryPage[] = [
	n("村に　帰りつくと、広場の　画面で\nロゼの　1万人　配信が　流れていた。"),
	n("……うしろで、ヒゲの　子が\n転んでいた。キリコだった。"),
	s("roze", "映りこみ、伸びてるアル。\n……切り抜きの　題、見るアル", {
		emote: "汗",
	}),
	// 迎えの 掛け合いは 2〜3人まで（だれが だれか 知らない 人が 流し読み しないように）
	s("zero", "登録者、ふえました！\n……3人です", {
		emote: "!",
	}),
];

/**
 * 転（STORY.md §5）：風呂板の 語りを 見おえた 帰りに 1回だけ（ui/village/villageReturn.ts の tenScript）。
 * ゼロが 広場の 地面の 小さい 字を 読み、ダンジョンは 視聴者の コメントが 積もった もので、いちばん下の 1つ目は
 * キリコの 初配信の「見とるで」だと わかる。大会で 町の 下が 抜ける。キリコは 1位を とって 配信を 切ると 決める
 * （最初の 望み「名前を　おぼえて　ほしい」は 1位の 配信で かなう。それを 自分で 切る 側を えらぶ）。
 */
export const TEN_NEWS = {
	pages: [
		n("朝。広場の　石だたみの　前で、ゼロが\n虫眼鏡を　3つ　重ねていた。"),
		s("zero", "キリコさん。地面の　字、\nぜんぶ　コメントです。数えました", {
			emote: "!",
		}),
		n("「草」「乙」「見とるで」……\n石だたみの　すきまに、コメントの　層。"),
		s(
			"zero",
			"ダンジョンの　壁も、同じです。\n……見る　人が　多いほど、深く　なります",
		),
		s("roze", "……だから　中が　ネットの　ネタ\nだらけ　なのアル", {
			emote: "!",
		}),
		s("zero", "パン板の　いちばん下の　層。\n1つ目の　コメントは……"),
		n("「見とるで」\n……キリコの　初配信の　日付。"),
		s("nanj", "……名無しの　コメントは\n消えへんのや。積もるんや", {
			emote: "…",
		}),
		s("zero", "変電所の　同時配信大会、\n何十万人　来ます。……計算しました"),
		s("zero", "町の　下、ぜんぶ　掘れます。\n……町が、抜けます", {
			emote: "汗",
		}),
		s(
			"feris",
			"……だから　言ったでしょ〜。\n伸びるって、たのしい　だけじゃ　ないよ〜",
		),
		s("shiyo", "……じゃあ、大会　やめれば？\n……やめないわよね、だれも"),
		k("……吾輩が　1番　とって、\nそこで　配信　切るンゴ"),
		s("nanj", "……名前、おぼえて　もらうんや\nなかったんか"),
		k("……あとで、ふつうに\nおぼえて　もらうンゴ"),
		s("nanj", "……草。ほな、電池板や。\nいちばん下に、町の　主電源が　ある"),
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
		note: "「配信、まだ？」",
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
		note: "「配信予定：毎日　ナイター」",
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
		note: "「規制で　書けん。登録は　した」",
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
		note: "「切り抜き、燃やしといたで」",
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
			// 階が 枠で 1000 で 終わる わけ（STORY.md §5「しくみと 話の つなぎ」）
			"階は、配信の　枠。動くたび、コメントが　つく。\n……1000まで　埋まると、次の　枠へ。",
		],
		ending: [
			...SHALLOW_BASE,
			// 1人目の 視聴者。名無しは 名前を おぼえる（転と 頂点の 前ぶれ）
			s("nanj", "初配信、見とったで。\n……同接　1人。ワイや"),
			k("吾輩の　名前、\nおぼえたンゴ？"),
			s("nanj", "おぼえたで。……名無しは、\n名前を　おぼえるんが　仕事や", {
				emote: "…",
			}),
		],
		again: SHALLOW_BASE,
	},
	main: { intro: INTRO, ending: ENDING, again: ENDING_AGAIN },
	deep: {
		intro: [
			"電池板。でんちゃんの　板。\n最終話の　配信先。",
			"いちばん　下に、\n町の　主電源が　しずんでいるという。",
			"キリコは　蓄音機を　かかえた。",
			"……でん、と　鳴った。",
		],
		ending: [
			// 頂点（STORY.md §5「同時配信」）：にぃちぇの 登録で キリコが 1位に なり、配信を 切って 町を 止める。
			// 暗い 中で 蓄音機が 初配信の「見とるで」を 鳴らす
			n(
				"大会の　日。変電所の　前は、\n5人の　配信者と　機材で　いっぱいだった。",
			),
			mob(
				"hinary",
				"5人　同時配信大会。\n同接の　いちばん　多い　人が　1位です",
			),
			s("shiyo", "……数え　まちがえたら、\nゼロの　せいだからね"),
			s("zero", "数えます。……ゼロ、\nちゃんと　数えます"),
			// 読みあげの ドラムロールが、のこり 1人の 鐘（res999）へ つながる
			{
				...n("ゼロが　同接を　読みあげる。\n「キリコ」「ロゼ」「キリコ」……"),
				se: "mix",
			},
			{
				...s("zero", "……ロゼさんと　同じ　数です。\nのこり、1人", {
					emote: "!",
				}),
				cue: "res999",
			},
			// のこり 1人の 張りつめた ところで、鯖が 落ちる（すぐ もどる）
			{
				...n("町じゅうが、息を　のんだ。\n……その　とき、鯖が　落ちた。"),
				se: "batonDown",
			},
			n("……3秒で　もどった。\nだれも、なにも　言わなかった。"),
			{
				...n("……登録者が　1人　ふえた。\n押したのは、にぃちぇだった。"),
				cue: "res1000",
			},
			// 承から 置いた 小ネタ（にぃちぇは 毎回 日を まちがえる）の 回収
			mob("nichie", "今日、大会　だったニィ？\n……はじめて　合ってたニィ"),
			s("zero", "ちゃんと　数えました。\n……1人　差です"),
			s("roze", "……負けたアル。今日は、\n麻婆豆腐　ふた鍋アル", { emote: "♪" }),
			mob("hinary", "1位の　配信者は、大会の　最後に\n1つ　決められます"),
			n(
				"足もとが　ゆれた。……町の　下で、\nコメントの　層が　まだ　掘れていく。",
			),
			k("……配信、切るンゴ。\n町の　主電源、落とすンゴ"),
			mob("hinary", "……規則上、有効です"),
			{
				...n("キリコは　主電源を　落とした。\n……町じゅうの　画面が、消えた。"),
				se: "uncurse",
			},
			n("まっくらな　広場で、\n蓄音機だけが　まわりだした。"),
			n("何万の　コメントの　中から、\n1つ　だけ　鳴った。"),
			n("「見とるで」\n……初配信の、1人目の　コメント。"),
			k("……これ、だれンゴ？"),
			s("nanj", "……知らんな。\n名無しの　やろ", { emote: "…" }),
			// 寄り道「残機」を 終えて いれば、名無しの コメントが 鳴った その 場で（祭りで 書いた 遺影が、やっと 数に なる）。
			// 本気の 一言の あと、笑いで 落とす（遺影は、みんなが 構って くれた 数）
			{
				...n("暗い　中で、1UPの　音が\n鳴りはじめた。"),
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
				seRepeat: 7,
				seGap: 180,
			},
			{
				...s("nanj", "うるさいわ！　……草", { emote: "怒" }),
				needCleared: "festival",
			},
			n("主電源を　もどすと、\n町に　明かりが　ついた。"),
			n("さっそく、キリコの　枠に\nコメントが　とんできた。"),
			nanashi("名無しさん", ">>1　語尾　アルに　しろ"),
			k("……わかったアル"),
			s("roze", "それ、わたしのアル！", { emote: "怒" }),
			n("みんなが、キリコの　名前を\n呼んで　笑った。"),
			n("ランキング掲示板の　いちばん上に、\nキリコの　名前が　あった。"),
		],
		again: [
			n("村に　帰りつくと、\n町は　今日も　配信だらけだった。"),
			s("nanj", "1位さん、おかえり。\n……今日の　語尾は　なんや"),
			k("……まだ、ンゴンゴ"),
		],
	},
	kinoko: {
		intro: [
			"きのこ板。\nきのこと　たけのこが、ずっと　もめる　板。",
			"着くなり、スマホが　降ってきた。\n切り抜き「キリコは　たけのこ派」",
			"2本目。「キリコは　たけのこ」",
			"3本目。「たけのこが　本体」",
			"キリコは　蓄音機を　かかえた。\n……言って　ないンゴ。きのこ民の　目が、つめたい。",
		],
		ending: [
			n("村に　帰りつくと、\nゼロが　かけよってきた。"),
			s(
				"zero",
				"キリコさん、頭に　きのこが\n生えてます！　……撮れ高、ですか？",
				{
					emote: "!",
				},
			),
			n("きのにゃんが　蓄音機に　すわりこんだ。\n……登録、した　らしい。"),
			k("……ほんまに　生えとるンゴ？"),
		],
		// 切り抜き（小さな 問い。第三話で 職人が わかる）と、寄り道「残機」の 入口（STORY.md §5）
		once: [
			{
				...n(
					"きのにゃんの　毛に、紙が　1枚。\n切り抜きの　台本「キリコは　たけのこ派」",
				),
				se: "read",
			},
			s("roze", "切り抜きアル。\n……言って　ない　ことを　つないだアル", {
				emote: "怒",
			}),
			// うわさが 一日で ふくらむ（町の 配信の 話）
			n(
				"その　日の　うちに、たけのこ説の\n切り抜きが　3本　出て、3本とも　伸びた。",
			),
			s("nanj", "ワイや　ないで。\n……配信には、こういうの　つきもんや"),
			n("やきうの　頭の　上に、小さく\n「残機：1」と　出ていた。"),
			{ ...k("……その　数字、\nなにンゴ？"), about: "nanj" },
			s("nanj", "……気に　すんな。\n名無しの　残機は、ふえへんのや", {
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
			// 島の 配信ネタ：総島民 6人の 登録（登録率 100％、分母 6）
			n("割ると、中から　ナツコの　手紙。\n「島民6人中、6人が　登録した」"),
			s("zero", "登録率、100％です！\n……分母が、6ですけど", { emote: "汗" }),
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
			// おんたこの 配信ネタ：コラボの 条件は 概要欄の 末尾に 😡（怒って いるのでは なく たこ焼きの 顔）。
			// 紙は 舟の 底（once の 包み紙＝帳簿とは べつ）
			n(
				"舟の　底に、大たこのみんの　注文。\n「概要欄の　末尾に　😡を　つけること」",
			),
			k("……みんなに　やさしい　配信に\nするンゴ😡"),
			s("nanj", "……怒っとる　ように　しか\n見えへん。草"),
		],
		// 寄り道「残機」②：名無しの 帳簿。残機の 正体は 遺影スレの 書きこみ
		once: [
			{
				...n("たこ焼きの　包み紙は、\n古い　帳簿の　切れはしだった。"),
				se: "read",
			},
			n("「名無し　残機1　やきう」\n「名無し　残機1　やきう」……毎年。"),
			s("roze", "……名無しには、\n残機が　ふえないアル？", { emote: "!" }),
			s("nanj", "……せや。名前が　ないと、\nだれの　残機か　わからんのや"),
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
			// 祭りの 配信ネタ：うちわの 表に マシーの 字（あおぐ／煽る。once の「裏」の 字とは べつ）
			n(
				"うちわの　表に、マシーの　字。\n「祭りも　配信も、あおった　もん勝ち」",
			),
			s("shiyo", "……あおるの　意味が、ちがうわよ", { emote: "怒" }),
		],
		// 寄り道「残機」③：遺影祭り。書いても 数は 動かない（名無しには 届かない。最終話の あとに 回収）
		once: [
			n("うちわの　裏に、マシーの　字。\n「今夜　やきうの　遺影祭り」"),
			{
				...n("その　夜、村じゅうで\nやきうの　遺影を　書いた。"),
				se: "pencil",
			},
			s("feris", "はい〜、遺影〜。\nやきうくん、成仏して〜", { emote: "♪" }),
			s("nanj", "生きとるわ！", { emote: "怒" }),
			n("……やきうの　頭の　上は、\n「残機：1」の　まま　だった。"),
			s("zero", "書きこみ、98件。数えました。\n……表示が、動きません", {
				emote: "?",
			}),
			s("nanj", "……名無し、やからな"),
		],
	},
	hidden: {
		intro: [
			"おんJタウンの　下に、古い　井戸が　ある。\nいちばん　古い　コメントは、ここへ　しずむ。",
			"いちばん　下には、2005年の\n最初の　コメントが　あるという。",
			"キリコは　蓄音機の　ハンドルを　まわした。\n……ひとりで、降りる。",
		],
		ending: [
			// 後日談（STORY.md §5「いちばん古い　コメント」）：いちばん 下の 層は フェリスの 生まれ
			n("村に　帰りつくと、\n広場は　今日も　にぎやかだった。"),
			n("キリコは　井戸の　そばで、\nいちばん古い　コメントを　ひらいた。"),
			n("2005年12月29日。なんでも実況J。\n原住民の　ころの　スレ。"),
			nanashi("名無しさん", "ふぇ…ふぇ……フェニックス！"),
			n("……町で　いちばん　古い\nコメント　だった。"),
			s("feris", "……私の、はじまりの　声〜。\nこんな　ところに　あったんだ〜", {
				emote: "…",
			}),
			s("zero", "いちばん　下の　層、ですからね"),
			// 古い コメントが 掘り起こされて、スレが 一気に 埋まる（1000 で 書けなくなる しくみと 同じ）
			n("その　コメントに、今日　レスが　ついた。"),
			nanashi("名無しさん", ">>1　なつかしすぎて　草"),
			n(
				"1時間で、スレは　1000まで　埋まった。\n……2005年の　スレが、2回目の　1000。",
			),
			// 「草が　生えた」を そのまま 音に する（草の 音を 3つ）
			{
				...n("広場じゅうで、草が　生えた。"),
				se: "kusa",
				seRepeat: 3,
				seGap: 160,
			},
			k("……>>1、明日も　配信ンゴ"),
		],
		again: [
			n("村に　帰りつくと、\n井戸の　そばには　だれも　いなかった。"),
			n(
				"キリコは　いちばん古い　コメントを\nひらいた。「ふぇ…ふぇ……フェニックス！」",
			),
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
			// 水星の 配信ネタ：だれも 怒らない 板の、いちばん ゆるい 評価
			n("かけらの　裏に、水星の　コメント。\n「高評価も　低評価も　押さんで」"),
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
			// ムー大陸の 配信ネタ：シヨの「行き先、書いてない」の 回収
			n("よく　見ると、「行き先」の　欄は\n「チャンネル登録」の　欄だった。"),
			k("……キリコって、書いとくンゴ"),
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
			// おんキムの 配信ネタ：ここでも 勧誘（もう 配信して いる 人を）
			n(
				"壺の　ふたの　裏に、勧誘の　紙。\n「キリコさん、おんキムで　配信しませんか？」",
			),
			k("……吾輩、もう　配信してるンゴ"),
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
			// インフェルノの 配信ネタ：邪気眼の 応援（ゼロの「右腕は　ふつう」に もう一段）
			n(
				"応援の　文は「†漆黒の　高評価を†」。\n……高評価は、ふつうの　ボタンだった。",
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
			// しんみりの あとに 笑いで 落とす（ロゼの 語尾。その 場で 使いきるので、最終話の「それ、わたしのアル！」と 食い違わない）
			s("roze", "……お礼に、語尾を　1回だけ\n貸してあげるアル", { emote: "花" }),
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
		q("nanj", "次は　風呂板で　コラボや。\n……のぼせんなよ"),
		q(
			"zero",
			"風呂板への　入口、開きました！\nゼロ、いっしょには　行けませんが……",
			{ emote: "!" },
		),
	],
	// 転（tenScript）の すぐ あと。最終話の 配信先
	deep: [
		q(
			"zero",
			"電池板から、音が　します。\n……サブ機たちも、ビリビリ　してます",
			{ gesture: "shiver" },
		),
		q("nanj", "最終話や。\n……ワイも、最後まで　見とるで"),
	],
	relief: [
		q(
			"shiyo",
			"きのこ板の　切り抜き、消させたわ。\n……あなたの　ためじゃ　ないから",
			{ emote: "汗" },
		),
		q("zero", "5回の　挑戦、ぜんぶ　見てました。\n……6回目も、応援します！", {
			gesture: "hop",
		}),
	],
	// 隠しの 過去ログの底（おんJタウンの 下の 古井戸）。開くのは 最終話の あと
	hidden: [
		q("zero", "村の　古井戸から、音が　します。\n……いちばん　下から、です"),
		q(
			"nanj",
			"古い　コメントは、井戸に　しずむんや。\n……いちばん　古いのも、な",
		),
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
		// 次の 配信先の 名無し（第二話「切り抜き」の 前ぶれ）
		{
			who: "visitor",
			text: "きのこ板から　来たで。\n……あんた、たけのこ派　なんやって？",
		},
		{
			who: "visitor",
			text: "親玉きのにゃんが　底で　怒っとる。\n……コラボは、むずかしいで",
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
		q("nanj", "初配信、見とったで。\n……ほな、次は　本番やな"),
		q("roze", "パン板でも、下は　下アル。\n……おつかれアル"),
		q("feris", "初配信、おめでと〜。\n私、目が　いいから　見えてたよ〜"),
		q("shiyo", "パン板、でしょ。……ふん。\nま、まあ、よく　やったんじゃない", {
			emote: "汗",
		}),
		q("zero", "アーカイブ、30回　見ました！\n……ケーキは、焼けませんでした"),
	],
	main: [
		q("nanj", "コラボ、ええ　湯やったな。\n……コメント、湯気で　見えへんかった"),
		q("roze", "おかえりアル。……蓄音機、\nずっと　まわってるアル"),
		q("feris", "長湯スレ、もう1回　きこ〜。\n……もう1回だけ〜", { emote: "♪" }),
		q("shiyo", "知らない　人が　登録してるわ。\n……まあ、わるくないわよ"),
		q("zero", "長湯スレ、今日も　読みました。\n……閲覧数、ゼロが　1位です"),
	],
	// 最終話の あと（キリコは 1位。配信を 切って 町を 止めた）
	deep: [
		q("nanj", "1位さん、今日も　安価　来とるで。\n……語尾、どれに　するんや"),
		q("roze", "今日は　ちがう　麻婆豆腐アル。\n……負けるのも、ええアル"),
		q("feris", "1位、おめでと〜。\n……元1位から、おめでと〜"),
		q(
			"shiyo",
			"……主電源、もう　落とさないでよ。\nまっくらで、こわかったんだから",
		),
		q("zero", "次の　大会まで、あと　365日。\n……ゼロは、また　数えます"),
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
		q("roze", "いちばん　古いのが　フェリスなのも、\nおんJの　常識アル"),
		q("zero", "古い　コメント、数えました。\n……1つ目は、フェリスさんです"),
		q("shiyo", "……あの　コメント、額に　入れて\nフェリスに　あげたら？"),
		q("nanj", "古い　コメントも、消えへん。\n……名無しの　やつも、な"),
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
	q("nanj", "パン板やで。おんJ民　お断りや。\n……ほな、見とるで"),
	q("roze", "撮れ高は　底に　あるアル。\nよく　見て　さがすアル。常識アル"),
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
