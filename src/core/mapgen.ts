// 階の形を作る（トルネコ1・ローグと同じ「3×3 の区画に部屋か通路の交差点」）。
//
// - 区画ごとに部屋（明るい長方形）か、通路の交差点（1マス）を置く。
// - となりあう区画を、全体がつながる木 ＋ いくつかの輪 で結ぶ。
// - 通路は部屋の壁の外側1マス（入口）から出て、区画のあいだで曲がって相手の入口へ。
// 通路が部屋を突っ切らないよう、曲がる位置は2つの部屋のあいだに取る。

import type { Rng } from "./rng";

export const T_WALL = 0;
export const T_ROOM = 1;
export const T_CORR = 2;

export type Room = {
	id: number;
	/** 床の左上と大きさ（壁は含まない）。 */
	x: number;
	y: number;
	w: number;
	h: number;
};

export type Layout = {
	w: number;
	h: number;
	/** T_WALL / T_ROOM / T_CORR */
	tiles: Uint8Array;
	/** 部屋の床なら部屋の id、それ以外は -1。 */
	roomOf: Int16Array;
	rooms: Room[];
};

export const MAP_W = 54;
export const MAP_H = 33;
const COLS = 3;
const ROWS = 3;

type Cell = {
	col: number;
	row: number;
	/** 部屋なら Room、交差点なら null。 */
	room: Room | null;
	/** 交差点の位置。 */
	jx: number;
	jy: number;
};

export const idx = (l: { w: number }, x: number, y: number): number =>
	y * l.w + x;

export const inBounds = (l: Layout, x: number, y: number): boolean =>
	x >= 0 && y >= 0 && x < l.w && y < l.h;

export const tileAt = (l: Layout, x: number, y: number): number =>
	inBounds(l, x, y) ? l.tiles[idx(l, x, y)] : T_WALL;

export const isFloor = (l: Layout, x: number, y: number): boolean =>
	tileAt(l, x, y) !== T_WALL;

export const roomAt = (l: Layout, x: number, y: number): number =>
	inBounds(l, x, y) ? l.roomOf[idx(l, x, y)] : -1;

const emptyLayout = (w: number, h: number): Layout => ({
	w,
	h,
	tiles: new Uint8Array(w * h),
	roomOf: new Int16Array(w * h).fill(-1),
	rooms: [],
});

const carveRoom = (l: Layout, r: Room): void => {
	for (let y = r.y; y < r.y + r.h; y++)
		for (let x = r.x; x < r.x + r.w; x++) {
			l.tiles[idx(l, x, y)] = T_ROOM;
			l.roomOf[idx(l, x, y)] = r.id;
		}
};

const carveCorr = (l: Layout, x: number, y: number): void => {
	if (!inBounds(l, x, y)) return;
	const i = idx(l, x, y);
	if (l.tiles[i] === T_WALL) l.tiles[i] = T_CORR;
};

const carveLine = (
	l: Layout,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
): void => {
	const dx = Math.sign(x1 - x0);
	const dy = Math.sign(y1 - y0);
	let x = x0;
	let y = y0;
	carveCorr(l, x, y);
	while (x !== x1 || y !== y1) {
		if (x !== x1) x += dx;
		else y += dy;
		carveCorr(l, x, y);
	}
};

/**
 * ふつうの階を作る。部屋は最低 minRooms 個。
 */
export const generateLayout = (
	rng: Rng,
	opts: { minRooms?: number; junctions?: number } = {},
): Layout => {
	const W = MAP_W;
	const H = MAP_H;
	const l = emptyLayout(W, H);
	// 外周1マスは必ず壁
	const cw = Math.floor((W - 2) / COLS);
	const ch = Math.floor((H - 2) / ROWS);
	const cells: Cell[] = [];
	const total = COLS * ROWS;
	// 交差点にする区画（部屋が少なくなりすぎない範囲で）
	const minRooms = opts.minRooms ?? 5;
	const junctionCount = Math.min(
		total - minRooms,
		opts.junctions ?? rng.range(0, 3),
	);
	const junctionSet = new Set(
		rng.shuffle([...Array(total).keys()]).slice(0, junctionCount),
	);
	for (let row = 0; row < ROWS; row++) {
		for (let col = 0; col < COLS; col++) {
			const i = row * COLS + col;
			const ox = 1 + col * cw;
			const oy = 1 + row * ch;
			if (junctionSet.has(i)) {
				cells.push({
					col,
					row,
					room: null,
					jx: ox + rng.range(2, cw - 3),
					jy: oy + rng.range(2, ch - 3),
				});
				continue;
			}
			// 部屋：区画の中に、まわり1マス以上の余白（通路が回れる）を残す
			const maxW = cw - 3;
			const maxH = ch - 3;
			const w = rng.range(Math.min(4, maxW), maxW);
			const h = rng.range(Math.min(3, maxH), maxH);
			const x = ox + 1 + rng.int(cw - 2 - w);
			const y = oy + 1 + rng.int(ch - 2 - h);
			const room: Room = { id: l.rooms.length, x, y, w, h };
			l.rooms.push(room);
			carveRoom(l, room);
			cells.push({ col, row, room, jx: 0, jy: 0 });
		}
	}

	// となりあう区画の辺（右・下）
	type Edge = { a: number; b: number; horiz: boolean };
	const edges: Edge[] = [];
	for (let row = 0; row < ROWS; row++)
		for (let col = 0; col < COLS; col++) {
			const i = row * COLS + col;
			if (col + 1 < COLS) edges.push({ a: i, b: i + 1, horiz: true });
			if (row + 1 < ROWS) edges.push({ a: i, b: i + COLS, horiz: false });
		}
	rng.shuffle(edges);
	// 木（Kruskal）＋ 残りの辺をいくつか足して輪を作る
	const parent = [...Array(total).keys()];
	const find = (x: number): number => {
		while (parent[x] !== x) {
			parent[x] = parent[parent[x]];
			x = parent[x];
		}
		return x;
	};
	const chosen: Edge[] = [];
	const rest: Edge[] = [];
	for (const e of edges) {
		const ra = find(e.a);
		const rb = find(e.b);
		if (ra !== rb) {
			parent[ra] = rb;
			chosen.push(e);
		} else rest.push(e);
	}
	for (const e of rest) if (rng.chance(0.3)) chosen.push(e);

	for (const e of chosen) connect(l, rng, cells[e.a], cells[e.b], e.horiz);

	// 行き止まりの交差点（つながりが1本だけ）はそのまま残す（トルネコにもある）
	return l;
};

/** lo〜hi のうち、できれば両端を除いた位置。 */
const midpoint = (rng: Rng, lo: number, hi: number): number =>
	hi - lo >= 2 ? lo + 1 + rng.int(hi - lo - 1) : lo;

/** 区画 a（左/上）と b（右/下）を通路で結ぶ。 */
const connect = (
	l: Layout,
	rng: Rng,
	a: Cell,
	b: Cell,
	horiz: boolean,
): void => {
	if (horiz) {
		// a の右の入口 → b の左の入口
		const ax = a.room ? a.room.x + a.room.w : a.jx;
		const ay = a.room ? a.room.y + rng.int(a.room.h) : a.jy;
		const bx = b.room ? b.room.x - 1 : b.jx;
		const by = b.room ? b.room.y + rng.int(b.room.h) : b.jy;
		const lo = Math.min(ax, bx);
		const hi = Math.max(ax, bx);
		// 部屋の壁ぞいを這わないよう、なるべく両端を避けて曲がる
		const mx = midpoint(rng, lo, hi);
		carveLine(l, ax, ay, mx, ay);
		carveLine(l, mx, ay, mx, by);
		carveLine(l, mx, by, bx, by);
	} else {
		const ax = a.room ? a.room.x + rng.int(a.room.w) : a.jx;
		const ay = a.room ? a.room.y + a.room.h : a.jy;
		const bx = b.room ? b.room.x + rng.int(b.room.w) : b.jx;
		const by = b.room ? b.room.y - 1 : b.jy;
		const lo = Math.min(ay, by);
		const hi = Math.max(ay, by);
		const my = midpoint(rng, lo, hi);
		carveLine(l, ax, ay, ax, my);
		carveLine(l, ax, my, bx, my);
		carveLine(l, bx, my, bx, by);
	}
};

/** 大部屋（ひとつの大きな部屋）。巻物で今の階を作り替えるときにも使う。 */
export const bigRoomLayout = (): Layout => {
	const l = emptyLayout(MAP_W, MAP_H);
	const room: Room = { id: 0, x: 2, y: 2, w: MAP_W - 4, h: MAP_H - 4 };
	l.rooms.push(room);
	carveRoom(l, room);
	return l;
};

/** 部屋の中の床マスをすべて。 */
export const roomTiles = (r: Room): { x: number; y: number }[] => {
	const out: { x: number; y: number }[] = [];
	for (let y = r.y; y < r.y + r.h; y++)
		for (let x = r.x; x < r.x + r.w; x++) out.push({ x, y });
	return out;
};

/** 部屋の入口（部屋に接する通路マス）。 */
export const roomExits = (l: Layout, r: Room): { x: number; y: number }[] => {
	const out: { x: number; y: number }[] = [];
	for (let x = r.x; x < r.x + r.w; x++) {
		if (tileAt(l, x, r.y - 1) === T_CORR) out.push({ x, y: r.y - 1 });
		if (tileAt(l, x, r.y + r.h) === T_CORR) out.push({ x, y: r.y + r.h });
	}
	for (let y = r.y; y < r.y + r.h; y++) {
		if (tileAt(l, r.x - 1, y) === T_CORR) out.push({ x: r.x - 1, y });
		if (tileAt(l, r.x + r.w, y) === T_CORR) out.push({ x: r.x + r.w, y });
	}
	return out;
};
