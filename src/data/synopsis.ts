// 本筋（STORY.md §5）と 裏シナリオ（§5.98）を 追いやすく する 文。1回の 冒険が 20〜30階と 長く、語りが 入口と
// 出口に しか ないので、潜っている あいだに 筋を 忘れやすい。そこで 3つ 足す：
//   GOAL_WHY：何のために 行くか（全体マップの 札・つよさ・潜った ときの ログ。持ち帰る 前だけ）
//   DIVE_RES：潜っている 途中に 流れる 1行（村の スレの レス・地の文。下りの とき・持ち帰る 前だけ）
//   synopsis：これまでの あらすじと 次の 行き先（村の メニュー・ダンジョンの メニュー）
// どれも 起きた ことを なぞる だけで、先の どんでん返しは 言わない。

import type { DungeonId } from "../core/types";
import { QUEST_HEROES, questStage } from "../engine/heroes";
import { loadProgress } from "../engine/save";
import { HERO_QUESTS } from "./heroQuests";

/** 何のために 行くか（目的の 品の 先に ある もの）。持ち帰る 前だけ 出す。 */
export const GOAL_WHY: Partial<Record<DungeonId, string>> = {
	// 本筋（目標は はじめから「村の スレを 1000まで」）
	shallow: "沈みかけた　村の　スレを　伸ばす",
	main: "よく　伸びた　スレを　貼って、人を　呼ぶ",
	deep: "村の　スレを、1000まで　つれていく",
	hidden: "キリコの　生まれた　スレが　しまわれた　底",
	// 裏
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
 * who が "res" なら 村の スレへの 名無しの レス（村に 人が 来る 風呂板の あとだけ）、"shobon" なら 原住民の
 * レス（灯台の あとにしか 村に いない）、"nanj" なら やきうの レス（電池板の 山場で 出ていくまで）、null なら 地の文。層の 札（data/story.ts の zones の note）と 同じ 階には 置かない。
 */
export type DiveRes = {
	at: number;
	who: "res" | "shobon" | "nanj" | null;
	text: string;
};

export const DIVE_RES: Partial<Record<DungeonId, readonly DiveRes[]>> = {
	// ── 本筋。村に 人が 来るのは 風呂板の あと（それまでの 村の スレは やきうだけ）
	shallow: [{ at: 3, who: "nanj", text: "保守しとるで。ゆっくり　来い" }],
	main: [
		{ at: 4, who: null, text: "湯気の　むこうに、古い　レスが　浮いている。" },
		{ at: 8, who: "nanj", text: "長湯スレ、あったか？" },
		{ at: 12, who: null, text: "だれも　読まない　スレが、まだ　ぬくい。" },
		{ at: 16, who: "nanj", text: "上の　スレは　保守しとるで" },
		{ at: 19, who: null, text: "源泉の　底が、近い。" },
	],
	deep: [
		{ at: 4, who: null, text: "人の　いない　板。なのに、スレが　上がる。" },
		{ at: 9, who: "res", text: "1000まで　あと　どんくらいや" },
		{ at: 14, who: "nanj", text: "鉄塔の　保守、だれやろな" },
		{ at: 19, who: null, text: "上から、「保守」の　レスが　ふってくる。" },
		{ at: 24, who: "res", text: "1000、もう　すぐ　ちゃうか" },
		{ at: 29, who: null, text: "てっぺんに、いちばん　長い　保守スレ。" },
	],
	// 過去ログの底（99階。やきうは もう 外）。層の 札の 階は よける
	hidden: [
		{ at: 3, who: null, text: "完走した　スレは、ここに　しまわれる。" },
		{ at: 13, who: "res", text: "キリコ、井戸に　降りたんか" },
		{ at: 25, who: null, text: "やきうは、外で　見とると　言った。" },
		{ at: 35, who: "res", text: "村の　スレ、今日も　保守しといたで" },
		{ at: 45, who: null, text: "どの　スレも、最後は　同じ　レスで　終わる。" },
		{ at: 66, who: "res", text: "井戸、どこまで　深いんや" },
		{ at: 85, who: null, text: "下の　ほうで、金色が　光った。" },
		{ at: 95, who: null, text: "底に、キリコの　生まれた　スレが　ある。" },
	],
	// ── 裏
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

/** ログに 出す 形（名無しの レスは 頭に「村の　スレ」、ほかは「〜の　レス」）。 */
export const diveResLine = (r: DiveRes): string =>
	r.who === null ? r.text : `${RES_HEAD[r.who]}「${r.text}」`;

const RES_HEAD = {
	res: "村の　スレ",
	shobon: "原住民の　レス",
	nanj: "やきうの　レス",
} as const;

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
	// やきうは 電池板を 持ち帰ると 外へ 出ていく（寄り道の 板を あとから 行く ときも）
	if (r.who === "nanj" && cleared.includes("deep")) return null;
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

/** 本筋の 章（起きた 順）。done を 満たした 章だけ 見せる。 */
const MAIN_CHAPTERS: readonly Chapter[] = [
	{
		done: (c) => c.includes("shallow"),
		title: "パン板",
		text: "人が　散って、沈みかけた　保守村の　スレ。植民地の　底から　沈んだ　ネタを　拾って　貼ると、スレが　伸びた。目標は、村の　スレを　1000まで。",
	},
	{
		done: (c) => c.includes("main"),
		title: "風呂板",
		text: "長湯スレを　貼ると、スレは　500を　こえた。知らない　人が　書きこみはじめた。電池板は、人が　いないのに　スレが　上がるらしい。",
	},
	{
		done: (c) => c.includes("deep"),
		title: "電池板",
		text: "鉄塔の　保守スレは、やきうの　書きこみだった。村の　スレは　1000に　届き、1000は　知らない　名無し。やきうは　次スレを　キリコに　まかせて、外へ　出ていった。キリコは　小屋の　前の　札に「保守」と　書いた。",
	},
	{
		done: (c) => c.includes("hidden"),
		title: "過去ログの底",
		text: "古井戸の　底で、キリコの　生まれた　スレを　拾った。あちこちに　名無しの「保守」と、「次スレ　立てといたで」。",
	},
];

/** 本筋の 次の 行き先。 */
const mainNext = (
	c: readonly DungeonId[],
	open: readonly DungeonId[],
): string | null => {
	if (!c.includes("main"))
		return open.includes("main")
			? "風呂板へ。源泉の　底の　長湯スレ"
			: "きのこ板の　親玉を　たおすと、風呂板へ　行ける";
	if (!c.includes("deep")) return "電池板へ。鉄塔の　てっぺん";
	if (!c.includes("hidden")) return "広場の　古井戸から、過去ログの底へ";
	return null;
};

/** 裏の 章（起きた 順）。 */
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
	// 電池板が まだなら、行き先は 電池板の「つぎ：」 1つで よい
	if (!c.includes("deep")) return null;
	if (!c.includes("hinan")) return "北東の　沖の　避難Jへ";
	if (!f.includes("wrap")) return "もう　一度　もぐって、村へ　帰る";
	if (!c.includes("y1901"))
		return "本館の　いちばん　古い　札の、さらに　下へ（1901年の　スレ）";
	return null;
};

/** 章の 並びと 次の 行き先（章が 1つも なければ 空）。 */
/**
 * 見せる 並び（題で）。本筋と 裏を 分けて 見せると 裏が あると わかって しまうので、1本の 話として まぜる。
 * 遊ぶ 順は 人に よって ちがうが、だいたい 起きる 順に。
 */
const ORDER: readonly string[] = [
	"パン板",
	"ひまわり諸島",
	"よふかし諸島",
	"だらだら諸島",
	"風呂板",
	"灯台",
	"ROM専の　声",
	"電池板",
	"野球chの　跡地",
	"過去ログの底",
	"避難J",
	"時計",
	"1901年の　スレ",
];

/**
 * あらすじの 中身（パン板を 持ち帰る 前は null）。章を 1本に まぜ、最後に「つぎ：」の 行き先。
 * open は 開いている 板（風呂板は きのこ板で 5回 倒れても 開く）。
 */
export const synopsisHtml = (
	cleared: readonly DungeonId[],
	flags: readonly string[],
	open: readonly DungeonId[] = cleared,
): string | null => {
	const done = [...MAIN_CHAPTERS, ...CHAPTERS]
		.filter((ch) => ch.done(cleared, flags))
		.sort((a, b) => ORDER.indexOf(a.title) - ORDER.indexOf(b.title));
	if (!done.length) return null;
	// 仲間の 依頼（束音ロゼ・解音ゼロ。悩みを かかえて から。data/heroQuests.ts）
	const quests = QUEST_HEROES.flatMap((h) => {
		const st = questStage(h, flags);
		return st === "none" ? [] : [HERO_QUESTS[h].synopsis[st]];
	});
	const questHtml = quests.length
		? `<p><b>仲間の　依頼</b><br>${quests.join("<br>")}</p>`
		: "";
	// 裏の 行き先は 裏に 入って いる ときだけ（入る 前に 出すと 入口を 教えて しまう）
	const inUra = CHAPTERS.some((ch) => ch.done(cleared, flags));
	const next = [
		mainNext(cleared, open),
		inUra ? nextStep(cleared, flags) : null,
	].filter((x): x is string => !!x);
	return (
		done.map((ch) => `<p><b>${ch.title}</b><br>${ch.text}</p>`).join("") +
		questHtml +
		next.map((x) => `<p class="hint">つぎ：${x}</p>`).join("")
	);
};

/** いまの 進みの あらすじ（パン板を 持ち帰る 前は null）。 */
export const synopsisNow = (): string | null => {
	const p = loadProgress();
	return synopsisHtml(p.cleared, p.flags ?? [], p.unlocked);
};
