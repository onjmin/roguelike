// キリコの 家の ゲーム「保守ピンボール」（pinball）の 決まり。板は ui/arcade/home/pinball.ts、文は data/arcade/text.ts。
// - たての 台（板の まんなか、はば 112px）。2ch の 板が 題材。球は 右下から ひとりでに 打ちだされる。
// - 左右の フリッパーで はじく。フリッパーの あいだから 下へ ぬけると 1球 うしなう。3球で おわり。
// - 点：「保守」（まんなかの 大きな バンパー）100、「age」「sage」（小さな バンパー）50、
//   「安価」（左の 的 3枚）200、3枚 そろうと「スレ立て」で 1000。上の「次スレ」レーンを 下から くぐると 500。
// - 動きは 決まった 細かい 刻み（1/240秒）で 回し、速さに 上限を つけて、壁を すりぬけない ように する。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import { AH, type Rnd } from "../logic";

export const PB = {
	/** 球の 半径。 */
	r: 3,
	/** 重さ（画素／秒²）と 速さの 上限。 */
	gravity: 300,
	maxSpeed: 420,
	/** 1刻みの 秒。 */
	sub: 1 / 240,
	balls: 3,
	/** 次の 球までの 秒。 */
	launchWait: 0.9,
	/** 台の 左右の 壁。 */
	left: 64,
	right: 176,
	/** フリッパー（長さ・太さ・休む 角度・上げた 角度・上げる 速さ・もどす 速さ・軸）。 */
	flipLen: 18,
	flipThick: 2,
	flipRest: 0.5,
	flipUp: -0.45,
	flipUpSpeed: 20,
	flipDownSpeed: 12,
	pivotL: [98, 130] as const,
	pivotR: [142, 130] as const,
	/** バンパー（0 が「保守」、1 が「age」、2 が「sage」）。 */
	bumpers: [
		{ x: 120, y: 68, r: 7, label: "保守", score: 100 },
		{ x: 96, y: 54, r: 4, label: "age", score: 50 },
		{ x: 144, y: 54, r: 4, label: "sage", score: 50 },
	],
	/** 「次スレ」レーンの 柱と、くぐる 線の 高さ。上の ふたは PB_WALLS の さいご。 */
	posts: [
		{ x: 106, y: 36, r: 3 },
		{ x: 134, y: 36, r: 3 },
	],
	laneY: 36,
	/** 「安価」の 的（左の 壁の 前。上の y・下の y）。 */
	ankaX: 67,
	anka: [
		[56, 64],
		[68, 76],
		[80, 88],
	] as const,
	ankaScore: 200,
	/** 3枚 そろった ときの「スレ立て」。 */
	tateScore: 1000,
	laneScore: 500,
	/** バンパーが はじく 強さ。 */
	kick: 180,
	/** 動かない まま この 秒 たつと 軽く ゆらす（はまりよけ）。 */
	stuck: 4,
} as const;

/** 板の 字。 */
export const PB_TEXT = {
	balls: "球",
	anka: "安価",
	lane: "次スレ",
	laneMsg: "次スレ　+500",
	tate: "スレ立て！　+1000",
	lost: "のがした",
} as const;

type Seg = readonly [number, number, number, number];

/** 壁（線分）。 */
export const PB_WALLS: readonly Seg[] = [
	// 上の 角と 上
	[PB.left, 40, 88, 16],
	[88, 16, 152, 16],
	[152, 16, PB.right, 40],
	// 左右
	[PB.left, 40, PB.left, 112],
	[PB.right, 40, PB.right, 112],
	// フリッパーへ 流れる 坂
	[PB.left, 112, PB.pivotL[0], PB.pivotL[1]],
	[PB.right, 112, PB.pivotR[0], PB.pivotR[1]],
	// 「次スレ」レーンの ふた
	[100, 28, 140, 28],
];

export type PbState = {
	t: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** のこりの 球（いま 動いている 球を ふくむ）。 */
	balls: number;
	/** 次の 球までの 秒（0 なら 動いている）。 */
	wait: number;
	/** フリッパーの 角度（左・右。大きいほど 下）。 */
	fl: number;
	fr: number;
	/** 「安価」の 的の 点灯。 */
	lit: boolean[];
	points: number;
	/** 光らせる のこり 秒（バンパー 3つ・的 3枚）。 */
	flash: number[];
	/** 出す 字と のこり 秒。 */
	msg: string;
	msgT: number;
	laneCd: number;
	stillT: number;
	over: boolean;
};
export type PbEvent =
	| "flip"
	| "hoshu"
	| "age"
	| "anka"
	| "tate"
	| "lane"
	| "wall"
	| "launch"
	| "drain"
	| "over";

export const pbStart = (): PbState => ({
	t: 0,
	x: 0,
	y: 0,
	vx: 0,
	vy: 0,
	balls: PB.balls,
	wait: 0.3,
	fl: PB.flipRest,
	fr: PB.flipRest,
	lit: [false, false, false],
	points: 0,
	flash: [0, 0, 0, 0, 0, 0],
	msg: "",
	msgT: 0,
	laneCd: 0,
	stillT: 0,
	over: false,
});

export const pbScore = (s: PbState): number => s.points;

/** フリッパーの 軸と 先（左は 右下へ、右は 左下へ のびる）。 */
export const pbFlipper = (
	side: "l" | "r",
	a: number,
): readonly [number, number, number, number] => {
	const [px, py] = side === "l" ? PB.pivotL : PB.pivotR;
	const dx = Math.cos(a) * PB.flipLen * (side === "l" ? 1 : -1);
	return [px, py, px + dx, py + Math.sin(a) * PB.flipLen];
};

/** 線分の いちばん 近い 点（と 線分の 上の 割合）。 */
const closest = (
	x: number,
	y: number,
	[ax, ay, bx, by]: Seg,
): readonly [number, number, number] => {
	const dx = bx - ax;
	const dy = by - ay;
	const L = dx * dx + dy * dy;
	const u = L
		? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L))
		: 0;
	return [ax + dx * u, ay + dy * u, u];
};

/** 点 (qx,qy) から 半径 rad の 中に 球が あれば 押しだして はね返す（sx・sy は ぶつかった 面の 速さ）。 */
const bounce = (
	s: PbState,
	qx: number,
	qy: number,
	rad: number,
	e: number,
	sx = 0,
	sy = 0,
): boolean => {
	const dx = s.x - qx;
	const dy = s.y - qy;
	const d = Math.hypot(dx, dy);
	if (d >= rad) return false;
	const nx = d > 1e-6 ? dx / d : 0;
	const ny = d > 1e-6 ? dy / d : -1;
	s.x = qx + nx * rad;
	s.y = qy + ny * rad;
	const rx = s.vx - sx;
	const ry = s.vy - sy;
	const vn = rx * nx + ry * ny;
	if (vn < 0) {
		s.vx = rx - (1 + e) * vn * nx + sx;
		s.vy = ry - (1 + e) * vn * ny + sy;
	}
	return true;
};

const say = (s: PbState, msg: string, sec: number): void => {
	s.msg = msg;
	s.msgT = sec;
};

const launch = (s: PbState, rnd: Rnd): void => {
	s.x = PB.right - 8;
	s.y = 104;
	s.vx = -20 - rnd() * 30;
	s.vy = -300 - rnd() * 60;
	s.stillT = 0;
};

/** 1刻み 動かす。 */
const sub = (
	s: PbState,
	h: number,
	input: { left: boolean; right: boolean },
	ev: PbEvent[],
): void => {
	// フリッパー
	const turn = (a: number, up: boolean): number =>
		up
			? Math.max(PB.flipUp, a - PB.flipUpSpeed * h)
			: Math.min(PB.flipRest, a + PB.flipDownSpeed * h);
	const fl = turn(s.fl, input.left);
	const fr = turn(s.fr, input.right);
	const wl = (fl - s.fl) / h;
	const wr = (fr - s.fr) / h;
	s.fl = fl;
	s.fr = fr;
	if (s.wait > 0) return;
	// 球
	const py = s.y;
	s.vy += PB.gravity * h;
	s.x += s.vx * h;
	s.y += s.vy * h;
	for (const w of PB_WALLS) {
		const [qx, qy] = closest(s.x, s.y, w);
		if (bounce(s, qx, qy, PB.r, 0.45) && Math.hypot(s.vx, s.vy) > 120)
			ev.push("wall");
	}
	for (const p of PB.posts) bounce(s, p.x, p.y, p.r + PB.r, 0.5);
	// 「安価」の 的
	PB.anka.forEach(([y0, y1], i) => {
		const [qx, qy] = closest(s.x, s.y, [PB.ankaX, y0, PB.ankaX, y1]);
		if (!bounce(s, qx, qy, PB.r + 1, 0.6)) return;
		if (s.flash[3 + i] > 0) return;
		s.flash[3 + i] = 0.3;
		s.points += PB.ankaScore;
		ev.push("anka");
		s.lit[i] = true;
		if (s.lit.every(Boolean)) {
			s.points += PB.tateScore;
			say(s, PB_TEXT.tate, 1.5);
			s.lit = [false, false, false];
			ev.push("tate");
		}
	});
	// バンパー（はじく）
	PB.bumpers.forEach((b, i) => {
		if (!bounce(s, b.x, b.y, b.r + PB.r, 0.8)) return;
		const d = Math.hypot(s.x - b.x, s.y - b.y) || 1;
		s.vx += ((s.x - b.x) / d) * PB.kick;
		s.vy += ((s.y - b.y) / d) * PB.kick;
		if (s.flash[i] > 0.1) return;
		s.flash[i] = 0.2;
		s.points += b.score;
		ev.push(i === 0 ? "hoshu" : "age");
	});
	// フリッパー（動く 面の 速さを 足す）
	for (const [side, a, w] of [
		["l", fl, wl],
		["r", fr, wr],
	] as const) {
		const seg = pbFlipper(side, a);
		const [qx, qy, u] = closest(s.x, s.y, seg);
		const d = u * PB.flipLen;
		const sx = side === "l" ? -Math.sin(a) * w * d : Math.sin(a) * w * d;
		const sy = Math.cos(a) * w * d;
		bounce(s, qx, qy, PB.r + PB.flipThick, 0.3, sx, sy);
	}
	// 速さの 上限
	const sp = Math.hypot(s.vx, s.vy);
	if (sp > PB.maxSpeed) {
		s.vx *= PB.maxSpeed / sp;
		s.vy *= PB.maxSpeed / sp;
	}
	// 「次スレ」レーンを 下から くぐる
	if (
		s.laneCd <= 0 &&
		py > PB.laneY &&
		s.y <= PB.laneY &&
		s.x > PB.posts[0].x &&
		s.x < PB.posts[1].x
	) {
		s.points += PB.laneScore;
		s.laneCd = 1;
		say(s, PB_TEXT.laneMsg, 1.2);
		ev.push("lane");
	}
	// 下へ ぬけた
	if (s.y > AH + PB.r * 2) {
		s.balls--;
		ev.push("drain");
		if (s.balls <= 0) {
			s.over = true;
			ev.push("over");
		} else {
			s.wait = PB.launchWait;
			say(s, PB_TEXT.lost, 0.9);
		}
	}
};

export const pbStep = (
	s: PbState,
	dt: number,
	input: { left: boolean; right: boolean },
	rnd: Rnd,
): PbEvent[] => {
	const ev: PbEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	s.msgT = Math.max(0, s.msgT - dt);
	s.laneCd = Math.max(0, s.laneCd - dt);
	s.flash = s.flash.map((v) => Math.max(0, v - dt));
	if (input.left && s.fl >= PB.flipRest) ev.push("flip");
	else if (input.right && s.fr >= PB.flipRest) ev.push("flip");
	if (s.wait > 0) {
		s.wait -= dt;
		if (s.wait <= 0) {
			s.wait = 0;
			launch(s, rnd);
			ev.push("launch");
		}
	}
	const n = Math.max(1, Math.round(dt / PB.sub));
	for (let i = 0; i < n && !s.over; i++) sub(s, dt / n, input, ev);
	// はまりよけ（ほとんど 動かない まま）
	if (s.wait <= 0 && !s.over) {
		const held = input.left || input.right;
		s.stillT = Math.hypot(s.vx, s.vy) < 15 && !held ? s.stillT + dt : 0;
		if (s.stillT > PB.stuck) {
			s.vx += (rnd() - 0.5) * 160;
			s.vy -= 120;
			s.stillT = 0;
		}
	}
	return ev;
};
