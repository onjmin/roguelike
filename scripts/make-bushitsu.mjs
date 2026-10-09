// 部室棟（data/village/bushitsu.ts）の 絵を 1枚に まとめて 書き出す（node scripts/make-bushitsu.mjs）。
//
//   public/sprites/bushitsu.png   … 部室棟の 中の 家具・はり紙・札・外観の 小物・別ゲーの 人（256x80）
//   src/data/bushitsuSheet.ts     … どの 絵が どこに あるか（BS。この スクリプトが 書く。手で 直さない）
//
// 絵の 出どころ:
//   - RPGEN（https://rpgen-search.pages.dev）の 素材を 作る ときに 取ってきて 貼る（遊ぶ ときは CDN を 見ない）：
//     黒板（落書き つき 3x2）・額の 絵・パレット・ラジオブースの 機械・卓上マイク・ラジカセ・ガラスの 仕切り・
//     パソコンと 机（2x2）・手洗い場、別ゲーの 名無し 5人・人狼部の 部長・キリコ（後ろ姿）・合唱部の 部長（歩行グラの 1コマ）。
//     作者の みなさんに 感謝。
//   - ここで 描く：ON AIR の ランプ（消・点）・エター札・キーボード・スピーカー・譜面台・下駄箱（2マス）・絵の具の しみ・
//     外の 落書き・外の 部員募集の ポスター・ボカロ一覧の 額（2マス）・部室の 札（5色）・イーゼル・校歌の 額・筐体・校札（縦長）、
//     合唱部の 部長の 顔色（青ざめる 2段）。
//
//   node scripts/make-bushitsu.mjs                    … 上の 2つを 書く（RPGEN の 絵は CDN から 取る）
//   node scripts/make-bushitsu.mjs --cache <dir>      … RPGEN の 絵を <dir>/sp/<id>.png・<dir>/sa/<id>.png から 読む（無ければ 取って 置く）
//   node scripts/make-bushitsu.mjs --out <dir>        … PNG と TS を <dir> に 書く（下見用。リポジトリを 書きかえない）
//
// 依存なし（zlib だけ）。乱数は 使わない（何度 書いても 同じ 絵）。
// 書き出す TS は biome の 整形どおり（pnpm lint を 通る 形。手で 整形しなおさない）。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

// ───────────────── PNG ─────────────────
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
/** 読み（非インターレースの 灰/灰α/パレット/RGB/RGBA。make-zero.mjs に 灰を 足した もの。RPGEN には 灰αの 絵も ある）。 */
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
	const chans = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
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
			} else if (ctype === 0 || ctype === 4) {
				const v = line[x * chans];
				rgba[o] = v;
				rgba[o + 1] = v;
				rgba[o + 2] = v;
				// 灰の tRNS は 2バイト（その 灰が 透明）
				rgba[o + 3] = ctype === 4 ? line[x * 2 + 1] : trns && trns.readUInt16BE(0) === v ? 0 : 255;
			} else if (ctype === 2) {
				line.copy(rgba, o, x * 3, x * 3 + 3);
				// RGB の tRNS は 6バイト（その 色が 透明。RPGEN の 絵に ある：黒を 透明に している）
				const key = trns && trns.length >= 6;
				const clear = key && trns.readUInt16BE(0) === rgba[o] && trns.readUInt16BE(2) === rgba[o + 1] && trns.readUInt16BE(4) === rgba[o + 2];
				rgba[o + 3] = clear ? 0 : 255;
			} else line.copy(rgba, o, x * 4, x * 4 + 4);
		}
	}
	return { w, h, rgba };
};

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argOf = (name) => {
	const i = argv.indexOf(name);
	return i >= 0 ? argv[i + 1] : null;
};
const OUT_DIR = argOf("--out");
const ROOT = join(HERE, ".."); // repo root when this file lives in scripts/
const PNG_OUT = OUT_DIR ? join(OUT_DIR, "bushitsu.png") : join(ROOT, "public/sprites/bushitsu.png");
const TS_OUT = OUT_DIR ? join(OUT_DIR, "bushitsuSheet.ts") : join(ROOT, "src/data/bushitsuSheet.ts");
const CACHE = argOf("--cache");
const CDN = "https://rpgen-search.pages.dev/data/images";

// ───────────────── 画素 ─────────────────
const hex = (s) => {
	const n = Number.parseInt(s.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
class Img {
	constructor(w, h) {
		this.w = w;
		this.h = h;
		this.d = Buffer.alloc(w * h * 4);
	}
	set(x, y, c, a = 255) {
		x = Math.floor(x);
		y = Math.floor(y);
		if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
		const o = (y * this.w + x) * 4;
		const col = typeof c === "string" ? hex(c) : c;
		if (a >= 255 || this.d[o + 3] === 0) {
			this.d[o] = col[0];
			this.d[o + 1] = col[1];
			this.d[o + 2] = col[2];
			this.d[o + 3] = a;
			return;
		}
		const t = a / 255;
		for (let k = 0; k < 3; k++) this.d[o + k] = Math.round(this.d[o + k] * (1 - t) + col[k] * t);
		this.d[o + 3] = Math.max(this.d[o + 3], a);
	}
	get(x, y) {
		const o = (y * this.w + x) * 4;
		return [this.d[o], this.d[o + 1], this.d[o + 2], this.d[o + 3]];
	}
	rect(x0, y0, x1, y1, c, a) {
		for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c, a);
	}
	frame(x0, y0, x1, y1, c) {
		for (let x = x0; x <= x1; x++) {
			this.set(x, y0, c);
			this.set(x, y1, c);
		}
		for (let y = y0; y <= y1; y++) {
			this.set(x0, y, c);
			this.set(x1, y, c);
		}
	}
	line(x0, y0, x1, y1, c) {
		const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
		for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
	}
	disc(cx, cy, r, c) {
		for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
			for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
				if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, c);
	}
	ring(cx, cy, r, c) {
		for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
			for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
				const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
				if (Math.abs(d - r) < 0.6) this.set(x, y, c);
			}
	}
	blit(src, sx, sy, w, h, dx, dy) {
		for (let y = 0; y < h; y++)
			for (let x = 0; x < w; x++) {
				const [r, g, b, a] = src.get(sx + x, sy + y);
				if (a) this.set(dx + x, dy + y, [r, g, b], a);
			}
	}
}

// ───────────────── RPGEN の 素材（作る ときだけ 取る） ─────────────────
const fetchPng = async (kind, id) => {
	const sub = kind === "sa" ? "sa" : "sp";
	const local = CACHE ? join(CACHE, sub, `${id}.png`) : null;
	if (local && existsSync(local)) return readFileSync(local);
	const url = `${CDN}/${kind === "sa" ? "sAnims" : "sprites"}/${id}.png`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url}: ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	if (local) {
		mkdirSync(dirname(local), { recursive: true });
		writeFileSync(local, buf);
	}
	return buf;
};
// CDN は 無い id にも 200 で 16x16 の「404」の 絵を 返す（取るたびに 色が ±1 ゆれる）。わざと 無い id を 1つ 取って、
// ほぼ 同じ 絵（どの 画素も 差が 8 以下）なら 止める。本物の 絵とは 200 近く ちがう
const MISSING = decodePng(await fetchPng("sp", "_missing_zzzzzzz")).rgba;
const looksMissing = (rgba) => rgba.length === MISSING.length && rgba.every((v, i) => Math.abs(v - MISSING[i]) <= 8);
const rpgen = async (ref) => {
	const [kind, id] = ref.split(":");
	const { w, h, rgba } = decodePng(await fetchPng(kind, id));
	if (looksMissing(rgba)) throw new Error(`${ref}: the CDN returned its "404" picture (asset gone?)`);
	// 歩行グラは 32x64、1マスの 絵は 16x16 の はず
	if (kind === "sa" && (w !== 32 || h !== 64)) throw new Error(`${ref}: ${w}x${h} is not a walk sheet`);
	if (kind === "sp" && (w !== 16 || h !== 16)) throw new Error(`${ref}: ${w}x${h}`);
	const img = new Img(w, h);
	rgba.copy(img.d);
	return img;
};

// ───────────────── アトラス ─────────────────
const atlas = new Img(256, 80);
const cells = {}; // name → [x, y, w, h] in px
const put = (name, col, row, w = 1, h = 1) => {
	cells[name] = [col * 16, row * 16, w * 16, h * 16];
	return [col * 16, row * 16];
};

// row 0: RPGEN 1x1
const PIECES = [
	["bbTL", "sp:kRaKfN"], // 黒板（左上）#332
	["bbTM", "sp:BUqj3l"], // 黒板（真ん中上）#331
	["bbTR", "sp:PEeN5M"], // 黒板（右上）#330
	["bbBL", "sp:n7Pqrw"], // 黒板（左下）#329
	["bbBM", "sp:Rbre6i"], // 黒板（真ん中下）#328
	["bbBR", "sp:sVa8kF"], // 黒板（右下）#327
	["painting", "sp:RVJ7eaf"], // 額縁
	["palette", "sp:oDZ9lBg"], // パレット
	["mixer", "sp:xNsToj3"], // ラジオブース機械2
	["mic", "sp:INA1vfE"], // 卓上マイク
	["boombox", "sp:qJ5Y3v0"], // ラジカセ
	["glass", "sp:bWPFZT7"], // ラジオブース仕切り1
	["pcTL", "sp:UQ8LJF"], // パソコンと机 左上 167#117
	["pcTR", "sp:VqTXqB"], // パソコンと机 右上 167#118
	["pcBL", "sp:AgZs0E"], // パソコンと机 左下 167#129
	["pcBR", "sp:lcBiHO"], // パソコンと机 右下 167#130
];
for (const [i, [name, ref]] of PIECES.entries()) {
	const src = await rpgen(ref);
	const [x, y] = put(name, i, 0);
	atlas.blit(src, 0, 0, 16, 16, x, y);
}
{
	const src = await rpgen("sp:K62t5mP"); // 蛇口（手洗い場）
	const [x, y] = put("sink", 0, 1);
	atlas.blit(src, 0, 0, 16, 16, x, y);
}

// row 1: 手描き 1x1
const draw1 = (name, col, row, fn) => {
	const [x, y] = put(name, col, row);
	const t = new Img(16, 16);
	fn(t);
	atlas.blit(t, 0, 0, 16, 16, x, y);
};
const lamp = (on) => (t) => {
	t.rect(7, 3, 8, 4, "#55555e");
	t.rect(3, 5, 12, 11, "#1e1e24");
	t.rect(4, 6, 11, 10, on ? "#e02828" : "#4a1818");
	if (on) {
		t.rect(4, 6, 11, 6, "#ff7a7a");
		for (const x of [5, 7, 9, 11]) t.set(x - 0.5, 8, "#ffffff");
		for (const x of [5, 6, 8, 10]) t.set(x, 9, "#ffd0d0");
		for (let x = 2; x <= 13; x++) {
			t.set(x, 4, "#ff5050", 90);
			t.set(x, 12, "#ff5050", 90);
		}
		for (let y = 5; y <= 11; y++) {
			t.set(2, y, "#ff5050", 90);
			t.set(13, y, "#ff5050", 90);
		}
	} else for (const x of [5, 7, 9]) t.set(x, 8, "#7a5a5a");
};
draw1("lampOff", 1, 1, lamp(false));
draw1("lampOn", 2, 1, lamp(true));
draw1("eta", 3, 1, (t) => {
	t.rect(3, 2, 12, 13, "#f4f2ea");
	t.frame(3, 2, 12, 13, "#b0a890");
	t.rect(6, 1, 9, 2, "#d8c070");
	for (const y of [4, 6]) t.rect(5, y, 10, y, "#8a8478");
	t.ring(8, 10, 2.5, "#d02020");
	t.set(8, 10, "#d02020");
});
draw1("synth", 4, 1, (t) => {
	t.line(4, 15, 7, 12, "#303030");
	t.line(11, 15, 8, 12, "#303030");
	t.rect(1, 6, 14, 11, "#202028");
	t.rect(2, 8, 13, 10, "#f0f0f0");
	for (let x = 3; x <= 13; x += 2) t.rect(x, 8, x, 10, "#a0a0a8");
	for (const x of [3, 5, 9, 11, 13]) t.rect(x, 8, x, 9, "#101010");
	t.rect(2, 7, 4, 7, "#40c0e0");
});
draw1("speaker", 5, 1, (t) => {
	t.rect(3, 1, 12, 15, "#2a2a30");
	t.frame(3, 1, 12, 15, "#18181c");
	t.disc(7.5, 4.5, 2, "#5a5a62");
	t.set(7.5, 4.5, "#9a9aa2");
	t.disc(7.5, 10.5, 3.5, "#3e3e46");
	t.ring(7.5, 10.5, 3.5, "#74747c");
	t.disc(7.5, 10.5, 1, "#a0a0a8");
});
draw1("fumendai", 6, 1, (t) => {
	t.rect(7, 8, 8, 14, "#202020");
	t.line(7, 14, 4, 15, "#202020");
	t.line(8, 14, 11, 15, "#202020");
	t.rect(2, 1, 13, 8, "#303030");
	t.rect(3, 2, 12, 7, "#f8f8f0");
	for (const y of [3, 5, 7]) t.rect(3, y, 12, y, "#909090");
	for (const [x, y] of [[5, 4], [8, 3], [10, 6]]) t.rect(x, y, x + 1, y, "#202020");
});
const geta = (side) => (t) => {
	t.rect(0, 2, 15, 15, "#8a5a30");
	t.rect(0, 2, 15, 2, "#5a3a1a");
	t.rect(0, 15, 15, 15, "#5a3a1a");
	t.rect(side ? 15 : 0, 2, side ? 15 : 0, 15, "#5a3a1a");
	// 3 列 × 3 段の 棚。外ばきの 靴が 左右 あわせて 7足（部が 7つ、部員は 1人ずつ。中では 上ばき）
	const shoes = side
		? [[0, 0, "#202020"], [2, 1, "#3050a0"], [1, 2, "#5a3a20"]]
		: [[0, 0, "#5a3a20"], [1, 0, "#e8e8e0"], [2, 1, "#202020"], [0, 2, "#8a2a20"]];
	for (let r = 0; r < 3; r++)
		for (let c = 0; c < 3; c++) {
			const x = 1 + c * 5;
			const y = 4 + r * 4;
			t.rect(x, y, x + 3, y + 2, "#3a2a1a");
			const s = shoes.find(([sc, sr]) => sc === c && sr === r);
			if (s) {
				// 左右 2つの 靴（2x2）と 底の 線
				t.rect(x, y + 1, x + 1, y + 2, s[2]);
				t.rect(x + 2, y + 1, x + 3, y + 2, s[2]);
				t.rect(x, y + 2, x + 3, y + 2, s[2] === "#e8e8e0" ? "#a0a0a0" : "#d8d4c8");
				t.set(x, y + 1, "#ffffff", 90);
				t.set(x + 2, y + 1, "#ffffff", 90);
			}
		}
};
draw1("getaL", 7, 1, geta(false));
draw1("getaR", 8, 1, geta(true));
draw1("paint", 9, 1, (t) => {
	for (const [x, y, c] of [[3, 3, "#e04040"], [10, 5, "#4060e0"], [6, 11, "#f0d020"], [12, 12, "#40b040"], [2, 9, "#4060e0"]]) {
		t.rect(x, y, x + 1, y + 1, c, 200);
		t.set(x + 2, y + 1, c, 140);
	}
});
draw1("graffiti", 10, 1, (t) => {
	t.line(2, 6, 5, 4, "#d03030");
	t.line(5, 4, 5, 9, "#d03030");
	t.line(7, 5, 9, 5, "#d03030");
	t.line(8, 4, 8, 9, "#d03030");
	t.line(11, 4, 13, 8, "#d03030");
	t.line(3, 11, 13, 12, "#3050c0");
	t.line(4, 13, 7, 12, "#3050c0");
});
draw1("posterOut", 11, 1, (t) => {
	t.rect(2, 1, 13, 14, "#f8f0d8");
	t.frame(2, 1, 13, 14, "#c0a060");
	t.rect(3, 2, 12, 4, "#e04040");
	for (const y of [6, 8, 10]) t.rect(4, y, 11, y, "#606060");
	t.rect(4, 12, 7, 12, "#606060");
});
// ボカロ一覧の 額（2マス）
{
	const [x, y] = put("roster", 12, 1, 2, 1);
	const t = new Img(32, 16);
	t.rect(0, 1, 31, 14, "#c8a040");
	t.frame(0, 1, 31, 14, "#8a6a20");
	t.rect(2, 3, 29, 12, "#f4eedc");
	t.rect(6, 4, 25, 4, "#d050a0");
	const dash = [[7, 5], [9, 6], [6, 4], [8, 5], [7, 6], [9, 4]];
	for (let i = 0; i < 6; i++) {
		const col = i % 2;
		const row = Math.floor(i / 2);
		const lx = 4 + col * 13;
		const ly = 6 + row * 2;
		t.set(lx, ly, "#e080a0");
		t.rect(lx + 2, ly, lx + 2 + dash[i][0], ly, "#404040");
	}
	atlas.blit(t, 0, 0, 32, 16, x, y);
}
// row 2: 部室の 札（5色）＋ 別ゲーの 人
const PLATE = {
	plateJinro: "#c03030",
	plateOekaki: "#e08020",
	plateHoso: "#3060c0",
	plateVoca: "#d050a0",
	plateGame: "#30a050",
};
for (const [i, [name, color]] of Object.entries(PLATE).entries())
	draw1(name, i, 2, (t) => {
		t.line(4, 1, 4, 3, "#606060");
		t.line(11, 1, 11, 3, "#606060");
		t.rect(2, 3, 13, 9, "#f4f4f0");
		t.frame(2, 3, 13, 9, "#707070");
		t.rect(3, 4, 4, 8, color);
		t.rect(6, 5, 12, 5, "#303030");
		t.rect(6, 7, 10, 7, "#303030");
	});
/** 歩行グラの 1コマ（row: 0 上・1 右・2 下・3 左）。 */
const frame = async (ref, row, col, name, atCol, atRow) => {
	const src = await rpgen(ref);
	const [x, y] = put(name, atCol, atRow);
	atlas.blit(src, 0, row * 16, 16, 16, x, y);
	return [x, y];
};
const NANASHI = ["sa:xjuotB", "sa:qPN3cT", "sa:C2hS8U", "sa:VaBXqn", "sa:8DXRgk"];
for (const [i, ref] of NANASHI.entries()) await frame(ref, 2, 0, `nanashi${i}`, 5 + i, 2);
await frame("sa:vHsmy5", 0, 0, "kirikoBack", 10, 2); // キリコ（後ろ姿）
const [gx, gy] = await frame("sa:EZnhBf", 2, 0, "gassho0", 11, 2); // 合唱部の 部長（RPGEN「indigo男」）
// 顔色：はだの 色（この 歩行グラは #faa6c2・#fba7c3 の 2色）だけ 青ざめた 色に かえる（息が 細る）
const SKIN = new Set(["faa6c2", "fba7c3"]);
let skinPx = 0;
for (const [k, tint] of [[1, "#ece4ee"], [2, "#c4d0ec"]]) {
	const [x, y] = put(`gassho${k}`, 11 + k, 2);
	for (let yy = 0; yy < 16; yy++)
		for (let xx = 0; xx < 16; xx++) {
			const [r, g, b, a] = atlas.get(gx + xx, gy + yy);
			if (!a) continue;
			const isSkin = SKIN.has([r, g, b].map((v) => v.toString(16).padStart(2, "0")).join(""));
			if (isSkin) skinPx++;
			atlas.set(x + xx, y + yy, isSkin ? tint : [r, g, b], a);
		}
}
if (skinPx < 20) throw new Error(`gassho: only ${skinPx} skin pixels recoloured (sheet changed?)`);
await frame("sa:TvO1jb", 2, 0, "bucho", 14, 2); // 人狼部の 部長（ワードウルフの まん中の 席）
// rows 3-4: 縦長（16x32）
const draw2 = (name, col, fn) => {
	const [x, y] = put(name, col, 3, 1, 2);
	const t = new Img(16, 32);
	fn(t);
	atlas.blit(t, 0, 0, 16, 32, x, y);
};
draw2("easel", 0, (t) => {
	t.line(7, 10, 7, 31, "#6a4020");
	t.line(3, 31, 6, 5, "#8a5a30");
	t.line(12, 31, 9, 5, "#8a5a30");
	t.rect(2, 4, 13, 17, "#f8f8f0");
	t.frame(2, 4, 13, 17, "#c0b090");
	t.ring(6, 9, 2, "#f0c020");
	t.line(9, 8, 12, 12, "#4060e0");
	t.line(4, 14, 11, 14, "#40a040");
	t.rect(1, 18, 14, 19, "#7a4a20");
});
draw2("kouka", 1, (t) => {
	t.line(5, 0, 8, 2, "#606060");
	t.line(10, 0, 7, 2, "#606060");
	t.rect(1, 2, 14, 29, "#c8a040");
	t.frame(1, 2, 14, 29, "#8a6a20");
	t.rect(3, 4, 12, 27, "#f4eedc");
	// 縦書きの 字（右から 左へ。いちばん 右が 題）
	const cols = [[11, 5, 22], [9, 7, 24], [7, 7, 20], [5, 7, 23]];
	for (const [x, y0, y1] of cols) for (let y = y0; y <= y1; y += 2) t.rect(x, y, x, y, "#404040");
	t.rect(4, 25, 5, 26, "#c02020");
});
draw2("cabinet", 2, (t) => {
	t.rect(2, 4, 13, 31, "#3a3a5a");
	t.rect(2, 4, 3, 31, "#2a2a44");
	t.rect(12, 4, 13, 31, "#2a2a44");
	t.rect(2, 4, 13, 7, "#e0c040");
	for (const x of [4, 6, 8, 10]) t.set(x, 5, "#5a4010");
	t.rect(4, 9, 11, 16, "#101020");
	t.rect(5, 14, 8, 14, "#40e060");
	t.rect(9, 14, 10, 14, "#205030");
	t.rect(2, 18, 13, 20, "#5a5a7a");
	t.rect(5, 16, 5, 18, "#202020");
	t.disc(5, 16, 1, "#e03030");
	t.set(9, 19, "#f0d020");
	t.set(11, 19, "#30a0e0");
	t.rect(6, 24, 9, 27, "#20203a");
	t.rect(7, 25, 8, 25, "#c0c0c0");
});
draw2("kosatsu", 3, (t) => {
	t.rect(4, 1, 11, 30, "#b89060");
	t.frame(4, 1, 11, 30, "#6a4a2a");
	for (let y = 4; y <= 27; y += 3) t.rect(7, y, 8, y + 1, "#202020");
	t.set(5, 2, "#808080");
	t.set(10, 29, "#808080");
});

mkdirSync(dirname(PNG_OUT), { recursive: true });
writeFileSync(PNG_OUT, encodePng(atlas.w, atlas.h, atlas.d));
const ts = `// scripts/make-bushitsu.mjs が 書き出す（手で 書きかえない）。部室棟の 絵（public/sprites/bushitsu.png）の 場所。
export const BS_IMG = "pub:sprites/bushitsu.png";
export const BS_SIZE = [${atlas.w}, ${atlas.h}] as const;
/** 絵の 名前 → [x, y, w, h]（画素）。 */
export const BS_CELLS = {
${Object.entries(cells)
	.map(([k, v]) => `\t${k}: [${v.join(", ")}],`)
	.join("\n")}
} as const;
export type BsName = keyof typeof BS_CELLS;
/** 絵の 参照（pub:…#x,y,w,h。縦長は 下端そろえで 上の マスへ はみ出す）。 */
export const bs = (name: BsName): string =>
	\`\${BS_IMG}#\${BS_CELLS[name].join(",")}\`;
/** 幅の ある 絵の (col, row) の 1マス（16x16。ボカロ一覧の 額など）。 */
export const bsCell = (name: BsName, col: number, row = 0): string => {
	const [x, y] = BS_CELLS[name];
	return \`\${BS_IMG}#\${x + col * 16},\${y + row * 16},16,16\`;
};
`;
mkdirSync(dirname(TS_OUT), { recursive: true });
writeFileSync(TS_OUT, ts);
console.log(`wrote ${PNG_OUT} (${atlas.w}x${atlas.h}) and ${TS_OUT} (${Object.keys(cells).length} cells)`);
