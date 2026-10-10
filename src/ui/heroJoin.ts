// 仲間が 冒険に 加わる ときの 演出（束音ロゼ・解音ゼロ。ui/villageEvents.ts の heroQuestScript から）。
// 画面いっぱいの ドット絵（240x160 の 小さな キャンバスを 2倍の 下地で 描いて、CSS で 引きのばす。ぼかさない）。
//   0.0s  白く 光る → 夜空
//   0.3s  集中線が 回り、光の 柱が 降りる、きらきら
//   1.3s  主人公が 上から 落ちてくる → 着地で 地ひびき（画面が ゆれる）・衝撃の 輪・紙ふぶき
//         ゼロは つづけて プロト（左）・レン（右）も 降りてくる
//   2.4s  くるくる 回って 前を 向き、名前の 帯が 左右から 入る（「〇〇が　なかまに　なった！」）
//   6.5s  暗く なって おわる。1.5秒 たてば A・タップで とばせる
// 見た目の 乱数は Math.random（冒険の 乱数に さわらない）。

import type { HeroId } from "../core/data/heroes";
import { heroWalk, ZERO_BODY_WALKS } from "../data/cast";
import { loadImage } from "../engine/assets";
import { drawWalk } from "../engine/sprite";
import type { Dir } from "../engine/types";
import { el } from "./dom";
import type { UiCtx } from "./list";
import { sleep, tick } from "./minigameBoard";

const W = 240;
const H = 160;
const GROUND = 118;
const END_MS = 6500;
const SKIP_MS = 1500;
const FADE_MS = 400;

type Joiner = {
	/** 名前の 帯（大きい 字）。 */
	name: string;
	/** 帯の 下の 小さい 字。 */
	sub: string;
	/** 帯と 光の 色。 */
	ink: string;
	glow: string;
	/** 降りてくる 絵（左から 順に。1つ目が まんなか）。 */
	walks: readonly string[];
};

const JOINERS: Record<Exclude<HeroId, "kiriko">, Joiner> = {
	roze: {
		name: "束音ロゼ",
		sub: "が　なかまに　なった！",
		ink: "#ff6f91",
		glow: "#ffd0dc",
		walks: [heroWalk({ hero: "roze" })],
	},
	zero: {
		name: "解音ゼロ",
		sub: "が　なかまに　なった！",
		ink: "#5cc8f0",
		glow: "#d0f0ff",
		walks: ZERO_BODY_WALKS,
	},
};

/** 降りてくる 1体（x は まんなか、t は 落ちはじめる 時刻 ms、scale は 大きさ）。 */
type Drop = { walk: string; x: number; t: number; scale: number };

type Bit = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	c: string;
	life: number;
	size: number;
};

const CONFETTI = [
	"#ff6f91",
	"#ffe060",
	"#5cc8f0",
	"#7be0a0",
	"#ffffff",
	"#c070f0",
];

const ease = (k: number): number => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;

/** 仲間が 加わる 演出（とばすか おわるまで 待つ）。 */
export const heroJoinScene = async (
	ctx: UiCtx,
	hero: Exclude<HeroId, "kiriko">,
): Promise<void> => {
	const j = JOINERS[hero];
	await Promise.all(j.walks.map((w) => loadImage(w)));
	const canvas = el("canvas", { class: "hero-join-canvas" });
	canvas.width = W * 2;
	canvas.height = H * 2;
	const root = el("div", { class: "hero-join" }, [canvas]);
	ctx.ui.appendChild(root);
	const g = canvas.getContext("2d");
	if (!g) {
		root.remove();
		return;
	}
	g.setTransform(2, 0, 0, 2, 0, 0);
	g.imageSmoothingEnabled = false;

	const drops: Drop[] =
		j.walks.length > 1
			? [
					{ walk: j.walks[0] ?? "", x: W / 2, t: 1300, scale: 4 },
					{ walk: j.walks[1] ?? "", x: W / 2 - 64, t: 1750, scale: 3 },
					{ walk: j.walks[2] ?? "", x: W / 2 + 64, t: 2050, scale: 3 },
				]
			: [{ walk: j.walks[0] ?? "", x: W / 2, t: 1300, scale: 4 }];
	const FALL_MS = 380;
	const landed = new Set<number>();
	const bits: Bit[] = [];
	const rings: { x: number; t: number; big: boolean }[] = [];
	let shakeUntil = 0;
	const stars = Array.from({ length: 40 }, () => ({
		x: Math.floor(Math.random() * W),
		y: Math.floor(Math.random() * (GROUND - 10)),
		p: Math.random() * 6,
	}));

	const burst = (x: number, y: number, n: number) => {
		for (let i = 0; i < n; i++) {
			const a = Math.random() * Math.PI * 2;
			const v = 40 + Math.random() * 110;
			bits.push({
				x,
				y,
				vx: Math.cos(a) * v,
				vy: Math.sin(a) * v - 60,
				c: CONFETTI[i % CONFETTI.length] ?? "#fff",
				life: 1.4 + Math.random() * 1.2,
				size: Math.random() < 0.3 ? 2 : 1,
			});
		}
	};

	// とばす（1.5秒 たってから）
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

	const draw = (ms: number, dt: number) => {
		// ゆれ
		const shake = ms < shakeUntil ? Math.round((Math.random() - 0.5) * 6) : 0;
		g.save();
		g.translate(shake, shake ? Math.round((Math.random() - 0.5) * 4) : 0);
		// 夜空（下へ いくほど 明るい 帯）
		for (let y = 0; y < H; y += 8) {
			const k = y / H;
			g.fillStyle = `rgb(${Math.round(10 + 30 * k)},${Math.round(8 + 14 * k)},${Math.round(30 + 40 * k)})`;
			g.fillRect(-4, y, W + 8, 8);
		}
		// 星（またたく）
		for (const s of stars) {
			const on = Math.sin(ms / 220 + s.p) > 0.3;
			g.fillStyle = on ? "#ffffff" : "#6a6a9a";
			g.fillRect(s.x, s.y, 1, 1);
		}
		// 集中線（回る）
		if (ms > 300) {
			const k = Math.min(1, (ms - 300) / 600);
			g.save();
			g.translate(W / 2, GROUND - 30);
			g.rotate(ms / 1800);
			g.fillStyle = j.glow;
			g.globalAlpha = 0.18 * k;
			for (let i = 0; i < 16; i++) {
				g.rotate((Math.PI * 2) / 16);
				g.beginPath();
				g.moveTo(0, 0);
				g.lineTo(220, -6);
				g.lineTo(220, 6);
				g.fill();
			}
			g.restore();
			g.globalAlpha = 1;
		}
		// 光の 柱（上から 降りてくる）
		if (ms > 300) {
			const k = ease((ms - 300) / 700);
			const w = 22 + Math.sin(ms / 90) * 2;
			g.globalAlpha = 0.55;
			g.fillStyle = j.glow;
			g.fillRect(
				Math.round(W / 2 - w / 2),
				0,
				Math.round(w),
				Math.round(GROUND * k),
			);
			g.globalAlpha = 0.9;
			g.fillStyle = "#ffffff";
			g.fillRect(W / 2 - 3, 0, 6, Math.round(GROUND * k));
			g.globalAlpha = 1;
		}
		// 地面
		g.fillStyle = "#2a1c3a";
		g.fillRect(-4, GROUND, W + 8, H - GROUND + 4);
		g.fillStyle = j.ink;
		g.fillRect(-4, GROUND, W + 8, 1);
		// 衝撃の 輪（ドットの だ円）
		for (const r of rings) {
			const k = (ms - r.t) / 600;
			if (k < 0 || k > 1) continue;
			const rx = (r.big ? 90 : 50) * ease(k);
			g.fillStyle = k < 0.5 ? "#ffffff" : j.ink;
			for (let a = 0; a < Math.PI * 2; a += 0.12) {
				const x = Math.round(r.x + Math.cos(a) * rx);
				const y = Math.round(GROUND + Math.sin(a) * rx * 0.22);
				g.fillRect(x, y, 2, 1);
			}
		}
		// 降りてくる 主人公
		const DIRS: Dir[] = ["down", "left", "up", "right"];
		drops.forEach((d, i) => {
			if (ms < d.t) return;
			const k = Math.min(1, (ms - d.t) / FALL_MS);
			const tile = 16 * d.scale;
			const y = -tile + (GROUND - 14 * d.scale + tile) * (k * k);
			if (k >= 1 && !landed.has(i)) {
				landed.add(i);
				rings.push({ x: d.x, t: ms, big: i === 0 });
				burst(d.x, GROUND - 4, i === 0 ? 70 : 30);
				shakeUntil = ms + (i === 0 ? 450 : 220);
				ctx.se(i === 0 ? "critical" : "decide");
			}
			// 着いたら くるくる 回って 前を 向く（足ぶみ）
			const since = ms - d.t - FALL_MS;
			const spin = since > 0 && since < 900;
			const dir: Dir = spin
				? (DIRS[Math.floor(since / 110) % 4] ?? "down")
				: "down";
			const frame = Math.floor(ms / 220) % 2;
			// 足もとの 影
			if (k >= 1) {
				g.fillStyle = "rgba(0,0,0,0.35)";
				g.fillRect(Math.round(d.x - 5 * d.scale), GROUND - 1, 10 * d.scale, 2);
			}
			drawWalk(
				g,
				d.walk,
				dir,
				frame,
				Math.round(d.x - tile / 2),
				Math.round(
					k < 1
						? y
						: GROUND -
								tile -
								(since < 160 && since > 0
									? Math.round(6 * Math.sin((since / 160) * Math.PI))
									: 0),
				),
				d.scale,
			);
		});
		// 紙ふぶき
		for (const b of bits) {
			b.vy += 140 * dt;
			b.vx *= 0.99;
			b.x += b.vx * dt;
			b.y += b.vy * dt;
			b.life -= dt;
			if (b.life <= 0) continue;
			g.fillStyle = b.c;
			g.fillRect(
				Math.round(b.x),
				Math.round(b.y),
				b.size,
				b.size + (Math.floor(ms / 80 + b.x) % 2),
			);
		}
		// 名前の 帯（左右から 入る）
		const last = drops[drops.length - 1];
		const bannerAt = (last?.t ?? 1300) + FALL_MS + 500;
		if (ms > bannerAt) {
			const k = ease((ms - bannerAt) / 350);
			const y = 14;
			g.fillStyle = "rgba(0,0,0,0.6)";
			g.fillRect(Math.round(-W + W * k), y, W, 34);
			g.fillStyle = j.ink;
			g.fillRect(Math.round(-W + W * k), y, W, 2);
			g.fillRect(Math.round(W - W * k), y + 32, W, 2);
			g.font = "20px 'DotGothic16', monospace";
			g.textAlign = "center";
			g.textBaseline = "top";
			// ふちどり
			const nx = Math.round(W / 2 + W * (1 - k));
			g.fillStyle = "#000000";
			for (const [ox, oy] of [
				[-1, 0],
				[1, 0],
				[0, -1],
				[0, 1],
			] as const)
				g.fillText(j.name, nx + ox, y + 3 + oy);
			const flick = Math.floor(ms / 120) % 6 === 0;
			g.fillStyle = flick ? "#ffffff" : j.ink;
			g.fillText(j.name, nx, y + 3);
			g.font = "8px 'DotGothic16', monospace";
			g.fillStyle = "#ffffff";
			g.fillText(j.sub, Math.round(W / 2 - W * (1 - k)), y + 24);
			// ときどき 紙ふぶきを 足す
			if (Math.random() < 0.25) burst(Math.random() * W, -4, 2);
		}
		g.restore();
		// はじめの 白い 光
		if (ms < 300) {
			g.fillStyle = `rgba(255,255,255,${1 - ms / 300})`;
			g.fillRect(0, 0, W, H);
		}
	};

	try {
		ctx.se("spell");
		t0 = performance.now();
		let last = t0;
		let jingle = false;
		for (;;) {
			const now = await tick();
			const ms = now - t0;
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			const lastDrop = drops[drops.length - 1];
			if (!jingle && ms > (lastDrop?.t ?? 1300) + FALL_MS + 500) {
				jingle = true;
				ctx.se("victory");
			}
			draw(ms, dt);
			if (skip || ms >= END_MS) break;
		}
		// 暗く して おわる
		const f0 = performance.now();
		for (;;) {
			const now = await tick();
			const k = (now - f0) / FADE_MS;
			draw(now - t0, 0.016);
			g.fillStyle = `rgba(0,0,0,${Math.min(1, k)})`;
			g.fillRect(0, 0, W, H);
			if (k >= 1) break;
		}
		await sleep(100);
	} finally {
		pop();
		root.removeEventListener("pointerdown", press);
		root.remove();
	}
};
