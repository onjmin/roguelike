// 台本の 番組の 一覧（id → 台本）。野球（yakyu）は 試合シムから 時間割を 作るので ここには 入れない
// （data/jikkyo/yakyu.ts の yakyuTimeline）。紅白・議会中継は それぞれの 手順で 足す。

import type { JkScript } from "../../core/jikkyo";
import { SORA } from "./sora";

export const PROGRAMS: Readonly<Record<string, JkScript>> = {
	sora: SORA,
};
