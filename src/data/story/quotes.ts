// ダンジョンの外のセリフ。話すのは 外で待っている仲間だけ（キリコが しゃべるのは 村の 雑談と 喫茶だけ。data/people/mobs.ts・cafe.ts）。
// - 起動の札・村：前の冒険の結果に、仲間のだれかが ひとこと（pickQuote）。
// - はじめて降りる前の ナレーション（INTRO）と、長湯スレを持ち帰ったあと（ENDING）。
// 1行は全角22字・2行まで。説明せず、行間を読ませる（rpg README「セリフの書き方」）。
// 名前・色は rpg の cast.ts と同じ（シヨ・ゼロは rpg に いないので ここで 決めた 色）。

import { DUNGEONS } from "../../core/data/dungeons";
import type { DungeonId } from "../../core/types";
import type { Cue } from "../../engine/emote";
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
 * キリコの ことば（口数は 少ないが、ふつうに 会話に 加わる。吾輩・ンゴで 短く。喋らない 主人公では ない）。
 * - voice … 声。ふだんは これ。仲間も 住人も 聞こえて、返事を してよい。読み上げは rpg と 同じ uc。
 * - think … 独白。（　）で かこんで 出す。だれも いない 場面だけ（ひとりで 古い スレを 読む ときなど）。声なし。
 * 決まり（STORY.md §5）：望み（名前を　おぼえて　ほしい）は 台詞で 言う。ダンジョンの 中では 出さない。
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
	/** 名無しの 1窓（who は null に しておく。名前欄だけ この 名前で、色は やきうの 黄色）。 */
	nanashi?: string;
	/** 村の 場面の 合図（ui/village/villageReturn.ts。地の文の 前に 起きる）。 */
	cue?: /** 大会の のこり 1人（鐘と 札）。 */
		| "res999"
		/** キリコ 1位（ファンファーレと 札）。 */
		| "res1000"
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
	q("nanj", "ひとりで　配信か。\nほな、見とるで"),
	q("roze", "配信は、短いのが　常識アル。\n……長いと　枠から　追い出されるアル"),
	q("feris", "いってらっしゃ〜い。\n事故っても、また　復活　できるよ〜"),
	q("shiyo", "あなた、ひとりで　行くの？\n……生きてこそだ。忘れないで"),
	q("zero", "おかえりの　練習、100回　しました。\n……あ、まだ　出発前でしたね", {
		emote: "汗",
	}),
];

// ───────────────── 深さで（たおれた階） ─────────────────
/** 板の 3割まで。 */
const SHALLOW: readonly Quote[] = [
	// 野球の たとえ（いま ナイターを やっている とは 言わない：どの 時刻にも 出る）
	q("nanj", "はっや。試合なら、\nまだ　1回の　表やで"),
	q("nanj", "草。……いや、笑ってへんで。\n笑ってへんけど、草", { emote: "汗" }),
	q("feris", "もう　もどってきた〜？\nお茶、まだ　あったかいよ〜"),
	q("roze", "入口の　あたりは　忘れスレの霊が\n多いアル。……知り合いアル"),
	q("shiyo", "もう　帰ってきたの？\n……掃除、まだ　終わってないわよ"),
	q("zero", "おかえりなさい！　ハグの　準備が\n……あ、いらない。了解です", {
		gesture: "slump",
	}),
	// 夜だけ（ナイターの 時間）
	qb(["night"], "nanj", "はっや。ナイター、\nまだ　1回の　表やで"),
	qb(["morning"], "feris", "おはよ〜。朝から\nもう　もどってきた〜？"),
];

/** 板の 7割まで。 */
const MID: readonly Quote[] = [
	q("roze", "その　あたりは　風が　吹くアル。\n……カツラ、おさえるアル"),
	q("nanj", "おかえり。試合なら、\n5回の　裏って　とこや"),
	q("feris", "まんなかって、いちばん上？\nいちばん下？　……どっちでもないか〜", {
		emote: "?",
	}),
	q("feris", "そのへん、自演くん　いるよね〜。\n……私の　別アカじゃ　ないよ〜"),
	q("shiyo", "ふんっ。まあまあ　じゃない。\n……ほめてないわよ、あたすは"),
	q("zero", "まんなかまで　行ったんですね。\nサブ機たちと　拍手　しました", {
		gesture: "hop",
	}),
	qb(["night"], "nanj", "おかえり。ナイターは\nいま　5回の　裏や"),
	qb(["evening"], "roze", "夕飯どきアル。\n麻婆豆腐、できてるアル"),
];

/** 板の 奥（7割から）。下りの 板。 */
const DEEP: readonly Quote[] = [
	q("shiyo", "そんな　底まで　行って……。\nあなた、ほんとに　ばかなんだから"),
	q("shiyo", "……あと　少しだった、なんて\nあたすは　言わないわよ"),
	q("nanj", "9回の　裏まで　来とったで。\n……延長戦、あるやろ？"),
	q("roze", "そんな　深くまで……。\n麻婆豆腐、食べながら　聞くアル"),
	q("feris", "そんな　下まで〜？\n私、飛んでも　届かないよ〜"),
	q("zero", "そんな　深くの　ログ、\nゼロ、はじめて　見ました！", {
		emote: "!",
	}),
	// 深夜だけ（夜ふかし）
	qb(["late"], "shiyo", "こんな　時間まで……。\nあなた、ちゃんと　寝てるの？"),
	qb(["late"], "zero", "深夜です。……ゼロは\n眠らないので、見張ってました"),
];

/** 板の 奥（7割から）。上りの 板（塔・やぐら・山）。 */
const HIGH: readonly Quote[] = [
	q("shiyo", "そんな　上まで　行って……。\nあなた、ほんとに　ばかなんだから"),
	q("shiyo", "……あと　少しだった、なんて\nあたすは　言わないわよ"),
	q("nanj", "9回の　裏まで　来とったで。\n……延長戦、あるやろ？"),
	q("roze", "そんな　高くまで……。\n麻婆豆腐、食べながら　聞くアル"),
	q("feris", "そんな　上まで〜？\n私なら、飛んで　届くかな〜"),
	q("zero", "そんな　高くの　ログ、\nゼロ、はじめて　見ました！", {
		emote: "!",
	}),
];

// ───────────────── 放送事故（たおれても 終わりじゃない） ─────────────────
/** たおれて もどったとき ときどき（放送事故も 撮れ高。次の 枠が ある。STORY.md §5）。 */
const NEXT_THREAD: readonly Quote[] = [
	q("nanj", "放送事故か。……アーカイブ、\n3回　見たで。草"),
	q("feris", "事故っても、\n復活は　何回でも　できるよ〜"),
	q("roze", "機材は　もどらないアル。\n……次は、荷物を　へらすアル"),
	q("shiyo", "事故の　切り抜き、見たわよ。\n……べ、べつに　泣いて　ないわよ"),
	q("zero", "同接、記録しました。\n……次は、もっと　数えたいです"),
	q("zero", "同接、グラフに　しました。\n……床と　同じ　高さです", {
		emote: "汗",
	}),
	q("roze", "サムネ、もう\n「次回作に　ご期待」に　したアル"),
];

// ───────────────── たおれ方で ─────────────────
/** おなかが　すいて。 */
const STARVE: readonly Quote[] = [
	q("shiyo", "ぷゆゆが　パン、持たせたでしょ！\n……食べなさいよ、ばか", {
		emote: "怒",
	}),
	q("nanj", "パン松に　言うたろか。\n「メシを　食え」って"),
	q("feris", "おなか、すいたでしょ〜。\nはい、あ〜ん", { emote: "♥" }),
	q("roze", "麻婆豆腐、作っておいたアル。\n……34キロ、もどすアル"),
	q("zero", "おなかの　すく　仕組み、\nわかったら　代わりに　すきます"),
];

/** 毒草を　飲んで。 */
const POISON: readonly Quote[] = [
	q("roze", "……草アル？\nどっちの　草アル", { emote: "?" }),
	q("nanj", "草を　飲んだんか。\n……いや、その草やないねん"),
	q(
		"shiyo",
		"知らない　草を　口に　入れない！\n……メイドの　言うことは　聞きなさい",
	),
	q("feris", "私、鳥だから　草には\nくわしいよ〜。……たぶん〜"),
	q("zero", "毒草の　見分け方、サブ機と\n3時間　会議しました。……結論、なし", {
		gesture: "slump",
	}),
];

/** 地雷・炎上案件の　爆発。 */
const BLAST: readonly Quote[] = [
	q("nanj", "ドカン、って　上まで\n聞こえたわ。……草は　生えんかった"),
	q("feris", "ドーンって　した〜。\n私の　くしゃみより　大きかった〜"),
	q("shiyo", "上まで　ドカンって　聞こえたわよ。\n……眼鏡、ずれたじゃない", {
		emote: "怒",
	}),
	q("roze", "上まで　けむりが　来たアル。\nカツラ、洗うアル"),
	q("zero", "爆発の　音、録音しておきました！\n……いらなかった、ですか", {
		emote: "汗",
	}),
];

/** ぷゆゆ（メタルは べつ。前の版の 記録の「とうすこ」も）。 */
const PUYU: readonly Quote[] = [
	q("nanj", "ぷゆゆに　負けたんか。\n……村の　あいつには、だまっとくわ"),
	q("roze", "あの子たち、泣きそうな　顔で\n来るアル。……ずるいアル"),
	q("feris", "ぷゆゆに〜？\nあの子、よちよちだよ〜？", { emote: "?" }),
	q(
		"shiyo",
		"……あの　上目づかいに　負けたの？\nあたすなら、ひと睨みで　勝つわ",
	),
	q("zero", "ぷゆゆさんと　なかよく　なる方法、\nゼロにも　教えてください"),
];

/** 寝落ち民。 */
const NEOCHI: readonly Quote[] = [
	q("nanj", "寝落ちは　あかん。\n……ワイも　実況中に　よく　やるけど", {
		emote: "汗",
	}),
	q("feris", "ねむく　なっちゃった〜？\n私の　羽、まくらに　なるよ〜"),
	q("shiyo", "寝るなら　ベッドで　寝なさい。\n……シーツは、替えてあるわよ"),
	q("roze", "ねてる子は　起こさないアル。\n……あの子は　べつアル"),
	q("zero", "眠るって、どんな　感じですか。\n……ゼロ、まだ　知らないんです", {
		emote: "?",
	}),
];

/** コピペ。 */
const COPIPE: readonly Quote[] = [
	q("nanj", "コピペに　やられたんか。\n……あれ、元ネタ　ワイやで（自称）"),
	q("roze", "ふえる　やつは　いっぺんに\nたたくアル。常識アル"),
	q("feris", "コピペって、何回　見ても\nちょっと　わらっちゃうよね〜"),
	q("shiyo", "同じ　ものが　ぞろぞろ　ふえるの？\n……掃除が　たいへんじゃない"),
	q(
		"zero",
		"ゼロにも　サブ機が　いるので、\nコピペの　気もち、少し　わかります",
	),
];

/** 忍法帖エラー。 */
const NINPO: readonly Quote[] = [
	q("nanj", "忍法帖エラーかいな。\nワイも　何回　書き直したことか"),
	q("shiyo", "育ててたのに、ぜんぶ　パー？\n……泣いてないわよ。ほこりよ", {
		emote: "汗",
	}),
	q("feris", "レベル、とられちゃった〜？\n私の　お勉強、わけてあげる〜"),
	q("zero", "レベルの　リセット……。\nゼロも　メンテの　たびに　少し　忘れます"),
];

/** 転載ガモ。 */
const TENSAI: readonly Quote[] = [
	q("nanj", "転載は　あかんで。ほんまに。\n……ワイの　レスも　まとめられたわ"),
	q("feris", "私の　絵も、まとめられたこと\nあるよ〜。……ふぇ……ふぇ……", {
		gesture: "shiver",
	}),
	q(
		"shiyo",
		"持ち物、ぜんぶ　持ってかれたの？\n……倉庫に　あずけて　おきなさい",
	),
	q("zero", "転載された　ログは、ゼロが\nぜんぶ　元スレに　つなぎ直します！"),
];

/** ワイ バーン。 */
const WYVERN: readonly Quote[] = [
	q("nanj", "ワイちゃうで。\n……ワイちゃうからな", { gesture: "shake" }),
	q("shiyo", "ドラゴン？　あたすの　声の　ほうが\n……ずっと　大きいわよ"),
	q("feris", "炎〜？　私の　タンクトップと\nおそろいだね〜"),
];

/** かまってちゃん（id は kaso）。 */
const KASO: readonly Quote[] = [
	q("nanj", "かまってちゃんに　つかまったんか。\n……ワイが　相手しとったらなあ"),
	q("roze", "かまってちゃんは　こわいアル。\n……ちょっとだけアル"),
];

/** ゾンJ民。 */
const ZONJ: readonly Quote[] = [
	q("nanj", "ゾンJ民、ワイの　知り合いかも\nしれん。……聞かんといて"),
	q("zero", "「ほ…しゅ…」ですか。\nゼロ、返事の　練習を　しておきます"),
];

/** 文字化け。 */
const MOJIBAKE: readonly Quote[] = [
	q("zero", "文字化け、ゼロにも　読めません。\n……サブ機は　読めたそうです"),
	q("feris", "文字化けって、たまに\nちょっと　かわいく　見えない〜？"),
];

// ───────────────── 持ち帰ったあと ─────────────────
const CLEAR: readonly Quote[] = [
	q("nanj", "長湯スレ、持って帰ったんか！\n……ワイが　名付けた子や（自称）", {
		emote: "!",
	}),
	q("roze", "……おかえりアル。\nそれだけアル。常識アル"),
	q("feris", "長湯スレ、いっしょに　きこ〜。\nくしゃみ、がまんするから〜"),
	q("shiyo", "……お、お帰りなさいませ。\nいまのは　練習よ。練習！", {
		emote: "汗",
	}),
	q("zero", "登録者、ふえました！　ゼロ、拍手の\n音量を　最大に　しました！", {
		gesture: "hop",
	}),
	qb(
		["night", "late"],
		"feris",
		"おかえり〜。夜の　おかえりは、\nちょっと　小さい　声で〜",
	),
	qb(
		["morning"],
		"nanj",
		"朝イチで　持って帰ったんか。\n……出勤前に　ええもん　見たわ",
	),
];

/** 2回目からの　持ち帰り。 */
const CLEAR_AGAIN: readonly Quote[] = [
	q("nanj", "また　行ってきたんか。\n……もう　常連やな"),
	q("shiyo", "また　行くの？　……止めないわよ。\nお茶、いれて　待ってるから"),
	q("roze", "何回でも　いいアル。\nわたしは　ここで　麻婆　食べてるアル"),
	q("feris", "また　もぐるの〜？\n……いってらっしゃ〜い"),
];

// ───────────────── 何回も（10回目から） ─────────────────
const MANY: readonly Quote[] = [
	q("nanj", "スレなら　もう　Partいくつや。\n……数えるの　やめたわ"),
	q("shiyo", "何度　たおれても　もぐるのね。\n……そういうの、きらいじゃない"),
	q("feris", "何回でも　いいよ〜。\n私、何回でも　ageるから〜"),
	q("roze", "こんなに　通うなら、底に\n麻婆豆腐の　屋台を　出すアル"),
	q(
		"zero",
		"キリコさんの　記録、もう　ゼロでは\nないですね。……ゼロは　ゼロですが",
	),
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
	"風呂板の　大浴場。\n配信者　みんなで、湯けむりコラボ。",
	"湯けむりで、だれが　だれだか\nわからない。",
	"源泉の　底で、湯守が\n長湯スレを　かかえて　待っているという。",
	"キリコは　蓄音機の　ハンドルを　まわした。",
	"……ひとりで、降りる。",
];

// ───────────────── 長湯スレを　持ち帰ったあと ─────────────────
/** 2回目からは 頭の 4枚（切り抜き職人と 夜の 湯船は 1回だけ）。 */
const BATH_HEAD: StoryPage[] = [
	{
		who: null,
		text: "村に　帰りつくと、\n銭湯の　前に　機材が　ならんでいた。",
	},
	{ who: "nanj", text: "おっそ。……コラボ枠、\nもう　始まっとるで" },
	{
		who: null,
		text: "湯船に　配信者が　ずらり。\n湯気で、だれが　だれだか　わからない。",
	},
	{
		who: "zero",
		text: "同接、ふえました！\n……湯けむりの　中から、コメントです",
		emote: "!",
	},
];

export const ENDING: StoryPage[] = [
	...BATH_HEAD,
	// コラボの 企画（湯気で だれが だれだか わからない。名無しの 札で 出る。司会は ゼロ）
	{ who: "zero", text: "企画を　どうぞ。\n……どなたか、わかりませんが" },
	{
		who: null,
		text: "企画。……湯船を、もっと\nひろく　する",
		nanashi: "湯気の　中の　配信者",
	},
	{
		who: null,
		text: "企画。……風呂上がりの　牛乳、\nタダに　する",
		nanashi: "湯気の　中の　配信者",
	},
	// やきうは 視聴者なので 企画は 出さず、毎回 同じ コメント（転・頂点の 前ぶれ）
	{ who: null, text: "コメント欄に、1行。\n「見とるで」" },
	{
		who: "zero",
		text: "……初配信の　ときと、\n1字も　ちがいません。数えました",
		emote: "?",
	},
	{ who: "nanj", text: "……ええ　コメントは、\n変えへんのや", emote: "汗" },
	{
		who: null,
		text: "吾輩の　企画……名前を、\nおぼえて　ほしいンゴ",
		kiriko: "voice",
	},
	{ who: null, text: "……で、あんた　だれ？", nanashi: "湯気の　中の　配信者" },
	{
		who: null,
		text: "そのうち、湯の　温度で　もめはじめた。\n41℃派と、42℃派。",
	},
	{
		who: null,
		text: "追いだきの　ボタンが、\n連打された。",
		se: "pushButton",
		seRepeat: 6,
		seGap: 120,
	},
	// 規模が ふくらむ（銭湯の 外まで）。次の 窓で のぼせて 浮いて、話は 湯船に もどる
	{
		who: null,
		text: "源泉が　噴きあがった。\n湯けむりで、町まで　見えなくなった。",
	},
	{
		who: null,
		text: "……1時間後。配信者は　みんな\nのぼせて、浮いていた。",
		se: "chiin",
	},
	// 切り抜き職人（第二話の 小さな 問いの 答え。STORY.md §5）
	{
		who: null,
		text: "湯船の　すみで、ぷゆゆが\n切り抜きを　せっせと　作っていた。",
		se: "pencil",
	},
	{
		who: null,
		text: "ぷゆゆ、たけのこ　すき……\nおうえん　したかったゆ🥺",
		mob: "puyu",
	},
	{
		who: "roze",
		text: "……応援が、いちばん\n足を　ひっぱってるアル",
		emote: "汗",
	},
	// 夜の 湯船（転の 前ぶれ。見られる ことの 重さ）
	{
		who: null,
		text: "夜。湯船に、やきうが　ひとり\n残っていた。",
		about: "nanj",
		instead: { who: null, text: "夜。町は　しずかだった。" },
	},
	{ who: "nanj", text: "……名無しはな、\n見とる　だけや。それで　ええんや" },
	{
		who: null,
		text: "……やきうは、なんで\n配信　せえへんンゴ？",
		kiriko: "voice",
	},
	{ who: "nanj", text: "……見られる　ほうは、\nしんどいで", emote: "…" },
	{ who: "feris", text: "……伸びるって、たのしい\nだけじゃ　ないよ〜" },
	{ who: null, text: "やきうは、湯に　顔まで　しずんだ。", about: "nanj" },
];

/** 2回目からの コラボの 札。 */
export const ENDING_AGAIN: StoryPage[] = BATH_HEAD;
