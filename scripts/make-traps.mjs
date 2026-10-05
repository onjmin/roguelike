// 罠の 絵を 書き出す（node scripts/make-traps.mjs → public/sprites/traps.png）。
//
// RPGEN にも Base.png にも 合う 絵が ない 罠だけ ここで 描く。32x16 に 16x16 が 2コマ：
//   左：トラバサミ（口を 開けた 鉄の あご・まんなかの 踏み板・横の ばね）
//   右：酸の罠（床に 広がった 緑の 酸の 水たまり・あわ）
// 地雷・落とし穴は RPGEN の 絵（src/ui/theme.ts の TRAP_ICON）。
//
// 依存なし（zlib だけ）。PNG の 書き方は make-anka-trap.mjs と 同じ。

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../public/sprites/traps.png");

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

const BEAR_PALETTE = {
	o: [30, 30, 36, 255], // ふち
	h: [200, 204, 212, 255], // 鉄の 照り
	m: [122, 126, 136, 255], // 鉄
	d: [78, 80, 90, 255], // 下の あごの 影
	w: [232, 234, 238, 255], // 歯
	n: [40, 32, 28, 255], // 開いた あごの 奥
	s: [96, 98, 108, 255], // ばね
	k: [80, 56, 30, 255], // 踏み板の ふち
	p: [168, 124, 64, 255], // 踏み板
	x: [0, 0, 0, 90], // 床に 落ちる 影
};

const BEAR = [
	"................",
	"...oooooooooo...",
	"..ohhhhhhhhhmo..",
	".ohmmmmmmmmmmmo.",
	".omwnwnwnwnwnmo.",
	".omwnnnwnnnwnmo.",
	"oomnnnnkknnnnmoo",
	"ssmnnnkppknnnmss",
	"ssmnnnkppknnnmss",
	"oomnnnnkknnnnmoo",
	".omnwnnnwnnnwmo.",
	".omnwnwnwnwnwmo.",
	".ommmmmmmmmmmmo.",
	"..oddddddddddo..",
	"...oooooooooox..",
	"....xxxxxxxxx...",
];

const ACID_PALETTE = {
	o: [28, 62, 18, 255], // ふち
	a: [138, 206, 40, 255], // 酸
	h: [222, 255, 140, 255], // 照り
	g: [176, 236, 72, 255], // あわ
	d: [84, 142, 28, 255], // 深い ところ
	x: [0, 0, 0, 90], // 床に 落ちる 影
};

const ACID = [
	"................",
	"..........oo....",
	".........ohgo...",
	"...oo....oggo...",
	"..ohgo....oo....",
	"..oggo..........",
	"...oo.oooooo....",
	"....ooaaaaaaoo..",
	"..ooaahhaaaaaao.",
	".oaaahhaaaaooaao",
	".oaaaaaaaaohgoao",
	".oadaaaaaaaooaao",
	"..odddaaaaaaddo.",
	"...ooddddddddox.",
	"....ooooooooox..",
	".....xxxxxxxx...",
];

const frames = [
	[BEAR, BEAR_PALETTE],
	[ACID, ACID_PALETTE],
];
const W = 16 * frames.length;
const H = 16;
const rgba = Buffer.alloc(W * H * 4);
frames.forEach(([rows, palette], i) => {
	if (rows.length !== 16) throw new Error(`コマ${i}：${rows.length}行`);
	rows.forEach((row, y) => {
		if (row.length !== 16) throw new Error(`コマ${i} ${y}行目：${row.length}字`);
		[...row].forEach((ch, x) => {
			if (ch === ".") return;
			const c = palette[ch];
			if (!c) throw new Error(`知らない 字 ${ch}`);
			const o = (y * W + i * 16 + x) * 4;
			for (let k = 0; k < 4; k++) rgba[o + k] = c[k];
		});
	});
});
writeFileSync(OUT, encodePng(W, H, rgba));
console.log(`wrote ${OUT}`);
