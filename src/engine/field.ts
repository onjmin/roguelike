// フィールド（マップ1枚ぶんの実行時状態）：地形の描画キャッシュ・通行判定・キャラの移動。

import { drawRefInCell, onImageLoaded } from "./assets";
import type { EventDef, MapDef, TileDef } from "./defs";
import { drawWalk, isWalkRef, stepFrame } from "./sprite";
import { DIR_VEC, type Dir, TILE } from "./types";

const FALLBACK_TILE: TileDef = { layers: [], color: "#000", passable: false };

export class Actor {
	id: string;
	x: number;
	y: number;
	/** 描画位置（マス単位・小数）。 */
	fx: number;
	fy: number;
	dir: Dir;
	/** 歩行グラ／スプライトの参照（`sa:` `sp:` `pub:`）。空なら見えない。 */
	sprite: string;
	/** 単体スプライト（向きなし）か。 */
	still: boolean;
	visible = true;
	through: boolean;
	def: EventDef | null;
	private tween: {
		fromX: number;
		fromY: number;
		t: number;
		dur: number;
		resolve: () => void;
	} | null = null;
	wanderWait = 1000 + Math.random() * 2000;

	constructor(
		id: string,
		x: number,
		y: number,
		dir: Dir,
		sprite: string,
		def: EventDef | null,
	) {
		this.id = id;
		this.x = this.fx = x;
		this.y = this.fy = y;
		this.dir = dir;
		this.sprite = sprite;
		this.still = !isWalkRef(sprite);
		this.def = def;
		this.through = def?.through ?? !sprite;
	}

	get moving(): boolean {
		return this.tween !== null;
	}

	/** 1マス動く（通行判定は呼ぶ側）。着いたら解決する。 */
	walk(dir: Dir, msPerTile: number): Promise<void> {
		const v = DIR_VEC[dir];
		this.dir = dir;
		return new Promise((resolve) => {
			this.tween = {
				fromX: this.x,
				fromY: this.y,
				t: 0,
				dur: msPerTile,
				resolve,
			};
			this.x += v.dx;
			this.y += v.dy;
		});
	}

	/** その場に置き直す（ワープ）。 */
	setPos(x: number, y: number): void {
		this.x = this.fx = x;
		this.y = this.fy = y;
		const tw = this.tween;
		this.tween = null;
		tw?.resolve();
	}

	update(dt: number): void {
		const tw = this.tween;
		if (!tw) return;
		tw.t += dt;
		const k = Math.min(1, tw.t / tw.dur);
		this.fx = tw.fromX + (this.x - tw.fromX) * k;
		this.fy = tw.fromY + (this.y - tw.fromY) * k;
		if (k >= 1) {
			this.tween = null;
			tw.resolve();
		}
	}

	draw(
		ctx: CanvasRenderingContext2D,
		ox: number,
		oy: number,
		time: number,
	): void {
		if (!this.visible || !this.sprite) return;
		const px = Math.round(this.fx * TILE - ox);
		const py = Math.round(this.fy * TILE - oy);
		if (this.still) {
			drawRefInCell(ctx, this.sprite, px, py);
			return;
		}
		const frame = stepFrame(time + ((this.id.length * 97) % 400), this.moving);
		if (!drawWalk(ctx, this.sprite, this.dir, frame, px, py)) {
			// 読み込み中は小さな影だけ
			ctx.fillStyle = "rgba(0,0,0,0.3)";
			ctx.fillRect(px + 4, py + 12, 8, 3);
		}
	}
}

export class Field {
	readonly def: MapDef;
	readonly w: number;
	readonly h: number;
	private grid: TileDef[];
	private below: HTMLCanvasElement;
	private above: HTMLCanvasElement | null = null;
	private dirty = true;
	private unsub: () => void;
	actors: Actor[] = [];

	constructor(def: MapDef) {
		this.def = def;
		this.h = def.rows.length;
		this.w = Math.max(...def.rows.map((r) => [...r].length));
		this.grid = [];
		for (let y = 0; y < this.h; y++) {
			const row = [...def.rows[y]];
			for (let x = 0; x < this.w; x++) {
				const ch = row[x] ?? " ";
				const t = def.tiles[ch];
				if (!t && ch !== " ") {
					console.warn(
						`[field] ${def.id}: 未定義のタイル文字 "${ch}" (${x},${y})`,
					);
				}
				this.grid.push(t ?? FALLBACK_TILE);
			}
		}
		this.below = document.createElement("canvas");
		this.below.width = this.w * TILE;
		this.below.height = this.h * TILE;
		if (this.grid.some((t) => t.above?.length)) {
			this.above = document.createElement("canvas");
			this.above.width = this.w * TILE;
			this.above.height = this.h * TILE;
		}
		// 素材の読み込みが進むたびに描き直す
		this.unsub = onImageLoaded(() => {
			this.dirty = true;
		});
	}

	dispose(): void {
		this.unsub();
	}

	tileAt(x: number, y: number): TileDef {
		if (x < 0 || y < 0 || x >= this.w || y >= this.h) return FALLBACK_TILE;
		return this.grid[y * this.w + x];
	}

	inBounds(x: number, y: number): boolean {
		return x >= 0 && y >= 0 && x < this.w && y < this.h;
	}

	/** 見えていて通り抜けできないキャラ（自分以外）。 */
	blockerAt(x: number, y: number, self?: Actor): Actor | undefined {
		return this.actors.find(
			(a) =>
				a !== self &&
				a.visible &&
				!a.through &&
				((a.x === x && a.y === y) ||
					(a.moving && Math.round(a.fx) === x && Math.round(a.fy) === y)),
		);
	}

	/** そのマスへ歩いて入れるか。 */
	canEnter(x: number, y: number, self?: Actor): boolean {
		if (!this.tileAt(x, y).passable) return false;
		return !this.blockerAt(x, y, self);
	}

	actor(id: string): Actor | undefined {
		return this.actors.find((a) => a.id === id);
	}

	private redraw(): void {
		this.dirty = false;
		const draw = (
			canvas: HTMLCanvasElement,
			pick: (t: TileDef) => string[] | undefined,
			fill: boolean,
		) => {
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			ctx.imageSmoothingEnabled = false;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			for (let y = 0; y < this.h; y++) {
				for (let x = 0; x < this.w; x++) {
					const t = this.grid[y * this.w + x];
					const px = x * TILE;
					const py = y * TILE;
					if (fill) {
						ctx.fillStyle = t.color;
						ctx.fillRect(px, py, TILE, TILE);
					}
					for (const ref of pick(t) ?? []) drawRefInCell(ctx, ref, px, py);
				}
			}
		};
		draw(this.below, (t) => t.layers, true);
		if (this.above) draw(this.above, (t) => t.above, false);
	}

	/** 地形の下の層（キャラより奥）。 */
	drawBelow(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
		if (this.dirty) this.redraw();
		ctx.drawImage(this.below, -ox, -oy);
	}

	/** 地形の上の層（キャラより手前）。 */
	drawAbove(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
		if (this.above) ctx.drawImage(this.above, -ox, -oy);
	}

	/** マップで使う画像参照を全部集める（先読み用）。 */
	imageRefs(): string[] {
		const refs = new Set<string>();
		for (const t of Object.values(this.def.tiles)) {
			for (const r of t.layers) refs.add(r);
			for (const r of t.above ?? []) refs.add(r);
		}
		return [...refs];
	}

	/**
	 * (sx,sy) から (tx,ty) への最短経路（幅優先）。
	 * 目的地そのものに入れないとき（人・カウンター等）は、隣まで行く経路を返す。
	 */
	findPath(
		sx: number,
		sy: number,
		tx: number,
		ty: number,
		self: Actor,
		maxNodes = 4000,
	): Dir[] | null {
		if (!this.inBounds(tx, ty)) return null;
		const goalEnterable = this.canEnter(tx, ty, self);
		const key = (x: number, y: number) => y * this.w + x;
		const prev = new Map<number, { k: number; d: Dir } | null>();
		prev.set(key(sx, sy), null);
		const queue: [number, number][] = [[sx, sy]];
		const dirs: Dir[] = ["up", "right", "down", "left"];
		let found: number | null = null;
		let head = 0;
		while (head < queue.length && prev.size < maxNodes) {
			const [x, y] = queue[head++];
			const reached = goalEnterable
				? x === tx && y === ty
				: Math.abs(x - tx) + Math.abs(y - ty) === 1;
			if (reached) {
				found = key(x, y);
				break;
			}
			for (const d of dirs) {
				const nx = x + DIR_VEC[d].dx;
				const ny = y + DIR_VEC[d].dy;
				const k = key(nx, ny);
				if (prev.has(k) || !this.inBounds(nx, ny)) continue;
				if (!this.canEnter(nx, ny, self)) continue;
				prev.set(k, { k: key(x, y), d });
				queue.push([nx, ny]);
			}
		}
		if (found === null) return null;
		const path: Dir[] = [];
		let cur = prev.get(found);
		while (cur) {
			path.push(cur.d);
			cur = prev.get(cur.k) ?? null;
		}
		return path.reverse();
	}
}
