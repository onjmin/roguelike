// キリコの 家の ゲーム「ナインボール」（nineball）の 決まり。板は ui/arcade/home/nineball.ts、文は data/arcade/text.ts。
// - 上から 見た ビリヤード台（板の 左に 大きく）。手玉（0）と 1〜9 の 球。ひし形に 組んで 1番が 先頭、9番が まんなか。
// - いちばん 小さい 番号の 球に 先に 当てる。正しく 当てた 打ちで 沈めた 球は 1つ 100点、9番は 500点で ラックを とる。
// - ファウル（先に ほかの 球に 当てる・どれにも 当てない・手玉を 沈める）は 点なし。手玉は ヘッドスポットに もどる。
//   ファウルで 9番を 沈めたら フットスポットに もどす。
// - 1ラック 15打まで。ラックを とると のこりの 打数 × 50点。3ラック とるか、打数が つきたら おわり。
// - 動きは 決まった 細かい 刻み（1/240秒）。球どうしは 同じ 重さの はね返り、クッションで はね返り、まさつで とまる。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import type { Rnd } from "../logic";

export const NB = {
	/** 球の 半径。 */
	r: 3,
	/** ラシャ（球が 動ける 面）の はし。 */
	left: 12,
	right: 196,
	top: 26,
	bottom: 138,
	/** 1刻みの 秒。 */
	sub: 1 / 240,
	/** まさつ（画素／秒²）と 速さに 比べた 減り（1／秒）。 */
	friction: 60,
	drag: 0.35,
	/** クッションと 球どうしの はね返り。 */
	cushion: 0.72,
	restitution: 0.94,
	/** 打つ 速さ（いちばん 弱い・強い）。 */
	minSpeed: 50,
	maxSpeed: 430,
	/** 力の 目もりが 0→1→0 と 往復する 秒。 */
	powerPeriod: 1.6,
	shots: 15,
	racks: 3,
	potPts: 100,
	ninePts: 500,
	leftPts: 50,
} as const;

/** ポケット（中心と 半径）。四すみと 長い 辺の まんなか。 */
export const NB_POCKETS: readonly { x: number; y: number; r: number }[] = [
	{ x: NB.left, y: NB.top, r: 7 },
	{ x: NB.right, y: NB.top, r: 7 },
	{ x: NB.left, y: NB.bottom, r: 7 },
	{ x: NB.right, y: NB.bottom, r: 7 },
	{ x: (NB.left + NB.right) / 2, y: NB.top - 1, r: 6.5 },
	{ x: (NB.left + NB.right) / 2, y: NB.bottom + 1, r: 6.5 },
];

/** ヘッドスポット（手玉）と フットスポット（ラックの 先頭）。 */
export const NB_HEAD = [NB.left + (NB.right - NB.left) * 0.25, 82] as const;
export const NB_FOOT = [NB.left + (NB.right - NB.left) * 0.72, 82] as const;

/** 板の 字。 */
export const NB_TEXT = {
	rack: "ラック",
	shots: "打",
	shoot: "打つ",
	power: "力",
	foul: "ファウル　手玉は　もどる",
	scratch: "手玉が　沈んだ　ファウル",
	noHit: "どれにも　当たらない　ファウル",
	wrong: "{n}番から　当てる　ファウル",
	nine: "9番　イン！　ラックを　とった",
	next: "次の　ラック",
	none: "沈まなかった",
	pot: "{n}球　イン",
	out: "打数が　つきた",
} as const;

export type NbBall = {
	n: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	in: boolean;
};

export type NbState = {
	/** 0 が 手玉、1〜9 が 番号の 球（ならびは 番号どおり）。 */
	balls: NbBall[];
	phase: "aim" | "power" | "roll";
	/** ねらう 向き（ラジアン。0 が 右）。 */
	aim: number;
	/** 力（0〜1）と その 往復の 秒。 */
	power: number;
	powT: number;
	/** いまの ラック（0 から）と のこりの 打数。 */
	rack: number;
	shotsLeft: number;
	points: number;
	/** いまの 打ちで はじめに 当てた 球・沈めた 球・打つ 前の いちばん 小さい 番号。 */
	firstHit: number | null;
	potted: number[];
	lowest: number;
	msg: string;
	msgT: number;
	over: boolean;
	cleared: boolean;
};

export type NbEvent =
	| "power"
	| "shot"
	| "clack"
	| "cushion"
	| "pocket"
	| "foul"
	| "legal"
	| "nine"
	| "rack"
	| "over";

export type NbInput = {
	/** 向きを 回す 量（ラジアン）。 */
	rot: number;
	/** その 点へ 向ける（タップ）。 */
	aimAt: readonly [number, number] | null;
	/** 力を ためはじめる／打つ。 */
	press: boolean;
};

const ball = (n: number, x: number, y: number): NbBall => ({
	n,
	x,
	y,
	vx: 0,
	vy: 0,
	in: false,
});

/** ひし形に 組む（1番が 先頭、9番が まんなか、ほかは まぜる）。 */
const rackBalls = (rnd: Rnd): NbBall[] => {
	const rest = [2, 3, 4, 5, 6, 7, 8];
	for (let i = rest.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1)) % (i + 1);
		[rest[i], rest[j]] = [rest[j] as number, rest[i] as number];
	}
	const d = NB.r * 2 + 0.3;
	const rows = [1, 2, 3, 2, 1];
	const spots: [number, number][] = [];
	rows.forEach((cnt, i) => {
		for (let k = 0; k < cnt; k++)
			spots.push([
				NB_FOOT[0] + i * d * 0.87,
				NB_FOOT[1] + (k - (cnt - 1) / 2) * d,
			]);
	});
	// 0 番目（先頭）は 1、4 番目（まんなかの 列の まんなか）は 9
	const order = spots.map((_, i) =>
		i === 0 ? 1 : i === 4 ? 9 : (rest.shift() as number),
	);
	const out: NbBall[] = [ball(0, NB_HEAD[0], NB_HEAD[1])];
	for (let n = 1; n <= 9; n++) {
		const i = order.indexOf(n);
		const [x, y] = spots[i] as [number, number];
		out.push(ball(n, x, y));
	}
	return out;
};

export const nbStart = (rnd: Rnd): NbState => ({
	balls: rackBalls(rnd),
	phase: "aim",
	aim: 0,
	power: 0,
	powT: 0,
	rack: 0,
	shotsLeft: NB.shots,
	points: 0,
	firstHit: null,
	potted: [],
	lowest: 1,
	msg: "",
	msgT: 0,
	over: false,
	cleared: false,
});

export const nbScore = (s: NbState): number => s.points;

/** 台の 上で いちばん 小さい 番号（なければ 0）。 */
export const nbLowest = (s: NbState): number =>
	s.balls.find((b) => b.n > 0 && !b.in)?.n ?? 0;

const say = (s: NbState, msg: string, sec = 1.6): void => {
	s.msg = msg;
	s.msgT = sec;
};

/** 力の 往復（0→1→0）。 */
const tri = (t: number): number => {
	const k = (t / NB.powerPeriod) % 1;
	return k < 0.5 ? k * 2 : 2 - k * 2;
};

export type NbGuide = {
	/** 手玉が 止まる（当たる）点。 */
	x: number;
	y: number;
	/** 当たる 球（なければ クッション）。 */
	ball: number | null;
	/** 当たった 球が 進む 向き（単位）。 */
	nx: number;
	ny: number;
};

/** ねらいの 線（はじめに 当たる 球の ゴースト、または クッション）。 */
export const nbGuide = (s: NbState): NbGuide => {
	const c = s.balls[0] as NbBall;
	const ux = Math.cos(s.aim);
	const uy = Math.sin(s.aim);
	let best = Number.POSITIVE_INFINITY;
	let hit: NbBall | null = null;
	const R2 = (NB.r * 2) ** 2;
	for (const b of s.balls) {
		if (b.n === 0 || b.in) continue;
		const px = b.x - c.x;
		const py = b.y - c.y;
		const along = px * ux + py * uy;
		if (along <= 0) continue;
		const perp2 = px * px + py * py - along * along;
		if (perp2 >= R2) continue;
		const t = along - Math.sqrt(R2 - perp2);
		if (t > 0 && t < best) {
			best = t;
			hit = b;
		}
	}
	// クッション
	const wall = (lo: number, hi: number, p: number, u: number): number =>
		u > 1e-9
			? (hi - NB.r - p) / u
			: u < -1e-9
				? (lo + NB.r - p) / u
				: Number.POSITIVE_INFINITY;
	const tw = Math.min(
		wall(NB.left, NB.right, c.x, ux),
		wall(NB.top, NB.bottom, c.y, uy),
	);
	if (!hit || tw < best)
		return { x: c.x + ux * tw, y: c.y + uy * tw, ball: null, nx: 0, ny: 0 };
	const gx = c.x + ux * best;
	const gy = c.y + uy * best;
	const d = Math.hypot(hit.x - gx, hit.y - gy) || 1;
	return {
		x: gx,
		y: gy,
		ball: hit.n,
		nx: (hit.x - gx) / d,
		ny: (hit.y - gy) / d,
	};
};

/** 打つ（力 0〜1）。 */
export const nbShoot = (s: NbState, power: number): void => {
	const c = s.balls[0] as NbBall;
	const v =
		NB.minSpeed + (NB.maxSpeed - NB.minSpeed) * Math.max(0, Math.min(1, power));
	c.vx = Math.cos(s.aim) * v;
	c.vy = Math.sin(s.aim) * v;
	s.phase = "roll";
	s.firstHit = null;
	s.potted = [];
	s.lowest = nbLowest(s);
	s.shotsLeft--;
};

/** 空いている 所に 置く（(x,y) から 左右へ ずらして さがす）。 */
const place = (s: NbState, b: NbBall, x: number, y: number): void => {
	for (let k = 0; k < 60; k++) {
		const dx = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (NB.r * 2 + 0.5);
		const px = Math.max(NB.left + NB.r, Math.min(NB.right - NB.r, x + dx));
		const free = s.balls.every(
			(o) => o === b || o.in || Math.hypot(o.x - px, o.y - y) >= NB.r * 2 + 0.2,
		);
		if (free) {
			b.x = px;
			b.y = y;
			break;
		}
	}
	b.vx = 0;
	b.vy = 0;
	b.in = false;
};

/** 1刻み 動かす。 */
const sub = (s: NbState, h: number, ev: NbEvent[]): void => {
	for (const b of s.balls) {
		if (b.in) continue;
		const sp = Math.hypot(b.vx, b.vy);
		if (sp <= 0) continue;
		const ns = Math.max(0, sp - (NB.friction + sp * NB.drag) * h);
		const k = ns < 1 ? 0 : ns / sp;
		b.vx *= k;
		b.vy *= k;
		b.x += b.vx * h;
		b.y += b.vy * h;
	}
	// 球どうし
	const D = NB.r * 2;
	for (let i = 0; i < s.balls.length; i++) {
		const a = s.balls[i] as NbBall;
		if (a.in) continue;
		for (let j = i + 1; j < s.balls.length; j++) {
			const b = s.balls[j] as NbBall;
			if (b.in) continue;
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const d2 = dx * dx + dy * dy;
			if (d2 >= D * D || d2 < 1e-12) continue;
			const d = Math.sqrt(d2);
			const nx = dx / d;
			const ny = dy / d;
			const o = (D - d) / 2;
			a.x -= nx * o;
			a.y -= ny * o;
			b.x += nx * o;
			b.y += ny * o;
			const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
			if (rel <= 0) continue;
			const imp = ((1 + NB.restitution) / 2) * rel;
			a.vx -= imp * nx;
			a.vy -= imp * ny;
			b.vx += imp * nx;
			b.vy += imp * ny;
			if (a.n === 0 && s.firstHit === null) s.firstHit = b.n;
			if (rel > 20) ev.push("clack");
		}
	}
	for (const b of s.balls) {
		if (b.in) continue;
		// ポケット（クッションより 先に 見る）
		if (NB_POCKETS.some((p) => Math.hypot(b.x - p.x, b.y - p.y) < p.r)) {
			b.in = true;
			b.vx = 0;
			b.vy = 0;
			s.potted.push(b.n);
			ev.push("pocket");
			continue;
		}
		// クッション
		const hard = Math.hypot(b.vx, b.vy) > 40;
		if (b.x < NB.left + NB.r) {
			b.x = NB.left + NB.r;
			b.vx = Math.abs(b.vx) * NB.cushion;
			if (hard) ev.push("cushion");
		} else if (b.x > NB.right - NB.r) {
			b.x = NB.right - NB.r;
			b.vx = -Math.abs(b.vx) * NB.cushion;
			if (hard) ev.push("cushion");
		}
		if (b.y < NB.top + NB.r) {
			b.y = NB.top + NB.r;
			b.vy = Math.abs(b.vy) * NB.cushion;
			if (hard) ev.push("cushion");
		} else if (b.y > NB.bottom - NB.r) {
			b.y = NB.bottom - NB.r;
			b.vy = -Math.abs(b.vy) * NB.cushion;
			if (hard) ev.push("cushion");
		}
	}
};

/** 球が みな とまった あとの さばき。 */
const resolve = (s: NbState, rnd: Rnd, ev: NbEvent[]): void => {
	s.phase = "aim";
	const cue = s.balls[0] as NbBall;
	const scratch = cue.in;
	const foul = scratch || s.firstHit !== s.lowest;
	const nine = s.potted.includes(9);
	if (foul) {
		if (nine) {
			const b = s.balls[9] as NbBall;
			place(s, b, NB_FOOT[0], NB_FOOT[1]);
		}
		place(s, cue, NB_HEAD[0], NB_HEAD[1]);
		ev.push("foul");
		say(
			s,
			scratch
				? NB_TEXT.scratch
				: s.firstHit === null
					? NB_TEXT.noHit
					: NB_TEXT.wrong.replace("{n}", String(s.lowest)),
		);
	} else {
		const pots = s.potted.filter((n) => n !== 9 && n !== 0).length;
		s.points += pots * NB.potPts;
		if (pots > 0 || nine) ev.push("legal");
		if (nine) {
			s.points += NB.ninePts + s.shotsLeft * NB.leftPts;
			ev.push("nine", "rack");
			say(s, NB_TEXT.nine, 2);
			s.rack++;
			if (s.rack >= NB.racks) {
				s.over = true;
				s.cleared = true;
				ev.push("over");
				return;
			}
			s.balls = rackBalls(rnd);
			s.shotsLeft = NB.shots;
			s.aim = 0;
			return;
		}
		if (pots > 0) say(s, NB_TEXT.pot.replace("{n}", String(pots)), 1.2);
	}
	if (s.shotsLeft <= 0) {
		s.over = true;
		say(s, NB_TEXT.out, 2);
		ev.push("over");
	}
};

export const nbStep = (
	s: NbState,
	dt: number,
	inp: NbInput,
	rnd: Rnd,
): NbEvent[] => {
	const ev: NbEvent[] = [];
	if (s.over) return ev;
	s.msgT = Math.max(0, s.msgT - dt);
	if (s.phase === "aim") {
		s.aim += inp.rot;
		const c = s.balls[0] as NbBall;
		if (inp.aimAt) {
			const [x, y] = inp.aimAt;
			if (Math.hypot(x - c.x, y - c.y) > 1)
				s.aim = Math.atan2(y - c.y, x - c.x);
		}
		if (inp.press) {
			s.phase = "power";
			s.powT = 0;
			s.power = 0;
			ev.push("power");
		}
	} else if (s.phase === "power") {
		if (inp.aimAt) {
			// 台を タップしたら ためるのを やめて 向きを なおす
			s.phase = "aim";
			const c = s.balls[0] as NbBall;
			const [x, y] = inp.aimAt;
			if (Math.hypot(x - c.x, y - c.y) > 1)
				s.aim = Math.atan2(y - c.y, x - c.x);
			return ev;
		}
		s.powT += dt;
		s.power = tri(s.powT);
		if (inp.press) {
			nbShoot(s, s.power);
			ev.push("shot");
		}
	} else {
		const n = Math.max(1, Math.round(dt / NB.sub));
		for (let i = 0; i < n; i++) sub(s, dt / n, ev);
		if (s.balls.every((b) => b.in || (b.vx === 0 && b.vy === 0)))
			resolve(s, rnd, ev);
	}
	return ev;
};
