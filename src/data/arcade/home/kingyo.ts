// キリコの 家の 遊べる 家具「バケツ」の 金魚すくい（板は ui/arcade/home/kingyo.ts）。
// 上から 見た たらいに 金魚が 泳ぐ。ポイ（丸）を 動かして すくう と、少し 水に つけてから 丸の 中に 中心が ある 金魚を とる。
// 紙は すくう たびに 弱り、とった 金魚が 大きいほど 弱る。0 で 破れて おわり。60秒でも おわり。
// 赤い 金魚・黒い 出目金・まれに でかい 金魚。ポイが 近づくと 少し 逃げる。
// スコア＝金魚の 点（赤 10・出目金 25・でかい 100。でかいほど 紙を 食う）。1回で 2匹 なら ×2、3匹 なら ×3
// （群れを 待って まとめて すくうと 大きい）。
// DOM に 触らない（試験できる）。

import { AH, ATOP, AW, type Rnd } from "../logic";

export const KG = {
	time: 60,
	/** はじめの 金魚の 数（へったら 足す）。 */
	fish: 10,
	paper: 100,
	/** 1回 すくう だけで へる 紙。 */
	dipCost: 6,
	/** 水に つけて いる 秒（おわりに とる）。 */
	dip: 0.3,
	poiR: 12,
	poiSpeed: 95,
	/** 逃げはじめる 近さ（画素）。 */
	fleeR: 28,
	/** たらい（水の ある ところ）。 */
	left: 14,
	right: AW - 14,
	top: ATOP + 6,
	bottom: AH - 6,
} as const;

export type KgKind = "red" | "black" | "big";
export const KG_KIND: Record<
	KgKind,
	{ r: number; speed: number; cost: number; pts: number }
> = {
	red: { r: 3, speed: 22, cost: 9, pts: 10 },
	black: { r: 4, speed: 18, cost: 14, pts: 25 },
	big: { r: 7, speed: 14, cost: 34, pts: 100 },
};

export const KINGYO_TEXT = {
	torn: "ポイが　破れた",
	timeUp: "TIME UP",
	paper: "紙",
	note: "十字キーで　動く。A か　ポイを　タップで　すくう",
	/** 1回で 何匹も すくった とき（{n} は 匹）。 */
	multi: "{n}匹　まとめて！",
	/** 紙が 薄く なった。 */
	thin: "紙が　ふやけてきた",
} as const;

export type KgFish = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	kind: KgKind;
	/** つぎに 向きを かえるまでの 秒。 */
	turn: number;
};
export type KgState = {
	t: number;
	px: number;
	py: number;
	paper: number;
	/** 水に つけて いる のこりの 秒（0 なら 上げて いる）。 */
	dipping: number;
	fish: KgFish[];
	caught: number;
	/** 点。 */
	pts: number;
	/** さいごに すくった 所と 点・匹（見た目の 字）。 */
	lastScoop: { x: number; y: number; pts: number; n: number } | null;
	/** 種類ごとの とった 数（板の 表示）。 */
	got: Record<KgKind, number>;
	torn: boolean;
	over: boolean;
};
export type KgInput = {
	dx: number;
	dy: number;
	target: readonly [number, number] | null;
	scoop: boolean;
};
export type KgEvent = "dip" | "catch" | "bigCatch" | "empty" | "torn" | "time";

const clamp = (v: number, lo: number, hi: number) =>
	Math.max(lo, Math.min(hi, v));

const newFish = (rnd: Rnd, kind: KgKind): KgFish => {
	const a = rnd() * Math.PI * 2;
	const sp = KG_KIND[kind].speed;
	return {
		x: KG.left + 10 + rnd() * (KG.right - KG.left - 20),
		y: KG.top + 10 + rnd() * (KG.bottom - KG.top - 20),
		vx: Math.cos(a) * sp,
		vy: Math.sin(a) * sp,
		kind,
		turn: 0.5 + rnd() * 1.5,
	};
};

const pickKind = (rnd: Rnd): KgKind => {
	const r = rnd();
	return r < 0.06 ? "big" : r < 0.3 ? "black" : "red";
};

export const kgStart = (rnd: Rnd): KgState => ({
	t: 0,
	px: AW / 2,
	py: (KG.top + KG.bottom) / 2,
	paper: KG.paper,
	dipping: 0,
	fish: Array.from({ length: KG.fish }, () => newFish(rnd, pickKind(rnd))),
	caught: 0,
	pts: 0,
	lastScoop: null,
	got: { red: 0, black: 0, big: 0 },
	torn: false,
	over: false,
});

export const kgScore = (s: KgState): number => s.pts;
export const kgTimeLeft = (s: KgState): number =>
	Math.max(0, Math.ceil(KG.time - s.t));

/** 丸の 中に 中心が ある 金魚を とる（紙が もたない 金魚で 破れる）。 */
const scoop = (s: KgState, ev: KgEvent[]): void => {
	s.paper -= KG.dipCost;
	const inside = s.fish.filter(
		(f) => (f.x - s.px) ** 2 + (f.y - s.py) ** 2 <= KG.poiR ** 2,
	);
	let n = 0;
	let base = 0;
	for (const f of inside) {
		if (s.paper <= KG_KIND[f.kind].cost) {
			s.paper = 0;
			break;
		}
		s.paper -= KG_KIND[f.kind].cost;
		s.fish = s.fish.filter((x) => x !== f);
		s.caught++;
		s.got[f.kind]++;
		n++;
		base += KG_KIND[f.kind].pts;
		ev.push(f.kind === "big" ? "bigCatch" : "catch");
	}
	// 破れても その 前に すくえた ぶんは 点に なる
	if (n > 0) {
		s.pts += base * n;
		s.lastScoop = { x: s.px, y: s.py, pts: base * n, n };
	}
	if (s.paper <= 0) {
		s.paper = 0;
		s.torn = true;
		s.over = true;
		ev.push("torn");
	} else if (!ev.includes("catch") && !ev.includes("bigCatch"))
		ev.push("empty");
};

export const kgStep = (
	s: KgState,
	dt: number,
	ip: KgInput,
	rnd: Rnd,
): KgEvent[] => {
	const ev: KgEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	if (s.t >= KG.time) {
		s.over = true;
		ev.push("time");
		return ev;
	}
	// ポイ（水に つけて いる あいだは 動かない）
	if (s.dipping > 0) {
		s.dipping -= dt;
		if (s.dipping <= 0) {
			s.dipping = 0;
			scoop(s, ev);
			if (s.over) return ev;
		}
	} else {
		const step = KG.poiSpeed * dt;
		if (ip.dx !== 0 || ip.dy !== 0) {
			const n = Math.hypot(ip.dx, ip.dy);
			s.px += (ip.dx / n) * step;
			s.py += (ip.dy / n) * step;
		} else if (ip.target) {
			const ax = ip.target[0] - s.px;
			const ay = ip.target[1] - s.py;
			const d = Math.hypot(ax, ay);
			if (d > 0.5) {
				const k = Math.min(1, step / d);
				s.px += ax * k;
				s.py += ay * k;
			}
		}
		s.px = clamp(s.px, KG.left, KG.right);
		s.py = clamp(s.py, KG.top, KG.bottom);
		if (ip.scoop) {
			s.dipping = KG.dip;
			ev.push("dip");
		}
	}
	// 金魚（ふらふら 泳ぎ、ポイが 近いと 逃げる）
	for (const f of s.fish) {
		const k = KG_KIND[f.kind];
		f.turn -= dt;
		if (f.turn <= 0) {
			f.turn = 0.6 + rnd() * 1.6;
			const a = Math.atan2(f.vy, f.vx) + (rnd() - 0.5) * 2;
			f.vx = Math.cos(a) * k.speed;
			f.vy = Math.sin(a) * k.speed;
		}
		let mx = f.vx;
		let my = f.vy;
		const ax = f.x - s.px;
		const ay = f.y - s.py;
		const d = Math.hypot(ax, ay);
		if (d < KG.fleeR && d > 0.01) {
			const push = (1 - d / KG.fleeR) * k.speed * 1.6;
			mx += (ax / d) * push;
			my += (ay / d) * push;
		}
		f.x += mx * dt;
		f.y += my * dt;
		if (f.x < KG.left + k.r || f.x > KG.right - k.r) f.vx = -f.vx;
		if (f.y < KG.top + k.r || f.y > KG.bottom - k.r) f.vy = -f.vy;
		f.x = clamp(f.x, KG.left + k.r, KG.right - k.r);
		f.y = clamp(f.y, KG.top + k.r, KG.bottom - k.r);
	}
	// へったら はしから 足す
	if (s.fish.length < KG.fish - 3) {
		const f = newFish(rnd, pickKind(rnd));
		f.x = rnd() < 0.5 ? KG.left + 4 : KG.right - 4;
		s.fish.push(f);
	}
	return ev;
};
