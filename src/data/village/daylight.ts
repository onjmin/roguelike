// 村の 時間帯の 色（2026-10-14 作者：天候・朝昼夕夜の しくみの 導入を 検討 → 時間帯から）。
// 時刻は 端末の 時計（data/town/calendar.ts の nowHour。開発は &hour=0〜23）。人通り（data/village/crowd.ts）と
// 同じ 時間帯なので、夜は 盛り場へ 向かう 人と 暗い 町が そろう。外の 村だけ（施設の 中は そのまま）。
// 店・施設は 時刻で 閉めない（遊べる 時間が へるだけ）。天気は まだ 入れない。
// 色は canvas の 乗算（multiply）で 重ねる：白は かわらず、色が 暗いほど 暗く なる。文字や 窓は canvas の
// 外（DOM）なので 読みやすさは かわらない。

import type { TimeBand } from "./crowd";

/** 時間帯の 呼び名（村の 時計）。 */
export const BAND_NAME: Record<TimeBand, string> = {
	late: "深夜",
	morning: "朝",
	day: "昼",
	evening: "夕方",
	night: "夜",
};

const WDAY = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * 村の 時計の 文（「10/14（水）21:05　夜」）。日付・曜日も 出す：番組・議会・人通り（週末）が 曜日で かわる。
 * hour は 開発の &hour= を 通した 時（data/town/calendar.ts の nowHour）、minute は 端末の 分。
 */
export const clockLine = (
	t: { m: number; d: number; w: number },
	hour: number,
	minute: number,
	band: TimeBand,
): string =>
	`${t.m}/${t.d}（${WDAY[t.w] ?? ""}）${hour}:${String(minute).padStart(2, "0")}　${BAND_NAME[band]}`;

/** 時間帯ごとの 重ねる 色（null は 重ねない＝昼）。 */
export const BAND_TINT: Record<TimeBand, string | null> = {
	// 朝：ほんの すこし 白っぽく 青い
	morning: "rgb(236, 242, 255)",
	day: null,
	// 夕方：橙
	evening: "rgb(255, 196, 150)",
	// 夜：紺（暗すぎると 道が 見えないので 半分 まで）
	night: "rgb(120, 132, 196)",
	// 深夜：もっと 暗い 紺
	late: "rgb(92, 104, 168)",
};
