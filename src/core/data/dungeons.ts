// ダンジョン＝おんJの 植民地（おーぷん2ch の ほかの板）。村の 入口で 行き先を 選ぶ。
// 板ごとに 階の数・道具の出かた・決まり（板の 気風から）が ちがう。名前と 語りは data/story/story.ts、
// 見た目と 曲（板ごとに 1つ。全フロア 同じ）は ui/dungeon/theme.ts。
//
// - shallow：パン板（ぱんJ。いちばん 栄えた 植民地）の 3階。入門：杖だけ未識別・のろいなし・祭りなし・
//   罠は B3（底）から。パン松の 縄張りで パンが よく出る。持ち帰るのは「植民地化宣言」。
// - main：風呂板（おふJ）の 12階。湯治：HP の 自然回復が 1.5倍。
//
// 倉庫から 村で 引き取った 道具は たいていの 板へ 持ちこめる。noCarry の 板（電池板・離島板・過去ログの底）へは
// 持ちこめず、出るときに シヨが 倉庫へ もどす（わけは data/town/town.ts の CARRY_REFUSE）。
// - deep：電池板（でんJ。過疎で 謎が多い）の 16階。充電：杖の 回数が 1 多い。
//   ぜんぶ未識別・ぷゆゆパンと不食の指輪は出ない・罠が多い・祭りが出やすい。
//
// 目的（objective）：物語の 品を 運ぶ 板（パン板・風呂板・電池板・過去ログの底）は 持ち帰り（fetch）、
// 4つの 植民地は いちばん底の ボスを たおす（boss。たおすと 品ごと 一瞬で 入口へ 帰る）。
// パン板・風呂板にも 期間限定の ボスが いる（いつ boss に なるかは 村の イベント：data/story/objectives.ts。core は 決めない）。
//
// level は「その階が 本編の何階ぶんの強さか」。敵の顔ぶれ・罠の数と種類・祭りの大きさ・変化の杖は
// これで引く。見た目と曲の層は UI 側（ui/dungeon/theme.ts）。
//
// 本筋の 階の数は ポケダン（はじめの ダンジョンは 3階、物語の 山場でも 20階 ほど）に ならって 短く：
// パン板 3 → きのこ板 5 → 離島板 7 → おんたこ・お祭り 10 → 風呂板 14 → 電池板 20。
// 長く 潜らせる のは やり込みの 過去ログの底（99階）と 寄り道・裏の 板。
// 出だしは ゆるく、底へ 向けて 急に 上げる（ramp）。レベルは 毎回 1 から なので、短い 板ほど 着いたときの
// レベルが 低い。底の 強さ（*_TOP）は pnpm sim で クリア率を 見て 決める。

import type { ItemWeight } from "../itemTable";
import type {
	DungeonId,
	GuestId,
	ItemCat,
	Objective,
	RescueKind,
} from "../types";
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
	/** escort で かつがれる ときの かけ声（無ければ「わっしょい」）。 */
	cheer?: string;
	/** 帰り方の 行（たおして 品を 手に 入れた あと、順に 出す）。 */
	lines: readonly string[];
	/**
	 * 終わりの 理由（Ending.cause。記録・リプレイの 組み合わせに 使う ので 変えない。
	 * engine/save.ts の RENAMES の 左の 名前を 含めない）。
	 */
	cause: string;
	/** ボスを 見た ときの 行（正体を 明かす など）。 */
	intro?: readonly string[];
	/** 目的の 文で 出す 名前（会う まで 正体を 言わない ボス。無ければ ボスの 名前）。 */
	goalName?: string;
	/** ボスの 階に 着いた ところに 置いて ある 道具と、着いた ときの 1行（先回りした 人の 差し入れ）。 */
	supply?: { items: readonly string[]; line: string };
};

/** 底の 出来事（目的が event。着くと 品を もらって 入口へ 帰る）。 */
export type EventSpec = {
	/** 目的の 文（全体マップ・行き先えらび。「〜する」）。 */
	goal: string;
	/** 帰り方（画面の 演出の 種類）。 */
	rescue: RescueKind;
	/** escort で かつがれる ときの かけ声（無ければ「わっしょい」）。 */
	cheer?: string;
	/** 着いた ときの 行（順に 出す）。 */
	lines: readonly string[];
	/** 終わりの 理由（Ending.cause。記録・リプレイの 組み合わせに 使う ので 変えない）。 */
	cause: string;
	/** どう 帰ったか（冒険の記録の 札で「（品）ごと、〜」）。 */
	home: string;
};

/** 送り届ける 人（目的が deliver。はじめから ついてきて、底に 着くと 出来事・品・入口へ）。 */
export type DeliverSpec = EventSpec & { guest: GuestId };

/** 連れ帰る 人（目的が bring。底で 加わって 品を もらい、帰り道に なる）。 */
export type BringSpec = {
	guest: GuestId;
	/** 目的の 文（「〜する」）。 */
	goal: string;
	/** 底で 加わる ときの 行。 */
	lines: readonly string[];
	/** 入口に 着いた ときの 終わりの 理由（記録・リプレイの 組み合わせに 使う ので 変えない）。 */
	cause: string;
};

/**
 * いちばん底の 集落（STORY.md §4.9 の 場面の 一覧）。敵・罠が なく、板の 人が 立って いる（ぶつかると 話す）。
 * key の 人に 話すと 目的が すすむ（event・deliver：その場で 帰る・bring：加わって 帰り道）。
 */
export type SettlementSpec = {
	name: string;
	folk: readonly {
		name: string;
		sprite: string;
		lines: readonly string[];
		key?: true;
	}[];
};

/**
 * 名所の 階（長い 板の 一息。STORY.md §4.9 の 場面の 一覧）。敵・罠・道具が なく、地図が はじめから 見える。
 * 合う 板にだけ 置く（作者「全部が 全部に 搭載する ものでは ない」）。1000 の カウントは 進む。
 */
export type RestFloor = {
	depth: number;
	name: string;
	/** 源泉（踏むと HP が もどる）を 置く。 */
	spring?: true;
	/** 立って いる 人（ぶつかると 話す。SettlementSpec の folk と 同じ）。 */
	folk?: SettlementSpec["folk"];
	/** 着いた 部屋に 置いて ある 道具（売店の パン など。長い 板の 中ほどの 補給）。 */
	gifts?: readonly string[];
};

export type Dungeon = {
	id: DungeonId;
	/**
	 * 目的の 既定（村の 期間限定の イベントで かわる ことも ある：data/story/objectives.ts）。
	 * boss に できるのは boss の ある 板だけ。
	 */
	objective: Objective;
	/** 目的が boss の ときの ボス（無い 板は boss に ならない）。 */
	boss?: BossSpec;
	/** 階の 数（randomFloors の 板は いちばん 深い ときの 数）。 */
	floors: number;
	/**
	 * 底の 深さが 潜るたびに かわる（ポケダンの 階が 決まらない ダンジョンに ならった。おんMu）。
	 * Run.create が min〜max から 1つ 引いて RunState.floors に 書き、level は その 深さで 作りなおす
	 * （dungeonOf）。floors と level は max の ときの もの。
	 */
	randomFloors?: {
		min: number;
		max: number;
		level: (n: number) => readonly number[];
	};
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
	/**
	 * 始めの持ち物（ぷゆゆが 持たせる お弁当の ぷゆゆパン。村で もらって いなければ 持たない：Run.create の lunch）。
	 */
	start: readonly string[];
	/** いちばん底で拾って 持ち帰る品。 */
	goal: string;
	/** 祭り（モンスターハウス）：from 階から chance ずつ。early の階までに無ければ その間のどこかに1つ。null なら無し。 */
	houses: {
		from: number;
		chance: number;
		early: readonly [number, number] | null;
	} | null;
	/**
	 * かならず 祭りに なる 階（その 板の 山場）。部屋に 集まって いるのは monster だけで、
	 * 起きると name を 知らせる（パン板の 独立記念パレード）。
	 */
	parade?: { depth: number; name: string; monster: string; line?: string };
	/** この階より浅い階には罠を置かない。 */
	trapsFrom: number;
	/** 1階に 武器を 1本は 置く（入門の 板。core/floor.ts）。 */
	firstWeapon?: boolean;
	/** このダンジョンを持ち帰ると開く（null ははじめから開いている。unlockFlag だけ あれば その 旗で 開く）。 */
	unlockAfter: DungeonId | null;
	/**
	 * 開くには この 旗（Progress.flags）も 要る（ボカロ作り避難所：ロゼの 依頼）。
	 * unlockAfter が なければ 旗 だけで 開く（町の 寄り道で 見つける 板：data/town/finds.ts）。
	 */
	unlockFlag?: string;
	/** 開くまで 全体マップにも 一覧にも 出さない（？？？ の 影も 出さない。ボカロ作り避難所）。 */
	hidden?: true;
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
	/** 持ち帰る 品を 持ったまま 帰還スレで 帰れる（99階ある 隠しの 板と、50階の †闇の板†）。 */
	escapeWithGoal?: boolean;
	/** 全体マップに 出さない（隠し。過去ログの底は 村の 広場の 井戸から 降りる）。 */
	secret?: boolean;
	/** 倉庫の 道具を 持ちこめない（出るときに シヨが 預かる）。 */
	noCarry?: boolean;
	/** 名所の 階（RestFloor）。 */
	rests?: readonly RestFloor[];
	/** いちばん底の 集落（SettlementSpec）。 */
	settlement?: SettlementSpec;
	/** 底の 出来事（目的が event の とき）。 */
	event?: EventSpec;
	/** 送り届ける 人（目的が deliver の とき）。 */
	deliver?: DeliverSpec;
	/** 連れ帰る 人（目的が bring の とき）。 */
	bring?: BringSpec;
	/**
	 * スレの 勢い：この ターン数ごとに レスが もう 1つ ふえる（1000 に 早く 近づく。電池板の 時間との 競争：
	 * STORY.md §4.9）。無ければ 1ターンで 1。
	 */
	rushEvery?: number;
	/**
	 * 上りの 植民地（塔・やぐら・山）。階は 上へ 数え、帰り道は 降りる。中の 動きは 下りと 同じで、
	 * 文と 見せかただけ 逆（depth が 大きいほど 高い）。
	 */
	up?: boolean;
};

/**
 * 難易度の 指針（作者の 指示。2026-10-12）：レベルは 毎回 1から（引きつぎは ヌルゲーに なるので しない）。
 * どの 板も「レベル1 から 始めて、運さえ よければ クリアできる」に 合わせる。
 * 見かたは README の「難易度の 指針」。
 *
 * 階 → 本編の 何階ぶんか：1階は 1、いちばん底（n階）は top。あいだは 1.5乗の 曲がりで 上げる（四捨五入）。
 * まっすぐ だと 3階で もう レベル4〜5 に なり、Lv2〜3 の ころに 倒れる 冒険が 固まった（pnpm sim）。
 * 出だしは 本編と 同じ 1階に 1 ずつ、後ろほど 急に（着いた ころには 経験値も 多い）。
 * 短い 板・のんびり諸島・避難J は 曲がりを 2乗（避難J は 1.6）に して、前半を 本編と 同じ くらいに する
 * （1.5 では 13階の 板の 7階で もう 本編の 10階ぶんに なった。作者の 指示 2026-10-11）。
 */
const RAMP_CURVE = 1.5;
const ramp = (n: number, top: number, curve = RAMP_CURVE): number[] =>
	Array.from({ length: n + 1 }, (_, i) =>
		i === 0
			? 0
			: n === 1
				? top
				: Math.round(1 + (top - 1) * ((i - 1) / (n - 1)) ** curve),
	);

/** 1階が 本編の from階ぶんで 始まる ramp（おんキム：1階から 敵が 強い）。底は top。 */
const rampFrom = (n: number, from: number, top: number, curve = 1): number[] =>
	ramp(n, top - from + 1, curve).map((v, i) => (i === 0 ? 0 : v + from - 1));

const ALL_UNIDENTIFIED: readonly ItemCat[] = [
	"ring",
	"herb",
	"scroll",
	"staff",
];

/**
 * パン板の 道具の出かた（重みの合計 66）。重みは 割合で、3階で 出るのは 20ほど
 * 指輪は無し・杖は4種（ここだけ未識別）。
 */
export const SHALLOW_ITEMS: readonly ItemWeight[] = [
	// 武器 7。2026-10-13 作者：「名無しの剣ばかり 出る」。易しく するのに 種類を しぼるのでは なく、
	// 強さの 上限だけ 抑えて 4種を ばらけさせる（たおれた あとの ぷゆゆソードも あるので 易しさは 軽めで いい）
	{ kind: "club", weight: 2 }, // 攻撃1。弱い武器・投げる物として
	{ kind: "copper", weight: 2 }, // 攻撃3。ありふれた剣
	{ kind: "bat", weight: 2 }, // 攻撃4
	{ kind: "wyrmbane", weight: 1 }, // 攻撃5。当たりの1本
	// 盾 7（武器と 同じく 種類を ばらけさせる）
	{ kind: "leather", weight: 1 }, // 防御2。おなかが へりにくい。もっと深い迷宮で要る知恵を ここで見せる
	{ kind: "bronze", weight: 2 }, // 防御3。ありふれた盾
	{ kind: "mirror", weight: 1 }, // 防御5。錆びない
	{ kind: "scale", weight: 2 }, // 防御4。にょっす牛（レベル4〜）・毒矢の罠（レベル4〜）の ちから下げを防ぐ、を教える
	{ kind: "steelsh", weight: 1 }, // 防御6。鋼鉄の盾の位置。いちばん強い盾で 1枚だけ
	// 矢 5（ちょっと は 矢が多め：7.8%）
	{ kind: "a_wood", weight: 3 }, // 寝落ち民・ゾンJ民を 離れて削る
	{ kind: "a_iron", weight: 2 }, // 本編の 3束に 対して 2束の 割合（ちょっと は 鉄・銀の矢のほうが 木より多かった）
	// 食べもの 5（ちょっと：片親パン・ぷゆゆパン・チギュリパン が 1:1:1、全体の 9.4%）。
	// 3階（1000ターンほど）は 始めの 大きな パンと ぷゆゆの お弁当で 足りるので、床の パンは 1階 10% ほど
	// （多いと 始めの 200% と お弁当・パン兵の ぶんが まるまる 余る。長い 板は 1階 25% ほど）
	{ kind: "f_bread", weight: 1 }, // +50%。ぷゆゆパン（+100%）は 床に 出さない（始めの 1つと お弁当で 足りる）
	{ kind: "f_moldy", weight: 1 }, // +100% だが ちから−1・HP−5。「食べものにも 外れがある」を1回だけ
	// 杖 5（ちょっと の4種：いかずち・バシルーラ・変化・メダパニ。ここだけ未識別。振って見分ける）
	{ kind: "w_bolt", weight: 2 }, // いかずち。20前後のダメージで いちばん見分けやすい。2本目で「わかった杖を また拾う」を味わう
	{ kind: "w_send", weight: 1 }, // バシルーラ。困ったときの逃げ道
	{ kind: "w_reel", weight: 1 }, // メダパニ
	{ kind: "w_change", weight: 1 }, // へんげ（候補は レベル+4 まで。B4（レベル7）なら レベル11 の敵もありうる）
	// 草 21（識別ずみ。ちょっと：弟切草・薬草・毒けし草×2・ちからの種・ルーラ草・火炎草・まどわし草）
	{ kind: "h_heal", weight: 7 }, // 草の 1/3。始めの1つと合わせて 3階で 3つほど
	{ kind: "h_greater", weight: 3 }, // 弟切草。ちょっと では 薬草と同じだけ出たが、ここは 強いので少なめ
	{ kind: "h_antidote", weight: 4 }, // ちょっと では 草の中で倍の率。にょっす牛・毒矢の罠・チギュリパンの あと始末
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
	//   コテハンの剣より 強い 武器・鉄板より 強い 盾（もっと強い品は 本編から）、眠り・封印・鈍足・諸刃・分裂・加速の杖
];

/**
 * はじめの3階の 階 → 本編の何階ぶんか。B1〜2 は罠なし、B3 から罠、B3 は 本編の B4。
 * ゾンJ民・風吹けば名無し から 先は きのこ板と 本編で。
 */
export const SHALLOW_LEVEL: readonly number[] = [
	0, // [0] 使わない
	1, // B1：ぷゆゆ・dat落ちの霊・夏休みキッズ・ROM専。罠なし
	2, // B2：kskボット・寝落ち民（眠りの呪文）が 加わる。罠なし
	4, // B3：にょっす牛・コピペ が 加わる。罠も（毒矢の罠まで）。針を 拾って 帰る。
	//     ゾンJ民は きのこ板から。1つ 先の 強さ（5）で 出すと、Lv4 前後で 着く 入門の 板では 倒れた 冒険の
	//     7割が 底の ゾンJ民に なる（2026-10-10 ボット）
];

/**
 * 電池板（16階）と 裏の 30階の 板の 道具の出かた（重みの合計 210。本編 ×1.5 から ぷゆゆパン・不食の指輪を抜き、マイナスの品を ふやし、
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
	// 指輪 14（4つに1つは のろい。不食の指輪は 入れない）
	{ kind: "r_might", weight: 3 }, // もっと で いちばん多い指輪の1つ。のろいなら −3 なので 当たりとは かぎらない
	{ kind: "r_hunger", weight: 3 }, // 本編1 → 3（もっと の ハラペコ は 指輪で いちばん多い）。食べものを HP に 変える（回復も 2倍）。のろわれて外せないと 食べものが半分の価値
	{ kind: "r_clamor", weight: 2 }, // マイナス（ザメハ）。本編1 → 2
	{ kind: "r_trap", weight: 1 }, // 罠7〜9の階で 強すぎるので 1つだけ（もっと でも 13/256 と少ない）
	{ kind: "r_awake", weight: 1 }, // 本編と同じ
	{ kind: "r_purity", weight: 1 }, // 本編と同じ（解毒草・うろこの盾が ほかにある）
	{ kind: "r_stealth", weight: 1 }, // 祭りが多い迷宮で 強い（もっと の とうぞく 11/256）。1つだけ
	{ kind: "r_ward", weight: 1 }, // 文字化け（レベル17〜）が B17-30 に出るので 強い（人形よけ）。1つだけ
	{ kind: "r_patrol", weight: 1 }, // 巡回（ときどき 飛ぶ）。逃げ道にも 迷子にも なる
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
	{ kind: "h_antidote", weight: 6 }, // 毒草8・チギュリパン5・にょっす牛・毒矢の罠 が 多いので 本編3 → 6
	{ kind: "h_fire", weight: 2 }, // もっと では 消えた 火炎草。1つ減らして 本編より まれに
	{ kind: "h_sight", weight: 3 }, // 罠7〜9 と 透明あぼーん（見えない。レベル15〜）に。本編2 → 3
	// スレ 58（未識別）
	{ kind: "s_appraise", weight: 12 }, // 本編8 × 1.5。マイナスの品が多いぶん 階あたりは 本編と同じに保つ
	{ kind: "s_whet", weight: 5 }, // 30階ぶんの 装備の育ち。本編3 × 1.5 を切り上げ
	{ kind: "s_temper", weight: 5 }, // 同じ
	{ kind: "s_uncurse", weight: 4 }, // 指輪・装備が ふえ、のろいの数も ふえるので 本編2 → 4
	{ kind: "s_rustproof", weight: 1 }, // もっと では 消えた メッキ。1枚だけ
	{ kind: "s_map", weight: 6 }, // 罠7〜9 を見せる。本編3 → 6
	{ kind: "s_sense", weight: 2 }, // もっと では 消えた 地獄耳。本編と同じ2枚（階あたり 2/3）
	{ kind: "s_treasure", weight: 2 }, // もっと では 消えた 千里眼。本編と同じ2枚
	{ kind: "s_hold", weight: 5 }, // 本編3 × 1.5 を切り上げ（もっと にも ある）
	{ kind: "s_blast", weight: 3 }, // もっと では 消えた イオ。本編と同じ3枚（階あたり 2/3）
	{ kind: "s_ward", weight: 1 }, // 結界。いちばん強いスレは 1枚のまま（もっと の 聖域 2/256）
	{ kind: "s_recharge", weight: 3 }, // もっと の 祈り。本編2 → 3
	{ kind: "s_bread", weight: 2 }, // もっと の パンの巻物。ぷゆゆパンが 床に無いぶんの 逃げ道
	{ kind: "s_snare", weight: 5 }, // マイナス（ワナの巻物）。本編2 → 5
	{ kind: "s_gacha", weight: 1 }, // もっと だけの パルプンテ。当たりも 外れも 大きいので 1枚
	// 杖 19（未識別）
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
	{ kind: "w_batsu", weight: 1 }, // マイナス。見えない 敵が ふえる
	{ kind: "w_afi", weight: 1 }, // マイナス。道具を 取られる
	{ kind: "w_totsu", weight: 1 }, // マイナス。敵を 呼び寄せる（通路に 引きこむにも）
	{ kind: "w_rebut", weight: 1 }, // もっと だけの ザキ。回数0で 出るので 次スレと 組んで はじめて 強い
	// 矢 9
	{ kind: "a_wood", weight: 6 }, // 本編4 × 1.5
	{ kind: "a_iron", weight: 3 }, // 本編2 × 1.5
	// 食べもの 23（ぷゆゆパンは 入れない。もっと の 片親パン:チギュリパン ≒ 2:1）
	// 床の パンは 1階 25% ほど（多いと 始めの 200% と お弁当・パン兵の ぶんが まるまる 余る）
	{ kind: "f_bread", weight: 13 }, // +50%（2026-10-17：スレが 早く 進む ぶん 多く）
	{ kind: "f_moldy", weight: 4 }, // +100%（ちから−1・HP−5）
];

/**
 * きのこ板の 道具の出かた。パン板の 表から 草を ふやし、毒草・眠り草・まどわし草も ふやした
 * （きのこの 当たり外れ。草は 未識別）。
 */
export const KINOKO_ITEMS: readonly ItemWeight[] = [
	...SHALLOW_ITEMS.filter(
		(e) => ITEMS[e.kind]?.cat !== "herb" && ITEMS[e.kind]?.cat !== "food",
	),
	// 指輪と 杖を すこし（入門の つぎ。品の 顔ぶれを 広げて、拾う たびに 何が 出るかを 楽しむ）
	{ kind: "r_might", weight: 1 },
	{ kind: "r_awake", weight: 1 },
	{ kind: "r_clamor", weight: 1 },
	{ kind: "w_sleep", weight: 1 },
	{ kind: "w_slow", weight: 1 },
	// 食べもの（パン板より 少し 多め。5階。短い 板なので 床の パンは 1階 10% ほど。多いと パンが たまる だけ）
	{ kind: "f_bread", weight: 2 },
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
const KINOKO_LEVEL: readonly number[] = ramp(5, 5, 2);

/** 本筋の 板の 底の 強さ（本編の 何階ぶんか）。pnpm sim で クリア率を 見て 決める。 */
const TROPICAL_TOP = 8;
const KONAMONO_TOP = 11;
const FESTIVAL_TOP = 12;
const MAIN_TOP = 13;
const DEEP_TOP = 14;

/**
 * 隠しの 99階の 道具の出かた：風呂板の 表で、食べものを ふやした（99階ぶん 歩くので。
 * ぷゆゆパン・片親パン を 倍、飯テロスレも 倍）。
 */
/** 風呂板の 道具（12階と 長いので 大きな パンを 少し 多く。飢え死にを へらす）。 */
const BATH_ITEMS: readonly ItemWeight[] = MAIN_ITEMS.map((e) =>
	e.kind === "f_large" ? { ...e, weight: e.weight + 2 } : e,
);

const HIDDEN_ITEMS: readonly ItemWeight[] = MAIN_ITEMS.map((e) =>
	e.kind === "f_bread" || e.kind === "f_large" || e.kind === "s_bread"
		? { kind: e.kind, weight: e.weight * 2 }
		: e,
);

/**
 * ボカロ作り避難所（6階）の 道具の出かた：きのこ板と 同じ ころに 開くので、
 * パン板の 表を 下地に 草と 杖を すこし 足す（草と 杖が 未識別）。
 */
const VOCALO_ITEMS: readonly ItemWeight[] = [
	...SHALLOW_ITEMS,
	{ kind: "steel", weight: 1 },
	{ kind: "r_might", weight: 1 },
	{ kind: "r_trap", weight: 1 },
	{ kind: "r_clamor", weight: 1 },
	{ kind: "h_blink", weight: 2 },
	{ kind: "h_daze", weight: 2 },
	{ kind: "w_slow", weight: 1 },
];

/** 隠しの 99階：本編の 30階ぶんまで 少しずつ 強くなり、61階から 先は ずっと 30階ぶん。 */
const HIDDEN_LEVEL: readonly number[] = Array.from({ length: 100 }, (_, i) =>
	i === 0 ? 0 : Math.min(30, 1 + Math.floor(((i - 1) * 29) / 60)),
);

export const DUNGEONS: Record<DungeonId, Dungeon> = {
	shallow: {
		id: "shallow",
		objective: "fetch",
		// 底は パン王国の 城下町（板主 パン松。STORY.md §4.9）
		settlement: {
			name: "パン王国の城下町",
			folk: [
				{
					name: "パン王",
					sprite: "pub:sprites/minors_panmatsu.png",
					lines: [
						"独立したかっただけや",
						"国旗は食パンや。文句あるか",
						"旗は持ってってええ。予備ならある",
						"弟のパン松が、町で大使をしとる",
					],
				},
				{
					name: "ロゼ",
					sprite: "sa:mHhx69",
					lines: [
						"先に来て、説教しといたアル",
						"独立は、書類で申請するアル",
						"王さま、ちょっと泣いてたアル",
					],
				},
				{
					name: "パン兵",
					sprite: "pub:sprites/panhei.png",
					lines: ["ここは城下町や。剣はしまえ", "パン、焼きたてやで"],
				},
				{
					name: "パン兵",
					sprite: "pub:sprites/panhei.png",
					lines: ["独立記念セール、やっとるで"],
				},
			],
		},
		boss: {
			monster: "boss_panhei",
			rescue: "escort",
			cheer: "えっさ",
			lines: [
				"どこからかパン松の号令がひびいた！",
				"パン兵たちがキリコをかつぎあげた",
				"「おんJ民は帰れ！」入口まで運び出された",
			],
			cause: "パン兵長をたおした",
		},
		// パン松は やきうが きらい（ピッチャーは 追い出した）。にょっす牛（前の名前 まんぜう軍＝まんじゅう）は パンの なかま。
		// 寝落ち民は 入門の 板では 少なめ（2026-10-03 ボットで パン板の 死因の 6割・B2 に 固まった）
		foes: { pumpkin: 2, pitcher: 0, neochi: 0.4 },
		floors: 3,
		items: SHALLOW_ITEMS,
		perFloor: [5, 9],
		level: SHALLOW_LEVEL,
		unidentified: ["staff"],
		curses: false,
		start: ["f_large"],
		goal: "needle",
		houses: null,
		// 山場：城下町の 手前で パン兵の 行進に 出くわす（とられた 物は たおせば もどる。かわりに パンを 置いていく）
		parade: {
			depth: 2,
			name: "独立記念パレード",
			monster: "panhei",
			line: "パン兵「観覧無料や！持ち物は置いてけ」",
		},
		trapsFrom: 3,
		firstWeapon: true,
		unlockAfter: null,
		reliefAfter: null,
	},
	main: {
		id: "main",
		// 42℃派の 番頭と 本気の 勝負（STORY.md §4.9）
		objective: "boss",
		// 露天の 源泉：シヨが 先回りして 湯温を 測って いる（ライバルの 先回り）
		rests: [
			{
				depth: 7,
				name: "露天の源泉",
				spring: true,
				folk: [
					{
						name: "シヨ",
						sprite: "sa:y8Kr53",
						lines: [
							"べ、べつに先回りしてないわよ",
							"42℃は熱い。41℃はぬるいわ",
							"……41.5℃なら、入ってあげる",
						],
					},
				],
			},
		],
		boss: {
			monster: "boss_ofurou",
			rescue: "geyser",
			lines: [
				"足もとの源泉がごぼごぼとわきだした……",
				"湯柱が噴きあがった！どう見ても42℃",
				"湯柱に押し上げられて、入口までもどった",
			],
			cause: "湯守おふ郎くんをたおした",
		},
		// 風呂に 入らない 界隈が 湯を ねらう。湯で 眠くなる
		foes: { sabi: 2, neochi: 1.5 },
		floors: 12,
		items: BATH_ITEMS,
		perFloor: [5, 7],
		// 序盤を ゆるく：曲がりを 2乗に。祭りは B5 から、はじめの 1つは B6〜8 に
		level: ramp(12, MAIN_TOP, 1.5),
		unidentified: ALL_UNIDENTIFIED,
		curses: true,
		start: ["f_large"],
		goal: "genban",
		houses: { from: 5, chance: 1 / 16, early: [6, 8] },
		trapsFrom: 3,
		// パン板（3階）から いきなり 12階に ならないよう、きのこ板（5階）を はさむ。
		// きのこ板で 倒れつづけた ときの 救いは 倉庫の 封鎖を 解く こと（data/town/incidents.ts の reliefAfter）
		unlockAfter: "kinoko",
		reliefAfter: null,
		// 湯治：150 → 100（1.5倍）
		regenStep: 100,
	},
	deep: {
		id: "deep",
		noCarry: true,
		// 底で 見出しを 盛って いた 名無し（やきう）と 戦う（STORY.md §4.9 の 結）
		objective: "boss",
		boss: {
			monster: "boss_yakiu",
			rescue: "escort",
			cheer: "おつかれ",
			lines: [
				"やきうは、見出しを書く手を止めた",
				"電池ニキが発電機を回しなおした",
				"明かりの道を、入口まで送ってもらった",
			],
			cause: "やきうをたおした",
			// 正体を 明かす（STORY.md §4.9 の 転と 結）。見る まで 目的の 文でも 名前を 言わない
			goalName: "てっぺんの名無し",
			intro: [
				"見出しを書いていた名無し……やきうだ。",
				"やきう「盛ったら人が見に来るやろ」",
				"やきう「昔は遊びで侵略しとっただけやのにな」",
				"やきう「まだや。盛り上がりが足らん」",
			],
		},
		// 見学コース：電池ニキ（ひとりで 電気を 送って きた 最後の 住人）と、先回りした フェリス
		rests: [
			{
				depth: 8,
				name: "発電所の見学コース",
				folk: [
					{
						name: "電池ニキ",
						sprite: "pub:sprites/denchan.png",
						lines: [
							"見学者0人や。あんたで1人目や",
							// 先回りした フェリスへの ツッコミ
							"そっちの子は柵越えや。数えへん",
							"売店のパン、持っていき。売れ残りや",
							"人が来んでも、電気だけは送っとった",
							"てっぺんで、名無しが待っとるで",
						],
					},
					{
						name: "フェリス",
						sprite: "sa:4KtOzD",
						lines: [
							"先に来ちゃった〜。1人目は私〜",
							"また燃えようよ〜",
							"消えかけでも、何回でも復活できるよ〜",
						],
					},
				],
				// 見学コースの 売店の 売れのこり（16階の 中ほどの 補給）
				gifts: ["f_large", "f_bread", "f_bread", "h_heal"],
			},
		],
		// 時間との 競争：3ターンに 1つ 余分に レスが つく（1000 まで 約 3/4 の 時間）
		rushEvery: 3,
		// 機械と 回線の 敵が 多い
		foes: { ksk: 1.5, ninpo: 1.5, ufo: 1.5, mojibake: 1.3, kage: 1.3 },
		floors: 16,
		items: DEEP_ITEMS,
		perFloor: [5, 8],
		// 風呂板と 同じく 序盤を ゆるく（曲がり 1.3）。祭りは B5 から、はじめの 1つは B6〜8 に
		level: ramp(16, DEEP_TOP, 1.3),
		unidentified: ALL_UNIDENTIFIED,
		curses: true,
		start: ["f_large"],
		goal: "tsuzuki",
		houses: { from: 5, chance: 1 / 10, early: [6, 8] },
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
				// 先回りした プロトの 数え（intro の 128本）の オチ
				"プロト「127本になりました」",
				"きのこが伸びだした！「たけのこより速いやろ」",
				"きのこに押し上げられて、地上まで運ばれた",
			],
			cause: "親玉きのにゃんをたおした",
			// ゼロの サブ機が 先回りして 行進を 数えて いた（ライバルの 先回り。STORY.md §4.9）
			intro: [
				"プロト「数えました。行進は128本です」",
				"プロト「先頭は、あの親玉です」",
			],
			// はじめての ボス：着いた 部屋に 薬草（2026-10-17 ボット：底に 着いても 親玉に 勝てるのは 68%）
			supply: {
				items: ["h_heal"],
				line: "足もとにプロトのメモ『親玉は階段の部屋です。薬草をどうぞ』",
			},
		},
		// 胞子で 眠くなり（寝落ち民）、毒きのこ（にょっす牛）が 多い。
		// 寝落ち民は 少なめ（眠らされて なぐられつづけるのが 序盤で いちばん 理不尽なので）
		foes: { neochi: 1, pumpkin: 2, pitcher: 0 },
		floors: 5,
		items: KINOKO_ITEMS,
		perFloor: [5, 8],
		level: KINOKO_LEVEL,
		unidentified: ["herb", "staff"],
		curses: false,
		start: ["f_large"],
		goal: "kinonyan",
		houses: { from: 3, chance: 1 / 8, early: null },
		trapsFrom: 3,
		unlockAfter: "shallow",
		reliefAfter: null,
	},
	// 離島・沖縄板（総島民 6人）：過疎。敵も 道具も 少ない
	tropical: {
		id: "tropical",
		noCarry: true,
		// 押しかけてきた 島民を 島の 山の てっぺんまで 送り返す（STORY.md §4.9）
		objective: "deliver",
		// てっぺんは 島の 集落。長に 話すと 送り届けた ことに なる
		settlement: {
			name: "山の上の集落",
			folk: [
				{
					name: "島民の長",
					sprite: "pub:sprites/natsuko.png",
					lines: ["……みんな、おかえり"],
					key: true,
				},
				{
					name: "島民",
					sprite: "pub:sprites/natsuko.png",
					lines: ["島はええで", "浜、また行きたいな"],
				},
				{
					name: "島民",
					sprite: "pub:sprites/natsuko.png",
					lines: ["総島民6人や"],
				},
			],
		},
		deliver: {
			guest: "islander",
			goal: "島民を山の上へ送る",
			rescue: "escort",
			cheer: "またやー",
			lines: [
				"山の上の集落に着いた。",
				"島民「……島や。帰ってきた」",
				"6人に見送られて、ふもとへ降りた",
			],
			cause: "島民を送り届けた",
			home: "島民たちに見送られて帰った",
		},
		boss: {
			monster: "boss_natsuko",
			rescue: "escort",
			cheer: "またやー",
			lines: [
				"島民たちが小舟で迎えに来た！",
				"島民6人、全員来た。島がからっぽだ",
				"川をくだって、ふもとまで降ろしてもらった",
			],
			cause: "怒れるナツコをたおした",
		},
		// 風の 島（風吹けば名無し）と 浜の フナムシ（ROM専）
		foes: { kaze: 3, funamushi: 2 },
		floors: 7,
		items: MAIN_ITEMS,
		perFloor: [4, 6],
		// きのこ板（底で 本編5階ぶん）の つぎ。過疎で 経験値が 少ないので 曲がりを 2乗に
		level: ramp(7, TROPICAL_TOP, 2),
		unidentified: ALL_UNIDENTIFIED,
		curses: true,
		start: ["f_large"],
		goal: "yashi",
		houses: null,
		trapsFrom: 3,
		unlockAfter: "kinoko",
		reliefAfter: null,
		sparse: 0.5,
		// 島の 山を 上る
		up: true,
	},
	// おんたこ（レスの 末尾に 😡 が つく 板）：どの 敵も 怒りっぽい
	konamono: {
		id: "konamono",
		// たこパの お誘い（STORY.md §4.9）：最上階の たこパ会場で 粉もん奉行に 話せば 帰れる
		objective: "event",
		settlement: {
			name: "最上階のたこパ会場",
			folk: [
				{
					name: "粉もん奉行",
					sprite: "pub:sprites/takonomin.png",
					lines: ["来たな。返しを見せてみい"],
					key: true,
				},
				{
					name: "たこ民",
					sprite: "pub:sprites/takonomin.png",
					lines: ["😡はタコの顔やで", "青のり、かけ放題や"],
				},
				{
					name: "たこ民",
					sprite: "pub:sprites/takonomin.png",
					lines: ["招待状、届いたか？"],
				},
			],
		},
		event: {
			goal: "最上階のたこパに行く",
			rescue: "escort",
			cheer: "まいど",
			lines: [
				"最上階は、たこパ会場だった。",
				"粉もん奉行「返しが甘い！」",
				"たこ焼きを焼いて、入口まで送ってもらった",
			],
			cause: "たこパに参加した",
			home: "たこパのあと送ってもらった",
		},
		boss: {
			monster: "boss_takonomin",
			rescue: "eruption",
			lines: [
				"鉄板がぐつぐつと煮えたぎる……",
				"鉄板が噴火した！😡",
				"熱風でビルの入口まで吹き飛ばされた",
			],
			cause: "大たこのみんをたおした",
		},
		// 😡の 板：顔真っ赤・連投荒らし・粘着アンチ。怒りの レスで スレが あがりつづけるので、dat落ちの霊は 出ない
		// （1階から 怒るので、素手の Lv1 で 3発 かかる 霊が 怒って 2回ずつ なぐり、1階で 倒れる 冒険が 19% あった → 5%。2026-10-04 ボット）
		foes: { oni: 3, ninja: 1.5, fallen: 1.5, hitodama: 0 },
		floors: 10,
		items: MAIN_ITEMS,
		perFloor: [5, 7],
		level: ramp(10, KONAMONO_TOP, 2),
		unidentified: ALL_UNIDENTIFIED,
		curses: true,
		start: ["f_large"],
		goal: "takoyaki",
		houses: { from: 3, chance: 1 / 16, early: [4, 6] },
		trapsFrom: 3,
		unlockAfter: "tropical",
		reliefAfter: null,
		angry: true,
		// 雑居ビルを 上る
		up: true,
	},
	// お祭り会場（おまC）：祭りが よく 出る
	festival: {
		id: "festival",
		// やぐらから 降りられない 親分を 入口まで 連れ帰る（STORY.md §4.9）
		objective: "bring",
		// てっぺんは やぐら広場と 夜店。親分に 話すと 加わる
		settlement: {
			name: "やぐら広場",
			folk: [
				{
					name: "祭りの親分",
					sprite: "pub:sprites/mashii.png",
					lines: ["そこの、手ぇ貸してくれ"],
					key: true,
				},
				{
					name: "夜店の人",
					sprite: "sa:8DXRgk",
					lines: ["金魚すくい、やってくで", "太鼓、止まらんな"],
				},
				{
					name: "夜店の人",
					sprite: "sa:f6k97v",
					lines: ["わたあめ、焼きそば、ラムネ"],
				},
			],
		},
		bring: {
			guest: "oyabun",
			goal: "親分を連れ帰る",
			lines: ["やぐらの上に、親分がいた。"],
			cause: "親分を連れ帰った",
		},
		boss: {
			monster: "boss_mashii",
			rescue: "escort",
			lines: [
				"野次馬たちがわっしょいと集まってきた！",
				"だれかが「見出し確定！」と叫んだ",
				"神輿にのせられて、やぐらの下まで運ばれた",
			],
			cause: "祭りの親分マシーをたおした",
		},
		// 野次馬（コピペ）・群れ（VIPPER）・炎上
		foes: { copipe: 2, yuki: 2, bomb: 2 },
		floors: 10,
		items: MAIN_ITEMS,
		perFloor: [5, 7],
		level: ramp(10, FESTIVAL_TOP, 2),
		unidentified: ALL_UNIDENTIFIED,
		curses: true,
		start: ["f_large"],
		goal: "uchiwa",
		// 祭りの 板なので 祭り（モンスターハウス）を 多めに（2026-10-12：1/3 → 1/2。作者「頻度を 増やしても よい」）
		houses: { from: 3, chance: 1 / 2, early: [3, 5] },
		// やぐらを 上る
		up: true,
		trapsFrom: 3,
		unlockAfter: "konamono",
		reliefAfter: null,
	},
	// 隠し：過去ログの底（おんJタウンの 下の 古井戸。電池板を 持ち帰ると 開く）。99階で、階の 層ごとに 見た目と 曲が 変わる
	// （data/story/story.ts の BOARD_LOOKS の zones）。いちばん底の「蓄音キリコのうた」を 持ったまま 帰還スレで 帰れる
	hidden: {
		id: "hidden",
		noCarry: true,
		rests: [20, 40, 60, 80].map((depth) => ({
			depth,
			name: "静かな石室",
			spring: true as const,
		})),
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
	// ボカロ作り避難所：束音ロゼの 依頼（engine/heroes.ts）。ボカロ制作スレが 荒らされた とき、ロゼが 一時
	// 逃げこんだ 避難所。底に ロゼの 忘れ物（原音設定）が 残って いる。依頼を 引き受けると 開く（知らせは
	// 積まない：engine/heroes.ts の acceptQuest が 直に 開き、ロゼが 場所を 言う）。荒らしが 追いかけて きて いる：文字化けが 多い
	vocalo: {
		id: "vocalo",
		objective: "fetch",
		hidden: true,
		foes: { mojibake: 2 },
		floors: 6,
		items: VOCALO_ITEMS,
		perFloor: [4, 6],
		level: ramp(6, 7, 2),
		unidentified: ["herb", "staff"],
		curses: false,
		start: ["f_large"],
		goal: "oto_ini",
		houses: null,
		trapsFrom: 3,
		unlockAfter: "shallow",
		unlockFlag: "q_roze",
		reliefAfter: null,
	},
	// ── おーぷぬ（だれでも 板を 立てられる open.open2ch.net）の おんJ関連板。おんJwiki（3代目）の
	// 「おーぷぬの おんJ関連板一覧」（pages/519）と 板の トップから。どれも 持ち帰りの 寄り道で、
	// 板を 持ち帰っても 開かない：町の 寄り道（碁会所・質屋・おんJマート・道場）で 見つける（data/town/finds.ts）
	//
	// 1回で 完結する 寄り道 なので、4つとも 本筋と ちがう 遊びかたを 1つずつ 持たせる（2026-10-14 作者：
	// 「単発の 寄り道は もう少し バリエーションを。個性の 出しかた・階数は ポケダンを 参考に」。名前は 借りない）：
	// - マーキュリー：6階の 宝の 板。祭りも ふつうの 罠も 無く（安価の罠だけ）、敵は 少なく、道具が 多い（ほのぼの。倉庫を ふやしに 行く 板）
	// - おんMu：底の 深さが 潜るたびに かわる（7〜17階。沈んだ 大陸の 沈みかたが 毎回 ちがう）
	// - おんキム：1階から 敵が 強い 10階（植民地戦争の 最前線。本編の 5階ぶんから 始まる。倉庫の 装備で 挑む）
	// - †闇の板†：50階の 塔（ハードコア。倉庫の 道具は 持ちこめない。頂の 品は 帰還スレで 持ち帰れる）
	//
	// なんでも実況（マーキュリー）：「おんJに 飽きた 方」の ほのぼの 板（デフォルトネーム 水星の名無し）。
	// ほのぼの なので 自然回復が はやく、荒らしは 来ない。水星の 名無しが 置いていった 物が 床に 多い 宝の 板：
	// 6階・1階に 8〜10個・祭りと ふつうの 罠は 無し（安価の罠は どの 板とも 同じ：core/anka.ts）・敵は 7割
	mercury: {
		id: "mercury",
		objective: "fetch",
		foes: { tousuko: 2, kaso: 1.5, oni: 0, ninja: 0, fallen: 0 },
		floors: 6,
		items: MAIN_ITEMS.filter((e) => e.kind !== "s_escape"),
		perFloor: [8, 10],
		level: ramp(6, 7, 2),
		unidentified: ["staff"],
		curses: false,
		start: ["f_large"],
		goal: "hoshi",
		houses: null,
		// ふつうの 罠は 置かない（7階より 浅い 階には 置かない ＝ どの 階にも 無い）
		trapsFrom: 7,
		unlockAfter: null,
		unlockFlag: "town_mercury",
		reliefAfter: null,
		regenStep: 100,
		sparse: 0.7,
	},
	// なんでも実況（ムー大陸）＝おんMu：「呑気な おんJを 求めて 作られた 板」（デフォルトネーム ムーミン谷の名無し）。
	// 「相変わらず 廃墟やのぅ」の 過疎。沈んだ 大陸へ 潜る。大陸の 沈みかたが 毎回 ちがうので、底の 深さは
	// 潜るたびに 7〜17階から 決まる（randomFloors。強さは 底が n階なら 本編の n+1階ぶんまで）
	onmu: {
		id: "onmu",
		objective: "fetch",
		foes: { hitodama: 2, funamushi: 2, kaso: 1.5, ninja: 0 },
		floors: 17,
		randomFloors: { min: 7, max: 17, level: (n) => ramp(n, n + 1, 2) },
		items: MAIN_ITEMS.filter((e) => e.kind !== "s_escape"),
		perFloor: [4, 6],
		level: ramp(17, 18, 2),
		unidentified: ["herb", "scroll", "staff"],
		curses: true,
		start: ["f_large"],
		goal: "tojoken",
		houses: null,
		trapsFrom: 3,
		unlockAfter: null,
		unlockFlag: "town_onmu",
		reliefAfter: null,
		sparse: 0.5,
	},
	// おんキム：キムチを 愛する 板から 始まった（2023年3月。管理部スレ・「植民地一覧」・おんMuとの 植民地戦争・
	// 「おんキムに 来ませんか？」の 勧誘）。勧誘と 公安（特定班）が 多く、植民地が 多いので 祭りも 出やすい。
	// 植民地戦争の 最前線なので 1階から 敵が 強い（1階で もう 本編の 5階ぶん。ゾンJ民が 出る）。そのぶん 階は 10・
	// 底は 本編の 11階ぶんで 止め、道具は 多め。倉庫の 装備を 持ちこむ 前提の 板（pnpm sim -- --dungeon onkimu
	// --carry steel+2,steelsh+2,h_heal,h_heal,f_bread で クリア 13%。持ちこみ なしの ボットは 1階で ほぼ 倒れる）
	onkimu: {
		id: "onkimu",
		objective: "fetch",
		foes: { eye: 2, ninja: 2, yuki: 1.5, copipe: 1.5 },
		floors: 10,
		items: MAIN_ITEMS.filter((e) => e.kind !== "s_escape"),
		perFloor: [6, 8],
		level: rampFrom(10, 5, 11),
		unidentified: ALL_UNIDENTIFIED,
		curses: true,
		start: ["f_large"],
		goal: "kimchi",
		houses: { from: 3, chance: 1 / 4, early: [4, 6] },
		trapsFrom: 2,
		unlockAfter: null,
		unlockFlag: "town_onkimu",
		reliefAfter: null,
	},
	// †ダークネスインフェルノ†板：「†邪気眼に 魅入られし 孤高なる 闇の 眷属たちの 集いし 板†」
	// （デフォルトネーム †名も無き暗黒の使い†。中二病 専用板）。闇の 力で 杖の 回数が 1 多く、のろいも 多い。
	// 寄り道の ハードコア：闇の 塔を 50階 上る。倉庫の 道具は 持ちこめない（闇の 試練は 身ひとつで）
	inferno: {
		id: "inferno",
		objective: "fetch",
		noCarry: true,
		foes: { chimera: 2, kage: 2, mojibake: 1.5, golem: 1 },
		floors: 50,
		// 解呪スレは 倍。食べものも 倍（50階は 長い。本編の 割合の ままだと ボットの 7割が 飢え死に した）。
		// 寄り道で ここだけ 帰還スレが 出る（頂の 魔導書を 持ったまま 帰れる：escapeWithGoal）
		items: MAIN_ITEMS.map((e) =>
			e.kind === "s_uncurse" || ITEMS[e.kind]?.cat === "food"
				? { kind: e.kind, weight: e.weight * 2 }
				: e,
		),
		perFloor: [5, 7],
		level: ramp(50, 32, 1.3),
		unidentified: ALL_UNIDENTIFIED,
		curses: true,
		start: ["f_large"],
		goal: "grimoire",
		houses: { from: 5, chance: 1 / 10, early: [6, 8] },
		trapsFrom: 3,
		unlockAfter: null,
		unlockFlag: "town_inferno",
		reliefAfter: null,
		charge: 1,
		// 50階を 歩いて 降りるのは 長すぎるので、過去ログの底と 同じく 品ごと 帰還スレで 帰れる
		escapeWithGoal: true,
		// 闇の 塔を 上る
		up: true,
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
	"vocalo",
	"mercury",
	"onmu",
	"onkimu",
	"inferno",
];

/**
 * その 板が 開く 条件を 満たしたか（持ち帰った 板と 旗から。開いているかは 見ない）。
 * unlockAfter を 満たし、unlockFlag が あれば その 旗も（unlockAfter が なければ 旗 だけ）。
 */
export const openable = (
	d: DungeonId,
	cleared: readonly DungeonId[],
	flags: readonly string[] = [],
): boolean => {
	const dg = DUNGEONS[d];
	const by =
		(dg.unlockAfter === null && !!dg.unlockFlag) ||
		(dg.unlockAfter !== null && cleared.includes(dg.unlockAfter));
	return by && (!dg.unlockFlag || flags.includes(dg.unlockFlag));
};

/** 知らない id（壊れた記録など）は本編として読む。 */
export const dungeonById = (id: string | undefined): Dungeon =>
	DUNGEONS[id as DungeonId] ?? DUNGEONS.main;

const sized = new Map<string, Dungeon>();

/**
 * 冒険の ダンジョン（底の 深さが かわる 板は その 冒険で 引いた 階の 数と 強さ に した もの）。
 * floors が 無い・かわらない 板は dungeonById と 同じ。
 */
export const dungeonOf = (s: {
	dungeon: DungeonId;
	floors?: number;
}): Dungeon => {
	const dg = dungeonById(s.dungeon);
	const rf = dg.randomFloors;
	if (!rf || s.floors === undefined || s.floors === dg.floors) return dg;
	const n = Math.max(rf.min, Math.min(rf.max, s.floors));
	const key = `${dg.id}:${n}`;
	let v = sized.get(key);
	if (!v) {
		v = { ...dg, floors: n, level: rf.level(n) };
		sized.set(key, v);
	}
	return v;
};

/** 札・地図に 出す 階の 数（底の 深さが かわる 板は「7〜17」）。 */
export const floorsLabel = (d: DungeonId): string => {
	const dg = DUNGEONS[d];
	return dg.randomFloors
		? `${dg.randomFloors.min}〜${dg.randomFloors.max}`
		: `${dg.floors}`;
};
