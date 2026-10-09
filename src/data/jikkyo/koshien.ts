// 夏の　保守園（高校野球）（海の家「age」の テレビ）。作りかけ（draft）：番組表には まだ 出さない。
// 日：8月は 本大会、ほかの 月は 総集編（再放送）。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyoKoshienTv.ts。
import { draftScript, type JkPack, liveOr } from "./pack";

/** 場面の 鍵（TV が 描く）。 */
export const KOSHIEN_SCENES = ["card"] as const;

/** 夏の　保守園（高校野球）。 */
export const KOSHIEN_PACK: JkPack = {
	script: draftScript("koshien", "umi", "【実況】夏の保守園　その{n}"),
	venue: "umi",
	from: 2,
	menu: "夏の保守園",
	slot: liveOr((t) => t.m === 8),
	draft: true,
	scenes: KOSHIEN_SCENES,
	names: ["保守園"],
};
