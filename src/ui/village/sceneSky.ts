// 場面の 空（村の 時計に かかわらず 夜・朝に 見せる。保存の 時計は かえない）。
// 明かりが 消える・灯る 場面（転の 停電・最終話の 明かりの 坂・停電の 知らせ）と、持ち帰りの 寸劇（朝）で 使う。
// dark：夜の 色で、街灯も 窓も 灯らない（停電）。night：夜の 色で、明かりは ふだんの 夜と 同じ。
// morning：朝の 色（持ち帰りの 寸劇は 朝の 設定。2026-10-18 作者「寸劇では 朝 設定なのに 夕方の 外観に なって いる」）。
// null：村の 時計の まま。
// 色は ui/village/village.ts の 時間帯の 色が 読む。場面の おわりに null に もどす。
// 夜の あいだ 右上の 時計は 時刻を 出さず「夜」だけ（色と 食いちがわない ように）。
// 停電の あいだは 外に 人が いない（sceneOut。場面に 出る 人だけ 残す。明かりが 灯った 通りから 人が もどる）。

import type { DungeonId } from "../../core/types";
import { inBlackout } from "../../data/town/revival";
import { hasFlag, loadProgress } from "../../engine/save";

export type SceneSky = "dark" | "night" | "morning";

/**
 * 場面で 灯す 明かり（店の 並びは そのまま、窓・看板・街灯だけ boards の 板の ぶん。MapDef の lights.scene）。
 * homes が false なら 板に よらない 家の 窓も 消えた まま（明かりの 坂で 通りを 1つずつ 灯す あいだ）。
 */
export type SceneLit = { boards: readonly DungeonId[]; homes: boolean };

/** 夜に 見せる ときの 村の 時計の 時刻（0時からの 分。夜の 色・明かりが いちばん 落ちついた ころ）。 */
export const SCENE_NIGHT_MINUTE = 22 * 60;
/** 朝に 見せる ときの 時刻（どの 日付でも 朝の 色の うち。data/village/daylight.ts の keyframes）。 */
export const SCENE_MORNING_MINUTE = 8 * 60;

/** 空に 合わせた 時計の 時刻（0時からの 分）。 */
export const sceneMinute = (s: SceneSky): number =>
	s === "morning" ? SCENE_MORNING_MINUTE : SCENE_NIGHT_MINUTE;

/** 停電の 夜に 夜の 色へ もう1段 かける 色（multiply）。 */
export const BLACKOUT_TINT = "rgb(105, 110, 150)";

/**
 * 停電の 場面で 外に 見える 人。keep は 場面に 出る 人（いつも 見える）、near は 明かりが 灯った 所
 * （そこから OUT_R マス 以内の 人は 外に もどる）、all は みんな もどった。
 */
export type SceneOut = {
	keep: ReadonlySet<string>;
	near: readonly (readonly [number, number])[];
	all: boolean;
};

/** 灯った 所から 外に もどる 人の 範囲（マス。たて・よこの 大きい方）。 */
const OUT_R = 9;

let sky: SceneSky | null = null;
let lit: SceneLit | null = null;
let out: SceneOut | null = null;
/** 場面の 外の 町の 空（停電の あいだは ずっと dark。村を 組み立てる たびに townSkyNow で きめる）。 */
let town: SceneSky | null = null;

/** 停電を 語った（Progress.flags。転を 見ずに 停電の 知らせで 知った とき）。 */
export const BLACKOUT_TOLD = "toldBlackout";

/**
 * 町の 空（場面の 外）。停電（data/town/revival.ts の inBlackout）を 語ってから 電池板を 持ち帰るまでは、
 * 時計に かかわらず 明かりの ない 夜（昼の 停電は 見ても わからない）。語る 前（転の 前の 語り）は 時計の まま。
 */
export const townSkyNow = (): SceneSky | null =>
	inBlackout(loadProgress()) && (hasFlag("ten") || hasFlag(BLACKOUT_TOLD))
		? "dark"
		: null;

/** 町の 空を きめる（村の 地図を 組み立てる とき。ほかの 地図では null）。 */
export const setTownSky = (s: SceneSky | null): void => {
	town = s;
};

/** いまの 空（場面の 空、なければ 町の 空。null は 村の 時計の まま）。 */
export const sceneSky = (): SceneSky | null => sky ?? town;

/** 場面の 空を かえる（null で 町の 空に もどす。朝か 町の 空なら 灯す 明かりも 消す）。 */
export const setSceneSky = (s: SceneSky | null): void => {
	sky = s;
	if (s && s !== "morning") return;
	lit = null;
	out = null;
};

/**
 * 持ち帰りの 寸劇の 空：村の 時計に かかわらず 朝（頁の sky が null の ときも 朝に もどる。場面の おわりに 時計へ）。
 * 停電の 町（townSkyNow が dark）は 寸劇でも 暗い まま。
 */
export const skitSky = (): SceneSky | null => (townSkyNow() ? null : "morning");

/** 停電の 場面で 外に 見える 人（null は ふだん どおり みんな 見える）。 */
export const sceneOut = (): SceneOut | null => out;

/** 停電の 場面で 外に 見える 人を かえる。 */
export const setSceneOut = (o: SceneOut | null): void => {
	out = o;
};

/** その 人が いま 外に 見えるか（id と いる マス）。 */
export const outsideNow = (id: string, x: number, y: number): boolean =>
	!out ||
	out.all ||
	out.keep.has(id) ||
	out.near.some(
		([cx, cy]) => Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= OUT_R,
	);

/** 場面で 灯す 明かり（null は 空の まま：dark なら 消えて、night なら ふだんの 夜）。 */
export const sceneLit = (): SceneLit | null => lit;

/** 場面で 灯す 明かりを かえる。 */
export const setSceneLit = (l: SceneLit | null): void => {
	lit = l;
};
