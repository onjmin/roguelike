// おんJ芋煮会（土台だけ：season が まるごと 置きかえる。段階の 型は data/imoni.ts へ 移る）。

import type { OutdoorThing } from "../data/village/facilities";
import type { MapDef, Story } from "../engine/defs";
import type { Ctx } from "./ctx";

export type ImoniPhase = "off" | "notice" | "open" | "done";

/** 村の 地図を 組む たび：10月の 帰りを 数えてから、いまの 段階を 返す。 */
export const imoniArrive = (): ImoniPhase => "off";

/** まとめ掲示板の メニューの 1行（10月だけ）。 */
export const imoniBoardMenu = (): string | null => null;

/** まとめ掲示板の はり紙。 */
export const imoniBoardScript = async (_s: Story): Promise<void> => {};

/** 強行開催の 帰りだけの 火と 湯気（ほかは なし）。 */
export const imoniDecor = (_phase: ImoniPhase): MapDef["decor"] => undefined;

/** 外の 物の 遊び imoni（ui/facilities.ts の outdoorScript から）。 */
export const imoniPlay = async (
	_ctx: Ctx,
	_s: Story,
	_t: OutdoorThing,
): Promise<void> => {};
