// 居合い 一閃（data/arcade/home/mikiri.ts）の 試験。

import {
	MK,
	type MkState,
	mkScore,
	mkStart,
	mkStep,
} from "../../data/arcade/home/mikiri";
import { type HomeGameTest, ok, seeded } from "./kit";

/** 構えるまで 進める（板の 時計を 返す）。 */
const toWait = (s: MkState, now: number, rnd: () => number): number => {
	let t = now;
	while (s.phase !== "wait" && !s.over) {
		t += 0.05;
		mkStep(s, t, [], rnd);
	}
	return t;
};

export const tests: HomeGameTest[] = [
	{
		name: "居合いは 「！」の あと 早く 押せば 勝ち・五人 ぬきで おわり",
		run: () => {
			const rnd = seeded(3);
			const s = mkStart();
			let t = 0;
			for (let r = 0; r < MK.windows.length; r++) {
				t = toWait(s, t, rnd);
				ok(s.phase === "wait", `round ${r} wait ${s.phase}`);
				t = s.goAt + 0.01;
				mkStep(s, t, [], rnd);
				ok(s.phase === "go", `go ${s.phase}`);
				const ev = mkStep(s, t + 0.02, [s.goAt + 0.2], rnd);
				ok(ev.includes("win") && s.lastMs === 200, `win ${ev} ${s.lastMs}`);
			}
			t += MK.result + 0.1;
			const ev = mkStep(s, t, [], rnd);
			ok(s.over && ev.includes("clear"), `clear ${ev}`);
			ok(mkScore(s) === 5 * 100 + 5 * 200, `score ${mkScore(s)}`);
		},
	},
	{
		name: "居合いは お手つき 1回は 見のがし・2回目と 遅れは 負け",
		run: () => {
			const rnd = seeded(8);
			const s = mkStart();
			let t = toWait(s, 0, rnd);
			let ev = mkStep(s, t + 0.1, [t + 0.05], rnd);
			ok(ev.includes("foul") && s.phase === "foul" && !s.lost, `warn ${ev}`);
			t = toWait(s, t + 0.1, rnd);
			ev = mkStep(s, t + 0.1, [t + 0.05], rnd);
			ok(ev.includes("foul") && s.lost, `foul lose ${ev}`);
			// 遅れ（名無しが 先）
			const u = mkStart();
			t = toWait(u, 0, rnd);
			ev = mkStep(u, u.goAt + 0.7, [u.goAt + 0.65], rnd);
			ok(
				ev.includes("lose") && u.why === "slow" && mkScore(u) === 0,
				`slow ${ev}`,
			);
		},
	},
];
