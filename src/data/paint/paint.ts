// キリコの 家の「画家の　キャンバス」で 描く 絵の 決まり（板と 保存は ui/paint/paint.ts）。
// - 絵は 32x32 の 点。1点は 16色の 絵の具の 番号（0〜15。0 が 白＝消しゴムの 色）。
// - 保存は 1枚だけ。番号を 16進の 1字ずつ（1024字）に して JSON に 入れる（encodePicture／decodePicture）。
// - 塗りつぶし（floodFill）・左右反転（flipPicture）・元に戻す（UndoStack。20手まで）。
// ここは DOM も 保存も 使わない（src/sim/arcadeHome/paint.ts で 試す）。

/** 絵の 1辺の 点の 数。 */
export const PAINT_SIZE = 32;
/** 元に戻せる 手の 数。 */
export const PAINT_UNDO = 20;
/** 消しゴムの 色（白）。 */
export const PAINT_BLANK = 0;

/** 16色の 絵の具（キリコの 髪・緑・スカート・肌・紺、ぷゆゆの 色 など）。 */
export const PAINT_COLORS: readonly string[] = [
	"#ffffff",
	"#000000",
	"#72241f",
	"#28a131",
	"#926855",
	"#f0c8a8",
	"#031c3e",
	"#f0c838",
	"#e03030",
	"#f08828",
	"#3070e0",
	"#70c8f0",
	"#a050c0",
	"#f098b8",
	"#808080",
	"#c8c8c8",
];

/** 絵（PAINT_SIZE × PAINT_SIZE の 番号。左上から 横へ）。 */
export type Picture = Uint8Array;

export const blankPicture = (): Picture =>
	new Uint8Array(PAINT_SIZE * PAINT_SIZE).fill(PAINT_BLANK);

const inside = (x: number, y: number) =>
	x >= 0 && y >= 0 && x < PAINT_SIZE && y < PAINT_SIZE;

/** 1点を 塗る（外なら 何も しない）。変わったら true。 */
export const setPixel = (
	p: Picture,
	x: number,
	y: number,
	c: number,
): boolean => {
	if (!inside(x, y)) return false;
	const i = y * PAINT_SIZE + x;
	if (p[i] === c) return false;
	p[i] = c;
	return true;
};

export const pixelAt = (p: Picture, x: number, y: number): number =>
	inside(x, y) ? p[y * PAINT_SIZE + x] : PAINT_BLANK;

/** (x0,y0) から (x1,y1) まで 線を 引く（指で すばやく なぞっても とぎれない）。変わったら true。 */
export const drawLine = (
	p: Picture,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	c: number,
): boolean => {
	let changed = false;
	const dx = Math.abs(x1 - x0);
	const dy = -Math.abs(y1 - y0);
	const sx = x0 < x1 ? 1 : -1;
	const sy = y0 < y1 ? 1 : -1;
	let err = dx + dy;
	let x = x0;
	let y = y0;
	for (;;) {
		if (setPixel(p, x, y, c)) changed = true;
		if (x === x1 && y === y1) break;
		const e2 = 2 * err;
		if (e2 >= dy) {
			err += dy;
			x += sx;
		}
		if (e2 <= dx) {
			err += dx;
			y += sy;
		}
	}
	return changed;
};

/** 同じ 色で つながった 所（上下左右）を c で 塗る。変わったら true。 */
export const floodFill = (
	p: Picture,
	x: number,
	y: number,
	c: number,
): boolean => {
	if (!inside(x, y)) return false;
	const from = pixelAt(p, x, y);
	if (from === c) return false;
	const stack = [y * PAINT_SIZE + x];
	while (stack.length) {
		const i = stack.pop() as number;
		if (p[i] !== from) continue;
		p[i] = c;
		const px = i % PAINT_SIZE;
		if (px > 0) stack.push(i - 1);
		if (px < PAINT_SIZE - 1) stack.push(i + 1);
		if (i >= PAINT_SIZE) stack.push(i - PAINT_SIZE);
		if (i < PAINT_SIZE * (PAINT_SIZE - 1)) stack.push(i + PAINT_SIZE);
	}
	return true;
};

/** 左右を 反転する。 */
export const flipPicture = (p: Picture): void => {
	for (let y = 0; y < PAINT_SIZE; y++) {
		const row = p.subarray(y * PAINT_SIZE, (y + 1) * PAINT_SIZE);
		row.reverse();
	}
};

/** 何も 描いて いないか（ぜんぶ 白）。 */
export const isBlank = (p: Picture): boolean =>
	p.every((v) => v === PAINT_BLANK);

/** 保存の 字（16進 1字が 1点）。 */
export const encodePicture = (p: Picture): string =>
	Array.from(p, (v) => (v & 15).toString(16)).join("");

/** 保存の 字から もどす（長さ・字が おかしければ null）。 */
export const decodePicture = (s: unknown): Picture | null => {
	if (typeof s !== "string" || s.length !== PAINT_SIZE * PAINT_SIZE)
		return null;
	if (!/^[0-9a-f]+$/.test(s)) return null;
	const p = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) p[i] = Number.parseInt(s[i], 16);
	return p;
};

/** 元に戻す（描く 前の 絵を 写して 積む。古い ものから 捨てる）。 */
export class UndoStack {
	private stack: Picture[] = [];
	constructor(private readonly max = PAINT_UNDO) {}
	/** 変える 前に 呼ぶ。 */
	push(p: Picture): void {
		this.stack.push(p.slice());
		if (this.stack.length > this.max) this.stack.shift();
	}
	/** 1手 前の 絵（無ければ null）。 */
	pop(): Picture | null {
		return this.stack.pop() ?? null;
	}
	get size(): number {
		return this.stack.length;
	}
}

// ───────────────── 道具と 字 ─────────────────

export type PaintTool =
	| "pen"
	| "eraser"
	| "fill"
	| "picker"
	| "undo"
	| "flip"
	| "clear"
	| "quit";

/** 板の 右下の ボタンの 並び（2列 × 4段）。 */
export const PAINT_TOOLS: readonly PaintTool[] = [
	"pen",
	"eraser",
	"fill",
	"picker",
	"undo",
	"flip",
	"clear",
	"quit",
];

export const PAINT_TEXT = {
	title: "画家のキャンバス",
	hint: "十字キーで動くAで描く右に色と道具\n指でなぞって描けるBを2回でおわる",
	tool: {
		pen: "ペン",
		eraser: "消しゴム",
		fill: "塗る",
		picker: "スポイト",
		undo: "戻す",
		flip: "反転",
		clear: "全消し",
		quit: "おわる",
	} satisfies Record<PaintTool, string>,
	quit1: "もう1回Bでおわる",
	noUndo: "もう戻せない",
	picked: "色をすくった",
	clearAsk: "絵をぜんぶ消す？",
	clearMenu: ["消す", "やめる"],
	quitAsk: "絵を保存する？",
	quitMenu: ["保存する", "保存しない", "描きつづける"],
	saved: "絵を保存した。\nイーゼルに飾っておこう。",
	unsaved: "保存せずに筆をおいた。",
	/** 保存の あとの 名無しの ひとこと（1つ 選ぶ）。 */
	comments: [
		"名無し「うまいやん」",
		"名無し「画伯」",
		"名無し「これは草」",
		"名無し「ワイよりうまい」",
		"名無し「なんやこれ……」",
		"名無し「才能のかたまり」",
		"名無し「ピカソもびっくりや」",
		"名無し「額縁に入れとけ」",
	],
} as const;
