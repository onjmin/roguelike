// 仲間が 冒険に 加わる ときの 演出（束音ロゼ・解音ゼロ。ui/villageEvents.ts の heroQuestScript から）。
// 落ちついた 式典ふう：紺の 地に 金の 細い 罫と 枠、白い 線画の 立ち絵、静かに 昇る 光の 粒。
// 立ち絵・字は ドットの 網目（4x4 の ディザ）で 浮かびあがる。揺れ・紙ふぶき・集中線は 使わない。
//   0.0s  暗い 中から 金の 罫が まんなかで 横へ のびる
//   0.7s  罫が 上下に わかれて 枠に なり、四すみの 金具が 出る
//   1.0s  右に 立ち絵（白い 線画）。ゼロは メインさんの あと、うしろに プロト・レンが うすく
//   1.8s  左に「NEW MEMBER」・名前・読み・罫・ひとこと・歩行グラ を 順に
//   7.0s  暗く なって おわる。1.5秒 たてば A・タップで とばせる
// 画面は 240x160 の 座標を 2倍の 下地で 描く（ぼかさず 引きのばす）。見た目の 乱数は Math.random。

import type { HeroId } from "../core/data/heroes";
import { heroWalk, ZERO_BODY_WALKS } from "../data/cast";
import { loadImage } from "../engine/assets";
import { drawWalk } from "../engine/sprite";
import { el } from "./dom";
import type { UiCtx } from "./list";
import { sleep, tick } from "./minigameBoard";

const W = 240;
const H = 160;
/** 下地の 倍率。 */
const S = 2;
const END_MS = 7000;
const SKIP_MS = 1500;
const FADE_MS = 500;
const GOLD = "#d8b968";
const GOLD_DIM = "#8a7440";
const FONT = "'DotGothic16', monospace";

type Joiner = {
	name: string;
	/** 読み（ローマ字。名前の 下）。 */
	reading: string;
	/** 罫の 下の 2行。 */
	lines: readonly [string, string];
	/** 立ち絵の 光の 色。 */
	glow: string;
	/** 立ち絵（1つ目が 主役。ゼロは サブ機も）。 */
	portraits: readonly string[];
	walk: string;
};

const JOINERS: Record<Exclude<HeroId, "kiriko">, Joiner> = {
	roze: {
		name: "束音ロゼ",
		reading: "TABANE  ROZE",
		lines: ["壁の　中を　歩く。", "……常識アル。"],
		glow: "#ff6f91",
		portraits: ["portraits/roze.png"],
		walk: heroWalk({ hero: "roze" }),
	},
	zero: {
		name: "解音ゼロ",
		reading: "TOKINE  ZERO",
		lines: ["VHz8-0・HeBc-0・XQxS-0", "3体で　ひとり。"],
		glow: "#5cc8f0",
		portraits: [
			"portraits/zero.png",
			"portraits/zero_proto.png",
			"portraits/zero_ren.png",
		],
		walk: ZERO_BODY_WALKS[0] ?? heroWalk({ hero: "zero" }),
	},
};

/** 4x4 の ディザの 順（0〜15）。 */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** ディザの 1目（下地の 画素）。 */
const CELL = 2;

const clamp01 = (k: number): number => Math.max(0, Math.min(1, k));
const ease = (k: number): number => 1 - (1 - clamp01(k)) ** 3;

/** 下地の 大きさの キャンバス。 */
const layer = (w: number, h: number): HTMLCanvasElement => {
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	return c;
};

/**
 * src を k（0〜1）だけ ディザで 見せて 描く（dx, dy は 下地の 画素）。from は 浮かぶ 向き：
 * "dither" は 一面に、"left" は 左から。
 */
const reveal = (
	g: CanvasRenderingContext2D,
	src: HTMLCanvasElement,
	dx: number,
	dy: number,
	k: number,
	from: "dither" | "left" = "dither",
	alpha = 1,
): void => {
	if (k <= 0) return;
	if (k >= 1) {
		g.globalAlpha = alpha;
		g.drawImage(src, dx, dy);
		g.globalAlpha = 1;
		return;
	}
	const t = layer(src.width, src.height);
	const tg = t.getContext("2d");
	if (!tg) return;
	tg.drawImage(src, 0, 0);
	const cols = Math.ceil(src.width / CELL);
	const rows = Math.ceil(src.height / CELL);
	for (let y = 0; y < rows; y++)
		for (let x = 0; x < cols; x++) {
			const b = (BAYER[(y % 4) * 4 + (x % 4)] ?? 0) / 16;
			const edge = from === "left" ? k * 1.4 - (x / cols) * 0.8 : k;
			if (b >= edge) tg.clearRect(x * CELL, y * CELL, CELL, CELL);
		}
	g.globalAlpha = alpha;
	g.drawImage(t, dx, dy);
	g.globalAlpha = 1;
};

/**
 * 立ち絵（白地に 黒い 線の 線画）から 線だけを 取りだして 白く し、うしろに 色の 光を 敷く
 * （下地の 画素 size 四方）。暗い ほど 濃い 線に する（白地は 消える）。
 */
const lineArt = (
	img: HTMLImageElement | null,
	size: number,
	glow: string,
): HTMLCanvasElement => {
	const out = layer(size, size);
	const g = out.getContext("2d");
	if (!g || !img) return out;
	const lines = layer(size, size);
	const lg = lines.getContext("2d", { willReadFrequently: true });
	if (!lg) return out;
	lg.drawImage(img, 0, 0, size, size);
	try {
		const d = lg.getImageData(0, 0, size, size);
		const px = d.data;
		for (let i = 0; i < px.length; i += 4) {
			const lum =
				0.299 * (px[i] ?? 255) +
				0.587 * (px[i + 1] ?? 255) +
				0.114 * (px[i + 2] ?? 255);
			const ink = (1 - lum / 255) * ((px[i + 3] ?? 0) / 255);
			px[i] = 244;
			px[i + 1] = 240;
			px[i + 2] = 230;
			px[i + 3] = ink < 0.2 ? 0 : Math.min(255, Math.round(ink * 320));
		}
		lg.putImageData(d, 0, 0);
	} catch {
		// 読めない 画像（別の 場所から）なら そのまま
	}
	// 光（ぼかした 色の 写し）
	const halo = layer(size, size);
	const hg = halo.getContext("2d");
	if (hg) {
		hg.drawImage(lines, 0, 0);
		hg.globalCompositeOperation = "source-in";
		hg.fillStyle = glow;
		hg.fillRect(0, 0, size, size);
		g.filter = "blur(4px)";
		g.drawImage(halo, 0, 0);
		g.drawImage(halo, 0, 0);
		g.filter = "none";
	}
	g.drawImage(lines, 0, 0);
	return out;
};

/** 字の 札（下地の 画素）。 */
const label = (
	text: string,
	px: number,
	ink: string,
	spacing = 0,
): HTMLCanvasElement => {
	const probe = layer(1, 1).getContext("2d");
	const f = `${px * S}px ${FONT}`;
	let w = px * S * text.length;
	if (probe) {
		probe.font = f;
		w =
			Math.ceil(probe.measureText(text).width + spacing * S * text.length) + 4;
	}
	const c = layer(Math.max(4, w), px * S + 6);
	const g = c.getContext("2d");
	if (!g) return c;
	g.font = f;
	g.textBaseline = "top";
	g.fillStyle = ink;
	if (spacing) {
		let x = 0;
		for (const ch of text) {
			g.fillText(ch, x, 2);
			x += g.measureText(ch).width + spacing * S;
		}
	} else g.fillText(text, 0, 2);
	return c;
};

/** 仲間が 加わる 演出（とばすか おわるまで 待つ）。 */
export const heroJoinScene = async (
	ctx: UiCtx,
	hero: Exclude<HeroId, "kiriko">,
): Promise<void> => {
	const j = JOINERS[hero];
	const imgs = await Promise.all(j.portraits.map((p) => loadImage(p)));
	await loadImage(j.walk);
	const canvas = el("canvas", { class: "hero-join-canvas" });
	canvas.width = W * S;
	canvas.height = H * S;
	const root = el("div", { class: "hero-join" }, [canvas]);
	ctx.ui.appendChild(root);
	const g = canvas.getContext("2d");
	if (!g) {
		root.remove();
		return;
	}
	g.imageSmoothingEnabled = false;

	// 立ち絵（主役は 大きく 右に、サブ機は 小さく うしろに）
	const multi = j.portraits.length > 1;
	const mainLogical = multi ? 128 : 150;
	const mainSize = mainLogical * S;
	const subSize = 100 * S;
	const portraits = imgs.map((img, i) =>
		lineArt(img, i === 0 ? mainSize : subSize, j.glow),
	);
	// 字の 札
	const tag = label("NEW MEMBER", 7, GOLD, 2);
	const name = label(j.name, 20, "#f4f0e6");
	const reading = label(j.reading, 6, "#9a96b0", 1);
	const line1 = label(j.lines[0], 8, "#d8d4e6");
	const line2 = label(j.lines[1], 8, "#d8d4e6");
	// 光の 粒（ゆっくり 昇る）
	const motes = Array.from({ length: 26 }, () => ({
		x: Math.random() * W,
		y: Math.random() * H,
		v: 3 + Math.random() * 6,
		p: Math.random() * 6,
	}));

	let skip = false;
	let t0 = performance.now();
	const press = () => {
		if (performance.now() - t0 >= SKIP_MS) skip = true;
	};
	const pop = ctx.input.push(
		(k, repeat) => {
			if (!repeat && (k === "a" || k === "b")) press();
		},
		{ tap: "a" },
	);
	root.addEventListener("pointerdown", press);

	const px = (v: number) => Math.round(v) * S;
	const rect = (x: number, y: number, w: number, h: number, c: string) => {
		g.fillStyle = c;
		g.fillRect(
			px(x),
			px(y),
			Math.max(S, Math.round(w) * S),
			Math.max(S, Math.round(h) * S),
		);
	};
	/** 罫の 端の ひし形。 */
	const diamond = (x: number, y: number, c: string) => {
		rect(x, y - 1, 1, 3, c);
		rect(x - 1, y, 3, 1, c);
	};

	const TOP = 18;
	const BOTTOM = 142;
	const draw = (ms: number, dt: number) => {
		// 地：紺の 帯（上下が 暗い）
		for (let y = 0; y < H; y += 4) {
			const k = 1 - Math.abs(y - H / 2) / (H / 2);
			const c = Math.round(10 + 10 * k);
			g.fillStyle = `rgb(${c},${c + 2},${Math.round(c * 2 + 6)})`;
			g.fillRect(0, y * S, W * S, 4 * S);
		}
		// 光の 粒
		for (const m of motes) {
			m.y -= m.v * dt;
			if (m.y < 0) {
				m.y = H;
				m.x = Math.random() * W;
			}
			const tw = Math.sin(ms / 400 + m.p);
			if (tw > -0.2) rect(m.x, m.y, 1, 1, tw > 0.6 ? GOLD : GOLD_DIM);
		}
		// 罫：まんなかで のびる → 上下へ わかれる
		const grow = ease(ms / 700);
		const split = ease((ms - 700) / 700);
		const half = (W / 2 - 10) * grow;
		const yTop = H / 2 + (TOP - H / 2) * split;
		const yBot = H / 2 + (BOTTOM - H / 2) * split;
		for (const y of split > 0 ? [yTop, yBot] : [H / 2]) {
			rect(W / 2 - half, y, half * 2, 1, GOLD);
			if (grow >= 1) {
				diamond(W / 2 - half - 3, y, GOLD);
				diamond(W / 2 + half + 3, y, GOLD);
			}
		}
		// 四すみの 金具
		const corner = clamp01((ms - 1200) / 400);
		if (corner > 0) {
			const c = corner >= 1 ? GOLD : GOLD_DIM;
			for (const [x, y, sx, sy] of [
				[6, TOP + 4, 1, 1],
				[W - 7, TOP + 4, -1, 1],
				[6, BOTTOM - 4, 1, -1],
				[W - 7, BOTTOM - 4, -1, -1],
			] as const) {
				rect(Math.min(x, x + sx * 8), y, 9, 1, c);
				rect(x, Math.min(y, y + sy * 8), 1, 9, c);
			}
		}
		// 立ち絵（サブ機は うしろに うすく、主役の あと）。枠の 内に 切りとる
		g.save();
		g.beginPath();
		g.rect(0, (TOP + 1) * S, W * S, (BOTTOM - TOP - 1) * S);
		g.clip();
		const pBase = 1000;
		const mainX = (multi ? 118 : 110) * S;
		const mainY = ((H - mainLogical) / 2 + (multi ? 6 : 2)) * S;
		if (portraits.length > 1) {
			reveal(
				g,
				portraits[1] as HTMLCanvasElement,
				76 * S,
				44 * S,
				(ms - pBase - 500) / 900,
				"left",
				0.45,
			);
			reveal(
				g,
				portraits[2] as HTMLCanvasElement,
				166 * S,
				44 * S,
				(ms - pBase - 800) / 900,
				"left",
				0.45,
			);
		}
		if (portraits[0])
			reveal(g, portraits[0], mainX, mainY, (ms - pBase) / 1100, "left");
		g.restore();
		// 左の 字（順に 浮かぶ）
		const tx = 16 * S;
		const tBase = 1800;
		reveal(g, tag, tx, 34 * S, (ms - tBase) / 400);
		reveal(g, name, tx, 46 * S, (ms - tBase - 250) / 600);
		reveal(g, reading, tx, 72 * S, (ms - tBase - 650) / 400);
		const rule = ease((ms - tBase - 850) / 500);
		if (rule > 0) rect(16, 84, 92 * rule, 1, GOLD_DIM);
		reveal(g, line1, tx, 90 * S, (ms - tBase - 1100) / 400);
		reveal(g, line2, tx, 102 * S, (ms - tBase - 1350) / 400);
		// 歩行グラ（足ぶみ。ドットの まま）
		const walkK = clamp01((ms - tBase - 1600) / 400);
		if (walkK > 0) {
			g.globalAlpha = walkK >= 1 ? 1 : Math.floor(walkK * 4) / 4;
			drawWalk(g, j.walk, "down", Math.floor(ms / 400) % 2, tx, 112 * S, S);
			g.globalAlpha = 1;
		}
	};

	try {
		ctx.se("chapter");
		t0 = performance.now();
		let last = t0;
		let fanfare = false;
		for (;;) {
			const now = await tick();
			const ms = now - t0;
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			// 名前が 浮かぶ ところで ファンファーレ
			if (!fanfare && ms > 2100) {
				fanfare = true;
				ctx.se("levelup");
			}
			draw(ms, dt);
			if (skip || ms >= END_MS) break;
		}
		const f0 = performance.now();
		for (;;) {
			const now = await tick();
			const k = (now - f0) / FADE_MS;
			draw(now - t0, 0.016);
			g.fillStyle = `rgba(0,0,0,${Math.min(1, k)})`;
			g.fillRect(0, 0, W * S, H * S);
			if (k >= 1) break;
		}
		await sleep(100);
	} finally {
		pop();
		root.removeEventListener("pointerdown", press);
		root.remove();
	}
};
