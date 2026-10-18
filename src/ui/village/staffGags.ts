// 施設の 人の 寸劇（data/village/staffGags.ts）。1回の 帰りに 1人 1本、上から 順に。見た ものは くり返さない。
// まだ もぐって いない あいだは 出さない。見た 数と 帰りは 村の 印として 別の 保存場所に 残す
// （保存できなくても この回は 覚えている）。

import { STAFF_GAGS } from "../../data/village/staffGags";
import type { Story } from "../../engine/defs";
import { returnAt } from "./guests";

const KEY = "kiriko-roguelike/staffGags";

type Memo = {
	/** 見た 寸劇の 数（次に 出す 順番）。 */
	n: Record<string, number>;
	/** 寸劇を 見た 帰り。 */
	at: Record<string, number>;
};

let memo: Memo = { n: {}, at: {} };

const nums = (o: unknown): Record<string, number> => {
	const out: Record<string, number> = {};
	if (o && typeof o === "object")
		for (const [k, v] of Object.entries(o))
			if (typeof v === "number") out[k] = v;
	return out;
};

const load = (): Memo => {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const o = JSON.parse(raw) as Record<string, unknown>;
			return { n: nums(o.n), at: nums(o.at) };
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
export const forgetStaffGags = (): void => {
	memo = { n: {}, at: {} };
};

/** この 帰りに まだ 見て いない 寸劇が あれば 演じて true。 */
export const staffGag = async (
	s: Story,
	fid: string,
	pid: string,
	name: string,
): Promise<boolean> => {
	const at = returnAt();
	const key = `${fid}/${pid}`;
	const v = load();
	const i = v.n[key] ?? 0;
	const g = STAFF_GAGS[key]?.[i];
	if (!at || !g || v.at[key] === at) return false;
	v.n[key] = i + 1;
	v.at[key] = at;
	save(v);
	for (const l of g) {
		if (l.who === "staff") await s.say("nanj", l.text, { name });
		else if (l.who === "kiriko") await s.kiriko(l.text, "voice");
		else await s.narrate(l.text);
	}
	return true;
};
