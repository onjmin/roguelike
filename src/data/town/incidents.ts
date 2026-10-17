// 町の 騒ぎ（STORY.md §4.9 の 場面の 一覧）。板が 開いて から 持ち帰るまで、その 話の 爪あとを 町に 出す。
// - people：騒ぎの 人（敵の 歩行グラを 町の 人として 立たせる。話すと ひとこと）。
// - shut：その 騒ぎで 閉まって いる 所の シャッターの 札（data/town/revival.ts の シャッターより 先に 読む）。
// - seize：広場の 掲示板が 差し押さえ（調べても 札だけ）。
// 停電（電池板）は revival.ts の inBlackout（生き返った 通りが ぜんぶ 暗く 閉まる）。
// DOM も 保存も 使わない（src/sim/villageTests.ts の 騒ぎの 試験）。

import type { DungeonId } from "../../core/types";

type Cell = readonly [x: number, y: number];
type Dir = "up" | "down" | "left" | "right";

export type IncidentPerson = {
	id: string;
	at: Cell;
	sprite: string;
	dir: Dir;
	/** 名前欄。 */
	name: string;
	/** 話すと 1つ（帰りで 入れかわる 必要は ない。全角 22字・2行まで）。 */
	lines: readonly string[];
};

export type Incident = {
	dungeon: DungeonId;
	people: readonly IncidentPerson[];
	/** 所の id → シャッターの 札（その 騒ぎの わけ）。 */
	shut?: Readonly<Record<string, string>>;
	/** 広場の 掲示板を 差し押さえる 札。 */
	seize?: string;
	/** 倉庫に 鍵：引き取った 道具を 持ちこめない（出るときに ゼロが もどす。data/town/town.ts の CARRY_LOCK）。 */
	lockCarry?: true;
};

const PANHEI = "pub:sprites/panhei.png";
const KINONYAN = "pub:sprites/kinonyan.png";
const ISLANDER = "pub:sprites/natsuko.png";

export const INCIDENTS: readonly Incident[] = [
	{
		dungeon: "shallow",
		seize: "『差し押さえ　パン板』\n……掲示板に、食パンが貼ってある。",
		people: [
			{
				id: "panhei_a",
				at: [17, 20],
				sprite: PANHEI,
				dir: "down",
				name: "パン兵",
				lines: ["ここは今日からパン板領や。\n掲示板は差し押さえたで。"],
			},
			{
				id: "panhei_b",
				at: [20, 20],
				sprite: PANHEI,
				dir: "down",
				name: "パン兵",
				lines: ["旗の下は通ってええ。\n……独立国は、心が広いんや。"],
			},
			{
				id: "panhei_chief",
				at: [20, 22],
				sprite: PANHEI,
				dir: "up",
				name: "パン兵長",
				lines: [
					"独立を認めるまで、旗はおろさん。\n文句があるならパン板まで来い。",
				],
			},
		],
	},
	{
		dungeon: "kinoko",
		lockCarry: true,
		people: [
			{
				id: "kinonyan_a",
				at: [36, 17],
				sprite: KINONYAN,
				dir: "right",
				name: "きのこ軍",
				lines: ["[ｷ・Д・ﾉ]ここ近道やねん。\nパン板はどっちや？"],
			},
			{
				id: "kinonyan_b",
				at: [42, 17],
				sprite: KINONYAN,
				dir: "right",
				name: "きのこ軍",
				lines: ["行進中や。\n……店先は、ちょっと踏んだ。"],
			},
			{
				id: "kinonyan_c",
				at: [48, 17],
				sprite: KINONYAN,
				dir: "right",
				name: "きのこ軍",
				lines: ["植民地の植民地の、仕返しや。\n町は通るだけやで。"],
			},
		],
	},
	{
		dungeon: "tropical",
		shut: { umi: "海の家の前に、テントが6つ。\n……『島民キャンプ中』" },
		people: [
			{
				id: "islander_a",
				at: [29, 33],
				sprite: ISLANDER,
				dir: "down",
				name: "島民",
				lines: ["島が好きすぎて、島ごと来たで。\n……浜、ええな。"],
			},
			{
				id: "islander_b",
				at: [26, 35],
				sprite: ISLANDER,
				dir: "left",
				name: "島民",
				lines: ["総島民6人、全員上陸や。\n島は、いま空っぽやで。"],
			},
		],
	},
	{
		dungeon: "main",
		people: [],
		shut: {
			bath: "『42℃以外お断り』の貼り紙。\n……中から、湯気と怒鳴り声。",
		},
	},
];

/** いま 起きて いる 騒ぎ（板が 開いて いて、まだ 持ち帰って いない）。 */
export const activeIncidents = (v: {
	unlocked: readonly DungeonId[];
	cleared: readonly DungeonId[];
}): Incident[] =>
	INCIDENTS.filter(
		(i) => v.unlocked.includes(i.dungeon) && !v.cleared.includes(i.dungeon),
	);

/** 倉庫に 鍵が かかって いるか（騒ぎの あいだ。ゼロが 見出しを 信じて 閉めた）。 */
export const carryLocked = (v: {
	unlocked: readonly DungeonId[];
	cleared: readonly DungeonId[];
}): boolean => activeIncidents(v).some((i) => i.lockCarry);

/** 騒ぎの 人の 村での id。 */
export const incidentPlaceId = (p: IncidentPerson): string => `inc_${p.id}`;

/**
 * ご近所（STORY.md §3 の 一文「町と 板を ご近所に もどす」）：板を 持ち帰った あと、その 板の 人が 1人 町に 遊びに 来る。
 * 立つ マスは 騒ぎの 人と 同じ（騒ぎは 持ち帰るまで、ご近所は 持ち帰った あとなので かさならない）。
 */
export const VISITORS: readonly (IncidentPerson & { dungeon: DungeonId })[] = [
	{
		dungeon: "shallow",
		id: "visit_panhei",
		at: [17, 20],
		sprite: PANHEI,
		dir: "down",
		name: "パン兵",
		lines: ["独立記念のパン、\n町にも卸しとるで"],
	},
	{
		dungeon: "kinoko",
		id: "visit_kinonyan",
		at: [42, 17],
		sprite: KINONYAN,
		dir: "down",
		name: "きのこ軍",
		lines: ["[ｷ・Д・ﾉ]商店街、\n近道に便利や"],
	},
	{
		dungeon: "tropical",
		id: "visit_islander",
		at: [31, 34],
		sprite: ISLANDER,
		dir: "down",
		name: "島民",
		lines: ["浜に支店出したで。\n島の物産や"],
	},
	{
		dungeon: "konamono",
		id: "visit_tako",
		at: [48, 17],
		sprite: "pub:sprites/takonomin.png",
		dir: "down",
		name: "たこ民",
		lines: ["😡は、タコの顔やで"],
	},
	{
		dungeon: "main",
		id: "visit_bantou",
		at: [36, 17],
		sprite: "pub:sprites/ofurou.png",
		dir: "down",
		name: "42℃の番頭",
		lines: ["41.5℃、町の銭湯にも\n伝えといたわ"],
	},
	{
		dungeon: "festival",
		id: "visit_oyabun",
		at: [20, 22],
		sprite: "pub:sprites/mashii.png",
		dir: "up",
		name: "祭りの親分",
		lines: ["次の祭りも、町でやろか"],
	},
	{
		dungeon: "deep",
		id: "visit_denchi",
		at: [20, 20],
		sprite: "pub:sprites/denchan.png",
		dir: "down",
		name: "電池ニキ",
		lines: ["電気は送っとる。\n……人、おるな"],
	},
];

/** 町に 来て いる ご近所（持ち帰った 板の 人）。 */
export const activeVisitors = (v: {
	cleared: readonly DungeonId[];
}): (IncidentPerson & { dungeon: DungeonId })[] =>
	VISITORS.filter((p) => v.cleared.includes(p.dungeon));
