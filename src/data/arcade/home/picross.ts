// キリコの 家の ゲーム「おんJピクロス」（picross）の 決まり。板は ui/arcade/home/picross.ts、文は data/arcade/text.ts。
// - 方眼ノートの お絵かきロジック。行と 列の 数字は、塗る マスが 何個 ずつ 続くか。
// - 絵は 村の もの（ハート・草・>>1・豆腐ハウス・スレ・鯖缶・キリコの 蓄音機・ぷゆゆ）。やさしい 順に 出す。
// - どの 問題も 1行ずつの 理づめ（pxLineSolve）だけで とける（＝答えが 1つ）。sim/arcadeHome/picross.ts で たしかめる。
// - 持ち時間 PX.time 秒で、とけた 問題の 数を きそう。とくと 絵が 色つきで 出る（そのあいだ 時計は 止まる）。
// - 「判定」を あり に すると、まちがった マスを 塗った とき × が つき、PX.penalty 秒 へる。
// - スコア：とけた 問題ごとに 行×列×PX.perCell、ぜんぶ とけたら のこり 時間×PX.perSec を たす。
// DOM に 触らない（試験できる）。

export const PX = {
	/** 持ち時間（秒）。 */
	time: 180,
	/** 判定 ありで まちがえた ときに へる 秒。 */
	penalty: 10,
	/** とけた 絵を 見せる 秒（時計は 止まる）。 */
	reveal: 2.4,
	/** 1マス あたりの 点（5x5 で 100点、10x10 で 400点）。 */
	perCell: 4,
	/** ぜんぶ とけた ときの のこり 1秒 あたりの 点。 */
	perSec: 5,
} as const;

/** 板の 字。 */
export const PX_TEXT = {
	mode: "押すと",
	paint: "塗る",
	cross: "×",
	judge: "判定",
	on: "あり",
	off: "なし",
	miss: "-10秒",
	solvedN: "完成 {n}",
	done: "「{name}」が　できた！",
} as const;

/** 問題（rows は 1行 1文字列。「.」は 塗らない、ほかの 字は ink の 色で 塗る）。 */
export type PxPuzzle = {
	name: string;
	rows: readonly string[];
	ink: Readonly<Record<string, string>>;
};

export const PX_PUZZLES: readonly PxPuzzle[] = [
	{
		name: "ハート",
		rows: [".R.R.", "RRRRR", "RRRRR", ".RRR.", "..R.."],
		ink: { R: "#e04060" },
	},
	{
		name: "草",
		rows: ["G...G", "G.G.G", "GGGGG", ".GGG.", "..G.."],
		ink: { G: "#40c050" },
	},
	{
		name: ">>1",
		rows: [
			"BB.BB...B.",
			".BB.BB.BB.",
			"..BB.BB.B.",
			".BB.BB..B.",
			"BB.BB..BBB",
		],
		ink: { B: "#4060e0" },
	},
	{
		name: "豆腐ハウス",
		rows: [
			"........",
			".WWWWWW.",
			".W.WW.W.",
			".WWWWWW.",
			".WW..WW.",
			".WW..WW.",
			"GGGGGGGG",
		],
		ink: { W: "#e8e4d4", G: "#50a040" },
	},
	{
		name: "スレ",
		rows: [
			"KKKKK..",
			"K...KK.",
			"K...KKK",
			"K.....K",
			"K.LLL.K",
			"K.....K",
			"K.LLL.K",
			"KKKKKKK",
		],
		ink: { K: "#505868", L: "#4070d0" },
	},
	{
		name: "鯖缶",
		rows: [
			".SSSSSS.",
			"SSSSSSSS",
			"S......S",
			"S.BBB.BS",
			"SB.BBBBS",
			"S.BBB.BS",
			"S......S",
			".SSSSSS.",
		],
		ink: { S: "#a8b0b8", B: "#3878b0" },
	},
	{
		name: "キリコの　蓄音機",
		rows: [
			"......GGGG",
			".....GG..G",
			"....GG...G",
			"....G...GG",
			"...GG.GGG.",
			"...GGGG...",
			"...G......",
			"DDDDDDDD..",
			"BBBBBBBBB.",
			"BB.....BB.",
		],
		ink: { G: "#d8a830", D: "#202020", B: "#8a5a30" },
	},
	{
		name: "ぷゆゆ",
		rows: [
			"...YYYY...",
			"..YYYYYY..",
			".YYYYYYYY.",
			"YYEEYYEEYY",
			"YYE.YYE.YY",
			"YYEEYYEEYY",
			"YTYYYYYYTY",
			"YTYY..YYTY",
			".YYYYYYYY.",
			"..YYYYYY..",
		],
		ink: { Y: "#f0c838", E: "#2a1408", T: "#60a8f0" },
	},
];

export const pxW = (p: PxPuzzle): number => p.rows[0].length;
export const pxH = (p: PxPuzzle): number => p.rows.length;
/** 答え（塗る マスか）。 */
export const pxFilled = (p: PxPuzzle, x: number, y: number): boolean =>
	p.rows[y][x] !== ".";

/** 1列の 数字（塗りが 続く 長さ。何も なければ [0]）。 */
const runs = (line: readonly boolean[]): number[] => {
	const r: number[] = [];
	let n = 0;
	for (const f of line) {
		if (f) n++;
		else if (n) {
			r.push(n);
			n = 0;
		}
	}
	if (n) r.push(n);
	return r.length ? r : [0];
};

/** 行と 列の 数字。 */
export const pxClues = (
	p: PxPuzzle,
): { rows: number[][]; cols: number[][] } => {
	const w = pxW(p);
	const h = pxH(p);
	const rows: number[][] = [];
	const cols: number[][] = [];
	for (let y = 0; y < h; y++)
		rows.push(runs(Array.from({ length: w }, (_, x) => pxFilled(p, x, y))));
	for (let x = 0; x < w; x++)
		cols.push(runs(Array.from({ length: h }, (_, y) => pxFilled(p, x, y))));
	return { rows, cols };
};

/**
 * 1列の 理づめ（-1 わからない・0 塗らない・1 塗る）。
 * 数字に あう 置き方を ぜんぶ 数えて、どの 置き方でも 同じ マスを 決める。あう 置き方が なければ null。
 */
export const pxLineSolve = (
	clue: readonly number[],
	line: readonly number[],
): number[] | null => {
	const n = line.length;
	const blocks = clue[0] === 0 ? [] : clue;
	const canFill = Array(n).fill(false);
	const canEmpty = Array(n).fill(false);
	const cur: number[] = Array(n).fill(0);
	let any = false;
	const place = (bi: number, from: number): void => {
		if (bi === blocks.length) {
			for (let i = from; i < n; i++) if (line[i] === 1) return;
			any = true;
			for (let i = 0; i < n; i++) {
				const f = i < from ? cur[i] === 1 : false;
				if (f) canFill[i] = true;
				else canEmpty[i] = true;
			}
			return;
		}
		const len = blocks[bi];
		let rest = 0;
		for (let k = bi + 1; k < blocks.length; k++) rest += blocks[k] + 1;
		for (let s = from; s + len + rest <= n; s++) {
			// s より 前は 空き
			if (s > from && line[s - 1] === 1) break;
			let fit = true;
			for (let i = s; i < s + len; i++) if (line[i] === 0) fit = false;
			const end = s + len;
			if (end < n && line[end] === 1) fit = false;
			if (fit) {
				for (let i = from; i < s; i++) cur[i] = 0;
				for (let i = s; i < end; i++) cur[i] = 1;
				if (end < n) cur[end] = 0;
				place(bi + 1, Math.min(n, end + 1));
			}
		}
	};
	place(0, 0);
	if (!any) return null;
	return line.map((v, i) =>
		v !== -1 ? v : canFill[i] && !canEmpty[i] ? 1 : !canFill[i] ? 0 : -1,
	);
};

/** 行と 列の 理づめを くり返す（[y][x]。決まらない マスは -1 の まま。矛盾なら null）。 */
export const pxSolve = (p: PxPuzzle): number[][] | null => {
	const { rows, cols } = pxClues(p);
	const w = pxW(p);
	const h = pxH(p);
	const g = Array.from({ length: h }, () => Array(w).fill(-1) as number[]);
	for (let changed = true; changed; ) {
		changed = false;
		for (let y = 0; y < h; y++) {
			const r = pxLineSolve(rows[y], g[y]);
			if (!r) return null;
			for (let x = 0; x < w; x++)
				if (r[x] !== g[y][x]) {
					g[y][x] = r[x];
					changed = true;
				}
		}
		for (let x = 0; x < w; x++) {
			const r = pxLineSolve(
				cols[x],
				g.map((row) => row[x]),
			);
			if (!r) return null;
			for (let y = 0; y < h; y++)
				if (r[y] !== g[y][x]) {
					g[y][x] = r[y];
					changed = true;
				}
		}
	}
	return g;
};

/** マス：0 空き・1 塗った・2 ×（自分で つけた）・3 ×（判定で まちがい。さわれない）。 */
export type PxCell = 0 | 1 | 2 | 3;
export type PxMode = "paint" | "cross";

export type PxState = {
	/** いまの 問題（PX_PUZZLES の 番号）。 */
	i: number;
	/** [y][x]。 */
	cells: PxCell[][];
	/** のこり 時間（秒）。 */
	t: number;
	strict: boolean;
	/** とけた 問題の 番号。 */
	solved: number[];
	/** とけた 絵を 見せる のこり 秒（0 なら とき中）。 */
	reveal: number;
	misses: number;
	over: boolean;
};

export type PxEvent =
	| "paint"
	| "erase"
	| "cross"
	| "uncross"
	| "miss"
	| "solve"
	| "next"
	| "all"
	| "timeup";

const blank = (p: PxPuzzle): PxCell[][] =>
	Array.from({ length: pxH(p) }, () => Array(pxW(p)).fill(0) as PxCell[]);

export const pxStart = (strict = false): PxState => ({
	i: 0,
	cells: blank(PX_PUZZLES[0]),
	t: PX.time,
	strict,
	solved: [],
	reveal: 0,
	misses: 0,
	over: false,
});

export const pxPuzzle = (s: PxState): PxPuzzle => PX_PUZZLES[s.i];

/** 塗った マスが 答えと ぴったりか。 */
export const pxIsSolved = (s: PxState): boolean => {
	const p = pxPuzzle(s);
	for (let y = 0; y < pxH(p); y++)
		for (let x = 0; x < pxW(p); x++)
			if ((s.cells[y][x] === 1) !== pxFilled(p, x, y)) return false;
	return true;
};

/**
 * マスに 手を 入れる。to を わたすと その 状態に そろえる（A を 押しながら 動かす とき）。
 * わたさなければ 切りかえ（塗る ⇔ 空き、× ⇔ 空き）。
 */
export const pxApply = (
	s: PxState,
	x: number,
	y: number,
	mode: PxMode,
	to?: boolean,
): PxEvent[] => {
	if (s.over || s.reveal > 0) return [];
	const p = pxPuzzle(s);
	if (x < 0 || y < 0 || x >= pxW(p) || y >= pxH(p)) return [];
	const c = s.cells[y][x];
	if (c === 3) return [];
	const mark: PxCell = mode === "paint" ? 1 : 2;
	const on = to ?? c !== mark;
	if (on) {
		// ほかの しるしの 上には つけない（先に 消す）
		if (c !== 0) return [];
		if (mark === 1 && s.strict && !pxFilled(p, x, y)) {
			s.cells[y][x] = 3;
			s.misses++;
			s.t = Math.max(0, s.t - PX.penalty);
			return ["miss"];
		}
		s.cells[y][x] = mark;
	} else {
		if (c !== mark) return [];
		s.cells[y][x] = 0;
	}
	if (mark === 2) return [on ? "cross" : "uncross"];
	const ev: PxEvent[] = [on ? "paint" : "erase"];
	// 消して ぴったりに なる ことも ある（判定 なしで まちがえた とき）
	if (pxIsSolved(s)) {
		s.solved.push(s.i);
		s.reveal = PX.reveal;
		ev.push("solve");
	}
	return ev;
};

/** 時計（絵を 見せて いる あいだは 止まり、おわったら 次の 問題へ）。 */
export const pxTick = (s: PxState, dt: number): PxEvent[] => {
	if (s.over) return [];
	if (s.reveal > 0) {
		s.reveal -= dt;
		if (s.reveal > 0) return [];
		s.reveal = 0;
		if (s.i + 1 >= PX_PUZZLES.length) {
			s.over = true;
			return ["all"];
		}
		s.i++;
		s.cells = blank(PX_PUZZLES[s.i]);
		return ["next"];
	}
	s.t -= dt;
	if (s.t <= 0) {
		s.t = 0;
		s.over = true;
		return ["timeup"];
	}
	return [];
};

export const pxTimeLeft = (s: PxState): number => Math.max(0, Math.ceil(s.t));
export const pxAllSolved = (s: PxState): boolean =>
	s.solved.length === PX_PUZZLES.length;
export const pxScore = (s: PxState): number => {
	let n = 0;
	for (const i of s.solved) {
		const p = PX_PUZZLES[i];
		n += pxW(p) * pxH(p) * PX.perCell;
	}
	return n + (pxAllSolved(s) ? pxTimeLeft(s) * PX.perSec : 0);
};
