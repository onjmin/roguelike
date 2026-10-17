// キリコの 家の ゲーム「穴掘りキリコ」（digkiriko）の 決まり。板は ui/arcade/home/digkiriko.ts、文は data/arcade/text.ts。
// - 横から 見た 地面の 下。キリコが 動くと 土が 掘れて 穴に なる（深い ほど 土の 色が 濃い）。
// - 荒らしと 炎上は 穴を 歩く。ときどき 目だけに なって 土を すりぬけ、キリコへ 寄ってくる。
//   炎上は 同じ 段の 近くに キリコが いると 横へ 火を 吹く（火は 土も 通る）。
// - A で 向いて いる ほうへ ポンプを のばす。当たったら 押す たびに ふくらみ、4回で はじける
//   （深い 段ほど 点。横から はじけさせた 炎上は 倍）。しばらく 押さないと しぼむ。
// - 岩の 下を 掘ると 岩が ぐらついて 崩れる。下に いる 敵を つぶすと 大きい（キリコも つぶれる）。
// - 敵が いなく なれば 次の 面（敵と 岩が ふえる）。敵か 火に ふれると 1機 へる。3機 なくなると おわり。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import { AH, ATOP, AW, type Rnd } from "../logic";

export const DK = {
	cols: 28,
	rows: 16,
	/** 1マスの 大きさ（画素）。 */
	cell: 8,
	/** はじめの マスと 掘って ある 縦穴の 深さ。 */
	start: [14, 0] as const,
	shaft: 4,
	/** 1秒に すすむ マス（穴・土を 掘る とき）。 */
	walk: 4.6,
	dig: 3.4,
	/** 敵の 速さ（面 1・面 ごとに ふえる 分・上限）と 目だけの とき。 */
	foe: 2.1,
	foeUp: 0.15,
	foeMax: 3.6,
	ghost: 1.5,
	/** 目だけに なるまでの 秒（いちばん 短い・幅）と 目だけで いる いちばん 短い 秒。 */
	ghostIn: 6,
	ghostRand: 6,
	ghostMin: 2,
	/** ポンプの のびる 速さ（マス／秒）・長さ・はじける 回数・しぼむ 秒・押す 間。 */
	hoseSpeed: 14,
	hoseLen: 3,
	pops: 4,
	deflate: 0.8,
	pumpGap: 0.12,
	/** 火：ためる 秒・吹く 秒・とどく マス・近さ（マス）・つぎまでの 秒（いちばん 短い・幅）。 */
	fireWind: 0.6,
	fireBurn: 0.5,
	fireLen: 3,
	fireNear: 4,
	fireCd: 3,
	fireRand: 3,
	/** 岩：ぐらつく 秒・崩れる 速さ（マス／秒）・くだけて 消える 秒。 */
	wobble: 0.6,
	rockSpeed: 7,
	rockBreak: 0.5,
	/** 段（深さ）ごとの 点と、岩で つぶした 数ごとの 点。 */
	layerPts: [200, 300, 400, 500],
	crushPts: [0, 1000, 2500, 4000, 6000, 8000, 10000, 12000, 15000],
	lives: 3,
	dieTime: 1.5,
	clearTime: 1.6,
	readyTime: 0.8,
	/** 敵の 数（面 1 と 上限）と 岩の 数。 */
	foes: 4,
	foesMax: 8,
	rocks: 3,
	rocksMax: 6,
} as const;

/** 板の 字。 */
export const DK_TEXT = {
	arashi: "荒",
	enjo: "炎",
	round: "面",
	note: "A／キリコをタップでポンプ",
	crush: "崩れた！",
	next: "次の面へ",
} as const;

/** 向き：0 上・1 右・2 下・3 左。 */
export type DkDir = 0 | 1 | 2 | 3;
export const DK_DIRS: readonly (readonly [number, number])[] = [
	[0, -1],
	[1, 0],
	[0, 1],
	[-1, 0],
];

export type DkMover = { x: number; y: number; dir: DkDir; t: number };
export type DkFoe = DkMover & {
	kind: "arashi" | "enjo";
	/** 生まれた マス（やられた あとに 戻る）。 */
	sx: number;
	sy: number;
	/** 目だけの ときは 0 より 大きい（目に なってからの 秒）。 */
	ghost: number;
	ghostIn: number;
	/** ふくらみ（0〜4）と しぼむまでの 秒。 */
	inflate: number;
	deflateT: number;
	/** 火（ためる・吹く）。 */
	fire: { phase: "wind" | "burn"; t: number } | null;
	fireCd: number;
};
export type DkRock = {
	x: number;
	/** 崩れる あいだの 行（小数）。 */
	fy: number;
	state: "still" | "wobble" | "fall" | "break";
	t: number;
	/** つぶした 敵の 数。 */
	crushed: number;
};
export type DkHose = {
	dir: DkDir;
	len: number;
	/** つないだ 敵（いなければ null）。 */
	foe: DkFoe | null;
	/** のびきって 戻る までの 秒（はずれ）。 */
	miss: number;
};
export type DkPop = { x: number; y: number; text: string; t: number };
export type DkState = {
	t: number;
	round: number;
	lives: number;
	points: number;
	/** 掘った マス（いちばん 上の 行は 地上で、いつも 通れる）。 */
	dug: boolean[][];
	player: DkMover;
	/** 向いて いる ほう（ポンプを のばす）。 */
	face: DkDir;
	digging: boolean;
	hose: DkHose | null;
	pumpT: number;
	foes: DkFoe[];
	rocks: DkRock[];
	phase: "ready" | "play" | "die" | "clear";
	pause: number;
	pops: DkPop[];
	over: boolean;
};
export type DkEvent =
	| "dig"
	| "hose"
	| "hit"
	| "pump"
	| "pop"
	| "wobble"
	| "crumble"
	| "crush"
	| "fire"
	| "ghost"
	| "die"
	| "clear"
	| "round"
	| "over";

const inside = (x: number, y: number): boolean =>
	x >= 0 && y >= 0 && x < DK.cols && y < DK.rows;
/** 穴か 地上か。 */
export const dkOpen = (s: DkState, x: number, y: number): boolean =>
	inside(x, y) && (y === 0 || s.dug[y][x]);
/** 動かない 岩の ある マス。 */
export const dkRockAt = (s: DkState, x: number, y: number): boolean =>
	s.rocks.some(
		(r) =>
			(r.state === "still" || r.state === "wobble") && r.x === x && r.fy === y,
	);
/** 深さの 段（0〜3）。 */
export const dkLayer = (y: number): number =>
	y <= 3 ? 0 : y <= 7 ? 1 : y <= 11 ? 2 : 3;

export const dkPos = (m: DkMover): readonly [number, number] => {
	const [dx, dy] = DK_DIRS[m.dir];
	return [m.x + dx * m.t, m.y + dy * m.t];
};

const foeSpeed = (s: DkState): number =>
	Math.min(DK.foeMax, DK.foe + (s.round - 1) * DK.foeUp);

const resetPlaces = (s: DkState, rnd: Rnd): void => {
	s.player = { x: DK.start[0], y: DK.start[1], dir: 2, t: 0 };
	s.face = 2;
	s.hose = null;
	for (const f of s.foes) {
		f.x = f.sx;
		f.y = f.sy;
		f.t = 0;
		f.ghost = 0;
		f.ghostIn = DK.ghostIn + rnd() * DK.ghostRand;
		f.inflate = 0;
		f.fire = null;
		f.fireCd = DK.fireCd;
	}
	s.phase = "ready";
	s.pause = DK.readyTime;
};

/** 面を つくる（敵の 穴と 岩を 置く）。 */
const makeField = (s: DkState, rnd: Rnd): void => {
	s.dug = Array.from({ length: DK.rows }, () =>
		Array.from({ length: DK.cols }, () => false),
	);
	for (let y = 1; y <= DK.shaft; y++) s.dug[y][DK.start[0]] = true;
	const busy = (x: number, y: number): boolean => {
		for (let dy = -1; dy <= 1; dy++)
			for (let dx = -1; dx <= 1; dx++)
				if (inside(x + dx, y + dy) && s.dug[y + dy][x + dx]) return true;
		return false;
	};
	const n = Math.min(DK.foesMax, DK.foes + s.round - 1);
	const fires = Math.floor(n / 3);
	s.foes = [];
	for (let i = 0, tries = 0; s.foes.length < n && tries < 400; tries++) {
		const len = 3 + Math.floor(rnd() * 2);
		const across = rnd() < 0.6;
		const x0 = 1 + Math.floor(rnd() * (DK.cols - 2 - (across ? len : 0)));
		const y0 = 3 + Math.floor(rnd() * (DK.rows - 4 - (across ? 0 : len)));
		if (Math.abs(x0 - DK.start[0]) < 4 && y0 < 8) continue;
		const cells: [number, number][] = Array.from({ length: len }, (_, k) =>
			across ? [x0 + k, y0] : [x0, y0 + k],
		);
		if (cells.some(([x, y]) => !inside(x, y) || y < 2 || busy(x, y))) continue;
		for (const [x, y] of cells) s.dug[y][x] = true;
		const [fx, fy] = cells[Math.floor(len / 2)];
		s.foes.push({
			x: fx,
			y: fy,
			dir: across ? 1 : 2,
			t: 0,
			kind: i < fires ? "enjo" : "arashi",
			sx: fx,
			sy: fy,
			ghost: 0,
			ghostIn: 0,
			inflate: 0,
			deflateT: 0,
			fire: null,
			fireCd: 0,
		});
		i++;
	}
	const m = Math.min(DK.rocksMax, DK.rocks + Math.floor((s.round - 1) / 2));
	s.rocks = [];
	for (let tries = 0; s.rocks.length < m && tries < 400; tries++) {
		const x = 1 + Math.floor(rnd() * (DK.cols - 2));
		const y = 2 + Math.floor(rnd() * 10);
		if (x === DK.start[0]) continue;
		if (busy(x, y) || busy(x, y + 1)) continue;
		if (s.rocks.some((r) => Math.abs(r.x - x) < 3 && Math.abs(r.fy - y) < 3))
			continue;
		s.rocks.push({ x, fy: y, state: "still", t: 0, crushed: 0 });
	}
	resetPlaces(s, rnd);
};

export const dkStart = (rnd: Rnd): DkState => {
	const s: DkState = {
		t: 0,
		round: 1,
		lives: DK.lives,
		points: 0,
		dug: [],
		player: { x: 0, y: 0, dir: 2, t: 0 },
		face: 2,
		digging: false,
		hose: null,
		pumpT: 0,
		foes: [],
		rocks: [],
		phase: "ready",
		pause: 0,
		pops: [],
		over: false,
	};
	makeField(s, rnd);
	return s;
};

export const dkScore = (s: DkState): number => s.points;

const dist = (a: readonly [number, number], b: readonly [number, number]) =>
	Math.hypot(a[0] - b[0], a[1] - b[1]);

/** キリコを 動かす（マスの まんなかで だけ 曲がる。逆向きは いつでも）。 */
const movePlayer = (
	s: DkState,
	want: DkDir | null,
	dt: number,
	ev: DkEvent[],
): void => {
	const p = s.player;
	if (s.hose) {
		// のばして いる あいだは 動けない。つないだ あとに 動くと はずれる
		if (!s.hose.foe || want === null) return;
		s.hose = null;
	}
	if (p.t > 0 && want !== null && want === (p.dir + 2) % 4) {
		const [dx, dy] = DK_DIRS[p.dir];
		p.x += dx;
		p.y += dy;
		p.t = 1 - p.t;
		p.dir = want;
		s.face = want;
		s.digging = false;
	}
	let left = (s.digging ? DK.dig : DK.walk) * dt;
	for (let guard = 0; left > 0 && guard < 4; guard++) {
		if (p.t === 0) {
			if (want === null) return;
			s.face = want;
			const [dx, dy] = DK_DIRS[want];
			const nx = p.x + dx;
			const ny = p.y + dy;
			if (!inside(nx, ny) || dkRockAt(s, nx, ny)) return;
			p.dir = want;
			s.digging = !dkOpen(s, nx, ny);
			if (s.digging) {
				s.dug[ny][nx] = true;
				ev.push("dig");
			}
			if (s.digging) left = Math.min(left, DK.dig * dt);
		}
		const need = 1 - p.t;
		if (left < need) {
			p.t += left;
			return;
		}
		left -= need;
		const [dx, dy] = DK_DIRS[p.dir];
		p.x += dx;
		p.y += dy;
		p.t = 0;
		s.digging = false;
	}
};

/** 敵が マスの まんなかで 向きを 決める。 */
const foeTurn = (s: DkState, f: DkFoe, rnd: Rnd): boolean => {
	const [px, py] = dkPos(s.player);
	const ok = (x: number, y: number): boolean =>
		f.ghost > 0
			? inside(x, y) && y >= 1
			: inside(x, y) && y >= 1 && s.dug[y][x] && !dkRockAt(s, x, y);
	const opts: DkDir[] = [];
	for (const d of [0, 1, 2, 3] as DkDir[]) {
		const [dx, dy] = DK_DIRS[d];
		if (ok(f.x + dx, f.y + dy)) opts.push(d);
	}
	if (opts.length === 0) return false;
	const back = ((f.dir + 2) % 4) as DkDir;
	const fwd = opts.length > 1 ? opts.filter((d) => d !== back) : opts;
	const toward = (d: DkDir): number => {
		const [dx, dy] = DK_DIRS[d];
		return (f.x + dx - px) ** 2 + (f.y + dy - py) ** 2;
	};
	if (f.ghost > 0 || rnd() < 0.5) {
		f.dir = fwd.reduce((a, b) => (toward(b) < toward(a) ? b : a));
	} else f.dir = fwd[Math.floor(rnd() * fwd.length)];
	return true;
};

const moveFoe = (
	s: DkState,
	f: DkFoe,
	dt: number,
	rnd: Rnd,
	ev: DkEvent[],
): void => {
	if (f.inflate > 0) return;
	if (f.fire) {
		f.fire.t -= dt;
		if (f.fire.t <= 0) {
			if (f.fire.phase === "wind") {
				f.fire = { phase: "burn", t: DK.fireBurn };
				ev.push("fire");
			} else {
				f.fire = null;
				f.fireCd = DK.fireCd + rnd() * DK.fireRand;
			}
		}
		return;
	}
	f.fireCd -= dt;
	if (f.ghost > 0) f.ghost += dt;
	else {
		f.ghostIn -= dt;
		if (f.ghostIn <= 0 && f.t === 0) {
			f.ghost = 0.001;
			ev.push("ghost");
		}
	}
	let left = (f.ghost > 0 ? DK.ghost : foeSpeed(s)) * dt;
	for (let guard = 0; left > 0 && guard < 4; guard++) {
		if (f.t === 0) {
			// 目だけ から 戻る
			if (f.ghost > DK.ghostMin && s.dug[f.y][f.x]) {
				f.ghost = 0;
				f.ghostIn = DK.ghostIn + rnd() * DK.ghostRand;
				left = foeSpeed(s) * dt;
			}
			// 炎上は 近くの キリコへ 火を 吹く
			const [px, py] = dkPos(s.player);
			if (
				f.kind === "enjo" &&
				f.ghost === 0 &&
				f.fireCd <= 0 &&
				Math.abs(py - f.y) < 0.5 &&
				Math.abs(px - f.x) <= DK.fireNear
			) {
				f.dir = px > f.x ? 1 : 3;
				f.fire = { phase: "wind", t: DK.fireWind };
				return;
			}
			if (!foeTurn(s, f, rnd)) return;
		}
		const need = 1 - f.t;
		if (left < need) {
			f.t += left;
			return;
		}
		left -= need;
		const [dx, dy] = DK_DIRS[f.dir];
		f.x += dx;
		f.y += dy;
		f.t = 0;
	}
};

/** 火の とどく マス（吹いて いる ときだけ）。 */
export const dkFireCells = (f: DkFoe): [number, number][] => {
	if (f.fire?.phase !== "burn") return [];
	const dx = f.dir === 1 ? 1 : -1;
	const out: [number, number][] = [];
	for (let i = 1; i <= DK.fireLen; i++) {
		const x = f.x + dx * i;
		if (!inside(x, f.y)) break;
		out.push([x, f.y]);
	}
	return out;
};

/** ポンプ（A）。のばす・つないだ 敵を ふくらませる。 */
const pump = (s: DkState, ev: DkEvent[]): void => {
	const h = s.hose;
	if (!h) {
		s.hose = { dir: s.face, len: 0, foe: null, miss: 0 };
		ev.push("hose");
		return;
	}
	const f = h.foe;
	if (!f || s.pumpT > 0) return;
	s.pumpT = DK.pumpGap;
	f.inflate++;
	f.deflateT = DK.deflate;
	ev.push("pump");
	if (f.inflate >= DK.pops) {
		const across = h.dir === 1 || h.dir === 3;
		const pts =
			DK.layerPts[dkLayer(f.y)] * (f.kind === "enjo" && across ? 2 : 1);
		s.points += pts;
		s.pops.push({ x: f.x, y: f.y, text: String(pts), t: 0 });
		s.foes = s.foes.filter((o) => o !== f);
		s.hose = null;
		ev.push("pop");
	}
};

const hoseStep = (s: DkState, dt: number, ev: DkEvent[]): void => {
	const h = s.hose;
	if (!h || h.foe) {
		if (h?.foe && h.foe.inflate <= 0) s.hose = null;
		return;
	}
	if (h.miss > 0) {
		h.miss -= dt;
		if (h.miss <= 0) s.hose = null;
		return;
	}
	const [px, py] = dkPos(s.player);
	const [dx, dy] = DK_DIRS[h.dir];
	h.len = Math.min(DK.hoseLen, h.len + DK.hoseSpeed * dt);
	// 先が 土か 岩に つかえたら もどる
	const tx = Math.round(px + dx * h.len);
	const ty = Math.round(py + dy * h.len);
	if (h.len > 0.5 && (!dkOpen(s, tx, ty) || dkRockAt(s, tx, ty))) {
		h.len = Math.max(
			0,
			Math.min(h.len, Math.abs(tx - px) + Math.abs(ty - py) - 0.5),
		);
		h.miss = 0.12;
	}
	for (const f of s.foes) {
		if (f.ghost > 0) continue;
		const [fx, fy] = dkPos(f);
		const along = (fx - px) * dx + (fy - py) * dy;
		const perp = Math.abs((fx - px) * dy - (fy - py) * dx);
		if (along > 0 && along <= h.len + 0.4 && perp < 0.6) {
			h.foe = f;
			h.len = along;
			h.miss = 0;
			f.inflate = Math.max(1, f.inflate);
			f.deflateT = DK.deflate;
			f.fire = null;
			ev.push("hit");
			return;
		}
	}
	if (h.len >= DK.hoseLen && h.miss <= 0) h.miss = 0.12;
};

const rockStep = (s: DkState, dt: number, ev: DkEvent[]): boolean => {
	const [px, py] = dkPos(s.player);
	let hurt = false;
	for (const r of s.rocks) {
		if (r.state === "still") {
			const y = r.fy;
			const under = y + 1 < DK.rows && s.dug[y + 1][r.x];
			// キリコが すぐ 下に いる あいだは 待つ
			const below = Math.abs(px - r.x) < 0.9 && py > y && py < y + 1.9;
			if (under && !below) {
				r.state = "wobble";
				r.t = DK.wobble;
				ev.push("wobble");
			}
		} else if (r.state === "wobble") {
			r.t -= dt;
			if (r.t <= 0) {
				r.state = "fall";
				s.dug[r.fy][r.x] = true;
				ev.push("crumble");
			}
		} else if (r.state === "fall") {
			r.fy += DK.rockSpeed * dt;
			const row = Math.floor(r.fy);
			if (row + 1 >= DK.rows || !s.dug[row + 1][r.x]) {
				r.fy = row;
				r.state = "break";
				r.t = DK.rockBreak;
				if (r.crushed > 0) {
					const pts = DK.crushPts[Math.min(r.crushed, DK.crushPts.length - 1)];
					s.points += pts;
					s.pops.push({ x: r.x, y: row, text: String(pts), t: 0 });
					ev.push("crush");
				}
			}
			for (const f of [...s.foes]) {
				const [fx, fy] = dkPos(f);
				if (Math.abs(fx - r.x) < 0.8 && fy - r.fy > -0.2 && fy - r.fy < 1) {
					s.foes = s.foes.filter((o) => o !== f);
					if (s.hose?.foe === f) s.hose = null;
					r.crushed++;
				}
			}
			if (Math.abs(px - r.x) < 0.8 && py - r.fy > 0 && py - r.fy < 0.9)
				hurt = true;
		} else {
			r.t -= dt;
		}
	}
	s.rocks = s.rocks.filter((r) => r.state !== "break" || r.t > 0);
	return hurt;
};

export const dkStep = (
	s: DkState,
	dt: number,
	input: { dir: DkDir | null; pump: boolean },
	rnd: Rnd,
): DkEvent[] => {
	const ev: DkEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	for (const p of s.pops) p.t += dt;
	s.pops = s.pops.filter((p) => p.t < 0.9);
	if (s.phase !== "play") {
		s.pause -= dt;
		if (s.phase === "die" || s.phase === "clear") rockStep(s, dt, []);
		if (s.pause > 0) return ev;
		if (s.phase === "die") {
			s.lives--;
			if (s.lives <= 0) {
				s.over = true;
				ev.push("over");
				return ev;
			}
			resetPlaces(s, rnd);
		} else if (s.phase === "clear") {
			s.round++;
			makeField(s, rnd);
			ev.push("round");
		} else s.phase = "play";
		return ev;
	}
	s.pumpT = Math.max(0, s.pumpT - dt);
	if (input.pump) pump(s, ev);
	movePlayer(s, input.dir, dt, ev);
	hoseStep(s, dt, ev);
	for (const f of s.foes) {
		if (f.inflate > 0) {
			f.deflateT -= dt;
			if (f.deflateT <= 0) {
				f.inflate--;
				f.deflateT = DK.deflate;
			}
			continue;
		}
		moveFoe(s, f, dt, rnd, ev);
	}
	hoseStep(s, 0, ev);
	let hurt = rockStep(s, dt, ev);
	const pp = dkPos(s.player);
	for (const f of s.foes) {
		if (f.inflate > 0) continue;
		if (dist(pp, dkPos(f)) < 0.7) hurt = true;
		for (const [x, y] of dkFireCells(f))
			if (Math.abs(pp[0] - x) < 0.7 && Math.abs(pp[1] - y) < 0.6) hurt = true;
	}
	if (hurt) {
		s.phase = "die";
		s.pause = DK.dieTime;
		s.hose = null;
		ev.push("die");
		return ev;
	}
	if (s.foes.length === 0 && !s.rocks.some((r) => r.state === "fall")) {
		s.phase = "clear";
		s.pause = DK.clearTime;
		ev.push("clear");
	}
	return ev;
};

/** 地面の 左上（画面の 画素。帯の 下に まんなか ぞろえ）。 */
export const dkOrigin = (): readonly [number, number] => [
	Math.floor((AW - DK.cols * DK.cell) / 2),
	ATOP + Math.floor((AH - ATOP - DK.rows * DK.cell) / 2),
];
