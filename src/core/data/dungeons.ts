// ダンジョン（トルネコ1の「ちょっと不思議 → 不思議 → もっと不思議」にならう3つ）。
//
// - shallow：はじめの10階。杖だけ未識別・のろいなし・祭りなし・罠は B5 から。持ち帰るのは「蓄音機の針」。
// - main：本編の20階（過去ログの底）。今までどおり（中断セーブ・リプレイ・parity の基準がそのまま通る）。
// - deep：本編を持ち帰ると開く30階。ぜんぶ未識別・大きなパンと不食の指輪は出ない・罠が多い。
//
// level は「その階が 本編の何階ぶんの強さか」。敵の顔ぶれ・罠の数と種類・祭りの大きさ・変化の杖は
// これで引く（本編は 階 = level）。見た目と曲の層は UI 側（ui/theme.ts）。

import type { DeckEntry } from "../deck";
import type { DungeonId, ItemCat } from "../types";
import { MAIN_DECK } from "./items";

export type Dungeon = {
	id: DungeonId;
	floors: number;
	/** 山札（中身は毎回同じ・公開。並びだけ冒険ごとに切る）。 */
	deck: readonly DeckEntry[];
	/** 階 → 本編の何階ぶんの強さか（[0] は使わない。長さ floors + 1。浅い順に へらない）。 */
	level: readonly number[];
	/** 未識別の分類（ここに無い分類は はじめから名前がわかる）。 */
	unidentified: readonly ItemCat[];
	/** のろわれた道具が出るか。 */
	curses: boolean;
	/** 始めの持ち物（山札の外）。 */
	start: readonly string[];
	/** いちばん底で拾って 持ち帰る品。 */
	goal: string;
	/** 祭り（モンスターハウス）：from 階から chance ずつ。early の階までに無ければ その間のどこかに1つ。null なら無し。 */
	houses: {
		from: number;
		chance: number;
		early: readonly [number, number] | null;
	} | null;
	/** この階より浅い階には罠を置かない。 */
	trapsFrom: number;
	/** このダンジョンを持ち帰ると開く（null ははじめから開いている）。 */
	unlockAfter: DungeonId | null;
	/** unlockAfter のダンジョンで これだけ倒れたら、持ち帰らなくても開く（トルネコ1の30回にあたる）。 */
	reliefAfter: number | null;
};

const identity = (n: number): number[] =>
	Array.from({ length: n + 1 }, (_, i) => i);

const ALL_UNIDENTIFIED: readonly ItemCat[] = [
	"ring",
	"herb",
	"scroll",
	"staff",
];

/** はじめの10階の山札（仮。data の調整で差しかえる）。 */
export const SHALLOW_DECK: readonly DeckEntry[] = [
	{ kind: "club", count: 2 },
	{ kind: "copper", count: 2 },
	{ kind: "bat", count: 1 },
	{ kind: "leather", count: 2 },
	{ kind: "bronze", count: 2 },
	{ kind: "scale", count: 1 },
	{ kind: "h_heal", count: 8 },
	{ kind: "h_greater", count: 2 },
	{ kind: "h_might", count: 2 },
	{ kind: "h_swift", count: 1 },
	{ kind: "h_blink", count: 2 },
	{ kind: "h_sight", count: 1 },
	{ kind: "h_antidote", count: 1 },
	{ kind: "h_poison", count: 1 },
	{ kind: "s_appraise", count: 3 },
	{ kind: "s_whet", count: 2 },
	{ kind: "s_temper", count: 2 },
	{ kind: "s_map", count: 2 },
	{ kind: "s_sense", count: 1 },
	{ kind: "s_hold", count: 1 },
	{ kind: "s_blast", count: 1 },
	{ kind: "w_bolt", count: 1 },
	{ kind: "w_sleep", count: 1 },
	{ kind: "w_slow", count: 1 },
	{ kind: "w_send", count: 1 },
	{ kind: "a_wood", count: 3 },
	{ kind: "f_bread", count: 4 },
	{ kind: "f_large", count: 1 },
];

/** もっと深い30階の山札（仮。data の調整で差しかえる）：本編を 1.5倍に。大きなパン・不食の指輪は無し。 */
export const DEEP_DECK: readonly DeckEntry[] = MAIN_DECK.filter(
	(e) => e.kind !== "f_large" && e.kind !== "r_sustain",
).map((e) => ({
	kind: e.kind,
	count: e.kind === "f_bread" ? 15 : Math.max(1, Math.round(e.count * 1.5)),
}));

export const DUNGEONS: Record<DungeonId, Dungeon> = {
	shallow: {
		id: "shallow",
		floors: 10,
		deck: SHALLOW_DECK,
		level: [0, 1, 1, 2, 3, 3, 4, 5, 5, 6, 7],
		unidentified: ["staff"],
		curses: false,
		start: ["f_large", "h_heal", "s_appraise"],
		goal: "needle",
		houses: null,
		trapsFrom: 5,
		unlockAfter: null,
		reliefAfter: null,
	},
	main: {
		id: "main",
		floors: 20,
		deck: MAIN_DECK,
		level: identity(20),
		unidentified: ALL_UNIDENTIFIED,
		curses: true,
		start: ["f_large"],
		goal: "genban",
		houses: { from: 3, chance: 1 / 16, early: [4, 6] },
		trapsFrom: 3,
		unlockAfter: "shallow",
		reliefAfter: 10,
	},
	deep: {
		id: "deep",
		floors: 30,
		deck: DEEP_DECK,
		level: identity(30),
		unidentified: ALL_UNIDENTIFIED,
		curses: true,
		start: ["f_large"],
		goal: "bside",
		houses: { from: 3, chance: 1 / 10, early: [4, 6] },
		trapsFrom: 3,
		unlockAfter: "main",
		reliefAfter: null,
	},
};

export const DUNGEON_IDS: readonly DungeonId[] = ["shallow", "main", "deep"];

/** 知らない id（壊れた記録など）は本編として読む。 */
export const dungeonById = (id: string | undefined): Dungeon =>
	DUNGEONS[id as DungeonId] ?? DUNGEONS.main;
