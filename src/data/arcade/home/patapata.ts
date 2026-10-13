// キリコの 家の ゲーム「ぱたぱたぷゆゆ」（patapata）の 決まり。板は ui/arcade/home/patapata.ts、文は data/arcade/text.ts。
// - 押すと ぷゆゆが はばたいて 上へ。はなすと 下へ。はじめの 1回で 動きだす。
// - 右から 来る スレの 柱の すきまを くぐる。くぐるたびに 1点。すきまは だんだん せまく、柱は すこし 速く なる。
// - ときどき すきまに ぷゆゆの 顔の 玉が あり、取ると 1点。
// - 柱か 地面に ふれると おわり（天井は ぶつかるだけ）。おわりに 点で メダル（銅・銀・金・白金）。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import { AH, ATOP, AW, type Rnd } from "../logic";

export const PP = {
	/** ぷゆゆの 横の 位置と 当たりの 半径。 */
	x: 64,
	r: 5,
	/** 重さ（px／秒²）・はばたき（上向きの 速さ）・いちばん 速く 下る 速さ。 */
	gravity: 430,
	flap: 138,
	maxFall: 230,
	/** 地面の 高さ（下からの px）。 */
	ground: 10,
	/** 柱の 幅・間（px）・はじめの 速さ・1本 ごとに ふえる 速さ・いちばん 速い とき。 */
	pillarW: 22,
	spacing: 96,
	speed: 62,
	speedUp: 0.7,
	speedMax: 92,
	/** すきま（はじめ・1本 ごとに 縮む・いちばん せまい）と となりとの ずれの 上限。 */
	gap: 60,
	gapDown: 0.8,
	gapMin: 38,
	shift: 46,
	/** 玉の 出る 割合。 */
	coin: 0.3,
	/** メダルの 点（銅・銀・金・白金）。 */
	medals: [10, 20, 35, 50],
	/** ふれてから おわるまでの 秒。 */
	fallTime: 0.7,
} as const;

/** 板の 字。 */
export const PP_TEXT = {
	start: "押すと　とびたつ",
	medals: ["銅", "銀", "金", "白金"],
	medal: "メダル",
} as const;

export type PpPillar = {
	/** 何本目か（見た目の 種）。 */
	id: number;
	/** 左の はし。 */
	x: number;
	/** すきまの まんなかと 高さ。 */
	gapY: number;
	gap: number;
	passed: boolean;
	/** ぷゆゆの 顔の 玉（取ったら null）。 */
	coin: { y: number } | null;
};
export type PpState = {
	t: number;
	y: number;
	vy: number;
	/** はばたいてからの 秒（つぶれる 見た目）。 */
	flapT: number;
	started: boolean;
	/** すすんだ 道のり（背景）。 */
	dist: number;
	pillars: PpPillar[];
	passed: number;
	coins: number;
	/** ふれてからの 秒（地面へ 下って いく あいだ）。 */
	hit: number;
	over: boolean;
};
export type PpEvent = "flap" | "pass" | "coin" | "hit" | "ceil";

const floorY = (): number => AH - PP.ground;

export const ppStart = (): PpState => ({
	t: 0,
	y: ATOP + (AH - ATOP) / 2,
	vy: 0,
	flapT: 1,
	started: false,
	dist: 0,
	pillars: [],
	passed: 0,
	coins: 0,
	hit: 0,
	over: false,
});

export const ppScore = (s: PpState): number => s.passed + s.coins;
/** メダル（-1 なし・0 銅〜3 白金）。 */
export const ppMedal = (score: number): number => {
	let m = -1;
	PP.medals.forEach((n, i) => {
		if (score >= n) m = i;
	});
	return m;
};
export const ppSpeed = (s: PpState): number =>
	Math.min(PP.speedMax, PP.speed + s.passed * PP.speedUp);

/** つぎの 柱（n 本目の すきまの 高さ）。 */
const addPillar = (s: PpState, x: number, rnd: Rnd): void => {
	const n = s.passed + s.pillars.length;
	const gap = Math.max(PP.gapMin, PP.gap - n * PP.gapDown);
	const lo = ATOP + 10 + gap / 2;
	const hi = floorY() - 8 - gap / 2;
	const prev = s.pillars[s.pillars.length - 1]?.gapY ?? (lo + hi) / 2;
	const a = Math.max(lo, prev - PP.shift);
	const b = Math.min(hi, prev + PP.shift);
	const gapY = Math.round(a + rnd() * (b - a));
	s.pillars.push({
		id: n,
		x,
		gapY,
		gap,
		passed: false,
		coin:
			rnd() < PP.coin
				? { y: Math.round(gapY + (rnd() - 0.5) * (gap - 18)) }
				: null,
	});
};

const hitPillar = (s: PpState, p: PpPillar): boolean => {
	const r = PP.r - 1;
	if (PP.x + r <= p.x || PP.x - r >= p.x + PP.pillarW) return false;
	return s.y - r < p.gapY - p.gap / 2 || s.y + r > p.gapY + p.gap / 2;
};

export const ppStep = (
	s: PpState,
	dt: number,
	input: { flap: boolean },
	rnd: Rnd,
): PpEvent[] => {
	const ev: PpEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	s.flapT += dt;
	if (s.hit > 0) {
		// ふれた あとは 地面まで 下る
		s.hit += dt;
		s.vy = Math.min(PP.maxFall, s.vy + PP.gravity * dt);
		s.y = Math.min(floorY() - PP.r, s.y + s.vy * dt);
		if (s.hit >= PP.fallTime) s.over = true;
		return ev;
	}
	if (!s.started) {
		s.y = ATOP + (AH - ATOP) / 2 + Math.sin(s.t * 5) * 3;
		s.dist += 30 * dt;
		if (!input.flap) return ev;
		s.started = true;
		addPillar(s, AW + 20, rnd);
	}
	if (input.flap) {
		s.vy = -PP.flap;
		s.flapT = 0;
		ev.push("flap");
	}
	s.vy = Math.min(PP.maxFall, s.vy + PP.gravity * dt);
	s.y += s.vy * dt;
	if (s.y - PP.r < ATOP) {
		s.y = ATOP + PP.r;
		s.vy = Math.max(0, s.vy);
		ev.push("ceil");
	}
	const v = ppSpeed(s);
	s.dist += v * dt;
	for (const p of s.pillars) p.x -= v * dt;
	const last = s.pillars[s.pillars.length - 1];
	if (last && last.x < AW + 20 - PP.spacing)
		addPillar(s, last.x + PP.spacing, rnd);
	s.pillars = s.pillars.filter((p) => p.x + PP.pillarW > -4);
	for (const p of s.pillars) {
		if (
			p.coin &&
			Math.abs(PP.x - (p.x + PP.pillarW / 2)) < PP.r + 4 &&
			Math.abs(s.y - p.coin.y) < PP.r + 4
		) {
			p.coin = null;
			s.coins++;
			ev.push("coin");
		}
		if (!p.passed && p.x + PP.pillarW < PP.x - PP.r) {
			p.passed = true;
			s.passed++;
			ev.push("pass");
		}
		if (hitPillar(s, p)) {
			s.hit = 0.001;
			s.vy = Math.max(s.vy, 0);
			ev.push("hit");
			return ev;
		}
	}
	if (s.y + PP.r >= floorY()) {
		s.y = floorY() - PP.r;
		s.hit = PP.fallTime;
		s.over = true;
		ev.push("hit");
	}
	return ev;
};
