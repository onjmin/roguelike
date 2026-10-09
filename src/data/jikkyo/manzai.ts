// 漫才スレ王　決定戦（保守劇場の 舞台（紅白の ない 日））。作りかけ（draft）：番組表には まだ 出さない。
// 日：12月と 1/1〜7 は 紅白の 枠なので 流さない。日曜は 本番、ほかの 日は 録画。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyoManzaiTv.ts。
import { draftScript, type JkPack } from "./pack";

/** 場面の 鍵（TV が 描く）。 */
export const MANZAI_SCENES = ["card"] as const;

/** 漫才スレ王　決定戦。 */
export const MANZAI_PACK: JkPack = {
	script: draftScript("manzai", "theater", "【実況】漫才スレ王　決定戦★{n}"),
	venue: "theater",
	from: 7,
	menu: "漫才スレ王",
	slot: (t) =>
		t.m === 12 || (t.m === 1 && t.d <= 7) ? null : { live: t.w === 0 },
	draft: true,
	scenes: MANZAI_SCENES,
};
