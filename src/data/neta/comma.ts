// コンマ（スレタイに「コンマ」を 入れると 書きこみの 時刻に ミリ秒が 出る。おんJwiki pages/416）の 決まり。
// - コンマ：書きこんだ 時刻の ミリ秒（3桁）。ゾロ目（000・111…999）を 出すと 名無しが「預言者よ…」、はじめての ゾロ目で
//   主が !cap して 名前欄に ▲第一当選者。ゾロ目は 運（100回に 1回）。
// - 0時ちょうど（「0時00分00秒コンマ000を出すスレ」。夜の 23時・0時台だけ）：23:59:55.000 から 進む 時計で
//   00:00:00.000 ちょうどに 書きこむ。鯖の 重さで 書きこみは 8〜24ms おくれる。2026/10/08 の 夜の いちばんは 00:00:00.040
//   （スレ >>19。000 は 前スレまでに 2回 ある）。
// 淫夢の 数は 出さない：ミリ秒（.114 .364 .514 .810 .931）は 1 足す（commaOf・zeroDeny。板の 回る 時計も
// wallClock・zeroClock を 通す）、時刻 11:45:14 は 11:45:15 に。
// DOM も 保存も 使わない（時刻は 呼ぶ 側が わたす）。

/** 1回の 遊びで 書きこめる 数。 */
export const COMMA_POSTS = 10;
/** 書きこみの 間（連投規制）。 */
export const COMMA_GAP_MS = 600;
/** 0時ちょうど：時計の はじめ（0時の 何ms 前か）と おわり（0時の 何ms 後に 打ち切るか）。 */
export const ZERO_LEAD_MS = 5000;
export const ZERO_TAIL_MS = 3000;
/** 鯖の 重さ（書きこみの おくれ）。 */
export const ZERO_LAG_MIN = 8;
export const ZERO_LAG_SPAN = 16;
/** その 夜の いちばん（00:00:00.040）。 */
export const ZERO_RECORD_MS = 40;

/** 出さない ミリ秒（淫夢の 数）。出たら 1 足す（見ても わからない）。 */
export const COMMA_DENY: ReadonlySet<number> = new Set([
	114, 364, 514, 810, 931,
]);

/** 時刻（ms）の ミリ秒（0〜999）。 */
export const commaOf = (wallMs: number): number => {
	const m = ((Math.floor(wallMs) % 1000) + 1000) % 1000;
	return COMMA_DENY.has(m) ? m + 1 : m;
};

export const isZoro = (ms: number): boolean =>
	ms >= 0 && ms <= 999 && ms % 111 === 0;

/** 3桁の うち 2つ だけ そろった（惜しい）。 */
export const isNearZoro = (ms: number): boolean => {
	if (isZoro(ms)) return false;
	const [a, b, c] = String(ms).padStart(3, "0");
	return a === b || b === c || a === c;
};

const p2 = (n: number) => String(n).padStart(2, "0");
const p3 = (n: number) => String(n).padStart(3, "0");

/** 時・分・秒・ミリ秒 → "HH:MM:SS.mmm"。 */
export const clockText = (
	h: number,
	m: number,
	s: number,
	ms: number,
): string => `${p2(h)}:${p2(m)}:${p2(s)}.${p3(ms)}`;

/** ふつうの 時刻（Date の ms）→ 端末の 時刻の "HH:MM:SS.mmm"（ミリ秒は commaOf、11:45:14 は 11:45:15）。 */
export const wallClock = (wallMs: number): string => {
	const d = new Date(wallMs);
	const [h, m, s] = [d.getHours(), d.getMinutes(), d.getSeconds()];
	return clockText(
		h,
		m,
		h === 11 && m === 45 && s === 14 ? 15 : s,
		commaOf(wallMs),
	);
};

/** 0時ちょうどの ずれ（ms）で、見える ミリ秒が 出さない 数なら 1 足す（コンマと 同じ）。 */
export const zeroDeny = (diff: number): number => {
	let d = diff;
	while (COMMA_DENY.has(((Math.floor(d) % 1000) + 1000) % 1000)) d += 1;
	return d;
};

/** 0時ちょうど：0時からの ずれ（ms。前は 負）→ 時刻の 文字（23:59:59.999 ／ 00:00:00.040）。 */
export const zeroText = (diff: number): string => {
	const t = Math.floor(diff);
	if (t < 0) {
		const before = 86_400_000 + t;
		const h = Math.floor(before / 3_600_000);
		const m = Math.floor((before % 3_600_000) / 60_000);
		const s = Math.floor((before % 60_000) / 1000);
		return clockText(h, m, s, before % 1000);
	}
	return clockText(
		0,
		Math.floor(t / 60_000),
		Math.floor((t % 60_000) / 1000),
		t % 1000,
	);
};

/** 0時ちょうどの 板に 出す 時刻（回る 時計も 書きこみも。見える ミリ秒は zeroDeny を 通す）。 */
export const zeroClock = (diff: number): string => zeroText(zeroDeny(diff));

export type ZeroJudge = "god" | "exact" | "record" | "close" | "late" | "early";

/** 0時ちょうどの 判定（diff は 0時からの ずれ ms）。 */
export const zeroJudge = (diff: number): ZeroJudge => {
	const t = Math.floor(diff);
	if (t < 0) return "early";
	if (t === 0) return "god";
	if (t <= 9) return "exact";
	if (t <= ZERO_RECORD_MS) return "record";
	if (t <= 200) return "close";
	return "late";
};

/** 0時ちょうどの 台が 開く 時刻（23時台・0時台）。 */
export const zeroOpen = (hour: number): boolean => hour === 23 || hour === 0;
