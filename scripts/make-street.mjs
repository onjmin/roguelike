// 街の 小物の 絵を 書き出す（node scripts/make-street.mjs → public/sprites/street.png）。
//
// 住宅街・都市（町の 段6〜7）の 道ばたと 線路（STORY.md §5.75）。112x32。上の 段は 16x16、縦長の 物は 16x32：
//   (0,0) 線路（横）   (16,0) 線路（縦）   (32,0) 踏切の 道（アスファルトに 縦の レール）   (48,0) 踏切の 道（横の レール）
//   (64,0) 電柱（16x32）   (80,0) 街灯（16x32）   (96,0) 踏切の 警報機（16x32）
// 線路は 砂利に 枕木と 2本の レール。電柱には 横木と 電線（左右の マスへ つながって 見える）。
//
// 依存なし（zlib だけ）。PNG の 書き方は make-statue.mjs と 同じ。

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../public/sprites/street.png");

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

const W = 112;
const H = 32;
const rgba = Buffer.alloc(W * H * 4);
let seed = 4242;
const rnd = () => {
	seed = (seed * 1103515245 + 12345) & 0x7fffffff;
	return seed / 0x7fffffff;
};
const set = (x, y, [r, g, b, a = 255]) => {
	if (x < 0 || y < 0 || x >= W || y >= H) return;
	const o = (y * W + x) * 4;
	rgba[o] = r;
	rgba[o + 1] = g;
	rgba[o + 2] = b;
	rgba[o + 3] = a;
};
const RAIL = [190, 190, 200];
const RAIL_D = [110, 110, 120];
const TIE = [110, 76, 48];
const gravel = () => {
	const n = Math.floor(rnd() * 30) - 15;
	return [128 + n, 122 + n, 112 + n];
};
const asphalt = () => {
	const n = Math.floor(rnd() * 14) - 7;
	return [74 + n, 74 + n, 80 + n];
};
// 線路（横）：枕木は 縦に 4px おき、レールは y=4・11
for (let y = 0; y < 16; y++)
	for (let x = 0; x < 16; x++) {
		let c = gravel();
		if (x % 4 === 1 && y >= 2 && y <= 13) c = TIE;
		if (y === 4 || y === 11) c = RAIL;
		if (y === 5 || y === 12) c = RAIL_D;
		set(x, y, c);
	}
// 線路（縦）
for (let y = 0; y < 16; y++)
	for (let x = 0; x < 16; x++) {
		let c = gravel();
		if (y % 4 === 1 && x >= 2 && x <= 13) c = TIE;
		if (x === 4 || x === 11) c = RAIL;
		if (x === 5 || x === 12) c = RAIL_D;
		set(16 + x, y, c);
	}
// 踏切の 道（アスファルトに レール）
for (let y = 0; y < 16; y++)
	for (let x = 0; x < 16; x++) {
		let c = asphalt();
		if (x === 4 || x === 11) c = RAIL;
		set(32 + x, y, c);
		let d = asphalt();
		if (y === 4 || y === 11) d = RAIL;
		set(48 + x, y, d);
	}
// 電柱（16x32。足もとは マスの 下）
const POLE = [150, 140, 128];
const POLE_D = [110, 102, 92];
for (let y = 2; y < 31; y++) {
	set(64 + 7, y, POLE);
	set(64 + 8, y, POLE_D);
}
for (let x = 2; x < 14; x++) set(64 + x, 5, [90, 80, 70]);
for (const x of [3, 12]) {
	set(64 + x, 4, [230, 230, 220]);
	set(64 + x, 3, [230, 230, 220]);
}
for (let x = 0; x < 16; x++) set(64 + x, 3, [40, 40, 44]);
for (let x = 0; x < 16; x++) set(64 + x, 8, [40, 40, 44]);
set(64 + 6, 30, [60, 56, 50]);
set(64 + 9, 30, [60, 56, 50]);
// 街灯（16x32）
const LAMP = [70, 74, 84];
for (let y = 6; y < 31; y++) {
	set(80 + 7, y, LAMP);
	set(80 + 8, y, [50, 54, 62]);
}
for (let x = 5; x < 11; x++) {
	set(80 + x, 3, LAMP);
	set(80 + x, 4, [250, 236, 160]);
	set(80 + x, 5, [250, 236, 160]);
}
for (let x = 4; x < 12; x++) set(80 + x, 2, [50, 54, 62]);
for (let x = 6; x < 10; x++) set(80 + x, 30, [50, 54, 62]);
// 踏切の 警報機（16x32）：黄と 黒の 柱、×の 札、赤い 灯り 2つ
for (let y = 10; y < 31; y++) {
	const c = Math.floor(y / 3) % 2 ? [240, 200, 40] : [30, 30, 30];
	set(96 + 7, y, c);
	set(96 + 8, y, c);
}
for (let i = 0; i < 9; i++) {
	set(96 + 3 + i, 2 + i, [240, 200, 40]);
	set(96 + 3 + i, 3 + i, [30, 30, 30]);
	set(96 + 12 - i, 2 + i, [240, 200, 40]);
	set(96 + 12 - i, 3 + i, [30, 30, 30]);
}
for (const cx of [4, 11])
	for (let dy = -1; dy <= 1; dy++)
		for (let dx = -1; dx <= 1; dx++) set(96 + cx + dx, 14 + dy, [220, 40, 30]);
for (let x = 3; x < 13; x++) set(96 + x, 14, [60, 60, 60]);
for (const cx of [4, 11])
	for (let dy = -1; dy <= 1; dy++)
		for (let dx = -1; dx <= 1; dx++) set(96 + cx + dx, 14 + dy, [220, 40, 30]);
writeFileSync(OUT, encodePng(W, H, rgba));
console.log(`wrote ${OUT}`);
