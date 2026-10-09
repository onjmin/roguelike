// ネタスレの 遊びの 絵を 書き出す（node scripts/make-neta.mjs）。
//
//   public/sprites/neta.png      … 64x64。部屋の 物（リバーシ盤・コンマの 台・腹筋台・文机）と 板の 絵（サイコロ・筆・腹筋の 子 2コマ）
//   public/sprites/neta_kabe.png … 32x128。グラウンドの「5割の壁」の 歩行グラ（16x32 が 2コマ×4方向。行は 後・右・前・左）
//
// 絵の 出どころ:
//   - リバーシ盤 … RPGEN「碁盤」（sp:AeSsDg。村の 碁会所の 碁盤と 同じ 台）の 盤面を 緑に 塗りかえ、まんなかに 石を 4つ（はじめの 形）。
//   - サイコロ … RPGEN スプライトセット「囲碁・将棋・五目並べ・オセロ」(17) の サイコロ（sp:83nRXJ）を そのまま。
//   - 筆       … RPGEN「筆」（sp:sZH68xr）を そのまま。
//   - ほかは ここで 描く（ASCII の 絵と 色。scripts/make-minors.mjs と 同じ 書き方）。
//     5割の壁は 順位スレの「5割の壁」（おんJwiki pages/21。お絵かきニキの ぬりかべの ような 絵。文字の AA は 無い）を 元に、
//     灰色の 石の 壁に 目と 口、胸に 5割の 線「//」。
//
//   node scripts/make-neta.mjs                 … 上の 2枚を 書く（RPGEN の 絵は CDN から 取る）
//   node scripts/make-neta.mjs --cache <dir>   … RPGEN の 絵を <dir>/<id>.png から 読む（無ければ 取って 置く）
//   node scripts/make-neta.mjs --out <dir>     … public/sprites の かわりに <dir> へ 書く（見本づくり用）
//   node scripts/make-neta.mjs --preview <png> … 2枚を 8倍に した 見くらべ用も 書く
//
// 依存なし（zlib だけ）。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argOf = (name) => {
	const i = argv.indexOf(name);
	return i >= 0 ? argv[i + 1] : null;
};
const OUT = argOf("--out") ?? join(HERE, "../public/sprites");
const CACHE = argOf("--cache");
const PREVIEW = argOf("--preview");

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
const encodePng = (img) => {
	const { w, h, d } = img;
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0);
	ihdr.writeUInt32BE(h, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	const raw = Buffer.alloc((w * 4 + 1) * h);
	for (let y = 0; y < h; y++) {
		raw[y * (w * 4 + 1)] = 0;
		d.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
};
/** 非インターレースの PNG（グレー・RGB・パレット・RGBA、8bit 以下）を RGBA に。 */
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
	const out = new Img(w, h);
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
				out.d[o] = pal[idx * 3];
				out.d[o + 1] = pal[idx * 3 + 1];
				out.d[o + 2] = pal[idx * 3 + 2];
				out.d[o + 3] = trns && idx < trns.length ? trns[idx] : 255;
			} else if (type === 6) line.copy(out.d, o, x * 4, x * 4 + 4);
			else if (type === 2) {
				out.d[o] = line[x * 3];
				out.d[o + 1] = line[x * 3 + 1];
				out.d[o + 2] = line[x * 3 + 2];
				out.d[o + 3] = 255;
			} else if (type === 4) {
				out.d[o] = out.d[o + 1] = out.d[o + 2] = line[x * 2];
				out.d[o + 3] = line[x * 2 + 1];
			} else {
				const v = depth === 8 ? line[x] : 0;
				out.d[o] = out.d[o + 1] = out.d[o + 2] = v;
				out.d[o + 3] = 255;
			}
		}
	}
	return out;
};

// ───────────────── 画素 ─────────────────
class Img {
	constructor(w, h) {
		this.w = w;
		this.h = h;
		this.d = Buffer.alloc(w * h * 4);
	}
	get(x, y) {
		const o = (y * this.w + x) * 4;
		return [this.d[o], this.d[o + 1], this.d[o + 2], this.d[o + 3]];
	}
	set(x, y, c) {
		if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
		const o = (y * this.w + x) * 4;
		this.d[o] = c[0];
		this.d[o + 1] = c[1];
		this.d[o + 2] = c[2];
		this.d[o + 3] = c[3] ?? 255;
	}
	/** src を (dx, dy) に 写す（透明は 写さない）。 */
	blit(src, dx, dy) {
		for (let y = 0; y < src.h; y++)
			for (let x = 0; x < src.w; x++) {
				const c = src.get(x, y);
				if (c[3] > 0) this.set(dx + x, dy + y, c);
			}
	}
}
const hex = (s) => [
	Number.parseInt(s.slice(1, 3), 16),
	Number.parseInt(s.slice(3, 5), 16),
	Number.parseInt(s.slice(5, 7), 16),
	255,
];
/** ASCII の 絵（"." は 透明）を (dx, dy) に 描く。 */
const paint = (img, dx, dy, art, pal) => {
	const w = art[0].length;
	art.forEach((row, y) => {
		if (row.length !== w)
			throw new Error(`行の 長さが ちがう: "${row}" (${row.length} / ${w})`);
		[...row].forEach((ch, x) => {
			if (ch === ".") return;
			const c = pal[ch];
			if (!c) throw new Error(`色 "${ch}" が 未定義`);
			img.set(dx + x, dy + y, hex(c));
		});
	});
};
const mirror = (art) => art.map((r) => [...r].reverse().join(""));

// ───────────────── RPGEN（作る ときだけ 取る） ─────────────────
const CDN = "https://rpgen-search.pages.dev/data/images/sprites";
const rpgen = async (id) => {
	const local = CACHE ? join(CACHE, `${id}.png`) : null;
	let buf;
	if (local && existsSync(local)) buf = readFileSync(local);
	else {
		const res = await fetch(`${CDN}/${id}.png`);
		if (!res.ok) throw new Error(`${id}: ${res.status}`);
		buf = Buffer.from(await res.arrayBuffer());
		if (local) {
			mkdirSync(dirname(local), { recursive: true });
			writeFileSync(local, buf);
		}
	}
	const img = decodePng(buf);
	// CDN は 無い id にも 200 で 16x16 の「404」の 絵を 返す（黒と 白だけ）。そう 見えたら 止める
	let bw = 0;
	for (let i = 0; i < img.w * img.h; i++) {
		const [r, g, b, a] = [
			img.d[i * 4],
			img.d[i * 4 + 1],
			img.d[i * 4 + 2],
			img.d[i * 4 + 3],
		];
		if (
			a === 255 &&
			((r < 20 && g < 20 && b < 20) || (r > 235 && g > 235 && b > 235))
		)
			bw++;
	}
	if (bw === img.w * img.h) throw new Error(`${id}: CDN の「404」の 絵`);
	return img;
};

// ───────────────── 部屋の 物 ─────────────────

/** リバーシ盤：碁盤（AeSsDg）の 盤面の 2色を 緑に、まんなかに はじめの 石 4つ。 */
const othelloBoard = (goban) => {
	const out = new Img(16, 16);
	out.blit(goban, 0, 0);
	const LIGHT = "#f8c878";
	const DARK = "#c89868";
	for (let y = 1; y <= 9; y++)
		for (let x = 1; x <= 14; x++) {
			const [r, g, b] = out.get(x, y);
			const h = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
			if (h === LIGHT) out.set(x, y, hex("#2f9e44"));
			else if (h === DARK) out.set(x, y, hex("#278a3a"));
		}
	// 石（4x3。左上 白・右上 黒・左下 黒・右下 白）
	const disc = [".xx.", "xxxx", ".xx."];
	const put = (dx, dy, col, rim) => {
		disc.forEach((row, y) => {
			[...row].forEach((c, x) => {
				if (c === "x")
					out.set(dx + x, dy + y, hex(y === 2 && x > 0 && x < 3 ? rim : col));
			});
		});
	};
	put(4, 2, "#f4f4f0", "#a8a8a0");
	put(8, 2, "#1e1e1e", "#000000");
	put(4, 5, "#1e1e1e", "#000000");
	put(8, 5, "#f4f4f0", "#a8a8a0");
	return out;
};

/** コンマの 台（16x32。紺の 筐体・赤い 数字の 時計・赤い ボタン）。 */
const COMMA = [
	"................",
	"................",
	".kkkkkkkkkkkkkk.",
	".kwwwwwwwwwwwwk.",
	".kwnwwnwwnwwnwk.",
	".kkkkkkkkkkkkkk.",
	".kbbbbbbbbbbbbk.",
	".kbssssssssssbk.",
	".kbsnnsnnsnnsbk.",
	".kbsnnsnnsnnsbk.",
	".kbssnssnssnsbk.",
	".kbsnnsnnsnnsbk.",
	".kbssssssssssbk.",
	".kbsNNNNNNNNsbk.",
	".kbssssssssssbk.",
	".kbbbbbbbbbbbbk.",
	"kkkkkkkkkkkkkkkk",
	"kcycccccrccrccck",
	"kckcccccccccccck",
	"kkkkkkkkkkkkkkkk",
	".kbbbbbbbbbbbbk.",
	".kbBBBBBBBBBBbk.",
	".kbBbbbbbbbbBbk.",
	".kbBbbbggbbbBbk.",
	".kbBbbbggbbbBbk.",
	".kbBbbbbbbbbBbk.",
	".kbBBBBBBBBBBbk.",
	".kbbbbbbbbbbbbk.",
	".kbbbbbbbbbbbbk.",
	".kbbbbbbbbbbbbk.",
	".kddddddddddddk.",
	".kkkkkkkkkkkkkk.",
];
const COMMA_PAL = {
	k: "#14141c",
	w: "#ffe060",
	n: "#ff4a3a",
	N: "#7a2018",
	b: "#2a3a8a",
	B: "#4a5ab8",
	s: "#08080e",
	c: "#c8c8d0",
	y: "#f0d020",
	r: "#e02020",
	g: "#8a8a90",
	d: "#1c2860",
};

/** 腹筋台（16x16。坂に なった 黒い 台・足を かける ローラー・はり紙）。 */
const FUKKIN = [
	"................",
	"................",
	".kk.............",
	"kMMk............",
	".kkkkk..........",
	".kPPPkkkk.......",
	".kpppPPPPkkk....",
	".kkppwwwppPPkk..",
	"..kkkwrwpppppPk.",
	"..mk.wwwkkkpppk.",
	"..m.......kkkkk.",
	"..m...........m.",
	"..m...........m.",
	".kMk.........kMk",
	"................",
	"................",
];
const FUKKIN_PAL = {
	k: "#1a1a1a",
	p: "#3a3a48",
	P: "#5a5a72",
	m: "#b8b8c0",
	M: "#787880",
	w: "#f4f2ea",
	r: "#c03030",
};

/** 文机（16x16。半紙・すずり・筆）。 */
const DESK = [
	"................",
	"................",
	"................",
	".kkkkkkkkkkkkkk.",
	".kDDDDDDDDDDDDk.",
	".kDwwwwwwDssDDk.",
	".kDwiwiwwDsisDk.",
	".kDwwiwwwDssDDk.",
	".kDwiwwiwDDbDDk.",
	".kDWWWWWWDDDBDk.",
	".kddddddddddddk.",
	".kkkkkkkkkkkkkk.",
	"..kd........dk..",
	"..kk........kk..",
	"................",
	"................",
];
const DESK_PAL = {
	k: "#3a2418",
	d: "#8a5a34",
	D: "#b07a48",
	w: "#f6f4ee",
	W: "#d8d4c8",
	i: "#101010",
	s: "#2a2a30",
	b: "#c8a060",
	B: "#101010",
};

// ───────────────── 板の 絵：腹筋の 子（24x24・寝た／起きた） ─────────────────
// ID腹筋スレの >>1 の AA（∧,,∧ ( `･ω･)）の 子を 横から 見た 形。マットの 上で 腹筋する。
const FUKKIN_DOWN = [
	"........................",
	"........................",
	"........................",
	"........................",
	"........................",
	"........................",
	"........................",
	"........................",
	"........................",
	"........................",
	"....................kk..",
	"...................kwwk.",
	"..kk.kk...........kwwwk.",
	".kpwkpwk.........kwwwk..",
	".kwwwwwwk.......kwwwk...",
	"kwwwwwwwwkkkkkkkwwwk....",
	"kwewwwwwwwwwwwwwwwwk....",
	"kwwwewwwswwwwwwwwwwkk...",
	".kwwwwwkssssssssssswwk..",
	"..kkkkkkkkkkkkkkkkkkkk..",
	"MMMMMMMMMMMMMMMMMMMMMMMM",
	"mmmmmmmmmmmmmmmmmmmmmmmm",
	"mmmmmmmmmmmmmmmmmmmmmmmm",
	"MMMMMMMMMMMMMMMMMMMMMMMM",
];
const FUKKIN_UP = [
	"........................",
	"........................",
	"........................",
	"........................",
	"........kk.kk...........",
	".......kpwkpwk..........",
	".......kwwwwwwk.........",
	"......kwwwwwwwwk........",
	"......kwewwewwwk........",
	"......kwwwwwwwwk........",
	".......kwwsswwk.....kk..",
	"........kwwwwwk....kwwk.",
	"........kwwwwwwk..kwwwk.",
	".........kwwwwwwkkwwwk..",
	".........kwwwwwwwwwwk...",
	"..........kwwwwwwwwwk...",
	"..........kwwwwwwwwwk...",
	"..........kwwwwwwwwwkk..",
	"..........kssssssssswwk.",
	"..........kkkkkkkkkkkkk.",
	"MMMMMMMMMMMMMMMMMMMMMMMM",
	"mmmmmmmmmmmmmmmmmmmmmmmm",
	"mmmmmmmmmmmmmmmmmmmmmmmm",
	"MMMMMMMMMMMMMMMMMMMMMMMM",
];
const KO_PAL = {
	k: "#2a2a2a",
	w: "#f4f4ee",
	s: "#c8c8c0",
	e: "#1a1a1a",
	p: "#e8a0a0",
	m: "#3a8a5a",
	M: "#2a6a44",
};

// ───────────────── 5割の壁（16x32 の 歩行グラ） ─────────────────
const KABE_FRONT = [
	"................",
	"................",
	"................",
	"..kkkkkkkkkkkk..",
	".kGGGGGGGGGGGGk.",
	".kGggggggggggdk.",
	".kGgdgggggggggk.",
	".kGgggggggdgggk.",
	".kGggggggggggdk.",
	".kGgeeggggeegdk.",
	".kGgppggggppgdk.",
	".kGggggggggggdk.",
	".kGggggggggggdk.",
	".kGggggmmggggdk.",
	".kGggggggggdggk.",
	".kGgdgggggggggk.",
	".kGggggggggggdk.",
	".kGggggggrgrgdk.",
	".kGggggggrgrgdk.",
	".kGgggggrgrggdk.",
	".kGgggggrgrggdk.",
	".kGggggrgrgggdk.",
	".kGggggrgrgggdk.",
	".kGggggggggggdk.",
	".kGgdggggggggdk.",
	".kGggggggggdgdk.",
	".kGggggggggggdk.",
	".kGggggggggggdk.",
	".kddddddddddddk.",
	"..kkkkkkkkkkkk..",
	"...kfk....kfk...",
	"...kkk....kkk...",
];
const KABE_BACK = [
	"................",
	"................",
	"................",
	"..kkkkkkkkkkkk..",
	".kGGGGGGGGGGGGk.",
	".kGggggggggggdk.",
	".kGgggggdggggdk.",
	".kGggggggggggdk.",
	".kGgdgggggggddk.",
	".kGggggggggggdk.",
	".kGgggggggdgggk.",
	".kGggggggggggdk.",
	".kGggdggggggggk.",
	".kGggggggggggdk.",
	".kGggggggggdggk.",
	".kGggggggggggdk.",
	".kGgggdgggggggk.",
	".kGggggggggggdk.",
	".kGggggggggdgdk.",
	".kGggggggggggdk.",
	".kGgdgggggggggk.",
	".kGggggggggggdk.",
	".kGggggggdgggdk.",
	".kGggggggggggdk.",
	".kGggggggggggdk.",
	".kGgggdgggggggk.",
	".kGggggggggggdk.",
	".kGggggggggggdk.",
	".kddddddddddddk.",
	"..kkkkkkkkkkkk..",
	"...kfk....kfk...",
	"...kkk....kkk...",
];
const KABE_RIGHT = [
	"................",
	"................",
	"................",
	".....kkkkkk.....",
	"....kGGGGGGk....",
	"....kGgggggk....",
	"....kGgdgggk....",
	"....kGgggggk....",
	"....kGgggggk....",
	"....kGgggeek....",
	"....kGgggpek....",
	"....kGgggggk....",
	"....kGgggggk....",
	"....kGggggmk....",
	"....kGgggggk....",
	"....kGgdgggk....",
	"....kGgggggk....",
	"....kGgggggk....",
	"....kGgggdgk....",
	"....kGgggggk....",
	"....kGgggggk....",
	"....kGdggggk....",
	"....kGgggggk....",
	"....kGgggggk....",
	"....kGgggdgk....",
	"....kGgggggk....",
	"....kGgggggk....",
	"....kGgggggk....",
	"....kddddddk....",
	".....kkkkkk.....",
	".....kfk.kfk....",
	".....kkk.kkk....",
];
const KABE_PAL = {
	k: "#3a3a34",
	G: "#c8c2ae",
	g: "#a8a28e",
	d: "#7e7866",
	e: "#f4f2ea",
	p: "#1a1a1a",
	m: "#5a3a30",
	r: "#4e4a3e",
	f: "#6a6456",
};
/** 2コマ目：足（下の 2行）だけ 差しかえる（前・後は 内へ、横は 前後へ ひらく）。 */
const FEET_FRONT = ["....kfk..kfk....", "....kkk..kkk...."];
const FEET_SIDE = ["....kfk...kfk...", "....kkk...kkk..."];
const step = (art, feet) => [...art.slice(0, 30), ...feet];

// ───────────────── 書き出し ─────────────────
const main = async () => {
	const sheet = new Img(64, 64);
	sheet.blit(othelloBoard(await rpgen("AeSsDg")), 0, 0); // (0,0) リバーシ盤
	paint(sheet, 16, 0, COMMA, COMMA_PAL); // (16,0) 16x32 コンマの 台
	paint(sheet, 32, 0, FUKKIN, FUKKIN_PAL); // (32,0) 腹筋台
	paint(sheet, 48, 0, DESK, DESK_PAL); // (48,0) 文机
	sheet.blit(await rpgen("83nRXJ"), 32, 16); // (32,16) サイコロ
	sheet.blit(await rpgen("sZH68xr"), 48, 16); // (48,16) 筆
	paint(sheet, 0, 32, FUKKIN_DOWN, KO_PAL); // (0,32) 24x24 寝た
	paint(sheet, 24, 32, FUKKIN_UP, KO_PAL); // (24,32) 24x24 起きた

	const kabe = new Img(32, 128);
	const rows = [
		[KABE_BACK, FEET_FRONT],
		[KABE_RIGHT, FEET_SIDE],
		[KABE_FRONT, FEET_FRONT],
		[mirror(KABE_RIGHT), mirror(FEET_SIDE)],
	]; // 後・右・前・左
	rows.forEach(([art, feet], r) => {
		paint(kabe, 0, r * 32, art, KABE_PAL);
		paint(kabe, 16, r * 32, step(art, feet), KABE_PAL);
	});

	mkdirSync(OUT, { recursive: true });
	writeFileSync(join(OUT, "neta.png"), encodePng(sheet));
	writeFileSync(join(OUT, "neta_kabe.png"), encodePng(kabe));
	console.log(
		`wrote ${join(OUT, "neta.png")} (64x64), ${join(OUT, "neta_kabe.png")} (32x128)`,
	);

	if (PREVIEW) {
		const S = 8;
		const pv = new Img((64 + 4 + 32) * S, 128 * S);
		pv.d.fill(200);
		const up = (src, ox) => {
			for (let y = 0; y < src.h; y++)
				for (let x = 0; x < src.w; x++) {
					const c = src.get(x, y);
					if (c[3] === 0) continue;
					for (let yy = 0; yy < S; yy++)
						for (let xx = 0; xx < S; xx++)
							pv.set((ox + x) * S + xx, y * S + yy, c);
				}
		};
		up(sheet, 0);
		up(kabe, 68);
		writeFileSync(PREVIEW, encodePng(pv));
		console.log(`wrote ${PREVIEW}`);
	}
};
await main();
