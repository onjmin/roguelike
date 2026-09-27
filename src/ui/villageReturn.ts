// 村（保守村）に 帰ってきたときの 場面（ui/village.ts が 村に 入るたびに 走らせる。つなぎは ui/villageEvents.ts）。
// トルネコ1と 同じ順：口から 出る → 仲間が むかえる → 開いた知らせ → 持ち帰った物を 倉庫へ・売る → 町が 育つ。
//
// - 持ち帰った・帰還スレ：キリコが 口の奥から 出てくると、口の前に 仲間が 並んで 待っている（幕が 上がる前に
//   並べる。lineUp）。持ち帰りの 語り（STORY[d].ending）か 帰還スレの 語り（RETURN_PAGES）を 村の窓で 話して、
//   暗転の あいだに 持ち場へ もどる（囲いの中の ロゼ・シヨは 歩いては 帰れない）。語りは 保存しない（閉じたら それきり）。
// - 開いた知らせ（Progress.news）：本編は 口の前で 見張る やきうが どいて 小屋の前へ、もっとは 板が はずれる。
//   見せおえてから 1つずつ 消す（途中で 閉じても 次に 開いたとき また 見せる）。知らせの 前は 閉じたまま 描く（villageView）。
// - 持ち帰った物（Town.pending）：シヨが あずける物を きいて（一覧は ui/home.ts の chooseStored）、のこりを ロゼが 売り、
//   ゼロが 売り上げを 読む。町が 育ったら 暗転して 建て直し、建った所を 見せて「町が「…」に なった」。
//   決める前に 閉じても pending が 残るので 次に 村に 入ったとき 続きから。選んでいるあいだに 別のタブで
//   決められていたら 何もしない（古い町で 上書きしない）。
// - 倒れたときは 場面も 精算も ない（仲間は 話しかけると 反応する。ui/villageTalk.ts）。
// DOM を 使わない（Story だけ）ので、src/sim/villageTests.ts で 仮の Story を 渡して 試せる。

import { CARRY_MAX, STORAGE_CAP, TOWN_STAGES } from "../core/town";
import type { DungeonId } from "../core/types";
import type { Speaker } from "../data/quotes";
import {
	DUNGEON_NAMES,
	STORY,
	type StoryPage,
	UNLOCK_LINES,
} from "../data/story";
import {
	RETURN_PAGES,
	STAGE_NAMES,
	STAGE_UP,
	TOWN_MSG,
	WAKE_PAGES,
} from "../data/town";
import {
	exitAt,
	lineupSpots,
	VILLAGE_SPOTS,
	type VillageExit,
	type VillageView,
} from "../data/village/map";
import type { Story } from "../engine/defs";
import {
	doneProgressNews,
	loadProgress,
	loadRecords,
	loadTown,
	type PendingReturn,
	settleReturn,
	type Town,
} from "../engine/save";
import type { Dir } from "../engine/types";
import { deathQuote, fill } from "./villageTalk";

/**
 * 開発用：`?stage=N` で 描く 町の段だけ 差しかえる（pnpm dev か ?debug のときだけ）。
 * 保存は 書きかえない（売り上げ・倉庫・会話は 本当の段のまま）。帰ってきた 持ち物の 精算も しない。
 */
export const previewStage = (): number | null => {
	if (typeof location === "undefined") return null;
	const q = new URLSearchParams(location.search);
	if (!import.meta.env.DEV && !q.has("debug")) return null;
	const s = q.get("stage");
	if (s === null || s === "") return null;
	const n = Math.floor(Number(s));
	return Number.isFinite(n) ? Math.max(0, Math.min(TOWN_STAGES - 1, n)) : null;
};

/**
 * いまの 町の段・開いたダンジョン（保存から 読む）。
 * 開いた知らせを まだ 見せていない ダンジョンは 閉じたまま 描く（知らせの 場面で やきうが どく・板が はずれる）。
 */
export const villageView = (): VillageView => {
	const p = loadProgress();
	const fresh = new Set(p.news.map((n) => n.dungeon));
	return {
		stage: previewStage() ?? loadTown().stage,
		unlocked: p.unlocked.filter((d) => !fresh.has(d)),
		cleared: [...p.cleared],
	};
};

// ───────────────── 口から 出てくる ─────────────────

/** 場面の ある 帰り方（持ち帰った・帰還スレ）。 */
export type ReturnArrival = { kind: "clear" | "escape"; dungeon: DungeonId };

const pagesFor = (a: ReturnArrival): readonly StoryPage[] =>
	a.kind === "clear" ? STORY[a.dungeon].ending : RETURN_PAGES;

/** 語りで 話す 仲間（出てくる順）。 */
const castOf = (pages: readonly StoryPage[]): Speaker[] => [
	...new Set(pages.flatMap((p) => (p.who ? [p.who] : []))),
];

/** キリコが 立っている 村の 出口（帰ってきたところ。出口で なければ undefined）。 */
const inMouth = (s: Story, _d: DungeonId): VillageExit | undefined =>
	exitAt(s.state.x, s.state.y);

/** 出口の ほうを 向く（村へ もどる 向きの 逆）。 */
const toward: Record<Dir, Dir> = {
	up: "down",
	down: "up",
	left: "right",
	right: "left",
};

/**
 * 幕が 上がる前に：キリコは 口の奥（まだ 見えない）、話す 仲間は 口の前に 並んで 口を 見ている。
 * v は いま 描いている 村（並ぶ マスを 決める）。
 */
export const lineUp = (s: Story, a: ReturnArrival, v: VillageView): void => {
	const exit = inMouth(s, a.dungeon);
	if (!exit) return;
	const cast = castOf(pagesFor(a));
	const spots = lineupSpots(v, cast.length, exit);
	s.hide("player");
	cast.forEach((who, i) => {
		const c = spots[i];
		if (c) s.place(who, c[0], c[1], toward[exit.inward]);
	});
};

/** 口から 出てきて、並んだ 仲間が 語りを 話す。暗転の あいだに みんな 持ち場へ もどる。 */
export const returnScene = async (
	s: Story,
	a: ReturnArrival,
): Promise<void> => {
	const exit = inMouth(s, a.dungeon);
	if (!exit) return;
	const pages = pagesFor(a);
	s.se("stairs");
	s.show("player");
	await s.move("player", exit.step);
	for (const who of castOf(pages)) s.face(who, "player");
	for (const p of pages)
		await (p.who ? s.say(p.who, p.text) : s.narrate(p.text));
	// 持ち帰りの 曲（ending）は ここまで。明けたら 村の曲
	await Promise.all([
		a.kind === "clear" ? s.fadeBgm(300) : Promise.resolve(),
		s.fadeOut(300),
	]);
	await s.rebuild();
	s.bgm("town");
	await s.fadeIn(300);
};

// ───────────────── たおれて もどったとき ─────────────────

/**
 * たおれて もどった：蓄音機の 前で 目を さまし、仲間が 1人 歩いてきて ひとこと。暗転の あいだに 持ち場へ もどる。
 * だれが 来るか・どの 語りかは 前の冒険（記録の 時刻）で 決まる。
 */
export const deathScene = async (s: Story): Promise<void> => {
	const last = loadRecords()[0];
	if (last?.kind !== "dead") return;
	const seed = Math.floor(last.at / 1000) + last.turn;
	const q = deathQuote(seed);
	await s.narrate(WAKE_PAGES[seed % WAKE_PAGES.length]);
	if (!q) return;
	const [bx, by] = VILLAGE_SPOTS.boot;
	await s.goto(q.who, bx + 1, by, { speed: 1.6 });
	s.face(q.who, "player");
	s.face("player", "right");
	await s.say(q.who, q.text);
	await s.fadeOut(300);
	await s.rebuild();
	await s.fadeIn(300);
};

// ───────────────── 開いた知らせ ─────────────────

/**
 * 次のダンジョンが 開いた 知らせ（持ち帰った・何度も たおれた）。開く口を 見て 仲間が 話し、
 * 村の 出口を 見て 仲間が 話し、「〜に もぐれるように なった」（村の 見た目は 変わらない）。
 */
export const newsScript = async (s: Story): Promise<void> => {
	for (const n of loadProgress().news) {
		const colony = !["main", "deep"].includes(n.dungeon);
		const name = DUNGEON_NAMES[n.dungeon].name;
		const lines = UNLOCK_LINES[
			n.dungeon === "hidden"
				? "hidden"
				: colony
					? "colony"
					: n.reason === "relief"
						? "relief"
						: n.dungeon === "deep"
							? "deep"
							: "main"
		].map((l) => ({ ...l, text: l.text.replace("{name}", name) }));
		// 村の 出口の 方を 見る（行き先は 出口から 全体マップで 選ぶ）
		await s.look(VILLAGE_SPOTS.exit);
		for (const l of lines) await s.say(l.who, l.text);
		doneProgressNews(n);
		s.se("chapter");
		await s.narrate(
			`「${DUNGEON_NAMES[n.dungeon].name}」に\nもぐれるように　なった`,
		);
		await s.look(null);
	}
};

// ───────────────── 持ち帰った物 ─────────────────

/** あずける道具を えらぶ（uid）。村では ui/home.ts の chooseStored を 包む（試験では 仮の手）。 */
export type StoreChooser = (
	s: Story,
	t: Town,
	pend: PendingReturn,
) => Promise<number[]>;

/**
 * 持ち帰った物を 倉庫へ・売る（おあずかりが 無ければ 何もしない）。
 * 持ち帰っても 帰還スレでも、倉庫が あれば シヨが あずける物を きく。のこりは 売って ゼロが 売り上げを 読む。
 */
export const settleScript = async (
	s: Story,
	choose: StoreChooser,
): Promise<void> => {
	const t = loadTown();
	const pend = t.pending;
	if (!pend) return;
	const cap = STORAGE_CAP[t.stage] ?? 0;
	// 持ち帰っても 帰還スレでも、倉庫が あれば シヨが あずかる 物を きく
	const canStore = cap > 0;
	const say = (l: { who: Speaker; text: string }) => s.say(l.who, l.text);
	let chosen: number[] = [];
	if (!pend.items.length)
		await say(canStore ? TOWN_MSG.nothingToStore : TOWN_MSG.soldNothing);
	else if (canStore) {
		if (t.storage.length >= cap) await say(TOWN_MSG.storageFull);
		else {
			await say(TOWN_MSG.storePrompt);
			await s.wait(0);
			chosen = await choose(s, t, pend);
		}
	} else await say(TOWN_MSG.noStorage);
	// 選んでいるあいだに 別のタブで 決められていたら、ここでは 何もしない（古い町で 上書きしない）
	const cur = loadTown();
	if (JSON.stringify(cur.pending) !== JSON.stringify(pend)) return;
	const r = settleReturn(cur, chosen);
	if (chosen.length) await say(TOWN_MSG.storeDone);
	if (r.sold > 0)
		await s.say(
			TOWN_MSG.sold.who,
			fill(TOWN_MSG.sold.text, { points: r.sold }),
		);
	if (r.to > r.from) await stageUp(s, r.from, r.to);
};

/** 町が 育った：暗転して 建て直し、建った所を 見せて 知らせる。仲間の ひとことと 持ちこみの 数。 */
const stageUp = async (s: Story, from: number, to: number): Promise<void> => {
	await s.fadeOut(400);
	await s.rebuild();
	await s.look(VILLAGE_SPOTS.growth(to), { instant: true });
	await s.fadeIn(400);
	s.se("levelup");
	s.toast(`町が　「${STAGE_NAMES[to] ?? ""}」に　なった`);
	for (const l of STAGE_UP[to] ?? []) await s.say(l.who, l.text);
	const carry = CARRY_MAX[to] ?? 0;
	if (carry > (CARRY_MAX[from] ?? 0))
		await s.narrate(`倉庫から　風呂板へ\n${carry}つまで　持っていける`);
	await s.look(null);
};
