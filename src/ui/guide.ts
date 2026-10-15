// えらんで 読む 説明（data/town/guides.ts の Guide）。項目を えらぶと その 窓だけ 読み、「やめる」まで くりかえす。
// 家の 返済予定表・ギフトの 棚・証券の パンフの 棚で 使う。

import type { Guide } from "../data/town/guides";
import type { Story } from "../engine/defs";

export const readGuide = async (s: Story, g: Guide): Promise<void> => {
	const last = g.topics.length - 1;
	for (;;) {
		const n = await s.choose([...g.topics], { cancel: last });
		const pages = g.pages[n];
		if (!pages) return;
		for (const p of pages) await s.narrate(p);
	}
};
