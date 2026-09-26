// 村（保守村）の イベントの スクリプトと、B／☰ の 村の メニュー。
// 地図の形と 人・物の 置き場所は data/village/map.ts（DOM を使わない）。ここで id ごとに スクリプトを付ける。
//
// - ダンジョンの口：踏むと 中断した冒険の 確認 → もぐる？ → （本編なら）倉庫からの 持ちこみ →
//   はじめてなら 語り → 村を出る。やめたら 1歩 もどる。
// - 立て札：ダンジョンの 名前・階の数・持ち帰ったら ★・説明（開いていなければ 開き方）。口でも 同じ 札を 読む。
// - 仲間：1回の 帰りに 1人 1つ、前の冒険への 新しい ひとこと（頭の上に「！」）。聞いたら 町の様子の
//   決まった ひとこと（ui/villageTalk.ts）。そのあと 役目（レイ＝冒険の記録と 売り上げの 帳簿、
//   フェリス＝図鑑・あそびかた、テト＝倉庫、おんJ民＝本編が 開くまで 口の 見張り、ロゼ＝屋台・店）。
//   どの役目も B／☰ の メニューにも ある（人を さがさなくても 使える）。
// - 小屋の扉・板で ふさいだ口・掲示板・蓄音機は 調べると 地の文。段7 は 野次馬も 話す。
// - 開発用の 段の 下見（?stage=N）は 描く段だけ かえる（ui/villageReturn.ts の previewStage）。
// - 帰ってきたとき（prepare・onEnter）：口の前に 仲間が 並んで むかえる → 開いた知らせ → 持ち帰った物の
//   倉庫・売り → 町が 育つ（場面は ui/villageReturn.ts。あずける 一覧だけ ui/home.ts）。

import { DUNGEONS } from "../core/data/dungeons";
import { CARRY_DUNGEON, CARRY_MAX, STORAGE_CAP } from "../core/town";
import type { DungeonId, Item } from "../core/types";
import { CAST } from "../data/cast";
import type { Speaker } from "../data/quotes";
import { DUNGEON_NAMES, STORY } from "../data/story";
import { STAGE_NAMES, TOWN_MSG, TOWN_NAME, VILLAGE_MSG } from "../data/town";
import { npc, sign } from "../data/village/helpers";
import {
	type VillagePlace,
	type VillageView,
	villagePalette,
	villagePlaces,
	villageRows,
} from "../data/village/map";
import type { EventDef, MapDef, Script, Story } from "../engine/defs";
import {
	addRecord,
	clearRun,
	hasRunSave,
	loadProgress,
	loadRun,
	loadTown,
	notePicked,
	noteRunEnd,
	recordFromRun,
} from "../engine/save";
import { openBook } from "./bookView";
import { runSaveLabel } from "./boot";
import type { Ctx } from "./ctx";
import { chooseStored, openStorage, pickCarry } from "./home";
import { openHowto } from "./howto";
import { type ListItem, listWindow } from "./list";
import { escBr, openRecords, showStory } from "./records";
import { openSettings } from "./settings";
import type { Arrival } from "./village";
import {
	lineUp,
	newsScript,
	previewStage,
	type ReturnArrival,
	returnScene,
	type StoreChooser,
	settleScript,
} from "./villageReturn";
import {
	DUNGEON_DESC,
	hasNews,
	ledgerLine,
	lockedHint,
	talkLine,
} from "./villageTalk";

/** まだ開いていないダンジョンの 開き方（1行目 持ち帰り、2行目 たおれた回数の 救い）。 */
const hintText = (d: DungeonId): string => lockedHint(d).replace("（", "\n（");

/** 開いた ダンジョンの 札（名前・階の数・持ち帰ったら ★、2行目に 説明）。口と 立て札で 読む。 */
const signText = (d: DungeonId): string =>
	`「${DUNGEON_NAMES[d].name}」　B${DUNGEONS[d].floors}${loadProgress().cleared.includes(d) ? "　★" : ""}\n${DUNGEON_DESC[d]}`;

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

/** ダンジョンの口。踏むと もぐるか きく（やめたら 1歩 もどる）。 */
const mouthScript =
	(ctx: Ctx, d: DungeonId): Script =>
	async (s) => {
		const back = () => s.move("player", "d");
		if (!loadProgress().unlocked.includes(d)) {
			await s.narrate(hintText(d));
			await back();
			return;
		}
		// 中断した冒険が あれば 先に きく（つづきから・すてて はじめから・やめる）
		if (hasRunSave()) {
			await s.narrate(`${VILLAGE_MSG.suspended}\n${runSaveLabel(loadRun())}`);
			const n = await s.choose(["つづきから", "すてて　はじめから", "やめる"], {
				cancel: 2,
			});
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
		await s.narrate(signText(d));
		if ((await s.choose(["もぐる", "やめる"], { cancel: 1 })) !== 0) {
			await back();
			return;
		}
		// 過去ログの底 には 倉庫から 持っていける（町の段に応じて 1〜4個）。取り出すのは main.ts
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
			// ちょっと・もっと へは 持ち出せない（村に いるあいだ 1回だけ 言う）
			s.set("carryNotHere");
			await s.say(TOWN_MSG.carryNotHere.who, TOWN_MSG.carryNotHere.text);
		}
		notePicked(d, false);
		s.se("stairs");
		// そのダンジョンに はじめて もぐるなら 語りを見せる（見終わってから 覚える。途中で閉じたら 次も はじめから）
		if (!loadProgress().intro.includes(d)) {
			void ctx.audio.fadeBgm(500);
			await s.fadeOut(500);
			await showStory(ctx, STORY[d].intro.map(escBr));
			notePicked(d, true);
		}
		s.exit({ kind: "new", dungeon: d, carry });
	};

/** 口の 立て札。 */
const signScript =
	(d: DungeonId): Script =>
	async (s) => {
		if (!loadProgress().unlocked.includes(d)) {
			// 名前は まだ 読めない。開き方だけ（救いが あれば 次の ページ）
			const [cond, relief] = hintText(d).split("\n");
			await s.narrate(`「？？？」\n${cond}`);
			if (relief) await s.narrate(relief);
			return;
		}
		await s.narrate(signText(d));
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
		case "rei":
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
		case "teto":
			// 倉庫番（倉庫が 建ってから）
			return async (s) => {
				await speak(s, who);
				if ((STORAGE_CAP[loadTown().stage] ?? 0) <= 0) return;
				const n = await s.choose(["倉庫を　見る", "やめる"], { cancel: 1 });
				if (n !== 0) return;
				await hideMsg(s);
				await openStorage(ctx);
			};
		case "nanj":
			// 本編が 開くまでは 口の前で 見張っている（開いたら 小屋の前で 大工）
			return async (s) => {
				const gate = !loadProgress().unlocked.includes("main");
				await speak(s, who, { gate });
				if (gate) await s.narrate(hintText("main"));
			};
		default:
			// ロゼ（屋台・店）
			return (s) => speak(s, who);
	}
};

/** 蓄音機（針が 無い → ある → 原盤を 持ち帰った）。 */
const phonoScript: Script = async (s) => {
	const p = loadProgress();
	const i = p.cleared.includes("main")
		? 2
		: p.cleared.includes("shallow")
			? 1
			: 0;
	await s.narrate(VILLAGE_MSG.phono[i]);
};

/** 置き場所に スクリプトを付けて イベントにする。 */
const eventFor = (ctx: Ctx, p: VillagePlace): EventDef => {
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
	if (p.dungeon && p.trigger === "touch")
		return {
			...at,
			trigger: "touch",
			through: true,
			run: mouthScript(ctx, p.dungeon),
		};
	if (p.dungeon && p.id.startsWith("boarded_")) {
		const d = p.dungeon;
		return sign(p.id, p.x, p.y, async (s) => {
			await s.narrate(VILLAGE_MSG.boarded);
			await s.narrate(hintText(d));
		});
	}
	if (p.dungeon) return sign(p.id, p.x, p.y, signScript(p.dungeon));
	if (p.id.startsWith("board_"))
		return sign(p.id, p.x, p.y, async (s) => {
			await s.narrate(VILLAGE_MSG.board);
			await records(ctx, s);
		});
	if (p.id === "phono") return sign(p.id, p.x, p.y, phonoScript, p.sprite);
	if (p.id === "door_hut") return sign(p.id, p.x, p.y, VILLAGE_MSG.hutDoor);
	if (p.id.startsWith("yaji_") && p.sprite) {
		// 祭りの 野次馬（J民。名前欄は おんJ民の 色で「野次馬」）
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
	if (p.id === "tousuko")
		return {
			...at,
			sprite: p.sprite,
			dir: p.dir,
			trigger: "talk",
			wander: p.wander,
			run: async (s) => {
				await s.narrate(VILLAGE_MSG.tousuko);
			},
		};
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
		? { kind: a.kind, dungeon: a.dungeon }
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
		// 持ち帰りの 曲（ending）のまま 入ったときも ここからは 村の曲
		s.bgm("town");
		// 段の 下見（?stage=N）では 知らせも 精算も しない（保存を 書きかえない）
		if (previewStage() !== null) return;
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
		events: villagePlaces(v).map((p) => eventFor(ctx, p)),
		// 帰ってきた場面は 幕が 上がる前に 仲間を 口の前に 並べておく
		prepare: (s) => {
			const back = returnOf(arrival);
			if (back) lineUp(s, back, v);
		},
		onEnter: arrivalScript(ctx, arrival),
	};
};

/** B／☰ の 村の メニュー（仲間の 役目を ぜんぶ ここからも）。とじるまで 何度でも。 */
export const villageMenu = async (ctx: Ctx, s: Story): Promise<void> => {
	let start = 0;
	for (;;) {
		const stage = loadTown().stage;
		const items: ListItem[] = [
			{ label: "冒険の記録", value: "records" },
			{ label: "図鑑", value: "book" },
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
		else if (v === "storage") await openStorage(ctx);
		else if (v === "howto") await openHowto(ctx);
		else if (v === "settings") await openSettings(ctx);
	}
};
