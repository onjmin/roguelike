// ゲームセンターの 筐体の 板の 手ごたえ（浮かぶ 点・はじける 粒・画面の ゆれ・白い 光）。
// 決まり（data/arcade/logic.ts）は さわらない。見た目の 乱数は Math.random。

import { type G, txt } from "../neta/netaBoard";

type Pop = { x: number; y: number; s: string; ink: string; t: number };
type Spark = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	ink: string;
	t: number;
};

export type Juice = {
	pops: Pop[];
	sparks: Spark[];
	/** ゆれの 強さ（px）。 */
	shake: number;
	/** 白く 光る 残り秒。 */
	flash: number;
};

export const juice = (): Juice => ({
	pops: [],
	sparks: [],
	shake: 0,
	flash: 0,
});

/** 字を 浮かべる（点・声）。 */
export const pop = (
	j: Juice,
	x: number,
	y: number,
	s: string,
	ink = "#ffe060",
): void => {
	j.pops.push({ x, y, s, ink, t: 0.7 });
};

/** 粒を はじけさせる。 */
export const burst = (
	j: Juice,
	x: number,
	y: number,
	ink: string,
	n = 8,
	v = 60,
): void => {
	for (let i = 0; i < n; i++) {
		const a = Math.random() * Math.PI * 2;
		const sp = v * (0.4 + Math.random() * 0.8);
		j.sparks.push({
			x,
			y,
			vx: Math.cos(a) * sp,
			vy: Math.sin(a) * sp,
			ink,
			t: 0.35 + Math.random() * 0.25,
		});
	}
};

/** 画面を ゆらす（強い ほうを 残す）。 */
export const quake = (j: Juice, px: number): void => {
	j.shake = Math.max(j.shake, px);
};

export const juiceStep = (j: Juice, dt: number): void => {
	for (const p of j.pops) {
		p.t -= dt;
		p.y -= 18 * dt;
	}
	j.pops = j.pops.filter((p) => p.t > 0);
	for (const s of j.sparks) {
		s.t -= dt;
		s.x += s.vx * dt;
		s.y += s.vy * dt;
		s.vy += 120 * dt;
	}
	j.sparks = j.sparks.filter((s) => s.t > 0);
	j.shake = Math.max(0, j.shake - dt * 30);
	j.flash = Math.max(0, j.flash - dt);
};

/** ゆれの ぶん ずらして 描く（帯の 前に 戻す）。 */
export const shaken = (g: G, j: Juice, draw: () => void): void => {
	g.save();
	if (j.shake > 0)
		g.translate(
			Math.round((Math.random() * 2 - 1) * j.shake),
			Math.round((Math.random() * 2 - 1) * j.shake),
		);
	draw();
	g.restore();
};

/** 粒・浮かぶ 字・白い 光を 上に 描く。 */
export const juiceDraw = (g: G, j: Juice, w: number, h: number): void => {
	for (const s of j.sparks) {
		g.fillStyle = s.ink;
		g.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
	}
	for (const p of j.pops) {
		g.globalAlpha = Math.min(1, p.t / 0.3);
		txt(g, p.s, Math.round(p.x), Math.round(p.y) - 4, 7, p.ink, "center");
		g.globalAlpha = 1;
	}
	if (j.flash > 0) {
		g.fillStyle = `rgba(255,255,255,${Math.min(0.5, j.flash * 2)})`;
		g.fillRect(0, 0, w, h);
	}
};
