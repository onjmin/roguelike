// 議会の 日の 村（CIVIC.md §1.2・§4）。決まりと 文は data/civic.ts、顔ぶれは ui/guests.ts の assemblyToday。
// - 町役場（段4〜6）・市役所（段7）の 議席と 役（議長・書記・中継）の 住人。市役所で おんちゃんが 来ない
//   議会の 日は 名無しの 議長。住人は 1窓ずつ。
// - 段3 の 寄り合い：議会の 日だけ 住人が 1〜2人、レンガ館に 来る（段2 の 集会所は せまいので 来ない）。
// - まとめ掲示板：段2〜3 は「寄り合いの　はり紙」（1回の 帰りに 議題 1つ。はじめてだけ 前置き）、
//   段4 から「議会だより」。段4〜5 の レンガ館の 告知に「寄り合いは　町役場に　うつりました」。
// どれも 寄り道で、強さ・冒険の 乱数・記録には 何も 効かない（保存は kiriko-roguelike/civic の 前置きの 印だけ）。

import {
	AGENDA,
	ASSEMBLY_LINES,
	type Assembly,
	agendaOf,
	assemblyRoom,
	CIVIC_BOARD,
	dayoriOf,
	NANASHI_CHAIR,
	ROLES,
	SEATS,
	TOWNHALL_FROM,
	YORIAI_FROM,
	YORIAI_SPOTS,
} from "../data/civic";
import { MOBS, type MobId } from "../data/mobs";
import type { Facility } from "../data/village/facilities";
import type { HallTier } from "../data/village/hall";
import { npc } from "../data/village/helpers";
import type { VillageView } from "../data/village/map";
import type { EventDef, Script, Story } from "../engine/defs";
import type { Dir } from "../engine/types";
import { loadCivic, saveCivic } from "./debate";
import { assemblyToday, returnAt } from "./guests";
import { sayAs } from "./villageMobs";
import { fill } from "./villageTalk";

/** 名無し（本館の 中の 人と 同じ 絵）。 */
const NANASHI_WALK = "sa:VaBXqn";

/** 住人の 1窓（議席・寄り合い）。 */
const memberScript =
	(id: MobId, eid: string, dir: Dir): Script =>
	async (s) => {
		const line = ASSEMBLY_LINES[id];
		if (line) await sayAs(s, id, line);
		s.face(eid, dir);
	};

/** 議席・役の 住人の イベント（部屋の 座標。上を 向いて 座る・役は 下を 向く）。 */
const member = (id: MobId, x: number, y: number, dir: Dir): EventDef => {
	const eid = `asm_${id}`;
	return npc(eid, x, y, MOBS[id].sprite, memberScript(id, eid, dir), { dir });
};

/**
 * 町役場・市役所の 議会の 日の 人（議席の 住人と、市役所の 役。おんちゃんが 来なければ 名無しの 議長）。
 * 議会の ない 日・ほかの 施設は 空。a は 試験で わたす。
 */
export const assemblyEvents = (
	f: Facility,
	v: VillageView,
	a: Assembly = assemblyToday(v),
): EventDef[] => {
	const room = assemblyRoom(v.stage);
	if (!a.session || f.id !== room) return [];
	if (room !== "townhall" && room !== "cityhall") return [];
	const out: EventDef[] = a.seats.flatMap((id, i) => {
		const at = SEATS[room][i];
		return at ? [member(id, at.x, at.y, "up")] : [];
	});
	if (room === "cityhall") {
		for (const r of ROLES) {
			const id = a[r.role];
			if (id) out.push(member(id, r.at.x, r.at.y, "down"));
		}
		// おんちゃんが 来ない 議会の 日は 名無しの 議長
		const seat = ROLES.find((r) => r.role === "chair")?.at;
		if (!a.chair && seat)
			out.push(
				npc(
					"asm_chair",
					seat.x,
					seat.y,
					NANASHI_WALK,
					async (s) => {
						await s.say("nanj", NANASHI_CHAIR.line, {
							name: NANASHI_CHAIR.name,
						});
						s.face("asm_chair", "down");
					},
					{ dir: "down" },
				),
			);
	}
	return out;
};

/** 寄り合いの 日に レンガ館へ 来た 住人（本館の 中。段3）。 */
export const yoriaiEvents = (
	v: VillageView,
	tier: HallTier,
	a: Assembly = assemblyToday(v),
): EventDef[] => {
	if (!a.session || assemblyRoom(v.stage) !== "yoriai") return [];
	const spots = YORIAI_SPOTS[tier] ?? [];
	return a.seats.flatMap((id, i) => {
		const at = spots[i];
		return at ? [member(id, at.x, at.y, "down")] : [];
	});
};

/** まとめ掲示板の メニューの 1行（段2〜3 は 寄り合い、段4 から 議会だより。まだ なら null）。 */
export const civicBoardMenu = (stage: number): string | null =>
	stage >= TOWNHALL_FROM
		? CIVIC_BOARD.dayoriMenu
		: stage >= YORIAI_FROM
			? CIVIC_BOARD.yoriaiMenu
			: null;

/**
 * まとめ掲示板の 寄り合いの はり紙（はじめてだけ 前置き → 議題 → 結果と なお〜）と 議会だより（1窓）。
 * 議題は 1回の 帰りに 1つ（帰りの 時刻で 決める）。
 */
export const civicBoardScript = async (
	s: Story,
	stage: number,
	at: number = returnAt(),
): Promise<void> => {
	if (stage >= TOWNHALL_FROM) {
		await s.narrate(fill(CIVIC_BOARD.dayori, { ...dayoriOf(at) }));
		return;
	}
	const m = loadCivic();
	if (!m.soukai) {
		await s.narrate(CIVIC_BOARD.soukai);
		m.soukai = true;
		saveCivic(m);
	}
	const a = agendaOf(stage, at) ?? AGENDA[0];
	await s.narrate(a.notice);
	await s.narrate(a.result);
};

/** 段4〜5 の レンガ館の 告知の はり紙（寄り合いは 町役場へ。ほかの 段は null）。 */
export const yoriaiMovedLine = (stage: number): string | null =>
	stage >= TOWNHALL_FROM && stage < 6 ? CIVIC_BOARD.moved : null;
