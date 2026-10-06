// 罠の 絵を 書き出す（node scripts/make-traps.mjs → public/sprites/traps.png）。
//
// RPGEN にも Base.png にも 合う 絵が ない 罠だけ ここで 描く。96x16 に 16x16 が 6コマ（左から）：
//   0 トラバサミ（口を 開けた 鉄の あご・まんなかの 踏み板・横の ばね）
//   1 酸の罠（床に 広がった 緑の 酸の 水たまり・あわ）
//   2 眠りガスの罠（床の 噴き出し口から 立ちのぼる 紫の ガスと Z）
//   3 矢の罠（石の 踏み板に 上を 向いた 矢）
//   4 毒矢の罠（3 の 矢じりが 毒の 緑・紫の しずく）
//   5 転移床（青く 光る 輪）
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

const SLEEP_PALETTE = {
	o: [30, 30, 36, 255], // 噴き出し口の ふち
	m: [110, 114, 126, 255], // 鉄の 皿
	h: [176, 180, 192, 255], // 照り
	n: [24, 20, 34, 255], // 穴の 奥
	g: [150, 112, 210, 255], // 眠りガス
	l: [214, 190, 246, 255], // ガスの 明るい ところ
	d: [104, 72, 160, 255], // ガスの 影
	z: [72, 40, 120, 255], // Z
	x: [0, 0, 0, 90], // 床に 落ちる 影
};

const SLEEP = [
	"..........zzzz..",
	"............z...",
	"...........z....",
	"..llll....zzzz..",
	".lggggl.........",
	".gggggd..llll...",
	"..dddd..lggggl..",
	"....lllggggggd..",
	"...lgggggggdd...",
	"...gggggggdd....",
	"....ddddddd.....",
	"...oooooooooo...",
	"..ohhhhhhhhhmo..",
	".ohmnnmnnmnnmmo.",
	"..ommmmmmmmmmox.",
	"...oooooooooox..",
];

// 矢の罠・毒矢の罠：石の 踏み板（PLATE）に 上を 向いた 矢を 重ねる。矢じりの 色だけ ちがう
const PLATE_PALETTE = {
	o: [36, 36, 42, 255], // ふち
	h: [168, 164, 156, 255], // 踏み板の 照り
	p: [128, 124, 116, 255], // 踏み板
	d: [88, 84, 78, 255], // 踏み板の 影
	x: [0, 0, 0, 90], // 床に 落ちる 影
	s: [156, 102, 50, 255], // 矢柄
	i: [222, 226, 234, 255], // 鉄の 矢じり
	f: [214, 58, 48, 255], // 矢羽
	g: [120, 220, 60, 255], // 毒の 矢じり
	v: [150, 70, 190, 255], // 毒の しずく
};

const PLATE = [
	"................",
	".oooooooooooooo.",
	".ohhhhhhhhhhhho.",
	".ohppppppppppdo.",
	".ohppppppppppdo.",
	".ohppppppppppdo.",
	".ohppppppppppdo.",
	".ohppppppppppdo.",
	".ohppppppppppdo.",
	".ohppppppppppdo.",
	".ohppppppppppdo.",
	".ohppppppppppdo.",
	".ohppppppppppdo.",
	".odddddddddddddo",
	".oooooooooooooox",
	"..xxxxxxxxxxxxx.",
];

const ARROW_ON = [
	"................",
	".......oo.......",
	"......oiio......",
	".....oiiiio.....",
	"....oiiiiiio....",
	".......so.......",
	".......so.......",
	".......so.......",
	".......so.......",
	".......so.......",
	"......fsof......",
	".....ffsoff.....",
	".....f.so.f.....",
	"................",
	"................",
	"................",
];

const DART_ON = [
	"................",
	".......oo.......",
	"......oggo......",
	".....oggggo.....",
	"....oggggggo....",
	".......so.......",
	".......so..v....",
	".......so.......",
	".......so.......",
	"..v....so.......",
	"......fsof......",
	".....ffsoff.....",
	".....f.so.f.....",
	"................",
	"................",
	"................",
];

/** 下の 絵に 上の 絵を 重ねる（上の . は 透明）。 */
const over = (base, top) =>
	base.map((row, y) =>
		[...row].map((ch, x) => (top[y][x] === "." ? ch : top[y][x])).join(""),
	);

const WARP_PALETTE = {
	b: [36, 70, 168, 255], // 外の 輪
	l: [112, 204, 255, 255], // 光る 輪
	c: [70, 140, 232, 220], // 内の 輪
	w: [232, 250, 255, 230], // まんなかの 光
};

const WARP = [
	"................",
	"......bbbb......",
	"....bbllllbb....",
	"...bllbbbbllb...",
	"..blb.cccc.blb..",
	"..lb.c....c.bl..",
	".blb.c.ww.c.blb.",
	".lb.c.wwww.c.bl.",
	".lb.c.wwww.c.bl.",
	".blb.c.ww.c.blb.",
	"..lb.c....c.bl..",
	"..blb.cccc.blb..",
	"...bllbbbbllb...",
	"....bbllllbb....",
	"......bbbb......",
	"................",
];

const frames = [
	[BEAR, BEAR_PALETTE],
	[ACID, ACID_PALETTE],
	[SLEEP, SLEEP_PALETTE],
	[over(PLATE, ARROW_ON), PLATE_PALETTE],
	[over(PLATE, DART_ON), PLATE_PALETTE],
	[WARP, WARP_PALETTE],
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
