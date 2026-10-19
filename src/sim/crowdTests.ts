// 街の 人通り（data/village/crowd.ts・ui/village/villageCrowd.ts）の 試験（pnpm test で いっしょに 動く）。

import { MONSTERS } from "../core/data/monsters";
import { TOWN_STAGES } from "../core/town";
import { CAST } from "../data/people/cast";
import { MOBS } from "../data/people/mobs";
import { REVIVE_AREAS } from "../data/town/revival";
import {
	CROWD_SPOTS,
	type CrowdNode,
	crowdLine,
	crowdNodes,
	crowdSize,
	NARROW_RUN,
	narrowDepth,
	PERSONAS,
	pedRoute,
	pickTrip,
	type TimeBand,
	TURN_COST,
	timeBand,
	villagePedCost,
} from "../data/village/crowd";
import {
	layoutStage,
	VILLAGE_H,
	VILLAGE_W,
	type VillageView,
	villagePalette,
	villageRows,
} from "../data/village/map";
import { Actor, type Field } from "../engine/field";
import { DIR_VEC, type Dir } from "../engine/types";
import { Crowd } from "../ui/village/villageCrowd";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

const CASES: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => CASES.push({ name, run });

const BANDS: readonly TimeBand[] = [
	"late",
	"morning",
	"day",
	"evening",
	"night",
];
/** 町が ぜんぶ 生き返った 村（data/town/revival.ts。シャッターの 店には 人が 出入りしない）。 */
const view = (stage: number): VillageView => ({
	stage,
	unlocked: ["shallow", "main", "deep"],
	cleared: REVIVE_AREAS.map((a) => a.dungeon),
});
/** 決まった 乱数（試験を くり返しても 同じ 結果）。 */
const seeded = (seed: number) => {
	let s = seed;
	return () => {
		s = (s * 16807) % 2147483647;
		return s / 2147483647;
	};
};

test("時間帯：深夜 0〜4・朝 5〜9・昼 10〜16・夕方 17〜19・夜 20〜23 時", () => {
	const want: [number, TimeBand][] = [
		[0, "late"],
		[4, "late"],
		[5, "morning"],
		[9, "morning"],
		[10, "day"],
		[16, "day"],
		[17, "evening"],
		[19, "evening"],
		[20, "night"],
		[23, "night"],
	];
	for (const [h, b] of want) ok(timeBand(h) === b, `${h}時 is ${timeBand(h)}`);
});

test("人の 数：殺風景の 村には だれも 来ない。段が 上がるほど ふえ、都市が いちばん にぎわう", () => {
	for (const b of BANDS)
		for (const weekend of [false, true]) {
			ok(crowdSize(0, b, weekend) === 0, `stage 0 ${b}`);
			ok(crowdSize(1, b, weekend) === 0, `stage 1 ${b}`);
			for (let s = 3; s < TOWN_STAGES; s++)
				ok(
					crowdSize(s, b, weekend) >= crowdSize(s - 1, b, weekend),
					`stage ${s} ${b}: fewer than stage ${s - 1}`,
				);
		}
	ok(
		crowdSize(7, "morning", false) > crowdSize(7, "late", false),
		"the city is as busy at 3am as in the morning",
	);
});

test("行き先：どの 段でも 立ちどまる 所は 歩ける マスで、扉・家・出口・立ちどまる 所の どれにも 道が ある", () => {
	for (let stage = 0; stage < TOWN_STAGES; stage++) {
		const v = view(stage);
		const nodes = crowdNodes(v);
		const cost = villagePedCost(v);
		const cells = new Set<string>();
		for (const n of nodes) {
			const k = n.at.join(",");
			ok(!cells.has(k), `stage ${stage}: two places at ${k}`);
			cells.add(k);
			if (!n.enter)
				ok(
					Number.isFinite(cost(n.at[0], n.at[1])),
					`stage ${stage}: ${n.id} at ${k} is not walkable`,
				);
		}
		const hub = nodes.find((n) => n.kind === "hall");
		ok(hub, `stage ${stage}: no hall door`);
		if (!hub) continue;
		for (const n of nodes) {
			if (n === hub) continue;
			ok(
				pedRoute(VILLAGE_W, VILLAGE_H, cost, hub.at, n.at) &&
					pedRoute(VILLAGE_W, VILLAGE_H, cost, n.at, hub.at),
				`stage ${stage}: no way between the hall and ${n.id}`,
			);
		}
	}
	// 段の 幅の 外では 出ない
	for (const s of CROWD_SPOTS)
		for (let stage = 0; stage < TOWN_STAGES; stage++) {
			const has = crowdNodes(view(stage)).some((n) => n.id === `spot_${s.id}`);
			const want =
				stage >= s.from && (s.until === undefined || stage < s.until);
			ok(has === want, `stage ${stage}: spot ${s.id}`);
		}
});

test("流れ：出てくるのは 扉・家・出口から。朝は 職場へ 通い、夕方は 帰り、家の ない 段は 村の 外から 通う", () => {
	const rng = seeded(42);
	const count = (
		stage: number,
		band: TimeBand,
		pred: (from: CrowdNode, to: CrowdNode) => boolean,
	) => {
		const nodes = crowdNodes(view(stage));
		let n = 0;
		for (let i = 0; i < 400; i++) {
			const t = pickTrip(rng, nodes, band, false);
			ok(t, `stage ${stage} ${band}: no trip`);
			if (!t) continue;
			ok(
				t.from.enter,
				`stage ${stage}: ${t.persona.id} starts at ${t.from.id}`,
			);
			ok(t.from.id !== t.to.id, `stage ${stage}: ${t.from.id} to itself`);
			if (pred(t.from, t.to)) n++;
		}
		return n;
	};
	const toWork = (_: CrowdNode, to: CrowdNode) => to.kind === "work";
	const fromWork = (from: CrowdNode) => from.kind === "work";
	ok(
		count(7, "morning", toWork) > count(7, "evening", toWork),
		"stage 7: as many go to work in the evening as in the morning",
	);
	ok(
		count(7, "evening", fromWork) > count(7, "morning", fromWork),
		"stage 7: as many leave work in the morning as in the evening",
	);
	// 段4 には 家も 駅も ない：通う 人は 村の 出口から 来る
	ok(
		count(4, "morning", (f, t) => f.kind === "edge" && t.kind === "work") > 0,
		"stage 4: nobody commutes from outside",
	);
	// 段2〜3 は 本館・浜・掲示板へ 来る 人だけ（職場は まだ ない）
	ok(count(2, "day", toWork) === 0, "stage 2: someone goes to work");
	for (let stage = 2; stage < TOWN_STAGES; stage++)
		for (const b of BANDS)
			ok(
				pickTrip(rng, crowdNodes(view(stage)), b, false) !== null,
				`stage ${stage} ${b}: nobody walks`,
			);
});

/** 村の 窓（全角 22字・2行）に 収まるか（villageTests.ts の fitsWindow と 同じ 数え方）。 */
const width = (line: string): number =>
	[...line].reduce((w, ch) => w + (/[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);

test("ひとこと：どれも 村の 窓に 収まり、時間帯の ひとことも その 時間帯に 出る", () => {
	for (const p of PERSONAS) {
		const all = [...p.lines, ...Object.values(p.bandLines).flat()];
		ok(p.lines.length >= 2, `${p.id}: too few lines`);
		for (const t of all) {
			const ls = t.split("\n");
			ok(ls.length <= 2, `${p.id}: "${t}" has ${ls.length} lines`);
			for (const l of ls) ok(width(l) <= 22, `${p.id}: "${l}" is too wide`);
		}
		const rng = seeded(3);
		for (const b of BANDS) {
			const seen = new Set(
				Array.from({ length: 60 }, () => crowdLine(rng, p, b)),
			);
			for (const t of seen)
				ok(
					p.lines.includes(t) || (p.bandLines[b] ?? []).includes(t),
					`${p.id} ${b}: "${t}" is from another time`,
				);
		}
	}
});

test("見た目：通行人は 下の 敵・村の 名前の ある 人と 同じ 絵を 使わない", () => {
	const named = new Set<string>([
		...Object.values(MONSTERS).map((m) => m.sprite),
		...Object.values(CAST).map((c) => c.walk),
		...Object.values(MOBS).map((m) => m.sprite),
	]);
	for (const p of PERSONAS) {
		ok(p.sprites.length > 0, `${p.id}: no sprite`);
		for (const s of p.sprites) {
			ok(s.startsWith("sa:"), `${p.id}: ${s} is not a walk sheet`);
			ok(!named.has(s), `${p.id}: ${s} is someone else's`);
		}
	}
});

/** 試験用の 地図（Field の 描かない ところだけ）。 */
const fakeField = (v: VillageView): Field => {
	const rows = villageRows(v).map((r) => [...r]);
	const tiles = villagePalette(v);
	const solid = { layers: [], color: "#000", passable: false };
	return {
		w: VILLAGE_W,
		h: VILLAGE_H,
		actors: [] as Actor[],
		tileAt: (x: number, y: number) => tiles[rows[y]?.[x] ?? ""] ?? solid,
	} as unknown as Field;
};

test("よく 出入りする 所：名前は どれも 町に ある 施設", () => {
	const places = new Set<string>();
	for (let st = 0; st < TOWN_STAGES; st++)
		for (const n of crowdNodes(view(st))) if (n.place) places.add(n.place);
	for (const p of PERSONAS)
		for (const ids of Object.values(p.haunts ?? {}))
			for (const id of ids ?? [])
				ok(places.has(id), `${p.id}: no ${id} on any map`);
});

test("動き（都市・夕方を 3分）：人は へらず ふえすぎず、通れない マスに 立たず、行き先に 着いて 入れかわる", () => {
	for (const stage of [4, 7]) {
		const v = view(stage);
		const field = fakeField(v);
		const player = new Actor("player", 19, 22, "down", "", null);
		const crowd = new Crowd(
			{
				field,
				nodes: crowdNodes(v),
				cost: villagePedCost(v),
				stage: layoutStage(v),
				player,
				clock: () => ({ hour: 18, weekend: false }),
				paused: () => false,
				hidden: () => false,
				target: () => null,
				talk: () => async () => {},
			},
			seeded(11 + stage),
		);
		const size = crowdSize(stage, "evening", false);
		ok(crowd.count > size / 2, `stage ${stage}: only ${crowd.count} at first`);
		const born = new Set(field.actors.map((a) => a.id));
		let maxCount = 0;
		let stacked = 0;
		const dt = 50;
		for (let t = 0; t < 180_000; t += dt) {
			for (const a of field.actors) a.update(dt);
			crowd.update(dt);
			maxCount = Math.max(maxCount, crowd.count);
			const at = new Map<string, number>();
			for (const a of field.actors) {
				if (a.moving) continue;
				ok(
					field.tileAt(a.x, a.y).passable ||
						// 扉の マス（通れない 地形の 上の 踏む 所）は 入る ときに 踏む
						crowdNodes(v).some((n) => n.at[0] === a.x && n.at[1] === a.y),
					`stage ${stage}: ${a.id} stands on ${a.x},${a.y}`,
				);
				const k = `${a.x},${a.y}`;
				at.set(k, (at.get(k) ?? 0) + 1);
			}
			for (const n of at.values()) if (n > 1) stacked++;
		}
		ok(maxCount <= size, `stage ${stage}: ${maxCount} people (size ${size})`);
		ok(crowd.count >= size / 2, `stage ${stage}: only ${crowd.count} left`);
		const left = [...born].filter(
			(id) => !field.actors.some((a) => a.id === id),
		).length;
		ok(
			left >= born.size / 2,
			`stage ${stage}: only ${left}/${born.size} arrived`,
		);
		// 重なるのは すれちがう 一瞬だけ（3分 × 20コマ/秒 の うち）
		ok(stacked < 400, `stage ${stage}: ${stacked} frames with two in a cell`);
	}
});

test("キリコと 重なった 人は 横へ よけ、話しかけに 来る 相手は 待つ", () => {
	const v = view(7);
	const field = fakeField(v);
	const player = new Actor("player", 0, 0, "down", "", null);
	let target: Actor | null = null;
	const crowd = new Crowd(
		{
			field,
			nodes: crowdNodes(v),
			cost: villagePedCost(v),
			stage: 7,
			player,
			clock: () => ({ hour: 12, weekend: false }),
			paused: () => false,
			hidden: () => false,
			target: () => target,
			talk: () => async () => {},
		},
		seeded(5),
	);
	const a = field.actors.find((x) => crowd.owns(x));
	ok(a, "nobody in the city");
	if (!a) return;
	// 話しかけに 来る 相手は 動かない
	target = a;
	const at = [a.x, a.y].join(",");
	for (let t = 0; t < 3000; t += 50) {
		for (const x of field.actors) x.update(50);
		crowd.update(50);
	}
	ok([a.x, a.y].join(",") === at, `the target walked from ${at}`);
	// キリコが 重なったら よける
	target = null;
	player.setPos(a.x, a.y);
	for (let t = 0; t < 400; t += 50) {
		for (const x of field.actors) x.update(50);
		crowd.update(50);
	}
	ok(
		!(a.x === player.x && a.y === player.y) || !field.actors.includes(a),
		"the passer-by stays on Kiriko",
	);
});

test("細道：桟橋の 先の 港の 出口からは 出てくるが、そこへ 向かう 人は いない（すれちがえずに 詰まらない）", () => {
	const v = view(7);
	const nodes = crowdNodes(v);
	const exit = nodes.find((n) => n.kind === "edge");
	ok(exit?.outOnly, "the harbor exit at the end of the pier is a goal");
	// 細道の 先には 出てくる 所しか ない（立ちどまる 所・向かう 扉は ない）
	const depth = narrowDepth(VILLAGE_W, VILLAGE_H, villagePedCost(v), [19, 22]);
	const d = (x: number, y: number) => depth[y * VILLAGE_W + x];
	ok(d(20, 50) >= NARROW_RUN, `the pier is only ${d(20, 50)} deep`);
	// 町の なかは 細道に ならない（本館の 扉の 前・広場）
	const hall = nodes.find((n) => n.kind === "hall");
	ok(
		d(19, 22) === 0 && hall && d(hall.at[0], hall.at[1] + 1) === 0,
		"the plaza counts as narrow",
	);
	for (const n of nodes)
		if (!n.enter)
			ok(
				d(n.at[0], n.at[1]) < NARROW_RUN,
				`${n.id} stands at the end of a narrow path`,
			);
	// どの 段・時間帯でも 細道の 先へは 向かわず、だれかは 歩く
	const rng = seeded(7);
	for (let stage = 2; stage < TOWN_STAGES; stage++) {
		const ns = crowdNodes(view(stage));
		for (const b of BANDS)
			for (let i = 0; i < 200; i++) {
				const t = pickTrip(rng, ns, b, false);
				ok(t, `stage ${stage} ${b}: nobody walks`);
				ok(!t?.to.outOnly, `stage ${stage} ${b}: someone heads to ${t?.to.id}`);
			}
	}
	// 朝の 都市を 3分：桟橋（x=20, y=43〜48）を 下る 人は いない
	const field = fakeField(v);
	const player = new Actor("player", 19, 22, "down", "", null);
	const crowd = new Crowd(
		{
			field,
			nodes,
			cost: villagePedCost(v),
			stage: layoutStage(v),
			player,
			clock: () => ({ hour: 8, weekend: false }),
			paused: () => false,
			hidden: () => false,
			target: () => null,
			talk: () => async () => {},
		},
		seeded(3),
	);
	const pier = (a: Actor) => a.x === 20 && a.y >= 43 && a.y <= 48;
	let up = 0;
	for (let t = 0; t < 180_000; t += 50) {
		const was = new Map(field.actors.map((a) => [a, a.y] as const));
		for (const a of field.actors) a.update(50);
		crowd.update(50);
		for (const a of field.actors) {
			const y0 = was.get(a);
			if (y0 === undefined || !pier(a)) continue;
			ok(a.y <= y0, `${a.id} walks down the pier at ${a.x},${a.y}`);
			if (a.y < y0) up++;
		}
	}
	ok(up > 0, "nobody comes up from the harbor");
});

test("道さがし：見こみつきでも いちばん 近い 道（曲がる ぶんも 入れて）を かえし、道の ない 所は null", () => {
	const v = view(7);
	const cost = villagePedCost(v);
	/** 道の 歩きにくさ（曲がる ぶんも。着く マスは 1）。 */
	const costOf = (from: [number, number], to: [number, number], r: Dir[]) => {
		let [x, y] = from;
		let sum = 0;
		r.forEach((d, i) => {
			x += DIR_VEC[d].dx;
			y += DIR_VEC[d].dy;
			sum += x === to[0] && y === to[1] ? 1 : cost(x, y);
			if (i > 0 && d !== r[i - 1]) sum += TURN_COST;
		});
		return { sum, end: [x, y].join(",") };
	};
	/** くらべる ための ふつうの 道さがし（向きつきの ダイクストラ。来た 道は すぐ もどらない）。 */
	const DIRS: Dir[] = ["up", "right", "down", "left"];
	const slow = (from: [number, number], to: [number, number]): number => {
		const key = (x: number, y: number, d: number) => `${x},${y},${d}`;
		const dist = new Map<string, number>();
		const open: [number, number, number, number][] = [];
		for (let d = 0; d < 4; d++) {
			const x = from[0] + DIR_VEC[DIRS[d]].dx;
			const y = from[1] + DIR_VEC[DIRS[d]].dy;
			const c = x === to[0] && y === to[1] ? 1 : cost(x, y);
			if (Number.isFinite(c)) {
				dist.set(key(x, y, d), c);
				open.push([c, x, y, d]);
			}
		}
		while (open.length) {
			open.sort((a, b) => a[0] - b[0]);
			const [g, x, y, din] = open.shift() as [number, number, number, number];
			if (g > (dist.get(key(x, y, din)) ?? Number.POSITIVE_INFINITY)) continue;
			if (x === to[0] && y === to[1]) return g;
			for (let d = 0; d < 4; d++) {
				if ((d + 2) % 4 === din) continue;
				const nx = x + DIR_VEC[DIRS[d]].dx;
				const ny = y + DIR_VEC[DIRS[d]].dy;
				const c = nx === to[0] && ny === to[1] ? 1 : cost(nx, ny);
				if (!Number.isFinite(c)) continue;
				const nd = g + c + (d === din ? 0 : TURN_COST);
				if (nd < (dist.get(key(nx, ny, d)) ?? Number.POSITIVE_INFINITY)) {
					dist.set(key(nx, ny, d), nd);
					open.push([nd, nx, ny, d]);
				}
			}
		}
		return Number.POSITIVE_INFINITY;
	};
	const nodes = crowdNodes(v);
	const rng = seeded(19);
	for (let i = 0; i < 24; i++) {
		const a = nodes[Math.floor(rng() * nodes.length)].at as [number, number];
		const b = nodes[Math.floor(rng() * nodes.length)].at as [number, number];
		if (a.join() === b.join()) continue;
		const r = pedRoute(VILLAGE_W, VILLAGE_H, cost, a, b);
		const want = slow(a, b);
		if (!Number.isFinite(want)) {
			ok(r === null, `${a}→${b}: a route through walls`);
			continue;
		}
		ok(r, `${a}→${b}: no route`);
		if (!r) continue;
		const got = costOf(a, b, r);
		ok(got.end === b.join(","), `${a}→${b}: ends at ${got.end}`);
		ok(
			Math.abs(got.sum - want) < 1e-6,
			`${a}→${b}: cost ${got.sum.toFixed(2)}, best ${want.toFixed(2)}`,
		);
	}
	// 海の まんなか（行けない 所）
	ok(
		pedRoute(VILLAGE_W, VILLAGE_H, cost, [19, 22], [0, 51]) === null,
		"a route into the sea",
	);
});

export const runCrowdTests = (): TestResult[] =>
	CASES.map((c) => {
		try {
			c.run();
			return { id: "crowd", name: c.name, ok: true };
		} catch (e) {
			return {
				id: "crowd",
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			};
		}
	});
