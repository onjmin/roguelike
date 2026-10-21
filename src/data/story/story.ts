// 植民地（ダンジョン）の物語の部品。
// - 名前と板の決まり・見た目と曲、目的の品、はじめて入る前の語り（intro）と 持ち帰ったあとの語り（ending）、
//   ボスを たおして 一瞬で 帰ったときの 語り（BOSS_RETURN）、
//   次のダンジョンが開いたときの ひとこと、起動の札と 村の ひとことの たまり。
// - 本編（main）の intro / ending は quotes.ts の INTRO / ENDING をそのまま使う。
// 筋は STORY.md §4.9「おんJの 板を めぐる 話」。キリコも 会話に 加わる（吾輩・ンゴ。望みは 台詞で 言う）。
// 1行は全角22字・2行まで。笑いが 先、シリアスは 落差で（STORY.md §0）。

import { ITEMS } from "../../core/data/items";
import type { DungeonId } from "../../core/types";
import type { Story } from "../../engine/defs";
import { type Cue, cueOf } from "../../engine/emote";
import type { PictureSpec } from "../../engine/sceneCard";
import { CAST } from "../people/cast";
import { art } from "../village/rpgenArt";
import { base } from "../village/tiles";
import { boardOf, boardPicture, itemPicture, propPicture } from "./pictures";
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

// ───────────────── 村に いない 仲間（まだ 帰ってきて いない） ─────────────────
/**
 * 仲間が 町に 帰ってくる 板（どれか 1つを 持ち帰ると 帰ってくる。null は はじめから 町に いる）。
 * みんな 飽きて 出ていった 町に 残ったのは やきうだけ（STORY.md §4.9）。ライバルは よその 板へ 先回りして いて、
 * その 板の 話が 片づくと キリコと 同じ 船で 帰ってくる：ロゼは パン板で 王に 説教、ゼロは パン兵を 数えに、
 * シヨは 商店街の メイド喫茶の バイトが もどって、フェリスは 浜の ステージか 電池板の 底から。
 */
export const FRIEND_BACK: Record<Speaker, readonly DungeonId[] | null> = {
	nanj: null,
	roze: ["shallow"],
	zero: ["shallow"],
	shiyo: ["kinoko"],
	feris: ["tropical", "deep"],
};

/**
 * 村に いない 仲間（まだ 帰ってきて いない：FRIEND_BACK の 板を どれも 持ち帰って いない）。一度 帰ったら 出ていかない。
 * いない 人は 村に 立たず、語り・知らせ・喫茶・起動の札でも 話さない。
 */
export const awayFriends = (cleared: readonly DungeonId[]): Speaker[] =>
	(Object.keys(FRIEND_BACK) as Speaker[]).filter((w) => {
		const back = FRIEND_BACK[w];
		return !!back && !back.some((d) => cleared.includes(d));
	});

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
	deep: { no: "最終話", title: "盛るまでもない" },
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
		"港の掲示板に、書きこみが1つ。\n名無し：今日のスレは、まだ白紙や",
		"港の掲示板に、書きこみが1つ。\n名無し：いってら。人、おるで",
	],
	/** 村に 帰って まだ お弁当を もらって いない とき、ぷゆゆパンを 持たせる 地の文（ぷゆゆは 村から 去らない）。 */
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
			? "頭の上の「残機：1」か？\n気にすんな！"
			: cleared.includes("festival")
				? "頭の上、「残機：99」や！\n多すぎて、使い道がないわ！"
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
const k = (text: string, c?: Cue): StoryPage => ({
	who: null,
	text,
	kiriko: "voice",
	...c,
});
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
// ───────────────── 台詞に 出てきた 物の 実物の 絵 ─────────────────
// 騒ぎの 規模の 段（町 → 日本 → 世界）は 札と 矢印の 図で なく、台詞と 人の 動き（go・look・cut・turnAway）で 見せる
// （STORY.md §0「図は 実物の 絵」。2026-10-18 作者「どういう ところに ついている 見出しか 画像を もってこい」）。
// 絵に するのは 文に 出てきた 物だけ：広場の 立て札・たこ焼きの 舟の 字・屋台の 鉄板・丘の 太鼓・掲示板の 書きこみ。

/** 第一話：広場に 立った 入国審査の 立て札（道の わきの 立て札と 同じ 絵。data/village/tiles.ts の i）。 */
const CUSTOMS_SIGN: PictureSpec = {
	...propPicture(base(5, 37, 1, 2), "広場の立て札", { text: "入国審査" }),
	note: "広場だけで43か所（ゼロ調べ）",
};

/** 寄り道おんたこ：たこ焼きの 舟の 底に 書いて ある 粉もん奉行の 字。 */
const BOAT_NOTE = itemPicture("takoyaki", "たこ焼きの舟の底", {
	text: "次の招待状も、末尾に😡",
});

/** 寄り道おんたこ：たこ八の 鉄板（屋台の 柱の 右。data/village/eateries.ts と 同じ 絵）。焦げあとは 町に 残る。 */
const GRIDDLE: PictureSpec = {
	...propPicture(art("stallPole", 1), "たこ八の鉄板"),
	note: "193か国ぶん、まっ黒",
};

/** 最終話：掲示板に 出た 管理人の 書きこみ。 */
const ADMIN_POST = boardPicture("鯖代払い忘れとったわ", "管理人の書きこみ");

/** 第一話：ロゼが 取ってきた 日本に 1枚の 申請書（キリコが 蓄音機に かけて 割る）。 */
const APPLICATION = itemPicture("memo", "ロゼが取ってきた申請書", {
	text: "独立とりけし申請書\n（日本に1枚）",
});

/** 品の 絵（core/data/items.ts の icon。持ち帰った 品が 文に 出てきた とき）。 */
const iconPicture = (
	id: string,
	title: string,
	paper?: PictureSpec["paper"],
): PictureSpec => propPicture(ITEMS[id]?.icon ?? "", title, paper);

/** 寄り道 離島：ヤシの実の 中の ナツコの 手紙。 */
const NATSUKO_LETTER = itemPicture("memo", "ヤシの実の中の手紙", {
	text: "島民6人、全員ぶじに\n帰りました　ナツコ",
});

/** 後日談：いちばん 古い レス（品の 絵）に 書いて ある 字。 */
const oldThread = (paper: string): PictureSpec =>
	itemPicture("g1001", "いちばん古いレス", { text: paper });

/** パン板の 持ち帰り（毎回）。はじめての ときは この あとに やきうの ひとこと。 */
const SHALLOW_BASE: readonly StoryPage[] = [
	// カメラは パン兵の 帰った 広場（data/town/incidents.ts の 騒ぎは 語りの あいだ もう 片づいて いる）
	{ ...n("村に帰りつくと、広場の旗が\nおろされていた。"), look: [20, 21] },
	// 迎えの 掛け合いは 2〜3人まで（だれが だれか 知らない 人が 流し読み しないように）。ボケ（ゼロ）→ ツッコミ（ロゼ）
	{
		...s("zero", "パン兵さん、帰りました！\n両手をふって見送りました！", {
			emote: "!",
		}),
		look: null,
		go: [{ who: "zero", to: "kiriko", speed: 3 }],
	},
	{
		...s("roze", "帰したのは、わたしの説教アル！\n手柄をとるなアル！", {
			emote: "怒",
		}),
		go: [{ who: "roze", to: "kiriko", speed: 3 }],
	},
];

/**
 * 転（STORY.md §4.9）：風呂板の 語りを 見おえた 帰りに 1回だけ（ui/village/villageReturn.ts の tenScript）。
 * 町の 電気は 電池板から 来て いた。停電で 生き返った 通りが ぜんぶ 消える（成果が 一度 消える）。
 */
export const TEN_NEWS = {
	pages: [
		// 明かりと いっしょに 曲も 消える（無音）。見出しから 警報の 曲（落ちた鯖）。
		// カメラは 人の いる 灯った 広場で、目の 前の 明かりが 消える
		{
			...n("その夜、町じゅうの明かりが\nいっせいに消えた。"),
			bgm: null,
			sky: "dark",
			look: [20, 21],
		},
		// 風呂板の 追いだき（キリコが 連打した ボタン）の 天丼。今度は キリコの せいでは ない
		{
			...nanashi("暗い銭湯の客", "追いだきが止まった！"),
			look: [36, 27],
		},
		{ ...k("今度は吾輩じゃないンゴ！"), look: null },
		s("zero", "停電です！町の電気、\nぜんぶ電池板から来てました！", {
			emote: "!",
		}),
		k("吾輩が、蓄音機で\n発電するンゴ！", { gesture: "hop" }),
		{
			...n("キリコはハンドルを全力で回した。\n豆電球が1個ついて、はじけた。"),
			se: "glassBreak",
			fx: "blackout",
		},
		// 停電は 電気の 方へ ふくらむ（明かり → 家電が 逆回り → 時計が 昨日へ。最終話で 鯖ごと 暗転して 回収）
		s("zero", "冷蔵庫が牛乳を温めてます！\n時計は、昨日にもどってます！", {
			emote: "!",
		}),
		k("家電が逆回りンゴ！？\n吾輩のせいンゴ！？", { emote: "!" }),
		s("roze", "家電がみんな\nムーンウォークしてるアル！", {
			emote: "驚",
			hit: "slap",
		}),
		// 生き返った 通りが ぜんぶ 消えた（成果が 一度 消える）。ここから 警報の 曲（落ちた鯖）
		{
			...n("明かりは、もどらなかった。\n生き返った通りも、ぜんぶ暗い。"),
			bgm: "deep4",
			look: [45, 17],
		},
		{
			...s("shiyo", "商店街まで消えたじゃない！\nあたすのバイト先よ！", {
				emote: "驚",
			}),
			look: null,
		},
		s("feris", "電池板の人、電気代を\n請求しに来るかも〜！"),
		k("電池板、充電しに行くンゴ！"),
		s("nanj", "おう！停電で\nナイター見れんしな！", { emote: "怒" }),
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
			"いちばん栄えた植民地。入門の4階",
			"パン松の縄張り：パンがよく出る",
			"杖だけ未識別。のろいなし。3階でパレード",
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
			"ぜんぶ未識別。祭りが多い。8階に売店",
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
	// 束音ロゼの 競争（engine/heroes.ts）
	vocalo: {
		name: "ボカロ作り避難所",
		short: "ボカロ避難所",
		nick: "ロゼの避難先",
		mascot: "文字化け",
		rules: [
			"荒らされた総合スレの避難所。6階",
			"コピペが多い。荒らしが追ってきた",
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
	| "miku"
	| "forge"
	| "moss"
	| "crystal"
	| "cyber"
	| "lava"
	| "gold"
	| "sulfur";

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
		note: "「スレ、まだ？」",
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
		bgm: "deq_volcano",
		ambient: "data",
	},
	{
		last: 90,
		name: "焦げた回線",
		note: "「スレ、燃やしといたで」",
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
	// 硫黄の 黄色い 坑道（源泉の 通り道。湯気が ただよう）
	main: { theme: "sulfur", bgm: "field2", ambient: "snow" },
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
	// ボカロ作り避難所：荒らしの あとの 静かな 避難所（ミク色の 電子の 格子）
	vocalo: { theme: "miku", bgm: "tekitou", ambient: "miku" },
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
			"階は、1本のスレ。動くたび、レスがつく。\n1000まで埋まると、次のスレへ。",
		],
		ending: [
			SHALLOW_BASE[0],
			// ロゼと ゼロは パン板へ 先回りして いた（王に 説教・パン兵を 数えに）。同じ 船で 町に 帰ってくる（FRIEND_BACK）。
			// ゼロの サブ機 プロト・レンも 同じ 船（data/people/mobs.ts の ZERO_UNITS）：口の 前に 3機 並んで いる
			k("ロゼとゼロ3機も、パン板から\n同じ船で帰ってきたンゴ！"),
			...SHALLOW_BASE.slice(1),
			// 独立は 制度の 方へ ふくらむ（国境線 → 入国審査 → 通貨 → 日本 47か国 → 申請書）。場所を 大きく するより、
			// 制度が 1枚ずつ ふえる。ロゼの 申請書で 片づく はずが、キリコが 蓄音機に かけて 割る（解決の つもりで 悪化）。
			// 国境線の チョークは 町に 残る（data/town/revival.ts の 広場・ぷゆゆの 節目）。
			// ここから ずっこけの 曲（界隈曲その4）。翌朝の 書きこみで 切る
			{
				...k("吾輩も独立するンゴ！\n国旗は、蓄音機ンゴ！", { gesture: "hop" }),
				bgm: "kaiwai4",
			},
			// 広場へ 場面を うつして、キリコが 線を 引きながら 横に 走る（線は 地図に 描く：ui/village/sceneChalk.ts）
			{
				...n("キリコは広場のまんなかに、\nチョークで国境線を引いた。"),
				se: "pencil",
				seRepeat: 4,
				cut: [20, 22],
				chalk: true,
				go: [{ who: "kiriko", to: [15, 22], speed: 1.4, face: "right" }],
			},
			// ゼロは 3機（メインさん・プロト・レン）で 線に かけよって、3機で ひっぱりあう（画面に 3機 いる ときだけ
			// 「3機」と 言う：2026-10-18 作者）
			{
				...s("zero", "その線、ゼロもほしいです！\n3機ぶん、ほしいです！", {
					gesture: "hop",
				}),
				go: [
					{ who: "zero", to: "kiriko" },
					{ who: "proto", to: "kiriko" },
					{ who: "ren", to: "kiriko" },
				],
			},
			{
				...n("ゼロ3機が、国境線を\nひっぱりあって転がりまわった。"),
				se: "hit_fist",
				seRepeat: 3,
				go: [
					{ who: "zero", route: "rrllllrr", speed: 3 },
					{ who: "proto", route: "llrrrrll", speed: 3 },
					{ who: "ren", route: "ddlluurr", speed: 3 },
				],
			},
			// ロゼの 持ちネタ：「〜が常識アル」と 言い切ると、あとで 常識の ほうが 都合よく かわる（STORY.md のライバル節）
			s("roze", "内戦も独立も、\n非常識アル！", { emote: "驚", hit: "whack" }),
			// ロゼは 広場の 反対の はしへ 走って 自分の 国を 建てる。やきうが 追いかけて ツッコむ
			{
				...s("roze", "……独立は、今日から常識アル！\n麻婆共和国アル！", {
					gesture: "spin",
				}),
				go: [{ who: "roze", to: [25, 21], face: "down" }],
			},
			{
				...s("nanj", "ツッコミ役が独立すんな！", { emote: "驚", hit: "slap" }),
				go: [{ who: "nanj", to: [24, 21], face: "right" }],
			},
			// 1時間後の 止め絵（国民 0人）。みんな 背を 向けて 独立。カメラは シャッターの 通り、絵は 広場の 入国審査の 立て札
			{
				...n("1時間後。店も人もみんな独立。\n国民0人、入国審査だけ43か所。"),
				skip: true,
				fx: "chiin",
				turnAway: true,
				card: CUSTOMS_SIGN,
				look: [45, 17],
			},
			{
				...s("nanj", "パン1個買うのに、\nパスポート3回見せたわ！", {
					emote: "冷",
				}),
				look: null,
			},
			// ゼロの 持ちネタ：3機で 数える → サブ機が 数を 訂正する（STORY.md のライバル節）
			s("zero", "入国審査、43か所です！\n3機で数えました！", { emote: "得" }),
			{
				who: null,
				mob: "proto",
				text: "訂正ゼロ。44か所。\nロゼの共和国のぶんゼロ",
				pause: 400,
			},
			// 通貨が できる（制度の 次の 段）
			s("zero", "ゼロ、お金も刷りました！\n1キリコ＝パンくず1粒です！", {
				emote: "!",
			}),
			// 服に パンくずを つけて 見せる（BOSS_RETURN で もう ついて いれば そのまま）
			{
				...k("吾輩の服、パンくずで\n大金持ちンゴ！", { gesture: "hop" }),
				wear: "crumbs",
			},
			// 日本 47か国は 数の 段（絵に できる 物が ない）：台詞と、つづく やきうの 亡命で 見せる
			{
				...n("翌朝。独立は県境をこえて、\n日本は47の国にわかれていた。"),
				skip: true,
				card: null,
			},
			// やきうが 亡命して いる あいだに、ロゼは 通りへ 走って 申請書を 取りに いく
			// やきうは 東へ 走って 亡命（書きこみの 頁で もどって くる）
			{
				...s("nanj", "ワイ、大阪国に亡命や！\nビザ代はパンくずで払うで！", {
					gesture: "hop",
				}),
				go: [
					{ who: "roze", to: [20, 18], speed: 3 },
					{ who: "nanj", to: [26, 21], speed: 3, face: "right" },
				],
			},
			{
				...s("roze", "申請書を取ってきたアル！\nこれで日本はもとどおりアル！", {
					emote: "!",
				}),
				go: [{ who: "roze", to: "kiriko", speed: 3 }],
				// 持ってきた 紙の 実物（蓄音機に かけて 割れるまで 出して おく）
				card: APPLICATION,
			},
			// 主人公が 最悪の 手を 打つ（申請書を レコードと まちがえる）→ 直後に 自己ツッコミ。
			// 蓄音機（VILLAGE_SPOTS.phono 19,21）の 前まで 走って から かける
			{
				...k("それ、レコードンゴ？\nかけてみるンゴ！", { gesture: "hop" }),
				go: [{ who: "kiriko", to: [19, 22], speed: 3, face: "up" }],
			},
			{
				...n("キリコが申請書を蓄音機にかけると、\n紙は粉々にくだけた。"),
				se: "glassBreak",
				fx: "chiin",
				card: null,
			},
			k("吾輩、日本を割ったンゴ！！", { emote: "青", hit: "sting" }),
			// ツッコミは 人を 突く（紙を 見て かける 人は キリコだけ）
			s("roze", "紙は、回らないアル！！", {
				emote: "驚",
				hit: "whack",
				pause: 600,
			}),
			// 翌朝の 書きこみで 追い打ち。この 書きこみは 掲示板に 残る（data/town/headlines.ts の AFTER_HEADLINES）
			{
				...n("掲示板に、書きこみがひとつ。\n『【悲報】キリコ、日本を割る』"),
				se: "read",
				look: [15.5, 21],
				card: boardOf("『【悲報】キリコ、日本を割る』"),
				bgm: null,
				// 亡命した やきうが もどって くる
				go: [{ who: "nanj", to: "kiriko", speed: 3 }],
			},
			{ ...k("盛ってないンゴ！\n本当に割ったンゴ！"), look: null, card: null },
			k("だれが書いたンゴ？"),
			// 書いたのは やきう（言いわけの 天丼の 1回目。第三話は インクまみれ：quotes.ts の ENDING）
			s("nanj", "知らん。", { emote: "冷" }),
			k("手、チョークの粉まみれンゴ"),
			s("nanj", "これは、パンくずや！", { emote: "汗", pause: 400 }),
		],
		again: SHALLOW_BASE,
	},
	main: { intro: INTRO, ending: ENDING, again: ENDING_AGAIN },
	deep: {
		// 予告編の 語り口（洋画の 型。鉄塔は 荒らしに 占拠されて いる：core/setpiece.ts の 15階の 籠城）
		intro: [
			"その町の電気は、すべて\n電池板から来ていた。",
			"人が残らなかった植民地。\n鉄塔は、荒らしに占拠された。",
			"てっぺんには、町の主電源。\n向かうのは、ひとり。",
			"キリコは蓄音機をかかえた。",
			"でん、と鳴った。",
		],
		ending: [
			// 頂点（STORY.md §4.9「明かりの もどる 坂と、祭り」）
			// 持ち帰りの 明るい 曲を 止める（明かりの 坂まで 無音）
			{
				...n(
					"村に帰りつくと、港は真っ暗だった。\n坂の上まで、明かりがひとつもない。",
				),
				bgm: null,
				// 時計に かかわらず 夜。明かりの 坂（lightsUp）で 町の 明かりが もどる
				sky: "dark",
			},
			// 明かりの もどる 坂（ui/village/villageReturn.ts の playCue。暗い 町で 生き返った 通りを 順に 見せて、
			// 明るい 町に 建て直す）。その 前に キリコが 自分で 言う（地の文を 2枚 続けない）
			k("電池、つないでくるンゴ！", { gesture: "hop" }),
			{
				...n(
					"キリコが坂を上がると、生き返った\n通りに、明かりがひとつずつともった。",
				),
				cue: "lightsUp",
				// 場面の 曲（界隈曲その2。最後の サビで 全音 上がる）。鯖代の 書きこみで 止める
				bgm: "kaiwai2",
			},
			// 広場の 祭り：来る 人は 持ち帰った 板で きまる（本筋の 3つは かならず）。寄り道の 人は 自分で しゃべる
			nanashi(
				"パン兵",
				"明かりや！パン兵も、きのこ軍も、\n42℃の番頭も、みんな来たで！",
			),
			{
				...nanashi("島民", "島ごと泳いで来たで！\n帰りもクロールや！"),
				needCleared: "tropical",
			},
			{
				...nanashi("たこ民", "たこ焼き、配ったるで😡\n怒ってへんで😡"),
				needCleared: "konamono",
			},
			{
				...nanashi("親分", "祭りや！"),
				needCleared: "festival",
				se: "hit_club",
				seRepeat: 3,
			},
			// 電池ニキの 持ちネタ：いつも ネガティブ（「どうせ」で 先に 悪いほうを 言う）
			nanashi("電池ニキ", "人が来た……どうせ、\nワイの電気が足らんのや"),
			// やきうが 人ごみを かきわけて 掲示板へ（カメラも ついていく）。14年 盛って きた 人が、はじめて 書かない
			{
				...n("やきうは掲示板の前で、チョークを\n持ったまま止まった。"),
				go: [{ who: "nanj", to: [15, 22], face: "up", follow: true }],
			},
			{ ...k("書かないンゴ？", { emote: "?" }), look: null },
			{
				...s("nanj", "……盛るまでもないわ！\n見てみい、この人の数！", {
					gesture: "hop",
					pause: 600,
				}),
				go: [{ who: "nanj", to: "kiriko" }],
			},
			// 寄り道「残機」の 回収（遺影祭りを 持ち帰って いれば）：親分の 号令で 板の 人たちが 遺影を 書いて、やっと 数に なる
			{
				...nanashi("親分", "ほな、遺影祭りや！\nみんな、やきうを書け！"),
				needCleared: "festival",
			},
			{
				...n("遺影が1枚ふえるたびに、1UP。\n98回鳴った。「残機：99」"),
				zanki: 99,
				needCleared: "festival",
				se: "arcBest",
				seRepeat: 5,
				seGap: 400,
				// 紙吹雪（やきうの 本音の 行で 止んで、ツッコミで また 降る）
				fx: "confetti",
			},
			{
				...s(
					"zero",
					"書きこみ98件。みんなが名前を\n呼んだので、宛先が通りました",
					{
						emote: "!",
					},
				),
				needCleared: "festival",
				fx: "confetti",
			},
			{
				who: null,
				mob: "proto",
				text: "訂正ゼロ。99件。1件は\n本人の自演で、無効ゼロ",
				needCleared: "festival",
				pause: 400,
			},
			{
				...s("nanj", "98回も殺されとったんかい！\nワイの命、回数券か！", {
					emote: "驚",
					hit: "slap",
				}),
				needCleared: "festival",
			},
			{
				...s("nanj", "1UPの音、うるさいわ！草", { emote: "怒" }),
				needCleared: "festival",
				fx: "confetti",
			},
			// 落差の オチ（201 の 作者が ゲームを 閉じる 型）。停電は 町 → 板 → 鯖ごとへ。鯖ごと 落ちる。
			// 曲が ぷつっと 切れて、無音の まま 暗転と ロールバック
			// カメラは 掲示板、絵は 貼られた 管理人の 書きこみ
			{
				...n("祭りの最中、管理人の書きこみ。\n『鯖代払い忘れとったわ』"),
				bgm: null,
				fx: "confetti",
				look: [15.5, 21],
				card: ADMIN_POST,
			},
			{
				...s("nanj", "管理人、おったんかい！", {
					emote: "驚",
					hit: "whack",
					pause: 700,
				}),
				look: null,
			},
			// ぷつっと 暗転（キリコの ひとことまで 真っ黒。翌朝で 明ける）。本筋で 宇宙まで 行くのは ここだけ。
			// 停電の 広がり（町 → 板 → 宇宙）は 図で なく 暗転 その もので 見せる
			{
				...n("町も、板も、宇宙も、画面ごと\nまっくらになった。"),
				se: "batonDown",
				fx: "blackout",
				card: null,
			},
			{ ...k("鯖ごとンゴ！！", { emote: "青" }), fx: "blackout" },
			// まっくらの 中で キリコが 最終手段（鯖代を ぷゆゆパンで 払う）。それで 本当に もどる
			// メタ：暗転でも 窓の 字は 読める
			{
				...s("nanj", "画面が真っ暗でも、\n字は読めるんやな！", {
					emote: "驚",
					hit: "slap",
				}),
				fx: "blackout",
			},
			{ ...k("吾輩が、鯖代を\n払ってくるンゴ！"), fx: "blackout" },
			{
				...n("キリコがぷゆゆパンを1個送ると、\n翌朝、町はもとにもどっていた。"),
				skip: true,
				se: "pay",
				sky: null,
			},
			k("パンで払えたンゴ！？", { emote: "!" }),
			{
				...n(
					"掲示板に、書きこみがひとつ。\n『【悲報】ワイらの冒険、ロールバック』",
				),
				se: "read",
				look: [15.5, 21],
				card: boardOf("『【悲報】ワイらの冒険、ロールバック』"),
			},
			{ ...nanashi("名無し", "キリコ生きてて草"), look: null, card: null },
		],
		again: [
			n("村に帰りつくと、\n町は今日も明るかった。"),
			s("nanj", "おかえり！\n今日は、なんも盛らんとくわ"),
		],
	},
	kinoko: {
		intro: [
			"きのこ板。\nパン板に植民された、植民地の植民地。",
			"町を行進していったきのこ軍は、\nここから出てきたらしい。",
			"行き先は、パン板。\n11年ごしの、仕返しらしい。",
			"キリコは蓄音機をかかえた。\n行進の足音が、下からする。",
		],
		ending: [
			// ずっこけの 曲（界隈曲その4）。はじめての ときは once の 残機の 前で 切る。かわりの 頁も 同じ 曲
			{
				...n("村に帰りつくと、\nゼロがかけよってきた。"),
				about: "zero",
				bgm: "kaiwai4",
				// 帰りついた ときから キリコの 頭に きのこ（行進が 摘みとるまで。once が なければ 場面の おわりまで）
				wear: "kinoko",
				go: [{ who: "zero", to: "kiriko", speed: 3 }],
				instead: {
					...n("村に帰りつくと、\n頭がむずむずした。"),
					bgm: "kaiwai4",
					wear: "kinoko",
				},
			},
			// ボケ（ゼロ）→ すぐ ツッコミ（キリコ）
			s("zero", "キリコさん、頭にきのこが\n生えてます！数えますか？", {
				emote: "!",
			}),
			k("数えんでええンゴ！", { hit: "slap" }),
			// 商店街は 生き返りの 知らせまで シャッターが おりた まま（ご近所の きのにゃんも まだ 来て いない）
			{
				...n("商店街は、シャッターが\nぜんぶおりたままだった。"),
				look: [42, 17],
			},
			{
				...s(
					"zero",
					"倉庫の封鎖、謝りません！\n書きこみを128回読んで信じました！",
					{
						emote: "汗",
					},
				),
				look: null,
			},
			k("読みすぎンゴ！", { hit: "slap" }),
		],
		// 頭の きのこが 町に ひろがる（商店街 → 港まで）。行進の オチで 摘みとられ、寄り道「残機」の 入口へ
		once: [
			// 商店街が 生き返って、シヨが メイド喫茶の バイトに もどってくる（FRIEND_BACK）
			// カメラは 商店街の メイド喫茶の 前（シヨは 口の 前に 並ばず そこで 待つ）
			{
				...n("メイド喫茶の前に、エプロンの\nシヨが帰ってきていた。"),
				look: [32, 19],
			},
			{
				...s("shiyo", "べ、べつに帰ってきたわけじゃ\nないわよ！バイトよ！", {
					emote: "汗",
				}),
				standAt: [32, 19],
			},
			// シヨの 導入（2026-10-18 作者「導入なしに 唐突に 表れる」）：キリコは 知らない 人（STORY.md §0 の 3）。
			// 場面を 喫茶の 前へ うつして、シヨは バイトの 手を 止めずに 名乗る（説明は 動きの 中で）。UTAU組の 先輩で、
			// 湯の 温度に うるさい（第三話の 前ふり）
			{ ...k("……どなたンゴ？", { emote: "?" }), cut: [32, 20] },
			{
				...s(
					"shiyo",
					"シヨよ！おんJ生まれの声なら、\nあたすが先輩！覚えなさい！",
					{
						emote: "怒",
					},
				),
				go: [{ who: "shiyo", to: "kiriko", speed: 3 }],
			},
			{
				...n("シヨはお盆の紅茶を、\nキリコに押しつけた。きっちり43℃。"),
				se: "pay",
			},
			k("ぬるいンゴ"),
			{
				...s("shiyo", "出禁よ！！", { emote: "怒", hit: "punch", pause: 400 }),
				go: [{ who: "shiyo", route: "udud", speed: 3 }],
			},
			// 胞子は 生き物の 方へ ふくらむ（キリコの 頭 → 商店街の 看板 → 町の 人の 頭 → 町の 人ごと 行進）。生える 所が
			// 物から 人に かわる。キリコが 抜くと ふえ、ゼロが 扇風機で 人へ 飛ばし、キリコの 行進曲で 町の 人が 行進に
			// 組みこまれる。行進は 世界を 1周して 人の 頭の きのこだけ 摘む。看板の しめじは 残る（data/town/revival.ts）
			{
				...n("キリコの頭から胞子がぽふっ。\n10分後、商店街の看板がしめじに。"),
				spores: true,
				look: [45, 17],
				shrooms: "street",
			},
			{
				...s("shiyo", "メイド喫茶の看板まで、\nしめじ！営業妨害よ！", {
					emote: "怒",
				}),
				look: null,
			},
			k("吾輩が、ぜんぶ\n抜いてくるンゴ！", { gesture: "hop" }),
			// キリコは 桟橋を 走って 船の そばで 抜く → まわりが きのこの 森に
			{
				...n(
					"キリコが1本抜くと、胞子が10倍。\n港の船まで、きのこの森になった。",
				),
				spores: true,
				shrooms: "port",
				go: [{ who: "kiriko", to: [20, 45], face: "down" }],
			},
			k("吾輩、農家の才能\nあるンゴ！", { emote: "得" }),
			s("shiyo", "才能の使い方が逆よ！！", {
				emote: "驚",
				hit: "punch",
			}),
			{
				...s("zero", "ゼロ、扇風機で\n胞子をふきとばします！", {
					gesture: "spin",
				}),
				go: [{ who: "zero", to: "kiriko", speed: 3 }],
			},
			// 生き物の 段（頭 → 看板 → 町の 人 → 行進 → 世界 1周）は 図で なく、胞子・地図の きのこ・みんなの 行進で 見せる
			{
				...n("胞子は風にのって、こんどは\n町の人の頭に生えた。"),
				spores: true,
				wearAll: "kinoko",
			},
			s("nanj", "ワイの頭、エリンギや！\n帽子かぶれへん！", { emote: "怒" }),
			// ロゼの 持ちネタ：言い切った 常識が、自分の 頭に 生えたら かわる
			s("roze", "頭にきのこは、\n非常識アル！", { emote: "怒" }),
			s("roze", "……似合うなら、\n常識アル", { emote: "花", pause: 400 }),
			// 行進は 港から 桟橋を 上がって きて、キリコの 手前に 列で 止まる（ui/village/sceneMarks.ts の march。
			// 場面の おわりまで 桟橋に いる）
			{
				...n("そこへ行進が、パン板の手前で\nくるりと向きをかえて帰ってきた。"),
				look: [20, 49],
				mark: "march",
				se: "hit_club",
				seRepeat: 4,
				seGap: 220,
			},
			{
				...nanashi(
					"きのこ軍",
					"仲間が町じゅうにおる！\nみんな、行進に入れたる！",
				),
				look: null,
			},
			// 主人公が 最悪の 手（行進曲で 先導）→ 町の 人ごと 行進
			k("吾輩が、行進曲で\n先導するンゴ！", { gesture: "hop" }),
			{
				...n("キリコが行進曲をかけると、町の人が\nきのこごと行進しはじめた。"),
				se: "pushButton",
				// 桟橋を みんなで 行って もどる
				go: [
					{ who: "kiriko", route: "uuuDddd", speed: 1.6 },
					{ who: "zero", route: "uuuDddd", speed: 1.6 },
					{ who: "roze", route: "uuuDddd", speed: 1.6 },
					{ who: "nanj", route: "uuuDddd", speed: 1.6 },
				],
			},
			s("zero", "行進、128本から\n1万3千本になりました！", { emote: "!" }),
			{
				who: null,
				mob: "proto",
				text: "訂正ゼロ。1万3千と1本。\nキリコの頭のぶんゼロ",
			},
			// メタ：画面に 描けない 数を その場の 人が 言う（桟橋の 行進は 5本：ui/village/sceneMarks.ts）
			s("zero", "1万3千本は描けないので、\n画面には5本で表しています！", {
				emote: "得",
			}),
			s("nanj", "なんでワイ、\n行進しとんねん！", { emote: "驚" }),
			s("nanj", "……楽しいからや！", { gesture: "hop", pause: 400 }),
			// 頭の きのこは 摘まれる（キリコのも）。看板の しめじは 残る
			{
				...n(
					"行進は世界を1周して帰ってきて、\n人の頭のきのこだけ摘んでいった。",
				),
				wear: null,
				wearAll: null,
				// 場面の 森は 消える。商店街の 扉の わきの きのこは 残る（ui/village/sceneShrooms.ts）
				shrooms: null,
			},
			nanashi("きのこ軍", "40分で1周や！\n看板のしめじは、おまけや！"),
			{
				...n(
					"掲示板に、書きこみがひとつ。\n『【悲報】キリコ、町じゅうを苗床にする』",
				),
				se: "read",
				look: [15.5, 21],
				card: boardOf("『【悲報】キリコ、町じゅうを苗床にする』"),
			},
			// 天丼「盛ってないンゴ」（第一話「本当に割った」→ ここは 書きこみの ほうが ひかえめ）
			{
				...k("盛ってないンゴ！\nむしろ、ひかえめンゴ！", { emote: "得" }),
				look: null,
				card: null,
			},
			// ずっこけの 曲を 切って、残機の 前ふり
			{
				...n("やきうの頭の上に、小さく\n「残機：1」と出ていた。"),
				zanki: 1,
				bgm: null,
			},
			{ ...k("その数字、\nなにンゴ？", { emote: "?" }), about: "nanj" },
			s("nanj", "気にすんな！\nゲームのしすぎや！", { emote: "冷" }),
		],
	},
	tropical: {
		intro: [
			"離島・沖縄板。\n総島民は、6人。",
			"浜に押しかけてきた島民を、\n山の上の集落まで送り返す。",
			"うわさでは、島の山の上に\n1UPがひとつあるという。",
			"キリコは蓄音機をかかえた。\n波の音が、下からする。",
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
			{
				...n("キリコはヤシの実を蓄音機に\nのせてみた。回らない。"),
				card: iconPicture("yashi", "ヤシの実"),
			},
			s("roze", "回すより、\n割って飲むアル！"),
			// 総島民 6人（分母 6）。絵は 中から 出た 手紙
			{
				...n("割ると、中からナツコの手紙。\n「島民6人、全員ぶじに帰りました」"),
				se: "read",
				card: NATSUKO_LETTER,
			},
			s("zero", "生還率、100％です！\n分母は6です！", { emote: "!" }),
			{
				who: null,
				mob: "proto",
				text: "訂正ゼロ。分母は7。\nナツコが自分を数えてないゼロ",
				pause: 400,
			},
			// 島が 好きすぎて 町に 来たかった（板の 事情）。キリコが 呼ぶ → 島が 泳いで 港に 突っこむ → 日本の 形が かわる
			// キリコは 船着き場の はしへ 走って 沖に 呼びかける
			{
				...k("島ごと来たらええンゴ！\n港、空いてるンゴ！", { gesture: "hop" }),
				card: null,
				go: [{ who: "kiriko", to: [23, 50], face: "down" }],
			},
			// 夜の 沖（カメラは 海の ほう）
			{
				...n("その夜、沖でゴゴゴと地鳴り。\n島が、泳ぎはじめた。"),
				skip: true,
				se: "bubble",
				sky: "night",
				look: [24, 51],
			},
			{
				...s("feris", "島がクロールしてる〜！\n速い〜！", {
					gesture: "hop",
				}),
				look: null,
			},
			// フェリスの 持ちネタ：やきうの 出題に、斜め上の 答え（おんJwiki の「フェリスの お勉強」）
			{
				...s("nanj", "問題や。島が時速30キロなら、\n港まで何分や？"),
				about: "feris",
			},
			s("feris", "港が逃げたら、\n追いつかれません〜", { emote: "♪" }),
			// みんなで 桟橋を 浜まで 逃げる（キリコに カメラが ついていく）
			{
				...k("こっちに来るンゴ！！\n逃げるンゴ！！", { emote: "!" }),
				go: [{ who: "all", to: [20, 34], speed: 3 }],
			},
			{
				...n("島は止まりきれずに、\n港へ突っこんだ。"),
				se: "explosion",
				fx: "boom",
				// 地形の 段（島 → 港 → 日本地図）は 図で なく、港を 映す カメラと 爆発と、港に 突っこんだ 島
				// （ui/village/sceneMarks.ts）で 見せる
				look: [26, 47],
				mark: "island",
			},
			// みんなで 桟橋の 港の 前へ 見に 行く（島が 見える 所）
			{
				...k("港に、島が\n縦列駐車したンゴ！", { emote: "得" }),
				look: null,
				go: [{ who: "all", to: [24, 42], speed: 3, face: "right" }],
			},
			// 執着の 型：島の 泳ぎ方に 常識を 求める
			s("roze", "港の前でターンするのが、\n泳ぎの常識アル！！", {
				emote: "驚",
				hit: "whack",
				pause: 500,
			}),
			{
				...n(
					"掲示板に、書きこみがひとつ。\n『【悲報】キリコ、日本の形をかえる』",
				),
				se: "read",
				sky: null,
				look: [15.5, 21],
				card: boardOf("『【悲報】キリコ、日本の形をかえる』"),
			},
			{
				...s("nanj", "国土地理院から、\n電話きとるで！", {
					emote: "青",
					hit: "sting",
				}),
				look: null,
				card: null,
				go: [{ who: "nanj", route: "lrlr", speed: 3 }],
			},
			// 島は 沖へ もどる（町の 地図は かわらない）。日本地図だけ 書きかわった まま
			sOr(
				{
					...s(
						"feris",
						"島、バックで帰ってく〜！\n地図だけ、書きかわったまま〜！",
						{
							gesture: "hop",
						},
					),
					unmark: "island",
				},
				{
					...s(
						"zero",
						"島、バックで帰っていきます！\n地図だけ書きかわったままです！",
						{
							emote: "!",
						},
					),
					unmark: "island",
				},
			),
			// ロゼの 持ちネタ：さっきの「ターンが 常識」が、島に 合わせて かわる
			s("roze", "……バックで帰るのが、\n泳ぎの常識アル", {
				emote: "得",
				pause: 400,
			}),
		],
		// 寄り道「残機」①：1UP は にせもの（ナツコの 自由研究）
		once: [
			{
				...n("ヤシの実に、マジックで\n「1UP」と書いてあった。"),
				card: iconPicture("yashi", "ヤシの実（うら）", { text: "1UP" }),
			},
			{
				...s("feris", "それ、ナツコちゃんの字〜。\n夏休みの自由研究だよ〜", {
					emote: "汗",
				}),
				card: null,
			},
			s("nanj", "にせもんか！草"),
			{
				...k("残機って、どうやったら\nふえるンゴ？", { emote: "?" }),
				about: "nanj",
			},
			s("nanj", "知らん！\nワイが知りたいわ！", { emote: "怒" }),
		],
	},
	konamono: {
		intro: [
			"おんたこの雑居ビル。\nレスの末尾に、😡がつく板。",
			"招待状の末尾にも、😡。\n宣戦布告、らしい。",
			"キリコは蓄音機をかかえた。\n上の階から、ソースのにおいがする。",
		],
		ending: [
			nAbout(
				"村に帰りつくと、\nやきうが鼻をひくつかせていた。",
				"nanj",
				"村に帰りつくと、\nロゼが鼻をひくつかせていた。",
			),
			// 😡が タコの 顔だと わかる 行（知らない 人にも 落ちる 言い方：赤いのは 怒りでなく ゆでだこ）
			s(
				"nanj",
				"たこ焼きやんけ！😡はタコの顔や。\n怒っとるんやない、ゆでられとるんや",
				{
					emote: "!",
				},
			),
			// ボケに ボケを かぶせる（ツッコミ不在）
			s("roze", "ゆでだこなら、麻婆に入れても\n怒られないアル！", {
				emote: "♪",
			}),
			// 招待状の 😡（怒って いるのでは なく たこ焼きの 顔）。紙は 舟の 底（once の 包み紙＝帳簿とは べつ）。
			// キリコが まねして 世界へ 出す → 193か国が 宣戦布告と 受けとる → 首脳が たこ焼き器で 上陸 →
			// キリコが お手本の つもりで 全部 焦がす（町 → 世界。丸く 収めず 書きこみで 追い打ち）
			// 絵は 舟の 底の 字
			{
				...n("舟の底に、粉もん奉行の字。\n「次の招待状も、末尾に😡」"),
				card: BOAT_NOTE,
			},
			{ ...k("吾輩も、招待状を\n出すンゴ😡", { gesture: "hop" }), card: null },
			// 外交の 方から 料理の 方へ（招待状 → 宣戦布告 → 首脳の たこパ → 焦げ）。焦げあとは 屋台の 鉄板に 残る。
			// 193通は 数の 段：ビンを 流す キリコ・返事の 手紙・首脳の 舟（ui/village/sceneMarks.ts）で 見せる
			// 招待状を 出す 手の 動き：桟橋の 先へ 走って、ビンに つめて 海へ 流す
			{
				...n("キリコは招待状を193本のビンにつめて、\n海へ流した。"),
				se: "bubble",
				seRepeat: 4,
				seGap: 160,
				go: [{ who: "kiriko", to: [21, 50], speed: 3, face: "down" }],
				// 流した ビンが 沖へ（ui/village/sceneMarks.ts。3日後で しまう）
				mark: "bottles",
			},
			// 時間を とばして、返って きた 手紙の 実物
			{
				...n("3日後。ビンの返事が193通、\nぜんぶ宣戦布告だった。"),
				skip: true,
				unmark: "bottles",
				se: "read",
				card: itemPicture("memo", "ビンの返事（193通）", {
					text: "宣戦布告😡",
				}),
			},
			{
				...s("nanj", "😡のせいやんけ！", { emote: "驚", hit: "slap" }),
				card: null,
			},
			// みんなで 船着き場の はしへ 出て 沖を 見る
			{
				...n("翌日。各国の首脳が、\nたこ焼き器をかかえて上陸してきた。"),
				skip: true,
				// 上陸と たこパは 昼（村の 時計も 昼から すすむ）
				sky: "day",
				go: [{ who: "all", to: [21, 51], face: "down" }],
				look: [21, 51],
				// 桟橋の 両わきに 首脳の 舟（ui/village/sceneMarks.ts）
				mark: "boats",
			},
			{
				...s("roze", "戦争じゃなくて、\nたこパしに来たアル！？", {
					emote: "驚",
				}),
				look: null,
			},
			// メタ：首脳の 舟は 4そう（ui/village/sceneMarks.ts の BOATS）
			s("zero", "首脳、193人です！\n数えました！", { emote: "得" }),
			{
				who: null,
				mob: "proto",
				text: "訂正ゼロ。画面には、\n4人しか映ってないゼロ",
				pause: 400,
			},
			k("吾輩が、焼き方の\nお手本を見せるンゴ！", { gesture: "hop" }),
			// 浜の 屋台（たこ八）へ 場面を うつす。キリコが 鉄板の 前へ 走る。絵は その 鉄板（焦げあとは 町に 残る）
			{
				...n(
					"キリコが鉄板の火を最大にすると、\n193か国ぶんのたこ焼きが火を噴いた。",
				),
				se: "explosion",
				fx: "boom",
				cut: [22, 33],
				card: GRIDDLE,
			},
			k("焼きすぎたンゴ！！", { emote: "冷" }),
			{
				...s("nanj", "😡の顔のまま、\nまっ黒やんけ！", {
					emote: "驚",
					hit: "whack",
				}),
				go: [{ who: "nanj", to: "kiriko", speed: 3 }],
			},
			nanashi("首脳たち", "焦げたけど、うまかったで😡\n毎年来るで😡"),
			{
				...n(
					"掲示板に、書きこみがひとつ。\n『【悲報】キリコ、世界を怒らせる😡』",
				),
				se: "read",
				look: [15.5, 21],
				card: boardOf("『【悲報】キリコ、世界を怒らせる😡』"),
			},
			// 193か国ぶんの 麻婆の 皿を さがして ロゼが 右往左往
			{
				...s("roze", "毎年来るアル！？\n麻婆の皿が、193枚足りないアル！", {
					emote: "!",
				}),
				look: null,
				card: null,
				go: [{ who: "roze", route: "llrrrrll", speed: 3 }],
			},
		],
		// 寄り道「残機」②：名無しの 帳簿。残機の 正体は 遺影スレの 書きこみ
		once: [
			// 包み紙の 帳簿と その うらの 走り書きは 実物の 絵（文が 読んで いる 字）
			{
				...n("たこ焼きの包み紙は、古い帳簿。\n「名無し残機1　やきう」が毎年。"),
				se: "read",
				// 紙は 1行 10字まで（それより 長いと 折り返して 読めない）
				card: itemPicture("takoyaki", "包み紙（古い帳簿）", {
					text: "名無し残機1　やきう\n名無し残機1　やきう\n名無し残機1　やきう",
				}),
			},
			s("roze", "名無しには、\n残機がふえないアル！？", { emote: "!" }),
			s("nanj", "せや！名前がないと、\nだれの残機かわからんのや！"),
			{
				...n("帳簿のうらに、走り書き。\n「残機は、遺影スレの書きこみの数」"),
				se: "read",
				card: itemPicture("takoyaki", "帳簿のうら（走り書き）", {
					text: "残機は、\n遺影スレの書きこみの数",
				}),
			},
			{
				...s("zero", "遺影スレ……みんなで\nやきうさんを殺すスレ、ですね！", {
					emote: "!",
				}),
				card: null,
			},
			s("nanj", "物騒に言うな！\n昔は毎日殺されとったわ！", { emote: "怒" }),
		],
	},
	festival: {
		intro: [
			"お祭り会場のやぐら。\n猛虎弁の使える、雑談の板。",
			"にぎやかだったころの祭りが、\nやぐらの上でまだ続いている。",
			"親分が、やぐらから\n降りられないらしい。",
			"キリコは蓄音機をかかえた。\n太鼓の音が、上からする。",
		],
		ending: [
			nAbout(
				"村に帰りつくと、\nシヨが腕を組んで待っていた。",
				"shiyo",
				"村に帰りつくと、\n太鼓の音が耳にのこっていた。",
			),
			{
				...s(
					"shiyo",
					"うちわ？祭りに行ってたの！？\nあたす、呼ばれてないけど！",
					{
						emote: "怒",
					},
				),
				go: [{ who: "shiyo", to: "kiriko", speed: 3 }],
			},
			n("キリコはうちわで、\nシヨをあおいだ。"),
			s("shiyo", "べ、べつに暑くないわよ！\nもっと強くあおいで！", {
				emote: "怒",
			}),
			// うちわの 表に 親分の 字（あおぐ／煽る。once の「裏」の 字とは べつ）
			// 暴力系ヒロイン：口より 先に 手が 出る
			s("shiyo", "顔にあてないでよ！\n前髪がくずれるでしょ！", {
				emote: "怒",
				hit: "punch",
			}),
			{
				...n(
					"うちわの表に、親分の字。\n「祭りも書きこみも、あおったもん勝ち」",
				),
				card: iconPicture("uchiwa", "親分のうちわ（表）", {
					text: "祭りも書きこみも、\nあおったもん勝ち",
				}),
			},
			// 掛けことばを 説明せず、シヨが 乗る（あおがれて いるのは 自分）
			{
				...s("shiyo", "じゃあ、あたすがいちばん\nあおがれてるわね！", {
					emote: "♪",
				}),
				card: null,
			},
			// 音の 方へ ふくらむ（太鼓 → 地面を つきぬけて ブラジル → 地球の 裏と 太鼓で 口論 → 町の 窓ガラスが サンバ）。
			// 解決の つもりで キリコが たたき返す。地面の 下の サンバは 町に 残る（data/town/revival.ts の 丘の 神社）。
			// 親分の 次の 祭りの ひとことは 結の 伏線
			k("吾輩も、たたくンゴ！", { gesture: "hop" }),
			// 丘の やぐら広場の 太鼓の 前（13,7。太鼓は 13,6）へ 場面を うつして 連打。太鼓は 画面に 映って いるので
			// 拡大図は 出さない
			{
				...n("キリコはうちわの柄で、\n町の太鼓を連打した。"),
				se: "hit_club",
				seRepeat: 6,
				seGap: 110,
				cut: [13, 7],
				go: [{ who: "kiriko", to: [13, 7], face: "up" }],
			},
			{
				...s("shiyo", "あたすの耳、まだ\nドンドン鳴ってるわよ！", {
					emote: "怒",
					gesture: "shiver",
					hit: "punch",
				}),
				go: [{ who: "shiyo", to: "kiriko", speed: 3 }],
			},
			// 音の 段（太鼓 → 地球の 裏 → 町の 窓ガラス）は 図で なく、太鼓の 音・ゼロの 走り・窓ガラスの 通りを 映す カメラで 見せる
			// 地面の 下の サンバは 太鼓の 足もとの ♪（ui/village/sceneMarks.ts の samba。町に 残る 絵と 同じ）
			{
				...n("1時間後。地面の下から、\nサンバの太鼓が返ってきた。"),
				skip: true,
				se: "hit_club",
				seRepeat: 4,
				seGap: 160,
				mark: "samba",
			},
			{
				...s("zero", "発信元、ブラジルです！\n太鼓、1分に300回です！", {
					emote: "!",
				}),
				go: [{ who: "zero", route: "lrlr", speed: 3 }],
			},
			{
				who: null,
				mob: "proto",
				text: "訂正ゼロ。301回。\n1回は、シヨのげんこつゼロ",
				pause: 400,
			},
			k("返事するンゴ！\nもっと強くたたくンゴ！", { gesture: "hop" }),
			{
				...n("キリコがたたき返すと、\nブラジルもたたき返してきた。"),
				se: "hit_club",
				seRepeat: 6,
				seGap: 90,
				fx: "confetti",
			},
			// 町の 通りの 窓ガラスを 映す
			{
				...s("shiyo", "町じゅうの窓ガラスが、\nサンバの拍子で鳴ってるわよ！", {
					emote: "怒",
				}),
				look: [45, 17],
			},
			{
				...nanashi("親分", "ほな次の祭りは、町でやろか。\nブラジルも呼んだれ"),
				look: null,
				card: null,
			},
			{
				...n(
					"掲示板に、書きこみがひとつ。\n『【悲報】キリコ、ブラジルと太鼓で口論』",
				),
				se: "read",
				look: [15.5, 21],
				card: boardOf("『【悲報】キリコ、ブラジルと太鼓で口論』"),
			},
			{
				...k("口論じゃないンゴ！\n会話ンゴ！", { emote: "得" }),
				look: null,
				card: null,
			},
			s("shiyo", "どっちでもうるさいわよ！！", {
				emote: "驚",
				hit: "whack",
				pause: 500,
			}),
		],
		// 寄り道「残機」③：遺影祭り。書いても 数は 動かない（名無しには 届かない。最終話の あとに 回収）
		once: [
			{
				...n(
					"うちわの裏に「今夜やきうの遺影祭り」。\nその夜、村じゅうで遺影を書いた。",
				),
				skip: true,
				sky: "night",
				se: "pencil",
				card: iconPicture("uchiwa", "親分のうちわ（裏）", {
					text: "今夜\nやきうの遺影祭り",
				}),
			},
			// フェリスの 書いた 遺影（やきうの 歩行グラの 1コマ目を 額に）
			{
				...s("feris", "はい〜、遺影〜。\nやきうくん、成仏して〜", {
					emote: "♪",
				}),
				card: {
					...propPicture(
						`${CAST.nanj.walk}#0,0,16,16`,
						"やきうの遺影",
						undefined,
						6,
					),
					note: "本人は生きている",
				},
			},
			{ ...s("nanj", "生きとるわ！", { emote: "怒" }), card: null },
			// 最終話の 前：名無しには 届かない（最終話の 祭りで 回収）
			{
				...n("やきうの頭の上は、\n「残機：1」のままだった。"),
				unlessCleared: "deep",
			},
			{
				...s("zero", "書きこみ98件！\nなのに表示が動きません！", {
					emote: "?",
				}),
				unlessCleared: "deep",
			},
			{
				...s("nanj", "名無しやからや！\nシステムの不具合や！", { emote: "怒" }),
				unlessCleared: "deep",
			},
			// 最終話の あと：祭りで みんなが やきうの 名前を 呼んだ あとなので、ここで 数が 動く
			{
				...n("1UPの音が、鳴りやまない。\n98回鳴った。「残機：99」"),
				zanki: 99,
				needCleared: "deep",
				se: "arcBest",
				seRepeat: 5,
				seGap: 400,
				// 紙吹雪（やきうの 本音の 行で 止んで、ツッコミで また 降る）
				fx: "confetti",
				// 最終話の 頂点の 曲（明かりの坂）で 回収
				bgm: "kaiwai2",
			},
			{
				...s(
					"zero",
					"書きこみ98件。みんなが名前を\n呼んだので、宛先が通りました",
					{
						emote: "!",
					},
				),
				needCleared: "deep",
				fx: "confetti",
			},
			{
				...s("nanj", "98回も殺されとったんかい！\nワイの命、回数券か！", {
					emote: "驚",
					hit: "slap",
				}),
				needCleared: "deep",
			},
			{
				...s("nanj", "1UPの音、うるさいわ！草", { emote: "怒" }),
				needCleared: "deep",
				fx: "confetti",
			},
		],
	},
	hidden: {
		intro: [
			"おんJタウンの下に、古い井戸がある。\nいちばん古いレスは、ここへしずむ。",
			"いちばん下には、2005年の\n最初のレスがあるという。",
			"キリコは蓄音機のハンドルをまわした。\nひとりで、降りる。",
		],
		ending: [
			// 後日談「いちばん古いレス」：いちばん 下の 層は フェリスの 生まれ。カメラは にぎやかな 広場
			{
				...n("村に帰りつくと、\n広場は今日もにぎやかだった。"),
				look: [20, 21],
			},
			// 井戸の そばへ 場面を うつして、レスを ひらく（実物の 絵）
			{
				...n("キリコは井戸のそばで、\nいちばん古いレスをひらいた。"),
				cut: [24, 22],
			},
			{
				...n("2005年12月29日。なんでも実況J。\n原住民のころのスレ。"),
				se: "read",
				card: oldThread("2005/12/29\nなんでも実況J"),
			},
			{
				...nanashi("名無しさん", "ふぇ…ふぇ……フェニックス！"),
				card: oldThread("ふぇ…ふぇ……\nフェニックス！"),
			},
			k("吾輩より、\n先輩ンゴ！", { emote: "驚" }),
			// 自分の 声を 聞いて フェリスが かけよる
			{
				...s("feris", "私の、はじまりの声〜！\n思ったより、かすれてる〜！", {
					emote: "…",
				}),
				go: [{ who: "feris", to: "kiriko", speed: 3 }],
			},
			{
				...s("zero", "21年ものです！\n数えました！", { emote: "得" }),
				go: [{ who: "zero", to: "kiriko", speed: 3 }],
			},
			{
				who: null,
				mob: "proto",
				text: "訂正ゼロ。20年と10か月。\nワインなら、まだ若いゼロ",
				pause: 400,
			},
			// 古い レスが 掘り起こされて、スレが 一気に 埋まる（1000 で 書けなくなる しくみと 同じ）
			// 苦さから 光へ（つづきの原盤）
			{ ...n("そのレスに、今日レスがついた。"), bgm: "deep6" },
			{
				...nanashi("名無しさん", ">>1　なつかしすぎて草"),
				card: oldThread(">>1　なつかしすぎて草"),
			},
			{
				...n(
					"1時間で、スレは1000まで埋まった。\n2005年のスレが、2回目の1000！",
				),
				card: oldThread("1000\n（2回目）"),
				// 1000 まで 埋まる 勢いで 3人が 右往左往
				go: [
					{ who: "feris", route: "lrlr", speed: 3 },
					{ who: "zero", route: "rlrl", speed: 3 },
				],
			},
			// 層の 札「今年もやきうか。草」と おんたこの 帳簿（寄り道「残機」②）を ここで 拾う
			{ ...n("その下に、2012年の帳簿。\n「名無し残機1　やきう」"), card: null },
			{
				...s("nanj", "そんな昔から、\nワイ死んどったんかい！", { emote: "汗" }),
				go: [{ who: "nanj", to: "kiriko", speed: 3 }],
			},
			// 2回目の 1000 → 2回目の 命日（寄り道「残機」の 天丼）
			// フェリスの 持ちネタ：やきうの 出題に、斜め上の 答え
			{
				...s("nanj", "問題や。命日が2回ある人は、\nなにがもらえる？"),
				about: "feris",
			},
			s("feris", "ケーキが2個〜", { gesture: "hop", pause: 400 }),
			s("nanj", "命日にケーキ出すな！", { emote: "怒", hit: "slap" }),
			// 「草が　生えた」を そのまま 音に する（草の 音を 3つ）。カメラは 広場
			{
				...n("広場じゅうで、草が生えた。"),
				se: "kusa",
				seRepeat: 3,
				seGap: 160,
				fx: "kusa",
				look: [20, 21],
			},
			{ ...k(">>1、明日も潜るンゴ！"), look: null },
		],
		again: [
			{
				...n("村に帰りつくと、\n井戸のそばにはだれもいなかった。"),
				cut: [24, 22],
			},
			n("キリコはいちばん古いレスを\nひらいた。「ふぇ…ふぇ……フェニックス！」"),
			think("草ンゴ"),
		],
	},
	// ── おーぷぬの 板（寄り道）。本筋と 同じ 型：小さな 事件が キリコの せいで 3段 ふくらみ、翌朝の 見出しで 追い打ち
	// （data/town/headlines.ts の AFTER_HEADLINES）。ふくらむ 方向は 板ごと：水星＝光・おんMu＝沈む・おんキム＝勧誘・
	// †闇†＝詠唱。段は 空（sky）・水（sceneMarks の flood）・絵（card）・人の 動きで 見せる
	mercury: {
		intro: [
			"なんでも実況（マーキュリー）。\nおんJに飽きた人が立てた板。",
			"コテハンもぬとらじもここでは合法。\n書きこみは、だれも怒らない。",
			"キリコは蓄音機をかかえた。\n下から、のんびりしたあいさつがする。",
		],
		ending: [
			// カメラは 浜の ステージ（フェリスは そこで 空を 見て いる）
			// 帰りついたのは 夜（文が「夜空」「夜の浜」と 言う。寸劇の 朝に しない）
			{
				...n("村に帰りつくと、\nフェリスが空を見上げていた。"),
				about: "feris",
				sky: "night",
				look: [12, 34],
				instead: {
					...n("村に帰りつくと、\n夜空がすこし明るかった。"),
					sky: "night",
					look: [12, 34],
				},
			},
			// 浜へ 場面を うつす
			{
				...s("feris", "水星のかけら〜？\nちいさいのに、あっつ〜い！", {
					emote: "花",
				}),
				standAt: [12, 36],
				cut: [12, 37],
			},
			{
				...s("zero", "おんJに飽きた人の板！\nおんJのすぐ隣にありました！"),
				go: [{ who: "zero", to: "kiriko", speed: 3 }],
			},
			// 水星の ネタ：だれも 怒らない 板の、いちばん ゆるい 評価（かけらの 裏の 字：実物の 絵）
			{
				...n("かけらの裏に、水星のレス。\n「ageもsageもせんで」"),
				se: "read",
				card: itemPicture("hoshi", "水星のかけら（裏）", {
					text: "ageもsageもせんで",
				}),
			},
			// 光の 方へ ふくらむ（浜 → 町 → 水星の 板まで）。キリコが かけらを 頭の ラッパに のせて 浜を 昼に する
			{
				...k("吾輩が、かけらをラッパにのせて\n浜を明るくするンゴ！", {
					gesture: "hop",
				}),
				card: null,
			},
			// 夜の 浜が 昼に（空ごと）
			{
				...n("浜が、昼になった。\n夜中の2時に。"),
				se: "uncurse",
				sky: "day",
			},
			// フェリスは かけらの 光で 砂浜を 走りまわる
			{
				...s(
					"feris",
					"夜の浜が、昼みたいに明るい〜！\nステージ、24時間営業〜！",
					{
						gesture: "hop",
					},
				),
				go: [{ who: "feris", route: "llrrrrll", speed: 3 }],
			},
			// 明るさは 坂を 上がって 町じゅうへ（カメラは 広場）
			{
				...n("10分後。明るさは坂を上がって、\n町じゅうが昼になった。"),
				skip: true,
				look: [20, 21],
			},
			nanashi("寝ぼけた町の人", "朝や！出勤や！\n……2時やんけ！"),
			{
				...s("nanj", "夜中の2時に、\nデーゲームが始まってもうた！", {
					emote: "驚",
					hit: "slap",
				}),
				look: null,
			},
			k("吾輩、朝を作ったンゴ！\n神ンゴ！", { emote: "得", gesture: "hop" }),
			{
				...s("nanj", "問題や。夜中の2時が昼なら、\n昼の2時は何や？"),
				about: "feris",
			},
			s("feris", "おやつ〜", { emote: "♪", pause: 400 }),
			// 明るさは 海を こえて 水星の 板まで。だれも 怒らない 板の 返事（実物の 絵）
			{
				...n("翌日。明るさは海をこえて、\n水星の板まで届いた。レスがひとつ。"),
				skip: true,
				se: "read",
				card: itemPicture("hoshi", "水星のかけら（裏・2行目）", {
					text: "ageもsageもせんで\nまぶしいけど怒らんで",
				}),
			},
			{
				...s("zero", "水星からのレス、1件です！\n数えました！", {
					emote: "!",
				}),
				card: null,
				go: [{ who: "zero", route: "rrllllrr", speed: 3 }],
			},
			{
				who: null,
				mob: "proto",
				text: "訂正ゼロ。0.5件。\n半分は、寝言ゼロ",
				pause: 400,
			},
			// 主人公が 最悪の 手（かけらを ラッパで ふさぐ）→ 夜より 暗く → 自己ツッコミ
			k("吾輩が、かけらをラッパで\nふさぐンゴ！", { gesture: "hop" }),
			{
				...n("町も浜も、まっくらになった。\n……夜より暗い。"),
				se: "batonDown",
				sky: "dark",
			},
			sOr(
				s("feris", "真っ暗〜！私が燃えて\n照らそうか〜？", {
					gesture: "hop",
				}),
				s("zero", "ゼロが、ランプに\nなります！", { emote: "汗" }),
			),
			{
				...k("半分ふさいだら、\nちょうど夜ンゴ", { emote: "得" }),
				sky: "night",
			},
			// 翌朝の 書きこみで 追い打ち（場面を 掲示板へ うつす。夜の まま）
			{
				...n("掲示板に、書きこみがひとつ。\n『【悲報】キリコ、夜を昼にする』"),
				se: "read",
				cut: [16, 22],
				look: [15.5, 21],
				card: boardOf("『【悲報】キリコ、夜を昼にする』"),
			},
			{
				...s("zero", "書きこみがまぶしくて、\n今夜も寝られません！", {
					emote: "汗",
				}),
				look: null,
				card: null,
			},
		],
	},
	onmu: {
		intro: [
			"なんでも実況（ムー大陸）。\n呑気なおんJを求めて作られた板。",
			"板のトップには「新境地への旅行」。\n大陸ごと、沈んでしまったらしい。",
			"キリコは蓄音機をかかえた。\n水の底で、空港の放送がひびく。",
		],
		ending: [
			nAbout(
				"村に帰りつくと、\nシヨが搭乗券をのぞきこんだ。",
				"shiyo",
				"村に帰りつくと、\n潮のにおいがついてきた。",
			),
			{
				...s(
					"shiyo",
					"行き先、書いてないじゃない！\nどこへ行くつもりだったのよ！",
					{
						emote: "?",
					},
				),
				go: [{ who: "shiyo", to: "kiriko", speed: 3 }],
				// 搭乗券の 実物（行き先の 欄が 白紙）
				card: itemPicture("tojoken", "おんMu国際空港の搭乗券", {
					text: "行き先：　　　　\n§^ム^§",
				}),
			},
			{
				...s("roze", "呑気なおんJをさがして、\n遠くまで行きすぎたアル"),
				go: [{ who: "roze", to: "kiriko", speed: 3 }],
			},
			n("搭乗券のはしに、ちいさく\n「§^ム^§」と書いてあった。"),
			// ムー大陸の ネタ：シヨの「行き先、書いてない」の 回収
			{
				...n("よく見ると、「行き先」の欄は\n「住民登録」の欄だった。"),
				se: "read",
				card: itemPicture("tojoken", "おんMu国際空港の搭乗券", {
					text: "住民登録：　　　\n§^ム^§",
				}),
			},
			// キリコは 桟橋の 立て札まで 走って 書きこむ
			{
				...k("キリコって、書いとくンゴ！"),
				se: "pencil",
				go: [{ who: "kiriko", to: [21, 36], speed: 3, face: "up" }],
				card: itemPicture("tojoken", "おんMu国際空港の搭乗券", {
					text: "住民登録：キリコ\n§^ム^§",
				}),
			},
			// シヨが 追いかけて きて ツッコむ（沈んだ 大陸の 住民に なった）
			{
				...s(
					"shiyo",
					"それ、沈んだ大陸の住民票よ！\nあなた、海の底の人になったわ！",
					{
						emote: "怒",
					},
				),
				card: null,
				go: [{ who: "shiyo", to: "kiriko", speed: 3 }],
			},
			// 沈む 方へ ふくらむ（キリコの 足もと → 広場 → 町ごと 海抜 −3m）。水は 画面の 下から 上がる（sceneMarks の flood）
			{
				...nanashi(
					"おんMu国際空港",
					"ご登録ありがとうございます。\n住民の方は、大陸とごいっしょに沈みます",
				),
				se: "decide",
			},
			{
				...n("キリコの足もとから、\nごぼごぼと水が上がってきた。"),
				se: "bubble",
				seRepeat: 3,
				mark: "flood",
			},
			// 主人公が 最悪の 手（搭乗券を 回して みんなを 登録させる）
			k("ひとりで沈むのはさびしいンゴ！\nみんなも登録するンゴ！", {
				gesture: "hop",
			}),
			{
				...n("キリコは搭乗券を回した。\nみんな、つい書いた。"),
				se: "pencil",
				seRepeat: 3,
				card: itemPicture("tojoken", "おんMu国際空港の搭乗券", {
					text: "住民登録：キリコ\nロゼ　シヨ　ゼロ",
				}),
			},
			// ノリの 型：書いて から 気づく（ツッコミ役も 沈む）
			{
				...s("roze", "書いたら沈むのが常識アル……\nしまったアル！！", {
					emote: "青",
					hit: "sting",
				}),
				card: null,
			},
			{
				...nanashi(
					"おんMu国際空港",
					"ただいま、海抜マイナス3メートル。\n呑気に沈んでおります",
				),
				se: "bubble",
				seRepeat: 2,
			},
			sOr(
				s("shiyo", "あたすの家、1階が\n水族館になったわよ！", { emote: "怒" }),
				s("zero", "サブ機が2機とも、\n浮いてます！", { emote: "汗" }),
			),
			k("吾輩、登録1番だから\n市長ンゴ？", { emote: "得" }),
			s("shiyo", "海の底の市長よ！！", { emote: "驚", hit: "whack" }),
			// 沈む 船の 舳先で 両手を 広げる 型（洋画の オマージュ。桟橋の 先で 止め絵）
			{
				...n("ロゼとキリコは桟橋の先で、\n両手を広げた。"),
				go: [
					{ who: "kiriko", to: [21, 50], speed: 1.6, face: "down" },
					{ who: "roze", to: [21, 49], speed: 1.6, face: "down" },
				],
			},
			{
				...k("沈む町の、\nいちばん前ンゴ……", { emote: "花" }),
				fx: "freeze",
				caption: "沈む大陸の、舳先",
			},
			s("shiyo", "沈んでる最中に、\nなにしてんのよ！！", {
				emote: "驚",
				hit: "punch",
				pause: 400,
			}),
			// 登録を 消すと 水が 引く（絵は 消した 搭乗券）
			{
				...k("登録を、消すンゴ！"),
				se: "pencil",
				card: itemPicture("tojoken", "おんMu国際空港の搭乗券", {
					text: "住民登録：みんな",
					strike: true,
				}),
			},
			{
				...n("水が引いた。翌朝、町は\n海抜0メートルにもどっていた。"),
				skip: true,
				unmark: "flood",
				se: "bubble",
				card: null,
			},
			{
				...n(
					"掲示板に、書きこみがひとつ。\n『【悲報】キリコ、町を3メートル沈める』",
				),
				se: "read",
				cut: [16, 22],
				look: [15.5, 21],
				card: boardOf("『【悲報】キリコ、町を3メートル沈める』"),
			},
			// ロゼの 持ちネタ：「書いたら 沈むのが 常識」が、浮いた あとで かわる（はじめから 知って いた ことに する）
			{
				...s("roze", "消したら浮くのも、常識アル。\nはじめから知ってたアル", {
					emote: "得",
				}),
				look: null,
				card: null,
			},
		],
	},
	onkimu: {
		intro: [
			"おんキム。\nキムチを愛する板から始まった。",
			"植民地をふやし、おんMuと争い、\n今日もだれかを勧誘している。",
			// 仲間を 集めて 大仕事の 型（底の 10階は 潜入：core/setpiece.ts）
			"作戦は、ひとつ。いちばん奥の\n管理部の壺を、見つからずに盗む。",
			"キリコは蓄音機をかかえた。\n「おんキムに来ませんか？」の声がする。",
		],
		ending: [
			// 壺の 実物（ふたを あけた ところ）
			{
				...n("村に帰りつくと、\nロゼが壺のふたをあけた。"),
				about: "roze",
				card: itemPicture("kimchi", "おんキムのキムチ壺"),
				instead: {
					...n("村に帰りつくと、\n壺から辛いにおいがした。"),
					card: itemPicture("kimchi", "おんキムのキムチ壺"),
				},
			},
			{
				...s("roze", "いい漬かりぐあいアル！\n麻婆豆腐にのせるアル！", {
					emote: "♪",
				}),
				go: [{ who: "roze", to: "kiriko", speed: 3 }],
			},
			// 壺の 底の 紙（実物の 絵）。ゼロは 底を のぞきに かけよる
			{
				...s(
					"zero",
					"壺の底に、「管理部32」の紙！\n31まで、だれか食べたんですか！",
				),
				se: "read",
				go: [{ who: "zero", to: "kiriko", speed: 3 }],
				card: itemPicture("kimchi", "おんキムのキムチ壺（底）", {
					text: "管理部32",
				}),
			},
			// おんキムの ネタ：ここでも 勧誘（もう 町に 住んで いる 人を）
			{
				...n(
					"壺のふたの裏に、勧誘の紙。\n「キリコさん、おんキムに住みませんか？」",
				),
				card: itemPicture("kimchi", "おんキムのキムチ壺（ふたの裏）", {
					text: "キリコさん、\nおんキムに住みませんか？",
				}),
			},
			// キリコは 蓄音機の 前（自分の 家）へ 走って 見せる
			{
				...k("吾輩、もう町に住んでるンゴ！\nほら、ここンゴ！"),
				card: null,
				go: [{ who: "kiriko", to: [19, 22], speed: 3, face: "up" }],
			},
			{
				...s(
					"roze",
					"勧誘に乗るのは非常識アル。\n蓄音機の前の住所は「広場」アル",
					{
						emote: "汗",
					},
				),
				go: [{ who: "roze", to: "kiriko", speed: 3 }],
			},
			// 勧誘の 方へ ふくらむ（キリコ → 町じゅう → ロゼまで → 管理部33）。主人公が 最悪の 手：勧誘の 紙を 蓄音機で 流す
			k("住所がないなら、吾輩が\n勧誘する側に回るンゴ！", { gesture: "hop" }),
			{
				...n(
					"キリコは勧誘の紙を蓄音機にかけた。\n「来ませんか？」が町じゅうに流れた。",
				),
				se: "pushButton",
				look: [45, 17],
			},
			// 町の 人が みんな 勧誘する 側に（背を 向ける）
			{
				...nanashi("商店街の人", "おんキムに\n来ませんか？"),
				turnAway: true,
			},
			nanashi("銭湯の客", "おんキムに\n来ませんか？"),
			// ツッコミ役も 勧誘に 回る
			// ロゼの 持ちネタ：勧誘に 乗るのは 非常識の はずが、する 側なら 常識に かわる
			{
				...s("roze", "勧誘する側なら、常識アル！\n麻婆キムチに来ませんか？", {
					emote: "♪",
				}),
				look: null,
			},
			k("……行くンゴ", { emote: "花", pause: 400 }),
			// 翌朝、壺の 底の 紙が 書きかわって いる（キリコが 管理部33）
			{
				...n("翌朝。壺の底の紙が、\n書きかわっていた。"),
				skip: true,
				se: "read",
				card: itemPicture("kimchi", "おんキムのキムチ壺（底）", {
					text: "管理部33：キリコ",
				}),
			},
			{
				...s(
					"zero",
					"キリコさん、管理部33に就任です！\n勧誘した人数、町ぜんぶです！",
					{
						emote: "!",
					},
				),
				go: [{ who: "zero", to: "kiriko", speed: 3 }],
			},
			{
				who: null,
				mob: "proto",
				text: "訂正ゼロ。町ぜんぶ引く1。\nやきうは勧誘されてないゼロ",
				pause: 400,
			},
			{
				...k("名刺、刷るンゴ！", { emote: "得", gesture: "hop" }),
				card: null,
			},
			// おんJ民は 植民地に する 側だった（§1）のに、町ごと よその 植民地に
			{
				...s("nanj", "おんJタウンが、よその\n植民地になってもうた！", {
					emote: "青",
					hit: "sting",
				}),
				go: [{ who: "nanj", to: "kiriko", speed: 3 }],
			},
			{
				...n(
					"掲示板に、書きこみがひとつ。\n『【悲報】キリコ、おんキム管理部に就任』",
				),
				se: "read",
				look: [15.5, 21],
				card: boardOf("『【悲報】キリコ、おんキム管理部に就任』"),
			},
			// 執着の 型：管理部の 仕事を 数える
			{
				...s(
					"roze",
					"管理部の仕事は、壺を洗うことアル。\n32個アル。1個目から洗うアル",
					{
						emote: "汗",
					},
				),
				look: null,
				card: null,
			},
		],
	},
	inferno: {
		intro: [
			"†ダークネスインフェルノ†板。\n邪気眼に魅入られし者の集う板。",
			"「ワイ」と名乗るうっかり者が\nときどきまざる。おんJのゆかりらしい。",
			"キリコは蓄音機をかかえた。\n上のほうで、だれかが詠唱している。",
		],
		ending: [
			nAbout(
				"村に帰りつくと、\nゼロが黒い本をひらいた。",
				"zero",
				"村に帰りつくと、\n黒い本がひとりでにひらいた。",
			),
			// ゼロは 右腕を かかげて 広場を 回る
			{
				...s("zero", "「†我が右腕に封じられし……†」\nゼロ、右腕はふつうです！"),
				go: [{ who: "zero", route: "rrddlluu", speed: 3 }],
				card: itemPicture("grimoire", "†漆黒の魔導書†", {
					text: "†我が右腕に\n封じられし……†",
				}),
			},
			// シヨは はずかしくて 自宅の ほうへ 逃げる（カメラが ついていく）
			{
				...s(
					"shiyo",
					"ちょっと、声に出して読まないで！\nこっちまではずかしいわよ！",
					{ emote: "汗" },
				),
				go: [{ who: "shiyo", to: [28, 22], speed: 3, follow: true }],
			},
			// インフェルノの ネタ：邪気眼の 応援（ゼロの「右腕は　ふつう」に もう一段）
			{
				...n(
					"応援の文は「†漆黒の保守を†」。\n保守は、ふつうの書きこみだった。",
				),
				look: null,
				se: "read",
				card: itemPicture("grimoire", "†漆黒の魔導書†（応援の文）", {
					text: "†漆黒の保守を†",
				}),
			},
			// 詠唱の 方へ ふくらむ（ゼロの 声 → 蓄音機で 町じゅう → 町の 人の 右腕 → 書きこみまで †）。
			// 主人公が 最悪の 手：詠唱を 蓄音機で 流す（蓄音機の 前まで 走る）
			{
				...k("吾輩も、蓄音機で\n詠唱するンゴ！", { gesture: "hop" }),
				card: null,
				go: [{ who: "kiriko", to: [19, 22], speed: 3, face: "up" }],
			},
			{
				...n("町じゅうに、詠唱がひびいた。\n「†漆黒の保守を†」"),
				se: "pushButton",
			},
			// 町が 闇に（ぷつっと 暗転。3秒で 明ける）
			{
				...n("町が、闇に包まれた。\n……3秒だけ。"),
				se: "batonDown",
				fx: "blackout",
			},
			s("zero", "3秒、数えました！\n闇、短いです！", { emote: "得" }),
			{
				who: null,
				mob: "proto",
				text: "訂正ゼロ。2.9秒ゼロ",
				pause: 400,
			},
			// 町の 人が 右腕を 押さえて 背を 向ける
			{
				...nanashi("商店街の人", "うっ……右腕が……"),
				look: [45, 17],
				turnAway: true,
			},
			{
				...nanashi("銭湯の客", "うっ……右腕が……"),
				look: [36, 27],
			},
			{
				...k("うっ……吾輩の\n右腕も……", { emote: "青", gesture: "shiver" }),
				look: null,
			},
			// 翌朝の 書きこみまで † つき（絵は 掲示板）
			{
				...n(
					"翌朝。掲示板に、†つきの書きこみ。\n『†【悲報】キリコ、町を闇に堕とす†』",
				),
				skip: true,
				se: "read",
				look: [15.5, 21],
				card: boardOf("『†【悲報】キリコ、町を闇に堕とす†』"),
			},
			{
				...k("†盛ってないンゴ†", { emote: "冷" }),
				look: null,
				card: null,
			},
			{
				...n("魔導書のさいごのページには、\n「ワイ」と書いて消したあと。"),
				card: itemPicture("grimoire", "†漆黒の魔導書†（さいごのページ）", {
					text: "ワイ",
					strike: true,
				}),
			},
			// 書いた 本人が 家へ 走って 逃げる（カメラが ついていく）
			{
				...s("nanj", "ワイちゃうで。世の中には\nワイ以外のワイもおるんや", {
					emote: "汗",
				}),
				card: null,
				go: [{ who: "nanj", to: [21, 19], speed: 3, follow: true }],
			},
			{
				...k("ワイ以外のワイ、\n足が速いンゴ", { hit: "slap" }),
				look: null,
			},
		],
	},
	// 束音ロゼの 競争：ボカロ作り避難所（engine/heroes.ts・core/race.ts）
	vocalo: {
		intro: [
			"おんJボカロ作り避難所。総合スレが\n荒れはてたあとの、おーぷぬの板。",
			"声を直す話がつづいていた。\nある月末、だれも書かなくなった。",
			"奥の原音設定まで、ロゼと競争。\n向こうは、壁をすり抜ける。",
			"キリコは蓄音機をかかえた。\n壁の中から、「お先アル」。",
		],
		ending: [
			// 競争の 決着（core/race.ts）：先に 着いた ロゼと 運んだ キリコ。勝ち負けは うやむやの まま。
			// ロゼは 広場の 西（自分の 持ち場）で 待って いる（カメラは そこ）
			{
				...n("村に帰りつくと、\nロゼが広場の西で待っていた。"),
				look: [8, 20],
			},
			{
				...s(
					"roze",
					"おそいアル。底に着いたのも、\n帰ったのも、わたしが先アル",
					{
						emote: "怒",
					},
				),
				standAt: [8, 21],
				cut: [9, 21],
			},
			k("取ったのは吾輩ンゴ！\n取ったほうが勝ちンゴ！"),
			// 底の はり紙（きまり）の 実物。書きかえて ある（天丼：ロゼが 負けそうに なる たびに 1行 ふえる）
			{
				...s("roze", "そのきまりは、底で\n着いたほうに変わったアル！", {
					emote: "汗",
				}),
				se: "read",
				card: itemPicture("memo", "避難所の底のはり紙", {
					text: "先に取ったら勝ち\n→着いたら勝ち",
				}),
			},
			// キリコは 港の ほうへ 走って 4.2キロぶん 戻ろうと する
			{
				...k("変えたのはロゼンゴ！\n4.2キロぶん戻すンゴ！"),
				go: [{ who: "kiriko", to: [20, 40], speed: 3, face: "down" }],
			},
			{
				...s("roze", "戻らなくていいアル！\n常識で言えば、ここで渡すアル！", {
					emote: "汗",
				}),
				go: [{ who: "roze", to: "kiriko", speed: 3 }],
			},
			// はり紙に もう 1行（執着の 型：負けそうに なる たびに きまりを 書きたす）
			{
				...n("ロゼは、はり紙をもう1行書きたした。"),
				se: "pencil",
				card: itemPicture("memo", "避難所の底のはり紙", {
					text: "先に取ったら勝ち\n→着いたら勝ち\n→先に帰ったら勝ち",
				}),
			},
			s("roze", "帰ったのも、\nわたしが先アル！", { emote: "怒" }),
			k("帰りの船、\nいっしょだったンゴ", { hit: "slap" }),
			s("roze", "……船の、前のほうに\n座ってたアル", { emote: "冷" }),
			// もう 1行。きまりの 書きたしが 名前だけに なって 落ちる（ロゼの 持ちネタの 原型）
			{
				...n("ロゼは、はり紙に\nもう1行書きたした。"),
				se: "pencil",
				card: itemPicture("memo", "避難所の底のはり紙", {
					text: "先に取ったら勝ち\n→着いたら勝ち\n→先に帰ったら勝ち\n→ロゼの勝ち",
				}),
			},
			k("名前を書いただけンゴ！", { emote: "驚", hit: "slap", pause: 400 }),
			s("roze", "書いたもん勝ちが、\n常識アル", { emote: "得" }),
			{
				...n("キリコは原音設定をロゼにわたした。"),
				se: "pay",
				card: null,
			},
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
	// 帰り方を 見た 人が かけよって くる（並んだ まま 言わない）
	shallow: [
		{ ...n("キリコの服に、\nパンくずがいっぱいついていた。"), wear: "crumbs" },
		sOr(
			{
				...s("nanj", "パン兵にかつがれて帰ってきたんか。\n出前やんけ"),
				go: [{ who: "nanj", to: "kiriko", speed: 3 }],
			},
			{
				...s(
					"shiyo",
					"パンくずだらけじゃない！\nあたすの勝ちね、きれいだもの！",
					{
						emote: "汗",
					},
				),
				go: [{ who: "shiyo", to: "kiriko", speed: 3 }],
			},
		),
	],
	main: [
		{ ...n("キリコの髪から、\nまだ湯気が立ちのぼっていた。"), wear: "steam" },
		{
			...s("roze", "湯柱で飛んできたアル！？\nわたしは歩いて帰ったアル！", {
				emote: "?",
			}),
			go: [{ who: "roze", to: "kiriko", speed: 3 }],
		},
	],
	kinoko: [
		{
			...s(
				"zero",
				"きのこに押し上げられてきたんですか？\n胞子、数えてもいいですか！",
			),
			go: [{ who: "zero", to: "kiriko", speed: 3 }],
		},
	],
	tropical: [
		n("キリコの服は、\nまだしおからかった。"),
		{
			...s("feris", "島の人たちに送ってもらったの〜？\nいいな〜、小舟〜！", {
				emote: "♪",
			}),
			go: [{ who: "feris", to: "kiriko", speed: 3 }],
		},
	],
	konamono: [
		{ ...n("キリコの髪は、\nソースと焦げのにおいがした。"), wear: "sauce" },
		sOr(
			{
				...s("nanj", "焦げくさっ！\n鉄板が噴火でもしたんか？", {
					gesture: "startle",
				}),
				go: [{ who: "nanj", to: "kiriko", speed: 3 }],
			},
			{
				...s("roze", "焦げくさいアル。\n髪に、ソースついてるアル"),
				go: [{ who: "roze", to: "kiriko", speed: 3 }],
			},
		),
	],
	// 爆発を 背に 歩く（洋画の 型。背中の 側＝電池板の ほうで 爆発し、スローで 桟橋を 上がる）。本気の あとに 1回 落とす
	deep: [
		{
			...n("明かりの道を帰る背中で、\n鉄塔のてっぺんが爆発した。"),
			fx: "blast",
			go: [{ who: "kiriko", to: [20, 47], speed: 0.8, face: "up" }],
		},
		{ ...k("……振り返らないンゴ。\n熱いから", { emote: "冷" }), fx: "blast" },
	],
	festival: [
		n("遠くで、神輿のかけ声が\nまだ聞こえていた。"),
		{
			...s("shiyo", "神輿で運ばれてきたの？\nべ、べつにうらやましくないわよ", {
				emote: "汗",
			}),
			go: [{ who: "shiyo", to: "kiriko", speed: 3 }],
		},
	],
};

/**
 * 底の 出来事・送り届けで 帰った ときの 語り（目的が event・deliver。core/data/dungeons.ts の event・deliver）。
 */
export const ARRIVE_RETURN: Partial<Record<DungeonId, readonly StoryPage[]>> = {
	konamono: [
		n("キリコの髪は、\nソースと青のりのにおいがした。"),
		{
			...s("roze", "たこパに行ってきたアル！？\n麻婆たこ焼き、作るアル！"),
			go: [{ who: "roze", to: "kiriko", speed: 3 }],
		},
	],
	tropical: [
		n("キリコの服は、\nまだしおからかった。"),
		{
			...s(
				"feris",
				"島の人たち、ちゃんと帰れた〜？\n浜、広すぎて走りほうだい〜！",
				{
					emote: "♪",
				},
			),
			go: [{ who: "feris", to: "kiriko", speed: 3 }],
		},
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
		q("nanj", "風呂板は、桟橋から船や！\nのぼせんなよ！"),
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
		q("nanj", "最終話や！\nワイは最後まで見とるで！"),
	],
	relief: [
		q("zero", "5回も負けたので、数えるのに\n飽きました。倉庫、開けます！", {
			emote: "汗",
		}),
		q("shiyo", "書きこみなんか信じるからよ！\nあなたのためじゃないから！", {
			emote: "汗",
		}),
	],
	// 隠しの 過去ログの底（おんJタウンの 下の 古井戸）。開くのは 最終話の あと
	hidden: [
		q("zero", "村の古井戸から、音がします！\nいちばん下から、です！"),
		q("nanj", "古いレスは、井戸にしずむんや。\nいちばん古いのも、な"),
	],
	// 口の ない 植民地（{name} は 板の 名前）。口から 一覧で 行ける
	colony: [
		q("zero", "新しい植民地が見つかりました！\n{name}、です", {
			emote: "!",
		}),
		q("nanj", "おんJ民、どこにでも住みつくな！\n口からえらんで行けるで"),
	],
};

/**
 * 帰りの 1幕目の 終わり（倉庫へ あずけ・売った あと）：話の 続き（その夜の 場面・開く 知らせ）が ある 帰りに、
 * やきうが 集まる 所を 言う。キリコが 蓄音機の 前に 来ると 2幕目（ui/village/villageEvents.ts の resumeStory）。
 * やきうは いつも 村に いる（FRIEND_BACK）。
 */
export const CONTINUE_CALL: Line = q(
	"nanj",
	"荷ほどきがすんだら、蓄音機の前に集合や！\n……続きの話は、それからやで",
);

/**
 * 寄り道の 植民地が 開く ときの 小さな 出来事：その 板の 名無しが 村の 口から 歩いてきて、キリコに 板の ようすを
 * 話し、帰っていく（ui/village/villageReturn.ts の visitScript）。who が "visitor" は その 名無し、null は 地の文。
 * 名無しは 1人で 来て キリコとだけ 話す（離れた 仲間は 出てこない）。
 */
export const UNLOCK_VISIT: Partial<
	Record<
		DungeonId,
		/** se は その 窓の 前に 鳴らす 音（文が 音を 言う 行。「太鼓の音がちかづいてくる」）。 */
		readonly { who: "visitor" | null; text: string; se?: string }[]
	>
> = {
	kinoko: [
		{
			who: null,
			text: "村の口から、だれか来た。\n頭にきのこが生えている。",
		},
		// 夜の 行進（ui/village/episodeHooks.ts）に はぐれた 1人。来た 道を もどる（潜ると「道まちがえて戻ってきた」）
		{
			who: "visitor",
			text: "きのこ板の者や！\n行進に、はぐれてもうた！",
		},
		{
			who: "visitor",
			text: "パン板は、どっちや？\n仕返しに、遅れてまう",
		},
		{
			who: null,
			text: "名無しはきのこを1本置いて、\n来た道をかけもどっていった。",
		},
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
			text: "おんたこから来たで！\nちょっと腹立っとるけど😡",
		},
		{
			who: "visitor",
			text: "招待状、届いたか？\n来んかったら、知らんで😡",
		},
		{
			who: null,
			text: "名無しは怒った顔のまま、\nていねいにおじぎして帰った。",
		},
	],
	festival: [
		{
			who: null,
			se: "hit_club",
			text: "村の口から、太鼓の音が\nちかづいてくる。",
		},
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
		q("nanj", "日本、まだ47か国やで！\n大阪国のパスポート作ったわ！"),
		q("roze", "パン板の底、わたしは\n3時間前に着いてたアル"),
		q("feris", "食パンの旗、おいしそ〜。\n私、目がいいから見えてたよ〜"),
		q("shiyo", "パン板、でしょ。ふん！\nあたすなら、もっと早かったわ！", {
			emote: "汗",
		}),
		q(
			"zero",
			"パン板のログ、30回読みました！\n読みすぎて、サブ機がトースターに！",
		),
	],
	main: [
		q("nanj", "41.5℃、ええ湯やったな！\n港の海までお湯やったけどな！"),
		q("roze", "おかえりアル。蓄音機、\nずっとまわってるアル"),
		q("feris", "長湯スレ、もう1回きこ〜。\nあと100回だけ〜！", {
			emote: "♪",
		}),
		q("shiyo", "41.5℃、あたすが先に\n言ったんだから"),
		q(
			"zero",
			"長湯スレ、今日も読みました！\n最後の200レス、ぜんぶ「ぬるい」！",
		),
	],
	// 最終話の あと（町に 明かりが もどり、鯖代で ロールバック）
	deep: [
		q("nanj", "今日は、なんも盛らんとく！\nたぶんな！"),
		q("roze", "ロールバックしても、\n麻婆豆腐は減ってたアル"),
		q("feris", "明かり、きれいだね〜。\nロールバックしても、まぶしい〜！"),
		q("shiyo", "もう停電させないでよ！\nべ、べつにこわくなかったけど！"),
		q("zero", "電池ニキさん、毎日来てます！\n見学者2人目は、ゼロです！"),
	],
	kinoko: [
		q("zero", "きのこ軍から絵はがきです！\n『ここどこや』だそうです！"),
		q("zero", "きのこ軍、まだ世界のどこかで\n迷子です！"),
		q("nanj", "植民地の植民地や。\nどっちがえらいねん", { emote: "怒" }),
	],
	tropical: [
		q("feris", "島、まだ港のとなりにいる〜。\n居心地いいみたい〜！", {
			emote: "♪",
		}),
		q("roze", "島民が7人になったアル！\nキリコも数えたアル！"),
	],
	konamono: [
		q("nanj", "世界たこパ、焦げとったで😡\nあ、勝手についた！", {
			emote: "汗",
		}),
		q("roze", "麻婆豆腐にたこ、\n入れてみたアル！大失敗アル！"),
	],
	festival: [
		q("shiyo", "うちわ、あたすがあずかってるわ。\n使ってはないわよ！"),
		q("nanj", "祭りのあとのうちわや！\nまだ耳から太鼓が出えへん！"),
	],
	hidden: [
		q("roze", "いちばん古いのがフェリスなのも、\nおんJの常識アル"),
		q("zero", "いちばん古いレス、\nフェリスさんの声でした"),
		q("shiyo", "いちばん古いだけで、\nいちばん上手いわけじゃないわよ！"),
		q("nanj", "古いレスも消えへん！\nワイの黒歴史もな！"),
	],
	mercury: [
		q("feris", "水星の板、のんびりしてたね〜。\nまた行こ〜！"),
		q("zero", "かけら、まだ光ってます！\nまぶしくて3機とも寝不足です！"),
		q("nanj", "夜中の2時のデーゲーム、\n9回裏まで見てもうたわ！"),
	],
	onmu: [
		q("shiyo", "搭乗券、倉庫にしまったわ！\nいつか使うかもしれないし！"),
		q("roze", "呑気な板も、ええアル！\n荒らしも昼寝してたアル！"),
		q("nanj", "町が沈んだ夜、ワイの家だけ\n2階で助かったわ！"),
	],
	onkimu: [
		q("roze", "キムチ、ぜんぶなくなったアル！\nまた漬けるアル！"),
		q("zero", "おんキムから勧誘の書きこみ！\n宛先は、管理部33でした！"),
		q("nanj", "おんキムの植民地のおんJタウン。\nややこしいわ！"),
	],
	inferno: [
		q("zero", "魔導書、3ページ読みました！\n右腕は、まだふつうです！"),
		q("feris", "†キリコ†って書くと、\nかっこいいね〜！ふふ〜", {
			emote: "♪",
		}),
		q("shiyo", "†シヨ†って書かないでよ！\nべ、べつに嫌いじゃないけど！"),
	],
	vocalo: [
		q("roze", "避難所、まだあったアル！\nわたしの書きこみ、誤字ってたアル！"),
		q("shiyo", "ロゼとの競争、どっちが勝ったの？\nあたすなら、勝ってるわよ！"),
		q("zero", "競争のきまり、3回変わりました！\nゼロが数えました！"),
	],
};

/** まだ一度も もぐっていない（パン板の ネタを 取りにいく前）。quotes.ts の FIRST の パン板 版。 */
export const FIRST_SHALLOW: readonly Line[] = [
	q("nanj", "パン板やで。おんJ民お断りや！\nほな、見とるで！"),
	q("roze", "パン板の王さまには、\nロゼが先に説教しとくアル"),
	q("feris", "どこかの板で、先に\n燃えて待ってるね〜", { emote: "♪" }),
	q("shiyo", "あなたより先に、どこかの\n底で待っててあげるわよ"),
	q("zero", "ゼロも先回りして、先に\n数えておきます！負けません！", {
		gesture: "hop",
	}),
];

/** パン板で倒れたとき（たおれ方の たまりより 前に見る）。 */
export const SHALLOW_DEATH: readonly Line[] = [
	q("nanj", "パン板やで！？入門の！\nいや、パン板でも下は下か！"),
	q("roze", "パン板はちいさいアル！\nでも底は、ちゃんと底アル！"),
	q("feris", "パン板でも、ころぶよね〜。\n私もよくころぶ〜", {
		emote: "汗",
	}),
	q("shiyo", "杖は、ふるまでわからないの！\n教えてあげたんだからね！"),
	q("zero", "パン板のログ、読みました！\n短いので、3機で3秒です！"),
];
