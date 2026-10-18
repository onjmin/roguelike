// 広場の チョークの 国境線（第一話の 持ち帰りの 語り。data/story/story.ts の パン板「キリコは広場のまんなかに、
// チョークで国境線を引いた」）。地図の 地面の 上・人の 下に 描く（ui/village/village.ts の render）。
// - 場面の 線：その 頁（StoryPage.chalk）で キリコが 走る 向きに 伸びる。場面の おわりに 消える。
// - 町の 線：パン板を 持ち帰って 広場が 生き返った あとは 消えない（data/town/revival.ts「チョークの国境線は、
//   消えない」・data/people/mobs.ts の ぷゆゆの 節目「国境線、まだ消えてないンゴ！？」）。
// - 見た目だけ（保存・乱数に さわらない）。

import type { VillageView } from "../../data/village/map";
import { TILE } from "../../engine/types";

/** 線の 通る 所（広場の まんなかの 通り。x1 の マスから x0 の マスまで、y の マスの 下よりを 横に）。 */
export const CHALK_LINE = { y: 22, x0: 15, x1: 20 } as const;
/** 引く 長さ（ms。キリコが 走る 長さに 合わせる）。 */
const DRAW_MS = 1500;

let town = false;
let drawnAt: number | null = null;

/** 村の 地図を 組みなおした（村の 外の 地図なら null）。町の 線を 出すか きめる。 */
export const setChalkTown = (v: VillageView | null): void => {
	town = !!v?.cleared.includes("shallow");
};

/** 場面で 線を 引きはじめる（キリコが 走りだす とき）。 */
export const drawChalkLine = (): void => {
	drawnAt = performance.now();
};

/** 場面が おわった（場面の 線を 消す。町の 線は そのまま）。 */
export const endChalk = (): void => {
	drawnAt = null;
};

/** 見えて いる 長さ（0〜1）。 */
export const chalkExtent = (now = performance.now()): number =>
	town ? 1 : drawnAt === null ? 0 : Math.min(1, (now - drawnAt) / DRAW_MS);

/** 国境線を 描く（地面の 上・人の 下。ox, oy は カメラ）。 */
export const drawChalk = (
	g: CanvasRenderingContext2D,
	ox: number,
	oy: number,
): void => {
	const k = chalkExtent();
	if (k <= 0) return;
	const { y, x0, x1 } = CHALK_LINE;
	const right = x1 * TILE + TILE / 2;
	const left = x0 * TILE + TILE / 2;
	const len = (right - left) * k;
	const py = y * TILE + TILE - 4 - oy;
	g.save();
	g.strokeStyle = "rgba(255, 255, 250, 0.85)";
	g.lineWidth = 2;
	g.lineCap = "round";
	g.setLineDash([5, 3]);
	g.beginPath();
	// 手で 引いた 線：8px ごとに 1px ゆれる
	const steps = Math.ceil(len / 8);
	for (let i = 0; i <= steps; i++) {
		const x = right - Math.min(len, i * 8);
		const wobble = (i % 3) - 1;
		if (i === 0) g.moveTo(x - ox, py + wobble);
		else g.lineTo(x - ox, py + wobble);
	}
	g.stroke();
	g.restore();
};
