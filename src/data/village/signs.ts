// 建物の 看板（2026-10-15 作者：「それぞれの 建物に 看板とか 旗とか 店の 名前を 示す ものが あると 親切」。
// 2026-10-16：「もっと 自然な 感じに。看板の フォントとかも それぞれ 店の 雰囲気に 合うように」「喫茶店や 銭湯など
// 看板が 無い ものも」「おんJ本館も」）。扉の 上に 名前の 板を かける（ui/village/signboards.ts が 描く）。
// - 店ごとに 見た目（SIGN_LOOKS：字の 書体・板の 色・ふち取り・ネオンの にじみ）を えらぶ。字は 絵と 同じ
//   ドットに 落として 描く（なめらかな 字が 絵の 上に 浮かない ように）。
// - 施設（data/village/facilities.ts）は 扉の 上。町の まんなかの 建物（本館・喫茶・銭湯…）は CORE_SIGNS に 場所を 書く。
// - 載って いない 施設（車・バス停・自販機・広場の 物・マイクラの 一角・絵に 名前の ある ヲタショップ・
//   電光表示に 名前が 流れる 映画館・カジノ・テレビ局・駅。data/village/displays.ts）は 看板なし。
// 字は 看板の 字なので 分かち書き しない。建物の 幅に おさまる よう 短く した 名前を 書く。

import { HALL_NAMES, hallTierOf } from "./hall";

/** 書体（Google Fonts。ドットに 落としても 読める ものだけ。ui/village/signboards.ts が 読みこむ）。 */
export const SIGN_FONTS = {
	/** 和の 店・老舗（明朝の かな）。 */
	wa: { family: "Zen Antique", weight: 400 },
	/** 中華・屋台・丼（太い 筆の ゴシック）。 */
	fude: { family: "Potta One", weight: 400 },
	/** かわいい 店・遊ぶ 所（丸い 太字）。 */
	pop: { family: "Mochiy Pop One", weight: 400 },
	/** 役所・会社（太い ゴシック）。 */
	gothic: { family: "Zen Kaku Gothic New", weight: 700 },
	/** チェーン店の 看板。 */
	brand: { family: "M PLUS 1p", weight: 700 },
	/** ネオン管（細い 丸ゴシック）。 */
	neon: { family: "Kosugi Maru", weight: 400 },
	/** 手書き（マジック）。 */
	hand: { family: "Yusei Magic", weight: 400 },
	/** 住まい（やわらかい 丸ゴシック）。 */
	maru: { family: "Zen Maru Gothic", weight: 700 },
} as const;

export type SignFont = keyof typeof SIGN_FONTS;

/** 板の 見た目（書体・地・上の 明るい ふち・下と 右の 暗い ふち・字・字の ふち取り・ネオンの にじみ）。 */
export type SignLook = {
	font: SignFont;
	bg: string;
	top: string;
	edge: string;
	ink: string;
	outline?: string;
	glow?: string;
};

export const SIGN_LOOKS = {
	/** 焼き杉の 板に 白い 字（居酒屋・質屋・道場）。 */
	yakisugi: {
		font: "wa",
		bg: "#3c2818",
		top: "#5a3c24",
		edge: "#22150b",
		ink: "#f4e4c0",
	},
	/** 白木の 板に 墨の 字（寿司・そば・碁会所・本屋）。 */
	shiraki: {
		font: "wa",
		bg: "#eadfc4",
		top: "#fff6e0",
		edge: "#a88c64",
		ink: "#2a1c10",
	},
	/** 赤い 板に 黄色の 字（ラーメン・中華・たこ焼き）。 */
	chuka: {
		font: "fude",
		bg: "#b3261e",
		top: "#d84a3a",
		edge: "#7a1610",
		ink: "#ffe27a",
	},
	/** だいだいの 板に 白い 字（牛丼）。 */
	donburi: {
		font: "fude",
		bg: "#e8761a",
		top: "#ff9a40",
		edge: "#9a4a0c",
		ink: "#ffffff",
		outline: "#7a3008",
	},
	/** 桃色の 板（メイド喫茶）。 */
	maid: {
		font: "pop",
		bg: "#ff8ab8",
		top: "#ffc0d8",
		edge: "#c0507e",
		ink: "#ffffff",
		outline: "#a02858",
	},
	/** 黄色の 板に 赤い 字（バーガー）。 */
	burger: {
		font: "pop",
		bg: "#ffcc33",
		top: "#ffe48a",
		edge: "#c08a10",
		ink: "#c8281e",
	},
	/** だいだいの 板（ファミレス）。 */
	famires: {
		font: "pop",
		bg: "#ff8c3a",
		top: "#ffb070",
		edge: "#b05418",
		ink: "#ffffff",
		outline: "#a04010",
	},
	/** 夜の 遊び場（ゲーセン）。 */
	arcade: {
		font: "pop",
		bg: "#2a1a4a",
		top: "#3e2a6a",
		edge: "#140a28",
		ink: "#ffe14a",
		outline: "#c0306a",
	},
	/** 海の 青（海の家）。 */
	umi: {
		font: "pop",
		bg: "#3a8ad0",
		top: "#6ab0f0",
		edge: "#1a4a80",
		ink: "#ffffff",
		outline: "#1a4a80",
	},
	/** 紺の 板に 金の 字（海上レストラン）。 */
	marine: {
		font: "wa",
		bg: "#1a2a4a",
		top: "#2e4270",
		edge: "#0c1428",
		ink: "#f0d890",
	},
	/** 金属の プレート（役所・会社・病院）。 */
	plate: {
		font: "gothic",
		bg: "#dfe3e6",
		top: "#f6f8fa",
		edge: "#8a929a",
		ink: "#1c2a48",
	},
	/** 青い 帯に 白い 字（コンビニ）。 */
	konbini: {
		font: "brand",
		bg: "#2a6ad0",
		top: "#5a92f0",
		edge: "#163e80",
		ink: "#ffffff",
	},
	/** 黒地に だいだい（ジム）。 */
	gym: {
		font: "brand",
		bg: "#222222",
		top: "#3a3a3a",
		edge: "#0e0e0e",
		ink: "#ff7a2a",
	},
	/** 黄色の 地に 黒い 字（整備工場）。 */
	garage: {
		font: "brand",
		bg: "#e8c020",
		top: "#ffe060",
		edge: "#9a7a08",
		ink: "#222222",
	},
	/** 夜の 店の ネオン（桃色）。 */
	neonPink: {
		font: "neon",
		bg: "#140c1e",
		top: "#241834",
		edge: "#08040e",
		ink: "#ffb0e4",
		glow: "#ff4ab0",
	},
	/** ネオン（水色。ネットカフェ）。 */
	neonBlue: {
		font: "neon",
		bg: "#0c1420",
		top: "#182436",
		edge: "#04080e",
		ink: "#b0f0ff",
		glow: "#2ab0ff",
	},
	/** 段ボールに マジック（リサイクルショップ）。 */
	kraft: {
		font: "hand",
		bg: "#c89a5a",
		top: "#e0b878",
		edge: "#8a6430",
		ink: "#2a1a0a",
	},
	/** ホワイトボードに 青い マジック（シェアハウス）。 */
	whiteboard: {
		font: "hand",
		bg: "#f4f4f0",
		top: "#ffffff",
		edge: "#a0a4a8",
		ink: "#2050a0",
	},
	/** 住まいの 表札（クリーム色）。 */
	home: {
		font: "maru",
		bg: "#f2ebdc",
		top: "#fffaf0",
		edge: "#b0a080",
		ink: "#5a4430",
	},
	/** 純喫茶（深い 緑の 板に 生成りの 字）。 */
	kissa: {
		font: "wa",
		bg: "#1f3a2c",
		top: "#2e5440",
		edge: "#0e1e16",
		ink: "#f0e2b8",
	},
	/** 銭湯（紺の 板に 白い 字）。 */
	sento: {
		font: "wa",
		bg: "#1a2a5a",
		top: "#2a4080",
		edge: "#0c1430",
		ink: "#ffffff",
	},
	/** 黒い 板に 白い 字（音楽室）。 */
	piano: {
		font: "neon",
		bg: "#141414",
		top: "#2a2a2a",
		edge: "#000000",
		ink: "#ffffff",
	},
	/** 赤い ビロードに 金（劇場）。 */
	theater: {
		font: "wa",
		bg: "#8a1a22",
		top: "#b02a34",
		edge: "#4a0c10",
		ink: "#f0d080",
	},
	/** 黒漆に 金の 扁額（本館）。 */
	hengaku: {
		font: "wa",
		bg: "#1a1410",
		top: "#3a2c20",
		edge: "#0a0806",
		ink: "#e8c060",
	},
} as const satisfies Record<string, SignLook>;

export type SignLookId = keyof typeof SIGN_LOOKS;

export type SignDef = {
	text: string;
	look: SignLookId;
	/** 板を かける 行（外観の 上から。この 行の すぐ 上に かける。省くと 扉の 行、扉が 無ければ いちばん 下の 行）。 */
	row?: number;
};

/** 施設の 看板（施設の id → 看板）。 */
export const SIGNS: Record<string, SignDef> = {
	umi: { text: "海の家　age", look: "umi" },
	go: { text: "碁会所", look: "shiraki" },
	konbini: { text: "おんJマート", look: "konbini" },
	dojo: { text: "おんJ道場", look: "yakisugi", row: 2 },
	pawn: { text: "質屋　流れ", look: "yakisugi" },
	recycle: { text: "おさがり", look: "kraft" },
	arcade: { text: "ゲーセン連コ", look: "arcade" },
	gym: { text: "ageジム", look: "gym" },
	bar: { text: "BAR　次スレ", look: "neonPink" },
	restaurant: { text: "1000", look: "marine" },
	ramen: { text: "麺屋　乙", look: "chuka" },
	famires: { text: "ドリンクバー", look: "famires" },
	corpo: { text: "おんJ荘", look: "home" },
	mansion: { text: "メゾン・ド・おんJ", look: "home" },
	myhome: { text: "おんJヶ丘", look: "home" },
	danchi: { text: "おんJヶ丘団地", look: "plate" },
	tower: { text: "おんJタワー", look: "plate" },
	police: { text: "警察署", look: "plate" },
	hospital: { text: "おんJ総合病院", look: "plate" },
	firestation: { text: "消防署", look: "plate" },
	court: { text: "地方裁判所", look: "plate" },
	repair: { text: "整備工場", look: "garage" },
	theater: { text: "おんJ劇場", look: "theater" },
	harbor: { text: "港湾事務所", look: "plate" },
	factory: { text: "工場", look: "plate" },
	power: { text: "発電所", look: "plate" },
	hills: { text: "おんJヒルズ", look: "plate" },
	zakkyo: { text: "雑居ビル", look: "plate" },
	tako: { text: "たこ八", look: "chuka" },
	soba: { text: "2げと", look: "shiraki" },
	gyudon: { text: "つゆだく", look: "donburi" },
	izakaya: { text: "居酒屋　草", look: "yakisugi" },
	sushi: { text: "寿司　鯖", look: "shiraki" },
	chuka: { text: "中華　炎上", look: "chuka" },
	burger: { text: "ワイバーガー", look: "burger" },
	maid: { text: "メイドの土産", look: "maid" },
	cityhall: { text: "おんJ市役所", look: "plate" },
	bushitsu: { text: "部室棟", look: "plate" },
	shoken: { text: "おんJ証券", look: "plate" },
	bank: { text: "おんJ銀行", look: "plate" },
	netcafe: { text: "ROM専", look: "neonBlue" },
	sharehouse: { text: "スレ立て荘", look: "whiteboard" },
	heights: { text: "ハイツおんJ", look: "home" },
	mansion2: { text: "メゾンII", look: "home" },
	tower2: { text: "タワーサウス", look: "plate" },
};

/**
 * 町の まんなかの 建物の 看板（data/village/map.ts の 地図に じかに 描く 建物。扉は VILLAGE_SPOTS）。
 * at は 板の まんなかの x（マス。.5 は マスの まんなか）と、板の 下の はしを その 行の 上端の すぐ 上に そろえる 行。
 * from・until は 町の 段。text・look は 段で かわる ものも ある（本館の 名前と 板）。
 */
export type CoreSign = {
	id: string;
	from: number;
	until?: number;
	text: (stage: number) => string;
	look: (stage: number) => SignLookId;
	at: readonly [cx: number, row: number];
};

/** 本館の 名前（入った ときの 札から 字の あきを 抜く）。 */
const hallName = (stage: number): string =>
	(HALL_NAMES[hallTierOf({ stage })] ?? HALL_NAMES[0]).replaceAll("　", "");

export const CORE_SIGNS: readonly CoreSign[] = [
	// 本館（2枚の 扉の 上。集会所 → レンガ館 → 本館で 名前と 板が かわる）
	{
		id: "hall",
		from: 0,
		text: hallName,
		look: (stage) => (hallTierOf({ stage }) === 2 ? "hengaku" : "yakisugi"),
		at: [20, 9],
	},
	{
		id: "cafe",
		from: 5,
		text: () => "喫茶　おんJ",
		look: () => "kissa",
		at: [4.5, 17],
	},
	{
		id: "bookstore",
		from: 3,
		until: 6,
		text: () => "本屋　立ち読み",
		look: () => "shiraki",
		at: [4.5, 21],
	},
	{
		id: "library",
		from: 6,
		text: () => "おんJ図書館",
		look: () => "plate",
		at: [4.5, 21],
	},
	{
		id: "music",
		from: 3,
		text: () => "ピアノ機能",
		look: () => "piano",
		at: [22.5, 27],
	},
	{
		id: "bath",
		from: 4,
		text: () => "銭湯　ゆ",
		look: () => "sento",
		at: [35.5, 26],
	},
	// 常識堂（屋台から 店に なってから。赤い 屋根の 軒先）
	{
		id: "shop",
		from: 5,
		text: () => "常識堂",
		look: () => "shiraki",
		at: [14, 15],
	},
	{
		id: "store",
		from: 2,
		text: () => "倉庫",
		look: () => "yakisugi",
		at: [25.5, 15],
	},
];

/** 看板に 出る 字（書体を 読みこむ ときの 字の 一覧。町の 段で かわる 字も ぜんぶ）。 */
export const signChars = (): string => {
	const all = [
		...Object.values(SIGNS).map((s) => s.text),
		...CORE_SIGNS.flatMap((c) =>
			Array.from({ length: 8 }, (_, stage) => c.text(stage)),
		),
	].join("");
	return [...new Set(all)].join("");
};
