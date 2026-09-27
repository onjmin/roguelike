// 階の 呼びかた（下りの 植民地は「地下3階・B3」、上りの 植民地は「3階・3F」）。
// 中の 数え方は どちらも 同じ（depth が 大きいほど 入口から 遠い）。data/dungeons.ts の up。

import { dungeonById } from "../core/data/dungeons";
import type { DungeonId } from "../core/types";

/** 上りの 植民地か。 */
export const isUpBoard = (d: DungeonId | undefined): boolean =>
	!!dungeonById(d).up;

/** 短い 札（HUD・記録。B3 / 3F）。 */
export const floorShort = (d: DungeonId | undefined, depth: number): string =>
	isUpBoard(d) ? `${depth}F` : `B${depth}`;

/** 長い 呼びかた（階の 札・倒れた 所。地下　3階 / 3階）。 */
export const floorLong = (d: DungeonId | undefined, depth: number): string =>
	isUpBoard(d) ? `${depth}階` : `地下　${depth}階`;

/** 行きの 向きの ことば（降りる / 上る）。 */
export const goVerb = (d: DungeonId | undefined): string =>
	isUpBoard(d) ? "上る" : "降りる";

/** 帰りの 向きの ことば（上る / 降りる）。 */
export const backVerb = (d: DungeonId | undefined): string =>
	isUpBoard(d) ? "降りる" : "上る";
