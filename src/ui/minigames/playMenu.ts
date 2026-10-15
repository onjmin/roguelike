// ミニゲームを 調べた ときの「遊ぶ／ハイスコアを　見る／やめる」（2026-10-13 作者：「調べた 時、
// プレイ・ハイスコア 見るだけを 選べるように」）。ハイスコアを 見たら また 聞く。
// 品書き（menu）は 遊ぶ 項目（1つ いじょう）・「ハイスコアを　見る」・「やめる」の 順（data の 各 menu）。

import type { Story } from "../../engine/defs";
import { addFlag, hasFlag } from "../../engine/save";
import { previewing } from "../village/pay";

/**
 * はじめて 遊ぶ ときだけ 説明を 読む（Progress.flags の flag。下見では 覚えない）。
 * 説明は data/arcade/guides.ts（あそびかたの「ゲームの　決まり」で 読みかえせる）。
 */
export const tellOnce = async (
	s: Story,
	flag: string,
	lines: readonly string[],
): Promise<void> => {
	if (hasFlag(flag)) return;
	for (const t of lines) await s.narrate(t);
	if (!previewing()) addFlag(flag);
};

/** 記録が まだ ない とき。 */
export const NO_RECORD = "まだ　記録は　ない。";

/**
 * 品書きを 出す。遊ぶ 項目なら その 番号（0 から）、やめたら null。うしろから 2つめ（ハイスコア）を
 * えらぶと record の 窓（空なら NO_RECORD）を 出して また 聞く。
 */
export const playOrRecord = async (
	s: Story,
	record: readonly string[],
	menu: readonly string[],
): Promise<number | null> => {
	const rec = menu.length - 2;
	for (;;) {
		const n = await s.choose([...menu], { cancel: menu.length - 1 });
		if (n < rec) return n;
		if (n !== rec) return null;
		for (const t of record.length ? record : [NO_RECORD]) await s.narrate(t);
	}
};
