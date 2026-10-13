// 「地雷スレ」（data/arcade/home/mines.ts）の 試験。

import {
	MS,
	msFlag,
	msOpen,
	msOpened,
	msScore,
	msStart,
} from "../../data/arcade/home/mines";
import { type HomeGameTest, ok, seeded } from "./kit";

export const tests: HomeGameTest[] = [
	{
		name: "地雷スレは はじめの 1マスが 安全で、0 の 広がりが 開く",
		run: () => {
			for (let seed = 1; seed <= 30; seed++) {
				const s = msStart();
				const ev = msOpen(s, 0, 0, seeded(seed));
				ok(!s.over && ev.includes("open"), `seed ${seed} boom ${ev}`);
				ok(s.grid[0][0].n === 0 && msOpened(s) >= 4, `seed ${seed} spread`);
				ok(
					s.grid.flat().filter((c) => c.mine).length === MS.mines,
					"mine count",
				);
			}
		},
	},
	{
		name: "地雷スレは 地雷を 踏むと おわり、ぜんぶ 開くと クリア、旗で まとめて 開く",
		run: () => {
			const a = msStart();
			msOpen(a, 8, 4, seeded(7));
			const at = a.grid.flat().findIndex((c) => c.mine);
			const [mx, my] = [at % MS.cols, Math.floor(at / MS.cols)];
			// 旗の 立った マスは 開かない
			ok(msFlag(a, mx, my, seeded(7)).includes("flag"), "flag");
			ok(msOpen(a, mx, my, seeded(7)).length === 0 && !a.over, "flag guards");
			msFlag(a, mx, my, seeded(7));
			const ev = msOpen(a, mx, my, seeded(7));
			ok(a.over && !a.clear && ev.includes("boom"), `boom ${ev}`);
			ok(msScore(a) === msOpened(a) * 5, "boom score");
			// 地雷の ない マスを ぜんぶ 開く
			const b = msStart();
			msOpen(b, 0, 0, seeded(9));
			for (let y = 0; y < MS.rows; y++)
				for (let x = 0; x < MS.cols; x++)
					if (!b.grid[y][x].mine) msOpen(b, x, y, seeded(9));
			ok(b.clear && msScore(b) >= 1000, `clear ${msScore(b)}`);
			// まとめて 開く：数字の まわりの 地雷に 旗を 立てて 数字を 押す
			const c = msStart();
			msOpen(c, 0, 0, seeded(3));
			let done = false;
			for (let y = 0; y < MS.rows && !done; y++)
				for (let x = 0; x < MS.cols && !done; x++) {
					const m = c.grid[y][x];
					if (!m.open || !m.n) continue;
					const ns: [number, number][] = [];
					for (let dy = -1; dy <= 1; dy++)
						for (let dx = -1; dx <= 1; dx++) {
							const n = c.grid[y + dy]?.[x + dx];
							if ((dx || dy) && n && !n.open) ns.push([x + dx, y + dy]);
						}
					const safe = ns.filter(([nx, ny]) => !c.grid[ny][nx].mine);
					if (!safe.length) continue;
					for (const [nx, ny] of ns)
						if (c.grid[ny][nx].mine) msFlag(c, nx, ny, seeded(3));
					msOpen(c, x, y, seeded(3));
					ok(
						safe.every(([nx, ny]) => c.grid[ny][nx].open) && !c.boom,
						"chord opened the rest",
					);
					done = true;
				}
			ok(done, "found a number to chord");
		},
	},
];
