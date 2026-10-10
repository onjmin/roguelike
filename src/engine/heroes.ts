// 冒険に 出る 主人公の 解放と 選択（村では いつも キリコ）。
// - 解放：束音ロゼ・解音ゼロは それぞれの 依頼（data/heroQuests.ts）を 経て 使える ように なる。
//   進み具合は Progress.flags に 持つ：q_<id>_ask＝悩みを かかえた（話しかけると 悩みを 打ち明ける）、
//   q_<id>＝依頼を 引き受けた、q_<id>_ok＝依頼の 条件を 満たして 帰った、hero_<id>＝本人から 申し出が あって 使える。
// - 悩みの 始まり：冒険から 帰る たびに（main.ts の rollHeroWorries）、持ち帰った 板の 数が HERO_GATE に
//   届いて いれば WORRY_CHANCE で 悩みを かかえる（はずれ つづきでも WORRY_SURE 回目には 必ず）。悩みは
//   1人ずつ（片方の 依頼が 片づくまで もう 片方は 悩まない）。かかえた 帰りに 村で ひとこと 知らせる。
// - 選択：行き先を 決める ところ（ui/worldMap.ts）で 切りかえる。localStorage の kiriko-roguelike/hero に
//   覚えて おき、次に 出る ときも そのまま（使えない 主人公なら キリコ）。

import { DUNGEON_IDS, openable } from "../core/data/dungeons";
import { type HeroId, isHeroId } from "../core/data/heroes";
import type { RunState } from "../core/types";
import { addFlag, hasFlag, loadProgress, saveProgress } from "./save";

export type QuestHero = Exclude<HeroId, "kiriko">;
export const QUEST_HEROES: readonly QuestHero[] = ["roze", "zero"];

export type QuestStage = "none" | "asked" | "accepted" | "done" | "unlocked";

export const questFlag = {
	asked: (h: QuestHero) => `q_${h}_ask`,
	accepted: (h: QuestHero) => `q_${h}`,
	done: (h: QuestHero) => `q_${h}_ok`,
	unlocked: (h: QuestHero) => `hero_${h}`,
};

/** 依頼の 進み具合。 */
export const questStage = (
	h: QuestHero,
	flags: readonly string[] = loadProgress().flags ?? [],
): QuestStage =>
	flags.includes(questFlag.unlocked(h))
		? "unlocked"
		: flags.includes(questFlag.done(h))
			? "done"
			: flags.includes(questFlag.accepted(h))
				? "accepted"
				: flags.includes(questFlag.asked(h))
					? "asked"
					: "none";

/** 悩みを かかえる ころ（持ち帰った 板の 数。パン板の あと、もう 少し 先）。 */
export const HERO_GATE: Record<QuestHero, number> = { roze: 2, zero: 3 };
/** 帰る たびに 悩みを かかえる 見こみ。 */
export const WORRY_CHANCE = 1 / 3;
/** はずれ つづきでも この 回目の 帰りには 必ず。 */
export const WORRY_SURE = 4;

/** 悩みを かかえる ころか。 */
export const questOpen = (h: QuestHero, p = loadProgress()): boolean =>
	p.cleared.length >= HERO_GATE[h];

const ROLL_KEY = "kiriko-roguelike/heroq";
type RollMemo = {
	tries: Partial<Record<QuestHero, number>>;
	news: QuestHero | null;
};
let rollMemo: RollMemo | null = null;
const loadRoll = (): RollMemo => {
	if (rollMemo) return rollMemo;
	let m: RollMemo = { tries: {}, news: null };
	try {
		const raw = JSON.parse(localStorage.getItem(ROLL_KEY) ?? "null");
		if (raw && typeof raw === "object") {
			const tries: RollMemo["tries"] = {};
			for (const h of QUEST_HEROES) {
				const n = raw.tries?.[h];
				if (typeof n === "number" && n >= 0) tries[h] = Math.floor(n);
			}
			m = {
				tries,
				news: QUEST_HEROES.includes(raw.news) ? raw.news : null,
			};
		}
	} catch {
		// 読めなければ はじめから
	}
	rollMemo = m;
	return m;
};
const saveRoll = (m: RollMemo): void => {
	rollMemo = m;
	try {
		localStorage.setItem(ROLL_KEY, JSON.stringify(m));
	} catch {
		// 保存できなくても この回は 覚えている
	}
};

/**
 * 冒険から 帰った（main.ts）：悩みを かかえるか 引く。かかえたら その 主人公（村で ひとこと 知らせる）。
 * 乱数は 画面の 側（Math.random。冒険の 乱数には さわらない）。
 */
export const rollHeroWorries = (
	rnd: () => number = Math.random,
): QuestHero | null => {
	const p = loadProgress();
	// 1人ずつ：悩み中・依頼中の 人が いれば 引かない
	if (
		QUEST_HEROES.some((h) =>
			["asked", "accepted", "done"].includes(questStage(h, p.flags ?? [])),
		)
	)
		return null;
	const h = QUEST_HEROES.find(
		(x) => questStage(x, p.flags ?? []) === "none" && questOpen(x, p),
	);
	if (!h) return null;
	const m = loadRoll();
	const n = (m.tries[h] ?? 0) + 1;
	if (n < WORRY_SURE && rnd() >= WORRY_CHANCE) {
		saveRoll({ ...m, tries: { ...m.tries, [h]: n } });
		return null;
	}
	addFlag(questFlag.asked(h));
	saveRoll({ tries: { ...m.tries, [h]: n }, news: h });
	return h;
};

/** 村に 着いた ときに 知らせる 悩み（1度だけ。取ると 消える）。 */
export const takeWorryNews = (): QuestHero | null => {
	const m = loadRoll();
	if (!m.news) return null;
	saveRoll({ ...m, news: null });
	return m.news;
};

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
	rollMemo = null;
};
