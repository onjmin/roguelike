// 地上の町（トルネコ1の「店」にあたる）。帰還スレで持ち帰った道具を「売った」分だけ育つ。
//
// - 段は 0〜7。1回の帰りで 上がるのは 1段まで（トルネコ1と同じ）。段1（屋台）は ちょっと を持ち帰ると開く。
// - 段の あいだは 小段（TOWN_STEPS）で 刻む。小段ごとに 住人が 1人 越してくる（data/mobs.ts の from）。
// - 電池板 を持ち帰ると いちばん上の段へ（トルネコ1の しあわせの箱 と同じ。STORY.md §5 の 転）。
// - 段2 で倉庫（小さな 物置）が開き、段で 広がる（段7 は 銀行の 貸金庫）。倉庫の道具を 1〜4個 持ちこめる
//   （ちょっと・もっと には持ちこめない）。
// - 倒れたら 持ち物は ぜんぶ なくなる（持ちこんだ道具も）。町は 見た目と会話と 倉庫・持ちこみだけ。
// 状態（売上・段・倉庫）は engine/save.ts が持つ。ここは 決まりだけ（DOM に触らない。テストできる）。

import { defOf } from "./item";
import type { Item } from "./types";

export const TOWN_STAGES = 8;

/**
 * 町の 小段（段＝建物の あいだを 刻む。建物の 段の あとに 2つずつ、住人が 1人ずつ 越してくる）。
 * stage は その 小段が 属する 建物の 段、points は そこまでに 要る 売上の 合計。
 * 1段ごとの 差は 前の 約1.1倍（はじめは 3000円。ボットの 1回の 帰りの 売上は パン板 約5000・深い 板 約8000〜10000
 * （scripts/sales-sim.mjs）なので、はじめは 帰り 1回ほど、終わりの ほうは 2〜3回ほどで 1段）。
 * 建物の 段は 1回の 帰りで 1つまで（nextStage）、小段は その 段の 中なら 何段でも まとめて 上がる。
 * 建物の 段を こえて いれば、その 前の 小段は みんな 済み（電池板で いちどに 最上段に なった ときも 住人は そろう）。
 */
export const TOWN_STEPS: readonly { stage: number; points: number }[] = [
	{ stage: 0, points: 0 }, // 空き地
	{ stage: 1, points: 0 }, // 屋台（パン板を 持ち帰ると）
	{ stage: 1, points: 3000 },
	{ stage: 2, points: 6300 }, // 屋根つき屋台
	{ stage: 2, points: 9900 },
	{ stage: 2, points: 13900 },
	{ stage: 3, points: 18300 }, // 小屋
	{ stage: 3, points: 23100 },
	{ stage: 3, points: 28500 },
	{ stage: 4, points: 34300 }, // 倉庫
	{ stage: 4, points: 40700 },
	{ stage: 4, points: 47800 },
	{ stage: 5, points: 55600 }, // 小さな店
	{ stage: 5, points: 64200 },
	{ stage: 5, points: 73600 },
	{ stage: 6, points: 83900 }, // 倉庫Part2
	{ stage: 6, points: 95300 },
	{ stage: 6, points: 107800 },
	{ stage: 7, points: 121600 }, // 大きな店
	{ stage: 7, points: 136800 },
	{ stage: 7, points: 153500 },
];

/** 段 → その段になるのに要る 売上の合計（小段の 表の 建物の 段。段1 は パン板を持ち帰ったとき。売上は要らない）。 */
export const STAGE_POINTS: readonly number[] = Array.from(
	{ length: TOWN_STAGES },
	(_, s) => TOWN_STEPS.find((x) => x.stage === s)?.points ?? 0,
);

/** いまの 小段（段と 売上から。段を こえた 小段は 済み、いまの 段の 小段は 売上しだい）。 */
export const townStep = (stage: number, points: number): number => {
	let at = 0;
	TOWN_STEPS.forEach((x, i) => {
		// 段の はじめの 小段（建物）は 段に なれば 済み（電池板で いちどに 上がった ときも）
		const building = i === 0 || TOWN_STEPS[i - 1].stage !== x.stage;
		if (
			x.stage < stage ||
			(x.stage === stage && (building || points >= x.points))
		)
			at = i;
	});
	return at;
};

/** その 段で いちばん 上の 小段（開発用の 下見・試験で 段だけ 決めたとき。その段の 住人は みんな いる）。 */
export const lastStepOf = (stage: number): number => {
	let at = 0;
	TOWN_STEPS.forEach((x, i) => {
		if (x.stage <= stage) at = i;
	});
	return at;
};

/** 段 → 倉庫に あずけられる数。 */
export const STORAGE_CAP: readonly number[] = [0, 0, 3, 5, 10, 20, 40, 60];

/**
 * 段 → 倉庫から 引き取って 1回の冒険に 持ちこめる数。持ちこめない 板は core/data/dungeons.ts の noCarry。
 */
export const CARRY_MAX: readonly number[] = [0, 0, 1, 1, 1, 2, 3, 4];

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
	r_hunger: 500,
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
 * 電池板 を持ち帰ったら いちばん上へ（STORY.md §5 の 転：村が いちばん にぎやかに なる）。
 * パン板 を持ち帰ったら 少なくとも 段1（屋台）。
 */
export const nextStage = (
	stage: number,
	points: number,
	opt: { shallowCleared: boolean; topCleared: boolean },
): number => {
	if (opt.topCleared) return TOWN_STAGES - 1;
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
