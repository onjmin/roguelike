// キリコさがし（data/arcade/home/mojisagashi.ts）の 試験。

import {
	MS,
	MS_WORDS,
	type MsState,
	msGrid,
	msLine,
	msPick,
	msScore,
	msStart,
	msStep,
	msWord,
} from "../../data/arcade/home/mojisagashi";
import { type HomeGameTest, ok, seeded } from "./kit";

/** 盤から 名前の 線を さがす（はじめと おわりの マス）。 */
const solve = (s: MsState): [number, number] | null => {
	const word = msWord(s);
	const n = MS.w * MS.h;
	for (let a = 0; a < n; a++)
		for (let b = 0; b < n; b++) {
			if (a === b) continue;
			const line = msLine(a, b);
			if (
				line &&
				line.length === word.length &&
				line.every((c, k) => s.cells[c] === word[k])
			)
				return [a, b];
		}
	return null;
};

export const tests: HomeGameTest[] = [
	{
		name: "キリコさがしの 盤には どの 名前も 必ず かくれて いる",
		run: () => {
			const rnd = seeded(11);
			const s = msStart(rnd);
			for (let w = 0; w < MS_WORDS.length; w++)
				for (let k = 0; k < 20; k++) {
					s.word = w;
					s.cells = msGrid(MS_WORDS[w] ?? [], rnd);
					ok(
						s.cells.every((c) => c !== ""),
						`filled ${w}`,
					);
					ok(solve(s), `hidden ${MS_WORDS[w]?.join("")}`);
				}
		},
	},
	{
		name: "キリコさがしは はじめと おわりで 見つけると 点・次の 盤",
		run: () => {
			const rnd = seeded(4);
			const s = msStart(rnd);
			const ans = solve(s);
			ok(ans, "solvable");
			if (!ans) return;
			const [a, b] = ans;
			const len = msWord(s).length;
			// まっすぐで ない 線は 「ちがう」
			let wrong = 0;
			while (msLine(a, wrong)) wrong++;
			msPick(s, a % MS.w, Math.floor(a / MS.w));
			const miss = msPick(s, wrong % MS.w, Math.floor(wrong / MS.w));
			ok(miss.includes("miss") && s.anchor === -1, `miss ${miss}`);
			msPick(s, a % MS.w, Math.floor(a / MS.w));
			const ev = msPick(s, b % MS.w, Math.floor(b / MS.w));
			ok(
				ev.includes("found") && msScore(s) === len * MS.perChar,
				`found ${ev}`,
			);
			const before = s.cells.join("");
			msStep(s, MS.flash + 0.05, rnd);
			ok(s.flash === 0 && s.cells.join("") !== before, "next grid");
			msStep(s, MS.time, rnd);
			ok(s.over, "time up");
		},
	},
];
