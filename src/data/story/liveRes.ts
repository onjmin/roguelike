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
	/** これまで 倒れた 回数（どの 板も）。 */
	deaths: number;
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
	{
		when: (x) => x.kills === 0 && x.depth >= 3,
		lines: ["敵から逃げとるだけで草", "平和主義者か？"],
	},
	{
		when: (x) => x.depth === x.floors - 1,
		lines: ["次、{bottom}やで", "ここまで来たんか"],
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

/** ようすに 合う 行が ない ときの つぶやき（2階に 1回くらい）。 */
const FILLER: readonly string[] = [
	"保守",
	"ROMっとるで",
	"今北産業",
	"このスレ伸びへんな",
	"見とるで",
	"はよ潜れ",
];

/** salt は 冒険の 種と 階から 作る（同じ 階では 同じ 行）。無ければ null。 */
export const liveResLine = (x: LiveState, salt: number): string | null => {
	const pool = POOLS.find((p) => p.when(x));
	const lines = pool?.lines ?? (salt % 2 === 0 ? FILLER : null);
	if (!lines) return null;
	const text = lines[salt % lines.length]
		.replaceAll("{hero}", x.hero)
		.replaceAll("{deaths}", String(x.deaths))
		.replaceAll("{bottom}", x.up ? "てっぺん" : "底");
	return `村のスレ「${text}」`;
};
