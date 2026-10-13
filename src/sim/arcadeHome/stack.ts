// スレ積み の 試験（data/arcade/home/stack.ts）。

import { ST, stGhost, stStart, stStep } from "../../data/arcade/home/stack";
import { type HomeGameTest, ok, seeded } from "./kit";

const still = { dx: 0, rotate: false, soft: false };

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
	{
		name: "スレ積みは ↑ で 影の 位置へ 一気に 置き、続けて 消すと 連続の 点、4列 連発は 1.5倍",
		run: () => {
			const rnd = seeded(6);
			const s = stStart(seeded(7));
			s.cur = { k: 1, r: 0, x: 0, y: 0 };
			const gy = stGhost(s).y;
			ok(gy === ST.rows - 2, `ghost ${gy}`);
			const ev = stStep(s, 0, { ...still, drop: true }, rnd);
			ok(ev.includes("drop") && ev.includes("lock"), `ev ${ev}`);
			ok(
				s.points === gy * 2 && s.grid[ST.rows - 1][0] === 2,
				`pts ${s.points}`,
			);
			// 縦の 棒で 4列を 2回 続けて
			const t = stStart(seeded(8));
			const fill = () => {
				for (let y = ST.rows - 4; y < ST.rows; y++)
					for (let x = 0; x < ST.cols - 1; x++) t.grid[y][x] = 3;
				t.cur = { k: 0, r: 1, x: ST.cols - 3, y: 0 };
				stStep(t, 0, { ...still, drop: true }, rnd);
			};
			fill();
			const p1 = t.points;
			fill();
			// 2回めは 800×1.5 ＋ 連続 50
			ok(p1 >= 800 && t.points - p1 >= 1250, `b2b ${t.points - p1}`);
			ok(t.combo === 1 && t.lines === 8, `combo ${t.combo}`);
		},
	},
	{
		name: "スレ積みは 下が ふさがっても 少しの 間は 動かせる",
		run: () => {
			const rnd = seeded(9);
			const s = stStart(seeded(10));
			s.cur = { k: 1, r: 0, x: 0, y: ST.rows - 2 };
			stStep(s, 0.3, still, rnd);
			ok(s.cur.y === ST.rows - 2 && s.grid[ST.rows - 1][0] === 0, "not yet");
			stStep(s, 0.01, { ...still, dx: 1 }, rnd);
			stStep(s, 0.3, still, rnd);
			ok(s.cur.x === 1 && s.grid[ST.rows - 1][1] === 0, "moved, still free");
			stStep(s, 0.3, still, rnd);
			ok(s.grid[ST.rows - 1][1] === 2, "locked");
		},
	},
];
