// 保守ピンボール の 試験（data/arcade/home/pinball.ts）。

import { PB, pbStart, pbStep } from "../../data/arcade/home/pinball";
import { type HomeGameTest, ok, seeded } from "./kit";

const none = { left: false, right: false };

export const tests: HomeGameTest[] = [
	{
		name: "保守ピンボールは 何も しないと 3球 のがして おわり（台から 出ない）",
		run: () => {
			const s = pbStart();
			const rnd = seeded(1);
			let out = false;
			for (let i = 0; i < 60 * 600 && !s.over; i++) {
				pbStep(s, 1 / 60, none, rnd);
				if (
					s.wait <= 0 &&
					(s.x < PB.left - 1 || s.x > PB.right + 1 || s.y < 12)
				)
					out = true;
			}
			ok(s.over && s.balls === 0, `over ${s.over} balls ${s.balls}`);
			ok(!out, "the ball left the table");
		},
	},
	{
		name: "保守ピンボールは フリッパーで 球を 上へ はじく",
		run: () => {
			const s = pbStart();
			const rnd = seeded(2);
			s.wait = 0;
			// 左の フリッパーの 上に 球を 置いて 少し 転がす
			s.x = PB.pivotL[0] + 10;
			s.y = PB.pivotL[1] - 2;
			s.vx = 0;
			s.vy = 0;
			for (let i = 0; i < 6; i++) pbStep(s, 1 / 60, none, rnd);
			for (let i = 0; i < 8; i++)
				pbStep(s, 1 / 60, { left: true, right: false }, rnd);
			ok(s.vy < -150 && s.y < PB.pivotL[1] - 6, `vy ${s.vy} y ${s.y}`);
		},
	},
	{
		name: "保守ピンボールは 「保守」に 当てると 100点で はじかれる",
		run: () => {
			const s = pbStart();
			const rnd = seeded(3);
			s.wait = 0;
			s.x = PB.bumpers[0].x;
			s.y = PB.bumpers[0].y + 20;
			s.vx = 0;
			s.vy = -200;
			for (let i = 0; i < 12; i++) pbStep(s, 1 / 60, none, rnd);
			ok(
				s.points === PB.bumpers[0].score && s.vy > 0,
				`pts ${s.points} vy ${s.vy}`,
			);
		},
	},
];
