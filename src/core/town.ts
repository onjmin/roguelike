// 地上の町（STORY.md §5・TOWN.md §0）。町は はじめから 都市の 姿で、まだ 生き返って いない 店は シャッター。
// 町の 段（0〜7）：本筋の 板を 持ち帰ると 上がる（data/town/revival.ts の stageOfCleared）。
// 店が 開くのは 段では なく、板ごとに 生き返る 通り（同じ revival.ts。TOWN.md §0.6）。
//
// - 持ち帰った 物は 買い取り屋で 売る（売上。財布の お金：engine/wallet.ts）。
// - 機材倉庫は はじめから ある。開いた 段で 広がる（STORAGE_CAP）。倉庫の道具を 1〜4個 持ちこめる
//   （持ちこめない 板は core/data/dungeons.ts の noCarry）。
// - 倒れたら 持ち物は ぜんぶ なくなる（持ちこんだ道具も）。
// 状態（売上・段・倉庫）は engine/save.ts が持つ。ここは 決まりだけ（DOM に触らない。テストできる）。

import { defOf } from "./item";
import type { Item } from "./types";

export const TOWN_STAGES = 8;

/** 段 → 倉庫に あずけられる数（機材倉庫は はじめから ある）。 */
export const STORAGE_CAP: readonly number[] = [3, 3, 3, 5, 10, 20, 40, 60];

/**
 * 段 → 倉庫から 引き取って 1回の冒険に 持ちこめる数。持ちこめない 板は core/data/dungeons.ts の noCarry。
 */
export const CARRY_MAX: readonly number[] = [1, 1, 1, 1, 1, 2, 3, 4];

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
	// 支給品（たおれた あとの ぷゆゆソード）は 売っても 0（priceOf）
	puyusword: 0,
	steelsh: 1000,
	fireward: 1500,
	starshield: 3000,
	// 指輪
	r_might: 2000,
	r_sustain: 3000,
	r_hunger: 500,
	r_trap: 2000,
	r_awake: 1000,
	r_purity: 1000,
	r_stealth: 2000,
	r_clamor: 200,
	r_ward: 2500,
	r_patrol: 500,
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
	h_daze: 20,
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
	s_gacha: 1000,
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
	w_batsu: 100,
	w_afi: 100,
	w_totsu: 200,
	w_rebut: 1500,
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
	// 目的の品と 支給品（ぷゆゆソード）は 売れない
	if (d.cat === "goal" || d.relief) return 0;
	let v = PRICE[it.kind] ?? 0;
	if (d.cat === "weapon" || d.cat === "shield") v += it.plus * 200;
	if (d.cat === "staff") v += it.charges * 50;
	if (d.cat === "arrow") v *= it.count;
	if (it.cursed) v = Math.floor(v / 2);
	return Math.max(1, v);
};

/** 値段が決まっている種類（テスト用）。 */
export const pricedKinds = (): string[] => Object.keys(PRICE);
