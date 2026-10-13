// キリコの 家の ゲーム「スレ積み」（stack）の 決まり。板は ui/arcade/home/stack.ts、文は data/arcade/text.ts。
// - 4マスの レスが 上から 降ってくる。←→ で 動かし、回して 積む。横 1列 そろうと 消える。
// - 出る ところが ふさがると おわり。
// - スコア＝消した 列（いちどに 1・2・3・4列 で 100・300・500・800）。10列 ごとに 段が 上がって 速くなる。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import { AH, ATOP, AW, type Rnd } from "../logic";

export const ST = {
	/** 1マスの 大きさ（画素）。 */
	cell: 6,
	cols: 10,
	rows: 20,
	/** 1マス 降る 秒（段 0・段ごとに 縮む 分・いちばん 速い とき・↓ を 押した とき）。 */
	fall: 0.8,
	fallStep: 0.07,
	fastest: 0.1,
	soft: 0.04,
	/** いちどに 消した 列の 数 → 点。 */
	lineScore: [0, 100, 300, 500, 800],
	linesPerLevel: 10,
} as const;

/** 板の 字。 */
export const ST_TEXT = {
	next: "NEXT",
	lines: "列",
	level: "段",
} as const;

/** 7つの 形（n×n の 枠の 中の マス）。1〜7 が 色。 */
const SHAPES: readonly { n: number; cells: readonly [number, number][] }[] = [
	{
		n: 4,
		cells: [
			[0, 1],
			[1, 1],
			[2, 1],
			[3, 1],
		],
	},
	{
		n: 2,
		cells: [
			[0, 0],
			[1, 0],
			[0, 1],
			[1, 1],
		],
	},
	{
		n: 3,
		cells: [
			[1, 0],
			[0, 1],
			[1, 1],
			[2, 1],
		],
	},
	{
		n: 3,
		cells: [
			[1, 0],
			[2, 0],
			[0, 1],
			[1, 1],
		],
	},
	{
		n: 3,
		cells: [
			[0, 0],
			[1, 0],
			[1, 1],
			[2, 1],
		],
	},
	{
		n: 3,
		cells: [
			[0, 0],
			[0, 1],
			[1, 1],
			[2, 1],
		],
	},
	{
		n: 3,
		cells: [
			[2, 0],
			[0, 1],
			[1, 1],
			[2, 1],
		],
	},
];

export type StPiece = { k: number; r: number; x: number; y: number };
export type StState = {
	t: number;
	/** 0 が 空き、1〜7 が レスの 色。[y][x]。 */
	grid: number[][];
	cur: StPiece;
	next: number;
	/** 7つ ずつ まぜた 袋。 */
	bag: number[];
	fallT: number;
	lines: number;
	points: number;
	over: boolean;
};
export type StEvent = "move" | "rotate" | "lock" | "clear" | "four" | "over";

/** 形 k（0〜6）を r 回 右へ 回した マス。 */
export const stCells = (k: number, r: number): [number, number][] => {
	const { n, cells } = SHAPES[k];
	return cells.map(([x0, y0]) => {
		let [x, y] = [x0, y0];
		for (let i = 0; i < ((r % 4) + 4) % 4; i++) [x, y] = [n - 1 - y, x];
		return [x, y];
	});
};

/** その ピースの 盤の 上の マス。 */
export const stPieceCells = (p: StPiece): [number, number][] =>
	stCells(p.k, p.r).map(([x, y]) => [p.x + x, p.y + y]);

const fits = (s: StState, p: StPiece): boolean =>
	stPieceCells(p).every(
		([x, y]) =>
			x >= 0 && x < ST.cols && y < ST.rows && (y < 0 || !s.grid[y][x]),
	);

const draw = (s: StState, rnd: Rnd): number => {
	if (s.bag.length === 0) {
		const b = [0, 1, 2, 3, 4, 5, 6];
		for (let i = b.length - 1; i > 0; i--) {
			const j = Math.floor(rnd() * (i + 1));
			[b[i], b[j]] = [b[j], b[i]];
		}
		s.bag = b;
	}
	return s.bag.pop() ?? 0;
};

const spawn = (k: number): StPiece => ({
	k,
	r: 0,
	x: Math.floor((ST.cols - SHAPES[k].n) / 2),
	y: k === 0 ? -1 : 0,
});

export const stStart = (rnd: Rnd): StState => {
	const s: StState = {
		t: 0,
		grid: Array.from({ length: ST.rows }, () => Array(ST.cols).fill(0)),
		cur: spawn(0),
		next: 0,
		bag: [],
		fallT: ST.fall,
		lines: 0,
		points: 0,
		over: false,
	};
	s.cur = spawn(draw(s, rnd));
	s.next = draw(s, rnd);
	return s;
};

export const stLevel = (s: StState): number =>
	Math.floor(s.lines / ST.linesPerLevel);
export const stFall = (s: StState): number =>
	Math.max(ST.fastest, ST.fall - stLevel(s) * ST.fallStep);
export const stScore = (s: StState): number => s.points;

/** 置いて、そろった 列を 消して、次を 出す。 */
const lock = (s: StState, rnd: Rnd, ev: StEvent[]): void => {
	for (const [x, y] of stPieceCells(s.cur)) {
		if (y < 0) {
			s.over = true;
			continue;
		}
		s.grid[y][x] = s.cur.k + 1;
	}
	ev.push("lock");
	const keep = s.grid.filter((row) => row.some((c) => !c));
	const n = ST.rows - keep.length;
	if (n > 0) {
		s.grid = [
			...Array.from({ length: n }, () => Array(ST.cols).fill(0)),
			...keep,
		];
		s.lines += n;
		s.points += ST.lineScore[n] ?? 800;
		ev.push(n >= 4 ? "four" : "clear");
	}
	s.cur = spawn(s.next);
	s.next = draw(s, rnd);
	if (s.over || !fits(s, s.cur)) {
		s.over = true;
		ev.push("over");
	}
};

export const stStep = (
	s: StState,
	dt: number,
	input: { dx: number; rotate: boolean; soft: boolean },
	rnd: Rnd,
): StEvent[] => {
	const ev: StEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	if (input.dx) {
		const p = { ...s.cur, x: s.cur.x + Math.sign(input.dx) };
		if (fits(s, p)) {
			s.cur = p;
			ev.push("move");
		}
	}
	if (input.rotate) {
		// 壁ぎわでは 横へ ずらして 回す
		for (const kick of [0, -1, 1, -2, 2]) {
			const p = { ...s.cur, r: (s.cur.r + 1) % 4, x: s.cur.x + kick };
			if (fits(s, p)) {
				s.cur = p;
				ev.push("rotate");
				break;
			}
		}
	}
	s.fallT = Math.min(s.fallT, input.soft ? ST.soft : stFall(s)) - dt;
	while (s.fallT <= 0 && !s.over) {
		s.fallT += input.soft ? ST.soft : stFall(s);
		const p = { ...s.cur, y: s.cur.y + 1 };
		if (fits(s, p)) s.cur = p;
		else lock(s, rnd, ev);
	}
	return ev;
};

/** 盤の 左上（画面の 画素。帯の 下に まんなか ぞろえ）。 */
export const stOrigin = (): readonly [number, number] => [
	Math.floor((AW - ST.cols * ST.cell) / 2),
	ATOP + Math.floor((AH - ATOP - ST.rows * ST.cell) / 2),
];
