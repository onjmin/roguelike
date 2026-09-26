// 村（保守村）に立つ人たち。名前・色は quotes.ts の SPEAKERS、歩行グラ・立ち絵は rpg の cast.ts と同じ。
// 歩行グラは RPGEN 形式（16x16・2コマ×4方向）。立ち絵は public/portraits/ の透過 PNG（右向きに描いた絵。
// 右に立つときは ui/message.ts が左右反転する）。おんJ民は 立ち絵が無いので 出さない（ダミーも出さない）。
// キリコは しゃべらないので ここには入れない（歩行グラだけ KIRIKO_WALK）。

import { SPEAKERS, type Speaker } from "./quotes";

export type CastDef = {
	name: string;
	color: string;
	/** 歩行グラ（`sa:<id>`）。 */
	walk: string;
	portrait?: { src: string; side: "left" | "right"; scale?: number };
};

const WALK: Record<Speaker, string> = {
	nanj: "sa:29aYeF",
	roze: "sa:mHhx69",
	feris: "sa:4KtOzD",
	teto: "sa:3xUW5Y",
	rei: "sa:TI21YC",
};

const PORTRAIT: Partial<Record<Speaker, CastDef["portrait"]>> = {
	roze: { src: "portraits/roze.png", side: "right" },
	teto: { src: "portraits/teto.png", side: "right" },
	rei: { src: "portraits/rei.png", side: "right" },
	// 頭の大きい絵なので 少し小さく（rpg と同じ）
	feris: { src: "portraits/feris.png", side: "right", scale: 0.9 },
};

export const CAST: Record<Speaker, CastDef> = Object.fromEntries(
	(Object.keys(SPEAKERS) as Speaker[]).map((id) => [
		id,
		{ ...SPEAKERS[id], walk: WALK[id], portrait: PORTRAIT[id] },
	]),
) as Record<Speaker, CastDef>;

/** キリコの歩行グラ。 */
export const KIRIKO_WALK = "pub:sprites/kiriko.png";

/** とうすこ（1階の敵）。村では キリコの あとを うろうろ している。 */
export const TOUSUKO_WALK = "sa:2kJYAl";

/** 段7（祭り）の 野次馬（rpg の SPR j_yakiu・j_nanashi・j_gakuran と同じ）。 */
export const YAJI_WALK: readonly string[] = [
	"sa:4rSOzo",
	"sa:lcBiHO",
	"sa:XvdbmA",
];
