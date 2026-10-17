// キリコの 家の ゲーム「弾幕スレ」（danmaku）の 決まり。板は ui/arcade/home/danmaku.ts、文は data/arcade/text.ts。
// - 下の キリコが 弾を ひとりでに 撃つ。上から 名無しと 荒らしが 来て 弾を ばらまく。
//   名無しは キリコを ねらう 3方向、荒らしは まわり ぜんぶへ。60秒 たつと「スレ主」が 出る。
// - 当たり判定は キリコの まんなかの 点だけ（半径 1）。弾の すぐ そばを ぬけると かすり（graze）で 点。
// - 残機 3。当たると 1つ へって、しばらく 無敵、画面の 弾が 消える。スレ主を たおすと クリア。
// - スコア＝名無し 100・荒らし 200・スレ主 5000＋かすり 10＋生きのびた 1秒 ごとに 10＋クリアで 残機×1000。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import { AH, ATOP, type Rnd } from "../logic";

export const DM = {
	/** 弾幕の 場（左右の はし・上・下）。 */
	left: 40,
	right: 200,
	top: ATOP,
	bottom: AH,
	/** キリコの 速さ・当たり判定の 半径・かすりの 幅。 */
	speed: 90,
	hitR: 1,
	graze: 7,
	lives: 3,
	invuln: 2,
	/** 撃つ 間・弾の 速さ。 */
	shotEvery: 0.08,
	shotSpeed: 260,
	/** 敵の 弾の 半径と、場に 出せる 数の 上限。 */
	bulletR: 2,
	maxBullets: 420,
	/** 雑魚の 出る 間（はじめ・いちばん 短い とき）と、出なく なる 秒。 */
	spawn0: 1.8,
	spawnMin: 0.9,
	spawnUntil: 55,
	/** スレ主が 出る 秒。 */
	bossAt: 60,
	hp: { nana: 4, are: 10, boss: 500 },
	/** 大きさ（当たりの 半分の 幅）。 */
	size: { nana: 5, are: 6, boss: 11 },
	kill: { nana: 100, are: 200, boss: 5000 },
	grazeScore: 10,
	secScore: 10,
	lifeBonus: 1000,
} as const;

/** 板の 字。 */
export const DM_TEXT = {
	nana: "名",
	are: "荒",
	boss: "主",
	bossName: "スレ主",
	lives: "残機",
	graze: "かすり",
	warn: "スレ主降臨",
} as const;

export type DmKind = "nana" | "are" | "boss";
export type DmFoe = {
	kind: DmKind;
	x: number;
	y: number;
	vx: number;
	vy: number;
	hp: number;
	/** 出てからの 秒・次に 撃つまでの 秒・止まる 高さ・らせんの 角度。 */
	t: number;
	fireT: number;
	fire2T: number;
	stopY: number;
	ang: number;
	/** 当たって 光る のこり 秒。 */
	flash: number;
};
export type DmBullet = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** 色（0 名無し・1 荒らし・2〜 スレ主）。 */
	c: number;
	grazed: boolean;
};
export type DmState = {
	t: number;
	x: number;
	y: number;
	/** タップした ところ（そこまで 動く）。 */
	goal: readonly [number, number] | null;
	lives: number;
	invuln: number;
	shotT: number;
	shots: { x: number; y: number }[];
	foes: DmFoe[];
	bullets: DmBullet[];
	spawnT: number;
	bossOut: boolean;
	grazes: number;
	kills: number;
	points: number;
	/** 生きのびた 秒（点に した ぶん）。 */
	secs: number;
	over: boolean;
	clear: boolean;
};
export type DmEvent =
	| "shot"
	| "hit"
	| "kill"
	| "graze"
	| "hurt"
	| "boss"
	| "clear"
	| "over";

export const dmStart = (): DmState => ({
	t: 0,
	x: (DM.left + DM.right) / 2,
	y: DM.bottom - 14,
	goal: null,
	lives: DM.lives,
	invuln: 0,
	shotT: 0,
	shots: [],
	foes: [],
	bullets: [],
	spawnT: 1,
	bossOut: false,
	grazes: 0,
	kills: 0,
	points: 0,
	secs: 0,
	over: false,
	clear: false,
});

export const dmScore = (s: DmState): number => s.points;

/** スレ主（いれば）。 */
export const dmBoss = (s: DmState): DmFoe | undefined =>
	s.foes.find((f) => f.kind === "boss");

export const dmFoe = (
	kind: DmKind,
	x: number,
	y: number,
	stopY: number,
): DmFoe => ({
	kind,
	x,
	y,
	vx: 0,
	vy: kind === "boss" ? 30 : 45,
	hp: DM.hp[kind],
	t: 0,
	fireT: kind === "boss" ? 1.2 : 0.6,
	fire2T: 1.5,
	stopY,
	ang: 0,
	flash: 0,
});

const fire = (
	s: DmState,
	x: number,
	y: number,
	a: number,
	sp: number,
	c: number,
): void => {
	if (s.bullets.length >= DM.maxBullets) return;
	s.bullets.push({
		x,
		y,
		vx: Math.cos(a) * sp,
		vy: Math.sin(a) * sp,
		c,
		grazed: false,
	});
};

/** まわり ぜんぶへ n 発。 */
const radial = (
	s: DmState,
	f: DmFoe,
	n: number,
	sp: number,
	off: number,
	c: number,
): void => {
	for (let i = 0; i < n; i++)
		fire(s, f.x, f.y, off + (i * Math.PI * 2) / n, sp, c);
};

/** キリコへ むけて n 発（spread ずつ ひらく）。 */
const aimed = (
	s: DmState,
	f: DmFoe,
	n: number,
	spread: number,
	sp: number,
	c: number,
): void => {
	const a = Math.atan2(s.y - f.y, s.x - f.x);
	for (let i = 0; i < n; i++)
		fire(s, f.x, f.y, a + (i - (n - 1) / 2) * spread, sp, c);
};

/** 敵ごとの 撃ち方。 */
const shoot = (s: DmState, f: DmFoe, dt: number, rnd: Rnd): void => {
	f.fireT -= dt;
	f.fire2T -= dt;
	if (f.kind === "nana") {
		if (f.fireT <= 0) {
			f.fireT = 1.4;
			aimed(s, f, 3, 0.28, 55, 0);
		}
		return;
	}
	if (f.kind === "are") {
		if (f.fireT <= 0) {
			f.fireT = 1.8;
			radial(s, f, 10, 45, rnd() * Math.PI, 1);
		}
		return;
	}
	// スレ主：のこりの 体力で 3つの 段
	if (f.y < f.stopY) return;
	const left = f.hp / DM.hp.boss;
	if (left > 2 / 3) {
		if (f.fireT <= 0) {
			f.fireT = 0.07;
			f.ang += 0.23;
			radial(s, f, 2, 50, f.ang, 2);
		}
		if (f.fire2T <= 0) {
			f.fire2T = 1.6;
			aimed(s, f, 1, 0, 75, 3);
		}
	} else if (left > 1 / 3) {
		if (f.fireT <= 0) {
			f.fireT = 0.9;
			radial(s, f, 18, 48, rnd() * Math.PI, 4);
		}
		if (f.fire2T <= 0) {
			f.fire2T = 0.6;
			aimed(s, f, 3, 0.18, 70, 3);
		}
	} else {
		if (f.fireT <= 0) {
			f.fireT = 0.08;
			f.ang -= 0.17;
			radial(s, f, 3, 55, f.ang, 2);
		}
		if (f.fire2T <= 0) {
			f.fire2T = 1.2;
			aimed(s, f, 5, 0.2, 65, 3);
		}
	}
};

/** 雑魚を 1つ 出す。 */
const spawn = (s: DmState, rnd: Rnd): void => {
	const kind: DmKind = rnd() < 0.25 + s.t / 120 ? "are" : "nana";
	const x = DM.left + 16 + rnd() * (DM.right - DM.left - 32);
	const f = dmFoe(kind, x, DM.top - 8, DM.top + 16 + rnd() * 34);
	f.vx = (rnd() - 0.5) * 16;
	s.foes.push(f);
};

const moveFoe = (f: DmFoe, dt: number): void => {
	f.t += dt;
	f.flash = Math.max(0, f.flash - dt);
	if (f.kind === "boss") {
		if (f.y < f.stopY) f.y = Math.min(f.stopY, f.y + f.vy * dt);
		else f.x = (DM.left + DM.right) / 2 + Math.sin((f.t - 2) * 0.6) * 40;
		return;
	}
	// 降りて きて 止まり、5秒 いると 下へ 去る
	if (f.t > 6) f.vy = 50;
	else if (f.y >= f.stopY) f.vy = 0;
	f.x += f.vx * dt;
	f.y += f.vy * dt;
	if (f.x < DM.left + 6 || f.x > DM.right - 6) f.vx = -f.vx;
};

const hurt = (s: DmState, ev: DmEvent[]): void => {
	s.lives--;
	s.invuln = DM.invuln;
	s.bullets = [];
	ev.push("hurt");
	if (s.lives <= 0) {
		s.over = true;
		ev.push("over");
	}
};

export const dmStep = (
	s: DmState,
	dt: number,
	input: { dx: number; dy: number },
	rnd: Rnd,
): DmEvent[] => {
	const ev: DmEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	s.invuln = Math.max(0, s.invuln - dt);
	// 生きのびた 秒
	while (s.secs + 1 <= s.t) {
		s.secs++;
		s.points += DM.secScore;
	}
	// 動く（十字キーが タップより 先）
	let mx = input.dx;
	let my = input.dy;
	if (mx || my) s.goal = null;
	else if (s.goal) {
		const gx = s.goal[0] - s.x;
		const gy = s.goal[1] - s.y;
		const d = Math.hypot(gx, gy);
		if (d <= DM.speed * dt) {
			s.x = s.goal[0];
			s.y = s.goal[1];
			s.goal = null;
		} else {
			mx = gx / d;
			my = gy / d;
		}
	}
	const n = Math.hypot(mx, my);
	if (n > 0) {
		s.x += (mx / n) * DM.speed * dt;
		s.y += (my / n) * DM.speed * dt;
	}
	s.x = Math.max(DM.left + 4, Math.min(DM.right - 4, s.x));
	s.y = Math.max(DM.top + 24, Math.min(DM.bottom - 5, s.y));
	// 撃つ（2列）
	s.shotT -= dt;
	if (s.shotT <= 0) {
		s.shotT += DM.shotEvery;
		s.shots.push({ x: s.x - 3, y: s.y - 6 }, { x: s.x + 3, y: s.y - 6 });
		ev.push("shot");
	}
	for (const p of s.shots) p.y -= DM.shotSpeed * dt;
	// 雑魚と スレ主を 出す
	s.spawnT -= dt;
	if (s.spawnT <= 0 && s.t < DM.spawnUntil) {
		spawn(s, rnd);
		s.spawnT = Math.max(DM.spawnMin, DM.spawn0 - s.t * 0.015);
	}
	if (!s.bossOut && s.t >= DM.bossAt) {
		s.bossOut = true;
		s.foes.push(
			dmFoe("boss", (DM.left + DM.right) / 2, DM.top - 14, DM.top + 28),
		);
		ev.push("boss");
	}
	// 敵
	for (const f of s.foes) {
		moveFoe(f, dt);
		if (f.y > DM.top) shoot(s, f, dt, rnd);
	}
	// 撃った 弾が 敵に 当たる
	s.shots = s.shots.filter((p) => {
		if (p.y < DM.top - 4) return false;
		for (const f of s.foes) {
			const w = DM.size[f.kind];
			if (f.hp <= 0 || f.y < DM.top) continue;
			if (Math.abs(p.x - f.x) <= w + 1 && Math.abs(p.y - f.y) <= w + 3) {
				f.hp--;
				f.flash = 0.06;
				ev.push("hit");
				return false;
			}
		}
		return true;
	});
	for (const f of s.foes) {
		if (f.hp > 0) continue;
		s.kills++;
		s.points += DM.kill[f.kind];
		ev.push("kill");
		if (f.kind === "boss") {
			s.points += s.lives * DM.lifeBonus;
			s.bullets = [];
			s.clear = true;
			s.over = true;
			ev.push("clear");
		}
	}
	s.foes = s.foes.filter((f) => f.hp > 0 && f.y < DM.bottom + 12);
	if (s.over) return ev;
	// 敵の 弾
	const hitR = DM.bulletR + DM.hitR;
	const grazeR = DM.bulletR + DM.graze;
	for (const b of s.bullets) {
		b.x += b.vx * dt;
		b.y += b.vy * dt;
	}
	s.bullets = s.bullets.filter(
		(b) =>
			b.x > DM.left - 6 &&
			b.x < DM.right + 6 &&
			b.y > DM.top - 10 &&
			b.y < DM.bottom + 6,
	);
	for (const b of s.bullets) {
		const d = Math.hypot(b.x - s.x, b.y - s.y);
		if (d < hitR && s.invuln <= 0) {
			hurt(s, ev);
			break;
		}
		if (d < grazeR && !b.grazed && s.invuln <= 0) {
			b.grazed = true;
			s.grazes++;
			s.points += DM.grazeScore;
			ev.push("graze");
		}
	}
	// 敵に ぶつかっても 当たり
	if (!s.over && s.invuln <= 0)
		for (const f of s.foes)
			if (
				f.y > DM.top &&
				Math.abs(f.x - s.x) < DM.size[f.kind] &&
				Math.abs(f.y - s.y) < DM.size[f.kind]
			) {
				hurt(s, ev);
				break;
			}
	return ev;
};
