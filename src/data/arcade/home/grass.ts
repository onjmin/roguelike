// キリコの 家の ゲーム「大草原2048」（grass）の 決まり。板は ui/arcade/home/grass.ts、文は data/arcade/text.ts。
// - 4x4 の 2048。同じ 草を ぶつけると 1段 育つ（草→草草→大草原→……→富士の樹海）。
// - 寄せる たびに 空いた マスに 草（2）か ときどき 草草（4）が 生える。
// - 寄せられなく なったら おわり。スコア＝くっつけて できた 数の 合計（ふつうの 2048 と 同じ）。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import type { Rnd } from "../logic";

export const GR = {
	size: 4,
	/** 草草（4）が 生える 割合。 */
	four: 0.1,
	goal: 2048,
} as const;

/** 段ごとの 名前（2 が 0 番目。足りなければ 最後の 名前）。 */
export const GR_NAMES = [
	"草",
	"草草",
	"大草原",
	"草不可避",
	"草生えすぎ",
	"芝",
	"大芝生",
	"草原",
	"森",
	"樹海",
	"富士の樹海",
	"草の星",
] as const;

/** 板の 字。 */
export const GR_TEXT = {
	best: "最大",
	goal: "富士の樹海！",
	/** 新しい 段に 届いた（{name} は 草の 名）。 */
	grew: "{name}が　生えた",
} as const;

/** 0 は 空き、ほかは 2 の べき。 */
export type GrState = {
	grid: number[][];
	score: number;
	/** 富士の樹海（2048）に 届いたか。 */
	won: boolean;
	over: boolean;
	/** さいごの 寄せで くっついた・生えた マス（ぽんと 弾ませる）。 */
	merged: [number, number][];
	born: [number, number] | null;
};
export type GrDir = "up" | "down" | "left" | "right";
export type GrEvent = "slide" | "merge" | "goal" | "over";

/** 数 → 名前。 */
export const grName = (v: number): string =>
	GR_NAMES[Math.min(GR_NAMES.length - 1, Math.max(0, Math.log2(v) - 1))];

const empties = (s: GrState): [number, number][] => {
	const r: [number, number][] = [];
	for (let y = 0; y < GR.size; y++)
		for (let x = 0; x < GR.size; x++) if (!s.grid[y][x]) r.push([x, y]);
	return r;
};

/** 空いた マスに 1つ 生やす。 */
export const grSpawn = (s: GrState, rnd: Rnd): void => {
	const e = empties(s);
	if (!e.length) return;
	const [x, y] = e[Math.floor(rnd() * e.length)];
	s.grid[y][x] = rnd() < GR.four ? 4 : 2;
	s.born = [x, y];
};

export const grStart = (rnd: Rnd): GrState => {
	const s: GrState = {
		grid: Array.from({ length: GR.size }, () =>
			Array.from({ length: GR.size }, () => 0),
		),
		score: 0,
		won: false,
		over: false,
		merged: [],
		born: null,
	};
	grSpawn(s, rnd);
	grSpawn(s, rnd);
	s.born = null;
	return s;
};

/** 寄せられる 向きが あるか。 */
export const grCanMove = (s: GrState): boolean => {
	for (let y = 0; y < GR.size; y++)
		for (let x = 0; x < GR.size; x++) {
			const v = s.grid[y][x];
			if (!v) return true;
			if (x + 1 < GR.size && s.grid[y][x + 1] === v) return true;
			if (y + 1 < GR.size && s.grid[y + 1][x] === v) return true;
		}
	return false;
};

/** その 向きの 1列（寄せる 先から 順の 座標）。 */
const line = (dir: GrDir, i: number): [number, number][] =>
	Array.from({ length: GR.size }, (_, k): [number, number] => {
		const j = dir === "left" || dir === "up" ? k : GR.size - 1 - k;
		return dir === "left" || dir === "right" ? [j, i] : [i, j];
	});

/** 寄せる（動かなければ 何も 起きない）。動いたら 1つ 生やす。 */
export const grMove = (s: GrState, dir: GrDir, rnd: Rnd): GrEvent[] => {
	const ev: GrEvent[] = [];
	if (s.over) return ev;
	let moved = false;
	const merged: [number, number][] = [];
	let gained = 0;
	for (let i = 0; i < GR.size; i++) {
		const cells = line(dir, i);
		const vals = cells.map(([x, y]) => s.grid[y][x]).filter((v) => v);
		const out: number[] = [];
		const hit: boolean[] = [];
		for (const v of vals) {
			if (out.length && out[out.length - 1] === v && !hit[out.length - 1]) {
				out[out.length - 1] = v * 2;
				hit[out.length - 1] = true;
				gained += v * 2;
			} else {
				out.push(v);
				hit.push(false);
			}
		}
		cells.forEach(([x, y], k) => {
			const v = out[k] ?? 0;
			if (s.grid[y][x] !== v) moved = true;
			s.grid[y][x] = v;
			if (hit[k]) merged.push([x, y]);
		});
	}
	if (!moved) return ev;
	s.score += gained;
	s.merged = merged;
	ev.push(merged.length ? "merge" : "slide");
	if (!s.won && s.grid.some((r) => r.some((v) => v >= GR.goal))) {
		s.won = true;
		ev.push("goal");
	}
	grSpawn(s, rnd);
	if (!grCanMove(s)) {
		s.over = true;
		ev.push("over");
	}
	return ev;
};

export const grBest = (s: GrState): number => Math.max(...s.grid.flat());
export const grScore = (s: GrState): number => s.score;
