// 風呂キャンセル界隈の歩行グラ（32x64・16x16 が 2コマ×4方向）を書き出す（node scripts/make-furocan.mjs）。
//
// 元は RPGEN の歩行グラ「とうすこ民（泥版）」（sa:kH6KHd・no.556。黄色い 体・黒い目・オレンジの くちばしの 3色）。
// 形は そのまま、風呂に 入っていない 感じを 足す（こわく ならない ように マイルドに）：
//   - 黄色を くすませ、下へ いくほど 少し 暗く（ほこり）
//   - 体に 茶色い しみを 決まった 位置に 散らす（乱数は 使わない。毎回 同じ 絵に なる）
//   - 頭の 上の あいた ところに うすい 緑の におい線。2コマ目は 1ドット ずらして ゆらす
//
//   node scripts/make-furocan.mjs                          … public/sprites/furocan.png
//   node scripts/make-furocan.mjs --src kH6KHd.png         … 元絵を手元のファイルから（無ければ CDN から取る）
//   node scripts/make-furocan.mjs --out a.png --preview b.png
//
// 依存なし（zlib だけ）。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_URL = "https://rpgen-search.pages.dev/data/images/sAnims/kH6KHd.png";

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


// ───────────────── 塗りかえ ─────────────────

const CELL = 16;

const hex = (s) => {
	const n = Number.parseInt(s.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// くすんだ 黄色（上 → 下）。元の #ffd21f を 灰色がかった 黄土に
const BODY = ["#e2c35e", "#d8b857", "#c9aa50"].map(hex);
const STAIN = hex("#a88a4a"); // しみ
const BEAK = hex("#d98a45"); // くちばし（元の #fc851d を くすませる）
const STINK = hex("#a9d67a"); // におい線（うすい 緑）

// 元絵の 色の 見分け（黄 #ffd21f・黒・オレンジ #fc851d の 3色）
const kind = (r, g, b) => {
	if (r < 60 && g < 60 && b < 60) return "eye";
	if (g < 170) return "beak";
	return "body";
};

// しみの 位置（コマの 中の 座標。体の 上に あるときだけ 塗る）
const STAINS = [
	[4, 12],
	[10, 13],
	[12, 9],
	[3, 9],
	[7, 14],
];

// におい線（コマの 中の 座標）。左右に 1本ずつ、2コマ目は 1ドット 上へ
const WAVE = [
	[0, 0],
	[1, 1],
	[0, 2],
];
const STINK_AT = [
	[1, 1],
	[13, 1],
];

const furocan = (src) => {
	const { w, h } = src;
	const out = Buffer.from(src.rgba);
	const at = (x, y) => (y * w + x) * 4;
	const opaque = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src.rgba[at(x, y) + 3] > 127;
	const paint = (x, y, c) => {
		const i = at(x, y);
		out[i] = c[0];
		out[i + 1] = c[1];
		out[i + 2] = c[2];
		out[i + 3] = 255;
	};
	for (let cy = 0; cy < h; cy += CELL)
		for (let cx = 0; cx < w; cx += CELL) {
			// 体の 色
			for (let y = cy; y < cy + CELL; y++)
				for (let x = cx; x < cx + CELL; x++) {
					if (!opaque(x, y)) continue;
					const i = at(x, y);
					const k = kind(src.rgba[i], src.rgba[i + 1], src.rgba[i + 2]);
					if (k === "beak") paint(x, y, BEAK);
					else if (k === "body") paint(x, y, BODY[Math.min(2, Math.floor(((y - cy) * 3) / CELL))]);
				}
			// しみ（体の 上だけ。目・くちばしの となりは 避ける）
			for (const [sx, sy] of STAINS) {
				const x = cx + sx;
				const y = cy + sy;
				if (!opaque(x, y)) continue;
				const i = at(x, y);
				if (kind(src.rgba[i], src.rgba[i + 1], src.rgba[i + 2]) !== "body") continue;
				paint(x, y, STAIN);
			}
			// におい線（あいている ところだけ。2コマ目は 1ドット 上へ）
			const lift = cx === 0 ? 0 : -1;
			for (const [bx, by] of STINK_AT)
				for (const [dx, dy] of WAVE) {
					const x = cx + bx + dx;
					const y = cy + by + dy + lift;
					if (y < cy || opaque(x, y)) continue;
					paint(x, y, STINK);
				}
		}
	return { w, h, rgba: out };
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
const out = resolve(opt("--out") ?? join(ROOT, "public/sprites/furocan.png"));
const srcPath = opt("--src");
const srcBuf =
	srcPath && existsSync(srcPath)
		? readFileSync(srcPath)
		: Buffer.from(await (await fetch(SRC_URL)).arrayBuffer());
const src = decodePng(srcBuf);
if (src.w !== 32 || src.h !== 64) throw new Error(`32x64 ではありません: ${src.w}x${src.h}`);
const sheet = furocan(src);
save(out, sheet);

const preview = opt("--preview");
if (preview) save(resolve(preview), scaleOn(sheet, 8, [88, 120, 72]));
