// 場面で 人を 歩かせる 長い 道を 縮める（Story.goto。ui/village.ts）。
// 地図が 87×52 に 広がって、遠くの 人が キリコの そばへ 来るまで 長く 待つように なった
// （東の 口から 帰ると、ぷゆゆパンを 持った ぷゆゆが 来るまで 75歩）。場面 ごとに 直さず、ここで まとめて 縮める。
//
// - キリコ（"player"）・noWarp（ROM専の 行列）・LONG_WALK 歩 までの 道は ふつうに ぜんぶ 歩く。
// - 1歩 ごとに、画面に 映っていない 人は 道の 先の 映らない マスへ 置きなおす（映っている 人は 消さない）。
//   行き先が 映っていれば WALK_TAIL 歩は 残して、画面の はしの すぐ 外から 歩いて 入ってくる。
//   行き先も 映っていなければ（画面の 外へ 出ていった 人）そのまま 行き先へ。
// - 画面の 大きさが わからなければ、はじめに 1度だけ 行き先の WALK_TAIL 歩 手前へ。
// - カメラが ついていく 人は いつも 映っているので、道が FOLLOW_CUT 歩より 長ければ 短い 暗転で
//   行き先の WALK_TAIL 歩 手前へ（窓が キー待ちの ときは しない）。
// - 置きなおすのは 道の 上の 空いた マスだけ（人・置物・キリコの いる マスには 置かない）。
// - 道が ない とき（台の うしろの ロゼ・シヨ、キリコが ふさぐ 細道の 先）は、キリコ 以外は 歩ける ところまで
//   歩いて、いちばん せまい すきまを とびこえる（hopRoute。道に とびこえる マスが 入る）。前は その場から
//   動かず、遠くから 話していた。
// DOM は 使わない（テスト：sim/villageTests.ts）。

import { DIR_VEC, type Dir, OPPOSITE } from "./types";

/** これより 長い 道だけ 縮める（歩数）。近くの 人は そのまま 歩いて 見せる。 */
export const LONG_WALK = 12;
/** 縮めても 行き先までは これだけ 歩いて 見せる（その場に わいて 立つのでは なく、歩いて 来た ように）。 */
export const WALK_TAIL = 8;
/** カメラが ついていく 人は これより 長い 道だけ 暗転で 縮める（暗転は 場面を 切るので 長めから）。 */
export const FOLLOW_CUT = 20;

export type Cell = readonly [x: number, y: number];
/** 道の 1つ：1歩（向き）か、道の ない すきまを とびこえて その マスへ（hopRoute）。 */
export type WalkStep = Dir | Cell;
/** マスが 画面に 映るか（画面の 大きさが わからなければ null）。 */
export type Seen = ((x: number, y: number) => boolean) | null;
/** 歩く 人を 置きなおして よい マスか（人・置物・キリコが いない）。 */
export type Free = (x: number, y: number) => boolean;
/** 場面の 人が 道に して よい マスか（地図の 中だけ 聞く。出だしの マスは 聞かない）。 */
export type Open = (x: number, y: number) => boolean;

/** 縮めて よい 歩きか（キリコ・noWarp・短い 道は 縮めない）。 */
export const mayWarp = (
	target: string,
	steps: number,
	opt?: { noWarp?: boolean },
): boolean => target !== "player" && !opt?.noWarp && steps > LONG_WALK;

/** 道の マス（[0] が 出だし、[route.length] が 行き先。とびこえる ところは その マス）。 */
export const routeCells = (from: Cell, route: readonly WalkStep[]): Cell[] => {
	let [x, y] = from;
	const cells: Cell[] = [[x, y]];
	for (const st of route) {
		if (typeof st === "string") {
			x += DIR_VEC[st].dx;
			y += DIR_VEC[st].dy;
		} else [x, y] = st;
		cells.push([x, y]);
	}
	return cells;
};

// ───────────────── 道 ─────────────────

/** 道を さがす 順（上・右・下・左）。 */
const STEP_DIRS: readonly Dir[] = ["up", "right", "down", "left"];

/** 幅優先で たどった あと（マスは y * w + x の 番号）。 */
type Spread = {
	/** 来た 順の マス。 */
	order: number[];
	/** 1つ 前の マス（出だしは 自分。来ていなければ -1）。 */
	prev: Int32Array;
	/** 1つ 前の マスから 来た 向き（STEP_DIRS の 番目）。 */
	via: Int8Array;
};

/** start から 幅優先で open の マスへ ひろがる（start は 聞かない）。goal に 来たら そこで やめる。 */
const spread = (
	w: number,
	h: number,
	open: Open,
	[sx, sy]: Cell,
	goal = -1,
): Spread => {
	const prev = new Int32Array(w * h).fill(-1);
	const via = new Int8Array(w * h);
	const start = sy * w + sx;
	prev[start] = start;
	const order = [start];
	for (let head = 0; head < order.length; head++) {
		const k = order[head];
		if (k === goal) break;
		const x = k % w;
		const y = (k - x) / w;
		for (let i = 0; i < STEP_DIRS.length; i++) {
			const v = DIR_VEC[STEP_DIRS[i]];
			const nx = x + v.dx;
			const ny = y + v.dy;
			if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
			const n = ny * w + nx;
			if (prev[n] !== -1 || !open(nx, ny)) continue;
			prev[n] = k;
			via[n] = i;
			order.push(n);
		}
	}
	return { order, prev, via };
};

/** 出だしから k までの 向き（spread の あと）。 */
const pathTo = ({ prev, via }: Spread, k: number): Dir[] => {
	const route: Dir[] = [];
	for (let at = k; prev[at] !== at; at = prev[at])
		route.push(STEP_DIRS[via[at]]);
	return route.reverse();
};

const inside = (w: number, h: number, [x, y]: Cell): boolean =>
	x >= 0 && y >= 0 && x < w && y < h;

/**
 * from から to までの 場面の 道（幅優先）。open の マスだけを 通る。行けなければ null（ui/village.ts の routeTo）。
 * 出だしの マスは 聞かない（人の いる マスから 歩きだす）。
 */
export const findRoute = (
	w: number,
	h: number,
	open: Open,
	from: Cell,
	to: Cell,
): Dir[] | null => {
	if (!inside(w, h, from) || !inside(w, h, to)) return null;
	const goal = to[1] * w + to[0];
	const s = spread(w, h, open, from, goal);
	return s.prev[goal] === -1 ? null : pathTo(s, goal);
};

/**
 * 道が ない とき（findRoute が null）の 道：歩いて 行ける ところまで 歩き、行き先の 側との いちばん せまい
 * すきまを とびこえて（道に その マスが 入る）、残りを 歩く。台の うしろの ロゼ・シヨは 台を とびこえて 出てくる。
 * キリコが ふさぐ 細道の 先へは キリコを とびこえる。すきまが 同じなら 出だしに 近い ところで とぶ。
 * 行き先が 地図の 外か open で なければ null。
 */
export const hopRoute = (
	w: number,
	h: number,
	open: Open,
	from: Cell,
	to: Cell,
): WalkStep[] | null => {
	if (!inside(w, h, from) || !inside(w, h, to) || !open(to[0], to[1]))
		return null;
	// 行き先から 歩いて 行ける マスと、出だしから 歩いて 行ける マス
	const near = spread(w, h, open, to);
	const far = spread(w, h, open, from);
	// どの マスからも、行き先の 側の いちばん 近い マス（land）と その 歩数（gap。地形は 見ない）
	const gap = new Int32Array(w * h).fill(-1);
	const land = new Int32Array(w * h);
	for (const k of near.order) {
		gap[k] = 0;
		land[k] = k;
	}
	const ring = [...near.order];
	for (let head = 0; head < ring.length; head++) {
		const k = ring[head];
		const x = k % w;
		const y = (k - x) / w;
		for (const d of STEP_DIRS) {
			const nx = x + DIR_VEC[d].dx;
			const ny = y + DIR_VEC[d].dy;
			if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
			const n = ny * w + nx;
			if (gap[n] !== -1) continue;
			gap[n] = gap[k] + 1;
			land[n] = land[k];
			ring.push(n);
		}
	}
	// 出だしから 歩いて 行ける マスの うち、すきまが いちばん せまい マス（来た 順なので 同じなら 近い 方）
	let best = far.order[0];
	for (const k of far.order) if (gap[k] < gap[best]) best = k;
	const route: WalkStep[] = pathTo(far, best);
	let at = land[best];
	if (gap[best] > 0) route.push([at % w, Math.floor(at / w)]);
	// 行き先の 側は 来た 道を もどる
	for (; near.prev[at] !== at; at = near.prev[at])
		route.push(OPPOSITE[STEP_DIRS[near.via[at]]]);
	return route;
};

/**
 * 道の i 番目に いる 人を どこまで 先へ 置きなおすか（道の 番目。置きなおさなければ i）。
 * 映っている 人は 動かさない。映らない 人は 先の 映らない 空いた マスへ（行き先が 映っていれば WALK_TAIL 歩は
 * 残す。映っていなければ 行き先まで）。画面が わからなければ はじめに 1度だけ 行き先の WALK_TAIL 歩 手前へ。
 */
export const skipTo = (
	cells: readonly Cell[],
	i: number,
	seen: Seen,
	free: Free,
): number => {
	const n = cells.length - 1;
	if (!seen) {
		if (i > 0) return i;
		for (let j = n - WALK_TAIL; j > i; j--)
			if (free(cells[j][0], cells[j][1])) return j;
		return i;
	}
	if (seen(cells[i][0], cells[i][1])) return i;
	const last = seen(cells[n][0], cells[n][1]) ? n - WALK_TAIL : n;
	for (let j = last; j > i; j--) {
		const [x, y] = cells[j];
		if (!seen(x, y) && free(x, y)) return j;
	}
	return i;
};

/** カメラが ついていく 人を 暗転で どこまで 先へ 置きなおすか（道の 番目。しなければ 0）。 */
export const cutTo = (cells: readonly Cell[], free: Free): number => {
	const n = cells.length - 1;
	if (n <= FOLLOW_CUT) return 0;
	for (let j = n - WALK_TAIL; j > 0; j--)
		if (free(cells[j][0], cells[j][1])) return j;
	return 0;
};

/** walkRoute が 歩く 人と 画面に 聞く こと・させる こと。 */
export type WalkHooks = {
	/** 縮めて よい 歩きか（mayWarp）。 */
	warp: boolean;
	/** カメラが この 人に ついていく（いつも 映るので、縮めるなら 暗転）。 */
	follow: () => boolean;
	/** いま 暗転して よいか（窓が キー待ちなら しない。閉じると 読みかけの 文が 消える）。 */
	mayCut: () => boolean;
	/** いまの 画面に 映る マス。 */
	seen: () => Seen;
	free: Free;
	/** その場に 置きなおす（Story.place と 同じ）。 */
	place: (c: Cell) => void;
	/** 暗転して 置きなおす（明けてから 解決）。 */
	cut: (c: Cell) => Promise<void>;
	/** 1歩 歩く（着いたら 解決）。 */
	step: (d: Dir) => Promise<void>;
	/** 道の ない すきまを とびこえて その マスへ（hopRoute。着いたら 解決）。なければ place。 */
	hop?: (c: Cell) => Promise<void>;
};

/**
 * from から route の とおりに 歩かせる（行き先に 着いたら 解決）。warp なら 長い 道を 縮める（上の 決まり）。
 * 置きなおすのは いつも 道の 先（j > i）なので 必ず 着く。とびこえる ところも 映らなければ 置きなおしで とばす。
 */
export const walkRoute = async (
	from: Cell,
	route: readonly WalkStep[],
	h: WalkHooks,
): Promise<void> => {
	const cells = routeCells(from, route);
	let i = 0;
	if (h.warp && h.follow() && h.mayCut()) {
		const j = cutTo(cells, h.free);
		if (j > 0) {
			await h.cut(cells[j]);
			i = j;
		}
	}
	while (i < route.length) {
		if (h.warp && !h.follow()) {
			const j = skipTo(cells, i, h.seen(), h.free);
			if (j > i) {
				h.place(cells[j]);
				i = j;
				continue;
			}
		}
		const st = route[i];
		if (typeof st === "string") await h.step(st);
		else if (h.hop) await h.hop(st);
		else h.place(st);
		i++;
	}
};
