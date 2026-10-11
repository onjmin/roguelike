// 主人公ごとの 成長（キリコ・ロゼ・ゼロの レベル・経験値・レベルアップで のびた 最大HP）。
// 冒険が 終わる たびに（持ち帰った・倒れた・やめた）残し、次の 冒険は その レベルから 始まる（作者の 指示：
// 入りなおしても 上げた レベルを もどさない）。ただし レベルを もどす 板（core/data/dungeons.ts の resetLevel：
// 99階の 井戸の 底・裏シナリオの 板）は レベル1 から 始まり、その 中で 上げた ぶんも 持ち帰らない。
// 成長の実などで のびた 最大HP・ちからは 持ち帰らない（その 冒険の 中だけ）。
// localStorage の kiriko-roguelike/growth に 主人公ごとに 持つ。保存できなくても この回は 写しで 覚えている。

import { EXP_AT, MAX_HP_CAP, MAX_LV } from "../core/balance";
import { dungeonById } from "../core/data/dungeons";
import { type HeroId, isHeroId } from "../core/data/heroes";
import type { Growth, RunState } from "../core/types";

const KEY = "kiriko-roguelike/growth";

type Saved = Partial<Record<HeroId, Growth>>;
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
			for (const [k, v] of Object.entries(raw))
				if (isHeroId(k) && isGrowth(v)) out[k] = v;
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

/** その 主人公の 成長（まだ 冒険して いなければ レベル1）。 */
export const loadGrowth = (h: HeroId): Growth =>
	load()[h] ?? { lv: 1, exp: 0, hp: 0 };

/** いま 何レベルか（行き先の 札に 出す）。 */
export const heroLevel = (h: HeroId): number => loadGrowth(h).lv;

/**
 * 冒険が 終わった（engine/save.ts の saveRun。同じ 終わりは 1回だけ）。主人公の 成長を 残す。
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
	const all = { ...load(), [h]: g };
	memo = all;
	try {
		localStorage.setItem(KEY, JSON.stringify(all));
	} catch {
		// 保存できなくても この回は 写しで 覚えている
	}
};
