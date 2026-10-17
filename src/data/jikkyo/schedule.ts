// 実況の 番組表（どの 場所で、どの 日に、どの 番組を 流すか。PROGRAMS §6・ENGINE §5.5）。
// 純粋な 関数。日付は 呼ぶ 側が わたす（村は calendar.today()、開発は &wday=・&date=、試験は そのまま）。
// - 配信会館の 実況モニター（段6〜）：ナイター実況（野球）。
// - 映画館「スクリーン1000」（段7）：金曜は 金曜ロード保守の 本放送（★4）、ほかの 日は 再上映（★2）。
// - おんJ劇場（段7）：12/31 は 紅白スレ合戦の 本番（★5、回 = 年 − 2011）、12/1〜30 は 公開リハ（★3）、
//   1/1〜7 は 去年の 回の 録画（★2。y − 1）。ほかの 月は 番組なし（舞台は ふだんの「やきう　物語」）。
//   年は 呼ぶ 側が わたす（村は 端末の 年。calendar.ts は かえない）。開発は &date=1231・&date=1215・&date=0103。
// 曜日と 季節の リズム：金曜は 映画館、土日は 音楽室（ui/village/rooms.ts）、12月は 劇場、配信会館は 野球。
// あとから 足した 番組（銭湯の 大相撲・カジノの 競馬 ほか）は 束（data/jikkyo/packs.ts）が 日を 決める（programSlots）。

import type { JkSlot } from "../../core/jikkyo";
import type { Today } from "../town/calendar";
import type { JkPack } from "./pack";
import { PACKS, packOf } from "./packs";
import { isRoadshowNight, kohakuMode } from "./text";

export type VenueId = "hall" | "cinema" | "theater";
export type ProgramId = "yakyu" | "sora" | "kohaku";

const VENUES: readonly string[] = [
	"hall",
	"cinema",
	"theater",
] satisfies VenueId[];
/** 番組の ある 場所の id か（施設の id から）。 */
export const isVenue = (id: string): id is VenueId => VENUES.includes(id);

/** 配信会館の 実況モニターが ある 段（配信会館の 段2）。 */
export const HALL_JIKKYO_FROM = 6;
/** 映画館が 建つ 段。 */
export const CINEMA_FROM = 7;
/** おんJ劇場が 建つ 段。 */
export const THEATER_FROM = 7;

/** その 場所・日の 番組（main。alt は チャンネルを かえた 先）。無ければ null。 */
export const programSlot = (
	venue: VenueId,
	t: Today,
	stage: number,
	y: number,
): { main: JkSlot; alt?: JkSlot } | null => {
	switch (venue) {
		case "hall":
			return stage < HALL_JIKKYO_FROM
				? null
				: { main: { program: "yakyu", live: true, y } };
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

/**
 * 実況の 番組は 本筋の 山場（最終話の あと。電池板の 同時配信大会が すんでから）から（2026-10-14 作者：本筋を 太く。
 * 寄り道の 施設は そのまま、番組だけ 後へ）。それまで テレビ・モニターは はり紙だけ。段の 条件は この 上に かさなる。
 */
export const JIKKYO_STORY_GATE = "deep";
export const jikkyoOpen = (cleared: readonly string[]): boolean =>
	cleared.includes(JIKKYO_STORY_GATE);
/** 山場の 前の テレビ・モニター（番組が ある はずの 日だけ 出す）。 */
export const JIKKYO_PAUSED = "番組表に、はり紙。\n「同時配信大会のあいだ休止」";

/** 束の 番組（data/jikkyo/packs.ts）が その 段で 見られるか（作りかけは 出さない）。 */
export const packOpen = (p: JkPack, stage: number): boolean =>
	!p.draft && stage >= p.from && (p.until === undefined || stage < p.until);

/**
 * その 場所・日に 見られる 番組（前からの 番組 → 束の 番組の 順。会場で 調べた ときに 2つ 以上 なら 選ぶ）。
 * 配信会館の 実況モニターは ui/village/hallEvents.ts の 入口（programSlot の main と alt）なので ここには 入れない。
 */
export const programSlots = (
	venue: string,
	t: Today,
	stage: number,
	y: number,
): JkSlot[] => {
	const out: JkSlot[] = [];
	if (isVenue(venue) && venue !== "hall") {
		const main = programSlot(venue, t, stage, y)?.main;
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
