// ぱたぱたぷゆゆ の 試験（data/arcade/home/patapata.ts）。

import {
	PP,
	ppMedal,
	ppScore,
	ppStart,
	ppStep,
} from "../../data/arcade/home/patapata";
import { type HomeGameTest, ok, seeded } from "./kit";

export const tests: HomeGameTest[] = [
	{
		name: "ぱたぱたぷゆゆは 押すまで 待ち、はばたかないと 地面で おわり",
		run: () => {
			const s = ppStart();
			const rnd = seeded(1);
			for (let i = 0; i < 300; i++) ppStep(s, 1 / 60, { flap: false }, rnd);
			ok(!s.started && !s.over && s.pillars.length === 0, "waiting");
			ppStep(s, 1 / 60, { flap: true }, rnd);
			ok(s.started && s.vy < 0, `vy ${s.vy}`);
			for (let i = 0; i < 600 && !s.over; i++)
				ppStep(s, 1 / 60, { flap: false }, rnd);
			ok(s.over && ppScore(s) === 0 && ppMedal(0) === -1, "ground");
		},
	},
	{
		name: "ぱたぱたぷゆゆは すきまを 追えば 柱を くぐりつづけ、すきまが せまく なる",
		run: () => {
			const s = ppStart();
			const rnd = seeded(5);
			ppStep(s, 1 / 60, { flap: true }, rnd);
			for (let i = 0; i < 60 * 90 && !s.over; i++) {
				const next = s.pillars.find((p) => p.x + PP.pillarW > PP.x - PP.r);
				const want = next ? next.gapY + 6 : 80;
				ppStep(s, 1 / 60, { flap: s.y > want && s.vy > 0 }, rnd);
			}
			ok(s.passed >= 30, `passed ${s.passed} over ${s.over}`);
			ok(
				s.pillars.every((p) => p.gap >= PP.gapMin && p.gap < PP.gap),
				"gap",
			);
			ok(ppMedal(ppScore(s)) >= 1, `medal ${ppMedal(ppScore(s))}`);
			ok(
				ppMedal(PP.medals[0]) === 0 && ppMedal(PP.medals[3] + 5) === 3,
				"medals",
			);
		},
	},
	{
		name: "ぱたぱたぷゆゆは 柱に ふれると おわり、玉を 取ると 1点",
		run: () => {
			const rnd = seeded(2);
			const s = ppStart();
			ppStep(s, 1 / 60, { flap: true }, rnd);
			s.pillars = [
				{
					id: 0,
					x: PP.x - PP.pillarW / 2,
					gapY: s.y,
					gap: 40,
					passed: false,
					coin: { y: Math.round(s.y) },
				},
			];
			s.vy = 0;
			ppStep(s, 1 / 60, { flap: false }, rnd);
			ok(s.coins === 1 && ppScore(s) === 1, `coins ${s.coins}`);
			s.pillars = [
				{ id: 1, x: PP.x - 4, gapY: 30, gap: 30, passed: false, coin: null },
			];
			const ev = ppStep(s, 1 / 60, { flap: false }, rnd);
			ok(ev.includes("hit") && !s.over, `hit ${ev}`);
			for (let i = 0; i < 120 && !s.over; i++)
				ppStep(s, 1 / 60, { flap: true }, rnd);
			ok(s.over, "over");
		},
	},
];
