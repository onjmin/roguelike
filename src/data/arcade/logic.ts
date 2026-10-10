// ゲームセンターの 筐体の ゲームの 決まり（板＝ui/arcadeAction.ts・ui/arcadeTiming.ts は 描く だけ）。
// どれも 状態 + step(状態, 秒, 入力, 乱数) の 形で、DOM も 時計も 見ない（src/sim/arcadeTests.ts が 種つきの 乱数で 回す）。
// 座標は 板の 240x150（上の 14px は スコアの 帯）。乱数は 見た目だけ（板は Math.random。冒険の 乱数に さわらない）。

export type Rnd = () => number;

export const AW = 240;
export const AH = 150;
/** スコアの 帯の 下（遊ぶ 場所の 上はし）。 */
export const ATOP = 14;

const clamp = (v: number, lo: number, hi: number): number =>
	Math.max(lo, Math.min(hi, v));
/** 0〜1 の 進みで a から b へ。 */
const lerp = (a: number, b: number, k: number): number =>
	a + (b - a) * clamp(k, 0, 1);
const pick = <T>(xs: readonly T[], rnd: Rnd): T =>
	xs[Math.floor(rnd() * xs.length) % xs.length] as T;
/** 目当ての 位置へ 速さ v で 寄せる。 */
const approach = (x: number, to: number, v: number): number =>
	x < to ? Math.min(to, x + v) : Math.max(to, x - v);

// ───────────────── シューティング「荒らし撃退」 ─────────────────
// 上から 荒らしの レスが 降りてくる。自機（キリコ）は 下で 左右に 動いて 撃つ。
// 荒らしが 下まで 来るか 自機に ぶつかると 残機が 1つ 減る。60秒 しのぐか 残機が なくなったら おわり。

export const SH = {
	time: 60,
	lives: 3,
	shipY: 134,
	shipW: 12,
	speed: 170,
	shot: 240,
	cool: 0.2,
	maxShots: 3,
	foeW: 18,
	foeH: 11,
	/** 残った 残機 1つの ボーナス（60秒 しのいだ とき）。 */
	lifeBonus: 100,
} as const;

/** 荒＝ふつう・煽＝速くて 左右に ゆれる・粘＝2発 いる。 */
export type ShKind = "are" | "aori" | "neba";
export const SH_KIND: Record<
	ShKind,
	{ glyph: string; score: number; hp: number }
> = {
	are: { glyph: "荒", score: 10, hp: 1 },
	aori: { glyph: "煽", score: 20, hp: 1 },
	neba: { glyph: "粘", score: 30, hp: 2 },
};

export type ShFoe = {
	x: number;
	y: number;
	kind: ShKind;
	hp: number;
	vy: number;
	/** ゆれの 位相（煽）。 */
	ph: number;
	/** 撃たれて 光る 残り秒。 */
	flash: number;
};

export type ShState = {
	t: number;
	x: number;
	target: number;
	shots: { x: number; y: number }[];
	foes: ShFoe[];
	lives: number;
	score: number;
	cool: number;
	spawn: number;
	/** 被弾して 点滅する 残り秒。 */
	hurt: number;
	over: boolean;
};

export type ShEvent = "shot" | "hit" | "kill" | "hurt" | "breach" | "clear";

export const shStart = (): ShState => ({
	t: 0,
	x: AW / 2,
	target: AW / 2,
	shots: [],
	foes: [],
	lives: SH.lives,
	score: 0,
	cool: 0,
	spawn: 0.8,
	hurt: 0,
	over: false,
});

export const shStep = (
	s: ShState,
	dt: number,
	ip: { target?: number; fire: boolean },
	rnd: Rnd,
): ShEvent[] => {
	const ev: ShEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	const k = s.t / SH.time;
	if (ip.target !== undefined)
		s.target = clamp(ip.target, SH.shipW / 2, AW - SH.shipW / 2);
	s.x = approach(s.x, s.target, SH.speed * dt);
	s.cool = Math.max(0, s.cool - dt);
	s.hurt = Math.max(0, s.hurt - dt);
	if (ip.fire && s.cool === 0 && s.shots.length < SH.maxShots) {
		s.shots.push({ x: s.x, y: SH.shipY - 6 });
		s.cool = SH.cool;
		ev.push("shot");
	}
	for (const b of s.shots) b.y -= SH.shot * dt;
	s.shots = s.shots.filter((b) => b.y > ATOP);
	// 出る 間は 1.2秒 → 0.45秒。速さも 上がる
	s.spawn -= dt;
	if (s.spawn <= 0) {
		s.spawn = lerp(1.2, 0.45, k) * (0.7 + rnd() * 0.6);
		const r = rnd();
		const kind: ShKind =
			s.t > 15 && r < 0.2 ? "neba" : s.t > 8 && r < 0.45 ? "aori" : "are";
		const base = kind === "aori" ? 34 : kind === "neba" ? 14 : 20;
		s.foes.push({
			x: SH.foeW / 2 + rnd() * (AW - SH.foeW),
			y: ATOP - SH.foeH / 2,
			kind,
			hp: SH_KIND[kind].hp,
			vy: base * lerp(1, 2.2, k),
			ph: rnd() * Math.PI * 2,
			flash: 0,
		});
	}
	for (const f of s.foes) {
		f.y += f.vy * dt;
		f.flash = Math.max(0, f.flash - dt);
		if (f.kind === "aori") {
			f.ph += dt * 3;
			f.x = clamp(
				f.x + Math.cos(f.ph) * 40 * dt,
				SH.foeW / 2,
				AW - SH.foeW / 2,
			);
		}
	}
	// 弾と 荒らし
	for (const b of s.shots) {
		const f = s.foes.find(
			(f) =>
				f.hp > 0 &&
				Math.abs(b.x - f.x) <= SH.foeW / 2 + 1 &&
				Math.abs(b.y - f.y) <= SH.foeH / 2 + 3,
		);
		if (!f) continue;
		b.y = -99;
		f.hp--;
		f.flash = 0.12;
		if (f.hp <= 0) {
			s.score += SH_KIND[f.kind].score;
			ev.push("kill");
		} else ev.push("hit");
	}
	s.shots = s.shots.filter((b) => b.y > ATOP);
	// 自機に ぶつかる・下まで 来る
	for (const f of s.foes) {
		if (f.hp <= 0) continue;
		if (
			Math.abs(f.x - s.x) <= (SH.foeW + SH.shipW) / 2 - 2 &&
			Math.abs(f.y - SH.shipY) <= SH.foeH / 2 + 4
		) {
			f.hp = 0;
			s.lives--;
			s.hurt = 1;
			ev.push("hurt");
		} else if (f.y - SH.foeH / 2 > SH.shipY + 8) {
			f.hp = 0;
			s.lives--;
			s.hurt = 1;
			ev.push("breach");
		}
	}
	s.foes = s.foes.filter((f) => f.hp > 0);
	if (s.lives <= 0) {
		s.lives = 0;
		s.over = true;
	} else if (s.t >= SH.time) {
		s.score += s.lives * SH.lifeBonus;
		s.over = true;
		ev.push("clear");
	}
	return ev;
};

// ───────────────── レースゲーム「保守ドライブ」 ─────────────────
// 3車線の 道を 上へ 走る。コーンと 荒らしの 車を よけて、保守の 札を 拾う。ぶつかったら おわり。
// 速さは だんだん 上がる。スコアは 走った きょり ＋ 札。

export const DR = {
	lanes: [90, 120, 150] as readonly number[],
	roadL: 72,
	roadR: 168,
	carY: 124,
	carH: 14,
	carW: 12,
	obH: 12,
	pickup: 50,
	/** 1点 ＝ この px。 */
	perPoint: 8,
} as const;

export type DrKind = "cone" | "car" | "hoshu";
export type DrThing = { lane: number; y: number; kind: DrKind };
export type DrState = {
	t: number;
	lane: number;
	/** 車線を かえる 見た目（-1〜1 → 0）。 */
	slide: number;
	dist: number;
	gap: number;
	things: DrThing[];
	bonus: number;
	over: boolean;
};
export type DrEvent = "move" | "pickup" | "crash";

export const drStart = (): DrState => ({
	t: 0,
	lane: 1,
	slide: 0,
	dist: 0,
	gap: 40,
	things: [],
	bonus: 0,
	over: false,
});

export const drSpeed = (t: number): number => Math.min(200, 70 + t * 3.2);
export const drScore = (s: DrState): number =>
	Math.floor(s.dist / DR.perPoint) + s.bonus;

export const drStep = (
	s: DrState,
	dt: number,
	move: -1 | 0 | 1,
	rnd: Rnd,
): DrEvent[] => {
	const ev: DrEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	if (move !== 0) {
		const to = clamp(s.lane + move, 0, DR.lanes.length - 1);
		if (to !== s.lane) {
			s.slide = -move;
			s.lane = to;
			ev.push("move");
		}
	}
	s.slide = approach(s.slide, 0, dt * 8);
	const v = drSpeed(s.t);
	const d = v * dt;
	s.dist += d;
	for (const o of s.things) o.y += d;
	s.things = s.things.filter((o) => o.y < AH + DR.obH);
	// 次の 列（間は 速さに あわせて 広げる：ぶつかる 前に 2車線 動ける）
	s.gap -= d;
	if (s.gap <= 0) {
		s.gap = Math.max(34, v * 0.5) + rnd() * 30;
		const two = rnd() < lerp(0.1, 0.45, s.t / 60);
		const lanes = [0, 1, 2].sort(() => rnd() - 0.5);
		const block = lanes.slice(0, two ? 2 : 1);
		for (const lane of block)
			s.things.push({
				lane,
				y: ATOP - DR.obH,
				kind: rnd() < 0.4 ? "car" : "cone",
			});
		const free = lanes[two ? 2 : 1];
		if (free !== undefined && rnd() < 0.2)
			s.things.push({ lane: free, y: ATOP - DR.obH, kind: "hoshu" });
	}
	for (const o of s.things) {
		if (o.lane !== s.lane) continue;
		const overlap =
			Math.abs(o.y - DR.carY) <= (DR.obH + DR.carH) / 2 - 2 &&
			Math.abs(s.slide) < 0.5;
		if (!overlap) continue;
		if (o.kind === "hoshu") {
			o.y = AH + 99;
			s.bonus += DR.pickup;
			ev.push("pickup");
		} else {
			s.over = true;
			ev.push("crash");
			break;
		}
	}
	return ev;
};

// ───────────────── ブロックくずし「スレ崩し」 ─────────────────
// 上に ならんだ スレの 札を 球で くずす。板（パドル）で はね返す。ぜんぶ くずすと 次の 板（球が 速く なる）。
// 球を 3回 のがしたら おわり。

export const BK = {
	cols: 8,
	rows: 5,
	bw: 28,
	bh: 8,
	bx: 4,
	by: 22,
	gap: 1,
	padY: 136,
	padW: 34,
	padSpeed: 220,
	r: 2,
	lives: 3,
	brick: 10,
	waveBonus: 200,
	/** 板で はね返す ときの いちばん 小さい かたむき（ラジアン）。 */
	minTilt: 0.25,
} as const;

export type BkState = {
	bricks: boolean[];
	pad: number;
	target: number;
	ball: { x: number; y: number; vx: number; vy: number };
	/** 球が 板に のって いる（A／タップで 打ちだす）。 */
	held: boolean;
	lives: number;
	score: number;
	wave: number;
	hits: number;
	over: boolean;
};
export type BkEvent = "launch" | "wall" | "paddle" | "brick" | "lost" | "wave";

const bkFull = (): boolean[] =>
	Array.from({ length: BK.cols * BK.rows }, () => true);

export const bkStart = (): BkState => ({
	bricks: bkFull(),
	pad: AW / 2,
	target: AW / 2,
	ball: { x: AW / 2, y: BK.padY - BK.r - 1, vx: 0, vy: 0 },
	held: true,
	lives: BK.lives,
	score: 0,
	wave: 1,
	hits: 0,
	over: false,
});

export const bkSpeed = (s: BkState): number =>
	Math.min(230, 115 + (s.wave - 1) * 18 + s.hits * 0.6);

/** 札の 四角（左上と 大きさ）。 */
export const bkRect = (i: number): [number, number, number, number] => [
	BK.bx + (i % BK.cols) * (BK.bw + BK.gap),
	BK.by + Math.floor(i / BK.cols) * (BK.bh + BK.gap),
	BK.bw,
	BK.bh,
];

export const bkStep = (
	s: BkState,
	dt: number,
	ip: { target?: number; launch: boolean },
	rnd: Rnd,
): BkEvent[] => {
	const ev: BkEvent[] = [];
	if (s.over) return ev;
	if (ip.target !== undefined)
		s.target = clamp(ip.target, BK.padW / 2, AW - BK.padW / 2);
	s.pad = approach(s.pad, s.target, BK.padSpeed * dt);
	const b = s.ball;
	if (s.held) {
		b.x = s.pad;
		b.y = BK.padY - BK.r - 1;
		if (ip.launch) {
			s.held = false;
			const sp = bkSpeed(s);
			const a = (rnd() < 0.5 ? -1 : 1) * (0.35 + rnd() * 0.25);
			b.vx = Math.sin(a) * sp;
			b.vy = -Math.cos(a) * sp;
			ev.push("launch");
		}
		return ev;
	}
	// すりぬけないように 細かく 刻む
	const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 2));
	const h = dt / steps;
	for (let i = 0; i < steps && !s.held; i++) {
		const px = b.x;
		const py = b.y;
		b.x += b.vx * h;
		b.y += b.vy * h;
		if (b.x < BK.r) {
			b.x = BK.r;
			b.vx = Math.abs(b.vx);
			ev.push("wall");
		} else if (b.x > AW - BK.r) {
			b.x = AW - BK.r;
			b.vx = -Math.abs(b.vx);
			ev.push("wall");
		}
		if (b.y < ATOP + BK.r) {
			b.y = ATOP + BK.r;
			b.vy = Math.abs(b.vy);
			ev.push("wall");
		}
		// 板
		if (
			b.vy > 0 &&
			b.y + BK.r >= BK.padY &&
			py + BK.r <= BK.padY + 1 &&
			Math.abs(b.x - s.pad) <= BK.padW / 2 + BK.r
		) {
			const off = clamp((b.x - s.pad) / (BK.padW / 2), -1, 1);
			// 60度ほど まで。まっすぐ 上下に 行き来しない ように 少しは かたむける
			const a =
				Math.abs(off) < BK.minTilt / 1.05
					? (off < 0 || (off === 0 && rnd() < 0.5) ? -1 : 1) * BK.minTilt
					: off * 1.05;
			const sp = bkSpeed(s);
			b.vx = Math.sin(a) * sp;
			b.vy = -Math.cos(a) * sp;
			b.y = BK.padY - BK.r;
			ev.push("paddle");
		}
		// 札（1刻みに 1つ）
		const hit = s.bricks.findIndex((on, j) => {
			if (!on) return false;
			const [x, y, w, hh] = bkRect(j);
			return (
				b.x + BK.r > x &&
				b.x - BK.r < x + w &&
				b.y + BK.r > y &&
				b.y - BK.r < y + hh
			);
		});
		if (hit >= 0) {
			s.bricks[hit] = false;
			s.hits++;
			s.score += BK.brick;
			const [x, , w] = bkRect(hit);
			// 横から 入ったら 左右、上下から なら 上下に はね返す
			if (px + BK.r <= x || px - BK.r >= x + w) b.vx = -b.vx;
			else b.vy = -b.vy;
			ev.push("brick");
			if (!s.bricks.some(Boolean)) {
				s.score += BK.waveBonus * s.wave;
				s.wave++;
				s.bricks = bkFull();
				s.held = true;
				ev.push("wave");
			}
		}
		if (b.y - BK.r > AH) {
			s.lives--;
			s.held = true;
			ev.push("lost");
			if (s.lives <= 0) {
				s.lives = 0;
				s.over = true;
			}
		}
	}
	return ev;
};

// ───────────────── もぐらたたき「ROMたたき」 ─────────────────
// 3×3 の 穴から ROM専（名無し）が 顔を 出す。たたくと 書きこむ（+10）。ときどき 出る イッチは たたかない（−30）。
// 30秒。

export const ML = {
	time: 30,
	cells: 9,
	rom: 10,
	icchi: -30,
	maxUp: 3,
} as const;

export type MlKind = "rom" | "icchi";
export type MlHole = {
	kind: MlKind | null;
	/** 引っこむ までの 秒。 */
	left: number;
	/** たたかれた 見た目の 残り秒（そのあいだは 出ない）。 */
	bonk: number;
	bonkKind: MlKind | null;
};
export type MlState = {
	t: number;
	holes: MlHole[];
	next: number;
	score: number;
	hits: number;
	over: boolean;
};
export type MlEvent = "pop" | "bonk" | "ouch" | "whiff";

export const mlStart = (): MlState => ({
	t: 0,
	holes: Array.from({ length: ML.cells }, () => ({
		kind: null,
		left: 0,
		bonk: 0,
		bonkKind: null,
	})),
	next: 0.6,
	score: 0,
	hits: 0,
	over: false,
});

export const mlStep = (
	s: MlState,
	dt: number,
	hits: readonly number[],
	rnd: Rnd,
): MlEvent[] => {
	const ev: MlEvent[] = [];
	if (s.over) return ev;
	for (const i of hits) {
		const h = s.holes[i];
		if (!h) continue;
		if (h.kind === "rom") {
			s.score += ML.rom;
			s.hits++;
			ev.push("bonk");
		} else if (h.kind === "icchi") {
			s.score = Math.max(0, s.score + ML.icchi);
			ev.push("ouch");
		} else {
			ev.push("whiff");
			continue;
		}
		h.bonkKind = h.kind;
		h.kind = null;
		h.bonk = 0.35;
	}
	s.t += dt;
	const k = s.t / ML.time;
	for (const h of s.holes) {
		h.bonk = Math.max(0, h.bonk - dt);
		if (h.bonk === 0) h.bonkKind = null;
		if (h.kind) {
			h.left -= dt;
			if (h.left <= 0) h.kind = null;
		}
	}
	s.next -= dt;
	if (s.next <= 0) {
		s.next = lerp(0.75, 0.32, k) * (0.6 + rnd() * 0.8);
		const up = s.holes.filter((h) => h.kind).length;
		const free = s.holes
			.map((h, i) => (h.kind || h.bonk > 0 ? -1 : i))
			.filter((i) => i >= 0);
		if (up < ML.maxUp && free.length) {
			const h = s.holes[pick(free, rnd)];
			if (h) {
				h.kind = rnd() < 0.16 ? "icchi" : "rom";
				h.left = lerp(1.25, 0.6, k) * (0.8 + rnd() * 0.4);
				ev.push("pop");
			}
		}
	}
	if (s.t >= ML.time) s.over = true;
	return ev;
};

// ───────────────── 格ゲー「レスバトル」 ─────────────────
// 相手が「！」と 構えて なぐる 直前に A で 返す（論破）。早すぎる・何もしない と こちらが 1つ 減る。
// 構えて やめる フェイントも ある。5人 勝ちぬいたら おわり（クリア）、こちらの 体力が なくなっても おわり。

export type FtFoe = {
	name: string;
	hp: number;
	/** 待つ 秒（はば）。 */
	idle: readonly [number, number];
	/** 構えてから なぐるまで。 */
	wind: number;
	/** 返せる はば（なぐる 直前の この 秒）。 */
	guard: number;
	feint: number;
};

export const FT_FOES: readonly FtFoe[] = [
	{
		name: "煽りカス",
		hp: 3,
		idle: [0.8, 1.6],
		wind: 0.8,
		guard: 0.34,
		feint: 0.1,
	},
	{
		name: "論破厨",
		hp: 3,
		idle: [0.6, 1.5],
		wind: 0.65,
		guard: 0.3,
		feint: 0.18,
	},
	{
		name: "レスバ常勝",
		hp: 4,
		idle: [0.5, 1.4],
		wind: 0.55,
		guard: 0.26,
		feint: 0.22,
	},
	{
		name: "有識者",
		hp: 4,
		idle: [0.4, 1.3],
		wind: 0.46,
		guard: 0.22,
		feint: 0.26,
	},
	{
		name: "ネ申",
		hp: 5,
		idle: [0.35, 1.2],
		wind: 0.38,
		guard: 0.19,
		feint: 0.3,
	},
];

export const FT = {
	hp: 5,
	counter: 100,
	ko: 500,
	/** クリアの とき 残った 体力 1つの ボーナス。 */
	hpBonus: 200,
	/** なぐる 時刻を 過ぎても 返せる 猶予。 */
	late: 0.06,
	/** フェイントは 構えの この 割合で やめる（返せる はばより 前）。 */
	feintAt: 0.4,
} as const;

export type FtPhase =
	| "idle"
	| "wind"
	| "feint"
	| "counter"
	| "stun"
	| "ko"
	| "done";
export type FtState = {
	foe: number;
	foeHp: number;
	hp: number;
	phase: FtPhase;
	t: number;
	dur: number;
	score: number;
	ko: number;
	clear: boolean;
	over: boolean;
};
export type FtEvent =
	| "wind"
	| "counter"
	| "early"
	| "hit"
	| "feint"
	| "ko"
	| "next"
	| "clear"
	| "lose";

const ftIdle = (s: FtState, rnd: Rnd, short = false): void => {
	const f = FT_FOES[s.foe] ?? FT_FOES[0];
	if (!f) return;
	s.phase = "idle";
	s.t = 0;
	s.dur = short
		? 0.3 + rnd() * 0.4
		: f.idle[0] + rnd() * (f.idle[1] - f.idle[0]);
};

export const ftStart = (): FtState => ({
	foe: 0,
	foeHp: FT_FOES[0]?.hp ?? 3,
	hp: FT.hp,
	phase: "idle",
	t: 0,
	dur: 1.2,
	score: 0,
	ko: 0,
	clear: false,
	over: false,
});

/** 返せる はばに 入って いるか（構えの 中）。 */
export const ftInWindow = (s: FtState): boolean => {
	const f = FT_FOES[s.foe];
	return !!f && s.phase === "wind" && s.t >= f.wind - f.guard;
};

export const ftStep = (
	s: FtState,
	dt: number,
	press: boolean,
	rnd: Rnd,
): FtEvent[] => {
	const ev: FtEvent[] = [];
	const f = FT_FOES[s.foe];
	if (s.over || !f) return ev;
	const stun = (e: FtEvent) => {
		s.hp--;
		s.phase = "stun";
		s.t = 0;
		s.dur = 0.7;
		ev.push(e);
	};
	if (press) {
		if (s.phase === "wind" && ftInWindow(s)) {
			s.foeHp--;
			s.score += FT.counter;
			s.phase = "counter";
			s.t = 0;
			s.dur = 0.55;
			ev.push("counter");
		} else if (s.phase === "idle" || s.phase === "wind" || s.phase === "feint")
			stun("early");
	}
	s.t += dt;
	if (s.t < s.dur) return ev;
	switch (s.phase) {
		case "idle":
			s.t = 0;
			if (rnd() < f.feint) {
				s.phase = "feint";
				s.dur = f.wind * FT.feintAt;
			} else {
				s.phase = "wind";
				s.dur = f.wind + FT.late;
			}
			ev.push("wind");
			break;
		case "feint":
			ev.push("feint");
			ftIdle(s, rnd, true);
			break;
		case "wind":
			stun("hit");
			break;
		case "counter":
		case "stun":
			if (s.foeHp <= 0) {
				s.score += FT.ko;
				s.ko++;
				s.hp = Math.min(FT.hp, s.hp + 1);
				s.phase = "ko";
				s.t = 0;
				s.dur = 1.2;
				ev.push("ko");
			} else if (s.hp <= 0) {
				s.hp = 0;
				s.phase = "done";
				s.over = true;
				ev.push("lose");
			} else ftIdle(s, rnd);
			break;
		case "ko":
			if (s.foe + 1 >= FT_FOES.length) {
				s.score += s.hp * FT.hpBonus;
				s.clear = true;
				s.phase = "done";
				s.over = true;
				ev.push("clear");
			} else {
				s.foe++;
				s.foeHp = FT_FOES[s.foe]?.hp ?? 3;
				ftIdle(s, rnd);
				ev.push("next");
			}
			break;
		case "done":
			break;
	}
	return ev;
};

// ───────────────── ジャンプアクション「なんJラン」 ─────────────────
// 右へ 走る キリコを A で 跳ばせて、荒らしの 石を よける。ぶつかったら おわり。速さは だんだん 上がる。

export const RN = {
	x: 36,
	w: 10,
	h: 14,
	groundY: 120,
	jump: 215,
	gravity: 640,
	/** 着く 前の この 秒の A は 着いた ときに 跳ぶ。 */
	buffer: 0.12,
	perPoint: 8,
} as const;

export type RnRock = { x: number; w: number; h: number };
export type RnState = {
	t: number;
	/** 地面からの 高さ。 */
	y: number;
	vy: number;
	buffered: number;
	dist: number;
	gap: number;
	rocks: RnRock[];
	over: boolean;
};
export type RnEvent = "jump" | "land" | "crash";

export const rnStart = (): RnState => ({
	t: 0,
	y: 0,
	vy: 0,
	buffered: 0,
	dist: 0,
	gap: 160,
	rocks: [],
	over: false,
});

export const rnSpeed = (t: number): number => Math.min(210, 90 + t * 3.5);
export const rnScore = (s: RnState): number => Math.floor(s.dist / RN.perPoint);

export const rnStep = (
	s: RnState,
	dt: number,
	press: boolean,
	rnd: Rnd,
): RnEvent[] => {
	const ev: RnEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	if (press) s.buffered = RN.buffer;
	const ground = s.y === 0 && s.vy === 0;
	if (ground && s.buffered > 0) {
		s.vy = RN.jump;
		s.buffered = 0;
		ev.push("jump");
	}
	s.buffered = Math.max(0, s.buffered - dt);
	if (s.y > 0 || s.vy > 0) {
		s.vy -= RN.gravity * dt;
		s.y += s.vy * dt;
		if (s.y <= 0) {
			s.y = 0;
			s.vy = 0;
			ev.push("land");
		}
	}
	const v = rnSpeed(s.t);
	const d = v * dt;
	s.dist += d;
	for (const r of s.rocks) r.x -= d;
	s.rocks = s.rocks.filter((r) => r.x + r.w > -4);
	// 次の 石（間は 速さに あわせて 広げる：着いてから 跳び直せる）
	s.gap -= d;
	if (s.gap <= 0) {
		const air = (2 * RN.jump) / RN.gravity;
		s.gap = v * air * (1.1 + rnd() * 0.9);
		const w = 8 + Math.floor(rnd() * 3) * 5;
		s.rocks.push({ x: AW + 4, w, h: 10 + Math.floor(rnd() * 3) * 5 });
	}
	for (const r of s.rocks) {
		const hitX = r.x < RN.x + RN.w / 2 - 2 && r.x + r.w > RN.x - RN.w / 2 + 2;
		if (hitX && s.y < r.h - 2) {
			s.over = true;
			ev.push("crash");
			break;
		}
	}
	return ev;
};

// ───────────────── メダルゲーム「メダルスロット」 ─────────────────
// メダル 10枚から。A で 1枚 入れて 回し、A で 左から 1つずつ 止める（目押し）。まんなかの 列が 3つ そろえば 払いだし。
// メダルが なくなるか、B で やめたら おわり。スコアは いちばん 多く 持った 枚数。

export const SL_SYMS = ["7", "ID", "鯖", "草", "ｗ", "乙"] as const;
export type SlSym = (typeof SL_SYMS)[number];
/** 3つ そろった ときの 払いだし。 */
export const SL_PAY: Record<SlSym, number> = {
	"7": 50,
	ID: 20,
	鯖: 12,
	草: 8,
	ｗ: 5,
	乙: 3,
};
/** リールの 並び（12コマ。7 は 1つずつ）。 */
export const SL_REELS: readonly (readonly SlSym[])[] = [
	["7", "乙", "ｗ", "草", "乙", "鯖", "ｗ", "ID", "乙", "草", "ｗ", "乙"],
	["乙", "ｗ", "7", "草", "乙", "ID", "ｗ", "鯖", "乙", "草", "乙", "ｗ"],
	["ｗ", "乙", "草", "ID", "乙", "ｗ", "7", "乙", "鯖", "ｗ", "草", "乙"],
];
export const SL = {
	start: 10,
	cap: 999,
	/** 1秒に 進む コマ。 */
	spin: 7,
	pay: 0.9,
} as const;

export type SlPhase = "idle" | "spin" | "pay";
export type SlState = {
	medals: number;
	best: number;
	phase: SlPhase;
	pos: number[];
	stopped: boolean[];
	t: number;
	lastWin: number;
	spins: number;
	over: boolean;
};
export type SlEvent = "bet" | "stop" | "win" | "lose" | "bust";

export const slStart = (): SlState => ({
	medals: SL.start,
	best: SL.start,
	phase: "idle",
	pos: [0, 4, 8],
	stopped: [true, true, true],
	t: 0,
	lastWin: 0,
	spins: 0,
	over: false,
});

/** まんなかの 列に 見えて いる コマ。 */
export const slAt = (reel: number, pos: number): SlSym => {
	const r = SL_REELS[reel] ?? SL_REELS[0] ?? [];
	const n = r.length;
	return r[(((Math.round(pos) % n) + n) % n) as number] ?? "乙";
};

export const slLine = (s: SlState): SlSym[] =>
	[0, 1, 2].map((i) => slAt(i, s.pos[i] ?? 0));

export const slStep = (s: SlState, dt: number, press: boolean): SlEvent[] => {
	const ev: SlEvent[] = [];
	if (s.over) return ev;
	if (s.phase === "idle" && press) {
		s.medals--;
		s.spins++;
		s.phase = "spin";
		s.stopped = [false, false, false];
		s.lastWin = 0;
		ev.push("bet");
		press = false;
	}
	if (s.phase === "spin") {
		for (let i = 0; i < 3; i++)
			if (!s.stopped[i]) s.pos[i] = ((s.pos[i] ?? 0) + SL.spin * dt) % 12;
		if (press) {
			const i = s.stopped.indexOf(false);
			if (i >= 0) {
				s.pos[i] = Math.round(s.pos[i] ?? 0) % 12;
				s.stopped[i] = true;
				ev.push("stop");
			}
			if (s.stopped.every(Boolean)) {
				const [a, b, c] = slLine(s);
				s.phase = "pay";
				s.t = 0;
				if (a && a === b && b === c) {
					s.lastWin = SL_PAY[a];
					s.medals = Math.min(SL.cap, s.medals + s.lastWin);
					s.best = Math.max(s.best, s.medals);
					ev.push("win");
				} else ev.push("lose");
			}
		}
	} else if (s.phase === "pay") {
		s.t += dt;
		if (s.t >= SL.pay) {
			s.phase = "idle";
			if (s.medals <= 0) {
				s.over = true;
				ev.push("bust");
			} else if (s.medals >= SL.cap) s.over = true;
		}
	}
	return ev;
};

// ───────────────── 音ゲー「保守ビート」 ─────────────────
// 4つの 道に 落ちてくる 札を、線に 重なった ときに たたく。←↓↑→ か 道を タップ。
// 譜面は 決まった 1曲（種つきの 乱数で 作る。毎回 同じ）。

export const RH = {
	bpm: 132,
	lanes: 4,
	judgeY: 124,
	/** 札が 落ちる 速さ（px／秒）。 */
	speed: 110,
	perfect: 0.05,
	great: 0.1,
	good: 0.15,
	/** はじめの 札まで（拍）。 */
	lead: 4,
	beats: 64,
	fullCombo: 1000,
} as const;

export type RhJudge = "perfect" | "great" | "good" | "miss";
export const RH_SCORE: Record<RhJudge, number> = {
	perfect: 100,
	great: 60,
	good: 20,
	miss: 0,
};
export type RhNote = { at: number; lane: number; judged: RhJudge | null };
export type RhState = {
	t: number;
	notes: RhNote[];
	score: number;
	combo: number;
	maxCombo: number;
	counts: Record<RhJudge, number>;
	over: boolean;
};
export type RhEvent = { judge: RhJudge; lane: number };

/** 種つきの 乱数（譜面を 毎回 同じに）。 */
const seededRnd = (seed: number): Rnd => {
	let x = seed >>> 0 || 1;
	return () => {
		x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
		return x / 2 ** 32;
	};
};

/** 譜面（秒と 道）。前半は 拍、後半は 裏拍と 2つ 押しも。同じ 道に 半拍で 続けない。 */
export const rhChart = (): { at: number; lane: number }[] => {
	const rnd = seededRnd(20261010);
	const beat = 60 / RH.bpm;
	const out: { at: number; lane: number }[] = [];
	let last = -1;
	const lane = (avoid: number): number => {
		let l = Math.floor(rnd() * RH.lanes);
		if (l === avoid)
			l = (l + 1 + Math.floor(rnd() * (RH.lanes - 1))) % RH.lanes;
		return l;
	};
	for (let i = 0; i < RH.beats; i++) {
		const at = (RH.lead + i) * beat;
		const part = i / RH.beats;
		// 4拍目ごとに 休む（前半）
		if (part < 0.5 && i % 4 === 3 && rnd() < 0.6) continue;
		last = lane(last);
		out.push({ at, lane: last });
		if (part >= 0.75 && i % 4 === 0) {
			const other = lane(last);
			out.push({ at, lane: other });
		}
		if (part >= 0.5 && rnd() < 0.35) {
			last = lane(last);
			out.push({ at: at + beat / 2, lane: last });
		}
	}
	return out;
};

export const rhStart = (): RhState => ({
	t: 0,
	notes: rhChart().map((n) => ({ ...n, judged: null })),
	score: 0,
	combo: 0,
	maxCombo: 0,
	counts: { perfect: 0, great: 0, good: 0, miss: 0 },
	over: false,
});

export const rhJudgeOf = (diff: number): RhJudge | null => {
	const d = Math.abs(diff);
	return d <= RH.perfect
		? "perfect"
		: d <= RH.great
			? "great"
			: d <= RH.good
				? "good"
				: null;
};

const rhMark = (s: RhState, n: RhNote, j: RhJudge, ev: RhEvent[]): void => {
	n.judged = j;
	s.counts[j]++;
	s.score += RH_SCORE[j];
	if (j === "miss") s.combo = 0;
	else {
		s.combo++;
		s.maxCombo = Math.max(s.maxCombo, s.combo);
	}
	ev.push({ judge: j, lane: n.lane });
};

/** hits は たたいた 道と 曲の 中の 秒（押した 時刻）。 */
export const rhStep = (
	s: RhState,
	dt: number,
	hits: readonly { lane: number; at: number }[],
): RhEvent[] => {
	const ev: RhEvent[] = [];
	if (s.over) return ev;
	for (const h of hits) {
		let best: RhNote | null = null;
		for (const n of s.notes)
			if (
				!n.judged &&
				n.lane === h.lane &&
				Math.abs(n.at - h.at) <= RH.good &&
				(!best || Math.abs(n.at - h.at) < Math.abs(best.at - h.at))
			)
				best = n;
		const j = best && rhJudgeOf(best.at - h.at);
		if (best && j) rhMark(s, best, j, ev);
	}
	s.t += dt;
	for (const n of s.notes)
		if (!n.judged && s.t - n.at > RH.good) rhMark(s, n, "miss", ev);
	const end = (s.notes[s.notes.length - 1]?.at ?? 0) + 1;
	if (s.t >= end) {
		s.over = true;
		if (s.counts.miss === 0) s.score += RH.fullCombo;
	}
	return ev;
};
