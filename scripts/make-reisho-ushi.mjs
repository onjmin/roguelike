// まんぜう軍（冷笑する 牛）の歩行グラ（32x64・16x16 が 2コマ×4方向）を書き出す（node scripts/make-reisho-ushi.mjs）。
//
// 元は RPGEN の スプライト「不良牛」（sp:AXTDsXV・no.27059。16x16 の 1枚絵で、正面を 向いている）。
// 歩行グラが 無いので、1枚絵から 4方向を 組む：上・下・右は そのまま、左は 左右反転。
// 2コマ目は 1ドット 沈ませる（足もとの 行は そのまま、その上を 1行 下へ ずらす）。のし歩く 感じに。
//
//   node scripts/make-reisho-ushi.mjs                          … public/sprites/reisho_ushi.png
//   node scripts/make-reisho-ushi.mjs --src AXTDsXV.png        … 元絵を手元のファイルから（無ければ CDN から取る）
//   node scripts/make-reisho-ushi.mjs --out a.png --preview b.png
//
// 依存なし（zlib だけ）。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_URL = "https://rpgen-search.pages.dev/data/images/sprites/AXTDsXV.png";

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
	if (!chans || (ctype !== 3 && depth !== 8)) throw new Error(`色の形 ${ctype}/${depth} は読めません`);
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
				const idx = (line[Math.floor(x / per)] >> (8 - depth * ((x % per) + 1))) & ((1 << depth) - 1);
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

// ───────────────── 組み立て ─────────────────

const CELL = 16;

/** 16x16 の 1マスを (dx, dy) に 置く。flip で 左右反転、sink で 足もと より上を 1行 沈める。 */
const put = (sheet, src, dx, dy, { flip = false, sink = false } = {}) => {
	// 足もと（いちばん下の 不透明な行）
	let foot = -1;
	for (let y = 0; y < CELL; y++)
		for (let x = 0; x < CELL; x++) if (src.rgba[(y * CELL + x) * 4 + 3] > 127) foot = y;
	for (let y = 0; y < CELL; y++)
		for (let x = 0; x < CELL; x++) {
			// 沈める コマは、足もとの 行は そのまま、その上は 1行 上の 絵を 持ってくる（いちばん上の 行は 空く）
			const sy = sink && y < foot ? y - 1 : y;
			const sx = flip ? CELL - 1 - x : x;
			const o = ((dy + y) * sheet.w + dx + x) * 4;
			if (sy < 0) continue;
			src.rgba.copy(sheet.rgba, o, (sy * CELL + sx) * 4, (sy * CELL + sx) * 4 + 4);
		}
};

const build = (src) => {
	const sheet = { w: CELL * 2, h: CELL * 4, rgba: Buffer.alloc(CELL * 2 * CELL * 4 * 4) };
	// 段：上（背中）・右・下（正面）・左。背中の 絵は 無いので 正面を 使う
	const rows = [{}, {}, {}, { flip: true }];
	rows.forEach((o, i) => {
		put(sheet, src, 0, i * CELL, o);
		put(sheet, src, CELL, i * CELL, { ...o, sink: true });
	});
	return sheet;
};

// ───────────────── 見くらべ用 ─────────────────

const scaleOn = (img, z, bg) => {
	const W = img.w * z;
	const H = img.h * z;
	const out = Buffer.alloc(W * H * 4);
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) {
			const s = (Math.floor(y / z) * img.w + Math.floor(x / z)) * 4;
			const a = img.rgba[s + 3] / 255;
			const o = (y * W + x) * 4;
			for (let k = 0; k < 3; k++) out[o + k] = Math.round(img.rgba[s + k] * a + bg[k] * (1 - a));
			out[o + 3] = 255;
		}
	return { w: W, h: H, rgba: out };
};
const save = (path, img) => {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, encodePng(img.w, img.h, img.rgba));
	console.log(path);
};

// ───────────────── 実行 ─────────────────

const args = process.argv.slice(2);
const opt = (name) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : null;
};
const ROOT = join(HERE, "..");
const out = resolve(opt("--out") ?? join(ROOT, "public/sprites/reisho_ushi.png"));
const srcPath = opt("--src");
const srcBuf =
	srcPath && existsSync(srcPath)
		? readFileSync(srcPath)
		: Buffer.from(await (await fetch(SRC_URL)).arrayBuffer());
const src = decodePng(srcBuf);
if (src.w !== CELL || src.h !== CELL) throw new Error(`16x16 ではありません: ${src.w}x${src.h}`);
const sheet = build(src);
save(out, sheet);

const preview = opt("--preview");
if (preview) save(resolve(preview), scaleOn(sheet, 8, [88, 120, 72]));
