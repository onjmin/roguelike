// ホシュクラ（保守村の 南西の 島）の 絵を 書き出す（node scripts/make-saba.mjs [--cache <dir>] [--out <dir>] [--ts <file>]）。
//
// - public/sprites/saba.png        … 島の マス・部屋の 物・ブラマイの 板の 絵（16x16 の 格子。256x64）
// - public/sprites/saba_takumi.png … 匠の 歩行グラ（32x64・16x16 が 2コマ×4方向。RPGEN 歩行グラ規格。手描き）
// - src/data/sabaSheet.ts          … どの 絵が saba.png の どこに あるか（この スクリプトが 書く。手で 直さない）
//
// RPGEN の 部品は 作る ときに CDN から 取る（ゲームは CDN を 見ない）。セットの 番号は「セット: 番号」
// （145 minecraft 鉱石セット・146 バニラ 非色つきブロック・147 色つきブロック・94 階段/はしご/線路）。
// 使う 物だけ 取る（使わない ブロックは 積まない）。
// 手描きの 物（看板・縦穴・柵・麦・チェスト・投票箱・つるはし・表札・立て札・水・初期スポの 看板・匠）は 下の 字の 絵。
// 匠は 緑の 四角い からだに 白い 鉢巻、顔は 細い 目と 一文字の 口（どこかで 見た 緑の あいつの 顔には しない）。
// 依存なし（zlib だけ）。PNG の 読み書きは make-statue.mjs と 同じ。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const argOf = (k) => {
	const i = process.argv.indexOf(k);
	return i >= 0 ? process.argv[i + 1] : null;
};
const OUT = argOf("--out") ?? join(HERE, "../public/sprites");
const TS_OUT = argOf("--ts") ?? join(HERE, "../src/data/sabaSheet.ts");
const CACHE = argOf("--cache");
const CDN = "https://rpgen-search.pages.dev/data/images";

// ───────────────── 最小 PNG ─────────────────
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
	const chans = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
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
			cur[i] = (src[i] + [0, a, b, (a + b) >> 1, paeth(a, b, c)][f]) & 255;
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
			} else if (ctype === 0) {
				rgba.fill(line[x], o, o + 3);
				rgba[o + 3] = 255;
			} else if (ctype === 4) {
				rgba.fill(line[x * 2], o, o + 3);
				rgba[o + 3] = line[x * 2 + 1];
			} else line.copy(rgba, o, x * 4, x * 4 + 4);
		}
	}
	return { w, h, rgba };
};

// ───────────────── 取る ─────────────────
const get = async (kind, id) => {
	const file = CACHE ? join(CACHE, `${kind}-${id}.png`) : null;
	if (file && existsSync(file)) return decodePng(readFileSync(file));
	const res = await fetch(`${CDN}/${kind}/${id}.png`);
	if (!res.ok) throw new Error(`${kind}/${id}: ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	if (file) {
		mkdirSync(CACHE, { recursive: true });
		writeFileSync(file, buf);
	}
	const img = decodePng(buf);
	// CDN は 無い id にも 200 で 16x16 の「404」の 絵を 返す（白黒だけ）
	const bw = [...Array(img.w * img.h).keys()].every((i) => {
		const [r, g, b, a] = img.rgba.subarray(i * 4, i * 4 + 4);
		return (
			a === 255 &&
			((r < 20 && g < 20 && b < 20) || (r > 235 && g > 235 && b > 235))
		);
	});
	if (bw) throw new Error(`${kind}/${id}: 404 の 絵`);
	return img;
};

// ───────────────── シート ─────────────────
const SW = 256;
const SH = 64;
const sheet = Buffer.alloc(SW * SH * 4);
const CELLS = {};
const blit = (img, sx, sy, dx, dy, w = 16, h = 16) => {
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const i = ((sy + y) * img.w + sx + x) * 4;
			const o = ((dy + y) * SW + dx + x) * 4;
			const a = img.rgba[i + 3];
			if (!a) continue;
			if (a === 255 || !sheet[o + 3]) img.rgba.copy(sheet, o, i, i + 4);
			else {
				// 半透明は 下に 重ねる
				const t = a / 255;
				for (let c = 0; c < 3; c++)
					sheet[o + c] = Math.round(
						img.rgba[i + c] * t + sheet[o + c] * (1 - t),
					);
				sheet[o + 3] = 255;
			}
		}
};
const put = async (name, col, row, id) => {
	const img = await get("sprites", id);
	if (img.w !== 16 || img.h !== 16)
		throw new Error(`${name} ${id}: ${img.w}x${img.h}`);
	blit(img, 0, 0, col * 16, row * 16);
	CELLS[name] = [col, row];
};

// 行 0：地面と ブロック・明かり（島の マス）
const ROW0 = [
	["grassTop", "H30qVjx"], // 146: 26 草ブロック表
	["grassSide", "3OadWWH"], // 146: 25 草ブロック（島の 崖・でっぱり）
	["dirt", "amxntEH"], // 146: 9（豚レース場の 走路）
	["stone", "Us8wLQr"], // 146: 15（ブラマイの 石）
	["cobble", "DEh9PWw"], // 146: 6
	["pathTop", "EGLlhP6"], // 146: 71 草の道 表（島の 通り）
	["planks", "ndOUqol"], // 146: 61 オークの木材（橋・床）
	["logTop", "VWTyXkx"], // 146: 38 原木の 年輪（切り株）
	["white", "SDP5IfA"], // 147: 15 白い コンクリート（豆腐）
	["glass", "8bZkRbP"], // 147: 34 ガラス
	["stoneBrick", "Ttre1Y9"], // 146: 67
	["farmland", "gq3QHfL"], // 146: 14 耕地（湿）
	["bedrock", "SDPlIjM"], // 146: 0 岩盤（ブラマイの 底）
	["darkPlanks", "TtrR1y0"], // 146: 66（アパートの 屋根）
	["jack", "YFLGEH0"], // 146: 73 ジャック・オ・ランタン（湧き潰し）
	["lampOn", "95V3Fdx"], // 146: 107（謎の 装置）
];
// 行 1：装置・部屋の 物・ブラマイの 鉱石（列 15 は ドアの 上。真下の 行 2 列 15 が ドアの 下 = 16x32 で 切れる）
const ROW1 = [
	["ironBlock", "l29Hifd"], // 145: 43（謎の 装置）
	["spawner", "ou94lqe"], // 146: 95（トラップタワーの 上）
	["craftTop", "SDP0IyR"], // 146: 8 作業台
	["furnaceLit", "XnX8bC"], // 使用中かまど
	["torch", "HMykVDk"], // 松明
	["ladder", "q1oV3fN"], // 94: 130 はしご
	["bed", "p61gkyU"], // ベッド
	["jukebox", "OIzjJHY"], // 146: 108
	["lava", "AX8LsvC"], // 溶岩
	["coalOre", "pReHkG"], // 145: 19
	["diamondOre", "hUUiBat"], // 145: 22
	["diamond", "K66N5YM"], // 145: 3（板の 札）
	["crack", "CiECSzG"], // 146: 127 ひび（鉱石を 1回 たたいた）
];

for (const [i, [n, id]] of ROW0.entries()) await put(n, i, 0, id);
for (const [i, [n, id]] of ROW1.entries()) await put(n, i, 1, id);
await put("doorTop", 15, 1, "vNwNmym"); // 146: 96 オークの ドア（上）
await put("doorBottom", 15, 2, "X0yWbRE"); // 146: 116 オークの ドア（下）

// ───────────────── 手描き（行 2） ─────────────────
const hex = (s) => {
	const v = Number.parseInt(s.slice(1, 7), 16);
	return [
		v >> 16,
		(v >> 8) & 255,
		v & 255,
		s.length > 7 ? Number.parseInt(s.slice(7, 9), 16) : 255,
	];
};
const art = (rows, pal) => {
	if (rows.length !== 16) throw new Error(`行の数 ${rows.length}`);
	const rgba = Buffer.alloc(16 * 16 * 4);
	rows.forEach((r, y) => {
		if ([...r].length !== 16) throw new Error(`行の長さ "${r}"`);
		[...r].forEach((ch, x) => {
			if (ch === ".") return;
			const c = pal[ch];
			if (!c) throw new Error(`色 ${ch}`);
			rgba.set(hex(c), (y * 16 + x) * 4);
		});
	});
	return { w: 16, h: 16, rgba };
};
const draw = (name, col, row, img) => {
	blit(img, 0, 0, col * 16, row * 16);
	CELLS[name] = [col, row];
};
const WOOD = {
	K: "#3b2a17",
	P: "#c0905a",
	p: "#9c7340",
	d: "#5a4024",
	k: "#6b4a26",
	S: "#00000040",
	W: "#f4f0e2",
	w: "#d8d0bc",
};

// 看板（>>1。板に 字の 線）
draw(
	"sign",
	0,
	2,
	art(
		[
			"................",
			"..KKKKKKKKKKKK..",
			"..KPPPPPPPPPPK..",
			"..KPddddddddPK..",
			"..KPppppppppPK..",
			"..KPddddddPPPK..",
			"..KPppppppppPK..",
			"..KKKKKKKKKKKK..",
			".......Kk.......",
			".......Kk.......",
			".......Kk.......",
			".......Kk.......",
			".......Kk.......",
			".......Kk.......",
			"......SKkS......",
			"................",
		],
		WOOD,
	),
);
// 穴（ブラマイ場の 縦穴。丸石の 上に 重ね、はしごを その 上に）
draw(
	"hole",
	1,
	2,
	art(
		[
			"................",
			".HHHHHHHHHHHHHH.",
			".HhhhhhhhhhhhhH.",
			".HhhhhhhhhhhhhH.",
			".HDDDDDDDDDDDDH.",
			".HDDDDDDDDDDDDH.",
			".HDDDDDDDDDDDDH.",
			".HDDDDDDDDDDDDH.",
			".HDDDDDDDDDDDDH.",
			".HDDDDDDDDDDDDH.",
			".HDDDDDDDDDDDDH.",
			".HDDDDDDDDDDDDH.",
			".HDDDDDDDDDDDDH.",
			".HDDDDDDDDDDDDH.",
			".HHHHHHHHHHHHHH.",
			"................",
		],
		{ H: "#2a241e", h: "#5a5048", D: "#0c0a09" },
	),
);
// 柵（オークの 柵。横に つづく）
draw(
	"fence",
	2,
	2,
	art(
		[
			"................",
			"................",
			"................",
			"...KK......KK...",
			"..KPpK....KPpK..",
			"KKKPpKKKKKKPpKKK",
			"PPPPpPPPPPPPpPPP",
			"pppPpppppppPpppp",
			"KKKPpKKKKKKPpKKK",
			"KKKPpKKKKKKPpKKK",
			"PPPPpPPPPPPPpPPP",
			"pppPpppppppPpppp",
			"KKKPpKKKKKKPpKKK",
			"..KPpK....KPpK..",
			"..SKKS....SKKS..",
			"................",
		],
		WOOD,
	),
);
// 麦（耕地に 重ねる）
draw(
	"wheat",
	3,
	2,
	art(
		[
			"................",
			"..y...y...y...y.",
			".yYy.yYy.yYy.yYy",
			"..Y...Y...Y...Y.",
			".yYy.yYy.yYy.yYy",
			"..Y...Y...Y...Y.",
			"..g...g...g...g.",
			"..g.y.g.y.g.y.g.",
			"...yYy..yYy..yYy",
			"....Y...Y...Y...",
			"...yYy.yYy.yYy..",
			"....Y...Y...Y...",
			"....g...g...g...",
			"....g...g...g...",
			"................",
			"................",
		],
		{ Y: "#d8b440", y: "#f0d870", g: "#6f8f2a" },
	),
);
// チェスト
draw(
	"chest",
	4,
	2,
	art(
		[
			"................",
			"................",
			".KKKKKKKKKKKKKK.",
			".KLLLLLLLLLLLLK.",
			".KLllllllllllLK.",
			".KLllllllllllLK.",
			".KKKKKKggKKKKKK.",
			".KBBBBBgGgBBBBK.",
			".KBbbbbbbbbbbBK.",
			".KBbbbbbbbbbbBK.",
			".KBbbbbbbbbbbBK.",
			".KBBBBBBBBBBBBK.",
			".KKKKKKKKKKKKKK.",
			"..SSSSSSSSSSSS..",
			"................",
			"................",
		],
		{
			K: "#2e1e0c",
			L: "#b07a3c",
			l: "#946230",
			B: "#a06c34",
			b: "#82562a",
			g: "#5c5c5c",
			G: "#c8c8c8",
			S: "#00000040",
		},
	),
);
// 投票箱（白い 紙が 1枚 はみ出す）
draw(
	"ballot",
	5,
	2,
	art(
		[
			"................",
			"......WWWW......",
			"......WwwW......",
			"..KKKKWwwWKKKK..",
			"..KLLLLddLLLLK..",
			"..KLLLLLLLLLLK..",
			"..KBBBBBBBBBBK..",
			"..KBbbbbbbbbBK..",
			"..KBbWWWWWWbBK..",
			"..KBbWddddWbBK..",
			"..KBbWWWWWWbBK..",
			"..KBbbbbbbbbBK..",
			"..KBBBBBBBBBBK..",
			"..KKKKKKKKKKKK..",
			"...SSSSSSSSSS...",
			"................",
		],
		{
			K: "#2e1e0c",
			L: "#c89a5c",
			B: "#a06c34",
			b: "#82562a",
			d: "#1a1208",
			W: "#f6f4ec",
			w: "#c8c4b4",
			S: "#00000040",
		},
	),
);
// つるはし（板の 上の 札）
draw(
	"pickaxe",
	6,
	2,
	art(
		[
			"................",
			"....GGGGG.......",
			"..GGgggggGG.....",
			".Gg.....KgGG....",
			"G......K..gG....",
			"......K....G....",
			".....K.....G....",
			"....K...........",
			"...K............",
			"..K.............",
			".K..............",
			"K...............",
			"................",
			"................",
			"................",
			"................",
		].map((r) => r.replace(/K/g, "W")),
		{ G: "#9a9a96", g: "#6c6c68", W: "#8a5a2c" },
	),
);
// 表札（壁に 小さな 白い 札）
draw(
	"plate",
	7,
	2,
	art(
		[
			"................",
			"................",
			"................",
			"................",
			"................",
			"................",
			"....KKKKKKKK....",
			"....KWWWWWWK....",
			"....KWddddWK....",
			"....KWWWWWWK....",
			"....KKKKKKKK....",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
		{ K: "#3a3a36", W: "#f4f2ea", d: "#2a2a2a" },
	),
);
// 立て札（白い 紙の 板）
draw(
	"post",
	8,
	2,
	art(
		[
			"................",
			"................",
			"....KKKKKKKK....",
			"....KWWWWWWK....",
			"....KWddddWK....",
			"....KWWWWWWK....",
			"....KWdddWWK....",
			"....KWWWWWWK....",
			"....KKKKKKKK....",
			".......Kk.......",
			".......Kk.......",
			".......Kk.......",
			".......Kk.......",
			".......Kk.......",
			"......SKkS......",
			"................",
		],
		WOOD,
	),
);
// 水（ウーパールーパーの 水槽。ガラスを 上に 重ねる。海より 明るい）
draw(
	"water",
	9,
	2,
	art(
		[
			"BBBBBBBBBBBBBBBB",
			"BBBLLBBBBBBBBBBB",
			"BBLWWLBBBBBBBBBB",
			"BBBBBBBBBBBBLLBB",
			"BBBBBBBBBBBLWWLB",
			"BBBBBBbBBBBBBBBB",
			"BBBBBbbbBBBBBBBB",
			"BBBBBBBBBBBBBBBB",
			"BLLBBBBBBBBBBBBB",
			"LWWLBBBBBBBLLBBB",
			"BBBBBBBBBBLWWLBB",
			"BBBBBBBBBBBBBBBB",
			"BBBBBBBbBBBBBBBB",
			"BBBBBBbbbBBBBLLB",
			"BBBBBBBBBBBBLWWL",
			"BBBBBBBBBBBBBBBB",
		],
		{ B: "#4a9ad0", b: "#3a7ab8", L: "#7ab8e8", W: "#d0ecfc" },
	),
);
// 初期スポの 看板（2本 足の 横長の 板。命名投票で 決まった 名前）
draw(
	"townSign",
	10,
	2,
	art(
		[
			"................",
			"................",
			".KKKKKKKKKKKKKK.",
			".KPPPPPPPPPPPPK.",
			".KPdPdddPddPdPK.",
			".KPPPPPPPPPPPPK.",
			".KPddPdPdddPPPK.",
			".KppppppppppppK.",
			".KKKKKKKKKKKKKK.",
			"...Kk......Kk...",
			"...Kk......Kk...",
			"...Kk......Kk...",
			"...Kk......Kk...",
			"...Kk......Kk...",
			"..SKkS....SKkS..",
			"................",
		],
		WOOD,
	),
);

// ───────────────── 匠（手描きの 歩行グラ） ─────────────────
// 緑の まだらの 四角い からだに 白い 鉢巻（匠＝職人）。顔は 細い 縦の 目 2つと 一文字の 口（むっつり）。足は 4本の 短い 足。
const TAKUMI_PAL = {
	K: "#1e3318",
	G: "#62b84a",
	g: "#3e8a30",
	L: "#93d870",
	W: "#f2f2ea",
	w: "#c4c4b8",
	E: "#101010",
};
const T_DOWN = [
	"...KKKKKKKKKK...",
	"..KGLGGgGGLGgK..",
	"..KWWWWWWWWWWK..",
	"..KwwwwwwwwwwK..",
	"..KGgGGGGLGGgK..",
	"..KgGEGGLGEGgK..",
	"..KGGEGgGGEGGK..",
	"..KGLGGGGGGgGK..",
	"..KGGgEEEEGGLK..",
	"...KGGGGgGGGK...",
	"....KKGLGGKK....",
	".....KGgGGK.....",
	".....KGGgLK.....",
	".....KgGGGK.....",
];
const T_UP = [
	"...KKKKKKKKKK...",
	"..KGLGGgGGLGgK..",
	"..KWWWWWWWWWWK..",
	"..KwwwwWWwwwwK..",
	"..KGGgGWWGgGGK..",
	"..KgGGLWwGGLgK..",
	"..KGGgGGGGgGGK..",
	"..KGLGGgGGGgGK..",
	"..KGGgGGLGGGLK..",
	"...KGGGGgGGGK...",
	"....KKGLGGKK....",
	".....KGgGGK.....",
	".....KGGgLK.....",
	".....KgGGGK.....",
];
const T_RIGHT = [
	"....KKKKKKKKK...",
	"...KGLGGgGGLGK..",
	"WW.KWWWWWWWWWK..",
	".WWKwwwwwwwwwK..",
	"...KGgGGGGGGGK..",
	"...KgGGLGGGEgK..",
	"...KGGGGGgGEGK..",
	"...KGLGgGGGGGK..",
	"...KGGgGGGEEEK..",
	"....KGGGgGGGK...",
	".....KKGLGKK....",
	"......KGgGK.....",
	"......KGGgK.....",
	"......KgGGK.....",
];
const FEET = ["....KGK..KGK....", "....KKK..KKK...."];
const FEET_B = ["...KGK....KGK...", "...KKK....KKK..."];
const FEET_R = [".....KGK.KGK....", ".....KKK.KKK...."];
const FEET_RB = ["....KGK...KGK...", "....KKK...KKK..."];
const mirror = (rows) => rows.map((r) => [...r].reverse().join(""));
{
	const W = 32;
	const H = 64;
	const buf = Buffer.alloc(W * H * 4);
	const frames = [
		[T_UP, FEET, FEET_B],
		[T_RIGHT, FEET_R, FEET_RB],
		[T_DOWN, FEET, FEET_B],
		[mirror(T_RIGHT), mirror(FEET_R), mirror(FEET_RB)],
	];
	frames.forEach(([body, f1, f2], row) => {
		for (const [col, feet] of [
			[0, f1],
			[1, f2],
		]) {
			const img = art([...body, ...feet], TAKUMI_PAL);
			for (let y = 0; y < 16; y++)
				img.rgba.copy(
					buf,
					((row * 16 + y) * W + col * 16) * 4,
					y * 64,
					y * 64 + 64,
				);
		}
	});
	mkdirSync(OUT, { recursive: true });
	writeFileSync(join(OUT, "saba_takumi.png"), encodePng(W, H, buf));
	// 板の 匠（前向き）と 光る 匠（導火線）
	draw("takumi", 11, 2, art([...T_DOWN, ...FEET], TAKUMI_PAL));
	const flash = Object.fromEntries(
		Object.entries(TAKUMI_PAL).map(([k, v]) => [k, k === "E" ? v : "#f8f8f0"]),
	);
	draw(
		"takumiFlash",
		12,
		2,
		art([...T_DOWN, ...FEET], { ...flash, K: "#c8c8c0" }),
	);
}

// ───────────────── 板の キリコ（sa:vHsmy5 の 8コマ。上・右・下・左 × 足踏み） ─────────────────
{
	const k = await get("sAnims", "vHsmy5");
	const DIRS = ["Up", "Right", "Down", "Left"];
	for (let r = 0; r < 4; r++)
		for (let f = 0; f < 2; f++) {
			blit(k, f * 16, r * 16, (r * 2 + f) * 16, 3 * 16);
			CELLS[`kiriko${DIRS[r]}${f}`] = [r * 2 + f, 3];
		}
}

writeFileSync(join(OUT, "saba.png"), encodePng(SW, SH, sheet));

// ───────────────── 表（src/data/sabaSheet.ts） ─────────────────
const names = Object.keys(CELLS);
const ts = `// ホシュクラ（保守村の 島）の 絵（public/sprites/saba.png）の どこに 何が あるか。scripts/make-saba.mjs が 書く（手で 直さない）。
// マスは 16x16 の [列, 行]。sb(name) は 1マス、sb(name, 2) は 下の マスまで（16x32。ドア）。

export const SABA_IMG = "pub:sprites/saba.png";
export const SABA_SIZE = [${SW}, ${SH}] as const;
/** 匠の 歩行グラ（手描き。32x64）。 */
export const TAKUMI_WALK = "pub:sprites/saba_takumi.png";

export const SABA_CELLS = {
${names.map((n) => `\t${n}: [${CELLS[n][0]}, ${CELLS[n][1]}],`).join("\n")}
} as const;

export type SabaCell = keyof typeof SABA_CELLS;

/** 絵の 参照（pub:…#x,y,16,16。h=2 で 16x32）。 */
export const sb = (name: SabaCell, h: 1 | 2 = 1): string => {
	const [c, r] = SABA_CELLS[name];
	return \`\${SABA_IMG}#\${c * 16},\${r * 16},16,\${h * 16}\`;
};
`;
mkdirSync(dirname(TS_OUT), { recursive: true });
writeFileSync(TS_OUT, ts);
console.log(
	`wrote saba.png (${SW}x${SH}, ${names.length} cells), saba_takumi.png, ${TS_OUT}`,
);
