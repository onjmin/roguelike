// 安価の罠の 絵を 書き出す（node scripts/make-anka-trap.mjs → public/sprites/anka_trap.png）。
//
// 床の 踏み板に 安価の「>>」が 彫ってある。32x16 に 16x16 が 2コマ：
//   左：踏む前（盛り上がった 板・青い >>。2ch の 安価の 色）
//   右：踏んだ後（板が 沈んで >> が 赤く 光る。安価を 取られた）
//
// 依存なし（zlib だけ）。PNG の 書き方は make-statue.mjs と 同じ。

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../public/sprites/anka_trap.png");

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

// ───────────────── 絵（1字＝1ドット。. は 透明） ─────────────────

const PALETTE = {
	o: [43, 33, 24, 255], // ふち
	h: [236, 224, 188, 255], // 板の 上の 照り
	f: [205, 189, 146, 255], // 板の 面
	g: [176, 160, 118, 255], // 沈んだ 板の 面
	s: [138, 116, 80, 255], // 板の 横（厚み）
	d: [84, 68, 48, 255], // 沈んだ 穴の 影
	b: [47, 95, 208, 255], // >>（青）
	r: [232, 70, 60, 255], // >>（光る 赤）
	x: [0, 0, 0, 90], // 床に 落ちる 影
};

const BEFORE = [
	"................",
	"................",
	"..oooooooooooo..",
	"..ohhhhhhhhhho..",
	"..offffffffffo..",
	"..ofbbfbbffffo..",
	"..offbbfbbfffo..",
	"..offfbbfbbffo..",
	"..offbbfbbfffo..",
	"..ofbbfbbffffo..",
	"..offffffffffo..",
	"..ossssssssssox.",
	"..ossssssssssox.",
	"..oooooooooooox.",
	"...xxxxxxxxxxxx.",
	"................",
];

const AFTER = [
	"................",
	"................",
	"................",
	"................",
	"..oooooooooooo..",
	"..oddddddddddo..",
	"..odgggggggggo..",
	"..odrrgrrggggo..",
	"..odgrrgrrgggo..",
	"..odggrrgrrggo..",
	"..odgrrgrrgggo..",
	"..odrrgrrggggo..",
	"..odgggggggggo..",
	"..oooooooooooo..",
	"................",
	"................",
];

const frames = [BEFORE, AFTER];
const W = 16 * frames.length;
const H = 16;
const rgba = Buffer.alloc(W * H * 4);
frames.forEach((rows, i) => {
	if (rows.length !== 16) throw new Error(`コマ${i}：${rows.length}行`);
	rows.forEach((row, y) => {
		if (row.length !== 16) throw new Error(`コマ${i} ${y}行目：${row.length}字`);
		[...row].forEach((ch, x) => {
			if (ch === ".") return;
			const c = PALETTE[ch];
			if (!c) throw new Error(`知らない 字 ${ch}`);
			const o = (y * W + i * 16 + x) * 4;
			for (let k = 0; k < 4; k++) rgba[o + k] = c[k];
		});
	});
});
writeFileSync(OUT, encodePng(W, H, rgba));
console.log(`wrote ${OUT}`);
