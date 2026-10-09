// 帰りごとに 村の 施設に いる 人を 決める（喫茶の 客は ui/cafe.ts の cafeLayout が べつに 決める）。
// - 住人は それぞれ、いつもの 家の まわり・音楽室・本屋か 図書館・銭湯の どれか 1つに いる（家が いちばん 多い）。
//   歌う 子（レン・リノ・アル）は ときどき 音楽室の ステージに 立つ。
// - 名無しの 客（音楽室の 客席・男湯の 奥）の 数も 帰りごとに かわる。
// - 同じ 帰りなら 同じ（記録の 終わった 時刻から 決める）。村の 外の 家の まわりには いつも いる（喫茶と 同じ）。
// - 議会の 日（data/civic.ts）は 議席・寄り合いの 住人を 施設から 外す（議会の ない 日の 顔ぶれは かえない）。
//   deep の 節目を まだ 見て いない 子は 帰りごとに 1回 決めて とめる（帰りの とちゅうで 聞いても 顔ぶれは かえない）。
// 文は data/guests.ts（銭湯は data/bath.ts）。

import { Rng } from "../core/rng";
import { type Today, today } from "../data/calendar";
import { type Assembly, assemblyMembers, assemblyOf } from "../data/civic";
import { BOOKSTORE_FROM, LIBRARY_FROM } from "../data/glossary";
import {
	BOOKS_GUESTS,
	MUSIC_GUESTS,
	STAGE_SINGERS,
	type StageSinger,
} from "../data/guests";
import { MOB_IDS, type MobId, movedIn } from "../data/mobs";
import { stepOf, type VillageView } from "../data/village/map";
import {
	BATH_SPOTS,
	BOOKS_BROWSE,
	MUSIC_SEATS,
	ROOM_FROM,
} from "../data/village/rooms";
import { loadRecords } from "../engine/save";
import { deepPending } from "./villageMobs";

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

/**
 * この 帰りの 施設の 人を 決める（at は 帰りの 時刻、t は 今日）。議会の 日は 議席・寄り合いの 住人を
 * 音楽室・本屋・銭湯から 外す（二重に いない）。議会の ない 日の 顔ぶれは もとの まま。
 */
export const guestsOf = (
	v: VillageView,
	at: number = returnAt(),
	t: Today = today(),
): Guests => {
	const g = baseGuests(v, at);
	const away = assemblyMembers(assemblyFrom(v, at, t, g.stage));
	if (!away.length) return g;
	const keep = (list: MobId[]) => list.filter((id) => !away.includes(id));
	return {
		...g,
		music: keep(g.music),
		books: keep(g.books),
		bath: keep(g.bath),
	};
};

/** deep の 節目を まだ 見て いない 子（帰りの 時刻ごとに とめた もの）。 */
let pendingMemo: { at: number; ids: readonly MobId[] } | null = null;
/** 読みこみ なおしても 同じ 帰りなら 同じに なるよう、タブの あいだ 写して おく 鍵（sessionStorage。記録では ない）。 */
const PENDING_KEY = "kiriko-roguelike/assembly-pending";

const readPending = (at: number): MobId[] | null => {
	try {
		const raw = sessionStorage.getItem(PENDING_KEY);
		if (!raw) return null;
		const o = JSON.parse(raw) as { at?: unknown; ids?: unknown };
		if (o.at !== at || !Array.isArray(o.ids)) return null;
		return o.ids.filter((x): x is MobId =>
			(MOB_IDS as readonly unknown[]).includes(x),
		);
	} catch {
		return null;
	}
};

const writePending = (memo: { at: number; ids: readonly MobId[] }): void => {
	try {
		sessionStorage.setItem(PENDING_KEY, JSON.stringify(memo));
	} catch {
		// 使えない ときは この 回の 写しだけ
	}
};

/**
 * deep の 節目を まだ 見て いない 子（その 子は 家に いて、議席・寄り合いには 来ない）。帰りごとに はじめて
 * 聞かれた ときの まま とめる：帰りの とちゅうで 節目を 聞いても、ほかの 子の 顔ぶれまで 引きなおさない
 * （聞いた 子は 次の 帰りから 来る）。
 */
const pendingAt = (at: number): readonly MobId[] => {
	if (pendingMemo?.at === at) return pendingMemo.ids;
	const ids = readPending(at) ?? MOB_IDS.filter(deepPending);
	pendingMemo = { at, ids };
	writePending(pendingMemo);
	return ids;
};

/** 試験用：とめた deep の 節目を 忘れる（保存の 場所を 入れかえた とき）。 */
export const forgetGuestsMemo = (): void => {
	pendingMemo = null;
	try {
		sessionStorage.removeItem(PENDING_KEY);
	} catch {
		// 使えない ときは 何もしない
	}
};

/** 議会の 顔ぶれ（候補は 越してきた 住人 − 舞台で 歌う 子 − deep の 節目を まだ 見て いない 子）。 */
const assemblyFrom = (
	v: VillageView,
	at: number,
	t: Today,
	singer: MobId | null,
): Assembly => {
	const pending = pendingAt(at);
	return assemblyOf(
		v.stage,
		at,
		t,
		movedIn(stepOf(v), v.cleared).filter(
			(id) => id !== singer && !pending.includes(id),
		),
	);
};

/** この 帰りの 議会の 顔ぶれ（議会の ない 日は だれも いない。data/civic.ts）。 */
export const assemblyToday = (
	v: VillageView,
	at: number = returnAt(),
	t: Today = today(),
): Assembly => assemblyFrom(v, at, t, baseGuests(v, at).stage);

/** 議会を 入れない 帰りの 施設の 人（帰りの 種だけで 決める）。 */
const baseGuests = (v: VillageView, at: number): Guests => {
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
