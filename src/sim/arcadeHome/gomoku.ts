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
	{
		name: "五目並べは ふつう 以上の 名無しが とびとびの 四・三を 止める",
		run: () => {
			for (let seed = 1; seed <= 5; seed++) {
				// 黒 ●●＿●● （まんなかが 空いた 四）
				const t = gmStart(1);
				for (const x of [2, 3, 5, 6]) t.cells[at(x, 5)] = 1;
				t.cells[at(0, 10)] = 2;
				t.cells[at(10, 0)] = 2;
				t.turn = 2;
				const i = gmCpu(t, seeded(seed));
				ok(i === at(4, 5), `とびとびの 四を 止めない（${i}）`);
				// 黒 ＿●●＿●＿ （とびとびの 開いた 三）
				const u = gmStart(2);
				for (const x of [3, 4, 6]) u.cells[at(x, 5)] = 1;
				u.cells[at(0, 10)] = 2;
				u.cells[at(10, 0)] = 2;
				u.turn = 2;
				const j = gmCpu(u, seeded(seed));
				ok(
					[at(2, 5), at(5, 5), at(7, 5)].includes(j),
					`とびとびの 三を 止めない（${j}）`,
				);
			}
		},
	},
	{
		name: "五目並べは 強い 名無しに 勝つほど 点が 多い",
		run: () => {
			const a = gmStart(0);
			const b = gmStart(2);
			a.winner = b.winner = 1;
			a.moves = b.moves = 20;
			ok(gmScore(b) > gmScore(a), "つよいに 勝つと 多い");
		},
	},
];
