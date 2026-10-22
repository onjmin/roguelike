// キリコの 肩書き（STORY.md §4.9「成り上がりと 転落」）。持ち帰りの 語りを 見おえた 本筋の 板で 上がり、
// 最終話（電池板）の 語りで 鯖代の 差し押さえに あって 全部 失う。窓の 名前欄に 出す（村・集落の 掛け合い）。

import type { DungeonId } from "../../core/types";
import { loadProgress } from "../../engine/save";
import { KIRIKO } from "../people/cast";

/** 見おえた 持ち帰りの 語り（Progress.endings）から 肩書き。無ければ ""。 */
export const kirikoTitle = (endings: readonly DungeonId[]): string =>
	endings.includes("deep")
		? ""
		: endings.includes("main")
			? "皇帝"
			: endings.includes("kinoko")
				? "総統"
				: endings.includes("shallow")
					? "町長"
					: "";

/** 窓の 名前欄の キリコ（肩書きつき）。 */
export const kirikoLabel = (): string =>
	`${kirikoTitle(loadProgress().endings ?? [])}${KIRIKO.name}`;
