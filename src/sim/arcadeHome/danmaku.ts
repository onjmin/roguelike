// 弾幕スレ の 試験（data/arcade/home/danmaku.ts）。

import { DM, dmFoe, dmStart, dmStep } from "../../data/arcade/home/danmaku";
import { type HomeGameTest, ok, seeded } from "./kit";

const still = { dx: 0, dy: 0 };

export const tests: HomeGameTest[] = [
	{
		name: "弾幕スレは じっと して いると ねらわれて 残機が なくなる",
		run: () => {
			const s = dmStart();
			const rnd = seeded(1);
			for (let i = 0; i < 60 * 200 && !s.over; i++)
				dmStep(s, 1 / 60, still, rnd);
			ok(
				s.over && !s.clear && s.lives === 0,
				`over ${s.over} lives ${s.lives}`,
			);
		},
	},
	{
		name: "弾幕スレは 真上の 名無しを 撃って たおす",
		run: () => {
			const s = dmStart();
			const rnd = seeded(2);
			s.spawnT = 999;
			const f = dmFoe("nana", s.x, DM.top + 30, DM.top + 30);
			f.fireT = 999;
			s.foes = [f];
			for (let i = 0; i < 60; i++) dmStep(s, 1 / 60, still, rnd);
			ok(s.kills === 1 && s.foes.length === 0, `kills ${s.kills}`);
			ok(s.points >= DM.kill.nana, `pts ${s.points}`);
		},
	},
	{
		name: "弾幕スレは まんなかの 点だけ 当たる（そばは かすり）",
		run: () => {
			const s = dmStart();
			const rnd = seeded(3);
			s.spawnT = 999;
			const b = { vx: 0, vy: 0, c: 0, grazed: false };
			s.bullets = [{ ...b, x: s.x + 4, y: s.y }];
			dmStep(s, 1 / 60, still, rnd);
			ok(
				s.lives === DM.lives && s.grazes === 1,
				`lives ${s.lives} grazes ${s.grazes}`,
			);
			s.bullets = [{ ...b, x: s.x, y: s.y + 1 }];
			dmStep(s, 1 / 60, still, rnd);
			ok(s.lives === DM.lives - 1 && s.invuln > 0, `lives ${s.lives}`);
			ok(s.bullets.length === 0, "bullets are cleared");
		},
	},
];
