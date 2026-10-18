// 建物の 看板（村の 地図の decor）。施設は 扉の 上の 壁、町の まんなかの 建物は 決めた 所に 名前の 板を かける
// （名前・場所・見た目は data/village/signs.ts）。
// 画面は 1ソース画素 ＝ 数デバイス画素で 描くので、そのまま 字を 書くと なめらかな 字が ドット絵の 上に 浮く。
// そこで 看板は ソース画素の 大きさの 小さな キャンバスに 描いて、字は にじみを 0 か 1 に 落として ドットに する
// （書体の 形は 残る）。できた 板は 1枚ずつ 覚えて おく。
// 書体は Google Fonts から 看板の 字だけ 読みこむ（text= で しぼる）。読めるまでは DotGothic16 で 描いて、
// 読めたら 描きなおす。

import type { DungeonId } from "../../core/types";
import { isRevived } from "../../data/town/revival";
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
	/** 所の id（施設の id・町の まんなかの 建物の id）。 */
	place: string;
	text: string;
	look: SignLook;
	/** 板の まんなかの x と 下の はしの y（地図の ソース画素）。 */
	cx: number;
	bottom: number;
	/** 板を おさめる 左右（建物の はば）。 */
	left: number;
	right: number;
	/** 生き返って いない 所の 看板と 停電の ネオン（電気が 来て いない：ネオンの にじみ なし・くすんだ 色）。 */
	dead: boolean;
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
	dead = false,
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
	const halo = dead ? look.outline : (look.outline ?? look.glow);
	if (halo) {
		const ring = tinted(mask, halo);
		g.save();
		if (look.glow) g.globalAlpha = 0.55;
		for (const [dx, dy] of AROUND) g.drawImage(ring, dx, dy);
		g.restore();
	}
	g.drawImage(tinted(mask, look.ink), 0, 0);
	if (dead) {
		g.globalCompositeOperation = "source-atop";
		g.fillStyle = "rgba(24, 24, 32, 0.5)";
		g.fillRect(0, 0, c.width, c.height);
	}
	return c;
};

const boardImage = (b: Board): HTMLCanvasElement => {
	let img = cache.get(b.key);
	if (!img) {
		img = renderBoard(b.text, b.look, b.right - b.left, b.dead);
		cache.set(b.key, img);
	}
	return img;
};

// ───────────────── 場所 ─────────────────

/** 電気が 来て いない 看板か（シャッターの 店。停電の あいだは ネオンの 板も）。 */
const unpowered = (
	place: string,
	look: SignLook,
	cleared: readonly DungeonId[],
	blackout: boolean,
): boolean => !isRevived(place, cleared) || (blackout && !!look.glow);

const facilityBoard = (
	f: Facility,
	cleared: readonly DungeonId[],
	blackout: boolean,
	owned = false,
): Board | null => {
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
	const look = SIGN_LOOKS[sign.look];
	const dead = unpowered(f.id, look, cleared, blackout);
	const text = (owned && sign.owned) || sign.text;
	return {
		key: `f:${f.id}:${text}:${dead}`,
		place: f.id,
		text,
		look,
		cx: (f.at[0] + col) * TILE,
		// 扉の 上の 壁に かける（扉には かからない）
		bottom: (f.at[1] + row) * TILE - 1,
		left: f.at[0] * TILE,
		right: (f.at[0] + w) * TILE,
		dead,
	};
};

/** 町の まんなかの 建物の 看板（その 段に 建って いる もの）。 */
const coreBoards = (
	stage: number,
	cleared: readonly DungeonId[],
	blackout: boolean,
): Board[] =>
	CORE_SIGNS.filter(
		(c) => stage >= c.from && (c.until === undefined || stage < c.until),
	).map((c) => {
		const cx = c.at[0] * TILE;
		const look = SIGN_LOOKS[c.look(stage)];
		const dead = unpowered(c.id, look, cleared, blackout);
		return {
			key: `c:${c.id}:${stage}:${dead}`,
			place: c.id,
			text: c.text(stage),
			look,
			cx,
			bottom: c.at[1] * TILE - 1,
			left: cx - 4 * TILE,
			right: cx + 4 * TILE,
			dead,
		};
	});

const boardsAt = (
	stage: number,
	cleared: readonly DungeonId[],
	blackout: boolean,
	owned = false,
): Board[] => [
	...facilitiesAt(stage).flatMap(
		(f) => facilityBoard(f, cleared, blackout, owned) ?? [],
	),
	...coreBoards(stage, cleared, blackout),
];

/**
 * その 段の 施設の 看板の 四角（地図の ソース画素。幅は 字に よるので 建物の はば いっぱいと みる）。
 * 電光表示と 重ならない ことを 試験で 見る。
 */
export const facilitySignRects = (stage: number) =>
	facilitiesAt(stage).flatMap((f) => {
		const b = facilityBoard(f, [], false);
		return b
			? [
					{
						facility: f.id,
						x0: b.left,
						x1: b.right,
						y0: b.bottom - H,
						y1: b.bottom,
					},
				]
			: [];
	});

/** その 段の 町の まんなかの 建物の 看板の 四角（幅は 字の 数から 見つもる）。煙突と 重ならない ことを 試験で 見る。 */
export const coreSignRects = (stage: number) =>
	coreBoards(stage, [], false).map((b) => {
		const w = Math.min(b.right - b.left, [...b.text].length * FONT_PX + 8);
		return {
			place: b.key,
			x0: b.cx - w / 2,
			x1: b.cx + w / 2,
			y0: b.bottom - H,
			y1: b.bottom,
		};
	});

/** 板を 置く 左上（画面の 画素）。 */
const boardPos = (b: Board, img: HTMLCanvasElement, ox: number, oy: number) => {
	const w = img.width - 1;
	return {
		x: Math.round(Math.max(b.left, Math.min(b.right - w, b.cx - w / 2)) - ox),
		y: b.bottom - H - oy,
	};
};

/**
 * その 段の 建物の 看板（生き返って いない 所と 停電の ネオンは 消えた 看板）。
 * ruined の 所の 消えた 看板は 片がわの 釘が ぬけて かたむく（半壊。ui/village/decay.ts）。
 * owned なら キリコの 家の 表札は 名前（SignDef.owned）。
 */
export const signboardDecor = (
	stage: number,
	cleared: readonly DungeonId[],
	blackout = false,
	ruined: (place: string) => boolean = () => false,
	owned = false,
): MapDef["decor"] => {
	const boards = boardsAt(stage, cleared, blackout, owned);
	if (!boards.length) return undefined;
	return (g, ox, oy) => {
		loadFonts();
		const vw = g.canvas.width;
		const vh = g.canvas.height;
		for (const b of boards) {
			const img = boardImage(b);
			const { x, y } = boardPos(b, img, ox, oy);
			if (x + img.width < 0 || x > vw || y + img.height < 0 || y > vh) continue;
			if (b.dead && ruined(b.place)) {
				// 左の 釘だけで ぶらさがる
				g.save();
				g.imageSmoothingEnabled = false;
				g.translate(x + 1, y + 1);
				g.rotate(0.26);
				g.drawImage(img, -1, -1);
				g.restore();
				continue;
			}
			g.drawImage(img, x, y);
		}
	};
};

/**
 * 夜の 看板の 光（夜の 色を 重ねた あと、足し算の 中で 呼ぶ。k は 明かりの 強さ 0〜1）。
 * 開いて いる 所の 電気の 看板だけ 灯る（生き返って いない 所と 停電の ネオンは 電気が 来て いない。
 * 木の 板・表札・プレートは look.lit が 無いので 灯らない）。
 */
export const signboardGlow = (
	stage: number,
	cleared: readonly DungeonId[],
	blackout = false,
): NonNullable<MapDef["lights"]>["glow"] => {
	const boards = boardsAt(stage, cleared, blackout).filter(
		(b) => !b.dead && b.look.lit,
	);
	return (g, ox, oy, k) => {
		if (k < 0.01) return;
		const vw = g.canvas.width;
		const vh = g.canvas.height;
		g.save();
		g.globalAlpha = 0.45 * k;
		for (const b of boards) {
			const img = boardImage(b);
			const { x, y } = boardPos(b, img, ox, oy);
			if (x + img.width < 0 || x > vw || y + img.height < 0 || y > vh) continue;
			g.drawImage(img, x, y);
		}
		g.restore();
	};
};
