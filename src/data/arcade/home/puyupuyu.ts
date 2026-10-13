// キリコの 家の ゲーム「ぷゆぷゆ」（puyupuyu）の 決まり。板は ui/arcade/home/puyupuyu.ts、文は data/arcade/text.ts。
// - ぷゆゆが 2つ 組で 上から 降ってくる（軸と 子）。←→ で 動かし、回して 置く。
// - 同じ 色が たて・よこに 4つ 以上 つながると 消える。消えた あとに 上の ぷゆゆが 降って、また そろうと 連鎖。
// - 左から 3列目の いちばん 上が うまると おわり。
// - スコア＝消した 数 × 10 × 連鎖の 倍率（連鎖が 続くほど 大きい。いちどに 2色 以上 消すと 少し 足す）。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import { AH, ATOP, AW, type Rnd } from "../logic";

export const PY = {
	/** 1マスの 大きさ（画素）。 */
	cell: 11,
	cols: 6,
	rows: 12,
	/** 色の 数（1〜4）。 */
	colors: 4,
	/** 出る 列（左から 3列目）。 */
	spawnX: 2,
	/** 1マス 降る 秒（はじめ・30秒 ごとに 縮む 分・いちばん 速い とき・↓ を 押した とき）。 */
	fall: 0.7,
	fallStep: 0.08,
	fastest: 0.18,
	soft: 0.035,
	/** 消える ときの 見せる 秒。 */
	popTime: 0.4,
	/** 連鎖 ごとの 倍率（1連鎖目 から）。 */
	chainPower: [1, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320],
	/** いちどに 消した 色の 数 → 足す 倍率。 */
	colorBonus: [0, 0, 3, 6, 12],
} as const;

/** 板の 字。 */
export const PY_TEXT = {
	next: "NEXT",
	chain: "{n}連鎖！",
	best: "最大",
} as const;

/** 子の 向き（0 上・1 右・2 下・3 左）→ 軸からの ずれ。 */
const DIRS: readonly (readonly [number, number])[] = [
	[0, -1],
	[1, 0],
	[0, 1],
	[-1, 0],
];

/** 軸（x・y）と 子の 向き r、色（軸 a・子 b。1〜4）。 */
export type PyPair = { x: number; y: number; r: number; a: number; b: number };
export type PyState = {
	t: number;
	/** 0 が 空き、1〜4 が ぷゆゆの 色。[y][x]。 */
	grid: number[][];
	/** 降っている 組（消えている あいだは null）。 */
	cur: PyPair | null;
	/** 次の 組の 色（軸・子）。 */
	next: readonly [number, number];
	fallT: number;
	/** 消えている ところ（"x,y"）と のこり 秒。 */
	popping: readonly (readonly [number, number])[];
	popT: number;
	/** いまの 連鎖（0 は 連鎖して いない）と、さいごに 見せる 連鎖の 字の のこり 秒。 */
	chain: number;
	shownChain: number;
	chainT: number;
	maxChain: number;
	cleared: number;
	points: number;
	over: boolean;
};
export type PyEvent = "move" | "rotate" | "lock" | "pop" | "chain" | "over";

/** 組の 2つの マス（[x, y, 色]。軸が 先）。 */
export const pyCells = (p: PyPair): [number, number, number][] => {
	const [dx, dy] = DIRS[p.r];
	return [
		[p.x, p.y, p.a],
		[p.x + dx, p.y + dy, p.b],
	];
};

const empty = (s: PyState, x: number, y: number): boolean =>
	x >= 0 && x < PY.cols && y < PY.rows && (y < 0 || s.grid[y][x] === 0);

const fits = (s: PyState, p: PyPair): boolean =>
	pyCells(p).every(([x, y]) => empty(s, x, y));

const color = (rnd: Rnd): number => 1 + Math.floor(rnd() * PY.colors);

const spawn = (s: PyState, rnd: Rnd): boolean => {
	const [a, b] = s.next;
	s.next = [color(rnd), color(rnd)];
	const p: PyPair = { x: PY.spawnX, y: 1, r: 0, a, b };
	if (!fits(s, p)) return false;
	s.cur = p;
	s.fallT = pyFall(s);
	return true;
};

export const pyStart = (rnd: Rnd): PyState => {
	const s: PyState = {
		t: 0,
		grid: Array.from({ length: PY.rows }, () => Array(PY.cols).fill(0)),
		cur: null,
		next: [color(rnd), color(rnd)],
		fallT: PY.fall,
		popping: [],
		popT: 0,
		chain: 0,
		shownChain: 0,
		chainT: 0,
		maxChain: 0,
		cleared: 0,
		points: 0,
		over: false,
	};
	spawn(s, rnd);
	return s;
};

export const pyFall = (s: PyState): number =>
	Math.max(PY.fastest, PY.fall - Math.floor(s.t / 30) * PY.fallStep);
export const pyScore = (s: PyState): number => s.points;

/** 浮いた ぷゆゆを 下へ 詰める。 */
export const pyGravity = (grid: number[][]): void => {
	for (let x = 0; x < PY.cols; x++) {
		let w = PY.rows - 1;
		for (let y = PY.rows - 1; y >= 0; y--) {
			const c = grid[y][x];
			if (!c) continue;
			grid[y][x] = 0;
			grid[w][x] = c;
			w--;
		}
	}
};

/** 4つ 以上 つながった 同じ 色の かたまり。 */
export const pyGroups = (grid: number[][]): [number, number][][] => {
	const seen = grid.map((row) => row.map(() => false));
	const out: [number, number][][] = [];
	for (let y = 0; y < PY.rows; y++)
		for (let x = 0; x < PY.cols; x++) {
			const c = grid[y][x];
			if (!c || seen[y][x]) continue;
			const group: [number, number][] = [];
			const stack: [number, number][] = [[x, y]];
			seen[y][x] = true;
			while (stack.length) {
				const [cx, cy] = stack.pop() as [number, number];
				group.push([cx, cy]);
				for (const [dx, dy] of DIRS) {
					const nx = cx + dx;
					const ny = cy + dy;
					if (nx < 0 || nx >= PY.cols || ny < 0 || ny >= PY.rows) continue;
					if (seen[ny][nx] || grid[ny][nx] !== c) continue;
					seen[ny][nx] = true;
					stack.push([nx, ny]);
				}
			}
			if (group.length >= 4) out.push(group);
		}
	return out;
};

/** そろって いれば 消しはじめる（点も ここで）。そろって いなければ 次の 組を 出す。 */
const resolve = (s: PyState, rnd: Rnd, ev: PyEvent[]): void => {
	const groups = pyGroups(s.grid);
	if (groups.length) {
		s.chain++;
		s.maxChain = Math.max(s.maxChain, s.chain);
		const cells = groups.flat();
		const colors = new Set(groups.map(([[x, y]]) => s.grid[y][x])).size;
		const power =
			PY.chainPower[Math.min(s.chain, PY.chainPower.length) - 1] +
			PY.colorBonus[colors];
		s.points += cells.length * 10 * power;
		s.cleared += cells.length;
		s.popping = cells;
		s.popT = PY.popTime;
		if (s.chain >= 2) {
			s.shownChain = s.chain;
			s.chainT = 1.2;
			ev.push("chain");
		} else ev.push("pop");
		return;
	}
	s.chain = 0;
	if (s.grid[0][PY.spawnX] || !spawn(s, rnd)) {
		s.over = true;
		s.cur = null;
		ev.push("over");
	}
};

/** 置いて、浮いた ほうを 降らせて、そろったか 見る。 */
const lock = (s: PyState, rnd: Rnd, ev: PyEvent[]): void => {
	if (!s.cur) return;
	// 上に はみ出た ぶんは 消える
	for (const [x, y, c] of pyCells(s.cur)) if (y >= 0) s.grid[y][x] = c;
	s.cur = null;
	pyGravity(s.grid);
	ev.push("lock");
	resolve(s, rnd, ev);
};

export const pyStep = (
	s: PyState,
	dt: number,
	input: { dx: number; rotate: boolean; soft: boolean },
	rnd: Rnd,
): PyEvent[] => {
	const ev: PyEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	s.chainT = Math.max(0, s.chainT - dt);
	if (s.popping.length) {
		s.popT -= dt;
		if (s.popT > 0) return ev;
		for (const [x, y] of s.popping) s.grid[y][x] = 0;
		s.popping = [];
		pyGravity(s.grid);
		resolve(s, rnd, ev);
		return ev;
	}
	const cur = s.cur;
	if (!cur) return ev;
	if (input.dx) {
		const p = { ...cur, x: cur.x + Math.sign(input.dx) };
		if (fits(s, p)) {
			s.cur = p;
			ev.push("move");
		}
	}
	if (input.rotate && s.cur) {
		const c = s.cur;
		const r = (c.r + 1) % 4;
		const [dx, dy] = DIRS[r];
		// そのまま → 壁や ぷゆゆから 押しもどす → はさまれたら 上下 入れかえ
		for (const p of [
			{ ...c, r },
			{ ...c, r, x: c.x - dx, y: c.y - dy },
			{ ...c, r: (c.r + 2) % 4 },
			{ ...c, r: (c.r + 2) % 4, y: c.y - 1 },
		])
			if (fits(s, p)) {
				s.cur = p;
				ev.push("rotate");
				break;
			}
	}
	const unit = input.soft ? PY.soft : pyFall(s);
	s.fallT = Math.min(s.fallT, unit) - dt;
	while (s.fallT <= 0 && s.cur) {
		s.fallT += unit;
		const p = { ...s.cur, y: s.cur.y + 1 };
		if (fits(s, p)) s.cur = p;
		else lock(s, rnd, ev);
	}
	return ev;
};

/** 盤の 左上（画面の 画素。帯の 下に まんなか ぞろえ）。 */
export const pyOrigin = (): readonly [number, number] => [
	Math.floor((AW - PY.cols * PY.cell) / 2),
	ATOP + Math.floor((AH - ATOP - PY.rows * PY.cell) / 2),
];
