// 場面の 時間の 速さ（スローモーション・止め絵。engine/sceneFx.ts の slowmo・freeze・blast が 変える）。
// 見た目だけ：村の 毎こまの 時間（人の 歩き・しぐさ・記号）と、ダンジョンの 寸劇の 1歩に かける。
// 冒険の 状態・乱数・リプレイには さわらない。

let slow = 1;

/** いまの 速さ（1 が ふつう。0 は 止め絵）。 */
export const sceneSlow = (): number => slow;

/** 速さを かえる（エフェクトの 始まりと おわり）。 */
export const setSceneSlow = (k: number): void => {
	slow = Math.max(0, k);
};
