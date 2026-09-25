// 階の描画（canvas）。
//
// - 地形は階ごとにオフスクリーンの canvas へ1回だけ描き、画像が読めたら描き直す。
// - 毎フレーム：地形 → 見つけた罠 → 床の道具 → モンスター・キリコ → 霧（見たことのない所は黒、
//   今は見えない所は暗く）→ 演出（飛ぶ道具・攻撃の踏み込み）の順に重ねる。
// - モンスターの表示位置は UI 側が持つ（core の状態は一瞬で変わるので、演出の途中は古い位置に描く）。

import { forEachVisible } from "../core/fov";
import { type Dir8, spriteDir } from "../core/geom";
import { T_WALL, tileAt } from "../core/mapgen";
import type { Floor, RunState } from "../core/types";
import { drawRefInCell, getImage, onImageLoaded } from "../engine/assets";
import type { Screen } from "../engine/screen";
import { drawWalk, stepFrame } from "../engine/sprite";
import { TILE } from "../engine/types";
import { type Theme, TRAP_ICON, themeFor } from "./theme";

/** 画面に描くキャラ（キリコ・モンスター）。 */
export type Figure = {
	id: number;
	sprite: string;
	/** 表示位置（マス。小数で途中を表す）。 */
	fx: number;
	fy: number;
	dir: Dir8;
	/** 攻撃の踏み込み（0〜1）。 */
	lunge: number;
	/** ダメージの点滅が終わる時刻。 */
	flashUntil: number;
	/** 消えていく（0〜1、1 で見えない）。 */
	fade: number;
	/** 眠っている（Z を出す）。 */
	asleep?: boolean;
};

/** 飛んでいるもの（投げた道具・杖の光）。 */
export type Projectile = {
	x: number;
	y: number;
	icon: string | null;
	color: string;
};

export class FloorView {
	private terrain: HTMLCanvasElement | null = null;
	private terrainFloor: Floor | null = null;
	private dirty = true;
	private theme: Theme | null = null;

	constructor() {
		onImageLoaded(() => {
			this.dirty = true;
		});
	}

	/** 階が変わった・マップが作り替えられた。 */
	invalidate(): void {
		this.dirty = true;
	}

	private buildTerrain(s: RunState, lastDepth: number): void {
		const f = s.floor;
		const l = f.layout;
		const theme = themeFor(f.depth, lastDepth);
		this.theme = theme;
		if (!this.terrain || this.terrainFloor !== f) {
			this.terrain = document.createElement("canvas");
			this.terrain.width = l.w * TILE;
			this.terrain.height = l.h * TILE;
		}
		this.terrainFloor = f;
		const ctx = this.terrain.getContext("2d");
		if (!ctx) return;
		ctx.imageSmoothingEnabled = false;
		ctx.fillStyle = theme.dark;
		ctx.fillRect(0, 0, this.terrain.width, this.terrain.height);
		const isOpen = (x: number, y: number) => tileAt(l, x, y) !== T_WALL;
		for (let y = 0; y < l.h; y++) {
			for (let x = 0; x < l.w; x++) {
				const px = x * TILE;
				const py = y * TILE;
				const t = tileAt(l, x, y);
				if (t !== T_WALL) {
					ctx.fillStyle = theme.floorColor;
					ctx.fillRect(px, py, TILE, TILE);
					drawRefInCell(ctx, t === 2 ? theme.corridor : theme.floor, px, py);
					continue;
				}
				// 壁：下が床なら「下の面」、その上は「上の面」
				const variant = (x * 7 + y * 13) % theme.wallLower.length;
				if (isOpen(x, y + 1)) {
					ctx.fillStyle = theme.floorColor;
					ctx.fillRect(px, py, TILE, TILE);
					drawRefInCell(ctx, theme.floor, px, py);
					drawRefInCell(ctx, theme.wallLower[variant], px, py);
				} else if (isOpen(x, y + 2) && !isOpen(x, y + 1)) {
					drawRefInCell(ctx, theme.wallUpper[variant], px, py);
				}
			}
		}
		// 階段
		drawRefInCell(ctx, theme.stairs, f.stairs.x * TILE, f.stairs.y * TILE);
		this.dirty = false;
	}

	/**
	 * 描く。camX/camY はソース画素での画面左上。
	 * visible は今見えているマス（idx の集合）。
	 */
	draw(
		screen: Screen,
		s: RunState,
		lastDepth: number,
		figures: Figure[],
		projectiles: Projectile[],
		camX: number,
		camY: number,
		time: number,
		itemIcon: (kind: string) => string,
	): void {
		if (this.dirty || this.terrainFloor !== s.floor)
			this.buildTerrain(s, lastDepth);
		const ctx = screen.begin();
		const theme = this.theme as Theme;
		const f = s.floor;
		const l = f.layout;
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, screen.width, screen.height);
		const ox = Math.round(camX);
		const oy = Math.round(camY);
		if (this.terrain) ctx.drawImage(this.terrain, -ox, -oy);

		// 見えているマス
		const visible = new Uint8Array(l.w * l.h);
		forEachVisible(l, s.player, (x, y) => {
			visible[y * l.w + x] = 1;
		});
		const seenItem = new Set(s.seen);

		// 見つけた罠
		for (const t of f.traps) {
			if (!t.found || !f.seen[t.y * l.w + t.x]) continue;
			drawRefInCell(ctx, TRAP_ICON[t.kind], t.x * TILE - ox, t.y * TILE - oy);
		}
		// 結界
		for (const i of f.wards) {
			const x = i % l.w;
			const y = Math.floor(i / l.w);
			if (!f.seen[i]) continue;
			ctx.strokeStyle = "rgba(255, 240, 160, 0.8)";
			ctx.lineWidth = 1;
			ctx.strokeRect(x * TILE - ox + 1.5, y * TILE - oy + 1.5, 13, 13);
		}
		// 床の道具（見えている所と、見たことのある道具）
		for (const fi of f.items) {
			const i = fi.y * l.w + fi.x;
			if (!visible[i] && !(f.seen[i] && seenItem.has(fi.item.uid))) continue;
			drawRefInCell(
				ctx,
				itemIcon(fi.item.kind),
				fi.x * TILE - ox,
				fi.y * TILE - oy,
			);
		}

		// キャラ（奥から）
		const sorted = [...figures].sort((a, b) => a.fy - b.fy);
		for (const g of sorted) {
			if (g.fade >= 1) continue;
			if (time < g.flashUntil && Math.floor(time / 60) % 2 === 0) continue;
			const lx = g.lunge * 5;
			const dx = [0, 1, 1, 1, 0, -1, -1, -1][g.dir] * lx;
			const dy = [-1, -1, 0, 1, 1, 1, 0, -1][g.dir] * lx;
			const x = Math.round(g.fx * TILE - ox + dx);
			const y = Math.round(g.fy * TILE - oy + dy);
			ctx.globalAlpha = 1 - g.fade;
			const frame = g.asleep ? 0 : stepFrame(time + ((g.id * 97) % 400), false);
			const drawn = drawWalk(ctx, g.sprite, spriteDir(g.dir), frame, x, y);
			if (!drawn) {
				// 画像がまだ読めていないときは色の丸で代わりに
				ctx.fillStyle = g.id === 0 ? "#6fe0c0" : "#e05060";
				ctx.beginPath();
				ctx.arc(x + 8, y + 9, 5, 0, Math.PI * 2);
				ctx.fill();
			}
			if (g.asleep) {
				ctx.fillStyle = "#cfe8ff";
				ctx.font = "7px sans-serif";
				const bob = Math.floor(time / 500) % 2;
				ctx.fillText("z", x + 12, y + 3 - bob);
			}
			ctx.globalAlpha = 1;
		}

		// 霧：見たことのない所は黒、今は見えない所は暗く
		for (let y = Math.max(0, Math.floor(oy / TILE)); y < l.h; y++) {
			const py = y * TILE - oy;
			if (py > screen.height) break;
			for (let x = Math.max(0, Math.floor(ox / TILE)); x < l.w; x++) {
				const px = x * TILE - ox;
				if (px > screen.width) break;
				const i = y * l.w + x;
				if (visible[i]) continue;
				ctx.fillStyle = f.seen[i] ? theme.fog : "#000";
				ctx.fillRect(px, py, TILE, TILE);
			}
		}

		// 飛んでいるもの
		for (const p of projectiles) {
			const x = Math.round(p.x * TILE - ox);
			const y = Math.round(p.y * TILE - oy);
			if (p.icon && getImage(p.icon)) drawRefInCell(ctx, p.icon, x, y);
			else {
				ctx.fillStyle = p.color;
				ctx.beginPath();
				ctx.arc(x + 8, y + 8, 3, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}
}

/** 全体の地図（見たことのある所だけ）。画面の上に半透明で重ねる。 */
export const drawMap = (
	canvas: HTMLCanvasElement,
	s: RunState,
	opt: { visibleMonsters: { x: number; y: number }[] },
): void => {
	const f = s.floor;
	const l = f.layout;
	const rect = canvas.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	const w = Math.round(rect.width * dpr);
	const h = Math.round(rect.height * dpr);
	if (canvas.width !== w || canvas.height !== h) {
		canvas.width = w;
		canvas.height = h;
	}
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.clearRect(0, 0, w, h);
	const cell = Math.max(2, Math.floor(Math.min(w / (l.w + 2), h / (l.h + 8))));
	const mx = Math.floor((w - cell * l.w) / 2);
	const my = Math.floor((h - cell * l.h) / 2);
	ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
	ctx.fillRect(0, 0, w, h);
	for (let y = 0; y < l.h; y++)
		for (let x = 0; x < l.w; x++) {
			const i = y * l.w + x;
			if (!f.seen[i]) continue;
			const t = l.tiles[i];
			if (t === T_WALL) continue;
			ctx.fillStyle =
				t === 1 ? "rgba(90, 140, 255, 0.55)" : "rgba(120, 160, 255, 0.4)";
			ctx.fillRect(mx + x * cell, my + y * cell, cell, cell);
		}
	const dot = (x: number, y: number, color: string, shrink = 0) => {
		ctx.fillStyle = color;
		ctx.fillRect(
			mx + x * cell + shrink,
			my + y * cell + shrink,
			cell - shrink * 2,
			cell - shrink * 2,
		);
	};
	if (f.seen[f.stairs.y * l.w + f.stairs.x])
		dot(f.stairs.x, f.stairs.y, "#ffffff");
	for (const t of f.traps)
		if (t.found) dot(t.x, t.y, "#ff6ad5", Math.floor(cell / 4));
	const seenItem = new Set(s.seen);
	for (const fi of f.items)
		if (f.seen[fi.y * l.w + fi.x] && seenItem.has(fi.item.uid))
			dot(fi.x, fi.y, "#5ff0ff", Math.floor(cell / 4));
	for (const m of opt.visibleMonsters) dot(m.x, m.y, "#ff5060");
	dot(s.player.x, s.player.y, "#ffcf4a");
};
