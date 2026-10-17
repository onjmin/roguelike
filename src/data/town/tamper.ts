// セーブを 書きかえた（engine/tamper.ts が 見つけた）ときの 村の ことば。
// 見つけた 回数で 3段（1回目・2回目・3回目から）。だんだん 口数が へる。
// - TAMPER_SCENE：帰ってきて すぐ、ゼロが 帳簿で 気づき、そばの 仲間が ひとこと（ui/village/villageReturn.ts の tamperScript）。
// - TAMPER_TALK：がっかり している あいだ（engine/tamper.ts の LINGER）、話しかけた ときの ひとこと
//   （ふだんの 新しい話・決まった ひとこと・起動の札・たおれた ときの ひとこと の かわり）。
// - TAMPER_LEDGER：ゼロの 帳簿。TAMPER_MOB：村の 住人の ひそひそ話。

import type { Cue } from "../../engine/emote";
import type { Speaker } from "../story/quotes";
import type { Line } from "../story/story";

/** c は 話す 人の 感情の 記号・体の 動き（engine/emote.ts）。 */
const q = (who: Speaker, text: string, c?: Cue): Line => ({ who, text, ...c });

/** 段（見つけた 回数 1・2・3〜 → 0・1・2）。 */
export const tamperTier = (n: number): number =>
	Math.max(0, Math.min(2, n - 1));

/** 気づく 場面（並びの 順に、村に いる 人から 3人まで）。 */
export const TAMPER_SCENE: readonly (readonly Line[])[] = [
	[
		q("zero", "……あれ？帳簿とセーブが\n合いません。数えなおしても、です", {
			emote: "?",
		}),
		q("shiyo", "数字をいじったわね。\n……あたす、見ないふりはしないわよ", {
			emote: "怒",
		}),
		q("roze", "ズルはばれるアル。\n……麻婆豆腐よりからい話アル"),
		q("feris", "書きかえたの〜？\n……ちょっと、さびしいな〜", {
			gesture: "slump",
		}),
		q("nanj", "なんや、改造かいな。\n……水増しは、一発垢BANやで"),
	],
	[
		q("zero", "また、帳簿が合いません。\n……ゼロ、数えるのがつらいです", {
			gesture: "slump",
		}),
		q("shiyo", "二度目よ。\n……生きてこそ、はそういう意味じゃない"),
		q("roze", "またいじったアル？\n……ロゼ、もう笑えないアル", {
			emote: "…",
		}),
		q("feris", "また〜？\n……私、ageる気分じゃないかも〜"),
		q("nanj", "またやったんか。\n……ワイ、もう何も言わんで", {
			gesture: "shake",
		}),
	],
	[
		q("zero", "帳簿は、もうつけません。\n……つけても、意味がないので"),
		q("shiyo", "……ふんっ。\n好きにすればいいじゃない", { emote: "怒" }),
		q("roze", "……アル", { emote: "…" }),
		q("feris", "…………", { emote: "…" }),
		q("nanj", "……", { emote: "…" }),
	],
];

/** 気づく 場面の しめ（地の文）。 */
export const TAMPER_NARRATION: readonly string[] = [
	"書きかえは、みんなに知られてしまった。\n……どこかで削除人が動きだした",
	"書きかえは、また知られてしまった",
	"だれも、目を合わせてくれない",
];

/** がっかり している あいだの ひとこと（段ごと）。 */
export const TAMPER_TALK: Record<Speaker, readonly string[]> = {
	zero: [
		"帳簿が合わないんです。\n……キリコさん、何か知りませんか",
		"数字は、うそをつきません。\n……ふつうは",
		"……人、数えてません",
	],
	shiyo: [
		"その売り上げ、本物よね？\n……あたす、たしかめるわよ",
		"あなたのことは信じたいの。\n……今はむり",
		"……話しかけないで",
	],
	roze: [
		"今日は麻婆豆腐、なしアル。\n……わけはわかってるアルね？",
		"ロゼ、ズルはきらいアル",
		"……アル",
	],
	feris: [
		"ageるのは、ちゃんと\n書きこんだスレだけだよ〜",
		"私、ちょっと飛んでくるね〜。\n……ひとりで考えたいの",
		"…………",
	],
	nanj: [
		"売り上げってのは、地道に\n1つずつふやすもんやで",
		"ワイは見張っとるだけや。\n……口の前も、キリコも",
		"……",
	],
};

/** ゼロの 帳簿（{points} は 帳簿の 数）。 */
export const TAMPER_LEDGER: readonly string[] = [
	"帳簿には{points}円、とあります。\n……でも、合わないんです",
	"帳簿は{points}円。\n……ほんとうの数は、わかりません",
	"……帳簿は、閉じました",
];

/** 村の 住人の ひそひそ話（段は 見ない。住人ごとに 1つ）。 */
export const TAMPER_MOB: readonly string[] = [
	"チートや、チート……\nキリコが改造したらしいで",
	"削除人がうろついとるらしいな。\n……くわばらくわばら",
	"書きかえはあかんで……\nいや、ワイは何も見とらんけど",
	"帳簿が合わんって、\nゼロがしょんぼりしとったで",
	"……ワイ、目合わせんとこ",
];
