// 地上の町のプレビュー（pnpm dev で /dev/town.html。ビルドには入らない）。
// 段階 0..7 を 上から順に 4倍で並べる。?scale=6 で倍率、?t=600 で時間を止める（煙・灯りの確認用）。

import { loadImage } from "../src/engine/assets";
import { drawTown, TOWN_H, TOWN_STAGES, TOWN_W } from "../src/ui/town";

const q = new URLSearchParams(location.search);
const S = Number(q.get("scale") ?? 4);
const frozen = q.get("t");
const rows = document.getElementById("rows") as HTMLDivElement;

const canvases = Array.from({ length: TOWN_STAGES }, (_, stage) => {
	const row = document.createElement("div");
	row.className = "row";
	const label = document.createElement("b");
	label.textContent = String(stage);
	const c = document.createElement("canvas");
	c.width = TOWN_W;
	c.height = TOWN_H;
	c.style.width = `${TOWN_W * S}px`;
	c.style.height = `${TOWN_H * S}px`;
	c.dataset.stage = String(stage);
	row.append(label, c);
	rows.append(row);
	return c;
});

await loadImage("pub:assets/rpg-reze/Base.png");

const paint = (t: number) => {
	for (const [stage, c] of canvases.entries()) {
		const g = c.getContext("2d") as CanvasRenderingContext2D;
		g.clearRect(0, 0, c.width, c.height);
		drawTown(g, stage, t);
	}
};

if (frozen !== null) paint(Number(frozen));
else {
	const loop = (t: number) => {
		paint(t);
		requestAnimationFrame(loop);
	};
	requestAnimationFrame(loop);
}
