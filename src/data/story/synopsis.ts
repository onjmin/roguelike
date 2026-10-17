// 本筋（STORY.md §5 ダンジョン配信）を 追いやすく する 文。1回の 冒険が 15〜20階と 長く、語りが 入口と
// 出口に しか ないので、潜っている あいだに 筋を 忘れやすい。そこで 3つ 足す：
//   GOAL_WHY：何のために 行くか（全体マップの 札・つよさ・潜った ときの ログ。持ち帰る 前だけ）
//   DIVE_RES：潜っている 途中に 流れる 1行（視聴者の コメント・やきうの コメント・地の文。下りの とき・持ち帰る 前だけ）
//   synopsis：これまでの あらすじと 次の 行き先（村の メニュー・ダンジョンの メニュー）
// どれも 起きた ことを なぞる だけで、先の どんでん返しは 言わない。

import type { DungeonId } from "../../core/types";
import { QUEST_HEROES, questStage } from "../../engine/heroes";
import { loadProgress } from "../../engine/save";
import { HERO_QUESTS } from "../people/heroQuests";
import { REVIVE_AREAS, revivedAreas } from "../town/revival";
import { OPENING } from "../town/town";

/** 何のために 行くか（目的の 品の 先に ある もの）。持ち帰る 前だけ 出す。 */
export const GOAL_WHY: Partial<Record<DungeonId, string>> = {
	// 本筋（目標は 登録者 1位。STORY.md §5）
	shallow: "初配信の　撮れ高を　取ってくる",
	kinoko: "切り抜きの　誤解を　といて、撮れ高を　取る",
	main: "湯けむりコラボで、湯守の　長湯スレを　取る",
	deep: "町の　主電源を　持ち帰って、大会に　出る",
	hidden: "いちばん古い　コメントが　しずむ　底",
};

/**
 * 潜っている 途中に 流れる 1行。at 階に 着いた とき（下り・その 板を まだ 持ち帰って いない ときだけ）。
 * who が "res" なら 視聴者の コメント、"nanj" なら やきう（名無しの 1人目）の コメント、null なら 地の文。
 * 層の 札（data/story/story.ts の zones の note）と 同じ 階には 置かない。
 */
export type DiveRes = {
	at: number;
	who: "res" | "nanj" | null;
	text: string;
};

export const DIVE_RES: Partial<Record<DungeonId, readonly DiveRes[]>> = {
	// ── 本筋（STORY.md §5）。やきうの コメントは 1人目の 視聴者（潜っている あいだも 筋が 止まらない ように）
	shallow: [{ at: 2, who: "nanj", text: "見とるで" }],
	kinoko: [
		{
			at: 2,
			who: null,
			text: "壁に、キリコの　顔の　たけのこが　描いてある。",
		},
		{ at: 3, who: "res", text: "キリコって　たけのこ派なん？" },
		{ at: 4, who: null, text: "底で、親玉が　ふんぞりかえっている。" },
	],
	main: [
		{ at: 3, who: null, text: "湯気の　むこうで、マイクが　ふやけている。" },
		{ at: 6, who: "nanj", text: "見とるで。湯気で　見えへんけど" },
		{ at: 8, who: null, text: "湯船の　すみで、だれかが　動画を　切っとる。" },
		{ at: 10, who: "res", text: "コラボ、湯船が　満員で　草" },
		{ at: 11, who: "res", text: "コラボ、湯気で　だれも　見えん" },
		{ at: 13, who: null, text: "源泉の　底が、近い。" },
	],
	deep: [
		{ at: 3, who: null, text: "でんちゃんの　板。ビリビリ　する。" },
		{ at: 6, who: "res", text: "最近、キリコの　登録者　ふえたな" },
		{ at: 9, who: "nanj", text: "見とるで。最後まで" },
		{ at: 11, who: "res", text: "大会の　日、鯖　もつんか？" },
		{ at: 13, who: null, text: "壁の　コメントが、上から　ふってくる。" },
		{ at: 16, who: "nanj", text: "1位　取ったら、切るんやな" },
		{ at: 19, who: null, text: "いちばん　下に、主電源が　見えた。" },
	],
	// 過去ログの底（99階。最終話の あと）。層の 札の 階は よける
	hidden: [
		{ at: 3, who: null, text: "古い　コメントは、ここへ　しずむ。" },
		{ at: 13, who: "res", text: "キリコ、井戸に　降りたんか" },
		{ at: 25, who: null, text: "毎日の　コメントが、地層に　なっている。" },
		{ at: 35, who: "res", text: "井戸配信、同接　少なくて　草" },
		{ at: 45, who: null, text: "どの　層も、「乙」で　はじまる。" },
		{ at: 66, who: "res", text: "井戸、どこまで　深いんや" },
		{ at: 85, who: null, text: "下の　ほうで、古い　コメントが　光った。" },
		{ at: 95, who: null, text: "底に、2005年の　コメントが　ある。" },
	],
};

/** ログに 出す 形（名無しの レスは 頭に「村の　スレ」、ほかは「〜の　レス」）。 */
export const diveResLine = (r: DiveRes, hero = "キリコ"): string => {
	// 潜って いる 主人公への 呼びかけ（「キリコ、井戸に　降りたんか」）は いまの 主人公の 名前に。
	// 「キリコの　生まれた　スレ」は キリコの こと なので そのまま
	const text = r.text.replaceAll("キリコ、", `${hero}、`);
	return r.who === null ? text : `${RES_HEAD[r.who]}「${text}」`;
};

const RES_HEAD = {
	res: "村の　スレ",
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
	return r;
};

/** 生き返った 通りの 札（「生き返った　通り：2／7」。data/town/revival.ts）。 */
export const revivedLine = (
	cleared: readonly DungeonId[] = loadProgress().cleared,
): string =>
	`生き返った　通り：${revivedAreas(cleared).length}／${REVIVE_AREAS.length}`;

/** 持ち帰る 前なら 何のために 行くか（持ち帰った あとは null）。 */
export const goalWhy = (
	d: DungeonId,
	cleared: readonly DungeonId[],
): string | null => (cleared.includes(d) ? null : (GOAL_WHY[d] ?? null));

/**
 * あらすじの 章（2026-10-13 作者：「踏破した 板ごとの あらすじは 見にくいので 減らせ。要約の 形に」）。
 * 章ごとに、そこまでの 話を まとめた 要約（sum）を 持つ。あらすじでは 本筋と 小島の 話の それぞれ
 * いちばん 新しい 章の 要約だけを 見せる。
 */
type Chapter = {
	done: (c: readonly DungeonId[], f: readonly string[]) => boolean;
	title: string;
	sum: string;
};

/** 本筋の 章（起きた 順）。 */
const MAIN_CHAPTERS: readonly Chapter[] = [
	{
		done: (c) => c.includes("shallow"),
		title: "パン板",
		sum: "町に　ダンジョンが　開いて、潜る　配信が　大はやり。いちばん　新しい　キリコは、名前を　おぼえて　もらおうと　登録者　0人から　配信を　はじめた。1人目の　視聴者は、名無しの　やきう。パン板で　初配信を　した。",
	},
	{
		done: (c) => c.includes("kinoko"),
		title: "きのこ板",
		sum: "きのこ板では「キリコは　たけのこ派」の　切り抜きが　出まわったが、親玉きのにゃんは　登録して　くれた。やきうの　頭の　上には「残機：1」と　出ている。",
	},
	{
		done: (c) => c.includes("main"),
		title: "風呂板",
		sum: "湯けむりコラボで、切り抜き職人は　応援の　つもりの　ぷゆゆだと　わかった。ダンジョンは、視聴者の　コメントが　積もって　できていた。いちばん下の　1つ目は、キリコの　初配信の「見とるで」。大会で　何十万人　来れば、町の　下が　抜ける。キリコは、1位を　とって　配信を　切ると　決めた。",
	},
	{
		done: (c) => c.includes("deep"),
		title: "電池板",
		sum: "5人の　同時配信大会。にぃちぇの　登録で、キリコが　1位に　なった。キリコは　町の　主電源を　落として　配信を　切った。暗い　中、蓄音機が　初配信の「見とるで」を　鳴らした。やきうは、名無しの　ままだった。",
	},
	{
		done: (c) => c.includes("hidden"),
		title: "過去ログの底",
		sum: "井戸の　底で、2005年の　いちばん古い　コメントを　見つけた。「ふぇ…ふぇ……フェニックス！」……フェリスの　はじまりの　声だった。",
	},
];

/** 本筋の 次の 行き先。 */
const mainNext = (
	c: readonly DungeonId[],
	open: readonly DungeonId[],
): string | null => {
	if (!c.includes("main"))
		return open.includes("main")
			? "風呂板へ。湯守の　長湯スレ"
			: "きのこ板の　親玉に　登録して　もらうと、風呂板へ　行ける";
	if (!c.includes("deep")) return "電池板へ。いちばん　下の　主電源";
	if (!c.includes("hidden")) return "広場の　古井戸から、過去ログの底へ";
	return null;
};

/** いちばん 新しい 章（どれも まだなら null）。 */
const latest = (
	list: readonly Chapter[],
	c: readonly DungeonId[],
	f: readonly string[],
): Chapter | null => [...list].reverse().find((ch) => ch.done(c, f)) ?? null;

/**
 * あらすじの 中身（パン板を 持ち帰る 前は null）。登録者の 数・本筋の 要約・仲間の 依頼・「つぎ：」の 行き先。
 * open は 開いている 板（風呂板は きのこ板で 5回 倒れても 開く）。
 */
export const synopsisHtml = (
	cleared: readonly DungeonId[],
	flags: readonly string[],
	open: readonly DungeonId[] = cleared,
): string | null => {
	const main = latest(MAIN_CHAPTERS, cleared, flags);
	if (!main) return null;
	// 仲間の 依頼（束音ロゼ・解音ゼロ。悩みを かかえて から。data/people/heroQuests.ts）
	const quests = QUEST_HEROES.flatMap((h) => {
		const st = questStage(h, flags);
		return st === "none" ? [] : [HERO_QUESTS[h].synopsis[st]];
	});
	const questHtml = quests.length
		? `<p><b>仲間の　依頼</b><br>${quests.join("<br>")}</p>`
		: "";
	const next = mainNext(cleared, open);
	const chapter = (ch: Chapter | null) =>
		ch ? `<p><b>${ch.title}　まで</b><br>${ch.sum}</p>` : "";
	return (
		`<p class="hint">${revivedLine()}</p>` +
		chapter(main) +
		questHtml +
		(next ? `<p class="hint">つぎ：${next}</p>` : "")
	);
};

/**
 * パン板を 持ち帰る 前の あらすじ（はじまりの 目標だけ。2026-10-15 ガイドの 洗い出し：「最初の 目標が
 * 1回きりで 読みかえせない」）。はじまりの やきうの 言葉（data/town/town.ts の OPENING）を そのまま。
 */
export const firstGoalHtml = (): string =>
	`<p class="hint">${revivedLine()}</p>` +
	`<p><b>はじまり</b><br>${OPENING.nanjMouth.map((l) => l.replaceAll("\n", "")).join("<br>")}</p>` +
	`<p class="hint">つぎ：${OPENING.goal[0].replaceAll("\n", "")}</p>`;

/** いまの 進みの あらすじ（パン板を 持ち帰る 前は はじまりの 目標）。 */
export const synopsisNow = (): string => {
	const p = loadProgress();
	return synopsisHtml(p.cleared, p.flags ?? [], p.unlocked) ?? firstGoalHtml();
};
