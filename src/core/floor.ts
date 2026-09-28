// 階を作る：形・階段・キリコの位置・道具・モンスター・罠・モンスターハウス。

import {
	CARRY_CHANCE,
	HOUSE_EARLY_BY,
	HOUSE_ITEMS,
	HOUSE_MIN_AREA,
	HOUSE_MONSTERS,
	HOUSE_MONSTERS_EARLY,
	HOUSE_SHAPE_CHANCE,
	HOUSE_SHAPE_FROM,
	INITIAL_MONSTERS,
	trapCount,
} from "./balance";
import { MONSTERS, monstersFor } from "./data/monsters";
import { canSee } from "./fov";
import { DIRS8, type Pos, step } from "./geom";
import { itemTableOf } from "./item";
import { rollKinds } from "./itemTable";
import {
	generateLayout,
	type HouseShape,
	houseShapeLayout,
	idx,
	isFloor,
	roomAt,
	roomTiles,
	T_WALL,
} from "./mapgen";
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
			if (!isFloor(f.layout, t.x, t.y)) continue; // ただの 置物
			if (f.items.some((i) => i.x === t.x && i.y === t.y)) continue;
			if (f.traps.some((i) => i.x === t.x && i.y === t.y)) continue;
			if (f.monsters.some((m) => m.x === t.x && m.y === t.y)) continue;
			if (r.s.floor === f && r.p.x === t.x && r.p.y === t.y) continue;
			out.push(t);
		}
	return out;
};

export const buildFloor = (r: Run, depth: number, house: boolean): Floor => {
	const rng = r.rng;
	// 祭りの階は ときどき 大部屋・二分割・四分割（トルネコ1と 同じ。ふつうの階は 乱数を 引かない）
	const shape: HouseShape | null =
		house &&
		r.levelAt(depth) >= HOUSE_SHAPE_FROM &&
		rng.chance(HOUSE_SHAPE_CHANCE)
			? rng.pick<HouseShape>(["big", "split2", "split4"])
			: null;
	const layout = shape ? houseShapeLayout(rng, shape) : generateLayout(rng);
	const rooms = layout.rooms;
	const f: Floor = {
		depth,
		layout,
		stairs: { x: 0, y: 0 },
		items: [],
		traps: [],
		monsters: [],
		seen: new Uint8Array(layout.w * layout.h),
		wards: [],
		house: -1,
		houseAwake: false,
		turns: 0,
		res: 0,
		resWarned: 0,
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

	// モンスターハウス（キリコのいない部屋。入ったとたんに囲まれないよう、広い部屋を選ぶ）。
	// 大部屋は ひと部屋 まるごと 祭りで、はじめから 中に いる（開幕の 祭り）
	if (house && rooms.length === 1) f.house = 0;
	else if (house) {
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

	placeStatues(r, f, start);

	// 道具（トルネコ1と同じく 表から引く。帰り道は 何も置かない）。モンスターハウスがあれば半分以上をハウスの中へ
	let nItems = 0;
	if (!r.s.returning) {
		nItems = rng.range(r.dungeon.perFloor[0], r.dungeon.perFloor[1]);
		if (f.house >= 0) nItems += rng.range(HOUSE_ITEMS[0], HOUSE_ITEMS[1]);
	}
	const items: Item[] = rollKinds(rng, itemTableOf(r.s), nItems).map((k) =>
		r.newItem(k),
	);
	const toCarry: Item[] = [];
	for (const it of items) {
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
	// 祭りの部屋には 3〜5個 足す（トルネコ1と 同じ）
	const nBase = rng.range(tlo, thi);
	const nHouse = f.house >= 0 ? rng.range(3, 5) : 0;
	const nTraps = nBase + nHouse;
	for (let i = 0; i < nTraps; i++) {
		const inHouse = i >= nTraps - nHouse;
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

	// モンスター（最初からいるもの。キリコの部屋には置かない。大部屋では キリコの 2マス 以内に 置かない）
	const place = (roomId: number | null): Pos | null => {
		const spots = freeRoomTiles(r, f, roomId).filter((t) =>
			rooms.length === 1
				? Math.max(Math.abs(t.x - start.x), Math.abs(t.y - start.y)) > 2
				: roomAt(layout, t.x, t.y) !== startRoom,
		);
		return spots.length ? rng.pick(spots) : null;
	};
	const prevFloor = r.s.floor;
	// spawnMonster は r.f を見るので、一時的にこの階を入れておく
	r.s.floor = f;
	const [mlo, mhi] = INITIAL_MONSTERS;
	// 過疎の 板（離島）は 少ない
	const n = Math.round(rng.range(mlo, mhi) * (r.dungeon.sparse ?? 1));
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
			if (at) spawnMonster(r, null, at, { sleep: DOZE, single: true });
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

/** ただの 置物の 数（置物の 敵が 出る 階だけ）。 */
export const STATUES: [number, number] = [2, 4];

/**
 * ただの 置物（動かない。通れない 地形）を 置く。置物の 敵（still の ある 敵）が 出る 階だけで、
 * 動きだす まで 見分けが つかない（ほかの 階では 乱数を 引かない）。
 * 部屋の 内がわ（まわり 8マスが 同じ 部屋の 床）で、ほかの 置物・階段・キリコ・目的の品の となりには 置かない
 * （まわりが あいて いるので 部屋は 分かれない）。
 */
const placeStatues = (r: Run, f: Floor, start: Pos): void => {
	const foes = r.dungeon.foes ?? {};
	const level = Math.max(1, Math.min(30, r.levelAt(f.depth)));
	const still = monstersFor(level, r.s.dungeon).some(
		(m) => m.still && (foes[m.id] ?? 1) > 0,
	);
	if (!still || r.s.returning) return;
	const l = f.layout;
	const near = (a: Pos, b: Pos) =>
		Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
	const taken: Pos[] = [f.stairs, start, ...f.items];
	const n = r.rng.range(STATUES[0], STATUES[1]);
	f.statues = [];
	for (let i = 0; i < n; i++) {
		const cands = l.rooms
			.flatMap((room) => roomTiles(room))
			.filter(
				(t) =>
					DIRS8.every((d) => {
						const q = step(t, d);
						return (
							roomAt(l, q.x, q.y) === roomAt(l, t.x, t.y) &&
							isFloor(l, q.x, q.y)
						);
					}) &&
					isFloor(l, t.x, t.y) &&
					!taken.some((q) => near(q, t)),
			);
		if (!cands.length) break;
		const at = r.rng.pick(cands);
		l.tiles[idx(l, at.x, at.y)] = T_WALL;
		f.statues.push(idx(l, at.x, at.y));
		taken.push(at);
	}
};

/** モンスターを出す。kind が null なら その階の表から選ぶ。 */
export const spawnMonster = (
	r: Run,
	kind: string | null,
	at: Pos,
	opts: { sleep?: number; awake?: boolean; single?: boolean },
): Monster | null => {
	const f = r.f;
	const rng = r.rng;
	let def: MonsterDef | undefined;
	if (kind) def = MONSTERS[kind];
	else {
		// 敵の顔ぶれは 本編の何階ぶんか で引く（表は もっと の 30階まで。それより深い階は30階の顔ぶれ）
		// 板ごとの 出やすさ（data/dungeons.ts の foes。0 は 出ない）
		const foes = r.dungeon.foes ?? {};
		const list = monstersFor(
			Math.max(1, Math.min(30, r.levelAt(f.depth))),
			r.s.dungeon,
		).filter((m) => (foes[m.id] ?? 1) > 0);
		if (!list.length) return null;
		def = rng.weighted(list, (m) => m.weight * (foes[m.id] ?? 1));
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
		const dormant = def.abilities.some((a) => a.k === "statue");
		// 向きの 乱数は 置物でも 引く（引く 順と 回数を 変えない）。置物は 動きだす まで 前向き
		const dir = rng.pick(DIRS8);
		const m: Monster = {
			uid: r.s.nextUid++,
			kind: def.id,
			x: p.x,
			y: p.y,
			dir: dormant ? 4 : dir,
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
				dormant,
			},
			carry: null,
			goal: null,
			lastSeen: null,
			disguise: null,
		};
		if (def.abilities.some((a) => a.k === "mimic") && !opts.awake) {
			m.disguise = rng.weighted(itemTableOf(r.s), (e) => e.weight).kind;
			m.status.sleep = 0;
		}
		f.monsters.push(m);
		return m;
	};
	const first = make(at);
	// 群れ（凍結アカ）は 4体で出る
	// （モンスターハウスでは 1体ずつ。トルネコ1の イエティと 同じ）
	if (def.abilities.some((a) => a.k === "pack") && !kind && !opts.single) {
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
