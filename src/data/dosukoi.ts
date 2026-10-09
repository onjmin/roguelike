// どすこいポイント（おーぷんの 定期スレ「このスレを開いたら＋170どすこいポイント」2019年〜、「★現在のどすこいポイントは1723です」、
// 2026/8/5「どすこいポイント廃止へ」、「詫びどすこいポイント配布スレです。」）。建物に その 帰りに はじめて 入ると 札で ふえる。
// 町役場の 1番窓口・市役所の 住民課で 照会できる。何にも 使えない（強さ・道具・売上・町の 段には 効かない）。
// 8/5 は 廃止の 札（ふえない）、8/6 は 年に 1回 詫びの ＋500（日は この ゲームの きめ）。保存は kiriko-roguelike/dosukoi だけ。

import type { Today } from "./calendar";

export const DOSUKOI = {
	/** 建物に その 帰りに はじめて 入った（地名の 札の あとの 札。{n} は DOSUKOI_GAINS の 順）。 */
	gain: "＋{n}どすこいポイント",
	/** 8/6（年に 1回。この ゲームの 日。題は 本当に あった「詫びどすこいポイント配布スレです。」）。 */
	wabi: "＋500　詫びどすこいポイント",
	/** 8/5（2026/8/5「どすこいポイント廃止へ」）。ふえない・へらない。 */
	gone: "どすこいポイント　廃止へ",
	options: ["どすこいポイント照会", "やめる"],
	/** {where} は 窓口（町役場）・住民課（市役所）。{n} は 999999 まで（「★現在のどすこいポイントは1723です」）。 */
	balance: "{where}の　画面。\n『★現在の　どすこいポイントは　{n}です』",
	/** 「これずっと貰ってるけど何に使えるんだよ」への こたえ。 */
	shrug: "……何に　使えるかは、\nだれも　知りません",
	wabiNote: "詫びの　500、\n入って　ますね",
	/** 8/5 の 画面（1785863697 の >>1「お持ちのどすこいポイントは本日をもちまして失効となります…」）。 */
	lapse: [
		"{where}の　画面。\n『お持ちの　どすこいポイントは』",
		"『本日を　もちまして　失効と　なります。\n長らくの　ご愛顧、ありがとうございました』",
	],
	back: "……あしたには、\nもどってると　思います",
} as const;

/** 「このスレを開いたら＋Nどすこいポイント」の N（2019年の ＋170 から。＋3106・＋8000 は 入れない）。 */
export const DOSUKOI_GAINS = [
	170, 500, 600, 200, 100, 60, 450, 300, 120, 350, 250, 30, 540, 240,
] as const;

export type DosukoiRec = {
	v: 1;
	pts: number;
	at: number;
	wabi: number;
	n: number;
};
export const DOSUKOI_WABI = 500;
export const DOSUKOI_SHOW_MAX = 999999; // 画面は 6けたまで（22字に 収める）
export const DOSUKOI_TOAST_MS = 2600; // 地名の 札（.toast の 2.6秒）が 消えてから
export const isLapseDay = (t: Today): boolean => t.m === 8 && t.d === 5;
export const isWabiDay = (t: Today): boolean => t.m === 8 && t.d === 6;
export const emptyDosukoi = (): DosukoiRec => ({
	v: 1,
	pts: 0,
	at: -1,
	wabi: 0,
	n: 0,
});
/** 建物に 入った とき（at は いまの 帰り）。同じ 帰りなら 何も しない。8/5 は 札だけ、8/6 は 年に 1回 ＋500。 */
export const dosukoiStep = (
	r: DosukoiRec,
	t: Today,
	year: number,
	at: number,
): { rec: DosukoiRec; toast: string | null } => {
	if (r.at === at) return { rec: r, toast: null };
	if (isLapseDay(t)) return { rec: { ...r, at }, toast: DOSUKOI.gone };
	if (isWabiDay(t) && r.wabi !== year)
		return {
			rec: { ...r, at, wabi: year, pts: r.pts + DOSUKOI_WABI },
			toast: DOSUKOI.wabi,
		};
	const g = DOSUKOI_GAINS[r.n % DOSUKOI_GAINS.length] ?? DOSUKOI_GAINS[0];
	return {
		rec: { ...r, at, n: r.n + 1, pts: r.pts + g },
		toast: DOSUKOI.gain.replace("{n}", String(g)),
	};
};

const KEY = "kiriko-roguelike/dosukoi";
let memo: DosukoiRec | null = null;
const int = (x: unknown, d: number): number =>
	typeof x === "number" && Number.isInteger(x) && x >= -1 ? x : d;
/** 読む（壊れた JSON・足りない 欄は 初期値）。 */
export const loadDosukoi = (): DosukoiRec => {
	if (memo) return { ...memo };
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
		if (raw && typeof raw === "object" && raw.v === 1)
			memo = {
				v: 1,
				pts: Math.max(0, int(raw.pts, 0)),
				at: int(raw.at, -1),
				wabi: Math.max(0, int(raw.wabi, 0)),
				n: Math.max(0, int(raw.n, 0)),
			};
	} catch {
		// 読めなければ 初期値
	}
	memo ??= emptyDosukoi();
	return { ...memo };
};
/** 書く（?stage= の 下見では 覚える だけ）。 */
export const saveDosukoi = (r: DosukoiRec, noSave: boolean): void => {
	memo = { ...r };
	if (noSave) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(r));
	} catch {
		// 保存できなくても この回は memo で 覚えている
	}
};
/** 試験用：覚えている 写しを 捨てる。 */
export const forgetDosukoiMemo = (): void => {
	memo = null;
};
