// ボカロ作り避難所の ダンジョンの 床・階段・壁を 初音ミクの 色に した シートを 書き出す
// （node scripts/make-miku-tiles.mjs → public/assets/rpg-reze/dungeon-miku.png。96x48）。
//
// 元は Base.png の 電脳の 紫（ui/dungeon/theme.ts の CYBER と 同じ マス）。色を 1つずつ 置きかえる：
// 床は 炭色に ミクの 青緑の 格子、階段は 角が 桃色、壁は 銀灰色に 青緑の ふちと 桃色の 石。
// ならびは 1段目 = 床（x0）・階段（x1）、2段目 = 壁の 上の面 6枚、3段目 = 壁の 下の面 6枚
// （theme.ts の MIKU が 切る）。置きかえ表に ない 色が あれば 書き出さずに 止める。
//
// 依存なし（zlib だけ）。PNG の 読み書きは make-pond.mjs と 同じ。

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

// ───────────────── 色の 置きかえ ─────────────────

/** 床：紫の 格子を 炭色と ミクの 青緑に。 */
const FLOOR = {
	"41,38,39": [28, 32, 34],
	"110,20,175": [29, 79, 80],
	"176,61,255": [57, 197, 187],
};
/** 階段：床と 同じ 格子に、角の 薄紫を 桃色に。 */
const STAIRS = {
	...FLOOR,
	"203,126,255": [225, 40, 133],
	"83,79,84": [90, 95, 99],
};
/** 壁：紫の 面を 銀灰色に、ふちを 青緑に、灰色の 石を 桃色に。 */
const WALL = {
	"41,38,39": [43, 47, 50],
	"110,20,175": [190, 200, 209],
	"83,79,84": [90, 95, 99],
	"176,61,255": [57, 197, 187],
	"192,96,255": [134, 206, 203],
	"134,131,140": [225, 40, 133],
	"185,185,185": [255, 158, 200],
};

// ───────────────── 切り出し ─────────────────

const ROOT = join(HERE, "..");
const src = decodePng(
	readFileSync(join(ROOT, "public/assets/rpg-reze/Base.png")),
);
const W = 96;
const H = 48;
const out = Buffer.alloc(W * H * 4);
const missing = new Set();

/** Base.png の (c, r) マスを 色を かえて (dc, dr) マスへ。 */
const put = (c, r, dc, dr, swap, what) => {
	for (let y = 0; y < 16; y++)
		for (let x = 0; x < 16; x++) {
			const i = ((r * 16 + y) * src.w + c * 16 + x) * 4;
			const o = ((dr * 16 + y) * W + dc * 16 + x) * 4;
			const a = src.rgba[i + 3];
			if (!a) continue;
			if (a !== 255) missing.add(`${what}: 半透明 ${a}`);
			const k = `${src.rgba[i]},${src.rgba[i + 1]},${src.rgba[i + 2]}`;
			const to = swap[k];
			if (!to) missing.add(`${what}: ${k}`);
			out.set(
				[...(to ?? [src.rgba[i], src.rgba[i + 1], src.rgba[i + 2]]), a],
				o,
			);
		}
};

put(4, 166, 0, 0, FLOOR, "床");
put(4, 167, 1, 0, STAIRS, "階段");
for (let x = 0; x < 6; x++) {
	put(x, 181, x, 1, WALL, "壁の上の面");
	put(x, 182, x, 2, WALL, "壁の下の面");
}
if (missing.size) {
	console.error(`置きかえ表に ない 色：\n${[...missing].join("\n")}`);
	process.exit(1);
}
writeFileSync(
	join(ROOT, "public/assets/rpg-reze/dungeon-miku.png"),
	encodePng(W, H, out),
);
