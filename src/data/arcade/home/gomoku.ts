// キリコの 家の 遊べる 家具「碁盤」の 五目並べ（板は ui/arcade/home/gomoku.ts）。
// 11×11 の 盤。キリコが 黒で 先手、名無し（CPU）が 白。縦・横・斜めに 5つ 以上 ならべた ほうが 勝ち（禁じ手は なし）。
// 勝ち抜き：勝つと 名無しが 強く なって 次の 局（よわい → ふつう → つよい の 3局。負けたら おわり）。
// 名無し よわい：つながった 列だけ 見る（とびとびの 三・四を 見のがす）。点に 3割の ぶれ。
// 名無し ふつう・つよい：5マスの 窓で 数える（とびとびの 形も 見る）。ぶれは 1割5分・わずか。
// スコア（1局）：勝ち＝1000×(段＋1)＋早く 勝つほど 多い ボーナス、負け・引き分け＝いちばん 長い 列×10。
// 板は 勝った 局の 点を 足して いく。DOM に 触らない（試験できる）。

import type { Rnd } from "../logic";

export const GM = {
	/** 盤の 一辺（マス）。 */
	n: 11,
	/** 1マスの 大きさ（画素）。 */
	cell: 12,
	/** 名無しが 考える 間（秒）。 */
	think: 0.6,
	/** 勝ちが 決まってから おわりの 字までの 間（秒）。 */
	endWait: 0.9,
	/** 名無しの 強さの 数（勝ち抜きの 局の 数）。 */
	levels: 3,
} as const;

/** 名無しの 強さの 名（帯に 出す）。 */
export const GM_LV = ["よわい", "ふつう", "つよい"] as const;

/** 0 空き・1 黒（キリコ）・2 白（名無し）。 */
export type GmStone = 0 | 1 | 2;
export type GmState = {
	cells: GmStone[];
	/** 次に 打つ ほう。 */
	turn: 1 | 2;
	/** キリコが 打った 数。 */
	moves: number;
	/** 0 まだ・1 キリコの 勝ち・2 名無しの 勝ち・3 引き分け。 */
	winner: 0 | 1 | 2 | 3;
	/** 最後に 打った マス（-1 なし）。 */
	last: number;
	/** 勝った 列の マス。 */
	line: number[];
	/** 名無しの 強さ（0 よわい・1 ふつう・2 つよい）。 */
	lv: number;
};

/** 名無しの ひとこと（板の 下の 行）。 */
export const GM_SAY = {
	block: "させるか",
	four: "せやろか",
	cpuWin: "ワイの　勝ちやな",
	meWin: "ファッ！？",
	draw: "引き分けやん",
	/** 勝って 次の 局へ（強さで かわる）。 */
	next: ["やるやん　次は　本気や", "ほな　ワイの　とっておきや"],
} as const;

const DIRS: readonly (readonly [number, number])[] = [
	[1, 0],
	[0, 1],
	[1, 1],
	[1, -1],
];

const inside = (x: number, y: number): boolean =>
	x >= 0 && y >= 0 && x < GM.n && y < GM.n;

export const gmStart = (lv = 0): GmState => ({
	cells: Array.from({ length: GM.n * GM.n }, () => 0 as GmStone),
	turn: 1,
	moves: 0,
	winner: 0,
	last: -1,
	line: [],
	lv,
});

/** その マスを 通る 1方向の 列（同じ 色が つづく マス）。 */
const runAt = (
	cells: readonly GmStone[],
	i: number,
	who: 1 | 2,
	dx: number,
	dy: number,
): { cells: number[]; open: number } => {
	const x0 = i % GM.n;
	const y0 = Math.floor(i / GM.n);
	const got = [i];
	let open = 0;
	for (const sgn of [1, -1]) {
		let x = x0 + dx * sgn;
		let y = y0 + dy * sgn;
		while (inside(x, y) && cells[y * GM.n + x] === who) {
			got.push(y * GM.n + x);
			x += dx * sgn;
			y += dy * sgn;
		}
		if (inside(x, y) && cells[y * GM.n + x] === 0) open++;
	}
	return { cells: got, open };
};

/** 石を 置く（置けなければ false）。勝ち・引き分けも ここで 決める。 */
export const gmPlace = (s: GmState, i: number): boolean => {
	if (s.winner || i < 0 || i >= s.cells.length || s.cells[i] !== 0)
		return false;
	const who = s.turn;
	s.cells[i] = who;
	s.last = i;
	if (who === 1) s.moves++;
	for (const [dx, dy] of DIRS) {
		const r = runAt(s.cells, i, who, dx, dy);
		if (r.cells.length >= 5) {
			s.winner = who;
			s.line = r.cells;
			return true;
		}
	}
	if (s.cells.every((c) => c !== 0)) s.winner = 3;
	else s.turn = who === 1 ? 2 : 1;
	return true;
};

/** 列の 長さと 開いた 端の 数 → 点。 */
const worth = (len: number, open: number): number => {
	if (len >= 5) return 100000;
	if (open === 0) return 0;
	if (len === 4) return open === 2 ? 20000 : 3000;
	if (len === 3) return open === 2 ? 2500 : 120;
	if (len === 2) return open === 2 ? 100 : 12;
	return open === 2 ? 4 : 1;
};

/** その 空きマスに who が 打ったときの 点（4方向の 合計）。 */
const cellWorth = (cells: GmStone[], i: number, who: 1 | 2): number => {
	cells[i] = who;
	let sum = 0;
	for (const [dx, dy] of DIRS) {
		const r = runAt(cells, i, who, dx, dy);
		sum += worth(r.cells.length, r.open);
	}
	cells[i] = 0;
	return sum;
};

/** 5マスの 窓に 入る 石の 数 → 点（相手の 石が ある 窓は 数えない）。 */
const WIN_WORTH = [0, 2, 20, 300, 5000, 100000] as const;

/** その 空きマスに who が 打ったときの 点（そこを 通る 5マスの 窓 ぜんぶ。とびとびの 形も 見える）。 */
const windowWorth = (cells: GmStone[], i: number, who: 1 | 2): number => {
	const you = who === 1 ? 2 : 1;
	const x0 = i % GM.n;
	const y0 = Math.floor(i / GM.n);
	cells[i] = who;
	let sum = 0;
	for (const [dx, dy] of DIRS)
		for (let s = -4; s <= 0; s++) {
			let n = 0;
			let bad = false;
			for (let k = s; k < s + 5 && !bad; k++) {
				const x = x0 + dx * k;
				const y = y0 + dy * k;
				if (!inside(x, y)) bad = true;
				else {
					const c = cells[y * GM.n + x];
					if (c === you) bad = true;
					else if (c === who) n++;
				}
			}
			if (!bad) sum += WIN_WORTH[n];
		}
	cells[i] = 0;
	return sum;
};

/** 名無しの 手。勝ち → 止める → 伸びしろ。強さで 見かたと ぶれが かわる。 */
export const gmCpu = (s: GmState, rnd: Rnd): number => {
	const me = s.turn;
	const you = me === 1 ? 2 : 1;
	const c = (GM.n - 1) / 2;
	if (s.cells.every((v) => v === 0)) return c * GM.n + c;
	let best = -1;
	let bestV = -1;
	for (let i = 0; i < s.cells.length; i++) {
		if (s.cells[i] !== 0) continue;
		const x = i % GM.n;
		const y = Math.floor(i / GM.n);
		// 石の そばだけ 見る（遠くに ぽつんと 打たない）
		let near = false;
		for (let oy = -2; oy <= 2 && !near; oy++)
			for (let ox = -2; ox <= 2 && !near; ox++)
				if (inside(x + ox, y + oy) && s.cells[(y + oy) * GM.n + x + ox] !== 0)
					near = true;
		if (!near) continue;
		const wide = s.lv >= 1;
		const worthOf = wide ? windowWorth : cellWorth;
		const atk = worthOf(s.cells, i, me);
		const def = worthOf(s.cells, i, you);
		const center = 6 - (Math.abs(x - c) + Math.abs(y - c)) * 0.5;
		// 勝ち・止めなければ 負ける 手は ぶれない。それ以外は 強さで ぶれる
		const v = atk * 1.1 + def + center;
		const sure = atk >= 100000 || def >= (wide ? 5000 : 3000);
		const shake = s.lv >= 2 ? 0.03 : s.lv >= 1 ? 0.15 : 0.3;
		const val = sure ? v : v * (1 + rnd() * shake);
		if (val > bestV) {
			bestV = val;
			best = i;
		}
	}
	return best;
};

/** who の いちばん 長い 列。 */
export const gmLongest = (s: GmState, who: 1 | 2): number => {
	let best = 0;
	for (let i = 0; i < s.cells.length; i++) {
		if (s.cells[i] !== who) continue;
		for (const [dx, dy] of DIRS)
			best = Math.max(best, runAt(s.cells, i, who, dx, dy).cells.length);
	}
	return best;
};

export const gmScore = (s: GmState): number =>
	s.winner === 1
		? 1000 * (s.lv + 1) + Math.max(0, 40 - s.moves) * 20
		: gmLongest(s, 1) * 10;

/** その 空きマスが 相手の 四・開いた 三を 止める 手か（名無しの ひとこと用）。 */
export const gmBlocks = (s: GmState, i: number): boolean =>
	s.cells[i] === 0 && cellWorth(s.cells, i, s.turn === 1 ? 2 : 1) >= 2500;
