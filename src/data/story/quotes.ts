// ダンジョンの外のセリフ。話すのは 外で待っている仲間だけ（キリコが しゃべるのは 村の 雑談と 喫茶だけ。data/people/mobs.ts・cafe.ts）。
// - 起動の札・村：前の冒険の結果に、仲間のだれかが ひとこと（pickQuote）。
// - はじめて降りる前の ナレーション（INTRO）と、長湯スレを持ち帰ったあと（ENDING）。
// 1行は全角22字・2行まで。説明せず、行間を読ませる（rpg README「セリフの書き方」）。
// 名前・色は rpg の cast.ts と同じ（シヨ・ゼロは rpg に いないので ここで 決めた 色）。

import { DUNGEONS } from "../../core/data/dungeons";
import type { DungeonId } from "../../core/types";
import type { Cue } from "../../engine/emote";
import type { HeadProp } from "../../engine/headProp";
import type { AnyCard } from "../../engine/sceneCard";
import type { SceneFx } from "../../engine/sceneFx";
import type { MobId } from "../people/mobs";
import { boardOf } from "./pictures";

export type Speaker = "roze" | "shiyo" | "feris" | "zero" | "nanj";

export const SPEAKERS: Record<Speaker, { name: string; color: string }> = {
	roze: { name: "ロゼ", color: "#ff6f91" },
	shiyo: { name: "シヨ", color: "#e8483f" },
	feris: { name: "フェリス", color: "#ffd166" },
	zero: { name: "ゼロ", color: "#5cc8f0" },
	// やきう（ワイ）。呼び名は みんな「やきう」、フェリスだけ「やきうくん」
	nanj: { name: "やきう", color: "#f5d142" },
};

/**
 * ジャンルの 声の 語り手（STORY.md「201級の 笑い」の 動画で 確かめた こと）。地の文を 実況・ニュース・番組の
 * 口調で 言い、その ジャンルの 決まり文句で 笑いを とる。名前欄と 色だけ かわる（立ち絵・声なし）。
 */
export type Anchor = "news" | "live" | "weather" | "doc" | "cooking" | "show";

export const ANCHORS: Record<Anchor, { name: string; color: string }> = {
	news: { name: "ニュース", color: "#9ec9ff" },
	live: { name: "実況", color: "#ffb347" },
	weather: { name: "お天気", color: "#8fe3c9" },
	doc: { name: "ナレーション", color: "#d9c7a7" },
	cooking: { name: "料理番組", color: "#ffa6c9" },
	show: { name: "検証番組", color: "#ff7a59" },
};

/** 時間帯（data/village/crowd.ts の TimeBand と 同じ。型だけ）。 */
export type QuoteBand = "late" | "morning" | "day" | "evening" | "night";

/** 話す 人の 感情の 記号・体の 動き（Cue。engine/emote.ts）も 持てる。 */
export type Quote = Cue & {
	who: Speaker;
	text: string;
	/**
	 * この 時間帯だけ 出る（村の 時計。村の 色・人通りと 同じ 時計）。省けば いつでも。
	 * 時刻を 言う 台詞（ナイター・夜ふかし・おはよう）は ここで しばる（2026-10-14 紐づけの 見直し）。
	 */
	bands?: readonly QuoteBand[];
};

/**
 * キリコの ことば（ふつうに 会話に 加わる。吾輩・ンゴ）。
 * - voice … 声。ふだんは これ。仲間も 住人も 聞こえて、返事を してよい。読み上げは rpg と 同じ uc。
 * - think … 独白。（　）で かこんで 出す。だれも いない 場面だけ（ひとりで 古い スレを 読む ときなど）。声なし。
 * 決まり（STORY.md §0）：望みは 台詞で 言う。ダンジョンの 中では 出さない。
 */
export type KirikoMode = "think" | "voice";

/**
 * 語りの 1ページ（who が null なら ナレーション。kiriko が あれば キリコの 独白）。
 * 話す 人か about の 人が 村に いない（まだ 越してきて いない。data/story/story.ts の awayFriends）ときは
 * instead に かえる（無ければ その ページは 出さない）。
 */
export type StoryPage = Cue & {
	who: Speaker | null;
	text: string;
	kiriko?: KirikoMode;
	/** 地の文に 出てくる 仲間。 */
	about?: Speaker;
	instead?: StoryPage;
	/**
	 * 話すのが 住人（data/people/mobs.ts）の とき（who は null に しておく。ui/village/villageReturn.ts が sayAs で 出す）。
	 * 原住民が 電池板の 山場に 口を はさむ 頁など。
	 */
	mob?: MobId;
	/** この 板を 持ち帰って いる ときだけ 出る 頁（寄り道「残機」を 終えた ときの 最終話の 頁。data/story/story.ts の endingFor）。 */
	needCleared?: DungeonId;
	/** この 板を 持ち帰って いない ときだけ 出る 頁（持ち帰る 順で 語りを 分ける。needCleared の 逆）。 */
	unlessCleared?: DungeonId;
	/** 名無しの 1窓（who は null に しておく。名前欄だけ この 名前で、色は やきうの 黄色）。 */
	nanashi?: string;
	/** ジャンルの 声の 語り手（who は null に しておく。ANCHORS の 名前と 色で 出す）。 */
	anchor?: Anchor;
	/** 村の 場面の 合図（ui/village/villageReturn.ts。地の文の 前に 起きる）。 */
	cue?: /** 明かりの もどる 坂（最終話の 頂点。生き返った 通りを 順に 見せて、明るい 町に 建て直す）。 */
		| "lightsUp"
		/** 本筋の 話の おわり（data/story/story.ts の episodeEnd。章の 音）。 */
		| "chapterEnd";
	/**
	 * 地の文の 前に 鳴らす 効果音（data/audio/sfx.ts の 名前。村の 持ち帰りの 語りだけ）。seRepeat 回、seGap ms ずつ
	 * あけて 重ねる（既定 220ms）。instead の 頁は この 音を 引き継がない（かわりの 頁は 自分の se を 持つ）。
	 * 付けるのは 文に 音や 手の 動きが 出てくる 所と、各話 1回までの オチだけ（STORY.md §0）。
	 */
	se?: string;
	seRepeat?: number;
	seGap?: number;
	/**
	 * 地の文の 前に 出す 場面の エフェクト（engine/sceneFx.ts。村の 持ち帰りの 語りだけ）。暗転・紙吹雪などは 頁の
	 * あいだ 残り、次の 頁も 同じ fx なら そのまま つづく。爆発の 煙は ひとりでに 晴れる。付けるのは se と 同じく
	 * オチと 山場だけ（STORY.md §0）。
	 */
	fx?: SceneFx;
	/** fx の 字（止め絵の 名札・予告編の 大きな 字・回想の 年の 札・たおれた の 字）。 */
	caption?: string;
	/** 窓の 前に キリコの 顔の カットイン（驚き・ツッコミの 瞬間。ひとりでに 消える）。 */
	cutin?: true;
	/** この 頁から 鳴らす 曲（data/audio/bgm.ts の 名前。null で 止める。村の 持ち帰りの 語りだけ。場面 専用の 曲）。 */
	bgm?: string | null;
	/**
	 * この 頁からの 村の 空（ui/village/sceneSky.ts。村の 時計に かかわらず その 時間帯。dark は 夜で 明かりも 消す。
	 * null で 寸劇の 空（朝。停電の 町なら 暗い まま。停電の 町では 昼・夕方も 暗い まま）に もどす。村の 持ち帰りの 語り・
	 * 転だけ。持ち帰りの 語りは 頁が 言わなければ 朝で、場面の おわりに 村の 時計が その 時間帯から すすむ）。
	 */
	sky?: "dark" | "night" | "morning" | "day" | "evening" | null;
	/** この 頁で 広場に チョークの 国境線を 引く（ui/village/sceneChalk.ts。キリコが 走りだす ときから 伸びる）。 */
	chalk?: boolean;
	/**
	 * この 頁から 地図に 出す 物（ui/village/sceneMarks.ts。文が「港が半分島に」「首脳が上陸」「港の海が41.5℃」と
	 * 言う 頁に 付ける。村の 持ち帰りの 語りだけ。場面の おわりに 消える）。unmark で しまう（島は 沖へ バック）。
	 */
	mark?: SceneMark;
	unmark?: SceneMark;
	/**
	 * この 頁から 場面に 出て いる 仲間・住人 みんなの 頭に のせる 物（null で おろす。キリコは wear）。
	 * 文が「町の人の頭に生えた」と 言う 頁に 付ける。場面の おわりに 消える。
	 */
	wearAll?: HeadProp | null;
	/**
	 * この 頁の 前に カメラを 向ける マス（村の 持ち帰りの 語りだけ。null で キリコに もどす）。
	 * 語りが 町の 出来事を 言う ときに、その 通りを 映す。
	 */
	look?: readonly [number, number] | null;
	/**
	 * この 頁から キリコの 頭に のせる 物・体に つく 物（engine/headProp.ts。null で おろす。村の 持ち帰りの 語りだけ。
	 * 場面の おわりに 消える）。文が「頭に きのこが 生えている」「服に パンくず」などと 言う 頁に 付ける。
	 * ボスを たおして 帰った 語り（BOSS_RETURN）の 頁に 付けた 物は、着いた ときから 見せる。
	 */
	wear?: HeadProp | null;
	/**
	 * この 頁から やきうの 頭の 上に 出す「残機」の 数（ui/village/zankiTag.ts。村の 持ち帰りの 語りだけ）。
	 * 文が「残機：1」と 出た・「残機：99」に なったと 言う 頁に 付ける。その 頁までは 前の 数（1 なら 出さない・99 なら 1）。
	 */
	zanki?: number;
	/** この 頁で キリコの 頭の 物から 胞子を ふく（文が「胞子を ふいた」と 言う 頁）。 */
	spores?: boolean;
	/**
	 * この 頁で 地図に きのこを 生やす（ui/village/sceneShrooms.ts。street は 商店街の シャッター、port は キリコの まわりの 港。
	 * null で 摘みとる。村の 持ち帰りの 語りだけ。場面の おわりに 消える）。street は カメラを 商店街へ 向けてから 生やす。
	 */
	shrooms?: "street" | "port" | null;
	/**
	 * この 頁を 話す 仲間（who）が 口の 前に 並ばず、町の この マスの そばで 待って いる（村の 持ち帰りの 語りだけ。
	 * 「メイド喫茶の前に、シヨが」のように 語りが 別の 所を 言う とき。look で そこを 映す）。
	 */
	standAt?: readonly [number, number];
	/**
	 * この 頁から 出す 絵（engine/sceneCard.ts。文に 出てきた 物の 実物の 絵：掲示板の 見出し・品の 書きこみ・
	 * 立て札・鉄板・太鼓（data/story/pictures.ts）。騒ぎの 規模の 段は 図に せず、台詞と go・look・cut で 見せる。
	 * 前の 絵が あれば 入れかえる。null で しまう。村の 持ち帰りの 語り・転だけ。場面の おわりに しまう）。
	 */
	card?: AnyCard | null;
	/** この 頁で 並んだ 人が みんな キリコに 背を 向ける（ばらばらに なる ギャグ。次に 話す 人が でると また 向きあう）。 */
	turnAway?: boolean;
	/**
	 * この 頁の 前に 時間を とばす（暗転して 明ける。cut が あれば その 所で 明ける）。文が「翌日。」「1時間後。」
	 * 「その夜、」と 時間を とばす 頁に 付ける（窓だけ 進めて 時間が 飛ぶと、画面では 何も 起きて いない）。
	 * 村の 持ち帰りの 語りだけ。src/sim/villageTests.ts が 時間の 語を 見て 落とす。
	 */
	skip?: boolean;
	/**
	 * この 頁の 前に 場面を うつす（村の 持ち帰りの 語りだけ）。暗転して、キリコを この マスの そばへ、場面に 出て いる
	 * 仲間・住人を キリコの まわりへ 置いて 明ける。語りが「広場で」「屋台で」と 所を かえる ときに。
	 * 場面の おわりに キリコは 帰りついた マスへ もどる（あとの 知らせの 場面は 口の 前で 起きる）。
	 */
	cut?: readonly [number, number];
	/**
	 * この 頁の 前に 人を 走らせる（村の 持ち帰りの 語りだけ。ならべた 分は 同時に 動く。se が あれば 走りながら 鳴る）。
	 * 地の文の 手の 動き（線を 引く・逃げる・かけよる）を 地図の 上で 見せる。
	 */
	go?: readonly SceneWalk[];
};

/** 語りが 言った 物を 地図に 描く 物の 名前（ui/village/sceneMarks.ts）。 */
export type SceneMark =
	/** 銭湯の 屋根から 町の 上まで 広がる 湯気。 */
	| "bathSteam"
	/** 港の 海から 立つ 湯気（41.5℃の 海）。 */
	| "seaSteam"
	/** 港に 突っこんだ 島。 */
	| "island"
	/** 首脳の 舟（たこ焼き器を かかえて 上陸）。 */
	| "boats"
	/** 招待状を つめて 流した ビン（桟橋の 先から 沖へ）。 */
	| "bottles"
	/** パン兵が 並べた 独立記念の パン。 */
	| "bread"
	/** 食パンの 旗。 */
	| "flag"
	/** 地面の 下から 立ちのぼる サンバ（丘の 太鼓の 足もとの ♪。お祭りの 語りの あいだ）。 */
	| "samba"
	/** きのこ軍の 行進（港から 桟橋を 上がって きて、列で 止まる）。 */
	| "march"
	/** 水没（町が 沈む。画面の 下から 水が 上がって くる。unmark で 引く）。 */
	| "flood";

/**
 * 語りの 頁で 走らせる 1人（StoryPage.go）。who の all は キリコが to へ、ほかの 仲間・住人が その まわりへ。
 * 住人（MobId。ゼロの サブ機 プロト・レン など）も 走らせられる：語りに 出る 住人は 口の 前に 並ぶ。
 * - to … その マスの そばの 空いた マスへ（kiriko なら キリコの となり）。
 * - route … Story.move の 道（"lrlr" など）。元の マスへ もどる しぐさ だけ（転げまわる・おどる・地団駄）。
 * 場面に いない 仲間・住人は 動かない。speed は 歩きの 何倍か（既定 2.2。走る）。
 */
export type SceneWalk = {
	who: Speaker | MobId | "kiriko" | "all";
	to?: readonly [number, number] | "kiriko";
	route?: string;
	speed?: number;
	/** 着いたら この 向きを 向く（省けば 仲間は キリコを、キリコは そのまま）。 */
	face?: "up" | "down" | "left" | "right";
	/** カメラが この 人に ついていく（キリコは いつも）。 */
	follow?: boolean;
};

/** 前の冒険の結果（null は まだ一度も もぐっていない）。 */
export type QuoteContext = {
	kind: "dead" | "clear" | "escape";
	depth: number;
	cause: string;
	runs: number;
	clears: number;
	/** その板の 何割まで 行ったか（0〜1。無ければ 風呂板の 階の 数で 数える）。 */
	ratio?: number;
	/** 上りの 板（塔・やぐら・山）だった。 */
	up?: boolean;
} | null;

const q = (who: Speaker, text: string, c?: Cue): Quote => ({
	who,
	text,
	...c,
});
/** 時間帯だけ 出る 台詞。 */
const qb = (
	bands: readonly QuoteBand[],
	who: Speaker,
	text: string,
	c?: Cue,
): Quote => ({ who, text, bands, ...c });

// ───────────────── はじめて（まだ降りていない） ─────────────────
const FIRST: readonly Quote[] = [
	q("nanj", "ひとりで潜るんか。\nほな、見とるで"),
	q("roze", "スレは、短いのが常識アル。\n長いと1000で追い出されるアル"),
	q("feris", "いってらっしゃ〜い。\n事故っても、また復活できるよ〜"),
	q("shiyo", "あなた、ひとりで行くの？\nあたすは先に行ってるわよ"),
	q("zero", "おかえりの練習、100回しました。\nあ、まだ出発前でしたね", {
		emote: "汗",
	}),
];

// ───────────────── 深さで（たおれた階） ─────────────────
/** 板の 3割まで。 */
const SHALLOW: readonly Quote[] = [
	// 野球の たとえ（いま ナイターを やっている とは 言わない：どの 時刻にも 出る）
	q("nanj", "はっや。試合なら、\nまだ1回の表やで"),
	q("nanj", "草。いや、笑ってへんで。\n笑ってへんけど、草", { emote: "汗" }),
	q("feris", "もうもどってきた〜？\n私のほうが、まだ長く潜れる〜"),
	q("roze", "入口のあたりは忘れスレの霊が\n多いアル。知り合いアル"),
	q("shiyo", "もう帰ってきたの？\n掃除、まだ終わってないわよ"),
	q("zero", "おかえりなさい！ハグの準備が\nあ、いらない。了解です", {
		gesture: "slump",
	}),
	// 夜だけ（ナイターの 時間）
	qb(["night"], "nanj", "はっや。ナイター、\nまだ1回の表やで"),
	qb(["morning"], "feris", "おはよ〜。朝から\nもうもどってきた〜？"),
];

/** 板の 7割まで。 */
const MID: readonly Quote[] = [
	q("roze", "そのあたりは風が吹くアル。\nカツラ、おさえるアル"),
	q("nanj", "おかえり。試合なら、\n5回の裏ってとこや"),
	q("feris", "まんなかって、いちばん上？\nいちばん下？……どっちでもないか〜", {
		emote: "?",
	}),
	q("feris", "そのへん、自演くんいるよね〜。\n私の別アカじゃないよ〜"),
	q("shiyo", "ふんっ。まあまあじゃない。\nほめてないわよ、あたすは"),
	q("zero", "まんなかまで行ったんですね。\nサブ機たちと拍手しました", {
		gesture: "hop",
	}),
	qb(["night"], "nanj", "おかえり。ナイターは\nいま5回の裏や"),
	qb(["evening"], "roze", "夕飯どきアル。\n麻婆豆腐、できてるアル"),
];

/** 板の 奥（7割から）。下りの 板。 */
const DEEP: readonly Quote[] = [
	q("shiyo", "そんな底まで行って……。\nあなた、ほんとにばかなんだから"),
	q("shiyo", "あと少しだった、なんて\nあたすは言わないわよ"),
	q("nanj", "9回の裏まで来とったで。\n延長戦、あるやろ？"),
	q("roze", "そんな深くまで……。\n麻婆豆腐、食べながら聞くアル"),
	q("feris", "そんな下まで〜？\n私、飛んでも届かないよ〜"),
	q("zero", "そんな深くのログ、\nゼロ、はじめて見ました！", {
		emote: "!",
	}),
	// 深夜だけ（夜ふかし）
	qb(["late"], "shiyo", "こんな時間まで……。\nあなた、ちゃんと寝てるの？"),
	qb(["late"], "zero", "深夜です。ゼロは\n眠らないので、見張ってました"),
];

/** 板の 奥（7割から）。上りの 板（塔・やぐら・山）。 */
const HIGH: readonly Quote[] = [
	q("shiyo", "そんな上まで行って……。\nあなた、ほんとにばかなんだから"),
	q("shiyo", "あと少しだった、なんて\nあたすは言わないわよ"),
	q("nanj", "9回の裏まで来とったで。\n延長戦、あるやろ？"),
	q("roze", "そんな高くまで……。\n麻婆豆腐、食べながら聞くアル"),
	q("feris", "そんな上まで〜？\n私なら、飛んで届くかな〜"),
	q("zero", "そんな高くのログ、\nゼロ、はじめて見ました！", {
		emote: "!",
	}),
];

// ───────────────── 放送事故（たおれても 終わりじゃない） ─────────────────
/** たおれて もどったとき ときどき（倒れても 次の スレが ある）。 */
const NEXT_THREAD: readonly Quote[] = [
	q("nanj", "倒れたんか。掲示板、\n3回見たで。草"),
	q("feris", "事故った〜？私なんて\n2005年から炎上中〜"),
	q("roze", "持ち物はもどらないアル。\n次は、荷物をへらすアル"),
	q("shiyo", "掲示板の書きこみ、見たわよ。\nあたすの勝ちね"),
	q("zero", "倒れた階、記録しました。\nグラフにすると、きれいです"),
	q("zero", "倒れた回数、グラフにしました。\n右肩あがりです", {
		emote: "汗",
	}),
	q("roze", "あらすじ、もう\n「次回作にご期待」にしたアル"),
];

// ───────────────── たおれ方で ─────────────────
/** おなかが　すいて。 */
const STARVE: readonly Quote[] = [
	q("shiyo", "ぷゆゆがパン、持たせたでしょ！\nあたすは食べたわよ、ばか", {
		emote: "怒",
	}),
	q("nanj", "パン松に言うたろか。\n「メシを食え」って"),
	q("feris", "おなか、すいたでしょ〜。\n私は満腹〜", {
		emote: "♪",
	}),
	q("roze", "麻婆豆腐、作っておいたアル。\nわたしのぶんだけアル"),
	q("zero", "おなかのすく仕組み、\nわかったら代わりにすきます"),
];

/** 毒草を　飲んで。 */
const POISON: readonly Quote[] = [
	q("roze", "草アル？\nどっちの草アル", { emote: "?" }),
	q("nanj", "草を飲んだんか。\nいや、その草やないねん"),
	q("shiyo", "知らない草を口に入れない！\nメイドの言うことは聞きなさい"),
	q("feris", "私、鳥だから草には\nくわしいよ〜。たぶん〜"),
	q("zero", "毒草の見分け方、サブ機と\n3時間会議しました。結論、なし", {
		gesture: "slump",
	}),
];

/** 地雷・炎上案件の　爆発。 */
const BLAST: readonly Quote[] = [
	q("nanj", "ドカン、って上まで\n聞こえたわ。草は生えんかった"),
	q("feris", "ドーンってした〜。\n私のくしゃみより大きかった〜"),
	q("shiyo", "上までドカンって聞こえたわよ。\n眼鏡、ずれたじゃない", {
		emote: "怒",
	}),
	q("roze", "上までけむりが来たアル。\nカツラ、洗うアル"),
	q("zero", "爆発の音、録音しておきました！\nいらなかった、ですか", {
		emote: "汗",
	}),
];

/** ぷゆゆ（メタルは べつ。前の版の 記録の「とうすこ」も）。 */
const PUYU: readonly Quote[] = [
	q("nanj", "ぷゆゆに負けたんか。\n村のあいつには、だまっとくわ"),
	q("roze", "あの子たち、泣きそうな顔で\n来るアル。ずるいアル"),
	q("feris", "ぷゆゆに〜？\nあの子、よちよちだよ〜？", { emote: "?" }),
	q("shiyo", "あの上目づかいに負けたの？\nあたすなら、ひと睨みで勝つわ"),
	q("zero", "ぷゆゆさんとなかよくなる方法、\nゼロにも教えてください"),
];

/** 寝落ち民。 */
const NEOCHI: readonly Quote[] = [
	q("nanj", "寝落ちはあかん。\nワイも実況中によくやるけど", {
		emote: "汗",
	}),
	q("feris", "ねむくなっちゃった〜？\n私はまだ起きてられる〜"),
	q("shiyo", "寝るならベッドで寝なさい。\nあたすは先に起きるけど"),
	q("roze", "ねてる子は起こさないアル。\nあの子はべつアル"),
	q("zero", "眠るって、どんな感じですか！\nゼロ、3機で交代で寝てみます！", {
		emote: "?",
	}),
];

/** コピペ。 */
const COPIPE: readonly Quote[] = [
	q("nanj", "コピペにやられたんか。\nあれ、元ネタワイやで（自称）"),
	q("roze", "ふえるやつはいっぺんに\nたたくアル。常識アル"),
	q("feris", "コピペって、何回見ても\nちょっとわらっちゃうよね〜"),
	q("shiyo", "同じものがぞろぞろふえるの？\n掃除がたいへんじゃない"),
	q("zero", "ゼロにもサブ機がいるので、\nコピペの気もち、少しわかります"),
];

/** 忍法帖エラー。 */
const NINPO: readonly Quote[] = [
	q("nanj", "忍法帖エラーかいな。\nワイも何回書き直したことか"),
	q("shiyo", "育ててたのに、ぜんぶパー？\n泣いてないわよ。ほこりよ", {
		emote: "汗",
	}),
	q("feris", "レベル、とられちゃった〜？\n私は1回も、とられてない〜"),
	q("zero", "レベルのリセット……。\nゼロもメンテのたびに少し忘れます"),
];

/** 転載ガモ。 */
const TENSAI: readonly Quote[] = [
	q("nanj", "転載はあかんで。ほんまに。\nワイのレスもまとめられたわ"),
	q("feris", "私の絵も、まとめられたこと\nあるよ〜。ふぇ……ふぇ……", {
		gesture: "shiver",
	}),
	q("shiyo", "持ち物、ぜんぶ持ってかれたの？\n倉庫にあずけておきなさい"),
	q("zero", "転載されたログは、ゼロが\nぜんぶ元スレにつなぎ直します！"),
];

/** ワイ バーン。 */
const WYVERN: readonly Quote[] = [
	q("nanj", "ワイちゃうで。\nワイちゃうからな", { gesture: "shake" }),
	q("shiyo", "ドラゴン？あたすの声のほうが\nずっと大きいわよ"),
	q("feris", "炎〜？私のタンクトップと\nおそろいだね〜"),
];

/** かまってちゃん（id は kaso）。 */
const KASO: readonly Quote[] = [
	q("nanj", "かまってちゃんにつかまったんか！\nワイなら3日はレスしたるで！"),
	q("roze", "かまってちゃんはこわいアル。\nちょっとだけアル"),
];

/** ゾンJ民。 */
const ZONJ: readonly Quote[] = [
	q("nanj", "ゾンJ民、ワイの知り合いかも\nしれん。聞かんといて"),
	q("zero", "「ほ…しゅ…」ですか。\nゼロ、返事の練習をしておきます"),
];

/** 文字化け。 */
const MOJIBAKE: readonly Quote[] = [
	q("zero", "文字化け、ゼロにも読めません。\nサブ機は読めたそうです"),
	q("feris", "文字化けって、たまに\nちょっとかわいく見えない〜？"),
];

// ───────────────── 持ち帰ったあと ─────────────────
const CLEAR: readonly Quote[] = [
	q("nanj", "長湯スレ、持って帰ったんか！\nワイが名付けた子や（自称）", {
		emote: "!",
	}),
	q("roze", "おかえりアル。\nそれだけアル"),
	q("feris", "長湯スレ、いっしょにきこ〜。\nくしゃみ、がまんするから〜"),
	q("shiyo", "お、お帰りなさいませ。\nいまのは練習よ。練習！", {
		emote: "汗",
	}),
	q("zero", "通り、生き返りました！ゼロ、拍手の\n音量を最大にしました！", {
		gesture: "hop",
	}),
	qb(
		["night", "late"],
		"feris",
		"おかえり〜。夜のおかえりは、\nちょっと小さい声で〜",
	),
	qb(["morning"], "nanj", "朝イチで持って帰ったんか。\n出勤前にええもん見たわ"),
];

/** 2回目からの　持ち帰り。 */
const CLEAR_AGAIN: readonly Quote[] = [
	q("nanj", "また行ってきたんか。\nもう常連やな"),
	q("shiyo", "また行くの？……止めないわよ。\nあたすのほうが先に着くけど"),
	q("roze", "何回でもいいアル。\nわたしはここで麻婆食べてるアル"),
	q("feris", "またもぐるの〜？\nいってらっしゃ〜い"),
];

// ───────────────── 何回も（10回目から） ─────────────────
const MANY: readonly Quote[] = [
	q("nanj", "スレならもうPartいくつや。\n数えるのやめたわ"),
	q("shiyo", "何度たおれてももぐるのね。\nあたすの勝ち、ふえるだけよ"),
	q("feris", "何回でもいいよ〜。\n私、何回でもageるから〜"),
	q("roze", "こんなに通うなら、底に\n麻婆豆腐の屋台を出すアル"),
	q("zero", "キリコさんの記録、もうゼロでは\nないですね。ゼロはゼロですが"),
];

// ───────────────── 選び方 ─────────────────
/** たおれ方（cause）に合う たまり。上から順に見る。 */
const CAUSE_POOLS: readonly {
	match: (cause: string) => boolean;
	pool: readonly Quote[];
}[] = [
	{ match: (c) => c.includes("おなかが"), pool: STARVE },
	{ match: (c) => c.includes("荒らし草"), pool: POISON },
	{ match: (c) => c.includes("爆発") || c.includes("地雷"), pool: BLAST },
	{ match: (c) => c.includes("寝落ち民"), pool: NEOCHI },
	{ match: (c) => c.includes("コピペ"), pool: COPIPE },
	{ match: (c) => c.includes("忍法帖"), pool: NINPO },
	{ match: (c) => c.includes("転載ガモ"), pool: TENSAI },
	{ match: (c) => c.includes("ワイ バーン"), pool: WYVERN },
	{ match: (c) => c.includes("かまってちゃん"), pool: KASO },
	{ match: (c) => c.includes("ゾンJ民"), pool: ZONJ },
	{ match: (c) => c.includes("文字化け"), pool: MOJIBAKE },
	{
		match: (c) =>
			(c.includes("ぷゆゆ") || c.includes("とうすこ")) && !c.includes("メタル"),
		pool: PUYU,
	},
];

/** どこまで 行ったかで（板の 何割か。上りの 板の 奥は 高さの ことば）。 */
const depthPool = (last: NonNullable<QuoteContext>): readonly Quote[] => {
	const ratio = last.ratio ?? last.depth / DUNGEONS.main.floors;
	return ratio < 0.3 ? SHALLOW : ratio < 0.7 ? MID : last.up ? HIGH : DEEP;
};

/** seed と salt から 32bit の値（同じ seed なら いつも同じ）。 */
const mix = (seed: number, salt: number): number => {
	let h =
		(Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
	h ^= h >>> 15;
	h = Math.imul(h, 0x2c1b3c6d) >>> 0;
	h ^= h >>> 12;
	h = Math.imul(h, 0x297a2d39) >>> 0;
	h ^= h >>> 15;
	return h >>> 0;
};

const at = (
	pool: readonly Quote[],
	seed: number,
	salt: number,
): Quote | null =>
	pool.length ? (pool[mix(seed, salt) % pool.length] ?? null) : null;

/**
 * 起動の札の ひとこと。前の冒険の結果から たまりを選び、seed で1つ引く
 * （同じ seed なら 同じセリフ）。null は まだ一度も降りていないとき。
 * who を渡すと その人の セリフだけから引く（村で 話しかけたとき）。選んだ たまりに その人の分が 無ければ、
 * 次の たまり（持ち帰りなら 1回目の たまり、たおれなら 深さの たまり）から引く。
 * who を渡さないときは どの たまりにも セリフが あるので、引き方は 前と 同じ。
 */
export const pickQuote = (
	last: QuoteContext,
	seed: number,
	who?: Speaker,
	/** 村に いない 仲間（まだ 越してきて いない。data/story/story.ts の awayFriends）。その人の セリフは 引かない。 */
	away: readonly Speaker[] = [],
	/** しゃべらせない 仲間（冒険から 帰って きた 本人。自分を ねぎらわない）。名前が 出てくる セリフは 引く。 */
	mute: readonly Speaker[] = [],
	/** いまの 時間帯（時間帯つきの 台詞は その 時間帯だけ。省けば 時間帯つきは 出ない）。 */
	band?: QuoteBand,
): Quote | null => {
	const pick = (pool: readonly Quote[], salt: number) =>
		at(
			pool.filter(
				(x) =>
					(!who || x.who === who) &&
					(!x.bands || (!!band && x.bands.includes(band))) &&
					!away.includes(x.who) &&
					!mute.includes(x.who) &&
					!away.some((w) => x.text.includes(SPEAKERS[w].name)),
			),
			seed,
			salt,
		);
	if (!last) return pick(FIRST, 1);
	if (last.kind === "clear") {
		const again = last.clears >= 2 && mix(seed, 2) % 2 === 0;
		return (again ? pick(CLEAR_AGAIN, 3) : null) ?? pick(CLEAR, 3);
	}
	if (last.runs >= 10 && mix(seed, 4) % 4 === 0) {
		const many = pick(MANY, 5);
		if (many) return many;
	}
	const cause = CAUSE_POOLS.find((c) => c.match(last.cause))?.pool;
	if (cause && mix(seed, 6) % 3 !== 0) {
		const line = pick(cause, 7);
		if (line) return line;
	}
	// たおれて もどった ときは ときどき「放送事故」の ひとこと
	if (last.kind === "dead" && mix(seed, 9) % 4 === 0) {
		const next = pick(NEXT_THREAD, 10);
		if (next) return next;
	}
	return pick(depthPool(last), 8);
};

// ───────────────── はじめて降りる前 ─────────────────
export const INTRO: string[] = [
	"風呂板の大浴場。\n町の銭湯の源泉は、ここから来ている。",
	"銭湯を閉めたのは、42℃派の\n立てこもりらしい。",
	"源泉の底で、番頭が\n長湯スレをかかえて待っているという。",
	// 入口の 天丼（STORY.md §4.9「成り上がりと 転落」）：本筋の 板は「〜が、ほしかった。」で 降りる
	"総統キリコは蓄音機のハンドルをまわした。",
	"源泉が、ほしかった。",
];

// ───────────────── 長湯スレを　持ち帰ったあと ─────────────────
/**
 * 第三話の 頭の 5枚。カメラは 銭湯（やきうは もう 湯船。口の 前には 並ばず 銭湯の 前で 待つ）→ 場面を 銭湯の 前へ
 * うつして、ゼロが 湯船へ 走る。
 */
const BATH_HEAD: StoryPage[] = [
	{
		who: null,
		text: "村に帰りつくと、\n銭湯ののれんが上がっていた。",
		look: [36, 27],
	},
	// 企画の 型：任侠映画の 語り（ジャンルの 声。後半は 天気予報 → 港の 中継へ 乗りかわる）
	{
		who: null,
		anchor: "doc",
		text: "41℃派と42℃派。湯をめぐる\n抗争は、41.5℃で手打ちとなった",
	},
	{
		who: "nanj",
		text: "おっそ！総統さまの一番風呂、\nもう入っとるで！",
		standAt: [35, 30],
	},
	// 「湯気で」：屋根から 町の 上まで 湯気（ui/village/sceneMarks.ts の bathSteam。場面の おわりまで）
	{
		who: null,
		text: "湯船に町の人がずらり。\n湯気で、だれがだれだかわからない。",
		cut: [35, 30],
		mark: "bathSteam",
	},
	// ボケ（ゼロ）→ ツッコミ（やきう）。ゼロは 湯船（のれん）へ かけよって 舐める
	{
		who: "zero",
		text: "湯船の温度、41.5℃です！\n舐めて測りました！",
		emote: "!",
		go: [{ who: "zero", to: [35, 30], speed: 3, face: "up" }],
	},
	{ who: "nanj", text: "舐めるな！", emote: "驚", hit: "whack" },
];

export const ENDING: StoryPage[] = [
	...BATH_HEAD,
	// シヨは 湯温に うるさい（STORY.md §4.9）。ここから 湯温の けんかの 曲（界隈曲その3。のぼせる 窓で 切る）
	{
		who: "shiyo",
		text: "41.5℃？ちょうどいいじゃない！\nべ、べつにほめてないけど！",
		bgm: "kaiwai3",
		go: [{ who: "shiyo", to: "kiriko", speed: 3 }],
	},
	// 湯気の 中（カメラは 銭湯の 奥）
	{
		who: null,
		text: "ぬるい！",
		nanashi: "湯気の中の42℃派",
		look: [36, 27],
	},
	{ who: null, text: "熱い！", nanashi: "湯気の中の41℃派" },
	// 緊張（STORY.md「笑いの 理論から 見た 201」）：けんかの 曲を 止めて、取り返しの つかない ボタンを 見せる。
	// 叫ばない。「押すなよ」の 型：シヨが 静かに 止めて、キリコが うなずいて 連打する（悪手を 本人に 予告させない）
	{
		who: "zero",
		text: "源泉の圧、いま限界です。\nあと1回たいたら、町があふれます",
		emote: "冷",
		look: null,
		bgm: null,
	},
	{
		who: "shiyo",
		text: "……その追いだきボタン、\nぜったいに押さないで",
		emote: "…",
	},
	{
		who: null,
		text: "……わかったンゴ",
		kiriko: "voice",
		gesture: "nod",
		pause: 900,
	},
	// のれんの 前（追いだきの ボタン）へ 走って、その場で 連打（地団駄）。けんかの 曲が もどる
	{
		who: null,
		text: "キリコは追いだきのボタンを、\n両手で連打した。",
		se: "pushButton",
		seRepeat: 8,
		seGap: 100,
		bgm: "kaiwai3",
		go: [{ who: "kiriko", to: [35, 30], speed: 3, face: "up" }],
	},
	// 暴力系ヒロイン：シヨが 先に 手を 出す（間を おいて げんこつ）
	{
		who: "shiyo",
		text: "押すなって言ったでしょ！！",
		emote: "驚",
		hit: "punch",
		pause: 400,
	},
	// 言いわけの 独り言（201：ひとりの 暴走を 長く 聞かせる）。押さずに 畳みかけて、最後の 1枚で 止まる
	{
		who: null,
		text: "フリだと思ったンゴ。押すなと\n言われたら押すのが、礼儀ンゴ",
		kiriko: "voice",
		emote: "青",
		auto: 1300,
	},
	{
		who: null,
		text: "それに追いだきは、湯を守る\nボタンンゴ。つまり吾輩は湯の味方",
		kiriko: "voice",
		auto: 1300,
	},
	{
		who: null,
		text: "悪いのはボタンンゴ。\n吾輩は、おかしくないンゴ",
		kiriko: "voice",
		emote: "得",
	},
	// 温度の 方へ ふくらむ（銭湯 → 町の 水道 → 港の 海）。港の 海は 41.5℃の まま 残る（data/town/revival.ts の 銭湯の 並び）。
	// 温度の 段は 図で なく、商店街（町じゅうの 蛇口）→ 港（海）へ 動く カメラと 湯けむりで 見せる
	// 語りは ジャンルの 声（ANCHORS）：天気予報 → 港の 中継と 番組が 乗りかわる
	{
		who: null,
		anchor: "weather",
		text: "お天気です。町はくもりときどき\nお湯。蛇口は、41.5℃でしょう",
		se: "explosion",
		fx: "boom",
		look: [45, 17],
	},
	{
		who: "zero",
		text: "ゼロの冷却水まで41.5℃！\n湯あたりです！",
		emote: "汗",
		gesture: "shiver",
		look: null,
		go: [{ who: "zero", route: "lrlr", speed: 3 }],
	},
	// シヨは 自宅の 台所へ 走って いく（カメラが ついていく）
	{
		who: "shiyo",
		text: "台所でお風呂に入れるじゃない！\nあたす、43℃にしてくる！",
		gesture: "hop",
		go: [{ who: "shiyo", to: [28, 22], speed: 3, follow: true }],
	},
	{
		who: null,
		text: "吾輩、温泉を\n掘り当てたンゴ！",
		emote: "得",
		kiriko: "voice",
		look: null,
	},
	// ロゼの 持ちネタ：言い切った 常識が、押したら かわる
	{
		who: "roze",
		text: "止めるアル！ボタンは、\n押したら止まるのが常識アル！",
		emote: "怒",
		go: [{ who: "roze", to: "kiriko", speed: 3 }],
	},
	{
		who: null,
		text: "ロゼはボタンを止めようとして、\n「強」に押しこんだ。",
		se: "pushButton",
		go: [{ who: "roze", route: "udud", speed: 3 }],
	},
	{
		who: "roze",
		text: "……押したら強になるのが、\n今日から常識アル",
		emote: "青",
		hit: "sting",
	},
	// けんかの 曲を ぷつっと 切って、無音で ちーん（笑いの 間。BGM.md §1）。場面を 港へ うつす（海が 湯）
	{
		who: null,
		anchor: "news",
		text: "現場の港です。海水温41.5℃、\n魚が肩までつかっています",
		se: "chiin",
		fx: "chiin",
		bgm: null,
		cut: [20, 45],
		// 港の 海から 湯気（ui/village/sceneMarks.ts。銭湯の 並びが 生き返ると 町に 残る）
		mark: "seaSteam",
	},
	// フェリスは 桟橋の 先へ 走って 魚を 見る（カメラが ついていく）。フェリスが まだ 町に いない（離島板・電池板の 前）
	// ときは ゼロ（かわりが ないと 語りごと 2回目の 短い 語りに なる：story.ts の endingFor）
	{
		who: "feris",
		text: "お魚さん、のぼせてる〜！\nタオル、頭にのせてる〜！",
		gesture: "hop",
		card: null,
		go: [{ who: "feris", to: [23, 50], speed: 3, face: "down", follow: true }],
		instead: {
			who: "zero",
			text: "魚が、頭にタオルをのせてます！\n数えました、全部です！",
			emote: "!",
			card: null,
			go: [{ who: "zero", to: [23, 50], speed: 3, face: "down", follow: true }],
		},
	},
	// 書きこみが 早すぎる（やきうは 町の 名無しの ひとり）。場面を 掲示板へ うつして、書きこみの 絵。
	// やきうは 湯船へ 走って もどって ごまかす
	// フェリスの 持ちネタ：やきう（湯船の 中）の 出題に、斜め上の 答え
	{
		who: "nanj",
		text: "問題や。魚が肩まで\nつかっとる。肩はどこや？",
		about: "feris",
		look: null,
		// フェリスが まだ 町に いない（離島板・電池板の 前）ときは、出題の かわりに やきうが ひとりで ぼやく
		instead: {
			who: "nanj",
			text: "魚が肩までつかっとる。\n……魚に肩、あったか？",
			look: null,
		},
	},
	{
		who: "feris",
		text: "えら〜。\nえらそうに、つかってる〜",
		emote: "♪",
		instead: { who: "zero", text: "えらまでです！\n数えました！", emote: "得" },
	},
	// 成り上がりの 3段目（STORY.md §4.9「成り上がりと 転落」）：海ごと 温泉に して 入湯料を 取り、湯船で 即位する。
	// 演出は 本気（止め絵の 決めポーズ）、題材は くだらない
	{
		who: null,
		text: "港の海、まるごと入湯料を\nとるンゴ。国が建つンゴ",
		kiriko: "voice",
		emote: "得",
		look: null,
	},
	{
		who: null,
		anchor: "news",
		text: "速報です。総統キリコが、湯船で\n皇帝に即位しました",
		se: "townUp",
		fx: "freeze",
		caption: "皇帝キリコ　即位",
		cut: [35, 30],
		go: [{ who: "kiriko", to: [35, 30], speed: 3, face: "down" }],
	},
	{
		who: "shiyo",
		text: "湯船で即位しないで！\n湯がにごるでしょ！",
		emote: "怒",
		hit: "punch",
	},
	{
		who: null,
		text: "掲示板に、もう書きこみがあった。\n『【悲報】キリコ、海をわかす』",
		se: "read",
		cut: [16, 22],
		card: boardOf("『【悲報】キリコ、海をわかす』"),
	},
	{
		who: null,
		text: "書くの、早すぎるンゴ！\nだれが書いたンゴ！？",
		kiriko: "voice",
		card: null,
	},
	{
		who: "feris",
		text: "やきうくん、ずっと湯船に\nいたのに、手がインクまみれ〜",
		about: "nanj",
		instead: {
			who: "zero",
			text: "書きこみのインク、まだ\nかわいてません！",
		},
	},
	// 答えに ならない 言いわけで 切る（ツッコミは 入れない）
	{
		who: "nanj",
		text: "ワイはいま、潜水の練習中や！\n話しかけんな！ぶくぶく！",
		emote: "汗",
		go: [{ who: "nanj", to: [35, 30], speed: 3, follow: true }],
		instead: {
			who: "zero",
			text: "湯船から、ぶくぶく\n泡だけがのぼってきます！",
		},
	},
	// 毒（2026-10-21）：潜水で ごまかした まま、浮いて こない。浮いても 真顔で 言いわけを 続ける
	{
		who: null,
		text: "やきうは、そのまま\n浮いてこなかった。",
		about: "nanj",
		auto: 1300,
		fx: "ko",
		caption: "やきうは　のぼせた",
	},
	{
		who: "nanj",
		text: "（ぷかー）\n……書いてへんで",
		auto: 1300,
	},
];

/**
 * 2回目からの 語り（銭湯が 開いて いるかは 言わない。停電の あいだに 持ち帰っても うそに ならない ように）。
 */
export const ENDING_AGAIN: StoryPage[] = [
	{ who: null, text: "蓄音機に、長湯スレの\n湯の音がまた1枚ふえた。" },
	{
		who: "zero",
		text: "港の海、まだ41.5℃です！\n魚がまだ肩までつかってます！",
		emote: "!",
		look: [21, 48],
		go: [{ who: "zero", to: "kiriko", speed: 3 }],
	},
];
