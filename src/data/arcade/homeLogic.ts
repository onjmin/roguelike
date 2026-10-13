// キリコの 家に 置く ゲームの 決まり（2026-10-13 作者：「マイハウスに ミニゲーム系の 家具を。マリオみたいな
// 横スクロールや ボンバーマンみたいな ミニゲーム」）。板は ui/arcade/arcadeHome.ts、文は data/arcade/text.ts。
// DOM に 触らない（試験できる）。乱数は 渡された rnd（見た目の 乱数。冒険には 効かない）。
//
// - 横スクロール「スーパーキリコ」（platform）：右へ 走って 跳び、穴を こえ、ぷゆゆを 踏んで、🥺 を 集め、旗まで。
//   穴に 落ちるか、ぷゆゆに 横から ぶつかると おわり。スコア＝🥺×10＋踏んだ 数×30＋旗で のこり 時間×5。
// - ボンバー「荒らし爆破」（bomber）：迷路で 爆弾を 置き、レス（こわせる ブロック）と 荒らしを 吹きとばす。
//   爆風に 巻きこまれると おわり。荒らしを ぜんぶ たおすと クリア。スコア＝荒らし×100＋レス×10＋クリアで のこり 時間×10。

import { AH, ATOP, AW, type Rnd } from "./logic";

// ───────────────── 横スクロール ─────────────────

export const PF = {
	/** 1マスの 大きさ（画素）。 */
	cell: 12,
	/** コースの 長さ（マス）。 */
	length: 150,
	/** 地面の 高さ（下から マス）。 */
	ground: 2,
	speed: 66,
	jump: 210,
	gravity: 620,
	enemySpeed: 18,
	time: 90,
} as const;

/** 地面の 上の 段（行。0 が 上）。 */
const ROWS = Math.floor((AH - ATOP) / PF.cell);

export type PfEnemy = { x: number; y: number; vx: number; dead: number };
export type PfCoin = { x: number; y: number; got: boolean };
export type PfState = {
	t: number;
	/** キリコの 足もと（画素。x は コースの 左から、y は 地面からの 高さ）。 */
	x: number;
	y: number;
	vy: number;
	ground: boolean;
	/** 地面の 有無（マスごと）。 */
	floor: boolean[];
	/** 浮いた 足場（マス x・下からの 段）。 */
	blocks: { x: number; h: number }[];
	enemies: PfEnemy[];
	coins: PfCoin[];
	coinsGot: number;
	stomps: number;
	over: boolean;
	clear: boolean;
};
export type PfEvent = "jump" | "coin" | "stomp" | "fall" | "hit" | "goal";

export const pfStart = (rnd: Rnd): PfState => {
	const floor = Array.from({ length: PF.length }, () => true);
	const blocks: { x: number; h: number }[] = [];
	const enemies: PfEnemy[] = [];
	const coins: PfCoin[] = [];
	const c = PF.cell;
	for (let x = 12; x < PF.length - 14; ) {
		const r = rnd();
		if (r < 0.3) {
			// 穴（2〜3 マス）。手前に 🥺
			const w = 2 + Math.floor(rnd() * 2);
			for (let i = 0; i < w; i++) floor[x + i] = false;
			coins.push({ x: (x + w / 2) * c, y: c * 3.5, got: false });
			x += w + 4 + Math.floor(rnd() * 4);
		} else if (r < 0.6) {
			// 浮いた 足場（3 マス）と その 上の 🥺
			const h = 3 + Math.floor(rnd() * 2);
			for (let i = 0; i < 3; i++) blocks.push({ x: x + i, h });
			coins.push({ x: (x + 1.5) * c, y: (h + 1.5) * c, got: false });
			x += 6 + Math.floor(rnd() * 4);
		} else {
			// ぷゆゆ（左へ 歩く）
			enemies.push({ x: x * c, y: 0, vx: -PF.enemySpeed, dead: 0 });
			x += 6 + Math.floor(rnd() * 5);
		}
	}
	return {
		t: 0,
		x: c * 3,
		y: 0,
		vy: 0,
		ground: true,
		floor,
		blocks,
		enemies,
		coins,
		coinsGot: 0,
		stomps: 0,
		over: false,
		clear: false,
	};
};

/** その 画素 x の 下の 地面・足場の 高さ（無ければ null）。y より 上の 足場は 見ない。 */
const standAt = (s: PfState, x: number, y: number): number | null => {
	const c = PF.cell;
	const mx = Math.floor(x / c);
	let best: number | null = s.floor[mx] === false ? null : 0;
	for (const b of s.blocks)
		if (b.x === mx && b.h * c <= y + 0.5 && (best === null || b.h * c > best))
			best = b.h * c;
	return best;
};

export const pfGoalX = (): number => (PF.length - 6) * PF.cell;
export const pfTimeLeft = (s: PfState): number =>
	Math.max(0, Math.ceil(PF.time - s.t));
export const pfScore = (s: PfState): number =>
	s.coinsGot * 10 + s.stomps * 30 + (s.clear ? pfTimeLeft(s) * 5 : 0);

export const pfStep = (
	s: PfState,
	dt: number,
	input: { dir: -1 | 0 | 1; jump: boolean },
): PfEvent[] => {
	const ev: PfEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	if (s.t >= PF.time) {
		s.over = true;
		ev.push("hit");
		return ev;
	}
	s.x = Math.max(PF.cell, s.x + input.dir * PF.speed * dt);
	if (input.jump && s.ground) {
		s.vy = PF.jump;
		s.ground = false;
		ev.push("jump");
	}
	const was = s.y;
	s.vy -= PF.gravity * dt;
	s.y += s.vy * dt;
	const under = standAt(s, s.x, was);
	if (under !== null && s.y <= under && s.vy <= 0) {
		s.y = under;
		s.vy = 0;
		s.ground = true;
	} else if (under === null || s.y > under) s.ground = false;
	if (s.y < -PF.cell * 2) {
		s.over = true;
		ev.push("fall");
		return ev;
	}
	for (const e of s.enemies) {
		if (e.dead > 0) {
			e.dead -= dt;
			continue;
		}
		e.x += e.vx * dt;
		// 穴の 手前で 向きを かえる
		const ahead = Math.floor((e.x + (e.vx < 0 ? -4 : 4)) / PF.cell);
		if (s.floor[ahead] === false) e.vx = -e.vx;
		const dx = Math.abs(e.x - s.x);
		if (dx < 8 && s.y < 10) {
			if (s.vy < 0 && s.y > 3) {
				e.dead = 0.4;
				e.vx = 0;
				s.vy = PF.jump * 0.6;
				s.stomps++;
				ev.push("stomp");
			} else {
				s.over = true;
				ev.push("hit");
				return ev;
			}
		}
	}
	s.enemies = s.enemies.filter((e) => e.dead > 0 || e.vx !== 0);
	for (const c of s.coins)
		if (!c.got && Math.abs(c.x - s.x) < 8 && Math.abs(c.y - (s.y + 7)) < 10) {
			c.got = true;
			s.coinsGot++;
			ev.push("coin");
		}
	if (s.x >= pfGoalX()) {
		s.over = true;
		s.clear = true;
		ev.push("goal");
	}
	return ev;
};

/** 画面の 左はし（キリコが 左から 1/3 の 位置）。 */
export const pfCam = (s: PfState): number =>
	Math.max(0, Math.min(PF.length * PF.cell - AW, s.x - AW / 3));

/** 地面の 画面の y（下から 段 h の 上の ふち）。 */
export const pfScreenY = (h: number): number =>
	ATOP + (ROWS - PF.ground) * PF.cell - h;

// ───────────────── ボンバー ─────────────────

export const BM = {
	cell: 12,
	cols: 19,
	rows: 11,
	fuse: 1.8,
	blastLife: 0.45,
	range: 2,
	step: 0.16,
	enemyStep: 0.5,
	enemies: 4,
	time: 120,
} as const;

/** 迷路の マス：# かべ（こわせない）・r レス（こわせる）・. 通れる。 */
export type BmCell = "#" | "r" | ".";
export type BmBomb = { x: number; y: number; t: number };
export type BmBlast = { x: number; y: number; t: number };
export type BmEnemy = { x: number; y: number; t: number; alive: boolean };
export type BmState = {
	t: number;
	grid: BmCell[][];
	px: number;
	py: number;
	moveT: number;
	bombs: BmBomb[];
	blasts: BmBlast[];
	enemies: BmEnemy[];
	broken: number;
	killed: number;
	over: boolean;
	clear: boolean;
};
export type BmEvent = "bomb" | "boom" | "kill" | "dead" | "clear" | "step";

export const bmStart = (rnd: Rnd): BmState => {
	const grid: BmCell[][] = [];
	for (let y = 0; y < BM.rows; y++) {
		const row: BmCell[] = [];
		for (let x = 0; x < BM.cols; x++) {
			const edge = x === 0 || y === 0 || x === BM.cols - 1 || y === BM.rows - 1;
			const pillar = x % 2 === 0 && y % 2 === 0;
			row.push(edge || pillar ? "#" : rnd() < 0.42 ? "r" : ".");
		}
		grid.push(row);
	}
	// 左上は あける（置いて 逃げる すきま）
	for (const [x, y] of [
		[1, 1],
		[2, 1],
		[1, 2],
	])
		grid[y][x] = ".";
	const enemies: BmEnemy[] = [];
	for (let i = 0; i < 200 && enemies.length < BM.enemies; i++) {
		const x = 1 + Math.floor(rnd() * (BM.cols - 2));
		const y = 1 + Math.floor(rnd() * (BM.rows - 2));
		if (grid[y][x] === "#" || x + y < 8) continue;
		grid[y][x] = ".";
		enemies.push({ x, y, t: rnd() * BM.enemyStep, alive: true });
	}
	return {
		t: 0,
		grid,
		px: 1,
		py: 1,
		moveT: 0,
		bombs: [],
		blasts: [],
		enemies,
		broken: 0,
		killed: 0,
		over: false,
		clear: false,
	};
};

const open = (s: BmState, x: number, y: number): boolean =>
	s.grid[y]?.[x] === "." && !s.bombs.some((b) => b.x === x && b.y === y);

export const bmTimeLeft = (s: BmState): number =>
	Math.max(0, Math.ceil(BM.time - s.t));
export const bmScore = (s: BmState): number =>
	s.killed * 100 + s.broken * 10 + (s.clear ? bmTimeLeft(s) * 10 : 0);

const DIRS = [
	[0, -1],
	[0, 1],
	[-1, 0],
	[1, 0],
] as const;

export const bmStep = (
	s: BmState,
	dt: number,
	input: { dx: number; dy: number; bomb: boolean },
	rnd: Rnd,
): BmEvent[] => {
	const ev: BmEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	if (s.t >= BM.time) {
		s.over = true;
		ev.push("dead");
		return ev;
	}
	// 動く（押している あいだ BM.step ごとに 1マス）
	s.moveT = Math.max(0, s.moveT - dt);
	if ((input.dx || input.dy) && s.moveT === 0) {
		const nx = s.px + Math.sign(input.dx);
		const ny = s.py + (input.dx ? 0 : Math.sign(input.dy));
		if (open(s, nx, ny)) {
			s.px = nx;
			s.py = ny;
			ev.push("step");
		}
		s.moveT = BM.step;
	}
	if (
		input.bomb &&
		!s.bombs.some((b) => b.x === s.px && b.y === s.py) &&
		s.bombs.length < 2
	) {
		s.bombs.push({ x: s.px, y: s.py, t: BM.fuse });
		ev.push("bomb");
	}
	// 爆弾
	for (const b of s.bombs) b.t -= dt;
	const fire = s.bombs.filter((b) => b.t <= 0);
	s.bombs = s.bombs.filter((b) => b.t > 0);
	for (const b of fire) {
		ev.push("boom");
		s.blasts.push({ x: b.x, y: b.y, t: BM.blastLife });
		for (const [dx, dy] of DIRS)
			for (let i = 1; i <= BM.range; i++) {
				const x = b.x + dx * i;
				const y = b.y + dy * i;
				const c = s.grid[y]?.[x];
				if (c === "#" || c === undefined) break;
				s.blasts.push({ x, y, t: BM.blastLife });
				if (c === "r") {
					s.grid[y][x] = ".";
					s.broken++;
					break;
				}
				// 爆風に ふれた 爆弾も すぐ 爆ぜる
				for (const o of s.bombs) if (o.x === x && o.y === y) o.t = 0;
			}
	}
	for (const f of s.blasts) f.t -= dt;
	s.blasts = s.blasts.filter((f) => f.t > 0);
	const burning = (x: number, y: number) =>
		s.blasts.some((f) => f.x === x && f.y === y);
	// 荒らし（ときどき となりの 通れる マスへ）
	for (const e of s.enemies) {
		if (!e.alive) continue;
		if (burning(e.x, e.y)) {
			e.alive = false;
			s.killed++;
			ev.push("kill");
			continue;
		}
		e.t -= dt;
		if (e.t <= 0) {
			e.t = BM.enemyStep;
			const ways = DIRS.filter(([dx, dy]) => open(s, e.x + dx, e.y + dy));
			const w = ways[Math.floor(rnd() * ways.length)];
			if (w) {
				e.x += w[0];
				e.y += w[1];
			}
		}
	}
	if (
		burning(s.px, s.py) ||
		s.enemies.some((e) => e.alive && e.x === s.px && e.y === s.py)
	) {
		s.over = true;
		ev.push("dead");
		return ev;
	}
	if (s.enemies.every((e) => !e.alive)) {
		s.over = true;
		s.clear = true;
		ev.push("clear");
	}
	return ev;
};

/** 迷路の 左上（画面の 画素。帯の 下に まんなか ぞろえ）。 */
export const bmOrigin = (): readonly [number, number] => [
	Math.floor((AW - BM.cols * BM.cell) / 2),
	ATOP + Math.floor((AH - ATOP - BM.rows * BM.cell) / 2),
];
