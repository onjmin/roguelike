// キリコの 家の ゲーム「安価スネーク」（snake）の 決まり。板は ui/arcade/home/snake.ts、文は data/arcade/text.ts。
// - マスの 上を 名無しの 列が すすむ。安価（>>）を 拾うと 1マス 伸びて、すこし 速くなる。
// - 続けて 早く 拾うと 連続（×2〜×5）。5つ ごとに 段が 上がり、金の 神安価（しばらくで 消える。
//   早く 拾うほど 点）が 出て、荒らしの レス（ぶつかると おわり）が 1つ ふえる。
// - 壁か 自分の からだか 荒らしに ぶつかると おわり。
// - スコア＝ためた 点（安価 10×連続・神安価 50＋のこり 秒×10）＋生きた 秒÷2（切り捨て）。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import { AH, ATOP, AW, type Rnd } from "../logic";

export const SN = {
	/** 1マスの 大きさ（画素）。 */
	cell: 8,
	cols: 28,
	rows: 16,
	/** はじめの 長さ。 */
	length: 4,
	/** 1マス すすむ 秒（はじめ・いちばん 速い とき・安価 1つで 縮む 分）。 */
	interval: 0.16,
	fastest: 0.065,
	speedUp: 0.004,
	/** 連続に なる 間（秒）と いちばん 大きい 倍。 */
	combo: 3,
	comboMax: 5,
	/** 段が 上がる 安価の 数。 */
	perLevel: 5,
	/** 神安価が 出ている 秒。 */
	bonusLife: 7,
	/** 荒らしの レスの いちばん 多い 数。 */
	maxRocks: 10,
} as const;

/** 板の 字。 */
export const SN_TEXT = {
	food: ">>",
	bonus: "神",
	rock: "荒",
	eaten: "安価",
	level: "段",
	combo: "×{n}",
} as const;

/** 向き：0 上・1 右・2 下・3 左。 */
export type SnDir = 0 | 1 | 2 | 3;
export const SN_DIRS: readonly (readonly [number, number])[] = [
	[0, -1],
	[1, 0],
	[0, 1],
	[-1, 0],
];

export type SnPop = { x: number; y: number; text: string; t: number };
export type SnState = {
	t: number;
	/** 頭が 先頭。 */
	body: [number, number][];
	dir: SnDir;
	/** 押された 向きの 待ち（2つまで）。 */
	queue: SnDir[];
	food: [number, number];
	/** 神安価（なければ null。t は のこり 秒）。 */
	bonus: { x: number; y: number; t: number } | null;
	/** 荒らしの レス。 */
	rocks: [number, number][];
	moveT: number;
	eaten: number;
	combo: number;
	comboT: number;
	points: number;
	pops: SnPop[];
	over: boolean;
};
export type SnEvent = "eat" | "bonus" | "level" | "dead";

const taken = (s: SnState, x: number, y: number): boolean =>
	s.body.some(([bx, by]) => bx === x && by === y) ||
	s.rocks.some(([rx, ry]) => rx === x && ry === y) ||
	(s.food[0] === x && s.food[1] === y) ||
	(s.bonus !== null && s.bonus.x === x && s.bonus.y === y);

/** 空いた マス（頭の 前 4マスと 壁ぎわを よける ときは away）。 */
const freeCell = (s: SnState, rnd: Rnd, away = false): [number, number] => {
	const [hx, hy] = s.body[0];
	const [dx, dy] = SN_DIRS[s.dir];
	const free: [number, number][] = [];
	for (let y = 0; y < SN.rows; y++)
		for (let x = 0; x < SN.cols; x++) {
			if (taken(s, x, y)) continue;
			if (away) {
				if (x === 0 || y === 0 || x === SN.cols - 1 || y === SN.rows - 1)
					continue;
				if (Math.abs(x - hx) + Math.abs(y - hy) < 4) continue;
				let ahead = false;
				for (let i = 1; i <= 5; i++)
					if (hx + dx * i === x && hy + dy * i === y) ahead = true;
				if (ahead) continue;
			}
			free.push([x, y]);
		}
	return free[Math.floor(rnd() * free.length)] ?? [-1, -1];
};

export const snStart = (rnd: Rnd): SnState => {
	const y = Math.floor(SN.rows / 2);
	const hx = Math.floor(SN.cols / 3);
	const s: SnState = {
		t: 0,
		body: Array.from({ length: SN.length }, (_, i) => [hx - i, y]),
		dir: 1,
		queue: [],
		food: [-1, -1],
		bonus: null,
		rocks: [],
		moveT: SN.interval,
		eaten: 0,
		combo: 0,
		comboT: 0,
		points: 0,
		pops: [],
		over: false,
	};
	s.food = freeCell(s, rnd);
	return s;
};

export const snInterval = (s: SnState): number =>
	Math.max(SN.fastest, SN.interval - s.eaten * SN.speedUp);
export const snLevel = (s: SnState): number =>
	1 + Math.floor(s.eaten / SN.perLevel);

export const snScore = (s: SnState): number => s.points + Math.floor(s.t / 2);

export const snStep = (
	s: SnState,
	dt: number,
	input: { dir: SnDir | null },
	rnd: Rnd,
): SnEvent[] => {
	const ev: SnEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	for (const p of s.pops) p.t += dt;
	s.pops = s.pops.filter((p) => p.t < 0.8);
	s.comboT = Math.max(0, s.comboT - dt);
	if (s.comboT === 0) s.combo = 0;
	if (s.bonus) {
		s.bonus.t -= dt;
		if (s.bonus.t <= 0) s.bonus = null;
	}
	// 向きの 待ち（いまの 向きの 逆と 同じ 向きは 取らない）
	if (input.dir !== null && s.queue.length < 2) {
		const last = s.queue[s.queue.length - 1] ?? s.dir;
		if (input.dir !== last && (input.dir + 2) % 4 !== last)
			s.queue.push(input.dir);
	}
	s.moveT -= dt;
	while (s.moveT <= 0 && !s.over) {
		s.moveT += snInterval(s);
		const d = s.queue.shift();
		if (d !== undefined) s.dir = d;
		const [dx, dy] = SN_DIRS[s.dir];
		const [hx, hy] = s.body[0];
		const nx = hx + dx;
		const ny = hy + dy;
		const eat = nx === s.food[0] && ny === s.food[1];
		const gold = s.bonus !== null && nx === s.bonus.x && ny === s.bonus.y;
		// しっぽは 伸びない ときは 先に 抜ける
		const body = eat || gold ? s.body : s.body.slice(0, -1);
		if (
			nx < 0 ||
			ny < 0 ||
			nx >= SN.cols ||
			ny >= SN.rows ||
			body.some(([bx, by]) => bx === nx && by === ny) ||
			s.rocks.some(([rx, ry]) => rx === nx && ry === ny)
		) {
			s.over = true;
			ev.push("dead");
			break;
		}
		s.body = [[nx, ny], ...body];
		if (gold && s.bonus) {
			const pts = 50 + Math.ceil(s.bonus.t) * 10;
			s.points += pts;
			s.pops.push({ x: nx, y: ny, text: `+${pts}`, t: 0 });
			s.bonus = null;
			ev.push("bonus");
		}
		if (eat) {
			s.eaten++;
			s.combo = s.comboT > 0 ? Math.min(SN.comboMax, s.combo + 1) : 1;
			s.comboT = SN.combo;
			const pts = 10 * s.combo;
			s.points += pts;
			s.pops.push({ x: nx, y: ny, text: `+${pts}`, t: 0 });
			ev.push("eat");
			if (s.eaten % SN.perLevel === 0) {
				// 段が 上がる：神安価と 荒らしの レス
				if (s.rocks.length < SN.maxRocks) {
					const r = freeCell(s, rnd, true);
					if (r[0] >= 0) s.rocks.push(r);
				}
				const b = freeCell(s, rnd, true);
				if (b[0] >= 0) s.bonus = { x: b[0], y: b[1], t: SN.bonusLife };
				ev.push("level");
			}
			s.food = [-1, -1];
			s.food = freeCell(s, rnd);
		}
	}
	return ev;
};

/** 盤の 左上（画面の 画素。帯の 下に まんなか ぞろえ）。 */
export const snOrigin = (): readonly [number, number] => [
	Math.floor((AW - SN.cols * SN.cell) / 2),
	ATOP + Math.floor((AH - ATOP - SN.rows * SN.cell) / 2),
];
