// 潜っている 途中の 実況（村の スレの 名無しが いまの ようすに つっこむ）。決まった 筋の 1行
// （synopsis.ts の DIVE_RES）が ない 階で、1階に 1つまで（ui/dungeon/play.ts の storyLog）。
// 表示だけ：冒険の 状態・乱数には 触らない（リプレイでは 出さない）。
// どの 行も ログの 1行（「村のスレ「…」」で 全角24字まで）に 収める。

import type { DungeonId } from "../../core/types";

/** いまの ようす（UI が 冒険から 作る）。 */
export type LiveState = {
	hp: number;
	maxHp: number;
	/** 満腹度（%）。 */
	hunger: number;
	/** 武器を 持って いない。 */
	bare: boolean;
	/** 前の 階で 倒した 数。 */
	kills: number;
	/** この 冒険で 倒した 数（どの 階も）。 */
	runKills: number;
	/** これまで 倒れた 回数（どの 板も）。 */
	deaths: number;
	/** これまで 出撃した 回数（この 冒険を 入れて）。 */
	outings: number;
	depth: number;
	floors: number;
	/** 上りの 板（塔・やぐら）。 */
	up: boolean;
	hero: string;
	dungeon: DungeonId;
	/** ぷゆゆが らみ（ぷゆゆソードを 持つ・ぷゆゆパンを 持つ・階に ぷゆゆが いる）。 */
	puyu: boolean;
};

type Pool = {
	when: (x: LiveState) => boolean;
	/** 合った ときに 出る 割合（4 なら 4階に 1回くらい）。 */
	every: number;
	lines: readonly string[];
};

// 上から 先に 合った ものを 使う（あぶない ようすほど 先）。どの ようすでも 煽り・応援・関係ない レスを まぜる
// （おんJの 実況スレの ノリ：見とる だけの 人・晩飯の 話・顔文字だけ も 流れる）
const POOLS: readonly Pool[] = [
	{
		when: (x) => x.hp * 4 <= x.maxHp,
		every: 2,
		lines: [
			"{hero}、HP赤いで！",
			"瀕死で草",
			"はよ草食え！",
			"死ぬぞ定期",
			"救急車呼んだで！村から！",
			"耐えろ！耐えてくれ！",
			"頼むぞ{hero}！",
			"見てられん。風呂入ってくる",
		],
	},
	{
		when: (x) => x.hunger <= 15,
		every: 2,
		lines: [
			"腹の音、村まで聞こえる！",
			"パン拾え定期",
			"餓死RTAか？",
			"だれか差し入れしたれ",
			"ワイも腹へってきた",
		],
	},
	// ぷゆゆは スレに ひと言だけ 書く（ほかの 名無しは 乗らない）
	{
		when: (x) => x.puyu,
		every: 4,
		lines: ["うゆおー", "うゆ", "うゆおー", "うゆ🥺"],
	},
	{
		when: (x) => x.bare,
		every: 3,
		lines: [
			"素手で潜るやつおる！？",
			"武器どこやったんや！",
			"拳で語るタイプか",
			"素手でもいける（適当）",
		],
	},
	{
		when: (x) => x.kills >= 6,
		every: 3,
		lines: [
			"無双しとるやん！",
			"虐殺で草",
			"敵が労基に駆けこんどる",
			"ええぞええぞ！",
			"つよい（確信）",
			"今日はいけるやろこれ",
		],
	},
	// 階段を すぐ 見つけた だけの 階では 言わない（ここまで 1匹も 倒して いない ときだけ）
	{
		when: (x) => x.runKills === 0 && x.depth >= 4,
		every: 3,
		lines: ["敵から逃げとるだけで草", "平和主義者か？", "それも作戦やぞ"],
	},
	{
		when: (x) => x.depth === x.floors - 1,
		every: 2,
		lines: [
			"次、{bottom}やで！",
			"ここまで来たんか！",
			"あと1階！いけ！",
			"緊張してきた",
		],
	},
	{
		when: (x) => x.deaths >= 30,
		every: 4,
		lines: [
			"{deaths}回死んだ伝説の人",
			"死ぬとこ見に来たで",
			"今日の死に場所はここか",
			"今日こそいける気がする",
		],
	},
	{
		when: (x) => x.deaths >= 10,
		every: 4,
		lines: [
			"{deaths}回死んどるやつや！",
			"もう常連やな",
			"今日は何階で死ぬんや",
			"今日は勝つやろ（毎回言うとる）",
		],
	},
	{
		when: (x) => x.deaths >= 3,
		every: 4,
		lines: ["また潜っとる", "{deaths}回死んでもまだ来るんか", "がんばれー"],
	},
];

/**
 * ようすに 合う 行が ない ときの つぶやき（4階に 1回くらい）。出撃の 回数で 段が 上がる
 * （新入り → また来た → 常連 → 住人）。「見とるで」は どの 段にも（やきうの 口ぐせ。正体の 振り）。
 * どの 段にも 関係ない レスを 足す（MISC）。
 */
const FILLER_EVERY = 4;
const FILLER: readonly { from: number; lines: readonly string[] }[] = [
	{
		from: 1,
		lines: ["新入りか？", "見とるで", "保守", "今北産業", "がんばれー"],
	},
	{
		from: 3,
		lines: [
			"また来たんか",
			"見とるで",
			"ROMっとるで",
			"実況で保守したるわ",
			"応援しとるで",
		],
	},
	{
		from: 10,
		lines: [
			"常連やな",
			"見とるで",
			"今日も潜っとる",
			"{outings}回目の出撃や",
			"今日は調子ええ気がする",
		],
	},
	{
		from: 30,
		lines: [
			"もう住人やろ",
			"見とるで",
			"出撃{outings}回目。暇なんか",
			"スレより長生きしとる",
			"もう応援しかできん",
		],
	},
];
const MISC: readonly string[] = [
	"ソースは？",
	"ねむい",
	"晩飯なにしよ",
	"いまきた",
	"ワイも潜りたい",
	"うおおおお",
	"コーラ飲んだら寝る",
	"ID変わったわ",
	"画面暗くて見えん",
	"釣りか？",
];

/** 板の 話題から 脱線した 雑談（つぶやきに まぜる）。 */
const BOARD_MISC: Record<DungeonId, readonly string[]> = {
	shallow: [
		"朝はご飯派なんやが",
		"メロンパンは皮だけでええ",
		"食パンは6枚切り一択",
		"パン屋のトングカチカチしてまう",
	],
	main: [
		"風呂上がりはコーヒー牛乳",
		"サウナ行きたなってきた",
		"42℃は熱すぎやろ",
		"ケロリン桶すこ",
	],
	deep: [
		"スマホの充電5%や",
		"単三電池どこやったっけ",
		"モバイルバッテリー忘れた",
		"電気代上がりすぎやろ",
	],
	kinoko: [
		"しめじ炒めたい",
		"エリンギは裂いて焼け",
		"たけのこの方がうまいやろ",
		"きのこ派やけど黙っとく",
	],
	tropical: [
		"沖縄行きたいわ",
		"サーターアンダギー食いたい",
		"ゴーヤ苦手なんや",
		"海見たい",
	],
	konamono: [
		"お好み焼きはおかずや",
		"たこ焼き器ほしい",
		"ソース派かマヨ派か",
		"明石焼きは別物やろ",
	],
	festival: [
		"りんご飴かたすぎる",
		"金魚すくい下手なんや",
		"焼きそば500円は高い",
		"浴衣着たい人生やった",
	],
	hidden: [
		"昔のおんJはよかった",
		"過去ログ読んどったら朝や",
		"このスレ何年前や",
		"懐かしいコテおるな",
	],
	vocalo: [
		"ボカロ聴きながら見とる",
		"ワイも曲作りたい",
		"調声むずすぎ",
		"新曲まだか",
	],
	mercury: [
		"ここ平和でええな",
		"お茶飲みながら見とる",
		"水星ってどこや",
		"ほのぼのしとる",
	],
	onmu: [
		"相変わらず廃墟やのぅ",
		"ムー昔読んでた",
		"大陸どこいったんや",
		"ムーミンすこ",
	],
	onkimu: [
		"キムチ鍋食いたい",
		"おんキムに来ませんか？",
		"白菜高すぎる",
		"冷蔵庫キムチくさい",
	],
	inferno: [
		"右腕が疼く",
		"黒歴史思い出した",
		"ワイも昔はこうやった",
		"†闇†って打つの面倒",
	],
};

/** salt は 冒険の 種と 階から 作る（同じ 階では 同じ 行）。無ければ null。 */
export const liveResLine = (x: LiveState, salt: number): string | null => {
	// 出るか どうかと どの 行かを 別の 桁から 取る（どちらも salt の 剰余だと かたよる）
	const roll = (Math.imul(salt, 0x9e3779b1) >>> 16) % 12;
	const pool = POOLS.find((p) => p.when(x));
	let lines: readonly string[];
	if (pool) {
		if (roll % pool.every !== 0) return null;
		lines = pool.lines;
	} else {
		if (roll % FILLER_EVERY !== 0) return null;
		const filler =
			[...FILLER].reverse().find((f) => x.outings >= f.from) ?? FILLER[0];
		lines = [...filler.lines, ...MISC, ...BOARD_MISC[x.dungeon]];
	}
	const text = lines[salt % lines.length]
		.replaceAll("{hero}", x.hero)
		.replaceAll("{deaths}", String(x.deaths))
		.replaceAll("{outings}", String(x.outings))
		.replaceAll("{bottom}", x.up ? "てっぺん" : "底");
	return `村のスレ「${text}」`;
};

/**
 * 加入した あとも 内心は ライバル（STORY.md §4.9）：ロゼ・ゼロで 潜りはじめると、村の スレが キリコと くらべる。
 * キリコは 村に 残る（主人公の 交代）。
 */
export const HERO_RIVAL_RES: Readonly<
	Record<"roze" | "zero", readonly string[]>
> = {
	roze: [
		"ロゼ出撃。キリコより先に底いく気や",
		"ロゼ出撃。キリコは運ばれる練習中",
	],
	zero: [
		"ゼロ3機出撃。キリコの記録数えとる",
		"ゼロ出撃。1機0.33敗を返しにいく",
	],
};

export const heroRivalResLine = (
	hero: "roze" | "zero",
	salt: number,
): string => {
	const lines = HERO_RIVAL_RES[hero];
	return `村のスレ「${lines[salt % lines.length]}」`;
};
