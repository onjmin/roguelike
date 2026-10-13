// 「過去ログ倉庫番」（data/arcade/home/soko.ts）の 試験。

import {
	SK,
	SK_LEVELS,
	skLevelScore,
	skMove,
	skParse,
	skReset,
	skScore,
	skSolve,
	skStart,
	skTick,
	skUndo,
} from "../../data/arcade/home/soko";
import { type HomeGameTest, ok } from "./kit";

export const tests: HomeGameTest[] = [
	{
		name: "過去ログ倉庫番の 面は どれも とけて、最短が par と 同じ・やさしい 順",
		run: () => {
			ok(SK_LEVELS.length >= 10, `count ${SK_LEVELS.length}`);
			let last = 0;
			for (const [i, lv] of SK_LEVELS.entries()) {
				const m = skParse(lv);
				// 240x136 に 12px の マスで おさまる
				ok(m.w * 12 <= 160 && m.h * 12 <= 120, `${i} size ${m.w}x${m.h}`);
				ok(
					m.boxes.length === m.goal.filter(Boolean).length,
					`${i} boxes vs goals`,
				);
				ok(
					m.boxes.some((b) => !m.goal[b]),
					`${i} already solved`,
				);
				const par = skSolve(lv);
				ok(par === lv.par, `${i} par ${lv.par} but bfs ${par}`);
				ok(par >= last, `${i} order`);
				last = par;
			}
		},
	},
	{
		name: "過去ログ倉庫番は 1箱 だけ 押せる（壁・2箱は 押せない）、もどす・やりなおし",
		run: () => {
			// 2面：キリコ(3,4)、箱(2,2)(4,2)、印(2,1)(4,1)
			const s = skStart(1);
			ok(skMove(s, "up").includes("walk") && s.moves === 1, "walk");
			ok(skMove(s, "up").includes("walk"), "walk2");
			// (3,2) の 上は 壁でない 空き（3,1）→ 歩ける。右へ 押すと 壁
			ok(skMove(s, "right").includes("bump") && s.moves === 2, "box to wall");
			ok(skMove(s, "left").includes("bump"), "box to wall left");
			skMove(s, "down");
			skMove(s, "left");
			const ev = skMove(s, "up");
			ok(ev.includes("push") && ev.includes("goal"), `push to goal ${ev}`);
			ok(skUndo(s).includes("undo") && s.moves === 4, "undo");
			ok(s.boxes.includes(s.map.w * 2 + 2), "undo box back");
			ok(skReset(s).includes("reset") && s.moves === 0, "reset");
			ok(skUndo(s).includes("bump"), "nothing to undo");
			// 2箱 つづきは 押せない
			const t = skStart(0);
			t.boxes = [t.p + 1, t.p + 2];
			ok(skMove(t, "right").includes("bump") && t.moves === 0, "two boxes");
		},
	},
	{
		name: "過去ログ倉庫番は しまうと 次の 面、点は 300＋（最短×2−手数）×10",
		run: () => {
			const s = skStart();
			skMove(s, "right");
			skMove(s, "right");
			const ev = skMove(s, "right");
			ok(ev.includes("clear") && s.wait > 0, `clear ${ev}`);
			ok(skMove(s, "left").length === 0, "frozen while clear");
			ok(skScore(s) === SK.base + 3 * SK.perMove, `score ${skScore(s)}`);
			ok(skTick(s, SK.clearWait + 0.1).includes("next") && s.li === 1, "next");
			ok(skLevelScore(10, 40) === SK.base, "no negative bonus");
			// 最後の 面を しまうと おわり
			const z = skStart(SK_LEVELS.length - 1);
			z.boxes = z.map.goal.flatMap((g, i) => (g ? [i] : []));
			z.done.push({ li: z.li, moves: 30 });
			z.wait = 0.1;
			ok(skTick(z, 0.2).includes("all") && z.over, "all");
		},
	},
];
