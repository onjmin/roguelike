// 遊んでいる端末の日付・曜日（0=日〜6=土）と 村の 時計（ゲームの 中の 時刻）。rpg の data/weekday.ts から。
// 村の おんJマイナーズ（data/people/mobs.ts）の ひとことと 街の 人通り（data/village/crowd.ts）だけが 見る
// （ダンジョンの中の 遊びには 一切 かかわらない）。おーぷんの 日替わり（data/town/openModes.ts）・
// おんJ芋煮会（data/town/imoni.ts）・どすこいポイント（data/minigames/dosukoi.ts）も 見る。
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

// ───────────────── 村の 時計（ゲームの 中の 時刻） ─────────────────
// 時刻は 端末の 時計と つなげない（2026-10-14 作者）。日付・曜日（番組・週末）は 端末の まま。
// 村に いる あいだ 現実の 1秒で 1分 すすみ（1日 ＝ 24分）、ダンジョンから 帰るたびに RETURN_HOURS 時間 すすむ。
// 端末に 1つ（セーブを 消すと 朝に もどる）。

const CLOCK_KEY = "kiriko-roguelike/clock";
const DAY_MIN = 24 * 60;
/** はじめて 村に 来た ときの 時刻（朝 8時）。 */
const START_MIN = 8 * 60;
/** ダンジョンから 帰ったときに すすむ 時間。 */
export const RETURN_HOURS = 5;

let clockMin: number | null = null;
const loadClock = (): number => {
	if (clockMin !== null) return clockMin;
	let v = START_MIN;
	try {
		const raw = Number(localStorage.getItem(CLOCK_KEY));
		if (localStorage.getItem(CLOCK_KEY) !== null && Number.isFinite(raw))
			v = ((Math.floor(raw) % DAY_MIN) + DAY_MIN) % DAY_MIN;
	} catch {
		// localStorage が 使えない（試験など）
	}
	clockMin = v;
	return v;
};

/** 村の 時計を すすめる（分）。 */
export const advanceClock = (minutes: number): void => {
	const v = (loadClock() + Math.floor(minutes)) % DAY_MIN;
	clockMin = v;
	try {
		localStorage.setItem(CLOCK_KEY, String(v));
	} catch {
		// 書けなくても 時計は すすむ（このタブの あいだ だけ）
	}
};

/** 村の 時計の 分（0〜59）。 */
export const nowMinute = (): number => loadClock() % 60;

/**
 * 村の 時計の 時（0〜23 時）。人通り・時間帯の 色・時間帯の 台詞が 見る。
 * 開発中（pnpm dev か ?debug）は URL の &hour=0〜23 で 決め打ちできる。
 */
export const nowHour = (): number => {
	// 試験（pnpm test）は 昼に 決め打ち（時間帯の 台詞・色が 試験を 走らせた 時刻で かわらない ように。
	// &hour= の ある 試験は そちらが 先）
	const test = (globalThis as { __testHour?: number }).__testHour;
	const h = typeof test === "number" ? test : Math.floor(loadClock() / 60);
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
 * おーぷんの 日替わり（村の 窓の 文を その日だけ かえる。data/town/openModes.ts・ui/village/village.ts の say）。
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
