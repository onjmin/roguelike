// ことばの 辞典（data/glossary.ts）を 見る 窓と、ログに はじめて 出た ことばの 1行の 説明。
// 読める ことばは 町の 段で ふえる（集会所の 本棚 → 本屋 → 図書館。TIER_FROM）。

import { GLOSSARY, TIER_FROM, type Word } from "../data/glossary";
import type { Story } from "../engine/defs";
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

/** 説明の 会話の 窓（data/glossary.ts の desc は 窓ごとに 空行で 区切って 書く）。 */
export const descWindows = (desc: string): string[] => desc.split("\n\n");

/** 窓の 中の 改行を つないだ 1段落（一覧の 窓で 読む とき）。 */
const joined = (win: string): string => win.replace(/\n/g, "");

/** 本屋・図書館の i 番目の 本棚（n 本の うち）の ことば（読める 段までを 辞典の 順に 分ける）。 */
export const shelfWords = (i: number, n: number): Word[] => {
	const words = GLOSSARY.filter((w) => w.tier <= glossaryTier());
	return words.slice(
		Math.floor((i * words.length) / n),
		Math.floor(((i + 1) * words.length) / n),
	);
};

/**
 * 本棚の 本を 読む（やめるまで）。選んだ ことばの 説明は 会話の 窓で。板の ことばは その 板が
 * 開くまで ？？？。
 */
export const readShelf = async (
	s: Story,
	i: number,
	n: number,
): Promise<void> => {
	const open = new Set(loadProgress().unlocked);
	const known = (w: Word) => !w.board || open.has(w.board);
	const words = shelfWords(i, n);
	let start = 0;
	for (;;) {
		const k = await s.choose(
			[...words.map((w) => (known(w) ? w.word : "？？？")), "やめる"],
			{ cancel: words.length, start },
		);
		if (k >= words.length) return;
		start = k;
		const w = words[k];
		if (!known(w)) {
			await s.narrate("まだ　行けない　板の　本だ。\n……ひらいても　読めない。");
			continue;
		}
		for (const t of descWindows(w.desc)) await s.narrate(t);
	}
};

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
							desc: esc(joined(descWindows(w.desc)[0])),
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
			descWindows(w.desc)
				.map((l) => `<p>${esc(joined(l))}</p>`)
				.join(""),
		);
	}
};
