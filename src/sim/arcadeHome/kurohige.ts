// イッチ危機一髪（data/arcade/home/kurohige.ts）の 試験。
import {
	KH,
	khCpu,
	khScore,
	khStab,
	khStart,
} from "../../data/arcade/home/kurohige";
import { type HomeGameTest, ok, seeded } from "./kit";

export const tests: HomeGameTest[] = [
	{
		name: "イッチ危機一髪は 当たりに 刺した ほうが 負け",
		run: () => {
			const s = khStart(seeded(1));
			const free = [...Array(KH.slots).keys()].filter((i) => i !== s.trigger);
			ok(khStab(s, free[0]) === "safe" && s.turn === 2, "キリコ セーフ");
			ok(khStab(s, free[0]) === "bad", "同じ 穴には 刺せない");
			ok(khStab(s, s.trigger) === "pop" && s.loser === 2, "名無しが 飛ばす");
			ok(khScore(s) === 600, `名無しが 飛ばすと 500＋100×1（${khScore(s)}）`);
			ok(khStab(s, free[1]) === "bad", "おわったら 刺せない");
		},
	},
	{
		name: "イッチ危機一髪は かならず どこかで 飛ぶ",
		run: () => {
			const rnd = seeded(5);
			for (let n = 0; n < 50; n++) {
				const s = khStart(rnd);
				for (let k = 0; k < KH.slots && !s.loser; k++)
					ok(khStab(s, khCpu(s, rnd)) !== "bad", "空いた 穴を 選ぶ");
				ok(s.loser !== 0, "12本 までに 飛ぶ");
				if (s.loser === 1) ok(khScore(s) === 100 * s.safe, "負けの 点");
			}
		},
	},
];
