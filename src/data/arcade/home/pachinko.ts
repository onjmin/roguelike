// カジノ「ガチャ」の CRおんJタウン（pachinko）の 決まり。板は ui/arcade/home/pachinko.ts、文は data/arcade/text.ts。
// - 遊びの 玉を 200発 借りる。A を 押しっぱなし（タップは 打つ／止めるの 切りかえ）で 1発ずつ 打つ。↑↓ で 打つ 強さ。
// - 玉は 右上から 左へ 飛びだし、釘に はねて 下へ。下の はしまで 行くと 消える。
// - まんなかの 下の ヘソに 入ると 3発 もどり、液晶の 絵が 回る（保留は 4つまで）。
//   絵は 村の もの：ぷゆゆ（4色）・キリコの 蓄音機・草・>>1。
// - 3つ そろうと 大当たり：下の アタッカーが 開き、入った 玉 1つで 10発（10個 入るか 15秒で 閉じる）。
// - 玉が なくなるか、B（板の 外を 2回）で やめると その ときの 手もとの 玉が スコア。
// 座標は 板の 240x150（上の 14px は 帯）。DOM に 触らない（試験できる）。乱数は 渡された rnd。

import type { Rnd } from "../logic";

export const PC = {
	start: 200,
	cap: 9999,
	/** 1発 打つ 間（秒）。 */
	fireGap: 0.24,
	gravity: 120,
	/** 玉の 半径と 釘の 半径。 */
	ball: 1.5,
	nail: 1,
	/** はね かえり。 */
	bounce: 0.45,
	/** 物の 計算の 細かさ（秒）。 */
	sub: 1 / 240,
	/** 打ちだし 口と 速さ（強さ 0〜1 で 左向きの 速さが かわる）。 */
	launchX: 214,
	launchY: 19,
	vMin: 40,
	vMax: 210,
	/** 場の はし。 */
	left: 8,
	right: 222,
	top: 15,
	bottom: 150,
	/** 液晶（x, y, w, h）。 */
	lcd: [92, 30, 56, 36] as readonly [number, number, number, number],
	/** ヘソ（まんなかの x、入口の y、半分の 幅）。 */
	hesoX: 120,
	hesoY: 92,
	hesoHalf: 3,
	hesoBack: 3,
	/** 寄り釘（まんなかからの 上の はば、上の y、下の はば、下の y）。 */
	funnel: [34, 70, 11, 84] as readonly [number, number, number, number],
	/** アタッカー（x, y, w, h）。 */
	attacker: [96, 122, 48, 4] as readonly [number, number, number, number],
	attackerBack: 12,
	attackerCount: 10,
	attackerTime: 20,
	/** 保留の 上限。 */
	hold: 4,
	/** 大当たりの 確率（1回 回る ごと）。 */
	jackpot: 1 / 40,
	/** はずれで リーチに なる 確率。 */
	reach: 0.12,
	/** リールが 止まる 時刻（左・右・まんなか）。リーチなら まんなかが おそい。 */
	stopL: 0.9,
	stopR: 1.4,
	stopM: 1.9,
	stopReach: 4.6,
	/** 長く 止まった 玉は 消す（秒）。 */
	life: 14,
} as const;

/** 液晶の 図がら（1〜7）。 */
export const PC_SYMS = 7;
/** 図がらの 中身（板が 描き分ける）。7 は 金の ぷゆゆ。 */
export const PC_SYM_KIND = [
	"",
	"puyu",
	"horn",
	"puyu",
	"kusa",
	"puyu",
	"res1",
	"puyu",
] as const;

/** 板の 字。 */
export const PC_TEXT = {
	balls: "玉",
	power: "強さ",
	hold: "保留",
	fire: "打つ",
	stop: "止める",
	reach: "リーチ！",
	jackpot: "大当たり！",
	round: "アタッカー　{n}／{max}",
	bonusEnd: "{n}発　出た！",
	heso: "ヘソ　+3",
	hits: "当たり",
} as const;

export type PcBall = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	age: number;
};
export type PcSpin = {
	t: number;
	reels: [number, number, number];
	reach: boolean;
	hit: boolean;
	/** リーチを 知らせたか。 */
	told: boolean;
};
export type PcState = {
	balls: number;
	shot: number;
	paid: number;
	power: number;
	cool: number;
	flying: PcBall[];
	nails: readonly (readonly [number, number])[];
	/** 保留（回る 前の ヘソ 入り）。 */
	queue: number;
	spin: PcSpin | null;
	/** 止まった 図がら（回って ない ときに 見せる）。 */
	reels: [number, number, number];
	/** 大当たりで アタッカーが 開いて いる あいだ。 */
	bonus: { t: number; count: number; got: number } | null;
	jackpots: number;
	/** 前の 大当たりで 出た 玉。 */
	lastBonus: number;
	over: boolean;
};
export type PcInput = { fire?: boolean; power?: number };
export type PcEvent =
	| "fire"
	| "heso"
	| "spin"
	| "stop"
	| "reach"
	| "jackpot"
	| "miss"
	| "attacker"
	| "bonusEnd"
	| "out";

const inRect = (
	x: number,
	y: number,
	[rx, ry, rw, rh]: readonly [number, number, number, number],
	pad = 0,
): boolean =>
	x >= rx - pad && x <= rx + rw + pad && y >= ry - pad && y <= ry + rh + pad;

/** 釘の ならび（液晶・ヘソの 上・アタッカーの まわりは あける）。 */
export const pcNails = (): [number, number][] => {
	const out: [number, number][] = [];
	const [fo, fy0, fi, fy1] = PC.funnel;
	const cx = PC.hesoX;
	/** 寄り釘の 列の 内がわか。 */
	const inFunnel = (x: number, y: number): boolean => {
		if (y < fy0 - 5 || y > fy1 + 3) return false;
		const k = Math.max(0, Math.min(1, (y - fy0) / (fy1 - fy0)));
		return Math.abs(x - cx) < fo + (fi - fo) * k + 5;
	};
	// 上の 帯（液晶の 上）は 釘なし で 玉が 飛ぶ
	for (let k = 0; k < 10; k++) {
		const y = 40 + k * 9;
		for (let j = 0; j < 18; j++) {
			const x = 16 + j * 12 + (k % 2) * 6;
			if (x > 216) continue;
			if (inRect(x, y, PC.lcd, 6)) continue;
			if (inFunnel(x, y)) continue;
			if (y > 110 && x > 88 && x < 152) continue;
			out.push([x, y]);
		}
	}
	// 寄り釘（液晶の 下の V の 字）
	for (const side of [-1, 1]) {
		const n = Math.ceil(Math.hypot(fo - fi, fy1 - fy0) / 3.5);
		for (let i = 0; i <= n; i++) {
			const k = i / n;
			out.push([cx + side * (fo + (fi - fo) * k), fy0 + (fy1 - fy0) * k]);
		}
	}
	// 命釘（ヘソの 肩）
	out.push([cx - 4.5, PC.hesoY - 1], [cx + 4.5, PC.hesoY - 1]);
	return out;
};

export const pcStart = (): PcState => ({
	balls: PC.start,
	shot: 0,
	paid: 0,
	power: 0.5,
	cool: 0,
	flying: [],
	nails: pcNails(),
	queue: 0,
	spin: null,
	reels: [1, 4, 7],
	bonus: null,
	jackpots: 0,
	lastBonus: 0,
	over: false,
});

/** 回る 前に 目を 決める。 */
export const pcRoll = (rnd: Rnd): PcSpin => {
	const sym = () => 1 + (Math.floor(rnd() * PC_SYMS) % PC_SYMS);
	if (rnd() < PC.jackpot) {
		const a = sym();
		return { t: 0, reels: [a, a, a], reach: true, hit: true, told: false };
	}
	const a = sym();
	if (rnd() < PC.reach) {
		// まんなかは 左右と ちがう 絵
		const k = 1 + (Math.floor(rnd() * (PC_SYMS - 1)) % (PC_SYMS - 1));
		const m = ((a - 1 + k) % PC_SYMS) + 1;
		return { t: 0, reels: [a, m, a], reach: true, hit: false, told: false };
	}
	let c = sym();
	if (c === a) c = (c % PC_SYMS) + 1;
	return { t: 0, reels: [a, sym(), c], reach: false, hit: false, told: false };
};

/** いつ まんなかが 止まるか。 */
export const pcSpinEnd = (sp: PcSpin): number =>
	sp.reach ? PC.stopReach : PC.stopM;

const pay = (s: PcState, n: number): void => {
	const got = Math.max(0, Math.min(n, PC.cap - s.balls));
	s.balls += got;
	s.paid += got;
};

/** 釘・液晶・閉じた アタッカーに はねる（点 px, py との 当たり）。 */
const hit = (b: PcBall, px: number, py: number, r: number, rnd: Rnd): void => {
	const dx = b.x - px;
	const dy = b.y - py;
	const d2 = dx * dx + dy * dy;
	if (d2 >= r * r) return;
	const d = Math.sqrt(d2) || 0.001;
	const nx = d2 ? dx / d : rnd() < 0.5 ? -1 : 1;
	const ny = d2 ? dy / d : 0;
	b.x = px + nx * r;
	b.y = py + ny * r;
	const vn = b.vx * nx + b.vy * ny;
	if (vn < 0) {
		b.vx -= (1 + PC.bounce) * vn * nx;
		b.vy -= (1 + PC.bounce) * vn * ny;
		// 少し ぶれる
		const j = (rnd() - 0.5) * 14;
		b.vx += -ny * j;
		b.vy += nx * j;
	}
};
const hitRect = (
	b: PcBall,
	[rx, ry, rw, rh]: readonly [number, number, number, number],
	rnd: Rnd,
): void => {
	const cx = Math.max(rx, Math.min(rx + rw, b.x));
	const cy = Math.max(ry, Math.min(ry + rh, b.y));
	hit(b, cx, cy, PC.ball, rnd);
};

/** 玉 1つを 細かく 1歩。消えたら その わけ。 */
const moveBall = (
	s: PcState,
	b: PcBall,
	h: number,
	rnd: Rnd,
): "heso" | "attacker" | "out" | null => {
	const y0 = b.y;
	b.vy += PC.gravity * h;
	b.x += b.vx * h;
	b.y += b.vy * h;
	b.age += h;
	const r = PC.ball;
	if (b.x < PC.left + r) {
		b.x = PC.left + r;
		b.vx = Math.abs(b.vx) * 0.6;
	} else if (b.x > PC.right - r) {
		b.x = PC.right - r;
		b.vx = -Math.abs(b.vx) * 0.6;
	}
	if (b.y < PC.top + r) {
		b.y = PC.top + r;
		b.vy = Math.abs(b.vy) * 0.5;
	}
	// ヘソ（上から 入口を こえる）
	if (
		y0 < PC.hesoY &&
		b.y >= PC.hesoY &&
		Math.abs(b.x - PC.hesoX) <= PC.hesoHalf
	)
		return "heso";
	const [ax, ay, aw] = PC.attacker;
	if (s.bonus && y0 < ay && b.y >= ay && b.x >= ax && b.x <= ax + aw)
		return "attacker";
	if (b.y > PC.bottom || b.age > PC.life) return "out";
	const rr = r + PC.nail;
	for (const [nx, ny] of s.nails)
		if (Math.abs(b.x - nx) < rr && Math.abs(b.y - ny) < rr)
			hit(b, nx, ny, rr, rnd);
	if (inRect(b.x, b.y, PC.lcd, r)) hitRect(b, PC.lcd, rnd);
	if (!s.bonus && inRect(b.x, b.y, PC.attacker, r))
		hitRect(b, PC.attacker, rnd);
	return null;
};

/** 玉を 1発 打つ（強さ 0〜1）。 */
export const pcLaunch = (s: PcState, rnd: Rnd): boolean => {
	if (s.balls <= 0) return false;
	s.balls--;
	s.shot++;
	s.flying.push({
		x: PC.launchX,
		y: PC.launchY,
		vx: -(PC.vMin + (PC.vMax - PC.vMin) * s.power) * (0.92 + rnd() * 0.16),
		vy: 2 + rnd() * 12,
		age: 0,
	});
	return true;
};

export const pcStep = (
	s: PcState,
	dt: number,
	inp: PcInput,
	rnd: Rnd,
): PcEvent[] => {
	const ev: PcEvent[] = [];
	if (s.over) return ev;
	if (inp.power !== undefined) s.power = Math.max(0, Math.min(1, inp.power));
	s.cool = Math.max(0, s.cool - dt);
	if (inp.fire && s.cool <= 0 && pcLaunch(s, rnd)) {
		s.cool = PC.fireGap;
		ev.push("fire");
	}
	// 玉を 動かす
	const n = Math.max(1, Math.round(dt / PC.sub));
	const h = dt / n;
	for (let i = 0; i < n; i++)
		s.flying = s.flying.filter((b) => {
			const r = moveBall(s, b, h, rnd);
			if (r === "heso") {
				pay(s, PC.hesoBack);
				s.queue = Math.min(PC.hold, s.queue + 1);
				ev.push("heso");
			} else if (r === "attacker" && s.bonus) {
				pay(s, PC.attackerBack);
				s.bonus.count++;
				s.bonus.got += PC.attackerBack;
				ev.push("attacker");
			} else if (r === "out") ev.push("out");
			return r === null;
		});
	// 大当たり（アタッカーが 開いて いる）
	if (s.bonus) {
		s.bonus.t += dt;
		if (s.bonus.count >= PC.attackerCount || s.bonus.t >= PC.attackerTime) {
			s.lastBonus = s.bonus.got;
			s.bonus = null;
			ev.push("bonusEnd");
		}
	} else if (s.spin) {
		// 液晶の ぷゆゆ
		const sp = s.spin;
		const t0 = sp.t;
		sp.t += dt;
		for (const at of [PC.stopL, PC.stopR])
			if (t0 < at && sp.t >= at) ev.push("stop");
		if (sp.reach && !sp.told && sp.t >= PC.stopR) {
			sp.told = true;
			ev.push("reach");
		}
		if (sp.t >= pcSpinEnd(sp)) {
			s.reels = [...sp.reels];
			s.spin = null;
			if (sp.hit) {
				s.jackpots++;
				s.bonus = { t: 0, count: 0, got: 0 };
				ev.push("jackpot");
			} else ev.push("miss");
		}
	} else if (s.queue > 0) {
		s.queue--;
		s.spin = pcRoll(rnd);
		ev.push("spin");
	}
	if (s.balls <= 0 && !s.flying.length && !s.queue && !s.spin && !s.bonus)
		s.over = true;
	return ev;
};
