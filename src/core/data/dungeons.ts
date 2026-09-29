// ダンジョン＝おんJの 植民地（おーぷん2ch の ほかの板）。村の 入口で 行き先を 選ぶ。
// 板ごとに 階の数・道具の出かた・決まり（板の 気風から）が ちがう。名前と 語りは data/story.ts、
// 見た目と 曲（板ごとに 1つ。全フロア 同じ）は ui/theme.ts。
//
// - shallow：パン板（ぱんJ。いちばん 栄えた 植民地）の 10階。入門：杖だけ未識別・のろいなし・祭りなし・
//   罠は B5 から。パン松の 縄張りで パンが よく出る。持ち帰るのは「植民地化宣言」。
// - main：風呂板（おふJ）の 27階。湯治：HP の 自然回復が 1.5倍。倉庫から 持ちこめる。
// - deep：電池板（でんJ。過疎で 謎が多い）の 30階。充電：杖の 回数が 1 多い。
//   ぜんぶ未識別・ぷゆゆパンと不食の指輪は出ない・罠が多い・祭りが出やすい。
//
// 目的（objective）：物語の 品を 運ぶ 板（パン板・風呂板・電池板・過去ログの底）は 持ち帰り（fetch）、
// 4つの 植民地は いちばん底の ボスを たおす（boss。たおすと 品ごと 一瞬で 入口へ 帰る）。
// パン板・風呂板にも 期間限定の ボスが いる（いつ boss に なるかは 村の イベント：data/objectives.ts。core は 決めない）。
//
// level は「その階が 本編の何階ぶんの強さか」。敵の顔ぶれ・罠の数と種類・祭りの大きさ・変化の杖は
// これで引く（本編は 階 = level）。見た目と曲の層は UI 側（ui/theme.ts）。

import type { ItemWeight } from "../itemTable";
import type { DungeonId, ItemCat, Objective, RescueKind } from "../types";
import { ITEMS, MAIN_ITEMS } from "./items";

/**
 * 目的が boss の ときの いちばん底：ボスと、たおした あとに 一瞬で 入口へ 帰る わけ。
 * 文は 決まった もの（乱数は 使わない。記録・リプレイで 同じに なるように）。
 */
export type BossSpec = {
	/** ボスの 種類（data/monsters.ts の boss: true の id）。持ち帰る 品（goal）を 持っている。 */
	monster: string;
	/** 帰り方（画面の 演出の 種類）。 */
	rescue: RescueKind;
	/** 帰り方の 行（たおして 品を 手に 入れた あと、順に 出す）。 */
	lines: readonly string[];
	/**
	 * 終わりの 理由（Ending.cause。記録・リプレイの 組み合わせに 使う ので 変えない。
	 * engine/save.ts の RENAMES の 左の 名前を 含めない）。
	 */
	cause: string;
};

export type Dungeon = {
	id: DungeonId;
	/**
	 * 目的の 既定（村の 期間限定の イベントで かわる ことも ある：data/objectives.ts）。
	 * boss に できるのは boss の ある 板だけ。
	 */
	objective: Objective;
	/** 目的が boss の ときの ボス（無い 板は boss に ならない）。 */
	boss?: BossSpec;
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
	/** unlockAfter のダンジョンで これだけ倒れたら、持ち帰らなくても開く。 */
	reliefAfter: number | null;
	/** 自然回復の 刻み（balance.ts の REGEN_STEP の 代わり。小さいほど はやい）。 */
	regenStep?: number;
	/** 杖の 回数に 足す 数。 */
	charge?: number;
	/** 過疎：はじめから いる 敵の 数と 湧く 間隔に かける 数（0.5 なら 半分・間隔は 倍）。 */
	sparse?: number;
	/**
	 * 敵の 出やすさ（id → 重みに かける 数。0 は 出ない）。板の 気風に 合う 敵を 多めに。
	 * その板だけの 敵は data/monsters.ts の board。
	 */
	foes?: Readonly<Record<string, number>>;
	/** 😡：どの 敵も HP が 半分を 切ると 怒って 倍速に なる。 */
	angry?: boolean;
	/** 持ち帰る 品を 持ったまま 帰還スレで 帰れる（99階ある 隠しの 板だけ）。 */
	escapeWithGoal?: boolean;
	/** 全体マップに 開くまで 出さない（隠し）。 */
	secret?: boolean;
	/**
	 * 上りの 植民地（塔・やぐら・山）。階は 上へ 数え、帰り道は 降りる。中の 動きは 下りと 同じで、
	 * 文と 見せかただけ 逆（depth が 大きいほど 高い）。
	 */
	up?: boolean;
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
 * パン板の 10階の 道具の出かた（重みの合計 72。入門の 10階ぶん。パンが 多め）。
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
	{ kind: "f_bread", weight: 7 }, // +50%。パン板なので パンが よく出る（パン松の 縄張り）
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

/**
 * きのこ板の 12階の 道具の出かた。パン板の 表から 草を ふやし、毒草・眠り草・まどわし草も ふやした
 * （きのこの 当たり外れ。草は 未識別）。
 */
export const KINOKO_ITEMS: readonly ItemWeight[] = [
	...SHALLOW_ITEMS.filter(
		(e) => ITEMS[e.kind]?.cat !== "herb" && ITEMS[e.kind]?.cat !== "food",
	),
	// 食べもの（12階ぶん。パン板より 多め）
	{ kind: "f_bread", weight: 9 },
	{ kind: "f_large", weight: 4 },
	{ kind: "f_moldy", weight: 1 },
	{ kind: "h_heal", weight: 9 },
	{ kind: "h_greater", weight: 3 },
	{ kind: "h_antidote", weight: 5 },
	{ kind: "h_might", weight: 3 },
	{ kind: "h_blink", weight: 3 },
	{ kind: "h_fire", weight: 2 },
	{ kind: "h_daze", weight: 3 },
	{ kind: "h_sleep", weight: 3 },
	{ kind: "h_poison", weight: 5 },
	{ kind: "h_blind", weight: 2 },
];

/** 階 → 本編の 何階ぶんか（入門の つぎ。パン板より 少し 強い 顔ぶれまで）。 */
const KINOKO_LEVEL: readonly number[] = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 7];

/**
 * 隠しの 99階の 道具の出かた：風呂板の 表で、食べものを ふやした（99階ぶん 歩くので。
 * ぷゆゆパン・片親パン を 倍、飯テロスレも 倍）。
 */
const HIDDEN_ITEMS: readonly ItemWeight[] = MAIN_ITEMS.map((e) =>
	e.kind === "f_bread" || e.kind === "f_large" || e.kind === "s_bread"
		? { kind: e.kind, weight: e.weight * 2 }
		: e,
);

/** 隠しの 99階：本編の 30階ぶんまで 少しずつ 強くなり、61階から 先は ずっと 30階ぶん。 */
const HIDDEN_LEVEL: readonly number[] = Array.from({ length: 100 }, (_, i) =>
	i === 0 ? 0 : Math.min(30, 1 + Math.floor(((i - 1) * 29) / 60)),
);

/** 階 → 本編の 何階ぶんか（1階 おくれ。😡の 板は 弱い 敵でも 怒るので 出だしを ゆるく）。 */
const lagged = (n: number): number[] =>
	Array.from({ length: n + 1 }, (_, i) => (i === 0 ? 0 : Math.max(1, i - 1)));

export const DUNGEONS: Record<DungeonId, Dungeon> = {
	shallow: {
		id: "shallow",
		objective: "fetch",
		boss: {
			monster: "boss_panhei",
			rescue: "escort",
			lines: [
				"どこからか　パン松の　号令が　ひびいた！",
				"パン兵たちが　キリコを　かつぎあげた",
				"わっしょい　わっしょい……　入口まで　運ばれた",
			],
			cause: "パン兵長を　たおした",
		},
		// パン松は やきうが きらい（ピッチャーは 追い出した）。まんじゅう（まんぜう軍）は パンの なかま
		foes: { pumpkin: 2, pitcher: 0 },
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
		objective: "fetch",
		boss: {
			monster: "boss_ofurou",
			rescue: "geyser",
			lines: [
				"足もとの　源泉が　ごぼごぼと　わきだした……",
				"湯柱が　噴きあがった！",
				"湯柱に　押し上げられて、入口まで　もどった",
			],
			cause: "湯守おふ郎くんを　たおした",
		},
		// 風呂に 入らない 界隈が 湯を ねらう。湯で 眠くなる
		foes: { sabi: 2, neochi: 1.5 },
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
		// 湯治：150 → 100（1.5倍）
		regenStep: 100,
	},
	deep: {
		id: "deep",
		objective: "fetch",
		// 機械と 回線の 敵が 多い
		foes: { ksk: 1.5, ninpo: 1.5, ufo: 1.5, mojibake: 1.3, kage: 1.3 },
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
		// 充電ずみの 杖
		charge: 1,
		// 送電鉄塔を 上る
		up: true,
	},
	// きのこ板（パン板の 植民地。植民地の 植民地）：草が 多く、当たり外れも 大きい
	kinoko: {
		id: "kinoko",
		objective: "boss",
		boss: {
			monster: "boss_kinonyan",
			rescue: "sprout",
			lines: [
				"足もとの　きのこが　ぐんぐん　伸びだした！",
				"きのこに　押し上げられて、地上まで　運ばれた",
			],
			cause: "親玉きのにゃんを　たおした",
		},
		// 胞子で 眠くなり（寝落ち民）、毒きのこ（まんぜう軍）が 多い
		foes: { neochi: 2, pumpkin: 2, pitcher: 0 },
		floors: 12,
		items: KINOKO_ITEMS,
		perFloor: [5, 8],
		level: KINOKO_LEVEL,
		unidentified: ["herb", "staff"],
		curses: false,
		start: ["f_large", "h_heal", "s_appraise"],
		goal: "kinonyan",
		houses: { from: 5, chance: 1 / 8, early: null },
		trapsFrom: 4,
		unlockAfter: "shallow",
		reliefAfter: null,
	},
	// 離島・沖縄板（総島民 6人）：過疎。敵も 道具も 少ない
	tropical: {
		id: "tropical",
		objective: "boss",
		boss: {
			monster: "boss_natsuko",
			rescue: "escort",
			lines: [
				"島民たちが　小舟で　迎えに　来た！",
				"川を　くだって、ふもとまで　降ろしてもらった",
			],
			cause: "怒れるナツコを　たおした",
		},
		// 風の 島（風吹けば名無し）と 浜の フナムシ（バグ）
		foes: { kaze: 3, funamushi: 2 },
		floors: 15,
		items: MAIN_ITEMS,
		perFloor: [4, 6],
		level: identity(15),
		unidentified: ALL_UNIDENTIFIED,
		curses: true,
		start: ["f_large"],
		goal: "yashi",
		houses: null,
		trapsFrom: 3,
		unlockAfter: "shallow",
		reliefAfter: null,
		sparse: 0.5,
		// 島の 山を 上る
		up: true,
	},
	// おんたこ（レスの 末尾に 😡 が つく 板）：どの 敵も 怒りっぽい
	konamono: {
		id: "konamono",
		objective: "boss",
		boss: {
			monster: "boss_takonomin",
			rescue: "eruption",
			lines: [
				"鉄板が　ぐつぐつと　煮えたぎる……",
				"鉄板が　噴火した！",
				"熱風で　ビルの　入口まで　吹き飛ばされた",
			],
			cause: "大たこのみんを　たおした",
		},
		// 😡の 板：顔真っ赤・連投荒らし・粘着アンチ
		foes: { oni: 3, ninja: 1.5, fallen: 1.5 },
		floors: 20,
		items: MAIN_ITEMS,
		perFloor: [5, 7],
		level: lagged(20),
		unidentified: ALL_UNIDENTIFIED,
		curses: true,
		// 怒った 敵から 立てなおす 草を 2つ
		start: ["f_large", "h_heal", "h_heal"],
		goal: "takoyaki",
		houses: { from: 3, chance: 1 / 16, early: [4, 6] },
		trapsFrom: 3,
		unlockAfter: "main",
		reliefAfter: null,
		angry: true,
		// 雑居ビルを 上る
		up: true,
	},
	// お祭り会場（おまC）：祭りが よく 出る
	festival: {
		id: "festival",
		objective: "boss",
		boss: {
			monster: "boss_mashii",
			rescue: "escort",
			lines: [
				"野次馬たちが　わっしょいと　集まってきた！",
				"神輿に　のせられて、やぐらの　下まで　運ばれた",
			],
			cause: "祭りの親分マシーを　たおした",
		},
		// 野次馬（コピペ）・群れ（凍結アカ）・炎上
		foes: { copipe: 2, yuki: 2, bomb: 2 },
		floors: 20,
		items: MAIN_ITEMS,
		perFloor: [5, 7],
		level: identity(20),
		unidentified: ALL_UNIDENTIFIED,
		curses: true,
		start: ["f_large"],
		goal: "uchiwa",
		houses: { from: 3, chance: 1 / 3, early: [3, 5] },
		// やぐらを 上る
		up: true,
		trapsFrom: 3,
		unlockAfter: "main",
		reliefAfter: null,
	},
	// 隠し：過去ログの底（保守村の 下の 古井戸。電池板を 持ち帰ると 開く）。99階で、階の 層ごとに 見た目と 曲が 変わる
	// （data/story.ts の BOARD_LOOKS の zones）。いちばん底の「蓄音キリコのうた」を 持ったまま 帰還スレで 帰れる
	hidden: {
		id: "hidden",
		objective: "fetch",
		floors: 99,
		items: HIDDEN_ITEMS,
		perFloor: [5, 7],
		level: HIDDEN_LEVEL,
		unidentified: ALL_UNIDENTIFIED,
		curses: true,
		start: ["f_large"],
		goal: "g1001",
		houses: { from: 3, chance: 1 / 10, early: [4, 6] },
		trapsFrom: 3,
		unlockAfter: "deep",
		reliefAfter: null,
		escapeWithGoal: true,
		secret: true,
	},
};

export const DUNGEON_IDS: readonly DungeonId[] = [
	"shallow",
	"main",
	"deep",
	"kinoko",
	"tropical",
	"konamono",
	"festival",
	"hidden",
];

/** 知らない id（壊れた記録など）は本編として読む。 */
export const dungeonById = (id: string | undefined): Dungeon =>
	DUNGEONS[id as DungeonId] ?? DUNGEONS.main;
