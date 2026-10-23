// 階を作る：形・階段・キリコの位置・道具・モンスター・罠・モンスターハウス。

import { ambushDepth, placeAmbush } from "./ambush";
import {
	CARRY_CHANCE,
	FLOOR_ITEMS_MIN,
	HELD_ITEM_SHIFT,
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
import { BOARD_DECOR } from "./data/decor";
import type {
	BossArena,
	BossSpec,
	RestFloor,
	SettlementSpec,
} from "./data/dungeons";
import { ITEMS } from "./data/items";
import { MONSTERS, monstersFor, onBoard, SWAP_BREADS } from "./data/monsters";
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
	type Layout,
	pickLayoutKind,
	roomAt,
	roomTiles,
	T_ROOM,
	T_WALL,
	tileAt,
} from "./mapgen";
import { placeRival } from "./race";
import { Rng } from "./rng";
import type { Run } from "./run";
import { placeSetPiece, setPieceAt } from "./setpiece";
import {
	DEEP,
	DOZE,
	type Floor,
	type FloorDecor,
	type FloorFolk,
	type FloorProp,
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
export const freeRoomTiles = (
	r: Run,
	f: Floor,
	roomId: number | null,
): Pos[] => {
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
			// 同行者の マスにも 置かない（core/guest.ts）
			if (r.s.floor === f && r.isGuestAt(t.x, t.y)) continue;
			out.push(t);
		}
	return out;
};

export const buildFloor = (r: Run, depth: number, house: boolean): Floor => {
	const rng = r.rng;
	// 目的が boss の いちばん底：品は 置かず、ボスが 待つ。祭りにも しない（祭りの 階は Run.create で
	// 決まっているが、乱数の 順を 変えないよう ここで 消す）
	const bossFloor =
		depth === r.dungeon.floors && !r.s.returning && r.bossSpec !== null;
	// 名所の 階（敵・罠・道具なし。地図が 見える）
	const rest = r.dungeon.rests?.find((x) => x.depth === depth);
	// いちばん底の 集落（ボスの 待つ 底では ない とき）
	const settle =
		depth === r.dungeon.floors && !r.s.returning && !bossFloor
			? r.dungeon.settlement
			: undefined;
	// ボスが 住む 大部屋（ポケダン風。BossSpec の arena）
	const arena = bossFloor ? r.bossSpec?.arena : undefined;
	// 名所・集落・大部屋は 手づくりの 地図（core/data/places.ts）
	if (settle || rest || arena)
		return buildPlaceFloor(r, depth, settle, rest, arena);
	// 手合わせの 待ちぶせ（core/ambush.ts。祭りには しない）
	const ambushHere = !r.s.returning && ambushDepth(r) === depth;
	// 見せ場の 階（core/setpiece.ts。祭りには しない）
	const piece = setPieceAt(r, depth);
	const festival = house && !bossFloor && !ambushHere && !piece;
	// 祭りの階は ときどき 大部屋・二分割・四分割（トルネコ1と 同じ。ふつうの階は 乱数を 引かない）
	const shape: HouseShape | null =
		festival &&
		r.levelAt(depth) >= HOUSE_SHAPE_FROM &&
		rng.chance(HOUSE_SHAPE_CHANCE)
			? rng.pick<HouseShape>(["big", "split2", "split4"])
			: null;
	// ふつうの 階の 形は 板と 階で ちがう（core/data/dungeons.ts の layouts。core/mapgen.ts の LayoutKind）
	const layout = shape
		? houseShapeLayout(rng, shape)
		: generateLayout(rng, pickLayoutKind(rng, r.dungeon.layouts, depth));
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
	if (festival && rooms.length === 1) f.house = 0;
	else if (festival) {
		const cands = rooms.map((_, i) => i).filter((i) => i !== startRoom);
		const area = (i: number) => rooms[i].w * rooms[i].h;
		const wide = cands.filter((i) => area(i) >= HOUSE_MIN_AREA);
		f.house = wide.length
			? rng.pick(wide)
			: cands.reduce((a, b) => (area(b) > area(a) ? b : a));
	}

	// いちばん底：目的の品を置く（階段の代わりに。帰り道は上り階段）。ボスの 階は ボスが 持っている
	// 目的が event・deliver・bring の 底は 品を 置かない（着くと もらう：Run.eventReached・Run.enterFloor）
	if (
		depth === r.dungeon.floors &&
		!r.s.returning &&
		!bossFloor &&
		!r.eventSpec &&
		!r.bringSpec
	) {
		const spot = rng.pick(
			freeRoomTiles(r, f, stairRoom).filter(
				(t) => t.x !== start.x || t.y !== start.y,
			),
		);
		f.items.push({ x: spot.x, y: spot.y, item: r.newItem(r.dungeon.goal) });
	}

	placeStatues(r, f, start);
	// 競争：底で 先に 着いた ロゼが 品の となりに 立つ（core/race.ts。乱数は 引かない）
	placeRival(r, f, start);

	// 道具（トルネコ1と同じく 表から引く。帰り道は 何も置かない）。モンスターハウスがあれば半分以上をハウスの中へ。
	// ふつうの 分は 降りた ときの 持ち物の 数で 足し引きする（少ないと 多め・多いと 少なめ。祭りの 分は そのまま）。
	// 1階は だれでも 持ち物が 始めの 分だけなので 足し引きしない
	let nItems = 0;
	if (!r.s.returning) {
		const held = r.p.items.length;
		const shift =
			depth === 1 ? 0 : (HELD_ITEM_SHIFT.find((s) => held <= s.at)?.add ?? 0);
		nItems = Math.max(
			FLOOR_ITEMS_MIN,
			rng.range(r.dungeon.perFloor[0], r.dungeon.perFloor[1]) + shift,
		);
		if (f.house >= 0) nItems += rng.range(HOUSE_ITEMS[0], HOUSE_ITEMS[1]);
	}
	const table = itemTableOf(r.s);
	const kinds = rollKinds(rng, table, nItems);
	// 入門の 板は 1階に 武器を 1本は 置く（引いた 中に 無ければ 1つ目を 武器に。敵にも 持たせない）。
	// 素手のまま 2〜3階で 倒れる 回を なくす（2026-10-03 はじめての 人の 目線の 見直し）
	let sure = -1;
	if (r.dungeon.firstWeapon && depth === 1 && kinds.length) {
		const weapons = table.filter((e) => ITEMS[e.kind]?.cat === "weapon");
		if (!kinds.some((k) => ITEMS[k]?.cat === "weapon") && weapons.length) {
			kinds[0] = rng.weighted(weapons, (e) => e.weight).kind;
			sure = 0;
		}
	}
	const items: Item[] = kinds.map((k) => r.newItem(k));
	const toCarry: Item[] = [];
	for (const [i, it] of items.entries()) {
		const inHouse = f.house >= 0 && rng.chance(0.6);
		const spots = freeRoomTiles(r, f, inHouse ? f.house : null).filter(
			(t) => t.x !== start.x || t.y !== start.y,
		);
		if (!inHouse && i !== sure && rng.chance(CARRY_CHANCE)) {
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
		// 山場の 祭り（パレード）は 決まった 敵だけ
		const parade = r.dungeon.parade?.depth === depth ? r.dungeon.parade : null;
		const kind = parade ? parade.monster : null;
		const [hlo, hhi] =
			parade?.count ??
			(r.levelAt(f.depth) <= HOUSE_EARLY_BY
				? HOUSE_MONSTERS_EARLY
				: HOUSE_MONSTERS);
		// 部屋の広さの 1/3 まで（ぎゅうぎゅうにしない）
		const room = rooms[f.house];
		const hn = Math.min(rng.range(hlo, hhi), Math.floor((room.w * room.h) / 3));
		for (let i = 0; i < hn; i++) {
			const at = place(f.house);
			if (at) spawnMonster(r, kind, at, { sleep: DOZE, single: true });
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
	// ボス：階段の 部屋に 1体（持たせる 道具を 配った あと。何も 持たない）。見られるまで 眠って 動かない
	// （run.ts の checkBossSeen で 起きる）。部屋が 1つなら キリコの 2マス 以内には 置かない
	const spec = bossFloor ? r.bossSpec : null;
	if (spec) {
		const away = (t: Pos) =>
			Math.max(Math.abs(t.x - start.x), Math.abs(t.y - start.y)) > 2;
		const inStairs = freeRoomTiles(r, f, stairRoom).filter(away);
		const spots = inStairs.length
			? inStairs
			: freeRoomTiles(r, f, null).filter(away);
		const at = spots.length ? rng.pick(spots) : null;
		const m =
			at && spawnMonster(r, spec.monster, at, { sleep: DEEP, single: true });
		if (m) f.boss = m.uid;
		// 先回りした 人の 差し入れ（着いた 部屋に）
		const near = freeRoomTiles(r, f, startRoom).filter(
			(t) =>
				(t.x !== start.x || t.y !== start.y) &&
				(t.x !== f.stairs.x || t.y !== f.stairs.y) &&
				!f.monsters.some((x) => x.x === t.x && x.y === t.y) &&
				!f.items.some((i) => i.x === t.x && i.y === t.y),
		);
		for (const kind of spec.supply?.items ?? []) {
			if (!near.length) break;
			const spot = near.splice(rng.int(near.length), 1)[0];
			f.items.push({ x: spot.x, y: spot.y, item: r.newItem(kind) });
		}
	}
	if (ambushHere) placeAmbush(r, f, stairRoom, start);
	if (piece) placeSetPiece(r, f, piece);
	placePools(r, f);
	placeDecor(r, f);
	// 書きかえた 冒険：キリコの いない 部屋に 削除人が 1体（ふつうの 冒険では 乱数を 引かない）
	if (r.s.cheat) {
		const at = place(null);
		if (at) spawnMonster(r, HUNTER, at, { awake: true, single: true });
	}
	r.s.floor = prevFloor;
	return f;
};

/**
 * 湯気の 立つ 湯だまり（見た目だけ。DungeonDef.pools）と、ほかの 板の 水たまり（core/data/decor.ts の liquid。
 * Floor.poolArt に 岸の 絵）。ひと目で 池と わかる 広さ（3x2〜5x3。大きい 池は
 * 角を ときどき 欠く）を、部屋の 中ほど（まわり 1マスも 同じ 部屋の 床）の、道具・罠・敵・階段の ない 床に かず だけ。
 * 入らなければ 場所と 形を 引きなおし、それでも だめなら 置かない。
 * 乱数は 冒険の 種と 階から 別に 作る（階の 作りの 乱数の 順を 変えない。記録の 再生が ずれないように）。
 */
const POOL_SHAPES: readonly [number, number][] = [
	[3, 2],
	[2, 3],
	[3, 3],
	[4, 2],
	[4, 3],
	[5, 3],
];
const placePools = (r: Run, f: Floor): void => {
	const liquid = BOARD_DECOR[r.dungeon.id]?.liquid;
	const span = r.dungeon.pools ?? liquid?.count;
	if (!span) return;
	const rng = Rng.fromSeed(`${r.s.seed}:pools:${f.depth}`);
	const l = f.layout;
	const w = l.w;
	const free = new Set(freeRoomTiles(r, f, null).map((t) => t.y * w + t.x));
	const n = rng.range(span[0], span[1]);
	const pools: number[] = [];
	for (let k = 0; k < n; k++)
		for (let tries = 0; tries < 30 && free.size; tries++) {
			const list = [...free];
			const at = list[rng.int(list.length)];
			const [pw, ph] = rng.pick(POOL_SHAPES);
			const x0 = at % w;
			const y0 = Math.floor(at / w);
			const room = roomAt(l, x0, y0);
			// 池と まわり 1マスが 同じ 部屋の 床（通路の 口や 壁ぎわを ふさがない）
			let inside = room >= 0;
			for (let y = y0 - 1; inside && y <= y0 + ph; y++)
				for (let x = x0 - 1; inside && x <= x0 + pw; x++)
					inside = roomAt(l, x, y) === room;
			if (!inside) continue;
			const cells: number[] = [];
			const big = pw >= 3 && ph >= 3;
			for (let dy = 0; dy < ph; dy++)
				for (let dx = 0; dx < pw; dx++) {
					const corner =
						(dx === 0 || dx === pw - 1) && (dy === 0 || dy === ph - 1);
					if (big && corner && rng.chance(0.5)) continue;
					cells.push(at + dy * w + dx);
				}
			if (!cells.every((i) => free.has(i))) continue;
			for (const i of cells) {
				pools.push(i);
				free.delete(i);
			}
			break;
		}
	f.pools = pools;
	if (!r.dungeon.pools && liquid && pools.length) f.poolArt = liquid.pond;
};

/**
 * 板の 装飾（見た目だけ。core/data/decor.ts）を 部屋の 北の 壁ぎわ（真上が 壁の 床）に 散らす。
 * 道具・敵・階段・水たまり・置物の ない マスに 置き（横 2マスの 物は 2マスとも）、まわりの マスには 重ねて 置かない。
 * かける 物（hang）は その マスの 真上の 壁の 面に 描く。
 * 罠は よけない（装飾の ある マスが 安全と わからない ように）。乱数は 湯だまりと 同じく 階の 作りと 別。
 */
const placeDecor = (r: Run, f: Floor): void => {
	const set = BOARD_DECOR[r.dungeon.id];
	if (!set) return;
	const rng = Rng.fromSeed(`${r.s.seed}:decor:${f.depth}`);
	const l = f.layout;
	const w = l.w;
	const statues = new Set(f.statues ?? []);
	const taken = new Set<number>([...(f.pools ?? []), ...statues]);
	taken.add(f.stairs.y * w + f.stairs.x);
	for (const it of f.items) taken.add(it.y * w + it.x);
	for (const m of f.monsters) taken.add(m.y * w + m.x);
	const wallSpots: Pos[] = [];
	for (const room of l.rooms)
		for (const t of roomTiles(room)) {
			if (!isFloor(l, t.x, t.y)) continue;
			const up = (t.y - 1) * w + t.x;
			if (tileAt(l, t.x, t.y - 1) === T_WALL && !statues.has(up))
				wallSpots.push(t);
		}
	const spotKeys = new Set(wallSpots.map((t) => t.y * w + t.x));
	const total = set.kinds.reduce((n, k) => n + (k.weight ?? 1), 0);
	const n = rng.range(set.count[0], set.count[1]);
	const out: FloorDecor[] = [];
	for (let k = 0; k < n; k++) {
		let roll = rng.int(total);
		const kind =
			set.kinds.find((d) => {
				roll -= d.weight ?? 1;
				return roll < 0;
			}) ?? set.kinds[0];
		const span = kind.w ?? 1;
		const spots = wallSpots.filter((t) => {
			for (let dx = 0; dx < span; dx++) {
				const i = t.y * w + t.x + dx;
				if (taken.has(i) || !spotKeys.has(i)) return false;
			}
			return true;
		});
		if (!spots.length) continue;
		const at = rng.pick(spots);
		for (let dy = -1; dy <= 1; dy++)
			for (let dx = -1; dx <= span; dx++)
				taken.add((at.y + dy) * w + at.x + dx);
		out.push({
			x: at.x,
			y: at.y,
			art: kind.art,
			...(kind.w === 2 ? { w: 2 as const } : {}),
			...(kind.hang ? { hang: true as const } : {}),
		});
	}
	if (out.length) f.decor = out;
};

/** 同じ 字の マスを つながった かたまりごとの 長方形に まとめる（巨大な 置物。かたまりは 長方形に 描く こと）。 */
export const blocks = (
	cells: readonly Pos[],
): { x: number; y: number; w: number; h: number }[] => {
	const left = new Set(cells.map((c) => `${c.x},${c.y}`));
	const out: { x: number; y: number; w: number; h: number }[] = [];
	for (const c of cells) {
		if (!left.has(`${c.x},${c.y}`)) continue;
		const group: Pos[] = [];
		const todo = [c];
		left.delete(`${c.x},${c.y}`);
		while (todo.length) {
			const p = todo.pop() as Pos;
			group.push(p);
			for (const [dx, dy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1],
			]) {
				const k = `${p.x + dx},${p.y + dy}`;
				if (!left.has(k)) continue;
				left.delete(k);
				todo.push({ x: p.x + dx, y: p.y + dy });
			}
		}
		const xs = group.map((p) => p.x);
		const ys = group.map((p) => p.y);
		const x = Math.min(...xs);
		const y = Math.min(...ys);
		out.push({ x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 });
	}
	return out;
};

/**
 * 名所の 階・底の 集落・ボスの 大部屋を 手づくりの 地図（core/data/places.ts）から 作る。地図は はじめから 見える。
 * 敵・罠は 置かない（大部屋は B の 所に ボスだけ）。人・源泉・道具・階段・着く 所・持ち帰る 品は 地図の 字の 所
 * （形と 置き場所に 乱数は 使わない）。
 */
const buildPlaceFloor = (
	r: Run,
	depth: number,
	settle: SettlementSpec | undefined,
	rest: RestFloor | undefined,
	arena?: BossArena,
): Floor => {
	const spec = (settle ?? rest ?? arena) as
		| SettlementSpec
		| RestFloor
		| BossArena;
	const map = spec.map;
	const w = Math.max(...map.rows.map((row) => row.length));
	const h = map.rows.length;
	const layout: Layout = {
		w,
		h,
		tiles: new Uint8Array(w * h),
		roomOf: new Int16Array(w * h).fill(-1),
		rooms: [],
	};
	const at = (ch: string): Pos[] => {
		const out: Pos[] = [];
		map.rows.forEach((row, y) => {
			for (let x = 0; x < row.length; x++)
				if (row[x] === ch) out.push({ x, y });
		});
		return out;
	};
	// 床（壁と 外の ほかは ぜんぶ 1つの 部屋）
	let x0 = w;
	let y0 = h;
	let x1 = -1;
	let y1 = -1;
	map.rows.forEach((row, y) => {
		for (let x = 0; x < row.length; x++) {
			if (row[x] === "#" || row[x] === " ") continue;
			layout.tiles[idx(layout, x, y)] = T_ROOM;
			layout.roomOf[idx(layout, x, y)] = 0;
			x0 = Math.min(x0, x);
			y0 = Math.min(y0, y);
			x1 = Math.max(x1, x);
			y1 = Math.max(y1, y);
		}
	});
	layout.rooms.push({ id: 0, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
	const f: Floor = {
		depth,
		layout,
		stairs: at(">")[0],
		items: [],
		traps: [],
		monsters: [],
		seen: new Uint8Array(w * h),
		wards: [],
		house: -1,
		houseAwake: false,
		turns: 0,
		res: 0,
		resWarned: 0,
		senseMonsters: false,
		senseItems: false,
		sight: false,
		...(arena ? { arena: arena.name } : { rest: spec.name }),
		statues: [],
		props: [],
	};
	const start = at("@")[0];
	r.p.x = start.x;
	r.p.y = start.y;
	const block = (x: number, y: number) => {
		layout.tiles[idx(layout, x, y)] = T_WALL;
		(f.statues as number[]).push(idx(layout, x, y));
	};
	// 置物
	for (const [ch, prop] of Object.entries(map.legend)) {
		const cells = at(ch);
		if (!cells.length) continue;
		const groups = prop.big
			? blocks(cells)
			: cells.map((c) => ({ ...c, w: 1, h: 1 }));
		for (const g of groups)
			(f.props as FloorProp[]).push({
				...g,
				art: prop.art,
				...(prop.walk ? { walk: true as const } : {}),
			});
		if (!prop.walk) for (const c of cells) block(c.x, c.y);
	}
	// 立って いる 人（1〜9 の 所。通れない）
	f.folk = [];
	const folk = arena ? undefined : (spec as SettlementSpec | RestFloor).folk;
	folk?.forEach((who, n) => {
		const spot = at(String(n + 1))[0];
		// 主人公の 本人は 立たない（その 所は ただの 床）
		if (!spot || who.self === r.hero) return;
		block(spot.x, spot.y);
		(f.folk as FloorFolk[]).push({
			x: spot.x,
			y: spot.y,
			name: who.name,
			sprite: who.sprite,
			talks: who.talks,
			...(who.voice ? { voice: who.voice } : {}),
			...(who.key ? { key: true as const } : {}),
			said: 0,
		});
	});
	// 持ち帰る 品（fetch の 底。目的が event・deliver・bring の 底は 着くと もらう）
	if (settle && depth === r.dungeon.floors && !r.eventSpec && !r.bringSpec) {
		const spot = at("*")[0];
		f.items.push({ x: spot.x, y: spot.y, item: r.newItem(r.dungeon.goal) });
	}
	// 置きみやげ（帰り道は 置かない。のろわない）
	if (rest?.gifts && !r.s.returning) {
		const spots = at("g");
		rest.gifts.forEach((kind, n) => {
			const spot = spots[n];
			if (!spot) return;
			const item = r.newItem(kind);
			item.cursed = false;
			f.items.push({ x: spot.x, y: spot.y, item });
		});
	}
	// 源泉（S の かたまりが 1つの 池に 見える。どの マスに つかっても HP が もどる）と 湯だまり（o。見た目だけ）。
	// どちらも 通れる
	for (const spot of at("S"))
		f.traps.push({ x: spot.x, y: spot.y, kind: "spring", found: true });
	const pools = [...at("S"), ...at("o")].map((p) => idx(layout, p.x, p.y));
	if (pools.length) f.pools = pools;
	// 大部屋の ボス（B の 所。見られるまで 眠って 動かない：run.ts の checkBossSeen）と 先回りした 人の 差し入れ（g の 所）
	if (arena) {
		const prev = r.s.floor;
		r.s.floor = f;
		const spot = at("B")[0];
		const m =
			spot &&
			spawnMonster(r, (r.bossSpec as BossSpec).monster, spot, {
				sleep: DEEP,
				single: true,
			});
		if (m) f.boss = m.uid;
		r.s.floor = prev;
		const spots = at("g");
		r.bossSpec?.supply?.items.forEach((kind, n) => {
			const g = spots[n];
			if (g) f.items.push({ x: g.x, y: g.y, item: r.newItem(kind) });
		});
	}
	revealAll(f);
	return f;
};

/** 地図を ぜんぶ 見える ように する（名所の 階）。 */
const revealAll = (f: Floor): void => {
	const l = f.layout;
	for (let y = 0; y < l.h; y++)
		for (let x = 0; x < l.w; x++) {
			if (l.tiles[y * l.w + x] === 0) continue;
			for (let dy = -1; dy <= 1; dy++)
				for (let dx = -1; dx <= 1; dx++) {
					const nx = x + dx;
					const ny = y + dy;
					if (nx >= 0 && ny >= 0 && nx < l.w && ny < l.h)
						f.seen[ny * l.w + nx] = 1;
				}
		}
};

/** 書きかえた 冒険を 追う 敵（ポケダンの カクレオン。data/monsters.ts）。 */
export const HUNTER = "sakujonin";

/**
 * 書きかえた 中断セーブを 続けた とき：いまの 階に 削除人が いなければ、キリコから 見えない 所に 出す
 * （次の 階からは buildFloor が 出す）。乱数を 引くので、呼んだら RunState.rng を 入れなおす。
 */
export const callHunter = (r: Run): boolean => {
	if (!r.s.cheat || r.f.monsters.some((m) => m.kind === HUNTER)) return false;
	const at = randomFloorPos(r, true);
	return !!at && !!spawnMonster(r, HUNTER, at, { awake: true, single: true });
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

/** foes で 足す 敵が その 階の 強さから 離れて よい 階数。これより 強い／弱い 敵は 出さない。 */
export const FOE_GAP = 3;

/**
 * その 階で 湧く 敵の 顔ぶれ。本編の 何階ぶんか（表は もっと の 30階まで。それより 深い 階は 30階の 顔ぶれ）で 引き、
 * 板ごとの 出やすさ（data/dungeons.ts の foes。0 は 出ない）を かける。foes で 多めに した 敵が その 板の
 * 強さの 範囲では どの 階でも 出ない ときは、その 階の 強さから FOE_GAP 以内の 階だけ 出す（お祭りの VIPPER など。
 * 本筋の 板の foes は 強さの 範囲の 敵だけ：src/sim/monsterTests.ts）。外から 足す 敵は うしろに 並べる
 * （足さない 板の 乱数の 順は かわらない）。
 */
export const foeTable = (r: Run): MonsterDef[] => {
	const foes = r.dungeon.foes ?? {};
	const level = Math.max(1, Math.min(30, r.levelAt(r.f.depth)));
	const here = monstersFor(level, r.s.dungeon);
	// 板の どの 階の 強さでも 出ない 敵だけ 足す（強さの 範囲で 出る 敵は ふつうに その 階から：本筋の 板は かわらない）
	const lv = r.dungeon.level.slice(1).map((l) => Math.max(1, Math.min(30, l)));
	const lo = Math.min(...lv);
	const hi = Math.max(...lv);
	const extra = Object.entries(foes)
		.filter(([id, w]) => w > 0 && !here.some((m) => m.id === id))
		.map(([id]) => MONSTERS[id])
		.filter(
			(m): m is MonsterDef =>
				!!m &&
				!m.boss &&
				!m.hunter &&
				onBoard(m, r.s.dungeon) &&
				(m.floors[1] < lo || m.floors[0] > hi) &&
				m.floors[0] - FOE_GAP <= level &&
				level <= m.floors[1] + FOE_GAP,
		);
	return [...here, ...extra].filter((m) => (foes[m.id] ?? 1) > 0);
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
		const foes = r.dungeon.foes ?? {};
		const list = foeTable(r);
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
		// パン兵は はじめから パンを 1つ 持っている（取りかえる 前に 倒すと 落とす）
		if (def.abilities.some((a) => a.k === "swap")) {
			m.carry = r.newItem(rng.pick(SWAP_BREADS));
			m.carry.known = true;
		}
		if (def.abilities.some((a) => a.k === "mimic") && !opts.awake) {
			m.disguise = rng.weighted(itemTableOf(r.s), (e) => e.weight).kind;
			m.status.sleep = 0;
		}
		f.monsters.push(m);
		return m;
	};
	const first = make(at);
	// 群れ（VIPPER）は 4体で出る
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
