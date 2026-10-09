// 皆既月食　観察部（保守中央公園の ベンチ（空を 見上げる））。作りかけ（draft）：番組表には まだ 出さない。
// 日：毎月 15日（満月）は 本番、ほかの 日は 前の 月食の 過去ログ。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyoGesshokuTv.ts。
import { draftScript, type JkPack, liveOr } from "./pack";

/** 場面の 鍵（TV が 描く）。 */
export const GESSHOKU_SCENES = ["card"] as const;

/** 皆既月食　観察部。 */
export const GESSHOKU_PACK: JkPack = {
	script: draftScript("gesshoku", "park", "おんJ皆既月食観察部★{n}"),
	venue: "park",
	from: 7,
	menu: "皆既月食",
	slot: liveOr((t) => t.d === 15),
	draft: true,
	scenes: GESSHOKU_SCENES,
};
