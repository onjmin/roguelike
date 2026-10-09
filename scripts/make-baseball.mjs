// 1打席の 絵を 1枚に まとめて 書き出す（node scripts/make-baseball.mjs）。
//
//   public/sprites/baseball.png … 球場（打席から・上から）、キリコ、ピッチャー、野手、球、花火 など（1024x432）
//   src/data/baseballSheet.ts   … どの 絵が シートの どこに あるか（BB_SPR。この スクリプトが 書く。手で 直さない）
//
// 絵の 出どころ:
//   - 球場・キリコの 打つ 絵・ピッチャー・キャッチャー・審判・球・数字 … ここで 描く（形を 重ねて、最後に ふちを 自動で 付ける）。
//     色は 村の 歩行グラから 拾った（キリコ sa:vHsmy5・原住民 sa:nabqyI・やきう sa:4rSOzo・名無し sa:xjuotB）。
//   - 上から 見た 場面の 人（16x16）・当たった 光・吹き出し・花火 … RPGEN の 素材を 作る ときに 取ってきて 貼る（遊ぶ ときは CDN を 見ない）。
//     RPGEN（https://rpgen-search.pages.dev）の スプライトセット「なんJキャラ」(73)・「エフェクト」(197)・「夏祭り素材集」(109)と、
//     歩行グラ（キリコ・原住民・やきう・名無し 4人）。作者の みなさんに 感謝。
//     「野球選手スプライト」(26)は 実在の 選手の 写真と 球団の 帽子なので 使わない。
//
//   node scripts/make-baseball.mjs                  … 上の 2つを 書く（RPGEN の 絵は CDN から 取る）
//   node scripts/make-baseball.mjs --cache <dir>    … RPGEN の 絵を <dir>/img/<id>.png・<dir>/sa/<id>.png から 読む（無ければ 取って 置く）
//   node scripts/make-baseball.mjs --mock <dir>     … 3倍の 見本の 場面も 書く
//
// 依存なし（zlib だけ）。乱数は 区切りごとに 種を 置きなおすので、何度 書いても 同じ 絵に なる。

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

// ───────────────── RPGEN の 素材（作る ときだけ 取る） ─────────────────
const CDN = "https://rpgen-search.pages.dev/data/images";
const argv = process.argv.slice(2);
const argOf = (name) => {
	const i = argv.indexOf(name);
	return i >= 0 ? argv[i + 1] : null;
};
const CACHE = argOf("--cache");
/** sp:<id>（16x16 の 1枚）か sa:<id>（歩行グラ 32x64）を 読む。 */
const rpgen = async (ref) => {
	const [kind, id] = ref.split(":");
	const sub = kind === "sa" ? "sa" : "img";
	const local = CACHE ? join(CACHE, sub, `${id}.png`) : null;
	let buf;
	if (local && existsSync(local)) buf = readFileSync(local);
	else {
		const url = `${CDN}/${kind === "sa" ? "sAnims" : "sprites"}/${id}.png`;
		const res = await fetch(url);
		if (!res.ok) throw new Error(`${url}: ${res.status}`);
		buf = Buffer.from(await res.arrayBuffer());
		if (local) {
			mkdirSync(dirname(local), { recursive: true });
			writeFileSync(local, buf);
		}
	}
	const { w, h, rgba } = decodePng(buf);
	const img = new Img(w, h);
	rgba.copy(img.d);
	return img;
};

// ───────────────── 画素 ─────────────────
const hex = (s) => {
	const n = Number.parseInt(s.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

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
		if (a >= 255) {
			this.d[o] = c[0];
			this.d[o + 1] = c[1];
			this.d[o + 2] = c[2];
			this.d[o + 3] = 255;
			return;
		}
		// 上から 重ねる（下が 透明なら そのまま）
		const ba = this.d[o + 3] / 255;
		const fa = a / 255;
		const oa = fa + ba * (1 - fa);
		for (let i = 0; i < 3; i++)
			this.d[o + i] = Math.round(
				(c[i] * fa + this.d[o + i] * ba * (1 - fa)) / (oa || 1),
			);
		this.d[o + 3] = Math.round(oa * 255);
	}
	get(x, y) {
		const o = (y * this.w + x) * 4;
		return [this.d[o], this.d[o + 1], this.d[o + 2], this.d[o + 3]];
	}
	rect(x, y, w, h, c, a = 255) {
		for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a);
	}
	blit(src, sx, sy, sw, sh, dx, dy, flip = false) {
		for (let j = 0; j < sh; j++)
			for (let i = 0; i < sw; i++) {
				const p = src.get(sx + (flip ? sw - 1 - i : i), sy + j);
				if (p[3]) this.set(dx + i, dy + j, p, p[3]);
			}
	}
}

let seed = 1901;
const rnd = () => {
	seed = (seed * 1103515245 + 12345) & 0x7fffffff;
	return seed / 0x7fffffff;
};

// ───────────────── 人物の 層（色の 名前を 置いて、最後に ふち） ─────────────────
class Layer {
	constructor(w, h) {
		this.w = w;
		this.h = h;
		this.c = new Array(w * h).fill(null);
	}
	px(x, y, col) {
		x = Math.round(x);
		y = Math.round(y);
		if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
		this.c[y * this.w + x] = col;
	}
	at(x, y) {
		if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
		return this.c[y * this.w + x];
	}
	/** 楕円（右下を 影に）。 */
	oval(cx, cy, rx, ry, col, shade = null, k = 0.35) {
		for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
			for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
				const dx = (x - cx) / (rx + 0.5);
				const dy = (y - cy) / (ry + 0.5);
				if (dx * dx + dy * dy > 1) continue;
				this.px(x, y, shade && dx * 0.7 + dy * 0.7 > k ? shade : col);
			}
	}
	/** 太さが 変わる 線（w0 → w1）。 */
	stroke(x0, y0, x1, y1, w0, w1, col) {
		const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
		for (let i = 0; i <= n; i++) {
			const t = i / n;
			const r = (w0 + (w1 - w0) * t) / 2;
			const cx = x0 + (x1 - x0) * t;
			const cy = y0 + (y1 - y0) * t;
			for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
				for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
					if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.25) this.px(x, y, col);
		}
	}
	/** 多角形（中を 塗る）。 */
	poly(pts, col) {
		const ys = pts.map((p) => p[1]);
		for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
			const xs = [];
			for (let i = 0; i < pts.length; i++) {
				const [ax, ay] = pts[i];
				const [bx, by] = pts[(i + 1) % pts.length];
				const yy = y + 0.5;
				if ((ay <= yy && by > yy) || (by <= yy && ay > yy))
					xs.push(ax + ((yy - ay) / (by - ay)) * (bx - ax));
			}
			xs.sort((a, b) => a - b);
			for (let i = 0; i + 1 < xs.length; i += 2)
				for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.px(x, y, col);
		}
	}
	/** ふち（4近傍）。skip の 色は ふちを 付けない。 */
	outline(col, skip = []) {
		const add = [];
		for (let y = 0; y < this.h; y++)
			for (let x = 0; x < this.w; x++) {
				if (this.at(x, y) !== null) continue;
				for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
					const n = this.at(x + dx, y + dy);
					if (n !== null && n !== col && !skip.includes(n)) {
						add.push([x, y]);
						break;
					}
				}
			}
		for (const [x, y] of add) this.px(x, y, col);
	}
	draw(img, ox, oy, pal, flip = false) {
		for (let y = 0; y < this.h; y++)
			for (let x = 0; x < this.w; x++) {
				const k = this.at(x, y);
				if (k === null) continue;
				const c = pal[k];
				if (!c) throw new Error(`色が 無い: ${k}`);
				img.set(ox + (flip ? this.w - 1 - x : x), oy + y, hex(c));
			}
	}
}

// ───────────────── シート（どこに 何を 置くか。src/data/baseballSheet.ts にも そのまま 書く） ─────────────────
const SW = 1024;
const SH = 432;
const sheet = new Img(SW, SH);
/** [x, y, w, h, コマ数]。コマは 右へ 並ぶ（歩行グラだけは 32x64 の 1枚：行が 後・右・前・左、列が 足踏み 2コマ）。 */
const LAYOUT = {
	// 打席から 見た 球場（240x150）と、歓声の 帯（客席の 行だけ。(0,18) に 重ねる）
	bgNight: [0, 0, 240, 150, 1],
	bgDay: [240, 0, 240, 150, 1],
	cheerNight: [480, 0, 240, 24, 1],
	cheerDay: [480, 24, 240, 24, 1],
	// 小物
	lamp: [720, 0, 6, 6, 4], // B S O 消
	digit: [744, 0, 4, 6, 10],
	icon: [784, 0, 6, 6, 3], // のこり 使った ホームラン
	ball6: [808, 0, 8, 8, 4],
	ball4: [840, 0, 8, 8, 2],
	ball2: [856, 0, 8, 8, 1],
	shadow6: [864, 0, 8, 8, 1],
	shadow4: [872, 0, 8, 8, 1],
	glint: [880, 0, 8, 8, 2],
	dust: [896, 0, 8, 8, 2],
	// 打席から 見た 遠くの 野手（8x12。0 かまえ 1 うしろを 向く）
	farGen: [720, 24, 8, 12, 2],
	farNanashi: [736, 24, 8, 12, 8], // 名無し 4人（灰・赤・黄・黒）× 2コマ
	// キリコ（56x52・足もと (20,51)。0 構え 1 ため 2 ミート 3 フォロー 4 空振り 5 ガッツ）と スイングの 軌跡
	kiriko: [480, 48, 56, 52, 6],
	trail: [816, 48, 56, 52, 1],
	// ピッチャー（24x32・足もと (12,31)。0 セット 1 足上げ 2 テイクバック 3 リリース 4 フォロー 5 orz 6 よろこぶ）
	pitcherShobon: [480, 100, 24, 32, 7],
	pitcherYakiu: [648, 100, 24, 32, 7],
	pitcherNanashi: [816, 100, 24, 32, 7],
	// 上から 見た 球場（360x280・1m = 2px・本塁 (180,252)）
	fieldNight: [0, 150, 360, 280, 1],
	fieldDay: [360, 150, 360, 280, 1],
	// キャッチャー（24x24・足もと (12,23)）・審判（24x32・足もと (12,31)）
	catcher: [720, 150, 24, 24, 2],
	umpire: [768, 150, 24, 32, 2],
	// 花火（64x32。RPGEN 109 の 4x2。0 もとの 色 1 金と 緑に 塗りかえ）
	fireworks: [816, 150, 64, 32, 2],
	// 歩行グラ（RPGEN。32x64）
	walkKiriko: [720, 182, 32, 64, 1],
	walkGen: [752, 182, 32, 64, 1],
	walkYakiu: [784, 182, 32, 64, 1],
	walkNanashi: [816, 182, 32, 64, 4], // 彡(⭕)(⭕)・赤面J民・陽すこ民・J min Black（本館の 名無しと 同じ）
	// 16x16 の ポーズ（RPGEN 73 なんJキャラ）
	pose: [720, 246, 16, 16, 5],
	// 16x16 の 効果（RPGEN 197 エフェクト）
	fx: [720, 262, 16, 16, 13],
};
/** pose・fx の 何コマ目が 何か（名前・RPGEN の sp id・セットの 何番目か）。 */
const POSE = [
	["genGlove", "sp:gqKDHXh"], // 73#32 原住民（グラブ）：とる 野手
	["genDive", "sp:XqvsbHP"], // 73#41 横倒し原住民：飛びついて とどかない 野手
	["genCatcher", "sp:226YP5"], // 73#40 キャッチャー（うしろ姿）
	["yakiuGlove", "sp:YFlnECi"], // 73#20 やきう（グラブ）：マウンドの やきう
	["yakiuBack", "sp:H35DVOi"], // 73#19 やきう（うしろ姿・グラブ）：打球を 見送る やきう
];
const FX = [
	["impact0", "sp:2fboYeO"], // 197#80 輪
	["impact1", "sp:fk0z9K3"], // 197#81
	["impact2", "sp:2fbmYrK"], // 197#82
	["star", "sp:Ag2Rs6r"], // 197#83 はじける 光
	["spark0", "sp:8VuiRTx"], // 197#126 きらきら
	["spark1", "sp:aIeKtwr"], // 197#127
	["spark2", "sp:NE1bzl3"], // 197#128
	["wow", "sp:uj3B2My"], // 197#158 ！？
	["bang", "sp:QeIXAcO"], // 197#176 ！の 吹き出し
	["what", "sp:Yw3LEl7"], // 197#181 ？の 吹き出し
	["pop", "sp:7tJGdgM"], // 197#153 3本の 線
	["maru", "sp:QX9A7o"], // 197#137 ○
	["batsu", "sp:YUiENf"], // 197#138 ×
];
/** 花火（109 の 4x2。左上から 右へ、2行）。 */
const FIREWORKS = [
	["sp:JXapJE", "sp:DYw4P13", "sp:yxPbrb", "sp:8XqERXR"], // 109#82-85
	["sp:vP2Mm9U", "sp:34yLW2L", "sp:hGKaBT6", "sp:sVnN8fM"], // 109#102-105
];
/** 歩行グラ。 */
const WALKS = {
	walkKiriko: ["sa:vHsmy5"],
	walkGen: ["sa:nabqyI"],
	walkYakiu: ["sa:4rSOzo"],
	walkNanashi: ["sa:xjuotB", "sa:qPN3cT", "sa:C2hS8U", "sa:VaBXqn"],
};
/** LAYOUT の 1コマ目の 左上（i コマ目）。 */
const at = (key, i = 0) => {
	const [x, y, w] = LAYOUT[key];
	return [x + i * w, y];
};

// ───────────────── 看板の 字（9行。10幅の 漢字と 5幅の 英字） ─────────────────
const GLYPH = {
	野: [
		"#####.####",
		"#.#.#...#.",
		"#####..#..",
		"#.#.#.####",
		"#####...##",
		"..#.....#.",
		".###....#.",
		"..#.....#.",
		"#####..##.",
	],
	球: [
		".......#.#",
		"###.######",
		".#......#.",
		".#...#.#.#",
		"###...###.",
		".#.....#..",
		".#.#..#.#.",
		"###..#.#.#",
		".......##.",
	],
	c: [".....", ".....", ".....", ".....", ".###.", "#....", "#....", "#....", ".###."],
	h: [".....", ".....", "#....", "#....", "###..", "#..#.", "#..#.", "#..#.", "#..#."],
	保: [
		"..#######.",
		".#.#...#..",
		".#.#####..",
		"##....#...",
		".#.######.",
		".#....#...",
		".#...###..",
		".#..#.#.#.",
		".#....#...",
	],
	守: [
		"....#.....",
		"##########",
		"#........#",
		"..........",
		"##########",
		"......#...",
		"..#...#...",
		"......#...",
		".....##...",
	],
	村: [
		"..#.....#.",
		"#####...#.",
		"..#..#####",
		".###....#.",
		"#.#.#.#.#.",
		"..#....##.",
		"..#.....#.",
		"..#.....#.",
		"..#....##.",
	],
	B: ["##.", "#.#", "##.", "#.#", "##."],
	S: ["###", "#..", "###", "..#", "###"],
	O: [".#.", "#.#", "#.#", "#.#", ".#."],
	k: ["#..", "#.#", "##.", "#.#", "#.#"],
	m: ["...", "###", "###", "#.#", "#.#"],
	"/": ["..#", "..#", ".#.", "#..", "#.."],
	H: ["#..", "#..", "###", "#.#", "#.#"],
};
const DIGIT = [
	["###", "#.#", "#.#", "#.#", "###"],
	[".#.", "##.", ".#.", ".#.", "###"],
	["###", "..#", "###", "#..", "###"],
	["###", "..#", "###", "..#", "###"],
	["#.#", "#.#", "###", "..#", "..#"],
	["###", "#..", "###", "..#", "###"],
	["###", "#..", "###", "#.#", "###"],
	["###", "..#", ".#.", ".#.", ".#."],
	["###", "#.#", "###", "#.#", "###"],
	["###", "#.#", "###", "..#", "###"],
];
const glyph = (img, rows, x, y, c, a = 255) => {
	rows.forEach((r, j) => {
		[...r].forEach((ch, i) => {
			if (ch === "#") img.set(x + i, y + j, c, a);
		});
	});
};
const word = (img, chars, x, y, c, gap = 1) => {
	let cx = x;
	for (const ch of chars) {
		const g = GLYPH[ch];
		glyph(img, g, cx, y, c);
		cx += g[0].length + gap;
	}
	return cx - gap;
};
const wordWidth = (chars, gap = 1) =>
	[...chars].reduce((w, ch) => w + GLYPH[ch][0].length + gap, -gap);

// ───────────────── 球場（地面の 色は 上から 見た 場所で 決める） ─────────────────
// 単位は m。本塁が 原点、+Z が センター、+X が 一塁がわ。
const DIAM = 27.43;
const MOUND_Z = 18.44;
const FENCE = 95;
const S2 = Math.SQRT1_2;
const BASES = [
	[DIAM * S2, DIAM * S2],
	[0, DIAM * 2 * S2],
	[-DIAM * S2, DIAM * S2],
];
const THEME = {
	night: {
		grass: [hex("#2e7438"), hex("#378342")],
		foul: hex("#2a6634"),
		dirt: hex("#a97a52"),
		dirt2: hex("#b98a5e"),
		line: hex("#eeeee4"),
		track: hex("#86603e"),
	},
	day: {
		grass: [hex("#58a040"), hex("#64ae4a")],
		foul: hex("#4f9438"),
		dirt: hex("#c89a64"),
		dirt2: hex("#d6aa72"),
		line: hex("#fbfbf2"),
		track: hex("#a8805a"),
	},
};
/** 地面の 色（フェンスの 外は null）。 */
const ground = (X, Z, th) => {
	const t = THEME[th];
	const r = Math.hypot(X, Z);
	if (r > FENCE) return null;
	if (r > FENCE - 4) return t.track;
	// 線（ファウルラインと バッターボックス）
	if (Z > 0 && Math.abs(Math.abs(X) - Z) < 0.13) return t.line;
	const ax = Math.abs(X);
	if (Z > -1.1 && Z < 1.1 && ax > 0.3 && ax < 1.3 && (ax < 0.42 || ax > 1.18 || Z < -0.98 || Z > 0.98))
		return t.line;
	// 本塁（五角形を 四角で）
	if (ax < 0.24 && Z > -0.43 && Z < 0) return t.line;
	// ベース
	for (const [bx, bz] of BASES) if (Math.abs(X - bx) < 0.3 && Math.abs(Z - bz) < 0.3) return t.line;
	// プレート
	if (ax < 0.35 && Math.abs(Z - MOUND_Z) < 0.12) return t.line;
	const dm = Math.hypot(X, Z - MOUND_Z);
	if (dm < 2.8) return t.dirt2;
	if (Math.hypot(X, Z) < 4.2) return t.dirt;
	const u = (X + Z) * S2;
	const v = (Z - X) * S2;
	const fair = Z >= ax - 0.01;
	const inDiamond = u > 1.4 && u < DIAM - 1.4 && v > 1.4 && v < DIAM - 1.4;
	if (dm < 29 && Z > ax - 3 && !inDiamond) return t.dirt;
	// 芝（刈りあとの しま）
	if (!fair) return t.foul;
	const k = (Math.floor(u / 6) + Math.floor(v / 6)) & 1;
	return t.grass[k];
};

// 打席から 見る 絵（キャッチャーの うしろ。高さ 3.5m・本塁の 7m うしろ）
const HZ = 42.4;
const F = 163.2;
const CH = 3.5;
const CZ = 7;
const CX = 120;

const CROWD = ["#d8b494", "#3a2c28", "#ece8f0", "#c84848", "#4a74c4", "#e0c040", "#6a9a50", "#a070c0"].map(hex);

/** フェンスの 上と 下の y（その 列で）。 */
const fenceAt = (x) => {
	const a = (x + 0.5 - CX) / F;
	const A = 1 + a * a;
	const B = 2 * a * a * CZ;
	const C = a * a * CZ * CZ - FENCE * FENCE;
	const Z = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
	return { top: HZ + (F * (CH - 2.6)) / (Z + CZ), base: HZ + (F * CH) / (Z + CZ) };
};

/** 客席（y0..y1）。cheer なら 何人かが 腕を あげて 1ドット 上に。 */
const stands = (img, ox, oy, y0, y1, th, cheer) => {
	const seatA = th === "night" ? hex("#232c44") : hex("#5a7a48");
	const seatB = th === "night" ? hex("#1a2236") : hex("#4c6c3c");
	seed = th === "night" ? 77 : 99;
	for (let y = y0; y < y1; y++) {
		const dim = (y1 - y) / (y1 - y0);
		for (let x = 0; x < 240; x++) img.set(ox + x, oy + y, (y - y0) % 3 === 2 ? seatB : seatA);
	}
	const density = th === "night" ? 0.62 : 0.18;
	for (let y = y0 + 1; y < y1 - 1; y += 3)
		for (let x = 1; x < 239; x += 2) {
			if (rnd() > density) continue;
			const head = rnd() < 0.7 ? CROWD[0] : CROWD[1];
			const shirt = CROWD[2 + Math.floor(rnd() * 6)];
			const jump = cheer && rnd() < 0.6 ? 1 : 0;
			const dim = 0.25 + 0.5 * ((y1 - y) / (y1 - y0));
			const night = th === "night" ? hex("#101828") : hex("#2a3a28");
			img.set(ox + x, oy + y - jump, mix(head, night, dim * 0.6));
			img.set(ox + x, oy + y + 1 - jump, mix(shirt, night, dim * 0.6));
			if (jump && rnd() < 0.5) img.set(ox + x + (rnd() < 0.5 ? -1 : 1), oy + y - 1 - jump, mix(head, night, dim * 0.6));
		}
};

const STAND_TOP = 18;

/** 打席から 見た 球場（240x150）。 */
const battingBg = (img, ox, oy, th, cheer = false) => {
	// 空
	for (let y = 0; y < 150; y++)
		for (let x = 0; x < 240; x++) {
			const k = y / 40;
			const c = th === "night" ? mix(hex("#060b1e"), hex("#1b2a52"), Math.min(1, k)) : mix(hex("#7cbcec"), hex("#d4ecfa"), Math.min(1, k));
			img.set(ox + x, oy + y, c);
		}
	seed = 5;
	if (th === "night")
		for (let i = 0; i < 40; i++) img.set(ox + Math.floor(rnd() * 240), oy + Math.floor(rnd() * 16), hex("#c8d4ff"), 120 + Math.floor(rnd() * 120));
	else
		for (const [cx, cy, w] of [[30, 6, 18], [190, 9, 24], [140, 4, 12]]) {
			for (let i = 0; i < w; i++) {
				const hgt = Math.round(2.5 * Math.sin((Math.PI * i) / w)) + 1;
				for (let j = 0; j < hgt; j++) img.set(ox + cx + i, oy + cy - j, hex("#ffffff"));
			}
		}
	// 地面と フェンス
	const fen = [];
	for (let x = 0; x < 240; x++) fen.push(fenceAt(x));
	if (th === "night") stands(img, ox, oy, STAND_TOP, 44, th, cheer);
	else {
		// 森（木の かさを 並べる）
		seed = 31;
		for (let x = -6; x < 246; x += 7 + Math.floor(rnd() * 4)) {
			const cy = 30 + Math.floor(rnd() * 6);
			const r = 7 + Math.floor(rnd() * 4);
			for (let y = cy - r; y <= 44; y++)
				for (let i = -r; i <= r; i++) {
					const d = (i * i) / (r * r) + ((y - cy) * (y - cy)) / (r * r);
					if (d > 1 && y < cy) continue;
					const c = d > 0.55 || i > r * 0.3 ? hex("#2f6a34") : hex("#4a8c3e");
					const fleck = rnd() < 0.08;
					if (x + i < 0 || x + i >= 240) continue;
					img.set(ox + x + i, oy + y, fleck ? hex("#6aa850") : c);
				}
		}
		stands(img, ox, oy, 39, 44, th, cheer);
	}
	for (let x = 0; x < 240; x++) {
		const { top, base } = fen[x];
		for (let y = Math.floor(top); y < Math.ceil(base); y++) {
			const c = th === "night" ? (y === Math.floor(top) ? hex("#e8c840") : hex("#1d4a2e")) : y === Math.floor(top) ? hex("#a07a4a") : hex("#7a5a34");
			img.set(ox + x, oy + y, c);
		}
		if (th === "day" && x % 12 === 0) for (let y = Math.floor(top) - 2; y < Math.ceil(base); y++) img.set(ox + x, oy + y, hex("#5a3e22"));
	}
	// 広告（夜の フェンス）
	if (th === "night")
		for (const [x, c, c2] of [[22, "#c03a3a", "#ffffff"], [58, "#2a58b8", "#ffd040"], [168, "#e8e8e0", "#c03a3a"], [204, "#e0a020", "#3a2010"]]) {
			const { top, base } = fen[x + 8];
			const y = Math.ceil(top) + 1;
			const h = Math.max(2, Math.floor(base - top) - 2);
			img.rect(ox + x, oy + y, 18, h, hex(c));
			img.rect(ox + x + 3, oy + y + Math.floor(h / 2), 12, 1, hex(c2));
		}
	// 地面（3x3 で ならす）
	for (let y = 0; y < 150; y++)
		for (let x = 0; x < 240; x++) {
			if (y + 1 <= fen[x].base) continue;
			let acc = [0, 0, 0];
			let n = 0;
			for (let sy = 0; sy < 3; sy++)
				for (let sx = 0; sx < 3; sx++) {
					const yy = y + (sy + 0.5) / 3;
					const xx = x + (sx + 0.5) / 3;
					const Z = (F * CH) / (yy - HZ) - CZ;
					const X = ((xx - CX) * (Z + CZ)) / F;
					const c = ground(X, Z, th) ?? THEME[th].track;
					acc = acc.map((v, i) => v + c[i]);
					n++;
				}
			let c = acc.map((v) => Math.round(v / n));
			// 夜は 外野の すみを 暗く
			if (th === "night") {
				const edge = Math.abs(x - 120) / 120;
				c = mix(c, hex("#0c1a14"), Math.max(0, edge - 0.55) * 0.5);
			}
			img.set(ox + x, oy + y, c);
		}
	// 照明塔（夜）／電柱（昼）
	if (th === "night")
		for (const lx of [12, 227]) {
			for (let y = 9; y < 40; y++) {
				img.set(ox + lx, oy + y, hex("#3c4252"));
				img.set(ox + lx + 1, oy + y, hex("#2a2e3a"));
			}
			img.rect(ox + lx - 6, oy + 2, 14, 7, hex("#2a2e3a"));
			for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) img.rect(ox + lx - 5 + i * 2, oy + 3 + j * 2, 1, 1, hex("#fff8d0"));
			for (let y = -12; y <= 12; y++)
				for (let x = -14; x <= 14; x++) {
					const d = Math.hypot(x, y * 1.2);
					if (d < 14) img.set(ox + lx + x, oy + 5 + y, hex("#fff6c0"), Math.round(40 * (1 - d / 14)));
				}
		}
	// スコアボード
	const bx = 84;
	const bw = 72;
	const by = 3;
	const bh = 29;
	const frame = th === "night" ? hex("#0a0a0c") : hex("#6a4a2a");
	img.rect(ox + bx - 1, oy + by - 1, bw + 2, bh + 2, frame);
	img.rect(ox + bx, oy + by, bw, bh, hex("#10201a"));
	if (th === "day") {
		img.rect(ox + bx + 6, oy + by + bh + 1, 3, 10, hex("#5a3e22"));
		img.rect(ox + bx + bw - 9, oy + by + bh + 1, 3, 10, hex("#5a3e22"));
	}
	const sign = th === "night" ? "野球ch" : "保守村";
	const sw = wordWidth(sign);
	word(img, sign, ox + 120 - Math.floor(sw / 2), oy + by + 2, hex("#f4f2ea"));
	img.rect(ox + bx + 3, oy + by + 13, bw - 6, 1, hex("#2c4a3a"));
	// B S O の 字と 消えた ランプ
	const LAMP = { y: by + 15, B: [94, 100, 106], S: [119, 125], O: [138, 144] };
	glyph(img, GLYPH.B, ox + 89, oy + LAMP.y, hex("#c8c8c0"));
	glyph(img, GLYPH.S, ox + 114, oy + LAMP.y, hex("#c8c8c0"));
	glyph(img, GLYPH.O, ox + 133, oy + LAMP.y, hex("#c8c8c0"));
	for (const x of [...LAMP.B, ...LAMP.S, ...LAMP.O]) lamp(img, ox + x, oy + LAMP.y, "off");
	// km/h
	let kx = ox + 137;
	for (const ch of ["k", "m", "/", "H"]) {
		glyph(img, GLYPH[ch], kx, oy + by + 22, hex("#8a9a90"));
		kx += 4;
	}
};

const LAMP_COL = { B: ["#40e070", "#a8ffc0"], S: ["#ffd040", "#fff0a0"], O: ["#ff5040", "#ffb0a0"], off: ["#26332c", "#2e3e36"] };
/** ランプ（5x5 の 丸）。 */
function lamp(img, x, y, kind) {
	const [c, hi] = LAMP_COL[kind].map(hex);
	const M = [".###.", "#####", "#####", "#####", ".###."];
	glyph(img, M, x, y, c);
	img.set(x + 1, y + 1, hi);
}

/**
 * 上から 見た 球場（360x280）。1m = 2px、本塁 (180,252)。X は -90..90m、Z は -14..126m。
 * 遊ぶ ときは 240x150 の 窓で 打球を 追って すべらせる（村の 歩行グラ 16x16 と 同じ 大きさの 人が 立つ）。
 */
const FW = 360;
const FH = 280;
const HOME = [180, 252];
const K = 2;
const fieldTop = (img, ox, oy, th) => {
	const t = THEME[th];
	seed = th === "night" ? 404 : 808;
	for (let y = 0; y < FH; y++)
		for (let x = 0; x < FW; x++) {
			let acc = [0, 0, 0];
			for (let s = 0; s < 4; s++) {
				const X = (x + (s % 2) * 0.5 + 0.25 - HOME[0]) / K;
				const Z = (HOME[1] - (y + Math.floor(s / 2) * 0.5 + 0.25)) / K;
				let c = ground(X, Z, th);
				const r = Math.hypot(X, Z);
				if (!c) {
					if (r < FENCE + 1.6) c = th === "night" ? hex("#1d4a2e") : hex("#7a5a34");
					else if (th === "night") {
						const ring = Math.floor((r - FENCE) / 2) % 2;
						c = ring ? hex("#232c44") : hex("#1a2236");
					} else c = mix(t.foul, hex("#3a7a30"), 0.4);
				}
				if (Z < -5.5 && Z > -6.5) c = hex("#9aa0a8"); // バックネット
				else if (Z <= -6.5) c = th === "night" ? hex("#1a2236") : hex("#3a7a30");
				acc = acc.map((v, i) => v + c[i]);
			}
			img.set(ox + x, oy + y, acc.map((v) => Math.round(v / 4)));
		}
	// 線と ベース（2px/m では 地面の 関数だけだと 細すぎるので 上から 描く）
	const toPx = (X, Z) => [Math.round(HOME[0] + X * K), Math.round(HOME[1] - Z * K)];
	for (const sgn of [-1, 1])
		for (let d = 0; d <= FENCE * Math.SQRT1_2 * K; d++) img.set(ox + HOME[0] + sgn * d, oy + HOME[1] - d, t.line);
	for (const [bx, bz] of BASES) {
		const [x, y] = toPx(bx, bz);
		glyph(img, [".#.", "###", ".#."], ox + x - 1, oy + y - 1, t.line);
	}
	glyph(img, ["###", "###", ".#."], ox + HOME[0] - 1, oy + HOME[1] - 1, t.line);
	{
		const [x, y] = toPx(0, MOUND_Z);
		img.rect(ox + x - 1, oy + y, 3, 1, t.line);
	}
	// 客（夜）／木（昼）
	for (let y = 0; y < FH; y += 2)
		for (let x = 0; x < FW; x += 2) {
			const X = (x - HOME[0]) / K;
			const Z = (HOME[1] - y) / K;
			const r = Math.hypot(X, Z);
			if (th === "night" && (r > FENCE + 3 || Z < -7) && rnd() < 0.55) {
				img.set(ox + x, oy + y, CROWD[rnd() < 0.7 ? 0 : 1]);
				img.set(ox + x, oy + y + 1, mix(CROWD[2 + Math.floor(rnd() * 6)], hex("#101828"), 0.3));
			}
		}
	if (th === "day") {
		seed = 12;
		for (let i = 0; i < 200; i++) {
			const x = Math.floor(rnd() * FW);
			const y = Math.floor(rnd() * FH);
			const X = (x - HOME[0]) / K;
			const Z = (HOME[1] - y) / K;
			if (Math.hypot(X, Z) < FENCE + 6 || Z < -8) continue;
			// 木（右下に 2px の 影 → 濃い 緑の 葉・ふち・左上の 明るい 所。葉を 地面より はっきり 濃く して、輪に 見えない ように）
			const put = (px, py, c) => {
				if (px >= 0 && px < FW && py >= 0 && py < FH) img.set(ox + px, oy + py, c);
			};
			for (let j = -6; j <= 6; j++)
				for (let k = -6; k <= 6; k++) if (j * j + k * k <= 38) put(x + k + 2, y + j + 2, hex("#2f6a34"));
			for (let j = -6; j <= 6; j++)
				for (let k = -6; k <= 6; k++) {
					const d = j * j + k * k;
					if (d > 38) continue;
					put(x + k, y + j, hex(d > 26 ? "#2a5e2f" : d <= 12 && k + j < 0 ? "#62a84e" : "#3a7a34"));
				}
		}
	}
	// 小さな スコアボード（いちばん 上の まんなか）
	const sign = th === "night" ? "野球ch" : "保守村";
	const sw = wordWidth(sign);
	const cx = FW / 2;
	img.rect(ox + cx - Math.floor(sw / 2) - 3, oy + 1, sw + 6, 13, hex("#0a0a0c"));
	img.rect(ox + cx - Math.floor(sw / 2) - 2, oy + 2, sw + 4, 11, hex("#10201a"));
	word(img, sign, ox + cx - Math.floor(sw / 2), oy + 3, hex("#f4f2ea"));
};

battingBg(sheet, ...at("bgNight"), "night");
battingBg(sheet, ...at("bgDay"), "day");
fieldTop(sheet, ...at("fieldNight"), "night");
fieldTop(sheet, ...at("fieldDay"), "day");
// 歓声の 帯（打席の 絵を 歓声つきで 描きなおし、客席の 行 y18..41 だけ 写す。実行時は (0,18) に 重ねる）
for (const [th, key] of [["night", "cheerNight"], ["day", "cheerDay"]]) {
	const tmp = new Img(240, 150);
	battingBg(tmp, 0, 0, th, true);
	sheet.blit(tmp, 0, STAND_TOP, 240, 24, ...at(key));
}

// ───────────────── キリコ（打者。56x52・足もと (20,51)） ─────────────────
// 打席の 左（三塁がわ）に 立つ 右打ち。キャッチャーの うしろから 見るので、右を 向いた 横顔と 背中。
// 色は 村の 歩行グラ（sa:vHsmy5）から 拾った：紺の ふち、緑の 髪（3段）、えんじの 大きな リボン、クリームの セーター、
// 紺の スカート、黒っぽい タイツ。いちばん 目立つのは 頭の うしろの 大きな リボン（歩行グラでも 頭の 幅いっぱい）。
const KPAL = {
	o: "#031c3e",
	G: "#28a131",
	g: "#105516",
	h: "#a0c855",
	R: "#72241f",
	r: "#9f5753",
	s: "#cfa247",
	S: "#a68239",
	e: "#000000",
	W: "#dcccc5",
	w: "#b79a8d",
	K: "#1c3260",
	k: "#0c2248",
	L: "#353333",
	B: "#926855",
	T: "#e0b878",
	t: "#b08850",
	X: "#3a2a20",
	F: "#ffffff",
};
/** バット（握り → 先。先ほど 太い）。 */
const bat = (L, x0, y0, ang, len = 21) => {
	const a = (ang * Math.PI) / 180;
	const x1 = x0 + Math.cos(a) * len;
	const y1 = y0 + Math.sin(a) * len;
	const gx = x0 + Math.cos(a) * 5;
	const gy = y0 + Math.sin(a) * 5;
	L.stroke(x0, y0, gx, gy, 1.6, 1.8, "X");
	L.stroke(gx, gy, x1, y1, 1.8, 3.4, "T");
	// 影の すじ
	L.stroke(gx + Math.sin(a) * 0.9, gy - Math.cos(a) * -0.9, x1 + Math.sin(a) * 1.2, y1 - Math.cos(a) * -1.2, 0.8, 1.2, "t");
	return [x1, y1];
};

/** ポニテ（リボンの 下から 曲がって 垂れる）。pts は 根もと → 先。 */
const ponytail = (L, pts) => {
	for (let i = 0; i + 1 < pts.length; i++) {
		const [ax, ay, aw] = pts[i];
		const [bx, by, bw] = pts[i + 1];
		L.stroke(ax, ay, bx, by, aw, bw, "G");
	}
	for (let i = 0; i + 1 < pts.length; i++) {
		const [ax, ay, aw] = pts[i];
		const [bx, by, bw] = pts[i + 1];
		L.stroke(ax + 1, ay + 0.5, bx + 1, by + 0.5, aw * 0.4, bw * 0.4, "g");
	}
};

/**
 * 大きな リボン（歩行グラと 同じく 頭の 幅より 大きい）。(x, y) は 結び目。
 * 横（K0・K1・K5）：うしろの 羽が 大きく 張りだし、前の 羽が 頭の 上から すこし のぞく。
 * 背中（K2〜K4）：頭の うしろに 左右の 羽。
 */
const ribbon = (L, x, y, back = false) => {
	if (back) {
		L.poly([[x, y - 1], [x - 8, y - 5], [x - 9, y], [x - 8, y + 4], [x, y + 1]], "R");
		L.poly([[x, y - 1], [x + 8, y - 5], [x + 9, y], [x + 8, y + 4], [x, y + 1]], "R");
		L.stroke(x - 6, y - 3, x - 7, y + 1, 1, 1, "r");
		L.stroke(x + 6, y - 3, x + 7, y + 1, 1, 1, "r");
	} else {
		L.poly([[x, y - 1], [x - 7, y - 6], [x - 8, y - 1], [x - 7, y + 4], [x, y + 1]], "R");
		L.poly([[x + 1, y - 2], [x + 6, y - 7], [x + 8, y - 5], [x + 3, y]], "R");
		L.stroke(x - 5, y - 4, x - 6, y + 1, 1, 1, "r");
		L.px(x + 5, y - 5, "r");
		L.stroke(x - 1, y + 1, x - 3, y + 6, 1.6, 1.2, "R");
	}
	L.oval(x, y, 1.2, 1.2, "r");
};

/** 横顔（右向き）。cx,cy は 頭の まんなか。 */
const headSide = (L, cx, cy) => {
	L.oval(cx, cy, 6, 6, "G", "g", 0.55);
	// 顔（右下）
	L.poly([[cx + 1, cy - 1], [cx + 7, cy - 1], [cx + 6, cy + 5], [cx + 2, cy + 6], [cx, cy + 3]], "s");
	L.px(cx + 6, cy + 2, "S");
	L.px(cx + 5, cy + 5, "S");
	// 前髪
	L.poly([[cx - 2, cy - 6], [cx + 6, cy - 4], [cx + 7, cy], [cx + 4, cy - 1], [cx + 2, cy + 1], [cx + 1, cy - 2]], "G");
	L.px(cx + 1, cy - 5, "h");
	L.px(cx + 2, cy - 5, "h");
	L.px(cx - 1, cy - 4, "h");
	// もみあげ
	L.stroke(cx + 1, cy - 1, cx + 1, cy + 4, 2, 1.5, "G");
	// 目
	L.px(cx + 4, cy + 1, "e");
	L.px(cx + 4, cy + 2, "e");
};
/** うしろ頭（ピッチャーの ほうを 見る）。 */
const headBack = (L, cx, cy) => {
	L.oval(cx, cy, 6, 6, "G", "g", 0.45);
	L.px(cx - 2, cy - 4, "h");
	L.px(cx - 1, cy - 5, "h");
	L.px(cx, cy - 5, "h");
	// 耳と 頬が すこし
	L.px(cx + 6, cy + 2, "s");
	L.px(cx + 6, cy + 3, "S");
};

const torsoSide = (L, x, y) => {
	// 首の セーター（タートル）
	L.poly([[x + 2, y - 2], [x + 7, y - 2], [x + 7, y + 1], [x + 2, y + 1]], "W");
	L.poly([[x, y], [x + 9, y], [x + 10, y + 12], [x - 1, y + 12]], "W");
	L.poly([[x, y], [x + 3, y], [x + 2, y + 12], [x - 1, y + 12]], "w");
};
const torsoBack = (L, x, y) => {
	L.poly([[x + 3, y - 2], [x + 9, y - 2], [x + 9, y + 1], [x + 3, y + 1]], "W");
	L.poly([[x, y], [x + 12, y], [x + 12, y + 12], [x, y + 12]], "W");
	L.poly([[x, y + 8], [x + 12, y + 8], [x + 12, y + 12], [x, y + 12]], "w");
	L.stroke(x + 6, y + 1, x + 6, y + 11, 1, 1, "w");
};
const skirt = (L, x, y, w) => {
	L.poly([[x, y], [x + w, y], [x + w + 2, y + 7], [x - 2, y + 7]], "K");
	for (let i = 1; i < w + 2; i += 3) L.stroke(x - 1 + i, y + 2, x - 1 + i + (i - w / 2) * 0.15, y + 6, 1, 1, "k");
};
const leg = (L, x0, y0, x1, y1) => {
	L.stroke(x0, y0, x1, y1, 3, 3, "L");
};
const boot = (L, x, y, dir = 1) => {
	L.poly([[x - 2, y - 3], [x + 2, y - 3], [x + 2 + 3 * dir, y], [x - 2, y]], "B");
};
const arm = (L, pts) => {
	for (let i = 0; i + 1 < pts.length; i++) L.stroke(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 3.2, 3, "W");
	const [hx, hy] = pts[pts.length - 1];
	L.oval(hx, hy, 1.4, 1.4, "s");
};

const KW = 56;
const KH = 52;
const kiriko = [];
// K0 構え：バットを 立てて 肩の うしろ
{
	const L = new Layer(KW, KH);
	ponytail(L, [[15, 13, 4], [12, 18, 4], [11, 24, 3.5], [12, 29, 2]]);
	leg(L, 18, 41, 16, 48);
	leg(L, 24, 41, 27, 48);
	boot(L, 16, 51);
	boot(L, 27, 51);
	skirt(L, 15, 35, 11);
	torsoSide(L, 16, 24);
	headSide(L, 21, 16);
	ribbon(L, 16, 11);
	bat(L, 18, 22, -112);
	arm(L, [[24, 26], [21, 27], [19, 22]]);
	arm(L, [[19, 26], [14, 26], [18, 22]]);
	L.outline("o", ["F"]);
	kiriko.push(L);
}
// K1 ため（球が 来るまで。バットを うしろに 寝かせ、前足を すこし 上げる）
{
	const L = new Layer(KW, KH);
	ponytail(L, [[14, 13, 4], [11, 18, 4], [10, 24, 3.5], [11, 29, 2]]);
	leg(L, 17, 41, 15, 48);
	leg(L, 24, 41, 28, 46);
	boot(L, 15, 51);
	boot(L, 29, 49);
	skirt(L, 14, 35, 11);
	torsoSide(L, 15, 24);
	headSide(L, 21, 16);
	ribbon(L, 15, 11);
	bat(L, 15, 23, -140);
	arm(L, [[23, 26], [19, 28], [16, 23]]);
	arm(L, [[18, 26], [13, 27], [15, 23]]);
	L.outline("o", ["F"]);
	kiriko.push(L);
}
// K2 ミート（腰が 回って 背中。バットは 水平で 本塁の 上）
{
	const L = new Layer(KW, KH);
	ponytail(L, [[16, 13, 4], [10, 15, 4], [5, 17, 3.5], [2, 20, 2]]);
	leg(L, 18, 41, 17, 48);
	leg(L, 25, 41, 30, 48);
	boot(L, 17, 51);
	boot(L, 30, 51);
	skirt(L, 15, 35, 12);
	torsoBack(L, 15, 24);
	headBack(L, 21, 16);
	ribbon(L, 20, 12, true);
	arm(L, [[17, 26], [24, 30], [30, 30]]);
	arm(L, [[26, 26], [29, 29], [31, 30]]);
	bat(L, 31, 30, -4, 23);
	L.outline("o", ["F"]);
	kiriko.push(L);
}
// K3 フォロースルー（バットは 向こうの 肩の 上から うしろへ）
{
	const L = new Layer(KW, KH);
	bat(L, 25, 18, -168, 22);
	ponytail(L, [[16, 13, 4], [11, 17, 4], [8, 22, 3.5], [8, 27, 2]]);
	leg(L, 19, 41, 18, 48);
	leg(L, 25, 41, 29, 48);
	boot(L, 18, 51);
	boot(L, 29, 51);
	skirt(L, 15, 35, 12);
	torsoBack(L, 15, 24);
	headBack(L, 21, 16);
	ribbon(L, 20, 12, true);
	arm(L, [[16, 26], [20, 22], [25, 18]]);
	arm(L, [[26, 26], [27, 21], [25, 18]]);
	L.outline("o", ["F"]);
	kiriko.push(L);
}
// K4 空振り（よろけて 前のめり。バットは 下へ）
{
	const L = new Layer(KW, KH);
	ponytail(L, [[17, 15, 4], [13, 18, 4], [11, 23, 3.5], [12, 28, 2]]);
	leg(L, 19, 41, 16, 48);
	leg(L, 25, 41, 31, 47);
	boot(L, 16, 51);
	boot(L, 32, 50);
	skirt(L, 16, 35, 12);
	torsoBack(L, 17, 25);
	headBack(L, 24, 18);
	ribbon(L, 23, 14, true);
	arm(L, [[19, 27], [24, 31], [30, 34]]);
	arm(L, [[28, 27], [30, 31], [30, 34]]);
	bat(L, 30, 34, 155, 21);
	// 汗
	L.px(33, 12, "F");
	L.px(34, 13, "F");
	L.px(33, 13, "F");
	L.outline("o", ["F"]);
	kiriko.push(L);
}
// K5 ガッツポーズ（バットを 足もとに 置いて、手前の 腕を あげる）
{
	const L = new Layer(KW, KH);
	ponytail(L, [[15, 13, 4], [12, 18, 4], [11, 24, 3.5], [12, 29, 2]]);
	bat(L, 34, 50, 180, 22);
	leg(L, 18, 41, 17, 48);
	leg(L, 24, 41, 26, 48);
	boot(L, 17, 51);
	boot(L, 26, 51);
	skirt(L, 15, 35, 11);
	torsoSide(L, 16, 24);
	headSide(L, 21, 16);
	ribbon(L, 16, 11);
	arm(L, [[24, 26], [26, 30], [25, 33]]);
	arm(L, [[19, 25], [17, 18], [18, 12]]);
	L.outline("o", ["F"]);
	kiriko.push(L);
}
kiriko.forEach((L, i) => {
	L.draw(sheet, ...at("kiriko", i), KPAL);
});
// スイングの 軌跡（K2 に 重ねる。半透明の 白い 弧）
{
	const [ox, oy] = at("trail");
	for (let i = 0; i <= 40; i++) {
		const t = i / 40;
		const a = (-150 + t * 150) * (Math.PI / 180);
		const r = 24 - 2 * Math.sin(t * Math.PI);
		const x = 22 + Math.cos(a) * r;
		const y = 30 + Math.sin(a) * r * 0.55 + t * 2;
		for (let w = 0; w < 4; w++) sheet.set(ox + x, oy + y + w, hex("#ffffff"), Math.max(0, Math.round(90 + 150 * t) - w * 45));
	}
}
// 剛速球の キラッ（8x8 を 2コマ）
for (let f = 0; f < 2; f++) {
	const [ox, oy] = at("glint", f);
	const r = f ? 3 : 2;
	for (let s = -r; s <= r; s++) {
		sheet.set(ox + 4 + s, oy + 4, hex("#ffffff"));
		sheet.set(ox + 4, oy + 4 + s, hex("#ffffff"));
	}
	if (f) for (const [x, y] of [[2, 2], [6, 6], [6, 2], [2, 6]]) sheet.set(ox + x, oy + y, hex("#fff2a0"));
}
// 土けむり（ワンバウンド。8x8 を 2コマ）
for (let f = 0; f < 2; f++) {
	const [ox, oy] = at("dust", f);
	for (const [x, y] of f ? [[1, 5], [2, 4], [6, 5], [5, 4], [3, 6], [4, 6], [0, 6], [7, 6]] : [[2, 6], [3, 5], [4, 5], [5, 6], [3, 6], [4, 6]])
		sheet.set(ox + x, oy + y, hex("#d8c098"));
}

// ───────────────── ピッチャー（24x32・足もと (12,31)・正面） ─────────────────
// 3人とも 村の 歩行グラの 色と 形に 合わせる（遠くからでも だれが 投げているか わかるように）。
const PW = 24;
const PH = 32;
/** やきう型の 頭（歩行グラ sa:4rSOzo・sa:xjuotB と 同じ：頭の 上に とびでた 目、うしろに 髪の たば）。 */
const bugHead = (L, cx, cy) => {
	L.oval(cx, cy + 1, 5, 4.5, "F", "f", 0.6);
	// とびでた 目（白に 赤い 点）
	L.oval(cx - 2.5, cy - 4, 1.6, 2, "W");
	L.oval(cx + 2.5, cy - 4, 1.6, 2, "W");
	L.px(cx - 2, cy - 4, "R");
	L.px(cx + 3, cy - 4, "R");
	// 髪の たば（うしろ）
	L.stroke(cx + 4, cy - 2, cx + 7, cy, 2, 1, "k");
	L.px(cx + 7, cy - 2, "k");
	// 口
	L.px(cx - 1, cy + 3, "e");
	L.px(cx, cy + 3, "e");
	L.px(cx + 1, cy + 3, "e");
};
const PITCHERS = {
	// 原住民 (´・ω・｀)：横長の 白い 顔、頭に 緑の へた、白に 緑の しま（きうりアーマー。sa:nabqyI と 同じ 緑）
	shobon: {
		pal: { o: "#4a4a56", F: "#ffffff", f: "#dedede", e: "#000000", A: "#ffffff", a: "#199f2a", n: "#199f2a", L: "#ebebeb", B: "#b3b3b3", M: "#a0602a", W: "#ffffff", R: "#d04040", G: "#199f2a", g: "#33cc00" },
		head: (L, cx, cy) => {
			L.oval(cx, cy, 8, 5, "F", "f", 0.75);
			// へた
			L.stroke(cx - 3, cy - 5, cx + 3, cy - 5, 1.6, 1.6, "G");
			L.px(cx, cy - 7, "g");
			L.px(cx + 1, cy - 7, "g");
			// (´・ω・｀)
			for (const [x, y] of [[-7, 1], [-6, 0], [6, 0], [7, 1], [-4, 1], [4, 1], [-2, 1], [-1, 2], [0, 1], [1, 2], [2, 1]]) L.px(cx + x, cy + y, "e");
		},
		headY: 9,
		stripes: true,
	},
	// やきう（野球民）：頭は 歩行グラ そのまま（帽子は かぶらない）、しまの ユニフォーム
	yakiu: {
		pal: { o: "#857d38", F: "#ffce33", f: "#e1ac05", e: "#030303", k: "#030303", A: "#f2f2ee", a: "#2a3a6a", n: "#2a3a6a", L: "#2a3a6a", B: "#1e1e24", M: "#a0602a", W: "#ffffff", R: "#f52929" },
		head: bugHead,
		headY: 9,
		stripes: true,
	},
	// 名無し（彡(⭕)(⭕)。sa:xjuotB の 白と 灰）：やきうと 同じ 形、灰色の ユニフォーム
	nanashi: {
		pal: { o: "#808080", F: "#ffffff", f: "#c4c4c4", e: "#4a4a52", k: "#e3d6c4", A: "#d4d8e0", a: "#a8acb8", n: "#5a6070", L: "#5a6070", B: "#1e1e24", M: "#a0602a", W: "#ffffff", R: "#ff0000" },
		head: bugHead,
		headY: 9,
		stripes: false,
	},
};

/** ピッチャーの 1コマ。pose: 0 セット 1 足上げ 2 テイクバック 3 リリース 4 フォロー 5 orz 6 よろこぶ */
const pitcherFrame = (P, pose) => {
	const L = new Layer(PW, PH);
	const hy = P.headY;
	const body = (x, y, lean = 0) => {
		L.poly([[x - 4, y], [x + 4, y], [x + 5 + lean, y + 9], [x - 5 + lean, y + 9]], "A");
		if (P.stripes) for (let i = -3; i <= 3; i += 2) L.stroke(x + i, y + 1, x + i + lean * 0.5, y + 8, 1, 1, "a");
		else L.poly([[x - 4, y + 6], [x + 4, y + 6], [x + 5 + lean, y + 9], [x - 5 + lean, y + 9]], "a");
		L.stroke(x - 4 + lean, y + 9, x + 4 + lean, y + 9, 1.4, 1.4, "n");
	};
	const legs = (a, b) => {
		L.stroke(a[0], a[1], a[2], a[3], 3, 3, "L");
		L.stroke(b[0], b[1], b[2], b[3], 3, 3, "L");
		L.stroke(a[2] - 1, a[3], a[2] + 1, a[3], 2, 2, "B");
		L.stroke(b[2] - 1, b[3], b[2] + 1, b[3], 2, 2, "B");
	};
	const limb = (x0, y0, x1, y1, col = "A") => L.stroke(x0, y0, x1, y1, 2.6, 2.4, col);
	const glove = (x, y) => L.oval(x, y, 2, 2, "M");
	const ball = (x, y) => {
		L.px(x, y, "W");
		L.px(x + 1, y, "W");
		L.px(x, y + 1, "W");
		L.px(x + 1, y + 1, "R");
	};
	if (pose === 0) {
		legs([10, 21, 9, 30], [14, 21, 15, 30]);
		body(12, 12);
		limb(8, 13, 11, 17);
		limb(16, 13, 13, 17);
		glove(12, 17);
		P.head(L, 12, hy);
	} else if (pose === 1) {
		legs([11, 21, 11, 30], [14, 21, 18, 22]);
		L.stroke(18, 22, 17, 26, 3, 3, "L");
		body(12, 12, -1);
		limb(8, 13, 11, 9);
		limb(16, 13, 13, 9);
		glove(12, 9);
		P.head(L, 11, hy);
	} else if (pose === 2) {
		legs([10, 21, 6, 30], [14, 21, 19, 30]);
		body(12, 12);
		limb(8, 13, 4, 7);
		ball(3, 5);
		limb(16, 13, 20, 15);
		glove(21, 15);
		P.head(L, 12, hy);
	} else if (pose === 3) {
		legs([10, 22, 6, 30], [14, 22, 18, 30]);
		body(12, 13, 1);
		limb(8, 14, 9, 7);
		limb(16, 14, 18, 18);
		glove(18, 19);
		P.head(L, 12, hy + 2);
	} else if (pose === 4) {
		legs([10, 23, 4, 26], [14, 23, 16, 30]);
		body(12, 15, 2);
		limb(9, 16, 16, 23);
		limb(16, 16, 19, 21);
		glove(19, 21);
		P.head(L, 13, hy + 5);
	} else if (pose === 5) {
		// orz（横から。頭が 左）
		L.stroke(9, 23, 18, 24, 6, 6, "A");
		L.stroke(10, 25, 9, 31, 2.4, 2.4, "A");
		L.stroke(18, 26, 20, 31, 3, 3, "L");
		L.stroke(20, 31, 23, 30, 2.4, 2.4, "L");
		P.head(L, 6, 24);
	} else {
		legs([10, 19, 9, 28], [14, 19, 15, 28]);
		body(12, 10);
		limb(8, 11, 4, 4);
		limb(16, 11, 20, 4);
		P.head(L, 12, hy - 2);
	}
	L.outline("o", ["W", "R"]);
	return L;
};
for (const [id, key] of [["shobon", "pitcherShobon"], ["yakiu", "pitcherYakiu"], ["nanashi", "pitcherNanashi"]])
	for (let pose = 0; pose < 7; pose++) pitcherFrame(PITCHERS[id], pose).draw(sheet, ...at(key, pose), PITCHERS[id].pal);

// ───────────────── キャッチャー・審判・遠くの 野手 ─────────────────
const CPAL = { o: "#1c1c22", H: "#2c3446", h: "#4a5468", P: "#3a3a44", p: "#56566a", U: "#c8ccd4", u: "#9ca0ac", L: "#2c3446", M: "#a0602a", m: "#7a4420", B: "#1a1a20", s: "#e8c4a0", S: "#3a2c24", Q: "#22222a" };
// キャッチャー（背中。しゃがむ）24x24・足もと (12,23)
for (let f = 0; f < 2; f++) {
	const L = new Layer(24, 24);
	L.poly([[6, 21], [18, 21], [20, 23], [4, 23]], "L");
	L.oval(12, 15, 6, 6, "U", "u", 0.4);
	L.stroke(8, 10, 16, 18, 1, 1, "P");
	L.stroke(16, 10, 8, 18, 1, 1, "P");
	L.oval(12, 7, 4.5, 4, "H", null);
	L.px(10, 5, "h");
	L.px(11, 4, "h");
	if (f === 0) L.oval(18, 16, 2.5, 2.5, "M", "m", 0.4);
	else {
		L.stroke(17, 12, 17, 6, 2.4, 2.4, "U");
		L.oval(17, 4, 3, 3, "M", "m", 0.4);
	}
	L.outline("o");
	L.draw(sheet, ...at("catcher", f), CPAL);
}
// 審判（背中。右の 腕を 上げる）24x32・足もと (12,31)
for (let f = 0; f < 2; f++) {
	const L = new Layer(24, 32);
	L.stroke(10, 22, 9, 30, 3, 3, "L");
	L.stroke(14, 22, 15, 30, 3, 3, "L");
	L.poly([[6, 12], [18, 12], [18, 23], [6, 23]], "P");
	L.poly([[6, 12], [8, 12], [8, 23], [6, 23]], "p");
	L.oval(12, 8, 4, 4, "S", null);
	L.poly([[8, 3], [16, 3], [16, 7], [8, 7]], "Q");
	L.poly([[10, 11], [14, 11], [14, 12], [10, 12]], "s");
	L.stroke(6, 13, 5, 21, 2.6, 2.6, "P");
	if (f === 0) L.stroke(18, 13, 19, 21, 2.6, 2.6, "P");
	else {
		L.stroke(18, 13, 21, 5, 2.6, 2.6, "P");
		L.oval(21, 3, 1.5, 1.5, "s");
	}
	L.outline("o");
	L.draw(sheet, ...at("umpire", f), CPAL);
}
// 遠くの 野手（8x12。0 かまえ 1 うしろを 向く：ホームランを 見送る）。色は 村の 歩行グラから
const FAR = {
	gen: { F: "#ffffff", A: "#ffffff", a: "#199f2a", L: "#d6d6d6", h: "#199f2a" }, // 原住民
	gray: { F: "#ffffff", A: "#c4c4c4", a: "#c4c4c4", L: "#808080", h: "#e3d6c4" }, // 彡(⭕)(⭕)
	red: { F: "#ff4018", A: "#ffce33", a: "#ffce33", L: "#857d38", h: "#030303" }, // 赤面J民
	yellow: { F: "#ffd21f", A: "#ffd21f", a: "#ffd21f", L: "#a1a1a1", h: "#ffd21f" }, // 陽すこ民
	black: { F: "#ffce33", A: "#202020", a: "#202020", L: "#101010", h: "#030303" }, // J min Black
};
const farFielder = (team, f) => {
	const L = new Layer(8, 12);
	L.oval(3.5, 3, 2.5, 2, "F");
	L.px(3, 0, "h");
	L.px(4, 0, "h");
	if (f === 0) {
		if (team === "yellow") for (const x of [1, 2, 4, 5]) L.px(x, 3, "e");
		else {
			L.px(2, 3, "e");
			L.px(5, 3, "e");
		}
	} else L.px(1, 2, "h");
	L.poly([[2, 6], [6, 6], [6, 9], [2, 9]], "A");
	L.px(3, 7, "a");
	L.px(5, 7, "a");
	for (const [x, y] of [[2, 10], [5, 10], [2, 11], [5, 11]]) L.px(x, y, "L");
	if (f === 0) L.px(6, 7, "M");
	L.outline("o");
	return L;
};
for (let f = 0; f < 2; f++) farFielder("gen", f).draw(sheet, ...at("farGen", f), { o: "#26242e", e: "#000000", M: "#a0602a", ...FAR.gen });
["gray", "red", "yellow", "black"].forEach((team, i) => {
	for (let f = 0; f < 2; f++) farFielder(team, f).draw(sheet, ...at("farNanashi", i * 2 + f), { o: "#26242e", e: "#000000", M: "#a0602a", ...FAR[team] });
});

// ───────────────── 球・影・ランプ・数字・しるし ─────────────────
const WHITE = hex("#ffffff");
const SEAM = hex("#d83838");
const BALL_O = hex("#9aa0b0");
// 6px の 球（4コマ。縫い目が 回る）
for (let f = 0; f < 4; f++) {
	const [x0, y0] = at("ball6", f);
	const ox = x0 + 1;
	const oy = y0 + 1;
	glyph(sheet, [".####.", "######", "######", "######", "######", ".####."], ox, oy, WHITE);
	for (const [x, y] of [[0, 1], [0, 4], [5, 1], [5, 4], [1, 0], [4, 0], [1, 5], [4, 5]]) sheet.set(ox + x, oy + y, BALL_O);
	const seams = [
		[[1, 1], [1, 2], [1, 3], [1, 4], [4, 1], [4, 2], [4, 3], [4, 4]],
		[[1, 1], [2, 2], [2, 3], [1, 4], [4, 1], [3, 2], [3, 3], [4, 4]],
		[[1, 1], [2, 1], [3, 1], [4, 1], [1, 4], [2, 4], [3, 4], [4, 4]],
		[[2, 1], [1, 2], [1, 3], [2, 4], [3, 1], [4, 2], [4, 3], [3, 4]],
	][f];
	for (const [x, y] of seams) sheet.set(ox + x, oy + y, SEAM);
}
// 4px の 球（2コマ）と 2px の 球。小さい 球は 白い ユニフォームや 線の 上でも 見えるように 暗い ふち
const RING = hex("#2a2a36");
for (let f = 0; f < 2; f++) {
	const [x0, y0] = at("ball4", f);
	const ox = x0 + 2;
	const oy = y0 + 2;
	glyph(sheet, ["..##..", ".####.", "######", "######", ".####.", "..##.."], ox - 1, oy - 1, RING, 200);
	glyph(sheet, [".##.", "####", "####", ".##."], ox, oy, WHITE);
	sheet.set(ox + (f ? 1 : 2), oy + 1, SEAM);
	sheet.set(ox + (f ? 2 : 1), oy + 2, SEAM);
}
{
	const [x0, y0] = at("ball2");
	glyph(sheet, [".##.", "####", "####", ".##."], x0 + 2, y0 + 2, RING, 200);
	sheet.rect(x0 + 3, y0 + 3, 2, 2, WHITE);
}
// 影（6x3・4x2）
glyph(sheet, [".####.", "######", ".####."], at("shadow6")[0] + 1, at("shadow6")[1] + 3, hex("#000000"), 110);
glyph(sheet, ["####", "####"], at("shadow4")[0] + 2, at("shadow4")[1] + 3, hex("#000000"), 110);
// ランプ（B S O 消）
["B", "S", "O", "off"].forEach((k, i) => {
	lamp(sheet, ...at("lamp", i), k);
});
// 数字（3x5 を 4x6 の マスに。だいだい色の 電光）
DIGIT.forEach((g, i) => {
	glyph(sheet, g, ...at("digit", i), hex("#ffb040"));
});
// しるし（のこりの 球・使った 球・ホームラン）6x6
glyph(sheet, [".##.", "####", "####", ".##."], at("icon", 0)[0] + 1, at("icon", 0)[1] + 1, WHITE);
glyph(sheet, [".##.", "####", "####", ".##."], at("icon", 1)[0] + 1, at("icon", 1)[1] + 1, hex("#4a4a56"));
glyph(sheet, ["..#..", ".###.", "#####", ".###.", ".#.#."], ...at("icon", 2), hex("#ffd040"));

// ───────────────── RPGEN の 素材を 貼る ─────────────────
for (const [key, refs] of Object.entries(WALKS))
	for (const [i, ref] of refs.entries()) {
		const img = await rpgen(ref);
		if (img.w !== 32 || img.h !== 64) throw new Error(`${ref}: 32x64 ではありません（${img.w}x${img.h}）`);
		sheet.blit(img, 0, 0, 32, 64, ...at(key, i));
	}
for (const [key, list] of [["pose", POSE], ["fx", FX]])
	for (const [i, [, ref]] of list.entries()) {
		const img = await rpgen(ref);
		sheet.blit(img, 0, 0, 16, 16, ...at(key, i));
	}
{
	// 花火：0 は もとの 色、1 は 色相を 60° まわす（桃 → 金、水 → 紫、黄 → 緑）
	const fw = new Img(64, 32);
	for (const [r, row] of FIREWORKS.entries())
		for (const [c, ref] of row.entries()) fw.blit(await rpgen(ref), 0, 0, 16, 16, c * 16, r * 16);
	sheet.blit(fw, 0, 0, 64, 32, ...at("fireworks", 0));
	const rot = (p) => {
		const [r, g, b] = p.map((v) => v / 255);
		const mx = Math.max(r, g, b);
		const mn = Math.min(r, g, b);
		const d = mx - mn;
		if (d < 0.08) return p.slice(0, 3);
		let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
		h = (h * 60 + 60 + 360) % 360;
		const s = d / mx;
		const v = mx;
		const k = (n) => (n + h / 60) % 6;
		const f = (n) => v - v * s * Math.max(0, Math.min(k(n), 4 - k(n), 1));
		return [f(5), f(3), f(1)].map((x) => Math.round(x * 255));
	};
	const [x1, y1] = at("fireworks", 1);
	for (let y = 0; y < 32; y++)
		for (let x = 0; x < 64; x++) {
			const p = fw.get(x, y);
			if (p[3]) sheet.set(x1 + x, y1 + y, rot(p), p[3]);
		}
}

// ───────────────── 書き出し ─────────────────
const HERE = dirname(fileURLToPath(import.meta.url));
const out = argv.find((a) => a.endsWith(".png")) ?? join(HERE, "../public/sprites/baseball.png");
writeFileSync(out, encodePng(SW, SH, sheet.d));
console.log(`wrote ${out} (${SW}x${SH})`);
{
	const tsOut = argOf("--ts") ?? join(HERE, "../src/data/baseballSheet.ts");
	const rows = Object.entries(LAYOUT).map(([k, [x, y, w, h, n]]) => `\t${k}: { x: ${x}, y: ${y}, w: ${w}, h: ${h}, n: ${n} },`);
	const names = (list) => list.map(([k], i) => `\t${k}: ${i},`);
	const ts = [
		"// 1打席の 絵（public/sprites/baseball.png）の どこに 何が あるか。scripts/make-baseball.mjs が 書く（手で 直さない）。",
		"// x,y は 1コマ目の 左上。コマは 右へ w ずつ 並ぶ（n コマ）。歩行グラ（walk*）は 32x64 で 行が 後・右・前・左、列が 足踏み。",
		"",
		'export const BB_SHEET = "pub:sprites/baseball.png";',
		"",
		"export const BB_SPR = {",
		...rows,
		"} as const;",
		"",
		"/** BB_SPR.pose の 何コマ目か（RPGEN なんJキャラ）。 */",
		"export const BB_POSE = {",
		...names(POSE),
		"} as const;",
		"",
		"/** BB_SPR.fx の 何コマ目か（RPGEN エフェクト）。 */",
		"export const BB_FX = {",
		...names(FX),
		"} as const;",
		"",
	].join("\n");
	writeFileSync(tsOut, ts);
	console.log(`wrote ${tsOut}`);
}

// ───────────────── 見本（--mock dir）：遊ぶ ときの 描き方を まねて 場面を 並べる（3倍） ─────────────────
const mockDir = argOf("--mock");
if (mockDir) {
	mkdirSync(mockDir, { recursive: true });
	const scale = (img, k) => {
		const o = new Img(img.w * k, img.h * k);
		for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) o.set(x, y, img.get(Math.floor(x / k), Math.floor(y / k)));
		return o;
	};
	const put = (c, key, i, x, y) => {
		const [sx, sy] = at(key, i);
		const [, , w, h] = LAYOUT[key];
		c.blit(sheet, sx, sy, w, h, Math.round(x), Math.round(y));
	};
	const ROW = { up: 0, right: 1, down: 2, left: 3 };
	/** 歩行グラの 1コマ（16x16）を 足もと (8,15) で。 */
	const walk = (c, key, i, dir, f, fx, fy) => {
		const [sx, sy] = at(key, i);
		c.blit(sheet, sx + f * 16, sy + ROW[dir] * 16, 16, 16, Math.round(fx - 8), Math.round(fy - 15));
	};
	const pose = (c, name, fx, fy) => put(c, "pose", POSE.findIndex(([k]) => k === name), fx - 8, fy - 15);
	const fx = (c, name, x, y) => put(c, "fx", FX.findIndex(([k]) => k === name), x, y);
	const proj = (X, Z, h) => ({ x: CX + (F * X) / (Z + CZ), y: HZ + (F * (CH - h)) / (Z + CZ) });
	const FIELD_POS = [[14, 24], [8, 35], [-8, 35], [-14, 24], [-30, 72], [0, 82], [30, 72]];
	const PKEY = { shobon: "pitcherShobon", yakiu: "pitcherYakiu", nanashi: "pitcherNanashi" };
	const sceneA = (th, opt) => {
		const c = new Img(240, 150);
		put(c, th === "night" ? "bgNight" : "bgDay", 0, 0, 0);
		if (opt.cheer) put(c, th === "night" ? "cheerNight" : "cheerDay", 0, 0, 18);
		// 遠くの 野手
		FIELD_POS.forEach(([X, Z], i) => {
			const p = proj(X, Z, 0);
			const back = opt.lookBack ? 1 : 0;
			if (th === "night") put(c, "farGen", back, p.x - 4, p.y - 12);
			else put(c, "farNanashi", (i % 4) * 2 + back, p.x - 4, p.y - 12);
		});
		put(c, PKEY[opt.pitcher], opt.pose, 120 - 12, 66 - 31);
		// ！？ は orz の 頭の 上（スコアボードに かからない 高さ）
		if (opt.wow) fx(c, "wow", 98, 38);
		put(c, "umpire", opt.call ? 1 : 0, 146 - 12, 149 - 31);
		put(c, "catcher", opt.catch ? 1 : 0, 120 - 12, 141 - 23);
		// ストライクゾーン
		const z0 = proj(-0.25, 0, 1.05);
		const z1 = proj(0.25, 0, 0.45);
		for (let x = Math.round(z0.x); x <= Math.round(z1.x); x++) {
			c.set(x, Math.round(z0.y), WHITE, 60);
			c.set(x, Math.round(z1.y), WHITE, 60);
		}
		for (let y = Math.round(z0.y); y <= Math.round(z1.y); y++) {
			c.set(Math.round(z0.x), y, WHITE, 60);
			c.set(Math.round(z1.x), y, WHITE, 60);
		}
		put(c, "kiriko", opt.k, 102 - 20, 124 - 51);
		if (opt.trail) put(c, "trail", 0, 102 - 20, 124 - 51);
		if (opt.ballZ !== undefined) {
			const b = proj(opt.ballX ?? 0, opt.ballZ, opt.ballH);
			const s = proj(opt.ballX ?? 0, opt.ballZ, 0);
			put(c, opt.ballZ < 6 ? "shadow6" : "shadow4", 0, s.x - 4, s.y - 4);
			put(c, opt.ballZ < 3 ? "ball6" : opt.ballZ < 9 ? "ball4" : "ball2", 0, b.x - 4, b.y - 4);
			if (opt.impact) fx(c, opt.impact, b.x - 8, b.y - 8);
		}
		if (opt.fireworks) {
			put(c, "fireworks", 0, 14, 2);
			put(c, "fireworks", 1, 162, 6);
		}
		if (opt.sparks)
			for (const [i, x, y] of [[2, 30, 8], [1, 58, 14], [2, 178, 10], [0, 204, 4]]) fx(c, ["spark0", "spark1", "spark2"][i], x, y);
		// ランプ（B1 S2 O0 の 例）と 球速
		put(c, "lamp", 0, 94, 18);
		put(c, "lamp", 1, 119, 18);
		put(c, "lamp", 1, 125, 18);
		for (const [i, d] of (opt.kmh ?? [1, 5, 1]).entries()) put(c, "digit", d, 123 + i * 4, 25);
		return c;
	};
	const shots = [
		["a_night_set", sceneA("night", { pitcher: "shobon", pose: 0, k: 0 })],
		["b_night_release", sceneA("night", { pitcher: "shobon", pose: 3, k: 1, ballZ: 10, ballH: 1.6, kmh: [0, 9, 8] })],
		["c_night_contact", sceneA("night", { pitcher: "shobon", pose: 4, k: 2, trail: true, ballZ: 0.3, ballH: 0.8, impact: "impact1" })],
		["d_day_follow", sceneA("day", { pitcher: "yakiu", pose: 4, k: 3, cheer: true, kmh: [1, 3, 2] })],
		["e_day_whiff", sceneA("day", { pitcher: "nanashi", pose: 4, k: 4, catch: true, call: true })],
		["f_night_hr", sceneA("night", { pitcher: "shobon", pose: 5, k: 5, cheer: true, wow: true, fireworks: true, lookBack: true })],
		["f2_day_hr", sceneA("day", { pitcher: "yakiu", pose: 5, k: 5, cheer: true, wow: true, lookBack: true, sparks: true })],
	];
	for (const [name, img] of shots) writeFileSync(join(mockDir, `${name}.png`), encodePng(720, 450, scale(img, 3).d));

	// 上から 見た 場面（240x150 の 窓で 打球を 追う）
	const toImg = (X, Z) => [HOME[0] + X * K, HOME[1] - Z * K];
	const sceneB = (th, opt) => {
		const c = new Img(240, 150);
		const [fx0, fy0] = at(th === "night" ? "fieldNight" : "fieldDay");
		const cam = opt.cam;
		c.blit(sheet, fx0 + cam[0], fy0 + cam[1], 240, 150, 0, 0);
		const scr = (X, Z) => {
			const [x, y] = toImg(X, Z);
			return [x - cam[0], y - cam[1]];
		};
		for (const m of opt.people) {
			const [x, y] = scr(m.X, m.Z);
			if (m.walk) walk(c, m.walk, m.i ?? 0, m.dir, m.f ?? 0, x, y);
			else pose(c, m.pose, x, y);
			if (m.bubble) fx(c, m.bubble, x - 8, y - 32);
		}
		if (opt.ball) {
			const [x, y] = scr(opt.ball.X, opt.ball.Z);
			put(c, "shadow4", 0, x - 4, y - 4);
			put(c, opt.ball.h >= 6 ? "ball6" : "ball4", 0, x - 4, y - 4 - opt.ball.h * 0.9);
		}
		for (const [i, x, y] of opt.fireworks ?? []) put(c, "fireworks", i, x, y);
		return c;
	};
	const gen = (X, Z, dir = "down", f = 0, extra = {}) => ({ X, Z, walk: "walkGen", dir, f, ...extra });
	const nan = (i, X, Z, dir = "down", f = 0, extra = {}) => ({ X, Z, walk: "walkNanashi", i, dir, f, ...extra });
	// 野球ch：左中間への ツーベース。左翼が 「！」で 追い、遊撃は 飛びついて とどかない、キリコは 一塁へ
	writeFileSync(
		join(mockDir, "g_field_night_double.png"),
		encodePng(
			720,
			450,
			scale(
				sceneB("night", {
					cam: [40, 104],
					people: [
						gen(0, 18.4, "up"),
						{ X: 14, Z: 24, pose: "genGlove" },
						gen(8, 35, "left", 1),
						{ X: -10, Z: 37, pose: "genDive" },
						gen(-14, 24, "up", 0),
						gen(-24, 60, "up", 1, { bubble: "bang" }),
						gen(-4, 70, "left", 0),
						gen(28, 66, "left", 1),
						{ X: 12, Z: 10, walk: "walkKiriko", dir: "right", f: 1 },
					],
					ball: { X: -18, Z: 50, h: 7 },
				}),
				3,
			).d,
		),
	);
	// 保守村：ホームラン。中堅は フェンスで 見上げ、やきうは 「！？」、空に 花火
	writeFileSync(
		join(mockDir, "h_field_day_hr.png"),
		encodePng(
			720,
			450,
			scale(
				sceneB("day", {
					cam: [70, 0],
					people: [
						nan(0, 2, 90, "up"),
						nan(1, 28, 70, "up", 1),
						nan(2, -26, 72, "right", 0),
						nan(3, 8, 37, "up"),
						nan(0, -8, 37, "up", 1),
					],
					ball: { X: 6, Z: 104, h: 9 },
					fireworks: [[0, 20, 2], [1, 150, 10]],
				}),
				3,
			).d,
		),
	);
	// 保守村：右前の ヒット。やきうは マウンドで うしろを 向いて 見送り、右翼が 「！」で 追う
	writeFileSync(
		join(mockDir, "i_field_day_single.png"),
		encodePng(
			720,
			450,
			scale(
				sceneB("day", {
					cam: [60, 110],
					people: [
						nan(3, 0, -1.2, "up"),
						{ X: 0, Z: 18.4, pose: "yakiuBack" },
						nan(0, 15, 25, "right", 1),
						nan(1, 9, 34, "right", 0),
						nan(2, -8, 35, "down"),
						nan(3, -14, 24, "down", 1),
						nan(0, 27, 54, "down", 1, { bubble: "bang" }),
						{ X: 5, Z: 5, walk: "walkKiriko", dir: "right", f: 0 },
					],
					ball: { X: 21, Z: 41, h: 3 },
				}),
				3,
			).d,
		),
	);
	writeFileSync(join(mockDir, "sheet_x2.png"), encodePng(SW * 2, SH * 2, scale(sheet, 2).d));
	console.log(`mock → ${mockDir}`);
}
