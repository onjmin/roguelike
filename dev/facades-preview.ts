// 施設の 外観の 一覧（開発用）。pnpm dev で /dev/facades.html?stage=7 を 開く。
// 村の 地図（data/village/map.ts）を 描いて、施設ごとに 外観の 四角を 切り出して 並べる（見比べて ちぐはぐを 直す 用）。

import { DUNGEON_IDS } from "../src/core/data/dungeons";
import { facilitiesAt } from "../src/data/village/facilities";
import {
	VILLAGE_H,
	VILLAGE_W,
	villagePalette,
	villageRows,
} from "../src/data/village/map";
import { drawRefInCell, loadImage } from "../src/engine/assets";

const q = new URLSearchParams(location.search);
const stage = Number(q.get("stage") ?? 7);
const view = { stage, unlocked: DUNGEON_IDS, cleared: DUNGEON_IDS };
const rows = villageRows(view);
const tiles = villagePalette(view);

const map = document.createElement("canvas");
map.width = VILLAGE_W * 16;
map.height = VILLAGE_H * 16;
const g = map.getContext("2d") as CanvasRenderingContext2D;
g.imageSmoothingEnabled = false;
const refs = new Set<string>();
for (const t of Object.values(tiles))
	for (const r of [...t.layers, ...(t.above ?? [])]) refs.add(r);
await Promise.all([...refs].map((r) => loadImage(r)));
for (let y = 0; y < VILLAGE_H; y++)
	for (let x = 0; x < VILLAGE_W; x++) {
		const t = tiles[rows[y][x]];
		g.fillStyle = t?.color ?? "#f0f";
		g.fillRect(x * 16, y * 16, 16, 16);
		for (const r of t?.layers ?? []) drawRefInCell(g, r, x * 16, y * 16, 16);
	}
for (let y = 0; y < VILLAGE_H; y++)
	for (let x = 0; x < VILLAGE_W; x++)
		for (const r of tiles[rows[y][x]]?.above ?? [])
			drawRefInCell(g, r, x * 16, y * 16, 16);

const out = document.getElementById("out") as HTMLDivElement;
for (const f of facilitiesAt(stage)) {
	const look = f.look as { rows?: readonly string[]; w?: number; h?: number };
	const w = look.rows
		? Math.max(...look.rows.map((r) => [...r].length))
		: (look.w ?? 4);
	const h = look.rows ? look.rows.length : (look.h ?? 4);
	const box = document.createElement("div");
	box.className = "f";
	const c = document.createElement("canvas");
	c.width = (w + 2) * 16;
	c.height = (h + 2) * 16;
	const cg = c.getContext("2d") as CanvasRenderingContext2D;
	cg.imageSmoothingEnabled = false;
	cg.drawImage(
		map,
		(f.at[0] - 1) * 16,
		(f.at[1] - 1) * 16,
		c.width,
		c.height,
		0,
		0,
		c.width,
		c.height,
	);
	c.style.width = `${c.width * 2}px`;
	const label = document.createElement("div");
	label.textContent = `${f.id}　${f.name}`;
	box.append(c, label);
	out.append(box);
}
