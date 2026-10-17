// 寸劇を 演じる（文と きっかけは data/story/skits.ts）。見た 寸劇と、見た 帰りを 村の 印として 別の 保存場所に
// 残す（保存できなくても この回は 覚えている）。村ぜんぶで 1回の 帰りに 1本まで（期間限定は べつ）。
// 建物と 物は ui/village/village.ts の runEvent が、場所は 同じく 歩いた あと（afterStep）が、
// 死に方は ui/village/villageMobs.ts の mobScript が 呼ぶ。

import type { MobId } from "../../data/people/mobs";
import {
	SKITS,
	type Skit,
	type SkitDate,
	type SkitOn,
} from "../../data/story/skits";
import { nowYear, today } from "../../data/town/calendar";
import type { Story } from "../../engine/defs";
import { type Cue, cueOf } from "../../engine/emote";
import { loadRecords } from "../../engine/save";

const KEY = "kiriko-roguelike/skits";

type Memo = { seen: string[]; at?: number };

let memo: Memo = { seen: [] };

const load = (): Memo => {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const o = JSON.parse(raw) as Record<string, unknown>;
			return {
				seen: Array.isArray(o.seen)
					? o.seen.filter((x): x is string => typeof x === "string")
					: [],
				at: typeof o.at === "number" ? o.at : undefined,
			};
		}
	} catch {
		// 読めなければ この回の 写し
	}
	return structuredClone(memo);
};

const save = (v: Memo): void => {
	memo = structuredClone(v);
	try {
		localStorage.setItem(KEY, JSON.stringify(v));
	} catch {
		// 保存できなくても 遊べる
	}
};

/** 試験用：この回の 写しを 忘れる。 */
export const forgetSkits = (): void => {
	memo = { seen: [] };
};

const returnAt = (): number => loadRecords()[0]?.at ?? 0;

/** まだ 見て いない 寸劇で、きっかけが 合う もの（この 帰りに もう 見ていれば null）。 */
const find = (hit: (on: SkitOn) => boolean): Skit | null => {
	const v = load();
	const busy = v.at === returnAt();
	return (
		SKITS.find(
			(sk) =>
				!v.seen.includes(sk.key) &&
				// 期間限定は その 日だけ。見逃すと 二度と 出ないので、この 帰りに もう 見ていても 出す
				(sk.date ? onDate(sk.date) : !busy) &&
				hit(sk.on),
		) ?? null
	);
};

/** 今日が その 期間か。 */
const onDate = (d: SkitDate): boolean => {
	const t = today();
	return nowYear() === d.y && t.m === d.m && t.d >= d.d[0] && t.d <= d.d[1];
};

/** 住人の 声（villageMobs.ts の sayAs）。 */
type MobSay = (s: Story, id: MobId, text: string, cue: Cue) => Promise<void>;

/** 演じる（mob は death の 住人と その 声）。 */
const play = async (
	s: Story,
	sk: Skit,
	mob?: { id: MobId; say: MobSay },
): Promise<void> => {
	const v = load();
	v.seen.push(sk.key);
	v.at = returnAt();
	save(v);
	for (const l of sk.lines) {
		const cue = cueOf(l);
		if (l.who === null) await s.narrate(l.text);
		else if (l.who === "kiriko") await s.kiriko(l.text, "voice", cue);
		else if (l.who === "mob") {
			if (mob) await mob.say(s, mob.id, l.text, cue);
		} else
			await s.say(null, l.text, {
				...cue,
				name: l.who.name,
				noPortrait: true,
			});
	}
};

/** イベントの あと：建物に 入ったか（地図が かわった）、物を 調べたか（同じ 地図の まま）。 */
export const skitAfterEvent = async (
	s: Story,
	o: { from: string; to: string; thing: string },
): Promise<boolean> => {
	const sk =
		o.to !== o.from
			? find((on) => on.k === "enter" && on.map === o.to)
			: find((on) => on.k === "look" && o.thing.startsWith(on.thing));
	if (!sk) return false;
	await play(s, sk);
	return true;
};

/** その マスで 起きる、まだ 見て いない 場所の 寸劇（無ければ null。歩く たびに 呼ぶので 見るだけ）。 */
export const nearSkit = (map: string, x: number, y: number): Skit | null =>
	find(
		(on) =>
			on.k === "near" &&
			on.map === map &&
			x >= on.x[0] &&
			x <= on.x[1] &&
			y >= on.y[0] &&
			y <= on.y[1],
	);

/** 場所の 寸劇を 演じる（nearSkit で 見つけた もの）。 */
export const playNearSkit = (s: Story, sk: Skit): Promise<void> => play(s, sk);

/** 前の 冒険で その 死に方を して、この 住人に はじめて 話しかけた（演じたら true）。 */
export const deathSkit = async (
	s: Story,
	mob: MobId,
	last: { kind: string; cause: string } | null,
	say: MobSay,
): Promise<boolean> => {
	if (last?.kind !== "dead") return false;
	const sk = find(
		(on) => on.k === "death" && on.mob === mob && last.cause.includes(on.cause),
	);
	if (!sk) return false;
	await play(s, sk, { id: mob, say });
	return true;
};
