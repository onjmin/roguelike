// ぷゆゆキャッチャー の 試験（data/arcade/home/crane.ts）。

import {
	CR,
	CR_PRIZES,
	type CrInput,
	type CrState,
	crScore,
	crStart,
	crStep,
} from "../../data/arcade/home/crane";
import { type HomeGameTest, ok, seeded } from "./kit";

const DT = 1 / 60;

/** いちばん 上の 景品の 真上で 止める 手（回ごとに ねらいを 決める）。 */
const aim = (s: CrState, off = 0): (() => CrInput) => {
	let tx = 0;
	let tz = 0;
	return () => {
		if (s.phase === "right" && s.pt === 0) {
			const top = s.items
				.filter((it) => !it.held)
				.reduce((a, b) => (b.alt > a.alt ? b : a));
			tx = top.x + off;
			tz = top.z;
		}
		return {
			right: s.phase === "right" && s.x < tx,
			up: s.phase === "up" && s.z < tz,
			drop: false,
		};
	};
};

const play = (s: CrState, inp: () => CrInput, rnd: () => number): void => {
	for (let i = 0; i < 60 * 400 && !s.over; i++) crStep(s, DT, inp(), rnd);
};

export const tests: HomeGameTest[] = [
	{
		name: "ぷゆゆキャッチャー の 山は 箱の 中・とりだし口の 外に 積まれ、金の ぷゆゆが 1つ 入って いる",
		run: () => {
			const ids = CR_PRIZES.map((p) => p.id);
			ok(new Set(ids).size === ids.length, "prize ids unique");
			ok(
				CR_PRIZES.some((p) => p.rare) && CR_PRIZES.some((p) => !p.rare),
				"rare and common",
			);
			for (let seed = 1; seed <= 30; seed++) {
				const s = crStart(seeded(seed));
				ok(s.items.filter((it) => it.id === "puyuGold").length === 1, "gold");
				for (const it of s.items) {
					ok(it.x > CR.chuteX && it.x <= CR.xMax, `x ${it.x}`);
					ok(it.z > 0 && it.z < 1, `z ${it.z}`);
					ok(it.alt >= 0 && it.alt + CR.h * 1.5 < CR.ceil - 6, `alt ${it.alt}`);
				}
				ok(
					s.items.some((it) => it.alt > 0),
					"pile stacks",
				);
			}
		},
	},
	{
		name: "ぷゆゆキャッチャー で 真上を ねらうと ほどほどに とれ、5回で おわる。何も ない ところでは とれない",
		run: () => {
			let won = 0;
			for (let seed = 1; seed <= 60; seed++) {
				const rnd = seeded(seed * 7);
				const s = crStart(rnd);
				play(s, aim(s), rnd);
				ok(s.over && s.plays === 0, `seed ${seed} ends after 5`);
				ok(crScore(s) === s.won.length && s.won.length <= CR.plays, "score");
				won += s.won.length;
			}
			const rate = won / (60 * CR.plays);
			ok(rate > 0.25 && rate < 0.75, `aimed rate ${rate}`);
			// 景品を 1つだけ 奥の 右に 置いて、手前の 左で おろす
			const rnd = seeded(3);
			const s = crStart(rnd);
			s.items = [{ id: "puyu", x: 180, z: 0.9, alt: 0, held: false }];
			const short = (): CrInput => ({
				right: s.phase === "right" && s.x < 100,
				up: s.phase === "up" && s.z < 0.2,
				drop: false,
			});
			play(s, short, rnd);
			ok(s.over && s.won.length === 0, "nothing to grab");
		},
	},
	{
		name: "ぷゆゆキャッチャー の アームは 離すと 止まり、押して いない あいだは 動かない",
		run: () => {
			const rnd = seeded(11);
			const s = crStart(rnd);
			const x0 = s.x;
			for (let i = 0; i < 30; i++)
				crStep(s, DT, { right: true, up: false, drop: false }, rnd);
			const x1 = s.x;
			ok(x1 > x0 + 10, `moved right ${x0} → ${x1}`);
			crStep(s, DT, { right: false, up: false, drop: false }, rnd);
			ok(s.phase === "up", "release → up");
			for (let i = 0; i < 30; i++)
				crStep(s, DT, { right: true, up: false, drop: false }, rnd);
			ok(s.x === x1 && s.z === CR.homeZ, "→ again does nothing; waits for ↑");
			for (let i = 0; i < 20; i++)
				crStep(s, DT, { right: false, up: true, drop: false }, rnd);
			ok(s.z > CR.homeZ + 0.1, "moved back");
			crStep(s, DT, { right: false, up: false, drop: false }, rnd);
			ok(s.phase === "open", "release ↑ → drop");
		},
	},
];
