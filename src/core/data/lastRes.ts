// 植民地に 落ちている「最後の レス」（STORY.md §4.5 の 目録。去った 人の、おんJでの 最後の 書きこみ）。
// その 階に 着くと 拾える（床に 落ちている。持ち物には 入らず、倒れても 知識として 残る＝図鑑と 同じ）。
// 3作目（walksim）の レコードが その「続き」（record。無い 去り方は 3作目の 窓の 場面で 見せる）。
// 本編（風呂板）には 置かない（本編の 動きの 基準 parityFixture を 変えないため）。亡くなった 人は 入れない。
// 乱数は 使わない（決まった 階で 決まった 文。リプレイも 同じに なる）。
// 階は 植民地の 途中（1階と いちばん底の あいだ）。板の 階の 数を 変えたら ここも 合わせる。

import type { DungeonId } from "../types";

export type LastRes = {
	id: string;
	dungeon: DungeonId;
	/** 何階で 拾えるか（上りの 板でも depth で 数える）。 */
	depth: number;
	/** 最後の レス（1行。記録の 窓に そのまま 出る）。 */
	text: string;
	/** 去り方（村の 一覧の 小さい 説明）。 */
	why: string;
	/** 3作目の 対の レコード（walksim の data/records.ts。無ければ 窓の 場面）。 */
	record?: string;
};

export const LAST_RES: readonly LastRes[] = [
	{
		id: "shakaijin",
		dungeon: "shallow",
		depth: 2,
		text: "来月から　社会人や",
		why: "就職",
		record: "rec_a",
	},
	{
		id: "juken",
		dungeon: "shallow",
		depth: 3,
		text: "受かるまで　ROMるわ",
		why: "受験",
	},
	{
		id: "misskey",
		dungeon: "kinoko",
		depth: 3,
		text: "ノート　書くほうが　性に　合っとった",
		why: "ミスキー",
	},
	{
		id: "yome",
		dungeon: "tropical",
		depth: 5,
		text: "嫁に　見つかった",
		why: "結婚",
		record: "rec_b",
	},
	{
		id: "saba",
		dungeon: "konamono",
		depth: 7,
		text: "鯖　作ったから　来いや",
		why: "鯖",
	},
	{
		id: "akita",
		dungeon: "festival",
		depth: 8,
		text: "飽きたわ",
		why: "飽きた",
		record: "rec_c",
	},
	{
		id: "edge",
		dungeon: "deep",
		depth: 8,
		text: "実況は　あっちで　やっとるで",
		why: "別の掲示板",
		record: "rec_d",
	},
	{
		id: "yameta",
		dungeon: "deep",
		depth: 22,
		text: "もう　来ないと　思う。楽しかった",
		why: "ネットを辞めた",
		record: "rec_q",
	},
];

/** その 板の その 階に 落ちている 最後の レス（無ければ undefined）。 */
export const lastResAt = (
	dungeon: DungeonId,
	depth: number,
): LastRes | undefined =>
	LAST_RES.find((r) => r.dungeon === dungeon && r.depth === depth);
