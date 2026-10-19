// 歩ける村（おんJタウン）の地図の試験（pnpm test で いっしょに動く）。
// Field（canvas を作る）は使わず、地図の文字・パレット・置き場所（data/village/map.ts）だけで調べる。
// - 形（22×18）・知らない文字が 無い・イベントが 地図の中で 1マスに 1つ・踏むイベントは 通れるマス
// - 起きる所（蓄音機の前）から、開いた口の すべてへ 歩いて行けて、人・看板・掲示板の すべてに
//   となり（か カウンター越し）から 話しかけられる（口の中には 立たずに）
// - 本編の口は 開くまで やきうが ふさぐ・もっとの口は 開くまで 板で ふさぐ
// - 町の段ごとに 建物が ふえる・売る人は 台の うしろ（囲いの中へは 入れない）・絵は 同梱の Base.png だけ
// - 仲間の ひとこと（ui/village/villageTalk.ts）：1回の 帰りに 1人 1つ 新しい話（「！」）、聞いたら 決まった ひとこと。
//   ゼロの 帳簿。村の窓で 読む 文（村の 新しい文・口と 立て札・仲間の たまり）は 全角22字・2行まで
//   （localStorage の かわりに 入れものを 置いて 試す）
// - 帰ってきたとき（ui/village/villageReturn.ts。仮の Story で 試す）：口の前に 仲間が 並んで 語り、開いた知らせ
//   （やきうが どく。見せる 前に 閉じたら また 見せる）、倉庫へ・売る（別のタブ・閉じた タブの 守り）・町が 育つ
// - おんJ 本館（data/village/hall.ts・ui/village/hallEvents.ts）：外観の 幅・扉、中の 形と 歩ける道（段ごと）、
//   扉で 入って 出たら 入った 扉の 前、保守の 当番表の 数、期間限定の 告知、飾り棚の 中身、段の 上がる 場面

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	DUNGEON_IDS,
	DUNGEONS,
	floorsLabel,
	saleRate,
} from "../core/data/dungeons";
import { MONSTERS } from "../core/data/monsters";
import { defOf } from "../core/item";
import { bigRoomLayout, enteredEmptyBigRoom } from "../core/mapgen";
import { priceOf, STORAGE_CAP, TOWN_STAGES } from "../core/town";
import {
	CAT_ORDER,
	type DungeonId,
	type Item,
	type Monster,
} from "../core/types";
import { bgm } from "../data/audio/bgm";
import { SE_LOUDNESS } from "../data/audio/loudness";
import {
	jukeboxTracks,
	plainMml,
	records,
	songArt,
	songBpm,
	stageBgm,
} from "../data/audio/music";
import { sfx } from "../data/audio/sfx";
import {
	CAFE_DRINKS,
	CAFE_GREET,
	CAFE_TALKS,
	CHAT_MSG,
	GLASS_CHOICES,
	MASTER_MSG,
	NANASHI_CAFE,
	SEAT_MSG,
	TREAT_REACTIONS,
	TREAT_SIPS,
	TREAT_TALKS,
} from "../data/cafe/cafe";
import { CAFE_MOBS } from "../data/cafe/cafeMobs";
import {
	BB_FX,
	BB_POSE,
	BB_SHEET,
	BB_SPR,
} from "../data/minigames/baseballSheet";
import { BATTING } from "../data/minigames/batting";
import {
	guideKeys,
	PIANO_DONE,
	PIANO_GUIDES,
	PIANO_MENU,
} from "../data/minigames/piano";
import { MOB_VOICE, VOICE_MODELS } from "../data/people/cast";
import { BOOKS_GUESTS, MUSIC_GUESTS, STAGE_LINES } from "../data/people/guests";
import { HERO_QUESTS } from "../data/people/heroQuests";
import { MOB_GAGS } from "../data/people/mobGags";
import {
	awayMobs,
	MOB_BACK,
	MOB_IDS,
	MOB_STAY,
	MOBS,
	type MobCtx,
	type MobId,
	type MobLine,
	OUT_RATE,
	PUYU_LUNCH,
	PUYU_RELIEF,
	RELIEF_NOTE,
	SENKYO,
	setIntroSeen,
	squareOut,
	ZERO_UNITS,
} from "../data/people/mobs";
import {
	SHIYO_MAID_AT,
	SHIYO_MAID_LINES,
	SHIYO_MAID_MILK,
	shiyoAtMaid,
} from "../data/people/shiyoShift";
import { GLOSSARY } from "../data/story/glossary";
import { BATH_EVE, KINOKO_EVE } from "../data/story/hooks";
import { type LiveState, liveResLine } from "../data/story/liveRes";
import {
	advanceEvents,
	bossName,
	EVENTS,
	eventById,
	eventNewsText,
	eventText,
	goalText,
	objectiveFor,
} from "../data/story/objectives";
import { headlineIn } from "../data/story/pictures";
import {
	type KirikoMode,
	pickQuote,
	type Quote,
	type QuoteContext,
	SPEAKERS,
	type Speaker,
} from "../data/story/quotes";
import { ROOM_SKITS, roomSkitLine } from "../data/story/roomSkits";
import { ARRIVALS } from "../data/story/arrivals";
import { SKITS } from "../data/story/skits";
import {
	awayFriends,
	BOARD_LOOKS,
	BOSS_HOME,
	BOSS_RETURN,
	CLEAR,
	DEPART,
	DUNGEON_NAMES,
	endingFor,
	episodeEnd,
	FIRST_SHALLOW,
	SHALLOW_DEATH,
	STORY,
	type StoryPage,
	TEN_NEWS,
	UNLOCK_LINES,
	UNLOCK_VISIT,
	zankiLine,
} from "../data/story/story";
import {
	DIVE_RES,
	diveResAt,
	diveResLine,
	firstGoalHtml,
	GOAL_WHY,
	goalWhy,
	synopsisHtml,
} from "../data/story/synopsis";
import {
	BANDAI,
	BATH_GATE,
	BATH_MEN,
	BATH_SOAK,
	BATH_WOMEN,
	BATH_YEN,
} from "../data/town/bath";
import { SEASONS, season } from "../data/town/calendar";
import { EAT_MENUS, TAB_CAP } from "../data/town/eateries";
import {
	DRINK_BAR,
	DRINK_BAR_YEN,
	FISHING,
	GROUND_BAT,
	PAY_SHORT,
	VEND_YEN,
	VENDING,
} from "../data/town/facilities";
import { TOWN_FINDS } from "../data/town/finds";
import {
	HALL_MSG,
	IN_STORE_TEXT,
	JIKKYO,
	ON_PHONO_TEXT,
	TOBAN_MENU,
	YAKYU_SHELF,
} from "../data/town/hall";
import {
	AFTER_HEADLINES,
	BOARD_NEWS,
	DEATH_LINES,
	DEATH_TIERS,
	deathLine,
} from "../data/town/headlines";
import {
	activeIncidents,
	activeVisitors,
	INCIDENTS,
	incidentPlaceId,
	VISITORS,
} from "../data/town/incidents";
import {
	inBlackout,
	isRevived,
	lampsLit,
	MAIN_BOARDS,
	REVIVE_AREAS,
	revivedBoards,
	stageOfCleared,
} from "../data/town/revival";
import {
	BANK,
	BANK_FROM,
	MUSIC_CLOSED,
	PIANO_MSG,
	ROOM_DOOR,
	ROOM_DOOR_SE,
	ROOM_MSG,
} from "../data/town/rooms";
import { DAILY_STOCK, stockFor } from "../data/town/stock";
import { SURFACES, surfaceOf } from "../data/town/surface";
import {
	TAMPER_LEDGER,
	TAMPER_MOB,
	TAMPER_NARRATION,
	TAMPER_SCENE,
	TAMPER_TALK,
} from "../data/town/tamper";
import {
	BAND_IDLE,
	ESCAPE_QUOTES,
	OPENING,
	RETURN_PAGES,
	REVIVE_MSG,
	STORE_DESK,
	type StaffLine,
	TITLE_TOWN_QUOTES,
	TOWN_MSG,
	VILLAGE_IDLE,
	VILLAGE_MSG,
	WAKE_PAGES,
	ZERO_VOICELESS,
} from "../data/town/town";
import { crowdNodes } from "../data/village/crowd";
import { lightOf } from "../data/village/daylight";
import { DINER_IMG, DINER_SIZE } from "../data/village/dinerSheet";
import {
	doorId,
	FACILITIES,
	facilitiesAt,
	facilityById,
	facilityDoor,
	facilityEntry,
	facilityMats,
	facilityOfMap,
	facilityOutside,
	facilityRoomPalette,
	facilityRoomPlaces,
	facilityRoomRows,
	facilityTiles,
	outdoorId,
	outdoorThingOf,
} from "../data/village/facilities";
import {
	HALL_NAMES,
	hallEntry,
	hallMats,
	hallOutside,
	hallPalette,
	hallPlaces,
	hallRows,
	hallTierOf,
	IN_STORE,
	NANASHI_WALK,
	ON_PHONO,
	shelfSlots,
} from "../data/village/hall";
import {
	asideSpot,
	CAFE_FROM,
	coreShadows,
	exitFor,
	lineupSpots,
	roamCells,
	spotsAround,
	unlitCells,
	VILLAGE_EXITS,
	VILLAGE_H,
	VILLAGE_SPOTS,
	VILLAGE_W,
	type VillageView,
	villagePalette,
	villagePlaces,
	villageRows,
} from "../data/village/map";
import { gaitMoves, gaitRange, mobRoam } from "../data/village/mobGait";
import {
	canPlace,
	cellLayers,
	cellTile,
	FURNITURE,
	FURNITURE_PRICE,
	type FurnitureId,
	goalFurniture,
	HOME_GIFTS,
	HOME_MAX,
	HOME_MSG,
	homeRows,
	JUKEBOX_MSG,
	layoutOk,
	MOVE_IN_GIFT,
	NOT_SOLD,
	type Placed,
	placeInFront,
	RESIDENT_GIFTS,
} from "../data/village/myhome";
import {
	GACHA_PRICE,
	OTAKU_GACHA,
	OTAKU_GOODS,
	OTAKU_MSG,
} from "../data/village/otaku";
import {
	CROWD_MUTTERS,
	CROWD_PAIRS,
	MOB_MUTTERS,
} from "../data/village/overhear";
import {
	BATH_NOREN_M,
	BATH_SPOTS,
	BATH_WALL,
	BOOKS_BROWSE,
	CAFE_ALL_SEATS,
	CAFE_MASTER,
	CAFE_ORDER,
	CAFE_PATRON_SPOTS,
	CAFE_SLOTS,
	MUSIC_SEATS,
	onCafeCounter,
	ROOM_FROM,
	ROOM_IDS,
	ROOM_OUTSIDE,
	type RoomId,
	roomEntry,
	roomMats,
	roomPalette,
	roomPlaces,
	roomRows,
} from "../data/village/rooms";
import {
	FOOD_IMG,
	FOOD_SIZE,
	RPGEN_CELLS,
	RPGEN_IMG,
	RPGEN_SIZE,
} from "../data/village/rpgenArt";
import { STAFF_GAGS, type StaffGagLine } from "../data/village/staffGags";
import { layRoomTatami, layTatami } from "../data/village/tatami";
import { CITY, hallTier } from "../data/village/tiles";
import type { SayOptions, Story, TileDef, VState } from "../engine/defs";
import { Actor, Field } from "../engine/field";
import {
	type Cell,
	FOLLOW_CUT,
	findRoute,
	hopRoute,
	LONG_WALK,
	mayWarp,
	type Open,
	type Seen,
	WALK_TAIL,
	type WalkStep,
	walkRoute,
} from "../engine/longWalk";
import {
	addRecord,
	forgetProgressMemo,
	giveRelief,
	hasFlag,
	loadProgress,
	loadRecords,
	loadReplays,
	loadTown,
	noteRunEnd,
	type PendingReturn,
	type Progress,
	type ProgressNews,
	QUIT_CAUSE,
	RELIEF_KIND,
	type RunRecord,
	replayMatches,
	type SavedReplay,
	saveProgress,
	saveTown,
	sortStorage,
	stashRelief,
	stockToStorage,
	type Town,
	takeRelief,
	toReplay,
} from "../engine/save";
import { isPicture } from "../engine/sceneCard";
import { isWalkRef } from "../engine/sprite";
import { DIR_VEC, type Dir } from "../engine/types";
import { forgetWalletMemo, walletYen, yen } from "../engine/wallet";
import { itemIcon } from "../ui/art/icons";
import { floorsText } from "../ui/bookView";
import type { Ctx } from "../ui/ctx";
import { floorShort } from "../ui/dungeon/floorName";
import { forgetRoomSkits, takeRoomSkit } from "../ui/dungeon/roomSkit";
import { bathLayout } from "../ui/minigames/bath";
import {
	applyOutcome,
	type BallKind,
	ballAt,
	battedBall,
	type Call,
	contactOf,
	DERBY_WIN,
	fieldCam,
	inZone,
	LAG_MS,
	outcomeOf,
	PITCHER_DEFS,
	type Pitch,
	type PitcherDef,
	type PitchKind,
	pickPitch,
	proj,
	TOUCH_LAG_MS,
	takeOutcome,
	timingOf,
	toField,
	walkDir,
} from "../ui/minigames/batting";
import { dishLabel, forgetTabMemo, loadTab } from "../ui/minigames/eat";
import { sharedHead } from "../ui/share";
import {
	buildCafe,
	cafeLayout,
	cafeTalks,
	forgetCafeMemo,
	hasCafeNews,
	mixScene,
	talksWith,
} from "../ui/village/cafe";
import { buildFacility, outdoorScript } from "../ui/village/facilities";
import { townFind } from "../ui/village/finds";
import { descWindows } from "../ui/village/glossary";
import { BATH_GUESTS, booksRoom, guestsOf } from "../ui/village/guests";
import {
	buildHall,
	canWriteHoshu,
	enterHall,
	forgetHallMemo,
	hoshuCount,
	leaveHall,
	noticeScript,
	noticeTexts,
	shelfLine,
	shelfRows,
	tobanScript,
	trophies,
} from "../ui/village/hallEvents";
import {
	enterHome,
	forgetHomeMemo,
	loadHome,
	saveHome,
} from "../ui/village/myhome";
import { spinGacha } from "../ui/village/otaku";
import { Overhear } from "../ui/village/overhear";
import { bossHomeLine, endLine, recordHead } from "../ui/village/records";
import {
	enterBath,
	enterMusic,
	enterRoom,
	isWeekend,
	leaveRoom,
	planLines,
	thingLines,
} from "../ui/village/rooms";
import { CHALK_LINE } from "../ui/village/sceneChalk";
import { skitSky } from "../ui/village/sceneSky";
import {
	deathSkit,
	forgetSkits,
	nearSkit,
	playNearSkit,
	skitAfterEvent,
} from "../ui/village/skits";
import { forgetStaffGags } from "../ui/village/staffGags";
import { buildSurface, buildVillage } from "../ui/village/villageEvents";
import {
	forgetMobMemo,
	hasMobNews,
	idleOf,
	mobScript,
	mobsOutNow,
	reactionOf,
	senkyoOpen,
	senkyoScript,
	tipDice,
} from "../ui/village/villageMobs";
import { villageSong } from "../ui/village/villageMusic";
import {
	forgetOpeningMemo,
	needsOpening,
	openingNotYet,
	openingPrepare,
	openingScript,
	openingStep,
	openingWalking,
} from "../ui/village/villageOpening";
import {
	deathScene,
	forgetReveal,
	gather,
	holdReveal,
	lineUp,
	lunchScript,
	newsScript,
	pagesFor,
	type ReturnArrival,
	releaseReveal,
	reliefScript,
	returnScene,
	type StoreChooser,
	sceneView,
	sendBack,
	settleScript,
	TALK_NEAR,
	tenScript,
	villageView,
} from "../ui/village/villageReturn";
import {
	DUNGEON_DESC,
	fill,
	forgetHeardMemo,
	hasNews,
	ledgerLine,
	talkLine,
} from "../ui/village/villageTalk";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

const CASES: { name: string; run: () => void | Promise<void> }[] = [];
const test = (name: string, run: () => void | Promise<void>) =>
	CASES.push({ name, run });

/** 開き方の 組み合わせ（ちょっと だけ・本編まで・もっとまで）× 町の段。 */
const VIEWS: VillageView[] = [];
for (let stage = 0; stage < TOWN_STAGES; stage++)
	for (const unlocked of [
		["shallow"],
		["shallow", "main"],
		["shallow", "main", "deep"],
	] as DungeonId[][])
		VIEWS.push({
			stage,
			unlocked,
			cleared: unlocked.slice(0, -1),
		});

const label = (v: VillageView) => `stage ${v.stage} [${v.unlocked.join(",")}]`;

/** 地図に 置く 物（村の 置き場所・本館の 中の 置き場所に 共通の ところ）。 */
type Place = {
	id: string;
	x: number;
	y: number;
	trigger: "talk" | "touch";
	sprite?: string;
};

/** 村の 地図を 引く道具（起きる所から）。 */
const survey = (v: VillageView) =>
	surveyMap(
		villageRows(v),
		villagePalette(v),
		villagePlaces(v),
		VILLAGE_SPOTS.boot,
	);

/** 地図を 引く道具（通れるか・人が いるか・start から 歩いて行けるか）。 */
const surveyMap = <P extends Place>(
	lines: readonly string[],
	tiles: Record<string, TileDef>,
	places: readonly P[],
	start: readonly [number, number],
) => {
	const rows = lines.map((r) => [...r]);
	const tile = (x: number, y: number): TileDef | undefined =>
		rows[y]?.[x] === undefined ? undefined : tiles[rows[y][x]];
	/** 見た目の ある イベント（人・置物）は 通れない。見えない イベントは 通れる。 */
	const occupied = (x: number, y: number) =>
		places.some((p) => p.sprite && p.x === x && p.y === y);
	const canEnter = (x: number, y: number) =>
		!!tile(x, y)?.passable && !occupied(x, y);
	const [bx, by] = start;
	// 起きる所から 歩いて行ける マス（幅優先）
	const reach = new Set<string>();
	const key = (x: number, y: number) => `${x},${y}`;
	if (canEnter(bx, by)) {
		const queue: [number, number][] = [[bx, by]];
		reach.add(key(bx, by));
		while (queue.length) {
			const [x, y] = queue.shift() as [number, number];
			for (const [dx, dy] of [
				[0, -1],
				[1, 0],
				[0, 1],
				[-1, 0],
			]) {
				const nx = x + dx;
				const ny = y + dy;
				if (reach.has(key(nx, ny)) || !canEnter(nx, ny)) continue;
				reach.add(key(nx, ny));
				queue.push([nx, ny]);
			}
		}
	}
	const reachable = (x: number, y: number) => reach.has(key(x, y));
	/** 話しかけに 立てる マス（歩いて行けて、踏むと もぐる 口では ない。ui/village/village.ts の walkTo と同じ）。 */
	const standable = (x: number, y: number) =>
		reachable(x, y) &&
		!places.some((p) => p.trigger === "touch" && p.x === x && p.y === y);
	/**
	 * となり（か カウンター越し）の 立てる マスから 話しかけられるか。
	 * noBack なら 北どなり（掲示板などの 裏）からは 数えない（ui/village/village.ts の talkFront と同じ）。
	 */
	const talkable = (p: Place, noBack = false) =>
		[
			[0, -1],
			[1, 0],
			[0, 1],
			[-1, 0],
		].some(([dx, dy]) => {
			// (p.x - dx, p.y - dy) に 立って (dx, dy) の向きを 向く
			const cx = p.x - dx;
			const cy = p.y - dy;
			if (tile(cx, cy)?.counter) return standable(cx - dx, cy - dy);
			if (noBack && dx === 0 && dy === 1) return false;
			return standable(cx, cy);
		});
	return { rows, tiles, places, tile, canEnter, reachable, talkable };
};

test("the village map is 22 × 18 for every town stage and unlock set", () => {
	for (const v of VIEWS) {
		const rows = villageRows(v);
		ok(rows.length === VILLAGE_H, `${label(v)}: ${rows.length} rows`);
		rows.forEach((r, y) => {
			ok(
				[...r].length === VILLAGE_W,
				`${label(v)}: row ${y} is ${[...r].length} wide`,
			);
		});
	}
});

test("every character on the village map has a tile", () => {
	for (const v of VIEWS) {
		const tiles = villagePalette(v);
		villageRows(v).forEach((r, y) => {
			[...r].forEach((ch, x) => {
				ok(tiles[ch], `${label(v)}: "${ch}" at (${x},${y}) has no tile`);
			});
		});
	}
});

test("village events are inside the map, one per cell, and touch events stand on floor", () => {
	for (const v of VIEWS) {
		const { places, tile } = survey(v);
		const seen = new Map<string, string>();
		for (const p of places) {
			ok(
				p.x >= 0 && p.y >= 0 && p.x < VILLAGE_W && p.y < VILLAGE_H,
				`${label(v)}: ${p.id} is outside (${p.x},${p.y})`,
			);
			const k = `${p.x},${p.y}`;
			ok(
				!seen.has(k),
				`${label(v)}: ${p.id} and ${seen.get(k)} share (${p.x},${p.y})`,
			);
			seen.set(k, p.id);
			if (p.trigger === "touch")
				ok(
					tile(p.x, p.y)?.passable,
					`${label(v)}: touch event ${p.id} is on a wall`,
				);
			// 人・置物は 床の上に 立つ（うろうろ する人も 歩ける所から）
			if (p.sprite)
				ok(
					tile(p.x, p.y)?.passable,
					`${label(v)}: ${p.id} stands on a wall at (${p.x},${p.y})`,
				);
		}
		const ids = places.map((p) => p.id);
		ok(new Set(ids).size === ids.length, `${label(v)}: duplicate event ids`);
	}
});

test("from the boot spot, Kiriko can walk to the exit and talk to everyone", () => {
	for (const v of VIEWS) {
		const s = survey(v);
		const [bx, by] = VILLAGE_SPOTS.boot;
		ok(s.canEnter(bx, by), `${label(v)}: the boot spot is blocked`);
		const [mx, my] = VILLAGE_SPOTS.exit;
		ok(s.reachable(mx, my), `${label(v)}: cannot walk to the exit`);
		// 帰ってきたとき 出口（桟橋の 先）から 1歩 町の 側へ 出られる
		ok(s.canEnter(mx, my - 1), `${label(v)}: cannot step out of the exit`);
		for (const p of s.places)
			if (p.trigger === "talk")
				ok(s.talkable(p), `${label(v)}: cannot talk to ${p.id}`);
	}
});

/** 掲示板・立て札など 背の高い 物か（engine/field.ts の Field.hasBack を 地図の データで 呼ぶ）。 */
const hasBack = (s: ReturnType<typeof survey>, p: Place): boolean => {
	const tileAt = (x: number, y: number) =>
		s.tile(x, y) ?? { layers: [], color: "#000", passable: false };
	const sprite = p.sprite ?? "";
	return Field.prototype.hasBack.call(
		{ tileAt } as unknown as Field,
		{
			x: p.x,
			y: p.y,
			sprite,
			still: !isWalkRef(sprite),
		} as Actor,
	);
};

test("tall things (boards, signs) cannot be read from behind, and each can be read from the front", () => {
	let tall = 0;
	for (const v of VIEWS) {
		const s = survey(v);
		for (const p of s.places) {
			if (p.trigger !== "talk") continue;
			const back = hasBack(s, p);
			// 人は 裏から でも 話せる
			if (p.who || p.mob) ok(!back, `${label(v)}: ${p.id} has a back`);
			if (!back) continue;
			tall++;
			ok(
				s.talkable(p, true),
				`${label(v)}: ${p.id} can be read only from behind`,
			);
		}
	}
	ok(tall > 0, "no tall thing in the village has a back");
});

test("the village has one exit, at the end of the pier (and one sign); nobody guards it", () => {
	for (const v of VIEWS) {
		const s = survey(v);
		const exits = s.places.filter((p) => p.trigger === "touch" && p.exit);
		ok(exits.length === 1, `${label(v)}: ${exits.length} exits`);
		ok(
			VILLAGE_EXITS.length === 1 && VILLAGE_EXITS[0].side === "s",
			"the exit is not the pier",
		);
		for (const e of VILLAGE_EXITS) {
			const [x, y] = e.cell;
			ok(
				x === 0 || y === 0 || x === VILLAGE_W - 1 || y === VILLAGE_H - 1,
				`${label(v)}: the ${e.side} exit is not at the edge`,
			);
			ok(s.reachable(x, y), `${label(v)}: cannot walk to the ${e.side} exit`);
		}
		ok(
			s.places.filter((p) => p.exit && p.trigger === "talk").length === 1,
			`${label(v)}: not one exit sign`,
		);
		const [nx, ny] = VILLAGE_SPOTS.nanj(v);
		const [mx, my] = VILLAGE_SPOTS.exit;
		ok(!(nx === mx && ny === my + 1), `${label(v)}: やきう blocks the exit`);
	}
});

test("each town stage builds on the last, with the same art as the town strip", () => {
	const sets: DungeonId[][] = [
		["shallow"],
		["shallow", "main"],
		["shallow", "main", "deep"],
	];
	for (const unlocked of sets) {
		const view = (stage: number): VillageView => ({
			stage,
			unlocked,
			cleared: [],
		});
		for (let stage = 1; stage < TOWN_STAGES; stage++)
			ok(
				villageRows(view(stage)).join("\n") !==
					villageRows(view(stage - 1)).join("\n"),
				`stage ${stage} [${unlocked.join(",")}] looks the same as stage ${stage - 1}`,
			);
		// 広場の 井戸（5段から）は 話しかけられる（過去ログの底へ 降りる 口）
		for (let stage = 0; stage < TOWN_STAGES; stage++) {
			const [wx, wy] = VILLAGE_SPOTS.well;
			const has = villagePlaces(view(stage)).some((p) => p.id === "well");
			ok(
				has === stage >= 5 &&
					(stage < 5 || villageRows(view(stage))[wy][wx] === "U"),
				`stage ${stage}: the well place is wrong`,
			);
		}
		// 道は 土 → 5段から 石だたみ → 6段（住宅街）から アスファルト
		const dirt = villagePalette(view(0))["."]?.layers.join();
		const stone = villagePalette(view(5))["."]?.layers.join();
		const asphalt = villagePalette(view(7))["."]?.layers.join();
		ok(
			new Set([dirt, stone, asphalt]).size === 3,
			"dirt, stone and asphalt roads are not all different",
		);
		for (let stage = 0; stage < TOWN_STAGES; stage++) {
			const road = villagePalette(view(stage))["."]?.layers.join();
			const want = stage >= 6 ? asphalt : stage >= 5 ? stone : dirt;
			ok(road === want, `stage ${stage}: the road is the wrong kind`);
		}
	}
	// 段の 外の 数（古い保存・下見）は 丸める
	for (const stage of [-3, 99, Number.NaN]) {
		const rows = villageRows({ stage, unlocked: ["shallow"], cleared: [] });
		ok(rows.length === VILLAGE_H, `stage ${stage}: ${rows.length} rows`);
	}
});

test("町の 中心（段6〜7）：住宅街は 路側帯・電柱・マンホール、都市は 歩道・レンガ・横断歩道・擁壁。段5までは かわらない", () => {
	const city = new Set(Object.keys(CITY));
	const view = (stage: number): VillageView => ({
		stage,
		unlocked: ["shallow", "main", "deep"],
		cleared: ["shallow", "main"],
	});
	const at = (rows: readonly string[], x: number, y: number) => [...rows[y]][x];
	// 段5 までは 町の 中心の 字も 影も ない
	for (const v of VIEWS) {
		if (v.stage > 5) continue;
		for (const ch of villageRows(v).join(""))
			ok(!city.has(ch), `${label(v)}: city tile "${ch}" before stage 6`);
		ok(!coreShadows(v.stage).length, `${label(v)}: core shadows`);
	}
	// 住宅街：崖下の 道・町の 通りに 路側帯（交わる 所は そのまま）、本館への 道は 2車線、生け垣
	const r6 = villageRows(view(6));
	const lined = (x: number, y: number, open: readonly number[]) => {
		const ch = at(r6, x, y);
		return open.includes(x) ? ch === "." : ch === "ゑ" || ch === "ヴ";
	};
	for (let x = 10; x <= 29; x++)
		ok(lined(x, 11, [19, 20, 27]), `stage 6: (${x},11) is ${at(r6, x, 11)}`);
	for (let x = 1; x <= 39; x++)
		ok(lined(x, 19, [19, 20]), `stage 6: (${x},19) is ${at(r6, x, 19)}`);
	for (let y = 12; y <= 18; y++)
		ok(
			at(r6, 19, y) === "る" && at(r6, 20, y) === "れ",
			`stage 6: the hall road at y=${y} is not 2 lanes`,
		);
	ok(r6[24].includes("マ"), "stage 6: no trimmed hedge south of the plaza");
	// 都市：横断歩道と 点字ブロック・へりに 森の 木や 雑草が 残らない・池は 柵で 囲う・崖と 広場の 絵が かわる
	const r7 = villageRows(view(7));
	for (const [x, y] of [
		[19, 11],
		[20, 11],
		[27, 11],
		[19, 19],
		[20, 19],
	])
		ok(at(r7, x, y) === "わ", `stage 7: no crosswalk at (${x},${y})`);
	for (const [x, y] of [
		[19, 12],
		[20, 12],
		[19, 18],
		[20, 18],
		[19, 20],
		[20, 20],
	])
		ok(at(r7, x, y) === "ぴ", `stage 7: no tactile paving at (${x},${y})`);
	for (let y = 11; y <= 24; y++)
		for (let x = 9; x <= 30; x++)
			ok(
				!"HhbT^%v;".includes(at(r7, x, y)),
				`stage 7: village "${at(r7, x, y)}" left at (${x},${y})`,
			);
	for (let y = 25; y <= 29; y++)
		for (let x = 0; x < VILLAGE_W; x++) {
			if (at(r7, x, y) !== "~") continue;
			for (const [dx, dy] of [
				[0, -1],
				[1, 0],
				[0, 1],
				[-1, 0],
			])
				ok(
					"~ヤユヨロメモ".includes(at(r7, x + dx, y + dy)),
					`stage 7: the pond at (${x},${y}) is not fenced`,
				);
		}
	const p6 = villagePalette(view(6));
	const p7 = villagePalette(view(7));
	for (const ch of ["2", ":"])
		ok(
			p6[ch]?.layers.join() !== p7[ch]?.layers.join(),
			`stage 7: "${ch}" looks the same as stage 6`,
		);
	// 抜け道（東の 広場の すみ・神社・図書館と 碁会所・出口の 立て札を 調べる 所）は ふさがない
	for (const stage of [6, 7]) {
		const rows = villageRows(view(stage));
		const tiles = villagePalette(view(stage));
		for (const [x, y] of [
			[27, 12],
			[24, 12],
			[17, 11],
			[30, 20],
			[7, 15],
			[7, 16],
			[7, 17],
			[7, 18],
			[6, 22],
			[6, 23],
			[4, 23],
			[16, 17],
			[25, 17],
			[26, 20],
			[29, 20],
			[9, 19],
			[19, 11],
			[20, 11],
		])
			ok(
				tiles[at(rows, x, y)]?.passable,
				`stage ${stage}: (${x},${y}) is blocked`,
			);
	}
});

test("the village is drawn only from the bundled Base.png and sprites (no CDN tiles)", () => {
	for (const v of VIEWS) {
		const tiles = villagePalette(v);
		for (const ch of new Set(villageRows(v).join(""))) {
			const t = tiles[ch];
			for (const ref of [...(t?.layers ?? []), ...(t?.above ?? [])])
				ok(ref.startsWith("pub:"), `${label(v)}: "${ch}" draws ${ref}`);
		}
	}
});

test("板を ぜんぶ 持ち帰った おんJタウンには ライバル 4人・やきう・住人が みんな いる（店の 仕事は しない）", () => {
	const FRIENDS = ["roze", "shiyo", "zero", "feris", "nanj"] as const;
	const places = villagePlaces({
		stage: TOWN_STAGES - 1,
		unlocked: [...DUNGEON_IDS],
		cleared: [...DUNGEON_IDS],
	});
	for (const w of FRIENDS)
		ok(
			// シヨは 週末の 夜は メイド喫茶（村の 時計しだい）
			w === "shiyo" || places.some((p) => p.who === w),
			`${w} is missing`,
		);
	for (const id of MOB_IDS)
		ok(
			places.some((p) => p.id === `mob_${id}`),
			`${id} is not there`,
		);
	// 店の 人は ライバルが いた 台の うしろ・倉庫の 窓口・掲示板の そば
	ok(
		MOBS.jtleman.spot.join() === "13,17" &&
			MOBS.ngoane.spot.join() === "27,17" &&
			MOBS.hinary.spot.join() === "17,21",
		"the staff are not at the counters",
	);
});

test("まだ 帰ってきて いない 仲間は 帰りの 語り・知らせに 出てこない（話さない・名前も 出ない）", async () => {
	// 持ち帰る 順の 一例（前の 板ほど 先）。その 板で 帰ってくる 仲間は 同じ 船で 着くので 語りに 出てよい
	const order: DungeonId[] = [
		"shallow",
		"kinoko",
		"tropical",
		"main",
		"konamono",
		"festival",
		"deep",
	];
	for (let n = 0; n <= order.length; n++)
		for (const d of DUNGEON_IDS)
			for (const kind of ["clear", "escape"] as const)
				await withStorageAsync(async () => {
					const before = order.slice(0, n).filter((x) => x !== d);
					const cleared = kind === "clear" ? [...before, d] : before;
					setProgress([...before, d], [], cleared);
					putTown({ stage: stageOfCleared(cleared) });
					const away = awayFriends(cleared);
					const names = away.map((w) => SPEAKERS[w].name);
					for (const p of pagesFor({ kind, dungeon: d, objective: "boss" })) {
						ok(
							!(p.who && away.includes(p.who)),
							`${before.join("+")} ${d} ${kind}: ${p.who} speaks before coming back`,
						);
						ok(
							!names.some((w) => p.text.includes(w)),
							`${before.join("+")} ${d} ${kind}: "${p.text}" names someone not back yet`,
						);
					}
				});
});

test("みんな 飽きて 出ていった 町：はじめは やきう・ぷゆゆ・原住民 だけ。板を 持ち帰ると 帰ってくる", () => {
	const view = (cleared: DungeonId[], arriving?: DungeonId): VillageView => ({
		stage: TOWN_STAGES - 1,
		unlocked: ["shallow"],
		cleared,
		...(arriving ? { arriving: [arriving] } : {}),
	});
	const people = (v: VillageView) =>
		villagePlaces(v)
			.filter((p) => p.who || p.mob || p.id.startsWith("folk_"))
			.map((p) => p.who ?? p.mob ?? p.id)
			.sort();
	ok(
		JSON.stringify(people(view([]))) ===
			JSON.stringify(["nanj", "puyu", "shobon"]),
		`at the start: ${people(view([]))}`,
	);
	ok(
		hallPlaces(view([])).every((p) => !p.sprite),
		"the hall has people before パン板",
	);
	const pan = people(view(["shallow"]));
	for (const w of ["roze", "zero", "proto", "ren", "ngoane", "jtleman"])
		ok(pan.includes(w), `${w} is not back after パン板`);
	for (const w of ["shiyo", "feris", "rino"])
		ok(!pan.includes(w), `${w} is back too early`);
	ok(
		hallPlaces(view(["shallow"])).some((p) => !!p.sprite),
		"the hall stays empty after パン板",
	);
	// はじめての 持ち帰りの 語り（cleared には まだ 無い）でも、同じ 船の 仲間は 立つ
	const arriving = people(view([], "shallow"));
	ok(
		arriving.includes("roze") && !arriving.includes("ngoane"),
		`arriving: ${arriving}`,
	);
	ok(
		people(view(["shallow", "kinoko"])).includes("shiyo"),
		"shiyo is not back after きのこ板",
	);
	for (const d of ["tropical", "deep"] as const)
		ok(
			people(view(["shallow", "kinoko", d])).includes("feris"),
			`feris is not back after ${d}`,
		);
	ok(awayMobs(DUNGEON_IDS).length === 0, "someone never comes back");
	ok(awayFriends(DUNGEON_IDS).length === 0, "a rival never comes back");
});

test("ぷゆゆの お弁当：キリコの となりまで かけてきて ひとこと、持たせて、そのまま そばに いる（持ち物が あれば 来ない）", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow"]);
		putTown({ stage: 1 });
		const { s, log } = fakeStory();
		await lunchScript(s);
		const [bx, by] = VILLAGE_SPOTS.boot;
		const come = log.find((l) => l.startsWith("goto mob_puyu "));
		const [x, y] = (come ?? "").split(" ")[2]?.split(",").map(Number) ?? [];
		ok(
			!!come && Math.max(Math.abs(x - bx), Math.abs(y - by)) === 1,
			`ぷゆゆ does not come next to Kiriko: ${come}`,
		);
		ok(
			PUYU_LUNCH.some((t) => log.includes(`say nanj: ${t}`)) &&
				inOrder(log, [come ?? "", `narrate: ${DEPART.puyu}`]) &&
				log.filter((l) => l.startsWith("goto mob_puyu ")).length === 1,
			`lunch scene:\n${log.join("\n")}`,
		);
		ok(loadTown().lunch, "no lunch given");
		// もう 持っている：来ない
		const again = fakeStory();
		await lunchScript(again.s);
		ok(!again.log.length, `came twice: ${again.log.join(" / ")}`);
	});
});

test("ぷゆゆソード：たおれて 帰ると ときどき ぷゆゆが 持たせる（外れた たおれで 引きなおさない・同じ たおれで 二度・持って 出る 前・倉庫に ある ときは 渡さない。やめた 冒険では 渡さない）", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow"]);
		putTown({ stage: 1 });
		const died = (at: number, cause = "寝落ち民にたおされた") =>
			addRecord({
				at,
				kind: "dead",
				cause,
				depth: 2,
				maxDepth: 2,
				lv: 1,
				turn: 10,
				kills: 0,
				returning: false,
				seed: `relief-${at}`,
				dungeon: "shallow",
			});
		died(1000);
		const first = fakeStory();
		await reliefScript(first.s, 0);
		ok(
			PUYU_RELIEF.some((t) => first.log.includes(`say nanj: ${t}`)) &&
				first.log.includes(`narrate: ${RELIEF_NOTE}`),
			`relief scene:\n${first.log.join("\n")}`,
		);
		ok(
			loadTown().relief === true && loadTown().reliefAt === 1000,
			"not pending",
		);
		// 同じ たおれ：もう 来ない
		const again = fakeStory();
		await reliefScript(again.s, 0);
		ok(!again.log.length, `came twice: ${again.log.join(" / ")}`);
		// 持って 出る 前に また たおれても（別の タブ など）ふえない
		ok(!giveRelief(2000, 0), "a second sword while one is pending");
		// 持って 出る（1回だけ）
		ok(takeRelief() && !takeRelief(), "taken twice");
		ok(loadTown().relief === undefined, "still pending after taking");
		// 次の たおれで また もらえる。倉庫に ある ときは もらえない
		ok(giveRelief(3000, 0) && takeRelief(), "no sword for a new fall");
		// 外れ：その たおれでは もらえず、帰りなおしても 引きなおさない
		ok(!giveRelief(3500, 0.99) && !loadTown().relief, "a sword on a miss");
		ok(!giveRelief(3500, 0), "rerolled the same fall");
		const t = loadTown();
		t.storage.push({
			uid: 1,
			kind: RELIEF_KIND,
			plus: -3,
			cursed: false,
			charges: 0,
			known: true,
			count: 1,
		});
		saveTown(t);
		ok(!giveRelief(4000, 0), "a sword while one is in the storehouse");
		// やめた 冒険では 渡さない
		saveTown({ ...loadTown(), storage: [] });
		died(5000, QUIT_CAUSE);
		const quit = fakeStory();
		await reliefScript(quit.s, 0);
		ok(!quit.log.length && !loadTown().relief, "a sword for quitting");
	});
});

test("ぷゆゆソード：村の 持ち物に 出て、機材倉庫に あずけられる（あずけると 次の 支給は ない）", () => {
	withStorage(() => {
		setProgress(["shallow"]);
		putTown({ stage: 0 });
		ok(giveRelief(100, 0), "harness: no sword");
		// 機材倉庫は はじめから ある
		ok(stashRelief(), "could not stash the sword");
		const t = loadTown();
		ok(
			t.relief === undefined &&
				t.storage.length === 1 &&
				t.storage[0]?.kind === RELIEF_KIND &&
				t.storage[0]?.known,
			`storage ${JSON.stringify(t.storage)}`,
		);
		ok(!stashRelief(), "stashed twice");
		ok(!takeRelief(), "took a stashed sword");
		ok(!giveRelief(200, 0), "a second sword while one is in the storehouse");
	});
});

test("倉庫の 整理：持ち物の 整理と 同じ 分類の 順・同じ 物は 強い 順に 並べなおし、2回目は かわらない", () => {
	withStorage(() => {
		setProgress(["shallow"]);
		const it = (uid: number, kind: string, plus = 0): Item => ({
			uid,
			kind,
			plus,
			cursed: false,
			charges: 0,
			known: true,
			count: 1,
		});
		putTown({
			stage: 4,
			storage: [
				it(1, "f_bread"),
				it(2, "h_heal"),
				it(3, "copper", 1),
				it(4, "bronze"),
				it(5, "copper", 3),
			],
		});
		ok(sortStorage(), "nothing moved");
		const kinds = loadTown().storage.map((x) => `${x.kind}${x.plus}`);
		const cat = (k: string) => CAT_ORDER.indexOf(defOf(k).cat);
		const got = loadTown().storage;
		ok(
			got.every((x, i) => i === 0 || cat(got[i - 1].kind) <= cat(x.kind)),
			`not by category: ${kinds}`,
		);
		const swords = got.filter((x) => x.kind === "copper").map((x) => x.plus);
		ok(swords.join() === "3,1", `swords ${swords}`);
		ok(!sortStorage(), "sorted twice");
	});
});

/** 場面の 道（ui/village/village.ts の routeTo と 同じ 幅優先。上・右・下・左の 順に 地形だけを 見て、キリコの マスは よける）。 */
const sceneRoute = (
	v: VillageView,
	from: Cell,
	to: Cell,
	kiriko: Cell,
): Dir[] | null => {
	const rows = villageRows(v).map((r) => [...r]);
	const tiles = villagePalette(v);
	const open = (x: number, y: number): boolean =>
		!(x === kiriko[0] && y === kiriko[1]) &&
		!!tiles[rows[y]?.[x] ?? ""]?.passable;
	const key = (x: number, y: number) => `${x},${y}`;
	const prev = new Map<string, { k: string; d: Dir } | null>([
		[key(from[0], from[1]), null],
	]);
	const queue: Cell[] = [from];
	for (let head = 0; head < queue.length; head++) {
		const [x, y] = queue[head];
		if (x === to[0] && y === to[1]) {
			const route: Dir[] = [];
			for (let cur = prev.get(key(x, y)); cur; cur = prev.get(cur.k))
				route.push(cur.d);
			return route.reverse();
		}
		for (const d of ["up", "right", "down", "left"] as Dir[]) {
			const nx = x + DIR_VEC[d].dx;
			const ny = y + DIR_VEC[d].dy;
			if (prev.has(key(nx, ny)) || !open(nx, ny)) continue;
			prev.set(key(nx, ny), { k: key(x, y), d });
			queue.push([nx, ny]);
		}
	}
	return null;
};

/** スマホくらいの 画面（よこ 11・たて 22 マス。地図の はしで 止まる）に 映る マス（はしの 外 2マスまで）。 */
const phoneView = ([cx, cy]: Cell): NonNullable<Seen> => {
	const [w, h] = [11, 22];
	const x0 = Math.max(0, Math.min(VILLAGE_W - w, cx - Math.floor(w / 2)));
	const y0 = Math.max(0, Math.min(VILLAGE_H - h, cy - Math.floor(h / 2)));
	return (x, y) =>
		x >= x0 - 2 && x < x0 + w + 2 && y >= y0 - 2 && y < y0 + h + 2;
};

/** 右へ n 歩の 道。 */
const straight = (n: number): Dir[] => Array.from({ length: n }, () => "right");

/** walkRoute を 記録だけで 走らせる（place・cut・step・hop を 1行ずつ。いる マスも 追う）。 */
const recordWalk = async (
	from: Cell,
	route: readonly WalkStep[],
	o: {
		warp: boolean;
		seen: Seen;
		follow?: boolean;
		mayCut?: boolean;
		free?: (x: number, y: number) => boolean;
	},
): Promise<{ log: string[]; at: Cell }> => {
	const log: string[] = [];
	let at: Cell = from;
	await walkRoute(from, route, {
		warp: o.warp,
		follow: () => !!o.follow,
		mayCut: () => o.mayCut ?? true,
		seen: () => o.seen,
		free: o.free ?? (() => true),
		place: (c) => {
			log.push(`place ${c.join(",")}`);
			at = c;
		},
		cut: async (c) => {
			log.push(`cut ${c.join(",")}`);
			at = c;
		},
		step: async (d) => {
			log.push(`step ${d}`);
			at = [at[0] + DIR_VEC[d].dx, at[1] + DIR_VEC[d].dy];
		},
		hop: async (c) => {
			log.push(`hop ${c.join(",")}`);
			at = c;
		},
	});
	return { log, at };
};

const onlySteps = (log: readonly string[], n: number): boolean =>
	log.length === n && log.every((l) => l.startsWith("step "));

test("場面の 歩きを とばさない とき：近い 道・キリコ・noWarp・映っている 人。出ていく 人は 映らなく なってから 行き先へ。カメラが ついていく 人は 長い 道だけ 暗転", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow"]);
		putTown({ stage: 1 });
		// 蓄音機の 前なら ぷゆゆの 持ち場から 近い：ふつうに 歩いてくる
		const at = VILLAGE_SPOTS.boot;
		const { s, walks } = fakeStory();
		await lunchScript(s);
		const come = walks.find((w) => w.target === "mob_puyu");
		const route =
			come && sceneRoute(villageView(), MOBS.puyu.spot, [come.x, come.y], at);
		ok(
			!!route && !mayWarp("mob_puyu", route.length),
			`ぷゆゆ's walk to the phonograph is long: ${route?.length}`,
		);
		if (!route) return;
		const near = await recordWalk(MOBS.puyu.spot, route, {
			warp: mayWarp("mob_puyu", route.length),
			seen: phoneView(at),
		});
		ok(onlySteps(near.log, route.length), `near:\n${near.log.join("\n")}`);
	});
	// 何歩から とばすか・とばさない 人
	ok(
		!mayWarp("mob_puyu", LONG_WALK) && mayWarp("mob_puyu", LONG_WALK + 1),
		`the threshold is not ${LONG_WALK} steps`,
	);
	ok(!mayWarp("player", 100), "Kiriko's own walk may be shortened");
	ok(!mayWarp("mob_puyu", 100, { noWarp: true }), "noWarp is ignored");
	const far = straight(40);
	ok(
		onlySteps(
			(
				await recordWalk([0, 0], far, {
					warp: mayWarp("player", 40),
					seen: (x) => x >= 25,
					follow: true,
				})
			).log,
			40,
		),
		"Kiriko is moved",
	);
	// 映っている 人は 消さない
	const shown = await recordWalk([0, 0], far, { warp: true, seen: () => true });
	ok(onlySteps(shown.log, 40), `a visible walker vanished:\n${shown.log}`);
	// 出ていく 人（来客が 口へ 帰る）：映らなく なったら そのまま 行き先へ
	const away = await recordWalk([0, 0], far, {
		warp: true,
		seen: (x) => x <= 5,
	});
	ok(
		onlySteps(away.log.slice(0, 6), 6) &&
			away.log[6] === "place 40,0" &&
			away.log.length === 7,
		`walking away:\n${away.log.join("\n")}`,
	);
	// 入ってくる 人：画面の はしの すぐ 外へ 置いて 歩く（空いて いなければ 1つ 手前）
	const enter = await recordWalk([0, 0], far, {
		warp: true,
		seen: (x) => x >= 25,
	});
	ok(
		enter.log[0] === "place 24,0" && onlySteps(enter.log.slice(1), 16),
		`walking in:\n${enter.log.join("\n")}`,
	);
	const blocked = await recordWalk([0, 0], far, {
		warp: true,
		seen: (x) => x >= 25,
		free: (x) => x !== 24,
	});
	ok(
		blocked.log[0] === "place 23,0" && onlySteps(blocked.log.slice(1), 17),
		`walking in past someone standing:\n${blocked.log.join("\n")}`,
	);
	// カメラが ついていく 人：長い 道だけ 暗転で 行き先の WALK_TAIL 歩 手前へ。窓が キー待ちなら 歩く
	const cut = await recordWalk([0, 0], far, {
		warp: true,
		seen: () => true,
		follow: true,
	});
	ok(
		cut.log[0] === `cut ${40 - WALK_TAIL},0` &&
			onlySteps(cut.log.slice(1), WALK_TAIL),
		`follow cut:\n${cut.log.join("\n")}`,
	);
	const short = await recordWalk([0, 0], straight(FOLLOW_CUT), {
		warp: true,
		seen: () => true,
		follow: true,
	});
	ok(onlySteps(short.log, FOLLOW_CUT), `short follow:\n${short.log}`);
	const waiting = await recordWalk([0, 0], far, {
		warp: true,
		seen: () => true,
		follow: true,
		mayCut: false,
	});
	ok(onlySteps(waiting.log, 40), `cut over a waiting window:\n${waiting.log}`);
});

/** 開き方 ごとの 村の 通れる マス（villageRows は 重いので 1度だけ 引く）。 */
const passMemo = new Map<VillageView, (x: number, y: number) => boolean>();

/** 場面の 人が 道に して よい マス（ui/village/village.ts の openFor と 同じ：地形だけ。キリコの マスは よける）。 */
const sceneOpen = (v: VillageView, kiriko: Cell): Open => {
	let pass = passMemo.get(v);
	if (!pass) {
		const rows = villageRows(v).map((r) => [...r]);
		const tiles = villagePalette(v);
		pass = (x, y) => !!tiles[rows[y]?.[x] ?? ""]?.passable;
		passMemo.set(v, pass);
	}
	const p = pass;
	return (x, y) => !(x === kiriko[0] && y === kiriko[1]) && p(x, y);
};

/** 道を たどる（着く マス・とびこえた すきまの 歩数・open で ない マスを 踏んだか）。 */
const traceRoute = (from: Cell, route: readonly WalkStep[], open: Open) => {
	let at: Cell = from;
	const gaps: number[] = [];
	let stray = false;
	for (const st of route) {
		const to: Cell =
			typeof st === "string"
				? [at[0] + DIR_VEC[st].dx, at[1] + DIR_VEC[st].dy]
				: st;
		if (typeof st !== "string")
			gaps.push(Math.abs(to[0] - at[0]) + Math.abs(to[1] - at[1]));
		if (!open(to[0], to[1])) stray = true;
		at = to;
	}
	return { at, gaps, stray };
};

/** 口から 1歩 村へ 入った マス（その 口から 帰った キリコが 立つ）。 */
const inwardOf = (e: (typeof VILLAGE_EXITS)[number]): Cell => [
	e.cell[0] + DIR_VEC[e.inward].dx,
	e.cell[1] + DIR_VEC[e.inward].dy,
];

/** 段 ごとに 開き方 1つ（場面の 道を 総当たりで 引く 試験は 重いので）。 */
const STAGE_VIEWS = VIEWS.filter((v) => v.unlocked.length === 2);

test("場面の 道が ない とき：歩ける ところまで 歩いて、いちばん せまい すきまを とびこえる（engine/longWalk.ts の hopRoute）", async () => {
	// 壁の 列で 分かれた 5×3：壁の 手前まで 歩き、壁を とびこえて、残りを 歩く
	const wall: Open = (x) => x !== 2;
	ok(!findRoute(5, 3, wall, [0, 1], [4, 1]), "a route through the wall");
	const hop = hopRoute(5, 3, wall, [0, 1], [4, 1]);
	ok(
		JSON.stringify(hop) === JSON.stringify(["right", [3, 1], "right"]),
		`hop over the wall: ${JSON.stringify(hop)}`,
	);
	// 行き先に 入れなければ（壁・地図の 外）何もしない。歩いて 行ければ とびこえない
	ok(
		!hopRoute(5, 3, wall, [0, 1], [2, 1]) &&
			!hopRoute(5, 3, wall, [0, 1], [5, 1]),
		"a hop onto the wall or off the map",
	);
	ok(
		JSON.stringify(hopRoute(5, 3, () => true, [0, 1], [2, 1])) ===
			JSON.stringify(["right", "right"]),
		"a hop where it can walk",
	);
	// 歩く 人は とびこえる ところも 1つの 歩みとして たどる
	const walk = await recordWalk([0, 1], hop ?? [], { warp: false, seen: null });
	ok(
		walk.log.join(" / ") === "step right / hop 3,1 / step right" &&
			walk.at.join(",") === "4,1",
		`walk with a hop:\n${walk.log.join("\n")}`,
	);
	// 長い 道で 映っていなければ、とびこえる ところも 置きなおしで とばす
	const unseen = await recordWalk(
		[0, 1],
		[...straight(LONG_WALK), [LONG_WALK + 2, 1], ...straight(4)],
		{ warp: true, seen: () => false },
	);
	ok(
		unseen.log.join(" / ") === `place ${LONG_WALK + 6},1`,
		`an unseen hop:\n${unseen.log.join("\n")}`,
	);
	// 村の 道は 前の routeTo と 同じ 幅優先（東の 口の キリコへ ぷゆゆ）
	const v = STAGE_VIEWS[1];
	const east = VILLAGE_EXITS.find((e) => e.side === "e");
	if (east) {
		const ki = inwardOf(east);
		const [to] = spotsAround(v, 1, ki);
		ok(
			!!to &&
				JSON.stringify(
					findRoute(VILLAGE_W, VILLAGE_H, sceneOpen(v, ki), MOBS.puyu.spot, to),
				) === JSON.stringify(sceneRoute(v, MOBS.puyu.spot, to, ki)),
			"findRoute walks another way than the scene route",
		);
	}
});

test("場面で 人を 呼ぶ：だれが どこから 来ても、キリコの となりの 通れる マスへ 着く（道が なければ すきまを 1つ とびこえる）", () => {
	for (const v of STAGE_VIEWS) {
		const people = villagePlaces(v)
			.filter((p) => p.sprite && isWalkRef(p.sprite))
			.map((p): Cell => [p.x, p.y]);
		const froms: Cell[] = [...people, ...VILLAGE_EXITS.map((e) => e.cell)];
		for (const ki of [VILLAGE_SPOTS.boot, ...VILLAGE_EXITS.map(inwardOf)]) {
			const open = sceneOpen(v, ki);
			for (const d of ["up", "right", "down", "left"] as const) {
				const to: Cell = [ki[0] + DIR_VEC[d].dx, ki[1] + DIR_VEC[d].dy];
				if (!open(to[0], to[1])) continue;
				for (const from of froms) {
					const route =
						findRoute(VILLAGE_W, VILLAGE_H, open, from, to) ??
						hopRoute(VILLAGE_W, VILLAGE_H, open, from, to);
					const t = route && traceRoute(from, route, open);
					ok(
						!!t &&
							t.at[0] === to[0] &&
							t.at[1] === to[1] &&
							!t.stray &&
							t.gaps.length <= 1,
						`${label(v)}: from ${from} to ${to} beside Kiriko at ${ki}: ${JSON.stringify(route)}`,
					);
				}
			}
		}
	}
});

test("村の 場面で 人を 呼ぶ マスは 広場から 歩いて 来られる（店の 台の うしろ・キリコの 先の 行き止まりには 呼ばない）", () => {
	const [bx, by] = VILLAGE_SPOTS.boot;
	for (const v of STAGE_VIEWS) {
		const [hx, hy] = VILLAGE_SPOTS.hallDoors[0];
		const centers: Cell[] = [
			VILLAGE_SPOTS.boot,
			...VILLAGE_EXITS.map(inwardOf),
			[hx, hy + 1],
		];
		for (const c of centers) {
			const open = sceneOpen(v, c);
			const hub: Cell = c[0] === bx && c[1] === by ? [bx + 1, by] : [bx, by];
			const spots = spotsAround(v, 8, c);
			ok(spots.length, `${label(v)}: no spot around ${c}`);
			for (const s of spots)
				ok(
					!!findRoute(VILLAGE_W, VILLAGE_H, open, hub, s),
					`${label(v)}: around ${c} the spot ${s} cannot be walked to`,
				);
		}
	}
});

test("口から 人が 歩いてくる 前に キリコが どく マス：口からの 道を ふさがず、来る 人は とびこえずに キリコの となりまで 歩く", () => {
	for (const v of STAGE_VIEWS)
		for (const e of VILLAGE_EXITS) {
			const ki = inwardOf(e);
			const aside = asideSpot(v, ki, e.cell);
			ok(
				!!aside,
				`${label(v)}: Kiriko cannot step aside at the ${e.side} exit`,
			);
			if (!aside) continue;
			// キリコが 歩いて どける（キリコは ほかの人を すりぬけない が、口の 前には だれも いない）
			ok(
				Math.max(Math.abs(aside[0] - ki[0]), Math.abs(aside[1] - ki[1])) <= 1 &&
					!!findRoute(VILLAGE_W, VILLAGE_H, sceneOpen(v, [-1, -1]), ki, aside),
				`${label(v)}: ${e.side} exit, Kiriko steps from ${ki} to ${aside}`,
			);
			const [to] = spotsAround(v, 1, aside);
			ok(
				!!to &&
					!!findRoute(VILLAGE_W, VILLAGE_H, sceneOpen(v, aside), e.cell, to),
				`${label(v)}: ${e.side} exit, the newcomer cannot walk from the gate to ${to} beside Kiriko at ${aside}`,
			);
		}
});

test("寄り道の 板が 開く：その 板の 名無しが 口から 来て キリコの となりで 話し、口へ 帰る。そのあと「もぐれるようになった」", async () => {
	await withStorageAsync(async () => {
		setProgress(
			["shallow", "main", "kinoko"],
			[{ dungeon: "kinoko", reason: "clear" }],
			["shallow"],
		);
		putTown({ stage: 2 });
		const { s, log } = fakeStory();
		await newsScript(s);
		const lines = UNLOCK_VISIT.kinoko ?? [];
		const gate = exitFor("kinoko").cell.join(",");
		ok(
			inOrder(log, [
				// show で 生まれさせてから 口に 置く（旗だけでは 場面の 中で 生まれない）
				"show visitor",
				`place visitor ${gate}`,
				"look visitor",
				...lines
					.slice(0, -1)
					.map((l) => (l.who ? `say nanj: ${l.text}` : `narrate: ${l.text}`)),
				`goto visitor ${gate}`,
				`narrate: ${lines[lines.length - 1]?.text}`,
				"narrate: 「きのこ板」に\nもぐれるようになった",
			]),
			`visit:\n${log.join("\n")}`,
		);
		ok(!s.flag("visitor"), "the visitor stays in the village");
		ok(!loadProgress().news.length, "the news was not cleared");
	});
});

test("口から 人が 歩いてくる 場面：キリコが その 口の 前に いれば 先に どく（来客。とびこえて 来ない）。はなれて いれば 動かない", async () => {
	await withStorageAsync(async () => {
		// 寄り道の 板の 来客（きのこ板の 口から）
		const visit = async (at?: Cell) => {
			setProgress(
				["shallow", "main", "kinoko"],
				[{ dungeon: "kinoko", reason: "clear" }],
				["shallow"],
			);
			putTown({ stage: 2 });
			const f = fakeStory(at ? { at } : {});
			await newsScript(f.s);
			return f.log;
		};
		const e = exitFor("kinoko");
		const ki = inwardOf(e);
		const near = await visit(ki);
		const aside = asideSpot(villageView(), ki, e.cell);
		const step = near.indexOf(`goto player ${aside?.join(",")}`);
		ok(
			!!aside &&
				step >= 0 &&
				step < near.indexOf(`place visitor ${e.cell.join(",")}`),
			`Kiriko does not step aside before the visitor:\n${near.join("\n")}`,
		);
		const far = await visit();
		ok(
			!far.some((l) => l.startsWith("goto player ")),
			`Kiriko steps aside far from the mouth:\n${far.join("\n")}`,
		);
	});
});

test("場面で 置いた 人の マスに 重ならない：口の 前に 並んだ・呼んだ 仲間の マスへ キリコも 口から 来る 人も 立たない", async () => {
	await withStorageAsync(async () => {
		const all = [...DUNGEON_IDS];
		const progress = (cleared: DungeonId[], endings: DungeonId[]) =>
			localStorage.setItem(
				PROGRESS_KEY,
				JSON.stringify({
					unlocked: all,
					cleared,
					fails: {},
					intro: all,
					news: [],
					endings,
				}),
			);
		const clashes: string[] = [];
		// どの 板の 帰りでも（はじめての 持ち帰り・帰還スレ。語りの 中で 口から 来る 住人も）
		for (const d of all)
			for (const stage of [1, 2, 4, 7])
				for (const kind of ["clear", "escape"] as const) {
					progress(
						all.filter((x) => x !== d),
						[],
					);
					putTown({ stage });
					const a: ReturnArrival = { kind, dungeon: d };
					const f = fakeStory({ at: exitFor(d).cell });
					lineUp(f.s, a, sceneView(villageView(), a));
					await returnScene(f.s, a);
					clashes.push(
						...f.clashes.map((c) => `${d} ${kind} stage ${stage}: ${c}`),
					);
				}
		// 来客の 前に 知らせを 話す 仲間を 呼んだ ときも（本編の 知らせ → きのこ板の 来客。キリコは きのこ板の 口の 前）
		const e = exitFor("kinoko");
		setProgress(
			["shallow", "main", "kinoko"],
			[
				{ dungeon: "main", reason: "clear" },
				{ dungeon: "kinoko", reason: "clear" },
			],
			["shallow"],
		);
		putTown({ stage: 2 });
		const both = fakeStory({ at: inwardOf(e) });
		await newsScript(both.s);
		ok(
			both.log.some((l) => l.startsWith("place nanj ")) &&
				both.log.some((l) => l.startsWith("goto player ")) &&
				both.log.some((l) => l.startsWith("goto visitor ")),
			`no friends gathered before the visitor:\n${both.log.join("\n")}`,
		);
		clashes.push(...both.clashes.map((c) => `news main+kinoko: ${c}`));
		// 来客だけの 知らせでは 仲間を 呼ばない（名無しは 1人で 来て キリコとだけ 話す）
		setProgress(
			["shallow", "main", "kinoko"],
			[{ dungeon: "kinoko", reason: "clear" }],
			["shallow"],
		);
		const lone = fakeStory({ at: inwardOf(e) });
		await newsScript(lone.s);
		ok(
			!lone.log.some((l) => /^place (nanj|zero|shiyo|roze|feris) /.test(l)),
			`friends are gathered for the visitor's news:\n${lone.log.join("\n")}`,
		);
		clashes.push(...lone.clashes.map((c) => `news kinoko: ${c}`));
		ok(!clashes.length, `two people on one cell:\n${clashes.join("\n")}`);
	});
});

// ───────────────── 仲間の ひとこと（保存は 入れものに） ─────────────────

/**
 * localStorage を 覚えるだけの入れものに かえる（write が false なら 書けない）。もどす 手を 返す。
 */
const swapStorage = (write: boolean): (() => void) => {
	const mem = new Map<string, string>();
	const store = {
		getItem: (k: string) => mem.get(k) ?? null,
		setItem: (k: string, v: string) => {
			if (!write) throw new Error("QuotaExceededError");
			mem.set(k, String(v));
		},
		removeItem: (k: string) => void mem.delete(k),
		clear: () => mem.clear(),
		key: (i: number) => [...mem.keys()][i] ?? null,
		get length() {
			return mem.size;
		},
	};
	const prev = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		value: store,
		configurable: true,
		writable: true,
	});
	forgetProgressMemo();
	forgetHeardMemo();
	forgetMobMemo();
	forgetSkits();
	forgetOpeningMemo();
	forgetHallMemo();
	forgetWalletMemo();
	forgetReveal();
	return () => {
		if (prev) Object.defineProperty(globalThis, "localStorage", prev);
		else delete (globalThis as { localStorage?: unknown }).localStorage;
		forgetProgressMemo();
		forgetHeardMemo();
		forgetMobMemo();
		forgetSkits();
		forgetOpeningMemo();
		forgetHallMemo();
		forgetReveal();
		forgetWalletMemo();
	};
};

/** 試験のあいだだけ localStorage を 入れものに かえる。 */
const withStorage = (fn: () => void, write = true): void => {
	const restore = swapStorage(write);
	try {
		fn();
	} finally {
		restore();
	}
};

/** withStorage の 待つ版（村の 場面の スクリプト）。 */
const withStorageAsync = async (fn: () => Promise<void>): Promise<void> => {
	const restore = swapStorage(true);
	try {
		await fn();
	} finally {
		restore();
	}
};

/** 試験の あいだだけ location.search を かえる（開発用の 下見 ?stage=・?event=）。もどす 手を 返す。 */
const swapLocation = (search: string): (() => void) => {
	const prev = Object.getOwnPropertyDescriptor(globalThis, "location");
	Object.defineProperty(globalThis, "location", {
		value: { search },
		configurable: true,
		writable: true,
	});
	return () => {
		if (prev) Object.defineProperty(globalThis, "location", prev);
		else delete (globalThis as { location?: unknown }).location;
	};
};

const FRIENDS = Object.keys(SPEAKERS) as Speaker[];

/** 冒険の記録を 1つ 足す（新しい順の 先頭）。 */
const pushRecord = (r: Partial<RunRecord>): void => {
	const key = "kiriko-roguelike/records";
	const list = JSON.parse(localStorage.getItem(key) ?? "[]") as RunRecord[];
	const rec: RunRecord = {
		at: 1000 + list.length,
		kind: "dead",
		cause: "おなかがすいてたおれた",
		depth: 3,
		maxDepth: 3,
		lv: 2,
		turn: 100,
		kills: 1,
		returning: false,
		seed: `test-${list.length}`,
		dungeon: "main",
		...r,
	};
	localStorage.setItem(key, JSON.stringify([rec, ...list]));
};

/** 町（段と 売り上げ）を 置く。 */
const setTown = (stage: number, points: number): void =>
	localStorage.setItem(
		"kiriko-roguelike/town",
		JSON.stringify({ points, stage, storage: [], pending: null, returned: [] }),
	);

test("今日の入荷: one food item per return, same item on the same return, into the storehouse once", () => {
	// 食べものだけ（倉庫の 道具は 正体つきなので、薬草などは 売らない）
	ok(
		DAILY_STOCK.every((e) => defOf(e.kind).cat === "food"),
		"stock that is not food",
	);
	ok(
		stockFor(7).kind === stockFor(7).kind,
		"the stock changes on the same return",
	);
	ok(
		new Set(Array.from({ length: 30 }, (_, i) => stockFor(i).kind)).size > 1,
		"the stock never changes",
	);
	withStorage(() => {
		setTown(3, 0);
		ok(stockToStorage("f_bread", 5) === "ok", "could not buy");
		ok(
			loadTown().storage.some((it) => it.kind === "f_bread" && it.known),
			"not in the storehouse",
		);
		ok(stockToStorage("f_bread", 5) === "sold", "bought twice on one return");
		ok(
			stockToStorage("f_bread", 6) === "ok",
			"could not buy on the next return",
		);
		// 倉庫が いっぱいなら 買えない
		const t = loadTown();
		t.storage = Array.from({ length: STORAGE_CAP[t.stage] ?? 0 }, () => ({
			...t.storage[0],
		}));
		saveTown(t);
		ok(
			stockToStorage("f_bread", 7) === "full",
			"bought into a full storehouse",
		);
	});
});

test("時間帯の ひとこと：昼の ほかは いつもの ひとことと 交互。どれも 村の 窓に 収まる", () => {
	withStorage(() => {
		setTown(0, 0);
		for (const who of FRIENDS) talkLine(who); // 新しい話を 聞いておく
		const restore = swapLocation("?debug&hour=21");
		try {
			for (const who of FRIENDS) {
				const lines = [talkLine(who), talkLine(who), talkLine(who)];
				const night = BAND_IDLE[who].night;
				ok(
					!!night && lines.filter((l) => l === night).length >= 1,
					`${who} never says the night line: ${lines.join(" / ")}`,
				);
				ok(
					lines.some((l) => l !== night),
					`${who} only says the night line`,
				);
			}
		} finally {
			restore();
		}
		fitsWindow(
			Object.entries(BAND_IDLE).flatMap(([who, m]) =>
				Object.values(m).map((t): [string, string] => [
					`BAND_IDLE.${who}`,
					t ?? "",
				]),
			),
		);
	});
	// 時間帯つきの 台詞は その 時間帯だけ（ナイターは 夜だけ）
	const nights = [...Array(200).keys()]
		.map((i) => pickQuote(null, i, "nanj", [], [], "day")?.text ?? "")
		.concat(
			[...Array(200).keys()].map(
				(i) =>
					pickQuote(
						{
							kind: "dead",
							depth: 1,
							cause: "x",
							runs: 1,
							clears: 0,
							ratio: 0.1,
						},
						i,
						"nanj",
						[],
						[],
						"day",
					)?.text ?? "",
			),
		);
	ok(!nights.some((t) => t.includes("ナイター")), "ナイター in the daytime");
});

test("each friend has one new line per return (「！」), then a short fixed line", () => {
	withStorage(() => {
		// 時間帯の ひとことが まざらない 昼に（村の 時計で かわらない ように）
		const restoreLoc = swapLocation("?debug&hour=12");
		setTown(0, 0);
		// まだ 一度も もぐっていない：みんなに 新しい話
		for (const who of FRIENDS)
			ok(hasNews(who), `${who} has nothing new at first`);
		const first = new Map<Speaker, string>();
		for (const who of FRIENDS) {
			first.set(who, talkLine(who));
			ok(!hasNews(who), `${who} still shows 「！」 after talking`);
		}
		// 2回目からは 決まった ひとこと（その段の 町の様子、無ければ 役目の ひとこと）
		for (const who of FRIENDS) {
			const again = talkLine(who);
			const town = TITLE_TOWN_QUOTES[0].find((q) => q.who === who)?.text;
			ok(
				again === (town ?? VILLAGE_IDLE[who]),
				`${who} says "${again}" instead of the fixed line`,
			);
			ok(talkLine(who) === again, `${who} changes the fixed line`);
		}
		// 見張りの やきうは 見張りの ひとこと
		ok(
			talkLine("nanj", { gate: true }) === VILLAGE_IDLE.gate,
			"the gatekeeper does not guard",
		);
		// 帰ってきたら（記録が ふえたら）また 1つずつ
		pushRecord({ kind: "dead", dungeon: "main", depth: 15 });
		for (const who of FRIENDS)
			ok(hasNews(who), `${who} has nothing new after a return`);
		for (const who of FRIENDS) {
			const line = talkLine(who);
			ok(
				line !== VILLAGE_IDLE[who] && line !== first.get(who),
				`${who} did not react to the new return: "${line}"`,
			);
		}
		for (const who of FRIENDS) ok(!hasNews(who), `${who} has two new lines`);
		// シヨは ライバル：店が 開いても 倉庫番の ひとことは 言わない（倉庫は ンゴ姉）
		setTown(4, 3000);
		const shiyo = TITLE_TOWN_QUOTES[
			stageOfCleared(loadProgress().cleared)
		].find((q) => q.who === "shiyo")?.text;
		ok(
			talkLine("shiyo") === (shiyo ?? VILLAGE_IDLE.shiyo),
			"シヨ keeps the storehouse",
		);
		// 聞いたことは ページを 開きなおしても 覚えている
		forgetHeardMemo();
		for (const who of FRIENDS)
			ok(!hasNews(who), `${who} forgot after a reload`);
		restoreLoc();
	});
	// 保存できなくても この回は 覚えている
	withStorage(() => {
		for (const who of FRIENDS) talkLine(who);
		for (const who of FRIENDS)
			ok(!hasNews(who), `${who} repeats without storage`);
	}, false);
});

test("the friends react to how the last run ended", () => {
	withStorage(() => {
		setTown(1, 100);
		const lines = (r: Partial<RunRecord>) => {
			pushRecord(r);
			return FRIENDS.map((who) => talkLine(who));
		};
		const escaped = lines({ kind: "escape" });
		const clear = lines({ kind: "clear", dungeon: "shallow", depth: 1 });
		ok(
			escaped.join() !== clear.join(),
			"an escape and a clear get the same lines",
		);
		// どの 死因・深さでも、だれもが 何か 新しく 言う（その人の 分が 無い たまりは 深さへ）
		for (const cause of [
			"ワイ バーンにたおされた",
			"ぷゆゆにたおされた",
			"とうすこにたおされた",
			"かまってちゃんにたおされた",
		])
			for (const depth of [2, 9, 18]) {
				pushRecord({ kind: "dead", cause, depth });
				for (const who of FRIENDS)
					ok(hasNews(who), `${who} is silent after "${cause}" at B${depth}`);
			}
	});
});

test("ヒナリーの 帳簿: 生き返った 通りの 数と 残り", () => {
	withStorage(() => {
		setTown(0, 0);
		ok(ledgerLine() === VILLAGE_MSG.ledgerNone, "no street revived");
		setProgress([], [], ["shallow", "kinoko"]);
		ok(
			ledgerLine() === fill(VILLAGE_MSG.ledger, { n: 2, left: 8 }),
			`two streets: ${ledgerLine()}`,
		);
		setProgress(
			[],
			[],
			[
				"shallow",
				"kinoko",
				"main",
				"deep",
				"tropical",
				"konamono",
				"festival",
				"vocalo",
				"inferno",
				"hidden",
			],
		);
		ok(ledgerLine() === VILLAGE_MSG.ledgerMax, `all: ${ledgerLine()}`);
	});
});

/** 全角=1・半角=0.5 で 数えた 幅。 */
const width = (line: string): number =>
	[...line].reduce((w, ch) => w + (/[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);

type Shown = { text: string; kiriko?: KirikoMode };
/** 窓に 出る 文（キリコの 独白は （　）で かこまれる。ui/village/village.ts の sayKiriko）。 */
const shown = (l: Shown): string =>
	l.kiriko === "think" ? `（${l.text}）` : l.text;

/** 村の窓（スマホで 全角22字）に 2行まで で 収まるか。 */
const fitsWindow = (texts: readonly [string, string][]): void => {
	for (const [where, t] of texts) {
		const lines = t.split("\n");
		ok(lines.length <= 2, `${where}: ${lines.length} lines`);
		for (const l of lines)
			ok(width(l) <= 22, `${where}: "${l}" is ${width(l)} wide`);
	}
};

test("畳: 横・縦の 1畳と 半畳で 敷き、4枚の 角は 1点に 集まらない（部屋の 畳も）", () => {
	const check = (where: string, laid: (string | null)[][]) => {
		const id: number[][] = laid.map((r) => r.map(() => 0));
		let n = 0;
		laid.forEach((r, y) => {
			r.forEach((p, x) => {
				if (!p) return;
				if (p === "hl") {
					ok(laid[y][x + 1] === "hr", `${where}: hl at ${x},${y} has no hr`);
					n++;
					id[y][x] = n;
					id[y][x + 1] = n;
				} else if (p === "vt") {
					ok(laid[y + 1]?.[x] === "vb", `${where}: vt at ${x},${y} has no vb`);
					n++;
					id[y][x] = n;
					id[y + 1][x] = n;
				} else if (p === "half") id[y][x] = ++n;
				else ok(id[y][x] > 0, `${where}: ${p} at ${x},${y} has no pair`);
			});
		});
		for (let y = 1; y < laid.length; y++)
			for (let x = 1; x < laid[y].length; x++) {
				const q = [id[y - 1][x - 1], id[y - 1][x], id[y][x - 1], id[y][x]];
				if (q.every((v) => v > 0))
					ok(new Set(q).size < 4, `${where}: four mats meet at ${x},${y}`);
			}
	};
	for (const [w, h] of [
		[10, 6],
		[8, 6],
		[4, 3],
		[6, 4],
		[12, 5],
		[3, 3],
		[1, 4],
	])
		check(
			`${w}x${h}`,
			layTatami(Array.from({ length: h }, () => Array(w).fill(true))),
		);
	// 部屋の 畳（碁会所・コーポ・畳の 床の キリコの 家）
	let rooms = 0;
	for (const f of FACILITIES) {
		if (!f.room) continue;
		const rows = facilityRoomRows(f);
		const tiles = facilityRoomPalette(f);
		const laid = layRoomTatami(rows, tiles);
		if (laid.rows.join() === rows.join()) continue;
		rooms++;
		ok(
			laid.rows.every((r, y) => [...r].length === [...rows[y]].length),
			`${f.id}: width`,
		);
		for (const [y, r] of laid.rows.entries())
			for (const [x, ch] of [...r].entries()) {
				const was = tiles[[...rows[y]][x]];
				const now = laid.tiles[ch];
				ok(now, `${f.id}: no tile at ${x},${y}`);
				ok(now.passable === was.passable, `${f.id}: passable at ${x},${y}`);
				ok(!!now.counter === !!was.counter, `${f.id}: counter at ${x},${y}`);
			}
	}
	ok(rooms >= 3, `only ${rooms} rooms with tatami`);
});

test("キリコの 家: 文は 窓に 収まり、家具は 床に 置けて 通れなく ならない・入口と 予定表の 前は ふさがない", () => {
	const texts: [string, string][] = [];
	for (const [k, v] of Object.entries(HOME_MSG))
		for (const t of Array.isArray(v) ? v : [v])
			texts.push([`HOME_MSG.${k}`, t]);
	for (const [id, f] of Object.entries(FURNITURE))
		texts.push([`furniture ${id}`, f.line]);
	for (const [k, v] of Object.entries(JUKEBOX_MSG))
		texts.push([
			`JUKEBOX_MSG.${k}`,
			v.replace("{n}", "12").replace("{title}", "おんJタウンしゅうりょう！？"),
		]);
	for (const g of [MOVE_IN_GIFT, ...HOME_GIFTS, ...RESIDENT_GIFTS]) {
		texts.push([`gift ${g.id}`, g.note]);
		texts.push([
			`gift ${g.id} from`,
			HOME_MSG.from
				.replace("{from}", g.from)
				.replace("{name}", FURNITURE[g.id].name),
		]);
		texts.push([
			`gift ${g.id} picked`,
			HOME_MSG.picked.replace("{name}", FURNITURE[g.id].name),
		]);
	}
	texts.push([
		"loan",
		HOME_MSG.loan[0].replace("{y}", "34").replace("{m}", "11"),
	]);
	fitsWindow(texts);
	// もらえる 家具は 宅配便・住人・入居の どれか 1つだけ（もらえない 家具は 買うだけ）。どの 家具にも 値段
	// （板の 底の 品は 持ち帰ると 届くので 売らない：値段なし）
	const sources = [MOVE_IN_GIFT, ...HOME_GIFTS, ...RESIDENT_GIFTS].map(
		(g) => g.id,
	);
	ok(
		DUNGEON_IDS.every(
			(d) =>
				goalFurniture(d) in FURNITURE &&
				!(goalFurniture(d) in FURNITURE_PRICE) &&
				!sources.includes(goalFurniture(d)) &&
				// 品は 1マスの 台に 重ねる（台 | 品。cellLayers）。品は キャラより 手前（cellTile の above）
				cellLayers(FURNITURE[goalFurniture(d)].cells[0][0]).length === 2 &&
				cellTile(FURNITURE[goalFurniture(d)].cells[0][0]).above.length === 1 &&
				FURNITURE[goalFurniture(d)].cells.length === 1,
		),
		"a goal item is not a stand-only furniture",
	);
	for (const id of Object.keys(FURNITURE_PRICE)) {
		ok(
			sources.filter((x) => x === id).length <= 1,
			`${id}: ${sources.filter((x) => x === id).length} sources`,
		);
		ok(
			(FURNITURE_PRICE[id as keyof typeof FURNITURE_PRICE] ?? 0) >= 1000,
			`${id}: no price`,
		);
	}
	// 住人の 家具は その 施設の 人が くれる
	for (const g of RESIDENT_GIFTS) {
		const f = facilityById(g.facility);
		ok(
			f?.room?.people?.some((p) => p.id === g.person),
			`${g.facility}.${g.person} is not there`,
		);
	}
	// 置く：入口の 前・予定表の 前・立っている マスには 置かない。壁の 上にも 置かない
	ok(!canPlace([], { id: "table", x: 5, y: 8 }), "table on the mat front");
	ok(!canPlace([], { id: "table", x: 3, y: 3 }), "table under the loan");
	ok(!canPlace([], { id: "table", x: 0, y: 4 }), "table in the wall");
	ok(canPlace([], { id: "table", x: 2, y: 5 }), "table on the floor");
	// 背の 高い 家具は 上の 段を 壁の 下段に 重ねて 壁に 寄せられる（ベッドと 1マスの 物・予定表の 下は だめ）
	ok(canPlace([], { id: "shelf", x: 8, y: 2 }), "shelf against the wall");
	ok(!canPlace([], { id: "bed", x: 8, y: 2 }), "bed against the wall");
	ok(!canPlace([], { id: "table", x: 8, y: 2 }), "table on the wall");
	ok(!canPlace([], { id: "shelf", x: 3, y: 2 }), "shelf over the loan");
	// 1列に ならべて 部屋を 区切ると 通れなく なる
	const wall: Placed[] = [];
	for (let x = 1; x <= 10; x++) wall.push({ id: "table", x, y: 6 });
	ok(!layoutOk(wall), "a wall of furniture cuts the room");
	ok(layoutOk(wall.slice(0, 9)), "a gap at the end keeps the room open");
	ok(
		!canPlace(wall.slice(0, 9), { id: "table", x: 10, y: 6 }),
		"closing the gap",
	);
	// 目の前に 置く：向こうへ のびる（上を 向いて ベッドなら 上へ）
	const bed = placeInFront([], "bed", [4, 7], [4, 6]);
	ok(bed?.x === 4 && bed.y === 5, `bed in front: ${JSON.stringify(bed)}`);
	const sofa = placeInFront([], "sofa", [4, 6], [3, 6]);
	ok(
		sofa?.x === 2 && sofa.y === 6,
		`sofa to the left: ${JSON.stringify(sofa)}`,
	);
	// ぜんぶの 家具を 順に 置いても（置けた 分は）歩けて、字は かぶらない
	const placed: Placed[] = [];
	for (const id of Object.keys(FURNITURE) as FurnitureId[])
		for (let y = 3; y <= 8; y++)
			for (let x = 1; x <= 10; x++)
				if (!placed.some((p) => p.id === id) && canPlace(placed, { id, x, y }))
					placed.push({ id, x, y });
	// （2026-10-13 に 家具を 買えるように して ふえ、遊べる 家具も 12 ふえたので、ぜんぶは 部屋に 入りきらない。
	// 入りきらない 物は 収納に しまって 入れかえる。ここは 部屋の 広さ（だいたい 18 個）を 見る）
	ok(placed.length >= 16, `only ${placed.length} placed`);
	ok(layoutOk(placed), "full room is not walkable");
	const built = homeRows({ placed, wall: 0, floor: 0 });
	ok(
		built.rows.every((r) => [...r].length === 12),
		"home rows width",
	);
	const cells = placed.reduce(
		(n, p) => n + FURNITURE[p.id].cells.flat().length,
		0,
	);
	ok(
		Object.keys(built.art).length === cells,
		`${Object.keys(built.art).length} chars for ${cells} cells`,
	);
	for (const ch of Object.keys(built.art))
		ok(!"#HhWmK.D".includes(ch), `furniture char ${ch} is a room char`);
	ok(placed.length <= HOME_MAX, "more than HOME_MAX");
});

test("セーブの 書きかえ: every line fits the village window, every friend has a line for each tier", () => {
	const texts: [string, string][] = [];
	TAMPER_SCENE.forEach((ls, t) => {
		ls.forEach((l, i) => {
			texts.push([`TAMPER_SCENE[${t}][${i}]`, l.text]);
		});
	});
	TAMPER_NARRATION.forEach((v, i) => {
		texts.push([`TAMPER_NARRATION[${i}]`, v]);
	});
	for (const [w, ls] of Object.entries(TAMPER_TALK)) {
		ok(ls.length === TAMPER_SCENE.length, `${w}: ${ls.length} tiers`);
		ls.forEach((v, i) => {
			texts.push([`TAMPER_TALK.${w}[${i}]`, v]);
		});
	}
	TAMPER_LEDGER.forEach((v, i) => {
		texts.push([`TAMPER_LEDGER[${i}]`, v.replace("{points}", "9999999")]);
	});
	TAMPER_MOB.forEach((v, i) => {
		texts.push([`TAMPER_MOB[${i}]`, v]);
	});
	fitsWindow(texts);
	for (const w of Object.keys(SPEAKERS))
		ok(w in TAMPER_TALK, `${w} has no tamper lines`);
});

test("new village lines fit the message window (22 full-width × 2 lines)", () => {
	const texts: [string, string][] = [];
	for (const [k, v] of Object.entries(VILLAGE_MSG))
		for (const t of Array.isArray(v) ? v : [v])
			texts.push([
				`VILLAGE_MSG.${k}`,
				String(t).replace("{points}", "99999").replace("{rest}", "99999"),
			]);
	for (const [k, v] of Object.entries(VILLAGE_IDLE))
		texts.push([`VILLAGE_IDLE.${k}`, v]);
	ZERO_VOICELESS.forEach((v, i) => {
		texts.push([`ZERO_VOICELESS[${i}]`, v]);
	});
	fitsWindow(texts);
});

test("story page sounds exist, are measured, and repeat sanely", () => {
	const pages = [
		...DUNGEON_IDS.flatMap((d) => [
			...STORY[d].ending,
			...(STORY[d].again ?? []),
			...(STORY[d].once ?? []),
		]),
		...Object.values(BOSS_RETURN).flatMap((ps) => ps ?? []),
		...RETURN_PAGES,
		...TEN_NEWS.pages,
	];
	const all = [
		...pages,
		...pages.flatMap((p) => (p.instead ? [p.instead] : [])),
	];
	ok(
		all.some((p) => p.se),
		"no story page has a sound (the check would pass vacuously)",
	);
	for (const p of all) {
		if (!p.se) {
			ok(!p.seRepeat && !p.seGap, `"${p.text}": seRepeat/seGap without se`);
			continue;
		}
		ok(sfx[p.se], `"${p.text}": no sound file for ${p.se}`);
		ok(SE_LOUDNESS[p.se], `${p.se} is not measured (pnpm loudness)`);
		const n = p.seRepeat ?? 1;
		ok(Number.isInteger(n) && n >= 1 && n <= 12, `"${p.text}": seRepeat ${n}`);
	}
});

test("everything the village window reads out fits it (22 full-width × 2 lines)", () => {
	const texts: [string, string][] = [];
	const pool = (where: string, ls: readonly Shown[]) =>
		ls.forEach((l, i) => {
			texts.push([`${where}[${i}]`, shown(l)]);
		});
	for (const d of DUNGEON_IDS) {
		// 口・立て札の 札（ui/village/villageEvents.ts の signText。★つきが いちばん長い）と、開き方（同じく hintText）
		texts.push([
			`sign ${d}`,
			`「${DUNGEON_NAMES[d].name}」　${floorsLabel(d)}階★\n${DUNGEON_DESC[d]}`,
		]);
		for (const [i, l] of (UNLOCK_VISIT[d] ?? []).entries())
			texts.push([`UNLOCK_VISIT.${d}[${i}]`, l.text]);
		pool(`CLEAR.${d}`, CLEAR[d]);
		pool(`STORY.${d}.ending`, STORY[d].ending);
		pool(`STORY.${d}.again`, STORY[d].again ?? []);
		pool(`STORY.${d}.once`, STORY[d].once ?? []);
	}
	// 村に いない 人の かわりの 頁
	const standIns = [
		...DUNGEON_IDS.flatMap((d) => STORY[d].ending),
		...Object.values(BOSS_RETURN).flatMap((ps) => ps ?? []),
		...RETURN_PAGES,
	].flatMap((p) => (p.instead ? [p.instead] : []));
	pool("instead", standIns);
	pool("FIRST_SHALLOW", FIRST_SHALLOW);
	pool("SHALLOW_DEATH", SHALLOW_DEATH);
	pool("ESCAPE_QUOTES", ESCAPE_QUOTES);
	pool("RETURN_PAGES", RETURN_PAGES);
	for (const [k, v] of Object.entries(UNLOCK_LINES))
		pool(`UNLOCK_LINES.${k}`, v);
	for (const [i, v] of Object.entries(TITLE_TOWN_QUOTES))
		pool(`TITLE_TOWN_QUOTES[${i}]`, v);
	for (const [k, v] of Object.entries(TOWN_MSG))
		texts.push([`TOWN_MSG.${k}`, fill(v.text, { points: 99999, n: 4 })]);
	// 生き返った 通りの 知らせ・シャッター（いちばん 長い 名前と 数で）
	for (const [k, v] of Object.entries(REVIVE_MSG))
		for (const t of typeof v === "string" ? [v] : v)
			texts.push([
				`REVIVE_MSG.${k}`,
				fill(t, {
					n: 60,
					name: [...REVIVE_AREAS].sort(
						(a, b) => b.name.length - a.name.length,
					)[0].name,
				}),
			]);
	for (const a of REVIVE_AREAS) texts.push([`REVIVE_AREAS.${a.id}`, a.line]);
	texts.push(["VILLAGE_MSG.shut", VILLAGE_MSG.shut]);
	DEPART.free.forEach((t, i) => {
		texts.push([`DEPART.free[${i}]`, t]);
	});
	texts.push(["DEPART.nanj", DEPART.nanj]);
	// 裏の 2段目の 転と 結の あと（ui/village/villageReturn.ts の wrapScript・kusaScript）
	pool("TEN_NEWS.pages", TEN_NEWS.pages);
	pool(
		"DEPART.free",
		DEPART.free.map((text) => ({ who: "nanj", text })),
	);
	fitsWindow(texts);
});

test("喫茶「おんJ」: every talk fits the village window, and the door appears from its stage and can be reached", () => {
	// {drink} は いちばん 長い 一杯の 名前で 測る
	const longest = Object.values(CAFE_DRINKS)
		.map((d) => d.name)
		.sort((x, y) => y.length - x.length)[0];
	const fill = (t: string) => t.replaceAll("{drink}", longest);
	fitsWindow([
		...[...CAFE_TALKS, ...TREAT_TALKS].flatMap((t) =>
			t.lines.map((l, i): [string, string] => [`cafe ${t.id}[${i}]`, shown(l)]),
		),
		...Object.entries(CAFE_DRINKS).flatMap(([k, d]) =>
			d.lines.map((l, i): [string, string] => [`drink ${k}[${i}]`, l.text]),
		),
		...Object.entries(TREAT_REACTIONS).flatMap(([w, rs]) =>
			rs.flatMap((ls, i) =>
				ls.map((l): [string, string] => [`treat ${w}[${i}]`, fill(l.text)]),
			),
		),
		...Object.entries(TREAT_SIPS).flatMap(([w, ls]) =>
			ls.map((l, i): [string, string] => [`sip ${w}[${i}]`, l.text]),
		),
	]);
	// 好みで ない 一杯の 感想は 仲間 ごとに ある
	for (const w of Object.keys(TREAT_REACTIONS))
		ok(
			(TREAT_SIPS[w as keyof typeof TREAT_SIPS]?.length ?? 0) > 0,
			`${w}: no sip lines`,
		);
	// おごった 回数で 話が ふえる（3杯・6杯）
	const base = cafeTalks(
		CAFE_FROM,
		{
			heard: [],
			treats: {},
			sentAt: 0,
		},
		[],
	).length;
	const three = cafeTalks(
		CAFE_FROM,
		{
			heard: [],
			treats: { roze: 3 },
			sentAt: 0,
		},
		[],
	).length;
	const six = cafeTalks(
		CAFE_FROM,
		{
			heard: [],
			treats: { roze: 6 },
			sentAt: 0,
		},
		[],
	).length;
	ok(
		three === base + 1 && six === base + 2,
		`treat talks: ${base} → ${three} → ${six}`,
	);
	ok(
		new Set(CAFE_TALKS.map((t) => t.id)).size === CAFE_TALKS.length,
		"two cafe talks share an id",
	);
	// やきうの 話は いつでも 聞ける（扉の「！」も 出る）
	withStorage(() => {
		forgetCafeMemo();
		putTown({ stage: TOWN_STAGES - 1 });
		const talks = [...CAFE_TALKS, ...TREAT_TALKS];
		const his = talks.filter((t) => t.cast.includes("nanj"));
		ok(his.length > 0, "no cafe talk with やきう to test");
		localStorage.setItem(
			"kiriko-roguelike/cafe",
			JSON.stringify({
				heard: talks.filter((t) => !his.includes(t)).map((t) => t.id),
				treats: Object.fromEntries(talks.map((t) => [t.cast[0], 99] as const)),
				sentAt: 0,
			}),
		);
		const all = [...DUNGEON_IDS];
		setProgress(
			all,
			[],
			all.filter((d) => d !== "deep"),
		);
		ok(hasCafeNews(), "やきう's unheard talks give no 「！」 while he is here");
		ok(
			talksWith("nanj", TOWN_STAGES - 1).length > 0,
			"no talks with やきう while he is here",
		);
		// 最終話の あとも やきうは 村に いる（だれも 出ていかない）
		setProgress(all, [], all);
		ok(hasCafeNews(), "やきう's talks give no 「！」 after the 開票");
		ok(
			talksWith("nanj", TOWN_STAGES - 1).length > 0,
			"no talks with やきう after the 開票",
		);
		forgetCafeMemo();
	});
	for (const v of VIEWS) {
		const s = survey(v);
		const door = s.places.find((p) => p.id === "door_cafe");
		ok(
			!!door === v.stage >= CAFE_FROM,
			`${label(v)}: the cafe door does not match the stage`,
		);
		if (door)
			ok(
				s.reachable(door.x, door.y),
				`${label(v)}: cannot reach the cafe door`,
			);
	}
});

test("the boot title's quote keeps its two lines on a 320px phone (name and 「」 included)", () => {
	// 起動の札の ひとことは「名前「1行目」…「2行目」」の形。13px の字で 幅は 320px の画面で 280px（全角 21.5字）
	const quotes = new Map<string, Quote>();
	const add = (ls: readonly Quote[]) => {
		for (const q of ls) quotes.set(q.text, q);
	};
	add(FIRST_SHALLOW);
	add(SHALLOW_DEATH);
	add(ESCAPE_QUOTES);
	for (const d of DUNGEON_IDS) add(CLEAR[d]);
	for (const ls of Object.values(TITLE_TOWN_QUOTES)) add(ls);
	// 本編の たまり（data/story/quotes.ts。外へは 出していないので 引いて 集める）
	const causes = [
		"おなかがすいてたおれた",
		"荒らし草",
		"爆発",
		"寝落ち民",
		"コピペ",
		"忍法帖",
		"転載ガモ",
		"ワイ バーン",
		"かまってちゃん",
		"ゾンJ民",
		"文字化け",
		"ぷゆゆ",
		"とうすこ",
		"罠",
	];
	const contexts: QuoteContext[] = [null];
	for (const kind of ["dead", "clear", "escape"] as const)
		for (const depth of [1, 8, 15])
			for (const cause of causes)
				for (const runs of [1, 12])
					for (const clears of [0, 3])
						contexts.push({ kind, depth, cause, runs, clears });
	const whos = [undefined, ...(Object.keys(SPEAKERS) as Speaker[])];
	for (const c of contexts)
		for (const who of whos)
			for (let seed = 0; seed < 64; seed++) {
				const q = pickQuote(c, seed, who);
				if (q) quotes.set(q.text, q);
			}
	for (const q of quotes.values()) {
		const lines = q.text.split("\n");
		const first = `${SPEAKERS[q.who].name}「${lines[0]}`;
		const last = `${lines[lines.length - 1]}」`;
		ok(lines.length <= 2, `${q.who}: ${lines.length} lines`);
		for (const l of lines.length > 1 ? [first, last] : [`${first}」`])
			ok(width(l) <= 21.5, `${q.who}: "${l}" is ${width(l)} wide`);
	}
});

// ───────────────── 帰ってきたとき（仮の Story） ─────────────────

test("the friends line up beside the exit Kiriko comes back through", () => {
	for (const v of VIEWS) {
		const s = survey(v);
		for (const d of v.unlocked) {
			const exit = exitFor(d);
			const [mx, my] = exit.cell;
			const spots = lineupSpots(v, 5, exit);
			ok(spots.length === 5, `${label(v)} ${d}: ${spots.length} spots`);
			ok(
				new Set(spots.map(([x, y]) => `${x},${y}`)).size === spots.length,
				`${label(v)} ${d}: two friends on one spot`,
			);
			for (const [x, y] of spots) {
				ok(
					s.canEnter(x, y),
					`${label(v)} ${d}: (${x},${y}) is a wall or taken`,
				);
				const [ix, iy] =
					exit.inward === "down"
						? [0, 1]
						: exit.inward === "up"
							? [0, -1]
							: exit.inward === "right"
								? [1, 0]
								: [-1, 0];
				ok(
					!(x === mx + ix && y === my + iy),
					`${label(v)} ${d}: a friend blocks the way out`,
				);
				ok(
					Math.abs(x - mx) + Math.abs(y - my) <= 7,
					`${label(v)} ${d}: (${x},${y}) is far from the exit`,
				);
				ok(
					!s.places.some(
						(p) => p.trigger === "touch" && p.x === x && p.y === y,
					),
					`${label(v)} ${d}: a friend stands in a mouth`,
				);
			}
		}
	}
});

const PROGRESS_KEY = "kiriko-roguelike/progress";
const TOWN_KEY = "kiriko-roguelike/town";
const HALL_KEY = "kiriko-roguelike/hall";

/** 進み具合を 置く（開いた ダンジョンと まだ 見せていない 知らせ）。 */
const setProgress = (
	unlocked: DungeonId[],
	news: ProgressNews[] = [],
	cleared: DungeonId[] = [],
): void =>
	localStorage.setItem(
		PROGRESS_KEY,
		JSON.stringify({ unlocked, cleared, fails: {}, intro: [], news }),
	);

const item = (uid: number, kind: string, extra: Partial<Item> = {}): Item => ({
	uid,
	kind,
	plus: 0,
	cursed: false,
	charges: 0,
	known: false,
	count: 1,
	...extra,
});

/** 町を まるごと 置く。 */
const putTown = (t: Partial<Town>): void =>
	localStorage.setItem(
		TOWN_KEY,
		JSON.stringify({
			points: 0,
			stage: 0,
			storage: [],
			pending: null,
			returned: [],
			...t,
		}),
	);

/** 持ち帰り（おあずかり）。 */
const pending = (
	kind: PendingReturn["kind"],
	items: Item[],
	dungeon: DungeonId = "main",
): PendingReturn => ({ kind, dungeon, seed: `test-${kind}`, items });

/**
 * 仮の Story：した事を 1行ずつ 記録する（say は「say 話し手: 文」）。
 * at は キリコの 立つ マス。onSay は セリフの たびに 呼ぶ（投げると そこで タブを 閉じた ことに なる）。
 * goto・move・place で キリコの マス（state）も 動く。場面で 置いた・歩かせた 人の マスを おぼえて、
 * ほかの 人が 立つ マスへ 着いたら clashes に 書く（口の マスは 人が 出入りするので 数えない。建て直すと 忘れる）。
 */
const fakeStory = (
	o: {
		at?: readonly [number, number];
		onSay?: (n: number) => void;
		pick?: number;
		/** キリコの 近くに いる 人。 */
		near?: readonly string[];
	} = {},
) => {
	const log: string[] = [];
	/** goto の 行き先と noWarp（log の 行は かえない）。 */
	const walks: { target: string; x: number; y: number; noWarp: boolean }[] = [];
	const state: VState = {
		x: o.at?.[0] ?? VILLAGE_SPOTS.boot[0],
		y: o.at?.[1] ?? VILLAGE_SPOTS.boot[1],
		dir: "up",
		flags: {},
	};
	let says = 0;
	/** 場面で 置いた・歩かせた 人（キリコの ほか。見えている 人だけ）の マス。 */
	const pos = new Map<string, Cell>();
	let shown = true;
	/** 人が ほかの 人の マスに 着いた 行。 */
	const clashes: string[] = [];
	const land = (id: string, x: number, y: number, line: string): void => {
		if (id === "player") {
			state.x = x;
			state.y = y;
		} else pos.set(id, [x, y]);
		if (VILLAGE_EXITS.some((e) => e.cell[0] === x && e.cell[1] === y)) return;
		const here: [string, Cell][] = [
			...pos,
			...(shown ? [["player", [state.x, state.y]] as [string, Cell]] : []),
		];
		const on = here.find(([k, [px, py]]) => k !== id && px === x && py === y);
		if (on) clashes.push(`${line} (on ${on[0]})`);
	};
	const s: Story = {
		state,
		say: async (who, text) => {
			o.onSay?.(says++);
			log.push(`say ${who}: ${text}`);
		},
		narrate: async (text) => {
			log.push(`narrate: ${text}`);
		},
		kiriko: async (text, mode) => {
			log.push(`kiriko ${mode}: ${text}`);
		},
		choose: async (options) => {
			log.push(`choose ${options.join("/")}`);
			return o.pick ?? 0;
		},
		wait: async () => {},
		fadeOut: async () => {
			log.push("fadeOut");
		},
		fadeIn: async () => {
			log.push("fadeIn");
		},
		bgm: (name) => {
			log.push(`bgm ${name}`);
		},
		fadeBgm: async () => {},
		preloadSe: () => {},
		se: (name) => {
			log.push(`se ${name}`);
		},
		flag: (name) => state.flags[name],
		set: (name, value = true) => {
			state.flags[name] = value;
		},
		move: async (target, route) => {
			log.push(`move ${target} ${route}`);
			if (target === "player") {
				for (const ch of route) {
					if (ch === "d") state.y++;
					if (ch === "u") state.y--;
					if (ch === "l") state.x--;
					if (ch === "r") state.x++;
				}
				land("player", state.x, state.y, `move player ${route}`);
			}
		},
		goto: async (target, x, y, opt) => {
			log.push(`goto ${target} ${x},${y}`);
			walks.push({ target, x, y, noWarp: !!opt?.noWarp });
			land(target, x, y, `goto ${target} ${x},${y}`);
		},
		face: () => {},
		near: (id) => o.near?.includes(id) ?? false,
		look: async (target) => {
			log.push(
				`look ${target === null ? "kiriko" : typeof target === "string" ? target : target.join(",")}`,
			);
		},
		show: (id) => {
			log.push(`show ${id}`);
			if (id === "player") shown = true;
		},
		hide: (id) => {
			log.push(`hide ${id}`);
			if (id === "player") shown = false;
			else pos.delete(id);
		},
		place: (id, x, y) => {
			log.push(`place ${id} ${x},${y}`);
			land(id, x, y, `place ${id} ${x},${y}`);
		},
		wear: (id, prop) => {
			log.push(`wear ${id} ${prop ?? "-"}`);
		},
		spores: (id) => {
			log.push(`spores ${id}`);
		},
		toast: (text) => {
			log.push(`toast ${text}`);
		},
		rebuild: async () => {
			log.push("rebuild");
			pos.clear();
		},
		warp: async (map, x, y, dir) => {
			log.push(`warp ${map} ${x},${y}${dir ? ` ${dir}` : ""}`);
			state.x = x;
			state.y = y;
			if (dir) state.dir = dir;
		},
		lie: (at) => {
			log.push(at ? `lie ${at.x},${at.y}` : "getup");
		},
		exit: () => {},
	};
	return { s, log, walks, clashes };
};

test("村の 場面で 話す 仲間は そばへ 呼ぶ：遠い 人だけ 暗転中に キリコの まわりへ 置き、終わりに 建て直す", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow"]);
		putTown({ stage: 4 });
		// みんな そばに いれば 何も しない
		const a = fakeStory({ near: ["roze", "zero"] });
		await gather(a.s, ["roze", "zero", null]);
		await sendBack(a.s);
		ok(!a.log.length, `moved although everyone is near:\n${a.log.join("\n")}`);
		// 遠い 人だけ 置く（同じ 人は 1回）。置く マスは キリコの まわり 4マス 以内
		const b = fakeStory({ near: ["roze"] });
		await gather(b.s, ["roze", "zero", "zero", "shiyo"]);
		const placed = b.log.filter((l) => l.startsWith("place "));
		ok(
			placed.length === 2 &&
				placed.some((l) => l.startsWith("place zero ")) &&
				placed.some((l) => l.startsWith("place shiyo ")),
			`placed: ${placed.join(" / ")}`,
		);
		const [bx, by] = VILLAGE_SPOTS.boot;
		for (const l of placed) {
			const [x, y] = l.split(" ")[2].split(",").map(Number);
			ok(
				Math.max(Math.abs(x - bx), Math.abs(y - by)) <= TALK_NEAR,
				`${l} is far from Kiriko`,
			);
		}
		ok(inOrder(b.log, ["fadeOut", "fadeIn"]), "not placed in the dark");
		// 終わりに 建て直して 持ち場へ（2回目は 何も しない）
		await sendBack(b.s);
		ok(inOrder(b.log, ["fadeOut", "rebuild", "fadeIn"]), "not sent back");
		const n = b.log.length;
		await sendBack(b.s);
		ok(b.log.length === n, "sent back twice");
	});
});

/** log の 中で want が この順に 出てくるか（あいだに ほかの 行が あってもよい）。 */
const inOrder = (log: readonly string[], want: readonly string[]): boolean => {
	let i = 0;
	for (const l of log) if (l === want[i]) i++;
	return i === want.length;
};

test("coming back: friends wait at the mouth, Kiriko steps out, they speak the ending in the village", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow"]);
		// 仲間が みんな 越してきた 町（まだ 来ていない 仲間の 場合は 下の 試験）
		putTown({ stage: 7 });
		const v = villageView();
		const cases: [ReturnArrival, readonly StoryPage[]][] = [
			[{ kind: "clear", dungeon: "shallow" }, STORY.shallow.ending],
			[{ kind: "escape", dungeon: "shallow" }, RETURN_PAGES],
		];
		for (const [a, pages] of cases) {
			const { s, log } = fakeStory({ at: VILLAGE_SPOTS.exit });
			lineUp(s, a, v);
			const who = [...new Set(pages.flatMap((p) => (p.who ? [p.who] : [])))];
			const spots = lineupSpots(v, who.length);
			ok(
				log[0] === "hide player",
				`${a.kind}: Kiriko is seen before she comes out`,
			);
			for (const [i, w] of who.entries())
				ok(
					log.includes(`place ${w} ${spots[i].join(",")}`),
					`${a.kind}: ${w} does not wait at the mouth`,
				);
			await returnScene(s, a);
			ok(
				inOrder(log, [
					"show player",
					`move player ${VILLAGE_EXITS[0].step}`,
					...pages.map((p) =>
						p.kiriko
							? `kiriko ${p.kiriko}: ${p.text}`
							: p.who
								? `say ${p.who}: ${p.text}`
								: p.mob
									? `say ${MOBS[p.mob].voice ?? null}: ${p.text}`
									: p.nanashi
										? `say nanj: ${p.text}`
										: `narrate: ${p.text}`,
					),
					"fadeOut",
					"rebuild",
					`bgm ${villageSong()}`,
					"fadeIn",
				]),
				`${a.kind}: the scene is out of order:\n${log.join("\n")}`,
			);
			ok(
				s.state.y === VILLAGE_SPOTS.exit[1] - 1,
				`${a.kind}: Kiriko is still in the exit`,
			);
		}
		// 蓄音機の前に いる（出口から 帰っていない）：場面は ない
		const { s, log } = fakeStory();
		lineUp(s, { kind: "escape", dungeon: "deep" }, v);
		await returnScene(s, { kind: "escape", dungeon: "deep" });
		ok(log.length === 0, `a scene played away from the mouth: ${log.join()}`);
	});
});

test("coming back after a death: Kiriko wakes at the gramophone and a friend walks up with a line", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow", "main"]);
		pushRecord({ kind: "dead", dungeon: "main", depth: 5 });
		const { s, log } = fakeStory();
		await deathScene(s);
		const wake = log.findIndex((l) => l.startsWith("narrate: "));
		ok(wake === 0, `does not open with the wake narration:\n${log.join("\n")}`);
		ok(
			WAKE_PAGES.some((t) => log[0] === `narrate: ${t}`),
			"the wake narration is not one of WAKE_PAGES",
		);
		const walk = log.findIndex((l) => l.startsWith("goto "));
		const say = log.findIndex((l) => l.startsWith("say "));
		ok(
			walk > 0 && say > walk,
			`no friend walks up and talks:\n${log.join("\n")}`,
		);
		const [bx, by] = VILLAGE_SPOTS.boot;
		ok(
			log[walk].endsWith(` ${bx + 1},${by}`),
			`the friend stops at ${log[walk]}`,
		);
		ok(log.includes("rebuild"), "the friend is not sent home");
		// 持ち帰った あとは この 場面は ない
		pushRecord({ kind: "clear", dungeon: "shallow" });
		const b = fakeStory();
		await deathScene(b.s);
		ok(b.log.length === 0, `a death scene after a clear: ${b.log.join()}`);
	});
});

test("unlock news: shown at the exit, a closed tab shows it again", async () => {
	await withStorageAsync(async () => {
		const news: ProgressNews = { dungeon: "main", reason: "clear" };
		setProgress(["shallow", "main"], [news], ["shallow"]);
		putTown({ stage: 7 });
		// 知らせを 見せるまでは 開いていない
		ok(!villageView().unlocked.includes("main"), "本編 opens before its news");
		// 2つ目の セリフで タブを 閉じた：知らせは 残る
		const closed = fakeStory({
			onSay: (n) => {
				if (n === 1) throw new Error("tab closed");
			},
		});
		let threw = false;
		try {
			await newsScript(closed.s);
		} catch {
			threw = true;
		}
		ok(threw, "the fake tab did not close");
		ok(
			loadProgress().news.length === 1 &&
				!villageView().unlocked.includes("main"),
			"the news was lost when the tab closed",
		);
		// 開きなおして 最後まで（出口を 見て 話す。村の 見た目は 変わらない。話す 仲間は そばに いる）
		// 北の 出口から 出てきた ところ（出口が 近い）：出口を 見てから 話す
		const [ex0, ey0] = VILLAGE_SPOTS.exit;
		const { s, log } = fakeStory({
			near: ["roze", "shiyo", "feris", "zero", "nanj"],
			at: [ex0, ey0 + 1],
		});
		await newsScript(s);
		const exit = `look ${VILLAGE_SPOTS.exit.join(",")}`;
		ok(
			inOrder(log, [
				exit,
				...UNLOCK_LINES.main.map((l) => `say ${l.who}: ${l.text}`),
				"se chapter",
				"narrate: 「風呂板」に\nもぐれるようになった",
				"look kiriko",
			]),
			`the 本編 news is out of order:\n${log.join("\n")}`,
		);
		ok(!log.includes("fadeOut"), "the news fades although nothing moves");
		ok(loadProgress().news.length === 0, "the news stays after it was shown");
		ok(villageView().unlocked.includes("main"), "本編 is still shut");
		// 電池板
		setProgress(
			["shallow", "main", "deep"],
			[{ dungeon: "deep", reason: "clear" }],
			["shallow", "main"],
		);
		// 蓄音機の 前（出口が 遠い）：そばで 話しおえてから 出口を 見せて「もぐれる」
		const deep = fakeStory();
		await newsScript(deep.s);
		ok(
			inOrder(deep.log, [
				...UNLOCK_LINES.deep.map((l) => `say ${l.who}: ${l.text}`),
				exit,
				"narrate: 「電池板」に\nもぐれるようになった",
			]),
			`the 電池板 news is out of order:\n${deep.log.join("\n")}`,
		);
		// 過去ログの底：出口ではなく 広場の 古井戸を 見せる
		setProgress(
			["shallow", "kinoko", "main", "deep", "hidden"],
			[{ dungeon: "hidden", reason: "clear" }],
			["shallow", "kinoko", "main", "deep"],
		);
		const hidden = fakeStory();
		await newsScript(hidden.s);
		ok(
			inOrder(hidden.log, [
				...UNLOCK_LINES.hidden.map((l) => `say ${l.who}: ${l.text}`),
				`look ${VILLAGE_SPOTS.well.join(",")}`,
				`narrate: 「${DUNGEON_NAMES.hidden.name}」に\nもぐれるようになった`,
			]) && !hidden.log.includes(exit),
			`the 過去ログの底 news does not show the well:\n${hidden.log.join("\n")}`,
		);
		// きのこ板で 何度も たおれた（救い）：ゼロが 倉庫の 封鎖を 解く。板は 開かない
		setProgress(
			["shallow", "kinoko"],
			[{ dungeon: "kinoko", reason: "relief" }],
			["shallow"],
		);
		const relief = fakeStory();
		await newsScript(relief.s);
		ok(
			relief.log.includes(`say zero: ${UNLOCK_LINES.relief[0].text}`) &&
				relief.log.includes(`narrate: ${VILLAGE_MSG.carryRelief}`),
			`the relief news is wrong:\n${relief.log.join("\n")}`,
		);
	});
});

test("開票: the 電池板 ending plays once and やきう stays; 転 plays once after 風呂板", async () => {
	const all = [...DUNGEON_IDS];
	const put = (cleared: DungeonId[], endings: DungeonId[]) =>
		localStorage.setItem(
			PROGRESS_KEY,
			JSON.stringify({
				unlocked: all,
				cleared,
				fails: {},
				intro: all,
				news: [],
				endings,
			}),
		);
	await withStorageAsync(async () => {
		putTown({ stage: TOWN_STAGES - 1 });
		// はじめて 持ち帰った：開票の 語り（寄り道「残機」を 終えて いれば 数字が 跳ねる 頁も）
		put(
			all,
			all.filter((d) => d !== "deep"),
		);
		const a: ReturnArrival = { kind: "clear", dungeon: "deep" };
		ok(
			JSON.stringify(pagesFor(a)) ===
				JSON.stringify([...STORY.deep.ending, episodeEnd("deep")]),
			"the 開票 is cut the first time",
		);
		const { s, log } = fakeStory({ at: exitFor("deep").cell });
		lineUp(s, a, sceneView(villageView(), a));
		await returnScene(s, a);
		ok(
			STORY.deep.ending.every(
				(p) => p.who !== "nanj" || log.includes(`say nanj: ${p.text}`),
			),
			`やきう's lines in the 開票 are not played:\n${log.join("\n")}`,
		);
		ok(
			log.some((l) => l.includes("盛るまでもないわ")),
			"no 盛るまでもない at the climax",
		);
		ok(
			!!loadProgress().endings?.includes("deep"),
			"the 開票 is not remembered",
		);
		// 見おえても やきうは 村に いる。2回目からは 短い 語り
		ok(
			villagePlaces(villageView()).some((p) => p.id === "nanj"),
			"やきう left the village after the 開票",
		);
		ok(
			JSON.stringify(pagesFor(a)) === JSON.stringify(STORY.deep.again),
			"the 開票 plays again",
		);
		// 寄り道「残機」を 終えて いなければ、数字が 跳ねる 頁は 出ない
		put(["shallow", "main", "deep"], ["shallow", "main"]);
		ok(
			JSON.stringify(pagesFor(a)) ===
				JSON.stringify([
					...STORY.deep.ending.filter(
						(p) => !p.needCleared && !p.unlessCleared,
					),
					episodeEnd("deep"),
				]),
			"the 残機 pages show without the side story",
		);
		// 転：風呂板の 語りを 見おえた 帰りに 1回だけ。旗 ten
		put(["shallow", "kinoko", "main"], ["shallow", "kinoko", "main"]);
		const ten = fakeStory();
		await tenScript(ten.s);
		ok(
			TEN_NEWS.pages.every(
				(p) => p.who !== "nanj" || ten.log.includes(`say nanj: ${p.text}`),
			),
			`the 転 is not played:\n${ten.log.join("\n")}`,
		);
		ok(hasFlag("ten"), "the 転 is not remembered");
	});
});

test("町の 寄り道で 見つける 板（おーぷぬの おんJ関連板）は 持ち帰りでは 開かず、施設の 物・人で 1回だけ 開いて 知らせる", async () => {
	await withStorageAsync(async () => {
		const fresh = () =>
			localStorage.setItem(
				PROGRESS_KEY,
				JSON.stringify({
					unlocked: [...DUNGEON_IDS].filter(
						(d) => !TOWN_FINDS.some((f) => f.dungeon === d),
					),
					cleared: [...DUNGEON_IDS].filter(
						(d) => !TOWN_FINDS.some((f) => f.dungeon === d),
					),
					fails: {},
					intro: [],
					news: [],
					endings: [],
				}),
			);
		fresh();
		noteRunEnd("festival", "clear", "find-1");
		ok(
			!TOWN_FINDS.some((f) => loadProgress().unlocked.includes(f.dungeon)),
			`a town find opened by a clear: ${loadProgress().unlocked.join()}`,
		);
		putTown({ stage: TOWN_STAGES - 1 });
		for (const f of TOWN_FINDS) {
			const fac = FACILITIES.find((x) => x.id === f.facility);
			ok(
				!!fac &&
					[
						...Object.values(fac.room?.things ?? {}),
						...(fac.room?.people ?? []).map((x) => x.id),
						...(fac.outdoor ?? []).map((x) => x.id),
					].includes(f.at),
				`${f.dungeon}: no ${f.at} in ${f.facility}`,
			);
			ok(
				DUNGEONS[f.dungeon].unlockAfter === null &&
					DUNGEONS[f.dungeon].unlockFlag === `town_${f.dungeon}`,
				`${f.dungeon}: opens by something else`,
			);
			fitsWindow(f.lines.map((l) => [f.dungeon, l.text]));
		}
		// おんキムは おんMuの あと（植民地戦争）
		ok(
			!(await townFind(fakeStory().s, "konbini", "notice")),
			"おんキム before おんMu",
		);
		for (const f of TOWN_FINDS) {
			const r = fakeStory();
			ok(await townFind(r.s, f.facility, f.at), `${f.dungeon}: nothing`);
			ok(
				loadProgress().unlocked.includes(f.dungeon) &&
					r.log.includes("se chapter") &&
					r.log.some((l) =>
						l.includes(`「${DUNGEON_NAMES[f.dungeon].name}」に`),
					),
				`${f.dungeon}: not opened or not told: ${r.log.join(" / ")}`,
			);
			ok(
				!(await townFind(fakeStory().s, f.facility, f.at)),
				`${f.dungeon}: twice`,
			);
		}
	});
});

test("持ち帰った 板の 底の 品は、家を 買って いれば 入った ときに 台に のって 届く（1つずつ・1度だけ）", async () => {
	await withStorageAsync(async () => {
		localStorage.setItem(
			PROGRESS_KEY,
			JSON.stringify({
				unlocked: ["shallow", "kinoko"],
				cleared: ["shallow", "kinoko"],
				fails: {},
				intro: [],
				news: [],
				endings: [],
			}),
		);
		forgetHomeMemo();
		saveHome({ ...loadHome(), owned: true }, false);
		const first = fakeStory();
		await enterHome(async () => {})(first.s);
		const got = loadHome().stored.filter((id) => id.startsWith("goal_"));
		ok(
			got.join() === "goal_shallow,goal_kinoko" &&
				first.log.some((l) => l.includes("品が2点")),
			`the goal items did not arrive: ${got.join()} / ${first.log.join(" / ")}`,
		);
		const again = fakeStory();
		await enterHome(async () => {})(again.s);
		ok(
			loadHome().stored.filter((id) => id.startsWith("goal_")).length === 2 &&
				!again.log.some((l) => l.includes("品が")),
			"the goal items arrived twice",
		);
	});
});

/** シヨに 渡す 仮の 手（えらぶ uid を 決めておく。when で 途中の ことを おこす）。 */
const chooser =
	(uids: number[], when?: () => void): StoreChooser =>
	async () => {
		when?.();
		return uids;
	};

/** 店の 人の 行（住人は 名前欄の 色を かりた 仲間か null で 話す。ui/village/villageMobs.ts の sayAs）。 */
const staffSay = (l: StaffLine, vars: Record<string, string | number> = {}) =>
	`say ${MOBS[l.who].voice ?? null}: ${fill(l.text, vars)}`;

test("settling in the village: ンゴ姉 stores, ジェイトルマン buys the rest", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow", "main"], [], ["shallow"]);
		const keep = item(1, "bat", { plus: 2 });
		const sell = item(2, "h_heal");
		putTown({
			stage: 4,
			points: 1000,
			// パン板は 買い取りの 倍率 1（倍率の ある 板は 下の テスト）
			pending: pending("escape", [keep, sell], "shallow"),
		});
		let asked = 0;
		const { s, log } = fakeStory();
		await settleScript(
			s,
			chooser([1], () => {
				asked++;
			}),
		);
		ok(asked === 1, "ンゴ姉 did not ask what to store");
		const t = loadTown();
		ok(!t.pending, "the haul is still pending");
		ok(
			t.storage.length === 1 &&
				t.storage[0].kind === "bat" &&
				t.storage[0].known,
			"the bat is not in the storehouse (known)",
		);
		ok(t.points === 1000 + priceOf(sell), `points: ${t.points}`);
		ok(
			inOrder(log, [
				staffSay(TOWN_MSG.storePrompt),
				staffSay(TOWN_MSG.storeDone),
				staffSay(TOWN_MSG.sold, { points: priceOf(sell) }),
			]),
			`the settle is out of order:\n${log.join("\n")}`,
		);
		ok(
			!log.some((l) => /^say (roze|shiyo|zero|feris):/.test(l)),
			`a rival worked the shop:\n${log.join("\n")}`,
		);
		ok(loadTown().stage === 4, "selling opened shops");
	});
});

test("harder boards buy higher, and only the festival stands out", async () => {
	// 倍率は 板の むずかしさ順（パン板 1・本編より 深層）、お祭り会場は 同じくらいの 板より 飛びぬける
	ok(saleRate("shallow") === 1, "the starter board has a sale bonus");
	ok(saleRate("main") > 1, "the main board has no sale bonus");
	ok(saleRate("deep") > saleRate("main"), "deep buys lower than main");
	ok(
		saleRate("festival") >= 1.5 * saleRate("konamono"),
		"the festival does not stand out",
	);
	await withStorageAsync(async () => {
		setProgress(["shallow", "main"], [], ["shallow"]);
		const sell = item(2, "h_heal");
		putTown({
			stage: 4,
			points: 1000,
			pending: pending("escape", [sell], "festival"),
		});
		const { s, log } = fakeStory();
		await settleScript(s, chooser([]));
		const got = Math.round(priceOf(sell) * saleRate("festival"));
		ok(loadTown().points === 1000 + got, `points: ${loadTown().points}`);
		ok(
			inOrder(log, [
				staffSay(TOWN_MSG.saleFestival, {
					board: DUNGEON_NAMES.festival.short,
					rate: saleRate("festival"),
				}),
				staffSay(TOWN_MSG.sold, { points: got }),
			]),
			`no festival price line:\n${log.join("\n")}`,
		);
	});
});

test("settling keeps its guards: another tab, a closed tab, a full storehouse, nothing brought back", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow", "main"], [], ["shallow"]);
		const haul = pending("escape", [item(1, "bat"), item(2, "h_heal")]);
		// 選んでいるあいだに 別のタブが 決めた：こちらでは 何もしない（上書きしない）
		putTown({ stage: 4, points: 1000, pending: haul });
		// （loadTown と 同じ 並びで 書く。くらべるのは JSON）
		const other = {
			points: 1234,
			stage: 4,
			revived: [],
			storage: [],
			bag: [],
			lunch: false,
			sales: [],
			pending: null,
			returned: ["x"],
		};
		const a = fakeStory();
		await settleScript(
			a.s,
			chooser([1], () => localStorage.setItem(TOWN_KEY, JSON.stringify(other))),
		);
		ok(
			JSON.stringify(loadTown()) === JSON.stringify(other),
			"the other tab's settle was overwritten",
		);
		ok(
			!a.log.includes(
				staffSay(TOWN_MSG.sold, { points: priceOf(item(2, "h_heal")) }),
			),
			"sales were read for a haul another tab settled",
		);
		// 一覧の 途中で タブを 閉じた：おあずかりは そのまま（次に 開いたとき 続きから）
		putTown({ stage: 4, points: 1000, pending: haul });
		const b = fakeStory();
		let threw = false;
		try {
			await settleScript(b.s, async () => {
				throw new Error("tab closed");
			});
		} catch {
			threw = true;
		}
		ok(threw, "the fake tab did not close");
		ok(
			JSON.stringify(loadTown().pending) === JSON.stringify(haul),
			"the haul was lost when the tab closed",
		);
		// 倉庫が いっぱい：きかずに ぜんぶ 売る
		const full = Array.from({ length: 10 }, (_, i) => item(100 + i, "h_heal"));
		putTown({ stage: 4, points: 1000, storage: full, pending: haul });
		const c = fakeStory();
		await settleScript(
			c.s,
			chooser([1], () => ok(false, "asked with a full storehouse")),
		);
		ok(
			c.log.find((l) => l.startsWith("say ")) ===
				staffSay(TOWN_MSG.storageFull) &&
				loadTown().storage.length === 10 &&
				!loadTown().pending,
			`full storehouse:\n${c.log.join("\n")}`,
		);
		// 何も 持ち帰らなかった：ひとことだけ
		putTown({ stage: 4, points: 1000, pending: pending("escape", []) });
		const d = fakeStory({ near: ["mob_jtleman"] });
		await settleScript(d.s, chooser([]));
		ok(
			d.log.length === 1 && d.log[0] === staffSay(TOWN_MSG.soldNothing),
			`empty escape:\n${d.log.join("\n")}`,
		);
		// おあずかりが 無い（倒れた・もう 決めた）：何もしない
		const e = fakeStory();
		await settleScript(e.s, chooser([]));
		ok(e.log.length === 0, `settled without a haul: ${e.log.join()}`);
	});
});

// ───────────────── おんJマイナーズ（ui/village/villageMobs.ts） ─────────────────

test("施設の 人の 寸劇: every key is a facility person, 2–3 windows that fit, the last window is not narration", () => {
	const people = new Set(
		FACILITIES.flatMap((f) =>
			(f.room?.people ?? []).map((p) => `${f.id}/${p.id}`),
		),
	);
	const texts: [string, string][] = [];
	for (const [key, gags] of Object.entries(STAFF_GAGS)) {
		ok(people.has(key), `${key}: no such facility person`);
		gags.forEach((g, i) => {
			ok(g.length >= 2 && g.length <= 3, `${key}[${i}]: ${g.length} windows`);
			ok(g.at(-1)?.who !== null, `${key}[${i}]: ends on narration`);
			g.forEach((l, j) => {
				texts.push([`${key}[${i}][${j}]`, l.text]);
			});
		});
	}
	fitsWindow(texts);
});

test("施設の 人の 寸劇: none before the first dive, one per return in order instead of the usual line, never twice", async () => {
	await withStorageAsync(async () => {
		forgetStaffGags();
		const view: VillageView = {
			stage: TOWN_STAGES - 1,
			unlocked: ["shallow"],
			cleared: [],
		};
		const f = facilityById("konbini");
		const who = f?.room?.people?.find((p) => p.id === "konbini_clerk");
		const ev = f
			? (buildFacility(f, view, {} as Ctx).events ?? []).find(
					(e) => e.id === who?.id,
				)
			: undefined;
		const gags = STAFF_GAGS["konbini/konbini_clerk"] ?? [];
		ok(ev?.run && who && gags.length >= 2, "no konbini clerk");
		if (!ev?.run || !who) return;
		const shown = (l: StaffGagLine) =>
			l.who === "staff"
				? `say nanj: ${l.text}`
				: l.who === "kiriko"
					? `kiriko voice: ${l.text}`
					: `narrate: ${l.text}`;
		const { s, log } = fakeStory({});
		const talk = async () => {
			log.length = 0;
			await ev.run?.(s);
			return [...log];
		};
		// まだ もぐって いない：いつもの ひとこと
		ok(
			!(await talk()).includes(shown(gags[0][0])),
			"a gag before the first dive",
		);
		pushRecord({});
		const first = await talk();
		ok(
			inOrder(first, gags[0].map(shown)) &&
				!first.includes(`say nanj: ${who.lines[1]}`),
			`first gag:\n${first.join("\n")}`,
		);
		// 同じ 帰りは もう 出ない
		ok(!(await talk()).includes(shown(gags[1][0])), "two gags in one return");
		pushRecord({});
		ok(inOrder(await talk(), gags[1].map(shown)), "the second gag next return");
	});
});

test("おんJマイナーズ: lines fit the window, one talk is at most 4 windows, companions only chime in", () => {
	const texts: [string, string][] = [];
	const talk = (where: string, ls: readonly MobLine[]) => {
		ok(ls.length >= 1 && ls.length <= 4, `${where}: ${ls.length} windows`);
		// 本人・地の文・キリコで 3窓まで（4窓目は 仲間・ほかの子の 口出しの ときだけ）
		ok(
			ls.filter((l) => l.who === "mob" || l.who === null || l.who === "kiriko")
				.length <= 3,
			`${where}: more than 3 windows without a chime-in`,
		);
		ls.forEach((l, i) => {
			texts.push([`${where}[${i}]`, l.text]);
		});
	};
	for (const id of MOB_IDS) {
		const d = MOBS[id];
		talk(`${id}.meet`, d.meet);
		if (d.ask) {
			talk(`${id}.ask`, d.ask.lines);
			talk(`${id}.ask.yes`, d.ask.yes);
			talk(`${id}.ask.no`, d.ask.no);
		}
		for (const [k, v] of Object.entries(d.milestones))
			talk(`${id}.milestones.${k}`, v ?? []);
		ok(d.chats.length >= 3, `${id}: only ${d.chats.length} chats`);
		for (const c of d.chats) {
			talk(`${id}.chats.${c.key}`, c.lines);
			ok(c.with !== id, `${id}.chats.${c.key}: with itself`);
			// with の 話は その仲間が 話す
			if (c.with)
				ok(
					c.lines.some((l) => l.who === c.with),
					`${id}.chats.${c.key}: ${c.with} never speaks`,
				);
			// 仲間が 近くに いなくても 1窓は 本人か 地の文
			ok(
				c.lines.some((l) => l.who === "mob" || l.who === null),
				`${id}.chats.${c.key}: only companions speak`,
			);
		}
		// 仲間が いなくても 見られる 雑談が ある（「！」の もと）
		ok(
			d.chats.some((c) => !c.with),
			`${id}: every chat needs a companion`,
		);
		if (d.thx.length) talk(`${id}.thx`, d.thx);
		for (const s of SEASONS) {
			const line = d.season[s];
			if (line) texts.push([`${id}.season.${s}`, line]);
		}
		for (const [k, v] of Object.entries(d.react))
			if (typeof v === "string") texts.push([`${id}.react.${k}`, v]);
		d.react.by?.forEach((b, i) => {
			texts.push([`${id}.react.by[${i}]`, b.text]);
		});
		MOB_GAGS[id].forEach((g, i) => {
			talk(`${id}.gag[${i}]`, g);
			ok(
				g.every((l) => l.who === "mob" || l.who === "kiriko" || l.who === null),
				`${id}.gag[${i}]: only the mob, Kiriko and the narrator`,
			);
		});
		const idle = typeof d.idle === "string" ? [d.idle] : d.idle;
		ok(idle.length === 1 || idle.length === 7, `${id}: idle by weekday`);
		idle.forEach((l, i) => {
			texts.push([`${id}.idle[${i}]`, l]);
		});
	}
	for (const [k, v] of Object.entries(SENKYO))
		texts.push([`SENKYO.${k}`, fill(v, { name: "おんすちゃん" })]);
	fitsWindow(texts);
});

test("住人の 声: 音源の ある子（春音リノ・響化アル）だけ 読み上げ、その 音源も 取ってくる", async () => {
	ok(
		VOICE_MODELS.includes("rino") && VOICE_MODELS.includes("hibika_aru"),
		`VOICE_MODELS: ${VOICE_MODELS.join()}`,
	);
	ok(
		MOB_IDS.filter((id) => MOB_VOICE[id]).join() === "rino,aru",
		"only リノ and アル have a voice among the residents",
	);
	await withStorageAsync(async () => {
		// みんな 帰ってきた 町（名前を 呼ぶ 仲間が いないと その 行は とばす）
		setProgress([...DUNGEON_IDS], [], [...DUNGEON_IDS]);
		putTown({ stage: 7 });
		for (const id of MOB_IDS) {
			const t = fakeStory({ near: ["nanj"] });
			const said: (SayOptions | undefined)[] = [];
			const say = t.s.say;
			t.s.say = async (who, text, opt) => {
				said.push(opt);
				await say(who, text, opt);
			};
			await mobScript(id)(t.s);
			const own = said.filter(
				(o) => o?.name === (MOBS[id].label ?? MOBS[id].name),
			);
			ok(own.length > 0, `${id}: never spoke`);
			for (const o of own) {
				ok(
					o?.tts?.model === MOB_VOICE[id]?.model,
					`${id}: tts ${o?.tts?.model}`,
				);
				ok(o?.color === MOBS[id].color, `${id}: color ${o?.color}`);
			}
		}
	});
});

/** 今日が 期間限定なら その子の ひとこと（反応・いつもの より 先に 出る）。 */
const seasonalToday = (d: (typeof MOBS)[keyof typeof MOBS]): string | null => {
	const s = season();
	return (s && d.season[s]) || null;
};

test("a mob: hello first, then one new talk per return, then a reaction and the usual line", async () => {
	await withStorageAsync(async () => {
		// フェリスは 離島板で 帰ってきて いる
		setProgress(["shallow", "main"], [], ["tropical"]);
		putTown({ stage: 7 });
		const id = "ngoane";
		const d = MOBS[id];
		const plain = (line: string) => `say null: ${seasonalToday(d) ?? line}`;
		ok(!hasMobNews(id), "「！」 before meeting");
		const a = fakeStory({ near: ["feris"] });
		await mobScript(id)(a.s);
		ok(
			a.log[0] === `say null: ${d.meet[0]?.text}` &&
				a.log[2] === `say feris: ${d.meet[2]?.text}`,
			`meet:\n${a.log.join("\n")}`,
		);
		ok(!hasMobNews(id), "「！」 stays after meeting");
		// 同じ 帰りの あいだは 新しい話は 出ない（まだ もぐっていないので 反応も ない）
		const b = fakeStory();
		await mobScript(id)(b.s);
		ok(b.log.join() === plain(idleOf(d)), `same return:\n${b.log.join("\n")}`);
		// 帰ってきた：新しい話（フェリスが 近くに いないので フェリスとの 話は とばす）
		pushRecord({ kind: "dead", cause: "おなかがすいてたおれた" });
		ok(hasMobNews(id), "no 「！」 after a return");
		const c = fakeStory();
		await mobScript(id)(c.s);
		const plainChat = d.chats.find((x) => !x.with);
		ok(
			c.log[0] === `say null: ${plainChat?.lines[0]?.text}` &&
				!c.log.some((l) => l.startsWith("say feris")),
			`plain chat:\n${c.log.join("\n")}`,
		);
		ok(!hasMobNews(id), "「！」 stays after the new talk");
		// 次は 前の冒険への 反応、ボケ（1回の 帰りに 1本）、そのあと いつもの
		const e = fakeStory();
		await mobScript(id)(e.s);
		ok(e.log.join() === plain(reactionOf(d) ?? ""), `reaction: ${e.log}`);
		const gag = fakeStory();
		await mobScript(id)(gag.s);
		ok(
			seasonalToday(d) !== null ||
				gag.log[0] === `say null: ${MOB_GAGS[id][0]?.[0]?.text}`,
			`gag:\n${gag.log.join("\n")}`,
		);
		const f = fakeStory();
		await mobScript(id)(f.s);
		ok(f.log.join() === plain(idleOf(d)), `idle: ${f.log.join()}`);
		// 次の 帰り：フェリスが 近ければ フェリスとの 話
		pushRecord({ kind: "clear", dungeon: "shallow" });
		const g = fakeStory({ near: ["feris"] });
		await mobScript(id)(g.s);
		ok(
			g.log[0] === `say feris: ${d.chats[0]?.lines[0]?.text}`,
			`with feris:\n${g.log.join("\n")}`,
		);
		// 長湯スレを 持ち帰ったら 節目が 先
		setProgress(["shallow", "main"], [], ["shallow", "main", "tropical"]);
		pushRecord({ kind: "clear", dungeon: "main" });
		const h = fakeStory();
		await mobScript(id)(h.s);
		ok(
			h.log[0] === `say null: ${d.milestones.main?.[0]?.text}`,
			`milestone:\n${h.log.join("\n")}`,
		);
		ok(reactionOf(d) === d.react.clear, "reaction to a clear");
		// 見た話は くり返さない（ぜんぶ 見たら 反応か 期間限定）
		const heard = new Set<string>();
		for (let i = 0; i < 12; i++) {
			pushRecord({ kind: "escape" });
			const t = fakeStory({ near: ["feris", "nanj", "shiyo"] });
			await mobScript(id)(t.s);
			const first = t.log[0] ?? "";
			ok(
				!heard.has(first) || first === plain(d.react.escape),
				`repeated: ${first}`,
			);
			heard.add(first);
		}
		ok(!hasMobNews(id), "「！」 after every talk was heard");
	});
});

test("おんすちゃん asks until Kiriko writes, and the vote thanks the pick once", async () => {
	await withStorageAsync(async () => {
		putTown({ stage: 7 });
		const d = MOBS.onsu;
		const no = fakeStory({ pick: 1 });
		await mobScript("onsu")(no.s);
		ok(
			no.log.includes(`say null: ${d.ask?.no[0]?.text}`),
			`declined:\n${no.log.join("\n")}`,
		);
		ok(!hasMobNews("onsu"), "「！」 while she waits for a post");
		const yes = fakeStory({ pick: 0 });
		await mobScript("onsu")(yes.s);
		ok(
			yes.log[0] === `say null: ${d.ask?.lines[0]?.text}` &&
				yes.log.includes(`narrate: ${d.ask?.yes[0]?.text}`),
			`wrote:\n${yes.log.join("\n")}`,
		);
		// 1人だけでは はり紙は 出ない
		ok(!senkyoOpen(), "the poster is up with one candidate");
		await mobScript("nichie")(fakeStory().s);
		ok(senkyoOpen(), "no poster after meeting two");
		// 1票（候補は 表の順：にぃちぇ・おんすちゃん）
		const v = fakeStory({ pick: 0, near: ["zero"] });
		await senkyoScript(v.s);
		ok(
			v.log.includes(`narrate: ${fill(SENKYO.done, { name: "にぃちぇ" })}`) &&
				v.log.includes(`say zero: ${SENKYO.zero}`),
			`vote:\n${v.log.join("\n")}`,
		);
		const again = fakeStory();
		await senkyoScript(again.s);
		ok(
			again.log.includes(
				`narrate: ${fill(SENKYO.voted, { name: "にぃちぇ" })}`,
			) && !again.log.some((l) => l.startsWith("choose")),
			`voted twice:\n${again.log.join("\n")}`,
		);
		ok(hasMobNews("nichie"), "no 「！」 for the thanks");
		const t = fakeStory();
		await mobScript("nichie")(t.s);
		const thx = `say null: ${MOBS.nichie.thx[0]?.text}`;
		ok(t.log.join() === thx, `thanks:\n${t.log.join("\n")}`);
		const t2 = fakeStory();
		await mobScript("nichie")(t2.s);
		ok(!t2.log.includes(thx), "thanked twice");
	});
});

export const runVillageTests = async (): Promise<TestResult[]> => {
	const out: TestResult[] = [];
	// 小ネタは 運しだいで いつもの ひとことを 置きかえるので、試しでは 出さない
	const roll = tipDice.roll;
	tipDice.roll = () => 1;
	try {
		for (const c of CASES) {
			try {
				await c.run();
				out.push({ id: "village", name: c.name, ok: true });
			} catch (e) {
				out.push({
					id: "village",
					name: c.name,
					ok: false,
					reason: e instanceof Error ? e.message : String(e),
				});
			}
		}
	} finally {
		tipDice.roll = roll;
	}
	return out;
};

test("the very first village: Kiriko climbs the slope and knocks, walks to the plaza herself, the phonograph, やきう, a night, パン兵 and the headline, walking to the pier — once", async () => {
	const texts: [string, string][] = [];
	const text = (t: string | { text: string }) =>
		typeof t === "string" ? t : t.text;
	for (const [k, v] of Object.entries(OPENING))
		(Array.isArray(v) ? v : [v]).forEach((t, i) => {
			texts.push([`OPENING.${k}[${i}]`, text(t)]);
		});
	fitsWindow(texts);
	const say = (l: { who: string | null; text: string }) =>
		l.who === "kiriko"
			? `kiriko voice: ${l.text}`
			: l.who
				? `say ${l.who}: ${l.text}`
				: `narrate: ${l.text}`;
	await withStorageAsync(async () => {
		forgetOpeningMemo();
		setProgress(["shallow"]);
		ok(needsOpening(), "no opening on the first boot");
		// 幕が 上がる 前：坂の 下に 立ち、蓄音機・やきう・パン兵は まだ 無い
		const a = fakeStory();
		openingPrepare(a.s);
		ok(
			a.log.includes("place player 20,31") &&
				a.log.includes("hide phono") &&
				a.log.includes("hide nanj") &&
				a.log.includes("hide inc_panhei_chief"),
			`prepare:\n${a.log.join("\n")}`,
		);
		// ①：名のって 坂を 上がり、シャッターを たたく → 貼り紙 → 自分で 歩く
		await openingScript(a.s);
		ok(
			inOrder(a.log, [
				say(OPENING.climb[0]),
				"se hit_fist",
				`narrate: ${OPENING.notice}`,
				say(OPENING.closed),
			]) && !a.log.some((l) => l.startsWith("say nanj")),
			`slope:\n${a.log.join("\n")}`,
		);
		ok(openingWalking(), "Kiriko cannot walk after the slope");
		// 部屋に 出入りして 建てなおしても、坂の 下へ もどされず、①も くり返さない
		const re = fakeStory({ at: [5, 5] });
		openingPrepare(re.s);
		await openingScript(re.s);
		ok(
			!re.log.some((l) => l.startsWith("place player")) &&
				re.log.includes("hide nanj") &&
				!re.log.some((l) => l.startsWith("kiriko")),
			`rebuilt while walking:\n${re.log.join("\n")}`,
		);
		// ②：広場より 先に 村を 出ようと すると 引きかえす。広場の 外では 何も 起きない
		const no = fakeStory();
		await openingNotYet(no.s, "u");
		ok(
			no.log.join() === `${say(OPENING.notYet)},move player u`,
			`exit: ${no.log}`,
		);
		ok(openingStep(20, 29) === null, "the scene starts on the slope");
		// ③④⑤：広場に 入ると
		const run = openingStep(19, 24);
		ok(!!run, "nothing happens in the plaza");
		const b = fakeStory({ at: [19, 24] });
		await run?.(b.s);
		const [ex, ey] = VILLAGE_SPOTS.exit;
		ok(
			b.s.state.x === ex && b.s.state.y === ey - 2,
			`Kiriko stops at (${b.s.state.x},${b.s.state.y}), not on the pier`,
		);
		ok(
			inOrder(b.log, [
				"show phono",
				say(OPENING.nobody),
				"show nanj",
				...OPENING.day1.map(say),
				say(OPENING.sleep),
				say(OPENING.wake),
				"show inc_panhei_chief",
				`say nanj: ${OPENING.panhei}`,
				say(OPENING.someone),
				...OPENING.day2.map(say),
				"se hit_fist",
				...OPENING.day2b.map(say),
				`say nanj: ${OPENING.declare}`,
				...OPENING.day2c.map(say),
				...OPENING.mouth.map((t) => `say nanj: ${t}`),
				...OPENING.rules.map(say),
				...OPENING.wish.map(say),
				...OPENING.walk.map(say),
				say(OPENING.farewell),
				`narrate: ${OPENING.goal[0]}`,
			]),
			`plaza:\n${b.log.join("\n")}`,
		);
		ok(!needsOpening(), "the opening plays twice");
		ok(
			!openingWalking() && !openingStep(19, 24),
			"the plaza scene plays twice",
		);
	});
	await withStorageAsync(async () => {
		setProgress(["shallow"]);
		pushRecord({});
		ok(!needsOpening(), "the opening plays after a run");
	});
});

// ───────────────── ぷゆゆ（はじめから いる 子。data/people/mobs.ts の MOBS.puyu） ─────────────────

/** 図鑑を 置く（会った 敵の id と たおした 数）。 */
const setBook = (seen: string[], kills: Record<string, number> = {}): void =>
	localStorage.setItem(
		"kiriko-roguelike/book",
		JSON.stringify({ seen, kills }),
	);

/** 何も ない 帰りの 手がかり。 */
const BARE: MobCtx = {
	last: null,
	seen: [],
	met: [],
	talked: [],
	today: { m: 3, d: 3, w: 3 },
};

/** fakeStory の 記録で その窓が どう 見えるか（ぷゆゆの 声は やきうの 色、ほかの子は 色なし）。 */
const logOf = (id: MobId, l: MobLine): string => {
	if (l.who === null) return `narrate: ${l.text}`;
	if (l.who === "kiriko") return `kiriko voice: ${l.text}`;
	const mob: MobId | null =
		l.who === "mob" ? id : l.who in MOBS ? (l.who as MobId) : null;
	if (mob === null) return `say ${l.who}: ${l.text}`;
	return `say ${MOBS[mob].voice ?? null}: ${l.text}`;
};

test("ぷゆゆ・マイナーズ: every conditional talk and reaction can happen, and none is always on", () => {
	const every = MOB_IDS.flatMap((id) =>
		MOBS[id].chats.map((c) => `${id}:${c.key}`),
	);
	const rich: MobCtx[] = [];
	for (let m = 1; m <= 12; m++)
		for (let w = 0; w < 7; w++)
			for (const [cause, depth, returning] of [
				["ぷゆゆにたおされた", 1, false],
				["メタルぷゆゆにたおされた", 12, false],
				["おなかがすいてたおれた", 9, false],
				["コピペにたおされた", 15, true],
				["忘れスレの霊にたおされた", 2, false],
			] as const)
				rich.push({
					last: { kind: "dead", cause, depth, returning },
					seen: ["tousuko", "metal", "hijacker"],
					met: [...MOB_IDS],
					talked: every,
					today: { m, d: 25, w },
				});
	for (const id of MOB_IDS) {
		const d = MOBS[id];
		const conds: [string, (x: MobCtx) => boolean][] = [
			...d.chats.flatMap((c): [string, (x: MobCtx) => boolean][] =>
				c.when ? [[`chats.${c.key}`, c.when]] : [],
			),
			...(d.react.by ?? []).map((b, i): [string, (x: MobCtx) => boolean] => [
				`react.by[${i}]`,
				b.when,
			]),
		];
		for (const [k, when] of conds) {
			ok(rich.some(when), `${id}.${k}: never happens`);
			ok(!when(BARE), `${id}.${k}: always happens (drop when)`);
		}
	}
});

test("ぷゆゆ: rpg voice rules (🥺🤪✋ only, one 🥺 at a line end, rare plain speech, no AVOID words)", () => {
	const EMOJI = /\p{Extended_Pictographic}/u;
	const ALLOWED = new Set(["🥺", "🤪", "✋"]);
	const hers: [string, string][] = [];
	const rest: [string, string][] = [];
	for (const id of MOB_IDS) {
		const d = MOBS[id];
		const talks: [string, readonly MobLine[]][] = [
			["meet", d.meet],
			["thx", d.thx],
			...Object.entries(d.milestones).map(
				([k, v]): [string, readonly MobLine[]] => [`@${k}`, v ?? []],
			),
			...d.chats.map((c): [string, readonly MobLine[]] => [c.key, c.lines]),
			...MOB_GAGS[id].map((g, i): [string, readonly MobLine[]] => [
				`gag${i}`,
				g,
			]),
		];
		if (d.ask)
			talks.push(
				["ask", d.ask.lines],
				["ask.yes", d.ask.yes],
				["ask.no", d.ask.no],
			);
		for (const [k, ls] of talks)
			ls.forEach((l, i) => {
				const mine = (id === "puyu" && l.who === "mob") || l.who === "puyu";
				(mine ? hers : rest).push([`${id}.${k}[${i}]`, l.text]);
			});
		const single = [
			...Object.values(d.season),
			...Object.values(d.react).filter(
				(v): v is string => typeof v === "string",
			),
			...(d.react.by ?? []).map((b) => b.text),
			...(typeof d.idle === "string" ? [d.idle] : d.idle),
		];
		for (const t of single)
			(id === "puyu" ? hers : rest).push([`${id}.line`, t]);
	}
	// お弁当の ひとことも ぷゆゆの 声
	PUYU_LUNCH.forEach((t, i) => {
		hers.push([`PUYU_LUNCH[${i}]`, t]);
	});
	for (const [where, t] of [...hers, ...rest]) {
		// 肌の 色の 件（rpg の 決まり）
		for (const w of ["黄色", "きいろ", "山吹"])
			ok(!t.includes(w), `${where}: "${w}"`);
		ok(!/[️‍]/u.test(t), `${where}: FE0F / ZWJ`);
	}
	// キリコ・地の文・仲間・ほかの子には 絵文字を つけない（ミャウミャウの 口癖「ぷゆゆ🥺」は 行の 終わりに だけ）
	const MIAU = /(^|\n)(……)?ぷゆゆ🥺$/;
	for (const [where, t] of rest)
		ok(
			!EMOJI.test(t) ||
				(where.startsWith("miaumiau.") &&
					MIAU.test(t) &&
					!EMOJI.test(t.replace(MIAU, ""))),
			`${where}: emoji outside ぷゆゆ's own lines`,
		);
	let plain = 0;
	let ikite = 0;
	for (const [where, t] of hers) {
		for (const ch of t)
			if (EMOJI.test(ch)) ok(ALLOWED.has(ch), `${where}: ${ch}`);
		// ぷゆゆを 食べ物に しない・キリコは「きみ」
		for (const w of ["豆腐", "麻婆", "キリコちゃん"])
			ok(!t.includes(w), `${where}: "${w}"`);
		ok(
			[...t].filter((ch) => ch === "🥺").length <= 1,
			`${where}: more than one 🥺`,
		);
		const ls = t.split("\n");
		ok(
			!(ls.length === 2 && EMOJI.test(ls[0] ?? "") && EMOJI.test(ls[1] ?? "")),
			`${where}: emoji on both lines`,
		);
		for (const l of ls) {
			const cs = [...l];
			const i = cs.findIndex((ch) => EMOJI.test(ch));
			ok(
				i < 0 || cs.slice(i).every((ch) => EMOJI.test(ch)),
				`${where}: emoji inside "${l}"`,
			);
			ok(
				i < 0 || width(l) <= 21,
				`${where}: emoji line "${l}" is ${width(l)} wide`,
			);
		}
		// 標準語の ひとこと（「……」で 始まり「。」で 終わる。絵文字なし）は まれに
		if (t.startsWith("……") && t.endsWith("。") && !EMOJI.test(t)) plain++;
		else ok(EMOJI.test(t), `${where}: baby talk without 🥺`);
		if (t.includes("生きてこそだ")) ikite++;
	}
	ok(plain <= 3, `${plain} plain-speech lines (3 at most)`);
	ok(ikite <= 2, `生きてこそだ ${ikite} times (2 at most)`);
});

test("ぷゆゆ・マイナーズ: Kiriko joins the talk with ンゴ and never says 保守", () => {
	let n = 0;
	for (const id of MOB_IDS) {
		const d = MOBS[id];
		const all: [string, MobLine][] = [
			...d.meet.map((l): [string, MobLine] => ["meet", l]),
			...Object.values(d.milestones)
				.flatMap((v) => v ?? [])
				.map((l): [string, MobLine] => ["milestone", l]),
			...(d.ask ? [...d.ask.lines, ...d.ask.yes, ...d.ask.no] : []).map(
				(l): [string, MobLine] => ["ask", l],
			),
			...d.thx.map((l): [string, MobLine] => ["thx", l]),
			...d.chats.flatMap((c) =>
				c.lines.map((l): [string, MobLine] => [c.key, l]),
			),
		];
		for (const [key, l] of all) {
			if (l.who !== "kiriko") continue;
			n++;
			ok(!l.text.includes("保守"), `${id}.${key}: Kiriko says 保守`);
			ok(l.text.includes("ンゴ"), `${id}.${key}: Kiriko without ンゴ`);
		}
	}
	ok(n > 0, "Kiriko never speaks in chats");
	// 喫茶でも 同じ（仲間の 話は kiriko: "voice"、住人の 話は who: "kiriko"）
	const cafe: [string, string][] = [
		...[...CAFE_TALKS, ...TREAT_TALKS].flatMap((t) =>
			t.lines
				.filter((l) => l.kiriko === "voice")
				.map((l): [string, string] => [t.id, l.text]),
		),
		...MOB_IDS.flatMap((id) =>
			CAFE_MOBS[id].talks.flatMap((t) =>
				t.lines
					.filter((l) => l.who === "kiriko")
					.map((l): [string, string] => [`${id}:${t.key}`, l.text]),
			),
		),
	];
	ok(cafe.length > 0, "Kiriko never speaks in the cafe");
	for (const [where, text] of cafe) {
		ok(!text.includes("保守"), `cafe ${where}: Kiriko says 保守`);
		ok(text.includes("ンゴ"), `cafe ${where}: Kiriko without ンゴ`);
	}
});

test("ぷゆゆ・マイナーズ: small moves are few,come before the mob's own or narration window, and stay near home", () => {
	let n = 0;
	for (const id of MOB_IDS) {
		const d = MOBS[id];
		const all: [string, MobLine][] = [
			...d.meet.map((l, i): [string, MobLine] => [`meet[${i}]`, l]),
			...Object.entries(d.milestones).flatMap(([k, v]) =>
				(v ?? []).map((l, i): [string, MobLine] => [`@${k}[${i}]`, l]),
			),
			...d.chats.flatMap((c) =>
				c.lines.map((l, i): [string, MobLine] => [`${c.key}[${i}]`, l]),
			),
		];
		for (const [where, l] of all) {
			const bt = l.beat;
			if (!bt) continue;
			n++;
			ok(
				l.who === "mob" || l.who === null,
				`${id}.${where}: a move on someone else's window`,
			);
			if (bt.k === "turn")
				ok(/^[UDLRw]+$/.test(bt.route), `${id}.${where}: a turn that walks`);
			if (bt.k !== "walk") continue;
			// 家の まわり 2マスの 中（うろうろの 範囲。外へ 出ると 建て直すまで もどれない）
			const [x, y] = bt.to;
			ok(
				gaitRange(d.gait) >= 2 &&
					Math.abs(x - d.spot[0]) <= 2 &&
					Math.abs(y - d.spot[1]) <= 2,
				`${id}.${where}: (${x},${y}) is outside the wander box`,
			);
			ok(
				!(x === VILLAGE_SPOTS.boot[0] && y === VILLAGE_SPOTS.boot[1]),
				`${id}.${where}: onto the boot spot`,
			);
			for (const v of VIEWS) {
				const s = survey(v);
				const taken = s.places.some(
					(p) => p.sprite && !p.wander && p.x === x && p.y === y,
				);
				ok(
					!!s.tile(x, y)?.passable && !taken,
					`${label(v)} ${id}.${where}: cannot stand on (${x},${y})`,
				);
			}
		}
	}
	ok(n <= 4, `${n} small moves (4 at most)`);
});

// ───────────────── 住人の 歩き方と 広場の 顔ぶれ（data/village/mobGait.ts・data/people/mobs.ts の squareOut） ─────────────────

/** 決まった 乱数（試験を くり返しても 同じ）。 */
const seededRng = (seed: number) => {
	let s = seed;
	return () => {
		s = (s * 16807) % 2147483647;
		return s / 2147483647;
	};
};

test("住人の 歩き方: movers have room around home on every stage, look-only mobs never leave, steps stay in range", () => {
	for (const v of VIEWS) {
		const s = survey(v);
		for (const id of MOB_IDS) {
			const d = MOBS[id];
			const r = gaitRange(d.gait);
			const cells = roamCells(v, d.spot, r);
			if (!r) {
				ok(!cells.length && !gaitMoves(d.gait), `${id}: a still mob roams`);
				continue;
			}
			ok(cells.length >= 3, `${label(v)} ${id}: only ${cells.length} cells`);
			for (const [x, y] of cells) {
				ok(
					Math.max(Math.abs(x - d.spot[0]), Math.abs(y - d.spot[1])) <= r,
					`${id}: (${x},${y}) is out of range`,
				);
				ok(!!s.tile(x, y)?.passable, `${label(v)} ${id}: (${x},${y}) wall`);
				ok(
					!s.places.some(
						(p) =>
							p.x === x && p.y === y && (p.sprite || p.trigger === "touch"),
					),
					`${label(v)} ${id}: (${x},${y}) is taken`,
				);
				ok(
					!(x === VILLAGE_SPOTS.boot[0] && y === VILLAGE_SPOTS.boot[1]),
					`${id}: onto the boot spot`,
				);
			}
		}
	}
	const v = VIEWS[VIEWS.length - 1];
	for (const id of MOB_IDS) {
		const d = MOBS[id];
		if (!d.gait) continue;
		const cells = roamCells(v, d.spot, gaitRange(d.gait));
		const roam = mobRoam(id, d.gait, d.spot, d.dir, cells, seededRng(7));
		let at = { x: d.spot[0], y: d.spot[1] };
		let moved = 0;
		let home = 0;
		for (let i = 0; i < 60; i++) {
			const st = roam(at);
			ok(st.wait > 0, `${id}: wait ${st.wait}`);
			if (d.gait === "look") {
				ok(!st.to && !!st.face, `${id}: a look mob walks`);
				continue;
			}
			const to = st.to;
			ok(!!to, `${id}: no destination`);
			if (!to) continue;
			const atHome = to[0] === d.spot[0] && to[1] === d.spot[1];
			ok(
				atHome || cells.some((c) => c[0] === to[0] && c[1] === to[1]),
				`${id}: (${to.join(",")}) is not a roam cell`,
			);
			// 持ち場へ もどったら いつもの 向き
			if (atHome) {
				ok(st.face === d.dir, `${id}: home but facing ${st.face}`);
				home++;
			} else moved++;
			at = { x: to[0], y: to[1] };
		}
		if (d.gait !== "look")
			ok(moved >= 30 && home >= 3, `${id}: moved ${moved}, home ${home}`);
	}
});

test("広場の 顔ぶれ: the same return rolls the same, staff stay, facility guests leave, about a fifth of the rest go out", () => {
	const once = squareOut(MOB_IDS, 1234, []).join();
	const twice = squareOut(MOB_IDS, 1234, []).join();
	ok(once === twice, "the same return rolled twice differently");
	const rest = MOB_IDS.filter((id) => !MOB_STAY.includes(id) && id !== "ren");
	let out = 0;
	for (let at = 1; at <= 400; at++) {
		const o = squareOut(MOB_IDS, at, ["ren", "hinary"]);
		ok(!o.some((id) => MOB_STAY.includes(id)), `${at}: staff out`);
		ok(o.includes("ren"), `${at}: a guest is still in the square`);
		out += o.filter((id) => id !== "ren").length;
	}
	const rate = out / (400 * rest.length);
	ok(Math.abs(rate - OUT_RATE) < 0.04, `out rate ${rate.toFixed(2)}`);
	const places = villagePlaces({
		stage: TOWN_STAGES - 1,
		unlocked: [...DUNGEON_IDS],
		cleared: [...DUNGEON_IDS],
		mobsOut: ["ren", "onchan"],
	});
	ok(
		!places.some((p) => p.mob === "ren" || p.mob === "onchan") &&
			places.some((p) => p.mob === "nichie"),
		"mobsOut is not honoured",
	);
});

test("広場の 顔ぶれ: decided once per return and kept; unmet mobs and mobs with news stay", async () => {
	await withStorageAsync(async () => {
		forgetMobMemo();
		setProgress([...DUNGEON_IDS], [], [...DUNGEON_IDS]);
		putTown({ stage: TOWN_STAGES - 1 });
		// まだ もぐって いない：みんな いる
		ok(!villageView().mobsOut?.length, "out before the first run");
		pushRecord({});
		const v = villageView();
		// だれにも 会っていない：みんな いる
		ok(!mobsOutNow(v).length, "unmet mobs went out");
		// みんなに 会って、話も ぜんぶ 聞いた
		const seen = MOB_IDS.flatMap((id) => [
			...["shallow", "main", "deep", "runs10"].map((ms) => `${id}:@${ms}`),
			...MOBS[id].chats.map((c) => `${id}:${c.key}`),
		]);
		localStorage.setItem(
			"kiriko-roguelike/mobs",
			JSON.stringify({ met: MOB_IDS, seen, wrote: true }),
		);
		forgetMobMemo();
		let first: MobId[] = [];
		for (let i = 0; i < 6 && !first.length; i++) {
			pushRecord({});
			first = mobsOutNow(villageView());
		}
		ok(first.length > 0, "nobody ever goes out");
		ok(!first.some((id) => MOB_STAY.includes(id)), "staff went out");
		ok(
			first.join() === mobsOutNow(villageView()).join() &&
				villageView().mobsOut?.join() === first.join(),
			"the roster changed within one return",
		);
		// 読みなおしても（この回の 写しを 忘れても）同じ
		forgetMobMemo();
		ok(
			first.join() === mobsOutNow(villageView()).join(),
			"the roster was lost on reload",
		);
		// 出かけた 子に 新しい話が できても、この 帰りは そのまま（次の 帰りからは 広場に 残る）
		const who = first[0];
		localStorage.setItem(
			"kiriko-roguelike/mobs",
			JSON.stringify({
				met: MOB_IDS,
				seen: seen.filter((k) => !k.startsWith(`${who}:`)),
				wrote: true,
				out: { at: loadRecords()[0]?.at, ids: first },
			}),
		);
		forgetMobMemo();
		ok(hasMobNews(who), `${who} has no news`);
		ok(mobsOutNow(villageView()).includes(who), `${who} came back mid-return`);
		for (let i = 0; i < 8; i++) {
			pushRecord({});
			ok(!mobsOutNow(villageView()).includes(who), `${who} went out with news`);
		}
	});
});

test("ぷゆゆ: there from the first visit with the やきう name bar, not a candidate, answers the last run once", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow"]);
		putTown({ stage: 0 });
		const d = MOBS.puyu;
		const said = (t: string | undefined) => `say nanj: ${t}`;
		const chat = (k: string) => d.chats.find((c) => c.key === k)?.lines ?? [];
		const place = villagePlaces(villageView()).find((p) => p.mob === "puyu");
		ok(
			place?.x === 17 && place.y === 23 && place.wander === true,
			`stage 0: ${JSON.stringify(place)}`,
		);
		ok(!hasMobNews("puyu"), "「！」 on the very first visit");
		// 段0 には ゼロは まだ 越してきていない：そばに いても ゼロの 口出しは 出ない
		const a = fakeStory({ near: ["zero"] });
		await mobScript("puyu")(a.s);
		ok(
			a.log[0] === said(d.meet[0]?.text) &&
				!a.log.includes(`say zero: ${d.meet[3]?.text}`),
			`meet:\n${a.log.join("\n")}`,
		);
		// マイナーズでは ない：ぷゆゆ ＋ 1人では はり紙は 出ない
		await mobScript("nichie")(fakeStory().s);
		ok(!senkyoOpen(), "ぷゆゆ counts as a 総選挙 candidate");
		// 1回目の 帰り：B1 で たおれた → 早すぎる 帰りの 話。反応を かねるので 次は いつもの ひとこと
		setBook(["tousuko"]);
		pushRecord({ kind: "dead", cause: "忘れスレの霊にたおされた", depth: 1 });
		ok(hasMobNews("puyu"), "no 「！」 after an early fall");
		const b = fakeStory();
		await mobScript("puyu")(b.s);
		ok(
			b.log[0] === said(chat("hayai")[0]?.text),
			`early fall:\n${b.log.join("\n")}`,
		);
		// 反応は もう 出さない（ボケが 1本、そのあと いつもの）
		const b2 = fakeStory();
		await mobScript("puyu")(b2.s);
		ok(
			seasonalToday(d) !== null ||
				b2.log[0] === said(MOB_GAGS.puyu[0]?.[0]?.text),
			`the same fall answered twice:\n${b2.log.join("\n")}`,
		);
		const b3 = fakeStory();
		await mobScript("puyu")(b3.s);
		ok(
			b3.log.join() === said(seasonalToday(d) ?? idleOf(d)),
			`idle after the gag:\n${b3.log.join("\n")}`,
		);
		// 2回目：下で 会った 子の 話（図鑑に ぷゆゆ）
		pushRecord({ kind: "dead", cause: "コピペにたおされた", depth: 6 });
		const c = fakeStory();
		await mobScript("puyu")(c.s);
		ok(
			c.log[0] === said(chat("nakama")[0]?.text),
			`nakama:\n${c.log.join("\n")}`,
		);
		// 3回目：ぷゆゆに たおされた（前の版の 名前の 記録でも）→ 標準語の ひとこと
		pushRecord({ kind: "dead", cause: "とうすこにたおされた", depth: 2 });
		const e = fakeStory();
		await mobScript("puyu")(e.s);
		ok(
			e.log.includes(said(chat("maketa")[1]?.text)),
			`lost to ぷゆゆ:\n${e.log.join("\n")}`,
		);
		// たおれ方ごとの 反応（メタルが 先。前の版の 名前でも）
		for (const [cause, depth, i] of [
			["メタルぷゆゆにたおされた", 12, 0],
			["メタルとうすこにたおされた", 12, 0],
			["ぷゆゆにたおされた", 1, 1],
			["とうすこにたおされた", 2, 1],
			["忘れスレの霊にたおされた", 2, 3],
		] as const) {
			pushRecord({ kind: "dead", cause, depth });
			ok(
				reactionOf(d) === d.react.by?.[i]?.text,
				`reaction to ${cause}: ${reactionOf(d)}`,
			);
		}
		pushRecord({
			kind: "dead",
			cause: "コピペにたおされた",
			depth: 15,
			returning: true,
		});
		ok(reactionOf(d) === d.react.by?.[2]?.text, "no reaction on the way back");
		pushRecord({ kind: "dead", cause: "おなかがすいてたおれた", depth: 8 });
		ok(reactionOf(d) === d.react.starve, "no reaction to hunger");
		pushRecord({ kind: "escape" });
		ok(reactionOf(d) === d.react.escape, "no reaction to an escape");
	});
});

test("ぷゆゆ: one new talk per return in array order, mob pairs only when both are near, callbacks after their setup", async () => {
	await withStorageAsync(async () => {
		// シヨは きのこ板・フェリスは 離島板で 帰ってきて いる（名前を 呼ぶ 話も 出る）
		setProgress(["shallow", "main"], [], ["shallow", "kinoko", "tropical"]);
		putTown({ stage: 7 });
		setBook(["tousuko", "metal"]);
		for (const id of MOB_IDS) await mobScript(id)(fakeStory().s);
		const first = (id: MobId, k: string): string => {
			const l = MOBS[id].chats.find((c) => c.key === k)?.lines[0];
			return l ? logOf(id, l) : "?";
		};
		const talkMany = async (
			id: MobId,
			near: string[],
			times: number,
		): Promise<string[]> => {
			const out: string[] = [];
			for (let i = 0; i < times; i++) {
				pushRecord({ kind: "escape" });
				const t = fakeStory({ near });
				await mobScript(id)(t.s);
				out.push(...t.log);
			}
			return out;
		};
		// パン松 ↔ ぷゆゆ：ぷゆゆが 近くに いなければ 出ない
		const panLine = MOBS.panmatsu.chats.find((c) => c.key === "puyu")?.lines[1];
		const pan = panLine ? logOf("panmatsu", panLine) : "?";
		ok(
			!(await talkMany("panmatsu", ["roze", "nanj", "zero"], 8)).includes(pan),
			"パン松 talked with a ぷゆゆ who was not near",
		);
		ok(
			(await talkMany("panmatsu", ["mob_puyu"], 2)).includes(pan),
			"パン松 never talked with ぷゆゆ",
		);
		// ンゴ姉・おんすちゃんの あとの 話は、ぷゆゆの 話を 聞くまで 出ない
		const ngo = first("ngoane", "puyu");
		const onsu = first("onsu", "puyu");
		ok(
			!(await talkMany("ngoane", [], 8)).includes(ngo),
			"ンゴ姉 heard about the 図鑑 too early",
		);
		ok(
			!(await talkMany("onsu", [], 8)).includes(onsu),
			"おんすちゃん heard about the tea too early",
		);
		// ぷゆゆ：みんな 近くに いれば、雑談は 上から 1回ずつ（節目が あいだに 入る）
		const near = [
			"zero",
			"shiyo",
			"roze",
			"nanj",
			"feris",
			"mob_nichie",
			"mob_panmatsu",
			"mob_onchan",
		];
		const logs: string[][] = [];
		for (let i = 0; i < 40; i++) {
			pushRecord({ kind: "escape" });
			const t = fakeStory({ near });
			await mobScript("puyu")(t.s);
			logs.push(t.log);
		}
		let last = -1;
		for (const ch of MOBS.puyu.chats) {
			const f = first("puyu", ch.key);
			const at = logs
				.map((l, i) => (l.includes(f) ? i : -1))
				.filter((i) => i >= 0);
			ok(at.length <= 1, `puyu.${ch.key} played ${at.length} times`);
			if (!at.length) {
				// 出なかったのは その日・前の冒険に 合わない 話だけ
				ok(!!ch.when, `puyu.${ch.key} never played`);
				continue;
			}
			ok((at[0] ?? 0) > last, `puyu.${ch.key} played out of order`);
			last = at[0] ?? last;
		}
		ok(
			logs.some((l) => l.includes("goto mob_puyu 17,23")),
			"ぷゆゆ never toddled home (zukan)",
		);
		ok(!hasMobNews("puyu"), "「！」 after every talk was heard");
		ok(
			(await talkMany("ngoane", [], 3)).includes(ngo),
			"ンゴ姉 never mentioned the 図鑑",
		);
		ok(
			(await talkMany("onsu", [], 3)).includes(onsu),
			"おんすちゃん never set out the cup",
		);
	});
});

test("old records and replays that say とうすこ read as ぷゆゆ and still pair up", () => {
	withStorage(() => {
		const cause = "メタルとうすこにたおされた";
		pushRecord({ kind: "dead", cause, depth: 9, turn: 321, seed: "old-1" });
		localStorage.setItem(
			"kiriko-roguelike/replays",
			JSON.stringify([
				{
					seed: "old-1",
					dungeon: "main",
					at: 1,
					builds: [],
					text: "",
					n: 0,
					kind: "dead",
					depth: 9,
					turn: 321,
					cause,
				},
			]),
		);
		const r = loadRecords()[0];
		const p = loadReplays()[0];
		ok(r?.cause === "メタルぷゆゆにたおされた", `record: ${r?.cause}`);
		ok(
			!!r && !!p && p.cause === r.cause && replayMatches(p, r),
			"the old replay lost its record",
		);
	});
});

test("old records with the renamed monsters read with the new names", () => {
	withStorage(() => {
		for (const [old, now] of [
			["ひとだまにたおされた", "忘れスレの霊にたおされた"],
			["dat落ちの霊にたおされた", "忘れスレの霊にたおされた"],
			["ばくだんの爆発に巻きこまれた", "炎上案件の爆発に巻きこまれた"],
			["ゴーレムに吹きとばされた", "論破厨に吹きとばされた"],
			["ゴリラに吹きとばされた", "論破厨に吹きとばされた"],
			["凍結アカにたおされた", "VIPPERにたおされた"],
			["フナムシにたおされた", "ROM専にたおされた"],
			["バグにたおされた", "ROM専にたおされた"],
			["深夜テンションにたおされた", "夏休みキッズにたおされた"],
			["過疎にたおされた", "かまってちゃんにたおされた"],
			// 影 は 1文字なので「影に」だけ 読みかえる
			["影にたおされた", "透明あぼーんにたおされた"],
		] as const) {
			pushRecord({ kind: "dead", cause: old, depth: 9, turn: 1, seed: old });
			const r = loadRecords()[0];
			ok(r?.cause === now, `${old} → ${r?.cause}`);
		}
	});
});

test("boss causes are not rewritten by the old-name renames, and boss records and replays still pair up", () => {
	withStorage(() => {
		const replays: SavedReplay[] = [];
		for (const d of DUNGEON_IDS) {
			const cause = DUNGEONS[d].boss?.cause;
			if (!cause) continue;
			const depth = DUNGEONS[d].floors;
			const seed = `boss-${d}`;
			pushRecord({
				kind: "clear",
				cause,
				depth,
				maxDepth: depth,
				turn: 1,
				seed,
				dungeon: d,
				objective: "boss",
			});
			const rp: SavedReplay = {
				seed,
				dungeon: d,
				objective: "boss",
				at: 1,
				builds: [],
				text: "",
				n: 0,
				kind: "clear",
				depth,
				turn: 1,
				cause,
			};
			replays.push(rp);
			// もらった リプレイ（共有）も 同じ 読み方
			ok(toReplay(rp)?.cause === cause, `${d}: shared ${toReplay(rp)?.cause}`);
		}
		localStorage.setItem("kiriko-roguelike/replays", JSON.stringify(replays));
		const records = loadRecords();
		const kept = loadReplays();
		for (const rp of replays) {
			const rec = records.find((r) => r.seed === rp.seed);
			const got = kept.find((p) => p.seed === rp.seed);
			ok(rec?.cause === rp.cause, `${rp.dungeon}: record ${rec?.cause}`);
			ok(got?.cause === rp.cause, `${rp.dungeon}: replay ${got?.cause}`);
			ok(
				!!rec && !!got && replayMatches(got, rec),
				`${rp.dungeon}: the boss replay lost its record`,
			);
		}
		ok(replays.length === 7, `harness: ${replays.length} boss boards`);
	});
});

test("a boss clear reads as a win plus how she got home with the item (records, shared replays), and the book shows the real floor", () => {
	for (const d of DUNGEON_IDS) {
		const b = DUNGEONS[d].boss;
		if (!b) continue;
		const def = MONSTERS[b.monster];
		const depth = DUNGEONS[d].floors;
		const where = floorShort(d, depth);
		// 図鑑：ボスは その板の いちばん奥の 階（上りの 板は F。floors は 強さなので 出さない）
		ok(
			floorsText(def) === `${where}（${DUNGEON_NAMES[d].name}のボス）`,
			`${d}: the book says ${floorsText(def)}`,
		);
		const home = bossHomeLine(d);
		ok(
			home.startsWith(`${defOf(DUNGEONS[d].goal).name}ごと、`) &&
				home.endsWith(BOSS_HOME[d] ?? "?"),
			`${d}: ${home}`,
		);
		const rec = {
			kind: "clear",
			cause: b.cause,
			depth,
			maxDepth: depth,
			returning: false,
			dungeon: d,
			objective: "boss",
			at: 1,
			lv: 9,
			turn: 99,
		} as const;
		ok(
			endLine(rec) === `${DUNGEON_NAMES[d].short}　${where}で${b.cause}`,
			`${d}: ${endLine(rec)}`,
		);
		ok(
			recordHead(rec).includes(`<br><small>${home}<br>`),
			`${d}: the record head lacks how she got home: ${recordHead(rec)}`,
		);
		const rp: SavedReplay = {
			seed: `boss-${d}`,
			dungeon: d,
			objective: "boss",
			at: 1,
			builds: [],
			text: "",
			n: 0,
			kind: "clear",
			depth,
			turn: 99,
			cause: b.cause,
		};
		const head = sharedHead(rp);
		ok(
			head.includes(`${where}で${b.cause}`) &&
				head.includes(`<small>${home}　99ターン</small>`),
			`${d}: the shared head reads ${head}`,
		);
		// 持ち帰りの 冒険には つけない
		const { objective: _o, ...fetchRp } = rp;
		ok(
			sharedHead(fetchRp).includes("持ち帰った") &&
				!sharedHead(fetchRp).includes(home),
			`${d}: a fetch replay got the boss head`,
		);
		const { objective: _p, ...fetchRec } = rec;
		ok(!recordHead(fetchRec).includes(home), `${d}: a fetch record got it`);
	}
	// ボスで ない 板の 敵は これまでどおり（強さの 幅と 板の 名前）
	const kin = MONSTERS.kinonyan;
	ok(
		floorsText(kin) ===
			`B${kin.floors[0]}〜B${kin.floors[1]}（${DUNGEON_NAMES.kinoko.name}だけ）`,
		`kinonyan: ${floorsText(kin)}`,
	);
});

// ───────────────── 目的（持ち帰り・ボス）と 期間限定の イベント ─────────────────

/** 進み具合（イベントの 試験用。保存は 使わない）。 */
const prog = (o: Partial<Progress> = {}): Progress => ({
	unlocked: ["shallow"],
	cleared: [],
	fails: {},
	intro: [],
	news: [],
	...o,
});

/** 試しの シード（確率の 当たり・はずれを 数える）。 */
const SEEDS = Array.from({ length: 600 }, (_, i) => `ev-${i}`);

/** Math.random を 呼んだら 投げる（イベントは 決まった 値だけで 決める）。 */
const noRandom = <T>(fn: () => T): T => {
	const orig = Math.random;
	Math.random = () => {
		throw new Error("Math.random was used");
	};
	try {
		return fn();
	} finally {
		Math.random = orig;
	}
};

test("objectives: colonies default to boss, story boards to fetch, and an event changes only its own board", () => {
	for (const d of DUNGEON_IDS) {
		const g = objectiveFor(d, prog());
		ok(g.objective === DUNGEONS[d].objective, `${d}: ${g.objective}`);
		ok(!g.event, `${d} has an event with none running`);
	}
	const ids = new Set<string>();
	for (const e of EVENTS) {
		ok(!ids.has(e.id), `${e.id} twice`);
		ids.add(e.id);
		ok(eventById(e.id) === e, `${e.id} is not found by id`);
		ok(
			e.objective === "fetch" || !!DUNGEONS[e.dungeon].boss,
			`${e.id}: ${e.dungeon} has no boss`,
		);
		ok(
			e.objective !== DUNGEONS[e.dungeon].objective,
			`${e.id} does not change ${e.dungeon}`,
		);
		ok(
			e.end.clears !== undefined || e.end.outings !== undefined,
			`${e.id} never ends`,
		);
	}
	// パン板の 大行進：パン板だけ ボス。残りは 次の クリアか 出撃の 回数
	const march = prog({
		outings: 2,
		event: { id: "pan-march", since: 1, clearsSince: 0 },
	});
	const g = objectiveFor("shallow", march);
	ok(g.objective === "boss", "the march does not make パン板 a boss run");
	ok(
		g.event?.name === "パン板の大行進" &&
			g.event.endsIn === "次のクリアかあと3回",
		`the march reads ${g.event?.name} / ${g.event?.endsIn}`,
	);
	ok(
		eventText(g) === "期間限定：パン板の大行進（次のクリアかあと3回）",
		eventText(g),
	);
	ok(
		objectiveFor("kinoko", march).objective === "boss" &&
			!objectiveFor("kinoko", march).event,
		"the march changed きのこ板",
	);
	ok(
		objectiveFor("main", march).objective === "boss",
		"the march changed 風呂板",
	);
	// きのこ狩り：きのこ板が 持ち帰りに（出撃の 回数だけで 終わる）
	const hunt = prog({
		outings: 6,
		event: { id: "kinoko-hunt", since: 5, clearsSince: 0 },
	});
	const k = objectiveFor("kinoko", hunt);
	ok(k.objective === "fetch", "the hunt keeps the boss");
	ok(k.event?.endsIn === "あと2回", `the hunt reads ${k.event?.endsIn}`);
	// 知らない イベント（あとの 版で 消えた）は 無かった ことに
	const gone = prog({ event: { id: "no-such", since: 0, clearsSince: 0 } });
	for (const d of DUNGEON_IDS)
		ok(
			objectiveFor(d, gone).objective === DUNGEONS[d].objective,
			`an unknown event changed ${d}`,
		);
	// 目的の ひとこと
	ok(
		goalText("kinoko", "boss") === "親玉きのにゃんをたおす",
		goalText("kinoko", "boss"),
	);
	ok(
		goalText("shallow", "fetch") === "食パンの国旗を持ち帰る",
		goalText("shallow", "fetch"),
	);
	ok(
		goalText("deep", "boss") === "てっぺんの名無しをたおす",
		goalText("deep", "boss"),
	);
	ok(bossName("tropical") === "怒れるナツコ", `${bossName("tropical")}`);
	ok(bossName("hidden") === null, "過去ログの底 has a boss");
});

test("events start from how a run ended, a need, and a fixed value of the seed (no Math.random), one at a time", () => {
	noRandom(() => {
		// パン板の 大行進：パン板を クリアずみで、クリアの あと 1/6
		const base = prog({ unlocked: ["shallow", "main"], cleared: ["shallow"] });
		const clear = { dungeon: "main" as DungeonId, kind: "clear" as const };
		const hits = SEEDS.filter(
			(seed) =>
				advanceEvents(base, { ...clear, seed }).started?.id === "pan-march",
		);
		const rate = hits.length / SEEDS.length;
		ok(rate > 0.11 && rate < 0.23, `the march started ${rate} of the time`);
		for (const seed of SEEDS.slice(0, 50)) {
			const a = advanceEvents(base, { ...clear, seed });
			const b = advanceEvents(base, { ...clear, seed });
			ok(
				JSON.stringify(a) === JSON.stringify(b),
				`${seed} started differently twice`,
			);
			ok(a.progress.outings === 1, `outings ${a.progress.outings}`);
			ok(base.outings === undefined, "the progress was written in place");
		}
		const hit = hits[0];
		const won = advanceEvents(base, { ...clear, seed: hit });
		ok(
			JSON.stringify(won.progress.event) ===
				JSON.stringify({ id: "pan-march", since: 1, clearsSince: 0 }),
			`the march state: ${JSON.stringify(won.progress.event)}`,
		);
		// たおれた・帰還スレでは 始まらない。パン板を クリアしていなければ 始まらない
		ok(
			!advanceEvents(base, { ...clear, kind: "escape", seed: hit }).started,
			"the march started after an escape",
		);
		ok(
			!advanceEvents(prog({ unlocked: ["shallow", "main"] }), {
				...clear,
				seed: hit,
			}).started,
			"the march started before パン板 was cleared",
		);
		// きのこ狩り：きのこ板に 行けて、出撃が 10の 倍数に なったら 1/2（終わりかたは 問わない）
		const kin = prog({
			unlocked: ["shallow", "kinoko"],
			cleared: ["kinoko"],
			outings: 9,
		});
		const huntHits = SEEDS.filter(
			(seed) =>
				advanceEvents(kin, { dungeon: "shallow", kind: "dead", seed }).started
					?.id === "kinoko-hunt",
		);
		const huntRate = huntHits.length / SEEDS.length;
		ok(
			huntRate > 0.4 && huntRate < 0.6,
			`the hunt started ${huntRate} of the time`,
		);
		const huntHit = huntHits[0];
		for (const kind of ["dead", "clear", "escape"] as const)
			ok(
				advanceEvents(kin, { dungeon: "shallow", kind, seed: huntHit }).started
					?.id === "kinoko-hunt",
				`the hunt did not start after ${kind}`,
			);
		ok(
			!advanceEvents(
				{ ...kin, outings: 10 },
				{
					dungeon: "shallow",
					kind: "dead",
					seed: huntHit,
				},
			).started,
			"the hunt started on the 11th outing",
		);
		ok(
			!advanceEvents(prog({ outings: 9 }), {
				dungeon: "shallow",
				kind: "dead",
				seed: huntHit,
			}).started,
			"the hunt started before きのこ板 opened",
		);
		// 起きている あいだは ほかの イベントは 始まらない
		const busy = {
			...base,
			outings: 1,
			event: { id: "kinoko-hunt", since: 1, clearsSince: 0 },
		};
		const next = advanceEvents(busy, { ...clear, seed: hit });
		ok(
			!next.started && next.progress.event?.id === "kinoko-hunt",
			"a second event started while one was running",
		);
	});
});

test("events end after their outings or a clear of their own board, and do not start again at once", () => {
	noRandom(() => {
		const base = prog({ unlocked: ["shallow", "main"], cleared: ["shallow"] });
		const march = (outings: number, clearsSince = 0): Progress => ({
			...base,
			outings,
			event: { id: "pan-march", since: 1, clearsSince },
		});
		// ほかの 板の クリア・たおれた では 終わらない
		for (const r of [
			{ dungeon: "main" as DungeonId, kind: "clear" as const },
			{ dungeon: "shallow" as DungeonId, kind: "dead" as const },
		]) {
			const n = advanceEvents(march(1), { ...r, seed: "x" });
			ok(
				!n.ended && n.progress.event?.id === "pan-march",
				`the march ended after ${r.dungeon} ${r.kind}`,
			);
			ok(n.progress.event?.clearsSince === 0, "a clear elsewhere counted");
		}
		// パン板を クリアしたら 終わる（同じ 終わりで また 始まらない）
		for (const seed of SEEDS.slice(0, 100)) {
			const n = advanceEvents(march(1), {
				dungeon: "shallow",
				kind: "clear",
				seed,
			});
			ok(n.ended?.id === "pan-march", `${seed}: the march went on`);
			ok(n.started?.id !== "pan-march", `${seed}: the march restarted`);
			ok(n.progress.event?.id !== "pan-march", `${seed}: still marching`);
		}
		// 出撃 4回で 終わる（始まってから 数える）
		const three = advanceEvents(march(3), {
			dungeon: "main",
			kind: "dead",
			seed: "x",
		});
		ok(!three.ended, "the march ended after 3 outings");
		const four = advanceEvents(march(4), {
			dungeon: "main",
			kind: "dead",
			seed: "x",
		});
		ok(four.ended?.id === "pan-march", "the march outlived 4 outings");
		// 終わったら 同じ 知らせの あとで ほかの イベントが 始まる ことは ある（きのこ狩り：出撃 10回目）
		const withKinoko: Progress = {
			...march(9),
			unlocked: ["shallow", "main", "kinoko"],
			cleared: [...march(9).cleared, "kinoko"],
		};
		const swapSeed = SEEDS.find(
			(seed) =>
				advanceEvents(withKinoko, { dungeon: "main", kind: "dead", seed })
					.started,
		);
		const swap = advanceEvents(withKinoko, {
			dungeon: "main",
			kind: "dead",
			seed: swapSeed ?? "",
		});
		ok(
			swap.ended?.id === "pan-march" && swap.started?.id === "kinoko-hunt",
			`ended ${swap.ended?.id} / started ${swap.started?.id}`,
		);
		// 知らない イベントは 黙って 消える
		const gone = advanceEvents(
			prog({ event: { id: "no-such", since: 0, clearsSince: 0 } }),
			{ dungeon: "shallow", kind: "dead", seed: "x" },
		);
		ok(!gone.ended && !gone.progress.event, "an unknown event stayed");
	});
});

test("the mushroom hunt stays the exception: きのこ板 is a fetch run in well under half of the outings", () => {
	noRandom(() => {
		// きのこ狩りしか 起きない とき（ほかの イベントの need を 満たさず、たおれた・帰還スレ だけ）が
		// いちばん 多く なる。終わった 出撃では また 始まらないので、周期が 短いと かえって ふえる
		let p = prog({ unlocked: ["shallow", "kinoko"], cleared: ["kinoko"] });
		let fetch = 0;
		const n = 600;
		for (let i = 0; i < n; i++) {
			if (objectiveFor("kinoko", p).objective === "fetch") fetch++;
			p = advanceEvents(p, {
				dungeon: "shallow",
				kind: i % 2 ? "dead" : "escape",
				seed: `hunt-${i}`,
			}).progress;
		}
		const share = fetch / n;
		ok(
			share > 0.15 && share <= 0.4,
			`きのこ板 was a fetch run in ${share} of the outings`,
		);
	});
});

test("a run end counts the outing and leaves event news; the village reads it once", async () => {
	await withStorageAsync(async () => {
		// 前の 版の 進み具合（出撃の 回数も イベントも 無い）
		setProgress(["shallow", "kinoko"]);
		ok(loadProgress().outings === undefined, "old progress got outings");
		ok(!loadProgress().event, "old progress got an event");
		for (let i = 1; i <= 9; i++) {
			noteRunEnd("shallow", "dead", `run-${i}`);
			ok(loadProgress().outings === i, `outings ${loadProgress().outings}`);
		}
		ok(!loadProgress().eventNews, "news before any event");
		// 開発用の 冒険は 数えない
		noteRunEnd("shallow", "dead", "debug:x");
		ok(loadProgress().outings === 9, "a debug run was counted");
		// 10回目で 始まる（1/2 に 当たる シード）
		const huntSeed = SEEDS.find(
			(seed) =>
				advanceEvents(
					prog({
						unlocked: ["shallow", "kinoko"],
						cleared: ["kinoko"],
						outings: 9,
					}),
					{
						dungeon: "kinoko",
						kind: "clear",
						seed,
					},
				).started?.id === "kinoko-hunt",
		);
		noteRunEnd("kinoko", "clear", huntSeed);
		const p = loadProgress();
		ok(p.event?.id === "kinoko-hunt", `event ${p.event?.id}`);
		ok(
			JSON.stringify(p.eventNews) ===
				JSON.stringify([{ id: "kinoko-hunt", started: true }]),
			`news ${JSON.stringify(p.eventNews)}`,
		);
		ok(
			objectiveFor("kinoko", p).objective === "fetch",
			"the hunt did not make きのこ板 a fetch run",
		);
		const hunt = eventById("kinoko-hunt");
		if (!hunt) throw new Error("harness: no hunt");
		const a = fakeStory();
		await newsScript(a.s);
		ok(
			inOrder(a.log, [
				"se chapter",
				...eventNewsText(hunt, true).map((t) => `narrate: ${t}`),
			]),
			`the start news is out of order:\n${a.log.join("\n")}`,
		);
		ok(!loadProgress().eventNews, "the news stays after it was read");
		const b = fakeStory();
		await newsScript(b.s);
		ok(b.log.length === 0, `the news was read twice: ${b.log.join()}`);
		// 3回 もぐると 終わる
		for (let i = 6; i <= 8; i++) noteRunEnd("shallow", "dead", `run-${i}`);
		ok(!loadProgress().event, "the hunt went on after 3 outings");
		const c = fakeStory();
		await newsScript(c.s);
		ok(
			inOrder(
				c.log,
				eventNewsText(hunt, false).map((t) => `narrate: ${t}`),
			),
			`the end news is missing:\n${c.log.join("\n")}`,
		);
		ok(!c.log.includes("se chapter"), "the end news rang the chapter bell");
	});
});

test("潜った 本人は 迎えない：ロゼが 主人公で 持ち帰ると、迎える 語りに ロゼは 出ない（かわりの 頁か 出さない）", async () => {
	await withStorageAsync(async () => {
		setProgress(
			["shallow", "kinoko", "tropical"],
			[],
			["shallow", "kinoko", "tropical"],
		);
		putTown({ stage: 7 });
		const a: ReturnArrival = { kind: "clear", dungeon: "tropical" };
		ok(
			pagesFor(a).some((p) => p.who === "roze"),
			"ロゼ does not speak when キリコ dove (the check would be empty)",
		);
		pushRecord({ kind: "clear", dungeon: "tropical", hero: "roze" });
		const pages = pagesFor(a);
		ok(
			pages.every((p) => p.who !== "roze" && !p.text.includes("ロゼ")),
			`ロゼ greets herself:\n${pages.map((p) => `${p.who}: ${p.text}`).join("\n")}`,
		);
		ok(pages.length > 0, "the ending vanished");
		pushRecord({ kind: "escape", dungeon: "tropical", hero: "zero" });
		ok(
			pagesFor({ kind: "escape", dungeon: "tropical" }).every(
				(p) => p.who !== "zero",
			),
			"ゼロ greets herself after an escape",
		);
	});
});

test("boss wins come home: the arrival, then how they got back, then the rest of the usual ending", async () => {
	for (const d of DUNGEON_IDS) {
		const has = !!DUNGEONS[d].boss;
		ok(!!BOSS_RETURN[d] === has, `${d}: BOSS_RETURN ${!!BOSS_RETURN[d]}`);
		ok(!!BOSS_HOME[d] === has, `${d}: BOSS_HOME ${!!BOSS_HOME[d]}`);
		const n = BOSS_RETURN[d]?.length ?? 0;
		ok(!has || (n >= 1 && n <= 2), `${d}: ${n} boss return pages`);
		if (!has) continue;
		// ending の 1枚目は 着いた 語り（だれも 話さない）。仲間が 声を かけるのは その あと
		const first = STORY[d].ending[0];
		ok(
			first && first.who === null && first.text.startsWith("村に帰りつくと"),
			`${d}: the ending does not open with the arrival: ${first?.text}`,
		);
		// 仲間が みんな 帰ってきた 町で（まだ 帰って いない 仲間の 頁は 出ない）
		const cleared: DungeonId[] = ["shallow", "kinoko", "tropical"];
		let got: readonly StoryPage[] = [];
		await withStorageAsync(async () => {
			setProgress([...DUNGEON_IDS], [], cleared);
			putTown({ stage: 7 });
			got = pagesFor({ kind: "clear", dungeon: d, objective: "boss" });
		});
		// 持ち帰って いる 板しだいの 頁（needCleared・unlessCleared）は その とおりに 数える
		const shown = (p: StoryPage) =>
			(!p.needCleared || cleared.includes(p.needCleared)) &&
			!(p.unlessCleared && cleared.includes(p.unlessCleared));
		ok(
			got[0] === first &&
				JSON.stringify(got.slice(1, 1 + n)) ===
					JSON.stringify(BOSS_RETURN[d]) &&
				got.length ===
					STORY[d].ending.filter(shown).length +
						(STORY[d].once?.filter(shown).length ?? 0) +
						n +
						(episodeEnd(d) ? 1 : 0),
			`${d}: the boss pages are not right after the arrival`,
		);
	}
	await withStorageAsync(async () => {
		setProgress(["shallow", "kinoko"], [], ["shallow", "kinoko"]);
		putTown({ stage: 7 });
		const v = villageView();
		const a: ReturnArrival = {
			kind: "clear",
			dungeon: "kinoko",
			objective: "boss",
		};
		const pages = [
			STORY.kinoko.ending[0],
			...(BOSS_RETURN.kinoko ?? []),
			...STORY.kinoko.ending.slice(1),
			// はじめての 持ち帰りなので、去った 人の レスの 頁も
			...(STORY.kinoko.once ?? []),
			// 本筋の 話の おわり（第二話）
			...[episodeEnd("kinoko")].filter((x) => !!x),
		];
		ok(
			JSON.stringify(pagesFor(a)) === JSON.stringify(pages),
			"the boss pages do not come right after the arrival",
		);
		const plain = [
			...STORY.kinoko.ending,
			...(STORY.kinoko.once ?? []),
			...[episodeEnd("kinoko")].filter((x) => !!x),
		];
		ok(
			JSON.stringify(pagesFor({ ...a, objective: "fetch" })) ===
				JSON.stringify(plain) &&
				JSON.stringify(pagesFor({ kind: "clear", dungeon: "kinoko" })) ===
					JSON.stringify(plain),
			"a fetch clear got boss pages",
		);
		// 帰還スレの 語りは いつもの まま（まだ 帰って いない フェリスの 頁だけ かわる）
		const back = pagesFor({
			kind: "escape",
			dungeon: "kinoko",
			objective: "boss",
		});
		ok(
			back.length <= RETURN_PAGES.length &&
				!back.some((p) => BOSS_RETURN.kinoko?.includes(p)),
			"an escape from a boss run got boss pages",
		);
		const { s, log } = fakeStory({ at: exitFor("kinoko").cell });
		lineUp(s, a, v);
		for (const who of new Set(pages.flatMap((p) => (p.who ? [p.who] : []))))
			ok(
				log.some((l) => l.startsWith(`place ${who} `)),
				`${who} does not wait at the mouth`,
			);
		await returnScene(s, a);
		ok(
			inOrder(log, [
				"show player",
				...pages.map((p) =>
					p.kiriko
						? `kiriko ${p.kiriko}: ${p.text}`
						: p.who || p.nanashi
							? `say ${p.who ?? "nanj"}: ${p.text}`
							: `narrate: ${p.text}`,
				),
				"fadeOut",
				`bgm ${villageSong()}`,
			]),
			`the boss return is out of order:\n${log.join("\n")}`,
		);
	});
});

test("the objective's new village texts fit the message window (22 full-width × 2 lines)", () => {
	const texts: [string, string][] = [];
	for (const [d, pages] of Object.entries(BOSS_RETURN))
		(pages ?? []).forEach((p, i) => {
			texts.push([`BOSS_RETURN.${d}[${i}]`, p.text]);
		});
	for (const e of EVENTS)
		for (const started of [true, false])
			eventNewsText(e, started).forEach((t, i) => {
				texts.push([`event ${e.id} ${started}[${i}]`, t]);
			});
	fitsWindow(texts);
	// 地図の 札の 目的の 行（1行に 収める。スマホの 札は 全角22字くらい）
	for (const d of DUNGEON_IDS)
		for (const o of ["fetch", "boss"] as const)
			ok(
				width(`目的：${goalText(d, o)}`) <= 22,
				`${d} ${o}: 目的：${goalText(d, o)}`,
			);
});

// ───────────────── おんJ 本館（data/village/hall.ts・ui/village/hallEvents.ts） ─────────────────

/** 本館の 中を 引く 道具（外の 扉 i から 入った マスから）。 */
const surveyHall = (v: VillageView, i = 0) => {
	const tier = hallTierOf(v);
	return surveyMap(
		hallRows(tier),
		hallPalette(tier),
		hallPlaces(v),
		hallEntry(tier, i),
	);
};

/** 見本の 段（集会所・レンガ館・本館・祭りの 本館）。 */
const HALL_STAGES = [0, 3, 6, 7];

/** 置き場所の 種類（id の 番号を 取る）。 */
const kindOf = (id: string) => id.replace(/_\d+$/, "");

test("おんJ 本館の 中: every tier is a closed room; from both entrances Kiriko reaches the exit mats, every wall thing and everyone", () => {
	for (let stage = 0; stage < TOWN_STAGES; stage++) {
		const v: VillageView = { stage, unlocked: ["shallow"], cleared: [] };
		const tier = hallTierOf(v);
		const rows = hallRows(tier);
		const tiles = hallPalette(tier);
		const w = [...rows[0]].length;
		rows.forEach((r, y) => {
			ok(
				[...r].length === w,
				`stage ${stage}: hall row ${y} is ${[...r].length} wide`,
			);
			[...r].forEach((ch, x) => {
				ok(tiles[ch], `stage ${stage}: "${ch}" at (${x},${y}) has no tile`);
				// まわりは 壁（出口の マットだけ 通れる）
				const edge = x === 0 || y === 0 || x === w - 1 || y === rows.length - 1;
				if (edge && ch !== "D")
					ok(
						!tiles[ch]?.passable,
						`stage ${stage}: the hall leaks at (${x},${y})`,
					);
			});
		});
		// 同梱の 絵だけ
		for (const ch of new Set(rows.join("")))
			for (const ref of [
				...(tiles[ch]?.layers ?? []),
				...(tiles[ch]?.above ?? []),
			])
				ok(ref.startsWith("pub:"), `stage ${stage}: "${ch}" draws ${ref}`);
		const places = hallPlaces(v);
		const ids = places.map((p) => p.id);
		ok(new Set(ids).size === ids.length, `stage ${stage}: duplicate hall ids`);
		ok(
			new Set(places.map((p) => `${p.x},${p.y}`)).size === places.length,
			`stage ${stage}: two hall events share a cell`,
		);
		const mats = hallMats(tier);
		for (const i of [0, 1]) {
			const s = surveyHall(v, i);
			const [ex, ey] = hallEntry(tier, i);
			ok(s.canEnter(ex, ey), `stage ${stage}: entrance ${i} is blocked`);
			ok(
				ex === mats[i][0] && ey === mats[i][1] - 1,
				`stage ${stage}: entrance ${i} is not just inside its mat`,
			);
			for (const [mx, my] of mats) {
				ok(
					s.reachable(mx, my),
					`stage ${stage}: cannot walk to the mat (${mx},${my})`,
				);
				ok(
					places.some((p) => p.trigger === "touch" && p.x === mx && p.y === my),
					`stage ${stage}: the mat (${mx},${my}) does not lead out`,
				);
			}
			for (const p of places) {
				if (p.trigger === "touch") {
					ok(
						s.tile(p.x, p.y)?.passable,
						`stage ${stage}: ${p.id} is on a wall`,
					);
					continue;
				}
				if (p.sprite)
					ok(
						s.tile(p.x, p.y)?.passable,
						`stage ${stage}: ${p.id} stands on a wall`,
					);
				// 壁や 背の 高い 物は 裏（北）から 読まない。前か 横から 読める
				ok(
					s.talkable(p, hasBack(s, p)),
					`stage ${stage}: cannot reach ${p.id}`,
				);
			}
		}
	}
});

test("おんJ 本館の 中: it grows by tier and keeps what the smaller hall had", () => {
	const kinds = HALL_STAGES.map(
		(stage) =>
			new Set(
				hallPlaces({ stage, unlocked: ["shallow"], cleared: ["shallow"] }).map(
					(p) => kindOf(p.id),
				),
			),
	);
	const want = [
		["mat", "board", "toban", "template", "notice", "book"],
		["shelf", "ledger", "nanashi_toban"],
		["monitor", "dendo", "chair", "nanashi"],
		["yaji"],
	];
	HALL_STAGES.forEach((stage, i) => {
		for (let j = 0; j <= i; j++)
			for (const k of want[j])
				ok(kinds[i].has(k), `stage ${stage}: the hall has no ${k}`);
		for (const k of want[i + 1] ?? [])
			ok(!kinds[i].has(k), `stage ${stage}: the hall already has ${k}`);
	});
	// 部屋は 段で 広がる
	const area = ([0, 1, 2] as const).map((t) => {
		const r = hallRows(t);
		return r.length * [...r[0]].length;
	});
	ok(area[0] < area[1] && area[1] < area[2], `hall sizes ${area}`);
	// 名無しは 2〜3人（段7 は 野次馬も）。敵と 同じ 絵は 使わない
	const enemy = new Set(
		Object.values(MONSTERS).flatMap((m) => [m.sprite, m.still ?? ""]),
	);
	for (const stage of HALL_STAGES) {
		const people = hallPlaces({
			stage,
			unlocked: ["shallow"],
			cleared: ["shallow"],
		}).filter((p) => p.sprite);
		for (const p of people)
			ok(
				!enemy.has(p.sprite ?? ""),
				`stage ${stage}: ${p.id} looks like an enemy`,
			);
		const watchers = people.filter(
			(p) => p.id.startsWith("nanashi_") && p.id !== "nanashi_toban",
		);
		if (hallTier(stage) === 2)
			ok(
				watchers.length >= 2 && watchers.length <= 3,
				`stage ${stage}: ${watchers.length} watchers`,
			);
	}
	ok(
		new Set(NANASHI_WALK).size === NANASHI_WALK.length,
		"two 名無し share a look",
	);
	// 飾り棚は レンガ館から（蓄音機に ついていない 品が ぜんぶ ならぶ）
	ok(shelfSlots(0).length === 0, "the 集会所 has a shelf");
	for (const t of [1, 2] as const)
		ok(
			shelfSlots(t).length >= trophies(DUNGEON_IDS).length,
			`tier ${t}: ${shelfSlots(t).length} shelf slots`,
		);
	ok(HALL_NAMES.length === 3, "a hall tier has no name");
});

test("おんJ 本館の 外観: it widens 4 → 6 → 10 by stage, the doors stay put and step in", () => {
	const widths = [4, 6, 10];
	for (const v of VIEWS) {
		const s = survey(v);
		const rows = villageRows(v);
		const doors = VILLAGE_SPOTS.hallDoors;
		// 屋根の 棟の 数が 幅（崖の いちばん上の 段）
		const ridge = [...rows[doors[0][1] - 3]].filter((c) => c === "#").length;
		ok(
			ridge === widths[hallTier(v.stage)],
			`${label(v)}: the hall is ${ridge} wide`,
		);
		for (const [x, y] of doors) {
			ok(rows[y][x] === "5", `${label(v)}: no door at (${x},${y})`);
			ok(
				s.places.some((p) => p.trigger === "touch" && p.x === x && p.y === y),
				`${label(v)}: the door (${x},${y}) does not lead in`,
			);
			ok(
				s.reachable(x, y),
				`${label(v)}: cannot walk into the door (${x},${y})`,
			);
			// 出てくる マス（崖の 下の 道）
			const [ox, oy] = hallOutside(x);
			ok(
				ox === x && oy === y + 1,
				`${label(v)}: the way out of (${x},${y}) is (${ox},${oy})`,
			);
			ok(
				s.reachable(ox, oy),
				`${label(v)}: cannot stand in front of (${x},${y})`,
			);
			ok(
				!s.places.some((p) => p.x === ox && p.y === oy),
				`${label(v)}: something stands in front of the door (${x},${y})`,
			);
		}
	}
	// 知らない 扉からは 右の 扉の 前
	ok(
		hallOutside(undefined).join() ===
			hallOutside(VILLAGE_SPOTS.hallDoors[1][0]).join(),
		"an unknown door does not fall back to the right one",
	);
});

test("おんJ 本館の 扉: the door text once per tier, a door sound and a fade, and out again in front of the door she used", async () => {
	await withStorageAsync(async () => {
		for (const stage of HALL_STAGES) {
			const v: VillageView = { stage, unlocked: ["shallow"], cleared: [] };
			const tier = hallTierOf(v);
			for (const i of [0, 1]) {
				const [dx, dy] = VILLAGE_SPOTS.hallDoors[i];
				const { s, log } = fakeStory({ at: [dx, dy] });
				await enterHall(i, v)(s);
				const [ex, ey] = hallEntry(tier, i);
				ok(
					inOrder(log, [
						`narrate: ${VILLAGE_MSG.hall[tier]}`,
						"se door",
						"fadeOut",
						`warp hall ${ex},${ey} up`,
						"fadeIn",
					]),
					`stage ${stage} door ${i}: the way in is out of order:\n${log.join("\n")}`,
				);
				ok(
					s.state.x === ex && s.state.y === ey,
					`stage ${stage}: Kiriko is not inside`,
				);
				// 2回目からは 扉の 文なし
				log.length = 0;
				await enterHall(i, v)(s);
				ok(
					!log.some((l) => l.startsWith("narrate")),
					`stage ${stage}: the door text again`,
				);
				// どちらの マットから 出ても 入った 扉の 前
				const [mx, my] = hallMats(tier)[1 - i];
				s.state.x = mx;
				s.state.y = my;
				log.length = 0;
				await leaveHall(s);
				ok(
					inOrder(log, [
						"se door",
						"fadeOut",
						`warp village ${dx},${dy + 1} down`,
						"fadeIn",
					]),
					`stage ${stage} door ${i}: the way out is out of order:\n${log.join("\n")}`,
				);
				ok(
					s.state.x === dx && s.state.y === dy + 1,
					`stage ${stage}: not in front of door ${i}`,
				);
			}
		}
	});
});

test("演説の 当番表: one speech per return, counted in its own save, nothing else changes", async () => {
	await withStorageAsync(async () => {
		// パン板を 持ち帰った その 日から 書ける
		setProgress(["shallow"]);
		putTown({ stage: 0, points: 10 });
		const town = localStorage.getItem(TOWN_KEY);
		const progress = localStorage.getItem(PROGRESS_KEY);
		const no = fakeStory({ pick: 1 });
		await tobanScript(0)(no.s);
		ok(hoshuCount() === 0, "やめる still wrote");
		ok(
			no.log.includes(`choose ${TOBAN_MENU.join("/")}`),
			`no choice:\n${no.log.join("\n")}`,
		);
		const yes = fakeStory({ pick: 0 });
		await tobanScript(0)(yes.s);
		ok(hoshuCount() === 1, `count ${hoshuCount()}`);
		ok(
			inOrder(yes.log, [
				`narrate: ${HALL_MSG.toban[0]}`,
				"se read",
				`narrate: ${fill(HALL_MSG.tobanDone, { n: 1 })}`,
				// 1回目の 節目：外から 1レス
				`narrate: ${HALL_MSG.tobanReplyHead}`,
				`say nanj: ${HALL_MSG.tobanReply[1]}`,
			]),
			`wrote:\n${yes.log.join("\n")}`,
		);
		// 同じ 帰りの あいだは もう 書けない
		const again = fakeStory({ pick: 0 });
		await tobanScript(1)(again.s);
		ok(hoshuCount() === 1 && !canWriteHoshu(), "wrote twice in one return");
		ok(
			again.log.join("\n") ===
				[
					`narrate: ${HALL_MSG.toban[1]}`,
					// キリコの 書いた 数が 当番表に 残る
					`narrate: ${fill(HALL_MSG.tobanMine, { n: 1 })}`,
					`narrate: ${fill(HALL_MSG.tobanAgain, { n: 1 })}`,
				].join("\n"),
			`again:\n${again.log.join("\n")}`,
		);
		// 帰ってきたら また 書ける。数は 読みなおしても 残る
		pushRecord({ kind: "dead" });
		ok(canWriteHoshu(), "cannot write after a return");
		await tobanScript(2)(fakeStory({ pick: 0 }).s);
		forgetHallMemo();
		ok(hoshuCount() === 2, `count after a reload: ${hoshuCount()}`);
		ok(
			localStorage.getItem(TOWN_KEY) === town &&
				localStorage.getItem(PROGRESS_KEY) === progress,
			"writing 「保守」 touched the town or progress",
		);
	});
});

test("期間限定の 告知: nothing, or the event's name, news and goal", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow"]);
		ok(
			noticeTexts().join() === HALL_MSG.noticeNone,
			`no event: ${noticeTexts()}`,
		);
		const texts: [string, string][] = [];
		for (const e of EVENTS) {
			localStorage.setItem(
				PROGRESS_KEY,
				JSON.stringify(
					prog({
						unlocked: [...DUNGEON_IDS],
						cleared: [...DUNGEON_IDS],
						outings: 3,
						event: { id: e.id, since: 3, clearsSince: 0 },
					}),
				),
			);
			forgetProgressMemo();
			const t = noticeTexts();
			ok(t.length === 3, `${e.id}: ${t.length} windows`);
			ok(t[0].includes(e.name) && t[1] === e.news, `${e.id}: ${t}`);
			ok(t[2].includes(goalText(e.dungeon, e.objective)), `${e.id}: ${t[2]}`);
			t.forEach((x, i) => {
				texts.push([`notice ${e.id}[${i}]`, x]);
			});
		}
		fitsWindow(texts);
		const { s, log } = fakeStory();
		await noticeScript(s);
		ok(
			log.length === 3 && log.every((l) => l.startsWith("narrate: ")),
			`notice:\n${log.join("\n")}`,
		);
	});
});

test("おんJ 本館の 下見（?stage=・?event=）: 「保守」 is kept for this visit only, the hall save is not written", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow"], [], ["shallow", "main", "deep", "kinoko"]);
		const restore = swapLocation(`?debug&stage=3&event=${EVENTS[0].id}`);
		try {
			await tobanScript(1)(fakeStory({ pick: 0 }).s);
			ok(hoshuCount() === 1, `preview count ${hoshuCount()}`);
			ok(
				localStorage.getItem(HALL_KEY) === null,
				`the preview wrote the hall save: ${localStorage.getItem(HALL_KEY)}`,
			);
		} finally {
			restore();
		}
		forgetHallMemo();
		ok(hoshuCount() === 0, `count after the preview: ${hoshuCount()}`);
	});
});

test("村の 曲: the stage picks it; the song list holds only songs heard on cleared boards", () => {
	ok(
		stageBgm(0) === "town" && stageBgm(4) === "town",
		"early village is not town",
	);
	ok(
		stageBgm(5) === "kumori" && stageBgm(7) === "kumori",
		"the shop village is not kumori",
	);
	ok(
		records(0, [])
			.map((r) => r.bgm)
			.join() === "town",
		"a new village offers more than its own song",
	);
	const all = records(7, DUNGEON_IDS);
	for (const r of all) ok(r.bgm in bgm, `${r.label}: no song ${r.bgm}`);
	ok(
		new Set(all.map((r) => r.bgm)).size === all.length,
		"the song list has a song twice",
	);
	ok(
		records(5, ["shallow"]).some((r) => r.bgm === BOARD_LOOKS.shallow.bgm) &&
			!records(5, ["shallow"]).some((r) => r.bgm === BOARD_LOOKS.deep.bgm),
		"a board's song is offered before it is cleared",
	);
	// レコードの 箱（最終話の あと）：聞いた 曲 ＋ 寸劇の 曲。どれも 実在し、同じ 曲は 1度
	const box = jukeboxTracks(7, DUNGEON_IDS);
	for (const r of box) ok(r.bgm in bgm, `${r.label}: no song ${r.bgm}`);
	ok(
		new Set(box.map((r) => r.bgm)).size === box.length,
		"the record box lists a song twice",
	);
	ok(
		box.length > all.length &&
			box.some((r) => r.bgm === "kaiwai2") &&
			box.some((r) => r.bgm === "deep6"),
		"the record box misses the scene songs",
	);
	const main = jukeboxTracks(7, ["shallow", "kinoko", "main", "deep"]);
	ok(
		main.some((r) => r.bgm === "kaiwai2") &&
			main.some((r) => r.bgm === "kaiwai") &&
			!main.some((r) => r.bgm === "deep6") &&
			!main.some((r) => r.bgm === "sad"),
		"a scene song is offered before its board is cleared",
	);
	ok(
		box.every((r) => r.label && r.where),
		"a record box track has no title or place",
	);
	// 箱の 絵：名無し2rt さんの 曲は 鮭、ほかは キリコ
	ok(
		songArt("kumori") === "sake" &&
			songArt("town") === "sake" &&
			songArt("retro") === "kiriko" &&
			songArt("kaiwai2") === "kiriko",
		"the record box shows the wrong face",
	);
	ok(
		box.some((r) => songArt(r.bgm) === "sake") &&
			box.some((r) => songArt(r.bgm) === "kiriko"),
		"the record box never changes its face",
	);
	// コマ送りの 拍：MML の t（ヘッダの #t0inst などは 読まない）
	ok(
		songBpm(bgm.kaiwai) === 145 &&
			songBpm(bgm.kumori) === 116 &&
			songBpm("@0 o4 cdef") === 120,
		`the record box reads the wrong tempo: ${songBpm(bgm.kaiwai)} ${songBpm(bgm.kumori)}`,
	);
	for (const [name, mml] of Object.entries(bgm)) {
		const t = songBpm(mml);
		ok(t >= 40 && t <= 300, `${name}: odd tempo ${t}`);
	}
	// MMLをコピー：dtm 独自の 宣言（#名前=値・#end;）は 外す。音符は 残る（@0 の トラックから 始まる）
	for (const [name, mml] of Object.entries(bgm)) {
		const p = plainMml(mml);
		ok(
			!p.includes("#") &&
				!p.includes("@@") &&
				p.startsWith("@") &&
				p.length > mml.length * 0.5,
			`${name}: the copied MML keeps dtm declarations or loses notes`,
		);
		// 1トラック 1行（@番号 で 始まり ; で 終わる。dtm の「MML生成」と 同じ 並び）
		const lines = p.split("\n");
		ok(
			lines.length >= 2 && lines.every((l) => /^@\d+ ?.*;$/.test(l)),
			`${name}: a copied line is not one track: ${lines.find((l) => !/^@\d+ ?.*;$/.test(l))?.slice(0, 40)}`,
		);
		// 歌声の トラックを 外しても 演奏の トラックは 残る
		if (mml.includes("@@"))
			ok(
				/(^|;|\n)@\d/.test(p) && !/[ぁ-ん]{4}/.test(p),
				`${name}: lyrics survive or the music is gone`,
			);
	}
});

test("場面の 曲: scene cues name real songs, the 電池板 boss and 見学コース have their own, other bosses use the shared one", () => {
	const pages = [
		...DUNGEON_IDS.flatMap((d) => [
			...STORY[d].ending,
			...(STORY[d].again ?? []),
			...(STORY[d].once ?? []),
		]),
		...TEN_NEWS.pages,
	];
	const cues = [
		...pages,
		...pages.flatMap((p) => (p.instead ? [p.instead] : [])),
		...Object.values(HERO_QUESTS).flatMap((q) => q.offer),
	].flatMap((p) => (p.bgm ? [p.bgm] : []));
	for (const c of cues) ok(c in bgm, `no song ${c}`);
	const cueOf = (
		ps: readonly { text: string; bgm?: string | null }[],
		t: string,
	) => ps.find((p) => p.text.includes(t))?.bgm;
	ok(
		cueOf(STORY.deep.ending, "港は真っ暗") === null,
		"the dark port is not silent",
	);
	ok(
		cueOf(TEN_NEWS.pages, "いっせいに消えた") === null,
		"the blackout is not silent",
	);
	ok(
		cueOf(TEN_NEWS.pages, "もどらなかった") === "deep4",
		"the dead streets have no alarm",
	);
	ok(
		cueOf(HERO_QUESTS.zero.offer, "蓄音機を回した") === "deep1",
		"ゼロ's record",
	);
	ok(
		cueOf(HERO_QUESTS.roze.offer, "あー") === null,
		"ロゼ's あ is not heard alone",
	);
	// やきうの 正体は 山場の 専用曲（盛られた見出し。BGM.md）
	ok(DUNGEONS.deep.boss?.bgm === "lastboss", "やきう has no last-boss song");
	for (const d of DUNGEON_IDS)
		if (d !== "deep")
			ok(!DUNGEONS[d].boss?.bgm, `${d}: boss leaves the shared song`);
	ok(
		DUNGEONS.deep.rests?.find((r) => r.depth === 8)?.bgm === "deq_laundry",
		"見学コース has the zone song",
	);
	for (const d of DUNGEON_IDS)
		for (const r of DUNGEONS[d].rests ?? [])
			if (r.bgm) ok(r.bgm in bgm, `${d} ${r.name}: no song ${r.bgm}`);
	const all = records(7, DUNGEON_IDS).map((r) => r.bgm);
	ok(
		all.includes("lastboss") && all.includes("deq_laundry"),
		"the gramophone misses the 電池板 songs",
	);
});

test("飾り棚: the goal items of the cleared boards (植民地化宣言 and 長湯スレ play on the gramophone)", () => {
	const rows = shelfRows(["kinoko", "shallow", "main"]);
	ok(
		rows.map((r) => r.d).join() === "shallow,main,kinoko",
		`order: ${rows.map((r) => r.d)}`,
	);
	for (const r of rows) {
		const item = defOf(DUNGEONS[r.d].goal);
		ok(
			r.name === item.name && r.board === DUNGEON_NAMES[r.d].name,
			`${r.d}: ${r.name} / ${r.board}`,
		);
		ok(
			r.desc ===
				(ON_PHONO.includes(r.d)
					? ON_PHONO_TEXT
					: IN_STORE.includes(r.d)
						? IN_STORE_TEXT
						: item.flavor),
			`${r.d}: ${r.desc}`,
		);
	}
	ok(shelfRows([]).length === 0, "an empty shelf has rows");
	ok(
		trophies(["shallow", "main", "hidden", "kinoko"]).join() === "kinoko",
		`trophies: ${trophies(["shallow", "main", "hidden", "kinoko"])}`,
	);
});

test("飾り棚: what is said matches what is drawn (only the records on the gramophone → the shelf is empty), and its pictures are loaded before the hall fades in", () => {
	const cases: [DungeonId[], string][] = [
		[[], HALL_MSG.shelfEmpty],
		[["shallow"], HALL_MSG.shelfPhono],
		[["shallow", "main"], HALL_MSG.shelfPhono],
		[["shallow", "kinoko"], HALL_MSG.shelf],
		[["shallow", "main", "tropical", "festival"], HALL_MSG.shelf],
	];
	for (const [cleared, line] of cases) {
		ok(shelfLine(cleared) === line, `${cleared}: ${shelfLine(cleared)}`);
		// 「ならんでいる」と 言うなら 棚に 描く 品が ある
		ok(
			(shelfLine(cleared) === HALL_MSG.shelf) === trophies(cleared).length > 0,
			`${cleared}: said 「ならんでいる」 with ${trophies(cleared)} on the shelf`,
		);
	}
	const ctx = {} as Ctx;
	const all = [...DUNGEON_IDS];
	ok(
		buildHall({ stage: 0, unlocked: all, cleared: all }, ctx).images ===
			undefined,
		"the 集会所 (no shelf) loads shelf pictures",
	);
	for (const stage of [3, 6]) {
		const imgs = buildHall({ stage, unlocked: all, cleared: all }, ctx).images;
		for (const d of all) {
			const ref = itemIcon(DUNGEONS[d].goal);
			ok(!!imgs?.includes(ref), `stage ${stage}: ${d} (${ref}) not preloaded`);
		}
	}
});

test("おんJ 本館: every line fits the village window (22 full-width × 2 lines, 1〜3 windows)", () => {
	const texts: [string, string][] = [];
	const add = (where: string, v: unknown) => {
		if (typeof v === "string")
			texts.push([where, fill(v, { n: 999, name: "風呂板の湯けむり騒動" })]);
		else if (Array.isArray(v))
			v.forEach((x, i) => {
				add(`${where}[${i}]`, x);
			});
	};
	for (const [k, v] of Object.entries(HALL_MSG))
		if (k !== "noticeGoal") add(`HALL_MSG.${k}`, v);
	for (const [k, j] of Object.entries(JIKKYO)) add(`JIKKYO.${k}`, j.lines);
	fitsWindow(texts);
	for (const ls of [
		HALL_MSG.toban_nanashi,
		...HALL_MSG.watch,
		...HALL_MSG.yaji,
		...Object.values(JIKKYO).map((j) => j.lines),
	])
		ok(
			ls.length >= 1 && ls.length <= 3,
			`a hall talk has ${ls.length} windows`,
		);
	ok(HALL_MSG.monitor.length <= 3, "the monitor talks too long");
});

// ───────────────── 建物の 中（喫茶・小屋・常識堂の 奥・倉庫。data/village/rooms.ts・ui/village/rooms.ts・ui/village/cafe.ts） ─────────────────

/** 部屋の 地図を 引く（入口から）。extra は 部屋に 置く 人（喫茶の マスター・仲間・住人）。 */
const surveyRoom = (id: RoomId, extra: Place[] = []) => {
	const e = roomEntry(id);
	return surveyMap(
		roomRows(id),
		roomPalette(id),
		[...roomPlaces(id), ...extra],
		[e.x, e.y],
	);
};

/** 喫茶の 人（マスター・仲間 5人・住人の 来る 所 ぜんぶ）。 */
const cafePeople = (): Place[] => [
	{
		id: "master",
		x: CAFE_MASTER[0],
		y: CAFE_MASTER[1],
		trigger: "talk",
		sprite: "sa:x",
	},
	...CAFE_SLOTS.map(
		(seat, i): Place => ({
			id: `seat_${i}`,
			x: seat.at[0],
			y: seat.at[1],
			trigger: "talk",
			sprite: "sa:x",
		}),
	),
	...CAFE_PATRON_SPOTS.map(
		(p, i): Place => ({
			id: `patron_${i}`,
			x: p.at[0],
			y: p.at[1],
			trigger: "talk",
			sprite: "sa:x",
		}),
	),
];

test("建物の 中: every room is closed, draws only bundled art, and from the entrance Kiriko reaches the mats and every thing", () => {
	for (const id of ROOM_IDS) {
		const rows = roomRows(id);
		const tiles = roomPalette(id);
		const w = [...rows[0]].length;
		rows.forEach((r, y) => {
			ok([...r].length === w, `${id}: row ${y} is ${[...r].length} wide`);
			[...r].forEach((ch, x) => {
				ok(tiles[ch], `${id}: "${ch}" at (${x},${y}) has no tile`);
				const edge = x === 0 || y === 0 || x === w - 1 || y === rows.length - 1;
				if (edge && ch !== "D")
					ok(!tiles[ch]?.passable, `${id}: leaks at (${x},${y})`);
			});
		});
		for (const stage of [4, 7])
			for (const t of Object.values(roomPalette(id, stage)))
				for (const ref of [...t.layers, ...(t.above ?? [])])
					ok(ref.startsWith("pub:"), `${id}: draws ${ref}`);
		// 2マスの 高さの 物の 真上の マスは 床か 壁だけ（はみ出しが 手前に 描かれて、そこの 物が かくれる）
		for (const stage of id === "store" ? [4, 6, 7] : [7]) {
			const pal = roomPalette(id, stage);
			const tall = (ch: string) =>
				(pal[ch]?.layers ?? []).some((ref) => Number(ref.split(",")[3]) > 16);
			rows.forEach((r, y) => {
				[...r].forEach((ch, x) => {
					const up = rows[y - 1]?.[x];
					if (!up || !tall(ch)) return;
					ok(
						(pal[up]?.layers.length ?? 0) <= 1,
						`${id}@${stage}: "${up}" at (${x},${y - 1}) is hidden by the top of "${ch}"`,
					);
				});
			});
		}
		const people = id === "cafe" ? cafePeople() : [];
		const places = roomPlaces(id);
		const ids = places.map((p) => p.id);
		ok(new Set(ids).size === ids.length, `${id}: duplicate ids`);
		const all = [...places, ...people];
		ok(
			new Set(all.map((p) => `${p.x},${p.y}`)).size === all.length,
			`${id}: two things share a cell`,
		);
		const s = surveyRoom(id, people);
		const e = roomEntry(id);
		ok(s.canEnter(e.x, e.y), `${id}: the entrance is blocked`);
		for (const [mx, my] of roomMats(id))
			ok(
				s.reachable(mx, my) &&
					places.some((p) => p.trigger === "touch" && p.x === mx && p.y === my),
				`${id}: the mat (${mx},${my}) does not lead out`,
			);
		for (const p of all) {
			if (p.trigger === "touch") continue;
			ok(s.talkable(p, hasBack(s, p)), `${id}: cannot reach ${p.id}`);
		}
		// 調べる 物には 文が ある（倉庫は 銀行の 段でも）
		for (const p of places) {
			if (p.trigger === "touch") continue;
			const kind = p.id.replace(/_\d+$/, "");
			for (const stage of id === "store" ? [5, BANK_FROM] : [5]) {
				const lines =
					id === "cafe"
						? ((ROOM_MSG.cafe as Record<string, readonly string[]>)[kind] ?? [])
						: thingLines(id, p.id, stage);
				ok(lines.length > 0, `${id}: ${p.id} has nothing to say`);
			}
		}
	}
	// 銀行の 文は、部屋に ある 物だけ
	const kinds = (id: RoomId) =>
		new Set(roomPlaces(id).map((p) => p.id.replace(/_\d+$/, "")));
	for (const k of Object.keys(BANK.msg))
		ok(kinds("store").has(k), `BANK.msg.${k} is not in the store`);
});

test("喫茶の 席: Kiriko's seat is next to each friend, guests and stand spots are free floor, and the order stool faces the master", () => {
	const people = cafePeople();
	const s = surveyRoom("cafe", people);
	const taken = (x: number, y: number) =>
		people.some((p) => p.x === x && p.y === y);
	const dist = (a: readonly [number, number], b: readonly [number, number]) =>
		Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
	for (const [w, seat] of CAFE_SLOTS.entries()) {
		ok(dist(seat.at, seat.kiriko) === 1, `${w}: Kiriko does not sit next`);
		ok(!taken(...seat.kiriko), `${w}: Kiriko's seat is taken`);
		ok(!taken(...seat.guest), `${w}: the guest cell is taken`);
		ok(s.tile(...seat.guest)?.passable, `${w}: the guest stands on a wall`);
		ok(
			s.reachable(seat.stand.x, seat.stand.y),
			`${w}: cannot stand up to (${seat.stand.x},${seat.stand.y})`,
		);
	}
	for (const [i, p] of CAFE_PATRON_SPOTS.entries()) {
		ok(!taken(...p.kiriko) && !taken(...p.guest), `patron ${i}: seat taken`);
		ok(s.tile(...p.guest)?.passable, `patron ${i}: guest on a wall`);
		ok(s.reachable(p.stand.x, p.stand.y), `patron ${i}: cannot stand up`);
	}
	// みんなの 話は カウンターの 丸いす（重ならない）
	const all = Object.values(CAFE_ALL_SEATS).map(([x, y]) => `${x},${y}`);
	ok(new Set(all).size === all.length, "two share a stool in the all-talk");
	ok(
		CAFE_ORDER.x === CAFE_MASTER[0] &&
			CAFE_ORDER.y === CAFE_MASTER[1] + 2 &&
			s.tile(CAFE_MASTER[0], CAFE_MASTER[1] + 1)?.counter &&
			s.reachable(CAFE_ORDER.x, CAFE_ORDER.y),
		"the order stool does not face the master over the counter",
	);
});

test("施設の 中: every facility room is closed, draws only bundled art, and from the entrance Kiriko reaches the mats, every thing and everyone", () => {
	for (const f of FACILITIES) {
		if (!f.room) continue;
		const rows = facilityRoomRows(f);
		const tiles = facilityRoomPalette(f);
		const w = [...rows[0]].length;
		rows.forEach((r, y) => {
			ok([...r].length === w, `${f.id}: row ${y} is ${[...r].length} wide`);
			[...r].forEach((ch, x) => {
				ok(tiles[ch], `${f.id}: "${ch}" at (${x},${y}) has no tile`);
				const edge = x === 0 || y === 0 || x === w - 1 || y === rows.length - 1;
				if (edge && ch !== "D")
					ok(!tiles[ch]?.passable, `${f.id}: leaks at (${x},${y})`);
			});
		});
		for (const t of Object.values(tiles))
			for (const ref of [...t.layers, ...(t.above ?? [])])
				ok(ref.startsWith("pub:"), `${f.id}: draws ${ref}`);
		const places = facilityRoomPlaces(f);
		const people: Place[] = (f.room.people ?? []).map((p) => ({
			id: p.id,
			x: p.at[0],
			y: p.at[1],
			trigger: "talk",
			sprite: p.walk,
		}));
		const all = [...places, ...people];
		ok(
			new Set(all.map((p) => `${p.x},${p.y}`)).size === all.length,
			`${f.id}: two things share a cell`,
		);
		const e = facilityEntry(f);
		const s = surveyMap(rows, tiles, all, [e.x, e.y]);
		ok(s.canEnter(e.x, e.y), `${f.id}: the entrance is blocked`);
		for (const [mx, my] of facilityMats(f)) {
			ok(
				s.reachable(mx, my),
				`${f.id}: the mat (${mx},${my}) does not lead out`,
			);
			// 扉の 2マスとも 中へ ひらく（マットの 真上に 物を 置かない）
			ok(
				s.canEnter(mx, my - 1),
				`${f.id}: something stands on (${mx},${my - 1}) in front of the door`,
			);
		}
		for (const p of all) {
			if (p.trigger === "touch") continue;
			ok(s.talkable(p, hasBack(s, p)), `${f.id}: cannot reach ${p.id}`);
		}
		// 人の となりの 台には 調べる 物を 置かない（台の マスに 物が あると、台ごしに 話しかけても
		// その 物が 先に 出て 向こうの 人に 届かない。ui/village/village.ts）
		const thingCounter = (x: number, y: number) =>
			!!tiles[[...(rows[y] ?? "")][x]]?.counter &&
			places.some((q) => q.trigger === "talk" && q.x === x && q.y === y);
		for (const p of people)
			for (const [dx, dy] of [
				[0, -1],
				[1, 0],
				[0, 1],
				[-1, 0],
			])
				ok(
					!thingCounter(p.x + dx, p.y + dy),
					`${f.id}: the counter at (${p.x + dx},${p.y + dy}) reads its own thing instead of ${p.id}`,
				);
		for (const p of places) {
			if (p.trigger === "touch") continue;
			const kind = p.id.replace(/_\d+$/, "");
			ok(
				(f.room.lines[kind] ?? []).length > 0,
				`${f.id}: ${p.id} has nothing to say`,
			);
		}
	}
});

test("施設の 外: doors and outdoor things stand from their stage, Kiriko reaches them, and she comes out onto a cell she can stand on", () => {
	for (const v of VIEWS) {
		const s = survey(v);
		for (const f of FACILITIES) {
			const up =
				v.stage >= f.from && (f.until === undefined || v.stage < f.until);
			const door = s.places.find((q) => q.id === doorId(f));
			ok(
				!!door === (up && !!f.room),
				`${label(v)}: ${doorId(f)} does not match the stage`,
			);
			if (door)
				ok(
					door.trigger === "touch" && s.reachable(door.x, door.y),
					`${label(v)}: cannot step on ${doorId(f)}`,
				);
			if (up && f.room) {
				const o = facilityOutside(f);
				ok(
					s.reachable(o.x, o.y),
					`${label(v)}: out of ${f.id} onto (${o.x},${o.y})`,
				);
			}
			for (const t of f.outdoor ?? []) {
				const p = s.places.find((q) => q.id === outdoorId(f, t));
				ok(
					!!p === up,
					`${label(v)}: ${outdoorId(f, t)} does not match the stage`,
				);
				if (p)
					ok(s.talkable(p), `${label(v)}: cannot reach ${outdoorId(f, t)}`);
			}
		}
	}
	// 調べた ときの 文は その 物の もの（id の 頭が 同じ 施設＝post と post_city に 取られない）
	for (const f of FACILITIES)
		for (const t of f.outdoor ?? []) {
			const got = outdoorThingOf(outdoorId(f, t));
			ok(
				got?.f === f && got.t === t,
				`${outdoorId(f, t)} finds ${got ? outdoorId(got.f, got.t) : "nothing"}`,
			);
		}
});

test("施設の 外観（絵を 並べた 形）: 字は キーだけ・扉は 1つ・RPGEN の 絵は まとめた 絵の 群の 中・字は ほかの パレットに 上書き されない", () => {
	// まとめた 絵（rpgen-modern.png）の どの マスが どの 群か
	const owner = new Map<string, string>();
	for (const [name, [c, r, w, h]] of Object.entries(RPGEN_CELLS))
		for (let y = r; y < r + h; y++)
			for (let x = c; x < c + w; x++) owner.set(`${x},${y}`, name);
	for (const f of FACILITIES) {
		const g = f.look;
		if (g.kind !== "grid") continue;
		const keys = Object.keys(g.keys);
		ok(keys.length <= 96, `${f.id}: ${keys.length} keys`);
		for (const [y, r] of g.rows.entries())
			for (const k of r)
				ok(k === " " || k in g.keys, `${f.id}: row ${y} has "${k}"`);
		if (g.door) {
			const n = g.rows.join("").split(g.door).length - 1;
			ok(n === 1, `${f.id}: the door key "${g.door}" is on ${n} cells`);
		}
		for (const [k, layers] of Object.entries(g.keys)) {
			ok(layers.length > 0, `${f.id}: "${k}" draws nothing`);
			for (const ref of layers) {
				if (!ref.startsWith(`${RPGEN_IMG}#`)) continue;
				const [x, y, w, h] = ref.split("#")[1].split(",").map(Number);
				ok(
					x % 16 === 0 && y % 16 === 0 && w % 16 === 0 && h % 16 === 0,
					`${f.id}: "${k}" cuts ${ref} off the grid`,
				);
				ok(
					x + w <= RPGEN_SIZE[0] && y + h <= RPGEN_SIZE[1],
					`${f.id}: "${k}" cuts ${ref} outside the art`,
				);
				// 切る マスは みな 1つの 群の 中（となりの 群に はみ出さない）
				const groups = new Set<string | undefined>();
				for (let cy = y / 16; cy < (y + h) / 16; cy++)
					for (let cx = x / 16; cx < (x + w) / 16; cx++)
						groups.add(owner.get(`${cx},${cy}`));
				ok(
					groups.size === 1 && !groups.has(undefined),
					`${f.id}: "${k}" cuts ${ref} across ${[...groups].join("/")}`,
				);
			}
		}
	}
	const tiles = facilityTiles();
	for (let stage = 0; stage < TOWN_STAGES; stage++) {
		const pal = villagePalette({ stage, unlocked: ["shallow"], cleared: [] });
		for (const [ch, t] of Object.entries(tiles))
			ok(
				JSON.stringify(pal[ch]) === JSON.stringify(t),
				`stage ${stage}: facility "${ch}" is drawn as another tile`,
			);
	}
});

test("施設の 文: every line fits the village window", () => {
	const texts: [string, string][] = [];
	for (const f of FACILITIES) {
		if (f.door) texts.push([`${f.id} door`, f.door]);
		for (const [k, ls] of Object.entries(f.room?.lines ?? {}))
			for (const t of ls) texts.push([`${f.id}.${k}`, t]);
		for (const p of f.room?.people ?? [])
			for (const t of p.lines) texts.push([`${f.id}.${p.id}`, t]);
		for (const t of f.outdoor ?? [])
			for (const l of t.lines) texts.push([`${f.id}.${t.id}`, l]);
	}
	for (const t of [FISHING.cast, ...FISHING.catches])
		texts.push(["fishing", t]);
	for (const t of [
		GROUND_BAT.hr,
		GROUND_BAT.hit,
		GROUND_BAT.walk,
		GROUND_BAT.out,
		GROUND_BAT.popout,
		GROUND_BAT.derbyRule,
		fill(GROUND_BAT.derbyEnd, { n: 10, best: 10 }),
		fill(GROUND_BAT.derbyBest, { n: 10, best: 10 }),
	])
		texts.push(["bat", t]);
	// 1打席の 板の 下の 1行（1行だけ・22字まで）と 帯（13字まで）
	const vars = { p: "原住民", kind: "ストレート……？", kmh: 151, m: 135 };
	const notes: [string, string][] = [];
	const collect = (where: string, v: unknown): void => {
		if (typeof v === "string") notes.push([where, v]);
		else if (Array.isArray(v))
			v.forEach((x, i) => {
				collect(`${where}[${i}]`, x);
			});
		else if (v && typeof v === "object")
			for (const [k, x] of Object.entries(v))
				if (k !== "banner") collect(`${where}.${k}`, x);
	};
	collect("BATTING", BATTING);
	ok(notes.length >= 30, `only ${notes.length} batting notes`);
	for (const [where, n] of notes) {
		const t = fill(n, vars);
		ok(!t.includes("\n"), `${where}: more than 1 line`);
		ok(width(t) <= 22, `${where}: "${t}" is ${width(t)} wide`);
	}
	for (const [k, b] of Object.entries(BATTING.banner)) {
		const t = fill(b, { n: 10 });
		ok(width(t) <= 13, `BATTING.banner.${k}: "${t}" is ${width(t)} wide`);
	}
	for (const drink of VENDING.drinks)
		texts.push(["vending", fill(VENDING.got, { drink })]);
	texts.push(["vending", VENDING.drank]);
	for (const drink of DRINK_BAR.drinks)
		texts.push(["drink bar", fill(DRINK_BAR.got, { drink })]);
	texts.push(["drink bar", DRINK_BAR.drank]);
	fitsWindow(texts);
});

// ───────── 1打席（ui/minigames/batting.ts。板は 画面が 要るので、決まりの 純粋な 関数と 絵の 置き場を 調べる） ─────────

const PITCH_KINDS: readonly PitchKind[] = ["straight", "fast", "curve", "fork"];
const BALL_KINDS: readonly (BallKind | null)[] = [
	null,
	"wide",
	"high",
	"bounce",
];
const pitchOf = (
	kind: PitchKind,
	ball: BallKind | null,
	side: -1 | 1 = 1,
): Pitch => ({ kind, ball, side, flight: 800, kmh: 120 });

test("1打席: timing windows, outcomes and the count", () => {
	const w = { perfect: 20, good: 60, edge: 100 };
	ok(timingOf(1000, 1000) === -LAG_MS, "timingOf does not subtract the lag");
	ok(timingOf(1100, 1000) === 100 - LAG_MS, "late is not positive");
	ok(
		timingOf(1100, 1000, true) === 100 - LAG_MS - TOUCH_LAG_MS,
		"a tap does not subtract the touch lag",
	);
	for (const [d, c] of [
		[0, "perfect"],
		[20, "perfect"],
		[-20, "perfect"],
		[21, "good"],
		[-60, "good"],
		[61, "edge"],
		[-100, "edge"],
		[101, "miss"],
		[-101, "miss"],
	] as const)
		ok(contactOf(d, w) === c, `contactOf(${d}) is ${contactOf(d, w)}`);
	const s = pitchOf("straight", null);
	for (const [c, d, p, o] of [
		["perfect", 0, s, "hr"],
		["perfect", 0, pitchOf("straight", "bounce"), "whiff"],
		["good", 30, pitchOf("curve", "bounce"), "whiff"],
		["good", 30, pitchOf("straight", "wide"), "popout"],
		["perfect", -5, pitchOf("fork", "high"), "popout"],
		["edge", 80, s, "foul"],
		["edge", -80, pitchOf("straight", "wide"), "foul"],
		["miss", 300, s, "whiff"],
		// よい 当たりの 帯：芯に 近い ほうから ツーベース・ヒット・ゴロ
		["good", 34, s, "double"],
		["good", -35, s, "single"],
		["good", 48, s, "single"],
		["good", -49, s, "grounder"],
		["good", 60, s, "grounder"],
	] as const)
		ok(
			outcomeOf(c, d, p, w) === o,
			`${c} ${d} ${p.kind}/${p.ball}: ${outcomeOf(c, d, p, w)}, not ${o}`,
		);
	ok(takeOutcome(s) === "strike", "a strike taken is not a strike");
	ok(
		takeOutcome(pitchOf("fast", "high")) === "ball",
		"a high ball taken is not a ball",
	);
	const after = (b: number, st: number, o: Call) =>
		applyOutcome({ b, s: st }, o);
	const foul2 = after(1, 2, "foul");
	ok(
		foul2.st.s === 2 && foul2.end === null,
		"a foul at 2 strikes does not stay at 2 strikes",
	);
	ok(after(0, 0, "foul").st.s === 1, "a foul at 0 strikes is not a strike");
	ok(after(3, 2, "whiff").end === "k", "a whiff at 2 strikes is not a K");
	ok(after(0, 2, "strike").end === "k", "a called third strike is not a K");
	ok(
		after(0, 1, "strike").end === null && after(0, 1, "strike").st.s === 2,
		"the second strike",
	);
	ok(after(3, 0, "ball").end === "walk", "ball four is not a walk");
	ok(after(2, 2, "ball").end === null, "ball three ends the at-bat");
	ok(after(0, 0, "hr").end === "hr", "a home run");
	for (const o of ["double", "single", "grounder"] as const)
		ok(after(1, 1, o).end === "hit", `${o} is not a hit`);
	ok(after(0, 0, "popout").end === "out", "a popout is not an out");
});

test("1打席: every pitch reaches the plate on time; strikes cross the zone and balls miss it; batted balls land where they should", () => {
	ok(Math.abs(proj(0, 0, 0).y - 124) < 0.5, "the plate is not at y 124");
	const zt = proj(-0.25, 0, 1.05);
	const zb = proj(0.25, 0, 0.45);
	ok(
		Math.round(zt.x) === 114 &&
			Math.round(zb.x) === 126 &&
			Math.abs(zt.y - 99.5) < 1 &&
			Math.abs(zb.y - 113.5) < 1,
		`the zone box is (${zt.x},${zt.y})-(${zb.x},${zb.y})`,
	);
	for (const [who, def] of Object.entries(PITCHER_DEFS) as [
		string,
		PitcherDef,
	][])
		for (const kind of PITCH_KINDS)
			for (const ball of BALL_KINDS)
				for (const side of [-1, 1] as const) {
					const p: Pitch = {
						kind,
						ball,
						side,
						flight: def.flight[kind] ?? def.flight.straight,
						kmh: def.kmh[kind] ?? def.kmh.straight,
					};
					const at = `${who} ${kind}/${ball}/${side}`;
					const e = ballAt(p, 1);
					ok(Math.abs(e.Z) < 1e-9, `${at}: Z ${e.Z} at the plate`);
					let prev = Number.POSITIVE_INFINITY;
					for (let i = 0; i <= 60; i++) {
						const b = ballAt(p, i / 50);
						ok(b.Z <= prev + 1e-9, `${at}: the ball goes back at u ${i / 50}`);
						prev = b.Z;
					}
					ok(
						inZone(e) === (ball === null),
						`${at}: ends at X ${e.X.toFixed(2)} h ${e.h.toFixed(2)}`,
					);
					if (ball === "bounce") ok(e.h < 0.45, `${at}: bounces too high`);
				}
	// 球の 選び方：関所の 1球目は まっすぐの ストライク、ボールは その 人の 球だけ、競争は ストライクだけ
	let seed = 99;
	const rnd = () => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		return seed / 0x7fffffff;
	};
	for (const [who, def] of Object.entries(PITCHER_DEFS) as [
		string,
		PitcherDef,
	][])
		for (let n = 0; n < 400; n++) {
			const p = pickPitch(def, n, rnd);
			ok(
				def.mix.some(([k]) => k === p.kind),
				`${who} throws ${p.kind}`,
			);
			ok(
				p.ball === null || def.ballKinds.includes(p.ball),
				`${who} throws a ${p.ball} ball`,
			);
			ok(p.flight === def.flight[p.kind], `${who} ${p.kind} flight`);
			const q = pickPitch(def, n, rnd, true);
			ok(q.ball === null, `${who}: a ball in the derby`);
		}
	// 打球：どれも フェアの 中、ホームランは フェンスの 外、凡打は 内野、ヒットは 外野の 手前まで
	for (const w of [...Object.values(PITCHER_DEFS).map((d) => d.win), DERBY_WIN])
		for (const kmh of [71, 98, 132, 151])
			for (let i = 0; i < 40; i++) {
				const r = i / 39;
				const dHr = (r * 2 - 1) * w.perfect;
				const dGood =
					(r < 0.5 ? -1 : 1) * (w.perfect + 1 + r * (w.good - w.perfect));
				for (const [o, d] of [
					["hr", dHr],
					["double", dGood],
					["single", dGood],
					["grounder", dGood],
					["popout", dGood],
				] as const) {
					const bb = battedBall(o, d, w, kmh, rnd);
					ok(Math.abs(bb.theta) <= 45, `${o}: θ ${bb.theta}`);
					if (o === "hr") ok(bb.dist > 95, `hr: ${bb.dist} m`);
					else if (o === "popout") ok(bb.dist <= 35, `popout: ${bb.dist} m`);
					else if (o === "grounder")
						ok(bb.dist >= 55, `grounder: ${bb.dist} m`);
					else ok(bb.dist >= 45, `${o}: ${bb.dist} m`);
				}
			}
});

test("1打席: やきう is not a sure thing, the derby gives a few home runs", () => {
	// 人の まね（押す 時の ずれ：平均と ばらつき ms。球が 本塁に 来た 時から はかる）。数は 決まった 種で 毎回 同じ
	let seed = 7;
	const rnd = () => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		return seed / 0x7fffffff;
	};
	const gauss = () => {
		let u = 0;
		let v = 0;
		while (!u) u = rnd();
		while (!v) v = rnd();
		return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
	};
	type Model = {
		err: Record<PitchKind, readonly [number, number]>;
		swingBall: Record<BallKind, number>;
	};
	// ふつうに キーで 打つ 人
	const casual: Model = {
		err: {
			straight: [20, 60],
			fast: [35, 70],
			curve: [0, 75],
			fork: [-45, 85],
		},
		swingBall: { bounce: 0.35, wide: 0.45, high: 0.45 },
	};
	const swingAt = (m: Model, kind: PitchKind) => {
		const [mu, sd] = m.err[kind];
		return timingOf(1000 + mu + gauss() * sd, 1000);
	};
	const atBatSim = (def: PitcherDef, m: Model) => {
		let st = { b: 0, s: 0 };
		for (let n = 0; n < 60; n++) {
			const p = pickPitch(def, n, rnd);
			const swing = p.ball ? rnd() < m.swingBall[p.ball] : rnd() < 0.95;
			let call: Call = takeOutcome(p);
			if (swing) {
				const d = swingAt(m, p.kind);
				call = outcomeOf(contactOf(d, def.win), d, p, def.win);
			}
			const r = applyOutcome(st, call);
			st = r.st;
			if (r.end) return r.end;
		}
		return "k";
	};
	const N = 3000;
	const winRate = (def: PitcherDef, m: Model) => {
		let win = 0;
		for (let i = 0; i < N; i++) {
			const r = atBatSim(def, m);
			if (r === "hr" || r === "hit" || r === "walk") win++;
		}
		return win / N;
	};
	const yakiu = winRate(PITCHER_DEFS.yakiu, casual);
	ok(yakiu >= 0.55 && yakiu <= 0.95, `やきう, casual: ${yakiu}`);
	// ホームラン競争（10球。芯だけ 数える）
	let hrs = 0;
	for (let i = 0; i < N; i++)
		for (let n = 0; n < 10; n++) {
			const p = pickPitch(PITCHER_DEFS.yakiu, n, rnd, true);
			const d = swingAt(casual, p.kind);
			if (outcomeOf(contactOf(d, DERBY_WIN), d, p, DERBY_WIN) === "hr") hrs++;
		}
	const avg = hrs / N;
	ok(avg >= 1.5 && avg <= 4, `the derby, casual: ${avg} home runs per 10`);
});

test("1打席: the field view maps metres to the sheet, the camera stays on it, sprites face the way they move", () => {
	const h = toField(0, 0);
	ok(h.x === 180 && h.y === 252, `home is at (${h.x},${h.y})`);
	ok(toField(0, 95).y === 62, `the centre fence is at y ${toField(0, 95).y}`);
	ok(toField(10, 0).x === 200, "1m is not 2px");
	let seed = 3;
	const rnd = () => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		return seed / 0x7fffffff;
	};
	let cam = { x: 60, y: 130 };
	for (let i = 0; i < 500; i++) {
		const target = { x: rnd() * 600 - 200, y: rnd() * 600 - 200 };
		cam = fieldCam(cam, target, rnd() * 200);
		ok(
			cam.x >= 0 && cam.x <= 120 && cam.y >= 0 && cam.y <= 130,
			`the camera left the field: (${cam.x},${cam.y})`,
		);
	}
	const goal = { x: 50, y: 70 };
	let c = { x: 0, y: 0 };
	for (let i = 0; i < 60; i++) c = fieldCam(c, goal, 16);
	ok(
		Math.abs(c.x - goal.x) < 0.5 && Math.abs(c.y - goal.y) < 0.5,
		`the camera does not reach its target: (${c.x},${c.y})`,
	);
	const jump = fieldCam({ x: 0, y: 0 }, goal, 140);
	ok(
		jump.x === 50 && jump.y === 70,
		"a long frame does not land on the target",
	);
	const edge = fieldCam({ x: 60, y: 60 }, { x: -50, y: 999 }, 500);
	ok(
		edge.x === 0 && edge.y === 130,
		`an outside target: (${edge.x},${edge.y})`,
	);
	for (const [vx, vz, dir] of [
		[1, 0, "right"],
		[-1, 0, "left"],
		[0, 1, "up"],
		[0, -1, "down"],
		[2, 1, "right"],
		[-2, -1, "left"],
		[1, 2, "up"],
		[-1, -2, "down"],
		[1, 1, "up"],
		[-1, -1, "down"],
		[0, 0, "down"],
	] as const)
		ok(walkDir(vx, vz) === dir, `walkDir(${vx},${vz}) is ${walkDir(vx, vz)}`);
});

test("グラウンドの マウンド: 調べると 文 → 1打席・ホームラン競争・やめる、やめるなら 板を 出さずに おわる", async () => {
	const view: VillageView = {
		stage: TOWN_STAGES - 1,
		unlocked: ["shallow"],
		cleared: REVIVE_AREAS.map((a) => a.dungeon),
	};
	const f = FACILITIES.find((x) =>
		x.outdoor?.some((t) => t.play === "batting"),
	);
	const mound = f?.outdoor?.find((t) => t.play === "batting");
	ok(f && mound, "no mound to bat at");
	if (!f || !mound) return;
	const ev = (buildVillage(view, {} as Ctx).events ?? []).find(
		(e) => e.id === outdoorId(f, mound),
	);
	ok(ev?.run, "the mound cannot be examined");
	if (!ev?.run) return;
	const { s, log } = fakeStory({ pick: GROUND_BAT.menu.length - 1 });
	await ev.run(s);
	ok(
		JSON.stringify(log) ===
			JSON.stringify([
				...mound.lines.map((l) => `narrate: ${l}`),
				`choose ${GROUND_BAT.menu.join("/")}`,
			]),
		`the mound:\n${log.join("\n")}`,
	);
});

test("1打席: the sprite sheet is 1024x432, every cell fits on it and none overlap", () => {
	ok(BB_SHEET.startsWith("pub:"), `${BB_SHEET} is not bundled`);
	const png = readFileSync(join(process.cwd(), "public", BB_SHEET.slice(4)));
	ok(png.toString("ascii", 12, 16) === "IHDR", "not a PNG");
	const W = png.readUInt32BE(16);
	const H = png.readUInt32BE(20);
	ok(W === 1024 && H === 432, `the sheet is ${W}x${H}`);
	const cells = Object.entries(BB_SPR).map(([k, c]) => ({
		k,
		x0: c.x,
		y0: c.y,
		x1: c.x + c.w * c.n,
		y1: c.y + c.h,
	}));
	for (const c of cells)
		ok(
			c.x0 >= 0 && c.y0 >= 0 && c.x1 <= W && c.y1 <= H,
			`${c.k} runs off the sheet`,
		);
	for (let i = 0; i < cells.length; i++)
		for (let j = i + 1; j < cells.length; j++) {
			const a = cells[i];
			const b = cells[j];
			ok(
				a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0,
				`${a.k} overlaps ${b.k}`,
			);
		}
	for (const k of [
		"walkKiriko",
		"walkGen",
		"walkYakiu",
		"walkNanashi",
	] as const)
		ok(
			BB_SPR[k].w === 32 && BB_SPR[k].h === 64,
			`${k} is not a 32x64 walk sheet`,
		);
	for (const [k, i] of Object.entries(BB_POSE))
		ok(i < BB_SPR.pose.n, `pose ${k} is past the poses`);
	for (const [k, i] of Object.entries(BB_FX))
		ok(i < BB_SPR.fx.n, `fx ${k} is past the effects`);
});

test("建物の 扉: every building door is stepped on from its stage, and every room lets Kiriko out onto the road below its door", () => {
	for (const v of VIEWS) {
		const s = survey(v);
		for (const [id, door] of [
			["cafe", "door_cafe"],
			["hut", "door_hut"],
			["music", "door_music"],
			["bookstore", "door_books"],
			["bath", "door_bath"],
			["store", "door_store"],
			["shop", "door_shop"],
		] as const) {
			const p = s.places.find((q) => q.id === door);
			ok(
				!!p === v.stage >= ROOM_FROM[id],
				`${label(v)}: ${door} does not match the stage`,
			);
			if (!p) continue;
			ok(
				p.trigger === "touch" && s.reachable(p.x, p.y),
				`${label(v)}: cannot step on ${door}`,
			);
			// 出ると 扉の 1つ下で 下を 向く（どの 部屋も 同じ。ROOM_OUTSIDE は 扉の 所を 書き写している）
			const o = ROOM_OUTSIDE[id];
			ok(
				o.x === p.x && o.y === p.y + 1 && o.dir === "down",
				`${label(v)}: out of ${id} at (${o.x},${o.y}) ${o.dir}, not below ${door} (${p.x},${p.y})`,
			);
		}
		for (const id of ROOM_IDS) {
			if (v.stage < ROOM_FROM[id]) continue;
			const o = ROOM_OUTSIDE[id];
			ok(
				s.reachable(o.x, o.y),
				`${label(v)}: out of ${id} onto a cell she cannot stand on (${o.x},${o.y})`,
			);
		}
	}
});

test("建物に 入る・出る: door text once, a door sound and a fade, then out where the room says", async () => {
	for (const id of ROOM_IDS) {
		const { s, log } = fakeStory();
		await enterRoom(id)(s);
		const e = roomEntry(id);
		ok(
			inOrder(log, [
				`narrate: ${ROOM_DOOR[id]}`,
				`se ${ROOM_DOOR_SE[id]}`,
				"fadeOut",
				`warp ${id} ${e.x},${e.y} up`,
				"fadeIn",
			]),
			`${id}: the way in:\n${log.join("\n")}`,
		);
		log.length = 0;
		await enterRoom(id)(s);
		ok(!log.some((l) => l.startsWith("narrate")), `${id}: door text again`);
		log.length = 0;
		await leaveRoom(id)(s);
		const o = ROOM_OUTSIDE[id];
		ok(
			inOrder(log, [
				`se ${ROOM_DOOR_SE[id]}`,
				"fadeOut",
				`warp village ${o.x},${o.y} ${o.dir}`,
				"fadeIn",
			]),
			`${id}: the way out:\n${log.join("\n")}`,
		);
	}
});

test("倉庫・常識堂の 奥: 台の 横の 扉を 踏んで 入る（倉庫の 窓口は ンゴ姉。ライバルの ロゼ・シヨは 話すだけ）", async () => {
	const DOORS = [
		["store", "door_store", VILLAGE_SPOTS.storeDoor],
		["shop", "door_shop", VILLAGE_SPOTS.shopDoor],
	] as const;
	// 地図：建った 段から 扉が あり、上は 壁。扉と その 1つ下（出てくる マス）へ 通りから 歩いて 行ける
	for (const v of VIEWS) {
		const s = survey(v);
		for (const [id, door, [x, y]] of DOORS) {
			const p = s.places.find((q) => q.id === door);
			ok(
				!!p === v.stage >= ROOM_FROM[id],
				`${label(v)}: ${door} does not match the stage`,
			);
			if (!p) continue;
			ok(
				p.x === x && p.y === y && p.trigger === "touch",
				`${label(v)}: ${door} is at (${p.x},${p.y}), not on its spot`,
			);
			ok(
				s.tile(x, y)?.passable && !s.tile(x, y - 1)?.passable,
				`${label(v)}: ${door} is not a door in a wall`,
			);
			ok(
				s.reachable(x, y) && s.reachable(x, y + 1),
				`${label(v)}: cannot walk up to ${door}`,
			);
		}
	}
	// 入る：扉の 文（銀行の 段は 貸金庫の 文）→ 扉の 音 → 中へ。店番は 話すだけ（選ぶ 窓も 中への 移動も ない）
	await withStorageAsync(async () => {
		setProgress(["shallow"]);
		for (const stage of [2, 4, 5, 6, BANK_FROM]) {
			putTown({ stage });
			// ンゴ姉・ロゼは パン板・シヨは きのこ板で 帰ってきて いる
			const v: VillageView = {
				stage,
				unlocked: ["shallow"],
				cleared: ["shallow", "kinoko"],
			};
			const events = buildVillage(v, {} as Ctx).events ?? [];
			for (const [id, door] of DOORS) {
				const ev = events.find((e) => e.id === door);
				ok(
					!!ev === stage >= ROOM_FROM[id],
					`stage ${stage}: the ${door} event does not match the stage`,
				);
				if (!ev) continue;
				ok(
					ev.trigger === "touch" && ev.through && ev.run,
					`stage ${stage}: ${door} is not stepped on`,
				);
				const { s, log } = fakeStory({ at: [ev.x, ev.y] });
				await ev.run?.(s);
				const e = roomEntry(id);
				const text =
					id === "store" && stage >= BANK_FROM ? BANK.door : ROOM_DOOR[id];
				ok(
					inOrder(log, [
						`narrate: ${text}`,
						`se ${id === "store" && stage >= BANK_FROM ? "doorSteel" : ROOM_DOOR_SE[id]}`,
						`warp ${id} ${e.x},${e.y} up`,
					]),
					`stage ${stage} ${door}:\n${log.join("\n")}`,
				);
			}
			// ンゴ姉は 倉庫の 窓口（倉庫を つかう・話す・やめる）。「話す」を えらぶと ふだんの 話。
			// ライバルの ロゼ・シヨは 話すだけ（店の 仕事は しない：TOWN.md §0.4）。どれも 中へは 移らない
			for (const id of ["mob_ngoane", "shiyo", "roze"] as const) {
				const ev = events.find((e) => e.id === id);
				ok(!!ev?.run, `stage ${stage}: ${id} is not there`);
				const { s, log } = fakeStory({ pick: 1 });
				await ev?.run?.(s);
				const says = log.filter((l) => l.startsWith("say "));
				const chose = log.some((l) => l.startsWith("choose"));
				ok(
					(id === "mob_ngoane"
						? says[0] === `say null: ${STORE_DESK.ask}` &&
							says.length >= 2 &&
							chose
						: says.length > 0 && !chose) &&
						!log.some((l) => l.startsWith("warp")),
					`stage ${stage} ${id}:\n${log.join("\n")}`,
				);
			}
		}
	});
});

test("タップで 歩く 道は、行き先で ない 扉・出口を 踏まない（通りすがりに 倉庫や 常識堂の 奥へ 入らない）", () => {
	for (const v of VIEWS) {
		const s = survey(v);
		const touch = (x: number, y: number) =>
			s.places.some((p) => p.trigger === "touch" && p.x === x && p.y === y);
		// engine/field.ts の Field.findPath を 村の データで 呼ぶ（ui/village/village.ts の walkTo と 同じく 踏む 所を よける）
		const field: Field = Object.assign(Object.create(Field.prototype), {
			w: VILLAGE_W,
			h: VILLAGE_H,
			canEnter: (x: number, y: number) => s.canEnter(x, y),
		});
		// 扉の 下の 通り・出てくる 所・起きる 所から、北の 出口・本館の 扉・出口の 立て札・崖の 下の 道へ
		const starts: (readonly [number, number])[] = [
			[25, 19],
			[16, 19],
			[23, 19],
			VILLAGE_SPOTS.boot,
			...Object.values(ROOM_OUTSIDE).map((o) => [o.x, o.y] as const),
		];
		const goals: (readonly [number, number])[] = [
			VILLAGE_SPOTS.exit,
			...VILLAGE_SPOTS.hallDoors,
			VILLAGE_SPOTS.exitSign,
			[24, 12],
			[17, 11],
		];
		for (const [sx, sy] of starts) {
			if (!s.reachable(sx, sy) || touch(sx, sy)) continue;
			for (const [gx, gy] of goals) {
				const path =
					field.findPath(sx, sy, gx, gy, {} as Actor, false, touch) ?? [];
				ok(
					path.length,
					`${label(v)}: no way from (${sx},${sy}) to (${gx},${gy}) around the doors`,
				);
				let [x, y] = [sx, sy];
				for (const d of path.slice(0, -1)) {
					x += DIR_VEC[d].dx;
					y += DIR_VEC[d].dy;
					ok(
						!touch(x, y),
						`${label(v)}: (${sx},${sy}) → (${gx},${gy}) steps on (${x},${y})`,
					);
				}
			}
		}
	}
});

test("一杯を まぜる: hand the herb, the master spins with a drum roll, it bubbles, flashes and the jingle plays", async () => {
	await withStorageAsync(async () => {
		forgetCafeMemo();
		const { s, log } = fakeStory();
		const herb = { kind: "h_heal" } as Item;
		const drink = CAFE_DRINKS.h_heal;
		await mixScene(s, herb, drink);
		ok(
			inOrder(log, [
				`narrate: キリコは${defOf("h_heal").name}をわたした。`,
				`look ${CAFE_MASTER.join(",")}`,
				`say null: ${fill(MASTER_MSG.take, { herb: defOf("h_heal").name })}`,
				`narrate: ${MASTER_MSG.spin}`,
				"se mix",
				"move master LDRULDRULDRULDRULDRU",
				"se bubble",
				`narrate: ${MASTER_MSG.shake}`,
				"se glass",
				"se served",
				`say null: ${fill(MASTER_MSG.done, { drink: drink.name })}`,
				"look kiriko",
			]),
			`mix:\n${log.join("\n")}`,
		);
		// 4杯目は 目が まわる
		for (let i = 0; i < 2; i++) await mixScene(fakeStory().s, herb, drink);
		const dizzy = fakeStory();
		await mixScene(dizzy.s, herb, drink);
		ok(
			dizzy.log.includes(`say null: ${MASTER_MSG.dizzy}`),
			`the 4th cup did not make the master dizzy:\n${dizzy.log.join("\n")}`,
		);
	});
});

/** 抽選に 渡す 話（2人で 話せる 仲間どうしの 話・住人が その 仲間と 話せる 店での 話）。 */
const layoutTalks = {
	pairTalk: (a: Speaker, b: Speaker) =>
		CAFE_TALKS.find(
			(t) => t.cast.length === 2 && t.cast.includes(a) && t.cast.includes(b),
		)?.id,
	mobTalk: (id: MobId, who: Speaker) =>
		CAFE_MOBS[id].talks.find((t) => t.with === who)?.key,
};

test("喫茶の 客: drawn per return (same return → same seats), 2〜5 friends, one always free to sit by, chats have a talk, nobody shares a cell", () => {
	withStorage(() => {
		// みんな 帰ってきた 町
		setProgress([...DUNGEON_IDS], [], [...DUNGEON_IDS]);
		const sets = new Set<string>();
		let chats = 0;
		let nanashi = 0;
		let all = 0;
		for (let at = 1000; at < 1200; at++) {
			const l = cafeLayout(7, at, layoutTalks);
			ok(
				JSON.stringify(l) === JSON.stringify(cafeLayout(7, at, layoutTalks)),
				`${at}: not the same for the same return`,
			);
			const friends = l.friends.flatMap((f) =>
				f.partner && !(MOB_IDS as string[]).includes(f.partner)
					? [f.who, f.partner]
					: [f.who],
			);
			ok(
				friends.length >= 2 && new Set(friends).size === friends.length,
				`${at}: friends ${friends.join(",")}`,
			);
			if (friends.length === 5) all++;
			sets.add([...friends].sort().join(","));
			ok(
				l.friends.some((f) => !f.partner),
				`${at}: nobody has a free seat beside`,
			);
			const cells: string[] = [];
			for (const f of l.friends) {
				const seat = CAFE_SLOTS[f.slot];
				ok(seat, `${at}: ${f.who} has no seat`);
				cells.push(seat.at.join(","));
				if (!f.partner) continue;
				chats++;
				cells.push(seat.kiriko.join(","));
				const isMob = (MOB_IDS as string[]).includes(f.partner);
				ok(
					isMob
						? CAFE_MOBS[f.partner as MobId].talks.some(
								(t) => t.key === f.talk && t.with === f.who,
							)
						: CAFE_TALKS.some(
								(t) =>
									t.id === f.talk &&
									t.cast.includes(f.who) &&
									t.cast.includes(f.partner as Speaker),
							),
					`${at}: ${f.who} and ${f.partner} chat about nothing`,
				);
			}
			for (const p of l.patrons) {
				ok(!!MOBS[p.id], `${at}: ${p.id} is not a resident`);
				cells.push(CAFE_PATRON_SPOTS[p.spot].at.join(","));
			}
			for (const n of l.nanashi) {
				nanashi++;
				const spot = CAFE_PATRON_SPOTS[n.spot];
				cells.push(spot.at.join(","));
				if (n.pair) cells.push(spot.kiriko.join(","));
			}
			ok(new Set(cells).size === cells.length, `${at}: two share a cell`);
		}
		ok(sets.size > 5, `only ${sets.size} different sets of friends`);
		ok(
			chats > 0 && nanashi > 0 && all > 0,
			`chats ${chats} / nanashi ${nanashi} / all five ${all}`,
		);
		// はじめの 町：仲間は 残った やきうだけ。住人は ぷゆゆと 原住民、名無しの 客は まだ いない
		setProgress(["shallow"]);
		for (let at = 1000; at < 1050; at++) {
			const l = cafeLayout(7, at, layoutTalks);
			ok(
				l.friends.every((f) => f.who === "nanj" && !f.partner) &&
					l.patrons.every((p) => p.id === "puyu" || p.id === "shobon") &&
					!l.nanashi.length,
				`${at}: the empty town's cafe has ${JSON.stringify(l)}`,
			);
		}
	});
});

test("建物の 中の 文: every line fits the village window, talks are 1〜4 windows, and every resident has cafe lines", () => {
	const longest = Object.values(CAFE_DRINKS)
		.map((d) => d.name)
		.sort((x, y) => y.length - x.length)[0];
	const texts: [string, string][] = [];
	for (const [room, table] of Object.entries(ROOM_MSG))
		for (const [k, v] of Object.entries(table))
			for (const t of v)
				texts.push([`ROOM_MSG.${room}.${k}`, fill(t, { next: "倉庫Part2" })]);
	for (const t of planLines(0)) texts.push(["plan", t]);
	for (const [k, v] of Object.entries(BANK.msg))
		for (const t of v) texts.push([`BANK.msg.${k}`, t]);
	texts.push(["bank door", BANK.door]);
	for (const [k, t] of Object.entries(ROOM_DOOR)) texts.push([`door ${k}`, t]);
	for (const [k, t] of Object.entries(MASTER_MSG))
		texts.push([
			`master ${k}`,
			fill(t, { herb: "水分補給の草", drink: longest, name: "おんすちゃん" }),
		]);
	for (const [k, t] of Object.entries(SEAT_MSG))
		texts.push([`seat ${k}`, fill(t, { name: "フェリス" })]);
	for (const [k, ls] of Object.entries(CAFE_GREET))
		for (const t of ls) texts.push([`greet ${k}`, t]);
	for (const t of Object.values(CHAT_MSG))
		texts.push(["chat", fill(t, { a: "おんすちゃん", b: "フェリス" })]);
	for (const ls of NANASHI_CAFE.pair)
		for (const t of ls) texts.push(["nanashi", t]);
	for (const t of NANASHI_CAFE.solo) texts.push(["nanashi", t]);
	for (const [k, d] of Object.entries(CAFE_DRINKS))
		texts.push([`taste ${k}`, d.taste]);
	for (const id of MOB_IDS) {
		const c = CAFE_MOBS[id];
		ok(
			c.hello && c.idle && c.sip && c.treat.includes("{drink}"),
			`${id}: cafe lines missing`,
		);
		texts.push([`${id} hello`, c.hello], [`${id} idle`, c.idle]);
		texts.push([`${id} sip`, c.sip]);
		texts.push([`${id} treat`, fill(c.treat, { drink: longest })]);
		ok(c.talks.length > 0, `${id}: no cafe talks`);
		ok(
			new Set(c.talks.map((t) => t.key)).size === c.talks.length,
			`${id}: two cafe talks share a key`,
		);
		for (const t of c.talks) {
			ok(
				t.lines.length >= 1 && t.lines.length <= 4,
				`${id}:${t.key} is ${t.lines.length} windows`,
			);
			for (const l of t.lines) texts.push([`${id}:${t.key}`, l.text]);
		}
	}
	fitsWindow(texts);
});

test("音楽室「ピアノ機能」: open only on weekends (a weekday note steps her back), the ending song after the main record, and its lines fit", async () => {
	for (const [wday, open] of [
		[2, false],
		[6, true],
		[0, true],
	] as const) {
		const restore = swapLocation(`?debug&wday=${wday}`);
		try {
			ok(isWeekend() === open, `wday ${wday}: weekend ${isWeekend()}`);
			const { s, log } = fakeStory({ at: VILLAGE_SPOTS.musicDoor });
			await enterMusic(s);
			if (open)
				ok(
					log.some((l) => l.startsWith("warp music")),
					`wday ${wday}: did not go in:\n${log.join("\n")}`,
				);
			else
				ok(
					inOrder(log, [`narrate: ${MUSIC_CLOSED}`, "move player d"]) &&
						!log.some((l) => l.startsWith("warp")),
					`wday ${wday}: went in on a weekday:\n${log.join("\n")}`,
				);
		} finally {
			restore();
		}
	}
	// ガイドの 童謡は どの 字も 音名（読めない 字で 旋律が 欠けない）
	for (const g of PIANO_GUIDES) {
		const tokens = g.notes.split(/\s+/).filter((t) => t !== "|");
		ok(
			guideKeys(g.notes).length === tokens.length && tokens.length >= 12,
			`${g.id}: ${guideKeys(g.notes).length} of ${tokens.length} notes read`,
		);
	}
	fitsWindow([
		["closed", MUSIC_CLOSED],
		["done", PIANO_DONE],
		...PIANO_MENU.map((t): [string, string] => ["menu", t]),
		...PIANO_GUIDES.map((t): [string, string] => ["guide", t.name]),
		...PIANO_MSG.nanashi.map((t): [string, string] => ["nanashi", t]),
		...PIANO_MSG.ren.map((t): [string, string] => ["ren", t]),
	]);
});

test("銭湯「ゆ」: women soak or change on free cells Kiriko can reach, men sit by the partition, and every line fits", () => {
	const rows = roomRows("bath");
	const s = surveyRoom("bath");
	const free = (x: number, y: number) => s.tile(x, y)?.passable;
	for (const v of VIEWS)
		for (const seed of [0, 1, 12345, 987654321]) {
			const lay = bathLayout(v, seed);
			const cells = lay.map((p) => `${p.at.x},${p.at.y}`);
			ok(new Set(cells).size === cells.length, `${label(v)}: two share a spot`);
			ok(
				new Set(lay.map((p) => p.who)).size === lay.length,
				`${label(v)}: someone is in the bath twice`,
			);
			for (const p of lay) {
				const ch = rows[p.at.y][p.at.x];
				ok(
					p.at.x > BATH_WALL && (p.place === "soak" ? ch === "~" : ch === ","),
					`${label(v)}: ${p.who} ${p.place} at (${p.at.x},${p.at.y}) on "${ch}"`,
				);
				const near = [
					[0, 1],
					[0, -1],
					[1, 0],
					[-1, 0],
				].some(
					([dx, dy]) =>
						p.at.x + dx > BATH_WALL &&
						free(p.at.x + dx, p.at.y + dy) &&
						!cells.includes(`${p.at.x + dx},${p.at.y + dy}`),
				);
				ok(near, `${label(v)}: cannot talk to ${p.who}`);
			}
		}
	// 男湯の 人は 仕切りの となり。女湯がわの 向かいは 湯で、仕切りは 台ごしに 話せる
	for (const m of BATH_SPOTS.menSoak) {
		ok(m.x === BATH_WALL - 1, "a man is not by the partition");
		ok(s.tile(BATH_WALL, m.y)?.counter, "the partition is not talkable");
		ok(free(BATH_WALL + 1, m.y), "Kiriko cannot stand across the partition");
	}
	ok(s.tile(...BATH_NOREN_M)?.passable, "the men's noren is not a doorway");
	fitsWindow([
		...Object.entries(BATH_WOMEN).flatMap(([w, t]) =>
			[...t.soak, ...t.dress].map((l): [string, string] => [w, l]),
		),
		...Object.entries(BATH_MEN).flatMap(([w, t]) =>
			t.map((l): [string, string] => [w, l]),
		),
		...BANDAI.welcome.map((l): [string, string] => ["bandai", l]),
		["bandai", BANDAI.stop],
		["soak", BATH_SOAK],
		["door", ROOM_DOOR.bath],
	]);
	for (const t of Object.values(BATH_WOMEN))
		for (const ls of [t.soak, t.dress])
			ok(ls.length >= 1 && ls.length <= 3, "a bath talk is too long");
});

test("喫茶の「あちらのお客様から」: only at the counter, from a friend at the counter; Kiriko may refuse, and after the talk she is back on her stool", async () => {
	const view = VIEWS.find((v) => v.stage >= 6) as VillageView;
	// カウンターの 2つの 席の うち、左は 話しこんでいて（そばで 聞く）、右は となりが 空いた 帰りを さがす
	const play = async (at: number, picks: number[]) => {
		let out: { log: string[]; x: number; y: number } | null = null;
		await withStorageAsync(async () => {
			setProgress(["shallow", "main"], [], ["shallow"]);
			forgetCafeMemo();
			putTown({ stage: view.stage });
			pushRecord({ at });
			const ev = buildCafe(view, {} as Ctx).events ?? [];
			const who = (x: number, y: number) =>
				ev.find((e) => e.x === x && e.y === y && e.trigger === "talk");
			const left = who(2, 5);
			if (!left || !who(3, 5) || !who(6, 5) || who(5, 5)) return;
			const f = fakeStory({ at: [2, 6] });
			let k = 0;
			f.s.choose = async (options) => {
				f.log.push(`choose ${options.join("/")}`);
				return picks[k++] ?? 0;
			};
			await left.run?.(f.s);
			out = { log: f.log, x: f.s.state.x, y: f.s.state.y };
			forgetCafeMemo();
		});
		return out as { log: string[]; x: number; y: number } | null;
	};
	let tried = 0;
	for (let at = 1; at < 4000 && tried < 3; at++) {
		const yes = await play(at, [0, 0]);
		if (!yes?.log.some((l) => l.includes("あちらのお客様からです"))) continue;
		tried++;
		ok(
			yes.log.some((l) => l === `choose ${GLASS_CHOICES.join("/")}`),
			"no choice to take the glass",
		);
		ok(
			onCafeCounter(yes.x, yes.y) && yes.x === 1 && yes.y === 5,
			`Kiriko ended at (${yes.x},${yes.y}), not on her stool`,
		);
		const no = await play(at, [0, 1]);
		const after = no?.log.slice(
			no.log.findIndex((l) => l.startsWith("choose 受け取る")),
		);
		ok(
			!!after?.some((l) => l.includes("首をふった")) &&
				!after.some((l) => l.includes("となりにすわった")),
			`refusing still sat down:\n${no?.log.join("\n")}`,
		);
		ok(no?.x === 1 && no.y === 5, "refusing moved Kiriko");
	}
	ok(tried > 0, "no return with a glass from the counter");
	// カウンターでは ない 席・住人の 席からは 届かない
	ok(!onCafeCounter(...CAFE_SLOTS[2].at), "a sofa is the counter");
	for (const p of CAFE_PATRON_SPOTS)
		ok(!onCafeCounter(...p.kiriko), "a patron sits at the counter");
});

test("施設の 客: residents visit one facility per return, the same return keeps the same lineup, and lineups change between returns", () => {
	const music = surveyRoom("music");
	for (const v of VIEWS) {
		const seen = new Set<string>();
		for (let at = 0; at < 40; at++) {
			const g = guestsOf(v, at * 7919);
			ok(
				JSON.stringify(g) === JSON.stringify(guestsOf(v, at * 7919)),
				`${label(v)}: the same return changed`,
			);
			const all = [
				...g.music,
				...g.books,
				...g.bath,
				...(g.stage ? [g.stage] : []),
			];
			ok(
				new Set(all).size === all.length,
				`${label(v)}: someone is in two places`,
			);
			ok(
				g.music.length + g.nanashi.music <= MUSIC_SEATS.length,
				`${label(v)}: more guests than seats`,
			);
			const room = booksRoom(v);
			if (room)
				ok(
					g.books.length <= BOOKS_BROWSE[room].length,
					`${label(v)}: more readers than spots`,
				);
			else ok(!g.books.length, `${label(v)}: readers before the bookstore`);
			for (const id of g.music) ok(!!MUSIC_GUESTS[id], `${id}: no music lines`);
			for (const id of g.books) ok(!!BOOKS_GUESTS[id], `${id}: no book lines`);
			for (const id of g.bath)
				ok(BATH_GUESTS.includes(id), `${id}: in the bath`);
			seen.add(JSON.stringify(g));
		}
		if (v.stage >= ROOM_FROM.music)
			ok(
				seen.size >= 10,
				`${label(v)}: only ${seen.size} lineups in 40 returns`,
			);
	}
	for (const at of MUSIC_SEATS)
		ok(music.tile(at.x, at.y)?.passable, `music seat (${at.x},${at.y})`);
	for (const id of ["bookstore", "library"] as const) {
		const s = surveyRoom(id);
		// 本棚の 絵は 2マスの 高さ（本棚の 1つ上に 立つと かくれる）
		const rows = roomRows(id);
		for (const at of BOOKS_BROWSE[id])
			ok(
				s.tile(at.x, at.y)?.passable && rows[at.y + 1][at.x] !== "B",
				`${id} spot (${at.x},${at.y})`,
			);
	}
	fitsWindow(
		[MUSIC_GUESTS, BOOKS_GUESTS, STAGE_LINES].flatMap((t) =>
			Object.entries(t).flatMap(([id, ls]) =>
				(ls ?? []).map((l): [string, string] => [id, l]),
			),
		),
	);
});

test("ことばの 辞典: every explanation is written as village windows (22 full-width × 2 lines, 1〜4 windows)", () => {
	for (const w of GLOSSARY) {
		const wins = descWindows(w.desc);
		ok(wins.length >= 1 && wins.length <= 4, `${w.id}: ${wins.length} windows`);
		fitsWindow(wins.map((t, i): [string, string] => [`${w.id} ${i}`, t]));
	}
});

test("本館の 野球の 本棚: every line fits the village window, each book is 1〜2 windows", () => {
	fitsWindow([["yakyu", YAKYU_SHELF.line]]);
	for (const b of YAKYU_SHELF.books) {
		ok(b.text.length >= 1 && b.text.length <= 2, `${b.title}: too long`);
		fitsWindow(b.text.map((t): [string, string] => [b.title, t]));
	}
});

// ───────────────── 裏の 筋を 追う 行（data/story/synopsis.ts） ─────────────────

test("live comments react to the run (low HP first, filler only sometimes) and fit one log line", () => {
	const base: LiveState = {
		hp: 30,
		maxHp: 30,
		hunger: 80,
		bare: false,
		kills: 2,
		runKills: 5,
		deaths: 0,
		outings: 1,
		depth: 4,
		floors: 12,
		up: false,
		hero: "キリコ",
		dungeon: "main",
		puyu: false,
	};
	const states: LiveState[] = [
		...(Object.keys(DUNGEONS) as DungeonId[]).map((dungeon) => ({
			...base,
			dungeon,
		})),
		{ ...base, puyu: true },
		base,
		{ ...base, hp: 5 },
		{ ...base, hunger: 5 },
		{ ...base, bare: true },
		{ ...base, kills: 9 },
		{ ...base, kills: 0, runKills: 0 },
		{ ...base, depth: 11 },
		{ ...base, up: true, depth: 11 },
		{ ...base, deaths: 99 },
		{ ...base, deaths: 4 },
		{ ...base, deaths: 45 },
		{ ...base, outings: 5 },
		{ ...base, outings: 15 },
		{ ...base, outings: 123 },
	];
	for (const x of states)
		for (let salt = 0; salt < 400; salt++) {
			const line = liveResLine(x, salt);
			if (line) ok(width(line) <= 24, `too long: ${line}`);
		}
	// あぶない ようすが 先
	ok(
		liveResLine({ ...base, hp: 5, hunger: 5 }, 0)?.includes("HP") ?? false,
		"low HP is not first",
	);
	// 出撃の 回数で つぶやきが かわる
	ok(
		liveResLine({ ...base, outings: 1 }, 0) !==
			liveResLine({ ...base, outings: 50 }, 0),
		"the filler does not escalate",
	);
	// 出る 割合：ようすに 合う 行が ない ときは 4階に 1回くらい、瀕死は 2階に 1回くらい
	const rate = (x: LiveState): number => {
		let n = 0;
		for (let salt = 0; salt < 1200; salt++)
			if (liveResLine(x, salt * 7919 + 13) !== null) n++;
		return n / 1200;
	};
	const quiet = rate(base);
	ok(quiet > 0.15 && quiet < 0.35, `filler rate ${quiet}`);
	const dying = rate({ ...base, hp: 5 });
	ok(dying > 0.4 && dying < 0.6, `low HP rate ${dying}`);
	// ぷゆゆ がらみは ひと言だけ
	for (let salt = 0; salt < 40; salt++) {
		const line = liveResLine({ ...base, puyu: true }, salt);
		ok(line === null || /^村のスレ「うゆ/.test(line), `puyu: ${line}`);
	}
});

test("story helpers for the hidden route fit the log and the map card, and follow the story order", () => {
	for (const [d, list] of Object.entries(DIVE_RES)) {
		const dg = DUNGEONS[d as DungeonId];
		const zones = BOARD_LOOKS[d as DungeonId].zones ?? [];
		const zoneStarts = zones.map((_, i) => (i ? zones[i - 1].last + 1 : 1));
		for (const r of list ?? []) {
			// ログは スマホで 全角24字くらい。2行に 折れない ように
			ok(width(diveResLine(r)) <= 24, `${d} ${r.at}: ${diveResLine(r)}`);
			// 底より 浅く、潜りはじめ（目的と わけ）・層の 札とは ちがう 階に
			ok(r.at > 1 && r.at <= dg.floors, `${d} ${r.at}: outside the board`);
			ok(!zoneStarts.includes(r.at), `${d} ${r.at}: same floor as a zone sign`);
		}
	}
	// 本筋の 名無しの レスは やきうと 名乗らない（正体は 電池板の てっぺんで わかる）。その 板を 持ち帰る 前だけ
	ok(
		diveResAt("main", 5, ["shallow"])?.who === "res",
		"the nanashi line is gone",
	);
	for (const d of ["shallow", "kinoko", "main", "deep"] as const)
		ok(
			!(DIVE_RES[d] ?? []).some((r) => r.who === "nanj"),
			`${d}: やきう is named before the reveal`,
		);
	ok(diveResAt("main", 6, ["main"]) === null, "res after the board is cleared");
	const mainOnly = synopsisHtml(["shallow"], [], ["shallow", "kinoko"]) ?? "";
	ok(mainOnly.includes("パン板") && mainOnly.includes("きのこ板"), mainOnly);
	for (const [d, why] of Object.entries(GOAL_WHY))
		ok(width(why ?? "") <= 22, `${d}: ${why}`);
	ok(goalWhy("main", ["main"]) === null, "why stays after clearing");
	ok(synopsisHtml([], []) === null, "synopsis before the first board");
	const end =
		synopsisHtml(["shallow", "kinoko", "main", "deep", "hidden"], []) ?? "";
	ok(end.includes("過去ログの底まで") && !end.includes("つぎ："), end);
	// 要約：本筋の いちばん 新しい 章だけ（板ごとに 並べない）
	const heads = [...end.matchAll(/<b>([^<]+)<\/b>/g)].map((m) => m[1]);
	ok(
		heads.length === 1 && heads[0] === "過去ログの底まで",
		`summary heads ${heads}`,
	);
	// 町の 進み（生き返った 通りの 数）が あらすじにも 出る（data/town/revival.ts）
	ok(end.includes("生き返った通り"), "no revived-street count in the synopsis");
	ok(
		zankiLine([]) === null &&
			zankiLine(["kinoko"])?.includes("残機：1") &&
			zankiLine(["kinoko", "deep"]) === null &&
			zankiLine(["kinoko", "deep", "festival"])?.includes("残機：99"),
		"the 残機 lines follow the side story",
	);
	ok(
		!(synopsisHtml(["shallow", "main"], []) ?? "").includes("／1000"),
		"the synopsis still counts toward 1000",
	);
});

test("飲食店の 品書き: 店ごとに 3〜6品・どの 文も 村の 窓に 収まる・絵は まとめた 品の 絵・品書きの ある 店には 店番が いて、店番の いる 店には 品書きが ある", () => {
	const texts: [string, string][] = [];
	for (const [id, m] of Object.entries(EAT_MENUS)) {
		ok(facilityById(id), `${id}: a menu without a facility`);
		for (const k of ["again", "no"] as const)
			texts.push([`${id}.${k}`, m[k]]);
		ok(
			m.dishes.length >= 3 && m.dishes.length <= 6,
			`${id}: ${m.dishes.length} dishes`,
		);
		for (const d of m.dishes) {
			ok(width(d.name) <= 9, `${id}: "${d.name}" is too long for a choice`);
			// 品書きは「名前　値段」（長い 名前は label）
			ok(
				width(dishLabel(d)) <= 9,
				`${id}: "${dishLabel(d)}" is too long for a choice`,
			);
			ok(
				Number.isInteger(d.price) && d.price >= 100 && d.price <= 3000,
				`${id}.${d.name}: price ${d.price}`,
			);
			texts.push([
				`${id}.short(${d.name})`,
				fill(m.short, { price: yen(d.price) }),
			]);
			ok(
				d.eat.length >= 1 && d.eat.length <= 2,
				`${id}.${d.name}: ${d.eat.length} windows`,
			);
			if (d.art) {
				// まとめた 品の 絵（RPGEN の rpgen-food.png か、手描きの diner.png。scripts/make-diner.mjs）
				const sheets: [string, readonly [number, number]][] = [
					[FOOD_IMG, FOOD_SIZE],
					[DINER_IMG, DINER_SIZE],
				];
				const sheet = sheets.find(([img]) => d.art?.startsWith(`${img}#`));
				ok(!!sheet, `${id}.${d.name}: ${d.art}`);
				const size = sheet?.[1] ?? [0, 0];
				const [x, y, w, h] = d.art.split("#")[1].split(",").map(Number);
				ok(
					w === 16 && h === 16 && x + w <= size[0] && y + h <= size[1],
					`${id}.${d.name}: cuts ${d.art} outside the art`,
				);
			}
			// おまじない（メイド喫茶）も 村の 窓に 収まる
			for (const c of d.magic ?? [])
				texts.push([`${id}.magic(${d.name})`, c.text]);
			texts.push([`${id}.order(${d.name})`, fill(m.order, { dish: d.name })]);
			for (const t of d.eat) texts.push([`${id}.eat(${d.name})`, t]);
		}
	}
	fitsWindow(texts);
	for (const f of FACILITIES) {
		const keeper =
			(f.room?.people ?? []).some((p) => p.play === "eat") ||
			(f.outdoor ?? []).some((t) => t.play === "eat" && t.sprite);
		const eats =
			keeper ||
			Object.values(f.room?.plays ?? {}).includes("eat") ||
			(f.outdoor ?? []).some((t) => t.play === "eat");
		ok(eats === !!EAT_MENUS[f.id], `${f.id}: eat plays and menu disagree`);
		ok(!eats || keeper, `${f.id}: a menu but nobody to take the order`);
		// 見える 外の 人（屋台の 店番）は 歩行グラと 名前欄つき
		for (const t of f.outdoor ?? [])
			if (t.sprite)
				ok(
					isWalkRef(t.sprite) && !!t.name,
					`${f.id}.${t.id}: a visible keeper needs a walk sprite and a name`,
				);
	}
});

/** 町の 売り上げ（財布の 元。engine/wallet.ts）を 置く。使った 額は 消さない。 */
const setTownYen = (points: number): void => {
	setTown(TOWN_STAGES - 1, points);
	forgetWalletMemo();
};

test("飲食店で 食べる: 店番は セリフ 1つ → 品書き → 注文 → チーン → 食べる 音と 地の文、食べた あとは again・やめたら no、券売機は 文の あと 品書き", async () => {
	await withStorageAsync(async () => {
		setTownYen(1_000_000);
		const view: VillageView = {
			stage: TOWN_STAGES - 1,
			unlocked: ["shallow"],
			cleared: REVIVE_AREAS.map((a) => a.dungeon),
		};
		const village = buildVillage(view, {} as Ctx).events ?? [];
		for (const [id, m] of Object.entries(EAT_MENUS)) {
			const f = facilityById(id);
			if (!f) continue;
			const room = f.room
				? (buildFacility(f, view, {} as Ctx).events ?? [])
				: [];
			const person = f.room?.people?.find((p) => p.play === "eat");
			const stall = f.outdoor?.find((t) => t.play === "eat" && t.sprite);
			const who = person ?? stall;
			const ev = person
				? room.find((e) => e.id === person.id)
				: stall && village.find((e) => e.id === outdoorId(f, stall));
			ok(who && ev?.run, `${id}: no keeper to talk to`);
			if (!who || !ev?.run) continue;
			const menu = `choose ${[...m.dishes.map(dishLabel), "やめる"].join("/")}`;
			const d = m.dishes[0];
			const { s, log } = fakeStory({ pick: 0 });
			await ev.run(s);
			ok(
				inOrder(log, [
					`say nanj: ${who.lines[0]}`,
					menu,
					`say nanj: ${fill(m.order, { dish: d.name })}`,
					"se glass",
					"se eat",
					...d.eat.map((t) => `narrate: ${t}`),
				]),
				`${id}: the first meal:\n${log.join("\n")}`,
			);
			// 2回目は again
			log.length = 0;
			await ev.run(s);
			ok(
				inOrder(log, [`say nanj: ${m.again}`, menu]),
				`${id}: talking again:\n${log.join("\n")}`,
			);
			// やめる
			const quit = fakeStory({ pick: m.dishes.length });
			await ev.run(quit.s);
			ok(
				inOrder(quit.log, [menu, `say nanj: ${m.no}`]) &&
					!quit.log.includes("se eat"),
				`${id}: leaving without eating:\n${quit.log.join("\n")}`,
			);
			// 券売機（部屋の plays）は 調べた 文の あと すぐ 品書き
			for (const [kind, play] of Object.entries(f.room?.plays ?? {})) {
				if (play !== "eat") continue;
				const t = room.find((e) => e.id === `${kind}_0`);
				ok(t?.run, `${id}: no ${kind} to read`);
				if (!t?.run) continue;
				const r = fakeStory({ pick: 0 });
				await t.run(r.s);
				ok(
					inOrder(r.log, [
						...(f.room?.lines[kind] ?? []).map((l) => `narrate: ${l}`),
						menu,
						"se eat",
					]),
					`${id}: the ${kind}:\n${r.log.join("\n")}`,
				);
			}
		}
		forgetWalletMemo();
	});
});

test("有料の 寄り道（2026-10-14）: 飲食店は 1回目から 品の 値段、足りなければ 店番が 断る", async () => {
	await withStorageAsync(async () => {
		const view: VillageView = {
			stage: TOWN_STAGES - 1,
			unlocked: ["shallow"],
			cleared: REVIVE_AREAS.map((a) => a.dungeon),
		};
		const f = facilityById("tako");
		const m = EAT_MENUS.tako;
		const stall = f?.outdoor?.find((t) => t.play === "eat" && t.sprite);
		const ev =
			f &&
			stall &&
			(buildVillage(view, {} as Ctx).events ?? []).find(
				(e) => e.id === outdoorId(f, stall),
			);
		ok(ev?.run, "no tako keeper");
		if (!ev?.run) return;
		const d = m.dishes[0];
		setTownYen(d.price + 100);
		const { s, log } = fakeStory({ pick: 0 });
		// 1回目から 注文の 前に 払う
		await ev.run(s);
		ok(
			inOrder(log, [
				"se pay",
				`say nanj: ${fill(m.order, { dish: d.name })}`,
				"se eat",
			]),
			`paid:\n${log.join("\n")}`,
		);
		ok(walletYen() === 100, `wallet ${walletYen()}`);
		// 2回目：足りない（何も 出ない）
		log.length = 0;
		await ev.run(s);
		ok(
			log.includes(`say nanj: ${fill(m.short, { price: yen(d.price) })}`) &&
				!log.includes("se eat") &&
				!log.includes("se pay"),
			`short:\n${log.join("\n")}`,
		);
		ok(walletYen() === 100, `wallet ${walletYen()}`);
		forgetWalletMemo();
	});
});

test("居酒屋の ツケ（2026-10-14）: 足りなければ ツケに できて 上限まで、払える とき 来ると「払ってくか？」で 払う", async () => {
	await withStorageAsync(async () => {
		forgetTabMemo();
		const view: VillageView = {
			stage: TOWN_STAGES - 1,
			unlocked: ["shallow"],
			cleared: [],
		};
		const f = facilityById("izakaya");
		const m = EAT_MENUS.izakaya;
		const t = m.tab;
		ok(f && t, "izakaya has a tab");
		if (!f || !t) return;
		const person = f.room?.people?.find((p) => p.play === "eat");
		const ev = (buildFacility(f, view, {} as Ctx).events ?? []).find(
			(e) => e.id === person?.id,
		);
		ok(ev?.run, "no izakaya keeper");
		if (!ev?.run) return;
		const d = m.dishes[0];
		setTownYen(0);
		const { s, log } = fakeStory({ pick: 0 });
		// お金が ない → ツケに する
		await ev.run(s);
		ok(
			inOrder(log, [
				`say nanj: ${fill(t.ask, { price: yen(d.price) })}`,
				`choose ${t.menu.join("/")}`,
				`say nanj: ${fill(t.put, { tab: yen(d.price) })}`,
				"se eat",
			]),
			`tab:\n${log.join("\n")}`,
		);
		ok(loadTab() === d.price, `tab ${loadTab()}`);
		// 上限を こえる ツケは できない
		forgetTabMemo();
		localStorage.setItem("kiriko-roguelike/tab", JSON.stringify(TAB_CAP));
		log.length = 0;
		await ev.run(s);
		ok(
			log.includes(`say nanj: ${fill(t.full, { tab: yen(TAB_CAP) })}`) &&
				!log.includes("se eat"),
			`full:\n${log.join("\n")}`,
		);
		// 払える とき：先に「払ってくか？」→ 払う
		forgetTabMemo();
		localStorage.setItem("kiriko-roguelike/tab", JSON.stringify(d.price));
		setTownYen(d.price * 2);
		log.length = 0;
		await ev.run(s);
		ok(
			inOrder(log, [
				`say nanj: ${fill(t.payAsk, { tab: yen(d.price) })}`,
				"se pay",
				`say nanj: ${t.paid}`,
			]),
			`pay:\n${log.join("\n")}`,
		);
		ok(loadTab() === 0, `tab ${loadTab()}`);
		// 足りても 選べる：「今　払うか、ツケに　しとくか？」で 払う（pick 0）
		ok(
			inOrder(log, [
				`say nanj: ${fill(t.choice, { price: yen(d.price) })}`,
				"se pay",
				`say nanj: ${fill(m.order, { dish: d.name })}`,
			]),
			`choice pay:\n${log.join("\n")}`,
		);
		// 足りても ツケに する（pick 1：2品目・ツケで　たのむ）
		const d1 = m.dishes[1];
		setTownYen(10_000);
		const two = fakeStory({ pick: 1 });
		two.s.set("eat:izakaya");
		const before = walletYen();
		await ev.run(two.s);
		ok(
			inOrder(two.log, [
				`say nanj: ${fill(t.choice, { price: yen(d1.price) })}`,
				`say nanj: ${fill(t.put, { tab: yen(d1.price) })}`,
				"se eat",
			]) && walletYen() === before,
			`tab with money:\n${two.log.join("\n")}`,
		);
		ok(loadTab() === d1.price, `tab ${loadTab()}`);
		for (const x of [t.ask, t.choice, t.put, t.full, t.payAsk, t.paid, t.later])
			fitsWindow([["tab", fill(x, { price: yen(2500), tab: yen(TAB_CAP) })]]);
		for (const x of [...t.menu, ...t.payMenu, ...t.choiceMenu])
			ok(
				width(fill(x, { tab: yen(TAB_CAP), price: yen(2500) })) <= 9,
				`${x} is too long`,
			);
		forgetWalletMemo();
		forgetTabMemo();
	});
});

test("有料の 寄り道（2026-10-14）: 自販機と ドリンクバーは 1杯ごとに 払う・足りなければ 何も 出ない、窓は 収まる", async () => {
	fitsWindow([
		["pay short", fill(PAY_SHORT, { price: yen(1500), have: yen(99_999) })],
	]);
	for (const x of [...VENDING.menu, ...DRINK_BAR.menu])
		ok(width(fill(x, { price: yen(300) })) <= 9, `${x} is too long`);
	await withStorageAsync(async () => {
		const view: VillageView = {
			stage: TOWN_STAGES - 1,
			unlocked: ["shallow"],
			cleared: [],
		};
		const vf = FACILITIES.find((f) =>
			(f.outdoor ?? []).some((t) => t.play === "vend"),
		);
		const vt = vf?.outdoor?.find((t) => t.play === "vend");
		ok(vf && vt, "no vending machine");
		if (!vf || !vt) return;
		const vend = outdoorScript({} as Ctx, vf, vt);
		const fam = facilityById("famires");
		const bar =
			fam &&
			(buildFacility(fam, view, {} as Ctx).events ?? []).find(
				(e) => e.id === "drinkbar_0",
			);
		ok(bar?.run, "no drink bar");
		if (!bar?.run) return;
		setTownYen(VEND_YEN + DRINK_BAR_YEN);
		const a = fakeStory({ pick: 0 });
		await vend(a.s);
		ok(
			inOrder(a.log, [
				`choose ${VENDING.menu.map((x) => fill(x, { price: yen(VEND_YEN) })).join("/")}`,
				"se pay",
				`narrate: ${VENDING.drank}`,
			]),
			`vend:\n${a.log.join("\n")}`,
		);
		ok(walletYen() === DRINK_BAR_YEN, `wallet ${walletYen()}`);
		const b = fakeStory({ pick: 0 });
		await bar.run(b.s);
		ok(
			inOrder(b.log, [
				`choose ${DRINK_BAR.menu.map((x) => fill(x, { price: yen(DRINK_BAR_YEN) })).join("/")}`,
				"se pay",
				`narrate: ${DRINK_BAR.drank}`,
			]),
			`drink bar:\n${b.log.join("\n")}`,
		);
		ok(walletYen() === 0, `wallet ${walletYen()}`);
		// 足りない
		const c = fakeStory({ pick: 0 });
		await vend(c.s);
		ok(
			c.log.at(-1) ===
				`narrate: ${fill(PAY_SHORT, { price: yen(VEND_YEN), have: yen(0) })}` &&
				!c.log.includes(`narrate: ${VENDING.drank}`),
			`vend short:\n${c.log.join("\n")}`,
		);
		// やめる なら 払わない
		setTownYen(VEND_YEN + DRINK_BAR_YEN + 500);
		const q = fakeStory({ pick: 1 });
		await bar.run(q.s);
		ok(!q.log.includes("se pay") && walletYen() === 500, "quit pays");
		forgetWalletMemo();
	});
});

test("有料の 寄り道（2026-10-14）: 銭湯は 村に いる あいだ 1回 入湯料、足りない・やめる なら 1歩 もどる", async () => {
	const price = yen(BATH_YEN);
	fitsWindow([["bath gate", fill(BATH_GATE.ask, { price })]]);
	for (const x of BATH_GATE.menu)
		ok(width(fill(x, { price })) <= 9, `${x} is too long`);
	await withStorageAsync(async () => {
		setTownYen(BATH_YEN - 1);
		const menu = `choose ${BATH_GATE.menu.map((x) => fill(x, { price })).join("/")}`;
		const a = fakeStory({ pick: 0 });
		await enterBath(a.s);
		ok(
			inOrder(a.log, [
				`narrate: ${fill(BATH_GATE.ask, { price })}`,
				menu,
				`narrate: ${fill(PAY_SHORT, { price, have: yen(BATH_YEN - 1) })}`,
				"move player d",
			]) && !a.log.some((l) => l.startsWith("warp")),
			`short:\n${a.log.join("\n")}`,
		);
		setTownYen(BATH_YEN * 2);
		const b = fakeStory({ pick: 1 });
		await enterBath(b.s);
		ok(
			b.log.at(-1) === "move player d" && walletYen() === BATH_YEN * 2,
			`quit:\n${b.log.join("\n")}`,
		);
		const { s, log } = fakeStory({ pick: 0 });
		await enterBath(s);
		ok(
			inOrder(log, [menu, "se pay", "fadeOut"]) &&
				log.some((l) => l.startsWith("warp bath")),
			`paid:\n${log.join("\n")}`,
		);
		ok(walletYen() === BATH_YEN, `wallet ${walletYen()}`);
		// 2回目は 払わずに 入る
		log.length = 0;
		await enterBath(s);
		ok(
			!log.includes(menu) &&
				!log.includes("se pay") &&
				log.some((l) => l.startsWith("warp bath")),
			`again:\n${log.join("\n")}`,
		);
		ok(walletYen() === BATH_YEN, `wallet ${walletYen()}`);
		forgetWalletMemo();
	});
});

test("シヨの アルバイト: 段7の 金・土・日の 17〜21時だけ メイド喫茶に 出て、その あいだは 村の 場所に いない。文は 窓に おさまる", () => {
	const fri = { m: 10, d: 16, w: 5 };
	const tue = { m: 10, d: 13, w: 2 };
	ok(shiyoAtMaid(7, fri, 17) && shiyoAtMaid(7, fri, 21), "not on shift");
	ok(!shiyoAtMaid(7, fri, 16) && !shiyoAtMaid(7, fri, 22), "off-hours shift");
	ok(!shiyoAtMaid(7, tue, 19), "weekday shift");
	ok(!shiyoAtMaid(6, fri, 19), "before the maid cafe is built");
	const room = facilityById("maid")?.room;
	const [x, y] = SHIYO_MAID_AT;
	ok(room?.rows[y]?.[x] === ".", "シヨ stands on furniture");
	ok(
		!room?.people?.some((p) => p.at[0] === x && p.at[1] === y),
		"シヨ stands on another maid",
	);
	fitsWindow([
		...SHIYO_MAID_LINES.map((l, i): [string, string] => [`shiyo.${i}`, l]),
		...SHIYO_MAID_MILK.map((l, i): [string, string] => [`milk.${i}`, l]),
	]);
});

test("ヲタショップ「神降臨」: 段7から 建ち、グッズは レジの 店員・ガチャは 機械で play otaku、グッズは 家具で リサイクルショップでは 売らない、ガチャは 家と お金が いる", async () => {
	const f = facilityById("otaku");
	ok(f?.from === 7, "otaku is not from stage 7");
	ok(
		f?.room?.people?.some((p) => p.play === "otaku") &&
			f.room.plays?.gacha === "otaku",
		"the clerk or the gacha does not open the shop",
	);
	// 売り買いは 棚・レジの 物では なく 店員に 話して（2026-10-16 作者）
	for (const [id, play] of [
		["konbini", "giftshop"],
		["recycle", "furnshop"],
		["otaku", "otaku"],
	] as const) {
		const room = facilityById(id)?.room;
		ok(
			room?.people?.some((p) => p.play === play),
			`${id}: no clerk sells (${play})`,
		);
		// ガチャは 機械なので そのまま（レジ・ギフトの 棚は 売らない）
		ok(
			!room?.plays?.register && !room?.plays?.gift,
			`${id}: a shelf or the register still sells (${play})`,
		);
	}
	fitsWindow(
		Object.entries(OTAKU_MSG).flatMap(([k, v]) =>
			(Array.isArray(v) ? v : [v]).map(
				(t) =>
					[
						`OTAKU_MSG.${k}`,
						t
							.replace("{price}", yen(99999))
							.replace("{name}", "アルのアクスタ"),
					] as [string, string],
			),
		),
	);
	for (const id of [...OTAKU_GOODS, ...OTAKU_GACHA]) {
		ok(id in FURNITURE && id in FURNITURE_PRICE, `${id}: not a furniture`);
		ok(!NOT_SOLD.includes(id), `${id}: in NOT_SOLD`);
	}
	ok(
		OTAKU_GOODS.every((id) => !OTAKU_GACHA.includes(id)),
		"a gacha prize is sold at the register",
	);
	await withStorageAsync(async () => {
		forgetHomeMemo();
		// 家が ない：回せない（お金も とらない）
		setTownYen(GACHA_PRICE * 3);
		const none = fakeStory({ pick: 0 });
		ok((await spinGacha(none.s)) === null, "spun without a home");
		ok(
			none.log.includes(`narrate: ${OTAKU_MSG.gachaNoHome}`) &&
				walletYen() === GACHA_PRICE * 3,
			`no home:\n${none.log.join("\n")}`,
		);
		const m = loadHome();
		m.owned = true;
		saveHome(m, false);
		// 1回目：ゼロの アクスタが 収納に
		const a = fakeStory({ pick: 0 });
		const first = await spinGacha(a.s, () => 0);
		ok(
			first?.id === "acstZero" &&
				!first.dup &&
				loadHome().stored.includes("acstZero") &&
				walletYen() === GACHA_PRICE * 2,
			`first:\n${a.log.join("\n")}`,
		);
		// 2回目：同じ 物は ダブり（収納は ふえない・お金は とる）
		const b = fakeStory({ pick: 0 });
		const dup = await spinGacha(b.s, () => 0);
		ok(
			dup?.dup === true &&
				loadHome().stored.filter((id) => id === "acstZero").length === 1 &&
				walletYen() === GACHA_PRICE,
			`dup:\n${b.log.join("\n")}`,
		);
		// やめる：お金は そのまま
		const quit = fakeStory({ pick: 1 });
		ok((await spinGacha(quit.s, () => 0.9)) === null, "spun after quitting");
		ok(walletYen() === GACHA_PRICE, `quit: wallet ${walletYen()}`);
		// 足りない
		setTownYen(GACHA_PRICE - 1);
		const short = fakeStory({ pick: 0 });
		ok((await spinGacha(short.s, () => 0.9)) === null, "spun without money");
		ok(
			short.log.includes(`narrate: ${OTAKU_MSG.gachaShort}`),
			`short:\n${short.log.join("\n")}`,
		);
		// そろったら もう 回さない
		const all = loadHome();
		all.stored.push(...OTAKU_GACHA.filter((id) => !all.stored.includes(id)));
		saveHome(all, false);
		setTownYen(GACHA_PRICE * 9);
		const before = walletYen();
		const comp = fakeStory({ pick: 0 });
		ok((await spinGacha(comp.s)) === null, "spun after completing");
		ok(
			comp.log.includes(`narrate: ${OTAKU_MSG.gachaComp}`) &&
				walletYen() === before,
			`comp:\n${comp.log.join("\n")}`,
		);
		forgetHomeMemo();
		forgetWalletMemo();
	});
});

test("おんJ証券（2026-10-15）: 商店街支店は 段4から 窓口・端末・株価ボード、ネットカフェは 段5から ブース、おんJマートの ATM は 入金・出金だけ", () => {
	const shoken = facilityById("shoken");
	ok(shoken?.from === 4, "the branch is not from stage 4");
	const sp = shoken?.room?.plays ?? {};
	ok(
		sp.window === "shoken" &&
			sp.terminal === "trade" &&
			sp.board === "stockboard",
		"the branch window, terminal or board does not open its play",
	);
	const net = facilityById("netcafe");
	ok(net?.from === 5, "the net cafe is not from stage 5");
	ok(net?.room?.plays?.booth === "netcafe", "the booth is not play netcafe");
	const konbini = facilityById("konbini");
	ok(konbini?.room?.plays?.atm === "atm", "the konbini ATM still trades");
	// どの 段でも 支店と ネットカフェの 扉の 前は 歩ける（ほかの 施設と かさならない）
	for (const stage of [4, 5, 6, 7]) {
		const ids = facilitiesAt(stage).map((f) => f.id);
		ok(ids.includes("shoken"), `stage ${stage}: no branch`);
		if (stage >= 5) ok(ids.includes("netcafe"), `stage ${stage}: no net cafe`);
	}
});

test("あらすじ（2026-10-15）: パン板を 持ち帰る 前も、はじまりの 目標（パン板の 4階）を 読みかえせる", () => {
	ok(
		synopsisHtml([], []) === null,
		"the story summary starts before the first clear",
	);
	const html = firstGoalHtml();
	ok(
		html.includes("はじまり") &&
			html.includes("パン板") &&
			html.includes("4階"),
		`first goal: ${html}`,
	);
	ok(!html.includes("\n"), "a raw newline in the html");
});

test("生き返る 通り（TOWN.md §0.6）: 表の 所は どれも 町に あり 1つの 通りだけ、板は 7つ 別々、本筋 4つは パン → きのこ → 風呂 → 電池", () => {
	const all = REVIVE_AREAS.flatMap((a) => a.places);
	ok(new Set(all).size === all.length, "a place revives twice");
	const core = [
		"shrine",
		"music",
		"bath",
		"library",
		"bookstore",
		"cafe",
		"fountain",
		"bakery",
	];
	for (const id of all)
		ok(facilityById(id) || core.includes(id), `${id} is not in the town`);
	const boards = REVIVE_AREAS.map((a) => a.dungeon);
	ok(new Set(boards).size === boards.length, "two streets for one board");
	ok(
		MAIN_BOARDS.join() === "shallow,kinoko,main,deep" &&
			MAIN_BOARDS.every((d) => boards.includes(d)),
		"the main boards",
	);
	// 遊びの 輪に 要る 物は はじめから 開いて いる
	for (const id of ["pier", "imoni", "cafe"])
		ok(isRevived(id, []), `${id} is shut at the start`);
	// 寄り道の 遊び場も 人が もどるまで 閉まって いる（碁会所は 広場、マイクラの 島は 商店街と いっしょ）
	for (const id of ["go", "saba7", "saba_apart"])
		ok(!isRevived(id, []), `${id} is open at the start`);
	// 1つの 板で 開くのは 少しずつ（本筋 4枚を 終えても 寄り道と 過去ログの底の 所は 閉まった まま）
	for (const a of REVIVE_AREAS)
		ok(a.places.length <= 9, `${a.name} opens ${a.places.length} at once`);
	const story: DungeonId[] = ["shallow", "kinoko", "main", "deep"];
	for (const id of ["music", "otaku", "netcafe", "bushitsu"])
		ok(!isRevived(id, story), `${id} opens with the main story alone`);
	ok(
		isRevived("bushitsu", [...story, "hidden"]),
		"bushitsu after 過去ログの底",
	);
});

test("生き返る 通り: 持ち帰る 前は 扉が シャッターで、踏むと 札を 読んで 1歩 もどる。屋台の 店番も 出ない。持ち帰れば 開く", async () => {
	const shutView: VillageView = {
		stage: TOWN_STAGES - 1,
		unlocked: ["shallow"],
		cleared: [],
	};
	const openView: VillageView = {
		...shutView,
		cleared: ["kinoko", "konamono"],
	};
	const f = facilityById("konbini");
	const d = f && facilityDoor(f);
	ok(d, "no konbini door");
	if (!f || !d) return;
	const at = (v: VillageView) => [...villageRows(v)[d[1]]][d[0]];
	ok(at(shutView) === "ｼ", `konbini door is ${at(shutView)} before きのこ板`);
	ok(at(openView) !== "ｼ", "konbini door is still shut after きのこ板");
	ok(
		villagePalette(shutView)["ｼ"]?.passable,
		"the shutter cannot be stepped on",
	);
	const door = (buildVillage(shutView, {} as Ctx).events ?? []).find(
		(e) => e.id === doorId(f),
	);
	ok(door?.run, "the shut door does nothing");
	if (door?.run) {
		const { s, log } = fakeStory();
		await door.run(s);
		ok(
			log.some((l) => l === `narrate: ${VILLAGE_MSG.shut}`),
			`no shutter line: ${log.join(" / ")}`,
		);
	}
	// たこ八の 店番は おんたこを 持ち帰るまで 出ない
	const tako = facilityById("tako");
	const keeper = tako?.outdoor?.find((t) => t.sprite);
	ok(tako && keeper, "no tako keeper");
	if (!tako || !keeper) return;
	const sprite = (v: VillageView) =>
		(buildVillage(v, {} as Ctx).events ?? []).find(
			(e) => e.id === outdoorId(tako, keeper),
		)?.sprite;
	ok(!sprite(shutView), "the tako keeper stands at a shut stall");
	ok(sprite(openView), "no tako keeper after おんたこ");
	// 通行人は シャッターの 店に 出入りしない
	const nodes = (v: VillageView) => crowdNodes(v).map((n) => n.id);
	ok(
		!nodes(shutView).includes(doorId(f)) && nodes(openView).includes(doorId(f)),
		"the crowd walks into a shut shop",
	);
});

test("生き返る 通り: 夜の 明かり。生き返って いない 建物は 窓が 灯らず、街灯は 電池板を 持ち帰って から", () => {
	const view = (cleared: DungeonId[]): VillageView => ({
		stage: TOWN_STAGES - 1,
		unlocked: [],
		cleared,
	});
	const W = villageRows(view([]))[0].length;
	const tiles = villagePalette(view([]));
	const rows = villageRows(view([])).map((r) => [...r]);
	const windows = (unlit: Set<number>) => {
		let lit = 0;
		let dark = 0;
		rows.forEach((r, y) => {
			r.forEach((ch, x) => {
				if (lightOf(tiles[ch]?.layers ?? []) !== "window") return;
				if (unlit.has(y * W + x)) dark++;
				else lit++;
			});
		});
		return { lit, dark };
	};
	const konbini = facilityById("konbini");
	ok(konbini, "no konbini");
	if (!konbini) return;
	const cell = konbini.at[1] * W + konbini.at[0];
	ok(unlitCells(view([])).has(cell), "the shut konbini is lit");
	ok(!unlitCells(view(["kinoko"])).has(cell), "the open konbini stays dark");
	const shut = windows(unlitCells(view([])));
	const all = windows(
		unlitCells(view([...REVIVE_AREAS.map((a) => a.dungeon)])),
	);
	ok(shut.dark > 0, "no dark windows in the run-down town");
	ok(all.dark === 0, `${all.dark} windows stay dark after every board`);
	ok(
		!lampsLit([]) && !lampsLit(["shallow", "kinoko", "main"]),
		"lamps lit before 電池板",
	);
	ok(lampsLit(["deep"]), "lamps off after 電池板");
	const def = buildVillage(view(["deep"]), {} as Ctx);
	ok(def.lights?.lamps === true, "the village map does not light the lamps");
});

test("板の 小さな 地上（TOWN.md §0.3）: 本筋 4つと 離島板・おんたこ・お祭りに あり、着いた マスから 入口・立て札・町へ もどる マスへ 歩ける", () => {
	for (const d of [
		"shallow",
		"kinoko",
		"main",
		"deep",
		"tropical",
		"konamono",
		"festival",
	] as DungeonId[])
		ok(surfaceOf(d), `${d} has no surface`);
	ok(!surfaceOf("hidden"), "過去ログの底 has a surface");
	for (const surf of SURFACES) {
		const rows = surf.rows.map((r) => [...r]);
		const W = rows[0].length;
		ok(
			rows.every((r) => r.length === W),
			`${surf.dungeon}: ragged rows`,
		);
		for (const r of rows)
			for (const ch of r)
				ok(surf.tiles[ch], `${surf.dungeon}: no tile for ${ch}`);
		const pass = (x: number, y: number) =>
			!!surf.tiles[rows[y]?.[x] ?? ""]?.passable;
		const seen = new Set<string>();
		const queue: (readonly [number, number])[] = [surf.arrive];
		seen.add(surf.arrive.join());
		for (let i = 0; i < queue.length; i++) {
			const [x, y] = queue[i];
			for (const [nx, ny] of [
				[x + 1, y],
				[x - 1, y],
				[x, y + 1],
				[x, y - 1],
			] as const) {
				if (seen.has(`${nx},${ny}`) || !pass(nx, ny)) continue;
				seen.add(`${nx},${ny}`);
				queue.push([nx, ny]);
			}
		}
		ok(
			seen.has(surf.mouth.join()),
			`${surf.dungeon}: the entrance is out of reach`,
		);
		ok(
			seen.has(surf.back.join()),
			`${surf.dungeon}: the way back is out of reach`,
		);
		const [sx, sy] = surf.sign;
		ok(!pass(sx, sy), `${surf.dungeon}: the sign can be walked on`);
		ok(
			[
				[sx + 1, sy],
				[sx - 1, sy],
				[sx, sy + 1],
				[sx, sy - 1],
			].some((c) => seen.has(c.join())),
			`${surf.dungeon}: the sign is out of reach`,
		);
		const def = buildSurface(surf, {} as Ctx);
		ok(
			def.events?.some(
				(e) =>
					e.trigger === "touch" &&
					e.x === surf.mouth[0] &&
					e.y === surf.mouth[1],
			),
			`${surf.dungeon}: the entrance does nothing`,
		);
	}
});

test("町割り（TOWN.md §0.2）: 広場の 噴水は パン板まで 止まり、パン屋は きのこ板まで シャッター。港の 小屋・やぐら広場も あり、どれも 歩いて 行ける", () => {
	const view = (cleared: DungeonId[]): VillageView => ({
		stage: TOWN_STAGES - 1,
		unlocked: [],
		cleared,
	});
	const has = (v: VillageView, ch: string) =>
		villageRows(v).some((r) => r.includes(ch));
	ok(
		has(view([]), "涸") && !has(view([]), "泉"),
		"the fountain runs before パン板",
	);
	ok(has(view(["shallow"]), "泉"), "the fountain is dry after パン板");
	ok(
		has(view([]), "閉") && !has(view([]), "扉"),
		"the bakery is open before きのこ板",
	);
	ok(has(view(["kinoko"]), "扉"), "the bakery is shut after きのこ板");
	ok(has(view([]), "港") && has(view([]), "鼓"), "no harbor hut or yagura");
	// 広場から 歩いて、噴水・パン屋の 扉・港の 小屋・やぐらの となりへ
	const v = view(["shallow", "kinoko"]);
	const rows = villageRows(v).map((r) => [...r]);
	const tiles = villagePalette(v);
	const pass = (x: number, y: number) => !!tiles[rows[y]?.[x] ?? ""]?.passable;
	const seen = new Set<string>([VILLAGE_SPOTS.boot.join()]);
	const queue: (readonly [number, number])[] = [VILLAGE_SPOTS.boot];
	for (let i = 0; i < queue.length; i++) {
		const [x, y] = queue[i];
		for (const [nx, ny] of [
			[x + 1, y],
			[x - 1, y],
			[x, y + 1],
			[x, y - 1],
		] as const) {
			if (seen.has(`${nx},${ny}`) || !pass(nx, ny)) continue;
			seen.add(`${nx},${ny}`);
			queue.push([nx, ny]);
		}
	}
	const near = (x: number, y: number) =>
		[
			[x + 1, y],
			[x - 1, y],
			[x, y + 1],
			[x, y - 1],
		].some((c) => seen.has(c.join()));
	for (const ch of ["滝", "扉", "戸", "鼓"]) {
		const cells = rows.flatMap((r, y) =>
			r.flatMap((c, x) => (c === ch ? [[x, y] as const] : [])),
		);
		ok(
			cells.some(([x, y]) => near(x, y)),
			`${ch} is out of reach`,
		);
	}
});

test("町の 騒ぎ（STORY.md §4.9）: 板が 開いて から 持ち帰るまで 騒ぎの 人が 立ち、広場の 掲示板は パン板の あいだ 差し押さえ。騒ぎの 人は 歩ける マスで ほかと 重ならない", async () => {
	const base: VillageView = {
		stage: TOWN_STAGES - 1,
		unlocked: [],
		cleared: [],
	};
	const ids = (v: VillageView) => villagePlaces(v).map((p) => p.id);
	for (const inc of INCIDENTS) {
		const open: VillageView = { ...base, unlocked: [inc.dungeon] };
		const done: VillageView = {
			...base,
			unlocked: [inc.dungeon],
			cleared: [inc.dungeon],
		};
		ok(
			activeIncidents(open).includes(inc) && !activeIncidents(done).length,
			`${inc.dungeon}: incident window`,
		);
		const rows = villageRows(open).map((r) => [...r]);
		const pal = villagePalette(open);
		const places = villagePlaces(open);
		for (const p of inc.people) {
			const id = incidentPlaceId(p);
			ok(ids(open).includes(id) && !ids(done).includes(id), `${id} window`);
			ok(pal[rows[p.at[1]][p.at[0]]]?.passable, `${id} stands on a wall`);
			ok(
				places.filter((q) => q.x === p.at[0] && q.y === p.at[1]).length === 1,
				`${id} shares a cell`,
			);
			fitsWindow(p.lines.map((l) => [id, l]));
		}
		fitsWindow(Object.values(inc.shut ?? {}).map((l) => [inc.dungeon, l]));
		if (inc.seize) fitsWindow([[`${inc.dungeon} seize`, inc.seize]]);
	}
	// 差し押さえの 掲示板は 札だけ
	const panv: VillageView = { ...base, unlocked: ["shallow"] };
	const board = (buildVillage(panv, {} as Ctx).events ?? []).find(
		(e) => e.id === "board_0",
	);
	ok(board?.run, "no plaza board");
	if (board?.run) {
		const { s, log } = fakeStory();
		// 差し押さえでも 記録の 窓まで 進む（試験には 画面が ないので そこで 止まる）
		await board.run(s).catch(() => {});
		const seize = INCIDENTS.find((i) => i.seize)?.seize ?? "";
		// 予告の 見出しは 2026-10-19 に やめた：差し押さえの 文の あと、見出しは 読まない
		ok(
			log[0] === `narrate: ${seize}` &&
				!log.some((l) => l.includes("独立を宣言")),
			`the seized board opened: ${log.join(" / ")}`,
		);
	}
});

test("転の 停電: 電池板が 開いて 持ち帰るまで、生き返った 通りも ぜんぶ 閉まって 街灯も 消える", () => {
	const lit: VillageView = {
		stage: TOWN_STAGES - 1,
		unlocked: ["shallow", "kinoko", "main"],
		cleared: ["shallow", "kinoko"],
	};
	const dark: VillageView = { ...lit, unlocked: [...lit.unlocked, "deep"] };
	const back: VillageView = {
		...dark,
		cleared: [...dark.cleared, "main", "deep"],
	};
	ok(!inBlackout(lit) && inBlackout(dark) && !inBlackout(back), "window");
	ok(
		isRevived("konbini", revivedBoards(lit)),
		"street shut before the blackout",
	);
	ok(!isRevived("konbini", revivedBoards(dark)), "street open in the blackout");
	ok(!isRevived("fountain", revivedBoards(dark)), "plaza open in the blackout");
	ok(!lampsLit(revivedBoards(dark)) && lampsLit(revivedBoards(back)), "lamps");
	const f = facilityById("konbini");
	const d = f && facilityDoor(f);
	if (d)
		ok(
			[...villageRows(dark)[d[1]]][d[0]] === "ｼ",
			"no shutter in the blackout",
		);
});

test("本筋の 持ち帰りの 語り: 本筋の 順に 持ち帰ると、はじめての 語りは 短い 2回目の 語り（again）に 落ちない（いない 仲間の 頁には かわりが ある）", () => {
	const order: DungeonId[] = ["shallow", "kinoko", "main", "deep", "hidden"];
	for (const [i, d] of order.entries()) {
		const cleared = order.slice(0, i + 1);
		const away = awayFriends(cleared);
		const pages = endingFor(d, false, away, cleared);
		const again = STORY[d].again;
		ok(
			!again || pages !== again,
			`${d}: the first ending falls back to the short one (away: ${away.join()})`,
		);
	}
});

test("見出しの 絵（図＝実物の 絵）: 語りが 掲示板の 見出しを 言う 頁は 掲示板の 絵を そえ、紙の 字は 見出しと 同じ。仕組みの 矢印図「見出し」は ない", () => {
	const pages = [
		...DUNGEON_IDS.flatMap((d) => [
			...STORY[d].ending,
			...(STORY[d].again ?? []),
			...(STORY[d].once ?? []),
		]),
		...TEN_NEWS.pages,
	];
	let n = 0;
	for (const p of pages) {
		const h = headlineIn(p.text);
		// 語りの 絵は 実物の 絵だけ（騒ぎの 規模の 段は 台詞と 人の 動きで 見せる。札と 矢印の 図は つなぎの ゼロが 描く 図だけ）
		if (p.card) ok(isPicture(p.card), `語りに 札と 矢印の 図: ${p.text}`);
		if (!h || !p.text.includes("掲示板")) continue;
		n++;
		ok(
			p.card && isPicture(p.card) && p.card.paper?.text === h,
			`見出しの 頁に 掲示板の 絵が ない・字が ちがう: ${p.text}`,
		);
	}
	ok(n >= 8, `書きこみの 頁が 少ない: ${n}`);
});

test("時間が とぶ 頁（2026-10-18）: 地の文が「翌日。」「1時間後。」「その夜、」と 言う 頁は 暗転して 明ける（skip・cut）。窓だけ 進めない", () => {
	const pages = DUNGEON_IDS.flatMap((d) => [
		...STORY[d].ending,
		...(STORY[d].again ?? []),
		...(STORY[d].once ?? []),
		...(BOSS_RETURN[d] ?? []),
	]).flatMap((p) => (p.instead ? [p, p.instead] : [p]));
	const jump = /翌日|翌朝|\d+時間後|\d+日後|その夜|夜ふけ/;
	let n = 0;
	for (const p of pages) {
		// 地の文だけ（台詞の「40分で1周や」は 時間を とばさない）
		if (p.who || p.kiriko || p.nanashi || p.mob || !jump.test(p.text)) continue;
		n++;
		ok(!!(p.skip || p.cut), `時間が とぶのに 場面が かわらない: ${p.text}`);
	}
	ok(n >= 8, `時間が とぶ 頁が 少ない: ${n}`);
});

test("寸劇の あとの 町（2026-10-18）: ご近所・もどる 住人・通りは 生き返った 知らせの あと。寸劇は 朝。チョークの 国境線は 広場の 通れる マス。寸劇の ゼロは 1機", () => {
	const v = (cleared: DungeonId[], arriving?: DungeonId[]): VillageView => ({
		stage: TOWN_STAGES - 1,
		unlocked: ["shallow", "kinoko"],
		cleared,
		...(arriving ? { arriving } : {}),
	});
	const ids = (x: VillageView) => villagePlaces(x).map((p) => p.id);
	// ご近所は 持ち帰りの 語りの あいだ（arriving）は まだ 来ない。騒ぎの 人は もう 帰って いる
	ok(
		!ids(v([], ["shallow"])).some((i) => i.startsWith("inc_visit")),
		"a visitor comes during the skit",
	);
	ok(
		!ids(v([], ["shallow"])).some((i) => i.startsWith("inc_panhei")),
		"the incident people stay during the skit",
	);
	ok(
		ids(v(["shallow"])).some((i) => i.startsWith("inc_visit")),
		"no visitor after the plaza revived",
	);
	ok(
		!ids(v([], ["shallow"])).some((i) => i === "mob_ngoane"),
		"a returning mob is back before the announcement",
	);
	// ゼロの サブ機（プロト・レン）だけは 同じ 船で 着いて いる：寸劇の 3機の 集団行動に 出る
	for (const id of ZERO_UNITS) {
		ok(
			ids(v([], ["shallow"])).includes(`mob_${id}`),
			`${id} is not on the boat during the skit`,
		);
		ok(!ids(v([])).includes(`mob_${id}`), `${id} is in town before パン板`);
	}
	withStorage(() => {
		saveProgress({
			...loadProgress(),
			unlocked: ["shallow", "kinoko"],
			cleared: ["shallow"],
			endings: ["shallow"],
		});
		holdReveal("shallow");
		const before = sceneView(villageView());
		ok(
			!!before.arriving?.includes("shallow") &&
				!before.cleared.includes("shallow"),
			"the plaza is revived before the announcement",
		);
		releaseReveal("shallow");
		const after = sceneView(villageView());
		ok(
			!after.arriving && after.cleared.includes("shallow"),
			"the plaza stays unrevived after the announcement",
		);
		ok(skitSky() === "morning", "the skit is not in the morning");
	});
	// チョークの 国境線：その 頁で 引き、線の マスは どの 段でも 通れる 広場
	const page = STORY.shallow.ending.find((p) => p.text.includes("チョーク"));
	ok(!!page?.chalk, "the chalk line page does not draw the line");
	for (let stage = 0; stage < TOWN_STAGES; stage++) {
		const x: VillageView = { stage, unlocked: ["shallow"], cleared: [] };
		const row = [...(villageRows(x)[CHALK_LINE.y] ?? "")];
		const pal = villagePalette(x);
		for (let cx = CHALK_LINE.x0; cx <= CHALK_LINE.x1; cx++) {
			const ch = row[cx];
			ok(
				!!ch && !!pal[ch]?.passable,
				`stage ${stage}: the chalk line crosses ${ch} at ${cx},${CHALK_LINE.y}`,
			);
		}
	}
	// 寸劇の ゼロを 3機と 言うのは、その 語りに プロト・レンが 出て（go で 走って）3機で 集団行動する ときだけ
	// （2026-10-18 作者「3機が 集団行動して いるなら 違和感ない」）。語りに 出る 住人は 口の 前から 並ぶので、
	// その 語りの どの 頁でも 3機が 画面に いる
	const trio = (pages: readonly StoryPage[]): boolean =>
		ZERO_UNITS.every((id) =>
			pages.some((p) => p.go?.some((w) => w.who === id)),
		);
	const scenes: (readonly StoryPage[])[] = [
		...DUNGEON_IDS.flatMap((d) => [
			STORY[d].ending,
			STORY[d].again ?? [],
			STORY[d].once ?? [],
		]),
		TEN_NEWS.pages,
	];
	for (const sc of scenes)
		if (!trio(sc))
			for (const p of sc) ok(!p.text.includes("3機"), `寸劇で 3機: ${p.text}`);
	ok(trio(STORY.shallow.ending), "パン板の 寸劇に 3機が 出ない");
	for (const t of [...Object.values(KINOKO_EVE), ...Object.values(BATH_EVE)])
		ok(!t.includes("3機"), `つなぎで 3機: ${t}`);
});

test("翌朝の 見出し（STORY.md §0 言う ことと 見える もの）: 掲示板に 残る 見出しは、その 板の 持ち帰りの 語りの 見出しと 一字も ちがわない", () => {
	const texts: [string, string][] = [];
	for (const [d, line] of Object.entries(AFTER_HEADLINES)) {
		const { ending, once } = STORY[d as DungeonId];
		const said = [...ending, ...(once ?? [])].map((p) => p.text).join("\n");
		ok(said.includes(`『${line}』`), `${d}: 語りに 『${line}』 が ない`);
		texts.push([
			`AFTER_HEADLINES.${d}`,
			fill(BOARD_NEWS.after, { line: line ?? "" }),
		]);
	}
	fitsWindow(texts);
});

test("広場の 掲示板の 名無し（STORY.md §4.9）: 倒れた ときの 一行は 回数で 入れかわる。どれも 村の 窓に 収まる（予告の 見出しは 2026-10-19 に やめた）", () => {
	const texts: [string, string][] = [];
	for (const line of DEATH_LINES) {
		texts.push(["BOARD_NEWS.death", fill(BOARD_NEWS.death, { line })]);
		texts.push([
			"BOARD_NEWS.deathOnBoard",
			fill(BOARD_NEWS.deathOnBoard, { line }),
		]);
	}
	fitsWindow(texts);
	// 段が 上がる（1〜2回 → 3回〜 → 10回〜 → 30回〜）。段の 中で まわる。{n} は 回数
	ok(
		deathLine(1) === "キリコ死んでて草" &&
			deathLine(2) === "また死んどる" &&
			deathLine(3) === DEATH_TIERS[1].lines[0] &&
			deathLine(10) === "10回目で草" &&
			deathLine(30) === "30回目。もう伝統芸能や" &&
			deathLine(34) === deathLine(30).replace("30", "34"),
		"death lines do not escalate",
	);
	for (let n = 1; n < 60; n++)
		texts.push(["deathLine", fill(BOARD_NEWS.death, { line: deathLine(n) })]);
	fitsWindow(texts);
});

test("ご近所（STORY.md §3）: 持ち帰った 板の 人が 1人ずつ 町に 来る。歩ける マスで ほかと 重ならず、行は 村の 窓に 収まる", () => {
	const all: VillageView = {
		stage: TOWN_STAGES - 1,
		unlocked: [...DUNGEON_IDS],
		cleared: [...DUNGEON_IDS],
	};
	const none: VillageView = { ...all, cleared: [] };
	const rows = villageRows(all).map((r) => [...r]);
	const pal = villagePalette(all);
	const places = villagePlaces(all);
	ok(activeVisitors(none).length === 0, "visitors before any clear");
	ok(
		new Set(VISITORS.map((p) => p.dungeon)).size === VISITORS.length,
		"two visitors from one board",
	);
	for (const p of VISITORS) {
		const id = incidentPlaceId(p);
		ok(
			places.some((q) => q.id === id),
			`${id} is not in town`,
		);
		ok(pal[rows[p.at[1]][p.at[0]]]?.passable, `${id} stands on a wall`);
		ok(
			places.filter((q) => q.x === p.at[0] && q.y === p.at[1]).length === 1,
			`${id} shares a cell`,
		);
		fitsWindow(p.lines.map((l) => [id, l]));
	}
});

test("騒ぎの 人・ご近所は 道を ふさがない：どの 騒ぎの 村でも、ぜんぶ 持ち帰った 村でも、起きる 所から 扉・出口と 話せる 人に 届く", () => {
	const check = (v: VillageView, where: string) => {
		const rows = villageRows(v).map((r) => [...r]);
		const pal = villagePalette(v);
		const places = villagePlaces(v);
		const blocked = new Set(
			places.filter((p) => p.sprite).map((p) => `${p.x},${p.y}`),
		);
		const pass = (x: number, y: number) =>
			!!pal[rows[y]?.[x] ?? ""]?.passable && !blocked.has(`${x},${y}`);
		const seen = new Set<string>();
		const [bx, by] = VILLAGE_SPOTS.boot;
		const q: [number, number][] = [[bx, by]];
		seen.add(`${bx},${by}`);
		while (q.length) {
			const [x, y] = q.shift() as [number, number];
			for (const [dx, dy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1],
			]) {
				const k = `${x + dx},${y + dy}`;
				if (seen.has(k) || !pass(x + dx, y + dy)) continue;
				seen.add(k);
				q.push([x + dx, y + dy]);
			}
		}
		const near = (x: number, y: number) =>
			[
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1],
			].some(([dx, dy]) => seen.has(`${x + dx},${y + dy}`));
		for (const p of places) {
			if (
				!p.id.startsWith("inc_") &&
				!p.id.startsWith("door_") &&
				!p.id.startsWith("exit")
			)
				continue;
			ok(
				seen.has(`${p.x},${p.y}`) || near(p.x, p.y),
				`${where}: ${p.id} cannot be reached`,
			);
		}
	};
	for (const inc of INCIDENTS)
		check(
			{ stage: TOWN_STAGES - 1, unlocked: [inc.dungeon], cleared: [] },
			inc.dungeon,
		);
	check(
		{
			stage: TOWN_STAGES - 1,
			unlocked: [...DUNGEON_IDS],
			cleared: [...DUNGEON_IDS],
		},
		"all cleared",
	);
});

/**
 * y を 持ち帰るには x を 持ち帰って いる はずか（unlockAfter を たどる。倒れて 開く 板（reliefAfter）は
 * すぐ 前の 板を 持ち帰らなくても 開くので、その 1段は 数えない）。
 */
const mustClear = (y: DungeonId, x: DungeonId): boolean => {
	let d: DungeonId | null = y;
	while (d) {
		const dg: (typeof DUNGEONS)[DungeonId] = DUNGEONS[d];
		const prev: DungeonId | null = dg.unlockAfter;
		if (!prev) return false;
		if (prev === x && !dg.reliefAfter) return true;
		d = prev;
	}
	return false;
};

test("騒ぎの 人と ご近所は、いっしょに 出る どの 組み合わせでも 同じ マスに 立たない", () => {
	const people = [
		...INCIDENTS.flatMap((i) =>
			i.people.map((p) => ({ d: i.dungeon, p, visitor: false })),
		),
		...VISITORS.map((p) => ({ d: p.dungeon, p, visitor: true })),
	];
	for (const a of people)
		for (const b of people) {
			if (a === b) continue;
			if (a.visitor !== b.visitor) {
				const inc = a.visitor ? b : a;
				const vis = a.visitor ? a : b;
				// 同じ 板（持ち帰る 前と あと）・騒ぎの 板を 持ち帰らないと 開かない 板の ご近所とは 同時に 出ない
				if (inc.d === vis.d || mustClear(vis.d, inc.d)) continue;
			}
			ok(
				a.p.at[0] !== b.p.at[0] || a.p.at[1] !== b.p.at[1],
				`${a.p.id} and ${b.p.id} share ${a.p.at}`,
			);
		}
});

// ───────────────── 立ち聞きの 吹き出し（ui/village/overhear.ts） ─────────────────

test("立ち聞き: every bubble fits 10 full-width × 2 lines, no slang, emoji only where the speaker uses it", () => {
	const all = [
		...Object.entries(MOB_MUTTERS).flatMap(([id, ts]) =>
			ts.map((t) => [id, t] as const),
		),
		...Object.entries(CROWD_MUTTERS).flatMap(([id, ts]) =>
			ts.map((t) => [id, t] as const),
		),
		...CROWD_PAIRS.map((t) => ["pair", t] as const),
	];
	const keys = new Set<string>();
	for (const [who, t] of all) {
		ok(!keys.has(t.key), `${t.key}: key used twice`);
		keys.add(t.key);
		ok(t.lines.length >= 1 && t.lines.length <= 4, `${t.key}: length`);
		for (const l of t.lines) {
			const rows = l.text.split("\n");
			ok(rows.length <= 2, `${t.key}: ${l.text} has 3 lines`);
			for (const r of rows)
				ok([...r].length <= 10, `${t.key}: "${r}" is over 10`);
			for (const w of ["草", "定期", "RTA"])
				ok(!l.text.includes(w), `${t.key}: slang ${w}`);
			const emoji = /\p{Extended_Pictographic}/u.test(l.text);
			ok(
				!emoji || who === "puyu" || /ぷゆゆ🥺$/.test(l.text),
				`${t.key}: emoji`,
			);
			ok(who === "pair" || l.by === 0, `${t.key}: a mutter has one speaker`);
		}
	}
	for (const id of MOB_IDS)
		ok(MOB_MUTTERS[id].length >= 2, `${id}: fewer than 2 mutters`);
});

test("立ち聞き: a nearby resident mutters, passers-by pair up, and an open window stops it", () => {
	const kiriko = new Actor("player", 10, 10, "down", "", null);
	const puyu = new Actor("mob_puyu", 13, 10, "down", "", null);
	const far = new Actor("mob_onchan", 20, 10, "down", "", null);
	const a = new Actor("crowd_0", 10, 13, "up", "", null);
	const b = new Actor("crowd_1", 11, 13, "up", "", null);
	let actors: Actor[] = [puyu, far];
	let walkers: { actor: Actor; persona: string }[] = [];
	let paused = false;
	const o = new Overhear({
		actors: () => actors,
		player: () => kiriko,
		walkers: () => walkers,
		paused: () => paused,
		rng: () => 0,
	});
	const run = (ms: number) => {
		const seen: { id: string; text: string }[] = [];
		for (let t = 0; t < ms; t += 50) {
			o.update(50);
			const c = o.current;
			if (c && seen.at(-1)?.text !== c.text) seen.push(c);
		}
		return seen;
	};
	// 遠い おんちゃんは 話さない。ぷゆゆの 独り言が 順に 出て、ほかを 聞くまで くり返さない
	const first = run(12000);
	ok(
		first.length > 0 && first.every((c) => c.id === "mob_puyu"),
		`puyu: ${JSON.stringify(first)}`,
	);
	ok(first[0]?.text === MOB_MUTTERS.puyu[0]?.lines[0]?.text, "first mutter");
	const more = run(40000);
	ok(
		more.some((c) => c.text === MOB_MUTTERS.puyu[1]?.lines[0]?.text),
		`the next mutter: ${JSON.stringify(more)}`,
	);
	// 通行人 2人が 近くで 並ぶと 掛け合う（話す 番が 交互・向かい合う）
	actors = [a, b];
	walkers = [
		{ actor: a, persona: "nanashi" },
		{ actor: b, persona: "worker" },
	];
	o.reset();
	// 独り言を ひととおり 聞くと 掛け合い（rng 0 は 候補の 先頭から）
	const pairText = CROWD_PAIRS[0]?.lines.map((l) => l.text) ?? [];
	let heard: { id: string; text: string }[] = [];
	for (let i = 0; i < 20 && !heard.some((c) => c.text === pairText[1]); i++)
		heard = run(15000);
	const at = heard.findIndex((c) => c.text === pairText[0]);
	ok(
		at >= 0 &&
			heard[at]?.id === "crowd_0" &&
			heard[at + 1]?.id === "crowd_1" &&
			heard[at + 1]?.text === pairText[1],
		`no pair talk: ${JSON.stringify(heard)}`,
	);
	ok(
		a.dir === "right" && b.dir === "left",
		`face each other: ${a.dir} ${b.dir}`,
	);
	// 窓が 開いたら 消えて、閉じても すぐには 出ない
	o.reset();
	actors = [puyu];
	walkers = [];
	for (let t = 0; t < 10000 && !o.current; t += 50) o.update(50);
	ok(o.current !== null, "a bubble before the window opens");
	paused = true;
	o.update(50);
	ok(o.current === null, "the window clears the bubble");
	paused = false;
	o.update(50);
	ok(o.current === null, "no bubble right after the window closes");
	// 話して いる 人が 離れたら やめる
	for (let t = 0; t < 10000 && !o.current; t += 50) o.update(50);
	puyu.x = 30;
	o.update(50);
	ok(o.current === null, "stops when the speaker walks away");
	puyu.x = 13;
});

// ───────────────── 越してくる 場面（ui/village/arrivals.ts） ─────────────────

test("越してくる 場面: lines fit, only newcomers speak, Kiriko lands a tsukkomi, and newcomers stay away until their scene is seen", () => {
	const texts: [string, string][] = [];
	const keys = new Set<string>();
	for (const a of ARRIVALS) {
		ok(!keys.has(a.key), `${a.key}: key used twice`);
		keys.add(a.key);
		a.lines.forEach((l, i) => {
			texts.push([`${a.key}[${i}]`, l.text]);
			ok(
				l.who === null || l.who === "kiriko" || a.mobs.includes(l.who),
				`${a.key}[${i}]: ${l.who} is not arriving`,
			);
		});
		ok(
			a.lines.some((l) => l.who === "kiriko" && l.hit),
			`${a.key}: no tsukkomi`,
		);
		for (const id of a.mobs) {
			ok(
				MOB_BACK[id] === a.after,
				`${a.key}: ${id} comes with ${MOB_BACK[id]}`,
			);
			ok(
				a.lines.some((l) => l.who === id),
				`${a.key}: ${id} never introduces herself`,
			);
		}
	}
	fitsWindow(texts);
	// 町はずれ：歩ける マスが あり、桟橋（口への 道）でも 広場（蓄音機の 前）の そばでも ない
	const v = {
		stage: 7,
		unlocked: [...DUNGEON_IDS],
		cleared: [...DUNGEON_IDS],
	};
	const rows = villageRows(v).map((r) => [...r]);
	const pal = villagePalette(v);
	const [bx, by] = VILLAGE_SPOTS.boot;
	for (const a of ARRIVALS) {
		let walk = 0;
		for (let y: number = a.at.y[0]; y <= a.at.y[1]; y++)
			for (let x: number = a.at.x[0]; x <= a.at.x[1]; x++) {
				const ch = rows[y]?.[x];
				if (ch && pal[ch]?.passable) walk++;
				ok(!(x === 20 && y >= 36), `${a.key}: on the pier`);
				ok(
					Math.abs(x - bx) + Math.abs(y - by) >= 15,
					`${a.key}: ${x},${y} is near the plaza`,
				);
			}
		ok(walk > 0, `${a.key}: no walkable cell`);
		// 場所の 寸劇（噴水・池・海辺）とは 2マス 以上 はなす（村の どこでもの 期間限定は 場所を 持たない）
		for (const sk of SKITS) {
			const on = sk.on;
			if (on.k !== "near" || on.x[1] >= 999) continue;
			ok(
				a.at.x[1] + 2 < on.x[0] ||
					on.x[1] + 2 < a.at.x[0] ||
					a.at.y[1] + 2 < on.y[0] ||
					on.y[1] + 2 < a.at.y[0],
				`${a.key}: next to ${sk.key}`,
			);
		}
	}
	const newcomers = ARRIVALS.flatMap((a) => a.mobs);
	try {
		setIntroSeen(() => false);
		const away = awayMobs(DUNGEON_IDS);
		ok(
			away.length === newcomers.length &&
				newcomers.every((id) => away.includes(id)),
			`away before any scene: ${away.join()}`,
		);
		setIntroSeen((key) => key === "arrive_den");
		ok(
			!awayMobs(DUNGEON_IDS).includes("den") &&
				awayMobs(DUNGEON_IDS).includes("chupa"),
			"デンちゃん is in town after her scene, フランソワ is not",
		);
	} finally {
		setIntroSeen(() => true);
	}
});

// ───────────────── 寸劇（ui/village/skits.ts） ─────────────────

test("寸劇: 3〜5 windows that fit, unique keys, and every trigger points at a real place, thing, resident and cause", () => {
	const texts: [string, string][] = [];
	const keys = new Set<string>();
	const causes = [
		...Object.values(MONSTERS).map((d) => d.name),
		"地雷",
		"落とし穴",
	];
	for (const sk of SKITS) {
		ok(!keys.has(sk.key), `${sk.key}: key used twice`);
		keys.add(sk.key);
		ok(
			sk.lines.length >= 3 && sk.lines.length <= 5,
			`${sk.key}: ${sk.lines.length} windows`,
		);
		sk.lines.forEach((l, i) => {
			texts.push([`${sk.key}[${i}]`, l.text]);
		});
		const on = sk.on;
		if (on.k === "enter")
			ok(
				facilityOfMap(on.map) !== undefined ||
					(ROOM_IDS as readonly string[]).includes(on.map),
				`${sk.key}: no ${on.map}`,
			);
		if (on.k === "death") {
			ok(MOB_IDS.includes(on.mob), `${sk.key}: ${on.mob}`);
			ok(
				causes.some((c) => c.includes(on.cause)),
				`${sk.key}: nothing is called ${on.cause}`,
			);
			ok(
				sk.lines.some((l) => l.who === "mob"),
				`${sk.key}: the resident never speaks`,
			);
		} else
			ok(
				sk.lines.every((l) => l.who !== "mob"),
				`${sk.key}: "mob" only in death skits`,
			);
	}
	fitsWindow(texts);
});

test("寸劇: entering a building or looking at a thing plays once, at most one per return", async () => {
	await withStorageAsync(async () => {
		const a = fakeStory();
		ok(
			await skitAfterEvent(a.s, {
				from: "village",
				to: "f_konbini",
				thing: "door_f_konbini",
			}),
			"konbini skit",
		);
		ok(
			a.log.some((l) => l.includes("ポイント5倍")),
			a.log.join("\n"),
		);
		// 同じ 帰りは 2本目なし・同じ 寸劇は 2回目なし
		const b = fakeStory();
		ok(
			!(await skitAfterEvent(b.s, {
				from: "village",
				to: "village",
				thing: "shrine",
			})),
			"second skit in the same return",
		);
		pushRecord({ kind: "escape" });
		ok(
			!(await skitAfterEvent(b.s, {
				from: "village",
				to: "f_konbini",
				thing: "door_f_konbini",
			})),
			"konbini again",
		);
		ok(
			await skitAfterEvent(b.s, {
				from: "village",
				to: "village",
				thing: "shrine",
			}),
			"shrine after a new return",
		);
		// 村へ もどる・家に 入る だけでは 出ない
		pushRecord({ kind: "escape" });
		ok(
			!(await skitAfterEvent(b.s, {
				from: "f_konbini",
				to: "village",
				thing: "exit",
			})),
			"leaving a building",
		);
	});
});

test("寸劇: a death skit replaces the resident's new talk and reaction once", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow", "main"], [], ["shallow", "main"]);
		putTown({ stage: 7 });
		const id = "proto";
		// はじめましてを すませて おく
		await mobScript(id)(fakeStory().s);
		pushRecord({ kind: "dead", cause: "コピペにたおされた" });
		const a = fakeStory();
		await mobScript(id)(a.s);
		const sk = SKITS.find((x) => x.key === "death_copipe");
		ok(
			a.log.length === sk?.lines.length &&
				a.log[0]?.endsWith(sk?.lines[0]?.text ?? "?"),
			`skit:\n${a.log.join("\n")}`,
		);
		// 同じ 帰り：反応は もう 出さない（ボケか いつもの）
		const b = fakeStory();
		await mobScript(id)(b.s);
		ok(
			b.log[0] !== `say null: ${reactionOf(MOBS[id])}`,
			`reaction after the skit: ${b.log.join("\n")}`,
		);
		// 次の 帰りに 同じ 死に方でも 2回目は ない
		pushRecord({ kind: "dead", cause: "コピペにたおされた" });
		const c = fakeStory();
		ok(
			!(await deathSkit(
				c.s,
				id,
				{ kind: "dead", cause: "コピペにたおされた" },
				async () => {},
			)),
			"the same death skit twice",
		);
	});
});

test("寸劇: every place skit sits on cells Kiriko can walk to, and none sits on the pier to the boards", () => {
	const v = {
		stage: 7,
		unlocked: [...DUNGEON_IDS],
		cleared: [...DUNGEON_IDS],
	};
	const rows = villageRows(v).map((r) => [...r]);
	const pal = villagePalette(v);
	for (const sk of SKITS) {
		const on = sk.on;
		// 村の どこでも（期間限定の きっかけ）は 見ない
		if (on.k !== "near" || on.x[1] >= 999) continue;
		let walk = 0;
		for (let y: number = on.y[0]; y <= on.y[1]; y++)
			for (let x: number = on.x[0]; x <= on.x[1]; x++) {
				const ch = rows[y]?.[x];
				if (ch && pal[ch]?.passable) walk++;
				ok(!(x === 20 && y >= 36), `${sk.key}: on the pier`);
			}
		ok(walk > 0, `${sk.key}: no walkable cell`);
	}
	withStorage(() => {
		// 噴水は パン板の あと（水が 出てから）
		ok(nearSkit("village", 26, 30) === null, "the dry fountain");
		setProgress(["shallow"], [], ["shallow"]);
		pushRecord({ kind: "escape" });
		forgetSkits();
		const at = nearSkit("village", 26, 30)?.key;
		ok(
			at === "near_fountain" || at === "window_dokuritsu",
			`the fountain: ${at}`,
		);
		const pier = nearSkit("village", 20, 40);
		ok(
			!pier || (pier.on.k === "near" && pier.on.x[1] >= 999),
			`a place skit on the pier: ${pier?.key}`,
		);
	});
});

test("寸劇: the empty big room in a dive: only big rooms with no foe inside, each thread skit once", () => {
	for (const sk of ROOM_SKITS) {
		ok(sk.lines.length >= 4 && sk.lines.length <= 5, `${sk.key}: length`);
		for (const t of sk.lines) {
			const line = roomSkitLine(t, "キリコ");
			ok([...line].length <= 24, `${sk.key}: ${line} is over 24`);
			for (const w of ["草", "定期", "RTA"])
				ok(!t.includes(w), `${sk.key}: slang ${w}`);
		}
	}
	const big = bigRoomLayout();
	const outside = { x: 0, y: 0 };
	const inside = { x: 5, y: 5 };
	const foe = (x: number, y: number) => ({ hp: 3, x, y }) as unknown as Monster;
	ok(enteredEmptyBigRoom(big, outside, inside, []), "empty big room");
	ok(!enteredEmptyBigRoom(big, inside, inside, []), "already inside");
	ok(!enteredEmptyBigRoom(big, outside, inside, [foe(20, 20)]), "a foe inside");
	ok(
		enteredEmptyBigRoom(big, outside, inside, [{ ...foe(20, 20), hp: 0 }]),
		"a dead foe does not count",
	);
	withStorage(() => {
		forgetRoomSkits();
		const got = ROOM_SKITS.map(() => takeRoomSkit()?.key);
		ok(
			got.join() === ROOM_SKITS.map((x) => x.key).join(),
			`order: ${got.join()}`,
		);
		ok(takeRoomSkit() === null, "no skit after all were seen");
		forgetRoomSkits();
	});
});

test("寸劇: limited-time skits play only between their story clears (never on real dates), even after another skit this return, and never again", async () => {
	const timed = SKITS.filter((x) => x.window);
	ok(timed.length >= 5, "few limited-time skits");
	for (const sk of timed)
		ok(
			sk.window?.after !== undefined || sk.window?.before !== undefined,
			`${sk.key}: an open window`,
		);
	await withStorageAsync(async () => {
		// まだ 1度も 帰って いない（はじまりの 場面）では 出ない
		setProgress(["shallow"], [], []);
		ok(nearSkit("village", 19, 22) === null, "before the first return");
		pushRecord({ kind: "dead" });
		ok(nearSkit("village", 19, 22)?.key === "window_pan", "before パン板");
		// パン板を 持ち帰ったら パン板の 前の 寸劇は もう 出ない（見逃した）
		setProgress(["shallow", "kinoko"], [], ["shallow"]);
		ok(
			nearSkit("village", 19, 22)?.key === "window_dokuritsu",
			"between パン板 and きのこ板",
		);
		// ほかの 寸劇を 見た 帰りでも 出て、2回目は ない
		await skitAfterEvent(fakeStory().s, {
			from: "village",
			to: "f_konbini",
			thing: "door_f_konbini",
		});
		const sk = nearSkit("village", 19, 22);
		ok(sk?.key === "window_dokuritsu", `after another skit: ${sk?.key}`);
		if (sk) await playNearSkit(fakeStory().s, sk);
		ok(nearSkit("village", 19, 22) === null, "twice");
		// 先へ 進むと 次の あいだの もの だけ
		setProgress(["shallow", "kinoko", "main"], [], ["shallow", "kinoko"]);
		pushRecord({ kind: "escape" });
		ok(
			nearSkit("village", 19, 22)?.key === "window_kinoko",
			"between きのこ板 and 風呂板",
		);
	});
});

test("寸劇: every explosion clears before the skit ends (the building is back to normal), and the boom plays its sound", async () => {
	const booms = SKITS.filter((sk) => sk.lines.some((l) => l.fx === "boom"));
	// 爆発は リサイクル屋と 秘密結社の 1回目だけ（多すぎると 天丼が すりきれる）
	ok(booms.length >= 1 && booms.length <= 2, "explosion gags: 1〜2");
	for (const sk of booms) {
		const at = sk.lines.findIndex((l) => l.fx === "boom");
		ok(
			sk.lines.slice(at + 1).some((l) => l.calm),
			`${sk.key}: the smoke never clears`,
		);
	}
	await withStorageAsync(async () => {
		const a = fakeStory();
		ok(
			await skitAfterEvent(a.s, {
				from: "village",
				to: "f_recycle",
				thing: "door_f_recycle",
			}),
			"recycle skit",
		);
		ok(a.log.includes("se explosion"), `no boom sound: ${a.log.join(" / ")}`);
	});
});

test("持ち帰りの 語り: 場面を うつす マス（cut）と 走る 行き先（go の to）は、そこの すぐ そばに 立てる", () => {
	const v = villageView();
	const near = (c: readonly [number, number]): boolean => {
		const [to] = spotsAround(v, 1, c);
		return !!to && Math.abs(to[0] - c[0]) + Math.abs(to[1] - c[1]) <= 2;
	};
	let n = 0;
	for (const [d, st] of Object.entries(STORY))
		for (const p of [...st.ending, ...(st.once ?? []), ...(st.again ?? [])]) {
			if (p.cut) {
				n++;
				ok(near(p.cut), `${d}: cut ${p.cut} は 立てる マスから 遠い`);
			}
			for (const w of p.go ?? []) {
				ok(!!w.to !== !!w.route, `${d}: go は to か route の どちらか 1つ`);
				if (w.route) {
					const dx = [...w.route].reduce(
						(a, c) => a + (c === "r" ? 1 : c === "l" ? -1 : 0),
						0,
					);
					const dy = [...w.route].reduce(
						(a, c) => a + (c === "d" ? 1 : c === "u" ? -1 : 0),
						0,
					);
					ok(
						dx === 0 && dy === 0,
						`${d}: route ${w.route} は 元の マスに もどらない`,
					);
				}
				if (Array.isArray(w.to)) {
					n++;
					ok(
						near(w.to as readonly [number, number]),
						`${d}: go ${w.to} は 立てる マスから 遠い`,
					);
				}
			}
		}
	ok(n >= 8, "場面を うつす・走る 頁が 少ない");
});
