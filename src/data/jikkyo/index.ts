// 台本の 番組の 一覧（id → 台本）。野球（yakyu）は 試合シムから 時間割を 作るので ここには 入れない
// （data/jikkyo/yakyu.ts の yakyuTimeline）。議会中継（gikai）も ここには 入れない（data/jikkyo/gikai.ts の
// gikaiProgram が 1話ずつ 時間割を 作る）。

import type { JkScript } from "../../core/jikkyo";
import { KOHAKU } from "./kohaku";
import { SORA } from "./sora";

export const PROGRAMS: Readonly<Record<string, JkScript>> = {
	sora: SORA,
	kohaku: KOHAKU,
};
