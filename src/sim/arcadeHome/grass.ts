// 「大草原2048」（data/arcade/home/grass.ts）の 試験。

import {
	GR_NAMES,
	grCanMove,
	grMove,
	grName,
	grStart,
} from "../../data/arcade/home/grass";
import { type HomeGameTest, ok, seeded } from "./kit";

export const tests: HomeGameTest[] = [
	{
		name: "大草原2048は 同じ 草が 1回だけ くっつき、スコアは できた 数の 合計",
		run: () => {
			const s = grStart(seeded(1));
			s.grid = [
				[2, 2, 2, 2],
				[4, 4, 8, 0],
				[0, 0, 0, 0],
				[2, 0, 0, 2],
			];
			const ev = grMove(s, "left", seeded(2));
			ok(ev.includes("merge"), `ev ${ev}`);
			ok(
				s.grid[0][0] === 4 && s.grid[0][1] === 4 && s.grid[0][2] === 0,
				`row0 ${s.grid[0]}`,
			);
			ok(s.grid[1][0] === 8 && s.grid[1][1] === 8, `row1 ${s.grid[1]}`);
			ok(s.grid[3][0] === 4, `row3 ${s.grid[3]}`);
			ok(s.score === 4 + 4 + 8 + 4, `score ${s.score}`);
			ok(s.grid.flat().filter((v) => v).length === 6, "one sprouted");
			// 動かない 向きは 何も 生えない
			const t = grStart(seeded(1));
			t.grid = [
				[2, 0, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0],
			];
			ok(grMove(t, "left", seeded(2)).length === 0, "no move");
			ok(t.grid.flat().filter((v) => v).length === 1, "nothing sprouted");
		},
	},
	{
		name: "大草原2048は 寄せられなく なると おわり、名前は 草から 富士の樹海まで",
		run: () => {
			const s = grStart(seeded(1));
			s.grid = [
				[2, 4, 2, 4],
				[4, 2, 4, 2],
				[2, 4, 2, 4],
				[0, 8, 16, 32],
			];
			ok(grCanMove(s), "a hole");
			const ev = grMove(s, "left", () => 0.5);
			ok(ev.includes("over") && s.over, `over ${ev} ${s.grid}`);
			ok(grName(2) === "草" && grName(8) === "大草原", "ladder");
			ok(grName(2048) === "富士の樹海", grName(2048));
			ok(
				GR_NAMES.every((n) => n.length <= 5),
				"names fit a tile",
			);
			// 乱数で 回しても こわれない
			const r = grStart(seeded(5));
			const dirs = ["left", "up", "right", "down"] as const;
			for (let i = 0; i < 3000 && !r.over; i++)
				grMove(r, dirs[i % 4], seeded(i));
			ok(r.score > 0, "played");
		},
	},
];
