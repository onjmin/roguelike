// ID腹筋の 板（ageジムの 腹筋台。ID と 回数は data/neta/id.ts、文は data/neta/text.ts の FUKKIN）。
// 240x150（2倍の 下地）：左に ID と 回数・マットの 上で 腹筋する 子（neta.png の koDown/koUp を 3倍）・あと 何回、
// 右に スレ（>>1 の 題、名無しの「ほい」「てす」…）。A／タップの 連打 1回で 1回（mash が 数える）。
// 回数に 届いたら 完走（乙）。B（板の 外の タップ）で そっ閉じ（そこまでの 回数は 残る）。おわった 回数を 返す（その 帰りの 合計）。

import { kirikoName } from "../data/neta/id";
import { FUKKIN } from "../data/neta/text";
import type { UiCtx } from "./list";
import { board, sleep, tick } from "./minigameBoard";
import {
	crisp,
	drawNeta,
	drawPosts,
	type G,
	loadNetaImg,
	mash,
	type Post,
	txt,
} from "./netaBoard";
import { fill } from "./villageTalk";

export type FukkinResult = { done: number };

const UP_MS = 110;

const draw = (
	g: G,
	img: HTMLImageElement | null,
	o: { id: string; reps: number },
	done: number,
	up: boolean,
	posts: readonly Post[],
): void => {
	g.fillStyle = "#18181e";
	g.fillRect(0, 0, 240, 150);
	txt(g, `ID:${o.id}`, 10, 6, 14, "#ffe060");
	txt(g, `→　${o.reps}回`, 10, 24, 9, "#e8e8f0");
	drawNeta(g, img, up ? "koUp" : "koDown", 22, 40, 3);
	txt(g, String(Math.max(0, o.reps - done)), 60, 112, 16, "#f4f2ea", "center");
	g.fillStyle = "#3a3a48";
	g.fillRect(12, 136, 96, 4);
	g.fillStyle = "#ffe060";
	g.fillRect(
		12,
		136,
		Math.round((96 * Math.min(done, o.reps)) / Math.max(1, o.reps)),
		4,
	);
	drawPosts(g, posts, 122, 6, 114, 138, 7);
};

export const playFukkin = async (
	ctx: UiCtx,
	o: { id: string; reps: number; done: number; title: boolean },
): Promise<FukkinResult> => {
	const b = board(ctx, FUKKIN.title, FUKKIN.hint);
	const g = crisp(b);
	const m = mash(ctx, b.root);
	const img = await loadNetaImg();
	const say = (t: string) => {
		b.note.textContent = t;
	};
	const posts: Post[] = [
		{ name: "1", body: FUKKIN.title, ink: "#8ab48a" },
		{ name: kirikoName(o.title), body: `ID:${o.id}`, ink: "#ffe060" },
	];
	const start =
		o.reps === 1
			? FUKKIN.postOne
			: o.reps >= 100
				? FUKKIN.postMany
				: fill(FUKKIN.postFew, { n: o.reps });
	posts.push({ name: "3", body: start });
	let no = 4;
	const post = (body: string) => posts.push({ name: String(no++), body });
	let done = o.done;
	let upUntil = 0;
	let nextPost = performance.now() + 1500 + Math.random() * 1500;
	let half = done * 2 >= o.reps;
	try {
		say(fill(FUKKIN.note, { left: o.reps - done }));
		draw(g, img, o, done, false, posts);
		await sleep(400);
		m.take();
		for (;;) {
			const now = await tick();
			const k = m.take();
			if (k.b) {
				say(fill(FUKKIN.noteQuit, { done }));
				ctx.se("cancel");
				draw(g, img, o, done, false, posts);
				await sleep(700);
				return { done };
			}
			if (k.a > 0) {
				done = Math.min(o.reps, done + k.a);
				upUntil = now + UP_MS;
				ctx.se("cursor");
				say(fill(FUKKIN.note, { left: o.reps - done }));
			}
			if (!half && done * 2 >= o.reps) {
				half = true;
				post(FUKKIN.postHalf);
			}
			if (now >= nextPost) {
				post(FUKKIN.posts[Math.floor(Math.random() * FUKKIN.posts.length)]);
				nextPost = now + 1500 + Math.random() * 1500;
			}
			draw(g, img, o, done, now < upUntil, posts);
			if (done >= o.reps) {
				post(FUKKIN.postDone);
				post(FUKKIN.postDone2);
				say(fill(FUKKIN.noteDone, { n: o.reps }));
				ctx.se("levelup");
				draw(g, img, o, done, false, posts);
				await sleep(1500);
				return { done };
			}
		}
	} finally {
		m.stop();
		b.close();
	}
};
