// 解音ゼロの サブ機ちがいの 歩行グラ（32x64・16x16 が 2コマ×4方向）を書き出す（node scripts/make-zero.mjs）。
//
// 解音ゼロは 3体いる（公式サイト https://zero-tokine-test.my.canva.site/ の「解音ゼロとは？」）。
//   VHz8-0（通称 メインさん） … メイン機。話に 出てくる ゼロ（data/cast.ts の zero）。
//   HeBc-0（通称 プロト）     … サブ機。RPGEN「解音ゼロ - HeBc-0（通称: プロト）」（sa:KxS5YZ・作者の 手描き）を そのまま 使う。
//   XQxS-0（通称 レン）       … サブ機。
// メインさん・レンの 歩行グラは RPGEN に 無いので、プロトの 絵（形・顔・足の 運び）を 元に、ちがう 所だけ 塗りかえる。
//   メインさん … 帯を 赤に（公式の 手描きの 赤い 帯）、目を 紫に、背中から 赤い ケーブルの しっぽ。
//   レン       … 髪の 先を 青の グラデに、角（アンテナ）を 金に、帯の ふちを 金に、手袋と 脚の よろいと 靴を 黒に、目を 青に。
//
//   node scripts/make-zero.mjs                       … public/sprites/zero_main.png・zero_ren.png
//   node scripts/make-zero.mjs --src KxS5YZ.png      … 元絵を 手元の ファイルから（無ければ CDN から 取る）
//   node scripts/make-zero.mjs --compare out.png     … プロト・メインさん・レンを 8倍で 並べた 見くらべ用
//
// 依存なし（zlib だけ）。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_URL = "https://rpgen-search.pages.dev/data/images/sAnims/KxS5YZ.png";

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
//
// プロトの 14色に 名前を つけて、1文字で 扱う（下の 表の 左が 元の 色）。
// 行は 上から 背中・右・正面・左（ART_TODO.md と 同じ）、1行に 2コマ。

const hex = (s) => {
	const n = Number.parseInt(s.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const KEY = {
	"#daa98a": "a", // 髪の かげ
	"#fef3df": "b", // 髪
	"#e5cca0": "h", // 髪の なか
	"#c3cde1": "c", // 着物・アンテナの かげ（水色）
	"#1f4f87": "d", // ふち・帯（紺）
	"#fefeff": "e", // 着物（白）
	"#000000": "f", // ふち・目・帯の へり（黒）
	"#2574ba": "g", // アンテナ・靴（青）
	"#eebfb3": "i", // はだ
	"#fef4f1": "j", // はだ（明）
	"#cea6a0": "k", // はだ（暗）
	"#975649": "l", // 目
	"#d68471": "m", // ほお
	"#b98d7b": "n", // まぶた
};
const CELL = 16;
const DIRS = ["up", "right", "down", "left"];

const toGrid = (src) => {
	const g = [];
	for (let y = 0; y < src.h; y++) {
		const row = [];
		for (let x = 0; x < src.w; x++) {
			const i = (y * src.w + x) * 4;
			if (src.rgba[i + 3] < 128) {
				row.push(".");
				continue;
			}
			const h = `#${[...src.rgba.subarray(i, i + 3)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
			if (!KEY[h]) throw new Error(`知らない 色 ${h}（${x},${y}）。元絵が 変わった？`);
			row.push(KEY[h]);
		}
		g.push(row);
	}
	return g;
};
const BASE = Object.fromEntries(Object.entries(KEY).map(([h, k]) => [k, hex(h)]));

/** 帯（1行の「黒 紺… 黒」の 並び）の 位置。[y, x0, x1]（x0・x1 は 両はしの 黒）。 */
const obiRuns = (g) => {
	const out = [];
	for (let y = 0; y < g.length; y++) {
		const s = g[y].join("");
		for (const m of s.matchAll(/fd+f/g)) {
			// コマを またがない
			if (Math.floor(m.index / CELL) !== Math.floor((m.index + m[0].length - 1) / CELL)) continue;
			out.push([y, m.index, m.index + m[0].length - 1]);
		}
	}
	return out;
};

/**
 * 1体ぶんの 塗りかえ。
 * recolor(ch, lx, ly, dir) … 元の 文字と コマの 中の 位置から 色（#rrggbb）か 文字を 返す（undefined なら そのまま）。
 * obi … 帯の 紺 と へりの 黒 の 色。
 * add … 足す 点（コマの 中の [lx, ly]）を 向き・コマごとに。
 */
const make = (grid, { palette, recolor, obi, add }) => {
	const w = grid[0].length;
	const h = grid.length;
	const col = grid.map((row) => row.map((ch) => (ch === "." ? null : BASE[ch])));
	const pick = (v) => (v in palette ? hex(palette[v]) : v.startsWith("#") ? hex(v) : BASE[v]);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const ch = grid[y][x];
			if (ch === ".") continue;
			const v = recolor?.(ch, x % CELL, y % CELL, DIRS[Math.floor(y / CELL)]);
			if (v) col[y][x] = pick(v);
			else if (ch in palette) col[y][x] = hex(palette[ch]);
		}
	if (obi)
		for (const [y, x0, x1] of obiRuns(grid))
			for (let x = x0; x <= x1; x++) col[y][x] = hex(x === x0 || x === x1 ? obi.edge : obi.band);
	for (const [dir, frames] of Object.entries(add ?? {}))
		frames.forEach((dots, f) => {
			const oy = DIRS.indexOf(dir) * CELL;
			const ox = f * CELL;
			for (const [lx, ly, c] of dots) col[oy + ly][ox + lx] = pick(c);
		});
	const rgba = Buffer.alloc(w * h * 4);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const c = col[y][x];
			if (!c) continue;
			rgba.set([...c, 255], (y * w + x) * 4);
		}
	return { w, h, rgba };
};

const HAIR = new Set(["a", "b", "h"]);

const VARIANTS = {
	// VHz8-0（メインさん）：公式の 手描き（人力出力版）の 赤い 帯・赤い ケーブルの しっぽ・赤紫の 目。
	main: {
		palette: { l: "#8e3a7e", R: "#d02838", r: "#7c1422", P: "#e8e8ee" },
		obi: { band: "#d02838", edge: "#7c1422" },
		// しっぽ（赤い ケーブル）：背中から 出て 下へ たれる。先に 白い プラグ。コマ2は 1px ゆれる
		add: {
			up: [
				[[12, 12, "R"], [13, 13, "R"], [13, 14, "r"], [14, 15, "P"]],
				[[12, 12, "R"], [13, 13, "R"], [14, 14, "r"], [14, 15, "P"]],
			],
			right: [
				[[2, 13, "R"], [1, 14, "R"], [1, 15, "P"]],
				[[1, 13, "R"], [0, 14, "R"], [0, 15, "P"]],
			],
			down: [
				[[12, 12, "R"], [13, 13, "R"], [14, 14, "P"]],
				[[13, 12, "R"], [14, 13, "R"], [15, 14, "P"]],
			],
			left: [
				[[13, 13, "R"], [14, 14, "R"], [14, 15, "P"]],
				[[14, 13, "R"], [15, 14, "R"], [15, 15, "P"]],
			],
		},
	},
	// XQxS-0（レン）：公式の 絵（ステージの 子）の 先が 青い 金髪・金の 角・黒い 手袋と 脚の よろい・青い 目。
	ren: {
		palette: {
			l: "#2a64c8",
			A: "#2d5f9e", // 髪の 先（かげ）
			H: "#4f8fd0",
			B: "#9fd0f2",
			G: "#e0b040", // 金
			Y: "#f6dc80",
			O: "#8a5a18",
			K: "#2a2a34", // 黒い よろい
			N: "#50505e",
		},
		recolor: (ch, lx, ly, dir) => {
			// 角（アンテナ）を 金に
			if (ly <= 2 && !HAIR.has(ch)) return { c: "G", e: "Y", g: "O", d: "O" }[ch];
			// 髪は 下ほど 青く
			if (HAIR.has(ch) && ly >= 10) return { a: "A", h: "H", b: "B" }[ch];
			if (HAIR.has(ch) && ly === 9) return { a: "H", h: "B" }[ch];
			// 手袋（横の はしの はだ）
			if (ly >= 8 && ly <= 11 && (ch === "i" || ch === "k") && (lx <= 4 || lx >= 11) && dir !== "up") return "K";
			// 脚の よろいと 靴
			if (ly >= 13 && (ch === "c" || ch === "k")) return "N";
			if (ly >= 14 && ch === "g") return "K";
			return undefined;
		},
		obi: { band: "#1f4f87", edge: "#e0b040" },
	},
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
const hcat = (imgs, gap, bg) => {
	const W = imgs.reduce((s, i) => s + i.w, 0) + gap * (imgs.length - 1);
	const H = Math.max(...imgs.map((i) => i.h));
	const out = Buffer.alloc(W * H * 4);
	for (let i = 0; i < W * H; i++) out.set([...bg, 255], i * 4);
	let ox = 0;
	for (const im of imgs) {
		for (let y = 0; y < im.h; y++) im.rgba.copy(out, (y * W + ox) * 4, y * im.w * 4, (y + 1) * im.w * 4);
		ox += im.w + gap;
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
const srcPath = opt("--src");
const srcBuf =
	srcPath && existsSync(srcPath)
		? readFileSync(srcPath)
		: Buffer.from(await (await fetch(SRC_URL)).arrayBuffer());
const src = decodePng(srcBuf);
if (src.w !== 32 || src.h !== 64) throw new Error(`32x64 ではありません: ${src.w}x${src.h}`);
const grid = toGrid(src);
const out = {};
for (const [id, v] of Object.entries(VARIANTS)) {
	out[id] = make(grid, v);
	save(join(ROOT, `public/sprites/zero_${id}.png`), out[id]);
}
const compare = opt("--compare");
if (compare) {
	const GREEN = [88, 120, 72];
	save(resolve(compare), hcat([src, out.main, out.ren].map((i) => scaleOn(i, 8, GREEN)), 16, GREEN));
}
