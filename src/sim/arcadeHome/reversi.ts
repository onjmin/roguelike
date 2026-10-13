// リバーシ（data/arcade/home/reversi.ts）の 試験。
import {
	RV,
	type RvState,
	type RvStone,
	rvCount,
	rvCpu,
	rvFlips,
	rvMoves,
	rvPlace,
	rvScore,
	rvStart,
} from "../../data/arcade/home/reversi";
import { type HomeGameTest, ok, seeded } from "./kit";

const at = (x: number, y: number): number => y * RV.n + x;

/** 字の 盤（. 空き・x 黒・o 白）から 局面を つくる。 */
const boardOf = (rows: string[], turn: 1 | 2 = 1, lv = 0): RvState => {
	const s = rvStart(lv);
	s.cells = rows
		.join("")
		.split("")
		.map((ch) => (ch === "x" ? 1 : ch === "o" ? 2 : 0) as RvStone);
	s.turn = turn;
	return s;
};

export const tests: HomeGameTest[] = [
	{
		name: "リバーシは はじめ 黒が 4か所に 置ける",
		run: () => {
			const s = rvStart();
			const m = rvMoves(s.cells, 1).sort((a, b) => a - b);
			const want = [at(3, 2), at(2, 3), at(5, 4), at(4, 5)].sort(
				(a, b) => a - b,
			);
			ok(m.join() === want.join(), `置ける マスが ちがう（${m.join()}）`);
			ok(!rvPlace(s, at(0, 0)), "はさめない ところには 置けない");
			const mv = rvPlace(s, at(3, 2));
			ok(mv && mv.flips.length === 1, "1つ 返る");
			ok(rvCount(s.cells, 1) === 4 && rvCount(s.cells, 2) === 1, "黒4 白1");
			ok(s.turn === 2, "白の 番に なる");
		},
	},
	{
		name: "リバーシは 何方向も まとめて 返す",
		run: () => {
			const s = boardOf([
				"x.x.x...",
				".ooo....",
				"xo......",
				"..o.....",
				"........",
				"........",
				"........",
				"........",
			]);
			const f = rvFlips(s.cells, at(2, 2), 1).sort((a, b) => a - b);
			// 左上・上・右上・左は はさめる、下（2,3）は 先に 黒が ない
			const want = [at(1, 1), at(2, 1), at(3, 1), at(1, 2)].sort(
				(a, b) => a - b,
			);
			ok(f.join() === want.join(), `返る 石が ちがう（${f.join()}）`);
		},
	},
	{
		name: "リバーシは 置けない ほうが パスし、どちらも 置けないと おわる",
		run: () => {
			// 白は どこにも 置けない（黒は まだ 置ける）
			const s = boardOf([
				"xxxxxxxx",
				"xxxxxxxx",
				"xxxxxxxx",
				"xxxxxxxx",
				"xxxxxxxx",
				"xxxxxxxx",
				"xxxxxxo.",
				"xxxxxo..",
			]);
			const mv = rvPlace(s, at(7, 6));
			ok(mv, "黒が 置ける");
			ok(s.winner === 0 && mv?.pass === 2 && s.turn === 1, "白が パス");
			const mv2 = rvPlace(s, at(6, 7));
			ok(mv2 && s.winner === 1, "どちらも 置けず 黒の 勝ち");
			ok(rvScore(s) > 1000, "勝ちは 1000点 より 多い");
		},
	},
	{
		name: "リバーシの 名無しは ふつう・つよいで 角を とる",
		run: () => {
			for (const lv of [1, 2])
				for (let seed = 1; seed <= 4; seed++) {
					const s = boardOf(
						[
							"........",
							".x......",
							"..x.....",
							"...xo...",
							"...oo...",
							"........",
							"........",
							"........",
						],
						2,
						lv,
					);
					const i = rvCpu(s, seeded(seed));
					ok(i === at(0, 0), `角を とらない（段${lv}・${i}）`);
				}
		},
	},
	{
		name: "リバーシの 名無しは 置ける 手だけ 打ち 最後まで 回る",
		run: () => {
			for (let lv = 0; lv < RV.levels; lv++) {
				const s = rvStart(lv);
				const r = seeded(lv + 7);
				for (let k = 0; k < 80 && !s.winner; k++) {
					const i = rvCpu(s, r);
					ok(rvMoves(s.cells, s.turn).includes(i), "置けない 手");
					rvPlace(s, i);
				}
				ok(s.winner !== 0, "おわらない");
				ok(
					rvCount(s.cells, 1) + rvCount(s.cells, 2) <= 64,
					"石の 数が おかしい",
				);
			}
		},
	},
];
