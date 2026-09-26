// ダンジョン（トルネコ1の「ちょっと不思議 → 不思議 → もっと不思議」にならう3つ）。
//
// - shallow：はじめの10階。杖だけ未識別・のろいなし・祭りなし・罠は B5 から。持ち帰るのは「蓄音機の針」。
// - main：本編の20階（過去ログの底）。今までどおり（中断セーブ・リプレイ・parity の基準がそのまま通る）。
// - deep：本編を持ち帰ると開く30階。ぜんぶ未識別・ぷゆゆパンと不食の指輪は出ない・罠が多い。
//
// level は「その階が 本編の何階ぶんの強さか」。敵の顔ぶれ・罠の数と種類・祭りの大きさ・変化の杖は
// これで引く（本編は 階 = level）。見た目と曲の層は UI 側（ui/theme.ts）。

import type { DeckEntry } from "../deck";
import type { DungeonId, ItemCat } from "../types";
import { MAIN_DECK } from "./items";

export type Dungeon = {
	id: DungeonId;
	floors: number;
	/** 山札（中身は毎回同じ・公開。並びだけ冒険ごとに切る）。 */
	deck: readonly DeckEntry[];
	/** 階 → 本編の何階ぶんの強さか（[0] は使わない。長さ floors + 1。浅い順に へらない）。 */
	level: readonly number[];
	/** 未識別の分類（ここに無い分類は はじめから名前がわかる）。 */
	unidentified: readonly ItemCat[];
	/** のろわれた道具が出るか。 */
	curses: boolean;
	/** 始めの持ち物（山札の外）。 */
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
 * はじめの10階の山札（70枚。トルネコ1の ちょっと不思議 の出現率を 10階ぶんに丸めたもの）。
 * 指輪は無し・杖は4種（ここだけ未識別）。食べものは 始めの200% ＋ 650% で、1階 450ターンでも 足りる。
 */
export const SHALLOW_DECK: readonly DeckEntry[] = [
	// 武器 6（ちょっと：こん棒・銅の剣・鉄の斧 だけ。強い武器は出ない）
	{ kind: "club", count: 2 }, // 攻撃1。弱い武器・投げる物として。ちょっと では銅の剣と同じくらい出た
	{ kind: "copper", count: 3 }, // 攻撃3。ありふれた剣。3枚で 各層に1本
	{ kind: "bat", count: 1 }, // 攻撃4。鉄の斧の位置（ちょっと の武器の 14%）。当たりの1本
	// 盾 7（ちょっと：青銅・うろこ・鋼鉄）
	{ kind: "leather", count: 1 }, // 防御2。おなかが へりにくい。ちょっと には無いが、もっと深い迷宮で要る知恵を ここで見せる
	{ kind: "bronze", count: 3 }, // 防御3。ありふれた盾（ちょっと の盾の 67%）。各層に1枚
	{ kind: "scale", count: 2 }, // 防御4。毒カボチャ（レベル4〜）・毒矢の罠（レベル4〜）の ちから下げを防ぐ、を教える
	{ kind: "steelsh", count: 1 }, // 防御6。鋼鉄の盾の位置。いちばん強い盾で 1枚だけ
	// 矢 5（ちょっと は 矢が多め：7.8%）
	{ kind: "a_wood", count: 3 }, // 各層に1束。寝落ち民・キメラを 離れて削る
	{ kind: "a_iron", count: 2 }, // 本編は 20階で2束。ここは 10階で2束（ちょっと は 鉄・銀の矢のほうが 木より多かった）
	// 食べもの 6（ちょっと：片親パン・ぷゆゆパン・チギュリパン が 1:1:1、全体の 9.4%）
	{ kind: "f_bread", count: 3 }, // +50%。各層に1つ
	{ kind: "f_large", count: 2 }, // +100%。始めの1つとは別。2つの層に1つずつ
	{ kind: "f_moldy", count: 1 }, // +100% だが ちから−1・HP−5。「食べものにも 外れがある」を1回だけ
	// 杖 5（ちょっと の4種：いかずち・バシルーラ・変化・メダパニ。ここだけ未識別。振って見分ける）
	{ kind: "w_bolt", count: 2 }, // いかずち。20前後のダメージで いちばん見分けやすい。2本目で「わかった杖を また拾う」を味わう
	{ kind: "w_send", count: 1 }, // バシルーラ。困ったときの逃げ道
	{ kind: "w_reel", count: 1 }, // メダパニ
	{ kind: "w_change", count: 1 }, // へんげ（候補は レベル+4 まで。B10 なら レベル11 の敵もありうる）
	// 草 21（識別ずみ。ちょっと：弟切草・薬草・毒けし草×2・ちからの種・ルーラ草・火炎草・まどわし草）
	{ kind: "h_heal", count: 6 }, // 各層に2つ。始めの1つと合わせて 10階で7つ（本編は 20階で10）
	{ kind: "h_greater", count: 2 }, // 弟切草。ちょっと では 薬草と同じだけ出たが、ここは 強いので少なめ
	{ kind: "h_antidote", count: 3 }, // ちょっと では 草の中で倍の率。毒カボチャ・毒矢の罠・チギュリパンの あと始末。各層に1つ
	{ kind: "h_might", count: 2 }, // ちからの種
	{ kind: "h_blink", count: 2 }, // ルーラ草。逃げ道
	{ kind: "h_fire", count: 2 }, // 火炎草。飲めば 65〜75 で キメラ（HP27）も一撃
	{ kind: "h_reel", count: 2 }, // まどわし草の位置。投げて 敵を混乱させる
	{ kind: "h_sleep", count: 1 }, // 飲めば マイナス、投げれば 敵が眠る。「投げて使う草」を1つ
	{ kind: "h_poison", count: 1 }, // マイナスの品。識別ずみなので 見ればわかるが、名前を 覚えてもらう
	// スレ 20（識別ずみ。ちょっと：インパス・レミーラ・千里眼・地獄耳・バイキルト・スカラ・イオ が ほぼ同率）
	{ kind: "s_appraise", count: 3 }, // インパス。始めの1枚と合わせて4枚。杖（4種）と 装備の修正値を見る
	{ kind: "s_map", count: 3 }, // レミーラ。階段さがしに。各層に1枚
	{ kind: "s_blast", count: 3 }, // イオ。部屋の敵に 5〜35。困ったときの1枚を 各層に
	{ kind: "s_whet", count: 3 }, // バイキルト。各層に1枚
	{ kind: "s_temper", count: 3 }, // スカラ。各層に1枚
	{ kind: "s_treasure", count: 2 }, // 千里眼
	{ kind: "s_sense", count: 2 }, // 地獄耳
	{ kind: "s_hold", count: 1 }, // 金縛り（ちょっと には無い）。となりの敵を止める、を1回だけ
	// 入れないもの：指輪ぜんぶ（ちょっと に無い）、解呪スレ（のろいが無い）、防錆スレ、充填スレ、
	//   飯テロスレ、釣りスレ（マイナス）、結界スレ、成長・疾風の実、暗闇草・見透し草、
	//   竜断ち以上の武器・鏡銀以上の盾（もっと強い品は 本編から）、眠り・封印・鈍足・諸刃・分裂・加速の杖
];

/**
 * はじめの10階の 階 → 本編の何階ぶんか。B1〜4 は罠なし（レベル2 まで）、B5 から罠、B10 は キメラの出はじめ。
 */
export const SHALLOW_LEVEL: readonly number[] = [
	0, // [0] 使わない
	1, // B1：ぷゆゆ・ひとだま・迷いコウモリ・フナムシ。罠なし
	1, // B2：同じ顔ぶれで 慣れる
	2, // B3：kskボット・寝落ち民（眠りの呪文）が 加わる
	2, // B4：罠なし最後の階（レベル2 まで 罠 0）
	3, // B5：罠が出はじめる（1〜3個。トラバサミ・眠り・転び・矢・ワープ・落とし穴）。ぷゆゆが 消える
	4, // B6：ピッチャー・毒カボチャ・コピペ が 一度に来る。毒矢の罠も
	4, // B7：同じ顔ぶれを もう1階（3種を 1階で覚えるのは 多い）
	5, // B8：ゾンJ民（起き上がる）。弱い敵が 抜ける。錆び・地雷の罠も
	6, // B9：さらいUFO・風吹けば名無し（吹きとばし）
	7, // B10：キメラ（本編 B7〜）。ちょっと の B10 も キメラ・きめんどうし・おばけキノコ
];

/**
 * もっと深い30階の山札（210枚。本編 ×1.5 から ぷゆゆパン・不食の指輪を抜き、マイナスの品を ふやし、
 * いちばん強い品は 本編と同じ数のまま）。食べものは 始めの200% ＋ 1100%（1階 433ターン）。
 * スレ（ぷゆゆパン）・草を飲む（+5%）・革の盾で しのぐ。
 */
export const DEEP_DECK: readonly DeckEntry[] = [
	// 武器 14
	{ kind: "club", count: 3 }, // 弱い武器（もっと の武器の 21%）。投げる物・飯テロの種。各層に1本
	{ kind: "copper", count: 3 }, // ありふれた剣（もっと の 31%）。各層に1本
	{ kind: "bat", count: 2 }, // 本編と同じ2本（階あたりは減る）
	{ kind: "wyrmbane", count: 2 }, // ワイバーン（レベル19〜）が B19-30 の12階に出るので 本編1 → 2
	{ kind: "steel", count: 2 }, // 攻撃6。本編1 × 1.5 を切り上げ
	{ kind: "starsword", count: 1 }, // 攻撃7。強い品は 本編と同じ1本（階あたり 2/3）
	{ kind: "mic", count: 1 }, // 攻撃10。いちばん強い武器は 1本のまま
	// 盾 14
	{ kind: "leather", count: 3 }, // おなかが半分。もっと の命綱（もっと の盾の 20%）。各層に1枚
	{ kind: "bronze", count: 3 }, // ありふれた盾。各層に1枚
	{ kind: "scale", count: 2 }, // 毒で ちからを下げられない（毒草8・チギュリパン5 の迷宮で 価値が上がる）
	{ kind: "mirror", count: 2 }, // 錆びない。錆び亡者（レベル8〜15）・錆びの罠 対策
	{ kind: "steelsh", count: 2 }, // 防御6。本編1 × 1.5 を切り上げ
	{ kind: "fireward", count: 1 }, // ワイバーンの炎が半分。深い階で強いので 1枚のまま
	{ kind: "starshield", count: 1 }, // 防御10。いちばん強い盾は 1枚のまま
	// 指輪 13（4つに1つは のろい。不食の指輪は 入れない）
	{ kind: "r_might", count: 3 }, // もっと で いちばん多い指輪の1つ。のろいなら −3 なので 当たりとは かぎらない
	{ kind: "r_hunger", count: 3 }, // マイナス。本編1 → 3（もっと の ハラペコ は 指輪で いちばん多い）。のろわれて外せないと 食べものが半分の価値
	{ kind: "r_clamor", count: 2 }, // マイナス（ザメハ）。本編1 → 2
	{ kind: "r_trap", count: 1 }, // 罠7〜9の階で 強すぎるので 1つだけ（もっと でも 13/256 と少ない）
	{ kind: "r_awake", count: 1 }, // 本編と同じ
	{ kind: "r_purity", count: 1 }, // 本編と同じ（解毒草・うろこの盾が ほかにある）
	{ kind: "r_stealth", count: 1 }, // 祭りが多い迷宮で 強い（もっと の とうぞく 11/256）。1つだけ
	{ kind: "r_ward", count: 1 }, // 文字化け（レベル17〜）が B17-30 に出るので 強い（人形よけ）。1つだけ
	// 草 71（未識別。飲めば +5% なので、見分けるために飲むのも 食べものになる）
	{ kind: "h_heal", count: 15 }, // 本編10 × 1.5。各層に5つ
	{ kind: "h_greater", count: 6 }, // 本編4 × 1.5。各層に2つ
	{ kind: "h_poison", count: 8 }, // マイナス。本編3 → 8（もっと で 毒草が加わった ぶん）
	{ kind: "h_might", count: 6 }, // 本編4 × 1.5。各層に2つ
	{ kind: "h_growth", count: 1 }, // もっと では 床に出ない（幸せの種）。1つだけ残して 30階で いちばんの当たりに
	{ kind: "h_swift", count: 3 }, // 本編2 × 1.5
	{ kind: "h_blind", count: 5 }, // 飲めば マイナス、投げれば 目つぶし＋封印。本編3 → 5
	{ kind: "h_blink", count: 6 }, // 本編4 × 1.5。逃げ道
	{ kind: "h_reel", count: 5 }, // 飲めば マイナス。本編3 → 5
	{ kind: "h_sleep", count: 5 }, // 飲めば マイナス。本編3 → 5
	{ kind: "h_antidote", count: 6 }, // 毒草8・チギュリパン5・毒カボチャ・毒矢の罠 が 多いので 本編3 → 6
	{ kind: "h_fire", count: 2 }, // もっと では 消えた 火炎草。1つ減らして 本編より まれに
	{ kind: "h_sight", count: 3 }, // 罠7〜9 と 影（見えない。レベル15〜）に。本編2 → 3
	// スレ 57（未識別）
	{ kind: "s_appraise", count: 12 }, // 本編8 × 1.5。マイナスの品が多いぶん 階あたりは 本編と同じに保つ
	{ kind: "s_whet", count: 5 }, // 30階ぶんの 装備の育ち。本編3 × 1.5 を切り上げ
	{ kind: "s_temper", count: 5 }, // 同じ
	{ kind: "s_uncurse", count: 4 }, // 指輪・装備が ふえ、のろいの数も ふえるので 本編2 → 4
	{ kind: "s_rustproof", count: 1 }, // もっと では 消えた メッキ。1枚だけ
	{ kind: "s_map", count: 6 }, // 罠7〜9 を見せる。本編3 → 6（各層に2枚）
	{ kind: "s_sense", count: 2 }, // もっと では 消えた 地獄耳。本編と同じ2枚（階あたり 2/3）
	{ kind: "s_treasure", count: 2 }, // もっと では 消えた 千里眼。本編と同じ2枚
	{ kind: "s_hold", count: 5 }, // 本編3 × 1.5 を切り上げ（もっと にも ある）
	{ kind: "s_blast", count: 3 }, // もっと では 消えた イオ。本編と同じ3枚（階あたり 2/3）
	{ kind: "s_ward", count: 1 }, // 結界。いちばん強いスレは 1枚のまま（もっと の 聖域 2/256）
	{ kind: "s_recharge", count: 3 }, // もっと の 祈り。本編2 → 3
	{ kind: "s_bread", count: 3 }, // もっと の パンの巻物。ぷゆゆパンが 床に無いぶんの 逃げ道。各層に1枚
	{ kind: "s_snare", count: 5 }, // マイナス（ワナの巻物）。本編2 → 5
	// 杖 15（未識別）
	{ kind: "w_bolt", count: 1 }, // もっと では 消えた いかずち。1本のまま
	{ kind: "w_reel", count: 1 }, // もっと では 消えた メダパニ。1本のまま
	{ kind: "w_sleep", count: 1 }, // もっと では 消えた ラリホー。1本のまま
	{ kind: "w_seal", count: 1 }, // もっと では 消えた 封印。深い階の とくぎ持ちに 強すぎるので 1本のまま
	{ kind: "w_change", count: 2 }, // もっと にも ある。本編1 → 2
	{ kind: "w_send", count: 2 }, // もっと にも ある（バシルーラ）。本編1 → 2
	{ kind: "w_slow", count: 2 }, // もっと にも ある（ボミオス）。本編1 → 2
	{ kind: "w_edge", count: 1 }, // もろ刃。強くて 危ないので 1本のまま
	{ kind: "w_split", count: 2 }, // マイナス（もっと にも ある）。本編1 → 2
	{ kind: "w_haste", count: 2 }, // マイナス（ピオリム）。本編1 → 2
	// 矢 9
	{ kind: "a_wood", count: 6 }, // 本編4 × 1.5。各層に2束
	{ kind: "a_iron", count: 3 }, // 本編2 × 1.5。各層に1束
	// 食べもの 17（ぷゆゆパンは 入れない。もっと の 片親パン:チギュリパン ≒ 2:1）
	{ kind: "f_bread", count: 12 }, // +50%。各層に4つ（200%/層）
	{ kind: "f_moldy", count: 5 }, // +100%（ちから−1・HP−5）。各層に1つ＋余り2つ（ちがう層）。上の計算を見よ
];

export const DUNGEONS: Record<DungeonId, Dungeon> = {
	shallow: {
		id: "shallow",
		floors: 10,
		deck: SHALLOW_DECK,
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
		floors: 20,
		deck: MAIN_DECK,
		level: identity(20),
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
		deck: DEEP_DECK,
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
