// 道路わたり の 試験（data/arcade/home/crossing.ts）。

import { CR, crStart, crStep } from "../../data/arcade/home/crossing";
import { type HomeGameTest, ok, seeded } from "./kit";

const still = { dx: 0, dy: 0 };
const up = { dx: 0, dy: -1 };

export const tests: HomeGameTest[] = [
	{
		name: "道路わたりは 何も しないと 時間ぎれで 残機が へって おわり",
		run: () => {
			const s = crStart(seeded(1));
			const rnd = seeded(2);
			let ev: string[] = [];
			for (let i = 0; i < 10000 && !s.over; i++)
				ev = ev.concat(crStep(s, 0.05, still, rnd));
			ok(s.over && s.lives === 0, `lives ${s.lives}`);
			ok(
				ev.filter((e) => e === "timeout").length === CR.lives,
				`ev ${ev.length}`,
			);
		},
	},
	{
		name: "道路わたりは 車に ぶつかると アウト、丸太が なければ 川に 入る",
		run: () => {
			const s = crStart(seeded(3));
			const rnd = seeded(4);
			const road = CR.rows - 2;
			s.lanes[road].speed = 0;
			s.lanes[road].items = [{ x: s.px, w: 2, tone: 0 }];
			const ev = crStep(s, 0.01, up, rnd);
			ok(ev.includes("crash") && s.lives === CR.lives - 1, `ev ${ev}`);
			const t = crStart(seeded(5));
			t.py = CR.layout.indexOf("s");
			const river = t.py - 1;
			t.lanes[river].items = [];
			const ev2 = crStep(t, 0.01, up, rnd);
			ok(ev2.includes("splash"), `ev ${ev2}`);
		},
	},
	{
		name: "道路わたりは 車と 丸太を どかすと 上まで わたって 点が 入る",
		run: () => {
			const s = crStart(seeded(6));
			const rnd = seeded(7);
			for (const l of s.lanes) {
				l.speed = 0;
				l.items = l.kind === "w" ? [{ x: -1, w: CR.cols + 2, tone: 0 }] : [];
			}
			let ev: string[] = [];
			for (let i = 0; i < CR.rows && !ev.includes("goal"); i++)
				ev = ev.concat(crStep(s, 0.05, up, rnd));
			ok(
				ev.includes("goal") && s.lap === 1 && s.points > 100,
				`pts ${s.points}`,
			);
			ok(s.py === CR.rows - 1 && s.lives === CR.lives, `back ${s.py}`);
		},
	},
];
