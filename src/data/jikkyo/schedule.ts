// 実況の 番組表（どの 場所で、どの 日に、どの 番組を 流すか。PROGRAMS §6・ENGINE §5.5）。
// 純粋な 関数。日付は 呼ぶ 側が わたす（村は calendar.today()、開発は &wday=・&date=、試験は そのまま）。
// - 本館の 実況モニター（段6〜）：ナイター実況（野球）。月曜は 議会中継（見るだけ）が はじめの チャンネルで、
//   ナイターは チャンネルを かえた 先の 録画。
// - 町役場（段4〜6）・市役所（段7）の 中継モニター：議会の 日（data/civic.ts）だけ 議会中継。ほかの 日は 砂あらし。
// - 映画館「スクリーン1000」（段7）：金曜は 金曜ロード保守の 本放送（★4）、ほかの 日は 再上映（★2）。
// - 保守劇場（段7）：12/31 は 紅白スレ合戦の 本番（★5、回 = 年 − 2011）、12/1〜30 は 公開リハ（★3）、
//   1/1〜7 は 去年の 回の 録画（★2。y − 1）。ほかの 月は 番組なし（舞台は ふだんの「やきう　物語」）。
//   年は 呼ぶ 側が わたす（村は 端末の 年。calendar.ts は かえない）。開発は &date=1231・&date=1215・&date=0103。
// 曜日と 季節の リズム：月曜は 議会、金曜は 映画館、土日は 音楽室（ui/rooms.ts）、12月は 劇場、本館は 野球。

import type { JkSlot } from "../../core/jikkyo";
import type { Today } from "../calendar";
import { CITYHALL_FROM, TOWNHALL_FROM } from "../civic";
import { isRoadshowNight, kohakuMode } from "./text";

export type VenueId = "hall" | "cinema" | "theater" | "townhall" | "cityhall";
export type ProgramId = "yakyu" | "sora" | "kohaku" | "gikai";

const VENUES: readonly string[] = [
	"hall",
	"cinema",
	"theater",
	"townhall",
	"cityhall",
] satisfies VenueId[];

/** 本館で 議会中継を 流す 曜日（月曜。定例会の 日で、ナイターが ない）。 */
export const GIKAI_WDAY = 1;
/** 番組の ある 場所の id か（施設の id から）。 */
export const isVenue = (id: string): id is VenueId => VENUES.includes(id);

/** 本館の 実況モニターが ある 段（本館の 段2）。 */
export const HALL_JIKKYO_FROM = 6;
/** 映画館が 建つ 段。 */
export const CINEMA_FROM = 7;
/** 保守劇場が 建つ 段。 */
export const THEATER_FROM = 7;

/**
 * その 場所・日の 番組（main。alt は チャンネルを かえた 先）。無ければ null。
 * opt.session は 議会の 日（data/civic.ts の inSession。月曜は かならず）。
 */
export const programSlot = (
	venue: VenueId,
	t: Today,
	stage: number,
	y: number,
	opt: { session?: boolean } = {},
): { main: JkSlot; alt?: JkSlot } | null => {
	switch (venue) {
		case "hall":
			if (stage < HALL_JIKKYO_FROM) return null;
			// ナイターの ない 月曜は 議会中継が はじめの チャンネル（ナイターは 録画で 遊べる）
			if (t.w === GIKAI_WDAY)
				return {
					main: { program: "gikai", live: true, y },
					alt: { program: "yakyu", live: false, y },
				};
			return { main: { program: "yakyu", live: true, y } };
		case "townhall":
			return stage >= TOWNHALL_FROM && stage < CITYHALL_FROM && opt.session
				? { main: { program: "gikai", live: true, y } }
				: null;
		case "cityhall":
			return stage >= CITYHALL_FROM && opt.session
				? { main: { program: "gikai", live: true, y } }
				: null;
		case "cinema":
			return stage >= CINEMA_FROM
				? { main: { program: "sora", live: isRoadshowNight(t), y } }
				: null;
		case "theater": {
			const mode = stage >= THEATER_FROM ? kohakuMode(t) : null;
			if (mode === "live")
				return { main: { program: "kohaku", live: true, y } };
			if (mode === "reha")
				return { main: { program: "kohaku", live: false, mode, y } };
			if (mode === "rec")
				return { main: { program: "kohaku", live: false, mode, y: y - 1 } };
			return null;
		}
	}
};
