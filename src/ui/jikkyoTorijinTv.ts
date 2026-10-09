// 人力機　保守杯の TV（ui/jikkyoWatch.ts の 板の 上の キャンバス）。作りかけ：番組の 札だけ 描く。
// 形は ui/jikkyoTvKit.ts（480x270 の 2倍の 下地に 240x135 の 座標）。

import { TORIJIN_PACK } from "../data/jikkyo/torijin";
import { cardScene, crtFrame, makeTv } from "./jikkyoTvKit";

export const torijinTv = makeTv({
	screen: crtFrame.screen,
	frame: crtFrame.draw,
	scenes: { card: cardScene(TORIJIN_PACK.menu) },
});
