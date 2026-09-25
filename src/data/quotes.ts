// ダンジョンの外のセリフ。話すのは 外で待っている仲間だけ（キリコはしゃべらない）。
// - タイトル画面：前の冒険の結果に、仲間のだれかが ひとこと（pickQuote）。
// - はじめて降りる前の ナレーション（INTRO）と、原盤を持ち帰ったあと（ENDING）。
// 1行は全角22字・2行まで。説明せず、行間を読ませる（rpg README「セリフの書き方」）。
// 名前・色は rpg の cast.ts と同じ。

export type Speaker = "roze" | "teto" | "feris" | "rei" | "nanj";

export const SPEAKERS: Record<Speaker, { name: string; color: string }> = {
	roze: { name: "ロゼ", color: "#ff6f91" },
	teto: { name: "テト", color: "#e2455b" },
	feris: { name: "フェリス", color: "#ffd166" },
	rei: { name: "レイ", color: "#ff8a3d" },
	nanj: { name: "おんJ民", color: "#f5d142" },
};

export type Quote = { who: Speaker; text: string };

/** 前の冒険の結果（null は まだ一度も降りていない）。 */
export type QuoteContext = {
	kind: "dead" | "clear";
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
	q("teto", "べ、別に　心配してない。\n……パン、持ってけ"),
	q("rei", "入場を　記録しました。\n「おかえりなさい」は、用意して　あります"),
];

// ───────────────── 深さで（たおれた階） ─────────────────
/** B1〜B5。 */
const SHALLOW: readonly Quote[] = [
	q("nanj", "はっや。ナイター、\nまだ　1回の　表やで"),
	q("nanj", "草。……いや、笑ってへんで。\n笑ってへんけど、草"),
	q("feris", "もう　もどってきた〜？\nお茶、まだ　あったかいよ〜"),
	q("roze", "入口の　あたりは　ひとだまが\n多いアル。……知り合いアル"),
	q("teto", "……早いな。\nパン、まだ　あたたかいぞ"),
	q("rei", "短い　ログも、ログです。\n……記録しました"),
];

/** B6〜B13。 */
const MID: readonly Quote[] = [
	q("roze", "その　あたりは　風が　吹くアル。\n……カツラ、おさえるアル"),
	q("nanj", "おかえり。ナイターは\nいま　5回の　裏や"),
	q("feris", "まんなかって、いちばん上？\nいちばん下？　……どっちでもないか〜"),
	q("feris", "そのへん、キメラが　いるよね〜。\nテトちゃんじゃ　ないよ〜"),
	q("teto", "ふん。まあまあだ。\n……べ、別に　ほめてない"),
	q("rei", "中ほどの　ログを　受信。\n……解析は、あとで　します"),
];

/** B14〜B20。 */
const DEEP: readonly Quote[] = [
	q("teto", "そこまで　行って、もどってきた。\n……君は　じつに　馬鹿だな"),
	q("teto", "……あと　少しだった、とは\n言わない。言わないぞ"),
	q("nanj", "9回の　裏まで　来とったで。\n……延長戦、あるやろ？"),
	q("roze", "そんな　深くまで……。\n麻婆豆腐、食べながら　聞くアル"),
	q("feris", "そんな　下まで〜？\n私、飛んでも　届かないよ〜"),
	q("rei", "その　深さの　ログは、\n当機にも　ありません"),
];

// ───────────────── たおれ方で ─────────────────
/** おなかが　すいて。 */
const STARVE: readonly Quote[] = [
	q("teto", "……パン、食えって　言っただろ。\nべ、別に　怒ってない"),
	q("nanj", "パン松に　言うたろか。\n「パンを　食え」って"),
	q("feris", "おなか、すいたでしょ〜。\nはい、あ〜ん"),
	q("roze", "麻婆豆腐、作っておいたアル。\n……34キロ、もどすアル"),
	q("rei", "燃料切れを　検知。\n……当機は　電気ですが、心配は　します"),
];

/** 毒草を　飲んで。 */
const POISON: readonly Quote[] = [
	q("roze", "……草アル？\nどっちの　草アル"),
	q("nanj", "草を　飲んだんか。\n……いや、その草やないねん"),
	q("teto", "知らない　草を　口に　入れるな。\n……ボクは　パンしか　食わない"),
	q("feris", "私、鳥だから　草には\nくわしいよ〜。……たぶん〜"),
	q("rei", "摂取ログを　解析……。\n否定。それは、草でした"),
];

/** 地雷・ばくだんの　爆発。 */
const BLAST: readonly Quote[] = [
	q("nanj", "ドカン、って　上まで\n聞こえたわ。……草は　生えんかった"),
	q("feris", "ドーンって　した〜。\n私の　くしゃみより　大きかった〜"),
	q("teto", "……ふん。ボクの　ドリルより\n派手だったな"),
	q("roze", "上まで　けむりが　来たアル。\nカツラ、洗うアル"),
	q("rei", "振動を　検知。\n……冷却水、こぼれました"),
];

/** とうすこ（メタルは べつ）。 */
const TOUSUKO: readonly Quote[] = [
	q("nanj", "豆腐に　負けたんか。\n……いや、ええ豆腐やった"),
	q("roze", "とうすこは　麻婆豆腐に\nすると　おいしいアル"),
];

/** 寝落ち民。 */
const NEOCHI: readonly Quote[] = [
	q("nanj", "寝落ちは　あかん。\n……ワイも　実況中に　よく　やるけど"),
	q("feris", "ねむく　なっちゃった〜？\n私の　羽、まくらに　なるよ〜"),
	q("teto", "……寝るなら　上で　寝ろ。\nべ、別に　ひざは　貸さない"),
	q("roze", "ねてる子は　起こさないアル。\n……あの子は　べつアル"),
	q("rei", "スリープモードを　検知。\n……当機のとは、ちがう　やつです"),
];

/** コピペ。 */
const COPIPE: readonly Quote[] = [
	q("nanj", "コピペに　やられたんか。\n……あれ、元ネタ　ワイやで（自称）"),
	q("roze", "ふえる　やつは　いっぺんに\nたたくアル。常識アル"),
	q("feris", "コピペって、何回　見ても\nちょっと　わらっちゃうよね〜"),
	q("teto", "同じ　ものが　ふえていく。\n……ボクの　声と、いっしょだな"),
	q("rei", "同じ　ログを　いくつも　検出。\n……1つに　まとめておきます"),
];

/** 忍法帖エラー。 */
const NINPO: readonly Quote[] = [
	q("nanj", "忍法帖エラーかいな。\nワイも　何回　書き直したことか"),
	q("teto", "……せっかく　育ってたのに、な。\nべ、別に　くやしくない"),
	q("feris", "レベル、とられちゃった〜？\n私の　お勉強、わけてあげる〜"),
	q("rei", "忍法帖の　リセットを　確認。\n……あれは、当機でも　なおせません"),
];

/** 転載ガモ。 */
const TENSAI: readonly Quote[] = [
	q("nanj", "転載は　あかんで。ほんまに。\n……ワイの　レスも　まとめられたわ"),
	q("feris", "私の　絵も、まとめられたこと\nあるよ〜。……ふぇ……ふぇ……"),
	q("teto", "持ち物、ぜんぶか。\n……パンは？　パンは　ぶじか？"),
	q("rei", "無断転載を　検出。\n……通報、しておきました"),
];

/** ワイ バーン。 */
const WYVERN: readonly Quote[] = [
	q("nanj", "ワイちゃうで。\n……ワイちゃうからな"),
	q("teto", "ドラゴンか。……ボクの　歌に\nそんなのが　いたな"),
	q("feris", "炎〜？　私の　タンクトップと\nおそろいだね〜"),
];

/** 過疎。 */
const KASO: readonly Quote[] = [
	q("nanj", "過疎に　つかまったんか。\n……ワイが　保守しとったらなあ"),
	q("roze", "過疎は　わたしも　こわいアル。\n……ちょっとだけアル"),
];

/** ゾンJ民。 */
const ZONJ: readonly Quote[] = [
	q("nanj", "ゾンJ民、ワイの　知り合いかも\nしれん。……聞かんといて"),
	q("rei", "「ほ…しゅ…」を　検出。\n……返事は、しておきました"),
];

/** 文字化け。 */
const MOJIBAKE: readonly Quote[] = [
	q("rei", "文字化けを　検出。\n……当機の　ログにも、たまに　あります"),
	q("feris", "文字化けって、たまに\nちょっと　かわいく　見えない〜？"),
];

// ───────────────── 持ち帰ったあと ─────────────────
const CLEAR: readonly Quote[] = [
	q("nanj", "原盤、持って帰ったんか！\n……ワイが　名付けた子や（自称）"),
	q("roze", "……おかえりアル。\nそれだけアル。常識アル"),
	q("feris", "レコード、いっしょに　きこ〜。\nくしゃみ、がまんするから〜"),
	q("teto", "……で、次は　なに　するのさ。\nべ、別に　ひまじゃない"),
	q("rei", "原盤の　持ち帰りを　確認。\n……当機も、聞いて　いいですか"),
];

/** 2回目からの　持ち帰り。 */
const CLEAR_AGAIN: readonly Quote[] = [
	q("nanj", "また　行ってきたんか。\n……もう　常連やな"),
	q("teto", "また　行くのか。ボクの\nDVDより　延長しすぎだぞ"),
	q("roze", "何回でも　いいアル。\nわたしは　ここで　麻婆　食べてるアル"),
	q("feris", "また　もぐるの〜？\n……いってらっしゃ〜い"),
];

// ───────────────── 何回も（10回目から） ─────────────────
const MANY: readonly Quote[] = [
	q("nanj", "スレなら　もう　Partいくつや。\n……数えるの　やめたわ"),
	q("teto", "……レンタルDVDの　延長より\nしつこいな。……わるくない"),
	q("feris", "何回でも　いいよ〜。\n私、何回でも　ageるから〜"),
	q("roze", "こんなに　通うなら、底に\n麻婆豆腐の　屋台を　出すアル"),
	q("rei", "ログが　長くなってきました。\n……読むのは、好きです"),
];

// ───────────────── 選び方 ─────────────────
/** たおれ方（cause）に合う たまり。上から順に見る。 */
const CAUSE_POOLS: readonly {
	match: (cause: string) => boolean;
	pool: readonly Quote[];
}[] = [
	{ match: (c) => c.includes("おなかが"), pool: STARVE },
	{ match: (c) => c.includes("毒草"), pool: POISON },
	{ match: (c) => c.includes("爆発") || c.includes("地雷"), pool: BLAST },
	{ match: (c) => c.includes("寝落ち民"), pool: NEOCHI },
	{ match: (c) => c.includes("コピペ"), pool: COPIPE },
	{ match: (c) => c.includes("忍法帖"), pool: NINPO },
	{ match: (c) => c.includes("転載ガモ"), pool: TENSAI },
	{ match: (c) => c.includes("ワイ バーン"), pool: WYVERN },
	{ match: (c) => c.includes("過疎"), pool: KASO },
	{ match: (c) => c.includes("ゾンJ民"), pool: ZONJ },
	{ match: (c) => c.includes("文字化け"), pool: MOJIBAKE },
	{
		match: (c) => c.includes("とうすこ") && !c.includes("メタル"),
		pool: TOUSUKO,
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
 * タイトル画面の ひとこと。前の冒険の結果から たまりを選び、seed で1つ引く
 * （同じ seed なら 同じセリフ）。null は まだ一度も降りていないとき。
 */
export const pickQuote = (last: QuoteContext, seed: number): Quote | null => {
	if (!last) return at(FIRST, seed, 1);
	if (last.kind === "clear") {
		const again = last.clears >= 2 && mix(seed, 2) % 2 === 0;
		return at(again ? CLEAR_AGAIN : CLEAR, seed, 3);
	}
	if (last.runs >= 10 && mix(seed, 4) % 4 === 0) return at(MANY, seed, 5);
	const cause = CAUSE_POOLS.find((c) => c.match(last.cause))?.pool;
	if (cause && mix(seed, 6) % 3 !== 0) return at(cause, seed, 7);
	return at(depthPool(last.depth), seed, 8);
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
	{ who: "teto", text: "べ、別に　待ってない。\n……パンが、かたくなっただけだ" },
	{ who: "rei", text: "おかえりなさい" },
	{ who: null, text: "キリコは　蓄音機に　原盤を　のせた。\n針が、おりる。" },
	{ who: null, text: "ざらざら、と　音が　した。\nその　むこうで――" },
	{ who: null, text: "「あー、あー」" },
	{ who: "nanj", text: "……草。マイクテストかいな" },
	{
		who: null,
		text: "キリコは　蓄音機に　むかって、\n「あー、あー」と　返した。",
	},
	{ who: "rei", text: "……記録、しました" },
];
