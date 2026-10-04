// 歩ける村（保守村）の地図の試験（pnpm test で いっしょに動く）。
// Field（canvas を作る）は使わず、地図の文字・パレット・置き場所（data/village/map.ts）だけで調べる。
// - 形（22×18）・知らない文字が 無い・イベントが 地図の中で 1マスに 1つ・踏むイベントは 通れるマス
// - 起きる所（蓄音機の前）から、開いた口の すべてへ 歩いて行けて、人・看板・掲示板の すべてに
//   となり（か カウンター越し）から 話しかけられる（口の中には 立たずに）
// - 本編の口は 開くまで やきうが ふさぐ・もっとの口は 開くまで 板で ふさぐ
// - 町の段ごとに 建物が ふえる・売る人は 台の うしろ（囲いの中へは 入れない）・絵は 同梱の Base.png だけ
// - 仲間の ひとこと（ui/villageTalk.ts）：1回の 帰りに 1人 1つ 新しい話（「！」）、聞いたら 決まった ひとこと。
//   ゼロの 帳簿。村の窓で 読む 文（村の 新しい文・口と 立て札・仲間の たまり）は 全角22字・2行まで
//   （localStorage の かわりに 入れものを 置いて 試す）
// - 帰ってきたとき（ui/villageReturn.ts。仮の Story で 試す）：口の前に 仲間が 並んで 語り、開いた知らせ
//   （やきうが どく。見せる 前に 閉じたら また 見せる）、倉庫へ・売る（別のタブ・閉じた タブの 守り）・町が 育つ
// - おんJ 本館（data/village/hall.ts・ui/hallEvents.ts）：外観の 幅・扉、中の 形と 歩ける道（段ごと）、
//   扉で 入って 出たら 入った 扉の 前、保守の 当番表の 数、期間限定の 告知、飾り棚の 中身、段の 上がる 場面

import { DUNGEON_IDS, DUNGEONS } from "../core/data/dungeons";
import { MONSTERS } from "../core/data/monsters";
import { defOf } from "../core/item";
import {
	CARRY_MAX,
	lastStepOf,
	priceOf,
	STAGE_POINTS,
	TOWN_STAGES,
	TOWN_STEPS,
} from "../core/town";
import type { DungeonId, Item } from "../core/types";
import { BANDAI, BATH_MEN, BATH_SOAK, BATH_WOMEN } from "../data/bath";
import { bgm } from "../data/bgm";
import {
	CAFE_DRINKS,
	CAFE_GREET,
	CAFE_TALKS,
	CHAT_MSG,
	MASTER_MSG,
	NANASHI_CAFE,
	SEAT_MSG,
	TREAT_REACTIONS,
	TREAT_TALKS,
} from "../data/cafe";
import { CAFE_MOBS } from "../data/cafeMobs";
import { SEASONS, season } from "../data/calendar";
import { MOB_VOICE, VOICE_MODELS } from "../data/cast";
import { HALL_MSG, JIKKYO, ON_PHONO_TEXT, TOBAN_MENU } from "../data/hall";
import {
	MOB_IDS,
	MOBS,
	type MobCtx,
	type MobId,
	type MobLine,
	PUYU_LUNCH,
	SENKYO,
} from "../data/mobs";
import { records, stageBgm, villageBgm } from "../data/music";
import {
	advanceEvents,
	bossName,
	EVENTS,
	eventById,
	eventNewsText,
	eventText,
	goalText,
	objectiveFor,
} from "../data/objectives";
import { guideKeys, PIANO_DONE, PIANO_GUIDES, PIANO_MENU } from "../data/piano";
import {
	type KirikoMode,
	pickQuote,
	type Quote,
	type QuoteContext,
	SPEAKERS,
	type Speaker,
} from "../data/quotes";
import {
	KEEPER_LINE,
	MUSIC_CLOSED,
	PIANO_MSG,
	ROOM_DOOR,
	ROOM_MSG,
} from "../data/rooms";
import { SCRAP_MSG, SCRAPS } from "../data/scraps";
import {
	awayFriends,
	BOARD_LOOKS,
	BOSS_HOME,
	BOSS_RETURN,
	CLEAR,
	DEPART,
	DUNGEON_NAMES,
	FIRST_SHALLOW,
	FRIEND_FROM,
	SHALLOW_DEATH,
	STORY,
	type StoryPage,
	UNLOCK_LINES,
	UNLOCK_VISIT,
} from "../data/story";
import {
	TAMPER_LEDGER,
	TAMPER_MOB,
	TAMPER_NARRATION,
	TAMPER_SCENE,
	TAMPER_TALK,
} from "../data/tamper";
import {
	ARRIVE_MSG,
	ESCAPE_QUOTES,
	OPENING,
	RETURN_PAGES,
	SOLD_BARE,
	STAGE_NAMES,
	STAGE_UP,
	STAGE_UP_HALL,
	TITLE_TOWN_QUOTES,
	TOWN_GREW_MSG,
	TOWN_MSG,
	VILLAGE_IDLE,
	VILLAGE_MSG,
	WAKE_PAGES,
	ZERO_VOICELESS,
} from "../data/town";
import {
	HALL_NAMES,
	hallEntry,
	hallMats,
	hallOutside,
	hallPalette,
	hallPlaces,
	hallRows,
	hallTierOf,
	NANASHI_WALK,
	ON_PHONO,
	shelfSlots,
} from "../data/village/hall";
import {
	CAFE_FROM,
	exitFor,
	lineupSpots,
	VILLAGE_EXITS,
	VILLAGE_H,
	VILLAGE_SPOTS,
	VILLAGE_W,
	type VillageView,
	villagePalette,
	villagePlaces,
	villageRows,
} from "../data/village/map";
import {
	BATH_NOREN_M,
	BATH_SPOTS,
	BATH_WALL,
	CAFE_ALL_SEATS,
	CAFE_MASTER,
	CAFE_ORDER,
	CAFE_PATRON_SPOTS,
	CAFE_SLOTS,
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
import { hallTier } from "../data/village/tiles";
import type { SayOptions, Story, TileDef, VState } from "../engine/defs";
import { type Actor, Field } from "../engine/field";
import {
	forgetProgressMemo,
	loadProgress,
	loadRecords,
	loadReplays,
	loadTown,
	noteRunEnd,
	type PendingReturn,
	type Progress,
	type ProgressNews,
	type RunRecord,
	readScrap,
	replayMatches,
	type SavedReplay,
	type Town,
	toReplay,
} from "../engine/save";
import { isWalkRef } from "../engine/sprite";
import { bathLayout } from "../ui/bath";
import { floorsText } from "../ui/bookView";
import {
	cafeLayout,
	cafeTalks,
	forgetCafeMemo,
	hasCafeNews,
	mixScene,
	talksWith,
} from "../ui/cafe";
import type { Ctx } from "../ui/ctx";
import { floorShort } from "../ui/floorName";
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
} from "../ui/hallEvents";
import { itemIcon } from "../ui/icons";
import { bossHomeLine, endLine, recordHead } from "../ui/records";
import {
	enterMusic,
	enterRoom,
	isWeekend,
	leaveRoom,
	planLines,
	thingLines,
} from "../ui/rooms";
import { sharedHead } from "../ui/share";
import {
	forgetMobMemo,
	hasMobNews,
	idleOf,
	mobScript,
	reactionOf,
	senkyoOpen,
	senkyoScript,
	tipDice,
} from "../ui/villageMobs";
import { villageSong } from "../ui/villageMusic";
import {
	forgetOpeningMemo,
	needsOpening,
	openingPrepare,
	openingScript,
} from "../ui/villageOpening";
import {
	deathScene,
	gather,
	lineUp,
	lunchScript,
	newsScript,
	pagesFor,
	type ReturnArrival,
	returnScene,
	type StoreChooser,
	sceneView,
	sendBack,
	settleScript,
	TALK_NEAR,
	villageView,
} from "../ui/villageReturn";
import {
	DUNGEON_DESC,
	fill,
	forgetHeardMemo,
	hasNews,
	ledgerLine,
	pinnedScrap,
	talkLine,
} from "../ui/villageTalk";
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
	/** 話しかけに 立てる マス（歩いて行けて、踏むと もぐる 口では ない。ui/village.ts の walkTo と同じ）。 */
	const standable = (x: number, y: number) =>
		reachable(x, y) &&
		!places.some((p) => p.trigger === "touch" && p.x === x && p.y === y);
	/**
	 * となり（か カウンター越し）の 立てる マスから 話しかけられるか。
	 * noBack なら 北どなり（掲示板などの 裏）からは 数えない（ui/village.ts の talkFront と同じ）。
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
		// 帰ってきたとき 出口から 1歩 下へ 出られる
		ok(s.canEnter(mx, my + 1), `${label(v)}: cannot step out of the exit`);
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

test("the village has an exit on each side (and one sign); nobody guards them", () => {
	for (const v of VIEWS) {
		const s = survey(v);
		const exits = s.places.filter((p) => p.trigger === "touch" && p.exit);
		ok(exits.length === 4, `${label(v)}: ${exits.length} exits`);
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
		// 道は 5段から 石だたみ
		const stone = villagePalette(view(7))["."]?.layers.join();
		for (let stage = 0; stage < TOWN_STAGES; stage++) {
			const road = villagePalette(view(stage))["."]?.layers.join();
			ok(
				(road === stone) === stage >= 5,
				`stage ${stage}: the road is ${road === stone ? "stone" : "dirt"}`,
			);
		}
	}
	// 段の 外の 数（古い保存・下見）は 丸める
	for (const stage of [-3, 99, Number.NaN]) {
		const rows = villageRows({ stage, unlocked: ["shallow"], cleared: [] });
		ok(rows.length === VILLAGE_H, `stage ${stage}: ${rows.length} rows`);
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

test("はじめの 保守村には やきう（と ぷゆゆ）だけ。仲間は 町が 育つと 越してきて、来る 前は 語りでも 話さない", async () => {
	const FRIENDS = ["roze", "shiyo", "zero", "feris", "nanj"] as const;
	for (let stage = 0; stage < TOWN_STAGES; stage++) {
		const places = villagePlaces({ stage, unlocked: ["shallow"], cleared: [] });
		for (const w of FRIENDS)
			ok(
				places.some((p) => p.who === w) === stage >= FRIEND_FROM[w],
				`stage ${stage}: ${w} ${stage >= FRIEND_FROM[w] ? "is missing" : "is there before moving in"}`,
			);
	}
	ok(
		villagePlaces({ stage: 0, unlocked: ["shallow"], cleared: [] }).some(
			(p) => p.id === "mob_puyu",
		),
		"ぷゆゆ is not there from the start",
	);
	// はじめて パン板を 持ち帰った 語り（まだ 段0）：やきうと 地の文だけ
	await withStorageAsync(async () => {
		setProgress(["shallow"]);
		putTown({ stage: 0 });
		const who = new Set(
			pagesFor({ kind: "clear", dungeon: "shallow" }).map((p) => p.who),
		);
		ok(
			[...who].every((w) => w === null || w === "nanj"),
			`speakers before anyone moved in: ${[...who].join(",")}`,
		);
	});
});

test("どの 段でも、まだ 越してきていない 仲間は 帰りの 語り・知らせに 出てこない（話さない・名前も 出ない）", async () => {
	for (let stage = 0; stage < TOWN_STAGES; stage++)
		await withStorageAsync(async () => {
			setProgress(["shallow"], [], ["shallow"]);
			putTown({ stage });
			const away = awayFriends(["shallow"], stage);
			const names = away.map((w) => SPEAKERS[w].name);
			for (const d of DUNGEON_IDS)
				for (const kind of ["clear", "escape"] as const)
					for (const p of pagesFor({ kind, dungeon: d, objective: "boss" })) {
						ok(
							!(p.who && away.includes(p.who)),
							`stage ${stage} ${d} ${kind}: ${p.who} speaks before moving in`,
						);
						ok(
							!names.some((n) => p.text.includes(n)),
							`stage ${stage} ${d} ${kind}: "${p.text}" names someone not here yet`,
						);
					}
		});
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

test("寄り道の 板が 開く：その 板の 名無しが 口から 来て キリコの となりで 話し、口へ 帰る。そのあと「もぐれるように　なった」", async () => {
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
				`place visitor ${gate}`,
				"look visitor",
				...lines
					.slice(0, -1)
					.map((l) => (l.who ? `say nanj: ${l.text}` : `narrate: ${l.text}`)),
				`goto visitor ${gate}`,
				`narrate: ${lines[lines.length - 1]?.text}`,
				"narrate: 「きのこ板」に\nもぐれるように　なった",
			]),
			`visit:\n${log.join("\n")}`,
		);
		ok(!s.flag("visitor"), "the visitor stays in the village");
		ok(!loadProgress().news.length, "the news was not cleared");
	});
});

test("掲示板の 切れはし：その 板を 持ち帰ると 貼られ、1回の 帰りに 1枚。読んだら 次の 帰りに 次の 1枚", () => {
	fitsWindow([
		...SCRAPS.map((x): [string, string] => [`SCRAPS.${x.id}`, x.text]),
		...Object.entries(SCRAP_MSG).map(([k, t]): [string, string] => [
			`SCRAP_MSG.${k}`,
			fill(t, { board: "離島・沖縄板" }),
		]),
	]);
	ok(
		new Set(SCRAPS.map((x) => x.id)).size === SCRAPS.length,
		"two scraps share an id",
	);
	withStorage(() => {
		// まだ どの 板も 持ち帰って いない：貼られない
		setProgress(["shallow"], [], []);
		ok(!pinnedScrap(), "a scrap before any board was carried home");
		// パン板を 持ち帰った：パン板の 1枚目
		setProgress(["shallow", "main"], [], ["shallow"]);
		pushRecord({});
		const first = pinnedScrap();
		ok(first?.board === "shallow", `pinned: ${first?.id}`);
		// 読んだ：この 帰りは もう 貼られない
		readScrap(first?.id ?? "", loadRecords()[0]?.at ?? 0);
		ok(!pinnedScrap(), "two scraps in one return");
		// 次の 帰り：パン板の 2枚目
		pushRecord({ at: (loadRecords()[0]?.at ?? 0) + 1000 });
		const second = pinnedScrap();
		ok(
			second?.board === "shallow" && second.id !== first?.id,
			`next return: ${second?.id}`,
		);
	});
});

test("ロゼ and シヨ work behind closed counters once the stall and storehouse are built", () => {
	for (const v of VIEWS) {
		const s = survey(v);
		const seller = (who: Speaker, counterFrom: number, closedFrom: number) => {
			const p = s.places.find((x) => x.who === who);
			// 越してくる 前は いない（data/story.ts の FRIEND_FROM）
			ok(
				!!p === v.stage >= FRIEND_FROM[who],
				`${label(v)}: ${who} is ${p ? "there before moving in" : "missing"}`,
			);
			if (!p || v.stage < counterFrom) return;
			ok(
				s.tile(p.x, p.y + 1)?.counter,
				`${label(v)}: ${who} has no counter in front at (${p.x},${p.y + 1})`,
			);
			if (v.stage < closedFrom) return;
			// 囲いの中（売る人の 左右）へは 歩いて 入れない
			for (const dx of [-1, 1])
				ok(
					!s.reachable(p.x + dx, p.y),
					`${label(v)}: Kiriko can walk into the pen of ${who} at (${p.x + dx},${p.y})`,
				);
		};
		seller("roze", 1, 2);
		seller("shiyo", 4, 4);
		// 小屋の扉は 3段から（見るだけ）
		ok(
			s.places.some((p) => p.id === "door_hut") === v.stage >= 3,
			`${label(v)}: the hut door does not match the stage`,
		);
		// 野次馬は 祭り（段7）だけ
		ok(
			s.places.some((p) => p.id.startsWith("yaji_")) === v.stage >= 7,
			`${label(v)}: the 野次馬 do not match the stage`,
		);
	}
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
	forgetOpeningMemo();
	forgetHallMemo();
	return () => {
		if (prev) Object.defineProperty(globalThis, "localStorage", prev);
		else delete (globalThis as { localStorage?: unknown }).localStorage;
		forgetProgressMemo();
		forgetHeardMemo();
		forgetMobMemo();
		forgetOpeningMemo();
		forgetHallMemo();
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
		cause: "おなかが　すいて　たおれた",
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

test("each friend has one new line per return (「！」), then a short fixed line", () => {
	withStorage(() => {
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
		// 倉庫が 建ったら シヨの 決まった ひとことは 倉庫番
		setTown(4, 3000);
		const shiyo = TITLE_TOWN_QUOTES[4].find((q) => q.who === "shiyo")?.text;
		ok(
			talkLine("shiyo") === (shiyo ?? VILLAGE_IDLE.store),
			"シヨ does not keep the storehouse",
		);
		// 聞いたことは ページを 開きなおしても 覚えている
		forgetHeardMemo();
		for (const who of FRIENDS)
			ok(!hasNews(who), `${who} forgot after a reload`);
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
			"ワイ バーンに　たおされた",
			"ぷゆゆに　たおされた",
			"とうすこに　たおされた",
			"かまってちゃんに　たおされた",
		])
			for (const depth of [2, 9, 18]) {
				pushRecord({ kind: "dead", cause, depth });
				for (const who of FRIENDS)
					ok(hasNews(who), `${who} is silent after "${cause}" at B${depth}`);
			}
	});
});

test("ゼロ reads the ledger: sales so far, never how much to the next stage", () => {
	withStorage(() => {
		setTown(0, 0);
		ok(ledgerLine() === VILLAGE_MSG.ledgerNone, "stage 0 with no sales");
		setTown(2, 500);
		const rest = STAGE_POINTS[3] - 500;
		ok(
			ledgerLine().includes("500円") && !ledgerLine().includes(`${rest}円`),
			`stage 2: ${ledgerLine()}`,
		);
		setTown(TOWN_STAGES - 1, 99999);
		ok(ledgerLine().includes("いっぱい"), `the top stage: ${ledgerLine()}`);
	});
});

/** 全角=1・半角=0.5 で 数えた 幅。 */
const width = (line: string): number =>
	[...line].reduce((w, ch) => w + (/[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);

type Shown = { text: string; kiriko?: KirikoMode };
/** 窓に 出る 文（キリコの 独白は （　）で かこまれる。ui/village.ts の sayKiriko）。 */
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

test("everything the village window reads out fits it (22 full-width × 2 lines)", () => {
	const texts: [string, string][] = [];
	const pool = (where: string, ls: readonly Shown[]) =>
		ls.forEach((l, i) => {
			texts.push([`${where}[${i}]`, shown(l)]);
		});
	for (const d of DUNGEON_IDS) {
		// 口・立て札の 札（ui/villageEvents.ts の signText。★つきが いちばん長い）と、開き方（同じく hintText）
		texts.push([
			`sign ${d}`,
			`「${DUNGEON_NAMES[d].name}」　B${DUNGEONS[d].floors}　★\n${DUNGEON_DESC[d]}`,
		]);
		for (const [i, l] of (UNLOCK_VISIT[d] ?? []).entries())
			texts.push([`UNLOCK_VISIT.${d}[${i}]`, l.text]);
		pool(`CLEAR.${d}`, CLEAR[d]);
		pool(`STORY.${d}.ending`, STORY[d].ending);
		pool(`STORY.${d}.again`, STORY[d].again ?? []);
	}
	// やきうが 出ていった あとの かわりの 頁
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
	STAGE_UP.forEach((v, i) => {
		pool(`STAGE_UP[${i}]`, v);
	});
	TITLE_TOWN_QUOTES.forEach((v, i) => {
		pool(`TITLE_TOWN_QUOTES[${i}]`, v);
	});
	for (const [k, v] of Object.entries(TOWN_MSG))
		texts.push([`TOWN_MSG.${k}`, fill(v.text, { points: 99999, n: 4 })]);
	fitsWindow(texts);
});

test("喫茶「保守」: every talk fits the village window, and the door appears from its stage and can be reached", () => {
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
	]);
	// おごった 回数で 話が ふえる（3杯・6杯）
	const base = cafeTalks(CAFE_FROM, {
		heard: [],
		treats: {},
		sentAt: 0,
	}).length;
	const three = cafeTalks(CAFE_FROM, {
		heard: [],
		treats: { roze: 3 },
		sentAt: 0,
	}).length;
	const six = cafeTalks(CAFE_FROM, {
		heard: [],
		treats: { roze: 6 },
		sentAt: 0,
	}).length;
	ok(
		three === base + 1 && six === base + 2,
		`treat talks: ${base} → ${three} → ${six}`,
	);
	ok(
		new Set(CAFE_TALKS.map((t) => t.id)).size === CAFE_TALKS.length,
		"two cafe talks share an id",
	);
	// 出ていった やきうの 話は 聞けない（扉の「！」も 残らない）
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
		setProgress(all, [], all);
		ok(!hasCafeNews(), "「！」 stays for the talks of やきう, who has left");
		ok(
			talksWith("nanj", TOWN_STAGES - 1).length === 0 &&
				cafeTalks(TOWN_STAGES - 1).every((t) => !t.cast.includes("nanj")),
			"talks with やきう after he has left",
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
	for (const ls of TITLE_TOWN_QUOTES) add(ls);
	// 本編の たまり（data/quotes.ts。外へは 出していないので 引いて 集める）
	const causes = [
		"おなかが　すいて　たおれた",
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
	const state: VState = {
		x: o.at?.[0] ?? VILLAGE_SPOTS.boot[0],
		y: o.at?.[1] ?? VILLAGE_SPOTS.boot[1],
		dir: "up",
		flags: {},
	};
	let says = 0;
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
		se: (name) => {
			log.push(`se ${name}`);
		},
		flag: (name) => state.flags[name],
		set: (name, value = true) => {
			state.flags[name] = value;
		},
		move: async (target, route) => {
			log.push(`move ${target} ${route}`);
			if (target === "player")
				for (const ch of route) {
					if (ch === "d") state.y++;
					if (ch === "u") state.y--;
					if (ch === "l") state.x--;
					if (ch === "r") state.x++;
				}
		},
		goto: async (target, x, y) => {
			log.push(`goto ${target} ${x},${y}`);
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
		},
		hide: (id) => {
			log.push(`hide ${id}`);
		},
		place: (id, x, y) => {
			log.push(`place ${id} ${x},${y}`);
			if (id === "player") {
				state.x = x;
				state.y = y;
			}
		},
		toast: (text) => {
			log.push(`toast ${text}`);
		},
		rebuild: async () => {
			log.push("rebuild");
		},
		warp: async (map, x, y, dir) => {
			log.push(`warp ${map} ${x},${y}${dir ? ` ${dir}` : ""}`);
			state.x = x;
			state.y = y;
			if (dir) state.dir = dir;
		},
		exit: () => {},
	};
	return { s, log };
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
		const cases: [
			ReturnArrival,
			readonly { who: Speaker | null; text: string; kiriko?: KirikoMode }[],
		][] = [
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
					"move player d",
					...pages.map((p) =>
						p.kiriko
							? `kiriko ${p.kiriko}: ${p.text}`
							: p.who
								? `say ${p.who}: ${p.text}`
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
				s.state.y === VILLAGE_SPOTS.exit[1] + 1,
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
		const { s, log } = fakeStory({
			near: ["roze", "shiyo", "feris", "zero", "nanj"],
		});
		await newsScript(s);
		const exit = `look ${VILLAGE_SPOTS.exit.join(",")}`;
		ok(
			inOrder(log, [
				exit,
				...UNLOCK_LINES.main.map((l) => `say ${l.who}: ${l.text}`),
				"se chapter",
				"narrate: 「風呂板」に\nもぐれるように　なった",
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
		const deep = fakeStory();
		await newsScript(deep.s);
		ok(
			inOrder(deep.log, [
				exit,
				...UNLOCK_LINES.deep.map((l) => `say ${l.who}: ${l.text}`),
				"narrate: 「電池板」に\nもぐれるように　なった",
			]),
			`the 電池板 news is out of order:\n${deep.log.join("\n")}`,
		);
		// 10回 たおれて 開いた（救い）：パン板の ネタは シヨが 貼っておく
		setProgress(["shallow", "main"], [{ dungeon: "main", reason: "relief" }]);
		const relief = fakeStory();
		await newsScript(relief.s);
		ok(
			relief.log.includes(`say shiyo: ${UNLOCK_LINES.relief[0].text}`),
			`the relief news is wrong:\n${relief.log.join("\n")}`,
		);
	});
});

test("やきう leaves: the 電池板 ending plays once with him, then no return, boss page or news has him", async () => {
	const all = [...DUNGEON_IDS];
	const his = (pages: readonly StoryPage[]) =>
		pages.filter((p) => p.who === "nanj" || p.about === "nanj");
	const put = (
		cleared: DungeonId[],
		endings: DungeonId[],
		news: ProgressNews[] = [],
	) =>
		localStorage.setItem(
			PROGRESS_KEY,
			JSON.stringify({
				unlocked: all,
				cleared,
				fails: {},
				intro: all,
				news,
				endings,
			}),
		);
	await withStorageAsync(async () => {
		putTown({ stage: TOWN_STAGES - 1 });
		// はじめて 持ち帰った：やきうは まだ 村に いて、口の 前で 待ち、結末を 語る
		put(
			all,
			all.filter((d) => d !== "deep"),
		);
		const a: ReturnArrival = { kind: "clear", dungeon: "deep" };
		ok(
			JSON.stringify(pagesFor(a)) === JSON.stringify(STORY.deep.ending),
			"the 電池板 ending is cut the first time",
		);
		const v = villageView();
		ok(
			!villagePlaces(v).some((p) => p.id === "nanj"),
			"やきう stands in the village after 電池板 is cleared",
		);
		ok(
			villagePlaces(sceneView(v, a)).some((p) => p.id === "nanj"),
			"やきう is not in the village for his own departure",
		);
		const { s, log } = fakeStory({ at: exitFor("deep").cell });
		lineUp(s, a, sceneView(v, a));
		ok(
			log.some((l) => l.startsWith("place nanj ")),
			"やきう does not wait at the mouth",
		);
		await returnScene(s, a);
		ok(
			his(STORY.deep.ending).every(
				(p) => p.who !== "nanj" || log.includes(`say nanj: ${p.text}`),
			),
			`やきう's departure is not played:\n${log.join("\n")}`,
		);
		ok(
			!!loadProgress().endings?.includes("deep"),
			"the departure is not remembered",
		);
		// 見おえたら（暗転で 建て直すと）もう いない。2回目からは 短い 語り
		ok(
			!villagePlaces(sceneView(villageView(), a)).some((p) => p.id === "nanj"),
			"やきう comes back after his departure",
		);
		ok(
			JSON.stringify(pagesFor(a)) === JSON.stringify(STORY.deep.again),
			"the departure plays again",
		);
		// どの 板・帰り方でも やきうの 頁は 出ない（見た 語りでも、はじめての 語りでも）。着いた 語りから 始まる
		for (const seen of [all, ["deep"] as DungeonId[]]) {
			put(all, seen);
			for (const d of all)
				for (const kind of ["clear", "escape"] as const)
					for (const objective of [undefined, "boss"] as const) {
						const got = pagesFor({ kind, dungeon: d, objective });
						const at = `${d} ${kind} ${objective ?? "fetch"} (seen ${seen.length})`;
						ok(his(got).length === 0, `${at}: やきう is in the scene`);
						ok(
							got.length > 0 && got[0]?.who === null,
							`${at}: does not open with the arrival`,
						);
					}
		}
		// 開いた 知らせでも 話さない
		put(all, all, [{ dungeon: "hidden", reason: "clear" }]);
		const news = fakeStory();
		await newsScript(news.s);
		ok(
			!news.log.some((l) => l.startsWith("say nanj:")) &&
				news.log.some((l) => l.startsWith("say ")),
			`the news after he left:\n${news.log.join("\n")}`,
		);
		// 電池板の 転（「そろそろ　外、行くわ」）も 一度きり
		const deep: ReturnArrival = { kind: "clear", dungeon: "deep" };
		put(["shallow", "main", "deep"], ["shallow", "main"]);
		ok(
			JSON.stringify(pagesFor(deep)) === JSON.stringify(STORY.deep.ending),
			"the 電池板 ending is cut the first time",
		);
		put(["shallow", "main", "deep"], ["shallow", "main", "deep"]);
		ok(
			JSON.stringify(pagesFor(deep)) === JSON.stringify(STORY.deep.again),
			"the 電池板 ending plays again",
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

test("settling in the village: シヨ stores, the rest is sold, ゼロ reads the sales", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow", "main"], [], ["shallow"]);
		const keep = item(1, "bat", { plus: 2 });
		const sell = item(2, "h_heal");
		putTown({
			stage: 4,
			points: 1000,
			pending: pending("escape", [keep, sell]),
		});
		let asked = 0;
		const { s, log } = fakeStory();
		await settleScript(
			s,
			chooser([1], () => {
				asked++;
			}),
		);
		ok(asked === 1, "シヨ did not ask what to store");
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
				`say shiyo: ${TOWN_MSG.storePrompt.text}`,
				`say shiyo: ${TOWN_MSG.storeDone.text}`,
				`say zero: ${fill(TOWN_MSG.sold.text, { points: priceOf(sell) })}`,
			]),
			`the settle is out of order:\n${log.join("\n")}`,
		);
		ok(!log.includes("rebuild"), "the town was rebuilt without growing");
	});
});

test("小段が 上がると 住人が 越してくる：暗転・建て直し・その子を 見せて「〜が、村に　越してきた。」（建物は かわらない）", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow", "main"], [], ["shallow"]);
		// 屋台（段1）で 売上 1000 → 3500（小段 2：にぃちぇ）。建物の 段は まだ（6300）
		putTown({
			stage: 1,
			points: 1000,
			pending: pending("escape", [item(1, "starsword")]),
		});
		const { s, log } = fakeStory();
		await settleScript(s, chooser([]));
		ok(loadTown().stage === 1, `stage ${loadTown().stage}`);
		ok(
			inOrder(log, [
				"rebuild",
				"hide mob_nichie",
				"se served",
				`toast ${TOWN_GREW_MSG}`,
				"show mob_nichie",
				"look mob_nichie",
				`goto mob_nichie ${MOBS.nichie.spot.join(",")}`,
				`narrate: ${fill(ARRIVE_MSG, { names: MOBS.nichie.name })}`,
				"look kiriko",
			]),
			`nichie did not move in:\n${log.join("\n")}`,
		);
		// 小段が かわらなければ 何も しない
		putTown({
			stage: 1,
			points: 3100,
			pending: pending("escape", [item(2, "h_heal")]),
		});
		const quiet = fakeStory();
		await settleScript(quiet.s, chooser([]));
		ok(
			!quiet.log.includes(`toast ${TOWN_GREW_MSG}`),
			"the town grew without a new step",
		);
	});
});

test("the town grows in the village: fade, rebuild, show the new building, then the friends", async () => {
	await withStorageAsync(async () => {
		// はじめて ちょっと を 持ち帰った：空き地 → 屋台
		setProgress(["shallow", "main"], [], ["shallow"]);
		const herb = item(1, "h_heal");
		putTown({ stage: 0, pending: pending("clear", [herb], "shallow") });
		const first = fakeStory();
		await settleScript(
			first.s,
			chooser([], () => ok(false, "a clear asked to store")),
		);
		ok(loadTown().stage === 1, `stage ${loadTown().stage}`);
		ok(
			inOrder(first.log, [
				`narrate: ${fill(SOLD_BARE, { points: priceOf(herb) })}`,
				"fadeOut",
				"rebuild",
				`look ${VILLAGE_SPOTS.growth(1).join(",")}`,
				"fadeIn",
				"se levelup",
				`toast 町が　「${STAGE_NAMES[1]}」に　なった`,
				`narrate: ${fill(ARRIVE_MSG, { names: "ロゼと　ゼロ" })}`,
				...STAGE_UP[1].map((l) => `say ${l.who}: ${l.text}`),
				"look kiriko",
			]),
			`the first stall is out of order:\n${first.log.join("\n")}`,
		);
		// 話す 人は カメラが 見る 建った所の そばに いる。越してきた 仲間は 口から 歩いてくる
		const [gx, gy] = VILLAGE_SPOTS.growth(1);
		const said = first.log.findIndex((l) =>
			l.startsWith(`say ${STAGE_UP[1][0]?.who}: ${STAGE_UP[1][0]?.text}`),
		);
		for (const w of new Set(STAGE_UP[1].map((l) => l.who))) {
			const last = first.log
				.slice(0, said)
				.filter(
					(l) => l.startsWith(`place ${w} `) || l.startsWith(`goto ${w} `),
				)
				.at(-1);
			const [x, y] = (last ?? "").split(" ")[2]?.split(",").map(Number) ?? [];
			ok(
				!!last && Math.max(Math.abs(x - gx), Math.abs(y - gy)) <= 4,
				`${w} talks away from the new stall: ${last}`,
			);
		}
		for (const w of ["roze", "zero"])
			ok(
				inOrder(first.log, [
					`hide ${w}`,
					"se levelup",
					`show ${w}`,
					`look ${w}`,
					`narrate: ${fill(ARRIVE_MSG, { names: "ロゼと　ゼロ" })}`,
				]),
				`${w} does not walk in:\n${first.log.join("\n")}`,
			);
		ok(
			!first.log.some((l) => l.startsWith("narrate: 倉庫から")),
			"a carry hint before the storehouse",
		);
		// 物置（倉庫）が 建つ（段2）：売る 前に 建って シヨが 越してきて、持ちこみの 数を 知らせてから あずける 物を きく
		const sword = item(3, "starsword");
		const herb2 = item(4, "h_heal");
		putTown({
			stage: 1,
			points: STAGE_POINTS[2] - 10,
			pending: pending("escape", [sword, herb2]),
		});
		const store = fakeStory();
		await settleScript(store.s, chooser([3]));
		const built = loadTown();
		ok(built.stage === 2, `stage ${built.stage}`);
		ok(
			built.storage.length === 1 && built.storage[0].kind === "starsword",
			"the sword was sold before the storehouse was built",
		);
		ok(built.points === STAGE_POINTS[2] - 10 + priceOf(herb2), "points");
		ok(built.sales.at(-1)?.up === true, "the sales do not record the growth");
		ok(
			!store.log.includes(`say roze: ${TOWN_MSG.noStorage.text}`),
			"ロゼ says there is no storehouse after it was built",
		);
		ok(
			inOrder(store.log, [
				`toast 町が　「${STAGE_NAMES[2]}」に　なった`,
				"show shiyo",
				`narrate: 倉庫から　引き取って\n${CARRY_MAX[2]}つまで　持っていける`,
				`say shiyo: ${TOWN_MSG.storePrompt.text}`,
				`say shiyo: ${TOWN_MSG.storeDone.text}`,
			]),
			`the storehouse is not built before storing:\n${store.log.join("\n")}`,
		);
		ok(store.log.filter((l) => l === "rebuild").length === 1, "rebuilt twice");
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
			!a.log.some((l) => l.startsWith("say zero")),
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
				`say shiyo: ${TOWN_MSG.storageFull.text}` &&
				loadTown().storage.length === 10 &&
				!loadTown().pending,
			`full storehouse:\n${c.log.join("\n")}`,
		);
		// 何も 持ち帰らなかった：ひとことだけ
		putTown({ stage: 4, points: 1000, pending: pending("escape", []) });
		const d = fakeStory({ near: ["shiyo"] });
		await settleScript(d.s, chooser([]));
		ok(
			d.log.length === 1 &&
				d.log[0] === `say shiyo: ${TOWN_MSG.nothingToStore.text}`,
			`empty escape:\n${d.log.join("\n")}`,
		);
		// おあずかりが 無い（倒れた・もう 決めた）：何もしない
		const e = fakeStory();
		await settleScript(e.s, chooser([]));
		ok(e.log.length === 0, `settled without a haul: ${e.log.join()}`);
	});
});

// ───────────────── おんJマイナーズ（ui/villageMobs.ts） ─────────────────

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

test("おんJマイナーズ move in one by one as the town grows", () => {
	for (const v of VIEWS) {
		const here = villagePlaces(v).filter((p) => p.mob);
		const want = MOB_IDS.filter((id) => MOBS[id].from <= lastStepOf(v.stage));
		ok(
			here.length === want.length,
			`${label(v)}: ${here.map((p) => p.id).join()}`,
		);
		// 小段の 途中：その 小段までに 越してきた 子だけ
		for (let step = 0; step <= lastStepOf(v.stage); step++) {
			const at = villagePlaces({ ...v, step }).filter((p) => p.mob).length;
			const n = MOB_IDS.filter((id) => MOBS[id].from <= step).length;
			ok(at === n, `${label(v)} step ${step}: ${at} residents (want ${n})`);
		}
	}
	const froms = MOB_IDS.map((id) => MOBS[id].from);
	ok(
		froms.every((f) => f >= 0 && f < TOWN_STEPS.length),
		`move-in steps: ${froms}`,
	);
	// 小段ごとに 1人ずつ（同じ 小段に 2人は 来ない）
	ok(new Set(froms).size === froms.length, `two move in at once: ${froms}`);
	// はじめから いるのは ぷゆゆ だけ（マイナーズは 町が 育ってから）
	ok(
		MOB_IDS.filter((id) => MOBS[id].from === 0).join() === "puyu",
		"only ぷゆゆ is there from the start",
	);
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
		setProgress(["shallow", "main"]);
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
		pushRecord({ kind: "dead", cause: "おなかが　すいて　たおれた" });
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
		// 次は 前の冒険への 反応、そのあと いつもの
		const e = fakeStory();
		await mobScript(id)(e.s);
		ok(e.log.join() === plain(reactionOf(d) ?? ""), `reaction: ${e.log}`);
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
		setProgress(["shallow", "main"], [], ["shallow", "main"]);
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

test("the very first village: Kiriko walks in from the south road, sets down the phonograph, やきう points at the mouth, the goal — once", async () => {
	const texts: [string, string][] = [];
	for (const [k, v] of Object.entries(OPENING))
		v.forEach((t, i) => {
			texts.push([`OPENING.${k}[${i}]`, t]);
		});
	fitsWindow(texts);
	await withStorageAsync(async () => {
		setProgress(["shallow"]);
		ok(needsOpening(), "no opening on the first boot");
		// 幕が 上がる 前：南の 道の はしに 立ち、蓄音機は まだ 無い
		const a = fakeStory();
		openingPrepare(a.s);
		ok(
			a.log.includes("place player 20,31") && a.log.includes("hide phono"),
			`prepare:\n${a.log.join("\n")}`,
		);
		await openingScript(a.s);
		const [bx, by] = VILLAGE_SPOTS.boot;
		ok(
			a.s.state.x === bx && a.s.state.y === by,
			`Kiriko stops at (${a.s.state.x},${a.s.state.y}), not in front of the phonograph`,
		);
		ok(
			inOrder(a.log, [
				`narrate: ${OPENING.arrive[0]}`,
				`narrate: ${OPENING.premise[0]}`,
				"show phono",
				`narrate: ${OPENING.premise[1]}`,
				"look nanj",
				`say nanj: ${OPENING.nanjCall[0]}`,
				`look ${VILLAGE_SPOTS.exit.join(",")}`,
				"look kiriko",
				`narrate: ${OPENING.goal[0]}`,
			]),
			`opening:\n${a.log.join("\n")}`,
		);
		ok(!needsOpening(), "the opening plays twice");
	});
	await withStorageAsync(async () => {
		setProgress(["shallow"]);
		pushRecord({});
		ok(!needsOpening(), "the opening plays after a run");
	});
});

// ───────────────── ぷゆゆ（はじめから いる 子。data/mobs.ts の MOBS.puyu） ─────────────────

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
				["ぷゆゆに　たおされた", 1, false],
				["メタルぷゆゆに　たおされた", 12, false],
				["おなかが　すいて　たおれた", 9, false],
				["コピペに　たおされた", 15, true],
				["dat落ちの霊に　たおされた", 2, false],
			] as const)
				rich.push({
					last: { kind: "dead", cause, depth, returning },
					seen: ["tousuko", "metal"],
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

test("ぷゆゆ・マイナーズ: Kiriko speaks only in chats and never says 保守", () => {
	let n = 0;
	for (const id of MOB_IDS) {
		const d = MOBS[id];
		const outside: MobLine[] = [
			...d.meet,
			...Object.values(d.milestones).flatMap((v) => v ?? []),
			...(d.ask ? [...d.ask.lines, ...d.ask.yes, ...d.ask.no] : []),
			...d.thx,
		];
		ok(
			outside.every((l) => l.who !== "kiriko"),
			`${id}: Kiriko speaks outside chats`,
		);
		for (const c of d.chats)
			for (const l of c.lines) {
				if (l.who !== "kiriko") continue;
				n++;
				ok(!l.text.includes("保守"), `${id}.${c.key}: Kiriko says 保守`);
				ok(l.text.includes("ンゴ"), `${id}.${c.key}: Kiriko without ンゴ`);
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
				!!d.wander &&
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
		pushRecord({ kind: "dead", cause: "dat落ちの霊に　たおされた", depth: 1 });
		ok(hasMobNews("puyu"), "no 「！」 after an early fall");
		const b = fakeStory();
		await mobScript("puyu")(b.s);
		ok(
			b.log[0] === said(chat("hayai")[0]?.text),
			`early fall:\n${b.log.join("\n")}`,
		);
		const b2 = fakeStory();
		await mobScript("puyu")(b2.s);
		ok(
			b2.log.join() === said(seasonalToday(d) ?? idleOf(d)),
			`the same fall answered twice:\n${b2.log.join("\n")}`,
		);
		// 2回目：下で 会った 子の 話（図鑑に ぷゆゆ）
		pushRecord({ kind: "dead", cause: "コピペに　たおされた", depth: 6 });
		const c = fakeStory();
		await mobScript("puyu")(c.s);
		ok(
			c.log[0] === said(chat("nakama")[0]?.text),
			`nakama:\n${c.log.join("\n")}`,
		);
		// 3回目：ぷゆゆに たおされた（前の版の 名前の 記録でも）→ 標準語の ひとこと
		pushRecord({ kind: "dead", cause: "とうすこに　たおされた", depth: 2 });
		const e = fakeStory();
		await mobScript("puyu")(e.s);
		ok(
			e.log.includes(said(chat("maketa")[1]?.text)),
			`lost to ぷゆゆ:\n${e.log.join("\n")}`,
		);
		// たおれ方ごとの 反応（メタルが 先。前の版の 名前でも）
		for (const [cause, depth, i] of [
			["メタルぷゆゆに　たおされた", 12, 0],
			["メタルとうすこに　たおされた", 12, 0],
			["ぷゆゆに　たおされた", 1, 1],
			["とうすこに　たおされた", 2, 1],
			["dat落ちの霊に　たおされた", 2, 3],
		] as const) {
			pushRecord({ kind: "dead", cause, depth });
			ok(
				reactionOf(d) === d.react.by?.[i]?.text,
				`reaction to ${cause}: ${reactionOf(d)}`,
			);
		}
		pushRecord({
			kind: "dead",
			cause: "コピペに　たおされた",
			depth: 15,
			returning: true,
		});
		ok(reactionOf(d) === d.react.by?.[2]?.text, "no reaction on the way back");
		pushRecord({ kind: "dead", cause: "おなかが　すいて　たおれた", depth: 8 });
		ok(reactionOf(d) === d.react.starve, "no reaction to hunger");
		pushRecord({ kind: "escape" });
		ok(reactionOf(d) === d.react.escape, "no reaction to an escape");
	});
});

test("ぷゆゆ: one new talk per return in array order, mob pairs only when both are near, callbacks after their setup", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow", "main"], [], ["shallow"]);
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
		const cause = "メタルとうすこに　たおされた";
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
		ok(r?.cause === "メタルぷゆゆに　たおされた", `record: ${r?.cause}`);
		ok(
			!!r && !!p && p.cause === r.cause && replayMatches(p, r),
			"the old replay lost its record",
		);
	});
});

test("old records with the renamed monsters read with the new names", () => {
	withStorage(() => {
		for (const [old, now] of [
			["ひとだまに　たおされた", "dat落ちの霊に　たおされた"],
			["ばくだんの　爆発に　巻きこまれた", "炎上案件の　爆発に　巻きこまれた"],
			["ゴーレムに　吹きとばされた", "論破厨に　吹きとばされた"],
			["ゴリラに　吹きとばされた", "論破厨に　吹きとばされた"],
			["凍結アカに　たおされた", "VIPPERに　たおされた"],
			["フナムシに　たおされた", "ROM専に　たおされた"],
			["バグに　たおされた", "ROM専に　たおされた"],
			["深夜テンションに　たおされた", "夏休みキッズに　たおされた"],
			["過疎に　たおされた", "かまってちゃんに　たおされた"],
			// 影 は 1文字なので「影に」だけ 読みかえる
			["影に　たおされた", "透明あぼーんに　たおされた"],
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
		ok(replays.length === 6, `harness: ${replays.length} boss boards`);
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
			floorsText(def) === `${where}（${DUNGEON_NAMES[d].name}の　ボス）`,
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
			endLine(rec) === `${DUNGEON_NAMES[d].short}　${where}で　${b.cause}`,
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
			head.includes(`${where}で　${b.cause}`) &&
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
		g.event?.name === "パン板の　大行進" &&
			g.event.endsIn === "次の　クリアか　あと　3回",
		`the march reads ${g.event?.name} / ${g.event?.endsIn}`,
	);
	ok(
		eventText(g) === "期間限定：パン板の　大行進（次の　クリアか　あと　3回）",
		eventText(g),
	);
	ok(
		objectiveFor("kinoko", march).objective === "boss" &&
			!objectiveFor("kinoko", march).event,
		"the march changed きのこ板",
	);
	ok(
		objectiveFor("main", march).objective === "fetch",
		"the march changed 風呂板",
	);
	// きのこ狩り：きのこ板が 持ち帰りに（出撃の 回数だけで 終わる）
	const hunt = prog({
		outings: 6,
		event: { id: "kinoko-hunt", since: 5, clearsSince: 0 },
	});
	const k = objectiveFor("kinoko", hunt);
	ok(k.objective === "fetch", "the hunt keeps the boss");
	ok(k.event?.endsIn === "あと　2回", `the hunt reads ${k.event?.endsIn}`);
	// 知らない イベント（あとの 版で 消えた）は 無かった ことに
	const gone = prog({ event: { id: "no-such", since: 0, clearsSince: 0 } });
	for (const d of DUNGEON_IDS)
		ok(
			objectiveFor(d, gone).objective === DUNGEONS[d].objective,
			`an unknown event changed ${d}`,
		);
	// 目的の ひとこと
	ok(
		goalText("kinoko", "boss") === "親玉きのにゃんを　たおす",
		goalText("kinoko", "boss"),
	);
	ok(
		goalText("shallow", "fetch") === "植民地化宣言を　持ち帰る",
		goalText("shallow", "fetch"),
	);
	ok(
		goalText("deep", "boss") === "鉄塔の保守スレを　持ち帰る",
		"a board without a boss reads as a boss run",
	);
	ok(bossName("tropical") === "怒れるナツコ", `${bossName("tropical")}`);
	ok(bossName("hidden") === null, "過去ログの底 has a boss");
});

test("events start from how a run ended, a need, and a fixed value of the seed (no Math.random), one at a time", () => {
	noRandom(() => {
		// パン板の 大行進：パン板を クリアずみで、クリアの あと 1/3
		const base = prog({ unlocked: ["shallow", "main"], cleared: ["shallow"] });
		const clear = { dungeon: "main" as DungeonId, kind: "clear" as const };
		const hits = SEEDS.filter(
			(seed) =>
				advanceEvents(base, { ...clear, seed }).started?.id === "pan-march",
		);
		const rate = hits.length / SEEDS.length;
		ok(rate > 0.25 && rate < 0.42, `the march started ${rate} of the time`);
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
		// きのこ狩り：きのこ板に 行けて、出撃が 5の 倍数に なったら 1/2（終わりかたは 問わない）
		const kin = prog({ unlocked: ["shallow", "kinoko"], outings: 4 });
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
				{ ...kin, outings: 5 },
				{
					dungeon: "shallow",
					kind: "dead",
					seed: huntHit,
				},
			).started,
			"the hunt started on the 6th outing",
		);
		ok(
			!advanceEvents(prog({ outings: 4 }), {
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
		// 終わったら 同じ 知らせの あとで ほかの イベントが 始まる ことは ある（きのこ狩り：出撃 5回目）
		const withKinoko: Progress = {
			...march(4),
			unlocked: ["shallow", "main", "kinoko"],
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
		let p = prog({ unlocked: ["shallow", "kinoko"] });
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
		for (let i = 1; i <= 4; i++) {
			noteRunEnd("shallow", "dead", `run-${i}`);
			ok(loadProgress().outings === i, `outings ${loadProgress().outings}`);
		}
		ok(!loadProgress().eventNews, "news before any event");
		// 開発用の 冒険は 数えない
		noteRunEnd("shallow", "dead", "debug:x");
		ok(loadProgress().outings === 4, "a debug run was counted");
		// 5回目で 始まる（1/2 に 当たる シード）
		const huntSeed = SEEDS.find(
			(seed) =>
				advanceEvents(prog({ unlocked: ["shallow", "kinoko"], outings: 4 }), {
					dungeon: "kinoko",
					kind: "clear",
					seed,
				}).started?.id === "kinoko-hunt",
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
			first && first.who === null && first.text.startsWith("村に　帰りつくと"),
			`${d}: the ending does not open with the arrival: ${first?.text}`,
		);
		// 仲間が みんな 越してきた 町で（まだ 来ていない 仲間の 頁は 出ない）
		let got: readonly StoryPage[] = [];
		await withStorageAsync(async () => {
			putTown({ stage: 7 });
			got = pagesFor({ kind: "clear", dungeon: d, objective: "boss" });
		});
		ok(
			got[0] === first &&
				JSON.stringify(got.slice(1, 1 + n)) ===
					JSON.stringify(BOSS_RETURN[d]) &&
				got.length === STORY[d].ending.length + n,
			`${d}: the boss pages are not right after the arrival`,
		);
	}
	await withStorageAsync(async () => {
		setProgress(["shallow", "kinoko"]);
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
		];
		ok(
			JSON.stringify(pagesFor(a)) === JSON.stringify(pages),
			"the boss pages do not come right after the arrival",
		);
		ok(
			JSON.stringify(pagesFor({ ...a, objective: "fetch" })) ===
				JSON.stringify(STORY.kinoko.ending) &&
				JSON.stringify(pagesFor({ kind: "clear", dungeon: "kinoko" })) ===
					JSON.stringify(STORY.kinoko.ending),
			"a fetch clear got boss pages",
		);
		ok(
			pagesFor({ kind: "escape", dungeon: "kinoko", objective: "boss" }) ===
				RETURN_PAGES,
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
					p.who ? `say ${p.who}: ${p.text}` : `narrate: ${p.text}`,
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

// ───────────────── おんJ 本館（data/village/hall.ts・ui/hallEvents.ts） ─────────────────

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
				hallPlaces({ stage, unlocked: ["shallow"], cleared: [] }).map((p) =>
					kindOf(p.id),
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
			cleared: [],
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

test("保守の 当番表: one 「保守」 per return, counted in its own save, nothing else changes", async () => {
	await withStorageAsync(async () => {
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
		setProgress(["shallow"], [], ["shallow", "kinoko"]);
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

test("村の 曲: the stage picks it, the gramophone offers only songs heard on cleared boards, and a pick not on it falls back", () => {
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
		"the gramophone lists a song twice",
	);
	ok(
		records(5, ["shallow"]).some((r) => r.bgm === BOARD_LOOKS.shallow.bgm) &&
			!records(5, ["shallow"]).some((r) => r.bgm === BOARD_LOOKS.deep.bgm),
		"a board's song is offered before it is cleared",
	);
	ok(villageBgm(5, [], "deq_ice") === "kumori", "an unheard pick plays");
	ok(
		villageBgm(5, [], "town") === "town",
		"the old village song cannot be picked",
	);
	ok(villageBgm(5, [], null) === "kumori", "no pick does not follow the stage");
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
			r.desc === (ON_PHONO.includes(r.d) ? ON_PHONO_TEXT : item.flavor),
			`${r.d}: ${r.desc}`,
		);
	}
	ok(shelfRows([]).length === 0, "an empty shelf has rows");
	ok(
		trophies(["shallow", "main", "hidden", "kinoko"]).join() ===
			"kinoko,hidden",
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
			texts.push([where, fill(v, { n: 999, name: "風呂板の　湯けむり騒動" })]);
		else if (Array.isArray(v))
			v.forEach((x, i) => {
				add(`${where}[${i}]`, x);
			});
	};
	for (const [k, v] of Object.entries(HALL_MSG))
		if (k !== "noticeGoal") add(`HALL_MSG.${k}`, v);
	for (const [k, j] of Object.entries(JIKKYO)) add(`JIKKYO.${k}`, j.lines);
	STAGE_UP_HALL.forEach((l, i) => {
		if (l) texts.push([`STAGE_UP_HALL[${i}]`, l.text]);
	});
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
	ok(
		STAGE_UP_HALL[0] === null && !!STAGE_UP_HALL[1] && !!STAGE_UP_HALL[2],
		"STAGE_UP_HALL",
	);
});

test("the town grows into a new hall: after the friends, the camera looks at the hall for one more line (also when stages are skipped)", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow", "main"], [], ["shallow"]);
		const look = `look ${VILLAGE_SPOTS.hallLook.join(",")}`;
		const cases: [number, number, PendingReturn, number | null][] = [
			[2, STAGE_POINTS[3] - 10, pending("escape", [item(1, "starsword")]), 1],
			[5, STAGE_POINTS[6] - 10, pending("escape", [item(1, "starsword")]), 2],
			[
				3,
				STAGE_POINTS[4] - 10,
				pending("escape", [item(1, "starsword")]),
				null,
			],
			// 電池板を 持ち帰ると いちどに 段7（本館の 形は 集会所から 本館へ。STORY.md §5 の 転）
			[1, 100, pending("clear", [item(1, "h_heal")], "deep"), 2],
		];
		for (const [stage, points, pend, tier] of cases) {
			putTown({ stage, points, pending: pend });
			const { s, log } = fakeStory();
			await settleScript(s, chooser([]));
			const to = loadTown().stage;
			ok(to > stage, `stage ${stage} did not grow`);
			const hall = tier === null ? null : STAGE_UP_HALL[tier];
			if (!hall) {
				ok(
					!log.includes(look),
					`${stage} → ${to}: looked at the hall:\n${log.join("\n")}`,
				);
				continue;
			}
			ok(
				inOrder(log, [
					"rebuild",
					...(STAGE_UP[to] ?? [])
						.filter(
							(l) => !awayFriends(loadProgress().cleared, to).includes(l.who),
						)
						.map((l) => `say ${l.who}: ${l.text}`),
					look,
					`say ${hall.who}: ${hall.text}`,
					"look kiriko",
				]),
				`${stage} → ${to}: the hall is not shown:\n${log.join("\n")}`,
			);
		}
	});
});

// ───────────────── 建物の 中（喫茶・小屋・常識堂の 奥・倉庫。data/village/rooms.ts・ui/rooms.ts・ui/cafe.ts） ─────────────────

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
		// 調べる 物には 文が ある
		for (const p of places) {
			if (p.trigger === "touch") continue;
			const kind = p.id.replace(/_\d+$/, "");
			const lines =
				id === "cafe"
					? ((ROOM_MSG.cafe as Record<string, readonly string[]>)[kind] ?? [])
					: thingLines(id, kind, 5);
			ok(lines.length > 0, `${id}: ${p.id} has nothing to say`);
		}
	}
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

test("建物の 扉: the cafe and hut doors are stepped on from their stage, and every room lets Kiriko out onto the road", () => {
	for (const v of VIEWS) {
		const s = survey(v);
		for (const [id, door] of [
			["cafe", "door_cafe"],
			["hut", "door_hut"],
			["music", "door_music"],
		] as const) {
			const p = s.places.find((q) => q.id === door);
			ok(
				!!p === v.stage >= ROOM_FROM[id],
				`${label(v)}: ${door} does not match the stage`,
			);
			if (p)
				ok(
					p.trigger === "touch" && s.reachable(p.x, p.y),
					`${label(v)}: cannot step on ${door}`,
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
				"se door",
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
				"se door",
				"fadeOut",
				`warp village ${o.x},${o.y} ${o.dir}`,
				"fadeIn",
			]),
			`${id}: the way out:\n${log.join("\n")}`,
		);
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
				`narrate: キリコは　${defOf("h_heal").name}を　わたした。`,
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
			ok(MOBS[p.id].from <= lastStepOf(7), `${at}: ${p.id} has not moved in`);
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
	// 段5 は 越してきた 子だけ
	for (let at = 1000; at < 1050; at++)
		for (const p of cafeLayout(5, at, layoutTalks).patrons)
			ok(MOBS[p.id].from <= lastStepOf(5), `stage 5: ${p.id}`);
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
	for (const [k, t] of Object.entries(ROOM_DOOR)) texts.push([`door ${k}`, t]);
	for (const [k, t] of Object.entries(KEEPER_LINE))
		texts.push([`keeper ${k}`, t]);
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
			c.hello && c.idle && c.treat.includes("{drink}"),
			`${id}: cafe lines missing`,
		);
		texts.push([`${id} hello`, c.hello], [`${id} idle`, c.idle]);
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
