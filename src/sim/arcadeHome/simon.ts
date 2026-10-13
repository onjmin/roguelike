// 「音おぼえ」（data/arcade/home/simon.ts）の 試験。

import {
	type SmPad,
	type SmState,
	smScore,
	smStart,
	smStep,
} from "../../data/arcade/home/simon";
import { type HomeGameTest, ok, seeded } from "./kit";

/** 見せ終わる まで 回す（光った 順を 返す）。 */
const watch = (s: SmState, rnd: () => number): SmPad[] => {
	const seen: SmPad[] = [];
	for (let i = 0; i < 2000 && s.phase === "show"; i++)
		for (const e of smStep(s, 0.02, null, rnd))
			if (e.k === "lit") seen.push(e.pad);
	return seen;
};

export const tests: HomeGameTest[] = [
	{
		name: "音おぼえは 光った 順に 押すと 1つ ふえ、4回めは 逆から、まちがえると 1度は もう 一度 見せて 2度めで おわり",
		run: () => {
			const rnd = seeded(4);
			const s = smStart(rnd);
			let pts = 0;
			for (let round = 1; round <= 5; round++) {
				const seen = watch(s, rnd);
				ok(seen.length === round, `round ${round} saw ${seen}`);
				ok(s.phase === "input", s.phase);
				ok(s.rev === (round === 4), `rev ${round}`);
				const order = s.rev ? [...seen].reverse() : seen;
				for (const p of order) smStep(s, 0.02, p, rnd);
				ok(s.rounds === round, `rounds ${s.rounds}`);
				pts += round * 100 * (round === 4 ? 2 : 1);
			}
			ok(smScore(s) === pts, `score ${smScore(s)} ${pts}`);
			// 1度めの まちがいは おかわり（同じ 並びを もう 一度）
			const seen = watch(s, rnd);
			const wrong = ((seen[0] + 1) % 4) as SmPad;
			const ev = smStep(s, 0.02, wrong, rnd);
			ok(
				ev.some((e) => e.k === "wrong" && e.pad === seen[0] && e.retry) &&
					s.want === seen[0],
				"wrong shows the pad",
			);
			for (let i = 0; i < 200 && s.phase === "fail"; i++)
				smStep(s, 0.02, null, rnd);
			ok(!s.over && s.phase === "show" && s.lives === 0, "retry");
			const again = watch(s, rnd);
			ok(again.join() === seen.join(), `same seq ${again} ${seen}`);
			smStep(s, 0.02, ((again[0] + 1) % 4) as SmPad, rnd);
			ok(!s.over, "still flashing");
			for (let i = 0; i < 200 && !s.over; i++) smStep(s, 0.02, null, rnd);
			ok(s.over && smScore(s) === pts, "over");
		},
	},
];
