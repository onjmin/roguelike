// キリコの 家の 遊べる 家具「掛け軸」の 居合い 一閃（板は ui/arcade/home/mikiri.ts）。
// 夕暮れの 野で 名無しと 向かいあう。しばらく 待つと 大きな「！」が 出る。名無しより 先に 押せば 勝ち。
// 「！」の 前に 押すと お手つき（1回だけ 見のがして もらえる。2回目は 負け）。後の 回は「！」で ない 字が ちらつく。
// 5人 ぬき（さいごは イッチ）。1回 負けたら おわり。スコア：勝った 数×100＋早さの ボーナス（400ms から 引いた 残り）。
// 時刻は 板の 時計（秒）を そのまま もらう（押した 時刻で はかるので こまの 長さに よらない）。DOM に 触らない（試験できる）。

import type { Rnd } from "../logic";

export const MK = {
	/** 名無しが 抜く までの 秒（回ごと。これより 遅いと 負け）。 */
	windows: [0.6, 0.5, 0.42, 0.36, 0.3],
	/** 「！」までの 待ち（秒）。 */
	waitMin: 1.5,
	waitMax: 4,
	/** 名乗りの 間（秒）。 */
	intro: 1.4,
	/** 斬りあった あとの 間（秒）。 */
	result: 1.8,
	/** お手つきの 間（秒）。 */
	foul: 1.4,
	/** ちらつく 字の 出て いる 秒。 */
	fakeLen: 0.22,
	/** 見のがして もらえる お手つきの 数。 */
	warnings: 1,
	/** 早さの ボーナスの もと（ms）。 */
	bonusMs: 400,
} as const;

/** 相手（さいごは イッチ）。 */
export const MK_FOES = [
	"名無し",
	"古参の　名無し",
	"コテハン",
	"まとめ民",
	"イッチ",
];

/** ちらつく 字（「！」に 見まちがえる）。 */
const FAKES = ["？", "草", "…", "ｗ"];

export const MIKIRI_TEXT = {
	note: "「！」が　出たら　A か　タップ",
	vs: "{name}が　あらわれた",
	foul: "お手つき！",
	foulWarn: "お手つき！　次は　負け",
	foulLose: "お手つき　二度目で　負け",
	win: "{ms}ms　一閃！",
	slow: "{ms}ms　{name}が　早い",
	timeout: "うごけなかった",
	clear: "五人ぬき",
} as const;

export type MkPhase = "intro" | "wait" | "go" | "result" | "foul" | "done";
export type MkState = {
	round: number;
	phase: MkPhase;
	/** 今の 場面に なった 時刻。 */
	since: number;
	/** 「！」の 出る 時刻。 */
	goAt: number;
	/** ちらつく 字の 時刻と 字。 */
	fakes: { at: number; s: string; shown: boolean }[];
	/** 勝った 回の 早さ（ms）。 */
	times: number[];
	/** 今の 回の 早さ（ms。負けたら 名無しの ms も）。 */
	lastMs: number;
	warnLeft: number;
	won: boolean;
	lost: boolean;
	/** 負けの わけ。 */
	why: "" | "slow" | "foul" | "timeout";
	over: boolean;
};

export type MkEvent =
	| "intro"
	| "go"
	| "fake"
	| "win"
	| "lose"
	| "foul"
	| "clear";

export const mkWindow = (round: number): number =>
	MK.windows[Math.min(round, MK.windows.length - 1)] ?? 0.3;

/** 待ちを 決めて 構える（後の 回は ちらつく 字を 入れる）。 */
const arm = (s: MkState, now: number, rnd: Rnd): void => {
	s.phase = "wait";
	s.since = now;
	s.goAt = now + MK.waitMin + rnd() * (MK.waitMax - MK.waitMin);
	const n = s.round >= 4 ? 2 : s.round >= 2 ? 1 : 0;
	s.fakes = [];
	for (let i = 0; i < n; i++) {
		const span = s.goAt - 0.45 - (now + 0.5);
		if (span <= 0) break;
		s.fakes.push({
			at: now + 0.5 + rnd() * span,
			s: FAKES[Math.floor(rnd() * FAKES.length) % FAKES.length] ?? "？",
			shown: false,
		});
	}
};

export const mkStart = (): MkState => ({
	round: 0,
	phase: "intro",
	since: 0,
	goAt: Number.POSITIVE_INFINITY,
	fakes: [],
	times: [],
	lastMs: 0,
	warnLeft: MK.warnings,
	won: false,
	lost: false,
	why: "",
	over: false,
});

export const mkScore = (s: MkState): number =>
	s.times.length * 100 +
	s.times.reduce((a, ms) => a + Math.max(0, MK.bonusMs - ms), 0);

/** 今 ちらついて いる 字（なければ ""）。 */
export const mkFake = (s: MkState, now: number): string => {
	if (s.phase !== "wait") return "";
	for (const f of s.fakes)
		if (now >= f.at && now < f.at + MK.fakeLen) return f.s;
	return "";
};

/** 1こま 進める。now＝板の 時計、presses＝この こまに 押した 時刻（同じ 時計）。 */
export const mkStep = (
	s: MkState,
	now: number,
	presses: readonly number[],
	rnd: Rnd,
): MkEvent[] => {
	const ev: MkEvent[] = [];
	if (s.over) return ev;
	if (s.phase === "intro") {
		if (now - s.since >= MK.intro) arm(s, now, rnd);
		return ev;
	}
	if (s.phase === "result" || s.phase === "foul") {
		const wait = s.phase === "result" ? MK.result : MK.foul;
		if (now - s.since < wait) return ev;
		const last = s.round >= MK.windows.length - 1;
		if (s.lost || (s.phase === "result" && last)) {
			if (!s.lost) ev.push("clear");
			s.phase = "done";
			s.over = true;
			return ev;
		}
		if (s.phase === "result") s.round++;
		s.won = false;
		s.phase = "intro";
		s.since = now;
		ev.push("intro");
		return ev;
	}
	// 構えて いる（wait・go）
	const win = mkWindow(s.round);
	for (const p of presses) {
		if (p < s.since) continue;
		if (p < s.goAt) {
			// お手つき
			s.since = now;
			ev.push("foul");
			if (s.warnLeft > 0) {
				s.warnLeft--;
				s.phase = "foul";
			} else {
				s.phase = "result";
				s.lost = true;
				s.why = "foul";
			}
			return ev;
		}
		const ms = Math.round((p - s.goAt) * 1000);
		s.lastMs = ms;
		s.phase = "result";
		s.since = now;
		if (ms <= win * 1000) {
			s.won = true;
			s.times.push(ms);
			ev.push("win");
		} else {
			s.lost = true;
			s.why = "slow";
			ev.push("lose");
		}
		return ev;
	}
	if (now >= s.goAt + win) {
		s.lastMs = Math.round(win * 1000);
		s.phase = "result";
		s.since = now;
		s.lost = true;
		s.why = "timeout";
		ev.push("lose");
		return ev;
	}
	if (s.phase === "wait" && now >= s.goAt) {
		s.phase = "go";
		// 「！」が 出るのは この コマから。反応の 時間と 窓は ここから 数える
		// （決めた 時刻から 数えると、出る 前の 1コマぶん 遅く 測られて 最後の 0.3秒の 窓で 損をした）
		s.goAt = now;
		ev.push("go");
	} else if (s.phase === "wait") {
		for (const f of s.fakes)
			if (now >= f.at && !f.shown) {
				f.shown = true;
				ev.push("fake");
			}
	}
	return ev;
};
