// 喫茶「保守」（村の 西の 空き地。町の 段5 から）。店を 経営する 所では なく、仲間と 話す きっかけの 場所。
// - 入ると ときどき「あちらの　お客様からです」：まだ 話していない 話の ある 仲間が キリコに 一杯 送ってきて、
//   その 話が 始まる（1回の 帰りに 1回まで）。
// - 一杯 おごる：倉庫の 草を 1つ 使って、選んだ 仲間に 一杯（推しへの 投げ銭）。好みの 一杯なら 特別な 反応。
//   おごった 回数で その 仲間の 話が ふえる（data/cafe.ts の treats）。強さには 何も 効かない。
// - 話の 一覧から 聞きたい 話を 選ぶ（まだ 聞いていない 話には「！」）。
// 聞いた 印・おごった 回数は 別の 保存場所に 残す（中断セーブ・記録・町には 手を ふれない。倉庫の 草だけ へる）。

import { defOf } from "../core/item";
import type { Item } from "../core/types";
import {
	CAFE_DRINKS,
	CAFE_TALKS,
	type CafeLine,
	type CafeTalk,
	TREAT_REACTIONS,
	TREAT_TALKS,
} from "../data/cafe";
import { SPEAKERS, type Speaker } from "../data/quotes";
import { CAFE_FROM } from "../data/village/map";
import type { Script, Story } from "../engine/defs";
import { loadRecords, loadTown, takeFromStorage } from "../engine/save";
import type { Ctx } from "./ctx";
import { type ListItem, listWindow } from "./list";

const KEY = "kiriko-roguelike/cafe";

type CafeState = {
	heard: string[];
	/** 仲間ごとの おごった 回数。 */
	treats: Partial<Record<Speaker, number>>;
	/** 「あちらの　お客様から」を 出した 帰り（記録の 時刻）。 */
	sentAt: number;
};

let memo: CafeState | null = null;

const load = (): CafeState => {
	if (memo) return JSON.parse(JSON.stringify(memo)) as CafeState;
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
		// 前の 形（聞いた id の 配列）も 読む
		if (Array.isArray(raw))
			return {
				heard: raw.filter((x) => typeof x === "string"),
				treats: {},
				sentAt: 0,
			};
		if (raw && typeof raw === "object")
			return {
				heard: Array.isArray(raw.heard) ? raw.heard : [],
				treats: raw.treats && typeof raw.treats === "object" ? raw.treats : {},
				sentAt: typeof raw.sentAt === "number" ? raw.sentAt : 0,
			};
	} catch {
		// 読めなければ はじめから
	}
	return { heard: [], treats: {}, sentAt: 0 };
};

const save = (st: CafeState): void => {
	memo = JSON.parse(JSON.stringify(st)) as CafeState;
	try {
		localStorage.setItem(KEY, JSON.stringify(st));
	} catch {
		// 保存できなくても この回は memo で 覚えている
	}
};

/** いまの 帰り（いちばん 新しい 記録の 時刻）。 */
const returnAt = (): number => loadRecords()[0]?.at ?? 0;

/** いまの 町・おごった 回数で 聞ける 話。 */
export const cafeTalks = (stage: number, st: CafeState = load()): CafeTalk[] =>
	[...CAFE_TALKS, ...TREAT_TALKS].filter(
		(t) =>
			stage >= (t.from ?? CAFE_FROM) &&
			(st.treats[t.cast[0]] ?? 0) >= (t.treats ?? 0),
	);

/** まだ 聞いていない 話が あるか（扉の 上の「！」）。 */
export const hasCafeNews = (): boolean => {
	const st = load();
	return cafeTalks(loadTown().stage, st).some((t) => !st.heard.includes(t.id));
};

/** 倉庫に ある 一杯に できる 草。 */
const drinkHerbs = (): Item[] =>
	loadTown().storage.filter((it) => !!CAFE_DRINKS[it.kind]);

const play = async (
	s: Story,
	lines: readonly CafeLine[],
	drink = "",
): Promise<void> => {
	for (const l of lines) {
		const text = l.text.replaceAll("{drink}", drink);
		await (l.who ? s.say(l.who, text) : s.narrate(text));
	}
};

/** 話を 1つ 聞く（聞いた 印を つける）。 */
const hear = async (s: Story, talk: CafeTalk): Promise<void> => {
	await play(s, talk.lines);
	const st = load();
	if (!st.heard.includes(talk.id)) st.heard.push(talk.id);
	save(st);
};

/** 入った ときの「あちらの　お客様から」（まだ 聞いていない 話の ある 仲間から。1回の 帰りに 1回）。 */
const incoming = async (s: Story): Promise<void> => {
	const st = load();
	const at = returnAt();
	if (st.sentAt === at) return;
	const talk = cafeTalks(loadTown().stage, st).find(
		(t) => !st.heard.includes(t.id),
	);
	if (!talk) return;
	st.sentAt = at;
	save(st);
	const from = talk.cast[0];
	await s.narrate(
		"マスターが　グラスを　置いた。\n「あちらの　お客様からです」",
	);
	await s.narrate(`${SPEAKERS[from].name}が　グラスを　かかげた。`);
	await hear(s, talk);
};

/** 一杯 おごる：仲間を 選び、倉庫の 草を 選んで、「あちらの　お客様からです」。 */
const treat = async (ctx: Ctx, s: Story): Promise<void> => {
	const st = load();
	const who = (await listWindow(
		ctx,
		"だれに　一杯　おごる？",
		(Object.keys(SPEAKERS) as Speaker[]).map((w) => ({
			label: SPEAKERS[w].name,
			sub: st.treats[w] ? `${st.treats[w]}杯` : "",
			value: w,
		})),
		{ closeLabel: "やめる" },
	)) as Speaker | null;
	if (!who) return;
	const herbs = drinkHerbs();
	const v = await listWindow(
		ctx,
		"どの　草で　作ってもらう？",
		herbs.map(
			(it, i): ListItem => ({
				label: defOf(it.kind).name,
				sub: CAFE_DRINKS[it.kind]?.name ?? "",
				value: String(i),
			}),
		),
		{ closeLabel: "やめる" },
	);
	if (v === null) return;
	const herb = herbs[Number(v)];
	const drink = herb && CAFE_DRINKS[herb.kind];
	if (!herb || !drink || !takeFromStorage([herb]).length) return;
	const before = cafeTalks(loadTown().stage, st).length;
	const n = (st.treats[who] ?? 0) + 1;
	st.treats[who] = n;
	save(st);
	await s.narrate(
		`キリコは　${defOf(herb.kind).name}を　わたした。\nマスターが　${drink.name}を　作った。`,
	);
	await s.narrate(
		`マスターが　${SPEAKERS[who].name}の　前に　置いた。\n「あちらの　お客様からです」`,
	);
	const reactions = TREAT_REACTIONS[who];
	await play(
		s,
		drink.who === who ? drink.lines : reactions[(n - 1) % reactions.length],
		drink.name,
	);
	if (cafeTalks(loadTown().stage).length > before)
		await s.narrate(`${SPEAKERS[who].name}と　話せる　ことが　ふえた。`);
};

/** 喫茶の 扉。 */
export const cafeScript =
	(ctx: Ctx): Script =>
	async (s) => {
		await s.narrate("喫茶「保守」。\nいつもの　顔が、いつもの　席に　いる。");
		await incoming(s);
		let start = 0;
		for (;;) {
			await s.wait(0);
			const st = load();
			const talks = cafeTalks(loadTown().stage, st);
			const herbs = drinkHerbs().length;
			const rows: ListItem[] = [
				{
					label: "一杯　おごる",
					sub: herbs ? `草 ${herbs}` : "",
					desc: herbs
						? "倉庫の　草で　作って、仲間に　送る"
						: "倉庫に　草が　ない",
					value: "__treat",
					disabled: !herbs,
				},
				...talks.map((t) => ({
					label: `${st.heard.includes(t.id) ? "" : "！"}${t.title}`,
					sub: t.cast.map((w) => SPEAKERS[w].name).join("・"),
					value: t.id,
				})),
			];
			const v = await listWindow(ctx, "喫茶「保守」", rows, {
				start,
				closeLabel: "店を　出る",
			});
			if (!v) return;
			start = Math.max(
				0,
				rows.findIndex((r) => r.value === v),
			);
			await s.wait(0);
			if (v === "__treat") {
				await treat(ctx, s);
				continue;
			}
			const talk = talks.find((t) => t.id === v);
			if (talk) await hear(s, talk);
		}
	};
