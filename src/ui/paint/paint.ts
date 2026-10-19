// キリコの 家の「画家の　キャンバス」で 絵を 描く 板（決まりは data/paint/paint.ts）。
// - 左に 10x7 の 絵（12倍）。右に 16色の 絵の具（4列 × 4段）と 道具の ボタン（2列 × 4段）。
// - 十字キー：カーソル（くり返し）。絵の 右はしの 先へ 出ると 絵の具・道具の 上を 動く。A で 塗る・選ぶ。
//   A（Z・Enter・Space）を 押した まま 動くと 線に なる（キーを 離すまで 1手。keydown／keyup を じかに 見る）。
// - 指・マウス：押して なぞると 描ける（pointermove を 押して いる あいだ 聞く）。絵の具・道具は タップ。
// - B を 2回（または「おわる」）で「保存する／保存しない／描きつづける」。
// - 保存は 1枚だけ：localStorage の kiriko-roguelike/paint（開発の ?stage= ・?event= では 書かない）。
//   保存した 絵は イーゼルの 布に 1点＝1画素で そのまま 貼る（engine/assets.ts の rt:easel を 描き直す）。

import {
	blankPicture,
	decodePicture,
	drawLine,
	encodePicture,
	flipPicture,
	floodFill,
	isBlank,
	PAINT_BLANK,
	PAINT_COLORS,
	PAINT_H,
	PAINT_TEXT,
	PAINT_TOOLS,
	PAINT_W,
	type PaintTool,
	type Picture,
	pixelAt,
	UndoStack,
} from "../../data/paint/paint";
import { devEvent } from "../../data/story/objectives";
import { drawRefInCell, loadImage, setRuntimeImage } from "../../engine/assets";
import type { Story } from "../../engine/defs";
import type { Ctx } from "../ctx";
import { board, tick } from "../minigames/minigameBoard";
import { BH, BW, crisp, type G, twoB, txt } from "../neta/netaBoard";
import { previewStage } from "../village/villageReturn";

// ───────────────── 保存（1枚だけ） ─────────────────

const KEY = "kiriko-roguelike/paint";

/** 書けない ときの この回の 絵（開発の 下見や 保存できない とき）。 */
let memo: Picture | null = null;

const previewing = (): boolean =>
	previewStage() !== null || devEvent() !== null;

const loadPicture = (): Picture => {
	if (memo) return memo.slice();
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
		const p = raw && raw.v === 2 ? decodePicture(raw.px) : null;
		if (p) return p;
	} catch {
		// 読めない ときは まっしろ
	}
	return blankPicture();
};

const savePicture = (p: Picture): void => {
	memo = p.slice();
	if (previewing()) return;
	try {
		localStorage.setItem(KEY, JSON.stringify({ v: 2, px: encodePicture(p) }));
	} catch {
		// 保存できなくても この回は memo で 覚えている
	}
};

// ───────────────── イーゼルの 絵（家の マス） ─────────────────

/** イーゼルの 絵（home-games.png の 32,0）。 */
const EASEL_SPRITE = "pub:sprites/home-games.png#32,0,16,16";
/** 家の マスが 指す 実行中の 絵（data/village/myhome.ts の easel）。 */
const EASEL_REF = "rt:easel";
/** イーゼルの 白い 布の 左上（16x16 の 中の x3・y2。大きさは 絵と 同じ PAINT_W × PAINT_H）。 */
const FACE = { x: 3, y: 2 } as const;

/** 絵を 1倍の キャンバスに 描く。 */
const pictureCanvas = (p: Picture): HTMLCanvasElement => {
	const c = document.createElement("canvas");
	c.width = PAINT_W;
	c.height = PAINT_H;
	const g = c.getContext("2d");
	if (!g) return c;
	const img = g.createImageData(PAINT_W, PAINT_H);
	for (let i = 0; i < p.length; i++) {
		const hex = PAINT_COLORS[p[i]] ?? "#ffffff";
		img.data[i * 4] = Number.parseInt(hex.slice(1, 3), 16);
		img.data[i * 4 + 1] = Number.parseInt(hex.slice(3, 5), 16);
		img.data[i * 4 + 2] = Number.parseInt(hex.slice(5, 7), 16);
		img.data[i * 4 + 3] = 255;
	}
	g.putImageData(img, 0, 0);
	return c;
};

let easel: HTMLCanvasElement | null = null;

/** イーゼルの マスの 絵を 描き直す（保存した 絵を 布に 重ねる）。 */
const refreshEasel = async (): Promise<void> => {
	if (typeof document === "undefined") return;
	easel ??= document.createElement("canvas");
	easel.width = 16;
	easel.height = 16;
	await loadImage(EASEL_SPRITE);
	const g = easel.getContext("2d");
	if (g) {
		g.clearRect(0, 0, 16, 16);
		g.imageSmoothingEnabled = false;
		drawRefInCell(g, EASEL_SPRITE, 0, 0);
		const p = loadPicture();
		if (!isBlank(p)) g.drawImage(pictureCanvas(p), FACE.x, FACE.y);
	}
	setRuntimeImage(EASEL_REF, easel);
};

// 家に 入る 前に 作って おく（家の 先読みは rt:easel が 置かれるのを 待つ）
void refreshEasel();

// ───────────────── 板の 形 ─────────────────

/** 絵の 1点の 大きさ（板の 画素）と 左上。 */
const Z = 12;
const CX = 12;
const CY = 33;
/** 絵の具の 欄（4列 × 4段）。 */
const PAL = { x: 146, y: 11, w: 20, h: 14, gx: 22, gy: 16, cols: 4 } as const;
/** 道具の 欄（2列 × 4段）。 */
const TOOL = { x: 146, y: 78, w: 43, h: 13, gx: 45, gy: 15, cols: 2 } as const;
const PAL_ROWS = Math.ceil(PAINT_COLORS.length / PAL.cols);
const TOOL_ROWS = Math.ceil(PAINT_TOOLS.length / TOOL.cols);

/** カーソル（絵の 上 か、右の 欄の 上）。欄は 段 r が 0..PAL_ROWS-1 で 絵の具、その 下が 道具。 */
type Cur =
	| { at: "pic"; x: number; y: number }
	| { at: "side"; c: number; r: number };

const sideCols = (r: number) => (r < PAL_ROWS ? PAL.cols : TOOL.cols);

/** 欄の 1つの 四角。 */
const sideRect = (c: number, r: number): [number, number, number, number] =>
	r < PAL_ROWS
		? [PAL.x + c * PAL.gx, PAL.y + r * PAL.gy, PAL.w, PAL.h]
		: [TOOL.x + c * TOOL.gx, TOOL.y + (r - PAL_ROWS) * TOOL.gy, TOOL.w, TOOL.h];

/** 板の 座標 → 絵の 点か 欄の 四角（どこでも なければ null）。 */
const hit = (tx: number, ty: number): Cur | null => {
	const x = Math.floor((tx - CX) / Z);
	const y = Math.floor((ty - CY) / Z);
	if (x >= 0 && y >= 0 && x < PAINT_W && y < PAINT_H)
		return { at: "pic", x, y };
	for (let r = 0; r < PAL_ROWS + TOOL_ROWS; r++)
		for (let c = 0; c < sideCols(r); c++) {
			const [X, Y, W, H] = sideRect(c, r);
			if (tx >= X - 1 && tx < X + W + 1 && ty >= Y - 1 && ty < Y + H + 1)
				return { at: "side", c, r };
		}
	return null;
};

const frame = (
	g: G,
	x: number,
	y: number,
	w: number,
	h: number,
	ink: string,
) => {
	g.fillStyle = ink;
	g.fillRect(x, y, w, 1);
	g.fillRect(x, y + h - 1, w, 1);
	g.fillRect(x, y, 1, h);
	g.fillRect(x + w - 1, y, 1, h);
};

/** A の キー（engine/input.ts の OTHER_KEYS の a）。押した ままを 見る。 */
const A_CODES = new Set(["KeyZ", "Enter", "NumpadEnter", "Space"]);

// ───────────────── 板 ─────────────────

export const paintEasel = async (ctx: Ctx, s: Story): Promise<void> => {
	let pic = loadPicture();
	const undo = new UndoStack();
	let color = 1;
	let tool: PaintTool = "pen";
	let cur: Cur = { at: "pic", x: PAINT_W >> 1, y: PAINT_H >> 1 };
	let dirty = false;
	/** 窓（全消し・おわり）を 出して いる あいだは 板の 入力を 捨てる。 */
	let busy = false;
	let aHeld = false;
	/** なぞって いる ときの 1つ前の 点（null は 描いて いない）。 */
	let last: [number, number] | null = null;

	const b = board(ctx, PAINT_TEXT.title, PAINT_TEXT.hint);
	const g = crisp(b);
	b.canvas.style.touchAction = "none";
	const quit = twoB();
	const say = (t: string) => {
		b.note.textContent = t;
	};
	const status = () => say(PAINT_TEXT.tool[tool]);

	const ink = () => (tool === "eraser" ? PAINT_BLANK : color);

	/** 絵の 点で A・タップ。drag は なぞりの 続き（ペン・消しゴムだけ）。 */
	const useAt = (x: number, y: number, drag: boolean) => {
		if (tool === "pen" || tool === "eraser") {
			if (!drag || !last) {
				undo.push(pic);
				last = [x, y];
			}
			const [lx, ly] = last;
			if (drawLine(pic, lx, ly, x, y, ink())) {
				dirty = true;
				ctx.se("cursor");
			}
			last = [x, y];
			return;
		}
		if (drag) return;
		if (tool === "fill") {
			const before = pic.slice();
			if (floodFill(pic, x, y, color)) {
				undo.push(before);
				dirty = true;
				ctx.se("put");
			}
		} else if (tool === "picker") {
			color = pixelAt(pic, x, y);
			tool = "pen";
			ctx.se("decide");
			say(PAINT_TEXT.picked);
		}
	};

	const undoOnce = () => {
		const p = undo.pop();
		if (!p) {
			ctx.se("cancel");
			say(PAINT_TEXT.noUndo);
			return;
		}
		pic = p;
		dirty = true;
		ctx.se("cancel");
	};

	/** 窓を 出す 仕事（板の 輪の 中で 待つ）。 */
	let pending: "clear" | "quit" | null = null;

	const pickSide = (c: number, r: number) => {
		if (r < PAL_ROWS) {
			const i = r * PAL.cols + c;
			if (i >= PAINT_COLORS.length) return;
			color = i;
			if (tool !== "pen" && tool !== "fill") tool = "pen";
			ctx.se("decide");
			status();
			return;
		}
		const t = PAINT_TOOLS[(r - PAL_ROWS) * TOOL.cols + c];
		if (!t) return;
		if (t === "undo") undoOnce();
		else if (t === "flip") {
			undo.push(pic);
			flipPicture(pic);
			dirty = true;
			ctx.se("cardFlip");
		} else if (t === "clear") pending = "clear";
		else if (t === "quit") pending = "quit";
		else {
			tool = t;
			ctx.se("decide");
			status();
		}
	};

	const press = () => {
		if (cur.at === "pic") useAt(cur.x, cur.y, false);
		else pickSide(cur.c, cur.r);
	};

	const move = (dx: number, dy: number) => {
		if (cur.at === "pic") {
			const x = cur.x + dx;
			const y = Math.max(0, Math.min(PAINT_H - 1, cur.y + dy));
			if (x >= PAINT_W) {
				// 絵の 右はしの 先は 右の 欄
				const r = Math.min(
					PAL_ROWS + TOOL_ROWS - 1,
					Math.floor((y * (PAL_ROWS + TOOL_ROWS)) / PAINT_H),
				);
				cur = { at: "side", c: 0, r };
				last = null;
			} else cur = { at: "pic", x: Math.max(0, x), y };
		} else {
			let { c, r } = cur;
			if (dy) {
				const nr = Math.max(0, Math.min(PAL_ROWS + TOOL_ROWS - 1, r + dy));
				// 絵の具（4列）と 道具（2列）の さかいは 列を 読みかえる
				if (nr !== r && sideCols(nr) !== sideCols(r))
					c = sideCols(nr) < sideCols(r) ? Math.floor(c / 2) : c * 2;
				r = nr;
			}
			c += dx;
			if (c < 0) {
				cur = {
					at: "pic",
					x: PAINT_W - 1,
					y: Math.min(
						PAINT_H - 1,
						Math.floor(((r + 0.5) * PAINT_H) / (PAL_ROWS + TOOL_ROWS)),
					),
				};
				ctx.se("cursor");
				return;
			}
			cur = { at: "side", c: Math.min(sideCols(r) - 1, c), r };
		}
		ctx.se("cursor");
		// A を 押した まま 動けば 線
		if (aHeld && cur.at === "pic" && last) useAt(cur.x, cur.y, true);
	};

	// キー（十字キーは くり返しも。B は 2回で おわり。板の 外の タップも B）
	const keyQ: { k: string; at: number; repeat: boolean }[] = [];
	const pop = ctx.input.push(
		(k, repeat) => {
			if (!busy) keyQ.push({ k, at: performance.now(), repeat });
		},
		{ tap: "b" },
	);
	const onKeyDown = (e: KeyboardEvent) => {
		if (A_CODES.has(e.code)) aHeld = true;
	};
	const onKeyUp = (e: KeyboardEvent) => {
		if (A_CODES.has(e.code)) {
			aHeld = false;
			last = null;
		}
	};
	const onBlur = () => {
		aHeld = false;
		last = null;
	};
	window.addEventListener("keydown", onKeyDown, true);
	window.addEventListener("keyup", onKeyUp, true);
	window.addEventListener("blur", onBlur);

	// 指・マウス（押して いる あいだの pointermove で なぞる）
	const toBoard = (e: PointerEvent): [number, number] => {
		const r = b.canvas.getBoundingClientRect();
		return [
			((e.clientX - r.left) * BW) / r.width,
			((e.clientY - r.top) * BH) / r.height,
		];
	};
	let dragging = false;
	const onDown = (e: PointerEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (busy) return;
		const h = hit(...toBoard(e));
		if (!h) return;
		cur = h;
		if (h.at === "side") {
			pickSide(h.c, h.r);
			return;
		}
		last = null;
		useAt(h.x, h.y, false);
		if (tool === "pen" || tool === "eraser") {
			dragging = true;
			try {
				b.canvas.setPointerCapture(e.pointerId);
			} catch {
				// とれなくても 板の 中なら 描ける
			}
		}
	};
	const onMove = (e: PointerEvent) => {
		if (!dragging || busy) return;
		const [tx, ty] = toBoard(e);
		const x = Math.max(0, Math.min(PAINT_W - 1, Math.floor((tx - CX) / Z)));
		const y = Math.max(0, Math.min(PAINT_H - 1, Math.floor((ty - CY) / Z)));
		cur = { at: "pic", x, y };
		useAt(x, y, true);
	};
	const onUp = () => {
		dragging = false;
		last = null;
	};
	b.canvas.addEventListener("pointerdown", onDown);
	b.canvas.addEventListener("pointermove", onMove);
	b.canvas.addEventListener("pointerup", onUp);
	b.canvas.addEventListener("pointercancel", onUp);

	const draw = (clock: number) => {
		// 机
		g.fillStyle = "#5a3e28";
		g.fillRect(0, 0, BW, BH);
		// 絵
		g.fillStyle = "#2a1c10";
		g.fillRect(CX - 2, CY - 2, PAINT_W * Z + 4, PAINT_H * Z + 4);
		for (let y = 0; y < PAINT_H; y++)
			for (let x = 0; x < PAINT_W; x++) {
				g.fillStyle = PAINT_COLORS[pixelAt(pic, x, y)];
				g.fillRect(CX + x * Z, CY + y * Z, Z, Z);
			}
		// 見本（1倍）
		txt(g, PAINT_TEXT.tool[tool], 146, 1, 8, "#f4ead8");
		g.fillStyle = PAINT_COLORS[tool === "eraser" ? PAINT_BLANK : color];
		g.fillRect(200, 2, 8, 7);
		frame(g, 199, 1, 10, 9, "#f4ead8");
		// 絵の具
		for (let i = 0; i < PAINT_COLORS.length; i++) {
			const [X, Y, W, H] = sideRect(i % PAL.cols, Math.floor(i / PAL.cols));
			g.fillStyle = "#2a1c10";
			g.fillRect(X - 1, Y - 1, W + 2, H + 2);
			g.fillStyle = PAINT_COLORS[i];
			g.fillRect(X, Y, W, H);
			if (i === color) {
				frame(g, X - 2, Y - 2, W + 4, H + 4, "#ffffff");
				frame(g, X, Y, W, H, "#000000");
			}
		}
		// 道具
		PAINT_TOOLS.forEach((t, i) => {
			const [X, Y, W, H] = sideRect(
				i % TOOL.cols,
				PAL_ROWS + Math.floor(i / TOOL.cols),
			);
			const on = t === tool;
			g.fillStyle = on ? "#f0d890" : "#d8c8a8";
			g.fillRect(X, Y, W, H);
			frame(g, X, Y, W, H, on ? "#7a4a10" : "#8a7458");
			const dim = t === "undo" && undo.size === 0;
			txt(
				g,
				PAINT_TEXT.tool[t],
				X + W / 2,
				Y + 2,
				8,
				dim ? "#a09080" : "#2a1c10",
				"center",
			);
		});
		// カーソル（点滅）
		if (Math.floor(clock * 3) % 3 !== 0 || aHeld || dragging) {
			if (cur.at === "pic")
				frame(
					g,
					CX + cur.x * Z - 1,
					CY + cur.y * Z - 1,
					Z + 2,
					Z + 2,
					"#e02020",
				);
			else {
				const [X, Y, W, H] = sideRect(cur.c, cur.r);
				frame(g, X - 3, Y - 3, W + 6, H + 6, "#e02020");
			}
		}
	};

	let saved = false;
	/** おわりの 窓。true で おわる。 */
	const askQuit = async (): Promise<boolean> => {
		if (!dirty) return true;
		busy = true;
		say(PAINT_TEXT.quitAsk);
		const n = await s.choose([...PAINT_TEXT.quitMenu], { cancel: 2 });
		busy = false;
		keyQ.length = 0;
		if (n === 2) return false;
		if (n === 0) {
			savePicture(pic);
			await refreshEasel();
			saved = true;
		}
		return true;
	};

	try {
		ctx.se("decide");
		status();
		const t0 = performance.now();
		for (;;) {
			const now = await tick();
			if (quit.lapsed(now)) status();
			for (const e of keyQ.splice(0)) {
				if (e.k === "b") {
					if (e.repeat) continue;
					if (quit.press(e.at)) pending = "quit";
					else say(PAINT_TEXT.quit1);
				} else if (e.k === "a") {
					if (!e.repeat) press();
				} else if (e.k === "up") move(0, -1);
				else if (e.k === "down") move(0, 1);
				else if (e.k === "left") move(-1, 0);
				else if (e.k === "right") move(1, 0);
			}
			draw((now - t0) / 1000);
			// 押した 手（とじた 関数の 中で 書くので 型を 広げて 読む）
			const job = pending as "clear" | "quit" | null;
			pending = null;
			if (job === "clear") {
				busy = true;
				say(PAINT_TEXT.clearAsk);
				const n = await s.choose([...PAINT_TEXT.clearMenu], { cancel: 1 });
				busy = false;
				keyQ.length = 0;
				if (n === 0 && !isBlank(pic)) {
					undo.push(pic);
					pic = blankPicture();
					dirty = true;
					ctx.se("glassBreak");
				}
				status();
			} else if (job === "quit") {
				if (await askQuit()) break;
				status();
			}
		}
	} finally {
		pop();
		window.removeEventListener("keydown", onKeyDown, true);
		window.removeEventListener("keyup", onKeyUp, true);
		window.removeEventListener("blur", onBlur);
		b.canvas.removeEventListener("pointerdown", onDown);
		b.canvas.removeEventListener("pointermove", onMove);
		b.canvas.removeEventListener("pointerup", onUp);
		b.canvas.removeEventListener("pointercancel", onUp);
		b.close();
	}
	if (saved) {
		ctx.se("save");
		await s.narrate(PAINT_TEXT.saved);
		const cs = PAINT_TEXT.comments;
		await s.narrate(cs[Math.floor(Math.random() * cs.length)]);
	} else if (dirty) await s.narrate(PAINT_TEXT.unsaved);
};
