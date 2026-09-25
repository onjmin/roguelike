// エンジン全体で使う小さな型と定数。

/** 1マスの大きさ（ソース画素）。RPGEN の歩行グラ・マップチップに合わせて 16px。 */
export const TILE = 16;

export type Dir = "up" | "right" | "down" | "left";

export const DIR_VEC: Record<Dir, { dx: number; dy: number }> = {
	up: { dx: 0, dy: -1 },
	right: { dx: 1, dy: 0 },
	down: { dx: 0, dy: 1 },
	left: { dx: -1, dy: 0 },
};

export const OPPOSITE: Record<Dir, Dir> = {
	up: "down",
	right: "left",
	down: "up",
	left: "right",
};

export const dirFromDelta = (dx: number, dy: number): Dir | null => {
	if (dx === 0 && dy === 0) return null;
	if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
	return dy > 0 ? "down" : "up";
};

export const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

export const clamp = (v: number, lo: number, hi: number): number =>
	Math.max(lo, Math.min(hi, v));
