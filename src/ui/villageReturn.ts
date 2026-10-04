// 村（保守村）に 帰ってきたときの 場面（ui/village.ts が 村に 入るたびに 走らせる。つなぎは ui/villageEvents.ts）。
// トルネコ1と 同じ順：口から 出る → 仲間が むかえる → 開いた知らせ → 持ち帰った物を 倉庫へ・売る → 町が 育つ。
//
// - 持ち帰った・帰還スレ：キリコが 口の奥から 出てくると、口の前に 仲間が 並んで 待っている（幕が 上がる前に
//   並べる。lineUp）。持ち帰りの 語り（STORY[d].ending）か 帰還スレの 語り（RETURN_PAGES）を 村の窓で 話して、
//   暗転の あいだに 持ち場へ もどる（囲いの中の ロゼ・シヨは 歩いては 帰れない）。語りは 保存しない（閉じたら それきり）。
//   ボスを たおして 一瞬で 帰ったときは、着いた 語り（ending の 1枚目）の あとに どう 帰ったかの 1〜2枚（BOSS_RETURN[d]）。
// - 開いた知らせ（Progress.news）：本編は 口の前で 見張る やきうが どいて 小屋の前へ、もっとは 板が はずれる。
//   見せおえてから 1つずつ 消す（途中で 閉じても 次に 開いたとき また 見せる）。知らせの 前は 閉じたまま 描く（villageView）。
//   期間限定の イベントの 始まり・終わり（Progress.eventNews。data/objectives.ts）も そのあとに 1〜2行。
// - 持ち帰った物（Town.pending）：シヨが あずける物を きいて（一覧は ui/home.ts の chooseStored）、のこりを ロゼが 売り、
//   ゼロが 売り上げを 読む。町が 育ったら 暗転して 建て直し、建った所を 見せて「町が「…」に なった」
//   （おんJ 本館の 形が かわった 段なら 本館も 見せる）。
//   決める前に 閉じても pending が 残るので 次に 村に 入ったとき 続きから。選んでいるあいだに 別のタブで
//   決められていたら 何もしない（古い町で 上書きしない）。
// - 倒れたときは 場面も 精算も ない（仲間は 話しかけると 反応する。ui/villageTalk.ts）。
// - キリコは 1人で 動いている。知らせ・精算・町が 育つ 場面で 話す 仲間が 遠ければ（TALK_NEAR より 先）、
//   暗転の あいだに キリコの そばへ 呼び（gather）、場面の 終わりに 建て直して 持ち場へ もどす（sendBack）。
//   離れた 人の 声だけが 飛んでくる 掛け合いは しない（そばに いる 人とだけ 話す）。
// DOM を 使わない（Story だけ）ので、src/sim/villageTests.ts で 仮の Story を 渡して 試せる。

import {
	CARRY_MAX,
	lastStepOf,
	STORAGE_CAP,
	TOWN_STAGES,
	townStep,
} from "../core/town";
import type { DungeonId, Objective } from "../core/types";
import { MOB_IDS, MOBS, type MobId, PUYU_LUNCH } from "../data/mobs";
import { eventById, eventNewsText } from "../data/objectives";
import type { Speaker } from "../data/quotes";
import { SPEAKERS } from "../data/quotes";
import {
	awayFriends,
	BOSS_RETURN,
	DEPART,
	DUNGEON_NAMES,
	endingFor,
	FRIEND_FROM,
	mentionsAway,
	playPage,
	type StoryPage,
	UNLOCK_LINES,
	UNLOCK_VISIT,
	withoutAway,
} from "../data/story";
import { TAMPER_NARRATION, TAMPER_SCENE, tamperTier } from "../data/tamper";
import {
	ARRIVE_MSG,
	BARE_TOWN_MSG,
	RETURN_PAGES,
	SOLD_BARE,
	STAGE_NAMES,
	STAGE_UP,
	STAGE_UP_HALL,
	TOWN_GREW_MSG,
	TOWN_MSG,
	WAKE_PAGES,
} from "../data/town";
import {
	exitAt,
	exitFor,
	lineupSpots,
	spotsAround,
	VILLAGE_EXITS,
	VILLAGE_SPOTS,
	type VillageExit,
	type VillageView,
} from "../data/village/map";
import { hallTier } from "../data/village/tiles";
import type { Story } from "../engine/defs";
import {
	doneEventNews,
	doneProgressNews,
	giveLunch,
	growForStorage,
	loadProgress,
	loadRecords,
	loadTown,
	noteEnding,
	type PendingReturn,
	type Progress,
	settleReturn,
	type Town,
} from "../engine/save";
import { doneTamperNews, loadTamper } from "../engine/tamper";
import type { Dir } from "../engine/types";
import { sayAs } from "./villageMobs";
import { villageSong } from "./villageMusic";
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
	const t = loadTown();
	const preview = previewStage();
	return {
		stage: preview ?? t.stage,
		unlocked: p.unlocked.filter((d) => !fresh.has(d)),
		cleared: [...p.cleared],
		// 下見（?stage=N）は その 段の いちばん上（住人は みんな いる）
		step: preview === null ? townStep(t.stage, t.points) : lastStepOf(preview),
	};
};

// ───────────────── 口から 出てくる ─────────────────

/** 場面の ある 帰り方（持ち帰った・帰還スレ）。objective が boss なら ボスを たおして 一瞬で 帰った。 */
export type ReturnArrival = {
	kind: "clear" | "escape";
	dungeon: DungeonId;
	objective?: Objective;
};

/** はじめて 見る 持ち帰りの 語りか（見おえるまでは その 板を まだ 持ち帰って いない 村で 語る）。 */
const firstEnding = (a: ReturnArrival, p: Progress): boolean =>
	a.kind === "clear" && !(p.endings ?? []).includes(a.dungeon);

/**
 * 場面で 村に いない 仲間。はじめての 持ち帰りの 語りは その 板を 持ち帰る 前の 村で 語る
 * （電池板の 山場は やきうが 出ていく 場面なので、やきうは まだ いる）。
 */
const sceneAway = (a: ReturnArrival, p: Progress): Speaker[] =>
	awayFriends(
		firstEnding(a, p) ? p.cleared.filter((d) => d !== a.dungeon) : p.cleared,
		loadTown().stage,
	);

/**
 * 帰ってきた 場面の 村（はじめての 持ち帰りの 語りの あいだは、その 板を まだ 持ち帰って いない 村。
 * 語りの あと 暗転で 建て直すと いまの 村に なる）。
 */
export const sceneView = (v: VillageView, a: ReturnArrival): VillageView =>
	firstEnding(a, loadProgress())
		? { ...v, cleared: v.cleared.filter((d) => d !== a.dungeon) }
		: v;

/**
 * 村で 話す 語り（品を 持ち帰った ことは 同じ）。ボスなら 持ち帰りの 語りの 1枚目（「村に　帰りつくと、…」の
 * 着いた 語り）の あとに どう 帰ったかの 頁を はさむ（仲間が 声を かけるのは 着いてから）。
 * 一度きりの 語りは 見おえたら 短い 語りに かわる。村に いない 仲間の 頁は かわりに かえる（data/story.ts）。
 */
export const pagesFor = (
	a: ReturnArrival,
	p: Progress = loadProgress(),
): readonly StoryPage[] => {
	const away = sceneAway(a, p);
	if (a.kind !== "clear") return withoutAway(RETURN_PAGES, away);
	const ending = endingFor(a.dungeon, !firstEnding(a, p), away);
	const boss = a.objective === "boss" ? (BOSS_RETURN[a.dungeon] ?? []) : [];
	return withoutAway(
		boss.length ? [ending[0], ...boss, ...ending.slice(1)] : ending,
		away,
	);
};

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
	for (const p of pages) await playPage(s, p);
	// 見おえた（一度きりの 語りは 次から 短く。やきうが 出ていく 語りなら、建て直すと 村に いない）
	if (a.kind === "clear") noteEnding(a.dungeon);
	// 持ち帰りの 曲（ending）は ここまで。明けたら 村の曲
	await Promise.all([
		a.kind === "clear" ? s.fadeBgm(300) : Promise.resolve(),
		s.fadeOut(300),
	]);
	await s.rebuild();
	s.bgm(villageSong());
	await s.fadeIn(300);
};

// ───────────────── 話す 仲間を そばに ─────────────────

/** これより 離れた 仲間とは 話さない（キリコは 1人で 動いている。村の 窓で 話すのは そばに いる 人だけ）。 */
export const TALK_NEAR = 2;

/** 仲間を 持ち場から 呼んだ 場面（あとで 建て直して 持ち場へ もどす）。 */
const called = new WeakSet<Story>();

/**
 * 村の 場面で 話す 仲間を キリコの そばへ（離れた 人の 声が 飛んでこないように）。遠い 人だけ、暗転の あいだに
 * キリコの まわりへ 置いて こちらを 向かせる。dark なら もう 暗い（明けるのは 呼ぶ側）。
 * もどすのは sendBack（場面の 終わりに 建て直す）。
 * at を わたすと キリコでは なく その マスの まわりへ（カメラが 建物を 見ている 場面。みんな 置きなおす）。
 */
export const gather = async (
	s: Story,
	who: readonly (Speaker | null)[],
	opt: { dark?: boolean; at?: readonly [number, number] } = {},
): Promise<void> => {
	const far = [...new Set(who.filter((w): w is Speaker => !!w))].filter(
		(w) => !!opt.at || !s.near(w, TALK_NEAR),
	);
	if (!far.length) return;
	if (!opt.dark) await s.fadeOut(250);
	const at = opt.at ?? [s.state.x, s.state.y];
	const spots = spotsAround(villageView(), far.length, [
		Math.round(at[0]),
		Math.round(at[1]),
	]);
	far.forEach((w, i) => {
		const c = spots[i];
		if (!c) return;
		s.place(w, c[0], c[1]);
		if (opt.at) s.face(w, c[1] > at[1] ? "up" : "down");
		else s.face(w, "player");
	});
	called.add(s);
	if (!opt.dark) await s.fadeIn(250);
};

/** gather で 呼んだ 仲間を 持ち場へ もどす（暗転して 建て直す）。呼んでいなければ 何もしない。 */
export const sendBack = async (s: Story): Promise<void> => {
	if (!called.has(s)) return;
	called.delete(s);
	await s.fadeOut(250);
	await s.rebuild();
	await s.fadeIn(250);
};

// ───────────────── 寄り道の 板の 来客 ─────────────────

/**
 * 寄り道の 板が 開く：その 板の 名無しが 板の 方角の 村の 口から 歩いてきて、キリコの となりで 板の ようすを
 * 話し、口へ 帰っていく（data/story.ts の UNLOCK_VISIT）。
 */
export const visitScript = async (s: Story, d: DungeonId): Promise<void> => {
	const lines = UNLOCK_VISIT[d] ?? [];
	const gate = exitFor(d).cell;
	const [to] = spotsAround(villageView(), 1, [s.state.x, s.state.y]);
	s.set("visitor");
	s.place("visitor", gate[0], gate[1]);
	await s.look("visitor");
	if (to) {
		await s.goto("visitor", to[0], to[1], { speed: 1.4 });
		s.face("visitor", "player");
	}
	await s.look(null);
	for (const [i, l] of lines.entries()) {
		// さいごの 地の文（帰っていった）の 前に 口へ 歩いて 帰る
		if (l.who === null && i === lines.length - 1) {
			await s.wait(0);
			await s.goto("visitor", gate[0], gate[1], { speed: 1.4 });
			s.set("visitor", false);
		}
		if (l.who === "visitor") await s.say("nanj", l.text, { name: "名無し" });
		else await s.narrate(l.text);
	}
	s.set("visitor", false);
};

// ───────────────── セーブの 書きかえ ─────────────────

/**
 * セーブを 書きかえたのが 見つかって 帰ってきた（engine/tamper.ts）：ゼロが 帳簿で 気づき、そばの 仲間が
 * ひとこと（村に いる 人から 3人まで）。見せおえてから 消す（途中で 閉じたら 次も 見せる）。
 */
export const tamperScript = async (s: Story): Promise<void> => {
	const t = loadTamper();
	if (!t.news) return;
	const tier = tamperTier(t.n);
	const away = awayFriends(loadProgress().cleared, loadTown().stage);
	const lines = (TAMPER_SCENE[tier] ?? [])
		.filter((l) => !away.includes(l.who))
		.slice(0, 3);
	await gather(
		s,
		lines.map((l) => l.who),
	);
	for (const l of lines) await s.say(l.who, l.text);
	await s.narrate(TAMPER_NARRATION[tier] ?? "");
	doneTamperNews();
};

// ───────────────── ぷゆゆの お弁当 ─────────────────

/**
 * 村に 帰って 持ち物（倉庫から 引き取った 道具）が からっぽなら、ぷゆゆが かけてきて ぷゆゆパンを 持たせる
 * （トルネコ1の ネネの お弁当の 役。出るときに 持っていく。data/story.ts の DEPART.puyu）。
 */
export const lunchScript = async (s: Story): Promise<void> => {
	if (!giveLunch()) return;
	// ぷゆゆが キリコの となりまで かけてきて 渡す（そのまま そばに いる）
	const [to] = spotsAround(villageView(), 1, [s.state.x, s.state.y]);
	if (to) {
		await s.goto("mob_puyu", to[0], to[1], { speed: 1.6 });
		s.face("mob_puyu", "player");
		s.face("player", faceTo(s.state, to));
	}
	await sayAs(
		s,
		"puyu",
		PUYU_LUNCH[Math.floor(Math.random() * PUYU_LUNCH.length)] ?? "",
	);
	s.se("item");
	await s.narrate(DEPART.puyu);
};

/** from から to を 向く 向き（たて・よこの 大きい方）。 */
const faceTo = (
	from: { x: number; y: number },
	[x, y]: readonly [number, number],
): Dir => {
	const dx = x - from.x;
	const dy = y - from.y;
	return Math.abs(dx) >= Math.abs(dy)
		? dx < 0
			? "left"
			: "right"
		: dy < 0
			? "up"
			: "down";
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
	// 出ていった 仲間は 知らせでも 話さない
	const away = awayFriends(loadProgress().cleared, loadTown().stage);
	// 知らせを 話す 仲間を そばへ
	const news = loadProgress().news;
	if (news.length)
		await gather(
			s,
			Object.values(UNLOCK_LINES)
				.flat()
				.map((l) => l.who)
				.filter((w) => !away.includes(w)),
		);
	for (const n of news) {
		// 寄り道の 板：その 板の 名無しが 来て 話す（仲間の ひとことの かわり）
		if (UNLOCK_VISIT[n.dungeon]) {
			await visitScript(s, n.dungeon);
			doneProgressNews(n);
			s.se("chapter");
			await s.narrate(
				`「${DUNGEON_NAMES[n.dungeon].name}」に\nもぐれるように　なった`,
			);
			continue;
		}
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
		]
			.filter((l) => !away.includes(l.who) && !mentionsAway(l.text, away))
			.map((l) => ({ ...l, text: l.text.replace("{name}", name) }));
		// 村の 出口の 方を 見る（行き先は 出口から 全体マップで 選ぶ）
		await s.look(VILLAGE_SPOTS.exit);
		// たおれて 蓄音機の 前に いるとき（relief）など、出口が キリコから 遠ければ 見せてから キリコに もどして 話す
		const [ex, ey] = VILLAGE_SPOTS.exit;
		if (Math.max(Math.abs(s.state.x - ex), Math.abs(s.state.y - ey)) > 3)
			await s.look(null);
		for (const l of lines) await s.say(l.who, l.text);
		doneProgressNews(n);
		s.se("chapter");
		await s.narrate(
			`「${DUNGEON_NAMES[n.dungeon].name}」に\nもぐれるように　なった`,
		);
		await s.look(null);
	}
	// 期間限定の イベントが 終わった・始まった（見せてから 1つずつ 消す。知らない id は 黙って 消す）
	for (const n of loadProgress().eventNews ?? []) {
		const e = eventById(n.id);
		if (e) {
			if (n.started) s.se("chapter");
			for (const t of eventNewsText(e, n.started)) await s.narrate(t);
		}
		doneEventNews(n);
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
	// ぜんぶ 売れば 倉庫が 広がる 帰りは、先に 町が 育って から あずける 物を きく（売ってから 建つと 悲しい）
	const stepBefore = townStep(t.stage, t.points);
	const grown = growForStorage(t);
	if (grown.to > grown.from) {
		const stepMid = townStep(t.stage, t.points);
		await stageUp(s, grown.from, grown.to, movingIn(stepBefore, stepMid));
		await movedIn(s, stepBefore, stepMid, true);
	}
	const cap = STORAGE_CAP[t.stage] ?? 0;
	// 持ち帰っても 帰還スレでも、倉庫が あれば シヨが あずかる 物を きく
	const canStore = cap > 0;
	// まだ 来ていない 仲間の 行は、やきうの 行（BARE_TOWN_MSG）か 地の文に かわる（data/story.ts の FRIEND_FROM）
	const away = awayFriends(loadProgress().cleared, t.stage);
	const here = (w: Speaker) => !away.includes(w);
	const say = (l: { who: Speaker; text: string }) => {
		if (here(l.who)) return s.say(l.who, l.text);
		const bare = BARE_TOWN_MSG.find((b) => b.of === l);
		return bare && here(bare.line.who)
			? s.say(bare.line.who, bare.line.text)
			: Promise.resolve();
	};
	// あずかる シヨ・売る ロゼ・読む ゼロを そばへ（いる 人だけ）
	await gather(
		s,
		(pend.items.length
			? [
					canStore ? TOWN_MSG.storePrompt : TOWN_MSG.noStorage,
					TOWN_MSG.sellRest,
					TOWN_MSG.sold,
				]
			: [canStore ? TOWN_MSG.nothingToStore : TOWN_MSG.soldNothing]
		).map((l) =>
			here(l.who)
				? l.who
				: (BARE_TOWN_MSG.find((b) => b.of === l)?.line.who ?? null),
		),
	);
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
	// 売る 前の 小段（売れて 小段が 上がると 住人が 越してくる）
	const stepFrom = townStep(cur.stage, cur.points);
	const stageFrom = cur.stage;
	const r = settleReturn(cur, chosen, grown.from);
	if (chosen.length) await say(TOWN_MSG.storeDone);
	if (r.sold > 0) {
		// ゼロが まだ いなければ 地の文で
		if (here(TOWN_MSG.sold.who))
			await s.say(
				TOWN_MSG.sold.who,
				fill(TOWN_MSG.sold.text, { points: r.sold }),
			);
		else await s.narrate(fill(SOLD_BARE, { points: r.sold }));
	}
	const stepTo = townStep(r.to, loadTown().points);
	if (r.to > stageFrom)
		await stageUp(s, stageFrom, r.to, movingIn(stepFrom, stepTo));
	await movedIn(s, stepFrom, stepTo, r.to > stageFrom);
};

/**
 * 小段が 上がって 住人が 越してきた（data/mobs.ts の from）。越してきた 子を 見せて「〜が、村に　越してきた。」。
 * 建物の 段が 上がった ときは stageUp で もう 建て直して いるので、見せて 知らせる だけ。
 * 小段だけの ときは 暗転して 建て直し、町に 人が ふえた 知らせ。1回の 帰りで 何人でも（まとめて 1回）。
 */
const movedIn = async (
	s: Story,
	from: number,
	to: number,
	rebuilt: boolean,
): Promise<void> => {
	const ids = movingIn(from, to);
	if (!ids.length) return;
	// 越してきた 子は 村の 口（持ち場に いちばん 近い 出口）から 歩いてきて、持ち場に 着いてから 知らせる
	if (!rebuilt) {
		await s.fadeOut(300);
		await s.rebuild();
	} else await s.fadeOut(200);
	for (const id of ids) s.hide(`mob_${id}`);
	await s.look(gateNear(MOBS[ids[0]].spot), { instant: true });
	await s.fadeIn(300);
	if (!rebuilt) {
		s.se("served");
		s.toast(TOWN_GREW_MSG);
	}
	for (const id of ids) {
		await walkIn(s, `mob_${id}`, MOBS[id].spot);
		s.face(`mob_${id}`, MOBS[id].dir);
	}
	await s.narrate(
		fill(ARRIVE_MSG, { names: ids.map((id) => MOBS[id].name).join("と　") }),
	);
	await s.look(null);
};

/** 小段 from → to で 越してくる 住人。 */
const movingIn = (from: number, to: number): MobId[] =>
	MOB_IDS.filter((id) => MOBS[id].from > from && MOBS[id].from <= to);

/** (x, y) に いちばん 近い 村の 口。 */
const gateNear = ([x, y]: readonly [number, number]): readonly [
	number,
	number,
] =>
	[...VILLAGE_EXITS].sort(
		(a, b) =>
			Math.max(Math.abs(a.cell[0] - x), Math.abs(a.cell[1] - y)) -
			Math.max(Math.abs(b.cell[0] - x), Math.abs(b.cell[1] - y)),
	)[0]?.cell ?? [x, y];

/** 越してきた 人（イベント ID）が 行き先に いちばん 近い 村の 口から 歩いてくる（カメラが ついていく）。 */
const walkIn = async (
	s: Story,
	ev: string,
	to: readonly [number, number],
): Promise<void> => {
	const [gx, gy] = gateNear(to);
	s.place(ev, gx, gy);
	s.show(ev);
	await s.look(ev);
	await s.goto(ev, to[0], to[1], { speed: 1.3 });
};

/**
 * 町が 育った：暗転して 建て直し、建った所を 見せて 知らせる。仲間の ひとことと 持ちこみの 数。
 * おんJ 本館の 形が かわったら（段3・6。段を とばしても）本館を 見て ひとこと。
 */
const stageUp = async (
	s: Story,
	from: number,
	to: number,
	arriving: readonly MobId[] = [],
): Promise<void> => {
	// 話すのは 村に いる 人だけ（まだ 来ていない・出ていった 仲間の 行は 出さない）
	const away = awayFriends(loadProgress().cleared, to);
	const lines = (STAGE_UP[to] ?? []).filter(
		(l) => !away.includes(l.who) && !mentionsAway(l.text, away),
	);
	const hall =
		hallTier(to) > hallTier(from) ? STAGE_UP_HALL[hallTier(to)] : null;
	const hallLine = hall && !away.includes(hall.who) ? hall : null;
	// この 段で 越してきた 仲間（data/story.ts の FRIEND_FROM）
	const moved = (Object.keys(FRIEND_FROM) as Speaker[]).filter(
		(w) => FRIEND_FROM[w] > from && FRIEND_FROM[w] <= to && !away.includes(w),
	);
	const at = VILLAGE_SPOTS.growth(to);
	await s.fadeOut(400);
	await s.rebuild();
	// 話す 仲間は カメラが 見る 建った所の まわりへ（暗い うちに）。越してきた 仲間は あとから 歩いてくるので
	// その 場所だけ とっておいて 隠す。このあと 越してくる 住人（movedIn）も まだ 見せない
	const talkers = [...new Set([...lines.map((l) => l.who), ...moved])];
	await gather(s, talkers, { dark: true, at });
	const spots = spotsAround(villageView(), talkers.length, [
		Math.round(at[0]),
		Math.round(at[1]),
	]);
	for (const w of moved) s.hide(w);
	for (const id of arriving) s.hide(`mob_${id}`);
	await s.look(at, { instant: true });
	await s.fadeIn(400);
	s.se("levelup");
	s.toast(`町が　「${STAGE_NAMES[to] ?? ""}」に　なった`);
	if (moved.length) {
		for (const w of moved) {
			const c = spots[talkers.indexOf(w)];
			if (!c) continue;
			await walkIn(s, w, c);
			s.face(w, c[1] > at[1] ? "up" : "down");
		}
		await s.narrate(
			fill(ARRIVE_MSG, {
				names: moved.map((w) => SPEAKERS[w].name).join("と　"),
			}),
		);
		await s.look(at);
	}
	for (const l of lines) await s.say(l.who, l.text);
	if (hallLine) {
		// 本館を 見せてから、話す 人が 本館の 前まで 歩いていって 言う（カメラが ついていく）
		await s.look(VILLAGE_SPOTS.hallLook);
		const [door] = VILLAGE_SPOTS.hallDoors;
		const [front] = spotsAround(villageView(), 1, [door[0], door[1] + 1]);
		if (front) {
			await s.look(hallLine.who);
			await s.goto(hallLine.who, front[0], front[1], { speed: 1.4 });
			s.face(hallLine.who, "up");
		}
		await s.say(hallLine.who, hallLine.text);
	}
	const carry = CARRY_MAX[to] ?? 0;
	if (carry > (CARRY_MAX[from] ?? 0))
		await s.narrate(`倉庫から　引き取って\n${carry}つまで　持っていける`);
	await s.look(null);
};
