// 1打席（裏シナリオの 跡地の 関所・村の グラウンド）と ホームラン競争（グラウンド）。ui/minigames.ts から 出す。
// 打席の うしろ（キャッチャーの うしろ 7m・高さ 3.5m）から 見た 球場で、投げられた 球を A／タップで 打つ。
// - 球種：ストレート・剛速球（足を 長く 上げ、指先が 光る）・スローカーブ（ゆらゆら 足を 上げる）・
//   フォーク（ストレートと 同じ 形で 来て、最後に 落ちる）。ボール球は 外・高め・ワンバン。
// - 振った 時と 球が 本塁に 来る 時の ずれ（押した 瞬間の 時刻で はかる）で：芯＝ホームラン、よい＝ツーベース・ヒット・ゴロ、
//   かすり＝ファウル、それ より ずれたら 空振り。ワンバンを 振れば 空振り、外・高めの ボール球に 当てれば 凡打。
// - カウント：ストライク 3つで 三振、ボール 4つで フォアボール（勝ち）。2ストライクからの ファウルは そのまま。
// - 前に とんだら 上から 見た 球場（1m＝2px）に 切りかわり、カメラが 打球を 追う。村と 同じ 16x16 の 人が 守り、
//   いちばん 近い 野手が「！」で 追う。関所の 原住民は 抜けていく 球に 飛びつく。キリコは 一塁へ 走る。
// - ホームラン競争：ストライク だけ 10球、芯の 数を 数える。自己ベストは localStorage（kiriko-roguelike/derby）。
// 絵は public/sprites/baseball.png（scripts/make-baseball.mjs。上から 見た 人・効果・花火は RPGEN の 素材）。
// 読めない ときは 四角だけの 絵で 同じ ように 遊べる（関所で 止まらない）。B で いつでも やめられる
// （打席の 結果が 決まった あとの B は のこりの 場面を とばすだけ：結果は そのまま）。
// 決まり（球の 道・当たり・カウント・打球・カメラ）は 純粋な 関数で、試験（sim/villageTests.ts）が 数を 確かめる。
// 冒険の 乱数・記録には 触らない（球と 見た目の 乱数は Math.random）。モジュールの 上では DOM・画像・localStorage に 触らない。

import { BB_FX, BB_POSE, BB_SHEET, BB_SPR } from "../data/baseballSheet";
import { BATTING } from "../data/batting";
import { loadImage } from "../engine/assets";
import type { UiCtx } from "./list";
import { board, presses, tick } from "./minigameBoard";

// ───────────────── 決まり（純粋。試験が 使う） ─────────────────

export type PitchKind = "straight" | "fast" | "curve" | "fork";
export type BallKind = "wide" | "high" | "bounce";
export type Pitch = {
	kind: PitchKind;
	ball: BallKind | null;
	side: -1 | 1;
	/** 放してから 本塁まで（ms）。 */
	flight: number;
	kmh: number;
};
/** 当たりの 幅（ずれの 半分の 幅。ms）。 */
export type Windows = { perfect: number; good: number; edge: number };
export type Contact = "perfect" | "good" | "edge" | "miss";
export type Outcome =
	| "hr"
	| "double"
	| "single"
	| "grounder"
	| "foul"
	| "popout"
	| "whiff";
export type Call = Outcome | "strike" | "ball";
export type Count = { b: number; s: number };
export type BatWho = "shobon" | "yakiu" | "nanashi";
export type BatOpt = { title?: string; pitcher?: string; who?: BatWho };
export type BatResult = "hr" | "hit" | "walk" | "k" | "out" | "quit";

export type PitcherDef = {
	/** 夜の 野球ch（関所）か 昼の 保守村（グラウンド）か。 */
	night: boolean;
	/** セットの 長さ（ms。この あいだで ばらつく）。 */
	setMs: readonly [number, number];
	mix: readonly (readonly [PitchKind, number])[];
	ballRate: number;
	ballKinds: readonly BallKind[];
	/** 1球目は かならず まっすぐの ストライク。 */
	firstStrike: boolean;
	flight: Partial<Record<PitchKind, number>> & { straight: number };
	kmh: Partial<Record<PitchKind, number>> & { straight: number };
	win: Windows;
};

export const PITCHER_DEFS: Record<BatWho, PitcherDef> = {
	// 原住民（関所）：のんびり。まっすぐと スローカーブ だけ、ボールは ワンバンだけ
	shobon: {
		night: true,
		setMs: [650, 1050],
		mix: [
			["straight", 7],
			["curve", 3],
		],
		ballRate: 0.15,
		ballKinds: ["bounce"],
		firstStrike: true,
		flight: { straight: 900, curve: 1250 },
		kmh: { straight: 98, curve: 71 },
		win: { perfect: 22, good: 65, edge: 115 },
	},
	// やきう（グラウンド）：4球種、ボール球も 多い。打てるが 楽勝では ない
	yakiu: {
		night: false,
		setMs: [500, 900],
		mix: [
			["straight", 4],
			["fast", 2],
			["curve", 2],
			["fork", 2],
		],
		ballRate: 0.28,
		ballKinds: ["wide", "high", "bounce"],
		firstStrike: false,
		flight: { straight: 700, fast: 520, curve: 1100, fork: 820 },
		kmh: { straight: 132, fast: 151, curve: 104, fork: 128 },
		win: { perfect: 18, good: 58, edge: 105 },
	},
	// 名無し（やきうが 出ていった あとの グラウンド）：やきうより すこし やさしい
	nanashi: {
		night: false,
		setMs: [550, 950],
		mix: [
			["straight", 5],
			["fast", 1],
			["curve", 3],
			["fork", 1],
		],
		ballRate: 0.25,
		ballKinds: ["wide", "bounce"],
		firstStrike: false,
		flight: { straight: 760, fast: 580, curve: 1150, fork: 860 },
		kmh: { straight: 124, fast: 141, curve: 99, fork: 121 },
		win: { perfect: 20, good: 64, edge: 110 },
	},
};

/** ホームラン競争：打ちごろの ストライク だけ（幅は ひろめ、間は みじかめ）。 */
export const DERBY_WIN: Windows = { perfect: 26, good: 70, edge: 115 };
export const DERBY_SET: readonly [number, number] = [400, 700];
const DERBY_MIX: readonly (readonly [PitchKind, number])[] = [
	["straight", 5],
	["fast", 2],
	["curve", 3],
];

/** 足を 上げる ms・テイクバックの ms（球種の 見分け）。フォークは ストレートと 同じ（だまし）。 */
export const WINDUP: Record<PitchKind, readonly [number, number]> = {
	straight: [300, 180],
	fork: [300, 180],
	fast: [520, 140],
	curve: [460, 280],
};

/** 画面の おくれ（押した 時から この ぶん 引いて はかる）。 */
export const LAG_MS = 25;

/** ずれ（+ が 遅い）。 */
export const timingOf = (pressAt: number, arriveAt: number): number =>
	pressAt - arriveAt - LAG_MS;

export const contactOf = (d: number, w: Windows): Contact => {
	const a = Math.abs(d);
	return a <= w.perfect
		? "perfect"
		: a <= w.good
			? "good"
			: a <= w.edge
				? "edge"
				: "miss";
};

/** 振った ときの 結果。 */
export const outcomeOf = (
	c: Contact,
	d: number,
	p: Pitch,
	w: Windows,
): Outcome => {
	if (c === "miss" || p.ball === "bounce") return "whiff";
	if (c === "edge") return "foul";
	if (p.ball) return "popout";
	if (c === "perfect") return "hr";
	const a = Math.abs(d);
	const span = w.good - w.perfect;
	if (a <= w.perfect + 0.35 * span) return "double";
	if (a > w.perfect + 0.7 * span) return "grounder";
	return "single";
};

/** 見送った ときの 結果。 */
export const takeOutcome = (p: Pitch): "ball" | "strike" =>
	p.ball ? "ball" : "strike";

/** カウントを 進める（end が あれば その 打席は おわり）。 */
export const applyOutcome = (
	st: Count,
	o: Call,
): { st: Count; end: Exclude<BatResult, "quit"> | null } => {
	switch (o) {
		case "strike":
		case "whiff": {
			const s = st.s + 1;
			return { st: { b: st.b, s }, end: s >= 3 ? "k" : null };
		}
		case "ball": {
			const b = st.b + 1;
			return { st: { b, s: st.s }, end: b >= 4 ? "walk" : null };
		}
		case "foul":
			return { st: { b: st.b, s: Math.min(2, st.s + 1) }, end: null };
		case "popout":
			return { st, end: "out" };
		case "hr":
			return { st, end: "hr" };
		default:
			return { st, end: "hit" };
	}
};

const weighted = <T>(
	mix: readonly (readonly [T, number])[],
	rnd: () => number,
): T => {
	const total = mix.reduce((s, [, w]) => s + w, 0);
	let r = rnd() * total;
	for (const [k, w] of mix) {
		r -= w;
		if (r < 0) return k;
	}
	return mix[0][0];
};

/** n 球目（0 から）。derby は ストライク だけで 球種も 打ちごろ。 */
export const pickPitch = (
	def: PitcherDef,
	n: number,
	rnd: () => number,
	derby = false,
): Pitch => {
	const first = !derby && n === 0 && def.firstStrike;
	const kind: PitchKind = first
		? "straight"
		: weighted(derby ? DERBY_MIX : def.mix, rnd);
	const ball =
		first || derby || rnd() >= def.ballRate
			? null
			: (def.ballKinds[Math.floor(rnd() * def.ballKinds.length)] ?? null);
	const side = rnd() < 0.5 ? -1 : 1;
	return {
		kind,
		ball,
		side,
		flight: def.flight[kind] ?? def.flight.straight,
		kmh: def.kmh[kind] ?? def.kmh.straight,
	};
};

// 打席の カメラ（m。本塁が 原点、+Z が センター、+X が 一塁がわ、h が 高さ）
const HZ = 42.4;
const F = 163.2;
const CH = 3.5;
const CZ = 7;
const CX = 120;
export const proj = (X: number, Z: number, h: number) => ({
	x: CX + (F * X) / (Z + CZ),
	y: HZ + (F * (CH - h)) / (Z + CZ),
});

/** 放す 所（マウンドの 少し 前・高さ 2.8m）。 */
const REL_Z = 17.4;
const REL_H = 2.8;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** u＝経った 時間 ÷ flight（1 で 本塁。そのあと 0.12 で ミットへ）。 */
export const ballAt = (
	p: Pitch,
	u: number,
): { X: number; Z: number; h: number } => {
	const v = Math.max(0, Math.min(u, 1));
	const prog = p.kind === "fork" ? v + 0.35 * v * (1 - v) : v;
	let Z = REL_Z * (1 - prog);
	if (u > 1) Z = -0.7 * Math.min(1, (u - 1) / 0.12);
	const end =
		{ straight: 0.8, fast: 0.95, curve: 0.7, fork: 0.5 }[p.kind] +
		(p.ball === "high" ? 0.7 : 0);
	let h = lerp(REL_H, end, v);
	if (p.kind === "curve") h += 1.1 * Math.sin(Math.PI * v);
	if (p.kind === "fork")
		h +=
			0.45 *
			Math.sin((Math.PI / 2) * Math.min(1, v / 0.75)) *
			(v < 0.75 ? 1 : Math.max(0, 1 - (v - 0.75) / 0.25));
	if (p.ball === "bounce")
		h =
			v < 0.82
				? lerp(REL_H, 0, v / 0.82)
				: 0.35 * Math.sin((Math.PI * (v - 0.82)) / 0.36);
	let X = 0;
	if (p.kind === "curve") X += p.side * 0.18 * v * v;
	if (p.ball === "wide") X += p.side * 0.62 * v;
	return { X, Z, h };
};

/** ストライクゾーン（本塁の 上。幅 ±0.25m・高さ 0.45〜1.05m）。 */
export const inZone = (b: { X: number; h: number }): boolean =>
	Math.abs(b.X) <= 0.25 && b.h >= 0.45 && b.h <= 1.05;

/** 前に とんだ 打球（theta は 度：0 が センター、+ が 一塁がわ）。 */
export type Batted = {
	o: "hr" | "double" | "single" | "grounder" | "popout";
	theta: number;
	dist: number;
	apex: number;
	T: number;
	roll: number;
	ground: boolean;
	/** 凡打：早い（遊ゴロ → 一塁へ 送球）か 遅い（二塁手が とる フライ）か。 */
	late?: boolean;
};

/**
 * 打球。早く 振れば 三塁がわ（引っぱり）、遅ければ 一塁がわ。どの ヒットも 野手の あいだへ 落ちる（追う 野手は
 * 落ちてから 着く）。凡打は 先に とられる。
 */
export const battedBall = (
	o: Batted["o"],
	d: number,
	w: Windows,
	kmh: number,
	rnd: () => number,
): Batted => {
	const sign = d < 0 ? -1 : 1;
	const jit = (a: number) => (rnd() * 2 - 1) * a;
	switch (o) {
		case "hr": {
			const k = Math.min(1, Math.abs(d) / w.perfect);
			return {
				o,
				theta: sign * k * 22 + jit(4),
				dist: 108 + 14 * (1 - k) + (kmh - 100) * 0.15,
				apex: 30,
				T: 1700,
				roll: 0,
				ground: false,
			};
		}
		case "double":
			return {
				o,
				theta: sign * 14 + jit(3),
				dist: 82,
				apex: 9,
				T: 1000,
				roll: 10,
				ground: false,
			};
		case "single":
			return {
				o,
				theta: sign * 27 + jit(3),
				dist: 52,
				apex: 5,
				T: 800,
				roll: 8,
				ground: false,
			};
		case "grounder":
			return {
				o,
				theta: sign * 22 + jit(2),
				dist: 62,
				apex: 0,
				T: 1100,
				roll: 0,
				ground: true,
			};
		default:
			return d < 0
				? {
						o: "popout",
						theta: -13,
						dist: 33,
						apex: 0,
						T: 700,
						roll: 0,
						ground: true,
						late: false,
					}
				: {
						o: "popout",
						theta: 18,
						dist: 28,
						apex: 26,
						T: 1600,
						roll: 0,
						ground: false,
						late: true,
					};
	}
};

/** 落ちてから 転がる ms。 */
const ROLL_MS = 500;

/** 打ってから t ms の 打球（地面の 位置と 高さ）。 */
export const flightAt = (
	bb: Batted,
	t: number,
): { X: number; Z: number; h: number } => {
	const a = (bb.theta * Math.PI) / 180;
	const k = Math.max(0, Math.min(1, t / bb.T));
	let r: number;
	let h: number;
	if (bb.ground) {
		r = bb.dist * (1 - (1 - k) ** 2);
		h = 0.6 * Math.abs(Math.sin(3 * Math.PI * k)) * (1 - k);
	} else {
		r = bb.dist * k;
		h = 4 * bb.apex * k * (1 - k);
		if (t > bb.T && bb.roll) {
			const q = Math.min(1, (t - bb.T) / ROLL_MS);
			r += bb.roll * (1 - (1 - q) ** 2);
		}
	}
	return { X: Math.sin(a) * r, Z: Math.cos(a) * r, h };
};

/** 上から 見た 球場の 絵（360x280）の 中の 位置（1m＝2px・本塁 (180,252)）。 */
export const toField = (X: number, Z: number) => ({
	x: 180 + 2 * X,
	y: 252 - 2 * Z,
});

/** カメラ（240x150 の 窓の 左上）。目当てへ なめらかに 寄る。絵の 外へは 出ない。 */
export const fieldCam = (
	cam: { x: number; y: number },
	target: { x: number; y: number },
	dt: number,
): { x: number; y: number } => {
	const k = Math.max(0, Math.min(1, dt / 140));
	const cl = (v: number, hi: number) => Math.max(0, Math.min(hi, v));
	return {
		x: cl(cam.x + (cl(target.x, 120) - cam.x) * k, 120),
		y: cl(cam.y + (cl(target.y, 130) - cam.y) * k, 130),
	};
};

export type Dir = "up" | "right" | "down" | "left";
/** 動く 向きから 歩行グラの 向き（同じ なら たて）。 */
export const walkDir = (vx: number, vz: number): Dir =>
	Math.abs(vx) > Math.abs(vz)
		? vx > 0
			? "right"
			: "left"
		: vz > 0
			? "up"
			: "down";

// ───────────────── 自己ベスト（ホームラン競争） ─────────────────

const DERBY_KEY = "kiriko-roguelike/derby";
/** 保存できなかった ときだけ 使う 写し。 */
let derbyMemo: number | null = null;

export const derbyBest = (): number => {
	try {
		const raw = JSON.parse(localStorage.getItem(DERBY_KEY) ?? "null");
		const v = raw && typeof raw.best === "number" ? raw.best : 0;
		return derbyMemo === null ? v : Math.max(v, derbyMemo);
	} catch {
		return derbyMemo ?? 0;
	}
};

const saveDerbyBest = (n: number): void => {
	try {
		localStorage.setItem(DERBY_KEY, JSON.stringify({ best: n }));
		derbyMemo = null;
	} catch {
		derbyMemo = n;
	}
};

// ───────────────── 絵 ─────────────────

type SprKey = keyof typeof BB_SPR;
type PoseName = keyof typeof BB_POSE;
type FxName = keyof typeof BB_FX;
type WalkKey = "walkKiriko" | "walkGen" | "walkYakiu" | "walkNanashi";

type Tone = "hr" | "hit" | "ball" | "plain" | "out";
const TONE: Record<Tone, readonly [string, string]> = {
	hr: ["#ffe060", "#c03030"],
	hit: ["#ffe060", "#000000"],
	ball: ["#80f0a0", "#000000"],
	plain: ["#ffffff", "#000000"],
	out: ["#a8b8d0", "#000000"],
};
type Banner = { text: string; tone: Tone };
const B = BATTING.banner;
const BANNER = {
	play: { text: B.play, tone: "plain" },
	strike: { text: B.strike, tone: "plain" },
	ball: { text: B.ball, tone: "ball" },
	foul: { text: B.foul, tone: "plain" },
	single: { text: B.single, tone: "hit" },
	double: { text: B.double, tone: "hit" },
	hr: { text: B.hr, tone: "hr" },
	out: { text: B.out, tone: "out" },
	k: { text: B.k, tone: "out" },
	walk: { text: B.walk, tone: "ball" },
	derby: { text: B.derby, tone: "plain" },
} as const satisfies Record<string, Banner>;

const OUTLINE8: readonly (readonly [number, number])[] = [
	[-1, -1],
	[0, -1],
	[1, -1],
	[-1, 0],
	[1, 0],
	[-1, 1],
	[0, 1],
	[1, 1],
];

const fill = (text: string, vars: Record<string, string | number>): string =>
	text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
const pickOne = <T>(xs: readonly T[]): T =>
	xs[Math.floor(Math.random() * xs.length)];

/** シートの 1コマを (x, y) に（整数の 位置に そろえる）。 */
const spr = (
	g: CanvasRenderingContext2D,
	img: HTMLImageElement,
	key: SprKey,
	i: number,
	x: number,
	y: number,
	alpha = 1,
): void => {
	const s = BB_SPR[key];
	if (alpha <= 0) return;
	if (alpha < 1) g.globalAlpha = alpha;
	g.drawImage(
		img,
		s.x + i * s.w,
		s.y,
		s.w,
		s.h,
		Math.round(x),
		Math.round(y),
		s.w,
		s.h,
	);
	if (alpha < 1) g.globalAlpha = 1;
};

/** ふちどりの 字。 */
const outlined = (
	g: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	px: number,
	tone: Tone,
	align: CanvasTextAlign = "center",
): void => {
	g.font = `${px}px 'DotGothic16', monospace`;
	g.textAlign = align;
	g.textBaseline = "alphabetic";
	const [fg, line] = TONE[tone];
	g.fillStyle = line;
	for (const [dx, dy] of OUTLINE8) g.fillText(text, x + dx, y + dy);
	g.fillStyle = fg;
	g.fillText(text, x, y);
};

/** 帯（打席は y 32〜49、上から 見た 球場は y 66〜86）。 */
const drawBanner = (
	g: CanvasRenderingContext2D,
	b: Banner,
	top: number,
	bottom: number,
	base: number,
): void => {
	g.fillStyle = "rgba(0,0,0,0.45)";
	g.fillRect(0, top, 240, bottom - top);
	outlined(g, b.text, 120, base, 16, b.tone);
};

/** ゆれ（amp px。コマごとに 向きが かわる）。 */
const shakeOf = (amp: number, now: number): [number, number] => {
	const k = Math.floor(now / 33) % 4;
	return [(k % 2 ? -1 : 1) * amp, (k < 2 ? 1 : -1) * Math.max(0, amp - 1)];
};

/** 花火（夜）と きらきら（昼）。at から、2つめは 250ms あと。100ms で 出て、おわりの 250ms で 消える。 */
const drawFireworks = (
	g: CanvasRenderingContext2D,
	img: HTMLImageElement,
	night: boolean,
	at: number,
	end: number,
	now: number,
): void => {
	const out = Math.max(0, Math.min(1, (end - now) / 250));
	[
		[0, 14, 2],
		[1, 162, 6],
	].forEach(([i, x, y], n) => {
		const a = Math.max(0, Math.min(1, (now - at - n * 250) / 100)) * out;
		spr(g, img, "fireworks", i, x, y, a);
	});
	if (night) return;
	const f = Math.floor((now - at) / 120);
	[
		[30, 8],
		[58, 14],
		[178, 10],
		[204, 4],
	].forEach(([x, y], i) => {
		spr(g, img, "fx", BB_FX.spark0 + ((f + i) % 3), x, y, out);
	});
};

// 打席の 絵の 置き場（240x150）
const PITCHER_KEY: Record<BatWho, SprKey> = {
	shobon: "pitcherShobon",
	yakiu: "pitcherYakiu",
	nanashi: "pitcherNanashi",
};
const PITCHER_NAME: Record<BatWho, string> = {
	shobon: "原住民",
	yakiu: "やきう",
	nanashi: "名無し",
};
/** 守る 人（0 投手 1 捕手 2 一塁 3 二塁 4 遊撃 5 三塁 6 左翼 7 中堅 8 右翼。m）。 */
const FIELD_POS: readonly (readonly [number, number])[] = [
	[0, 18.4],
	[0, -1.2],
	[14, 24],
	[8, 35],
	[-8, 35],
	[-14, 24],
	[-30, 72],
	[0, 82],
	[30, 72],
];
/** 打席から 見た 遠くの 野手の 足もと（一塁から 右翼まで）。 */
const FAR_AT = FIELD_POS.slice(2).map(([X, Z]) => {
	const p = proj(X, Z, 0);
	return [Math.round(p.x), Math.round(p.y)] as const;
});
const ZONE_BOX = (() => {
	const a = proj(-0.25, 0, 1.05);
	const b = proj(0.25, 0, 0.45);
	return {
		x0: Math.round(a.x),
		y0: Math.round(a.y),
		x1: Math.round(b.x),
		y1: Math.round(b.y),
	};
})();
const LAMP_X = { b: [94, 100, 106], s: [119, 125], o: [138, 144] } as const;

type Ball3 = { X: number; Z: number; h: number };
/** 打席の 場面の いまの 姿（段階ごとに 書きかえて、毎コマ drawA で 描く）。 */
type SceneA = {
	cheer: boolean;
	/** 遠くの 野手が うしろを 向く（ホームランを 見送る）。 */
	back: boolean;
	/** 投手の コマ（0 セット 1 足上げ 2 テイクバック 3 リリース 4 フォロー 5 orz 6 よろこぶ）。 */
	pose: number;
	sway: number;
	glint: number | null;
	ump: number;
	cat: number;
	/** キリコの コマ（0 構え 1 ため 2 ミート 3 フォロー 4 空振り 5 ガッツ）。 */
	k: number;
	trail: boolean;
	zone: number;
	ball: Ball3 | null;
	ghosts: (Ball3 & { a: number })[];
	spin: number;
	dust: { x: number; y: number; f: number } | null;
	fly: { x: number; y: number; size: 6 | 4 | 2 } | null;
	fx: { name: FxName; x: number; y: number }[];
	/** 芯！ の 字。 */
	pop: { x: number; y: number } | null;
	flash: number;
	banner: Banner | null;
	count: Count;
	outs: number;
	kmh: number | null;
	/** ホームラン競争の 10球（0 まだ 1 投げた 2 ホームラン）。 */
	icons: number[] | null;
	marker: "maru" | "batsu" | null;
	wow: boolean;
	what: boolean;
	/** ガッツポーズの 線（点滅を 始めた 時刻）。 */
	guts: number | null;
	fw: { at: number; end: number } | null;
	shake: number;
};

const freshA = (): SceneA => ({
	cheer: false,
	back: false,
	pose: 0,
	sway: 0,
	glint: null,
	ump: 0,
	cat: 0,
	k: 0,
	trail: false,
	zone: 0,
	ball: null,
	ghosts: [],
	spin: 0,
	dust: null,
	fly: null,
	fx: [],
	pop: null,
	flash: 0,
	banner: null,
	count: { b: 0, s: 0 },
	outs: 0,
	kmh: null,
	icons: null,
	marker: null,
	wow: false,
	what: false,
	guts: null,
	fw: null,
	shake: 0,
});

type Game = {
	g: CanvasRenderingContext2D;
	img: HTMLImageElement | null;
	take: () => "a" | "b" | null;
	at: () => number;
	say: (t: string) => void;
	se: (name: string) => void;
	who: BatWho;
	night: boolean;
	A: SceneA;
};

const ballKey = (Z: number): SprKey =>
	Z < 3 ? "ball6" : Z < 9 ? "ball4" : "ball2";

/** 打席の 場面を 1コマ 描く。 */
const drawA = (G: Game): void => {
	const { g, img, A } = G;
	const now = performance.now();
	g.setTransform(1, 0, 0, 1, 0, 0);
	g.globalAlpha = 1;
	g.fillStyle = "#000";
	g.fillRect(0, 0, 240, 150);
	const [sx, sy] = A.shake ? shakeOf(A.shake, now) : [0, 0];
	g.setTransform(1, 0, 0, 1, sx, sy);
	const zone = () => {
		if (A.zone <= 0) return;
		const { x0, y0, x1, y1 } = ZONE_BOX;
		g.globalAlpha = A.zone;
		g.fillStyle = "#ffffff";
		g.fillRect(x0, y0, x1 - x0 + 1, 1);
		g.fillRect(x0, y1, x1 - x0 + 1, 1);
		g.fillRect(x0, y0, 1, y1 - y0 + 1);
		g.fillRect(x1, y0, 1, y1 - y0 + 1);
		g.globalAlpha = 1;
	};
	if (!img) {
		// 絵が 読めない ときの 四角だけの 絵（同じ ように 遊べる）
		g.fillStyle = "#10241a";
		g.fillRect(0, 0, 240, 150);
		zone();
		g.fillStyle = "#ffffff";
		if (A.ball) {
			const p = proj(A.ball.X, A.ball.Z, A.ball.h);
			g.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 4, 4);
		}
		if (A.fly)
			g.fillRect(Math.round(A.fly.x) - 2, Math.round(A.fly.y) - 2, 4, 4);
	} else {
		spr(g, img, G.night ? "bgNight" : "bgDay", 0, 0, 0);
		if (A.cheer && Math.floor(now / 140) % 2 === 0)
			spr(g, img, G.night ? "cheerNight" : "cheerDay", 0, 0, 18);
		// スコアボード（ランプと 球速）
		if (!A.icons) {
			for (let i = 0; i < Math.min(3, A.count.b); i++)
				spr(g, img, "lamp", 0, LAMP_X.b[i], 18);
			for (let i = 0; i < Math.min(2, A.count.s); i++)
				spr(g, img, "lamp", 1, LAMP_X.s[i], 18);
			for (let i = 0; i < Math.min(2, A.outs); i++)
				spr(g, img, "lamp", 2, LAMP_X.o[i], 18);
		}
		if (A.kmh !== null)
			[...String(Math.round(A.kmh)).padStart(3, " ")].forEach((ch, i) => {
				if (ch !== " ") spr(g, img, "digit", Number(ch), 123 + i * 4, 25);
			});
		// 遠くの 野手（関所は 原住民、グラウンドは 名無し 4人）
		FAR_AT.forEach(([x, y], i) => {
			if (G.who === "shobon")
				spr(g, img, "farGen", A.back ? 1 : 0, x - 4, y - 11);
			else
				spr(
					g,
					img,
					"farNanashi",
					(i % 4) * 2 + (A.back ? 1 : 0),
					x - 4,
					y - 11,
				);
		});
		spr(g, img, PITCHER_KEY[G.who], A.pose, 108 + A.sway, 35);
		if (A.glint !== null) spr(g, img, "glint", A.glint, 116, 40);
		if (A.wow) spr(g, img, "fx", BB_FX.wow, 98, 38);
		if (A.what) spr(g, img, "fx", BB_FX.what, 128, 33);
		if (A.ball) {
			const s = proj(A.ball.X, A.ball.Z, 0);
			spr(g, img, A.ball.Z < 6 ? "shadow6" : "shadow4", 0, s.x - 4, s.y - 4);
		}
		spr(g, img, "umpire", A.ump, 134, 118);
		spr(g, img, "catcher", A.cat, 108, 118);
		zone();
		spr(g, img, "kiriko", A.k, 82, 73);
		if (A.trail) spr(g, img, "trail", 0, 82, 73);
		if (A.dust) spr(g, img, "dust", A.dust.f, A.dust.x - 4, A.dust.y - 6);
		const ball = (b: Ball3, a: number) => {
			const p = proj(b.X, b.Z, b.h);
			const key = ballKey(b.Z);
			const i = key === "ball6" ? A.spin : key === "ball4" ? A.spin % 2 : 0;
			spr(g, img, key, i, p.x - 4, p.y - 4, a);
		};
		for (const gh of A.ghosts) ball(gh, gh.a);
		if (A.ball) ball(A.ball, 1);
		if (A.fly) {
			const key =
				A.fly.size === 6 ? "ball6" : A.fly.size === 4 ? "ball4" : "ball2";
			spr(g, img, key, 0, A.fly.x - 4, A.fly.y - 4);
		}
		for (const f of A.fx) spr(g, img, "fx", BB_FX[f.name], f.x, f.y);
		if (A.guts !== null && (now - A.guts) % 300 < 200)
			spr(g, img, "fx", BB_FX.pop, 92, 62);
		if (A.fw) drawFireworks(g, img, G.night, A.fw.at, A.fw.end, now);
		if (A.marker) spr(g, img, "fx", BB_FX[A.marker], 188, 58);
		if (A.icons)
			A.icons.forEach((v, i) => {
				spr(g, img, "icon", v, 4 + i * 7, 141);
			});
	}
	if (A.pop) outlined(g, B.perfect, A.pop.x, A.pop.y, 12, "hr", "left");
	if (A.flash > 0) {
		g.fillStyle = `rgba(255,255,255,${A.flash})`;
		g.fillRect(0, 0, 240, 150);
	}
	if (A.banner) drawBanner(g, A.banner, 32, 49, 47);
	g.setTransform(1, 0, 0, 1, 0, 0);
};

/** やめた（B）。どこからでも 投げて、外で 受ける。 */
class Quit extends Error {}

/** 結果が 決まった あとの 場面（上から 見た 球場・おわりの 1枚）。B は のこりを とばすだけで、結果は 捨てない。 */
const skippable = async (run: () => Promise<unknown>): Promise<void> => {
	try {
		await run();
	} catch (e) {
		if (!(e instanceof Quit)) throw e;
	}
};

/** 毎コマ frame を 呼ぶ（true で おわり）。B で やめる。A は frame に わたす（使わなければ 捨てる）。 */
const loop = async (
	G: Game,
	frame: (t: number, key: "a" | null) => boolean,
): Promise<void> => {
	const t0 = performance.now();
	for (;;) {
		const key = G.take();
		if (key === "b") throw new Quit();
		if (frame(performance.now() - t0, key)) return;
		await tick();
	}
};

/** ms の あいだ 打席の 場面を 描く（update で 姿を 動かす）。 */
const hold = (
	G: Game,
	ms: number,
	update?: (t: number) => void,
): Promise<void> =>
	loop(G, (t) => {
		update?.(Math.min(t, ms));
		drawA(G);
		return t >= ms;
	});

// ───────────────── 1球 ─────────────────

type Thrown = { call: Call; d: number; c: Contact; bb: Batted | null };

const FX_SEQ: Record<
	Exclude<Contact, "miss">,
	readonly (readonly [FxName, number, number])[]
> = {
	perfect: [
		["impact1", 0, 50],
		["impact2", 50, 100],
		["star", 100, 180],
	],
	good: [
		["impact0", 0, 60],
		["impact1", 60, 120],
	],
	edge: [["impact0", 0, 60]],
};
/** 当たった ときに 止める ms・ゆれの px。 */
const STOP_MS = { perfect: 140, good: 90, edge: 50 } as const;
const SHAKE_PX = { perfect: 3, good: 2, edge: 1 } as const;

/** セット → 足上げ → 放す → 球が 来る（振る・見送る）。前に とんだら bb（上から 見た 場面は 呼ぶ 側）。 */
const pitchOnce = async (
	G: Game,
	p: Pitch,
	w: Windows,
	setMs: readonly [number, number],
): Promise<Thrown> => {
	const A = G.A;
	Object.assign(A, {
		pose: 0,
		k: 0,
		zone: 0.22,
		ball: null,
		ghosts: [],
		dust: null,
		fly: null,
		fx: [],
		pop: null,
		flash: 0,
		ump: 0,
		cat: 0,
		trail: false,
		sway: 0,
		glint: null,
		back: false,
		cheer: false,
		shake: 0,
		wow: false,
		what: false,
		guts: null,
		fw: null,
	});
	await hold(G, setMs[0] + Math.random() * (setMs[1] - setMs[0]));
	// 足上げ（球種の 見分け：剛速球は 長く 上げて 指先が 光る、カーブは ゆれる）
	const [kick, back] = WINDUP[p.kind];
	await hold(G, kick + back, (t) => {
		A.k = t >= 150 ? 1 : 0;
		A.pose = t < kick ? 1 : 2;
		A.sway = p.kind === "curve" && t < kick ? Math.floor(t / 140) % 2 : 0;
		A.glint =
			p.kind === "fast" && t < kick && t >= kick - 200
				? Math.floor((t - kick + 200) / 80) % 2
				: null;
	});
	A.sway = 0;
	A.glint = null;
	A.pose = 3;
	// 放す
	const rel = performance.now();
	G.take();
	G.se("throw");
	G.say(fill(BATTING.speed, { kind: BATTING.kinds[p.kind], kmh: p.kmh }));
	A.kmh = p.kmh;
	const st = {
		swing: null as number | null,
		d: 0,
		c: "miss" as Contact,
		o: null as Outcome | null,
		u: 0,
		forked: false,
		caught: false,
	};
	const bounceAt = rel + 0.82 * p.flight;
	/** ミットに おさまる 時（よい 当たりの 幅が 過ぎるまでは 捕らない）。 */
	const catchAt = rel + Math.max(1.08 * p.flight, p.flight + LAG_MS + w.good);
	/** これより 遅い スイングは どう 振っても 空振り（見送りは ここまで 待つ）。 */
	const late = rel + p.flight + LAG_MS + w.edge;
	const bounce = (() => {
		const b = ballAt(p, 0.82);
		const s = proj(b.X, b.Z, 0);
		return { x: Math.round(s.x), y: Math.round(s.y) };
	})();
	await loop(G, (_t, key) => {
		const now = performance.now();
		const u = (now - rel) / p.flight;
		if (key === "a" && st.swing === null) {
			// 押した 瞬間の 時刻で はかる（描画の 刻みに よらない）
			const at = G.at();
			st.swing = at;
			st.u = (at - rel) / p.flight;
			G.se("swing_blunt");
			// ミットに 入った あとでも、かすりの 幅の うちなら 当たる（画面の おくれの ぶん）。それより 遅ければ 空振り
			st.d = timingOf(at, rel + p.flight);
			st.c = contactOf(st.d, w);
			st.o = outcomeOf(st.c, st.d, p, w);
			if (st.o !== "whiff") return true;
		}
		A.pose = now - rel < 120 ? 3 : 4;
		const b = ballAt(p, Math.min(u, 1.12));
		A.ball = now < catchAt ? b : null;
		A.spin = Math.floor((now - rel) / (p.kind === "fast" ? 25 : 40)) % 4;
		A.ghosts =
			p.kind === "fast" && u <= 1
				? [
						[0.03, 0.45],
						[0.06, 0.25],
					]
						.filter(([du]) => u - du > 0)
						.map(([du, a]) => ({ ...ballAt(p, u - du), a }))
				: [];
		A.zone = b.Z < 4 ? 0.4 : 0.22;
		A.dust =
			p.ball === "bounce" && now >= bounceAt && now < bounceAt + 160
				? { ...bounce, f: Math.floor((now - bounceAt) / 80) }
				: null;
		if (p.kind === "fork" && u >= 0.62 && !st.forked) {
			st.forked = true;
			G.say(BATTING.forkDrop);
		}
		if (now >= catchAt && !st.caught) {
			st.caught = true;
			A.cat = 1;
			G.se("hit_fist");
		}
		if (st.swing === null) A.k = 1;
		else A.k = now - st.swing < 80 ? 2 : 4;
		drawA(G);
		if (!st.caught) return false;
		// 見送りは かすりの 幅が 過ぎるまで 待つ（遅い スイングも 判定する）
		if (st.swing === null) return now >= late;
		return now - st.swing >= 430;
	});
	A.ghosts = [];
	A.dust = null;
	if (st.o === null) {
		// 見送り
		A.ball = null;
		await hold(G, 150);
		return { call: takeOutcome(p), d: 0, c: "miss", bb: null };
	}
	if (st.o === "whiff" || st.c === "miss") {
		A.ball = null;
		return { call: "whiff", d: st.d, c: "miss", bb: null };
	}
	return contactPhase(G, p, w, st.d, st.c, st.o, st.u);
};

/** 当たった：止まる → 光る・ゆれる → フォロースルーで 球が とんでいく。 */
const contactPhase = async (
	G: Game,
	p: Pitch,
	w: Windows,
	d: number,
	c: Exclude<Contact, "miss">,
	o: Exclude<Outcome, "whiff">,
	u: number,
): Promise<Thrown> => {
	const A = G.A;
	const b = ballAt(p, Math.min(u, 1.12));
	const cp = proj(b.X, b.Z, b.h);
	const cx = Math.round(cp.x);
	const cy = Math.round(cp.y);
	G.se(c === "edge" ? "hit_club" : "hit_bat");
	if (c === "perfect") G.se("critical");
	const bb = o === "foul" ? null : battedBall(o, d, w, p.kmh, Math.random);
	const stop = STOP_MS[c];
	const amp = SHAKE_PX[c];
	const flyMs = bb ? 250 : 450;
	// 前は センターの 上へ、ファウルは 早ければ 三塁がわ、遅ければ 上へ
	const to = bb
		? { x: 120 + bb.theta * 2, y: 40 }
		: d < 0
			? { x: -10, y: 60 }
			: { x: 150, y: -10 };
	A.ball = null;
	await hold(G, stop + Math.max(320, flyMs), (t) => {
		A.shake = t < 260 ? Math.ceil(amp * (1 - t / 260)) : 0;
		A.fx = FX_SEQ[c]
			.filter(([, a, z]) => t >= a && t < z)
			.map(([name]) => ({ name, x: cx - 8, y: cy - 8 }));
		A.flash = c === "perfect" && t < 40 ? 0.5 : 0;
		A.pop = c === "perfect" && t < 300 ? { x: cx + 8, y: cy - 6 } : null;
		if (t < stop) {
			A.k = 2;
			A.trail = true;
			A.fly = { x: cx, y: cy, size: 6 };
			return;
		}
		A.k = 3;
		A.trail = false;
		const q = Math.min(1, (t - stop) / flyMs);
		A.fly =
			q < 1
				? {
						x: lerp(cx, to.x, q),
						y: lerp(cy, to.y, q),
						size: q < 0.34 ? 6 : q < 0.67 ? 4 : 2,
					}
				: null;
		if (bb && bb.o !== "popout") A.cheer = true;
		if (bb?.o === "hr") A.back = true;
	});
	A.fx = [];
	A.pop = null;
	A.flash = 0;
	A.shake = 0;
	A.fly = null;
	A.trail = false;
	return { call: o, d, c, bb };
};

/** 見送り・空振り・ファウルの 判定（帯と 下の 1行）。 */
const callNote = (r: Thrown, p: Pitch): string => {
	switch (r.call) {
		case "strike":
			return pickOne(BATTING.look);
		case "ball":
			return pickOne(BATTING.ball);
		case "foul":
			return r.d < 0 ? BATTING.foulEarly : BATTING.foulLate;
		case "whiff":
			return p.ball === "bounce"
				? BATTING.bounce
				: pickOne(r.d < 0 ? BATTING.whiffEarly : BATTING.whiffLate);
		default:
			return "";
	}
};
const callBanner = (call: Call): Banner =>
	call === "ball" ? BANNER.ball : call === "foul" ? BANNER.foul : BANNER.strike;

const callOut = async (G: Game, r: Thrown, p: Pitch): Promise<void> => {
	const A = G.A;
	A.ump = r.call === "strike" || r.call === "whiff" ? 1 : 0;
	A.banner = callBanner(r.call);
	G.say(callNote(r, p));
	if (r.call === "whiff") G.se("miss");
	else if (r.call === "strike") G.se("cancel");
	else if (r.call === "ball") G.se("cursor");
	await hold(G, 650);
	A.banner = null;
	A.ump = 0;
};

/** 打席の おわりの 1枚（打席の 場面）。 */
const card = async (
	G: Game,
	r: Exclude<BatResult, "quit">,
	hitBanner: Banner | null,
): Promise<void> => {
	const A = G.A;
	Object.assign(A, {
		ball: null,
		fly: null,
		fx: [],
		zone: 0,
		trail: false,
		cat: 0,
		glint: null,
		sway: 0,
		marker: null,
	});
	const now = performance.now();
	const ms = r === "hr" ? 1300 : 1000;
	if (r === "hr") {
		Object.assign(A, {
			k: 5,
			pose: 5,
			wow: true,
			back: true,
			cheer: true,
			guts: now,
			fw: { at: now, end: now + ms },
			banner: BANNER.hr,
		});
		G.say(BATTING.byPitcher[G.who].hr);
	} else if (r === "hit") {
		Object.assign(A, {
			k: 5,
			pose: 0,
			cheer: true,
			guts: now,
			banner: hitBanner ?? BANNER.single,
		});
	} else if (r === "walk") {
		Object.assign(A, { k: 5, pose: 0, what: true, banner: BANNER.walk });
		G.say(BATTING.walk);
		G.se("decide");
	} else if (r === "k") {
		Object.assign(A, { k: 4, pose: 6, ump: 1, outs: 1, banner: BANNER.k });
		G.say(BATTING.byPitcher[G.who].k);
	} else Object.assign(A, { k: 4, pose: 6, outs: 1, banner: BANNER.out });
	await hold(G, ms);
};

// ───────────────── 上から 見た 球場 ─────────────────

const ROW: Record<Dir, number> = { up: 0, right: 1, down: 2, left: 3 };
/** 野手の 速さ（m/s）・動きだすまで（ms）・キリコの 走る 速さ。 */
const FIELDER_MS = 8;
const REACT_MS = 150;
const RUNNER_MS = 18;
/** 一塁手が とる 送球（ms）。 */
const THROW_MS = 550;
const BASE1 = [19.4, 19.4] as const;
const BASE2 = [0, 38.8] as const;
const BASE3 = [-19.4, 19.4] as const;
const HOME = [0, 0] as const;

type Man = {
	X: number;
	Z: number;
	walk: WalkKey;
	i: number;
	/** 止まって いる ときの ポーズ（null なら 歩行グラ）。 */
	pose: PoseName | null;
	dir: Dir;
	target: readonly [number, number] | null;
	endDir: Dir;
	/** 動く あいだ この 向き（キリコの 走る 向き）。 */
	fixDir: Dir | null;
	moving: boolean;
	speed: number;
	stepMs: number;
};

const man = (
	X: number,
	Z: number,
	walk: WalkKey,
	i: number,
	pose: PoseName | null,
	dir: Dir,
): Man => ({
	X,
	Z,
	walk,
	i,
	pose,
	dir,
	target: null,
	endDir: dir,
	fixDir: null,
	moving: false,
	speed: FIELDER_MS,
	stepMs: 120,
});

/** 守る 9人。関所は 原住民（グラブと 飛びつきの ポーズ）、グラウンドは 名無し 4人。 */
const teamOf = (who: BatWho): Man[] =>
	FIELD_POS.map(([X, Z], k) => {
		if (who === "shobon") {
			if (k === 0) return man(X, Z, "walkGen", 0, null, "down");
			if (k === 1) return man(X, Z, "walkGen", 0, "genCatcher", "up");
			return man(X, Z, "walkGen", 0, "genGlove", "down");
		}
		if (k === 0)
			return who === "yakiu"
				? man(X, Z, "walkYakiu", 0, "yakiuGlove", "down")
				: man(X, Z, "walkNanashi", 0, null, "down");
		if (k === 1) return man(X, Z, "walkNanashi", 3, null, "up");
		const i = k - 2;
		return man(
			X,
			Z,
			"walkNanashi",
			who === "yakiu" ? i % 4 : (i + 1) % 4,
			null,
			"down",
		);
	});

/** 目当てへ 1コマ ぶん 歩く（着いたら true）。 */
const step = (m: Man, dt: number): boolean => {
	if (!m.target) {
		m.moving = false;
		return true;
	}
	const dx = m.target[0] - m.X;
	const dz = m.target[1] - m.Z;
	const d = Math.hypot(dx, dz);
	const s = (m.speed * dt) / 1000;
	if (d <= s) {
		m.X = m.target[0];
		m.Z = m.target[1];
		m.target = null;
		m.moving = false;
		m.dir = m.endDir;
		return true;
	}
	m.X += (dx / d) * s;
	m.Z += (dz / d) * s;
	m.moving = true;
	m.dir = m.fixDir ?? walkDir(dx, dz);
	return false;
};

type BView = {
	cam: { x: number; y: number };
	men: Man[];
	runner: Man;
	ball: Ball3 | null;
	holder: Man | null;
	bubble: Man | null;
	fw: { at: number; end: number } | null;
	banner: Banner | null;
	shake: number;
};

/** 上から 見た 場面を 1コマ 描く。 */
const drawB = (G: Game, v: BView): void => {
	const { g, img } = G;
	const now = performance.now();
	g.setTransform(1, 0, 0, 1, 0, 0);
	g.globalAlpha = 1;
	g.fillStyle = "#000";
	g.fillRect(0, 0, 240, 150);
	const [sx, sy] = v.shake ? shakeOf(v.shake, now) : [0, 0];
	g.setTransform(1, 0, 0, 1, sx, sy);
	const cx = Math.round(v.cam.x);
	const cy = Math.round(v.cam.y);
	const scr = (X: number, Z: number) => {
		const f = toField(X, Z);
		return { x: Math.round(f.x) - cx, y: Math.round(f.y) - cy };
	};
	if (img) {
		const f = BB_SPR[G.night ? "fieldNight" : "fieldDay"];
		g.drawImage(img, f.x + cx, f.y + cy, 240, 150, 0, 0, 240, 150);
	} else {
		g.fillStyle = "#2f6e35";
		g.fillRect(0, 0, 240, 150);
	}
	// 人（奥から。キリコは 3m 手前 あつかい：ホームの そばで キャッチャーに かくれない ように）
	const depth = (m: Man) => (m === v.runner ? m.Z - 3 : m.Z);
	const people = [...v.men, v.runner].sort((a, b) => depth(b) - depth(a));
	for (const m of people) {
		const { x, y } = scr(m.X, m.Z);
		if (!img) {
			g.fillStyle = m.walk === "walkKiriko" ? "#28a131" : "#e8e8f0";
			g.fillRect(x - 2, y - 6, 4, 6);
			continue;
		}
		if (!m.moving && m.pose)
			spr(g, img, "pose", BB_POSE[m.pose], x - 8, y - 15);
		else {
			const s = BB_SPR[m.walk];
			const f = Math.floor(now / (m.moving ? m.stepMs : 400)) % 2;
			g.drawImage(
				img,
				s.x + m.i * 32 + 16 * f,
				s.y + 16 * ROW[m.dir],
				16,
				16,
				x - 8,
				y - 15,
				16,
				16,
			);
		}
	}
	// 球（持っている 人の 手もと か、とんでいる 球と 影）
	if (v.holder) {
		const { x, y } = scr(v.holder.X, v.holder.Z);
		if (img) spr(g, img, "ball4", 0, x - 4, y - 13);
		else {
			g.fillStyle = "#ffffff";
			g.fillRect(x - 1, y - 10, 3, 3);
		}
	} else if (v.ball) {
		const { x, y } = scr(v.ball.X, v.ball.Z);
		const by = Math.round(y - v.ball.h * 1.4);
		if (img) {
			spr(g, img, "shadow4", 0, x - 4, y - 4);
			spr(g, img, v.ball.h >= 6 ? "ball6" : "ball4", 0, x - 4, by - 4);
		} else {
			g.fillStyle = "#ffffff";
			g.fillRect(x - 1, by - 1, 3, 3);
		}
	}
	if (img && v.bubble) {
		const { x, y } = scr(v.bubble.X, v.bubble.Z);
		spr(g, img, "fx", BB_FX.bang, x - 8, y - 32);
	}
	if (img && v.fw) drawFireworks(g, img, G.night, v.fw.at, v.fw.end, now);
	if (v.banner) drawBanner(g, v.banner, 66, 86, 82);
	g.setTransform(1, 0, 0, 1, 0, 0);
};

/**
 * 前に とんだ あと（上から 見た 球場）。カメラは 打球を 追い（走る キリコも なるべく 入れる）、球が 止まったら 止まる。
 * 帯を 出してから holdMs で おわる。帯（ヒットなら どの ヒットか）を 返す。
 */
const fieldScene = async (
	G: Game,
	bb: Batted,
	derby: boolean,
): Promise<Banner> => {
	const men = teamOf(G.who);
	const runner: Man = {
		...man(-1.2, 0.4, "walkKiriko", 0, null, "right"),
		speed: RUNNER_MS,
		stepMs: 90,
	};
	const legs =
		bb.o === "hr"
			? [BASE1, BASE2, BASE3, HOME]
			: bb.o === "double"
				? [BASE1, BASE2]
				: [BASE1];
	const LEG_DIR: readonly Dir[] = ["right", "left", "left", "right"];
	const a = (bb.theta * Math.PI) / 180;
	const ux = Math.sin(a);
	const uz = Math.cos(a);
	const restAt = bb.T + (bb.roll ? ROLL_MS : 0);
	const rest = flightAt(bb, restAt);
	// 関所の 原住民は、抜けていく ゴロ・ライナーに いちばん 近い 内野手が 飛びつく
	let diver = -1;
	let along = 0;
	if (G.who === "shobon" && (bb.o === "single" || bb.o === "grounder")) {
		let best = 7;
		for (let k = 2; k <= 5; k++) {
			const [X, Z] = FIELD_POS[k];
			const al = X * ux + Z * uz;
			const perp = Math.abs(X * uz - Z * ux);
			if (al > 0 && al < bb.dist && perp <= best) {
				best = perp;
				diver = k;
				along = al;
			}
		}
	}
	// 追う 人（ホームランは 外野が フェンスまで、凡打は 遊撃か 二塁、ヒットは 止まる 所に いちばん 近い 人）
	const chaseTo: readonly [number, number] =
		bb.o === "hr" ? [93 * ux, 93 * uz] : [rest.X, rest.Z];
	const pool =
		bb.o === "hr"
			? [6, 7, 8]
			: [2, 3, 4, 5, 6, 7, 8].filter((k) => k !== diver);
	const chaser =
		bb.o === "popout"
			? bb.late
				? 3
				: 4
			: pool.reduce((best, k) =>
					Math.hypot(
						FIELD_POS[k][0] - chaseTo[0],
						FIELD_POS[k][1] - chaseTo[1],
					) <
					Math.hypot(
						FIELD_POS[best][0] - chaseTo[0],
						FIELD_POS[best][1] - chaseTo[1],
					)
						? k
						: best,
				);
	const holdMs = bb.o === "hr" ? (derby ? 700 : 1300) : 900;
	const st = {
		started: false,
		leg: 0,
		holder: -1,
		throwFrom: null as readonly [number, number] | null,
		banner: null as Banner | null,
		bannerAt: -1,
		fenceAt: -1,
		fwAt: 0,
		diveAt: -1,
		cam: { x: 60, y: 130 },
		last: 0,
	};
	const show = (b: Banner, note: string, se: string, t: number) => {
		if (st.banner) return;
		st.banner = b;
		st.bannerAt = t;
		G.say(note);
		G.se(se);
	};
	const hitBanner =
		bb.o === "double"
			? BANNER.double
			: bb.o === "hr"
				? BANNER.hr
				: BANNER.single;
	const hitNote =
		bb.o === "double"
			? BATTING.double
			: bb.o === "grounder"
				? BATTING.grounder
				: pickOne(BATTING.single);
	await loop(G, (t) => {
		const dt = Math.min(100, t - st.last);
		st.last = t;
		const now = performance.now();
		// 投手は ふりかえって 打球を 見る
		const P = men[0];
		if (P.pose === "yakiuGlove") P.pose = "yakiuBack";
		else if (!P.pose) P.dir = "up";
		if (t >= REACT_MS && !st.started) {
			st.started = true;
			const C = men[chaser];
			C.target = chaseTo;
			C.endDir = bb.o === "hr" ? "up" : "down";
			if (bb.o === "popout" && !bb.late) {
				men[2].target = BASE1;
				men[2].endDir = "left";
			}
			if (diver >= 0) men[diver].target = [along * ux, along * uz];
			runner.target = legs[0];
			runner.fixDir = LEG_DIR[0];
			runner.endDir = legs.length > 1 ? LEG_DIR[1] : "down";
		}
		for (const m of men) step(m, dt);
		if (step(runner, dt) && st.started && st.leg < legs.length - 1) {
			st.leg++;
			runner.target = legs[st.leg];
			runner.fixDir = LEG_DIR[st.leg];
			runner.endDir = st.leg < legs.length - 1 ? LEG_DIR[st.leg + 1] : "down";
		}
		// 球
		let ball: Ball3 | null = null;
		if (bb.o === "popout" && !bb.late && t >= bb.T) {
			// 遊撃手が とって、一塁へ 投げる
			const ss = men[4];
			const q = (t - bb.T - 120) / THROW_MS;
			if (q < 0) st.holder = 4;
			else if (q < 1) {
				st.holder = -1;
				if (!st.throwFrom) st.throwFrom = [ss.X, ss.Z];
				const [fx, fz] = st.throwFrom;
				ball = {
					X: lerp(fx, BASE1[0], q),
					Z: lerp(fz, BASE1[1], q),
					h: 2 * Math.sin(Math.PI * q),
				};
			} else {
				st.holder = 2;
				show(BANNER.out, BATTING.popout, "cancel", t);
			}
		} else if (bb.o === "popout" && t >= bb.T) {
			st.holder = chaser;
			show(BANNER.out, BATTING.popout, "cancel", t);
		} else if (!(bb.o === "hr" && t > bb.T))
			ball = flightAt(bb, Math.min(t, restAt));
		if (ball && st.holder < 0) {
			const r = Math.hypot(ball.X, ball.Z);
			if (bb.o === "hr" && r >= 95 && st.fenceAt < 0) {
				// フェンスを こえた
				st.fenceAt = t;
				st.fwAt = now;
				show(
					BANNER.hr,
					derby
						? fill(BATTING.distance, { m: Math.round(bb.dist) })
						: pickOne(BATTING.hr),
					"levelup",
					t,
				);
			}
			if ((bb.o === "single" || bb.o === "double") && t >= bb.T)
				show(hitBanner, hitNote, "decide", t);
			if (bb.o === "grounder" && r >= 40) show(hitBanner, hitNote, "decide", t);
			// 飛びつく（とどかない）
			if (diver >= 0 && st.diveAt < 0 && r >= along - 1.5) {
				st.diveAt = t;
				const m = men[diver];
				m.target = null;
				m.moving = false;
				m.pose = "genDive";
			}
			// 追いついて 拾う（ヒットは 止まってから）
			const C = men[chaser];
			if (
				bb.o !== "hr" &&
				bb.o !== "popout" &&
				t >= restAt &&
				!C.target &&
				st.started
			)
				st.holder = chaser;
		}
		if (diver >= 0 && st.diveAt >= 0 && t - st.diveAt >= 600)
			men[diver].pose = "genGlove";
		// カメラ：打球が 生きている あいだ 追う（走る キリコが 下へ 切れる なら、球が 上に 切れない ぶんだけ 下げる）
		if (ball && st.holder < 0) {
			const f = toField(ball.X, ball.Z);
			const rf = toField(runner.X, runner.Z);
			let ty = f.y - 80;
			if (rf.y - ty > 140) ty = Math.min(rf.y - 140, f.y - 16);
			st.cam = fieldCam(st.cam, { x: f.x - 120, y: ty }, dt);
		}
		const end = st.bannerAt >= 0 ? st.bannerAt + holdMs : Infinity;
		drawB(G, {
			cam: st.cam,
			men,
			runner,
			ball: st.holder < 0 ? ball : null,
			holder: st.holder >= 0 ? men[st.holder] : null,
			bubble: t >= 150 && t < 650 ? men[chaser] : null,
			fw: st.fenceAt >= 0 ? { at: st.fwAt, end: now + (end - t) } : null,
			banner: st.banner,
			shake: st.fenceAt >= 0 && t - st.fenceAt < 200 ? 2 : 0,
		});
		// 帯の あと holdMs（念の ため 8秒で おわる）
		return t >= end || t > 8000;
	});
	return bb.o === "popout" ? BANNER.out : hitBanner;
};

// ───────────────── 1打席・ホームラン競争 ─────────────────

/** 板を 出して 遊ぶ（B で やめたら null）。絵は ここで 読む（読めなければ 四角だけ）。 */
const withBoard = async <T>(
	ctx: UiCtx,
	title: string,
	who: BatWho,
	play: (G: Game) => Promise<T>,
): Promise<T | null> => {
	const b = board(ctx, title, BATTING.hint);
	const p = presses(ctx, b.root);
	try {
		b.g.fillStyle = "#000";
		b.g.fillRect(0, 0, 240, 150);
		const img = await loadImage(BB_SHEET);
		const G: Game = {
			g: b.g,
			img,
			take: p.take,
			at: p.at,
			say: (t) => {
				b.note.textContent = t;
			},
			se: ctx.se,
			who,
			night: PITCHER_DEFS[who].night,
			A: freshA(),
		};
		return await play(G);
	} catch (e) {
		if (e instanceof Quit) return null;
		throw e;
	} finally {
		p.stop();
		b.close();
	}
};

const playAtBat = async (
	G: Game,
	pitcher: string,
): Promise<Exclude<BatResult, "quit">> => {
	const def = PITCHER_DEFS[G.who];
	const A = G.A;
	A.banner = BANNER.play;
	G.say(fill(BATTING.mound, { p: pitcher }));
	await hold(G, 900);
	A.banner = null;
	let st: Count = { b: 0, s: 0 };
	for (let n = 0; ; n++) {
		const p = pickPitch(def, n, Math.random);
		const r = await pitchOnce(G, p, def.win, def.setMs);
		const next = applyOutcome(st, r.call);
		st = next.st;
		A.count = st;
		// 打席が おわった（前に とんだ・フォアボール・三振）あとは、B で 場面を とばしても 結果は そのまま
		const bb = r.bb;
		if (bb) {
			const end = next.end ?? "hit";
			await skippable(async () => {
				const ban = await fieldScene(G, bb, false);
				await card(G, end, ban);
			});
			return end;
		}
		const end = next.end;
		if (end) {
			await skippable(async () => {
				await callOut(G, r, p);
				await card(G, end, null);
			});
			return end;
		}
		await callOut(G, r, p);
	}
};

/**
 * 1打席。ホームラン・ヒット・フォアボールなら "hr"・"hit"・"walk"、三振 "k"、凡打 "out"、B で やめたら "quit"。
 * opt は 村の グラウンドで 打つ ときの 題・投げる 人の 名前・だれが 投げるか（ふだんは 跡地の 関所：原住民）。
 */
export const atBat = async (
	ctx: UiCtx,
	opt: BatOpt = {},
): Promise<BatResult> => {
	const who = opt.who ?? "shobon";
	const r = await withBoard(ctx, opt.title ?? "野球ch　1打席", who, (G) =>
		playAtBat(G, opt.pitcher ?? PITCHER_NAME[who]),
	);
	return r ?? "quit";
};

/** 1打席（関所）。ホームラン・ヒット・フォアボールで true。三振・凡打・B で やめても false。 */
export const playBatting = async (
	ctx: UiCtx,
	opt: BatOpt = {},
): Promise<boolean> => {
	const r = await atBat(ctx, opt);
	return r === "hr" || r === "hit" || r === "walk";
};

const runDerby = async (
	G: Game,
	pitcher: string,
): Promise<{ hr: number; best: number; newBest: boolean; far: number }> => {
	const def = PITCHER_DEFS[G.who];
	const A = G.A;
	const icons = Array.from({ length: 10 }, () => 0);
	A.icons = icons;
	A.banner = BANNER.derby;
	G.say(fill(BATTING.mound, { p: pitcher }));
	await hold(G, 900);
	A.banner = null;
	let hr = 0;
	let far = 0;
	for (let n = 0; n < 10; n++) {
		const p = pickPitch(def, n, Math.random, true);
		const r = await pitchOnce(G, p, DERBY_WIN, DERBY_SET);
		icons[n] = r.call === "hr" ? 2 : 1;
		if (r.call === "hr" && r.bb) {
			hr++;
			const bb = { ...r.bb, T: 1300 };
			far = Math.max(far, Math.round(bb.dist));
			await fieldScene(G, bb, true);
			Object.assign(A, { pose: 0, cheer: true, back: false });
			await hold(G, 500, (t) => {
				A.k = 5;
				A.marker = t < 400 ? "maru" : null;
			});
		} else {
			A.banner = r.bb ? BANNER.single : callBanner(r.call);
			if (!r.bb) G.say(callNote(r, p));
			if (r.call === "whiff") G.se("miss");
			else if (r.call === "strike") G.se("cancel");
			await hold(G, r.bb ? 500 : 400, (t) => {
				A.marker = t < 400 ? "batsu" : null;
			});
		}
		Object.assign(A, { marker: null, banner: null, cheer: false, back: false });
	}
	const prev = derbyBest();
	const newBest = hr > prev && hr > 0;
	if (newBest) saveDerbyBest(hr);
	Object.assign(A, {
		k: hr > 0 ? 5 : 0,
		pose: hr > 0 ? 5 : 6,
		ball: null,
		zone: 0,
		cheer: newBest,
		banner: {
			text: fill(BATTING.banner.derbyEnd, { n: hr }),
			tone: "hit",
		} satisfies Banner,
	});
	G.say(newBest ? BATTING.derbyBest : "");
	if (newBest) G.se("served");
	// 記録は もう 保存した。B は この 1枚を とばすだけ
	await skippable(() => hold(G, 1500));
	return { hr, best: Math.max(prev, hr), newBest, far };
};

/**
 * ホームラン競争（グラウンド）。打ちごろの ストライク 10球で ホームランを 何本 打てるか。
 * B で やめたら null（記録しない）。自己ベストを こえたら 保存する。
 */
export const playDerby = (
	ctx: UiCtx,
	opt: BatOpt = {},
): Promise<{
	hr: number;
	best: number;
	newBest: boolean;
	far: number;
} | null> => {
	const who = opt.who ?? "yakiu";
	return withBoard(ctx, opt.title ?? "ホームラン競争", who, (G) =>
		runDerby(G, opt.pitcher ?? PITCHER_NAME[who]),
	);
};
