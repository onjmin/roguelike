// 建物の 看板（2026-10-15 作者：「それぞれの 建物に 看板とか 旗とか 店の 名前を 示す ものが あると 親切」）。
// 外観の 扉の 上に 名前の 板を かける（ui/village/signboards.ts が 描く）。
// 字は 8px の ドット字で 1マスに 1字ほど。建物の 幅に おさまる よう 短く した 名前を 書く。
// 載って いない 施設（車・バス停・自販機・広場の 物・マイクラの 一角・絵に 名前の ある ヲタショップ）は 看板なし。

/** 板の 色（店：木の 板。役所・会社：白い 板。夜の 店：黒い 板に ネオン）。 */
export type SignStyle = "shop" | "public" | "night";

export type SignDef = {
	text: string;
	style?: SignStyle;
	/** 板を かける 行（外観の 上から。この 行の 上端に かける。省くと 扉の 行、扉が 無ければ いちばん 下の 行）。 */
	row?: number;
};

export const SIGNS: Record<string, SignDef> = {
	umi: { text: "海の家　age" },
	go: { text: "碁会所" },
	konbini: { text: "おんJマート", style: "public" },
	dojo: { text: "おんJ道場", row: 2 },
	pawn: { text: "質屋　流れ" },
	recycle: { text: "おさがり" },
	arcade: { text: "ゲーセン連コ", style: "night" },
	gym: { text: "ageジム", style: "public" },
	bar: { text: "BAR　次スレ", style: "night" },
	restaurant: { text: "1000" },
	ramen: { text: "麺屋　乙" },
	famires: { text: "ドリンクバー" },
	corpo: { text: "おんJ荘" },
	mansion: { text: "メゾン・ド・おんJ", style: "public" },
	myhome: { text: "おんJヶ丘" },
	danchi: { text: "おんJヶ丘団地", style: "public" },
	tower: { text: "おんJタワー", style: "public" },
	police: { text: "警察署", style: "public" },
	hospital: { text: "おんJ総合病院", style: "public" },
	firestation: { text: "消防署", style: "public" },
	court: { text: "地方裁判所", style: "public" },
	repair: { text: "整備工場" },
	cinema: { text: "スクリーン1000", style: "night" },
	theater: { text: "おんJ劇場" },
	casino: { text: "カジノ　ガチャ", style: "night" },
	station: { text: "おんJタウン駅", style: "public" },
	tvstudio: { text: "おんJテレビ", style: "public" },
	harbor: { text: "港湾事務所", style: "public" },
	factory: { text: "工場", style: "public" },
	power: { text: "発電所", style: "public" },
	hills: { text: "おんJヒルズ", style: "public" },
	zakkyo: { text: "雑居ビル", style: "public" },
	tako: { text: "たこ八" },
	soba: { text: "2げと" },
	gyudon: { text: "つゆだく" },
	izakaya: { text: "居酒屋　草" },
	sushi: { text: "寿司　鯖" },
	chuka: { text: "中華　炎上" },
	burger: { text: "ワイバーガー" },
	maid: { text: "メイドの土産", style: "night" },
	cityhall: { text: "おんJ市役所", style: "public" },
	bushitsu: { text: "部室棟", style: "public" },
	shoken: { text: "おんJ証券", style: "public" },
	netcafe: { text: "ROM専", style: "night" },
	sharehouse: { text: "スレ立て荘" },
	heights: { text: "ハイツおんJ" },
	grandmaison: { text: "グランメゾン", style: "public" },
	mansion2: { text: "メゾンII", style: "public" },
	tower2: { text: "タワーサウス", style: "public" },
};
