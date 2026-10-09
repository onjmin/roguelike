// 保守村の 小さな 名物（folk）の 絵を 書き出す（node scripts/make-folk.mjs。ネットに つながる ときに 1回）。
//
// - public/sprites/folk.png（96x16。16x16 が 6マス。data/village/folk.ts の FOLK_ART）
//     0 墓          RPGEN「墓」07DETe3（216: 夜ノ森の館 #70。ダンジョンの 墓の しるしと 同じ 墓石）。
//                   彫られた 十字は 石の 色で 消す（神社の 上の 墓場なので）
//     1 草ボタンの 墓 0 に 緑の 丸い ボタンを 描き足す
//     2 札の 墓      0 に 白い 札を 描き足す（バルス『再開てすと中』・イイ！ボタン『イクナイ』）
//     3 新しい 墓    0 を 白っぽく ぬりかえ、根もとに 花（!okpic）
//     4 メモ        RPGEN「メモ」lPMpiFJ（92: 看板,貼り紙 #40。銭湯の 壁の『温泉卵的な？』）
//     5 供養碑      RPGEN「石碑(小)」k8OiK8J（216: 夜ノ森の館 #85。機能の 墓場の 入口）
// - public/sprites/folk_hira.png（32x64 の 歩行グラ。ひらがなニキ。RPGEN「彡(●)(●)」29aYeF の 黄色い 体を 水色に ぬりかえ。
//     黄色の まま だと 仲間の やきう（sa:4rSOzo）・敵の おんJ民と 見分けが つかない）
// - public/sprites/folk_mofu0.png 〜 folk_mofu7.png（32x64 の 歩行グラ。モフちゃん。町の 段 0〜7 で 少しずつ かわる。手描き）
// - public/sprites/folk_odoru.png（32x64 の 歩行グラ。おどちゃん (の)ヮ(の)。手描き）
//
// 歩行グラは RPGEN の 規格（16x16 が 2コマ × 4方向。行は 上・右・下・左）。止まっていても 足踏みの 2コマが 交互に 出るので、
// 2コマ目は きうりを かじる・体を ゆらす 絵に する。依存なし（zlib だけ）。PNG の 読み書きは make-statue.mjs と 同じ。
// CDN の 無い id は HTTP 200 で 16x16 の「404」画像が 返るので、大きさと 色で はじいて 止まる。

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.FOLK_OUT ?? join(HERE, "../public/sprites");
mkdirSync(OUT, { recursive: true });
const RPGEN = (id) =>
	`https://rpgen-search.pages.dev/data/images/sprites/${id}.png`;
const RPGEN_WALK = (id) =>
	`https://rpgen-search.pages.dev/data/images/sAnims/${id}.png`;

// ───────────────── 最小 PNG（書き: RGBA 8bit。読み: 非インターレースの パレット/灰/RGB/RGBA） ─────────────────

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
			} else if (ctype === 0 || ctype === 4) {
				// 灰色（と 透明度）
				const v = line[x * chans];
				rgba.set([v, v, v, ctype === 4 ? line[x * 2 + 1] : 255], o);
			} else line.copy(rgba, o, x * 4, x * 4 + 4);
		}
	}
	return { w, h, rgba };
};

/** RPGEN の 16x16 の 絵（CDN。無い id は 16x16 の「404」が 返るので 色を 見て はじく）。 */
const fetchSprite = async (id) => {
	const res = await fetch(RPGEN(id));
	if (!res.ok) throw new Error(`${id}: ${res.status}`);
	const img = decodePng(Buffer.from(await res.arrayBuffer()));
	if (img.w !== 16 || img.h !== 16) throw new Error(`${id}: ${img.w}x${img.h}`);
	let bw = 0;
	for (let i = 0; i < 256; i++) {
		const [r, g, b, a] = img.rgba.subarray(i * 4, i * 4 + 4);
		if (
			a === 255 &&
			((r < 20 && g < 20 && b < 20) || (r > 235 && g > 235 && b > 235))
		)
			bw++;
	}
	if (bw === 256) throw new Error(`${id}: the CDN 404 picture`);
	return img.rgba;
};

/** RPGEN の 歩行グラ（32x64。CDN の「404」は 16x16 なので 大きさで はじく）。 */
const fetchWalk = async (id) => {
	const res = await fetch(RPGEN_WALK(id));
	if (!res.ok) throw new Error(`${id}: ${res.status}`);
	const img = decodePng(Buffer.from(await res.arrayBuffer()));
	if (img.w !== 32 || img.h !== 64)
		throw new Error(`${id}: ${img.w}x${img.h} (not a walk sheet)`);
	return img.rgba;
};

/** 色を ぬりかえる（"#rrggbb" → "#rrggbb"。透明は そのまま）。ぬりかえた 点の 数を 返す。 */
const recolor = (rgba, pairs) => {
	const map = new Map(pairs.map(([a, b]) => [a, hex(b)]));
	let n = 0;
	for (let i = 0; i < rgba.length; i += 4) {
		if (!rgba[i + 3]) continue;
		const key = `#${[rgba[i], rgba[i + 1], rgba[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
		const to = map.get(key);
		if (to) {
			rgba.set(to.slice(0, 3), i);
			n++;
		}
	}
	return n;
};

const hex = (s) => [
	Number.parseInt(s.slice(1, 3), 16),
	Number.parseInt(s.slice(3, 5), 16),
	Number.parseInt(s.slice(5, 7), 16),
	255,
];

/** 16x16 の 絵（行の 文字列）を sheet の (cx, cy) マスに 描く（"." は 透明・描かない）。 */
const paint = (sheet, sheetW, cx, cy, art, pal) => {
	if (art.length !== 16) throw new Error(`行の数が 16 でない: ${art.length}`);
	art.forEach((row, y) => {
		if ([...row].length !== 16)
			throw new Error(`行の長さが 16 でない: "${row}"`);
		[...row].forEach((ch, x) => {
			if (ch === ".") return;
			const col = pal[ch];
			if (!col) throw new Error(`色 "${ch}" が 未定義`);
			sheet.set(col, ((cy * 16 + y) * sheetW + cx * 16 + x) * 4);
		});
	});
};
/** 16x16 の RGBA を sheet の (cx, 0) マスへ。 */
const blit = (sheet, sheetW, cx, rgba) => {
	for (let y = 0; y < 16; y++)
		rgba.copy(sheet, (y * sheetW + cx * 16) * 4, y * 64, y * 64 + 64);
};
const mirror = (art) => art.map((r) => [...r].reverse().join(""));
/** 絵の 上に 点を 置く（[x, y, 色の 字] の 並び）。 */
const patch = (art, dots) => {
	const g = art.map((r) => [...r]);
	for (const [x, y, ch] of dots) g[y][x] = ch;
	return g.map((r) => r.join(""));
};

/** 歩行グラ（32x64）。frames = { up: [a, b], right: [a, b], down: [a, b] }、左は 右の 反転。 */
const walkSheet = (file, pal, frames) => {
	const buf = Buffer.alloc(32 * 64 * 4);
	const rows = [frames.up, frames.right, frames.down, frames.right.map(mirror)];
	rows.forEach((pair, row) => {
		paint(buf, 32, 0, row, pair[0], pal);
		paint(buf, 32, 1, row, pair[1], pal);
	});
	writeFileSync(join(OUT, file), encodePng(32, 64, buf));
	console.log("wrote", file);
};

// ───────────────── folk.png（墓場・メモ・供養碑） ─────────────────

{
	const grave = await fetchSprite("07DETe3");
	// 彫られた 十字（(7,6)〜(8,9) の 縦・(6,7)〜(9,7) の 横）を 石の 面の 色 #877887 で 消す
	{
		const FACE = hex("#877887");
		const CROSS = [
			[7, 6],
			[8, 6],
			[6, 7],
			[7, 7],
			[8, 7],
			[9, 7],
			[7, 8],
			[8, 8],
			[7, 9],
			[8, 9],
		];
		for (const [x, y] of CROSS) {
			const o = (y * 16 + x) * 4;
			if (!grave[o + 3]) throw new Error(`07DETe3: (${x},${y}) is not stone`);
			grave.set(FACE, o);
		}
	}
	const memo = await fetchSprite("lPMpiFJ");
	const monument = await fetchSprite("k8OiK8J");
	const W = 96;
	const sheet = Buffer.alloc(W * 16 * 4);
	// 0 墓
	blit(sheet, W, 0, grave);
	// 1 草ボタン（墓石の まんなか下に 緑の 丸い ボタン。まわりに 濃い 縁と 光）
	blit(sheet, W, 1, grave);
	paint(
		sheet,
		W,
		1,
		0,
		[
			"................",
			"................",
			"................",
			"................",
			"................",
			"................",
			"................",
			"......kkkk......",
			".....kGGLGk.....",
			".....kGGGGk.....",
			".....kgGGgk.....",
			"......kkkk......",
			"................",
			"................",
			"................",
			"................",
		],
		{
			k: hex("#24461a"),
			G: hex("#5cb43a"),
			g: hex("#3c8a26"),
			L: hex("#c6f28e"),
		},
	);
	// 2 札（右の 肩に 白い 紙の 札。赤い 2本の 字の あと）
	blit(sheet, W, 2, grave);
	paint(
		sheet,
		W,
		2,
		0,
		[
			"................",
			"................",
			"..........n.....",
			"..........n.....",
			".........pppp...",
			".........pRRp...",
			".........pwwp...",
			".........pRRp...",
			".........pwwp...",
			".........pppp...",
			"................",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
		{
			n: hex("#5a4a3a"),
			p: hex("#b8ad94"),
			w: hex("#f6f1e2"),
			R: hex("#c03a3a"),
		},
	);
	// 3 新しい 墓（白い 石に ぬりかえ、根もとに 赤と 黄の 花）
	{
		const light = Buffer.from(grave);
		const map = new Map(
			[
				["#685c68", "#8c8494"],
				["#c1b4c2", "#f4f0f6"],
				["#a496a4", "#dcd6e0"],
				["#494149", "#6c6672"],
				["#877887", "#bcb4c0"],
				["#786a78", "#a8a0ac"],
			].map(([a, b]) => [a, hex(b)]),
		);
		for (let i = 0; i < 256; i++) {
			const [r, g, b, a] = light.subarray(i * 4, i * 4 + 4);
			if (!a) continue;
			const key = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
			const to = map.get(key);
			if (to) light.set(to, i * 4);
		}
		blit(sheet, W, 3, light);
		paint(
			sheet,
			W,
			3,
			0,
			[
				"................",
				"................",
				"................",
				"................",
				"................",
				"................",
				"................",
				"................",
				"................",
				"................",
				"................",
				".r............y.",
				"rYr..........yRy",
				".g............g.",
				".gg..........gg.",
				"................",
			],
			{
				r: hex("#d8344a"),
				Y: hex("#ffe070"),
				y: hex("#ffd84a"),
				R: hex("#e04848"),
				g: hex("#3c8a26"),
			},
		);
	}
	// 4 メモ・5 供養碑
	blit(sheet, W, 4, memo);
	blit(sheet, W, 5, monument);
	writeFileSync(join(OUT, "folk.png"), encodePng(W, 16, sheet));
	console.log("wrote folk.png");
}

// ───────────────── ひらがなニキ（RPGEN 29aYeF を 水色に） ─────────────────

{
	const sheet = await fetchWalk("29aYeF");
	const n = recolor(sheet, [
		["#ffce33", "#9fdcf6"],
		["#e1ac05", "#62aad6"],
		["#857d38", "#3f6f8f"],
	]);
	if (n < 300)
		throw new Error(`29aYeF: only ${n} yellow pixels (the sheet changed?)`);
	writeFileSync(join(OUT, "folk_hira.png"), encodePng(32, 64, sheet));
	console.log("wrote folk_hira.png");
}

// ───────────────── モフちゃん（段ごとに 少しずつ かわる） ─────────────────
// 板トップの ドット絵の 生き物（おんJwiki pages/245 の mohu.v1/v2.gif）の 特徴で 描いた：まっしろな 体・先が 玉の 触角・
// 閉じた 目・寝そべった 芋虫の 体と 足・右下へ 突き出た 大きな きうり。口は 元の 形に せず 赤い 口に した。
// いつも こちらを 向いている 生き物なので 4方向とも 正面（左は 右の 反転で きうりが 左に 出る）。
// 2コマ目は もぐもぐ（口が とじて きうりが 1マス 短く なり、足が ずれる）。

const MOFU_PAL = {
	K: hex("#1c1c1c"),
	W: hex("#ffffff"),
	w: hex("#d8dce0"),
	M: hex("#d8606c"),
	m: hex("#8a3a44"),
	G: hex("#22a022"),
	g: hex("#156a15"),
	L: hex("#8ee08e"),
	P: hex("#ffb0b8"),
	Y: hex("#ffd84a"),
	R: hex("#d8344a"),
};
const MOFU_A = [
	".KK..........KK.",
	"KWWK........KWWK",
	"KWWK.KKKKKK.KWWK",
	".KK.KWWWWWWK.KK.",
	"...KWWWWWWWWK...",
	"..KWWWWWWWWWWK..",
	"..KWWKWWWWKWWK..",
	"..KWKWKWWKWKWK..",
	"..KWWWWWWWWWWK..",
	"..KWWWWMMWWWWK..",
	"..KWWWMmmMWWWK..",
	"..KwWWWMMKKKKKK.",
	"..KwWWWWKGGGGLLK",
	".KwWWWWWKgGGGGGK",
	"KwWWWWWWWKKKKKK.",
	".KWKWKWKWK......",
];
/** もぐもぐ（口が とじ、きうりが 1マス 短い。足が ずれる）。 */
const MOFU_B = [
	".KK..........KK.",
	"KWWK........KWWK",
	"KWWK.KKKKKK.KWWK",
	".KK.KWWWWWWK.KK.",
	"...KWWWWWWWWK...",
	"..KWWWWWWWWWWK..",
	"..KWWKWWWWKWWK..",
	"..KWKWKWWKWKWK..",
	"..KWWWWWWWWWWK..",
	"..KWWWWWWWWWWK..",
	"..KWWWWmmWWWWK..",
	"..KwWWWWWKKKKK..",
	"..KwWWWWKGGGLLK.",
	".KwWWWWWKgGGGGK.",
	"KwWWWWWWWKKKKK..",
	"..KWKWKWKWK.....",
];
/** 段ごとの 足し算（前の 段の ものは 残る。どの コマにも のせる）。 */
const MOFU_STAGE = [
	// 0 そのまま
	[],
	// 1 ほっぺが ピンク
	[
		[3, 8, "P"],
		[12, 8, "P"],
	],
	// 2 頭に 葉っぱ
	[
		[7, 1, "G"],
		[8, 1, "g"],
	],
	// 3 すこし 太る（おなかの 左が 1マス ふくらむ）
	[
		[0, 13, "K"],
		[1, 13, "w"],
	],
	// 4 きうりの いぼ
	[[11, 12, "L"]],
	// 5 左の 触角に 黄色い 実
	[[1, 1, "Y"]],
	// 6 右の 触角にも 黄色い 実
	[[14, 1, "Y"]],
	// 7 葉っぱに 赤い 実（さくらんぼの ような）
	[
		[6, 1, "R"],
		[7, 0, "g"],
	],
];
for (let st = 0; st < 8; st++) {
	const dots = MOFU_STAGE.slice(0, st + 1).flat();
	const a = patch(MOFU_A, dots);
	const b = patch(MOFU_B, dots);
	walkSheet(`folk_mofu${st}.png`, MOFU_PAL, {
		up: [a, b],
		right: [a, b],
		down: [a, b],
	});
}

// ───────────────── おどちゃん（(の)ヮ(の)。夜に 踊る 宝石） ─────────────────
// おんJwiki pages/25 の AA の 特徴だけ：宝石の 体（上の 先が くるりと まがる）・の の字の 目・ヮ の口・(^)(^) の 足・
// まわりの 星。1コマ目と 2コマ目で 体を 左右に かたむけ、星の 位置を かえる。

const ODORU_PAL = {
	K: hex("#17403a"),
	G: hex("#3ccfae"),
	g: hex("#1f8f7c"),
	H: hex("#d2fff2"),
	E: hex("#10302b"),
	M: hex("#7a1f3a"),
	m: hex("#e86a8a"),
	F: hex("#3a2a1a"),
	S: hex("#fff3a0"),
};
const ODORU_A = [
	".S..............",
	"......KK......S.",
	".....KHK........",
	"....KHGK........",
	"...KHGGGKK......",
	"..KHGGGGGGK.....",
	".KHGEEGGEEGK....",
	".KGEgEGGEgEK....",
	".KGGEEGGEEGK....",
	".KgGGGMMMGGK....",
	".KgGGGMmMGgK....",
	"..KgGGGGGgK.....",
	"...KgGGGgK......",
	"....KKKKK.......",
	"....F...F.......",
	"...FF...FF......",
];
const shiftRight = (art, n) =>
	art.map((r) => ".".repeat(n) + r.slice(0, 16 - n));
const ODORU_B = patch(
	shiftRight(ODORU_A.slice(0, 14), 2).concat([
		"......F...F.....",
		".......FF..FF...",
	]),
	[
		[1, 0, "."],
		[14, 1, "."],
		[15, 0, "S"],
		[0, 3, "S"],
	],
);
const ODORU_UP = ODORU_A.map((r, y) =>
	y >= 6 && y <= 10 ? r.replace(/[EMm]/g, (c) => (c === "E" ? "G" : "g")) : r,
);
const ODORU_UP_B = ODORU_B.map((r, y) =>
	y >= 6 && y <= 10 ? r.replace(/[EMm]/g, (c) => (c === "E" ? "G" : "g")) : r,
);
walkSheet("folk_odoru.png", ODORU_PAL, {
	up: [ODORU_UP, ODORU_UP_B],
	right: [ODORU_A, ODORU_B],
	down: [ODORU_A, ODORU_B],
});
