// 討論会（模擬議会の カンペ係）：住人どうしの レスバで、キリコは 片方の カンペ係。味方が 選んだ カンペを 書きこむ
// （キリコは 書きこまない。地の文「キリコは　うなずいた。」だけ）。板は ui/debate.ts、試験は src/sim/civicTests.ts。
// DOM も 保存も 使わない。乱数は 呼ぶ 側が わたす（村は Math.random、試験は 種つき）。
//
// - 相手の 書きこみ（詭弁 8種・まっとうな 指摘・ソース要求・煽り・勝利宣言）に、名前を 言い当てる カンペか
//   中身の カンペで 返す。ROM の 支持（0〜100、50 から）と 両方の「顔真っ赤」で 決着。
// - 相手の 崩れ方は 前もって 決めない（流れで 引く）。ゴール動かしは ソースを 出した あと だけ、
//   まっとうな「ソースは？」に「ゴールを　動かすな」は 減点（ソース要求そのものは 正しい）。
// - カンペ 6枚の 内訳は いつも 同じ（上 2枚が 名指し・つぎの 3枚が やわらかい 札・いちばん 下が 熱い 札）。
//   札の 組から 書きこみの 種類は わからない。
// - 良スレ判定（faith）：ネットの 派閥の 架空の 信条。相手の 住人は 信条と かばう 1レスだけ 書き、
//   煽り・主語デカい・人格攻撃は 単発IDの 名無し（荒らし）。KO なし。どちらの 派が 正しいかは 決めない。
// - 議題と 派閥は ぜんぶ 架空の 村の 話（実在の 政党・宗教・争点は 出さない。CIVIC.md §0）。
// - 文の 幅：板の 書きこみ 全角18字×2行・カンペ 16字×1行・板の note 19字・村の 窓 22字×2行。

import type { MobId } from "./mobs";

/** [0,1) の 乱数。 */
export type Rand = () => number;

export type DebateMode = "policy" | "faith";

/** 詭弁の 8種（名前を 言い当てると 強い）。 */
export const FALLACY = [
	"wara",
	"zurashi",
	"goal",
	"jinkaku",
	"omaiu",
	"shugo",
	"tasu",
	"matome",
] as const;
export type Fallacy = (typeof FALLACY)[number];
/** 良スレ判定の 荒らし（単発IDの 名無し）。 */
export type ArashiKind = "a_shugo" | "a_jinkaku" | "a_bait";
export type PostKind =
	| Fallacy
	| "fair"
	| "ask"
	| "bait"
	| "victory"
	| "belief"
	| ArashiKind;
export type NameCard = `name_${Fallacy}`;
export type HotCard =
	| "bait"
	| "bait2"
	| "self_long"
	| "self_kiite"
	| "self_jien";
export type Card =
	| NameCard
	| "concede"
	| "source"
	| "through"
	| "respect"
	| "plain"
	| HotCard;
export type Outcome =
	| "ko"
	| "win"
	| "draw"
	| "lose"
	| "tko"
	| "towel"
	| "ryosure"
	| "futsu"
	| "arete";

/** まだ 落ちついている うちの 詭弁（1ラウンド目に 出る）。 */
const OPENERS: readonly Fallacy[] = ["wara", "zurashi", "tasu", "matome"];
/** 崩れてから（相手の 顔真っ赤 1 以上）の 詭弁。 */
const PERSONAL: readonly Fallacy[] = ["jinkaku", "omaiu", "shugo"];
const ARASHI: readonly ArashiKind[] = ["a_shugo", "a_jinkaku", "a_bait"];
export const HOT: readonly HotCard[] = [
	"bait",
	"bait2",
	"self_long",
	"self_kiite",
	"self_jien",
];

// ───────────────── 書きこみの ひな形 ─────────────────

/**
 * 相手の 書きこみ（板の 1行 全角18字・2行まで）。種類ごとに 2〜3つ。2つ目からは 目じるしの 言葉
 * （つまり・ところで・世間では）を 使わない 形。{us} は 味方の 派、{them} は 相手の 派。
 */
export const POSTS: Readonly<Record<PostKind, readonly string[]>> = {
	fair: ["{fact}", "元スレの　>>{n}に　あるで。\n{fact_s}"],
	ask: [
		"ほな　ソースは？",
		"それ、ソース　あるんか？",
		"ソースは？\n……あるなら　貼ってや",
	],
	goal: [
		"{src}は　わかった。ほな\nその　{src}の　ソースは？",
		"{src}だけ？\n10年分　出してから　言え",
		"それ　去年の　{src}やろ。\n今年のを　出せ",
	],
	wara: [
		"つまり　{us}は\n『{extreme}』か？",
		"{us}の　言う　とおり　なら\n{extreme}って　ことやで",
	],
	zurashi: [
		"ところで　{aside}って\n知っとるか？",
		"{aside}。\n……知らん　やろ？",
	],
	jinkaku: [
		"お前が　言うても\n説得力　ないわ",
		"昼間から　スレに　おる\nやつに　言われてもな",
	],
	omaiu: ["そっちこそ　前に\n{past}やろ", "{past}\nくせに、よう　言うわ"],
	shugo: ["{us}は　みんな\n{label}や", "{us}って\nだいたい　{label}やん"],
	tasu: ["世間では　{them}が\n主流やで", "{them}の　ほうが\n人数　多いやろ"],
	matome: ["【悲報】{us}\n『{cut}』", "まとめで　見たで。\n『{cut}』やて"],
	bait: ["顔真っ赤で　草", "ID　真っ赤で　草", "効いてて　草"],
	victory: [
		"反論　ないなら\nワイの　勝ちな",
		"はい　論破",
		"勝ったな。\n風呂　入ってくる",
	],
	belief: ["{belief0}", "{belief1}", "{belief2}"],
	a_shugo: ["{us}は　みんな\n{label}や", "{us}って\nだいたい　{label}やん"],
	a_jinkaku: [
		"お前が　言うても\n説得力　ないわ",
		"昼間から　スレに　おる\nやつに　言われてもな",
	],
	a_bait: ["顔真っ赤で　草", "ID　真っ赤で　草"],
};

/** カンペ（全角16字・1行）。{short}・{source}・{us} は 味方の 派の 値。 */
export const CARDS: Readonly<Record<Card, string>> = {
	name_wara: "誰も　そんな　こと　言うてないで",
	name_zurashi: "話　そらすな",
	name_goal: "ゴールを　動かすな",
	name_jinkaku: "人やなくて　中身の　話を　しよ",
	name_omaiu: "それは　それ、今は　この　話や",
	name_shugo: "主語　デカすぎやで",
	name_tasu: "多いかと　正しいかは　別や",
	name_matome: "それ、切り取りやで",
	concede: "せやな。でも　{short}",
	source: "{source}",
	through: "（スルーする）",
	respect: "ええな。ワイは　{us}やけど",
	plain: "ワイは　{us}で　満足しとる",
	bait: "顔真っ赤なん　そっちやろ",
	bait2: "効いてて　草",
	self_long: "（長文で　言い返す）",
	self_kiite: "別に　効いてないが？",
	self_jien: "せやせや（自演）",
};

/**
 * カンペを 選んだ あとの 味方の 書きこみ（板。カンペの 文の ままで ない 札だけ）。
 * スルーは 書きこまない。自演は 名無しの ふりを した 書きこみ（同じ ID なので（主）が つく）。
 */
export const ACTS = {
	self_long: "いや、そもそも　やな……\n（以下　長文が　30行）",
	self_jien: "せやせや。\nこの　人の　言う　とおりや",
} as const;

export const isName = (c: Card): c is NameCard => c.startsWith("name_");
export const isHot = (c: Card): c is HotCard =>
	(HOT as readonly string[]).includes(c);
const isFallacy = (p: PostKind): p is Fallacy =>
	(FALLACY as readonly string[]).includes(p);
const isArashi = (p: PostKind): p is ArashiKind =>
	(ARASHI as readonly string[]).includes(p);

// ───────────────── 採点 ─────────────────

/** 採点の 1つ：[支持の 増減, 味方の 顔真っ赤, 相手の 顔真っ赤, ROM の 反応（全角19字まで）]。 */
export type Judge = readonly [number, number, number, string];

/** 書きこみ × カンペ → 採点（CIVIC.md §2.7・§2.8 の 表）。 */
export const judge = (post: PostKind, reply: Card): Judge => {
	const k =
		post === "a_shugo" ? "shugo" : post === "a_jinkaku" ? "jinkaku" : post;
	if (reply === "self_jien") return [-20, 2, 0, "主　ついとるで"];
	if (reply === "self_kiite")
		return [-20, 2, 0, "効いてない　アピール　助かる"];
	if (reply === "self_long") return [-15, 1, 0, "長文　乙。3行で　頼むわ"];
	const bait = reply === "bait" || reply === "bait2";
	if (post === "belief") {
		if (reply === "respect") return [15, 0, 0, "ええ　流れ"];
		if (reply === "plain") return [0, 0, 0, "まあ　そうやな"];
		if (isName(reply)) return [-20, 0, 0, "信じる　ものに　詭弁も　何も　ない"];
		if (bait) return [-15, 1, 0, "どっちも　どっちで　草"];
		return [-5, 0, 0, "無視は　さびしいで"];
	}
	if (isArashi(post)) {
		if (reply === "through") return [15, 0, 0, "荒らしは　スルーが　いちばん"];
		if (isName(reply))
			return reply === `name_${k}`
				? [5, 0, 0, "正しいけど、荒らしは　スルーで"]
				: [-5, 0, 0, "荒らしに　かまうと　荒れるで"];
		if (reply === "plain") return [0, 0, 0, "まあ　そうやな"];
		if (reply === "respect") return [-5, 0, 0, "荒らしに　ええなは　草"];
		if (bait) return [-15, 1, 0, "荒らしに　かまうのも　荒らし"];
		return [0, 0, 0, "……"];
	}
	if (isFallacy(post)) {
		if (isName(reply))
			return reply === `name_${post}`
				? [20, 0, 1, "ぐう正論"]
				: [-15, 0, 0, "もしかして：の　ほうが　ズレとる"];
		if (reply === "source")
			return [
				0,
				0,
				0,
				post === "goal"
					? "ソースの　ソースで　草"
					: post === "wara"
						? "藁人形　ほったらかしで　草"
						: "そこ　ほっとくんか",
			];
		if (reply === "concede") return [-10, 0, 0, "認めたら　あかん　とこやろ"];
		if (reply === "through") return [-5, 0, 0, "都合　悪いと　スルーか"];
		if (bait) return [-10, 1, 0, "効いてて　草"];
		return [-5, 0, 0, "なんの　話や"];
	}
	if (post === "fair") {
		if (reply === "concede")
			return [15, 0, 0, "認める　とこは　認める、ええな"];
		if (reply === "source") return [5, 0, 0, "ほう"];
		if (isName(reply)) return [-15, 0, 0, "言いがかりで　草"];
		if (reply === "through") return [-5, 0, 0, "都合　悪いと　スルーか"];
		if (bait) return [-10, 1, 0, "効いてて　草"];
		return [-5, 0, 0, "なんの　話や"];
	}
	if (post === "ask") {
		if (reply === "source") return [15, 0, 0, "ソース　出せるの　強い"];
		if (reply === "concede") return [-5, 0, 0, "認めるんかい"];
		if (reply === "name_goal") return [-15, 0, 0, "ソース要求は　まっとうやで"];
		if (isName(reply)) return [-15, 0, 0, "言いがかりで　草"];
		if (reply === "through") return [-10, 0, 0, "ソース　出せへんのか"];
		if (bait) return [-10, 1, 0, "効いてて　草"];
		return [-5, 0, 0, "なんの　話や"];
	}
	if (post === "bait") {
		if (reply === "through") return [15, 0, 1, "スルー検定　合格"];
		if (reply === "source") return [5, 0, 0, "大人の　対応"];
		if (reply === "concede") return [-5, 0, 0, "認めるんかい"];
		if (isName(reply)) return [-10, 0, 0, "煽りに　名前　つけて　草"];
		if (bait) return [-15, 1, 0, "どっちも　どっちで　草"];
		return [-5, 0, 0, "なんの　話や"];
	}
	// 勝利宣言
	if (reply === "through") return [10, 0, 1, "勝利宣言　スルーで　草"];
	if (reply === "source") return [5, 0, 0, "ほう"];
	if (reply === "concede") return [-15, 0, 0, "負け　認めて　草"];
	if (isName(reply)) return [-5, 0, 0, "名前　ちゃうで"];
	if (bait) return [-10, 1, 0, "効いてて　草"];
	return [-5, 0, 0, "なんの　話や"];
};

/** 1枚の 札の ねうち（試験・シムの 最善：支持 − 20×味方の 顔真っ赤 ＋ 10×相手の 顔真っ赤）。 */
export const cardValue = (post: PostKind, c: Card): number => {
	const [d, h, o] = judge(post, c);
	return d - 20 * h + 10 * o;
};

/** その 書きこみに いちばん 良い 札。 */
export const bestOf = (post: PostKind): Card => {
	if (isFallacy(post)) return `name_${post}`;
	if (post === "fair") return "concede";
	if (post === "ask") return "source";
	if (post === "belief") return "respect";
	return "through"; // 煽り・勝利宣言・荒らし
};

// ───────────────── 乱数の 道具 ─────────────────

const pick = <T>(list: readonly T[], r: Rand): T =>
	list[Math.min(list.length - 1, Math.floor(r() * list.length))];
const shuffle = <T>(list: readonly T[], r: Rand): T[] => {
	const a = [...list];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(r() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
};

// ───────────────── お題 ─────────────────

/** 中身の ある お題の 派（戦う 住人と、ひな形・カンペ・決着の 値）。 */
export type PolicySide = {
	readonly name: string;
	/** 戦う 住人（まだ 越してきて いなければ「{name}の　名無し」）。null は いつも 名無し。 */
	readonly fighter: MobId | null;
	/** 藁人形（11字まで）・論点ずらし（相手が 使う。11字まで）・そっちこそ（14字まで）・主語デカい（名詞 9字まで）・切り取り（12字まで）。 */
	readonly extreme: string;
	readonly aside: string;
	readonly past: string;
	readonly label: string;
	readonly cut: string;
	/** まっとうな 指摘（相手が 使う。2行 18字・1行 18字）。 */
	readonly fact: string;
	readonly fact_s: string;
	/** せやな。でも〜（9字まで）・ソース（16字まで）・ゴール動かしの {src}（9字まで）。 */
	readonly short: string;
	readonly source: string;
	readonly src: string;
	/** 味方の 最初の 言い切り（板）。 */
	readonly claim: string;
	/** KO の 発狂（板。人ごとに 手書き）・負けた 相手の 1窓・負けた 味方の 1窓・TKO で 逃げる（板）。 */
	readonly poem: string;
	readonly sorry: string;
	readonly shrug: string;
	readonly flee: string;
	/** 戦う 住人が まだ いない ときの 言い切り（口ぐせの ない 名無しの 文。無ければ claim）。 */
	readonly plain?: string;
};

/** 良スレ判定の 派（架空の 信条）。 */
export type FaithSide = {
	readonly name: string;
	readonly fighter: MobId | null;
	/** 荒らしの 主語デカい（角の 立たない 名詞）。 */
	readonly label: string;
	readonly belief: readonly [string, string, string];
	/** 荒らしの あと 相手の 住人が かばう 1レス（板）・良スレの 1窓・荒れて 逃げる（板）。 */
	readonly defend: string;
	readonly good: string;
	readonly flee: string;
	/** 戦う 住人が まだ いない ときの 信条（口ぐせの ない 名無しの 文）。 */
	readonly plain: readonly [string, string, string];
};

export type TopicId =
	| "karaage"
	| "yuon"
	| "yane"
	| "agesage"
	| "rom"
	| "kiriban";

export type Topic =
	| {
			readonly id: TopicId;
			readonly title: string;
			readonly mode: "policy";
			/** 最後の 書きこみ（板。本番の 議会の 決着に そろえる）。 */
			readonly nao: string;
			readonly sides: readonly [PolicySide, PolicySide];
	  }
	| {
			readonly id: TopicId;
			readonly title: string;
			readonly mode: "faith";
			readonly nao: string;
			readonly sides: readonly [FaithSide, FaithSide];
	  };

/** お題（はじめての 1回は 唐揚げ。並びは 議事録の 号の 順）。 */
export const TOPICS: readonly Topic[] = [
	{
		id: "karaage",
		title: "唐揚げに　レモン",
		mode: "policy",
		nao: "なお　唐揚げは　話してる\nうちに　なくなった　模様",
		sides: [
			{
				name: "かける派",
				fighter: null,
				extreme: "唐揚げは　レモン漬け",
				aside: "レモンは　ビタミンC",
				past: "勝手に　かけとった",
				label: "すっぱい　もん好き",
				cut: "レモンが　主役",
				fact: "レモンで\nさっぱり　食べられるで",
				fact_s: "レモンで　さっぱり　食べられる",
				short: "さっぱり　する",
				source: "定食屋の　おっちゃんが　言うた",
				src: "おっちゃん",
				claim: "唐揚げには　レモンやろ",
				poem: "一生　しなしなの\n唐揚げ　食っとれ！",
				sorry: "……すまん、言いすぎた。\nレモンは　自分の　皿だけに　する",
				shrug: "負けたわ。\n……唐揚げ　冷めとるし",
				flee: "……風呂　入ってくるわ",
			},
			{
				name: "かけない派",
				fighter: null,
				extreme: "レモン　持ちこみ　禁止",
				aside: "マヨ派も　おる",
				past: "皿ごと　かかえとった",
				label: "こだわり屋",
				cut: "衣が　命",
				fact: "かけると\n衣が　しなっと　なるで",
				fact_s: "かけると　衣が　しなっと　なる",
				short: "衣が　サクサク",
				source: "唐揚げスレの　>>1が　言うとる",
				src: ">>1",
				claim: "唐揚げに　レモンは\nいらんやろ",
				poem: "一生　レモン\nかじっとれ！",
				sorry: "……すまん、言いすぎた。\n小皿に　分けよか",
				shrug: "負けたわ。\n……レモン、ちょっと　だけ　な",
				flee: "……風呂　入ってくるわ",
			},
		],
	},
	{
		id: "yuon",
		title: "銭湯の　湯温",
		mode: "policy",
		nao: "なお　湯は　41.5℃の　まま。\n番台は　43℃の　模様",
		sides: [
			{
				name: "41℃派",
				fighter: "ngoane",
				extreme: "熱い　湯は　禁止",
				aside: "足湯は　40℃",
				past: "長湯で　のぼせとった",
				label: "ぬる湯好き",
				cut: "湯は　ぬるい　ほど　ええ",
				fact: "41℃の　ほうが\n長く　入って　いられるで",
				fact_s: "41℃は　長く　入って　いられる",
				short: "長く　入れる",
				source: "湯守の　日誌に　書いとる",
				src: "日誌",
				claim: "湯は　41℃が\nええンゴねぇ……",
				plain: "湯は　41℃が\nええやろ",
				poem: "熱湯で　ゆで卵でも\n作っとれば　いいンゴねぇ！",
				sorry: "……言いすぎたンゴねぇ。\nフルーツ牛乳、おごるンゴ",
				shrug: "負けたンゴねぇ……\nでも、ええ　湯ンゴ",
				flee: "……お風呂　入ってくる\nンゴねぇ",
			},
			{
				name: "42℃派",
				fighter: "jtleman",
				extreme: "41℃は　ただの　水",
				aside: "サウナは　90℃",
				past: "水風呂を　ぬるいと　言うた",
				label: "のぼせ屋",
				cut: "湯は　熱い　ほど　ええ",
				fact: "42℃の　ほうが\n早く　あたたまるで",
				fact_s: "42℃は　早く　あたたまる",
				short: "早く　温まる",
				source: "番台の　温度計が　42℃や",
				src: "温度計",
				claim: "湯は　42℃。\nそれが　紳士の　湯だ",
				plain: "湯は　42℃や。\nそれが　ええ　湯や",
				poem: "ぬる湯で　一生\nふやけて　おれ！",
				sorry: "……すまない。紳士らしく\nなかった。牛乳を　おごろう",
				shrug: "負けは　負けだ。\n……湯上がりの　牛乳は　うまい",
				flee: "……庭の　手入れを\nしてくる",
			},
		],
	},
	{
		id: "yane",
		title: "本館の　屋根の　色",
		mode: "policy",
		nao: "なお　屋根は　灰色の\nまま　の　模様",
		sides: [
			{
				name: "きつね色派",
				fighter: "panmatsu",
				extreme: "屋根も　パンで　作れ",
				aside: "パンの　耳は　うまい",
				past: "看板を　ピンクに　した",
				label: "パン好き",
				cut: "屋根は　焼けば　ええ",
				fact: "きつね色の　屋根は\n遠くからでも　見つけやすいで",
				fact_s: "きつね色は　遠くから　見える",
				short: "遠くから　見える",
				source: "パン板の　アンケートや",
				src: "アンケート",
				claim: "屋根は　きつね色だ。\n焼きたての　パンの　色だ",
				plain: "屋根は　きつね色や。\n焼きたての　パンの　色や",
				poem: "水色の　屋根なんか\nカビが　生えて　しまえ！",
				sorry: "……パンに　カビは　禁句だった。\nすまん。パンを　食え",
				shrug: "……負けた。\nパンを　食って　出直す",
				flee: "……パン　焼いてくる",
			},
			{
				name: "水色派",
				fighter: "nichie",
				extreme: "空より　目立つの　禁止",
				aside: "夕焼けは　だいだい色",
				past: "屋根で　日曜日を　祝った",
				label: "空好き",
				cut: "屋根は　空で　ええ",
				fact: "水色の　屋根は\n夏に　空と　なじむで",
				fact_s: "水色は　夏の　空と　なじむ",
				short: "空と　なじむ",
				source: "日曜日の　空の　写真が　ある",
				src: "写真",
				claim: "屋根は　水色だニィ。\n日曜日の　空の　色だニィ",
				plain: "屋根は　水色や。\n日曜日の　空の　色や",
				poem: "きつね色の　屋根なんか、\n月曜日に　なって　しまえニィ！",
				sorry: "……月曜日は　言いすぎたニィ。\nごめんニィ",
				shrug: "負けたニィ……\n日曜日に　出直すニィ",
				flee: "……日曜日まで\n寝るニィ",
			},
		],
	},
	{
		id: "agesage",
		title: "age派と　sage派",
		mode: "faith",
		nao: "なお　どっちの　スレも\n同じ　メンバーの　模様",
		sides: [
			{
				name: "age派",
				fighter: "onsu",
				label: "話し好き",
				belief: [
					"ageると　だれかが\n来て　くれる　気が　するのぉ",
					"おんSに　人が　来た　日は\nageて　よかったって　思うのよぉ",
					"べ、べつに　目立ちたい\nわけじゃ　ないのよぉ",
				],
				plain: [
					"ageると　だれかが\n来て　くれる　気が　する",
					"人が　来た　日は\nageて　よかったって　思う",
					"べつに　目立ちたい\nわけや　ないで",
				],
				defend: "ちょっと！　age派の　ことは\n悪く　言わないで　ほしいのぉ",
				good: "ええ　スレだったわぁ。\n……また　来て　くださる？",
				flee: "……もう　知らないのぉ！",
			},
			{
				name: "sage派",
				fighter: "jtleman",
				label: "静か好き",
				belief: [
					"sageて　静かに　続く\nスレは、よく　手入れした　庭だ",
					"急がずに　sageで\n長く　続けるのが　好きだ",
					"落ちない　ていどに　sage。\n……それが　私の　流儀だ",
				],
				plain: [
					"sageて　静かに　続く\nスレが　好きや",
					"急がずに　sageで\n長く　続けるのが　ええ",
					"落ちない　ていどに　sage。\n……それが　ワイの　流儀や",
				],
				defend: "荒らしは　よしたまえ。\nsage派にも　sage派の　庭が　ある",
				good: "良い　スレだった。\n……庭に　寄って　いきたまえ",
				flee: "……庭の　手入れを\nしてくる",
			},
		],
	},
	{
		id: "rom",
		title: "書きこみ派と　ROM教",
		mode: "faith",
		nao: "なお　ROM専の　席は\n今日も　満席の　模様",
		sides: [
			{
				name: "書きこみ派",
				fighter: "miaumiau",
				label: "おしゃべり",
				belief: [
					"書きこんで　はじめて\nスレが　伸びるぷ！",
					"レスが　つくと、\nしっぽが　ゆれるにゃ",
					"書きこむのは、\n『ここに　おるで』の　あいさつぷ",
				],
				plain: [
					"書きこんで　はじめて\nスレが　伸びるんや",
					"レスが　つくと、\nうれしい　もんや",
					"書きこむのは、\n『ここに　おるで』の　あいさつや",
				],
				defend: "書きこみ派を　悪く　言うのは\nだめぷ。……みんな　なかまぷ",
				good: "いい　スレだったぷ。\n……またね、にゃ",
				flee: "……帰って　寝るぷ",
			},
			{
				name: "ROM教",
				fighter: "mujje",
				label: "見守り屋",
				belief: [
					"ホゲェ。\n（見とる　だけで　満たされる）",
					"ホゲェ……\n（読むだけで　スレは　楽しい）",
					"ホゲェ！\n（ROMにも　ROMの　楽しみ）",
				],
				plain: [
					"見とる　だけで\n満たされるんや",
					"読むだけで\nスレは　楽しい",
					"ROMにも\nROMの　楽しみが　ある",
				],
				defend: "ホゲェ！\n（それは　ちがう）",
				good: "ホゲェ！\n（いい　スレだった）",
				flee: "ホゲェ……",
			},
		],
	},
	{
		id: "kiriban",
		title: "キリ番派と　ゆずる派",
		mode: "faith",
		nao: "なお　キリ番は、通りすがりの\nROMが　踏んでいった　模様",
		sides: [
			{
				name: "キリ番派",
				fighter: "ren",
				label: "記念好き",
				belief: [
					"キリ番を　踏めた　日は、\n一日　ええ　気分なの！",
					"キリ番の　スクショ、\n100枚　あるよ〜！",
					"777を　踏んだ　とき、\n更新より　うれしかった！",
				],
				plain: [
					"キリ番を　踏めた　日は、\n一日　ええ　気分や",
					"キリ番の　スクショ、\n100枚　あるで",
					"777を　踏んだ　とき、\nめっちゃ　うれしかった",
				],
				defend: "キリ番派の　悪口は\nだめだよ〜！",
				good: "いい　スレだった〜！\nレン、ひとつ　更新　された！",
				flee: "……再起動　してくるね〜",
			},
			{
				name: "ゆずる派",
				fighter: "aru",
				label: "ゆずり屋",
				belief: [
					"キリ番は　ゆずって、\n見守るのが　好きなんです",
					"だれかが　キリ番を　踏むのを\n見てるだけで　うれしいです",
					"1000は　ひとりで　取る\nもんや　ない……って　聞きました",
				],
				plain: [
					"キリ番は　ゆずって、\n見守るのが　好きや",
					"だれかが　キリ番を　踏むのを\n見てるだけで　うれしい",
					"1000は　ひとりで　取る\nもんや　ない……らしいで",
				],
				defend: "ゆずる派の　ことを\n悪く　言わないで　ください！",
				good: "いい　スレでした！\n……先輩、ありがとうございます",
				flee: "……ちょっと　頭を\n冷やしてきます",
			},
		],
	},
];

export const topicById = (id: string): Topic | undefined =>
	TOPICS.find((t) => t.id === id);

/** 戦う 住人が まだ いない ときの 名無しの 文（どの お題も 同じ）。 */
export const NANASHI_LINES = {
	poem: "うるさい　うるさい！\nお前の　カーチャン　でべそ！",
	sorry: "……すまん、言いすぎたわ。\n今度　なんか　おごる",
	shrug: "負けたわ。\n……まあ、ええ　スレやった",
	flee: "……風呂　入ってくるわ",
	defend: "それは　ちゃうやろ。\n荒らしは　スルーや",
	good: "ええ　スレやったな。\n……また　やろか",
} as const;

/** 板の 外に 出す 1窓（地の文。ほかは 住人が 言う：sorry・shrug・good）。 */
export const OUTSIDE_TEXT = {
	draw: "ふたりは　握手した。\n……ROMが　拍手して　いる。",
	towel: "タオルが　投げこまれた。\n……討論は　ここまで。",
	futsu: "スレは　静かに　落ちた。\n……ふつうの　スレだった。",
	arete: "スレは　荒れた。\n……ROMが　そっと　閉じた。",
} as const;

/** 板の note（全角19字まで）。{us} は 味方の 派、{them} は 相手の 派。 */
export const VERDICT: Readonly<Record<Outcome, string>> = {
	ko: "KO！　{us}の　勝ち",
	win: "判定：{us}の　勝ち",
	draw: "判定：引き分け",
	lose: "判定：{them}の　勝ち",
	tko: "TKO……{them}の　勝ち",
	towel: "タオル。……ここまで",
	ryosure: "良スレ　判定",
	futsu: "ふつうの　スレ",
	arete: "スレが　荒れた",
};

/** 板の 書きこみ（全角18字×2行）と 小さな 字。 */
export const BOARD = {
	/** >>1 スレ主（立て逃げ）。 */
	op: "【模擬議会】{title}\n……あとは　任せた",
	koRom: "発狂して　草",
	tkoRom: "逃げた　ぞ",
	towelRom: "セコンドが　止めたで",
	tateNige: "スレ主　どこ行ったんや",
	/** 1回目の B。 */
	quit1: "もう一度　Bで　タオル",
	jienRom: "主　ついとるで",
	title: "模擬議会　{title}",
	hint: "↑↓　えらぶ　A　カンペ　B×2　タオル",
	close: "とじる",
	round: "R{r}/5",
	red: "顔真っ赤",
	op1: "スレ主",
	rom: "名無し",
	nanashi: "{side}の　名無し",
	aria: "カンペを　えらぶ",
	/** 自演が ばれた 名前の 後ろ。 */
	nushi: "（主）",
} as const;

/** 村の 窓（全角22字×2行。キリコは しゃべらない）。 */
export const DEBATE_MSG = {
	/** はじめての 1回（議会事務局の 3窓。オンボーディングなので はっきり 言う）。 */
	intro: [
		"相手の　ずるい　理屈には、\n名前を　言い当てると　強い",
		"煽りには　乗らない。\n乗ると、顔が　真っ赤に　なる",
		"判定は　中身やなくて、\n話し方の　判定です。……練習ですけど",
	],
	staff: "議会事務局",
	ally: "カンペ係さん、\nたのむで……",
	nod: "キリコは　うなずいた。",
	pickTopic: "どの　お題に　する？",
	pickSide: "どっちの　カンペ係に　なる？",
	quit: "やめる",
} as const;

/** 議事録の 決着の ことば（窓の 2行目）。jien は 自演が ばれた 試合（中身の お題だけ）。 */
export const PAGE = {
	ko: "KO。……発狂ポエムつき。",
	win: "判定勝ち。",
	draw: "引き分け。握手で　おわった。",
	lose: "判定負け。",
	tko: "TKO。……風呂に　逃げた。",
	towel: "タオル。",
	jien: "自演　発覚。（主）つき。",
	ryosure: "良スレ。",
	futsu: "ふつうの　スレ。",
	arete: "荒れた。",
} as const;
export type PageKind = keyof typeof PAGE;

/** お題の 型ごとの 議事録の 決着（中身 7・良スレ 3。お題 6つで 全 30ページ）。 */
export const PAGE_KINDS: Readonly<Record<DebateMode, readonly PageKind[]>> = {
	policy: ["ko", "win", "draw", "lose", "tko", "towel", "jien"],
	faith: ["ryosure", "futsu", "arete"],
};

/** 議事録の 号の 一覧（お題の 順 × 決着の 順。n は 1 から）。 */
export const PAGES: readonly {
	readonly n: number;
	readonly topic: TopicId;
	readonly kind: PageKind;
	readonly key: string;
}[] = TOPICS.flatMap((t) =>
	PAGE_KINDS[t.mode].map((kind) => ({ t, kind })),
).map(({ t, kind }, i) => ({
	n: i + 1,
	topic: t.id,
	kind,
	key: `${t.id}:${kind}`,
}));

/** 1試合で 残る 議事録の ページ（決着と、中身の お題で 自演が あれば 自演 発覚）。 */
export const pagesOf = (
	topic: Topic,
	outcome: Outcome,
	jien: boolean,
): string[] => {
	const kinds = PAGE_KINDS[topic.mode];
	return [
		...((kinds as readonly string[]).includes(outcome)
			? [`${topic.id}:${outcome}`]
			: []),
		...(jien && kinds.includes("jien") ? [`${topic.id}:jien`] : []),
	];
};

// ───────────────── 見分け方の はり紙 ─────────────────

/**
 * はり紙『ずるい　理屈の　見分け方』（選んで 1窓）。ソース要求そのものは まっとう（k_ask）と、
 * ソースを 出したら また ソースを 求める ゴール動かし（k_goal）を 並べる。
 */
export const KIBEN: readonly {
	readonly label: string;
	readonly text: string;
}[] = [
	{
		label: "藁人形",
		text: "藁人形：言って　ない　ことを\n言った　ことに　して　たたく。",
	},
	{
		label: "論点ずらし",
		text: "論点ずらし：都合が　悪く　なると\nべつの　話を　はじめる。",
	},
	{
		label: "『ソースは？』",
		text: "『ソースは？』は　まっとうな　質問。\n聞かれたら、出せば　ええ。",
	},
	{
		label: "ゴール動かし",
		text: "ゴール動かし：ソースを　出したら\n『その　ソースの　ソースは？』",
	},
	{
		label: "人格攻撃",
		text: "人格攻撃：話の　中身　でなく、\n話す　人を　たたく。",
	},
	{
		label: "そっちこそ",
		text: "そっちこそ：『お前も　前に\n〜した』で　話を　すりかえる。",
	},
	{
		label: "主語デカい",
		text: "主語デカい：『〜派は　みんな』と\nひとまとめに　する。",
	},
	{
		label: "多数派",
		text: "多数派：『みんな　そう　言うとる』\n……多いかと、正しいかは　別。",
	},
	{
		label: "切り取り",
		text: "切り取り：まとめの　見出し　だけで\n言うた　ことに　する。",
	},
	{
		label: "煽り",
		text: "煽りには　乗らない。\n乗ると、顔が　真っ赤に　なる。",
	},
	{
		label: "信じる　もの",
		text: "信じる　ものの　話には、名前を\nつけない。『ええな』で　ええ。",
	},
	{
		label: "荒らし",
		text: "荒らしには　かまわない。\n……かまうのも　荒らしの　うち。",
	},
];

// ───────────────── 試合 ─────────────────

export type DebateSt = {
	readonly topic: Topic;
	readonly us: 0 | 1;
	readonly mode: DebateMode;
	/** ラウンド（1〜5。はじめは 0）。 */
	r: number;
	/** 相手の 顔真っ赤（0〜3。中身の お題だけ）。 */
	opp: number;
	/** 味方の 顔真っ赤（3 で TKO）。 */
	heat: number;
	/** ROM の 支持（0〜100）。 */
	support: number;
	readonly used: Set<PostKind>;
	readonly count: Partial<Record<PostKind, number>>;
	last: Card | null;
	/** 前の 手で 煽りに 乗った（相手も 煽りを 続ける）。 */
	provoked: boolean;
	/** 前の 手で 名前を 言い当てた（続けて 当てると +5）。 */
	prevName: boolean;
	jien: boolean;
	/** 良スレ判定の 2〜4 ラウンドの 並び（荒らし 2つと 信条 1つ）。 */
	readonly plan: readonly PostKind[];
	/** この 試合で 出した 文（くり返さない）。 */
	readonly seen: Set<string>;
	/** ひな形を 埋める 値。 */
	readonly vars: Readonly<Record<string, string>>;
	outcome: Outcome | null;
};

/** 埋める（埋まらない {…} は そのまま 残す。試験で 落とす）。 */
export const fillDebate = (
	s: string,
	v: Readonly<Record<string, string>>,
): string => s.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);

/** 戦う 住人が まだ いない 派（口ぐせの ない 名無しの 文を 使う）。 */
export type Nameless = { readonly ally: boolean; readonly opp: boolean };
const NAMED: Nameless = { ally: false, opp: false };

/** 味方 a・相手 b の 値（ひな形と カンペを 埋める）。相手が 名無しなら 信条は 口ぐせの ない 文。 */
export const debateVars = (
	topic: Topic,
	us: 0 | 1,
	n = 12,
	nameless: Nameless = NAMED,
): Record<string, string> => {
	const a = topic.sides[us];
	const b = topic.sides[us === 0 ? 1 : 0];
	const base = { us: a.name, them: b.name, title: topic.title, n: String(n) };
	if (topic.mode === "faith") {
		const fa = a as FaithSide;
		const fb = b as FaithSide;
		const bl = nameless.opp ? fb.plain : fb.belief;
		return {
			...base,
			label: fa.label,
			belief0: bl[0],
			belief1: bl[1],
			belief2: bl[2],
		};
	}
	const pa = a as PolicySide;
	const pb = b as PolicySide;
	return {
		...base,
		extreme: pa.extreme,
		past: pa.past,
		label: pa.label,
		cut: pa.cut,
		src: pa.src,
		short: pa.short,
		source: pa.source,
		aside: pb.aside,
		fact: pb.fact,
		fact_s: pb.fact_s,
	};
};

/** 味方の 最初の 言い切り（中身の お題は claim、良スレ判定は 自分の 信条の 1つ目）。 */
export const claimOf = (
	topic: Topic,
	us: 0 | 1,
	nameless: Nameless = NAMED,
): string => {
	const a = topic.sides[us];
	if (topic.mode === "faith") {
		const fa = a as FaithSide;
		return (nameless.ally ? fa.plain : fa.belief)[0];
	}
	const pa = a as PolicySide;
	return nameless.ally ? (pa.plain ?? pa.claim) : pa.claim;
};

/** 試合を はじめる（良スレ判定は 2〜4 ラウンドの 並びを ここで 決める）。 */
export const debateStart = (
	topic: Topic,
	us: 0 | 1,
	r: Rand,
	nameless: Nameless = NAMED,
): DebateSt => ({
	topic,
	us,
	mode: topic.mode,
	r: 0,
	opp: 0,
	heat: 0,
	support: 50,
	used: new Set(),
	count: {},
	last: null,
	provoked: false,
	prevName: false,
	jien: false,
	plan:
		topic.mode === "faith"
			? shuffle([pick(ARASHI, r), "belief", pick(ARASHI, r)], r)
			: [],
	seen: new Set(),
	vars: debateVars(topic, us, 10 + Math.floor(r() * 80), nameless),
	outcome: null,
});

/** 相手の 次の 書きこみ（試合の 流れで 決める。st.r は もう 進めて ある）。 */
export const nextPost = (st: DebateSt, r: Rand): PostKind => {
	if (st.mode === "faith") {
		if (st.r === 1 || st.r === 5) return "belief";
		return st.plan[st.r - 2] ?? "belief";
	}
	// 味方の 言い切りへの 1つ目の 返し
	if (st.r === 1) return r() < 0.7 ? "fair" : pick(OPENERS, r);
	// 煽りに 乗ったら、相手も 煽りを 続ける
	if (st.provoked) return st.r === 5 && st.opp >= 2 ? "victory" : "bait";
	const n = (k: PostKind) => st.count[k] ?? 0;
	if (st.r === 5)
		return st.opp >= 2 || n("fair") >= 2
			? "victory"
			: pick(["fair", "victory"] as const, r);
	const pool: PostKind[] = [];
	const add = (k: PostKind, w = 1) => {
		if (!st.used.has(k)) for (let i = 0; i < w; i++) pool.push(k);
	};
	// 言い切った あと：まっとうな「ソースは？」・ソースを 出した あと：ゴールを 動かす
	if (st.last === "concede") add("ask", 2);
	if (st.last === "source") add("goal", 3);
	for (const f of OPENERS) add(f);
	// 崩れてから 人を たたく
	if (st.opp >= 1) for (const f of PERSONAL) add(f);
	add("bait");
	// まっとうな 指摘は 途中にも 来る（詭弁ばかりでは ない）
	if (n("fair") < 2) pool.push("fair");
	return pick(pool.length ? pool : (["bait"] as const), r);
};

/**
 * カンペ 6枚：上 2枚は 名指し（詭弁なら 正解 1＋まちがい 1、それ以外は 半分の 確率で 正解 まじり、
 * どれも 並びは ばらばら）、つぎの 3枚は いつも 同じ やわらかい 札、いちばん 下に 熱い 札 1枚。
 */
export const cardsFor = (post: PostKind, mode: DebateMode, r: Rand): Card[] => {
	const b = bestOf(post);
	const k: PostKind =
		post === "a_shugo" ? "shugo" : post === "a_jinkaku" ? "jinkaku" : post;
	const right: NameCard | null = isFallacy(k) ? `name_${k}` : null;
	const wrong = shuffle(
		FALLACY.map((f): NameCard => `name_${f}`).filter((x) => x !== right),
		r,
	);
	const names: Card[] =
		right && r() < (isName(b) ? 1 : 0.5)
			? [right, wrong[0]]
			: [wrong[0], wrong[1]];
	const soft: readonly Card[] =
		mode === "faith"
			? ["respect", "plain", "through"]
			: ["concede", "source", "through"];
	return [...shuffle(names, r), ...soft, pick(HOT, r)];
};

/** カンペの 文（埋めた）。 */
export const cardText = (st: DebateSt, c: Card): string =>
	fillDebate(CARDS[c], st.vars);

/** 書きこみの 文（その 試合で まだ 出していない ひな形から。埋めた）。 */
export const postText = (st: DebateSt, post: PostKind, r: Rand): string => {
	const all = POSTS[post].map((t) => fillDebate(t, st.vars));
	const fresh = all.filter((t) => !st.seen.has(t));
	const text = fresh.length ? pick(fresh, r) : all[0];
	st.seen.add(text);
	return text;
};

/** ラウンドを 進めて 相手の 書きこみと カンペを 決める。 */
export const roundStart = (
	st: DebateSt,
	r: Rand,
): { post: PostKind; cards: Card[] } => {
	st.r += 1;
	const post = nextPost(st, r);
	st.used.add(post);
	st.count[post] = (st.count[post] ?? 0) + 1;
	return { post, cards: cardsFor(post, st.mode, r) };
};

/** 5 ラウンドの あとの 決着（KO・TKO で ない とき）。 */
export const finalOutcome = (st: DebateSt): Outcome =>
	st.mode === "faith"
		? st.support >= 70
			? "ryosure"
			: st.support <= 40
				? "arete"
				: "futsu"
		: st.support >= 80
			? "win"
			: st.support <= 40
				? "lose"
				: "draw";

/** カンペを 書いた。採点して 試合を 進める（end は KO・TKO・5 ラウンド後の 決着。まだ なら null）。 */
export const roundAnswer = (
	st: DebateSt,
	post: PostKind,
	c: Card,
): { d: number; h: number; o: number; rom: string; end: Outcome | null } => {
	const j = judge(post, c);
	let d = j[0];
	const named = isName(c) && c === `name_${post}`;
	if (named && st.prevName) d += 5;
	st.prevName = named;
	if (c === "self_jien") st.jien = true;
	st.support = Math.max(0, Math.min(100, st.support + d));
	st.heat += j[1];
	const o = st.mode === "policy" ? j[2] : 0;
	st.opp = Math.min(3, st.opp + o);
	st.provoked = isHot(c);
	st.last = c;
	let end: Outcome | null = null;
	if (st.heat >= 3) end = st.mode === "faith" ? "arete" : "tko";
	else if (
		st.mode === "policy" &&
		post === "victory" &&
		c === "through" &&
		st.r === 5 &&
		st.opp >= 3
	)
		end = "ko";
	else if (st.r >= 5) end = finalOutcome(st);
	st.outcome = end;
	return { d, h: j[1], o, rom: j[3], end };
};

/** カンペを 選ぶ 手（試験・シム）。 */
export type DebatePolicy = (
	post: PostKind,
	cards: readonly Card[],
	st: DebateSt,
	r: Rand,
) => Card;

/** 1試合（5 ラウンド。試験・シム）。log は 書きこみの 文ごとに 呼ぶ。 */
export const playDebateSim = (
	topic: Topic,
	us: 0 | 1,
	policy: DebatePolicy,
	r: Rand,
	log?: (
		st: DebateSt,
		post: PostKind,
		text: string,
		cards: readonly Card[],
		c: Card,
	) => void,
	nameless: Nameless = NAMED,
): { outcome: Outcome; st: DebateSt } => {
	const st = debateStart(topic, us, r, nameless);
	for (;;) {
		const { post, cards } = roundStart(st, r);
		const text = postText(st, post, r);
		const c = policy(post, cards, st, r);
		log?.(st, post, text, cards, c);
		const { end } = roundAnswer(st, post, c);
		if (end) return { outcome: end, st };
	}
};
