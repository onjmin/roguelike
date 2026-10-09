// !sk 習字の 板（保守道場の 文机。文と 目は data/neta/sk.ts・text.ts の SK）。
// 240x150（2倍の 下地）：まんなかに 半紙（縦書き 3列。右から「だれが」「どこで」「どうした。」）、左に サイコロ、右に 筆。
// 右の 列から 目が 0.11秒ごとに 回り、A／タップで 止める（3回）。止めた 字は 太く（1px ずらして 2度 書く）。
// 3つ 止めたら 左下に 朱の 落款「蓄」→ 文を ノートに 出して おわる。B（板の 外の タップ）で やめる（null。前に
// 書いた 半紙は その まま。スマホでも やめられる ように）。

import { skColumns, skReelAt, skSentence } from "../data/neta/sk";
import { SK } from "../data/neta/text";
import type { UiCtx } from "./list";
import { board, sleep, tick } from "./minigameBoard";
import {
	crisp,
	drawNeta,
	type G,
	loadNetaImg,
	pressesB,
	txt,
} from "./netaBoard";

export type SkResult = { a: number; b: number; c: number };

const COL_X: readonly number[] = [146, 116, 86];
const LISTS = [SK.who, SK.where, SK.did] as const;

const column = (
	g: G,
	s: string,
	x: number,
	ink: string,
	bold: boolean,
): void => {
	[...s].forEach((ch, i) => {
		// 縦書きの 句点は 右上へ（横書きの 字形は 左下に ある）
		const [dx, dy] = ch === "。" || ch === "、" ? [9, -9] : [0, 0];
		const y = 14 + i * 18 + dy;
		txt(g, ch, x + dx, y, 16, ink, "center");
		if (bold) txt(g, ch, x + dx + 1, y, 16, ink, "center");
	});
};

const draw = (
	g: G,
	img: HTMLImageElement | null,
	picks: readonly number[],
	spin: number,
	stamp: boolean,
): void => {
	g.fillStyle = "#3a2a1a";
	g.fillRect(0, 0, 240, 150);
	g.fillStyle = "#2a1e12";
	g.fillRect(72, 9, 100, 138);
	g.fillStyle = "#f6f4ee";
	g.fillRect(70, 6, 100, 138);
	drawNeta(g, img, "dice", 14, 30, 3);
	drawNeta(g, img, "brush", 182, 40, 3);
	const cols = skColumns(picks[0] ?? 0, picks[1] ?? 0, picks[2] ?? 0);
	for (let k = 0; k < 3; k++) {
		if (k < picks.length) column(g, cols[k], COL_X[k], "#101010", true);
		else if (k === picks.length) {
			const word = LISTS[k][spin];
			column(
				g,
				k === 0 ? `${word}が` : k === 1 ? `${word}で` : `${word}。`,
				COL_X[k],
				"#7a7a7a",
				false,
			);
			g.fillStyle = "#c03030";
			g.beginPath();
			g.moveTo(COL_X[k] - 4, 1);
			g.lineTo(COL_X[k] + 4, 1);
			g.lineTo(COL_X[k], 6);
			g.closePath();
			g.fill();
		}
	}
	if (stamp) {
		g.fillStyle = "#c03030";
		g.fillRect(76, 124, 14, 14);
		txt(g, "蓄", 83, 126, 10, "#f6f4ee", "center");
	}
};

export const playSk = async (ctx: UiCtx): Promise<SkResult | null> => {
	const b = board(ctx, SK.title, SK.hint);
	const g = crisp(b);
	const p = pressesB(ctx, b.root);
	const img = await loadNetaImg();
	const say = (t: string) => {
		b.note.textContent = t;
	};
	const picks: number[] = [];
	try {
		await sleep(300);
		p.take();
		for (let k = 0; k < 3; k++) {
			say(SK.notes[k]);
			const len = LISTS[k].length;
			const off = Math.floor(Math.random() * len);
			const t0 = performance.now();
			for (;;) {
				const now = await tick();
				const spin = skReelAt(t0, now, len, off);
				const key = p.take();
				if (key === "b") return null;
				if (key === "a") {
					picks.push(skReelAt(t0, p.at(), len, off));
					ctx.se("decide");
					break;
				}
				draw(g, img, picks, spin, false);
			}
			draw(g, img, picks, 0, false);
			await sleep(250);
		}
		ctx.se("served");
		draw(g, img, picks, 0, true);
		const [a, bb, c] = picks;
		say(skSentence(a, bb, c));
		const t1 = performance.now();
		while (performance.now() - t1 < 1600) {
			// 書けた あとは A でも B でも 閉じる（半紙は もう 書けて いる）
			if (p.take() !== null) break;
			await tick();
		}
		return { a, b: bb, c };
	} finally {
		p.stop();
		b.close();
	}
};
