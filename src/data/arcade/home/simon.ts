// キリコの 家の ゲーム「音おぼえ」（simon）の 決まり。板は ui/arcade/home/simon.ts、文は data/arcade/text.ts。
// - 4つの パッド（←↓↑→）。それぞれ 色と 高さの ちがう 音。
// - ターンテーブルが 光らせて 鳴らした 順に 押す。1回 そろうごとに 1つ ふえ、すこし 速くなる。
// - まちがえると 正しい パッドが 点滅して おわり。スコア＝そろえた 回数×100。
// DOM に 触らない（試験できる）。乱数は 渡された rnd。

import type { Rnd } from "../logic";

/** パッド：0 ←・1 ↓・2 ↑・3 →。 */
export type SmPad = 0 | 1 | 2 | 3;

export const SM = {
	/** 光る 秒（はじめ・いちばん 短い とき・1回で 縮む 分）。 */
	on: 0.5,
	fastest: 0.2,
	speedUp: 0.025,
	/** 光と 光の あいだ。 */
	gap: 0.14,
	/** 見せる 前の 間・そろった あとの 間。 */
	lead: 0.7,
	/** 押した ときに 光る 秒。 */
	press: 0.22,
	/** まちがえた あと 正しい パッドを 点滅させる 秒。 */
	fail: 1.4,
	/** パッドの 音（MIDI 番号。ド・ミ・ソ・上の ド）。 */
	notes: [60, 64, 67, 72] as readonly number[],
} as const;

/** 板の 字。 */
export const SM_TEXT = {
	watch: "おぼえて……",
	yours: "押して！",
	round: "ROUND",
	nice: "そろった！",
	wrong: "ちがう",
} as const;

export type SmState = {
	seq: SmPad[];
	phase: "show" | "input" | "fail" | "done";
	/** その 場面の 時計。 */
	t: number;
	/** 見せて いる・押す 番の 何番目。 */
	i: number;
	/** 光って いる パッドと のこり 秒。 */
	lit: SmPad | null;
	litT: number;
	/** まちがえた とき 押す はずだった パッド。 */
	want: SmPad | null;
	/** そろえた 回数。 */
	rounds: number;
	over: boolean;
};
export type SmEvent =
	| { k: "lit"; pad: SmPad }
	| { k: "ok"; pad: SmPad }
	| { k: "round" }
	| { k: "wrong"; pad: SmPad };

const pick = (rnd: Rnd): SmPad => Math.floor(rnd() * 4) as SmPad;

export const smStart = (rnd: Rnd): SmState => ({
	seq: [pick(rnd)],
	phase: "show",
	t: -SM.lead,
	i: 0,
	lit: null,
	litT: 0,
	want: null,
	rounds: 0,
	over: false,
});

/** いまの 速さの 光る 秒。 */
export const smOn = (s: SmState): number =>
	Math.max(SM.fastest, SM.on - s.rounds * SM.speedUp);

export const smScore = (s: SmState): number => s.rounds * 100;

export const smStep = (
	s: SmState,
	dt: number,
	press: SmPad | null,
	rnd: Rnd,
): SmEvent[] => {
	const ev: SmEvent[] = [];
	if (s.over) return ev;
	s.t += dt;
	s.litT = Math.max(0, s.litT - dt);
	if (s.litT === 0 && s.phase !== "fail") s.lit = null;
	if (s.phase === "show") {
		// 光る 秒＋あいだ ごとに 1つずつ
		const on = smOn(s);
		if (s.t >= 0 && s.lit === null && s.i < s.seq.length) {
			s.lit = s.seq[s.i];
			s.litT = on;
			ev.push({ k: "lit", pad: s.lit });
			s.i++;
			s.t = -(on + SM.gap);
		} else if (s.t >= 0 && s.lit === null && s.i >= s.seq.length) {
			s.phase = "input";
			s.i = 0;
			s.t = 0;
		}
		return ev;
	}
	if (s.phase === "input") {
		if (press === null) return ev;
		const want = s.seq[s.i];
		if (press !== want) {
			s.phase = "fail";
			s.want = want;
			s.lit = want;
			s.t = 0;
			ev.push({ k: "wrong", pad: want });
			return ev;
		}
		s.lit = press;
		s.litT = SM.press;
		ev.push({ k: "ok", pad: press });
		s.i++;
		if (s.i >= s.seq.length) {
			s.rounds++;
			ev.push({ k: "round" });
			s.seq.push(pick(rnd));
			s.phase = "show";
			s.i = 0;
			s.t = -SM.lead;
		}
		return ev;
	}
	if (s.phase === "fail" && s.t >= SM.fail) {
		s.phase = "done";
		s.over = true;
	}
	return ev;
};
