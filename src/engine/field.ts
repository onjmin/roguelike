// フィールド（マップ1枚ぶんの実行時状態）：地形の描画キャッシュ・通行判定・キャラの移動。

import {
	cropOf,
	drawRefInCell,
	getImage,
	onImageLoaded,
	overflowsCell,
} from "./assets";
import type { EventDef, MapDef, TileDef } from "./defs";
import { drawWalk, isWalkRef, stepFrame } from "./sprite";
import { DIR_VEC, type Dir, TILE } from "./types";

const FALLBACK_TILE: TileDef = { layers: [], color: "#000", passable: false };
/** 上の層に隠れた隊列を透かして見せる濃さ。 */
const HIDDEN_ALPHA = 0.45;
/** 体の画素のうち、これだけ上の層に覆われたら「隠れた」とみなして透かす。 */
const HIDDEN_RATIO = 0.9;
/** 隠れぐあいを測る画用紙（マスの左右1マス・上2マスまで入る）。 */
const PROBE_W = 3 * TILE;
const PROBE_H = 3 * TILE;
/**
 * 場面で 台などを とびこえる ときの 弧の 高さ（px。Actor.jump）。下へ とぶ ときは 下りる ぶん 高く する
 * （台ごしに 2マス 下りると、弧が 低くては 上がって 見えず、台を すべり 落ちる ように 見えた）。
 */
const JUMP_LIFT = TILE / 2;

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
	/** 乗り物（キリコの 保守トロッコ。体を 少し 上げて、腰から 下に かぶせて 描く）。 */
	vehicle: string | null = null;
	def: EventDef | null;
	private tween: {
		fromX: number;
		fromY: number;
		t: number;
		dur: number;
		resolve: () => void;
		/** とぶ 弧の 高さ（px。歩くなら 0）。 */
		lift: number;
	} | null = null;
	/** いま 浮いている 高さ（px。jump の あいだだけ）。 */
	private lift = 0;
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
				lift: 0,
			};
			this.x += v.dx;
			this.y += v.dy;
		});
	}

	/**
	 * (x, y) へ 弧を えがいて とぶ（場面で 台などを とびこえる。engine/longWalk.ts の hopRoute。通行判定は 呼ぶ側）。
	 * 着いたら 解決する。
	 */
	jump(x: number, y: number, ms: number): Promise<void> {
		const dx = x - this.x;
		const dy = y - this.y;
		if (dx || dy)
			this.dir =
				Math.abs(dx) > Math.abs(dy)
					? dx > 0
						? "right"
						: "left"
					: dy > 0
						? "down"
						: "up";
		return new Promise((resolve) => {
			this.tween = {
				fromX: this.x,
				fromY: this.y,
				t: 0,
				dur: ms,
				resolve,
				lift: JUMP_LIFT + Math.max(0, dy) * (TILE / 2),
			};
			this.x = x;
			this.y = y;
		});
	}

	/** その場に置き直す（ワープ）。 */
	setPos(x: number, y: number): void {
		this.x = this.fx = x;
		this.y = this.fy = y;
		this.lift = 0;
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
		this.lift = tw.lift * Math.sin(Math.PI * k);
		if (k >= 1) {
			this.tween = null;
			this.lift = 0;
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
		const py = Math.round(this.fy * TILE - oy - this.lift);
		if (this.still) {
			drawRefInCell(ctx, this.sprite, px, py);
			return;
		}
		const frame = stepFrame(time + ((this.id.length * 97) % 400), this.moving);
		const seat = this.vehicle ? 3 : 0;
		if (!drawWalk(ctx, this.sprite, this.dir, frame, px, py - seat)) {
			// 読み込み中は小さな影だけ
			ctx.fillStyle = "rgba(0,0,0,0.3)";
			ctx.fillRect(px + 4, py + 12, 8, 3);
		}
		if (this.vehicle) drawRefInCell(ctx, this.vehicle, px, py);
	}
}

export class Field {
	readonly def: MapDef;
	readonly w: number;
	readonly h: number;
	private grid: TileDef[];
	private below: HTMLCanvasElement;
	private above: HTMLCanvasElement | null = null;
	/** drawHidden の下書き用。 */
	private ghost: HTMLCanvasElement | null = null;
	/** 隠れぐあいを測る用（キャラ1人ぶん）。 */
	private probe: HTMLCanvasElement | null = null;
	/** 上の層の各画素の濃さ（alpha）。隠れぐあいを測るのに使う。 */
	private cover: Uint8Array | null = null;
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

	/**
	 * 裏から調べられない物か。人ではなく、地形かイベントの絵が上のマスへはみ出す物
	 * （本棚・掲示板など）は、北どなりが裏側になる。
	 */
	hasBack(a: Actor): boolean {
		if (a.sprite && !a.still) return false;
		const t = this.tileAt(a.x, a.y);
		return [...t.layers, ...(t.above ?? []), a.sprite].some(
			(r) => !!r && overflowsCell(r, TILE),
		);
	}

	/**
	 * 地形を2枚に描く。layers はマスの中だけを奥（below）へ、上のマスへはみ出した部分は
	 * 手前（above）へ回す（本棚・掲示板の裏に立つと体が隠れる）。above はまるごと手前。
	 * キャラは 16px のマスに収まるので、はみ出しを手前に描いても前に立つキャラは隠れない。
	 */
	private redraw(): void {
		this.dirty = false;
		const tiles = [...new Set(this.grid)];
		if (
			!this.above &&
			tiles.some(
				(t) => t.above?.length || t.layers.some((r) => overflowsCell(r, TILE)),
			)
		) {
			this.above = document.createElement("canvas");
			this.above.width = this.w * TILE;
			this.above.height = this.h * TILE;
		}
		const draw = (
			canvas: HTMLCanvasElement,
			paint: (
				ctx: CanvasRenderingContext2D,
				t: TileDef,
				px: number,
				py: number,
			) => void,
		) => {
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			ctx.imageSmoothingEnabled = false;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			for (let y = 0; y < this.h; y++) {
				for (let x = 0; x < this.w; x++) {
					paint(ctx, this.grid[y * this.w + x], x * TILE, y * TILE);
				}
			}
		};
		draw(this.below, (ctx, t, px, py) => {
			ctx.fillStyle = t.color;
			ctx.fillRect(px, py, TILE, TILE);
			for (const ref of t.layers) drawRefInCell(ctx, ref, px, py, TILE, "cell");
			if (t.auto) this.drawAuto(ctx, t.auto, px / TILE, py / TILE);
		});
		if (this.above)
			draw(this.above, (ctx, t, px, py) => {
				for (const ref of t.layers)
					drawRefInCell(ctx, ref, px, py, TILE, "over");
				for (const ref of t.above ?? []) drawRefInCell(ctx, ref, px, py);
			});
		this.cover = null;
		const actx = this.above?.getContext("2d");
		if (actx) {
			try {
				const { data } = actx.getImageData(0, 0, this.w * TILE, this.h * TILE);
				const cover = new Uint8Array(data.length / 4);
				for (let i = 0; i < cover.length; i++) cover[i] = data[i * 4 + 3];
				this.cover = cover;
			} catch {
				// 読めない（よその画像で汚れた画用紙）ときは透かしをあきらめる
			}
		}
	}

	/** キャラの絵が上の層にほとんど隠れているか（見えている画素が HIDDEN_RATIO ぶん以下）。 */
	private hidden(a: Actor, time: number): boolean {
		const cover = this.cover;
		if (!cover || !a.visible || !a.sprite) return false;
		// 足もとの マスに 上の層が 1画素も かかって いなければ 隠れては いない（絵を 読まずに すます）
		const mw = this.w * TILE;
		const mh = this.h * TILE;
		const cx = Math.round(a.fx * TILE);
		const cy = Math.round(a.fy * TILE);
		let near = false;
		for (let y = Math.max(0, cy); y < Math.min(mh, cy + TILE) && !near; y++)
			for (let x = Math.max(0, cx); x < Math.min(mw, cx + TILE); x++)
				if (cover[y * mw + x] >= 128) {
					near = true;
					break;
				}
		if (!near) return false;
		const s = this.probe ?? document.createElement("canvas");
		this.probe = s;
		s.width = PROBE_W;
		s.height = PROBE_H;
		const sx = s.getContext("2d", { willReadFrequently: true });
		if (!sx) return false;
		// マスの左上が (TILE, PROBE_H - TILE) に来るように描く
		const bx = Math.round(a.fx * TILE) - TILE;
		const by = Math.round(a.fy * TILE) - (PROBE_H - TILE);
		a.draw(sx, bx, by, time);
		const { data } = sx.getImageData(0, 0, PROBE_W, PROBE_H);
		let body = 0;
		let covered = 0;
		for (let y = 0; y < PROBE_H; y++) {
			for (let x = 0; x < PROBE_W; x++) {
				if (data[(y * PROBE_W + x) * 4 + 3] < 128) continue;
				body++;
				const X = bx + x;
				const Y = by + y;
				if (X >= 0 && Y >= 0 && X < mw && Y < mh && cover[Y * mw + X] >= 128)
					covered++;
			}
		}
		return body > 0 && covered >= body * HIDDEN_RATIO;
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

	/**
	 * 上の層にほとんど隠れたキャラを、隠れたところだけ薄く描く（本棚の裏に回っても見失わない）。
	 * 体が少しでも見えているキャラ（木の葉が肩にかかる等）は透かさない。
	 * actors は奥から順に。まわりだけを別の画用紙に描き、上の層がある画素だけ残して重ねる。
	 */
	drawHidden(
		ctx: CanvasRenderingContext2D,
		party: Actor[],
		ox: number,
		oy: number,
		time: number,
	): void {
		if (!this.above) return;
		const actors = party.filter((a) => this.hidden(a, time));
		if (!actors.length) return;
		let x0 = Infinity;
		let y0 = Infinity;
		let x1 = -Infinity;
		let y1 = -Infinity;
		for (const a of actors) {
			if (!a.visible || !a.sprite) continue;
			const px = a.fx * TILE - ox;
			const py = a.fy * TILE - oy;
			// 絵がマスより大きくても入るよう、左右1マス・上2マスの余白をとる
			x0 = Math.min(x0, px - TILE);
			x1 = Math.max(x1, px + 2 * TILE);
			y0 = Math.min(y0, py - 2 * TILE);
			y1 = Math.max(y1, py + TILE);
		}
		if (x0 > x1) return;
		// 画面の実画素で描く（カメラは実画素単位で動くので、上の層とずれない）
		const m = ctx.getTransform();
		const dx = Math.floor(m.a * x0 + m.e);
		const dy = Math.floor(m.d * y0 + m.f);
		const w = Math.ceil(m.a * (x1 - x0)) + 1;
		const h = Math.ceil(m.d * (y1 - y0)) + 1;
		const g = this.ghost ?? document.createElement("canvas");
		this.ghost = g;
		if (g.width < w) g.width = w;
		if (g.height < h) g.height = h;
		const gx = g.getContext("2d");
		if (!gx) return;
		gx.setTransform(1, 0, 0, 1, 0, 0);
		gx.clearRect(0, 0, w, h);
		gx.setTransform(m.a, 0, 0, m.d, m.e - dx, m.f - dy);
		gx.imageSmoothingEnabled = false;
		for (const a of actors) a.draw(gx, ox, oy, time);
		gx.globalCompositeOperation = "destination-in";
		gx.drawImage(this.above, -ox, -oy);
		gx.globalCompositeOperation = "source-over";
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = HIDDEN_ALPHA;
		ctx.drawImage(g, 0, 0, w, h, dx, dy, w, h);
		ctx.restore();
	}

	/**
	 * オートタイルを 8x8 の 4つに 分けて 描く。角ごとに、縦・横・ななめの となりが
	 * 同じ auto か で 5つの 形（外の角・左右の岸・上下の岸・内の角・まんなか）から えらぶ。
	 * 地図の 外は つながっている ことに する。
	 */
	private drawAuto(
		ctx: CanvasRenderingContext2D,
		ref: string,
		x: number,
		y: number,
	): void {
		const img = getImage(ref);
		const c = cropOf(ref);
		if (!img || !c) return;
		const same = (dx: number, dy: number) =>
			!this.inBounds(x + dx, y + dy) ||
			this.tileAt(x + dx, y + dy).auto === ref;
		const H = TILE / 2;
		for (const [qx, qy] of [
			[0, 0],
			[1, 0],
			[0, 1],
			[1, 1],
		]) {
			const dx = qx ? 1 : -1;
			const dy = qy ? 1 : -1;
			const v = same(0, dy);
			const h = same(dx, 0);
			const kind = !v && !h ? 0 : !h ? 1 : !v ? 2 : same(dx, dy) ? 4 : 3;
			ctx.drawImage(
				img,
				c.sx + qx * H,
				c.sy + kind * TILE + qy * H,
				H,
				H,
				x * TILE + qx * H,
				y * TILE + qy * H,
				H,
				H,
			);
		}
	}

	/** マップで使う画像参照を全部集める（先読み用）。 */
	imageRefs(): string[] {
		const refs = new Set<string>();
		for (const t of Object.values(this.def.tiles)) {
			for (const r of t.layers) refs.add(r);
			for (const r of t.above ?? []) refs.add(r);
			if (t.auto) refs.add(t.auto);
		}
		for (const r of this.def.images ?? []) refs.add(r);
		return [...refs];
	}

	/**
	 * (sx,sy) から (tx,ty) への最短経路（幅優先）。
	 * 目的地そのものに入れないとき（人・カウンター等）は、隣まで行く経路を返す。
	 * noBack なら北どなり（背の高い物の裏）には着かない。
	 * avoid の マス（踏むと 起きる 扉・出口など）は、目的地の ほかは 通らない。
	 */
	findPath(
		sx: number,
		sy: number,
		tx: number,
		ty: number,
		self: Actor,
		noBack = false,
		avoid?: (x: number, y: number) => boolean,
		maxNodes = this.w * this.h,
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
				: Math.abs(x - tx) + Math.abs(y - ty) === 1 &&
					!(noBack && x === tx && y === ty - 1);
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
				if (avoid?.(nx, ny) && !(nx === tx && ny === ty)) continue;
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
