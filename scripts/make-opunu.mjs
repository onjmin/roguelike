// 裏ルート「おーぷぬの 諸島」の 2体の 歩行グラ（32x64・16x16 が 2コマ×4方向。行は 上・右・下・左）を書き出す
// （node scripts/make-opunu.mjs）。どれも 仮の 絵（ART_TODO.md。作者が 描きなおす）。
//
//   原住民（shobon.png）     … 村の 住人。(´・ω・｀) の まるい 顔（ショボン）に 灰色の 上着。2コマ目は 1ドット 沈む
//   乗っ取り屋（hijacker.png）… 板だけの 敵。黒ずきんの 名無し（板を 乗っ取って「〇〇諸島」に したので 海賊の バンダナ）。
//                              手に 鍵。2コマ目は 鍵が ゆれる
//
// 右・左は 顔を その向きへ 1ドット 寄せる。上（背中）は 顔なし。乱数は 使わない（毎回 同じ 絵）。
//
//   node scripts/make-opunu.mjs                          … public/sprites/ に 2枚
//   node scripts/make-opunu.mjs --out dir --preview dir2 … 別の 場所へ（プレビューは 8倍）
//
// 依存なし（zlib だけ。描く 道具は make-colony-enemies.mjs と 同じ）。

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

// ───────────────── 描く 道具 ─────────────────

const hex = (s, a = 255) => [...[1, 3, 5].map((i) => Number.parseInt(s.slice(i, i + 2), 16)), a];
const INK = hex("#2b2f48");
const EYE = hex("#1c1d2b");
const DIRS = ["up", "right", "down", "left"];
const shiftOf = (dir) => (dir === "right" ? 1 : dir === "left" ? -1 : 0);

const sheet = () => {
	const w = 32;
	const h = 64;
	const rgba = Buffer.alloc(w * h * 4);
	const put = (col, row, x, y, c) => {
		if (!c || x < 0 || x > 15 || y < 0 || y > 15) return;
		const o = ((row * 16 + y) * w + col * 16 + x) * 4;
		const a = c[3] / 255;
		const b = rgba[o + 3] / 255;
		const out = a + b * (1 - a);
		for (let k = 0; k < 3; k++)
			rgba[o + k] = out ? Math.round((c[k] * a + rgba[o + k] * b * (1 - a)) / out) : 0;
		rgba[o + 3] = Math.round(out * 255);
	};
	return { w, h, rgba, put };
};
const shape = (put, col, row, inside, fill, edge = INK) => {
	for (let y = 0; y < 16; y++)
		for (let x = 0; x < 16; x++) {
			if (!inside(x, y)) continue;
			const rim = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
			put(col, row, x, y, rim ? edge : fill(x, y));
		}
};
const ellipse = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const dots = (put, col, row, list, c) => {
	for (const [x, y] of list) put(col, row, x, y, c);
};
const make = (each) => {
	const img = sheet();
	DIRS.forEach((dir, row) => {
		for (const col of [0, 1]) each(img.put, col, row, dir);
	});
	return img;
};

// ───────────────── 原住民：(´・ω・｀) の まるい 顔 ─────────────────

const SHOBON = hex("#f4f0e4");
const SHOBON_SHADE = hex("#dcd6c6");
const COAT = hex("#8a94a4");
const COAT_DARK = hex("#687080");
const BROW = hex("#5a5e70");

const shobon = () =>
	make((put, col, row, dir) => {
		const dy = col; // 2コマ目は 1ドット 沈む（のんびり 歩く）
		// 上着（下半分）と 足
		shape(put, col, row, rect(4, 10 + dy, 11, 14), (x) => (x <= 5 || x >= 10 ? COAT_DARK : COAT));
		dots(put, col, row, [[6, 15], [9, 15]], INK);
		// 大きな まるい 顔（上着に すこし かぶる）
		shape(put, col, row, ellipse(7.5, 6.5 + dy, 6.5, 5.5), (x, y) => (y >= 10 + dy ? SHOBON_SHADE : SHOBON));
		if (dir === "up") return;
		const s = shiftOf(dir);
		// ´ ｀ … さがった 眉。・ ・ … 点の 目。ω … 口
		dots(put, col, row, [[4 + s, 4 + dy], [5 + s, 5 + dy], [11 + s, 4 + dy], [10 + s, 5 + dy]], BROW);
		dots(put, col, row, [[5 + s, 7 + dy], [10 + s, 7 + dy]], EYE);
		dots(put, col, row, [[6 + s, 9 + dy], [7 + s, 10 + dy], [8 + s, 9 + dy], [9 + s, 10 + dy], [10 + s, 9 + dy]], EYE);
	});

// ───────────────── 乗っ取り屋：黒ずきんの 名無し（海賊の バンダナ）と 鍵 ─────────────────

const HOOD = hex("#2a2a36");
const HOOD_LIGHT = hex("#444456");
const BANDANA = hex("#c83a3a");
const FACE_DARK = hex("#5a4a44");
const KEY = hex("#f0c040");
const KEY_DARK = hex("#a88020");
const GLINT = hex("#ffffff", 200);

const hijacker = () =>
	make((put, col, row, dir) => {
		const sway = col; // 2コマ目は 鍵が ゆれる
		// ずきんの 体（上が とがる）
		const body = (x, y) => (y >= 4 && y <= 14 && Math.abs(x - 8) <= Math.min(6, 1 + (y - 4) * 0.8)) || rect(5, 13, 11, 15)(x, y);
		shape(put, col, row, body, (x, y) => (y <= 6 || x === 8 ? HOOD_LIGHT : HOOD));
		// 赤い バンダナ（ずきんの 帯）
		for (let x = 4; x <= 12; x++) put(col, row, x, 7, BANDANA);
		dots(put, col, row, [[13, 8], [14, 9]], BANDANA);
		if (dir === "up") return;
		const s = shiftOf(dir);
		// ずきんの 中の 暗い 顔と 光る 目
		shape(put, col, row, rect(6 + s, 8, 10 + s, 11), () => FACE_DARK, FACE_DARK);
		dots(put, col, row, [[7 + s, 9], [9 + s, 9]], KEY);
		// 手に 鍵（右手。2コマ目は ゆれる）
		const kx = dir === "left" ? 2 : 13;
		const ky = 10 + sway;
		dots(put, col, row, [[kx, ky], [kx, ky + 1], [kx, ky + 2], [kx + (dir === "left" ? -1 : 1), ky + 2]], KEY);
		dots(put, col, row, [[kx, ky + 3]], KEY_DARK);
		if (col === 1) put(col, row, kx, ky - 1, GLINT);
	});

// ───────────────── 書き出し ─────────────────

const scaleOn = (img, n, bg) => {
	const W = img.w * n;
	const H = img.h * n;
	const out = Buffer.alloc(W * H * 4);
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) {
			const s = (Math.floor(y / n) * img.w + Math.floor(x / n)) * 4;
			const a = img.rgba[s + 3] / 255;
			const o = (y * W + x) * 4;
			for (let k = 0; k < 3; k++) out[o + k] = Math.round(img.rgba[s + k] * a + bg[k] * (1 - a));
			out[o + 3] = 255;
		}
	return { w: W, h: H, rgba: out };
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
const outDir = resolve(opt("--out") ?? join(HERE, "..", "public/sprites"));
const previewDir = opt("--preview");
for (const [name, img] of [
	["shobon", shobon()],
	["hijacker", hijacker()],
]) {
	save(join(outDir, `${name}.png`), img);
	if (previewDir) save(join(resolve(previewDir), `${name}.png`), scaleOn(img, 8, [88, 120, 72]));
}
