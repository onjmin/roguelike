// 同行の 依頼の 進み（data/people/companions.ts）。localStorage の kiriko-roguelike/escort に 1つ。
// - accepted：引き受けている 依頼（1つまで）。その 板へ 出ると 依頼主が ついてくる。
// - reached：見たかった 階まで 連れていった 依頼（冒険が 終わった とき。次に 村に 入ると お礼）。
// - done：お礼まで すんだ 依頼（もう 掲示板に 出ない）。
// 読めない・書けない ときは はじめから（遊べる）。

import type { GuestId } from "../core/types";
import { escortById } from "../data/people/companions";

const KEY = "kiriko-roguelike/escort";

export type EscortMemo = {
	accepted: string | null;
	reached: string | null;
	done: string[];
};

const fresh = (): EscortMemo => ({ accepted: null, reached: null, done: [] });

export const loadEscort = (): EscortMemo => {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
		if (!raw || typeof raw !== "object") return fresh();
		return {
			accepted: escortById(raw.accepted) ? raw.accepted : null,
			reached: escortById(raw.reached) ? raw.reached : null,
			done: Array.isArray(raw.done)
				? raw.done.filter((x: unknown) => typeof x === "string")
				: [],
		};
	} catch {
		return fresh();
	}
};

const saveEscort = (m: EscortMemo): void => {
	try {
		localStorage.setItem(KEY, JSON.stringify(m));
	} catch {
		// 残せなくても 遊べる
	}
};

/** 依頼を 引き受ける（前の 依頼は とりやめ）。 */
export const acceptEscort = (id: string): void => {
	const m = loadEscort();
	m.accepted = id;
	saveEscort(m);
};

/** 依頼を とりやめる。 */
export const dropEscort = (): void => {
	const m = loadEscort();
	m.accepted = null;
	saveEscort(m);
};

/**
 * 冒険が 終わった（engine/save.ts の saveRun）：同行者が 見たかった 階まで 行けたら、引き受けていた 依頼を はたした ことに。
 */
export const noteEscortRun = (
	guest: { id: GuestId; done?: true } | undefined,
): void => {
	if (!guest?.done) return;
	const m = loadEscort();
	const e = escortById(m.accepted);
	if (!e || e.who !== guest.id) return;
	m.reached = e.id;
	m.accepted = null;
	saveEscort(m);
};

/** お礼の 場面を 見せる 依頼（村に 入った とき。見せおえたら doneEscortThanks）。 */
export const pendingThanks = (): string | null => loadEscort().reached;

export const doneEscortThanks = (): void => {
	const m = loadEscort();
	if (!m.reached) return;
	if (!m.done.includes(m.reached)) m.done.push(m.reached);
	m.reached = null;
	saveEscort(m);
};
