// 保守トロッコの 絵を 書き出す（node scripts/make-trolley.mjs → public/sprites/trolley.png）。
//
// 村の 早道（data/village/trolley.ts）。32x32：
//   (0,0) 乗り場（16x32）：短い レールに とまった トロッコと、うしろの 柱に 黄色い 札（トロッコの しるし）
//   (16,16) 乗っている ときの トロッコ（16x16。キリコの 腰から 下に かぶせる。ui/village.ts の ride）
// 鉄の 箱に 木の ふち、角に びょう、黒い 車輪。線路は make-street.mjs と 同じ 色。
//
// 依存なし（zlib だけ）。PNG の 書き方は make-street.mjs と 同じ。

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../public/sprites/trolley.png");

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

const W = 32;
const H = 32;
const rgba = Buffer.alloc(W * H * 4);
const set = (x, y, [r, g, b, a = 255]) => {
	if (x < 0 || y < 0 || x >= W || y >= H) return;
	const o = (y * W + x) * 4;
	rgba[o] = r;
	rgba[o + 1] = g;
	rgba[o + 2] = b;
	rgba[o + 3] = a;
};
const rect = (x0, y0, w, h, c) => {
	for (let y = y0; y < y0 + h; y++)
		for (let x = x0; x < x0 + w; x++) set(x, y, c);
};

const RAIL = [190, 190, 200];
const RAIL_D = [110, 110, 120];
const TIE = [110, 76, 48];
const STEEL = [112, 118, 128];
const STEEL_L = [164, 170, 180];
const STEEL_D = [70, 74, 84];
const RIM = [150, 96, 52];
const RIM_L = [198, 142, 84];
const RIM_D = [96, 60, 32];
const WHEEL = [36, 36, 40];
const HUB = [120, 120, 128];
const POLE = [128, 88, 52];
const POLE_D = [86, 58, 34];
const BOARD = [242, 202, 62];
const BOARD_D = [70, 50, 20];
const MARK = [52, 40, 24];

/** トロッコ（横 12px・高さ 8px）。(x0, y0) は 左上（木の ふちの 行）。 */
const cart = (x0, y0) => {
	// 木の ふち（上の 段は 明るく）
	rect(x0, y0, 12, 1, RIM_L);
	rect(x0, y0 + 1, 12, 1, RIM);
	set(x0, y0 + 1, RIM_D);
	set(x0 + 11, y0 + 1, RIM_D);
	// 鉄の 箱（下へ すぼまる）
	for (let y = 2; y <= 5; y++) {
		const inset = y >= 5 ? 1 : 0;
		for (let x = inset; x < 12 - inset; x++) {
			let c = STEEL;
			if (x === inset || x === 11 - inset) c = STEEL_D;
			else if (x === inset + 1 && y <= 4) c = STEEL_L;
			set(x0 + x, y0 + y, c);
		}
	}
	// 角の びょう
	set(x0 + 2, y0 + 3, STEEL_D);
	set(x0 + 9, y0 + 3, STEEL_D);
	// 底と 車輪
	rect(x0 + 1, y0 + 6, 10, 1, STEEL_D);
	for (const wx of [x0 + 1, x0 + 8]) {
		rect(wx, y0 + 7, 3, 1, WHEEL);
		set(wx + 1, y0 + 7, HUB);
	}
};

// 乗り場（16x32）：下の 段に 横の レール、その 上に トロッコ、右の 柱に 札
// レール（横。y=27・30、枕木は 4px おき）
for (let x = 0; x < 16; x++) {
	for (let y = 26; y <= 31; y++) if (x % 4 === 1) set(x, y, TIE);
	set(x, 27, RAIL);
	set(x, 28, RAIL_D);
	set(x, 30, RAIL);
	set(x, 31, RAIL_D);
}
// 柱（右はし。札の 下から 地面まで）
rect(13, 8, 2, 19, POLE);
rect(14, 8, 1, 19, POLE_D);
// 札（黄色い 板に こげ茶の ふちと トロッコの しるし）
rect(2, 0, 14, 9, BOARD_D);
rect(3, 1, 12, 7, BOARD);
rect(5, 3, 8, 2, MARK);
rect(6, 5, 6, 1, MARK);
set(6, 6, MARK);
set(11, 6, MARK);
// とまっている トロッコ（車輪が レールに のる）
cart(1, 20);

// 乗っている ときの トロッコ（16x16 の 下 8px。キリコの 足を かくす）
cart(16 + 2, 16 + 8);

writeFileSync(OUT, encodePng(W, H, rgba));
console.log(`wrote ${OUT}`);
