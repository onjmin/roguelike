// 期間限定の 目的（板ごとの 目的の 既定は core/data/dungeons.ts の objective）。
//
// - 現実の 日付には 連動しない。冒険が 終わるたび（クリア・倒れた・帰還スレ）に、終わりかた・出撃の 回数・
//   確率で 起きたり 起きなかったりし、起きたら 終わりの 条件（その 板の クリア N回・出撃 N回の 先に 来た ほう）
//   まで 続いて 終わる。起きている イベントは 0か 1つ（engine/save.ts の Progress.event）。
// - 確率に Math.random は 使わない：終わった 冒険の シードと 出撃の 回数から 作った 決まった 値。
//   冒険の 乱数（core）にも 触らない。
// - 目的を 決めるのは 村で 行き先を 決める とき（ui/villageEvents.ts）に 1回だけ。決めた 値は
//   VillageExit → main.ts → Run.create → RunState.objective（続き・リプレイ・共有は 保存した 値。無ければ 持ち帰り）。
// - 関数は どれも 純（進み具合を 引数で 受ける。試験で 決め打ち できるように）。
// - 開発用：?event=<id>（pnpm dev か ?debug の ときだけ）で その イベントが 起きている ことに する（保存は しない。
//   need も 見ない）。その あいだに 村から 出た 冒険は debug: の シード（main.ts。本物の 進み具合・記録に 残さない）。

import { DUNGEONS } from "../core/data/dungeons";
import { MONSTERS } from "../core/data/monsters";
import { defOf } from "../core/item";
import type { DungeonId, Objective } from "../core/types";
import type { Progress } from "../engine/save";

export type EventDef = {
	id: string;
	/** 名前（日付を 感じさせない もの。村の 知らせと 行き先えらびに 出す）。 */
	name: string;
	dungeon: DungeonId;
	objective: Objective;
	/** 起きる 前の 条件（cleared：ぜんぶ クリアずみ・unlocked：ぜんぶ 行ける）。 */
	need?: { cleared?: DungeonId[]; unlocked?: DungeonId[] };
	/**
	 * 起きる きっかけ（冒険が 終わった とき）。on：終わりかた（any は 問わない）・chance：確率・
	 * everyOutings：出撃の 回数が その 倍数に なった・minOutings：出撃が それ 以上。
	 */
	start: {
		on: "clear" | "dead" | "escape" | "any";
		chance?: number;
		everyOutings?: number;
		minOutings?: number;
	};
	/** 終わる 条件（先に 来た ほう。clears：その 板を クリアした 回数・outings：始まってからの 出撃の 回数）。 */
	end: { clears?: number; outings?: number };
	/** 始まった ときに 村で 添える ひとこと（ナレーション。全角22字・2行まで）。 */
	news: string;
};

/** 期間限定の イベント（上から 順に 判定して、最初に 当たった 1つが 始まる）。 */
export const EVENTS: readonly EventDef[] = [
	{
		id: "pan-march",
		name: "パン板の　大行進",
		dungeon: "shallow",
		objective: "boss",
		need: { cleared: ["shallow"] },
		start: { on: "clear", chance: 1 / 3 },
		end: { clears: 1, outings: 4 },
		news: "パン板の　底で　パン兵長が\n兵を　集めている　らしい",
	},
	{
		id: "bath-steam",
		name: "風呂板の　湯けむり騒動",
		dungeon: "main",
		objective: "boss",
		need: { cleared: ["main"] },
		// たおれて もどった あとの 気分転換に
		start: { on: "dead", chance: 1 / 4 },
		end: { clears: 1, outings: 5 },
		news: "風呂板の　源泉に、\n湯守が　居すわった　らしい",
	},
	{
		id: "kinoko-hunt",
		name: "きのこ狩り",
		dungeon: "kinoko",
		objective: "fetch",
		need: { unlocked: ["kinoko"] },
		// 結果は 問わない（出撃が 5の 倍数に なったら 1/2）。3回 もぐると 終わる。
		// 終わった 出撃では また 始まらないので、周期 P ごとに 必ず 始まると 3/P（P=3 だと 3/6）が
		// 持ち帰りに なる。ボスの 板が ふだんは ボスで あるように、1/2 で 引いて およそ 3/10 に おさえる
		// （ほかの イベントと 重なる ふつうの 遊び方なら もっと 少ない）
		start: { on: "any", everyOutings: 5, chance: 1 / 2 },
		end: { outings: 3 },
		news: "きのこ板の　親玉が　昼寝中。\n底の　AAを　拾ってくる　だけで　いい",
	},
	{
		id: "festival-rain",
		name: "お祭りの　雨天順延",
		dungeon: "festival",
		objective: "fetch",
		need: { unlocked: ["festival"] },
		start: { on: "dead", chance: 1 / 4 },
		end: { clears: 1, outings: 4 },
		news: "雨で　親分マシーは　来ない。\nやぐらに　うちわだけ　落ちている",
	},
];

const EVENT_BY_ID: Readonly<Record<string, EventDef>> = Object.fromEntries(
	EVENTS.map((e) => [e.id, e]),
);

export const eventById = (id: string): EventDef | undefined => EVENT_BY_ID[id];

/** 起きている イベント（Progress.event）。since：始まった ときの 出撃の 回数・clearsSince：その あと その 板を クリアした 回数。 */
export type ActiveEvent = { id: string; since: number; clearsSince: number };

/** 冒険の 終わり（イベントを 進める 材料）。 */
export type RunEnd = {
	dungeon: DungeonId;
	kind: "dead" | "clear" | "escape";
	seed: string;
};

/** 文字列 → 0 以上 1 未満の 決まった 値（FNV-1a を かきまぜた もの。確率に 使う）。 */
export const chanceOf = (key: string): number => {
	let h = 0x811c9dc5;
	for (let i = 0; i < key.length; i++) {
		h ^= key.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	h ^= h >>> 16;
	h = Math.imul(h, 0x85ebca6b) >>> 0;
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35) >>> 0;
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
};

/** その 板で その 目的に できるか（ボスは ボスの いる 板だけ）。 */
const canHave = (d: DungeonId, o: Objective): boolean =>
	o === "fetch" || !!DUNGEONS[d].boss;

/** 終わるまでの 残り（表示用。「次の　クリアまで」「あと　3回」）。 */
const endsIn = (e: EventDef, ev: ActiveEvent, outings: number): string => {
	const clears =
		e.end.clears === undefined
			? null
			: Math.max(1, e.end.clears - ev.clearsSince);
	const left =
		e.end.outings === undefined
			? null
			: Math.max(1, e.end.outings - (outings - ev.since));
	const untilClear =
		clears === null
			? ""
			: clears === 1
				? "次の　クリア"
				: `${clears}回　クリア`;
	if (left === null) return `${untilClear}まで`;
	if (clears === null) return `あと　${left}回`;
	return `${untilClear}か　あと　${left}回`;
};

export type ObjectiveInfo = {
	objective: Objective;
	/** 期間限定の イベントで かわった とき（endsIn は 表示用の 残り）。 */
	event?: { id: string; name: string; endsIn: string };
};

/**
 * その 板の 今の 目的（起きている イベントが あれば その 目的。無ければ 板の 既定）。
 * 村で 行き先を 決める ときに 1回だけ 呼ぶ（決めた 値を Run.create へ）。
 */
export const objectiveFor = (
	d: DungeonId,
	p: Pick<Progress, "event" | "outings">,
): ObjectiveInfo => {
	const ev = p.event;
	const e = ev ? eventById(ev.id) : undefined;
	if (ev && e && e.dungeon === d && canHave(d, e.objective))
		return {
			objective: e.objective,
			event: { id: e.id, name: e.name, endsIn: endsIn(e, ev, p.outings ?? 0) },
		};
	return { objective: DUNGEONS[d].objective };
};

/** その イベントが 今 始まるか（need・きっかけ・確率）。 */
const startsNow = (
	e: EventDef,
	p: Pick<Progress, "cleared" | "unlocked">,
	outings: number,
	r: RunEnd,
): boolean => {
	const s = e.start;
	if (s.on !== "any" && s.on !== r.kind) return false;
	if (s.minOutings !== undefined && outings < s.minOutings) return false;
	if (s.everyOutings !== undefined && outings % s.everyOutings !== 0)
		return false;
	if (e.need?.cleared?.some((d) => !p.cleared.includes(d))) return false;
	if (e.need?.unlocked?.some((d) => !p.unlocked.includes(d))) return false;
	if (!canHave(e.dungeon, e.objective)) return false;
	return (
		s.chance === undefined ||
		chanceOf(`${r.seed}|${outings}|${e.id}`) < s.chance
	);
};

/**
 * 冒険が 終わった（cleared を 更新した あとに 1回だけ）：出撃を 1 足し、起きている イベントが あれば
 * その 板の クリアを 数えて、終わりの 条件に 届いたら 終える。起きていなければ（今 終わった ものは 除いて）
 * 上から 順に 判定して 最初に 当たった 1つを 始める。p は 書きかえない（新しい 進み具合を 返す）。
 */
export const advanceEvents = (
	p: Progress,
	r: RunEnd,
): { progress: Progress; started?: EventDef; ended?: EventDef } => {
	const outings = (p.outings ?? 0) + 1;
	const next: Progress = { ...p, outings };
	delete next.event;
	const cur = p.event ? eventById(p.event.id) : undefined;
	let ended: EventDef | undefined;
	if (p.event && cur) {
		const clearsSince =
			p.event.clearsSince +
			(r.kind === "clear" && r.dungeon === cur.dungeon ? 1 : 0);
		const done =
			(cur.end.clears !== undefined && clearsSince >= cur.end.clears) ||
			(cur.end.outings !== undefined &&
				outings - p.event.since >= cur.end.outings);
		if (!done)
			return { progress: { ...next, event: { ...p.event, clearsSince } } };
		ended = cur;
	}
	for (const e of EVENTS) {
		if (e === ended || !startsNow(e, next, outings, r)) continue;
		next.event = { id: e.id, since: outings, clearsSince: 0 };
		return { progress: next, started: e, ended };
	}
	return { progress: next, ended };
};

/** 開発用：?event=<id>（pnpm dev か ?debug の ときだけ）。無ければ・知らない id なら null。 */
export const devEvent = (): string | null => {
	if (typeof location === "undefined") return null;
	const q = new URLSearchParams(location.search);
	if (!import.meta.env.DEV && !q.has("debug")) return null;
	const id = q.get("event");
	return id && eventById(id) ? id : null;
};

/** 村で 目的を 決める ときの 進み具合（開発用の ?event を 重ねる。保存は しない）。 */
export const withDevEvent = <P extends Pick<Progress, "event" | "outings">>(
	p: P,
): P => {
	const id = devEvent();
	if (!id) return p;
	return { ...p, event: { id, since: p.outings ?? 0, clearsSince: 0 } };
};

/** その 板の ボスの 名前（ボスの いない 板は null）。 */
export const bossName = (d: DungeonId): string | null => {
	const b = DUNGEONS[d].boss;
	return b ? (MONSTERS[b.monster]?.name ?? null) : null;
};

/** 目的の ひとこと（「〇〇を　持ち帰る」「〇〇を　たおす」）。 */
export const goalText = (d: DungeonId, o: Objective): string => {
	const boss = o === "boss" ? bossName(d) : null;
	return boss
		? `${boss}を　たおす`
		: `${defOf(DUNGEONS[d].goal).name}を　持ち帰る`;
};

/** 期間限定の ひとこと（「期間限定：きのこ狩り（あと　3回）」。イベントで なければ 空）。 */
export const eventText = (g: ObjectiveInfo): string =>
	g.event ? `期間限定：${g.event.name}（${g.event.endsIn}）` : "";

/** 村で 読む 知らせ（始まった・終わった）。 */
export const eventNewsText = (
	e: EventDef,
	started: boolean,
): readonly string[] =>
	started
		? [`期間限定：${e.name}が\nはじまった`, e.news]
		: [`期間限定の　${e.name}は\nおわった`];
