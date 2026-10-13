// ピンポン（data/arcade/home/pong.ts）の 試験。

import {
	PONG,
	pongScore,
	pongStart,
	pongStep,
} from "../../data/arcade/home/pong";
import { type HomeGameTest, ok, seeded } from "./kit";

const still = { dy: 0, target: null } as const;

export const tests: HomeGameTest[] = [
	{
		name: "ピンポンは ラケットで 打ち返すと 速く なり、端に 当てると 角度が つく",
		run: () => {
			const rnd = seeded(3);
			const s = pongStart(rnd);
			s.wait = 0;
			s.bx = PONG.meX + PONG.padW + 6;
			s.by = s.me + PONG.padH - 2;
			s.vx = -PONG.speed0;
			s.vy = 0;
			const sp = s.speed;
			let ev: string[] = [];
			for (let i = 0; i < 10 && !ev.includes("hit"); i++)
				ev = pongStep(s, 0.02, still, rnd);
			ok(ev.includes("hit"), `hit ${ev}`);
			ok(s.vx > 0 && s.speed > sp, `back ${s.vx} ${s.speed}`);
			ok(s.vy > 20, `angle ${s.vy}`);
		},
	},
	{
		name: "ピンポンは 動かないと 名無しが 7点 とって 負け（スコアは 自分の 点×100）",
		run: () => {
			const rnd = seeded(11);
			const s = pongStart(rnd);
			// ラケットを 上の 隅に おいて 動かさない
			s.me = -100;
			let ev: string[] = [];
			for (let i = 0; i < 20000 && !s.over; i++) {
				s.me = -100;
				ev = pongStep(s, 0.02, still, rnd);
			}
			ok(s.over && s.cpuPts === PONG.goal, `cpu ${s.mePts}-${s.cpuPts}`);
			ok(ev.includes("lose"), `lose ${ev}`);
			ok(pongScore(s) === s.mePts * 100, `score ${pongScore(s)}`);
			s.mePts = PONG.goal;
			s.cpuPts = 2;
			ok(pongScore(s) === 1000 + 5 * 100, `win ${pongScore(s)}`);
		},
	},
];
