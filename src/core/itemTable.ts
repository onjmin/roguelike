// 道具の出かた（トルネコ1と同じく、階ごとに 重みの表から 引く）。
//
// - 何が出るかは 冒険ごとに ちがう。同じ種類が 続けて出ることも、1つも出ないこともある。
// - 表の重みは、そのダンジョンの 1回の冒険で 出る数の 目安（本編なら ぜんぶで 約160個）。
// - モンスターの落とし物も、その階に 置かれた道具の一部（後から湧いた敵は 何も持っていない）。

import type { Rng } from "./rng";

export type ItemWeight = { kind: string; weight: number };

/** 表から n 個 引く。 */
export const rollKinds = (
	rng: Rng,
	table: readonly ItemWeight[],
	n: number,
): string[] =>
	Array.from({ length: n }, () => rng.weighted(table, (e) => e.weight).kind);

/** 表の重みの合計（1回の冒険で 出る数の 目安）。 */
export const tableTotal = (table: readonly ItemWeight[]): number =>
	table.reduce((a, e) => a + e.weight, 0);
