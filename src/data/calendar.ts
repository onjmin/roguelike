// 遊んでいる端末の日付・曜日（0=日〜6=土）。rpg の data/weekday.ts から。
// 村の おんJマイナーズ（data/mobs.ts）の ひとことだけが 見る（ダンジョンの中の 遊びには 一切 かかわらない）。
// 開発中（pnpm dev か ?debug）は URL の &date=MMDD・&wday=0〜6 で 決め打ちできる。

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
