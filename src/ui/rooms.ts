// 村の 建物の 中（喫茶・小屋・常識堂の 奥・倉庫。地図は data/village/rooms.ts、文は data/rooms.ts）。
// 入る・出るは どの 部屋も 同じ（扉の 音 → 暗転 → 中 → 明転。出口の マットで 外へ）。
// 喫茶の 中の 人と 注文は ui/cafe.ts。ここは 小屋・常識堂・倉庫の 調べる 物と、部屋の 地図を 組み立てる 入口。
// 中の 物は どれも 寄り道で、何も くれない（倉庫の 棚だけ 倉庫の 一覧を 開く。村の シヨと 同じ 窓）。

import { TOWN_STAGES } from "../core/town";
import { today } from "../data/calendar";
import { MOBS } from "../data/mobs";
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
	KEEPER_LINE,
	MUSIC_CLOSED,
	PIANO_MSG,
	ROOM_DOOR,
	ROOM_MSG,
	ROOM_NAMES,
} from "../data/rooms";
import { STAGE_NAMES } from "../data/town";
import { NANASHI_WALK } from "../data/village/hall";
import { npc, sign } from "../data/village/helpers";
import { stepOf, type VillageView } from "../data/village/map";
import {
	MUSIC_SEAT,
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
import { loadTown } from "../engine/save";
import { bathPeople } from "./bath";
import type { Ctx } from "./ctx";
import { openStorage } from "./home";
import { type ListItem, listWindow } from "./list";
import { openPiano } from "./piano";
import { fill } from "./villageTalk";

/** 部屋に 入る（扉の 文は 村に いるあいだ 部屋ごとに 1回。店番の「奥へ」は いつも 店番が 言う）。 */
export const enterRoom =
	(id: RoomId): Script =>
	async (s) => {
		const seen = `roomDoor:${id}`;
		if (!s.flag(seen)) {
			s.set(seen);
			await s.narrate(
				id === "store" && loadTown().stage >= BANK_FROM
					? BANK.door
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

/** 店番（ロゼ・シヨ）が 奥へ 入れてくれる。 */
export const keeperLets = async (
	s: Story,
	who: "roze" | "shiyo",
	id: RoomId,
): Promise<void> => {
	await s.say(who, KEEPER_LINE[who]);
	await enterRoom(id)(s);
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
		s.bgm("town");
		if (r.finished) await s.narrate(PIANO_DONE);
	};

/** 音楽室の 人（客席の 名無しと、段6 から ステージの レン）。 */
const musicPeople = (v: VillageView): EventDef[] => {
	const out: EventDef[] = [
		npc(
			"nanashi",
			MUSIC_SEAT[0],
			MUSIC_SEAT[1],
			NANASHI_WALK[2],
			async (s) => {
				for (const l of PIANO_MSG.nanashi)
					await s.say("nanj", l, { name: "名無し" });
				s.face("nanashi", "up");
			},
			{ dir: "up" },
		),
	];
	if (stepOf(v) >= MOBS.ren.from)
		out.push(
			npc(
				"mob_ren",
				MUSIC_STAGE[0],
				MUSIC_STAGE[1],
				MOBS.ren.sprite,
				async (s) => {
					for (const l of PIANO_MSG.ren)
						await s.say(null, l, {
							name: MOBS.ren.name,
							color: MOBS.ren.color,
							noPortrait: true,
						});
					s.face("mob_ren", "down");
				},
				{ dir: "down" },
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
	kind: string,
	stage: number,
): readonly string[] => {
	if (id === "hut" && kind === "plan") return planLines(stage);
	// 銀行に なった 倉庫は 一部の 物が 貸金庫の 文に
	if (id === "store" && stage >= BANK_FROM && kind in BANK.msg)
		return BANK.msg[kind as keyof typeof BANK.msg];
	const table = ROOM_MSG[id] as Record<string, readonly string[]>;
	return table[kind] ?? [];
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
		await readAll(s, thingLines(id, kind, v.stage));
		// あずかった 物の 棚は 倉庫の 一覧（シヨと 同じ）
		if (id === "store" && kind === "shelf") {
			await s.wait(0);
			await openStorage(ctx);
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
		],
	};
};
