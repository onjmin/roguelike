// キリコの 家の 遊べる 家具「樽」の イッチ危機一髪（板は ui/arcade/home/kurohige.ts）。
// 樽の 穴は 12。どれか 1つが 当たり（はじめに 乱数で 決まる）。キリコから 名無しと 交互に 剣を 刺し、
// 当たりに 刺した ほうが イッチを 飛ばして 負け。
// 手がかり：穴に 剣を 当てると、当たりの 近くでは イッチが ピクッと する（当たり 85%・となり 60%。
// ほかの 穴でも 2割ほど ピクッと する ので 当てには ならない）。ピクッは はじめに 穴ごとに 決まる。
// 名無しも ピクッを 見て、ピクッと する 穴を ややさける。
// スコア：名無しが 飛ばしたら キリコの 勝ち＝500＋100×キリコが 刺した 本数、
// キリコが 飛ばしたら 100×それまでに 刺せた 本数。DOM に 触らない（試験できる）。

import type { Rnd } from "../logic";

export const KH = {
	/** 穴の 数。 */
	slots: 12,
	/** 刺してから 結果が 出るまでの 間（秒）。 */
	suspense: 0.7,
	/** 名無しが 選ぶ 間（秒）。 */
	think: 0.6,
	/** イッチが 飛んでいる 間（秒）。 */
	fly: 1.6,
} as const;

export type KhState = {
	/** 当たりの 穴。 */
	trigger: number;
	/** 刺した ほう（0 まだ・1 キリコ・2 名無し）。 */
	stabbed: (0 | 1 | 2)[];
	turn: 1 | 2;
	/** キリコが 無事に 刺せた 本数。 */
	safe: number;
	/** 飛ばした ほう（0 まだ）。 */
	loser: 0 | 1 | 2;
	/** 剣を 当てると イッチが ピクッと する 穴。 */
	twitch: boolean[];
};

/** 名無しの ひとこと。 */
export const KH_SAY = {
	safe: "セーフ",
	cpuSafe: "せやろか",
	meLose: "草",
	cpuLose: "ファッ！？",
	fly: "イッチー！",
	/** 剣を 当てた 穴で イッチが ピクッと した。 */
	twitch: "ピクッ",
} as const;

/** ピクッと する 見こみ（当たり・となり・ほか）。 */
const TWITCH = [0.85, 0.6, 0.2] as const;

export const khStart = (rnd: Rnd): KhState => {
	const trigger = Math.floor(rnd() * KH.slots);
	return {
		trigger,
		stabbed: Array.from({ length: KH.slots }, () => 0 as const),
		turn: 1,
		safe: 0,
		loser: 0,
		twitch: Array.from(
			{ length: KH.slots },
			(_, i) => rnd() < TWITCH[Math.min(2, Math.abs(i - trigger))],
		),
	};
};

/** 刺す（"bad" は 刺せない 穴）。当たりなら 刺した ほうの 負け。 */
export const khStab = (s: KhState, i: number): "safe" | "pop" | "bad" => {
	if (s.loser || i < 0 || i >= KH.slots || s.stabbed[i]) return "bad";
	const who = s.turn;
	s.stabbed[i] = who;
	if (i === s.trigger) {
		s.loser = who;
		return "pop";
	}
	if (who === 1) s.safe++;
	s.turn = who === 1 ? 2 : 1;
	return "safe";
};

/** 名無しの 穴（空いた 穴から 乱数で。ピクッと する 穴は 5分の1 ほどしか 選ばない）。 */
export const khCpu = (s: KhState, rnd: Rnd): number => {
	const free = s.stabbed.flatMap((v, i) => (v ? [] : [i]));
	const w = free.map((i) => (s.twitch[i] ? 0.2 : 1));
	let r = rnd() * w.reduce((a, b) => a + b, 0);
	for (let k = 0; k < free.length; k++) {
		r -= w[k];
		if (r < 0) return free[k];
	}
	return free[free.length - 1] ?? -1;
};

export const khScore = (s: KhState): number =>
	s.loser === 2 ? 500 + 100 * s.safe : 100 * s.safe;
