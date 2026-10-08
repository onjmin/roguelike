// 町が 育つと 建つ 施設の スクリプト（形と 文は data/village/facilities.ts）。
// 入る・出るは ほかの 建物と 同じ（扉の 文は 村に いる あいだ 1回 → 扉の 音 → 暗転 → 中 → 明転。出口の マットで 外へ）。
// 外の 物（釣り場の 竿・グラウンドの マウンド）は 調べると 文、遊べる 物は そのあと 遊ぶか 聞く。
// どれも 寄り道で、強さにも 冒険にも 何も 残さない（釣れた 物は すぐ 海に かえす）。

import { FISHING, GROUND_BAT } from "../data/facilities";
import { awayFriends } from "../data/story";
import {
	type Facility,
	facilityEntry,
	facilityMapId,
	facilityOutside,
	facilityRoomPalette,
	facilityRoomPlaces,
	facilityRoomRows,
	facilityShadows,
	type OutdoorThing,
} from "../data/village/facilities";
import { npc, sign } from "../data/village/helpers";
import type { VillageView } from "../data/village/map";
import type { EventDef, MapDef, Script, Story } from "../engine/defs";
import { loadProgress } from "../engine/save";
import { TILE } from "../engine/types";
import type { Ctx } from "./ctx";
import { playBatting } from "./minigames";

/** 調べる 物の 窓（窓ごと）。 */
const readAll = async (s: Story, lines: readonly string[]): Promise<void> => {
	for (const t of lines) await s.narrate(t);
};

/** 施設に 入る（扉の 文は 村に いる あいだ 1回）。 */
export const enterFacility =
	(f: Facility): Script =>
	async (s) => {
		const seen = `roomDoor:${facilityMapId(f)}`;
		if (f.door && !s.flag(seen)) {
			s.set(seen);
			await s.narrate(f.door);
		}
		s.se("door");
		await s.fadeOut(250);
		const e = facilityEntry(f);
		await s.warp(facilityMapId(f), e.x, e.y, e.dir);
		await s.fadeIn(250);
	};

/** 出口の マット：扉の 音 → 暗転 → 村（扉の 前）→ 明転。 */
const leaveFacility =
	(f: Facility): Script =>
	async (s) => {
		s.se("door");
		await s.fadeOut(250);
		const o = facilityOutside(f);
		await s.warp("village", o.x, o.y, o.dir);
		await s.fadeIn(250);
	};

/** 釣り（竿を たらして、何かが かかる。すぐ 海に かえす）。見た目の 乱数なので Math.random。 */
const fish = async (s: Story): Promise<void> => {
	if ((await s.choose([...FISHING.menu], { cancel: 1 })) !== 0) return;
	await s.narrate(FISHING.cast);
	const pick =
		FISHING.catches[Math.floor(Math.random() * FISHING.catches.length)];
	await s.narrate(pick);
};

/** グラウンドの 1打席（投げるのは やきう。出ていった あとは 名無し）。 */
const bat = async (ctx: Ctx, s: Story): Promise<void> => {
	if ((await s.choose([...GROUND_BAT.menu], { cancel: 1 })) !== 0) return;
	await s.wait(0);
	const gone = awayFriends(loadProgress().cleared).includes("nanj");
	const hit = await playBatting(ctx, {
		title: GROUND_BAT.title,
		pitcher: gone ? GROUND_BAT.pitcherGone : GROUND_BAT.pitcher,
	});
	await s.narrate(hit ? GROUND_BAT.hit : GROUND_BAT.out);
};

/** 外に 置く 物（地図の マス。調べると 文、遊べる 物は 遊ぶか 聞く）。 */
export const outdoorScript =
	(ctx: Ctx, t: OutdoorThing): Script =>
	async (s) => {
		await readAll(s, t.lines);
		if (t.play === "fishing") await fish(s);
		else if (t.play === "batting") await bat(ctx, s);
	};

/**
 * 建物の 影（村の 地図の 飾り。右がわの 地面に 斜めの 影。キャラの 上にも 重なるので、影に 入ると 少し 暗く 見える）。
 */
export const shadowDecor = (stage: number): MapDef["decor"] => {
	const list = facilityShadows(stage);
	if (!list.length) return undefined;
	const T = TILE;
	return (g, ox, oy) => {
		g.save();
		g.fillStyle = "rgba(10, 16, 30, 0.22)";
		for (const s of list) {
			const x = s.x * T - ox;
			const top = s.top * T - oy;
			const bottom = s.bottom * T - oy;
			g.beginPath();
			g.moveTo(x, top);
			g.lineTo(x + 10, top + 10);
			g.lineTo(x + 10, bottom + 4);
			g.lineTo(x, bottom);
			g.closePath();
			g.fill();
		}
		g.restore();
	};
};

/** 施設の 中の 地図。曲は 村の まま。 */
export const buildFacility = (
	f: Facility,
	_v: VillageView,
	_ctx: Ctx,
	/** 駅の 改札などから 出かける（村の 口と 同じ 流れ。ui/villageEvents.ts の departAnywhere）。 */
	depart?: Script,
): MapDef => {
	const room = f.room;
	const events: EventDef[] = facilityRoomPlaces(f).map((p) => {
		if (p.trigger === "touch")
			return {
				id: p.id,
				x: p.x,
				y: p.y,
				trigger: "touch",
				through: true,
				run: leaveFacility(f),
			};
		const kind = p.id.replace(/_\d+$/, "");
		return sign(p.id, p.x, p.y, async (s) => {
			await readAll(s, room?.lines[kind] ?? []);
			if (room?.plays?.[kind] === "depart" && depart) await depart(s);
		});
	});
	for (const who of room?.people ?? [])
		events.push(
			npc(
				who.id,
				who.at[0],
				who.at[1],
				who.walk,
				async (s) => {
					for (const l of who.lines) await s.say("nanj", l, { name: who.name });
					s.face(who.id, who.dir);
				},
				{ dir: who.dir },
			),
		);
	return {
		id: facilityMapId(f),
		name: f.name,
		tiles: facilityRoomPalette(f),
		rows: facilityRoomRows(f),
		outside: "#000",
		events,
	};
};
