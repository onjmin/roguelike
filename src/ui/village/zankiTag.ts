// やきうの 頭の 上の「残機：1」（寄り道「残機」。STORY.md §4.9・data/story/story.ts の zankiLine）。
// 語りが「やきうの 頭の 上に、小さく『残機：1』と 出ていた」と 言うので、本当に 頭の 上に 小さく 出す。
// - きのこ板を 持ち帰ってから 1。最終話の あとは、遺影祭り（お祭り会場）を 持ち帰って いれば 99。
// - 持ち帰りの 語りで 数が 出る・かわる 頁（StoryPage.zanki）までは、前の 数の まま（先に 見えて しまわない）。
// 字は 美咲ゴシックの 点（ui/misakiDots.ts）。

import type { DungeonId } from "../../core/types";
import type { Actor } from "../../engine/field";
import { TILE } from "../../engine/types";
import { drawMisaki, MISAKI_H } from "../misakiDots";

/** 持ち帰った 板から 決まる 数（出さなければ null）。 */
export const zankiOf = (cleared: readonly DungeonId[]): number | null =>
	!cleared.includes("kinoko")
		? null
		: cleared.includes("deep") && cleared.includes("festival")
			? 99
			: 1;

let town: number | null = null;
/** 語りの あいだの 数（undefined は 語りの 外。持ち帰った 板の 数を 出す）。 */
let scene: number | null | undefined;

/** 村を 組みなおした（持ち帰った 板から 数を 決めなおす）。 */
export const setZankiTown = (cleared: readonly DungeonId[]): void => {
	town = zankiOf(cleared);
};

/** 語りの あいだの 数（null で 出さない・undefined で 語りの 外に もどす）。 */
export const setZankiScene = (n: number | null | undefined): void => {
	scene = n;
};

const INK = "#f4f4ec";

/** やきうの 頭の 上に 描く（a は やきう。いなければ 何も しない）。 */
export const drawZanki = (
	g: CanvasRenderingContext2D,
	a: Actor | undefined,
	ox: number,
	oy: number,
): void => {
	const n = scene === undefined ? town : scene;
	if (n === null || !a || !a.visible || !a.sprite) return;
	drawMisaki(
		g,
		`残機:${n}`,
		a.fx * TILE - ox + TILE / 2,
		a.fy * TILE - oy - 3 - MISAKI_H,
		INK,
	);
};
