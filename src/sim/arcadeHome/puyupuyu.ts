// ぷゆぷゆ の 試験（data/arcade/home/puyupuyu.ts）。

import { PY, pyStart, pyStep } from "../../data/arcade/home/puyupuyu";
import { type HomeGameTest, ok, seeded } from "./kit";

const idle = { dx: 0, rotate: false, soft: true };

export const tests: HomeGameTest[] = [
	{
		name: "ぷゆぷゆは 何も しないと 3列目が うまって おわり",
		run: () => {
			const s = pyStart(seeded(1));
			const rnd = seeded(2);
			// 4色が 交互に なる ように 色を 決める（消えない）
			let n = 0;
			for (let i = 0; i < 20000 && !s.over; i++) {
				if (s.cur && s.cur.y === 1) {
					s.cur.a = (n % 4) + 1;
					s.cur.b = ((n + 1) % 4) + 1;
					s.next = [((n + 2) % 4) + 1, ((n + 3) % 4) + 1];
				}
				const ev = pyStep(s, 0.05, idle, rnd);
				if (ev.includes("lock")) n += 2;
			}
			ok(s.over && s.points === 0, `over ${s.over} pts ${s.points}`);
			ok(s.grid[0][PY.spawnX] !== 0, "spawn column is full");
		},
	},
	{
		name: "ぷゆぷゆは 4つ つながると 消えて、2連鎖で 倍率が 上がる",
		run: () => {
			const s = pyStart(seeded(3));
			const rnd = seeded(4);
			const B = PY.rows - 1;
			// 1列目に 青 3つ、2列目に 赤 3つ。2列目へ 赤（軸）と 青（子）を 降らせると
			// 赤 4つが 消えて、青が いちばん 下まで 降りて 1列目の 青と 4つ つながる
			for (let y = B - 2; y <= B; y++) {
				s.grid[y][0] = 3;
				s.grid[y][1] = 2;
			}
			s.cur = { x: 1, y: 1, r: 0, a: 2, b: 3 };
			let ev: string[] = [];
			for (let i = 0; i < 400 && s.maxChain < 2; i++)
				ev = ev.concat(pyStep(s, 0.05, idle, rnd));
			ok(s.maxChain === 2 && ev.includes("chain"), `chain ${s.maxChain}`);
			// 1連鎖目 4×10×1、2連鎖目 4×10×8
			ok(s.points === 40 + 320, `pts ${s.points}`);
			// 消えおわると 1列目・2列目は 空っぽ（次の 組は まだ 上）
			for (let i = 0; i < 9; i++) pyStep(s, 0.05, idle, rnd);
			ok(
				s.cleared === 8 &&
					[0, 1].every((x) => s.grid.every((row) => row[x] === 0)),
				`cleared ${s.cleared}`,
			);
		},
	},
];
