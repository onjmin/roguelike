// 見える範囲（トルネコ1と同じ考え方）。
//
// - 部屋の中にいれば、その部屋ぜんぶ（壁と入口まで）が見える。
// - 部屋の入口（部屋に接する通路マス）に立つと、その部屋も見える。
// - 通路では、まわり1マスだけ。
// モンスターがプレイヤーに気づくのも同じ決まりで判定する（見え方は対称）。

import type { Pos } from "./geom";
import { type Layout, type Room, roomAt, T_WALL, tileAt } from "./mapgen";

/** (x, y) から見える部屋。部屋の中ならその部屋、入口ならとなりの部屋。 */
export const roomsSeenFrom = (l: Layout, x: number, y: number): Room[] => {
	const r = roomAt(l, x, y);
	if (r >= 0) return [l.rooms[r]];
	const out: Room[] = [];
	for (const [dx, dy] of [
		[0, -1],
		[1, 0],
		[0, 1],
		[-1, 0],
	]) {
		const n = roomAt(l, x + dx, y + dy);
		if (n >= 0 && !out.includes(l.rooms[n])) out.push(l.rooms[n]);
	}
	return out;
};

const inRoomView = (r: Room, x: number, y: number): boolean =>
	x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h;

/** from から to が見えるか。 */
export const canSee = (l: Layout, from: Pos, to: Pos): boolean => {
	if (Math.abs(from.x - to.x) <= 1 && Math.abs(from.y - to.y) <= 1) return true;
	for (const r of roomsSeenFrom(l, from.x, from.y))
		if (inRoomView(r, to.x, to.y)) return true;
	return false;
};

/** from から見えるマスをすべて f に渡す（踏破済みの印つけ用）。 */
export const forEachVisible = (
	l: Layout,
	from: Pos,
	f: (x: number, y: number) => void,
): void => {
	for (let dy = -1; dy <= 1; dy++)
		for (let dx = -1; dx <= 1; dx++) {
			const x = from.x + dx;
			const y = from.y + dy;
			if (x >= 0 && y >= 0 && x < l.w && y < l.h) f(x, y);
		}
	for (const r of roomsSeenFrom(l, from.x, from.y))
		for (let y = r.y - 1; y <= r.y + r.h; y++)
			for (let x = r.x - 1; x <= r.x + r.w; x++)
				if (x >= 0 && y >= 0 && x < l.w && y < l.h) f(x, y);
};

/**
 * 見えている部屋の出入口の先（通路の1マス目）。「見たことのある所」として地図に載せる
 * （今見えている所ではないので、そこにいる敵は見えない）。出入口が壁のくぼみに見えず、
 * 通路が続いているとわかるように。
 */
export const forEachExitPeek = (
	l: Layout,
	from: Pos,
	f: (x: number, y: number) => void,
): void => {
	for (const r of roomsSeenFrom(l, from.x, from.y))
		for (let y = r.y - 1; y <= r.y + r.h; y++)
			for (let x = r.x - 1; x <= r.x + r.w; x++) {
				const ring =
					x === r.x - 1 || x === r.x + r.w || y === r.y - 1 || y === r.y + r.h;
				if (!ring || tileAt(l, x, y) === T_WALL) continue;
				for (const [dx, dy] of [
					[0, -1],
					[1, 0],
					[0, 1],
					[-1, 0],
				]) {
					const nx = x + dx;
					const ny = y + dy;
					if (inRoomView(r, nx, ny) || tileAt(l, nx, ny) === T_WALL) continue;
					f(nx, ny);
				}
			}
};

/** 見えるマスのうち床（通れる所）かどうか。描画の明るさ用。 */
export const isOpen = (l: Layout, x: number, y: number): boolean =>
	tileAt(l, x, y) !== T_WALL;
