// はさみ将棋（data/arcade/home/hasami.ts）の 試験。
import { HS, hsCpu, hsMove, hsStart } from "../../data/arcade/home/hasami";
import { type HomeGameTest, ok, seeded } from "./kit";

const at = (x: number, y: number): number => y * HS.n + x;

export const tests: HomeGameTest[] = [
	{
		name: "はさみ将棋は 縦横に 動き、挟むと 取る（2枚 ならびも）",
		run: () => {
			const s = hsStart();
			s.cells.fill(0);
			s.cells[at(2, 4)] = 1;
			s.cells[at(3, 4)] = 2;
			s.cells[at(4, 4)] = 2;
			s.cells[at(5, 0)] = 1;
			s.cells[at(0, 0)] = 2;
			ok(hsMove(s, at(5, 0), at(6, 1)) === -1, "斜めには 動けない");
			ok(hsMove(s, at(2, 4), at(2, 6)) === 0, "縦に 動ける");
			s.cells[at(2, 6)] = 0;
			s.cells[at(2, 4)] = 1;
			s.turn = 1;
			ok(hsMove(s, at(5, 0), at(5, 4)) === 2, "2枚 挟んで 取る");
			ok(s.cells[at(3, 4)] === 0 && s.cells[at(4, 4)] === 0, "盤から 消える");
			ok(s.took[1] === 2, "取った 数");
		},
	},
	{
		name: "はさみ将棋は 名無しは 取れる 手を 選び、5枚で 勝つ",
		run: () => {
			const s = hsStart();
			s.cells.fill(0);
			s.cells[at(4, 4)] = 1;
			s.cells[at(3, 4)] = 2;
			s.cells[at(5, 8)] = 2;
			s.cells[at(0, 8)] = 1;
			s.turn = 2;
			s.took[2] = 4;
			const [from, to] = hsCpu(s, seeded(7));
			ok(
				from === at(5, 8) && to === at(5, 4),
				`挟む 手を 選ばない（${from}→${to}）`,
			);
			hsMove(s, from, to);
			ok(s.winner === 2, "5枚で 名無しの 勝ち");
		},
	},
];
