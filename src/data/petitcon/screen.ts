// BASIC の 画面（DOM なし）。字の 面（30x18 マス）と 絵の 面（240x150 の 点。色の 番号）を 持つ。
// ui/petitcon/petitcon.ts が 毎こま 絵の 面 → 字の 面の 順に 板へ 描く。

export const SCR_W = 240;
export const SCR_H = 150;
/** 字の マス（8px の 字。DotGothic16 は 2倍の 下地で 16px に なり、にじまない）。 */
export const CELL = 8;
export const COLS = 30;
export const ROWS = 18;
/** 字の 面の 上の すきま（150 - 18x8 = 6 の 半分）。 */
export const TEXT_TOP = 3;
/** PRINT の「,」で そろえる 幅。 */
export const TAB = 6;

/** 16色（プチコン ふう。0 は 字の 下地では すきとおる）。16〜 は ぷゆゆ 用。 */
export const PALETTE: readonly string[] = [
	"#000000",
	"#000000",
	"#7f0000",
	"#ff0000",
	"#007f00",
	"#00ff00",
	"#7f7f00",
	"#ffff00",
	"#00007f",
	"#0000ff",
	"#7f007f",
	"#ff00ff",
	"#007f7f",
	"#00ffff",
	"#7f7f7f",
	"#ffffff",
	// ぷゆゆの 体・目
	"#f0c838",
	"#2a1408",
];

const col = (c: number): number => {
	const n = Math.floor(c);
	return n >= 0 && n < 16 ? n : 15;
};

export class Screen {
	/** 絵の 面（色の 番号）。 */
	readonly px = new Uint8Array(SCR_W * SCR_H);
	readonly ch: string[] = new Array(COLS * ROWS).fill(" ");
	readonly fg = new Uint8Array(COLS * ROWS);
	readonly bg = new Uint8Array(COLS * ROWS);
	cx = 0;
	cy = 0;
	ink = 15;
	paper = 0;
	/** PRINT した 字の すべて（試験で 読む。長すぎたら 前を 捨てる）。 */
	log = "";
	/** 絵か 字が かわった（描きなおす）。 */
	dirty = true;

	constructor() {
		this.cls();
	}

	cls(): void {
		this.ch.fill(" ");
		this.fg.fill(15);
		this.bg.fill(0);
		this.px.fill(0);
		this.cx = 0;
		this.cy = 0;
		this.dirty = true;
	}

	gcls(c = 0): void {
		this.px.fill(col(c));
		this.dirty = true;
	}

	color(fg: number, bg?: number): void {
		this.ink = col(fg);
		if (bg !== undefined) this.paper = col(bg);
	}

	locate(x: number, y: number): void {
		this.cx = Math.max(0, Math.min(COLS - 1, Math.floor(x)));
		this.cy = Math.max(0, Math.min(ROWS - 1, Math.floor(y)));
	}

	/** 1行 上へ ずらす。 */
	private scroll(): void {
		const n = COLS * (ROWS - 1);
		this.ch.copyWithin(0, COLS);
		this.fg.copyWithin(0, COLS);
		this.bg.copyWithin(0, COLS);
		this.ch.fill(" ", n);
		this.fg.fill(15, n);
		this.bg.fill(0, n);
		this.cy = ROWS - 1;
	}

	newline(): void {
		this.log += "\n";
		this.cx = 0;
		this.cy++;
		if (this.cy >= ROWS) this.scroll();
		this.dirty = true;
	}

	put(s: string): void {
		this.log += s;
		if (this.log.length > 8000) this.log = this.log.slice(-4000);
		for (const c of s) {
			if (this.cx >= COLS) this.newline();
			const i = this.cy * COLS + this.cx;
			this.ch[i] = c;
			this.fg[i] = this.ink;
			this.bg[i] = this.paper;
			this.cx++;
		}
		this.dirty = true;
	}

	tab(): void {
		const to = (Math.floor(this.cx / TAB) + 1) * TAB;
		if (to >= COLS) this.newline();
		else this.put(" ".repeat(to - this.cx));
	}

	/** 字の 面の 1行（試験で 読む。右の 空白は 取る）。 */
	row(y: number): string {
		return this.ch
			.slice(y * COLS, (y + 1) * COLS)
			.join("")
			.trimEnd();
	}

	// ───────── 絵 ─────────

	pset(x: number, y: number, c: number): void {
		const X = Math.floor(x);
		const Y = Math.floor(y);
		if (X < 0 || Y < 0 || X >= SCR_W || Y >= SCR_H) return;
		this.px[Y * SCR_W + X] = c;
		this.dirty = true;
	}

	/** 線（ブレゼンハム）。 */
	line(x1: number, y1: number, x2: number, y2: number, c: number): void {
		let x = Math.floor(x1);
		let y = Math.floor(y1);
		const X = Math.floor(x2);
		const Y = Math.floor(y2);
		const dx = Math.abs(X - x);
		const dy = -Math.abs(Y - y);
		const sx = x < X ? 1 : -1;
		const sy = y < Y ? 1 : -1;
		let err = dx + dy;
		// 画面の 外まで 長い 線は 打ち切る（点の 数で 止める）
		for (let n = 0; n < 2000; n++) {
			this.pset(x, y, c);
			if (x === X && y === Y) return;
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
	}

	box(
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		c: number,
		fill: boolean,
	): void {
		const l = Math.max(0, Math.floor(Math.min(x1, x2)));
		const r = Math.min(SCR_W - 1, Math.floor(Math.max(x1, x2)));
		const t = Math.max(0, Math.floor(Math.min(y1, y2)));
		const b = Math.min(SCR_H - 1, Math.floor(Math.max(y1, y2)));
		if (l > r || t > b) return;
		if (fill) {
			for (let y = t; y <= b; y++)
				this.px.fill(c, y * SCR_W + l, y * SCR_W + r + 1);
			this.dirty = true;
			return;
		}
		const L = Math.floor(Math.min(x1, x2));
		const R = Math.floor(Math.max(x1, x2));
		const T = Math.floor(Math.min(y1, y2));
		const B = Math.floor(Math.max(y1, y2));
		this.line(L, T, R, T, c);
		this.line(L, B, R, B, c);
		this.line(L, T, L, B, c);
		this.line(R, T, R, B, c);
	}

	circle(cx: number, cy: number, r: number, c: number, fill: boolean): void {
		const R = Math.min(400, Math.abs(Math.floor(r)));
		const X = Math.floor(cx);
		const Y = Math.floor(cy);
		if (fill) {
			for (let dy = -R; dy <= R; dy++) {
				const w = Math.floor(Math.sqrt(R * R - dy * dy));
				const y = Y + dy;
				if (y < 0 || y >= SCR_H) continue;
				const l = Math.max(0, X - w);
				const rr = Math.min(SCR_W - 1, X + w);
				if (l <= rr) this.px.fill(c, y * SCR_W + l, y * SCR_W + rr + 1);
			}
			this.dirty = true;
			return;
		}
		// 中点の 円
		let x = R;
		let y = 0;
		let err = 1 - R;
		while (x >= y) {
			for (const [a, b] of [
				[x, y],
				[y, x],
				[-y, x],
				[-x, y],
				[-x, -y],
				[-y, -x],
				[y, -x],
				[x, -y],
			])
				this.pset(X + a, Y + b, c);
			y++;
			if (err < 0) err += 2 * y + 1;
			else {
				x--;
				err += 2 * (y - x) + 1;
			}
		}
	}

	/** ぷゆゆ（10x10。x, y が まんなか。ui/arcade/arcadeHome.ts の puyu と 同じ 形）。 */
	puyu(x: number, y: number): void {
		const X = Math.floor(x) - 5;
		const Y = Math.floor(y) - 5;
		const rect = (l: number, t: number, w: number, h: number, c: number) => {
			for (let j = 0; j < h; j++)
				for (let i = 0; i < w; i++) this.pset(X + l + i, Y + t + j, c);
		};
		rect(1, 0, 8, 1, 16);
		rect(0, 1, 10, 9, 16);
		rect(2, 3, 2, 2, 17);
		rect(6, 3, 2, 2, 17);
		rect(2, 3, 1, 1, 15);
		rect(6, 3, 1, 1, 15);
	}
}
