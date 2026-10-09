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
// あとから 足した 番組（銭湯の 大相撲・カジノの 競馬 ほか）は 束（data/jikkyo/packs.ts）が 日を 決める（programSlots）。

import type { JkSlot } from "../../core/jikkyo";
import type { Today } from "../calendar";
import { CITYHALL_FROM, TOWNHALL_FROM } from "../civic";
import type { JkPack } from "./pack";
import { PACKS, packOf } from "./packs";
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

/** 束の 番組（data/jikkyo/packs.ts）が その 段で 見られるか（作りかけは 出さない）。 */
export const packOpen = (p: JkPack, stage: number): boolean =>
	!p.draft && stage >= p.from && (p.until === undefined || stage < p.until);

/**
 * その 場所・日に 見られる 番組（前からの 番組 → 束の 番組の 順。会場で 調べた ときに 2つ 以上 なら 選ぶ）。
 * 本館の 実況モニターは ui/hallEvents.ts の 入口（programSlot の main と alt）なので ここには 入れない。
 */
export const programSlots = (
	venue: string,
	t: Today,
	stage: number,
	y: number,
	opt: { session?: boolean } = {},
): JkSlot[] => {
	const out: JkSlot[] = [];
	if (isVenue(venue) && venue !== "hall") {
		const main = programSlot(venue, t, stage, y, opt)?.main;
		if (main) out.push(main);
	}
	for (const p of PACKS) {
		if (p.venue !== venue || !packOpen(p, stage)) continue;
		const s = p.slot(t);
		if (s) out.push({ program: p.script.id, y, ...s });
	}
	return out;
};

/** 番組が ある 会場の id（前からの 会場と 束の 会場）。 */
export const JK_VENUES: readonly string[] = [
	...VENUES,
	...new Set(PACKS.map((p) => p.venue)),
];

/** 会場で 選ぶ ときの 番組の 名前（全角 10字まで）。 */
export const programMenuName = (id: string): string =>
	LEGACY_MENU[id] ?? packOf(id)?.menu ?? id;

const LEGACY_MENU: Readonly<Record<string, string>> = {
	sora: "金曜ロード保守",
	kohaku: "紅白スレ合戦",
};
