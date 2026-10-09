// リバーシの 板（碁会所の リバーシ盤。決まりは data/neta/othello.ts、文は data/neta/text.ts の OTHELLO。画面には 一般名の リバーシ）。
// 240x150（2倍の 下地）：左に 盤（16px の マス × 8、左上 (8,11)）、右に 石の 数・番・常連の 書きこみ。
// キリコは 黒で 先手：十字キーで カーソル、A で 打つ（打てない 所は「そこには　打てない」）、盤を マウスで 押すと その マスに
// 打つ。指の タップは 1回目で カーソルを 動かし、同じ マスを もう 1回で 打つ（マスが 小さく、打ち まちがえると もどせない）。
// 打てる マスに 点。常連は 0.45〜0.75秒 考えて 打つ。返る 石は 40ms ずつ 裏がえる。B（板の 外の タップ）を 2回で 投了（null）。
// 常連が 打つ あいだに たまった A・タップは 捨てる（キリコの 次の 手を 勝手に 打たない）。

import {
	BLACK,
	CORNERS,
	type Color,
	countDiscs,
	type Disc,
	flipsOf,
	legalMoves,
	othelloAi,
	othelloOver,
	othelloStart,
	WHITE,
} from "../data/neta/othello";
import { OTHELLO } from "../data/neta/text";
import type { UiCtx } from "./list";
import { board, sleep, tick } from "./minigameBoard";
import {
	crisp,
	drawPosts,
	type G,
	type Post,
	pad,
	twoB,
	txt,
} from "./netaBoard";
import { fill } from "./villageTalk";

export type OthelloResult = { black: number; white: number };

const OX = 8;
const OY = 11;
const CELL = 16;

const draw = (
	g: G,
	b: readonly Disc[],
	cur: number,
	hints: readonly number[],
	last: number,
	turn: Color,
	posts: readonly Post[],
): void => {
	g.fillStyle = "#1a1410";
	g.fillRect(0, 0, 240, 150);
	g.fillStyle = "#2f9e44";
	g.fillRect(OX, OY, CELL * 8, CELL * 8);
	g.strokeStyle = "#1d6a2e";
	g.lineWidth = 1;
	for (let i = 0; i <= 8; i++) {
		g.beginPath();
		g.moveTo(OX + i * CELL + 0.5, OY);
		g.lineTo(OX + i * CELL + 0.5, OY + CELL * 8);
		g.moveTo(OX, OY + i * CELL + 0.5);
		g.lineTo(OX + CELL * 8, OY + i * CELL + 0.5);
		g.stroke();
	}
	g.fillStyle = "#1d6a2e";
	for (const [x, y] of [
		[2, 2],
		[6, 2],
		[2, 6],
		[6, 6],
	])
		g.fillRect(OX + x * CELL - 1, OY + y * CELL - 1, 3, 3);
	for (let i = 0; i < 64; i++) {
		const cx = OX + (i % 8) * CELL + 8;
		const cy = OY + Math.floor(i / 8) * CELL + 8;
		if (b[i]) {
			g.fillStyle = b[i] === BLACK ? "#1a1a1a" : "#f4f4f0";
			g.beginPath();
			g.arc(cx, cy, 6.5, 0, Math.PI * 2);
			g.fill();
			g.strokeStyle = b[i] === BLACK ? "#000000" : "#a8a8a0";
			g.stroke();
		} else if (hints.includes(i)) {
			// 打てる マス（星の 3x3 より 大きく、見落とさない）
			g.fillStyle = "rgba(255,224,96,0.85)";
			g.fillRect(cx - 2, cy - 2, 4, 4);
		}
		if (i === last) {
			g.fillStyle = "#e03a2a";
			g.fillRect(cx - 1, cy - 1, 2, 2);
		}
	}
	if (cur >= 0) {
		g.strokeStyle = "#ffe060";
		g.strokeRect(
			OX + (cur % 8) * CELL + 1.5,
			OY + Math.floor(cur / 8) * CELL + 1.5,
			CELL - 3,
			CELL - 3,
		);
	}
	const c = countDiscs(b);
	txt(
		g,
		`●　キリコ　${c.black}`,
		144,
		12,
		8,
		turn === BLACK ? "#ffe060" : "#e8e8f0",
	);
	txt(
		g,
		`○　常連　${c.white}`,
		144,
		24,
		8,
		turn === WHITE ? "#ffe060" : "#e8e8f0",
	);
	drawPosts(g, posts, 142, 40, 94, 99);
};

/** リバーシ（投了で null）。 */
export const playOthello = async (
	ctx: UiCtx,
): Promise<OthelloResult | null> => {
	const bd = board(ctx, OTHELLO.title, OTHELLO.hint);
	const g = crisp(bd);
	const input = pad(ctx, bd.canvas);
	const quit = twoB();
	/** 「もう　1回で　投了」の 前の 字（1回目の B から 1.5秒 たったら もどす）。 */
	let shown = "";
	const say = (t: string) => {
		shown = t;
		bd.note.textContent = t;
	};
	/** B を 1回 押した（2回目なら true＝投了）。 */
	const pressB = (at: number): boolean => {
		if (quit.press(at)) return true;
		bd.note.textContent = OTHELLO.quit1;
		return false;
	};
	const lapse = () => {
		if (quit.lapsed(performance.now())) bd.note.textContent = shown;
	};
	let b: Disc[] = othelloStart();
	let cur = 19;
	let last = -1;
	const posts: Post[] = [{ name: "", body: OTHELLO.posts.hello }];
	/** 打つ（返る 石を 40ms ずつ）。 */
	const place = async (at: number, me: Color) => {
		const f = flipsOf(b, at, me);
		b = [...b];
		b[at] = me;
		last = at;
		ctx.se("decide");
		for (const i of f) {
			b[i] = me;
			draw(g, b, -1, [], last, me, posts);
			await sleep(40);
		}
		if (CORNERS.includes(at))
			posts.push({
				name: "",
				body: me === WHITE ? OTHELLO.posts.corner : OTHELLO.posts.cornerYou,
			});
	};
	try {
		await sleep(300);
		input.take();
		let passes = 0;
		let turn: Color = BLACK;
		while (!othelloOver(b) && passes < 2) {
			const moves = legalMoves(b, turn);
			if (!moves.length) {
				passes++;
				say(turn === BLACK ? OTHELLO.passYou : OTHELLO.passThem);
				if (turn === WHITE) posts.push({ name: "", body: OTHELLO.posts.pass });
				draw(g, b, -1, [], last, turn, posts);
				await sleep(900);
				turn = turn === BLACK ? WHITE : BLACK;
				continue;
			}
			passes = 0;
			if (turn === WHITE) {
				say(OTHELLO.them);
				draw(g, b, -1, [], last, turn, posts);
				const until = performance.now() + 450 + Math.random() * 300;
				while (performance.now() < until) {
					for (const e of input.take())
						if ("k" in e && e.k === "b" && pressB(e.at)) return null;
					lapse();
					await tick();
				}
				const m = othelloAi(b, WHITE, Math.random);
				if (m !== null) await place(m, WHITE);
				turn = BLACK;
				continue;
			}
			// キリコの 番（常連の 番に たまった 押しは 捨てる。B だけは 投了の 2回に 数える）
			say(OTHELLO.you);
			for (const e of input.take())
				if ("k" in e && e.k === "b" && pressB(e.at)) return null;
			if (!moves.includes(cur)) cur = moves[0];
			let chosen = -1;
			while (chosen < 0) {
				draw(g, b, cur, moves, last, turn, posts);
				for (const e of input.take()) {
					if ("tap" in e) {
						const x = Math.floor((e.tap[0] - OX) / CELL);
						const y = Math.floor((e.tap[1] - OY) / CELL);
						if (x < 0 || x > 7 || y < 0 || y > 7) continue;
						const at = y * 8 + x;
						// 指は 1回目で カーソルだけ（となりの マスに 打ち まちがえない）。マウスは すぐ 打つ
						const again = at === cur || !e.touch;
						cur = at;
						if (!moves.includes(cur)) {
							ctx.se("miss");
							say(OTHELLO.bad);
						} else if (again) chosen = cur;
						else {
							ctx.se("cursor");
							say(OTHELLO.tapAgain);
						}
					} else if (e.k === "b") {
						if (pressB(e.at)) return null;
					} else if (e.k === "a") {
						if (moves.includes(cur)) chosen = cur;
						else {
							ctx.se("miss");
							say(OTHELLO.bad);
						}
					} else {
						const dx = e.k === "left" ? -1 : e.k === "right" ? 1 : 0;
						const dy = e.k === "up" ? -1 : e.k === "down" ? 1 : 0;
						const x = ((cur % 8) + dx + 8) % 8;
						const y = (Math.floor(cur / 8) + dy + 8) % 8;
						cur = y * 8 + x;
						ctx.se("cursor");
					}
					if (chosen >= 0) break;
				}
				if (chosen < 0) {
					lapse();
					await tick();
				}
			}
			await place(chosen, BLACK);
			turn = WHITE;
		}
		const c = countDiscs(b);
		posts.push({
			name: "",
			body: c.black > c.white ? OTHELLO.posts.strong : OTHELLO.posts.thanks,
		});
		const v = { b: c.black, w: c.white };
		say(
			fill(
				c.black > c.white
					? OTHELLO.win
					: c.black < c.white
						? OTHELLO.lose
						: OTHELLO.draw,
				v,
			),
		);
		ctx.se(c.black > c.white ? "victory" : "cancel");
		draw(g, b, -1, [], last, BLACK, posts);
		const t0 = performance.now();
		while (performance.now() - t0 < 2000) {
			// おわった あとは A・B・タップで 閉じる（結果は もう 決まって いる）
			if (input.take().some((e) => "tap" in e || e.k === "a" || e.k === "b"))
				break;
			await tick();
		}
		return { black: c.black, white: c.white };
	} finally {
		input.stop();
		bd.close();
	}
};
