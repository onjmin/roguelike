// RPGEN の 部品を 1枚に まとめる（node scripts/pack-rpgen.mjs → public/sprites/rpgen-modern.png と
// src/data/village/rpgenArt.ts）。
//
// 絵は RPGEN（https://rpgen.us/）の スプライトセット「現代 外装」「現代 建物」「和風の建物」「窓/ドア」「看板,貼り紙」
// 「標識」「駅」「夏祭り素材集」「金銀屋根」「食べ物/飲み物」「鉢植」「近代柵」「絨毯」から 選んだ 16x16 の 部品
// （検索: https://rpgen-search.pages.dev/）。施設の 外観・自販機・止まっている 車・バス停に 使う
// （data/village/facilities.ts の GridLook）。赤い 灯りと 赤十字の 2つだけ ここで 手描き（drawn）。
//
// ゲームは CDN を 見ない（村の 絵は 同梱の 画像だけ）。部品は 作る ときに CDN から 取る：
//   https://rpgen-search.pages.dev/data/images/sprites/<id>.png（認証 なし）
//   node scripts/pack-rpgen.mjs                    … CDN から 取って 書き出す
//   node scripts/pack-rpgen.mjs --cache <dir>      … <dir>/<id>.png が あれば それを 使い、無ければ 取って そこへ 置く
//
// 群（GROUPS）は 部品の 並び（行ごと）。アトラス（幅 16 マス）の 中でも 群は くっつけて 置く（群の 順に、
// 上から 最初に 入る 所へ）ので、自販機 2x2・車 4x2 などは 1枚の 絵として 切り出せる。
// 加工（op）: flip（群ごと 左右反転。並びも 逆に なる）・hue:<度>（彩度 0.15 以上の 画素の 色相を 回す。
// 灰色は そのまま）・tint:<rrggbb>（明るさ × 1.35 × 色）・gray:<度>-<度>（その 色相の 色だけ 灰に）。
// + で つなぐと 順に かける（flip+hue:200）。
//
// 依存なし（zlib だけ）。PNG の 書き方は make-street.mjs と 同じ。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PNG = join(HERE, "../public/sprites/rpgen-modern.png");
const OUT_TS = join(HERE, "../src/data/village/rpgenArt.ts");
const CDN = "https://rpgen-search.pages.dev/data/images/sprites/";

// ───────────────── 部品の 一覧（コメントは 出どころ：セットの 番号と その 中の 番号） ─────────────────

const GROUPS = {
	// 屋上（set 24 現代 建物）。平らな 屋根の 上の ふち 3・下の ふち 3、コンクリート、天窓、給水タンク
	roofFlat: {
		ids: [
			["FLa4GNd", "voeAmJt", "Dzb6PB0"],
			["ARxtsDP", "Bf7Zj2p", "ml6pxKd"],
		],
	}, // 24: 6 7 8 / 46 47 48
	concrete: { ids: [["FnkGK2"]] }, // 24: 21
	roofSlab: {
		ids: [
			["57HQdZ", "3iOW4r", "3i4Wx0"],
			["7cOdIm", "EgBh8O", "515QfM"],
		],
	}, // 24: 0 1 2 / 40 41 42
	skylight: { ids: [["cYqnurR"]] }, // 24: 64
	waterTank: { ids: [["NdpzjX"]] }, // 24: 184
	// 屋根（set 24・21）。軒（列0 赤・列1 青。上段・下段）、寄棟（赤・青）、和の 大屋根 5x2、切妻 3x2
	eave: {
		ids: [
			["Rgr6eY", "j9ZNwK"],
			["DzADPjm", "RgyUeO5"],
		],
	}, // 24: 154 155 / 174 175
	hipRed: {
		ids: [
			["BfbYjnq", "YBH2EE5", "EjVchBo"],
			["2hgPYeC", "q0DM3AR", "Zqo6Mjb"],
		],
	}, // 24: 128 129 130 / 148 149 150
	hipBlue: {
		ids: [
			["4aEXOMy", "VZvKXnv", "bnxkZJl"],
			["arjbtzF", "EjVxhyO", "VZvGXI5"],
		],
	}, // 24: 131 132 133 / 151 152 153
	jpRoof: {
		ids: [
			["j9UpweI", "j9ULwuJ", "kQ88K7d", "FLKkGiT", "CvovSey"],
			["ARg8sDm", "HbMHV1y", "14JT7Dy", "TdOW1ym", "bn3HZFk"],
		],
	}, // 21: 9〜13 / 21〜25
	jpGable: {
		ids: [
			["voPXmoG", "TdaL1S", "Q8glAbI"],
			["XMWwba5", "voPAmUI", "p58okgk"],
		],
	}, // 21: 0 1 2 / 18 19 20
	// 壁（set 24・21・25）
	white: {
		ids: [
			["7OGcdo4", "07fDTmm", "cYqAuN"],
			["wF4Hfdd", "KAI355M", "uE352jl"],
			["nWhCqOQ", "EjTQhBs", "VZc4XqW"],
		],
	}, // 24: 12 13 14 / 32 33 34 / 52 53 54
	gray: {
		ids: [
			["fU89hB", "hfKBMe", "8gMRgI"],
			["RH1eyq", "bqaZYk", "OyiJAg"],
		],
	}, // 24: 71 72 73 / 86 87 88
	beige: {
		ids: [
			["FLEuG4z", "dJ7r47C", "3TVeW5Z"],
			["voa7mUP", "uEc92id", "7Ongdk"],
		],
	}, // 24: 29 30 31 / 49 50 51
	// 白い 漆喰に 木の 腰（蔵・和の 家）
	shin: {
		ids: [
			["6yog2x", "VSiXCD", "mUQxhy"],
			["7chdZc", "BVMjna", "D5sP4w"],
		],
	}, // 24: 68 69 70 / 83 84 85
	// 赤レンガ・黒レンガ・灰の 石・ガラスブロック・鉄板・格子
	wallTex: {
		ids: [["EWhWfx", "0JNThb", "Q86PA7D", "q0n3vW", "LKLpjw", "uERw2jt"]],
	}, // 24: 109 111 112 113 114 115
	// ガラス（紫・水色・灰）
	glass: { ids: [["kQTsKOv", "JKZaGM", "KAt25Y8"]] }, // 24: 156 157 158
	shutter: { ids: [["M3hNnJI", "Q8xtA3S"]] }, // 24: 102 103
	shutterRed: { ids: [["M3hNnJI", "Q8xtA3S"]], op: "tint:c83228" }, // 24: 102 103
	// 開いた 車庫の 口（暗い）
	bay: { ids: [["nWFlqom", "OtGXJAA"]] }, // 24: 107 108
	// 和の 壁（上段・店先・入口・板壁）
	jpLow: {
		ids: [["YBaCEfL", "kQDzKqS", "HbjfV5y", "3TpkWqu", "kQDDKGO"]],
	}, // 21: 60〜64
	jpFront: {
		ids: [["M30Vno5", "6VbAgu", "gXZAHtD", "Uk5BLPn", "eHXk6p8"]],
	}, // 21: 33〜37
	jpEnt: { ids: [["07JcTbs", "M31lnrA", "p58TkI4"]] }, // 21: 45 46 47
	jpWood: { ids: [["07JATni", "q0dk3y0"]] }, // 21: 58 59
	// 板壁（上・下）・よしず（set 25 現代 外装）
	plank: { ids: [["rI2fCj5"], ["DzG5PXF"]] }, // 25: 0 / 20
	reed: { ids: [["HbLAVrZ"]] }, // 25: 21
	// 平らな 帯（set 175 金銀屋根。行0 青・行1 だいだい・行2 紫・行3 金・行4 桃の しま）
	band: {
		ids: [
			["vzirm9f", "hL9cBbn", "INlrvfz"],
			["wKLXfpx", "xuNLoNm", "8ZVaRbh"],
			["n4dKqeK", "u9fr2ME", "Kg6Y5mE"],
			["jGhmwID", "h9YSB53", "043QTSh"],
			["oz1mlhm", "BGvhjMj", "0Os0TuS"],
		],
	}, // 175: 87 88 89 / 84 85 86 / 90 91 92 / 9 10 11 / 72 73 74
	// 窓（白枠・黄枠の 店の 窓・木の 窓 2）
	win24: { ids: [["p5JNk7z", "3T2QW4k", "rIB3CE", "07D7T7w"]] }, // 24: 176 177 134 136
	// 窓（set 108 窓/ドア。青い 窓・小窓 2・灯りの 窓・格子窓・格子・障子）
	win108: {
		ids: [
			["cBwvuQM", "j9yTwZR", "uBaf2ZC", "NuUpzu1", "UkEcLAL", "uERw2jt", "arvntSG"],
		],
	}, // 108: 23 74 75 4 3 16 49
	shopGlass: { ids: [["fLvj9H", "P27DNNG", "0450T3k"]] }, // 108: 40 41 42
	autoDoor: {
		ids: [
			["VMT9XwX", "4tv6Oo0"],
			["rvDXCCF", "9LAlFwI"],
		],
	}, // 108: 62 63 / 81 82
	curtainBig: {
		ids: [
			["14mA7pO", "M3tGnYq", "6V1Eg1d"],
			["BfAtjnK", "ySzerRS", "Q8niA2q"],
		],
	}, // 108: 45 46 47 / 64 65 66
	winPink: {
		ids: [
			["uhkv2UE", "zYLIcKv"],
			["MWyRnSr", "9L62FSc"],
		],
	}, // 108: 57 58 / 76 77
	flowerBox: { ids: [["86YIRfp", "Nudgzf"]] }, // 108: 33 34
	// 扉（鉄・赤い 飾り扉・だいだい）
	door108: { ids: [["oNQTlVG", "6bmPgz8", "yvU5rMf"]] }, // 108: 87 89 90
	archTall: { ids: [["7OoDd20"], ["NuUpzu1"]] }, // 25: 4 / 24
	pillar: { ids: [["Tdv01c9"], ["xiBvotF"], ["6V18gY0"]] }, // 25: 19 / 39 / 59
	// 看板（set 92 看板,貼り紙・98 駅・25・109 夏祭り・102 標識・35 食べ物）
	led: { ids: [["Ef1Phcw", "ZWE6Mjj", "IletvXx", "7aUWdA3"]] }, // 92: 91〜94
	ledGray: { ids: [["8HiIRTh", "SoR5If5", "pAStk7E", "fLJd9UK"]] }, // 92: 81〜84
	banner: { ids: [["YB18E4t", "SmeBIhr"]] }, // 92: 48 49（心技体）
	// 非常口・青い 掲示板・額の 絵 3
	sign92: { ids: [["o1YlXX", "p5Slkwn", "p5SCkbm", "uE0U213", "Wef0N9"]] }, // 92: 43 8 45 47 80
	// 駅の 発車の 板
	depart: { ids: [["8HiIRTh", "SoR5If5", "pAStk7E", "fLJd9UK"]] }, // 98: 0〜3
	// SHOP・青い 札・丸い 時計
	sign25: { ids: [["mlgsxhH", "gXc3Hum", "ySUsrWo"]] }, // 25: 60 42 104
	kooriFlag: { ids: [["Nh9czgx"]] }, // 109: 24
	lanternStone: { ids: [["vDjbmUF"]] }, // 109: 36
	caution: { ids: [["0OcuTmk"]] }, // 102: 0
	// 屋台の 日よけ（行0 青・行1 赤）
	canopy: {
		ids: [
			["XW7sb4q", "n7Jeqrx", "EFplhyf"],
			["F58BG3W", "DYjvP1f", "kRHfKM3"],
		],
	}, // 109: 12 13 14 / 15 16 17
	ramenBowl: { ids: [["rIp9Cjm"]] }, // 35: 62
	// 街の 小物（set 25）。自販機（赤。青は 色相を 回す）・バス停・郵便受けほか
	vend: {
		ids: [
			["BfW6jCF", "seId8x5"],
			["XMPybTd", "Sm5hIOj"],
		],
	}, // 25: 63 64 / 83 84
	vendBlue: {
		ids: [
			["BfW6jCF", "seId8x5"],
			["XMPybTd", "Sm5hIOj"],
		],
		op: "hue:210",
	}, // 25: 63 64 / 83 84
	busStop: { ids: [["uwu2Mv"], ["mzoxyh"]] }, // 25: 78 / 98
	// 郵便受け・消火器・木箱・木の 手すり
	small25: { ids: [["lPpZiF8", "q0cB3Uj", "MeEnS1", "iNMFDSL"]] }, // 25: 40 74 124 44
	bike: { ids: [["ZqhvMFS", "tCAEynU"]] }, // 25: 184 185
	// 鉢（黄の 花・桃の 花・観葉植物・ヤシ・赤い 花）
	pot: { ids: [["j90awu4", "lPebik6", "KAyy5dw", "Zq04MnD", "IxMsvFo"]] }, // 25: 6 7 10 11 47
	box: { ids: [["uE0W20i", "W1h90Vs"]] }, // 25: 100 101
	planter: { ids: [["0dBBTLN", "N2XZzNR", "2BnMYfX"]] }, // 80: 13 14 15
	fence: { ids: [["oeElvL", "LaApqw", "OGvJb2"]] }, // 25: 175 176 177
	rope: { ids: [["EFZxhkl", "56afQbj"]] }, // 125: 12 13
	redCarpet: { ids: [["AVhesgo"]] }, // 210: 4
	// 車（set 25。正面 2x2・横向き 4x2。W は 左向き・E は 右向き）
	carFront: {
		ids: [
			["9kiFOq", "UQPLm4"],
			["wLifQc", "psukMy"],
		],
	}, // 25: 106 107 / 126 127
	sedanE: {
		ids: [
			["Tv31I3", "LV9pUy", "xBCouY", "xBroMV"],
			["sWR8cS", "upu2V6", "S2CIq5", "kbLKix"],
		],
		op: "flip",
	}, // 25: 143〜146 / 163〜166
	sedanBlueW: {
		ids: [
			["Tv31I3", "LV9pUy", "xBCouY", "xBroMV"],
			["sWR8cS", "upu2V6", "S2CIq5", "kbLKix"],
		],
		op: "hue:200",
	}, // 25: 143〜146 / 163〜166
	// 白い ワゴン（黄色い 車体だけ 灰に）
	wagonWhiteW: {
		ids: [
			["F6cG6Z", "IY1vbe", "WSR0Bc", "nyQqBg"],
			["F6EGaJ", "AqGsI1", "MtRnE6", "cLvu4s"],
		],
		op: "gray:25-75",
	}, // 25: 147〜150 / 167〜170
	wagonE: {
		ids: [
			["F6cG6Z", "IY1vbe", "WSR0Bc", "nyQqBg"],
			["F6EGaJ", "AqGsI1", "MtRnE6", "cLvu4s"],
		],
		op: "flip",
	}, // 25: 147〜150 / 167〜170
	// 手描き（下の drawn）
	redLamp: { drawn: "redLamp" },
	redCross: { drawn: "redCross" },
};

// ───────────────── 最小 PNG（書き: RGBA 8bit。読み: 非インターレースの 灰・RGB・パレット・灰＋α・RGBA） ─────────────────

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
/** 色の 形 → 1画素の 値の 数（0 灰・2 RGB・3 パレット・4 灰＋α・6 RGBA）。 */
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const decodePng = (buf, name) => {
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
			if (data[12]) throw new Error(`${name}: インターレースは 読めません`);
		} else if (type === "PLTE") plte = data;
		else if (type === "tRNS") trns = data;
		else if (type === "IDAT") idat.push(data);
		p += 12 + len;
	}
	const chans = CHANNELS[ctype];
	const subByte = ctype === 0 || ctype === 3;
	if (!chans || depth > 8 || (!subByte && depth !== 8))
		throw new Error(`${name}: 色の 形 ${ctype}/${depth} は 読めません`);
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
	// 1バイトに 満たない 値（1・2・4bit）は 左の 画素から 上の ビットに 詰まっている
	const sample = (line, x) => {
		if (depth === 8) return line[x];
		const per = 8 / depth;
		return (
			(line[Math.floor(x / per)] >> (8 - depth * ((x % per) + 1))) &
			((1 << depth) - 1)
		);
	};
	const maxV = (1 << depth) - 1;
	const rgba = Buffer.alloc(w * h * 4);
	for (let y = 0; y < h; y++) {
		const line = lines.subarray(y * stride, (y + 1) * stride);
		for (let x = 0; x < w; x++) {
			const o = (y * w + x) * 4;
			if (ctype === 3) {
				const idx = sample(line, x);
				plte.copy(rgba, o, idx * 3, idx * 3 + 3);
				rgba[o + 3] = trns && idx < trns.length ? trns[idx] : 255;
			} else if (ctype === 0) {
				const v = sample(line, x);
				const g = Math.round((v * 255) / maxV);
				rgba[o] = g;
				rgba[o + 1] = g;
				rgba[o + 2] = g;
				// tRNS は 透明に する 灰の 値（2バイト）
				rgba[o + 3] = trns && trns.readUInt16BE(0) === v ? 0 : 255;
			} else if (ctype === 2) {
				line.copy(rgba, o, x * 3, x * 3 + 3);
				// tRNS は 透明に する 色（R・G・B 2バイトずつ）
				const key =
					trns &&
					trns.readUInt16BE(0) === line[x * 3] &&
					trns.readUInt16BE(2) === line[x * 3 + 1] &&
					trns.readUInt16BE(4) === line[x * 3 + 2];
				rgba[o + 3] = key ? 0 : 255;
			} else if (ctype === 4) {
				rgba[o] = line[x * 2];
				rgba[o + 1] = line[x * 2];
				rgba[o + 2] = line[x * 2];
				rgba[o + 3] = line[x * 2 + 1];
			} else line.copy(rgba, o, x * 4, x * 4 + 4);
		}
	}
	return { w, h, rgba };
};

// ───────────────── 加工 ─────────────────

/** 16x16 の 絵（RGBA）。 */
const CELL = 16;
const blank = (w, h) => ({ w, h, rgba: Buffer.alloc(w * h * 4) });
/** 上に 重ねる（α で まぜる）。 */
const paste = (dst, src, dx, dy) => {
	for (let y = 0; y < src.h; y++)
		for (let x = 0; x < src.w; x++) {
			const s = (y * src.w + x) * 4;
			const a = src.rgba[s + 3];
			if (!a) continue;
			const d = ((dy + y) * dst.w + dx + x) * 4;
			if (a === 255) {
				src.rgba.copy(dst.rgba, d, s, s + 4);
				continue;
			}
			const da = dst.rgba[d + 3];
			const oa = a + (da * (255 - a)) / 255;
			for (let k = 0; k < 3; k++)
				dst.rgba[d + k] = Math.round(
					(src.rgba[s + k] * a +
						(dst.rgba[d + k] * da * (255 - a)) / 255) /
						oa,
				);
			dst.rgba[d + 3] = Math.round(oa);
		}
};
const flip = (img) => {
	const out = blank(img.w, img.h);
	for (let y = 0; y < img.h; y++)
		for (let x = 0; x < img.w; x++)
			img.rgba.copy(
				out.rgba,
				(y * img.w + (img.w - 1 - x)) * 4,
				(y * img.w + x) * 4,
				(y * img.w + x) * 4 + 4,
			);
	return out;
};
// 色相の 計算は Python の colorsys（HLS）と 同じ（下見の 絵と そろえる）
const rgbToHls = (r, g, b) => {
	const mx = Math.max(r, g, b);
	const mn = Math.min(r, g, b);
	const l = (mx + mn) / 2;
	if (mx === mn) return [0, l, 0];
	const range = mx - mn;
	const s = l <= 0.5 ? range / (mx + mn) : range / (2 - mx - mn);
	const rc = (mx - r) / range;
	const gc = (mx - g) / range;
	const bc = (mx - b) / range;
	const h = r === mx ? bc - gc : g === mx ? 2 + rc - bc : 4 + gc - rc;
	return [(((h / 6) % 1) + 1) % 1, l, s];
};
const hlsV = (m1, m2, hue) => {
	const h = ((hue % 1) + 1) % 1;
	if (h < 1 / 6) return m1 + (m2 - m1) * h * 6;
	if (h < 0.5) return m2;
	if (h < 2 / 3) return m1 + (m2 - m1) * (2 / 3 - h) * 6;
	return m1;
};
const hlsToRgb = (h, l, s) => {
	if (s === 0) return [l, l, l];
	const m2 = l <= 0.5 ? l * (1 + s) : l + s - l * s;
	const m1 = 2 * l - m2;
	return [hlsV(m1, m2, h + 1 / 3), hlsV(m1, m2, h), hlsV(m1, m2, h - 1 / 3)];
};
const eachPixel = (img, fn) => {
	const out = blank(img.w, img.h);
	img.rgba.copy(out.rgba);
	for (let o = 0; o < out.rgba.length; o += 4) {
		if (!out.rgba[o + 3]) continue;
		const c = fn(out.rgba[o], out.rgba[o + 1], out.rgba[o + 2]);
		if (!c) continue;
		out.rgba[o] = c[0];
		out.rgba[o + 1] = c[1];
		out.rgba[o + 2] = c[2];
	}
	return out;
};
const hue = (img, deg) =>
	eachPixel(img, (r, g, b) => {
		const [h, l, s] = rgbToHls(r / 255, g / 255, b / 255);
		if (s < 0.15) return null;
		return hlsToRgb((h + deg / 360) % 1, l, s).map((v) => Math.trunc(v * 255));
	});
const tint = (img, hex) => {
	const c = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
	return eachPixel(img, (r, g, b) => {
		const l = Math.min(1, ((r * 0.3 + g * 0.59 + b * 0.11) / 255) * 1.35);
		return c.map((v) => Math.trunc(v * l));
	});
};
/** 色相が from〜to 度の 色だけ 灰に（明るさは 少し 上げる。黄色い 車を 白く する）。 */
const gray = (img, from, to) =>
	eachPixel(img, (r, g, b) => {
		const [h, l, s] = rgbToHls(r / 255, g / 255, b / 255);
		const d = h * 360;
		if (s < 0.15 || d < from || d > to) return null;
		const v = Math.min(255, Math.trunc(l * 255 * 1.25));
		return [v, v, Math.min(255, v + 4)];
	});
/** 加工（「flip+hue:30」の ように + で つなぐと 順に かける）。 */
const applyOp = (img, op) => {
	if (!op) return img;
	return op.split("+").reduce((im, o) => {
		if (o === "flip") return flip(im);
		if (o.startsWith("hue:")) return hue(im, Number(o.slice(4)));
		if (o.startsWith("tint:")) return tint(im, o.slice(5));
		if (o.startsWith("gray:")) {
			const [from, to] = o.slice(5).split("-").map(Number);
			return gray(im, from, to);
		}
		throw new Error(`知らない 加工: ${o}`);
	}, img);
};

// ───────────────── 手描き ─────────────────

const rgb = (hex) => [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const dot = (img, x, y, hex) => {
	const o = (y * img.w + x) * 4;
	const [r, g, b] = rgb(hex);
	img.rgba[o] = r;
	img.rgba[o + 1] = g;
	img.rgba[o + 2] = b;
	img.rgba[o + 3] = 255;
};
const DRAWN = {
	/** 赤い 灯り（交番・警察署・消防の 壁に 付ける 丸い ランプ。下に 金具）。 */
	redLamp: () => {
		const img = blank(CELL, CELL);
		const rows = { 3: [6, 9], 4: [5, 10], 5: [4, 11], 6: [4, 11], 7: [4, 11], 8: [5, 10] };
		for (const [y, [a, b]] of Object.entries(rows))
			for (let x = a; x <= b; x++) dot(img, x, Number(y), "d2201c");
		for (let x = 5; x <= 10; x++) dot(img, x, 9, "6e1010");
		for (const [x, y] of [
			[4, 8],
			[11, 8],
			[4, 7],
			[11, 7],
		])
			dot(img, x, y, "6e1010");
		for (const [x, y] of [
			[6, 4],
			[6, 5],
			[7, 4],
		])
			dot(img, x, y, "ff8c78");
		for (let x = 6; x <= 9; x++) dot(img, x, 10, "8c8c94");
		for (const y of [11, 12]) for (const x of [7, 8]) dot(img, x, y, "5a5a62");
		for (let x = 5; x <= 10; x++) dot(img, x, 13, "5a5a62");
		return img;
	},
	/** 赤十字（病院。白い 板に 赤い 十字）。 */
	redCross: () => {
		const img = blank(CELL, CELL);
		for (let y = 2; y <= 13; y++)
			for (let x = 2; x <= 13; x++)
				dot(img, x, y, x === 2 || x === 13 || y === 2 || y === 13 ? "96969e" : "f6f6f6");
		for (let y = 4; y <= 11; y++) for (let x = 6; x <= 9; x++) dot(img, x, y, "d42424");
		for (let y = 6; y <= 9; y++) for (let x = 4; x <= 11; x++) dot(img, x, y, "d42424");
		for (let x = 6; x <= 9; x++) dot(img, x, 11, "a01616");
		for (const x of [4, 5, 10, 11]) dot(img, x, 9, "a01616");
		return img;
	},
};

// ───────────────── 取りこみ ─────────────────

const arg = (name) => {
	const i = process.argv.indexOf(name);
	return i >= 0 ? process.argv[i + 1] : undefined;
};
const cacheDir = arg("--cache") ? resolve(arg("--cache")) : undefined;
if (cacheDir) mkdirSync(cacheDir, { recursive: true });

const fetchPiece = async (id) => {
	const local = cacheDir && join(cacheDir, `${id}.png`);
	if (local && existsSync(local)) return readFileSync(local);
	const res = await fetch(`${CDN}${id}.png`);
	if (!res.ok) throw new Error(`${id}: ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	if (local) writeFileSync(local, buf);
	return buf;
};

const ids = [
	...new Set(
		Object.values(GROUPS).flatMap((g) => (g.ids ? g.ids.flat() : [])),
	),
];
const pieces = new Map();
for (let i = 0; i < ids.length; i += 16)
	await Promise.all(
		ids.slice(i, i + 16).map(async (id) => {
			const img = decodePng(await fetchPiece(id), id);
			if (img.w !== CELL || img.h !== CELL)
				throw new Error(`${id}: ${img.w}x${img.h}（16x16 では ない）`);
			pieces.set(id, img);
		}),
	);

// ───────────────── 詰める ─────────────────

const COLS = 16;
const used = [];
const free = (c, r, w, h) => {
	for (let y = r; y < r + h; y++) {
		while (used.length <= y) used.push(new Array(COLS).fill(false));
		for (let x = c; x < c + w; x++) if (x >= COLS || used[y][x]) return false;
	}
	return true;
};
const cells = {};
for (const [name, g] of Object.entries(GROUPS)) {
	const w = g.ids ? Math.max(...g.ids.map((r) => r.length)) : 1;
	const h = g.ids ? g.ids.length : 1;
	let spot = null;
	for (let r = 0; !spot; r++)
		for (let c = 0; c < COLS && !spot; c++) if (free(c, r, w, h)) spot = [c, r];
	const [c, r] = spot;
	for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) used[y][x] = true;
	cells[name] = [c, r, w, h];
}
const atlas = blank(COLS * CELL, used.length * CELL);
for (const [name, g] of Object.entries(GROUPS)) {
	const [c, r, w, h] = cells[name];
	let img;
	if (g.drawn) img = DRAWN[g.drawn]();
	else {
		img = blank(w * CELL, h * CELL);
		g.ids.forEach((row, y) => {
			row.forEach((id, x) => {
				paste(img, pieces.get(id), x * CELL, y * CELL);
			});
		});
		img = applyOp(img, g.op);
	}
	paste(atlas, img, c * CELL, r * CELL);
}
mkdirSync(dirname(OUT_PNG), { recursive: true });
writeFileSync(OUT_PNG, encodePng(atlas.w, atlas.h, atlas.rgba));

// ───────────────── 索引（TS） ─────────────────

const ts = `// scripts/pack-rpgen.mjs が 書き出す（手で 書きかえない。部品を かえる ときは pack-rpgen.mjs の GROUPS）。
// 絵は RPGEN（https://rpgen.us/）の スプライトセットから 選んで 1枚に まとめた もの
// （検索: https://rpgen-search.pages.dev/）。赤い 灯り・赤十字の 2つだけ 手描き。

/** まとめた 絵（public/sprites/rpgen-modern.png。${atlas.w}x${atlas.h}）。 */
export const RPGEN_IMG = "pub:sprites/rpgen-modern.png";
export const RPGEN_SIZE = [${atlas.w}, ${atlas.h}] as const;

/** 群の 名前 → [列, 行, 幅, 高さ]（アトラスの マス）。 */
export const RPGEN_CELLS = {
${Object.entries(cells)
	.map(([n, v]) => `\t${n}: [${v.join(", ")}],`)
	.join("\n")}
} as const;

export type RpgenName = keyof typeof RPGEN_CELLS;

/**
 * 群の 中の (x, y) マスから w×h マス。縦に 2マスの 物は h=2 で 16x32 に 切る
 * （下端そろえで 上の マスへ はみ出す。data/village/tiles.ts の 書き方と 同じ）。
 */
export const art = (name: RpgenName, x = 0, y = 0, w = 1, h = 1): string => {
\tconst [c, r] = RPGEN_CELLS[name];
\treturn \`\${RPGEN_IMG}#\${(c + x) * 16},\${(r + y) * 16},\${w * 16},\${h * 16}\`;
};
`;
writeFileSync(OUT_TS, ts);
console.log(
	`${OUT_PNG}（${atlas.w}x${atlas.h}・群 ${Object.keys(cells).length}・部品 ${ids.length}）`,
);
console.log(OUT_TS);
