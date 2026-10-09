// リバーシ（スレ「オセロの時間です」「【オセロ】敗北を知りたい」の 盤の 遊び。画面には 一般名の リバーシと 出す）。
// 碁会所の 常連と 打つ。コードの 名前は othello の まま（画面に 出ない）。
// ふつうの 8×8 の 決まり：黒（キリコ）が 先手、はさめる 所に だけ 打てる、打てなければ パス、両方 打てなければ おわり。
// 常連の 手（othelloAi）は 1手 読み：マスの 重み ＋ 返す 数 − 相手の 打てる 数 ＋ 少しの 乱数。
// 角を 取りに 行き、角の となりは いやがる。かんたんな 打ち方の 人なら 4割 ほど 勝てる 強さ。DOM も 保存も 使わない。

export type Disc = 0 | 1 | 2;
/** 1＝黒（キリコ）、2＝白（常連）。 */
export type Color = 1 | 2;
/** 64マス（index = y * 8 + x）。 */
export type OBoard = readonly Disc[];

export const BLACK: Color = 1;
export const WHITE: Color = 2;
export const CORNERS: readonly number[] = [0, 7, 56, 63];

/** マスの 重み（角 100・角の 斜め となり −40・角の となり −20）。 */
export const OTHELLO_W: readonly number[] = [
	100, -20, 10, 5, 5, 10, -20, 100, -20, -40, -2, -2, -2, -2, -40, -20, 10, -2,
	2, 1, 1, 2, -2, 10, 5, -2, 1, 0, 0, 1, -2, 5, 5, -2, 1, 0, 0, 1, -2, 5, 10,
	-2, 2, 1, 1, 2, -2, 10, -20, -40, -2, -2, -2, -2, -40, -20, 100, -20, 10, 5,
	5, 10, -20, 100,
];

const DIRS: readonly (readonly [number, number])[] = [
	[-1, -1],
	[0, -1],
	[1, -1],
	[-1, 0],
	[1, 0],
	[-1, 1],
	[0, 1],
	[1, 1],
];

/** はじめの 盤（d4 白・e4 黒・d5 黒・e5 白）。 */
export const othelloStart = (): Disc[] => {
	const b: Disc[] = new Array(64).fill(0);
	b[27] = WHITE;
	b[28] = BLACK;
	b[35] = BLACK;
	b[36] = WHITE;
	return b;
};

/** at に me が 打つと 返る 石（打てなければ 空）。 */
export const flipsOf = (b: OBoard, at: number, me: Color): number[] => {
	if (at < 0 || at > 63 || b[at] !== 0) return [];
	const op = me === BLACK ? WHITE : BLACK;
	const x0 = at % 8;
	const y0 = Math.floor(at / 8);
	const out: number[] = [];
	for (const [dx, dy] of DIRS) {
		const run: number[] = [];
		let x = x0 + dx;
		let y = y0 + dy;
		while (x >= 0 && x < 8 && y >= 0 && y < 8 && b[y * 8 + x] === op) {
			run.push(y * 8 + x);
			x += dx;
			y += dy;
		}
		if (run.length && x >= 0 && x < 8 && y >= 0 && y < 8 && b[y * 8 + x] === me)
			out.push(...run);
	}
	return out;
};

export const legalMoves = (b: OBoard, me: Color): number[] => {
	const out: number[] = [];
	for (let i = 0; i < 64; i++) if (flipsOf(b, i, me).length) out.push(i);
	return out;
};

/** 打った あとの 盤（打てない 手なら そのまま）。 */
export const othelloPlay = (b: OBoard, at: number, me: Color): Disc[] => {
	const f = flipsOf(b, at, me);
	const n = [...b];
	if (!f.length) return n;
	for (const i of f) n[i] = me;
	n[at] = me;
	return n;
};

export const countDiscs = (b: OBoard): { black: number; white: number } => {
	let black = 0;
	let white = 0;
	for (const d of b) {
		if (d === BLACK) black++;
		else if (d === WHITE) white++;
	}
	return { black, white };
};

/** どちらも 打てない（おわり）。 */
export const othelloOver = (b: OBoard): boolean =>
	legalMoves(b, BLACK).length === 0 && legalMoves(b, WHITE).length === 0;

/** 常連の 手（打てなければ null）。rand は 0〜1（板は Math.random、試験は 種つき）。 */
export const othelloAi = (
	b: OBoard,
	me: Color,
	rand: () => number,
): number | null => {
	const ms = legalMoves(b, me);
	if (!ms.length) return null;
	const op = me === BLACK ? WHITE : BLACK;
	let best: number | null = null;
	let bs = Number.NEGATIVE_INFINITY;
	for (const m of ms) {
		const after = othelloPlay(b, m, me);
		const s =
			OTHELLO_W[m] +
			2 * flipsOf(b, m, me).length -
			3 * legalMoves(after, op).length +
			rand() * 6;
		if (s > bs) {
			bs = s;
			best = m;
		}
	}
	return best;
};
