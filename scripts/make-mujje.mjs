// ムッジェ ΣΩΩ> の 歩行グラ（32x64・16x16 が 2コマ×4方向）を 書き出す（node scripts/make-mujje.mjs）。
//
// ムッジェは 見た目が やきう民（彡(ﾟ)(ﾟ)。Σ の 髪・ΩΩ の 目・横顔の > の 鼻）に 似ていて、
// 毛むくじゃらの 毛は ムックが もと。なので 村の やきうの 歩行グラ（RPGEN「野球民」sa:4rSOzo）の 形を そのまま 使い、
// 黄色の 肌を 赤い 毛に 塗りかえ、ふちに 毛の 房を 足す（頭の まわり だけ。足もとは そのまま）。
//
//   node scripts/make-mujje.mjs                   … public/sprites/minors_mujje.png
//   node scripts/make-mujje.mjs --src 4rSOzo.png  … 元絵を 手元の ファイルから（無ければ CDN から 取る）
//
// 依存なし（zlib だけ）。

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_URL = "https://rpgen-search.pages.dev/data/images/sAnims/4rSOzo.png";
const OUT = join(HERE, "../public/sprites/minors_mujje.png");

const arg = (k) => {
	const i = process.argv.indexOf(k);
	return i >= 0 ? process.argv[i + 1] : undefined;
};

// ───── PNG（読む：8bit の RGBA・パレット。書く：RGBA） ─────

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

const decodePng = (buf) => {
	let pos = 8;
	let w = 0;
	let h = 0;
	let type = 0;
	let plte = null;
	let trns = null;
	const idat = [];
	while (pos < buf.length) {
		const len = buf.readUInt32BE(pos);
		const t = buf.toString("ascii", pos + 4, pos + 8);
		const d = buf.subarray(pos + 8, pos + 8 + len);
		if (t === "IHDR") {
			w = d.readUInt32BE(0);
			h = d.readUInt32BE(4);
			if (d[8] !== 8 || d[12] !== 0) throw new Error("8bit・非インターレースのみ");
			type = d[9];
		} else if (t === "PLTE") plte = d;
		else if (t === "tRNS") trns = d;
		else if (t === "IDAT") idat.push(d);
		pos += 12 + len;
	}
	const bpp = type === 6 ? 4 : type === 3 ? 1 : 0;
	if (!bpp) throw new Error(`colorType ${type} は 未対応`);
	const raw = inflateSync(Buffer.concat(idat));
	const stride = w * bpp;
	const px = Buffer.alloc(stride * h);
	for (let y = 0; y < h; y++) {
		const f = raw[y * (stride + 1)];
		const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
		for (let x = 0; x < stride; x++) {
			const a = x >= bpp ? px[y * stride + x - bpp] : 0;
			const b = y > 0 ? px[(y - 1) * stride + x] : 0;
			const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
			let v = line[x];
			if (f === 1) v += a;
			else if (f === 2) v += b;
			else if (f === 3) v += (a + b) >> 1;
			else if (f === 4) {
				const p = a + b - c;
				const pa = Math.abs(p - a);
				const pb = Math.abs(p - b);
				const pc = Math.abs(p - c);
				v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
			}
			px[y * stride + x] = v & 0xff;
		}
	}
	if (type === 6) return { w, h, rgba: px };
	const rgba = Buffer.alloc(w * h * 4);
	for (let i = 0; i < w * h; i++) {
		const k = px[i];
		rgba[i * 4] = plte[k * 3];
		rgba[i * 4 + 1] = plte[k * 3 + 1];
		rgba[i * 4 + 2] = plte[k * 3 + 2];
		rgba[i * 4 + 3] = trns && k < trns.length ? trns[k] : 255;
	}
	return { w, h, rgba };
};

// ───── 塗りかえ ─────

const hex = (s) => [
	Number.parseInt(s.slice(1, 3), 16),
	Number.parseInt(s.slice(3, 5), 16),
	Number.parseInt(s.slice(5, 7), 16),
];
const OUTLINE = hex("#3a0d0a");
const FUR = hex("#d8352a");
const FUR_DARK = hex("#9e1f17");
const FUR_LIGHT = hex("#f27a5e");
const HAIR = hex("#5a0f12");

const near = (c, r, g, b) =>
	Math.abs(c[0] - r) + Math.abs(c[1] - g) + Math.abs(c[2] - b) < 40;

/** 元の 1画素の 役（輪郭・肌・肌の 影・髪・目・白・無し）。 */
const role = (c) => {
	if (c[3] === 0) return "none";
	if (near(c, 133, 125, 56)) return "outline";
	if (near(c, 255, 206, 51)) return "skin";
	if (near(c, 225, 172, 5)) return "shade";
	if (near(c, 3, 3, 3)) return "hair";
	if (near(c, 245, 41, 41)) return "eye";
	return "other";
};

const src = arg("--src");
const buf = src
	? readFileSync(resolve(src))
	: Buffer.from(await (await fetch(SRC_URL)).arrayBuffer());
const { w, h, rgba } = decodePng(buf);
const at = (x, y) =>
	x < 0 || y < 0 || x >= w || y >= h
		? [0, 0, 0, 0]
		: [...rgba.subarray((y * w + x) * 4, (y * w + x) * 4 + 4)];
const out = Buffer.alloc(w * h * 4);
const put = (x, y, c) => {
	const i = (y * w + x) * 4;
	out[i] = c[0];
	out[i + 1] = c[1];
	out[i + 2] = c[2];
	out[i + 3] = 255;
};

for (let y = 0; y < h; y++)
	for (let x = 0; x < w; x++) {
		const r = role(at(x, y));
		if (r === "none") continue;
		// 毛の むら（斜めの 縞で 影と 照り）
		const fur = (x + 2 * y) % 9 === 0 ? FUR_DARK : (2 * x + y) % 11 === 0 ? FUR_LIGHT : FUR;
		const c =
			r === "outline"
				? OUTLINE
				: r === "skin"
					? fur
					: r === "shade"
						? FUR_DARK
						: r === "hair"
							? HAIR
							: r === "eye"
								? [20, 20, 20]
								: at(x, y);
		put(x, y, c);
	}

// 頭の ふちに 毛の 房（コマの 上 10行だけ。外がわの 空きに 輪郭を 1画素 はみ出させる）
for (let y = 0; y < h; y++)
	for (let x = 0; x < w; x++) {
		if (y % 16 >= 10 || out[(y * w + x) * 4 + 3]) continue;
		if ((x * 3 + y * 5) % 4) continue;
		const n = [
			[x, y + 1],
			[x + 1, y],
			[x - 1, y],
		].find(([a, b]) => role(at(a, b)) === "outline");
		// 同じ コマの 中だけ（となりの コマへ はみ出さない）
		if (n && Math.floor(n[0] / 16) === Math.floor(x / 16) && Math.floor(n[1] / 16) === Math.floor(y / 16))
			put(x, y, OUTLINE);
	}

writeFileSync(OUT, encodePng(w, h, out));
console.log(`wrote ${OUT}`);
