// 五目並べ（data/arcade/home/gomoku.ts）の 試験。
import {
	GM,
	gmCpu,
	gmPlace,
	gmScore,
	gmStart,
} from "../../data/arcade/home/gomoku";
import { type HomeGameTest, ok, seeded } from "./kit";

const at = (x: number, y: number): number => y * GM.n + x;

export const tests: HomeGameTest[] = [
	{
		name: "五目並べは 横に 5つ ならべると 勝ち",
		run: () => {
			const s = gmStart();
			for (let k = 0; k < 4; k++) {
				gmPlace(s, at(2 + k, 5));
				gmPlace(s, at(2 + k, 0));
			}
			ok(s.winner === 0, "4つでは まだ");
			gmPlace(s, at(6, 5));
			ok(s.winner === 1 && s.line.length === 5, "5つで キリコの 勝ち");
			ok(gmScore(s) > 1000, "勝ちは 1000点 より 多い");
			ok(!gmPlace(s, at(0, 9)), "おわったら 置けない");
		},
	},
	{
		name: "五目並べは 名無しは 四を 止め、自分の 五を 優先する",
		run: () => {
			for (let seed = 1; seed <= 5; seed++) {
				const s = gmStart();
				for (let k = 0; k < 4; k++) {
					gmPlace(s, at(1 + k, 3));
					if (k < 3) gmPlace(s, at(9, 2 + k * 3));
				}
				// 黒の 四（左が 盤の 外で 片方だけ 開いた）を 止める
				const i = gmCpu(s, seeded(seed));
				ok(i === at(5, 3) || i === at(0, 3), `四を 止めない（${i}）`);
			}
			const t = gmStart();
			for (let k = 0; k < 4; k++) {
				gmPlace(t, at(1 + k, 3));
				gmPlace(t, at(1 + k, 8));
			}
			gmPlace(t, at(10, 10));
			ok(t.turn === 2, "白の 番");
			const j = gmCpu(t, seeded(3));
			ok(j === at(0, 8) || j === at(5, 8), `止めるより 自分の 五（${j}）`);
		},
	},
];
