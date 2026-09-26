// 村（保守村）の イベントの スクリプトと、B／☰ の 村の メニュー。
// 地図の形と 人・物の 置き場所は data/village/map.ts（DOM を使わない）。ここで id ごとに スクリプトを付ける。
//
// - ダンジョンの口：踏むと 中断した冒険の 確認 → もぐる？ → （本編なら）倉庫からの 持ちこみ →
//   はじめてなら 語り → 村を出る。やめたら 1歩 もどる。
// - 立て札：ダンジョンの 名前と 説明（開いていなければ 開き方）。
// - 仲間：前の冒険・町の様子の ひとこと（ui/villageTalk.ts）と、役目（レイ＝冒険の記録、フェリス＝図鑑・あそびかた、
//   テト＝倉庫）。どの役目も B／☰ の メニューにも ある（人を さがさなくても 使える）。
// - 帰ってきたとき（onEnter）：洞窟から 1歩 出て、持ち帰った物の 倉庫・売り（home.ts の窓）と 開いた知らせ。
//   村の中の 場面（仲間が 口の前で 話す）は まだ（いまは 前と 同じ 窓で出す）。

import { DUNGEONS } from "../core/data/dungeons";
import { CARRY_DUNGEON, CARRY_MAX, STORAGE_CAP } from "../core/town";
import type { DungeonId, Item } from "../core/types";
import { CAST } from "../data/cast";
import type { Speaker } from "../data/quotes";
import { DUNGEON_NAMES, STORY } from "../data/story";
import { STAGE_NAMES, TOWN_MSG, TOWN_NAME, VILLAGE_MSG } from "../data/town";
import { npc, sign } from "../data/village/helpers";
import {
	VILLAGE_SPOTS,
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
import { openStorage, pickCarry, settleHome } from "./home";
import { openHowto } from "./howto";
import { type ListItem, listWindow } from "./list";
import { escBr, openRecords, showProgressNews, showStory } from "./records";
import { openSettings } from "./settings";
import type { Arrival } from "./village";
import { barkFor, DUNGEON_DESC, lockedHint } from "./villageTalk";

/** いまの 町の段・開いたダンジョン（保存から 読む）。 */
export const villageView = (): VillageView => {
	const p = loadProgress();
	return {
		stage: loadTown().stage,
		unlocked: [...p.unlocked],
		cleared: [...p.cleared],
	};
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

/** 中断した冒険を すてる（やめた、として 記録に残す。タイトルの「もぐる」と同じ）。 */
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
			await s.narrate(lockedHint(d));
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
				// すてたので 次のダンジョンが開いたなら、ここで知らせる
				await hideMsg(s);
				await showProgressNews(ctx);
			}
		}
		const p = loadProgress();
		await s.narrate(
			`「${DUNGEON_NAMES[d].name}」${p.cleared.includes(d) ? "　★" : ""}\n${DUNGEON_DESC[d]}`,
		);
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
		const p = loadProgress();
		if (!p.unlocked.includes(d)) {
			await s.narrate(`「？？？」\n${lockedHint(d)}`);
			return;
		}
		await s.narrate(
			`「${DUNGEON_NAMES[d].name}」　B${DUNGEONS[d].floors}${p.cleared.includes(d) ? "　★" : ""}\n${DUNGEON_DESC[d]}`,
		);
	};

/** 話しかけた回数（ひとことを 回す）。 */
const talked: Partial<Record<Speaker, number>> = {};

/** 仲間の ひとこと（無ければ 何も言わない）。 */
const bark = async (s: Story, who: Speaker): Promise<void> => {
	const n = talked[who] ?? 0;
	talked[who] = n + 1;
	const text = barkFor(who, n);
	if (text) await s.say(who, text);
};

/** 仲間ごとの 話しかけ（ひとこと ＋ 役目）。 */
const friendScript = (ctx: Ctx, who: Speaker): Script => {
	switch (who) {
		case "rei":
			// 帳簿の係：冒険の記録（リプレイも）
			return async (s) => {
				await bark(s, who);
				const n = await s.choose(["冒険の記録", "やめる"], { cancel: 1 });
				if (n === 0) await records(ctx, s);
			};
		case "feris":
			// 看板の係：図鑑（目が いいから）・あそびかた
			return async (s) => {
				await bark(s, who);
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
				await bark(s, who);
				if ((STORAGE_CAP[loadTown().stage] ?? 0) <= 0) return;
				const n = await s.choose(["倉庫を　見る", "やめる"], { cancel: 1 });
				if (n !== 0) return;
				await hideMsg(s);
				await openStorage(ctx);
			};
		case "nanj":
			// 本編が 開くまでは 口の前で 見張っている
			return async (s) => {
				await bark(s, who);
				if (!loadProgress().unlocked.includes("main"))
					await s.narrate(lockedHint("main"));
			};
		default:
			return (s) => bark(s, who);
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
	if (p.who)
		return npc(p.id, p.x, p.y, CAST[p.who].walk, friendScript(ctx, p.who), {
			who: p.who,
			dir: p.dir,
			wander: p.wander,
		});
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
			await s.narrate(lockedHint(d));
		});
	}
	if (p.dungeon) return sign(p.id, p.x, p.y, signScript(p.dungeon));
	if (p.id.startsWith("board_"))
		return sign(p.id, p.x, p.y, async (s) => {
			await s.narrate(VILLAGE_MSG.board);
			await records(ctx, s);
		});
	if (p.id === "phono") return sign(p.id, p.x, p.y, phonoScript, p.sprite);
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
 * 帰ってきたとき（村に入るたび）。洞窟から 1歩 出て、持ち帰った物を 倉庫へ・売る（決める前に
 * 閉じていても ここで 続きから）、開いた知らせ。町が 変わったら 暗転して 建て直す。
 */
const arrivalScript =
	(ctx: Ctx, arrival: Arrival): Script =>
	async (s) => {
		if (arrival?.kind === "replay") return;
		// 口の中に 立っていたら（ui/village.ts の spotFor）1歩 出る
		if (arrival?.kind === "clear" || arrival?.kind === "escape") {
			const [mx, my] = VILLAGE_SPOTS.mouth[arrival.dungeon];
			if (s.state.x === mx && s.state.y === my) await s.move("player", "d");
		}
		const before = JSON.stringify(villageView());
		if (loadTown().pending) {
			await hideMsg(s);
			await settleHome(ctx);
		}
		await showProgressNews(ctx);
		if (JSON.stringify(villageView()) !== before) {
			await s.fadeOut(300);
			await s.rebuild();
			await s.fadeIn(300);
		}
	};

/** 村の マップ（町の段・開いたダンジョンから）。 */
export const buildVillage = (
	v: VillageView,
	ctx: Ctx,
	opt: { arrival?: Arrival } = {},
): MapDef => ({
	id: "village",
	name: `${TOWN_NAME}　${STAGE_NAMES[v.stage] ?? ""}`,
	bgm: "town",
	tiles: villagePalette(v),
	rows: villageRows(v),
	outside: "#1f2a14",
	events: villagePlaces(v).map((p) => eventFor(ctx, p)),
	onEnter: arrivalScript(ctx, opt.arrival ?? null),
});

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
