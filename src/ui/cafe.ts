// 喫茶「保守」（村の 西の 空き地。町の 段5 から）。扉を 調べると 話の 一覧が 出て、選んだ 話を 仲間が する。
// 話は data/cafe.ts。まだ 聞いていない 話には「！」。聞いた 印は 別の 保存場所に 残す
// （中断セーブ・記録・町には 手を ふれない。保存できなくても この回は 覚えている）。

import { CAFE_TALKS } from "../data/cafe";
import { SPEAKERS } from "../data/quotes";
import { CAFE_FROM } from "../data/village/map";
import type { Script } from "../engine/defs";
import { loadTown } from "../engine/save";
import type { Ctx } from "./ctx";
import { listWindow } from "./list";

const HEARD_KEY = "kiriko-roguelike/cafe";
let memo: string[] | null = null;

const loadHeard = (): Set<string> => {
	if (memo) return new Set(memo);
	try {
		const raw = JSON.parse(localStorage.getItem(HEARD_KEY) ?? "[]");
		return new Set(
			Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [],
		);
	} catch {
		return new Set();
	}
};

const saveHeard = (h: Set<string>): void => {
	memo = [...h];
	try {
		localStorage.setItem(HEARD_KEY, JSON.stringify(memo));
	} catch {
		// 保存できなくても この回は memo で 覚えている
	}
};

/** いまの 町で 聞ける 話。 */
export const cafeTalks = (stage: number) =>
	CAFE_TALKS.filter((t) => stage >= (t.from ?? CAFE_FROM));

/** まだ 聞いていない 話が あるか（扉の 上の「！」）。 */
export const hasCafeNews = (): boolean => {
	const heard = loadHeard();
	return cafeTalks(loadTown().stage).some((t) => !heard.has(t.id));
};

/** 喫茶の 扉：話の 一覧から 選んで 聞く（店を 出るまで 何度でも）。 */
export const cafeScript =
	(ctx: Ctx): Script =>
	async (s) => {
		await s.narrate("喫茶「保守」。\nいつもの　顔が、いつもの　席に　いる。");
		let start = 0;
		for (;;) {
			await s.wait(0);
			const heard = loadHeard();
			const talks = cafeTalks(loadTown().stage);
			const v = await listWindow(
				ctx,
				"どの　話を　聞く？",
				talks.map((t) => ({
					label: `${heard.has(t.id) ? "" : "！"}${t.title}`,
					sub: t.cast.map((w) => SPEAKERS[w].name).join("・"),
					value: t.id,
				})),
				{ start, closeLabel: "店を　出る" },
			);
			if (!v) return;
			const i = talks.findIndex((t) => t.id === v);
			const talk = talks[i];
			if (!talk) return;
			start = i;
			for (const l of talk.lines)
				await (l.who ? s.say(l.who, l.text) : s.narrate(l.text));
			heard.add(talk.id);
			saveHeard(heard);
		}
	};
