// レス食い の 試験（data/arcade/home/resukui.ts）。

import {
	RK,
	RK_DIRS,
	RK_MAZE,
	rkOpen,
	rkStart,
	rkStep,
} from "../../data/arcade/home/resukui";
import { type HomeGameTest, ok, seeded } from "./kit";

export const tests: HomeGameTest[] = [
	{
		name: "レス食いの 迷路は 行きどまりが なく、レスは ぜんぶ 届く",
		run: () => {
			ok(
				RK_MAZE.length === RK.rows &&
					RK_MAZE.every((r) => r.length === RK.cols),
				"size",
			);
			const seen = new Set<string>([`${RK.start[0]},${RK.start[1]}`]);
			const q: [number, number][] = [[RK.start[0], RK.start[1]]];
			while (q.length) {
				const [x, y] = q.shift() ?? [0, 0];
				let n = 0;
				for (const [dx, dy] of RK_DIRS) {
					const nx = (x + dx + RK.cols) % RK.cols;
					const ny = y + dy;
					if (!rkOpen(nx, ny)) continue;
					n++;
					const k = `${nx},${ny}`;
					if (!seen.has(k)) {
						seen.add(k);
						q.push([nx, ny]);
					}
				}
				ok(n >= 2, `dead end ${x},${y}`);
			}
			for (let y = 0; y < RK.rows; y++)
				for (let x = 0; x < RK.cols; x++)
					if (".o".includes(RK_MAZE[y][x]))
						ok(seen.has(`${x},${y}`), `dot ${x},${y}`);
		},
	},
	{
		name: "レス食いは レスを 食べて 点、通報で 荒らしが 青く なり 食べると 200",
		run: () => {
			const s = rkStart();
			const rnd = seeded(1);
			rkStep(s, RK.readyTime + 0.01, { dir: null }, rnd);
			ok(s.phase === "play", `phase ${s.phase}`);
			// 左へ すすむ と レスを 食べる
			for (let i = 0; i < 10; i++) rkStep(s, 0.05, { dir: 3 }, rnd);
			ok(s.points > 0 && s.points % 10 === 0, `pts ${s.points}`);
			// 通報の 1つ 手前へ 置く
			s.pac = { x: 1, y: 2, dir: 0, t: 0 };
			s.want = 0;
			s.ghosts[0] = { ...s.ghosts[0], x: 3, y: 1, dir: 3, t: 0, mode: "out" };
			let ev: string[] = [];
			for (let i = 0; i < 6 && !ev.includes("pellet"); i++)
				ev = ev.concat(rkStep(s, 0.03, { dir: null }, rnd));
			ok(ev.includes("pellet") && s.fright > 0, `ev ${ev}`);
			ok(
				s.ghosts.every((g) => g.blue),
				"all blue",
			);
			const p0 = s.points;
			for (let i = 0; i < 40 && !ev.includes("ghost"); i++) {
				const g = s.ghosts[0];
				s.ghosts[0] = { ...g, x: s.pac.x, y: s.pac.y, t: 0 };
				ev = ev.concat(rkStep(s, 0.02, { dir: null }, rnd));
			}
			ok(
				ev.includes("ghost") && s.points - p0 >= 200,
				`ghost ${s.points - p0}`,
			);
			ok(s.ghosts[0].mode === "eyes", `mode ${s.ghosts[0].mode}`);
		},
	},
	{
		name: "レス食いは 荒らしに ふれると 1機 へり、3機で おわり。ぜんぶ 食べると 段が 上がる",
		run: () => {
			const s = rkStart();
			const rnd = seeded(2);
			for (let n = 0; n < 3; n++) {
				let ev: string[] = [];
				for (let i = 0; i < 400 && !ev.includes("die"); i++) {
					if (s.phase === "play") {
						const g = s.ghosts[0];
						s.ghosts[0] = {
							...g,
							x: s.pac.x,
							y: s.pac.y,
							t: 0,
							mode: "out",
							blue: false,
						};
					}
					ev = ev.concat(rkStep(s, 0.05, { dir: null }, rnd));
				}
				ok(ev.includes("die"), `die ${n}`);
				for (let i = 0; i < 60 && s.phase === "die"; i++)
					rkStep(s, 0.05, { dir: null }, rnd);
			}
			ok(s.over && s.lives === 0, `lives ${s.lives}`);
			// のこり 1つで 食べると 段 2
			const t = rkStart();
			rkStep(t, RK.readyTime + 0.01, { dir: null }, rnd);
			for (const row of t.dots) row.fill(" ");
			t.dots[7][8] = ".";
			t.left = 1;
			let ev: string[] = [];
			for (let i = 0; i < 20 && !ev.includes("clear"); i++)
				ev = ev.concat(rkStep(t, 0.05, { dir: 3 }, rnd));
			ok(ev.includes("clear"), `clear ${ev}`);
			for (let i = 0; i < 60 && t.level === 1; i++)
				rkStep(t, 0.05, { dir: null }, rnd);
			ok(t.level === 2 && t.left > 100 && !t.over, `level ${t.level}`);
		},
	},
];
