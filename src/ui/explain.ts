// 「せつめい」：ふだんの メッセージ窓に 1ページずつ 文字送りで 出す（道具・罠・モンスター図鑑）。
// 一度に 全部 並べる 窓より 読みやすい（トルネコ1と同じ）。

import type { Ctx } from "./ctx";
import { MessageWindow } from "./message";

/** 「せつめい」の 1文字あたりの ms（村の 会話と 同じ）。 */
const TEXT_MS = 28;
/** 「せつめい」を 出す メッセージ窓（画面ごとに 1つ。はじめて 使うときに 置く）。 */
const explainWins = new WeakMap<HTMLElement, MessageWindow>();

/**
 * 「せつめい」：ふだんの メッセージ窓に 1ページずつ 文字送りで 出す（A/B で 送る。トルネコ1と同じ）。
 * 開いている メニューの 上に 重ねる。
 */
export const explain = async (ctx: Ctx, pages: string[]): Promise<void> => {
	let win = explainWins.get(ctx.ui);
	if (!win) {
		win = new MessageWindow(
			ctx.ui,
			ctx.input,
			() => TEXT_MS,
			() => ctx.audio.seSettled(),
			"over-menu",
		);
		explainWins.set(ctx.ui, win);
	}
	for (const text of pages) await win.show({ text });
	win.close();
};
