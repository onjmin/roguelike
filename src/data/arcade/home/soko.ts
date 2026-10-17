// キリコの 家の ゲーム「過去ログ倉庫番」（soko）の 決まり。板は ui/arcade/home/soko.ts、文は data/arcade/text.ts。
// - 過去ログ 倉庫の 倉庫番。「dat」の 段ボールを 押して、棚の 印の 上へ ぜんぶ 運ぶと 1面 クリア。
// - 押せるのは 1箱 だけ（2箱 つづきや 壁の 前は 押せない）。引くことは できない。
// - 1手 もどす は 何回でも。やりなおし で その面の はじめに もどる（手数も 0 に）。
// - 時間の かぎりは ない。B で やめても それまでの 点は のこる。
// - スコア：1面ごとに SK.base ＋ max(0, 最短×2 − 手数)×SK.perMove。
// - 面は 手で 作った もの。どの 面も skSolve（箱の 位置と キリコの 位置の BFS）で とけて、最短が par と 同じ（sim/arcadeHome/soko.ts）。
// DOM に 触らない（試験できる）。

export const SK = {
	base: 300,
	perMove: 10,
	/** 面を クリアして 次へ 行く までの 秒。 */
	clearWait: 1.8,
} as const;

/** 板の 字。 */
export const SK_TEXT = {
	box: "dat",
	undo: "もどす",
	reset: "やりなおし",
	level: "{n}面",
	moves: "手数 {n}",
	par: "最短 {n}",
	clear: "{n}手でしまえた！",
	best: "最短でしまえた！",
	all: "ぜんぶしまえた！",
	note: "やめてもそれまでの点はのこる",
} as const;

/** 面（# 壁・. 印・$ 箱・* 印の 上の 箱・@ キリコ・+ 印の 上の キリコ）。par は 最短の 手数。 */
export type SkLevel = { rows: readonly string[]; par: number };

export const SK_LEVELS: readonly SkLevel[] = [
	{ rows: ["#######", "#@ $ .#", "#######"], par: 3 },
	{
		rows: [" #####", " #. .#", " #$ $#", "##   #", "#  @ #", "######"],
		par: 7,
	},
	{
		rows: ["#####", "#@  #", "# $ ###", "##  . #", " #    #", " ######"],
		par: 8,
	},
	{ rows: ["#######", "#     #", "#$# #$#", "#+   .#", "#######"], par: 13 },
	{
		rows: ["####", "#. #", "#  ###", "#*@  #", "#  $ #", "#  ###", "####"],
		par: 14,
	},
	{
		rows: [
			"######",
			"#    #",
			"# #@ #",
			"# $* #",
			"# .* #",
			"#    #",
			"######",
		],
		par: 16,
	},
	{
		rows: [
			" ######",
			"##    #",
			"# $## #",
			"# .  .#",
			"##*# $#",
			" #@   #",
			" ######",
		],
		par: 22,
	},
	{
		rows: [
			"########",
			"#   #  #",
			"# $.   #",
			"### ## #",
			"#  . $ #",
			"# @ #  #",
			"########",
		],
		par: 23,
	},
	{
		rows: [
			"########",
			"#  #   #",
			"# . $# #",
			"##$#.$ #",
			"#   .# #",
			"#  #  @#",
			"########",
		],
		par: 27,
	},
	{
		rows: [" #####", "##   #", "# $#@#", "# *  #", "#  . #", "######"],
		par: 28,
	},
];

export type SkDir = "up" | "right" | "down" | "left";
const SK_DIRS: readonly (readonly [number, number])[] = [
	[0, -1],
	[1, 0],
	[0, 1],
	[-1, 0],
];

/** 面の 形（壁・印は 変わらない）。 */
export type SkMap = {
	w: number;
	h: number;
	/** [y*w+x]。外（壁の 外の 空き）も 壁に する。 */
	wall: boolean[];
	goal: boolean[];
	boxes: number[];
	p: number;
};

export const skParse = (lv: SkLevel): SkMap => {
	const h = lv.rows.length;
	const w = Math.max(...lv.rows.map((r) => r.length));
	const wall: boolean[] = [];
	const goal: boolean[] = [];
	const boxes: number[] = [];
	let p = 0;
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const c = lv.rows[y][x] ?? "#";
			const i = y * w + x;
			wall.push(c === "#");
			goal.push(c === "." || c === "*" || c === "+");
			if (c === "$" || c === "*") boxes.push(i);
			if (c === "@" || c === "+") p = i;
		}
	// キリコから 行けない 空き（壁の 外）は 壁に
	const reach = new Set([p]);
	const st = [p];
	while (st.length) {
		const c = st.pop() as number;
		for (const [dx, dy] of SK_DIRS) {
			const x = (c % w) + dx;
			const y = Math.floor(c / w) + dy;
			const n = y * w + x;
			if (x < 0 || y < 0 || x >= w || y >= h || wall[n] || reach.has(n))
				continue;
			reach.add(n);
			st.push(n);
		}
	}
	for (let i = 0; i < w * h; i++) if (!reach.has(i)) wall[i] = true;
	return { w, h, wall, goal, boxes, p };
};

const DIR_OF: Record<SkDir, readonly [number, number]> = {
	up: SK_DIRS[0],
	right: SK_DIRS[1],
	down: SK_DIRS[2],
	left: SK_DIRS[3],
};

/** 1手（動けないなら null。押したら pushed）。 */
const stepOn = (
	m: SkMap,
	p: number,
	boxes: readonly number[],
	dx: number,
	dy: number,
): { p: number; boxes: number[]; pushed: boolean } | null => {
	const x = (p % m.w) + dx;
	const y = Math.floor(p / m.w) + dy;
	if (x < 0 || y < 0 || x >= m.w || y >= m.h) return null;
	const n = y * m.w + x;
	if (m.wall[n]) return null;
	const bi = boxes.indexOf(n);
	if (bi < 0) return { p: n, boxes: boxes.slice(), pushed: false };
	const x2 = x + dx;
	const y2 = y + dy;
	if (x2 < 0 || y2 < 0 || x2 >= m.w || y2 >= m.h) return null;
	const n2 = y2 * m.w + x2;
	if (m.wall[n2] || boxes.includes(n2)) return null;
	const nb = boxes.slice();
	nb[bi] = n2;
	return { p: n, boxes: nb, pushed: true };
};

const allIn = (m: SkMap, boxes: readonly number[]): boolean =>
	boxes.every((i) => m.goal[i]);

/** 最短の 手数（とけなければ -1）。BFS は limit の 局面で うちきる。 */
export const skSolve = (lv: SkLevel, limit = 50000): number => {
	const m = skParse(lv);
	const key = (p: number, b: readonly number[]) =>
		`${p}:${[...b].sort((a, c) => a - c).join(",")}`;
	const seen = new Set([key(m.p, m.boxes)]);
	let q = [{ p: m.p, boxes: m.boxes }];
	for (let d = 0; q.length; d++) {
		const nq: typeof q = [];
		for (const s of q) {
			if (allIn(m, s.boxes)) return d;
			for (const [dx, dy] of SK_DIRS) {
				const r = stepOn(m, s.p, s.boxes, dx, dy);
				if (!r) continue;
				const k = key(r.p, r.boxes);
				if (seen.has(k)) continue;
				seen.add(k);
				if (seen.size > limit) return -1;
				nq.push(r);
			}
		}
		q = nq;
	}
	return -1;
};

export type SkState = {
	/** いまの 面（SK_LEVELS の 番号）。 */
	li: number;
	map: SkMap;
	p: number;
	boxes: number[];
	/** 1手 もどす ための 前の 局面。 */
	hist: { p: number; boxes: number[] }[];
	moves: number;
	/** 向き（キリコの 絵）。 */
	face: SkDir;
	/** クリアした 面の 手数。 */
	done: { li: number; moves: number }[];
	/** クリアの 字を 出す のこり 秒（0 なら 遊び中）。 */
	wait: number;
	over: boolean;
};

export type SkEvent =
	| "walk"
	| "push"
	| "goal"
	| "bump"
	| "undo"
	| "reset"
	| "clear"
	| "next"
	| "all";

const load = (s: SkState, li: number): void => {
	s.li = li;
	s.map = skParse(SK_LEVELS[li]);
	s.p = s.map.p;
	s.boxes = s.map.boxes.slice();
	s.hist = [];
	s.moves = 0;
	s.face = "down";
};

export const skStart = (li = 0): SkState => {
	const s = {
		done: [],
		wait: 0,
		over: false,
	} as unknown as SkState;
	load(s, li);
	return s;
};

export const skLevel = (s: SkState): SkLevel => SK_LEVELS[s.li];

/** 1面の 点。 */
export const skLevelScore = (par: number, moves: number): number =>
	SK.base + Math.max(0, par * 2 - moves) * SK.perMove;

export const skScore = (s: SkState): number =>
	s.done.reduce((n, d) => n + skLevelScore(SK_LEVELS[d.li].par, d.moves), 0);

/** 1歩（箱が あれば 押す）。 */
export const skMove = (s: SkState, dir: SkDir): SkEvent[] => {
	if (s.over || s.wait > 0) return [];
	s.face = dir;
	const [dx, dy] = DIR_OF[dir];
	const r = stepOn(s.map, s.p, s.boxes, dx, dy);
	if (!r) return ["bump"];
	s.hist.push({ p: s.p, boxes: s.boxes });
	s.p = r.p;
	s.boxes = r.boxes;
	s.moves++;
	if (!r.pushed) return ["walk"];
	const ev: SkEvent[] = ["push"];
	const moved = r.boxes.find(
		(b, i) => b !== s.hist[s.hist.length - 1].boxes[i],
	);
	if (moved !== undefined && s.map.goal[moved]) ev.push("goal");
	if (allIn(s.map, s.boxes)) {
		s.done.push({ li: s.li, moves: s.moves });
		s.wait = SK.clearWait;
		ev.push("clear");
	}
	return ev;
};

/** 1手 もどす（手数も 1 へる）。 */
export const skUndo = (s: SkState): SkEvent[] => {
	if (s.over || s.wait > 0) return [];
	const h = s.hist.pop();
	if (!h) return ["bump"];
	s.p = h.p;
	s.boxes = h.boxes;
	s.moves--;
	return ["undo"];
};

/** その面の はじめから。 */
export const skReset = (s: SkState): SkEvent[] => {
	if (s.over || s.wait > 0 || !s.moves) return [];
	load(s, s.li);
	return ["reset"];
};

/** クリアの あと 少し 待って 次の 面へ（ぜんぶ なら おわり）。 */
export const skTick = (s: SkState, dt: number): SkEvent[] => {
	if (s.over || s.wait <= 0) return [];
	s.wait -= dt;
	if (s.wait > 0) return [];
	s.wait = 0;
	if (s.li + 1 >= SK_LEVELS.length) {
		s.over = true;
		return ["all"];
	}
	load(s, s.li + 1);
	return ["next"];
};
