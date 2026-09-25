// 装備した武器・盾の透過素材（public/sprites/equip/<種類>.png）を、キリコの歩行グラに重ねる。
//
// 素材の並び（1枚 200×320。セルは 40×40 で、キリコの 16×16 のマスはセルの左から12・上から16の所。
// 刃の先や振りがマスの外へ はみ出すぶん、セルを大きくしてある）：
// - 列：足踏み1・足踏み2・振りかぶる・ななめ・前（攻撃の3つの形）
// - 行：上から4行が「体の前に重ねる」側（上・右・下・左向き）、下の4行が「体のうしろ」側（同じ順）
// 描く順は「うしろ側 → キリコ → 前側」。足踏みのコマはキリコと同じものを使うので、腕のふりと そろって動く。
// 素材の下描きは scripts/make-equip.mjs が src/ui/equipArt.ts から書き出す（作者が描き直して差し替えてよい）。

import type { SpriteDir } from "../core/geom";
import { getImage } from "../engine/assets";

export type EquipLook = { weapon: string | null; shield: string | null };

/** セルの大きさと、セルの中のキリコのマスの位置。 */
export const EQUIP_CELL = 40;
export const EQUIP_OX = 12;
export const EQUIP_OY = 16;
/** 列（足踏み2つ・攻撃の3つの形）と行（前4・うしろ4）の数。 */
export const EQUIP_COLS = 5;
export const EQUIP_ROWS = 8;
/** 行の順（RPGEN の歩行グラと同じ：上・右・下・左）。 */
export const DIR_ROW: Record<SpriteDir, number> = {
	up: 0,
	right: 1,
	down: 2,
	left: 3,
};
/** 攻撃の3つの形が、振りの進み（0〜1）のどこにあたるか（書き出しに使う代表の値）。 */
export const SWING_POSES: readonly number[] = [0.2, 0.5, 0.85];

export const equipSheet = (kind: string): string =>
	`pub:sprites/equip/${kind}.png`;

/** 列：ふだんは足踏みのコマ、攻撃中は振りの形。 */
const colOf = (frame: number, swing: number): number =>
	swing < 0 ? frame % 2 : 2 + (swing < 0.34 ? 0 : swing < 0.67 ? 1 : 2);

// Chromium の drawImage が隣のセルを拾う不具合の対策（sprite.ts と同じ値）
const SAFE_XY = 0.1;
const SAFE_WH = 0.2;

/**
 * キリコのマス (x, y)（ソース画素・マスの左上）に、装備の layer の側を描く。
 * swing は攻撃の進み（0〜1。攻撃していなければ −1）。盾は振らない（足踏みのコマのまま）。
 */
export const drawEquip = (
	ctx: CanvasRenderingContext2D,
	look: EquipLook,
	dir: SpriteDir,
	frame: number,
	x: number,
	y: number,
	layer: "over" | "under",
	swing = -1,
): void => {
	const row = (layer === "over" ? 0 : 4) + DIR_ROW[dir];
	// 盾を先に、武器をその上に
	const parts: [string | null, number][] = [
		[look.shield, frame % 2],
		[look.weapon, colOf(frame, swing)],
	];
	for (const [kind, col] of parts) {
		if (!kind) continue;
		const img = getImage(equipSheet(kind));
		if (!img) continue;
		ctx.drawImage(
			img,
			col * EQUIP_CELL + SAFE_XY,
			row * EQUIP_CELL + SAFE_XY,
			EQUIP_CELL - SAFE_WH,
			EQUIP_CELL - SAFE_WH,
			x - EQUIP_OX,
			y - EQUIP_OY,
			EQUIP_CELL,
			EQUIP_CELL,
		);
	}
};
