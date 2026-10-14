// ヲタショップ「神降臨」の 絵を 書き出す（node scripts/make-otaku.mjs [--cache <dir>] → public/sprites/otaku.png）。
//
// 店の 外観の 看板・窓、中の 棚・ガチャ・平台、キリコの 家に 飾れる グッズ（data/village/otaku.ts・data/village/myhome.ts）。
// フィギュア・ポスター・アクスタの 絵柄は この ゲームの 歩行グラ（ゼロ・レン・リノ・アル。public/sprites/*.png の 正面の 1コマ）。
// レジは RPGEN の「レジカウンター」EVAhBn（作者の 指定。CDN から 取る。--cache で 取った 絵を 置いておける）。ほかは 手描き。
// 272x32（16x16 の マス。2マスの 物は 16x32）：
//   (0,0)   フィギュアケース 16x32       (16,0)  タペストリー（ゼロ）16x32
//   (32,0)  同人誌の 棚 16x32             (48,0)  ガチャガチャ 16x32
//   (64,0)  ポスター ゼロ・(80,0) リノ・(96,0) アル・(112,0) レン（壁に はる）
//   (64,16) レジカウンター・(80,16) フィギュア ゼロ・(96,16) リノ・(112,16) アル
//   (128,0) アクスタ ゼロ・(128,16) レン・(144,0) リノ・(144,16) アル
//   (160,0) (176,0) 外の 窓（ポスターが はってある）・(160,16) (176,16) 同人誌の 平台（2マス）
//   (192,0)〜(256,0) だいだいの 看板の 帯（5マス。左が 顔の 印、右 4マスに「カミコーリン」）
//   (192,16) 新刊の POP・(208,16)〜 空き
//
// 依存なし（zlib だけ）。PNG の 書き方・読み方は make-season.mjs と 同じ。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k) => {
	const i = process.argv.indexOf(k);
	return i >= 0 ? process.argv[i + 1] : undefined;
};
const OUT = arg("--out")
	? resolve(arg("--out"))
	: join(HERE, "../public/sprites/otaku.png");
const CACHE = arg("--cache") ? resolve(arg("--cache")) : undefined;
const CDN = "https://rpgen-search.pages.dev/data/images/sprites/";
const SPRITES = join(HERE, "../public/sprites");

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
/** 8bit の PNG（色の 型 0/2/3/4/6）を RGBA に。 */
const decodePng = (buf) => {
	let p = 8;
	let w = 0;
	let h = 0;
	let depth = 8;
	let type = 6;
	let pal = null;
	let trns = null;
	const idat = [];
	while (p < buf.length) {
		const len = buf.readUInt32BE(p);
		const t = buf.toString("ascii", p + 4, p + 8);
		const d = buf.subarray(p + 8, p + 8 + len);
		if (t === "IHDR") {
			w = d.readUInt32BE(0);
			h = d.readUInt32BE(4);
			depth = d[8];
			type = d[9];
		} else if (t === "PLTE") pal = d;
		else if (t === "tRNS") trns = d;
		else if (t === "IDAT") idat.push(d);
		p += 12 + len;
	}
	const raw = inflateSync(Buffer.concat(idat));
	const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
	const bpp = Math.max(1, (ch * depth) / 8);
	const stride = Math.ceil((w * ch * depth) / 8);
	const out = Buffer.alloc(w * h * 4);
	let prev = Buffer.alloc(stride);
	for (let y = 0; y < h; y++) {
		const f = raw[y * (stride + 1)];
		const line = Buffer.from(
			raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)),
		);
		for (let i = 0; i < stride; i++) {
			const a = i >= bpp ? line[i - bpp] : 0;
			const b = prev[i];
			const c = i >= bpp ? prev[i - bpp] : 0;
			let v = line[i];
			if (f === 1) v += a;
			else if (f === 2) v += b;
			else if (f === 3) v += (a + b) >> 1;
			else if (f === 4) {
				const pp = a + b - c;
				const pa = Math.abs(pp - a);
				const pb = Math.abs(pp - b);
				const pc = Math.abs(pp - c);
				v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
			}
			line[i] = v & 255;
		}
		prev = line;
		for (let x = 0; x < w; x++) {
			const o = (y * w + x) * 4;
			if (type === 3) {
				const bit = x * depth;
				const idx =
					(line[bit >> 3] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
				out[o] = pal[idx * 3];
				out[o + 1] = pal[idx * 3 + 1];
				out[o + 2] = pal[idx * 3 + 2];
				out[o + 3] = trns && idx < trns.length ? trns[idx] : 255;
			} else if (type === 6) line.copy(out, o, x * 4, x * 4 + 4);
			else if (type === 2) {
				out[o] = line[x * 3];
				out[o + 1] = line[x * 3 + 1];
				out[o + 2] = line[x * 3 + 2];
				out[o + 3] = 255;
			} else if (type === 4) {
				out[o] = out[o + 1] = out[o + 2] = line[x * 2];
				out[o + 3] = line[x * 2 + 1];
			} else {
				out[o] = out[o + 1] = out[o + 2] = line[x];
				out[o + 3] = 255;
			}
		}
	}
	return { w, h, px: out };
};

/** RPGEN の スプライト（16x16）を 取る。 */
const rpgen = async (id) => {
	const cached = CACHE && join(CACHE, `${id}.png`);
	let buf;
	if (cached && existsSync(cached)) buf = readFileSync(cached);
	else {
		const res = await fetch(`${CDN}${id}.png`);
		if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
		buf = Buffer.from(await res.arrayBuffer());
		if (cached) {
			mkdirSync(CACHE, { recursive: true });
			writeFileSync(cached, buf);
		}
	}
	const img = decodePng(buf);
	if (img.w !== 16 || img.h !== 16) throw new Error(`${id}: ${img.w}x${img.h}`);
	return img;
};

// ───────────────── 絵 ─────────────────

const W = 272;
const H = 32;
const rgba = Buffer.alloc(W * H * 4);
const set = (x, y, [r, g, b, a = 255]) => {
	if (x < 0 || y < 0 || x >= W || y >= H) return;
	const o = (y * W + x) * 4;
	if (a < 255 && rgba[o + 3] > 0) {
		const k = a / 255;
		rgba[o] = Math.round(rgba[o] * (1 - k) + r * k);
		rgba[o + 1] = Math.round(rgba[o + 1] * (1 - k) + g * k);
		rgba[o + 2] = Math.round(rgba[o + 2] * (1 - k) + b * k);
		rgba[o + 3] = Math.max(rgba[o + 3], a);
		return;
	}
	rgba[o] = r;
	rgba[o + 1] = g;
	rgba[o + 2] = b;
	rgba[o + 3] = a;
};
const rect = (x0, y0, w, h, c) => {
	for (let y = y0; y < y0 + h; y++)
		for (let x = x0; x < x0 + w; x++) set(x, y, c);
};
const inEllipse = (x, y, cx, cy, rx, ry) =>
	((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;

/**
 * 絵を 貼る（sx, sy, w, h を dx, dy へ。clip は 貼って よい 四角 [x0, y0, x1, y1]。scale 2 で 半分に 縮める）。
 */
const blit = (img, sx, sy, w, h, dx, dy, clip, scale = 1) => {
	for (let y = 0; y < h / scale; y++)
		for (let x = 0; x < w / scale; x++) {
			const px = sx + x * scale;
			const py = sy + y * scale;
			const o = (py * img.w + px) * 4;
			if (img.px[o + 3] < 128) continue;
			const tx = dx + x;
			const ty = dy + y;
			if (
				clip &&
				(tx < clip[0] || ty < clip[1] || tx > clip[2] || ty > clip[3])
			)
				continue;
			set(tx, ty, [img.px[o], img.px[o + 1], img.px[o + 2]]);
		}
};

const INK = [40, 32, 36];
const WOOD = [168, 112, 62];
const WOOD_L = [204, 152, 96];
const WOOD_D = [112, 70, 36];
const GLASS = [176, 214, 232];
const GLASS_L = [226, 244, 252];
const GRAY = [120, 124, 134];
const GRAY_L = [186, 190, 198];
const WHITE = [248, 248, 244];
const ORANGE = [240, 128, 32];
const ORANGE_D = [184, 80, 16];
const ORANGE_L = [255, 176, 80];
const RED = [214, 52, 48];
const RED_D = [150, 30, 30];

// 歩行グラの 正面の 1コマ（3行目。32x64 の (0,32)）
const walk = (name) => decodePng(readFileSync(join(SPRITES, `${name}.png`)));
const CHARS = {
	zero: walk("zero_main"),
	ren: walk("zero_ren"),
	rino: walk("rino"),
	aru: walk("aru"),
};
const FRONT_Y = 32;
/** その 人の 正面を dx, dy に（clip で 切る）。 */
const front = (who, dx, dy, clip, scale = 1) =>
	blit(CHARS[who], 0, FRONT_Y, 16, 16, dx, dy, clip, scale);

/** フィギュアケース（16x32）：木の 枠・ガラス・3段に ちいさな フィギュア。 */
const figureCase = (ox, oy) => {
	rect(ox + 1, oy + 2, 14, 30, WOOD_D);
	rect(ox + 1, oy + 2, 14, 2, WOOD);
	rect(ox + 2, oy + 4, 12, 24, GLASS);
	// 段の 板
	for (const y of [11, 19, 27]) rect(ox + 2, oy + y, 12, 1, WOOD_L);
	// ちいさな フィギュア（半分に 縮めた 正面）
	const shelf = [
		["zero", 3],
		["rino", 11],
		["aru", 19],
	];
	for (const [who, y] of shelf) {
		front(who, ox + 4, oy + y, [ox + 2, oy + y, ox + 13, oy + y + 7], 2);
		set(ox + 3, oy + y + 7, GRAY_L);
		set(ox + 12, oy + y + 7, GRAY_L);
	}
	// ガラスの 光
	for (let i = 0; i < 6; i++) set(ox + 11 - i, oy + 5 + i, GLASS_L);
	for (let i = 0; i < 4; i++) set(ox + 12 - i, oy + 13 + i, GLASS_L);
	// 台の 引き出し
	rect(ox + 2, oy + 28, 12, 3, WOOD);
	rect(ox + 7, oy + 29, 2, 1, WOOD_L);
};

/** タペストリー（16x32）：棒に 布、まんなかに ゼロ、下に 赤い 題の 帯。立てる 脚つき。 */
const tapestry = (ox, oy, who) => {
	// 脚と 棒
	rect(ox + 1, oy + 2, 1, 30, GRAY);
	rect(ox + 14, oy + 2, 1, 30, GRAY);
	rect(ox + 0, oy + 2, 16, 1, INK);
	rect(ox + 0, oy + 31, 3, 1, GRAY);
	rect(ox + 13, oy + 31, 3, 1, GRAY);
	// 布
	rect(ox + 3, oy + 3, 10, 24, [116, 182, 230]);
	rect(ox + 3, oy + 3, 10, 1, [80, 140, 200]);
	for (let y = 4; y < 14; y++)
		rect(ox + 3, oy + y, 10, 1, [150 - y, 204 - y, 240]);
	// 星
	for (const [x, y] of [
		[4, 5],
		[11, 6],
		[5, 15],
	])
		set(ox + x, oy + y, WHITE);
	front(who, ox, oy + 7, [ox + 3, oy + 3, ox + 12, oy + 26]);
	rect(ox + 3, oy + 23, 10, 4, RED);
	for (const x of [5, 7, 8, 10]) set(ox + x, oy + 25, WHITE);
	// すそ
	for (let x = 3; x < 13; x += 2) set(ox + x, oy + 27, RED_D);
};

/** 同人誌の 棚（16x32）：4段に 薄い 本の 背。 */
const doujinShelf = (ox, oy) => {
	rect(ox + 1, oy + 3, 14, 29, WOOD_D);
	rect(ox + 1, oy + 3, 14, 2, WOOD);
	const SPINE = [
		[230, 90, 120],
		[90, 150, 220],
		[250, 210, 80],
		[120, 200, 120],
		[240, 240, 240],
		[180, 110, 200],
		[250, 140, 60],
		[70, 70, 90],
	];
	let k = 0;
	for (const y of [5, 12, 19, 26]) {
		rect(ox + 2, oy + y, 12, 6, [70, 44, 24]);
		for (let x = 2; x < 14; x++) {
			const c = SPINE[(k++ * 5 + y) % SPINE.length];
			const top = (x * 7 + y) % 3 === 0 ? 1 : 0;
			rect(ox + x, oy + y + top, 1, 6 - top, c);
		}
		rect(ox + 2, oy + y + 6, 12, 1, WOOD_L);
	}
};

/** ガチャガチャ（16x32）：すきとおった 丸い 頭に カプセル、赤い 胴に 回す つまみ。 */
const gacha = (ox, oy) => {
	rect(ox + 3, oy + 3, 10, 1, RED_D);
	for (let y = 4; y < 16; y++)
		for (let x = 2; x < 14; x++) {
			if (!inEllipse(x, y, 8, 10, 6, 6.2)) continue;
			const edge = !inEllipse(x, y, 8, 10, 5, 5.2);
			set(ox + x, oy + y, edge ? GRAY : GLASS);
		}
	const CAP = [
		[240, 80, 90],
		[250, 210, 70],
		[90, 170, 240],
		[120, 210, 110],
		[240, 140, 210],
	];
	let i = 0;
	for (const [x, y] of [
		[4, 11],
		[6, 12],
		[8, 11],
		[10, 12],
		[5, 9],
		[9, 9],
		[7, 8],
		[11, 10],
	]) {
		const c = CAP[i++ % CAP.length];
		rect(ox + x, oy + y, 2, 2, c);
		set(ox + x, oy + y, WHITE);
	}
	set(ox + 5, oy + 6, GLASS_L);
	set(ox + 6, oy + 5, GLASS_L);
	// 胴
	rect(ox + 2, oy + 16, 12, 14, RED);
	rect(ox + 2, oy + 16, 12, 1, RED_D);
	rect(ox + 13, oy + 17, 1, 13, RED_D);
	// つまみ
	for (let y = 17; y < 23; y++)
		for (let x = 4; x < 12; x++)
			if (inEllipse(x, y, 8, 20, 3, 3)) set(ox + x, oy + y, WHITE);
	rect(ox + 6, oy + 20, 4, 1, GRAY);
	// 値段の 札と 出口
	rect(ox + 4, oy + 24, 3, 2, [250, 230, 120]);
	rect(ox + 8, oy + 24, 4, 4, INK);
	rect(ox + 9, oy + 26, 2, 1, [90, 170, 240]);
	rect(ox + 2, oy + 30, 12, 2, GRAY);
};

/** 壁の ポスター（16x16）：ふちどりの 中に 人と 題の 帯。 */
const poster = (ox, oy, who, bg) => {
	const dark = bg.map((v) => Math.round(v * 0.6));
	rect(ox + 1, oy + 1, 14, 14, WHITE);
	rect(ox + 2, oy + 2, 12, 12, bg);
	front(who, ox, oy + 1, [ox + 2, oy + 2, ox + 13, oy + 13]);
	rect(ox + 2, oy + 11, 12, 3, dark);
	for (const x of [4, 5, 7, 9, 10]) set(ox + x, oy + 12, WHITE);
	// 画びょう
	set(ox + 1, oy + 1, RED);
	set(ox + 14, oy + 1, RED);
};

/** フィギュア（16x16）：丸い 台に 立つ 人。 */
const figure = (ox, oy, who) => {
	for (let y = 11; y < 16; y++)
		for (let x = 1; x < 15; x++) {
			if (!inEllipse(x, y, 8, 13.6, 6.2, 2.2)) continue;
			const edge = !inEllipse(x, y, 8, 13.6, 5.2, 1.4);
			set(ox + x, oy + y, edge ? GRAY : y < 13 ? WHITE : GRAY_L);
		}
	front(who, ox, oy - 2, [ox, oy, ox + 15, oy + 13]);
};

/** アクリルスタンド（16x16）：すきとおった 板に 人、小さな 台。 */
const acst = (ox, oy, who) => {
	rect(ox + 2, oy + 0, 12, 14, [200, 232, 248, 150]);
	for (let y = 0; y < 14; y++) {
		set(ox + 2, oy + y, [236, 250, 255]);
		set(ox + 13, oy + y, [150, 190, 214]);
	}
	rect(ox + 2, oy + 0, 12, 1, [236, 250, 255]);
	front(who, ox, oy, [ox + 3, oy + 1, ox + 12, oy + 13]);
	rect(ox + 3, oy + 14, 10, 2, [130, 170, 196]);
	rect(ox + 4, oy + 14, 8, 1, [196, 226, 240]);
};

/** 外の 窓（16x16。壁の 上に 重ねる）：灰色の 枠の 中に 人の 顔の ポスター。 */
const windowPoster = (ox, oy, who, bg) => {
	rect(ox + 1, oy + 2, 14, 12, GRAY);
	rect(ox + 2, oy + 3, 12, 10, GLASS);
	rect(ox + 3, oy + 3, 10, 10, bg);
	// 顔（正面の 上 10行）
	blit(CHARS[who], 2, FRONT_Y, 12, 10, ox + 2, oy + 3, [
		ox + 3,
		oy + 3,
		ox + 12,
		oy + 12,
	]);
	rect(
		ox + 3,
		oy + 11,
		10,
		2,
		bg.map((v) => Math.round(v * 0.6)),
	);
	for (const x of [5, 7, 8, 10]) set(ox + x, oy + 12, WHITE);
	rect(ox + 1, oy + 13, 14, 1, GRAY_L);
	set(ox + 12, oy + 4, GLASS_L);
	set(ox + 11, oy + 5, GLASS_L);
};

/** 同人誌の 平台（32x16）：布を かけた 台に 薄い 本が 平づみ。 */
const hiradai = (ox, oy) => {
	rect(ox + 0, oy + 5, 32, 6, [236, 230, 214]);
	rect(ox + 0, oy + 11, 32, 4, [60, 110, 80]);
	rect(ox + 0, oy + 11, 32, 1, [40, 80, 56]);
	rect(ox + 1, oy + 15, 2, 1, WOOD_D);
	rect(ox + 29, oy + 15, 2, 1, WOOD_D);
	const COVERS = [
		[240, 150, 170],
		[140, 190, 240],
		[250, 220, 110],
		[170, 230, 160],
		[220, 170, 240],
		[250, 170, 100],
	];
	let i = 0;
	for (let x = 1; x < 31; x += 5) {
		const c = COVERS[i++ % COVERS.length];
		// 平づみ（厚みは 白い 線）
		rect(ox + x, oy + 3, 4, 5, c);
		rect(ox + x, oy + 8, 4, 1, WHITE);
		rect(ox + x, oy + 9, 4, 1, [200, 196, 186]);
		set(ox + x + 1, oy + 4, WHITE);
		set(ox + x + 2, oy + 4, WHITE);
		set(
			ox + x + 1,
			oy + 6,
			c.map((v) => Math.round(v * 0.6)),
		);
	}
};

/** 新刊の POP（16x16）：赤い 帯と 星の 札を 小さな 足で 立てる。 */
const pop = (ox, oy) => {
	rect(ox + 3, oy + 2, 10, 9, WHITE);
	rect(ox + 3, oy + 2, 10, 3, RED);
	for (const x of [5, 7, 8, 10]) set(ox + x, oy + 3, WHITE);
	for (const [x, y] of [
		[8, 6],
		[7, 7],
		[8, 7],
		[9, 7],
		[8, 8],
	])
		set(ox + x, oy + y, [250, 200, 40]);
	rect(ox + 3, oy + 11, 10, 1, GRAY);
	rect(ox + 5, oy + 12, 1, 4, GRAY);
	rect(ox + 10, oy + 12, 1, 4, GRAY);
};

// 看板の 字（7x8。「カミコーリン」）
const GLYPHS = {
	カ: [
		"...#...",
		"...#...",
		"#######",
		"...#..#",
		"...#..#",
		"..#...#",
		".#....#",
		"#...##.",
	],
	ミ: [
		".###...",
		"....##.",
		".......",
		".###...",
		"....##.",
		".......",
		"###....",
		"...####",
	],
	コ: [
		"######.",
		".....#.",
		".....#.",
		".....#.",
		".....#.",
		".....#.",
		"######.",
		".......",
	],
	ー: [
		".......",
		".......",
		".......",
		"#######",
		".......",
		".......",
		".......",
		".......",
	],
	リ: [
		"#....#.",
		"#....#.",
		"#....#.",
		"#....#.",
		".....#.",
		"....#..",
		"...#...",
		".##....",
	],
	ン: [
		"#......",
		".##....",
		"......#",
		".....#.",
		"....#..",
		"..##...",
		"##.....",
		".......",
	],
};

/** だいだいの 看板の 帯（80x16）：左に 顔の 印、右に 店の 名前。 */
const sign = (ox, oy) => {
	rect(ox, oy, 80, 16, ORANGE);
	rect(ox, oy, 80, 2, ORANGE_D);
	rect(ox, oy + 14, 80, 2, ORANGE_D);
	rect(ox, oy + 2, 80, 1, ORANGE_L);
	// 顔の 印（白い 丸に ∀ の 口）
	for (let y = 2; y < 14; y++)
		for (let x = 2; x < 14; x++)
			if (inEllipse(x, y, 8, 8, 5.6, 5.6)) set(ox + x, oy + y, WHITE);
	set(ox + 5, oy + 6, INK);
	set(ox + 10, oy + 6, INK);
	rect(ox + 5, oy + 8, 6, 1, INK);
	set(ox + 6, oy + 9, INK);
	set(ox + 9, oy + 9, INK);
	rect(ox + 7, oy + 10, 2, 1, INK);
	rect(ox + 6, oy + 9, 4, 1, INK);
	// 字（影つき）
	let x0 = ox + 20;
	for (const ch of "カミコーリン") {
		GLYPHS[ch].forEach((r, y) => {
			[...r].forEach((c, x) => {
				if (c !== "#") return;
				set(x0 + x + 1, oy + 4 + y + 1, ORANGE_D);
				set(x0 + x, oy + 4 + y, WHITE);
			});
		});
		x0 += 10;
	}
};

figureCase(0, 0);
tapestry(16, 0, "zero");
doujinShelf(32, 0);
gacha(48, 0);
poster(64, 0, "zero", [250, 196, 210]);
poster(80, 0, "rino", [196, 226, 170]);
poster(96, 0, "aru", [200, 200, 250]);
poster(112, 0, "ren", [250, 226, 160]);
const regi = await rpgen("EVAhBn"); // レジカウンター（作者の 指定）
blit(regi, 0, 0, 16, 16, 64, 16);
figure(80, 16, "zero");
figure(96, 16, "rino");
figure(112, 16, "aru");
acst(128, 0, "zero");
acst(128, 16, "ren");
acst(144, 0, "rino");
acst(144, 16, "aru");
windowPoster(160, 0, "zero", [250, 196, 210]);
windowPoster(176, 0, "aru", [200, 200, 250]);
hiradai(160, 16);
sign(192, 0);
pop(192, 16);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, encodePng(W, H, rgba));
console.log(`wrote ${OUT} (${W}x${H})`);
