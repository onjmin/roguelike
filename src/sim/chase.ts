// 追いかけの計測（node scripts/chase.mjs）。敵に追われたとき、どれだけ・どうして撒けるのか。
//
// - 本物の階（Run.create のシードと深さを変えて）に、キリコと 起きている敵を1〜2体だけ置き、
//   キリコは なぐらずに 最短路で目的地（階段）へ歩く。ほかの敵・道具・罠は除き、湧き・地震・空腹は止める。
// - 敵が1回の行動で何をしたかは、src/core を変えずに Monster を Proxy で包んで読む：
//     nextAt を書く … 行動の始まり「|」
//     lastSeen に座標 … 見えた「S」／ null に … 見失った（着いた「Cr」・道がふさがった「Cb」）
//     goal を読む … さまよった「G」（N＝新しい目的地、Gx＝目的地をあきらめた）
//     x を書く … 動いた「M」／ attack の出来事 … なぐった「A」
// - 敵の選択・位置の選択は専用の乱数（シードから）。何度流しても同じ数字になる。

import { HUNGER_MAX } from "../core/balance";
import { spawnMonster } from "../core/floor";
import { canSee, roomsSeenFrom } from "../core/fov";
import {
	DIRS8,
	type Dir8,
	DX,
	DY,
	dirOf,
	dist,
	opposite,
	type Pos,
	samePos,
	step,
} from "../core/geom";
import {
	isFloor,
	type Layout,
	roomAt,
	roomExits,
	roomTiles,
	T_CORR,
	tileAt,
} from "../core/mapgen";
import { Rng } from "../core/rng";
import { Run } from "../core/run";
import type { Command, GameEvent, Monster } from "../core/types";

// ───────────────── 行動の記録（Proxy） ─────────────────

export type Cls =
	| "attack" // なぐった
	| "chase" // 見えていて近づいた
	| "stuck" // 見えているのに動けなかった
	| "toLast" // 見えないので 最後に見た所へ
	| "lost" // lastSeen を消した（見失った）
	| "wander" // さまよい
	| "idle";

class Watch {
	ops: string[] = [];
	on = false;
	started = false;
	op(s: string): void {
		if (!this.on || !this.started) return;
		if (s === "G" && this.ops[this.ops.length - 1] === "G") return;
		this.ops.push(s);
	}
	begin(): void {
		if (!this.on) return;
		this.started = true;
		this.ops.push("|");
	}
	reset(): void {
		this.ops = [];
		this.started = false;
	}
}

const classify = (ops: string[]): Cls => {
	const has = (s: string) => ops.includes(s);
	if (has("A")) return "attack";
	if (has("S")) return has("M") ? "chase" : "stuck";
	if (has("Cr") || has("Cb")) return "lost";
	if (has("G")) return "wander";
	if (has("M")) return "toLast";
	return "idle";
};

/** 敵を Proxy で包んで、階の一覧の中身も差しかえる。 */
const watchMonster = (r: Run, m: Monster, w: Watch): Monster => {
	const proxy = new Proxy(m, {
		get(o, k, rc) {
			if (k === "goal") w.op("G");
			return Reflect.get(o, k, rc);
		},
		set(o, k, v, rc) {
			if (k === "nextAt") w.begin();
			else if (k === "lastSeen") {
				if (v) w.op("S");
				else if (o.lastSeen)
					w.op(o.lastSeen.x === o.x && o.lastSeen.y === o.y ? "Cr" : "Cb");
			} else if (k === "x") w.op("M");
			else if (k === "goal") w.op(v ? "N" : "Gx");
			return Reflect.set(o, k, v, rc);
		},
	});
	const i = r.f.monsters.indexOf(m);
	r.f.monsters[i] = proxy;
	return proxy;
};

// ───────────────── 階と道のり ─────────────────

const at = (l: Layout, p: Pos): number => p.y * l.w + p.x;
const posAt = (l: Layout, i: number): Pos => ({
	x: i % l.w,
	y: Math.floor(i / l.w),
});

/** 本物の階を作り、敵・道具・罠を除く。キリコの HP はほぼ無限。 */
const stage = (seed: string, depth: number): Run => {
	const r = Run.create(`chase:${seed}`);
	if (depth > 1) r.enterFloor(depth, false);
	const f = r.f;
	f.monsters = [];
	f.items = [];
	f.traps = [];
	f.wards = [];
	f.house = -1;
	f.houseAwake = false;
	f.turns = 0;
	const p = r.p;
	p.maxHp = 99999;
	p.hp = 99999;
	p.status = {
		sleep: 0,
		confuse: 0,
		blind: 0,
		fast: 0,
		trapped: 0,
		heldBy: null,
	};
	return r;
};

/** 地形だけの道のり（角ぬけの決まりを守る）。blocked のマスは通さない。 */
const bfs = (
	r: Run,
	from: Pos,
	blocked?: (x: number, y: number) => boolean,
): Int16Array => {
	const l = r.f.layout;
	const d = new Int16Array(l.w * l.h).fill(-1);
	const q = [at(l, from)];
	d[q[0]] = 0;
	for (let h = 0; h < q.length; h++) {
		const cur = posAt(l, q[h]);
		for (const dir of DIRS8) {
			if (!r.canStepTerrain(cur, dir)) continue;
			const n = step(cur, dir);
			const ni = at(l, n);
			if (d[ni] >= 0) continue;
			if (blocked?.(n.x, n.y)) continue;
			d[ni] = d[q[h]] + 1;
			q.push(ni);
		}
	}
	return d;
};

/** キリコの一歩：ほかのキャラを避けた最短路。行けなければ null（待つ）。 */
const playerStep = (r: Run, goal: Pos): Dir8 | null => {
	const l = r.f.layout;
	const p = r.p;
	const d = bfs(r, goal, (x, y) => !!r.monsterAt(x, y));
	const here = d[at(l, p)];
	if (here <= 0) return null;
	let best: Dir8 | null = null;
	let bestV = here;
	for (const dir of DIRS8) {
		if (!r.canStepTerrain(p, dir)) continue;
		const to = step(p, dir);
		if (r.monsterAt(to.x, to.y)) continue;
		const v = d[at(l, to)];
		if (v >= 0 && v < bestV) {
			best = dir;
			bestV = v;
		}
	}
	return best;
};

const isCorr = (l: Layout, p: Pos): boolean => tileAt(l, p.x, p.y) === T_CORR;
/** 部屋の入口（部屋に4方向で接する通路）。そこからは部屋が見える。 */
const isEntrance = (l: Layout, p: Pos): boolean =>
	isCorr(l, p) && roomsSeenFrom(l, p.x, p.y).length > 0;
/** 入口でない通路（見えるのはまわり1マスだけ）。 */
const pureCorr = (l: Layout, p: Pos): boolean =>
	isCorr(l, p) && !isEntrance(l, p);
const where = (l: Layout, p: Pos): "r" | "e" | "c" =>
	roomAt(l, p.x, p.y) >= 0 ? "r" : isEntrance(l, p) ? "e" : "c";

/** 4方向の床の数（3以上なら分かれ道）。 */
const branches = (l: Layout, p: Pos): number =>
	[0, 2, 4, 6].filter((d) => isFloor(l, p.x + DX[d], p.y + DY[d])).length;

type Ctx = {
	seed: string;
	depth: number;
	r: Run;
	l: Layout;
	goal: Pos;
	dG: Int16Array;
	pick: Rng;
	whatIf: WhatIf;
};

/**
 * 仮の手当て（src/core は変えずに、計測の側で まねる）。
 * - "none"    … そのまま
 * - "refresh" … 敵の番が終わったあと、その敵から キリコが見えていれば lastSeen をキリコの位置にする
 *               （「動いたあと となりにいるのに lastSeen が古いまま」を直したら どうなるか）
 * - "trail"   … refresh に加えて、lastSeen に着いた（次の行動で消す）敵は キリコの足あとの 次のマスを
 *               lastSeen にする（見失った所から 足あとを たどる）
 */
export type WhatIf = "none" | "refresh" | "trail";

const makeCtx = (
	seed: string,
	depth: number,
	tag: string,
	whatIf: WhatIf,
): Ctx => {
	const r = stage(seed, depth);
	const l = r.f.layout;
	const goal = { ...r.f.stairs };
	return {
		seed,
		depth,
		r,
		l,
		goal,
		dG: bfs(r, goal),
		pick: Rng.fromSeed(`chase-pick:${tag}:${seed}:${depth}`),
		whatIf,
	};
};

/** from から階段への最短路（キリコと同じ選び方）。 */
const pathFrom = (c: Ctx, from: Pos, k: number): Pos[] => {
	const out: Pos[] = [];
	let cur = from;
	for (let i = 0; i < k; i++) {
		const v = c.dG[at(c.l, cur)];
		if (v <= 0) break;
		let nxt: Pos | null = null;
		for (const d of DIRS8) {
			if (!c.r.canStepTerrain(cur, d)) continue;
			const n = step(cur, d);
			if (c.dG[at(c.l, n)] === v - 1) {
				nxt = n;
				break;
			}
		}
		if (!nxt) break;
		out.push(nxt);
		cur = nxt;
	}
	return out;
};

const put = (c: Ctx, kind: string, pos: Pos, w: Watch): Monster => {
	const m = spawnMonster(c.r, kind, pos, { awake: true });
	if (!m) throw new Error(`could not spawn ${kind}`);
	return watchMonster(c.r, m, w);
};

// ───────────────── 1回の追いかけ ─────────────────

export type MonRec = {
	pos: Pos;
	ops: string;
	cls: Cls;
	lastSeen: Pos | null;
	/** キリコから見えているか（手番のあと）。 */
	playerSees: boolean;
};
export type TurnRec = { t: number; p: Pos; cmd: string; ms: MonRec[] };

type Trial = {
	c: Ctx;
	ms: Monster[];
	ws: Watch[];
	recs: TurnRec[];
	/** キリコの足あと（はじめの位置から）。 */
	trail: Pos[];
};

const freeze = (r: Run): void => {
	r.f.turns = 0;
	r.p.hunger = HUNGER_MAX;
	r.p.hp = r.p.maxHp;
};

const DIR_CH = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];

/** 1ターン進めて記録する。 */
const doTurn = (tr: Trial, t: number, cmd: Command): void => {
	const r = tr.c.r;
	freeze(r);
	for (const w of tr.ws) {
		w.reset();
		w.on = true;
	}
	const turn0 = r.s.turn;
	let label = cmd.c === "move" ? DIR_CH[cmd.dir] : cmd.c;
	r.act(cmd);
	// 見えている敵の方へは向くだけ（時間が進まない）→ 待つ
	if (r.s.turn === turn0) {
		r.act({ c: "wait" });
		label = "wait";
	}
	for (const w of tr.ws) w.on = false;
	const last = tr.trail[tr.trail.length - 1];
	if (!samePos(last, r.p)) tr.trail.push({ x: r.p.x, y: r.p.y });
	if (tr.c.whatIf !== "none")
		for (const m of tr.ms) {
			if (m.hp <= 0) continue;
			if (canSee(tr.c.l, m, r.p)) {
				m.lastSeen = { x: r.p.x, y: r.p.y };
				continue;
			}
			if (tr.c.whatIf !== "trail" || !m.lastSeen || !samePos(m.lastSeen, m))
				continue;
			for (let i = tr.trail.length - 2; i >= 0; i--)
				if (samePos(tr.trail[i], m)) {
					m.lastSeen = { ...tr.trail[i + 1] };
					break;
				}
		}
	tr.recs.push({
		t,
		p: { x: r.p.x, y: r.p.y },
		cmd: label,
		ms: tr.ms.map((m, i) => ({
			pos: { x: m.x, y: m.y },
			ops: tr.ws[i].ops.join(" "),
			cls: classify(tr.ws[i].ops),
			lastSeen: m.lastSeen ? { x: m.lastSeen.x, y: m.lastSeen.y } : null,
			playerSees: r.playerSees(m),
		})),
	});
};

/** 階段（goal）まで歩く。stop が true なら その前で止める。 */
const walk = (
	tr: Trial,
	maxTurns: number,
	stop?: (tr: Trial) => boolean,
): void => {
	const r = tr.c.r;
	for (let t = 1; t <= maxTurns; t++) {
		if (samePos(r.p, tr.c.goal) || r.s.end) break;
		if (stop?.(tr)) break;
		const dir = playerStep(r, tr.c.goal);
		doTurn(
			tr,
			t,
			dir === null ? { c: "wait" } : { c: "move", dir, noPickup: true },
		);
	}
};

const newTrial = (c: Ctx, kinds: string[], spots: Pos[]): Trial => {
	const ws = kinds.map(() => new Watch());
	const ms = kinds.map((k, i) => put(c, k, spots[i], ws[i]));
	// 敵がつかう Run のイベント：なぐった（attack）を拾う
	const orig = c.r.emit.bind(c.r);
	c.r.emit = (e: GameEvent) => {
		if (e.t === "attack") {
			const i = ms.findIndex((m) => m.uid === e.id);
			if (i >= 0) ws[i].op("A");
		}
		orig(e);
	};
	return { c, ms, ws, recs: [], trail: [{ x: c.r.p.x, y: c.r.p.y }] };
};

// ───────────────── 結果 ─────────────────

export type Outcome = {
	seed: string;
	depth: number;
	turns: number;
	/** 最初に見失った手番（lastSeen を消した・さまよった）。 */
	lostAt: number | null;
	lostHow: "reached" | "blocked" | "never-saw" | null;
	lostTile: "r" | "e" | "c" | null;
	/** 見失った瞬間（その手番のあと）の距離。 */
	lostDist: number | null;
	/** 見失った次のさまよいの一歩で、キリコへの道のりが 縮んだ(-1)・同じ(0)・のびた(+1)。 */
	wanderDir: number | null;
	reacq: boolean;
	reacqTile: "r" | "e" | "c" | null;
	chaseTurns: number;
	wanderTurns: number;
	endDist: number;
	endPath: number;
	tracking: boolean;
	enteredCorr: boolean;
	/** 手番のあと となりにいたのに、次の行動の はじめに 見えていなかった回数（通路で）。 */
	adjButBlind: number;
	/** 手番のあとで となり（キリコから見えている）だった手番の数。 */
	adjTurns: number;
};

const outcome = (tr: Trial, mi: number): Outcome => {
	const { c, recs } = tr;
	const m = tr.ms[mi];
	let lostAt: number | null = null;
	let lostHow: Outcome["lostHow"] = null;
	let lostTile: Outcome["lostTile"] = null;
	let lostDist: number | null = null;
	let wanderDir: number | null = null;
	let reacq = false;
	let reacqTile: Outcome["reacqTile"] = null;
	let chaseTurns = 0;
	let wanderTurns = 0;
	let enteredCorr = false;
	let adjButBlind = 0;
	let adjTurns = 0;
	for (let i = 0; i < recs.length; i++) {
		const rec = recs[i];
		const mr = rec.ms[mi];
		if (roomAt(c.l, mr.pos.x, mr.pos.y) < 0) enteredCorr = true;
		if (mr.cls === "lost" || mr.cls === "wander") wanderTurns++;
		else if (mr.cls !== "idle") chaseTurns++;
		const d = dist(mr.pos, rec.p);
		if (d <= 1) {
			adjTurns++;
			const next = recs[i + 1]?.ms[mi];
			if (next && !next.ops.includes("S")) adjButBlind++;
		}
		const lostNow = mr.ops.includes("Cr") || mr.ops.includes("Cb");
		if (lostAt === null && (lostNow || mr.cls === "wander")) {
			lostAt = rec.t;
			lostHow = mr.ops.includes("Cr")
				? "reached"
				: mr.ops.includes("Cb")
					? "blocked"
					: "never-saw";
			const prev = i > 0 ? recs[i - 1].ms[mi].pos : mr.pos;
			lostTile = where(c.l, prev);
			lostDist = d;
			// さまよいの一歩で キリコへの道のりがどう変わったか
			const dp = bfs(c.r, rec.p);
			const before = dp[at(c.l, prev)];
			const after = dp[at(c.l, mr.pos)];
			if (before >= 0 && after >= 0) wanderDir = Math.sign(after - before);
		} else if (lostAt !== null && !reacq && mr.ops.includes("S")) {
			reacq = true;
			const prev = i > 0 ? recs[i - 1].ms[mi].pos : mr.pos;
			reacqTile = where(c.l, prev);
		}
	}
	const last = recs[recs.length - 1];
	const endDist = last ? dist(m, last.p) : dist(m, c.r.p);
	const dp = bfs(c.r, c.r.p);
	return {
		seed: c.seed,
		depth: c.depth,
		turns: recs.length,
		lostAt,
		lostHow,
		lostTile,
		lostDist,
		wanderDir,
		reacq,
		reacqTile,
		chaseTurns,
		wanderTurns,
		endDist,
		endPath: dp[at(c.l, m)],
		tracking: m.lastSeen !== null || !!m.hunt,
		enteredCorr,
		adjButBlind,
		adjTurns,
	};
};

export const traceLines = (tr: Trial, mi = 0): string[] => {
	const l = tr.c.l;
	const pp = (p: Pos | null) => (p ? `(${p.x},${p.y})` : "-");
	const out = [
		`seed=${tr.c.seed} B${tr.c.depth} goal=${pp(tr.c.goal)} monster=${tr.ms[mi].kind}`,
	];
	for (const rec of tr.recs) {
		const m = rec.ms[mi];
		out.push(
			`  t${String(rec.t).padStart(2)} ${rec.cmd.padEnd(4)} P${pp(rec.p)}[${where(l, rec.p)}] M${pp(m.pos)}[${where(l, m.pos)}] d=${dist(m.pos, rec.p)} ops[${m.ops}] → ${m.cls.padEnd(6)} lastSeen=${pp(m.lastSeen)}${m.playerSees ? " (P sees M)" : ""}`,
		);
	}
	return out;
};

// ───────────────── 場面 ─────────────────

/** 記録を残す：はじめの1つ、また見つけた例、撒けた例、見失わなかった例 の順に nTrace まで。 */
const keepTrace = (
	traces: string[][],
	tags: Set<string>,
	tr: Trial,
	o: Outcome,
	nTrace: number,
	mi = 0,
): void => {
	if (traces.length >= nTrace) return;
	const tag = !tags.size
		? "first"
		: o.reacq && !tags.has("reacq")
			? "reacq"
			: !o.tracking && o.endDist > 6 && !tags.has("escaped")
				? "escaped"
				: o.lostAt === null && !tags.has("kept")
					? "kept"
					: null;
	if (!tag) return;
	tags.add(tag);
	const lines = traceLines(tr, mi);
	lines[0] = `(${tag}) ${lines[0]}`;
	traces.push(lines);
};

export type ScenarioResult = {
	id: string;
	name: string;
	kind: string;
	setup: string;
	outcomes: Outcome[];
	traces: string[][];
	/** 場面ごとの補足の数（例：先頭の手番の分類の数え）。 */
	extra: Record<string, number>;
};

type Floors = { n: number; prefix: string; whatIf: WhatIf };

/** シードと深さを変えた階を n 枚。 */
const floors = (fl: Floors, tag: string): Ctx[] => {
	const out: Ctx[] = [];
	for (let i = 0; i < fl.n; i++)
		out.push(makeCtx(`${fl.prefix}${i}`, 1 + (i % 20), tag, fl.whatIf));
	return out;
};

type CorrCand = { P: Pos; M: Pos; M2: Pos | null; ahead: Pos[] };

/** 通路の場面の候補：入口でない通路 P、真うしろ M（階段から1つ遠い）。 */
const corridorCands = (
	c: Ctx,
	kind: "straight" | "corner" | "junction",
): CorrCand[] => {
	const l = c.l;
	const out: CorrCand[] = [];
	for (let i = 0; i < l.w * l.h; i++) {
		const P = posAt(l, i);
		if (!pureCorr(l, P)) continue;
		const dp = c.dG[i];
		if (dp < 6) continue;
		const ahead = pathFrom(c, P, 5);
		if (ahead.length < 5) continue;
		for (const d of [0, 2, 4, 6] as Dir8[]) {
			const M = step(P, d);
			if (!pureCorr(l, M) || c.dG[at(l, M)] !== dp + 1) continue;
			const fwd = opposite(d);
			const dirs = [P, ...ahead]
				.slice(0, 5)
				.map((p, j) => dirOf(ahead[j].x - p.x, ahead[j].y - p.y));
			const clear3 = ahead.slice(0, 3).every((p) => pureCorr(l, p));
			let okKind = false;
			if (kind === "straight")
				okKind =
					ahead.slice(0, 4).every((p) => pureCorr(l, p)) &&
					dirs.slice(0, 4).every((x) => x === fwd);
			else if (kind === "corner")
				okKind =
					clear3 &&
					dirs.slice(0, 3).some((x) => x !== fwd) &&
					[P, ...ahead.slice(0, 3)].every((p) => branches(l, p) <= 2);
			else
				okKind =
					clear3 && [P, ...ahead.slice(0, 2)].some((p) => branches(l, p) >= 3);
			if (!okKind) continue;
			const M2c = step(M, d);
			const M2 = pureCorr(l, M2c) && c.dG[at(l, M2c)] === dp + 2 ? M2c : null;
			out.push({ P, M, M2, ahead });
		}
	}
	return out;
};

/** A・D：通路で真うしろに敵。1回なぐらせてから（見えている状態にしてから）歩きだす。 */
const corridorScenario = (
	id: string,
	name: string,
	kind: "straight" | "corner" | "junction",
	monster: string,
	fl: Floors,
	nTrace: number,
	extraRun = false,
): ScenarioResult => {
	const outcomes: Outcome[] = [];
	const traces: string[][] = [];
	const tags = new Set<string>();
	const extra: Record<string, number> = {
		t1_toLast: 0,
		t1_adjAfter: 0,
		t2_lostReached: 0,
		wanderFollowsPath: 0,
	};
	for (const c of floors(fl, id)) {
		const cands = corridorCands(c, kind);
		if (!cands.length) continue;
		const cand = c.pick.pick(cands);
		c.r.p.x = cand.P.x;
		c.r.p.y = cand.P.y;
		const tr = newTrial(c, [monster], [cand.M]);
		// ならし：キリコが1回待つ → 敵は となりで なぐる（lastSeen = キリコの位置）
		doTurn(tr, 0, { c: "wait" });
		// 通路を出る（入口・部屋に着く）まで。extraRun なら階段まで
		walk(tr, extraRun ? 200 : 30, (t) =>
			extraRun ? false : !pureCorr(c.l, t.c.r.p),
		);
		const o = outcome(tr, 0);
		outcomes.push(o);
		const r1 = tr.recs[1]?.ms[0];
		const r2 = tr.recs[2]?.ms[0];
		if (r1?.cls === "toLast") extra.t1_toLast++;
		if (r1 && tr.recs[1] && dist(r1.pos, tr.recs[1].p) <= 1)
			extra.t1_adjAfter++;
		if (r2?.ops.includes("Cr")) extra.t2_lostReached++;
		if (o.wanderDir !== null && o.wanderDir < 0) extra.wanderFollowsPath++;
		keepTrace(traces, tags, tr, o, nTrace);
	}
	return {
		id,
		name,
		kind: monster,
		setup: `real floors, player on a non-entrance corridor tile with ${kind} corridor ahead toward the stairs, awake ${monster} on the corridor tile right behind; player waits 1 turn (monster hits, lastSeen=player), then walks the shortest path ${extraRun ? "to the stairs" : "until it leaves the corridor (entrance/room)"}`,
		outcomes,
		traces,
		extra,
	};
};

/** Q：通路で2体が1列に（2体目は まえの1体にふさがれる）。2体とも lastSeen=キリコ にしてから歩く。 */
const queueScenario = (fl: Floors, nTrace: number): ScenarioResult[] => {
	const o1: Outcome[] = [];
	const o2: Outcome[] = [];
	const traces: string[][] = [];
	const tags = new Set<string>();
	const extra: Record<string, number> = { t0_second_blocked: 0 };
	for (const c of floors(fl, "Q")) {
		const cands = corridorCands(c, "straight").filter((x) => x.M2);
		if (!cands.length) continue;
		const cand = c.pick.pick(cands);
		c.r.p.x = cand.P.x;
		c.r.p.y = cand.P.y;
		const tr = newTrial(c, ["knight", "knight"], [cand.M, cand.M2 as Pos]);
		for (const m of tr.ms) m.lastSeen = { x: cand.P.x, y: cand.P.y };
		doTurn(tr, 0, { c: "wait" });
		if (tr.recs[0].ms[1].ops.includes("Cb")) extra.t0_second_blocked++;
		walk(tr, 30, (t) => !pureCorr(c.l, t.c.r.p));
		o1.push(outcome(tr, 0));
		const o = outcome(tr, 1);
		o2.push(o);
		keepTrace(traces, tags, tr, o, nTrace, 1);
	}
	const setup =
		"real floors, straight corridor; two awake knights in a line behind the player (adjacent + 2 behind), both primed lastSeen=player; player waits 1 turn, then walks out of the corridor";
	return [
		{
			id: "Q1",
			name: "queue: front monster",
			kind: "knight",
			setup,
			outcomes: o1,
			traces: [],
			extra: {},
		},
		{
			id: "Q2",
			name: "queue: second monster",
			kind: "knight",
			setup,
			outcomes: o2,
			traces,
			extra,
		},
	];
};

/** B：部屋で見つかって、出口から通路へ出て歩きつづける。 */
const roomExitScenario = (
	id: string,
	monster: string,
	nMon: number,
	fl: Floors,
	nTrace: number,
): ScenarioResult[] => {
	const outs: Outcome[][] = Array.from({ length: nMon }, () => []);
	const traces: string[][] = [];
	const tags = new Set<string>();
	for (const c of floors(fl, id)) {
		const l = c.l;
		const stairsRoom = roomAt(l, c.goal.x, c.goal.y);
		const cands: { P: Pos; X: Pos; Ms: Pos[] }[] = [];
		for (const room of l.rooms) {
			if (room.id === stairsRoom) continue;
			const exits = roomExits(l, room).filter((e) => c.dG[at(l, e)] >= 0);
			if (!exits.length) continue;
			const X = exits.reduce((a, b) =>
				c.dG[at(l, b)] < c.dG[at(l, a)] ? b : a,
			);
			const dX = c.dG[at(l, X)];
			// その先に 8マス以上の道のりが残る出口
			if (dX < 10) continue;
			const tiles = roomTiles(room);
			for (const P of tiles) {
				if (c.dG[at(l, P)] !== dX + 2 || dist(P, X) !== 2) continue;
				const Ms = tiles.filter(
					(t) =>
						!samePos(t, P) &&
						dist(t, P) >= 2 &&
						dist(t, P) <= 4 &&
						c.dG[at(l, t)] >= c.dG[at(l, P)] + 2,
				);
				if (Ms.length >= nMon) cands.push({ P, X, Ms });
			}
		}
		if (!cands.length) continue;
		const cand = c.pick.pick(cands);
		c.r.p.x = cand.P.x;
		c.r.p.y = cand.P.y;
		const spots = c.pick.shuffle([...cand.Ms]).slice(0, nMon);
		const tr = newTrial(
			c,
			spots.map(() => monster),
			spots,
		);
		const dX = c.dG[at(l, cand.X)];
		// 出口から 8マス進むまで（か階段）
		walk(tr, 60, (t) => c.dG[at(l, t.c.r.p)] <= dX - 8);
		for (let i = 0; i < nMon; i++) outs[i].push(outcome(tr, i));
		keepTrace(
			traces,
			tags,
			tr,
			outs[nMon - 1][outs[nMon - 1].length - 1],
			nTrace,
			nMon - 1,
		);
	}
	const setup = `real floors, player in a non-stairs room 2 steps from the exit on its shortest path to the stairs; ${nMon} awake ${monster} in the same room 2-4 tiles away and farther from the exit (sees the player); player walks out and 8 tiles down the corridor`;
	return outs.map((o, i) => ({
		id: nMon > 1 ? `${id}${i + 1}` : id,
		name:
			nMon > 1
				? `room exit, ${nMon} pursuers: #${i + 1}`
				: "room exit into corridor",
		kind: monster,
		setup,
		outcomes: o,
		traces: i === nMon - 1 ? traces : [],
		extra: {},
	}));
};

/** C・E：階のはじめの位置から階段まで。敵は同じ部屋に。 */
const toStairsScenario = (
	id: string,
	name: string,
	monster: string,
	fl: Floors,
	nTrace: number,
	opts: { minRooms: number; dMin: number; dMax: number; behind: number },
): ScenarioResult => {
	const outcomes: Outcome[] = [];
	const traces: string[][] = [];
	const tags = new Set<string>();
	const extra: Record<string, number> = { startedBehind: 0 };
	for (const c of floors(fl, id)) {
		const l = c.l;
		const P = { x: c.r.p.x, y: c.r.p.y };
		const room = roomAt(l, P.x, P.y);
		if (room < 0) continue;
		const path = pathFrom(c, P, 999);
		const rooms = new Set(
			[P, ...path].map((p) => roomAt(l, p.x, p.y)).filter((x) => x >= 0),
		);
		if (rooms.size < opts.minRooms) continue;
		const dP = c.dG[at(l, P)];
		const Ms = roomTiles(l.rooms[room]).filter(
			(t) =>
				!samePos(t, P) &&
				!samePos(t, c.goal) &&
				dist(t, P) >= opts.dMin &&
				dist(t, P) <= opts.dMax &&
				c.dG[at(l, t)] >= dP + opts.behind &&
				canSee(l, t, P),
		);
		if (!Ms.length) continue;
		const M = c.pick.pick(Ms);
		if (c.dG[at(l, M)] > dP) extra.startedBehind++;
		const tr = newTrial(c, [monster], [M]);
		walk(tr, 300);
		const o = outcome(tr, 0);
		outcomes.push(o);
		keepTrace(traces, tags, tr, o, nTrace);
	}
	return {
		id,
		name,
		kind: monster,
		setup: `real floors, player at the floor's start tile, awake ${monster} in the same room at Chebyshev ${opts.dMin}-${opts.dMax}${opts.behind > -99 ? ` and >= ${opts.behind} farther from the stairs` : ""} (sees the player)${opts.minRooms > 2 ? `, only floors whose shortest path crosses >= ${opts.minRooms} rooms` : ""}; player walks the shortest path to the stairs`,
		outcomes,
		traces,
		extra,
	};
};

// ───────────────── 見え方の対称性 ─────────────────

export type SightCheck = {
	pairs: number;
	asym: number;
	/** 片方だけ見える組の内わけ（見える側のマスの種類 → 見えない側のマスの種類）。 */
	kinds: Record<string, number>;
};

export const sightSymmetry = (n: number, prefix: string): SightCheck => {
	let pairs = 0;
	let asym = 0;
	const kinds: Record<string, number> = {};
	for (let i = 0; i < n; i++) {
		const r = stage(`${prefix}${i}`, 1 + (i % 20));
		const l = r.f.layout;
		const tiles: Pos[] = [];
		for (let j = 0; j < l.w * l.h; j++)
			if (l.tiles[j] !== 0) tiles.push(posAt(l, j));
		for (const a of tiles)
			for (const b of tiles) {
				if (a === b) continue;
				pairs++;
				const ab = canSee(l, a, b);
				const ba = canSee(l, b, a);
				if (ab && !ba) {
					asym++;
					const kb =
						where(l, b) === "c" &&
						roomAt(l, b.x, b.y) < 0 &&
						[1, 3, 5, 7].some((d) => roomAt(l, b.x + DX[d], b.y + DY[d]) >= 0)
							? "c(diag-to-room)"
							: where(l, b);
					const k = `${where(l, a)}→${kb}`;
					kinds[k] = (kinds[k] ?? 0) + 1;
				}
			}
	}
	return { pairs, asym, kinds };
};

// ───────────────── まとめ ─────────────────

export type ChaseOpts = {
	n: number;
	prefix: string;
	trace: number;
	whatIf?: WhatIf;
};

export const runChase = (
	opts: ChaseOpts,
	only?: string[],
): ScenarioResult[] => {
	const fl: Floors = {
		n: opts.n,
		prefix: opts.prefix,
		whatIf: opts.whatIf ?? "none",
	};
	/** --only A,E … 場面の id の頭で しぼる。 */
	const want = (id: string) => !only || only.some((o) => id.startsWith(o));
	const out: ScenarioResult[] = [];
	const tr = opts.trace;
	const corr = (
		id: string,
		name: string,
		kind: "straight" | "corner" | "junction",
		monster: string,
		toStairs = false,
	) => {
		if (want(id))
			out.push(corridorScenario(id, name, kind, monster, fl, tr, toStairs));
	};
	const exit = (id: string, monster: string, nMon: number) => {
		if (want(id)) out.push(...roomExitScenario(id, monster, nMon, fl, tr));
	};
	const stairs = (
		id: string,
		name: string,
		monster: string,
		o: { minRooms: number; dMin: number; dMax: number; behind: number },
	) => {
		if (want(id)) out.push(toStairsScenario(id, name, monster, fl, tr, o));
	};
	corr("A", "corridor chase (straight)", "straight", "knight");
	corr("A-fastMove", "corridor chase (straight)", "straight", "hitodama");
	corr("A-fastAct", "corridor chase (straight)", "straight", "ninja");
	corr("A-full", "corridor start, walk to stairs", "straight", "knight", true);
	exit("B", "knight", 1);
	exit("B-fastMove", "hitodama", 1);
	exit("B2-", "knight", 2);
	const c = { minRooms: 3, dMin: 3, dMax: 5, behind: 3 };
	stairs("C", "flee across rooms", "knight", c);
	corr("D-corner", "corridor corner", "corner", "knight");
	corr("D-junction", "corridor junction", "junction", "knight");
	const e = { minRooms: 0, dMin: 2, dMax: 4, behind: -999 };
	stairs("E", "fair: start -> stairs", "knight", e);
	stairs("E-fastMove", "fair: start -> stairs", "hitodama", e);
	stairs("E-fastAct", "fair: start -> stairs", "ninja", e);
	if (want("Q")) out.push(...queueScenario(fl, tr));
	return out;
};

// ───────────────── 集計 ─────────────────

export type Row = {
	id: string;
	kind: string;
	n: number;
	/** 一度でも見失った割合。 */
	lost: number;
	lostAtMed: number | null;
	/** 見失ったうち、また見つけた割合。 */
	reacq: number;
	/** 終わりに追っていない（lastSeen なし）かつ 2マスより離れている割合＝撒けた。 */
	escaped: number;
	/** 終わりに 6マスより離れて さまよっている割合。 */
	far6: number;
	adjEnd: number;
	within2End: number;
	chaseAvg: number;
	wanderAvg: number;
	/** 見失い方：着いて消した／ふさがれて消した。 */
	reached: number;
	blocked: number;
	/** 見失ったあとの さまよいの一歩で キリコから遠ざかった割合。 */
	wanderAway: number;
	/** 手番のあと となりにいた回数のうち、次の行動で見えていなかった割合。 */
	adjBlind: number;
	turnsMed: number;
};

const median = (a: number[]): number | null => {
	if (!a.length) return null;
	const s = [...a].sort((x, y) => x - y);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const summarize = (sr: ScenarioResult): Row => {
	const o = sr.outcomes;
	const n = o.length || 1;
	const frac = (f: (x: Outcome) => boolean) => o.filter(f).length / n;
	const lostO = o.filter((x) => x.lostAt !== null);
	const wd = lostO.filter((x) => x.wanderDir !== null);
	const adjT = o.reduce((a, x) => a + x.adjTurns, 0);
	const adjB = o.reduce((a, x) => a + x.adjButBlind, 0);
	return {
		id: sr.id,
		kind: sr.kind,
		n: o.length,
		lost: frac((x) => x.lostAt !== null),
		lostAtMed: median(lostO.map((x) => x.lostAt as number)),
		reacq: lostO.length
			? lostO.filter((x) => x.reacq).length / lostO.length
			: 0,
		escaped: frac((x) => !x.tracking && x.endDist > 2),
		far6: frac((x) => !x.tracking && x.endDist > 6),
		adjEnd: frac((x) => x.endDist <= 1),
		within2End: frac((x) => x.endDist <= 2),
		chaseAvg: o.reduce((a, x) => a + x.chaseTurns, 0) / n,
		wanderAvg: o.reduce((a, x) => a + x.wanderTurns, 0) / n,
		reached: lostO.length
			? lostO.filter((x) => x.lostHow === "reached").length / lostO.length
			: 0,
		blocked: lostO.length
			? lostO.filter((x) => x.lostHow === "blocked").length / lostO.length
			: 0,
		wanderAway: wd.length
			? wd.filter((x) => (x.wanderDir as number) > 0).length / wd.length
			: 0,
		adjBlind: adjT ? adjB / adjT : 0,
		turnsMed: median(o.map((x) => x.turns)) ?? 0,
	};
};
