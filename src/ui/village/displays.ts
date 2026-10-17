// 建物の 電光表示・案内板に 字を 映す（地図の decor。映す 字は data/village/displays.ts）。
// 絵の 画面の ところを 塗りなおして 字を 右から 左へ 流す（短い 字は まんなかに 止める）。
// 動きを へらす 設定（prefers-reduced-motion）では 流さずに 左に そろえて 止め、点滅も しない。
// 電気の 来て いない 建物（シャッターの 店・停電）の 画面は 消えて いる（字なし・あかりの 面は 灰色）。
// おんJ証券の 株価ボード（ui/trade/stockBoardDecor.ts）も ここの tickerDecor で 描く。

import { type Today, today } from "../../data/town/calendar";
import {
	DISPLAYS,
	type DisplayDef,
	type DisplayFace,
	type Ink,
} from "../../data/village/displays";
import {
	type Facility,
	facilitiesAt,
	facilityRoomRows,
} from "../../data/village/facilities";
import type { MapDef } from "../../engine/defs";
import { TILE } from "../../engine/types";

type Cell = readonly [number, number];

export type Piece = { text: string; color: string };

/** 画面の 形（絵の 左上からの 位置と 高さ。幅は マスの 数から 左右の あきを ひく）と 色。 */
const FACES: Record<
	DisplayFace,
	{
		x: number;
		y: number;
		padR: number;
		h: number;
		bg: string;
		/** 消えて いる ときの 地。 */
		off: string;
		scan: boolean;
	}
> = {
	// 黒い 電光（rpgen の led）
	led: {
		x: 1,
		y: 0,
		padR: 1,
		h: 10,
		bg: "#050806",
		off: "#050806",
		scan: true,
	},
	// 灰色の 案内板の あかりの 入った 面（ledGray・depart・駅の 発車案内の 上）
	lightbox: {
		x: 3,
		y: 6,
		padR: 3,
		h: 8,
		bg: "#e6eae4",
		off: "#8a8f88",
		scan: false,
	},
	// 駅の 発車案内の 下の 黒い 帯
	board: {
		x: 2,
		y: 0,
		padR: 2,
		h: 11,
		bg: "#07090c",
		off: "#07090c",
		scan: true,
	},
};

export const INK: Record<Ink, string> = {
	amber: "#ffb040",
	red: "#ff5a4a",
	green: "#4ade80",
	white: "#e8e8e8",
	dark: "#1c2430",
};

/** 流れる 速さ（ソース画素／ミリ秒）。 */
const SPEED = 0.02;
/** 点滅の 周期（ミリ秒）。 */
const BLINK = 1000;

const reduced = (): boolean =>
	typeof matchMedia === "function" &&
	matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 行の 中で key の 字が 並ぶ マス（左端。無ければ null）。 */
export const keyCell = (rows: readonly string[], key: string): Cell | null => {
	for (const [y, r] of rows.entries()) {
		const x = [...r].join("").indexOf(key);
		if (x >= 0) return [[...r.slice(0, x)].length, y];
	}
	return null;
};

/**
 * 画面（左端が cell、横 tiles マス）に 字を 映す 飾り。cell が 無ければ 無い。
 * still は 流さずに まんなかに、blink は 点滅。
 */
export const tickerDecor = (
	cell: Cell | null,
	tiles: number,
	face: DisplayFace,
	pieces: readonly Piece[],
	opt: { still?: boolean; blink?: boolean } = {},
): MapDef["decor"] => {
	if (!cell || !pieces.length) return undefined;
	const f = FACES[face];
	const [x, y] = cell;
	const w = tiles * TILE - f.x - f.padR;
	const calm = reduced();
	let widths: number[] | null = null;
	return (g, ox, oy, t) => {
		const sx = x * TILE + f.x - ox;
		const sy = y * TILE + f.y - oy;
		if (
			sx + w < 0 ||
			sy + f.h < 0 ||
			sx > g.canvas.width ||
			sy > g.canvas.height
		)
			return;
		g.save();
		g.beginPath();
		g.rect(sx, sy, w, f.h);
		g.clip();
		g.fillStyle = f.bg;
		g.fillRect(sx, sy, w, f.h);
		g.font = "8px 'DotGothic16', monospace";
		g.textAlign = "left";
		g.textBaseline = "top";
		widths ??= pieces.map((p) => g.measureText(p.text).width);
		const total = widths.reduce((a, b) => a + b, 0);
		const ty = sy + Math.floor((f.h - 8) / 2);
		const lit = !opt.blink || calm || Math.floor(t / (BLINK / 2)) % 2 === 0;
		if (lit) {
			if (opt.still || calm) {
				let at = sx + Math.max(1, Math.round((w - total) / 2));
				pieces.forEach((p, i) => {
					g.fillStyle = p.color;
					g.fillText(p.text, at, ty);
					at += widths?.[i] ?? 0;
				});
			} else {
				// 1周 ぶん 流れたら つなぎ目が 見えない ように 2周 ならべる（右の はしから 出てくる）
				const span = total + w;
				let at = sx + w - ((t * SPEED) % span);
				for (let lap = 0; lap < 2; lap++) {
					pieces.forEach((p, i) => {
						const pw = widths?.[i] ?? 0;
						if (at + pw > sx && at < sx + w) {
							g.fillStyle = p.color;
							g.fillText(p.text, Math.round(at), ty);
						}
						at += pw;
					});
					at += w;
				}
			}
		}
		if (f.scan) {
			// 電光の 粒（1画素おきの 暗い 線）
			g.fillStyle = "rgba(0,0,0,0.35)";
			for (let i = 1; i < f.h; i += 2) g.fillRect(sx, sy + i, w, 1);
		}
		g.restore();
	};
};

/** 画面の 四角（地図の ソース画素。左端が cell、横 tiles マス）。看板と 重ならない ことを 試験で 見る。 */
export const faceRect = (
	cell: Cell,
	tiles: number,
	face: DisplayFace,
): { x0: number; y0: number; x1: number; y1: number } => {
	const f = FACES[face];
	const x0 = cell[0] * TILE + f.x;
	const y0 = cell[1] * TILE + f.y;
	return { x0, y0, x1: x0 + tiles * TILE - f.x - f.padR, y1: y0 + f.h };
};

/** 村の 地図：その 段の 建物の 外の 電光表示の 四角（施設の id と）。 */
export const outsideDisplayRects = (stage: number) => {
	const built = facilitiesAt(stage);
	return DISPLAYS.filter((d) => d.where === "outside").flatMap((d) => {
		const f = built.find((x) => x.id === d.facility);
		if (f?.look.kind !== "grid") return [];
		const c = keyCell(f.look.rows, d.key);
		if (!c) return [];
		return [
			{
				facility: f.id,
				...faceRect(
					[f.at[0] + c[0], f.at[1] + c[1]],
					[...d.key].length,
					d.face,
				),
			},
		];
	});
};

/** 消えた 画面（左端が cell、横 tiles マス。字を 映さず 地だけ）。cell が 無ければ 無い。 */
export const offDecor = (
	cell: Cell | null,
	tiles: number,
	face: DisplayFace,
): MapDef["decor"] => {
	if (!cell) return undefined;
	const f = FACES[face];
	const [x, y] = cell;
	const w = tiles * TILE - f.x - f.padR;
	return (g, ox, oy) => {
		const sx = x * TILE + f.x - ox;
		const sy = y * TILE + f.y - oy;
		g.fillStyle = f.off;
		g.fillRect(sx, sy, w, f.h);
	};
};

const piecesOf = (d: DisplayDef, t: Today): Piece[] =>
	d.text(t).map(([text, ink]) => ({ text, color: INK[ink ?? "amber"] }));

const decorOf = (
	d: DisplayDef,
	rows: readonly string[],
	at: Cell,
	t: Today,
	lit = true,
): MapDef["decor"] => {
	const c = keyCell(rows, d.key);
	if (!lit)
		return offDecor(
			c && [at[0] + c[0], at[1] + c[1]],
			[...d.key].length,
			d.face,
		);
	return tickerDecor(
		c && [at[0] + c[0], at[1] + c[1]],
		[...d.key].length,
		d.face,
		piecesOf(d, t),
		{ still: d.still, blink: d.blink },
	);
};

const join =
	(ds: MapDef["decor"][]): MapDef["decor"] =>
	(g, ox, oy, t, me) => {
		for (const d of ds) d?.(g, ox, oy, t, me);
	};

/** 村の 地図：その 段の 建物の 外の 電光表示（lit が false の 建物の 画面は 消えて いる）。 */
export const outsideDisplays = (
	stage: number,
	lit: (facility: string) => boolean,
	t: Today = today(),
): MapDef["decor"] => {
	const built = facilitiesAt(stage);
	const ds = DISPLAYS.filter((d) => d.where === "outside").flatMap((d) => {
		const f = built.find((x) => x.id === d.facility);
		return f?.look.kind === "grid"
			? [decorOf(d, f.look.rows, f.at, t, lit(f.id))]
			: [];
	});
	return ds.length ? join(ds) : undefined;
};

/** 施設の 中の 電光表示（無ければ 無い）。 */
export const insideDisplays = (
	f: Facility,
	t: Today = today(),
): MapDef["decor"] => {
	const rows = facilityRoomRows(f);
	const ds = DISPLAYS.filter(
		(d) => d.where === "inside" && d.facility === f.id,
	).map((d) => decorOf(d, rows, [0, 0], t));
	return ds.length ? join(ds) : undefined;
};
