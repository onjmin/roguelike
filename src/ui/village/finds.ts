// 町の 寄り道で 板を 見つける（data/town/finds.ts）。施設の 物・人の 文の あとに 1回だけ。
// 板が 開いたら その場で「〜に もぐれるように なった」と 知らせる（知らせ（news）は 積まない）。

import { DUNGEON_NAMES } from "../../data/story/story";
import { TOWN_FINDS } from "../../data/town/finds";
import type { Story } from "../../engine/defs";
import { loadProgress, loadTown, openByFlag } from "../../engine/save";

/** 起きたら true（遊べる 物は その回 遊ばない）。 */
export const townFind = async (
	s: Story,
	facility: string,
	at: string,
): Promise<boolean> => {
	const f = TOWN_FINDS.find((x) => x.facility === facility && x.at === at);
	if (!f) return false;
	const p = loadProgress();
	if (p.unlocked.includes(f.dungeon)) return false;
	if (f.after && !p.unlocked.includes(f.after)) return false;
	if (loadTown().stage < (f.stage ?? 0)) return false;
	for (const l of f.lines)
		if (l.who) await s.say("nanj", l.text, { name: l.who });
		else await s.narrate(l.text);
	if (!openByFlag(`town_${f.dungeon}`).includes(f.dungeon)) return true;
	s.se("chapter");
	await s.narrate(
		`「${DUNGEON_NAMES[f.dungeon].name}」に\nもぐれるように　なった`,
	);
	return true;
};
