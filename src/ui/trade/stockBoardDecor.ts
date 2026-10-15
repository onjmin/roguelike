// おんJ証券の 電光の 株価ボード（地図の decor）。ボードの 絵（rpgen の led。横 4マス）の 黒い 画面に、
// 銘柄・株価・前の 帰りからの 動きを 右から 左へ 流す。上げは 赤の ▲、下げは 緑の ▼（日本の 板の 色）。
// 株価は 地図を 組んだ ときの もの（帰るまで 動かない。ui/trade/trade.ts の syncStocks）。
// 描き方は 町の 電光表示と 同じ（ui/village/displays.ts の tickerDecor）。

import { STOCK_IDS, STOCKS } from "../../data/trade/trade";
import type { MapDef } from "../../engine/defs";
import { keyCell, type Piece, tickerDecor } from "../village/displays";
import { loadStocks, syncStocks } from "./trade";

const GAP = "　　";

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

/** 行に ボード（1234）が あれば その マス（左端）。 */
export const boardCell = (
	rows: readonly string[],
): readonly [number, number] | null => keyCell(rows, "1234");

/** ボード（左端が cell の 横 4マス）の 飾り。cell が 無ければ 無い。 */
export const stockBoardDecor = (
	cell: readonly [number, number] | null,
): MapDef["decor"] =>
	cell ? tickerDecor(cell, 4, "led", tickerOf()) : undefined;
