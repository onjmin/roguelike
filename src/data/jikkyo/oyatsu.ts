// 保守名人戦　おやつ実況（碁会所「本因坊」の テレビ）。作りかけ（draft）：番組表には まだ 出さない。
// 日：土日は 本番、ほかの 日は 再放送。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyoOyatsuTv.ts。
import { draftScript, type JkPack, liveOr, onWeekdays } from "./pack";

/** 場面の 鍵（TV が 描く）。 */
export const OYATSU_SCENES = ["card"] as const;

/** 保守名人戦　おやつ実況。 */
export const OYATSU_PACK: JkPack = {
	script: draftScript("oyatsu", "go", "【実況】保守名人戦　おやつ部★{n}"),
	venue: "go",
	from: 3,
	menu: "保守名人戦",
	slot: liveOr(onWeekdays(0, 6)),
	draft: true,
	scenes: OYATSU_SCENES,
	names: ["保守名人戦"],
};
