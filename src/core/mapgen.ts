// 階の形を作る（ローグ系の「区画に部屋か通路の交差点」）。
//
// - 地図を 区画（cols×rows）に 切り、区画ごとに部屋（明るい長方形）か、通路の交差点（1マス）を置く。
// - いくつかの 区画を つなげて 1つの 長い 部屋に する ことも ある（横長の 中部屋・縦長の 中部屋）。
// - となりあう区画を、全体がつながる木 ＋ いくつかの輪 で結ぶ。
// - 通路は部屋の壁の外側1マス（入口）から出て、区画のあいだで曲がって相手の入口へ。
// 通路が部屋を突っ切らないよう、曲がる位置は2つの部屋のあいだに取る。
//
// 形の 種類（LayoutKind）は 板と 階で ちがう（core/data/dungeons.ts の layouts。core/floor.ts が 引く）：
// - grid：3×3 の 区画（ローグ・トルネコ1と 同じ。既定）
// - hall：まん中の 行を ぶち抜いた 横長の 中部屋。上下に ふつうの 部屋（ポケダンに よく ある 形）
// - vhall：まん中の 列を ぶち抜いた 縦長の 中部屋（塔の 吹き抜け）
// - dense：4×3 の 小さな 部屋が たくさん（雑居ビル・鉄塔の 格子）
// - isles：3×2 の 広い 区画に 小さな 部屋が ぽつぽつ。通路が 長い（島）
// - ring：まん中の 区画が 壁で、まわりを ぐるりと 回る（菌輪）
// - maze：交差点が 多く 部屋は 小さい。輪も 多い（通路だらけ）
// - twin：上と 下の 行を ぶち抜いた 横長の 部屋が 2本。あいだに 小さな 部屋（露店の 2列）
// - ladder：左と 右の 列を ぶち抜いた 縦長の 部屋が 2本。あいだに 小さな 部屋（はしご）
// - elbow：横長と 縦長を L字に（角は 4つの うち どれか）
// - plaza：4×3 の まん中 2区画を 合わせた 広場（大部屋）。まわりに 小部屋
// - band：3×3 から 向かいあう 角を 2つ 抜いた、斜めに 走る 帯
// - broad：3×2 の 広い 区画に 大きめの 部屋（広間が 2段）

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

export type LayoutKind =
	| "grid"
	| "hall"
	| "vhall"
	| "dense"
	| "isles"
	| "ring"
	| "maze"
	| "twin"
	| "ladder"
	| "elbow"
	| "plaza"
	| "band"
	| "broad";

export const LAYOUT_KINDS: readonly LayoutKind[] = [
	"grid",
	"hall",
	"vhall",
	"dense",
	"isles",
	"ring",
	"maze",
	"twin",
	"ladder",
	"elbow",
	"plaza",
	"band",
	"broad",
];

/**
 * 板ごとの 形の 出かた：depth が from〜to（無ければ 全部）の 階で、shapes の 重みで 引く。
 * 最初に 合う 行を 使う。合う 行が 無ければ grid。
 */
export type LayoutRule = {
	from?: number;
	to?: number;
	shapes: Readonly<Partial<Record<LayoutKind, number>>>;
};

/** その 階の 形を 引く（乱数は 合う 行が ある ときだけ 1回）。 */
export const pickLayoutKind = (
	rng: Rng,
	rules: readonly LayoutRule[] | undefined,
	depth: number,
): LayoutKind => {
	const rule = rules?.find(
		(r) => depth >= (r.from ?? 1) && depth <= (r.to ?? Number.MAX_VALUE),
	);
	if (!rule) return "grid";
	const kinds = LAYOUT_KINDS.filter((k) => (rule.shapes[k] ?? 0) > 0);
	if (!kinds.length) return "grid";
	return rng.weighted(kinds, (k) => rule.shapes[k] ?? 0);
};

/** 区画（grid の マス目で 左上〜右下。長い 部屋は いくつかの マス目を またぐ）。 */
type Slot = {
	c0: number;
	r0: number;
	c1: number;
	r1: number;
	/** 長い 部屋：この 向きに 区画の ほとんどを 使う（xy は 両方：広場）。 */
	long?: "x" | "y" | "xy";
};

type Cell = {
	slot: Slot;
	/** 部屋なら Room、交差点なら null。 */
	room: Room | null;
	/** 交差点の位置。 */
	jx: number;
	jy: number;
};

/** 形の 作りかた。 */
type Spec = {
	cols: number;
	rows: number;
	slots: Slot[];
	/** 交差点に する 区画の 数（1×1 の 区画だけ。部屋が minRooms を 切らない 範囲で）。 */
	junctions: readonly [number, number];
	minRooms: number;
	/** 木に 足して 輪を 作る 辺の 率。 */
	loops: number;
	/** ふつうの 部屋の 大きさの 上限（区画に 収まる 範囲で）。 */
	roomMax: { w: number; h: number };
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

/** 大部屋と みなす 床の 大きさ（ふつうの 部屋は いちばん 広くて 15x8）。 */
export const BIG_ROOM = { w: 12, h: 7 } as const;

/**
 * その マスが 敵の いない 大部屋の 中か。部屋の 中の 敵は 見えて いなくても 数える
 * （入った とたんに 寝ていた 敵が 見えて 「だれもおらん」が うそに ならないように）。
 */
export const inEmptyBigRoom = (
	l: Layout,
	at: { x: number; y: number },
	monsters: readonly { hp: number; x: number; y: number }[],
): boolean => {
	const id = roomAt(l, at.x, at.y);
	if (id < 0) return false;
	const r = l.rooms.find((x) => x.id === id);
	if (!r || r.w < BIG_ROOM.w || r.h < BIG_ROOM.h) return false;
	return !monsters.some((m) => m.hp > 0 && roomAt(l, m.x, m.y) === id);
};

/** 前の マスから この マスへ 動いて、敵の いない 大部屋に 入ったか。 */
export const enteredEmptyBigRoom = (
	l: Layout,
	from: { x: number; y: number },
	to: { x: number; y: number },
	monsters: readonly { hp: number; x: number; y: number }[],
): boolean =>
	roomAt(l, to.x, to.y) !== roomAt(l, from.x, from.y) &&
	inEmptyBigRoom(l, to, monsters);

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

/** 通路が 2×2 以上の かたまりに なっている所が あるか（道が 並んで 太くなり、出口が わかりにくい）。 */
const hasWideCorridor = (l: Layout): boolean => {
	for (let y = 0; y < l.h - 1; y++)
		for (let x = 0; x < l.w - 1; x++)
			if (
				tileAt(l, x, y) === T_CORR &&
				tileAt(l, x + 1, y) === T_CORR &&
				tileAt(l, x, y + 1) === T_CORR &&
				tileAt(l, x + 1, y + 1) === T_CORR
			)
				return true;
	return false;
};

/** cols×rows の 1×1 の 区画（skip の 区画は 抜く）。 */
const gridSlots = (
	cols: number,
	rows: number,
	skip: (c: number, r: number) => boolean = () => false,
): Slot[] => {
	const out: Slot[] = [];
	for (let r = 0; r < rows; r++)
		for (let c = 0; c < cols; c++)
			if (!skip(c, r)) out.push({ c0: c, r0: r, c1: c, r1: r });
	return out;
};

/** 形の 種類 → 作りかた（hall・vhall は ぶち抜く 行・列を 引く：まん中が 多め）。 */
const specOf = (rng: Rng, kind: LayoutKind): Spec => {
	const normal = { w: 14, h: 7 };
	switch (kind) {
		case "hall": {
			const row = rng.pick([0, 1, 1, 2]);
			return {
				cols: 3,
				rows: 3,
				slots: [
					...gridSlots(3, 3, (_, r) => r === row),
					{ c0: 0, r0: row, c1: 2, r1: row, long: "x" },
				],
				junctions: [0, 2],
				minRooms: 4,
				loops: 0.3,
				roomMax: normal,
			};
		}
		case "vhall": {
			const col = rng.pick([0, 1, 1, 2]);
			return {
				cols: 3,
				rows: 3,
				slots: [
					...gridSlots(3, 3, (c) => c === col),
					{ c0: col, r0: 0, c1: col, r1: 2, long: "y" },
				],
				junctions: [0, 2],
				minRooms: 4,
				loops: 0.3,
				roomMax: normal,
			};
		}
		case "dense":
			return {
				cols: 4,
				rows: 3,
				slots: gridSlots(4, 3),
				junctions: [1, 4],
				minRooms: 8,
				loops: 0.35,
				roomMax: { w: 10, h: 7 },
			};
		case "isles":
			return {
				cols: 3,
				rows: 2,
				slots: gridSlots(3, 2),
				junctions: [1, 2],
				minRooms: 4,
				loops: 0.2,
				roomMax: { w: 8, h: 6 },
			};
		case "ring":
			return {
				cols: 3,
				rows: 3,
				slots: gridSlots(3, 3, (c, r) => c === 1 && r === 1),
				junctions: [0, 2],
				minRooms: 5,
				loops: 0.5,
				roomMax: normal,
			};
		case "maze":
			return {
				cols: 3,
				rows: 3,
				slots: gridSlots(3, 3),
				junctions: [3, 4],
				minRooms: 4,
				loops: 0.6,
				roomMax: { w: 9, h: 5 },
			};
		case "twin":
			return {
				cols: 3,
				rows: 3,
				slots: [
					...gridSlots(3, 3, (_, r) => r !== 1),
					{ c0: 0, r0: 0, c1: 2, r1: 0, long: "x" },
					{ c0: 0, r0: 2, c1: 2, r1: 2, long: "x" },
				],
				junctions: [0, 2],
				minRooms: 3,
				loops: 0.4,
				roomMax: { w: 10, h: 7 },
			};
		case "ladder":
			return {
				cols: 3,
				rows: 3,
				slots: [
					...gridSlots(3, 3, (c) => c !== 1),
					{ c0: 0, r0: 0, c1: 0, r1: 2, long: "y" },
					{ c0: 2, r0: 0, c1: 2, r1: 2, long: "y" },
				],
				junctions: [0, 2],
				minRooms: 3,
				loops: 0.4,
				roomMax: { w: 10, h: 7 },
			};
		case "elbow": {
			// 縦長は 左か 右の 列、横長は 上か 下の 行（残りの 2列ぶん）
			const col = rng.pick([0, 2]);
			const row = rng.pick([0, 2]);
			const c0 = col === 0 ? 1 : 0;
			return {
				cols: 3,
				rows: 3,
				slots: [
					...gridSlots(3, 3, (c, r) => c === col || r === row),
					{ c0: col, r0: 0, c1: col, r1: 2, long: "y" },
					{ c0, r0: row, c1: c0 + 1, r1: row, long: "x" },
				],
				junctions: [0, 1],
				minRooms: 4,
				loops: 0.3,
				roomMax: normal,
			};
		}
		case "plaza":
			return {
				cols: 4,
				rows: 3,
				slots: [
					...gridSlots(4, 3, (c, r) => r === 1 && (c === 1 || c === 2)),
					{ c0: 1, r0: 1, c1: 2, r1: 1, long: "xy" },
				],
				junctions: [1, 3],
				minRooms: 6,
				loops: 0.35,
				roomMax: { w: 10, h: 7 },
			};
		case "band": {
			// 右上と 左下か、左上と 右下を 抜く
			const flip = rng.chance(0.5);
			return {
				cols: 3,
				rows: 3,
				slots: gridSlots(3, 3, (c, r) =>
					flip
						? (c === 0 && r === 0) || (c === 2 && r === 2)
						: (c === 2 && r === 0) || (c === 0 && r === 2),
				),
				junctions: [0, 2],
				minRooms: 4,
				loops: 0.3,
				roomMax: normal,
			};
		}
		case "broad":
			return {
				cols: 3,
				rows: 2,
				slots: gridSlots(3, 2),
				junctions: [0, 1],
				minRooms: 4,
				loops: 0.3,
				roomMax: { w: 12, h: 9 },
			};
		default:
			return {
				cols: 3,
				rows: 3,
				slots: gridSlots(3, 3),
				junctions: [0, 3],
				minRooms: 5,
				loops: 0.3,
				roomMax: normal,
			};
	}
};

/**
 * ふつうの階を作る（kind は 形の 種類。既定は grid）。
 * 通路が 並んで 太い かたまりに なった 形は 作りなおす。
 */
export const generateLayout = (rng: Rng, kind: LayoutKind = "grid"): Layout => {
	let l = generateOnce(rng, kind);
	for (let i = 0; i < 50 && hasWideCorridor(l); i++)
		l = generateOnce(rng, kind);
	return l;
};

const generateOnce = (rng: Rng, kind: LayoutKind): Layout => {
	const W = MAP_W;
	const H = MAP_H;
	const l = emptyLayout(W, H);
	const spec = specOf(rng, kind);
	// 外周1マスは必ず壁
	const cw = Math.floor((W - 2) / spec.cols);
	const ch = Math.floor((H - 2) / spec.rows);
	const slots = spec.slots;
	// 交差点にする区画（1×1 だけ。部屋が少なくなりすぎない範囲で）
	const singles = slots.map((_, i) => i).filter((i) => !slots[i].long);
	const junctionCount = Math.min(
		slots.length - spec.minRooms,
		singles.length,
		rng.range(spec.junctions[0], spec.junctions[1]),
	);
	const junctionSet = new Set(
		rng.shuffle([...singles]).slice(0, Math.max(0, junctionCount)),
	);
	const cells: Cell[] = slots.map((slot, i) => {
		const ox = 1 + slot.c0 * cw;
		const oy = 1 + slot.r0 * ch;
		const sw = (slot.c1 - slot.c0 + 1) * cw;
		const sh = (slot.r1 - slot.r0 + 1) * ch;
		if (junctionSet.has(i))
			return {
				slot,
				room: null,
				jx: ox + rng.range(2, sw - 3),
				jy: oy + rng.range(2, sh - 3),
			};
		// 部屋：区画の中に、まわり1マス以上の余白（通路が回れる）を残す
		const maxW = sw - 3;
		const maxH = sh - 3;
		let w: number;
		let h: number;
		if (slot.long === "x") {
			// 横長：区画の 幅の 3/4 以上（どの 列にも かかる）。高さは 大部屋（BIG_ROOM）に ならない 6 まで
			w = rng.range(Math.ceil(sw * 0.75), maxW);
			h = rng.range(3, Math.min(6, maxH));
		} else if (slot.long === "y") {
			h = rng.range(Math.ceil(sh * 0.75), maxH);
			w = rng.range(4, Math.min(9, maxW));
		} else if (slot.long === "xy") {
			// 広場：どちらにも 区画の 6割 以上（大部屋に なる）
			w = rng.range(Math.ceil(sw * 0.6), maxW);
			h = rng.range(Math.min(maxH, Math.max(3, Math.ceil(sh * 0.6))), maxH);
		} else {
			const capW = Math.min(spec.roomMax.w, maxW);
			const capH = Math.min(spec.roomMax.h, maxH);
			w = rng.range(Math.min(4, capW), capW);
			h = rng.range(Math.min(3, capH), capH);
		}
		const x = ox + 1 + rng.int(sw - 2 - w);
		const y = oy + 1 + rng.int(sh - 2 - h);
		const room: Room = { id: l.rooms.length, x, y, w, h };
		l.rooms.push(room);
		carveRoom(l, room);
		return { slot, room, jx: 0, jy: 0 };
	});

	// となりあう区画の辺（a が 左/上、b が 右/下。span は 接している 行/列の 範囲）
	type Edge = { a: number; b: number; horiz: boolean; span: [number, number] };
	const edges: Edge[] = [];
	for (let i = 0; i < slots.length; i++)
		for (let j = 0; j < slots.length; j++) {
			if (i === j) continue;
			const s = slots[i];
			const t = slots[j];
			if (s.c1 + 1 === t.c0 && s.r0 <= t.r1 && t.r0 <= s.r1)
				edges.push({
					a: i,
					b: j,
					horiz: true,
					span: [Math.max(s.r0, t.r0), Math.min(s.r1, t.r1)],
				});
			if (s.r1 + 1 === t.r0 && s.c0 <= t.c1 && t.c0 <= s.c1)
				edges.push({
					a: i,
					b: j,
					horiz: false,
					span: [Math.max(s.c0, t.c0), Math.min(s.c1, t.c1)],
				});
		}
	rng.shuffle(edges);
	// 木（Kruskal）＋ 残りの辺をいくつか足して輪を作る
	const parent = [...Array(slots.length).keys()];
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
	for (const e of rest) if (rng.chance(spec.loops)) chosen.push(e);

	for (const e of chosen) {
		// 接している 行/列の 画素の 範囲（長い 部屋は この 範囲の 中で 入口を 取る）
		const [lo, hi] = e.horiz
			? [1 + e.span[0] * ch, 1 + (e.span[1] + 1) * ch - 1]
			: [1 + e.span[0] * cw, 1 + (e.span[1] + 1) * cw - 1];
		connect(l, rng, cells[e.a], cells[e.b], e.horiz, [lo, hi]);
	}

	// 行き止まりの交差点（つながりが1本だけ）はそのまま残す（トルネコにもある）
	return l;
};

/** lo〜hi のうち、できれば両端を除いた位置。 */
const midpoint = (rng: Rng, lo: number, hi: number): number =>
	hi - lo >= 2 ? lo + 1 + rng.int(hi - lo - 1) : lo;

/** from〜to（部屋の 幅）の うち、できれば lo〜hi（接している 区画）の 中から 1つ。外れていれば 近い 端。 */
const pickIn = (
	rng: Rng,
	from: number,
	to: number,
	lo: number,
	hi: number,
): number => {
	const a = Math.max(from, lo);
	const b = Math.min(to, hi);
	if (a <= b) return rng.range(a, b);
	return to < lo ? to : from;
};

/**
 * 区画 a（左/上）と b（右/下）を通路で結ぶ。span は 接している 行（horiz）か 列の 画素の 範囲
 * （無ければ 部屋の どこからでも）。
 */
const connect = (
	l: Layout,
	rng: Rng,
	a: Cell,
	b: Cell,
	horiz: boolean,
	span: [number, number] = [0, Number.MAX_SAFE_INTEGER],
): void => {
	const [lo, hi] = span;
	if (horiz) {
		// a の右の入口 → b の左の入口
		const ax = a.room ? a.room.x + a.room.w : a.jx;
		const ay = a.room
			? pickIn(rng, a.room.y, a.room.y + a.room.h - 1, lo, hi)
			: a.jy;
		const bx = b.room ? b.room.x - 1 : b.jx;
		const by = b.room
			? pickIn(rng, b.room.y, b.room.y + b.room.h - 1, lo, hi)
			: b.jy;
		const xlo = Math.min(ax, bx);
		const xhi = Math.max(ax, bx);
		// 部屋の壁ぞいを這わないよう、なるべく両端を避けて曲がる
		const mx = midpoint(rng, xlo, xhi);
		carveLine(l, ax, ay, mx, ay);
		carveLine(l, mx, ay, mx, by);
		carveLine(l, mx, by, bx, by);
	} else {
		const ax = a.room
			? pickIn(rng, a.room.x, a.room.x + a.room.w - 1, lo, hi)
			: a.jx;
		const ay = a.room ? a.room.y + a.room.h : a.jy;
		const bx = b.room
			? pickIn(rng, b.room.x, b.room.x + b.room.w - 1, lo, hi)
			: b.jx;
		const by = b.room ? b.room.y - 1 : b.jy;
		const ylo = Math.min(ay, by);
		const yhi = Math.max(ay, by);
		const my = midpoint(rng, ylo, yhi);
		carveLine(l, ax, ay, ax, my);
		carveLine(l, ax, my, bx, my);
		carveLine(l, bx, my, bx, by);
	}
};

/** 大部屋（ひとつの大きな部屋）。祭りの階の 大部屋と、試験で使う。 */
export const bigRoomLayout = (): Layout => {
	const l = emptyLayout(MAP_W, MAP_H);
	const room: Room = { id: 0, x: 2, y: 2, w: MAP_W - 4, h: MAP_H - 4 };
	l.rooms.push(room);
	carveRoom(l, room);
	return l;
};

/** 祭りの階の 特別な形（トルネコ1）。 */
export type HouseShape = "big" | "split2" | "split4";

/**
 * 祭りの階の 特別な形。big は 大部屋、split2 は 大部屋を 縦に 割って 1本の 通路で つないだ 二分割、
 * split4 は さらに 横にも 割って 1本の 通路で ぐるりと 回る 四分割（トルネコ1と 同じ）。
 */
export const houseShapeLayout = (rng: Rng, shape: HouseShape): Layout => {
	if (shape === "big") return bigRoomLayout();
	const l = emptyLayout(MAP_W, MAP_H);
	// 部屋の あいだは 壁 5マス（通路が 中で 曲がれる）
	const GAP = 5;
	const x0 = 2;
	const x1 = MAP_W - 3;
	const y0 = 2;
	const y1 = MAP_H - 3;
	const lw = Math.floor((x1 - x0 + 1 - GAP) / 2);
	const xs: [number, number][] = [
		[x0, lw],
		[x0 + lw + GAP, x1 - (x0 + lw + GAP) + 1],
	];
	const th = Math.floor((y1 - y0 + 1 - GAP) / 2);
	const ys: [number, number][] =
		shape === "split2"
			? [[y0, y1 - y0 + 1]]
			: [
					[y0, th],
					[y0 + th + GAP, y1 - (y0 + th + GAP) + 1],
				];
	const cells: Cell[][] = ys.map(([y, h], row) =>
		xs.map(([x, w], col) => {
			const room: Room = { id: l.rooms.length, x, y, w, h };
			l.rooms.push(room);
			carveRoom(l, room);
			return {
				slot: { c0: col, r0: row, c1: col, r1: row },
				room,
				jx: 0,
				jy: 0,
			};
		}),
	);
	if (shape === "split2") connect(l, rng, cells[0][0], cells[0][1], true);
	else {
		// 輪（左上 → 右上 → 右下 → 左下 → 左上）
		connect(l, rng, cells[0][0], cells[0][1], true);
		connect(l, rng, cells[1][0], cells[1][1], true);
		connect(l, rng, cells[0][0], cells[1][0], false);
		connect(l, rng, cells[0][1], cells[1][1], false);
	}
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
