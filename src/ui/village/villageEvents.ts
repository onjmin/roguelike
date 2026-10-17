// 村（おんJタウン）の イベントの スクリプトと、B／☰ の 村の メニュー。
// 地図の形と 人・物の 置き場所は data/village/map.ts（DOM を使わない）。ここで id ごとに スクリプトを付ける。
//
// - ダンジョンの口：踏むと 中断した冒険の 確認 → もぐる？ → （本編なら）倉庫からの 持ちこみ →
//   はじめてなら 語り → 村を出る。やめたら 1歩 もどる。板ごとの 目的（持ち帰り・ボス。期間限定の
//   イベントも。data/story/objectives.ts）は 行き先を 選ぶ 前に 1回だけ 決めて、地図と 冒険に 同じ 値を 渡す。
// - 立て札：ダンジョンの 名前・階の数・持ち帰ったら ★・説明（開いていなければ 開き方）。口でも 同じ 札を 読む。
// - 仲間：1回の 帰りに 1人 1つ、前の冒険への 新しい ひとこと。聞いたら 町の様子の
//   決まった ひとこと（ui/village/villageTalk.ts）。話すだけ（店番の ロゼ・シヨも）。
//   機能は 人に 結びつけず 物に 置く（冒険の記録＝掲示板、図鑑・あそびかた・売り上げ・リプレイ＝本館の 中の 物、
//   倉庫＝倉庫の 中の 棚）。B／☰ の メニューは 持ち物・あらすじ・せってい だけ。
// - 板で ふさいだ口・掲示板・蓄音機は 調べると 地の文。段7 は 野次馬も 話す。
// - 喫茶・小屋・銭湯・音楽室・本屋・倉庫・常識堂の 勝手口の 扉は 踏むと 中へ（ui/village/cafe.ts・ui/village/rooms.ts）。
//   倉庫・常識堂の 扉は 台の 横の 細道の 奥（店番に たのまなくても 入れる）。
// - おんJ 本館の 扉（2マス）は 踏むと（前で A でも）中の 地図へ（ui/village/hallEvents.ts）。
// - おんJマイナーズと ぷゆゆ（板を 持ち帰ると 帰ってくる。data/people/mobs.ts の MOB_BACK）は ui/village/villageMobs.ts。2人に 会うと 掲示板に 人気投票の はり紙。
// - 開発用の 段の 下見（?stage=N）は 描く段だけ かえる（ui/village/villageReturn.ts の previewStage）。
// - 帰ってきたとき（prepare・onEnter）：口の前に 仲間が 並んで むかえる → 開いた知らせ → 持ち帰った物の
//   倉庫・売り → 町が 育つ（場面は ui/village/villageReturn.ts。あずける 一覧だけ ui/village/home.ts）。
// - いちばん最初（一度も もぐっていない）は 前口上と 行き先の 場面（ui/village/villageOpening.ts）。

import { DUNGEON_IDS, DUNGEONS, floorsLabel } from "../../core/data/dungeons";
import { HERO_NAME } from "../../core/data/heroes";
import { CARRY_MAX } from "../../core/town";
import type {
	DungeonId,
	GuestId,
	GuestSpec,
	Item,
	Objective,
} from "../../core/types";
import { CAST } from "../../data/people/cast";
import {
	ESCORT_MSG,
	type EscortRequest,
	escortById,
	escortFor,
	escortSpec,
	openEscorts,
	requesterName,
	speakerOf,
} from "../../data/people/companions";
import { HERO_QUESTS, type QuestLine } from "../../data/people/heroQuests";
import { BOARD_MENU, type MobId } from "../../data/people/mobs";
import {
	type ObjectiveInfo,
	objectiveFor,
	withDevEvent,
} from "../../data/story/objectives";
import type { Speaker } from "../../data/story/quotes";
import { DEPART, DUNGEON_NAMES, EPISODES, STORY } from "../../data/story/story";
import { revivedLine, synopsisNow } from "../../data/story/synopsis";
import {
	BOARD_NEWS,
	deathLine,
	HEADLINES,
	ROLLBACK_HEADLINE,
} from "../../data/town/headlines";
import {
	activeIncidents,
	activeVisitors,
	carryLocked,
	type IncidentPerson,
	incidentPlaceId,
} from "../../data/town/incidents";
import {
	inBlackout,
	isRevived,
	lampsLit,
	MAIN_BOARDS,
	reviveAreaOf,
	revivedBoards,
	stageOfCleared,
} from "../../data/town/revival";
import { type Surface, surfaceMapId, surfaceOf } from "../../data/town/surface";
import {
	CARRY_CHASE,
	CARRY_LOCK,
	CARRY_LOCK_CHASE,
	CARRY_REFUSE,
	STORE_DESK,
	TOWN_MSG,
	TOWN_NAME,
	VILLAGE_MSG,
} from "../../data/town/town";
import { crowdNodes, villagePedCost } from "../../data/village/crowd";
import {
	facilitiesAt,
	facilityOfDoor,
	outdoorThingOf,
} from "../../data/village/facilities";
import { npc, sign } from "../../data/village/helpers";
import {
	layoutStage,
	unlitCells,
	VILLAGE_EXITS,
	VILLAGE_H,
	VILLAGE_SPOTS,
	VILLAGE_W,
	VISITOR_WALK,
	type VillagePlace,
	type VillageView,
	villagePalette,
	villagePlaces,
	villageRows,
} from "../../data/village/map";
import type {
	EventDef,
	LightRule,
	MapDef,
	Script,
	Story,
} from "../../engine/defs";
import { type Cue, cueOf } from "../../engine/emote";
import {
	acceptEscort,
	doneEscortThanks,
	dropEscort,
	loadEscort,
	pendingThanks,
} from "../../engine/escort";
import {
	acceptQuest,
	chooseHero,
	chosenHero,
	type QuestHero,
	questStage,
	takeWorryNews,
	unlockedHeroes,
	unlockHero,
} from "../../engine/heroes";
import {
	addFlag,
	addRecord,
	clearRun,
	deathCount,
	depositBag,
	hasFlag,
	hasRunSave,
	loadProgress,
	loadRecords,
	loadRun,
	loadTown,
	notePicked,
	noteRunEnd,
	recordFromRun,
} from "../../engine/save";
import { earnYen, walletYen, yen } from "../../engine/wallet";
import { runSaveLabel } from "../boot";
import type { Ctx } from "../ctx";
import { infoWindow, type ListItem, listWindow } from "../list";
import { chimneySteam } from "../minigames/bath";
import {
	imoniArrive,
	imoniBoardMenu,
	imoniBoardScript,
	imoniDecor,
} from "../minigames/imoni";
import { sabaEvents } from "../saba/saba";
import { openSettings } from "../settings";
import { boardCell, stockBoardDecor } from "../trade/stockBoardDecor";
import { withBond } from "./bonds";
import { enterCafe } from "./cafe";
import { decayDecor, signRuined } from "./decay";
import { offDecor, outsideDisplays } from "./displays";
import { enterFacility, outdoorScript } from "./facilities";
import { villageFindGlint } from "./finds";
import { folkEvent } from "./folk";
import { enterHall } from "./hallEvents";
import { heroJoinScene } from "./heroJoin";
import { chooseStored, openBag, openStorage } from "./home";
import { previewing } from "./pay";
import { escBr, openRecords, showStory } from "./records";
import { enterBath, enterMusic, enterRoom } from "./rooms";
import { shadowGround } from "./shadows";
import { signboardDecor, signboardGlow } from "./signboards";
import type { Arrival } from "./village";
import { mobScript, sayAs, senkyoOpen, senkyoScript } from "./villageMobs";
import { chooseRecord, endScene, sceneBgm, villageSong } from "./villageMusic";
import {
	needsOpening,
	openingNotYet,
	openingPrepare,
	openingScript,
	openingStep,
	openingWalking,
} from "./villageOpening";
import {
	deathScene,
	gather,
	lineUp,
	lunchScript,
	newsScript,
	previewStage,
	type ReturnArrival,
	reliefScript,
	returnScene,
	reviveScript,
	type StoreChooser,
	sceneView,
	sendBack,
	settleScript,
	tamperScript,
	tenScript,
} from "./villageReturn";
import { DUNGEON_DESC, fill, talkQuote } from "./villageTalk";
import { openWorldMap, pickColony, travelTo } from "./worldMap";

/** 開いた 植民地の 札（名前・通称・階の数・持ち帰ったら ★、2行目に 板の 決まり）。口と 立て札で 読む。 */
const signText = (d: DungeonId): string =>
	`「${DUNGEON_NAMES[d].name}（${DUNGEON_NAMES[d].nick}）」　${floorsLabel(d)}階${loadProgress().cleared.includes(d) ? "　★" : ""}\n${DUNGEON_DESC[d]}`;

/** 立て札の 2枚目から（板の ようすと ほかの 決まり・マスコット）。 */
const signMore = (d: DungeonId): string[] => {
	const n = DUNGEON_NAMES[d];
	return [
		n.rules.filter((_, i) => i !== 1).join("\n"),
		`マスコット：${n.mascot}`,
	];
};

/** メッセージ窓を 隠す（メニュー・一覧の窓を 出す前に）。 */
const hideMsg = (s: Story) => s.wait(0);

/** 探索者を かえられる ことを 知らせた 印（Progress.flags）。 */
const HERO_GUIDE_TOLD = "toldHero";

/** 冒険の記録を見る（記録だけ。リプレイは 本館の 映写機で：ui/village/hallEvents.ts）。 */
const records = async (ctx: Ctx, s: Story): Promise<void> => {
	await hideMsg(s);
	await openRecords(ctx);
};

/** 飾りを 重ねる（影 → 湯気の 順）。 */
/** おんJ証券の 店先の 株価の 看板（外の 形の 1234）の 左端の マス（建って いなければ null）。 */
const shokenSign = (stage: number): readonly [number, number] | null => {
	const f = facilitiesAt(stage).find((x) => x.id === "shoken");
	if (f?.look.kind !== "grid") return null;
	const c = boardCell(f.look.rows);
	return c && [f.at[0] + c[0], f.at[1] + c[1]];
};

const joinDecor =
	(...ds: MapDef["decor"][]): MapDef["decor"] =>
	(g, ox, oy, t) => {
		for (const d of ds) d?.(g, ox, oy, t);
	};

/** バス停・駅の 改札から 出かける（踏まずに 調べるので、やめても 1歩 もどらない）。 */
export const departAnywhere = (ctx: Ctx): Script => mouthScript(ctx, null);

/** 中断した冒険を すてる（やめた、として 記録に残す）。 */
const abandonRun = (): void => {
	const old = loadRun();
	if (old) {
		addRecord(recordFromRun(old));
		// 何もせずに すてた冒険は 救い（10回で開く）に数えない（すぐ すてるのを くり返して 開けないように）
		if (old.stats.maxDepth >= 2) noteRunEnd(old.dungeon, "dead", old.seed);
	}
	clearRun();
};

/** 出口から 村へ 1歩 もどる（出口の イベントの 向き → Story.move の 1文字）。 */
const stepOf: Record<string, string> = {
	down: "d",
	up: "u",
	left: "l",
	right: "r",
};

/**
 * 中断した冒険が あれば 先に きく（冒険に　もどる・すてて　新しく　もぐる・やめる）。村の 出口と 井戸で 同じ。
 * 続きへ 出た・やめた なら false（呼ぶ側は そこで 終わる。やめたときは back 済み）。
 */
export const suspendedFirst = async (
	s: Parameters<Script>[0],
	back: () => Promise<void>,
): Promise<boolean> => {
	if (!hasRunSave()) return true;
	await s.narrate(`${VILLAGE_MSG.suspended}\n${runSaveLabel(loadRun())}`);
	const n = await s.choose(["冒険にもどる", "すてて新しくもぐる", "やめる"], {
		cancel: 2,
	});
	// すてるのは もどせないので もう一度 きく
	if (n === 1) {
		await s.narrate("中断した冒険はもどらない。\n本当にすてる？");
		if ((await s.choose(["すてる", "やめる"], { cancel: 1, start: 1 })) !== 0) {
			await back();
			return false;
		}
	}
	if (n === 2) {
		await back();
		return false;
	}
	if (n === 0) {
		// いつも読み直す（別タブの 古い写しから 始めないように）
		const state = loadRun();
		if (state) {
			s.se("stairs");
			s.exit({ kind: "continue", state });
			return false;
		}
		clearRun();
		await s.narrate(VILLAGE_MSG.broken);
	} else {
		abandonRun();
		// すてたので 次のダンジョンが開いたなら（救い）、ここで知らせる
		await newsScript(s);
		await sendBack(s);
	}
	return true;
};

/**
 * 板ごとの 目的（期間限定の イベントも）は 出る 前に 1回だけ 決める。地図に 出す 目的と
 * Run.create に 渡す 目的を 同じに する（歩いている あいだに イベントが かわっても ずれない）。
 */
export const goalsNow = (): Record<DungeonId, ObjectiveInfo> => {
	const prog = withDevEvent(loadProgress());
	return Object.fromEntries(
		DUNGEON_IDS.map((x) => [x, objectiveFor(x, prog)]),
	) as Record<DungeonId, ObjectiveInfo>;
};

/**
 * 行き先が 決まってから 出るまで（村の 出口と 井戸で 同じ）：持ち物・出発の 一言・向かう（travel）・
 * はじめての 板の 語り。
 */
export const departTo = async (
	ctx: Ctx,
	s: Parameters<Script>[0],
	d: DungeonId,
	goal: ObjectiveInfo,
	travel: () => Promise<void>,
): Promise<void> => {
	// 村で 倉庫から 引き取った 道具を 持っていく（取り出すのは main.ts）。持ちこめない 板なら
	// シヨが 追いかけてきて 倉庫へ もどす（わけは data/town/town.ts の CARRY_REFUSE。全体マップの 札にも 出る）
	let carry: Item[] = loadTown().bag;
	// きのこ板の 騒ぎの あいだは ゼロが 倉庫に 鍵（data/town/incidents.ts の lockCarry）
	const refuse = DUNGEONS[d].noCarry
		? CARRY_REFUSE[d as keyof typeof CARRY_REFUSE]
		: carryLocked(loadProgress())
			? CARRY_LOCK
			: undefined;
	if (carry.length && refuse) {
		await s.narrate(DUNGEONS[d].noCarry ? CARRY_CHASE : CARRY_LOCK_CHASE);
		await sayAs(s, refuse.who, refuse.text, cueOf(refuse));
		depositBag();
		carry = [];
	}
	// 出かける ときに 港の 掲示板に つく 名無し（やきう）の 書きこみ（STORY.md §4.9）。最終話までは 毎回 同じ
	// （同じ 一言の くり返しが 頂点の 伏線）。最終話の あとは 潜った 回数で 毎回 ちがう 一言
	await s.narrate(
		loadProgress().cleared.includes("deep")
			? DEPART.free[loadRecords().length % DEPART.free.length]
			: DEPART.nanj,
	);
	// 同行の 依頼（引き受けた 依頼の 板へ 出る ときだけ 依頼主が ついてくる。data/people/companions.ts）
	const town = loadTown();
	const companion = escortFor(
		d,
		loadEscort().accepted,
		loadProgress().cleared,
		previewStage() ?? town.stage,
		town.points,
		chosenHero(),
	);
	if (companion) {
		await s.narrate(companion.join);
		await requesterSays(s, companion.who, companion.line, companion.lineCue);
	} else {
		// 引き受けた 依頼の 板へ、依頼主 本人が 主人公で 出る：同じ 人は 2人 いない ので、依頼は つぎの 機会に
		const e = escortById(loadEscort().accepted);
		if (e && e.board === d && e.who === chosenHero())
			await s.narrate(fill(ESCORT_MSG.self, { name: requesterName(e.who) }));
	}
	notePicked(d, false);
	await hideMsg(s);
	await travel();
	const go: Dive = {
		dungeon: d,
		carry,
		objective: goal.objective,
		...(companion ? { guest: escortSpec(companion) } : {}),
	};
	// 板の 小さな 地上（TOWN.md §0.3）に 着いて、入口まで 歩いてから 降りる（data/town/surface.ts）
	const surf = surfaceOf(d);
	if (surf) {
		pendingDive = go;
		await s.warp(surfaceMapId(d), surf.arrive[0], surf.arrive[1], "up");
		await s.fadeIn(400);
		return;
	}
	await dive(ctx, s, go);
};

/** 降りる ときに 持っていく もの（departTo で 決めて、地上が あれば 入口を 踏むまで あずかる）。 */
type Dive = {
	dungeon: DungeonId;
	carry: Item[];
	objective: Objective;
	guest?: GuestSpec;
};

/** 地上に 着いて まだ 降りて いない 冒険（地上の 入口で 使う）。 */
let pendingDive: Dive | null = null;

/** はじめての 板なら 語りを 見せて、地下へ 降りる。 */
const dive = async (ctx: Ctx, s: Story, go: Dive): Promise<void> => {
	const d = go.dungeon;
	pendingDive = null;
	// そのダンジョンに はじめて もぐるなら 語りを見せる（見終わってから 覚える。途中で閉じたら 次も はじめから）
	if (!loadProgress().intro.includes(d)) {
		void ctx.audio.fadeBgm(500);
		await s.fadeOut(500);
		// 本筋の 板は 話数の 題から（data/story/story.ts の EPISODES）
		const ep = EPISODES[d];
		await showStory(ctx, [
			...(ep
				? [
						`<span class="story-ep-no">${escBr(ep.no)}</span><br><span class="story-ep-title">${escBr(ep.title)}</span>`,
					]
				: []),
			// 潜る 人が キリコで なければ「キリコは」を その 人に（「キリコの　生まれた　スレ」は そのまま）
			...STORY[d].intro.map((t) =>
				escBr(t.replaceAll("キリコは", `${HERO_NAME[chosenHero()]}は`)),
			),
		]);
		notePicked(d, true);
	}
	// ぷゆゆの お弁当（村に 帰って 持ち物が からっぽなら もらえる。ui/village/villageReturn.ts の lunchScript）
	s.exit({
		kind: "new",
		dungeon: d,
		carry: go.carry,
		objective: go.objective,
		lunch: loadTown().lunch,
		...(go.guest ? { guest: go.guest } : {}),
	});
};

/**
 * 板の 小さな 地上（1画面。data/town/surface.ts）。入口を 踏むと 降りる・立て札・着いた 道の はしを 踏むと 町へ もどれる。
 */
export const buildSurface = (surf: Surface, ctx: Ctx): MapDef => {
	const d = surf.dungeon;
	const [bx, by] = surf.back;
	const [mx, my] = surf.mouth;
	const [sx, sy] = surf.sign;
	return {
		id: surfaceMapId(d),
		name: surf.name,
		tiles: surf.tiles,
		rows: [...surf.rows],
		outside: "#1f2a14",
		events: [
			sign(`surface_sign_${d}`, sx, sy, surf.line),
			{
				id: `surface_mouth_${d}`,
				x: mx,
				y: my,
				trigger: "touch",
				run: async (s) => {
					// あずけた 冒険が なければ（リプレイから もどった など）いまの 持ち物と 目的で
					const go =
						pendingDive?.dungeon === d
							? pendingDive
							: {
									dungeon: d,
									carry: loadTown().bag,
									objective: goalsNow()[d].objective,
								};
					await dive(ctx, s, go);
				},
			},
			{
				id: `surface_back_${d}`,
				x: bx,
				y: by,
				trigger: "touch",
				run: async (s) => {
					const c = await s.choose(["町へもどる", "やめる"], {
						cancel: 1,
					});
					if (c !== 0) {
						await s.move("player", "u");
						return;
					}
					pendingDive = null;
					// 港の 桟橋の 先へ（船で 帰ってきた ところ）
					const [ex, ey] = VILLAGE_EXITS[0].cell;
					await s.fadeOut(400);
					await s.warp("village", ex, ey - 1, "up");
					await s.fadeIn(400);
				},
			},
		],
	};
};

/**
 * 広場の 井戸（5段から）。過去ログの底（おんJタウンの 真下）へは ここからだけ 降りる（全体マップには 出さない）。
 * 開くまでは のぞくだけ。
 */
const wellScript =
	(ctx: Ctx): Script =>
	async (s) => {
		if (!loadProgress().unlocked.includes("hidden")) {
			await s.narrate(VILLAGE_MSG.wellShut);
			return;
		}
		await s.narrate(VILLAGE_MSG.wellOpen);
		if ((await s.choose(["降りる", "やめる"], { cancel: 1, start: 1 })) !== 0)
			return;
		if (!(await suspendedFirst(s, async () => {}))) return;
		// 探索者が 2人 いじょう いれば、だれが 降りるかを 選ぶ（全体マップの「探索者」と 同じ。選んだ 人は 覚える）
		const heroes = unlockedHeroes();
		if (heroes.length > 1) {
			await s.narrate(VILLAGE_MSG.wellWho);
			const now = chosenHero();
			const k = await s.choose([...heroes.map((h) => HERO_NAME[h]), "やめる"], {
				cancel: heroes.length,
				start: Math.max(0, heroes.indexOf(now)),
			});
			if (k >= heroes.length) return;
			chooseHero(heroes[k]);
		}
		const hero = HERO_NAME[chosenHero()];
		await departTo(ctx, s, "hidden", goalsNow().hidden, async () => {
			// 井戸の 縁に 立って、のぞきこみ、縄ばしごを 降りていく（暗転しながら 下へ 沈む 音）
			const [wx, wy] = VILLAGE_SPOTS.well;
			await s.goto("player", wx, wy + 1, { speed: 1.4 });
			s.face("player", "up");
			await s.look([wx, wy]);
			s.se("door");
			await s.wait(350);
			s.se("stairs");
			await s.wait(250);
			s.se("stairs");
			void s.fadeBgm(900);
			await s.fadeOut(900);
			s.se("fall");
			await s.narrate(fill(VILLAGE_MSG.wellDown, { hero }));
		});
	};

/** おみくじを 引いた 帰り（記録の 終わった 時刻。1回の 帰りに 1回）。 */
const OMIKUJI_KEY = "kiriko-roguelike/omikuji";

/** おんJ神社の 賽銭箱（段2 から）。お参りすると おみくじ（地の文だけ。冒険には 効かない）。 */
const shrineScript: Script = async (s) => {
	await s.narrate(VILLAGE_MSG.shrine);
	if ((await s.choose([...VILLAGE_MSG.shrineMenu], { cancel: 1 })) !== 0)
		return;
	const at = String(loadRecords()[0]?.at ?? 0);
	let last: string | null = null;
	try {
		last = localStorage.getItem(OMIKUJI_KEY);
	} catch {}
	if (last === at) {
		await s.narrate(VILLAGE_MSG.omikujiAgain);
		return;
	}
	try {
		localStorage.setItem(OMIKUJI_KEY, at);
	} catch {}
	s.se("glass");
	await s.narrate(VILLAGE_MSG.shrinePray);
	const all = VILLAGE_MSG.omikuji;
	await s.narrate(all[Math.floor(Math.random() * all.length)]);
};

/** 村の 出口。踏むと 全体マップで 行き先を 選んで もぐるか きく（やめたら 1歩 もどる）。 */
const mouthScript =
	(ctx: Ctx, step: string | null = "d"): Script =>
	async (s) => {
		// いちばん 最初の 村で まだ 広場を 見て いない（ui/village/villageOpening.ts）
		if (openingWalking()) return openingNotYet(s, step);
		// 行き先（はじめは 筋の 次の 板。筋を 終えたら 前に 行った 板。無ければ パン板。全体マップで ほかの 板も 選べる。
		// 過去ログの底は 井戸から なので 地図には 出さない）
		const pr = loadProgress();
		const next = MAIN_BOARDS.find(
			(b) => pr.unlocked.includes(b) && !pr.cleared.includes(b),
		);
		const last = pr.last;
		let d: DungeonId =
			next ??
			(last && !DUNGEONS[last].secret && pr.unlocked.includes(last)
				? last
				: "shallow");
		// やめたら 1歩 もどる（バス停は 踏まずに 調べるので もどらない）
		const back = async () => {
			if (step) await s.move("player", step);
		};
		if (!(await suspendedFirst(s, back))) return;
		// 行き先の 植民地（全体マップで 選ぶ。ui/village/worldMap.ts）
		const open = DUNGEON_IDS.filter((x) => loadProgress().unlocked.includes(x));
		const cleared = loadProgress().cleared;
		const goals = goalsNow();
		// 地図は 向かい おわるまで 開いた まま（本当に 行くか・持ち物・出発の 一言も 地図の 上で）
		await hideMsg(s);
		const map = openWorldMap(ctx, {
			open,
			cleared,
			goals,
			carryMax: CARRY_MAX[loadTown().stage] ?? 0,
			locked: carryLocked(loadProgress()),
		});
		const quit = async () => {
			await hideMsg(s);
			await map.close();
			await back();
		};
		// 仲間が 加わって はじめて 出る ときは、探索者を かえられる ことを 1回だけ 知らせる
		if (unlockedHeroes().length > 1 && !hasFlag(HERO_GUIDE_TOLD)) {
			const hero = HERO_NAME[chosenHero()];
			for (const t of VILLAGE_MSG.heroGuide) await s.narrate(fill(t, { hero }));
			if (!previewing()) addFlag(HERO_GUIDE_TOLD);
		}
		// 選んだら 本当に 行くか きく（地図の 押しまちがいで 出ないように。えらびなおすと 地図へ）
		for (;;) {
			await hideMsg(s);
			const picked = await pickColony(ctx, {
				open,
				cleared,
				start: d,
				goals,
				view: map,
			});
			if (!picked) {
				await quit();
				return;
			}
			d = picked;
			// 開いた 板が 1つだけなら 押しまちがいは 起きない（選んだ＝行く。はじめての 人の 押す 回数を へらす）
			if (open.length === 1) break;
			// 問いの 窓は 出さず、選ぶ 窓だけ（行き先は 地図の 札に 出ている。押す 回数を 1つ へらす）
			const ok = await s.choose(
				[`${DUNGEON_NAMES[d].name}へ行く`, "えらびなおす", "やめる"],
				{ cancel: 1 },
			);
			if (ok === 2) {
				await quit();
				return;
			}
			if (ok !== 0) continue;
			break;
		}
		// 前に 行ったことが あれば 速く 歩く（語りを 見た＝行った）
		const been = loadProgress().intro.includes(d);
		const to = d;
		// 全体マップの 上を 行き先まで 歩く（着くと 建物の 札）
		await departTo(ctx, s, to, goals[to], () =>
			travelTo(ctx, to, {
				open,
				cleared,
				fast: been,
				view: map,
				// 地図の 下で 村を 先に 暗くして、地図から そのまま 暗転する（村に いちど もどって 見えないように）
				beforeClose: () => s.fadeOut(0),
			}),
		);
	};

/** 掲示板に 出ている 同行の 依頼（段の 下見も 段で）。 */
const boardEscorts = (stage: number) =>
	openEscorts(
		loadProgress().cleared,
		stage,
		loadTown().points,
		loadEscort().done,
	);

/** 依頼主の 声（仲間は 村の 窓・住人は sayAs。呼びよせない：はり紙の 字や 出発の ひとこと）。 */
const requesterSays = async (
	s: Story,
	who: GuestId,
	text: string,
	cue: Cue = {},
): Promise<void> => {
	const sp = speakerOf(who);
	if (sp) await s.say(sp, text, cue);
	else await sayAs(s, who as MobId, text, cue);
};

/**
 * 掲示板の 同行の 依頼：一覧 → はり紙を 読む（依頼主の 声で）→ 引き受ける／やめる（引き受けて いれば とりやめも）。
 * 引き受けるのは 1つまで（ほかを 引き受けて いれば かえるか きく）。
 */
const escortBoardScript = async (
	ctx: Ctx,
	s: Story,
	list: readonly EscortRequest[],
): Promise<void> => {
	const memo = loadEscort();
	await hideMsg(s);
	const id = await listWindow(
		ctx,
		fill(ESCORT_MSG.list, { n: list.length }),
		list.map((e) => ({
			label: `「${e.title}」`,
			sub: `${requesterName(e.who)}・${DUNGEON_NAMES[e.board].short}${memo.accepted === e.id ? `・${ESCORT_MSG.mark}` : ""}`,
			value: e.id,
		})),
	);
	const e = list.find((x) => x.id === id);
	if (!e) return;
	await s.narrate(fill(ESCORT_MSG.head, { name: requesterName(e.who) }));
	for (const t of e.ask) await requesterSays(s, e.who, t);
	if (memo.accepted === e.id) {
		const n = await s.choose([...ESCORT_MSG.chooseAccepted], { cancel: 0 });
		if (n === 1) {
			dropEscort();
			await s.narrate(ESCORT_MSG.dropped);
		}
		return;
	}
	if (memo.accepted) await s.narrate(ESCORT_MSG.swap);
	const n = await s.choose([...ESCORT_MSG.choose], { cancel: 1 });
	if (n !== 0) return;
	acceptEscort(e.id);
	s.se("decide");
	await s.narrate(
		fill(ESCORT_MSG.accepted, {
			board: DUNGEON_NAMES[e.board].name,
			name: requesterName(e.who),
		}),
	);
};

/** 同行の 依頼を はたして 帰った：依頼主が 来て お礼（少しの お金。data/people/companions.ts）。 */
const escortThanksScript = async (s: Story): Promise<void> => {
	const e = escortById(pendingThanks());
	if (!e) return;
	const sp = speakerOf(e.who);
	if (sp) await gather(s, [sp]);
	for (const [i, t] of e.thanks.entries())
		await requesterSays(s, e.who, t, i === 0 ? e.thanksCue : undefined);
	earnYen(e.reward);
	s.se("item");
	await s.narrate(fill(ESCORT_MSG.reward, { yen: yen(e.reward) }));
	doneEscortThanks();
};

/**
 * 広場の 掲示板：生き返った 通りの 数を 見て、冒険の 記録・人気投票の はり紙（出て いれば）などから えらぶ。
 */
const boardScript =
	(ctx: Ctx, view: VillageView): Script =>
	async (s) => {
		// パン板の 騒ぎの あいだは 差し押さえ（data/town/incidents.ts）
		const seized = activeIncidents(view).find((i) => i.seize)?.seize;
		// 名無しの 見出しと、倒れた ときの 一行（data/town/headlines.ts）
		const news = async () => {
			// 開いて いて まだ 持ち帰って いない 板の 見出し（新しい 2本）。最終話の あとは ロールバックの 見出し
			const open = view.unlocked.filter(
				(d) => !view.cleared.includes(d) && HEADLINES[d],
			);
			const lines = view.cleared.includes("deep")
				? [ROLLBACK_HEADLINE]
				: open.slice(-2).map((d) => HEADLINES[d] ?? "");
			for (const line of lines)
				await s.narrate(fill(BOARD_NEWS.headline, { line }));
			const deaths = deathCount();
			if (deaths > 0)
				await s.narrate(
					fill(BOARD_NEWS.deathOnBoard, { line: deathLine(deaths) }),
				);
		};
		// 差し押さえでも 見出しは 読めるし、冒険の 記録・あらすじ・せっていも 選べる
		await s.narrate(seized ?? VILLAGE_MSG.board);
		await news();
		// 生き返った 通り（data/town/revival.ts）
		// 停電の あいだは 0（data/town/revival.ts の revivedBoards）
		await s.narrate(revivedLine(revivedBoards(view)));
		const stage = previewStage() ?? loadTown().stage;
		// おんJ芋煮会の はり紙（10月だけ。ui/minigames/imoni.ts）
		const imoni = imoniBoardMenu();
		// 同行の 依頼（data/people/companions.ts。持ち帰った 板の 依頼が 出ている・引き受けている ときだけ）
		const escorts = boardEscorts(stage);
		const opts = [
			"冒険の記録",
			...(escorts.length ? [ESCORT_MSG.menu] : []),
			...(senkyoOpen() ? [BOARD_MENU[1]] : []),
			...(imoni ? [imoni] : []),
			"やめる",
		];
		if (opts.length === 2) {
			await records(ctx, s);
			return;
		}
		const n = await s.choose(opts, { cancel: opts.length - 1 });
		const v = opts[n];
		if (v === "冒険の記録") await records(ctx, s);
		else if (v === ESCORT_MSG.menu) await escortBoardScript(ctx, s, escorts);
		else if (v === BOARD_MENU[1]) await senkyoScript(s);
		else if (imoni && v === imoni) await imoniBoardScript(s);
	};

/** 口の 立て札。 */
const exitSignScript: Script = async (s) => {
	const p = loadProgress();
	const open = DUNGEON_IDS.filter((d) => p.unlocked.includes(d));
	await s.narrate(
		`「植民地へつづく道」\n行ける板：${open.length}　持ち帰った板：${p.cleared.length}`,
	);
	// 前に 行った 板（無ければ パン板）の 札
	const d = p.last && open.includes(p.last) ? p.last : open[0];
	if (!d) return;
	await s.narrate(signText(d));
	for (const t of signMore(d)) await s.narrate(t);
};

/** 仲間の ひとこと（1回の 帰りに 1つ 新しい話。聞いたら 決まった ひとこと）。 */
const speak = async (
	s: Story,
	who: Speaker,
	o: { gate?: boolean } = {},
): Promise<void> => {
	const l = talkQuote(who, o);
	await s.say(who, l.text, cueOf(l));
};

/** 仲間の 話しかけ（ひとこと）。帳簿・図鑑・あそびかたは 本館の 物。 */
const friendScript =
	(who: Speaker, ctx: Ctx): Script =>
	async (s) => {
		if (
			(who === "roze" || who === "zero") &&
			(await heroQuestScript(s, who, (h) => heroJoinScene(ctx, h)))
		)
			return;
		await speak(s, who);
	};

/**
 * ンゴ姉の 窓口（機材倉庫の 人。TOWN.md §0.4）：倉庫を つかう（引き出す・預ける。ui/village/home.ts の openStorage）・
 * 話す（ふだんの 住人の 話。talk）。
 */
const storeDesk =
	(ctx: Ctx, talk: Script): Script =>
	async (s) => {
		await sayAs(s, "ngoane", STORE_DESK.ask);
		const menu = [STORE_DESK.withdraw, STORE_DESK.talk, STORE_DESK.quit];
		const n = await s.choose(menu, { cancel: menu.length - 1 });
		const pick = menu[n];
		if (pick === STORE_DESK.withdraw) {
			await s.wait(0);
			await openStorage(ctx);
		} else if (pick === STORE_DESK.talk) await talk(s);
	};

const playQuestLines = async (
	s: Story,
	lines: readonly QuestLine[],
): Promise<void> => {
	for (const l of lines) {
		if (l.bgm !== undefined) sceneBgm(s, l.bgm);
		if (l.who === null) await s.narrate(l.text);
		else if (l.who === "kiriko") await s.kiriko(l.text, "voice", cueOf(l));
		else await s.say(l.who, l.text, cueOf(l));
	}
};

/**
 * 束音ロゼ・解音ゼロの 依頼（data/people/heroQuests.ts・engine/heroes.ts）。話しかけた ときに 進める。
 * 出す ものが あれば true（ふだんの ひとことは 出さない）。解放した あとと、まだ 依頼の ころで ない ときは false。
 */
export const heroQuestScript = async (
	s: Story,
	who: QuestHero,
	/** 仲間が 加わる 演出（ui/village/heroJoin.ts。試験では わたさない）。 */
	join?: (h: QuestHero) => Promise<void>,
): Promise<boolean> => {
	const q = HERO_QUESTS[who];
	const stage = questStage(who);
	if (stage === "unlocked") return false;
	if (stage === "done") {
		await playQuestLines(s, q.offer);
		unlockHero(who);
		// 加わる 演出（画面いっぱいの ドット絵）。窓を しまってから
		if (join) {
			await hideMsg(s);
			await join(who);
		} else s.se("join");
		await s.narrate(q.unlocked);
		// 申し出の 曲は 1周 おわるまで 余韻（ui/village/villageMusic.ts）。無音なら 村の 曲に もどす
		if (q.offer.some((l) => l.bgm !== undefined)) {
			if (!endScene()) await s.fadeBgm(300);
			s.bgm(villageSong());
		}
		return true;
	}
	if (stage === "accepted") {
		await playQuestLines(s, q.waiting);
		return true;
	}
	// 悩みを かかえて いなければ ふだんの ひとこと（帰る たびに 引く。engine/heroes.ts の rollHeroWorries）
	if (stage !== "asked") return false;
	await playQuestLines(s, q.worry);
	if ((await s.choose([...q.menu], { cancel: 1 })) !== 0) {
		await playQuestLines(s, q.decline);
		return true;
	}
	acceptQuest(who);
	await playQuestLines(s, q.accept);
	return true;
};

/** 蓄音機（まだ 何も → パン板 → 風呂板 → 電池板 の レスを 鳴らす）。そのあと 村の 曲を えらべる（ui/village/villageMusic.ts）。 */
const phonoScript =
	(ctx: Ctx): Script =>
	async (s) => {
		const p = loadProgress();
		const i = p.cleared.includes("deep")
			? 3
			: p.cleared.includes("main")
				? 2
				: p.cleared.includes("shallow")
					? 1
					: 0;
		await s.narrate(VILLAGE_MSG.phono[i]);
		await chooseRecord(ctx, s);
	};

/** 置き場所に スクリプトを付けて イベントにする（v は 描いている 村。本館の 段を 絵と 合わせる）。 */
const eventFor = (ctx: Ctx, p: VillagePlace, v: VillageView): EventDef => {
	const at = { id: p.id, x: p.x, y: p.y };
	if (p.who) {
		const who = p.who;
		return npc(
			p.id,
			p.x,
			p.y,
			CAST[who].walk,
			withBond(who, friendScript(who, ctx)),
			{
				who,
				dir: p.dir,
				wander: p.wander,
			},
		);
	}
	if (p.exit && p.trigger === "touch")
		return {
			...at,
			trigger: "touch",
			through: true,
			run: mouthScript(ctx, stepOf[p.dir ?? "down"]),
		};
	if (p.exit) return sign(p.id, p.x, p.y, exitSignScript);
	if (p.mob) {
		return npc(
			p.id,
			p.x,
			p.y,
			p.sprite ?? "",
			p.mob === "ngoane"
				? storeDesk(ctx, withBond(p.mob, mobScript(p.mob)))
				: withBond(p.mob, mobScript(p.mob)),
			{
				dir: p.dir,
				wander: p.wander,
			},
		);
	}
	if (p.id.startsWith("board_"))
		return sign(p.id, p.x, p.y, boardScript(ctx, v));
	if (p.id === "phono") return sign(p.id, p.x, p.y, phonoScript(ctx), p.sprite);
	if (p.id === "well") return sign(p.id, p.x, p.y, wellScript(ctx));
	if (p.id === "shrine")
		return sign(p.id, p.x, p.y, shut("shrine", v, false) ?? shrineScript);
	// 小屋・銭湯・倉庫・常識堂の 勝手口・喫茶の 扉（踏むと 中へ。前で A でも。ui/village/rooms.ts・ui/village/cafe.ts）
	// 音楽室「ピアノ機能」の 扉（週末だけ 中へ。ui/village/rooms.ts）
	if (p.id === "door_music")
		return {
			...at,
			trigger: "touch",
			through: true,
			run: shut("music", v) ?? enterMusic,
		};
	if (p.id === "door_bath")
		return {
			...at,
			trigger: "touch",
			through: true,
			run: shut("bath", v) ?? enterBath,
		};
	if (p.id === "door_hut")
		return { ...at, trigger: "touch", through: true, run: enterRoom("hut") };
	if (p.id === "door_store")
		return { ...at, trigger: "touch", through: true, run: enterRoom("store") };
	if (p.id === "door_shop")
		return { ...at, trigger: "touch", through: true, run: enterRoom("shop") };
	// 図書館（町は はじめから 都市の 姿なので 本屋は ない）
	if (p.id === "door_books")
		return {
			...at,
			trigger: "touch",
			through: true,
			run: shut("library", v) ?? enterRoom("library"),
		};
	// 町が 育つと 建つ 施設の 扉と 外の 物（data/village/facilities.ts・ui/village/facilities.ts）
	if (p.id.startsWith("door_f_")) {
		const f = facilityOfDoor(p.id);
		if (f)
			return {
				...at,
				trigger: "touch",
				through: true,
				run: shut(f.id, v) ?? enterFacility(f),
			};
	}
	if (p.id.startsWith("fthing_")) {
		const got = outdoorThingOf(p.id);
		const t = got?.t;
		// 屋台の 店番：見える 人（話すと こちらを 向く。台ごしに 話す）。when が あれば その 日だけ（おんJ芋煮会の 人）
		// まだ 開いて いない 店の 物は シャッターの 札だけ
		const closed = got ? shut(got.f.id, v, false) : null;
		// シャッターの 店の 店番は 出てこない（人なし）
		if (got && t?.sprite && !closed)
			return npc(
				p.id,
				p.x,
				p.y,
				t.sprite,
				closed ?? outdoorScript(ctx, got.f, t),
				{
					dir: t.dir,
					when: t.when,
				},
			);
		if (got && t)
			return sign(p.id, p.x, p.y, closed ?? outdoorScript(ctx, got.f, t));
	}
	if (p.id === "door_cafe")
		return {
			...at,
			trigger: "touch",
			through: true,
			run: shut("cafe", v) ?? enterCafe,
		};
	if (p.id.startsWith("door_hall_")) {
		const i = Number(p.id.slice("door_hall_".length));
		return {
			...at,
			trigger: "touch",
			through: true,
			run: enterHall(i, v),
		};
	}
	if (p.id.startsWith("yaji_") && p.sprite) {
		// 祭りの 野次馬（J民。名前欄は やきうの 色で「野次馬」）
		const line =
			VILLAGE_MSG.yaji[Number(p.id.slice(5)) % VILLAGE_MSG.yaji.length];
		return npc(
			p.id,
			p.x,
			p.y,
			p.sprite,
			async (s) => {
				await s.say("nanj", line, { name: "野次馬" });
			},
			{ dir: p.dir, wander: p.wander },
		);
	}
	// 村の はしの 名無したちと 機能の 墓場（data/village/folk.ts・ui/village/folk.ts）
	if (p.id.startsWith("folk_")) return folkEvent(p, v);
	// 町の 騒ぎの 人（data/town/incidents.ts）
	const inc = incidentPerson(p.id, v);
	if (inc && p.sprite)
		return npc(
			p.id,
			p.x,
			p.y,
			p.sprite,
			async (s) => {
				for (const l of inc.lines) await s.say("nanj", l, { name: inc.name });
			},
			{ dir: p.dir },
		);
	return { ...at, sprite: p.sprite, trigger: p.trigger };
};

/**
 * まだ 生き返って いない 所（data/town/revival.ts）なら シャッターの 札（扉なら 1歩 もどる）。開いて いれば null。
 */
const shut = (place: string, v: VillageView, door = true): Script | null => {
	// 騒ぎで 閉まって いる 所は その わけの 札（data/town/incidents.ts）
	const why = activeIncidents(v).find((i) => i.shut?.[place])?.shut?.[place];
	if (!why && isRevived(place, revivedBoards(v))) return null;
	// どの 板を 持ち帰れば 開くかを 貼り紙で 言う（停電の あいだは 電池板）
	const area = reviveAreaOf(place);
	const board = inBlackout(v) ? "deep" : area?.dungeon;
	const note = board
		? fill(VILLAGE_MSG.shutWhy, { board: DUNGEON_NAMES[board].short })
		: VILLAGE_MSG.shut;
	return async (s) => {
		await s.narrate(why ?? note);
		if (door) await s.move("player", "d");
	};
};

/** 騒ぎの 人（村での id から）。 */
const incidentPerson = (id: string, v: VillageView): IncidentPerson | null =>
	[...activeIncidents(v).flatMap((i) => i.people), ...activeVisitors(v)].find(
		(p) => incidentPlaceId(p) === id,
	) ?? null;

/**
 * 村の窓で あずける物を えらぶ（一覧は ui/village/home.ts。のこりを 売るかは ロゼが 村の窓で きく。
 * 「いいえ」から：押しすぎて 売ってしまわないように）。
 */
const storeChooser =
	(ctx: Ctx): StoreChooser =>
	(s, t, pend) =>
		chooseStored(ctx, t, pend, {
			prompt: "あずけるものをえらぶ",
			confirmSell: async () => {
				await sayAs(
					s,
					TOWN_MSG.sellRest.who,
					TOWN_MSG.sellRest.text,
					cueOf(TOWN_MSG.sellRest),
				);
				const yes =
					(await s.choose(["はい", "いいえ"], { cancel: 1, start: 1 })) === 0;
				await hideMsg(s);
				return yes;
			},
		});

/** 場面の ある 帰り方（持ち帰った・帰還スレ）なら その形。 */
const returnOf = (a: Arrival): ReturnArrival | null =>
	a && (a.kind === "clear" || a.kind === "escape")
		? { kind: a.kind, dungeon: a.dungeon, objective: a.objective }
		: null;

/**
 * 帰ってきたとき（村に入るたび。ui/village/villageReturn.ts）。持ち帰った・帰還スレなら 口から 出て 仲間の 語り、
 * それから 開いた知らせと 持ち帰った物の 倉庫・売り（どちらも 保存から。決める前に 閉じていても ここで 続きから）。
 */
const arrivalScript =
	(ctx: Ctx, arrival: Arrival): Script =>
	async (s) => {
		if (arrival?.kind === "replay") return;
		const back = returnOf(arrival);
		// 過去ログの底からは 井戸を のぼって 出てくる（立つのは 井戸の すぐ 下。data/village/map.ts の exitFor）
		if (back?.dungeon === "hidden") {
			s.se("stairs");
			await s.wait(200);
			s.se("stairs");
			await s.narrate(
				fill(VILLAGE_MSG.wellUp, { hero: HERO_NAME[chosenHero()] }),
			);
		}
		if (back) await returnScene(s, back);
		// たおれて もどった：蓄音機の 前で 目を さまし、仲間が 歩いてくる
		if (arrival?.kind === "dead" && previewStage() === null)
			await deathScene(s);
		// 持ち帰りの 曲（ending）のまま 入ったときも ここからは 村の曲
		s.bgm(villageSong());
		// 段の 下見（?stage=N）では 知らせも 精算も しない（保存を 書きかえない）
		if (previewStage() !== null) return;
		// 転（STORY.md §4.9）：風呂板の 語りを 見おえた その 帰りに 1回だけ。電池板が 開く 知らせ（newsScript）より 前
		if (loadProgress().endings?.includes("main") && !hasFlag("ten"))
			await tenScript(s);
		// はじめての 村：前口上と、どこへ 行けば いいか
		if (!arrival && needsOpening()) await openingScript(s);
		await newsScript(s);
		// 仲間が 悩みを かかえた（帰る たびに 引く）：ようすだけ 見せる。話しかけると 打ち明ける
		const worry = takeWorryNews();
		if (worry) await s.narrate(HERO_QUESTS[worry].hint);
		// 同行の 依頼を はたして 帰った：お礼
		await escortThanksScript(s);
		// セーブを 書きかえたのが 見つかっていれば、仲間が 気づく（engine/tamper.ts）
		await tamperScript(s);
		// 持ち帰った 板で 通りが 生き返る（data/town/revival.ts）→ 持ち帰った 物を 倉庫へ・売る
		await reviveScript(s);
		await settleScript(s, storeChooser(ctx));
		await sendBack(s);
		// たおれて もどったら ぷゆゆが ぷゆゆソードを 持たせに くる（二重に 渡さない）
		if (arrival?.kind === "dead") await reliefScript(s);
		// 持ち物が からっぽなら ぷゆゆが お弁当を 持たせに くる（いちばん 最初の 村では 広場の 場面の 最後に）
		if (!openingWalking()) await lunchScript(s);
	};

/**
 * 場面で 一部の 板の 明かりだけ 灯す ときの 決まり（ui/village/sceneSky.ts の sceneLit）。店の 並びと シャッターは
 * view の まま、窓・看板・街灯だけ boards の 板の ぶん。homes が false なら 灯るのは boards で 開く 建物の 窓だけ
 * （板に よらない 家の 窓も 消えた まま）。同じ 組は 同じ 決まりを かえす（描く 側が 窓の マスを 覚えなおさない）。
 */
const sceneLights = (
	view: VillageView,
): ((boards: readonly string[], homes: boolean) => LightRule) => {
	const memo = new Map<string, LightRule>();
	const stage = layoutStage(view);
	const dark = unlitCells(view, []);
	return (names, homes) => {
		const boards = names.filter((d): d is DungeonId =>
			DUNGEON_IDS.includes(d as DungeonId),
		);
		const key = `${boards.join()}|${homes}`;
		const hit = memo.get(key);
		if (hit) return hit;
		const off = unlitCells(view, boards);
		const unlit = new Set<number>(off);
		// 灯るのは 停電で 消えて いた うち boards で 開く 建物だけ
		if (!homes)
			for (let i = 0; i < VILLAGE_W * VILLAGE_H; i++)
				if (!dark.has(i)) unlit.add(i);
		const rule: LightRule = {
			unlit,
			lamps: lampsLit(boards),
			glow: signboardGlow(stage, boards),
		};
		memo.set(key, rule);
		return rule;
	};
};

/** 村の マップ（町の段・開いたダンジョンから）。 */
export const buildVillage = (
	v: VillageView,
	ctx: Ctx,
	opt: { arrival?: Arrival } = {},
): MapDef => {
	const arrival = opt.arrival ?? null;
	// はじめての 持ち帰りの 語りの あいだは、その 板を まだ 持ち帰って いない 村
	const back = returnOf(arrival);
	const view = back ? sceneView(v, back) : v;
	const rows = villageRows(view);
	const stage = layoutStage(view);
	const boards = revivedBoards(view);
	const blackout = inBlackout(view);
	// 電気の 来て いる 所（シャッターの 店と 停電の あいだは 電光表示が 消える）
	const powered = (place: string) => !blackout && isRevived(place, boards);
	return {
		id: "village",
		name: TOWN_NAME,
		bgm: villageSong(),
		tiles: villagePalette(view),
		rows,
		// 建物の 影（地面だけ。日の 向きで かわる。ui/village/shadows.ts）
		ground: shadowGround(view.stage, rows, villagePalette(view)),
		// 開いて いる 銭湯の 煙突から 湯気・
		// 強行開催の 日の 芋煮の 火と 湯気（ui/minigames/imoni.ts。10月の 帰りも ここで 数える）・
		// 板を 見つける 寄り道の 光る 点（ui/village/finds.ts）・
		// 開いて いる おんJ証券の 店先の 電光の 株価（ui/trade/stockBoardDecor.ts）・
		// まだ 生き返って いない 建物の すたれた 姿（ui/village/decay.ts）・建物の 看板（ui/village/signboards.ts）・
		// 線路を 不定期に 走る ぷゆゆ列車（ui/village/puyuTrain.ts）・映画館や 駅の 電光表示（ui/village/displays.ts）
		decor: joinDecor(
			isRevived("bath", boards) ? chimneySteam(rows) : undefined,
			imoniDecor(imoniArrive()),
			villageFindGlint(),
			powered("shoken")
				? stockBoardDecor(shokenSign(stage))
				: offDecor(shokenSign(stage), 4, "led"),
			decayDecor(view),
			signboardDecor(stage, boards, blackout, signRuined(view)),
			outsideDisplays(stage, powered),
		),
		outside: "#1f2a14",
		// 夜の 明かり：生き返って いない 建物は 窓も 看板も 暗い・街灯は 電池板から（data/town/revival.ts）
		lights: {
			unlit: unlitCells(view),
			lamps: lampsLit(boards),
			glow: signboardGlow(stage, boards, blackout),
			// 明かりの 坂で 通りを 1つずつ 灯す（ui/village/villageReturn.ts の playCue）
			scene: sceneLights(view),
		},
		// 街の 人通り（町の 段で ふえ、時刻で 流れが かわる。ui/village/villageCrowd.ts）
		// いちばん 最初の 村：広場に 入ったら 場面（ui/village/villageOpening.ts）
		onStep: openingStep,
		crowd: {
			// 人通りは 生き返った 通りの ぶんだけ（はじめの 寂れた 町は だれも 歩かない。停電の あいだも）
			stage: stageOfCleared(revivedBoards(view)),
			nodes: crowdNodes(view),
			cost: villagePedCost(view),
		},
		events: [
			...villagePlaces(view).map((p) => eventFor(ctx, p, view)),
			// マイクラの 豚と 夜の 匠（ui/saba/saba.ts）
			...sabaEvents(view),
			// 寄り道の 板が 開く ときの 来客（旗 visitor の あいだだけ 村に いる。ui/village/villageReturn.ts の visitScript）
			npc("visitor", 1, 1, VISITOR_WALK, async () => {}, {
				when: (st) => !!st.flags.visitor,
			}),
		],
		// 帰ってきた場面は 幕が 上がる前に 仲間を 口の前に 並べておく
		prepare: (s) => {
			if (back) lineUp(s, back, view);
			// いちばん最初は 南の 道の はしから 歩いてくる（ui/village/villageOpening.ts）
			else if (!arrival && previewStage() === null && needsOpening())
				openingPrepare(s);
		},
		onEnter: arrivalScript(ctx, arrival),
	};
};

/**
 * B／☰ の 村の メニュー。とじるまで 何度でも。
 * 村の 物や 仲間から 見られる 物（冒険の記録・図鑑・あそびかた・売り上げ・倉庫）は 出さない。
 */
export const villageMenu = async (ctx: Ctx, _s: Story): Promise<void> => {
	let start = 0;
	for (;;) {
		const items: ListItem[] = [
			{ label: "持ち物", value: "bag" },
			// これまでの あらすじ（パン板を 持ち帰る 前は はじまりの 目標。ダンジョンの メニューと 同じ：data/story/synopsis.ts）
			{ label: "あらすじ", value: "synopsis" },
			{ label: "せってい", value: "settings" },
		];
		const v = await listWindow(
			ctx,
			// 手もとの お金（売り上げが あってから。engine/wallet.ts）
			`${TOWN_NAME}${loadTown().points > 0 ? `　手もと　${yen(walletYen())}` : ""}`,
			items,
			{ start },
		);
		if (v === null) return;
		start = items.findIndex((it) => it.value === v);
		if (v === "bag") await openBag(ctx);
		else if (v === "synopsis") {
			const syn = synopsisNow();
			if (syn) await infoWindow(ctx, "あらすじ", syn);
		} else if (v === "settings") await openSettings(ctx, { wipe: true });
	}
};
