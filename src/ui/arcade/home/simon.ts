// キリコの 家の ゲーム「音おぼえ」の 板（決まりは data/arcade/home/simon.ts、文は data/arcade/text.ts）。
// - 4つの パッドを 十字キーの ならび（←↓↑→）に 置く。十字キーで 押す。
// - タップは 盤の まんなかから 見た 向きの パッド（画面の どこでも よい）。
// - 音は 音楽室の ピアノ（engine/audio.ts の pianoNote）。村の ctx に audio が 無い ときは 効果音で 代える。
// 見た目の 乱数は Math.random（冒険の 乱数に さわらない）。

import {
	SM,
	SM_TEXT,
	type SmPad,
	smScore,
	smStart,
	smStep,
} from "../../../data/arcade/home/simon";
import { ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import type { G } from "../../neta/netaBoard";
import { txt } from "../../neta/netaBoard";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

/** 村の ctx（ui/ctx.ts の Ctx）が 持つ ピアノ。UiCtx には 無いので、あれば 使う。 */
type Piano = {
	preparePiano: () => Promise<void>;
	pianoNote: (midi: number, sec?: number) => void;
};
const pianoOf = (ctx: UiCtx): Piano | null => {
	const a = (ctx as { audio?: Partial<Piano> }).audio;
	return a?.preparePiano && a.pianoNote ? (a as Piano) : null;
};

/** ピアノが 無い ときの 音（パッドごとに ちがう 効果音）。 */
const FALLBACK = ["cursor", "decide", "put", "bubble"] as const;

const CX = 120;
const CY = 84;
const PAD = 34;
/** パッドの まんなか（←↓↑→）。 */
const AT: readonly (readonly [number, number])[] = [
	[CX - 40, CY],
	[CX, CY + 36],
	[CX, CY - 36],
	[CX + 40, CY],
];
const ARROW = ["←", "↓", "↑", "→"];
/** 消えて いる・光る 色。 */
const DIM = ["#6a2020", "#203a6a", "#205a2a", "#6a4010"];
const LIT = ["#ff6060", "#70a8ff", "#70f080", "#ffb050"];

const KEYS = ["left", "down", "up", "right"] as const;

const pad = (g: G, i: number, on: boolean): void => {
	const [x, y] = AT[i];
	const L = x - PAD / 2;
	const T = y - PAD / 2;
	if (on) {
		g.fillStyle = "rgba(255,255,255,0.25)";
		g.fillRect(L - 3, T - 3, PAD + 6, PAD + 6);
	}
	g.fillStyle = on ? LIT[i] : DIM[i];
	g.fillRect(L, T, PAD, PAD);
	g.fillStyle = "rgba(0,0,0,0.3)";
	g.fillRect(L, T + PAD - 3, PAD, 3);
	txt(g, ARROW[i], x, y - 6, 12, on ? "#ffffff" : "#c8c8d0", "center");
};

export const playSimon = async (ctx: UiCtx): Promise<ArcadeResult | null> => {
	const piano = pianoOf(ctx);
	// ピアノの 音色を 読む（待ちすぎない）
	if (piano)
		await Promise.race([
			piano.preparePiano().catch(() => undefined),
			new Promise((r) => setTimeout(r, 2500)),
		]);
	return playBoard(ctx, "simon", {
		start: () => smStart(rnd),
		step: (s, f) => {
			let press: SmPad | null = null;
			const ring = (p: SmPad) => {
				if (piano) piano.pianoNote(SM.notes[p], 0.5);
				else f.se(FALLBACK[p]);
			};
			for (const e of f.evs) {
				if (press !== null) break;
				for (let i = 0; i < 4; i++) if (isKey(e, KEYS[i])) press = i as SmPad;
				if (isTap(e)) {
					const dx = e.tap[0] - CX;
					const dy = e.tap[1] - CY;
					if (Math.abs(dx) >= Math.abs(dy)) press = dx < 0 ? 0 : 3;
					else press = dy < 0 ? 2 : 1;
				}
			}
			// 見せて いる あいだの 押しは 数えない
			if (s.phase !== "input") press = null;
			for (const e of smStep(s, f.dt, press, rnd)) {
				if (e.k === "lit" || e.k === "ok") ring(e.pad);
				else if (e.k === "round") f.se(e.rev ? "combo" : "arcCoin");
				else if (e.k === "wrong") f.se(e.retry ? "cancel" : "miss");
			}
		},
		draw: (g, s, clock) => {
			g.fillStyle = "#14121c";
			g.fillRect(0, 0, 240, 150);
			// ターンテーブルの 皿
			g.fillStyle = "#24222e";
			g.fillRect(CX - 62, CY - 56, 124, 112);
			g.fillStyle = "#0c0c10";
			g.fillRect(CX - 10, CY - 10, 20, 20);
			g.fillStyle = "#c0a060";
			const r = Math.floor(clock * 4) % 4;
			g.fillRect(CX - 2 + (r % 2 ? 4 : -4), CY - 2 + (r < 2 ? -4 : 4), 3, 3);
			for (let i = 0; i < 4; i++) {
				const blink = s.phase === "fail" && Math.floor(clock * 8) % 2 === 0;
				const on = s.phase === "fail" ? s.want === i && blink : s.lit === i;
				pad(g, i, on);
			}
			const say =
				s.phase === "fail"
					? s.retry
						? SM_TEXT.again
						: SM_TEXT.wrong
					: s.phase === "input"
						? s.rev
							? SM_TEXT.rev
							: SM_TEXT.yours
						: s.rev
							? SM_TEXT.revWatch
							: s.rounds && s.i === 0 && s.lit === null
								? SM_TEXT.nice
								: SM_TEXT.watch;
			txt(
				g,
				say,
				8,
				136,
				8,
				s.phase === "fail" ? "#ff8080" : s.rev ? "#ffb050" : "#d8d8e0",
			);
			// のこりの おかわり（左上）
			if (s.lives > 0)
				txt(g, `${SM_TEXT.life}　${s.lives}`, 8, 20, 8, "#70f080");
			// 逆からの 回は 皿の まわりを 橙に
			if (s.rev) {
				g.fillStyle = "#ffb050";
				g.fillRect(CX - 62, CY - 57, 124, 1);
				g.fillRect(CX - 62, CY + 56, 124, 1);
			}
			txt(
				g,
				`${s.phase === "input" ? s.i : 0} / ${s.seq.length}`,
				232,
				136,
				8,
				"#a0a0b0",
				"right",
			);
			hud(
				g,
				`${ARCADE_BOARD.score} ${smScore(s)}`,
				`${SM_TEXT.round} ${s.rounds + 1}`,
			);
		},
		over: (s) => s.over,
		score: smScore,
	});
};
