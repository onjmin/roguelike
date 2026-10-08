// 村の 建物の 中（喫茶・小屋・常識堂の 奥・倉庫。地図は data/village/rooms.ts、文は data/rooms.ts）。
// 入る・出るは どの 部屋も 同じ（扉の 音 → 暗転 → 中 → 明転。出口の マットで 外へ）。
// 喫茶の 中の 人と 注文は ui/cafe.ts。ここは 小屋・常識堂・倉庫の 調べる 物と、部屋の 地図を 組み立てる 入口。
// 中の 物は どれも 寄り道で、何も くれない（倉庫の 棚だけ 倉庫の 一覧を 開く。引き取るのは ここ）。

import { Rng } from "../core/rng";
import { TOWN_STAGES } from "../core/town";
import { today } from "../data/calendar";
import { BOOKS_GUESTS, MUSIC_GUESTS, STAGE_LINES } from "../data/guests";
import { MOBS, type MobId } from "../data/mobs";
import {
	guideKeys,
	PIANO_BASE,
	PIANO_DONE,
	PIANO_GUIDES,
	PIANO_MENU,
} from "../data/piano";
import {
	BANK,
	BANK_FROM,
	BOOKS_KEEPER_LINES,
	LIBRARY_HINARY,
	MUSIC_CLOSED,
	PIANO_MSG,
	ROOM_DOOR,
	ROOM_MSG,
	ROOM_NAMES,
} from "../data/rooms";
import { awayFriends } from "../data/story";
import { STAGE_NAMES } from "../data/town";
import { NANASHI_WALK } from "../data/village/hall";
import { npc, sign } from "../data/village/helpers";
import type { VillageView } from "../data/village/map";
import {
	BOOKS_BROWSE,
	BOOKS_KEEPER,
	MUSIC_SEATS,
	MUSIC_STAGE,
	ROOM_OUTSIDE,
	type RoomId,
	type RoomPlace,
	roomEntry,
	roomPalette,
	roomPlaces,
	roomRows,
	type Spot,
} from "../data/village/rooms";
import type { EventDef, MapDef, Script, Story } from "../engine/defs";
import { loadProgress, loadTown } from "../engine/save";
import { bathPeople, bathSteam } from "./bath";
import type { Ctx } from "./ctx";
import { readShelf } from "./glossary";
import { guestsOf, returnAt } from "./guests";
import { openStorage } from "./home";
import { type ListItem, listWindow } from "./list";
import { openPiano } from "./piano";
import { sayAs } from "./villageMobs";
import { villageSong } from "./villageMusic";
import { fill } from "./villageTalk";

/** 部屋に 入る（扉の 文は 村に いるあいだ 部屋ごとに 1回。銀行・やきうの いない 小屋は 文が かわる）。 */
export const enterRoom =
	(id: RoomId): Script =>
	async (s) => {
		const seen = `roomDoor:${id}`;
		if (!s.flag(seen)) {
			s.set(seen);
			await s.narrate(
				id === "store" && loadTown().stage >= BANK_FROM
					? BANK.door
					: id === "hut" && nanjGone()
						? ROOM_DOOR.hutGone
						: ROOM_DOOR[id],
			);
		}
		s.se("door");
		await s.fadeOut(250);
		const e = roomEntry(id);
		await s.warp(id, e.x, e.y, e.dir);
		await s.fadeIn(250);
	};

/** 出口の マット：扉の 音 → 暗転 → 村（部屋ごとの 所）→ 明転。 */
export const leaveRoom =
	(id: RoomId): Script =>
	async (s) => {
		s.se("door");
		await s.fadeOut(250);
		const o = ROOM_OUTSIDE[id];
		await s.warp("village", o.x, o.y, o.dir);
		await s.fadeIn(250);
	};

/** 週末（土・日。端末の 曜日。開発中は &wday= で 決め打ち）。音楽室が 開く。 */
export const isWeekend = (): boolean => {
	const w = today().w;
	return w === 0 || w === 6;
};

/** 音楽室の 扉：週末なら 中へ。平日は はり紙を 読んで 1歩 もどる。 */
export const enterMusic: Script = async (s) => {
	if (!isWeekend()) {
		await s.narrate(MUSIC_CLOSED);
		await s.move("player", "d");
		return;
	}
	await enterRoom("music")(s);
};

/**
 * ピアノ：プレイヤーが 12鍵を 自由に 弾く（ui/piano.ts）か、劇中の 曲の 主旋律の ガイドで 弾く。
 * 弾いている あいだは 村の 曲を 止める（押した 音だけ 聞こえるように）。最後まで 弾けたら 拍手。
 */
const pianoScript =
	(ctx: Ctx): Script =>
	async (s) => {
		await readAll(s, ROOM_MSG.music.piano);
		const n = await s.choose([...PIANO_MENU], { cancel: 2 });
		if (n === 2) return;
		let title = "ピアノ";
		let guide: number[] | undefined;
		if (n === 1) {
			await s.wait(0);
			const v = await listWindow(
				ctx,
				"どの　曲に　する？",
				PIANO_GUIDES.map((t): ListItem => ({ label: t.name, value: t.id })),
				{ closeLabel: "やめる" },
			);
			const song = PIANO_GUIDES.find((t) => t.id === v);
			if (!song) return;
			title = song.name;
			guide = guideKeys(song.notes).map((k) => PIANO_BASE + k);
		}
		await s.wait(0);
		s.bgm(null);
		await ctx.audio.preparePiano();
		const r = await openPiano(ctx, { title, guide });
		s.bgm(villageSong());
		if (r.finished) await s.narrate(PIANO_DONE);
	};

/** 施設に 来ている 住人（話して もとの 向きへ）。 */
const guest = (
	id: MobId,
	at: Spot,
	lines: readonly string[],
	eid = `guest_${id}`,
): EventDef =>
	npc(
		eid,
		at.x,
		at.y,
		MOBS[id].sprite,
		async (s) => {
			for (const l of lines) await sayAs(s, id, l);
			s.face(eid, at.dir);
		},
		{ dir: at.dir },
	);

/** 音楽室の 人（帰りごとに かわる。ステージで 歌う 子・客席の 住人と 名無し。ui/guests.ts）。 */
const musicPeople = (v: VillageView): EventDef[] => {
	const at = returnAt();
	const g = guestsOf(v, at);
	const seats = Rng.fromSeed(`music:${at}`).shuffle([...MUSIC_SEATS]);
	const out: EventDef[] = [];
	if (g.stage) {
		const [x, y] = MUSIC_STAGE;
		out.push(
			guest(
				g.stage,
				{ x, y, dir: "down" },
				g.stage === "ren" ? PIANO_MSG.ren : STAGE_LINES[g.stage],
			),
		);
	}
	g.music.forEach((id, i) => {
		out.push(guest(id, seats[i], MUSIC_GUESTS[id] ?? []));
	});
	for (let i = 0; i < g.nanashi.music; i++) {
		const seat = seats[g.music.length + i];
		const id = `nanashi_${i}`;
		out.push(
			npc(
				id,
				seat.x,
				seat.y,
				NANASHI_WALK[(2 + i) % NANASHI_WALK.length],
				async (s) => {
					for (const l of PIANO_MSG.nanashi)
						await s.say("nanj", l, { name: "名無し" });
					s.face(id, seat.dir);
				},
				{ dir: seat.dir },
			),
		);
	}
	return out;
};

/** 図書館の 読書の 机の ヒナリーの 所（左の いす。右の いすは 下の 植木鉢の 葉に かくれる）。 */
const HINARY_AT: Spot = { x: 12, y: 7, dir: "up" };

/**
 * 本屋の 店番・図書館の 司書（名無し。机の となり）と、帰りごとに 立ち読みに 来ている 住人（ui/guests.ts）。
 * ヒナリーは 図書館なら 読書の 机で 監修の 話。
 */
const booksPeople = (
	id: "bookstore" | "library",
	v: VillageView,
): EventDef[] => {
	const at = BOOKS_KEEPER[id];
	const ret = returnAt();
	const spots = Rng.fromSeed(`books:${ret}`).shuffle([...BOOKS_BROWSE[id]]);
	const out: EventDef[] = [];
	let k = 0;
	for (const who of guestsOf(v, ret).books) {
		if (who === "hinary" && id === "library")
			out.push(guest(who, HINARY_AT, LIBRARY_HINARY, "lib_hinary"));
		else if (k < spots.length)
			out.push(guest(who, spots[k++], BOOKS_GUESTS[who] ?? []));
	}
	out.push(
		npc(
			"nanashi",
			at.x,
			at.y,
			NANASHI_WALK[id === "bookstore" ? 1 : 3],
			async (s) => {
				for (const l of BOOKS_KEEPER_LINES[id])
					await s.say("nanj", l, {
						name: id === "bookstore" ? "店番" : "司書",
					});
				s.face("nanashi", at.dir);
			},
			{ dir: at.dir },
		),
	);
	return out;
};

/** 部屋から 出たときに 立つ 村の 所（リプレイで 出た ときも）。 */
export const roomOutside = (id: RoomId): Spot => ROOM_OUTSIDE[id];

/** 調べる 物の 窓（窓ごと）。 */
const readAll = async (s: Story, lines: readonly string[]): Promise<void> => {
	for (const t of lines) await s.narrate(t);
};

/** やきうが 出ていった あとか（電池板の 山場。data/story.ts の awayFriends）。 */
const nanjGone = (): boolean =>
	awayFriends(loadProgress().cleared).includes("nanj");

/** 小屋の 設計図（次の 段の 名前。いちばん 上なら 完成）。 */
export const planLines = (stage: number): readonly string[] =>
	stage + 1 < TOWN_STAGES
		? ROOM_MSG.hut.plan.map((t) =>
				fill(t, { next: STAGE_NAMES[stage + 1] ?? "" }),
			)
		: ROOM_MSG.hut.planTop;

/** 調べる 物の 文（部屋と 物の 種類）。 */
export const thingLines = (
	id: Exclude<RoomId, "cafe">,
	place: string,
	stage: number,
): readonly string[] => {
	// 同じ 物が 並ぶなら、その 1つだけの 文（books_1 など）が あれば それ
	const kind = place.replace(/_\d+$/, "");
	if (id === "hut" && kind === "plan") return planLines(stage);
	// やきうが 出ていった あとの 小屋（ナイターは 鳴らず、火は 落ちている）
	if (id === "hut" && nanjGone() && kind in ROOM_MSG.hutGone)
		return ROOM_MSG.hutGone[kind as keyof typeof ROOM_MSG.hutGone];
	// 銀行に なった 倉庫は 一部の 物が 貸金庫の 文に
	if (id === "store" && stage >= BANK_FROM && kind in BANK.msg)
		return BANK.msg[kind as keyof typeof BANK.msg];
	const table = ROOM_MSG[id] as Record<string, readonly string[]>;
	return table[place] ?? table[kind] ?? [];
};

const eventFor = (
	ctx: Ctx,
	id: Exclude<RoomId, "cafe">,
	p: RoomPlace,
	v: VillageView,
): EventDef => {
	if (p.trigger === "touch")
		return {
			id: p.id,
			x: p.x,
			y: p.y,
			trigger: "touch",
			through: true,
			run: leaveRoom(id),
		};
	const kind = p.id.replace(/_\d+$/, "");
	if (id === "music" && kind === "piano")
		return sign(p.id, p.x, p.y, pianoScript(ctx));
	return sign(p.id, p.x, p.y, async (s) => {
		await readAll(s, thingLines(id, p.id, v.stage));
		// あずかった 物の 棚は 倉庫の 一覧（引き取る。ui/home.ts）
		if (id === "store" && kind === "shelf") {
			await s.wait(0);
			await openStorage(ctx);
		}
		// 本屋・図書館の 本棚は 棚ごとに ちがう ことばの 本（町の 段で 読める ことばが ふえる）
		if ((id === "bookstore" || id === "library") && kind === "shelf") {
			const n = roomPlaces(id).filter((q) => q.id.startsWith("shelf_")).length;
			await readShelf(s, Number(p.id.replace("shelf_", "")), n);
		}
	});
};

/** 部屋の 地図（喫茶は ui/cafe.ts の buildCafe）。曲は 村の まま。 */
export const buildRoom = (
	id: Exclude<RoomId, "cafe">,
	v: VillageView,
	ctx: Ctx,
): MapDef => {
	return {
		id,
		name: id === "store" && v.stage >= BANK_FROM ? BANK.name : ROOM_NAMES[id],
		tiles: roomPalette(id, v.stage),
		rows: roomRows(id),
		outside: "#000",
		events: [
			...roomPlaces(id).map((p) => eventFor(ctx, id, p, v)),
			...(id === "music" ? musicPeople(v) : []),
			...(id === "bath" ? bathPeople(v) : []),
			...(id === "bookstore" || id === "library" ? booksPeople(id, v) : []),
		],
		decor: id === "bath" ? bathSteam() : undefined,
	};
};
