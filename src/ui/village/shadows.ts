// 村の 建物の 影（2026-10-15 作者「影の 表現が 違和感。もう少し ていねいに」「日照の 概念が あるので、
// 日時に 応じて 影の 向きも ちょっとずつ かえる」）。
// - 影は 地面の すぐ 上に 描く（MapDef.ground。人・看板・上の 層より 下）。歩ける マス（地面）だけに 落とし、
//   看板や 建物・木の 上には かからない。
// - ふちは ドット（1画素ずつ 行で 塗る。ぼかさない）。
// - 日は 村の 時計（data/town/calendar.ts）で 動く：朝は 東から（影は 西＝左へ 長く）、昼は 短く、
//   夕方は 西から（東＝右へ 長く）。夜は 影なし。夜明け・日暮れの 1時間で うすく 出て 消える。
// 影の 出る 建物の 段は data/village/facilities.ts の facilityShadows・data/village/map.ts の coreShadows
// （右はしの 列と 軒・足もとの 行）。左はしは 地図を 左へ たどって 見つける。

import { nowHour, nowMinute } from "../../data/town/calendar";
import { facilityShadows } from "../../data/village/facilities";
import { coreShadows } from "../../data/village/map";
import type { MapDef, TileDef } from "../../engine/defs";
import { TILE } from "../../engine/types";

/** 影の 色（いちばん 濃い とき）。 */
const SHADE = [10, 16, 30] as const;
const ALPHA = 0.24;
/** 影の 横の 長さ（画素。朝・夕の いちばん 長い とき と 昼）。 */
const LONG = 14;
const NOON = 3;

/**
 * いまの 日（0時からの 分）の 影の 向きと 濃さ。side は 影が 出る 向き（-1 左・1 右）、w は 横の 長さ（画素）、
 * alpha は 濃さ（夜は 0）。
 */
export const sunAt = (
	minute: number,
): { side: -1 | 1; w: number; alpha: number } => {
	const m = ((minute % 1440) + 1440) % 1440;
	// 6時〜18時が 日の 出ている あいだ（0〜1）。前後 1時間で うすく 出て 消える
	const t = (m - 360) / 720;
	const fade = Math.max(0, Math.min(1, (m - 300) / 60, (1140 - m) / 60));
	if (fade <= 0) return { side: 1, w: 0, alpha: 0 };
	const c = Math.cos(Math.PI * Math.max(0, Math.min(1, t)));
	// c が 1（朝）なら 左へ、-1（夕）なら 右へ
	const side: -1 | 1 = c > 0 ? -1 : 1;
	const w = Math.round(NOON + (LONG - NOON) * Math.abs(c));
	return { side, w, alpha: ALPHA * fade };
};

type Seg = { left: number; right: number; top: number; bottom: number };

/** 影の 段（右はしは data、左はしは 地図を 左へ たどる。足もとの 行で 歩けない マスが 続く 所まで。12マスまで）。 */
const segments = (
	stage: number,
	rows: readonly string[],
	pal: Record<string, TileDef>,
): Seg[] => {
	const solid = (x: number, y: number) => {
		const c = [...(rows[y] ?? "")][x];
		return c !== undefined && pal[c]?.passable === false;
	};
	return [...facilityShadows(stage), ...coreShadows(stage)].map((s) => {
		const y = s.bottom - 1;
		let left = s.x;
		while (left > 0 && s.x - left < 12 && solid(left - 1, y)) left--;
		return { left, right: s.x, top: s.top, bottom: s.bottom };
	});
};

/**
 * 村の 地面に 落とす 建物の 影（MapDef.ground）。歩ける マスの 形で 切りぬいて（看板・建物・木には かけない）、
 * 1画素ずつの 行で 平行四辺形を 塗る：軒の 角から 斜めに ひろがり、足もとで 斜めに 閉じる。
 */
export const shadowGround = (
	stage: number,
	rows: readonly string[],
	pal: Record<string, TileDef>,
): MapDef["ground"] => {
	const segs = segments(stage, rows, pal);
	if (!segs.length) return undefined;
	// 地面（歩ける マス）の 形（地図の 座標。1度だけ 作る）
	// （はじめて 描く ときに 作る。試験の node には Path2D が ない）
	let ground: Path2D | null = null;
	return (g, ox, oy) => {
		const sun = sunAt(nowHour() * 60 + nowMinute());
		if (sun.alpha <= 0 || sun.w <= 0) return;
		if (!ground) {
			const p = new Path2D();
			rows.forEach((r, y) => {
				[...r].forEach((c, x) => {
					if (pal[c]?.passable) p.rect(x * TILE, y * TILE, TILE, TILE);
				});
			});
			ground = p;
		}
		const W = g.canvas.width;
		const H = g.canvas.height;
		g.save();
		g.translate(-ox, -oy);
		g.clip(ground);
		g.fillStyle = `rgba(${SHADE.join(", ")}, ${sun.alpha})`;
		const w = sun.w;
		// 足もとで 閉じる 高さ（横の 長さの 4割）
		const drop = Math.max(1, Math.round(w * 0.4));
		for (const s of segs) {
			const edge = sun.side > 0 ? s.right * TILE : s.left * TILE;
			const top = s.top * TILE;
			const bottom = s.bottom * TILE;
			// 画面の 外は 描かない
			const lo = Math.min(edge, edge + sun.side * w);
			if (lo - ox > W || lo + w - ox < 0) continue;
			if (top - oy > H || bottom + drop - oy < 0) continue;
			for (let py = top; py < bottom + drop; py++) {
				// 建物の 側から 測った 内がわ・外がわ（画素）
				const inner =
					py < bottom ? 0 : Math.round(((py - bottom + 1) * w) / drop);
				const outer = Math.min(w, py - top + 1);
				if (outer <= inner) continue;
				const x = sun.side > 0 ? edge + inner : edge - outer;
				g.fillRect(x, py, outer - inner, 1);
			}
		}
		g.restore();
	};
};
