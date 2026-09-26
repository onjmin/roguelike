// 村のイベントを書くための部品（看板・人）。rpg の data/helpers.ts から。
// rpg の 宝箱・セーブ点・回復点は トルネコ1の村に合わないので 入れない（冒険の外で 強くならない）。

import type { EventDef, Script } from "../../engine/defs";
import type { Dir } from "../../engine/types";
import type { Speaker } from "../quotes";

/** 看板・置物（調べると 地の文が出る）。sprite を省くと 見えない（タイルの絵を そのまま調べる）。 */
export const sign = (
	id: string,
	x: number,
	y: number,
	text: string | Script,
	sprite?: string,
): EventDef => ({
	id,
	x,
	y,
	sprite,
	trigger: "talk",
	fixedDir: true,
	run:
		typeof text === "function"
			? text
			: async (s) => {
					await s.narrate(text);
				},
});

/**
 * 話しかけられる人。
 * talk は「セリフの配列」（話者は who）か、自由なスクリプト。
 * who は 仲間（data/cast.ts）。名前だけ変えたいモブは who を省いて name を渡す。
 */
export const npc = (
	id: string,
	x: number,
	y: number,
	sprite: string,
	talk: string[] | Script,
	opt: {
		who?: Speaker;
		name?: string;
		dir?: Dir;
		wander?: boolean;
		when?: EventDef["when"];
	} = {},
): EventDef => ({
	id,
	x,
	y,
	sprite,
	dir: opt.dir ?? "down",
	trigger: "talk",
	wander: opt.wander,
	when: opt.when,
	run:
		typeof talk === "function"
			? talk
			: async (s) => {
					for (const line of talk)
						await s.say(opt.who ?? null, line, { name: opt.name });
				},
});
