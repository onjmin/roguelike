// 村（保守村）の イベントの スクリプトと、B／☰ の 村の メニュー。
// 地図の形と 人・物の 置き場所は data/village/map.ts（DOM を使わない）。ここで id ごとに スクリプトを付ける。
//
// - ダンジョンの口：踏むと 中断した冒険の 確認 → もぐる？ → （本編なら）倉庫からの 持ちこみ →
//   はじめてなら 語り → 村を出る。やめたら 1歩 もどる。板ごとの 目的（持ち帰り・ボス。期間限定の
//   イベントも。data/objectives.ts）は 行き先を 選ぶ 前に 1回だけ 決めて、地図と 冒険に 同じ 値を 渡す。
// - 立て札：ダンジョンの 名前・階の数・持ち帰ったら ★・説明（開いていなければ 開き方）。口でも 同じ 札を 読む。
// - 仲間：1回の 帰りに 1人 1つ、前の冒険への 新しい ひとこと。聞いたら 町の様子の
//   決まった ひとこと（ui/villageTalk.ts）。話すだけ（店番の ロゼ・シヨも）。
//   機能は 人に 結びつけず 物に 置く（冒険の記録＝掲示板、図鑑・あそびかた・売り上げ・リプレイ＝本館の 中の 物、
//   倉庫＝倉庫の 中の 棚）。B／☰ の メニューは 持ち物・あらすじ・せってい だけ。
// - 板で ふさいだ口・掲示板・蓄音機は 調べると 地の文。段7 は 野次馬も 話す。
// - 喫茶・小屋・銭湯・音楽室・本屋・倉庫・常識堂の 勝手口の 扉は 踏むと 中へ（ui/cafe.ts・ui/rooms.ts）。
//   倉庫・常識堂の 扉は 台の 横の 細道の 奥（店番に たのまなくても 入れる）。
// - おんJ 本館の 扉（2マス）は 踏むと（前で A でも）中の 地図へ（ui/hallEvents.ts）。
// - おんJマイナーズ（町が 育つと 越してくる）と ぷゆゆ（はじめから いる）は ui/villageMobs.ts。2人に 会うと 掲示板に 総選挙の はり紙。
// - 開発用の 段の 下見（?stage=N）は 描く段だけ かえる（ui/villageReturn.ts の previewStage）。
// - 帰ってきたとき（prepare・onEnter）：口の前に 仲間が 並んで むかえる → 開いた知らせ → 持ち帰った物の
//   倉庫・売り → 町が 育つ（場面は ui/villageReturn.ts。あずける 一覧だけ ui/home.ts）。
// - いちばん最初（一度も もぐっていない）は 前口上と 行き先の 場面（ui/villageOpening.ts）。

import { DUNGEON_IDS, DUNGEONS } from "../core/data/dungeons";
import { MONSTERS } from "../core/data/monsters";
import { CARRY_MAX } from "../core/town";
import type { DungeonId, Item } from "../core/types";
import { CAST } from "../data/cast";
import { LIBRARY_FROM } from "../data/glossary";
import { BOARD_MENU, MOB_IDS, MOBS, type MobId } from "../data/mobs";
import {
	type ObjectiveInfo,
	objectiveFor,
	withDevEvent,
} from "../data/objectives";
import type { Speaker } from "../data/quotes";
import { SCRAP_MSG, SCRAPS, type Scrap } from "../data/scraps";
import {
	awayFriends,
	DEPART,
	DUNGEON_NAMES,
	HOSHU_SIGN,
	LIGHTHOUSE_DOOR,
	QUIET_SPOT,
	ROM_COUNT,
	STORY,
} from "../data/story";
import { synopsisNow } from "../data/synopsis";
import {
	CARRY_CHASE,
	CARRY_REFUSE,
	STAGE_NAMES,
	TOWN_MSG,
	TOWN_NAME,
	VILLAGE_MSG,
} from "../data/town";
import { facilityOfDoor, outdoorThingOf } from "../data/village/facilities";
import { npc, sign } from "../data/village/helpers";
import {
	VISITOR_WALK,
	type VillagePlace,
	type VillageView,
	villagePalette,
	villagePlaces,
	villageRows,
} from "../data/village/map";
import type { EventDef, MapDef, Script, Story } from "../engine/defs";
import {
	addFlag,
	addRecord,
	clearRun,
	depositBag,
	hasFlag,
	hasRunSave,
	loadProgress,
	loadRecords,
	loadRun,
	loadScraps,
	loadTown,
	notePicked,
	noteRunEnd,
	readScrap,
	recordFromRun,
} from "../engine/save";
import { chimneySteam } from "./bath";
import { runSaveLabel } from "./boot";
import { enterCafe } from "./cafe";
import { civicBoardMenu, civicBoardScript } from "./civic";
import type { Ctx } from "./ctx";
import { enterFacility, outdoorScript, shadowDecor } from "./facilities";
import { enterHall } from "./hallEvents";
import { chooseStored, openBag } from "./home";
import { infoWindow, type ListItem, listWindow } from "./list";
import { playGetter } from "./minigames";
import { makeQuiz } from "./quiz";
import { escBr, openRecords, showStory } from "./records";
import { enterMusic, enterRoom } from "./rooms";
import { openSettings } from "./settings";
import type { Arrival } from "./village";
import { mobScript, senkyoOpen, senkyoScript } from "./villageMobs";
import { chooseRecord, villageSong } from "./villageMusic";
import { needsOpening, openingPrepare, openingScript } from "./villageOpening";
import {
	deathScene,
	kusaScript,
	lineUp,
	lunchScript,
	NEWCOMER,
	newsScript,
	previewStage,
	type ReturnArrival,
	ROMS,
	returnScene,
	type StoreChooser,
	sceneView,
	sendBack,
	settleScript,
	TALK_NEAR,
	tamperScript,
	wrapScript,
} from "./villageReturn";
import {
	DUNGEON_DESC,
	fill,
	pinnedScrap,
	scrapReturnAt,
	talkLine,
} from "./villageTalk";
import { openWorldMap, pickColony, travelTo } from "./worldMap";

/** 開いた 植民地の 札（名前・通称・階の数・持ち帰ったら ★、2行目に 板の 決まり）。口と 立て札で 読む。 */
const signText = (d: DungeonId): string =>
	`「${DUNGEON_NAMES[d].name}（${DUNGEON_NAMES[d].nick}）」　${DUNGEONS[d].floors}階${loadProgress().cleared.includes(d) ? "　★" : ""}\n${DUNGEON_DESC[d]}`;

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

/** 冒険の記録を見る（記録だけ。リプレイは 本館の 映写機で：ui/hallEvents.ts）。 */
const records = async (ctx: Ctx, s: Story): Promise<void> => {
	await hideMsg(s);
	await openRecords(ctx);
};

/** 飾りを 重ねる（影 → 湯気の 順）。 */
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

/** 冒険を すてる 前の 計算問題（ui/quiz.ts）。まちがえたら すてない。 */
const discardQuiz = async (s: Parameters<Script>[0]): Promise<boolean> => {
	const q = makeQuiz();
	await s.narrate(`すてる　なら、問題に　答えて。\n${q.text}　は？`);
	const n = await s.choose([...q.options.map(String), "やめる"], {
		cancel: 4,
		start: 4,
	});
	if (n === 4) return false;
	if (q.options[n] === q.answer) return true;
	await s.narrate("ちがう。すてるのは　やめておいた。");
	return false;
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
	const n = await s.choose(
		["冒険に　もどる", "すてて　新しく　もぐる", "やめる"],
		{
			cancel: 2,
		},
	);
	// すてるのは もどせないので もう一度 きく
	if (n === 1) {
		await s.narrate("中断した　冒険は　もどらない。\n本当に　すてる？");
		if (
			(await s.choose(["すてる", "やめる"], { cancel: 1, start: 1 })) !== 0 ||
			!(await discardQuiz(s))
		) {
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
	// シヨが 追いかけてきて 倉庫へ もどす（わけは data/town.ts の CARRY_REFUSE。全体マップの 札にも 出る）
	let carry: Item[] = loadTown().bag;
	const refuse = DUNGEONS[d].noCarry
		? CARRY_REFUSE[d as keyof typeof CARRY_REFUSE]
		: undefined;
	if (carry.length && refuse) {
		await s.narrate(CARRY_CHASE);
		await s.say(refuse.who, refuse.text);
		depositBag();
		carry = [];
	}
	// 潜る ときの 一言（やきう。出ていった あとは キリコの 独白。STORY.md §5.9）。
	// キリコは 1人で 出ていく：やきうが そばに いるときだけ 声を かける
	if (awayFriends(loadProgress().cleared).includes("nanj"))
		await s.kiriko(DEPART.kiriko, "think");
	else if (s.near("nanj", TALK_NEAR)) await s.say("nanj", DEPART.nanj);
	notePicked(d, false);
	await hideMsg(s);
	await travel();
	// そのダンジョンに はじめて もぐるなら 語りを見せる（見終わってから 覚える。途中で閉じたら 次も はじめから）
	if (!loadProgress().intro.includes(d)) {
		void ctx.audio.fadeBgm(500);
		await s.fadeOut(500);
		await showStory(ctx, STORY[d].intro.map(escBr));
		notePicked(d, true);
	}
	// ぷゆゆの お弁当（村に 帰って 持ち物が からっぽなら もらえる。ui/villageReturn.ts の lunchScript）
	s.exit({
		kind: "new",
		dungeon: d,
		carry,
		objective: goal.objective,
		lunch: loadTown().lunch,
	});
};

/**
 * 広場の 井戸（5段から）。過去ログの底（保守村の 真下）へは ここからだけ 降りる（全体マップには 出さない）。
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
		await departTo(ctx, s, "hidden", goalsNow().hidden, async () => {
			s.se("stairs");
			await s.narrate(VILLAGE_MSG.wellDown);
		});
	};

/** おみくじを 引いた 帰り（記録の 終わった 時刻。1回の 帰りに 1回）。 */
const OMIKUJI_KEY = "kiriko-roguelike/omikuji";

/** 保守神社の 賽銭箱（段2 から）。お参りすると おみくじ（地の文だけ。冒険には 効かない）。 */
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
		// 行き先（はじめは 前に 行った 板。無ければ パン板。全体マップで ほかの 板も 選べる。
		// 過去ログの底は 井戸から なので 地図には 出さない）
		const last = loadProgress().last;
		let d: DungeonId =
			last && !DUNGEONS[last].secret && loadProgress().unlocked.includes(last)
				? last
				: "shallow";
		// やめたら 1歩 もどる（バス停は 踏まずに 調べるので もどらない）
		const back = async () => {
			if (step) await s.move("player", step);
		};
		if (!(await suspendedFirst(s, back))) return;
		// 行き先の 植民地（全体マップで 選ぶ。ui/worldMap.ts）
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
		});
		const quit = async () => {
			await hideMsg(s);
			await map.close();
			await back();
		};
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
			// 静かな 板（裏シナリオの 入口の 小島）は 行くまで 名前を 出さない（QUIET_SPOT）
			const quiet = DUNGEONS[d].quiet && !loadProgress().intro.includes(d);
			const ok = await s.choose(
				[
					quiet ? QUIET_SPOT.go : `${DUNGEON_NAMES[d].name}へ　行く`,
					"えらびなおす",
					"やめる",
				],
				{ cancel: 1 },
			);
			if (ok === 2) {
				await quit();
				return;
			}
			if (ok !== 0) continue;
			// 灯台の 扉は パスワード（乗っ取り屋の 置き手紙 3枚が 手がかり。当てるまで 入れない。STORY.md §5.98）
			if (d === "opunu" && !hasFlag("pass") && !(await passwordScript(s)))
				continue;
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

/**
 * 灯台の 扉の パスワード（4択。答えは 置き手紙の とおり 12345）。当てれば 旗 pass が 立って 二度と きかれない。
 * 外しても 笑われる だけで、また 当てられる（地図に もどる）。
 */
const passwordScript = async (s: Story): Promise<boolean> => {
	await s.narrate(LIGHTHOUSE_DOOR.ask);
	const n = await s.choose([...LIGHTHOUSE_DOOR.options, "やめる"], {
		cancel: LIGHTHOUSE_DOOR.options.length,
	});
	if (n >= LIGHTHOUSE_DOOR.options.length) return false;
	if (LIGHTHOUSE_DOOR.options[n] !== LIGHTHOUSE_DOOR.answer) {
		s.se("cancel");
		await s.narrate(LIGHTHOUSE_DOOR.wrong);
		return false;
	}
	s.se("decide");
	addFlag("pass");
	await s.narrate(LIGHTHOUSE_DOOR.open);
	return true;
};

/** 切れはしを 読む（見出し・名無しの 書きこみ・それきり）。乗っ取り屋の 置き手紙は 見出しと 結びが ちがう。 */
const readScrapScript = async (s: Story, x: Scrap): Promise<void> => {
	const memo = x.kind === "memo";
	await s.narrate(
		fill(memo ? SCRAP_MSG.headMemo : SCRAP_MSG.head, {
			board: DUNGEON_NAMES[x.board].name,
		}),
	);
	await s.say("nanj", x.text, {
		name: memo ? "乗っ取り屋" : "名無しさん@おんJ",
	});
	await s.narrate(memo ? SCRAP_MSG.afterMemo : SCRAP_MSG.after);
};

/**
 * まとめ掲示板：新しい 切れはしが 貼られて いれば まず それを 読む。ふだんは 冒険の 記録・読んだ 切れはし・
 * 総選挙の はり紙（出て いれば）から えらぶ。
 */
const boardScript =
	(ctx: Ctx): Script =>
	async (s) => {
		const pin = pinnedScrap();
		if (pin) {
			await s.narrate(
				pin.kind === "memo" ? SCRAP_MSG.pinnedMemo : SCRAP_MSG.pinned,
			);
			await readScrapScript(s, pin);
			readScrap(pin.id, scrapReturnAt());
			return;
		}
		await s.narrate(VILLAGE_MSG.board);
		const readAll = SCRAPS.filter((x) => loadScraps().read.includes(x.id));
		const read = readAll.filter((x) => x.kind !== "memo");
		const memos = readAll.filter((x) => x.kind === "memo");
		// 寄り合いの はり紙（段2〜3）・議会だより（段4〜）。ui/civic.ts
		const stage = previewStage() ?? loadTown().stage;
		const civic = civicBoardMenu(stage);
		const opts = [
			"冒険の記録",
			...(read.length ? ["古い　切れはし"] : []),
			...(memos.length ? [SCRAP_MSG.listMemo] : []),
			...(senkyoOpen() ? [BOARD_MENU[1]] : []),
			...(civic ? [civic] : []),
			"やめる",
		];
		if (opts.length === 2) {
			await records(ctx, s);
			return;
		}
		const n = await s.choose(opts, { cancel: opts.length - 1 });
		const v = opts[n];
		if (v === "冒険の記録") await records(ctx, s);
		else if (v === BOARD_MENU[1]) await senkyoScript(s);
		else if (civic && v === civic) await civicBoardScript(s, stage);
		else if (v === "古い　切れはし" || v === SCRAP_MSG.listMemo) {
			const memo = v === SCRAP_MSG.listMemo;
			const list = memo ? memos : read;
			const all = SCRAPS.filter((x) => (x.kind === "memo") === memo).length;
			await hideMsg(s);
			const id = await listWindow(
				ctx,
				`${v}　${list.length}／${all}`,
				list.map((x) => ({
					label: `「${x.text.replace("\n", "")}」`,
					sub: `${DUNGEON_NAMES[x.board].short}・${x.why}`,
					value: x.id,
				})),
			);
			const x = list.find((r) => r.id === id);
			if (x) await readScrapScript(s, x);
		}
	};

/** 口の 立て札。 */
const exitSignScript: Script = async (s) => {
	const p = loadProgress();
	const open = DUNGEON_IDS.filter((d) => p.unlocked.includes(d));
	await s.narrate(
		`「植民地へ　つづく　道」\n行ける　板：${open.length}　持ち帰った　板：${p.cleared.length}`,
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
	await s.say(who, talkLine(who, o));
};

/**
 * 仲間の 話しかけ（ひとこと だけ）。役目は 人に 結びつけず 物に 置く：倉庫の 一覧は 倉庫の 中の 棚、
 * 常識堂の 奥・倉庫へは 台の 横の 扉から（店番の ロゼ・シヨは 話すだけ）。帳簿・図鑑・あそびかたは 本館の 物。
 */
const friendScript =
	(who: Speaker): Script =>
	(s) =>
		speak(s, who);

/** 蓄音機（まだ 何も → パン板 → 風呂板 → 電池板 の レスを 鳴らす）。そのあと 村の 曲を えらべる（ui/villageMusic.ts）。 */
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
		return npc(p.id, p.x, p.y, CAST[who].walk, friendScript(who), {
			who,
			dir: p.dir,
			wander: p.wander,
		});
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
		return npc(p.id, p.x, p.y, p.sprite ?? "", mobScript(p.mob), {
			dir: p.dir,
			wander: p.wander,
		});
	}
	if (p.id.startsWith("board_")) return sign(p.id, p.x, p.y, boardScript(ctx));
	if (p.id === "phono") return sign(p.id, p.x, p.y, phonoScript(ctx), p.sprite);
	if (p.id === "well") return sign(p.id, p.x, p.y, wellScript(ctx));
	if (p.id === "hoshu_sign") return sign(p.id, p.x, p.y, HOSHU_SIGN);
	if (p.id === "shrine") return sign(p.id, p.x, p.y, shrineScript);
	// 小屋・銭湯・倉庫・常識堂の 勝手口・喫茶の 扉（踏むと 中へ。前で A でも。ui/rooms.ts・ui/cafe.ts）
	// 音楽室「ピアノ機能」の 扉（週末だけ 中へ。ui/rooms.ts）
	if (p.id === "door_music")
		return { ...at, trigger: "touch", through: true, run: enterMusic };
	if (p.id === "door_bath")
		return { ...at, trigger: "touch", through: true, run: enterRoom("bath") };
	if (p.id === "door_hut")
		return { ...at, trigger: "touch", through: true, run: enterRoom("hut") };
	if (p.id === "door_store")
		return { ...at, trigger: "touch", through: true, run: enterRoom("store") };
	if (p.id === "door_shop")
		return { ...at, trigger: "touch", through: true, run: enterRoom("shop") };
	// 本屋（段3〜5）→ 図書館（段6 から。同じ 扉）
	if (p.id === "door_books")
		return {
			...at,
			trigger: "touch",
			through: true,
			run: enterRoom(v.stage >= LIBRARY_FROM ? "library" : "bookstore"),
		};
	// 町が 育つと 建つ 施設の 扉と 外の 物（data/village/facilities.ts・ui/facilities.ts）
	if (p.id.startsWith("door_f_")) {
		const f = facilityOfDoor(p.id);
		if (f)
			return { ...at, trigger: "touch", through: true, run: enterFacility(f) };
	}
	if (p.id.startsWith("fthing_")) {
		const got = outdoorThingOf(p.id);
		const t = got?.t;
		// バス停：ここからも 出かけられる（村の 口と 同じ 流れ。出口を 遠く しない）
		if (t?.play === "bus")
			return sign(p.id, p.x, p.y, async (s) => {
				for (const l of t.lines) await s.narrate(l);
				await mouthScript(ctx, null)(s);
			});
		// 屋台の 店番：見える 人（話すと こちらを 向く。台ごしに 話す）
		if (got && t?.sprite)
			return npc(p.id, p.x, p.y, t.sprite, outdoorScript(ctx, got.f, t), {
				dir: t.dir,
			});
		if (got && t) return sign(p.id, p.x, p.y, outdoorScript(ctx, got.f, t));
	}
	if (p.id === "door_cafe")
		return {
			...at,
			trigger: "touch",
			through: true,
			run: enterCafe,
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
	return { ...at, sprite: p.sprite, trigger: p.trigger };
};

/**
 * 村の窓で あずける物を えらぶ（一覧は ui/home.ts。のこりを 売るかは ロゼが 村の窓で きく。
 * 「いいえ」から：押しすぎて 売ってしまわないように）。
 */
const storeChooser =
	(ctx: Ctx): StoreChooser =>
	(s, t, pend) =>
		chooseStored(ctx, t, pend, {
			prompt: "あずける　ものを　えらぶ",
			confirmSell: async () => {
				await s.say(TOWN_MSG.sellRest.who, TOWN_MSG.sellRest.text);
				const yes =
					(await s.choose(["はい", "いいえ"], { cancel: 1, start: 1 })) === 0;
				await hideMsg(s);
				return yes;
			},
		});

/** その 板を 持ち帰ると 越してくる 住人（data/mobs.ts の after。いなければ 原住民の 絵を 予備に）。 */
const newcomerFor = (d: DungeonId | undefined): MobId =>
	MOB_IDS.find((id) => d && MOBS[id].after === d) ?? "shobon";

/** 場面の ある 帰り方（持ち帰った・帰還スレ）なら その形。 */
const returnOf = (a: Arrival): ReturnArrival | null =>
	a && (a.kind === "clear" || a.kind === "escape")
		? { kind: a.kind, dungeon: a.dungeon, objective: a.objective }
		: null;

/**
 * 帰ってきたとき（村に入るたび。ui/villageReturn.ts）。持ち帰った・帰還スレなら 口から 出て 仲間の 語り、
 * それから 開いた知らせと 持ち帰った物の 倉庫・売り（どちらも 保存から。決める前に 閉じていても ここで 続きから）。
 */
const arrivalScript =
	(ctx: Ctx, arrival: Arrival): Script =>
	async (s) => {
		if (arrival?.kind === "replay") return;
		const back = returnOf(arrival);
		// 裏の 2段目（STORY.md §5.98）：避難J・1901年の スレの 結を 見た「次の 帰り」に 1回だけ の 場面。
		// この 帰りの 語りで はじめて 結を 見た ときは 数えないので、returnScene（noteEnding）より 前に 決める
		const seen = loadProgress().endings ?? [];
		const dove = !!back || arrival?.kind === "dead";
		const wrapDue = dove && seen.includes("hinan") && !hasFlag("wrap");
		const kusaDue = dove && seen.includes("y1901") && !hasFlag("kusa");
		if (back)
			await returnScene(s, back, {
				getter: async () => {
					await hideMsg(s);
					return playGetter(ctx);
				},
			});
		// たおれて もどった：蓄音機の 前で 目を さまし、仲間が 歩いてくる
		if (arrival?.kind === "dead" && previewStage() === null)
			await deathScene(s);
		// 持ち帰りの 曲（ending）のまま 入ったときも ここからは 村の曲
		s.bgm(villageSong());
		// 段の 下見（?stage=N）では 知らせも 精算も しない（保存を 書きかえない）
		if (previewStage() !== null) return;
		// はじめての 村：前口上と、どこへ 行けば いいか
		if (!arrival && needsOpening()) await openingScript(s);
		await newsScript(s);
		// 転（時計が もどる）と 結の あとの「草」
		if (wrapDue) await wrapScript(s);
		if (kusaDue) await kusaScript(s);
		// セーブを 書きかえたのが 見つかっていれば、仲間が 気づく（engine/tamper.ts）
		await tamperScript(s);
		await settleScript(s, storeChooser(ctx));
		await sendBack(s);
		// 持ち物が からっぽなら ぷゆゆが お弁当を 持たせに くる
		await lunchScript(s);
	};

/** 村の マップ（町の段・開いたダンジョンから）。 */
export const buildVillage = (
	v: VillageView,
	ctx: Ctx,
	opt: { arrival?: Arrival } = {},
): MapDef => {
	const arrival = opt.arrival ?? null;
	// はじめての 持ち帰りの 語りの あいだは、その 板を まだ 持ち帰って いない 村（やきうが 出ていく 語りでも 村に いる）
	const back = returnOf(arrival);
	const view = back ? sceneView(v, back) : v;
	const rows = villageRows(view);
	return {
		id: "village",
		name: `${TOWN_NAME}　${STAGE_NAMES[v.stage] ?? ""}`,
		bgm: villageSong(),
		tiles: villagePalette(view),
		rows,
		// 銭湯の 煙突から 湯気・施設の 建物の 影（ui/facilities.ts）
		decor: joinDecor(shadowDecor(view.stage), chimneySteam(rows)),
		outside: "#1f2a14",
		events: [
			...villagePlaces(view).map((p) => eventFor(ctx, p, view)),
			// 寄り道の 板が 開く ときの 来客（旗 visitor の あいだだけ 村に いる。ui/villageReturn.ts の visitScript）
			npc("visitor", 1, 1, VISITOR_WALK, async () => {}, {
				when: (st) => !!st.flags.visitor,
			}),
			// 持ち帰りの 語りの 中で 越してくる 住人（旗 NEWCOMER の あいだだけ。絵は その 板で 来る 子の 歩行グラ。
			// ui/villageReturn.ts の walkInMob）
			npc(
				NEWCOMER,
				1,
				1,
				MOBS[newcomerFor(back?.dungeon)].sprite,
				async () => {},
				{ when: (st) => !!st.flags[NEWCOMER] },
			),
			// 跡地の 結：口から 来て はじめて 書きこむ ROM専 18体（旗 ROMS の あいだだけ。ui/villageReturn.ts の cue roms）
			...Array.from({ length: ROM_COUNT }, (_, i) =>
				npc(`${ROMS}_${i}`, 1, 1, MONSTERS.funamushi.sprite, async () => {}, {
					when: (st) => !!st.flags[ROMS],
				}),
			),
		],
		// 帰ってきた場面は 幕が 上がる前に 仲間を 口の前に 並べておく
		prepare: (s) => {
			if (back) lineUp(s, back, view);
			// いちばん最初は 南の 道の はしから 歩いてくる（ui/villageOpening.ts）
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
		const stage = loadTown().stage;
		const items: ListItem[] = [
			{ label: "持ち物", value: "bag" },
			// これまでの あらすじ（パン板を 持ち帰ってから。ダンジョンの メニューと 同じ：data/synopsis.ts）
			...(synopsisNow() ? [{ label: "あらすじ", value: "synopsis" }] : []),
			{ label: "せってい", value: "settings" },
		];
		const v = await listWindow(
			ctx,
			`${TOWN_NAME}　${STAGE_NAMES[stage] ?? ""}`,
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
