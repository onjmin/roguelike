// 感情の 記号と 体の 動きの プレビュー（pnpm dev で /dev/emotes.html。ビルドには 入らない）。
// 上の 段：記号（くりかえし）、下の 段：体の 動き（くりかえし）。?scale=6 で 大きさ。

import { KIRIKO_WALK } from "../src/data/people/cast";
import { loadImage } from "../src/engine/assets";
import { drawEmote, EMOTES, GESTURES, gestureAt } from "../src/engine/emote";
import { drawWalk } from "../src/engine/sprite";

const q = new URLSearchParams(location.search);
const S = Number(q.get("scale") ?? 6);
const cell = 28;
// 横に 並べる 数（?cols=。せまい 画面では 折りかえす）
const cols = Number(q.get("cols") ?? 4);
const items = [
	...EMOTES.map((e) => ({ e, g: null })),
	...GESTURES.map((g) => ({ e: null, g })),
];
const rows = Math.ceil(items.length / cols);
const c = document.getElementById("c") as HTMLCanvasElement;
c.width = cols * cell * S;
c.height = rows * cell * S;
const ctx = c.getContext("2d") as CanvasRenderingContext2D;
await loadImage(KIRIKO_WALK);
const t0 = performance.now();
const frame = (now: number) => {
	const t = now - t0;
	ctx.setTransform(S, 0, 0, S, 0, 0);
	ctx.imageSmoothingEnabled = false;
	items.forEach(({ e, g }, i) => {
		const ox = (i % cols) * cell;
		const oy = Math.floor(i / cols) * cell;
		for (let y = 0; y < cell; y++)
			for (let x = 0; x < cell; x++) {
				ctx.fillStyle = (x + y) % 2 ? "#c8a46a" : "#bf9b60";
				ctx.fillRect(ox + x, oy + y, 1, 1);
			}
		const px = ox + 6;
		const py = oy + 10;
		if (e) {
			drawWalk(ctx, KIRIKO_WALK, "down", 0, px, py);
			drawEmote(ctx, e, px, py, t, true);
		} else if (g) {
			const m = gestureAt(g, t, true, "down");
			drawWalk(ctx, KIRIKO_WALK, m.dir ?? "down", 0, px + m.dx, py + m.dy);
		}
	});
	requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
