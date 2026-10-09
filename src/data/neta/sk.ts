// !sk（おーぷんの サイコロ機能。おんJwiki pages/401）の 作文：「!sk　が　!sk2　で　!sk3。」→「名無し　が　銭湯　で　寝た。」。
// 保守道場の 文机で 3つの 目を 止めて 半紙に 書く（縦書き 3列。ui/netaSk.ts）。ダンジョンの 巻物「!skスレ」
// （core/data/items.ts の s_gacha）の 村の 版。目は 暗い ことばを 入れない（死・沈む・消える など）。DOM も 保存も 使わない。

import { SK } from "./text";

/** 目が 1つ 進む 間（ms）。 */
export const SK_STEP_MS = 110;

export const skSentence = (a: number, b: number, c: number): string =>
	`${SK.who[a]}　が　${SK.where[b]}　で　${SK.did[c]}。`;

/** 縦書きの 3列（右から：だれが・どこで・どうした）。 */
export const skColumns = (
	a: number,
	b: number,
	c: number,
): readonly [string, string, string] => [
	`${SK.who[a]}が`,
	`${SK.where[b]}で`,
	`${SK.did[c]}。`,
];

/** 回っている 目（はじめ t0、いま now、目の 数 len、ずらし off）。 */
export const skReelAt = (
	t0: number,
	now: number,
	len: number,
	off: number,
): number => (((Math.floor((now - t0) / SK_STEP_MS) + off) % len) + len) % len;
