// おーぷんの 日替わり（data/calendar.ts の openMode）を 村の 窓の 文に かける。呼ぶのは ui/village.ts の say だけ。
// 元ネタ：
// - 2/22 猫の日モード（おんJwiki pages/632）：「な」→「にゃ」・語尾「にゃ」。かっこの 外に つく
//   （「これにゃおせにゃいのかにゃ」「粋にゃ計らい、ワイは好きっすよ(好感度上げとく)にゃ」）。
// - 4/1 強制博多弁（pages/258 の 表：さ→しゃ・だ→ばい・よ→クサ・こんな→こぎゃん・本当に→ほんまに・おはよう→おはようしゃん・
//   うるさい→しぇからしか・お前→貴様・管理人→明太子・さとる→さっとる）。を→ば は 同じ ページの 2014年の 見本
//   （「報告書（英文）ば発表し」）、そんな→そげん・ない→なか・いい→よか は 2023/3/22 の 強制博多弁スレ（pages/595
//   「【回覧】おんJ芋煮会、WBC見たいから中止」の「そげんことなら」「しょうがなか」「よかぢゃん」）。
//   関西の だ（や・やで）→ばい、ええ→よか、しい→しか は この ゲームの 足し（村の 人は 関西弁が 多い）。
// - 10/31（2025/10/31 の おんJ：どの レスも 本文の 終わりに 🎃👻🍬🍭🍪🍩🍫💀 から 3つ）：窓の さいごの 行の 終わりに 1つ
//   （💀 は 入れない。名前欄は かえない）。
// 窓は 1行 全角22字・2行まで（villageTests の fitsWindow）。かけて 22字を こえる 行は もとの まま、行の 数は かえない。
// 絵文字を 足す 行は 21字まで（ぷゆゆの 決まり。もとから ある 絵文字 1つごとに さらに 1字 ゆとり）。
// 地の文・キリコ・入った ときの 場面（スレタイと >>1。2017年の 博多弁は そこを かえなかった）・住人の はじめましてと 節目
// （rawModes）には かけない。

import type { OpenMode } from "./calendar";

/** 全角=1・半角=0.5 で 数えた 幅（村の 窓。villageTests の width と 同じ）。 */
export const windowWidth = (line: string): number =>
	[...line].reduce((w, ch) => w + (/[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);
export const WINDOW_WIDTH = 22;
/** 絵文字の ある 行の 幅（villageTests の ぷゆゆの 決まり）。 */
export const EMOJI_LINE_WIDTH = 21;

// ───────────── 2/22 猫の日 ─────────────

/** 文の 終わりの 記号・顔文字（この 前に 語尾を 足す。閉じかっこは ふくめない＝語尾は かっこの 外）。 */
const TAIL =
	/(?:[。、！？!?…‥〜～\s　ｗ]|(?<![A-Za-z])w+|\p{Extended_Pictographic})+$/u;
const nya = (s: string): string =>
	s.replace(/な/g, "にゃ").replace(/ナ/g, "ニャ");
const nyaTail = (s: string): string => {
	const tail = s.match(TAIL)?.[0] ?? "";
	const body = s.slice(0, s.length - tail.length);
	if (!body || body.endsWith("にゃ") || /[「『（(]$/.test(body)) return s;
	return `${body}にゃ${tail}`;
};

// ───────────── 4/1 強制博多弁 ─────────────

/** 言葉ごと（さ→しゃ より 先に。上から 順に）。 */
export const HAKATA_WORDS: readonly (readonly [string, string])[] = [
	["管理人", "明太子"],
	["おはよう", "おはようしゃん"],
	["うるさい", "しぇからしか"],
	["本当に", "ほんまに"],
	["お前", "貴様"],
	["こんな", "こぎゃん"],
	["そんな", "そげん"],
	["を", "ば"],
];
/** 文の 切れ目の 前だけ（さ→しゃ の あと。上から 順に。「まだ」「〜わよ・のよ・しよ・なよ」「かわいい」は かえない）。 */
export const HAKATA_ENDS: readonly (readonly [string, string])[] = [
	["だよ", "ばい"],
	["やで", "ばい"],
	["(?<!ま)だ", "ばい"],
	["(?<![いっゃゅょぁぃぅぇぉ])や", "ばい"],
	["(?<![わのしな])よ", "クサ"],
	["ない", "なか"],
	["(?<!わ)いい", "よか"],
	["ええ", "よか"],
	["しい", "しか"],
];
/** 文の 切れ目（行の 切れ目は 文の 切れ目では ない。閉じかっこの 内がわも 文末）。 */
const END = "(?=[」』）)]*(?:[。！？!?…‥〜～]|\\p{Extended_Pictographic}|$))";
const HAKATA_END_RE = HAKATA_ENDS.map(
	([a, b]) => [new RegExp(`${a}${END}`, "gu"), b] as const,
);
/** さとる を さ→しゃ から まもる しるし。 */
const SATORU = "\u0001";
const hakata = (text: string): string => {
	let s = text.replaceAll("さとる", SATORU);
	for (const [a, b] of HAKATA_WORDS) s = s.replaceAll(a, b);
	s = s.replace(/さ/g, "しゃ");
	for (const [re, b] of HAKATA_END_RE) s = s.replace(re, b);
	return s.replaceAll(SATORU, "さっとる");
};

// ───────────── 10/31 トリック ─────────────

/** 本家の 8つから 💀 を のぞいた 7つ。 */
export const TRICK_SWEETS = ["🎃", "👻", "🍬", "🍭", "🍪", "🍩", "🍫"] as const;
const EMOJI_G = /\p{Extended_Pictographic}/gu;
const emojiIn = (s: string): number => (s.match(EMOJI_G) ?? []).length;
/** 文で きまる 数（同じ 窓は いつも 同じ おかし。Math.random は つかわない）。 */
const hashOf = (s: string): number => {
	let h = 2166136261;
	for (const ch of s) {
		h ^= ch.codePointAt(0) ?? 0;
		h = Math.imul(h, 16777619) >>> 0;
	}
	return h;
};
/** 窓の さいごの 行の 終わりに おかしを 1つ（入りきらなければ つけない）。 */
const trick = (text: string): string => {
	const lines = text.split("\n");
	const i = lines.length - 1;
	const last = lines[i] ?? "";
	if (!last.trim()) return text;
	const out = `${last}${TRICK_SWEETS[hashOf(text) % TRICK_SWEETS.length] ?? TRICK_SWEETS[0]}`;
	if (windowWidth(out) + emojiIn(last) > EMOJI_LINE_WIDTH) return text;
	lines[i] = out;
	return lines.join("\n");
};

/** 窓に 収まる ものの うち 先の もの（どれも こえるなら もとの 行。もとから こえている 行は さわらない）。 */
const fit = (orig: string, cands: readonly string[]): string =>
	windowWidth(orig) > WINDOW_WIDTH
		? orig
		: (cands.find((c) => windowWidth(c) <= WINDOW_WIDTH) ?? orig);

/** 窓 1つの 文に その日の 変換を かける（行の 数は かえない）。 */
export const modeText = (text: string, mode: OpenMode): string => {
	if (mode === "trick") return trick(text);
	const lines = text.split("\n");
	// 博多弁は 窓 まるごと かえてから 行ごとに 幅を みる（置きかえは 改行を またがない ので 行は 1対1）
	const hk = mode === "hakata" ? hakata(text).split("\n") : [];
	return lines
		.map((l, i) => {
			if (mode === "hakata") return fit(l, [hk[i] ?? l]);
			const last = i === lines.length - 1;
			return fit(l, last ? [nyaTail(nya(l)), nya(l), nyaTail(l)] : [nya(l)]);
		})
		.join("\n");
};

// ───────────── かけない 場面 ─────────────

let held = 0;
/** いま 日替わりを 止めているか（ui/village.ts の say が 見る）。 */
export const modesHeld = (): boolean => held > 0;
/** fn の あいだ 日替わりを かけない（ui/villageMobs.ts の はじめまして・節目）。 */
export const rawModes = async <T>(fn: () => Promise<T>): Promise<T> => {
	held++;
	try {
		return await fn();
	} finally {
		held--;
	}
};
