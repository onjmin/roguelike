// 道路わたり の 試験（data/arcade/home/crossing.ts）。

import {
	CR,
	type CrState,
	crSink,
	crStart,
	crStep,
} from "../../data/arcade/home/crossing";
import { type HomeGameTest, ok, seeded } from "./kit";

const still = { dx: 0, dy: 0 };
const up = { dx: 0, dy: -1 };

/** 車を どけて、川は 端から 端までの 丸太（沈まない）に する。 */
const clearRoad = (s: CrState): void => {
	for (const l of s.lanes) {
		l.speed = 0;
		if (l.type === "sink") l.type = "log";
		l.items = l.kind === "w" ? [{ x: -1, w: CR.cols + 2, tone: 0 }] : [];
	}
	s.bonus = null;
};

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
		name: "道路わたりは 空いた 枠に 入ると 点、枠の ない ところには 入れない",
		run: () => {
			const s = crStart(seeded(6));
			const rnd = seeded(7);
			clearRoad(s);
			let ev: string[] = [];
			for (let i = 0; i < CR.rows && !ev.includes("goal"); i++)
				ev = ev.concat(crStep(s, 0.05, up, rnd));
			const slot = CR.slots.indexOf(Math.floor(CR.cols / 2));
			ok(ev.includes("goal") && s.filled[slot], `filled ${s.filled}`);
			ok(s.points > 100 && s.lap === 0, `pts ${s.points}`);
			ok(s.py === CR.rows - 1 && s.lives === CR.lives, `back ${s.py}`);
			// 同じ 枠は もう うまって いる
			clearRoad(s);
			ev = [];
			for (let i = 0; i < CR.rows; i++)
				ev = ev.concat(crStep(s, 0.05, up, rnd));
			ok(ev.includes("blocked") && s.py === 1, `blocked ${s.py}`);
		},
	},
	{
		name: "道路わたりは 5つの 枠を うめると 周が 進み、枠は 空に もどる",
		run: () => {
			const s = crStart(seeded(8));
			const rnd = seeded(9);
			let full = false;
			for (const col of CR.slots) {
				clearRoad(s);
				s.px = col;
				s.py = 1;
				full = crStep(s, 0.05, up, rnd).includes("full");
			}
			ok(full && s.lap === 1, `lap ${s.lap}`);
			ok(
				s.filled.every((f) => !f),
				"slots reset",
			);
			ok(
				s.lanes.some((l) => l.type === "racer"),
				"a racer lane from lap 2",
			);
		},
	},
	{
		name: "道路わたりは 沈んだ 丸太の 上だと 川に 入り、安価を 拾うと 100点",
		run: () => {
			const s = crStart(seeded(10));
			const rnd = seeded(11);
			const sink = s.lanes.find((l) => l.type === "sink");
			ok(sink, "a sinking lane");
			if (!sink) return;
			sink.speed = 0;
			sink.items = [{ x: -1, w: CR.cols + 2, tone: 0 }];
			// 沈む ところまで 時を すすめる
			for (let i = 0; i < 400 && crSink(s, sink) !== 2; i++) s.t += 0.01;
			s.px = 5;
			s.py = sink.y + 1;
			s.lanes[s.py].items = [{ x: -1, w: CR.cols + 2, tone: 0 }];
			s.lanes[s.py].speed = 0;
			if (s.lanes[s.py].type === "sink") s.lanes[s.py].type = "log";
			s.lapT = 0;
			const ev = crStep(s, 0.001, up, rnd);
			ok(ev.includes("splash"), `ev ${ev}`);
			const t = crStart(seeded(12));
			clearRoad(t);
			t.bonus = { x: t.px, y: t.py - 1 };
			t.lanes[t.py - 1].items = [];
			const e2 = crStep(t, 0.01, up, rnd);
			ok(e2.includes("bonus") && t.points >= 100, `bonus ${e2}`);
		},
	},
];
