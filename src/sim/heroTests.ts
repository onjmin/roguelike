// 冒険に 出る 主人公（束音ロゼ・解音ゼロ。core/data/heroes.ts・engine/heroes.ts・data/people/heroQuests.ts）の 試験（pnpm test）。

import { HUNGER_MAX, START_HP, START_STR } from "../core/balance";
import { DUNGEONS } from "../core/data/dungeons";
import { WALL_HUNGER, ZERO_BODIES } from "../core/data/heroes";
import { spawnMonster } from "../core/floor";
import { DIRS8, type Dir8, isDiagonal, type Pos, step } from "../core/geom";
import { roomExits, T_WALL, tileAt } from "../core/mapgen";
import { DASH, RACE, rivalOn } from "../core/race";
import { decodeCmd, encodeCmd } from "../core/replay";
import { Run } from "../core/run";
import { deserializeRun, serializeRun } from "../core/serial";
import type { RunState } from "../core/types";
import { CARRY_KM, HERO_QUESTS, questText } from "../data/people/heroQuests";
import { synopsisHtml } from "../data/story/synopsis";
import type { Story } from "../engine/defs";
import {
	acceptQuest,
	chooseHero,
	chosenHero,
	forgetHeroMemo,
	noteHeroQuests,
	questAmbush,
	questRace,
	questStage,
	rollHeroWorries,
	takeWorryNews,
	unlockedHeroes,
	WORRY_SURE,
} from "../engine/heroes";
import { forgetProgressMemo, loadProgress, saveProgress } from "../engine/save";
import { heroQuestScript } from "../ui/village/villageEvents";
import { villageSong } from "../ui/village/villageMusic";
import { AUTO_BOT, type BotOpts, botCommand, DEFAULT_BOT } from "./bot";
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

	const r = quiet(Run.create("hero-a", "shallow", [], "fetch", true, "roze"));
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
	const r = quiet(Run.create("hero-b", "shallow", [], "fetch", true, "roze"));
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
	const r = quiet(Run.create("hero-c", "shallow", [], "fetch", true, "roze"));
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
	const k = quiet(Run.create("hero-c", "shallow", [], "fetch", true, "roze"));
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

test("ゼロ: 3機とも キリコより はっきり 低い、たおれると 次の 機体に バトンタッチ（持ち物・レベルは そのまま、のびた ぶんも そのまま、おなかは 満タン）", () => {
	ok(ZERO_BODIES.length === 3, "3 bodies");
	ok(
		ZERO_BODIES.map((b) => b.model).join() === "VHz8-0,HeBc-0,XQxS-0",
		"order",
	);
	for (const b of ZERO_BODIES)
		ok(
			b.hp <= START_HP - 4 && b.str <= START_STR - 2,
			`${b.model} is clearly weaker`,
		);
	const r = quiet(Run.create("hero-z", "shallow", [], "fetch", true, "zero"));
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
		`hp: all of the growth (${grown}) → ${r.p.maxHp}`,
	);
	ok(r.p.str === r.p.maxStr && r.p.status.confuse === 0, "reset");
	ok(r.p.hunger === HUNGER_MAX, "fed: a different body");
	ok(r.p.lv === lv && r.p.items.map((i) => i.uid).join() === items, "kept");
	ok(
		r.ev.some((e) => e.t === "baton" && e.body === 1),
		"baton event",
	);
	ok(
		r.s.log.some((l) => l.includes("ゼロはたおれた")),
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

test("ゼロ: オートは 階段を 見たら 降りる（階を 見つくすまで うろうろ しない。道が まだ わからなければ 探す）", () => {
	const AUTO = { ...DEFAULT_BOT, escape: false, stairsWhenSeen: true };
	let auto = 0;
	let full = 0;
	for (const seed of ["auto-0", "auto-1", "auto-2", "auto-3"]) {
		// 階段だけ 見えている（地図スレで 見た ような。道は まだ わからない）
		const leaveTurns = (opts: BotOpts): number => {
			const r = quiet(Run.create(seed, "main", [], "fetch", true, "zero"));
			const f = r.f;
			f.seen[f.stairs.y * f.layout.w + f.stairs.x] = 1;
			let n = 0;
			while (r.s.depth === 1 && !r.s.end && n < 2000) {
				r.act(botCommand(r, opts));
				n++;
			}
			ok(r.s.depth === 2, `${seed}: left the floor (${n})`);
			return n;
		};
		auto += leaveTurns(AUTO);
		full += leaveTurns(DEFAULT_BOT);
	}
	ok(auto * 2 < full, `auto ${auto} vs full ${full}`);
});

test("ゼロ: オートは 部屋で 2体に はさまれたら 入口（通路）へ 下がって 待つ（1体なら そのまま なぐる）", () => {
	// 上の 壁に 入口の ある 部屋。入口の 前の 床に 立ち、左右に 敵
	const setup = (seed: string) => {
		const r = quiet(Run.create(seed, "main", [], "fetch", true, "zero"));
		const l = r.f.layout;
		for (const room of l.rooms) {
			if (room.h < 2) continue;
			const ex = roomExits(l, room).find(
				(e) => e.y === room.y - 1 && e.x > room.x && e.x < room.x + room.w - 1,
			);
			if (ex) return { r, ex, at: { x: ex.x, y: room.y } };
		}
		return null;
	};
	let checked = 0;
	for (const seed of ["choke-0", "choke-1", "choke-2", "choke-3", "choke-4"]) {
		const s = setup(seed);
		if (!s) continue;
		const { r, ex, at } = s;
		r.f.seen.fill(1);
		place(r, at);
		const a = spawnMonster(
			r,
			"kaze",
			{ x: at.x - 1, y: at.y },
			{ awake: true },
		);
		ok(a, `${seed}: spawn a`);
		// 1体だけ：下がらずに なぐる
		const one = botCommand(r, AUTO_BOT);
		ok(one.c === "attack", `${seed}: one foe → ${one.c}`);
		const b = spawnMonster(
			r,
			"kaze",
			{ x: at.x + 1, y: at.y },
			{ awake: true },
		);
		ok(b, `${seed}: spawn b`);
		// sim の ボット（入口へ 下がるのは となりの 敵が 1体 まで）は その場で なぐる
		ok(
			botCommand(r, DEFAULT_BOT).c === "attack",
			`${seed}: default bot fights in place`,
		);
		const cmd = botCommand(r, AUTO_BOT);
		ok(
			cmd.c === "move" &&
				step(r.p, cmd.dir).x === ex.x &&
				step(r.p, cmd.dir).y === ex.y,
			`${seed}: auto steps into the doorway (${JSON.stringify(cmd)})`,
		);
		r.act(cmd);
		ok(r.p.x === ex.x && r.p.y === ex.y, `${seed}: in the doorway`);
		// 入口では 部屋の 中から まっすぐ 1体 しか なぐれない。敵が 来なくても すぐには 部屋へ もどらない
		r.f.monsters = [];
		ok(botCommand(r, AUTO_BOT).c === "wait", `${seed}: holds the doorway`);
		checked++;
	}
	ok(checked >= 2, `checked ${checked}`);
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
			if (k === "bgm")
				return (name: string | null) => {
					log.push(`bgm: ${name}`);
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
		p.cleared = ["shallow", "kinoko", "tropical"];
		saveProgress({ ...loadProgress(), cleared: p.cleared });
		ok(rollHeroWorries(always) === null, "one at a time");
		ok(questStage("zero") === "none", "zero waits");
	});
});

test("競争: 挑戦 → 受ける → 避難所が 開く → 持ち帰る → 申し出 → ロゼを 選べる", async () => {
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
		ok(questRace("kiriko") === null, "no race before the challenge");
		// 受けて立つ → ボカロ作り避難所が 開く（キリコで 潜ると ロゼも 潜る）
		r = recorder([0]);
		await heroQuestScript(r.s, "roze");
		ok(questStage("roze") === "accepted", "accepted");
		ok(questRace("kiriko") === "roze", "race after the challenge");
		ok(questRace("zero") === null, "no race for ゼロ");
		ok(loadProgress().unlocked.includes("vocalo"), "vocalo opens");
		ok(DUNGEONS.vocalo.goal === "oto_ini", "the goal is roze's setting");
		ok(DUNGEONS.vocalo.hidden, "vocalo shows before the quest");
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
		ok(
			r.log.at(-2) === `narrate: ${HERO_QUESTS.roze.unlocked}`,
			`news: ${r.log.at(-2)}`,
		);
		// 申し出の「あ」は 曲を 止めて 聞かせ、終われば 村の 曲
		ok(r.log[0] === "bgm: null", `silence first: ${r.log[0]}`);
		ok(r.log.at(-1) === `bgm: ${villageSong()}`, "back to the village song");
		ok(unlockedHeroes().join() === "kiriko,roze", "list");
		ok(chosenHero() === "roze", "remembered choice");
		// そのあとは ふだんの ひとこと
		ok(!(await heroQuestScript(recorder().s, "roze")), "normal talk");
		// ロゼが 片づいたので、3つ 持ち帰って いれば ゼロが 悩む（プロト・レンは パン板で 帰ってきて いる）
		saveProgress({
			...loadProgress(),
			cleared: ["shallow", "kinoko", "tropical"],
		});
		ok(rollHeroWorries(() => 0) === "zero", "zero next");
	});
});

test("挑戦: ゼロの 3機を 深い 階で そろって 止めると 申し出（倒れても 勝ちは 残る。待ちぶせは キリコだけ）", async () => {
	await withStore(async () => {
		const p = loadProgress();
		p.cleared = ["shallow", "kinoko", "tropical"];
		saveProgress(p);
		ok(questAmbush("kiriko") === null, "no ambush before the challenge");
		acceptQuest("zero");
		ok(questAmbush("kiriko") === "zero", "ambush after the challenge");
		ok(questAmbush("roze") === null, "no ambush for ロゼ");
		noteHeroQuests(ended("main", "escape", 12));
		ok(questStage("zero") === "accepted", "deep but no win");
		const won = ended("main", "dead", 9);
		won.ambushWon = true;
		noteHeroQuests(won);
		ok(questStage("zero") === "done", "done");
		const r = recorder();
		await heroQuestScript(r.s, "zero");
		ok(questStage("zero") === "unlocked", "unlocked");
		// 蓄音機から 掘りかけの穴、終われば 村の 曲
		ok(
			r.log[0] === "bgm: deep1" && r.log[1].includes("蓄音機を回した"),
			`record: ${r.log.slice(0, 2)}`,
		);
		ok(r.log.at(-1) === `bgm: ${villageSong()}`, "back to the village song");
		ok(unlockedHeroes().includes("zero"), "zero");
	});
});

// ───────── 競争（core/race.ts）。ロゼの 挑戦を 受けた 冒険 ─────────

/** 避難所の 底に 着いた 冒険。 */
const raceRun = (seed: string, race = true): Run => {
	const r = Run.create(
		seed,
		"vocalo",
		[],
		"fetch",
		true,
		"kiriko",
		null,
		null,
		race ? "roze" : null,
	);
	r.ev = [];
	r.enterFloor(r.dungeon.floors, false);
	return r;
};

test("競争: 底では 先に 着いた ロゼが 原音設定の となりに 立ちつくし、着くと 掛け合い。拾うと 壁の 向こうへ 帰る", () => {
	ok(
		!Run.create(
			"race-x",
			"main",
			[],
			"fetch",
			true,
			"kiriko",
			null,
			null,
			"roze",
		).s.race,
		"race on another board",
	);
	const plain = raceRun("race-0", false);
	ok(!plain.f.folk?.length, "ロゼ without the challenge");
	for (const seed of ["race-1", "race-2", "race-3", "race-4"]) {
		const r = raceRun(seed);
		ok(r.s.race === "roze", `${seed}: race`);
		const goal = r.f.items.find((x) => x.item.kind === "oto_ini");
		if (!goal) throw new Fail(`${seed}: no goal`);
		const roze = r.f.folk?.find((x) => x.name === "ロゼ");
		if (!roze) throw new Fail(`${seed}: no ロゼ`);
		ok(
			Math.max(Math.abs(roze.x - goal.x), Math.abs(roze.y - goal.y)) === 1,
			`${seed}: ロゼ is not next to the setting`,
		);
		ok(
			(r.f.statues ?? []).includes(roze.y * r.f.layout.w + roze.x),
			`${seed}: ロゼ can be walked through`,
		);
		const talk = r.ev.find((e) => e.t === "talk");
		ok(
			talk?.t === "talk" &&
				talk.name === "ロゼ" &&
				talk.talk.length === RACE.roze.arrive.length,
			`${seed}: no arrival talk`,
		);
		// 拾う：掛け合いの あと ロゼは いなく なり、帰り道に なる
		r.ev = [];
		r.p.x = goal.x;
		r.p.y = goal.y;
		r.afterStep(false);
		ok(r.s.returning, `${seed}: not returning`);
		ok(
			r.ev.some(
				(e) =>
					e.t === "talk" &&
					e.talk.length === RACE.roze.carried.length &&
					e.talk[0] === RACE.roze.carried[0],
			),
			`${seed}: no carried talk`,
		);
		ok(!r.f.folk?.some((x) => x.name === "ロゼ"), `${seed}: ロゼ stays`);
		ok(
			!(r.f.statues ?? []).includes(roze.y * r.f.layout.w + roze.x),
			`${seed}: ロゼ's tile stays blocked`,
		);
		// 中断セーブを はさんでも 競争は 残る
		ok(deserializeRun(serializeRun(r.s)).race === "roze", `${seed}: save`);
	}
});

test("競争: 1階では ロゼが キリコの となりから 壁を 抜けて 階段へ 走り（追いつけない）、先に 降りる。2階から 底の 手前までは いない", () => {
	const plain = Run.create("race-d0", "vocalo");
	ok(!plain.f.folk?.length, "ロゼ on B1 without the challenge");
	for (const seed of ["race-d1", "race-d2", "race-d3"]) {
		const r = Run.create(
			seed,
			"vocalo",
			[],
			"fetch",
			true,
			"kiriko",
			null,
			null,
			"roze",
		);
		const roze = rivalOn(r);
		if (!roze) throw new Fail(`${seed}: no ロゼ on B1`);
		ok(
			Math.max(Math.abs(roze.x - r.p.x), Math.abs(roze.y - r.p.y)) === 1,
			`${seed}: ロゼ is not next to キリコ`,
		);
		const far = (p: Pos) =>
			Math.max(Math.abs(p.x - r.f.stairs.x), Math.abs(p.y - r.f.stairs.y));
		// キリコより 階段に 1マス 近い 所から 走りだす（1マスずつでも 追いつけない）
		ok(
			far(roze) === far(r.p) - 1,
			`${seed}: ロゼ starts no closer than キリコ`,
		);
		r.ev = [];
		let talked = false;
		let turns = 0;
		while (rivalOn(r) && turns < 200) {
			const before = far(roze);
			r.p.hunger = HUNGER_MAX;
			r.f.monsters = [];
			r.act({ c: "wait" });
			turns++;
			if (r.ev.some((e) => e.t === "talk" && e.name === "ロゼ")) talked = true;
			if (rivalOn(r))
				ok(
					far(roze) <= Math.max(0, before - DASH) || far(roze) === 0,
					`${seed}: too slow`,
				);
		}
		ok(!rivalOn(r), `${seed}: ロゼ never went down`);
		ok(talked, `${seed}: no start talk`);
		// 2階から 底の 手前までは いない
		for (let d = 2; d < r.dungeon.floors; d++) {
			r.enterFloor(d, false);
			ok(!rivalOn(r), `${seed}: ロゼ on B${d}`);
		}
	}
});

test("持ちかけ: ロゼは 運ばれた 本当の 回数と のべの 距離を 言う（0回なら 別の 文）。ゼロと 型を 分ける", () => {
	const lines = HERO_QUESTS.roze.worry;
	const at3 = lines.map((l) => questText(l, 3)).join("|");
	ok(
		at3.includes("通算3回") &&
			at3.includes(`のべ${(3 * CARRY_KM).toFixed(1)}キロ`),
		at3,
	);
	const at0 = lines.map((l) => questText(l, 0)).join("|");
	ok(!at0.includes("通算0回") && !at0.includes("{"), at0);
	for (const h of ["roze", "zero"] as const)
		for (const part of [
			"worry",
			"accept",
			"decline",
			"waiting",
			"offer",
		] as const)
			for (const l of HERO_QUESTS[h][part])
				for (const t of [questText(l, 0), questText(l, 12)])
					for (const ln of t.split("\n"))
						ok(width(ln) <= 22, `${h}.${part}: long line ${ln}`);
	// 2人の 型を 分ける：ようす・えらぶ 字・受けた ときの 1窓目
	ok(HERO_QUESTS.roze.hint !== HERO_QUESTS.zero.hint, "same hint");
	ok(HERO_QUESTS.roze.menu[0] !== HERO_QUESTS.zero.menu[0], "same menu");
	ok(
		HERO_QUESTS.roze.accept[0].text !== HERO_QUESTS.zero.accept[0].text,
		"same accept",
	);
	// 潜るのは 交代（キリコは 村に 残る）なので「いっしょに 潜る」とは 言わない
	for (const h of ["roze", "zero"] as const)
		ok(
			!HERO_QUESTS[h].offer.some((l) => l.text.includes("いっしょに")),
			`${h}: いっしょに潜る`,
		);
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
		ok(html.includes("仲間の話"), `${st} section`);
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
	// 底の 掛け合い（core/race.ts。ダンジョンの 窓も 村と 同じ）
	for (const [id, sp] of Object.entries(RACE))
		for (const talk of [sp.arrive, sp.carried, ...sp.stuck])
			for (const l of talk)
				fits(`race.${id}`, typeof l === "string" ? l : l.kiriko);
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
