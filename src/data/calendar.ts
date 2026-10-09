// 遊んでいる端末の日付・曜日（0=日〜6=土）。rpg の data/weekday.ts から。
// 村の おんJマイナーズ（data/mobs.ts）の ひとことと 街の 人通り（data/village/crowd.ts）だけが 見る
// （ダンジョンの中の 遊びには 一切 かかわらない）。おーぷんの 日替わり（data/openModes.ts）・
// おんJ芋煮会（data/imoni.ts）・どすこいポイント（data/dosukoi.ts）も 見る。
// 開発中（pnpm dev か ?debug）は URL の &date=MMDD・&wday=0〜6 で 決め打ちできる（&year=YYYY で 年も。nowYear）。

/** 端末の 月（1〜12）・日・曜日（0=日〜6=土）。 */
export type Today = { m: number; d: number; w: number };

export const today = (): Today => {
	const t = new Date();
	const n: Today = { m: t.getMonth() + 1, d: t.getDate(), w: t.getDay() };
	if (typeof location === "undefined") return n;
	const q = new URLSearchParams(location.search);
	if (!import.meta.env.DEV && !q.has("debug")) return n;
	const date = q.get("date");
	if (date !== null && /^\d{4}$/.test(date)) {
		n.m = Number(date.slice(0, 2));
		n.d = Number(date.slice(2));
	}
	const w = q.get("wday");
	if (w !== null && /^[0-6]$/.test(w)) n.w = Number(w);
	return n;
};

/**
 * 端末の 時刻（0〜23 時）。村の 人通りの 流れ（data/village/crowd.ts）だけが 見る。
 * 開発中（pnpm dev か ?debug）は URL の &hour=0〜23 で 決め打ちできる。
 */
export const nowHour = (): number => {
	const h = new Date().getHours();
	if (typeof location === "undefined") return h;
	const q = new URLSearchParams(location.search);
	if (!import.meta.env.DEV && !q.has("debug")) return h;
	const v = q.get("hour");
	return v !== null && /^\d{1,2}$/.test(v) && Number(v) < 24 ? Number(v) : h;
};

/** 期間限定の日。 */
export type Season =
	| "newyear" // 1/1〜1/7
	| "valentine" // 2/14
	| "april" // 4/1
	| "tanabata" // 7/7
	| "halloween" // 10/31
	| "xmas" // 12/24〜12/25
	| "omisoka"; // 12/31

export const SEASONS: readonly Season[] = [
	"newyear",
	"valentine",
	"april",
	"tanabata",
	"halloween",
	"xmas",
	"omisoka",
];

/** その日（月・日）の 期間限定。無ければ null。 */
export const seasonOf = (m: number, d: number): Season | null => {
	if (m === 1 && d <= 7) return "newyear";
	if (m === 2 && d === 14) return "valentine";
	if (m === 4 && d === 1) return "april";
	if (m === 7 && d === 7) return "tanabata";
	if (m === 10 && d === 31) return "halloween";
	if (m === 12 && (d === 24 || d === 25)) return "xmas";
	if (m === 12 && d === 31) return "omisoka";
	return null;
};

/** 今日の 期間限定。 */
export const season = (): Season | null => {
	const t = today();
	return seasonOf(t.m, t.d);
};

/** その 年（端末。開発中は &year=YYYY）。おんJ芋煮会の「今年は もう 来た」に 使う。 */
export const nowYear = (): number => {
	const y = new Date().getFullYear();
	if (typeof location === "undefined") return y;
	const q = new URLSearchParams(location.search);
	if (!import.meta.env.DEV && !q.has("debug")) return y;
	const v = q.get("year");
	return v !== null && /^\d{4}$/.test(v) ? Number(v) : y;
};

/**
 * おーぷんの 日替わり（村の 窓の 文を その日だけ かえる。data/openModes.ts・ui/village.ts の say）。
 * 2/22 猫の日・4/1 強制博多弁・10/31 トリック。期間限定（Season）とは べつ：住人の 季節の ひとことは そのまま 出て、その 上に かかる。
 */
export type OpenMode = "neko" | "hakata" | "trick";
export const openModeOf = (m: number, d: number): OpenMode | null =>
	m === 2 && d === 22
		? "neko"
		: m === 4 && d === 1
			? "hakata"
			: m === 10 && d === 31
				? "trick"
				: null;
export const openMode = (): OpenMode | null => {
	const t = today();
	return openModeOf(t.m, t.d);
};
