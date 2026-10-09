// 季節の 行事の 施設（data/village/facilities.ts の FACILITIES の いちばん うしろ、町の 役所の さらに うしろに 足す。
// 外観の 字は 並び順で 割りふるので、いまの 施設の 字を ずらさない）。ここからは facilities.ts の 値を 読まない
// （facilities.ts が ここを 読むので、まわりこむと 読みこみの 順で こわれる）。
//
//   浜の すみ（西の はし x0〜1, y35〜36）：石を 組んだ かまどに 大鍋（はじめから。ふつうは 木の ふた）。
//   強行開催の 帰りだけ 火が 入り（ui/imoni.ts の imoniDecor）、実行委員と 名無し 2人が 立つ（when）。
//   絵は scripts/make-season.mjs が 書く public/sprites/season.png（手描きの 鍋と かまど）。

import {
	IMONI,
	IMONI_ART,
	IMONI_POT,
	IMONI_POT_THING,
	IMONI_STAFF,
	imoniShown,
} from "../imoni";
import type { Facility } from "./facilities";

/** 名無し（本館の 中の 人と 同じ 絵。facilities.ts の NANASHI と 同じ 並び）。 */
const NANASHI = ["sa:xjuotB", "sa:qPN3cT", "sa:C2hS8U", "sa:VaBXqn"] as const;

/** おんJ芋煮会の かまど（data/imoni.ts・ui/imoni.ts）。 */
const IMONI_FACILITY: Facility = {
	id: "imoni",
	name: "芋煮の　かまど",
	from: 0,
	at: IMONI_POT,
	look: {
		kind: "grid",
		ground: "sand",
		shadow: false,
		rows: ["ab", "cd"],
		keys: {
			a: [IMONI_ART.pot[0]],
			b: [IMONI_ART.pot[1]],
			c: [IMONI_ART.pot[2]],
			d: [IMONI_ART.pot[3]],
		},
	},
	outdoor: [
		// 大鍋（いつも 調べられる。文は ui/imoni.ts が 日と 記録で えらぶ）
		{ id: "pot", at: IMONI_POT_THING, lines: [], play: "imoni" },
		// 強行開催の 帰りだけ 立つ 人（セリフは こんにゃくの 決着で かわるので ui/imoni.ts）
		{
			id: "chair",
			at: IMONI_STAFF.chair,
			sprite: NANASHI[2],
			dir: "right",
			name: IMONI.names.chair,
			lines: [],
			play: "imoni",
			when: imoniShown,
		},
		{
			id: "pro",
			at: IMONI_STAFF.pro,
			sprite: NANASHI[1],
			dir: "left",
			name: IMONI.names.pro,
			lines: [],
			play: "imoni",
			when: imoniShown,
		},
		{
			id: "anti",
			at: IMONI_STAFF.anti,
			sprite: NANASHI[3],
			dir: "up",
			name: IMONI.names.anti,
			lines: [],
			play: "imoni",
			when: imoniShown,
		},
	],
};

/** 季節の 行事の 施設（FACILITIES の いちばん うしろ）。 */
export const SEASON_FACILITIES: readonly Facility[] = [IMONI_FACILITY];
