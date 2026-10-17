// ゲームセンター「連コ」の 台「湾岸ナイトラン」（wangan）の 決まり。板は ui/arcade/home/wangan.ts、文は data/arcade/text.ts。
// - 夜の 高速道路を 走る。道は 5m ごとの 区切り（曲がり・ゆるい 坂・トンネル）を つないだ 輪。
// - ライバルが 3台 前を 走る（名無しの 白い セダン → コテハンの 黒い スポーツ → 湾岸の 主）。
//   時間ぎれ までに ぬくと 次が 出て、時間が のびる。3台 ぬけば クリア。
// - 前の 車の 真うしろに つくと スリップストリーム（上の 速さと 加速が のびる）。
// - 壁に こすると 速さが へり、火花が 出る。車に ぶつけると 速さを 大きく うしなう ので よけて ぬく。
// - 点：走った 距離（10m で 1点）＋ 一般車を ぬいた 数 ×50 ＋ ライバル（1000・2000・3000）＋ クリアの のこり 時間 ×50。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import type { Rnd } from "../logic";

export const WN = {
	/** 1区切りの 長さ（m）。 */
	seg: 5,
	/** 道の 半分の はば（m）。x は ±1 が 道の はし。 */
	roadW: 6,
	/** 上の 速さ（m/秒。84 で 約 300km/h）。 */
	vmax: 84,
	accel: 15,
	brake: 34,
	drag: 3,
	/** ハンドル（x／秒）と 曲がりで 外へ 流される 強さ。 */
	steer: 1.5,
	centri: 0.32,
	/** 車の 真ん中が ここを 越えると 壁に こする。 */
	wall: 0.94,
	scrape: 26,
	/** 車の はば（x）と 長さ（m）。 */
	carW: 0.3,
	carL: 4.5,
	/** スリップストリームが 効く 前の 車までの 距離（m）・横の ずれ・上の 速さの 倍。 */
	slipNear: 4,
	slipFar: 38,
	slipW: 0.3,
	slipBoost: 1.12,
	/** はじめの 時間（秒）。 */
	time: 40,
	/** 一般車の 数・車線。 */
	traffic: 9,
	lanes: [-0.64, 0, 0.64],
	overtake: 50,
	clearBonus: 50,
} as const;

export type WnRival = {
	name: string;
	/** 帯に 出す 短い 名前。 */
	short: string;
	/** 上の 速さ（m/秒）。 */
	top: number;
	/** 出る ときの 前との 差（m）。 */
	gap: number;
	/** 出た ときに のびる 時間（秒。はじめの 1台は WN.time）。 */
	extend: number;
	/** 真うしろに つかれると 前を ふさぐ 強さ（x／秒）。 */
	block: number;
};

export const WN_RIVALS: readonly WnRival[] = [
	{
		name: "名無しの白いセダン",
		short: "白いセダン",
		top: 60,
		gap: 120,
		extend: 0,
		block: 0,
	},
	{
		name: "コテハンの黒いスポーツ",
		short: "黒いスポーツ",
		top: 70,
		gap: 160,
		extend: 30,
		block: 0.3,
	},
	{
		name: "湾岸の主",
		short: "湾岸の主",
		top: 77,
		gap: 150,
		extend: 35,
		block: 0.55,
	},
];

/** 板の 字。 */
export const WN_TEXT = {
	ahead: "{name}が前を走る",
	beat: "{name}をぬいた！",
	slip: "スリップストリーム！",
	crash: "ぶつけた！",
	clear: "湾岸の主をぬいた！",
	timeup: "時間ぎれ",
	extend: "TIME +{n}",
	to: "まで",
	kmh: "km/h",
	note: "タップ：左右ハンドル中アクセル",
} as const;

// ---- 道 ----

type Section = readonly [
	len: number,
	curve: number,
	rise: number,
	tunnel?: boolean,
];

/** 区切りの ならび（長さ・曲がり・のぼり（m）・トンネル）。のぼりの 合計は 0。 */
const SECTIONS: readonly Section[] = [
	[60, 0, 0],
	[70, 1.4, 6],
	[50, 0, 0],
	[90, -2, -6],
	[40, 0, 0],
	[130, 0.8, 0, true],
	[50, 0, 4],
	[80, 2.6, 0],
	[60, -1.2, -4],
	[110, 0, 8],
	[70, -2.6, 0],
	[50, 0, -8],
	[90, 1.8, 0, true],
	[60, 0, 0],
	[80, -1.6, 5],
	[70, 2.2, -5],
	[60, 0, 0],
];

export type WnTrack = {
	n: number;
	curve: Float32Array;
	/** 区切りの はじめの 高さ（m）。 */
	y: Float32Array;
	tunnel: Uint8Array;
};

const buildTrack = (): WnTrack => {
	const n = SECTIONS.reduce((a, s) => a + s[0], 0);
	const curve = new Float32Array(n);
	const y = new Float32Array(n);
	const tunnel = new Uint8Array(n);
	let i = 0;
	let h = 0;
	for (const [len, c, rise, tun] of SECTIONS) {
		for (let k = 0; k < len; k++, i++) {
			// 曲がりは はじめと おわりで ゆるめる
			const ease = Math.min(1, k / 10, (len - k) / 10);
			curve[i] = c * ease;
			y[i] = h + (rise * (1 - Math.cos((Math.PI * k) / len))) / 2;
			tunnel[i] = tun ? 1 : 0;
		}
		h += rise;
	}
	return { n, curve, y, tunnel };
};

export const WN_TRACK: WnTrack = buildTrack();

/** z（m）の 区切りの 番号（輪に まわす）。 */
export const wnSeg = (z: number): number => {
	const n = WN_TRACK.n;
	return ((Math.floor(z / WN.seg) % n) + n) % n;
};

// ---- 状態 ----

export type WnCar = {
	z: number;
	x: number;
	v: number;
	/** 0 乗用車・1 ワゴン・2 トラック。 */
	kind: number;
	/** 色の 番号。 */
	ink: number;
	passed: boolean;
};

export type WnRivalCar = {
	z: number;
	x: number;
	v: number;
	/** 向かう 車線の x。 */
	tx: number;
	/** ブレーキの 灯り（曲がりで 落とす あいだ）。 */
	braking: boolean;
};

export type WnState = {
	t: number;
	/** のこり 時間（秒）。 */
	time: number;
	z: number;
	x: number;
	v: number;
	/** スリップストリームの たまり（0〜1。0.5 以上で 効く）。 */
	slip: number;
	/** 壁に こすって いる。 */
	scraping: boolean;
	sparkT: number;
	crashT: number;
	cars: WnCar[];
	rival: WnRivalCar | null;
	/** いまの ライバルの 番号（ぬいた 数）。 */
	ri: number;
	overtakes: number;
	points: number;
	over: boolean;
	clear: boolean;
};

export type WnInput = { gas: boolean; brake: boolean; steer: number };

export type WnEvent =
	| "crash"
	| "scrape"
	| "slip"
	| "overtake"
	| "rival"
	| "beat"
	| "extend"
	| "clear"
	| "timeup";

const clamp = (v: number, a: number, b: number): number =>
	Math.max(a, Math.min(b, v));

const spawnCar = (s: WnState, z: number, rnd: Rnd): void => {
	for (let tries = 0; tries < 4; tries++) {
		const x = WN.lanes[Math.floor(rnd() * WN.lanes.length)] ?? 0;
		const busy = s.cars.some(
			(c) => Math.abs(c.z - z) < 30 && Math.abs(c.x - x) < 0.4,
		);
		if (busy) continue;
		const r = rnd();
		s.cars.push({
			z,
			x,
			v: 20 + rnd() * 12,
			kind: r < 0.6 ? 0 : r < 0.85 ? 1 : 2,
			ink: Math.floor(rnd() * 6),
			passed: false,
		});
		return;
	}
};

const spawnRival = (s: WnState): void => {
	const R = WN_RIVALS[s.ri];
	if (!R) return;
	s.rival = {
		z: s.z + R.gap,
		x: 0,
		v: Math.min(R.top, s.v),
		tx: 0,
		braking: false,
	};
};

export const wnStart = (rnd: Rnd): WnState => {
	const s: WnState = {
		t: 0,
		time: WN.time,
		z: 0,
		x: 0,
		v: 0,
		slip: 0,
		scraping: false,
		sparkT: 0,
		crashT: 0,
		cars: [],
		rival: null,
		ri: 0,
		overtakes: 0,
		points: 0,
		over: false,
		clear: false,
	};
	for (let i = 0; i < WN.traffic; i++) spawnCar(s, 80 + i * 60, rnd);
	spawnRival(s);
	return s;
};

export const wnScore = (s: WnState): number => Math.floor(s.z / 10) + s.points;

/** 1こま 進める。 */
export const wnStep = (
	s: WnState,
	dt: number,
	ip: WnInput,
	rnd: Rnd,
): WnEvent[] => {
	const ev: WnEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	s.time = Math.max(0, s.time - dt);
	s.crashT = Math.max(0, s.crashT - dt);
	const curve = WN_TRACK.curve[wnSeg(s.z)] ?? 0;
	// 速さ
	const slipOn = s.slip >= 0.5;
	const cap = WN.vmax * (slipOn ? WN.slipBoost : 1);
	if (ip.gas) {
		const k = Math.min(1, s.v / cap);
		s.v += WN.accel * (1 - k * k) * (slipOn ? 1.6 : 1) * dt;
	} else s.v -= (WN.drag + s.v * s.v * 0.0005) * dt;
	if (ip.brake) s.v -= WN.brake * dt;
	if (s.v > cap) s.v = Math.max(cap, s.v - 6 * dt);
	// ハンドル（止まって いると 切れない）と 曲がりの 外への 流れ
	const grip = Math.min(1, s.v / 12);
	s.x += clamp(ip.steer, -1, 1) * WN.steer * grip * dt;
	s.x -= curve * (s.v / WN.vmax) ** 2 * WN.centri * dt;
	// 壁
	s.scraping = false;
	if (Math.abs(s.x) > WN.wall) {
		s.x = Math.sign(s.x) * WN.wall;
		if (s.v > 8) {
			s.scraping = true;
			s.v -= WN.scrape * dt;
			s.sparkT -= dt;
			if (s.sparkT <= 0) {
				s.sparkT = 0.12;
				ev.push("scrape");
			}
		}
	}
	s.v = Math.max(0, s.v);
	s.z += s.v * dt;
	// 一般車
	for (const c of s.cars) c.z += c.v * dt;
	// ライバル
	const r = s.rival;
	const R = WN_RIVALS[s.ri];
	if (r && R) {
		const rc = WN_TRACK.curve[wnSeg(r.z)] ?? 0;
		let target = R.top * (1 - 0.035 * Math.abs(rc));
		// 離れすぎたら 少し 待つ
		if (r.z - s.z > 600) target *= 0.85;
		r.braking = r.v > target + 1;
		r.v += clamp(target - r.v, -10 * dt, 9 * dt);
		r.z += r.v * dt;
		// 前の 一般車を よける
		const blocked = s.cars.some(
			(c) => c.z > r.z && c.z - r.z < 35 && Math.abs(c.x - r.tx) < 0.4,
		);
		if (blocked) {
			const free = WN.lanes.filter(
				(lx) =>
					!s.cars.some(
						(c) => c.z > r.z - 8 && c.z - r.z < 45 && Math.abs(c.x - lx) < 0.4,
					),
			);
			if (free.length)
				r.tx = free.reduce((a, b) =>
					Math.abs(b - r.x) < Math.abs(a - r.x) ? b : a,
				);
		}
		// 真うしろに つかれたら ふさぐ
		const dz = r.z - s.z;
		const goal = R.block > 0 && dz > 0 && dz < 60 && !blocked ? s.x : r.tx;
		const sp = goal === s.x ? R.block : 0.6;
		r.x += clamp(goal - r.x, -sp * dt, sp * dt);
		r.x = clamp(r.x, -0.8, 0.8);
	}
	// ぶつかる（一般車と ライバル）
	const bodies: { z: number; x: number; v: number }[] = [...s.cars];
	if (r) bodies.push(r);
	for (const c of bodies) {
		const dz = c.z - s.z;
		if (Math.abs(dz) >= WN.carL || Math.abs(c.x - s.x) >= WN.carW) continue;
		if (s.crashT > 0) continue;
		if (dz >= 0) {
			s.v = Math.min(s.v, c.v) * 0.75;
			c.z = s.z + WN.carL + 0.5;
			c.v += 3;
		} else {
			c.v = s.v * 0.9;
			c.z = s.z - WN.carL - 0.5;
		}
		s.x = clamp(s.x + (s.x >= c.x ? 0.12 : -0.12), -WN.wall, WN.wall);
		s.crashT = 0.5;
		s.slip = 0;
		ev.push("crash");
	}
	// ぬいた 一般車
	for (const c of s.cars) {
		if (!c.passed && c.z < s.z - WN.carL) {
			c.passed = true;
			s.overtakes++;
			s.points += WN.overtake;
			ev.push("overtake");
		}
	}
	// スリップストリーム
	const behind =
		s.v > 30 &&
		bodies.some(
			(c) =>
				c.z - s.z > WN.slipNear &&
				c.z - s.z < WN.slipFar &&
				Math.abs(c.x - s.x) < WN.slipW,
		);
	const was = s.slip;
	s.slip = behind
		? Math.min(1, s.slip + dt * 0.9)
		: Math.max(0, s.slip - dt * 1.5);
	if (was < 0.5 && s.slip >= 0.5) ev.push("slip");
	// 一般車の 出入り
	s.cars = s.cars.filter((c) => c.z > s.z - 40 && c.z < s.z + 900);
	while (s.cars.length < WN.traffic) {
		const n = s.cars.length;
		spawnCar(s, s.z + 350 + rnd() * 300, rnd);
		if (s.cars.length === n) break;
	}
	// ライバルを ぬいた
	if (r && R && s.z > r.z + WN.carL + 6) {
		s.points += 1000 * (s.ri + 1);
		s.ri++;
		ev.push("beat");
		const next = WN_RIVALS[s.ri];
		if (!next) {
			s.points += Math.ceil(s.time) * WN.clearBonus;
			s.rival = null;
			s.over = true;
			s.clear = true;
			ev.push("clear");
			return ev;
		}
		spawnRival(s);
		s.time += next.extend;
		ev.push("rival", "extend");
	}
	if (s.time <= 0) {
		s.over = true;
		ev.push("timeup");
	}
	return ev;
};
