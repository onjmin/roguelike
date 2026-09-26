// コピペの歩行グラ（32x64・16x16 が 2コマ×4方向。行は 上・右・下・左）を書き出す（node scripts/make-copipe.mjs）。
//
// 元絵は なく、ここで 描く。「コピー」の アイコン（2枚 かさなった 紙）に 顔を つけた もの：
//   - うしろの 紙は 青みの 灰色（写し）。まえの 紙は 白く、右上の 角が 折れていて、本文の 線が 2本
//   - 2コマ目は うしろの 紙が 1ドット ずれ、まえの 紙が 1ドット はねる（写している ところ）
//   - 右・左は 目を その向きへ 寄せる。上（背中）は 顔なし・本文なしの 紙の 裏
//
//   node scripts/make-copipe.mjs                          … public/sprites/copipe.png
//   node scripts/make-copipe.mjs --out a.png --preview b.png
//
// 依存なし（zlib だけ）。

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
const HERE = dirname(fileURLToPath(import.meta.url));

// ───────────────── 最小 PNG（書き: RGBA 8bit） ─────────────────

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
const crc32 = (buf) => {
	let c = 0xffffffff;
	for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(td));
	return Buffer.concat([len, td, crc]);
};
const encodePng = (w, h, rgba) => {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0);
	ihdr.writeUInt32BE(h, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	const raw = Buffer.alloc((w * 4 + 1) * h);
	for (let y = 0; y < h; y++) {
		raw[y * (w * 4 + 1)] = 0;
		rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
};

// ───────────────── 絵 ─────────────────

const hex = (s) => [1, 3, 5].map((i) => Number.parseInt(s.slice(i, i + 2), 16));
const INK = hex("#2b2f48"); // ふち
const BACK = hex("#a9b7dc"); // うしろの 紙（写し）
const BACK_DARK = hex("#8c9bc4"); // うしろの 紙の 下の 影
const PAPER = hex("#f7f6ef"); // まえの 紙
const PAPER_DARK = hex("#d9dbe3"); // まえの 紙の 下の 影・折れた 角
const LINE = hex("#9aa0b8"); // 本文の 線
const EYE = hex("#1c1d2b");
const CHEEK = hex("#f2a7b4");

const W = 32;
const H = 64;
const rgba = Buffer.alloc(W * H * 4);

/** コマ（col, row）の 中の 1ドットを 塗る。 */
const put = (col, row, x, y, c) => {
	if (x < 0 || x > 15 || y < 0 || y > 15) return;
	const o = ((row * 16 + y) * W + col * 16 + x) * 4;
	rgba[o] = c[0];
	rgba[o + 1] = c[1];
	rgba[o + 2] = c[2];
	rgba[o + 3] = 255;
};

/** ふちつきの 紙（x0..x1, y0..y1）。fold が あれば 右上の 角を 3ドット 折る。 */
const page = (col, row, x0, y0, x1, y1, fill, shade, fold) => {
	for (let y = y0; y <= y1; y++)
		for (let x = x0; x <= x1; x++) {
			// 折れた 角の 外は 塗らない
			const dx = x - (x1 - 3);
			const dy = y - y0;
			if (fold && dx > dy) continue;
			const edge = x === x0 || x === x1 || y === y0 || y === y1 || (fold && dx === dy && dx > 0);
			put(col, row, x, y, edge ? INK : y >= y1 - 1 ? shade : fill);
		}
	// 折り返し（三角）
	if (fold)
		for (let dy = 1; dy <= 3; dy++)
			for (let dx = 1; dx < dy; dx++) put(col, row, x1 - 3 + dx, y0 + dy, shade);
	if (fold) for (let k = 1; k <= 3; k++) put(col, row, x1 - 3, y0 + k, INK);
	if (fold) for (let k = 0; k <= 3; k++) put(col, row, x1 - 3 + k, y0 + 3, INK);
};

/** dir: "up" | "right" | "down" | "left"。frame: 0 | 1 */
const draw = (col, row, dir, frame) => {
	const bx = frame ? -1 : 0; // うしろの 紙の ずれ
	const by = frame ? -1 : 0; // まえの 紙の はね
	page(col, row, 1 + bx, 1, 9 + bx, 11, BACK, BACK_DARK, false);
	const fx0 = 5;
	const fy0 = 4 + by;
	const fx1 = 14;
	const fy1 = 15 + by;
	page(col, row, fx0, fy0, fx1, fy1, PAPER, PAPER_DARK, dir !== "up");
	if (dir === "up") return; // 背中：紙の 裏
	// 本文の 線（顔の 上と 下に 1本ずつ。下の 影と くっつかない ように あける）
	for (let x = fx0 + 2; x <= fx1 - 5; x++) put(col, row, x, fy0 + 2, LINE);
	for (let x = fx0 + 2; x <= fx1 - 3; x++) put(col, row, x, fy0 + 8, LINE);
	// 顔（目・ほほ・口）。右・左は 向いた ほうへ 寄せる
	const shift = dir === "right" ? 1 : dir === "left" ? -1 : 0;
	const ex = fx0 + 3 + shift;
	const ey = fy0 + 4;
	for (const x of [ex, ex + 4]) {
		put(col, row, x, ey, EYE);
		put(col, row, x, ey + 1, EYE);
	}
	if (dir !== "right") put(col, row, ex - 1, ey + 2, CHEEK);
	if (dir !== "left") put(col, row, ex + 5, ey + 2, CHEEK);
	put(col, row, ex + 2, ey + 2, EYE);
};

const DIRS = ["up", "right", "down", "left"];
DIRS.forEach((d, row) => {
	draw(0, row, d, 0);
	draw(1, row, d, 1);
});

// ───────────────── 実行 ─────────────────

const scaleOn = (z, bg) => {
	const out = Buffer.alloc(W * z * H * z * 4);
	for (let y = 0; y < H * z; y++)
		for (let x = 0; x < W * z; x++) {
			const s = (Math.floor(y / z) * W + Math.floor(x / z)) * 4;
			const a = rgba[s + 3] / 255;
			const o = (y * W * z + x) * 4;
			for (let k = 0; k < 3; k++) out[o + k] = Math.round(rgba[s + k] * a + bg[k] * (1 - a));
			out[o + 3] = 255;
		}
	return { w: W * z, h: H * z, rgba: out };
};
const save = (path, img) => {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, encodePng(img.w, img.h, img.rgba));
	console.log(path);
};

const args = process.argv.slice(2);
const opt = (name) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : null;
};
save(resolve(opt("--out") ?? join(HERE, "..", "public/sprites/copipe.png")), { w: W, h: H, rgba });
const preview = opt("--preview");
if (preview) save(resolve(preview), scaleOn(8, [88, 120, 72]));
