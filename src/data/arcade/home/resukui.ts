// キリコの 家の ゲーム「レス食い」（resukui）の 決まり。板は ui/arcade/home/resukui.ts、文は data/arcade/text.ts。
// - 迷路の レス（点）を キリコが 食べて すすむ。ぜんぶ 食べると 段が 上がり、みんな すこし 速くなる。
// - 荒らしは 4人：まっすぐ 追う・先回り・気まぐれ・はずかしがり（近づくと 逃げる）。
// - 「通報」を 食べると しばらく 荒らしが 青く なって 逃げる。食べると 200・400・800・1600。
//   食べられた 荒らしは 目だけに なって 巣へ 戻り、また 出てくる。
// - ときどき まんなかの 下に「草」が 生える（食べると 点）。左右の 抜け道は 反対へ つながる。
// - 青く ない 荒らしに ふれると 1機 へる。3機 なくなると おわり。
// - スコア＝レス 10・通報 50・荒らし・草 の 合計。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import { AH, ATOP, AW, type Rnd } from "../logic";

/** 迷路（# 壁・. レス・o 通報・- 巣の 戸・G 巣・空白 なにもない）。左右の はしが 開いた 行は 抜け道。 */
export const RK_MAZE: readonly string[] = [
	"###################",
	"#o.......#.......o#",
	"#.##.###.#.###.##.#",
	"#.................#",
	"#.##.#.##-##.#.##.#",
	"#....#.#GGG#.#....#",
	"####.#.#####.#.####",
	"......... .........",
	"####.#.#####.#.####",
	"#........#........#",
	"#.##.###.#.###.##.#",
	"#o.#...........#.o#",
	"#..#.#.#####.#.#..#",
	"#.................#",
	"###################",
];

export const RK = {
	cols: 19,
	rows: 15,
	/** 1マスの 大きさ（画素）。 */
	cell: 9,
	/** キリコの はじめの マス。 */
	start: [9, 7] as const,
	/** 巣の 出口（戸の 上）と 巣の まんなか。 */
	exit: [9, 3] as const,
	home: [9, 5] as const,
	/** 草の 生える マス。 */
	bonus: [9, 11] as const,
	/** 1秒に すすむ マス（キリコ・荒らし・青い 荒らし・目・抜け道の 荒らし）。 */
	speed: 6.2,
	ghost: 5.6,
	fright: 3.4,
	eyes: 12,
	tunnel: 3,
	/** 段 ごとに 速く なる 割合と 上限。 */
	levelUp: 0.07,
	levelMax: 1.45,
	/** 青い 時間（段 1・段 ごとに 縮む・いちばん 短い）。 */
	frightTime: 7,
	frightDown: 1,
	frightMin: 2,
	/** 荒らしの 点（つづけて 食べると 倍）。 */
	chain: [200, 400, 800, 1600],
	dot: 10,
	pellet: 50,
	/** 草が 生える 食べた 数と 出ている 秒。 */
	bonusAt: [50, 110],
	bonusLife: 9,
	lives: 3,
	/** やられた・段を 上げる ときの 間（秒）と、はじまる 前の 間。 */
	dieTime: 1.4,
	clearTime: 1.6,
	readyTime: 1,
	/** 荒らしが 巣から 出る 秒（4人ぶん）。 */
	release: [0, 1, 4, 7],
	/** 追う・ばらける の 切りかえ（秒。おわりは ずっと 追う）。 */
	modes: [5, 20, 5, 20, 4],
	/** はずかしがりが 逃げだす 近さ（マス）。 */
	shy: 6,
} as const;

/** 板の 字。 */
export const RK_TEXT = {
	pellet: "通",
	bonus: "草",
	level: "段",
	next: "次の　段へ",
	caught: "通報　された…",
} as const;

/** 向き：0 上・1 右・2 下・3 左。 */
export type RkDir = 0 | 1 | 2 | 3;
export const RK_DIRS: readonly (readonly [number, number])[] = [
	[0, -1],
	[1, 0],
	[0, 1],
	[-1, 0],
];

/** マスを 動く もの（x, y の マスから dir へ t だけ 進んだ）。 */
export type RkMover = { x: number; y: number; dir: RkDir; t: number };

/** 荒らしの ようす：巣で 待つ・巣を 出る・ふつう・目だけ。 */
export type RkGhostMode = "house" | "leave" | "out" | "eyes";
export type RkGhost = RkMover & {
	/** 0 追う・1 先回り・2 気まぐれ・3 はずかしがり。 */
	kind: 0 | 1 | 2 | 3;
	mode: RkGhostMode;
	/** 青い（逃げる）か。 */
	blue: boolean;
	/** 巣を 出るまでの 秒。 */
	wait: number;
};

export type RkPop = { x: number; y: number; text: string; t: number };
export type RkState = {
	t: number;
	level: number;
	lives: number;
	points: number;
	/** レスと 通報（行ごと。. o 空白）。 */
	dots: string[][];
	left: number;
	eaten: number;
	pac: RkMover;
	/** 押された 向き（曲がれる ところで 曲がる）。 */
	want: RkDir;
	ghosts: RkGhost[];
	/** 青い 残り 秒と その あいだに 食べた 数。 */
	fright: number;
	chain: number;
	/** 追う・ばらける の 時計。 */
	modeT: number;
	bonus: { t: number } | null;
	bonusDone: number;
	/** 止まる 間（ready・die・clear）。 */
	pause: number;
	phase: "ready" | "play" | "die" | "clear";
	pops: RkPop[];
	over: boolean;
};
export type RkEvent =
	| "dot"
	| "pellet"
	| "ghost"
	| "bonus"
	| "bonusShow"
	| "die"
	| "clear"
	| "level"
	| "over";

const wrapX = (x: number): number => ((x % RK.cols) + RK.cols) % RK.cols;
const at = (x: number, y: number): string =>
	y < 0 || y >= RK.rows ? "#" : RK_MAZE[y][wrapX(x)];

/** キリコが 通れるか。 */
export const rkOpen = (x: number, y: number): boolean => {
	const c = at(x, y);
	return c !== "#" && c !== "-" && c !== "G";
};
/** 荒らしが 通れるか（巣を 出る・戻る ときは 戸と 巣も）。 */
const ghostOpen = (g: RkGhost, x: number, y: number): boolean => {
	const c = at(x, y);
	if (c === "#") return false;
	if (c === "-" || c === "G") return g.mode === "leave" || g.mode === "eyes";
	return true;
};

const freshDots = (): string[][] =>
	RK_MAZE.map((row) => [...row].map((c) => (c === "." || c === "o" ? c : " ")));
const countDots = (d: string[][]): number =>
	d.reduce((n, r) => n + r.filter((c) => c !== " ").length, 0);

const placeAll = (s: RkState): void => {
	s.pac = { x: RK.start[0], y: RK.start[1], dir: 3, t: 0 };
	s.want = 3;
	const homes: [number, number][] = [
		[RK.exit[0], RK.exit[1]],
		[9, 5],
		[8, 5],
		[10, 5],
	];
	s.ghosts = homes.map(([x, y], i) => ({
		x,
		y,
		dir: (i === 0 ? 3 : 0) as RkDir,
		t: 0,
		kind: i as 0 | 1 | 2 | 3,
		mode: i === 0 ? "out" : "house",
		blue: false,
		wait: RK.release[i] / Math.min(2, 1 + (s.level - 1) * 0.25),
	}));
	s.fright = 0;
	s.chain = 0;
	s.modeT = 0;
	s.pause = RK.readyTime;
	s.phase = "ready";
};

export const rkStart = (): RkState => {
	const dots = freshDots();
	const s: RkState = {
		t: 0,
		level: 1,
		lives: RK.lives,
		points: 0,
		dots,
		left: countDots(dots),
		eaten: 0,
		pac: { x: 0, y: 0, dir: 3, t: 0 },
		want: 3,
		ghosts: [],
		fright: 0,
		chain: 0,
		modeT: 0,
		bonus: null,
		bonusDone: 0,
		pause: 0,
		phase: "ready",
		pops: [],
		over: false,
	};
	placeAll(s);
	return s;
};

/** 段の 速さの 倍。 */
export const rkPace = (s: RkState): number =>
	Math.min(RK.levelMax, 1 + (s.level - 1) * RK.levelUp);
/** 青い 時間。 */
export const rkFrightTime = (s: RkState): number =>
	Math.max(RK.frightMin, RK.frightTime - (s.level - 1) * RK.frightDown);
/** 草の 点。 */
export const rkBonusPts = (s: RkState): number =>
	Math.min(1000, 100 + (s.level - 1) * 200);
export const rkScore = (s: RkState): number => s.points;

/** 画面での 位置（マスの 単位。抜け道の はしでは 外へ はみ出る）。 */
export const rkPos = (m: RkMover): readonly [number, number] => {
	const [dx, dy] = RK_DIRS[m.dir];
	return [m.x + dx * m.t, m.y + dy * m.t];
};

/** 追う か（false は ばらける）。 */
const chasing = (s: RkState): boolean => {
	let t = s.modeT;
	for (let i = 0; i < RK.modes.length; i++) {
		if (t < RK.modes[i]) return i % 2 === 1;
		t -= RK.modes[i];
	}
	return true;
};

/** 荒らしの 目あての マス。 */
const target = (s: RkState, g: RkGhost): readonly [number, number] => {
	if (g.mode === "eyes") return RK.home;
	if (g.mode === "leave") return RK.exit;
	const p = s.pac;
	const corners: [number, number][] = [
		[RK.cols - 2, 0],
		[1, 0],
		[RK.cols - 2, RK.rows],
		[1, RK.rows],
	];
	if (!chasing(s)) return corners[g.kind];
	if (g.kind === 1) {
		const [dx, dy] = RK_DIRS[p.dir];
		return [p.x + dx * 4, p.y + dy * 4];
	}
	if (g.kind === 3) {
		const d = Math.hypot(g.x - p.x, g.y - p.y);
		return d > RK.shy ? [p.x, p.y] : corners[3];
	}
	return [p.x, p.y];
};

/** 荒らしが マスの まんなかで 次の 向きを 決める（逆には 戻らない。行きどまりだけ 戻る）。 */
const ghostTurn = (s: RkState, g: RkGhost, rnd: Rnd): void => {
	const opts: RkDir[] = [];
	for (const d of [0, 3, 2, 1] as RkDir[]) {
		if (d === (g.dir + 2) % 4) continue;
		const [dx, dy] = RK_DIRS[d];
		if (ghostOpen(g, g.x + dx, g.y + dy)) opts.push(d);
	}
	if (opts.length === 0) {
		g.dir = ((g.dir + 2) % 4) as RkDir;
		return;
	}
	// 青い とき と 気まぐれ（追う あいだの 半分）は でたらめ
	if (
		(g.blue && g.mode === "out") ||
		(g.kind === 2 && g.mode === "out" && rnd() < 0.6)
	) {
		g.dir = opts[Math.floor(rnd() * opts.length)];
		return;
	}
	const [tx, ty] = target(s, g);
	let best = opts[0];
	let bd = Number.POSITIVE_INFINITY;
	for (const d of opts) {
		const [dx, dy] = RK_DIRS[d];
		const dd = (g.x + dx - tx) ** 2 + (g.y + dy - ty) ** 2;
		if (dd < bd) {
			bd = dd;
			best = d;
		}
	}
	g.dir = best;
};

const ghostSpeed = (s: RkState, g: RkGhost): number => {
	if (g.mode === "eyes") return RK.eyes;
	const tun = g.y === 7 && (g.x <= 2 || g.x >= RK.cols - 3);
	if (tun) return RK.tunnel * rkPace(s);
	if (g.blue) return RK.fright;
	return RK.ghost * rkPace(s);
};

const eatAt = (s: RkState, x: number, y: number, ev: RkEvent[]): void => {
	const c = s.dots[y]?.[x];
	if (c === "." || c === "o") {
		s.dots[y][x] = " ";
		s.left--;
		s.eaten++;
		if (c === ".") {
			s.points += RK.dot;
			ev.push("dot");
		} else {
			s.points += RK.pellet;
			s.fright = rkFrightTime(s);
			s.chain = 0;
			for (const g of s.ghosts)
				if (g.mode === "out" || g.mode === "house" || g.mode === "leave") {
					g.blue = true;
					// 向きを 逆に（すぐ 逃げる）
					if (g.mode === "out" && g.t > 0) {
						const [dx, dy] = RK_DIRS[g.dir];
						g.x = wrapX(g.x + dx);
						g.y += dy;
						g.t = 1 - g.t;
						g.dir = ((g.dir + 2) % 4) as RkDir;
					}
				}
			ev.push("pellet");
		}
		if (s.bonusDone < RK.bonusAt.length && s.eaten >= RK.bonusAt[s.bonusDone]) {
			s.bonusDone++;
			s.bonus = { t: RK.bonusLife };
			ev.push("bonusShow");
		}
	}
	if (s.bonus && x === RK.bonus[0] && y === RK.bonus[1]) {
		const pts = rkBonusPts(s);
		s.points += pts;
		s.pops.push({ x, y, text: String(pts), t: 0 });
		s.bonus = null;
		ev.push("bonus");
	}
};

/** キリコを すすめる（曲がれる ところで 押された 向きへ）。 */
const movePac = (s: RkState, dist: number, ev: RkEvent[]): void => {
	const p = s.pac;
	// 逆向きは いつでも 戻れる
	if (p.t > 0 && s.want === (p.dir + 2) % 4) {
		const [dx, dy] = RK_DIRS[p.dir];
		p.x = wrapX(p.x + dx);
		p.y += dy;
		p.t = 1 - p.t;
		p.dir = s.want;
	}
	for (let guard = 0; dist > 0 && guard < 8; guard++) {
		if (p.t === 0) {
			const [wx, wy] = RK_DIRS[s.want];
			if (rkOpen(p.x + wx, p.y + wy)) p.dir = s.want;
			const [dx, dy] = RK_DIRS[p.dir];
			if (!rkOpen(p.x + dx, p.y + dy)) return;
		}
		const need = 1 - p.t;
		if (dist < need) {
			p.t += dist;
			return;
		}
		dist -= need;
		const [dx, dy] = RK_DIRS[p.dir];
		p.x = wrapX(p.x + dx);
		p.y += dy;
		p.t = 0;
		eatAt(s, p.x, p.y, ev);
	}
};

const moveGhost = (s: RkState, g: RkGhost, dist: number, rnd: Rnd): void => {
	for (let guard = 0; dist > 0 && guard < 8; guard++) {
		if (g.t === 0) {
			// 巣へ 戻った・巣を 出た
			if (g.mode === "eyes" && g.x === RK.home[0] && g.y === RK.home[1]) {
				g.mode = "leave";
				g.blue = false;
			}
			if (g.mode === "leave" && g.x === RK.exit[0] && g.y === RK.exit[1]) {
				g.mode = "out";
				g.dir = 3;
			}
			ghostTurn(s, g, rnd);
			const [dx, dy] = RK_DIRS[g.dir];
			if (!ghostOpen(g, g.x + dx, g.y + dy)) return;
		}
		const need = 1 - g.t;
		if (dist < need) {
			g.t += dist;
			return;
		}
		dist -= need;
		const [dx, dy] = RK_DIRS[g.dir];
		g.x = wrapX(g.x + dx);
		g.y += dy;
		g.t = 0;
	}
};

/** 2つの 位置の 近さ（抜け道の まわりこみも 見る）。 */
const near = (a: RkMover, b: RkMover): number => {
	const [ax, ay] = rkPos(a);
	const [bx, by] = rkPos(b);
	let dx = Math.abs(ax - bx);
	dx = Math.min(dx, RK.cols - dx);
	return Math.hypot(dx, ay - by);
};

export const rkStep = (
	s: RkState,
	dt: number,
	input: { dir: RkDir | null },
	rnd: Rnd,
): RkEvent[] => {
	const ev: RkEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	for (const p of s.pops) p.t += dt;
	s.pops = s.pops.filter((p) => p.t < 0.9);
	if (input.dir !== null) s.want = input.dir;
	if (s.phase !== "play") {
		s.pause -= dt;
		if (s.pause > 0) return ev;
		if (s.phase === "die") {
			s.lives--;
			if (s.lives <= 0) {
				s.over = true;
				ev.push("over");
				return ev;
			}
			placeAll(s);
		} else if (s.phase === "clear") {
			s.level++;
			s.dots = freshDots();
			s.left = countDots(s.dots);
			s.eaten = 0;
			s.bonusDone = 0;
			s.bonus = null;
			placeAll(s);
			ev.push("level");
		} else s.phase = "play";
		return ev;
	}
	s.modeT += dt;
	if (s.fright > 0) {
		s.fright -= dt;
		if (s.fright <= 0) {
			s.fright = 0;
			for (const g of s.ghosts) g.blue = false;
		}
	}
	if (s.bonus) {
		s.bonus.t -= dt;
		if (s.bonus.t <= 0) s.bonus = null;
	}
	movePac(s, RK.speed * rkPace(s) * dt, ev);
	if (s.left === 0) {
		s.phase = "clear";
		s.pause = RK.clearTime;
		ev.push("clear");
		return ev;
	}
	for (const g of s.ghosts) {
		if (g.mode === "house") {
			g.wait -= dt;
			if (g.wait <= 0) g.mode = "leave";
			continue;
		}
		moveGhost(s, g, ghostSpeed(s, g) * dt, rnd);
	}
	for (const g of s.ghosts) {
		if (g.mode !== "out" || near(s.pac, g) > 0.7) continue;
		if (g.blue) {
			const pts = RK.chain[Math.min(s.chain, RK.chain.length - 1)];
			s.chain++;
			s.points += pts;
			const [gx, gy] = rkPos(g);
			s.pops.push({ x: gx, y: gy, text: String(pts), t: 0 });
			g.mode = "eyes";
			g.blue = false;
			ev.push("ghost");
		} else {
			s.phase = "die";
			s.pause = RK.dieTime;
			ev.push("die");
			return ev;
		}
	}
	return ev;
};

/** 迷路の 左上（画面の 画素。帯の 下に まんなか ぞろえ）。 */
export const rkOrigin = (): readonly [number, number] => [
	Math.floor((AW - RK.cols * RK.cell) / 2),
	ATOP + Math.floor((AH - ATOP - RK.rows * RK.cell) / 2),
];
