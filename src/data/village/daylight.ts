// 村の 時間帯の 色（2026-10-14 作者：天候・朝昼夕夜の しくみの 導入を 検討 → 時間帯から）。
// 時刻は 端末の 時計（data/town/calendar.ts の nowHour。開発は &hour=0〜23）。人通り（data/village/crowd.ts）と
// 同じ 時間帯なので、夜は 盛り場へ 向かう 人と 暗い 町が そろう。外の 村だけ（施設の 中は そのまま）。
// 店・施設は 時刻で 閉めない（遊べる 時間が へるだけ）。天気は まだ 入れない。
// 色は canvas の 乗算（multiply）で 重ねる：白は かわらず、色が 暗いほど 暗く なる。文字や 窓は canvas の
// 外（DOM）なので 読みやすさは かわらない。

import type { TimeBand } from "./crowd";
import { RPGEN_CELLS, RPGEN_IMG } from "./rpgenArt";
import { basePx, LAMP_ART } from "./tiles";

// ───────────────── 夜の 明かり ─────────────────
// 夕方から 街灯が 灯り、窓に 明かりが つく（作者「夜の 街灯と 窓の 明かりも 入れて」）。どの マスが 灯るかは
// タイルの 絵で 見分ける：外の 窓は どれも Base.png の 同じ 窓の 切り出し、新市街の 外観（GridLook）は RPGEN の
// 窓の 部品、街灯は 街灯の 絵（歩道の ゃ・レンガの ギ・草地の ゲ）。タイルに 印を 足さなくても 新しい 建物に 効く。

/** 外の 窓の 絵（ふつうの 家・店・本館・施設の 外観の 上段）。 */
const WINDOW_REFS = new Set([basePx(48, 1382)]);

/** RPGEN の 窓の 部品（外観の 窓。名前に win / Window）。マスの 範囲（列・行・幅・高さ）。 */
const RPGEN_WINDOWS = Object.entries(RPGEN_CELLS)
	.filter(([k]) => /win(?!e)|window/i.test(k))
	.map(([, v]) => v as readonly number[]);

/** RPGEN の 絵の 参照が 窓の 部品の マスか。 */
const rpgenWindow = (ref: string): boolean => {
	if (!ref.startsWith(`${RPGEN_IMG}#`)) return false;
	const [px, py] = ref
		.slice(RPGEN_IMG.length + 1)
		.split(",")
		.map(Number);
	const c = px / 16;
	const r = py / 16;
	return RPGEN_WINDOWS.some(
		([x, y, w, h]) => c >= x && c < x + w && r >= y && r < y + h,
	);
};

/** タイルの 絵から 灯る 物（街灯・窓。どちらでも なければ null）。 */
export const lightOf = (layers: readonly string[]): "lamp" | "window" | null =>
	layers.includes(LAMP_ART)
		? "lamp"
		: layers.some((l) => WINDOW_REFS.has(l) || rpgenWindow(l))
			? "window"
			: null;

/**
 * 明かりの 強さ（0 は 灯らない）と、窓の うち 灯る 割合（家の 人が 起きている。深夜は 寝ている 家が 多い）。
 */
export const BAND_LIGHT: Record<TimeBand, { lamp: number; windows: number }> = {
	morning: { lamp: 0, windows: 0 },
	day: { lamp: 0, windows: 0 },
	evening: { lamp: 0.6, windows: 0.5 },
	night: { lamp: 1, windows: 0.8 },
	late: { lamp: 1, windows: 0.25 },
};

/** その 窓が 灯って いるか（マスごとに 決まった 順。乱数は 使わない：同じ 時刻なら 同じ 窓）。 */
export const windowLit = (x: number, y: number, share: number): boolean =>
	((x * 73 + y * 151) % 100) / 100 < share;

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
