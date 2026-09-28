// 図鑑の モンスターの 絵（ポケモン・ドラクエの 図鑑のように）。
// 歩行グラの 前向きを 足踏みさせる（はやさは 階で 止まっている ときと 同じ）。置物は 動かない 1コマ。
// まだ 会っていない 敵は 本当の 色を 見せず、黒い 影に する。
// 絵は 16px の キャンバスに 1倍で 描き、CSS で 大きく する（image-rendering: pixelated）。

import type { MonsterDef } from "../core/types";
import { drawRefInCell, getImage, onImageLoaded } from "../engine/assets";
import { drawWalk, isWalkRef, stepFrame } from "../engine/sprite";
import { el } from "./dom";

const CELL = 16;

export type MonsterArt = {
	readonly canvas: HTMLCanvasElement;
	/** 足踏みの コマ frame を 描く（動かない 絵は いつも 同じ）。画像が まだ なら 何も しない。 */
	draw: (frame: number) => void;
};

/**
 * モンスターの 絵を 1枚。px は 見せる 大きさ（CSS の 1辺）。
 * shadow なら 黒い 影（まだ 会っていない）で、足踏みも しない。
 */
export const monsterArt = (
	d: MonsterDef,
	o: { px: number; shadow?: boolean },
): MonsterArt => {
	const canvas = el("canvas", {
		class: `mon-art${o.shadow ? " shadow" : ""}`,
	});
	canvas.width = CELL;
	canvas.height = CELL;
	canvas.style.width = `${o.px}px`;
	canvas.style.height = `${o.px}px`;
	// 置物は 動きだす 前の 絵（前向きの 1コマ）
	const ref = d.still ?? d.sprite;
	const walk = !d.still && isWalkRef(ref);
	const g = canvas.getContext("2d");
	const draw = (frame: number): void => {
		if (!g || !getImage(ref)) return;
		g.clearRect(0, 0, CELL, CELL);
		if (walk) drawWalk(g, ref, "down", o.shadow ? 0 : frame, 0, 0);
		else drawRefInCell(g, ref, 0, 0);
		if (o.shadow) {
			// 描いた ところだけ 黒く ぬる（形は そのまま、色は 見せない）
			g.globalCompositeOperation = "source-in";
			g.fillStyle = "#000";
			g.fillRect(0, 0, CELL, CELL);
			g.globalCompositeOperation = "source-over";
		}
	};
	draw(stepFrame(performance.now(), false));
	return { canvas, draw };
};

/**
 * 絵を 足踏みさせる（コマが 変わるときと、画像が 読めたときに 描きなおす）。戻り値を 呼ぶと 止まる。
 * 窓を 閉じたら かならず 止める。
 */
export const animateArts = (arts: readonly MonsterArt[]): (() => void) => {
	let last = -1;
	const off = onImageLoaded(() => {
		last = -1;
	});
	let raf = 0;
	const loop = (t: number) => {
		const f = stepFrame(t, false);
		if (f !== last) {
			last = f;
			for (const a of arts) a.draw(f);
		}
		raf = requestAnimationFrame(loop);
	};
	raf = requestAnimationFrame(loop);
	return () => {
		cancelAnimationFrame(raf);
		off();
	};
};
