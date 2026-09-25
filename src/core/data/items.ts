// 道具の定義と山札（1回の冒険で出る道具の、中身の決まった束）。
//
// トルネコ1（不思議・もっと不思議）の顔ぶれと数値に寄せ、DQ の固有名は使わない。
// 説明文は一覧の2行目に出るので、単語の間を全角スペースで区切る（折り返しの位置になる）。

import type { DeckEntry } from "../deck";
import type { ItemCat, ItemDef } from "../types";

const defs: ItemDef[] = [];
let order = 0;
const add = (d: Omit<ItemDef, "order">): void => {
	defs.push({ ...d, order: order++ });
};

// ───────── 武器（強さ。修正値は装備か識別でわかる） ─────────
add({
	id: "club",
	cat: "weapon",
	name: "こん棒",
	atk: 1,
	desc: "木を　けずった　棒",
});
add({
	id: "copper",
	cat: "weapon",
	name: "銅の剣",
	atk: 3,
	desc: "ありふれた　剣",
});
add({
	id: "bat",
	cat: "weapon",
	name: "金属バット",
	atk: 4,
	desc: "よく　しなる　バット",
});
add({
	id: "wyrmbane",
	cat: "weapon",
	name: "竜断ちの剣",
	atk: 5,
	desc: "竜には　ダメージが　2倍",
});
add({
	id: "steel",
	cat: "weapon",
	name: "鋼の剣",
	atk: 6,
	desc: "よく　切れる　剣",
});
add({
	id: "starsword",
	cat: "weapon",
	name: "星鉄の剣",
	atk: 7,
	desc: "空から　落ちた　鉄の剣",
});
add({
	id: "mic",
	cat: "weapon",
	name: "マイクスタンド",
	atk: 10,
	desc: "いちばん　重くて　いちばん　強い",
});

// ───────── 盾 ─────────
add({
	id: "leather",
	cat: "shield",
	name: "革の盾",
	def: 2,
	desc: "錆びない。おなかが　へりにくい",
});
add({
	id: "bronze",
	cat: "shield",
	name: "青銅の盾",
	def: 3,
	desc: "ありふれた　盾",
});
add({
	id: "scale",
	cat: "shield",
	name: "うろこの盾",
	def: 4,
	desc: "毒で　ちからを　下げられない",
});
add({
	id: "mirror",
	cat: "shield",
	name: "鏡銀の盾",
	def: 5,
	desc: "錆びない",
});
add({
	id: "steelsh",
	cat: "shield",
	name: "鋼の盾",
	def: 6,
	desc: "かたい　盾",
});
add({
	id: "fireward",
	cat: "shield",
	name: "耐火の盾",
	def: 7,
	desc: "炎の　ダメージが　半分",
});
add({
	id: "starshield",
	cat: "shield",
	name: "星鉄の盾",
	def: 10,
	desc: "空から　落ちた　鉄の盾",
});

// ───────── 指輪（未識別） ─────────
add({
	id: "r_might",
	cat: "ring",
	name: "剛力の指輪",
	desc: "ちからが　3　上がる（のろいなら　下がる）",
});
add({
	id: "r_sustain",
	cat: "ring",
	name: "不食の指輪",
	desc: "おなかが　へらない",
});
add({
	id: "r_hunger",
	cat: "ring",
	name: "大食らいの指輪",
	desc: "おなかが　2倍　へる",
});
add({
	id: "r_trap",
	cat: "ring",
	name: "罠よけの指輪",
	desc: "罠に　かからない",
});
add({
	id: "r_awake",
	cat: "ring",
	name: "不眠の指輪",
	desc: "眠らなくなる",
});
add({
	id: "r_purity",
	cat: "ring",
	name: "解毒の指輪",
	desc: "ちからを　下げられない",
});
add({
	id: "r_stealth",
	cat: "ring",
	name: "忍び足の指輪",
	desc: "眠っている　敵が　起きない",
});
add({
	id: "r_clamor",
	cat: "ring",
	name: "騒音の指輪",
	desc: "眠っている　敵が　すぐ起きる",
});
add({
	id: "r_ward",
	cat: "ring",
	name: "守りの指輪",
	desc: "レベルや　最大HPを　下げられない",
});

// ───────── 草・実（未識別） ─────────
add({
	id: "h_heal",
	cat: "herb",
	name: "薬草",
	desc: "HPが　25　回復（満タンなら　最大HP＋1）",
});
add({
	id: "h_greater",
	cat: "herb",
	name: "大薬草",
	desc: "HPが　100　回復（満タンなら　最大HP＋2）",
});
add({
	id: "h_poison",
	cat: "herb",
	name: "毒草",
	desc: "HPが　5　へり、ちからが　3　下がる",
});
add({
	id: "h_might",
	cat: "herb",
	name: "ちからの実",
	desc: "ちからが　1　上がる",
});
add({
	id: "h_growth",
	cat: "herb",
	name: "成長の実",
	desc: "レベルが　1　上がる",
});
add({
	id: "h_swift",
	cat: "herb",
	name: "疾風の実",
	desc: "しばらく　倍速で　動ける",
});
add({
	id: "h_blind",
	cat: "herb",
	name: "暗闇草",
	desc: "目が　見えなくなる。投げると　敵の目を　ふさぐ",
});
add({
	id: "h_blink",
	cat: "herb",
	name: "跳び草",
	desc: "この階の　どこかへ　跳ぶ",
});
add({
	id: "h_reel",
	cat: "herb",
	name: "千鳥草",
	desc: "混乱する。投げると　敵を　混乱させる",
});
add({
	id: "h_sleep",
	cat: "herb",
	name: "眠り草",
	desc: "眠ってしまう。投げると　敵を　眠らせる",
});
add({
	id: "h_antidote",
	cat: "herb",
	name: "解毒草",
	desc: "下がった　ちからが　元にもどる",
});
add({
	id: "h_fire",
	cat: "herb",
	name: "火吹き草",
	desc: "前に　炎を　吐く（足元の道具も　燃える）",
});
add({
	id: "h_sight",
	cat: "herb",
	name: "見透し草",
	desc: "この階の　罠と　見えない敵が　見える",
});

// ───────── スレ（巻物にあたる。未識別） ─────────
add({
	id: "s_appraise",
	cat: "scroll",
	name: "鑑定スレ",
	desc: "道具を　1つ　識別する",
});
add({
	id: "s_whet",
	cat: "scroll",
	name: "研ぎスレ",
	desc: "装備中の　武器が　＋1。のろいも　とける",
});
add({
	id: "s_temper",
	cat: "scroll",
	name: "鍛えスレ",
	desc: "装備中の　盾が　＋1。のろいも　とける",
});
add({
	id: "s_uncurse",
	cat: "scroll",
	name: "解呪スレ",
	desc: "装備の　のろいを　とく",
});
add({
	id: "s_rustproof",
	cat: "scroll",
	name: "防錆スレ",
	desc: "装備中の　盾が　錆びなくなる",
});
add({
	id: "s_map",
	cat: "scroll",
	name: "地図スレ",
	desc: "この階の　地形と　罠が　わかる",
});
add({
	id: "s_sense",
	cat: "scroll",
	name: "気配スレ",
	desc: "この階の　敵の　いる所が　わかる",
});
add({
	id: "s_treasure",
	cat: "scroll",
	name: "宝探しスレ",
	desc: "この階の　道具の　ある所が　わかる",
});
add({
	id: "s_hold",
	cat: "scroll",
	name: "金縛りスレ",
	desc: "まわりの　敵が　動けなくなる",
});
add({
	id: "s_blast",
	cat: "scroll",
	name: "炎上スレ",
	desc: "部屋じゅうの　敵に　ダメージ",
});
add({
	id: "s_ward",
	cat: "scroll",
	name: "結界スレ",
	desc: "読むと　足元が　結界になる。その上では　となりから　なぐられない",
});
add({
	id: "s_recharge",
	cat: "scroll",
	name: "充填スレ",
	desc: "杖を　1本　えらんで　回数を　ふやす",
});
add({
	id: "s_bread",
	cat: "scroll",
	name: "飯テロスレ",
	desc: "道具を　1つ　えらんで　大きなパンに　変える",
});
add({
	id: "s_snare",
	cat: "scroll",
	name: "釣りスレ",
	desc: "この階に　罠が　ふえる",
});
add({
	id: "s_escape",
	cat: "scroll",
	name: "帰還スレ",
	desc: "読むと　その場で　地上へ　もどる。持ち帰る品を　持っていると　きかない",
});

// ───────── 杖（未識別。前に魔法の弾を撃つ。投げても効く） ─────────
add({
	id: "w_bolt",
	cat: "staff",
	name: "雷の杖",
	charges: [4, 6],
	desc: "敵に　20　前後の　ダメージ（かならず　当たる）",
});
add({
	id: "w_reel",
	cat: "staff",
	name: "混乱の杖",
	charges: [4, 6],
	desc: "敵を　混乱させる",
});
add({
	id: "w_sleep",
	cat: "staff",
	name: "眠りの杖",
	charges: [3, 6],
	desc: "敵を　眠らせる",
});
add({
	id: "w_seal",
	cat: "staff",
	name: "封印の杖",
	charges: [5, 8],
	desc: "敵の　とくぎを　封じる",
});
add({
	id: "w_change",
	cat: "staff",
	name: "変化の杖",
	charges: [3, 6],
	desc: "敵を　ほかの　敵に　変える",
});
add({
	id: "w_send",
	cat: "staff",
	name: "転送の杖",
	charges: [3, 5],
	desc: "敵を　この階の　どこかへ　飛ばす",
});
add({
	id: "w_slow",
	cat: "staff",
	name: "鈍足の杖",
	charges: [3, 5],
	desc: "敵を　鈍足にする",
});
add({
	id: "w_edge",
	cat: "staff",
	name: "諸刃の杖",
	charges: [3, 5],
	desc: "自分の　HPが　半分になり、敵の　HPが　1になる",
});
add({
	id: "w_split",
	cat: "staff",
	name: "分裂の杖",
	charges: [3, 5],
	desc: "敵が　2匹に　ふえる",
});
add({
	id: "w_haste",
	cat: "staff",
	name: "加速の杖",
	charges: [3, 6],
	desc: "敵が　倍速になる",
});

// ───────── 矢（束。投げると1本ずつ飛ぶ） ─────────
add({
	id: "a_wood",
	cat: "arrow",
	name: "木の矢",
	atk: 4,
	desc: "投げると　1本ずつ　飛ぶ。外れた矢は　ひろえる",
});
add({
	id: "a_iron",
	cat: "arrow",
	name: "鉄の矢",
	atk: 12,
	desc: "投げると　1本ずつ　飛ぶ。外れた矢は　ひろえる",
});

// ───────── 食べもの ─────────
add({ id: "f_bread", cat: "food", name: "パン", desc: "満腹度が　50　回復" });
add({
	id: "f_large",
	cat: "food",
	name: "大きなパン",
	desc: "満腹度が　100　回復",
});
add({
	id: "f_moldy",
	cat: "food",
	name: "くさったパン",
	desc: "満腹度が　100　回復。ちからが　1　下がり、HPも　へる",
});

// ───────── 目的の品（山札には入らない） ─────────
add({
	id: "genban",
	cat: "goal",
	name: "はじまりの原盤",
	desc: "いちばん底に　あった　レコード。持ち帰ろう",
});
add({
	id: "needle",
	cat: "goal",
	name: "蓄音機の針",
	desc: "ちょっと下に　落ちていた　針。持ち帰ろう",
});
add({
	id: "tsuzuki",
	cat: "goal",
	name: "つづきの原盤",
	desc: "底の　さらに　下の　レコード。まだ、なにも　入っていない",
});

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
	defs.map((d) => [d.id, d]),
);
export const ITEM_LIST: readonly ItemDef[] = defs;

export const itemsOfCat = (cat: ItemCat): ItemDef[] =>
	defs.filter((d) => d.cat === cat);

/**
 * 本編（過去ログの底）の山札の中身（毎回同じ。並びだけ冒険ごとに切る）。全141枚。
 * トルネコ1の出現率（/256）を、階の数と「数えて識別できる」ことに合わせて丸めたもの。
 * ほかのダンジョンの山札は data/dungeons.ts。
 */
export const MAIN_DECK: readonly DeckEntry[] = [
	// 武器 10
	{ kind: "club", count: 2 },
	{ kind: "copper", count: 2 },
	{ kind: "bat", count: 2 },
	{ kind: "wyrmbane", count: 1 },
	{ kind: "steel", count: 1 },
	{ kind: "starsword", count: 1 },
	{ kind: "mic", count: 1 },
	// 盾 10
	{ kind: "leather", count: 2 },
	{ kind: "bronze", count: 2 },
	{ kind: "scale", count: 2 },
	{ kind: "mirror", count: 1 },
	{ kind: "steelsh", count: 1 },
	{ kind: "fireward", count: 1 },
	{ kind: "starshield", count: 1 },
	// 指輪 10
	{ kind: "r_might", count: 2 },
	{ kind: "r_sustain", count: 1 },
	{ kind: "r_hunger", count: 1 },
	{ kind: "r_trap", count: 1 },
	{ kind: "r_awake", count: 1 },
	{ kind: "r_purity", count: 1 },
	{ kind: "r_stealth", count: 1 },
	{ kind: "r_clamor", count: 1 },
	{ kind: "r_ward", count: 1 },
	// 草・実 45
	{ kind: "h_heal", count: 10 },
	{ kind: "h_greater", count: 4 },
	{ kind: "h_poison", count: 3 },
	{ kind: "h_might", count: 4 },
	{ kind: "h_growth", count: 1 },
	{ kind: "h_swift", count: 2 },
	{ kind: "h_blind", count: 3 },
	{ kind: "h_blink", count: 4 },
	{ kind: "h_reel", count: 3 },
	{ kind: "h_sleep", count: 3 },
	{ kind: "h_antidote", count: 3 },
	{ kind: "h_fire", count: 3 },
	{ kind: "h_sight", count: 2 },
	// スレ 38
	{ kind: "s_appraise", count: 8 },
	{ kind: "s_whet", count: 3 },
	{ kind: "s_temper", count: 3 },
	{ kind: "s_uncurse", count: 2 },
	{ kind: "s_rustproof", count: 2 },
	{ kind: "s_map", count: 3 },
	{ kind: "s_sense", count: 2 },
	{ kind: "s_treasure", count: 2 },
	{ kind: "s_hold", count: 3 },
	{ kind: "s_blast", count: 3 },
	{ kind: "s_ward", count: 1 },
	{ kind: "s_recharge", count: 2 },
	{ kind: "s_bread", count: 2 },
	{ kind: "s_snare", count: 2 },
	// 帰還 3（リレミトにあたる。読むと その場で地上へ。持ちこみ・倉庫に つながる）
	{ kind: "s_escape", count: 3 },
	// 杖 10
	{ kind: "w_bolt", count: 1 },
	{ kind: "w_reel", count: 1 },
	{ kind: "w_sleep", count: 1 },
	{ kind: "w_seal", count: 1 },
	{ kind: "w_change", count: 1 },
	{ kind: "w_send", count: 1 },
	{ kind: "w_slow", count: 1 },
	{ kind: "w_edge", count: 1 },
	{ kind: "w_split", count: 1 },
	{ kind: "w_haste", count: 1 },
	// 矢 6
	{ kind: "a_wood", count: 4 },
	{ kind: "a_iron", count: 2 },
	// 食べもの 12
	{ kind: "f_bread", count: 7 },
	{ kind: "f_large", count: 3 },
	{ kind: "f_moldy", count: 2 },
];

/** カテゴリの表示名（山札・図鑑の見出し）。 */
export const CAT_NAME: Record<ItemCat, string> = {
	weapon: "武器",
	shield: "盾",
	ring: "指輪",
	herb: "草",
	scroll: "スレ",
	staff: "杖",
	arrow: "矢",
	food: "食べもの",
	goal: "目的の品",
};
