// 季節の 行事の 絵を 書き出す（node scripts/make-season.mjs [--cache <dir>] → public/sprites/season.png）。
//
// おんJ芋煮会（浜の すみの 石の かまどと 大鍋。data/village/season.ts・ui/imoni.ts）。128x32：
//   (0,0)   32x32 大鍋（冷えている。木の ふた）と 石の かまど。村の 地図の 外観（2x2 マス。GridLook の キー a b c d）
//   (32,0)  32x32 火の 入った 大鍋の ふたの 所だけ（ふたを とって 芋煮。こんにゃく なし）。開催の 日に 飾り（decor）で 重ねる
//   (64,0)  32x32 同じ（こんにゃく 入り）
//   (96,0)  16x16 芋煮の お椀（こんにゃく なし）。食べる ときの 板（ui/eat.ts の showDish）
//   (112,0) 16x16 芋煮の お椀（こんにゃく 入り）
//   (96,16)〜 空き
// お椀は RPGEN の「味噌汁（豆腐craft）」rlAACtA（130: 食べ物２ #25）を CDN から とって、汁の 色を かえ、里芋・牛肉・ねぎ・
// こんにゃくを 描きたす（ゲームは CDN を 見ない。--cache で 取った 絵を 置いておける）。鍋と かまどは 手描き。
//
// 依存なし（zlib だけ）。PNG の 書き方は make-trolley.mjs と 同じ、読み方は pack-rpgen.mjs の decodePng と 同じ。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k) => {
	const i = process.argv.indexOf(k);
	return i >= 0 ? process.argv[i + 1] : undefined;
};
// 本番は ../public/sprites/season.png（下書きでは --out で かえる）
const OUT = arg("--out")
	? resolve(arg("--out"))
	: join(HERE, "../public/sprites/season.png");
const CACHE = arg("--cache") ? resolve(arg("--cache")) : undefined;
const CDN = "https://rpgen-search.pages.dev/data/images/sprites/";

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

/** RPGEN の スプライト（16x16）を 取る。CDN は 無い id にも 200 で「404」の 絵を 返すので、白黒だけの 絵は 失敗に する。 */
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
	let bw = 0;
	for (let i = 0; i < 256; i++) {
		const [r, g, b, a] = img.px.subarray(i * 4, i * 4 + 4);
		if (
			a === 255 &&
			((r < 20 && g < 20 && b < 20) || (r > 235 && g > 235 && b > 235))
		)
			bw++;
	}
	if (bw === 256) throw new Error(`${id}: the CDN "404" picture`);
	return img;
};

// ───────────────── 絵 ─────────────────

const W = 128;
const H = 32;
const rgba = Buffer.alloc(W * H * 4);
const set = (x, y, [r, g, b, a = 255]) => {
	if (x < 0 || y < 0 || x >= W || y >= H) return;
	const o = (y * W + x) * 4;
	if (a < 255 && rgba[o + 3] > 0) {
		// 影は 下の 色に 重ねる
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
const get = (x, y) => {
	const o = (y * W + x) * 4;
	return [rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3]];
};
/** だ円の 中か（cx, cy は 画素の 中心で 数える）。 */
const inEllipse = (x, y, cx, cy, rx, ry) =>
	((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;

const OUTLINE = [34, 30, 30];
const IRON = [64, 64, 72];
const IRON_L = [104, 104, 116];
const IRON_D = [42, 42, 48];
const IRON_HI = [156, 156, 168];
const WOOD = [170, 116, 64];
const WOOD_L = [206, 156, 98];
const WOOD_D = [120, 78, 40];
const STONE = [134, 130, 122];
const STONE_L = [178, 174, 162];
const STONE_D = [90, 86, 80];
const MOUTH = [38, 28, 24];
const ASH = [86, 78, 72];
const SHADOW = [0, 0, 0, 64];
const BROTH = [146, 86, 36];
const BROTH_L = [182, 120, 58];
const TARO = [236, 226, 204];
const TARO_D = [200, 186, 158];
const MEAT = [116, 54, 34];
const NEGI = [118, 184, 70];
const KON = [126, 122, 118];
const KON_D = [86, 82, 80];

// 鍋の 口（ふた・芋煮の 汁の だ円）。左上 (ox, oy) の 32x32 の 中の 座標
const RIM = { cx: 16, cy: 11, rx: 14, ry: 4.6 };
const MOUTH_IN = { cx: 16, cy: 11, rx: 11.6, ry: 3.2 };

/** 石 1つ（ふちを 暗く、左上を 明るく）。 */
const stone = (ox, oy, x0, y0, w, h) => {
	const cx = x0 + w / 2;
	const cy = y0 + h / 2;
	for (let y = y0; y < y0 + h; y++)
		for (let x = x0; x < x0 + w; x++) {
			if (!inEllipse(x, y, cx, cy, w / 2, h / 2)) continue;
			const edge = !inEllipse(x, y, cx, cy, w / 2 - 1, h / 2 - 1);
			const lit = x + 0.5 < cx && y + 0.5 < cy;
			set(ox + x, oy + y, edge ? STONE_D : lit ? STONE_L : STONE);
		}
};

/** 冷えた 大鍋と 石の かまど（32x32）。 */
const potCold = (ox, oy) => {
	// 砂に おちる 影
	for (let y = 27; y < 32; y++)
		for (let x = 2; x < 30; x++)
			if (inEllipse(x, y, 16, 29.5, 14, 2.6)) set(ox + x, oy + y, SHADOW);
	// うしろの 石（鍋に 半分 かくれる）
	stone(ox, oy, 0, 17, 7, 6);
	stone(ox, oy, 25, 17, 7, 6);
	// 鍋の 胴（上が 広く 下が すぼまる）
	for (let y = 11; y <= 26; y++) {
		const hw = 13.6 - Math.max(0, y - 15) * 0.6;
		for (let x = 0; x < 32; x++) {
			const d = x + 0.5 - 16;
			if (Math.abs(d) > hw) continue;
			const edge = Math.abs(d) > hw - 1 || y === 26;
			const c = edge
				? OUTLINE
				: d < -hw + 3
					? IRON_L
					: d > hw - 3 || y >= 23
						? IRON_D
						: IRON;
			set(ox + x, oy + y, c);
		}
	}
	// 取っ手（両の 耳）
	for (const [x, y] of [
		[1, 13],
		[1, 14],
		[1, 15],
		[2, 16],
		[30, 13],
		[30, 14],
		[30, 15],
		[29, 16],
	])
		set(ox + x, oy + y, OUTLINE);
	// ふち（だ円の 輪）
	for (let y = 0; y < 18; y++)
		for (let x = 0; x < 32; x++) {
			if (!inEllipse(x, y, RIM.cx, RIM.cy, RIM.rx, RIM.ry)) continue;
			const outer = !inEllipse(x, y, RIM.cx, RIM.cy, RIM.rx - 1, RIM.ry - 1);
			const inner = inEllipse(
				x,
				y,
				MOUTH_IN.cx,
				MOUTH_IN.cy,
				MOUTH_IN.rx,
				MOUTH_IN.ry,
			);
			if (inner) continue;
			set(ox + x, oy + y, outer ? OUTLINE : y < RIM.cy ? IRON_HI : IRON_L);
		}
	// 木の ふた（口の だ円に ぴったり。板の すじと 取っ手）
	for (let y = 0; y < 18; y++)
		for (let x = 0; x < 32; x++) {
			if (!inEllipse(x, y, MOUTH_IN.cx, MOUTH_IN.cy, MOUTH_IN.rx, MOUTH_IN.ry))
				continue;
			const top = !inEllipse(
				x,
				y - 1,
				MOUTH_IN.cx,
				MOUTH_IN.cy,
				MOUTH_IN.rx,
				MOUTH_IN.ry,
			);
			const seam = x === 10 || x === 16 || x === 22;
			set(ox + x, oy + y, top ? WOOD_L : seam ? WOOD_D : WOOD);
		}
	for (let x = 12; x <= 19; x++) {
		set(ox + x, oy + 10, WOOD_L);
		set(ox + x, oy + 11, WOOD_D);
	}
	// 前の 石（火の 口を あけて 左右に 2つずつ）
	stone(ox, oy, 1, 22, 7, 7);
	stone(ox, oy, 6, 24, 7, 6);
	stone(ox, oy, 19, 24, 7, 6);
	stone(ox, oy, 24, 22, 7, 7);
	// 火の 口（冷えた 灰）。開催の 日は ここに 火を 描く（ui/imoni.ts）
	for (let y = 25; y <= 29; y++)
		for (let x = 13; x <= 18; x++) set(ox + x, oy + y, y >= 28 ? ASH : MOUTH);
};

/** 鍋の 口に 重ねる 芋煮（32x32 の 中で 口の だ円だけ 描く。ふたを すっかり かくす）。 */
const potLit = (ox, oy, konnyaku) => {
	for (let y = 0; y < 18; y++)
		for (let x = 0; x < 32; x++) {
			if (!inEllipse(x, y, MOUTH_IN.cx, MOUTH_IN.cy, MOUTH_IN.rx, MOUTH_IN.ry))
				continue;
			const back = !inEllipse(
				x,
				y - 1,
				MOUTH_IN.cx,
				MOUTH_IN.cy,
				MOUTH_IN.rx,
				MOUTH_IN.ry,
			);
			set(ox + x, oy + y, back ? IRON_D : (x + y) % 7 === 0 ? BROTH_L : BROTH);
		}
	const taro = (x, y) => {
		set(ox + x, oy + y, TARO);
		set(ox + x + 1, oy + y, TARO);
		set(ox + x, oy + y + 1, TARO_D);
		set(ox + x + 1, oy + y + 1, TARO_D);
	};
	taro(7, 10);
	taro(13, 9);
	taro(19, 11);
	taro(23, 9);
	for (const [x, y] of [
		[10, 12],
		[11, 12],
		[17, 9],
		[18, 9],
		[25, 12],
	])
		set(ox + x, oy + y, MEAT);
	for (const [x, y] of [
		[9, 9],
		[16, 12],
		[21, 9],
		[6, 12],
	])
		set(ox + x, oy + y, NEGI);
	// こんにゃく（灰色の さいの目。口の だ円から はみ出さない）
	if (konnyaku)
		for (const [x, y] of [
			[11, 9],
			[21, 10],
			[15, 12],
		])
			for (const [dx, dy, c] of [
				[0, 0, KON],
				[1, 0, KON],
				[0, 1, KON_D],
				[1, 1, KON_D],
			])
				if (
					inEllipse(
						x + dx,
						y + dy,
						MOUTH_IN.cx,
						MOUTH_IN.cy,
						MOUTH_IN.rx,
						MOUTH_IN.ry,
					)
				)
					set(ox + x + dx, oy + y + dy, c);
};

/**
 * 芋煮の お椀（RPGEN の 味噌汁の お椀に 汁と 具を 描きなおす）。見える 画素の 下はしを マスの 下に そろえる
 * （pack-rpgen.mjs の FOOD の seat と 同じ。ui/eat.ts の showDish が 台の 上に のせる）。
 */
const bowl = (ox, oy0, base, konnyaku) => {
	let bottom = 0;
	for (let y = 0; y < 16; y++)
		for (let x = 0; x < 16; x++)
			if (base.px[(y * 16 + x) * 4 + 3] > 0) bottom = y;
	const oy = oy0 + 15 - bottom;
	for (let y = 0; y < 16; y++)
		for (let x = 0; x < 16; x++) {
			const o = (y * 16 + x) * 4;
			const c = [...base.px.subarray(o, o + 4)];
			if (c[3] === 0) continue;
			set(ox + x, oy + y, c);
		}
	// 汁（味噌汁の 黄土色・豆腐の 白を しょうゆ色に。6〜8 行の 明るい 画素）
	for (let y = 6; y <= 8; y++)
		for (let x = 3; x <= 12; x++) {
			const [r, g, b, a] = get(ox + x, oy + y);
			if (a === 0 || r + g + b < 300) continue;
			set(ox + x, oy + y, y === 6 ? BROTH_L : BROTH);
		}
	for (const [x, y] of [
		[4, 7],
		[5, 7],
		[10, 7],
	])
		set(ox + x, oy + y, TARO);
	for (const [x, y] of [
		[9, 8],
		[5, 8],
	])
		set(ox + x, oy + y, TARO_D);
	for (const [x, y] of [
		[7, 6],
		[8, 6],
	])
		set(ox + x, oy + y, MEAT);
	for (const [x, y] of [
		[6, 7],
		[11, 8],
	])
		set(ox + x, oy + y, NEGI);
	if (konnyaku)
		for (const [x, y] of [
			[7, 8],
			[8, 8],
			[11, 7],
		])
			set(ox + x, oy + y, KON);
};

potCold(0, 0);
potLit(32, 0, false);
potLit(64, 0, true);
const soup = await rpgen("rlAACtA"); // 味噌汁（豆腐craft）130: 食べ物２ #25
bowl(96, 0, soup, false);
bowl(112, 0, soup, true);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, encodePng(W, H, rgba));
console.log(`wrote ${OUT} (${W}x${H})`);
