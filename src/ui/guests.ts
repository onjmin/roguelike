// 帰りごとに 村の 施設に いる 人を 決める（喫茶の 客は ui/cafe.ts の cafeLayout が べつに 決める）。
// - 住人は それぞれ、いつもの 家の まわり・音楽室・本屋か 図書館・銭湯の どれか 1つに いる（家が いちばん 多い）。
//   歌う 子（レン・リノ・アル）は ときどき 音楽室の ステージに 立つ。
// - 名無しの 客（音楽室の 客席・男湯の 奥）の 数も 帰りごとに かわる。
// - 同じ 帰りなら 同じ（記録の 終わった 時刻から 決める）。村の 外の 家の まわりには いつも いる（喫茶と 同じ）。
// 文は data/guests.ts（銭湯は data/bath.ts）。

import { Rng } from "../core/rng";
import { BOOKSTORE_FROM, LIBRARY_FROM } from "../data/glossary";
import {
	BOOKS_GUESTS,
	MUSIC_GUESTS,
	STAGE_SINGERS,
	type StageSinger,
} from "../data/guests";
import { type MobId, movedIn } from "../data/mobs";
import { stepOf, type VillageView } from "../data/village/map";
import {
	BATH_SPOTS,
	BOOKS_BROWSE,
	MUSIC_SEATS,
	ROOM_FROM,
} from "../data/village/rooms";
import { loadRecords } from "../engine/save";

/** 銭湯に 来る 住人（女湯の 子と、男湯の ジェイトルマン）。 */
export const BATH_GUESTS: readonly MobId[] = [
	"ngoane",
	"onsu",
	"proto",
	"ren",
	"hinary",
	"jtleman",
];

/** この 帰りに 施設に いる 人。 */
export type Guests = {
	/** 音楽室の ステージで 歌う 子（いなければ null）。 */
	stage: StageSinger | null;
	music: MobId[];
	books: MobId[];
	bath: MobId[];
	/** 音楽室の 客席の 名無し・男湯の 奥の 名無し の 数。 */
	nanashi: { music: number; bath: number };
};

/** いまの 帰り（いちばん 新しい 記録の 時刻）。 */
export const returnAt = (): number => loadRecords()[0]?.at ?? 0;

/** 本屋か 図書館か（どちらも まだ 無ければ null）。 */
export const booksRoom = (v: VillageView): "bookstore" | "library" | null =>
	v.stage >= LIBRARY_FROM
		? "library"
		: v.stage >= BOOKSTORE_FROM
			? "bookstore"
			: null;

/** この 帰りの 施設の 人を 決める（at は 帰りの 時刻）。 */
export const guestsOf = (v: VillageView, at: number = returnAt()): Guests => {
	const rng = Rng.fromSeed(`guests:${at}`);
	const music = v.stage >= ROOM_FROM.music;
	const bath = v.stage >= ROOM_FROM.bath;
	const books = booksRoom(v);
	const step = stepOf(v);
	const moved = rng.shuffle(movedIn(step, v.cleared));
	const out: Guests = {
		stage: null,
		music: [],
		books: [],
		bath: [],
		nanashi: { music: 0, bath: 0 },
	};
	if (music) {
		const singers = moved.filter((id): id is StageSinger =>
			(STAGE_SINGERS as readonly string[]).includes(id),
		);
		if (singers.length && rng.chance(0.6)) out.stage = rng.pick(singers);
	}
	// 名無しで 埋まらない 客席を 住人に のこす
	const seats = MUSIC_SEATS.length - 1;
	for (const id of moved) {
		if (id === out.stage) continue;
		// 行ける 所と その 見こみ（ヒナリーは 図書館の 監修なので 本に 寄る）
		const can: [keyof Pick<Guests, "music" | "books" | "bath">, number][] = [];
		if (music && MUSIC_GUESTS[id] && out.music.length < seats)
			can.push(["music", 0.15]);
		if (
			books &&
			BOOKS_GUESTS[id] &&
			out.books.length < BOOKS_BROWSE[books].length
		)
			can.push(["books", id === "hinary" ? 0.45 : 0.15]);
		if (bath && BATH_GUESTS.includes(id)) can.push(["bath", 0.3]);
		let r = rng.float();
		for (const [where, p] of can) {
			if (r < p) {
				out[where].push(id);
				break;
			}
			r -= p;
		}
	}
	out.nanashi.music = Math.min(
		MUSIC_SEATS.length - out.music.length,
		rng.int(3) + (out.stage || out.music.length ? 0 : 1),
	);
	out.nanashi.bath = rng.int(BATH_SPOTS.menBack.length + 1);
	return out;
};
