// 村の 時間帯の 色（2026-10-14 作者：天候・朝昼夕夜の しくみの 導入を 検討 → 時間帯から）。
// 時刻は 端末の 時計（data/town/calendar.ts の nowHour。開発は &hour=0〜23）。人通り（data/village/crowd.ts）と
// 同じ 時間帯なので、夜は 盛り場へ 向かう 人と 暗い 町が そろう。外の 村だけ（施設の 中は そのまま）。
// 店・施設は 時刻で 閉めない（遊べる 時間が へるだけ）。天気は まだ 入れない。
// 色は canvas の 乗算（multiply）で 重ねる：白は かわらず、色が 暗いほど 暗く なる。文字や 窓は canvas の
// 外（DOM）なので 読みやすさは かわらない。

import type { TimeBand } from "./crowd";

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
