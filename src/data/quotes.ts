// ダンジョンの外のセリフ。話すのは 外で待っている仲間だけ（キリコが しゃべるのは 村の 雑談と 喫茶だけ。data/mobs.ts・cafe.ts）。
// - 起動の札・村：前の冒険の結果に、仲間のだれかが ひとこと（pickQuote）。
// - はじめて降りる前の ナレーション（INTRO）と、長湯スレを持ち帰ったあと（ENDING）。
// 1行は全角22字・2行まで。説明せず、行間を読ませる（rpg README「セリフの書き方」）。
// 名前・色は rpg の cast.ts と同じ（シヨ・ゼロは rpg に いないので ここで 決めた 色）。

import { DUNGEONS } from "../core/data/dungeons";

export type Speaker = "roze" | "shiyo" | "feris" | "zero" | "nanj";

export const SPEAKERS: Record<Speaker, { name: string; color: string }> = {
	roze: { name: "ロゼ", color: "#ff6f91" },
	shiyo: { name: "シヨ", color: "#e8483f" },
	feris: { name: "フェリス", color: "#ffd166" },
	zero: { name: "ゼロ", color: "#5cc8f0" },
	// やきう（ワイ）。呼び名は みんな「やきう」、フェリスだけ「やきうくん」
	nanj: { name: "やきう", color: "#f5d142" },
};

export type Quote = { who: Speaker; text: string };

/**
 * キリコの ことば（口数の 少ない 主人公。語りでは しゃべらず、心の 中だけ 出す。物語の 理由は 作らない）。
 * - think … 独白。（　）で かこんで 出す。村の だれにも 聞こえない（仲間は 返事を しない）。声なし。
 * - voice … 声。村の 雑談と 喫茶（data/mobs.ts・cafeMobs.ts の k、cafe.ts の v）でだけ 使う。読み上げは rpg と 同じ uc。
 * 決まり（STORY.md）：見た物・聞いた物だけ。気持ちに 名前を つけない。ダンジョンの 中では 出さない。
 * 帰りの 語りで 1回 1行まで、喫茶は 1つの 話に 0〜1行。
 */
export type KirikoMode = "think" | "voice";

/**
 * 語りの 1ページ（who が null なら ナレーション。kiriko が あれば キリコの 独白）。
 * 話す 人か about の 人が 村に いない（出ていった やきう。data/story.ts の awayFriends）ときは
 * instead に かえる（無ければ その ページは 出さない）。
 */
export type StoryPage = {
	who: Speaker | null;
	text: string;
	kiriko?: KirikoMode;
	/** 地の文に 出てくる 仲間。 */
	about?: Speaker;
	instead?: StoryPage;
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

const q = (who: Speaker, text: string): Quote => ({ who, text });

// ───────────────── はじめて（まだ降りていない） ─────────────────
const FIRST: readonly Quote[] = [
	q("nanj", "ひとりで　行くんか。\nほな、上で　保守しとくわ"),
	q("roze", "落ちた子が　どこへ　行くのか、\nわたしも　知らないアル"),
	q("feris", "いってらっしゃ〜い。\n落ちても、私が　ageるからね〜"),
	q("shiyo", "あなた、ひとりで　行くの？\n……生きてこそだ。忘れないで"),
	q("zero", "おかえりの　練習、100回　しました。\n……あ、まだ　出発前でしたね"),
];

// ───────────────── 深さで（たおれた階） ─────────────────
/** 板の 3割まで。 */
const SHALLOW: readonly Quote[] = [
	q("nanj", "はっや。ナイター、\nまだ　1回の　表やで"),
	q("nanj", "草。……いや、笑ってへんで。\n笑ってへんけど、草"),
	q("feris", "もう　もどってきた〜？\nお茶、まだ　あったかいよ〜"),
	q("roze", "入口の　あたりは　dat落ちの霊が\n多いアル。……知り合いアル"),
	q("shiyo", "もう　帰ってきたの？\n……パン、まだ　焼きたてよ"),
	q("zero", "おかえりなさい！　ハグの　準備が\n……あ、いらない。了解です"),
];

/** 板の 7割まで。 */
const MID: readonly Quote[] = [
	q("roze", "その　あたりは　風が　吹くアル。\n……カツラ、おさえるアル"),
	q("nanj", "おかえり。ナイターは\nいま　5回の　裏や"),
	q("feris", "まんなかって、いちばん上？\nいちばん下？　……どっちでもないか〜"),
	q("feris", "そのへん、自演くん　いるよね〜。\n……私の　別アカじゃ　ないよ〜"),
	q("shiyo", "ふんっ。まあまあ　じゃない。\n……ほめてないわよ、あたすは"),
	q("zero", "まんなかまで　行ったんですね。\nサブ機たちと　拍手　しました"),
];

/** 板の 奥（7割から）。下りの 板。 */
const DEEP: readonly Quote[] = [
	q("shiyo", "そんな　底まで　行って……。\nあなた、ほんとに　ばかなんだから"),
	q("shiyo", "……あと　少しだった、なんて\nあたすは　言わないわよ"),
	q("nanj", "9回の　裏まで　来とったで。\n……延長戦、あるやろ？"),
	q("roze", "そんな　深くまで……。\n麻婆豆腐、食べながら　聞くアル"),
	q("feris", "そんな　下まで〜？\n私、飛んでも　届かないよ〜"),
	q("zero", "そんな　深くの　ログ、\nゼロ、はじめて　見ました！"),
];

/** 板の 奥（7割から）。上りの 板（塔・やぐら・山）。 */
const HIGH: readonly Quote[] = [
	q("shiyo", "そんな　上まで　行って……。\nあなた、ほんとに　ばかなんだから"),
	q("shiyo", "……あと　少しだった、なんて\nあたすは　言わないわよ"),
	q("nanj", "9回の　裏まで　来とったで。\n……延長戦、あるやろ？"),
	q("roze", "そんな　高くまで……。\n麻婆豆腐、食べながら　聞くアル"),
	q("feris", "そんな　上まで〜？\n私なら、飛んで　届くかな〜"),
	q("zero", "そんな　高くの　ログ、\nゼロ、はじめて　見ました！"),
];

// ───────────────── 次スレ（たおれても 終わりじゃない） ─────────────────
/** たおれて もどったとき ときどき（スレは 落ちても 次スレが 立つ）。 */
const NEXT_THREAD: readonly Quote[] = [
	q("nanj", "落ちたか。……ほな、次スレや。\n>>1は　また　キリコな"),
	q("feris", "スレは　落ちても、\n次スレは　立つよ〜"),
	q("roze", "落ちたら　立てるのが　常識アル。\n……次スレ、アル"),
	q("shiyo", "1000まで　行かなくても、\n……次は、あるわよ"),
	q("zero", "前スレの　ログ、保存しました。\n……次スレも、見ています"),
];

// ───────────────── たおれ方で ─────────────────
/** おなかが　すいて。 */
const STARVE: readonly Quote[] = [
	q("shiyo", "パン、持たせたでしょ！\n……食べなさいよ、ばか"),
	q("nanj", "パン松に　言うたろか。\n「メシを　食え」って"),
	q("feris", "おなか、すいたでしょ〜。\nはい、あ〜ん"),
	q("roze", "麻婆豆腐、作っておいたアル。\n……34キロ、もどすアル"),
	q("zero", "おなかの　すく　仕組み、\nわかったら　代わりに　すきます"),
];

/** 毒草を　飲んで。 */
const POISON: readonly Quote[] = [
	q("roze", "……草アル？\nどっちの　草アル"),
	q("nanj", "草を　飲んだんか。\n……いや、その草やないねん"),
	q(
		"shiyo",
		"知らない　草を　口に　入れない！\n……メイドの　言うことは　聞きなさい",
	),
	q("feris", "私、鳥だから　草には\nくわしいよ〜。……たぶん〜"),
	q("zero", "毒草の　見分け方、サブ機と\n3時間　会議しました。……結論、なし"),
];

/** 地雷・炎上案件の　爆発。 */
const BLAST: readonly Quote[] = [
	q("nanj", "ドカン、って　上まで\n聞こえたわ。……草は　生えんかった"),
	q("feris", "ドーンって　した〜。\n私の　くしゃみより　大きかった〜"),
	q("shiyo", "上まで　ドカンって　聞こえたわよ。\n……眼鏡、ずれたじゃない"),
	q("roze", "上まで　けむりが　来たアル。\nカツラ、洗うアル"),
	q("zero", "爆発の　音、録音しておきました！\n……いらなかった、ですか"),
];

/** ぷゆゆ（メタルは べつ。前の版の 記録の「とうすこ」も）。 */
const PUYU: readonly Quote[] = [
	q("nanj", "ぷゆゆに　負けたんか。\n……村の　あいつには、だまっとくわ"),
	q("roze", "あの子たち、泣きそうな　顔で\n来るアル。……ずるいアル"),
	q("feris", "ぷゆゆに〜？\nあの子、よちよちだよ〜？"),
	q(
		"shiyo",
		"……あの　上目づかいに　負けたの？\nあたすなら、ひと睨みで　勝つわ",
	),
	q("zero", "ぷゆゆさんと　なかよく　なる方法、\nゼロにも　教えてください"),
];

/** 寝落ち民。 */
const NEOCHI: readonly Quote[] = [
	q("nanj", "寝落ちは　あかん。\n……ワイも　実況中に　よく　やるけど"),
	q("feris", "ねむく　なっちゃった〜？\n私の　羽、まくらに　なるよ〜"),
	q("shiyo", "寝るなら　ベッドで　寝なさい。\n……シーツは、替えてあるわよ"),
	q("roze", "ねてる子は　起こさないアル。\n……あの子は　べつアル"),
	q("zero", "眠るって、どんな　感じですか。\n……ゼロ、まだ　知らないんです"),
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
	q("shiyo", "育ててたのに、ぜんぶ　パー？\n……泣いてないわよ。ほこりよ"),
	q("feris", "レベル、とられちゃった〜？\n私の　お勉強、わけてあげる〜"),
	q("zero", "レベルの　リセット……。\nゼロも　メンテの　たびに　少し　忘れます"),
];

/** 転載ガモ。 */
const TENSAI: readonly Quote[] = [
	q("nanj", "転載は　あかんで。ほんまに。\n……ワイの　レスも　まとめられたわ"),
	q("feris", "私の　絵も、まとめられたこと\nあるよ〜。……ふぇ……ふぇ……"),
	q(
		"shiyo",
		"持ち物、ぜんぶ　持ってかれたの？\n……倉庫に　あずけて　おきなさい",
	),
	q("zero", "転載された　ログは、ゼロが\nぜんぶ　元スレに　つなぎ直します！"),
];

/** ワイ バーン。 */
const WYVERN: readonly Quote[] = [
	q("nanj", "ワイちゃうで。\n……ワイちゃうからな"),
	q("shiyo", "ドラゴン？　あたすの　声の　ほうが\n……ずっと　大きいわよ"),
	q("feris", "炎〜？　私の　タンクトップと\nおそろいだね〜"),
];

/** かまってちゃん（前の名前は 過疎）。 */
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
	q("nanj", "長湯スレ、持って帰ったんか！\n……ワイが　名付けた子や（自称）"),
	q("roze", "……おかえりアル。\nそれだけアル。常識アル"),
	q("feris", "レコード、いっしょに　きこ〜。\nくしゃみ、がまんするから〜"),
	q("shiyo", "……お、お帰りなさいませ。\nいまのは　練習よ。練習！"),
	q("zero", "スレ、伸びました！　ゼロ、拍手の\n音量を　最大に　しました！"),
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
	q("shiyo", "何度　落ちても　もぐるのね。\n……そういうの、きらいじゃない"),
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
	/** 村に いない 仲間（出ていった やきう。data/story.ts の awayFriends）。その人の セリフは 引かない。 */
	away: readonly Speaker[] = [],
): Quote | null => {
	const pick = (pool: readonly Quote[], salt: number) =>
		at(
			pool.filter(
				(x) =>
					(!who || x.who === who) &&
					!away.includes(x.who) &&
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
	// たおれて もどった ときは ときどき「次スレ」の ひとこと
	if (last.kind === "dead" && mix(seed, 9) % 4 === 0) {
		const next = pick(NEXT_THREAD, 10);
		if (next) return next;
	}
	return pick(depthPool(last), 8);
};

// ───────────────── はじめて降りる前 ─────────────────
export const INTRO: string[] = [
	"風呂板の　過去ログ。\nおんJを　出た　民が　ひらいた　湯。",
	"だれも　読まなくなった　スレが、\n湯の　底で　まだ、ぬくもっている。",
	"源泉の　底には、よく　伸びた\n長湯スレが　沈んでいるという。",
	"キリコは　蓄音機の　ハンドルを　まわした。",
	"……ひとりで、降りる。",
];

// ───────────────── 長湯スレを　持ち帰ったあと ─────────────────
export const ENDING: StoryPage[] = [
	{
		who: null,
		text: "村に　帰りつくと、\n見なれた　山吹色が　立っていた。",
		about: "nanj",
		instead: {
			who: null,
			text: "村に　帰りつくと、\nみんなが　入口で　待っていた。",
		},
	},
	{ who: "nanj", text: "おっそ。……何日　待たせんねん" },
	// 迎えの 掛け合いは 2〜3人まで（だれが だれか 知らない 人が 流し読み しないように）
	{ who: "shiyo", text: "……待ってないわよ。\nお茶が、さめた　だけ" },
	{
		who: null,
		text: "キリコは　長湯スレを　蓄音機に　かけた。\n湯気の　むこうで、笑い声が　する。",
	},
	{ who: "nanj", text: "……ええ　スレや。\nこれ　貼ったら、人、来るで" },
	{
		who: "zero",
		text: "スレ、500を　こえました！\n……知らない　人が、書きこんでます",
	},
	{ who: null, text: "……知らない　人ンゴ", kiriko: "think" },
];
