// 束音（たばね）ロゼ・解音（ときね）ゼロの 依頼（悩み → キリコが 引き受ける → 依頼を はたす →
// 本人から 探索を 手伝うと 申し出る → 冒険に 出られる。engine/heroes.ts・ui/villageEvents.ts の heroQuestScript）。
// 村の 窓は 22字×2行（src/sim/heroTests.ts が 測る）。キリコの 独白は （　）つき・「ンゴ」。
// 書き方：わけを 本人に 説明させない。ようすを 見せ、言いかけて やめる（調べた 下敷きは 背景に 置く）。
// 決まり（壁抜け・残機）の 説明は 全体マップの 札（ui/worldMap.ts）に まかせる。
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
	/** 悩みを かかえた 帰りに 村で 見える ようす（地の文。話しかけると 打ち明ける）。 */
	hint: string;
	/** 悩み（引き受ける か 聞く 前）。 */
	worry: readonly QuestLine[];
	/** 選ぶ ボタン（9字まで）。 */
	menu: readonly [string, string];
	/** 引き受けた。 */
	accept: readonly QuestLine[];
	/** そっとしておく（悩みは そのまま。また 話しかけると 打ち明ける）。 */
	decline: readonly QuestLine[];
	/** 引き受けた あと、まだ はたして いない。 */
	waiting: readonly QuestLine[];
	/** はたして 帰った あと：本人から 申し出（このあと 冒険に 出られる）。 */
	offer: readonly QuestLine[];
	/** 出られる ように なった 知らせ。 */
	unlocked: string;
	/** あらすじの 1行（data/synopsis.ts。進み具合ごと。悩む 前は 出さない）。 */
	synopsis: {
		asked: string;
		accepted: string;
		done: string;
		unlocked: string;
	};
};

export const HERO_QUESTS: Record<QuestHero, HeroQuestText> = {
	roze: {
		hint: "ロゼが　店先で　古い　スレを　読んでいる。\n……ときどき、ため息。",
		worry: [
			say("roze", "……あ、キリコ。\nなんでも　ないアル"),
			nar("画面には　荒れた　スレ。\n「総合スレ8」の　文字。"),
			say(
				"roze",
				"昔　住んでた　とこアル。\n……荒らしが　来て、みんなで　逃げたアル",
			),
			say(
				"roze",
				"逃げた　先に、原音設定　置いてきたアル。\n……それから　「あ」が　ずれてるアル",
			),
			say("roze", "取りに　行けば　いいアル。\n……わかってるアル"),
		],
		menu: ["取ってくる", "そっとしておく"],
		accept: [
			think("（……行ってくるンゴ）"),
			say("roze", "……北東の　島アル。\n桃色の　屋根の　小屋アル"),
			say("roze", "文字化けが　うろついてるアル。\n……気を　つけるアル"),
		],
		decline: [say("roze", "……常識アル。\nだれだって、そうするアル")],
		waiting: [say("roze", "……北東の　島の　小屋、\nまだ　あったアル？")],
		offer: [
			say("roze", "……あ。\nあー。あ、あ"),
			say("roze", "ずれてないアル。……ふふ"),
			say("roze", "あのころ、荒らしが　来ると\n壁の　すきまに　隠れてたアル"),
			say("roze", "体重　ナイから、すり抜けられるアル。\n……常識アル"),
			say("roze", "今度　下へ　行くとき、\nわたしも　連れていくアル"),
		],
		unlocked: "ロゼと　冒険に　出られる　ように　なった。",
		synopsis: {
			asked: "ロゼが　古い　スレを　読んで、ため息を　ついている。",
			accepted:
				"ロゼの　忘れ物を　取りに　いく。北東の　島の　桃色の　屋根、ボカロ作り避難所の　いちばん　奥。",
			done: "原音設定を　とどけた。ロゼが　なにか　言いたそうに　している。",
			unlocked:
				"ロゼが　冒険に　加わった。行き先を　決める　ときに　切りかえられる。",
		},
	},
	zero: {
		hint: "ゼロが　広場で　口を　ぱくぱく　させている。\n……声は　出ていない。",
		worry: [
			say("zero", "あ、キリコさん！\n……見てました？"),
			say("zero", "歌の　練習です。\n……音、出ないんですけど"),
			say(
				"zero",
				"わたしの　声、来る　はずの　人が\n来なかったんです。……それきりで",
			),
			say(
				"zero",
				"深い　スレの　底には、行き場の　ない\n声が　たまってるって　聞いて",
			),
			say("zero", "……ひとつくらい、\nわたしに　合う　声、ないかなって"),
		],
		menu: ["聞いてくる", "そっとしておく"],
		accept: [
			think("（……蓄音機、持っていくンゴ）"),
			say("zero", "ほんとですか！\n……8階くらいまで、行けば"),
			say("zero", "おかえりの　練習、して　おきます。\n……声なしで"),
		],
		decline: [say("zero", "……ですよね。\nわすれて　ください")],
		waiting: [say("zero", "深い　階の　声……。\n……あ、いえ、急ぎません")],
		offer: [
			nar("蓄音機を　回した。\n深い　階の　ざわめき。"),
			nar("……だれの　声でも　なかった。"),
			say("zero", "…………"),
			say("zero", "きれいでした。\nわたしのじゃ、ないですけど"),
			say(
				"zero",
				"でも、わかりました。\n声が　なくても、行ける　とこは　あるって",
			),
			say(
				"zero",
				"わたしが　たおれても、プロトと\nレンが　いますから。……次は、いっしょに",
			),
		],
		unlocked: "ゼロと　冒険に　出られる　ように　なった。",
		synopsis: {
			asked: "ゼロが　広場で、声の　出ない　歌を　練習している。",
			accepted:
				"ゼロの　ために、深い　階の　声を　聞きに　いく。どの　板でも、8階まで　行って　帰る。",
			done: "深い　階の　声を　録って　帰った。ゼロに　聞かせよう。",
			unlocked:
				"ゼロが　冒険に　加わった。たおれても　プロト・レンが　つづける。",
		},
	},
};
