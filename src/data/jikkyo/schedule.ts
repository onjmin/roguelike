// 実況の 番組表（どの 場所で、どの 日に、どの 番組を 流すか。PROGRAMS §6・ENGINE §5.5）。
// 純粋な 関数。日付は 呼ぶ 側が わたす（村は calendar.today()、開発は &wday=・&date=、試験は そのまま）。
// - 本館の 実況モニター（段6〜）：ナイター実況（野球）。月曜の 議会中継は 市民の 手順で 足す。
// - 映画館「スクリーン1000」（段7）：金曜は 金曜ロード保守の 本放送（★4）、ほかの 日は 再上映（★2）。
// - 保守劇場（12月の 紅白）は 紅白の 手順で 足す。
// 曜日の リズム：金曜は 映画館、土日は 音楽室（ui/rooms.ts）、本館は 野球。

import type { JkSlot } from "../../core/jikkyo";
import type { Today } from "../calendar";
import { isRoadshowNight } from "./text";

export type VenueId = "hall" | "cinema";
export type ProgramId = "yakyu" | "sora";

const VENUES: readonly string[] = ["hall", "cinema"] satisfies VenueId[];
/** 番組の ある 場所の id か（施設の id から）。 */
export const isVenue = (id: string): id is VenueId => VENUES.includes(id);

/** 本館の 実況モニターが ある 段（本館の 段2）。 */
export const HALL_JIKKYO_FROM = 6;
/** 映画館が 建つ 段。 */
export const CINEMA_FROM = 7;

/** その 場所・日の 番組（main。alt は チャンネルを かえた 先）。無ければ null。 */
export const programSlot = (
	venue: VenueId,
	t: Today,
	stage: number,
	y: number,
): { main: JkSlot; alt?: JkSlot } | null => {
	switch (venue) {
		case "hall":
			return stage >= HALL_JIKKYO_FROM
				? { main: { program: "yakyu", live: true, y } }
				: null;
		case "cinema":
			return stage >= CINEMA_FROM
				? { main: { program: "sora", live: isRoadshowNight(t), y } }
				: null;
	}
};
