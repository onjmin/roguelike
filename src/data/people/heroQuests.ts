// 束音（たばね）ロゼ・解音（ときね）ゼロが 仲間に なる 話（持ちかけ → キリコが 受ける → はたす →
// 本人から 申し出る → 冒険に 出られる。engine/heroes.ts・ui/village/villageEvents.ts の heroQuestScript）。
// 加入する 仲間は 加入の 前に 対立させ、加入の あとも 内心は ライバル（STORY.md §4.9 の ライバル）。ロゼは 競争（core/race.ts）、
// ゼロは 挑戦（手合わせ）。
// 村の 窓は 22字×2行（src/sim/heroTests.ts が 測る）。キリコの 独白は （　）つき・「ンゴ」。
// 書き方：わけを 本人に 説明させない。ようすを 見せ、大声で 張り合わせて ボケを 大きく する（しんみり させない。
// 調べた 下敷きは 背景に 置く）。
// 決まり（壁抜け・残機）の 説明は 全体マップの 札（ui/village/worldMap.ts）に まかせる。
//
// 下敷き（実在の 人の 名前は 出さない。本文を 読んで 史実に 寄せる：作者の 指示）：
// ロゼ：おんJwiki（3代目）pages/641。2024年7月1日の 安価スレ「安価でおんJ発のボカロキャラを作ろう」で 2号機と
//   して 生まれた UTAU（1号機は 別の キャラ）。声は 同人声優が 2回 録ったが、7/17 に 企画者が「原音設定してる
//   時に」発狂して 全削除。総合スレは 荒らされ、本家・分家に 割れ、どちらも 完走して 次スレは 立たなかった。
//   11月、活動は おーぷぬの「おんJボカロ作り避難所」へ 移り、声質の 改善を 話していたが 月末には 人が 消えた。
//   年末に 外の 動画で 知られ、知らない 人たちが ロゼで 曲を 作った（有名曲への カメオ出演も）。
//   公式の 設定：語尾「アル」・常識人・麻婆豆腐・体重 0・かつら。歌「アルアル・ナイナイ」。
//   → 倒れて ばかりの キリコを 非常識と 見て、むかしの 避難所の 奥まで 競争を 挑む。壁を 抜けて 先に 着くが、
//   置きっぱなしの 原音設定（UTAU の oto.ini）は 体重 0 で 持ち上がらない。キリコが 運び、勝ち負けは うやむや。
// ゼロ：なんでも実況U「解音ゼロのスレ」（2025/01/05）。ロゼの 特徴を 反転して 作った（黒髪→薄い 金髪・
//   中華→和風・かつら→髪 多め）、「ロゼを 広める ために AIから 作られた アンドロイド」。名前は「解音ユリ」との
//   投票で ゼロに（イッチは ユリに 入れた）。誕生日 7月0日。キャッチ「ゼロから生まれる無限の歌声」。声は
//   ボイスネキの 収録を「4分の1くらい もらってる」ところで 止まった。メイン機と サブ機は web会議で メンテナンスしあう。
//   → 足りない 声を ためたくて キリコの 蓄音機を ねらい、深い 階で 3機で 待ちぶせる（core/ambush.ts）。負けて
//   聞いた 録音は ぜんぶ キリコの「ンゴ」。3機で 流して 4分の12と 言い張り、負けは 1機あたり 0.33敗と 割って、
//   交代で 潜る 側に 回る。
// 2人の 笑いの 形は 分ける：ロゼは 運ばれた 距離（本当の 倒れた 回数 × 4.2キロ）、ゼロは 割り算（4分の1・0.33敗）。

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
) & {
	bgm?: string | null;
	/** まだ 1回も 倒れて いない ときの 文（text の {n}・{km} が 0 に なる 行だけ）。 */
	none?: string;
};

/** 運ばれて 村まで もどる 道のり（キロ。ロゼの 数える 距離）。 */
export const CARRY_KM = 4.2;

/**
 * 行の 文（{n}＝これまで 倒れて 運ばれた 回数、{km}＝のべの 距離。0 回なら none）。
 * 見える 状態と 合わせる：数は engine/save.ts の deathCount。
 */
export const questText = (l: QuestLine, deaths: number): string =>
	(deaths === 0 && l.none ? l.none : l.text)
		.replaceAll("{n}", String(deaths))
		.replaceAll("{km}", (deaths * CARRY_KM).toFixed(1));

const say = (who: Speaker, text: string, c?: Cue): QuestLine => ({
	who,
	text,
	...c,
});
/** 倒れた 回数で かわる 行（0 回なら none）。 */
const sayN = (
	who: Speaker,
	text: string,
	none: string,
	c?: Cue,
): QuestLine => ({
	who,
	text,
	none,
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
		hint: "ロゼが店先で、そろばんを\nはじいている。",
		worry: [
			sayN(
				"roze",
				"キリコ。運ばれてきた回数、\n通算{n}回アル",
				"キリコ。まだ1回も運ばれて\nないアル？……あやしいアル",
				{ emote: "怒" },
			),
			sayN(
				"roze",
				"1回で村まで4.2キロアル。\nのべ{km}キロ運ばれてるアル",
				"常識なら、もう3回は\n運ばれてるころアル",
			),
			kiriko("数えないでほしいンゴ！", { gesture: "shake" }),
			// 賞品は ロゼ自身の 原音設定（取り戻したいとは 言わない。加入の「ずれてないアル」の 前振り）
			say("roze", "北東の避難所の奥に、わたしの\n原音設定が置いてあるアル"),
			say("roze", "先に手に取ったほうが常識アル。\n競争アル", {
				gesture: "startle",
			}),
			kiriko("自分の忘れ物を\n賭けるンゴ？", { emote: "?" }),
			say(
				"roze",
				"忘れ物じゃないアル、賞品アル。\nないと「あ」が半音ずれるだけアル",
				{
					emote: "汗",
				},
			),
		],
		menu: ["受けて立つ", "ことわる"],
		accept: [
			kiriko("常識で勝つンゴ！", { gesture: "nod" }),
			say("roze", "わたしは壁をすり抜けるアル！\nハンデは4.2キロアル！"),
		],
		decline: [
			say("roze", "逃げるのも常識アル！\nわたしの不戦勝アル！", {
				gesture: "shake",
			}),
		],
		waiting: [say("roze", "北東の島の避難所アル！\n先に取ったほうが常識アル")],
		offer: [
			// 曲を 止めて、ずれて いない「あ」を 大声で 試す。声は 村を こえて 隣の 板まで 届く
			// （勝ち負けは 帰った ときの 場面で うやむや）
			{ ...say("roze", "あ。\nあー！あ、あ！", { emote: "♪" }), bgm: null },
			say("roze", "ずれてないアル！キリコの\n「ンゴ」より、いい「あ」アル！", {
				emote: "♪",
			}),
			nar("ロゼの「あ」は村をこえ、\n隣の板の窓ガラスを割った。"),
			kiriko("音量の常識が\nないンゴ！", { emote: "汗" }),
			// 潜るのは 交代（主人公を 切りかえる。キリコは 村に 残る）
			say("roze", "次からはわたしが潜るアル。\nキリコは村で運ばれる練習アル", {
				gesture: "spin",
			}),
		],
		unlocked: "ロゼと冒険に出られるようになった。",
		synopsis: {
			asked:
				"倒れてばかりのキリコを非常識と見て、ロゼが競争を挑んできた。賞品はロゼの原音設定。",
			accepted:
				"ロゼと競争。北東の島のボカロ作り避難所の奥の原音設定を、先に手に取ったほうが勝ち。",
			done: "先に着いたロゼの横から、原音設定を取って帰った。勝ち負けは、うやむや。",
			unlocked: "ロゼが冒険に加わった。勝ち負けは、うやむやのまま。",
		},
	},
	zero: {
		hint: "ゼロが広場で、蓄音機の\n設計図を3枚描いている。",
		worry: [
			say("zero", "キリコさん！その蓄音機、\n声がためられるんですよね", {
				emote: "!",
				gesture: "startle",
			}),
			say("zero", "ゼロの声、録れたのは\n4分の1なんです"),
			say("zero", "のこり4分の3、いただきます。\n……3機で、4分の3ずつです", {
				gesture: "hop",
			}),
			kiriko("計算がおかしいンゴ！", { emote: "!" }),
		],
		// 受けると 3対1 の 待ちぶせ（core/ambush.ts）
		menu: ["3対1は卑怯ンゴ", "ことわる"],
		accept: [
			say("zero", "卑怯でも3機です！\n板の奥の階で待ってます", { emote: "!" }),
			say("zero", "勝ったら蓄音機は、\n1機3分の1ずつです"),
		],
		decline: [
			say("zero", "3機とも、待機モードに\nもどります！3分だけ！", {
				gesture: "slump",
			}),
		],
		waiting: [
			say("zero", "奥の階で、3機で待ってます！\nプロトは、もう寝ました"),
			// 待つ 階は 板ごとに ちがう（core/ambush.ts の ambushFloorsOf。全体マップの 札に 出る）
			say("zero", "浅い板には行きません！\n地図の札に、階を書いておきました"),
		],
		offer: [
			// 待ちぶせの 戦いで ひとりでに 回った 蓄音機（core/ambush.ts の wakeAmbush）を 聞かせる。
			// 録れて いたのは キリコの 声だけ。ゼロは それを 3機で 流して 4分の12に 増やそうと する
			{ ...nar("蓄音機を回した。\n深い階の戦いの音。"), bgm: "deep1" },
			nar("「ンゴ」「ンゴ」「ンゴ」\n「ンゴ」「ンゴ」「ンゴ」！"),
			say("zero", "ぜんぶキリコさんの声です！\n4分の4、キリコさんです！", {
				emote: "汗",
			}),
			say("zero", "これを3機で流せば、\n4分の12キリコさんです！", {
				emote: "!",
			}),
			kiriko("村が吾輩の声で\n埋まるンゴ！", { emote: "汗" }),
			say("zero", "次からはゼロが潜ります！\n4分の4ぶん、ゼロの声をためます", {
				gesture: "nod",
			}),
		],
		unlocked: "ゼロと冒険に出られるようになった。",
		synopsis: {
			asked:
				"ゼロが蓄音機をねらって、3機で勝負を挑んできた。声は4分の1で止まったまま。",
			accepted:
				"ゼロの挑戦を受けた。キリコで潜ると、板の奥の階（風呂板・お祭りなら8階）で3機が待ちぶせている。浅い板には来ない。",
			done: "ゼロの3機をそろって止めた。蓄音機が、なにかを録っていた。",
			unlocked: "ゼロが冒険に加わった。帳簿では、まだ1機0.33敗。",
		},
	},
};
