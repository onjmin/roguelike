// RPGEN 形式の歩行グラ（16x16・2コマ×4方向。行は 後・右・前・左）を描く。
// unj-reze の lib/walk-sprite.ts（rpgen-walk の規格）に合わせている。

import { getImage } from "./assets";
import type { Dir } from "./types";

/**
 * 歩行グラ（向き×足踏みのシート）の参照か。単体スプライト（`sp:`）や
 * チップシートの切り出し（`#sx,sy,sw,sh` 付き）は向きのない置物として描く。
 */
export const isWalkRef = (ref: string): boolean =>
	!!ref && !ref.startsWith("sp:") && !ref.includes("#");

/** RPGEN 規格の行順。 */
const ROW_OF: Record<Dir, number> = { up: 0, right: 1, down: 2, left: 3 };
const FRAMES = 2;
const ROWS = 4;

// Chromium の drawImage が隣のセルを拾う不具合の対策（unj-reze と同じ値）。
const SAFE_XY = 0.1;
const SAFE_WH = 0.2;

/** 足踏みのコマ番号。ドラクエ風に止まっていても足踏みする（歩くと速くなる）。 */
export const stepFrame = (timeMs: number, moving: boolean): number =>
	Math.floor(timeMs / (moving ? 170 : 400)) % FRAMES;

/**
 * 歩行グラの1コマを描く。(x, y) はマスの左上（ソース画素）。
 * セルがマスより大きい素材は、足元をマスの下端にそろえて中央寄せする。
 * 画像が未読込なら false。
 */
export const drawWalk = (
	ctx: CanvasRenderingContext2D,
	ref: string,
	dir: Dir,
	frame: number,
	x: number,
	y: number,
	scale = 1,
): boolean => {
	const img = getImage(ref);
	if (!img) return false;
	const cw = img.width / FRAMES;
	const ch = img.height / ROWS;
	const sx = (frame % FRAMES) * cw + SAFE_XY;
	const sy = ROW_OF[dir] * ch + SAFE_XY;
	const dw = cw * scale;
	const dh = ch * scale;
	const tile = 16 * scale;
	ctx.drawImage(
		img,
		sx,
		sy,
		cw - SAFE_WH,
		ch - SAFE_WH,
		x + (tile - dw) / 2,
		y + tile - dh,
		dw,
		dh,
	);
	return true;
};

/** 単体スプライト（16x16 等）をマスに描く。 */
export const drawSprite = (
	ctx: CanvasRenderingContext2D,
	ref: string,
	x: number,
	y: number,
	w = 16,
	h = 16,
): boolean => {
	const img = getImage(ref);
	if (!img) return false;
	ctx.drawImage(img, x, y, w, h);
	return true;
};
