// プリクラの 写真を 描く（組み立ての 手 data/purikura/purikura.ts から、見る たびに 描き直す）。
// - 背景は 決まった 模様（乱数を 使わない。何回 描いても 同じ 絵）。
// - 人は 歩行グラの 前向きを 大きく（ドットの まま）。読めて いない 絵は 影の 形。
// - (x, y) は 写真の 左上、sc は 倍率（板の 上は 1、シールの 台紙は 0.5）。

import { PUYU_WALK } from "../../data/people/cast";
import type { Cast } from "../../data/people/mobs";
import {
	PURI_H,
	PURI_W,
	type PuriPhoto,
	type PuriStamp,
	puriDateText,
	puriLineup,
	puriWalk,
} from "../../data/purikura/purikura";
import { getImage } from "../../engine/assets";
import { drawWalk } from "../../engine/sprite";
import { font, type G } from "../neta/netaBoard";

/** 決まった 散らばり（i 番目の 点の 0〜1）。 */
const hash = (i: number, salt: number): number => {
	let h = Math.imul(i + 1, 2654435761) ^ Math.imul(salt + 7, 40503);
	h = Math.imul(h ^ (h >>> 15), 2246822507);
	h ^= h >>> 13;
	return (h >>> 0) / 2 ** 32;
};

export const heart = (
	g: G,
	cx: number,
	cy: number,
	r: number,
	ink: string,
): void => {
	g.fillStyle = ink;
	g.beginPath();
	g.moveTo(cx, cy + r);
	g.bezierCurveTo(
		cx - r * 1.6,
		cy - r * 0.2,
		cx - r * 0.6,
		cy - r * 1.4,
		cx,
		cy - r * 0.45,
	);
	g.bezierCurveTo(
		cx + r * 0.6,
		cy - r * 1.4,
		cx + r * 1.6,
		cy - r * 0.2,
		cx,
		cy + r,
	);
	g.fill();
};

export const star = (
	g: G,
	cx: number,
	cy: number,
	r: number,
	ink: string,
): void => {
	g.fillStyle = ink;
	g.beginPath();
	for (let i = 0; i < 10; i++) {
		const a = -Math.PI / 2 + (i * Math.PI) / 5;
		const rr = i % 2 ? r * 0.45 : r;
		g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
	}
	g.closePath();
	g.fill();
};

/** ふちどりの 字（スタンプ・日付）。 */
const outlined = (
	g: G,
	s: string,
	x: number,
	y: number,
	px: number,
	ink: string,
	edge: string,
): void => {
	g.font = font(px);
	g.textAlign = "center";
	g.textBaseline = "middle";
	g.lineJoin = "round";
	g.lineWidth = Math.max(2, px / 4);
	g.strokeStyle = edge;
	g.strokeText(s, x, y);
	g.fillStyle = ink;
	g.fillText(s, x, y);
};

// ───────────────── 背景 ─────────────────

const grad = (g: G, top: string, bottom: string, h = PURI_H): void => {
	const gr = g.createLinearGradient(0, 0, 0, h);
	gr.addColorStop(0, top);
	gr.addColorStop(1, bottom);
	g.fillStyle = gr;
	g.fillRect(0, 0, PURI_W, h);
};

const bgHeart = (g: G): void => {
	grad(g, "#ffc4de", "#ff8fbf");
	for (let r = 0; r < 5; r++)
		for (let c = 0; c < 8; c++) {
			const x = c * 22 + (r % 2 ? 11 : 0) + 4;
			const y = r * 22 + 8;
			heart(g, x, y, 5, r % 2 ? "#ffe0ee" : "#ffadd2");
		}
};

const bgStars = (g: G): void => {
	grad(g, "#0e1236", "#3a2468");
	for (let i = 0; i < 46; i++) {
		const x = hash(i, 1) * PURI_W;
		const y = hash(i, 2) * PURI_H * 0.8;
		g.fillStyle = hash(i, 3) < 0.3 ? "#ffe9a8" : "#e8ecff";
		g.fillRect(Math.floor(x), Math.floor(y), 1, 1);
	}
	for (let i = 0; i < 6; i++)
		star(g, 10 + hash(i, 4) * 140, 8 + hash(i, 5) * 40, 3, "#fff3c0");
	g.fillStyle = "#fff6d8";
	g.beginPath();
	g.arc(132, 20, 10, 0, Math.PI * 2);
	g.fill();
	g.fillStyle = "#0e1236";
	g.beginPath();
	g.arc(137, 17, 9, 0, Math.PI * 2);
	g.fill();
};

const bgTown = (g: G): void => {
	grad(g, "#7cc8ff", "#d8f0ff", 70);
	g.fillStyle = "#ffffff";
	for (const [x, y] of [
		[20, 14],
		[96, 10],
		[140, 22],
	]) {
		g.fillRect(x, y, 18, 5);
		g.fillRect(x + 4, y - 3, 10, 3);
	}
	const houses = [
		"#e88a6a",
		"#7ab07a",
		"#c8a0e0",
		"#e8c070",
		"#80a8d8",
		"#d87890",
	];
	for (let i = 0; i < 9; i++) {
		const w = 14 + Math.floor(hash(i, 6) * 10);
		const h = 16 + Math.floor(hash(i, 7) * 22);
		const x = i * 18 - 4;
		const y = 72 - h;
		g.fillStyle = houses[i % houses.length];
		g.fillRect(x, y, w, h);
		g.fillStyle = "#5a4a5a";
		g.beginPath();
		g.moveTo(x - 1, y);
		g.lineTo(x + w / 2, y - 7);
		g.lineTo(x + w + 1, y);
		g.fill();
		g.fillStyle = "#fff8d0";
		for (let wy = y + 4; wy < 68; wy += 7)
			for (let wx = x + 3; wx < x + w - 3; wx += 6) g.fillRect(wx, wy, 3, 3);
	}
	g.fillStyle = "#b8b0a0";
	g.fillRect(0, 72, PURI_W, PURI_H - 72);
	g.fillStyle = "#d8d0c0";
	for (let x = 4; x < PURI_W; x += 16) g.fillRect(x, 84, 8, 2);
};

const bgGrass = (g: G): void => {
	grad(g, "#9ad8ff", "#e4f6ff", 60);
	g.fillStyle = "#8acf5a";
	g.beginPath();
	g.moveTo(0, 62);
	g.quadraticCurveTo(50, 44, 100, 58);
	g.quadraticCurveTo(135, 66, PURI_W, 52);
	g.lineTo(PURI_W, PURI_H);
	g.lineTo(0, PURI_H);
	g.fill();
	g.fillStyle = "#62b040";
	g.fillRect(0, 74, PURI_W, PURI_H - 74);
	// 草（ｗ）が 生えて いる
	g.font = font(8);
	g.textAlign = "center";
	g.textBaseline = "middle";
	for (let i = 0; i < 22; i++) {
		g.fillStyle = hash(i, 8) < 0.5 ? "#3a8a2a" : "#4ea036";
		g.fillText("ｗ", 4 + hash(i, 9) * 152, 64 + hash(i, 10) * 34);
	}
};

const bgBay = (g: G): void => {
	grad(g, "#060a26", "#1a2050", 62);
	// 向こう岸の 町の 灯
	for (let i = 0; i < 40; i++) {
		const x = Math.floor(hash(i, 11) * PURI_W);
		const h = 6 + Math.floor(hash(i, 12) * 14);
		g.fillStyle = "#141838";
		g.fillRect(x, 62 - h, 6, h);
		g.fillStyle = hash(i, 13) < 0.5 ? "#ffd890" : "#a8d0ff";
		g.fillRect(x + 2, 62 - h + 2, 1, 1);
	}
	// 橋（つり橋の 線と 灯）
	g.strokeStyle = "#5a6aa0";
	g.lineWidth = 1;
	g.beginPath();
	g.moveTo(0, 30);
	g.quadraticCurveTo(80, 58, PURI_W, 30);
	g.stroke();
	g.fillStyle = "#3a4878";
	g.fillRect(0, 44, PURI_W, 2);
	for (let x = 4; x < PURI_W; x += 10) {
		g.fillStyle = "#ffe6a0";
		g.fillRect(x, 43, 1, 1);
	}
	// 海と 映り
	grad2(g, 62);
	for (let i = 0; i < 24; i++) {
		g.fillStyle = hash(i, 14) < 0.5 ? "#e8c070" : "#7aa8e8";
		g.globalAlpha = 0.6;
		g.fillRect(
			hash(i, 15) * PURI_W,
			64 + hash(i, 16) * 34,
			4 + hash(i, 17) * 6,
			1,
		);
	}
	g.globalAlpha = 1;
};

const grad2 = (g: G, top: number): void => {
	const gr = g.createLinearGradient(0, top, 0, PURI_H);
	gr.addColorStop(0, "#0c1a40");
	gr.addColorStop(1, "#040814");
	g.fillStyle = gr;
	g.fillRect(0, top, PURI_W, PURI_H - top);
};

const BG_DRAW: readonly ((g: G) => void)[] = [
	bgHeart,
	bgStars,
	bgTown,
	bgGrass,
	bgBay,
];

// ───────────────── 人 ─────────────────

/** 人数ごとの 背たけの 目安（写真の 画素）。 */
const TALL = [0, 72, 64, 52];

const person = (
	g: G,
	ref: string,
	cx: number,
	bottom: number,
	tall: number,
	frame: number,
	tilt: number,
): void => {
	const img = getImage(ref);
	g.save();
	g.translate(cx, bottom);
	if (tilt) g.rotate(tilt);
	if (!img) {
		g.fillStyle = "rgba(40,30,50,0.5)";
		g.beginPath();
		g.arc(0, -tall * 0.75, tall * 0.18, 0, Math.PI * 2);
		g.fill();
		g.fillRect(-tall * 0.18, -tall * 0.56, tall * 0.36, tall * 0.56);
		g.restore();
		return;
	}
	const cw = img.width / 2;
	const ch = img.height / 4;
	// ドットが にじまない 倍率（0.5 きざみ。下地は 2倍）
	const s = Math.max(1, Math.floor((tall / Math.max(cw, ch)) * 2) / 2);
	drawWalk(g, ref, "down", frame, -8 * s, -16 * s, s);
	g.restore();
};

const drawPeople = (
	g: G,
	who: readonly Cast[],
	pose: number,
	frame: number,
): void => {
	const line = puriLineup({ with: who });
	const n = line.length;
	const tall = TALL[n] ?? 52;
	const slot = (PURI_W / n) * (pose === 2 ? 0.62 : n === 3 ? 0.95 : 0.8);
	line.forEach((w, i) => {
		const off = i - (n - 1) / 2;
		const cx = PURI_W / 2 + off * slot;
		const lift = pose === 1 ? (i % 2 ? 7 : 11) : 0;
		const tilt = pose === 3 ? (off === 0 ? 0.1 : off * 0.14) : 0;
		person(g, puriWalk(w), cx, PURI_H - 3 - lift, tall, frame, tilt);
	});
};

// ───────────────── スタンプ ─────────────────

export const drawStamp = (g: G, k: number, x: number, y: number): void => {
	if (k === 0) {
		heart(g, x, y + 1, 8, "#ffffff");
		heart(g, x, y + 1, 6, "#ff4f8b");
	} else if (k === 1) {
		star(g, x, y, 9, "#ffffff");
		star(g, x, y, 7, "#ffcc33");
	} else if (k === 2) outlined(g, "草", x, y, 12, "#2f9a3a", "#ffffff");
	else if (k === 3) {
		const img = getImage(PUYU_WALK);
		if (img) drawWalk(g, PUYU_WALK, "down", 0, x - 12, y - 16, 1.5);
		else {
			g.fillStyle = "#ffe0a0";
			g.beginPath();
			g.arc(x, y, 7, 0, Math.PI * 2);
			g.fill();
		}
	} else if (k === 4) outlined(g, "ズッ友", x, y, 10, "#ff4f9b", "#ffffff");
	else if (k === 5) outlined(g, "おんJ", x, y, 10, "#3a7ae0", "#ffffff");
};

// ───────────────── 1枚 ─────────────────

export type PhotoView = Pick<PuriPhoto, "with" | "bg" | "pose"> & {
	stamps?: readonly PuriStamp[];
	date?: number;
	/** 足ぶみの コマ（撮った あとは 0）。 */
	frame?: number;
};

export const drawPhoto = (
	g: G,
	p: PhotoView,
	x: number,
	y: number,
	sc = 1,
): void => {
	g.save();
	g.translate(x, y);
	g.scale(sc, sc);
	g.save();
	g.beginPath();
	g.rect(0, 0, PURI_W, PURI_H);
	g.clip();
	(BG_DRAW[p.bg] ?? bgHeart)(g);
	drawPeople(g, p.with, p.pose, p.frame ?? 0);
	// 盛れる 光（まわりを 白く ぼかす）
	const gl = g.createRadialGradient(
		PURI_W / 2,
		PURI_H / 2,
		PURI_H * 0.35,
		PURI_W / 2,
		PURI_H / 2,
		PURI_W * 0.62,
	);
	gl.addColorStop(0, "rgba(255,255,255,0)");
	gl.addColorStop(1, "rgba(255,240,250,0.45)");
	g.fillStyle = gl;
	g.fillRect(0, 0, PURI_W, PURI_H);
	for (const s of p.stamps ?? []) drawStamp(g, s.k, s.x, s.y);
	if (p.date)
		outlined(
			g,
			puriDateText(p.date),
			PURI_W - 26,
			PURI_H - 7,
			8,
			"#ff9a3a",
			"#40202a",
		);
	g.restore();
	g.strokeStyle = "#ffffff";
	g.lineWidth = 2;
	g.strokeRect(-1, -1, PURI_W + 2, PURI_H + 2);
	g.restore();
};

/** シールの 台紙（2x2 の 小さな 写し）。左上が (x, y)、大きさは 写真と 同じ くらい。 */
export const drawSheet = (g: G, p: PhotoView, x: number, y: number): void => {
	const w = PURI_W / 2;
	const h = PURI_H / 2;
	const gap = 6;
	g.fillStyle = "#fff4fa";
	g.fillRect(x - 5, y - 5, w * 2 + gap + 10, h * 2 + gap + 10);
	g.strokeStyle = "#ff9ac8";
	g.lineWidth = 1;
	g.strokeRect(x - 4.5, y - 4.5, w * 2 + gap + 9, h * 2 + gap + 9);
	for (let i = 0; i < 4; i++)
		drawPhoto(
			g,
			p,
			x + (i % 2) * (w + gap),
			y + Math.floor(i / 2) * (h + gap),
			0.5,
		);
};
