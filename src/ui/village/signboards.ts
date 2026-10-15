// 建物の 看板（村の 地図の decor）。外観の 扉の 上に 名前の 板を かける（名前は data/village/signs.ts）。
// 扉の ない 外観は いちばん 下の 行の 上、まんなかに。板は 建物の 幅から はみ出させない。
// 同梱の チップに 字の 看板が 無いので 塗って 書く（ui/village/cinemaDecor.ts の 番組名の 帯と 同じ 字）。

import {
	type Facility,
	facilitiesAt,
	gridDoor,
} from "../../data/village/facilities";
import { SIGNS, type SignStyle } from "../../data/village/signs";
import type { MapDef } from "../../engine/defs";
import { TILE } from "../../engine/types";

const FONT = "8px 'DotGothic16', monospace";
/** 板の 高さ（字 8px ＋ 上下 1px の ふち）。 */
const H = 10;

/** 板の 色（ふち・地・字）。 */
const INK: Record<SignStyle, { rim: string; bg: string; fg: string }> = {
	shop: { rim: "#3b2412", bg: "#8a5a32", fg: "#fff4d8" },
	public: { rim: "#4a5260", bg: "#f4f4ee", fg: "#1c2430" },
	night: { rim: "#120a1e", bg: "#1e1430", fg: "#ff8ad8" },
};

type Board = {
	text: string;
	style: SignStyle;
	/** 板の まんなかの x と 上端の y（地図の ソース画素）。 */
	cx: number;
	y: number;
	/** 建物の 左右（板を おさめる）。 */
	left: number;
	right: number;
};

const boardOf = (f: Facility): Board | null => {
	const sign = SIGNS[f.id];
	if (!sign || f.look.kind !== "grid") return null;
	const rows = f.look.rows;
	const w = Math.max(...rows.map((r) => [...r].length));
	const door = gridDoor(f.look);
	const row = sign.row ?? door?.[1] ?? rows.length - 1;
	const col = door ? door[0] + 0.5 : w / 2;
	return {
		text: sign.text,
		style: sign.style ?? "shop",
		cx: (f.at[0] + col) * TILE,
		y: (f.at[1] + row) * TILE - Math.ceil(H / 2),
		left: f.at[0] * TILE,
		right: (f.at[0] + w) * TILE,
	};
};

/** その 段の 建物の 看板。 */
export const signboardDecor = (stage: number): MapDef["decor"] => {
	const boards = facilitiesAt(stage).flatMap((f) => boardOf(f) ?? []);
	if (!boards.length) return undefined;
	const widths = new Map<Board, number>();
	return (g, ox, oy) => {
		g.save();
		g.font = FONT;
		g.textAlign = "left";
		g.textBaseline = "top";
		const vw = g.canvas.width;
		const vh = g.canvas.height;
		for (const b of boards) {
			let tw = widths.get(b);
			if (tw === undefined) {
				tw = Math.ceil(g.measureText(b.text).width);
				widths.set(b, tw);
			}
			const bw = Math.min(tw + 4, b.right - b.left);
			const x = Math.round(
				Math.max(b.left, Math.min(b.right - bw, b.cx - bw / 2)) - ox,
			);
			const y = b.y - oy;
			if (x + bw < 0 || x > vw || y + H < 0 || y > vh) continue;
			const ink = INK[b.style];
			g.fillStyle = ink.rim;
			g.fillRect(x, y, bw, H);
			g.fillStyle = ink.bg;
			g.fillRect(x + 1, y + 1, bw - 2, H - 2);
			g.fillStyle = ink.fg;
			g.fillText(b.text, x + Math.round((bw - tw) / 2), y + 1, bw - 2);
		}
		g.restore();
	};
};
