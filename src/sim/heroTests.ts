// 冒険に 出る 主人公（束音ロゼ・解音ゼロ。core/data/heroes.ts・engine/heroes.ts・data/heroQuests.ts）の 試験（pnpm test）。

import { HUNGER_MAX, START_HP, START_STR } from "../core/balance";
import { DUNGEONS } from "../core/data/dungeons";
import { WALL_HUNGER, ZERO_BODIES } from "../core/data/heroes";
import { spawnMonster } from "../core/floor";
import { DIRS8, type Dir8, isDiagonal, type Pos, step } from "../core/geom";
import { T_WALL, tileAt } from "../core/mapgen";
import { decodeCmd, encodeCmd } from "../core/replay";
import { Run } from "../core/run";
import { deserializeRun, serializeRun } from "../core/serial";
import type { RunState } from "../core/types";
import { HERO_QUESTS } from "../data/heroQuests";
import { synopsisHtml } from "../data/synopsis";
import type { Story } from "../engine/defs";
import {
	acceptQuest,
	chooseHero,
	chosenHero,
	forgetHeroMemo,
	noteHeroQuests,
	questStage,
	rollHeroWorries,
	takeWorryNews,
	unlockedHeroes,
	WORRY_SURE,
	ZERO_QUEST_DEPTH,
} from "../engine/heroes";
import { forgetProgressMemo, loadProgress, saveProgress } from "../engine/save";
import { heroQuestScript } from "../ui/villageEvents";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};
const CASES: { name: string; run: () => void | Promise<void> }[] = [];
const test = (name: string, run: () => void | Promise<void>) =>
	CASES.push({ name, run });

const width = (s: string) =>
	[...s].reduce((n, c) => n + (/[\x20-\x7e｡-ﾟ]/.test(c) ? 0.5 : 1), 0);
const fits = (where: string, s: string, w = 22, lines = 2) => {
	const ls = s.split("\n");
	ok(ls.length <= lines, `${where}: ${ls.length} lines`);
	for (const l of ls) ok(width(l) <= w, `${where}: "${l}" is ${width(l)} wide`);
};

/** 敵を 消して、静かな 状態に（湧き・地震・空腹を 止める）。 */
const quiet = (r: Run): Run => {
	r.f.monsters = [];
	r.f.traps = [];
	r.f.items = [];
	r.f.turns = 0;
	r.f.res = 0;
	r.ev = [];
	return r;
};

/** 床から となりの 壁（いちばん 外では ない）へ 入れる 所を さがす。 */
const wallBeside = (r: Run): { from: Pos; d: Dir8; to: Pos } => {
	const l = r.f.layout;
	for (let y = 2; y < l.h - 2; y++)
		for (let x = 2; x < l.w - 2; x++) {
			if (tileAt(l, x, y) === T_WALL) continue;
			for (const d of DIRS8) {
				if (isDiagonal(d)) continue;
				const to = step({ x, y }, d);
				if (
					tileAt(l, to.x, to.y) === T_WALL &&
					to.x > 1 &&
					to.y > 1 &&
					to.x < l.w - 2 &&
					to.y < l.h - 2 &&
					!(r.f.statues ?? []).includes(to.y * l.w + to.x)
				)
					return { from: { x, y }, d, to };
			}
		}
	throw new Fail("no wall beside a floor");
};

const place = (r: Run, at: Pos): void => {
	r.p.x = at.x;
	r.p.y = at.y;
};

// ───────────────── 束音ロゼ ─────────────────

test("ロゼ: 壁に 入れる（キリコは 入れない）、いちばん 外の 壁には 入れない", () => {
	const kiri = quiet(Run.create("hero-a", "shallow"));
	const w = wallBeside(kiri);
	place(kiri, w.from);
	kiri.act({ c: "move", dir: w.d });
	ok(kiri.p.x === w.from.x && kiri.p.y === w.from.y, "kiriko bumps");
	ok(!kiri.playerInWall(), "kiriko never in a wall");

	const r = quiet(
		Run.create("hero-a", "shallow", [], "fetch", true, false, "roze"),
	);
	ok(r.s.hero === "roze" && r.heroName === "ロゼ", "hero");
	const v = wallBeside(r);
	place(r, v.from);
	// すり抜けが OFF（はじめ）なら 壁に ぶつかる
	ok(!r.phasing, "starts off");
	r.act({ c: "move", dir: v.d });
	ok(r.p.x === v.from.x && r.p.y === v.from.y, "off: bumps");
	// ON に して 動くと 入る（切りかえは 時間が 進まない）
	const turn = r.s.turn;
	r.act({ c: "phase" });
	ok(r.phasing && r.s.turn === turn, "toggle is free");
	r.act({ c: "move", dir: v.d });
	ok(r.p.x === v.to.x && r.p.y === v.to.y && r.playerInWall(), "roze walks in");
	// 壁の 中では OFF に できない
	r.act({ c: "phase" });
	ok(r.phasing, "cannot turn off in a wall");
	// 床に もどって OFF
	r.act({ c: "move", dir: ((v.d + 4) % 8) as Dir8 });
	r.act({ c: "phase" });
	ok(!r.phasing && !("phase" in r.s), "off again");
	r.s.phase = true;
	const l = r.f.layout;
	ok(!r.playerCanEnter(0, 1) && !r.playerCanEnter(l.w - 1, 2), "outer wall");
	ok(!r.playerCanEnter(1, 0), "outer row");
});

test("ロゼ: 壁の 中では 1ターンごとに おなかが 5% 減る（床では ふつう）、帰り道でも 減る", () => {
	const r = quiet(
		Run.create("hero-b", "shallow", [], "fetch", true, false, "roze"),
	);
	r.s.phase = true;
	const v = wallBeside(r);
	place(r, v.to);
	r.p.hunger = HUNGER_MAX;
	r.act({ c: "wait" });
	ok(r.p.hunger === HUNGER_MAX - WALL_HUNGER, `wall ${r.p.hunger}`);
	r.s.returning = true;
	r.act({ c: "wait" });
	ok(r.p.hunger === HUNGER_MAX - 2 * WALL_HUNGER, `returning ${r.p.hunger}`);
	r.s.returning = false;
	place(r, v.from);
	const before = r.p.hunger;
	r.act({ c: "wait" });
	ok(before - r.p.hunger === 2, `floor ${before - r.p.hunger}`);
	// 壁の 中では 置けない
	place(r, v.to);
	const it = r.p.items[0];
	if (it) {
		r.act({ c: "drop", item: it.uid });
		ok(r.p.items.includes(it), "cannot drop in a wall");
	}
});

test("ロゼ: 壁の 中の ロゼを 敵は なぐれない（床に 出ると なぐられる）", () => {
	const r = quiet(
		Run.create("hero-c", "shallow", [], "fetch", true, false, "roze"),
	);
	r.s.phase = true;
	const v = wallBeside(r);
	place(r, v.to);
	const m = spawnMonster(r, "bat", v.from, { awake: true });
	ok(m, "spawn");
	const hp = r.p.hp;
	for (let i = 0; i < 20; i++) {
		r.f.turns = 0;
		r.f.res = 0;
		r.p.hunger = HUNGER_MAX;
		place(r, v.to);
		r.act({ c: "wait" });
	}
	ok(r.p.hp === hp && !r.s.end, `safe in a wall (${hp} → ${r.p.hp})`);
	// 床に 出て となりに 敵 → いずれ なぐられる
	const k = quiet(
		Run.create("hero-c", "shallow", [], "fetch", true, false, "roze"),
	);
	const w = wallBeside(k);
	place(k, w.from);
	const m2 = spawnMonster(
		k,
		"bat",
		w.to.x === w.from.x
			? { x: w.from.x + 1, y: w.from.y }
			: { x: w.from.x, y: w.from.y + 1 },
		{ awake: true },
	);
	if (m2 && tileAt(k.f.layout, m2.x, m2.y) !== T_WALL) {
		let hurt = false;
		for (let i = 0; i < 30 && !hurt; i++) {
			k.f.turns = 0;
			k.f.res = 0;
			k.p.hunger = HUNGER_MAX;
			k.p.hp = k.p.maxHp;
			hurt = k
				.act({ c: "wait" })
				.some((e) => (e.t === "hurt" || e.t === "miss") && e.id === 0);
		}
		ok(hurt, "attacked on the floor");
	}
});

test("ロゼ: すり抜けの 切りかえは リプレイに 残る（キリコでは 何も しない）", () => {
	ok(encodeCmd({ c: "phase" }) === "P", "encode");
	ok(decodeCmd("P")?.c === "phase", "decode");
	const k = Run.create("hero-k2", "shallow");
	k.act({ c: "phase" });
	ok(!k.s.phase && !k.phasing, "kiriko");
});

// ───────────────── 解音ゼロ ─────────────────

test("ゼロ: 3機とも キリコより やや 低い、たおれると 次の 機体に バトンタッチ（持ち物・レベルは そのまま）", () => {
	ok(ZERO_BODIES.length === 3, "3 bodies");
	ok(
		ZERO_BODIES.map((b) => b.model).join() === "VHz8-0,HeBc-0,XQxS-0",
		"order",
	);
	for (const b of ZERO_BODIES)
		ok(
			b.hp <= START_HP &&
				b.str <= START_STR &&
				b.hp + b.str < START_HP + START_STR,
			`${b.model} is a bit weaker`,
		);
	const r = quiet(
		Run.create("hero-z", "shallow", [], "fetch", true, false, "zero"),
	);
	ok(
		r.p.maxHp === ZERO_BODIES[0]?.hp && r.p.str === ZERO_BODIES[0]?.str,
		"start",
	);
	const items = r.p.items.map((i) => i.uid).join();
	r.gainExp(100);
	const lv = r.p.lv;
	const grown = r.p.maxHp - (ZERO_BODIES[0]?.hp ?? 0);
	r.p.status.confuse = 5;
	r.p.str = 1;
	r.p.hunger = 10;
	ok(!r.hurtPlayer(999, "test"), "not dead");
	ok(!r.s.end && r.s.body === 1 && r.heroName === "プロト", "proto");
	ok(
		r.p.hp === r.p.maxHp && r.p.maxHp === (ZERO_BODIES[1]?.hp ?? 0) + grown,
		"hp",
	);
	ok(r.p.str === r.p.maxStr && r.p.status.confuse === 0, "reset");
	ok(r.p.hunger === HUNGER_MAX, "fed");
	ok(r.p.lv === lv && r.p.items.map((i) => i.uid).join() === items, "kept");
	ok(
		r.ev.some((e) => e.t === "baton" && e.body === 1),
		"baton event",
	);
	ok(
		r.s.log.some((l) => l.includes("ゼロは　たおれた")),
		"log name",
	);
	// 中断して 読みなおしても 機体は 同じ
	const back = new Run(deserializeRun(serializeRun(r.s)));
	ok(back.s.body === 1 && back.heroName === "プロト", "saved body");
	r.hurtPlayer(999, "test");
	ok(r.s.body === 2 && r.heroName === "レン" && !r.s.end, "ren");
	ok(r.hurtPlayer(999, "最後"), "the last one falls");
	ok(r.s.end?.kind === "dead", "dead");
});

test("主人公: キリコの 冒険は 前と 同じ 形（hero・body を 書かない）、名前は キリコ", () => {
	const r = Run.create("hero-k", "shallow");
	ok(!("hero" in r.s) && !("body" in r.s), "no fields");
	ok(r.heroName === "キリコ" && !r.wallWalker, "kiriko");
	ok(r.p.maxHp === START_HP && r.p.str === START_STR, "stats");
});

// ───────────────── 依頼と 解放 ─────────────────

const withStore = async (run: () => Promise<void> | void): Promise<void> => {
	const store = new Map<string, string>();
	const prev = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => {
				store.set(k, v);
			},
			removeItem: (k: string) => {
				store.delete(k);
			},
			key: (i: number) => [...store.keys()][i] ?? null,
			get length() {
				return store.size;
			},
		},
		configurable: true,
		writable: true,
	});
	forgetProgressMemo();
	forgetHeroMemo();
	try {
		await run();
	} finally {
		forgetProgressMemo();
		forgetHeroMemo();
		if (prev) Object.defineProperty(globalThis, "localStorage", prev);
		else delete (globalThis as { localStorage?: unknown }).localStorage;
	}
};

const recorder = (picks: number[] = []) => {
	const log: string[] = [];
	const s = new Proxy({} as Story, {
		get: (_t, k) => {
			if (k === "narrate")
				return async (t: string) => {
					log.push(`narrate: ${t}`);
				};
			if (k === "say")
				return async (who: string, t: string) => {
					log.push(`say(${who}): ${t}`);
				};
			if (k === "kiriko")
				return async (t: string) => {
					log.push(`kiriko: ${t}`);
				};
			if (k === "choose")
				return async (opts: string[]) => {
					log.push(`choose: ${opts.join("/")}`);
					return picks.shift() ?? opts.length - 1;
				};
			if (k === "then") return undefined;
			return () => undefined;
		},
	});
	return { s, log };
};

const ended = (
	dungeon: RunState["dungeon"],
	kind: "clear" | "dead" | "escape",
	maxDepth: number,
): RunState => {
	const r = Run.create("hero-q", dungeon);
	r.s.end = { kind, cause: "", depth: maxDepth, turn: 1 };
	r.s.stats.maxDepth = maxDepth;
	return r.s;
};

test("悩み: パン板の あと もう 少し 先から、帰る たびに 1/3（4回目には 必ず）、1人ずつ、村で ひとこと", async () => {
	await withStore(async () => {
		const never = () => 0.99;
		const always = () => 0;
		// パン板だけでは まだ（ロゼは 2つ、ゼロは 3つ）
		const p = loadProgress();
		p.cleared = ["shallow"];
		saveProgress(p);
		ok(rollHeroWorries(always) === null, "too early");
		ok(!(await heroQuestScript(recorder().s, "roze")), "normal talk");
		p.cleared = ["shallow", "kinoko"];
		saveProgress(p);
		// はずれ 3回 → 4回目は 必ず
		for (let i = 0; i < WORRY_SURE - 1; i++)
			ok(rollHeroWorries(never) === null, `miss ${i}`);
		ok(rollHeroWorries(never) === "roze", "sure");
		ok(questStage("roze") === "asked", "asked");
		ok(takeWorryNews() === "roze" && takeWorryNews() === null, "news once");
		// 1人ずつ：ロゼが 片づくまで ゼロは 悩まない（3つ 持ち帰っていても）
		p.cleared = ["shallow", "kinoko", "isle1"];
		saveProgress({ ...loadProgress(), cleared: p.cleared });
		ok(rollHeroWorries(always) === null, "one at a time");
		ok(questStage("zero") === "none", "zero waits");
	});
});

test("依頼: 悩み → 引き受ける → 避難所が 開く → 持ち帰る → 申し出 → ロゼを 選べる", async () => {
	await withStore(async () => {
		const p = loadProgress();
		p.cleared = ["shallow", "kinoko"];
		saveProgress(p);
		rollHeroWorries(() => 0);
		// そっとしておく（悩みは そのまま）
		let r = recorder([1]);
		ok(await heroQuestScript(r.s, "roze"), "worry");
		ok(questStage("roze") === "asked", "declined");
		ok(!loadProgress().unlocked.includes("vocalo"), "not yet open");
		// 引き受ける → ボカロ作り避難所が 開く
		r = recorder([0]);
		await heroQuestScript(r.s, "roze");
		ok(questStage("roze") === "accepted", "accepted");
		ok(loadProgress().unlocked.includes("vocalo"), "vocalo opens");
		ok(DUNGEONS.vocalo.goal === "oto_ini", "the goal is roze's setting");
		// 名前を 伏せる「南西の 小島・小舟」（裏の 小島の 見せ方）には しない
		ok(!DUNGEONS.vocalo.quiet && DUNGEONS.vocalo.hidden, "not a quiet islet");
		ok(!loadProgress().news.some((n) => n.dungeon === "vocalo"), "no news");
		// ほかの 板・倒れたら まだ
		noteHeroQuests(ended("shallow", "clear", 4));
		noteHeroQuests(ended("vocalo", "dead", 6));
		ok(questStage("roze") === "accepted", "not yet");
		ok(chosenHero() === "kiriko", "still kiriko");
		chooseHero("roze");
		ok(chosenHero() === "kiriko", "locked hero falls back");
		noteHeroQuests(ended("vocalo", "clear", 6));
		ok(questStage("roze") === "done", "done");
		r = recorder();
		await heroQuestScript(r.s, "roze");
		ok(questStage("roze") === "unlocked", "unlocked");
		ok(r.log.at(-1) === `narrate: ${HERO_QUESTS.roze.unlocked}`, "news");
		ok(unlockedHeroes().join() === "kiriko,roze", "list");
		ok(chosenHero() === "roze", "remembered choice");
		// そのあとは ふだんの ひとこと
		ok(!(await heroQuestScript(recorder().s, "roze")), "normal talk");
		// ロゼが 片づいたので、3つ 持ち帰って いれば ゼロが 悩む
		saveProgress({
			...loadProgress(),
			cleared: ["shallow", "kinoko", "isle1"],
		});
		ok(rollHeroWorries(() => 0) === "zero", "zero next");
	});
});

test(`依頼: ゼロは どの 板でも ${ZERO_QUEST_DEPTH}階まで 行って 生きて 帰ると 申し出`, async () => {
	await withStore(async () => {
		const p = loadProgress();
		p.cleared = ["shallow", "kinoko", "isle1"];
		saveProgress(p);
		acceptQuest("zero");
		noteHeroQuests(ended("main", "dead", 12));
		noteHeroQuests(ended("main", "escape", ZERO_QUEST_DEPTH - 1));
		ok(questStage("zero") === "accepted", "not yet");
		noteHeroQuests(ended("main", "escape", ZERO_QUEST_DEPTH));
		ok(questStage("zero") === "done", "done");
		const r = recorder();
		await heroQuestScript(r.s, "zero");
		ok(questStage("zero") === "unlocked", "unlocked");
		ok(unlockedHeroes().includes("zero"), "zero");
	});
});

test("あらすじ: 仲間の 依頼は 悩んで から 出る（進み具合ごとの 1行）", () => {
	const cl = ["shallow", "kinoko"] as RunState["dungeon"][];
	ok(!(synopsisHtml(cl, []) ?? "").includes("仲間の"), "before worry");
	for (const [flag, st] of [
		["q_roze_ask", "asked"],
		["q_roze", "accepted"],
		["q_roze_ok", "done"],
		["hero_roze", "unlocked"],
	] as const) {
		const html = synopsisHtml(cl, [flag]) ?? "";
		ok(html.includes("仲間の　依頼"), `${st} section`);
		ok(html.includes(HERO_QUESTS.roze.synopsis[st]), `${st} line`);
	}
	const both = synopsisHtml(cl, ["hero_roze", "q_zero"]) ?? "";
	ok(
		both.includes(HERO_QUESTS.roze.synopsis.unlocked) &&
			both.includes(HERO_QUESTS.zero.synopsis.accepted),
		"both",
	);
});

test("文: 依頼の 窓は 22×2、ボタンは 9字", () => {
	for (const [h, q] of Object.entries(HERO_QUESTS)) {
		for (const k of ["worry", "accept", "decline", "waiting", "offer"] as const)
			for (const l of q[k]) fits(`${h}.${k}`, l.text);
		fits(`${h}.unlocked`, q.unlocked);
		fits(`${h}.hint`, q.hint);
		for (const m of q.menu) ok(width(m) <= 9, `${h} menu ${m}`);
	}
});

export const runHeroTests = async (): Promise<TestResult[]> => {
	const out: TestResult[] = [];
	for (const c of CASES) {
		try {
			await c.run();
			out.push({ id: "hero", name: c.name, ok: true });
		} catch (e) {
			out.push({
				id: "hero",
				name: c.name,
				ok: false,
				reason: e instanceof Fail ? e.message : String(e),
			});
		}
	}
	return out;
};
