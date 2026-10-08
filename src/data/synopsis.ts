// 裏シナリオ（STORY.md §5.98）を 追いやすく する 文。1回の 冒険が 20〜30階と 長く、語りが 入口と 出口に しか
// ないので、潜っている あいだに 筋を 忘れやすい。そこで 3つ 足す：
//   GOAL_WHY：何のために 行くか（全体マップの 札・つよさ・潜った ときの ログ。持ち帰る 前だけ）
//   DIVE_RES：潜っている 途中に 流れる 1行（村の スレの レス・地の文。下りの とき・持ち帰る 前だけ）
//   synopsis：これまでの あらすじと 次の 行き先（冒険の 記録・ダンジョンの メニュー）
// どれも 起きた ことを なぞる だけで、先の どんでん返しは 言わない。

import type { DungeonId } from "../core/types";
import { loadProgress } from "../engine/save";

/** 何のために 行くか（目的の 品の 先に ある もの）。持ち帰る 前だけ 出す。 */
export const GOAL_WHY: Partial<Record<DungeonId, string>> = {
	isle1: "丘の　上に、知らない　字の　紙きれ",
	isle2: "置き手紙を　そろえて、灯台の　扉を　あける",
	isle3: "さいごの　置き手紙。灯台の　鍵に　なる",
	opunu: "てっぺんの、板主の　はじめの　スレを　上げる",
	ato: "原住民　20人の　スレを、村で　参拝する",
	hinan: "全滅した　20人の、20人目を　さがす",
	y1901: "とどかなかった　コピペの　続きを　読む",
};

/**
 * 潜っている 途中に 流れる 1行。at 階に 着いた とき（下り・その 板を まだ 持ち帰って いない ときだけ）。
 * who が "res" なら 村の スレへの 名無しの レス、"shobon" なら 原住民の レス（灯台の あとにしか 村に いない）、
 * null なら 地の文。層の 札（data/story.ts の zones の note）と 同じ 階には 置かない。
 */
export type DiveRes = {
	at: number;
	who: "res" | "shobon" | null;
	text: string;
};

export const DIVE_RES: Partial<Record<DungeonId, readonly DiveRes[]>> = {
	isle1: [
		{ at: 3, who: null, text: "丘の　上で、紙きれが　はためいている。" },
		{ at: 5, who: "res", text: "南の　小島、だれか　行っとる？" },
	],
	isle2: [
		{ at: 3, who: null, text: "壁に　古い　レス。「ねれない」" },
		{ at: 6, who: "res", text: "置き手紙、だれの　字なんや" },
		{ at: 8, who: null, text: "奥で、紙の　こすれる　音が　した。" },
	],
	isle3: [
		{ at: 4, who: null, text: "明かりが　ちらついた。鯖代が　あぶない。" },
		{ at: 8, who: "res", text: "置き手紙、あと　1枚や" },
		{ at: 12, who: null, text: "岩山の　上に、紙きれが　見えた。" },
	],
	opunu: [
		{ at: 3, who: "res", text: "てっぺんに　板主の　スレが　ある" },
		{ at: 9, who: "res", text: "のんびり板の　板主って　だれや" },
		{ at: 14, who: null, text: "上から、あいさつが　聞こえた　気が　した。" },
		{ at: 19, who: null, text: "てっぺんは、すぐ　そこだ。" },
	],
	ato: [
		{ at: 4, who: "shobon", text: ">>1は　底。おれが　書いた" },
		{
			at: 10,
			who: "shobon",
			text: "昔は　20人　いたんだ",
		},
		{ at: 16, who: null, text: "ROM専が、遠くから　こっちを　見ている。" },
		{ at: 22, who: "res", text: "参拝の　準備、しとくで" },
		{ at: 28, who: "shobon", text: "その　下に、>>1が　ある" },
	],
	hinan: [
		{
			at: 3,
			who: null,
			text: "最後の　レスは　1000日前。リロードの　音だけ。",
		},
		{ at: 8, who: "shobon", text: "20人目、どんな　やつだっけ" },
		{ at: 13, who: null, text: "1000ゲッターが、レス番を　数えている。" },
		{ at: 18, who: "shobon", text: "あいつ、いつも　ツッコんでた" },
		{ at: 23, who: null, text: "底の　ほうに、2012年の　日付が　見えた。" },
	],
	y1901: [
		{ at: 4, who: "res", text: "時計、まだ　1901年の　ままや" },
		{
			at: 12,
			who: "shobon",
			text: "下ほど、日付が　古いね",
		},
		{ at: 20, who: null, text: "秒針の　音が、近く　なった。" },
		{ at: 27, who: "res", text: "あの　コピペ、続き　あるんか？" },
		{
			at: 29,
			who: null,
			text: "いちばん　底に、とどかなかった　レスが　1つ。",
		},
	],
};

/** ログに 出す 形（名無しの レスは 頭に「村の　スレ」、原住民は「原住民の　レス」）。 */
export const diveResLine = (r: DiveRes): string =>
	r.who === null
		? r.text
		: `${r.who === "shobon" ? "原住民の　レス" : "村の　スレ"}「${r.text}」`;

/** その 階に 流す 1行（無ければ null）。 */
export const diveResAt = (
	d: DungeonId,
	depth: number,
	cleared: readonly DungeonId[],
): DiveRes | null => {
	if (cleared.includes(d)) return null;
	const r = DIVE_RES[d]?.find((x) => x.at === depth);
	if (!r) return null;
	// 原住民は 灯台を 持ち帰るまで 村に いない
	if (r.who === "shobon" && !cleared.includes("opunu")) return null;
	return r;
};

/** 持ち帰る 前なら 何のために 行くか（持ち帰った あとは null）。 */
export const goalWhy = (
	d: DungeonId,
	cleared: readonly DungeonId[],
): string | null => (cleared.includes(d) ? null : (GOAL_WHY[d] ?? null));

type Chapter = {
	done: (c: readonly DungeonId[], f: readonly string[]) => boolean;
	title: string;
	text: string;
};

/** あらすじの 章（起きた 順）。done を 満たした 章だけ 見せる。 */
const CHAPTERS: readonly Chapter[] = [
	{
		done: (c) => c.includes("isle1"),
		title: "ひまわり諸島",
		text: "南西の　小島は、おんJ民が　立てて　捨てた　板だった。乗っ取り屋に　名前を　変えられ、丘の　上に　置き手紙が　1枚。",
	},
	{
		done: (c) => c.includes("isle2"),
		title: "よふかし諸島",
		text: "となりの　小島も　乗っ取られた　板。置き手紙の　2枚目。取り返すと、板の　名前が　もどった。",
	},
	{
		done: (c) => c.includes("isle3"),
		title: "だらだら諸島",
		text: "置き手紙が　3枚　そろった。灯台の　扉の　パスワードの　手がかり。",
	},
	{
		done: (c) => c.includes("opunu"),
		title: "灯台",
		text: "てっぺんの　板主の　スレを　上げると、原住民が　村へ　帰ってきた。おんJ民が　来る　前から　いた　20人の　ひとり。",
	},
	{
		done: (c, f) => c.includes("opunu") && f.includes("romVoice"),
		title: "ROM専の　声",
		text: "ROM専の　声を　聞かせると、原住民は「この　声、知ってる」。本館の　奥の　古い　札の　床下が　あいた。",
	},
	{
		done: (c) => c.includes("ato"),
		title: "野球chの　跡地",
		text: "いちばん　古い　スレを　参拝で　完走させた。1000は　ROM専たちの「見てた」。原住民は　全滅して　いなかった。ROMに　なって、見ていた　だけ。……あと　ひとり。",
	},
	{
		done: (c) => c.includes("hinan"),
		title: "避難J",
		text: "20人目の　最後の　レスは「ワイも　やきう民に　なるわ」。1000を　あけておくと、外から「保守　(´・ω・｀)」。",
	},
	{
		done: (_, f) => f.includes("wrap"),
		title: "時計",
		text: "外から　コピペが　届いた。「おんJを　見てんのは　さとると　ワイと　お前だけや」。笑って　いるうちに、時計が　1901年に　もどった。",
	},
	{
		done: (c) => c.includes("y1901"),
		title: "1901年の　スレ",
		text: "コピペの　続きを　読んだ。キリコは、鉄塔の　保守スレの　1000を　書いた。",
	},
];

/** 次の 行き先（いちばん 新しい 章の 次。終わって いれば null）。 */
const nextStep = (
	c: readonly DungeonId[],
	f: readonly string[],
): string | null => {
	if (!c.includes("isle2")) return "となりの　小島（よふかし諸島）へ";
	if (!c.includes("isle3")) return "その　先の　小島（だらだら諸島）へ";
	if (!c.includes("opunu"))
		return "灯台（のんびり諸島）へ。扉の　パスワードは　置き手紙に";
	if (!f.includes("romVoice"))
		return "どこかの　板で　ROM専の　声を　蓄音機に　録り、そのまま　持ち帰る";
	if (!c.includes("ato")) return "本館の　奥の　古い　札から、跡地へ";
	if (!c.includes("deep")) return "電池板を　持ち帰ると、話が　動く";
	if (!c.includes("hinan")) return "北東の　沖の　避難Jへ";
	if (!f.includes("wrap")) return "もう　一度　もぐって、村へ　帰る";
	if (!c.includes("y1901"))
		return "本館の　いちばん　古い　札の、さらに　下へ（1901年の　スレ）";
	return null;
};

/** あらすじの 中身（裏に まだ 入って いなければ null）。 */
export const synopsisHtml = (
	cleared: readonly DungeonId[],
	flags: readonly string[],
): string | null => {
	const done = CHAPTERS.filter((ch) => ch.done(cleared, flags));
	if (!done.length) return null;
	const next = nextStep(cleared, flags);
	return (
		done.map((ch) => `<p><b>${ch.title}</b><br>${ch.text}</p>`).join("") +
		(next ? `<p class="hint">つぎ：${next}</p>` : "")
	);
};

/** いまの 進みの あらすじ（裏に まだ 入って いなければ null）。 */
export const synopsisNow = (): string | null => {
	const p = loadProgress();
	return synopsisHtml(p.cleared, p.flags ?? []);
};
