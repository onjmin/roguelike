// 村の 曲（data/audio/music.ts）と、寸劇の 曲。
// 語りの 頁の 曲は 寸劇の あいだだけ。寸劇が 終わったら 呼ぶ側が 絞って 村の 曲へ もどす。

import { stageBgm } from "../../data/audio/music";
import type { Story } from "../../engine/defs";
import { loadTown } from "../../engine/save";

/** 寸劇で 曲を 鳴らしたか。 */
let scened = false;
/** 寸劇で 止めた 曲と 位置（同じ 曲に もどす ときは 続きから）。 */
let paused: { name: string; step: number } | null = null;

/** 曲を 鳴らす。寸劇で 止めた 曲なら 止めた 位置から。 */
const play = (s: Story, name: string): void => {
	const from = paused?.name === name ? paused.step : 0;
	if (paused?.name === name) paused = null;
	s.bgm(name, from);
};

/** 語りの 頁の 曲（null で 止める）。 */
export const sceneBgm = (s: Story, name: string | null): void => {
	if (name === null) {
		const at = s.bgmAt?.();
		if (at?.name) paused = { name: at.name, step: at.step };
		s.bgm(null);
	} else play(s, name);
	scened = true;
};

/** 寸劇の おわり。寸劇で 曲を 鳴らして いれば true（呼ぶ側が 絞って 村の 曲へ もどす）。 */
export const endScene = (): boolean => {
	const was = scened;
	scened = false;
	return was;
};

/** 寸劇の あとの 村の 曲。寸劇で 止めた 曲なら 続きから。 */
export const backToVillageSong = (s: Story): void => {
	play(s, villageSong());
	paused = null;
};

/** いま 村で 鳴らす 曲（村の 段の 曲）。 */
export const villageSong = (): string => stageBgm(loadTown().stage);
