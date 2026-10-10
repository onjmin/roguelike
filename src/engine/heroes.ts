// 冒険に 出る 主人公の 解放と 選択（村では いつも キリコ）。
// - 解放：束音ロゼ・解音ゼロは それぞれの 依頼（data/heroQuests.ts）を 経て 使える ように なる。
//   進み具合は Progress.flags に 持つ：q_<id>＝依頼を 引き受けた、q_<id>_ok＝依頼の 条件を 満たして 帰った、
//   hero_<id>＝本人から 申し出が あって 使える。
// - 選択：行き先を 決める ところ（ui/worldMap.ts）で 切りかえる。localStorage の kiriko-roguelike/hero に
//   覚えて おき、次に 出る ときも そのまま（使えない 主人公なら キリコ）。

import { DUNGEON_IDS, openable } from "../core/data/dungeons";
import { type HeroId, isHeroId } from "../core/data/heroes";
import type { RunState } from "../core/types";
import { addFlag, hasFlag, loadProgress, saveProgress } from "./save";

export type QuestHero = Exclude<HeroId, "kiriko">;
export const QUEST_HEROES: readonly QuestHero[] = ["roze", "zero"];

export type QuestStage = "none" | "accepted" | "done" | "unlocked";

export const questFlag = {
	accepted: (h: QuestHero) => `q_${h}`,
	done: (h: QuestHero) => `q_${h}_ok`,
	unlocked: (h: QuestHero) => `hero_${h}`,
};

/** 依頼の 進み具合。 */
export const questStage = (
	h: QuestHero,
	flags = loadProgress().flags ?? [],
): QuestStage =>
	flags.includes(questFlag.unlocked(h))
		? "unlocked"
		: flags.includes(questFlag.done(h))
			? "done"
			: flags.includes(questFlag.accepted(h))
				? "accepted"
				: "none";

/** 依頼を 出せる ころか（パン板を 持ち帰って から。話しかけた 人が 村に いる ことは 呼ぶ 側が 見る）。 */
export const questOpen = (p = loadProgress()): boolean =>
	p.cleared.includes("shallow");

/**
 * 依頼を 引き受ける。ロゼの 依頼は ボカロ作り避難所が 開く（知らせは 出さない：ロゼが 場所を 言う）。
 */
export const acceptQuest = (h: QuestHero): void => {
	addFlag(questFlag.accepted(h));
	const p = loadProgress();
	let changed = false;
	for (const d of DUNGEON_IDS)
		if (!p.unlocked.includes(d) && openable(d, p.cleared, p.flags ?? [])) {
			p.unlocked.push(d);
			changed = true;
		}
	if (changed) saveProgress(p);
};
export const unlockHero = (h: QuestHero): void =>
	addFlag(questFlag.unlocked(h));

/** 使える 主人公（キリコは いつも）。 */
export const unlockedHeroes = (): HeroId[] => [
	"kiriko",
	...QUEST_HEROES.filter((h) => hasFlag(questFlag.unlocked(h))),
];

/** ゼロの 依頼：この 深さまで 行って 生きて 帰る。 */
export const ZERO_QUEST_DEPTH = 8;

/**
 * 依頼の 条件を 満たしたか（冒険の 終わりに main.ts が 呼ぶ）。
 * ロゼ：ボカロ作り避難所の 底から 忘れ物（原音設定）を 持ち帰る。
 * ゼロ：どこかの 板で ZERO_QUEST_DEPTH 階まで 行って 生きて 帰る（底に 沈んだ 声を 聞きに）。
 * どちらも 引き受けて いる ときだけ。満たしたら q_<id>_ok（村で 話すと 申し出）。
 */
export const questMet = (h: QuestHero, s: RunState): boolean => {
	if (!s.end || s.end.kind === "dead") return false;
	if (h === "roze") return s.dungeon === "vocalo" && s.end.kind === "clear";
	return s.stats.maxDepth >= ZERO_QUEST_DEPTH;
};

export const noteHeroQuests = (s: RunState): QuestHero[] => {
	const met: QuestHero[] = [];
	for (const h of QUEST_HEROES)
		if (questStage(h) === "accepted" && questMet(h, s)) {
			addFlag(questFlag.done(h));
			met.push(h);
		}
	return met;
};

// ───────────────── 選んだ 主人公 ─────────────────

const KEY = "kiriko-roguelike/hero";
let memo: HeroId | null = null;

/** 選んで ある 主人公（使えなければ キリコ）。 */
export const chosenHero = (): HeroId => {
	let h: HeroId = memo ?? "kiriko";
	if (!memo)
		try {
			const raw = localStorage.getItem(KEY);
			if (isHeroId(raw)) h = raw;
		} catch {
			// 読めなければ キリコ
		}
	return unlockedHeroes().includes(h) ? h : "kiriko";
};

export const chooseHero = (h: HeroId): void => {
	memo = h;
	try {
		localStorage.setItem(KEY, h);
	} catch {
		// 保存できなくても この回は 覚えている
	}
};

/** 試験用：覚えた 選択を 忘れる。 */
export const forgetHeroMemo = (): void => {
	memo = null;
};
