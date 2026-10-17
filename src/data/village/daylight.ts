// 村の 時間帯の 色（2026-10-14 作者：天候・朝昼夕夜の しくみの 導入を 検討 → 時間帯から）。
// 時刻は 村の 時計（現実の 時計とは つながない。data/town/calendar.ts の nowHour。開発は &hour=0〜23）。人通り（data/village/crowd.ts）と
// 同じ 時間帯なので、夜は 盛り場へ 向かう 人と 暗い 町が そろう。外の 村だけ（施設の 中は そのまま）。
// 店・施設は 時刻で 閉めない（遊べる 時間が へるだけ）。天気は まだ 入れない。
// 色は canvas の 乗算（multiply）で 重ねる：白は かわらず、色が 暗いほど 暗く なる。文字や 窓は canvas の
// 外（DOM）なので 読みやすさは かわらない。

import type { TimeBand } from "./crowd";
import { RPGEN_CELLS, RPGEN_IMG } from "./rpgenArt";
import { basePx, LAMP_ART } from "./tiles";

// ───────────────── 夜の 明かり ─────────────────
// 夕方から 街灯が 灯り、窓に 明かりが つく（作者「夜の 街灯と 窓の 明かりも 入れて」）。どの マスが 灯るかは
// タイルの 絵で 見分ける：外の 窓は どれも Base.png の 同じ 窓の 切り出し、施設の 外観（GridLook）は RPGEN の
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

/**
 * 村の 時計の 文（「21:05　夜」）。月日・曜日は 出さない（作者：表示は いらない）。
 * hour・minute は 村の 時計（data/town/calendar.ts の nowHour・nowMinute。開発は &hour=）。
 */
export const clockLine = (
	hour: number,
	minute: number,
	band: TimeBand,
): string => `${hour}:${String(minute).padStart(2, "0")}　${BAND_NAME[band]}`;

// ───────────────── 日の 出・日の 入り ─────────────────
// 空の 色と 明かりは 人通りの 時間帯（data/village/crowd.ts の timeBand）では なく、端末の 日付から 出した
// 東京の 日の 出・日の 入りに 合わせる（2026-10-15 作者「20時台で 夕方の オレンジみが 見えるのが 違和感。
// 季節に 合わせて 何時ごろから 暗くなるかを 反映したい」）。夏は 19時ごろまで 明るく、冬は 17時前に 暗くなる。
// 時刻は 村の 時計の まま（日付だけ 端末。開発は &date=MMDD）。色は 下の 節目の あいだを なめらかに まぜる
// （2026-10-15 作者「日照の 変化は 若干 フェージング させる 方が 自然」）。

const RAD = Math.PI / 180;
/** 東京（緯度・経度）。 */
const LAT = 35.68;
const LON = 139.77;

/**
 * その 日（月・日）の 東京の 日の 出・日の 入り（0時からの 分。日本時間）。簡単な 近似で、
 * 数分 ずれるが 季節の うつりかわりには 十分。
 */
export const sunTimes = (
	m: number,
	d: number,
): { rise: number; set: number } => {
	const days = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
	const n = (days[m - 1] ?? 0) + d;
	const decl = 23.44 * RAD * Math.sin((2 * Math.PI * (284 + n)) / 365);
	const B = (2 * Math.PI * (n - 81)) / 364;
	const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
	const noon = 12 * 60 - (LON - 135) * 4 - eot;
	const cosH =
		(Math.sin(-0.833 * RAD) - Math.sin(LAT * RAD) * Math.sin(decl)) /
		(Math.cos(LAT * RAD) * Math.cos(decl));
	const half = (Math.acos(Math.max(-1, Math.min(1, cosH))) / RAD) * 4;
	return { rise: noon - half, set: noon + half };
};

type Sky = { tint: string | null; lamp: number; windows: number };
const sky = (band: TimeBand, windows = BAND_LIGHT[band].windows): Sky => ({
	tint: BAND_TINT[band],
	lamp: BAND_LIGHT[band].lamp,
	windows,
});

/**
 * 1日の 節目（0時からの 分と その ときの 空）。日の 出の 前に 白みはじめ、日の 入りの 前から 橙、
 * 日の 入りの 40分 あとには 夜（薄明が おわる ころ）。0時から 1時に かけて 深夜へ。
 */
const keyframes = (rise: number, set: number): [number, Sky][] => [
	[0, sky("night")],
	[60, sky("late")],
	[rise - 60, sky("late")],
	[rise - 15, sky("night", BAND_LIGHT.late.windows)],
	[rise + 30, sky("morning")],
	[Math.max(rise + 150, 9 * 60), sky("day")],
	[set - 90, sky("day")],
	[set - 20, sky("evening")],
	[set + 40, sky("night")],
	[1440, sky("night")],
];

export const rgbOf = (c: string | null): [number, number, number] => {
	const m = c?.match(/\d+/g);
	return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [255, 255, 255];
};

/**
 * その 時刻（0時からの 分。小数も よい）と 日付（月・日）の 重ねる 色と 明かりの 強さ。
 * tint が null なら 重ねない（昼）。
 */
export const daylightAt = (minute: number, m: number, d: number): Sky => {
	const t = ((minute % 1440) + 1440) % 1440;
	const { rise, set } = sunTimes(m, d);
	const keys = keyframes(rise, set);
	let i = 0;
	while (i < keys.length - 2 && t >= keys[i + 1][0]) i++;
	const [t0, a] = keys[i];
	const [t1, b] = keys[i + 1];
	const k = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 1;
	const mix = (x: number, y: number) => x + (y - x) * k;
	const [r0, g0, b0] = rgbOf(a.tint);
	const [r1, g1, b1] = rgbOf(b.tint);
	const rgb = [mix(r0, r1), mix(g0, g1), mix(b0, b1)].map(Math.round);
	return {
		tint: rgb.every((v) => v >= 255) ? null : `rgb(${rgb.join(", ")})`,
		lamp: mix(a.lamp, b.lamp),
		windows: mix(a.windows, b.windows),
	};
};

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
