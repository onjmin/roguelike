// 数値の決まり。トルネコ1（SFC）の解析値に寄せている（scratchpad の調査レポートより）。
// 調整はここだけでできるようにしておく。

/** 持ち物の枠（装備中の品も数える。トルネコ1と同じく増やす手段は無い）。 */
export const INVENTORY_MAX = 20;

/** 満腹度（×20 で持つ。1行動で 2 減る＝10行動で 1%）。 */
export const HUNGER_UNIT = 20;
export const HUNGER_MAX = 100 * HUNGER_UNIT;

/** 始めの HP・ちから。 */
export const START_HP = 15;
export const START_STR = 8;

/** レベルごとの素の攻撃力（Lv1〜37）。 */
export const BASE_ATK: readonly number[] = [
	5, 7, 9, 11, 13, 16, 19, 22, 25, 29, 33, 37, 41, 46, 51, 56, 61, 65, 71, 74,
	77, 80, 83, 86, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 100,
];

/** そのレベルになるのに要る経験値（Lv1〜37）。 */
export const EXP_AT: readonly number[] = [
	0, 10, 30, 60, 100, 150, 230, 350, 500, 700, 950, 1200, 1500, 1800, 2300,
	3000, 4000, 6000, 9000, 15000, 23000, 33000, 45000, 60000, 80000, 100000,
	130000, 180000, 240000, 300000, 400000, 500000, 600000, 700000, 800000,
	900000, 999999,
];
export const MAX_LV = EXP_AT.length;

/** レベルが上がったときの最大 HP の伸び（3〜7。5 が出やすい）。 */
export const HP_GAIN: readonly number[] = [3, 4, 4, 5, 5, 5, 6, 6, 7];
export const MAX_HP_CAP = 250;
export const STR_CAP = 99;

/** 四捨五入（負の数も絶対値で。−11.5 → −12）。 */
const roundHalfAway = (x: number): number =>
	Math.sign(x) * Math.round(Math.abs(x));

/**
 * 攻撃力。power は 武器の強さ＋ちから。矢・投げた武器は「武器の強さ＋ちから」の代わりに
 * その道具の強さだけを入れる（トルネコ1と同じ。木の矢4なら 素の攻撃力の 3/4）。
 */
export const attackPower = (lv: number, power: number): number => {
	const b = BASE_ATK[Math.max(0, Math.min(BASE_ATK.length, lv) - 1)];
	return Math.max(0, Math.min(255, b + roundHalfAway((b * (power - 8)) / 16)));
};

/**
 * ダメージ = 攻撃力 × n/128 × (15/16)^防御（n は 112〜143）。
 * 原作の整数処理（×15/16 を切り上げながら防御の回数くり返す）に沿う。
 */
export const rollDamage = (atk: number, def: number, n: number): number => {
	let v = atk * n;
	for (let i = 0; i < def; i++) v = Math.ceil((v * 15) / 16);
	return Math.min(255, Math.floor(v / 128));
};

/** 命中率（通常攻撃・矢・投擲。敵味方とも）。 */
export const HIT_RATE = 7 / 8;

/** 自然回復：毎ターン 最大HP を足し、この値ごとに 1 回復。 */
export const REGEN_STEP = 150;

/** 投げて届く距離。 */
export const THROW_RANGE = 10;

/** 階に最初に置く札の枚数の目安（山札を配るときの重み）。モンスターハウスは多め。 */
export const HOUSE_CARD_WEIGHT = 3;

/** 最初に置くモンスターの数。 */
export const INITIAL_MONSTERS: [number, number] = [5, 7];
/** モンスターハウスの追加の数（浅い階は少なめ。HOUSE_EARLY_BY の階まで）。 */
export const HOUSE_MONSTERS: [number, number] = [10, 15];
export const HOUSE_MONSTERS_EARLY: [number, number] = [5, 8];
/** モンスターハウスにする部屋の広さ（マス数）の下限（足りる部屋が無ければ いちばん広い部屋）。 */
export const HOUSE_MIN_AREA = 30;
/** 同時にいるモンスターの上限。 */
export const MONSTER_CAP = 19;
/** この間隔（ターン）ごとに1体湧く。 */
export const SPAWN_EVERY = 64;

/** モンスターハウス（祭り）の出る確率（3階から）。 */
export const HOUSE_CHANCE = 1 / 16;
/**
 * この階までに 祭りが1つも無ければ、HOUSE_EARLY_FROM からこの階のどこかに1つ置く
 * （1回の冒険で 浅いうちに1度は出会えるように）。
 */
export const HOUSE_EARLY_FROM = 4;
export const HOUSE_EARLY_BY = 6;

/** 罠の数（階ごと）。 */
export const trapCount = (level: number): [number, number] =>
	level <= 2
		? [0, 0]
		: level <= 8
			? [1, 3]
			: level <= 15
				? [3, 5]
				: level <= 20
					? [5, 7]
					: [7, 9];
/** 罠が発動する確率。 */
export const TRAP_CHANCE = 3 / 4;

/** 眠っているモンスターが、入室・となりで起きる確率。 */
export const WAKE_CHANCE = 1 / 2;

/**
 * 地震（1つの階に長くいると、下の階へ落ちる）。トルネコ1と同じく 1534・1574 ターン目に揺れ、
 * 1614 ターン目に床がぬける（トルネコ1は向き変え・命名なども行動に数えるが、ここでは時間の進むターンだけ）。
 */
export const QUAKE_TURNS: readonly number[] = [1534, 1574, 1614];

/** モンスターが最初から札を持っている確率。 */
export const CARRY_CHANCE = 1 / 6;
