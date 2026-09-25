// 装備の見た目のプレビュー（pnpm dev で /dev/equip.html。ビルドには入らない）。
// ?w=steel&s=bronze で装備を選ぶ。行＝向き（正面・右・左・うしろ）、列＝足踏み2コマと攻撃の3つの形。

import type { SpriteDir } from "../src/core/geom";
import { loadImage } from "../src/engine/assets";
import { drawWalk } from "../src/engine/sprite";
import { drawEquip } from "../src/ui/equip";

const q = new URLSearchParams(location.search);
const look = { weapon: q.get("w") ?? "steel", shield: q.get("s") ?? "bronze" };
const S = Number(q.get("scale") ?? 8);
const dirs: SpriteDir[] = ["down", "right", "left", "up"];
const poses = [
	{ frame: 0, swing: -1 },
	{ frame: 1, swing: -1 },
	{ frame: 0, swing: 0.2 },
	{ frame: 0, swing: 0.5 },
	{ frame: 0, swing: 0.85 },
];
const cell = 24;
const c = document.getElementById("c") as HTMLCanvasElement;
c.width = poses.length * cell * S;
c.height = dirs.length * cell * S;
const ctx = c.getContext("2d") as CanvasRenderingContext2D;
await loadImage("pub:sprites/kiriko.png");
ctx.setTransform(S, 0, 0, S, 0, 0);
ctx.imageSmoothingEnabled = false;
dirs.forEach((dir, row) => {
	poses.forEach((p, col) => {
		const ox = col * cell;
		const oy = row * cell;
		for (let y = 0; y < cell; y++)
			for (let x = 0; x < cell; x++) {
				ctx.fillStyle = (x + y) % 2 ? "#6b5a3e" : "#5e4f36";
				ctx.fillRect(ox + x, oy + y, 1, 1);
			}
		const x = ox + 4;
		const y = oy + 5;
		drawEquip(ctx, look, dir, p.frame, x, y, "under", p.swing);
		drawWalk(ctx, "pub:sprites/kiriko.png", dir, p.frame, x, y);
		drawEquip(ctx, look, dir, p.frame, x, y, "over", p.swing);
	});
});
