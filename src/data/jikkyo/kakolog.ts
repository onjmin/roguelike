// 過去ログの世紀（おんJ図書館の 視聴覚コーナー）。作りかけ（draft）：番組表には まだ 出さない。
// 日：月曜は 本放送、ほかの 日は 再放送。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyoKakologTv.ts。
import { LIBRARY_FROM } from "../glossary";
import { draftScript, type JkPack, liveOr, onWeekdays } from "./pack";

/** 場面の 鍵（TV が 描く）。 */
export const KAKOLOG_SCENES = ["card"] as const;

/** 過去ログの世紀。 */
export const KAKOLOG_PACK: JkPack = {
	script: draftScript("kakolog", "library", "【実況】過去ログの世紀★{n}"),
	venue: "library",
	from: LIBRARY_FROM,
	menu: "過去ログの世紀",
	slot: liveOr(onWeekdays(1)),
	draft: true,
	scenes: KAKOLOG_SCENES,
};
