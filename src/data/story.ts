// 植民地（ダンジョン）の物語の部品。
// - 名前と板の決まり・見た目と曲、目的の品、はじめて入る前の語り（intro）と 持ち帰ったあとの語り（ending）、
//   次のダンジョンが開いたときの ひとこと、起動の札と 村の ひとことの たまり。
// - 本編（main）の intro / ending は quotes.ts の INTRO / ENDING をそのまま使う。
// 話すのは 外で待っている仲間だけ（キリコはしゃべらない。ナレーションで動作だけ描く）。
// 1行は全角22字・2行まで。説明せず、行間を読ませる（rpg README「セリフの書き方」）。

import type { DungeonId } from "../core/types";
import { ENDING, INTRO, type Speaker } from "./quotes";

/** 仲間の ひとこと（起動の札・村・開いたときの ひとこと）。 */
export type Line = { who: Speaker; text: string };

/** 語りの1ページ（who が null なら ナレーション）。 */
export type StoryPage = { who: Speaker | null; text: string };

const q = (who: Speaker, text: string): Line => ({ who, text });
const n = (text: string): StoryPage => ({ who: null, text });
const s = (who: Speaker, text: string): StoryPage => ({ who, text });

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
			"いちばん　栄えた　植民地。入門の　10階",
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
			"植民地で　いちばん　雰囲気が　ええ。27階",
			"湯治：HPの　自然回復が　1.5倍",
			"倉庫の　道具を　持ちこめる",
		],
	},
	deep: {
		name: "電池板",
		short: "電池板",
		nick: "でんJ",
		mascot: "でんちゃん　{+'w'-]",
		rules: [
			"過疎で　謎が　多い　植民地。30階",
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
			"パン板が　植民した、植民地の　植民地。12階",
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
			"総島民　6人の　島。15階",
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
			"レスの　末尾に　😡が　つく　板。20階",
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
			"猛虎弁の　使える　雑談板。20階",
			"祭り：3階から　3つに　1つの　階が　祭り",
			"ぜんぶ　未識別",
		],
	},
	// 隠し（電池板を 持ち帰ると 開く）。植民地では なく、おんJ（保守村）の 真下
	hidden: {
		name: "過去ログの底",
		short: "ログの底",
		nick: "おんJの　真下",
		mascot: "1001（どの　スレも　最後は　これ）",
		rules: [
			"保守村の　下の　古井戸。99階",
			"層ごとに　景色と　曲が　かわる",
			"底の　品を　持ったまま　帰還スレで　帰れる",
		],
	},
};

/** ui/theme.ts の Theme.name。 */
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

/** 植民地の 見た目と 曲（板ごとに 1つ。全フロア 同じ。ui/theme.ts が 読む）。 */
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
		note: "「まだ　見てる　やつ　おる？」",
		theme: "stone",
		bgm: "stone",
		ambient: "dust",
	},
	{
		last: 15,
		name: "埋もれた dat",
		note: "「落ちる前に　言っとく。楽しかった」",
		theme: "stone",
		bgm: "deep_dat",
		ambient: "dust",
	},
	{
		last: 20,
		name: "苔むしたスレ跡",
		note: "「ほな、また」",
		theme: "moss",
		bgm: "field",
		ambient: "spores",
	},
	{
		last: 25,
		name: "崩れたまとめ",
		note: "「まとめられて、それきり」",
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
		note: "「規制で　書けん。……見てるで」",
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
		note: "「燃えた。でも、ここに　おった」",
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
	// 回路の 床（漏電の 火花）。名無し155さんの 曲
	deep: { theme: "cyber", bgm: "retro", ambient: "data" },
	// 苔と 胞子
	kinoko: { theme: "moss", bgm: "field", ambient: "spores" },
	// 砂浜と 南国の 緑（水晶の 洞窟では 島に 見えないので）。水の しずく
	tropical: { theme: "beach", bgm: "deep_hakushi", ambient: "glitter" },
	// 鉄板の 焦げ
	konamono: { theme: "lava", bgm: "deep_koge", ambient: "embers" },
	// 提灯の 赤。都節の 曲
	festival: { theme: "lattice", bgm: "deep_kisei", ambient: "glitter" },
	// 隠し：層ごとに かわる（theme・bgm は 層が 無い ときの 予備）
	hidden: {
		theme: "earth",
		bgm: "deep1",
		ambient: "dust",
		zones: HIDDEN_ZONES,
	},
};

// ───────────────── 目的の品 ─────────────────
/** 本編の「はじまりの原盤」は core/data/items.ts にある（desc は同じ書き方）。 */
export const GOAL_ITEMS: Record<
	"shallow" | "deep",
	{ id: string; name: string; desc: string }
> = {
	shallow: {
		id: "hari",
		name: "蓄音機の針",
		desc: "パン板の　過去ログに　落ちていた　針。持ち帰ろう",
	},
	deep: {
		id: "tsuzuki",
		name: "つづきの原盤",
		desc: "送電鉄塔の　てっぺんに　あった　レコード。まだ、なにも　入っていない",
	},
};

// ───────────────── 語り ─────────────────
/**
 * intro：そのダンジョンに はじめて入る前の ナレーション。パン板の intro が このゲームの いちばん最初の前口上。
 * ending：目的の品を 持ち帰ったとき（記録の札の前）。
 */
export const STORY: Record<
	DungeonId,
	{ intro: readonly string[]; ending: readonly StoryPage[] }
> = {
	shallow: {
		intro: [
			// 前口上は 最初の 村（data/town.ts の OPENING）で 見せたので、ここは 中の 決まり
			"パン板の　過去ログ。\nおんJ民が　いちばん　栄えさせた　植民地。",
			"キリコが　1歩　すすむと、\n下の　ものたちも　1歩　すすむ。",
			"1つの　階は、1本の　スレ。\n1000を　こえたら、つぎへ　落とされる。",
			"たおれたら、持ち物も　レベルも\n置いて、地上へ　もどされる。",
			"キリコは　蓄音機を　かかえた。\n……まず、パン板から　降りる。",
		],
		ending: [
			n("村に　帰りつくと、\n山吹色が　うでを　組んで　待っていた。"),
			s("nanj", "取ってきたんか。\n……ワイは　疑ってへんかったで（自称）"),
			s("feris", "おかえり〜。針、ちっちゃいね〜。\n……なくさないでね〜"),
			s("roze", "落とした　ものを　ひろって　くるのは\n常識アル。……えらいアル"),
			s("shiyo", "……見てなかったわよ。\n針、さびてない？　見せなさい"),
			s("zero", "おかえりなさい！　……あ、針の\nほうにも　言っちゃいました"),
			n("キリコは　蓄音機に　針を　つけた。\nハンドルを　まわす。"),
			n("ざらざら、と　音が　した。\n……それだけ、だった。"),
			s("nanj", "……なんも　のってへんやん。草"),
			n("キリコは　しばらく、\nその　ざらざらを　聞いていた。"),
			s(
				"zero",
				"……ざらざらも、保存しました。\nゼロには、雨の　音に　聞こえます",
			),
		],
	},
	main: { intro: INTRO, ending: ENDING },
	deep: {
		intro: [
			"過疎の　電池板。\n住む　人は　いないのに、スレは　落ちない。",
			"だれかが　保守して　ageた　スレが、\n送電鉄塔の　上へ　つもっていく。",
			"はじまりの　原盤は、村で\nまだ、ちいさく　鳴っている。",
			"鉄塔の　てっぺんには、まだ　なにも\n入っていない　レコードが　あるという。",
			"キリコは　蓄音機の　ハンドルを　まわした。\n……針は、ある。",
			"……でん、と　鳴った。",
		],
		ending: [
			n("村に　帰りつくと、\n五つの　色が、ならんで　立っていた。"),
			s("nanj", "延長戦、おつかれさん。\n……サヨナラは、まだ　言わへんで"),
			n("キリコは　蓄音機に　つづきの原盤を　のせた。\n針が、おりる。"),
			n("ざらざら、と　音が　した。\nその　むこうには、まだ　なにも　ない。"),
			s("nanj", "……なんも　入ってへんやん。\nまた　草"),
			n("キリコは　ラッパを、\nみんなの　ほうへ　向けた。"),
			s("nanj", "え、ワイから？\n……あー、あー。マイクテスト、マイクテスト"),
			s("feris", "あー、あー〜。\n……ふぇ……ふぇ……"),
			s("roze", "あー、あー、アル。\n……これで　いいアル？"),
			s("shiyo", "……あ、あーっ！\nいまの　なし！　録らないで！"),
			s(
				"zero",
				"あー、あー。……ゼロの　声も、\nみんなと　同じ　レコードに　入った",
			),
			n("針が、あがる。"),
		],
	},
	kinoko: {
		intro: [
			"きのこ板の　過去ログ。\nパン板が　植民した、植民地の　植民地。",
			"生えている　ものは、\n食べるまで　当たりか　わからない。",
			"キリコは　蓄音機を　かかえた。\n……ふんぞりかえった　声が　する。",
		],
		ending: [
			n("村に　帰りつくと、\nゼロが　かけよってきた。"),
			s("zero", "きのにゃん、ですね！\n……持ったら、にらまれました"),
			s("nanj", "態度　でかすぎやろ。\n……パン板の　植民地の　くせに"),
			n("きのにゃんは　蓄音機の　上に\nすわりこんだ。……どかない。"),
		],
	},
	tropical: {
		intro: [
			"離島・沖縄板。\n総島民は、6人。",
			"だれも　来ない　島の　山の　上に、\nヤシの実が　ひとつ　引っかかっているという。",
			"キリコは　蓄音機を　かかえた。\n……波の　音が、下から　する。",
		],
		ending: [
			n("村に　帰りつくと、\nフェリスが　手を　ふっていた。"),
			s("feris", "ヤシの実〜！　ねえ、\n耳に　あてたら　波の　音　する〜？"),
			n("キリコは　ヤシの実を　蓄音機に\nのせてみた。……回らない。"),
			s(
				"roze",
				"それは　レコードじゃ　ないアル。\n……割って　飲むのが　常識アル",
			),
		],
	},
	konamono: {
		intro: [
			"おんたこの　雑居ビル。\nレスの　末尾に、😡が　つく　板。",
			"怒って　いるのでは　ない。\nたこ焼きの　顔、らしい。",
			"キリコは　蓄音機を　かかえた。\n……上の　階から、ソースの　においが　する。",
		],
		ending: [
			n("村に　帰りつくと、\nやきうが　鼻を　ひくつかせていた。"),
			s(
				"nanj",
				"たこ焼きやんけ！　……😡の　顔しとる。\nやきう→猛虎弁→大阪→たこ焼きや",
			),
			s("roze", "麻婆豆腐と　いっしょに\n出すアル。……合わないアル？"),
			n("たこ焼きは、まだ　あたたかかった。"),
		],
	},
	festival: {
		intro: [
			"お祭り会場の　やぐら。\n猛虎弁の　使える、雑談の　板。",
			"にぎやかだった　ころの　祭りが、\nやぐらの　上で　まだ　続いている。",
			"キリコは　蓄音機を　かかえた。\n……太鼓の　音が、上から　する。",
		],
		ending: [
			n("村に　帰りつくと、\nシヨが　腕を　組んで　待っていた。"),
			s(
				"shiyo",
				"うちわ？　……祭りに　行ってたの。\nあたすは　呼ばれて　ないけど",
			),
			n("キリコは　うちわで、\nシヨを　あおいだ。"),
			s("shiyo", "……べ、べつに　暑くないわよ。\n……もう　少し　あおいで"),
		],
	},
	hidden: {
		intro: [
			"保守村の　下に、古い　井戸が　ある。\nおんJの　スレも、ここへ　落ちてきた。",
			"落ちて、落ちて、いちばん　下。\nどの　スレも、最後は　同じ　レスで　終わる。",
			"「このスレッドは　1000を\n超えました。」",
			"その　1001が　刻まれた　レコードが、\n底に　あるという。",
			"キリコは　蓄音機の　ハンドルを　まわした。\n……ひとりで、降りる。",
		],
		ending: [
			n("村に　帰りつくと、\nみんなが　井戸を　のぞきこんでいた。"),
			s(
				"nanj",
				"ほんまに　底まで　行ったんか。\n……1001て、終わりの　レスやんけ",
			),
			n("キリコは　1001の原盤を　のせた。\n針が、おりる。"),
			n(
				"「このスレッドは　1000を　超えました。\nもう書けないので、新しいスレッドを……」",
			),
			s("zero", "……新しい　スレッドを、\n立ててください、ですって"),
			s("feris", "じゃあ、立てよ〜。\nつぎの　スレ〜"),
			n("キリコは　蓄音機に　むかって、\n「あー、あー」と　吹きこんだ。"),
			s("zero", "……次スレの　>>1、\n「あー、あー」で　立ちました"),
			s("nanj", "はじまりの　原盤と　同じやんけ。\n……ほな、次スレ　はよ"),
		],
	},
};

// ───────────────── 次が開いたとき ─────────────────
/**
 * 持ち帰って 次のダンジョンが開いたときの ひとこと（ending のあと・記録の札の前に）。
 * relief は ちょっと で10回 倒れて 本編が開いたとき（針は シヨが 用意する）。
 */
export const UNLOCK_LINES: Record<
	"main" | "deep" | "relief" | "colony" | "hidden",
	readonly Line[]
> = {
	main: [
		q("nanj", "約束や。風呂板、行ってええで。\n……のぼせんなよ"),
		q(
			"zero",
			"風呂板への　入口、開きました！\nゼロ、いっしょには　行けませんが……",
		),
	],
	deep: [
		q("zero", "電池板から、音が　します。\n……サブ機たちも、ビリビリ　してます"),
		q("nanj", "電池板て　なんやねん。\n……延長戦や。延長戦"),
	],
	relief: [
		q(
			"shiyo",
			"針なら、あたすが　用意したわよ。\n……あなたの　ためじゃ　ないから",
		),
		q("zero", "10回の　挑戦、ぜんぶ　見てました。\n……11回目も、応援します！"),
	],
	// 隠しの 過去ログの底（保守村の 下の 古井戸）
	hidden: [
		q("zero", "村の　古井戸から、音が　します。\n……いちばん　下から、です"),
		q("nanj", "過去ログの底や。\n……ほんまに　あったんか"),
	],
	// 口の ない 植民地（{name} は 板の 名前）。口から 一覧で 行ける
	colony: [
		q("zero", "新しい　植民地が　見つかりました！\n{name}、です"),
		q(
			"nanj",
			"おんJ民、どこにでも　住みつくな。\n……口から　えらんで　行けるで",
		),
	],
};

// ───────────────── 起動の札と 村の ひとこと ─────────────────
/** 持ち帰ったあと（ダンジョンごと）。 */
export const CLEAR: Record<DungeonId, readonly Line[]> = {
	shallow: [
		q("nanj", "針、取ってきたんか。\n……ほな、次は　本番やな"),
		q("roze", "パン板でも、下は　下アル。\n……おつかれアル"),
		q(
			"feris",
			"針、見つかって　よかったね〜。\n私、目が　いいから　見えてたよ〜",
		),
		q("shiyo", "パン板、でしょ。……ふん。\nま、まあ、よく　やったんじゃない"),
		q(
			"zero",
			"針の　回収、おめでとうございます！\n……ケーキは、焼けませんでした",
		),
	],
	main: [
		q("nanj", "「あー、あー」て。\n……何回　聞いても　草"),
		q("roze", "おかえりアル。……蓄音機、\nずっと　まわってるアル"),
		q("feris", "レコード、もう1回　きこ〜。\n……もう1回だけ〜"),
		q("shiyo", "「あー、あー」しか　入ってない。\n……まあ、わるくないわよ"),
		q("zero", "原盤、今日も　聞きました。\n……再生回数、ゼロが　1位です"),
	],
	deep: [
		q(
			"nanj",
			"鉄塔の　てっぺんまで　行った子、\nワイが　名付けたんやで（自称）",
		),
		q("roze", "わたしの　「アル」、\nちゃんと　入ってたアル？"),
		q("feris", "私の　くしゃみ、入ってない〜？\n……入ってても、いいか〜"),
		q("shiyo", "……あたすの　「あー」、\n聞き返さないで。声、大きすぎ"),
		q("zero", "ゼロの　声、ちゃんと　みなさんと\n混ざって　ましたか？"),
	],
	kinoko: [
		q("zero", "きのにゃん、まだ　蓄音機の\n上です。……どいて　くれません"),
		q("nanj", "植民地の　植民地や。\n……どっちが　えらいねん"),
	],
	tropical: [
		q("feris", "ヤシの実、波の　音　した〜。\n……たぶん〜"),
		q("roze", "島民が　7人に　なったアル。\n……キリコも　数えたアル"),
	],
	konamono: [
		q("nanj", "たこ焼き、うまかったで😡\n……あ、勝手に　ついた"),
		q("roze", "麻婆豆腐に　たこ、\n……入れて　みたアル"),
	],
	festival: [
		q("shiyo", "うちわ、あたすが　あずかってるわ。\n……使っては　ないわよ"),
		q("nanj", "祭りのあとの　うちわや。\n……ええ　祭りやった"),
	],
	hidden: [
		q("nanj", "次スレ、立ったで。\n……>>1乙や"),
		q(
			"zero",
			"1001の原盤、毎日　聞いてます。\n……終わりの　レスなのに、元気が　出ます",
		),
	],
};

/** まだ一度も もぐっていない（針を 取りにいく前）。quotes.ts の FIRST の パン板 版。 */
export const FIRST_SHALLOW: readonly Line[] = [
	q("nanj", "パン板やで。パン松が　おるで。\n……ほな、上で　保守しとくわ"),
	q("roze", "針は　ちいさいアル。\nよく　見て　さがすアル。常識アル"),
	q("feris", "パン板なら、私も\n飛んで　行けるかな〜。……行かないけど〜"),
	q("shiyo", "心配なんか　してないわよ。\n……針、なくさないでよね"),
	q(
		"zero",
		"いってらっしゃいの　練習、\n100回　しました。……いってらっしゃい！",
	),
];

/** パン板で倒れたとき（たおれ方の たまりより 前に見る）。 */
export const SHALLOW_DEATH: readonly Line[] = [
	q("nanj", "パン板やで？　入門の。\n……いや、パン板でも　下は　下か"),
	q("roze", "針は　ちいさいアル。\nあわてないのが　常識アル"),
	q("feris", "パン板でも、ころぶよね〜。\n私も　よく　ころぶ〜"),
	q("shiyo", "杖は、ふるまで　わからないの。\n……教えて　あげたんだからね"),
	q("zero", "パン板の　ログ、読みました。\n……短いけど、ゼロは　好きです"),
];
