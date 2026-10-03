// 階の描画（canvas）。
//
// - 地形は階ごとにオフスクリーンの canvas へ1回だけ描き、画像が読めたら描き直す。
// - 毎フレーム：地形 → 見つけた罠 → 床の道具 → モンスター・キリコ → 霧（見たことのない所は黒、
//   今は見えない所は暗く）→ 演出（飛ぶ道具・攻撃の踏み込み）の順に重ねる。
// - モンスターの表示位置は UI 側が持つ（core の状態は一瞬で変わるので、演出の途中は古い位置に描く）。

import { dungeonById } from "../core/data/dungeons";
import { MONSTERS } from "../core/data/monsters";
import { forEachVisible } from "../core/fov";
import { type Dir8, spriteDir } from "../core/geom";
import { itemHidden } from "../core/item";
import { T_WALL, tileAt } from "../core/mapgen";
import type { Floor, RunState, Trap } from "../core/types";
import { drawRefInCell, getImage, onImageLoaded } from "../engine/assets";
import type { Screen } from "../engine/screen";
import { drawWalk, isWalkRef, stepFrame } from "../engine/sprite";
import { TILE } from "../engine/types";
import { drawEquip, type EquipLook } from "./equip";
import { isUpBoard } from "./floorName";
import {
	type Ambient,
	ANKA_PRESSED,
	type Theme,
	TRAP_ICON,
	themeFor,
	zoneFor,
} from "./theme";

/** ただの 置物の 絵（動きだす 前の 置物の 敵と 同じ。data/monsters.ts の still）。 */
const STATUE_STILL = Object.values(MONSTERS).find((d) => d.still)?.still ?? "";

/** 倒れた所に立つ墓（RPGEN の単体スプライト）。 */
export const GRAVE = "sp:07DETe3";
/** 見えている 壁に かける 影（床を 浮かせて 歩ける 所を 見やすく）。 */
const VISIBLE_WALL_SHADE = "rgba(0, 0, 0, 0.3)";

/** 描くときの ついでの指定。 */
export type DrawOpts = {
	/** まだ 描かない 床の 道具（uid。置かれた 出来事・ログに 画面が 追いつくまで）。 */
	hideItems?: ReadonlySet<number>;
	/** 階の 罠の かわりに 描く 罠（踏んだ 罠は、キリコが 着くまで 踏む 前の 見え方）。 */
	traps?: readonly Trap[];
	/** 向きを変えるあいだ（向きの印を強く出す）。 */
	strong?: boolean;
	/** 倒れた所の墓。drop は 落ちてくる進み（0〜1、1 で着地）。 */
	grave?: { x: number; y: number; drop: number } | null;
	/** キリコの頭の上に出す道具（食べる・飲む・読む演出）。dy は上へずらす画素、angle はラジアン。 */
	overhead?: {
		icon: string;
		dy: number;
		scale: number;
		angle: number;
		alpha: number;
	} | null;
	/** 自動で歩いている 行き先（小さな輪）。 */
	travel?: { x: number; y: number } | null;
	/** 向きを変えるあいだの ねらいの線（向いている先の マス。hit は 当たる敵のマス）。 */
	aim?: {
		cells: { x: number; y: number }[];
		hit: { x: number; y: number } | null;
	} | null;
	/**
	 * 見えている敵で、画面の 見える所（上のステータスと 下のボタンを のぞく。ソース画素）の外にいる敵。
	 * 画面の はしに 小さな 赤い印を出す。
	 */
	edge?: {
		threats: { x: number; y: number }[];
		top: number;
		bottom: number;
	} | null;
};

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
	/** 装備（キリコだけ）。 */
	equip?: EquipLook;
	/** 攻撃で武器を振っている進み（0〜1。振っていなければ −1）。 */
	swing?: number;
	/** 絵の 倍率（ボス。足もとを マスの 下の まんなかに そろえて 大きく 描く。無ければ 1）。 */
	scale?: number;
};

/** 飛んでいるもの（投げた道具・杖の光）。 */
export type Projectile = {
	x: number;
	y: number;
	icon: string | null;
	color: string;
	/** 炎（燃料投下草・炎を 吐く敵）：吐いた マスから 先まで 炎の 帯を 描く。alpha は 消えぎわ。 */
	flame?: { x: number; y: number; alpha: number };
	/** 爆発（地雷・炎上案件）：(x, y) の マスを 中心に まわり r マスまで ふくらむ 火の玉。k は 0〜1 の 進み。 */
	blast?: { r: number; k: number };
};

/** 眠りの Z（ドット。文字だと 小さく にじんで 見えないので 画素で 描く）。小 4×4・大 5×5。 */
const Z_SMALL = ["####", "..#.", ".#..", "####"];
const Z_BIG = ["#####", "...#.", "..#..", ".#...", "#####"];

/**
 * 眠っているキャラの 頭の上に Z を 2つ、右上へ ふわふわ 上らせる（上るほど 大きく、消えていく）。
 * x, y はキャラのマスの 左上（ソース画素）。alpha はキャラの 見えぐあい。
 */
function drawSleepZ(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	time: number,
	alpha: number,
): void {
	const PERIOD = 1400;
	for (let n = 0; n < 2; n++) {
		const k = (time / PERIOD + n / 2) % 1;
		const glyph = k < 0.5 ? Z_SMALL : Z_BIG;
		const zx = Math.round(x + 9 + k * 5);
		const zy = Math.round(y + 1 - k * 9);
		ctx.globalAlpha = alpha * Math.min(1, k * 5, (1 - k) * 3);
		for (let row = 0; row < glyph.length; row++)
			for (let col = 0; col < glyph[row].length; col++) {
				if (glyph[row][col] !== "#") continue;
				// 縁どり（床や 壁の 上でも 見えるように）→ 本体
				ctx.fillStyle = "#1a2440";
				ctx.fillRect(zx + col + 1, zy + row + 1, 1, 1);
			}
		ctx.fillStyle = "#cfe8ff";
		for (let row = 0; row < glyph.length; row++)
			for (let col = 0; col < glyph[row].length; col++)
				if (glyph[row][col] === "#") ctx.fillRect(zx + col, zy + row, 1, 1);
	}
	ctx.globalAlpha = alpha;
}

export class FloorView {
	private terrain: HTMLCanvasElement | null = null;
	private terrainFloor: Floor | null = null;
	private dirty = true;
	private theme: Theme | null = null;
	private offLoaded: () => void;

	constructor() {
		this.offLoaded = onImageLoaded(() => {
			this.dirty = true;
		});
	}

	/** 冒険が終わったら外す（キャッシュの canvas を持ち続けないように）。 */
	dispose(): void {
		this.offLoaded();
		this.terrain = null;
		this.terrainFloor = null;
	}

	/** 階が変わった・マップが作り替えられた。 */
	invalidate(): void {
		this.dirty = true;
	}

	private buildTerrain(s: RunState): void {
		const f = s.floor;
		const l = f.layout;
		const theme = themeFor(s.dungeon, f.depth);
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
		// ただの 置物は 通れないが、床の 上に 立つ 物として 描く（壁の 面は つけない）
		const statues = new Set(f.statues ?? []);
		const isOpen = (x: number, y: number) =>
			tileAt(l, x, y) !== T_WALL || statues.has(y * l.w + x);
		for (let y = 0; y < l.h; y++) {
			for (let x = 0; x < l.w; x++) {
				const px = x * TILE;
				const py = y * TILE;
				const t = tileAt(l, x, y);
				if (statues.has(y * l.w + x)) {
					ctx.fillStyle = theme.floorColor;
					ctx.fillRect(px, py, TILE, TILE);
					drawRefInCell(ctx, theme.floor, px, py);
					drawRefInCell(ctx, STATUE_STILL, px, py);
					continue;
				}
				if (t !== T_WALL) {
					ctx.fillStyle = theme.floorColor;
					ctx.fillRect(px, py, TILE, TILE);
					drawRefInCell(ctx, theme.floor, px, py);
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
		fakeItems: { x: number; y: number; kind: string }[] = [],
		opts: DrawOpts = {},
	): void {
		const facing = { strong: !!opts.strong };
		if (this.dirty || this.terrainFloor !== s.floor) this.buildTerrain(s);
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
		if (s.player.status.blind > 0) {
			// 目が見えないときは まわり1マスだけ
			for (let dy = -1; dy <= 1; dy++)
				for (let dx = -1; dx <= 1; dx++) {
					const x = s.player.x + dx;
					const y = s.player.y + dy;
					if (x >= 0 && y >= 0 && x < l.w && y < l.h) visible[y * l.w + x] = 1;
				}
		} else
			forEachVisible(l, s.player, (x, y) => {
				visible[y * l.w + x] = 1;
			});
		const seenItem = new Set(s.seen);

		// 階段（いちばん奥は、持ち帰る品を拾うまで無い）。上りの 印は 下りの 板の 帰り道と、上りの 板の 行き
		const si = f.stairs.y * l.w + f.stairs.x;
		if (f.seen[si] && (s.depth < lastDepth || s.returning)) {
			const sx = f.stairs.x * TILE - ox;
			const sy = f.stairs.y * TILE - oy;
			drawRefInCell(ctx, theme.stairs, sx, sy);
			if (s.returning !== isUpBoard(s.dungeon)) {
				ctx.fillStyle = "rgba(120, 200, 255, 0.35)";
				ctx.fillRect(sx, sy, TILE, TILE);
				ctx.fillStyle = "#e8f6ff";
				ctx.beginPath();
				ctx.moveTo(sx + 8, sy + 3);
				ctx.lineTo(sx + 13, sy + 9);
				ctx.lineTo(sx + 3, sy + 9);
				ctx.closePath();
				ctx.fill();
			}
		}
		// 踏んだ あとの 安価の罠（罠の 下に。同じ マスに あとから 罠が ふえても 罠が 見える）
		for (const i of f.pressed ?? []) {
			if (!f.seen[i]) continue;
			drawRefInCell(
				ctx,
				ANKA_PRESSED,
				(i % l.w) * TILE - ox,
				Math.floor(i / l.w) * TILE - oy,
			);
		}
		// 見つけた罠
		for (const t of opts.traps ?? f.traps) {
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
			// 見えない 道具（!skスレ）は 見透し草を 飲むまで 描かない
			if (itemHidden(s, fi.item.kind)) continue;
			if (opts.hideItems?.has(fi.item.uid)) continue;
			if (
				!visible[i] &&
				!(f.seen[i] && seenItem.has(fi.item.uid)) &&
				!f.senseItems
			)
				continue;
			drawRefInCell(
				ctx,
				itemIcon(fi.item.kind),
				fi.x * TILE - ox,
				fi.y * TILE - oy,
			);
		}

		// 化けている敵（道具の見た目で描く）
		for (const fk of fakeItems)
			drawRefInCell(ctx, itemIcon(fk.kind), fk.x * TILE - ox, fk.y * TILE - oy);

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
			const sd = spriteDir(g.dir);
			// 装備：体のうしろに隠れる側 → 体 → 体の前に出る側
			if (g.equip)
				drawEquip(ctx, g.equip, sd, frame, x, y, "under", g.swing ?? -1);
			// 1コマの 絵（動きだす 前の 置物）は 歩かず そのまま。
			// 大きく 描く 絵（ボス）は 足もとを マスの 下の まんなかに そろえる（drawWalk の scale は
			// 大きい マスの 左上から 描くので、その ぶん 左上へ ずらす）
			const sc = g.scale ?? 1;
			const drawn = isWalkRef(g.sprite)
				? drawWalk(
						ctx,
						g.sprite,
						sd,
						frame,
						x - (TILE * (sc - 1)) / 2,
						y - TILE * (sc - 1),
						sc,
					)
				: drawRefInCell(ctx, g.sprite, x, y);
			if (g.equip && drawn)
				drawEquip(ctx, g.equip, sd, frame, x, y, "over", g.swing ?? -1);
			if (!drawn) {
				// 画像がまだ読めていないときは色の丸で代わりに
				ctx.fillStyle = g.id === 0 ? "#6fe0c0" : "#e05060";
				ctx.beginPath();
				ctx.arc(x + 8, y + 9, 5, 0, Math.PI * 2);
				ctx.fill();
			}
			if (g.asleep)
				drawSleepZ(
					ctx,
					x + (TILE * (sc - 1)) / 2,
					y - TILE * (sc - 1),
					time + g.id * 311,
					1 - g.fade,
				);
			ctx.globalAlpha = 1;
		}

		// 倒れた所の墓（上から落ちてきて、少しはねる）
		if (opts.grave) {
			const g = opts.grave;
			const k = Math.max(0, Math.min(1, g.drop));
			const fall =
				k < 0.7
					? (1 - k / 0.7) ** 2 * -40
					: -Math.sin(((k - 0.7) / 0.3) * Math.PI) * 3;
			const x = g.x * TILE - ox;
			const y = Math.round(g.y * TILE - oy + fall);
			if (k > 0) {
				ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
				ctx.beginPath();
				ctx.ellipse(
					x + 8,
					g.y * TILE - oy + 15,
					5 * k + 1,
					1.5,
					0,
					0,
					Math.PI * 2,
				);
				ctx.fill();
				if (getImage(GRAVE)) drawRefInCell(ctx, GRAVE, x, y);
				else {
					ctx.fillStyle = "#9a98a8";
					ctx.fillRect(x + 4, y + 3, 8, 12);
				}
			}
		}

		// キリコの頭の上の道具（食べる・飲む・読む）
		const me = figures.find((g) => g.id === 0);
		if (opts.overhead && me) {
			const o = opts.overhead;
			ctx.save();
			ctx.globalAlpha = Math.max(0, Math.min(1, o.alpha));
			ctx.translate(
				Math.round(me.fx * TILE + TILE / 2 - ox),
				Math.round(me.fy * TILE - oy + 2 - o.dy),
			);
			ctx.rotate(o.angle);
			ctx.scale(o.scale, o.scale);
			drawRefInCell(ctx, o.icon, -TILE / 2, -TILE);
			ctx.restore();
		}

		// 自動で歩いている 行き先
		if (opts.travel) {
			ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.arc(
				opts.travel.x * TILE + TILE / 2 - ox,
				opts.travel.y * TILE + TILE / 2 - oy,
				4.5,
				0,
				Math.PI * 2,
			);
			ctx.stroke();
		}
		// 向きを変えるあいだの ねらいの線（矢・杖・投げた物の 通り道。当たる敵は 赤い枠）
		if (opts.aim) {
			ctx.fillStyle = "rgba(255, 207, 74, 0.35)";
			for (const c of opts.aim.cells)
				ctx.fillRect(
					c.x * TILE + TILE / 2 - 1.5 - ox,
					c.y * TILE + TILE / 2 - 1.5 - oy,
					3,
					3,
				);
			if (opts.aim.hit) {
				ctx.strokeStyle = "rgba(255, 80, 96, 0.9)";
				ctx.lineWidth = 1;
				ctx.strokeRect(
					opts.aim.hit.x * TILE - ox + 0.5,
					opts.aim.hit.y * TILE - oy + 0.5,
					TILE - 1,
					TILE - 1,
				);
			}
		}

		// キリコの向き（歩行グラは4方向しかなく、斜めの向きが絵では わからないので印を出す）
		if (me && me.fade <= 0 && !opts.grave && !opts.overhead) {
			const d = me.dir;
			const vx = [0, 1, 1, 1, 0, -1, -1, -1][d];
			const vy = [-1, -1, 0, 1, 1, 1, 0, -1][d];
			const len = Math.hypot(vx, vy);
			const ux = vx / len;
			const uy = vy / len;
			const cx = me.fx * TILE + TILE / 2 - ox;
			const cy = me.fy * TILE + TILE / 2 - oy;
			if (facing.strong) {
				// 向きを変えるあいだは、向いている先のマスも囲む
				ctx.strokeStyle = "rgba(255, 207, 74, 0.9)";
				ctx.lineWidth = 1;
				ctx.strokeRect(
					Math.round(cx - TILE / 2 + vx * TILE) + 0.5,
					Math.round(cy - TILE / 2 + vy * TILE) + 0.5,
					TILE - 1,
					TILE - 1,
				);
			}
			const px = cx + ux * 10;
			const py = cy + uy * 10;
			ctx.beginPath();
			ctx.moveTo(px + ux * 3.5, py + uy * 3.5);
			ctx.lineTo(px - ux * 2 - uy * 3, py - uy * 2 + ux * 3);
			ctx.lineTo(px - ux * 2 + uy * 3, py - uy * 2 - ux * 3);
			ctx.closePath();
			ctx.fillStyle = facing.strong
				? "rgba(255, 207, 74, 1)"
				: "rgba(255, 207, 74, 0.75)";
			ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
			ctx.lineWidth = 1;
			ctx.fill();
			ctx.stroke();
		}

		// 画面の外（上のステータス・下のボタンの裏も）にいる 見えている敵：はしに 小さな 赤い三角
		if (opts.edge)
			for (const t of opts.edge.threats) {
				const sx = t.x * TILE + TILE / 2 - ox;
				const sy = t.y * TILE + TILE / 2 - oy;
				const left = 6;
				const right = screen.width - 6;
				const top = opts.edge.top + 6;
				const bottom = opts.edge.bottom - 6;
				if (sx >= left && sx <= right && sy >= top && sy <= bottom) continue;
				const ex = Math.min(right, Math.max(left, sx));
				const ey = Math.min(bottom, Math.max(top, sy));
				const a = Math.atan2(sy - ey, sx - ex);
				ctx.fillStyle = "rgba(255, 80, 96, 0.9)";
				ctx.beginPath();
				ctx.moveTo(ex + Math.cos(a) * 5, ey + Math.sin(a) * 5);
				ctx.lineTo(ex + Math.cos(a + 2.4) * 4, ey + Math.sin(a + 2.4) * 4);
				ctx.lineTo(ex + Math.cos(a - 2.4) * 4, ey + Math.sin(a - 2.4) * 4);
				ctx.closePath();
				ctx.fill();
			}

		// ただよう粒（層ごとの雰囲気。霧の下に描くので、見えている所にだけ出る）
		drawAmbient(
			ctx,
			zoneFor(s.dungeon, f.depth).ambient,
			time,
			ox,
			oy,
			screen.width,
			screen.height,
		);

		// 霧：見たことのない所は黒、今は見えない所は暗く
		for (let y = Math.max(0, Math.floor(oy / TILE)); y < l.h; y++) {
			const py = y * TILE - oy;
			if (py > screen.height) break;
			for (let x = Math.max(0, Math.floor(ox / TILE)); x < l.w; x++) {
				const px = x * TILE - ox;
				if (px > screen.width) break;
				const i = y * l.w + x;
				if (visible[i]) {
					// 見えている 壁も 少し 暗く（床と 岩の 絵が 似た 板でも、通路の 続く 向きが 読めるように）
					if (l.tiles[i] === T_WALL) {
						ctx.fillStyle = VISIBLE_WALL_SHADE;
						ctx.fillRect(px, py, TILE, TILE);
					}
					continue;
				}
				if (!f.seen[i]) {
					ctx.fillStyle = "#000";
					ctx.fillRect(px, py, TILE, TILE);
					continue;
				}
				// 覚えている 所：床は 霧を うすく、壁は もっと 暗く（歩ける 所が 一目で わかるように）
				const wall = l.tiles[i] === T_WALL;
				ctx.fillStyle = theme.fog;
				ctx.globalAlpha = wall ? 1 : 0.7;
				ctx.fillRect(px, py, TILE, TILE);
				ctx.globalAlpha = 1;
				if (wall) {
					ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
					ctx.fillRect(px, py, TILE, TILE);
				}
			}
		}

		// 飛んでいるもの
		for (const p of projectiles) {
			const x = Math.round(p.x * TILE - ox);
			const y = Math.round(p.y * TILE - oy);
			if (p.blast) drawBlast(ctx, p, p.blast, ox, oy);
			else if (p.flame) drawFlame(ctx, p.flame, p, ox, oy, time);
			else if (p.icon && getImage(p.icon)) drawRefInCell(ctx, p.icon, x, y);
			else {
				ctx.fillStyle = p.color;
				ctx.beginPath();
				ctx.arc(x + 8, y + 8, 3, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}
}

/**
 * 炎の 帯（from の マスの ふちから to まで）。先ほど 大きく、ちらちら ゆれる。
 * 外は 赤・だいだい、芯は 黄色。
 */
const drawFlame = (
	ctx: CanvasRenderingContext2D,
	from: { x: number; y: number; alpha: number },
	to: { x: number; y: number },
	ox: number,
	oy: number,
	time: number,
): void => {
	const cx = (v: number, o: number) => v * TILE - o + TILE / 2;
	let dx = to.x - from.x;
	let dy = to.y - from.y;
	const len = Math.hypot(dx, dy);
	// 吐いた マスの ふちから（口もと）。先が まだ 近ければ となりの マスへ 少し だけ
	const ux = len > 0 ? dx / len : 0;
	const uy = len > 0 ? dy / len : 0;
	const sx = cx(from.x, ox) + ux * TILE * 0.4;
	const sy = cy0(from.y, oy) + uy * TILE * 0.4;
	const ex = cx(to.x, ox);
	const ey = cy0(to.y, oy);
	dx = ex - sx;
	dy = ey - sy;
	const px = Math.hypot(dx, dy);
	const n = Math.max(2, Math.ceil(px / 4));
	const tick = Math.floor(time / 50);
	ctx.save();
	for (let i = 0; i <= n; i++) {
		const u = i / n;
		const f = hash01(i * 13 + tick);
		const r = 2.5 + 4.5 * u + f * 2;
		const jx = (hash01(i * 7 + tick * 3) - 0.5) * 2;
		const jy = (hash01(i * 11 + tick * 5) - 0.5) * 2;
		const x = sx + dx * u + jx;
		const y = sy + dy * u + jy;
		ctx.globalAlpha = from.alpha * (0.45 + 0.55 * u);
		ctx.fillStyle = f > 0.55 ? "#ff5a1f" : "#ff9a2e";
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = "#fff0a0";
		ctx.beginPath();
		ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
};

const cy0 = (v: number, o: number) => v * TILE - o + TILE / 2;

/**
 * 爆発。はじめに 白い 閃光、火の玉が まわり r マス（巻きこむ 範囲の ふち）まで 一気に ふくらみ、
 * 火が 引くと 黒い けむりが 残って 消える。粒の 置き場所は 決まった 乱数（毎コマ 同じ）。
 */
const drawBlast = (
	ctx: CanvasRenderingContext2D,
	at: { x: number; y: number },
	b: { r: number; k: number },
	ox: number,
	oy: number,
): void => {
	const x0 = cy0(at.x, ox);
	const y0 = cy0(at.y, oy);
	const reach = (b.r + 0.5) * TILE;
	const k = b.k;
	// ふくらみは 最初の 3割で ほぼ 出きる（ease-out）
	const grow = 1 - (1 - Math.min(1, k / 0.35)) ** 3;
	const n = 12 + b.r * 10;
	ctx.save();
	// けむり（火の 下に。後半に 濃く なって 消える）
	for (let i = 0; i < n; i++) {
		const a = hash01(i * 3.7) * Math.PI * 2;
		const d = Math.sqrt(hash01(i * 5.3 + 1)) * reach * grow;
		const rise = k * 6;
		const alpha = k < 0.3 ? 0 : Math.min(1, (k - 0.3) / 0.2) * (1 - k) * 0.8;
		if (alpha <= 0) continue;
		ctx.globalAlpha = alpha;
		ctx.fillStyle = hash01(i * 9.1) > 0.5 ? "#4a3e3a" : "#6a5c56";
		ctx.beginPath();
		ctx.arc(
			x0 + Math.cos(a) * d,
			y0 + Math.sin(a) * d - rise,
			TILE * (0.3 + 0.25 * hash01(i * 2.9)) * (0.8 + k * 0.6),
			0,
			Math.PI * 2,
		);
		ctx.fill();
	}
	// 火の玉（外は 赤・だいだい、芯は 黄色。後半は しぼんで 消える）
	const fire = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
	if (fire > 0)
		for (let i = 0; i < n; i++) {
			const a = hash01(i * 7.3 + 4) * Math.PI * 2;
			const d = Math.sqrt(hash01(i * 11.7 + 2)) * reach * grow * 0.85;
			const r = TILE * (0.35 + 0.3 * hash01(i * 13.1)) * (1.1 - k * 0.6);
			const x = x0 + Math.cos(a) * d;
			const y = y0 + Math.sin(a) * d;
			ctx.globalAlpha = fire;
			ctx.fillStyle = hash01(i * 17.3) > 0.5 ? "#ff5a1f" : "#ff9a2e";
			ctx.beginPath();
			ctx.arc(x, y, r, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = "#fff0a0";
			ctx.beginPath();
			ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
			ctx.fill();
		}
	// はじめの 閃光（まん中の 白い 玉）
	if (k < 0.2) {
		ctx.globalAlpha = 1 - k / 0.2;
		ctx.fillStyle = "#fffbe8";
		ctx.beginPath();
		ctx.arc(x0, y0, TILE * (0.6 + b.r * 0.5) * (0.5 + grow), 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
};

/** 0〜1 の決まった乱数（粒の置き場所など。毎コマ同じ値になる）。 */
const hash01 = (n: number): number => {
	const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

/**
 * 層の粒を描く。粒は地面に対して止まった空間にあり（歩くと景色といっしょに流れる）、
 * 画面の大きさの箱を くり返して しきつめる。
 */
const drawAmbient = (
	ctx: CanvasRenderingContext2D,
	kind: Ambient,
	time: number,
	ox: number,
	oy: number,
	w: number,
	h: number,
): void => {
	const sec = time / 1000;
	const n = Math.round(((w * h) / (240 * 400)) * 40);
	const wrap = (v: number, m: number) => ((v % m) + m) % m;
	for (let i = 0; i < n; i++) {
		const r1 = hash01(i);
		const r2 = hash01(i + 101);
		const r3 = hash01(i + 211);
		let x = r1 * w;
		let y = r2 * h;
		let a = 0.5;
		let size = 1;
		let color = "#fff";
		switch (kind) {
			case "dust":
				y += sec * (3 + r3 * 4);
				x += Math.sin(sec * 0.6 + i) * 4;
				a = 0.35 + r3 * 0.35;
				size = r3 > 0.75 ? 2 : 1;
				color = "#e6d3a8";
				break;
			case "spores":
				y -= sec * (4 + r3 * 5);
				x += Math.sin(sec * 0.8 + i * 1.3) * 7;
				a = 0.55 + 0.4 * Math.sin(sec * 2 + i);
				size = r3 > 0.6 ? 2 : 1;
				color = "#d8ff8a";
				break;
			case "snow":
				y += sec * (10 + r3 * 10);
				x += -sec * 4 + Math.sin(sec * 1.1 + i) * 5;
				a = 0.5 + r3 * 0.35;
				size = r3 > 0.7 ? 2 : 1;
				color = "#e6f4ff";
				break;
			case "data":
				y += sec * (28 + r3 * 30);
				a = Math.floor(sec * 6 + i * 0.7) % 3 === 0 ? 0.15 : 0.55;
				color = i % 3 === 0 ? "#6fe6ff" : "#b58cff";
				break;
			case "embers":
				y -= sec * (12 + r3 * 14);
				x += Math.sin(sec * 1.7 + i * 2.1) * 5;
				a = 0.45 + 0.4 * Math.sin(sec * 9 + i * 3.7);
				size = r3 > 0.8 ? 2 : 1;
				color = r3 > 0.5 ? "#ffb04a" : "#ff6a3a";
				break;
			case "glitter":
				a = Math.max(0, Math.sin(sec * 1.6 + i * 1.7)) ** 6;
				color = "#ffe9a0";
				break;
		}
		if (a <= 0.02) continue;
		const px = Math.round(wrap(x - ox, w));
		const py = Math.round(wrap(y - oy, h));
		ctx.globalAlpha = Math.min(1, a);
		ctx.fillStyle = color;
		if (kind === "data") ctx.fillRect(px, py, 1, 3);
		else if (kind === "glitter") {
			ctx.fillRect(px, py - 1, 1, 3);
			ctx.fillRect(px - 1, py, 3, 1);
		} else ctx.fillRect(px, py, size, size);
	}
	ctx.globalAlpha = 1;
};

/** 全体の地図（見たことのある所だけ）。画面の上に半透明で重ねる。 */
/** 地図の升目（デバイス画素）：1マスの大きさと 左上の位置。描くのも タップを マスに直すのも これで。 */
/** 階の 使っている 範囲（壁でない マスを かこむ 四角）。地図は ここに 合わせて 大きく 描く。 */
const usedBounds = new WeakMap<
	object,
	{ x0: number; y0: number; bw: number; bh: number }
>();
const boundsOf = (l: { w: number; h: number; tiles: ArrayLike<number> }) => {
	const hit = usedBounds.get(l);
	if (hit) return hit;
	let x0 = l.w;
	let y0 = l.h;
	let x1 = -1;
	let y1 = -1;
	for (let y = 0; y < l.h; y++)
		for (let x = 0; x < l.w; x++)
			if (l.tiles[y * l.w + x] !== T_WALL) {
				x0 = Math.min(x0, x);
				y0 = Math.min(y0, y);
				x1 = Math.max(x1, x);
				y1 = Math.max(y1, y);
			}
	const b =
		x1 < 0
			? { x0: 0, y0: 0, bw: l.w, bh: l.h }
			: { x0, y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1 };
	usedBounds.set(l, b);
	return b;
};

const mapGeometry = (
	canvas: HTMLCanvasElement,
	l: { w: number; h: number; tiles: ArrayLike<number> },
) => {
	const rect = canvas.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	const w = Math.round(rect.width * dpr);
	const h = Math.round(rect.height * dpr);
	// 階の まわりの 使っていない 壁の ぶんは 切って、そのぶん 大きく（縦長の スマホでは 横幅で 決まる）
	const { x0, y0, bw, bh } = boundsOf(l);
	const cell = Math.max(2, Math.floor(Math.min(w / (bw + 2), h / (bh + 8))));
	return {
		rect,
		dpr,
		w,
		h,
		cell,
		mx: Math.floor((w - cell * bw) / 2) - x0 * cell,
		my: Math.floor((h - cell * bh) / 2) - y0 * cell,
	};
};

/** 地図の上で タップした所（画面の座標）の マスと、1マスの CSS 画素。地図の外なら null。 */
export const mapTileAt = (
	canvas: HTMLCanvasElement,
	s: RunState,
	clientX: number,
	clientY: number,
): { x: number; y: number; cellCss: number } | null => {
	const l = s.floor.layout;
	const g = mapGeometry(canvas, l);
	const x = Math.floor(((clientX - g.rect.left) * g.dpr - g.mx) / g.cell);
	const y = Math.floor(((clientY - g.rect.top) * g.dpr - g.my) / g.cell);
	return x >= 0 && y >= 0 && x < l.w && y < l.h
		? { x, y, cellCss: g.cell / g.dpr }
		: null;
};

export const drawMap = (
	canvas: HTMLCanvasElement,
	s: RunState,
	opt: {
		visibleMonsters: { x: number; y: number }[];
		/** タップで選んだ 行き先（地図を閉じる前に 一瞬 光らせる）。 */
		mark?: { x: number; y: number } | null;
		/** 途中で止まった 行き先（タップすると 続きを 歩く）。 */
		resume?: { x: number; y: number } | null;
		/** まだ 描かない 床の 道具（uid。DrawOpts.hideItems と 同じ）。 */
		hideItems?: ReadonlySet<number>;
		/** DrawOpts.traps と 同じ。 */
		traps?: readonly Trap[];
	},
): void => {
	const f = s.floor;
	const l = f.layout;
	const { w, h, cell, mx, my } = mapGeometry(canvas, l);
	if (canvas.width !== w || canvas.height !== h) {
		canvas.width = w;
		canvas.height = h;
	}
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	// 画面は 暗くしない（トルネコ・シレンと 同じく、地図だけ うっすら 重ねる。まわりの 敵・床も 見える）
	ctx.clearRect(0, 0, w, h);
	for (let y = 0; y < l.h; y++)
		for (let x = 0; x < l.w; x++) {
			const i = y * l.w + x;
			if (!f.seen[i]) continue;
			const t = f.statues?.includes(i) ? 1 : l.tiles[i];
			if (t === T_WALL) continue;
			ctx.fillStyle =
				t === 1 ? "rgba(90, 140, 255, 0.55)" : "rgba(120, 160, 255, 0.4)";
			ctx.fillRect(mx + x * cell, my + y * cell, cell, cell);
		}
	// 印は 暗い ふちで かこむ（明るい 床の 上でも 見えるように）
	const dot = (x: number, y: number, color: string, shrink = 0) => {
		const px = mx + x * cell + shrink;
		const py = my + y * cell + shrink;
		const sz = cell - shrink * 2;
		const edge = Math.max(1, Math.round(cell / 8));
		ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
		ctx.fillRect(px - edge, py - edge, sz + edge * 2, sz + edge * 2);
		ctx.fillStyle = color;
		ctx.fillRect(px, py, sz, sz);
	};
	// いちばん底は、原盤を拾うまで階段が無い
	if (
		f.seen[f.stairs.y * l.w + f.stairs.x] &&
		(f.depth < dungeonById(s.dungeon).floors || s.returning)
	)
		dot(f.stairs.x, f.stairs.y, "#ffffff");
	for (const t of opt.traps ?? f.traps)
		if (t.found) dot(t.x, t.y, "#ff6ad5", Math.floor(cell / 4));
	const seenItem = new Set(s.seen);
	for (const fi of f.items)
		if (
			!itemHidden(s, fi.item.kind) &&
			!opt.hideItems?.has(fi.item.uid) &&
			(f.senseItems || (f.seen[fi.y * l.w + fi.x] && seenItem.has(fi.item.uid)))
		)
			dot(fi.x, fi.y, "#5ff0ff", Math.floor(cell / 4));
	for (const m of opt.visibleMonsters) dot(m.x, m.y, "#ff5060");
	dot(s.player.x, s.player.y, "#ffcf4a");
	if (opt.resume) {
		ctx.strokeStyle = "rgba(255, 207, 74, 0.9)";
		ctx.lineWidth = Math.max(1, cell / 4);
		ctx.strokeRect(
			mx + opt.resume.x * cell - cell * 0.5,
			my + opt.resume.y * cell - cell * 0.5,
			cell * 2,
			cell * 2,
		);
	}
	if (opt.mark) {
		const r = Math.max(cell * 1.6, 8);
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = Math.max(2, cell / 3);
		ctx.beginPath();
		ctx.arc(
			mx + (opt.mark.x + 0.5) * cell,
			my + (opt.mark.y + 0.5) * cell,
			r,
			0,
			Math.PI * 2,
		);
		ctx.stroke();
	}
};
