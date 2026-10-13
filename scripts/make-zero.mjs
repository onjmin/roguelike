// 解音ゼロの サブ機ちがいの 歩行グラ（32x64・16x16 が 2コマ×4方向）を書き出す（node scripts/make-zero.mjs）。
//
// 解音ゼロは 3体いる（公式サイト https://zero-tokine-test.my.canva.site/ の「解音ゼロとは？」）。
//   VHz8-0（通称 メインさん） … メイン機。話に 出てくる ゼロ（data/people/cast.ts の zero）。
//   HeBc-0（通称 プロト）     … サブ機。RPGEN「解音ゼロ - HeBc-0（通称: プロト）」（sa:KxS5YZ・作者の 手描き）を そのまま 使う。
//   XQxS-0（通称 レン）       … サブ機。
// メインさん・レンの 歩行グラは RPGEN に 無いので、プロトの 頭の 位置と 足の 運びに 合わせて、公式の 絵から 1コマずつ 描いた（下の VARIANTS）。
// 色を 塗りかえるだけでは 3体の 見分けが つかないので、形（ファー・髪・脚・持ち物）から 描き分けている。
//
//   node scripts/make-zero.mjs                                … public/sprites/zero_main.png・zero_ren.png
//   node scripts/make-zero.mjs --compare out.png [--src KxS5YZ.png] … プロト・メインさん・レンを 8倍で 並べた 見くらべ用
//                                                                （プロトは --src の ファイルから、無ければ CDN から 取る）
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
	if (!chans || (ctype !== 3 && depth !== 8))
		throw new Error(`色の形 ${ctype}/${depth} は読めません`);
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
				const idx =
					(line[Math.floor(x / per)] >> (8 - depth * ((x % per) + 1))) &
					((1 << depth) - 1);
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

// ───────────────── 描き分け ─────────────────
//
// メインさん・レンは 1コマずつ 手で 描いた ドット（16x16）。プロトの 頭の 位置と 足の 運び（上下の ゆれ）に 合わせてある。
// 1行に 2コマ（左が コマ1・右が コマ2）。向きは 背中・右・正面の 順で、左は 右の 左右反転（プロトも そう）。
// 小文字は プロトと 同じ 色（BASE）、大文字と 一部の 小文字は キャラごとの 色。

const hex = (s) => {
	const n = Number.parseInt(s.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const BASE = {
	a: "#daa98a", // 髪の かげ
	b: "#fef3df", // 髪
	h: "#e5cca0", // 髪の なか
	c: "#c3cde1", // 着物の かげ（水色）
	d: "#1f4f87", // ふち・帯（紺）
	e: "#fefeff", // 着物（白）
	f: "#000000", // ふち・目
	g: "#2574ba", // 青
	i: "#eebfb3", // はだ
	j: "#fef4f1", // はだ（明）
	k: "#cea6a0", // はだ（暗）
	l: "#975649", // 目
	m: "#d68471", // ほお
	n: "#b98d7b", // まぶた
};
const CELL = 16;
const DIRS = ["up", "right", "down", "left"];

const VARIANTS = {
	// VHz8-0（メインさん）：公式の 手描き（人力出力版）。肩と 袖口の 白い ファー（袖口に 赤い ひも）、むき出しの 肩と 太もも、
	// 青い レッグウォーマーに 赤い 下駄、帯の 前に 赤い X の 結び目、腰の 後ろから 赤い ケーブル（先に プラグ）、赤紫の 目。
	main: {
		palette: {
			l: "#8e3a7e",
			u: "#ffffff",
			v: "#b4bed0",
			R: "#d8303e",
			r: "#8a1a28",
			Q: "#9a9aa8",
		},
		frames: [
			// up
			"................ ...g..a....g....",
			"...g..a....g.... ...cc..a..cc....",
			"...cc..a..cc.... ...dcaaaaacd....",
			"...dcaaaaacd.... ...aahbbbhaa....",
			"...aahbbbhaa.... ...ahbbbbbha....",
			"...ahbbbbbha.... ...abbbbbbba....",
			"...abbbbbbba.... .aahbbhhhbbhaa..",
			".aahbbhhhbbhaa.. uuvuahhhhhauvuu.",
			"uuvuahhhhhauvuu. vuuvuvhhhvuvuuv.",
			"vuuvuvhhhvuvuuv. aauvuuvuuvuuvaa.",
			"aauvuuvuuvuuvaa. .cdavuuvuuvadc..",
			".cdavuuvuuvadc.. .uuddddrddddvu..",
			".uuddddrddddvu.. ..r..ki.Rik..r..",
			"..r..ki.Rik..r.. .....RR.Rgg.....",
			".....gg.R.gg.... .......R.RR.....",
			".....RR..RQ..... .......Q........",
			// right
			"....g....a.d.... .....g....a.d...",
			"....eeaaa..c.... .....eeaaa..c...",
			"....ggebbbad.... ....aggebbbad...",
			"....adbbbbba.... ....aadbbbbba...",
			"...ababbbabba... ....ababbbaba...",
			"...abablailba... ....abablailba..",
			"..ababbmjjmbba.. ...ababbmjjmba..",
			"..aabafijjifa... .a.abbafijjifa..",
			"..aavuuujijja... .aaaavuuujijja..",
			"..aavuuuvdeee... .aaavuuuvdeee...",
			"..aabvuvfddRf... ...aavuvfddRf...",
			"..ar.vuvdeeer... ..rr.vuvdeeer...",
			".Rr..uRuddcdd... .R...uRuddcdd...",
			".R....Rkiiii.... .Q....R.kiik....",
			".Q...gg...gg.... ........ggg.....",
			".....RR....RR... .......RRRR.....",
			// down
			"...g..a....g.... ................",
			"...ee..a..ee.... ...g..a....g....",
			"...geaaaaaeg.... ...ee..a..ee....",
			"...dabbbbbad.... ...geaaaaaeg....",
			"...abbababba.... ...dabbbbbad....",
			"...abliailba.... ...abbababba....",
			"..abbmjjjmbba... ...abliailba....",
			".aaafijjjifaaa.. ..abbmjjjmbba...",
			".uuvujiiijuvuu.. .aaafijjjifaaa..",
			"auvucdReRdcuvua. .uuvujiiijuvuu..",
			"aauvfddRddfvuaa. auvucdReRdcuvua.",
			"a.cederereced.a. aauvfddRddfvuaa.",
			"..uuddcdcdduu... a.cederereced.a.",
			"..r..kiiiik.rr.. ..uudkiiiikduurr",
			".....gg..RR..R.. ..r..RR..gg.r..R",
			".....RR......Q.. .........RR....Q",
		],
	},
	// XQxS-0（レン）：公式の 絵（ステージの 子）。まっすぐ 長い 髪（ぱっつん前髪、下へ いくほど 青）、金の 角と 黒い ヘッドホン、
	// 長めの 着物（金の 線、黒い 帯に 青い リボン）、黒い 手袋、マイク、黒い 脚の よろいと 金の 靴、青い 目。
	ren: {
		palette: {
			l: "#2a64c8",
			A: "#2d5f9e",
			H: "#4f8fd0",
			B: "#9fd0f2",
			G: "#e0b040",
			Y: "#f6dc80",
			O: "#8a5a18",
			K: "#24242c",
			N: "#50505e",
		},
		frames: [
			// up
			"................ ...O.......O....",
			"...O.......O.... ...GO.....OG....",
			"...GO.....OG.... ...GYaaaaaYG....",
			"...GYaaaaaYG.... ...abbbbbbba....",
			"...abbbbbbba.... ..NKbbbbbbbKN...",
			"..NKbbbbbbbKN... ...abbabbbba....",
			"...abbabbbba.... ..abbabbbabba...",
			"..abbabbbabba... ..abbabbbabba...",
			"..abbabbbabba... ..ahbahbhabha...",
			"..ahbahbhabha... .chBhaBhBahBhc..",
			".chBhaBhBahBhc.. .KHBBHBBBHBBHK..",
			".KHBBHBBBHBBHK.. ..HBAHBBBHABH...",
			"..HBAHBBBHABH... ..A.AHA.AHA.A...",
			"..A.AHA.AHA.A... .....KN..NK.....",
			".....KN..YO..... .....YO..NK.....",
			".....YO......... .........OY.....",
			// right
			"....O......O.... .....O......O...",
			"....GYaaa..G.... .....GYaaa..G...",
			"....GGYbbbaG.... .....GGYbbbaG...",
			"....aabbbbba.... .....aabbbbba...",
			"...abbbbbbbba... ....abbbbbbbba..",
			"...abablailba... ....abablailba..",
			"..abKbbmjjmbba.. ...abKbbmjjmbba.",
			"...abafijjifa... ....abafijjifa..",
			"..aabahKKKK.Y... ...aabahKKKK.Y..",
			"..hBbhceeYeKO... ..hBabhceeYeKO..",
			"..BhBcecKKgK.... .hBBhcecKKgK....",
			"..HBHceeYeeec... .BHBHceeYeeec...",
			"..AHAcdYdddcd... .AHAHcdYdddcd...",
			"..A.A.KN.KN..... .A.A....KNK.....",
			"......KN..KN.... ........KNK.....",
			"......YO...YO... ........YOO.....",
			// down
			"...O.......O.... ................",
			"...GO.....OG.... ...O.......O....",
			"...GYaaaaaYG.... ...GO.....OG....",
			"...aabbbbbaa.... ...GYaaaaaYG....",
			"...abbbbbbba.... ...aabbbbbaa....",
			"...abliailba.... ...abbbbbbba....",
			"..KbbmjjjmbbK... ...abliailba....",
			"..aaafijjjifaaa. ..KbbmjjjmbbK...",
			".aahHcKKKcHhaa.. ..aaafijjjifaaa.",
			"hBhceeeYeeechBh. .aahHcKKKcHhaa..",
			"BHYecKKgKKcecHB. hBhceeeYeeechBh.",
			"HAOKeeeYeeeKc.AH BHYecKKgKKcecHB.",
			"A..ceeeYeeec..A. HAOKeeeYeeeKc.AH",
			"A..cdYdddYdc..A. A..cdYdddYdc..A.",
			".A...KN..YO..A.. .A...YO..KN..A..",
			".....YO......... .........YO.....",
		],
	},
};

/** frames（背中・右・正面 × 16行、1行に 2コマ）を 32x64 の 絵に。左は 右の 左右反転。 */
const paint = ({ palette, frames }) => {
	const color = { ...BASE, ...palette };
	const w = CELL * 2;
	const h = CELL * 4;
	const rgba = Buffer.alloc(w * h * 4);
	const put = (x, y, ch) => {
		if (ch === ".") return;
		if (!color[ch]) throw new Error(`知らない 色の 文字 ${ch}`);
		rgba.set([...hex(color[ch]), 255], (y * w + x) * 4);
	};
	const rows = frames.map((r) => r.replace(" ", ""));
	if (rows.length !== CELL * 3 || rows.some((r) => r.length !== w))
		throw new Error("コマの 大きさが ちがいます");
	for (const [d, dir] of ["up", "right", "down"].entries())
		for (let y = 0; y < CELL; y++)
			for (let x = 0; x < w; x++)
				put(x, DIRS.indexOf(dir) * CELL + y, rows[d * CELL + y][x]);
	const left = DIRS.indexOf("left") * CELL;
	for (let y = 0; y < CELL; y++)
		for (let x = 0; x < w; x++) {
			const f = Math.floor(x / CELL);
			put(x, left + y, rows[CELL + y][f * CELL + (CELL - 1 - (x % CELL))]);
		}
	return { w, h, rgba };
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
			for (let k = 0; k < 3; k++)
				out[o + k] = Math.round(img.rgba[s + k] * a + bg[k] * (1 - a));
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
		for (let y = 0; y < im.h; y++)
			im.rgba.copy(out, (y * W + ox) * 4, y * im.w * 4, (y + 1) * im.w * 4);
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
const out = {};
for (const [id, v] of Object.entries(VARIANTS)) {
	out[id] = paint(v);
	save(join(ROOT, `public/sprites/zero_${id}.png`), out[id]);
}
const compare = opt("--compare");
if (compare) {
	const srcPath = opt("--src");
	const srcBuf =
		srcPath && existsSync(srcPath)
			? readFileSync(srcPath)
			: Buffer.from(await (await fetch(SRC_URL)).arrayBuffer());
	const src = decodePng(srcBuf);
	const GREEN = [88, 120, 72];
	save(
		resolve(compare),
		hcat(
			[src, out.main, out.ren].map((i) => scaleOn(i, 8, GREEN)),
			16,
			GREEN,
		),
	);
}
