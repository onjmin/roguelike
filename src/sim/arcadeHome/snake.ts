// 安価スネーク の 試験（data/arcade/home/snake.ts）。

import {
	SN,
	snInterval,
	snLevel,
	snStart,
	snStep,
} from "../../data/arcade/home/snake";
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
		name: "安価スネークは 続けて 拾うと 連続、5つで 段が 上がって 神安価と 荒らしが 出る",
		run: () => {
			const s = snStart(seeded(7));
			const rnd = seeded(8);
			let ev: string[] = [];
			for (let i = 0; i < 200 && s.eaten < 5; i++) {
				const [hx, hy] = s.body[0];
				s.food = [hx + 1, hy];
				ev = ev.concat(snStep(s, 0.02, { dir: null }, rnd));
			}
			ok(s.eaten === 5 && s.combo === 5, `combo ${s.combo}`);
			ok(s.points === 10 + 20 + 30 + 40 + 50, `pts ${s.points}`);
			ok(ev.includes("level") && snLevel(s) === 2, `level ${snLevel(s)}`);
			ok(s.rocks.length === 1 && s.bonus !== null, "rock and bonus");
			// 荒らしは 頭の 前には 出ない
			const [hx, hy] = s.body[0];
			const [rx, ry] = s.rocks[0];
			ok(Math.abs(rx - hx) + Math.abs(ry - hy) >= 4, `rock ${rx},${ry}`);
			// 神安価を 拾う
			const b = s.bonus;
			if (b) {
				s.body = [[b.x - 1, b.y], ...s.body.slice(1)];
				s.dir = 1;
				s.rocks = [];
				const p0 = s.points;
				const e2 = snStep(s, snInterval(s) + 0.001, { dir: null }, rnd);
				ok(e2.includes("bonus") && s.points - p0 >= 50, `bonus ${e2}`);
			}
			// 荒らしに ぶつかると おわり
			const t = snStart(seeded(9));
			const [tx, ty] = t.body[0];
			t.rocks = [[tx + 1, ty]];
			t.food = [0, 0];
			snStep(t, SN.interval + 0.001, { dir: null }, rnd);
			ok(t.over, "hit a rock");
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
