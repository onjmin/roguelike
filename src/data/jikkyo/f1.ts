// 保守グランプリ（F1）（自動車整備工場の テレビ）。作りかけ（draft）：番組表には まだ 出さない。
// 日：日曜は 決勝、ほかの 日は 再放送。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyoF1Tv.ts。
import { draftScript, type JkPack, liveOr, onWeekdays } from "./pack";

/** 場面の 鍵（TV が 描く）。 */
export const F1_SCENES = ["card"] as const;

/** 保守グランプリ（F1）。 */
export const F1_PACK: JkPack = {
	script: draftScript("f1", "repair", "【実況】保守グランプリ　LAP{n}"),
	venue: "repair",
	from: 7,
	menu: "保守グランプリ",
	slot: liveOr(onWeekdays(0)),
	draft: true,
	scenes: F1_SCENES,
	names: ["保守グランプリ"],
};
