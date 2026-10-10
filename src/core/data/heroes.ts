// 冒険に 出る 主人公（村では いつも キリコ。行き先を 決める ときに 切りかえる。ui/worldMap.ts）。
// - キリコ：ふつう。
// - 束音ロゼ：壁抜け。壁の 中を 歩ける（いちばん 外の 壁は だめ）・角抜けも できる。壁の 中で 1ターン
//   動くたびに おなかが 5% 減る（角抜けで 床から 床へ 動く ときは ふつう）。壁の 中の ロゼには、
//   範囲の 技（爆発）でしか 手を 出せない。吹きとばされると 壁の 中まで 飛ぶ。
// - 解音ゼロ：残機 3。メイン機 VHz8-0 → プロト HeBc-0 → レン XQxS-0 の 順に、たおれると 次の 機体に
//   バトンタッチ（装備・持ち物・レベルは 引きつぐ。状態異常・おなか・ちからの 減りは もどる）。
//   どの 機体も 初めの HP・ちからは キリコより やや 低い。
// core は data/ を 読まないので、名前と 能力値は ここに じかに 書く（絵は data/cast.ts の heroWalk）。

import { START_HP, START_STR } from "../balance";

export type HeroId = "kiriko" | "roze" | "zero";

export const HERO_IDS: readonly HeroId[] = ["kiriko", "roze", "zero"];

export type ZeroBody = {
	/** 型番（名前欄・図鑑）。 */
	model: string;
	/** 通称（ログの 名前）。 */
	name: string;
	hp: number;
	str: number;
};

/** 解音ゼロの 機体（たおれた 順に 次へ）。 */
export const ZERO_BODIES: readonly ZeroBody[] = [
	{ model: "VHz8-0", name: "ゼロ", hp: START_HP - 2, str: START_STR - 1 },
	{ model: "HeBc-0", name: "プロト", hp: START_HP - 3, str: START_STR - 1 },
	{ model: "XQxS-0", name: "レン", hp: START_HP - 1, str: START_STR - 2 },
];

export const HERO_NAME: Record<HeroId, string> = {
	kiriko: "キリコ",
	roze: "ロゼ",
	zero: "ゼロ",
};

/** はじめの HP・ちから（ゼロは 1機目）。 */
export const heroStart = (h: HeroId): { hp: number; str: number } =>
	h === "zero"
		? {
				hp: ZERO_BODIES[0]?.hp ?? START_HP,
				str: ZERO_BODIES[0]?.str ?? START_STR,
			}
		: { hp: START_HP, str: START_STR };

/** 壁の 中で 1ターン 動いた ときの 満腹度の 減り（×20 の 単位。5%）。 */
export const WALL_HUNGER = 5 * 20;

export const isHeroId = (x: unknown): x is HeroId =>
	typeof x === "string" && (HERO_IDS as readonly string[]).includes(x);
