// ゲームセンターの 筐体の ゲームの 決まり（板＝ui/arcade/arcadeAction.ts・ui/arcade/arcadeTiming.ts は 描く だけ）。
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

/** 点が 入った 所（板が 数字を 浮かべる）。step の たびに 空に する。 */
export type ArcPop = { x: number; y: number; pts: number };

// ───────────────── シューティング「荒らし撃退」 ─────────────────
// 上から 荒らしの レスが 降りてくる。自機（キリコ）は 下で 左右に 動いて 撃つ。
// 荒らしが 下まで 来るか 自機に ぶつかると 残機が 1つ 減る。60秒 しのぐか 残機が なくなったら おわり。
// - 続けて 倒すと 倍率が 上がる（×4 まで）。被弾・通すと もどる。
// - 倒すと ときどき「規制」の 札が 降る。拾うと しばらく 3方向に 撃てる。
// - 22秒から コピペ（倒すと 2つに 割れる）。45秒で 本体の「自演」が 出る（倒すと その場で クリア）。

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
	/** 残った 残機 1つの ボーナス（クリアの とき）。 */
	lifeBonus: 100,
	/** 倍率が 1つ 上がる 撃破数。 */
	chainStep: 8,
	maxMult: 4,
	/** 規制の 札：出る 確率・効く 秒・降る 速さ。 */
	dropRate: 0.08,
	power: 7,
	itemV: 40,
	/** 本体「自演」。 */
	bossAt: 45,
	bossY: 32,
	bossW: 44,
	bossH: 16,
	bossHp: 16,
	bossBonus: 600,
} as const;

/** 荒＝ふつう・煽＝速くて 左右に ゆれる・粘＝2発 いる・コ＝倒すと 2つに 割れる。 */
export type ShKind = "are" | "aori" | "neba" | "kopipe";
export const SH_KIND: Record<
	ShKind,
	{ glyph: string; score: number; hp: number }
> = {
	are: { glyph: "荒", score: 10, hp: 1 },
	aori: { glyph: "煽", score: 20, hp: 1 },
	neba: { glyph: "粘", score: 30, hp: 2 },
	kopipe: { glyph: "コ", score: 15, hp: 1 },
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

export type ShBoss = {
	x: number;
	vx: number;
	hp: number;
	flash: number;
	/** 子分を 出す までの 秒。 */
	spawn: number;
};

export type ShState = {
	t: number;
	x: number;
	target: number;
	shots: { x: number; y: number; vx: number }[];
	foes: ShFoe[];
	lives: number;
	score: number;
	cool: number;
	spawn: number;
	/** 被弾して 点滅する 残り秒。 */
	hurt: number;
	/** 続けて 倒した 数（倍率の もと）。 */
	chain: number;
	/** 3方向に 撃てる 残り秒。 */
	power: number;
	/** 降って くる「規制」の 札。 */
	item: { x: number; y: number } | null;
	boss: ShBoss | null;
	bossSeen: boolean;
	/** 自演を 倒した。 */
	beat: boolean;
	pops: ArcPop[];
	over: boolean;
};

export type ShEvent =
	| "shot"
	| "hit"
	| "kill"
	| "split"
	| "mult"
	| "power"
	| "hurt"
	| "breach"
	| "boss"
	| "bossHit"
	| "bossDown"
	| "clear";

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
	chain: 0,
	power: 0,
	item: null,
	boss: null,
	bossSeen: false,
	beat: false,
	pops: [],
	over: false,
});

/** いまの 倍率。 */
export const shMult = (s: ShState): number =>
	Math.min(SH.maxMult, 1 + Math.floor(s.chain / SH.chainStep));

export const shStep = (
	s: ShState,
	dt: number,
	ip: { target?: number; fire: boolean },
	rnd: Rnd,
): ShEvent[] => {
	const ev: ShEvent[] = [];
	if (s.over) return ev;
	s.pops = [];
	s.t += dt;
	const k = s.t / SH.time;
	const fall = lerp(1, 2.2, k);
	if (ip.target !== undefined)
		s.target = clamp(ip.target, SH.shipW / 2, AW - SH.shipW / 2);
	s.x = approach(s.x, s.target, SH.speed * dt);
	s.cool = Math.max(0, s.cool - dt);
	s.hurt = Math.max(0, s.hurt - dt);
	s.power = Math.max(0, s.power - dt);
	const spread = s.power > 0 ? [-70, 0, 70] : [0];
	if (
		ip.fire &&
		s.cool === 0 &&
		s.shots.length + spread.length <= SH.maxShots * spread.length
	) {
		for (const vx of spread) s.shots.push({ x: s.x, y: SH.shipY - 6, vx });
		s.cool = SH.cool;
		ev.push("shot");
	}
	for (const b of s.shots) {
		b.x += b.vx * dt;
		b.y -= SH.shot * dt;
	}
	s.shots = s.shots.filter((b) => b.y > ATOP && b.x > 0 && b.x < AW);
	// 本体「自演」（ゆききして 子分を 出す。弱るほど 速い）
	if (!s.bossSeen && s.t >= SH.bossAt) {
		s.bossSeen = true;
		s.boss = { x: AW / 2, vx: 40, hp: SH.bossHp, flash: 0, spawn: 1.5 };
		ev.push("boss");
	}
	const boss = s.boss;
	if (boss) {
		boss.flash = Math.max(0, boss.flash - dt);
		const sp = 40 + (1 - boss.hp / SH.bossHp) * 60;
		boss.vx = Math.sign(boss.vx || 1) * sp;
		boss.x += boss.vx * dt;
		if (boss.x < SH.bossW / 2 + 4) boss.vx = sp;
		else if (boss.x > AW - SH.bossW / 2 - 4) boss.vx = -sp;
		boss.spawn -= dt;
		if (boss.spawn <= 0) {
			boss.spawn = 1.6;
			s.foes.push({
				x: clamp(boss.x, SH.foeW / 2, AW - SH.foeW / 2),
				y: SH.bossY + 10,
				kind: "are",
				hp: 1,
				vy: 24 * fall,
				ph: 0,
				flash: 0,
			});
		}
	}
	// 出る 間は 1.2秒 → 0.45秒（自演の ときは 間を あける）。速さも 上がる
	s.spawn -= dt;
	if (s.spawn <= 0) {
		s.spawn = lerp(1.2, 0.45, k) * (0.7 + rnd() * 0.6) * (boss ? 1.8 : 1);
		const r = rnd();
		const kind: ShKind =
			s.t > 22 && r < 0.14
				? "kopipe"
				: s.t > 15 && r < 0.32
					? "neba"
					: s.t > 8 && r < 0.55
						? "aori"
						: "are";
		const base =
			kind === "aori" ? 34 : kind === "neba" ? 14 : kind === "kopipe" ? 18 : 20;
		s.foes.push({
			x: SH.foeW / 2 + rnd() * (AW - SH.foeW),
			y: ATOP - SH.foeH / 2,
			kind,
			hp: SH_KIND[kind].hp,
			vy: base * fall,
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
	// 規制の 札
	if (s.item) {
		s.item.y += SH.itemV * dt;
		if (Math.abs(s.item.x - s.x) <= 11 && Math.abs(s.item.y - SH.shipY) <= 9) {
			s.item = null;
			s.power = SH.power;
			ev.push("power");
		} else if (s.item.y > AH + 6) s.item = null;
	}
	// 弾と 荒らし・自演
	const born: ShFoe[] = [];
	for (const b of s.shots) {
		const bs = s.boss;
		if (
			bs &&
			Math.abs(b.x - bs.x) <= SH.bossW / 2 &&
			Math.abs(b.y - SH.bossY) <= SH.bossH / 2 + 3
		) {
			b.y = -99;
			bs.hp--;
			bs.flash = 0.1;
			if (bs.hp <= 0) {
				const pts = SH.bossBonus * shMult(s);
				s.score += pts;
				s.pops.push({ x: bs.x, y: SH.bossY, pts });
				s.boss = null;
				s.beat = true;
				ev.push("bossDown");
			} else ev.push("bossHit");
			continue;
		}
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
		if (f.hp > 0) {
			ev.push("hit");
			continue;
		}
		const m0 = shMult(s);
		s.chain++;
		const pts = SH_KIND[f.kind].score * m0;
		s.score += pts;
		s.pops.push({ x: f.x, y: f.y, pts });
		ev.push("kill");
		if (shMult(s) > m0) ev.push("mult");
		if (f.kind === "kopipe") {
			for (const dx of [-11, 11])
				born.push({
					x: clamp(f.x + dx, SH.foeW / 2, AW - SH.foeW / 2),
					y: f.y,
					kind: "are",
					hp: 1,
					vy: f.vy * 1.2,
					ph: 0,
					flash: 0.12,
				});
			ev.push("split");
		}
		if (!s.item && s.power === 0 && rnd() < SH.dropRate)
			s.item = { x: f.x, y: f.y };
	}
	s.shots = s.shots.filter((b) => b.y > ATOP);
	s.foes.push(...born);
	// 自機に ぶつかる・下まで 来る
	for (const f of s.foes) {
		if (f.hp <= 0) continue;
		const hit =
			Math.abs(f.x - s.x) <= (SH.foeW + SH.shipW) / 2 - 2 &&
			Math.abs(f.y - SH.shipY) <= SH.foeH / 2 + 4;
		if (!hit && f.y - SH.foeH / 2 <= SH.shipY + 8) continue;
		f.hp = 0;
		s.lives--;
		s.hurt = 1;
		s.chain = 0;
		ev.push(hit ? "hurt" : "breach");
	}
	s.foes = s.foes.filter((f) => f.hp > 0);
	if (s.lives <= 0) {
		s.lives = 0;
		s.over = true;
	} else if (s.beat || s.t >= SH.time) {
		s.score += s.lives * SH.lifeBonus;
		s.over = true;
		ev.push("clear");
	}
	return ev;
};

// ───────────────── ブロックくずし「スレ崩し」 ─────────────────
// 上に ならんだ スレの 札を 球で くずす。板（パドル）で はね返す。ぜんぶ くずすと 次の 面（球が 速く なる）。
// 球を 3回 のがしたら おわり。
// - 面ごとに 並びが かわる。濃い 札は 2回 当てないと 崩れない。
// - 板に もどらずに 続けて 崩すと 1枚の 点が 上がる（×5 まで）。
// - 崩すと ときどき 札が 降る：広（板が 広い）・貫（球が つらぬく）・命（球が 1つ ふえる）。

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
	wideW: 52,
	padSpeed: 220,
	r: 2,
	lives: 3,
	maxLives: 5,
	brick: 10,
	/** 濃い 札に 1回 当てた ときの 点。 */
	dent: 5,
	maxChain: 5,
	waveBonus: 200,
	/** 札の 降る 確率・速さ、広と 貫の 秒。 */
	capRate: 0.14,
	capV: 45,
	wide: 10,
	pierce: 5,
	/** 板で はね返す ときの いちばん 小さい かたむき（ラジアン）。 */
	minTilt: 0.25,
} as const;

export type BkCapKind = "wide" | "pierce" | "life";
export const BK_CAP: Record<BkCapKind, { glyph: string; ink: string }> = {
	wide: { glyph: "広", ink: "#3080e0" },
	pierce: { glyph: "貫", ink: "#e04040" },
	life: { glyph: "命", ink: "#30a050" },
};
export type BkCap = { x: number; y: number; kind: BkCapKind };

export type BkState = {
	/** 札の 硬さ（0 ＝ ない）。 */
	bricks: number[];
	pad: number;
	padW: number;
	target: number;
	ball: { x: number; y: number; vx: number; vy: number };
	/** 球が 板に のって いる（A／タップで 打ちだす）。 */
	held: boolean;
	lives: number;
	score: number;
	wave: number;
	hits: number;
	/** 板に もどらずに 崩した 数。 */
	chain: number;
	caps: BkCap[];
	wide: number;
	pierce: number;
	pops: ArcPop[];
	over: boolean;
};
export type BkEvent =
	| "launch"
	| "wall"
	| "paddle"
	| "brick"
	| "dent"
	| "cap"
	| "lost"
	| "wave";

/** 面の 並び（. ＝ なし、1 ＝ ふつう、2 ＝ 濃い）。4面 ごとに くり返す（2周目からは 上の 2段が 濃い）。 */
const BK_LAYOUTS: readonly (readonly string[])[] = [
	["11111111", "11111111", "11111111", "11111111", "11111111"],
	["22222222", "1.1111.1", "11.11.11", "111..111", "11111111"],
	["...22...", "..1111..", ".222222.", "11111111", "21111112"],
	["2.2.2.2.", ".1.1.1.1", "2.2.2.2.", ".1.1.1.1", "11111111"],
];

export const bkLayout = (wave: number): number[] => {
	const n = BK_LAYOUTS.length;
	const rows = BK_LAYOUTS[(wave - 1) % n] ?? BK_LAYOUTS[0] ?? [];
	const hard = wave > n;
	return rows.flatMap((r, y) =>
		[...r].map((c) =>
			c === "2" || (c === "1" && hard && y < 2) ? 2 : c === "1" ? 1 : 0,
		),
	);
};

export const bkStart = (): BkState => ({
	bricks: bkLayout(1),
	pad: AW / 2,
	padW: BK.padW,
	target: AW / 2,
	ball: { x: AW / 2, y: BK.padY - BK.r - 1, vx: 0, vy: 0 },
	held: true,
	lives: BK.lives,
	score: 0,
	wave: 1,
	hits: 0,
	chain: 0,
	caps: [],
	wide: 0,
	pierce: 0,
	pops: [],
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
	s.pops = [];
	s.wide = Math.max(0, s.wide - dt);
	s.pierce = Math.max(0, s.pierce - dt);
	s.padW = s.wide > 0 ? BK.wideW : BK.padW;
	if (ip.target !== undefined) s.target = ip.target;
	s.target = clamp(s.target, s.padW / 2, AW - s.padW / 2);
	s.pad = approach(s.pad, s.target, BK.padSpeed * dt);
	// 降る 札
	for (const c of s.caps) {
		c.y += BK.capV * dt;
		if (
			c.y >= BK.padY - 3 &&
			c.y <= BK.padY + 6 &&
			Math.abs(c.x - s.pad) <= s.padW / 2 + 4
		) {
			c.y = AH + 99;
			if (c.kind === "wide") s.wide = BK.wide;
			else if (c.kind === "pierce") s.pierce = BK.pierce;
			else s.lives = Math.min(BK.maxLives, s.lives + 1);
			ev.push("cap");
		}
	}
	s.caps = s.caps.filter((c) => c.y < AH + 6);
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
			Math.abs(b.x - s.pad) <= s.padW / 2 + BK.r
		) {
			const off = clamp((b.x - s.pad) / (s.padW / 2), -1, 1);
			// 60度ほど まで。まっすぐ 上下に 行き来しない ように 少しは かたむける
			const a =
				Math.abs(off) < BK.minTilt / 1.05
					? (off < 0 || (off === 0 && rnd() < 0.5) ? -1 : 1) * BK.minTilt
					: off * 1.05;
			const sp = bkSpeed(s);
			b.vx = Math.sin(a) * sp;
			b.vy = -Math.cos(a) * sp;
			b.y = BK.padY - BK.r;
			s.chain = 0;
			ev.push("paddle");
		}
		// 札（1刻みに 1つ）
		const hit = s.bricks.findIndex((hp, j) => {
			if (hp <= 0) return false;
			const [x, y, w, hh] = bkRect(j);
			return (
				b.x + BK.r > x &&
				b.x - BK.r < x + w &&
				b.y + BK.r > y &&
				b.y - BK.r < y + hh
			);
		});
		if (hit >= 0) {
			const [x, y, w, hh] = bkRect(hit);
			const pierce = s.pierce > 0;
			s.bricks[hit] = pierce ? 0 : (s.bricks[hit] ?? 1) - 1;
			if (!pierce) {
				// 横から 入ったら 左右、上下から なら 上下に はね返す
				if (px + BK.r <= x || px - BK.r >= x + w) b.vx = -b.vx;
				else b.vy = -b.vy;
			}
			if ((s.bricks[hit] ?? 0) > 0) {
				s.score += BK.dent;
				ev.push("dent");
			} else {
				s.hits++;
				s.chain = Math.min(BK.maxChain, s.chain + 1);
				const pts = BK.brick * s.chain;
				s.score += pts;
				s.pops.push({ x: x + w / 2, y: y + hh / 2, pts });
				ev.push("brick");
				if (s.caps.length < 2 && rnd() < BK.capRate) {
					const r = rnd();
					const kind: BkCapKind =
						r < 0.2 && s.lives < BK.maxLives
							? "life"
							: r < 0.6
								? "wide"
								: "pierce";
					s.caps.push({ x: x + w / 2, y: y + hh / 2, kind });
				}
			}
			if (!s.bricks.some((hp) => hp > 0)) {
				s.score += BK.waveBonus * s.wave;
				s.wave++;
				s.bricks = bkLayout(s.wave);
				s.held = true;
				s.chain = 0;
				ev.push("wave");
			}
		}
		if (b.y - BK.r > AH) {
			s.lives--;
			s.held = true;
			s.chain = 0;
			s.wide = 0;
			s.pierce = 0;
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
// - 続けて たたくと 倍率（×4 まで）。空ぶり・イッチ・逃がすと もどる。
// - 5秒から コテハン（すぐ 引っこむ、+50）、10秒から 荒らし（2回 たたく、+30）。
// - のこり 6秒は「祭り」：たくさん 出て 点が 2倍。

export const ML = {
	time: 30,
	cells: 9,
	rom: 10,
	icchi: -30,
	kote: 50,
	ara: 30,
	maxUp: 3,
	/** 倍率が 1つ 上がる 続けた 数。 */
	comboStep: 5,
	maxMult: 4,
	/** 祭りが はじまる 秒。 */
	fever: 24,
} as const;

export type MlKind = "rom" | "icchi" | "kote" | "ara";
export const ML_KIND: Record<MlKind, { glyph: string; pts: number }> = {
	rom: { glyph: "ROM", pts: ML.rom },
	icchi: { glyph: "イッチ", pts: ML.icchi },
	kote: { glyph: "コテ", pts: ML.kote },
	ara: { glyph: "荒らし", pts: ML.ara },
};
export type MlHole = {
	kind: MlKind | null;
	/** あと 何回 たたけば 引っこむか（荒らしは 2）。 */
	hp: number;
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
	combo: number;
	/** その こまで 点が 動いた 穴。 */
	gains: { hole: number; pts: number }[];
	over: boolean;
};
export type MlEvent =
	| "pop"
	| "bonk"
	| "kote"
	| "armor"
	| "ouch"
	| "whiff"
	| "escape"
	| "fever";

export const mlStart = (): MlState => ({
	t: 0,
	holes: Array.from({ length: ML.cells }, () => ({
		kind: null,
		hp: 0,
		left: 0,
		bonk: 0,
		bonkKind: null,
	})),
	next: 0.6,
	score: 0,
	hits: 0,
	combo: 0,
	gains: [],
	over: false,
});

export const mlFever = (s: MlState): boolean => s.t >= ML.fever;
/** いまの 倍率（祭りは 2倍）。 */
export const mlMult = (s: MlState): number =>
	Math.min(ML.maxMult, 1 + Math.floor(s.combo / ML.comboStep)) *
	(mlFever(s) ? 2 : 1);

export const mlStep = (
	s: MlState,
	dt: number,
	hits: readonly number[],
	rnd: Rnd,
): MlEvent[] => {
	const ev: MlEvent[] = [];
	if (s.over) return ev;
	s.gains = [];
	for (const i of hits) {
		const h = s.holes[i];
		if (!h) continue;
		const kind = h.kind;
		if (!kind) {
			s.combo = 0;
			ev.push("whiff");
			continue;
		}
		if (kind === "icchi") {
			s.score = Math.max(0, s.score + ML.icchi);
			s.combo = 0;
			s.gains.push({ hole: i, pts: ML.icchi });
			ev.push("ouch");
		} else if (h.hp > 1) {
			h.hp--;
			h.left += 0.25;
			ev.push("armor");
			continue;
		} else {
			s.combo++;
			const pts = ML_KIND[kind].pts * mlMult(s);
			s.score += pts;
			s.hits++;
			s.gains.push({ hole: i, pts });
			ev.push(kind === "kote" ? "kote" : "bonk");
		}
		h.bonkKind = kind;
		h.kind = null;
		h.bonk = 0.35;
	}
	const fever = mlFever(s);
	s.t += dt;
	if (!fever && mlFever(s)) ev.push("fever");
	const k = s.t / ML.time;
	for (const h of s.holes) {
		h.bonk = Math.max(0, h.bonk - dt);
		if (h.bonk === 0) h.bonkKind = null;
		if (h.kind) {
			h.left -= dt;
			if (h.left <= 0) {
				if (h.kind !== "icchi") {
					s.combo = 0;
					ev.push("escape");
				}
				h.kind = null;
			}
		}
	}
	s.next -= dt;
	if (s.next <= 0) {
		s.next = lerp(0.75, 0.32, k) * (0.6 + rnd() * 0.8) * (fever ? 0.7 : 1);
		const up = s.holes.filter((h) => h.kind).length;
		const free = s.holes
			.map((h, i) => (h.kind || h.bonk > 0 ? -1 : i))
			.filter((i) => i >= 0);
		if (up < ML.maxUp + (fever ? 1 : 0) && free.length) {
			const h = s.holes[pick(free, rnd)];
			if (h) {
				const r = rnd();
				const kind: MlKind =
					r < 0.16
						? "icchi"
						: s.t > 5 && r < 0.24
							? "kote"
							: s.t > 10 && r < 0.34
								? "ara"
								: "rom";
				h.kind = kind;
				h.hp = kind === "ara" ? 2 : 1;
				h.left =
					lerp(1.25, 0.6, k) *
					(0.8 + rnd() * 0.4) *
					(kind === "kote" ? 0.6 : kind === "ara" ? 1.4 : 1);
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
// - ぎりぎり（返せる はばの 終わりの 4割）で 返すと「完全論破」：2つ 減らして 点も 多い。
// - 続けて 返すと 1回の 点が 上がる。後半の 相手は 返された 直後に すぐ もう 1発（「！！」）。

export type FtFoe = {
	name: string;
	/** 服の 色。 */
	ink: string;
	hp: number;
	/** 待つ 秒（はば）。 */
	idle: readonly [number, number];
	/** 構えてから なぐるまで。 */
	wind: number;
	/** 返せる はば（なぐる 直前の この 秒）。 */
	guard: number;
	feint: number;
	/** 返された あと すぐ もう 1発 くる 確率。 */
	chain: number;
};

export const FT_FOES: readonly FtFoe[] = [
	{
		name: "煽りカス",
		ink: "#a03030",
		hp: 3,
		idle: [0.8, 1.6],
		wind: 0.8,
		guard: 0.34,
		feint: 0.1,
		chain: 0,
	},
	{
		name: "論破厨",
		ink: "#3a8a40",
		hp: 3,
		idle: [0.6, 1.5],
		wind: 0.65,
		guard: 0.3,
		feint: 0.18,
		chain: 0.15,
	},
	{
		name: "レスバ常勝",
		ink: "#c07020",
		hp: 4,
		idle: [0.5, 1.4],
		wind: 0.55,
		guard: 0.26,
		feint: 0.22,
		chain: 0.25,
	},
	{
		name: "有識者",
		ink: "#505060",
		hp: 4,
		idle: [0.4, 1.3],
		wind: 0.46,
		guard: 0.22,
		feint: 0.26,
		chain: 0.35,
	},
	{
		name: "ネ申",
		ink: "#d0a020",
		hp: 5,
		idle: [0.35, 1.2],
		wind: 0.38,
		guard: 0.19,
		feint: 0.3,
		chain: 0.45,
	},
];

export const FT = {
	hp: 5,
	counter: 100,
	/** 続けて 返した 1回ごとに 足す 点（5回 ぶん まで）。 */
	streak: 20,
	maxStreak: 5,
	/** 完全論破：返せる はばの 終わりの この 割合・足す 点。 */
	perfect: 0.4,
	perfectBonus: 300,
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
	/** 続けて 返した 数。 */
	streak: number;
	/** すぐ もう 1発（フェイント なし）。 */
	chained: boolean;
	/** いまの 返しが 完全論破。 */
	perfect: boolean;
	clear: boolean;
	over: boolean;
};
export type FtEvent =
	| "wind"
	| "counter"
	| "perfect"
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
	s.chained = false;
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
	streak: 0,
	chained: false,
	perfect: false,
	clear: false,
	over: false,
});

/** 返せる はばに 入って いるか（構えの 中）。 */
export const ftInWindow = (s: FtState): boolean => {
	const f = FT_FOES[s.foe];
	return !!f && s.phase === "wind" && s.t >= f.wind - f.guard;
};

/** 完全論破の はばに 入って いるか。 */
export const ftInPerfect = (s: FtState): boolean => {
	const f = FT_FOES[s.foe];
	return !!f && s.phase === "wind" && s.t >= f.wind - f.guard * FT.perfect;
};

/**
 * 1こま 進める。press は 押したか（true は こまの はじめの 時刻で はかる）、または 押した 時刻が
 * こまの おわりから 何秒 前か（ago）。ago なら その 時刻まで 進めてから はかる（こまの 刻みで ずれない）。
 */
export const ftStep = (
	s: FtState,
	dt: number,
	press: boolean | number,
	rnd: Rnd,
): FtEvent[] => {
	if (typeof press === "number") {
		const ago = Math.min(dt, Math.max(0, press));
		const ev = ftStep(s, dt - ago, false, rnd);
		return ev.concat(ftStep(s, ago, true, rnd));
	}
	const ev: FtEvent[] = [];
	const f = FT_FOES[s.foe];
	if (s.over || !f) return ev;
	const stun = (e: FtEvent) => {
		s.hp--;
		s.streak = 0;
		s.phase = "stun";
		s.t = 0;
		s.dur = 0.7;
		ev.push(e);
	};
	if (press) {
		if (s.phase === "wind" && ftInWindow(s)) {
			const perfect = ftInPerfect(s);
			s.foeHp = Math.max(0, s.foeHp - (perfect ? 2 : 1));
			s.score +=
				FT.counter +
				FT.streak * Math.min(FT.maxStreak, s.streak) +
				(perfect ? FT.perfectBonus : 0);
			s.streak++;
			s.perfect = perfect;
			s.phase = "counter";
			s.t = 0;
			s.dur = 0.55;
			ev.push(perfect ? "perfect" : "counter");
		} else if (s.phase === "idle" || s.phase === "wind" || s.phase === "feint")
			stun("early");
	}
	s.t += dt;
	if (s.t < s.dur) return ev;
	switch (s.phase) {
		case "idle":
			s.t = 0;
			if (!s.chained && rnd() < f.feint) {
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
			} else if (s.phase === "counter" && !s.chained && rnd() < f.chain) {
				// 返された 直後に もう 1発
				s.phase = "idle";
				s.t = 0;
				s.dur = 0.12;
				s.chained = true;
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

// ───────────────── メダルゲーム「メダルスロット」 ─────────────────
// メダル 10枚から。A で 1枚 入れて 回し、A で 左から 1つずつ 止める（目押し）。まんなかの 列が 3つ そろえば 払いだし。
// メダルが なくなるか、B で やめたら おわり。スコアは いちばん 多く 持った 枚数。
// - 持って いる メダルが 多いほど リールが 速い（目押しが むずかしく なる）。
// - 左 2つが そろうと リーチ。7 が 3つ そろうと BIG：次の 3回は 払いだしが 2倍。

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
	/** 1秒に 進む コマ（メダル 50枚 ごとに 1 速く、maxSpin まで）。 */
	spin: 7,
	maxSpin: 13,
	pay: 0.9,
	/** BIG の 回数。 */
	big: 3,
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
	/** BIG の 残り 回数。 */
	big: number;
	/** いま 回して いるのが BIG の 1回。 */
	bonus: boolean;
	reach: boolean;
	over: boolean;
};
export type SlEvent =
	| "bet"
	| "stop"
	| "reach"
	| "win"
	| "big"
	| "lose"
	| "bust";

export const slStart = (): SlState => ({
	medals: SL.start,
	best: SL.start,
	phase: "idle",
	pos: [0, 4, 8],
	stopped: [true, true, true],
	t: 0,
	lastWin: 0,
	spins: 0,
	big: 0,
	bonus: false,
	reach: false,
	over: false,
});

/** リールの 速さ（コマ／秒）。 */
export const slSpeed = (s: SlState): number =>
	Math.min(SL.maxSpin, SL.spin + Math.floor(s.medals / 50));

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
		s.reach = false;
		s.bonus = s.big > 0;
		if (s.bonus) s.big--;
		ev.push("bet");
		press = false;
	}
	if (s.phase === "spin") {
		const v = slSpeed(s);
		for (let i = 0; i < 3; i++)
			if (!s.stopped[i]) s.pos[i] = ((s.pos[i] ?? 0) + v * dt) % 12;
		if (press) {
			const i = s.stopped.indexOf(false);
			if (i >= 0) {
				s.pos[i] = Math.round(s.pos[i] ?? 0) % 12;
				s.stopped[i] = true;
				ev.push("stop");
				const [a, b] = slLine(s);
				if (i === 1 && a === b) {
					s.reach = true;
					ev.push("reach");
				}
			}
			if (s.stopped.every(Boolean)) {
				const [a, b, c] = slLine(s);
				s.phase = "pay";
				s.t = 0;
				if (a && a === b && b === c) {
					s.lastWin = SL_PAY[a] * (s.bonus ? 2 : 1);
					s.medals = Math.min(SL.cap, s.medals + s.lastWin);
					s.best = Math.max(s.best, s.medals);
					ev.push("win");
					if (a === "7") {
						s.big = SL.big;
						ev.push("big");
					}
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

// ───────────────── 音ゲー「おんJビート」 ─────────────────
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
	/** おわりの 秒（BGM の 譜面は 小節の きり。無ければ さいごの 札の 1秒 あと）。 */
	end?: number;
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

/** chart を わたせば その 譜面（BGM の 譜面。data/arcade/songChart.ts）、無ければ 決まった 1曲。 */
export const rhStart = (chart?: {
	notes: readonly { at: number; lane: number }[];
	endSec: number;
}): RhState => ({
	t: 0,
	notes: (chart?.notes ?? rhChart()).map((n) => ({ ...n, judged: null })),
	end: chart?.endSec,
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
	const end = s.end ?? (s.notes[s.notes.length - 1]?.at ?? 0) + 1;
	if (s.t >= end) {
		s.over = true;
		if (s.counts.miss === 0) s.score += RH.fullCombo;
	}
	return ev;
};
