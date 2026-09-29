// 村（保守村）の イベントの スクリプトと、B／☰ の 村の メニュー。
// 地図の形と 人・物の 置き場所は data/village/map.ts（DOM を使わない）。ここで id ごとに スクリプトを付ける。
//
// - ダンジョンの口：踏むと 中断した冒険の 確認 → もぐる？ → （本編なら）倉庫からの 持ちこみ →
//   はじめてなら 語り → 村を出る。やめたら 1歩 もどる。板ごとの 目的（持ち帰り・ボス。期間限定の
//   イベントも。data/objectives.ts）は 行き先を 選ぶ 前に 1回だけ 決めて、地図と 冒険に 同じ 値を 渡す。
// - 立て札：ダンジョンの 名前・階の数・持ち帰ったら ★・説明（開いていなければ 開き方）。口でも 同じ 札を 読む。
// - 仲間：1回の 帰りに 1人 1つ、前の冒険への 新しい ひとこと（頭の上に「！」）。聞いたら 町の様子の
//   決まった ひとこと（ui/villageTalk.ts）。そのあと 役目（ゼロ＝冒険の記録と 売り上げの 帳簿、
//   フェリス＝図鑑・あそびかた、シヨ＝倉庫、やきう＝本編が 開くまで 口の 見張り、ロゼ＝屋台・店）。
//   どの役目も B／☰ の メニューにも ある（人を さがさなくても 使える）。
// - 板で ふさいだ口・掲示板・蓄音機は 調べると 地の文。段7 は 野次馬も 話す。
// - 喫茶・小屋の 扉は 踏むと 中へ（ui/cafe.ts・ui/rooms.ts）。常識堂の 奥・倉庫は ロゼ・シヨが 入れてくれる。
// - おんJ 本館の 扉（2マス）は 踏むと（前で A でも）中の 地図へ（ui/hallEvents.ts）。右の 扉に 新しい 告知・棚の「！」。
// - おんJマイナーズ（町が 育つと 越してくる）と ぷゆゆ（はじめから いる）は ui/villageMobs.ts。2人に 会うと 掲示板に 総選挙の はり紙。
// - 開発用の 段の 下見（?stage=N）は 描く段だけ かえる（ui/villageReturn.ts の previewStage）。
// - 帰ってきたとき（prepare・onEnter）：口の前に 仲間が 並んで むかえる → 開いた知らせ → 持ち帰った物の
//   倉庫・売り → 町が 育つ（場面は ui/villageReturn.ts。あずける 一覧だけ ui/home.ts）。
// - いちばん最初（一度も もぐっていない）は 前口上と 行き先の 場面（ui/villageOpening.ts）。

import { DUNGEON_IDS, DUNGEONS } from "../core/data/dungeons";
import { LAST_RES } from "../core/data/lastRes";
import { CARRY_DUNGEON, CARRY_MAX, STORAGE_CAP } from "../core/town";
import type { DungeonId, Item } from "../core/types";
import { CAST } from "../data/cast";
import { BOARD_MENU } from "../data/mobs";
import {
	type ObjectiveInfo,
	objectiveFor,
	withDevEvent,
} from "../data/objectives";
import type { Speaker } from "../data/quotes";
import { SHOP_MENU, STORE_MENU } from "../data/rooms";
import {
	awayFriends,
	DEPART,
	DUNGEON_NAMES,
	HOSHU_SIGN,
	STORY,
} from "../data/story";
import { STAGE_NAMES, TOWN_MSG, TOWN_NAME, VILLAGE_MSG } from "../data/town";
import { npc, sign } from "../data/village/helpers";
import {
	type VillagePlace,
	type VillageView,
	villagePalette,
	villagePlaces,
	villageRows,
} from "../data/village/map";
import { ROOM_FROM } from "../data/village/rooms";
import type { EventDef, MapDef, Script, Story } from "../engine/defs";
import {
	addRecord,
	clearRun,
	hasRunSave,
	loadLastRes,
	loadProgress,
	loadRun,
	loadTown,
	notePicked,
	noteRunEnd,
	recordFromRun,
} from "../engine/save";
import { openBook } from "./bookView";
import { runSaveLabel } from "./boot";
import { enterCafe, hasCafeNews } from "./cafe";
import type { Ctx } from "./ctx";
import { enterHall, hasHallNews } from "./hallEvents";
import { chooseStored, openStorage, pickCarry } from "./home";
import { openHowto } from "./howto";
import { type ListItem, listWindow } from "./list";
import { escBr, openRecords, showStory } from "./records";
import { enterMusic, enterRoom, keeperLets } from "./rooms";
import { openSettings } from "./settings";
import type { Arrival } from "./village";
import { hasMobNews, mobScript, senkyoOpen, senkyoScript } from "./villageMobs";
import { needsOpening, openingScript } from "./villageOpening";
import {
	deathScene,
	lineUp,
	newsScript,
	previewStage,
	type ReturnArrival,
	returnScene,
	type StoreChooser,
	settleScript,
} from "./villageReturn";
import { DUNGEON_DESC, hasNews, ledgerLine, talkLine } from "./villageTalk";
import { pickColony, travelTo } from "./worldMap";

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

/** 冒険の記録を見る。リプレイを選んだら 村を出る（出るなら true）。 */
const records = async (ctx: Ctx, s: Story): Promise<boolean> => {
	await hideMsg(s);
	const replay = await openRecords(ctx);
	if (!replay) return false;
	s.exit({ kind: "replay", replay });
	return true;
};

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

/** 村の 出口。踏むと 全体マップで 行き先を 選んで もぐるか きく（やめたら 1歩 もどる）。 */
const mouthScript =
	(ctx: Ctx, step = "d"): Script =>
	async (s) => {
		// 行き先（はじめは 前に 行った 板。無ければ パン板。全体マップで ほかの 板も 選べる）
		const last = loadProgress().last;
		let d: DungeonId =
			last && loadProgress().unlocked.includes(last) ? last : "shallow";
		const back = () => s.move("player", step);
		// 中断した冒険が あれば 先に きく（冒険に　もどる・すてて　新しく　もぐる・やめる）
		if (hasRunSave()) {
			await s.narrate(`${VILLAGE_MSG.suspended}\n${runSaveLabel(loadRun())}`);
			const n = await s.choose(
				["冒険に　もどる", "すてて　新しく　もぐる", "やめる"],
				{
					cancel: 2,
				},
			);
			if (n === 2) {
				await back();
				return;
			}
			if (n === 0) {
				// いつも読み直す（別タブの 古い写しから 始めないように）
				const state = loadRun();
				if (state) {
					s.se("stairs");
					s.exit({ kind: "continue", state });
					return;
				}
				clearRun();
				await s.narrate(VILLAGE_MSG.broken);
			} else {
				abandonRun();
				// すてたので 次のダンジョンが開いたなら（救い）、ここで知らせる
				await newsScript(s);
			}
		}
		// 行き先の 植民地（全体マップで 選ぶ。ui/worldMap.ts）
		const open = DUNGEON_IDS.filter((x) => loadProgress().unlocked.includes(x));
		const cleared = loadProgress().cleared;
		// 板ごとの 目的（期間限定の イベントも）は ここで 1回だけ 決める。地図に 出す 目的と
		// Run.create に 渡す 目的を 同じに する（歩いている あいだに イベントが かわっても ずれない）
		const prog = withDevEvent(loadProgress());
		const goals = Object.fromEntries(
			DUNGEON_IDS.map((x) => [x, objectiveFor(x, prog)]),
		) as Record<DungeonId, ObjectiveInfo>;
		await hideMsg(s);
		const picked = await pickColony(ctx, { open, cleared, start: d, goals });
		if (!picked) {
			await back();
			return;
		}
		d = picked;
		// 風呂板 には 倉庫から 持っていける（町の段に応じて 1〜4個）。取り出すのは main.ts
		const town = loadTown();
		let carry: Item[] = [];
		if (d === CARRY_DUNGEON && (CARRY_MAX[town.stage] ?? 0) > 0) {
			if (town.storage.length) {
				await hideMsg(s);
				const picked = await pickCarry(ctx, CARRY_MAX[town.stage] ?? 0);
				if (!picked) {
					await back();
					return;
				}
				carry = picked;
				const l = carry.length ? TOWN_MSG.carryDone : TOWN_MSG.carryNone;
				await s.say(l.who, l.text);
			}
		} else if (
			d !== CARRY_DUNGEON &&
			town.storage.length &&
			!s.flag("carryNotHere")
		) {
			// ほかの 植民地へは 持ち出せない（村に いるあいだ 1回だけ 言う）
			s.set("carryNotHere");
			await s.say(TOWN_MSG.carryNotHere.who, TOWN_MSG.carryNotHere.text);
		}
		// 潜る ときの 一言（やきう。出ていった あとは キリコの 独白。STORY.md §5.9）
		if (awayFriends(loadProgress().cleared).includes("nanj"))
			await s.kiriko(DEPART.kiriko, "think");
		else await s.say("nanj", DEPART.nanj);
		// 前に 行ったことが あれば 速く 歩く（語りを 見た＝行った）
		const been = loadProgress().intro.includes(d);
		notePicked(d, false);
		// 全体マップの 上を 行き先まで 歩く（着くと 建物の 札）
		await hideMsg(s);
		await travelTo(ctx, d, { open, cleared, fast: been });
		// そのダンジョンに はじめて もぐるなら 語りを見せる（見終わってから 覚える。途中で閉じたら 次も はじめから）
		if (!loadProgress().intro.includes(d)) {
			void ctx.audio.fadeBgm(500);
			await s.fadeOut(500);
			await showStory(ctx, STORY[d].intro.map(escBr));
			notePicked(d, true);
		}
		s.exit({ kind: "new", dungeon: d, carry, objective: goals[d].objective });
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

/** 仲間ごとの 話しかけ（ひとこと ＋ 役目）。役目は どれも B／☰ の メニューにも ある。 */
const friendScript = (ctx: Ctx, who: Speaker): Script => {
	switch (who) {
		case "zero":
			// 帳簿の係：冒険の記録（リプレイも）と 売り上げ
			return async (s) => {
				await speak(s, who);
				const n = await s.choose(["冒険の記録", "売り上げ", "やめる"], {
					cancel: 2,
				});
				if (n === 0) await records(ctx, s);
				else if (n === 1) await s.say(who, ledgerLine());
			};
		case "feris":
			// 看板の係：図鑑（目が いいから）・あそびかた
			return async (s) => {
				await speak(s, who);
				const n = await s.choose(["図鑑", "あそびかた", "やめる"], {
					cancel: 2,
				});
				if (n === 2) return;
				await hideMsg(s);
				await (n === 0 ? openBook(ctx) : openHowto(ctx));
			};
		case "shiyo":
			// 倉庫番（倉庫が 建ってから）
			return async (s) => {
				await speak(s, who);
				if ((STORAGE_CAP[loadTown().stage] ?? 0) <= 0) return;
				// 倉庫が 建ったら 中にも 入れる（台の うしろの 扉から。ui/rooms.ts）
				const n = await s.choose([...STORE_MENU], { cancel: 2 });
				if (n === 1) await keeperLets(s, who, "store");
				if (n !== 0) return;
				await hideMsg(s);
				await openStorage(ctx);
			};
		case "nanj":
			// 小屋の前で 大工
			return (s) => speak(s, who);
		default:
			// ロゼ（屋台・店）。小さな 店に なったら 奥へ 入れてくれる（ui/rooms.ts）
			return async (s) => {
				await speak(s, who);
				if (loadTown().stage < ROOM_FROM.shop) return;
				const n = await s.choose([...SHOP_MENU], { cancel: 1 });
				if (n === 0) await keeperLets(s, "roze", "shop");
			};
	}
};

/** 蓄音機（まだ 何も → パン板 → 風呂板 → 過去ログの底 の レスを 鳴らす）。 */
const phonoScript: Script = async (s) => {
	const p = loadProgress();
	const i = p.cleared.includes("hidden")
		? 3
		: p.cleared.includes("main")
			? 2
			: p.cleared.includes("shallow")
				? 1
				: 0;
	await s.narrate(VILLAGE_MSG.phono[i]);
};

/** 置き場所に スクリプトを付けて イベントにする（v は 描いている 村。本館の 段を 絵と 合わせる）。 */
const eventFor = (ctx: Ctx, p: VillagePlace, v: VillageView): EventDef => {
	const at = { id: p.id, x: p.x, y: p.y };
	if (p.who) {
		const who = p.who;
		return {
			...npc(p.id, p.x, p.y, CAST[who].walk, friendScript(ctx, who), {
				who,
				dir: p.dir,
				wander: p.wander,
			}),
			notice: () => hasNews(who),
		};
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
		const id = p.mob;
		return {
			...npc(p.id, p.x, p.y, p.sprite ?? "", mobScript(id), {
				dir: p.dir,
				wander: p.wander,
			}),
			notice: () => hasMobNews(id),
		};
	}
	if (p.id.startsWith("board_"))
		return sign(p.id, p.x, p.y, async (s) => {
			await s.narrate(VILLAGE_MSG.board);
			// 総選挙の はり紙が 出たら どちらを 読むか きく
			if (senkyoOpen()) {
				const n = await s.choose([...BOARD_MENU], { cancel: 2 });
				if (n === 1) await senkyoScript(s);
				if (n !== 0) return;
			}
			await records(ctx, s);
		});
	if (p.id === "phono") return sign(p.id, p.x, p.y, phonoScript, p.sprite);
	if (p.id === "hoshu_sign") return sign(p.id, p.x, p.y, HOSHU_SIGN);
	// 小屋・喫茶の 扉（踏むと 中へ。前で A でも。ui/rooms.ts・ui/cafe.ts）
	// 音楽室「ピアノ機能」の 扉（週末だけ 中へ。ui/rooms.ts）
	if (p.id === "door_music")
		return { ...at, trigger: "touch", through: true, run: enterMusic };
	if (p.id === "door_hut")
		return { ...at, trigger: "touch", through: true, run: enterRoom("hut") };
	if (p.id === "door_cafe")
		return {
			...at,
			trigger: "touch",
			through: true,
			run: enterCafe,
			notice: hasCafeNews,
		};
	if (p.id.startsWith("door_hall_")) {
		const i = Number(p.id.slice("door_hall_".length));
		return {
			...at,
			trigger: "touch",
			through: true,
			run: enterHall(i, v),
			notice: i === 1 ? () => hasHallNews(v) : undefined,
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
		if (back) await returnScene(s, back);
		// たおれて もどった：蓄音機の 前で 目を さまし、仲間が 歩いてくる
		if (arrival?.kind === "dead" && previewStage() === null)
			await deathScene(s);
		// 持ち帰りの 曲（ending）のまま 入ったときも ここからは 村の曲
		s.bgm("town");
		// 段の 下見（?stage=N）では 知らせも 精算も しない（保存を 書きかえない）
		if (previewStage() !== null) return;
		// はじめての 村：前口上と、どこへ 行けば いいか
		if (!arrival && needsOpening()) await openingScript(s);
		await newsScript(s);
		await settleScript(s, storeChooser(ctx));
	};

/** 村の マップ（町の段・開いたダンジョンから）。 */
export const buildVillage = (
	v: VillageView,
	ctx: Ctx,
	opt: { arrival?: Arrival } = {},
): MapDef => {
	const arrival = opt.arrival ?? null;
	return {
		id: "village",
		name: `${TOWN_NAME}　${STAGE_NAMES[v.stage] ?? ""}`,
		bgm: "town",
		tiles: villagePalette(v),
		rows: villageRows(v),
		outside: "#1f2a14",
		events: villagePlaces(v).map((p) => eventFor(ctx, p, v)),
		// 帰ってきた場面は 幕が 上がる前に 仲間を 口の前に 並べておく
		prepare: (s) => {
			const back = returnOf(arrival);
			if (back) lineUp(s, back, v);
		},
		onEnter: arrivalScript(ctx, arrival),
	};
};

/**
 * 拾った「最後の レス」の 一覧（植民地で 拾った、去った 人の 最後の 書きこみ。core/data/lastRes.ts）。
 * まだ 拾っていない ものは 場所だけ（？？？）。選ぶと その レスを 窓で 読む。
 */
const openLastRes = async (ctx: Ctx, s: Story): Promise<void> => {
	const have = loadLastRes();
	let start = 0;
	for (;;) {
		const rows: ListItem[] = LAST_RES.map((r) => {
			const got = have.includes(r.id);
			return {
				label: `${DUNGEON_NAMES[r.dungeon].short}　${r.depth}階`,
				sub: got ? r.why : "",
				desc: got ? `「${r.text}」` : "？？？",
				value: r.id,
				disabled: !got,
			};
		});
		const n = LAST_RES.filter((r) => have.includes(r.id)).length;
		const v = await listWindow(
			ctx,
			`拾った　最後のレス　${n}／${LAST_RES.length}`,
			rows,
			{ start },
		);
		if (v === null) return;
		start = rows.findIndex((r) => r.value === v);
		const r = LAST_RES.find((x) => x.id === v);
		if (!r) continue;
		await s.narrate(
			`${DUNGEON_NAMES[r.dungeon].short}の　${r.depth}階に\n落ちていた　レス。`,
		);
		await s.narrate(`「${r.text}」`);
		await hideMsg(s);
	}
};

/** B／☰ の 村の メニュー（仲間の 役目を ぜんぶ ここからも）。とじるまで 何度でも。 */
export const villageMenu = async (ctx: Ctx, s: Story): Promise<void> => {
	let start = 0;
	for (;;) {
		const stage = loadTown().stage;
		const items: ListItem[] = [
			{ label: "冒険の記録", value: "records" },
			{ label: "図鑑", value: "book" },
			...(loadLastRes().length
				? [{ label: "拾った　最後のレス", value: "lastres" }]
				: []),
			...((STORAGE_CAP[stage] ?? 0) > 0
				? [{ label: "倉庫", value: "storage" }]
				: []),
			{ label: "あそびかた", value: "howto" },
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
		if (v === "records") {
			// リプレイを 選んだら 村を出る
			if (await records(ctx, s)) return;
		} else if (v === "book") await openBook(ctx);
		else if (v === "lastres") await openLastRes(ctx, s);
		else if (v === "storage") await openStorage(ctx);
		else if (v === "howto") await openHowto(ctx);
		else if (v === "settings") await openSettings(ctx, { wipe: true });
	}
};
