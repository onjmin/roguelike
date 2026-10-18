// 敵の いない 階（名所・集落）の 寸劇（文は data/story/restSkits.ts。演出は ui/dungeon/play.ts の restSkit）。
// - どれを 見たかを 別の 保存場所に 残す（保存できなくても この回は 覚えている）。所ごとに 並びの 順で 1本ずつ。
// - 走る 道は 階の 床だけで 決める（人の 立つ マスは 通れる ことに する。置物・壁は 通れない）。見た目だけ。

import type { Pos } from "../../core/geom";
import { idx, T_WALL } from "../../core/mapgen";
import type { Floor } from "../../core/types";
import { type RestSkit, restSkitsAt } from "../../data/story/restSkits";

const KEY = "kiriko-roguelike/restSkits";

let memo: string[] = [];

const load = (): string[] => {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const o = JSON.parse(raw) as unknown;
			if (Array.isArray(o))
				return o.filter((x): x is string => typeof x === "string");
		}
	} catch {
		// 読めなければ この回の 写し
	}
	return [...memo];
};

/** 試験用：この回の 写しを 忘れる。 */
export const forgetRestSkits = (): void => {
	memo = [];
};

/** その 所の まだ 見て いない 寸劇を 1本 えらんで 見た ことに する（ぜんぶ 見たら null）。 */
export const takeRestSkit = (place: string): RestSkit | null => {
	const seen = load();
	const sk = restSkitsAt(place).find((x) => !seen.includes(x.key));
	if (!sk) return null;
	memo = [...seen, sk.key];
	try {
		localStorage.setItem(KEY, JSON.stringify(memo));
	} catch {
		// 保存できなくても 遊べる
	}
	return sk;
};

/** 寸劇の 走りで 通れる マス（床。人の 立つ マスも 通れる。avoid の マスは 通らない）。 */
const open = (
	f: Floor,
	x: number,
	y: number,
	folkCells: ReadonlySet<number>,
	avoid: ReadonlySet<number>,
): boolean => {
	const l = f.layout;
	if (x < 0 || y < 0 || x >= l.w || y >= l.h) return false;
	const i = idx(l, x, y);
	if (avoid.has(i)) return false;
	return l.tiles[i] !== T_WALL || folkCells.has(i);
};

/**
 * from から to までの 道（4方向。両はしを ふくむ。無ければ null）。
 * 人の 立つ マス（folk）は 通れる。avoid は 通らない マス（主人公・同行者・ほかの 人の いま いる 所）。
 */
export const restPath = (
	f: Floor,
	from: Pos,
	to: Pos,
	avoid: readonly Pos[] = [],
): Pos[] | null => {
	const l = f.layout;
	const folkCells = new Set((f.folk ?? []).map((fo) => idx(l, fo.x, fo.y)));
	const bad = new Set(
		avoid
			.filter((p) => p.x !== to.x || p.y !== to.y)
			.map((p) => idx(l, p.x, p.y)),
	);
	if (!open(f, to.x, to.y, folkCells, bad)) return null;
	const start = idx(l, from.x, from.y);
	const goal = idx(l, to.x, to.y);
	const prev = new Map<number, number>([[start, -1]]);
	const queue = [start];
	for (let q = 0; q < queue.length; q++) {
		const i = queue[q];
		if (i === goal) break;
		const x = i % l.w;
		const y = Math.floor(i / l.w);
		for (const [dx, dy] of [
			[0, -1],
			[1, 0],
			[0, 1],
			[-1, 0],
		] as const) {
			const nx = x + dx;
			const ny = y + dy;
			if (!open(f, nx, ny, folkCells, bad)) continue;
			const j = idx(l, nx, ny);
			if (prev.has(j)) continue;
			prev.set(j, i);
			queue.push(j);
		}
	}
	if (!prev.has(goal)) return null;
	const out: Pos[] = [];
	for (let i = goal; i >= 0; i = prev.get(i) ?? -1)
		out.push({ x: i % l.w, y: Math.floor(i / l.w) });
	return out.reverse();
};

/** at の となりの 空いた マス（4方向 → ななめ。無ければ null）。 */
export const restBeside = (
	f: Floor,
	at: Pos,
	avoid: readonly Pos[],
): Pos | null => {
	const l = f.layout;
	const folkCells = new Set((f.folk ?? []).map((fo) => idx(l, fo.x, fo.y)));
	const bad = new Set(avoid.map((p) => idx(l, p.x, p.y)));
	for (const [dx, dy] of [
		[-1, 0],
		[1, 0],
		[0, 1],
		[0, -1],
		[-1, 1],
		[1, 1],
		[-1, -1],
		[1, -1],
	] as const) {
		const x = at.x + dx;
		const y = at.y + dy;
		if (open(f, x, y, folkCells, bad)) return { x, y };
	}
	return null;
};
