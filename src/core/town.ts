// 地上の町（トルネコ1の「店」にあたる）。帰還スレで持ち帰った道具を「売った」分だけ育つ。
//
// - 段は 0〜7。1回の帰りで 上がるのは 1段まで（トルネコ1と同じ）。段1（屋台）は ちょっと を持ち帰ると開く。
// - 過去ログの底 を持ち帰ると いちばん上の段へ（トルネコ1の しあわせの箱 と同じ）。
// - 段4 で倉庫が開き、倉庫の道具を 過去ログの底 へ 1〜4個 持ちこめる（ちょっと・もっと には持ちこめない）。
// - 倒れたら 持ち物は ぜんぶ なくなる（持ちこんだ道具も）。町は 見た目と会話と 倉庫・持ちこみだけ。
// 状態（売上・段・倉庫）は engine/save.ts が持つ。ここは 決まりだけ（DOM に触らない。テストできる）。

import { defOf } from "./item";
import type { DungeonId, Item } from "./types";

export const TOWN_STAGES = 8;

/** 段 → その段になるのに要る 売上の合計（段1 は ちょっと を持ち帰ったとき。売上は要らない）。 */
export const STAGE_POINTS: readonly number[] = [
	0, 0, 300, 1000, 2500, 5000, 10000, 20000,
];

/** 段 → 倉庫に あずけられる数。 */
export const STORAGE_CAP: readonly number[] = [0, 0, 0, 0, 10, 20, 40, 60];

/** 段 → 1回の冒険に 持ちこめる数。 */
export const CARRY_MAX: readonly number[] = [0, 0, 0, 0, 1, 2, 3, 4];

/** 持ちこめるダンジョン（トルネコ1の 不思議 と同じく 本編だけ）。 */
export const CARRY_DUNGEON: DungeonId = "main";

/** 道具の値段（売ったときに 町の売上になる。トルネコ1の売値に寄せた目安）。 */
const PRICE: Record<string, number> = {
	// 武器
	club: 50,
	copper: 200,
	bat: 400,
	wyrmbane: 1500,
	steel: 1000,
	starsword: 2500,
	mic: 5000,
	// 盾
	leather: 150,
	bronze: 200,
	scale: 500,
	mirror: 1200,
	steelsh: 1000,
	fireward: 1500,
	starshield: 3000,
	// 指輪
	r_might: 2000,
	r_sustain: 3000,
	r_hunger: 200,
	r_trap: 2000,
	r_awake: 1000,
	r_purity: 1000,
	r_stealth: 2000,
	r_clamor: 200,
	r_ward: 2500,
	// 草
	h_heal: 50,
	h_greater: 150,
	h_poison: 10,
	h_might: 300,
	h_growth: 1000,
	h_swift: 200,
	h_blind: 20,
	h_blink: 100,
	h_reel: 20,
	h_sleep: 20,
	h_antidote: 50,
	h_fire: 200,
	h_sight: 100,
	// スレ
	s_appraise: 100,
	s_whet: 300,
	s_temper: 300,
	s_uncurse: 300,
	s_rustproof: 300,
	s_map: 200,
	s_sense: 200,
	s_treasure: 200,
	s_hold: 250,
	s_blast: 400,
	s_ward: 1000,
	s_recharge: 500,
	s_bread: 200,
	s_snare: 20,
	s_escape: 500,
	// 杖（残りの回数ぶん 足す）
	w_bolt: 500,
	w_reel: 400,
	w_sleep: 500,
	w_seal: 600,
	w_change: 400,
	w_send: 500,
	w_slow: 400,
	w_edge: 800,
	w_split: 100,
	w_haste: 100,
	// 矢（1本）
	a_wood: 5,
	a_iron: 15,
	// 食べもの
	f_bread: 20,
	f_large: 60,
	f_moldy: 5,
};

/** 1つの道具の値段（修正値・残りの回数・本数・のろいも入れる）。目的の品は売らない（0）。 */
export const priceOf = (it: Item): number => {
	const d = defOf(it.kind);
	if (d.cat === "goal") return 0;
	let v = PRICE[it.kind] ?? 0;
	if (d.cat === "weapon" || d.cat === "shield") v += it.plus * 200;
	if (d.cat === "staff") v += it.charges * 50;
	if (d.cat === "arrow") v *= it.count;
	if (it.cursed) v = Math.floor(v / 2);
	return Math.max(1, v);
};

/** 値段が決まっている種類（テスト用）。 */
export const pricedKinds = (): string[] => Object.keys(PRICE);

/**
 * 帰ってきたあとの段。1回の帰りで 上がるのは 1段まで。
 * 過去ログの底 を持ち帰ったら いちばん上へ。ちょっと を持ち帰ったら 少なくとも 段1（屋台）。
 */
export const nextStage = (
	stage: number,
	points: number,
	opt: { shallowCleared: boolean; mainCleared: boolean },
): number => {
	if (opt.mainCleared) return TOWN_STAGES - 1;
	let reach = 0;
	for (let i = 1; i < TOWN_STAGES; i++)
		if (
			points >= STAGE_POINTS[i] &&
			(i > 1 || opt.shallowCleared || points > 0)
		)
			reach = i;
	if (opt.shallowCleared) reach = Math.max(reach, 1);
	return Math.max(stage, Math.min(reach, stage + 1));
};
