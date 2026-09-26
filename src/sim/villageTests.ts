// 歩ける村（保守村）の地図の試験（pnpm test で いっしょに動く）。
// Field（canvas を作る）は使わず、地図の文字・パレット・置き場所（data/village/map.ts）だけで調べる。
// - 形（22×18）・知らない文字が 無い・イベントが 地図の中で 1マスに 1つ・踏むイベントは 通れるマス
// - 起きる所（蓄音機の前）から、開いた口の すべてへ 歩いて行けて、人・看板・掲示板の すべてに
//   となり（か カウンター越し）から 話しかけられる（口の中には 立たずに）
// - 本編の口は 開くまで おんJ民が ふさぐ・もっとの口は 開くまで 板で ふさぐ
// - 町の段ごとに 建物が ふえる・売る人は 台の うしろ（囲いの中へは 入れない）・絵は 同梱の Base.png だけ
// - 仲間の ひとこと（ui/villageTalk.ts）：1回の 帰りに 1人 1つ 新しい話（「！」）、聞いたら 決まった ひとこと。
//   ゼロの 帳簿。村の窓で 読む 文（村の 新しい文・口と 立て札・仲間の たまり）は 全角22字・2行まで
//   （localStorage の かわりに 入れものを 置いて 試す）
// - 帰ってきたとき（ui/villageReturn.ts。仮の Story で 試す）：口の前に 仲間が 並んで 語り、開いた知らせ
//   （おんJ民が どく。見せる 前に 閉じたら また 見せる）、倉庫へ・売る（別のタブ・閉じた タブの 守り）・町が 育つ

import { DUNGEON_IDS, DUNGEONS } from "../core/data/dungeons";
import { CARRY_MAX, priceOf, STAGE_POINTS, TOWN_STAGES } from "../core/town";
import type { DungeonId, Item } from "../core/types";
import { SEASONS, season } from "../data/calendar";
import {
	MOB_IDS,
	MOBS,
	type MobCtx,
	type MobId,
	type MobLine,
	SENKYO,
} from "../data/mobs";
import {
	pickQuote,
	type Quote,
	type QuoteContext,
	SPEAKERS,
	type Speaker,
} from "../data/quotes";
import {
	CLEAR,
	DUNGEON_NAMES,
	FIRST_SHALLOW,
	SHALLOW_DEATH,
	STORY,
	UNLOCK_LINES,
} from "../data/story";
import {
	ESCAPE_QUOTES,
	OPENING,
	RETURN_PAGES,
	STAGE_NAMES,
	STAGE_UP,
	TITLE_TOWN_QUOTES,
	TOWN_MSG,
	VILLAGE_IDLE,
	VILLAGE_MSG,
} from "../data/town";
import {
	lineupSpots,
	VILLAGE_H,
	VILLAGE_SPOTS,
	VILLAGE_W,
	type VillagePlace,
	type VillageView,
	villagePalette,
	villagePlaces,
	villageRows,
} from "../data/village/map";
import type { Story, TileDef, VState } from "../engine/defs";
import {
	forgetProgressMemo,
	loadProgress,
	loadRecords,
	loadReplays,
	loadTown,
	type PendingReturn,
	type ProgressNews,
	type RunRecord,
	replayMatches,
	type Town,
} from "../engine/save";
import {
	forgetMobMemo,
	hasMobNews,
	idleOf,
	mobScript,
	reactionOf,
	senkyoOpen,
	senkyoScript,
} from "../ui/villageMobs";
import {
	forgetOpeningMemo,
	needsOpening,
	openingScript,
} from "../ui/villageOpening";
import {
	lineUp,
	newsScript,
	type ReturnArrival,
	returnScene,
	type StoreChooser,
	settleScript,
	villageView,
} from "../ui/villageReturn";
import {
	DUNGEON_DESC,
	fill,
	forgetHeardMemo,
	hasNews,
	ledgerLine,
	lockedHint,
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

/** 地図を 引く道具（通れるか・人が いるか・歩いて行けるか）。 */
const survey = (v: VillageView) => {
	const rows = villageRows(v).map((r) => [...r]);
	const tiles = villagePalette(v);
	const places = villagePlaces(v);
	const tile = (x: number, y: number): TileDef | undefined =>
		rows[y]?.[x] === undefined ? undefined : tiles[rows[y][x]];
	/** 見た目の ある イベント（人・置物）は 通れない。見えない イベントは 通れる。 */
	const occupied = (x: number, y: number) =>
		places.some((p) => p.sprite && p.x === x && p.y === y);
	const canEnter = (x: number, y: number) =>
		!!tile(x, y)?.passable && !occupied(x, y);
	const [bx, by] = VILLAGE_SPOTS.boot;
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
	/** となり（か カウンター越し）の 立てる マスから 話しかけられるか。 */
	const talkable = (p: VillagePlace) =>
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

test("from the boot spot, Kiriko can walk into every open mouth and talk to everyone", () => {
	for (const v of VIEWS) {
		const s = survey(v);
		const [bx, by] = VILLAGE_SPOTS.boot;
		ok(s.canEnter(bx, by), `${label(v)}: the boot spot is blocked`);
		for (const d of v.unlocked) {
			const [mx, my] = VILLAGE_SPOTS.mouth[d];
			ok(s.reachable(mx, my), `${label(v)}: cannot walk into the ${d} mouth`);
			// 帰ってきたとき 口から 1歩 下へ 出られる
			ok(
				s.canEnter(mx, my + 1),
				`${label(v)}: cannot step out of the ${d} mouth`,
			);
		}
		for (const p of s.places)
			if (p.trigger === "talk")
				ok(s.talkable(p), `${label(v)}: cannot talk to ${p.id}`);
	}
});

test("locked mouths stay shut: おんJ民 guards 本編, boards cover もっと", () => {
	for (const v of VIEWS) {
		const s = survey(v);
		for (const d of DUNGEON_IDS) {
			if (v.unlocked.includes(d)) continue;
			const [mx, my] = VILLAGE_SPOTS.mouth[d];
			ok(!s.reachable(mx, my), `${label(v)}: the locked ${d} mouth is open`);
		}
		const [nx, ny] = VILLAGE_SPOTS.nanj(v);
		const guarding = !v.unlocked.includes("main");
		const [mx, my] = VILLAGE_SPOTS.mouth.main;
		ok(
			(nx === mx && ny === my + 1) === guarding,
			`${label(v)}: おんJ民 ${guarding ? "is not" : "still"} in front of 本編`,
		);
		ok(
			s.places.some((p) => p.id === `boarded_deep`) ===
				!v.unlocked.includes("deep"),
			`${label(v)}: the boarded もっと mouth does not match the unlock`,
		);
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

test("ロゼ and シヨ work behind closed counters once the stall and storehouse are built", () => {
	for (const v of VIEWS) {
		const s = survey(v);
		const seller = (who: Speaker, counterFrom: number, closedFrom: number) => {
			const p = s.places.find((x) => x.who === who);
			ok(p, `${label(v)}: ${who} is missing`);
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
	return () => {
		if (prev) Object.defineProperty(globalThis, "localStorage", prev);
		else delete (globalThis as { localStorage?: unknown }).localStorage;
		forgetProgressMemo();
		forgetHeardMemo();
		forgetMobMemo();
		forgetOpeningMemo();
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
		seen: 3,
		flowed: 0,
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
		// 見張りの おんJ民は 見張りの ひとこと
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
			"過疎に　たおされた",
		])
			for (const depth of [2, 9, 18]) {
				pushRecord({ kind: "dead", cause, depth });
				for (const who of FRIENDS)
					ok(hasNews(who), `${who} is silent after "${cause}" at B${depth}`);
			}
	});
});

test("ゼロ reads the ledger: sales so far and the rest to the next stage", () => {
	withStorage(() => {
		setTown(0, 0);
		ok(ledgerLine() === VILLAGE_MSG.ledgerNone, "stage 0 with no sales");
		setTown(2, 500);
		const rest = STAGE_POINTS[3] - 500;
		ok(
			ledgerLine().includes("500レス") && ledgerLine().includes(`${rest}レス`),
			`stage 2: ${ledgerLine()}`,
		);
		setTown(2, STAGE_POINTS[4]);
		ok(
			ledgerLine().includes("つぎに　持ち帰れば"),
			`enough sales but one stage per return: ${ledgerLine()}`,
		);
		setTown(TOWN_STAGES - 1, 99999);
		ok(ledgerLine().includes("いっぱい"), `the top stage: ${ledgerLine()}`);
	});
});

/** 全角=1・半角=0.5 で 数えた 幅。 */
const width = (line: string): number =>
	[...line].reduce((w, ch) => w + (/[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);

/** 村の窓（スマホで 全角22字）に 2行まで で 収まるか。 */
const fitsWindow = (texts: readonly [string, string][]): void => {
	for (const [where, t] of texts) {
		const lines = t.split("\n");
		ok(lines.length <= 2, `${where}: ${lines.length} lines`);
		for (const l of lines)
			ok(width(l) <= 22, `${where}: "${l}" is ${width(l)} wide`);
	}
};

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
	fitsWindow(texts);
});

test("everything the village window reads out fits it (22 full-width × 2 lines)", () => {
	const texts: [string, string][] = [];
	const pool = (where: string, ls: readonly { text: string }[]) =>
		ls.forEach((l, i) => {
			texts.push([`${where}[${i}]`, l.text]);
		});
	for (const d of DUNGEON_IDS) {
		// 口・立て札の 札（ui/villageEvents.ts の signText。★つきが いちばん長い）と、開き方（同じく hintText）
		texts.push([
			`sign ${d}`,
			`「${DUNGEON_NAMES[d].name}」　B${DUNGEONS[d].floors}　★\n${DUNGEON_DESC[d]}`,
		]);
		texts.push([`hint ${d}`, lockedHint(d).replace("（", "\n（")]);
		pool(`CLEAR.${d}`, CLEAR[d]);
		pool(`STORY.${d}.ending`, STORY[d].ending);
	}
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
		"過疎",
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

test("the friends line up beside the mouth Kiriko comes out of", () => {
	for (const v of VIEWS) {
		const s = survey(v);
		for (const d of v.unlocked) {
			const [mx, my] = VILLAGE_SPOTS.mouth[d];
			const spots = lineupSpots(v, d, 5);
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
				ok(
					!(x === mx && y === my + 1),
					`${label(v)} ${d}: a friend blocks the way out`,
				);
				ok(
					y === my + 1 && Math.abs(x - mx) <= 3,
					`${label(v)} ${d}: (${x},${y}) is far from the mouth`,
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
		},
		toast: (text) => {
			log.push(`toast ${text}`);
		},
		rebuild: async () => {
			log.push("rebuild");
		},
		exit: () => {},
	};
	return { s, log };
};

/** log の 中で want が この順に 出てくるか（あいだに ほかの 行が あってもよい）。 */
const inOrder = (log: readonly string[], want: readonly string[]): boolean => {
	let i = 0;
	for (const l of log) if (l === want[i]) i++;
	return i === want.length;
};

test("coming back: friends wait at the mouth, Kiriko steps out, they speak the ending in the village", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow"]);
		putTown({ stage: 0 });
		const v = villageView();
		const cases: [
			ReturnArrival,
			readonly { who: Speaker | null; text: string }[],
		][] = [
			[{ kind: "clear", dungeon: "shallow" }, STORY.shallow.ending],
			[{ kind: "escape", dungeon: "shallow" }, RETURN_PAGES],
		];
		for (const [a, pages] of cases) {
			const { s, log } = fakeStory({ at: VILLAGE_SPOTS.mouth.shallow });
			lineUp(s, a, v);
			const who = [...new Set(pages.flatMap((p) => (p.who ? [p.who] : [])))];
			const spots = lineupSpots(v, "shallow", who.length);
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
						p.who ? `say ${p.who}: ${p.text}` : `narrate: ${p.text}`,
					),
					"fadeOut",
					"rebuild",
					"bgm town",
					"fadeIn",
				]),
				`${a.kind}: the scene is out of order:\n${log.join("\n")}`,
			);
			ok(
				s.state.y === VILLAGE_SPOTS.mouth.shallow[1] + 1,
				`${a.kind}: Kiriko is still in the mouth`,
			);
		}
		// 口が ふさがっていて 蓄音機の前に いる（開発用の 冒険など）：場面は ない
		const { s, log } = fakeStory();
		lineUp(s, { kind: "escape", dungeon: "deep" }, v);
		await returnScene(s, { kind: "escape", dungeon: "deep" });
		ok(log.length === 0, `a scene played away from the mouth: ${log.join()}`);
	});
});

test("unlock news: the gate stays shut until shown, おんJ民 steps aside, a closed tab shows it again", async () => {
	await withStorageAsync(async () => {
		const news: ProgressNews = { dungeon: "main", reason: "clear" };
		setProgress(["shallow", "main"], [news], ["shallow"]);
		putTown({ stage: 0 });
		// 知らせを 見せるまでは 閉じたまま 描く（おんJ民が 口の前）
		ok(!villageView().unlocked.includes("main"), "本編 opens before its news");
		const guard = VILLAGE_SPOTS.nanj(villageView());
		ok(
			guard[0] === VILLAGE_SPOTS.mouth.main[0],
			"おんJ民 is not at the gate before the news",
		);
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
		// 開きなおして 最後まで
		const { s, log } = fakeStory();
		await newsScript(s);
		const [bx, by] = VILLAGE_SPOTS.nanj({
			stage: 0,
			unlocked: ["shallow", "main"],
			cleared: [],
		});
		ok(
			inOrder(log, [
				"look nanj",
				...UNLOCK_LINES.main.map((l) => `say ${l.who}: ${l.text}`),
				`goto nanj ${bx},${by}`,
				"rebuild",
				"se chapter",
				"narrate: 「過去ログの底」に\nもぐれるように　なった",
				"look kiriko",
			]),
			`the 本編 news is out of order:\n${log.join("\n")}`,
		);
		ok(!log.includes("fadeOut"), "the 本編 news fades although nothing moves");
		ok(loadProgress().news.length === 0, "the news stays after it was shown");
		ok(villageView().unlocked.includes("main"), "本編 is still shut");
		// もっと：板で ふさいだ 口を 見て、暗転の 中で 板を はずす
		setProgress(
			["shallow", "main", "deep"],
			[{ dungeon: "deep", reason: "clear" }],
			["shallow", "main"],
		);
		const deep = fakeStory();
		await newsScript(deep.s);
		ok(
			inOrder(deep.log, [
				`look ${VILLAGE_SPOTS.mouth.deep.join(",")}`,
				...UNLOCK_LINES.deep.map((l) => `say ${l.who}: ${l.text}`),
				"fadeOut",
				"rebuild",
				"fadeIn",
				"narrate: 「もっと過去ログの底」に\nもぐれるように　なった",
			]),
			`the もっと news is out of order:\n${deep.log.join("\n")}`,
		);
		// 10回 たおれて 開いた（救い）：シヨが 針を 用意する
		setProgress(["shallow", "main"], [{ dungeon: "main", reason: "relief" }]);
		const relief = fakeStory();
		await newsScript(relief.s);
		ok(
			relief.log.includes(`say shiyo: ${UNLOCK_LINES.relief[0].text}`) &&
				relief.log.includes(`goto nanj ${bx},${by}`),
			`the relief news is wrong:\n${relief.log.join("\n")}`,
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
				`say zero: ${fill(TOWN_MSG.sold.text, { points: priceOf(herb) })}`,
				"fadeOut",
				"rebuild",
				`look ${VILLAGE_SPOTS.growth(1).join(",")}`,
				"fadeIn",
				"se levelup",
				`toast 町が　「${STAGE_NAMES[1]}」に　なった`,
				...STAGE_UP[1].map((l) => `say ${l.who}: ${l.text}`),
				"look kiriko",
			]),
			`the first stall is out of order:\n${first.log.join("\n")}`,
		);
		ok(
			!first.log.some((l) => l.startsWith("narrate: 倉庫から")),
			"a carry hint before the storehouse",
		);
		// 倉庫が 建つ（段4）：持ちこみの 数を 知らせる
		putTown({
			stage: 3,
			points: STAGE_POINTS[4] - 10,
			pending: pending("escape", [item(3, "starsword")]),
		});
		const store = fakeStory();
		await settleScript(store.s, chooser([]));
		ok(loadTown().stage === 4, `stage ${loadTown().stage}`);
		ok(
			store.log.includes(`say roze: ${TOWN_MSG.noStorage.text}`),
			"ロゼ does not say there is no storehouse yet",
		);
		ok(
			store.log.includes(
				`narrate: 倉庫から　過去ログの底へ\n${CARRY_MAX[4]}つまで　持っていける`,
			),
			`no carry hint:\n${store.log.join("\n")}`,
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
			storage: [],
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
			c.log[0] === `say shiyo: ${TOWN_MSG.storageFull.text}` &&
				loadTown().storage.length === 10 &&
				!loadTown().pending,
			`full storehouse:\n${c.log.join("\n")}`,
		);
		// 何も 持ち帰らなかった：ひとことだけ
		putTown({ stage: 4, points: 1000, pending: pending("escape", []) });
		const d = fakeStory();
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
		// 本人と 地の文で 3窓まで（4窓目は 仲間・ほかの子の 口出しの ときだけ）
		ok(
			ls.filter((l) => l.who === "mob" || l.who === null).length <= 3,
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
		const want = MOB_IDS.filter((id) => MOBS[id].from <= v.stage);
		ok(
			here.length === want.length,
			`${label(v)}: ${here.map((p) => p.id).join()}`,
		);
	}
	const froms = MOB_IDS.map((id) => MOBS[id].from);
	ok(
		new Set(froms).size === froms.length &&
			froms.every((f) => f >= 0 && f < TOWN_STAGES),
		`move-in stages: ${froms}`,
	);
	// はじめから いるのは ぷゆゆ だけ（マイナーズは 町が 育ってから）
	ok(
		MOB_IDS.filter((id) => MOBS[id].from === 0).join() === "puyu",
		"only ぷゆゆ is there from the start",
	);
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
		const id = "panmatsu";
		const d = MOBS[id];
		const plain = (line: string) => `say null: ${seasonalToday(d) ?? line}`;
		ok(hasMobNews(id), "no 「！」 before meeting");
		const a = fakeStory({ near: ["roze"] });
		await mobScript(id)(a.s);
		ok(
			a.log[0] === `say null: ${d.meet[0]?.text}` &&
				a.log[1] === `say roze: ${d.meet[1]?.text}`,
			`meet:\n${a.log.join("\n")}`,
		);
		ok(!hasMobNews(id), "「！」 stays after meeting");
		// 同じ 帰りの あいだは 新しい話は 出ない（まだ もぐっていないので 反応も ない）
		const b = fakeStory();
		await mobScript(id)(b.s);
		ok(b.log.join() === plain(idleOf(d)), `same return:\n${b.log.join("\n")}`);
		// 帰ってきた：新しい話（ロゼが 近くに いないので ロゼとの 話は とばす）
		pushRecord({ kind: "dead", cause: "おなかが　すいて　たおれた" });
		ok(hasMobNews(id), "no 「！」 after a return");
		const c = fakeStory();
		await mobScript(id)(c.s);
		const plainChat = d.chats.find((x) => !x.with);
		ok(
			c.log[0] === `say null: ${plainChat?.lines[0]?.text}` &&
				!c.log.some((l) => l.startsWith("say roze")),
			`plain chat:\n${c.log.join("\n")}`,
		);
		ok(!hasMobNews(id), "「！」 stays after the new talk");
		// 次は 前の冒険への 反応（おなかが すいて）、そのあと いつもの
		const e = fakeStory();
		await mobScript(id)(e.s);
		ok(e.log.join() === plain(d.react.starve ?? ""), `reaction: ${e.log}`);
		const f = fakeStory();
		await mobScript(id)(f.s);
		ok(f.log.join() === plain(idleOf(d)), `idle: ${f.log.join()}`);
		// 次の 帰り：ロゼが 近ければ ロゼとの 話
		pushRecord({ kind: "clear", dungeon: "shallow" });
		const g = fakeStory({ near: ["roze"] });
		await mobScript(id)(g.s);
		ok(
			g.log[0] === `say roze: ${d.chats[0]?.lines[0]?.text}`,
			`with roze:\n${g.log.join("\n")}`,
		);
		// 原盤を 持ち帰ったら 節目が 先
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
			const t = fakeStory({ near: ["roze", "nanj", "zero"] });
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
	return out;
};

test("the very first village: premise, おんJ民 points at the left mouth, the goal — once", async () => {
	const texts: [string, string][] = [];
	for (const [k, v] of Object.entries(OPENING))
		v.forEach((t, i) => {
			texts.push([`OPENING.${k}[${i}]`, t]);
		});
	fitsWindow(texts);
	await withStorageAsync(async () => {
		setProgress(["shallow"]);
		ok(needsOpening(), "no opening on the first boot");
		const a = fakeStory();
		await openingScript(a.s);
		ok(
			inOrder(a.log, [
				`narrate: ${OPENING.premise[0]}`,
				"look nanj",
				`say nanj: ${OPENING.nanjCall[0]}`,
				`look ${VILLAGE_SPOTS.mouth.shallow.join(",")}`,
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

/** fakeStory の 記録で その窓が どう 見えるか（ぷゆゆの 声は おんJ民の 色、ほかの子は 色なし）。 */
const logOf = (id: MobId, l: MobLine): string => {
	if (l.who === null) return `narrate: ${l.text}`;
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
				["ひとだまに　たおされた", 2, false],
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
	for (const [where, t] of [...hers, ...rest]) {
		// 肌の 色の 件（rpg の 決まり）
		for (const w of ["黄色", "きいろ", "山吹"])
			ok(!t.includes(w), `${where}: "${w}"`);
		ok(!/[️‍]/u.test(t), `${where}: FE0F / ZWJ`);
	}
	// キリコ・地の文・仲間・ほかの子には 絵文字を つけない
	for (const [where, t] of rest)
		ok(!EMOJI.test(t), `${where}: emoji outside ぷゆゆ's own lines`);
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

test("ぷゆゆ・マイナーズ: small moves are few, come before the mob's own or narration window, and stay near home", () => {
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

test("ぷゆゆ: there from the first visit with the おんJ民 name bar, not a candidate, answers the last run once", async () => {
	await withStorageAsync(async () => {
		setProgress(["shallow"]);
		putTown({ stage: 0 });
		const d = MOBS.puyu;
		const said = (t: string | undefined) => `say nanj: ${t}`;
		const chat = (k: string) => d.chats.find((c) => c.key === k)?.lines ?? [];
		const place = villagePlaces(villageView()).find((p) => p.mob === "puyu");
		ok(
			place?.x === 8 && place.y === 16 && place.wander === true,
			`stage 0: ${JSON.stringify(place)}`,
		);
		ok(hasMobNews("puyu"), "no 「！」 on the very first visit");
		const a = fakeStory({ near: ["zero"] });
		await mobScript("puyu")(a.s);
		ok(
			a.log[0] === said(d.meet[0]?.text) &&
				a.log.includes(`say zero: ${d.meet[3]?.text}`),
			`meet:\n${a.log.join("\n")}`,
		);
		// マイナーズでは ない：ぷゆゆ ＋ 1人では はり紙は 出ない
		await mobScript("nichie")(fakeStory().s);
		ok(!senkyoOpen(), "ぷゆゆ counts as a 総選挙 candidate");
		// 1回目の 帰り：B1 で たおれた → 早すぎる 帰りの 話。反応を かねるので 次は いつもの ひとこと
		setBook(["tousuko"]);
		pushRecord({ kind: "dead", cause: "ひとだまに　たおされた", depth: 1 });
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
			["ひとだまに　たおされた", 2, 3],
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
			logs.some((l) => l.includes("goto mob_puyu 8,16")),
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
