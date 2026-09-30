// まとめ掲示板に 貼られる「古い スレの 切れはし」（STORY.md §4.5 の 目録。去った 人の、おんJでの 最後の 書きこみ）。
// その 板を 1度でも 持ち帰ると、その 板の 過去ログから 出てきた 切れはしが 掲示板の すみに 貼られる
// （1回の 帰りに 1枚まで。読むと 掲示板に 残り、あとで 読み返せる。ui/villageEvents.ts の boardScript）。
// だれが 貼ったかは 言わない。3作目（walksim）の レコードが その「続き」（record。無い 去り方は 3作目の 窓の 場面）。
// 亡くなった 人は 入れない。去り方に 良し悪しを つけない。

import type { DungeonId } from "../core/types";

export type Scrap = {
	id: string;
	/** どの 板の 過去ログから 出てきたか（その 板を 持ち帰ると 貼られる）。 */
	board: DungeonId;
	/** 最後の 書きこみ（村の 窓の 1行）。 */
	text: string;
	/** 去り方（読み返す 一覧の 小さい 説明）。 */
	why: string;
	/** 3作目の 対の レコード（walksim の data/records.ts）。 */
	record?: string;
};

export const SCRAPS: readonly Scrap[] = [
	{
		id: "shakaijin",
		board: "shallow",
		text: "来月から　社会人や",
		why: "就職",
		record: "rec_a",
	},
	{ id: "juken", board: "shallow", text: "受かるまで　ROMるわ", why: "受験" },
	{
		id: "misskey",
		board: "kinoko",
		text: "ノート　書くほうが　性に　合っとった",
		why: "ミスキー",
	},
	{
		id: "yome",
		board: "tropical",
		text: "嫁に　見つかった",
		why: "結婚",
		record: "rec_b",
	},
	{ id: "saba", board: "konamono", text: "鯖　作ったから　来いや", why: "鯖" },
	{
		id: "akita",
		board: "festival",
		text: "飽きたわ",
		why: "飽きた",
		record: "rec_c",
	},
	{
		id: "edge",
		board: "deep",
		text: "実況は　あっちで　やっとるで",
		why: "別の掲示板",
		record: "rec_d",
	},
	{
		id: "yameta",
		board: "deep",
		text: "もう　来ないと　思う。楽しかった",
		why: "ネットを辞めた",
		record: "rec_q",
	},
];

/** 掲示板の 文（{board} は 板の 名前）。 */
export const SCRAP_MSG = {
	/** 新しい 切れはしが 貼ってある。 */
	pinned: "掲示板の　すみに、古い　スレの\n切れはしが　貼ってある。",
	/** 切れはしの 見出し（どの 板の 過去ログか）。 */
	head: "「{board}」の　過去ログの　切れはし。",
	/** 読んだ あと。 */
	after: "……それきり、書きこみは　ない。",
} as const;
