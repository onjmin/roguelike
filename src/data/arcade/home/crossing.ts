// キリコの 家の ゲーム「道路わたり」（crossing）の 決まり。板は ui/arcade/home/crossing.ts、文は data/arcade/text.ts。
// - 下の 歩道から 1マスずつ 進む。車道は 車に ぶつかると アウト、川は 丸太に 乗らないと アウト。
// - いちばん 上は 次スレの 枠が 5つ。空いた 枠に 入ると 点が 入って 下に もどる（枠の ない ところや
//   うまった 枠には 入れない）。5つ うめると 周が 進み、車と 丸太が 速くなって 枠は 空に もどる。
// - 車道は 車線ごとに ふつう・トラック（長くて おそい）・暴走（短くて 速い）。川の 1本は ときどき 沈む 丸太。
// - 1回の わたりに 1つ、車道か 中洲に 安価（>>）が 置いてある。拾うと ボーナス。
// - 残機 3。1回の わたりには 時間の かぎりが ある（すぎると アウト）。
// - スコア＝はじめて 着いた 段×10＋枠 50×周＋のこり 秒×5＋安価 100＋5つ うめて 500×周。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import { AH, ATOP, AW, type Rnd } from "../logic";

export const CR = {
	/** 1マスの 大きさ（画素）。 */
	cell: 10,
	cols: 24,
	rows: 13,
	/** 段の 並び（上から）：g 次スレ・w 川・s 中洲・r 車道・b 歩道。 */
	layout: "gwwwwwsrrrrrb",
	/** 次スレの 枠の 列。 */
	slots: [2, 7, 12, 16, 21] as readonly number[],
	lives: 3,
	/** 1回の わたりの 秒。 */
	time: 30,
	/** アウトの あと 止まる 秒。 */
	deadTime: 0.9,
	/** 周ごとに 速くなる 割合。 */
	speedUp: 0.18,
	/** 画面の 外に はみだす 幅（マス）。 */
	margin: 4,
	/** 沈む 丸太の 1回りの 秒と、沈んでいる 割合・沈みかけ（点滅）の 割合。 */
	sinkCycle: 4,
	sunk: 0.25,
	sinking: 0.15,
} as const;

/** 板の 字。 */
export const CR_TEXT = {
	goal: "次スレ",
	lap: "周",
	bonus: ">>",
	full: "5スレ 完走！",
} as const;

export type CrKind = "g" | "w" | "s" | "r" | "b";
export type CrItem = { x: number; w: number; tone: number };
/** 車線の 種類（車道：ふつう・トラック・暴走。川：ふつう・沈む）。 */
export type CrLaneType = "car" | "truck" | "racer" | "log" | "sink";
export type CrLane = {
	y: number;
	kind: CrKind;
	type: CrLaneType | null;
	speed: number;
	/** 沈む 丸太の ずれ（0〜1）。 */
	phase: number;
	items: CrItem[];
};
export type CrPop = { x: number; y: number; text: string; t: number };
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
	/** 次スレの 枠の うまり。 */
	filled: boolean[];
	/** その わたりの 安価（拾ったら null）。 */
	bonus: { x: number; y: number } | null;
	lives: number;
	points: number;
	pops: CrPop[];
	/** アウトの あとの 止まり（0 で 動ける）。 */
	deadT: number;
	over: boolean;
};
export type CrEvent =
	| "hop"
	| "row"
	| "goal"
	| "full"
	| "bonus"
	| "blocked"
	| "crash"
	| "splash"
	| "timeout";

const span = (): number => CR.cols + CR.margin * 2;

const shuffle = <T>(xs: T[], rnd: Rnd): T[] => {
	for (let i = xs.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[xs[i], xs[j]] = [xs[j], xs[i]];
	}
	return xs;
};

const makeLanes = (rnd: Rnd, lap: number): CrLane[] => {
	const k = 1 + lap * CR.speedUp;
	const layout = [...CR.layout];
	// 車道の 種類（暴走は 2周めから）と 沈む 丸太の 川
	const roads = layout.flatMap((c, y) => (c === "r" ? [y] : []));
	const roadTypes = shuffle(
		roads.map(
			(_, i): CrLaneType =>
				i === 0 ? "truck" : i === 1 && lap > 0 ? "racer" : "car",
		),
		rnd,
	);
	const rivers = layout.flatMap((c, y) => (c === "w" ? [y] : []));
	const sinkY = rivers[1 + Math.floor(rnd() * (rivers.length - 1))];
	return layout.map((c, y) => {
		const kind = c as CrKind;
		const items: CrItem[] = [];
		let speed = 0;
		let type: CrLaneType | null = null;
		if (kind === "r" || kind === "w") {
			const dir = y % 2 === 0 ? 1 : -1;
			type =
				kind === "r"
					? roadTypes[roads.indexOf(y)]
					: y === sinkY
						? "sink"
						: "log";
			const base =
				type === "truck"
					? 1 + rnd() * 0.6
					: type === "racer"
						? 4 + rnd() * 1.2
						: type === "car"
							? 1.6 + rnd() * 1.8
							: 1 + rnd() * 1.2;
			speed = dir * base * k;
			const n =
				type === "truck"
					? 2
					: type === "racer"
						? 2
						: type === "car"
							? 3 + Math.floor(rnd() * 2)
							: 3;
			const gap = span() / n;
			for (let i = 0; i < n; i++) {
				const w =
					type === "truck"
						? 4
						: type === "racer"
							? 2
							: type === "car"
								? rnd() < 0.3
									? 3
									: 2
								: 4 + Math.floor(rnd() * 3);
				items.push({
					x: -CR.margin + i * gap + rnd() * (gap - w) * 0.5,
					w,
					tone: Math.floor(rnd() * 4),
				});
			}
		}
		return { y, kind, type, speed, phase: rnd(), items };
	});
};

/** 沈む 丸太の いまの ようす（0 浮いている・1 沈みかけ・2 沈んでいる）。 */
export const crSink = (s: CrState, l: CrLane): 0 | 1 | 2 => {
	if (l.type !== "sink") return 0;
	const p = (s.t / CR.sinkCycle + l.phase) % 1;
	return p < CR.sunk ? 2 : p < CR.sunk + CR.sinking ? 1 : 0;
};

/** 安価を 置く（車道か 中洲の どこか）。 */
const placeBonus = (s: CrState, rnd: Rnd): void => {
	const rows = s.lanes.filter((l) => l.kind === "r" || l.kind === "s");
	const l = rows[Math.floor(rnd() * rows.length)];
	s.bonus = l ? { x: 1 + Math.floor(rnd() * (CR.cols - 2)), y: l.y } : null;
};

const home = (s: CrState, rnd: Rnd): void => {
	s.px = Math.floor(CR.cols / 2);
	s.py = CR.rows - 1;
	s.best = s.py;
	s.lapT = 0;
	if (!s.bonus) placeBonus(s, rnd);
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
		filled: CR.slots.map(() => false),
		bonus: null,
		lives: CR.lives,
		points: 0,
		pops: [],
		deadT: 0,
		over: false,
	};
	home(s, rnd);
	return s;
};

export const crTimeLeft = (s: CrState): number =>
	Math.max(0, Math.ceil(CR.time - s.lapT));
export const crScore = (s: CrState): number => s.points;

/** その 段の 物と x（マス）が 重なるか（幅 lo〜hi。沈んだ 丸太は 数えない）。 */
const touching = (s: CrState, l: CrLane, lo: number, hi: number): boolean =>
	crSink(s, l) !== 2 && l.items.some((it) => it.x < hi && it.x + it.w > lo);

const out = (s: CrState, why: CrEvent, ev: CrEvent[]): void => {
	ev.push(why);
	s.lives--;
	s.deadT = CR.deadTime;
	if (s.lives <= 0) s.over = true;
};

const pop = (s: CrState, x: number, y: number, text: string): void => {
	s.pops.push({ x, y, text, t: 0 });
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
	for (const p of s.pops) p.t += dt;
	s.pops = s.pops.filter((p) => p.t < 1);
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
		if (s.deadT <= 0) home(s, rnd);
		return ev;
	}
	s.lapT += dt;
	if (s.lapT >= CR.time) {
		out(s, "timeout", ev);
		return ev;
	}
	// 1マス 進む（次スレの 段へは 空いた 枠の ところだけ）
	if (input.dx || input.dy) {
		const nx = s.px + Math.sign(input.dx);
		const ny = s.py + (input.dx ? 0 : Math.sign(input.dy));
		const slot = CR.slots.findIndex((c) => Math.abs(c - nx) <= 0.5);
		if (ny === 0 && s.lanes[0].kind === "g" && (slot < 0 || s.filled[slot]))
			ev.push("blocked");
		else if (nx >= 0 && nx <= CR.cols - 1 && ny >= 0 && ny <= CR.rows - 1) {
			s.px = ny === 0 && slot >= 0 ? CR.slots[slot] : nx;
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
	const b = s.bonus;
	if (b && b.y === s.py && Math.abs(b.x - s.px) < 0.6) {
		s.points += 100;
		pop(s, b.x, b.y, "+100");
		s.bonus = null;
		ev.push("bonus");
	}
	const lane = s.lanes[s.py];
	if (lane.kind === "g") {
		const slot = CR.slots.indexOf(Math.round(s.px));
		if (slot >= 0) s.filled[slot] = true;
		const pts = 50 * (s.lap + 1) + crTimeLeft(s) * 5;
		s.points += pts;
		pop(s, s.px, 0, `+${pts}`);
		ev.push("goal");
		if (s.filled.every(Boolean)) {
			s.points += 500 * (s.lap + 1);
			pop(s, CR.cols / 2, 2, CR_TEXT.full);
			s.lap++;
			s.filled = CR.slots.map(() => false);
			s.lanes = makeLanes(rnd, s.lap);
			ev.push("full");
		}
		s.bonus = null;
		home(s, rnd);
		return ev;
	}
	if (lane.kind === "r" && touching(s, lane, s.px + 0.15, s.px + 0.85)) {
		out(s, "crash", ev);
		return ev;
	}
	if (lane.kind === "w") {
		// 丸太の 上に 足（まんなか）が なければ 川に 入る
		if (!touching(s, lane, s.px + 0.45, s.px + 0.55)) {
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
