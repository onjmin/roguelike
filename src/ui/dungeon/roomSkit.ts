// 敵の いない 大部屋の 寸劇（文は data/story/roomSkits.ts）。どれを 見たかを 別の 保存場所に 残す
// （保存できなくても この回は 覚えている）。入ったかどうかは ui/dungeon/play.ts が 1手ごとに 見る。

import { type Layout, roomAt } from "../../core/mapgen";
import type { Monster } from "../../core/types";
import { ROOM_SKITS, type RoomSkit } from "../../data/story/roomSkits";

const KEY = "kiriko-roguelike/roomSkits";

/** 大部屋と みなす 床の 大きさ（ふつうの 部屋は いちばん 広くて 15x8）。 */
export const BIG_ROOM = { w: 12, h: 7 } as const;
/** レスと レスの 間（ms）。 */
export const ROOM_SKIT_MS = 900;

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
export const forgetRoomSkits = (): void => {
	memo = [];
};

/**
 * 前の マスから この マスへ 動いて、敵の いない 大部屋に 入ったか。部屋の 中の 敵は 見えて いなくても 数える
 * （入った とたんに 寝ていた 敵が 見えて 「だれもおらん」が うそに ならないように）。
 */
export const enteredEmptyBigRoom = (
	l: Layout,
	from: { x: number; y: number },
	to: { x: number; y: number },
	monsters: readonly Monster[],
): boolean => {
	const id = roomAt(l, to.x, to.y);
	if (id < 0 || id === roomAt(l, from.x, from.y)) return false;
	const r = l.rooms.find((x) => x.id === id);
	if (!r || r.w < BIG_ROOM.w || r.h < BIG_ROOM.h) return false;
	return !monsters.some((m) => m.hp > 0 && roomAt(l, m.x, m.y) === id);
};

/** まだ 見て いない 寸劇を 1本 えらんで 見た ことに する（ぜんぶ 見たら null）。 */
export const takeRoomSkit = (): RoomSkit | null => {
	const seen = load();
	const sk = ROOM_SKITS.find((x) => !seen.includes(x.key));
	if (!sk) return null;
	memo = [...seen, sk.key];
	try {
		localStorage.setItem(KEY, JSON.stringify(memo));
	} catch {
		// 保存できなくても 遊べる
	}
	return sk;
};
