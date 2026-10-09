// 保守リーグ（麻雀）（ゲームセンター「連コ」の 壁の 大画面）。作りかけ（draft）：番組表には まだ 出さない。
// 日：月曜と 木曜は 本番、ほかの 日は 再放送。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyoMahjongTv.ts。
import { draftScript, type JkPack, liveOr, onWeekdays } from "./pack";

/** 場面の 鍵（TV が 描く）。 */
export const MAHJONG_SCENES = ["card"] as const;

/** 保守リーグ（麻雀）。 */
export const MAHJONG_PACK: JkPack = {
	script: draftScript("mahjong", "arcade", "【実況】保守リーグ　part{n}"),
	venue: "arcade",
	from: 6,
	menu: "保守リーグ",
	slot: liveOr(onWeekdays(1, 4)),
	draft: true,
	scenes: MAHJONG_SCENES,
	names: ["保守リーグ"],
};
