// 村（おんJタウン）に 帰ってきたときの 場面（ui/village/village.ts が 村に 入るたびに 走らせる。つなぎは ui/village/villageEvents.ts）。
// 2幕（並びは ui/village/villageEvents.ts の arrivalScript）：
//   1幕目（朝）口から 出る → 仲間が むかえる → 生き返った 通りの 知らせ → 持ち帰った物を 倉庫へ・売る → 村を 歩ける。
//   2幕目（キリコが 蓄音機の 前に 来ると）その夜の 場面 → 見出し → 開いた知らせ → 停電の 知らせ。
//
// - 持ち帰った・帰還スレ：キリコが 口の奥から 出てくると、口の前に 仲間が 並んで 待っている（幕が 上がる前に
//   並べる。lineUp）。持ち帰りの 語り（STORY[d].ending）か 帰還スレの 語り（RETURN_PAGES）を 村の窓で 話して、
//   暗転の あいだに 持ち場へ もどる（囲いの中の ロゼ・シヨは 歩いては 帰れない）。語りは 保存しない（閉じたら それきり）。
//   ボスを たおして 一瞬で 帰ったときは、着いた 語り（ending の 1枚目）の あとに どう 帰ったかの 1〜2枚（BOSS_RETURN[d]）。
//   最終話（電池板）を はじめて 持ち帰ったときは「完」の あとに スタッフロール（data/story/staffRoll.ts）。
// - 開いた知らせ（Progress.news）：本編は 口の前で 見張る やきうが どいて 小屋の前へ、もっとは 板が はずれる。
//   見せおえてから 1つずつ 消す（途中で 閉じても 次に 開いたとき また 見せる）。知らせの 前は 閉じたまま 描く（villageView）。
//   期間限定の イベントの 始まり・終わり（Progress.eventNews。data/story/objectives.ts）も そのあとに 1〜2行。
//   「準備中」の シャッターが あがって 店が 開く（TOWN.md §0.1。町は はじめから 都市の 姿）。
// - 持ち帰った物（Town.pending）：ンゴ姉が 機材倉庫に あずける物を きいて（一覧は ui/village/home.ts の chooseStored）、
//   のこりを ジェイトルマンが 買い取る（TOWN.md §0.4。ライバルは 店の 仕事を しない）。
//   決める前に 閉じても pending が 残るので 次に 村に 入ったとき 続きから。選んでいるあいだに 別のタブで
//   決められていたら 何もしない（古い町で 上書きしない）。
// - キリコは 1人で 動いている。知らせ・精算の 場面で 話す 人が 遠ければ（TALK_NEAR より 先）、
//   暗転の あいだに キリコの そばへ 呼び（gather）、場面の 終わりに 建て直して 持ち場へ もどす（sendBack）。
//   離れた 人の 声だけが 飛んでくる 掛け合いは しない（そばに いる 人とだけ 話す）。
// DOM を 使わない（Story だけ）ので、src/sim/villageTests.ts で 仮の Story を 渡して 試せる。

import { CARRY_MAX, STORAGE_CAP, TOWN_STAGES } from "../../core/town";
import { type DungeonId, instantClear, type Objective } from "../../core/types";
import {
	awayMobs,
	type MobId,
	PUYU_LUNCH,
	PUYU_RELIEF,
	RELIEF_NOTE,
} from "../../data/people/mobs";
import { eventById, eventNewsText } from "../../data/story/objectives";
import { itemPicture } from "../../data/story/pictures";
import {
	type SceneWalk,
	SPEAKERS,
	type Speaker,
} from "../../data/story/quotes";
import {
	STAFF_AFTER,
	STAFF_ROLL,
	STAFF_TITLE,
} from "../../data/story/staffRoll";
import {
	ARRIVE_RETURN,
	awayFriends,
	BOSS_RETURN,
	DEPART,
	DUNGEON_NAMES,
	endingFor,
	episodeEnd,
	mentionsAway,
	playPage,
	type StoryPage,
	TEN_NEWS,
	UNLOCK_LINES,
	UNLOCK_VISIT,
	withoutAway,
} from "../../data/story/story";
import { BOARD_NEWS, deathLine } from "../../data/town/headlines";
import {
	BLACKOUT_BOARD,
	inBlackout,
	REVIVE_AREAS,
	revivedAreas,
} from "../../data/town/revival";
import {
	TAMPER_NARRATION,
	TAMPER_SCENE,
	tamperTier,
} from "../../data/town/tamper";
import {
	RETURN_PAGES,
	REVIVE_MSG,
	type StaffLine,
	TOWN_MSG,
	VILLAGE_MSG,
	WAKE_PAGES,
	WALLET_WHY,
} from "../../data/town/town";
import {
	asideSpot,
	type Cell,
	exitAt,
	exitFor,
	lineupSpots,
	spotsAround,
	VILLAGE_SPOTS,
	type VillageExit,
	type VillageView,
	villagePlaces,
} from "../../data/village/map";
import type { Story } from "../../engine/defs";
import { type Cue, cueOf, type Emote, type Gesture } from "../../engine/emote";
import type { HeadProp } from "../../engine/headProp";
import {
	addFlag,
	deathCount,
	doneEventNews,
	doneProgressNews,
	giveLunch,
	giveRelief,
	growTown,
	hasFlag,
	loadProgress,
	loadRecords,
	loadTown,
	noteEnding,
	type PendingReturn,
	type Progress,
	QUIT_CAUSE,
	saveTown,
	settleReturn,
	type Town,
} from "../../engine/save";
import { type CardRun, showCard } from "../../engine/sceneCard";
import {
	type FxRun,
	fxRoot,
	type SceneFx,
	startFx,
} from "../../engine/sceneFx";
import { rollStaff } from "../../engine/staffRoll";
import { doneTamperNews, loadTamper } from "../../engine/tamper";
import type { Dir } from "../../engine/types";
import { cleanUp } from "./decay";
import { drawChalkLine, endChalk } from "./sceneChalk";
import { endMarks, putMark, takeMark } from "./sceneMarks";
import {
	clearShrooms,
	dropShroom,
	endShrooms,
	SHROOM_LEFT,
	sproutShrooms,
} from "./sceneShrooms";
import {
	BLACKOUT_TOLD,
	type SceneLit,
	sceneOut,
	sceneSky,
	setSceneLit,
	setSceneOut,
	setSceneSky,
	setTownSky,
	skitSky,
	townSkyNow,
} from "./sceneSky";
import { mobsOutNow, sayAs } from "./villageMobs";
import { endScene, sceneBgm, villageSong } from "./villageMusic";
import { deathQuote, fill } from "./villageTalk";
import { setZankiScene } from "./zankiTag";

/**
 * 開発用：`?stage=N` で 開いた 店の 段だけ 差しかえる（pnpm dev か ?debug のときだけ）。
 * 保存は 書きかえない（倉庫・会話は 本当の段のまま）。帰ってきた 持ち物の 精算も しない。
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
 * いまの 村（保存から 読む）。町は はじめから 都市の 姿（いちばん上の 段で 描く）。開いて いる 店は cleared で 決まる（data/town/revival.ts）。
 * 開いた知らせを まだ 見せていない ダンジョンは 閉じたまま 描く（知らせの 場面で やきうが どく・板が はずれる）。
 */
export const villageView = (): VillageView => {
	const p = loadProgress();
	// 救いの 知らせ（倉庫の 封鎖が 解けた）は 板を 開かないので 数えない
	const fresh = new Set(
		p.news.filter((n) => n.reason !== "relief").map((n) => n.dungeon),
	);
	const v: VillageView = {
		stage: TOWN_STAGES - 1,
		unlocked: p.unlocked.filter((d) => !fresh.has(d)),
		cleared: [...p.cleared],
	};
	// この 帰りに 広場に いない 住人（施設に 行っている 子・出かけている 子。帰りごとに 1回 決める）
	return { ...v, mobsOut: mobsOutNow(v) };
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
 * 場面で 村に いない 仲間。その 板で 帰ってくる 仲間は キリコと 同じ 船で 着くので、
 * はじめての 持ち帰りの 語りにも 出る（sceneView の arriving）。
 */
const sceneAway = (a: ReturnArrival, p: Progress): Speaker[] => {
	const away = awayFriends(
		a.kind === "clear" && !p.cleared.includes(a.dungeon)
			? [...p.cleared, a.dungeon]
			: p.cleared,
	);
	// 潜った 本人（束音ロゼ・解音ゼロ）は 迎える 側に 立たない：自分で 持ち帰った 物を 自分で 迎えない
	// （2026-10-14 作者が えらんだ。その 人の 頁は かわりの 頁に かわるか 出ない。起動の 札の mute と 同じ）
	// ただし 本筋の 山場（電池板の はじめての 持ち帰り）だけは だれで 潜っても 全員 そろえる（作者の 指示）
	if (a.dungeon === "deep" && firstEnding(a, p)) return away;
	const hero = loadRecords()[0]?.hero;
	return hero && !away.includes(hero) ? [...away, hero] : away;
};

/**
 * 寸劇を 見おえたが、生き返った 通りの 知らせ（reviveScript）が まだの 板（この 起動の あいだ）。その 板の 通り・もどる
 * 住人・ご近所は 知らせの あとで 町に 出る（2026-10-18 作者「寸劇の 時点で 新規流入者や 修復建物が 反映されて いる」
 * → 寸劇が 終わってから）。明かりの 坂で 建て直した 電池板（lightsBack）は 知らせの 前でも 持ち帰った 町。
 */
const pendingReveal = new Set<DungeonId>();

/** 知らせまで その 板を 町に 出さない（returnScene の おわり。試験からも 呼ぶ）。 */
export const holdReveal = (d: DungeonId): void => {
	if (!lightsBack.has(d) && REVIVE_AREAS.some((a) => a.dungeon === d))
		pendingReveal.add(d);
};

/** 知らせた（reviveScript）。 */
export const releaseReveal = (d: DungeonId): void => {
	pendingReveal.delete(d);
};

/** 試験の あいだの 入れものを もどす（src/sim/villageTests.ts の swapStorage）。 */
export const forgetReveal = (): void => {
	pendingReveal.clear();
};

/**
 * 帰ってきた 場面の 村（はじめての 持ち帰りの 語りの あいだと、生き返った 知らせの 前は、その 板を まだ 持ち帰って
 * いない 村。同じ 船の 仲間だけ 立つ：arriving）。知らせの あと 建て直すと いまの 村に なる。
 */
export const sceneView = (v: VillageView, a?: ReturnArrival): VillageView => {
	const first =
		a && firstEnding(a, loadProgress()) && !lightsBack.has(a.dungeon)
			? [a.dungeon]
			: [];
	const pending = v.cleared.filter((d) => pendingReveal.has(d));
	const arriving = [...new Set([...pending, ...first])];
	return arriving.length
		? {
				...v,
				cleared: v.cleared.filter((d) => !arriving.includes(d)),
				arriving,
			}
		: v;
};

/** 語りの とちゅうで 持ち帰った ことに なった 板（明かりの 坂の あとの 電池板。その 先は 持ち帰った 町で 語る）。 */
const lightsBack = new Set<DungeonId>();

/**
 * 村で 話す 語り（品を 持ち帰った ことは 同じ）。ボスなら 持ち帰りの 語りの 1枚目（「村に　帰りつくと、…」の
 * 着いた 語り）の あとに どう 帰ったかの 頁を はさむ（仲間が 声を かけるのは 着いてから）。
 * 一度きりの 語りは 見おえたら 短い 語りに かわる。村に いない 仲間の 頁は かわりに かえる（data/story/story.ts）。
 */
export const pagesFor = (
	a: ReturnArrival,
	p: Progress = loadProgress(),
): readonly StoryPage[] => {
	const away = sceneAway(a, p);
	if (a.kind !== "clear") return withoutAway(RETURN_PAGES, away);
	const ending = endingFor(a.dungeon, !firstEnding(a, p), away, p.cleared);
	// ボスを たおした・底の 出来事・送り届けの 帰り方の 語り
	const boss =
		a.objective === "boss"
			? (BOSS_RETURN[a.dungeon] ?? [])
			: instantClear(a.objective)
				? (ARRIVE_RETURN[a.dungeon] ?? [])
				: [];
	// 本筋の 話の おわり（はじめて 持ち帰った ときだけ）
	const end = firstEnding(a, p) ? episodeEnd(a.dungeon) : null;
	return withoutAway(
		[
			...(boss.length ? [ending[0], ...boss, ...ending.slice(1)] : ending),
			...(end ? [end] : []),
		],
		away,
	);
};

/** 語りで 話す 仲間（出てくる順）。 */
const castOf = (pages: readonly StoryPage[]): Speaker[] => [
	...new Set(pages.flatMap((p) => (p.who ? [p.who] : []))),
];

/** 走る 人（StoryPage.go の who）が 住人か（仲間・キリコ・みんな でない）。 */
const walkMob = (who: SceneWalk["who"]): MobId | null =>
	who === "kiriko" || who === "all" || who in SPEAKERS ? null : (who as MobId);

/** 語りで 口を はさむ・走る 住人（data/people/mobs.ts。出てくる順）。 */
const mobsOf = (pages: readonly StoryPage[]): MobId[] => [
	...new Set(
		pages.flatMap((p) => [
			...(p.mob ? [p.mob] : []),
			...(p.go ?? []).flatMap((w) => {
				const m = walkMob(w.who);
				return m ? [m] : [];
			}),
		]),
	),
];

/**
 * 語りで 話す・走る 住人（その 村に 帰ってきて いる 子だけ。data/people/mobs.ts の MOB_BACK。はじめての
 * 持ち帰りの 語りなら、同じ 船で 着いた ゼロの サブ機も：ZERO_UNITS）。
 */
const mobsHere = (pages: readonly StoryPage[], v: VillageView): MobId[] => {
	const gone = awayMobs(v.cleared, v.arriving);
	return mobsOf(pages).filter((id) => !gone.includes(id));
};

/** キリコが 立っている 村の 出口（帰ってきたところ。隠しの 板は 村の 中の 井戸。出口で なければ undefined）。 */
const inMouth = (s: Story, d: DungeonId): VillageExit | undefined => {
	const e = exitFor(d);
	return e.cell[0] === s.state.x && e.cell[1] === s.state.y
		? e
		: exitAt(s.state.x, s.state.y);
};

/** 出口の ほうを 向く（村へ もどる 向きの 逆）。 */
const toward: Record<Dir, Dir> = {
	up: "down",
	down: "up",
	left: "right",
	right: "left",
};

/**
 * 場面で 置いた 人が 立っている マス（lineUp で 口の 前に 並んだ 仲間・gather で 呼んだ 仲間・口から 来た 住人）。
 * spotsAround・asideSpot は 地図の 人と 物しか 見ないので、キリコが どく マス・人を 呼ぶ マスから これを 外す
 * （外さないと キリコや 来客が 並んだ 仲間の マスへ 重なって 立った）。建て直すと みんな 持ち場へ もどるので 消す
 * （歩いてきた 住人だけで 建て直さずに 終わると 残るが、次の 場面で そこを よけるだけ）。
 */
const placed = new WeakMap<Story, Cell[]>();

/**
 * lineUp で 口の 前に 並んだ 人の マス（語りで 前に 出た 人が もどる 所）。並べる 幕の 前と 語りの 場面は
 * Story が べつなので、Story では なく いちばん 新しい 並びを おぼえる。
 */
let homes = new Map<string, Cell>();

/** 場面で 人を 置いた マス。 */
const takenBy = (s: Story): readonly Cell[] => placed.get(s) ?? [];

/** 人を 置いた マスを おぼえる。 */
const take = (s: Story, cells: readonly Cell[]): void => {
	placed.set(s, [...takenBy(s), ...cells]);
};

/** 村を 建て直す（場面で 置いた 人は 持ち場へ もどるので、おぼえた マスも 消す）。 */
const rebuild = async (s: Story): Promise<void> => {
	placed.delete(s);
	await s.rebuild();
};

/** at（省けば キリコ）の まわりの 空いた マス（場面で 人を 置いた マスは さける。近い 順に n こ）。 */
const freeAround = (s: Story, n: number, at?: Cell): Cell[] =>
	spotsAround(villageView(), n, at ?? [s.state.x, s.state.y], takenBy(s));

/**
 * 幕が 上がる前に：キリコは 口の奥（まだ 見えない）、話す 仲間は 口の前に 並んで 口を 見ている。
 * v は いま 描いている 村（並ぶ マスを 決める）。
 */
export const lineUp = (s: Story, a: ReturnArrival, v: VillageView): void => {
	const exit = inMouth(s, a.dungeon);
	if (!exit) return;
	const pages = pagesFor(a);
	// 町の どこかで 待って いる 仲間（StoryPage.standAt。語りが 言う 所に 立つ。口の 前には 並ばない）
	const away = new Map(
		pages.flatMap((p) => (p.standAt && p.who ? [[p.who, p.standAt]] : [])),
	);
	const cast = castOf(pages).filter((w) => !away.has(w));
	// 口を はさむ 住人が 村に いれば、仲間の あとに 並ぶ（遠くから 声だけ 飛ばさない）
	const mobs = mobsHere(pages, v).map((id) => `mob_${id}`);
	const line = [...cast, ...mobs];
	const spots = lineupSpots(v, line.length, exit);
	s.hide("player");
	line.forEach((who, i) => {
		const c = spots[i];
		if (c) s.place(who, c[0], c[1], toward[exit.inward]);
	});
	homes = new Map(
		line.flatMap((who, i) => {
			const c = spots[i];
			return c ? [[who, c] as const] : [];
		}),
	);
	for (const [who, at] of away) {
		const c = spotsAround(v, 1, at, [...homes.values()])[0];
		if (!c) continue;
		s.place(who, c[0], c[1], "down");
		homes.set(who, c);
	}
	// 新しい 場面：置いた マスだけ おぼえる（キリコが どく マス・口から 来る 人の 行き先から 外す）
	placed.set(s, [...homes.values()]);
	// 停電の 町に 帰る 場面（電池板）：幕が 上がる 前から 暗く、外には 並んだ 人しか いない
	if (pages[0]?.sky === "dark") {
		setSceneSky("dark");
		setSceneOut({ keep: new Set(homes.keys()), near: [], all: false });
	}
};

/**
 * キリコが 口の 前（出てきた マス）に 立っていると、口から 入る 道を ふさいでしまう（goto は キリコの マスを よける）。
 * 東・西・北の 口は 1歩 入った マスしか 道が ないので、来る 人が みな キリコを とびこえて 来た（帰りも）。
 * 口から 人が 歩いてくる 場面（来客・越してくる 仲間や 住人・ROM専）の 前に、キリコが その 口の 前に いれば
 * となりの 空いた マスへ 1歩 どかす（口から 広場への 道を ふさがない マス。細道なら 横の 行き止まりへ。
 * data/village/map.ts の asideSpot）。口から はなれて いれば 動かない。場面で 人を 置いた マス（並んだ・呼んだ 仲間）には
 * どかない（重なって 立たない ように）。
 */
const stepAside = async (
	s: Story,
	gate: readonly [number, number],
): Promise<void> => {
	if (Math.abs(s.state.x - gate[0]) + Math.abs(s.state.y - gate[1]) > 1) return;
	const to = asideSpot(villageView(), [s.state.x, s.state.y], gate, takenBy(s));
	if (to) await s.goto("player", to[0], to[1], { speed: 1.2 });
};

/** 語りの 合図（data/story/quotes.ts の StoryPage.cue）を 起こす。 */
/**
 * 明かりの もどる 坂で カメラを 向ける 所（話の 順。STORY.md §4.9 の 頂点）。area は 生き返る 通り
 * （data/town/revival.ts）。持ち帰った 板の 通りだけ 回る。
 */
const LIGHTS_UP: readonly { area: string; name: string; at: Cell }[] = [
	{ area: "plaza", name: "広場に明かり", at: [20, 21] },
	{ area: "street", name: "商店街に明かり", at: [45, 17] },
	{ area: "bath", name: "銭湯に明かり", at: [36, 27] },
	{ area: "beach", name: "浜に明かり", at: [12, 34] },
	{ area: "tako", name: "たこ八に明かり", at: [22, 32] },
	{ area: "shrine", name: "丘の神社に明かり", at: [4, 9] },
	{ area: "lights", name: "町じゅうの街灯に明かり", at: [28, 6] },
];

/**
 * 明かりを 灯す（蛍光灯の ように 2回 またたいてから つく。端末の「動きを へらす」では すぐ つく）。
 * from は いままで 灯って いた 明かり。
 */
const flickerOn = async (
	s: Story,
	from: SceneLit,
	to: SceneLit,
): Promise<void> => {
	const still =
		typeof window !== "undefined" &&
		!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
	if (!still)
		for (const [l, ms] of [
			[to, 70],
			[from, 90],
			[to, 50],
			[from, 140],
		] as const) {
			setSceneLit(l);
			await s.wait(ms);
		}
	setSceneLit(to);
};

/**
 * 停電（転）：灯った 夜から 2回 またたいて 明かりの ない 夜（dark）へ。端末の「動きを へらす」では すぐ 消える。
 */
const flickerOff = async (s: Story, on: SceneLit): Promise<void> => {
	const still =
		typeof window !== "undefined" &&
		!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
	const lit = (yes: boolean) => {
		setSceneSky(yes ? "night" : "dark");
		setSceneLit(yes ? on : null);
	};
	if (!still)
		for (const [yes, ms] of [
			[false, 80],
			[true, 120],
			[false, 60],
			[true, 200],
		] as const) {
			lit(yes);
			await s.wait(ms);
		}
	lit(false);
	await s.wait(500);
};

/**
 * 明かりの 坂の あとの 祭り（暗転の 中で）：キリコと 場面に 出る 人（keep）を 広場へ、まわりに 町の 人と
 * よその 板から 来た 人（住人・名無し・野次馬・ご近所）を 集める。場面だけ（おわりの 建て直しで 持ち場へ もどる）。
 */
const festivalGather = (s: Story, keep: readonly string[]): void => {
	const plaza = LIGHTS_UP[0].at;
	const [px, py] = freeAround(s, 1, plaza)[0] ?? plaza;
	s.place("player", px, py, "down");
	take(s, [[px, py]]);
	const guests = villagePlaces(villageView())
		.filter(
			(p) =>
				!!p.sprite &&
				/^(mob_|folk_|yaji_|inc_)/.test(p.id) &&
				!keep.includes(p.id),
		)
		.map((p) => p.id);
	const who = [...keep, ...guests];
	const cells = freeAround(s, who.length, [px, py]);
	who.forEach((id, i) => {
		const c = cells[i];
		if (c) s.place(id, c[0], c[1]);
	});
	take(s, cells);
	for (const id of who) s.face(id, "player");
};

const playCue = async (
	s: Story,
	c: NonNullable<StoryPage["cue"]>,
): Promise<void> => {
	if (c === "lightsUp") {
		// 明かりの もどる 坂（STORY.md §4.9 の 頂点）：まだ 暗い 町で、生き返った 通りを 話の 順に 見せて、
		// カメラが 着いた 通りから 窓・看板が 灯る。さいごに 街灯と 家の 窓（電池板）。
		// 灯りきったら 暗転で 電池板を 持ち帰った 町（シャッターが 開く）に 建て直す
		const areas = new Map(
			revivedAreas(loadProgress().cleared).map((a) => [a.id, a] as const),
		);
		let on: SceneLit = { boards: [], homes: false };
		setSceneLit(on);
		for (const spot of LIGHTS_UP) {
			const area = areas.get(spot.area);
			if (!area) continue;
			await s.look(spot.at);
			const boards = [...on.boards, area.dungeon];
			const next = { boards, homes: boards.includes(BLACKOUT_BOARD) };
			s.se("uncurse");
			await flickerOn(s, on, next);
			on = next;
			// 灯った 通りに 人が もどる。電池板の 明かり（街灯と 家の 窓）で 町じゅうが 停電の 暗さから ふつうの 夜に
			const o = sceneOut();
			if (o) setSceneOut({ ...o, near: [...o.near, spot.at], all: next.homes });
			if (next.homes && sceneSky() === "dark") setSceneSky("night");
			s.toast(spot.name);
			await s.wait(700);
		}
		await s.fadeOut(300);
		lightsBack.add(BLACKOUT_BOARD);
		const keep = [...(sceneOut()?.keep ?? [])];
		await rebuild(s);
		// 町の 明かりが もどった（停電の 暗さ → ふつうの 夜）。祭りの 頁は 広場で
		setSceneLit(null);
		setSceneOut(null);
		if (sceneSky() === "dark") setSceneSky("night");
		festivalGather(s, keep);
		await s.fadeIn(300);
		await s.look(null);
	} else if (c === "chapterEnd") {
		s.se("chapter");
		await s.wait(400);
	}
};

/** 語りの 頁の 効果音（StoryPage.se）。seRepeat が あれば seGap ずつ あけて 重ねる（連打・鳴りやまない 音）。 */
const playPageSe = async (s: Story, p: StoryPage): Promise<void> => {
	if (!p.se) return;
	const n = p.seRepeat ?? 1;
	for (let i = 0; i < n; i++) {
		s.se(p.se);
		if (n > 1) await s.wait(p.seGap ?? 220);
	}
};

// ───────────────── 掛け合いの 立ち回り ─────────────────
// 並んだ まま 窓だけ 進むと、だれが だれに 言って いるか 見えない（2026-10-18 作者「全員が その場で 動かないから
// 伝わりにくい」）。話す 人は 1歩 前に 出て、聞く 人と キリコは その人の ほうを 向く。話し手が かわると 前の 人は 下がる。

/** 記号だけ 書いた 行の 体の 動き（gesture を 書いた 行は そのまま）。 */
const EMOTE_GESTURE: Partial<Record<Emote, Gesture>> = {
	"!": "startle",
	"♪": "hop",
	"♥": "hop",
	花: "hop",
	汗: "shiver",
	怒: "shiver",
};

/** 頁の 感情（記号に あう 動きを 足す）。 */
const pageCue = (p: StoryPage): Cue => {
	const c = cueOf(p);
	const g = c.gesture ?? (c.emote ? EMOTE_GESTURE[c.emote] : undefined);
	return g ? { ...c, gesture: g } : c;
};

/** 頁を 話す 人（村に 立つ イベント ID。地の文・名無し・キリコは null）。 */
const speakerOf = (p: StoryPage): string | null =>
	p.mob ? `mob_${p.mob}` : p.kiriko || p.nanashi ? null : p.who;

/** from から to を 見る 向き（たて・よこの 遠い ほう）。 */
const dirTo = (from: Cell, to: Cell): Dir => {
	const dx = to[0] - from[0];
	const dy = to[1] - from[1];
	if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
	return dy < 0 ? "up" : "down";
};

const STEP: Record<Dir, "u" | "d" | "l" | "r"> = {
	up: "u",
	down: "d",
	left: "l",
	right: "r",
};

/** 掛け合いの 立ち位置（いま 前に 出て いる 人と、みんなの いる マス）。 */
type Stage = {
	at: Map<string, Cell>;
	front: { id: string; dir: Dir } | null;
	kiriko: Cell;
	/** キリコの 前の マス（話し手が 寄って いく 先）。 */
	mark: Cell;
};

const stageOf = (s: Story, exit: VillageExit): Stage | null => {
	const h = homes;
	if (!h.size) return null;
	const k: Cell = [s.state.x, s.state.y];
	const v = DIR_V[exit.inward];
	return {
		at: new Map(h),
		front: null,
		kiriko: k,
		mark: [k[0] + v[0], k[1] + v[1]],
	};
};

const DIR_V: Record<Dir, Cell> = {
	up: [0, -1],
	down: [0, 1],
	left: [-1, 0],
	right: [1, 0],
};

const dist = (a: Cell, b: Cell): number =>
	Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

/** 話し手が 前に 出る 1歩（キリコの 前の マスへ 近づく 空いた マス。なければ null）。 */
const stepOut = (st: Stage, id: string, home: Cell): Dir | null => {
	const busy = [...st.at.entries()].filter(([w]) => w !== id).map(([, c]) => c);
	const open = spotsAround(villageView(), 8, home, [...busy, st.kiriko]).filter(
		(c) => dist(c, home) === 1 && dist(c, st.mark) < dist(home, st.mark),
	);
	const to = open.sort((a, b) => dist(a, st.mark) - dist(b, st.mark))[0];
	return to ? dirTo(home, to) : null;
};

/** 前に 出て いる 人を 並んだ マスへ 下げる。 */
const stepBack = async (s: Story, st: Stage): Promise<void> => {
	const prev = st.front;
	if (!prev) return;
	await s.move(prev.id, STEP[toward[prev.dir]], { speed: 1.6 });
	const ph = homes.get(prev.id);
	if (ph) st.at.set(prev.id, ph);
	st.front = null;
};

/** 話し手を 前に（前の 話し手は 下がる）。聞く 人と キリコは 話し手の ほうを 向く。 */
const turnTo = async (
	s: Story,
	st: Stage,
	id: string | null,
): Promise<void> => {
	if (!id || st.front?.id === id) return;
	const home = homes.get(id);
	if (!home) return;
	// 下がってから 出る（同時だと 同じ マスを とりあって 止まる）
	await stepBack(s, st);
	const d = stepOut(st, id, home);
	if (d) {
		await s.move(id, STEP[d], { speed: 1.6 });
		const v = DIR_V[d];
		st.at.set(id, [home[0] + v[0], home[1] + v[1]]);
		st.front = { id, dir: d };
	}
	const me = st.at.get(id) ?? home;
	s.face(id, "player");
	s.face("player", dirTo(st.kiriko, me));
	for (const [w, c] of st.at) if (w !== id) s.face(w, dirTo(c, me));
};

/** みんな キリコに 背を 向ける（前に 出て いた 人は 下がってから）。 */
const turnAway = async (s: Story, st: Stage): Promise<void> => {
	await stepBack(s, st);
	for (const [w, c] of st.at) s.face(w, dirTo(st.kiriko, c));
	// ひとり 残った キリコは こちらを 向く
	s.face("player", "down");
};

// ───────────────── 場面を うつす・走らせる ─────────────────
// 口の 前で 並んだ まま 窓だけ 進むと、語りが 町の 出来事を 言っても 場面が 一歩も 動かない（2026-10-18 作者
// 「カメラ移動や キリコを 動かしたり キャラを 縦横無尽に」）。StoryPage.cut で 所を かえ、go で 走らせる。

/** 場面で 置いた 人の マスを 入れかえる（old を 外して now を おぼえる）。 */
const retake = (s: Story, old: Cell | undefined, now: Cell): void => {
	const rest = takenBy(s).filter(
		(c) => !old || c[0] !== old[0] || c[1] !== old[1],
	);
	placed.set(s, [...rest, now]);
};

/** 場面に 出て いる 人の いま いる マス（並び・場面の うつし・走りで かわる）。 */
const posOf = (s: Story, id: string): Cell | undefined =>
	id === "player" ? [s.state.x, s.state.y] : homes.get(id);

/** 動いた 人の マスを 掛け合いの 立ち位置にも 書く（話し手は 新しい マスから 前に 出る）。 */
const moved = (s: Story, st: Stage | null, id: string, c: Cell): void => {
	if (id === "player") {
		if (st) {
			st.kiriko = c;
			st.mark = c;
		}
		return;
	}
	retake(s, homes.get(id), c);
	homes.set(id, c);
	st?.at.set(id, c);
};

/** 暗転して 場面を at の そばへ うつす（場面に 出て いる 人も みんな）。 */
const cutTo = async (s: Story, at: Cell, st: Stage | null): Promise<void> => {
	await s.fadeOut(250);
	if (st) st.front = null;
	const ids = [...homes.keys()];
	// いま 人の 立って いる マスは さける（置く 順で 一瞬でも 重ならない ように。町の どこかで 待って いた 人の
	// マスへ 先に 置いた 人が 乗り、その 人が どいた ときに その マスを 空いた ことに して しまった）
	const now = [...homes.values()];
	const k = spotsAround(villageView(), 1, at, now)[0] ?? at;
	s.place("player", k[0], k[1], "down");
	const cells = spotsAround(villageView(), ids.length, k, [k, ...now]);
	placed.set(s, [k, ...cells.slice(0, ids.length)]);
	ids.forEach((id, i) => {
		const c = cells[i];
		if (!c) return;
		s.place(id, c[0], c[1]);
		s.face(id, "player");
		homes.set(id, c);
		st?.at.set(id, c);
	});
	moved(s, st, "player", k);
	await s.look(null, { instant: true });
	await s.fadeIn(250);
};

/** 語りの 頁の 人を 走らせる（StoryPage.go。ならべた 分は 同時に）。 */
const runWalks = async (
	s: Story,
	walks: readonly SceneWalk[],
	st: Stage | null,
): Promise<void> => {
	if (st) await stepBack(s, st);
	const idOf = (w: SceneWalk["who"]): string => {
		if (w === "kiriko") return "player";
		const m = walkMob(w);
		return m ? `mob_${m}` : w;
	};
	/** id が 行く 空いた マス（自分の いる マスは 空いて いる ことに する）。 */
	// キリコの 行き先（ほかの 人は そこにも 立たない）
	let kGoal: Cell | null = null;
	const spotFor = (
		id: string,
		to: Cell,
		also: readonly Cell[],
	): Cell | null => {
		const me = posOf(s, id);
		const busy = takenBy(s).filter((c) => !same(me, c));
		const kiriko: Cell[] =
			id === "player"
				? []
				: [[s.state.x, s.state.y], ...(kGoal ? [kGoal] : [])];
		return (
			spotsAround(villageView(), 1, to, [...busy, ...kiriko, ...also])[0] ??
			null
		);
	};
	const jobs: Promise<void>[] = [];
	const go = (id: string, c: Cell, w: SceneWalk): void => {
		const speed = w.speed ?? 2.2;
		jobs.push(
			(async () => {
				if (w.follow && id !== "player") await s.look(id);
				await s.goto(id, c[0], c[1], { speed });
				if (w.face) s.face(id, w.face);
				else if (id !== "player") s.face(id, "player");
			})(),
		);
		if (id === "player") kGoal = c;
		moved(s, st, id, c);
	};
	for (const w of walks) {
		if (w.who === "all") {
			if (!w.to || w.to === "kiriko") continue;
			const k = spotFor("player", w.to, []);
			if (!k) continue;
			go("player", k, w);
			const ids = [...homes.keys()];
			const cells = spotsAround(villageView(), ids.length, k, [
				...takenBy(s).filter((c) => !ids.some((id) => same(homes.get(id), c))),
				[s.state.x, s.state.y],
				k,
			]);
			ids.forEach((id, i) => {
				const c = cells[i];
				if (c) go(id, c, { ...w, face: undefined });
			});
			continue;
		}
		const id = idOf(w.who);
		if (id !== "player" && !homes.has(id)) continue;
		if (w.route) {
			const speed = w.speed ?? 2.2;
			// 元の マスへ もどる しぐさなので、人や 物で 止まって ずれない ように すりぬける
			jobs.push(s.move(id, w.route, { speed, through: true }));
			continue;
		}
		if (!w.to) continue;
		const target =
			w.to === "kiriko"
				? spotFor(id, [s.state.x, s.state.y], [[s.state.x, s.state.y]])
				: spotFor(id, w.to, []);
		if (target) go(id, target, w);
	}
	await Promise.all(jobs);
};

const same = (a: Cell | undefined, b: Cell): boolean =>
	!!a && a[0] === b[0] && a[1] === b[1];

/** 口から 出てきて、並んだ 仲間が 語りを 話す。暗転の あいだに みんな 持ち場へ もどる。 */
export const returnScene = async (
	s: Story,
	a: ReturnArrival,
): Promise<void> => {
	const exit = inMouth(s, a.dungeon);
	if (!exit) return;
	const pages = pagesFor(a);
	// はじめての 持ち帰りの 語りの あいだは、その 板で 来る 子は まだ いない（sceneView）
	const here = mobsHere(pages, sceneView(villageView(), a));
	// 語りの 効果音は 一度きりなので 先に 読みこむ（読みこみ 待ちで 落ちると、オチの 音が 消える）
	s.preloadSe([...new Set(pages.flatMap((p) => (p.se ? [p.se] : [])))]);
	s.se("stairs");
	s.show("player");
	await s.move("player", exit.step);
	const back: Cell = [s.state.x, s.state.y];
	for (const who of castOf(pages)) s.face(who, "player");
	for (const id of here) s.face(`mob_${id}`, "player");
	// 掛け合いの 立ち位置（明かりの 坂で 建て直すと 並びが くずれるので やめる）
	let stage = stageOf(s, exit);
	// 場面の エフェクト（煙・暗転などは 次の 頁も 同じ fx なら 残す）
	let fx: { kind: SceneFx; run: FxRun } | null = null;
	// どう 帰って きたかの 姿（服の パンくず・髪の 湯気・ソース）は 着いた ときから
	const look =
		a.kind === "clear" && a.objective === "boss"
			? BOSS_RETURN[a.dungeon]?.find((p) => p.wear)?.wear
			: undefined;
	if (look) s.wear("player", look);
	// 残機の 数が 出る・かわる 頁までは 前の 数（1 は まだ 出さない・99 は まだ 1）
	const zanki = pages.find((p) => p.zanki !== undefined)?.zanki;
	if (zanki !== undefined) setZankiScene(zanki === 99 ? 1 : null);
	// イメージ図（騒ぎの 規模。頁を またいで 残り、入れかえる）
	const card = pageCards();
	for (const p of pages) {
		card.show(p);
		if (p.zanki !== undefined) setZankiScene(p.zanki);
		// 場面の 曲（頂点の 場面など。null で 止める）
		if (p.bgm !== undefined) sceneBgm(s, p.bgm);
		// 時間が とぶ（「翌日。」「1時間後。」）：暗転して、暗い うちに 空・人を かえて 明ける
		if (p.skip) {
			if (stage) await stepBack(s, stage);
			await s.fadeOut(400);
		}
		// 場面の 空（明かりの 場面は 夜。null は 寸劇の 空＝朝に もどす。停電の 町は 昼・夕方でも 暗い まま。ui/village/sceneSky.ts）
		if (p.sky !== undefined)
			setSceneSky(
				p.sky === "dark" || p.sky === "night" || (p.sky && !townSkyNow())
					? p.sky
					: skitSky(),
			);
		if (p.skip && !p.cut) {
			await s.wait(300);
			await s.fadeIn(400);
		}
		if (p.cue) {
			await playCue(s, p.cue);
			if (p.cue === "lightsUp") stage = null;
		}
		if (p.cut) await cutTo(s, p.cut, stage);
		if (p.look !== undefined) await s.look(p.look);
		// 広場の チョークの 国境線（キリコが 走りだすと 伸びる）
		if (p.chalk) drawChalkLine();
		// 走る 頁は 走りながら 音（線を 引く 音・足音）
		let se: Promise<void> | null = null;
		if (p.go) {
			se = playPageSe(s, p);
			await runWalks(s, p.go, stage);
		}
		if (stage && p.turnAway) await turnAway(s, stage);
		else if (stage) await turnTo(s, stage, speakerOf(p));
		if (fx && fx.kind !== p.fx) {
			fx.run.end();
			fx = null;
		}
		if (p.wear !== undefined) s.wear("player", p.wear);
		// 場面に 出て いる みんなの 頭（「町の人の頭に生えた」）
		if (p.wearAll !== undefined)
			for (const id of homes.keys()) s.wear(id, p.wearAll);
		// 語りが 言った 物を 地図に（島・舟・湯気。ui/village/sceneMarks.ts）
		if (p.unmark) takeMark(p.unmark);
		if (p.mark) putMark(p.mark);
		if (p.shrooms === null) clearShrooms();
		else if (p.shrooms) sproutShrooms(p.shrooms, [s.state.x, s.state.y]);
		if (p.spores) {
			s.spores("player");
			await s.wait(500);
		}
		se ??= playPageSe(s, p);
		if (p.fx && !fx) {
			fx = { kind: p.fx, run: startFx(fxRoot(), p.fx) };
			await fx.run.ready;
		}
		await se;
		if (p.mob) await sayAs(s, p.mob, p.text, pageCue(p));
		else await playPage(s, { ...p, ...pageCue(p) });
	}
	fx?.run.end();
	card.end();
	// 最終話を はじめて 持ち帰った：「完」の あとに スタッフロール（幕は 暗転して 建て直す まで 残す）
	let closeRoll: (() => void) | null = null;
	if (a.dungeon === "deep" && firstEnding(a, loadProgress())) {
		sceneBgm(s, "title");
		closeRoll = await rollStaff(fxRoot(), {
			blocks: STAFF_ROLL,
			title: STAFF_TITLE,
			after: STAFF_AFTER,
		});
	}
	// 見おえた（一度きりの 語りは 次から 短く）。はじめてなら、通りが 生き返る 知らせ（reviveScript）まで 町に 出さない
	if (a.kind === "clear") {
		if (firstEnding(a, loadProgress())) holdReveal(a.dungeon);
		noteEnding(a.dungeon);
	}
	// 持ち帰りの 曲（ending）と 寸劇の 曲は ここまで。明けたら 村の曲
	const scened = endScene();
	await Promise.all([
		a.kind === "clear" || scened ? s.fadeBgm(300) : Promise.resolve(),
		s.fadeOut(300),
	]);
	closeRoll?.();
	// 場面を うつした・走った キリコは 帰りついた マスへ（あとの 知らせの 場面は 口の 前で 起きる）
	if (s.state.x !== back[0] || s.state.y !== back[1])
		s.place("player", back[0], back[1], exit.inward);
	await rebuild(s);
	endShrooms();
	endChalk();
	endMarks();
	setZankiScene(undefined);
	homes = new Map();
	setSceneSky(null);
	lightsBack.clear();
	s.bgm(villageSong());
	await s.fadeIn(300);
};

// ───────────────── 話す 仲間を そばに ─────────────────

/** これより 離れた 仲間とは 話さない（キリコは 1人で 動いている。村の 窓で 話すのは そばに いる 人だけ）。 */
export const TALK_NEAR = 2;

/** 仲間を 持ち場から 呼んだ 場面（あとで 建て直して 持ち場へ もどす）。 */
const called = new WeakSet<Story>();

/**
 * 村の 場面で 話す 人（仲間・住人。住人は mob_<id>）を キリコの そばへ（離れた 人の 声が 飛んでこないように）。遠い 人だけ、暗転の あいだに
 * キリコの まわりへ 置いて こちらを 向かせる。dark なら もう 暗い（明けるのは 呼ぶ側）。
 * もどすのは sendBack（場面の 終わりに 建て直す）。
 * at を わたすと キリコでは なく その マスの まわりへ（カメラが 建物を 見ている 場面。みんな 置きなおす）。
 * 場面で もう 人を 置いた マスには 置かない。置いた 人と マスを かえす。
 */
export const gather = async (
	s: Story,
	who: readonly (string | null)[],
	opt: { dark?: boolean; at?: readonly [number, number] } = {},
): Promise<ReadonlyMap<string, Cell>> => {
	const out = new Map<string, Cell>();
	const far = [...new Set(who.filter((w): w is string => !!w))].filter(
		(w) => !!opt.at || !s.near(w, TALK_NEAR),
	);
	if (!far.length) return out;
	if (!opt.dark) await s.fadeOut(250);
	const at = opt.at ?? [s.state.x, s.state.y];
	const spots = freeAround(s, far.length, [
		Math.round(at[0]),
		Math.round(at[1]),
	]);
	far.forEach((w, i) => {
		const c = spots[i];
		if (!c) return;
		s.place(w, c[0], c[1]);
		if (opt.at) s.face(w, c[1] > at[1] ? "up" : "down");
		else s.face(w, "player");
		out.set(w, c);
	});
	take(s, [...out.values()]);
	called.add(s);
	if (!opt.dark) await s.fadeIn(250);
	return out;
};

/**
 * gather で 呼んだ 仲間を 持ち場へ もどす（暗転して 建て直す）。呼んでいなければ 何もしない。
 * カメラも 暗い うちに キリコへ もどす（町が 育った 場面は 建った所を 見たまま ここへ 来る。lookHome）。
 */
export const sendBack = async (s: Story): Promise<void> => {
	if (!called.has(s)) return;
	called.delete(s);
	await s.fadeOut(250);
	await rebuild(s);
	await s.look(null, { instant: true });
	await s.fadeIn(250);
};

// ───────────────── 寄り道の 板の 来客 ─────────────────

/** 来客の 頭の 物（UNLOCK_VISIT の 地の文が「頭に きのこが 生えている」と 言う 板）。 */
const VISITOR_PROP: Partial<Record<DungeonId, HeadProp>> = { kinoko: "kinoko" };

/**
 * 寄り道の 板が 開く：その 板の 名無しが 板の 方角の 村の 口から 歩いてきて、キリコの となりで 板の ようすを
 * 話し、口へ 帰っていく（data/story/story.ts の UNLOCK_VISIT）。キリコが その 口の 前に いれば 先に どく（stepAside）。
 */
export const visitScript = async (s: Story, d: DungeonId): Promise<void> => {
	const lines = UNLOCK_VISIT[d] ?? [];
	const gate = exitFor(d).cell;
	await stepAside(s, gate);
	const [to] = freeAround(s, 1);
	// 旗を 立てただけでは 生まれない（when は 見なおされない）。show で 生まれさせてから 口に 置く
	// （旗だけだと 来客が 出ず、カメラも 見る 先が なかった）
	s.set("visitor");
	s.show("visitor");
	s.place("visitor", gate[0], gate[1]);
	s.wear("visitor", VISITOR_PROP[d] ?? null);
	await s.look("visitor");
	if (to) {
		await s.goto("visitor", to[0], to[1], { speed: 1.4 });
		s.face("visitor", "player");
		s.face("player", faceTo(s.state, to));
	}
	await s.look(null);
	for (const [i, l] of lines.entries()) {
		// さいごの 地の文（帰っていった）の 前に 口へ 歩いて 帰る
		if (l.who === null && i === lines.length - 1) {
			await s.wait(0);
			// 頭に きのこの 来客は 立って いた 所に きのこを 1本 置いていく（「きのこを1本置いて」）
			if (VISITOR_PROP[d] === "kinoko" && to) {
				s.set(SHROOM_LEFT, `${to[0]},${to[1]}`);
				dropShroom(to);
			}
			await s.goto("visitor", gate[0], gate[1], { speed: 1.4 });
			s.set("visitor", false);
			s.hide("visitor");
		}
		// 文が 言う 音（ちかづいて くる 太鼓）
		if (l.se) s.se(l.se);
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
	const away = awayFriends(loadProgress().cleared);
	const lines = (TAMPER_SCENE[tier] ?? [])
		.filter((l) => !away.includes(l.who))
		.slice(0, 3);
	await gather(
		s,
		lines.map((l) => l.who),
	);
	for (const l of lines) await s.say(l.who, l.text, cueOf(l));
	await s.narrate(TAMPER_NARRATION[tier] ?? "");
	doneTamperNews();
};

// ───────────────── ぷゆゆの お弁当 ─────────────────

/**
 * 村に 帰って 持ち物（倉庫から 引き取った 道具）が からっぽなら、ぷゆゆが かけてきて ぷゆゆパンを 持たせる
 * （トルネコ1の ネネの お弁当の 役。出るときに 持っていく。data/story/story.ts の DEPART.puyu）。
 * ぷゆゆソードを 渡した すぐ あと（reliefScript）で もう となりに いれば、かけてこず「ぷゆゆパンも」（DEPART.puyuToo）。
 */
export const lunchScript = async (s: Story): Promise<void> => {
	if (!giveLunch()) return;
	// もう となりに いる（ぷゆゆソードを 渡した ばかり）なら、かけてこない
	const already = s.near("mob_puyu", 1);
	// ぷゆゆが キリコの となりまで かけてきて 渡す（そのあとは うろうろ しながら 広場の 下へ もどる。ui/village/village.ts）
	const [to] = already ? [] : freeAround(s, 1);
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
	await s.narrate(already ? DEPART.puyuToo : DEPART.puyu);
};

// ───────────────── たおれた あとの 支給品 ─────────────────

/**
 * たおれて 帰った あと、ときどき（RELIEF_CHANCE）ぷゆゆが かけてきて ぷゆゆソードを 持たせる（易しく する 助け）。
 * 次の 冒険に 持っていく（engine/save.ts の giveRelief。二重に 渡さない）。やめた 冒険では 渡さない。
 * roll は 試験で 決める ため。
 */
export const reliefScript = async (
	s: Story,
	roll = Math.random(),
): Promise<void> => {
	const last = loadRecords()[0];
	// 古い 記録の「冒険を　やめた」（全角空白 あり）も やめた 冒険
	if (last?.kind !== "dead" || last.cause.replaceAll("　", "") === QUIT_CAUSE)
		return;
	if (!giveRelief(last.at, roll)) return;
	const [to] = freeAround(s, 1);
	if (to) {
		await s.goto("mob_puyu", to[0], to[1], { speed: 1.6 });
		s.face("mob_puyu", "player");
		s.face("player", faceTo(s.state, to));
	}
	await sayAs(
		s,
		"puyu",
		PUYU_RELIEF[Math.floor(Math.random() * PUYU_RELIEF.length)] ?? "",
	);
	s.se("item");
	await s.narrate(RELIEF_NOTE);
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
	// 掲示板に 名無しの 一行が ふえる（data/town/headlines.ts。正体は 転で わかる）
	await s.narrate(fill(BOARD_NEWS.death, { line: deathLine(deathCount()) }));
	if (!q) return;
	const [bx, by] = VILLAGE_SPOTS.boot;
	await s.goto(q.who, bx + 1, by, { speed: 1.6 });
	s.face(q.who, "player");
	s.face("player", "right");
	await s.say(q.who, q.text, cueOf(q));
	await s.fadeOut(300);
	await rebuild(s);
	await s.fadeIn(300);
};

/** 語りの 頁の イメージ図（StoryPage.card）。出す・入れかえる ときは めくる 音。 */
const pageCards = (): { show(p: StoryPage): void; end(): void } => {
	let run: CardRun | null = null;
	return {
		show: (p) => {
			if (p.card === undefined) return;
			if (p.card === null) {
				run?.end();
				run = null;
			} else if (run) run.update(p.card);
			else run = showCard(fxRoot(), p.card);
		},
		end: () => {
			run?.end();
			run = null;
		},
	};
};

// ───────────────── 開いた知らせ ─────────────────

/** 転（tenScript）が まだか（風呂板の 語りを 見おえた あと 1回だけ）。 */
export const tenDue = (): boolean =>
	!!loadProgress().endings?.includes("main") && !hasFlag("ten");

/** 転（STORY.md §4.9）：風呂板の 語りを 見おえた 帰りに 1回だけ。停電と、また 盛った 見出し。 */
export const tenScript = async (s: Story): Promise<void> => {
	const card = pageCards();
	// その夜の 場面（村の 時計に かかわらず 夜。明かりが 消える 頁から dark）。
	// 消える までは 持ち帰った 板の 明かりが 灯って いる（町は もう 停電の 並びで 建って いる）
	const on: SceneLit = { boards: loadProgress().cleared, homes: true };
	setSceneSky("night");
	setSceneLit(on);
	await gather(s, ["zero", "roze", "feris", "nanj"]);
	// 外に 残る 人（集まった 仲間と 話す 人）
	const keep = new Set([
		"zero",
		"roze",
		"feris",
		"nanj",
		...castOf(TEN_NEWS.pages),
	]);
	for (const p of withoutAway(
		TEN_NEWS.pages,
		awayFriends(loadProgress().cleared),
	)) {
		// 停電の 無音と 見出しの 曲（data/story/story.ts の TEN_NEWS）
		if (p.bgm !== undefined) sceneBgm(s, p.bgm);
		// 語りが 言う 所を 映す（灯った 広場 → 消える → 暗い 銭湯・掲示板 → 仲間の もとへ）
		if (p.look !== undefined) await s.look(p.look);
		if (p.sky === "dark") {
			// 映した 通りで 明かりが またたいて、町じゅう いっせいに 消える。外の 人は 家に 入る
			s.se("batonDown");
			await flickerOff(s, on);
			setSceneOut({ keep, near: [], all: false });
		} else if (p.sky !== undefined) setSceneSky(p.sky);
		// 暗い 町で 映した 所には、外に 出てきた 人が いる（さけんだ 銭湯・見出しを 見に きた 掲示板）
		const o = sceneOut();
		if (o && p.look) setSceneOut({ ...o, near: [...o.near, p.look] });
		card.show(p);
		// 豆電球が はじける 音と 暗転（文が 言う 音と 光。頁の あいだだけ）
		const fx = p.fx ? startFx(fxRoot(), p.fx) : null;
		await fx?.ready;
		await playPageSe(s, p);
		await playPage(s, { ...p, ...pageCue(p) });
		fx?.end();
	}
	card.end();
	// 場面の 空と 曲は ここまで。村の 曲に もどす
	endScene();
	await s.fadeBgm(300);
	addFlag("ten");
	// 電池板を 持ち帰るまで 町は 停電の 夜の まま
	setSceneSky(null);
	setTownSky(townSkyNow());
	s.bgm(villageSong());
};

/**
 * 次のダンジョンが 開いた 知らせ（持ち帰った・何度も たおれた）。開く口を 見て 仲間が 話し、
 * 村の 出口を 見て 仲間が 話し、「〜に もぐれるように なった」（村の 見た目は 変わらない）。
 */
export const newsScript = async (s: Story): Promise<void> => {
	// まだ 越してきて いない 仲間は 知らせでも 話さない
	const away = awayFriends(loadProgress().cleared);
	const news = loadProgress().news;
	for (const n of news) {
		// 寄り道の 板：その 板の 名無しが 来て 話す（仲間の ひとことの かわり）
		if (n.reason !== "relief" && UNLOCK_VISIT[n.dungeon]) {
			await visitScript(s, n.dungeon);
			doneProgressNews(n);
			s.se("chapter");
			await s.narrate(
				`「${DUNGEON_NAMES[n.dungeon].name}」に\nもぐれるようになった`,
			);
			continue;
		}
		const name = DUNGEON_NAMES[n.dungeon].name;
		// 板ごとの 行が あれば それ（本編・電池板・過去ログの底）。救いで 開いた 本編は relief。
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
		// 話す 仲間だけ そばへ（来客・住人が 話す 知らせでは 呼ばない。名無しは キリコとだけ 話す）
		await gather(
			s,
			lines.map((l) => l.who),
		);
		// 村の 出口の 方を 見る（行き先は 出口から 全体マップで 選ぶ）。出口が キリコから 遠ければ
		// （たおれて 蓄音機の 前に いる relief など）そばの 仲間が 話しおえてから 出口を 見せて「もぐれる」の 1行
		// （見せてから すぐ もどって 話すと、出口が 一瞬しか 映らなかった）
		const [ex, ey] = VILLAGE_SPOTS.exit;
		const far =
			Math.max(Math.abs(s.state.x - ex), Math.abs(s.state.y - ey)) > 3;
		if (!far) await s.look(VILLAGE_SPOTS.exit);
		for (const l of lines) await s.say(l.who, l.text, cueOf(l));
		if (far) {
			// 立ち絵が 出口を 隠さないように 窓を しまってから
			await s.wait(0);
			await s.look(VILLAGE_SPOTS.exit);
		}
		doneProgressNews(n);
		s.se("chapter");
		await s.narrate(
			n.reason === "relief"
				? VILLAGE_MSG.carryRelief
				: `「${DUNGEON_NAMES[n.dungeon].name}」に\nもぐれるようになった`,
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

// ───────────────── 生き返った 通り ─────────────────

/** 住人の イベント ID（gather で 呼ぶ）。 */
const mobEv = (id: MobId): string => `mob_${id}`;

/**
 * 転の 停電（電池板が 開いた 帰り）を 1回だけ 知らせる（開く 知らせの あと）。転（tenScript）を 見て いれば もう 語った。
 */
export const blackoutDue = (): boolean => {
	const p = loadProgress();
	return inBlackout(p) && !hasFlag(BLACKOUT_TOLD) && !hasFlag("ten");
};

export const blackoutScript = async (s: Story): Promise<void> => {
	if (!blackoutDue()) return;
	// 真っ暗な 町（時計に かかわらず 夜で、明かりも ない）
	setSceneSky("dark");
	setSceneOut({ keep: new Set(), near: [], all: false });
	for (const l of REVIVE_MSG.blackout) await s.narrate(l);
	addFlag(BLACKOUT_TOLD);
	setSceneSky(null);
	setTownSky(townSkyNow());
};

/**
 * 持ち帰った 板で 生き返った 通りを 知らせる（まだ 知らせて いない ぶん。TOWN.md §0.6・data/town/revival.ts）。
 * 持ち帰りの 寸劇の すぐ あと：知らせるまで その 通りは すたれた まま、もどる 住人・ご近所も 町に いない（sceneView）。
 * 通りごとに 知らせて 建て直す（店が 開き、人が なだれこむ）。停電の あいだは 生き返った 知らせを 出さない。
 * 本筋の 板なら 町の 段も 上がり、倉庫が 広がる・持ちこめる 数が ふえる。
 */
/** 電池板の 通りの 知らせ「電気代の請求書も、とどいた！」：とどいた 請求書の 絵（文の あいだ 出す）。 */
const POWER_BILL = itemPicture(
	"memo",
	"電気代の請求書",
	{ text: "電気代　請求書\n宛：おんJタウン" },
	"電池板より",
);

/**
 * 丘の 神社の 通りの 知らせ「地面の下から、まだサンバ！」：太鼓の 拍子（ms の 間）を 文の うしろで 鳴らす。
 * 町には ♪ が 残る（sceneMarks）。Story.wait は 窓を 閉じるので 使わない（文が 消える）。
 */
const SAMBA_BEATS = [0, 180, 180, 270, 180, 180, 270] as const;
const samba = (s: Story): void => {
	void (async () => {
		for (const gap of SAMBA_BEATS) {
			await new Promise((r) => setTimeout(r, gap));
			s.se("hit_club");
		}
	})();
};

export const reviveScript = async (s: Story): Promise<void> => {
	const t = loadTown();
	const p = loadProgress();
	const cleared = p.cleared;
	const fresh = inBlackout(p)
		? []
		: REVIVE_AREAS.filter(
				(a) => cleared.includes(a.dungeon) && !t.revived.includes(a.id),
			);
	const r = growTown(t);
	if (!fresh.length && r.to === r.from) return;
	for (const a of fresh) {
		// その 通りを 見せて、すたれた 姿（蜘蛛の巣・雑草…）を 片づけ、生き返った 通りに 建て直す（ui/village/decay.ts）
		const spot = LIGHTS_UP.find((l) => l.area === a.id);
		if (spot) {
			await s.look(spot.at);
			await s.wait(600);
		}
		cleanUp(a.id);
		t.revived.push(a.id);
		saveTown(t);
		releaseReveal(a.dungeon);
		await rebuild(s);
		s.se("townUp");
		// 文に 出てきた 物：請求書は 絵で、サンバは 太鼓の 音で（♪ は 建て直した 町に 残って いる）
		const card = a.id === "lights" ? showCard(fxRoot(), POWER_BILL) : null;
		if (a.id === "shrine") samba(s);
		await s.narrate(a.line);
		card?.end();
		await s.narrate(fill(REVIVE_MSG.open, { name: a.name }));
	}
	if (fresh.length) await s.look(null);
	saveTown(t);
	if ((STORAGE_CAP[r.to] ?? 0) > (STORAGE_CAP[r.from] ?? 0))
		await s.narrate(fill(REVIVE_MSG.storage, { n: STORAGE_CAP[r.to] ?? 0 }));
	const carry = CARRY_MAX[r.to] ?? 0;
	if (carry > (CARRY_MAX[r.from] ?? 0))
		await s.narrate(fill(REVIVE_MSG.carry, { n: carry }));
};

// ───────────────── 持ち帰った物 ─────────────────

/** 売り上げを 町で 使える ことを ジェイトルマンが 言った（Progress.flags）。 */
const WALLET_TOLD = "toldWallet";
const WALLET_WHY_TOLD = "toldWalletWhy";
/** あずけた 物の 正体が わかる ことを ンゴ姉が 言った。 */
const STORE_TOLD = "toldStoreKnown";

/** あずける道具を えらぶ（uid）。村では ui/village/home.ts の chooseStored を 包む（試験では 仮の手）。 */
export type StoreChooser = (
	s: Story,
	t: Town,
	pend: PendingReturn,
) => Promise<number[]>;

/**
 * 持ち帰った物を 機材倉庫へ・買い取り屋で 売る（おあずかりが 無ければ 何もしない）。
 * ンゴ姉が あずける物を きいて、のこりを ジェイトルマンが 買い取る（TOWN.md §0.4）。
 */
export const settleScript = async (
	s: Story,
	choose: StoreChooser,
): Promise<void> => {
	const t = loadTown();
	const pend = t.pending;
	if (!pend) return;
	const cap = STORAGE_CAP[t.stage] ?? 0;
	const say = (l: StaffLine, vars: Record<string, string | number> = {}) =>
		sayAs(s, l.who, fill(l.text, vars), cueOf(l));
	// あずかる ンゴ姉・買い取る ジェイトルマンを そばへ
	await gather(
		s,
		(pend.items.length
			? [TOWN_MSG.storePrompt, TOWN_MSG.sold]
			: [TOWN_MSG.soldNothing]
		).map((l) => mobEv(l.who)),
	);
	let chosen: number[] = [];
	if (!pend.items.length) await say(TOWN_MSG.soldNothing);
	else if (t.storage.length >= cap) await say(TOWN_MSG.storageFull);
	else {
		await say(TOWN_MSG.storePrompt);
		await s.wait(0);
		chosen = await choose(s, t, pend);
	}
	// 選んでいるあいだに 別のタブで 決められていたら、ここでは 何もしない（古い町で 上書きしない）
	const cur = loadTown();
	if (JSON.stringify(cur.pending) !== JSON.stringify(pend)) return;
	const r = settleReturn(cur, chosen);
	if (chosen.length) {
		await say(TOWN_MSG.storeDone);
		// あずけた 物は 正体が わかる（engine/save.ts の settleReturn・depositBag）。はじめの 1回だけ
		if (!hasFlag(STORE_TOLD)) {
			await say(TOWN_MSG.storeKnown);
			addFlag(STORE_TOLD);
		}
	}
	if (r.sold > 0) {
		await say(TOWN_MSG.sold, { points: r.sold });
		// 売り上げが 財布にも なる ことと、町で 使って いい わけを はじめの 1回だけ
		if (!hasFlag(WALLET_TOLD)) {
			await say(TOWN_MSG.wallet);
			addFlag(WALLET_TOLD);
		}
		if (!hasFlag(WALLET_WHY_TOLD)) {
			for (const l of WALLET_WHY) await say(l);
			addFlag(WALLET_WHY_TOLD);
		}
	}
};
