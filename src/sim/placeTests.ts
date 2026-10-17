// 名所の 階・底の 集落の 手づくりの 地図（core/data/places.ts・core/floor.ts の buildPlaceFloor）の 試験
// （pnpm test で いっしょに 動く）。字が 表に あること・床が 1つに つながる こと（ワープで 閉じこめられない）・
// 人と 話せて 階段・品・源泉に 歩いて 行ける こと・敵や 罠が 無い こと を 見る。

import { DUNGEON_IDS, dungeonById } from "../core/data/dungeons";
import type { PlaceMap } from "../core/data/places";
import { blocks, buildFloor } from "../core/floor";
import { DIRS8, type Pos, step } from "../core/geom";
import { idx, isFloor } from "../core/mapgen";
import { Run } from "../core/run";
import type { DungeonId, Floor } from "../core/types";
import { bgm } from "../data/audio/bgm";
import { BOARD_LOOKS } from "../data/story/story";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

const CASES: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => CASES.push({ name, run });

type Place = {
	dungeon: DungeonId;
	depth: number;
	name: string;
	map: PlaceMap;
	folk: number;
	gifts: number;
	spring: boolean;
};

const PLACES: Place[] = DUNGEON_IDS.flatMap((id) => {
	const d = dungeonById(id);
	const out: Place[] = (d.rests ?? []).map((r) => ({
		dungeon: id,
		depth: r.depth,
		name: r.name,
		map: r.map,
		folk: r.folk?.length ?? 0,
		gifts: r.gifts?.length ?? 0,
		spring: r.map.rows.some((row) => row.includes("S")),
	}));
	if (d.settlement)
		out.push({
			dungeon: id,
			depth: d.floors,
			name: d.settlement.name,
			map: d.settlement.map,
			folk: d.settlement.folk.length,
			gifts: 0,
			spring: false,
		});
	return out;
});

test("each special floor has its own tune, not the board's dungeon tune", () => {
	for (const id of DUNGEON_IDS) {
		const d = dungeonById(id);
		for (const p of [
			...(d.rests ?? []),
			...(d.settlement ? [d.settlement] : []),
		]) {
			ok(p.bgm in bgm, `${p.name}: no tune ${p.bgm}`);
			ok(p.bgm !== BOARD_LOOKS[id].bgm, `${p.name}: same tune as the board`);
		}
	}
});

const build = (
	p: Place,
	objective = dungeonById(p.dungeon).objective,
): Floor => {
	const r = Run.create(`place-test:${p.name}`, p.dungeon, [], objective);
	return buildFloor(r, p.depth, false);
};

/** 着いた 所から 歩いて 行ける マス（8方向。角は 両どなりが 床の ときだけ）。 */
const reach = (f: Floor, from: Pos): Set<number> => {
	const l = f.layout;
	const seen = new Set([idx(l, from.x, from.y)]);
	const todo = [from];
	while (todo.length) {
		const p = todo.pop() as Pos;
		for (const d of DIRS8) {
			const q = step(p, d);
			if (!isFloor(l, q.x, q.y) || seen.has(idx(l, q.x, q.y))) continue;
			if (q.x !== p.x && q.y !== p.y)
				if (!isFloor(l, q.x, p.y) || !isFloor(l, p.x, q.y)) continue;
			seen.add(idx(l, q.x, q.y));
			todo.push(q);
		}
	}
	return seen;
};

test("every special floor uses only known letters, and each block of a big prop is a filled rectangle", () => {
	ok(PLACES.length >= 7, `only ${PLACES.length} special floors`);
	for (const p of PLACES) {
		const known = new Set([
			..."#. @>*Sg123456789",
			...Object.keys(p.map.legend),
		]);
		for (const row of p.map.rows)
			for (const ch of row) ok(known.has(ch), `${p.name}: unknown "${ch}"`);
		ok(
			p.map.rows.every((row) => row.length === p.map.rows[0].length),
			`${p.name}: rows of different lengths`,
		);
		for (const [ch, prop] of Object.entries(p.map.legend)) {
			if (!prop.big) continue;
			const cells: Pos[] = [];
			p.map.rows.forEach((row, y) => {
				for (let x = 0; x < row.length; x++)
					if (row[x] === ch) cells.push({ x, y });
			});
			const area = blocks(cells).reduce((n, g) => n + g.w * g.h, 0);
			ok(area === cells.length, `${p.name}: "${ch}" is not a rectangle`);
		}
	}
});

test("special floors are one connected room with the stairs, folk, goods and spring in walking reach", () => {
	for (const p of PLACES) {
		const f = build(p);
		const l = f.layout;
		const start = { x: f.stairs.x, y: f.stairs.y };
		ok(isFloor(l, start.x, start.y), `${p.name}: stairs on a wall`);
		const got = reach(f, start);
		for (let i = 0; i < l.w * l.h; i++)
			if (l.tiles[i])
				ok(
					got.has(i),
					`${p.name}: floor cut off at ${i % l.w},${Math.floor(i / l.w)}`,
				);
		for (const it of f.items)
			ok(got.has(idx(l, it.x, it.y)), `${p.name}: item out of reach`);
		for (const t of f.traps)
			ok(got.has(idx(l, t.x, t.y)), `${p.name}: spring out of reach`);
		for (const fo of f.folk ?? [])
			ok(
				DIRS8.some((d) => {
					const q = step(fo, d);
					return got.has(idx(l, q.x, q.y));
				}),
				`${p.name}: nobody can talk to ${fo.name}`,
			);
	}
});

test("special floors place every folk, gift, spring and goal, and nothing hostile", () => {
	for (const p of PLACES) {
		const f = build(p);
		const d = dungeonById(p.dungeon);
		ok(f.rest === p.name, `${p.name}: rest name ${f.rest}`);
		ok(
			(f.folk ?? []).length === p.folk,
			`${p.name}: folk ${(f.folk ?? []).length}/${p.folk}`,
		);
		ok(f.monsters.length === 0, `${p.name}: monsters`);
		ok(
			f.traps.every((t) => t.kind === "spring"),
			`${p.name}: a trap that is not a spring`,
		);
		ok(f.traps.length > 0 === p.spring, `${p.name}: spring`);
		ok(
			f.seen.every((v, i) => v || !f.layout.tiles[i]),
			`${p.name}: the map is not revealed`,
		);
		const goal = p.depth === d.floors && d.objective === "fetch" ? 1 : 0;
		ok(f.items.length === p.gifts + goal, `${p.name}: ${f.items.length} items`);
		if (goal)
			ok(
				f.items.some((it) => it.item.kind === d.goal),
				`${p.name}: no goal`,
			);
	}
	// 期間限定の 目的で どの 集落も 持ち帰り（fetch）に なりうる
	for (const p of PLACES.filter(
		(x) => x.depth === dungeonById(x.dungeon).floors,
	)) {
		const f = build(p, "fetch");
		const goal = dungeonById(p.dungeon).goal;
		ok(
			f.items.some((it) => it.item.kind === goal),
			`${p.name}: no goal when fetch`,
		);
	}
	// 源泉の ある 名所（露天の 源泉・静かな 石室）
	ok(PLACES.filter((p) => p.spring).length >= 5, "springs missing");
});

export const runPlaceTests = (): TestResult[] =>
	CASES.map((c) => {
		try {
			c.run();
			return { id: "place", name: c.name, ok: true };
		} catch (e) {
			return {
				id: "place",
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			};
		}
	});
