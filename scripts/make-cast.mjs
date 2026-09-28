// 村の キャストの 歩行グラを書き出す（node scripts/make-cast.mjs）。
//
// 公式の絵は使わず、設定（見た目の特ちょう）だけを借りて ドットを自作する。
// 革命シヨ・解音ゼロの 歩行グラは RPGEN に 投入されたので、そちらを 参照する（src/data/cast.ts）。
//   リノ … 春音リノ（おんJ生まれの UTAU。村の 住人。ここでは 歩行グラだけ 描き、立ち絵は 作者が 描く。ART_TODO.md）。
//          カーキの 軍帽と 軍服、メタリックな 銀紫の 髪、銃みたいな コッペパン。
//   アル … 響化アル（おーぷん2ch 有志の UTAU。18歳・科学部。村の 住人。ここでは 歩行グラだけ）。
//          長めの マッシュの 髪、白衣（ポケットに 試験管）。
//
// 歩行グラは RPGEN の形：32x64・16x16 のマスが 2コマ×4段（上＝背中・右・下＝正面・左）、背景は透明、足もとを下にそろえる。
// 1文字が1ドット：'.' は透明、ほかの文字は palette の色（src/ui/itemArt.ts と同じ書き方）。
// 左向きは 右向きを 左右反転して作る。2コマ目は 足（と 揺れる髪）の行だけを差しかえる。
//
//   node scripts/make-cast.mjs                    … public/sprites/{rino,aru}.png
//   node scripts/make-cast.mjs rino               … 指定したものだけ
//   node scripts/make-cast.mjs --sheet out.png    … 歩行グラを 8倍で並べた 見くらべ用の一覧も書く（草・石の床の2段）
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
	// 春音リノ：カーキの 軍帽（金の 帽章）と 軍服、メタリックな 銀紫の 髪（アバンギャルドメタリック）、きつい目。
	// 小物は 銃みたいな コッペパン（横向きでは 銃のように 前へ 構える）。立ち絵は ここでは 作らない（ART_TODO.md）。
	rino: {
		palette: {
			o: "#2a2418", // ふち
			K: "#9c9a5a", // カーキ（軍帽・軍服）
			c: "#4a4a2c", // 帽子の 帯・襟
			b: "#e8c040", // 帽章・ボタン
			M: "#a8a0c8", // 銀紫の 髪
			H: "#eeeaff", // 髪の 照り
			m: "#6a6090", // 髪の 影
			s: "#f6d8c0", // 肌
			e: "#3a2a3a", // 目
			B: "#4a3a24", // ベルト
			P: "#d89a4a", // コッペパン
			Q: "#f4c47a", // パンの 照り
			p: "#a8682a", // パンの 影
			l: "#26241e", // 長靴
		},
		frames: {
			up: [
				"....oooooooo....",
				"...oKKKKKKKKo...",
				"..oKKKKKKKKKKo..",
				"..occcccccccco..",
				".oMMMMMMMMMMMMo.",
				".oMHMMMMMMMMHMo.",
				".oMMMMMMMMMMMMo.",
				".omMMMMMMMMMMmo.",
				"..omMMMMMMMMmo..",
				".oKoKKKKKKKKoKo.",
				".oKKKKKKKKKKKKo.",
				"oKsKKKKKKKKKsPPo",
				".oBBBBBBBBBBBBo.",
				"..oKKKKKKKKKKo..",
				"..oKKKKooKKKKo..",
				"...olll..lllo...",
			],
			right: [
				".....oooooooo...",
				"....oKKKKKKKKo..",
				"....oKKKKKKKbKo.",
				"....occcccccccco",
				"...ooooooooooooo",
				"..oMMMMMHsssssso",
				"..oMMMMMssssesso",
				"..oMMMMmssssssso",
				"..oMMmmossssooo.",
				"...oMoKKccKKo...",
				"...oKKKKKKKKKo..",
				"...oKKKsQQQQQQQo",
				"...oKBBBpPPPPPpo",
				"...oKKKKKKKKo...",
				"...oKKKKKKKKo...",
				".....oll.oll....",
			],
			down: [
				"....oooooooo....",
				"...oKKKKKKKKo...",
				"..oKKKKbbKKKKo..",
				"..occcccccccco..",
				".oooooooooooooo.",
				".oMHssssssssHMo.",
				".oMssessssessMo.",
				".oMssssoossssMo.",
				".oMmoossssoomMo.",
				".oMoKKKccKKKoMo.",
				"oQQQQQQQoKKbKKo.",
				"oPPPPPPPpKKKsKo.",
				".oopppppoBBBBBo.",
				"..oKKKKKKKKKKo..",
				"..oKKKKooKKKKo..",
				"...olll..lllo...",
			],
		},
		step: {
			up: { 15: "..olll....lllo.." },
			right: { 14: "...oKKKKKKKKKo..", 15: "....oll...oll..." },
			down: { 15: "..olll....lllo.." },
		},
	},
	// 響化アル：18歳の 男の子。長めの マッシュの 髪（こげ茶）、科学部の 白衣（ポケットに 試験管）、青い シャツ。
	// 立ち絵は ここでは 作らない（ART_TODO.md）。
	aru: {
		palette: {
			o: "#231c1c", // ふち
			A: "#5a4638", // 髪（こげ茶）
			H: "#8a6e58", // 髪の 照り
			a: "#3a2c24", // 髪の 影
			s: "#fbe0cc", // 肌
			e: "#2a2230", // 目
			r: "#c8705e", // 口
			W: "#f4f6fa", // 白衣
			w: "#c4cad8", // 白衣の 影
			c: "#5a7cc0", // シャツ
			t: "#6ee0c0", // 試験管
			n: "#3a3e52", // ズボン
			l: "#2a2626", // 靴
		},
		frames: {
			up: [
				"....oooooooo....",
				"...oAAHHAAAAo...",
				"..oAAAAAAAAAAo..",
				".oAAAHAAAAAAAAo.",
				".oAAAAAAAAAAAAo.",
				".oAAAAAAAAAAAAo.",
				".oAAAAAAAAAAAAo.",
				".oaAAAAAAAAAAao.",
				"..oaaAAAAAAaao..",
				"..oWWWWWWWWWWo..",
				".oWWWWWWWWWWWWo.",
				".oWsWWWWWWWWsWo.",
				".owWWWWWWWWWWwo.",
				"..owWWWWWWWWwo..",
				"...onnnoonnno...",
				"...olll..lllo...",
			],
			right: [
				".....oooooooo...",
				"....oAAAHHAAAo..",
				"...oAAAAAAAAAAo.",
				"..oAAAAAAAAAAAAo",
				"..oAAAAAAAAAAAAo",
				"..oAAAAAAaaaaaao",
				"..oAAAAAAsssesso",
				"..oAAAAAssssssso",
				"...oAAAosssrsso.",
				"....oWWoccWo....",
				"....oWWWWcWWo...",
				"....oWWWsWtWo...",
				"....owWWWWWwo...",
				"....owWWWWWwo...",
				"....onnnnnnno...",
				".....oll.oll....",
			],
			down: [
				"....oooooooo....",
				"...oAAHHAAAAo...",
				"..oAAAAAAAAAAo..",
				".oAAAAAAAAAAAAo.",
				".oAAAAAAAAAAAAo.",
				".oAaaaaaaaaaaAo.",
				".oAssessssessAo.",
				".oAssssrrssssAo.",
				"..oAossssssoAo..",
				"..oWWWoccoWWWo..",
				".oWWWWWccWWWWWo.",
				".oWsWWWccWWtsWo.",
				".owWWWWccWWWWwo.",
				"..owWWWnnWWWwo..",
				"...onnnoonnno...",
				"...olll..lllo...",
			],
		},
		step: {
			up: { 15: "..olll....lllo.." },
			right: { 14: "...onnnnnnnno...", 15: "....oll...oll..." },
			down: { 15: "..olll....lllo.." },
		},
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
const names = (argv.filter((a) => !a.startsWith("--"))[0]?.split(",") ?? Object.keys(CAST)).filter(Boolean);

mkdirSync(join(ROOT, "public/sprites"), { recursive: true });
for (const name of names) {
	if (!CAST[name]) throw new Error(`「${name}」は無い（${Object.keys(CAST).join(", ")}）`);
	const { w, h, buf } = sheetOf(name);
	writeFileSync(join(ROOT, `public/sprites/${name}.png`), encodePng(w, h, buf));
	console.log(`public/sprites/${name}.png`);
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
