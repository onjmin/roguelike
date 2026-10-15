// 建物の 看板（村の 地図の decor）。外観の 扉の 上の 壁に 名前の 板を かける（名前は data/village/signs.ts）。
// 扉の ない 外観は いちばん 下の 行の 上、まんなかに。板は 建物の 幅から はみ出させない。
// 同梱の チップに 字の 看板が 無いので 塗って 書く（ui/village/cinemaDecor.ts の 番組名の 帯と 同じ 字）。

import {
	type Facility,
	facilitiesAt,
	gridDoor,
	gridKeyCell,
} from "../../data/village/facilities";
import { SIGNS, type SignStyle } from "../../data/village/signs";
import type { MapDef } from "../../engine/defs";
import { TILE } from "../../engine/types";

const FONT = "8px 'DotGothic16', monospace";
/** 板の 高さ（字 8px ＋ 上下 1px）。 */
const H = 10;

/**
 * 板の 描き方（2026-10-16 作者：「看板は もっと 自然な 感じに」）。
 * 店：木の 板（上に 明るい ふち・下と 右に 暗い ふち・壁に 落ちる 影）、こげ茶の 字。
 * 役所・会社：白い 半透明の パネルに 紺の 字（ふちなし）。夜の 店：暗い 板に うっすら 光る ネオンの 字。
 */
const drawBoard = (
	g: CanvasRenderingContext2D,
	style: SignStyle,
	x: number,
	y: number,
	w: number,
): void => {
	// 壁に 落ちる 影
	g.fillStyle = "rgba(0, 0, 0, 0.28)";
	g.fillRect(x + 1, y + H, w, 1);
	g.fillRect(x + w, y + 1, 1, H);
	if (style === "shop") {
		g.fillStyle = "#9a6a3c";
		g.fillRect(x, y, w, H);
		g.fillStyle = "#c08a52";
		g.fillRect(x, y, w, 1);
		g.fillStyle = "#6a4422";
		g.fillRect(x, y + H - 1, w, 1);
		g.fillRect(x + w - 1, y, 1, H);
	} else if (style === "public") {
		g.fillStyle = "rgba(246, 246, 240, 0.88)";
		g.fillRect(x, y, w, H);
	} else {
		g.fillStyle = "#1a1226";
		g.fillRect(x, y, w, H);
		g.fillStyle = "#2c2040";
		g.fillRect(x, y, w, 1);
	}
};

/** 字の 色（夜の 店は 光の にじみ つき）。 */
const TEXT_INK: Record<SignStyle, string> = {
	shop: "#2e1a0a",
	public: "#1c2a48",
	night: "#ff9ade",
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
	// 両開きなら 2枚の まんなか
	const door2 = gridKeyCell(f.look, f.look.door2);
	const col = door
		? (door[0] + (door2 && door2[1] === door[1] ? door2[0] : door[0])) / 2 + 0.5
		: w / 2;
	return {
		text: sign.text,
		style: sign.style ?? "shop",
		cx: (f.at[0] + col) * TILE,
		// 扉の 上の 壁に かける（扉には かからない）
		y: (f.at[1] + row) * TILE - H - 1,
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
			const bw = Math.min(tw + 6, b.right - b.left);
			const x = Math.round(
				Math.max(b.left, Math.min(b.right - bw, b.cx - bw / 2)) - ox,
			);
			const y = b.y - oy;
			if (x + bw < 0 || x > vw || y + H < 0 || y > vh) continue;
			drawBoard(g, b.style, x, y, bw);
			const tx = x + Math.round((bw - tw) / 2);
			if (b.style === "night") {
				g.fillStyle = "rgba(255, 120, 210, 0.35)";
				g.fillText(b.text, tx + 1, y + 1, bw - 2);
				g.fillText(b.text, tx - 1, y + 1, bw - 2);
			}
			g.fillStyle = TEXT_INK[b.style];
			g.fillText(b.text, tx, y + 1, bw - 2);
		}
		g.restore();
	};
};
