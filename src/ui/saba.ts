// ホシュクラの 物・豚・夜の 匠（土台だけ：saba が まるごと 置きかえる）。

import type { Facility } from "../data/village/facilities";
import type { VillageView } from "../data/village/map";
import type { EventDef, Story } from "../engine/defs";
import type { Ctx } from "./ctx";

/** buildVillage の 人に 足す（豚と 夜の 匠）。 */
export const sabaEvents = (_v: VillageView): EventDef[] => [];

/** play:"saba" の 物（outdoor は 島の 外の 物。文は 呼ぶ 前に 読んである）。 */
export const sabaPlay = async (
	_ctx: Ctx,
	_s: Story,
	_f: Facility,
	_id: string,
	_outdoor: boolean,
): Promise<void> => {};
