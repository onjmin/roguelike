// キリコの 家の 遊べる 家具「リバーシの 盤」の リバーシ（板は ui/arcade/home/reversi.ts）。
// 8×8 の 盤。キリコが 黒で 先手、名無し（CPU）が 白。はさんだ 石を 裏返す。
// 置ける ところが ない ほうは パス。どちらも 置けなく なったら おわり（石の 多い ほうが 勝ち）。
// 勝ち抜き：勝つと 名無しが 強く なって 次の 局（よわい → ふつう → つよい の 3局。負けたら おわり）。
// 名無し よわい：多く 返せる 手（ぶれ 大きめ）。ふつう：マスの 重み（角は 高く、角の 斜め隣は 低い）。
// 名無し つよい：重みと 置ける 数で 3手 先まで 読む（α β）。
// スコア（1局）：勝ち＝1000×(段＋1)＋石の 差×10、負け・引き分け＝黒の 石×10。
// DOM に 触らない（試験できる）。

import type { Rnd } from "../logic";

export const RV = {
	/** 盤の 一辺（マス）。 */
	n: 8,
	/** 1マスの 大きさ（画素）。 */
	cell: 16,
	/** 名無しが 考える 間（秒）。 */
	think: 0.55,
	/** 石が 裏返る 間（秒）。 */
	flipT: 0.22,
	/** おわってから 字までの 間（秒）。 */
	endWait: 1.2,
	/** 名無しの 強さの 数（勝ち抜きの 局の 数）。 */
	levels: 3,
	/** つよい 名無しが 読む 手の 数。 */
	depth: 3,
} as const;

export const RV_LV = ["よわい", "ふつう", "つよい"] as const;

/** 0 空き・1 黒（キリコ）・2 白（名無し）。 */
export type RvStone = 0 | 1 | 2;
export type RvState = {
	cells: RvStone[];
	turn: 1 | 2;
	/** 0 まだ・1 キリコの 勝ち・2 名無しの 勝ち・3 引き分け。 */
	winner: 0 | 1 | 2 | 3;
	/** 最後に 置いた マス（-1 なし）。 */
	last: number;
	/** 名無しの 強さ（0 よわい・1 ふつう・2 つよい）。 */
	lv: number;
};

/** 置いた 結果（返した 石・パスした ほう）。 */
export type RvMove = { flips: number[]; pass: 0 | 1 | 2 };

/** 名無しの ひとこと（板の 下の 行）。 */
export const RV_SAY = {
	cpuPass: "置けへんパスや",
	mePass: "キリコは置けへんなパスやで",
	corner: "角もろたで",
	meCorner: "角はあかんて",
	many: "ごっそりいったで",
	cpuWin: "ワイの勝ちやな",
	meWin: "ファッ！？",
	draw: "引き分けやん",
	next: ["やるやん次は本気や", "ほなワイのとっておきや"],
} as const;

const N = RV.n;
const DIRS: readonly (readonly [number, number])[] = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
	[1, 1],
	[1, -1],
	[-1, 1],
	[-1, -1],
];

/** マスの 重み（角は 高く、角の 隣・斜め隣は 低い）。 */
const W: readonly number[] = [
	100, -20, 10, 5, 5, 10, -20, 100, -20, -50, -2, -2, -2, -2, -50, -20, 10, -2,
	-1, -1, -1, -1, -2, 10, 5, -2, -1, -1, -1, -1, -2, 5, 5, -2, -1, -1, -1, -1,
	-2, 5, 10, -2, -1, -1, -1, -1, -2, 10, -20, -50, -2, -2, -2, -2, -50, -20,
	100, -20, 10, 5, 5, 10, -20, 100,
];

export const rvCorner = (i: number): boolean =>
	i === 0 || i === N - 1 || i === N * (N - 1) || i === N * N - 1;

export const rvStart = (lv = 0): RvState => {
	const cells = Array.from({ length: N * N }, () => 0 as RvStone);
	const m = N / 2;
	cells[(m - 1) * N + (m - 1)] = 2;
	cells[m * N + m] = 2;
	cells[(m - 1) * N + m] = 1;
	cells[m * N + (m - 1)] = 1;
	return { cells, turn: 1, winner: 0, last: -1, lv };
};

const other = (w: 1 | 2): 1 | 2 => (w === 1 ? 2 : 1);

/** そこに 置くと 返る 石（置けない なら 空）。 */
export const rvFlips = (
	cells: readonly RvStone[],
	i: number,
	who: 1 | 2,
): number[] => {
	if (cells[i] !== 0) return [];
	const x0 = i % N;
	const y0 = Math.floor(i / N);
	const foe = other(who);
	const out: number[] = [];
	for (const [dx, dy] of DIRS) {
		const run: number[] = [];
		let x = x0 + dx;
		let y = y0 + dy;
		while (x >= 0 && y >= 0 && x < N && y < N && cells[y * N + x] === foe) {
			run.push(y * N + x);
			x += dx;
			y += dy;
		}
		if (run.length && x >= 0 && y >= 0 && x < N && y < N)
			if (cells[y * N + x] === who) out.push(...run);
	}
	return out;
};

/** 置ける マス。 */
export const rvMoves = (cells: readonly RvStone[], who: 1 | 2): number[] => {
	const out: number[] = [];
	for (let i = 0; i < cells.length; i++)
		if (rvFlips(cells, i, who).length) out.push(i);
	return out;
};

export const rvCount = (cells: readonly RvStone[], who: 1 | 2): number =>
	cells.filter((c) => c === who).length;

/** 置いて 返した 盤（もとは そのまま）。 */
const applied = (
	cells: readonly RvStone[],
	i: number,
	who: 1 | 2,
): RvStone[] => {
	const next = cells.slice();
	next[i] = who;
	for (const j of rvFlips(cells, i, who)) next[j] = who;
	return next;
};

/** 番の ほうが 置く（置けない マスは null）。次の 番・パス・おわりも 決める。 */
export const rvPlace = (s: RvState, i: number): RvMove | null => {
	if (s.winner) return null;
	const who = s.turn;
	const flips = rvFlips(s.cells, i, who);
	if (!flips.length) return null;
	s.cells[i] = who;
	for (const j of flips) s.cells[j] = who;
	s.last = i;
	const foe = other(who);
	let pass: 0 | 1 | 2 = 0;
	if (rvMoves(s.cells, foe).length) s.turn = foe;
	else if (rvMoves(s.cells, who).length) pass = foe;
	else {
		const b = rvCount(s.cells, 1);
		const w = rvCount(s.cells, 2);
		s.winner = b > w ? 1 : b < w ? 2 : 3;
	}
	return { flips, pass };
};

/** 盤の 良さ（who から 見て。重み＋置ける 数）。 */
const evalBoard = (cells: readonly RvStone[], who: 1 | 2): number => {
	const foe = other(who);
	let v = 0;
	for (let i = 0; i < cells.length; i++)
		if (cells[i] === who) v += W[i] ?? 0;
		else if (cells[i] === foe) v -= W[i] ?? 0;
	const mob = rvMoves(cells, who).length - rvMoves(cells, foe).length;
	return v + mob * 6;
};

/** who の 番で depth 手 読んだ 値（who から 見て）。 */
const negamax = (
	cells: readonly RvStone[],
	who: 1 | 2,
	depth: number,
	alpha: number,
	beta: number,
): number => {
	const moves = rvMoves(cells, who);
	const foe = other(who);
	if (!moves.length) {
		if (!rvMoves(cells, foe).length)
			return (rvCount(cells, who) - rvCount(cells, foe)) * 1000;
		return depth <= 0
			? evalBoard(cells, who)
			: -negamax(cells, foe, depth - 1, -beta, -alpha);
	}
	if (depth <= 0) return evalBoard(cells, who);
	let best = -Infinity;
	for (const i of moves) {
		const v = -negamax(applied(cells, i, who), foe, depth - 1, -beta, -alpha);
		if (v > best) best = v;
		if (best > alpha) alpha = best;
		if (alpha >= beta) break;
	}
	return best;
};

/** 名無しの 手（置ける ところが ない ときは -1）。 */
export const rvCpu = (s: RvState, rnd: Rnd): number => {
	const who = s.turn;
	const moves = rvMoves(s.cells, who);
	if (!moves.length) return -1;
	let best = moves[0] ?? -1;
	let bestV = -Infinity;
	for (const i of moves) {
		let v: number;
		if (s.lv <= 0) v = rvFlips(s.cells, i, who).length + rnd() * 4;
		else if (s.lv === 1)
			v = (W[i] ?? 0) + rvFlips(s.cells, i, who).length + rnd() * 6;
		else
			v =
				-negamax(
					applied(s.cells, i, who),
					other(who),
					RV.depth - 1,
					-Infinity,
					Infinity,
				) +
				rnd() * 2;
		if (v > bestV) {
			bestV = v;
			best = i;
		}
	}
	return best;
};

/** 1局の 点。 */
export const rvScore = (s: RvState): number => {
	const b = rvCount(s.cells, 1);
	const w = rvCount(s.cells, 2);
	if (s.winner === 1) return 1000 * (s.lv + 1) + (b - w) * 10;
	return b * 10;
};
