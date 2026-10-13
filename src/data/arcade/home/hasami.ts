// キリコの 家の 遊べる 家具「将棋盤」の はさみ将棋（板は ui/arcade/home/hasami.ts）。
// 9×9 の 盤。キリコの 歩 9枚が 下の 段、名無し（CPU）の と 9枚が 上の 段。キリコが 先手。
// 駒は 飛車と 同じく 縦横に 何マスでも 動ける（とびこえは なし）。動いた 駒と 味方の 駒で 縦か 横に
// 相手の 駒を 挟むと 取る（何枚 ならんでいても よい。隅の 取りは なし。自分から 挟まれに 入っても 取られない）。
// 先に 5枚 取った ほうが 勝ち。120手で おわれば 取った 数で 決める。
// 名無しは 取れる 手を 好み、すぐ 取りかえされる 手を さける（少し ぶれる）。
// スコア：勝ち＝1000＋(取った−取られた)×50、それ以外＝取った×50。DOM に 触らない（試験できる）。

import type { Rnd } from "../logic";

export const HS = {
	n: 9,
	/** 何枚 取れば 勝ちか。 */
	goal: 5,
	/** 手の 上限（両方 あわせて）。 */
	maxPly: 120,
	/** 名無しが 考える 間（秒）。 */
	think: 0.5,
	/** 勝負が ついてから おわりの 字までの 間（秒）。 */
	endWait: 0.9,
} as const;

/** 0 空き・1 キリコ・2 名無し。 */
export type HsPiece = 0 | 1 | 2;
export type HsState = {
	cells: HsPiece[];
	turn: 1 | 2;
	/** 取った 数（[0] は 使わない）。 */
	took: [number, number, number];
	ply: number;
	/** 0 まだ・1 キリコ・2 名無し・3 引き分け。 */
	winner: 0 | 1 | 2 | 3;
	/** 最後の 手と 取った マス（見た目用）。 */
	last: [number, number] | null;
	gone: number[];
};

/** 名無しの ひとこと。 */
export const HS_SAY = {
	took: "もろたで",
	lost: "痛っ",
	cpuWin: "ワイの　勝ちやな",
	meWin: "ファッ！？",
	draw: "引き分けやん",
} as const;

const DIRS: readonly (readonly [number, number])[] = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
];

const inside = (x: number, y: number): boolean =>
	x >= 0 && y >= 0 && x < HS.n && y < HS.n;

export const hsStart = (): HsState => {
	const cells = Array.from({ length: HS.n * HS.n }, () => 0 as HsPiece);
	for (let x = 0; x < HS.n; x++) {
		cells[x] = 2;
		cells[(HS.n - 1) * HS.n + x] = 1;
	}
	return {
		cells,
		turn: 1,
		took: [0, 0, 0],
		ply: 0,
		winner: 0,
		last: null,
		gone: [],
	};
};

/** その 駒の 行き先（縦横に 空いている かぎり）。 */
export const hsDests = (cells: readonly HsPiece[], from: number): number[] => {
	const out: number[] = [];
	if (cells[from] === 0) return out;
	const x0 = from % HS.n;
	const y0 = Math.floor(from / HS.n);
	for (const [dx, dy] of DIRS) {
		let x = x0 + dx;
		let y = y0 + dy;
		while (inside(x, y) && cells[y * HS.n + x] === 0) {
			out.push(y * HS.n + x);
			x += dx;
			y += dy;
		}
	}
	return out;
};

/** to に 来た who の 駒で 挟んで 取れる 相手の マス。 */
const sandwiched = (
	cells: readonly HsPiece[],
	to: number,
	who: 1 | 2,
): number[] => {
	const you = who === 1 ? 2 : 1;
	const out: number[] = [];
	const x0 = to % HS.n;
	const y0 = Math.floor(to / HS.n);
	for (const [dx, dy] of DIRS) {
		const line: number[] = [];
		let x = x0 + dx;
		let y = y0 + dy;
		while (inside(x, y) && cells[y * HS.n + x] === you) {
			line.push(y * HS.n + x);
			x += dx;
			y += dy;
		}
		if (line.length && inside(x, y) && cells[y * HS.n + x] === who)
			out.push(...line);
	}
	return out;
};

/** 動かした あとの 盤と 取れる マス（盤は 書きかえない）。 */
const tryMove = (
	cells: readonly HsPiece[],
	from: number,
	to: number,
): { cells: HsPiece[]; gone: number[] } => {
	const who = cells[from] as 1 | 2;
	const next = cells.slice();
	next[to] = who;
	next[from] = 0;
	const gone = sandwiched(next, to, who);
	for (const i of gone) next[i] = 0;
	return { cells: next, gone };
};

/** 手を 指す（指せなければ -1、指せたら 取った 数）。勝ち負けも ここで 決める。 */
export const hsMove = (s: HsState, from: number, to: number): number => {
	if (s.winner || s.cells[from] !== s.turn) return -1;
	if (!hsDests(s.cells, from).includes(to)) return -1;
	const who = s.turn;
	const r = tryMove(s.cells, from, to);
	s.cells = r.cells;
	s.gone = r.gone;
	s.last = [from, to];
	s.took[who] += r.gone.length;
	s.ply++;
	s.turn = who === 1 ? 2 : 1;
	if (s.took[who] >= HS.goal) s.winner = who;
	else if (s.ply >= HS.maxPly || !hasMove(s.cells, s.turn))
		s.winner = s.took[1] > s.took[2] ? 1 : s.took[2] > s.took[1] ? 2 : 3;
	return r.gone.length;
};

const hasMove = (cells: readonly HsPiece[], who: 1 | 2): boolean =>
	cells.some((c, i) => c === who && hsDests(cells, i).length > 0);

/** who が 1手で 取れる いちばん 多い 数。 */
const bestTake = (cells: readonly HsPiece[], who: 1 | 2): number => {
	let best = 0;
	for (let i = 0; i < cells.length; i++) {
		if (cells[i] !== who) continue;
		for (const to of hsDests(cells, i))
			best = Math.max(
				best,
				sandwiched(tryMoveRaw(cells, i, to), to, who).length,
			);
	}
	return best;
};

/** 取りを 見ずに 動かした 盤。 */
const tryMoveRaw = (
	cells: readonly HsPiece[],
	from: number,
	to: number,
): HsPiece[] => {
	const next = cells.slice();
	next[to] = next[from];
	next[from] = 0;
	return next;
};

/** 名無しの 手 [from, to]。取る 数 − すぐ 取りかえされる 数 で 選ぶ（少し ぶれる）。 */
export const hsCpu = (s: HsState, rnd: Rnd): [number, number] => {
	const me = s.turn;
	const you = me === 1 ? 2 : 1;
	let best: [number, number] = [-1, -1];
	let bestV = -Infinity;
	for (let i = 0; i < s.cells.length; i++) {
		if (s.cells[i] !== me) continue;
		for (const to of hsDests(s.cells, i)) {
			const r = tryMove(s.cells, i, to);
			const win = s.took[me] + r.gone.length >= HS.goal;
			const back = win ? 0 : bestTake(r.cells, you);
			// 前へ 出る 手を ほんの 少し 好む（じっと しない）
			const ahead =
				me === 2 ? Math.floor(to / HS.n) : HS.n - 1 - Math.floor(to / HS.n);
			const v =
				(win ? 10000 : 0) +
				r.gone.length * 100 -
				back * 90 +
				Math.min(ahead, 4) * 2 +
				rnd() * 30;
			if (v > bestV) {
				bestV = v;
				best = [i, to];
			}
		}
	}
	return best;
};

export const hsScore = (s: HsState): number =>
	s.winner === 1 ? 1000 + (s.took[1] - s.took[2]) * 50 : s.took[1] * 50;
