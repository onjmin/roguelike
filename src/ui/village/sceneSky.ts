// 場面の 空（村の 時計に かかわらず 夜に 見せる。保存の 時計は かえない）。
// 明かりが 消える・灯る 場面（転の 停電・最終話の 明かりの 坂・停電の 知らせ）で 使う。
// dark：夜の 色で、街灯も 窓も 灯らない（停電）。night：夜の 色で、明かりは ふだんの 夜と 同じ。null：村の 時計の まま。
// 色は ui/village/village.ts の 時間帯の 色が 読む。場面の おわりに null に もどす。

export type SceneSky = "dark" | "night";

/** 夜に 見せる ときの 村の 時計の 時刻（0時からの 分。夜の 色・明かりが いちばん 落ちついた ころ）。 */
export const SCENE_NIGHT_MINUTE = 22 * 60;

let sky: SceneSky | null = null;

/** いまの 場面の 空（null は 村の 時計の まま）。 */
export const sceneSky = (): SceneSky | null => sky;

/** 場面の 空を かえる（null で 村の 時計に もどす）。 */
export const setSceneSky = (s: SceneSky | null): void => {
	sky = s;
};
