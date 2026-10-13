// キリコの 家の ゲーム「ダーツ」（darts）の 決まり。板は ui/arcade/home/darts.ts、文は data/arcade/text.ts。
// - 301 の シングルアウト：301 から 当てた 点を 引いて ちょうど 0 に したら あがり。0 を こえたら バースト
//   （その ラウンドの はじめの 点に もどって 次の ラウンド）。1ラウンド 3本、10ラウンドまで。
// - 的は ふつうの 並び（上が 20、右まわり）。外の 細い 輪が ダブル（2倍）、内の 細い 輪が トリプル（3倍）、
//   まんなかの 外ブルが 25、内ブルが 50。
// - ねらいは ゆれる 照準：はじめは 横に ゆれる → 止める → 縦に ゆれる → 止める → 少し ぶれて 刺さる。
// - 点：あがったら 1000 − 使った ラウンド × 50（100 より 下に しない）。あがれなければ 301 − のこり。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import type { Rnd } from "../logic";

/** 的の 数字（上から 右まわり）。 */
export const DT_ORDER = [
	20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const;

export const DT = {
	/** 的の まんなか。 */
	cx: 82,
	cy: 82,
	/** 輪の 半径（内ブル・外ブル・トリプルの 内と 外・ダブルの 内と 外）。数字は その 外。 */
	bull: 2.5,
	outer: 6,
	tripleIn: 31,
	tripleOut: 35,
	doubleIn: 52,
	doubleOut: 57,
	/** 照準が ゆれる はば と 1往復の 秒（横・縦）。 */
	sway: 60,
	periodX: 1.7,
	periodY: 1.45,
	/** 刺さる ときの ぶれ（画素）。 */
	wobble: 2.4,
	/** 飛ぶ 秒・刺さって 見せる 秒・ラウンドの あいだの 秒。 */
	fly: 0.25,
	show: 0.55,
	between: 1.1,
	start: 301,
	darts: 3,
	rounds: 10,
} as const;

/** 板の 字。 */
export const DT_TEXT = {
	round: "R",
	left: "のこり",
	aim: "ねらい",
	bust: "バースト！",
	finish: "あがり！",
	out: "はずれ",
	nextRound: "ラウンド {n}",
	bull: "BULL",
	none: "ー",
} as const;

export type DtHit = {
	/** 的の まんなかからの ずれ。 */
	x: number;
	y: number;
	pts: number;
	label: string;
};

export type DtState = {
	t: number;
	phase: "x" | "y" | "fly" | "show" | "between";
	/** 照準（的の まんなかからの ずれ）。 */
	ax: number;
	ay: number;
	/** ゆれの 時計（止めた 向きは 進まない）。 */
	tx: number;
	ty: number;
	/** 飛んでいる 矢の 行き先と のこり 秒。 */
	fx: number;
	fy: number;
	timer: number;
	remain: number;
	/** ラウンドの はじめの のこり（バーストで もどす）。 */
	roundStart: number;
	round: number;
	/** この ラウンドで 投げた 矢。 */
	hits: DtHit[];
	bust: boolean;
	finished: boolean;
	over: boolean;
};

export type DtEvent =
	| "stopX"
	| "throw"
	| "hit"
	| "out"
	| "bust"
	| "finish"
	| "round"
	| "over";

/** 的の 上の 点を 点に する（x・y は まんなかからの ずれ）。 */
export const dtScoreAt = (
	x: number,
	y: number,
): { pts: number; label: string } => {
	const d = Math.hypot(x, y);
	if (d <= DT.bull) return { pts: 50, label: DT_TEXT.bull };
	if (d <= DT.outer) return { pts: 25, label: "25" };
	if (d > DT.doubleOut) return { pts: 0, label: DT_TEXT.out };
	// 上が 0 度で 右まわり
	const deg = ((Math.atan2(x, -y) * 180) / Math.PI + 360 + 9) % 360;
	const n = DT_ORDER[Math.floor(deg / 18) % 20] as number;
	if (d >= DT.doubleIn) return { pts: n * 2, label: `D${n}` };
	if (d >= DT.tripleIn && d <= DT.tripleOut)
		return { pts: n * 3, label: `T${n}` };
	return { pts: n, label: `S${n}` };
};

/** 1本で ちょうど n に できる ねらい（なければ null）。 */
const oneDart = (n: number): string | null => {
	if (n <= 0) return null;
	if (n <= 20) return `S${n}`;
	if (n === 25) return "25";
	if (n === 50) return DT_TEXT.bull;
	if (n % 2 === 0 && n <= 40) return `D${n / 2}`;
	if (n % 3 === 0 && n <= 60) return `T${n / 3}`;
	return null;
};

/** 1本目に ねらう 順（大きい ものから）。 */
const FIRST: readonly { pts: number; label: string }[] = [
	...Array.from({ length: 20 }, (_, i) => ({
		pts: (20 - i) * 3,
		label: `T${20 - i}`,
	})),
	{ pts: 50, label: DT_TEXT.bull },
	...Array.from({ length: 20 }, (_, i) => ({
		pts: (20 - i) * 2,
		label: `D${20 - i}`,
	})),
	{ pts: 25, label: "25" },
	...Array.from({ length: 20 }, (_, i) => ({
		pts: 20 - i,
		label: `S${20 - i}`,
	})),
];

/** あがりの 道すじ（のこりの 本数で。なければ 大きく 減らす T20）。 */
export const dtCheckout = (n: number, darts: number): string[] => {
	const one = oneDart(n);
	if (one) return [one];
	if (darts >= 2)
		for (const f of FIRST) {
			const second = oneDart(n - f.pts);
			if (second) return [f.label, second];
		}
	if (darts >= 3)
		for (const f of FIRST)
			for (const g of FIRST) {
				const third = oneDart(n - f.pts - g.pts);
				if (third) return [f.label, g.label, third];
			}
	return ["T20"];
};

export const dtStart = (): DtState => ({
	t: 0,
	phase: "x",
	ax: 0,
	ay: 0,
	tx: 0,
	ty: 0,
	fx: 0,
	fy: 0,
	timer: 0,
	remain: DT.start,
	roundStart: DT.start,
	round: 1,
	hits: [],
	bust: false,
	finished: false,
	over: false,
});

export const dtScore = (s: DtState): number =>
	s.finished ? Math.max(100, 1000 - s.round * 50) : DT.start - s.remain;

/** 矢が 刺さった（x・y は まんなかからの ずれ）。点を 引いて あがり・バーストを 見る。 */
export const dtLand = (s: DtState, x: number, y: number): DtEvent[] => {
	const ev: DtEvent[] = [];
	const { pts, label } = dtScoreAt(x, y);
	s.hits.push({ x, y, pts, label });
	ev.push(pts > 0 ? "hit" : "out");
	const next = s.remain - pts;
	if (next < 0) {
		s.bust = true;
		s.remain = s.roundStart;
		ev.push("bust");
	} else {
		s.remain = next;
		if (next === 0) {
			s.finished = true;
			ev.push("finish");
		}
	}
	s.phase = "show";
	s.timer = DT.show;
	return ev;
};

const sway = (t: number, period: number): number =>
	Math.sin((t / period) * Math.PI * 2) * DT.sway;

/** 次の 矢（ゆれの はじめを ずらす）。 */
const nextDart = (s: DtState, rnd: Rnd): void => {
	s.phase = "x";
	s.tx = rnd() * DT.periodX;
	s.ty = rnd() < 0.5 ? 0 : DT.periodY / 2;
	s.ax = sway(s.tx, DT.periodX);
	s.ay = 0;
};

export const dtStep = (
	s: DtState,
	dt: number,
	press: boolean,
	rnd: Rnd,
): DtEvent[] => {
	const ev: DtEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	if (s.phase === "x") {
		s.tx += dt;
		s.ax = sway(s.tx, DT.periodX);
		s.ay = 0;
		if (press) {
			s.phase = "y";
			ev.push("stopX");
		}
	} else if (s.phase === "y") {
		s.ty += dt;
		s.ay = sway(s.ty, DT.periodY);
		if (press) {
			s.phase = "fly";
			s.timer = DT.fly;
			s.fx = s.ax + (rnd() + rnd() - 1) * DT.wobble;
			s.fy = s.ay + (rnd() + rnd() - 1) * DT.wobble;
			ev.push("throw");
		}
	} else if (s.phase === "fly") {
		s.timer -= dt;
		if (s.timer <= 0) ev.push(...dtLand(s, s.fx, s.fy));
	} else if (s.phase === "show") {
		s.timer -= dt;
		if (s.timer > 0) return ev;
		if (s.finished) {
			s.over = true;
			ev.push("over");
		} else if (s.bust || s.hits.length >= DT.darts) {
			if (s.round >= DT.rounds) {
				s.over = true;
				ev.push("over");
			} else {
				s.phase = "between";
				s.timer = DT.between;
			}
		} else nextDart(s, rnd);
	} else {
		s.timer -= dt;
		if (s.timer <= 0) {
			s.round++;
			s.roundStart = s.remain;
			s.hits = [];
			s.bust = false;
			nextDart(s, rnd);
			ev.push("round");
		}
	}
	return ev;
};
