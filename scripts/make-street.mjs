// 街の 小物の 絵を 書き出す（node scripts/make-street.mjs → public/sprites/street.png）。
//
// 住宅街・都市（町の 段6〜7）の 道ばたと 線路・港（STORY.md §5.75）。176x48。上の 段は 16x16、縦長の 物は 16x32〜48：
//   (0,0) 線路（横）   (16,0) 線路（縦）   (32,0) 踏切の 道（アスファルトに 縦の レール）   (48,0) 踏切の 道（横の レール）
//   (64,0) 電柱（16x32）   (80,0) 街灯（16x32）   (96,0) 踏切の 警報機（16x32）
//   (112,0) (128,0) (144,0) コンテナ（赤・青・緑）   (112,16) 岸壁の コンクリート   (160,0) クレーン（16x48）
//   (176,0) (192,0) (208,0) 自販機（赤・青・白。16x32）   (224,0) 信号機（16x32）
//   (240,0) (240,16) 車（赤・白。横向き 32x16。2マスに またがる）
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

const W = 272;
const H = 48;
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
// コンテナ（波板の 縦じま。上と 下に 影）
const COLORS = [
	[178, 52, 40],
	[44, 84, 160],
	[52, 132, 72],
];
COLORS.forEach(([r, g, b], i) => {
	for (let y = 1; y < 15; y++)
		for (let x = 0; x < 16; x++) {
			const k = x % 3 === 0 ? 0.8 : 1;
			const e = y === 1 || y === 14 ? 0.7 : 1;
			set(112 + i * 16 + x, y, [r * k * e, g * k * e, b * k * e].map(Math.round));
		}
});
// 岸壁の コンクリート
for (let y = 16; y < 32; y++)
	for (let x = 0; x < 16; x++) {
		const n = Math.floor(rnd() * 10) - 5;
		const line = x === 0 || y === 16;
		const v = line ? 140 : 168 + n;
		set(112 + x, y, [v, v, v - 4]);
	}
// クレーン（16x48。黄色い 脚と 梁）
const CRANE = [232, 176, 32];
const CRANE_D = [176, 128, 20];
for (let y = 6; y < 47; y++) {
	set(160 + 2, y, CRANE);
	set(160 + 3, y, CRANE_D);
	set(160 + 12, y, CRANE);
	set(160 + 13, y, CRANE_D);
}
for (let x = 0; x < 16; x++) {
	set(160 + x, 4, CRANE);
	set(160 + x, 5, CRANE_D);
	set(160 + x, 20, CRANE);
}
for (let y = 6; y < 20; y++) set(160 + 2 + Math.floor((y - 6) * 0.7), y, CRANE_D);
for (let y = 6; y < 14; y++) set(160 + 8, y, [60, 60, 60]);
for (let x = 6; x < 11; x++) for (let y = 14; y < 18; y++) set(160 + x, y, [200, 60, 40]);
// 自販機（16x32。足もとは マスの 下。上に 見本の 缶の 段、まんなかに 硬貨の 口、下に 取り出し口）
const VENDING = [
	[200, 40, 40],
	[40, 90, 190],
	[228, 228, 222],
];
VENDING.forEach(([r, g, b], i) => {
	const X = 176 + i * 16;
	for (let y = 6; y < 31; y++)
		for (let x = 2; x < 14; x++) {
			const edge = x === 2 || x === 13 || y === 6;
			const k = edge ? 0.7 : 1;
			set(X + x, y, [r * k, g * k, b * k].map(Math.round));
		}
	// 見本の 段（白い 窓に 色とりどりの 缶）
	const CANS = [
		[240, 200, 40],
		[60, 170, 90],
		[230, 90, 60],
		[90, 140, 230],
	];
	for (const row of [9, 13])
		for (let x = 4; x < 12; x++) {
			set(X + x, row - 1, [236, 240, 244]);
			set(X + x, row, CANS[(x + row) % 4]);
			set(X + x, row + 1, CANS[(x + row) % 4]);
		}
	// ボタンの 列・硬貨の 口
	for (let x = 4; x < 12; x += 2) set(X + x, 17, [250, 230, 120]);
	set(X + 11, 20, [30, 30, 30]);
	set(X + 11, 21, [30, 30, 30]);
	// 取り出し口
	for (let x = 4; x < 12; x++)
		for (let y = 25; y < 28; y++) set(X + x, y, [24, 24, 28]);
});
// 信号機（16x32）：灰色の 柱と、横に 長い 灯りの 箱（青・黄・赤）
for (let y = 8; y < 31; y++) {
	set(224 + 7, y, [96, 100, 108]);
	set(224 + 8, y, [70, 74, 82]);
}
for (let x = 1; x < 15; x++)
	for (let y = 2; y < 8; y++) set(224 + x, y, [44, 46, 52]);
for (const [cx, c] of [
	[4, [60, 200, 120]],
	[8, [240, 200, 40]],
	[12, [90, 40, 40]],
])
	for (let dy = -1; dy <= 1; dy++)
		for (let dx = -1; dx <= 1; dx++) set(224 + cx + dx, 5 + dy, c);
for (let x = 6; x < 10; x++) set(224 + x, 30, [60, 60, 66]);
// 車（32x16。屋根・窓・車体・タイヤ。右を 向く）
for (const [row, [r, g, b]] of [
	[0, [196, 40, 44]],
	[16, [232, 232, 230]],
]) {
	const body = (x, y, k = 1) =>
		set(240 + x, row + y, [r * k, g * k, b * k].map(Math.round));
	for (let x = 2; x < 30; x++) for (let y = 6; y < 13; y++) body(x, y, y > 10 ? 0.75 : 1);
	for (let x = 8; x < 22; x++) for (let y = 2; y < 6; y++) body(x, y, 0.9);
	for (let x = 10; x < 20; x++) for (let y = 3; y < 6; y++) set(240 + x, row + y, [120, 170, 210]);
	for (const tx of [7, 23])
		for (let dx = -2; dx <= 2; dx++)
			for (let y = 11; y < 15; y++) set(240 + tx + dx, row + y, [28, 28, 30]);
	set(240 + 29, row + 8, [250, 240, 180]);
	set(240 + 2, row + 8, [200, 40, 30]);
}
writeFileSync(OUT, encodePng(W, H, rgba));
console.log(`wrote ${OUT}`);
