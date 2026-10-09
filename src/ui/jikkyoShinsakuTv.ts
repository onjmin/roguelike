// 保守ゲームス　新作発表会の TV（ui/jikkyoWatch.ts の 板の 上の キャンバス）。作りかけ：番組の 札だけ 描く。
// 形は ui/jikkyoTvKit.ts（480x270 の 2倍の 下地に 240x135 の 座標）。

import { SHINSAKU_PACK } from "../data/jikkyo/shinsaku";
import { cardScene, crtFrame, makeTv } from "./jikkyoTvKit";

export const shinsakuTv = makeTv({
	screen: crtFrame.screen,
	frame: crtFrame.draw,
	scenes: { card: cardScene(SHINSAKU_PACK.menu) },
});
