// 道路の 絵を 書き出す（node scripts/make-road.mjs → public/sprites/road.png）。
//
// 住宅街（町の 段6）から 村の 道が アスファルトに なる（STORY.md §5.75）。96x16 に 16x16 が 6コマ：
//   0 アスファルト   1 横の 道の 中央線（白の 点線）   2 縦の 道の 中央線   3 横の 道の 横断歩道（縞は 横）
//   4 縦の 道の 横断歩道（縞は 縦）   5 歩道（灰色の タイル）
// アスファルトの ざらつきは 決まった 乱数（毎回 同じ 絵）。
//
// 依存なし（zlib だけ）。PNG の 書き方は make-statue.mjs と 同じ。

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../public/sprites/road.png");

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

const W = 96;
const H = 16;
const rgba = Buffer.alloc(W * H * 4);
let seed = 12345;
const rnd = () => {
	seed = (seed * 1103515245 + 12345) & 0x7fffffff;
	return seed / 0x7fffffff;
};
const set = (x, y, [r, g, b]) => {
	const o = (y * W + x) * 4;
	rgba[o] = r;
	rgba[o + 1] = g;
	rgba[o + 2] = b;
	rgba[o + 3] = 255;
};
const asphalt = () => {
	const n = Math.floor(rnd() * 14) - 7;
	return [74 + n, 74 + n, 80 + n];
};
const WHITE = [232, 232, 226];
for (let f = 0; f < 5; f++)
	for (let y = 0; y < 16; y++)
		for (let x = 0; x < 16; x++) {
			let c = asphalt();
			if (f === 1 && (y === 7 || y === 8) && x % 8 >= 2 && x % 8 <= 5) c = WHITE;
			if (f === 2 && (x === 7 || x === 8) && y % 8 >= 2 && y % 8 <= 5) c = WHITE;
			if (f === 3 && y % 4 < 2 && x >= 1 && x <= 14) c = WHITE;
			if (f === 4 && x % 4 < 2 && y >= 1 && y <= 14) c = WHITE;
			set(f * 16 + x, y, c);
		}
for (let y = 0; y < 16; y++)
	for (let x = 0; x < 16; x++) {
		const n = Math.floor(rnd() * 8) - 4;
		const line = x % 8 === 0 || y % 8 === 0;
		const v = line ? 150 : 184 + n;
		set(80 + x, y, [v, v - 2, v - 6]);
	}
writeFileSync(OUT, encodePng(W, H, rgba));
console.log(`wrote ${OUT}`);
