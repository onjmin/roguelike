// 金魚すくい（data/arcade/home/kingyo.ts）の 試験。

import { KG, kgScore, kgStart, kgStep } from "../../data/arcade/home/kingyo";
import { type HomeGameTest, ok, seeded } from "./kit";

const idle = { dx: 0, dy: 0, target: null, scoop: false } as const;

export const tests: HomeGameTest[] = [
	{
		name: "金魚すくいは ポイの 下の 金魚を すくえる・紙が へる",
		run: () => {
			const rnd = seeded(5);
			const s = kgStart(rnd);
			const f = s.fish[0];
			f.kind = "red";
			s.fish = [f];
			f.x = s.px;
			f.y = s.py;
			f.vx = 0;
			f.vy = 0;
			f.turn = 99;
			let ev: string[] = kgStep(s, 0.01, { ...idle, scoop: true }, rnd);
			ok(ev.includes("dip"), `dip ${ev}`);
			for (let i = 0; i < 40 && s.caught === 0; i++)
				ev = kgStep(s, 0.01, idle, rnd);
			ok(kgScore(s) === 1 && ev.includes("catch"), `caught ${s.caught} ${ev}`);
			ok(s.paper < KG.paper && !s.over, `paper ${s.paper}`);
		},
	},
	{
		name: "金魚すくいは 紙が もたないと 破れて おわり",
		run: () => {
			const rnd = seeded(9);
			const s = kgStart(rnd);
			s.fish = [];
			s.paper = KG.dipCost;
			kgStep(s, 0.01, { ...idle, scoop: true }, rnd);
			let ev: string[] = [];
			for (let i = 0; i < 60 && !s.over; i++) ev = kgStep(s, 0.01, idle, rnd);
			ok(s.over && s.torn && ev.includes("torn"), `torn ${s.paper} ${ev}`);
			ok(kgScore(s) === 0, `score ${kgScore(s)}`);
		},
	},
];
