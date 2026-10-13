// 穴掘りキリコ の 試験（data/arcade/home/digkiriko.ts）。

import {
	DK,
	type DkFoe,
	type DkState,
	dkStart,
	dkStep,
} from "../../data/arcade/home/digkiriko";
import { type HomeGameTest, ok, seeded } from "./kit";

const play = (s: DkState): void => {
	s.phase = "play";
	s.pause = 0;
};

const foe = (x: number, y: number, kind: DkFoe["kind"] = "arashi"): DkFoe => ({
	x,
	y,
	dir: 1,
	t: 0,
	kind,
	sx: x,
	sy: y,
	ghost: 0,
	ghostIn: 99,
	inflate: 0,
	deflateT: 0,
	fire: null,
	fireCd: 99,
});

export const tests: HomeGameTest[] = [
	{
		name: "穴掘りキリコは 動くと 土が 掘れ、岩には 入れない",
		run: () => {
			const rnd = seeded(1);
			const s = dkStart(rnd);
			ok(s.foes.length === DK.foes && s.rocks.length === DK.rocks, "field");
			play(s);
			s.foes = [];
			s.rocks = [];
			s.foes.push(foe(0, 15));
			s.foes[0].ghostIn = 999;
			// 縦穴を 下りて 右へ 掘る
			for (let i = 0; i < 40; i++)
				dkStep(s, 0.05, { dir: 2, pump: false }, rnd);
			const y = s.player.y;
			ok(y >= DK.shaft + 2, `y ${y}`);
			for (let i = 0; i < 20; i++)
				dkStep(s, 0.05, { dir: 1, pump: false }, rnd);
			ok(
				s.player.x > DK.start[0] + 1 && s.dug[s.player.y][DK.start[0] + 1],
				"dug right",
			);
			// 岩の 手前で 止まる
			const p = s.player;
			p.t = 0;
			s.rocks.push({
				x: p.x + 1,
				fy: p.y - 1,
				state: "still",
				t: 0,
				crushed: 0,
			});
			s.rocks.push({ x: p.x + 1, fy: p.y, state: "still", t: 0, crushed: 0 });
			const x0 = p.x;
			for (let i = 0; i < 10; i++)
				dkStep(s, 0.05, { dir: 1, pump: false }, rnd);
			ok(s.player.x === x0 && s.player.t === 0, `x ${s.player.x}`);
		},
	},
	{
		name: "穴掘りキリコは ポンプで 4回 ふくらませると はじけて 深さの 点",
		run: () => {
			const rnd = seeded(2);
			const s = dkStart(rnd);
			play(s);
			s.rocks = [];
			s.player = { x: 5, y: 9, dir: 1, t: 0 };
			s.face = 1;
			for (let x = 5; x <= 8; x++) s.dug[9][x] = true;
			s.foes = [foe(8, 9), foe(20, 2)];
			s.foes[1].ghostIn = 999;
			let ev: string[] = [];
			ev = ev.concat(dkStep(s, 0.02, { dir: null, pump: true }, rnd));
			for (let i = 0; i < 10; i++)
				ev = ev.concat(dkStep(s, 0.02, { dir: null, pump: false }, rnd));
			ok(ev.includes("hit") && s.foes[0].inflate === 1, `hit ${ev}`);
			for (let i = 0; i < 3; i++) {
				ev = ev.concat(dkStep(s, 0.2, { dir: null, pump: true }, rnd));
			}
			ok(ev.includes("pop") && s.foes.length === 1, `pop ${ev}`);
			ok(s.points === DK.layerPts[2], `pts ${s.points}`);
			// 押さないと しぼんで 元に 戻る
			const t = dkStart(rnd);
			play(t);
			t.rocks = [];
			t.player = { x: 5, y: 9, dir: 1, t: 0 };
			t.face = 1;
			for (let x = 5; x <= 7; x++) t.dug[9][x] = true;
			t.foes = [foe(7, 9)];
			dkStep(t, 0.02, { dir: null, pump: true }, rnd);
			for (let i = 0; i < 10; i++)
				dkStep(t, 0.02, { dir: null, pump: false }, rnd);
			ok(t.foes[0].inflate === 1, `inf ${t.foes[0].inflate}`);
			for (let i = 0; i < 30; i++)
				dkStep(t, 0.05, { dir: null, pump: false }, rnd);
			ok(t.foes[0].inflate === 0 && t.hose === null, "deflated");
		},
	},
	{
		name: "穴掘りキリコは 岩が 崩れて 敵を つぶすと 大きい 点、敵が いなく なると 次の 面",
		run: () => {
			const rnd = seeded(3);
			const s = dkStart(rnd);
			play(s);
			s.player = { x: 2, y: 0, dir: 1, t: 0 };
			// 岩の 下に 縦の 穴と 敵
			s.rocks = [{ x: 20, fy: 5, state: "still", t: 0, crushed: 0 }];
			for (let y = 6; y <= 9; y++) s.dug[y][20] = true;
			s.foes = [foe(20, 8)];
			s.foes[0].dir = 2;
			let ev: string[] = [];
			for (let i = 0; i < 60 && !ev.includes("crush"); i++) {
				if (s.foes[0]) Object.assign(s.foes[0], { x: 20, y: 8, t: 0 });
				ev = ev.concat(dkStep(s, 0.05, { dir: null, pump: false }, rnd));
			}
			ok(ev.includes("wobble") && ev.includes("crumble"), `ev ${ev}`);
			ok(
				ev.includes("crush") && s.points === DK.crushPts[1],
				`pts ${s.points}`,
			);
			for (let i = 0; i < 80 && s.round === 1; i++)
				ev = ev.concat(dkStep(s, 0.05, { dir: null, pump: false }, rnd));
			ok(ev.includes("clear") && s.round === 2, `round ${s.round}`);
			ok(s.foes.length === DK.foes + 1 && !s.over, `foes ${s.foes.length}`);
		},
	},
];
