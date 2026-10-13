// キリコの 家の ゲーム「安価スネーク」（snake）の 決まり。板は ui/arcade/home/snake.ts、文は data/arcade/text.ts。
// - マスの 上を 名無しの 列が すすむ。安価（>>）を 拾うと 1マス 伸びて、すこし 速くなる。
// - 壁か 自分の からだに ぶつかると おわり。
// - スコア＝安価×10＋生きた 秒÷2（切り捨て）。
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
} as const;

/** 板の 字。 */
export const SN_TEXT = {
	food: ">>",
	eaten: "安価",
} as const;

/** 向き：0 上・1 右・2 下・3 左。 */
export type SnDir = 0 | 1 | 2 | 3;
export const SN_DIRS: readonly (readonly [number, number])[] = [
	[0, -1],
	[1, 0],
	[0, 1],
	[-1, 0],
];

export type SnState = {
	t: number;
	/** 頭が 先頭。 */
	body: [number, number][];
	dir: SnDir;
	/** 押された 向きの 待ち（2つまで）。 */
	queue: SnDir[];
	food: [number, number];
	moveT: number;
	eaten: number;
	over: boolean;
};
export type SnEvent = "eat" | "dead";

const placeFood = (s: SnState, rnd: Rnd): [number, number] => {
	const free: [number, number][] = [];
	for (let y = 0; y < SN.rows; y++)
		for (let x = 0; x < SN.cols; x++)
			if (!s.body.some(([bx, by]) => bx === x && by === y)) free.push([x, y]);
	return free[Math.floor(rnd() * free.length)] ?? [0, 0];
};

export const snStart = (rnd: Rnd): SnState => {
	const y = Math.floor(SN.rows / 2);
	const hx = Math.floor(SN.cols / 3);
	const s: SnState = {
		t: 0,
		body: Array.from({ length: SN.length }, (_, i) => [hx - i, y]),
		dir: 1,
		queue: [],
		food: [0, 0],
		moveT: SN.interval,
		eaten: 0,
		over: false,
	};
	s.food = placeFood(s, rnd);
	return s;
};

export const snInterval = (s: SnState): number =>
	Math.max(SN.fastest, SN.interval - s.eaten * SN.speedUp);

export const snScore = (s: SnState): number =>
	s.eaten * 10 + Math.floor(s.t / 2);

export const snStep = (
	s: SnState,
	dt: number,
	input: { dir: SnDir | null },
	rnd: Rnd,
): SnEvent[] => {
	const ev: SnEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
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
		// しっぽは 伸びない ときは 先に 抜ける
		const body = eat ? s.body : s.body.slice(0, -1);
		if (
			nx < 0 ||
			ny < 0 ||
			nx >= SN.cols ||
			ny >= SN.rows ||
			body.some(([bx, by]) => bx === nx && by === ny)
		) {
			s.over = true;
			ev.push("dead");
			break;
		}
		s.body = [[nx, ny], ...body];
		if (eat) {
			s.eaten++;
			s.food = placeFood(s, rnd);
			ev.push("eat");
		}
	}
	return ev;
};

/** 盤の 左上（画面の 画素。帯の 下に まんなか ぞろえ）。 */
export const snOrigin = (): readonly [number, number] => [
	Math.floor((AW - SN.cols * SN.cell) / 2),
	ATOP + Math.floor((AH - ATOP - SN.rows * SN.cell) / 2),
];
