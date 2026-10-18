// 地上の町・帰還スレ・持ちこみ の試験（pnpm test で いっしょに動く）。

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DUNGEON_IDS, dungeonById } from "../core/data/dungeons";
import { ITEM_LIST } from "../core/data/items";
import { pickTrapKind } from "../core/floor";
import { isKnownKind } from "../core/item";
import { parseReplay } from "../core/replay";
import { Run } from "../core/run";
import { deserializeRun, serializeRun } from "../core/serial";
import {
	CARRY_MAX,
	pricedKinds,
	priceOf,
	STORAGE_CAP,
	TOWN_STAGES,
} from "../core/town";
import { triggerTrap } from "../core/traps";
import type { Item, RunState } from "../core/types";
import { SE_LOUDNESS } from "../data/audio/loudness";
import { sfx } from "../data/audio/sfx";
import { advanceClock, nowHour, nowMinute, today } from "../data/town/calendar";
import { stageOfCleared } from "../data/town/revival";
import { ROOM_DOOR_SE } from "../data/town/rooms";
import { timeBand } from "../data/village/crowd";
import {
	BAND_LIGHT,
	BAND_TINT,
	clockLine,
	daylightAt,
	lightOf,
	rgbOf,
	sunTimes,
	windowLit,
} from "../data/village/daylight";
import { FACILITIES, facilityTiles } from "../data/village/facilities";
import { villagePalette } from "../data/village/map";
import { GROUND, SHOP } from "../data/village/tiles";
import { devArrival } from "../devSandbox";
import {
	depositBag,
	depositItem,
	forgetProgressMemo,
	giveLunch,
	growTown,
	loadProgress,
	loadRecords,
	loadReplays,
	loadRun,
	loadTown,
	noteRunEnd,
	replayMatches,
	runStats,
	saveRun,
	saveTown,
	settleReturn,
	takeFromBag,
	takeFromStorage,
	takeLunch,
	toReplay,
	withdrawItem,
} from "../engine/save";
import {
	disappointed,
	doneTamperNews,
	forgetTamperMemo,
	LINGER,
	loadTamper,
} from "../engine/tamper";
import { sceneMinute, setSceneSky, skyPinned } from "../ui/village/sceneSky";
import { botCommand } from "./bot";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

const CASES: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => CASES.push({ name, run });

test("村の 時間帯の 色：昼は 重ねない、夜・深夜は 暗く、深夜が いちばん 暗い。空は 日付の 日の 出・日の 入りに 合わせる", () => {
	const sum = (c: string | null) =>
		c ? (c.match(/\d+/g) ?? []).reduce((n, v) => n + Number(v), 0) : 765;
	ok(BAND_TINT.day === null, "day is tinted");
	for (const b of ["late", "morning", "day", "evening", "night"] as const)
		ok(b in BAND_TINT, `no tint for ${b}`);
	ok(
		sum(BAND_TINT.late) < sum(BAND_TINT.night) &&
			sum(BAND_TINT.night) < sum(BAND_TINT.evening) &&
			sum(BAND_TINT.evening) < sum(BAND_TINT.morning),
		"the night is not darker than the evening",
	);
	ok(timeBand(21) === "night" && timeBand(18) === "evening", "bands");
	// 夜の 明かり：街灯（歩道・レンガ・草地）と 外の 窓（家の 上段・施設の 外観）が 見分けられる。昼は 灯らない
	ok(lightOf(SHOP.w.layers) === "window", "the shop window does not light");
	ok(
		["ゃ", "ギ", "ゲ"].every(
			(c) =>
				lightOf(
					villagePalette({ stage: 7, unlocked: [], cleared: [] })[c]?.layers ??
						[],
				) === "lamp",
		),
		"a street lamp does not light",
	);
	ok(lightOf(GROUND[","]?.layers ?? ["x"]) === null, "the grass lights up");
	const tiles = facilityTiles();
	ok(
		Object.values(tiles).filter((t) => lightOf(t.layers) === "window").length >
			20,
		"few facility windows light up",
	);
	ok(BAND_LIGHT.day.lamp === 0 && BAND_LIGHT.night.lamp > 0, "day lamps");
	const lit = Array.from({ length: 400 }, (_, i) =>
		windowLit(i % 20, Math.floor(i / 20), 0.25),
	).filter(Boolean).length;
	ok(lit > 60 && lit < 140, `late-night windows lit: ${lit}/400`);
	ok(clockLine(21, 5, "night") === "21:05　夜", clockLine(21, 5, "night"));
	// 空は 日付の 日の 出・日の 入りに 合わせる：夏は 19時でも 夕方、冬は 18時に もう 夜。20時台は いつも 夜
	const summer = sunTimes(6, 21);
	const winter = sunTimes(12, 21);
	ok(
		summer.set > 18.8 * 60 && summer.set < 19.2 * 60,
		`summer set ${summer.set}`,
	);
	ok(
		winter.set > 16.4 * 60 && winter.set < 16.7 * 60,
		`winter set ${winter.set}`,
	);
	ok(winter.rise > 6.6 * 60 && summer.rise < 4.6 * 60, "sunrise");
	const night = BAND_TINT.night;
	for (const [m, d] of [
		[6, 21],
		[10, 15],
		[12, 21],
	] as const)
		ok(
			daylightAt(20 * 60 + 30, m, d).tint === night,
			`${m}/${d} 20:30 not night`,
		);
	ok(daylightAt(18 * 60, 12, 21).tint === night, "winter 18:00 not night");
	ok(daylightAt(17 * 60, 6, 21).tint === null, "summer 17:00 not day");
	ok(daylightAt(13 * 60, 1, 10).tint === null, "winter noon tinted");
});

test("every item except goal items has a price", () => {
	const priced = new Set(pricedKinds());
	for (const d of ITEM_LIST)
		if (d.cat !== "goal") ok(priced.has(d.id), `no price for ${d.id}`);
	const it = (kind: string, extra: Partial<Item> = {}): Item => ({
		uid: 1,
		kind,
		plus: 0,
		cursed: false,
		charges: 0,
		known: true,
		count: 1,
		...extra,
	});
	ok(priceOf(it("genban")) === 0, "the goal item is sold");
	ok(
		priceOf(it("copper", { plus: 2 })) > priceOf(it("copper")),
		"+2 is not worth more",
	);
	ok(
		priceOf(it("r_might", { cursed: true })) < priceOf(it("r_might")),
		"a cursed ring is not worth less",
	);
	ok(
		priceOf(it("a_wood", { count: 10 })) === 10 * priceOf(it("a_wood")),
		"arrows are not priced per arrow",
	);
});

test("every weapon has its own hit sound, and every attack sound is measured", () => {
	const names = [
		"swing_fist",
		"hit_fist",
		"enemyMiss",
		"damage",
		...ITEM_LIST.filter((d) => d.cat === "weapon").flatMap((d) => {
			ok(d.sound, `${d.id} has no sound`);
			return d.sound ? [d.sound.swing, d.sound.hit] : [];
		}),
	];
	for (const n of names) {
		ok(sfx[n], `no sound file for ${n}`);
		ok(SE_LOUDNESS[n], `${n} is not measured (pnpm loudness)`);
	}
	const hits = ITEM_LIST.filter((d) => d.cat === "weapon").map(
		(d) => d.sound?.hit,
	);
	ok(new Set(hits).size === hits.length, "two weapons share a hit sound");
});

test("建物の 出入りの 音：どれも 素材が あって 測ってあり、入口の 作りで 何種類かに 分かれる", () => {
	const names = [
		"door",
		"doorSteel",
		...Object.values(ROOM_DOOR_SE),
		...FACILITIES.filter((f) => f.room).map((f) => f.doorSe ?? "doorWood"),
	];
	for (const n of names) {
		ok(sfx[n], `no sound file for ${n}`);
		ok(SE_LOUDNESS[n], `${n} is not measured (pnpm loudness)`);
	}
	ok(new Set(names).size >= 4, "every building sounds the same");
});

test("効果音の 名前：se(…) で 鳴らす 音は どれも 素材が あって 測ってあり、レベルアップの 曲は 迷宮の レベルアップ だけ", () => {
	const files = (dir: string): string[] =>
		readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
			d.isDirectory()
				? files(join(dir, d.name))
				: d.name.endsWith(".ts")
					? [join(dir, d.name)]
					: [],
		);
	const uses = new Map<string, string[]>();
	for (const p of [...files("src/ui"), ...files("src/core")]) {
		const src = readFileSync(p, "utf8");
		// se( の 中の 「鳴らす 名前」だけ（三項の 枝・頭の 文字列。=== "tie" の ような 比べる 値は 拾わない）
		for (const m of src.matchAll(/\bse\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g))
			for (const n of (m[1] ?? "").matchAll(/(?:^\s*|[?:]\s*)"([A-Za-z_]+)"/g))
				if (n[1]) uses.set(n[1], [...(uses.get(n[1]) ?? []), p]);
	}
	ok(uses.size >= 60, `found ${uses.size} sounds`);
	for (const [n, at] of uses) {
		ok(sfx[n], `no sound file for ${n} (${at[0]})`);
		ok(SE_LOUDNESS[n], `${n} is not measured (pnpm loudness)`);
	}
	const lv = (uses.get("levelup") ?? []).map((p) => p.replace(/\\/g, "/"));
	ok(
		lv.length === 1 && lv[0]?.endsWith("core/run.ts"),
		`levelup used outside a level-up: ${lv.join(", ")}`,
	);
});

test("町の 段：本筋の 板（パン → きのこ → 風呂 → 電池）を 持ち帰ると 0 → 3 → 5 → 6 → 7。寄り道では 上がらない", () => {
	ok(stageOfCleared([]) === 0, "stage before any board");
	ok(stageOfCleared(["shallow"]) === 3, "パン板");
	ok(stageOfCleared(["shallow", "kinoko"]) === 5, "きのこ板");
	ok(stageOfCleared(["shallow", "kinoko", "main"]) === 6, "風呂板");
	ok(
		stageOfCleared(["shallow", "kinoko", "main", "deep"]) === TOWN_STAGES - 1,
		"電池板 is not the top",
	);
	ok(
		stageOfCleared(["shallow", "tropical", "konamono", "festival"]) === 3,
		"a side board raised the stage",
	);
	// はじめから 機材倉庫（持ちこみ 1つ）。開いた 段で 広がる
	ok(
		STORAGE_CAP[0] > 0 && CARRY_MAX[0] === 1,
		"the equipment storage is not there from the start",
	);
	ok(
		STORAGE_CAP.every((c, i) => i === 0 || c >= STORAGE_CAP[i - 1]) &&
			CARRY_MAX.every((c, i) => i === 0 || c >= CARRY_MAX[i - 1]),
		"storage shrinks with more shops",
	);
	ok(CARRY_MAX[TOWN_STAGES - 1] === 4, "carry max is not 4 at the top");
});

test("帰還スレ asks first, then ends the run as a return with the items", () => {
	const run = Run.create("town-escape");
	const scroll = run.newItem("s_escape");
	run.s.player.items.push(scroll);
	const turn = run.s.turn;
	const ev = run.act({ c: "use", item: scroll.uid });
	ok(
		ev.some((e) => e.t === "fx" && e.kind === "confirm:escape"),
		"did not ask",
	);
	ok(run.s.turn === turn && !run.s.end, "asking used a turn or ended the run");
	ok(isKnownKind(run.s, "s_escape"), "asking did not reveal the scroll");
	ok(run.findItem(scroll.uid), "asking used up the scroll");
	run.act({ c: "use", item: scroll.uid, target: 0 });
	ok(run.s.end?.kind === "escape", `ended as ${run.s.end?.kind}`);
	ok(
		run.s.player.items.length > 0 && !run.findItem(scroll.uid),
		"items were lost or the scroll was not used",
	);
});

test("スレ can't be used while アク禁 (blind)", () => {
	const run = Run.create("town-blind-read");
	run.s.player.status.blind = 10;
	const scroll = run.newItem("s_escape");
	run.s.player.items.push(scroll);
	const turn = run.s.turn;
	const ev = run.act({ c: "use", item: scroll.uid });
	ok(!ev.some((e) => e.t === "fx"), "asked to read while blind");
	ok(run.s.turn === turn, "trying to read used a turn");
	ok(run.findItem(scroll.uid), "the scroll was used up");
	ok(!isKnownKind(run.s, "s_escape"), "the scroll was revealed");
});

test("帰還スレ does nothing on the walk back with the goal item", () => {
	const run = Run.create("town-escape-back");
	run.s.returning = true;
	const scroll = run.newItem("s_escape");
	run.s.player.items.push(scroll);
	run.act({ c: "use", item: scroll.uid });
	ok(!run.s.end, "escaped while carrying the goal item back");
});

test("carried-in items start in the bag, known, and replay identically", () => {
	const carry: Item[] = [
		{
			uid: 900,
			kind: "h_heal",
			plus: 0,
			cursed: false,
			charges: 0,
			known: true,
			count: 1,
		},
		{
			uid: 901,
			kind: "steel",
			plus: 2,
			cursed: false,
			charges: 0,
			known: true,
			count: 1,
		},
	];
	const run = Run.create("town-carry", "main", carry);
	const kinds = run.s.player.items.map((i) => i.kind);
	ok(kinds.includes("h_heal") && kinds.includes("steel"), `bag: ${kinds}`);
	ok(isKnownKind(run.s, "h_heal"), "a carried herb is not known");
	const uids = run.s.player.items.map((i) => i.uid);
	ok(new Set(uids).size === uids.length, "duplicate uids in the bag");
	for (let i = 0; i < 400 && !run.s.end; i++) run.act(botCommand(run));
	const again = Run.create("town-carry", "main", run.s.carriedIn ?? []);
	for (const st of parseReplay(run.s.replay as string))
		if (st.kind === "cmd") again.act(st.cmd);
	ok(
		serializeRun(again.s) === serializeRun(run.s),
		"a run with carried-in items did not replay identically",
	);
});

// ───────────────── 保存（localStorage の代わりに 入れものを置いて 試す） ─────────────────

/** 試験のあいだだけ localStorage を 覚えるだけの入れものに かえる（write が false なら 書けない）。 */
const withStorage = (fn: () => void, write = true): void => {
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
	try {
		fn();
	} finally {
		if (prev) Object.defineProperty(globalThis, "localStorage", prev);
		else delete (globalThis as { localStorage?: unknown }).localStorage;
		forgetProgressMemo();
	}
};

/** 帰還スレで 帰ってくる（聞かれて、はい）。 */
const escapeRun = (run: Run): void => {
	const scroll = run.newItem("s_escape");
	run.s.player.items.push(scroll);
	run.act({ c: "use", item: scroll.uid });
	run.act({ c: "use", item: scroll.uid, target: 0 });
};

test("a finished run saved again (tab hidden during the ending) counts once", () => {
	withStorage(() => {
		loadProgress();
		const run = Run.create("save-once", "main");
		escapeRun(run);
		ok(run.s.end?.kind === "escape", "did not escape");
		for (let i = 0; i < 3; i++) saveRun(run.s);
		const t = loadTown();
		ok(t.points === 0, `the haul was sold ${t.points} before choosing`);
		ok(
			t.pending?.items.length === run.s.player.items.length,
			"the pending haul is not the bag",
		);
		const dead = Run.create("save-once-dead", "shallow");
		dead.finish("dead", "試験");
		for (let i = 0; i < 3; i++) saveRun(dead.s);
		ok(
			loadProgress().fails.shallow === 1,
			`one death counted ${loadProgress().fails.shallow} times`,
		);
	});
});

test("the first clear raises the town stage once it is noted; selling does not raise it", () => {
	withStorage(() => {
		loadProgress();
		const run = Run.create("first-clear", "shallow");
		run.finish("clear", "試験");
		for (let i = 0; i < 3; i++) saveRun(run.s);
		const t = loadTown();
		const r = settleReturn(t, []);
		ok(loadTown().stage === 0, "selling raised the stage");
		const o = growTown(loadTown());
		ok(o.from === 0 && o.to === 3, `grew ${o.from} → ${o.to}`);
		ok(growTown(loadTown()).to === 3, "grew twice");
		// ヒナリーの 帳簿の グラフ：帰りごとに 1本（板・売れた 額）
		const sales = loadTown().sales;
		ok(
			sales.length === 1 &&
				sales[0].dungeon === "shallow" &&
				sales[0].points === r.sold,
			`sales ${JSON.stringify(sales)}`,
		);
	});
});

test("a clear can also put the chosen items in storage (not only 帰還スレ)", () => {
	withStorage(() => {
		loadProgress();
		saveTown({ ...loadTown(), stage: 4 });
		const run = Run.create("clear-store", "main");
		run.s.player.items.push(run.newItem("h_heal"));
		run.finish("clear", "試験");
		saveRun(run.s);
		const herb = (loadTown().pending?.items ?? []).find(
			(it) => it.kind === "h_heal",
		);
		if (!herb) throw new Error("harness: the herb did not come home");
		settleReturn(loadTown(), [herb.uid]);
		ok(
			loadTown().storage.some((it) => it.kind === "h_heal"),
			"the herb was not stored after a clear",
		);
	});
});

test("one run returns to town only once, even when continued in two tabs", () => {
	withStorage(() => {
		loadProgress();
		saveTown({ ...loadTown(), stage: 4 });
		const a = Run.create("two-tabs", "main");
		a.s.player.items.push(a.newItem("starsword"));
		const b = new Run(deserializeRun(serializeRun(a.s)));
		escapeRun(a);
		saveRun(a.s);
		const all = (loadTown().pending?.items ?? []).map((it) => it.uid);
		settleReturn(loadTown(), all);
		const stored = loadTown().storage.length;
		ok(stored > 0, "nothing was stored");
		escapeRun(b);
		saveRun(b.s);
		const t = loadTown();
		ok(!t.pending, "the second tab brought the same haul home again");
		ok(t.storage.length === stored, "storage grew from the second tab");
	});
});

test("carrying out takes the chosen items by content, once", () => {
	withStorage(() => {
		loadProgress();
		const mk = (kind: string, plus = 0): Item => ({
			uid: 1,
			kind,
			plus,
			cursed: false,
			charges: 0,
			known: true,
			count: 1,
		});
		saveTown({
			...loadTown(),
			stage: 4,
			storage: [mk("steel"), mk("steel", 2), mk("h_heal")],
		});
		const got = takeFromStorage([mk("steel", 2)]);
		ok(got.length === 1 && got[0].plus === 2, "took the wrong item");
		ok(loadTown().storage.length === 2, "storage did not shrink by one");
		ok(takeFromStorage([mk("steel", 2)]).length === 0, "took it twice");
	});
});

test("落とし穴：1つ 下へ 落ちて、落ちた 先で ダメージ（トルネコ1）。上りの 板は 1つ 前の 階へ", () => {
	let fell = 0;
	for (let i = 0; i < 40 && !fell; i++) {
		const r = Run.create(`pit-${i}`, "main");
		const hp = r.p.hp;
		const depth = r.s.depth;
		const log0 = r.s.log.length;
		triggerTrap(r, { x: r.p.x, y: r.p.y, kind: "pit", found: false });
		if (r.s.depth === depth) continue; // 罠が 動かなかった
		fell++;
		const log = r.s.log.slice(log0);
		const i0 = log.indexOf("落とし穴に落ちた！");
		const i1 = log.findIndex((l) => l.endsWith("のダメージを受けた"));
		ok(r.s.depth === depth + 1, `depth ${depth} → ${r.s.depth}`);
		ok(i0 >= 0 && i1 > i0, `log: ${log.join(" / ")}`);
		ok(r.p.hp <= hp, "healed by a pit");
	}
	ok(fell > 0, "the pit never worked");
	// 上りの 板：1つ 前の 階へ 落ちる。1階では 落ちない
	let upFell = 0;
	for (let i = 0; i < 40 && !upFell; i++) {
		const r = Run.create(`pit-up-${i}`, "tropical");
		ok(r.pitFall() === false && r.s.depth === 1, "fell below floor 1");
		r.enterFloor(4, false);
		triggerTrap(r, { x: r.p.x, y: r.p.y, kind: "pit", found: false });
		if (r.s.depth === 4) continue;
		upFell++;
		ok(r.s.depth === 3, `climbing board: 4 → ${r.s.depth}`);
	}
	ok(upFell > 0, "the pit never worked on a climbing board");
	// 上りの 板でも 落とし穴は 出る
	const r = Run.create("pit-up-kinds", "festival");
	let pits = 0;
	for (let i = 0; i < 300; i++) if (pickTrapKind(r, 20) === "pit") pits++;
	ok(pits > 0, "no pits on a climbing board");
});

test("ぷゆゆの お弁当：持ち物が からっぽなら もらえて、出るときに 持っていく。はじめの 持ち物は どの 板も ぷゆゆパン だけ", () => {
	for (const d of DUNGEON_IDS)
		ok(
			JSON.stringify(dungeonById(d).start) === JSON.stringify(["f_large"]),
			`${d} starts with ${dungeonById(d).start}`,
		);
	withStorage(() => {
		loadProgress();
		saveTown({ ...loadTown(), stage: 5 });
		ok(giveLunch() && loadTown().lunch, "no lunch with an empty bag");
		ok(!giveLunch(), "lunch given twice");
		ok(takeLunch() && !loadTown().lunch, "lunch not taken");
		ok(!takeLunch(), "lunch taken twice");
		// 倉庫から 引き取った 道具が あっても もらえる
		saveTown({
			...loadTown(),
			storage: [
				{
					uid: 1,
					kind: "h_heal",
					plus: 0,
					cursed: false,
					charges: 0,
					known: true,
					count: 1,
				},
			],
		});
		withdrawItem(0);
		ok(giveLunch(), "no lunch with a carried item");
	});
	// お弁当なしで 出た 冒険は 手ぶらで 始まり、リプレイも 手ぶら
	const bare = Run.create("no-lunch", "main", [], "fetch", false);
	ok(
		!bare.s.player.items.length && bare.s.noLunch === true,
		`items: ${bare.s.player.items.map((it) => it.kind)}`,
	);
	const fed = Run.create("no-lunch", "main");
	ok(
		fed.s.player.items.length === 1 && fed.s.player.items[0].kind === "f_large",
		"the lunch is not the start item",
	);
});

test("the village bag: withdraw up to CARRY_MAX, put back, a no-carry board sends it all back, the run takes it", () => {
	withStorage(() => {
		loadProgress();
		const mk = (kind: string): Item => ({
			uid: 1,
			kind,
			plus: 0,
			cursed: false,
			charges: 0,
			known: true,
			count: 1,
		});
		saveTown({
			...loadTown(),
			stage: 5,
			storage: [mk("steel"), mk("h_heal"), mk("s_appraise")],
		});
		ok(withdrawItem(0) && withdrawItem(0), "could not withdraw 2 at stage 5");
		ok(!withdrawItem(0), "withdrew past CARRY_MAX");
		ok(loadTown().bag.length === CARRY_MAX[5], "bag is not full");
		depositItem(0);
		ok(
			loadTown().bag.length === 1 && loadTown().storage.length === 2,
			"put back did not move one item",
		);
		ok(depositBag() === 1 && loadTown().bag.length === 0, "bag not emptied");
		withdrawItem(0);
		const bag = loadTown().bag;
		ok(
			takeFromBag(bag).length === 1 && !loadTown().bag.length,
			"run did not take the bag",
		);
		ok(takeFromBag(bag).length === 0, "took the bag twice");
		const refuse = (["deep", "tropical", "hidden"] as const).every(
			(d) => dungeonById(d).noCarry,
		);
		ok(refuse && !dungeonById("main").noCarry, "noCarry boards changed");
	});
});

test("a boss run's record and replay keep the objective; replays without it (old, shared) read as fetch", () => {
	withStorage(() => {
		loadProgress();
		const boss = Run.create("boss-record", "kinoko", [], "boss");
		boss.act({ c: "wait" });
		boss.finish("clear", "親玉きのにゃんをたおした");
		saveRun(boss.s);
		const rec = loadRecords()[0];
		const rp = loadReplays()[0];
		ok(rec?.objective === "boss", `record objective ${rec?.objective}`);
		ok(rp?.objective === "boss", `replay objective ${rp?.objective}`);
		if (!rp) throw new Error("harness: no replay");
		// 持ち帰りの 冒険は 書かない（前の 版と 同じ 形）
		const fetch = Run.create("fetch-record", "kinoko");
		fetch.act({ c: "wait" });
		fetch.finish("dead", "試験");
		saveRun(fetch.s);
		ok(!("objective" in (loadRecords()[0] ?? {})), "fetch record wrote one");
		ok(!("objective" in (loadReplays()[0] ?? {})), "fetch replay wrote one");
		// 共有の リプレイ：無い・fetch は 持ち帰り（書かない）、boss は 通す、ほかは 読まない
		const { objective: _drop, ...old } = rp;
		ok(toReplay(old)?.objective === undefined, "an old replay became boss");
		ok(
			toReplay({ ...rp, objective: "fetch" })?.objective === undefined,
			"a fetch replay kept its objective",
		);
		ok(toReplay(rp)?.objective === "boss", "a shared boss replay lost it");
		ok(
			toReplay({ ...rp, objective: "raid" }) === null,
			"an unknown objective was read",
		);
		// 記録と リプレイは 目的が あっても 結べる
		ok(replayMatches(rp, rec), "the boss replay lost its record");
	});
});

test("unlocks last for the session when storage cannot be written", () => {
	withStorage(() => {
		ok(loadProgress().unlocked.join() === "shallow", "a new player has more");
		noteRunEnd("shallow", "clear");
		noteRunEnd("kinoko", "clear");
		ok(
			loadProgress().unlocked.includes("main"),
			"the main dungeon closed again",
		);
	}, false);
});

test("tampered saves still load; only values the game never makes are noted, once per edit", () => {
	withStorage(() => {
		forgetTamperMemo();
		const RUN = "kiriko-roguelike/run";
		const TOWN = "kiriko-roguelike/town";
		loadProgress();
		// ふつうに 遊んだ 中断セーブ・町は 見つけない（前の 版の 署名つき セーブも 読める）
		const run = Run.create("tamper-plain", "main");
		run.enterFloor(3, false);
		saveRun(run.s);
		ok(!loadRun()?.cheat, "a plain run save was noted");
		const plain = localStorage.getItem(RUN) ?? "";
		localStorage.setItem(RUN, `$1:abc:${plain}`);
		ok(loadRun()?.seed === run.s.seed, "a signed run save was not read");
		ok(!loadRun()?.cheat, "a signed run save was noted");
		// 前の 版の 中断セーブ（あとから ふえた 欄が 無い）
		const old = JSON.parse(plain);
		delete old.player.arrow;
		for (const it of old.player.items) delete it.rustproof;
		localStorage.setItem(RUN, JSON.stringify(old));
		ok(!!loadRun() && !loadRun()?.cheat, "an old run save was noted");
		saveTown({ ...loadTown(), points: 120, stage: 2 });
		loadTown();
		ok(loadTamper().n === 0, `noted ${loadTamper().n} times without editing`);
		ok(disappointed(runStats().runs) === 0, "the friends sulk for nothing");
		// HP を 最大より 多く 書きかえる → 読めて、この 冒険は 削除人に 追われる
		localStorage.setItem(RUN, plain.replace(/"hp":\d+,/, '"hp":999,'));
		const s = loadRun();
		ok(s?.player.hp === 999, "the edited run was not read as is");
		ok(s?.cheat === true, "the edited run is not marked");
		ok(loadTamper().n === 1 && loadTamper().news, "the edit was not noted");
		loadRun();
		ok(loadTamper().n === 1, "the same edit was counted twice");
		// 続けて 終わった 冒険：記録に 印、リプレイは 残さない
		const r2 = new Run(s as RunState);
		r2.finish("dead", "試験");
		saveRun(r2.s);
		ok(loadRecords()[0]?.cheat === true, "the record is not marked");
		ok(!loadReplays().some((p) => p.seed === r2.s.seed), "a replay was kept");
		// 町：マイナスの 売上は ありえない
		localStorage.setItem(TOWN, JSON.stringify({ points: -5, stage: 1 }));
		loadTown();
		ok(loadTamper().n === 2, `town edit noted ${loadTamper().n}`);
		// がっかりは 気づく 場面を 見せて、LINGER 回 もぐるまで
		doneTamperNews();
		const runs = loadTamper().runs;
		ok(disappointed(runs) === 2, "the friends do not sulk");
		ok(disappointed(runs + LINGER) === 0, "the friends sulk forever");
	});
});

test("開発用の ?sandbox&arrive=: parsed only with sandbox, bad kinds or boards are ignored", () => {
	const prev = Object.getOwnPropertyDescriptor(globalThis, "location");
	const at = (search: string) => {
		Object.defineProperty(globalThis, "location", {
			value: { search },
			configurable: true,
			writable: true,
		});
		return devArrival();
	};
	try {
		const a = at("?debug&sandbox&arrive=clear.deep.boss");
		ok(
			a?.kind === "clear" && a.dungeon === "deep" && a.objective === "boss",
			`clear.deep.boss → ${JSON.stringify(a)}`,
		);
		const d = at("?debug&sandbox&arrive=dead.kinoko");
		ok(
			d?.kind === "dead" && d.dungeon === "kinoko" && !d.objective,
			`dead.kinoko → ${JSON.stringify(d)}`,
		);
		ok(at("?debug&arrive=dead.kinoko") === null, "arrive without sandbox");
		ok(at("?debug&sandbox&arrive=won.kinoko") === null, "unknown kind");
		ok(at("?debug&sandbox&arrive=dead.nowhere") === null, "unknown board");
	} finally {
		if (prev) Object.defineProperty(globalThis, "location", prev);
		else delete (globalThis as { location?: unknown }).location;
	}
});

test("場面の 空を きめると 村の 時計も その 時刻に なり、解くと そこから すすむ", () => {
	const g = globalThis as { __testHour?: number };
	const hour = g.__testHour;
	delete g.__testHour;
	try {
		advanceClock(3 * 60 + 17);
		setSceneSky("night");
		ok(nowHour() === 22 && nowMinute() === 0, `night ${nowHour()}`);
		ok(skyPinned(), "the scene sky is not pinned");
		setSceneSky("morning");
		ok(nowHour() === 8, `morning ${nowHour()}`);
		setSceneSky("day");
		ok(nowHour() === 12, `day ${nowHour()}`);
		setSceneSky("evening");
		// 夕方の 色の いちばん 濃い ころ（節目の すぐ あと。数 段階 しか ずれない）
		const { m, d } = today();
		const tint = daylightAt(sceneMinute("evening"), m, d).tint;
		const want = rgbOf(BAND_TINT.evening);
		ok(
			rgbOf(tint).every((v, i) => Math.abs(v - (want[i] ?? 0)) <= 4),
			`the evening sky is ${tint}`,
		);
		setSceneSky("morning");
		setSceneSky(null);
		ok(!skyPinned(), "the scene sky stays pinned");
		ok(nowHour() === 8, `released at ${nowHour()}`);
		advanceClock(90);
		ok(nowHour() === 9 && nowMinute() === 30, "the clock does not resume");
	} finally {
		setSceneSky(null);
		if (hour !== undefined) g.__testHour = hour;
	}
});

export const runTownTests = (): TestResult[] =>
	CASES.map((c) => {
		try {
			c.run();
			return { id: "town", name: c.name, ok: true };
		} catch (e) {
			return {
				id: "town",
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			};
		}
	});
