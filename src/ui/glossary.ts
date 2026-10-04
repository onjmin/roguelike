// ことばの 辞典（data/glossary.ts）を 見る 窓と、ログに はじめて 出た ことばの 1行の 説明。
// 読める ことばは 町の 段で ふえる（集会所の 本棚 → 本屋 → 図書館。TIER_FROM）。

import { GLOSSARY, TIER_FROM, type Word } from "../data/glossary";
import { loadProgress, loadTown, loadWords, markWord } from "../engine/save";
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

/** 町の 段で 読める ことばの 段（0〜2）。 */
export const glossaryTier = (stage = loadTown().stage): number =>
	TIER_FROM.filter((from) => stage >= from).length - 1;

/** 辞典の 題（置き場で かわる）。 */
const TITLES = [
	"ことばの　辞典",
	"ことばの　辞典（本屋）",
	"ことばの　辞典（図書館）",
];

/**
 * 辞典を 開く（閉じるまで）。町の 段までの ことばを 並べ、板の ことばは その 板が 開くまで ？？？。
 * 選ぶと 説明。
 */
export const openGlossary = async (ctx: Ctx): Promise<void> => {
	const tier = glossaryTier();
	const open = new Set(loadProgress().unlocked);
	const known = (w: Word) => !w.board || open.has(w.board);
	const words = GLOSSARY.filter((w) => w.tier <= tier);
	let start = 0;
	for (;;) {
		const v = await listWindow(
			ctx,
			TITLES[tier] ?? TITLES[0],
			words.map((w) =>
				known(w)
					? {
							label: esc(w.word),
							desc: esc(w.desc.split("\n")[0]),
							value: w.id,
						}
					: {
							label: "？？？",
							// 板の 名前は 出さない（全体マップでも 開くまでは ？？？）
							desc: "まだ　行けない　板の　ことば",
							value: w.id,
							disabled: true,
						},
			),
			{ start },
		);
		if (v === null) return;
		start = Math.max(
			0,
			words.findIndex((w) => w.id === v),
		);
		const w = words[start];
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
