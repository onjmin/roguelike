// 朝の　スレ小説（喫茶「保守」の テレビ）。作りかけ（draft）：番組表には まだ 出さない。
// 日：月〜土は 本放送、日曜は 1週間の まとめ（再放送）。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyoAsadoraTv.ts。
import { draftScript, type JkPack, liveOr, onWeekdays } from "./pack";

/** 場面の 鍵（TV が 描く）。 */
export const ASADORA_SCENES = ["card"] as const;

/** 朝の　スレ小説。 */
export const ASADORA_PACK: JkPack = {
	script: draftScript("asadora", "cafe", "【実況】朝のスレ小説　Part{n}"),
	venue: "cafe",
	from: 5,
	menu: "朝のスレ小説",
	slot: liveOr(onWeekdays(1, 2, 3, 4, 5, 6)),
	draft: true,
	scenes: ASADORA_SCENES,
};
