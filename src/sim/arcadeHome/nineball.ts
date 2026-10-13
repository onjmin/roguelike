// ナインボール の 試験（data/arcade/home/nineball.ts）。

import {
	NB,
	NB_HEAD,
	type NbState,
	nbShoot,
	nbStart,
	nbStep,
} from "../../data/arcade/home/nineball";
import { type HomeGameTest, ok, seeded } from "./kit";

const idle = { rot: 0, aimAt: null, press: false } as const;

/** 球が みな とまる まで 回す。 */
const roll = (s: NbState, rnd: () => number): string[] => {
	const all: string[] = [];
	for (let i = 0; i < 60 * 30 && s.phase === "roll"; i++)
		all.push(...nbStep(s, 1 / 60, idle, rnd));
	return all;
};

/** 手玉と 番号の 球だけ 置いて、ほかは 沈めた ことに する。 */
const lay = (
	s: NbState,
	at: Record<number, readonly [number, number]>,
): void => {
	for (const b of s.balls) {
		const p = at[b.n];
		b.in = !p;
		b.vx = 0;
		b.vy = 0;
		if (p) [b.x, b.y] = p;
	}
};

export const tests: HomeGameTest[] = [
	{
		name: "ナインボールは まっすぐ 当てると 手玉が とまり 的球が 進む（とまれば 打てる）",
		run: () => {
			const rnd = seeded(1);
			const s = nbStart(rnd);
			lay(s, { 0: [60, 82], 1: [100, 82] });
			s.aim = 0;
			nbShoot(s, 0.3);
			let hitV = 0;
			for (let i = 0; i < 60 && s.phase === "roll"; i++) {
				nbStep(s, 1 / 60, idle, rnd);
				const b1 = s.balls[1];
				if (b1 && b1.vx > 0 && hitV === 0) {
					hitV = b1.vx;
					const cue = s.balls[0];
					ok(
						cue && Math.abs(cue.vx) < hitV * 0.1,
						`cue ${cue?.vx} b1 ${b1.vx}`,
					);
				}
			}
			ok(hitV > 0 && s.firstHit === 1, `hit ${hitV} first ${s.firstHit}`);
			roll(s, rnd);
			ok(
				s.phase === "aim" && s.shotsLeft === NB.shots - 1,
				`${s.phase} ${s.shotsLeft}`,
			);
		},
	},
	{
		name: "ナインボールは 1番を ポケットへ 入れると 100点、9番で ラックを とる",
		run: () => {
			const rnd = seeded(2);
			const s = nbStart(rnd);
			// 右上の すみへ むけて 1番を 押しだす
			lay(s, { 0: [150, 72], 1: [170, 52], 9: [100, 110] });
			s.aim = Math.atan2(52 - 72, 170 - 150);
			nbShoot(s, 0.5);
			roll(s, rnd);
			ok(
				s.balls[1]?.in && s.points === NB.potPts,
				`1 in ${s.balls[1]?.in} pts ${s.points}`,
			);
			// 9番を 左下の すみへ
			lay(s, { 0: [50, 100], 9: [30, 120] });
			s.aim = Math.atan2(120 - 100, 30 - 50);
			const left = s.shotsLeft - 1;
			nbShoot(s, 0.5);
			const ev = roll(s, rnd);
			ok(
				ev.includes("nine") && s.rack === 1,
				`ev ${ev.join(",")} rack ${s.rack}`,
			);
			ok(
				s.points === NB.potPts + NB.ninePts + left * NB.leftPts &&
					s.shotsLeft === NB.shots,
				`pts ${s.points} shots ${s.shotsLeft}`,
			);
			ok(
				s.balls.every((b) => !b.in),
				"new rack is set",
			);
		},
	},
	{
		name: "ナインボールは 先に 大きい 番号に 当てると ファウル（点なし・手玉は もどる・9番も もどる）",
		run: () => {
			const rnd = seeded(3);
			const s = nbStart(rnd);
			lay(s, { 0: [50, 100], 1: [100, 40], 9: [30, 120] });
			s.aim = Math.atan2(120 - 100, 30 - 50);
			nbShoot(s, 0.5);
			const ev = roll(s, rnd);
			const cue = s.balls[0];
			ok(
				ev.includes("foul") && s.points === 0 && s.rack === 0,
				`ev ${ev.join(",")}`,
			);
			ok(!s.balls[9]?.in, "9 is respotted");
			ok(
				cue && !cue.in && Math.abs(cue.y - NB_HEAD[1]) < 1,
				`cue ${cue?.x},${cue?.y}`,
			);
			// 手玉を 沈めても ファウル
			lay(s, { 0: [40, 40], 1: [150, 110] });
			s.aim = Math.atan2(NB.top - 40, NB.left - 40);
			nbShoot(s, 0.6);
			const ev2 = roll(s, rnd);
			ok(ev2.includes("foul") && !s.balls[0]?.in, `scratch ${ev2.join(",")}`);
		},
	},
];
