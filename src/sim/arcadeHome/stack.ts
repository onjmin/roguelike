// スレ積み の 試験（data/arcade/home/stack.ts）。

import { ST, stStart, stStep } from "../../data/arcade/home/stack";
import { type HomeGameTest, ok, seeded } from "./kit";

export const tests: HomeGameTest[] = [
	{
		name: "スレ積みは 何も しないと 積みあがって おわり",
		run: () => {
			const s = stStart(seeded(1));
			const rnd = seeded(2);
			for (let i = 0; i < 20000 && !s.over; i++)
				stStep(s, 0.05, { dx: 0, rotate: false, soft: true }, rnd);
			ok(s.over && s.points === 0, `over ${s.over} pts ${s.points}`);
		},
	},
	{
		name: "スレ積みは 横 1列 そろうと 消えて 100点、4列で 800点",
		run: () => {
			const s = stStart(seeded(3));
			const rnd = seeded(4);
			// 下 1列を 左 4マス だけ あけて うめ、横の 棒（I）を そこへ
			for (let x = 4; x < ST.cols; x++) s.grid[ST.rows - 1][x] = 2;
			s.cur = { k: 0, r: 0, x: 0, y: 0 };
			let ev: string[] = [];
			for (let i = 0; i < 200 && s.lines === 0; i++)
				ev = ev.concat(
					stStep(s, 0.05, { dx: 0, rotate: false, soft: true }, rnd),
				);
			ok(
				s.lines === 1 && s.points === 100 && ev.includes("clear"),
				`lines ${s.lines} pts ${s.points}`,
			);
			ok(
				s.grid[ST.rows - 1].every((c) => c === 0),
				"the row is gone",
			);
			// 下 4列を 右はし だけ あけて、縦の 棒を そこへ
			const t = stStart(seeded(5));
			for (let y = ST.rows - 4; y < ST.rows; y++)
				for (let x = 0; x < ST.cols - 1; x++) t.grid[y][x] = 3;
			t.cur = { k: 0, r: 1, x: ST.cols - 3, y: 0 };
			for (let i = 0; i < 400 && t.lines === 0; i++)
				stStep(t, 0.05, { dx: 0, rotate: false, soft: true }, rnd);
			ok(t.lines === 4 && t.points === 800, `lines ${t.lines} pts ${t.points}`);
		},
	},
];
