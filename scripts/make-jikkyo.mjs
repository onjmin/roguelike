// ナイター実況の 絵を 1枚に まとめて 書き出す（node scripts/make-jikkyo.mjs）。
//
//   public/sprites/jikkyo.png … 本館の 実況モニターの TV（240x352）
//   src/data/jikkyoSheet.ts   … どの 絵が シートの どこに あるか（JK_SPR。この スクリプトが 書く。手で 直さない）
//
// 枠（左上・大きさ・コマ数。コマは 右へ 並ぶ）:
//   (0,0)   240x135 bg.pitch  センターカメラ（夜空と 照明塔・バックネット裏の スタンド・字の ない 広告の フェンス・本塁の 土・打席・芝・マウンド）
//   (0,135) 240x135 bg.field  俯瞰（外野スタンド・フェンス・刈り目の 芝・内野の 土・塁・ファウルライン・マウンド）
//   (0,270)  16x24 ×3 投手の うしろ姿（セット・足を 上げる・投げ終わり）
//   (48,270) 12x18 ×2 打者（右打者の かまえ・ふり終わり。左打者は 反転して 使う）   (72,270) 12x10 捕手
//   (84,270)  6x9 ×2 野手（立ち・走り）   (96,270) 6x9 ×2 走者
//   (108,270) 24x32 札用の 投手の 上半身   (132,270) 24x32 打者の 上半身（ヘルメットと 肩の バット）
//   (156,270) 24x32 ×2 歓喜の 選手（両手・こぶし）   (204,270) 12x8 帽子の 札   (216,270) 12x8 ヘルメットの 札   (228,270) 12x14 球審
//   (0,302)  5x7 ×10 白の 数字   (50,302) 5x7 ×10 黄の 数字
//   (100,302) 5x5 アウトの ランプ（点灯）  (105,302) 消灯  (110,302) 11x5「OUT」  (121,302) 4x4 塁（空き） (125,302) 塁（走者）
//   (129,302) 5x4 ▲  (134,302) 5x4 ▼  (139,302) 球 2x2  (141,302) 3x3  (144,302) 4x4  (148,302) 影 4x2
//   (152,302) 20x7 LIVE   (172,302) 6x6 ベゼルの つや角   (178,302) 9x8 スピーカー（ラジオ版用）
//   (188,302) 3x6 ×3 風船   (198,302) 8x8 ×2 花火
//   (0,312) 64x36 CM の 札（字の ない カラーバー）   (64,312) 16x8 ×2 観客（座る・手を ふる）   (96,312) 32x16 外野スタンドの 席の 列
// 差しかえ色（実行時に 球団の 色へ）：胴 #ff00ff・帽子 #00ffff・ベルトと 袖 #ffff00・ズボン #00ff00。
// ロゴ・字・背番号は 描かない（実在の 球団・選手の 絵に しない）。
//
// 依存なし（zlib だけ）。PNG の 書き方は make-street.mjs と 同じ。乱数は 種つきの LCG なので 何度 書いても 同じ 絵。

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../public/sprites/jikkyo.png");
const SHEET_TS = join(HERE, "../src/data/jikkyoSheet.ts");

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

// ───────────────── 描く 道具 ─────────────────
const W = 240;
const H = 352;
const rgba = Buffer.alloc(W * H * 4);
let seed = 7;
const rnd = () => {
	seed = (seed * 1103515245 + 12345) & 0x7fffffff;
	return seed / 0x7fffffff;
};
const hex = (h, a = 255) => [
	Number.parseInt(h.slice(1, 3), 16),
	Number.parseInt(h.slice(3, 5), 16),
	Number.parseInt(h.slice(5, 7), 16),
	a,
];
const set = (x, y, [r, g, b, a = 255]) => {
	if (x < 0 || y < 0 || x >= W || y >= H) return;
	const i = (y * W + x) * 4;
	rgba[i] = r;
	rgba[i + 1] = g;
	rgba[i + 2] = b;
	rgba[i + 3] = a;
};
const rect = (x, y, w, h, c) => {
	for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c);
};
/** 塗りの 楕円（中心 cx,cy・半径 rx,ry）。clip は 描いて よい 箱。 */
const ellipse = (cx, cy, rx, ry, c, clip) => {
	for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
		for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
			const dx = (x + 0.5 - cx) / rx;
			const dy = (y + 0.5 - cy) / ry;
			if (dx * dx + dy * dy > 1) continue;
			if (clip && (x < clip[0] || y < clip[1] || x >= clip[2] || y >= clip[3])) continue;
			set(x, y, c);
		}
};
/** 塗りの 多角形（点の 中で 判定）。 */
const poly = (pts, c) => {
	const xs = pts.map((p) => p[0]);
	const ys = pts.map((p) => p[1]);
	for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
		for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
			const px = x + 0.5;
			const py = y + 0.5;
			let inside = false;
			for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
				const [xi, yi] = pts[i];
				const [xj, yj] = pts[j];
				if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
			}
			if (inside) set(x, y, c);
		}
};
const line = (x0, y0, x1, y1, c) => {
	const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
	for (let k = 0; k <= n; k++)
		set(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), c);
};

// 色
const C = {
	ink: hex("#0a0a10"),
	skin: hex("#e8b890"),
	skinD: hex("#c8906a"),
	hair: hex("#1a1410"),
	glove: hex("#8a5a2a"),
	bat: hex("#d8b070"),
	shoe: hex("#1a1a1a"),
	navy: hex("#1a2030"),
	gray: hex("#6a6e78"),
	dirt: hex("#c9a36a"),
	dirtD: hex("#b58f58"),
	grass: hex("#2f6e35"),
	grass2: hex("#357a3b"),
	grass3: hex("#3a7d40"),
	night: hex("#10241a"),
	light: hex("#fff6c0"),
	white: hex("#e8e8e8"),
	pure: hex("#ffffff"),
	red: hex("#d8202a"),
	yellow: hex("#ffe060"),
	body: hex("#ff00ff"),
	cap: hex("#00ffff"),
	trim: hex("#ffff00"),
	pants: hex("#00ff00"),
};

/** 字の 絵（1字 1マス）。 */
const PAL = {
	o: C.ink,
	s: C.skin,
	S: C.skinD,
	h: C.hair,
	B: C.body,
	C: C.cap,
	T: C.trim,
	P: C.pants,
	g: C.glove,
	b: C.bat,
	k: C.shoe,
	n: C.navy,
	G: C.gray,
	w: C.white,
	W: C.pure,
	r: C.red,
	y: C.yellow,
};
const art = (x0, y0, rows, pal = PAL) => {
	rows.forEach((row, y) => {
		[...row].forEach((ch, x) => {
			const c = pal[ch];
			if (c) set(x0 + x, y0 + y, c);
		});
	});
};

const SPR = {};
const frame = (name, x, y, w, h, n = 1) => {
	SPR[name] = { x, y, w, h, n };
};

// ───────────────── (0,0) センターカメラ ─────────────────
const pitchBg = () => {
	const X = 0;
	const Y = 0;
	// 夜空（上ほど 暗い）
	for (let y = 0; y < 10; y++) rect(X, Y + y, 240, 1, hex(y < 4 ? "#08140f" : "#0c1d15"));
	// 照明塔（4本。3x2 の 光と 細い 柱）
	for (const tx of [20, 60, 180, 220]) {
		rect(X + tx - 1, Y + 2, 3, 2, C.light);
		rect(X + tx - 2, Y + 1, 5, 1, hex("#3a3a30"));
		rect(X + tx, Y + 4, 1, 6, hex("#2a3a34"));
	}
	// バックネット裏の スタンド（3px おきの 席の 列）
	for (let y = 10; y < 40; y++) rect(X, Y + y, 240, 1, (y - 10) % 3 === 2 ? hex("#262634") : hex("#1a1a24"));
	// 通路（縦）
	for (const ax of [40, 120, 200]) rect(X + ax, Y + 10, 1, 30, hex("#30303e"));
	// フェンスと ネット
	rect(X, Y + 40, 240, 6, hex("#24302c"));
	for (let x = 0; x < 240; x += 4) rect(X + x, Y + 40, 1, 6, hex("#3a4a44"));
	// 字の ない 広告の 板
	const ads = ["#2a4a6a", "#6a2a2a", "#2a6a4a"];
	for (let k = 0, x = 6; x + 20 < 240; k++, x += 26) rect(X + x, Y + 41, 20, 4, hex(ads[k % 3]));
	// 芝（刈り目 8px）
	for (let y = 46; y < 135; y++) {
		const band = Math.floor((y - 46) / 8) % 2;
		rect(X, Y + y, 240, 1, y < 70 ? C.grass3 : band ? C.grass2 : C.grass);
	}
	// 本塁まわりの 土
	ellipse(X + 120, Y + 62, 46, 12, C.dirt, [X, Y + 46, X + 240, Y + 135]);
	ellipse(X + 120, Y + 63, 40, 9, C.dirtD, [X, Y + 46, X + 240, Y + 135]);
	ellipse(X + 120, Y + 62, 38, 8, C.dirt, [X, Y + 46, X + 240, Y + 135]);
	// 打席の 白線
	for (const bx of [104, 128]) {
		rect(X + bx, Y + 56, 8, 1, C.white);
		rect(X + bx, Y + 67, 8, 1, C.white);
		rect(X + bx, Y + 56, 1, 12, C.white);
		rect(X + bx + 7, Y + 56, 1, 12, C.white);
	}
	rect(X + 117, Y + 64, 6, 2, C.pure);
	// マウンド
	ellipse(X + 120, Y + 128, 40, 14, C.dirt, [X, Y, X + 240, Y + 135]);
	ellipse(X + 120, Y + 129, 30, 9, C.dirtD, [X, Y, X + 240, Y + 135]);
	ellipse(X + 120, Y + 128, 28, 8, C.dirt, [X, Y, X + 240, Y + 135]);
	rect(X + 116, Y + 118, 8, 2, C.pure);
};

// ───────────────── (0,135) 俯瞰 ─────────────────
const fieldBg = () => {
	const X = 0;
	const Y = 135;
	// 外野スタンド
	for (let y = 0; y < 24; y++) rect(X, Y + y, 240, 1, y % 4 === 3 ? hex("#262634") : hex("#1a1a24"));
	// フェンス（上端に 黄の 線）
	rect(X, Y + 24, 240, 4, hex("#1e5a3a"));
	rect(X, Y + 24, 240, 1, hex("#e8c020"));
	// 外野の 芝（刈り目）
	for (let y = 28; y < 135; y++) rect(X, Y + y, 240, 1, Math.floor((y - 28) / 8) % 2 ? C.grass2 : C.grass);
	// 内野の 土（塁の ひし形を 広げた 形）
	const home = [120, 124];
	const b1 = [164, 100];
	const b2 = [120, 78];
	const b3 = [76, 100];
	poly(
		[
			[home[0], home[1] + 10],
			[b1[0] + 16, b1[1]],
			[b2[0], b2[1] - 12],
			[b3[0] - 16, b3[1]],
		].map(([x, y]) => [X + x, Y + y]),
		C.dirt,
	);
	// 中の 芝
	poly(
		[
			[home[0], home[1] - 9],
			[b1[0] - 12, b1[1]],
			[b2[0], b2[1] + 9],
			[b3[0] + 12, b3[1]],
		].map(([x, y]) => [X + x, Y + y]),
		C.grass3,
	);
	// ファウルライン
	line(X + home[0], Y + home[1], X + 8, Y + 40, C.white);
	line(X + home[0], Y + home[1], X + 232, Y + 40, C.white);
	// マウンド
	ellipse(X + 120, Y + 100, 6, 6, C.dirt);
	rect(X + 118, Y + 100, 4, 1, C.pure);
	// 塁
	for (const [bx, by] of [b1, b2, b3]) rect(X + bx - 2, Y + by - 2, 4, 4, C.pure);
	rect(X + home[0] - 2, Y + home[1] - 1, 4, 3, C.pure);
	// 打席の 土
	ellipse(X + home[0], Y + home[1] + 2, 10, 5, C.dirt);
	rect(X + home[0] - 2, Y + home[1] - 1, 4, 3, C.pure);
};

// ───────────────── 人 ─────────────────
const pitchers = () => {
	// うしろ姿 16x24（帽子・首・胴・袖・ベルト・ズボン・くつ）
	const set0 = [
		"......oooo......",
		".....oCCCCo.....",
		"....oCCCCCCo....",
		"....oCCCCCCo....",
		"....ohhhhhho....",
		".....osssso.....",
		"...ooBBBBBBoo...",
		"..oTBBBBBBBBTo..",
		"..oTBBBTTBBBTo..",
		"..oBBBBTTBBBBo..",
		"..osBBBBBBBBso..",
		"..osBBBBBBBBso..",
		"...oBBBBBBBBo...",
		"...oTTTTTTTTo...",
		"...oPPPPPPPPo...",
		"...oPPPPPPPPo...",
		"...oPPPooPPPo...",
		"...oPPPooPPPo...",
		"...oPPPooPPPo...",
		"...oPPPooPPPo...",
		"...oPPPooPPPo...",
		"...okkkookkko...",
		"...okkkookkko...",
		"................",
	];
	const legUp = [
		"......oooo......",
		".....oCCCCo.....",
		"....oCCCCCCo....",
		"....oCCCCCCo....",
		"....ohhhhhho....",
		".....osssso.....",
		"...ooBBBBBBoo...",
		"..oTBBBBBBBBTo..",
		"..oTBBBTTBBBTo..",
		"..oBBBBTTBBBBo..",
		"..osBBBBBBBBso..",
		"..osBBBBBBBBso..",
		"...oBBBBBBBBo...",
		"...oTTTTTTTTo...",
		"...oPPPPPPPPPPo.",
		"...oPPPPPPPPPPPo",
		"...oPPPooooPPPPo",
		"...oPPPo...oPPo.",
		"...oPPPo...okko.",
		"...oPPPo....oo..",
		"...oPPPo........",
		"...okkko........",
		"...okkko........",
		"................",
	];
	const follow = [
		"................",
		".......oooo.....",
		"......oCCCCo....",
		".....oCCCCCCo...",
		".....ohhhhhho...",
		"..oo..osssso....",
		".osTooBBBBBBoo..",
		".osTBBBBBBBBTo..",
		"..oBBBBTTBBBTo..",
		"...oBBBTTBBBBo..",
		"...oBBBBBBBBso..",
		"...oBBBBBBBBso..",
		"...oBBBBBBBBo...",
		"...oTTTTTTTTo...",
		"...oPPPPPPPPo...",
		"..oPPPPooPPPPo..",
		"..oPPPo..oPPPo..",
		".oPPPo....oPPo..",
		".oPPPo....oPPo..",
		"oPPPo......oPPo.",
		"okkko......okko.",
		"okko.......okko.",
		"................",
		"................",
	];
	art(0, 270, set0);
	art(16, 270, legUp);
	art(32, 270, follow);
	frame("pitcher", 0, 270, 16, 24, 3);
	// 打者 12x18（右打者を 本塁がわ＝右を 向いて 描く。バットは 頭の うしろ）
	const stance = [
		"..b.........",
		"..bb........",
		"...bb.......",
		"....bbooo...",
		"....oCCCCo..",
		"...oCCCCCCo.",
		"....osssoo..",
		"...ooBBBo...",
		"..osBBBBBo..",
		"...ogBBBBo..",
		"....oTTTTo..",
		"....oPPPPo..",
		"...oPPoPPo..",
		"...oPPooPPo.",
		"..oPPo..oPo.",
		"..oPPo..oPo.",
		"..okko..oko.",
		"............",
	];
	const swing = [
		"............",
		"............",
		"............",
		".....ooo....",
		"....oCCCCo..",
		"...oCCCCCCo.",
		"....osssoo..",
		"...ooBBBBoo.",
		"..oBBBBBBsgbbbb",
		"...oBBBBBo..",
		"....oTTTTo..",
		"....oPPPPo..",
		"...oPPoPPo..",
		"..oPPo.oPPo.",
		"..oPPo..oPo.",
		".oPPo...oPo.",
		".okko...oko.",
		"............",
	];
	art(48, 270, stance);
	art(60, 270, swing.map((r) => r.slice(0, 12)));
	frame("batter", 48, 270, 12, 18, 2);
	// 捕手 12x10（しゃがみ。防具は 帽子色、ミットは グラブ色）
	art(72, 270, [
		"....oooo....",
		"...oCCCCo...",
		"...oCwCwo...",
		"..ooCCCCoo..",
		".oggBBBBBBo.",
		".oggBBBBBBo.",
		"..ooTTTTTo..",
		".oPPPPPPPPo.",
		"oPPPo..oPPPo",
		"okkko..okkko",
	]);
	frame("catcher", 72, 270, 12, 10, 1);
	// 野手 6x9（立ち・走り）
	art(84, 270, ["..oo..", ".oCCo.", ".osso.", "oBBBBo", "sBBBBs", ".oTTo.", ".oPPo.", ".oPPo.", ".okko."]);
	art(90, 270, ["..oo..", ".oCCo.", ".osso.", "oBBBBo", ".BBBBs", ".oTTo.", "oPP.Po", "oPo.Po", "ko..ko"]);
	frame("fielder", 84, 270, 6, 9, 2);
	// 走者 6x9（走りの 2こま。ヘルメットは 帽子色）
	art(96, 270, ["..oo..", ".oCCo.", ".osso.", "oBBBBo", "sBBBB.", ".oTTo.", "oPP.Po", "oPo..P", "ko...k"]);
	art(102, 270, ["..oo..", ".oCCo.", ".osso.", ".BBBBo", ".BBBBs", ".oTTo.", ".oPPo.", "oP.oPo", "k..ok."]);
	frame("runner", 96, 270, 6, 9, 2);
};

/** 札用の 上半身 24x32（顔は はだ色の 楕円だけ。目鼻は 描かない）。 */
const portraits = () => {
	const bust = (x0, helmet) => {
		const X = x0;
		const Y = 270;
		// 肩と 胴（枠の 24x32 の 中だけ）。えりと 袖の 線は トリム色
		const box = [X, Y, X + 24, Y + 32];
		ellipse(X + 12, Y + 32, 11, 10, C.ink, box);
		ellipse(X + 12, Y + 32, 10, 9, C.body, box);
		line(X + 9, Y + 23, X + 12, Y + 27, C.trim);
		line(X + 15, Y + 23, X + 12, Y + 27, C.trim);
		rect(X + 3, Y + 29, 2, 3, C.trim);
		rect(X + 19, Y + 29, 2, 3, C.trim);
		// 首と 顔
		rect(X + 10, Y + 18, 4, 4, C.skinD);
		ellipse(X + 12, Y + 13, 6, 7, C.ink);
		ellipse(X + 12, Y + 13, 5, 6, C.skin);
		rect(X + 7, Y + 15, 1, 3, C.skinD);
		// 帽子・ヘルメット
		ellipse(X + 12, Y + 8, 6.5, 4.5, C.ink);
		ellipse(X + 12, Y + 8, 5.5, 3.5, C.cap);
		rect(X + 6, Y + 9, 12, 2, C.cap);
		if (helmet) {
			rect(X + 5, Y + 9, 3, 6, C.cap);
			rect(X + 4, Y + 10, 1, 4, C.ink);
		} else {
			rect(X + 12, Y + 10, 8, 2, C.cap);
			rect(X + 12, Y + 12, 8, 1, C.ink);
		}
	};
	bust(108, false);
	bust(132, true);
	// 打者は 肩に バット
	line(132 + 18, 270 + 27, 132 + 23, 270 + 4, C.bat);
	line(132 + 19, 270 + 27, 132 + 23, 270 + 6, hex("#b08a50"));
	frame("bustPitcher", 108, 270, 24, 32, 1);
	frame("bustBatter", 132, 270, 24, 32, 1);
	// 歓喜 24x32（両手を 上げる・こぶし）
	const joy = (x0, both) => {
		const X = x0;
		const Y = 270;
		ellipse(X + 12, Y + 9, 4.5, 5, C.ink);
		ellipse(X + 12, Y + 9, 3.5, 4, C.skin);
		ellipse(X + 12, Y + 6, 4.5, 3, C.cap);
		rect(X + 8, Y + 15, 9, 9, C.ink);
		rect(X + 9, Y + 15, 7, 8, C.body);
		rect(X + 9, Y + 22, 7, 1, C.trim);
		rect(X + 9, Y + 23, 3, 7, C.pants);
		rect(X + 13, Y + 23, 3, 7, C.pants);
		rect(X + 9, Y + 30, 3, 2, C.shoe);
		rect(X + 13, Y + 30, 3, 2, C.shoe);
		// 腕
		line(X + 16, Y + 16, X + 20, Y + 5, C.body);
		rect(X + 19, Y + 3, 3, 3, C.skin);
		if (both) {
			line(X + 8, Y + 16, X + 4, Y + 5, C.body);
			rect(X + 2, Y + 3, 3, 3, C.skin);
		} else {
			line(X + 8, Y + 16, X + 5, Y + 20, C.body);
			rect(X + 3, Y + 19, 3, 3, C.skin);
		}
	};
	joy(156, true);
	joy(180, false);
	frame("joy", 156, 270, 24, 32, 2);
	// 帽子・ヘルメットの 札 12x8
	ellipse(204 + 6, 270 + 4, 5, 3.5, C.ink);
	ellipse(204 + 6, 270 + 4, 4, 2.5, C.cap);
	rect(204 + 6, 270 + 5, 6, 2, C.cap);
	rect(204 + 6, 270 + 7, 6, 1, C.ink);
	frame("capBadge", 204, 270, 12, 8, 1);
	ellipse(216 + 6, 270 + 4, 5, 4, C.ink);
	ellipse(216 + 6, 270 + 4, 4, 3, C.cap);
	rect(216 + 1, 270 + 5, 3, 3, C.cap);
	rect(216 + 2, 270 + 4, 1, 1, C.pure);
	frame("helmetBadge", 216, 270, 12, 8, 1);
	// 球審 12x14（紺と 灰）
	art(228, 270, [
		"....oooo....",
		"...onnnno...",
		"...oGwGwo...",
		"...onnnno...",
		"..oonnnnoo..",
		".onnnnnnnno.",
		".onnnnnnnno.",
		".osnnnnnnso.",
		"..onnnnnno..",
		"..oGGGGGGo..",
		"..oGGooGGo..",
		"..oGGooGGo..",
		"..okkookko..",
		"............",
	]);
	frame("umpire", 228, 270, 12, 14, 1);
};

// ───────────────── 数字・ランプ・小物 ─────────────────
const DIGITS = [
	[".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
	["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
	[".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
	["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
	["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
	["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
	[".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
	["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
	[".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
	[".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
];
const small = () => {
	DIGITS.forEach((d, i) => {
		art(i * 5, 302, d.map((r) => r.replaceAll("#", "W")));
		art(50 + i * 5, 302, d.map((r) => r.replaceAll("#", "y")));
	});
	frame("digitW", 0, 302, 5, 7, 10);
	frame("digitY", 50, 302, 5, 7, 10);
	// アウトの ランプ
	ellipse(100 + 2.5, 302 + 2.5, 2.5, 2.5, hex("#ff4a3a"));
	set(101, 303, hex("#ffb0a0"));
	ellipse(105 + 2.5, 302 + 2.5, 2.5, 2.5, hex("#3a3a44"));
	frame("lampOn", 100, 302, 5, 5, 1);
	frame("lampOff", 105, 302, 5, 5, 1);
	// OUT の 字
	art(110, 302, ["WWW.W.W.WWW", "W.W.W.W..W.", "W.W.W.W..W.", "W.W.W.W..W.", "WWW.WWW..W."]);
	frame("outText", 110, 302, 11, 5, 1);
	// 塁
	rect(121, 302, 4, 4, hex("#5a5a64"));
	rect(125, 302, 4, 4, C.yellow);
	frame("baseEmpty", 121, 302, 4, 4, 1);
	frame("baseOn", 125, 302, 4, 4, 1);
	// ▲ ▼
	art(129, 302, ["..W..", ".WWW.", "WWWWW", "....."]);
	art(134, 302, ["WWWWW", ".WWW.", "..W..", "....."]);
	frame("topMark", 129, 302, 5, 4, 1);
	frame("botMark", 134, 302, 5, 4, 1);
	// 球（2・3・4px）と 影
	rect(139, 302, 2, 2, C.pure);
	rect(141, 302, 3, 3, C.pure);
	set(142, 303, C.red);
	rect(144, 302, 4, 4, C.pure);
	set(144, 302, [0, 0, 0, 0]);
	set(147, 302, [0, 0, 0, 0]);
	set(144, 305, [0, 0, 0, 0]);
	set(147, 305, [0, 0, 0, 0]);
	set(145, 303, C.red);
	set(146, 304, C.red);
	rect(148, 302, 4, 2, [0, 0, 0, 102]);
	frame("ball2", 139, 302, 2, 2, 1);
	frame("ball3", 141, 302, 3, 3, 1);
	frame("ball4", 144, 302, 4, 4, 1);
	frame("shadow", 148, 302, 4, 2, 1);
	// LIVE の 札（赤地に 白の ドット字）
	rect(152, 302, 20, 7, hex("#c81e1e"));
	art(153, 303, ["W...WWW.W.W.WWW", "W....W..W.W.W..", "W....W..W.W.WWW", "W....W..W.W.W..", "WWW.WWW..W..WWW"]);
	frame("live", 152, 302, 20, 7, 1);
	// ベゼルの つや角（左上の 形。ほかの 角は 反転）
	art(172, 302, ["WWWW..", "WW....", "W.....", "W.....", "......", "......"], {
		W: [255, 255, 255, 110],
	});
	frame("gloss", 172, 302, 6, 6, 1);
	// スピーカー（ラジオ版用）
	rect(178, 302, 9, 8, hex("#3a3a44"));
	rect(179, 303, 7, 6, hex("#24242c"));
	for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) set(180 + x * 2, 304 + y * 2, hex("#6a6a78"));
	frame("speaker", 178, 302, 9, 8, 1);
	// 風船（3こま。胴の 色＝ファン色に かわる）
	const balloon = [
		[".B.", "BBB", "BBB", ".B.", ".o.", "..o"],
		[".B.", "BBB", "BBB", ".B.", ".o.", ".o."],
		[".B.", "BBB", "BBB", ".B.", ".o.", "o.."],
	];
	balloon.forEach((b, i) => {
		art(188 + i * 3, 302, b, { B: C.body, o: hex("#e8e8e8") });
		set(188 + i * 3, 303, hex("#ffffff", 200));
	});
	frame("balloon", 188, 302, 3, 6, 3);
	// 花火（2こま）
	art(198, 302, ["...y....", ".y.y.y..", "..yWy...", "yyW.Wyy.", "..yWy...", ".y.y.y..", "...y....", "........"]);
	art(206, 302, ["y..y..y.", ".y.y.y..", "..W.W...", "yW...Wy.", "..W.W...", ".y.y.y..", "y..y..y.", "........"]);
	frame("fireworks", 198, 302, 8, 8, 2);
};

// ───────────────── CM・観客・外野の 席 ─────────────────
const crowdAndCm = () => {
	// CM（字の ない カラーバー）
	const bars = ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"];
	bars.forEach((b, i) => rect(i * 9 + Math.min(i, 1), 312, i === 0 ? 10 : 9, 26, hex(b)));
	const low = ["#0000c0", "#101010", "#c000c0", "#101010", "#00c0c0", "#101010", "#c0c0c0"];
	low.forEach((b, i) => rect(i * 9 + Math.min(i, 1), 338, i === 0 ? 10 : 9, 4, hex(b)));
	rect(0, 342, 64, 6, hex("#101018"));
	rect(10, 343, 14, 4, hex("#2a2a3a"));
	rect(30, 343, 6, 4, hex("#ffffff"));
	frame("cm", 0, 312, 64, 36, 1);
	// 観客 16x8（2段の 頭と 胴。胴は ファン色）
	seed = 99;
	const heads = [];
	for (let k = 0; k < 4; k++) heads.push(rnd() < 0.55 ? C.hair : C.skin);
	for (const [fx, wave] of [
		[64, false],
		[80, true],
	]) {
		[
			[1, 0],
			[9, 0],
			[5, 4],
			[13, 4],
		].forEach(([px, py], k) => {
			const hx = fx + px;
			rect(hx, 312 + py, 2, 2, heads[k]);
			rect(hx - 1, 312 + py + 2, 4, 2, C.body);
			if (wave) {
				set(hx - 1, 312 + py - (k % 2 ? 1 : 0), C.skin);
				set(hx + 2, 312 + py - (k % 2 ? 0 : 1), C.skin);
			}
		});
	}
	frame("crowd", 64, 312, 16, 8, 2);
	// 外野スタンドの 席の 列（くり返し用）
	for (let y = 0; y < 16; y++) rect(96, 312 + y, 32, 1, y % 4 === 3 ? hex("#262634") : hex("#1a1a24"));
	for (let x = 0; x < 32; x += 8) rect(96 + x, 312, 1, 16, hex("#30303e"));
	frame("stand", 96, 312, 32, 16, 1);
};

pitchBg();
frame("bgPitch", 0, 0, 240, 135, 1);
fieldBg();
frame("bgField", 0, 135, 240, 135, 1);
pitchers();
portraits();
small();
crowdAndCm();

writeFileSync(OUT, encodePng(W, H, rgba));
const ts = `// ナイター実況の 絵（public/sprites/jikkyo.png）の どこに 何が あるか。scripts/make-jikkyo.mjs が 書く（手で 直さない）。
// x,y は 1コマ目の 左上。コマは 右へ w ずつ 並ぶ（n コマ）。差しかえ色は 胴 #ff00ff・帽子 #00ffff・ベルト #ffff00・ズボン #00ff00。

export const JK_SHEET = "pub:sprites/jikkyo.png";

/** 差しかえ色（実行時に 球団の 色へ）。 */
export const JK_KEY = {
	body: [255, 0, 255],
	cap: [0, 255, 255],
	trim: [255, 255, 0],
	pants: [0, 255, 0],
} as const;

export const JK_SPR = {
${Object.entries(SPR)
	.map(([k, v]) => `\t${k}: { x: ${v.x}, y: ${v.y}, w: ${v.w}, h: ${v.h}, n: ${v.n} },`)
	.join("\n")}
} as const;
`;
writeFileSync(SHEET_TS, ts);
console.log(`wrote ${OUT} (${W}x${H}) and ${SHEET_TS}`);
