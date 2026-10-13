// ピンポン（data/arcade/home/pong.ts）の 試験。

import {
	PONG,
	pongScore,
	pongStart,
	pongStep,
} from "../../data/arcade/home/pong";
import { AW } from "../../data/arcade/logic";
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
	{
		name: "ピンポンは 動きながら 打つと スマッシュ（ふつうより 速い）",
		run: () => {
			const hitWith = (dy: -1 | 0 | 1): [string[], number] => {
				const rnd = seeded(3);
				const s = pongStart(rnd);
				s.wait = 0;
				s.me = 60;
				s.bx = PONG.meX + PONG.padW + 4;
				s.by = s.me + PONG.padH / 2;
				s.vx = -PONG.speed0;
				s.vy = 0;
				let ev: string[] = [];
				for (let i = 0; i < 10 && !ev.some((e) => e !== "wall"); i++)
					ev = pongStep(s, 0.02, { dy, target: null }, rnd);
				return [ev, s.speed];
			};
			const [e0, v0] = hitWith(0);
			const [e1, v1] = hitWith(1);
			ok(e0.includes("hit") && e1.includes("smash"), `${e0} ${e1}`);
			ok(v1 > v0 + 30, `smash ${v1} > ${v0}`);
		},
	},
	{
		name: "ピンポンは 点を とるほど 名無しが 強く なる（打ち返しが ふえる）",
		run: () => {
			// 名無しの 前へ まっすぐ 来る 球を 何球 返すか（キリコの 点 0 と 6）
			const back = (mePts: number): number => {
				const rnd = seeded(21);
				let n = 0;
				for (let k = 0; k < 200; k++) {
					const s = pongStart(rnd);
					s.mePts = mePts;
					s.wait = 0;
					s.bx = AW / 2;
					s.by = 40 + rnd() * 80;
					s.speed = 160;
					const a = (rnd() - 0.5) * 1.6;
					s.vx = Math.cos(a) * 160;
					s.vy = Math.sin(a) * 160;
					for (let i = 0; i < 200 && s.vx > 0 && s.bx < AW; i++)
						pongStep(s, 0.02, still, rnd);
					if (s.vx < 0) n++;
				}
				return n;
			};
			const a = back(0);
			const b = back(6);
			ok(b > a + 20, `本気の 名無しが 返す 数 ${a} → ${b}`);
		},
	},
];
