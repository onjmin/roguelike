// 植民地（板）ごとの 敵 7体の 歩行グラ（32x64・16x16 が 2コマ×4方向。行は 上・右・下・左）を書き出す
// （node scripts/make-colony-enemies.mjs）。どれも 仮の 絵（ART_TODO.md。作者が 描きなおす）。
// 顔は 板の マスコットの 顔文字（おんJwiki・植民地一覧スレ）から。
//
//   パン兵（panhei.png）       … パン板。|｀°Ο°´| の 食パンの 兵隊（パン松の 軍勢）。灰色の かぶと
//   きのにゃん（kinonyan.png） … きのこ板。[ｷ・Д・ﾉ] の 赤い かさの きのこ。2コマ目は かさが ゆれる
//   おふ郎くん（ofurou.png）   … 風呂板。[o'ω'f] の 丸い 顔に 手ぬぐい。2コマ目は 湯気が のぼる
//   でんちゃん（denchan.png）  … 電池板。{+'w'-] の 乾電池。2コマ目は 漏電の 火花
//   ナツコ（natsuko.png）      … 離島・沖縄板。~｀i,/ ﾟヮﾟﾉヽi´~ の ヤシの木の 精。2コマ目は 葉が ゆれる
//   たこのみん（takonomin.png）… おんたこ。∬*ﾟ ヮﾟル の たこ焼き。2コマ目は 湯気（∬）が ゆれる
//   マシー（mashii.png）       … お祭り会場。(o M c) の 丸い 顔。2コマ目は はねる
//
// 右・左は 顔を その向きへ 1ドット 寄せる。上（背中）は 顔なし。乱数は 使わない（毎回 同じ 絵）。
//
//   node scripts/make-colony-enemies.mjs                          … public/sprites/ に 7枚
//   node scripts/make-colony-enemies.mjs --out dir --preview dir2 … 別の 場所へ（プレビューは 8倍）
//
// 依存なし（zlib だけ）。

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));

// ───────────────── 最小 PNG（書き: RGBA 8bit） ─────────────────

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

// ───────────────── 描く 道具 ─────────────────

const hex = (s, a = 255) => [...[1, 3, 5].map((i) => Number.parseInt(s.slice(i, i + 2), 16)), a];
const INK = hex("#2b2f48");
const EYE = hex("#1c1d2b");
const WHITE = hex("#f7f6ef");
const DIRS = ["up", "right", "down", "left"];
const shiftOf = (dir) => (dir === "right" ? 1 : dir === "left" ? -1 : 0);

/** 32x64 の 絵。put は コマ（col, row）の 中の 1ドット。 */
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
const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const dots = (put, col, row, list, c) => {
	for (const [x, y] of list) put(col, row, x, y, c);
};

/** 1体ぶん（each(put, col, row, dir) で 1コマ）。 */
const make = (each) => {
	const img = sheet();
	DIRS.forEach((dir, row) => {
		for (const col of [0, 1]) each(img.put, col, row, dir);
	});
	return img;
};

// ───────────────── パン兵：|｀°Ο°´| の 食パンの 兵隊 ─────────────────

const CRUST = hex("#b8763a");
const CRUMB = hex("#f2d9a4");
const HELM = hex("#8a93a6");
const HELM_LIGHT = hex("#c2c8d6");

const panhei = () =>
	make((put, col, row, dir) => {
		const dy = col; // 2コマ目は 1ドット 沈む（行進）
		// 食パンの 体（上が まるい）
		const top = ellipse(8, 7 + dy, 6.5, 4);
		const body = (x, y) => (top(x, y) && y <= 7 + dy) || rect(2, 7 + dy, 14, 14)(x, y);
		shape(put, col, row, body, (x, y) => (y >= 13 || x <= 2 || x >= 14 ? CRUST : CRUMB), CRUST);
		// かぶと
		shape(put, col, row, (x, y) => ellipse(8, 4 + dy, 5, 2.6)(x, y) && y <= 4 + dy, (x) => (x === 5 ? HELM_LIGHT : HELM));
		// 足
		dots(put, col, row, [[5, 15], [11, 15]], INK);
		if (dir === "up") return;
		const s = shiftOf(dir);
		// |｀°Ο°´| … まるい 目（°）と O の 口、つり眉（｀ ´）
		dots(put, col, row, [[5 + s, 8 + dy], [11 + s, 8 + dy], [4 + s, 7 + dy], [12 + s, 7 + dy]], EYE);
		dots(put, col, row, [[7 + s, 11 + dy], [8 + s, 10 + dy], [9 + s, 11 + dy], [8 + s, 12 + dy]], EYE);
	});

// ───────────────── きのにゃん：[ｷ・Д・ﾉ] の きのこ ─────────────────

const CAP = hex("#d0302a");
const CAP_DARK = hex("#a02420");
const STEM = hex("#efe6d0");

const kinonyan = () =>
	make((put, col, row, dir) => {
		const sway = col; // 2コマ目は かさが 右へ ずれる
		shape(put, col, row, rect(4, 8, 12, 15), () => STEM);
		shape(put, col, row, (x, y) => ellipse(8 + sway, 6, 7.5, 5)(x, y) && y <= 8, (x, y) => (y >= 7 ? CAP_DARK : CAP));
		dots(put, col, row, [[4 + sway, 4], [10 + sway, 3], [7 + sway, 6], [12 + sway, 6]], WHITE);
		if (dir === "up") return;
		const s = shiftOf(dir);
		// ・Д・ … 点の 目と 口の 四角
		dots(put, col, row, [[5 + s, 10], [11 + s, 10]], EYE);
		dots(put, col, row, [[7 + s, 12], [8 + s, 12], [9 + s, 12], [7 + s, 13], [9 + s, 13], [7 + s, 14], [8 + s, 14], [9 + s, 14]], EYE);
	});

// ───────────────── おふ郎くん：[o'ω'f] の 丸い 顔に 手ぬぐい ─────────────────

const FACE = hex("#ffe2c4");
const TOWEL = hex("#f7f6ef");
const TOWEL_LINE = hex("#3060c0");
const STEAM = hex("#ffffff", 150);

const ofurou = () =>
	make((put, col, row, dir) => {
		shape(put, col, row, ellipse(8, 10, 6.5, 5.5), () => FACE);
		// 頭の 手ぬぐい（青い すじ）
		shape(put, col, row, (x, y) => ellipse(8, 6, 5.5, 2.2)(x, y), (x) => (x % 3 === 0 ? TOWEL_LINE : TOWEL));
		// 湯気（2コマ目は 上へ）
		dots(put, col, row, [[4, 2 - col], [8, 1 - col], [12, 2 - col], [4, 3 - col], [12, 3 - col]], STEAM);
		if (dir === "up") return;
		const s = shiftOf(dir);
		// ' ω ' … 細い 目と ω の 口
		dots(put, col, row, [[5 + s, 9], [11 + s, 9]], EYE);
		dots(put, col, row, [[6 + s, 12], [7 + s, 13], [8 + s, 12], [9 + s, 13], [10 + s, 12]], EYE);
	});

// ───────────────── でんちゃん：{+'w'-] の 乾電池 ─────────────────

const BATT = hex("#f0c020");
const BATT_DARK = hex("#b88a10");
const METAL = hex("#c8ccd6");
const SPARK = hex("#80e8ff");

const denchan = () =>
	make((put, col, row, dir) => {
		shape(put, col, row, rect(3, 4, 13, 15), (x, y) => (y <= 6 ? METAL : x >= 12 ? BATT_DARK : BATT));
		shape(put, col, row, rect(6, 2, 10, 4), () => METAL);
		if (col === 1)
			dots(put, col, row, [[1, 6], [2, 7], [1, 8], [14, 9], [15, 10], [14, 11], [8, 0], [9, 1]], SPARK);
		if (dir === "up") return;
		const s = shiftOf(dir);
		// { + ' w ' - ] … 左に ＋、右に −、w の 口
		dots(put, col, row, [[4, 9], [5, 8], [5, 9], [5, 10], [6, 9]], EYE);
		dots(put, col, row, [[10, 9], [11, 9], [12, 9]], EYE);
		dots(put, col, row, [[7 + s, 9], [9 + s, 9]], EYE);
		dots(put, col, row, [[6 + s, 12], [7 + s, 13], [8 + s, 12], [9 + s, 13], [10 + s, 12]], EYE);
	});

// ───────────────── ナツコ：ヤシの木の 精 ─────────────────

const TRUNK = hex("#9a6a3a");
const LEAF = hex("#2f9a3a");
const LEAF_DARK = hex("#1f7a2a");
const SKIN = hex("#ffd9b0");

const natsuko = () =>
	make((put, col, row, dir) => {
		const sway = col ? 1 : 0;
		// 顔と 幹の 体
		shape(put, col, row, ellipse(8, 8, 4.5, 4), () => SKIN);
		shape(put, col, row, rect(6, 11, 10, 15), (x) => (x === 8 ? hex("#7a5028") : TRUNK));
		// 頭の 葉（~ と ~ が ゆれる）
		for (const [x, y] of [[1, 5], [2, 4], [3, 3], [4, 3], [5, 2], [6, 2], [7, 1], [8, 1], [9, 2], [10, 2], [11, 3], [12, 3], [13, 4], [14, 5]])
			put(col, row, x + (x < 8 ? -sway : sway), y, LEAF);
		for (const [x, y] of [[3, 4], [5, 3], [11, 4], [13, 5], [6, 4], [10, 4]]) put(col, row, x, y, LEAF_DARK);
		if (dir === "up") return;
		const s = shiftOf(dir);
		// ﾟヮﾟ … まるい 目と ひらいた 口
		dots(put, col, row, [[6 + s, 7], [10 + s, 7]], EYE);
		dots(put, col, row, [[7 + s, 10], [8 + s, 10], [9 + s, 10], [8 + s, 11]], EYE);
	});

// ───────────────── たこのみん：∬*ﾟ ヮﾟル の たこ焼き ─────────────────

const TAKO = hex("#c07a3a");
const TAKO_DARK = hex("#8a5020");
const SAUCE = hex("#5a2e18");
const NORI = hex("#3a8a3a");
const MAYO = hex("#fff4d0");

const takonomin = () =>
	make((put, col, row, dir) => {
		shape(put, col, row, ellipse(8, 10, 6.5, 5.5), (x, y) => (y <= 7 ? SAUCE : y >= 14 ? TAKO_DARK : TAKO));
		dots(put, col, row, [[5, 6], [10, 5], [8, 7]], NORI);
		dots(put, col, row, [[4, 7], [6, 6], [11, 7]], MAYO);
		// ∬ の 湯気（2コマ目は ずれる）
		for (const [x, y] of [[6, 1], [7, 2], [6, 3], [10, 1], [11, 2], [10, 3]]) put(col, row, x + col, y, STEAM);
		if (dir === "up") return;
		const s = shiftOf(dir);
		dots(put, col, row, [[5 + s, 10], [11 + s, 10]], EYE);
		dots(put, col, row, [[7 + s, 12], [8 + s, 12], [9 + s, 12], [8 + s, 13]], EYE);
	});

// ───────────────── マシー：(o M c) の 丸い 顔 ─────────────────

const MASHI = hex("#f4efe4");
const CHEEK = hex("#f08a8a");

const mashii = () =>
	make((put, col, row, dir) => {
		const hop = col; // 2コマ目は はねる
		shape(put, col, row, ellipse(8, 9 - hop, 6.5, 6), () => MASHI);
		dots(put, col, row, [[8, 15], [7, 15]].map(([x, y]) => [x, y - hop]), INK);
		if (dir === "up") return;
		const s = shiftOf(dir);
		// o と c … 目、M の 口、ほっぺ
		dots(put, col, row, [[4 + s, 8 - hop], [5 + s, 8 - hop], [11 + s, 8 - hop], [12 + s, 8 - hop]], EYE);
		dots(put, col, row, [[6 + s, 13 - hop], [6 + s, 12 - hop], [7 + s, 11 - hop], [8 + s, 12 - hop], [9 + s, 11 - hop], [10 + s, 12 - hop], [10 + s, 13 - hop]], EYE);
		dots(put, col, row, [[3 + s, 10 - hop], [13 + s, 10 - hop]], CHEEK);
	});

// ───────────────── 書き出し ─────────────────

/** プレビュー（n 倍・背景つき）。 */
const scaleOn = (img, n, bg) => {
	const W = img.w * n;
	const H = img.h * n;
	const out = Buffer.alloc(W * H * 4);
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) {
			const s = (Math.floor(y / n) * img.w + Math.floor(x / n)) * 4;
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
for (const [name, img] of [
	["panhei", panhei()],
	["kinonyan", kinonyan()],
	["ofurou", ofurou()],
	["denchan", denchan()],
	["natsuko", natsuko()],
	["takonomin", takonomin()],
	["mashii", mashii()],
]) {
	save(join(outDir, `${name}.png`), img);
	if (previewDir) save(join(resolve(previewDir), `${name}.png`), scaleOn(img, 8, [88, 120, 72]));
}
