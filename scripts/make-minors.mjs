// 村に 越してくる おんJマイナーズの 歩行グラ（32x64・16x16 が 2コマ×4方向。RPGEN 歩行グラ規格）を 書き出す
// （node scripts/make-minors.mjs）。rpg の scripts/make-sprites.mjs と 同じ 作り方（顔文字の 特徴だけを 16x16 に 落とす）。
//
// - public/sprites/minors_miaumiau.png … ミャウミャウ <f(・ワ・)t>（紙袋の 服を 着た エルフ。銀の 髪・イカの 頭巾）
// - public/sprites/minors_jtleman.png  … ジェイトルマン (‐Jし‐)（シルクハットの 紳士。閉じた目・J の鼻・し の口）
// - public/sprites/minors_asakonro.png … 朝コンロ ( ,,Ծ‸Ծ,,)（火の色の 髪。まるい目・‸ の口・ほっぺの ,,）
// - public/sprites/minors_mujje.png    … ムッジェ ΣΩΩ>（赤い 毛の 柱・柄の 先の 目玉・横に つき出た 口・白い 手袋）
//
// 1コマ目の 絵を 描き、2コマ目は 足もと（下の 2行）だけ 差し替える。左向きは 右向きの 反転。依存なし（zlib だけ）。

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../public/sprites");

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

const hex = (s) => [
	Number.parseInt(s.slice(1, 3), 16),
	Number.parseInt(s.slice(3, 5), 16),
	Number.parseInt(s.slice(5, 7), 16),
	255,
];

/** 16x16 の コマを sheet の (cx, cy) マスに 描く。 */
const paint = (sheet, sheetW, cx, cy, art, pal) => {
	if (art.length !== 16) throw new Error(`行の数が 16 でない: ${art.length}`);
	art.forEach((row, y) => {
		if (row.length !== 16) throw new Error(`行の長さが 16 でない: "${row}"`);
		[...row].forEach((ch, x) => {
			if (ch === ".") return;
			const col = pal[ch];
			if (!col) throw new Error(`色 "${ch}" が 未定義`);
			const i = ((cy * 16 + y) * sheetW + cx * 16 + x) * 4;
			sheet[i] = col[0];
			sheet[i + 1] = col[1];
			sheet[i + 2] = col[2];
			sheet[i + 3] = col[3];
		});
	});
};

const mirror = (art) => art.map((r) => [...r].reverse().join(""));

/** 上・右・下向き（各 14行 ＋ 足もと 2行）と、2コマ目の 足もと 2行から シートを 作る。 */
const walkSheet = (file, pal, { up, right, down }, feet, feet2) => {
	const frame = (art, f) => [...art, ...f];
	const buf = Buffer.alloc(32 * 64 * 4);
	const rows = [up, right, down, null];
	for (let row = 0; row < 4; row++) {
		const art = rows[row] ?? right;
		const flip = row === 3 ? mirror : (a) => a;
		paint(buf, 32, 0, row, flip(frame(art, feet)), pal);
		paint(buf, 32, 1, row, flip(frame(art, feet2)), pal);
	}
	writeFileSync(join(OUT, file), encodePng(32, 64, buf));
};

const FEET = [".....SS..SS.....", "................"];
const FEET_B = ["....SS....SS....", "................"];

// ───── ミャウミャウ <f(・ワ・)t> ─────
// おんJwiki（ミャウミャウ）の 絵に 合わせて：紙袋は 服（茶色い 紙袋の ワンピース）。銀の 長い 髪・とがった エルフの 耳・
// 頭に イカの 胴の ような 白い 頭巾（顔面：ダイオウイカ）・・ワ・ の 顔・はだしの 脚。公式にも 絵は 定まっていない。
walkSheet(
	"minors_miaumiau.png",
	{
		K: hex("#3a2a3a"),
		Q: hex("#f2cfe2"),
		q: hex("#c88aae"),
		H: hex("#eceaf4"),
		h: hex("#b8b4cc"),
		F: hex("#ffe0c8"),
		B: hex("#141414"),
		M: hex("#c84a5a"),
		G: hex("#b08050"),
		g: hex("#8a6038"),
		S: hex("#f2c8a8"),
	},
	{
		down: [
			".....KKKKKK.....",
			"....KQQQQQQK....",
			"...KQQqQQqQQK...",
			"..KQQQQQQQQQQK..",
			".KHHHHHHHHHHHHK.",
			"FKHFFFFFFFFFFHKF",
			".KHFBFFFFFFBFHK.",
			".KHFFFFMMFFFFHK.",
			".KHHFFFFFFFFHHK.",
			".KHHKGGGGGGKHHK.",
			".KHKFGGGGGGFKHK.",
			".KHKGGgGGgGGKHK.",
			"..KKGGGGGGGGKK..",
			"...KgGgGGgGgK...",
		],
		up: [
			".....KKKKKK.....",
			"....KQQQQQQK....",
			"...KQQqQQqQQK...",
			"..KQQQQQQQQQQK..",
			".KHHHHHHHHHHHHK.",
			"FKHHHHHHHHHHHHKF",
			".KHHhHHHHHHhHHK.",
			".KHHHHHHHHHHHHK.",
			".KHHHhHHHHhHHHK.",
			".KHHHHHHHHHHHHK.",
			".KHHhHHHHHHhHHK.",
			".KHHHHHHHHHHHHK.",
			"..KKGGGGGGGGKK..",
			"...KgGgGGgGgK...",
		],
		right: [
			".....KKKKKK.....",
			"....KQQQQQQK....",
			"...KQQqQQqQQK...",
			"..KQQQQQQQQQQK..",
			".KHHHHHHHHHHHK..",
			"FKHHHHFFFFFFFK..",
			".KHHHHFFFFFBFK..",
			".KHHHHFFFFFFMK..",
			".KHHHHHFFFFFK...",
			".KHHHHKGGGGK....",
			".KHHHKGGGFGK....",
			".KHHKGGgGGGK....",
			"..KKGGGGGGGK....",
			"...KgGgGGgK.....",
		],
	},
	[".....SS..SS.....", "................"],
	["....SS....SS....", "................"],
);

// ───── ジェイトルマン (‐Jし‐) ─────
// 黒い シルクハット（赤い 帯）。閉じた目（‐）・J の 鼻・し の 口。灰色の 背広に 白い シャツと 赤い ネクタイ。
const JT_BODY = [
	"...KFFFFFFFFK...",
	"..KDDDWRRWDDDK..",
	".KDDDDWRRWDDDDK.",
	".KdDDDDDDDDDDdK.",
];
walkSheet(
	"minors_jtleman.png",
	{
		K: hex("#1a1a1a"),
		T: hex("#2e2e34"),
		t: hex("#8a2a2a"),
		H: hex("#5a4a3a"),
		F: hex("#ffe0c4"),
		B: hex("#2a1a14"),
		D: hex("#4a5066"),
		d: hex("#343848"),
		W: hex("#ffffff"),
		R: hex("#b03040"),
		S: hex("#1a1a1a"),
	},
	{
		down: [
			"....KKKKKKKK....",
			"....KTTTTTTK....",
			"....KTTTTTTK....",
			"....KttttttK....",
			"..KKKKKKKKKKKK..",
			"..KFFFFFFFFFFK..",
			"..KFBBFFFFBBFK..",
			"..KFFFFFKFFFFK..",
			"..KFFFFKKFFFFK..",
			"..KFFFBFFFFBFK..",
			...JT_BODY,
		],
		up: [
			"....KKKKKKKK....",
			"....KTTTTTTK....",
			"....KTTTTTTK....",
			"....KttttttK....",
			"..KKKKKKKKKKKK..",
			"..KHHHHHHHHHHK..",
			"..KHHHHHHHHHHK..",
			"..KHHHHHHHHHHK..",
			"..KHHHHHHHHHHK..",
			"..KFHHHHHHHHFK..",
			"...KFFFFFFFFK...",
			"..KDDDDDDDDDDK..",
			".KDDDDDDDDDDDDK.",
			".KdDDDDDDDDDDdK.",
		],
		right: [
			"....KKKKKKKK....",
			"....KTTTTTTK....",
			"....KTTTTTTK....",
			"....KttttttK....",
			"..KKKKKKKKKKKKK.",
			"..KHHFFFFFFFFK..",
			"..KHHFFFFBBFFK..",
			"..KHHFFFFFFKFK..",
			"..KHFFFFFFKKFK..",
			"..KFFFFFFBFFBK..",
			"...KFFFFFFFFK...",
			"..KDDDDDWRRDDK..",
			".KDDDDDDWRRDDDK.",
			".KdDDDDDDDDDDdK.",
		],
	},
	FEET,
	FEET_B,
);

// ───── 朝コンロ ( ,,Ծ‸Ծ,,) ─────
// 火の 色の 髪（頭の てっぺんに 炎）。まるい 目（Ծ）・‸ の 口・ほっぺの ,,。赤い 服。
const KONRO_BODY = [
	"...KCCCCCCCCK...",
	"..KCCcCCCCcCCK..",
	"..KCCCCCCCCCCK..",
];
walkSheet(
	"minors_asakonro.png",
	{
		K: hex("#3a1a0a"),
		Y: hex("#ffd23a"),
		H: hex("#ff6a2a"),
		h: hex("#d8401a"),
		F: hex("#ffe0c8"),
		W: hex("#ffffff"),
		B: hex("#141414"),
		P: hex("#f28aa0"),
		C: hex("#e0503a"),
		c: hex("#a83020"),
		S: hex("#4a2a1a"),
	},
	{
		down: [
			"......KYK.......",
			".....KYHYK......",
			"...KKHHHHHHKK...",
			"..KHHHHHHHHHHK..",
			"..KHhHHHHHHhHK..",
			".KHFFFFFFFFFFHK.",
			".KHFKKFFFFKKFHK.",
			".KFKWBKFFKWBKFK.",
			".KFFKKFFFFKKFFK.",
			".KPPFFFKKFFFPPK.",
			"..KFFFFFFFFFFK..",
			...KONRO_BODY,
		],
		up: [
			"......KYK.......",
			".....KYHYK......",
			"...KKHHHHHHKK...",
			"..KHHHHHHHHHHK..",
			"..KHhHHHHHHhHK..",
			".KHHHHHHHHHHHHK.",
			".KHHHhHHHHhHHHK.",
			".KHHHHHHHHHHHHK.",
			".KHHHHHHHHHHHHK.",
			".KhHHHHHHHHHHhK.",
			"..KHHHHHHHHHHK..",
			...KONRO_BODY,
		],
		right: [
			"......KYK.......",
			".....KYHYK......",
			"...KKHHHHHHKK...",
			"..KHHHHHHHHHHK..",
			"..KHhHHHHHHHHK..",
			".KHHHFFFFFFFFK..",
			".KHHHFFFFKKFFK..",
			".KHHFFFFKWBKFK..",
			".KHHFFFFFKKFFK..",
			".KHHFFFFPPFKFK..",
			"..KHFFFFFFFFK...",
			...KONRO_BODY,
		],
	},
	FEET,
	FEET_B,
);

// ───── ムッジェ ΣΩΩ> ─────
// おんJ 初期の お絵かきスレ「(´・ω・`)ここはぼくたちのあたらしい縄張りだからね」（2014）生まれ。板の バナーにも いる。
// 元絵：頭と 胴が ひとつづきの 赤い 柱（首は ない）に、ムックの ような まばらな 毛（短い 黒い 毛が ぴんぴん）。
// てっぺんから 目玉が 2つ 柄で 生え（ΩΩ）、横へ つき出た くちばしの ような 大きな 口（>。よく 開いている）。
// 手は 小さな 白い 手袋。足は ほとんど 見えない。
walkSheet(
	"minors_mujje.png",
	{
		K: hex("#3a0d0a"),
		k: hex("#1a0604"),
		R: hex("#e0301f"),
		r: hex("#9e1f17"),
		W: hex("#ffffff"),
		B: hex("#141414"),
		M: hex("#5a0f12"),
		G: hex("#ffffff"),
		S: hex("#7a1a12"),
	},
	{
		down: [
			"....KK...KK.....",
			"...KWBK.KBWK....",
			"....KK...KK.....",
			"....KRK.KRK.....",
			"...KRRRRRRRRK...",
			"..kKRrRRRRrRK...",
			"...KRKMMMMKRK...",
			"...KRKMMMMKRKk..",
			"...KRRKKKKRRK...",
			"..GKRrRRRRrRKG..",
			".GGKRRRRrRRRKGG.",
			"..kKRRrRRRRRK...",
			"...KRRRRRrRRKk..",
			"..kKrRRRRRRrK...",
		],
		up: [
			"....KK...KK.....",
			"...KWWK.KWWK....",
			"....KK...KK.....",
			"....KRK.KRK.....",
			"...KRRRRRRRRK...",
			"..kKRrRRRRrRK...",
			"...KRRRrRRRRK...",
			"...KRRRRRRrRKk..",
			"...KrRRRRRRRK...",
			"..GKRRRrRRRRKG..",
			".GGKRRRRRRrRKGG.",
			"..kKRrRRRRRRK...",
			"...KRRRRrRRRKk..",
			"..kKrRRRRRRrK...",
		],
		right: [
			".......KK.KK....",
			"......KWBKWBK...",
			".......KK.KK....",
			".......KRKRK....",
			"....KRRRRRRK....",
			"...kKRRRRRRRKK..",
			"....KRrRRRRRRRK.",
			"....KRRRRKMMMMK.",
			"...kKRRRRRRRRK..",
			"....KRRrRRKK....",
			"....KRRRGGK.....",
			"...kKRrRGGK.....",
			"....KRRRRRKk....",
			"...kKrRRRrK.....",
		],
	},
	[".....SS..SS.....", "................"],
	["....SS....SS....", "................"],
);

console.log(
	"wrote minors_miaumiau.png, minors_jtleman.png, minors_asakonro.png, minors_mujje.png",
);
