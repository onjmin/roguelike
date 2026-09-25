// モンスターの特技と、その対策が本当に効くかの試験（pnpm test → scripts/test-monsters.mjs）。
//
// - 試験ごとに決まったシードで Run を作り、階を「大部屋ひとつ」に差しかえて、調べるモンスターだけを置く。
// - キリコの HP は大きくしておく（倒れると act が何もしなくなるので、倒れたら その試験は失敗）。
// - 確率で起きる特技は「N ターンのうちに 1回は起きた」、対策は「1回も起きなかった」で見る。
//   シードが決まっているので、結果は毎回同じ。
// - 湧きと地震は止める（毎ターン f.turns を 0 に戻す）。

import { attackPower, EXP_AT, HUNGER_MAX, rollDamage } from "../core/balance";
import { MONSTER_LIST, MONSTERS } from "../core/data/monsters";
import { staffEffect } from "../core/effects";
import { spawnMonster } from "../core/floor";
import { canSee } from "../core/fov";
import { DX, DY, dirOf, dist, type Pos } from "../core/geom";
import { defOf } from "../core/item";
import {
	bigRoomLayout,
	type Layout,
	MAP_H,
	MAP_W,
	type Room,
	T_ROOM,
} from "../core/mapgen";
import { mdef, transformMonster } from "../core/monster";
import { Run } from "../core/run";
import {
	type Ability,
	type Command,
	DEEP,
	type GameEvent,
	type Item,
	type Monster,
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
): Run => {
	const r = Run.create(`monster-test:${seed}`);
	const f = r.s.floor;
	f.layout = layout;
	f.seen = new Uint8Array(layout.w * layout.h);
	f.items = [];
	f.traps = [];
	f.monsters = [];
	f.wards = [];
	f.cards = [];
	f.stairs = { x: layout.w - 3, y: layout.h - 3 };
	f.house = -1;
	f.houseAwake = false;
	f.turns = 0;
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

/** 山札の札として数える道具（なくなると s.lost に入る）。 */
const card = (r: Run, kind: string): Item => {
	const it = r.newItem(kind);
	r.s.cardKind[it.uid] = kind;
	r.f.cards.push(it.uid);
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

// ───────────────── とうすこ（slow） ─────────────────

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

// ───────────────── ひとだま（fastMove） ─────────────────

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

// ───────────────── 迷いコウモリ（random） ─────────────────

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

// ───────────────── フナムシ（shy） ─────────────────

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

// ───────────────── 毒カボチャ（poison） ─────────────────

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
			if (saw(ev, "毒は")) blocked++;
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

// ───────────────── さらいUFO（pickup） ─────────────────

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

// ───────────────── キメラ（retreat） ─────────────────

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

// ───────────────── さまよう騎士（armor） ─────────────────

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

// ───────────────── 錆び亡者（rust） ─────────────────

test("sabi", "rust: lowers the shield's plus", () => {
	const r = arena("sabi");
	const sh = equip(r, "bronze");
	put(r, "sabi", at(1, 0));
	waitTurns(r, 60, () => sh.plus < 0);
	ok(sh.plus < 0, `shield stayed +${sh.plus} for 60 turns`);
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

// ───────────────── メタルとうすこ（metal） ─────────────────

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

// ───────────────── 雪だるま（pack） ─────────────────

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

// ───────────────── 石像（statue） ─────────────────

test(
	"statue",
	"dormant until the player is adjacent, then attacks at once",
	() => {
		const r = arena("statue");
		const home = at(3, 0);
		const m = put(r, "statue", home);
		ok(m.status.dormant, "not dormant");
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

// ───────────────── ばくだん（explode） ─────────────────

test(
	"bomb",
	"fuse at hp<=29 (stops), explodes at hp<=9 (5x5, cards lost)",
	() => {
		const r = arena("bomb");
		const m = put(r, "bomb", at(2, 0));
		const carried = card(r, "s_map");
		m.carry = carried;
		const inCard = card(r, "h_heal");
		const outCard = card(r, "h_heal");
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
		ok(r.s.lost.includes(inCard.uid), "the destroyed card is not in s.lost");
		ok(r.s.lost.includes(carried.uid), "the carried card is not in s.lost");
		ok(!r.s.lost.includes(outCard.uid), "the outside card is in s.lost");
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

// ───────────────── ゴーレム（knockback） ─────────────────

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

// ───────────────── 過疎（grab） ─────────────────

/** 過疎につかまれた状態を作る（キリコの左に過疎）。 */
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

// ───────────────── ばけ札（mimic） ─────────────────

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

// ───────────────── 影（invisible） ─────────────────

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

test("kage", "気配の巻物 (senseMonsters) alone does not show it", () => {
	// 気配の巻物は「敵のいる所」、見えない敵は 見透し草 の役目（items.ts の説明・statusView の表示）
	const r = arena("kage-sense");
	const m = put(r, "kage", at(5, 0));
	r.f.senseMonsters = true;
	ok(!r.monsterVisible(m), "senseMonsters revealed an invisible monster");
	r.f.sight = true;
	ok(r.monsterVisible(m), "not visible with sight + sense");
});

// ───────────────── 赤鬼（berserk） ─────────────────

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

// ───────────────── 凝視の目（gaze） ─────────────────

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

// ───────────────── 黒装束（fastAct） ─────────────────

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

// ───────────────── 闇堕ち兵（curse） ─────────────────

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

// ───────────────── ぜんぶ ─────────────────

test("all", "31 monsters, each with a desc and at least one ability", () => {
	ok(MONSTER_LIST.length === 31, `${MONSTER_LIST.length} monsters`);
	const noDesc = MONSTER_LIST.filter((d) => !d.desc.trim()).map((d) => d.id);
	ok(!noDesc.length, `no desc: ${noDesc.join(", ")}`);
	const plain = MONSTER_LIST.filter((d) => !d.abilities.length).map(
		(d) => d.id,
	);
	ok(!plain.length, `no ability: ${plain.join(", ")}`);
});

test("all", "every monster has a trait test", () => {
	const tested = new Set(CASES.map((c) => c.id));
	const missing = MONSTER_LIST.filter((d) => !tested.has(d.id)).map(
		(d) => d.id,
	);
	ok(!missing.length, `untested: ${missing.join(", ")}`);
});
