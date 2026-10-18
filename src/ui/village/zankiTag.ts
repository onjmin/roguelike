// やきうの 頭の 上の「残機：1」（寄り道「残機」。STORY.md §4.9・data/story/story.ts の zankiLine）。
// 語りが「やきうの 頭の 上に、小さく『残機：1』と 出ていた」と 言うので、本当に 頭の 上に 小さく 出す。
// - きのこ板を 持ち帰ってから 1。最終話の あとは、遺影祭り（お祭り会場）を 持ち帰って いれば 99。
// - 持ち帰りの 語りで 数が 出る・かわる 頁（StoryPage.zanki）までは、前の 数の まま（先に 見えて しまわない）。
// 字は 美咲ゴシック（門真 なむ 作・フリー。https://littlelimit.net/misaki.htm）の 点を そのまま 写した もの
// （フォントを 小さく 描くと にじんで 読めない）。白に 近い 字に 黒い 縁を 1ドット。

import type { DungeonId } from "../../core/types";
import type { Actor } from "../../engine/field";
import { TILE } from "../../engine/types";

/** 持ち帰った 板から 決まる 数（出さなければ null）。 */
export const zankiOf = (cleared: readonly DungeonId[]): number | null =>
	!cleared.includes("kinoko")
		? null
		: cleared.includes("deep") && cleared.includes("festival")
			? 99
			: 1;

let town: number | null = null;
/** 語りの あいだの 数（undefined は 語りの 外。持ち帰った 板の 数を 出す）。 */
let scene: number | null | undefined;

/** 村を 組みなおした（持ち帰った 板から 数を 決めなおす）。 */
export const setZankiTown = (cleared: readonly DungeonId[]): void => {
	town = zankiOf(cleared);
};

/** 語りの あいだの 数（null で 出さない・undefined で 語りの 外に もどす）。 */
export const setZankiScene = (n: number | null | undefined): void => {
	scene = n;
};

/** 美咲ゴシックの 点（x が 点。高さ 7 に そろえ、数は 下を 1 あける）。数は 0〜9。 */
const GLYPH: Readonly<Record<string, readonly string[]>> = {
	残: [
		"xxx.x.x",
		".x.xxxx",
		".xx.x..",
		"x.xxxx.",
		".xx.x.x",
		".x...x.",
		"x..xx.x",
	],
	機: [
		".x.x..x",
		"xxx..x.",
		".x.x..x",
		"xxxxxx.",
		"xx.x.xx",
		".x.x.x.",
		".xx.x.x",
	],
	":": [".", ".", "x", ".", ".", "x", "."],
	"0": ["...", ".x.", "x.x", "xxx", "x.x", ".x.", "..."],
	"1": ["...", ".x.", "xx.", ".x.", ".x.", "xxx", "..."],
	"2": ["...", "xx.", "..x", ".x.", "x..", "xxx", "..."],
	"3": ["...", "xx.", "..x", ".x.", "..x", "xx.", "..."],
	"4": ["...", "..x", ".xx", "x.x", "xxx", "..x", "..."],
	"5": ["...", "xxx", "x..", "xx.", "..x", "xx.", "..."],
	"6": ["...", ".xx", "x..", "xx.", "x.x", ".x.", "..."],
	"7": ["...", "xxx", "..x", ".x.", ".x.", ".x.", "..."],
	"8": ["...", ".x.", "x.x", ".x.", "x.x", ".x.", "..."],
	"9": ["...", ".x.", "x.x", ".xx", "..x", "xx.", "..."],
};
const H = 7;

/** 字の 点（左上 から）と 幅。数ごとに 一度だけ 組む。 */
const dots = new Map<string, { w: number; at: [number, number][] }>();
const dotsOf = (text: string): { w: number; at: [number, number][] } => {
	let d = dots.get(text);
	if (d) return d;
	const at: [number, number][] = [];
	let x = 0;
	for (const ch of text) {
		const rows = GLYPH[ch];
		if (!rows) continue;
		rows.forEach((row, y) => {
			for (let i = 0; i < row.length; i++)
				if (row[i] === "x") at.push([x + i, y]);
		});
		x += rows[0].length + 1;
	}
	d = { w: x - 1, at };
	dots.set(text, d);
	return d;
};

const INK = "#f4f4ec";
const EDGE = "#141414";

/** やきうの 頭の 上に 描く（a は やきう。いなければ 何も しない）。 */
export const drawZanki = (
	g: CanvasRenderingContext2D,
	a: Actor | undefined,
	ox: number,
	oy: number,
): void => {
	const n = scene === undefined ? town : scene;
	if (n === null || !a || !a.visible || !a.sprite) return;
	const { w, at } = dotsOf(`残機:${n}`);
	const x = Math.round(a.fx * TILE - ox + TILE / 2 - w / 2);
	const y = Math.round(a.fy * TILE - oy - 3 - H);
	g.save();
	// 縁：点の まわり 1ドット
	g.fillStyle = EDGE;
	for (const [px, py] of at) g.fillRect(x + px - 1, y + py - 1, 3, 3);
	g.fillStyle = INK;
	for (const [px, py] of at) g.fillRect(x + px, y + py, 1, 1);
	g.restore();
};
