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
// DOM は 使わない（テスト：sim/villageTests.ts）。

import { DIR_VEC, type Dir } from "./types";

/** これより 長い 道だけ 縮める（歩数）。近くの 人は そのまま 歩いて 見せる。 */
export const LONG_WALK = 12;
/** 縮めても 行き先までは これだけ 歩いて 見せる（その場に わいて 立つのでは なく、歩いて 来た ように）。 */
export const WALK_TAIL = 8;
/** カメラが ついていく 人は これより 長い 道だけ 暗転で 縮める（暗転は 場面を 切るので 長めから）。 */
export const FOLLOW_CUT = 20;

export type Cell = readonly [x: number, y: number];
/** マスが 画面に 映るか（画面の 大きさが わからなければ null）。 */
export type Seen = ((x: number, y: number) => boolean) | null;
/** 歩く 人を 置きなおして よい マスか（人・置物・キリコが いない）。 */
export type Free = (x: number, y: number) => boolean;

/** 縮めて よい 歩きか（キリコ・noWarp・短い 道は 縮めない）。 */
export const mayWarp = (
	target: string,
	steps: number,
	opt?: { noWarp?: boolean },
): boolean => target !== "player" && !opt?.noWarp && steps > LONG_WALK;

/** 道の マス（[0] が 出だし、[route.length] が 行き先）。 */
export const routeCells = (from: Cell, route: readonly Dir[]): Cell[] => {
	let [x, y] = from;
	const cells: Cell[] = [[x, y]];
	for (const d of route) {
		x += DIR_VEC[d].dx;
		y += DIR_VEC[d].dy;
		cells.push([x, y]);
	}
	return cells;
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
};

/**
 * from から route の とおりに 歩かせる（行き先に 着いたら 解決）。warp なら 長い 道を 縮める（上の 決まり）。
 * 置きなおすのは いつも 道の 先（j > i）なので 必ず 着く。
 */
export const walkRoute = async (
	from: Cell,
	route: readonly Dir[],
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
		await h.step(route[i]);
		i++;
	}
};
