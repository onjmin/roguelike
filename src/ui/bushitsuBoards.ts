// 部室棟の 板（ui/minigameBoard.ts の board() の 上に 描く。村の 窓の 上に 1枚）。決まりは data/bushitsu.ts。
// - ワードウルフ（playWordWolf）：人狼部の 机。名無し 4人と 部長が お題に ついて ひとことずつ。ちがう お題の 1人に 投票。
// - うろ覚えお糸会かき大会（playOekaki）：名無し 3人が うろ覚えで 描いた 絵から いちばん 似てる 1枚を 3問。
// どれも 240x150 を 2倍の 下地に 描く（字が にじまない）。字は DotGothic16 の 8px。
// 入力：↑↓←→・A・B と キャンバスの タップ（cursorInput）。板を 出して いる あいだ スマホの 十字キーと A・B は
// 隠れる（.hud.modal）ので、板の 外の タップは B（ctx.input.push の tap: "b"）。B を 1.5秒 以内に 2回で やめる（null）。
// 見た目の 乱数なので Math.random（冒険の 乱数・記録には 触らない）。

import {
	BS_BOARD,
	fillText,
	type OeDrawing,
	type OePart,
	oeReaction,
	oeRound,
	oeSession,
	WW_BUCHO,
	WW_IDS,
	WW_SEATS,
	type WwVerdict,
	wwDeal,
	wwVerdict,
	wwWho,
	wwWord,
} from "../data/bushitsu";
import { BS_CELLS, BS_IMG, type BsName } from "../data/bushitsuSheet";
import { loadImage } from "../engine/assets";
import type { UiCtx } from "./list";
import { board, tick } from "./minigameBoard";

export type WwResult = { verdict: WwVerdict; pairId: string; wolfSeat: number };
export type OeResult = { hits: number };

type Board = ReturnType<typeof board>;
type G = CanvasRenderingContext2D;
const W = 240;
const H = 150;
const font = (px: number): string => `${px}px 'DotGothic16', monospace`;
/** B の 1回目から 2回目までの 間（これより あとの B は また 1回目）。 */
const QUIT_MS = 1500;

/** 2倍の 下地（描く 座標は 240x150 の まま）。 */
const crisp = (b: Board): G => {
	b.canvas.width = W * 2;
	b.canvas.height = H * 2;
	b.g.setTransform(2, 0, 0, 2, 0, 0);
	b.g.imageSmoothingEnabled = false;
	return b.g;
};

/** 字と 部室棟の 絵を 待つ（読めなければ 絵は 四角だけ）。 */
const prepare = async (): Promise<HTMLImageElement | null> => {
	try {
		await document.fonts?.load("8px 'DotGothic16'");
	} catch {
		// 字が 読めなくても ほかの 字で 描く
	}
	return loadImage(BS_IMG);
};

/** 部室棟の 絵の 1枚を (x, y) に（左上。scale 倍）。読めなければ 灰色の 四角。 */
const drawCell = (
	g: G,
	img: HTMLImageElement | null,
	name: BsName,
	x: number,
	y: number,
	scale = 1,
): void => {
	const [sx, sy, sw, sh] = BS_CELLS[name];
	if (!img) {
		g.fillStyle = "#808080";
		g.fillRect(x + 2 * scale, y + scale, 12 * scale, 14 * scale);
		return;
	}
	g.drawImage(img, sx, sy, sw, sh, x, y, sw * scale, sh * scale);
};

/** 字（8px。align・色）。 */
const text = (
	g: G,
	s: string,
	x: number,
	y: number,
	color: string,
	align: CanvasTextAlign = "left",
	px = 8,
): void => {
	g.font = font(px);
	g.textAlign = align;
	g.textBaseline = "alphabetic";
	g.fillStyle = color;
	g.fillText(s, x, y);
};

/** 角の 丸い 四角。 */
const roundRect = (
	g: G,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
): void => {
	g.beginPath();
	g.moveTo(x + r, y);
	g.lineTo(x + w - r, y);
	g.quadraticCurveTo(x + w, y, x + w, y + r);
	g.lineTo(x + w, y + h - r);
	g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	g.lineTo(x + r, y + h);
	g.quadraticCurveTo(x, y + h, x, y + h - r);
	g.lineTo(x, y + r);
	g.quadraticCurveTo(x, y, x + r, y);
	g.closePath();
};

// ───────────────── 入力 ─────────────────

type Key4 = "up" | "down" | "left" | "right" | "a" | "b";

/**
 * 十字キー・A・B と キャンバスの タップ（240x150 の 座標）。presses() は 1つしか 覚えず 向きも ないので 別に 持つ。
 * 板の 外（フィールド）の タップは B（スマホで やめる 手）。
 */
export const cursorInput = (ctx: UiCtx, canvas: HTMLCanvasElement) => {
	const keys: Key4[] = [];
	const taps: { x: number; y: number }[] = [];
	const pop = ctx.input.push(
		(k, repeat) => {
			if (k === "a" || k === "b") {
				if (!repeat) keys.push(k);
				return;
			}
			if (k === "up" || k === "down" || k === "left" || k === "right")
				keys.push(k);
		},
		{ tap: "b" },
	);
	const onDown = (e: PointerEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const r = canvas.getBoundingClientRect();
		taps.push({
			x: ((e.clientX - r.left) * W) / r.width,
			y: ((e.clientY - r.top) * H) / r.height,
		});
	};
	canvas.addEventListener("pointerdown", onDown);
	return {
		key: (): Key4 | null => keys.shift() ?? null,
		tap: (): { x: number; y: number } | null => taps.shift() ?? null,
		clear: () => {
			keys.length = 0;
			taps.length = 0;
		},
		stop: () => {
			pop();
			canvas.removeEventListener("pointerdown", onDown);
		},
	};
};
type CursorInput = ReturnType<typeof cursorInput>;

/** B 2回で やめた（板の 外へ 投げて、いちばん 外で null に する）。 */
class Quit extends Error {}

/**
 * 板の ノートと B の やめ方（1回目は ノートに quit1 を 1.5秒、その あいだの 2回目で Quit）。
 * set で ふだんの ノート、show で 毎コマ 出す。
 */
const noteOf = (b: Board) => {
	let base = "";
	let quitAt = Number.NEGATIVE_INFINITY;
	return {
		set: (t: string) => {
			base = t;
		},
		/** B を 押した（2回目なら Quit を 投げる）。 */
		b: () => {
			const now = performance.now();
			if (now - quitAt < QUIT_MS) throw new Quit();
			quitAt = now;
		},
		show: () => {
			const t = performance.now() - quitAt < QUIT_MS ? BS_BOARD.quit1 : base;
			if (b.note.textContent !== t) b.note.textContent = t;
		},
	};
};
type Note = ReturnType<typeof noteOf>;

/**
 * ms だけ 回す（毎コマ draw）。skip なら A・タップで 早く 終わる（true を 返す）。B は やめ方。
 * ms が Infinity なら A・タップを 待つ。
 */
const run = async (
	inp: CursorInput,
	note: Note,
	draw: () => void,
	ms: number,
	skip = false,
): Promise<boolean> => {
	const end = performance.now() + ms;
	for (;;) {
		for (let k = inp.key(); k; k = inp.key()) {
			if (k === "b") note.b();
			else if (k === "a" && skip) return true;
		}
		if (inp.tap() && skip) return true;
		note.show();
		draw();
		if (performance.now() >= end) return false;
		await tick();
	}
};

// ───────────────── ワードウルフ ─────────────────

/** 席の 足もと（0〜4。2 は 部長）。 */
const SEAT_AT: readonly (readonly [number, number])[] = [
	[16, 66],
	[30, 56],
	[48, 52],
	[66, 56],
	[80, 66],
];
const LOG_X = 98;
const LOG_W = 140;
const logY = (i: number) => 18 + 24 * i;
/** もう 1周の 札（カーソルの 5番）。 */
const MORE = { x: 4, y: 130, w: 88, h: 16 } as const;

/**
 * ワードウルフ。名無し 4人と 部長が 集まって お題が 配られ、1人ずつ ひとこと。投票か もう 1周（1回だけ）。
 * B 2回で やめたら null（記録は 呼ぶ 側が 書く）。
 */
export const playWordWolf = async (ctx: UiCtx): Promise<WwResult | null> => {
	const b = board(ctx, BS_BOARD.ww.title, BS_BOARD.ww.hint);
	const g = crisp(b);
	const inp = cursorInput(ctx, b.canvas);
	const note = noteOf(b);
	try {
		const img = await prepare();
		const d = wwDeal(Math.random);
		const nanashi = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
		const present = [false, false, true, false, false];
		const said: [(string | null)[], (string | null)[]] = [
			[null, null, null, null, null],
			[null, null, null, null, null],
		];
		let word: string | null = null;
		let roundIx = 0;
		let speaking: number | null = null;
		let bubble: { seat: number; text: string } | null = null;
		let cursor: number | null = null;
		let canMore = false;
		let reveal: WwVerdict | null = null;

		const drawBubble = (seat: number, s: string) => {
			const [x, y] = SEAT_AT[seat];
			g.font = font(8);
			const w = Math.ceil(g.measureText(s).width) + 6;
			const bx = Math.max(2, Math.min(93 - w, Math.round(x - w / 2)));
			const by = y - 31;
			g.fillStyle = "#ffffff";
			roundRect(g, bx, by, w, 12, 3);
			g.fill();
			g.beginPath();
			g.moveTo(x - 2, by + 12);
			g.lineTo(x + 2, by + 12);
			g.lineTo(x, by + 15);
			g.closePath();
			g.fill();
			text(g, s, bx + 3, by + 9, "#000000");
		};
		const draw = () => {
			g.fillStyle = "#14121c";
			g.fillRect(0, 0, W, H);
			// 上：お題と 周
			if (word) text(g, fillText(BS_BOARD.ww.card, { word }), 4, 10, "#ffe060");
			text(
				g,
				reveal
					? fillText(BS_BOARD.ww.wolf, { word: wwWord(d, d.wolf) })
					: BS_BOARD.ww.round[roundIx],
				236,
				10,
				reveal ? "#ff8a8a" : "#9a98b0",
				"right",
			);
			// 机と 席
			g.fillStyle = "#7a4a28";
			g.strokeStyle = "#4a2a14";
			g.lineWidth = 1;
			g.beginPath();
			g.ellipse(48, 80, 30, 13, 0, 0, Math.PI * 2);
			g.fill();
			g.stroke();
			for (let i = 0; i < WW_SEATS; i++) {
				if (!present[i]) continue;
				const [x, y] = SEAT_AT[i];
				drawCell(
					g,
					img,
					i === WW_BUCHO ? "bucho" : (`nanashi${nanashi[i]}` as BsName),
					x - 8,
					y - 16,
				);
				if (speaking !== i)
					text(g, String(i + 1), x, y - 18, "#c8c6d8", "center");
				if (cursor === i) text(g, "▼", x, y - 26, "#ffe060", "center");
			}
			// キリコ（後ろ姿）
			drawCell(g, img, "kirikoBack", 40, 102);
			if (bubble) drawBubble(bubble.seat, bubble.text);
			// 右：ひとことの 記録
			for (let i = 0; i < WW_SEATS; i++) {
				const y = logY(i);
				const wolfRow = reveal !== null && i === d.wolf;
				g.fillStyle = wolfRow
					? "#5a1e24"
					: cursor === i
						? "#3a3450"
						: "#1e1c2a";
				g.fillRect(LOG_X, y, LOG_W, 22);
				if (cursor === i) {
					g.strokeStyle = "#ffe060";
					g.strokeRect(LOG_X + 0.5, y + 0.5, LOG_W - 1, 21);
				}
				text(g, `${i + 1}　${said[0][i] ?? ""}`, LOG_X + 2, y + 9, "#ffffff");
				if (said[1][i])
					text(g, `　　${said[1][i]}`, LOG_X + 2, y + 19, "#c8e0ff");
				if (present[i] && word)
					text(g, wwWho(d, i), 236, y + 9, "#9a98b0", "right");
			}
			// もう 1周
			if (canMore) {
				g.fillStyle = cursor === 5 ? "#3a3450" : "#1e1c2a";
				g.fillRect(MORE.x, MORE.y, MORE.w, MORE.h);
				g.strokeStyle = cursor === 5 ? "#ffe060" : "#5a5870";
				g.strokeRect(MORE.x + 0.5, MORE.y + 0.5, MORE.w - 1, MORE.h - 1);
				text(
					g,
					BS_BOARD.ww.more,
					MORE.x + MORE.w / 2,
					MORE.y + 11,
					"#ffffff",
					"center",
				);
			}
			// 当たり・はずれ
			if (reveal) {
				const [mark, color] =
					reveal === "first"
						? ["◎", "#ffe060"]
						: reveal === "second"
							? ["○", "#9ad0ff"]
							: ["×", "#8a8a9a"];
				text(g, mark, 48, 87, color, "center", 20);
			}
		};

		// 1. 集まる（部長は はじめから。名無しが 1人ずつ「あげ」）
		note.set(BS_BOARD.ww.gather);
		await run(inp, note, draw, 400);
		const comers = [0, 1, 3, 4];
		for (const [k, seat] of comers.entries()) {
			present[seat] = true;
			bubble = { seat, text: BS_BOARD.ww.ages[k] };
			ctx.se("cursor");
			await run(inp, note, draw, 500);
			bubble = null;
		}
		note.set(BS_BOARD.ww.full);
		await run(inp, note, draw, 600);
		// 2. 配る
		word = wwWord(d, "kiriko");
		ctx.se("decide");
		note.set(BS_BOARD.ww.dealt);
		await run(inp, note, draw, 900);

		/** 1つの 周（席 0〜4 が 順に ひとこと。A・タップで その 人の 待ちを とばす）。 */
		const speak = async (r: 0 | 1) => {
			roundIx = r;
			inp.clear();
			for (let i = 0; i < WW_SEATS; i++) {
				const h = d.hints[r][i];
				speaking = i;
				said[r][i] = h;
				bubble = { seat: i, text: h };
				note.set(fillText(BS_BOARD.ww.turn, { who: wwWho(d, i), hint: h }));
				ctx.se("cursor");
				await run(inp, note, draw, 900, true);
			}
			speaking = null;
			bubble = null;
		};
		/** 選ぶ（0〜4 の 席。canMore なら 5 = もう 1周）。 */
		const choose = async (): Promise<number> => {
			roundIx = 2;
			cursor = 0;
			note.set(BS_BOARD.ww.ask);
			inp.clear();
			const last = () => (canMore ? 5 : WW_SEATS - 1);
			const hit = (x: number, y: number): number | null => {
				if (
					canMore &&
					x >= MORE.x &&
					x < MORE.x + MORE.w &&
					y >= MORE.y &&
					y < MORE.y + MORE.h
				)
					return 5;
				for (let i = 0; i < WW_SEATS; i++) {
					if (x >= LOG_X && y >= logY(i) && y < logY(i) + 22) return i;
					const [sx, sy] = SEAT_AT[i];
					if (Math.abs(x - sx) <= 9 && y >= sy - 20 && y <= sy + 2) return i;
				}
				return null;
			};
			for (;;) {
				for (let k = inp.key(); k; k = inp.key()) {
					if (k === "b") note.b();
					else if (k === "a") return cursor;
					else {
						const n = last() + 1;
						cursor = (cursor + (k === "up" || k === "left" ? n - 1 : 1)) % n;
						ctx.se("cursor");
					}
				}
				for (let t = inp.tap(); t; t = inp.tap()) {
					const i = hit(t.x, t.y);
					if (i === null) continue;
					if (i === cursor) return i;
					cursor = i;
					ctx.se("cursor");
				}
				note.show();
				draw();
				await tick();
			}
		};

		// 3. 1周目 → 4. 選ぶ（もう 1周は 1回だけ）
		await speak(0);
		canMore = true;
		let pick = await choose();
		let round: 1 | 2 = 1;
		if (pick === 5) {
			canMore = false;
			cursor = null;
			ctx.se("decide");
			await speak(1);
			round = 2;
			pick = await choose();
		}
		canMore = false;
		// 5. 投票
		note.set(fillText(BS_BOARD.ww.vote, { who: wwWho(d, pick) }));
		ctx.se("decide");
		await run(inp, note, draw, 800);
		cursor = null;
		const verdict = wwVerdict(d, pick, round);
		reveal = verdict;
		ctx.se(verdict === "miss" ? "miss" : "victory");
		note.set(
			verdict === "first"
				? BS_BOARD.ww.r1
				: verdict === "second"
					? BS_BOARD.ww.r2
					: BS_BOARD.ww.rx,
		);
		await run(inp, note, draw, 1400);
		// 6. とじる（A・B・タップ）
		note.set(BS_BOARD.end);
		inp.clear();
		for (;;) {
			const k = inp.key();
			if (k === "a" || k === "b" || inp.tap()) break;
			note.show();
			draw();
			await tick();
		}
		return { verdict, pairId: d.pair.id, wolfSeat: d.wolf };
	} catch (e) {
		if (e instanceof Quit) return null;
		throw e;
	} finally {
		inp.stop();
		b.close();
	}
};

// ───────────────── うろ覚えお糸会かき大会 ─────────────────

const PANEL_X = [6, 84, 162] as const;
const PANEL_Y = 18;
const PANEL = 72;
const OE_SCALE = 1.5;
/** 1つの 部分を 描く 間（ms。3枚 いっしょに 1つずつ）。 */
const STROKE_MS = 120;

/** 部分を 描く（ox, oy は 箱の 左上。scale 倍）。 */
const drawPart = (
	g: G,
	p: OePart,
	ox: number,
	oy: number,
	scale: number,
): void => {
	const X = (v: number) => ox + v * scale;
	const Y = (v: number) => oy + v * scale;
	g.lineWidth = 1;
	g.strokeStyle = "#302820";
	g.fillStyle = p.c;
	if ("pts" in p) {
		// 三角（塗って 縁取り）・折れ線（丸い 線）
		g.beginPath();
		for (let i = 0; i + 1 < p.pts.length; i += 2) {
			if (i === 0) g.moveTo(X(p.pts[i]), Y(p.pts[i + 1]));
			else g.lineTo(X(p.pts[i]), Y(p.pts[i + 1]));
		}
		if (p.k === "tri") {
			g.closePath();
			g.fill();
			g.stroke();
			return;
		}
		g.lineWidth = 1.5;
		g.lineCap = "round";
		g.lineJoin = "round";
		g.strokeStyle = p.c;
		g.stroke();
		return;
	}
	if (p.k === "rect") {
		g.fillRect(X(p.x), Y(p.y), p.w * scale, p.h * scale);
		g.strokeRect(X(p.x), Y(p.y), p.w * scale, p.h * scale);
		return;
	}
	g.beginPath();
	g.ellipse(
		X(p.x),
		Y(p.y),
		Math.max(0.5, p.r * scale),
		Math.max(0.5, (p.ry ?? p.r) * scale),
		0,
		0,
		Math.PI * 2,
	);
	if (p.k === "disc") g.fill();
	else {
		g.lineWidth = 1.5;
		g.strokeStyle = p.c;
		g.stroke();
	}
};

/** 紙（w×w。縁取り）に 部分を n 個まで 描く（はみ出しは 紙で 切る）。 */
const drawPaper = (
	g: G,
	parts: readonly OePart[],
	x: number,
	y: number,
	w: number,
	scale: number,
	n = parts.length,
): void => {
	g.fillStyle = "#f4f2ea";
	g.fillRect(x, y, w, w);
	g.save();
	g.beginPath();
	g.rect(x, y, w, w);
	g.clip();
	for (const p of parts.slice(0, n)) drawPart(g, p, x, y, scale);
	g.restore();
	g.strokeStyle = "#8a7a5a";
	g.lineWidth = 1;
	g.strokeRect(x + 0.5, y + 0.5, w - 1, w - 1);
};

/** 判定の はんこ（紙の 右上の 角）。 */
const stamp = (g: G, s: string, x: number, y: number, color: string) => {
	g.font = font(16);
	g.textAlign = "center";
	g.textBaseline = "middle";
	g.lineWidth = 2;
	g.strokeStyle = "#f4f2ea";
	g.strokeText(s, x, y);
	g.fillStyle = color;
	g.fillText(s, x, y);
	g.textBaseline = "alphabetic";
};

/**
 * うろ覚えお糸会かき大会。お題 3つ。名無し 3人が 描いた 3枚から いちばん 似てる 1枚を 選ぶ。
 * 見ぬいた 数を 返す（B 2回で やめたら null）。
 */
export const playOekaki = async (ctx: UiCtx): Promise<OeResult | null> => {
	const b = board(ctx, BS_BOARD.oe.title, BS_BOARD.oe.hint);
	const g = crisp(b);
	const inp = cursorInput(ctx, b.canvas);
	const note = noteOf(b);
	try {
		const img = await prepare();
		const topics = oeSession(Math.random);
		let hits = 0;
		for (const [ri, t] of topics.entries()) {
			const round = ri as 0 | 1 | 2;
			const { drawings, best } = oeRound(t, round, Math.random);
			const artists = [0, 1, 2, 3, 4]
				.sort(() => Math.random() - 0.5)
				.slice(0, 3);
			const ids = [...WW_IDS].sort(() => Math.random() - 0.5).slice(0, 3);
			let shown = 0;
			let cursor: number | null = null;
			let chosen: number | null = null;
			let answer = false;
			const draw = () => {
				g.fillStyle = "#2a2418";
				g.fillRect(0, 0, W, H);
				text(g, fillText(BS_BOARD.ww.card, { word: t.name }), 4, 10, "#f4f2ea");
				text(g, `${ri + 1}/3`, 236, 10, "#c8c6d8", "right");
				for (let i = 0; i < 3; i++) {
					const x = PANEL_X[i];
					drawPaper(g, drawings[i].parts, x, PANEL_Y, PANEL, OE_SCALE, shown);
					text(g, String(i + 1), x + 3, PANEL_Y + 9, "#8a7a5a");
					if (cursor === i) {
						g.strokeStyle = "#ffe060";
						g.lineWidth = 2;
						g.strokeRect(x - 1, PANEL_Y - 1, PANEL + 2, PANEL + 2);
						text(g, "▼", x + PANEL / 2, 17, "#ffe060", "center");
					}
					// 絵師
					drawCell(g, img, `nanashi${artists[i]}` as BsName, x + 4, 92);
					text(g, `ID:${ids[i]}`, x + 24, 104, "#c8c6d8");
				}
				if (answer) {
					drawPaper(g, t.parts, 102, 112, 36, OE_SCALE / 2);
					text(g, BS_BOARD.oe.answerLabel, 142, 126, "#f4f2ea");
					stamp(g, "◎", PANEL_X[best] + 60, PANEL_Y + 13, "#d82828");
					if (chosen !== null && chosen !== best)
						stamp(g, "×", PANEL_X[chosen] + 60, PANEL_Y + 13, "#3050c0");
				}
			};
			// お題 → 描く（3枚 いっしょに 1部分ずつ）
			note.set(fillText(BS_BOARD.oe.start, { name: t.name }));
			await run(inp, note, draw, 1100);
			note.set(BS_BOARD.oe.draw);
			const most = Math.max(...drawings.map((d) => d.parts.length));
			const t0 = performance.now();
			for (;;) {
				shown = Math.floor((performance.now() - t0) / STROKE_MS);
				if (shown > most) break;
				await run(inp, note, draw, 0);
				await tick();
			}
			shown = most;
			// 選ぶ（←→。A で 決める。紙の タップは その 紙に すぐ 決める）
			note.set(BS_BOARD.oe.ask);
			cursor = 0;
			inp.clear();
			while (chosen === null) {
				for (let k = inp.key(); k && chosen === null; k = inp.key()) {
					if (k === "b") note.b();
					else if (k === "a") chosen = cursor;
					else {
						cursor = (cursor + (k === "up" || k === "left" ? 2 : 1)) % 3;
						ctx.se("cursor");
					}
				}
				for (let tp = inp.tap(); tp && chosen === null; tp = inp.tap()) {
					const { x, y } = tp;
					const i = PANEL_X.findIndex(
						(px) =>
							x >= px && x < px + PANEL && y >= PANEL_Y && y < PANEL_Y + 90,
					);
					if (i >= 0) {
						cursor = i;
						chosen = i;
					}
				}
				note.show();
				draw();
				if (chosen === null) await tick();
			}
			ctx.se("decide");
			const pick: OeDrawing = drawings[chosen];
			// 答え
			note.set(BS_BOARD.oe.answer);
			await run(inp, note, draw, 900);
			answer = true;
			cursor = null;
			const hit = chosen === best;
			if (hit) hits++;
			ctx.se(hit ? "victory" : "miss");
			note.set(oeReaction(t, pick, drawings[best], Math.random));
			await run(inp, note, draw, 1200);
			note.set(ri < 2 ? BS_BOARD.next : BS_BOARD.end);
			inp.clear();
			if (ri < 2) await run(inp, note, draw, Number.POSITIVE_INFINITY, true);
			else
				for (;;) {
					const k = inp.key();
					if (k === "a" || k === "b" || inp.tap()) break;
					note.show();
					draw();
					await tick();
				}
		}
		return { hits };
	} catch (e) {
		if (e instanceof Quit) return null;
		throw e;
	} finally {
		inp.stop();
		b.close();
	}
};
