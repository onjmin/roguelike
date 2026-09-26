// 歩ける村（保守村）の地図の試験（pnpm test で いっしょに動く）。
// Field（canvas を作る）は使わず、地図の文字・パレット・置き場所（data/village/map.ts）だけで調べる。
// - 形（22×18）・知らない文字が 無い・イベントが 地図の中で 1マスに 1つ・踏むイベントは 通れるマス
// - 起きる所（蓄音機の前）から、開いた口の すべてへ 歩いて行けて、人・看板・掲示板の すべてに
//   となり（か カウンター越し）から 話しかけられる（口の中には 立たずに）
// - 本編の口は 開くまで おんJ民が ふさぐ・もっとの口は 開くまで 板で ふさぐ

import { DUNGEON_IDS } from "../core/data/dungeons";
import { TOWN_STAGES } from "../core/town";
import type { DungeonId } from "../core/types";
import {
	VILLAGE_H,
	VILLAGE_SPOTS,
	VILLAGE_W,
	type VillagePlace,
	type VillageView,
	villagePalette,
	villagePlaces,
	villageRows,
} from "../data/village/map";
import type { TileDef } from "../engine/defs";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

const CASES: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => CASES.push({ name, run });

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

export const runVillageTests = (): TestResult[] =>
	CASES.map((c) => {
		try {
			c.run();
			return { id: "village", name: c.name, ok: true };
		} catch (e) {
			return {
				id: "village",
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			};
		}
	});
