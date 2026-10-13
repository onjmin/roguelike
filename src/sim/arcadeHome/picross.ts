// 「おんJピクロス」（data/arcade/home/picross.ts）の 試験。

import {
	PX,
	PX_PUZZLES,
	pxApply,
	pxFilled,
	pxH,
	pxLineSolve,
	pxScore,
	pxSolve,
	pxStart,
	pxTick,
	pxW,
} from "../../data/arcade/home/picross";
import { type HomeGameTest, ok } from "./kit";

/** いまの 問題を 答えどおりに 塗る（最後の 1マスで とける）。 */
const paintAll = (s: ReturnType<typeof pxStart>) => {
	const p = PX_PUZZLES[s.i];
	const ev: string[] = [];
	for (let y = 0; y < pxH(p); y++)
		for (let x = 0; x < pxW(p); x++)
			if (pxFilled(p, x, y)) ev.push(...pxApply(s, x, y, "paint"));
	return ev;
};

export const tests: HomeGameTest[] = [
	{
		name: "おんJピクロスの 1行の 理づめは 重なりと 空きを 決める",
		run: () => {
			const u = (n: number) => Array(n).fill(-1);
			ok(pxLineSolve([3], u(5))?.join() === "-1,-1,1,-1,-1", "3 in 5");
			ok(pxLineSolve([0], u(4))?.join() === "0,0,0,0", "0 clue");
			ok(pxLineSolve([2, 2], u(5))?.join() === "1,1,0,1,1", "2 2 in 5");
			ok(pxLineSolve([1], [1, -1, -1])?.join() === "1,0,0", "known end");
			ok(pxLineSolve([2], [0, 1, 0]) === null, "contradiction");
		},
	},
	{
		name: "おんJピクロスの 問題は どれも 理づめ だけで 1つに とける",
		run: () => {
			ok(PX_PUZZLES.length >= 8, `count ${PX_PUZZLES.length}`);
			let last = 0;
			for (const p of PX_PUZZLES) {
				const w = pxW(p);
				ok(w <= 10 && pxH(p) <= 10, `${p.name} size`);
				ok(
					p.rows.every((r) => r.length === w),
					`${p.name} ragged`,
				);
				for (const r of p.rows)
					for (const c of r) ok(c === "." || p.ink[c], `${p.name} ink ${c}`);
				const area = w * pxH(p);
				ok(area >= last, `${p.name} order`);
				last = area;
				const g = pxSolve(p);
				ok(g, `${p.name} contradiction`);
				for (let y = 0; y < pxH(p); y++)
					for (let x = 0; x < w; x++)
						ok(
							g?.[y][x] === (pxFilled(p, x, y) ? 1 : 0),
							`${p.name} not line solvable at ${x},${y}`,
						);
			}
		},
	},
	{
		name: "おんJピクロスは 塗りおえると 絵が 出て 次へ、ぜんぶで のこり 時間も 点",
		run: () => {
			const s = pxStart();
			// × は 答えに ならない、消すと もどる
			ok(pxApply(s, 0, 0, "cross").includes("cross"), "cross");
			ok(pxApply(s, 0, 0, "paint").length === 0, "paint over cross blocked");
			ok(pxApply(s, 0, 0, "cross").includes("uncross"), "uncross");
			const ev = paintAll(s);
			ok(ev.includes("solve") && s.reveal > 0, `solve ${ev}`);
			ok(pxScore(s) === 25 * PX.perCell, `score ${pxScore(s)}`);
			const t = s.t;
			ok(pxTick(s, 1).length === 0 && s.t === t, "clock stops on reveal");
			ok(pxTick(s, PX.reveal).includes("next") && s.i === 1, "next");
			while (!s.over) {
				paintAll(s);
				pxTick(s, PX.reveal + 0.1);
			}
			ok(s.solved.length === PX_PUZZLES.length, "all solved");
			const cells = PX_PUZZLES.reduce((n, p) => n + pxW(p) * pxH(p), 0);
			ok(
				pxScore(s) === cells * PX.perCell + Math.ceil(t) * PX.perSec,
				`all score ${pxScore(s)}`,
			);
		},
	},
	{
		name: "おんJピクロスは 判定 ありで まちがうと × と 10秒、なしなら 消せる",
		run: () => {
			const a = pxStart(true);
			// ハートの 左上は 塗らない マス
			ok(!pxFilled(PX_PUZZLES[0], 0, 0), "fixture");
			ok(pxApply(a, 0, 0, "paint").includes("miss"), "miss");
			ok(a.t === PX.time - PX.penalty && a.cells[0][0] === 3, "penalty");
			ok(pxApply(a, 0, 0, "paint").length === 0, "locked");
			ok(paintAll(a).includes("solve"), "solve with miss mark");
			const b = pxStart(false);
			ok(pxApply(b, 0, 0, "paint").includes("paint"), "free paint");
			ok(!paintAll(b).includes("solve"), "wrong cell blocks solve");
			ok(pxApply(b, 0, 0, "paint").includes("solve"), "erase solves");
			// A を 押しながら：そろえる だけ（塗った マスは そのまま）
			const c = pxStart();
			pxApply(c, 1, 1, "paint", true);
			ok(pxApply(c, 1, 1, "paint", true).length === 0, "drag keeps");
			ok(c.cells[1][1] === 1, "drag painted");
			// 時間ぎれ
			const d = pxStart();
			ok(pxTick(d, PX.time + 1).includes("timeup") && d.over, "timeup");
			ok(pxScore(d) === 0, "timeup score");
		},
	},
];
