// 村（保守村）に立つ人たち。名前・色は quotes.ts の SPEAKERS、歩行グラ・立ち絵は rpg の cast.ts と同じ
// （シヨ・ゼロは rpg に いないので、シヨの 歩行グラは RPGEN に 投入された もの）。
// ゼロは 3体 いる 解音ゼロの メイン機 VHz8-0（通称 メインさん）。サブ機の プロト・レンは 村の 住人（data/mobs.ts）。
// メインさんの 歩行グラは RPGEN に 無いので、プロト（sa:KxS5YZ）を 塗りかえて 作った（scripts/make-zero.mjs）。
// 歩行グラは RPGEN 形式（16x16・2コマ×4方向）。立ち絵は public/portraits/ の透過 PNG（右向きに描いた絵。
// 右に立つときは ui/message.ts が左右反転する）。やきうは 立ち絵が無いので 出さない（ダミーも出さない）。
// キリコは 仲間の 一覧（Speaker）には 入れない（声が 出ないので。独白と 最後の 声は KIRIKO・Story.kiriko）。
// 声（voice）は 村の 会話の 読み上げ（設定の ボイス。engine/audio.ts）。無い人は 読み上げない。

import type { VoiceDef } from "../engine/defs";
import type { MobId } from "./mobs";
import { SPEAKERS, type Speaker } from "./quotes";

export type CastDef = {
	name: string;
	color: string;
	/** 歩行グラ（`sa:<id>`）。 */
	walk: string;
	/** 名前欄に 出す 名前（無ければ name。ゼロは 型番つき）。 */
	label?: string;
	portrait?: { src: string; side: "left" | "right" };
	/** 読み上げの 声（dtm の koe 音源）。無ければ 声なし。 */
	voice?: VoiceDef;
};

const WALK: Record<Speaker, string> = {
	nanj: "sa:4rSOzo", // 野球民
	roze: "sa:mHhx69",
	feris: "sa:4KtOzD",
	shiyo: "sa:y8Kr53",
	zero: "pub:sprites/zero_main.png",
};

const PORTRAIT: Partial<Record<Speaker, CastDef["portrait"]>> = {
	roze: { src: "portraits/roze.png", side: "right" },
	shiyo: { src: "portraits/shiyo.png", side: "right" },
	zero: { src: "portraits/zero.png", side: "right" },
	feris: { src: "portraits/feris.png", side: "right" },
};

/** 名前欄の 名前。解音ゼロは 3体 いるので 型番も 出す（公式サイトの 書き方）。サブ機は data/mobs.ts の label。 */
const LABEL: Partial<Record<Speaker, string>> = {
	zero: "ゼロ　VHz8-0",
};

/**
 * 読み上げの 声。ロゼは rpg と 同じ roze、シヨは dtm に 入っている shiyo（革命シヨ）。
 * やきう・フェリスは rpg でも 声なし。ゼロ（音源が まだ 無い）・地の文も 声なし。
 */
const VOICE: Partial<Record<Speaker, VoiceDef>> = {
	roze: { model: "roze" },
	shiyo: { model: "shiyo" },
};

export const CAST: Record<Speaker, CastDef> = Object.fromEntries(
	(Object.keys(SPEAKERS) as Speaker[]).map((id) => [
		id,
		{
			...SPEAKERS[id],
			walk: WALK[id],
			portrait: PORTRAIT[id],
			voice: VOICE[id],
			...(LABEL[id] ? { label: LABEL[id] } : {}),
		},
	]),
) as Record<Speaker, CastDef>;

/**
 * 村の 住人（data/mobs.ts）の 読み上げの 声。音源の ある子だけ（春音リノ＝dtm の rino・響化アル＝hibika_aru）。
 * ぷゆゆ・おんJマイナーズは 声なし。
 */
export const MOB_VOICE: Partial<Record<MobId, VoiceDef>> = {
	rino: { model: "rino" },
	aru: { model: "hibika_aru" },
};

/**
 * キリコ（名前・色・立ち絵は rpg の cast.ts と 同じ）。村の 窓に 出るのは 独白（（　）つき・声なし）と、
 * 声の 場面（rpg と 同じ uc）だけ（ui/village.ts の sayKiriko）。
 */
export const KIRIKO: {
	name: string;
	color: string;
	portrait: string;
	voice: VoiceDef;
} = {
	name: "キリコ",
	color: "#7be0a0",
	portrait: "portraits/kiriko.png",
	voice: { model: "uc" },
};

/** 読み上げで 使う 音源（ボイスを ON に したとき これだけ 取ってくる）。 */
export const VOICE_MODELS: readonly string[] = [
	...new Set(
		[...Object.values(VOICE), ...Object.values(MOB_VOICE), KIRIKO.voice].map(
			(v) => v.model,
		),
	),
];

/** キリコの歩行グラ（RPGEN「蓄音キリコ」）。 */
export const KIRIKO_WALK = "sa:vHsmy5";

/**
 * ぷゆゆ（ぴえんの 顔。rpg の SPR.puyu と 同じ）。村では 広場の 下を うろうろ している（data/mobs.ts）。
 * 下の 敵の ぷゆゆ（core/data/monsters.ts。core は data を 読まないので 同じ id を じかに 書く）も 同じ絵。
 */
export const PUYU_WALK = "sa:DszPWT";

/**
 * 段7（祭り）の 野次馬（RPGEN「黒タイツJ民」「笠J民」「野球民（学生服）」）。
 * 下の 敵と 同じ 絵は 使わない（rpg の j_yakiu・j_nanashi は ピッチャー・風吹けば名無しと 同じ 絵なので 替えた）。
 */
export const YAJI_WALK: readonly string[] = [
	"sa:8DXRgk",
	"sa:f6k97v",
	"sa:XvdbmA",
];
