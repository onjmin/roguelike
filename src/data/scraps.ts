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
	/** 乗っ取り屋の 置き手紙（裏シナリオ。去った 人の レスでは なく、灯台の パスワードの 手がかり）。 */
	kind?: "memo";
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
	// 裏シナリオ（おーぷぬ）：自分の 板を 立てて 出ていった 人（3作目の 対は walksim の street.ts の mado。STORY.md §4.5）。
	// 小島1 を 持ち帰ると 貼られる（風呂板の 前に「板を 立てた 人」が 出る：起の 伏線）
	{
		id: "jibun",
		board: "isle1",
		text: "板　立てたわ。おんJより　のんびり　やる",
		why: "自分の板",
	},
	// 乗っ取り屋の 置き手紙（小島 3つの 底の 品。3枚で 灯台の 扉の パスワード 12345 が わかる：
	// 板主のは いちばん 弱い 1234、新しいのは それより 1つ 多い、長くは しない）
	{
		id: "memo1",
		board: "isle1",
		text: "新しい　パスワードは、\n板主のより　1つ　多い",
		why: "置き手紙①",
		kind: "memo",
	},
	{
		id: "memo2",
		board: "isle2",
		text: "板主のは、いちばん　弱い\nやつだった。……1234",
		why: "置き手紙②",
		kind: "memo",
	},
	{
		id: "memo3",
		board: "isle3",
		text: "おれも　のんびり　してるんで、\n長くは　しない",
		why: "置き手紙③",
		kind: "memo",
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
	/** 置き手紙が 貼ってある（裏シナリオ）。 */
	pinnedMemo: "掲示板の　まんなかに、\n紙きれが　貼ってある。",
	/** 置き手紙の 見出し。 */
	headMemo: "「{board}」で　拾った、\n乗っ取り屋の　置き手紙。",
	/** 置き手紙を 読んだ あと。 */
	afterMemo: "……すみに、小さく「草」。",
	/** 読み返す 一覧の 題（置き手紙）。 */
	listMemo: "乗っ取り屋の　置き手紙",
} as const;
