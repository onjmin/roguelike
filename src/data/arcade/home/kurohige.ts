// キリコの 家の 遊べる 家具「樽」の イッチ危機一髪（板は ui/arcade/home/kurohige.ts）。
// 樽の 穴は 12。どれか 1つが 当たり（はじめに 乱数で 決まる）。キリコから 名無しと 交互に 剣を 刺し、
// 当たりに 刺した ほうが イッチを 飛ばして 負け。名無しは 空いた 穴から 適当に 選ぶ（運の 勝負）。
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
};

/** 名無しの ひとこと。 */
export const KH_SAY = {
	safe: "セーフ",
	cpuSafe: "せやろか",
	meLose: "草",
	cpuLose: "ファッ！？",
	fly: "イッチー！",
} as const;

export const khStart = (rnd: Rnd): KhState => ({
	trigger: Math.floor(rnd() * KH.slots),
	stabbed: Array.from({ length: KH.slots }, () => 0 as const),
	turn: 1,
	safe: 0,
	loser: 0,
});

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

/** 名無しの 穴（空いた 穴から 乱数で）。 */
export const khCpu = (s: KhState, rnd: Rnd): number => {
	const free = s.stabbed.flatMap((v, i) => (v ? [] : [i]));
	return free[Math.floor(rnd() * free.length)] ?? -1;
};

export const khScore = (s: KhState): number =>
	s.loser === 2 ? 500 + 100 * s.safe : 100 * s.safe;
