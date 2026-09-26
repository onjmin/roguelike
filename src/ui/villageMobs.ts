// 保守村の おんJマイナーズ（data/mobs.ts）に 話しかけたとき と、総選挙の はり紙。
// 話しかけるたび 次の 順で 1つ（Hades の 帰りごとの 会話に ならう。見た話は くり返さない）：
//   1. 総選挙で 1票 入れた子の お礼（1回だけ）
//   2. はじめまして（おんすちゃんは そのあと 書きこむまで 毎回 きく）
//   3. 新しい話（1回の 帰りに 1本。節目 → 雑談。頭の上に「！」）
//   4. 期間限定（端末の 日付）
//   5. 前の冒険への 反応（1回の 帰りに 1回）
//   6. いつもの ひとこと（曜日で かわる子も）
// 会った・見た・聞いた 帰り・1票は 村の 印として 別の 保存場所に 残す（中断セーブ・記録・町には ふれない。
// 保存できなくても この回は 覚えている）。ダンジョンの 中には 一切 かかわらない。

import { season, today } from "../data/calendar";
import {
	type Milestone,
	MOB_IDS,
	MOBS,
	type MobDef,
	type MobId,
	type MobLine,
	SENKYO,
} from "../data/mobs";
import type { Script, Story } from "../engine/defs";
import { loadProgress, loadRecords, runStats } from "../engine/save";
import { fill } from "./villageTalk";

/** 仲間が「近くに いる」と みなす 距離（マス。たて・よこ・ななめ の 大きい方）。 */
export const NEAR = 6;

const KEY = "kiriko-roguelike/mobs";

type MobMemo = {
	/** 会った子。 */
	met: MobId[];
	/** 見た 話（`<id>:<key>`。節目は `<id>:@<節目>`）。 */
	seen: string[];
	/** 新しい話を 聞いた 帰り（記録の 終わった時刻）。 */
	heard: Partial<Record<MobId, number>>;
	/** 反応を 聞いた 帰り。 */
	reacted: Partial<Record<MobId, number>>;
	/** おんSに 書きこんだ。 */
	wrote: boolean;
	vote?: MobId;
	thanked: boolean;
};

const empty = (): MobMemo => ({
	met: [],
	seen: [],
	heard: {},
	reacted: {},
	wrote: false,
	thanked: false,
});

let memo: MobMemo = empty();

const isMob = (v: unknown): v is MobId =>
	typeof v === "string" && (MOB_IDS as string[]).includes(v);

const byMob = (o: unknown): Partial<Record<MobId, number>> => {
	const out: Partial<Record<MobId, number>> = {};
	if (o && typeof o === "object")
		for (const [k, v] of Object.entries(o))
			if (isMob(k) && typeof v === "number") out[k] = v;
	return out;
};

const load = (): MobMemo => {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const o = JSON.parse(raw) as Record<string, unknown>;
			return {
				met: Array.isArray(o.met) ? o.met.filter(isMob) : [],
				seen: Array.isArray(o.seen)
					? o.seen.filter((x): x is string => typeof x === "string")
					: [],
				heard: byMob(o.heard),
				reacted: byMob(o.reacted),
				wrote: o.wrote === true,
				vote: isMob(o.vote) ? o.vote : undefined,
				thanked: o.thanked === true,
			};
		}
	} catch {
		// 読めなければ この回の 写し
	}
	return structuredClone(memo);
};

const save = (v: MobMemo): void => {
	memo = structuredClone(v);
	try {
		localStorage.setItem(KEY, JSON.stringify(v));
	} catch {
		// 保存できなくても 遊べる
	}
};

/** 試験用：この回の 写しを 忘れる。 */
export const forgetMobMemo = (): void => {
	memo = empty();
};

/** いまの 帰り（いちばん新しい 冒険の記録の 終わった時刻。まだ無ければ 0）。 */
const returnAt = (): number => loadRecords()[0]?.at ?? 0;

// ───────────────── 選ぶ ─────────────────

const MILESTONES: readonly Milestone[] = ["main", "deep", "runs10"];

const reached = (ms: Milestone): boolean =>
	ms === "runs10" ? runStats().runs >= 10 : loadProgress().cleared.includes(ms);

/** まだ見ていない 節目（上から）。 */
const nextMilestone = (
	id: MobId,
	v: MobMemo,
): { key: string; lines: MobLine[] } | null => {
	for (const ms of MILESTONES) {
		const lines = MOBS[id].milestones[ms];
		const key = `${id}:@${ms}`;
		if (lines && !v.seen.includes(key) && reached(ms)) return { key, lines };
	}
	return null;
};

/** まだ見ていない 雑談（with の ある話は その仲間が 近くに いるときだけ）。 */
const nextChat = (
	id: MobId,
	v: MobMemo,
	near: (who: MobLine["who"]) => boolean,
): { key: string; lines: MobLine[] } | null => {
	for (const ch of MOBS[id].chats) {
		const key = `${id}:${ch.key}`;
		if (!v.seen.includes(key) && (!ch.with || near(ch.with)))
			return { key, lines: ch.lines };
	}
	return null;
};

/** 前の冒険への 反応（まだ 一度も もぐっていなければ null）。 */
export const reactionOf = (def: MobDef): string | null => {
	const last = loadRecords()[0];
	if (!last) return null;
	if (last.kind === "clear") return def.react.clear;
	if (last.kind === "escape") return def.react.escape;
	if (def.react.starve && last.cause.includes("おなかが"))
		return def.react.starve;
	return last.depth >= 14 ? def.react.deep : def.react.dead;
};

/** いつもの ひとこと（7つなら 曜日で）。 */
export const idleOf = (def: MobDef): string =>
	typeof def.idle === "string"
		? def.idle
		: (def.idle[today().w] ?? def.idle[0] ?? "");

/** 頭の上に「！」（はじめまして・お礼・まだ見ていない 節目か 仲間なしの 雑談が この帰りに ある）。 */
export const hasMobNews = (id: MobId): boolean => {
	const v = load();
	if (!v.met.includes(id)) return true;
	if (v.vote === id && !v.thanked && MOBS[id].thx.length) return true;
	if (MOBS[id].ask && !v.wrote) return false;
	if (v.heard[id] === returnAt()) return false;
	return (
		nextMilestone(id, v) !== null ||
		MOBS[id].chats.some((ch) => !ch.with && !v.seen.includes(`${id}:${ch.key}`))
	);
};

// ───────────────── 話す ─────────────────

/** 1窓ずつ。仲間の 行と need の 行は、その仲間が 近くに いるときだけ。 */
const play = async (
	s: Story,
	def: MobDef,
	lines: readonly MobLine[],
): Promise<void> => {
	for (const l of lines) {
		if (l.need && !s.near(l.need, NEAR)) continue;
		if (l.who === null) await s.narrate(l.text);
		else if (l.who === "mob") await s.say(null, l.text, { name: def.name });
		else if (s.near(l.who, NEAR)) await s.say(l.who, l.text);
	}
};

/** おんすちゃんの「書きこんで　くださる？」。 */
const ask = async (s: Story, id: MobId, def: MobDef): Promise<void> => {
	const a = def.ask;
	if (!a) return;
	await play(s, def, a.lines);
	const yes = (await s.choose([...a.options], { cancel: 1 })) === 0;
	if (!yes) {
		await play(s, def, a.no);
		return;
	}
	const v = load();
	v.wrote = true;
	// 書きこんだ 帰りは もう 新しい話を 出さない（1回の 話しかけに 1つ）
	v.heard[id] = returnAt();
	save(v);
	await play(s, def, a.yes);
};

/** その子に 話しかけたとき。 */
export const mobScript =
	(id: MobId): Script =>
	async (s) => {
		const def = MOBS[id];
		const at = returnAt();
		const v = load();
		if (v.vote === id && !v.thanked && def.thx.length) {
			v.thanked = true;
			save(v);
			await play(s, def, def.thx);
			return;
		}
		if (!v.met.includes(id)) {
			v.met.push(id);
			v.heard[id] = at;
			save(v);
			await play(s, def, def.meet);
			await ask(s, id, def);
			return;
		}
		if (def.ask && !v.wrote) {
			await ask(s, id, def);
			return;
		}
		if (v.heard[id] !== at) {
			const news =
				nextMilestone(id, v) ??
				nextChat(id, v, (w) => w !== null && w !== "mob" && s.near(w, NEAR));
			v.heard[id] = at;
			if (news) v.seen.push(news.key);
			save(v);
			if (news) {
				await play(s, def, news.lines);
				return;
			}
		}
		const sea = season();
		const seasonal = sea ? def.season[sea] : undefined;
		if (seasonal) {
			await s.say(null, seasonal, { name: def.name });
			return;
		}
		if (v.reacted[id] !== at) {
			const r = reactionOf(def);
			v.reacted[id] = at;
			save(v);
			if (r) {
				await s.say(null, r, { name: def.name });
				return;
			}
		}
		await s.say(null, idleOf(def), { name: def.name });
	};

// ───────────────── 総選挙 ─────────────────

/** 総選挙の 候補（会った子。殿堂入りの おんちゃんは 入らない）。 */
const candidates = (v: MobMemo): MobId[] =>
	MOB_IDS.filter((id) => id !== "onchan" && v.met.includes(id));

/** はり紙が 出ているか（2人 以上に 会った）。 */
export const senkyoOpen = (): boolean => candidates(load()).length >= 2;

/** はり紙を 読む（まだなら 1票 入れられる）。 */
export const senkyoScript: Script = async (s) => {
	await s.narrate(SENKYO.title);
	await s.narrate(SENKYO.hall);
	const v = load();
	if (v.vote) {
		await s.narrate(fill(SENKYO.voted, { name: MOBS[v.vote].name }));
		return;
	}
	await s.narrate(SENKYO.box);
	const list = candidates(v);
	const i = await s.choose(
		[...list.map((id, k) => `>>${k + 1} ${MOBS[id].name}`), "やめる"],
		{ cancel: list.length },
	);
	const pick = list[i];
	if (!pick) return;
	const w = load();
	w.vote = pick;
	save(w);
	s.se("read");
	await s.narrate(fill(SENKYO.done, { name: MOBS[pick].name }));
	if (s.near("rei", NEAR)) await s.say("rei", SENKYO.rei);
};
