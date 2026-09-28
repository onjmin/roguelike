// 村の 建物の 中（喫茶・小屋・常識堂の 奥・倉庫。地図は data/village/rooms.ts、文は data/rooms.ts）。
// 入る・出るは どの 部屋も 同じ（扉の 音 → 暗転 → 中 → 明転。出口の マットで 外へ）。
// 喫茶の 中の 人と 注文は ui/cafe.ts。ここは 小屋・常識堂・倉庫の 調べる 物と、部屋の 地図を 組み立てる 入口。
// 中の 物は どれも 寄り道で、何も くれない（倉庫の 棚だけ 倉庫の 一覧を 開く。村の シヨ・メニューと 同じ 窓）。

import { TOWN_STAGES } from "../core/town";
import { KEEPER_LINE, ROOM_DOOR, ROOM_MSG, ROOM_NAMES } from "../data/rooms";
import { STAGE_NAMES } from "../data/town";
import { sign } from "../data/village/helpers";
import type { VillageView } from "../data/village/map";
import {
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
import type { Ctx } from "./ctx";
import { openStorage } from "./home";
import { fill } from "./villageTalk";

/** 部屋に 入る（扉の 文は 村に いるあいだ 部屋ごとに 1回。店番の「奥へ」は いつも 店番が 言う）。 */
export const enterRoom =
	(id: RoomId): Script =>
	async (s) => {
		const seen = `roomDoor:${id}`;
		if (!s.flag(seen)) {
			s.set(seen);
			await s.narrate(ROOM_DOOR[id]);
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
	return sign(p.id, p.x, p.y, async (s) => {
		await readAll(s, thingLines(id, kind, v.stage));
		// あずかった 物の 棚は 倉庫の 一覧（シヨ・メニューと 同じ）
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
		name: ROOM_NAMES[id],
		tiles: roomPalette(id, v.stage),
		rows: roomRows(id),
		outside: "#000",
		events: roomPlaces(id).map((p) => eventFor(ctx, id, p, v)),
	};
};
