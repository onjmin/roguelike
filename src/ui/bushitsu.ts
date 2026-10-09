// 部室棟の 遊べる 物（土台だけ：bushitsu が まるごと 置きかえる）。

import type { Facility } from "../data/village/facilities";
import type { VillageView } from "../data/village/map";
import type { Story } from "../engine/defs";
import type { Ctx } from "./ctx";

/** room.plays の "bushitsu"（物の id で 分ける）。 */
export const bushitsuThing = async (
	_ctx: Ctx,
	_s: Story,
	_f: Facility,
	_kind: string,
	_v: VillageView,
): Promise<void> => {};
