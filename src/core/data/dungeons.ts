// ダンジョン（トルネコ1の「ちょっと不思議 → 不思議 → もっと不思議」にならう3つ）。
//
// - shallow：はじめの10階。杖だけ未識別・のろいなし・祭りなし・罠は B5 から。持ち帰るのは「蓄音機の針」。
// - main：本編の27階（過去ログの底。トルネコ1の 不思議のダンジョンで 目的の箱が出る 27階と同じ）。
// - deep：本編を持ち帰ると開く30階。ぜんぶ未識別・ぷゆゆパンと不食の指輪は出ない・罠が多い。
//
// level は「その階が 本編の何階ぶんの強さか」。敵の顔ぶれ・罠の数と種類・祭りの大きさ・変化の杖は
// これで引く（本編は 階 = level）。見た目と曲の層は UI 側（ui/theme.ts）。

import type { ItemWeight } from "../itemTable";
import type { DungeonId, ItemCat } from "../types";
import { MAIN_ITEMS } from "./items";

export type Dungeon = {
	id: DungeonId;
	floors: number;
	/** 道具の出かた（重み。合計は 1回の冒険で 出る数の 目安）。 */
	items: readonly ItemWeight[];
	/** 1つの階に 置く 道具の数（祭りの階は houseItems を 足す）。 */
	perFloor: readonly [number, number];
	/** 階 → 本編の何階ぶんの強さか（[0] は使わない。長さ floors + 1。浅い順に へらない）。 */
	level: readonly number[];
	/** 未識別の分類（ここに無い分類は はじめから名前がわかる）。 */
	unidentified: readonly ItemCat[];
	/** のろわれた道具が出るか。 */
	curses: boolean;
	/** 始めの持ち物。 */
	start: readonly string[];
	/** いちばん底で拾って 持ち帰る品。 */
	goal: string;
	/** 祭り（モンスターハウス）：from 階から chance ずつ。early の階までに無ければ その間のどこかに1つ。null なら無し。 */
	houses: {
		from: number;
		chance: number;
		early: readonly [number, number] | null;
	} | null;
	/** この階より浅い階には罠を置かない。 */
	trapsFrom: number;
	/** このダンジョンを持ち帰ると開く（null ははじめから開いている）。 */
	unlockAfter: DungeonId | null;
	/** unlockAfter のダンジョンで これだけ倒れたら、持ち帰らなくても開く（トルネコ1の30回にあたる）。 */
	reliefAfter: number | null;
};

const identity = (n: number): number[] =>
	Array.from({ length: n + 1 }, (_, i) => i);

const ALL_UNIDENTIFIED: readonly ItemCat[] = [
	"ring",
	"herb",
	"scroll",
	"staff",
];

/**
 * はじめの10階の 道具の出かた（重みの合計 70。トルネコ1の ちょっと不思議 の出現率を 10階ぶんに丸めたもの）。
 * 指輪は無し・杖は4種（ここだけ未識別）。食べものは 始めの200% ＋ 650% で、1階 450ターンでも 足りる。
 */
export const SHALLOW_ITEMS: readonly ItemWeight[] = [
	// 武器 6（ちょっと：こん棒・銅の剣・鉄の斧 だけ。強い武器は出ない）
	{ kind: "club", weight: 2 }, // 攻撃1。弱い武器・投げる物として。ちょっと では銅の剣と同じくらい出た
	{ kind: "copper", weight: 4 }, // 攻撃3。ありふれた剣
	{ kind: "bat", weight: 1 }, // 攻撃4。鉄の斧の位置（ちょっと の武器の 14%）。当たりの1本
	// 盾 7（ちょっと：青銅・うろこ・鋼鉄）
	{ kind: "leather", weight: 1 }, // 防御2。おなかが へりにくい。ちょっと には無いが、もっと深い迷宮で要る知恵を ここで見せる
	{ kind: "bronze", weight: 3 }, // 防御3。ありふれた盾（ちょっと の盾の 67%）
	{ kind: "scale", weight: 2 }, // 防御4。まんぜう軍（レベル4〜）・毒矢の罠（レベル4〜）の ちから下げを防ぐ、を教える
	{ kind: "steelsh", weight: 1 }, // 防御6。鋼鉄の盾の位置。いちばん強い盾で 1枚だけ
	// 矢 5（ちょっと は 矢が多め：7.8%）
	{ kind: "a_wood", weight: 3 }, // 寝落ち民・ゾンJ民を 離れて削る
	{ kind: "a_iron", weight: 2 }, // 本編は 27階で3束。ここは 10階で2束（ちょっと は 鉄・銀の矢のほうが 木より多かった）
	// 食べもの 6（ちょっと：片親パン・ぷゆゆパン・チギュリパン が 1:1:1、全体の 9.4%）
	{ kind: "f_bread", weight: 5 }, // +50%。出る数が ばらつくので、山札のころの 3 より多め
	{ kind: "f_large", weight: 3 }, // +100%。始めの1つとは別
	{ kind: "f_moldy", weight: 1 }, // +100% だが ちから−1・HP−5。「食べものにも 外れがある」を1回だけ
	// 杖 5（ちょっと の4種：いかずち・バシルーラ・変化・メダパニ。ここだけ未識別。振って見分ける）
	{ kind: "w_bolt", weight: 2 }, // いかずち。20前後のダメージで いちばん見分けやすい。2本目で「わかった杖を また拾う」を味わう
	{ kind: "w_send", weight: 1 }, // バシルーラ。困ったときの逃げ道
	{ kind: "w_reel", weight: 1 }, // メダパニ
	{ kind: "w_change", weight: 1 }, // へんげ（候補は レベル+4 まで。B10 なら レベル11 の敵もありうる）
	// 草 21（識別ずみ。ちょっと：弟切草・薬草・毒けし草×2・ちからの種・ルーラ草・火炎草・まどわし草）
	{ kind: "h_heal", weight: 7 }, // 始めの1つと合わせて 10階で およそ8つ（本編は 27階で11）
	{ kind: "h_greater", weight: 3 }, // 弟切草。ちょっと では 薬草と同じだけ出たが、ここは 強いので少なめ
	{ kind: "h_antidote", weight: 4 }, // ちょっと では 草の中で倍の率。まんぜう軍・毒矢の罠・チギュリパンの あと始末
	{ kind: "h_might", weight: 2 }, // ちからの種
	{ kind: "h_blink", weight: 2 }, // 左遷草。逃げ道
	{ kind: "h_fire", weight: 2 }, // 火炎草。飲めば 65〜75 で 風吹けば名無し（HP23）も一撃
	{ kind: "h_daze", weight: 2 }, // まどわし草。投げれば 敵が逃げる（ちょっと に メダパニ草は 無い）
	{ kind: "h_sleep", weight: 1 }, // 飲めば マイナス、投げれば 敵が眠る。「投げて使う草」を1つ
	{ kind: "h_poison", weight: 1 }, // マイナスの品。識別ずみなので 見ればわかるが、名前を 覚えてもらう
	// スレ 20（識別ずみ。ちょっと：インパス・レミーラ・千里眼・地獄耳・バイキルト・スカラ・イオ が ほぼ同率）
	{ kind: "s_appraise", weight: 3 }, // インパス。始めの1枚と合わせて4枚。杖（4種）と 装備の修正値を見る
	{ kind: "s_map", weight: 3 }, // レミーラ。階段さがしに
	{ kind: "s_blast", weight: 3 }, // イオ。部屋の敵に 5〜35。困ったときの1枚
	{ kind: "s_whet", weight: 4 }, // バイキルト
	{ kind: "s_temper", weight: 4 }, // スカラ
	{ kind: "s_treasure", weight: 2 }, // 千里眼
	{ kind: "s_sense", weight: 2 }, // 地獄耳
	{ kind: "s_hold", weight: 1 }, // 金縛り（ちょっと には無い）。となりの敵を止める、を1回だけ
	// 入れないもの：指輪ぜんぶ（ちょっと に無い）、解呪スレ（のろいが無い）、防錆スレ、充填スレ、
	//   飯テロスレ、釣りスレ（マイナス）、結界スレ、成長・疾風の実、暗闇草・見透し草、
	//   竜断ち以上の武器・鏡銀以上の盾（もっと強い品は 本編から）、眠り・封印・鈍足・諸刃・分裂・加速の杖
];

/**
 * はじめの10階の 階 → 本編の何階ぶんか。B1〜4 は罠なし（レベル2 まで）、B5 から罠、B9〜10 は 本編の B7
 * （自演くん（本編の B8〜）は 出さない。入門の ダンジョンなので いちばん強い 顔ぶれは 本編で）。
 */
export const SHALLOW_LEVEL: readonly number[] = [
	0, // [0] 使わない
	1, // B1：ぷゆゆ・dat落ちの霊・深夜テンション・バグ。罠なし
	1, // B2：同じ顔ぶれで 慣れる
	2, // B3：kskボット・寝落ち民（眠りの呪文）が 加わる
	2, // B4：罠なし最後の階（レベル2 まで 罠 0）
	3, // B5：罠が出はじめる（1〜3個。トラバサミ・眠り・転び・矢・ワープ・落とし穴）
	4, // B6：ピッチャー・まんぜう軍・コピペ が 一度に来る。毒矢の罠も。ぷゆゆが 消える
	4, // B7：同じ顔ぶれを もう1階（3種を 1階で覚えるのは 多い）
	5, // B8：ゾンJ民（起き上がる）。錆び・地雷の罠も
	7, // B9：拾い画UFO・風吹けば名無し（吹きとばし）。弱い敵が 抜ける
	7, // B10：同じ顔ぶれで 針を 拾って 帰る
];

/**
 * もっと深い30階の 道具の出かた（重みの合計 210。本編 ×1.5 から ぷゆゆパン・不食の指輪を抜き、マイナスの品を ふやし、
 * いちばん強い品は 本編と同じ数のまま）。食べものは 始めの200% ＋ 1100%（1階 433ターン）。
 * スレ（ぷゆゆパン）・草を飲む（+5%）・革の盾で しのぐ。
 */
export const DEEP_ITEMS: readonly ItemWeight[] = [
	// 武器 14
	{ kind: "club", weight: 3 }, // 弱い武器（もっと の武器の 21%）。投げる物・飯テロの種
	{ kind: "copper", weight: 3 }, // ありふれた剣（もっと の 31%）
	{ kind: "bat", weight: 2 }, // 本編と同じ2本（階あたりは減る）
	{ kind: "wyrmbane", weight: 2 }, // ワイバーン（レベル25〜）が B25-30 の6階に出て、竜断ちの 引き当てが 遅いと 間に合わないので 本編1 → 2
	{ kind: "steel", weight: 2 }, // 攻撃6。本編1 × 1.5 を切り上げ
	{ kind: "starsword", weight: 1 }, // 攻撃7。強い品は 本編と同じ1本（階あたり 2/3）
	{ kind: "mic", weight: 1 }, // 攻撃10。いちばん強い武器は 1本のまま
	// 盾 14
	{ kind: "leather", weight: 3 }, // おなかが半分。もっと の命綱（もっと の盾の 20%）
	{ kind: "bronze", weight: 3 }, // ありふれた盾
	{ kind: "scale", weight: 2 }, // 毒で ちからを下げられない（毒草8・チギュリパン5 の迷宮で 価値が上がる）
	{ kind: "mirror", weight: 2 }, // 錆びない。風呂キャンセル界隈（レベル8〜15）・錆びの罠 対策
	{ kind: "steelsh", weight: 2 }, // 防御6。本編1 × 1.5 を切り上げ
	{ kind: "fireward", weight: 1 }, // ワイバーンの炎が半分。深い階で強いので 1枚のまま
	{ kind: "starshield", weight: 1 }, // 防御10。いちばん強い盾は 1枚のまま
	// 指輪 13（4つに1つは のろい。不食の指輪は 入れない）
	{ kind: "r_might", weight: 3 }, // もっと で いちばん多い指輪の1つ。のろいなら −3 なので 当たりとは かぎらない
	{ kind: "r_hunger", weight: 3 }, // マイナス。本編1 → 3（もっと の ハラペコ は 指輪で いちばん多い）。のろわれて外せないと 食べものが半分の価値
	{ kind: "r_clamor", weight: 2 }, // マイナス（ザメハ）。本編1 → 2
	{ kind: "r_trap", weight: 1 }, // 罠7〜9の階で 強すぎるので 1つだけ（もっと でも 13/256 と少ない）
	{ kind: "r_awake", weight: 1 }, // 本編と同じ
	{ kind: "r_purity", weight: 1 }, // 本編と同じ（解毒草・うろこの盾が ほかにある）
	{ kind: "r_stealth", weight: 1 }, // 祭りが多い迷宮で 強い（もっと の とうぞく 11/256）。1つだけ
	{ kind: "r_ward", weight: 1 }, // 文字化け（レベル17〜）が B17-30 に出るので 強い（人形よけ）。1つだけ
	// 草 71（未識別。飲めば +5% なので、見分けるために飲むのも 食べものになる）
	{ kind: "h_heal", weight: 15 }, // 本編10 × 1.5
	{ kind: "h_greater", weight: 6 }, // 本編4 × 1.5
	{ kind: "h_poison", weight: 8 }, // マイナス。本編3 → 8（もっと で 毒草が加わった ぶん）
	{ kind: "h_might", weight: 6 }, // 本編4 × 1.5
	{ kind: "h_growth", weight: 1 }, // もっと では 床に出ない（幸せの種）。1つだけ残して 30階で いちばんの当たりに
	{ kind: "h_swift", weight: 3 }, // 本編2 × 1.5
	{ kind: "h_blind", weight: 5 }, // 飲めば マイナス、投げれば 目つぶし＋封印。本編3 → 5
	{ kind: "h_blink", weight: 6 }, // 本編4 × 1.5。逃げ道
	{ kind: "h_reel", weight: 3 }, // 飲めば マイナス。本編と同じ3
	{ kind: "h_daze", weight: 2 }, // まどわし草。飲めば マイナス、投げれば 敵が逃げる
	{ kind: "h_sleep", weight: 5 }, // 飲めば マイナス。本編3 → 5
	{ kind: "h_antidote", weight: 6 }, // 毒草8・チギュリパン5・まんぜう軍・毒矢の罠 が 多いので 本編3 → 6
	{ kind: "h_fire", weight: 2 }, // もっと では 消えた 火炎草。1つ減らして 本編より まれに
	{ kind: "h_sight", weight: 3 }, // 罠7〜9 と 透明あぼーん（見えない。レベル15〜）に。本編2 → 3
	// スレ 58（未識別）
	{ kind: "s_appraise", weight: 12 }, // 本編8 × 1.5。マイナスの品が多いぶん 階あたりは 本編と同じに保つ
	{ kind: "s_whet", weight: 5 }, // 30階ぶんの 装備の育ち。本編3 × 1.5 を切り上げ
	{ kind: "s_temper", weight: 5 }, // 同じ
	{ kind: "s_uncurse", weight: 4 }, // 指輪・装備が ふえ、のろいの数も ふえるので 本編2 → 4
	{ kind: "s_rustproof", weight: 1 }, // もっと では 消えた メッキ。1枚だけ
	{ kind: "s_map", weight: 6 }, // 罠7〜9 を見せる。本編3 → 6（）
	{ kind: "s_sense", weight: 2 }, // もっと では 消えた 地獄耳。本編と同じ2枚（階あたり 2/3）
	{ kind: "s_treasure", weight: 2 }, // もっと では 消えた 千里眼。本編と同じ2枚
	{ kind: "s_hold", weight: 5 }, // 本編3 × 1.5 を切り上げ（もっと にも ある）
	{ kind: "s_blast", weight: 3 }, // もっと では 消えた イオ。本編と同じ3枚（階あたり 2/3）
	{ kind: "s_ward", weight: 1 }, // 結界。いちばん強いスレは 1枚のまま（もっと の 聖域 2/256）
	{ kind: "s_recharge", weight: 3 }, // もっと の 祈り。本編2 → 3
	{ kind: "s_bread", weight: 3 }, // もっと の パンの巻物。ぷゆゆパンが 床に無いぶんの 逃げ道
	{ kind: "s_snare", weight: 5 }, // マイナス（ワナの巻物）。本編2 → 5
	{ kind: "s_gacha", weight: 1 }, // もっと だけの パルプンテ。当たりも 外れも 大きいので 1枚
	// 杖 16（未識別）
	{ kind: "w_bolt", weight: 1 }, // もっと では 消えた いかずち。1本のまま
	{ kind: "w_reel", weight: 1 }, // もっと では 消えた メダパニ。1本のまま
	{ kind: "w_sleep", weight: 1 }, // もっと では 消えた ラリホー。1本のまま
	{ kind: "w_seal", weight: 1 }, // もっと では 消えた 封印。深い階の とくぎ持ちに 強すぎるので 1本のまま
	{ kind: "w_change", weight: 2 }, // もっと にも ある。本編1 → 2
	{ kind: "w_send", weight: 2 }, // もっと にも ある（バシルーラ）。本編1 → 2
	{ kind: "w_slow", weight: 2 }, // もっと にも ある（ボミオス）。本編1 → 2
	{ kind: "w_edge", weight: 1 }, // もろ刃。強くて 危ないので 1本のまま
	{ kind: "w_split", weight: 2 }, // マイナス（もっと にも ある）。本編1 → 2
	{ kind: "w_haste", weight: 2 }, // マイナス（ピオリム）。本編1 → 2
	{ kind: "w_rebut", weight: 1 }, // もっと だけの ザキ。回数0で 出るので 次スレと 組んで はじめて 強い
	// 矢 9
	{ kind: "a_wood", weight: 6 }, // 本編4 × 1.5
	{ kind: "a_iron", weight: 3 }, // 本編2 × 1.5
	// 食べもの 17（ぷゆゆパンは 入れない。もっと の 片親パン:チギュリパン ≒ 2:1）
	{ kind: "f_bread", weight: 14 }, // +50%。出る数が ばらつくので、山札のころの 12 より多め
	{ kind: "f_moldy", weight: 5 }, // +100%（ちから−1・HP−5）
];

export const DUNGEONS: Record<DungeonId, Dungeon> = {
	shallow: {
		id: "shallow",
		floors: 10,
		items: SHALLOW_ITEMS,
		perFloor: [5, 9],
		level: SHALLOW_LEVEL,
		unidentified: ["staff"],
		curses: false,
		start: ["f_large", "h_heal", "s_appraise"],
		goal: "needle",
		houses: null,
		trapsFrom: 5,
		unlockAfter: null,
		reliefAfter: null,
	},
	main: {
		id: "main",
		floors: 27,
		items: MAIN_ITEMS,
		perFloor: [5, 7],
		level: identity(27),
		unidentified: ALL_UNIDENTIFIED,
		curses: true,
		start: ["f_large"],
		goal: "genban",
		houses: { from: 3, chance: 1 / 16, early: [4, 6] },
		trapsFrom: 3,
		unlockAfter: "shallow",
		reliefAfter: 10,
	},
	deep: {
		id: "deep",
		floors: 30,
		items: DEEP_ITEMS,
		perFloor: [5, 8],
		level: identity(30),
		unidentified: ALL_UNIDENTIFIED,
		curses: true,
		start: ["f_large"],
		goal: "tsuzuki",
		houses: { from: 3, chance: 1 / 10, early: [4, 6] },
		trapsFrom: 3,
		unlockAfter: "main",
		reliefAfter: null,
	},
};

export const DUNGEON_IDS: readonly DungeonId[] = ["shallow", "main", "deep"];

/** 知らない id（壊れた記録など）は本編として読む。 */
export const dungeonById = (id: string | undefined): Dungeon =>
	DUNGEONS[id as DungeonId] ?? DUNGEONS.main;
