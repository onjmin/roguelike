// 地上の町・帰還スレ・持ちこみ の試験（pnpm test で いっしょに動く）。

import { dungeonById } from "../core/data/dungeons";
import { ITEM_LIST } from "../core/data/items";
import { LAST_RES } from "../core/data/lastRes";
import { isKnownKind } from "../core/item";
import { parseReplay } from "../core/replay";
import { Run } from "../core/run";
import { deserializeRun, serializeRun } from "../core/serial";
import {
	CARRY_MAX,
	nextStage,
	pricedKinds,
	priceOf,
	STAGE_POINTS,
	STORAGE_CAP,
	TOWN_STAGES,
} from "../core/town";
import type { Item } from "../core/types";
import { SE_LOUDNESS } from "../data/loudness";
import { sfx } from "../data/sfx";
import {
	forgetProgressMemo,
	loadProgress,
	loadRecords,
	loadReplays,
	loadTown,
	noteRunEnd,
	replayMatches,
	saveRun,
	saveTown,
	settleReturn,
	takeFromStorage,
	toReplay,
} from "../engine/save";
import { botCommand } from "./bot";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

const CASES: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => CASES.push({ name, run });

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

test("town stage rules: one step per return, the deep (電池板) clear jumps to the top", () => {
	const none = { shallowCleared: false, topCleared: false };
	ok(nextStage(0, 0, none) === 0, "grew with nothing");
	ok(
		nextStage(0, 0, { shallowCleared: true, topCleared: false }) === 1,
		"the beginner clear did not open the stall",
	);
	ok(nextStage(1, 999999, none) === 2, "grew more than one stage at once");
	ok(nextStage(3, STAGE_POINTS[4], none) === 4, "did not reach the storehouse");
	ok(
		nextStage(2, 0, { shallowCleared: false, topCleared: true }) ===
			TOWN_STAGES - 1,
		"the deep clear did not jump to the top",
	);
	ok(nextStage(5, 0, none) === 5, "the town shrank");
	ok(
		STORAGE_CAP[3] === 0 && STORAGE_CAP[4] > 0 && CARRY_MAX[4] === 1,
		"storage opens at stage 4 with carry 1",
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

test("the first shallow clear on a new profile opens the stall (0 → 1)", () => {
	withStorage(() => {
		loadProgress();
		const run = Run.create("first-clear", "shallow");
		run.finish("clear", "試験");
		saveRun(run.s);
		const r = settleReturn(loadTown(), []);
		ok(r.from === 0 && r.to === 1, `settled ${r.from} → ${r.to}`);
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

test("a boss run's record and replay keep the objective; replays without it (old, shared) read as fetch", () => {
	withStorage(() => {
		loadProgress();
		const boss = Run.create("boss-record", "kinoko", [], "boss");
		boss.act({ c: "wait" });
		boss.finish("clear", "親玉きのにゃんを　たおした");
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
		ok(
			loadProgress().unlocked.includes("main"),
			"the main dungeon closed again",
		);
	}, false);
});

test("the last posts lie on real floors of the colonies (not the main board), fit the log, and are picked once per run", () => {
	const ids = new Set<string>();
	for (const r of LAST_RES) {
		ok(!ids.has(r.id), `two last posts share the id ${r.id}`);
		ids.add(r.id);
		ok(r.dungeon !== "main", `${r.id}: the main board keeps its parity runs`);
		const d = dungeonById(r.dungeon);
		ok(r.depth >= 2 && r.depth < d.floors, `${r.id}: depth ${r.depth} of ${d.floors}`);
		ok([...r.text].length <= 20, `${r.id}: "${r.text}" is too long for one log line`);
		// その 階に 着くと 1回だけ 拾う（同じ 冒険で もう一度 着いても ふえない）
		const run = Run.create(`lastres-${r.id}`, r.dungeon);
		run.enterFloor(r.depth, false);
		ok(run.s.lastRes?.includes(r.id), `${r.id}: not picked on B${r.depth}`);
		ok(
			run.s.log.some((l) => l.includes(r.text)),
			`${r.id}: the post is not in the log`,
		);
		run.enterFloor(r.depth, false);
		ok(run.s.lastRes?.length === 1, `${r.id}: picked twice`);
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
