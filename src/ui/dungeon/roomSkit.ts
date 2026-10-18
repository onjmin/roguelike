// 敵の いない 大部屋の 寸劇（文は data/story/roomSkits.ts）。どれを 見たかを 別の 保存場所に 残す
// （保存できなくても この回は 覚えている）。入ったかどうかは ui/dungeon/play.ts が 1手ごとに 見る
// （core/mapgen.ts の enteredEmptyBigRoom）。

import { ROOM_SKITS, type RoomSkit } from "../../data/story/roomSkits";

const KEY = "kiriko-roguelike/roomSkits";

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
