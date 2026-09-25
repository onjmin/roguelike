// 階を作る：形・階段・キリコの位置・配られた札・モンスター・罠・モンスターハウス。

import {
	CARRY_CHANCE,
	HOUSE_EARLY_BY,
	HOUSE_MIN_AREA,
	HOUSE_MONSTERS,
	HOUSE_MONSTERS_EARLY,
	INITIAL_MONSTERS,
	trapCount,
} from "./balance";
import { MONSTERS, monstersFor } from "./data/monsters";
import { canSee } from "./fov";
import { DIRS8, type Pos, step } from "./geom";
import { deckOf } from "./item";
import { generateLayout, idx, roomAt, roomTiles } from "./mapgen";
import type { Run } from "./run";
import {
	DEEP,
	DOZE,
	type Floor,
	type Item,
	type Monster,
	type MonsterDef,
	type TrapKind,
} from "./types";

const TRAP_KINDS: { kind: TrapKind; weight: number; from: number }[] = [
	{ kind: "bear", weight: 3, from: 3 },
	{ kind: "acid", weight: 2, from: 5 },
	{ kind: "sleep", weight: 3, from: 3 },
	{ kind: "trip", weight: 3, from: 3 },
	{ kind: "mine", weight: 2, from: 5 },
	{ kind: "arrow", weight: 3, from: 3 },
	{ kind: "dart", weight: 2, from: 4 },
	{ kind: "warp", weight: 3, from: 3 },
	{ kind: "pit", weight: 2, from: 3 },
];

/** 罠の種類を引く。level は 本編の何階ぶんか（Run.levelAt）。 */
export const pickTrapKind = (r: Run, level: number): TrapKind =>
	r.rng.weighted(
		TRAP_KINDS.filter((t) => Math.max(3, level) >= t.from),
		(t) => t.weight,
	).kind;

/** 部屋の中の、空いている床（階段・道具・罠・キャラのいない所）。 */
const freeRoomTiles = (r: Run, f: Floor, roomId: number | null): Pos[] => {
	const rooms = roomId === null ? f.layout.rooms : [f.layout.rooms[roomId]];
	const out: Pos[] = [];
	for (const room of rooms)
		for (const t of roomTiles(room)) {
			if (t.x === f.stairs.x && t.y === f.stairs.y) continue;
			if (f.items.some((i) => i.x === t.x && i.y === t.y)) continue;
			if (f.traps.some((i) => i.x === t.x && i.y === t.y)) continue;
			if (f.monsters.some((m) => m.x === t.x && m.y === t.y)) continue;
			if (r.s.floor === f && r.p.x === t.x && r.p.y === t.y) continue;
			out.push(t);
		}
	return out;
};

export const buildFloor = (
	r: Run,
	depth: number,
	kinds: string[],
	house: boolean,
): Floor => {
	const rng = r.rng;
	const layout = generateLayout(rng);
	const rooms = layout.rooms;
	const f: Floor = {
		depth,
		layout,
		stairs: { x: 0, y: 0 },
		items: [],
		traps: [],
		monsters: [],
		seen: new Uint8Array(layout.w * layout.h),
		cards: [],
		wards: [],
		house: -1,
		houseAwake: false,
		turns: 0,
		senseMonsters: false,
		senseItems: false,
		sight: false,
	};
	// 階段とキリコ（なるべく別の部屋）
	const stairRoom = rng.int(rooms.length);
	f.stairs = rng.pick(roomTiles(rooms[stairRoom]));
	let startRoom = rng.int(rooms.length);
	if (rooms.length > 1)
		while (startRoom === stairRoom) startRoom = rng.int(rooms.length);
	const startTiles = roomTiles(rooms[startRoom]).filter(
		(t) => t.x !== f.stairs.x || t.y !== f.stairs.y,
	);
	const start = rng.pick(startTiles);
	r.p.x = start.x;
	r.p.y = start.y;

	// モンスターハウス（キリコのいない部屋。入ったとたんに囲まれないよう、広い部屋を選ぶ）
	if (house && rooms.length > 1) {
		const cands = rooms.map((_, i) => i).filter((i) => i !== startRoom);
		const area = (i: number) => rooms[i].w * rooms[i].h;
		const wide = cands.filter((i) => area(i) >= HOUSE_MIN_AREA);
		f.house = wide.length
			? rng.pick(wide)
			: cands.reduce((a, b) => (area(b) > area(a) ? b : a));
	}

	// いちばん底：目的の品を置く（階段の代わりに。帰り道は上り階段）
	if (depth === r.dungeon.floors && !r.s.returning) {
		const spot = rng.pick(
			freeRoomTiles(r, f, stairRoom).filter(
				(t) => t.x !== start.x || t.y !== start.y,
			),
		);
		f.items.push({ x: spot.x, y: spot.y, item: r.newItem(r.dungeon.goal) });
	}

	// 札：モンスターハウスがあれば半分以上をハウスの中へ
	const cards: Item[] = kinds.map((k) => {
		const it = r.newItem(k);
		r.s.cardKind[it.uid] = k;
		f.cards.push(it.uid);
		return it;
	});
	const toCarry: Item[] = [];
	for (const it of cards) {
		const inHouse = f.house >= 0 && rng.chance(0.6);
		const spots = freeRoomTiles(r, f, inHouse ? f.house : null).filter(
			(t) => t.x !== start.x || t.y !== start.y,
		);
		if (!inHouse && rng.chance(CARRY_CHANCE)) {
			toCarry.push(it);
			continue;
		}
		const at = rng.pick(spots);
		if (at) f.items.push({ x: at.x, y: at.y, item: it });
		else toCarry.push(it);
	}

	// 罠（部屋の中だけ。道具の下には置かない）
	const level = r.levelAt(depth);
	const [tlo, thi] = depth < r.dungeon.trapsFrom ? [0, 0] : trapCount(level);
	const nTraps = rng.range(tlo, thi) + (f.house >= 0 ? rng.range(3, 5) : 0);
	for (let i = 0; i < nTraps; i++) {
		const inHouse = f.house >= 0 && i >= nTraps - 4;
		const spots = freeRoomTiles(r, f, inHouse ? f.house : null).filter(
			(t) => t.x !== start.x || t.y !== start.y,
		);
		const at = rng.pick(spots);
		if (at)
			f.traps.push({
				x: at.x,
				y: at.y,
				kind: pickTrapKind(r, Math.max(3, level)),
				found: false,
			});
	}

	// モンスター（最初からいるもの。キリコの部屋には置かない）
	const place = (roomId: number | null): Pos | null => {
		const spots = freeRoomTiles(r, f, roomId).filter(
			(t) => roomAt(layout, t.x, t.y) !== startRoom,
		);
		return spots.length ? rng.pick(spots) : null;
	};
	const prevFloor = r.s.floor;
	// spawnMonster は r.f を見るので、一時的にこの階を入れておく
	r.s.floor = f;
	const [mlo, mhi] = INITIAL_MONSTERS;
	const n = rng.range(mlo, mhi);
	for (let i = 0; i < n; i++) {
		const at = place(null);
		if (at) spawnMonster(r, null, at, {});
	}
	if (f.house >= 0) {
		const [hlo, hhi] =
			r.levelAt(f.depth) <= HOUSE_EARLY_BY
				? HOUSE_MONSTERS_EARLY
				: HOUSE_MONSTERS;
		// 部屋の広さの 1/3 まで（ぎゅうぎゅうにしない）
		const room = rooms[f.house];
		const hn = Math.min(rng.range(hlo, hhi), Math.floor((room.w * room.h) / 3));
		for (let i = 0; i < hn; i++) {
			const at = place(f.house);
			if (at) spawnMonster(r, null, at, { sleep: DOZE });
		}
	}
	// 持たせる札（最初からいるモンスターに1枚ずつ）
	const holders = rng.shuffle(f.monsters.filter((m) => !m.carry));
	for (const it of toCarry) {
		const m = holders.pop();
		if (m) m.carry = it;
		else {
			const at = rng.pick(freeRoomTiles(r, f, null));
			if (at) f.items.push({ x: at.x, y: at.y, item: it });
		}
	}
	r.s.floor = prevFloor;
	return f;
};

/** モンスターを出す。kind が null なら その階の表から選ぶ。 */
export const spawnMonster = (
	r: Run,
	kind: string | null,
	at: Pos,
	opts: { sleep?: number; awake?: boolean },
): Monster | null => {
	const f = r.f;
	const rng = r.rng;
	let def: MonsterDef | undefined;
	if (kind) def = MONSTERS[kind];
	else {
		// 敵の顔ぶれは 本編の何階ぶんか で引く（本編の表は20階まで。それより深い階は20階の顔ぶれ）
		const list = monstersFor(Math.max(1, Math.min(20, r.levelAt(f.depth))));
		if (!list.length) return null;
		def = rng.weighted(list, (m) => m.weight);
	}
	if (!def) return null;
	const make = (p: Pos): Monster => {
		let sleep = 0;
		if (opts.awake) sleep = 0;
		else if (opts.sleep !== undefined) sleep = opts.sleep;
		else if (def.sleep === "never") sleep = 0;
		else if (def.sleep === "always") sleep = DOZE;
		else if (def.sleep === "deep") sleep = DEEP;
		else sleep = rng.chance(1 / 2) ? DOZE : 0;
		const m: Monster = {
			uid: r.s.nextUid++,
			kind: def.id,
			x: p.x,
			y: p.y,
			dir: rng.pick(DIRS8),
			hp: def.hp,
			maxHp: def.hp,
			nextAt: r.p.nextAt,
			status: {
				sleep,
				confuse: 0,
				paralyze: 0,
				slow: 0,
				fast: 0,
				blind: false,
				sealed: false,
				dormant: def.abilities.some((a) => a.k === "statue"),
			},
			carry: null,
			goal: null,
			lastSeen: null,
			disguise: null,
		};
		if (def.abilities.some((a) => a.k === "mimic") && !opts.awake) {
			m.disguise = rng.weighted(deckOf(r.s), (e) => e.count).kind;
			m.status.sleep = 0;
		}
		f.monsters.push(m);
		return m;
	};
	const first = make(at);
	// 群れ（雪だるま）は 4体で出る
	if (def.abilities.some((a) => a.k === "pack") && !kind) {
		let placed = 1;
		for (const d of rng.shuffle([...DIRS8])) {
			if (placed >= 4) break;
			const p = step(at, d);
			if (r.isFree(p.x, p.y) && roomAt(f.layout, p.x, p.y) >= 0) {
				make(p);
				placed++;
			}
		}
	}
	return first;
};

/**
 * 同じ階の、部屋の中の空いた床をひとつ。awayFromPlayer ならキリコから見えない所。
 */
export const randomFloorPos = (r: Run, awayFromPlayer: boolean): Pos | null => {
	const f = r.f;
	const spots = freeRoomTiles(r, f, null).filter(
		(t) => !awayFromPlayer || !canSee(f.layout, t, r.p),
	);
	if (!spots.length) return null;
	return r.rng.pick(spots);
};

/** idx の小道具（描画・地図用）。 */
export const tileIndex = (f: Floor, p: Pos): number => idx(f.layout, p.x, p.y);
