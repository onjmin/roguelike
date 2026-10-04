// ことばの 辞典（data/glossary.ts）を 見る 窓と、ログに はじめて 出た ことばの 1行の 説明。

import { GLOSSARY } from "../data/glossary";
import { loadWords, markWord } from "../engine/save";
import type { Ctx } from "./ctx";
import { esc } from "./itemText";
import { infoWindow, listWindow } from "./list";

/**
 * ログの 1行に はじめて 出た ことばが あれば、その 説明の 1行を 返して「説明した」と 覚える（1行に 1つまで）。
 * 2回目からは 出さない（説明が 何度も 流れると ログが うるさい）。
 */
export const glossFor = (text: string): string | null => {
	const done = loadWords();
	const w = GLOSSARY.find(
		(g) => g.hint && g.gloss && !done.includes(g.id) && g.hint.test(text),
	);
	if (!w?.gloss) return null;
	markWord(w.id);
	return w.gloss;
};

/** 辞典を 開く（閉じるまで）。ことばを 選ぶと 説明。 */
export const openGlossary = async (ctx: Ctx): Promise<void> => {
	let start = 0;
	for (;;) {
		const v = await listWindow(
			ctx,
			"ことばの　辞典",
			GLOSSARY.map((g) => ({
				label: esc(g.word),
				desc: esc(g.desc.split("\n")[0]),
				value: g.id,
			})),
			{ start },
		);
		if (v === null) return;
		start = Math.max(
			0,
			GLOSSARY.findIndex((g) => g.id === v),
		);
		const w = GLOSSARY[start];
		await infoWindow(
			ctx,
			esc(w.word),
			w.desc
				.split("\n")
				.map((l) => `<p>${esc(l)}</p>`)
				.join(""),
		);
	}
};
