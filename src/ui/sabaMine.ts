// ブラマイの 板（ホシュクラの ブラマイ場の 縦穴。決まりは data/sabaMine.ts、絵は public/sprites/saba.png）。
// 240x150 の 板（ui/minigameBoard.ts の board）を 2倍の 下地（480x300）で 描く：上の 22px が 札（ダイヤ・松明・
// つるはし・匠）、下の 128px が 15×8 マスの 地下（キリコに ついて 横に 動く）。十字（長押しも）で 掘る・進む、
// A で 松明、B を 1.5秒の あいだに 2回で 地上へ。タップは キリコの マスで 松明、ほかは その 方へ 1手。
// 板の 外（フィールド）の タップは B（スマホは 板の あいだ 十字と A/B が 隠れる ので、外を 2回で やめられる）。
// 長押しの くりかえしも 1手（下だけは くりかえさない）。溶岩が あふれたら 少し 止まり、長押しは 押しなおすまで
// 止める（data/sabaMine.ts の gateAct。のまれるのは 見てから 押した 手だけ）。
// キリコは しゃべらない（下の 一言は 地の文）。読めない 絵は 色の 四角で 描く。

import {
	CELL,
	cellAt,
	gateAct,
	gateSpill,
	hitsAt,
	lit,
	MINE,
	MINE_NOTE_ORDER,
	type MineAct,
	type MineEnd,
	type MineEvent,
	type MineState,
	mineAct,
	mineGate,
	mineNew,
	seenAt,
	torchAt,
} from "../data/sabaMine";
import { SABA_CELLS, SABA_IMG, type SabaCell } from "../data/sabaSheet";
import { SABA_TEXT } from "../data/sabaText";
import { loadImage } from "../engine/assets";
import type { Key } from "../engine/input";
import type { UiCtx } from "./list";
import { board, sleep, tick } from "./minigameBoard";

export type MineResult = { dia: number; end: MineEnd };

const MINE_TEXT_BOARD = SABA_TEXT.board;

/** 試験の 差しかえ（板を 出さずに 結果を 返す。null で 本物）。 */
let hook: (() => Promise<MineResult | null>) | null = null;
export const setMineHook = (h: typeof hook): void => {
	hook = h;
};

const HUD = 22;
const T = 16;
const QUIT_MS = 1500;

/** 出来事の 音（data/sfx.ts に ある 名前だけ）。 */
const SE: Partial<Record<MineEvent, string>> = {
	hit: "swing_blunt",
	breakStone: "hit_club",
	breakOre: "hit_steel",
	dia: "item",
	lavaSeen: "cancel",
	bedrock: "cancel",
	edge: "cancel",
	torch: "decide",
	noTorch: "cancel",
	torchHere: "cancel",
	fall: "fall",
	spill: "bubble",
	spillSafe: "flee",
	lavaDeath: "fire",
	takumiSpawn: "skill_warpPlayer",
	takumiGone: "steal",
	takumiBoom: "explosion",
	broke: "miss",
};
const NOTE: Partial<Record<MineEvent, string>> = {
	coal: MINE_TEXT_BOARD.coal,
	dia: MINE_TEXT_BOARD.dia,
	torch: MINE_TEXT_BOARD.torch,
	noTorch: MINE_TEXT_BOARD.noTorch,
	torchHere: MINE_TEXT_BOARD.torchHere,
	lavaSeen: MINE_TEXT_BOARD.lavaSeen,
	bedrock: MINE_TEXT_BOARD.bedrock,
	edge: MINE_TEXT_BOARD.edge,
	fall: MINE_TEXT_BOARD.fall,
	spill: MINE_TEXT_BOARD.spill,
	spillSafe: MINE_TEXT_BOARD.spillSafe,
	worn: MINE_TEXT_BOARD.worn,
	takumiSpawn: MINE_TEXT_BOARD.takumiSpawn,
	takumiGone: MINE_TEXT_BOARD.takumiGone,
	takumiBoom: MINE_TEXT_BOARD.takumiBoom,
	lavaDeath: MINE_TEXT_BOARD.lavaDeath,
	broke: MINE_TEXT_BOARD.broke,
};
/** 絵の ない ときの 色。 */
const FALLBACK: Record<number, string> = {
	[CELL.STONE]: "#7a7a78",
	[CELL.COAL]: "#3a3a3a",
	[CELL.DIA]: "#5ad8d0",
	[CELL.LAVA]: "#e86a20",
	[CELL.BEDROCK]: "#2a2a2a",
};
const TILE: Record<number, SabaCell> = {
	[CELL.STONE]: "stone",
	[CELL.COAL]: "coalOre",
	[CELL.DIA]: "diamondOre",
	[CELL.LAVA]: "lava",
	[CELL.BEDROCK]: "bedrock",
};
const KIRIKO: Record<MineAct, SabaCell> = {
	up: "kirikoUp0",
	right: "kirikoRight0",
	down: "kirikoDown0",
	left: "kirikoLeft0",
	torch: "kirikoDown0",
	quit: "kirikoDown0",
};

const draw = (
	g: CanvasRenderingContext2D,
	img: HTMLImageElement | null,
	st: MineState,
	t: number,
	step: number,
): void => {
	const cell = (name: SabaCell, dx: number, dy: number): void => {
		const [c, r] = SABA_CELLS[name];
		if (img) g.drawImage(img, c * T, r * T, T, T, dx, dy, T, T);
	};
	const camX = Math.max(0, Math.min(MINE.W - MINE.VIEW_W, st.x - 7));
	// 地下
	for (let vy = 0; vy < MINE.H; vy++)
		for (let vx = 0; vx < MINE.VIEW_W; vx++) {
			const x = camX + vx;
			const y = vy;
			const dx = vx * T;
			const dy = HUD + vy * T;
			const k = cellAt(st, x, y);
			const seen = seenAt(st, x, y);
			const light = lit(st, x, y);
			if (k === CELL.AIR && seen) {
				g.fillStyle = light ? "#3a2c22" : "#0d0b10";
				g.fillRect(dx, dy, T, T);
				if (x === 1 && y <= 2) cell("ladder", dx, dy);
			} else {
				// 見えない マスは 石に 見える（洞窟・溶岩・鉱石も）
				const show = seen ? k : CELL.STONE;
				g.fillStyle = FALLBACK[show] ?? "#7a7a78";
				g.fillRect(dx, dy, T, T);
				cell(TILE[show] ?? "stone", dx, dy);
				const h = hitsAt(st, x, y);
				// 鉱石の 1回目（ひび）
				if (h > 0) cell("crack", dx, dy);
			}
			if (torchAt(st, x, y)) cell("torch", dx, dy);
			// 暗い ところ（光の 外で キリコの となりより 遠い）
			const near = Math.abs(x - st.x) <= 1 && Math.abs(y - st.y) <= 1;
			if (!light && !near) {
				g.fillStyle = "rgba(0,0,0,0.55)";
				g.fillRect(dx, dy, T, T);
			}
		}
	// あふれて くる 溶岩（キリコの マスに 半分 すけて。次の 1手で 出なければ のまれる）
	if (st.spill) {
		g.globalAlpha = 0.6;
		cell("lava", (st.spill.x - camX) * T, HUD + st.spill.y * T);
		g.globalAlpha = 1;
	}
	// 匠（導火線の あいだは 白く 点滅）
	if (st.takumi) {
		const blink = Math.floor(t / 180) % 2 === 0;
		cell(
			blink ? "takumiFlash" : "takumi",
			(st.takumi.x - camX) * T,
			HUD + st.takumi.y * T,
		);
	}
	// キリコ（足踏みは 手数で）
	const base = KIRIKO[st.dir];
	const name = (step % 2 ? base.replace(/0$/, "1") : base) as SabaCell;
	cell(name, (st.x - camX) * T, HUD + st.y * T);
	// 札
	g.fillStyle = "#14121c";
	g.fillRect(0, 0, 240, HUD);
	g.font = "9px 'DotGothic16', monospace";
	g.textBaseline = "middle";
	g.fillStyle = "#ffffff";
	cell("diamond", 4, 3);
	g.fillText(`×${st.dia}`, 22, 11);
	cell("torch", 56, 3);
	g.fillText(`×${st.torches}`, 74, 11);
	cell("pickaxe", 108, 3);
	const r = st.pick / MINE.PICK;
	g.fillStyle = "#3a3a44";
	g.fillRect(126, 8, 64, 6);
	g.fillStyle = r > 1 / 3 ? "#8fd06a" : r > 1 / 6 ? "#e0b040" : "#e05040";
	g.fillRect(126, 8, Math.round(64 * r), 6);
	if (st.takumi && Math.floor(t / 180) % 2 === 0) cell("takumi", 214, 3);
};

/** ブラマイを 1回（B で 1手も 打たずに やめたら null）。 */
export const playMine = async (ctx: UiCtx): Promise<MineResult | null> => {
	if (hook) return hook();
	const b = board(ctx, MINE_TEXT_BOARD.title, MINE_TEXT_BOARD.hint);
	// 2倍の 下地（小さい 字を くっきり。jikkyoTvKit・debate と 同じ）
	b.canvas.width = 480;
	b.canvas.height = 300;
	const g = b.canvas.getContext("2d");
	if (!g) throw new Error("canvas");
	g.setTransform(2, 0, 0, 2, 0, 0);
	g.imageSmoothingEnabled = false;
	const say = (t: string): void => {
		b.note.textContent = t;
	};
	const q: MineAct[] = [];
	// 長押しの くりかえしと、溶岩が あふれた あとの 間（data/sabaMine.ts の gateAct）
	const gate = mineGate();
	let quitAt = Number.NEGATIVE_INFINITY;
	/** B を 1回 押す 前の 一言（1.5秒 たったら もどす）。 */
	let beforeQuit = "";
	let wantQuit = false;
	const st = mineNew(Math.random);
	const pop = ctx.input.push(
		(k: Key, repeat: boolean) => {
			const now = performance.now();
			if (k === "b") {
				if (repeat) return;
				if (now - quitAt < QUIT_MS) wantQuit = true;
				else {
					quitAt = now;
					const n = b.note.textContent ?? "";
					if (n !== MINE_TEXT_BOARD.quit1) beforeQuit = n;
					say(MINE_TEXT_BOARD.quit1);
				}
				return;
			}
			const act: MineAct | null =
				k === "a"
					? "torch"
					: k === "up" || k === "down" || k === "left" || k === "right"
						? k
						: null;
			if (act && gateAct(gate, act, now, repeat)) q.push(act);
		},
		// 板の 外の タップは B（2回で 地上へ）
		{ tap: "b" },
	);
	const onTap = (e: PointerEvent): void => {
		e.preventDefault();
		const r = b.canvas.getBoundingClientRect();
		const px = ((e.clientX - r.left) * 240) / r.width;
		const py = ((e.clientY - r.top) * 150) / r.height;
		if (py < HUD) return;
		const camX = Math.max(0, Math.min(MINE.W - MINE.VIEW_W, st.x - 7));
		const cx = Math.floor(px / T) + camX;
		const cy = Math.floor((py - HUD) / T);
		const dx = cx - st.x;
		const dy = cy - st.y;
		const act: MineAct =
			dx === 0 && dy === 0
				? "torch"
				: Math.abs(dx) >= Math.abs(dy)
					? dx > 0
						? "right"
						: "left"
					: dy > 0
						? "down"
						: "up";
		if (gateAct(gate, act, performance.now(), false)) q.push(act);
	};
	b.canvas.addEventListener("pointerdown", onTap);
	try {
		const img = await loadImage(SABA_IMG);
		say(MINE_TEXT_BOARD.start);
		draw(g, img, st, performance.now(), 0);
		await sleep(400);
		q.length = 0;
		for (;;) {
			const now = await tick();
			if (wantQuit) {
				if (st.steps === 0) return null;
				mineAct(st, "quit");
			}
			// B 1回の 一言は 1.5秒で もとに もどす
			if (
				now - quitAt >= QUIT_MS &&
				b.note.textContent === MINE_TEXT_BOARD.quit1
			) {
				quitAt = Number.NEGATIVE_INFINITY;
				say(beforeQuit);
			}
			const a = q.shift();
			if (a) {
				const ev = mineAct(st, a);
				for (const e of ev) {
					const se = SE[e];
					if (se) ctx.se(se);
				}
				// あふれた：手前に 押した 分は 捨てて 少し 止まる（長押しは 押しなおすまで）
				if (ev.includes("spill")) {
					gateSpill(gate, performance.now());
					q.length = 0;
				}
				const top = MINE_NOTE_ORDER.find((e) => ev.includes(e));
				if (top && NOTE[top]) say(NOTE[top]);
			}
			draw(g, img, st, now, st.steps);
			if (st.over) break;
		}
		say(MINE_TEXT_BOARD.end.replace("{n}", String(st.dia)));
		ctx.se(st.dia > 0 && st.over !== "lava" ? "victory" : "cancel");
		await sleep(1600);
		return { dia: st.dia, end: st.over ?? "quit" };
	} finally {
		pop();
		b.canvas.removeEventListener("pointerdown", onTap);
		b.close();
	}
};

if (import.meta.env.DEV && typeof window !== "undefined")
	(window as unknown as { __mine: () => Promise<MineResult | null> }).__mine =
		() => {
			const ctx = (window as unknown as { __village?: { ctx?: UiCtx } })
				.__village?.ctx;
			if (!ctx) throw new Error("__mine: 村が ない");
			return playMine(ctx);
		};
