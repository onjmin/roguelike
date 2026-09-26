// ダンジョンの外のセリフ。話すのは 外で待っている仲間だけ（キリコはしゃべらない）。
// - 起動の札・村：前の冒険の結果に、仲間のだれかが ひとこと（pickQuote）。
// - はじめて降りる前の ナレーション（INTRO）と、原盤を持ち帰ったあと（ENDING）。
// 1行は全角22字・2行まで。説明せず、行間を読ませる（rpg README「セリフの書き方」）。
// 名前・色は rpg の cast.ts と同じ（シヨ・ゼロは rpg に いないので ここで 決めた 色）。

export type Speaker = "roze" | "shiyo" | "feris" | "zero" | "nanj";

export const SPEAKERS: Record<Speaker, { name: string; color: string }> = {
	roze: { name: "ロゼ", color: "#ff6f91" },
	shiyo: { name: "シヨ", color: "#e8483f" },
	feris: { name: "フェリス", color: "#ffd166" },
	zero: { name: "ゼロ", color: "#5cc8f0" },
	nanj: { name: "おんJ民", color: "#f5d142" },
};

export type Quote = { who: Speaker; text: string };

/** 前の冒険の結果（null は まだ一度も降りていない）。 */
export type QuoteContext = {
	kind: "dead" | "clear" | "escape";
	depth: number;
	cause: string;
	runs: number;
	clears: number;
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
/** B1〜B5。 */
const SHALLOW: readonly Quote[] = [
	q("nanj", "はっや。ナイター、\nまだ　1回の　表やで"),
	q("nanj", "草。……いや、笑ってへんで。\n笑ってへんけど、草"),
	q("feris", "もう　もどってきた〜？\nお茶、まだ　あったかいよ〜"),
	q("roze", "入口の　あたりは　dat落ちの霊が\n多いアル。……知り合いアル"),
	q("shiyo", "もう　帰ってきたの？\n……パン、まだ　焼きたてよ"),
	q("zero", "おかえりなさい！　ハグの　準備が\n……あ、いらない。了解です"),
];

/** B6〜B13。 */
const MID: readonly Quote[] = [
	q("roze", "その　あたりは　風が　吹くアル。\n……カツラ、おさえるアル"),
	q("nanj", "おかえり。ナイターは\nいま　5回の　裏や"),
	q("feris", "まんなかって、いちばん上？\nいちばん下？　……どっちでもないか〜"),
	q("feris", "そのへん、自演くん　いるよね〜。\n……私の　別アカじゃ　ないよ〜"),
	q("shiyo", "ふんっ。まあまあ　じゃない。\n……ほめてないわよ、あたすは"),
	q("zero", "まんなかまで　行ったんですね。\nサブ機たちと　拍手　しました"),
];

/** B14〜B20。 */
const DEEP: readonly Quote[] = [
	q("shiyo", "そんな　底まで　行って……。\nあなた、ほんとに　ばかなんだから"),
	q("shiyo", "……あと　少しだった、なんて\nあたすは　言わないわよ"),
	q("nanj", "9回の　裏まで　来とったで。\n……延長戦、あるやろ？"),
	q("roze", "そんな　深くまで……。\n麻婆豆腐、食べながら　聞くアル"),
	q("feris", "そんな　下まで〜？\n私、飛んでも　届かないよ〜"),
	q("zero", "そんな　深くの　ログ、\nゼロ、はじめて　見ました！"),
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
	q("nanj", "原盤、持って帰ったんか！\n……ワイが　名付けた子や（自称）"),
	q("roze", "……おかえりアル。\nそれだけアル。常識アル"),
	q("feris", "レコード、いっしょに　きこ〜。\nくしゃみ、がまんするから〜"),
	q("shiyo", "……お、お帰りなさいませ。\nいまのは　練習よ。練習！"),
	q("zero", "原盤！　ゼロ、拍手の　音量を\n最大に　しました！　……うるさい？"),
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

const depthPool = (depth: number): readonly Quote[] =>
	depth <= 5 ? SHALLOW : depth <= 13 ? MID : DEEP;

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
): Quote | null => {
	const pick = (pool: readonly Quote[], salt: number) =>
		at(who ? pool.filter((x) => x.who === who) : pool, seed, salt);
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
	return pick(depthPool(last.depth), 8);
};

// ───────────────── はじめて降りる前 ─────────────────
export const INTRO: string[] = [
	"過去ログの底。\n落ちた　スレが、いちばん下に　つもる。",
	"だれも　読まなくなった　レスが、\nそこで　まだ、ちいさく　鳴っている。",
	"いちばん底には、一枚の　レコードが\nあるという。まだ、だれも　聞いていない。",
	"キリコは　蓄音機の　ハンドルを　まわした。",
	"……ひとりで、降りる。",
];

// ───────────────── 原盤を　持ち帰ったあと ─────────────────
export const ENDING: { who: Speaker | null; text: string }[] = [
	{
		who: null,
		text: "階段を　のぼりきると、\n見なれた　山吹色が　立っていた。",
	},
	{ who: "nanj", text: "おっそ。……何日　待たせんねん" },
	{ who: "feris", text: "おかえり〜。くしゃみ、\nずっと　がまんしてたよ〜" },
	{ who: "roze", text: "帰ってくるのは　常識アル。\n……ちょっと、冷えたアル" },
	{ who: "shiyo", text: "……待ってないわよ。\nお茶が、さめた　だけ" },
	{ who: "zero", text: "おかえりなさい！\n……101回目で、やっと　言えました" },
	{ who: null, text: "キリコは　蓄音機に　原盤を　のせた。\n針が、おりる。" },
	{ who: null, text: "ざらざら、と　音が　した。\nその　むこうで――" },
	{ who: null, text: "「あー、あー」" },
	{ who: "nanj", text: "……草。マイクテストかいな" },
	{
		who: null,
		text: "キリコは　蓄音機に　むかって、\n「あー、あー」と　返した。",
	},
	{
		who: "zero",
		text: "……いまの　「あー、あー」、\nゼロの　宝物フォルダに　入れました",
	},
];
