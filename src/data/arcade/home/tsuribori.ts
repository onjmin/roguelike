// キリコの 家の ゲーム「おんJ釣り堀」（tsuribori）の 決まり。板は ui/arcade/home/tsuribori.ts、文は data/arcade/text.ts。
// - 横から 見た 釣り堀。左の 岸から 投げる。A で 力の 目もりを 出し、もう 1回で 投げる（強いほど 遠く、遠いほど 大物が 多い）。
// - 浮きが 小さく ゆれる「つつき」は にせもの。そこで 合わせると 早すぎて 魚が 逃げる。
//   浮きが 沈んだら（本当の あたり）短い あいだに A で 合わせる。おくれると 逃げられる。
// - 合わせたら 引きあい：A を 押して いる（くり返し・タップ）あいだ 巻く。巻くと 糸が はり、魚が 走ると もっと はる。
//   はなすと ゆるむ。はりが いっぱいで 糸が 切れる。ゆるみすぎが つづくと 外れる。岸まで よせたら 釣れる。
// - 90秒。点は 釣った 魚の 点の 合計（大きいほど 高い）。時間ぎれでも 引きあい中の 1匹は 最後まで。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import type { Rnd } from "../logic";

export const TB = {
	time: 90,
	/** 岸（竿先）と 水面の 高さ。投げる 先の 近い・遠い。 */
	shoreX: 34,
	waterY: 58,
	nearX: 70,
	farX: 226,
	/** 力の 目もりが 0→1→0 と 往復する 秒・飛ぶ 秒。 */
	powerPeriod: 1.3,
	castSec: 0.7,
	/** あたりまでの 秒（いちばん 早い・おそい）・つつきの 長さ。 */
	biteMin: 1.6,
	biteMax: 6,
	nibbleSec: 0.3,
	/** 巻く 速さ（画素／秒）と はりの 上がり・下がり（1／秒）。 */
	reel: 40,
	tenseUp: 0.42,
	tenseDown: 0.6,
	/** ゆるみと みなす はり・外れるまでの 秒。 */
	slack: 0.08,
	slackSec: 2.4,
	/** 釣れた・逃げた あとに 見せる 秒。 */
	resultSec: 1.2,
	/** 時間ぎれの あと 引きあいを 待つ 秒。 */
	overtime: 15,
} as const;

export type TbKind = "funa" | "koi" | "namazu" | "gold" | "boot" | "saba";

/** 魚（と ハズレ）。size は cm（ハズレは 0）。str は 引きの 強さ、w は 出やすさ（near は 近く・far は 遠く）。 */
export const TB_KIND: Record<
	TbKind,
	{
		name: string;
		pts: number;
		size: readonly [number, number];
		str: number;
		near: number;
		far: number;
	}
> = {
	funa: { name: "フナ", pts: 30, size: [12, 28], str: 0.3, near: 50, far: 22 },
	koi: { name: "鯉", pts: 80, size: [35, 72], str: 0.6, near: 18, far: 30 },
	namazu: {
		name: "ナマズ",
		pts: 120,
		size: [40, 85],
		str: 0.78,
		near: 6,
		far: 18,
	},
	gold: {
		name: "金の　鯉",
		pts: 500,
		size: [55, 90],
		str: 0.92,
		near: 0.5,
		far: 5,
	},
	boot: { name: "長靴", pts: 5, size: [0, 0], str: 0.12, near: 9, far: 6 },
	saba: { name: "鯖缶", pts: 15, size: [0, 0], str: 0.12, near: 3, far: 4 },
};

/** 板の 字。 */
export const TB_TEXT = {
	power: "力",
	tension: "糸",
	log: "釣果",
	nibble: "つんつん……",
	bite: "沈んだ！",
	early: "早すぎた　魚が　逃げた",
	late: "おそかった　逃げられた",
	hook: "かかった！　巻け",
	snap: "糸が　切れた",
	escape: "ゆるんで　外れた",
	catch: "{name}が　釣れた",
	junk: "{name}……",
	last: "ラストの　1匹",
	cm: "cm",
} as const;

export type TbCatch = { kind: TbKind; cm: number; pts: number };

export type TbState = {
	t: number;
	phase: "ready" | "power" | "cast" | "wait" | "bite" | "fight" | "result";
	power: number;
	powT: number;
	/** 浮きの 位置（x）と 沈み（0〜1）・飛ぶ はじまりからの 秒。 */
	fx: number;
	sink: number;
	timer: number;
	/** 投げた 先（0 近い〜1 遠い）。 */
	far: number;
	/** かかる 魚・大きさ。 */
	kind: TbKind;
	cm: number;
	/** あたりまでの 秒と つつきの 時刻。 */
	biteAt: number;
	nibbles: number[];
	/** 合わせる のこり 秒。 */
	window: number;
	/** 引きあい：はり（0〜1）・岸からの 糸の 長さ・魚が 走る のこり 秒・次に 走るまでの 秒・ゆるみの 秒。 */
	tension: number;
	line: number;
	run: number;
	calm: number;
	slackT: number;
	/** 魚の 体力（走るたびに 減って 引きが 弱る）。 */
	stamina: number;
	catches: TbCatch[];
	msg: string;
	over: boolean;
};

export type TbEvent =
	| "power"
	| "cast"
	| "land"
	| "nibble"
	| "bite"
	| "early"
	| "late"
	| "hook"
	| "run"
	| "snap"
	| "escape"
	| "catch"
	| "over";

export type TbInput = {
	/** A／タップの 押しはじめ。 */
	press: boolean;
	/** 巻いている（押しっぱなし・つづけて タップ）。 */
	reel: boolean;
};

export const tbStart = (): TbState => ({
	t: 0,
	phase: "ready",
	power: 0,
	powT: 0,
	fx: TB.shoreX,
	sink: 0,
	timer: 0,
	far: 0,
	kind: "funa",
	cm: 0,
	biteAt: 0,
	nibbles: [],
	window: 0,
	tension: 0,
	line: 0,
	run: 0,
	calm: 0,
	slackT: 0,
	stamina: 1,
	catches: [],
	msg: "",
	over: false,
});

export const tbScore = (s: TbState): number =>
	s.catches.reduce((a, c) => a + c.pts, 0);
export const tbTimeLeft = (s: TbState): number => Math.max(0, TB.time - s.t);

/** 大きさから 点（いちばん 小さくて 0.6倍、大きくて 1.4倍）。 */
export const tbPoints = (kind: TbKind, cm: number): number => {
	const k = TB_KIND[kind];
	const [lo, hi] = k.size;
	const u = hi > lo ? (cm - lo) / (hi - lo) : 0.5;
	return Math.round(k.pts * (0.6 + 0.8 * Math.max(0, Math.min(1, u))));
};

/** 投げた 先で かかる ものを 決める。 */
export const tbPick = (far: number, rnd: Rnd): TbKind => {
	const kinds = Object.keys(TB_KIND) as TbKind[];
	const w = kinds.map(
		(k) => TB_KIND[k].near + (TB_KIND[k].far - TB_KIND[k].near) * far,
	);
	let r = rnd() * w.reduce((a, b) => a + b, 0);
	for (let i = 0; i < kinds.length; i++) {
		r -= w[i] as number;
		if (r < 0) return kinds[i] as TbKind;
	}
	return "funa";
};

/** 合わせられる 秒（強い 魚ほど 短い）。 */
export const tbWindow = (kind: TbKind): number =>
	0.75 - TB_KIND[kind].str * 0.3;

const tri = (t: number): number => {
	const k = (t / TB.powerPeriod) % 1;
	return k < 0.5 ? k * 2 : 2 - k * 2;
};

/** 浮きが 水に ついた：魚・あたり・つつきを 決める。 */
const land = (s: TbState, rnd: Rnd): void => {
	s.phase = "wait";
	s.timer = 0;
	s.sink = 0;
	s.kind = tbPick(s.far, rnd);
	const [lo, hi] = TB_KIND[s.kind].size;
	s.cm = Math.round(lo + (hi - lo) * rnd() ** 1.6);
	s.biteAt = TB.biteMin + (TB.biteMax - TB.biteMin) * rnd();
	s.nibbles = [];
	const n = Math.floor(rnd() * 4);
	for (let i = 0; i < n; i++) {
		const at = 0.5 + rnd() * (s.biteAt - 1.2);
		if (at > 0.4 && s.nibbles.every((o) => Math.abs(o - at) > 0.7))
			s.nibbles.push(at);
	}
	s.nibbles.sort((a, b) => a - b);
};

const result = (s: TbState, msg: string): void => {
	s.phase = "result";
	s.timer = TB.resultSec;
	s.msg = msg;
	s.sink = 0;
	s.tension = 0;
};

/** 引きあいを はじめる（試験からも 呼ぶ）。 */
export const tbHook = (s: TbState, rnd: Rnd): void => {
	s.phase = "fight";
	s.tension = 0.3;
	s.line = Math.max(20, s.fx - TB.shoreX);
	s.run = 0;
	s.calm = 0.6 + rnd() * 0.8;
	s.slackT = 0;
	s.stamina = 1;
	s.msg = TB_TEXT.hook;
};

const fight = (
	s: TbState,
	dt: number,
	reel: boolean,
	rnd: Rnd,
	ev: TbEvent[],
): void => {
	const k = TB_KIND[s.kind];
	const junk = k.size[1] === 0;
	if (s.run > 0) {
		s.run -= dt;
		if (s.run <= 0) {
			s.calm = 1 + rnd() * 1.4 - k.str * 0.4;
			// 走るたびに 弱る
			s.stamina = Math.max(0.35, s.stamina * 0.78);
		}
	} else if (!junk) {
		s.calm -= dt;
		if (s.calm <= 0) {
			s.run = 0.5 + rnd() * 0.6 + k.str * 0.8;
			ev.push("run");
		}
	}
	const running = s.run > 0;
	const pull = (running ? k.str * 0.75 : k.str * 0.08) * s.stamina;
	s.tension += ((reel ? TB.tenseUp : -TB.tenseDown) + pull) * dt;
	s.tension = Math.max(0, s.tension);
	s.line +=
		(reel
			? -TB.reel * (running ? 0.3 : 1)
			: k.str * s.stamina * (running ? 26 : 5)) * dt;
	s.line = Math.min(TB.farX - TB.shoreX, s.line);
	s.fx = TB.shoreX + s.line;
	if (s.tension >= 1) {
		ev.push("snap");
		result(s, TB_TEXT.snap);
		return;
	}
	s.slackT = s.tension < TB.slack ? s.slackT + dt : 0;
	// 時間ぎれの あと 長びいたら 外れる（おわらない ことの ないように）
	if (s.slackT > TB.slackSec || s.t > TB.time + TB.overtime) {
		ev.push("escape");
		result(s, TB_TEXT.escape);
		return;
	}
	if (s.line <= 6) {
		const pts = tbPoints(s.kind, s.cm);
		s.catches.push({ kind: s.kind, cm: s.cm, pts });
		ev.push("catch");
		result(s, (junk ? TB_TEXT.junk : TB_TEXT.catch).replace("{name}", k.name));
	}
};

export const tbStep = (
	s: TbState,
	dt: number,
	inp: TbInput,
	rnd: Rnd,
): TbEvent[] => {
	const ev: TbEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	const late = s.t >= TB.time;
	if (late && s.phase !== "fight") {
		s.over = true;
		ev.push("over");
		return ev;
	}
	switch (s.phase) {
		case "ready":
			s.fx = TB.shoreX;
			if (inp.press) {
				s.phase = "power";
				s.powT = 0;
				ev.push("power");
			}
			break;
		case "power":
			s.powT += dt;
			s.power = tri(s.powT);
			if (inp.press) {
				s.phase = "cast";
				s.far = s.power;
				s.timer = 0;
				ev.push("cast");
			}
			break;
		case "cast": {
			s.timer += dt;
			const k = Math.min(1, s.timer / TB.castSec);
			s.fx =
				TB.shoreX + (TB.nearX + (TB.farX - TB.nearX) * s.far - TB.shoreX) * k;
			if (k >= 1) {
				land(s, rnd);
				ev.push("land");
			}
			break;
		}
		case "wait": {
			const prev = s.timer;
			s.timer += dt;
			// つつき（小さく ゆれる だけ）
			const nib = s.nibbles.find(
				(a) => s.timer >= a && s.timer < a + TB.nibbleSec,
			);
			s.sink =
				nib !== undefined
					? Math.sin(((s.timer - nib) / TB.nibbleSec) * Math.PI) * 0.25
					: 0;
			if (s.nibbles.some((a) => prev < a && s.timer >= a)) ev.push("nibble");
			if (inp.press) {
				ev.push("early");
				result(s, TB_TEXT.early);
			} else if (s.timer >= s.biteAt) {
				s.phase = "bite";
				s.window = tbWindow(s.kind);
				s.msg = TB_TEXT.bite;
				ev.push("bite");
			}
			break;
		}
		case "bite":
			s.window -= dt;
			s.sink = Math.min(1, s.sink + dt * 8);
			if (inp.press) {
				tbHook(s, rnd);
				ev.push("hook");
			} else if (s.window <= 0) {
				ev.push("late");
				result(s, TB_TEXT.late);
			}
			break;
		case "fight":
			fight(s, dt, inp.reel, rnd, ev);
			break;
		case "result":
			s.timer -= dt;
			if (s.timer <= 0) s.phase = "ready";
			break;
	}
	if (late && s.phase !== "fight") {
		s.over = true;
		ev.push("over");
	}
	return ev;
};
