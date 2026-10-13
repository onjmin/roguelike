// キリコの 家の ゲーム「道路わたり」（crossing）の 決まり。板は ui/arcade/home/crossing.ts、文は data/arcade/text.ts。
// - 下の 歩道から 1マスずつ 進む。車道は 車に ぶつかると アウト、川は 丸太に 乗らないと アウト。
// - いちばん 上（次スレ）に 着くと 点が 入り、下に もどって 車と 丸太が 速くなる。
// - 残機 3。1回の わたりには 時間の かぎりが ある（すぎると アウト）。
// - スコア＝はじめて 着いた 段×10＋わたりきって 100×周＋のこり 秒×5。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import { AH, ATOP, AW, type Rnd } from "../logic";

export const CR = {
	/** 1マスの 大きさ（画素）。 */
	cell: 10,
	cols: 24,
	rows: 13,
	/** 段の 並び（上から）：g 次スレ・w 川・s 中洲・r 車道・b 歩道。 */
	layout: "gwwwwwsrrrrrb",
	lives: 3,
	/** 1回の わたりの 秒。 */
	time: 40,
	/** アウトの あと 止まる 秒。 */
	deadTime: 0.9,
	/** 周ごとに 速くなる 割合。 */
	speedUp: 0.18,
	/** 画面の 外に はみだす 幅（マス）。 */
	margin: 4,
} as const;

/** 板の 字。 */
export const CR_TEXT = {
	goal: "次スレ",
	lap: "周",
} as const;

export type CrKind = "g" | "w" | "s" | "r" | "b";
export type CrItem = { x: number; w: number; tone: number };
export type CrLane = {
	y: number;
	kind: CrKind;
	speed: number;
	items: CrItem[];
};
export type CrState = {
	t: number;
	/** その わたりの 経った 秒。 */
	lapT: number;
	lanes: CrLane[];
	/** キリコの マス（x は 丸太で ずれるので 小数）。 */
	px: number;
	py: number;
	/** その わたりで いちばん 上まで 来た 段。 */
	best: number;
	lap: number;
	lives: number;
	points: number;
	/** アウトの あとの 止まり（0 で 動ける）。 */
	deadT: number;
	over: boolean;
};
export type CrEvent = "hop" | "row" | "goal" | "crash" | "splash" | "timeout";

const span = (): number => CR.cols + CR.margin * 2;

const makeLanes = (rnd: Rnd, lap: number): CrLane[] => {
	const k = 1 + lap * CR.speedUp;
	return [...CR.layout].map((c, y) => {
		const kind = c as CrKind;
		const items: CrItem[] = [];
		let speed = 0;
		if (kind === "r" || kind === "w") {
			const dir = y % 2 === 0 ? 1 : -1;
			speed = dir * (kind === "r" ? 1.4 + rnd() * 2.2 : 1 + rnd() * 1.2) * k;
			const n = kind === "r" ? 3 + Math.floor(rnd() * 2) : 3;
			const gap = span() / n;
			for (let i = 0; i < n; i++) {
				const w =
					kind === "r" ? (rnd() < 0.3 ? 3 : 2) : 4 + Math.floor(rnd() * 3);
				items.push({
					x: -CR.margin + i * gap + rnd() * (gap - w) * 0.5,
					w,
					tone: Math.floor(rnd() * 4),
				});
			}
		}
		return { y, kind, speed, items };
	});
};

const home = (s: CrState): void => {
	s.px = Math.floor(CR.cols / 2);
	s.py = CR.rows - 1;
	s.best = s.py;
	s.lapT = 0;
};

export const crStart = (rnd: Rnd): CrState => {
	const s: CrState = {
		t: 0,
		lapT: 0,
		lanes: makeLanes(rnd, 0),
		px: 0,
		py: 0,
		best: 0,
		lap: 0,
		lives: CR.lives,
		points: 0,
		deadT: 0,
		over: false,
	};
	home(s);
	return s;
};

export const crTimeLeft = (s: CrState): number =>
	Math.max(0, Math.ceil(CR.time - s.lapT));
export const crScore = (s: CrState): number => s.points;

/** その 段の 物と x（マス）が 重なるか（幅 lo〜hi）。 */
const touching = (l: CrLane, lo: number, hi: number): boolean =>
	l.items.some((it) => it.x < hi && it.x + it.w > lo);

const out = (s: CrState, why: CrEvent, ev: CrEvent[]): void => {
	ev.push(why);
	s.lives--;
	s.deadT = CR.deadTime;
	if (s.lives <= 0) s.over = true;
};

export const crStep = (
	s: CrState,
	dt: number,
	input: { dx: number; dy: number },
	rnd: Rnd,
): CrEvent[] => {
	const ev: CrEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	// 車と 丸太（画面の 外へ 出たら 反対の はしへ）
	const L = span();
	for (const l of s.lanes)
		for (const it of l.items) {
			it.x += l.speed * dt;
			if (it.x >= CR.cols + CR.margin) it.x -= L;
			else if (it.x < -CR.margin) it.x += L;
		}
	if (s.deadT > 0) {
		s.deadT -= dt;
		if (s.deadT <= 0) home(s);
		return ev;
	}
	s.lapT += dt;
	if (s.lapT >= CR.time) {
		out(s, "timeout", ev);
		return ev;
	}
	// 1マス 進む
	if (input.dx || input.dy) {
		const nx = s.px + Math.sign(input.dx);
		const ny = s.py + (input.dx ? 0 : Math.sign(input.dy));
		if (nx >= 0 && nx <= CR.cols - 1 && ny >= 0 && ny <= CR.rows - 1) {
			s.px = nx;
			s.py = ny;
			// 川の 外では マスに そろえる
			if (s.lanes[ny].kind !== "w") s.px = Math.round(s.px);
			ev.push("hop");
			if (ny < s.best) {
				s.points += (s.best - ny) * 10;
				s.best = ny;
				ev.push("row");
			}
		}
	}
	const lane = s.lanes[s.py];
	if (lane.kind === "g") {
		s.points += 100 * (s.lap + 1) + crTimeLeft(s) * 5;
		s.lap++;
		s.lanes = makeLanes(rnd, s.lap);
		home(s);
		ev.push("goal");
		return ev;
	}
	if (lane.kind === "r" && touching(lane, s.px + 0.15, s.px + 0.85)) {
		out(s, "crash", ev);
		return ev;
	}
	if (lane.kind === "w") {
		// 丸太の 上に 足（まんなか）が なければ 川に 入る
		if (!touching(lane, s.px + 0.45, s.px + 0.55)) {
			out(s, "splash", ev);
			return ev;
		}
		s.px += lane.speed * dt;
		if (s.px < -0.4 || s.px > CR.cols - 0.6) {
			out(s, "splash", ev);
			return ev;
		}
	}
	return ev;
};

/** 盤の 左上（画面の 画素。帯の 下に まんなか ぞろえ）。 */
export const crOrigin = (): readonly [number, number] => [
	Math.floor((AW - CR.cols * CR.cell) / 2),
	ATOP + Math.floor((AH - ATOP - CR.rows * CR.cell) / 2),
];
