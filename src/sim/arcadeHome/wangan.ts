// 湾岸ナイトラン の 試験（data/arcade/home/wangan.ts）。

import {
	WN,
	WN_RIVALS,
	WN_TRACK,
	type WnInput,
	type WnState,
	wnScore,
	wnSeg,
	wnStart,
	wnStep,
} from "../../data/arcade/home/wangan";
import { type HomeGameTest, ok, seeded } from "./kit";

const DT = 1 / 60;

/** よける 運転手：前が つまって いれば すいた 車線へ、曲がりは 内へ 切る。 */
const bot = (s: WnState): WnInput => {
	const ahead = s.cars.filter(
		(c) => c.z > s.z && c.z - s.z < 70 && Math.abs(c.x - s.x) < 0.4,
	);
	let goal = s.rival && s.rival.z - s.z < 50 ? s.rival.x : s.x;
	if (ahead.length) {
		const free = WN.lanes.filter(
			(lx) =>
				!s.cars.some(
					(c) => c.z > s.z - 6 && c.z - s.z < 80 && Math.abs(c.x - lx) < 0.4,
				),
		);
		goal = free.length
			? free.reduce((a, b) => (Math.abs(b - s.x) < Math.abs(a - s.x) ? b : a))
			: s.x;
	} else if (s.rival && s.rival.z - s.z < 12 && s.rival.z > s.z) {
		// 真うしろから 横へ 出て ぬく
		goal = s.rival.x > 0 ? s.rival.x - 0.6 : s.rival.x + 0.6;
	}
	const curve = WN_TRACK.curve[wnSeg(s.z)] ?? 0;
	const steer = Math.max(
		-1,
		Math.min(1, (goal - s.x) * 4 + curve * (s.v / WN.vmax) ** 2 * 0.25),
	);
	return { gas: true, brake: false, steer };
};

const run = (
	s: WnState,
	sec: number,
	inp: (s: WnState) => WnInput,
	rnd: () => number,
): void => {
	for (let i = 0; i < sec * 60 && !s.over; i++) wnStep(s, DT, inp(s), rnd);
};

export const tests: HomeGameTest[] = [
	{
		name: "湾岸ナイトラン の 道は 輪で つながり、左右の 曲がり・トンネルが ある。全開で 300km/h 近く 出て、壁に こすると 速さが へる",
		run: () => {
			const T = WN_TRACK;
			ok(
				Math.abs((T.y[0] ?? 0) - (T.y[T.n - 1] ?? 0)) < 0.5,
				"loop height joins",
			);
			ok(
				T.curve.some((c) => c > 1) && T.curve.some((c) => c < -1),
				"both curves",
			);
			ok(
				T.tunnel.some((t) => t === 1),
				"has tunnel",
			);
			ok(wnSeg(-1) === T.n - 1 && wnSeg(T.n * WN.seg) === 0, "seg wraps");
			const rnd = seeded(3);
			const s = wnStart(rnd);
			const noCars = (st: WnState): WnInput => {
				st.cars = [];
				st.rival = null;
				return { gas: true, brake: false, steer: -st.x * 3 };
			};
			run(s, 20, noCars, rnd);
			ok(s.v > WN.vmax * 0.93, `top speed ${s.v}`);
			const v0 = s.v;
			run(
				s,
				1,
				(st) => {
					st.cars = [];
					return { gas: true, brake: false, steer: 1 };
				},
				rnd,
			);
			ok(s.x === WN.wall, "pinned to wall");
			ok(s.v < v0 - 10, `scrape slows ${v0} → ${s.v}`);
			run(
				s,
				2,
				(st) => {
					st.cars = [];
					return { gas: false, brake: true, steer: 0 };
				},
				rnd,
			);
			ok(s.v < 20, `brake ${s.v}`);
		},
	},
	{
		name: "湾岸ナイトラン で 前の 車の 真うしろに つくと スリップストリームで 上の 速さが のびる",
		run: () => {
			const rnd = seeded(5);
			const s = wnStart(rnd);
			s.v = 80;
			s.rival = null;
			let ev: string[] = [];
			for (let i = 0; i < 90; i++) {
				s.cars = [
					{ z: s.z + 20, x: s.x, v: s.v, kind: 0, ink: 0, passed: false },
				];
				ev = ev.concat(
					wnStep(s, DT, { gas: true, brake: false, steer: 0 }, rnd),
				);
			}
			ok(ev.includes("slip") && s.slip >= 0.5, `slip ${s.slip}`);
			ok(s.v > WN.vmax, `boost ${s.v}`);
		},
	},
	{
		name: "湾岸ナイトラン：よける 運転で 1台目は ぬける、何も しないと 時間ぎれ",
		run: () => {
			let beat1 = 0;
			let clears = 0;
			for (let seed = 1; seed <= 8; seed++) {
				const rnd = seeded(seed * 17);
				const s = wnStart(rnd);
				run(s, 400, bot, rnd);
				ok(s.over, `seed ${seed} ends`);
				if (s.ri >= 1) beat1++;
				if (s.clear) clears++;
				ok(wnScore(s) >= Math.floor(s.z / 10), "score has distance");
			}
			ok(beat1 >= 6, `beat first rival ${beat1}/8`);
			ok(clears < 8 || WN_RIVALS.length > 0, `clears ${clears}`);
			const rnd = seeded(9);
			const idle = wnStart(rnd);
			run(idle, 60, () => ({ gas: false, brake: false, steer: 0 }), rnd);
			ok(idle.over && !idle.clear && idle.ri === 0, "idle times out");
		},
	},
];
