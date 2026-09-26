// 名前に 絵が 合っていなかった 敵 5体の 歩行グラ（32x64・16x16 が 2コマ×4方向。行は 上・右・下・左）を書き出す
// （node scripts/make-enemies.mjs）。
//
//   釣り（tsuri.png）         … 顔の ある 赤白の 浮きと、下に 釣り針。2コマ目は 1ドット 沈む（アタリ）
//   粘着アンチ（nenchaku.png） … むらさきの ねばねば。怒り眉。2コマ目は つぶれて、しずくが のびる
//   連投荒らし（rento.png）   … 怒った 顔の ふきだし。うしろに うすい 残像。2コマ目は 残像が ずれる
//   凍結アカ（touketsu.png）   … 氷の かたまりに とじこめられた、初期アイコンの 人がた。2コマ目は 光が 動く
//   炎上案件（enjo.png）       … RPGEN の「ばくだん」（sa:0fhT0t）の 下から 炎が 立つ。2コマ目は 炎が ゆれる
//
// 右・左は 顔を その向きへ 1ドット 寄せる。上（背中）は 顔なし。乱数は 使わない（毎回 同じ 絵）。
//
//   node scripts/make-enemies.mjs                          … public/sprites/ に 5枚
//   node scripts/make-enemies.mjs --out dir --preview dir2 … 別の 場所へ（プレビューは 8倍）
//
// 依存なし（zlib だけ）。

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";
const HERE = dirname(fileURLToPath(import.meta.url));
const BOMB_URL = "https://rpgen-search.pages.dev/data/images/sAnims/0fhT0t.png";

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

// ───────────────── 描く 道具 ─────────────────

const hex = (s, a = 255) => [...[1, 3, 5].map((i) => Number.parseInt(s.slice(i, i + 2), 16)), a];
const INK = hex("#2b2f48");
const EYE = hex("#1c1d2b");
const DIRS = ["up", "right", "down", "left"];
const shiftOf = (dir) => (dir === "right" ? 1 : dir === "left" ? -1 : 0);

/** 32x64 の 絵。put は コマ（col, row）の 中の 1ドット。半透明は 下と まぜる。 */
const sheet = () => {
	const w = 32;
	const h = 64;
	const rgba = Buffer.alloc(w * h * 4);
	const put = (col, row, x, y, c) => {
		if (!c || x < 0 || x > 15 || y < 0 || y > 15) return;
		const o = ((row * 16 + y) * w + col * 16 + x) * 4;
		const a = c[3] / 255;
		const b = rgba[o + 3] / 255;
		const out = a + b * (1 - a);
		for (let k = 0; k < 3; k++)
			rgba[o + k] = out ? Math.round((c[k] * a + rgba[o + k] * b * (1 - a)) / out) : 0;
		rgba[o + 3] = Math.round(out * 255);
	};
	return { w, h, rgba, put };
};

/** 形（inside(x, y)）を 塗る。外と となりあう ドットは ふち（edge）、中は fill(x, y)。 */
const shape = (put, col, row, inside, fill, edge = INK) => {
	for (let y = 0; y < 16; y++)
		for (let x = 0; x < 16; x++) {
			if (!inside(x, y)) continue;
			const rim = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
			put(col, row, x, y, rim ? edge : fill(x, y));
		}
};
const ellipse = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/**
 * 怒った 顔（つり目・への字の 口）。ex は 左目の x。眉は 描かない（小さい ふきだしでは 目と くっついて 縦線に 見える）：
 * 目の 上の へりを 内がわへ 下げて、にらんで いる ように 見せる。
 */
const angryFace = (put, col, row, ex, ey) => {
	for (const [x, y] of [
		[ex, ey],
		[ex, ey + 1],
		[ex + 1, ey + 1],
		[ex + 5, ey],
		[ex + 5, ey + 1],
		[ex + 4, ey + 1],
		[ex + 1, ey + 4],
		[ex + 2, ey + 3],
		[ex + 3, ey + 3],
		[ex + 4, ey + 4],
	])
		put(col, row, x, y, EYE);
};

// ───────────────── 釣り：顔の ある 浮きと 釣り針 ─────────────────

const TSURI_RED = hex("#e0463c");
const TSURI_RED_LIGHT = hex("#ff8a78");
const TSURI_WHITE = hex("#f7f6ef");
const TSURI_SHADE = hex("#d6d4cc");
const LINE = hex("#c9d2e0");
const STEEL = hex("#9aa3b5");

const tsuri = () => {
	const img = sheet();
	DIRS.forEach((dir, row) => {
		for (const col of [0, 1]) {
			const put = img.put;
			const dy = col; // 2コマ目は 沈む
			for (let y = 0; y <= 2 + dy; y++) put(col, row, 8, y, LINE);
			// 浮きの 先（赤い 棒）
			shape(put, col, row, (x, y) => x >= 7 && x <= 9 && y >= 2 + dy && y <= 5 + dy, () => TSURI_RED);
			// 浮きの 体：上が 赤、下が 白
			const mid = 8 + dy;
			shape(put, col, row, ellipse(8, 8.5 + dy, 5.6, 4.6), (x, y) =>
				y < mid
					? x === 5 && y === mid - 3
						? TSURI_RED_LIGHT
						: TSURI_RED
					: y >= mid + 3
						? TSURI_SHADE
						: TSURI_WHITE,
			);
			// 釣り針（J の 形）
			for (const [x, y] of [
				[8, 13],
				[8, 14],
				[8, 15],
				[7, 15],
				[6, 15],
				[6, 14],
			])
				put(col, row, x, Math.min(15, y + dy), STEEL);
			if (dir === "up") continue;
			const ex = 6 + shiftOf(dir);
			for (const x of [ex, ex + 4]) {
				put(col, row, x, mid, EYE);
				put(col, row, x, mid + 1, EYE);
			}
			put(col, row, ex + 2, mid + 2, EYE);
		}
	});
	return img;
};

// ───────────────── 粘着アンチ：むらさきの ねばねば ─────────────────

const GOO = hex("#8a4fc4");
const GOO_DARK = hex("#6a3499");
const GOO_LIGHT = hex("#c08cf0");
const GOO_WHITE = hex("#f7f6ef");

const nenchaku = () => {
	const img = sheet();
	DIRS.forEach((dir, row) => {
		for (const col of [0, 1]) {
			const put = img.put;
			const squish = col; // 2コマ目は 横へ つぶれる
			const body = ellipse(8, 9.5, 6.6 + squish * 0.6, 6.2 - squish * 0.8);
			const inside = (x, y) => y <= 14 && body(x, y);
			shape(put, col, row, inside, (x, y) =>
				(x === 4 && y === 6 + squish) || (x === 5 && y === 5 + squish)
					? GOO_LIGHT
					: y >= 13
						? GOO_DARK
						: GOO,
			);
			// したたる しずく（2コマ目は のびる）
			for (const [x, len] of [
				[4, 1 + squish],
				[11, 2 - squish],
			])
				for (let k = 1; k <= len; k++) put(col, row, x, 14 + k, GOO_DARK);
			if (dir === "up") continue;
			// にらむ 目（白目が ないと むらさきに 埋もれる）・つり眉・への字の 口
			const ex = 5 + shiftOf(dir);
			const ey = 8 + squish;
			for (const x of [ex, ex + 1, ex + 4, ex + 5])
				for (const y of [ey, ey + 1]) put(col, row, x, y, GOO_WHITE);
			put(col, row, ex + 1, ey + 1, EYE);
			put(col, row, ex + 4, ey + 1, EYE);
			for (const [x, y] of [
				[ex, ey - 2],
				[ex + 1, ey - 1],
				[ex + 5, ey - 2],
				[ex + 4, ey - 1],
				[ex + 1, ey + 4],
				[ex + 2, ey + 3],
				[ex + 3, ey + 3],
				[ex + 4, ey + 4],
			])
				put(col, row, x, y, INK);
		}
	});
	return img;
};

// ───────────────── 連投荒らし：怒った ふきだしと 残像 ─────────────────

const BUBBLE = hex("#ffffff");
const BUBBLE_SHADE = hex("#dfe3ee");
const GHOST = hex("#ffffff", 110);
const GHOST_INK = hex("#2b2f48", 110);
const ANGER = hex("#e0463c");

const bubbleAt = (ox, oy) => (x, y) => {
	const bx = x - ox;
	const by = y - oy;
	const inBox = bx >= 0 && bx <= 11 && by >= 0 && by <= 8;
	const corner = (bx === 0 || bx === 11) && (by === 0 || by === 8);
	const tail = (bx === 2 && by >= 9 && by <= 10) || (bx === 3 && by === 9) || (bx === 1 && by === 11);
	return (inBox && !corner) || tail;
};

const rento = () => {
	const img = sheet();
	DIRS.forEach((dir, row) => {
		for (const col of [0, 1]) {
			const put = img.put;
			// 残像（うすい。2コマ目は もっと ずれる）
			shape(put, col, row, bubbleAt(col ? 0 : 1, col ? 1 : 2), () => GHOST, GHOST_INK);
			const ox = 3 + col;
			const oy = 4;
			shape(put, col, row, bubbleAt(ox, oy), (x, y) => (y === oy + 7 ? BUBBLE_SHADE : BUBBLE));
			// 怒りの しるし（右上）
			for (const [x, y] of [
				[13, 1],
				[15, 1],
				[14, 2],
				[13, 3],
				[15, 3],
			])
				put(col, row, x - 1 + col, y, ANGER);
			if (dir === "up") {
				// 背中：「…」だけ
				for (const x of [ox + 3, ox + 6, ox + 9]) put(col, row, x - 1, oy + 4, INK);
				continue;
			}
			angryFace(put, col, row, ox + 3 + shiftOf(dir), oy + 2);
		}
	});
	return img;
};

// ───────────────── 凍結アカ：氷に とじこめられた 初期アイコン ─────────────────

const ICE = hex("#bfe8f5", 235);
const ICE_TOP = hex("#e6f7fc");
const ICE_SIDE = hex("#95cfe3", 235);
const SIL = hex("#7f8ea6");
const GLINT = hex("#ffffff");

const touketsu = () => {
	const img = sheet();
	DIRS.forEach((dir, row) => {
		for (const col of [0, 1]) {
			const put = img.put;
			shape(
				put,
				col,
				row,
				(x, y) => x >= 2 && x <= 13 && y >= 3 && y <= 15,
				(x, y) => (y <= 5 ? ICE_TOP : x >= 12 ? ICE_SIDE : ICE),
			);
			// 初期アイコンの 人がた（顔は ない）。右・左は 頭を 寄せる
			const head = ellipse(8 + shiftOf(dir) * 0.6, 8.5, 2.2, 2.2);
			const shoulders = ellipse(8, 15, 4.4, 3.4);
			for (let y = 6; y <= 14; y++)
				for (let x = 3; x <= 12; x++) if (head(x, y) || shoulders(x, y)) put(col, row, x, y, SIL);
			// 光（2コマ目は 下へ）
			const g = col
				? [
						[4, 9],
						[4, 10],
						[5, 8],
					]
				: [
						[4, 6],
						[4, 7],
						[5, 5],
					];
			for (const [x, y] of g) put(col, row, x, y, GLINT);
			put(col, row, 11, col ? 12 : 13, GLINT);
		}
	});
	return img;
};

// ───────────────── 炎上案件：ばくだんの 下から 炎 ─────────────────

const FIRE_RED = hex("#e03800");
const FIRE_ORANGE = hex("#f89800");
const FIRE_YELLOW = hex("#f8f000");
// 列ごとの 炎の 高さ（2コマで 入れかわり、ゆれて 見える）
const FLAME = [
	[2, 4, 6, 4, 2, 3, 5, 3, 2, 4, 7, 5, 2, 3, 5, 2],
	[3, 6, 4, 2, 3, 6, 3, 2, 4, 6, 4, 2, 4, 6, 3, 1],
];

const enjo = (bomb) => {
	const img = sheet();
	img.rgba.set(bomb.rgba);
	for (const row of [0, 1, 2, 3])
		for (const col of [0, 1])
			for (let x = 0; x < 16; x++) {
				const h = FLAME[col][x];
				for (let t = 0; t < h; t++)
					img.put(col, row, x, 16 - h + t, t === 0 ? FIRE_RED : t === 1 || x === 0 || x === 15 ? FIRE_ORANGE : FIRE_YELLOW);
			}
	return img;
};

// ───────────────── 実行 ─────────────────

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

const args = process.argv.slice(2);
const opt = (name) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : null;
};
const outDir = resolve(opt("--out") ?? join(HERE, "..", "public/sprites"));
const previewDir = opt("--preview");
const bomb = decodePng(Buffer.from(await (await fetch(BOMB_URL)).arrayBuffer()));
if (bomb.w !== 32 || bomb.h !== 64) throw new Error(`32x64 ではありません: ${bomb.w}x${bomb.h}`);
for (const [name, img] of [
	["tsuri", tsuri()],
	["nenchaku", nenchaku()],
	["rento", rento()],
	["touketsu", touketsu()],
	["enjo", enjo(bomb)],
]) {
	save(join(outDir, `${name}.png`), img);
	if (previewDir) save(join(resolve(previewDir), `${name}.png`), scaleOn(img, 8, [88, 120, 72]));
}
