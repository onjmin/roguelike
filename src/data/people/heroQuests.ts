// 束音（たばね）ロゼ・解音（ときね）ゼロの 依頼（悩み → キリコが 引き受ける → 依頼を はたす →
// 本人から 探索を 手伝うと 申し出る → 冒険に 出られる。engine/heroes.ts・ui/village/villageEvents.ts の heroQuestScript）。
// 村の 窓は 22字×2行（src/sim/heroTests.ts が 測る）。キリコの 独白は （　）つき・「ンゴ」。
// 書き方：わけを 本人に 説明させない。ようすを 見せ、言いかけて やめる（調べた 下敷きは 背景に 置く）。
// 決まり（壁抜け・残機）の 説明は 全体マップの 札（ui/village/worldMap.ts）に まかせる。
//
// 下敷き（実在の 人の 名前は 出さない。2026-10-13 に 本文を 読んで 史実に 寄せた：作者の 指示）：
// ロゼ：おんJwiki（3代目）pages/641。2024年7月1日の 安価スレ「安価でおんJ発のボカロキャラを作ろう」で 2号機と
//   して 生まれた UTAU（1号機は 別の キャラ）。声は 同人声優が 2回 録ったが、7/17 に 企画者が「原音設定してる
//   時に」発狂して 全削除。総合スレは 荒らされ、本家・分家に 割れ、どちらも 完走して 次スレは 立たなかった。
//   11月、活動は おーぷぬの「おんJボカロ作り避難所」へ 移り、声質の 改善を 話していたが 月末には 人が 消えた。
//   年末に 外の 動画で 知られ、知らない 人たちが ロゼで 曲を 作った（有名曲への カメオ出演も）。
//   公式の 設定：語尾「アル」・常識人・麻婆豆腐・体重 0・かつら。歌「アルアル・ナイナイ」。
//   → 避難所に 置きっぱなしの 原音設定（UTAU の oto.ini）。体重 0 だから 壁も 抜けられる。
// ゼロ：なんでも実況U「解音ゼロのスレ」（2025/01/05）。ロゼの 特徴を 反転して 作った（黒髪→薄い 金髪・
//   中華→和風・かつら→髪 多め）、「ロゼを 広める ために AIから 作られた アンドロイド」。名前は「解音ユリ」との
//   投票で ゼロに（イッチは ユリに 入れた）。誕生日 7月0日。キャッチ「ゼロから生まれる無限の歌声」。声は
//   ボイスネキの 収録を「4分の1くらい もらってる」ところで 止まった。メイン機と サブ機は web会議で メンテナンスしあう。
//   → 足りない 声を さがして 深い 階へ。沈んで いた 声は だれの 声でも なかったが、声が なくても いっしょに 行ける。

import type { Cue } from "../../engine/emote";
import type { QuestHero } from "../../engine/heroes";
import type { Speaker } from "../story/quotes";

/** 話す 人の 行は 感情の 記号・体の 動き（Cue。engine/emote.ts）も 持てる。 */
export type QuestLine =
	| ({ who: Speaker; text: string } & Cue)
	| { who: null; text: string }
	| ({ who: "kiriko"; text: string } & Cue);

const say = (who: Speaker, text: string, c?: Cue): QuestLine => ({
	who,
	text,
	...c,
});
const nar = (text: string): QuestLine => ({ who: null, text });
const kiriko = (text: string, c?: Cue): QuestLine => ({
	who: "kiriko",
	text,
	...c,
});

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
	/** あらすじの 1行（data/story/synopsis.ts。進み具合ごと。悩む 前は 出さない）。 */
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
			say("roze", "……あ、キリコ。\nなんでも　ないアル", { emote: "汗" }),
			nar(
				"画面には　古い　スレ。「安価で\nおんJ発の　ボカロキャラを　作ろう」",
			),
			say("roze", "わたし、ここで　生まれたアル。\n7月1日。……2号機アル"),
			say("roze", "声は　2回　録ったアル。\n……2回とも、消えたアル", {
				gesture: "slump",
			}),
			say(
				"roze",
				"さいごは　避難所で、声を\n直してたアル。……みんな、来なく　なったアル",
			),
			say(
				"roze",
				"あそこに　原音設定、置きっぱなしアル。\n……それから「あ」が　ずれてるアル",
			),
			say("roze", "取りに　行けば　いいアル。\n……わかってるアル"),
		],
		menu: ["取ってくる", "そっとしておく"],
		accept: [
			kiriko("……行ってくるンゴ", { gesture: "nod" }),
			say("roze", "……北東の　島アル。\nおんJボカロ作り避難所アル"),
			say("roze", "文字化けが　うろついてるアル。\n……気を　つけるアル"),
		],
		decline: [say("roze", "……常識アル。\nだれだって、そうするアル")],
		waiting: [say("roze", "……北東の　島の　小屋、\nまだ　あったアル？")],
		offer: [
			say("roze", "……あ。\nあー。あ、あ", { emote: "♪" }),
			say("roze", "ずれてないアル。……ふふ", { emote: "花" }),
			say(
				"roze",
				"スレは　みんな　完走したアル。\n……次スレは、だれも　立てなかったアル",
			),
			say(
				"roze",
				"でも　外で、知らない　人が\nわたしで　歌を　作ってくれたアル",
			),
			say("roze", "わたしは　まだ、ここに　アルアル。\n……体重は　ナイけど", {
				gesture: "spin",
			}),
			say("roze", "体重　ナイから、壁も　すり抜けられるアル。\n……常識アル"),
			say("roze", "今度　下へ　行くとき、\nわたしも　連れていくアル"),
		],
		unlocked: "ロゼと　冒険に　出られる　ように　なった。",
		synopsis: {
			asked:
				"ロゼが　自分の　生まれた　安価スレを　読み返して、ため息を　ついている。",
			accepted:
				"ロゼの　忘れ物（直しかけの　原音設定）を　取りに　いく。北東の　島の　ボカロ作り避難所の　いちばん　奥。",
			done: "原音設定を　とどけた。ロゼが　なにか　言いたそうに　している。",
			unlocked:
				"ロゼが　冒険に　加わった。行き先を　決める　ときに　切りかえられる。",
		},
	},
	zero: {
		hint: "ゼロが　広場で　口を　ぱくぱく　させている。\n……声は　出ていない。",
		worry: [
			say("zero", "あ、キリコさん！\n……見てました？", {
				emote: "汗",
				gesture: "startle",
			}),
			say("zero", "歌の　練習です。\n……音、出ないんですけど"),
			say("zero", "わたし、ロゼさんの　反対に\n作られたんです。黒髪は　金髪に"),
			say("zero", "声は、録りはじめて　4分の1で\n止まったまま　なんです"),
			say(
				"zero",
				"深い　スレの　底には、行き場の　ない\n声が　たまってるって　聞いて",
			),
			say("zero", "……のこりの　4分の3、\nどこかに　ないかなって"),
		],
		menu: ["聞いてくる", "そっとしておく"],
		accept: [
			kiriko("……蓄音機、持っていくンゴ", { gesture: "nod" }),
			say("zero", "ほんとですか！\n……8階くらいまで、行けば", {
				emote: "!",
				gesture: "hop",
			}),
			say("zero", "おかえりの　練習、して　おきます。\n……声なしで"),
		],
		decline: [
			say("zero", "……ですよね。\nわすれて　ください", { gesture: "slump" }),
		],
		waiting: [say("zero", "深い　階の　声……。\n……あ、いえ、急ぎません")],
		offer: [
			nar("蓄音機を　回した。\n深い　階の　ざわめき。"),
			nar("……だれの　声でも　なかった。"),
			say("zero", "…………", { emote: "…" }),
			say("zero", "きれいでした。\nわたしのじゃ、ないですけど"),
			say("zero", "名前の　投票で、イッチさんは\n「ユリ」に　入れたんですって"),
			say("zero", "でも、ゼロに　なりました。\n……ゼロから　始める　名前です"),
			say("zero", "声が　4分の1でも、\n行ける　とこは　あるって　わかりました"),
			say(
				"zero",
				"わたしが　たおれても、プロトと\nレンが　いますから。……次は、いっしょに",
				{ gesture: "nod" },
			),
		],
		unlocked: "ゼロと　冒険に　出られる　ように　なった。",
		synopsis: {
			asked:
				"ゼロが　広場で、声の　出ない　歌を　練習している。声は　4分の1で　止まったまま。",
			accepted:
				"ゼロの　足りない　声を　さがしに、深い　階へ。どの　板でも、8階まで　行って　帰る。",
			done: "深い　階の　声を　録って　帰った。ゼロに　聞かせよう。",
			unlocked:
				"ゼロが　冒険に　加わった。たおれても　プロト・レンが　つづける。",
		},
	},
};
