// 潜っている 途中の 実況（村の スレの 名無しが いまの ようすに つっこむ）。決まった 筋の 1行
// （synopsis.ts の DIVE_RES）が ない 階で、1階に 1つまで（ui/dungeon/play.ts の storyLog）。
// 表示だけ：冒険の 状態・乱数には 触らない（リプレイでは 出さない）。
// どの 行も ログの 1行（「村のスレ「…」」で 全角24字まで）に 収める。

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
};

type Pool = {
	when: (x: LiveState) => boolean;
	lines: readonly string[];
};

// 上から 先に 合った ものを 使う（あぶない ようすほど 先）
const POOLS: readonly Pool[] = [
	{
		when: (x) => x.hp * 4 <= x.maxHp,
		lines: ["{hero}、HP赤いで", "瀕死で草", "はよ草食え", "死ぬぞ定期"],
	},
	{
		when: (x) => x.hunger <= 15,
		lines: ["腹の音、ここまで聞こえる", "パン拾え定期", "餓死RTAか？"],
	},
	{
		when: (x) => x.bare,
		lines: ["素手で潜るやつおる？", "武器どこやったんや"],
	},
	{
		when: (x) => x.kills >= 6,
		lines: ["無双しとるやん", "虐殺で草", "敵がかわいそうや"],
	},
	// 階段を すぐ 見つけた だけの 階では 言わない（ここまで 1匹も 倒して いない ときだけ）
	{
		when: (x) => x.runKills === 0 && x.depth >= 4,
		lines: ["敵から逃げとるだけで草", "平和主義者か？"],
	},
	{
		when: (x) => x.depth === x.floors - 1,
		lines: ["次、{bottom}やで", "ここまで来たんか"],
	},
	{
		when: (x) => x.deaths >= 30,
		lines: [
			"{deaths}回死んだ伝説の人",
			"死ぬとこ見に来たで",
			"今日の死に場所はここか",
		],
	},
	{
		when: (x) => x.deaths >= 10,
		lines: ["{deaths}回死んどるやつや", "もう常連やな", "今日は何階で死ぬんや"],
	},
	{
		when: (x) => x.deaths >= 3,
		lines: ["また潜っとる", "{deaths}回死んでもまだ来るんか"],
	},
];

/**
 * ようすに 合う 行が ない ときの つぶやき（2階に 1回くらい）。出撃の 回数で 段が 上がる
 * （新入り → また来た → 常連 → 住人）。「見とるで」は どの 段にも（やきうの 口ぐせ。正体の 振り）。
 */
const FILLER: readonly { from: number; lines: readonly string[] }[] = [
	{ from: 1, lines: ["新入りか？", "見とるで", "保守", "今北産業"] },
	{
		from: 3,
		lines: ["また来たんか", "見とるで", "ROMっとるで", "このスレ伸びへんな"],
	},
	{
		from: 10,
		lines: ["常連やな", "見とるで", "今日も潜っとる", "{outings}回目の出撃や"],
	},
	{
		from: 30,
		lines: [
			"もう住人やろ",
			"見とるで",
			"出撃{outings}回目。暇なんか",
			"スレより長生きしとる",
		],
	},
];

/** salt は 冒険の 種と 階から 作る（同じ 階では 同じ 行）。無ければ null。 */
export const liveResLine = (x: LiveState, salt: number): string | null => {
	const pool = POOLS.find((p) => p.when(x));
	const filler =
		[...FILLER].reverse().find((f) => x.outings >= f.from) ?? FILLER[0];
	const lines = pool?.lines ?? (salt % 2 === 0 ? filler.lines : null);
	if (!lines) return null;
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

/**
 * 競争の 相手の 進み具合（core/race.ts。ロゼの 挑戦を 受けた 冒険）。決まった 筋の 行や ふだんの 実況の かわりに 毎階 出す。
 * rival は キリコが いまの 階に いる ときの 相手の 階、before は 1つ 上の 階に いた ときの 相手の 階。
 * 相手が 底で 待って いる あいだは salt に 着いて から 何階めかを わたす（1 から。勝利宣言スレが 進む）。
 */
export const raceResLine = (
	name: string,
	rival: number,
	before: number,
	floors: number,
	salt: number,
): string => {
	const lines =
		rival < floors
			? [
					"{name}もう{n}階やって",
					"{name}、壁抜けて{n}階や",
					"{name}{n}階。はやすぎやろ",
				]
			: before < floors
				? ["{name}、底で勝利宣言スレ立てとる"]
				: // 底に 着いて から 何階め（salt）で 1つずつ 進む。3つ目で ずらす（底で 動けない オチを 先に 言わない）
					[
						"{name}の勝利宣言スレ、まだ1レスや",
						"勝利宣言スレ1レス目「たすけて」",
						"勝利宣言スレ2レス目も「たすけて」",
					];
	const text = lines[
		before < floors || rival < floors
			? salt % lines.length
			: Math.min(Math.max(salt, 1), lines.length) - 1
	]
		.replaceAll("{name}", name)
		.replaceAll("{n}", String(rival));
	return `村のスレ「${text}」`;
};
