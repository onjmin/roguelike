// 村の 曲（data/audio/music.ts）と、寸劇の 曲。
// 語りの 頁の 曲は 寸劇の あいだだけ。寸劇が 終わったら 呼ぶ側が 絞って 村の 曲へ もどす。

import { stageBgm } from "../../data/audio/music";
import type { Story } from "../../engine/defs";
import { loadTown } from "../../engine/save";

/** 寸劇で 曲を 鳴らしたか。 */
let scened = false;

/** 語りの 頁の 曲（null で 止める）。 */
export const sceneBgm = (s: Story, name: string | null): void => {
	s.bgm(name);
	scened = true;
};

/** 寸劇の おわり。寸劇で 曲を 鳴らして いれば true（呼ぶ側が 絞って 村の 曲へ もどす）。 */
export const endScene = (): boolean => {
	const was = scened;
	scened = false;
	return was;
};

/** いま 村で 鳴らす 曲（村の 段の 曲）。 */
export const villageSong = (): string => stageBgm(loadTown().stage);
