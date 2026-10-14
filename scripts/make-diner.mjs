// バーガー屋「ワイバーガー」と メイド喫茶「メイドの土産」の 手描きの 絵を 書き出す（node scripts/make-diner.mjs）。
//
// - public/sprites/diner.png       … 出てきた 一品（ui/minigames/eat.ts）と 店の 中の 品書きの 板（16x16 の 格子）
// - public/sprites/maid_walk.png   … メイドさんの 歩行グラ（32x64・16x16 が 2コマ×4方向。RPGEN 歩行グラ規格。手描き）
// - src/data/village/dinerSheet.ts … どの 絵が diner.png の どこに あるか（この スクリプトが 書く。手で 直さない）
//
// RPGEN に ない 物（バーガー・ポテト・シェイク・ハートの オムライス・パフェ・メイド）だけ ここで 描く。
// 実在の 店の 印（黄色い M など）は 描かない。品の 絵は 見える 画素の 下はしを マスの 下に そろえる
// （scripts/pack-rpgen.mjs の seat と 同じ。板に 大きく 出す とき 台の 上に のる）。
// 依存なし（zlib だけ）。PNG の 書き方は make-saba.mjs と 同じ。

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../public/sprites");
const TS_OUT = join(HERE, "../src/data/village/dinerSheet.ts");

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

// ───────────────── 字の 絵 ─────────────────
const hex = (s) => {
	const v = Number.parseInt(s.slice(1, 7), 16);
	return [
		v >> 16,
		(v >> 8) & 255,
		v & 255,
		s.length > 7 ? Number.parseInt(s.slice(7, 9), 16) : 255,
	];
};
/** 字の 行（16字。"." は 透明）を 16x16 に。足りない 行は 上に 透明を 足す（下に そろえる）。 */
const art = (rows, pal) => {
	if (rows.length > 16) throw new Error(`行の数 ${rows.length}`);
	const full = [...Array(16 - rows.length).fill(".".repeat(16)), ...rows];
	const rgba = Buffer.alloc(16 * 16 * 4);
	full.forEach((r, y) => {
		if ([...r].length !== 16) throw new Error(`行の長さ "${r}"`);
		[...r].forEach((ch, x) => {
			if (ch === ".") return;
			const c = pal[ch];
			if (!c) throw new Error(`色 ${ch}`);
			rgba.set(hex(c), (y * 16 + x) * 4);
		});
	});
	return rgba;
};

// ───────────────── 品と 板（diner.png） ─────────────────
const K = "#2a1a12";
const FOOD = {
	// ワイバーガー（ごまの パンに レタス・チーズ・肉・トマト）
	burger: [
		[
			".....KKKKKK.....",
			"...KKbbbbbbKK...",
			"..KbbwbbbbwbbK..",
			"..KbbbbbwbbbbK..",
			".KbbbbbbbbbbbbK.",
			".KgGgGggGgGggGK.",
			".KyyyyyyyyyyyyK.",
			".KmmMmmmMmmmMmK.",
			".KmmmmmmmmmmmmK.",
			".KrrrrrrrrrrrrK.",
			"..KBBBBBBBBBBK..",
			"...KKKKKKKKKK...",
		],
		{
			K,
			b: "#d89040",
			B: "#c07a30",
			w: "#f8f0d8",
			g: "#5ab040",
			G: "#3a8a2a",
			y: "#f8c830",
			m: "#7a4020",
			M: "#5a2c14",
			r: "#e04030",
		},
	],
	// 草バーガー（レタスが 山もり）
	kusaBurger: [
		[
			".....KKKKKK.....",
			"...KKbbbbbbKK...",
			"..KbbwbbbbwbbK..",
			".KbbbbbbbbbbbbK.",
			"KgGgGgGgGgGgGgGK",
			".KgGgGgGgGgGgGK.",
			"KGgGgGgGgGgGgGgK",
			".KmmMmmmMmmmMmK.",
			".KmmmmmmmmmmmmK.",
			"..KBBBBBBBBBBK..",
			"...KKKKKKKKKK...",
		],
		{
			K,
			b: "#d89040",
			B: "#c07a30",
			w: "#f8f0d8",
			g: "#6ac848",
			G: "#3a8a2a",
			m: "#7a4020",
			M: "#5a2c14",
		},
	],
	// ageポテト（赤い 箱に 細い ポテト。箱の 印は 白い 帯だけ）
	fries: [
		[
			"....y..Y.y......",
			"...yY.yYyY.y....",
			"...YyYyYyYyYy...",
			"...yYyYyYyYyY...",
			"..KRRRRRRRRRRK..",
			"..KRRRRRRRRRRK..",
			"..KRwwwwwwwwRK..",
			"..KRRRRRRRRRRK..",
			"...KRRRRRRRRK...",
			"...KRRRRRRRRK...",
			"...KrrrrrrrrK...",
			"....KKKKKKKK....",
		],
		{ K, y: "#f8d860", Y: "#e8a830", R: "#d83028", r: "#a82018", w: "#f8f0e8" },
	],
	// ナゲット（紙の 箱に 4こと ソース）
	nugget: [
		[
			"..KKK.KKK.......",
			".KnNnKnNnK......",
			".KNnnKNnnK.KKK..",
			"..KKK.KKK.KsssK.",
			"KKKKKKKKKKKsSsK.",
			"KwnNnKnNnwKsssK.",
			"KwNnnKNnnwKKKKK.",
			"KwwwwwwwwwK.....",
			"KwwwwwwwwwK.....",
			"KKKKKKKKKKK.....",
		],
		{ K, n: "#e8b050", N: "#c88030", w: "#f0e8d8", s: "#c83020", S: "#e85840" },
	],
	// シェイク（白い カップに ストロー。中は いちご色）
	shake: [
		[
			"........KK......",
			".......KrK......",
			"......KrK.......",
			"....KKKrKKK.....",
			"...KpppppppK....",
			"...KwwwwwwwK....",
			"...KwppppwwK....",
			"....KwwwwwK.....",
			"....KwwwwwK.....",
			"....KwpppwK.....",
			"....KwwwwwK.....",
			".....KKKKK......",
		],
		{ K, r: "#e04040", p: "#f0a0b8", w: "#f8f8f0" },
	],
	// ワイセット（トレーに バーガー・ポテト・ドリンク）
	set: [
		[
			"..........KK....",
			".yY......KrK....",
			"YyYy....KKrKK...",
			"KRRK...KcccccK..",
			"KRwK.KKKwwwwwK..",
			"KRRKKbbbKwccwK..",
			"KRRKgGgGKwwwwK..",
			"KKKKmmmmKwwwwK..",
			"tttKbbbbKKKKKtt.",
			"ttttttttttttttt.",
			"TTTTTTTTTTTTTTT.",
		],
		{
			K,
			y: "#f8d860",
			Y: "#e8a830",
			R: "#d83028",
			w: "#f8f8f0",
			r: "#e04040",
			c: "#6a3a20",
			b: "#d89040",
			g: "#5ab040",
			G: "#3a8a2a",
			m: "#7a4020",
			t: "#e86040",
			T: "#b84028",
		},
	],
	// オムライス（ケチャップで ハート）
	omurice: [
		[
			"....KKKKKKKK....",
			"..KKyyyyyyyyKK..",
			".KyyyyrryrryyyK.",
			".KyyyyrrrrryyyK.",
			".KYyyyyrrryyyYK.",
			"..KYYyyyryyYYK..",
			"wwwKKKKKKKKKKwww",
			"wWWWWWWWWWWWWWWw",
			".wwwwwwwwwwwwww.",
		],
		{
			K: "#a86820",
			y: "#f8d050",
			Y: "#e0a830",
			r: "#d82838",
			w: "#d0d0d8",
			W: "#f8f8ff",
		},
	],
	// いちごパフェ（背の 高い グラス。クリーム・いちご・コーンフレーク）
	parfait: [
		[
			"......Rr........",
			".....KRRK.......",
			"...KwwwwwwK.....",
			"..KwwWwwWwwK....",
			"..KKpppppppKK...",
			"...KgpwwwpgK....",
			"...KwwwwwwwK....",
			"...KpppppppK....",
			"...KcccccccK....",
			"....KwwwwwK.....",
			".....KgggK......",
			"......KgK.......",
			"......KgK.......",
			"....KKKKKKK.....",
		],
		{
			K,
			R: "#e02838",
			r: "#58a838",
			w: "#fff8f0",
			W: "#f0d8e0",
			p: "#f08aa8",
			c: "#e8b860",
			g: "#c8e0f0",
		},
	],
	// クリームソーダ（緑の ソーダに アイスと さくらんぼ）
	creamSoda: [
		[
			".......Rr.......",
			"......RRK.......",
			"....KwwwwwK.....",
			"...KwwwwwwwK....",
			"...KgggggggK....",
			"...KgGgggGgK....",
			"...KggggGggK....",
			"....KgGgggK.....",
			"....KgggggK.....",
			".....KgggK......",
			"......KcK.......",
			"......KcK.......",
			"....KKKKKKK.....",
		],
		{
			K,
			R: "#e02838",
			r: "#58a838",
			w: "#fff8f0",
			g: "#48c858",
			G: "#a8f0b0",
			c: "#c8e0f0",
		},
	],
	// ショートケーキ（三角の 1切れに いちご。小皿）
	shortcake: [
		[
			"........RR......",
			".......RrRK.....",
			".....KKWWWWK....",
			"...KKWWWWWWWK...",
			".KKWWWWWWWWWWK..",
			".KyyyyyyyyyyyK..",
			".KWWRWWRWWRWWK..",
			".KyyyyyyyyyyyK..",
			".KYYYYYYYYYYYK..",
			"..KKKKKKKKKKK...",
			"pPPPPPPPPPPPPPp.",
			".ppppppppppppp..",
		],
		{
			K: "#8a6040",
			R: "#e02838",
			r: "#f86070",
			W: "#fff8f0",
			y: "#f8e0a0",
			Y: "#e8c070",
			p: "#c8c8d8",
			P: "#f0f0f8",
		},
	],
	// ラテ（カップに ハートの 泡）
	latte: [
		[
			"...KKKKKKKKK....",
			"..KcccccccccK...",
			"..KccwwcwwccKKK.",
			"..KcccwwwcccK.K.",
			"..KWccwwwccWKKK.",
			"..KWWccwccWWK...",
			"...KWWWWWWWK....",
			"KKKKKKKKKKKKKKK.",
			".KwwwwwwwwwwwK..",
		],
		{ K: "#5a3a2a", c: "#b07848", w: "#f8f0e0", W: "#f8f8f8" },
	],
};
const BOARD = {
	// 台の 上の 品書きの 板（3マス。黒い 板に 写真と 値段の 線。壁の 上の 段に かける）
	menuL: [
		[
			"KKKKKKKKKKKKKKKK",
			"KkkkkkkkkkkkkkkK",
			"Kk..bbbb.....kkK",
			"Kk.bbbbbb....kkK",
			"Kk.gggggg.wwwkkK",
			"Kk.mmmmmm....kkK",
			"Kk..bbbb.wwwwkkK",
			"KkkkkkkkkkkkkkkK",
			"KKKKKKKKKKKKKKKK",
		],
		{
			K: "#202020",
			k: "#3a3a3a",
			".": "#f8f0d8",
			b: "#d89040",
			g: "#5ab040",
			m: "#7a4020",
			w: "#c83028",
		},
	],
	menuM: [
		[
			"KKKKKKKKKKKKKKKK",
			"KkkkkkkkkkkkkkkK",
			"Kk.y.y.y.....kkK",
			"Kk.YyYyY.....kkK",
			"Kk.RRRRR.wwwwkkK",
			"Kk.RwwwR.....kkK",
			"Kk.RRRRR.wwwwkkK",
			"KkkkkkkkkkkkkkkK",
			"KKKKKKKKKKKKKKKK",
		],
		{
			K: "#202020",
			k: "#3a3a3a",
			".": "#f8f0d8",
			y: "#f8d860",
			Y: "#e8a830",
			R: "#d83028",
			w: "#c83028",
		},
	],
	menuR: [
		[
			"KKKKKKKKKKKKKKKK",
			"KkkkkkkkkkkkkkkK",
			"Kk...rr......kkK",
			"Kk..pppp..wwwkkK",
			"Kk..wwww.....kkK",
			"Kk..wppw..wwwkkK",
			"Kk...ww......kkK",
			"KkkkkkkkkkkkkkkK",
			"KKKKKKKKKKKKKKKK",
		],
		{
			K: "#202020",
			k: "#3a3a3a",
			".": "#f8f0d8",
			r: "#e04040",
			p: "#f0a0b8",
			w: "#c83028",
		},
	],
	// メイド喫茶の 黒板（ピンクの 枠に ハート）
	maidBoard: [
		[
			"PPPPPPPPPPPPPPPP",
			"PKKKKKKKKKKKKKKP",
			"PKKhhKhhKKwwwKKP",
			"PKhhhhhhhKKKKKKP",
			"PKKhhhhhKKwwwwKP",
			"PKKKhhhKKKKKKKKP",
			"PKKKKhKKKKwwwKKP",
			"PKKKKKKKKKKKKKKP",
			"PPPPPPPPPPPPPPPP",
		],
		{ P: "#f0a0c0", K: "#304038", h: "#f06080", w: "#f0f0e8" },
	],
};
const SIGN = {
	// 店先の 丸い 看板（赤い ふちに 黄色、まんなかに バーガー）。外観の 帯の 上に 重ねる
	burgerSign: [
		[
			"................",
			".....KKKKKK.....",
			"...KKRRRRRRKK...",
			"..KRRyyyyyyRRK..",
			"..KRyybbbbyyRK..",
			".KRyybwbbwbyyRK.",
			".KRyggggggggyRK.",
			".KRyymmmmmmyyRK.",
			".KRyybbbbbbyyRK.",
			"..KRyyyyyyyyRK..",
			"..KKRRRRRRRRKK..",
			"....KKKKKKKK....",
			"................",
			"................",
		],
		{
			K,
			R: "#d83028",
			y: "#f8d040",
			b: "#d89040",
			w: "#f8f0d8",
			g: "#5ab040",
			m: "#7a4020",
		},
	],
	// メイド喫茶の 看板（白い ふちの 桃色に ハート）
	heartSign: [
		[
			"................",
			".....KKKKKK.....",
			"...KKWWWWWWKK...",
			"..KWWppppppWWK..",
			"..KWpRRppRRpWK..",
			".KWpRRRRRRRRpWK.",
			".KWpRRRRRRRRpWK.",
			".KWppRRRRRRppWK.",
			".KWpppRRRRpppWK.",
			"..KWppppRRppWK..",
			"..KKWWppppWWKK..",
			"....KKKKKKKK....",
			"................",
			"................",
		],
		{ K: "#6a3048", W: "#f8f8f8", p: "#f8b0c8", R: "#e84070" },
	],
};
const SHEET = { ...FOOD, ...BOARD, ...SIGN };
const names = Object.keys(SHEET);
const SW = 16 * 16;
const SH = 16 * Math.ceil(names.length / 16);
const sheet = Buffer.alloc(SW * SH * 4);
const cells = {};
names.forEach((name, i) => {
	const [rows, pal] = SHEET[name];
	// 板の "." は 色（字の 絵の "." は ふつう 透明なので、色が あれば 置きかえる）。板は 壁の まんなかへ（下を 4行 あける）
	const ink = pal["."]
		? [
				...rows.map((r) => r.replaceAll(".", "_")),
				...Array(4).fill(".".repeat(16)),
			]
		: rows;
	const p = pal["."] ? { ...pal, _: pal["."] } : pal;
	const rgba = art(ink, p);
	const col = i % 16;
	const row = Math.floor(i / 16);
	for (let y = 0; y < 16; y++)
		rgba.copy(sheet, ((row * 16 + y) * SW + col * 16) * 4, y * 64, y * 64 + 64);
	cells[name] = [col, row];
});
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "diner.png"), encodePng(SW, SH, sheet));

// ───────────────── メイドさん（maid_walk.png） ─────────────────
// 桃色の 髪に 白い ヘッドドレス、黒い ワンピースに 白い エプロン（すそに フリル）。
const MAID = {
	K: "#201820",
	W: "#f8f8f8",
	w: "#d8d0e0",
	P: "#f090b0",
	p: "#c86888",
	S: "#f8d8c0",
	E: "#402030",
	B: "#2a2a40",
	b: "#40405a",
	R: "#e04060",
};
const M_DOWN = [
	"....KWWWWWWK....",
	"...KPWwWWwWPK...",
	"..KPPPPPPPPPPK..",
	"..KPPPPPPPPPPK..",
	"..KPSSSSSSSSPK..",
	"..KPSESSSSESPK..",
	"..KpSSSSSSSSpK..",
	"...KKSSRSSSKK...",
	"...KBBWRRWBBK...",
	"..KSBWWWWWWBSK..",
	"..KSbWWWWWWbSK..",
	"...KBWWWWWWBK...",
	"..KBBWWWWWWBBK..",
	"..KwWwWwWwWwWwK.",
];
const M_UP = [
	"....KWWWWWWK....",
	"...KPWwWWwWPK...",
	"..KPPPPPPPPPPK..",
	"..KPPPPPPPPPPK..",
	"..KPPPPPPPPPPK..",
	"..KPPPpPPpPPPK..",
	"..KpPPPPPPPPpK..",
	"...KKPPPPPPKK...",
	"...KBBBWWBBBK...",
	"..KSBBBBBBBBSK..",
	"..KSbBBWWBBbSK..",
	"...KBBBWWBBBK...",
	"..KBBBBBBBBBBK..",
	"..KwWwWwWwWwWwK.",
];
const M_RIGHT = [
	".....KWWWWWK....",
	"....KWwWWwWPK...",
	"...KPPPPPPPPK...",
	"..KPPPPPPPPPPK..",
	"..KPPPPSSSSSSK..",
	"..KPPPSSSSESSK..",
	"..KpPPSSSSSSSK..",
	"...KKPPSSSSKK...",
	"....KBBBWWRK....",
	"....KBBSWWWK....",
	"....KBbSWWWK....",
	"....KBBBWWWK....",
	"...KBBBBBWWWK...",
	"...KwWwWwWwWK...",
];
const M_FEET = ["....KSK..KSK....", "....KKK..KKK...."];
const M_FEET_B = ["...KSK....KSK...", "...KKK....KKK..."];
const M_FEET_R = [".....KSK.KSK....", ".....KKK.KKK...."];
const M_FEET_RB = ["....KSK...KSK...", "....KKK...KKK..."];
const mirror = (rows) => rows.map((r) => [...r].reverse().join(""));
{
	const W = 32;
	const H = 64;
	const buf = Buffer.alloc(W * H * 4);
	const frames = [
		[M_UP, M_FEET, M_FEET_B],
		[M_RIGHT, M_FEET_R, M_FEET_RB],
		[M_DOWN, M_FEET, M_FEET_B],
		[mirror(M_RIGHT), mirror(M_FEET_R), mirror(M_FEET_RB)],
	];
	frames.forEach(([body, f1, f2], row) => {
		for (const [col, feet] of [
			[0, f1],
			[1, f2],
		]) {
			const img = art([...body, ...feet], MAID);
			for (let y = 0; y < 16; y++)
				img.copy(buf, ((row * 16 + y) * W + col * 16) * 4, y * 64, y * 64 + 64);
		}
	});
	writeFileSync(join(OUT, "maid_walk.png"), encodePng(W, H, buf));
}

// ───────────────── 表（dinerSheet.ts） ─────────────────
const ts = `// scripts/make-diner.mjs が 書き出す（手で 書きかえない。絵を かえる ときは make-diner.mjs）。
// バーガー屋「ワイバーガー」と メイド喫茶「メイドの土産」の 手描きの 絵（data/village/eateries.ts・data/town/eateries.ts）。

/** 品と 品書きの 板（public/sprites/diner.png。${SW}x${SH}）。 */
export const DINER_IMG = "pub:sprites/diner.png";
export const DINER_SIZE = [${SW}, ${SH}] as const;

/** 絵の 名前 → [列, 行]（16x16 の マス）。 */
export const DINER_CELLS = {
${names.map((n) => `\t${n}: [${cells[n][0]}, ${cells[n][1]}],`).join("\n")}
} as const;

export type DinerName = keyof typeof DINER_CELLS;

/** 絵（16x16）。 */
export const diner = (name: DinerName): string => {
\tconst [c, r] = DINER_CELLS[name];
\treturn \`\${DINER_IMG}#\${c * 16},\${r * 16},16,16\`;
};

/** メイドさんの 歩行グラ（手描き。32x64）。 */
export const MAID_WALK = "pub:sprites/maid_walk.png";
`;
writeFileSync(TS_OUT, ts);
console.log(
	`wrote diner.png (${SW}x${SH}, ${names.length} cells), maid_walk.png, ${TS_OUT}`,
);
