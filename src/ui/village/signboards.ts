// 建物の 看板（村の 地図の decor）。施設は 扉の 上の 壁、町の まんなかの 建物は 決めた 所に 名前の 板を かける
// （名前・場所・見た目は data/village/signs.ts）。
// 画面は 1ソース画素 ＝ 数デバイス画素で 描くので、そのまま 字を 書くと なめらかな 字が ドット絵の 上に 浮く。
// そこで 看板は ソース画素の 大きさの 小さな キャンバスに 描いて、字は にじみを 0 か 1 に 落として ドットに する
// （書体の 形は 残る）。できた 板は 1枚ずつ 覚えて おく。
// 書体は Google Fonts から 看板の 字だけ 読みこむ（text= で しぼる）。読めるまでは DotGothic16 で 描いて、
// 読めたら 描きなおす。

import {
	type Facility,
	facilitiesAt,
	gridDoor,
	gridKeyCell,
} from "../../data/village/facilities";
import {
	CORE_SIGNS,
	SIGN_FONTS,
	SIGN_LOOKS,
	SIGNS,
	type SignLook,
	signChars,
} from "../../data/village/signs";
import type { MapDef } from "../../engine/defs";
import { TILE } from "../../engine/types";

/** 字の 大きさと 板の 高さ（ソース画素）。字が 入りきらなければ 小さく する。 */
const FONT_PX = 10;
const MIN_PX = 8;
const H = 12;
/** 字の にじみを 字と みなす こさ（0〜255）。 */
const SOLID = 110;

type Board = {
	key: string;
	text: string;
	look: SignLook;
	/** 板の まんなかの x と 下の はしの y（地図の ソース画素）。 */
	cx: number;
	bottom: number;
	/** 板を おさめる 左右（建物の はば）。 */
	left: number;
	right: number;
};

// ───────────────── 書体 ─────────────────

let fontsAsked = false;
let fontsReady = false;

const cache = new Map<string, HTMLCanvasElement>();

/** 看板の 書体を 読みこむ（1回だけ。読めたら 板を 描きなおす）。 */
const loadFonts = (): void => {
	if (fontsAsked || typeof document === "undefined") return;
	fontsAsked = true;
	const text = signChars();
	const fams = Object.values(SIGN_FONTS)
		.map(
			(f) =>
				`family=${f.family.replaceAll(" ", "+")}${f.weight !== 400 ? `:wght@${f.weight}` : ""}`,
		)
		.join("&");
	const link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = `https://fonts.googleapis.com/css2?${fams}&text=${encodeURIComponent(text)}&display=block`;
	link.onload = () => {
		void Promise.all(
			Object.values(SIGN_FONTS).map((f) =>
				document.fonts.load(`${f.weight} ${FONT_PX}px "${f.family}"`, text),
			),
		)
			.then(() => {
				fontsReady = true;
				cache.clear();
			})
			.catch(() => {
				// 読めなければ DotGothic16 の まま
			});
	};
	document.head.appendChild(link);
};

const fontOf = (look: SignLook, px: number): string => {
	const f = SIGN_FONTS[look.font];
	return fontsReady
		? `${f.weight} ${px}px "${f.family}", "DotGothic16", sans-serif`
		: `${px}px "DotGothic16", sans-serif`;
};

// ───────────────── 板を 描く ─────────────────

/** 字を ドットに 落とした 型（その 字の 画素だけ 不透明）。 */
const textMask = (
	text: string,
	font: string,
	w: number,
	maxW: number,
): HTMLCanvasElement => {
	const c = document.createElement("canvas");
	c.width = w;
	c.height = H;
	const g = c.getContext("2d");
	if (!g) return c;
	g.font = font;
	g.textBaseline = "middle";
	g.textAlign = "center";
	g.fillStyle = "#000";
	g.fillText(text, w / 2, H / 2 + 0.5, maxW);
	const d = g.getImageData(0, 0, w, H);
	for (let i = 3; i < d.data.length; i += 4)
		d.data[i] = (d.data[i] ?? 0) >= SOLID ? 255 : 0;
	g.putImageData(d, 0, 0);
	return c;
};

/** 型を 色で 塗った 写し（上下左右に ずらして 重ねると ふち取りに なる）。 */
const tinted = (mask: HTMLCanvasElement, color: string): HTMLCanvasElement => {
	const c = document.createElement("canvas");
	c.width = mask.width;
	c.height = mask.height;
	const g = c.getContext("2d");
	if (!g) return c;
	g.drawImage(mask, 0, 0);
	g.globalCompositeOperation = "source-in";
	g.fillStyle = color;
	g.fillRect(0, 0, c.width, c.height);
	return c;
};

const AROUND = [
	[-1, 0],
	[1, 0],
	[0, -1],
	[0, 1],
] as const;

/** 1枚の 板（地・上の 明るい ふち・暗い ふち・壁に 落ちる 影・字）。幅は 字に 合わせ、maxW を こえない。 */
const renderBoard = (
	text: string,
	look: SignLook,
	maxW: number,
): HTMLCanvasElement => {
	const probe = document.createElement("canvas").getContext("2d");
	let px = FONT_PX;
	let tw = 0;
	for (; px > MIN_PX; px--) {
		if (!probe) break;
		probe.font = fontOf(look, px);
		tw = Math.ceil(probe.measureText(text).width);
		if (tw + 8 <= maxW) break;
	}
	const w = Math.min(maxW, tw + 8);
	// 影の ぶん 右と 下に 1画素
	const c = document.createElement("canvas");
	c.width = w + 1;
	c.height = H + 1;
	const g = c.getContext("2d");
	if (!g) return c;
	g.fillStyle = "rgba(0, 0, 0, 0.3)";
	g.fillRect(1, 1, w, H);
	g.fillStyle = look.bg;
	g.fillRect(0, 0, w, H);
	g.fillStyle = look.top;
	g.fillRect(0, 0, w, 1);
	g.fillStyle = look.edge;
	g.fillRect(0, H - 1, w, 1);
	g.fillRect(0, 0, 1, H);
	g.fillRect(w - 1, 0, 1, H);
	const mask = textMask(text, fontOf(look, px), w, w - 6);
	const halo = look.outline ?? look.glow;
	if (halo) {
		const ring = tinted(mask, halo);
		g.save();
		if (look.glow) g.globalAlpha = 0.55;
		for (const [dx, dy] of AROUND) g.drawImage(ring, dx, dy);
		g.restore();
	}
	g.drawImage(tinted(mask, look.ink), 0, 0);
	return c;
};

const boardImage = (b: Board): HTMLCanvasElement => {
	let img = cache.get(b.key);
	if (!img) {
		img = renderBoard(b.text, b.look, b.right - b.left);
		cache.set(b.key, img);
	}
	return img;
};

// ───────────────── 場所 ─────────────────

const facilityBoard = (f: Facility): Board | null => {
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
		key: `f:${f.id}`,
		text: sign.text,
		look: SIGN_LOOKS[sign.look],
		cx: (f.at[0] + col) * TILE,
		// 扉の 上の 壁に かける（扉には かからない）
		bottom: (f.at[1] + row) * TILE - 1,
		left: f.at[0] * TILE,
		right: (f.at[0] + w) * TILE,
	};
};

/** 町の まんなかの 建物の 看板（その 段に 建って いる もの）。 */
const coreBoards = (stage: number): Board[] =>
	CORE_SIGNS.filter(
		(c) => stage >= c.from && (c.until === undefined || stage < c.until),
	).map((c) => {
		const cx = c.at[0] * TILE;
		return {
			key: `c:${c.id}:${stage}`,
			text: c.text(stage),
			look: SIGN_LOOKS[c.look(stage)],
			cx,
			bottom: c.at[1] * TILE - 1,
			left: cx - 4 * TILE,
			right: cx + 4 * TILE,
		};
	});

/** その 段の 建物の 看板。 */
export const signboardDecor = (stage: number): MapDef["decor"] => {
	const boards = [
		...facilitiesAt(stage).flatMap((f) => facilityBoard(f) ?? []),
		...coreBoards(stage),
	];
	if (!boards.length) return undefined;
	return (g, ox, oy) => {
		loadFonts();
		const vw = g.canvas.width;
		const vh = g.canvas.height;
		for (const b of boards) {
			const img = boardImage(b);
			const w = img.width - 1;
			const x = Math.round(
				Math.max(b.left, Math.min(b.right - w, b.cx - w / 2)) - ox,
			);
			const y = b.bottom - H - oy;
			if (x + img.width < 0 || x > vw || y + img.height < 0 || y > vh) continue;
			g.drawImage(img, x, y);
		}
	};
};
