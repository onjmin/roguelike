// 村の キャストの 歩行グラと 仮の立ち絵を書き出す（node scripts/make-cast.mjs）。
//
// 革命シヨ（倉庫番）と 解音ゼロ（帳簿）。どちらも おーぷん2ちゃんねる（おんJ）生まれの 音声合成キャラで、
// 公式の絵は使わず、設定（見た目の特ちょう）だけを借りて ドットを自作する。
//   シヨ … 金髪の ポニーテール・メイド服・猫耳カチューシャ・丸眼鏡・赤い目
//   ゼロ … 束音ロゼの 特ちょうを反転して生まれた アンドロイド。
//          黒髪→うすい金髪（ボリューム多め）、中華風→白と青の和装、厚着・スリム、関節が機械。
//          ロゼの 赤・ピンクの差し色は 青・水色に反転し、耳には 機械の イヤーパーツ。
//
// 歩行グラは RPGEN の形：32x64・16x16 のマスが 2コマ×4段（上＝背中・右・下＝正面・左）、背景は透明、足もとを下にそろえる。
// 1文字が1ドット：'.' は透明、ほかの文字は palette の色（src/ui/itemArt.ts と同じ書き方）。
// 左向きは 右向きを 左右反転して作る。2コマ目は 足（と 揺れる髪）の行だけを差しかえる。
//
// 立ち絵（public/portraits/<名前>.png・1024x1024・右向き・透明）は、本人が描くまでの 仮の シルエット。
// 色と 形の目じるし（シヨ＝ポニテ・猫耳・眼鏡、ゼロ＝髪のボリューム・イヤーパーツ・和装）だけを置き、すみに「仮」を入れる。
//
//   node scripts/make-cast.mjs                    … public/sprites/{shiyo,zero}.png と public/portraits/{shiyo,zero}.png
//   node scripts/make-cast.mjs shiyo              … 指定したものだけ
//   node scripts/make-cast.mjs --sheet out.png    … 歩行グラを 8倍で並べた 見くらべ用の一覧も書く（草・石の床の2段）
//   node scripts/make-cast.mjs --no-portrait      … 立ち絵は書かない
//
// 依存なし（zlib だけ）。

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ───────────────── 最小 PNG（make-items.mjs と同じ） ─────────────────

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

const hex = (c) => {
	const n = Number.parseInt(c.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// ───────────────── ドット ─────────────────
//
// frames: up / right / down の 1コマ目（16行）。step: 2コマ目で 差しかえる行（行番号 → 行）。

const CAST = {
	// 革命シヨ：金髪ポニテ＋黒い猫耳カチューシャ、丸眼鏡に赤い目、紺のメイド服に白いエプロンと赤いリボン。
	shiyo: {
		palette: {
			o: "#2a1c24", // ふち
			k: "#3c3444", // 猫耳（カチューシャ）
			p: "#f49ac1", // 猫耳の内側
			Y: "#f6d25a", // 金髪
			H: "#fff2a8", // 髪の照り
			y: "#c9942c", // 髪の影
			s: "#ffe2cc", // 肌
			g: "#7c86a8", // 眼鏡のふち
			r: "#e0302a", // 赤い目
			W: "#ffffff", // エプロン・襟
			w: "#d4d8e6", // エプロンの影
			R: "#e8483f", // リボン・髪ゴム
			m: "#34345a", // メイド服
			l: "#1e1a26", // 靴
		},
		frames: {
			up: [
				".oo..........oo.",
				".opkooooooookpo.",
				".okYYYYYYYYYYko.",
				"oYYYYHYYYYHYYYYo",
				"oYYYYYYYYYYYYYYo",
				"oYYYYYoRRoYYYYYo",
				"oYyYYYoYHoYYYyYo",
				"oYyYYoYYYYoYYyYo",
				"oYyyYoYHYYoYyyYo",
				".oyyyoYYYyoyyyo.",
				".ooooyYYYyooooo.",
				"..ommmoYyommmo..",
				"..osmmoyyommso..",
				"..oomWWooWWmoo..",
				"..ommmmmmmmmmo..",
				"....oll..llo....",
			],
			right: [
				"....oo....oo....",
				"...opkooooopko..",
				"...oYYYYYYYYYYo.",
				"..oYYYYYYYHHYYYo",
				".oRYYYYYYYYYYYYo",
				"oYRoYYYYYyYsssYo",
				"oYYoYYYYYssggggo",
				"oYyoYYYYysgWrgso",
				"oYyooYYYYsggggso",
				".oyyoyYYYsssssmo",
				".oyyooyYooooooo.",
				"..oyoomWWRRomo..",
				"...oommWWWsomo..",
				"...ommmmWWWWmo..",
				"...ommmmmmmmmo..",
				".....oll.oll....",
			],
			down: [
				".oo..........oo.",
				".opkooooooookpo.",
				".okYYYHHYYYYYko.",
				"oYYYYHYYYYYYYYYo",
				"oYYyYYYYYYYYyYYo",
				"oYYosyssssyssYYo",
				"oYYogggssgggoYYo",
				"oYYogrWggWrgoYYo",
				"oYYogggssgggoYYo",
				".oYossssmsssoYo.",
				".oYyooooooooyYo.",
				"..oYomWRRWmoYo..",
				"..osmWWWWWWmso..",
				"..oomWWWWWWmoo..",
				"..ommmWWWWmmmo..",
				"....oll..llo....",
			],
		},
		step: {
			up: { 15: "...oll....llo..." },
			right: { 14: "...ommmmmmmmmmo.", 15: "....oll...oll..." },
			down: { 15: "...oll....llo..." },
		},
		portrait: "shiyo",
	},

	// 解音ゼロ：うすい金髪を たっぷり、耳に 青い イヤーパーツ、水色の目。白い着物に 青い襟と帯、紺の袴。
	// 手首は 銀の 機械の関節。
	zero: {
		palette: {
			o: "#1c2a44", // ふち（ロゼと同じ 紺系で そろえる）
			P: "#f3e2a2", // うすい金髪
			H: "#fffbe6", // 髪の照り
			p: "#c4ae6a", // 髪の影
			s: "#fde6d8", // 肌
			k: "#3a4a6a", // まつげ
			e: "#3ec8f0", // 水色の目
			m: "#c06868", // 口
			b: "#2f7fd8", // イヤーパーツ・襟・帯（ロゼの 赤の反転）
			c: "#a9b6c8", // 機械の関節（銀）
			W: "#ffffff", // 着物
			w: "#c8d2e4", // 着物の影
			n: "#27407a", // 袴
			l: "#4a4450", // 草履
		},
		frames: {
			up: [
				".....oooooo.....",
				"...ooPPPPPPoo...",
				"..oPPPPHHPPPPo..",
				".oPPPHPPPPPPPPo.",
				".oPPPPPPPPPPPPo.",
				"bPPPPPPPPPPPPPPb",
				"bPPpPPPPPPPPpPPb",
				"bPPpPPPPPPPPpPPb",
				"oPPpPPpPPpPPpPPo",
				"oPpPPPpPPpPPPpPo",
				"oPpPPpPPPPpPPpPo",
				"ocpPpPpPPpPpPpco",
				".oWpWpWppWpWpWo.",
				".obbbbbbbbbbbbo.",
				"..onnnnnnnnnno..",
				"....oll..llo....",
			],
			right: [
				"......oooooo....",
				"....ooPPPPPPoo..",
				"...oPPPPPHHPPPo.",
				"..oPPPPPPPPPPPPo",
				".oPPPPPPPPPPPPPo",
				".oPPPPPPPPsPPsPo",
				"oPPPPbPPPsskksso",
				"oPPPbcbPPsseesso",
				"oPPPPbPPPsssssso",
				"oPpPPPPPPssssmso",
				"oPpPPPPPPoooooo.",
				"oPpPPPoWWbbWo...",
				"oPpPPoWWWWbWco..",
				".oppoobbbbbbbo..",
				"...onnnnnnnnno..",
				".....oll.oll....",
			],
			down: [
				".....oooooo.....",
				"...ooPPPPPPoo...",
				"..oPPPPHHPPPPo..",
				".oPPPHPPPPPPPPo.",
				".oPPPPPPPPPPPPo.",
				"bPPoPsPPPPsPoPPb",
				"bPPoskksskksoPPb",
				"bPPoseesseesoPPb",
				"oPPossssssssoPPo",
				"oPposssmmsssopPo",
				".oPoWWbssbWWoPo.",
				"oPoWWWWbbWWWWoPo",
				"oPcobbbbbbbbocPo",
				".oPonnnnnnnnoPo.",
				"..onnnnnnnnnno..",
				"....oll..llo....",
			],
		},
		step: {
			up: { 15: "...oll....llo..." },
			right: { 14: "..onnnnnnnnnnno.", 15: "....oll...oll..." },
			down: { 15: "...oll....llo..." },
		},
		portrait: "zero",
	},
};

const CELL = 16;
const ORDER = ["up", "right", "down", "left"];

const mirror = (rows) => rows.map((r) => [...r].reverse().join(""));

// 名前 → 8コマ（[段][コマ] の 行の配列）
const framesOf = (name) => {
	const def = CAST[name];
	const two = (dir) => {
		const a = def.frames[dir];
		const b = a.map((row, i) => def.step[dir]?.[i] ?? row);
		return [a, b];
	};
	const [ra, rb] = two("right");
	const table = { up: two("up"), right: [ra, rb], down: two("down"), left: [mirror(ra), mirror(rb)] };
	for (const dir of ORDER)
		for (const rows of table[dir]) {
			if (rows.length !== CELL) throw new Error(`${name}/${dir}: ${rows.length} 行`);
			rows.forEach((r, i) => {
				if (r.length !== CELL) throw new Error(`${name}/${dir} ${i}行目: ${r.length} 文字「${r}」`);
				for (const ch of r)
					if (ch !== "." && !def.palette[ch]) throw new Error(`${name}/${dir} ${i}行目: 色「${ch}」が無い`);
			});
		}
	return ORDER.map((dir) => table[dir]);
};

const sheetOf = (name) => {
	const pal = Object.fromEntries(Object.entries(CAST[name].palette).map(([k, v]) => [k, hex(v)]));
	const W = CELL * 2;
	const H = CELL * 4;
	const buf = Buffer.alloc(W * H * 4);
	framesOf(name).forEach((pair, row) =>
		pair.forEach((rows, col) =>
			rows.forEach((line, y) =>
				[...line].forEach((ch, x) => {
					if (ch === ".") return;
					const o = ((row * CELL + y) * W + col * CELL + x) * 4;
					const [r, g, b] = pal[ch];
					buf[o] = r;
					buf[o + 1] = g;
					buf[o + 2] = b;
					buf[o + 3] = 255;
				}),
			),
		),
	);
	return { w: W, h: H, buf };
};

// ───────────────── 仮の立ち絵（1024x1024・右向き） ─────────────────
//
// 4倍で塗ってから 平均して縮める（ふちを なめらかに）。図形は 1024 の座標で書く。

const P = 1024;
const SS = 4;

const makeCanvas = () => {
	const N = P * SS;
	const px = new Uint8ClampedArray(N * N * 4);
	const fill = (inside, color, alpha = 255) => {
		const [r, g, b] = hex(color);
		for (let y = 0; y < N; y++) {
			const fy = (y + 0.5) / SS;
			for (let x = 0; x < N; x++) {
				if (!inside((x + 0.5) / SS, fy)) continue;
				const o = (y * N + x) * 4;
				const a = alpha / 255;
				const da = px[o + 3] / 255;
				const oa = a + da * (1 - a);
				px[o] = (r * a + px[o] * da * (1 - a)) / oa;
				px[o + 1] = (g * a + px[o + 1] * da * (1 - a)) / oa;
				px[o + 2] = (b * a + px[o + 2] * da * (1 - a)) / oa;
				px[o + 3] = oa * 255;
			}
		}
	};
	const out = () => {
		const buf = Buffer.alloc(P * P * 4);
		for (let y = 0; y < P; y++)
			for (let x = 0; x < P; x++) {
				let r = 0;
				let g = 0;
				let b = 0;
				let a = 0;
				for (let j = 0; j < SS; j++)
					for (let i = 0; i < SS; i++) {
						const o = ((y * SS + j) * N + x * SS + i) * 4;
						const pa = px[o + 3];
						r += px[o] * pa;
						g += px[o + 1] * pa;
						b += px[o + 2] * pa;
						a += pa;
					}
				const o = (y * P + x) * 4;
				if (a) {
					buf[o] = r / a;
					buf[o + 1] = g / a;
					buf[o + 2] = b / a;
				}
				buf[o + 3] = a / (SS * SS);
			}
		return buf;
	};
	return { fill, out };
};

// 図形（点が内側か）。grow でふち用に ふくらませる。
const ellipse =
	(cx, cy, rx, ry, grow = 0) =>
	(x, y) =>
		((x - cx) / (rx + grow)) ** 2 + ((y - cy) / (ry + grow)) ** 2 <= 1;
const poly = (pts, grow = 0) => {
	// 凸でなくてもよい（偶奇）。grow は 重心から外へ おおよそ ずらす。
	const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
	const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
	const q = pts.map(([x, y]) => {
		const d = Math.hypot(x - cx, y - cy) || 1;
		return [x + ((x - cx) / d) * grow, y + ((y - cy) / d) * grow];
	});
	return (x, y) => {
		let inside = false;
		for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
			const [xi, yi] = q[i];
			const [xj, yj] = q[j];
			if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
		}
		return inside;
	};
};
const ring = (cx, cy, r, w) => (x, y) => {
	const d = Math.hypot(x - cx, y - cy);
	return d <= r && d >= r - w;
};

// 「仮」（11×11 の ドット字）
const KARI = [
	"..#........",
	"..#.######.",
	".#..#......",
	".#..#......",
	"##..######.",
	".#..##...#.",
	".#..#.#.#..",
	".#..#..#...",
	".#..#.#.#..",
	".#.#.#...#.",
	".#.........",
];
const stamp = (fill, x0, y0, size, color, alpha) => {
	fill((x, y) => {
		const i = Math.floor((x - x0) / size);
		const j = Math.floor((y - y0) / size);
		return j >= 0 && j < KARI.length && i >= 0 && i < KARI[0].length && KARI[j][i] === "#";
	}, color, alpha);
};

// 形を ふち付きで塗る（ふち → 中）
const LINE = 7;
const shape = (fill, make, color, edge) => {
	fill(make(LINE), edge);
	fill(make(0), color);
};

const PORTRAITS = {
	// シヨ：右向き。うしろ（左）に ポニテ、猫耳、丸眼鏡、メイド服＋エプロン。
	shiyo: (fill) => {
		const E = "#2a1c24";
		const pal = CAST.shiyo.palette;
		// ポニテ（頭のうしろから 左下へ）
		shape(fill, (g) => poly([[430, 300], [330, 330], [290, 460], [300, 600], [350, 560], [380, 440], [450, 360]], g), pal.Y, E);
		// 体（メイド服）
		shape(fill, (g) => poly([[440, 450], [600, 450], [650, 760], [390, 760]], g), pal.m, E);
		// エプロン
		shape(fill, (g) => poly([[470, 520], [590, 520], [615, 740], [450, 740]], g), pal.W, E);
		// 襟と リボン
		shape(fill, (g) => poly([[470, 440], [570, 440], [545, 480], [495, 480]], g), pal.W, E);
		shape(fill, (g) => ellipse(520, 470, 22, 16, g), pal.R, E);
		// 脚
		shape(fill, (g) => poly([[470, 760], [505, 760], [500, 860], [465, 860]], g), pal.l, E);
		shape(fill, (g) => poly([[540, 760], [575, 760], [585, 860], [548, 860]], g), pal.l, E);
		// 猫耳
		shape(fill, (g) => poly([[430, 250], [440, 170], [495, 225]], g), pal.k, E);
		shape(fill, (g) => poly([[545, 215], [600, 160], [610, 250]], g), pal.k, E);
		// 頭（髪）と 顔
		shape(fill, (g) => ellipse(520, 320, 115, 115, g), pal.Y, E);
		shape(fill, (g) => poly([[520, 300], [630, 290], [620, 400], [560, 430], [520, 400]], g), pal.s, E);
		// 前髪
		shape(fill, (g) => poly([[440, 230], [600, 225], [635, 300], [560, 290], [520, 320], [470, 300]], g), pal.Y, E);
		// 丸眼鏡と 赤い目
		fill(ring(590, 345, 30, 7), pal.g);
		fill(ellipse(595, 345, 9, 13), pal.r);
		// ポニテの ゴム
		shape(fill, (g) => ellipse(430, 305, 18, 18, g), pal.R, E);
		stamp(fill, 760, 820, 14, "#8a8a9a", 150);
	},
	// ゼロ：右向き。たっぷりの うすい金髪（うしろへ長く）、耳の イヤーパーツ、白い着物に 青い帯、紺の袴。
	zero: (fill) => {
		const E = "#1c2a44";
		const pal = CAST.zero.palette;
		// うしろ髪（長く 多い）
		shape(fill, (g) => poly([[430, 250], [380, 400], [360, 620], [400, 720], [470, 700], [470, 420]], g), pal.P, E);
		// 袴
		shape(fill, (g) => poly([[440, 610], [600, 610], [640, 850], [410, 850]], g), pal.n, E);
		// 着物（上）
		shape(fill, (g) => poly([[450, 440], [590, 440], [615, 620], [430, 620]], g), pal.W, E);
		// 袖
		shape(fill, (g) => poly([[560, 470], [650, 520], [640, 610], [585, 600]], g), pal.W, E);
		// 手首の 機械の関節
		shape(fill, (g) => ellipse(640, 620, 18, 14, g), pal.c, E);
		// 襟（青）と 帯
		shape(fill, (g) => poly([[500, 440], [560, 440], [530, 520]], g), pal.b, E);
		shape(fill, (g) => poly([[432, 590], [612, 590], [615, 635], [430, 635]], g), pal.b, E);
		// 頭
		shape(fill, (g) => ellipse(520, 320, 120, 118, g), pal.P, E);
		shape(fill, (g) => poly([[530, 300], [635, 290], [625, 400], [565, 430], [530, 400]], g), pal.s, E);
		// 前髪
		shape(fill, (g) => poly([[430, 240], [600, 215], [645, 300], [570, 280], [535, 320], [480, 300]], g), pal.P, E);
		// イヤーパーツ
		shape(fill, (g) => ellipse(500, 345, 30, 38, g), pal.b, E);
		fill(ellipse(500, 345, 12, 16), pal.c);
		// 水色の目
		fill(ellipse(598, 345, 10, 15), pal.e);
		stamp(fill, 760, 820, 14, "#8a8a9a", 150);
	},
};

// ───────────────── 書き出し ─────────────────

const argv = process.argv.slice(2);
const flag = (f) => {
	const i = argv.indexOf(f);
	if (i < 0) return null;
	const v = argv[i + 1];
	argv.splice(i, 2);
	return v;
};
const sheetPath = flag("--sheet");
const noPortrait = argv.includes("--no-portrait");
const names = (argv.filter((a) => !a.startsWith("--"))[0]?.split(",") ?? Object.keys(CAST)).filter(Boolean);

mkdirSync(join(ROOT, "public/sprites"), { recursive: true });
mkdirSync(join(ROOT, "public/portraits"), { recursive: true });
for (const name of names) {
	if (!CAST[name]) throw new Error(`「${name}」は無い（${Object.keys(CAST).join(", ")}）`);
	const { w, h, buf } = sheetOf(name);
	writeFileSync(join(ROOT, `public/sprites/${name}.png`), encodePng(w, h, buf));
	console.log(`public/sprites/${name}.png`);
	if (!noPortrait) {
		const cv = makeCanvas();
		PORTRAITS[CAST[name].portrait](cv.fill);
		writeFileSync(join(ROOT, `public/portraits/${name}.png`), encodePng(P, P, cv.out()));
		console.log(`public/portraits/${name}.png`);
	}
}

// 見くらべ用：8倍、上の段は草、下の段は石の床。キャストごとに 8コマを横に並べる。
if (sheetPath) {
	const K = 8;
	const GAP = 8;
	const grounds = [
		["#5f9a3e", "#6aa846"],
		["#6e6a66", "#7c7874"],
	];
	const sheets = names.map(sheetOf);
	const cellW = CELL * K;
	const W = names.length * (8 * cellW + GAP) - GAP;
	const H = grounds.length * CELL * K;
	const out = Buffer.alloc(W * H * 4);
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) {
			const [a, b] = grounds[Math.floor(y / (CELL * K))].map(hex);
			const c = (Math.floor(x / (K * 2)) + Math.floor(y / (K * 2))) & 1 ? a : b;
			const o = (y * W + x) * 4;
			out[o] = c[0];
			out[o + 1] = c[1];
			out[o + 2] = c[2];
			out[o + 3] = 255;
		}
	sheets.forEach(({ w, buf }, n) => {
		const ox = n * (8 * cellW + GAP);
		for (let g = 0; g < grounds.length; g++)
			for (let f = 0; f < 8; f++) {
				const sx = (f % 2) * CELL;
				const sy = Math.floor(f / 2) * CELL;
				for (let y = 0; y < CELL * K; y++)
					for (let x = 0; x < CELL * K; x++) {
						const s = ((sy + Math.floor(y / K)) * w + sx + Math.floor(x / K)) * 4;
						if (!buf[s + 3]) continue;
						const o = ((g * CELL * K + y) * W + ox + f * cellW + x) * 4;
						buf.copy(out, o, s, s + 3);
					}
			}
	});
	writeFileSync(sheetPath, encodePng(W, H, out));
	console.log(sheetPath);
}
