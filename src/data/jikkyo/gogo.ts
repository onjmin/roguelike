// 午後の　B級映画（映画館「スクリーン1000」の 昼の部）。作りかけ（draft）：番組表には まだ 出さない。
// 日：月〜金は 昼の部の 本上映、土日は 再上映。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyoGogoTv.ts。
import { draftScript, type JkPack, liveOr, onWeekdays } from "./pack";

/** 場面の 鍵（TV が 描く）。 */
export const GOGO_SCENES = ["card"] as const;

/** 午後の　B級映画。 */
export const GOGO_PACK: JkPack = {
	script: draftScript("gogo", "cinema", "【実況】午後の　B級映画★{n}"),
	venue: "cinema",
	from: 7,
	menu: "昼の部",
	slot: liveOr(onWeekdays(1, 2, 3, 4, 5)),
	draft: true,
	scenes: GOGO_SCENES,
};
