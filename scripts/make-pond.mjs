// 村の 池の 岸（オートタイル）を 書き出す（node scripts/make-pond.mjs → public/assets/rpg-reze/pond.png）。
//
// 元は field.png の 左上（x0・y0 の 16x80）。WOLF RPG エディターの オートタイルと 同じ ならびで、
// 上から 外の角・左右の岸・上下の岸・内の角・まんなか の 5マス（それぞれ 8x8 の 4つに 分けて 使う）。
// 岸の 草は field.png の 緑で、村の 芝（Base.png）と 色が ちがうので 透明に ぬく
// （下に 芝を 敷いて 重ねる。data/village/tiles.ts の POND）。
//
// 湯だまり（ダンジョンの 湯気の 立つ 池。ui/dungeon/render.ts）は 同じ 岸で、水だけ 白く にごらせた pond-onsen.png。
//
// 板ごとの 水たまり（はちみつ・電解液・水銀 など）も 同じ 岸で 水の 色だけ かえた pond-<名前>.png。
// 床に 土の 色が 合わない 板は 岸の 色も かえる（SHORES。ミク色の 水は 灰色の 岸）。
//
// 依存なし（zlib だけ）。PNG の 読み書きは make-metal-puyu.mjs と 同じ。

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));

// ───────────────── 最小 PNG（書き: RGBA 8bit。読み: 非インターレースの パレット/RGB/RGBA） ─────────────────

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
const paeth = (a, b, c) => {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
const decodePng = (buf) => {
	let p = 8;
	let w = 0;
	let h = 0;
	let depth = 0;
	let ctype = 0;
	let plte = null;
	let trns = null;
	const idat = [];
	while (p < buf.length) {
		const len = buf.readUInt32BE(p);
		const type = buf.toString("ascii", p + 4, p + 8);
		const data = buf.subarray(p + 8, p + 8 + len);
		if (type === "IHDR") {
			w = data.readUInt32BE(0);
			h = data.readUInt32BE(4);
			depth = data[8];
			ctype = data[9];
			if (data[12]) throw new Error("インターレースは読めません");
		} else if (type === "PLTE") plte = data;
		else if (type === "tRNS") trns = data;
		else if (type === "IDAT") idat.push(data);
		p += 12 + len;
	}
	const chans = { 2: 3, 3: 1, 6: 4 }[ctype];
	if (!chans || (ctype !== 3 && depth !== 8))
		throw new Error(`色の形 ${ctype}/${depth} は読めません`);
	const bpp = Math.max(1, (chans * depth) >> 3);
	const stride = Math.ceil((w * chans * depth) / 8);
	const raw = inflateSync(Buffer.concat(idat));
	const lines = Buffer.alloc(stride * h);
	for (let y = 0; y < h; y++) {
		const f = raw[y * (stride + 1)];
		const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
		const cur = lines.subarray(y * stride, (y + 1) * stride);
		const prev = y ? lines.subarray((y - 1) * stride, y * stride) : null;
		for (let i = 0; i < stride; i++) {
			const a = i >= bpp ? cur[i - bpp] : 0;
			const b = prev ? prev[i] : 0;
			const c = prev && i >= bpp ? prev[i - bpp] : 0;
			const add = [0, a, b, (a + b) >> 1, paeth(a, b, c)][f];
			cur[i] = (src[i] + add) & 255;
		}
	}
	const rgba = Buffer.alloc(w * h * 4);
	for (let y = 0; y < h; y++) {
		const line = lines.subarray(y * stride, (y + 1) * stride);
		for (let x = 0; x < w; x++) {
			const o = (y * w + x) * 4;
			if (ctype === 3) {
				const per = 8 / depth;
				const idx =
					(line[Math.floor(x / per)] >> (8 - depth * ((x % per) + 1))) &
					((1 << depth) - 1);
				plte.copy(rgba, o, idx * 3, idx * 3 + 3);
				rgba[o + 3] = trns && idx < trns.length ? trns[idx] : 255;
			} else if (ctype === 2) {
				line.copy(rgba, o, x * 3, x * 3 + 3);
				rgba[o + 3] = 255;
			} else line.copy(rgba, o, x * 4, x * 4 + 4);
		}
	}
	return { w, h, rgba };
};

// ───────────────── 切り出し ─────────────────

const ROOT = join(HERE, "..");
const src = decodePng(
	readFileSync(join(ROOT, "public/assets/rpg-reze/field.png")),
);
const GRASS = new Set(["145,218,72", "121,182,60", "97,145,48"]);
const W = 16;
const H = 80;
const out = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
	for (let x = 0; x < W; x++) {
		const i = (y * src.w + x) * 4;
		const o = (y * W + x) * 4;
		const px = src.rgba.subarray(i, i + 4);
		if (GRASS.has(`${px[0]},${px[1]},${px[2]}`)) continue;
		out.set(px, o);
	}
}
writeFileSync(
	join(ROOT, "public/assets/rpg-reze/pond.png"),
	encodePng(W, H, out),
);

// 湯だまり：水の 青を 白く にごった 湯に（岸の 茶色は そのまま）
const MILKY = new Map([
	["0,73,145", [176, 206, 204]],
	["0,91,182", [196, 222, 218]],
	["0,109,218", [214, 234, 230]],
	["113,184,255", [232, 244, 240]],
	["170,212,255", [250, 252, 246]],
]);
const onsen = Buffer.from(out);
for (let o = 0; o < onsen.length; o += 4) {
	const to = MILKY.get(`${onsen[o]},${onsen[o + 1]},${onsen[o + 2]}`);
	if (to) onsen.set(to, o);
}
writeFileSync(
	join(ROOT, "public/assets/rpg-reze/pond-onsen.png"),
	encodePng(W, H, onsen),
);

// 板ごとの 水たまり（core/data/decor.ts の liquid）：水の 5段の 青を、暗い 順に その 液の 5色に（岸は そのまま）
const SHADES = [
	"0,73,145",
	"0,91,182",
	"0,109,218",
	"113,184,255",
	"170,212,255",
];
const LIQUIDS = {
	// パン板：はちみつ
	honey: [
		[150, 82, 12],
		[190, 110, 20],
		[222, 146, 34],
		[246, 188, 70],
		[255, 226, 140],
	],
	// 電池板：漏れた 電解液
	acid: [
		[40, 110, 20],
		[70, 150, 30],
		[110, 196, 40],
		[170, 232, 80],
		[220, 255, 150],
	],
	// きのこ板：胞子の 沼
	spore: [
		[70, 30, 100],
		[96, 44, 130],
		[126, 64, 160],
		[168, 110, 200],
		[212, 170, 232],
	],
	// 離島板：潮だまり
	tide: [
		[0, 110, 130],
		[0, 140, 160],
		[20, 176, 190],
		[100, 220, 220],
		[180, 245, 240],
	],
	// おんたこ：ソース
	sauce: [
		[46, 20, 8],
		[64, 30, 12],
		[86, 42, 18],
		[120, 64, 30],
		[168, 104, 60],
	],
	// 過去ログの底：墨
	ink: [
		[10, 10, 18],
		[20, 20, 32],
		[32, 32, 48],
		[60, 60, 84],
		[100, 100, 130],
	],
	// ボカロ作り避難所：ミク色の 電子の 水
	miku: [
		[12, 92, 96],
		[22, 140, 136],
		[57, 197, 187],
		[134, 206, 203],
		[214, 246, 242],
	],
	// マーキュリー：水銀
	mercury: [
		[90, 96, 106],
		[124, 130, 140],
		[160, 166, 176],
		[200, 206, 214],
		[236, 240, 246],
	],
	// おんMu：沈む 大陸の 海水
	sea: [
		[0, 30, 90],
		[0, 46, 120],
		[10, 66, 150],
		[50, 110, 190],
		[110, 160, 220],
	],
	// おんキム：キムチの 汁
	kimchi: [
		[130, 20, 10],
		[170, 36, 14],
		[206, 60, 24],
		[236, 104, 50],
		[255, 160, 110],
	],
	// †闇の板†：血の池
	blood: [
		[60, 0, 6],
		[90, 4, 12],
		[120, 10, 20],
		[156, 30, 40],
		[196, 70, 80],
	],
};
// 岸の 茶色（暗い 順）を かえる 液だけ：その 板の 床に 合わせた 色
const SHORES = {
	// ボカロ作り避難所：炭色の 床に 合う 銀灰色の ふち
	miku: {
		"109,72,36": [43, 47, 50],
		"145,97,48": [90, 95, 99],
		"182,121,60": [190, 200, 209],
	},
};
for (const [name, colors] of Object.entries(LIQUIDS)) {
	const map = new Map([
		...SHADES.map((s, k) => [s, colors[k]]),
		...Object.entries(SHORES[name] ?? {}),
	]);
	const img = Buffer.from(out);
	for (let o = 0; o < img.length; o += 4) {
		const to = map.get(`${img[o]},${img[o + 1]},${img[o + 2]}`);
		if (to) img.set(to, o);
	}
	writeFileSync(
		join(ROOT, `public/assets/rpg-reze/pond-${name}.png`),
		encodePng(W, H, img),
	);
}
