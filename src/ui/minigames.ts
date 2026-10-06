// 裏シナリオの「急に はじまる 別ゲー」（STORY.md §5.98）。村の 窓の 上に 1枚の 板を 出して、A／タップ 1つで 遊ぶ。
// どちらも 冒険の 乱数・記録・リプレイには 触らない（村の 場面の 中だけ。見た目の 乱数は Math.random）。
//
// - 1打席（playBatting）：野球chの 跡地へ 降りる 前の 関所。原住民が 投げる 球を、A／タップで 打つ。
//   球が 打者の 前（ゾーン）に 来た ときに 振れば ヒット。はずせば 空振り、見送れば 見逃し。3つで 三振（やりなおせる）。
// - 1000取り（playGetter）：避難Jの 結。跡地の 次スレの レス番が 速く なりながら 進む。>>999 で 書きこめば 勝ち
//   （1000 は あけておく：1 の 裏の「1000は　ひとりで　取るもんやない」）。早ければ 1000ゲッターに 1000 を 取られ、
//   1000 を 過ぎても 取られる。負けたら 次スレで やりなおせる（呼ぶ側が きく）。
//
// 文字は 1行 全角22字まで。色は style.css の .mini。

import { el } from "./dom";
import type { UiCtx } from "./list";

/** 板を 1枚 置いて、閉じる 手を 返す。 */
const board = (
	ctx: UiCtx,
	title: string,
	hint: string,
): {
	root: HTMLElement;
	canvas: HTMLCanvasElement;
	g: CanvasRenderingContext2D;
	note: HTMLElement;
	close: () => void;
} => {
	const canvas = el("canvas", { class: "mini-canvas" });
	canvas.width = 240;
	canvas.height = 150;
	const note = el("div", { class: "mini-note", text: "" });
	const root = el("div", { class: "mini window" }, [
		el("div", { class: "mini-title", text: title }),
		canvas,
		note,
		el("div", { class: "mini-hint", text: hint }),
	]);
	ctx.ui.appendChild(root);
	const g = canvas.getContext("2d");
	if (!g) throw new Error("canvas");
	g.imageSmoothingEnabled = false;
	return { root, canvas, g, note, close: () => root.remove() };
};

/** 次の 描画か 50ms（ペインが 隠れて rAF が 止まっても 進む）。 */
const tick = (): Promise<number> =>
	new Promise((r) => {
		const id = setTimeout(() => r(performance.now()), 50);
		requestAnimationFrame((t) => {
			clearTimeout(id);
			r(t);
		});
	});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A か タップで 1回 押されるのを 待つ 仕組み（押されたら true。B で false）。 */
const presses = (
	ctx: UiCtx,
	root: HTMLElement,
): { take: () => "a" | "b" | null; stop: () => void } => {
	let pressed: "a" | "b" | null = null;
	const pop = ctx.input.push(
		(k, repeat) => {
			if (repeat) return;
			if (k === "a") pressed = "a";
			else if (k === "b") pressed = "b";
		},
		{ tap: "a" },
	);
	const onDown = (e: PointerEvent) => {
		e.preventDefault();
		pressed = "a";
	};
	root.addEventListener("pointerdown", onDown);
	return {
		take: () => {
			const p = pressed;
			pressed = null;
			return p;
		},
		stop: () => {
			pop();
			root.removeEventListener("pointerdown", onDown);
		},
	};
};

// ───────────────── 1打席 ─────────────────

/** 球が 打者の 前に 来ている x（この あいだに 振れば ヒット）。 */
const ZONE: readonly [number, number] = [168, 196];
/** 投手と 打者の x。 */
const MOUND_X = 44;
const PLATE_X = 196;

const drawField = (
	g: CanvasRenderingContext2D,
	ball: { x: number; y: number } | null,
	swing: number,
	strikes: number,
	hit: { x: number; y: number } | null,
): void => {
	const W = 240;
	const H = 150;
	// 夜の 球場（本館の モニターと 同じ 色）
	g.fillStyle = "#10241a";
	g.fillRect(0, 0, W, H);
	g.fillStyle = "#fff6c0";
	for (const x of [20, 60, 180, 220]) g.fillRect(x, 10, 3, 2);
	g.fillStyle = "#2f6e35";
	g.fillRect(0, 96, W, H - 96);
	g.fillStyle = "#3a7d40";
	g.fillRect(0, 96, W, 2);
	g.fillStyle = "#c9a36a";
	g.fillRect(MOUND_X - 10, 100, 20, 4);
	g.fillRect(PLATE_X - 14, 112, 28, 4);
	// ゾーン（うすく）
	g.fillStyle = "rgba(255,255,255,0.08)";
	g.fillRect(ZONE[0], 60, ZONE[1] - ZONE[0], 52);
	// 投手：原住民 (´・ω・｀)
	g.font = "11px 'DotGothic16', monospace";
	g.textAlign = "center";
	g.fillStyle = "#e8e8f0";
	g.fillText("(´・ω・｀)", MOUND_X, 92);
	g.fillStyle = "#b8c8d8";
	g.fillRect(MOUND_X - 5, 93, 10, 6);
	// 打者：キリコ（ンゴ）。振ると バットが 回る
	const bx = PLATE_X + 10;
	g.fillStyle = "#f4f2ea";
	g.fillRect(bx - 4, 78, 8, 8);
	g.fillStyle = "#4a5a8a";
	g.fillRect(bx - 5, 86, 10, 12);
	g.fillStyle = "#d0d0d8";
	if (swing > 0) {
		const a = -1.2 + (1 - swing) * 2.6;
		g.save();
		g.translate(bx - 6, 84);
		g.rotate(a);
		g.fillRect(0, -2, 24, 3);
		g.restore();
	} else g.fillRect(bx - 8, 66, 3, 20);
	// 球
	if (ball) {
		g.fillStyle = "#ffffff";
		g.fillRect(Math.round(ball.x) - 2, Math.round(ball.y) - 2, 4, 4);
		g.fillStyle = "#e04040";
		g.fillRect(Math.round(ball.x) - 1, Math.round(ball.y) - 2, 1, 4);
	}
	if (hit) {
		g.fillStyle = "#ffe060";
		g.fillRect(Math.round(hit.x) - 2, Math.round(hit.y) - 2, 4, 4);
	}
	// ストライク
	g.textAlign = "left";
	g.font = "10px 'DotGothic16', monospace";
	g.fillStyle = "#ffe060";
	g.fillText(
		`S ${"●".repeat(strikes)}${"○".repeat(Math.max(0, 2 - strikes))}`,
		6,
		142,
	);
	g.textAlign = "right";
	g.fillStyle = "#c8c8d0";
	g.fillText("野球ch", W - 6, 142);
};

/**
 * 1打席。ヒットで true（1本で よい）。三振で false。B で やめても false。
 * 球の 速さは 1球ごとに ばらつく（0.8〜1.3秒。3球目は 遅い 球も）。
 */
export const playBatting = async (ctx: UiCtx): Promise<boolean> => {
	const b = board(ctx, "野球ch　1打席", "A／タップで　スイング");
	const p = presses(ctx, b.root);
	const say = (t: string) => {
		b.note.textContent = t;
	};
	try {
		let strikes = 0;
		say("原住民が　ふりかぶった……");
		drawField(b.g, null, 0, strikes, null);
		await sleep(700);
		p.take();
		for (;;) {
			// 1球
			const dur = 800 + Math.random() * 500;
			const curve = (Math.random() - 0.5) * 30;
			const t0 = await tick();
			let swing = 0;
			let swungAt: number | null = null;
			let result: "hit" | "miss" | "look" | "quit" | null = null;
			let hit: { x: number; y: number } | null = null;
			say("");
			for (;;) {
				const t = await tick();
				const k = (t - t0) / dur;
				const ball =
					k <= 1.05
						? {
								x: MOUND_X + (PLATE_X + 6 - MOUND_X) * k,
								y: 86 - Math.sin(k * Math.PI) * 24 + curve * k,
							}
						: null;
				const pr = p.take();
				if (pr === "b") {
					result = "quit";
					break;
				}
				if (pr === "a" && swungAt === null) {
					swungAt = t;
					swing = 1;
					ctx.se("swing_blunt");
					if (ball && ball.x >= ZONE[0] && ball.x <= ZONE[1]) {
						result = "hit";
						hit = { x: ball.x, y: ball.y };
						ctx.se("hit_blunt");
						break;
					}
				}
				if (swungAt !== null) swing = Math.max(0, 1 - (t - swungAt) / 220);
				if (!ball) {
					result = swungAt === null ? "look" : "miss";
					break;
				}
				drawField(b.g, ball, swing, strikes, null);
			}
			if (result === "quit") return false;
			if (result === "hit" && hit) {
				// 打球が 飛んでいく
				say("カキーン！　……ヒット！");
				const h0 = await tick();
				for (;;) {
					const t = await tick();
					const k = (t - h0) / 700;
					if (k > 1) break;
					drawField(b.g, null, Math.max(0, 1 - k * 3), strikes, {
						x: hit.x - 170 * k,
						y: hit.y - 90 * k + 60 * k * k,
					});
				}
				await sleep(500);
				return true;
			}
			strikes++;
			ctx.se("cancel");
			say(result === "miss" ? "空振り……" : "見逃し……");
			drawField(b.g, null, 0, strikes, null);
			await sleep(700);
			p.take();
			if (strikes >= 3) {
				say("三振。……のんびり　いこうよ");
				await sleep(900);
				return false;
			}
		}
	} finally {
		p.stop();
		b.close();
	}
};

// ───────────────── 1000取り ─────────────────

const drawThread = (
	g: CanvasRenderingContext2D,
	n: number,
	bot: number,
	flash: string | null,
): void => {
	const W = 240;
	const H = 150;
	g.fillStyle = "#14121c";
	g.fillRect(0, 0, W, H);
	// スレの 行（下へ 流れる 書きこみ）
	g.font = "9px 'DotGothic16', monospace";
	g.textAlign = "left";
	for (let i = 0; i < 6; i++) {
		const num = n - 5 + i;
		if (num < 1) continue;
		g.fillStyle = i === 5 ? "#ffffff" : "rgba(200,200,220,0.5)";
		g.fillText(
			`${num}　名前：名無しさん　${i === 5 ? "……" : "参拝"}`,
			8,
			20 + i * 14,
		);
	}
	// いまの レス番（大きく）
	g.textAlign = "center";
	g.font = "28px 'DotGothic16', monospace";
	g.fillStyle = n >= 999 ? "#ffe060" : "#f4f2ea";
	g.fillText(String(n), W / 2, 128);
	// 1000ゲッター（右で リロードしている。1000 に 近づくと 光る）
	g.font = "10px 'DotGothic16', monospace";
	g.textAlign = "right";
	g.fillStyle = bot > 0.7 ? "#ff6a4a" : "#a0a0b0";
	g.fillText("1000ゲッター　F5", W - 6, 142);
	g.fillStyle = "#ff6a4a";
	g.fillRect(W - 6 - Math.round(60 * bot), 144, Math.round(60 * bot), 2);
	if (flash) {
		g.textAlign = "center";
		g.font = "12px 'DotGothic16', monospace";
		g.fillStyle = "#ffe060";
		g.fillText(flash, W / 2, 100);
	}
};

/**
 * 1000取り。>>999 を 取れば true（1000 は あけたまま）。早すぎ・遅すぎは 1000ゲッターが 1000 を 取って false。
 * レス番は 960 から 進み、だんだん 速くなる（はじめ 0.26秒 → 999 の 手前で 0.1秒）。
 */
export const playGetter = async (ctx: UiCtx): Promise<boolean> => {
	const b = board(
		ctx,
		"跡地の　次スレ　1000取り",
		"A／タップで　>>999　を　書く",
	);
	const p = presses(ctx, b.root);
	const say = (t: string) => {
		b.note.textContent = t;
	};
	try {
		let n = 960;
		say("1000ゲッターが　リロードしている……");
		drawThread(b.g, n, 0.2, null);
		await sleep(900);
		p.take();
		say("");
		let last = await tick();
		let result: "win" | "early" | "late" | "quit" | null = null;
		for (;;) {
			const t = await tick();
			const interval = 260 - ((n - 960) / 39) * 160;
			if (t - last >= interval) {
				last = t;
				n++;
				if (n % 4 === 0) ctx.se("cursor");
			}
			const pr = p.take();
			if (pr === "b") {
				result = "quit";
				break;
			}
			if (pr === "a") {
				result = n === 999 ? "win" : n < 999 ? "early" : "late";
				break;
			}
			if (n >= 1000) {
				result = "late";
				break;
			}
			drawThread(b.g, n, (n - 960) / 40, null);
		}
		if (result === "quit") return false;
		if (result === "win") {
			ctx.se("decide");
			drawThread(b.g, 999, 0.9, "999　名前：蓄音キリコ　「保守」");
			say("……>>999。1000は、あけておいた");
			await sleep(1400);
			drawThread(b.g, 999, 0, "1000　……まだ　だれも　書かない");
			await sleep(1200);
			return true;
		}
		ctx.se("cancel");
		drawThread(
			b.g,
			Math.max(n, 1000),
			1,
			`1000　名前：1000ゲッター　「1000なら　ワイの　勝ち」`,
		);
		say(result === "early" ? "早すぎた！　……取られた" : "……取られた");
		await sleep(1500);
		return false;
	} finally {
		p.stop();
		b.close();
	}
};
