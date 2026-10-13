// DOOM の 試験（data/arcade/home/doom.ts）。

import {
	DOOM,
	DOOM_LEVELS,
	type DoomState,
	doomCast,
	doomCell,
	doomStart,
	doomStep,
} from "../../data/arcade/home/doom";
import { type HomeGameTest, ok, seeded } from "./kit";

const idle = { move: 0, turn: 0, fire: false };
const fwd = { move: 1, turn: 0, fire: false };
const fire = { move: 0, turn: 0, fire: true };

/** 敵と 拾いものを どける。 */
const empty = (s: DoomState): void => {
	s.foes = [];
	s.items = [];
	s.shots = [];
};

const run = (
	s: DoomState,
	sec: number,
	inp: typeof idle,
	rnd: () => number,
): void => {
	for (let i = 0; i < sec * 60 && !s.over; i++) doomStep(s, 1 / 60, inp, rnd);
};

export const tests: HomeGameTest[] = [
	{
		name: "DOOM の スレは 四角で 外が 壁、キリコ 1人・出口 1つ、出口まで 歩いて 行ける",
		run: () => {
			for (const [i, L] of DOOM_LEVELS.entries()) {
				const w = L.rows[0].length;
				const h = L.rows.length;
				ok(
					L.rows.every((r) => r.length === w),
					`lv${i} rows`,
				);
				const all = L.rows.join("");
				ok(all.split("P").length === 2, `lv${i} one P`);
				ok(all.split("E").length === 2, `lv${i} one E`);
				for (let x = 0; x < w; x++)
					ok(
						!".PnaXhm".includes(L.rows[0][x]) &&
							!".PnaXhm".includes(L.rows[h - 1][x]),
						`lv${i} border x${x}`,
					);
				for (let y = 0; y < h; y++)
					ok(
						!".PnaXhm".includes(L.rows[y][0]) &&
							!".PnaXhm".includes(L.rows[y][w - 1]),
						`lv${i} border y${y}`,
					);
				// 床を たどって 出口の となりへ
				const start = all.indexOf("P");
				const seen = new Set([start]);
				const q = [start];
				let reach = false;
				while (q.length) {
					const p = q.pop() as number;
					const x = p % w;
					const y = Math.floor(p / w);
					for (const [dx, dy] of [
						[1, 0],
						[-1, 0],
						[0, 1],
						[0, -1],
					]) {
						const n = (y + dy) * w + x + dx;
						const ch = all[n];
						if (ch === "E") reach = true;
						if (ch === undefined || "#BSE".includes(ch) || seen.has(n))
							continue;
						seen.add(n);
						q.push(n);
					}
				}
				ok(reach, `lv${i} exit reachable`);
			}
		},
	},
	{
		name: "DOOM の 光線は 正しい 壁の 遠さに 当たる",
		run: () => {
			const s = doomStart();
			// 1枚目：(1.5,1.5) から 東は x=4 の 壁、南は y=5 の 壁
			const e = doomCast(s.map, 1.5, 1.5, 0);
			ok(Math.abs(e.dist - 2.5) < 1e-6 && e.cell === 1, `east ${e.dist}`);
			ok(e.side === 0, "east side");
			const so = doomCast(s.map, 1.5, 1.5, Math.PI / 2);
			ok(Math.abs(so.dist - 3.5) < 1e-6 && so.side === 1, `south ${so.dist}`);
			const d = doomCast(s.map, 1.5, 1.5, Math.PI / 4);
			ok(d.dist > 1 && d.dist < 6, `diag ${d.dist}`);
		},
	},
	{
		name: "DOOM の キリコは 壁を ぬけない",
		run: () => {
			const s = doomStart();
			empty(s);
			s.a = 0;
			run(s, 3, fwd, seeded(1));
			ok(s.x < 4 - DOOM.radius + 1e-9 && s.x > 3, `x ${s.x}`);
			ok(Math.abs(s.y - 1.5) < 1e-9, `y ${s.y}`);
			s.a = -Math.PI / 2;
			run(s, 3, fwd, seeded(1));
			ok(s.y >= 1 + DOOM.radius - 1e-9, `y ${s.y}`);
			ok(doomCell(s.map, s.x, s.y) === 0, "on floor");
		},
	},
	{
		name: "DOOM は 前の 敵を 撃って たおす（弾が なければ なぐる）",
		run: () => {
			const s = doomStart();
			empty(s);
			const rnd = seeded(2);
			s.foes = [
				{
					kind: "are",
					x: 3.5,
					y: 1.6,
					hp: DOOM.foe.are.hp,
					awake: false,
					cd: 0,
					flash: 0,
					anim: 0,
					walk: 0,
					dead: false,
					deadT: 0,
				},
			];
			for (let i = 0; i < 120 && !s.foes[0].dead; i++)
				doomStep(s, 1 / 60, fire, rnd);
			ok(s.kills === 1 && s.foes[0].dead, `kills ${s.kills}`);
			ok(s.points >= DOOM.kill.are, `pts ${s.points}`);
			ok(s.ammo === DOOM.ammo - DOOM.foe.are.hp, `ammo ${s.ammo}`);
			// 横を 向いて いれば 当たらない
			s.foes[0] = { ...s.foes[0], hp: 2, dead: false, x: 1.5, y: 3.5 };
			s.a = 0;
			run(s, 0.5, fire, rnd);
			ok(!s.foes[0].dead && s.foes[0].hp === 2, "miss when not aimed");
			// 弾なし：となりを なぐる
			s.ammo = 0;
			s.foes[0] = { ...s.foes[0], kind: "nana", x: 2.4, y: 1.5, cd: 9 };
			s.a = 0;
			run(s, 1.5, fire, rnd);
			ok(s.foes[0].dead && s.ammo === 0, "melee kills");
		},
	},
	{
		name: "DOOM の 敵の 弾に 当たると 体力が へり、0 で おわる",
		run: () => {
			const s = doomStart();
			empty(s);
			s.shots = [{ x: 3.4, y: 1.5, vx: -3, vy: 0, dmg: 10, boss: false }];
			run(s, 1, idle, seeded(3));
			ok(s.hp === DOOM.hp - 10 && s.shots.length === 0, `hp ${s.hp}`);
			s.hp = 5;
			s.shots = [{ x: 3.4, y: 1.5, vx: -3, vy: 0, dmg: 10, boss: false }];
			run(s, 1, idle, seeded(3));
			ok(s.over && !s.clear && s.hp === 0, "dead");
		},
	},
	{
		name: "DOOM は 出口で 次スレへ、最後は スレ主を たおす まで 開かない",
		run: () => {
			const s = doomStart();
			const rnd = seeded(4);
			empty(s);
			s.x = 12.5;
			s.y = 7.5;
			s.a = 0;
			run(s, 1, fwd, rnd);
			ok(s.lv === 1 && s.points >= DOOM.clearBase, `lv ${s.lv} ${s.points}`);
			empty(s);
			s.x = 16.5;
			s.y = 12.5;
			run(s, 1, fwd, rnd);
			ok(s.lv === 2, `lv ${s.lv}`);
			// スレ主を 遠くで 寝かせて おく
			s.foes = s.foes.filter((f) => f.kind === "boss");
			for (const f of s.foes) f.cd = 999;
			s.items = [];
			s.x = 18.5;
			s.y = 14.5;
			s.a = 0;
			run(s, 0.5, fwd, rnd);
			ok(s.lv === 2 && !s.over && s.lockT > 0, "locked");
			for (const f of s.foes) f.dead = true;
			run(s, 0.5, fwd, rnd);
			ok(s.over && s.clear, "clear");
		},
	},
];
