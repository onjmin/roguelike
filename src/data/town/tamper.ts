// セーブを 書きかえた（engine/tamper.ts が 見つけた）ときの 村の ことば。
// 見つけた 回数で 3段（1回目・2回目・3回目から）。騒ぎが 町 → 日本 → 宇宙と 大きく なる（201 の 型）。
// - TAMPER_SCENE：帰ってきて すぐ、ゼロが 帳簿で 気づき、そばの 仲間が ひとこと（ui/village/villageReturn.ts の tamperScript）。
// - TAMPER_TALK：騒ぎの あいだ（engine/tamper.ts の LINGER）、話しかけた ときの ひとこと
//   （ふだんの 新しい話・決まった ひとこと・起動の札・たおれた ときの ひとこと の かわり）。
// - TAMPER_LEDGER：ゼロの 帳簿。TAMPER_MOB：村の 住人の うわさ話。

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
		q("zero", "帳簿とセーブが合いません！\n桁が3つ多いです！", {
			emote: "!",
			gesture: "startle",
		}),
		q("shiyo", "数字いじったわね！？\nあたすの目はごまかせないわよ！", {
			emote: "怒",
		}),
		q("roze", "ズルは非常識アル！\n罰として麻婆豆腐10皿アル！", {
			emote: "怒",
		}),
		q("feris", "書きかえたの〜！？\nageる前に燃えちゃう〜！", {
			gesture: "hop",
		}),
		q("nanj", "改造かいな！\n一発垢BANやで！"),
	],
	[
		q("zero", "また合いません！\nサブ機2機も計算でパンクです！", {
			emote: "汗",
			gesture: "shake",
		}),
		q("shiyo", "二度目よ！？\n倉庫ごと監査してやるわよ！", {
			emote: "怒",
		}),
		q("roze", "またアル！？\n全国ニュースになってるアル！", {
			gesture: "startle",
		}),
		q("feris", "また〜！？\nトレンド1位で燃えてる〜！"),
		q("nanj", "またか！もう日本じゅうに\n知れわたっとるで！", {
			gesture: "shake",
		}),
	],
	[
		q("zero", "帳簿のずれが宇宙まで\n届きました！衛星から苦情です！", {
			emote: "!",
			gesture: "startle",
		}),
		q("shiyo", "三度目！？もう知らない！\n……いや、あたすが直すわよ！", {
			emote: "怒",
		}),
		q("roze", "物理の常識まで\nくずれたアル！", { emote: "汗" }),
		q("feris", "月のスレまで炎上〜！\n私も燃えて飛んでく〜！", {
			gesture: "spin",
		}),
		q("nanj", "改造、宇宙に届く！\n……盛らんでもこれや", {
			emote: "汗",
		}),
	],
];

/** 気づく 場面の しめ（地の文）。 */
export const TAMPER_NARRATION: readonly string[] = [
	"書きかえは、町じゅうにバレた！\nどこかで削除人が動きだした！",
	"書きかえは、日本じゅうにバレた！",
	"書きかえは、宇宙にまでバレた！",
];

/** 騒ぎの あいだの ひとこと（段ごと）。 */
export const TAMPER_TALK: Record<Speaker, readonly string[]> = {
	zero: [
		"帳簿が合わないんです！\nキリコさん、何か知りませんか！？",
		"数字はうそをつきません！\nうそをつくのはセーブです！",
		"帳簿を宇宙に送りました！\n向こうで数えてもらいます！",
	],
	shiyo: [
		"その売り上げ、本物よね？\nあたす、たしかめるわよ！",
		"ずるして勝つなんて、\nあたすの負けより最低よ！",
		"話しかけないで！\n……いま監査中なんだから！",
	],
	roze: [
		"今日は麻婆豆腐なしアル！\nわけはわかってるアルね！",
		"常識十か条に、\n『ズルしない』が足されたアル！",
		"ロゼの霧箱に、\nズルの粒が走ってるアル！",
	],
	feris: [
		"ageるのは、ちゃんと\n書きこんだスレだけだよ〜！",
		"燃えすぎて、私の羽が\n消火器で真っ白だよ〜！",
		"宇宙まで燃えたら〜、\nもう一回生まれるしかない〜！",
	],
	nanj: [
		"売り上げってのは、地道に\n1つずつふやすもんやで！",
		"ワイは見張っとるで！\n帳簿も、キリコもな！",
		"キリコ、宇宙で指名手配や！\n……これは盛ってへんで",
	],
};

/** ゼロの 帳簿（{points} は 帳簿の 数）。 */
export const TAMPER_LEDGER: readonly string[] = [
	"帳簿には{points}円とあります！\nでも合わないんです！",
	"帳簿は{points}円！\n電卓が3台こわれました！",
	"帳簿は宇宙に送りました！\n返事はまだです！",
];

/** 村の 住人の うわさ話（段は 見ない。住人ごとに 1つ）。 */
export const TAMPER_MOB: readonly string[] = [
	"チートや、チート！\nキリコが改造したらしいで！",
	"削除人がうろついとるで！\n3丁目まで消されたらしい！",
	"書きかえはあかんで！\n……ワイは何も見とらんけど！",
	"帳簿が合わんって、\nゼロが電卓を10台割っとったで！",
	"ワイ、目合わせんとこ！\n……あ、合うてもうた！",
];
