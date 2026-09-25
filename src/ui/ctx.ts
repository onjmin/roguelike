// 画面の部品が共通で受け取るもの（ゲーム本体に頼らずに窓を出せるように）。

import type { GameAudio } from "../engine/audio";
import type { UiCtx } from "./list";

export type Ctx = UiCtx & {
	audio: GameAudio;
	/** 画面全体（#app）。全画面の札を出すとき。 */
	app: HTMLElement;
};
