// 保守記念（G1）（カジノ「ガチャ」の 大画面）。作りかけ（draft）：番組表には まだ 出さない。
// 日：日曜は 本番、ほかの 日は 再放送。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyoKeibaTv.ts。
import { draftScript, type JkPack, liveOr, onWeekdays } from "./pack";

/** 場面の 鍵（TV が 描く）。 */
export const KEIBA_SCENES = ["card"] as const;

/** 保守記念（G1）。 */
export const KEIBA_PACK: JkPack = {
	script: draftScript("keiba", "casino", "おんJ競馬部　{n}R"),
	venue: "casino",
	from: 7,
	menu: "保守記念",
	slot: liveOr(onWeekdays(0)),
	draft: true,
	scenes: KEIBA_SCENES,
	names: ["保守記念"],
};
