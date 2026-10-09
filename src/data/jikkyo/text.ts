// 実況の 番組の 会場の 文（調べる 物と 人の 文の 上書き）。曜日・日付で かわる 文だけを 持つ。
// 合う 文が なければ null を 返し、呼ぶ 側（ui/facilities.ts）は いつもの 文
// （data/village/facilities.ts の room.lines・people の lines）を 読む。
// いまは 映画館「スクリーン1000」だけ：金曜の 夜は 金曜ロード保守の 実況上映（スマホ OK の 上映）、
// ほかの 日は 再上映と 予告。絵は ui/cinemaDecor.ts。
// 番組名・映画の 題は 架空の パロディで、実在の 番組・局・映画とは 関係が ない。
// どの 文も 村の 窓（全角 22字 × 2行）に 収める（src/sim/jikkyoTests.ts）。

import type { Today } from "../calendar";

/** 金曜ロード保守の 夜（金曜）。映画館は 実況上映。 */
export const isRoadshowNight = (t: Today): boolean => t.w === 5;

/** 日に よって かわる 文（上から 見て、はじめに 合った 文。どれも 合わなければ いつもの 文）。 */
export type DayLines = readonly {
	when: (t: Today) => boolean;
	lines: readonly string[];
}[];

const anyDay = (): boolean => true;

/** 会場の 物の 文（施設の id → 物の id → 日ごとの 文）。 */
export const VENUE_LINES: Readonly<
	Record<string, Readonly<Record<string, DayLines>>>
> = {
	cinema: {
		screen: [
			{
				when: isRoadshowNight,
				lines: ["スクリーン。\n今夜は『空飛ぶ鯖』の　実況上映。"],
			},
			{ when: anyDay, lines: ["スクリーン。\n今日は『空飛ぶ鯖』の　再上映。"] },
		],
		poster: [
			{
				when: isRoadshowNight,
				lines: ["今夜　実況上映『空飛ぶ鯖』\nスマホ　OK、音は　消してな"],
			},
			{
				when: anyDay,
				lines: ["金曜の　夜は　実況上映\n近日『1000レスの　夏』"],
			},
		],
		seat: [
			{
				when: isRoadshowNight,
				lines: ["客席。\nスマホの　光が　ならんでいる。"],
			},
		],
	},
};

/** 会場の 人の 文（施設の id → 人の id → 日ごとの 文）。 */
export const STAFF_LINES: Readonly<
	Record<string, Readonly<Record<string, DayLines>>>
> = {
	cinema: {
		cinema_staff: [
			{
				when: isRoadshowNight,
				lines: ["今夜は　金曜ロード保守の　実況上映や。\n……実況は　実況スレで"],
			},
		],
	},
};

const pick = (d: DayLines | undefined, t: Today): readonly string[] | null =>
	d?.find((r) => r.when(t))?.lines ?? null;

/** 会場の 物の 文の 上書き（無ければ null。いつもの room.lines を 読む）。 */
export const venueLines = (
	fid: string,
	kind: string,
	t: Today,
): readonly string[] | null => pick(VENUE_LINES[fid]?.[kind], t);

/** 会場の 人の 文の 上書き（無ければ null。いつもの lines を 読む）。 */
export const staffLines = (
	fid: string,
	who: string,
	t: Today,
): readonly string[] | null => pick(STAFF_LINES[fid]?.[who], t);
