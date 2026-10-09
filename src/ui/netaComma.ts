// コンマの 台の 板（ゲームセンター。決まりは data/neta/comma.ts、文は data/neta/text.ts の COMMA）。
// 240x150（2倍の 下地）：上に スレ（書きこみ 1行＝番号・名前・ID・時刻）、下に 大きな 時計（ミリ秒は 黄色で 回る）。
// - コンマ：A／タップで 書きこむ（10回まで。間は 0.6秒）。ミリ秒は 押した 時刻（presses の at）から。
//   ゾロ目なら 名無しが「！？」「おめでとうございます」「預言者よ…」、はじめての ゾロ目は 主が「!cap第一当選者」
//   → 以後 キリコの 名前に ▲第一当選者（記録に 残る。ほかの 板＝別スレでも つく）。
//   B（板の 外の タップ）で やめる（それまでの 書きこみは 数える）。
// - 0時ちょうど：23:59:55.000 から 進む 時計（その 場で 始まる 5秒の 時計。端末の 分・秒は 見ない）。A で 1回だけ 書きこむ。
//   書きこみは 鯖の 重さで 8〜24ms おくれる。00:00:03 を 過ぎたら 書きこめず おわり。名無しの 返しは 判定で 1つ。
//   回る 時計も 書きこみも zeroClock（淫夢の ミリ秒は 出さない）。B（板の 外の タップ）で やめる（null。スマホでも
//   やめられる ように）。

import {
	COMMA_GAP_MS,
	COMMA_POSTS,
	commaOf,
	isNearZoro,
	isZoro,
	wallClock,
	ZERO_LAG_MIN,
	ZERO_LAG_SPAN,
	ZERO_LEAD_MS,
	ZERO_TAIL_MS,
	zeroClock,
	zeroDeny,
	zeroJudge,
} from "../data/neta/comma";
import { kirikoName } from "../data/neta/id";
import { COMMA } from "../data/neta/text";
import type { UiCtx } from "./list";
import { board, sleep, tick } from "./minigameBoard";
import {
	crisp,
	drawPosts,
	type G,
	type Post,
	pressesB,
	txt,
} from "./netaBoard";
import { fill } from "./villageTalk";

export type CommaResult = { stamps: number[] };
export type ZeroResult = { diff: number | null };

const draw = (
	g: G,
	posts: readonly Post[],
	clock: string,
	left: string,
): void => {
	g.fillStyle = "#101018";
	g.fillRect(0, 0, 240, 150);
	drawPosts(g, posts, 4, 4, 232, 98, 8);
	const [hms, ms] = clock.split(".");
	g.fillStyle = "#08080e";
	g.fillRect(24, 106, 192, 30);
	txt(g, hms, 150, 110, 20, "#f4f2ea", "right");
	txt(g, `.${ms}`, 150, 110, 20, "#ffe060", "left");
	txt(g, left, 236, 140, 7, "#a0a0b0", "right");
};

/** コンマ（1つも 書かずに やめたら null）。 */
export const playComma = async (
	ctx: UiCtx,
	o: { id: string; title: boolean },
): Promise<CommaResult | null> => {
	const b = board(ctx, COMMA.title, COMMA.hint);
	const g = crisp(b);
	const p = pressesB(ctx, b.root);
	const say = (t: string) => {
		b.note.textContent = t;
	};
	const stamps: number[] = [];
	const posts: Post[] = [{ name: "1", body: COMMA.title, ink: "#8ab48a" }];
	let no = 2;
	let title = o.title;
	let until = 0;
	try {
		say(fill(COMMA.note, { n: COMMA_POSTS }));
		await sleep(400);
		p.take();
		for (;;) {
			const now = await tick();
			const k = p.take();
			if (k === "b") break;
			if (k === "a" && now >= until && stamps.length < COMMA_POSTS) {
				// 押した 時刻の 端末の 時計
				const wall = Date.now() - (performance.now() - p.at());
				const ms = commaOf(wall);
				stamps.push(ms);
				posts.push({
					name: String(no++),
					body: `${kirikoName(title)}　ID:${o.id}　${wallClock(wall)}`,
					ink: isZoro(ms) ? "#ffe060" : undefined,
				});
				until = now + COMMA_GAP_MS;
				if (isZoro(ms)) {
					ctx.se("levelup");
					say(COMMA.zoroNote);
					for (const t of COMMA.posts.zoro)
						posts.push({ name: String(no++), body: t });
					if (!title) {
						posts.push({ name: "1", body: COMMA.posts.cap, ink: "#8ab48a" });
						title = true;
					}
				} else {
					ctx.se("cursor");
					if (isNearZoro(ms) && Math.random() < 0.3)
						posts.push({ name: String(no++), body: COMMA.posts.near });
					else if (Math.random() < 0.15)
						posts.push({
							name: String(no++),
							body: COMMA.posts.meh[
								Math.floor(Math.random() * COMMA.posts.meh.length)
							],
						});
					say(fill(COMMA.note, { n: COMMA_POSTS - stamps.length }));
				}
			}
			draw(g, posts, wallClock(Date.now()), `${stamps.length}／${COMMA_POSTS}`);
			if (stamps.length >= COMMA_POSTS && now >= until) break;
		}
		await sleep(600);
		return stamps.length ? { stamps } : null;
	} finally {
		p.stop();
		b.close();
	}
};

/** 0時ちょうど（書きこめなければ diff: null、B で やめたら null）。 */
export const playZero = async (
	ctx: UiCtx,
	o: { id: string; title: boolean },
): Promise<ZeroResult | null> => {
	const b = board(ctx, COMMA.zeroTitle, COMMA.zeroHint);
	const g = crisp(b);
	const p = pressesB(ctx, b.root);
	const say = (t: string) => {
		b.note.textContent = t;
	};
	const posts: Post[] = [{ name: "1", body: COMMA.zeroTitle, ink: "#8ab48a" }];
	try {
		say(COMMA.zeroNote);
		draw(g, posts, zeroClock(-ZERO_LEAD_MS), "");
		await sleep(600);
		p.take();
		const t0 = performance.now();
		for (;;) {
			await tick();
			const k = p.take();
			const diffNow = performance.now() - t0 - ZERO_LEAD_MS;
			if (k === "b") return null;
			if (k === "a") {
				const diff = zeroDeny(
					p.at() -
						t0 -
						ZERO_LEAD_MS +
						ZERO_LAG_MIN +
						Math.random() * ZERO_LAG_SPAN,
				);
				const j = zeroJudge(diff);
				posts.push({
					name: "2",
					body: `${kirikoName(o.title)}　ID:${o.id}　${zeroClock(diff)}`,
					ink: "#ffe060",
				});
				posts.push({ name: "3", body: COMMA.posts.zero[j] });
				say(COMMA.judge[j]);
				ctx.se(j === "god" || j === "exact" ? "levelup" : "decide");
				draw(g, posts, zeroClock(diff), "");
				await sleep(1400);
				return { diff };
			}
			if (diffNow > ZERO_TAIL_MS) return { diff: null };
			draw(g, posts, zeroClock(diffNow), "");
		}
	} finally {
		p.stop();
		b.close();
	}
};
