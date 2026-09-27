// 村の 全体図（開発用）。pnpm dev で /dev/village.html?stage=7&scale=2 を 開く。
// 地面（data/village/map.ts の villageRows・villagePalette）と、人・置物の 場所（villagePlaces）を 描く。

import { DUNGEON_IDS } from "../src/core/data/dungeons";
import {
	VILLAGE_H,
	VILLAGE_W,
	villagePalette,
	villagePlaces,
	villageRows,
} from "../src/data/village/map";
import { drawRefInCell, loadImage } from "../src/engine/assets";
import { drawWalk, isWalkRef } from "../src/engine/sprite";

const q = new URLSearchParams(location.search);
const stage = Number(q.get("stage") ?? 7);
const scale = Number(q.get("scale") ?? 2);
const view = { stage, unlocked: DUNGEON_IDS, cleared: DUNGEON_IDS };
const rows = villageRows(view);
const tiles = villagePalette(view);
const places = villagePlaces(view);

const c = document.getElementById("c") as HTMLCanvasElement;
c.width = VILLAGE_W * 16;
c.height = VILLAGE_H * 16;
c.style.width = `${c.width * scale}px`;
const g = c.getContext("2d") as CanvasRenderingContext2D;
g.imageSmoothingEnabled = false;

const refs = new Set<string>();
for (const t of Object.values(tiles))
	for (const r of [...t.layers, ...(t.above ?? [])]) refs.add(r);
for (const p of places) if (p.sprite) refs.add(p.sprite);
await Promise.all([...refs].map((r) => loadImage(r)));

for (let y = 0; y < VILLAGE_H; y++)
	for (let x = 0; x < VILLAGE_W; x++) {
		const t = tiles[rows[y][x]];
		g.fillStyle = t?.color ?? "#f0f";
		g.fillRect(x * 16, y * 16, 16, 16);
		for (const r of t?.layers ?? []) drawRefInCell(g, r, x * 16, y * 16, 16, "cell");
	}
for (let y = 0; y < VILLAGE_H; y++)
	for (let x = 0; x < VILLAGE_W; x++) {
		const t = tiles[rows[y][x]];
		for (const r of t?.layers ?? []) drawRefInCell(g, r, x * 16, y * 16, 16, "over");
		for (const r of t?.above ?? []) drawRefInCell(g, r, x * 16, y * 16);
	}
for (const p of places) {
	if (!p.sprite) continue;
	if (isWalkRef(p.sprite)) drawWalk(g, p.sprite, "down", 0, p.x * 16, p.y * 16);
	else drawRefInCell(g, p.sprite, p.x * 16, p.y * 16);
}
