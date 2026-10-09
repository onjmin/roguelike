// 人力機　保守杯（海の家「age」の テレビ（夏の 保守園と 同じ テレビ））。作りかけ（draft）：番組表には まだ 出さない。
// 日：8月の 土曜は 本番、ほかの 日は 録画。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyoTorijinTv.ts。
import { draftScript, type JkPack, liveOr } from "./pack";

/** 場面の 鍵（TV が 描く）。 */
export const TORIJIN_SCENES = ["card"] as const;

/** 人力機　保守杯。 */
export const TORIJIN_PACK: JkPack = {
	script: draftScript("torijin", "umi", "【実況】人力機　保守杯★{n}"),
	venue: "umi",
	from: 2,
	menu: "人力機　保守杯",
	slot: liveOr((t) => t.m === 8 && t.w === 6),
	draft: true,
	scenes: TORIJIN_SCENES,
	names: ["保守杯"],
};
