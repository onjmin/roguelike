// モンスターの特技と、その対策が本当に効くかの試験（pnpm test → scripts/test-monsters.mjs）。
//
// - 試験ごとに決まったシードで Run を作り、階を「大部屋ひとつ」に差しかえて、調べるモンスターだけを置く。
// - キリコの HP は大きくしておく（倒れると act が何もしなくなるので、倒れたら その試験は失敗）。
// - 確率で起きる特技は「N ターンのうちに 1回は起きた」、対策は「1回も起きなかった」で見る。
//   シードが決まっているので、結果は毎回同じ。
// - 湧きと地震は止める（毎ターン f.turns を 0 に戻す）。

import { ankaText, tickAnka } from "../core/anka";
import {
	attackPower,
	EXP_AT,
	HUNGER_MAX,
	rollDamage,
	SPAWN_EVERY,
} from "../core/balance";
import { DUNGEON_IDS, DUNGEONS } from "../core/data/dungeons";
import { MONSTER_LIST, MONSTERS, monstersFor } from "../core/data/monsters";
import { staffEffect } from "../core/effects";
import { spawnMonster } from "../core/floor";
import { canSee } from "../core/fov";
import {
	type Dir8,
	DX,
	DY,
	dirOf,
	dist,
	type Pos,
	samePos,
} from "../core/geom";
import { defOf, isKnownKind } from "../core/item";
import {
	bigRoomLayout,
	isFloor,
	type Layout,
	MAP_H,
	MAP_W,
	type Room,
	roomAt,
	T_CORR,
	T_ROOM,
	T_WALL,
} from "../core/mapgen";
import {
	mdef,
	monsterName,
	noticeAdjacent,
	posing,
	transformMonster,
	wakeMonster,
} from "../core/monster";
import { Run } from "../core/run";
import { deserializeRun, serializeRun } from "../core/serial";
import { triggerTrap } from "../core/traps";
import {
	type Ability,
	type AnkaKind,
	type Command,
	DEEP,
	DOZE,
	type DungeonId,
	type GameEvent,
	type Item,
	type Monster,
	type Objective,
	PLAYER_ID,
} from "../core/types";

// ───────────────── 試験の枠 ─────────────────

class Fail extends Error {}

function ok(cond: unknown, why: string): asserts cond {
	if (!cond) throw new Fail(why);
}

type Case = { id: string; name: string; run: () => void };
const CASES: Case[] = [];

const test = (id: string, name: string, run: () => void): void => {
	CASES.push({ id, name, run });
};

export type TestResult = {
	id: string;
	name: string;
	ok: boolean;
	reason?: string;
};

export const runMonsterTests = (): TestResult[] =>
	CASES.map((c) => {
		try {
			c.run();
			return { id: c.id, name: c.name, ok: true };
		} catch (e) {
			const reason =
				e instanceof Fail
					? e.message
					: e instanceof Error
						? (e.stack ?? e.message)
						: String(e);
			return { id: c.id, name: c.name, ok: false, reason };
		}
	});

// ───────────────── 場を作る ─────────────────

/** 大部屋の真ん中（大部屋は x 2〜51, y 2〜30）。 */
const CENTER: Pos = { x: 26, y: 16 };
/** 隠れ部屋つきの階でのキリコの位置。 */
const HIDE_AT: Pos = { x: 18, y: 16 };

const at = (dx: number, dy: number, o: Pos = CENTER): Pos => ({
	x: o.x + dx,
	y: o.y + dy,
});

/** 部屋だけの階（通路なし）。 */
const makeLayout = (rects: Omit<Room, "id">[]): Layout => {
	const l: Layout = {
		w: MAP_W,
		h: MAP_H,
		tiles: new Uint8Array(MAP_W * MAP_H),
		roomOf: new Int16Array(MAP_W * MAP_H).fill(-1),
		rooms: [],
	};
	rects.forEach((rc, id) => {
		const room: Room = { id, ...rc };
		l.rooms.push(room);
		for (let y = room.y; y < room.y + room.h; y++)
			for (let x = room.x; x < room.x + room.w; x++) {
				l.tiles[y * l.w + x] = T_ROOM;
				l.roomOf[y * l.w + x] = id;
			}
	});
	return l;
};

/**
 * 大きな部屋と、そこから見えない離れた部屋（つながっていない）。
 * 「キリコから見えない所へワープ」を確かめるのに使う（大部屋だけだと、どこも見えてしまう）。
 */
const hideoutLayout = (): Layout =>
	makeLayout([
		{ x: 2, y: 2, w: 34, h: 29 },
		{ x: 42, y: 2, w: 10, h: 29 },
	]);

/** 試験用の階：部屋のほかは空っぽ。キリコは真ん中で HP はほぼ無限。 */
const arena = (
	seed: string,
	layout: Layout = bigRoomLayout(),
	start: Pos = CENTER,
	dungeon: DungeonId = "main",
	objective: Objective = "fetch",
): Run => {
	const r = Run.create(`monster-test:${seed}`, dungeon, [], objective);
	const f = r.s.floor;
	f.layout = layout;
	f.seen = new Uint8Array(layout.w * layout.h);
	f.items = [];
	f.traps = [];
	f.monsters = [];
	f.wards = [];
	f.stairs = { x: layout.w - 3, y: layout.h - 3 };
	f.house = -1;
	f.houseAwake = false;
	f.turns = 0;
	f.res = 0;
	f.anka = null;
	f.ankaAt = -1;
	f.senseMonsters = false;
	f.senseItems = false;
	f.sight = false;
	const p = r.p;
	p.x = start.x;
	p.y = start.y;
	p.dir = 2;
	p.maxHp = 99999;
	p.hp = 99999;
	p.status = {
		sleep: 0,
		confuse: 0,
		blind: 0,
		daze: 0,
		fast: 0,
		trapped: 0,
		heldBy: null,
	};
	r.s.log = [];
	r.ev = [];
	return r;
};

/** 1体だけ置く（既定は起きている）。 */
const put = (
	r: Run,
	kind: string,
	pos: Pos,
	opts: { sleep?: number; awake?: boolean } = { awake: true },
): Monster => {
	const m = spawnMonster(r, kind, pos, opts);
	ok(m, `could not spawn ${kind}`);
	return m;
};

/** 1ターン進める（湧き・地震・空腹は止める）。 */
const turn = (r: Run, cmd: Command = { c: "wait" }): GameEvent[] => {
	r.f.turns = 0;
	r.f.res = 0;
	r.p.hunger = HUNGER_MAX;
	const ev = r.act(cmd);
	if (r.s.end) throw new Fail(`the player died: ${r.s.end.cause}`);
	return ev;
};

/** n ターン待つ。each が true を返したら止めて、そのターン目（1〜）を返す（最後まで止まらなければ 0）。 */
const waitTurns = (
	r: Run,
	n: number,
	each: (ev: GameEvent[]) => boolean,
): number => {
	for (let i = 1; i <= n; i++) if (each(turn(r))) return i;
	return 0;
};

/** のろわれていない、修正値 0 の道具を持たせる。 */
const give = (r: Run, kind: string): Item => {
	const it = r.newItem(kind);
	it.cursed = false;
	const cat = defOf(kind).cat;
	if (cat === "weapon" || cat === "shield") it.plus = 0;
	r.p.items.push(it);
	return it;
};

const equip = (r: Run, kind: string): Item => {
	const it = give(r, kind);
	ok(r.doEquip(it.uid) && r.isEquipped(it), `could not equip ${kind}`);
	return it;
};

type DamageBy = Parameters<Run["damageMonster"]>[2];

/** m に amount のダメージを与えて、実際に減った HP。 */
const dealt = (r: Run, m: Monster, amount: number, by: DamageBy): number => {
	const before = m.hp;
	r.damageMonster(m, amount, by);
	return before - m.hp;
};

/**
 * いまの状態を読み直す（ok() の asserts で型が絞られたあとに、ターンを進めて また比べるとき用）。
 */
const now = (m: Monster): Monster => m;

const ability = <K extends Ability["k"]>(
	kind: string,
	k: K,
): Extract<Ability, { k: K }> => {
	const a = MONSTERS[kind].abilities.find(
		(x): x is Extract<Ability, { k: K }> => x.k === k,
	);
	ok(a, `${kind} has no ${k}`);
	return a;
};

// ───────────────── 出来事を読む ─────────────────

type Ev<T extends GameEvent["t"]> = Extract<GameEvent, { t: T }>;

const evs = <T extends GameEvent["t"]>(ev: GameEvent[], t: T): Ev<T>[] =>
	ev.filter((e): e is Ev<T> => e.t === t);

const count = (
	ev: GameEvent[],
	t: "move" | "attack" | "warp" | "hurt" | "miss",
	id: number,
): number => evs(ev, t).filter((e) => e.id === id).length;

const hurts = (ev: GameEvent[], id: number): number[] =>
	evs(ev, "hurt")
		.filter((e) => e.id === id)
		.map((e) => e.amount);

const saw = (ev: GameEvent[], text: string): boolean =>
	evs(ev, "msg").some((e) => e.text.includes(text));

/** 炎の弾のあとの、キリコへのダメージ。 */
const breathDamage = (ev: GameEvent[]): number[] => {
	const out: number[] = [];
	let armed = false;
	for (const e of ev) {
		if (e.t === "bolt" && e.kind === "fire") armed = true;
		else if (armed && e.t === "hurt" && e.id === PLAYER_ID) {
			out.push(e.amount);
			armed = false;
		}
	}
	return out;
};

/** obj[key] への書きこみを見張る（前の値・新しい値）。 */
function watch<T extends object, K extends keyof T>(
	obj: T,
	key: K,
	cb: (prev: T[K], next: T[K]) => void,
): void {
	let v = obj[key];
	Object.defineProperty(obj, key, {
		configurable: true,
		enumerable: true,
		get: () => v,
		set: (next: T[K]) => {
			const prev = v;
			v = next;
			cb(prev, next);
		},
	});
}

/** ダメージの幅（乱数 112〜143）。 */
const dmgRange = (atk: number, def: number): [number, number] => [
	rollDamage(atk, def, 112),
	rollDamage(atk, def, 143),
];

// ───────────────── ぷゆゆ（slow。id は 前の名前の tousuko） ─────────────────

test("tousuko", "slow: moves at most every other turn", () => {
	const r = arena("tousuko-slow");
	const m = put(r, "tousuko", at(-20, 0));
	const N = 16;
	let moves = 0;
	waitTurns(r, N, (ev) => {
		moves += count(ev, "move", m.uid);
		return false;
	});
	ok(
		moves >= 1 && moves <= N / 2,
		`moved ${moves} times in ${N} turns (expected 1..${N / 2})`,
	);
});

test("tousuko", "sealed: moves every turn", () => {
	const r = arena("tousuko-sealed");
	const m = put(r, "tousuko", at(-20, 0));
	m.status.sealed = true;
	const N = 16;
	let moves = 0;
	waitTurns(r, N, (ev) => {
		moves += count(ev, "move", m.uid);
		return false;
	});
	ok(moves === N, `moved ${moves} times in ${N} turns (expected ${N})`);
});

// ───────────────── dat落ちの霊（fastMove） ─────────────────

test("hitodama", "fastMove: closes 2 tiles per turn when far", () => {
	const r = arena("hitodama-move");
	const m = put(r, "hitodama", at(-10, 0));
	turn(r);
	ok(dist(m, r.p) === 8, `distance ${dist(m, r.p)} after 1 turn (expected 8)`);
	turn(r);
	ok(dist(m, r.p) === 6, `distance ${dist(m, r.p)} after 2 turns (expected 6)`);
});

test("hitodama", "fastMove: attacks only once per turn", () => {
	const r = arena("hitodama-attack");
	const m = put(r, "hitodama", at(1, 0));
	for (let i = 1; i <= 12; i++) {
		const n = count(turn(r), "attack", m.uid);
		ok(n === 1, `turn ${i}: attacked ${n} times (expected 1)`);
	}
});

test("hitodama", "sealed: closes only 1 tile per turn", () => {
	const r = arena("hitodama-sealed");
	const m = put(r, "hitodama", at(-10, 0));
	m.status.sealed = true;
	turn(r);
	ok(dist(m, r.p) === 9, `distance ${dist(m, r.p)} after 1 turn (expected 9)`);
});

// ───────────────── 深夜テンション（random） ─────────────────

test("bat", "random: sometimes flutters away instead of attacking", () => {
	const r = arena("bat");
	const m = put(r, "bat", at(1, 0));
	let flutters = 0;
	let attacks = 0;
	for (let i = 0; i < 60; i++) {
		const adj = dist(m, r.p) === 1;
		const ev = turn(r);
		const a = count(ev, "attack", m.uid);
		attacks += a;
		if (adj && a === 0 && count(ev, "move", m.uid) > 0) flutters++;
	}
	ok(flutters > 0, "never stepped away while adjacent in 60 turns");
	ok(attacks > 0, "never attacked in 60 turns");
});

test("bat", "sealed: always attacks while adjacent", () => {
	const r = arena("bat-sealed");
	const m = put(r, "bat", at(1, 0));
	m.status.sealed = true;
	for (let i = 1; i <= 30; i++) {
		const ev = turn(r);
		ok(
			count(ev, "attack", m.uid) === 1 && count(ev, "move", m.uid) === 0,
			`turn ${i}: did not simply attack`,
		);
	}
});

// ───────────────── ROM専（shy） ─────────────────

test("funamushi", "shy: backs away when the player is within 2", () => {
	const r = arena("funamushi-shy");
	const m = put(r, "funamushi", at(2, 0));
	const ev = turn(r);
	ok(dist(m, r.p) === 3, `distance ${dist(m, r.p)} after 1 turn (expected 3)`);
	ok(count(ev, "attack", m.uid) === 0, "attacked instead of backing away");
	let attacks = 0;
	let closest = 99;
	waitTurns(r, 20, (e) => {
		attacks += count(e, "attack", m.uid);
		closest = Math.min(closest, dist(m, r.p));
		return false;
	});
	ok(attacks === 0, `attacked ${attacks} times while it could back away`);
	ok(closest >= 2, `came to distance ${closest}`);
});

test("funamushi", "shy: fights when cornered", () => {
	const r = arena("funamushi-corner", bigRoomLayout(), { x: 3, y: 3 });
	const m = put(r, "funamushi", { x: 2, y: 2 });
	let attacks = 0;
	let moves = 0;
	waitTurns(r, 5, (ev) => {
		attacks += count(ev, "attack", m.uid);
		moves += count(ev, "move", m.uid);
		return false;
	});
	ok(moves === 0, `moved ${moves} times from the corner`);
	ok(attacks === 5, `attacked ${attacks} times in 5 turns (expected 5)`);
});

// ───────────────── kskボット（accel） ─────────────────

test("ksk", "accel: fast=999 after `after` turns next to the player", () => {
	const r = arena("ksk-accel");
	const m = put(r, "ksk", at(1, 0));
	const after = ability("ksk", "accel").after;
	for (let i = 1; i < after; i++) {
		turn(r);
		ok(m.status.fast === 0, `already fast after ${i} turn(s)`);
	}
	turn(r);
	ok(
		m.status.fast === 999,
		`fast=${m.status.fast} after ${after} adjacent turns (expected 999)`,
	);
	const n = count(turn(r), "attack", m.uid);
	ok(n === 2, `attacked ${n} times in the next turn (expected 2)`);
});

test("ksk", "seeing the player from afar does not count", () => {
	const r = arena("ksk-far");
	const home = at(-8, 0);
	const m = put(r, "ksk", home);
	for (let i = 0; i < 12; i++) {
		// 毎ターン元の位置へ戻す（となりに来させない）
		m.x = home.x;
		m.y = home.y;
		turn(r);
	}
	ok(m.status.fast === 0, `accelerated from afar (fast=${m.status.fast})`);
});

test("ksk", "sealed: never accelerates", () => {
	const r = arena("ksk-sealed");
	const m = put(r, "ksk", at(1, 0));
	m.status.sealed = true;
	waitTurns(r, 20, () => m.status.fast > 0);
	ok(m.status.fast === 0, `sealed ksk got fast=${m.status.fast}`);
});

test("ksk", "w_slow on an accelerated ksk is not undone", () => {
	const r = arena("ksk-slow");
	const m = put(r, "ksk", at(1, 0));
	waitTurns(r, 8, () => m.status.fast === 999);
	ok(m.status.fast === 999, "did not accelerate");
	staffEffect(r, "w_slow", m);
	ok(
		now(m).status.slow > 0 && now(m).status.fast === 0,
		"w_slow did not apply",
	);
	let attacks = 0;
	waitTurns(r, 6, (ev) => {
		attacks += count(ev, "attack", m.uid);
		return false;
	});
	ok(
		now(m).status.fast === 0 && now(m).status.slow > 0,
		`re-accelerated after w_slow (fast=${m.status.fast}, slow=${m.status.slow}); ${attacks} attacks in 6 turns (slowed: <=3)`,
	);
});

test(
	"ksk",
	"w_haste on a slowed foe only undoes the slow; w_slow twice does nothing more",
	() => {
		const r = arena("haste-slow");
		const m = put(r, "bat", at(2, 0), { sleep: DEEP });
		staffEffect(r, "w_slow", m);
		ok(m.status.slow > 0 && m.status.fast === 0, "w_slow did not apply");
		staffEffect(r, "w_haste", m);
		ok(
			m.status.slow === 0 && m.status.fast === 0,
			`not back to normal (fast=${m.status.fast})`,
		);
		staffEffect(r, "w_haste", m);
		ok(m.status.fast > 0, "w_haste did not apply");
		staffEffect(r, "w_haste", m);
		staffEffect(r, "w_slow", m);
		ok(
			m.status.fast === 0 && m.status.slow === 0,
			`not back to normal (slow=${m.status.slow})`,
		);
	},
);

// ───────────────── 寝落ち民（sleepSpell・深い眠り） ─────────────────

/** 眠りの呪文を数える（となえた回数・眠っているのに となえた回数・眠らされた回数）。 */
const spellWatch = (r: Run) => {
	const s = { casts: 0, castsWhileAsleep: 0, slept: 0 };
	const orig = r.msg.bind(r);
	r.msg = (text, tone) => {
		if (text.includes("呪文を")) {
			s.casts++;
			if (r.p.status.sleep > 0) s.castsWhileAsleep++;
		}
		orig(text, tone);
	};
	watch(r.p.status, "sleep", (prev, next) => {
		if (prev === 0 && next > 0) s.slept++;
	});
	return s;
};

test(
	"neochi",
	"sleepSpell: puts the player to sleep, never while asleep",
	() => {
		const r = arena("neochi-spell");
		put(r, "neochi", at(4, 0));
		const s = spellWatch(r);
		waitTurns(r, 60, () => false);
		ok(s.slept > 0, `never put the player to sleep (${s.casts} casts)`);
		ok(
			s.castsWhileAsleep === 0,
			`cast ${s.castsWhileAsleep} times while asleep`,
		);
	},
);

test("neochi", "sleepSpell: never cast from afar (adjacent only)", () => {
	const r = arena("neochi-far");
	const home = at(4, 0);
	const m = put(r, "neochi", home);
	const s = spellWatch(r);
	for (let i = 0; i < 40; i++) {
		// 毎ターン元の位置へ戻す（となりに来させない）
		m.x = home.x;
		m.y = home.y;
		turn(r);
	}
	ok(s.casts === 0, `cast ${s.casts} times from 4 tiles away`);
});

test("neochi", "r_awake: the spell is cast but the player never sleeps", () => {
	const r = arena("neochi-awake");
	equip(r, "r_awake");
	put(r, "neochi", at(4, 0));
	const s = spellWatch(r);
	waitTurns(r, 60, () => false);
	ok(s.casts > 0, "never cast (the counter was not exercised)");
	ok(s.slept === 0, `the player slept ${s.slept} times`);
});

test(
	"neochi",
	"deep sleep: stays asleep next to the player, wakes when hit",
	() => {
		const r = arena("neochi-deep");
		const m = put(r, "neochi", at(1, 0), {});
		ok(m.status.sleep === DEEP, `spawned with sleep=${m.status.sleep}`);
		let acted = 0;
		waitTurns(r, 20, (ev) => {
			acted += count(ev, "attack", m.uid) + count(ev, "move", m.uid);
			return false;
		});
		ok(m.status.sleep === DEEP, `woke up by itself (sleep=${m.status.sleep})`);
		ok(acted === 0, `acted ${acted} times while asleep`);
		turn(r, { c: "attack", dir: 2 });
		ok(
			now(m).status.sleep === 0,
			`still asleep after being hit (${m.status.sleep})`,
		);
	},
);

test("neochi", "staff sleep: hits don't wake it, it wears off", () => {
	const r = arena("staff-sleep");
	const m = put(r, "neochi", at(1, 0), { awake: true });
	staffEffect(r, "w_sleep", m);
	const n = m.status.sleep;
	ok(n > 0 && n < DOZE, `not put to sleep (${n})`);
	turn(r, { c: "attack", dir: 2 });
	ok(now(m).hp <= 0 || now(m).status.sleep > 0, "woke up when hit");
	if (now(m).hp > 0) {
		waitTurns(r, n + 2, () => false);
		ok(now(m).status.sleep === 0, `still asleep (${now(m).status.sleep})`);
	}
});

// ───────────────── ピッチャー（ranged） ─────────────────

test(
	"pitcher",
	"ranged: hurts the player from 2+ tiles in a straight line",
	() => {
		for (const [dx, dy] of [
			[-5, 0],
			[4, -4],
		]) {
			const r = arena(`pitcher-${dx},${dy}`);
			const home = at(dx, dy);
			const m = put(r, "pitcher", home);
			let throws = 0;
			let hits = 0;
			for (let i = 0; i < 30; i++) {
				// 毎ターン元の位置へ戻す（近づかせない）
				m.x = home.x;
				m.y = home.y;
				const ev = turn(r);
				const thrown = evs(ev, "bolt").some((b) => b.kind === "arrow");
				if (thrown) throws++;
				const h = hurts(ev, PLAYER_ID).length;
				ok(h === 0 || thrown, "the player was hurt without a throw");
				hits += h;
			}
			ok(
				throws > 0 && hits > 0,
				`from (${dx},${dy}): ${throws} throws, ${hits} hits in 30 turns`,
			);
		}
	},
);

test("pitcher", "not in a straight line: never throws", () => {
	const r = arena("pitcher-offline");
	const home = at(-3, -2);
	const m = put(r, "pitcher", home);
	for (let i = 1; i <= 30; i++) {
		m.x = home.x;
		m.y = home.y;
		const ev = turn(r);
		ok(evs(ev, "bolt").length === 0, `turn ${i}: threw from off the line`);
		ok(hurts(ev, PLAYER_ID).length === 0, `turn ${i}: the player was hurt`);
	}
});

// ───────────────── まんぜう軍（poison。前の名前は 毒カボチャ） ─────────────────

test("pumpkin", "poison: lowers str", () => {
	const r = arena("pumpkin");
	put(r, "pumpkin", at(1, 0));
	const s0 = r.p.str;
	waitTurns(r, 60, () => r.p.str < s0);
	ok(r.p.str < s0, `str stayed ${s0} for 60 turns`);
});

for (const [kind, label] of [
	["scale", "scale shield"],
	["r_purity", "r_purity ring"],
]) {
	test("pumpkin", `${label} blocks poison`, () => {
		const r = arena(`pumpkin-${kind}`);
		equip(r, kind);
		put(r, "pumpkin", at(1, 0));
		const s0 = r.p.str;
		let blocked = 0;
		waitTurns(r, 60, (ev) => {
			if (saw(ev, "スルーした")) blocked++;
			return false;
		});
		ok(r.p.str === s0, `str dropped to ${r.p.str}`);
		ok(blocked > 0, "poison never triggered (the counter was not exercised)");
	});
}

test("pumpkin", "thrown h_antidote deals 50 (and seals it)", () => {
	const r = arena("pumpkin-antidote");
	const m = put(r, "pumpkin", at(1, 0));
	m.maxHp = 200;
	m.hp = 200;
	let got: number | null = null;
	for (let i = 0; i < 10 && got === null; i++) {
		const it = give(r, "h_antidote");
		const h = hurts(turn(r, { c: "throw", item: it.uid, dir: 2 }), m.uid);
		if (h.length) got = h[0];
	}
	ok(got !== null, "the herb never hit");
	ok(got === 50, `dealt ${got} (expected 50)`);
	ok(m.status.sealed, "not sealed");
});

// ───────────────── コピペ（split） ─────────────────

test("copipe", "split: multiplies when hit but not killed", () => {
	const r = arena("copipe");
	const m = put(r, "copipe", at(1, 0));
	m.maxHp = 500;
	m.hp = 500;
	let hits = 0;
	for (let i = 0; i < 20 && r.f.monsters.length === 1; i++)
		hits += hurts(turn(r, { c: "attack", dir: 2 }), m.uid).length;
	ok(r.f.monsters.length > 1, `no split after ${hits} hits`);
	ok(
		r.f.monsters.every((x) => x.kind === "copipe"),
		"something other than a copipe appeared",
	);
});

test("copipe", "sealed: never splits", () => {
	const r = arena("copipe-sealed");
	const m = put(r, "copipe", at(1, 0));
	m.maxHp = 500;
	m.hp = 500;
	m.status.sealed = true;
	let hits = 0;
	for (let i = 0; i < 20; i++)
		hits += hurts(turn(r, { c: "attack", dir: 2 }), m.uid).length;
	ok(hits > 0, "never hit it");
	ok(r.f.monsters.length === 1, `split to ${r.f.monsters.length} while sealed`);
});

test("copipe", "no split when the hit kills it", () => {
	const r = arena("copipe-kill");
	const m = put(r, "copipe", at(1, 0));
	ok(r.damageMonster(m, 999, "hit"), "did not die");
	ok(r.f.monsters.length === 0, `${r.f.monsters.length} monsters left`);
});

// ───────────────── ゾンJ民（revive） ─────────────────

test("zonj", "revive: 1st death revives weakened, no exp; 2nd is final", () => {
	const r = arena("zonj");
	const m = put(r, "zonj", at(1, 0));
	const exp0 = r.p.exp;
	ok(!r.damageMonster(m, 999, "hit"), "the first kill was final");
	ok(r.f.monsters.includes(m) && m.hp > 0, "not on the floor after reviving");
	ok(m.revived === true, "revived flag not set");
	// 起き上がりの HP は調整中（1/3 → 1/4）。「弱って起きる」ことだけ見る
	ok(
		m.hp >= 1 && m.hp <= Math.ceil(m.maxHp / 3),
		`revived with ${m.hp} HP (maxHp ${m.maxHp}; expected 1..${Math.ceil(m.maxHp / 3)})`,
	);
	ok(r.p.exp === exp0, `got ${r.p.exp - exp0} exp on the first death`);
	ok(!r.s.kills.zonj, "counted as killed on the first death");
	ok(r.damageMonster(m, 999, "hit"), "the second kill was not final");
	ok(!r.f.monsters.includes(m), "still on the floor");
	ok(
		r.p.exp === exp0 + mdef(m).exp,
		`got ${r.p.exp - exp0} exp (expected ${mdef(m).exp})`,
	);
	ok(r.s.kills.zonj === 1, "kill not counted");
});

test("zonj", "a thrown h_heal (holy) kill is final at once", () => {
	const r = arena("zonj-holy");
	const m = put(r, "zonj", at(1, 0));
	const exp0 = r.p.exp;
	for (let i = 0; i < 10 && r.f.monsters.includes(m); i++) {
		const it = give(r, "h_heal");
		turn(r, { c: "throw", item: it.uid, dir: 2 });
	}
	ok(!r.f.monsters.includes(m), "still alive (revived or never hit)");
	ok(!m.revived, "revived");
	ok(r.p.exp === exp0 + mdef(m).exp, `got ${r.p.exp - exp0} exp`);
});

test("zonj", "sealed: no revive", () => {
	const r = arena("zonj-sealed");
	const m = put(r, "zonj", at(1, 0));
	m.status.sealed = true;
	ok(r.damageMonster(m, 999, "hit"), "sealed zonj revived");
	ok(!r.f.monsters.includes(m) && !m.revived, "still on the floor");
});

// ───────────────── 拾い画UFO（pickup） ─────────────────

test("ufo", "pickup: carries a floor item; killing it drops the item", () => {
	const r = arena("ufo");
	const it = r.newItem("h_heal");
	r.f.items.push({ ...at(-12, 0), item: it });
	const m = put(r, "ufo", at(-16, 0));
	waitTurns(r, 12, () => m.carry !== null);
	ok(m.carry === it, "did not pick up the item in 12 turns");
	ok(!r.f.items.some((fi) => fi.item === it), "the item is still on the floor");
	r.damageMonster(m, 9999, "hit");
	ok(
		r.f.items.some((fi) => fi.item === it),
		"the item was not dropped on death",
	);
});

test("ufo", "never picks up the genban", () => {
	const r = arena("ufo-genban");
	const g = r.newItem("genban");
	const spot = at(-12, 0);
	r.f.items.push({ ...spot, item: g });
	const m = put(r, "ufo", at(-16, 0));
	waitTurns(r, 20, () => false);
	ok(m.carry === null, "picked something up");
	ok(
		r.f.items.some((fi) => fi.item === g && fi.x === spot.x && fi.y === spot.y),
		"the genban moved",
	);
});

// ───────────────── 風吹けば名無し（warpPlayer） ─────────────────

test("kaze", "warpPlayer: blows the player away", () => {
	const r = arena("kaze");
	put(r, "kaze", at(1, 0));
	const n = waitTurns(r, 60, (ev) =>
		evs(ev, "warp").some((w) => w.id === PLAYER_ID),
	);
	ok(n > 0, "the player was never warped in 60 turns");
});

test("kaze", "sealed: never warps the player", () => {
	const r = arena("kaze-sealed");
	const m = put(r, "kaze", at(1, 0));
	m.status.sealed = true;
	let hits = 0;
	const n = waitTurns(r, 40, (ev) => {
		hits += hurts(ev, PLAYER_ID).length;
		return evs(ev, "warp").some((w) => w.id === PLAYER_ID);
	});
	ok(n === 0, `warped on turn ${n}`);
	ok(hits > 0, "never hit the player");
});

// ───────────────── 自演くん（retreat） ─────────────────

test(
	"chimera",
	"retreat: <=40% HP flees & regenerates, returns at >=80%",
	() => {
		const r = arena("chimera");
		const m = put(r, "chimera", at(1, 0));
		m.hp = Math.floor(m.maxHp * 0.4);
		const hp0 = m.hp;
		const ev = turn(r);
		ok(m.retreating === true, "did not start retreating");
		ok(count(ev, "attack", m.uid) === 0, "attacked instead of fleeing");
		ok(dist(m, r.p) > 1, "did not move away");
		ok(m.hp > hp0, "did not regenerate");
		let recoveredAt = -1;
		let back = false;
		for (let i = 0; i < 40 && !back; i++) {
			const e = turn(r);
			if (m.retreating)
				ok(count(e, "attack", m.uid) === 0, "attacked while retreating");
			else if (recoveredAt < 0) recoveredAt = m.hp;
			if (recoveredAt >= 0 && dist(m, r.p) === 1) back = true;
		}
		ok(recoveredAt >= 0, "never stopped retreating");
		ok(
			recoveredAt >= m.maxHp * 0.8,
			`stopped retreating at ${recoveredAt}/${m.maxHp} HP`,
		);
		ok(back, "did not come back to the player");
	},
);

test("chimera", "above 40% HP it fights instead of fleeing", () => {
	const r = arena("chimera-fight");
	const m = put(r, "chimera", at(1, 0));
	m.hp = Math.floor(m.maxHp * 0.4) + 1;
	const ev = turn(r);
	ok(!m.retreating, "retreated above 40%");
	ok(count(ev, "attack", m.uid) === 1, "did not attack");
});

// ───────────────── 転載ガモ（steal） ─────────────────

test(
	"tensai",
	"steal: takes a loose item, warps out of sight; kill drops it",
	() => {
		const r = arena("tensai", hideoutLayout(), HIDE_AT);
		r.p.items = [];
		const club = equip(r, "club");
		const genban = give(r, "genban");
		const herb = give(r, "h_heal");
		const m = put(r, "tensai", at(1, 0, HIDE_AT));
		let warped = false;
		waitTurns(r, 30, (ev) => {
			if (count(ev, "warp", m.uid) > 0) warped = true;
			return m.carry !== null;
		});
		ok(
			m.carry === herb,
			`stole ${m.carry?.kind ?? "nothing"} (expected h_heal)`,
		);
		ok(!r.p.items.includes(herb), "the item is still in the pack");
		ok(
			r.p.items.includes(genban) && r.p.items.includes(club),
			"lost the genban or the equipped weapon",
		);
		ok(warped, "did not warp after stealing");
		ok(!canSee(r.f.layout, m, r.p), "warped somewhere the player can see");
		r.damageMonster(m, 9999, "hit");
		ok(
			r.f.items.some((fi) => fi.item === herb),
			"the stolen item was not dropped on death",
		);
	},
);

test("tensai", "never steals the genban or equipped items", () => {
	const r = arena("tensai-genban", hideoutLayout(), HIDE_AT);
	r.p.items = [];
	const gear = [equip(r, "club"), equip(r, "bronze"), equip(r, "r_sustain")];
	const genban = give(r, "genban");
	const m = put(r, "tensai", at(1, 0, HIDE_AT));
	let tries = 0;
	waitTurns(r, 30, (ev) => {
		if (saw(ev, "うかがっている")) tries++;
		return m.carry !== null;
	});
	ok(m.carry === null, `stole ${m.carry?.kind}`);
	ok(tries > 0, "never tried to steal");
	ok(
		[genban, ...gear].every((it) => r.p.items.includes(it)),
		"lost an item",
	);
});

// ───────────────── 鋼メンタル（armor） ─────────────────

test("knight", "armor: melee halved; throw/magic/blast unchanged", () => {
	const r = arena("knight");
	const m = put(r, "knight", at(3, 0), { sleep: DEEP });
	m.maxHp = 9999;
	m.hp = 9999;
	ok(dealt(r, m, 20, "hit") === 10, "hit 20 was not halved to 10");
	ok(dealt(r, m, 7, "hit") === 4, "hit 7 was not halved (rounded up) to 4");
	for (const by of ["throw", "magic", "blast"] as const) {
		const d = dealt(r, m, 20, by);
		ok(d === 20, `${by} 20 dealt ${d}`);
	}
	m.status.sealed = true;
	ok(dealt(r, m, 20, "hit") === 20, "sealed knight still halves melee");
});

// ───────────────── 風呂キャンセル界隈（rust。前の名前は 錆び亡者） ─────────────────

test("sabi", "rust: lowers the shield's plus", () => {
	const r = arena("sabi");
	const sh = equip(r, "bronze");
	put(r, "sabi", at(1, 0));
	waitTurns(r, 60, () => sh.plus < 0);
	ok(sh.plus < 0, `shield stayed +${sh.plus} for 60 turns`);
});

test("sabi", "never hits: only rusts", () => {
	const r = arena("sabi-nohit");
	equip(r, "bronze");
	put(r, "sabi", at(1, 0));
	const hp = r.p.hp;
	waitTurns(r, 60, () => false);
	ok(r.p.hp >= hp, `hp went ${hp} -> ${r.p.hp}`);
});

for (const kind of ["leather", "mirror", "rustproof"]) {
	test("sabi", `${kind} shield never rusts`, () => {
		const r = arena(`sabi-${kind}`);
		const sh = equip(r, kind === "rustproof" ? "bronze" : kind);
		if (kind === "rustproof") sh.rustproof = true;
		put(r, "sabi", at(1, 0));
		let blocked = 0;
		waitTurns(r, 60, (ev) => {
			if (saw(ev, "錆びなかった")) blocked++;
			return false;
		});
		ok(sh.plus === 0, `shield became ${sh.plus}`);
		ok(blocked > 0, "rust never triggered (the counter was not exercised)");
	});
}

// ───────────────── メタルぷゆゆ（metal） ─────────────────

test("metal", "damage capped at 1; warps out of sight when hit", () => {
	const r = arena("metal", hideoutLayout(), HIDE_AT);
	const m = put(r, "metal", at(1, 0, HIDE_AT));
	m.maxHp = 10;
	m.hp = 10;
	for (const by of ["hit", "throw", "magic"] as const) {
		const from = { x: m.x, y: m.y };
		r.ev = [];
		const d = dealt(r, m, 50, by);
		ok(d === 1, `${by} 50 dealt ${d}`);
		ok(count(r.ev, "warp", m.uid) === 1, `did not warp after ${by}`);
		ok(m.x !== from.x || m.y !== from.y, `still in place after ${by}`);
		ok(!canSee(r.f.layout, m, r.p), `warped into view after ${by}`);
	}
});

test(
	"metal",
	"drops a known 成長の実 when defeated, but not in an explosion",
	() => {
		const r = arena("metal-drop");
		const m = put(r, "metal", at(1, 0));
		m.hp = 1;
		ok(dealt(r, m, 1, "hit") === 1, "the last hit did not land");
		const drop = r.f.items.find((fi) => fi.item.kind === "h_growth");
		ok(drop, "no 成長の実 on the floor");
		ok(isKnownKind(r.s, "h_growth"), "the dropped fruit is not identified");
		const r2 = arena("metal-burn");
		const m2 = put(r2, "metal", at(1, 0));
		r2.killMonster(m2, false, true);
		ok(
			!r2.f.items.some((fi) => fi.item.kind === "h_growth"),
			"a fruit dropped in an explosion",
		);
	},
);

test(
	"metal",
	"a mine blast erases the neighbours with their drops and carried items (Torneko 1)",
	() => {
		const r = arena("mine-blast");
		const m = put(r, "metal", at(1, 0));
		const thief = put(r, "tousuko", at(-1, 0));
		thief.carry = r.newItem("h_heal");
		const far = put(r, "tousuko", at(3, 0));
		const hp = r.p.hp;
		triggerTrap(r, { x: r.p.x, y: r.p.y, kind: "mine", found: false });
		ok(!r.f.monsters.includes(m), "the metal next to the mine survived");
		ok(!r.f.monsters.includes(thief), "the thief next to the mine survived");
		ok(r.f.monsters.includes(far), "a monster 3 tiles away was caught");
		ok(
			r.f.items.length === 0,
			`items were left: ${r.f.items.map((fi) => fi.item.kind)}`,
		);
		ok(r.p.hp === hp - Math.ceil(hp / 2), `hp ${hp} -> ${r.p.hp}`);
	},
);

// ───────────────── VIPPER（pack） ─────────────────

test("yuki", "pack: hitting one wakes the others within 3", () => {
	const r = arena("yuki");
	const a = put(r, "yuki", at(1, 0), { sleep: DEEP });
	const near = [
		put(r, "yuki", at(3, 0), { sleep: DEEP }),
		put(r, "yuki", at(1, 3), { sleep: DEEP }),
	];
	const far = put(r, "yuki", at(5, 0), { sleep: DEEP });
	waitTurns(r, 5, () => false);
	ok(
		[a, ...near, far].every((m) => m.status.sleep === DEEP),
		"one woke up by itself",
	);
	turn(r, { c: "attack", dir: 2 });
	ok(a.status.sleep === 0, "the one that was hit is still asleep");
	ok(
		near.every((m) => m.status.sleep === 0),
		"a pack member within 3 stayed asleep",
	);
	ok(far.status.sleep === DEEP, "a yuki 4 tiles away woke up too");
});

test(
	"yuki",
	"pack: a harmless staff wakes only the one it hits; w_bolt wakes the others; w_sleep wakes nobody",
	() => {
		for (const kind of ["w_reel", "w_seal", "w_slow", "w_send", "w_edge"]) {
			const r = arena(`yuki-${kind}`);
			const a = put(r, "yuki", at(1, 0), { sleep: DEEP });
			const b = put(r, "yuki", at(2, 0), { sleep: DEEP });
			staffEffect(r, kind, a);
			ok(a.status.sleep === 0, `${kind}: the one hit is still asleep`);
			ok(b.status.sleep === DEEP, `${kind}: woke its pack mate too`);
		}
		const r = arena("yuki-bolt");
		const a = put(r, "yuki", at(1, 0), { sleep: DEEP });
		const b = put(r, "yuki", at(2, 0), { sleep: DEEP });
		staffEffect(r, "w_sleep", b);
		ok(a.status.sleep === DEEP, "w_sleep woke a pack mate");
		staffEffect(r, "w_bolt", a);
		// 眠らされた 仲間は 起きない
		ok(now(b).status.sleep > 0, "w_bolt woke a pack mate put to sleep");
		now(a).status.sleep = DEEP;
		now(b).status.sleep = DEEP;
		staffEffect(r, "w_bolt", a);
		ok(
			now(a).status.sleep === 0 && now(b).status.sleep === 0,
			"w_bolt did not wake the pack",
		);
	},
);

// ───────────────── 置物（statue） ─────────────────

test(
	"statue",
	"dormant until the player is adjacent, then attacks at once",
	() => {
		const r = arena("statue");
		const home = at(3, 0);
		const m = put(r, "statue", home);
		ok(m.status.dormant, "not dormant");
		// 動きだす まで 前向き（何体 出しても）
		for (let i = 0; i < 8; i++) {
			const o = put(r, "statue", at(-3, i - 4));
			ok(o.dir === 4, `a dormant statue faces ${o.dir}, not down`);
		}
		ok(m.dir === 4, `the dormant statue faces ${m.dir}, not down`);
		let acted = 0;
		waitTurns(r, 10, (ev) => {
			acted += count(ev, "move", m.uid) + count(ev, "attack", m.uid);
			return false;
		});
		ok(acted === 0, `acted ${acted} times while dormant`);
		ok(m.x === home.x && m.y === home.y, "moved while dormant");
		const ev1 = turn(r, { c: "move", dir: 2 });
		ok(
			m.status.dormant && count(ev1, "attack", m.uid) === 0,
			"woke at distance 2",
		);
		const ev2 = turn(r, { c: "move", dir: 2 });
		ok(dist(m, r.p) === 1, "the player is not adjacent (harness)");
		ok(!m.status.dormant, "still dormant when the player is adjacent");
		ok(count(ev2, "attack", m.uid) === 1, "did not attack at once");
	},
);

// ───────────────── 炎上案件（explode） ─────────────────

test(
	"bomb",
	"fuse at hp<=29 (stops), explodes at hp<=9 (5x5, items lost)",
	() => {
		const r = arena("bomb");
		const m = put(r, "bomb", at(2, 0));
		m.carry = r.newItem("s_map");
		const inCard = r.newItem("h_heal");
		const outCard = r.newItem("h_heal");
		const genban = r.newItem("genban");
		r.f.items.push({ ...at(3, 1), item: inCard });
		r.f.items.push({ ...at(1, 1), item: genban });
		r.f.items.push({ ...at(6, 0), item: outCard });
		const inBat = put(r, "bat", at(2, 2), { sleep: DEEP });
		const outBat = put(r, "bat", at(5, 0), { sleep: DEEP });

		m.hp = 30;
		r.damageMonster(m, 1, "hit");
		ok(m.fuse === true, `no fuse at hp ${m.hp}`);
		const home = { x: m.x, y: m.y };
		let acted = 0;
		waitTurns(r, 3, (ev) => {
			acted += count(ev, "move", m.uid) + count(ev, "attack", m.uid);
			return false;
		});
		ok(acted === 0 && m.x === home.x && m.y === home.y, "moved with a fuse");

		r.damageMonster(m, m.hp - 9, "hit");
		ok(!r.f.monsters.includes(m), "did not explode at hp 9");
		ok(r.p.hp === 1, `player hp ${r.p.hp} (expected 1)`);
		ok(!r.f.monsters.includes(inBat), "a monster in the 5x5 survived");
		ok(r.f.monsters.includes(outBat), "a monster outside the 5x5 died");
		ok(
			!r.f.items.some((fi) => fi.item === inCard),
			"an item in the 5x5 survived",
		);
		ok(
			r.f.items.some((fi) => fi.item === genban),
			"the genban was destroyed",
		);
		ok(
			r.f.items.some((fi) => fi.item === outCard),
			"an item outside was lost",
		);
	},
);

test("bomb", "the player outside the 5x5 is unharmed", () => {
	const r = arena("bomb-far");
	const m = put(r, "bomb", at(4, 0), { sleep: DEEP });
	const hp0 = r.p.hp;
	m.hp = 10;
	r.damageMonster(m, 1, "hit");
	ok(!r.f.monsters.includes(m), "did not explode");
	ok(r.p.hp === hp0, `player hp ${hp0} -> ${r.p.hp}`);
});

test("bomb", "sealed: no fuse and no explosion", () => {
	const r = arena("bomb-sealed");
	const m = put(r, "bomb", at(2, 0), { sleep: DEEP });
	m.status.sealed = true;
	const hp0 = r.p.hp;
	m.hp = 30;
	r.damageMonster(m, 25, "hit");
	ok(!m.fuse, "fused while sealed");
	ok(r.f.monsters.includes(m) && m.hp === 5, "exploded while sealed");
	ok(r.p.hp === hp0, "the player was hurt");
});

test(
	"bomb",
	"a blast sets off other bombs in range; two blasts fell the player",
	() => {
		const r = arena("bomb-chain");
		const a = put(r, "bomb", at(2, 0), { sleep: DEEP });
		const b = put(r, "bomb", at(1, 1), { sleep: DEEP });
		r.p.hp = r.p.maxHp = 50;
		a.hp = 10;
		r.damageMonster(a, 1, "hit");
		ok(!r.f.monsters.includes(a), "did not explode");
		ok(!r.f.monsters.includes(b), "the second bomb did not go off");
		ok(r.s.end?.kind === "dead", `survived two blasts (hp ${r.p.hp})`);
	},
);

// ───────────────── 論破厨（knockback） ─────────────────

test("golem", "knockback: pushes the player 2 tiles away", () => {
	const r = arena("golem");
	const m = put(r, "golem", at(-1, 0));
	let knock: { from: Pos; to: Pos; g: Pos } | null = null;
	for (let i = 0; i < 60 && !knock; i++) {
		const g = { x: m.x, y: m.y };
		const w = evs(turn(r), "warp").find((e) => e.id === PLAYER_ID);
		if (w) knock = { from: w.from, to: w.to, g };
	}
	ok(knock, "never knocked the player back in 60 turns");
	const d = dirOf(knock.from.x - knock.g.x, knock.from.y - knock.g.y);
	ok(d !== null, "golem was on the player (harness)");
	ok(
		knock.to.x === knock.from.x + 2 * DX[d] &&
			knock.to.y === knock.from.y + 2 * DY[d],
		`pushed from (${knock.from.x},${knock.from.y}) to (${knock.to.x},${knock.to.y}), golem at (${knock.g.x},${knock.g.y})`,
	);
});

test("golem", "knockback into a wall deals 5", () => {
	const start = { x: 2, y: 16 };
	const r = arena("golem-wall", bigRoomLayout(), start);
	const m = put(r, "golem", { x: 3, y: 16 });
	const n = waitTurns(
		r,
		60,
		(ev) => count(ev, "attack", m.uid) > 0 && hurts(ev, PLAYER_ID).includes(5),
	);
	ok(n > 0, "never took the 5 wall damage in 60 turns");
	ok(r.p.x === start.x && r.p.y === start.y, "moved into the wall");
});

test("golem", "sealed: no knockback", () => {
	const r = arena("golem-sealed");
	const m = put(r, "golem", at(-1, 0));
	m.status.sealed = true;
	const n = waitTurns(r, 40, (ev) =>
		evs(ev, "warp").some((w) => w.id === PLAYER_ID),
	);
	ok(n === 0, `knocked back on turn ${n}`);
});

// ───────────────── 忍法帖エラー（drainLv） ─────────────────

test("ninpo", "drainLv: lowers the level", () => {
	const r = arena("ninpo");
	r.p.lv = 5;
	r.p.exp = EXP_AT[4];
	put(r, "ninpo", at(1, 0));
	waitTurns(r, 60, () => r.p.lv < 5);
	ok(r.p.lv < 5, "level stayed 5 for 60 turns");
});

test("ninpo", "r_ward blocks level drain", () => {
	const r = arena("ninpo-ward");
	r.p.lv = 5;
	r.p.exp = EXP_AT[4];
	equip(r, "r_ward");
	put(r, "ninpo", at(1, 0));
	let blocked = 0;
	waitTurns(r, 60, (ev) => {
		if (saw(ev, "守ってくれた")) blocked++;
		return false;
	});
	ok(r.p.lv === 5, `level dropped to ${r.p.lv}`);
	ok(blocked > 0, "drain never triggered (the counter was not exercised)");
});

// ───────────────── かまってちゃん（grab） ─────────────────

/** かまってちゃんにつかまれた状態を作る（キリコの左にかまってちゃん）。 */
const grabbed = (seed: string): { r: Run; m: Monster } => {
	const r = arena(seed);
	const m = put(r, "kaso", at(-1, 0));
	turn(r);
	ok(r.p.status.heldBy === m.uid, "the player was not grabbed");
	return { r, m };
};

test("kaso", "grab: the player cannot walk away but can attack", () => {
	const { r, m } = grabbed("kaso");
	turn(r, { c: "move", dir: 2 });
	ok(r.p.x === CENTER.x && r.p.y === CENTER.y, "walked away while held");
	let struck = false;
	for (let i = 0; i < 5 && !struck; i++) {
		const ev = turn(r, { c: "attack", dir: 6 });
		struck = count(ev, "hurt", m.uid) + count(ev, "miss", m.uid) > 0;
	}
	ok(struck, "could not attack the grabber");
});

test("kaso", "sealed: releases the player", () => {
	const { r, m } = grabbed("kaso-sealed");
	m.status.sealed = true;
	turn(r, { c: "move", dir: 2 });
	ok(r.p.x === CENTER.x + 1, "still held after sealing");
	ok(r.p.status.heldBy === null, "heldBy not cleared");
});

test("kaso", "transformed: releases the player", () => {
	const { r, m } = grabbed("kaso-change");
	transformMonster(r, m);
	ok(m.kind !== "kaso", "did not transform");
	ok(r.p.status.heldBy === null, "heldBy not cleared by the transform");
	turn(r, { c: "move", dir: 2 });
	ok(r.p.x === CENTER.x + 1, "could not walk away");
});

// ───────────────── 釣り（mimic） ─────────────────

test(
	"bakefuda",
	"mimic: disguised & idle; bumping reveals it, then attacks",
	() => {
		const r = arena("bakefuda");
		const m = put(r, "bakefuda", at(1, 0), {});
		ok(m.disguise !== null, "not disguised");
		let acted = 0;
		waitTurns(r, 10, (ev) => {
			acted += count(ev, "move", m.uid) + count(ev, "attack", m.uid);
			return false;
		});
		ok(acted === 0, `acted ${acted} times while disguised`);
		ok(m.disguise !== null, "revealed itself");
		const ev = turn(r, { c: "move", dir: 2 });
		ok(m.disguise === null, "bumping did not reveal it");
		ok(r.p.x === CENTER.x, "walked onto it");
		const attacked =
			count(ev, "attack", m.uid) > 0 ||
			waitTurns(r, 3, (e) => count(e, "attack", m.uid) > 0) > 0;
		ok(attacked, "did not attack after being revealed");
	},
);

// ───────────────── 透明あぼーん（invisible） ─────────────────

test(
	"kage",
	"invisible: hidden even adjacent; 見透し草 (f.sight) shows it",
	() => {
		const r = arena("kage");
		const m = put(r, "kage", at(1, 0));
		const plain = put(r, "bat", at(-3, 0), { sleep: DEEP });
		ok(r.monsterVisible(plain), "an ordinary monster is not visible (harness)");
		ok(!r.monsterVisible(m), "visible without sight");
		r.f.sight = true;
		ok(r.monsterVisible(m), "not visible with f.sight");
		r.f.sight = false;
		m.status.sealed = true;
		ok(r.monsterVisible(m), "not visible when sealed");
	},
);

test("kage", "気配スレ (senseMonsters) alone does not show it", () => {
	// 気配スレは「敵のいる所」、見えない敵は 見透し草 の役目（items.ts の説明・statusView の表示）
	const r = arena("kage-sense");
	const m = put(r, "kage", at(5, 0));
	r.f.senseMonsters = true;
	ok(!r.monsterVisible(m), "senseMonsters revealed an invisible monster");
	r.f.sight = true;
	ok(r.monsterVisible(m), "not visible with sight + sense");
});

// ───────────────── 顔真っ赤（berserk） ─────────────────

test("oni", "berserk: at <= half HP becomes fast=999, only once", () => {
	const r = arena("oni");
	const m = put(r, "oni", at(-12, 0));
	const half = m.maxHp / 2;
	r.damageMonster(m, m.hp - Math.floor(half) - 1, "hit");
	ok(!m.enraged && m.status.fast === 0, `enraged at ${m.hp}/${m.maxHp}`);
	r.damageMonster(m, 1, "hit");
	ok(m.hp <= half, "harness: not at half");
	ok(
		now(m).enraged === true && now(m).status.fast === 999,
		`not enraged at ${m.hp}`,
	);
	const moves = count(turn(r), "move", m.uid);
	ok(moves === 2, `moved ${moves} times in a turn after enraging`);
	staffEffect(r, "w_slow", m);
	r.damageMonster(m, 1, "hit");
	ok(now(m).status.fast === 0, "enraged again after w_slow");
	const angers = r.s.log.filter((t) => t.includes("怒りだした")).length;
	ok(angers === 1, `enraged ${angers} times`);
});

test("oni", "sealed: never berserks", () => {
	const r = arena("oni-sealed");
	const m = put(r, "oni", at(-12, 0));
	m.status.sealed = true;
	r.damageMonster(m, m.hp - 1, "hit");
	ok(!m.enraged && m.status.fast === 0, "sealed oni enraged");
});

// ───────────────── 特定班（gaze） ─────────────────

const confuseWatch = (r: Run): { n: number } => {
	const s = { n: 0 };
	watch(r.p.status, "confuse", (prev, next) => {
		if (prev === 0 && next > 0) s.n++;
	});
	return s;
};

test("eye", "gaze: confuses the player", () => {
	const r = arena("eye");
	put(r, "eye", at(3, 0));
	const s = confuseWatch(r);
	waitTurns(r, 60, () => s.n > 0);
	ok(s.n > 0, "never confused the player in 60 turns");
});

test("eye", "a blind player is never confused", () => {
	const r = arena("eye-blind");
	r.p.status.blind = 999;
	put(r, "eye", at(3, 0));
	const s = confuseWatch(r);
	waitTurns(r, 60, () => false);
	ok(r.p.status.blind > 0, "harness: blindness wore off");
	ok(s.n === 0, `confused ${s.n} times while blind`);
});

// ───────────────── 文字化け（drainMax） ─────────────────

test("mojibake", "drainMax: lowers maxHp or maxStr", () => {
	const r = arena("mojibake");
	const hp0 = r.p.maxHp;
	const str0 = r.p.maxStr;
	put(r, "mojibake", at(1, 0));
	waitTurns(r, 60, () => r.p.maxHp < hp0 || r.p.maxStr < str0);
	ok(r.p.maxHp < hp0 || r.p.maxStr < str0, "nothing drained in 60 turns");
});

test("mojibake", "r_ward blocks drainMax", () => {
	const r = arena("mojibake-ward");
	equip(r, "r_ward");
	const hp0 = r.p.maxHp;
	const str0 = r.p.maxStr;
	put(r, "mojibake", at(1, 0));
	let blocked = 0;
	waitTurns(r, 60, (ev) => {
		if (saw(ev, "守ってくれた")) blocked++;
		return false;
	});
	ok(r.p.maxHp === hp0 && r.p.maxStr === str0, "drained through r_ward");
	ok(blocked > 0, "drain never triggered (the counter was not exercised)");
});

// ───────────────── 連投荒らし（fastAct） ─────────────────

test("ninja", "fastAct: attacks twice every turn", () => {
	const r = arena("ninja");
	const m = put(r, "ninja", at(1, 0));
	for (let i = 1; i <= 10; i++) {
		const n = count(turn(r), "attack", m.uid);
		ok(n === 2, `turn ${i}: ${n} attacks (expected 2)`);
	}
});

test("ninja", "sealed: attacks once per turn", () => {
	const r = arena("ninja-sealed");
	const m = put(r, "ninja", at(1, 0));
	m.status.sealed = true;
	for (let i = 1; i <= 10; i++) {
		const n = count(turn(r), "attack", m.uid);
		ok(n === 1, `turn ${i}: ${n} attacks (expected 1)`);
	}
});

// ───────────────── 粘着アンチ（curse） ─────────────────

test("fallen", "curse: an equipped item becomes cursed (and sticks)", () => {
	const r = arena("fallen");
	const gear = [equip(r, "club"), equip(r, "bronze"), equip(r, "r_sustain")];
	put(r, "fallen", at(1, 0));
	waitTurns(r, 60, () => gear.some((g) => g.cursed));
	const cursed = gear.find((g) => g.cursed);
	ok(cursed, "nothing was cursed in 60 turns");
	turn(r, { c: "unequip", item: cursed.uid });
	ok(r.isEquipped(cursed), "a cursed item could be removed");
});

// ───────────────── ワイ バーン（breath・竜） ─────────────────

/** 毎ターン home に戻しながら n ターン待ち、炎のダメージを集める。 */
const breaths = (r: Run, m: Monster, home: Pos, n: number): number[] => {
	const out: number[] = [];
	for (let i = 0; i < n; i++) {
		m.x = home.x;
		m.y = home.y;
		out.push(...breathDamage(turn(r)));
	}
	return out;
};

test("wyvern", "breath: fire damage in range along a straight line", () => {
	const [lo, hi] = ability("wyvern", "breath").dmg;
	for (const [dx, dy] of [
		[-5, 0],
		[0, 3],
		[-4, -4],
	]) {
		const r = arena(`wyvern-${dx},${dy}`);
		const home = at(dx, dy);
		const m = put(r, "wyvern", home);
		const d = breaths(r, m, home, 30);
		ok(d.length > 0, `no breath from (${dx},${dy}) in 30 turns`);
		ok(
			d.every((x) => x >= lo && x <= hi),
			`breath damage ${d.join(",")} outside ${lo}..${hi}`,
		);
	}
});

test("wyvern", "fireward halves breath damage", () => {
	const [lo, hi] = ability("wyvern", "breath").dmg;
	const r = arena("wyvern-fireward");
	equip(r, "fireward");
	const home = at(-5, 0);
	const m = put(r, "wyvern", home);
	const d = breaths(r, m, home, 30);
	ok(d.length > 0, "no breath in 30 turns");
	const [hlo, hhi] = [Math.floor(lo / 2), Math.floor(hi / 2)];
	ok(
		d.every((x) => x >= hlo && x <= hhi),
		`breath damage ${d.join(",")} outside ${hlo}..${hhi}`,
	);
});

test("wyvern", "not in a straight line: no breath", () => {
	const r = arena("wyvern-offline");
	const home = at(-3, -2);
	const m = put(r, "wyvern", home);
	const d = breaths(r, m, home, 30);
	ok(d.length === 0, `breathed ${d.length} times from off the line`);
});

/** 最初に当たった一撃のダメージ。 */
const firstHit = (r: Run, m: Monster): number => {
	for (let i = 0; i < 20; i++) {
		const h = hurts(turn(r, { c: "attack", dir: 2 }), m.uid);
		if (h.length) return h[0];
	}
	throw new Fail("never hit in 20 swings");
};

test("wyvern", "wyrmbane doubles melee damage against it", () => {
	const r = arena("wyrmbane");
	r.p.lv = 20;
	equip(r, "wyrmbane");
	const m = put(r, "wyvern", at(1, 0));
	m.maxHp = 99999;
	m.hp = 99999;
	const [lo, hi] = dmgRange(attackPower(r.p.lv, r.meleePower()), mdef(m).def);
	ok(2 * lo > hi, "harness: doubled range overlaps the normal one");
	const got = firstHit(r, m);
	ok(
		got >= 2 * lo && got <= 2 * hi,
		`dealt ${got} (normal ${lo}..${hi}, doubled ${2 * lo}..${2 * hi})`,
	);
});

test("wyvern", "another weapon is not doubled against it", () => {
	const r = arena("wyvern-club");
	r.p.lv = 20;
	equip(r, "club");
	const m = put(r, "wyvern", at(1, 0));
	m.maxHp = 99999;
	m.hp = 99999;
	const [lo, hi] = dmgRange(attackPower(r.p.lv, r.meleePower()), mdef(m).def);
	const got = firstHit(r, m);
	ok(got >= lo && got <= hi, `dealt ${got} (expected ${lo}..${hi})`);
});

// ───────────────── 追いかけ（pursuit） ─────────────────
//
// 敵がキリコを追うしくみ（monster.ts の canTrack・track・forget・noticeAdjacent と、動くときの
// 「最後に見た所へ → 着いたら 左折の法則で たどる → 部屋は別の出口へ → ふさがれたら待つ」）。
// 部屋と通路を手で掘った階で確かめる。

/** monster.ts の GIVE_UP（ふさがれて待つターン数）と HUNT_STEPS（見失ったあと たどる歩数）。 */
const GIVE_UP = 5;
const HUNT_STEPS = 40;

/** 通路を掘る（点から点へ、たてか よこに まっすぐ。部屋の床は そのまま）。 */
const dig = (l: Layout, ...pts: Pos[]): Layout => {
	for (let i = 1; i < pts.length; i++) {
		const a = pts[i - 1];
		const b = pts[i];
		const dx = Math.sign(b.x - a.x);
		const dy = Math.sign(b.y - a.y);
		ok(dx === 0 || dy === 0, "harness: a corridor must be straight");
		for (let x = a.x, y = a.y; ; x += dx, y += dy) {
			const k = y * l.w + x;
			if (l.tiles[k] !== T_ROOM) l.tiles[k] = T_CORR;
			if (x === b.x && y === b.y) break;
		}
	}
	return l;
};

const pp = (p: Pos | null | undefined): string => (p ? `(${p.x},${p.y})` : "-");

/** p を覚えているか。 */
const remembers = (m: Monster, p: Pos): boolean =>
	!!m.lastSeen && samePos(m.lastSeen, p);

/** いま立っている所で キリコを見失った（次の行動で d の向きに あとをたどりはじめる）。 */
const lostHere = (m: Monster, d: Dir8): void => {
	m.lastSeen = { x: m.x, y: m.y };
	m.dir = d;
};

/** 西に小部屋、そこから東へ y=16 の まっすぐな通路（x=7〜toX）。 */
const corridorLayout = (toX: number): Layout =>
	dig(
		makeLayout([{ x: 2, y: 14, w: 5, h: 5 }]),
		{ x: 7, y: 16 },
		{ x: toX, y: 16 },
	);

test("pursuit", "corridor: a chaser right behind stays adjacent", () => {
	// HUNT_STEPS より長く歩く（あとをたどるだけでは 途中で あきらめてしまう）
	const r = arena("pursuit-corridor", corridorLayout(52), { x: 9, y: 16 });
	const m = put(r, "knight", { x: 8, y: 16 });
	turn(r); // となりで なぐらせる（キリコを見た）
	let steps = 0;
	while (r.p.x < 52) {
		turn(r, { c: "move", dir: 2 });
		steps++;
		ok(dist(m, r.p) <= 1, `step ${steps}: ${dist(m, r.p)} behind`);
		ok(
			remembers(m, r.p),
			`step ${steps}: adjacent but remembers ${pp(m.lastSeen)}, not the player's tile ${pp(r.p)}`,
		);
	}
	ok(steps > HUNT_STEPS, "harness: the corridor is too short");
});

test("pursuit", "room exit: follows the player down the corridor", () => {
	// 出口が東に1つだけの部屋と、そこから のびる行き止まりの通路（ほかに部屋はない）
	const exit = { x: 13, y: 15 };
	const l = dig(makeLayout([{ x: 2, y: 10, w: 11, h: 11 }]), exit, {
		x: 40,
		y: 15,
	});
	const r = arena("pursuit-exit", l, { x: 11, y: 15 });
	const m = put(r, "knight", { x: 9, y: 15 });
	while (r.p.x < exit.x + 8) turn(r, { c: "move", dir: 2 });
	ok(
		dist(m, r.p) <= 2,
		`${dist(m, r.p)} away at ${pp(m)} after the player walked 8 tiles past the exit (player ${pp(r.p)}, hunt=${m.hunt})`,
	);
});

test(
	"pursuit",
	"queue: the one stuck behind waits instead of giving up",
	() => {
		const r = arena("pursuit-queue", corridorLayout(40), { x: 20, y: 16 });
		const front = put(r, "knight", { x: 19, y: 16 });
		const back = put(r, "knight", { x: 18, y: 16 });
		// 2体とも キリコを見た。うしろの1体は まえの1体に ふさがれて 近づけない
		for (const m of [front, back]) m.lastSeen = { x: r.p.x, y: r.p.y };
		for (let t = 1; t <= 3; t++) {
			turn(r);
			ok(back.lastSeen !== null, `turn ${t}: the second one forgot the player`);
			ok(
				back.x === 18 && back.y === 16,
				`turn ${t}: the second one left the line for ${pp(back)}`,
			);
		}
		// 列が動けば ついてくる
		for (let i = 0; i < 6; i++) turn(r, { c: "move", dir: 2 });
		ok(
			dist(back, r.p) <= 2,
			`the second one is ${dist(back, r.p)} away after the player walked 6 tiles`,
		);
	},
);

/** あきらめるまでの「ターン」は 速さによらない（倍速は重ねない・2ターンに1回の敵は1回で2ターンぶん）。 */
const SPEEDS: {
	label: string;
	kind: string;
	status?: Partial<Monster["status"]>;
}[] = [
	{ label: "knight", kind: "knight" },
	{ label: "hitodama (fastMove)", kind: "hitodama" },
	{ label: "ninja (fastAct)", kind: "ninja" },
	{ label: "hasted knight", kind: "knight", status: { fast: 999 } },
	{ label: "tousuko (slow)", kind: "tousuko" },
	{ label: "slowed knight", kind: "knight", status: { slow: 999 } },
	{ label: "hasted tousuko", kind: "tousuko", status: { fast: 999 } },
];

for (const { label, kind, status } of SPEEDS)
	test(
		"pursuit",
		`give up: ${label} blocked in a dead end waits ${GIVE_UP} turns`,
		() => {
			// 行き止まりの通路（西の部屋から x=9〜20）。キリコは つながっていない部屋
			const l = dig(
				makeLayout([
					{ x: 2, y: 20, w: 7, h: 7 },
					{ x: 40, y: 2, w: 11, h: 9 },
				]),
				{ x: 9, y: 23 },
				{ x: 20, y: 23 },
			);
			const r = arena(`pursuit-giveup-${label}`, l, { x: 45, y: 6 });
			const m = put(r, kind, { x: 20, y: 23 });
			Object.assign(m.status, status);
			lostHere(m, 2); // 行き止まりの奥で 東を向いて見失った
			let gaveUp = 0;
			for (let t = 1; t <= GIVE_UP + 1 && !gaveUp; t++) {
				turn(r);
				if (!m.hunt) gaveUp = t;
				else ok(m.x === 20 && m.y === 23, `turn ${t}: moved while blocked`);
			}
			ok(gaveUp > 0, `still hunting after ${GIVE_UP + 1} turns`);
			ok(gaveUp >= GIVE_UP, `gave up after ${gaveUp} turn(s)`);
		},
	);

test(
	"pursuit",
	`hunt budget: a loop is given up within ${HUNT_STEPS + GIVE_UP} acts`,
	() => {
		// 輪になった通路（左折の法則だけなら いつまでも回る）。キリコは つながっていない部屋
		const l = dig(
			makeLayout([{ x: 40, y: 20, w: 11, h: 9 }]),
			{ x: 4, y: 4 },
			{ x: 30, y: 4 },
			{ x: 30, y: 14 },
			{ x: 4, y: 14 },
			{ x: 4, y: 4 },
		);
		const r = arena("pursuit-loop", l, { x: 45, y: 24 });
		const m = put(r, "knight", { x: 10, y: 4 });
		lostHere(m, 2);
		let moves = 0;
		const n = waitTurns(r, 100, (ev) => {
			moves += count(ev, "move", m.uid);
			return !m.hunt;
		});
		ok(n > 0, `still hunting after 100 turns (hunt=${m.hunt})`);
		ok(moves >= HUNT_STEPS / 2, `followed the loop only ${moves} steps`);
		ok(n <= HUNT_STEPS + GIVE_UP, `hunted for ${n} acts`);
	},
);

test(
	"pursuit",
	"room crossing: leaves by the other exit, then keeps going",
	() => {
		// 西の通路 → 部屋（入口は西と北）→ 北の出口 → 通路。キリコは つながっていない部屋
		const room = { x: 15, y: 12, w: 11, h: 9 };
		const west = { x: 14, y: 16 };
		const north = { x: 20, y: 11 };
		for (let i = 0; i < 6; i++) {
			const l = makeLayout([room, { x: 40, y: 22, w: 11, h: 8 }]);
			dig(l, { x: 3, y: 16 }, west);
			dig(l, north, { x: 20, y: 3 }, { x: 35, y: 3 });
			const r = arena(`pursuit-room-${i}`, l, { x: 45, y: 25 });
			const m = put(r, "knight", { x: 8, y: 16 });
			lostHere(m, 2);
			const path: Pos[] = [];
			let inside = -1;
			let out = -1;
			for (let t = 0; t < 40 && (out < 0 || path.length < out + 5); t++) {
				turn(r);
				path.push({ x: m.x, y: m.y });
				const rm = roomAt(l, m.x, m.y);
				if (inside < 0 && rm === 0) inside = path.length - 1;
				else if (inside >= 0 && out < 0 && rm < 0) out = path.length - 1;
			}
			const trail = path.map(pp).join(" ");
			ok(inside >= 0, `seed ${i}: never entered the room: ${trail}`);
			ok(out >= 0, `seed ${i}: never left the room: ${trail}`);
			ok(
				samePos(path[out], north),
				`seed ${i}: left by ${pp(path[out])}, not the other exit ${pp(north)}: ${trail}`,
			);
			const back = path.slice(out + 1).find((p) => roomAt(l, p.x, p.y) >= 0);
			ok(
				!back,
				`seed ${i}: walked back into the room at ${pp(back)}: ${trail}`,
			);
			ok(m.hunt, `seed ${i}: stopped hunting in the corridor: ${trail}`);
		}
	},
);

test("pursuit", "sleep: a pursuer that falls asleep forgets the chase", () => {
	// 見えていた敵に 眠りの杖
	const r = arena("pursuit-sleep");
	const m = put(r, "knight", at(-5, 0));
	turn(r);
	ok(remembers(m, r.p), "harness: did not see the player");
	staffEffect(r, "w_sleep", m);
	turn(r);
	ok(m.status.sleep > 0, "harness: woke up");
	ok(
		m.lastSeen === null && !m.hunt,
		`asleep but remembers ${pp(m.lastSeen)} (hunt=${m.hunt})`,
	);

	// あとをたどっている敵が眠った（status.sleep）。起きても たどりなおさない
	const r2 = arena("pursuit-sleep-hunt", corridorLayout(40), { x: 4, y: 16 });
	const h = put(r2, "knight", { x: 30, y: 16 });
	lostHere(h, 2);
	turn(r2);
	ok(h.hunt, "harness: not hunting");
	h.status.sleep = 5;
	turn(r2);
	ok(
		!h.hunt && h.lastSeen === null,
		`asleep but still hunting (hunt=${h.hunt})`,
	);
	waitTurns(r2, 6, () => false);
	ok(h.status.sleep === 0, "harness: still asleep");
	ok(
		!h.hunt && h.lastSeen === null,
		`picked the chase up after waking (hunt=${h.hunt}, lastSeen ${pp(h.lastSeen)})`,
	);
});

/**
 * 飛ばされる前の場：西と東に部屋、そのあいだの通路（y=5）から南へ のびる行き止まり（x=24）。
 * キリコは行き止まりの奥、敵は そのとなり。飛ばされた先（どちらかの部屋）から さまようだけなら
 * 行き止まりには入らない。キリコの位置を覚えていれば まっすぐ戻ってくる。
 */
const spurArena = (seed: string): { r: Run; m: Monster } => {
	const l = makeLayout([
		{ x: 2, y: 2, w: 7, h: 7 },
		{ x: 40, y: 2, w: 9, h: 7 },
	]);
	dig(l, { x: 9, y: 5 }, { x: 39, y: 5 });
	dig(l, { x: 24, y: 6 }, { x: 24, y: 14 });
	const r = arena(seed, l, { x: 24, y: 14 });
	const m = put(r, "knight", { x: 24, y: 13 });
	turn(r); // となりで なぐらせる（キリコを見た）
	ok(remembers(m, r.p), "harness: did not see the player");
	return { r, m };
};

/** 飛ばされたあと n ターン：キリコの所へ戻ってこない・思い出さない。 */
const staysAway = (r: Run, m: Monster, n: number, how: string): void => {
	ok(
		m.lastSeen === null && !m.hunt,
		`${how}: remembers ${pp(m.lastSeen)} after the warp (hunt=${m.hunt})`,
	);
	for (let t = 1; t <= n; t++) {
		turn(r);
		ok(dist(m, r.p) > 1, `${how}: came back to the player on turn ${t}`);
		ok(
			m.lastSeen === null,
			`${how}: turn ${t}: heading for ${pp(m.lastSeen)} without seeing the player`,
		);
	}
};

test("pursuit", "warp: thrown h_blink makes it lose the player", () => {
	const { r, m } = spurArena("pursuit-blink");
	let warped = false;
	for (let i = 0; i < 10 && !warped; i++) {
		const it = give(r, "h_blink");
		warped =
			count(turn(r, { c: "throw", item: it.uid, dir: 0 }), "warp", m.uid) > 0;
	}
	ok(warped, "the herb never hit");
	staysAway(r, m, 40, "h_blink");
});

test("pursuit", "warp: w_send makes it lose the player", () => {
	const { r, m } = spurArena("pursuit-send");
	staffEffect(r, "w_send", m);
	ok(dist(m, r.p) > 1, "harness: not sent away");
	staysAway(r, m, 40, "w_send");
});

test("pursuit", "thrown hit from out of sight: heads for the thrower", () => {
	const r = arena("pursuit-throw", corridorLayout(40), { x: 20, y: 16 });
	const home = { x: 26, y: 16 };
	const m = put(r, "knight", home);
	m.maxHp = 999;
	m.hp = 999;
	ok(!canSee(r.f.layout, m, r.p), "harness: it can see the player");
	let hit = false;
	for (let i = 0; i < 10 && !hit; i++) {
		m.x = home.x;
		m.y = home.y;
		ok(m.lastSeen === null, "remembered the player before being hit");
		const it = give(r, "a_wood");
		hit =
			hurts(turn(r, { c: "throw", item: it.uid, dir: 2 }), m.uid).length > 0;
	}
	ok(hit, "the arrow never hit");
	ok(
		remembers(m, r.p),
		`remembers ${pp(m.lastSeen)}, not the thrower at ${pp(r.p)}`,
	);
	ok(m.x < home.x, `did not come toward the thrower (at ${pp(m)})`);
});

/** 追いかけを覚えない敵（となりにいても lastSeen がつかない）。 */
const NON_TRACKERS: {
	why: string;
	kind: string;
	status?: Partial<Monster["status"]>;
	set?: Partial<Monster>;
}[] = [
	{ why: "shy", kind: "funamushi" },
	{ why: "metal", kind: "metal" },
	{ why: "grab", kind: "kaso" },
	{ why: "asleep", kind: "knight", status: { sleep: DEEP } },
	{ why: "dormant statue", kind: "statue" },
	{ why: "disguised mimic", kind: "bakefuda" },
	{ why: "confused", kind: "knight", status: { confuse: 10 } },
	{ why: "paralyzed", kind: "knight", status: { paralyze: 5 } },
	{ why: "blind", kind: "knight", status: { blind: true } },
	{ why: "fused bomb", kind: "bomb", set: { fuse: true } },
	{ why: "fleeing thief", kind: "tensai", set: { fleeing: true } },
	{ why: "retreating chimera", kind: "chimera", set: { retreating: true } },
];

test(
	"pursuit",
	"non-trackers: being adjacent does not make them remember",
	() => {
		for (const c of NON_TRACKERS) {
			const r = arena(`pursuit-notrack-${c.why}`);
			// 釣りは 起きている指定だと化けない
			const m = put(
				r,
				c.kind,
				at(1, 0),
				c.kind === "bakefuda" ? {} : undefined,
			);
			Object.assign(m.status, c.status);
			Object.assign(m, c.set);
			ok(
				c.kind !== "bakefuda" || m.disguise,
				"harness: the mimic is not disguised",
			);
			ok(
				c.kind !== "statue" || m.status.dormant,
				"harness: the statue is awake",
			);
			const control = put(r, "knight", at(-1, 0));
			noticeAdjacent(r);
			ok(
				remembers(control, r.p),
				"harness: an ordinary knight did not remember",
			);
			ok(m.lastSeen === null, `${c.why} ${c.kind} remembered the player`);
		}
	},
);

test(
	"pursuit",
	"sealed: a retreating chimera stops retreating, tracks again",
	() => {
		// 封印の杖：逃げるのをやめる（ほかの所からも 逃げていないと見える）
		const r = arena("pursuit-chimera");
		const m = put(r, "chimera", at(1, 0));
		m.hp = Math.floor(m.maxHp * 0.4);
		turn(r);
		ok(m.retreating, "harness: did not start retreating");
		staffEffect(r, "w_seal", m);
		ok(!now(m).retreating, "still retreating after w_seal");
		m.x = CENTER.x + 1;
		m.y = CENTER.y;
		noticeAdjacent(r);
		ok(remembers(m, r.p), "a sealed chimera did not remember the player");

		// 逃げている印が残っていても、逃げる力が封じられていれば 追いかけを覚える
		const r2 = arena("pursuit-chimera-flag");
		const c = put(r2, "chimera", at(1, 0));
		c.retreating = true;
		noticeAdjacent(r2);
		ok(c.lastSeen === null, "harness: a retreating chimera remembered");
		c.status.sealed = true;
		noticeAdjacent(r2);
		ok(remembers(c, r2.p), "sealed but still counts as retreating");
	},
);

test("pursuit", "transformed: loses berserk/accel speed and the chase", () => {
	const r = arena("pursuit-change-oni");
	const oni = put(r, "oni", at(-3, 0));
	turn(r);
	r.damageMonster(oni, oni.hp - Math.floor(oni.maxHp / 2), "hit");
	ok(oni.enraged && oni.status.fast === 999, "harness: not enraged");
	ok(remembers(oni, r.p), "harness: did not see the player");
	transformMonster(r, oni);
	ok(oni.kind !== "oni", "harness: did not transform");
	ok(
		!now(oni).enraged && now(oni).status.fast === 0,
		`kept the berserk speed as ${oni.kind} (fast=${oni.status.fast})`,
	);
	ok(
		oni.lastSeen === null && !oni.hunt,
		`still remembers ${pp(oni.lastSeen)} as ${oni.kind}`,
	);

	const r2 = arena("pursuit-change-ksk");
	const ksk = put(r2, "ksk", at(1, 0));
	waitTurns(r2, 8, () => ksk.status.fast === 999);
	ok(ksk.status.fast === 999, "harness: did not accelerate");
	transformMonster(r2, ksk);
	ok(
		now(ksk).status.fast === 0 && !now(ksk).seenTurns,
		`kept the accel speed as ${ksk.kind} (fast=${ksk.status.fast})`,
	);
});

test("pursuit", "transformed: a haste from w_haste is kept", () => {
	const r = arena("pursuit-change-haste");
	const ksk = put(r, "ksk", at(1, 0));
	turn(r); // となりで1回 やりあった（まだ加速していない）
	ok(
		ksk.seenTurns === 1 && ksk.status.fast === 0,
		`harness: seenTurns=${ksk.seenTurns} fast=${ksk.status.fast}`,
	);
	staffEffect(r, "w_haste", ksk);
	transformMonster(r, ksk);
	ok(
		now(ksk).status.fast === 999,
		`lost the w_haste speed as ${ksk.kind} (fast=${ksk.status.fast})`,
	);
});

test("pursuit", "sealed: berserk/accel speed goes, a w_haste stays", () => {
	// 封印の杖・目つぶし草：とくちょうで ついた速さは消える（杖で速くしたのは そのまま）
	const r = arena("pursuit-seal-oni");
	const oni = put(r, "oni", at(-3, 0));
	turn(r);
	r.damageMonster(oni, oni.hp - Math.floor(oni.maxHp / 2), "hit");
	ok(oni.enraged && oni.status.fast === 999, "harness: not enraged");
	staffEffect(r, "w_seal", oni);
	ok(
		now(oni).status.fast === 0 && !now(oni).enraged,
		`sealed oni kept its berserk speed (fast=${oni.status.fast})`,
	);

	const r2 = arena("pursuit-seal-ksk");
	const ksk = put(r2, "ksk", at(1, 0));
	for (let i = 0; i < 6 && ksk.status.fast === 0; i++) turn(r2);
	ok(ksk.status.fast === 999, "harness: ksk did not accelerate");
	let blinded = false;
	for (let i = 0; i < 10 && !blinded; i++) {
		const it = give(r2, "h_blind");
		turn(r2, { c: "throw", item: it.uid, dir: 2 });
		blinded = !!ksk.status.blind;
	}
	ok(blinded, "the herb never hit");
	ok(
		now(ksk).status.sealed && now(ksk).status.fast === 0,
		`blinded ksk kept its accel speed (fast=${now(ksk).status.fast})`,
	);

	const r3 = arena("pursuit-seal-haste");
	const k3 = put(r3, "knight", at(1, 0));
	staffEffect(r3, "w_haste", k3);
	staffEffect(r3, "w_seal", k3);
	ok(now(k3).status.fast === 999, "a w_haste speed was removed by the seal");
});

test(
	"herb",
	"h_daze: drinking dazes, hides names; the big herb cures it",
	() => {
		// トルネコ1の まどわし草：飲むと 50ターン まどわされ、弟切草で なおる
		const r = arena("daze-drink");
		const m = put(r, "tousuko", at(3, 0));
		turn(r, { c: "use", item: give(r, "h_daze").uid });
		ok(r.p.status.daze >= 49, `not dazed (daze=${r.p.status.daze})`);
		ok(monsterName(r, m) === "なにか", `name shown: ${monsterName(r, m)}`);
		turn(r, { c: "use", item: give(r, "h_greater").uid });
		ok(r.p.status.daze === 0, "the big herb did not cure daze");
		ok(monsterName(r, m) === mdef(m).name, "name still hidden after the cure");
	},
);

test("herb", "h_daze: a monster it hits keeps fleeing", () => {
	const r = arena("daze-throw");
	const m = put(r, "tousuko", at(1, 0));
	for (let i = 0; i < 10 && !m.fleeing; i++)
		turn(r, { c: "throw", item: give(r, "h_daze").uid, dir: 2 });
	ok(!!m.fleeing, "the herb never made it flee");
	for (let i = 0; i < 20; i++) turn(r);
	ok(!!now(m).fleeing && dist(m, r.p) > 1, "the monster stopped fleeing");
});

test("herb", "h_blind: even an adjacent monster is not visible", () => {
	const r = arena("blind-adjacent");
	const m = put(r, "tousuko", at(1, 0));
	ok(r.monsterVisible(m), "harness: not visible before");
	turn(r, { c: "use", item: give(r, "h_blind").uid });
	ok(!r.monsterVisible(now(m)), "an adjacent monster was visible while blind");
});

test("scroll", "s_blast from a room's entrance hits the whole room", () => {
	// トルネコ1の イオと 同じく 見えている 敵に 効く（入口からは 部屋ぜんぶが 見える）
	const r = arena("blast-entrance", corridorLayout(20), { x: 7, y: 16 });
	const far = put(r, "knight", { x: 3, y: 15 }, { sleep: 99 });
	const hp0 = far.hp;
	turn(r, { c: "use", item: give(r, "s_blast").uid });
	ok(
		!r.f.monsters.includes(far) || far.hp < hp0,
		"a monster inside the room was not hit",
	);
});

test("staff", "w_rebut: found with 0 charges, then kills in one shot", () => {
	const r = arena("rebut");
	const m = put(r, "knight", at(3, 0));
	const it = give(r, "w_rebut");
	ok(r.newItem("w_rebut").charges === 0, "w_rebut was found with charges");
	it.charges = 1;
	turn(r, { c: "use", item: it.uid });
	ok(!r.f.monsters.includes(m), "the monster survived");
	ok(it.charges === 0, "no charge was used");
});

test("scroll", "s_recharge: a staff gains charges, a scroll is copied", () => {
	const r = arena("recharge");
	const staff = give(r, "w_bolt");
	const c0 = staff.charges;
	turn(r, { c: "use", item: give(r, "s_recharge").uid, target: staff.uid });
	ok(staff.charges > c0, "the staff gained no charges");
	const blast = give(r, "s_blast");
	const n0 = r.p.items.length;
	turn(r, { c: "use", item: give(r, "s_recharge").uid, target: blast.uid });
	const copies = r.p.items.filter((i) => i.kind === "s_blast");
	ok(copies.length === 2, `s_blast count ${copies.length}`);
	ok(r.p.items.length === n0 + 1, "the read 次スレ was not used up");
	ok(new Set(r.p.items.map((i) => i.uid)).size === r.p.items.length, "uid");
	const herb = give(r, "h_heal");
	turn(r, { c: "use", item: give(r, "s_recharge").uid, target: herb.uid });
	ok(r.p.items.filter((i) => i.kind === "h_heal").length === 1, "herb copied");
});

test("scroll", "s_gacha: every one of the 8 outcomes can happen", () => {
	const marks: [string, (r: Run, depth0: number) => boolean][] = [
		["全快", (r) => r.s.log.some((l) => l.includes("満タンに"))],
		["最大+3", (r) => r.s.log.some((l) => l.includes("3　上がった"))],
		["Lv+3", (r) => r.p.lv >= 4],
		["装備+3", (r) => r.s.log.some((l) => l.includes("強くなった"))],
		["全滅", (r) => r.s.log.some((l) => l.includes("いなくなった"))],
		["道具に", (r) => r.s.log.some((l) => l.includes("道具に　なった"))],
		["メタル", (r) => r.f.monsters.some((m) => m.kind === "metal")],
		["落ちる", (r, d0) => r.s.depth === d0 + 5],
	];
	const seen = new Set<string>();
	for (let i = 0; i < 200 && seen.size < marks.length; i++) {
		const r = arena(`gacha-${i}`);
		put(r, "knight", at(0, 5), { sleep: 99 });
		r.f.sight = true; // 見透し草を 飲んだ 階でだけ 読める
		const d0 = r.s.depth;
		turn(r, { c: "use", item: give(r, "s_gacha").uid });
		for (const [name, hit] of marks) if (hit(r, d0)) seen.add(name);
	}
	const missing = marks.map(([n]) => n).filter((n) => !seen.has(n));
	ok(!missing.length, `never happened: ${missing.join(", ")}`);
});

test("scroll", "s_gacha: hidden and unreadable until h_sight", () => {
	const r = arena("gacha-hidden");
	const it = give(r, "s_gacha");
	const fi = r.newItem("s_gacha");
	r.f.items.push({ x: r.p.x + 2, y: r.p.y, item: fi });
	turn(r);
	ok(!r.s.seen.includes(fi.uid), "the hidden scroll on the floor was seen");
	ok(r.name(it) === "見えない　何か", `named ${r.name(it)}`);
	const t0 = r.s.turn;
	turn(r, { c: "use", item: it.uid });
	ok(r.s.turn === t0 && r.findItem(it.uid), "read without h_sight");
	turn(r, { c: "use", item: give(r, "h_sight").uid });
	ok(r.name(it) !== "見えない　何か", "still hidden after h_sight");
	ok(r.s.seen.includes(fi.uid), "the floor scroll stayed unseen after h_sight");
	turn(r, { c: "use", item: it.uid });
	ok(!r.findItem(it.uid), "could not read it after h_sight");
});

test("scroll", "s_map then s_snare: the new traps are already found", () => {
	const r = arena("map-then-snare");
	turn(r, { c: "use", item: give(r, "s_map").uid });
	const before = r.f.traps.length;
	turn(r, { c: "use", item: give(r, "s_snare").uid });
	ok(r.f.traps.length > before, "harness: s_snare added no traps");
	ok(
		r.f.traps.every((t) => t.found),
		"traps added after s_map were hidden",
	);
});

test(
	"floor",
	"thread: 1 res a turn; shakes at 950 and 980, dat-falls to the next floor at 1000",
	() => {
		// 1つの階は 1本の スレ。950 で 揺れ、980 で 埋め、1000 で 下の階へ
		const r = arena("quake");
		const at = (res: number): GameEvent[] => {
			r.f.res = res - 1;
			r.p.hunger = HUNGER_MAX;
			return r.act({ c: "wait" });
		};
		const quakes = (ev: GameEvent[]) =>
			ev
				.filter((e) => e.t === "quake")
				.map((e) => (e as { level: number }).level);
		ok(quakes(at(949)).length === 0, "shook before 950");
		ok(r.f.res === 949, `res did not grow by 1 a turn (${r.f.res})`);
		ok(quakes(at(950)).join() === "1", "no first quake at 950");
		ok(quakes(at(960)).length === 0, "shook again between 950 and 980");
		ok(quakes(at(980)).join() === "2", "no second quake at 980");
		const depth = r.s.depth;
		ok(quakes(at(999)).length === 0 && r.s.depth === depth, "fell before 1000");
		at(1000);
		ok(r.s.depth === depth + 1, `did not fall at 1000 (depth ${r.s.depth})`);
		ok(r.f.res <= 1, `the new floor did not start a new thread (${r.f.res})`);
	},
);

test(
	"floor",
	"anka: comes at its res; doing it gives 2 known items, ignoring it adds res, wakes the floor and 3 trolls",
	() => {
		const r = arena("anka");
		const herb = give(r, "h_heal");
		// 来る：決めた レス数まで 伸びたら（お題は 持ち物で できる ものから）
		r.f.ankaAt = 30;
		r.f.res = 29;
		r.act({ c: "wait" });
		ok(r.f.anka, "no anka at its res");
		ok(r.f.ankaAt === -1, "the anka was left scheduled");
		// こなす：草を 飲めば 足元に 正体つきの 道具が 2つ
		r.f.anka = { kind: "herb", need: 1, done: 0, due: r.f.res + 100 };
		r.f.res = 500;
		const items = r.f.items.length;
		r.act({ c: "use", item: herb.uid });
		ok(!r.f.anka, "drinking a herb did not clear the herb anka");
		const gifts = r.f.items.slice(items);
		ok(gifts.length === 2, `${gifts.length} gifts for the anka`);
		ok(
			gifts.every((fi) => fi.item.known && isKnownKind(r.s, fi.item.kind)),
			"a gift was not identified",
		);
		// 敵を 2体 たおす：1体では まだ
		r.f.anka = { kind: "kill", need: 2, done: 0, due: r.f.res + 100 };
		for (let i = 0; i < 2; i++) {
			const m = put(r, "tousuko", { x: CENTER.x, y: CENTER.y - 1 });
			m.hp = 1;
			for (let k = 0; k < 20 && m.hp > 0; k++) r.act({ c: "attack", dir: 0 });
			ok(m.hp <= 0, "harness: could not kill the target");
			ok(!!r.f.anka === (i === 0), `the kill anka was wrong after ${i + 1}`);
		}
		// 守らない：期限で レスが 伸び、眠っていた 敵が 起き、荒らしが 3体 来る
		const sleeper = put(
			r,
			"tousuko",
			{ x: CENTER.x + 6, y: CENTER.y + 6 },
			{
				sleep: DOZE,
			},
		);
		r.f.anka = { kind: "scroll", need: 1, done: 0, due: r.f.res + 1 };
		const res = r.f.res;
		const mons = r.f.monsters.length;
		r.act({ c: "wait" });
		ok(!r.f.anka, "the anka did not expire");
		ok(
			r.f.res >= res + 100,
			`the ignored anka added only ${r.f.res - res} res`,
		);
		ok(
			r.f.monsters.length === mons + 3,
			`${r.f.monsters.length - mons} trolls came for the ignored anka`,
		);
		ok(sleeper.status.sleep === 0, "a sleeping monster slept through it");
	},
);

test(
	"floor",
	"anka: eat counts bread only, sleep counts any sleep, hit counts 3 landed enemy attacks; each comes only when doable",
	() => {
		// 食う：草を 飲んでも 数えない。パンを 食べれば 神安価
		const r = arena("anka-kinds");
		const herb = give(r, "h_heal");
		const bread = give(r, "f_bread");
		r.f.anka = { kind: "eat", need: 1, done: 0, due: 500 };
		r.act({ c: "use", item: herb.uid });
		ok(r.f.anka?.kind === "eat", "drinking a herb cleared the eat anka");
		r.act({ c: "use", item: bread.uid });
		ok(!r.f.anka, "eating bread did not clear the eat anka");
		ok(
			ankaText({ kind: "eat", need: 1, done: 0, due: 0 }).includes("パン"),
			"the eat anka does not say bread",
		);
		// 寝る：眠りの 罠でも 数える
		r.f.anka = { kind: "sleep", need: 1, done: 0, due: 500 };
		triggerTrap(r, { x: r.p.x, y: r.p.y, kind: "sleep", found: false });
		ok(r.p.status.sleep > 0, "harness: the sleep trap did not fire");
		ok(!r.f.anka, "falling asleep on a trap did not clear the sleep anka");
		// 攻撃を 3回 受ける：はずれは 数えない。当たった 3回目で 神安価
		const h = arena("anka-hit");
		put(h, "tousuko", { x: CENTER.x, y: CENTER.y - 1 });
		h.f.anka = { kind: "hit", need: 3, done: 0, due: 5000 };
		let landed = 0;
		for (let i = 0; i < 60 && h.f.anka; i++) {
			const ev = h.act({ c: "wait" });
			landed += hurts(ev, PLAYER_ID).length;
			ok(
				!!h.f.anka === landed < 3,
				`the hit anka was wrong after ${landed} hits`,
			);
			if (h.f.anka)
				ok(
					h.f.anka.done === landed,
					`hit anka counted ${h.f.anka.done}, landed ${landed}`,
				);
		}
		ok(landed >= 3, "harness: the enemy never landed 3 hits");
		// 来る 条件：寝るは 正体の わかった 寝落ち草を 持つ ときだけ、受けるは 敵が いる ときだけ
		const kinds = (x: Run): Set<string> => {
			const seen = new Set<string>();
			for (let i = 0; i < 80; i++) {
				x.f.anka = null;
				x.f.ankaAt = x.f.res;
				tickAnka(x);
				// （TS は 上で null を 入れたので null と 思いこむ）
				const a = x.f.anka as { kind: string } | null;
				if (a) seen.add(a.kind);
			}
			return seen;
		};
		const d = arena("anka-doable");
		d.p.items = [];
		let got = kinds(d);
		ok(
			!got.has("sleep") &&
				!got.has("hit") &&
				!got.has("eat") &&
				!got.has("throw"),
			`undoable anka came: ${[...got]}`,
		);
		give(d, "h_sleep");
		put(d, "tousuko", at(8, 8));
		got = kinds(d);
		ok(!got.has("sleep"), "sleep came with an unidentified sleep herb");
		ok(got.has("hit"), "hit never came with an enemy on the floor");
		d.s.ids.known.h_sleep = true;
		ok(kinds(d).has("sleep"), "sleep never came with a known sleep herb");
	},
);

test(
	"floor",
	"anka: staff, drop, equip, trap, level and rest count only their own act; each comes only when doable",
	() => {
		const r = arena("anka-more");
		// （関数で 読む：TS が 上の ok で null と 思いこむので）
		const cur = (): string | undefined => r.f.anka?.kind;
		const set = (kind: AnkaKind, need = 1) => {
			r.f.anka = { kind, need, done: 0, due: r.f.res + 5000 };
		};
		// 杖を ふる：のこりが 0 でも 数える
		const staff = give(r, "w_bolt");
		staff.charges = 0;
		set("staff");
		r.act({ c: "use", item: staff.uid });
		ok(!r.f.anka, "waving a staff did not clear the staff anka");
		// 置く：投げるのは 数えない
		const herb = give(r, "h_heal");
		const club = give(r, "club");
		set("drop");
		r.act({ c: "throw", item: club.uid, dir: 0 });
		ok(cur() === "drop", "throwing cleared the drop anka");
		r.f.items = [];
		r.act({ c: "drop", item: herb.uid });
		ok(!r.f.anka, "dropping did not clear the drop anka");
		// 装備を かえる：外すだけは 数えない
		const sword = give(r, "club");
		set("equip");
		if (r.weapon()) r.act({ c: "unequip", item: r.weapon()?.uid ?? -1 });
		ok(cur() === "equip", "unequipping cleared the equip anka");
		r.act({ c: "equip", item: sword.uid });
		ok(r.isEquipped(sword), "harness: could not equip");
		ok(!r.f.anka, "equipping did not clear the equip anka");
		// 罠を 踏む：動かなくても 数える
		r.f.items = [];
		r.f.traps = [
			{ ...at(0, -1, { x: r.p.x, y: r.p.y }), kind: "bear", found: true },
		];
		set("trap");
		r.act({ c: "move", dir: 0 });
		ok(
			r.f.traps[0].x === r.p.x && r.f.traps[0].y === r.p.y,
			"harness: not on the trap",
		);
		ok(!r.f.anka, "stepping on a trap did not clear the trap anka");
		r.f.traps = [];
		r.p.status.trapped = 0;
		// レベル：1段で 神安価
		set("level");
		r.p.exp = EXP_AT[r.p.lv] - 1;
		const lv = r.p.lv;
		r.gainExp(1);
		ok(r.p.lv === lv + 1, "harness: no level up");
		ok(!r.f.anka, "leveling up did not clear the level anka");
		// 足踏み：10回目で 神安価（ほかの 行動は 数えない）
		set("rest", 10);
		r.act({ c: "turn", dir: 2 });
		for (let i = 1; i <= 10; i++) {
			r.act({ c: "wait" });
			ok(!!r.f.anka === i < 10, `the rest anka was wrong after ${i} waits`);
		}
		ok(
			ankaText({ kind: "rest", need: 10, done: 0, due: 0 }).includes("10"),
			"the rest anka does not say 10",
		);
		// 落とし穴：落ちた 先で 神安価になり、道具は 落ちた 先の 足元に
		const pit = Run.create("anka-pit", "main");
		const depth = pit.s.depth;
		for (let i = 0; i < 20 && pit.s.depth === depth; i++) {
			pit.f.anka = { kind: "trap", need: 1, done: 0, due: pit.f.res + 500 };
			triggerTrap(pit, { x: pit.p.x, y: pit.p.y, kind: "pit", found: false });
		}
		ok(pit.s.depth === depth + 1, "harness: the pit never fired");
		ok(!pit.f.anka, "the trap anka survived the fall");
		ok(
			pit.f.items.filter((fi) => samePos(fi, pit.p)).length > 0,
			"the gifts were not at the feet after the fall",
		);
		// 来る 条件：持ち物・罠・経験値しだい。足踏みは いつでも
		const kinds = (x: Run): Set<string> => {
			const seen = new Set<string>();
			for (let i = 0; i < 200; i++) {
				x.f.anka = null;
				x.f.ankaAt = x.f.res;
				tickAnka(x);
				const a = x.f.anka as { kind: string } | null;
				if (a) seen.add(a.kind);
			}
			return seen;
		};
		const d = arena("anka-more-doable");
		d.p.items = [];
		d.p.weapon = null;
		d.p.shield = null;
		d.p.ring = null;
		d.p.lv = 5;
		d.p.exp = EXP_AT[4];
		let got = kinds(d);
		for (const k of ["staff", "drop", "equip", "trap", "level"])
			ok(!got.has(k), `undoable ${k} anka came`);
		ok(got.has("rest"), "rest never came");
		give(d, "w_bolt");
		give(d, "club");
		d.f.traps = [{ ...at(3, 3), kind: "bear", found: true }];
		d.p.exp = EXP_AT[5] - 1;
		got = kinds(d);
		for (const k of ["staff", "drop", "equip", "trap", "level"])
			ok(got.has(k), `${k} anka never came when doable`);
		// のろわれた 武器を 持っていると、武器の 付けかえは 来ない
		const e = arena("anka-more-cursed");
		e.p.items = [];
		e.p.shield = null;
		e.p.ring = null;
		const bad = give(e, "club");
		e.p.weapon = bad.uid;
		bad.cursed = true;
		give(e, "club");
		got = kinds(e);
		ok(!got.has("equip"), "equip came under a cursed weapon");
	},
);

test(
	"floor",
	"statue: plain statues stand on statue floors only, block the way without splitting rooms, and look like a posing statue",
	() => {
		let seen = 0;
		for (let i = 0; i < 12; i++) {
			const r = Run.create(`statue-floor-${i}`);
			r.enterFloor(15, false);
			const f = r.f;
			const l = f.layout;
			const st = f.statues ?? [];
			seen += st.length;
			ok(st.length <= 4, `${st.length} statues on one floor`);
			for (const k of st)
				ok(l.tiles[k] === T_WALL, "a statue can be walked through");
			// 置物が あっても 床は ぜんぶ つながっている
			const floors: number[] = [];
			for (let k = 0; k < l.tiles.length; k++)
				if (l.tiles[k] !== T_WALL) floors.push(k);
			const reach = new Set<number>([r.p.y * l.w + r.p.x]);
			const todo = [...reach];
			while (todo.length) {
				const k = todo.pop() as number;
				const x = k % l.w;
				const y = (k - x) / l.w;
				for (const [dx, dy] of [
					[1, 0],
					[-1, 0],
					[0, 1],
					[0, -1],
				]) {
					const n = (y + dy) * l.w + x + dx;
					if (!reach.has(n) && isFloor(l, x + dx, y + dy)) {
						reach.add(n);
						todo.push(n);
					}
				}
			}
			ok(
				reach.size === floors.length,
				`statues cut off ${floors.length - reach.size} floor tiles`,
			);
			ok(
				!f.items.some((it) => st.includes(it.y * l.w + it.x)) &&
					!f.monsters.some((m) => st.includes(m.y * l.w + m.x)),
				"something was put on a statue",
			);
		}
		ok(seen > 0, "no plain statues on the statue floors");
		// 置物の 敵が 出ない 階には 置かない
		const early = Run.create("statue-floor-early");
		ok(!early.f.statues?.length, "plain statues on floor 1");
		// 動きだす 前の 置物の 敵は ただの 置物と 同じ 見た目、となりに 来ると 動きだす
		const r = arena("statue-pose");
		const m = put(r, "statue", { x: CENTER.x + 3, y: CENTER.y });
		ok(m.status.dormant && posing(m), "a fresh statue is not posing");
		ok(!!mdef(m).still, "the statue has no still picture");
		m.x = CENTER.x + 1;
		for (let k = 0; k < 3 && m.status.dormant; k++) r.act({ c: "wait" });
		ok(!posing(m), "the statue kept posing next to Kiriko");
	},
);

test(
	"floor",
	"equip: wearing a weapon or shield reveals that one item's plus and curse, not others of the same kind",
	() => {
		const r = arena("equip-id");
		const kind = "club";
		const plain = give(r, kind);
		plain.plus = 2;
		plain.known = false;
		const twin = give(r, kind);
		twin.plus = 1;
		twin.known = false;
		r.doEquip(plain.uid);
		ok(plain.known, "equipping did not tell the plus of the weapon");
		ok(
			!twin.known,
			"equipping told the plus of another weapon of the same kind",
		);
		const bad = give(r, kind);
		bad.plus = -1;
		bad.cursed = true;
		bad.known = false;
		r.doEquip(bad.uid);
		ok(bad.known, "a cursed weapon did not reveal itself when equipped");
		const sh = give(r, "leather");
		sh.plus = 1;
		sh.known = false;
		r.doEquip(sh.uid);
		ok(sh.known, "equipping did not tell the plus of the shield");
	},
);

test(
	"floor",
	"anka: a pending anka follows Kiriko to the next floor with the res it had left",
	() => {
		const r = arena("anka-carry");
		const a = { kind: "scroll" as const, need: 1, done: 0, due: 0 };
		r.f.res = 400;
		a.due = r.f.res + 30;
		r.f.anka = a;
		r.enterFloor(r.s.depth + 1, false);
		ok(r.f.anka === a, "the anka vanished on the next floor");
		ok(
			r.f.anka.due - r.f.res === 30,
			`the carried anka has ${r.f.anka.due - r.f.res} res left, not 30`,
		);
		ok(r.f.ankaAt === -1, "a new anka was scheduled on top of the carried one");
	},
);

test(
	"floor",
	"gramophone: a kill records its voice; playing it freezes the same kind in sight only",
	() => {
		const r = arena("voice");
		const first = put(r, "tousuko", { x: CENTER.x, y: CENTER.y - 1 });
		first.hp = 1;
		for (let k = 0; k < 20 && first.hp > 0; k++)
			turn(r, { c: "attack", dir: 0 });
		ok(first.hp <= 0, "harness: could not kill the first one");
		ok(r.s.voice === "tousuko", `no voice recorded (${r.s.voice})`);
		const a = put(r, "tousuko", { x: CENTER.x + 4, y: CENTER.y });
		const b = put(r, "tousuko", { x: CENTER.x - 4, y: CENTER.y + 2 });
		const other = put(r, "hitodama", { x: CENTER.x, y: CENTER.y + 4 });
		turn(r, { c: "play" });
		ok(r.s.voice === null, "the voice was not used up");
		ok(
			a.status.paralyze > 0 && b.status.paralyze > 0,
			"the same kind did not freeze",
		);
		ok(other.status.paralyze === 0, "another kind froze too");
		const ev = r.act({ c: "play" });
		ok(!ev.some((e) => e.t === "fx"), "played an empty gramophone");
	},
);

/**
 * 部屋を抜けている途中の敵：西の小部屋（キリコ）→ 通路 → 部屋（入口は西と北。北の先は行き止まり）。
 * 通路で見失って 部屋に入り、北の出口へ向かっているところで返す。
 */
const crossing = (seed: string): { r: Run; m: Monster; exit: Pos } => {
	const exit = { x: 20, y: 11 };
	const l = makeLayout([
		{ x: 2, y: 14, w: 5, h: 5 },
		{ x: 15, y: 12, w: 11, h: 9 },
	]);
	dig(l, { x: 7, y: 16 }, { x: 14, y: 16 });
	dig(l, exit, { x: 20, y: 3 }, { x: 35, y: 3 });
	const r = arena(seed, l, { x: 3, y: 16 });
	const m = put(r, "knight", { x: 9, y: 16 });
	lostHere(m, 2);
	waitTurns(r, 8, () => false);
	ok(
		m.hunt && m.goal && samePos(m.goal, exit) && roomAt(l, m.x, m.y) === 1,
		`harness: not crossing the room toward ${pp(exit)} (at ${pp(m)}, goal ${pp(m.goal)})`,
	);
	return { r, m, exit };
};

test("pursuit", "forgetting also drops the exit it was heading for", () => {
	const cases: [string, (r: Run, m: Monster) => void][] = [
		["w_send", (r, m) => staffEffect(r, "w_send", m)],
		["w_sleep", (r, m) => staffEffect(r, "w_sleep", m)],
		["w_change", (r, m) => transformMonster(r, m)],
	];
	for (const [how, act] of cases) {
		const { r, m, exit } = crossing(`pursuit-forget-goal-${how}`);
		act(r, m);
		for (let t = 1; t <= 12; t++) {
			turn(r);
			ok(
				!samePos(m, exit) && !(m.goal && samePos(m.goal, exit)),
				`${how}: turn ${t}: still heading for the old exit ${pp(exit)} (at ${pp(m)} as ${m.kind})`,
			);
		}
	}
});

test(
	"pursuit",
	"room crossing: waits while the way to the other exit is blocked",
	() => {
		const room = { x: 15, y: 12, w: 11, h: 9 };
		const west = { x: 14, y: 16 };
		const north = { x: 20, y: 11 };
		const inside = { x: 15, y: 16 };
		const setup = (seed: string) => {
			const l = makeLayout([room, { x: 40, y: 22, w: 11, h: 8 }]);
			dig(l, { x: 3, y: 16 }, west);
			dig(l, north, { x: 20, y: 3 }, { x: 35, y: 3 });
			const r = arena(seed, l, { x: 45, y: 25 });
			const m = put(r, "knight", west);
			lostHere(m, 2); // 西の入口で見失った（東を向いて）
			// 入って すぐの まわりを 眠った敵で ふさぐ（戻る向きの 入口だけ あく）
			const wall = [
				{ x: 15, y: 15 },
				{ x: 16, y: 15 },
				{ x: 16, y: 16 },
				{ x: 16, y: 17 },
				{ x: 15, y: 17 },
			].map((p) => put(r, "knight", p, { sleep: DEEP }));
			turn(r);
			ok(samePos(m, inside) && m.hunt, "harness: did not step into the room");
			return { r, m, wall };
		};
		const blocked = (m: Monster, t: number): void => {
			ok(m.hunt, `blocked turn ${t}: stopped hunting`);
			ok(samePos(m, inside), `blocked turn ${t}: moved to ${pp(m)}`);
			ok(
				!!m.goal && samePos(m.goal, north),
				`blocked turn ${t}: no longer heading for ${pp(north)} (goal ${pp(m.goal)})`,
			);
		};

		// ふさがれて 2ターン待ち、道があいたら 北の出口へ
		const a = setup("pursuit-room-blocked-clear");
		for (let t = 1; t <= 2; t++) {
			turn(a.r);
			blocked(a.m, t);
		}
		a.r.f.monsters = a.r.f.monsters.filter((x) => !a.wall.includes(x));
		const n = waitTurns(a.r, 12, () => samePos(a.m, north));
		ok(n > 0, `did not go on to ${pp(north)} (at ${pp(a.m)})`);

		// ふさがれたままなら GIVE_UP ターンで あきらめる
		const b = setup("pursuit-room-blocked-stay");
		for (let t = 1; t < GIVE_UP; t++) {
			turn(b.r);
			blocked(b.m, t);
		}
		ok(
			waitTurns(b.r, 2, () => !b.m.hunt) > 0,
			`still waiting after ${GIVE_UP + 1} blocked turns`,
		);
	},
);

test("pursuit", "fastMove: looks again before the second step", () => {
	// 通路（x=11）が 部屋の西の壁ぞいを通る：y=12〜18 は 部屋の入口
	const l = dig(
		makeLayout([{ x: 12, y: 12, w: 9, h: 7 }]),
		{ x: 11, y: 5 },
		{ x: 11, y: 25 },
	);
	const r = arena("pursuit-fast-look", l, { x: 16, y: 16 });
	const m = put(r, "hitodama", { x: 11, y: 19 });
	m.lastSeen = { x: 11, y: 5 }; // 前に見た所（通路の北）へ向かっている
	ok(!canSee(l, m, r.p), "harness: it can see the player already");
	turn(r);
	// 1歩目で入口 (11,18) に出て キリコが見えた → 2歩目は 部屋の中のキリコへ（通路を北へ ではなく）
	ok(
		roomAt(l, m.x, m.y) === 0,
		`kept going up the corridor to ${pp(m)} after the player came into view`,
	);
	ok(remembers(m, r.p), `still heading for ${pp(m.lastSeen)}`);
});

// ───────────────── ぜんぶ ─────────────────

// ───────────────── 植民地（板）だけの 敵 ─────────────────

const COLONY_FOES: readonly [string, DungeonId][] = [
	["panhei", "shallow"],
	["kinonyan", "kinoko"],
	["ofurou", "main"],
	["denchan", "deep"],
	["natsuko", "tropical"],
	["takonomin", "konamono"],
	["mashii", "festival"],
];

for (const [id, board] of COLONY_FOES)
	test(id, `only appears on its own board (${board})`, () => {
		const lv = MONSTERS[id].floors[0];
		ok(
			monstersFor(lv, board).some((m) => m.id === id),
			`not in the ${board} pool`,
		);
		for (const other of DUNGEON_IDS)
			if (other !== board)
				ok(
					!monstersFor(lv, other).some((m) => m.id === id),
					`appears on ${other}`,
				);
	});

test(
	"panhei",
	"swap: pushes its bread on Kiriko, takes one item and runs; drops what it holds",
	() => {
		const BREADS = ["f_bread", "f_large", "f_moldy"];
		const r = arena("panhei");
		r.s.dungeon = "shallow";
		r.p.items = [];
		const herb = give(r, "h_heal");
		const scroll = give(r, "s_appraise");
		const m = put(r, "panhei", at(1, 0));
		// はじめから パンを 持っている
		ok(!!m.carry && BREADS.includes(m.carry.kind), `holds ${m.carry?.kind}`);
		const bread = m.carry;
		waitTurns(r, 40, () => m.swapped === true);
		const taken = [herb, scroll].find((it) => !r.p.items.includes(it));
		ok(
			!!taken && m.carry === taken && !!bread && r.p.items.includes(bread),
			`swap: took ${taken?.kind}, carries ${m.carry?.kind}, gave ${bread?.kind}`,
		);
		ok(r.p.items.length === 2, "the count of items changed");
		// 1体 1回だけ・倒すと 持ち去った 物を 落とす
		const where = { x: m.x, y: m.y };
		r.killMonster(m, false);
		ok(
			r.f.items.some(
				(fi) => fi.item === taken && fi.x === where.x && fi.y === where.y,
			) || r.f.items.some((fi) => fi.item === taken),
			"the taken item was not dropped",
		);
		// 取りかえる 前に 倒すと パンを 落とす
		const r2 = arena("panhei-early");
		r2.s.dungeon = "shallow";
		const m2 = put(r2, "panhei", at(3, 0), { sleep: DEEP });
		const held = m2.carry;
		r2.killMonster(m2, false);
		ok(
			!!held && r2.f.items.some((fi) => fi.item === held),
			"the bread was not dropped",
		);
	},
);

test("kinonyan", "sits still until Kiriko comes near", () => {
	const r = arena("kinonyan");
	const m = put(r, "kinonyan", at(6, 0), {});
	const start = { x: m.x, y: m.y };
	waitTurns(r, 10, () => false);
	ok(m.x === start.x && m.y === start.y, "moved while nobody was near");
});

test("ofurou", "sleepSpell: puts Kiriko to sleep from next to her", () => {
	const r = arena("ofurou");
	put(r, "ofurou", at(1, 0));
	const w = spellWatch(r);
	waitTurns(r, 60, () => false);
	ok(w.slept > 0, `never put Kiriko to sleep (${w.casts} casts)`);
});

test("denchan", "ranged: shocks Kiriko along a line", () => {
	const r = arena("denchan");
	const home = at(4, 0);
	const m = put(r, "denchan", home);
	const hit = waitTurns(r, 40, () => {
		// 毎ターン元の位置へ戻す（近づかせない）
		m.x = home.x;
		m.y = home.y;
		return r.s.log.some((l) => l.includes("漏電した"));
	});
	ok(hit > 0, "never shocked");
});

test("natsuko", "shy: keeps away when Kiriko comes near", () => {
	const r = arena("natsuko");
	const m = put(r, "natsuko", at(2, 0));
	waitTurns(r, 6, () => false);
	ok(
		Math.max(Math.abs(m.x - r.p.x), Math.abs(m.y - r.p.y)) >= 2,
		"came closer",
	);
});

test("takonomin", "breath: throws hot takoyaki, not fire", () => {
	const r = arena("takonomin");
	const home = at(4, 0);
	const m = put(r, "takonomin", home);
	const hit = waitTurns(r, 60, () => {
		m.x = home.x;
		m.y = home.y;
		return r.s.log.some((l) => l.includes("たこ焼きを　吐いた"));
	});
	ok(hit > 0, "never threw takoyaki");
	ok(!r.s.log.some((l) => l.includes("炎を　吐いた")), "said it breathed fire");
});

test("mashii", "pack: comes in a group of four", () => {
	const r = arena("mashii");
	r.s.dungeon = "festival";
	r.s.depth = 5;
	r.f.depth = 5;
	const m = spawnMonster(r, null, at(5, 0), {});
	// 表から 引くと ほかの 敵も 出るので、マシーが 出るまで 引きなおす
	let tries = 0;
	let got = m;
	while (got?.kind !== "mashii" && tries++ < 200) {
		r.f.monsters = [];
		got = spawnMonster(r, null, at(5, 0), {});
	}
	ok(got?.kind === "mashii", "harness: mashii was never drawn");
	ok(
		r.f.monsters.filter((x) => x.kind === "mashii").length === 4,
		`came as ${r.f.monsters.filter((x) => x.kind === "mashii").length}`,
	);
});

// ───────────────── ボス（目的が boss の 板の いちばん底。data/dungeons.ts の boss） ─────────────────

/** ボスの いる 板（boss が 既定の 植民地と、期間限定の パン板・風呂板）。 */
const BOSS_BOARDS: readonly DungeonId[] = [
	"shallow",
	"kinoko",
	"tropical",
	"konamono",
	"festival",
	"main",
];

/** ボスに 持たせない とくぎ（逃げる・消える・ふえる・化ける・飛ばす）。 */
const NOT_FOR_BOSSES: readonly Ability["k"][] = [
	"split",
	"explode",
	"steal",
	"shy",
	"retreat",
	"metal",
	"warpPlayer",
	"random",
	"invisible",
	"mimic",
];

/**
 * 目的が boss の いちばん底を 大部屋に した 場。ボスを pos に 置いて、この階の ボスに する（f.boss）。
 * 既定は 起きていて、キリコから 見える 所。
 */
const bossArena = (
	seed: string,
	dungeon: DungeonId,
	o: {
		layout?: Layout;
		start?: Pos;
		pos?: Pos;
		opts?: { sleep?: number; awake?: boolean };
	} = {},
): { r: Run; b: Monster } => {
	const start = o.start ?? CENTER;
	const r = arena(seed, o.layout ?? bigRoomLayout(), start, dungeon, "boss");
	r.s.depth = r.dungeon.floors;
	r.f.depth = r.s.depth;
	const spec = r.bossSpec;
	ok(spec, `harness: ${dungeon} has no boss`);
	const b = put(r, spec.monster, o.pos ?? at(5, 0, start), o.opts);
	r.f.boss = b.uid;
	return { r, b };
};

/** 向こうの 敵を 同じ 位置に 置きなおしながら 待つ（近づかせずに 飛び道具・息を 見る）。 */
const holdAndWait = (
	r: Run,
	m: Monster,
	n: number,
	done: () => boolean,
): number => {
	const home = { x: m.x, y: m.y };
	return waitTurns(r, n, () => {
		m.x = home.x;
		m.y = home.y;
		return done();
	});
};

const isBossDef = (m: Monster): boolean => !!mdef(m).boss;

const logHas = (r: Run, text: string): boolean =>
	r.s.log.some((l) => l.includes(text));

test(
	"boss",
	"each boss board has one boss that never shows up anywhere else",
	() => {
		for (const d of DUNGEON_IDS) {
			const spec = DUNGEONS[d].boss;
			if (!BOSS_BOARDS.includes(d)) {
				ok(!spec, `${d} has a boss`);
				ok(DUNGEONS[d].objective === "fetch", `${d} is not fetch`);
				continue;
			}
			ok(spec, `${d} has no boss`);
			const def = MONSTERS[spec.monster];
			ok(def?.boss, `${d}: ${spec.monster} is not a boss`);
			ok(def.board === d, `${spec.monster} is on ${def.board}`);
			ok(
				def.floors[0] === DUNGEONS[d].level[DUNGEONS[d].floors] &&
					def.floors[1] === def.floors[0],
				`${spec.monster} floors ${def.floors}`,
			);
			ok(def.scale === 1.5, `${spec.monster} is drawn at ${def.scale}`);
			const bad = def.abilities.filter((a) => NOT_FOR_BOSSES.includes(a.k));
			ok(!bad.length, `${spec.monster} has ${bad.map((a) => a.k)}`);
			ok(
				spec.lines.length >= 2 && spec.lines.length <= 3,
				`${d}: ${spec.lines.length} rescue lines`,
			);
			// 記録の 1行に おさまる（ほかの 行と 同じ 24字まで）
			const long = spec.lines.filter((l) => [...l].length > 24);
			ok(!long.length, `${d}: long rescue lines ${long.join(" / ")}`);
			ok(spec.cause === `${def.name}を　たおした`, `${d}: cause ${spec.cause}`);
			for (let lv = 1; lv <= 30; lv++)
				for (const other of DUNGEON_IDS)
					ok(
						!monstersFor(lv, other).some((m) => m.boss),
						`a boss is in the ${other} pool at level ${lv}`,
					);
		}
		// 既定：物語の 品の 板は 持ち帰り、4つの 植民地は ボス
		for (const d of ["kinoko", "tropical", "konamono", "festival"] as const)
			ok(DUNGEONS[d].objective === "boss", `${d} is not a boss board`);
		for (const d of ["shallow", "main", "deep", "hidden"] as const)
			ok(DUNGEONS[d].objective === "fetch", `${d} is not a fetch board`);
		ok(
			MONSTER_LIST.filter((m) => m.boss).length === BOSS_BOARDS.length,
			"a boss is not on any board",
		);
	},
);

test(
	"boss",
	"the objective draws no random number and is saved only for boss",
	() => {
		const fetch = Run.create("boss-create", "kinoko");
		const boss = Run.create("boss-create", "kinoko", [], "boss");
		ok(fetch.s.objective === undefined, "fetch wrote an objective");
		ok(fetch.objective === "fetch", `fetch reads as ${fetch.objective}`);
		ok(boss.s.objective === "boss" && boss.objective === "boss", "not boss");
		ok(
			JSON.stringify(boss.s.rng) === JSON.stringify(fetch.s.rng),
			"the boss objective drew a random number",
		);
		const o = JSON.parse(serializeRun(boss.s)) as Record<string, unknown>;
		delete o.objective;
		ok(
			JSON.stringify(o) === serializeRun(fetch.s),
			"B1 of a boss run differs from the fetch run",
		);
		// ボスの いない 板は 持ち帰りの まま
		const deep = Run.create("boss-create", "deep", [], "boss");
		ok(
			deep.s.objective === undefined && deep.bossSpec === null,
			"a board without a boss became boss",
		);
	},
);

test(
	"boss",
	"the bottom floor: the boss sleeps in the stairs room, no goal on the floor, no festival",
	() => {
		for (const d of BOSS_BOARDS) {
			const bottom = DUNGEONS[d].floors;
			let inStairs = 0;
			for (let i = 0; i < 6; i++) {
				const r = Run.create(`boss-floor-${d}-${i}`, d, [], "boss");
				r.s.houses = [bottom];
				r.enterFloor(bottom, false);
				const f = r.f;
				const b = r.boss;
				ok(b, `${d} ${i}: no boss`);
				ok(b.kind === DUNGEONS[d].boss?.monster, `${d}: ${b.kind}`);
				ok(
					f.monsters.filter((m) => isBossDef(m)).length === 1,
					`${d} ${i}: not one boss`,
				);
				ok(
					b.status.sleep === DEEP || f.bossSeen,
					`${d} ${i}: awake before it was seen`,
				);
				ok(f.house < 0, `${d} ${i}: the boss floor is a festival`);
				ok(
					!f.items.some((fi) => fi.item.kind === r.dungeon.goal),
					`${d} ${i}: the goal is on the floor`,
				);
				ok(!b.carry, `${d} ${i}: the boss carries ${b.carry?.kind}`);
				if (
					roomAt(f.layout, b.x, b.y) ===
					roomAt(f.layout, f.stairs.x, f.stairs.y)
				)
					inStairs++;
				// 同じ 種の fetch：品が 床に あって ボスは いない
				const g = Run.create(`boss-floor-${d}-${i}`, d);
				g.enterFloor(bottom, false);
				ok(
					g.f.boss === undefined && !g.f.monsters.some(isBossDef),
					`${d} ${i}: a fetch run has a boss`,
				);
				ok(
					g.f.items.some((fi) => fi.item.kind === g.dungeon.goal),
					`${d} ${i}: a fetch run has no goal`,
				);
			}
			ok(inStairs >= 5, `${d}: the boss was in the stairs room ${inStairs}/6`);
		}
	},
);

test(
	"boss",
	"sleeps without moving until Kiriko first sees it, then waits for her",
	() => {
		// 見えない 離れ部屋に ボス。気配スレで 居場所が わかっても 起きない
		const { r, b } = bossArena("boss-wake", "kinoko", {
			layout: hideoutLayout(),
			start: HIDE_AT,
			pos: { x: 46, y: 16 },
			opts: { sleep: DEEP },
		});
		r.f.senseMonsters = true;
		const home = { x: b.x, y: b.y };
		let events = 0;
		waitTurns(r, 12, (ev) => {
			events += evs(ev, "boss").length;
			return false;
		});
		ok(events === 0 && !r.f.bossSeen, "woke up without being seen");
		ok(samePos(b, home) && b.status.sleep === DEEP, "moved while unseen");
		// 離れ部屋に 入る（キリコを 移す）→ 見た とたんに 起きて 待ちかまえる
		r.p.x = 43;
		r.p.y = 16;
		const ev = turn(r);
		const seen = evs(ev, "boss");
		ok(seen.length === 1 && seen[0].id === b.uid, "no boss event on sight");
		ok(r.f.bossSeen === true, "bossSeen was not saved");
		ok(now(b).status.sleep === 0, "still asleep after being seen");
		ok(saw(ev, "待ちかまえていた"), "no line when it was seen");
		// 以後は ふつうに 動く（もう 知らせない）
		let moved = 0;
		waitTurns(r, 6, (e) => {
			events += evs(e, "boss").length;
			moved += count(e, "move", b.uid) + count(e, "attack", b.uid);
			return false;
		});
		ok(events === 0, "the boss event came twice");
		ok(moved > 0, "the boss did not move after waking");
	},
);

test(
	"boss",
	"hit while Kiriko is blind: the fight starts on the hit, and seeing it later neither wakes it again nor gives it a free turn",
	() => {
		const { r, b } = bossArena("boss-blind", "shallow", {
			pos: at(1, 0),
			opts: { sleep: DEEP },
		});
		// なぐりあいだけ 見る（封印して 吹きとばしで 離れないように）
		b.status.sealed = true;
		b.maxHp = 9999;
		b.hp = 9999;
		r.p.status.blind = 3;
		const dir = dirOf(1, 0) as Dir8;
		const first = turn(r, { c: "attack", dir });
		ok(now(b).status.sleep === 0, "the hit did not wake it");
		ok(
			r.f.bossSeen === true && evs(first, "boss").length === 1,
			"the fight did not start on the hit",
		);
		ok(
			saw(first, "あらわれた") && !saw(first, "待ちかまえていた"),
			"an awake boss was said to lie in wait",
		);
		ok(count(first, "attack", b.uid) === 1, "the boss did not hit back");
		// 目が 見えるように なっても もう 知らせない。1手も 休まない
		let events = 0;
		for (let i = 2; i <= 7; i++) {
			const ev = turn(r, { c: "attack", dir });
			events += evs(ev, "boss").length;
			ok(count(ev, "attack", b.uid) === 1, `turn ${i}: the boss skipped`);
		}
		ok(r.p.status.blind === 0, "harness: still blind");
		ok(events === 0, "the boss event came again");
		ok(!logHas(r, "待ちかまえていた"), "it lay in wait after the fight began");
	},
);

test(
	"boss",
	"woken out of sight (a bolt or an arrow): when it comes into view it just appears, with no free turn",
	() => {
		const { r, b } = bossArena("boss-woken", "kinoko", {
			layout: hideoutLayout(),
			start: HIDE_AT,
			pos: { x: 46, y: 16 },
			opts: { sleep: DEEP },
		});
		b.status.sealed = true;
		// 見えない 所で 当たって 起きた
		wakeMonster(r, b, true);
		ok(b.status.sleep === 0 && !r.f.bossSeen, "harness: not woken");
		// 離れ部屋に 入って となりに 立つ
		r.p.x = 45;
		r.p.y = 16;
		const ev = turn(r);
		ok(
			r.f.bossSeen === true && evs(ev, "boss").length === 1,
			"no boss event on sight",
		);
		ok(
			saw(ev, "あらわれた") && !saw(ev, "待ちかまえていた"),
			"an awake boss was said to lie in wait",
		);
		ok(count(ev, "attack", b.uid) === 1, "the awake boss got a wake-up rest");
	},
);

test(
	"boss",
	"no new anka on the boss floor; an ignored one leaves the sleeping boss asleep and brings no trolls",
	() => {
		// いちばん底に 着いても 安価は 来ない（ボスの ない 持ち帰りの 底には 来る ことが ある）
		let fetchAnka = 0;
		for (let i = 0; i < 20; i++) {
			const boss = Run.create(`anka-boss-${i}`, "kinoko", [], "boss");
			boss.enterFloor(boss.dungeon.floors, false);
			ok(boss.boss, `harness ${i}: no boss`);
			ok(
				(boss.f.ankaAt ?? -1) < 0 && !boss.f.anka,
				`${i}: an anka is due on the boss floor`,
			);
			const fetch = Run.create(`anka-boss-${i}`, "kinoko");
			fetch.enterFloor(fetch.dungeon.floors, false);
			if ((fetch.f.ankaAt ?? -1) >= 0) fetchAnka++;
		}
		ok(fetchAnka > 0, "harness: no anka on any fetch bottom floor");
		// 持ちこした 安価は つづく
		const carried = Run.create("anka-boss-carry", "kinoko", [], "boss");
		carried.f.anka = {
			kind: "herb",
			need: 1,
			done: 0,
			due: carried.f.res + 50,
		};
		carried.enterFloor(carried.dungeon.floors, false);
		ok(carried.f.anka?.kind === "herb", "the carried anka was dropped");
		// 守らなかった：ボスは 眠った まま（見ていない）、荒らしも 湧かない
		const { r, b } = bossArena("boss-anka", "kinoko", {
			layout: hideoutLayout(),
			start: HIDE_AT,
			pos: { x: 46, y: 16 },
			opts: { sleep: DEEP },
		});
		r.f.anka = { kind: "kill", need: 2, done: 0, due: 1 };
		const ev = turn(r);
		ok(saw(ev, "安価を　守らなかった"), "harness: the anka did not run out");
		ok(b.status.sleep === DEEP, "the ignored anka woke the boss");
		ok(!r.f.bossSeen && !evs(ev, "boss").length, "the fight started");
		ok(r.f.monsters.length === 1, `${r.f.monsters.length - 1} trolls came`);
		ok(!saw(ev, "目を　さました"), "said everyone woke up");
	},
);

test(
	"boss",
	"帰還スレ on the boss floor asks first, then ends as an ordinary escape",
	() => {
		const { r } = bossArena("boss-escape", "tropical", {
			opts: { sleep: DEEP },
		});
		const scroll = give(r, "s_escape");
		const ask = r.act({ c: "use", item: scroll.uid });
		ok(
			ask.some((e) => e.t === "fx" && e.kind === "confirm:escape"),
			"did not ask",
		);
		const askEnded = !!r.s.end;
		ok(!askEnded, "asking ended the run");
		r.act({ c: "use", item: scroll.uid, target: 0 });
		ok(r.s.end?.kind === "escape", `ended as ${r.s.end?.kind}`);
		ok(!r.s.returning, "went into the walk back");
	},
);

test(
	"boss",
	"a suspended save after the boss was seen keeps the boss, and that it was seen",
	() => {
		const { r, b } = bossArena("boss-save", "festival", {
			pos: at(3, 0),
			opts: { sleep: DEEP },
		});
		turn(r);
		ok(r.f.bossSeen === true, "harness: not seen");
		const back = new Run(deserializeRun(serializeRun(r.s)));
		ok(back.objective === "boss", `objective ${back.objective}`);
		ok(back.f.boss === b.uid && back.f.bossSeen === true, "the floor forgot");
		ok(back.boss?.uid === b.uid && back.boss.kind === b.kind, "no boss");
		ok(back.bossSpec?.monster === b.kind, "no boss spec");
	},
);

test("boss", "no monsters spawn over time while the boss lives", () => {
	const spawned = (withBoss: boolean): number => {
		const { r, b } = bossArena(`boss-spawn-${withBoss}`, "kinoko", {
			layout: hideoutLayout(),
			start: HIDE_AT,
			pos: { x: 46, y: 16 },
			opts: { sleep: DEEP },
		});
		if (!withBoss) {
			r.f.monsters = r.f.monsters.filter((m) => m !== b);
			delete r.f.boss;
		}
		const before = r.f.monsters.length;
		for (let i = 0; i < 3; i++) {
			r.f.turns = SPAWN_EVERY * (i + 1) - 1;
			r.f.res = 0;
			r.act({ c: "wait" });
		}
		return r.f.monsters.length - before;
	};
	ok(spawned(false) > 0, "harness: nothing spawned without a boss");
	ok(spawned(true) === 0, "monsters spawned while the boss lived");
});

test(
	"boss",
	"change / split / rebut / edge staffs and a thrown daze herb do not work on it",
	() => {
		for (const kind of ["w_change", "w_split", "w_rebut", "w_edge"]) {
			const { r, b } = bossArena(`boss-staff-${kind}`, "festival");
			const hp = b.hp;
			const php = r.p.hp;
			staffEffect(r, kind, b);
			ok(b.kind === "boss_mashii", `${kind}: became ${b.kind}`);
			ok(r.f.monsters.length === 1, `${kind}: ${r.f.monsters.length} monsters`);
			ok(
				b.hp === hp && r.f.monsters.includes(b),
				`${kind}: hp ${hp} → ${b.hp}`,
			);
			ok(r.p.hp === php, `${kind}: the player lost HP`);
			ok(!r.s.end, `${kind}: the run ended`);
			ok(logHas(r, "効かなかった"), `${kind}: no "didn't work" line`);
		}
		const { r, b } = bossArena("boss-daze", "festival", {
			pos: at(3, 0),
			opts: { sleep: DEEP },
		});
		const dir = dirOf(1, 0) as Dir8;
		for (let i = 0; i < 6 && !logHas(r, "効かなかった"); i++) {
			const it = give(r, "h_daze");
			turn(r, { c: "throw", item: it.uid, dir });
		}
		ok(logHas(r, "効かなかった"), "harness: the herb never hit");
		ok(!b.fleeing, "the boss runs away");
	},
);

test("boss", "!sk: wipe-out, items and metal leave the boss as it is", () => {
	const { r, b } = bossArena("boss-gacha", "konamono", { pos: at(4, 0) });
	r.f.sight = true;
	const seen = new Set<string>();
	for (let i = 0; i < 60 && seen.size < 3; i++) {
		const it = give(r, "s_gacha");
		r.s.ids.known.s_gacha = true;
		r.f.monsters
			.filter((m) => m !== b)
			.forEach((m) => {
				r.f.monsters = r.f.monsters.filter((x) => x !== m);
			});
		put(r, "tousuko", at(-4, 0), { sleep: DEEP });
		const ev = turn(r, { c: "use", item: it.uid });
		for (const t of ["いなくなった", "道具に　なった", "メタルぷゆゆに"])
			if (saw(ev, t)) {
				seen.add(t);
				ok(saw(ev, "効かなかった"), `${t}: no "didn't work" line`);
			}
		ok(r.f.monsters.includes(b), `the boss is gone after ${[...seen]}`);
		ok(b.kind === "boss_takonomin", `the boss became ${b.kind}`);
		b.hp = b.maxHp;
		b.enraged = false;
		b.status.fast = 0;
	}
	ok(seen.size === 3, `harness: only saw ${[...seen].join(", ")}`);
});

test(
	"boss",
	"a mine or a 炎上案件 blast takes a quarter of its max HP, not all of it",
	() => {
		const { r, b } = bossArena("boss-mine", "tropical", {
			pos: at(1, 0),
			opts: { sleep: DEEP },
		});
		const q = Math.ceil(b.maxHp / 4);
		for (let i = 0; i < 20 && !logHas(r, "地雷が　爆発した"); i++)
			triggerTrap(r, { x: r.p.x, y: r.p.y, kind: "mine", found: false });
		ok(logHas(r, "地雷が　爆発した"), "harness: the mine never went off");
		ok(r.f.monsters.includes(b), "the mine blew the boss away");
		ok(b.hp === b.maxHp - q, `mine: hp ${b.hp}/${b.maxHp}`);
		ok(!r.s.end, "the run ended");
		const bomb = put(r, "bomb", at(3, 0), { sleep: DEEP });
		bomb.hp = 10;
		r.damageMonster(bomb, 1, "hit");
		ok(!r.f.monsters.includes(bomb), "harness: the bomb did not go off");
		ok(r.f.monsters.includes(b), "the blast blew the boss away");
		ok(b.hp === b.maxHp - 2 * q, `blast: hp ${b.hp}/${b.maxHp}`);
		ok(!r.s.end, "the run ended");
	},
);

test(
	"boss",
	"felling it ends the run on the spot: the goal goes into the bag and she is sent home",
	() => {
		for (const d of BOSS_BOARDS) {
			const { r, b } = bossArena(`boss-win-${d}`, d, { pos: at(1, 0) });
			const spec = DUNGEONS[d].boss;
			ok(spec, "harness");
			// 袋が いっぱいでも 品は 持つ
			while (r.p.items.length < 20) give(r, "f_bread");
			b.hp = 1;
			const dir = dirOf(1, 0) as Dir8;
			const ev: GameEvent[] = [];
			for (let i = 0; i < 20 && !r.s.end; i++) {
				// 吹きとばされても となりに もどす（ここは 勝った ときの 流れだけ 見る）
				b.x = r.p.x + 1;
				b.y = r.p.y;
				ev.push(...r.act({ c: "attack", dir }));
			}
			const end = r.s.end;
			ok(end?.kind === "clear", `${d}: ended as ${end?.kind ?? "nothing"}`);
			ok(end.cause === spec.cause, `${d}: cause ${end.cause}`);
			ok(end.depth === r.dungeon.floors, `${d}: end depth ${end.depth}`);
			ok(!r.s.returning, `${d}: went into the walk back`);
			ok(!ev.some((e) => e.t === "goal"), `${d}: a goal event`);
			ok(
				r.p.items.some((it) => it.kind === r.dungeon.goal),
				`${d}: the goal is not in the bag`,
			);
			ok(r.p.items.length === 21, `${d}: ${r.p.items.length} items`);
			ok(
				!r.f.items.some((fi) => fi.item.kind === r.dungeon.goal),
				`${d}: the goal was put on the floor`,
			);
			ok(
				r.f.boss === undefined && r.boss === null,
				`${d}: the boss is still set`,
			);
			ok(r.s.kills[b.kind] === 1, `${d}: the kill was not counted`);
			// 順：たおれる → 経験値 → 品 → 帰り方 → 終わり
			const die = ev.findIndex((e) => e.t === "die" && e.id === b.uid);
			const rescue = ev.findIndex((e) => e.t === "rescue");
			const fin = ev.findIndex((e) => e.t === "end");
			ok(die >= 0 && die < rescue && rescue < fin, `${d}: events out of order`);
			const rs = ev[rescue];
			ok(rs.t === "rescue" && rs.kind === spec.rescue, `${d}: rescue kind`);
			const msgs = ev.filter((e) => e.t === "msg").map((e) => e.text);
			const got = msgs.findIndex((t) => t.includes("手に入れた"));
			const exp = msgs.findIndex((t) => t.includes("経験値"));
			ok(exp >= 0 && exp < got, `${d}: the goal came before the exp`);
			ok(
				spec.lines.every((l, i) => msgs[got + 1 + i] === l),
				`${d}: rescue lines ${msgs.slice(got + 1).join(" / ")}`,
			);
			const afterRescue = ev
				.slice(rescue + 1, fin)
				.filter((e) => e.t !== "msg");
			ok(
				!afterRescue.length,
				`${d}: ${afterRescue.map((e) => e.t)} after rescue`,
			);
		}
	},
);

test(
	"boss",
	"felled by a blast it still counts as a win, and the blast does not fell her after",
	() => {
		// 地雷（キリコの HP が 1 でも、ボスが たおれたら そこで 終わり）
		{
			const { r, b } = bossArena("boss-mine-win", "shallow", {
				pos: at(1, 0),
				opts: { sleep: DEEP },
			});
			b.hp = 2;
			r.p.hp = 1;
			for (let i = 0; i < 20 && !r.s.end; i++)
				triggerTrap(r, { x: r.p.x, y: r.p.y, kind: "mine", found: false });
			ok(r.s.end?.kind === "clear", `mine: ended as ${r.s.end?.kind}`);
			ok(r.p.hp === 1, `mine: the player hp ${r.p.hp}`);
			ok(!logHas(r, "たおれた……"), "mine: she fell after the win");
		}
		// 炎上案件
		{
			const { r, b } = bossArena("boss-bomb-win", "festival", {
				pos: at(1, 0),
				opts: { sleep: DEEP },
			});
			b.hp = 2;
			r.p.hp = 1;
			const bomb = put(r, "bomb", at(2, 1), { sleep: DEEP });
			bomb.hp = 10;
			r.damageMonster(bomb, 1, "hit");
			ok(r.s.end?.kind === "clear", `bomb: ended as ${r.s.end?.kind}`);
			ok(r.p.hp === 1, `bomb: the player hp ${r.p.hp}`);
			ok(
				r.p.items.some((it) => it.kind === r.dungeon.goal),
				"bomb: the goal burnt",
			);
		}
	},
);

test(
	"boss",
	"a boss felled in a fetch run (or a trait test) does not end the run",
	() => {
		const r = arena("boss-fetch");
		const m = put(r, "boss_panhei", at(1, 0), { sleep: DEEP });
		r.damageMonster(m, m.hp, "hit");
		ok(!r.f.monsters.includes(m), "harness: not felled");
		ok(!r.s.end, `ended as ${r.s.end?.kind}`);
	},
);

// 1体ずつの とくちょう（ボスの 絵は 1.5倍・図鑑の 階は その板の いちばん底。ここは とくぎ）

test("boss_panhei", "knockback: pushes Kiriko back", () => {
	const r = arena("boss-panhei");
	const m = put(r, "boss_panhei", at(-1, 0));
	const n = waitTurns(r, 80, (ev) =>
		evs(ev, "warp").some((w) => w.id === PLAYER_ID),
	);
	ok(n > 0, `${m.kind} never knocked Kiriko back in 80 turns`);
});

test(
	"boss_kinonyan",
	"armor halves melee; breathes spores along a line",
	() => {
		const r = arena("boss-kinonyan");
		const m = put(r, "boss_kinonyan", at(4, 0));
		m.maxHp = 9999;
		m.hp = 9999;
		ok(dealt(r, m, 20, "hit") === 10, "melee was not halved");
		ok(dealt(r, m, 20, "magic") === 20, "magic was halved");
		const n = holdAndWait(r, m, 60, () => logHas(r, "胞子を　吐いた"));
		ok(n > 0, "never breathed spores");
	},
);

test(
	"boss_natsuko",
	"throws coconuts along a line and does not run away",
	() => {
		const r = arena("boss-natsuko");
		const m = put(r, "boss_natsuko", at(4, 0));
		const n = holdAndWait(r, m, 40, () => logHas(r, "ヤシの実を　投げた"));
		ok(n > 0, "never threw a coconut");
		const r2 = arena("boss-natsuko-near");
		const m2 = put(r2, "boss_natsuko", at(2, 0));
		const near = waitTurns(r2, 12, () => dist(m2, r2.p) === 1);
		ok(near > 0, `kept away (at distance ${dist(m2, r2.p)})`);
	},
);

test(
	"boss_takonomin",
	"throws hot takoyaki; gets angry at half HP in おんたこ",
	() => {
		const r = arena("boss-takonomin", bigRoomLayout(), CENTER, "konamono");
		const m = put(r, "boss_takonomin", at(4, 0));
		const n = holdAndWait(r, m, 60, () => logHas(r, "たこ焼きを　吐いた"));
		ok(n > 0, "never threw takoyaki");
		r.damageMonster(m, Math.ceil(m.maxHp / 2), "hit");
		ok(m.enraged && m.status.fast === 999, "did not get angry");
	},
);

test(
	"boss_mashii",
	"berserk at half HP; knocks Kiriko back with the fan",
	() => {
		const r = arena("boss-mashii");
		const m = put(r, "boss_mashii", at(-1, 0));
		const n = waitTurns(r, 80, (ev) =>
			evs(ev, "warp").some((w) => w.id === PLAYER_ID),
		);
		ok(n > 0, "never knocked Kiriko back in 80 turns");
		r.damageMonster(m, m.hp - Math.floor(m.maxHp / 2), "hit");
		ok(
			m.enraged && m.status.fast === 999,
			"did not go berserk (main is not angry)",
		);
	},
);

test(
	"boss_ofurou",
	"splashes hot water along a line; puts Kiriko to sleep from next to her",
	() => {
		const r = arena("boss-ofurou");
		const m = put(r, "boss_ofurou", at(4, 0));
		const n = holdAndWait(r, m, 40, () => logHas(r, "湯を　かけた"));
		ok(n > 0, "never splashed hot water");
		const r2 = arena("boss-ofurou-near");
		put(r2, "boss_ofurou", at(1, 0));
		const w = spellWatch(r2);
		waitTurns(r2, 120, () => false);
		ok(w.slept > 0, `never put Kiriko to sleep (${w.casts} casts)`);
	},
);

test(
	"all",
	"every monster has a desc, a flavor line and at least one ability",
	() => {
		ok(MONSTER_LIST.length === 44, `${MONSTER_LIST.length} monsters`);
		const noDesc = MONSTER_LIST.filter((d) => !d.desc.trim()).map((d) => d.id);
		ok(!noDesc.length, `no desc: ${noDesc.join(", ")}`);
		const noFlavor = MONSTER_LIST.filter((d) => !d.flavor?.trim()).map(
			(d) => d.id,
		);
		ok(!noFlavor.length, `no flavor: ${noFlavor.join(", ")}`);
		const plain = MONSTER_LIST.filter((d) => !d.abilities.length).map(
			(d) => d.id,
		);
		ok(!plain.length, `no ability: ${plain.join(", ")}`);
	},
);

test("all", "every monster has a trait test", () => {
	const tested = new Set(CASES.map((c) => c.id));
	const missing = MONSTER_LIST.filter((d) => !tested.has(d.id)).map(
		(d) => d.id,
	);
	ok(!missing.length, `untested: ${missing.join(", ")}`);
});
