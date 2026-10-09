// 保守トロッコ（data/village/trolley.ts）の 試験（pnpm test で いっしょに 動く）。

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOWN_STAGES } from "../core/town";
import { pedRoute } from "../data/village/crowd";
import {
	VILLAGE_H,
	VILLAGE_SPOTS,
	VILLAGE_W,
	type VillageView,
	villagePalette,
	villagePlaces,
	villageRows,
} from "../data/village/map";
import {
	TROLLEY_CART,
	TROLLEY_MSG,
	TROLLEY_SPRITE,
	trolleyStand,
	trolleyStops,
} from "../data/village/trolley";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

const CASES: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => CASES.push({ name, run });

const view = (stage: number): VillageView => ({
	stage,
	unlocked: ["shallow", "main", "deep"],
	cleared: ["shallow", "main"],
});

/** 村の 地図（置物の ある マスは 通れない）で 起きる 所から 行ける マス。 */
const reachFrom = (v: VillageView): Set<string> => {
	const rows = villageRows(v).map((r) => [...r]);
	const tiles = villagePalette(v);
	const solid = new Set(
		villagePlaces(v)
			.filter((p) => p.sprite)
			.map((p) => `${p.x},${p.y}`),
	);
	const pass = (x: number, y: number) =>
		!!tiles[rows[y]?.[x] ?? ""]?.passable && !solid.has(`${x},${y}`);
	const [bx, by] = VILLAGE_SPOTS.boot;
	const seen = new Set([`${bx},${by}`]);
	const queue: [number, number][] = [[bx, by]];
	for (let i = 0; i < queue.length; i++) {
		const [x, y] = queue[i];
		for (const [dx, dy] of [
			[0, -1],
			[1, 0],
			[0, 1],
			[-1, 0],
		]) {
			const k = `${x + dx},${y + dy}`;
			if (seen.has(k) || !pass(x + dx, y + dy)) continue;
			seen.add(k);
			queue.push([x + dx, y + dy]);
		}
	}
	return seen;
};

test("乗り場：はじめから 5つ、新市街（段4〜）と 港（段7）で ふえる。どれも 村の 地図に 札と トロッコが 立つ", () => {
	const want = [5, 5, 5, 5, 6, 6, 6, 7];
	for (let stage = 0; stage < TOWN_STAGES; stage++) {
		const stops = trolleyStops(stage);
		ok(stops.length === want[stage], `stage ${stage}: ${stops.length} stops`);
		ok(
			new Set(stops.map((t) => t.id)).size === stops.length,
			`stage ${stage}: two stops with one id`,
		);
		const places = villagePlaces(view(stage));
		for (const t of stops) {
			const p = places.filter((q) => q.x === t.at[0] && q.y === t.at[1]);
			ok(
				p.length === 1 &&
					p[0].id === `trolley_${t.id}` &&
					p[0].sprite === TROLLEY_SPRITE,
				`stage ${stage}: ${t.id} at ${t.at} is ${p.map((q) => q.id)}`,
			);
		}
	}
});

test("乗り場：降りる マスへ 歩いて 行けて（扉・口では ない）、どの 乗り場からも ほかの 乗り場へ 走れる", () => {
	for (let stage = 0; stage < TOWN_STAGES; stage++) {
		const v = view(stage);
		const rows = villageRows(v).map((r) => [...r]);
		const tiles = villagePalette(v);
		const places = villagePlaces(v);
		const touch = new Set(
			places.filter((p) => p.trigger === "touch").map((p) => `${p.x},${p.y}`),
		);
		const stops = trolleyStops(stage);
		// 札の ない 村で 行ける マスと くらべる
		const all = reachFrom(v);
		for (const t of stops) {
			const k = t.at.join(",");
			ok(
				tiles[rows[t.at[1]][t.at[0]]]?.passable,
				`stage ${stage}: ${t.id} stands on a wall`,
			);
			const [sx, sy] = trolleyStand(t);
			ok(all.has(`${sx},${sy}`), `stage ${stage}: cannot walk to ${t.id}`);
			ok(!touch.has(`${sx},${sy}`), `stage ${stage}: ${t.id} lands on a door`);
			ok(!all.has(k), `stage ${stage}: ${t.id} is walkable`);
		}
		const cost = (x: number, y: number) =>
			tiles[rows[y]?.[x] ?? ""]?.passable && !touch.has(`${x},${y}`)
				? 1
				: Number.POSITIVE_INFINITY;
		for (const a of stops)
			for (const b of stops) {
				if (a === b) continue;
				ok(
					pedRoute(
						VILLAGE_W,
						VILLAGE_H,
						cost,
						trolleyStand(a),
						trolleyStand(b),
					),
					`stage ${stage}: no ride from ${a.id} to ${b.id}`,
				);
			}
	}
});

test("乗り場：札を 置いても 置かなくても 行ける マスは 同じ（札の ほかに 道は へらない）", () => {
	for (let stage = 0; stage < TOWN_STAGES; stage++) {
		const v = view(stage);
		const all = reachFrom(v);
		const stops = trolleyStops(stage);
		// 札が 無い つもりで 数える（札の マスを 足す）→ 札で ふさがる のは 札の マス だけ
		const rows = villageRows(v).map((r) => [...r]);
		const tiles = villagePalette(v);
		const solid = new Set(
			villagePlaces(v)
				.filter((p) => p.sprite && !p.id.startsWith("trolley_"))
				.map((p) => `${p.x},${p.y}`),
		);
		const pass = (x: number, y: number) =>
			!!tiles[rows[y]?.[x] ?? ""]?.passable && !solid.has(`${x},${y}`);
		const [bx, by] = VILLAGE_SPOTS.boot;
		const seen = new Set([`${bx},${by}`]);
		const queue: [number, number][] = [[bx, by]];
		for (let i = 0; i < queue.length; i++) {
			const [x, y] = queue[i];
			for (const [dx, dy] of [
				[0, -1],
				[1, 0],
				[0, 1],
				[-1, 0],
			]) {
				const k = `${x + dx},${y + dy}`;
				if (seen.has(k) || !pass(x + dx, y + dy)) continue;
				seen.add(k);
				queue.push([x + dx, y + dy]);
			}
		}
		ok(
			seen.size === all.size + stops.length,
			`stage ${stage}: the stops cut off ${seen.size - all.size - stops.length} cells`,
		);
	}
});

/** 全角=1・半角=0.5 で 数えた 幅（村の 窓は 全角 22字・2行）。 */
const width = (line: string): number =>
	[...line].reduce((w, ch) => w + (/[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);

test("乗り場の 文：どの 乗り場の 名前でも 村の 窓に 収まる", () => {
	const names = new Set(
		Array.from({ length: TOWN_STAGES }, (_, s) =>
			trolleyStops(s).map((t) => t.name),
		).flat(),
	);
	const texts = [
		TROLLEY_MSG.first,
		...[...names].flatMap((n) => [TROLLEY_MSG.ask(n), TROLLEY_MSG.arrive(n)]),
	];
	for (const t of texts) {
		const ls = t.split("\n");
		ok(ls.length <= 2, `"${t}" has ${ls.length} lines`);
		for (const l of ls) ok(width(l) <= 22, `"${l}" is too wide`);
	}
	for (const n of names) ok(width(n) <= 8, `${n}: too long for the choices`);
});

test("乗り場の 絵：public/sprites/trolley.png（32x32）の 中を 指す", () => {
	const png = readFileSync(join(process.cwd(), "public/sprites/trolley.png"));
	ok(png.toString("ascii", 12, 16) === "IHDR", "not a PNG");
	const w = png.readUInt32BE(16);
	const h = png.readUInt32BE(20);
	ok(w === 32 && h === 32, `trolley.png is ${w}x${h}`);
	for (const ref of [TROLLEY_SPRITE, TROLLEY_CART]) {
		const [x, y, cw, ch] = ref.split("#")[1].split(",").map(Number);
		ok(x + cw <= w && y + ch <= h, `${ref} is outside the sheet`);
	}
});

export const runTrolleyTests = (): TestResult[] =>
	CASES.map((c) => {
		try {
			c.run();
			return { id: "trolley", name: c.name, ok: true };
		} catch (e) {
			return {
				id: "trolley",
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			};
		}
	});
