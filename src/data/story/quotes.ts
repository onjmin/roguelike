// ダンジョンの外のセリフ。話すのは 外で待っている仲間だけ（キリコが しゃべるのは 村の 雑談と 喫茶だけ。data/people/mobs.ts・cafe.ts）。
// - 起動の札・村：前の冒険の結果に、仲間のだれかが ひとこと（pickQuote）。
// - はじめて降りる前の ナレーション（INTRO）と、長湯スレを持ち帰ったあと（ENDING）。
// 1行は全角22字・2行まで。説明せず、行間を読ませる（rpg README「セリフの書き方」）。
// 名前・色は rpg の cast.ts と同じ（シヨ・ゼロは rpg に いないので ここで 決めた 色）。

import { DUNGEONS } from "../../core/data/dungeons";
import type { DungeonId } from "../../core/types";
import type { Cue } from "../../engine/emote";
import type { SceneFx } from "../../engine/sceneFx";
import type { MobId } from "../people/mobs";

export type Speaker = "roze" | "shiyo" | "feris" | "zero" | "nanj";

export const SPEAKERS: Record<Speaker, { name: string; color: string }> = {
	roze: { name: "ロゼ", color: "#ff6f91" },
	shiyo: { name: "シヨ", color: "#e8483f" },
	feris: { name: "フェリス", color: "#ffd166" },
	zero: { name: "ゼロ", color: "#5cc8f0" },
	// やきう（ワイ）。呼び名は みんな「やきう」、フェリスだけ「やきうくん」
	nanj: { name: "やきう", color: "#f5d142" },
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
	 * 地の文の 前に 出す 場面の エフェクト（engine/sceneFx.ts。村の 持ち帰りの 語りだけ）。煙・暗転などは 頁の
	 * あいだ 残り、次の 頁も 同じ fx なら そのまま つづく。付けるのは se と 同じく オチと 山場だけ（STORY.md §0）。
	 */
	fx?: SceneFx;
	/** この 頁から 鳴らす 曲（data/audio/bgm.ts の 名前。null で 止める。村の 持ち帰りの 語りだけ。場面 専用の 曲）。 */
	bgm?: string | null;
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
	q("roze", "スレは、短いのが常識アル。\n……長いと1000で追い出されるアル"),
	q("feris", "いってらっしゃ〜い。\n事故っても、また復活できるよ〜"),
	q("shiyo", "あなた、ひとりで行くの？\n……生きてこそだ。忘れないで"),
	q("zero", "おかえりの練習、100回しました。\n……あ、まだ出発前でしたね", {
		emote: "汗",
	}),
];

// ───────────────── 深さで（たおれた階） ─────────────────
/** 板の 3割まで。 */
const SHALLOW: readonly Quote[] = [
	// 野球の たとえ（いま ナイターを やっている とは 言わない：どの 時刻にも 出る）
	q("nanj", "はっや。試合なら、\nまだ1回の表やで"),
	q("nanj", "草。……いや、笑ってへんで。\n笑ってへんけど、草", { emote: "汗" }),
	q("feris", "もうもどってきた〜？\nお茶、まだあったかいよ〜"),
	q("roze", "入口のあたりは忘れスレの霊が\n多いアル。……知り合いアル"),
	q("shiyo", "もう帰ってきたの？\n……掃除、まだ終わってないわよ"),
	q("zero", "おかえりなさい！ハグの準備が\n……あ、いらない。了解です", {
		gesture: "slump",
	}),
	// 夜だけ（ナイターの 時間）
	qb(["night"], "nanj", "はっや。ナイター、\nまだ1回の表やで"),
	qb(["morning"], "feris", "おはよ〜。朝から\nもうもどってきた〜？"),
];

/** 板の 7割まで。 */
const MID: readonly Quote[] = [
	q("roze", "そのあたりは風が吹くアル。\n……カツラ、おさえるアル"),
	q("nanj", "おかえり。試合なら、\n5回の裏ってとこや"),
	q("feris", "まんなかって、いちばん上？\nいちばん下？……どっちでもないか〜", {
		emote: "?",
	}),
	q("feris", "そのへん、自演くんいるよね〜。\n……私の別アカじゃないよ〜"),
	q("shiyo", "ふんっ。まあまあじゃない。\n……ほめてないわよ、あたすは"),
	q("zero", "まんなかまで行ったんですね。\nサブ機たちと拍手しました", {
		gesture: "hop",
	}),
	qb(["night"], "nanj", "おかえり。ナイターは\nいま5回の裏や"),
	qb(["evening"], "roze", "夕飯どきアル。\n麻婆豆腐、できてるアル"),
];

/** 板の 奥（7割から）。下りの 板。 */
const DEEP: readonly Quote[] = [
	q("shiyo", "そんな底まで行って……。\nあなた、ほんとにばかなんだから"),
	q("shiyo", "……あと少しだった、なんて\nあたすは言わないわよ"),
	q("nanj", "9回の裏まで来とったで。\n……延長戦、あるやろ？"),
	q("roze", "そんな深くまで……。\n麻婆豆腐、食べながら聞くアル"),
	q("feris", "そんな下まで〜？\n私、飛んでも届かないよ〜"),
	q("zero", "そんな深くのログ、\nゼロ、はじめて見ました！", {
		emote: "!",
	}),
	// 深夜だけ（夜ふかし）
	qb(["late"], "shiyo", "こんな時間まで……。\nあなた、ちゃんと寝てるの？"),
	qb(["late"], "zero", "深夜です。……ゼロは\n眠らないので、見張ってました"),
];

/** 板の 奥（7割から）。上りの 板（塔・やぐら・山）。 */
const HIGH: readonly Quote[] = [
	q("shiyo", "そんな上まで行って……。\nあなた、ほんとにばかなんだから"),
	q("shiyo", "……あと少しだった、なんて\nあたすは言わないわよ"),
	q("nanj", "9回の裏まで来とったで。\n……延長戦、あるやろ？"),
	q("roze", "そんな高くまで……。\n麻婆豆腐、食べながら聞くアル"),
	q("feris", "そんな上まで〜？\n私なら、飛んで届くかな〜"),
	q("zero", "そんな高くのログ、\nゼロ、はじめて見ました！", {
		emote: "!",
	}),
];

// ───────────────── 放送事故（たおれても 終わりじゃない） ─────────────────
/** たおれて もどったとき ときどき（倒れても 次の スレが ある）。 */
const NEXT_THREAD: readonly Quote[] = [
	q("nanj", "倒れたんか。……掲示板、\n3回見たで。草"),
	q("feris", "事故った〜？私なんて\n2005年から炎上中〜"),
	q("roze", "持ち物はもどらないアル。\n……次は、荷物をへらすアル"),
	q("shiyo", "掲示板の書きこみ、見たわよ。\n……べ、べつに泣いてないわよ"),
	q("zero", "倒れた階、記録しました。\n……グラフにすると、きれいです"),
	q("zero", "倒れた回数、グラフにしました。\n……右肩あがりです", {
		emote: "汗",
	}),
	q("roze", "あらすじ、もう\n「次回作にご期待」にしたアル"),
];

// ───────────────── たおれ方で ─────────────────
/** おなかが　すいて。 */
const STARVE: readonly Quote[] = [
	q("shiyo", "ぷゆゆがパン、持たせたでしょ！\n……食べなさいよ、ばか", {
		emote: "怒",
	}),
	q("nanj", "パン松に言うたろか。\n「メシを食え」って"),
	q("feris", "おなか、すいたでしょ〜。\nはい、あ〜ん", { emote: "♥" }),
	q("roze", "麻婆豆腐、作っておいたアル。\n……34キロ、もどすアル"),
	q("zero", "おなかのすく仕組み、\nわかったら代わりにすきます"),
];

/** 毒草を　飲んで。 */
const POISON: readonly Quote[] = [
	q("roze", "……草アル？\nどっちの草アル", { emote: "?" }),
	q("nanj", "草を飲んだんか。\n……いや、その草やないねん"),
	q("shiyo", "知らない草を口に入れない！\n……メイドの言うことは聞きなさい"),
	q("feris", "私、鳥だから草には\nくわしいよ〜。……たぶん〜"),
	q("zero", "毒草の見分け方、サブ機と\n3時間会議しました。……結論、なし", {
		gesture: "slump",
	}),
];

/** 地雷・炎上案件の　爆発。 */
const BLAST: readonly Quote[] = [
	q("nanj", "ドカン、って上まで\n聞こえたわ。……草は生えんかった"),
	q("feris", "ドーンってした〜。\n私のくしゃみより大きかった〜"),
	q("shiyo", "上までドカンって聞こえたわよ。\n……眼鏡、ずれたじゃない", {
		emote: "怒",
	}),
	q("roze", "上までけむりが来たアル。\nカツラ、洗うアル"),
	q("zero", "爆発の音、録音しておきました！\n……いらなかった、ですか", {
		emote: "汗",
	}),
];

/** ぷゆゆ（メタルは べつ。前の版の 記録の「とうすこ」も）。 */
const PUYU: readonly Quote[] = [
	q("nanj", "ぷゆゆに負けたんか。\n……村のあいつには、だまっとくわ"),
	q("roze", "あの子たち、泣きそうな顔で\n来るアル。……ずるいアル"),
	q("feris", "ぷゆゆに〜？\nあの子、よちよちだよ〜？", { emote: "?" }),
	q("shiyo", "……あの上目づかいに負けたの？\nあたすなら、ひと睨みで勝つわ"),
	q("zero", "ぷゆゆさんとなかよくなる方法、\nゼロにも教えてください"),
];

/** 寝落ち民。 */
const NEOCHI: readonly Quote[] = [
	q("nanj", "寝落ちはあかん。\n……ワイも実況中によくやるけど", {
		emote: "汗",
	}),
	q("feris", "ねむくなっちゃった〜？\n私の羽、まくらになるよ〜"),
	q("shiyo", "寝るならベッドで寝なさい。\n……シーツは、替えてあるわよ"),
	q("roze", "ねてる子は起こさないアル。\n……あの子はべつアル"),
	q("zero", "眠るって、どんな感じですか。\n……ゼロ、まだ知らないんです", {
		emote: "?",
	}),
];

/** コピペ。 */
const COPIPE: readonly Quote[] = [
	q("nanj", "コピペにやられたんか。\n……あれ、元ネタワイやで（自称）"),
	q("roze", "ふえるやつはいっぺんに\nたたくアル。常識アル"),
	q("feris", "コピペって、何回見ても\nちょっとわらっちゃうよね〜"),
	q("shiyo", "同じものがぞろぞろふえるの？\n……掃除がたいへんじゃない"),
	q("zero", "ゼロにもサブ機がいるので、\nコピペの気もち、少しわかります"),
];

/** 忍法帖エラー。 */
const NINPO: readonly Quote[] = [
	q("nanj", "忍法帖エラーかいな。\nワイも何回書き直したことか"),
	q("shiyo", "育ててたのに、ぜんぶパー？\n……泣いてないわよ。ほこりよ", {
		emote: "汗",
	}),
	q("feris", "レベル、とられちゃった〜？\n私のお勉強、わけてあげる〜"),
	q("zero", "レベルのリセット……。\nゼロもメンテのたびに少し忘れます"),
];

/** 転載ガモ。 */
const TENSAI: readonly Quote[] = [
	q("nanj", "転載はあかんで。ほんまに。\n……ワイのレスもまとめられたわ"),
	q("feris", "私の絵も、まとめられたこと\nあるよ〜。……ふぇ……ふぇ……", {
		gesture: "shiver",
	}),
	q("shiyo", "持ち物、ぜんぶ持ってかれたの？\n……倉庫にあずけておきなさい"),
	q("zero", "転載されたログは、ゼロが\nぜんぶ元スレにつなぎ直します！"),
];

/** ワイ バーン。 */
const WYVERN: readonly Quote[] = [
	q("nanj", "ワイちゃうで。\n……ワイちゃうからな", { gesture: "shake" }),
	q("shiyo", "ドラゴン？あたすの声のほうが\n……ずっと大きいわよ"),
	q("feris", "炎〜？私のタンクトップと\nおそろいだね〜"),
];

/** かまってちゃん（id は kaso）。 */
const KASO: readonly Quote[] = [
	q("nanj", "かまってちゃんにつかまったんか。\n……ワイが相手しとったらなあ"),
	q("roze", "かまってちゃんはこわいアル。\n……ちょっとだけアル"),
];

/** ゾンJ民。 */
const ZONJ: readonly Quote[] = [
	q("nanj", "ゾンJ民、ワイの知り合いかも\nしれん。……聞かんといて"),
	q("zero", "「ほ…しゅ…」ですか。\nゼロ、返事の練習をしておきます"),
];

/** 文字化け。 */
const MOJIBAKE: readonly Quote[] = [
	q("zero", "文字化け、ゼロにも読めません。\n……サブ機は読めたそうです"),
	q("feris", "文字化けって、たまに\nちょっとかわいく見えない〜？"),
];

// ───────────────── 持ち帰ったあと ─────────────────
const CLEAR: readonly Quote[] = [
	q("nanj", "長湯スレ、持って帰ったんか！\n……ワイが名付けた子や（自称）", {
		emote: "!",
	}),
	q("roze", "……おかえりアル。\nそれだけアル"),
	q("feris", "長湯スレ、いっしょにきこ〜。\nくしゃみ、がまんするから〜"),
	q("shiyo", "……お、お帰りなさいませ。\nいまのは練習よ。練習！", {
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
	qb(
		["morning"],
		"nanj",
		"朝イチで持って帰ったんか。\n……出勤前にええもん見たわ",
	),
];

/** 2回目からの　持ち帰り。 */
const CLEAR_AGAIN: readonly Quote[] = [
	q("nanj", "また行ってきたんか。\n……もう常連やな"),
	q("shiyo", "また行くの？……止めないわよ。\nお茶、いれて待ってるから"),
	q("roze", "何回でもいいアル。\nわたしはここで麻婆食べてるアル"),
	q("feris", "またもぐるの〜？\n……いってらっしゃ〜い"),
];

// ───────────────── 何回も（10回目から） ─────────────────
const MANY: readonly Quote[] = [
	q("nanj", "スレならもうPartいくつや。\n……数えるのやめたわ"),
	q("shiyo", "何度たおれてももぐるのね。\n……そういうの、きらいじゃない"),
	q("feris", "何回でもいいよ〜。\n私、何回でもageるから〜"),
	q("roze", "こんなに通うなら、底に\n麻婆豆腐の屋台を出すアル"),
	q("zero", "キリコさんの記録、もうゼロでは\nないですね。……ゼロはゼロですが"),
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
	"キリコは蓄音機のハンドルをまわした。",
	"……ひとりで、降りる。",
];

// ───────────────── 長湯スレを　持ち帰ったあと ─────────────────
/** 2回目からは 頭の 5枚（湯温の もめごとと 夜の 湯船は 1回だけ）。 */
const BATH_HEAD: StoryPage[] = [
	{
		who: null,
		text: "村に帰りつくと、\n銭湯ののれんが上がっていた。",
	},
	{ who: "nanj", text: "おっそ。一番風呂、\nもう入っとるで" },
	{
		who: null,
		text: "湯船に町の人がずらり。\n湯気で、だれがだれだかわからない。",
	},
	// ボケ（ゼロ）→ ツッコミ（やきう）
	{
		who: "zero",
		text: "湯船の温度、41.5℃です！\n数えました！",
		emote: "!",
	},
	{ who: "nanj", text: "温度は測るもんや" },
];

export const ENDING: StoryPage[] = [
	...BATH_HEAD,
	// シヨは 湯温に うるさい（STORY.md §4.9）
	{
		who: "shiyo",
		text: "41.5℃……ちょうどいいじゃない。\nべ、べつにほめてないけど",
	},
	{ who: null, text: "ぬるい", nanashi: "湯気の中の42℃派" },
	{ who: null, text: "熱い", nanashi: "湯気の中の41℃派" },
	{
		who: null,
		text: "そのうち、また湯の温度で\nもめはじめた。",
	},
	{
		who: null,
		text: "追いだきのボタンが、\n連打された。",
		se: "pushButton",
		seRepeat: 6,
		seGap: 120,
	},
	{ who: null, text: "……押してたの、吾輩ンゴ", kiriko: "voice" },
	// 規模が ふくらむ（銭湯の 外まで）。次の 窓で のぼせて 浮いて、話は 湯船に もどる
	{
		who: null,
		text: "源泉が噴きあがった。\n湯けむりで、町まで見えなくなった。",
		se: "explosion",
		// 爆発の 煙が そのまま 湯けむり
		fx: "boom",
	},
	// 湯けむりの 中で ツッコむ（同じ fx は 煙が 残る）
	{ who: null, text: "……規模が、\nおかしいンゴ", kiriko: "voice", fx: "boom" },
	{
		who: null,
		text: "……1時間後。町の人はみんな\nのぼせて、浮いていた。",
		se: "chiin",
		fx: "chiin",
	},
	{
		who: "roze",
		text: "決着したのに、\nなんでもめるアル！",
		emote: "怒",
	},
	// 夜の 湯船（転の 前ぶれ。やきうの 本音：人が おらん 町は つまらん）
	{
		who: null,
		text: "夜。湯船に、やきうがひとり\n残っていた。",
		about: "nanj",
		// 夜の 曲（夜ふかしの板）。かわりの 頁も 同じ 曲
		bgm: "yofukashi",
		instead: { who: null, text: "夜。町はしずかだった。", bgm: "yofukashi" },
	},
	{ who: "nanj", text: "……今日は、人が多かったな" },
	{
		who: null,
		text: "……町、にぎやかに\nなってきたンゴ",
		kiriko: "voice",
	},
	{ who: "nanj", text: "……人がおらん町は、\nつまらんからな", emote: "…" },
	{ who: "feris", text: "……やきうくん、\nなにか知ってる顔〜" },
	{ who: null, text: "やきうは、湯に顔までしずんだ。", about: "nanj" },
];

/**
 * 2回目からの 語り（銭湯が 開いて いるかは 言わない。停電の あいだに 持ち帰っても うそに ならない ように）。
 */
export const ENDING_AGAIN: StoryPage[] = [
	{ who: null, text: "蓄音機に、長湯スレの\n湯の音がまた1枚ふえた。" },
	{
		who: "zero",
		text: "湯温、41.5℃のままです！\n……ずっと数えてます",
		emote: "!",
	},
];
