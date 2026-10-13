// キリコの 家に 置く ゲームの 決まり（2026-10-13 作者：「マイハウスに ミニゲーム系の 家具を。マリオみたいな
// 横スクロールや ボンバーマンみたいな ミニゲーム」）。板は ui/arcade/arcadeHome.ts、文は data/arcade/text.ts。
// DOM に 触らない（試験できる）。乱数は 渡された rnd（見た目の 乱数。冒険には 効かない）。
//
// - 横スクロール「スーパーキリコ」（platform）：右へ 走って 跳び、旗まで。コースは 区間の つなぎあわせ
//   （穴・？ブロックの 列・土管の あいだの ぷゆゆ・ピラミッド・動く 足場・浮いた レンガ・敵の 群れ）で、奥ほど
//   穴が 広く 敵が 多い。敵は 歩く ぷゆゆと 跳ねて 寄ってくる 荒らし。上から 踏むと 倒せて、着地まで 続けて
//   踏むと 点が 倍に なる。？ブロックは 下から たたくと 🥺（まれに 1UP）。まんなかに 中間旗（そこから 再開）、
//   おわりは 階段と 旗竿（高く つかまる ほど 点）。残機 3。スコア＝ためた 点＋旗で のこり 時間×10。
// - ボンバー「荒らし爆破」（bomber）：迷路で 爆弾を 置き、レス（こわせる ブロック）と 荒らしを 吹きとばす。
//   レスの 下には 火（爆風が のびる）・爆（置ける 数）・速（足）が かくれる。荒らしを ぜんぶ たおすと 次の 面
//   （5面で クリア）。2面からは 近づくと 追ってくる 粘着が まざる。1つの 爆風で まとめて たおすと 点が 倍。
//   爆風か 荒らしに ふれると 残機が 減る（残機 3）。スコア＝ためた 点（面クリアで のこり 時間×10）。

import { AH, ATOP, AW, type Rnd } from "./logic";

// ───────────────── 横スクロール ─────────────────

/** 板の 字。 */
export const PF_TEXT = {
	check: "中間",
	oneUp: "1UP",
	note: "タップ　左右＝歩く　まんなか＝跳ぶ",
} as const;

export const PF = {
	/** 1マスの 大きさ（画素）。 */
	cell: 12,
	/** コースの 長さ（マス）。 */
	length: 170,
	/** 地面の 厚さ（マス）。 */
	ground: 2,
	speed: 72,
	jump: 245,
	gravity: 700,
	/** 落ちる ときの いちばん 速い 速さ。 */
	maxFall: 320,
	enemySpeed: 20,
	/** 荒らしの 横の 速さと 跳ねる 強さ・間（秒）。 */
	hopSpeed: 30,
	hop: 200,
	hopEvery: 1.1,
	time: 100,
	lives: 3,
	/** やられた あとの 止まり・再開の あとの 無敵（秒）。 */
	deadTime: 0.8,
	inv: 1.6,
	/** 足場の はしを 出ても 跳べる 間・着く 前に 押した 跳びを おぼえる 間（秒）。 */
	coyote: 0.08,
	buffer: 0.12,
	maxLives: 5,
	/** コースの 敵の 少なくとも の 数。 */
	minFoes: 9,
} as const;

/** マスの 中身。0 は 空、ほかは 固い。 */
export const PT = {
	empty: 0,
	ground: 1,
	brick: 2,
	/** ？ブロック（🥺）。 */
	q: 3,
	/** たたいた あとの ブロック。 */
	used: 4,
	pipe: 5,
	stone: 6,
	/** ？ブロック（1UP。見た目は q と 同じ）。 */
	oneUp: 7,
} as const;

/** 画面の 段の 数（帯の 下）。 */
const ROWS = Math.floor((AH - ATOP) / PF.cell);
/** 持つ 段の 数（地面 2段＋その 上）。段 r（-2〜）は 高さ r×cell〜(r+1)×cell。 */
const NR = ROWS;
/** キリコの 半分の 幅と 背の 高さ（画素）。 */
const PW = 3.5;
const PH = 13;

export type PfEnemyKind = "puyu" | "arashi";
export type PfEnemy = {
	kind: PfEnemyKind;
	x: number;
	y: number;
	vx: number;
	vy: number;
	ground: boolean;
	/** 荒らしが 次に 跳ねるまで。 */
	hopT: number;
	/** 踏まれて つぶれている 秒（0 で 生きている、-1 で 消す）。 */
	dead: number;
	/** 画面に 近づいて 動きだした。 */
	awake: boolean;
};
export type PfCoin = { x: number; y: number; got: boolean };
/** 横に 行き来する 足場（穴の 上）。 */
export type PfLift = {
	x0: number;
	x1: number;
	y: number;
	w: number;
	sp: number;
	ph: number;
};
/** 浮かぶ 点（コースの 画素。t は 経った 秒）。 */
export type PfPop = { x: number; y: number; text: string; t: number };
export type PfState = {
	t: number;
	/** キリコの 足もと（画素。x は コースの 左から、y は 地面からの 高さ）。 */
	x: number;
	y: number;
	vy: number;
	ground: boolean;
	coyote: number;
	buf: number;
	/** 乗っている 足場（-1 で なし）と その 前の x。 */
	lift: number;
	liftX: number;
	/** マス [x][段+2]。 */
	tiles: number[][];
	lifts: PfLift[];
	enemies: PfEnemy[];
	coins: PfCoin[];
	pops: PfPop[];
	coinsGot: number;
	stomps: number;
	/** 着地せずに 続けて 踏んだ 数。 */
	chain: number;
	points: number;
	lives: number;
	inv: number;
	deadT: number;
	/** 中間旗の x（画素）と 通ったか。 */
	check: number;
	checkGot: boolean;
	/** 旗竿に つかまった 高さ（-1 は まだ）。 */
	flagY: number;
	over: boolean;
	clear: boolean;
};
export type PfEvent =
	| "jump"
	| "coin"
	| "bump"
	| "block"
	| "oneup"
	| "stomp"
	| "fall"
	| "hit"
	| "check"
	| "goal"
	| "over";

/** 旗竿の マス。その 9マス 手前から 階段。 */
const POLE = PF.length - 8;
const STAIRS = POLE - 9;

export const pfGoalX = (): number => POLE * PF.cell;
/** 旗竿の 高さ（画素）。 */
export const PF_POLE_H = 8 * PF.cell;

/** 旗竿に つかまった 高さ → 点。 */
export const pfFlagBonus = (y: number): number =>
	y >= 90 ? 2000 : y >= 66 ? 800 : y >= 42 ? 400 : y >= 18 ? 200 : 100;

/** その マスの 中身（コースの 左の 外は かべ）。 */
export const pfTile = (s: PfState, mx: number, r: number): number => {
	if (mx < 0) return PT.stone;
	if (mx >= s.tiles.length || r < -2 || r >= NR - 2) return PT.empty;
	return s.tiles[mx][r + 2];
};
const hitAt = (s: PfState, px: number, py: number): boolean =>
	pfTile(s, Math.floor(px / PF.cell), Math.floor(py / PF.cell)) !== PT.empty;

/** 足場の いまの 左はし（画素）。 */
export const pfLiftX = (l: PfLift, t: number): number =>
	l.x0 + (l.x1 - l.x0) * (0.5 - 0.5 * Math.cos(t * l.sp + l.ph));

/** その 列の いちばん 上の 固い マスの 上（なければ 0）。 */
const topOf = (s: PfState, mx: number): number => {
	for (let r = NR - 3; r >= -2; r--)
		if (pfTile(s, mx, r) !== PT.empty) return (r + 1) * PF.cell;
	return 0;
};

export const pfStart = (rnd: Rnd): PfState => {
	const c = PF.cell;
	const L = PF.length;
	const tiles = Array.from({ length: L }, () => {
		const col = Array<number>(NR).fill(PT.empty);
		col[0] = PT.ground;
		col[1] = PT.ground;
		return col;
	});
	const set = (mx: number, r: number, k: number) => {
		if (mx >= 0 && mx < L && r >= -2 && r < NR - 2) tiles[mx][r + 2] = k;
	};
	const hole = (mx: number, w: number) => {
		for (let i = 0; i < w; i++) {
			set(mx + i, -1, PT.empty);
			set(mx + i, -2, PT.empty);
		}
	};
	const pipe = (mx: number, h: number) => {
		for (let r = 0; r < h; r++) {
			set(mx, r, PT.pipe);
			set(mx + 1, r, PT.pipe);
		}
	};
	const enemies: PfEnemy[] = [];
	const coins: PfCoin[] = [];
	const lifts: PfLift[] = [];
	const foe = (kind: PfEnemyKind, mx: number) =>
		enemies.push({
			kind,
			x: mx * c + c / 2,
			y: 0,
			vx: -(kind === "puyu" ? PF.enemySpeed : PF.hopSpeed),
			vy: 0,
			ground: true,
			hopT: 0.4 + rnd() * PF.hopEvery,
			dead: 0,
			awake: false,
		});
	const coin = (x: number, y: number) => coins.push({ x, y, got: false });
	const mid = Math.floor(L / 2);
	let check = 0;
	let oneUps = 0;
	for (let x = 14; x < STAIRS - 12; ) {
		// 中間旗の まわりは 平らに
		if (!check && x >= mid) {
			check = (x + 2) * c;
			x += 6;
			continue;
		}
		const p = x / L;
		const r = rnd();
		if (r < 0.17) {
			// 穴（奥ほど 広い）と 上の 🥺 の 弧
			const w = 2 + Math.floor(rnd() * (p < 0.4 ? 2 : 3));
			hole(x + 2, w);
			const cx = (x + 2 + w / 2) * c;
			coin(cx - c, 28);
			coin(cx, 38);
			coin(cx + c, 28);
			x += w + 5;
		} else if (r < 0.32) {
			// ？ブロックと レンガの 列（下から たたく）
			for (let i = 0; i < 5; i++) set(x + 2 + i, 3, i % 2 ? PT.brick : PT.q);
			if (oneUps < 1 && rnd() < 0.4) {
				set(x + 4, 3, PT.oneUp);
				oneUps++;
			}
			if (rnd() < 0.4 + p * 0.4) foe("puyu", x + 7);
			x += 9;
		} else if (r < 0.46) {
			// 土管 2本と あいだの ぷゆゆ（行き来する）
			const h1 = 2 + (rnd() < p ? 1 : 0);
			const h2 = 2 + (rnd() < p ? 1 : 0);
			pipe(x + 1, h1);
			pipe(x + 6, h2);
			foe("puyu", x + 4);
			coin((x + 2) * c, h1 * c + 10);
			coin((x + 7) * c, h2 * c + 10);
			x += 10;
		} else if (r < 0.59) {
			// ピラミッド（奥では てっぺんに 穴）
			const g = p < 0.35 ? 0 : 2;
			for (let i = 0; i < 3; i++)
				for (let rr = 0; rr <= i; rr++) set(x + 1 + i, rr, PT.stone);
			if (g) hole(x + 4, g);
			for (let i = 0; i < 3; i++)
				for (let rr = 0; rr <= 2 - i; rr++) set(x + 4 + g + i, rr, PT.stone);
			coin((x + 4 + g / 2) * c, 54);
			x += 8 + g;
		} else if (r < 0.71 && p > 0.15) {
			// 広い 穴と 行き来する 足場
			const w = 6;
			hole(x + 1, w);
			lifts.push({
				x0: (x + 1) * c,
				x1: (x + 1 + w - 3) * c,
				y: 0,
				w: 3 * c,
				sp: 1.2 + p,
				ph: rnd() * 6,
			});
			coin((x + 4) * c, 30);
			x += w + 3;
		} else if (r < 0.83) {
			// 浮いた レンガ（上に 🥺）と その 上の ？ブロック、下に ぷゆゆ
			for (let i = 0; i < 4; i++) {
				set(x + 2 + i, 2, PT.brick);
				coin((x + 2 + i) * c + c / 2, 44);
			}
			set(x + 4, 6, PT.q);
			if (rnd() < 0.6) foe("puyu", x + 3);
			x += 8;
		} else {
			// 敵の 群れ（奥ほど 荒らしが 多い）
			foe(p > 0.25 && rnd() < 0.3 + p * 0.5 ? "arashi" : "puyu", x + 4);
			if (p > 0.45 && rnd() < 0.5) foe("puyu", x + 6);
			x += 8 + Math.floor(rnd() * 3);
		}
	}
	// 敵が 少ない コースは 平らな ところに 足す（中間旗と 出だしの まわりは よける）
	const flat = (mx: number) =>
		[-1, 0, 1].every(
			(d) => tiles[mx + d][1] !== PT.empty && tiles[mx + d][2] === PT.empty,
		);
	const spots: number[] = [];
	for (let mx = 18; mx < STAIRS - 2; mx++)
		if (
			flat(mx) &&
			Math.abs(mx * c - check) > c * 4 &&
			!enemies.some((e) => Math.abs(e.x - mx * c) < c * 4)
		)
			spots.push(mx);
	while (enemies.length < PF.minFoes && spots.length) {
		const [mx] = spots.splice(Math.floor(rnd() * spots.length), 1);
		foe(mx > L / 2 && rnd() < 0.5 ? "arashi" : "puyu", mx);
		for (let i = spots.length - 1; i >= 0; i--)
			if (Math.abs(spots[i] - mx) < 4) spots.splice(i, 1);
	}
	// おわりの 階段（5段＋てっぺん 2マス）と 旗竿
	for (let i = 0; i < 7; i++)
		for (let rr = 0; rr <= Math.min(i, 4); rr++) set(STAIRS + i, rr, PT.stone);
	return {
		t: 0,
		x: c * 3,
		y: 0,
		vy: 0,
		ground: true,
		coyote: 0,
		buf: 0,
		lift: -1,
		liftX: 0,
		tiles,
		lifts,
		enemies,
		coins,
		pops: [],
		coinsGot: 0,
		stomps: 0,
		chain: 0,
		points: 0,
		lives: PF.lives,
		inv: 0,
		deadT: 0,
		check: check || c * 3,
		checkGot: false,
		flagY: -1,
		over: false,
		clear: false,
	};
};

export const pfTimeLeft = (s: PfState): number =>
	Math.max(0, Math.ceil(PF.time - s.t));
export const pfScore = (s: PfState): number =>
	s.points + (s.clear ? pfTimeLeft(s) * 10 : 0);

const pop = (s: PfState, x: number, y: number, text: string): void => {
	s.pops.push({ x, y, text, t: 0 });
};

const die = (s: PfState, why: PfEvent, ev: PfEvent[]): void => {
	ev.push(why);
	s.lives--;
	s.deadT = PF.deadTime;
	s.chain = 0;
	s.lift = -1;
};

const respawn = (s: PfState): void => {
	s.x = s.checkGot ? s.check : PF.cell * 3;
	s.y = topOf(s, Math.floor(s.x / PF.cell));
	s.vy = 0;
	s.ground = true;
	s.inv = PF.inv;
	s.lift = -1;
};

/** 横に 動く（かべで 止まる）。 */
const moveX = (s: PfState, dx: number): void => {
	if (!dx) return;
	const c = PF.cell;
	let nx = s.x + dx;
	for (const yy of [s.y + 1, s.y + PH / 2, s.y + PH - 1]) {
		if (dx > 0 && hitAt(s, nx + PW, yy))
			nx = Math.floor((nx + PW) / c) * c - PW - 0.01;
		else if (dx < 0 && hitAt(s, nx - PW, yy))
			nx = (Math.floor((nx - PW) / c) + 1) * c + PW + 0.01;
	}
	s.x = nx;
};

/** 下から たたいた マス。 */
const bump = (s: PfState, mx: number, r: number, ev: PfEvent[]): void => {
	const c = PF.cell;
	const k = pfTile(s, mx, r);
	const cx = mx * c + c / 2;
	if (k === PT.q) {
		s.tiles[mx][r + 2] = PT.used;
		s.coinsGot++;
		s.points += 10;
		pop(s, cx, (r + 1) * c + 4, "+10");
		ev.push("bump");
	} else if (k === PT.oneUp) {
		s.tiles[mx][r + 2] = PT.used;
		s.lives = Math.min(PF.maxLives, s.lives + 1);
		pop(s, cx, (r + 1) * c + 4, PF_TEXT.oneUp);
		ev.push("oneup");
	} else ev.push("block");
	// 上に 乗った 敵は はじかれて たおれる
	for (const e of s.enemies)
		if (
			e.dead === 0 &&
			Math.abs(e.x - cx) < c &&
			Math.abs(e.y - (r + 1) * c) < 2
		) {
			e.dead = 0.5;
			s.points += 100;
			pop(s, e.x, e.y + 12, "+100");
			ev.push("stomp");
		}
};

/** 踏んだ 点（着地まで 続けると 倍）。 */
const stompPoints = (s: PfState, e: PfEnemy): number =>
	(e.kind === "arashi" ? 100 : 50) * 2 ** Math.min(4, s.chain);

const stepPlayer = (s: PfState, h: number, dir: number, ev: PfEvent[]) => {
	const c = PF.cell;
	// 足場に 乗って いれば いっしょに 動く
	if (s.lift >= 0) {
		const lx = pfLiftX(s.lifts[s.lift], s.t);
		moveX(s, lx - s.liftX);
		s.liftX = lx;
	}
	moveX(s, dir * PF.speed * h);
	if (s.buf > 0 && s.coyote > 0) {
		s.vy = PF.jump;
		s.coyote = 0;
		s.buf = 0;
		s.lift = -1;
		ev.push("jump");
	}
	s.vy = Math.max(-PF.maxFall, s.vy - PF.gravity * h);
	const ny = s.y + s.vy * h;
	const xs = [s.x - PW + 0.5, s.x + PW - 0.5];
	let landed = false;
	if (s.vy <= 0) {
		const top = (Math.floor(ny / c) + 1) * c;
		if (top <= s.y + 0.01 && xs.some((xx) => hitAt(s, xx, ny))) {
			s.y = top;
			s.vy = 0;
			landed = true;
			s.lift = -1;
		} else {
			s.lift = -1;
			for (let i = 0; i < s.lifts.length; i++) {
				const l = s.lifts[i];
				const lx = pfLiftX(l, s.t);
				if (
					s.y >= l.y - 0.01 &&
					ny <= l.y &&
					s.x + PW > lx &&
					s.x - PW < lx + l.w
				) {
					s.y = l.y;
					s.vy = 0;
					landed = true;
					s.lift = i;
					s.liftX = lx;
					break;
				}
			}
			if (!landed) s.y = ny;
		}
	} else {
		const head = ny + PH;
		const r = Math.floor(head / c);
		const hits = xs.filter((xx) => hitAt(s, xx, head));
		if (hits.length && r * c >= s.y + PH - 0.01) {
			s.y = r * c - PH;
			s.vy = 0;
			// たたくのは まんなかの 上の マス（なければ 角の マス）
			const mx0 = Math.floor(s.x / c);
			bump(
				s,
				pfTile(s, mx0, r) !== PT.empty ? mx0 : Math.floor(hits[0] / c),
				r,
				ev,
			);
		} else s.y = ny;
	}
	s.ground = landed;
	if (landed) {
		s.coyote = PF.coyote;
		s.chain = 0;
	} else s.coyote -= h;
};

const stepEnemy = (s: PfState, e: PfEnemy, h: number): void => {
	const c = PF.cell;
	if (e.kind === "arashi" && e.ground) {
		e.hopT -= h;
		if (e.hopT <= 0) {
			e.hopT = PF.hopEvery;
			e.vy = PF.hop;
			e.ground = false;
			e.vx = (s.x < e.x ? -1 : 1) * PF.hopSpeed;
		}
	}
	const nx = e.x + e.vx * h;
	const ahead = nx + Math.sign(e.vx) * 5;
	if (hitAt(s, ahead, e.y + 1) || hitAt(s, ahead, e.y + 8)) e.vx = -e.vx;
	else if (e.ground && !hitAt(s, ahead, e.y - 1)) e.vx = -e.vx;
	else e.x = nx;
	e.vy = Math.max(-PF.maxFall, e.vy - PF.gravity * h);
	const ny = e.y + e.vy * h;
	if (e.vy <= 0) {
		const top = (Math.floor(ny / c) + 1) * c;
		if (top <= e.y + 0.01 && (hitAt(s, e.x - 3, ny) || hitAt(s, e.x + 3, ny))) {
			e.y = top;
			e.vy = 0;
			e.ground = true;
		} else {
			e.y = ny;
			e.ground = false;
		}
	} else if (hitAt(s, e.x, ny + 10)) e.vy = 0;
	else e.y = ny;
	if (e.y < -c * 3) e.dead = -1;
};

export const pfStep = (
	s: PfState,
	dt: number,
	input: { dir: -1 | 0 | 1; jump: boolean },
): PfEvent[] => {
	const ev: PfEvent[] = [];
	if (s.over) return ev;
	for (const p of s.pops) p.t += dt;
	s.pops = s.pops.filter((p) => p.t < 0.9);
	if (s.deadT > 0) {
		s.deadT -= dt;
		if (s.deadT <= 0) {
			if (s.lives <= 0) {
				s.over = true;
				ev.push("over");
			} else respawn(s);
		}
		return ev;
	}
	if (input.jump) s.buf = PF.buffer;
	const c = PF.cell;
	const n = Math.max(1, Math.ceil(dt / 0.01));
	const h = dt / n;
	for (let i = 0; i < n && !s.over && s.deadT <= 0; i++) {
		s.t += h;
		s.inv = Math.max(0, s.inv - h);
		s.buf -= h;
		if (s.t >= PF.time) {
			s.over = true;
			ev.push("over");
			break;
		}
		stepPlayer(s, h, input.dir, ev);
		if (s.y < -c * 3) {
			die(s, "fall", ev);
			break;
		}
		for (const e of s.enemies) {
			if (e.dead !== 0) {
				if (e.dead > 0) {
					e.dead -= h;
					if (e.dead <= 0) e.dead = -1;
				}
				continue;
			}
			if (!e.awake && Math.abs(e.x - s.x) < AW * 0.8) e.awake = true;
			if (!e.awake) continue;
			stepEnemy(s, e, h);
			if (Math.abs(e.x - s.x) < PW + 4.5 && s.y < e.y + 10 && s.y + PH > e.y) {
				if (s.vy < 0 && s.y > e.y + 3) {
					const pts = stompPoints(s, e);
					e.dead = 0.4;
					e.vx = 0;
					s.points += pts;
					s.stomps++;
					s.chain++;
					s.vy = PF.jump * (s.buf > 0 ? 0.9 : 0.6);
					s.buf = 0;
					pop(s, e.x, e.y + 14, `+${pts}`);
					ev.push("stomp");
				} else if (s.inv <= 0) {
					die(s, "hit", ev);
					break;
				}
			}
		}
		if (s.deadT > 0) break;
		for (const k of s.coins)
			if (!k.got && Math.abs(k.x - s.x) < 8 && Math.abs(k.y - (s.y + 7)) < 10) {
				k.got = true;
				s.coinsGot++;
				s.points += 10;
				ev.push("coin");
			}
		if (!s.checkGot && s.x >= s.check && s.check > c * 3) {
			s.checkGot = true;
			pop(s, s.check, 40, PF_TEXT.check);
			ev.push("check");
		}
		if (s.x >= pfGoalX()) {
			s.flagY = Math.min(PF_POLE_H, Math.max(0, s.y));
			const b = pfFlagBonus(s.flagY);
			s.points += b;
			pop(s, pfGoalX(), s.flagY + 16, `+${b}`);
			s.over = true;
			s.clear = true;
			ev.push("goal");
		}
	}
	s.enemies = s.enemies.filter((e) => e.dead !== -1);
	return ev;
};

/** 画面の 左はし（キリコが 左から 1/3 の 位置）。 */
export const pfCam = (s: PfState): number =>
	Math.max(0, Math.min(PF.length * PF.cell - AW, s.x - AW / 3));

/** 地面の 画面の y（下から h 画素の 高さ）。 */
export const pfScreenY = (h: number): number =>
	ATOP + (ROWS - PF.ground) * PF.cell - h;

// ───────────────── ボンバー ─────────────────

/** 板の 字。 */
export const BM_TEXT = {
	stage: "STAGE {n}",
	stageUnit: "面",
	fire: "火",
	bomb: "爆",
	speed: "速",
	arashi: "荒",
	nenchaku: "粘",
	note: "タップした　マスへ　歩く・自分で　爆弾",
} as const;

export const BM = {
	cell: 12,
	cols: 19,
	rows: 11,
	fuse: 1.8,
	blastLife: 0.45,
	/** 爆風の はじめの 長さ・いちばん 長い とき。 */
	range: 2,
	maxRange: 6,
	/** 置ける 爆弾の はじめの 数・いちばん 多い とき。 */
	bombs: 1,
	maxBombs: 5,
	/** 1マス 動く 秒（速の 数ごと）。 */
	steps: [0.17, 0.13, 0.1],
	/** 荒らしが 1マス 動く 秒（1面・面ごとに 縮む 分・いちばん 速い とき）。 */
	enemyStep: 0.55,
	enemyStepUp: 0.05,
	enemyFastest: 0.3,
	/** 粘着が 追いはじめる 近さ（マス）。 */
	chase: 7,
	stages: 5,
	time: 90,
	lives: 3,
	inv: 2,
	deadTime: 1,
	/** 面の あいだの 止まり（秒）。 */
	pause: 1.6,
} as const;

/** 迷路の マス：# かべ（こわせない）・r レス（こわせる）・. 通れる。 */
export type BmCell = "#" | "r" | ".";
export type BmBomb = { x: number; y: number; t: number };
export type BmBlast = { x: number; y: number; t: number };
export type BmEnemyKind = "arashi" | "nenchaku";
export type BmEnemy = {
	kind: BmEnemyKind;
	x: number;
	y: number;
	t: number;
	/** 進んでいる 向き（DIRS の 番号）。 */
	d: number;
	alive: boolean;
};
export type BmItemKind = "fire" | "bomb" | "speed";
export type BmItem = { x: number; y: number; kind: BmItemKind; shown: boolean };
export type BmPop = { x: number; y: number; text: string; t: number };
export type BmState = {
	t: number;
	/** その 面の 経った 秒。 */
	stageT: number;
	stage: number;
	grid: BmCell[][];
	px: number;
	py: number;
	moveT: number;
	bombs: BmBomb[];
	blasts: BmBlast[];
	enemies: BmEnemy[];
	items: BmItem[];
	pops: BmPop[];
	range: number;
	maxBombs: number;
	speed: number;
	broken: number;
	killed: number;
	/** 続けて たおした 数と その 残り 秒（1つの 爆風の あいだ）。 */
	chain: number;
	chainT: number;
	points: number;
	lives: number;
	inv: number;
	deadT: number;
	/** 面の あいだの 止まり（0 で 遊べる）。 */
	pause: number;
	over: boolean;
	clear: boolean;
};
export type BmEvent =
	| "bomb"
	| "boom"
	| "kill"
	| "dead"
	| "clear"
	| "stage"
	| "step"
	| "power"
	| "over";

const DIRS = [
	[0, -1],
	[0, 1],
	[-1, 0],
	[1, 0],
] as const;

/** 面を つくる（迷路・荒らし・かくれた 力）。 */
const bmStage = (s: BmState, rnd: Rnd): void => {
	const grid: BmCell[][] = [];
	for (let y = 0; y < BM.rows; y++) {
		const row: BmCell[] = [];
		for (let x = 0; x < BM.cols; x++) {
			const edge = x === 0 || y === 0 || x === BM.cols - 1 || y === BM.rows - 1;
			const pillar = x % 2 === 0 && y % 2 === 0;
			row.push(edge || pillar ? "#" : rnd() < 0.42 ? "r" : ".");
		}
		grid.push(row);
	}
	// 左上は あける（置いて 逃げる すきま）
	for (const [x, y] of [
		[1, 1],
		[2, 1],
		[1, 2],
	])
		grid[y][x] = ".";
	const enemies: BmEnemy[] = [];
	const n = Math.min(7, 3 + s.stage);
	const chasers = Math.min(3, s.stage - 1);
	for (let i = 0; i < 300 && enemies.length < n; i++) {
		const x = 1 + Math.floor(rnd() * (BM.cols - 2));
		const y = 1 + Math.floor(rnd() * (BM.rows - 2));
		if (grid[y][x] === "#" || x + y < 8) continue;
		if (enemies.some((e) => e.x === x && e.y === y)) continue;
		grid[y][x] = ".";
		enemies.push({
			kind: enemies.length < chasers ? "nenchaku" : "arashi",
			x,
			y,
			t: rnd() * BM.enemyStep,
			d: Math.floor(rnd() * 4),
			alive: true,
		});
	}
	// レスの 下に かくれた 力（火 2・爆 2・速 1）
	const rez: [number, number][] = [];
	for (let y = 0; y < BM.rows; y++)
		for (let x = 0; x < BM.cols; x++) if (grid[y][x] === "r") rez.push([x, y]);
	const items: BmItem[] = [];
	for (const kind of ["fire", "fire", "bomb", "bomb", "speed"] as const) {
		if (!rez.length) break;
		const [[x, y]] = rez.splice(Math.floor(rnd() * rez.length), 1);
		items.push({ x, y, kind, shown: false });
	}
	s.grid = grid;
	s.enemies = enemies;
	s.items = items;
	s.bombs = [];
	s.blasts = [];
	s.px = 1;
	s.py = 1;
	s.stageT = 0;
	s.inv = 0;
};

export const bmStart = (rnd: Rnd): BmState => {
	const s: BmState = {
		t: 0,
		stageT: 0,
		stage: 1,
		grid: [],
		px: 1,
		py: 1,
		moveT: 0,
		bombs: [],
		blasts: [],
		enemies: [],
		items: [],
		pops: [],
		range: BM.range,
		maxBombs: BM.bombs,
		speed: 0,
		broken: 0,
		killed: 0,
		chain: 0,
		chainT: 0,
		points: 0,
		lives: BM.lives,
		inv: 0,
		deadT: 0,
		pause: 0,
		over: false,
		clear: false,
	};
	bmStage(s, rnd);
	return s;
};

const open = (s: BmState, x: number, y: number): boolean =>
	s.grid[y]?.[x] === "." && !s.bombs.some((b) => b.x === x && b.y === y);

/** (x, y) から (tx, ty) へ 通れる マスを たどる 最初の 1歩（届かなければ null）。 */
export const bmPathStep = (
	s: BmState,
	x: number,
	y: number,
	tx: number,
	ty: number,
): readonly [number, number] | null => {
	if (x === tx && y === ty) return null;
	const W = BM.cols;
	const from = new Map<number, number>([[y * W + x, -1]]);
	const q = [y * W + x];
	while (q.length) {
		const k = q.shift() as number;
		const cx = k % W;
		const cy = Math.floor(k / W);
		if (cx === tx && cy === ty) {
			let cur = k;
			while (from.get(cur) !== y * W + x) cur = from.get(cur) as number;
			return [(cur % W) - x, Math.floor(cur / W) - y];
		}
		for (const [dx, dy] of DIRS) {
			const nk = (cy + dy) * W + cx + dx;
			if (!from.has(nk) && open(s, cx + dx, cy + dy)) {
				from.set(nk, k);
				q.push(nk);
			}
		}
	}
	return null;
};

export const bmTimeLeft = (s: BmState): number =>
	Math.max(0, Math.ceil(BM.time - s.stageT));
export const bmScore = (s: BmState): number => s.points;
export const bmStepTime = (s: BmState): number =>
	BM.steps[Math.min(BM.steps.length - 1, s.speed)];
const enemyStep = (s: BmState, e: BmEnemy): number =>
	Math.max(BM.enemyFastest, BM.enemyStep - (s.stage - 1) * BM.enemyStepUp) *
	(e.kind === "nenchaku" ? 1.25 : 1);

const bmPop = (s: BmState, x: number, y: number, text: string): void => {
	s.pops.push({ x, y, text, t: 0 });
};

export const bmStep = (
	s: BmState,
	dt: number,
	input: { dx: number; dy: number; bomb: boolean },
	rnd: Rnd,
): BmEvent[] => {
	const ev: BmEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	for (const p of s.pops) p.t += dt;
	s.pops = s.pops.filter((p) => p.t < 0.9);
	if (s.pause > 0) {
		s.pause -= dt;
		if (s.pause <= 0) {
			s.stage++;
			bmStage(s, rnd);
			ev.push("stage");
		}
		return ev;
	}
	if (s.deadT > 0) {
		s.deadT -= dt;
		if (s.deadT <= 0) {
			if (s.lives <= 0) {
				s.over = true;
				ev.push("over");
				return ev;
			}
			s.px = 1;
			s.py = 1;
			s.bombs = [];
			s.blasts = [];
			s.inv = BM.inv;
		}
		return ev;
	}
	s.stageT += dt;
	s.inv = Math.max(0, s.inv - dt);
	if (s.stageT >= BM.time) {
		s.over = true;
		ev.push("over");
		return ev;
	}
	// 動く（押している あいだ 1マスずつ）
	s.moveT = Math.max(0, s.moveT - dt);
	if ((input.dx || input.dy) && s.moveT === 0) {
		const nx = s.px + Math.sign(input.dx);
		const ny = s.py + (input.dx ? 0 : Math.sign(input.dy));
		if (open(s, nx, ny)) {
			s.px = nx;
			s.py = ny;
			ev.push("step");
		}
		s.moveT = bmStepTime(s);
	}
	// 力を 拾う
	const it = s.items.find((i) => i.shown && i.x === s.px && i.y === s.py);
	if (it) {
		s.items = s.items.filter((i) => i !== it);
		if (it.kind === "fire") s.range = Math.min(BM.maxRange, s.range + 1);
		else if (it.kind === "bomb")
			s.maxBombs = Math.min(BM.maxBombs, s.maxBombs + 1);
		else s.speed = Math.min(BM.steps.length - 1, s.speed + 1);
		s.points += 50;
		bmPop(s, s.px, s.py, BM_TEXT[it.kind]);
		ev.push("power");
	}
	if (
		input.bomb &&
		!s.bombs.some((b) => b.x === s.px && b.y === s.py) &&
		s.bombs.length < s.maxBombs
	) {
		s.bombs.push({ x: s.px, y: s.py, t: BM.fuse });
		ev.push("bomb");
	}
	// 爆弾（爆風に ふれた 爆弾も 同じ こまで 爆ぜる）
	for (const b of s.bombs) b.t -= dt;
	for (;;) {
		const fire = s.bombs.filter((b) => b.t <= 0);
		if (!fire.length) break;
		s.bombs = s.bombs.filter((b) => b.t > 0);
		for (const b of fire) {
			ev.push("boom");
			s.blasts.push({ x: b.x, y: b.y, t: BM.blastLife });
			for (const [dx, dy] of DIRS)
				for (let i = 1; i <= s.range; i++) {
					const x = b.x + dx * i;
					const y = b.y + dy * i;
					const c = s.grid[y]?.[x];
					if (c === "#" || c === undefined) break;
					s.blasts.push({ x, y, t: BM.blastLife });
					if (c === "r") {
						s.grid[y][x] = ".";
						s.broken++;
						s.points += 10;
						for (const m of s.items) if (m.x === x && m.y === y) m.shown = true;
						break;
					}
					for (const o of s.bombs) if (o.x === x && o.y === y) o.t = 0;
				}
		}
	}
	for (const f of s.blasts) f.t -= dt;
	s.blasts = s.blasts.filter((f) => f.t > 0);
	const burning = (x: number, y: number) =>
		s.blasts.some((f) => f.x === x && f.y === y);
	s.chainT -= dt;
	if (s.chainT <= 0) s.chain = 0;
	// 荒らし（まっすぐ 進み、ときどき 曲がる。粘着は 近いと 追う。燃える マスには 入らない）
	for (const e of s.enemies) {
		if (!e.alive) continue;
		if (burning(e.x, e.y)) {
			e.alive = false;
			s.killed++;
			const pts = 100 * 2 ** Math.min(3, s.chain);
			s.chain++;
			s.chainT = BM.blastLife + 0.1;
			s.points += pts;
			bmPop(s, e.x, e.y, `+${pts}`);
			ev.push("kill");
			continue;
		}
		e.t -= dt;
		if (e.t > 0) continue;
		e.t = enemyStep(s, e);
		const safe = (d: number) =>
			open(s, e.x + DIRS[d][0], e.y + DIRS[d][1]) &&
			!burning(e.x + DIRS[d][0], e.y + DIRS[d][1]);
		let d = -1;
		if (
			e.kind === "nenchaku" &&
			Math.abs(e.x - s.px) + Math.abs(e.y - s.py) <= BM.chase
		) {
			const st = bmPathStep(s, e.x, e.y, s.px, s.py);
			if (st) d = DIRS.findIndex(([dx, dy]) => dx === st[0] && dy === st[1]);
			if (d >= 0 && !safe(d)) d = -1;
		}
		if (d < 0) {
			const ways = [0, 1, 2, 3].filter(safe);
			const back = e.d ^ 1;
			const turn = ways.filter((w) => w !== back);
			if (safe(e.d) && rnd() > 0.2) d = e.d;
			else if (turn.length) d = turn[Math.floor(rnd() * turn.length)];
			else if (ways.length) d = ways[0];
		}
		if (d >= 0) {
			e.d = d;
			e.x += DIRS[d][0];
			e.y += DIRS[d][1];
		}
	}
	if (
		s.inv <= 0 &&
		(burning(s.px, s.py) ||
			s.enemies.some((e) => e.alive && e.x === s.px && e.y === s.py))
	) {
		s.lives--;
		s.deadT = BM.deadTime;
		ev.push("dead");
		return ev;
	}
	if (s.enemies.every((e) => !e.alive)) {
		s.points += bmTimeLeft(s) * 10;
		ev.push("clear");
		if (s.stage >= BM.stages) {
			s.over = true;
			s.clear = true;
		} else s.pause = BM.pause;
	}
	return ev;
};

/** 迷路の 左上（画面の 画素。帯の 下に まんなか ぞろえ）。 */
export const bmOrigin = (): readonly [number, number] => [
	Math.floor((AW - BM.cols * BM.cell) / 2),
	ATOP + Math.floor((AH - ATOP - BM.rows * BM.cell) / 2),
];
