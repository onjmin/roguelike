// 道路の 絵を 書き出す（node scripts/make-road.mjs → public/sprites/road.png）。
//
// 住宅街（町の 段6）から 村の 道が アスファルトに なる（STORY.md §5.75）。272x16 に 16x16 が 17コマ：
//   0 アスファルト   1 横の 道の 中央線（白の 点線）   2 縦の 道の 中央線   3 横の 道の 横断歩道（縞は 横）
//   4 縦の 道の 横断歩道（縞は 縦）   5 歩道（灰色の タイル）
//   6〜9 2車線の 道の 半分（中央線が 内がわの はし、白の 実線が 外がわの はし）：
//        6 横の 上の 車線・7 横の 下の 車線・8 縦の 左の 車線・9 縦の 右の 車線
//   10・11 4車線の 横の 道の 内がわの 車線（まんなかの 黄色い 実線が 下の はし・上の はし）
//   12 5マスの 縦の 道の まんなか（黄色い 実線が 縦に）
//   13 1マスの 横の 道（町の 中心の 通り。上下の はしに 白の 実線＝路側帯）
//   14 駅前広場の レンガ舗装   15 点字ブロック（点状）   16 レンガに 鉄の 格子（広場の 木の 根元）
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

const W = 272;
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
// 2車線の 半分（中央線は 2マスの さかい目に：上の 車線は 下の はし、下の 車線は 上の はし）
for (let f = 6; f < 10; f++)
	for (let y = 0; y < 16; y++)
		for (let x = 0; x < 16; x++) {
			let c = asphalt();
			const dashX = x % 8 >= 2 && x % 8 <= 5;
			const dashY = y % 8 >= 2 && y % 8 <= 5;
			if (f === 6 && y === 15 && dashX) c = WHITE;
			if (f === 7 && y === 0 && dashX) c = WHITE;
			if (f === 8 && x === 15 && dashY) c = WHITE;
			if (f === 9 && x === 0 && dashY) c = WHITE;
			// 外がわの はしは 白の 実線（歩道との さかい）
			if (f === 6 && y === 1) c = WHITE;
			if (f === 7 && y === 14) c = WHITE;
			if (f === 8 && x === 1) c = WHITE;
			if (f === 9 && x === 14) c = WHITE;
			set(f * 16 + x, y, c);
		}
// 4車線の 内がわ（まんなかは 黄色の 実線）
const YELLOW = [236, 196, 48];
for (const f of [10, 11])
	for (let y = 0; y < 16; y++)
		for (let x = 0; x < 16; x++) {
			let c = asphalt();
			if (f === 10 && y === 15) c = YELLOW;
			if (f === 11 && y === 0) c = YELLOW;
			set(f * 16 + x, y, c);
		}
for (let y = 0; y < 16; y++)
	for (let x = 0; x < 16; x++) {
		const c = x === 7 || x === 8 ? YELLOW : asphalt();
		set(12 * 16 + x, y, c);
	}
// 13 1マスの 横の 道（町の 中心。上下の はしに 白の 実線＝路側帯。センターラインは ない）
for (let y = 0; y < 16; y++)
	for (let x = 0; x < 16; x++) {
		let c = asphalt();
		if (y === 1 || y === 14) c = WHITE;
		set(13 * 16 + x, y, c);
	}
// 14 駅前広場の レンガ舗装（8x4 の 走り目地。行ごとに 4px ずらす。レンガごとに 色を すこし ずらす）
const brickShade = (row, col) => {
	let h = (row * 374761393 + col * 668265263) ^ 0x5bd1e995;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return Math.floor((((h ^ (h >>> 16)) >>> 0) / 0xffffffff) * 18) - 9;
};
const BRICK = [190, 168, 150];
const BRICK_J = [142, 126, 114];
for (let y = 0; y < 16; y++)
	for (let x = 0; x < 16; x++) {
		const row = Math.floor(y / 4);
		const off = row % 2 ? 4 : 0;
		const col = Math.floor(((x + off) % 16) / 8);
		const joint = y % 4 === 3 || (x + off) % 8 === 7;
		const n = brickShade(row, col) + Math.floor(rnd() * 4) - 2;
		set(14 * 16 + x, y, joint ? BRICK_J : BRICK.map((v) => v + n));
	}
// 15 点字ブロック（点状。横断歩道の 前の 歩道。黄色に 3x3 の 点）
const TACT = [214, 176, 52];
const TACT_D = [170, 136, 34];
const TACT_L = [238, 208, 112];
for (let y = 0; y < 16; y++)
	for (let x = 0; x < 16; x++) {
		let c = TACT;
		if (x === 0 || y === 0 || x === 15 || y === 15) c = TACT_D;
		for (const dx of [3, 7, 11])
			for (const dy of [3, 7, 11]) {
				if (x === dx && y === dy) c = TACT_L;
				if (x === dx + 1 && y === dy + 1) c = TACT_D;
			}
		set(15 * 16 + x, y, c);
	}
// 16 広場の 木の 根元（14 の レンガの まんなかに 鉄の 格子と 土）
for (let y = 0; y < 16; y++)
	for (let x = 0; x < 16; x++) {
		const o = (y * W + 14 * 16 + x) * 4;
		let c = [rgba[o], rgba[o + 1], rgba[o + 2]];
		if (x >= 2 && x <= 13 && y >= 2 && y <= 13) {
			c = (x + y) % 3 === 0 ? [60, 60, 66] : [96, 96, 104];
			if (x === 2 || x === 13 || y === 2 || y === 13) c = [70, 70, 78];
			if (x >= 6 && x <= 9 && y >= 6 && y <= 9) c = [84, 64, 44];
		}
		set(16 * 16 + x, y, c);
	}
writeFileSync(OUT, encodePng(W, H, rgba));
console.log(`wrote ${OUT}`);
