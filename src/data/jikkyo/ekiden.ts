// 保守駅伝（保守村駅の 待合の テレビ）。作りかけ（draft）：番組表には まだ 出さない。
// 日：1/2〜3 は 本番、ほかの 日は 再放送。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyoEkidenTv.ts。
import { draftScript, type JkPack, liveOr } from "./pack";

/** 場面の 鍵（TV が 描く）。 */
export const EKIDEN_SCENES = ["card"] as const;

/** 保守駅伝。 */
export const EKIDEN_PACK: JkPack = {
	script: draftScript("ekiden", "station", "【実況】保守駅伝　第{n}回"),
	venue: "station",
	from: 7,
	menu: "保守駅伝",
	slot: liveOr((t) => t.m === 1 && (t.d === 2 || t.d === 3)),
	draft: true,
	scenes: EKIDEN_SCENES,
	names: ["保守駅伝", "保守村駅"],
};
