// 寸劇を 演じる（文と きっかけは data/story/skits.ts）。見た 寸劇と、見た 帰りを 村の 印として 別の 保存場所に
// 残す（保存できなくても この回は 覚えている）。村ぜんぶで 1回の 帰りに 1本まで（期間限定は べつ）。
// 建物と 物は ui/village/village.ts の runEvent が、場所は 同じく 歩いた あと（afterStep）が、
// 死に方は ui/village/villageMobs.ts の mobScript が 呼ぶ。
// 帰りの 2幕目（続きの 寸劇）を 待って いる あいだは どの 寸劇も 出さない（holdSkits。先に 見せると 話の 前後が 合わない）。

import { KIRIKO } from "../../data/people/cast";
import type { MobId } from "../../data/people/mobs";
import {
	SKITS,
	type Skit,
	type SkitLine,
	type SkitOn,
	type SkitWindow,
} from "../../data/story/skits";
import type { Story } from "../../engine/defs";
import { type Cue, cueOf } from "../../engine/emote";
import { loadProgress, loadRecords } from "../../engine/save";
import { FX_SE, type FxRun, fxRoot, startFx } from "../../engine/sceneFx";

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

/** 帰りの 2幕目を 待って いる（ui/village/villageEvents.ts の storyHeld）。その あいだ 寸劇は 起きない。 */
let held = false;

/** 2幕目を 待つ あいだ 寸劇を 止める／もどす（2幕目を 見おえてから その 場所・物で また 起きる）。 */
export const holdSkits = (v: boolean): void => {
	held = v;
};

/** 2幕目を 待って いるか（越してくる 場面も 止める：ui/village/arrivals.ts）。 */
export const skitsHeld = (): boolean => held;

/** まだ 見て いない 寸劇で、きっかけが 合う もの（この 帰りに もう 見ていれば null。2幕目を 待つ あいだも null）。 */
const find = (hit: (on: SkitOn) => boolean): Skit | null => {
	if (held) return null;
	// きっかけ（場所・物）を 先に 見る（1歩ごとに 呼ばれる。保存を 読むのは 合う ものが あった ときだけ）
	const near = SKITS.filter((sk) => hit(sk.on));
	if (!near.length) return null;
	const v = load();
	const busy = v.at === returnAt();
	return (
		near.find(
			(sk) =>
				!v.seen.includes(sk.key) &&
				// 期間限定は 話の その あいだ だけ。見逃すと 二度と 出ないので、この 帰りに もう 見ていても 出す
				(sk.window ? inWindow(sk.window) : !busy),
		) ?? null
	);
};

/**
 * いま 話の その あいだか（持ち帰った 板で 見る）。はじめての 村（まだ 1度も 帰って いない。
 * はじまりの 場面の あいだ）では 出さない。
 */
const inWindow = (w: SkitWindow): boolean => {
	if (!returnAt()) return false;
	const cleared = loadProgress().cleared;
	return (
		(!w.after || cleared.includes(w.after)) &&
		(!w.before || !cleared.includes(w.before))
	);
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
	// 場所の 寸劇は、話の もと（噴水・池・海）の ほうを キリコが 向き、カメラも そちらへ（2026-10-19 作者
	// 「事が 起きている 方向に プレイヤーを 向かせる」）。おわりに カメラは キリコへ もどす
	const face = sk.on.k === "near" ? sk.on.face : undefined;
	if (face) {
		const dx = face[0] - s.state.x;
		const dy = face[1] - s.state.y;
		s.face(
			"player",
			Math.abs(dx) >= Math.abs(dy)
				? dx < 0
					? "left"
					: "right"
				: dy < 0
					? "up"
					: "down",
		);
		await s.look(face);
	}
	// 爆発などの エフェクト（calm の 窓か 寸劇の 終わりで 消える。地図は こわれないので 消えたら 元通り）
	let fx: FxRun | null = null;
	try {
		for (const l of sk.lines) {
			if (l.calm && fx) {
				fx.end();
				fx = null;
			}
			// カメラを 向ける（爆発する 家・物の ほう。null で キリコへ）
			if (l.look !== undefined) await s.look(l.look);
			if (l.fx) {
				fx?.end();
				const se = l.fx === "boom" ? "explosion" : FX_SE[l.fx];
				if (se) s.se(se);
				// 出す 所：fxAt の マス（家の 上）、温めは キリコの 上。カメラが 動いても その 所を 追う
				const cell = l.fxAt ?? (l.fx === "heat" ? null : undefined);
				const track =
					cell === undefined
						? undefined
						: () =>
								s.cellPoint?.(
									cell ? cell[0] : s.state.x,
									cell ? cell[1] : s.state.y,
								) ?? null;
				fx = startFx(fxRoot(), l.fx, { caption: l.caption, track });
				await fx.ready;
			}
			if (l.se) s.se(l.se);
			// 吹っとぶ（殴られた・爆風。速く すべって 回る）。far は 歩いて 行ける いちばん 遠い 所
			if (l.fling) {
				const to = l.fling === "far" ? s.farCell?.(7) : l.fling;
				if (to) await fling(s, to);
			}
			// 顔の カットイン（キリコの 驚きの 顔。ひとりでに 消える）
			if (l.cutin)
				await startFx(fxRoot(), "cutin", { art: KIRIKO.portrait }).ready;
			if (l.text) await line(s, l, mob);
		}
	} finally {
		fx?.end();
		if (face || sk.lines.some((l) => l.look)) await s.look(null);
	}
};

/** キリコが 吹っとぶ（すべって 回り、画面が ゆれる。行けない マスなら 近い 所まで）。 */
const fling = async (
	s: Story,
	to: readonly [number, number],
): Promise<void> => {
	// 画面の ない 試験（src/sim）では ゆらさない
	const body = typeof document === "undefined" ? null : document.body;
	body?.classList.add("shake");
	const go = s.goto("player", to[0], to[1], { speed: 7, noWarp: true });
	s.face("player", "down");
	await go;
	body?.classList.remove("shake");
};

/** 1窓。 */
const line = async (
	s: Story,
	l: SkitLine,
	mob?: { id: MobId; say: MobSay },
): Promise<void> => {
	const cue = cueOf(l);
	if (l.who === null)
		await (cue.auto ? s.say(null, l.text, cue) : s.narrate(l.text));
	else if (l.who === "kiriko") await s.kiriko(l.text, "voice", cue);
	else if (l.who === "mob") {
		if (mob) await mob.say(s, mob.id, l.text, cue);
	} else
		await s.say(null, l.text, {
			...cue,
			name: l.who.name,
			noPortrait: true,
		});
};

/** イベントの あと：建物に 入ったか（地図が かわった）、物を 調べたか（同じ 地図の まま）。 */
export const skitAfterEvent = async (
	s: Story,
	o: { from: string; to: string; thing: string },
): Promise<boolean> => {
	const sk =
		o.to !== o.from
			? find((on) => on.k === "enter" && on.map === o.to)
			: find(
					(on) =>
						on.k === "look" &&
						o.thing.startsWith(on.thing) &&
						(!on.map || on.map === o.to),
				);
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
