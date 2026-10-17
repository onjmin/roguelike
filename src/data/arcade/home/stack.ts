// キリコの 家の ゲーム「スレ積み」（stack）の 決まり。板は ui/arcade/home/stack.ts、文は data/arcade/text.ts。
// - 4マスの レスが 上から 降ってくる。←→ で 動かし、回して 積む。横 1列 そろうと 消える。
// - ↑ で 一気に 置く（ハードドロップ。下りた 段×2点）。下が ふさがっても 少しの 間は 動かせる（置く 猶予）。
// - 出る ところが ふさがると おわり。
// - スコア＝消した 列（いちどに 1・2・3・4列 で 100・300・500・800）×段。続けて 消すと 連続（50×連続×段）、
//   4列を 続けて 消すと 1.5倍。10列 ごとに 段が 上がって 速くなる。
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
	/** 下が ふさがってから 置くまでの 猶予（秒）と、動かして のばせる 回数。 */
	lockDelay: 0.5,
	lockResets: 15,
} as const;

/** 板の 字。 */
export const ST_TEXT = {
	next: "NEXT",
	lines: "列",
	level: "段",
	combo: "{n}連続",
	four: "4列！",
	b2b: "4列 連発！",
	levelUp: "LEVEL UP",
	note: "タップ左右＝動く上＝回す下＝置く",
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
	/** 置く 猶予の のこりと のばした 回数。 */
	lockT: number;
	resets: number;
	lines: number;
	points: number;
	/** 続けて 消した 回数（消さずに 置くと -1 に もどる）と、前に 消したのが 4列だったか。 */
	combo: number;
	lastFour: boolean;
	/** さっき 消えた 列（盤の 段）と 光る のこり 秒・出す 字。 */
	cleared: number[];
	flashT: number;
	flashText: string;
	textT: number;
	over: boolean;
};
export type StEvent =
	| "move"
	| "rotate"
	| "lock"
	| "drop"
	| "clear"
	| "four"
	| "level"
	| "over";

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
		lockT: ST.lockDelay,
		resets: 0,
		lines: 0,
		points: 0,
		combo: -1,
		lastFour: false,
		cleared: [],
		flashT: 0,
		flashText: "",
		textT: 0,
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
	const cleared: number[] = [];
	s.grid.forEach((row, y) => {
		if (row.every((c) => c)) cleared.push(y);
	});
	const keep = s.grid.filter((row) => row.some((c) => !c));
	const n = cleared.length;
	if (n > 0) {
		const lv = stLevel(s) + 1;
		s.grid = [
			...Array.from({ length: n }, () => Array(ST.cols).fill(0)),
			...keep,
		];
		s.combo++;
		const four = n >= 4;
		const b2b = four && s.lastFour;
		const base = (ST.lineScore[n] ?? 800) * lv;
		s.points +=
			Math.floor(b2b ? base * 1.5 : base) +
			(s.combo > 0 ? 50 * s.combo * lv : 0);
		s.lastFour = four;
		s.cleared = cleared;
		s.flashT = 0.3;
		s.textT = 1.2;
		s.flashText = b2b
			? ST_TEXT.b2b
			: four
				? ST_TEXT.four
				: s.combo > 0
					? ST_TEXT.combo.replace("{n}", String(s.combo + 1))
					: "";
		const before = stLevel(s);
		s.lines += n;
		ev.push(four ? "four" : "clear");
		if (stLevel(s) > before) {
			s.flashText = ST_TEXT.levelUp;
			ev.push("level");
		}
	} else s.combo = -1;
	s.cur = spawn(s.next);
	s.next = draw(s, rnd);
	s.lockT = ST.lockDelay;
	s.resets = 0;
	if (s.over || !fits(s, s.cur)) {
		s.over = true;
		ev.push("over");
	}
};

/** 一気に 置いた ときに 止まる 位置（影）。 */
export const stGhost = (s: StState): StPiece => {
	let p = s.cur;
	for (;;) {
		const q = { ...p, y: p.y + 1 };
		if (!fits(s, q)) return p;
		p = q;
	}
};

export const stStep = (
	s: StState,
	dt: number,
	input: { dx: number; rotate: boolean; soft: boolean; drop?: boolean },
	rnd: Rnd,
): StEvent[] => {
	const ev: StEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	s.flashT = Math.max(0, s.flashT - dt);
	s.textT = Math.max(0, s.textT - dt);
	const grounded = () => !fits(s, { ...s.cur, y: s.cur.y + 1 });
	// 下が ふさがって いる あいだに 動かすと 猶予を のばす
	const moved = () => {
		if (grounded() && s.resets < ST.lockResets) {
			s.lockT = ST.lockDelay;
			s.resets++;
		}
	};
	if (input.dx) {
		const p = { ...s.cur, x: s.cur.x + Math.sign(input.dx) };
		if (fits(s, p)) {
			s.cur = p;
			ev.push("move");
			moved();
		}
	}
	if (input.rotate) {
		// 壁ぎわでは 横へ ずらして 回す（床ぎわでは 上へも）
		for (const [kx, ky] of [
			[0, 0],
			[-1, 0],
			[1, 0],
			[-2, 0],
			[2, 0],
			[0, -1],
		]) {
			const p = {
				...s.cur,
				r: (s.cur.r + 1) % 4,
				x: s.cur.x + kx,
				y: s.cur.y + ky,
			};
			if (fits(s, p)) {
				s.cur = p;
				ev.push("rotate");
				moved();
				break;
			}
		}
	}
	if (input.drop) {
		const g = stGhost(s);
		s.points += (g.y - s.cur.y) * 2;
		s.cur = g;
		ev.push("drop");
		lock(s, rnd, ev);
		s.fallT = stFall(s);
		return ev;
	}
	s.fallT = Math.min(s.fallT, input.soft ? ST.soft : stFall(s)) - dt;
	while (s.fallT <= 0 && !s.over) {
		s.fallT += input.soft ? ST.soft : stFall(s);
		const p = { ...s.cur, y: s.cur.y + 1 };
		if (fits(s, p)) {
			// 下りたら 猶予は はじめから（動かして のばすのは 回数まで）
			s.cur = p;
			s.lockT = ST.lockDelay;
		}
	}
	if (!s.over && grounded()) {
		s.lockT -= dt;
		if (s.lockT <= 0) {
			lock(s, rnd, ev);
			s.fallT = stFall(s);
		}
	}
	return ev;
};

/** 盤の 左上（画面の 画素。帯の 下に まんなか ぞろえ）。 */
export const stOrigin = (): readonly [number, number] => [
	Math.floor((AW - ST.cols * ST.cell) / 2),
	ATOP + Math.floor((AH - ATOP - ST.rows * ST.cell) / 2),
];
