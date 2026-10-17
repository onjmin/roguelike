// 束音（たばね）ロゼ・解音（ときね）ゼロが 仲間に なる 話（持ちかけ → キリコが 受ける → はたす →
// 本人から 申し出る → 冒険に 出られる。engine/heroes.ts・ui/village/villageEvents.ts の heroQuestScript）。
// 加入する 仲間は 加入の 前に 対立させ、加入の あとも 内心は ライバル（STORY.md §4.9 の ライバル）。ゼロは 挑戦（手合わせ）。
// 村の 窓は 22字×2行（src/sim/heroTests.ts が 測る）。キリコの 独白は （　）つき・「ンゴ」。
// 書き方：わけを 本人に 説明させない。ようすを 見せ、言いかけて やめる（調べた 下敷きは 背景に 置く）。
// 決まり（壁抜け・残機）の 説明は 全体マップの 札（ui/village/worldMap.ts）に まかせる。
//
// 下敷き（実在の 人の 名前は 出さない。本文を 読んで 史実に 寄せる：作者の 指示）：
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
//   → 足りない 声を ためたくて キリコの 蓄音機を ねらい、深い 階で 3機で 待ちぶせる（core/ambush.ts）。負けて
//   聞いた 深い 階の 声は だれの 声でも なかった。負けは 認めない まま、キリコの 負けを 数えに ついてくる。

import type { Cue } from "../../engine/emote";
import type { QuestHero } from "../../engine/heroes";
import type { Speaker } from "../story/quotes";

/**
 * 話す 人の 行は 感情の 記号・体の 動き（Cue。engine/emote.ts）も 持てる。
 * bgm は その 行から 鳴らす 曲（data/audio/bgm.ts の 名前。null で 止める。場面の あとは 村の 曲に もどす）。
 */
export type QuestLine = (
	| ({ who: Speaker; text: string } & Cue)
	| { who: null; text: string }
	| ({ who: "kiriko"; text: string } & Cue)
) & { bgm?: string | null };

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
		hint: "ロゼが店先で古いスレを読んでいる。\n……ときどき、ため息。",
		worry: [
			say("roze", "……あ、キリコ。\nなんでもないアル", { emote: "汗" }),
			nar("画面には古いスレ。「安価で\nおんJ発のボカロキャラを作ろう」"),
			say("roze", "わたし、ここで生まれたアル。\n7月1日。……2号機アル"),
			say("roze", "声は2回録ったアル。\n……2回とも、消えたアル", {
				gesture: "slump",
			}),
			say(
				"roze",
				"さいごは避難所で、声を\n直してたアル。……みんな、来なくなったアル",
			),
			say(
				"roze",
				"あそこに原音設定、置きっぱなしアル。\n……それから「あ」がずれてるアル",
			),
			say("roze", "取りに行けばいいアル。\n……わかってるアル"),
		],
		menu: ["取ってくる", "そっとしておく"],
		accept: [
			kiriko("……行ってくるンゴ", { gesture: "nod" }),
			say("roze", "……北東の島アル。\nおんJボカロ作り避難所アル"),
			say("roze", "文字化けがうろついてるアル。\n……気をつけるアル"),
		],
		decline: [say("roze", "……常識アル。\nだれだって、そうするアル")],
		waiting: [say("roze", "……北東の島の小屋、\nまだあったアル？")],
		offer: [
			// 曲を 止めて、ずれて いない「あ」を 聞かせる
			{ ...say("roze", "……あ。\nあー。あ、あ", { emote: "♪" }), bgm: null },
			say("roze", "ずれてないアル。……ふふ", { emote: "花" }),
			say(
				"roze",
				"スレはみんな完走したアル。\n……次スレは、だれも立てなかったアル",
			),
			say("roze", "でも外で、知らない人が\nわたしで歌を作ってくれたアル"),
			say("roze", "わたしはまだ、ここにアルアル。\n……体重はナイけど", {
				gesture: "spin",
			}),
			say("roze", "体重ナイから、壁もすり抜けられるアル。\n……常識アル"),
			say("roze", "今度下へ行くとき、\nわたしも連れていくアル"),
		],
		unlocked: "ロゼと冒険に出られるようになった。",
		synopsis: {
			asked: "ロゼが自分の生まれた安価スレを読み返して、ため息をついている。",
			accepted:
				"ロゼの忘れ物（直しかけの原音設定）を取りにいく。北東の島のボカロ作り避難所のいちばん奥。",
			done: "原音設定をとどけた。ロゼがなにか言いたそうにしている。",
			unlocked: "ロゼが冒険に加わった。行き先を決めるときに切りかえられる。",
		},
	},
	zero: {
		hint: "ゼロが広場で、キリコの蓄音機を\nじっと数えている。",
		worry: [
			say("zero", "キリコさん！その蓄音機、\n声がためられるんですよね", {
				emote: "!",
				gesture: "startle",
			}),
			say("zero", "わたし、ロゼさんの反対に\n作られたんです。黒髪は金髪に"),
			say("zero", "声は、録りはじめて4分の1で\n止まったままなんです"),
			say("zero", "その蓄音機があれば、のこりの\n4分の3がためられます"),
			say("zero", "なので、勝負です！\n3機で、いただきにいきます", {
				gesture: "hop",
			}),
		],
		menu: ["受けて立つ", "ことわる"],
		accept: [
			kiriko("……受けて立つンゴ", { gesture: "nod" }),
			say("zero", "深い階で待ってます！\n……3機で、先回りして", { emote: "!" }),
			say("zero", "勝ったら、蓄音機はゼロの\nものです。……数えましたから"),
		],
		decline: [
			say("zero", "……逃げた回数、\n1と数えておきます", { gesture: "slump" }),
		],
		waiting: [say("zero", "深い階で、3機で待ってます。\n……いつでもどうぞ")],
		offer: [
			// 勝った 階で 録った ざわめきを 聞かせる（掘りかけの穴。小さな 行進で 加わる 決意へ）
			{ ...nar("蓄音機を回した。\n深い階のざわめき。"), bgm: "deep1" },
			nar("……だれの声でもなかった。"),
			say("zero", "…………", { emote: "…" }),
			say("zero", "……わたしの声じゃ、\nないですね"),
			say("zero", "名前の投票で、イッチさんは\n「ユリ」に入れたんですって"),
			say("zero", "でも、ゼロになりました。\n……ゼロから数える名前です"),
			say("zero", "負けは1つ。……でも、\nゼロはまだ認めてません", {
				emote: "汗",
			}),
			say("zero", "次からいっしょに潜って、\nキリコさんの負けを数えます！", {
				gesture: "nod",
			}),
		],
		unlocked: "ゼロと冒険に出られるようになった。",
		synopsis: {
			asked:
				"ゼロが蓄音機をねらって、3機で勝負を挑んできた。声は4分の1で止まったまま。",
			accepted:
				"ゼロの挑戦を受けた。深い階（風呂板なら8階）で、3機が待ちぶせている。",
			done: "ゼロの3機をそろって止めた。ゼロがなにか言いたそうにしている。",
			unlocked: "ゼロが冒険に加わった。……負けは、まだ認めていない。",
		},
	},
};
