// DOOM の 板（決まりは data/arcade/home/doom.ts）。
// - 上の 240x118 が 一人称の 景色、下の 32px が 体力・弾・キリコの 顔・スコアの 帯。
// - 景色は 小さな キャンバス（240x118）の ImageData に 1画素 ずつ 描いて、2倍の 板へ drawImage で 写す
//   （crisp の 2倍の 変換と にじまない 設定が そのまま 効く）。壁・敵の 絵は はじめに 小さな キャンバスへ 描いて 画素に する。
// - 壁は 列ごとに 光線を 飛ばし、遠いほど 暗く（霧）。敵・拾いもの・弾は 立て札（列ごとの 奥行きで 隠す）。
// - 十字キーは 押しっぱなしの 向き（heldDir）と くり返しで 届く キーの 両方で 動く。
//   タップ：左 3分の1＝左を 向く・右 3分の1＝右を 向く・まんなかの 上＝少し 進む・まんなかの 下＝撃つ。

import { DX, DY } from "../../../core/geom";
import {
	DOOM,
	DOOM_LEVELS,
	DOOM_TEXT,
	type DoomHit,
	type DoomState,
	doomCast,
	doomLocked,
	doomScore,
	doomStart,
	doomStep,
	EXIT,
} from "../../../data/arcade/home/doom";
import { AH, AW } from "../../../data/arcade/logic";
import { ARCADE } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import type { G } from "../../neta/netaBoard";
import { txt } from "../../neta/netaBoard";
import { type ArcadeResult, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

/** 景色の 大きさ・目の 高さの 線・投影の 距離（1マス 先の 壁の 高さ）。 */
const VW = AW;
const VH = 118;
const HOR = VH / 2;
const PROJ = VW / 2 / Math.tan(DOOM.fov / 2);
/** 霧の 段（0〜15）。 */
const SHADES = 16;

const rgb = (hex: string): [number, number, number] => {
	const n = Number.parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** ImageData の 1画素（ABGR）。 */
const pack = (r: number, g: number, b: number, a = 255): number =>
	((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
const mix = (a: string, b: string, k: number): number => {
	const A = rgb(a);
	const B = rgb(b);
	return pack(
		Math.round(A[0] + (B[0] - A[0]) * k),
		Math.round(A[1] + (B[1] - A[1]) * k),
		Math.round(A[2] + (B[2] - A[2]) * k),
	);
};
const dim = (c: number, k: number): number =>
	pack(
		((c & 255) * k) | 0,
		(((c >> 8) & 255) * k) | 0,
		(((c >> 16) & 255) * k) | 0,
		(c >>> 24) & 255,
	);

/** 決まった ゆらぎ（0〜1）。 */
const hash = (x: number, y: number, k = 0): number => {
	let h = Math.imul(x * 374761393 + y * 668265263 + k * 2246822519, 1274126177);
	h = Math.imul(h ^ (h >>> 13), 1103515245);
	return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
};

type Img = { w: number; h: number; px: Uint32Array };

/** 小さな キャンバスに 描いて 画素に する。 */
const paint = (w: number, h: number, fn: (g: G) => void): Img => {
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	const g = c.getContext("2d") as G;
	fn(g);
	const d = g.getImageData(0, 0, w, h);
	return { w, h, px: new Uint32Array(d.data.buffer.slice(0)) };
};
const R = (g: G, c: string, x: number, y: number, w: number, h: number) => {
	g.fillStyle = c;
	g.fillRect(x, y, w, h);
};
const disc = (g: G, c: string, cx: number, cy: number, rx: number, ry = rx) => {
	g.fillStyle = c;
	g.beginPath();
	g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
	g.fill();
};

// ---- 壁の 絵（32x32） ----

const T = 32;
const brick = (): Img =>
	paint(T, T, (g) => {
		R(g, "#3a2a24", 0, 0, T, T);
		for (let row = 0; row < 4; row++) {
			const off = (row % 2) * 8;
			for (let i = -1; i < 3; i++) {
				const x0 = i * 16 + off;
				const k = hash(i + 7, row, 1);
				const base = k < 0.33 ? "#8a3a2a" : k < 0.66 ? "#7a3224" : "#944434";
				R(g, base, x0, row * 8, 15, 7);
				R(g, "#a8584a", x0, row * 8, 15, 1);
			}
		}
		for (let i = 0; i < 90; i++) {
			const x = Math.floor(hash(i, 3, 2) * T);
			const y = Math.floor(hash(i, 5, 2) * T);
			R(g, "rgba(0,0,0,0.25)", x, y, 1, 1);
		}
	});
const post = (): Img =>
	paint(T, T, (g) => {
		R(g, "#4a3020", 0, 0, T, T);
		R(g, "#e8e4d8", 2, 2, T - 4, T - 4);
		// レスが 2つ（名前の 緑・本文の 行・安価の 青）
		for (let p = 0; p < 2; p++) {
			const y0 = 3 + p * 14;
			R(g, "#228822", 4, y0, 8, 2);
			R(g, "#9a9a90", 14, y0, 12, 1);
			for (let l = 0; l < 3; l++) {
				const y = y0 + 4 + l * 3;
				let x = 5;
				for (let w = 0; x < T - 5; w++) {
					const n = 1 + Math.floor(hash(w, l + p * 3, 3) * 4);
					const blue = l === 0 && w === 0 && p === 1;
					R(g, blue ? "#2040c0" : "#3a3a40", x, y, Math.min(n, T - 5 - x), 1);
					x += n + 1;
					if (hash(w, l, 4 + p) < 0.12) break;
				}
			}
			if (p === 0) R(g, "#c8c4b8", 3, y0 + 13, T - 6, 1);
		}
	});
const stone = (): Img =>
	paint(T, T, (g) => {
		R(g, "#2c2c32", 0, 0, T, T);
		const rows = [0, 11, 21, 32];
		for (let r = 0; r < 3; r++) {
			const h = rows[r + 1] - rows[r] - 1;
			let x = -Math.floor(hash(r, 0, 5) * 10);
			for (let i = 0; x < T; i++) {
				const w = 9 + Math.floor(hash(i, r, 6) * 9);
				const k = hash(i, r, 7);
				R(g, k < 0.5 ? "#6a6a70" : "#5e5e66", x, rows[r], w - 1, h);
				R(g, "#808088", x, rows[r], w - 1, 1);
				x += w;
			}
		}
		for (let i = 0; i < 120; i++) {
			const x = Math.floor(hash(i, 1, 8) * T);
			const y = Math.floor(hash(i, 2, 8) * T);
			R(g, hash(i, 9) < 0.15 ? "#3e5a34" : "rgba(0,0,0,0.22)", x, y, 1, 1);
		}
		// 刻んだ 字の あと
		R(g, "#4a4a52", 6, 14, 12, 1);
		R(g, "#4a4a52", 6, 17, 8, 1);
	});
const door = (locked: boolean): Img =>
	paint(T, T, (g) => {
		R(g, "#2a2a2a", 0, 0, T, T);
		R(g, locked ? "#4a2a2a" : "#1c5a2c", 3, 3, T - 6, T - 3);
		R(g, locked ? "#5a3434" : "#247034", 4, 4, 11, T - 4);
		R(g, locked ? "#5a3434" : "#247034", 17, 4, 11, T - 4);
		R(g, "#101010", 15, 3, 2, T - 3);
		// 札
		R(g, locked ? "#606060" : "#c02020", 6, 6, 20, 11);
		g.font = "10px 'DotGothic16', monospace";
		g.textAlign = "center";
		g.textBaseline = "top";
		g.fillStyle = "#ffffff";
		g.fillText(locked ? "×" : "次", 16, 7);
		R(g, "#d0b040", 12, 21, 2, 3);
		R(g, "#d0b040", 18, 21, 2, 3);
	});

// ---- 立て札の 絵 ----

/** 荒らし（赤い 頭巾・つり目・こぶし）。atk は 撃つ ときの 絵。 */
const arashi = (atk: boolean): Img =>
	paint(24, 28, (g) => {
		// 体
		g.fillStyle = "#a02020";
		g.beginPath();
		g.moveTo(5, 27);
		g.lineTo(8, 11);
		g.lineTo(16, 11);
		g.lineTo(19, 27);
		g.fill();
		R(g, "#701818", 11, 12, 2, 15);
		// 頭巾
		disc(g, "#c02828", 12, 7, 6, 6);
		disc(g, "#300808", 12, 8, 4, 3.5);
		// つり目
		R(g, atk ? "#ffffff" : "#ff8080", 9, 7, 2, 1);
		R(g, atk ? "#ffffff" : "#ff8080", 13, 7, 2, 1);
		R(g, "#ff8080", 10, 8, 1, 1);
		R(g, "#ff8080", 13, 8, 1, 1);
		if (atk) R(g, "#ff4020", 11, 10, 2, 1);
		// 腕
		if (atk) {
			R(g, "#a02020", 17, 8, 3, 6);
			disc(g, "#ff6040", 19, 6, 3, 3);
		} else {
			R(g, "#a02020", 3, 13, 3, 8);
			R(g, "#a02020", 18, 13, 3, 8);
			R(g, "#f0c8a8", 3, 20, 3, 2);
			R(g, "#f0c8a8", 18, 20, 3, 2);
		}
	});
/** 名無し（顔の ない 灰色の フード。走る 足 2こま）。 */
const nanashi = (step: number, atk: boolean): Img =>
	paint(20, 28, (g) => {
		R(g, "#5a6870", 6, 11, 8, 10);
		disc(g, "#88a0a8", 10, 6, 5, 5.5);
		disc(g, "#1a2024", 10, 7, 3.5, 3.5);
		// 口だけ
		R(g, atk ? "#c03030" : "#606870", 9, 8, 2, atk ? 2 : 1);
		// 腕
		if (atk) {
			R(g, "#88a0a8", 1, 9, 5, 3);
			R(g, "#88a0a8", 14, 9, 5, 3);
		} else {
			R(g, "#788c94", 4, 12, 2, 7);
			R(g, "#788c94", 14, 12, 2, 7);
		}
		// 足
		const a = step === 0 ? 0 : 2;
		R(g, "#3a4448", 6 + a, 21, 3, 7);
		R(g, "#3a4448", 11 - a, 21, 3, 7);
	});
/** スレ主（紫の 大きな 体・金の 目・胸に「>>1」の 札）。 */
const nushi = (atk: boolean): Img =>
	paint(36, 40, (g) => {
		g.fillStyle = "#40205a";
		g.beginPath();
		g.moveTo(2, 40);
		g.lineTo(8, 14);
		g.lineTo(28, 14);
		g.lineTo(34, 40);
		g.fill();
		disc(g, "#5a2c7a", 18, 10, 9, 9);
		// 冠
		g.fillStyle = "#d0a030";
		g.beginPath();
		g.moveTo(10, 4);
		g.lineTo(13, 0);
		g.lineTo(16, 3);
		g.lineTo(18, -1);
		g.lineTo(20, 3);
		g.lineTo(23, 0);
		g.lineTo(26, 4);
		g.fill();
		R(g, atk ? "#ffffff" : "#ffd040", 12, 9, 4, 2);
		R(g, atk ? "#ffffff" : "#ffd040", 20, 9, 4, 2);
		R(g, "#200a30", 14, 14, 8, atk ? 3 : 1);
		// 札
		R(g, "#e8e4d8", 11, 21, 14, 9);
		g.font = "8px 'DotGothic16', monospace";
		g.textAlign = "center";
		g.textBaseline = "top";
		g.fillStyle = "#2040c0";
		g.fillText(">>1", 18, 21);
		// 腕
		R(g, "#40205a", atk ? 0 : 3, atk ? 12 : 18, 5, 14);
		R(g, "#40205a", atk ? 31 : 28, atk ? 12 : 18, 5, 14);
	});
const onigiri = (): Img =>
	paint(16, 14, (g) => {
		g.fillStyle = "#f4f4f0";
		g.beginPath();
		g.moveTo(8, 0);
		g.lineTo(16, 13);
		g.lineTo(0, 13);
		g.fill();
		R(g, "#102018", 5, 8, 6, 6);
	});
const ammoBox = (): Img =>
	paint(16, 12, (g) => {
		R(g, "#5a4020", 0, 4, 16, 8);
		R(g, "#7a5a30", 0, 4, 16, 1);
		for (let i = 0; i < 4; i++) {
			R(g, "#d0a040", 2 + i * 3, 0, 2, 5);
			R(g, "#f0d080", 2 + i * 3, 0, 2, 1);
		}
	});
const orb = (boss: boolean): Img =>
	paint(8, 8, (g) => {
		disc(g, boss ? "#c060ff" : "#ff3020", 4, 4, 4, 4);
		disc(g, boss ? "#f0d0ff" : "#ffc080", 4, 4, 2, 2);
	});

type Art = {
	walls: Uint32Array[][];
	lockedDoor: Uint32Array[];
	are: [Img, Img];
	nana: [Img, Img, Img];
	boss: [Img, Img];
	heal: Img;
	ammo: Img;
	orb: [Img, Img];
	bg: Uint32Array;
};

/** 霧の 段ごとに 暗く した 絵。 */
const shaded = (img: Img): Uint32Array[] =>
	Array.from({ length: SHADES }, (_, i) => {
		const k = i / (SHADES - 1);
		return img.px.map((c) => dim(c, k));
	});

const makeArt = (): Art => {
	const bg = new Uint32Array(VW * VH);
	for (let y = 0; y < VH; y++) {
		const c =
			y < HOR
				? mix("#2a2030", "#06050a", y / HOR)
				: mix("#06050a", "#4a3828", (y - HOR) / (VH - HOR));
		bg.fill(c, y * VW, (y + 1) * VW);
	}
	return {
		walls: [brick(), brick(), post(), stone(), door(false)].map(shaded),
		lockedDoor: shaded(door(true)),
		are: [arashi(false), arashi(true)],
		nana: [nanashi(0, false), nanashi(1, false), nanashi(0, true)],
		boss: [nushi(false), nushi(true)],
		heal: onigiri(),
		ammo: ammoBox(),
		orb: [orb(false), orb(true)],
		bg,
	};
};

/** 霧（遠いほど 暗い。0〜1）。 */
const fog = (d: number): number => Math.max(0.1, Math.min(1, 1.2 - d / 9));

type Spr = {
	x: number;
	y: number;
	img: Img;
	/** 世界での 高さ・床からの 浮き。 */
	h: number;
	lift: number;
	white: boolean;
	/** たおれた 敵（下の 方だけ・暗く）。 */
	down: number;
};

/** 景色を 描く（列の 奥行きを z に）。 */
const render = (
	buf: Uint32Array,
	z: Float32Array,
	art: Art,
	s: DoomState,
	offs: Float32Array,
	cosO: Float32Array,
	hit: DoomHit,
): void => {
	buf.set(art.bg);
	const locked = doomLocked(s);
	for (let c = 0; c < VW; c++) {
		doomCast(s.map, s.x, s.y, s.a + offs[c], hit);
		const perp = Math.max(0.05, hit.dist * cosO[c]);
		z[c] = perp;
		const lineH = PROJ / perp;
		const top = HOR - lineH / 2;
		let k = fog(perp);
		if (hit.side === 1) k *= 0.75;
		const lvl = Math.round(k * (SHADES - 1));
		const tex =
			hit.cell === EXIT && locked
				? art.lockedDoor[lvl]
				: art.walls[hit.cell][lvl];
		const tx = Math.min(T - 1, Math.floor(hit.u * T));
		const y0 = Math.max(0, Math.ceil(top));
		const y1 = Math.min(VH, Math.floor(top + lineH));
		const stepT = T / lineH;
		let ty = (y0 - top) * stepT;
		for (let y = y0; y < y1; y++) {
			buf[y * VW + c] = tex[((ty | 0) & (T - 1)) * T + tx];
			ty += stepT;
		}
	}
	// 立て札
	const sprs: Spr[] = [];
	for (const f of s.foes) {
		if (f.dead && f.deadT > 8) continue;
		const atk = f.anim > 0;
		const img =
			f.kind === "are"
				? art.are[atk ? 1 : 0]
				: f.kind === "nana"
					? art.nana[atk ? 2 : Math.floor(f.walk * 3) % 2]
					: art.boss[atk ? 1 : 0];
		sprs.push({
			x: f.x,
			y: f.y,
			img,
			h: f.kind === "boss" ? 1.25 : 0.85,
			lift: 0,
			white: f.flash > 0,
			down: f.dead ? Math.min(1, f.deadT * 4) : 0,
		});
	}
	for (const it of s.items)
		sprs.push({
			x: it.x,
			y: it.y,
			img: it.kind === "heal" ? art.heal : art.ammo,
			h: 0.28,
			lift: 0,
			white: false,
			down: 0,
		});
	for (const b of s.shots)
		sprs.push({
			x: b.x,
			y: b.y,
			img: art.orb[b.boss ? 1 : 0],
			h: 0.16,
			lift: 0.42,
			white: false,
			down: 0,
		});
	const ca = Math.cos(s.a);
	const sa = Math.sin(s.a);
	const list: { p: Spr; perp: number; sx: number }[] = [];
	for (const p of sprs) {
		const dx = p.x - s.x;
		const dy = p.y - s.y;
		const perp = dx * ca + dy * sa;
		if (perp < 0.15) continue;
		const side = -dx * sa + dy * ca;
		list.push({ p, perp, sx: VW / 2 + (side / perp) * PROJ });
	}
	list.sort((a, b) => b.perp - a.perp);
	for (const { p, perp, sx } of list) {
		const img = p.img;
		const hp = (p.h * PROJ) / perp;
		const wp = (hp * img.w) / img.h;
		const bottom = HOR + ((0.5 - p.lift) * PROJ) / perp;
		// たおれた 敵は つぶれて 低く なる
		const drawH = hp * (1 - p.down * 0.7);
		const top = bottom - drawH;
		const left = sx - wp / 2;
		const x0 = Math.max(0, Math.ceil(left));
		const x1 = Math.min(VW, Math.floor(left + wp));
		const y0 = Math.max(0, Math.ceil(top));
		const y1 = Math.min(VH, Math.floor(bottom));
		if (x0 >= x1 || y0 >= y1) continue;
		const k = fog(perp) * (p.down > 0 ? 0.5 : 1);
		for (let x = x0; x < x1; x++) {
			if (perp >= z[x]) continue;
			const u = Math.min(img.w - 1, (((x - left) / wp) * img.w) | 0);
			for (let y = y0; y < y1; y++) {
				const v = Math.min(img.h - 1, (((y - top) / drawH) * img.h) | 0);
				const col = img.px[v * img.w + u];
				if (col >>> 24 < 128) continue;
				buf[y * VW + x] = p.white ? 0xffffffff : dim(col | 0xff000000, k);
			}
		}
	}
};

/** 楕円を 行で ぬる。 */
const oval = (
	g: G,
	c: string,
	cx: number,
	cy: number,
	rx: number,
	ry: number,
) => {
	g.fillStyle = c;
	for (let dy = -ry; dy <= ry; dy++) {
		const hw = Math.round(
			rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)),
		);
		g.fillRect(Math.round(cx - hw), Math.round(cy + dy), hw * 2, 1);
	}
};

/** キリコの 腕と 蓄音機の ラッパ（撃つと 跳ねて 音の 輪が 出る）。 */
const weapon = (g: G, s: DoomState, clock: number): void => {
	const walk = Math.sin(s.bob * 7);
	const sw = s.swing > 0 ? Math.sin((s.swing / 0.25) * Math.PI) : 0;
	const cx = Math.round(120 + walk * 3 - sw * 26);
	const cy = Math.round(Math.abs(walk) * 2 + (s.flash > 0 ? 4 : 0) - sw * 6);
	// 腕（緑の 袖・手）
	R(g, "#28a131", cx - 44, 106 + cy, 22, 14);
	R(g, "#1e7a26", cx - 44, 106 + cy, 22, 2);
	R(g, "#28a131", cx + 22, 106 + cy, 22, 14);
	R(g, "#1e7a26", cx + 22, 106 + cy, 22, 2);
	R(g, "#f0c8a8", cx - 22, 104 + cy, 10, 8);
	R(g, "#f0c8a8", cx + 12, 104 + cy, 10, 8);
	// 管（手前が 細く、先へ ひらく）
	for (let y = 0; y < 26; y++) {
		const hw = Math.round(3 + y * 0.45);
		const Y = 116 - y + cy;
		R(g, "#8a6420", cx - hw, Y, hw * 2, 1);
		R(g, "#d8b050", cx - hw, Y, Math.max(1, Math.round(hw * 0.7)), 1);
		R(g, "#f0d890", cx - hw + 1, Y, 1, 1);
	}
	// 朝顔（ふち と 奥）
	oval(g, "#c89838", cx, 86 + cy, 17, 6);
	oval(g, "#f0d080", cx - 1, 85 + cy, 15, 5);
	oval(g, "#2a1a08", cx, 86 + cy, 12, 4);
	oval(g, "#140c04", cx, 87 + cy, 7, 2);
	// 手で にぎる 帯
	R(g, "#f0c8a8", cx - 12, 108 + cy, 6, 6);
	R(g, "#f0c8a8", cx + 6, 108 + cy, 6, 6);
	// 音の 輪
	if (s.flash > 0) {
		const k = 1 - s.flash / 0.15;
		g.strokeStyle = `rgba(200,240,255,${(1 - k) * 0.9})`;
		g.lineWidth = 1;
		for (let i = 0; i < 3; i++) {
			const r = 8 + k * 18 + i * 7;
			g.beginPath();
			g.ellipse(cx, 80 + cy, r, r * 0.45, 0, Math.PI, Math.PI * 2);
			g.stroke();
		}
		g.fillStyle = "rgba(255,250,220,0.85)";
		oval(g, "rgba(255,250,220,0.85)", cx, 85 + cy, 10, 3);
	}
	// 音符の 粒（なぐる ときの ゆれ）
	if (s.swing > 0 && Math.floor(clock * 20) % 2 === 0)
		R(g, "#f0d890", cx - 22, 80 + cy, 2, 2);
};

/** キリコの 顔（痛い・弱い・たおれた・向く 方を 見る）。 */
const face = (g: G, s: DoomState, look: number, clock: number): void => {
	const x = 107;
	const y = 120;
	R(g, "#14100c", x, y, 26, 29);
	// 後ろ髪
	R(g, "#72241f", x + 3, y + 3, 20, 25);
	// 顔
	const skin = s.hp <= 0 ? "#b8a090" : s.hurt > 0 ? "#f0a090" : "#f0c8a8";
	R(g, skin, x + 6, y + 8, 14, 15);
	R(g, skin, x + 7, y + 23, 12, 2);
	// 前髪（分け目）
	R(g, "#72241f", x + 5, y + 4, 16, 5);
	R(g, "#72241f", x + 5, y + 9, 2, 3);
	R(g, "#72241f", x + 12, y + 9, 2, 2);
	R(g, "#72241f", x + 19, y + 9, 2, 3);
	R(g, "#8a3029", x + 7, y + 5, 6, 1);
	// 横の 髪
	R(g, "#72241f", x + 3, y + 9, 3, 18);
	R(g, "#72241f", x + 20, y + 9, 3, 18);
	// 緑の 髪かざり
	R(g, "#28a131", x + 17, y + 4, 4, 3);
	R(g, "#5ad060", x + 18, y + 4, 1, 1);
	const ex1 = x + 8 + look;
	const ex2 = x + 15 + look;
	const ey = y + 13;
	if (s.hp <= 0) {
		for (const ex of [ex1, ex2]) {
			R(g, "#031c3e", ex, ey, 1, 1);
			R(g, "#031c3e", ex + 2, ey, 1, 1);
			R(g, "#031c3e", ex + 1, ey + 1, 1, 1);
			R(g, "#031c3e", ex, ey + 2, 1, 1);
			R(g, "#031c3e", ex + 2, ey + 2, 1, 1);
		}
		R(g, "#7a3a3a", x + 11, y + 20, 4, 1);
		return;
	}
	if (s.hurt > 0) {
		// ＞＜
		R(g, "#031c3e", ex1, ey, 1, 1);
		R(g, "#031c3e", ex1 + 1, ey + 1, 2, 1);
		R(g, "#031c3e", ex1, ey + 2, 1, 1);
		R(g, "#031c3e", ex2 + 2, ey, 1, 1);
		R(g, "#031c3e", ex2, ey + 1, 2, 1);
		R(g, "#031c3e", ex2 + 2, ey + 2, 1, 1);
		R(g, "#8a2020", x + 11, y + 18, 4, 3);
		return;
	}
	const blink = Math.floor(clock * 10) % 40 === 0;
	if (blink) {
		R(g, "#031c3e", ex1, ey + 2, 3, 1);
		R(g, "#031c3e", ex2, ey + 2, 3, 1);
	} else {
		R(g, "#031c3e", ex1, ey, 3, 4);
		R(g, "#031c3e", ex2, ey, 3, 4);
		R(g, "#ffffff", ex1 + 1, ey, 1, 1);
		R(g, "#ffffff", ex2 + 1, ey, 1, 1);
	}
	if (s.hp < 35) {
		// こまり眉・汗・への字
		R(g, "#5a1a16", ex1 + 1, ey - 2, 2, 1);
		R(g, "#5a1a16", ex2, ey - 2, 2, 1);
		R(g, "#80c8f0", x + 20, y + 11, 1, 3);
		R(g, "#a05050", x + 11, y + 20, 4, 1);
		R(g, "#a05050", x + 10, y + 21, 1, 1);
		R(g, "#a05050", x + 15, y + 21, 1, 1);
	} else if (s.glow > 0) {
		R(g, "#a04040", x + 11, y + 19, 4, 2);
	} else {
		R(g, "#a05050", x + 12, y + 20, 2, 1);
	}
	// ほお
	R(g, "#f0a8a0", x + 7, y + 18, 2, 1);
	R(g, "#f0a8a0", x + 17, y + 18, 2, 1);
};

/** 下の 帯（体力・弾・顔・スレ・スコア）。 */
const statusBar = (g: G, s: DoomState, look: number, clock: number): void => {
	R(g, "#3a3430", 0, VH, AW, AH - VH);
	R(g, "#6a5e54", 0, VH, AW, 1);
	R(g, "#201c18", 0, AH - 1, AW, 1);
	for (const x of [50, 104, 136, 176]) {
		R(g, "#201c18", x, VH + 2, 1, AH - VH - 4);
		R(g, "#5a4e46", x + 1, VH + 2, 1, AH - VH - 4);
	}
	const lowHp = s.hp < 35 && Math.floor(clock * 4) % 2 === 0;
	txt(g, DOOM_TEXT.hp, 25, VH + 3, 7, "#c8c0b0", "center");
	txt(g, `${s.hp}%`, 25, VH + 13, 12, lowHp ? "#ffffff" : "#ff5040", "center");
	txt(g, DOOM_TEXT.ammo, 77, VH + 3, 7, "#c8c0b0", "center");
	txt(
		g,
		String(s.ammo),
		77,
		VH + 13,
		12,
		s.ammo > 0 ? "#ff5040" : "#806860",
		"center",
	);
	face(g, s, look, clock);
	txt(g, DOOM_TEXT.level, 156, VH + 3, 7, "#c8c0b0", "center");
	txt(
		g,
		`${s.lv + 1}/${DOOM_LEVELS.length}`,
		156,
		VH + 14,
		10,
		"#f0c040",
		"center",
	);
	txt(g, DOOM_TEXT.score, 208, VH + 3, 7, "#c8c0b0", "center");
	txt(g, String(doomScore(s)), 208, VH + 15, 9, "#e8e8f0", "center");
};

export const playDoom = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	const art = makeArt();
	const view = document.createElement("canvas");
	view.width = VW;
	view.height = VH;
	const vg = view.getContext("2d") as G;
	const img = vg.createImageData(VW, VH);
	const buf = new Uint32Array(img.data.buffer);
	const z = new Float32Array(VW);
	const offs = new Float32Array(VW);
	const cosO = new Float32Array(VW);
	for (let c = 0; c < VW; c++) {
		offs[c] = Math.atan((c + 0.5 - VW / 2) / PROJ);
		cosO[c] = Math.cos(offs[c]);
	}
	const hit: DoomHit = { dist: 0, cell: 1, u: 0, side: 0 };
	// 押して いる 向きの のこり（キーの くり返し・タップで のばす）
	let mv = 0;
	let mvT = 0;
	let tn = 0;
	let tnT = 0;
	let fireT = 0;
	let look = 0;
	let bossSeen = false;
	return playBoard(ctx, "doom", {
		note: DOOM_TEXT.note,
		start: () => {
			const s = doomStart();
			// 開発ビルドだけ 状態を のぞける（確かめ 用）
			if (import.meta.env.DEV)
				(window as unknown as { __doom: DoomState }).__doom = s;
			return s;
		},
		step: (s, f) => {
			for (const e of f.evs) {
				if ("k" in e) {
					const h = e.repeat ? 0.12 : 0.25;
					if (e.k === "up") [mv, mvT] = [1, h];
					else if (e.k === "down") [mv, mvT] = [-1, h];
					else if (e.k === "left") [tn, tnT] = [-1, h];
					else if (e.k === "right") [tn, tnT] = [1, h];
					else if (e.k === "a") fireT = 0.15;
				} else if (isTap(e)) {
					const [x, y] = e.tap;
					if (x < AW / 3) [tn, tnT] = [-1, 0.22];
					else if (x > (AW * 2) / 3) [tn, tnT] = [1, 0.22];
					else if (y < AH / 2) [mv, mvT] = [1, 0.35];
					else fireT = 0.15;
				}
			}
			const hd = ctx.input.heldDir();
			if (hd !== null) {
				if (DY[hd] !== 0) [mv, mvT] = [-DY[hd], Math.max(mvT, 0.05)];
				if (DX[hd] !== 0) [tn, tnT] = [DX[hd], Math.max(tnT, 0.05)];
			}
			mvT -= f.dt;
			tnT -= f.dt;
			fireT -= f.dt;
			const move = mvT > 0 ? mv : 0;
			const turn = tnT > 0 ? tn : 0;
			look = turn;
			const evs = doomStep(s, f.dt, { move, turn, fire: fireT > 0 }, rnd);
			for (const e of evs) {
				if (e === "shot") {
					f.se("arcShot");
					fireT = 0;
				} else if (e === "melee") {
					f.se("swing_fist");
					fireT = 0;
				} else if (e === "hit") f.se("hit_fist");
				else if (e === "kill") f.se("enemyDown");
				else if (e === "bossDown") f.se("explosion");
				else if (e === "hurt") f.se("damage");
				else if (e === "heal") f.se("heal");
				else if (e === "ammo") f.se("item");
				else if (e === "fire") f.se("enemyAttack");
				else if (e === "boss") {
					f.se("encounter");
					bossSeen = true;
				} else if (e === "next") {
					f.se("door");
					bossSeen = false;
				} else if (e === "locked") f.se("cancel");
			}
		},
		draw: (g, s, clock) => {
			render(buf, z, art, s, offs, cosO, hit);
			vg.putImageData(img, 0, 0);
			g.drawImage(view, 0, 0);
			// 照準
			g.fillStyle = "rgba(255,255,255,0.55)";
			g.fillRect(VW / 2 - 3, HOR, 2, 1);
			g.fillRect(VW / 2 + 2, HOR, 2, 1);
			g.fillRect(VW / 2, HOR - 3, 1, 2);
			g.fillRect(VW / 2, HOR + 2, 1, 2);
			weapon(g, s, clock);
			if (s.hurt > 0) {
				g.fillStyle = `rgba(255,0,0,${(s.hurt / DOOM.hurtT) * 0.35})`;
				g.fillRect(0, 0, VW, VH);
			} else if (s.glow > 0) {
				g.fillStyle = `rgba(120,255,140,${s.glow * 0.5})`;
				g.fillRect(0, 0, VW, VH);
			}
			if (s.msgT > 0)
				txt(
					g,
					s.lv === 0
						? DOOM_TEXT.first
						: DOOM_TEXT.next.replace("{n}", String(s.lv + 1)),
					VW / 2,
					22,
					12,
					"#f0c040",
					"center",
				);
			if (s.lockT > 0)
				txt(g, DOOM_TEXT.locked, VW / 2, 38, 8, "#ff8080", "center");
			const boss = bossSeen
				? s.foes.find((f) => f.kind === "boss" && !f.dead)
				: undefined;
			if (boss) {
				if (Math.floor(clock * 3) % 2 === 0)
					txt(g, DOOM_TEXT.boss, VW / 2, 3, 8, "#e0a0ff", "center");
				R(g, "#3a1a2a", 70, 13, 100, 2);
				R(
					g,
					"#c060ff",
					70,
					13,
					Math.round((100 * boss.hp) / DOOM.foe.boss.hp),
					2,
				);
			}
			statusBar(g, s, look, clock);
		},
		over: (s) => s.over,
		score: doomScore,
		end: (s) => (s.clear ? ARCADE.clear : ARCADE.over),
	});
};
