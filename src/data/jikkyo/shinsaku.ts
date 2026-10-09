// 保守ゲームス　新作発表会（ゲームセンター「連コ」の 壁の 大画面）。作りかけ（draft）：番組表には まだ 出さない。
// 日：水曜は 生配信、ほかの 日は アーカイブ。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyoShinsakuTv.ts。
import { draftScript, type JkPack, liveOr, onWeekdays } from "./pack";

/** 場面の 鍵（TV が 描く）。 */
export const SHINSAKU_SCENES = ["card"] as const;

/** 保守ゲームス　新作発表会。 */
export const SHINSAKU_PACK: JkPack = {
	script: draftScript(
		"shinsaku",
		"arcade",
		"【実況】保守ゲームス　新作発表会★{n}",
	),
	venue: "arcade",
	from: 6,
	menu: "新作発表会",
	slot: liveOr(onWeekdays(3)),
	draft: true,
	scenes: SHINSAKU_SCENES,
	names: ["保守ゲームス"],
};
