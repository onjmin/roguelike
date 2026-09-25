// 8方向と座標の小道具。
//
// 向きは 0〜7 の数で持つ（0 が上、時計回り）。歩行グラは4方向しかないので、
// 描くときは斜めを左右に寄せる（spriteDir）。

export type Pos = { x: number; y: number };

/** 0=上 1=右上 2=右 3=右下 4=下 5=左下 6=左 7=左上 */
export type Dir8 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DIRS8: readonly Dir8[] = [0, 1, 2, 3, 4, 5, 6, 7];

export const DX: readonly number[] = [0, 1, 1, 1, 0, -1, -1, -1];
export const DY: readonly number[] = [-1, -1, 0, 1, 1, 1, 0, -1];

export const isDiagonal = (d: Dir8): boolean => d % 2 === 1;

export const opposite = (d: Dir8): Dir8 => ((d + 4) % 8) as Dir8;

export const rotate = (d: Dir8, steps: number): Dir8 =>
	((((d + steps) % 8) + 8) % 8) as Dir8;

/** (dx, dy) の向き。0,0 なら null。符号だけを見る。 */
export const dirOf = (dx: number, dy: number): Dir8 | null => {
	const sx = Math.sign(dx);
	const sy = Math.sign(dy);
	for (const d of DIRS8) if (DX[d] === sx && DY[d] === sy) return d;
	return null;
};

/** チェビシェフ距離（斜めも1歩）。 */
export const dist = (a: Pos, b: Pos): number =>
	Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export const samePos = (a: Pos, b: Pos): boolean => a.x === b.x && a.y === b.y;

export const step = (p: Pos, d: Dir8, n = 1): Pos => ({
	x: p.x + DX[d] * n,
	y: p.y + DY[d] * n,
});

/** 歩行グラの4方向（RPGEN の行）。斜めは左右に寄せる。 */
export type SpriteDir = "up" | "right" | "down" | "left";
export const spriteDir = (d: Dir8): SpriteDir => {
	if (d === 0) return "up";
	if (d === 4) return "down";
	return d < 4 ? "right" : "left";
};

export const DIR_NAME: readonly string[] = [
	"上",
	"右上",
	"右",
	"右下",
	"下",
	"左下",
	"左",
	"左上",
];
