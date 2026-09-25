// 道具の見た目（床・持ち物の 16×16）を書き出す（node scripts/make-items.mjs）。
//
// src/ui/itemArt.ts のドット（1文字1ドットの行と 色の表）を、1つ1枚の PNG にして public/sprites/items/ へ置く。
// あわせて 見くらべ用の 拡大した一覧（--sheet <出力先.png>）も作れる。
//
//   node scripts/make-items.mjs                    … ぜんぶ
//   node scripts/make-items.mjs herb,scroll        … 指定したものだけ
//   node scripts/make-items.mjs --sheet out.png    … ぜんぶを 8倍で 横に並べた一覧も書く（明るい床・暗い床の2段）
//
// 依存なし（zlib だけ）。Vite の SSR で TS のまま読み込む。

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { createServer } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/sprites/items");

// ───────────────── 最小 PNG（make-equip.mjs と同じ） ─────────────────

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
	const m = /^#([0-9a-f]{6})$/i.exec(c);
	if (!m) throw new Error(`色が読めません: ${c}`);
	const n = Number.parseInt(m[1], 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
};

const args = process.argv.slice(2);
const sheetAt = args.indexOf("--sheet");
const sheet = sheetAt >= 0 ? args[sheetAt + 1] : null;
const only = args
	.filter((a, i) => !a.startsWith("--") && i !== sheetAt + 1)
	.flatMap((a) => a.split(","))
	.filter(Boolean);

const server = await createServer({
	root: ROOT,
	server: { middlewareMode: true, hmr: false, ws: false },
	appType: "custom",
	logLevel: "error",
	optimizeDeps: { noDiscovery: true, include: [] },
});

try {
	const { ITEM_ART, ICON_SIZE: S } = await server.ssrLoadModule(
		"/src/ui/itemArt.ts",
	);
	const names = Object.keys(ITEM_ART).filter(
		(n) => !only.length || only.includes(n),
	);
	mkdirSync(OUT, { recursive: true });
	const pixels = {};
	for (const name of names) {
		const { rows, palette } = ITEM_ART[name];
		if (rows.length !== S || rows.some((r) => [...r].length !== S))
			throw new Error(`${name}: ${S}×${S} ではありません`);
		const buf = Buffer.alloc(S * S * 4);
		rows.forEach((row, y) => {
			[...row].forEach((ch, x) => {
				if (ch === "." || ch === " ") return;
				const c = palette[ch];
				if (!c) throw new Error(`${name}: 色の無い文字 ${ch}`);
				const [r, g, b, a] = hex(c);
				const i = (y * S + x) * 4;
				buf[i] = r;
				buf[i + 1] = g;
				buf[i + 2] = b;
				buf[i + 3] = a;
			});
		});
		pixels[name] = buf;
		writeFileSync(join(OUT, `${name}.png`), encodePng(S, S, buf));
		console.log(`${name}.png`);
	}
	if (sheet) {
		// 8倍・1つ 20マス（すき間4）。上の段は 明るい床、下の段は 暗い床の上に置いて 見くらべる
		const Z = 8;
		const cell = (S + 4) * Z;
		const W = cell * names.length;
		const H = cell * 2;
		const out = Buffer.alloc(W * H * 4);
		const floors = [
			[0x8a, 0x7a, 0x5c],
			[0x22, 0x26, 0x33],
		];
		for (let y = 0; y < H; y++)
			for (let x = 0; x < W; x++) {
				const f = floors[y < cell ? 0 : 1];
				const i = (y * W + x) * 4;
				out[i] = f[0];
				out[i + 1] = f[1];
				out[i + 2] = f[2];
				out[i + 3] = 255;
			}
		names.forEach((name, n) => {
			const buf = pixels[name];
			for (const band of [0, 1])
				for (let y = 0; y < S; y++)
					for (let x = 0; x < S; x++) {
						const si = (y * S + x) * 4;
						if (!buf[si + 3]) continue;
						for (let dy = 0; dy < Z; dy++)
							for (let dx = 0; dx < Z; dx++) {
								const px = n * cell + 2 * Z + x * Z + dx;
								const py = band * cell + 2 * Z + y * Z + dy;
								const i = (py * W + px) * 4;
								out[i] = buf[si];
								out[i + 1] = buf[si + 1];
								out[i + 2] = buf[si + 2];
								out[i + 3] = 255;
							}
					}
		});
		writeFileSync(sheet, encodePng(W, H, out));
		console.log(`一覧: ${sheet}（左から ${names.join(" / ")}）`);
	}
} finally {
	await server.close();
}
