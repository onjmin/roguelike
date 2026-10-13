// キリコの 家の ゲーム「地雷スレ」（mines）の 決まり。板は ui/arcade/home/mines.ts、文は data/arcade/text.ts。
// - 古い パソコンの 窓の 中の マインスイーパー。地雷の ない マスを ぜんぶ 開くと クリア。
// - はじめの 1マスは かならず 安全（まわりにも 地雷を 置かない ので、0 の 広がりが 開く）。
// - 開いた 数字の マスを もう 1回 押すと、まわりの 旗が 数字と 同じ だけ あれば のこりを まとめて 開く。
// - 「旗」の ボタンで 押した ときの はたらきを 開く／旗 で 切りかえる。
// - スコア：クリア＝1000＋のこり 時間×5、地雷を 踏んだ・時間ぎれ＝開いた マス×5。
// DOM に 触らない（試験できる）。乱数は 渡された rnd（地雷は はじめて 開いた ときに 置く）。

import type { Rnd } from "../logic";

export const MS = {
	cols: 16,
	rows: 9,
	/** 1マスの 大きさ（画素）。 */
	cell: 13,
	mines: 18,
	/** 持ち時間（秒）。はじめて 開いた ときから 数える。 */
	time: 300,
} as const;

/** 板の 字。 */
export const MS_TEXT = {
	window: "地雷スレ.exe",
	open: "開く",
	flag: "旗",
	mines: "地雷",
} as const;

export type MsCell = {
	mine: boolean;
	open: boolean;
	flag: boolean;
	/** まわり 8マスの 地雷の 数。 */
	n: number;
};
export type MsState = {
	grid: MsCell[][];
	/** 地雷を 置いたか（はじめて 開く まで 置かない）。 */
	placed: boolean;
	t: number;
	/** 踏んだ 地雷（なければ null）。 */
	boom: readonly [number, number] | null;
	over: boolean;
	clear: boolean;
};
export type MsEvent = "open" | "flag" | "unflag" | "boom" | "clear";

export const msStart = (): MsState => ({
	grid: Array.from({ length: MS.rows }, () =>
		Array.from({ length: MS.cols }, () => ({
			mine: false,
			open: false,
			flag: false,
			n: 0,
		})),
	),
	placed: false,
	t: 0,
	boom: null,
	over: false,
	clear: false,
});

const around = (x: number, y: number): [number, number][] => {
	const r: [number, number][] = [];
	for (let dy = -1; dy <= 1; dy++)
		for (let dx = -1; dx <= 1; dx++) {
			const nx = x + dx;
			const ny = y + dy;
			if ((dx || dy) && nx >= 0 && ny >= 0 && nx < MS.cols && ny < MS.rows)
				r.push([nx, ny]);
		}
	return r;
};

/** 地雷を 置く（x,y と その まわりには 置かない）。 */
export const msPlace = (s: MsState, x: number, y: number, rnd: Rnd): void => {
	const free: [number, number][] = [];
	for (let yy = 0; yy < MS.rows; yy++)
		for (let xx = 0; xx < MS.cols; xx++)
			if (Math.abs(xx - x) > 1 || Math.abs(yy - y) > 1) free.push([xx, yy]);
	for (let i = 0; i < MS.mines && free.length; i++) {
		const [mx, my] = free.splice(Math.floor(rnd() * free.length), 1)[0];
		s.grid[my][mx].mine = true;
	}
	for (let yy = 0; yy < MS.rows; yy++)
		for (let xx = 0; xx < MS.cols; xx++)
			s.grid[yy][xx].n = around(xx, yy).filter(
				([ax, ay]) => s.grid[ay][ax].mine,
			).length;
	s.placed = true;
};

/** 1マス 開く（0 なら まわりへ 広がる）。地雷なら true。 */
const reveal = (s: MsState, x: number, y: number): boolean => {
	const c = s.grid[y][x];
	if (c.open || c.flag) return false;
	if (c.mine) {
		c.open = true;
		s.boom = [x, y];
		return true;
	}
	const q: [number, number][] = [[x, y]];
	c.open = true;
	while (q.length) {
		const [qx, qy] = q.pop() as [number, number];
		if (s.grid[qy][qx].n) continue;
		for (const [ax, ay] of around(qx, qy)) {
			const a = s.grid[ay][ax];
			if (a.open || a.flag || a.mine) continue;
			a.open = true;
			q.push([ax, ay]);
		}
	}
	return false;
};

export const msOpened = (s: MsState): number =>
	s.grid.flat().filter((c) => c.open && !c.mine).length;
export const msFlags = (s: MsState): number =>
	s.grid.flat().filter((c) => c.flag).length;
export const msTimeLeft = (s: MsState): number =>
	Math.max(0, Math.ceil(MS.time - s.t));
export const msScore = (s: MsState): number =>
	s.clear ? 1000 + msTimeLeft(s) * 5 : msOpened(s) * 5;

const finish = (s: MsState, ev: MsEvent[]): MsEvent[] => {
	if (s.boom) {
		s.over = true;
		ev.push("boom");
	} else if (msOpened(s) === MS.cols * MS.rows - MS.mines) {
		s.over = true;
		s.clear = true;
		ev.push("clear");
	}
	return ev;
};

/** 開く（開いた 数字の マスなら まわりを まとめて 開く）。 */
export const msOpen = (
	s: MsState,
	x: number,
	y: number,
	rnd: Rnd,
): MsEvent[] => {
	const ev: MsEvent[] = [];
	if (s.over) return ev;
	if (!s.placed) msPlace(s, x, y, rnd);
	const c = s.grid[y][x];
	if (c.flag) return ev;
	if (c.open) {
		const ns = around(x, y);
		const flags = ns.filter(([ax, ay]) => s.grid[ay][ax].flag).length;
		if (!c.n || flags !== c.n) return ev;
		let any = false;
		for (const [ax, ay] of ns) {
			const a = s.grid[ay][ax];
			if (a.open || a.flag) continue;
			any = true;
			reveal(s, ax, ay);
		}
		if (any) ev.push("open");
		return finish(s, ev);
	}
	reveal(s, x, y);
	ev.push("open");
	return finish(s, ev);
};

/** 旗を 立てる・抜く（開いた 数字の マスなら まとめて 開く）。 */
export const msFlag = (
	s: MsState,
	x: number,
	y: number,
	rnd: Rnd,
): MsEvent[] => {
	if (s.over) return [];
	const c = s.grid[y][x];
	if (c.open) return msOpen(s, x, y, rnd);
	c.flag = !c.flag;
	return [c.flag ? "flag" : "unflag"];
};

/** 時計（はじめて 開いて から 進む）。時間ぎれで おわり。 */
export const msTick = (s: MsState, dt: number): MsEvent[] => {
	if (s.over || !s.placed) return [];
	s.t += dt;
	if (s.t >= MS.time) {
		s.over = true;
		return ["boom"];
	}
	return [];
};
