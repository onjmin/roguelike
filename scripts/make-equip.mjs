// 装備（武器・盾）の透過素材を書き出す（node scripts/make-equip.mjs）。
//
// src/ui/equipArt.ts の下描きを、1種類1枚の PNG（200×320）にして public/sprites/equip/ へ置く。
// 並びは src/ui/equip.ts の先頭のコメントのとおり（列：足踏み2つ＋攻撃の3つの形、行：前4＋うしろ4）。
//
//   node scripts/make-equip.mjs              … ぜんぶ
//   node scripts/make-equip.mjs steel,bronze … 指定した種類だけ
//
// 作者が描き直した PNG は、ここで書き出すと上書きされる。描き直した種類は指定から外すこと。
// 依存なし（zlib だけ）。Vite の SSR で TS のまま読み込む。

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { createServer } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/sprites/equip");

// ───────────────── 最小 PNG（RGBA 8bit・非インターレース。rpg の make-sprites.mjs と同じ） ─────────────────

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

const server = await createServer({
	root: ROOT,
	server: { middlewareMode: true, hmr: false, ws: false },
	appType: "custom",
	logLevel: "error",
	optimizeDeps: { noDiscovery: true, include: [] },
});

try {
	const art = await server.ssrLoadModule("/src/ui/equipArt.ts");
	const eq = await server.ssrLoadModule("/src/ui/equip.ts");
	const { EQUIP_CELL: CELL, EQUIP_OX: OX, EQUIP_OY: OY } = eq;
	const W = CELL * eq.EQUIP_COLS;
	const H = CELL * eq.EQUIP_ROWS;
	const only = process.argv[2]?.split(",").filter(Boolean);
	const jobs = [
		...art.WEAPON_KINDS.map((k) => ({
			kind: k,
			look: { weapon: k, shield: null },
		})),
		...art.SHIELD_KINDS.map((k) => ({
			kind: k,
			look: { weapon: null, shield: k },
		})),
	].filter((j) => !only || only.includes(j.kind));
	mkdirSync(OUT, { recursive: true });
	for (const { kind, look } of jobs) {
		const buf = Buffer.alloc(W * H * 4);
		let clipped = 0;
		for (const [layer, base] of [
			["over", 0],
			["under", 4],
		])
			for (const [dir, r] of Object.entries(eq.DIR_ROW))
				for (let col = 0; col < eq.EQUIP_COLS; col++) {
					const frame = col < 2 ? col : 0;
					const swing = col < 2 ? -1 : eq.SWING_POSES[col - 2];
					const cx = col * CELL;
					const cy = (base + r) * CELL;
					art.paintEquip(
						(x, y, c) => {
							const px = OX + x;
							const py = OY + y;
							if (px < 0 || py < 0 || px >= CELL || py >= CELL) {
								clipped++;
								return;
							}
							const i = ((cy + py) * W + cx + px) * 4;
							const [rr, gg, bb, aa] = hex(c);
							buf[i] = rr;
							buf[i + 1] = gg;
							buf[i + 2] = bb;
							buf[i + 3] = aa;
						},
						look,
						dir,
						frame,
						layer,
						swing,
					);
				}
		writeFileSync(join(OUT, `${kind}.png`), encodePng(W, H, buf));
		console.log(
			`${kind}.png${clipped ? `（セルの外に出た ${clipped} ドットは切れた）` : ""}`,
		);
	}
} finally {
	await server.close();
}
