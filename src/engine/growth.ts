// 主人公ごと・板ごとの 成長（キリコ・ロゼ・ゼロの レベル・経験値・レベルアップで のびた 最大HP）。
// 冒険が 終わる たびに（持ち帰った・倒れた・やめた）その 板の ぶんを 残し、同じ 板に 入りなおすと その レベルから
// 始まる（作者の 指示：入りなおしても 上げた レベルを もどさない）。別の 板へは 引きつがない（作者の 指示：
// 引きつぐと ヌルゲーに なる。2026-10-12）。レベルを もどす 板（core/data/dungeons.ts の resetLevel：
// 99階の 井戸の 底・裏シナリオの 板）は いつも レベル1 から。
// 成長の実などで のびた 最大HP・ちからは 持ち帰らない（その 冒険の 中だけ）。
// localStorage の kiriko-roguelike/growth に 主人公ごとに 持つ。保存できなくても この回は 写しで 覚えている。

import { EXP_AT, MAX_HP_CAP, MAX_LV } from "../core/balance";
import { DUNGEON_IDS, dungeonById } from "../core/data/dungeons";
import { type HeroId, isHeroId } from "../core/data/heroes";
import type { DungeonId, Growth, RunState } from "../core/types";

/** 板ごとに 分けた 版（前の 版の 主人公ごとの 1つは 読まない：どの 板の ものか わからない）。 */
const KEY = "kiriko-roguelike/growth2";

type Saved = Partial<Record<HeroId, Partial<Record<DungeonId, Growth>>>>;
let memo: Saved | null = null;

const isGrowth = (g: unknown): g is Growth => {
	if (!g || typeof g !== "object") return false;
	const o = g as Partial<Growth>;
	return (
		Number.isInteger(o.lv) &&
		Number.isInteger(o.exp) &&
		Number.isInteger(o.hp) &&
		(o.lv as number) >= 1 &&
		(o.lv as number) <= MAX_LV &&
		(o.exp as number) >= 0 &&
		(o.hp as number) >= 0 &&
		(o.hp as number) <= MAX_HP_CAP
	);
};

const load = (): Saved => {
	if (memo) return memo;
	const out: Saved = {};
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
		if (raw && typeof raw === "object")
			for (const [h, byBoard] of Object.entries(raw)) {
				if (!isHeroId(h) || !byBoard || typeof byBoard !== "object") continue;
				const mine: Partial<Record<DungeonId, Growth>> = {};
				for (const [d, g] of Object.entries(byBoard))
					if (DUNGEON_IDS.includes(d as DungeonId) && isGrowth(g))
						mine[d as DungeonId] = g;
				out[h] = mine;
			}
	} catch {
		// 読めなければ みんな レベル1
	}
	memo = out;
	return out;
};

/** 試験用：この回の 写しを 忘れる。 */
export const forgetGrowthMemo = (): void => {
	memo = null;
};

const LV1: Growth = { lv: 1, exp: 0, hp: 0 };

/** その 主人公の その 板での 成長（まだ 潜って いない・レベルを もどす 板なら レベル1）。 */
export const loadGrowth = (h: HeroId, d: DungeonId): Growth =>
	dungeonById(d).resetLevel ? LV1 : (load()[h]?.[d] ?? LV1);

/** いま 何レベルか（行き先の 札に 出す）。 */
export const heroLevel = (h: HeroId, d: DungeonId): number =>
	loadGrowth(h, d).lv;

/**
 * 冒険が 終わった（engine/save.ts の saveRun。同じ 終わりは 1回だけ）。主人公の その 板での 成長を 残す。
 * レベルを もどす 板・書きかえた 冒険（engine/tamper.ts）は 残さない。
 */
export const noteGrowth = (s: RunState): void => {
	if (!s.end || s.cheat || dungeonById(s.dungeon).resetLevel) return;
	const h: HeroId = s.hero ?? "kiriko";
	const p = s.player;
	// 経験値は いまの レベルに 足りる ぶんだけ（レベルを 吸われて 下がった ときの 端数を そろえる）
	const lv = Math.max(1, Math.min(MAX_LV, p.lv));
	const g: Growth = {
		lv,
		exp: Math.max(lv > 1 ? (EXP_AT[lv - 1] ?? 0) : 0, Math.floor(p.exp)),
		hp: Math.max(0, Math.min(MAX_HP_CAP, p.lvHp ?? 0)),
	};
	const all = load();
	const next: Saved = { ...all, [h]: { ...(all[h] ?? {}), [s.dungeon]: g } };
	memo = next;
	try {
		localStorage.setItem(KEY, JSON.stringify(next));
	} catch {
		// 保存できなくても この回は 写しで 覚えている
	}
};
