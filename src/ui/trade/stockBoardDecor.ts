// おんJ証券の 電光の 株価ボード（地図の decor）。ボードの 絵（rpgen の led。横 4マス）の 黒い 画面に、
// 銘柄・株価・前の 帰りからの 動きを 右から 左へ 流す。上げは 赤の ▲、下げは 緑の ▼（日本の 板の 色）。
// 株価は 地図を 組んだ ときの もの（帰るまで 動かない。ui/trade/trade.ts の syncStocks）。
// 動きを へらす 設定（prefers-reduced-motion）では 流さずに 左に そろえて 止める。

import { STOCK_IDS, STOCKS } from "../../data/trade/trade";
import type { MapDef } from "../../engine/defs";
import { TILE } from "../../engine/types";
import { loadStocks, syncStocks } from "./trade";

/** 画面（ボードの 絵の 中の 黒い ところ。絵の 左上から）。 */
const SCREEN = { x: 1, y: 0, w: 62, h: 10 };
/** 流れる 速さ（ソース画素／ミリ秒）。 */
const SPEED = 0.02;
const GAP = "　　";

type Piece = { text: string; color: string };

const PRICE = "#ffe9a8";
const NAME = "#ffb040";
const UP = "#ff5a4a";
const DOWN = "#4ade80";
const FLAT = "#d0d0d0";

/** 1銘柄の 字（名前・株価・動き）。 */
const tickerOf = (): Piece[] => {
	syncStocks();
	const m = loadStocks();
	return STOCK_IDS.flatMap((id): Piece[] => {
		const h = m.hist[id] ?? [];
		const a = h[h.length - 2];
		const b = h[h.length - 1];
		const p = a && b ? ((b - a) / a) * 100 : 0;
		const move: Piece =
			p > 0
				? { text: `▲${p.toFixed(1)}%`, color: UP }
				: p < 0
					? { text: `▼${(-p).toFixed(1)}%`, color: DOWN }
					: { text: "±0%", color: FLAT };
		return [
			{ text: `${STOCKS[id].short} `, color: NAME },
			{ text: `${m.prices[id].toLocaleString("ja-JP")} `, color: PRICE },
			{ ...move, text: move.text + GAP },
		];
	});
};

const reduced = (): boolean =>
	typeof matchMedia === "function" &&
	matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 行に ボード（1234）が あれば その マス（左端）。 */
export const boardCell = (
	rows: readonly string[],
): readonly [number, number] | null => {
	const y = rows.findIndex((r) => r.includes("1234"));
	return y < 0 ? null : [rows[y].indexOf("1234"), y];
};

/** ボード（左端が cell の 横 4マス）の 飾り。cell が 無ければ 無い。 */
export const stockBoardDecor = (
	cell: readonly [number, number] | null,
): MapDef["decor"] => {
	if (!cell) return undefined;
	const [x, y] = cell;
	const pieces = tickerOf();
	const still = reduced();
	let widths: number[] | null = null;
	return (g, ox, oy, t) => {
		const sx = x * TILE + SCREEN.x - ox;
		const sy = y * TILE + SCREEN.y - oy;
		g.save();
		g.beginPath();
		g.rect(sx, sy, SCREEN.w, SCREEN.h);
		g.clip();
		g.fillStyle = "#050806";
		g.fillRect(sx, sy, SCREEN.w, SCREEN.h);
		g.font = "8px 'DotGothic16', monospace";
		g.textAlign = "left";
		g.textBaseline = "top";
		widths ??= pieces.map((p) => g.measureText(p.text).width);
		const total = widths.reduce((a, b) => a + b, 0);
		const shift = still ? 0 : (t * SPEED) % total;
		// 1周 ぶん 流れたら つなぎ目が 見えない ように 2周 ならべる
		let at = sx + 2 - shift;
		for (let lap = 0; lap < 2 && at < sx + SCREEN.w; lap++)
			pieces.forEach((p, i) => {
				const w = widths?.[i] ?? 0;
				if (at + w > sx && at < sx + SCREEN.w) {
					g.fillStyle = p.color;
					g.fillText(p.text, Math.round(at), sy + 1);
				}
				at += w;
			});
		// 電光の 粒（1画素おきの 暗い 線）
		g.fillStyle = "rgba(0,0,0,0.35)";
		for (let i = 1; i < SCREEN.h; i += 2) g.fillRect(sx, sy + i, SCREEN.w, 1);
		g.restore();
	};
};
