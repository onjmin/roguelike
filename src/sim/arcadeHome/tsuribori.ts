// おんJ釣り堀 の 試験（data/arcade/home/tsuribori.ts）。

import {
	TB,
	type TbState,
	tbHook,
	tbScore,
	tbStart,
	tbStep,
} from "../../data/arcade/home/tsuribori";
import { type HomeGameTest, ok, seeded } from "./kit";

const idle = { press: false, reel: false } as const;
const hit = { press: true, reel: true } as const;

/** 投げて 浮きが 水に つく まで。 */
const castOut = (s: TbState, rnd: () => number): void => {
	tbStep(s, 1 / 60, hit, rnd);
	tbStep(s, 0.4, idle, rnd);
	tbStep(s, 1 / 60, hit, rnd);
	for (let i = 0; i < 120 && s.phase === "cast"; i++)
		tbStep(s, 1 / 60, idle, rnd);
};

export const tests: HomeGameTest[] = [
	{
		name: "おんJ釣り堀は 沈んでから 合わせると かかる・つつきで 合わせると 早すぎ・おそいと 逃げる",
		run: () => {
			const rnd = seeded(7);
			const s = tbStart();
			castOut(s, rnd);
			ok(s.phase === "wait", `phase ${s.phase}`);
			s.nibbles = [];
			s.biteAt = 1;
			let ev: string[] = [];
			for (let i = 0; i < 120 && s.phase === "wait"; i++)
				ev = tbStep(s, 1 / 60, idle, rnd);
			ok(ev.includes("bite") && s.phase === "bite", `bite ${ev}`);
			tbStep(s, 0.1, idle, rnd);
			ev = tbStep(s, 1 / 60, hit, rnd);
			ok(ev.includes("hook") && s.phase === "fight", `hook ${ev} ${s.phase}`);
			// つつきで 合わせる
			const t = tbStart();
			castOut(t, rnd);
			t.nibbles = [0.2];
			t.biteAt = 3;
			for (let i = 0; i < 15; i++) tbStep(t, 1 / 60, idle, rnd);
			ok(t.sink > 0 && t.sink < 0.5, `nibble sink ${t.sink}`);
			ev = tbStep(t, 1 / 60, hit, rnd);
			ok(ev.includes("early") && t.phase === "result", `early ${ev}`);
			// おそい
			const u = tbStart();
			castOut(u, rnd);
			u.nibbles = [];
			u.biteAt = 0.1;
			for (let i = 0; i < 120 && u.phase !== "result"; i++)
				ev = tbStep(u, 1 / 60, idle, rnd);
			ok(ev.includes("late"), `late ${ev}`);
		},
	},
	{
		name: "おんJ釣り堀は 魚が 走る ときに 巻きつづけると 糸が 切れる",
		run: () => {
			const rnd = seeded(8);
			const s = tbStart();
			s.kind = "namazu";
			s.cm = 60;
			s.fx = TB.farX;
			tbHook(s, rnd);
			s.calm = 0;
			let ev: string[] = [];
			for (let i = 0; i < 600 && s.phase === "fight"; i++)
				ev = tbStep(s, 1 / 60, { press: false, reel: true }, rnd);
			ok(
				ev.includes("snap") && s.catches.length === 0,
				`snap ${ev} ${s.catches.length}`,
			);
		},
	},
	{
		name: "おんJ釣り堀は 巻いては ゆるめて 岸まで よせると 釣れる・ゆるめっぱなしは 外れる・90秒で おわり",
		run: () => {
			const rnd = seeded(9);
			const s = tbStart();
			s.kind = "koi";
			s.cm = 50;
			s.fx = 150;
			tbHook(s, rnd);
			let ev: string[] = [];
			for (let i = 0; i < 60 * 40 && s.phase === "fight"; i++) {
				// はりを 見て 巻く（半分より 上なら はなす）
				ev = tbStep(
					s,
					1 / 60,
					{ press: false, reel: s.tension < 0.5 && s.run <= 0 },
					rnd,
				);
			}
			ok(ev.includes("catch") && tbScore(s) > 0, `catch ${ev} ${tbScore(s)}`);
			const t = tbStart();
			t.kind = "funa";
			t.fx = 150;
			tbHook(t, rnd);
			for (let i = 0; i < 60 * 10 && t.phase === "fight"; i++)
				ev = tbStep(t, 1 / 60, idle, rnd);
			ok(ev.includes("escape"), `escape ${ev}`);
			for (let i = 0; i < 60 * 100 && !t.over; i++)
				tbStep(t, 1 / 60, idle, rnd);
			ok(t.over && t.t >= TB.time, `over ${t.t}`);
		},
	},
];
