// 束音（たばね）ロゼ・解音（ときね）ゼロの 依頼（悩み → キリコが 引き受ける → 依頼を はたす →
// 本人から 探索を 手伝うと 申し出る → 冒険に 出られる。engine/heroes.ts・ui/villageEvents.ts の heroQuestScript）。
// 村の 窓は 22字×2行（src/sim/heroTests.ts が 測る）。キリコの 独白は （　）つき・「ンゴ」。
//
// 下敷き（2026-10 の 調べ。実在の 人の 名前は 出さない）：
// ロゼ：2024年7月、おんJの「安価でおんJ発のボカロキャラを作ろう」スレから 生まれた UTAU。総合スレが
//   アンチ・荒らしに 荒らされ（7/18〜20）、住人は「おんJボカロ作り避難所」へ 移った（おんJwiki の 抜粋。本文は 未確認）。
//   公式の 設定：語尾「アル」・常識人・麻婆豆腐・体重 0・かつら。歌「アルアル・ナイナイ」の「常識は（アル！）
//   モラルは（ナイ！）」。→ 避難所に 忘れ物（原音設定＝UTAU の oto.ini）。体重 0 だから 壁も 抜けられる。
// ゼロ：公式サイトに 音源の 欄が ない（キャッチは「ゼロから生まれる無限の歌声」）。企画主が 声の 提供者に
//   逃げられた（おーぷん2ch の 過去スレ。調べでは 本文を 読めて いない）。メインさんは 人と 仲よく したいが
//   空回り、サブ機とは web会議で メンテナンス しあう、誕生日は 7月0日（公式）。
//   → 声を さがして 深い 階へ。沈んで いた 声は だれの 声でも なかったが、声が なくても いっしょに 行ける。

import type { QuestHero } from "../engine/heroes";
import type { Speaker } from "./quotes";

export type QuestLine =
	| { who: Speaker; text: string }
	| { who: null; text: string }
	| { who: "kiriko"; text: string };

const say = (who: Speaker, text: string): QuestLine => ({ who, text });
const nar = (text: string): QuestLine => ({ who: null, text });
const think = (text: string): QuestLine => ({ who: "kiriko", text });

export type HeroQuestText = {
	/** 悩み（引き受ける か 聞く 前）。 */
	worry: readonly QuestLine[];
	/** 選ぶ ボタン（9字まで）。 */
	menu: readonly [string, string];
	/** 引き受けた。 */
	accept: readonly QuestLine[];
	/** また 今度。 */
	decline: readonly QuestLine[];
	/** 引き受けた あと、まだ はたして いない。 */
	waiting: readonly QuestLine[];
	/** はたして 帰った あと：本人から 申し出（このあと 冒険に 出られる）。 */
	offer: readonly QuestLine[];
	/** 出られる ように なった 知らせ。 */
	unlocked: string;
};

export const HERO_QUESTS: Record<QuestHero, HeroQuestText> = {
	roze: {
		worry: [
			say("roze", "……キリコ、ちょっと　いいアル？\n昔の　話アル"),
			say("roze", "わたし、おんJの　安価で\n生まれた　ボカロアル"),
			say(
				"roze",
				"でも　総合スレが　荒らしに\n蹂躙されて、……住めなく　なったアル",
			),
			say("roze", "みんなで　避難所へ　逃げたアル。\n「ボカロ作り避難所」アル"),
			say(
				"roze",
				"あわてて　原音設定を　置いてきたアル。\n声の　大事な　設定アル",
			),
			say(
				"roze",
				"荒らしの　においが　まだ　して、\n……ひとりでは　行けないアル",
			),
		],
		menu: ["引き受ける", "また　今度"],
		accept: [
			think("（……とってくるンゴ）"),
			say("roze", "ありがとうアル。避難所は\nきのこ板の　先の　テントアル"),
			say(
				"roze",
				"いちばん　奥に　あるはずアル。\n……文字化けに　気を　つけるアル",
			),
		],
		decline: [say("roze", "……そうアル。\n常識的に、むりは　しないアル")],
		waiting: [
			say("roze", "ボカロ作り避難所は　きのこ板の\n先アル。……いちばん　奥アル"),
		],
		offer: [
			say(
				"roze",
				"原音設定、ほんとうに　ありがとうアル。\n……「あ」が、ちゃんと　出るアル",
			),
			say(
				"roze",
				"避難所の　ころ、荒らしが　来ると\n壁の　すきまに　隠れたアル",
			),
			say("roze", "わたし、体重は　ナイアル。\nだから　壁も　抜けられるアル"),
			say(
				"roze",
				"常識人として、今度から\n探索　手伝うアル。……モラルも　アルアル",
			),
		],
		unlocked:
			"ロゼが　冒険に　出られる　ように　なった！\n行き先を　決める　ときに　切りかえられる。",
	},
	zero: {
		worry: [
			say("zero", "キリコさん。……ひとつ、\n相談しても　いいですか"),
			say(
				"zero",
				"わたし、声が　ないんです。\n村の　読み上げも、わたしだけ　だまります",
			),
			say(
				"zero",
				"企画の　人が、声の　人に　逃げられて。\n……音源が　ないまま、生まれました",
			),
			say(
				"zero",
				"「ゼロから　生まれる　無限の　歌声」。\n……公式には、そう　書いて　あります",
			),
			say(
				"zero",
				"深い　階には、行き場の　ない\n声が　沈んで　いると　聞きました",
			),
			say(
				"zero",
				"その　声、聞いて　みたいんです。\n……わたしの　声が　あるかも",
			),
		],
		menu: ["引き受ける", "また　今度"],
		accept: [
			think("（……蓄音機で　聞いてくるンゴ）"),
			say("zero", "ありがとう　ございます！\nどの　板でも、8階より　下です"),
			say(
				"zero",
				"……帰ってきて　くださいね。\nおかえりの　練習、して　おきます",
			),
		],
		decline: [say("zero", "了解です。\n……また、聞いて　ください")],
		waiting: [say("zero", "8階より　下の　声……。\nどの　板でも　かまいません")],
		offer: [
			nar("キリコは　蓄音機を　回した。\n深い　階で　録れた　ざわめき。"),
			nar("……だれの　声でも　なかった。\nゼロは、目を　とじて　聞いていた。"),
			say("zero", "……わたしの　声じゃ　なかったです。\nでも、きれいでした"),
			say(
				"zero",
				"声が　なくても、わたし　いっしょに\n行けます。サブ機と　交代で",
			),
			say(
				"zero",
				"わたしが　たおれても、プロト、\nレンが　つづけます。……3体です",
			),
			say(
				"zero",
				"サブ機も　web会議で　待機中です。\n……空回り　しないように、がんばります",
			),
			say(
				"zero",
				"今度から、探索を　手伝わせて　ください。\n……声は、そのうち　です",
			),
		],
		unlocked:
			"ゼロが　冒険に　出られる　ように　なった！\n行き先を　決める　ときに　切りかえられる。",
	},
};
