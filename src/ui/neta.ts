// ネタスレの 遊び（土台だけ：neta が まるごと 置きかえる）。

import { isNetaPlay, type NetaPlay } from "../data/neta/types";
import type { Story } from "../engine/defs";
import type { Ctx } from "./ctx";

export { isNetaPlay };

/** 物を 調べた あとの 遊び（ui/facilities.ts の outdoorScript・buildFacility から）。 */
export const netaPlay = async (
	_ctx: Ctx,
	_s: Story,
	_play: NetaPlay,
): Promise<void> => {};
