// 本筋（STORY.md §5 総選挙）を 追いやすく する 文。1回の 冒険が 15〜20階と 長く、語りが 入口と
// 出口に しか ないので、潜っている あいだに 筋を 忘れやすい。そこで 3つ 足す：
//   GOAL_WHY：何のために 行くか（全体マップの 札・つよさ・潜った ときの ログ。持ち帰る 前だけ）
//   DIVE_RES：潜っている 途中に 流れる 1行（村の スレの レス・やきうの レス・地の文。下りの とき・持ち帰る 前だけ）
//   synopsis：これまでの あらすじと 次の 行き先（村の メニュー・ダンジョンの メニュー）
// どれも 起きた ことを なぞる だけで、先の どんでん返しは 言わない。

import { townStep } from "../../core/town";
import type { DungeonId } from "../../core/types";
import { QUEST_HEROES, questStage } from "../../engine/heroes";
import { loadProgress, loadTown } from "../../engine/save";
import { HERO_QUESTS } from "../people/heroQuests";
import { MOB_IDS, movedIn } from "../people/mobs";
import { nowHour, today } from "../town/calendar";
import { OPENING } from "../town/town";
import { crowdSize, timeBand } from "../village/crowd";
import { SPEAKERS, type Speaker } from "./quotes";
import { awayFriends } from "./story";

/** 何のために 行くか（目的の 品の 先に ある もの）。持ち帰る 前だけ 出す。 */
export const GOAL_WHY: Partial<Record<DungeonId, string>> = {
	// 本筋（目標は 総選挙。STORY.md §5）
	shallow: "パン板の　推薦を　もらう",
	kinoko: "怒る　親玉の　誤解を　といて、推薦を　もらう",
	main: "裸の　討論会で、湯守の　推薦を　もらう",
	deep: "投票箱を　持ち帰って、開票する",
	hidden: "2012年の、最初の　告示が　しずむ　底",
};

/**
 * 潜っている 途中に 流れる 1行。at 階に 着いた とき（下り・その 板を まだ 持ち帰って いない ときだけ）。
 * who が "res" なら 村の スレへの 名無しの レス、"nanj" なら やきうの レス（現職の 声。確定して いるので いつも 同じ 調子）、null なら 地の文。
 * 層の 札（data/story/story.ts の zones の note）と 同じ 階には 置かない。
 */
export type DiveRes = {
	at: number;
	who: "res" | "nanj" | null;
	text: string;
};

export const DIVE_RES: Partial<Record<DungeonId, readonly DiveRes[]>> = {
	// ── 本筋（STORY.md §5）。やきうの レスは 現職の 声（潜っている あいだも 筋が 止まらない ように。階の 札にも 出る）
	shallow: [{ at: 2, who: "nanj", text: "今年も　ワイが　勝つで" }],
	kinoko: [
		{ at: 3, who: "res", text: "キリコって　たけのこ派なん？" },
		{ at: 4, who: null, text: "底で、親玉が　ふんぞりかえっている。" },
	],
	main: [
		{ at: 3, who: null, text: "湯気の　むこうで、公約が　ふやけている。" },
		{ at: 6, who: "nanj", text: "毎年、同じ　湯や" },
		{ at: 8, who: null, text: "湯船の　すみで、だれかが　紙を　書いている。" },
		{ at: 11, who: "res", text: "討論会、ホゲェしか　聞こえん" },
		{ at: 13, who: null, text: "源泉の　底が、近い。" },
	],
	deep: [
		{ at: 3, who: null, text: "でんちゃんの　板。ビリビリ　する。" },
		{ at: 6, who: "res", text: "最近、支持者　ふえたな" },
		{ at: 9, who: "nanj", text: "ワイも、本気で　回っとるで" },
		{ at: 13, who: null, text: "上から、やきうの　ポスターが　ふってくる。" },
		{ at: 16, who: "nanj", text: "勝ったら　あかんで" },
		{ at: 19, who: null, text: "いちばん　下に、投票箱が　見えた。" },
	],
	// 過去ログの底（99階。開票の あと）。層の 札の 階は よける
	hidden: [
		{ at: 3, who: null, text: "古い　告示は、ここへ　しずむ。" },
		{ at: 13, who: "res", text: "キリコ、井戸に　降りたんか" },
		{ at: 25, who: null, text: "毎年の　告示が、地層に　なっている。" },
		{ at: 35, who: "res", text: "来年の　ポスター、もう　刷ったで" },
		{ at: 45, who: null, text: "どの　告示も、同じ　規則で　はじまる。" },
		{ at: 66, who: "res", text: "井戸、どこまで　深いんや" },
		{ at: 85, who: null, text: "下の　ほうで、古い　紙が　光った。" },
		{ at: 95, who: null, text: "底に、2012年の　告示が　ある。" },
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

/**
 * キリコの 支持者の 数（総選挙が どこまで 来たか。STORY.md §5「しくみと 話の つなぎ」）。町で 見える 人と 同じ 数：
 * キリコ ＋ 村に いる 仲間 ＋ 越してきた 住人 ＋ いまの 時間帯の 通行人（data/village/crowd.ts の crowdSize。
 * 村の 人通りと 同じ 計算）。はじめは 4人（キリコ・やきう・ぷゆゆ・原住民）。
 */
export const villageRes = (
	cleared: readonly DungeonId[],
	stage: number,
	points: number,
	clock: { hour: number; weekend: boolean },
): number => {
	const away = awayFriends(cleared, stage);
	const friends = (Object.keys(SPEAKERS) as Speaker[]).filter(
		(w) => !away.includes(w),
	).length;
	const mobs = movedIn(townStep(stage, points), cleared).length;
	const crowd = crowdSize(stage, timeBand(clock.hour), clock.weekend);
	return 1 + friends + mobs + crowd;
};

/** 支持者の 札（「キリコの　支持者：24人」。いまの 進みと 時刻で）。 */
export const villageResLine = (): string => {
	const p = loadProgress();
	const t = loadTown();
	const w = today().w;
	const n = villageRes(p.cleared, t.stage, t.points, {
		hour: nowHour(),
		weekend: w === 0 || w === 6,
	});
	return `キリコの　支持者：${n}人`;
};

/**
 * まとめ掲示板の 立候補の ポスター（STORY.md §5。村の 状態と 同じ 数）。キリコと 仲間・住人 ぜんぶで 23枚。
 * 村に 来た 人（越してきた 住人と、やきう 以外の 仲間）は 降りて キリコの 陣営に 入ったので「辞退」の 札。
 * 開票（電池板）の あとは 当選の 花と 来年の ポスター。
 */
export const posterLine = (
	cleared: readonly DungeonId[],
	stage: number,
	points: number,
): string => {
	const all = 1 + Object.keys(SPEAKERS).length + MOB_IDS.length;
	if (cleared.includes("deep"))
		return `キリコの　ポスターに、当選の　花。\n来年の　ポスターも、もう　${all}枚。`;
	const away = awayFriends(cleared, stage);
	const friends = (Object.keys(SPEAKERS) as Speaker[]).filter(
		(w) => w !== "nanj" && !away.includes(w),
	).length;
	const out = friends + movedIn(townStep(stage, points), cleared).length;
	return `立候補の　ポスターが　${all}枚。\n「辞退」の　札が　${out}枚。`;
};

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
		sum: "おんJ　公式マスコットの　総選挙が　告示された。いちばん　新しい　キリコは、名前を　おぼえて　もらおうと　立候補した。現職は、毎年　勝つ　やきう。パン板で、はじめての　推薦を　もらった。",
	},
	{
		done: (c) => c.includes("kinoko"),
		title: "きのこ板",
		sum: "総選挙に　立候補した　キリコ。きのこ板には「キリコは　たけのこ派」の　怪文書が　まかれていたが、親玉きのにゃんの　推薦を　もらった。やきうの　頭の　上には「残機：1」と　出ている。",
	},
	{
		done: (c) => c.includes("main"),
		title: "風呂板",
		sum: "怪文書の　犯人は、応援の　つもりの　ぷゆゆだった。告示の　小さい　字には、当選した　公式は　確定して、毎年　同じ　一日を　くり返すと　あった。告示を　貼ったのは　やきう　本人。2012年から　同じ　一年に　いる。キリコは、勝って　確定を　消すと　決めた。",
	},
	{
		done: (c) => c.includes("deep"),
		title: "電池板",
		sum: "開票。にぃちぇの　1票で、キリコが　当選した。最初の　変更で、キリコは　確定を　なくした。やきうは　ようやく　来年へ　進み、キリコには　さっそく　安価が　とんできた。",
	},
	{
		done: (c) => c.includes("hidden"),
		title: "過去ログの底",
		sum: "井戸の　底で、2012年の　最初の　告示を　見つけた。規則を　決めたのは、名無しの　ふざけた　安価だった。",
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
			: "きのこ板の　親玉の　推薦を　もらうと、風呂板へ　行ける";
	if (!c.includes("deep")) return "電池板へ。いちばん　下の　投票箱";
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
 * あらすじの 中身（パン板を 持ち帰る 前は null）。支持者の 数・本筋の 要約・仲間の 依頼・「つぎ：」の 行き先。
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
		`<p class="hint">${villageResLine()}</p>` +
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
	`<p class="hint">${villageResLine()}</p>` +
	`<p><b>はじまり</b><br>${OPENING.nanjMouth.map((l) => l.replaceAll("\n", "")).join("<br>")}</p>` +
	`<p class="hint">つぎ：${OPENING.goal[0].replaceAll("\n", "")}</p>`;

/** いまの 進みの あらすじ（パン板を 持ち帰る 前は はじまりの 目標）。 */
export const synopsisNow = (): string => {
	const p = loadProgress();
	return synopsisHtml(p.cleared, p.flags ?? [], p.unlocked) ?? firstGoalHtml();
};
