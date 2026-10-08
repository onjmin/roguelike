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
import {
	MOB_IDS,
	MOBS,
	type MobId,
	movedIn as mobsMovedIn,
	PUYU_LUNCH,
} from "../data/mobs";
import { eventById, eventNewsText } from "../data/objectives";
import type { Speaker } from "../data/quotes";
import { SPEAKERS } from "../data/quotes";
import {
	ATO_NEWS,
	awayFriends,
	BOSS_RETURN,
	DEPART,
	DUNGEON_NAMES,
	endingFor,
	FRIEND_FROM,
	GETTER_RETRY,
	HINAN_NEWS,
	KUSA_NEWS,
	mentionsAway,
	playPage,
	ROM_COUNT,
	type StoryPage,
	UNLOCK_LINES,
	UNLOCK_VISIT,
	WRAP_NEWS,
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
	STAGE_UP_HALL_INSTEAD,
	TOWN_GREW_MSG,
	TOWN_MSG,
	WAKE_PAGES,
} from "../data/town";
import {
	exitAt,
	exitFor,
	lineupSpots,
	spotsAround,
	stepOf,
	VILLAGE_EXITS,
	VILLAGE_SPOTS,
	type VillageExit,
	type VillageView,
} from "../data/village/map";
import { hallTier } from "../data/village/tiles";
import type { Story } from "../engine/defs";
import {
	addFlag,
	doneEventNews,
	doneProgressNews,
	giveLunch,
	growForStorage,
	loadProgress,
	loadRecords,
	loadTown,
	noteEnding,
	noteWrap,
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
	const ending = endingFor(a.dungeon, !firstEnding(a, p), away, p.cleared);
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

/** 語りで 口を はさむ 住人（data/mobs.ts。出てくる順）。 */
const mobsOf = (pages: readonly StoryPage[]): MobId[] => [
	...new Set(pages.flatMap((p) => (p.mob ? [p.mob] : []))),
];

/**
 * 語りで 話す 住人の うち、いま 村に 立っている 子（after の 板を 持ち帰った あと）。まだ いない 子は、
 * 語りの 中で 村の 口から 歩いてくる（NEWCOMER の 旗の 人。ui/villageEvents.ts の buildVillage）。
 */
const mobsHere = (pages: readonly StoryPage[], v: VillageView): MobId[] =>
	mobsOf(pages).filter((id) => {
		const d = MOBS[id];
		return d.after ? v.cleared.includes(d.after) : stepOf(v) >= d.from;
	});

/** 語りの 中で 越してくる 住人の 旗（この 旗が 立っている あいだだけ 村に いる 人の イベント ID）。 */
export const NEWCOMER = "newcomer";

/** 跡地の 結で 口から 来る ROM専 18体の 旗と イベント ID の 頭（`roms_0`〜。ui/villageEvents.ts の buildVillage）。 */
export const ROMS = "roms";

/** 帰りの 場面の 外の 手（別ゲー。試験では 渡さない：合図は とばす）。 */
export type ReturnHooks = {
	/** 1000取り（避難Jの 結）。勝てば true。負けたら 次スレで もう一度 きく。 */
	getter?: () => Promise<boolean>;
};

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
	const pages = pagesFor(a);
	const cast = castOf(pages);
	// 口を はさむ 住人が 村に いれば、仲間の あとに 並ぶ（遠くから 声だけ 飛ばさない）
	const mobs = mobsHere(pages, v).map((id) => `mob_${id}`);
	const spots = lineupSpots(v, cast.length + mobs.length, exit);
	s.hide("player");
	[...cast, ...mobs].forEach((who, i) => {
		const c = spots[i];
		if (c) s.place(who, c[0], c[1], toward[exit.inward]);
	});
};

/**
 * 語りの 中で 越してくる 住人（after の 板を はじめて 持ち帰った とき）：その 板の 方角の 村の 口から 歩いてきて、
 * キリコの そばに 立つ。旗 NEWCOMER の 人を 動かす（絵は その子の 歩行グラ）。語りの あとの 建て直しで 本人に かわる。
 */
/**
 * キリコが 口の 前（出てきた マス）に 立っていると、口から 入る 道を ふさいでしまう（goto は キリコの マスを よける）。
 * 口から 歩いてくる 人の 前に、キリコを となりの 空いた マスへ 1歩 どかす。
 */
const stepAside = async (s: Story): Promise<void> => {
	const [to] = spotsAround(villageView(), 1, [s.state.x, s.state.y]);
	if (to) await s.goto("player", to[0], to[1], { speed: 1.2 });
};

const walkInMob = async (s: Story, d: DungeonId): Promise<void> => {
	const gate = exitFor(d).cell;
	await stepAside(s);
	const [to] = spotsAround(villageView(), 1, [s.state.x, s.state.y]);
	// 旗を 立てただけでは 人は 生まれない（when は 見なおされない）。show で 生まれさせてから 置く
	s.set(NEWCOMER);
	s.show(NEWCOMER);
	s.place(NEWCOMER, gate[0], gate[1]);
	await s.look(NEWCOMER);
	if (to) {
		await s.goto(NEWCOMER, to[0], to[1], { speed: 1.2 });
		s.face(NEWCOMER, "player");
		s.face("player", faceTo(s.state, to));
	}
	await s.look(null);
};

/**
 * 跡地の 結：ROM専 18体が 板の 方角の 口から 歩いてきて、キリコの まわりに 立つ（旗 ROMS の 人を 動かす。
 * まわりの 空いた マスに 入りきらない 分は 口の そばに 残る）。
 */
const walkInRoms = async (s: Story, d: DungeonId): Promise<void> => {
	const gate = exitFor(d).cell;
	await stepAside(s);
	const spots = spotsAround(villageView(), ROM_COUNT, [s.state.x, s.state.y]);
	s.set(ROMS);
	for (let i = 0; i < ROM_COUNT; i++) {
		// 旗を 立てただけでは 生まれない：show で 生まれさせてから 口に 置く
		s.show(`${ROMS}_${i}`);
		s.place(`${ROMS}_${i}`, gate[0], gate[1]);
	}
	await s.look(`${ROMS}_0`);
	await Promise.all(
		spots.map((to, i) =>
			s.goto(`${ROMS}_${i}`, to[0], to[1], { speed: 1.4 + (i % 3) * 0.2 }),
		),
	);
	for (let i = 0; i < ROM_COUNT; i++) s.face(`${ROMS}_${i}`, "player");
	await s.look(null);
};

/** ROM専たちが 口へ 帰っていく（また 見る 側へ）。 */
const walkOutRoms = async (s: Story, d: DungeonId): Promise<void> => {
	const gate = exitFor(d).cell;
	await Promise.all(
		Array.from({ length: ROM_COUNT }, (_, i) =>
			s.goto(`${ROMS}_${i}`, gate[0], gate[1], { speed: 1.4 + (i % 3) * 0.2 }),
		),
	);
	s.set(ROMS, false);
	for (let i = 0; i < ROM_COUNT; i++) s.hide(`${ROMS}_${i}`);
};

/**
 * 語りの 合図（data/quotes.ts の StoryPage.cue）を 起こす。roms・romsLeave は ROM専の 歩き、getter は 1000取り
 * （勝つまで 次スレで くり返す。手が 無ければ とばす）。
 */
const playCue = async (
	s: Story,
	a: ReturnArrival,
	c: NonNullable<StoryPage["cue"]>,
	hooks: ReturnHooks,
): Promise<void> => {
	if (c === "roms") await walkInRoms(s, a.dungeon);
	else if (c === "romsLeave") await walkOutRoms(s, a.dungeon);
	// 蓄音機で キリコ 自身の 声を 鳴らす（裏の 2段目の 結。ダンジョンで 声を 鳴らす ときと 同じ 音）
	else if (c === "selfVoice") s.se("spell");
	else if (c === "getter" && hooks.getter) {
		for (let tries = 0; ; tries++) {
			if (await hooks.getter()) break;
			await s.narrate(GETTER_RETRY[Math.min(tries, GETTER_RETRY.length - 1)]);
		}
	}
};

/** 口から 出てきて、並んだ 仲間が 語りを 話す。暗転の あいだに みんな 持ち場へ もどる。 */
export const returnScene = async (
	s: Story,
	a: ReturnArrival,
	hooks: ReturnHooks = {},
): Promise<void> => {
	const exit = inMouth(s, a.dungeon);
	if (!exit) return;
	const pages = pagesFor(a);
	// はじめての 持ち帰りの 語りの あいだは、その 板で 来る 子は まだ いない（sceneView）
	const here = mobsHere(pages, sceneView(villageView(), a));
	s.se("stairs");
	s.show("player");
	await s.move("player", exit.step);
	for (const who of castOf(pages)) s.face(who, "player");
	for (const id of here) s.face(`mob_${id}`, "player");
	let newcomer = false;
	for (const p of pages) {
		if (p.cue) await playCue(s, a, p.cue, hooks);
		if (p.mob) {
			// まだ 村に いない 住人は、はじめて 口を ひらく 前に 口から 歩いてくる
			if (!here.includes(p.mob) && !newcomer) {
				newcomer = true;
				await walkInMob(s, a.dungeon);
			}
			await sayAs(s, p.mob, p.text);
		} else await playPage(s, p);
	}
	// 見おえた（一度きりの 語りは 次から 短く。やきうが 出ていく 語りなら、建て直すと 村に いない）
	if (a.kind === "clear") noteEnding(a.dungeon);
	// 持ち帰りの 曲（ending）は ここまで。明けたら 村の曲
	await Promise.all([
		a.kind === "clear" ? s.fadeBgm(300) : Promise.resolve(),
		s.fadeOut(300),
	]);
	s.set(NEWCOMER, false);
	s.set(ROMS, false);
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

/**
 * gather で 呼んだ 仲間を 持ち場へ もどす（暗転して 建て直す）。呼んでいなければ 何もしない。
 * カメラも 暗い うちに キリコへ もどす（町が 育った 場面は 建った所を 見たまま ここへ 来る。lookHome）。
 */
export const sendBack = async (s: Story): Promise<void> => {
	if (!called.has(s)) return;
	called.delete(s);
	await s.fadeOut(250);
	await s.rebuild();
	await s.look(null, { instant: true });
	await s.fadeIn(250);
};

/**
 * 場面の 終わりに カメラを キリコへ。仲間を 呼んでいれば すぐ sendBack の 暗転が 来るので、そこで もどす
 * （キリコまで 寄せた とたんに 暗くなって、むだに 行き来して 見えた）。
 */
const lookHome = async (s: Story): Promise<void> => {
	if (!called.has(s)) await s.look(null);
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
	// 旗を 立てただけでは 生まれない（when は 見なおされない）。show で 生まれさせてから 口に 置く
	// （旗だけだと 来客が 出ず、カメラも 見る 先が なかった）
	s.set("visitor");
	s.show("visitor");
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
			s.hide("visitor");
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

/** 住人が 村に 住んでいれば キリコの そばへ 歩いてくる（住んでいるか を 返す。いなければ 何もしない）。 */
const mobWalkOver = async (s: Story, id: MobId): Promise<boolean> => {
	const ev = `mob_${id}`;
	const here = mobsMovedIn(
		townStep(loadTown().stage, loadTown().points),
		loadProgress().cleared,
	).includes(id);
	if (here) {
		const [to] = spotsAround(villageView(), 1, [s.state.x, s.state.y]);
		if (to) {
			await s.look(ev);
			await s.goto(ev, to[0], to[1], { speed: 1.4 });
			s.face(ev, "player");
			s.face("player", faceTo(s.state, to));
			await s.look(null);
		}
	}
	return here;
};

/**
 * 転（裏の 2段目。STORY.md §5.98）：避難J の 結を 見た 次の 帰りに 1回だけ（ui/villageEvents.ts の arrivalScript）。
 * 外から コピペの 1レス目が 届き、時計が 1901年に もどる。ヒナリーが 1窓で わけを 言う（いなければ ゼロ）。
 * 見おえてから 旗 wrap を 立てて 1901年の スレを 開く（途中で 閉じたら 次の 帰りに もう一度）。
 */
export const wrapScript = async (s: Story): Promise<void> => {
	await gather(s, ["feris", "zero"]);
	for (const p of WRAP_NEWS.pages) await playPage(s, p);
	if (await mobWalkOver(s, "hinary"))
		await sayAs(s, "hinary", WRAP_NEWS.hinary);
	else await playPage(s, WRAP_NEWS.hinaryAbsent);
	await s.narrate(WRAP_NEWS.after);
	noteWrap();
	s.se("chapter");
	await s.narrate(WRAP_NEWS.open);
};

/** 結の あと（STORY.md §5.98）：次の 帰りに 1回だけ、鉄塔の 次スレに 外から「草」。喫茶の 柱時計が 動きだす。 */
export const kusaScript = async (s: Story): Promise<void> => {
	await gather(s, ["zero"]);
	for (const p of KUSA_NEWS.lines) await playPage(s, p);
	await s.narrate(KUSA_NEWS.after);
	addFlag("kusa");
};

/**
 * 住人が 話す 開いた 知らせ（裏シナリオ）。跡地：原住民が キリコの そばへ 来て、持ち帰った ROM専の 声を 聞く。
 * 避難J：ヒナリーが 来て 20人目の 手がかりを 発表する。その子が 村に いなければ（下見など）地の文だけ。
 */
const mobNewsScript = async (s: Story, d: "ato" | "hinan"): Promise<void> => {
	const id: MobId = d === "ato" ? "shobon" : "hinary";
	const here = await mobWalkOver(s, id);
	if (d === "ato") {
		s.se("spell");
		await s.narrate(ATO_NEWS.play);
		if (here) for (const l of ATO_NEWS.lines) await sayAs(s, id, l);
		await s.narrate(ATO_NEWS.after);
	} else {
		if (here) for (const l of HINAN_NEWS.lines) await sayAs(s, id, l);
		await s.narrate(HINAN_NEWS.after);
	}
};

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
		// 裏シナリオ：跡地（原住民が ROM専の 声を 聞く）・避難J（ヒナリーの 発表）は 住人が 話す
		if (n.dungeon === "ato" || n.dungeon === "hinan") {
			await mobNewsScript(s, n.dungeon);
			doneProgressNews(n);
			s.se("chapter");
			await s.narrate(
				`「${DUNGEON_NAMES[n.dungeon].name}」に\nもぐれるように　なった`,
			);
			continue;
		}
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
		const name = DUNGEON_NAMES[n.dungeon].name;
		// 板ごとの 行が あれば それ（本編・電池板・過去ログの底・裏シナリオの 小島と 灯台）。救いで 開いた 本編は relief。
		// ほかの 寄り道は 口の ない 植民地の 行
		const key: keyof typeof UNLOCK_LINES =
			n.reason === "relief"
				? "relief"
				: n.dungeon in UNLOCK_LINES
					? (n.dungeon as keyof typeof UNLOCK_LINES)
					: "colony";
		const lines = UNLOCK_LINES[key]
			.filter((l) => !away.includes(l.who) && !mentionsAway(l.text, away))
			.map((l) => ({ ...l, text: l.text.replace("{name}", name) }));
		// 村の 出口の 方を 見る（行き先は 出口から 全体マップで 選ぶ）。出口が キリコから 遠ければ
		// （たおれて 蓄音機の 前に いる relief など）そばの 仲間が 話しおえてから 出口を 見せて「もぐれる」の 1行
		// （見せてから すぐ もどって 話すと、出口が 一瞬しか 映らなかった）
		const [ex, ey] = VILLAGE_SPOTS.exit;
		const far =
			Math.max(Math.abs(s.state.x - ex), Math.abs(s.state.y - ey)) > 3;
		if (!far) await s.look(VILLAGE_SPOTS.exit);
		for (const l of lines) await s.say(l.who, l.text);
		if (far) {
			// 立ち絵が 出口を 隠さないように 窓を しまってから
			await s.wait(0);
			await s.look(VILLAGE_SPOTS.exit);
		}
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
	const dark = grown.to > grown.from;
	if (dark) {
		const stepMid = townStep(t.stage, t.points);
		await stageUp(s, grown.from, grown.to, movingIn(stepBefore, stepMid));
		await movedIn(s, stepBefore, stepMid, true);
		// 建った所から キリコへは 暗転で もどる（あずける 物を きく 仲間を そばへ 呼ぶのも この 暗転の 中で）
		await s.fadeOut(250);
		await s.look(null, { instant: true });
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
		{ dark },
	);
	if (dark) await s.fadeIn(250);
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
	const arrived = await movedIn(s, stepFrom, stepTo, r.to > stageFrom);
	if (r.to > stageFrom || arrived) await lookHome(s);
};

/**
 * 小段が 上がって 住人が 越してきた（data/mobs.ts の from）。越してきた 子を 見せて「〜が、村に　越してきた。」。
 * 建物の 段が 上がった ときは stageUp で もう 建て直して（その子は 隠して）いるので、建った所を 見ていた
 * カメラを そのまま 口へ 寄せる（キリコへ もどって 暗転して 口へ とぶと、行ったり 来たり して 見えた）。
 * 小段だけの ときは 暗転して 建て直し、町に 人が ふえた 知らせ。1回の 帰りで 何人でも（まとめて 1回）。
 * カメラは 越してきた 子に 置いたまま（もどすのは 呼ぶ側。lookHome）。だれか 来たかを かえす。
 */
const movedIn = async (
	s: Story,
	from: number,
	to: number,
	rebuilt: boolean,
): Promise<boolean> => {
	const ids = movingIn(from, to);
	if (!ids.length) return false;
	// 越してきた 子は 村の 口（持ち場に いちばん 近い 出口）から 歩いてきて、持ち場に 着いてから 知らせる
	if (!rebuilt) {
		await s.fadeOut(300);
		await s.rebuild();
		for (const id of ids) s.hide(`mob_${id}`);
		await s.look(gateNear(MOBS[ids[0]].spot), { instant: true });
		await s.fadeIn(300);
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
	return true;
};

/** 小段 from → to で 越してくる 住人（板を 持ち帰ると 来る 子は 語りの 中で 来る）。 */
const movingIn = (from: number, to: number): MobId[] =>
	MOB_IDS.filter(
		(id) => !MOBS[id].after && MOBS[id].from > from && MOBS[id].from <= to,
	);

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
	// show で 生まれさせてから 口に 置く（先に 置くと show が 持ち場に 生まれさせて、歩いて こなかった）
	s.show(ev);
	s.place(ev, gx, gy);
	await s.look(ev);
	await s.goto(ev, to[0], to[1], { speed: 1.3 });
};

/**
 * 町が 育った：暗転して 建て直し、建った所を 見せて 知らせる。仲間の ひとことと 持ちこみの 数。
 * おんJ 本館の 形が かわったら（段3・6。段を とばしても）本館を 見て ひとこと。
 * 話す 仲間を 建った所へ 呼ぶ（gather）ので、終わりは 呼ぶ側の 暗転（sendBack か settleScript）で キリコへ もどる。
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
	// 本館の ひとことは やきう。出ていった あとなら かわりの 人（STAGE_UP_HALL_INSTEAD）
	const hall =
		hallTier(to) > hallTier(from) ? STAGE_UP_HALL[hallTier(to)] : null;
	const hallInstead =
		hall && away.includes(hall.who)
			? STAGE_UP_HALL_INSTEAD[hallTier(to)]
			: null;
	const hallLine =
		hall && !away.includes(hall.who)
			? hall
			: hallInstead && !away.includes(hallInstead.who)
				? hallInstead
				: null;
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
		// いっしょに 越してきた 仲間は 建った所に いちばん 近い 口から 連れだって 歩いてくる
		// （1人ずつ べつの 口から 来ると、カメラが 村の はしから はしへ 2度 往復した）
		const gate = gateNear(at);
		const walkers = moved.flatMap((w) => {
			const c = spots[talkers.indexOf(w)];
			return c ? [{ w, c }] : [];
		});
		for (const { w } of walkers) {
			// show で 生まれさせてから 口に 置く（walkIn と 同じ）
			s.show(w);
			s.place(w, gate[0], gate[1]);
		}
		if (walkers[0]) await s.look(walkers[0].w);
		// カメラは 先頭に ついていく。うしろの 人は 少し 遅れて（口の マスで 重ならないように）
		await Promise.all(
			walkers.map(async ({ w, c }, i) => {
				if (i) await s.wait(300 * i);
				await s.goto(w, c[0], c[1], { speed: 1.3 });
				s.face(w, c[1] > at[1] ? "up" : "down");
			}),
		);
		await s.narrate(
			fill(ARRIVE_MSG, {
				names: moved.map((w) => SPEAKERS[w].name).join("と　"),
			}),
		);
		await s.look(at);
	}
	for (const l of lines) await s.say(l.who, l.text);
	if (hallLine) {
		// 本館を 見せて、話す 人が 本館の 前まで 歩いてきて 言う（カメラは 本館に 置いたまま、人が 画面に 入ってくる。
		// 人に カメラを つけると 本館が 一瞬しか 映らず、建った 本館を 背に 行ったり 来たり した）
		await s.wait(0);
		await s.look(VILLAGE_SPOTS.hallLook);
		const [door] = VILLAGE_SPOTS.hallDoors;
		const [front] = spotsAround(villageView(), 1, [door[0], door[1] + 1]);
		if (front) {
			await s.goto(hallLine.who, front[0], front[1], { speed: 1.4 });
			s.face(hallLine.who, "up");
		}
		await s.say(hallLine.who, hallLine.text);
	}
	const carry = CARRY_MAX[to] ?? 0;
	if (carry > (CARRY_MAX[from] ?? 0))
		await s.narrate(`倉庫から　引き取って\n${carry}つまで　持っていける`);
	// カメラは 建った所に 置いたまま（越してくる 住人が いれば そのまま 口へ。もどすのは 呼ぶ側）
};
