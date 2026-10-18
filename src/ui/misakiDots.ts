// 頭の 上に 出す 小さな 字（やきうの「残機：1」・キリコの お金の 出入り）。
// 字は 美咲ゴシック（門真 なむ 作・フリー。https://littlelimit.net/misaki.htm）の 点を そのまま 写した もの
// （フォントを 小さく 描くと にじんで 読めない）。白っぽい 字に 黒っぽい 縁を 1ドット。

/** 美咲ゴシックの 点（x が 点。高さ 7 に そろえ、数は 下を 1 あける）。 */
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
	円: [
		"xxxxxxx",
		"x..x..x",
		"x..x..x",
		"xxxxxxx",
		"x.....x",
		"x.....x",
		"x....xx",
	],
	":": [".", ".", "x", ".", ".", "x", "."],
	",": [".", ".", ".", ".", ".", "x", "x"],
	"+": ["...", "...", ".x.", "xxx", ".x.", "...", "..."],
	"−": ["...", "...", "...", "xxx", "...", "...", "..."],
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
/** 字の 高さ（px）。 */
export const MISAKI_H = 7;

/** 字の 点（左上 から）と 幅。文ごとに 一度だけ 組む。 */
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

const EDGE = "#141414";

/** 縁ごと 描いた 小さな 絵（文と 色ごとに 一度だけ。透けさせても 縁が まだらに ならない）。 */
const pics = new Map<string, HTMLCanvasElement>();
const picOf = (text: string, ink: string): HTMLCanvasElement => {
	const key = `${ink}|${text}`;
	let c = pics.get(key);
	if (c) return c;
	const { w, at } = dotsOf(text);
	c = document.createElement("canvas");
	c.width = w + 2;
	c.height = MISAKI_H + 2;
	const g = c.getContext("2d");
	if (g) {
		// 縁：点の まわり 1ドット
		g.fillStyle = EDGE;
		for (const [px, py] of at) g.fillRect(px, py, 3, 3);
		g.fillStyle = ink;
		for (const [px, py] of at) g.fillRect(px + 1, py + 1, 1, 1);
	}
	pics.set(key, c);
	return c;
};

/** 真ん中が cx、上が y に なるよう 描く（ink は 字の 色。透明度は g.globalAlpha で）。 */
export const drawMisaki = (
	g: CanvasRenderingContext2D,
	text: string,
	cx: number,
	y: number,
	ink: string,
): void => {
	const c = picOf(text, ink);
	g.drawImage(c, Math.round(cx - (c.width - 2) / 2) - 1, Math.round(y) - 1);
};
