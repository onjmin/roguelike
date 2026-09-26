// メタルぷゆゆの歩行グラ（32x64・16x16 が 2コマ×4方向）を書き出す（node scripts/make-metal-puyu.mjs）。
//
// 元は RPGEN の歩行グラ「PIEN」（sa:DszPWT・no.1404。元絵は スプライト no.22232「U+1F97A」）。
// 形と顔（目・口・目の光）はそのまま、黄色の体だけを 銀の陰影に塗りかえる。
// 光は左上から（メタルとうすこ sa:Gb8UX4 と同じ向き）。ドームに見立てて 明るさを出し、
// 左上に白い照り、右下のふちを暗くする。ほっぺの赤みは消す（--blush で うすい灰にもできる）。
//
//   node scripts/make-metal-puyu.mjs                           … public/sprites/metal_puyu.png
//   node scripts/make-metal-puyu.mjs --src DszPWT.png          … 元絵を手元のファイルから（無ければ CDN から取る）
//   node scripts/make-metal-puyu.mjs --out a.png --preview b.png --compare c.png --blush
//
// 依存なし（zlib だけ）。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_URL = "https://rpgen-search.pages.dev/data/images/sAnims/DszPWT.png";

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

const hex = (s) => {
	const n = Number.parseInt(s.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// 銀（暗→明）。ほんの少し青みを入れて「金属」に寄せる。
const TONES = ["#4e5664", "#6f7888", "#949dab", "#b8bfca", "#d8dde4", "#f1f3f6"].map(hex);
const SHINE = hex("#ffffff"); // 照り
const EYE = hex("#1b1e25"); // 目・口（元の黒）
const EYE_LIGHT = hex("#ffffff"); // 目の光（元の白）
const BLUSH = hex("#e4e8ee"); // --blush のときのほっぺ

// 元絵の色の見分け（PIEN は 黄 #ffd21f・ほっぺ #ffb41f・黒・白 の4色）
const kind = (r, g, b) => {
	if (r < 60 && g < 60 && b < 60) return "eye";
	if (r > 235 && g > 235 && b > 235) return "light";
	if (r > 200 && g > 150 && g < 195 && b < 90) return "blush";
	return "body";
};

const CELL = 16;

// 陰影のつまみ（t は TONES の番号。0=暗 … 5=明。u, v は コマの箱で -1..1）
const S = {
	base: 1.3, // 光の当たらない面の明るさ
	gain: 3.8, // 光の強さ
	top: 4, // 照りのまわり以外の 上限
	bandTop: 0.42, // 暗い帯（地平線の映りこみ）
	bandBottom: 0.7,
	band: 0.7,
	ground: 0.7, // 帯より下（地面の映りこみ）は 少し明るく
	rim: 0.9, // 右・下のふちを 暗く
	bounceU: 0.1, // 下のふちの 照り返し（u がこれより左）
	bounce: 0.6,
	lightRing: 3, // 目の光の となり（上・左右）の 上限
	shineU: -0.4, // 照りの中心
	shineV: -0.5,
	shineCore: 0.03, // 照りの芯（白）
	shineHalo: 0.14, // 照りのまわり（TONES の いちばん明るい色）
};

const metalize = (src, { blush = false } = {}) => {
	const { w, h } = src;
	const out = Buffer.alloc(w * h * 4);
	const at = (x, y) => (y * w + x) * 4;
	for (let cy = 0; cy < h; cy += CELL)
		for (let cx = 0; cx < w; cx += CELL) {
			// このコマの 形（不透明）と 外接の箱
			const inside = (x, y) =>
				x >= cx && x < cx + CELL && y >= cy && y < cy + CELL && src.rgba[at(x, y) + 3] > 127;
			let x0 = 99;
			let x1 = -1;
			let y0 = 99;
			let y1 = -1;
			for (let y = cy; y < cy + CELL; y++)
				for (let x = cx; x < cx + CELL; x++)
					if (inside(x, y)) {
						x0 = Math.min(x0, x);
						x1 = Math.max(x1, x);
						y0 = Math.min(y0, y);
						y1 = Math.max(y1, y);
					}
			if (x1 < 0) continue;
			const mx = (x0 + x1 + 1) / 2;
			const my = (y0 + y1 + 1) / 2;
			const rx = (x1 - x0 + 1) / 2;
			const ry = (y1 - y0 + 1) / 2;
			// ドームに見立てた 面の向き × 左上からの光
			const L = (() => {
				const v = [-0.55, -0.75, 0.62];
				const n = Math.hypot(...v);
				return v.map((c) => c / n);
			})();
			for (let y = cy; y < cy + CELL; y++)
				for (let x = cx; x < cx + CELL; x++) {
					if (!inside(x, y)) continue;
					const i = at(x, y);
					const [r, g, b] = src.rgba.subarray(i, i + 3);
					const k = kind(r, g, b);
					let c;
					if (k === "eye") c = EYE;
					else if (k === "light") c = EYE_LIGHT;
					else {
						const u = (x + 0.5 - mx) / rx;
						const v = (y + 0.5 - my) / ry;
						const nz = Math.sqrt(Math.max(0, 1 - u * u - v * v));
						const lam = Math.max(0, u * L[0] + v * L[1] + nz * L[2]); // 0..1
						let t = Math.min(S.top, S.base + lam * S.gain);
						// 金属らしさ: 胴の下めに 暗い帯（地平線の映りこみ）、その下は 地面の映りこみで 少し明るく
						if (v > S.bandTop && v < S.bandBottom) t -= S.band;
						else if (v >= S.bandBottom) t += S.ground;
						const edgeR = !inside(x + 1, y);
						const edgeB = !inside(x, y + 1);
						if (edgeB && u < S.bounceU) t += S.bounce;
						else if (edgeR || edgeB) t -= S.rim;
						let ti = Math.max(0, Math.min(S.top, Math.round(t)));
						// 目の光（白）の 上・左右は 白に埋もれないよう 抑える
						const nearLight = [
							[1, 0],
							[-1, 0],
							[0, 1],
						].some(([dx, dy]) => {
							if (!inside(x + dx, y + dy)) return false;
							const j = at(x + dx, y + dy);
							return kind(src.rgba[j], src.rgba[j + 1], src.rgba[j + 2]) === "light";
						});
						if (nearLight) ti = Math.min(ti, S.lightRing);
						// 照り: 左上に 白い芯と 明るいまわり
						const du = u - S.shineU;
						const dv = v - S.shineV;
						const d2 = du * du * 1.3 + dv * dv;
						c = nearLight
							? TONES[ti]
							: d2 < S.shineCore
								? SHINE
								: d2 < S.shineHalo
									? TONES[TONES.length - 1]
									: TONES[ti];
						if (k === "blush") c = blush ? BLUSH : c;
					}
					out[i] = c[0];
					out[i + 1] = c[1];
					out[i + 2] = c[2];
					out[i + 3] = 255;
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
const out = resolve(opt("--out") ?? join(ROOT, "public/sprites/metal_puyu.png"));
const srcPath = opt("--src");
const srcBuf =
	srcPath && existsSync(srcPath)
		? readFileSync(srcPath)
		: Buffer.from(await (await fetch(SRC_URL)).arrayBuffer());
// つまみの上書き（見くらべ用）: --set band=0,ground=0
const sets = opt("--set");
if (sets)
	for (const kv of sets.split(",")) {
		const [k, v] = kv.split("=");
		if (!(k in S)) throw new Error(`つまみが無い: ${k}`);
		S[k] = Number(v);
	}
const src = decodePng(srcBuf);
if (src.w !== 32 || src.h !== 64) throw new Error(`32x64 ではありません: ${src.w}x${src.h}`);
const metal = metalize(src, { blush: args.includes("--blush") });
save(out, metal);

const GREEN = [88, 120, 72];
const preview = opt("--preview");
if (preview) save(resolve(preview), scaleOn(metal, 8, GREEN));
const compare = opt("--compare");
if (compare) save(resolve(compare), hcat([scaleOn(src, 8, GREEN), scaleOn(metal, 8, GREEN)], 16, GREEN));
