// 大相撲『保守場所』（銭湯「ゆ」の 脱衣所の テレビ）。作りかけ（draft）：番組表には まだ 出さない。
// 日：奇数月の 8〜22日は 本場所（N日目 ＝ 日 − 7、22日は 千秋楽）、ほかの 日は 名勝負アンコール（再放送）。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyoSumoTv.ts。
import { draftScript, type JkPack } from "./pack";

/** 場面の 鍵（TV が 描く）。 */
export const SUMO_SCENES = ["card"] as const;

/** 大相撲『保守場所』。 */
export const SUMO_PACK: JkPack = {
	script: draftScript(
		"sumo",
		"bath",
		"【中継】大相撲総合スレ　保守場所　Part{n}",
	),
	venue: "bath",
	from: 4,
	menu: "大相撲",
	slot: (t) =>
		t.m % 2 === 1 && t.d >= 8 && t.d <= 22
			? { live: true, day: t.d - 7 }
			: { live: false },
	draft: true,
	scenes: SUMO_SCENES,
	names: ["保守場所"],
};
