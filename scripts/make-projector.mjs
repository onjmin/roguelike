// 映写機の 絵を 書き出す（node scripts/make-projector.mjs → public/sprites/projector.png）。
//
// 本館の 床に 置く 置物（16x16）。上に リール 2つ・胴・右に レンズ（光が もれる）・木の 台。
// ここで これまでの あらすじを 上映する（ui/hallEvents.ts）。
//
// 依存なし（zlib だけ）。PNG の 書き方は make-statue.mjs と 同じ。

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../public/sprites/projector.png");

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
	o: [30, 26, 24, 255], // ふち
	r: [96, 96, 104, 255], // リール
	R: [150, 150, 160, 255], // リールの 照り
	f: [58, 46, 40, 255], // フィルム
	b: [70, 74, 84, 255], // 胴
	B: [112, 118, 130, 255], // 胴の 照り
	d: [44, 46, 54, 255], // 胴の 影
	l: [200, 210, 220, 255], // レンズ
	y: [250, 232, 150, 255], // 光
	w: [128, 92, 56, 255], // 台
	x: [0, 0, 0, 90], // 床に 落ちる 影
};

const ROWS = [
	"................",
	"..ooo.....ooo...",
	".orRro...orRro..",
	".oRoRo...oRoRo..",
	".orRro...orRro..",
	"..ofo.....ofo...",
	"...f.......f....",
	"..oooooooooooo..",
	"..oBBBBBBBBBBooo",
	"..obbbbbbbbbbolo",
	"..obbbbbbbbbboly",
	"..odddddddddbooo",
	"..oooooooooooo..",
	"....ow....wo....",
	"...owo....owo...",
	"...xxxxxxxxxx...",
];

const W = 16;
const H = 16;
const rgba = Buffer.alloc(W * H * 4);
if (ROWS.length !== 16) throw new Error(`${ROWS.length}行`);
ROWS.forEach((row, y) => {
	if (row.length !== 16) throw new Error(`${y}行目：${row.length}字`);
	[...row].forEach((ch, x) => {
		if (ch === ".") return;
		const c = PALETTE[ch];
		if (!c) throw new Error(`知らない 字 ${ch}`);
		const o = (y * W + x) * 4;
		for (let k = 0; k < 4; k++) rgba[o + k] = c[k];
	});
});
writeFileSync(OUT, encodePng(W, H, rgba));
console.log(`wrote ${OUT}`);
