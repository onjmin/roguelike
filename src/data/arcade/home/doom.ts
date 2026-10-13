// キリコの 家の ゲーム「DOOM」（doom）の 決まり。板は ui/arcade/home/doom.ts、文は data/arcade/text.ts。
// - ゲーミングPCの 中の 一人称の 迷路（レイキャスト）。スレ 3枚（だんだん 広い）を ぬけて 出口の「次スレ」へ。
// - 敵：名無し（速い・なぐる）・荒らし（遅い 弾を 撃つ）・3枚目に スレ主（大きい・弾を ばらまく）。
//   見えたら（または すぐ そばで）起きて 寄って くる。起きる まえは 動かない。
// - キリコの 蓄音機の ラッパ：まんなかへ 撃つ（少し 寄せて 当てる）。弾が なければ ラッパで なぐる（近い・遅い）。
// - 拾う：おにぎり（体力）・弾。3枚目の 出口は スレ主を たおす まで 開かない。
// - スコア＝たおした 数×100（スレ主は 2000）＋拾うと 50＋スレを ぬけると 1000×枚目＋早さの 点。体力 0 で おわり。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import type { Rnd } from "../logic";

export const DOOM = {
	/** 視野（ラジアン）。 */
	fov: 1.15,
	/** 進む・下がる 速さ（マス/秒）と 向きを かえる 速さ（ラジアン/秒）。体の 半径。 */
	speed: 2.6,
	back: 1.8,
	turn: 2.4,
	radius: 0.22,
	hp: 100,
	ammo: 24,
	ammoMax: 99,
	ammoPick: 10,
	healPick: 25,
	/** 撃つ・なぐる 間（秒）、なぐる 届き、寄せて 当てる 角（ラジアン）、撃つ 届き。 */
	fireCd: 0.3,
	meleeCd: 0.5,
	meleeRange: 1.2,
	aim: 0.05,
	range: 16,
	/** 敵が 見つける 遠さ・そばで 起きる 近さ。 */
	sight: 10,
	near: 2.5,
	foe: {
		nana: { hp: 2, speed: 2.1, r: 0.28, keep: 0.7, cd: 0.9, dmg: 7 },
		are: { hp: 3, speed: 1.0, r: 0.28, keep: 3, cd: 2.0, dmg: 10 },
		boss: { hp: 24, speed: 0.8, r: 0.55, keep: 2.5, cd: 1.4, dmg: 12 },
	},
	/** 敵の 弾の 速さ・当たる 近さ・スレ主の ばらまく 角。 */
	shotSpeed: 3.4,
	shotR: 0.3,
	spread: 0.22,
	kill: { nana: 100, are: 100, boss: 2000 },
	pick: 50,
	clearBase: 1000,
	/** スレ ごとの 目安の 秒（早いほど 点。1秒 あたり parScore）。 */
	par: [60, 90, 150],
	parScore: 10,
	hurtT: 0.35,
} as const;

/** 板の 字。 */
export const DOOM_TEXT = {
	note: "タップ　左右＝向く　中の上＝進む　中の下＝撃つ",
	hp: "体力",
	ammo: "弾",
	level: "スレ",
	score: "SCORE",
	next: "次スレ　{n}",
	first: "スレ　1",
	locked: "スレ主が　いる　かぎり　開かない",
	boss: "スレ主　降臨",
} as const;

// マップの 字：# れんが・B 掲示板・S 過去ログの 石・E 出口（次スレ）
// P キリコ・n 名無し・a 荒らし・X スレ主・h おにぎり・m 弾
export const DOOM_LEVELS: readonly { rows: readonly string[]; a: number }[] = [
	{
		a: 0,
		rows: [
			"##############",
			"#P..#.....h..#",
			"#...#..n.....#",
			"#...B....##..#",
			"#.......a#...#",
			"###.BBB..#..m#",
			"#........#...#",
			"#..n..a..#...E",
			"#.m.......h..#",
			"##############",
		],
	},
	{
		a: 0,
		rows: [
			"SSSSSSSSSSSSSSSSSS",
			"S....S......B....S",
			"S.P..S..a...B..m.S",
			"S....S......B....S",
			"S..........n.....S",
			"SSS.SSSS..BBBB.BBS",
			"S.....hS.........S",
			"S..n...S..a...n..S",
			"S.SSS..S.........S",
			"S.S....SSSSS.SSSSS",
			"S.S..a.....h.....S",
			"S.Sm.......SS.a..S",
			"S....n.....SS...mE",
			"SSSSSSSSSSSSSSSSSS",
		],
	},
	{
		a: Math.PI / 2,
		rows: [
			"####################",
			"#P.#......B.......h#",
			"#..#..n...B..a.....#",
			"#..#......B........#",
			"#.....##.....BBB...#",
			"#..m..##..n..B.....#",
			"####.###.....B..a..#",
			"#.......#SSSSSS.####",
			"#.a..h..#S....S....#",
			"#.......#S.X..S..m.#",
			"##.######S....S....#",
			"#......a.S....S.n..#",
			"#.n......SSS.SS....#",
			"#...m..........a...#",
			"#h................mE",
			"####################",
		],
	},
];

/** マスの 種類（0 床・1 れんが・2 掲示板・3 石・4 出口）。 */
export type DoomCell = 0 | 1 | 2 | 3 | 4;
export const EXIT: DoomCell = 4;
export type DoomMap = { w: number; h: number; cells: Uint8Array };
export type DoomFoeKind = "nana" | "are" | "boss";
export type DoomFoe = {
	kind: DoomFoeKind;
	x: number;
	y: number;
	hp: number;
	awake: boolean;
	cd: number;
	/** 当たって 白く 光る 残り・攻める 絵の 残り・歩いた 道のり（足の 絵）。 */
	flash: number;
	anim: number;
	walk: number;
	dead: boolean;
	deadT: number;
};
export type DoomShot = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	dmg: number;
	boss: boolean;
};
export type DoomItem = { kind: "heal" | "ammo"; x: number; y: number };
export type DoomState = {
	lv: number;
	map: DoomMap;
	x: number;
	y: number;
	a: number;
	hp: number;
	ammo: number;
	foes: DoomFoe[];
	shots: DoomShot[];
	items: DoomItem[];
	kills: number;
	points: number;
	t: number;
	levelT: number;
	fireCd: number;
	/** 撃った 光・なぐる ふり・痛い・拾った 光・字を 出す 残り。 */
	flash: number;
	swing: number;
	hurt: number;
	glow: number;
	msgT: number;
	lockT: number;
	/** 歩いた 道のり（ラッパの ゆれ）。 */
	bob: number;
	over: boolean;
	clear: boolean;
};
export type DoomIn = { move: number; turn: number; fire: boolean };
export type DoomEv =
	| "shot"
	| "melee"
	| "hit"
	| "kill"
	| "bossDown"
	| "hurt"
	| "heal"
	| "ammo"
	| "fire"
	| "boss"
	| "next"
	| "locked"
	| "clear"
	| "dead";

const CELL: Record<string, DoomCell> = { "#": 1, B: 2, S: 3, E: 4 };

/** -π〜π に まるめる。 */
export const wrapA = (a: number): number => {
	let r = a % (Math.PI * 2);
	if (r > Math.PI) r -= Math.PI * 2;
	if (r < -Math.PI) r += Math.PI * 2;
	return r;
};

/** その マス（外は れんが）。 */
export const doomCell = (m: DoomMap, x: number, y: number): DoomCell => {
	const cx = Math.floor(x);
	const cy = Math.floor(y);
	if (cx < 0 || cy < 0 || cx >= m.w || cy >= m.h) return 1;
	return m.cells[cy * m.w + cx] as DoomCell;
};

const newFoe = (kind: DoomFoeKind, x: number, y: number): DoomFoe => ({
	kind,
	x,
	y,
	hp: DOOM.foe[kind].hp,
	awake: false,
	cd: 0,
	flash: 0,
	anim: 0,
	walk: 0,
	dead: false,
	deadT: 0,
});

/** lv 枚目の スレを 読む（キリコの 場所・向きも かえる）。 */
export const doomLoad = (s: DoomState, lv: number): void => {
	const L = DOOM_LEVELS[lv] ?? DOOM_LEVELS[0];
	const h = L.rows.length;
	const w = L.rows[0].length;
	const cells = new Uint8Array(w * h);
	const foes: DoomFoe[] = [];
	const items: DoomItem[] = [];
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const ch = L.rows[y][x];
			cells[y * w + x] = CELL[ch] ?? 0;
			const cx = x + 0.5;
			const cy = y + 0.5;
			if (ch === "P") {
				s.x = cx;
				s.y = cy;
			} else if (ch === "n") foes.push(newFoe("nana", cx, cy));
			else if (ch === "a") foes.push(newFoe("are", cx, cy));
			else if (ch === "X") foes.push(newFoe("boss", cx, cy));
			else if (ch === "h") items.push({ kind: "heal", x: cx, y: cy });
			else if (ch === "m") items.push({ kind: "ammo", x: cx, y: cy });
		}
	}
	s.lv = lv;
	s.map = { w, h, cells };
	s.a = L.a;
	s.foes = foes;
	s.items = items;
	s.shots = [];
	s.levelT = 0;
	s.msgT = 1.6;
	s.lockT = 0;
};

export const doomStart = (): DoomState => {
	const s: DoomState = {
		lv: 0,
		map: { w: 1, h: 1, cells: new Uint8Array(1) },
		x: 0,
		y: 0,
		a: 0,
		hp: DOOM.hp,
		ammo: DOOM.ammo,
		foes: [],
		shots: [],
		items: [],
		kills: 0,
		points: 0,
		t: 0,
		levelT: 0,
		fireCd: 0,
		flash: 0,
		swing: 0,
		hurt: 0,
		glow: 0,
		msgT: 0,
		lockT: 0,
		bob: 0,
		over: false,
		clear: false,
	};
	doomLoad(s, 0);
	return s;
};

export type DoomHit = {
	/** 目から 壁までの 長さ（光線に そって）。 */
	dist: number;
	cell: DoomCell;
	/** 壁の 中の 横の 位置（0〜1）。 */
	u: number;
	/** 0 は 東西を 向く 面、1 は 南北を 向く 面。 */
	side: 0 | 1;
};

/** (x, y) から ang へ 光線を 飛ばして 当たる 壁（DDA）。out を 渡すと 使い回す。 */
export const doomCast = (
	m: DoomMap,
	x: number,
	y: number,
	ang: number,
	out: DoomHit = { dist: 0, cell: 1, u: 0, side: 0 },
): DoomHit => {
	const dx = Math.cos(ang);
	const dy = Math.sin(ang);
	let mx = Math.floor(x);
	let my = Math.floor(y);
	const ddx = dx === 0 ? 1e30 : Math.abs(1 / dx);
	const ddy = dy === 0 ? 1e30 : Math.abs(1 / dy);
	const sx = dx < 0 ? -1 : 1;
	const sy = dy < 0 ? -1 : 1;
	let tx = dx < 0 ? (x - mx) * ddx : (mx + 1 - x) * ddx;
	let ty = dy < 0 ? (y - my) * ddy : (my + 1 - y) * ddy;
	let side: 0 | 1 = 0;
	for (let i = 0; i < 256; i++) {
		if (tx < ty) {
			tx += ddx;
			mx += sx;
			side = 0;
		} else {
			ty += ddy;
			my += sy;
			side = 1;
		}
		const c =
			mx < 0 || my < 0 || mx >= m.w || my >= m.h
				? 1
				: (m.cells[my * m.w + mx] as DoomCell);
		if (c !== 0) {
			const dist = side === 0 ? tx - ddx : ty - ddy;
			let u = side === 0 ? y + dist * dy : x + dist * dx;
			u -= Math.floor(u);
			// 向きで 絵が 裏がえらない ように
			if ((side === 0 && dx < 0) || (side === 1 && dy > 0)) u = 1 - u;
			out.dist = dist;
			out.cell = c;
			out.u = u;
			out.side = side;
			return out;
		}
	}
	out.dist = 64;
	out.cell = 1;
	out.u = 0;
	out.side = 0;
	return out;
};

/** 2点の あいだに 壁が ないか（0.1 マス ずつ 見る）。 */
export const doomSee = (
	m: DoomMap,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
): boolean => {
	const d = Math.hypot(x2 - x1, y2 - y1);
	const n = Math.ceil(d / 0.1);
	for (let i = 1; i < n; i++) {
		const k = i / n;
		if (doomCell(m, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k) !== 0) return false;
	}
	return true;
};

/** 半径 r の 体を (dx, dy) 動かす（軸ごとに 壁で 止まる）。出口に ぶつかったら exit。 */
export const doomMove = (
	m: DoomMap,
	x: number,
	y: number,
	dx: number,
	dy: number,
	r: number,
): { x: number; y: number; exit: boolean } => {
	let exit = false;
	const blocked = (px: number, py: number): boolean => {
		let hit = false;
		for (const [ox, oy] of [
			[-r, -r],
			[r, -r],
			[-r, r],
			[r, r],
		] as const) {
			const c = doomCell(m, px + ox, py + oy);
			if (c !== 0) {
				hit = true;
				if (c === EXIT) exit = true;
			}
		}
		return hit;
	};
	let nx = x;
	let ny = y;
	if (dx !== 0 && !blocked(x + dx, y)) nx = x + dx;
	if (dy !== 0 && !blocked(nx, y + dy)) ny = y + dy;
	return { x: nx, y: ny, exit };
};

/** スレ主が 生きて いて 出口が 開かない。 */
export const doomLocked = (s: DoomState): boolean =>
	s.foes.some((f) => f.kind === "boss" && !f.dead);

/** 前の range の うちで いちばん 近い ねらえる 敵（壁の 向こうは だめ）。 */
export const doomAim = (s: DoomState, range: number): DoomFoe | null => {
	let best: DoomFoe | null = null;
	let bd = range;
	for (const f of s.foes) {
		if (f.dead) continue;
		const dx = f.x - s.x;
		const dy = f.y - s.y;
		const d = Math.hypot(dx, dy);
		if (d > bd) continue;
		const rel = wrapA(Math.atan2(dy, dx) - s.a);
		const cone = Math.atan2(DOOM.foe[f.kind].r, d) + DOOM.aim;
		if (Math.abs(rel) > cone) continue;
		if (!doomSee(s.map, s.x, s.y, f.x, f.y)) continue;
		best = f;
		bd = d;
	}
	return best;
};

const hurt = (s: DoomState, dmg: number, evs: DoomEv[]): void => {
	s.hp = Math.max(0, s.hp - dmg);
	s.hurt = DOOM.hurtT;
	evs.push("hurt");
};

const strike = (s: DoomState, f: DoomFoe, evs: DoomEv[]): void => {
	f.hp -= 1;
	f.flash = 0.12;
	f.awake = true;
	if (f.hp > 0) {
		evs.push("hit");
		return;
	}
	f.dead = true;
	s.kills++;
	s.points += DOOM.kill[f.kind];
	evs.push(f.kind === "boss" ? "bossDown" : "kill");
};

const clearLevel = (s: DoomState, evs: DoomEv[]): void => {
	const par = DOOM.par[s.lv] ?? 60;
	s.points +=
		DOOM.clearBase * (s.lv + 1) +
		Math.floor(Math.max(0, par - s.levelT) * DOOM.parScore);
	if (s.lv + 1 >= DOOM_LEVELS.length) {
		s.clear = true;
		s.over = true;
		evs.push("clear");
		return;
	}
	doomLoad(s, s.lv + 1);
	evs.push("next");
};

const foeStep = (
	s: DoomState,
	f: DoomFoe,
	dt: number,
	rnd: Rnd,
	evs: DoomEv[],
): void => {
	const sp = DOOM.foe[f.kind];
	f.flash -= dt;
	f.anim -= dt;
	f.cd -= dt;
	const dx = s.x - f.x;
	const dy = s.y - f.y;
	const d = Math.hypot(dx, dy) || 1e-6;
	const see = d < DOOM.sight && doomSee(s.map, f.x, f.y, s.x, s.y);
	if (!f.awake) {
		if (!see && d > DOOM.near) return;
		f.awake = true;
		f.cd = 0.6 + rnd() * 0.6;
		if (f.kind === "boss") evs.push("boss");
	}
	// 寄る（弾を 撃つ 者は 見えて いれば 間を おく）
	if (d > sp.keep || (!see && f.kind !== "nana")) {
		const st = sp.speed * dt;
		const m = doomMove(s.map, f.x, f.y, (dx / d) * st, (dy / d) * st, sp.r);
		f.walk += Math.hypot(m.x - f.x, m.y - f.y);
		f.x = m.x;
		f.y = m.y;
	}
	if (f.cd > 0) return;
	if (f.kind === "nana") {
		if (d < sp.keep + 0.35) {
			hurt(s, sp.dmg, evs);
			f.cd = sp.cd;
			f.anim = 0.25;
		}
		return;
	}
	if (!see) return;
	const base = Math.atan2(dy, dx);
	const n = f.kind === "boss" ? (f.hp * 2 <= sp.hp ? 5 : 3) : 1;
	for (let i = 0; i < n; i++) {
		const a = base + (i - (n - 1) / 2) * DOOM.spread;
		s.shots.push({
			x: f.x + Math.cos(a) * sp.r,
			y: f.y + Math.sin(a) * sp.r,
			vx: Math.cos(a) * DOOM.shotSpeed,
			vy: Math.sin(a) * DOOM.shotSpeed,
			dmg: sp.dmg,
			boss: f.kind === "boss",
		});
	}
	f.cd = sp.cd + rnd() * 0.8;
	f.anim = 0.3;
	evs.push("fire");
};

/** 1こま 進める。 */
export const doomStep = (
	s: DoomState,
	dt: number,
	inp: DoomIn,
	rnd: Rnd,
): DoomEv[] => {
	const evs: DoomEv[] = [];
	if (s.over) return evs;
	s.t += dt;
	s.levelT += dt;
	s.fireCd -= dt;
	s.flash = Math.max(0, s.flash - dt);
	s.swing = Math.max(0, s.swing - dt);
	s.hurt = Math.max(0, s.hurt - dt);
	s.glow = Math.max(0, s.glow - dt);
	s.msgT = Math.max(0, s.msgT - dt);
	s.lockT = Math.max(0, s.lockT - dt);
	// 向く・進む
	s.a = wrapA(s.a + Math.sign(inp.turn) * DOOM.turn * dt);
	const mv = Math.sign(inp.move) * (inp.move > 0 ? DOOM.speed : DOOM.back) * dt;
	if (mv !== 0) {
		const m = doomMove(
			s.map,
			s.x,
			s.y,
			Math.cos(s.a) * mv,
			Math.sin(s.a) * mv,
			DOOM.radius,
		);
		s.bob += Math.hypot(m.x - s.x, m.y - s.y);
		s.x = m.x;
		s.y = m.y;
		if (m.exit && mv > 0) {
			if (doomLocked(s)) {
				if (s.lockT <= 0) evs.push("locked");
				s.lockT = 1.5;
			} else {
				clearLevel(s, evs);
				return evs;
			}
		}
	}
	// 撃つ（弾が なければ なぐる）
	if (inp.fire && s.fireCd <= 0) {
		if (s.ammo > 0) {
			s.ammo--;
			s.fireCd = DOOM.fireCd;
			s.flash = 0.15;
			evs.push("shot");
			const f = doomAim(s, DOOM.range);
			if (f) strike(s, f, evs);
		} else {
			s.fireCd = DOOM.meleeCd;
			s.swing = 0.25;
			evs.push("melee");
			const f = doomAim(s, DOOM.meleeRange);
			if (f) strike(s, f, evs);
		}
	}
	// 拾う（いっぱいの ときは 残す）
	s.items = s.items.filter((it) => {
		if (Math.hypot(it.x - s.x, it.y - s.y) > 0.5) return true;
		if (it.kind === "heal") {
			if (s.hp >= DOOM.hp) return true;
			s.hp = Math.min(DOOM.hp, s.hp + DOOM.healPick);
			evs.push("heal");
		} else {
			if (s.ammo >= DOOM.ammoMax) return true;
			s.ammo = Math.min(DOOM.ammoMax, s.ammo + DOOM.ammoPick);
			evs.push("ammo");
		}
		s.points += DOOM.pick;
		s.glow = 0.3;
		return false;
	});
	// 敵
	for (const f of s.foes) {
		if (f.dead) f.deadT += dt;
		else foeStep(s, f, dt, rnd, evs);
	}
	// 重ならない ように 押しあう
	const live = s.foes.filter((f) => !f.dead && f.awake);
	for (let i = 0; i < live.length; i++) {
		for (let j = i + 1; j < live.length; j++) {
			const p = live[i];
			const q = live[j];
			const dx = q.x - p.x;
			const dy = q.y - p.y;
			const d = Math.hypot(dx, dy);
			const need = DOOM.foe[p.kind].r + DOOM.foe[q.kind].r;
			if (d >= need || d === 0) continue;
			const k = ((need - d) / d) * 0.5;
			const mp = doomMove(
				s.map,
				p.x,
				p.y,
				-dx * k,
				-dy * k,
				DOOM.foe[p.kind].r,
			);
			const mq = doomMove(s.map, q.x, q.y, dx * k, dy * k, DOOM.foe[q.kind].r);
			p.x = mp.x;
			p.y = mp.y;
			q.x = mq.x;
			q.y = mq.y;
		}
	}
	// 敵の 弾
	s.shots = s.shots.filter((b) => {
		b.x += b.vx * dt;
		b.y += b.vy * dt;
		if (doomCell(s.map, b.x, b.y) !== 0) return false;
		if (Math.hypot(b.x - s.x, b.y - s.y) < DOOM.shotR) {
			hurt(s, b.dmg, evs);
			return false;
		}
		return true;
	});
	if (s.hp <= 0) {
		s.over = true;
		evs.push("dead");
	}
	return evs;
};

export const doomScore = (s: DoomState): number => s.points;
