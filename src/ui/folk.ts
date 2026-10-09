// 保守村の 小さな 名物の 話し方（土台だけ：folk が まるごと 置きかえる）。

import type { VillagePlace, VillageView } from "../data/village/map";
import type { EventDef } from "../engine/defs";

/** id が folk_ で はじまる 置き場所の イベント（ui/villageEvents.ts の eventFor から）。 */
export const folkEvent = (p: VillagePlace, _v: VillageView): EventDef => ({
	id: p.id,
	x: p.x,
	y: p.y,
	sprite: p.sprite,
	trigger: p.trigger,
});
