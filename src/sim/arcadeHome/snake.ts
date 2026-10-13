// 安価スネーク の 試験（data/arcade/home/snake.ts）。

import { SN, snStart, snStep } from "../../data/arcade/home/snake";
import { type HomeGameTest, ok, seeded } from "./kit";

export const tests: HomeGameTest[] = [
	{
		name: "安価スネークは 何も しないと 壁で おわり",
		run: () => {
			const s = snStart(seeded(1));
			s.food = [0, 0];
			for (let i = 0; i < 2000 && !s.over; i++)
				snStep(s, 0.05, { dir: null }, seeded(2));
			ok(s.over && s.body[0][0] === SN.cols - 1, `head ${s.body[0]}`);
		},
	},
	{
		name: "安価スネークは 安価を 拾うと 伸びて 点が 入り、逆向きは 取らない",
		run: () => {
			const s = snStart(seeded(3));
			const [hx, hy] = s.body[0];
			s.food = [hx + 1, hy];
			const len = s.body.length;
			snStep(s, 0, { dir: 3 }, seeded(4));
			const ev = snStep(s, SN.interval + 0.001, { dir: null }, seeded(4));
			ok(ev.includes("eat") && s.eaten === 1, `ev ${ev}`);
			ok(s.body.length === len + 1 && !s.over, `len ${s.body.length}`);
			ok(s.dir === 1, `dir ${s.dir}`);
		},
	},
	{
		name: "安価スネークは 自分に ぶつかると おわり",
		run: () => {
			const s = snStart(seeded(5));
			s.food = [0, 0];
			s.body = [
				[5, 5],
				[4, 5],
				[4, 6],
				[5, 6],
				[6, 6],
				[6, 5],
			];
			s.dir = 1;
			const ev = snStep(s, 0.001, { dir: 2 }, seeded(6));
			const ev2 = snStep(s, SN.interval, { dir: null }, seeded(6));
			ok(s.over && [...ev, ...ev2].includes("dead"), `body ${s.body[0]}`);
		},
	},
];
