// 「A Few Moments Later」の 札（スポンジ・ボブの 時間とびの 字幕。2026-10-23 作者「スポンジボブみたいな カットも」）。
// 村の 語りで すこし 時間が とぶ 頁（StoryPage.later）に、暗転の かわりに 出す。音は 呼ぶ 側が 鳴らす（fewMomentsLater）。
// 画面の ない ところ（シミュレーション）では 何も しない。

import { settings } from "./settings";

/** 札を 見せる 長さ（ms。音の 声が 言いおわる まで）。 */
const HOLD_MS = 2300;

/**
 * 札を 出して、HOLD_MS 見せて 消す。shown は 画面を 覆いおわった とき（下で 暗転して よい）、done は 消えおわった とき。
 */
export const showLaterCard = (
	root: HTMLElement | null,
): { shown: Promise<void>; done: Promise<void> } => {
	if (!root || typeof document === "undefined") {
		const now = Promise.resolve();
		return { shown: now, done: now };
	}
	const hold = settings.speed === "fast" ? HOLD_MS * 0.7 : HOLD_MS;
	const card = document.createElement("div");
	card.className = "later-card";
	const text = document.createElement("div");
	text.className = "later-card-text";
	for (const word of ["A Few", "Moments", "Later"]) {
		const line = document.createElement("span");
		line.textContent = word;
		text.appendChild(line);
	}
	card.appendChild(text);
	root.appendChild(card);
	const shown = new Promise<void>((res) => {
		requestAnimationFrame(() => {
			card.classList.add("shown");
			setTimeout(res, 160);
		});
	});
	const done = shown.then(
		() =>
			new Promise<void>((res) => {
				setTimeout(() => {
					card.classList.remove("shown");
					setTimeout(() => {
						card.remove();
						res();
					}, 200);
				}, hold);
			}),
	);
	return { shown, done };
};
