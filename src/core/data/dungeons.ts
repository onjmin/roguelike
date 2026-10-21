// ダンジョン＝おんJの 植民地（おーぷん2ch の ほかの板）。村の 入口で 行き先を 選ぶ。
// 板ごとに 階の数・道具の出かた・決まり（板の 気風から）が ちがう。名前と 語りは data/story/story.ts、
// 見た目と 曲（板ごとに 1つ。全フロア 同じ）は ui/dungeon/theme.ts。
//
// - shallow：パン板（ぱんJ。いちばん 栄えた 植民地）の 4階。入門：杖だけ未識別・のろいなし・
//   祭りは B3 の 独立記念パレードだけ・罠は B3 から。パン松の 縄張りで パンが よく出る。
//   底（B4）は 敵の いない パン王国の 城下町で、持ち帰るのは 食パンの 国旗。戦う 階は B1〜B3。
// - main：風呂板（おふJ）の 12階。湯治：HP の 自然回復が 1.5倍。
//
// 倉庫から 村で 引き取った 道具は たいていの 板へ 持ちこめる。noCarry の 板（電池板・離島板・過去ログの底・†闇の板†）へは
// 持ちこめず、出るときに ンゴ姉が 倉庫へ もどす（わけは data/town/town.ts の CARRY_REFUSE）。
// - deep：電池板（でんJ。過疎で 謎が多い）の 16階の 鉄塔。充電：杖の 回数が 1 多い。
//   ぜんぶ未識別・不食の指輪は出ない・ぷゆゆパンは 少し・祭りが出やすい・スレが 早く 埋まる（罠の 数は 本編と 同じ 決まり）。
//   8階は 発電所の 見学コース（敵なし）。てっぺんで 町を 盛り上げて きた 名無し（やきう）と 戦う。
//
// 目的（objective）は 板ごとに 筋に 合わせる：持ち帰り（fetch：パン板・過去ログの底）、底の ボスを たおす
// （boss：きのこ板・風呂板・電池板。たおすと 品ごと 一瞬で 入口へ 帰る）、底の 出来事（event：おんたこ）、
// 送り届ける（deliver：離島板）、連れ帰る（bring：お祭り）。期間限定で かわる ことも ある
// （村の イベント：data/story/objectives.ts。core は 決めない）。
//
// level は「その階が 本編の何階ぶんの強さか」。敵の顔ぶれ・罠の数と種類・祭りの大きさ・変化の杖は
// これで引く。見た目と曲の層は UI 側（ui/dungeon/theme.ts）。
//
// 本筋の 階の数は ポケダン（はじめの ダンジョンは 3階、物語の 山場でも 20階 ほど）に ならって 短く：
// パン板 4（底は 敵の いない 城下町）→ きのこ板 5 → 離島板 7 → おんたこ・お祭り 10 → 風呂板 12 → 電池板 16。
// 長く 潜らせる のは やり込みの 過去ログの底（99階）と 寄り道・裏の 板。
// 出だしは ゆるく、底へ 向けて 急に 上げる（ramp）。レベルは 毎回 1 から なので、短い 板ほど 着いたときの
// レベルが 低い。底の 強さ（*_TOP）は pnpm sim で クリア率を 見て 決める。

import type { ItemWeight } from "../itemTable";
import type { LayoutRule } from "../mapgen";
import type {
	DungeonId,
	GuestId,
	ItemCat,
	Objective,
	RescueKind,
} from "../types";
import type { HeroId } from "./heroes";
import { ITEMS, MAIN_ITEMS } from "./items";
import {
	BATH_HALL,
	BATH_SPRING,
	DENCHI_PLANT_TOUR,
	FESTIVAL_YAGURA,
	HIDDEN_STONE_ROOM,
	ISLAND_HAMLET,
	PAN_CASTLE_TOWN,
	type PlaceMap,
	TAKO_ROOFTOP,
} from "./places";

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
	/**
	 * ボスを 見た ときの 掛け合い（村と 同じ 窓。大部屋の ボスは arena.talk）。本気の 一場面：階の 曲を 止めて、
	 * 笑いを 入れずに 相手の 理由と 脅しを 言わせ、戦いへ（STORY.md §0「シリアスは 本気の 相手の 一言」）。
	 * 主人公の 返事は ロゼ・ゼロの ぶんも 書く（無いと その 返事の 前で 窓が 切れる）。1行 全角 22字・2行まで。
	 */
	talk?: FolkTalk;
	/** 掛け合いの 窓の 立ち絵と 名前の 色（data/people/cast.ts の 仲間の id。やきうなど）。 */
	voice?: string;
	/** ボスを 見た ときの 行（掛け合いの あと 記録の 行に 出す。先回りした 人の 落ちなど）。 */
	intro?: readonly string[];
	/** 目的の 文で 出す 名前（会う まで 正体を 言わない ボス。無ければ ボスの 名前）。 */
	goalName?: string;
	/** ボスの 階に 着いた ところに 置いて ある 道具と、着いた ときの 1行（先回りした 人の 差し入れ）。 */
	supply?: { items: readonly string[]; line: string };
	/** ボスの 曲（data/audio/bgm.ts の 名前。見つけてから たおすまで。無ければ 汎用の ボス曲 BOSS_BGM）。 */
	bgm?: string;
	/** ボスが 住む・立てこもる 大部屋（無ければ ふつうの 階で 待つ）。 */
	arena?: BossArena;
	/** その 主人公で 潜った ときに かえる 行（先回りした 人が 主人公の 本人の とき など）。 */
	asHero?: Partial<
		Record<
			HeroId,
			{
				intro?: readonly string[];
				lines?: readonly string[];
				supplyLine?: string;
			}
		>
	>;
};

/**
 * ボスの 大部屋（ポケダン風。STORY.md §4.9 の ライバル）。その 場所に 住む・立てこもる ボスだけ。
 * いちばん底を 手づくりの 地図に して、着くと ボスとの 掛け合いが あって 戦いが 始まる。
 */
export type BossArena = {
	name: string;
	/** 手づくりの 地図（core/data/places.ts。B が ボスの 立つ 所。g は 差し入れ supply の 置き場）。 */
	map: PlaceMap;
	/** 着いた ときの 掛け合い（ボスが 言う。終わると 戦いが 始まる）。 */
	talk: FolkTalk;
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
	/** 手づくりの 地図（core/data/places.ts。人は 1〜9 の 所に 立つ）。 */
	map: PlaceMap;
	/** この 階の 曲（data/audio/bgm.ts の 名前。敵の いない 所なので 板の 曲と かえる）。 */
	bgm: string;
	folk: readonly FolkSpec[];
};

/**
 * 主人公の 返事（201 の 型：大ボケの 直後に 自分で つっこむ）。kiriko は キリコ（ンゴ）、roze は 束音ロゼ（アル）、
 * zero は 解音ゼロ（1つなら どの 機体も 同じ。3つなら メイン・プロト・レンの 順に いまの 機体の ぶん）。
 * いまの 主人公の 返事が なければ、その 窓は 返事の 前で 打ち切る（返事を 受けた 落ちが 宙に 浮かない ように：core/run.ts の emitTalk）。
 */
export type HeroReply = {
	kiriko: string;
	roze?: string;
	zero?: string | readonly [string, string, string];
};

/**
 * 1回 話す ぶん（村と 同じ 窓で 1〜3枚。1行 全角22字・2行まで）。文字列は その 人、HeroReply は 主人公の 返事。
 * 文字列の {hero} は いまの 主人公の 名前（ゼロは いまの 機体）。「キリコ」と 書いた 所は 主人公が だれでも キリコの こと。
 */
export type FolkTalk = readonly (string | HeroReply)[];

/** 主人公の 返事を 出す 形（ダンジョンの talk の 出来事。voice は 窓の 立ち絵：無ければ キリコ）。 */
export type HeroLine = { reply: string; voice?: string };

/** 集落・名所に 立って いる 人（ぶつかると 話す）。 */
export type FolkSpec = {
	name: string;
	sprite: string;
	/** 窓の 立ち絵と 名前の 色（data/people/cast.ts の 仲間・住人の id。無ければ 名前だけ）。 */
	voice?: string;
	/** 話す ことの 順（ぶつかる たびに 1つ すすみ、終わると はじめに もどる）。 */
	talks: readonly FolkTalk[];
	key?: true;
	/** 主人公の 本人（その 主人公で 潜った ときは 立たない。同じ 人が 2人 いる ことに なる）。 */
	self?: HeroId;
};

/**
 * 名所の 階（長い 板の 一息。STORY.md §4.9 の 場面の 一覧）。敵・罠・道具が なく、地図が はじめから 見える。
 * 合う 板にだけ 置く（作者「全部が 全部に 搭載する ものでは ない」）。1000 の カウントは 進む。
 */
export type RestFloor = {
	depth: number;
	name: string;
	/** 手づくりの 地図（core/data/places.ts。源泉は S、人は 1〜9、道具は g の 所）。 */
	map: PlaceMap;
	/** 立って いる 人（ぶつかると 話す。SettlementSpec の folk と 同じ）。 */
	folk?: SettlementSpec["folk"];
	/** 着いた 部屋に 置いて ある 道具（売店の パン など。長い 板の 中ほどの 補給）。 */
	gifts?: readonly string[];
	/** この 階の 曲（data/audio/bgm.ts の 名前。敵の いない 所なので 層の 曲と かえる）。 */
	bgm: string;
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
	/**
	 * 持ち帰った 品の 買い取りの 倍率（無ければ 1）。むずかしい 板ほど 高い（倒れる 悔しさに 見合う ように）。
	 * お祭り会場だけ「お祭り価格」で 飛びぬけて 高い（2026-10-19 作者「特定の ダンジョン 1つだけ 突出して 稼げる」）。
	 * 目安は scripts/sales-sim.mjs の「平均(全体)」（倒れた 回も 0円で 数える）。
	 */
	sale?: number;
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
	 * 起きると name を 知らせる（パン板の 独立記念パレード）。count は 集まって いる 数（無ければ 祭りと 同じ）。
	 */
	parade?: {
		depth: number;
		name: string;
		monster: string;
		line?: string;
		count?: [number, number];
	};
	/** この階より浅い階には罠を置かない。 */
	trapsFrom: number;
	/** 1階に 武器を 1本は 置く（入門の 板。core/floor.ts）。 */
	firstWeapon?: boolean;
	/** このダンジョンを持ち帰ると開く（null ははじめから開いている。unlockFlag だけ あれば その 旗で 開く）。 */
	unlockAfter: DungeonId | null;
	/**
	 * 開くには この 旗（Progress.flags）も 要る（ボカロ作り避難所：ロゼの 競争）。
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
	/** 1階に わく 湯だまりの 数（見た目だけ。core/floor.ts の placePools）。 */
	pools?: [number, number];
	/**
	 * ふつうの 階の 形の 出かた（core/mapgen.ts の LayoutKind → 重み）。階の 範囲で 分けて、最初に 合う 行を 使う。
	 * 無ければ 3×3 の 区画（grid）だけ。祭りの 大部屋・二分割・四分割と 手づくりの 地図は 別。
	 */
	layouts?: readonly LayoutRule[];
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

/**
 * 寄り道の 板の 曲がり。寄り道には 板だけの 敵（きのにゃん・おふ郎くん など、同じ 強さの 階の 顔ぶれより 1段 強い）も
 * ボスも いないので、本筋の 2乗より 早く 上げて 敵の 強さを 本筋に そろえる。
 */
const SIDE_CURVE = 1.5;

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
 * パン板の 道具の出かた（重みの合計 66）。重みは 割合で、4階（底の 城下町は 置かない）で 出るのは 20ほど
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
	{ kind: "scale", weight: 2 }, // 防御4。にょっす牛（レベル4〜）の ちから下げを防ぐ、を教える（毒入りの デッドボールは 防がない：トルネコ1の うろこの盾）
	{ kind: "steelsh", weight: 1 }, // 防御6。鋼鉄の盾の位置。いちばん強い盾で 1枚だけ
	// 矢 5（ちょっと は 矢が多め：7.8%）
	{ kind: "a_wood", weight: 3 }, // 寝落ち民・ゾンJ民を 離れて削る
	{ kind: "a_iron", weight: 2 }, // 本編の 3束に 対して 2束の 割合（ちょっと は 鉄・銀の矢のほうが 木より多かった）
	// 食べもの 5（ちょっと：片親パン・ぷゆゆパン・チギュリパン が 1:1:1、全体の 9.4%）。
	// 4階（1300ターンほど）は 始めの 大きな パンと ぷゆゆの お弁当で 足りるので、床の パンは 1階 10% ほど
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
 * パン板の 階 → 本編の何階ぶんか。B1〜2 は罠なし、B3 から罠。B4（底）は 敵の いない 城下町。
 * ゾンJ民・風吹けば名無し から 先は きのこ板と 本編で。
 */
export const SHALLOW_LEVEL: readonly number[] = [
	0, // [0] 使わない
	1, // B1：ぷゆゆ・dat落ちの霊・夏休みキッズ・ROM専。罠なし
	2, // B2：kskボット・寝落ち民（眠りの呪文）が 加わる。罠なし
	5, // B3：独立記念パレード（パン兵の 祭り）。にょっす牛・コピペ・ゾンJ民 が 加わる。罠も
	4, // B4：城下町（敵・罠なし）。帰り道の 強さにも 使わない
];

/**
 * 電池板（16階）の 道具の出かた（本編 ×1.5 から 不食の指輪を抜き、ぷゆゆパンを 減らし、マイナスの品を ふやし、
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
	{ kind: "scale", weight: 2 }, // 敵の 毒攻撃で ちからを下げられない（毒草・チギュリパンは 防がない：トルネコ1の うろこの盾）
	{ kind: "mirror", weight: 2 }, // 錆びない。風呂キャンセル界隈（レベル8〜15）・錆びの罠 対策
	{ kind: "steelsh", weight: 2 }, // 防御6。本編1 × 1.5 を切り上げ
	{ kind: "fireward", weight: 1 }, // ワイバーンの炎が半分。深い階で強いので 1枚のまま
	{ kind: "starshield", weight: 1 }, // 防御10。いちばん強い盾は 1枚のまま
	// 指輪 14（4つに1つは のろい。不食の指輪は 入れない）
	{ kind: "r_might", weight: 3 }, // もっと で いちばん多い指輪の1つ。のろいなら −3 なので 当たりとは かぎらない
	{ kind: "r_hunger", weight: 3 }, // 本編1 → 3（もっと の ハラペコ は 指輪で いちばん多い）。食べものを HP に 変える（回復も 2倍）。のろわれて外せないと 食べものが半分の価値
	{ kind: "r_clamor", weight: 2 }, // マイナス（ザメハ）。本編1 → 2
	{ kind: "r_trap", weight: 1 }, // 罠が 多い 深い 階で 強すぎるので 1つだけ（もっと でも 13/256 と少ない）
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
	{ kind: "h_sight", weight: 3 }, // 罠と 透明あぼーん（見えない。レベル15〜）に。本編2 → 3
	// スレ 58（未識別）
	{ kind: "s_appraise", weight: 12 }, // 本編8 × 1.5。マイナスの品が多いぶん 階あたりは 本編と同じに保つ
	{ kind: "s_whet", weight: 5 }, // 30階ぶんの 装備の育ち。本編3 × 1.5 を切り上げ
	{ kind: "s_temper", weight: 5 }, // 同じ
	{ kind: "s_uncurse", weight: 4 }, // 指輪・装備が ふえ、のろいの数も ふえるので 本編2 → 4
	{ kind: "s_rustproof", weight: 1 }, // もっと では 消えた メッキ。1枚だけ
	{ kind: "s_map", weight: 6 }, // 罠を見せる。本編3 → 6
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
	// 食べもの 19（ぷゆゆパンは 少しだけ。もっと の 片親パン:チギュリパン ≒ 3:1）
	// 床の パンは 1階 25% ほど（多いと 始めの 200% と お弁当・パン兵の ぶんが まるまる 余る）
	{ kind: "f_bread", weight: 13 }, // +50%（スレが 早く 進む ぶん 多く）
	{ kind: "f_large", weight: 2 }, // 16階 ある ので 大きな パンも 少し
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
		// 入門は 3×3 だけ。B3 の 独立記念パレードは ときどき 横長の 大通り（行進が 映える）
		layouts: [{ from: 3, shapes: { grid: 2, hall: 1 } }],
		objective: "fetch",
		// 底は パン王国の 城下町（板主 パン松。STORY.md §4.9）
		settlement: {
			name: "パン王国の城下町",
			map: PAN_CASTLE_TOWN,
			// 独立ごっこの 曲（村の パン板の 独立の 場面と 同じ 動機）
			bgm: "kaiwai4",
			folk: [
				{
					name: "パン王",
					sprite: "pub:sprites/minors_panmatsu.png",
					talks: [
						[
							"独立したかっただけや。\n国民は32人。パン兵が31人や",
							{ kiriko: "のこりの1人は？" },
							"ワイや",
						],
						[
							"国旗は食パンや。文句あるか",
							{ kiriko: "……おいしそうンゴ" },
							"食べたら国際問題やで",
						],
						["旗は持ってってええ。\n予備なら、あと8斤ある"],
						[
							"弟のパン松が、おんJタウンで\n大使をしとる",
							{ kiriko: "大使館、どこンゴ？" },
							"屋台のとなりの1マスや",
						],
					],
				},
				{
					name: "ロゼ",
					sprite: "sa:mHhx69",
					voice: "roze",
					self: "roze",
					talks: [
						[
							"わたしが先に着いたアル。\n{hero}は2番アル",
							{ kiriko: "競争してたンゴ？" },
							"いつも競争アル。常識アル",
						],
						["独立は、書類で申請するアル。\n……王さまに説教しといたアル"],
						[
							"王さま、ちょっと泣いてたアル",
							{ kiriko: "説教、何時間したンゴ？" },
							"3時間アル。……短いほうアル",
						],
						["申請書は1枚しかないアル。\n王さまが3回書きなおしたアル"],
					],
				},
				{
					name: "パン兵",
					sprite: "pub:sprites/panhei.png",
					talks: [
						[
							"ここは城下町や。剣はしまえ",
							{ kiriko: "しまう所がないンゴ" },
							"……ほな、持っとけ",
						],
						["パン、焼きたてやで"],
					],
				},
				{
					name: "パン兵",
					sprite: "pub:sprites/panhei.png",
					talks: [
						[
							"独立記念セール、やっとるで",
							{ kiriko: "なにが安いンゴ？" },
							"パンや。……パンしかない",
						],
					],
				},
				// ゼロ（3機）も 先回り：パン兵を 数えに（ライバルの 先回り。帰りの 語りの「パン兵を 数えに」と 合わせる）
				{
					name: "ゼロ",
					sprite: "pub:sprites/zero_main.png",
					voice: "zero",
					self: "zero",
					talks: [
						[
							"パン兵、31人です！\n3機で、93回数えました！",
							{ kiriko: "1回でいいンゴ" },
							"3機だと、1回が3回なんです！",
						],
						[
							"キリコさんの蓄音機、\n声がためられるんですよね",
							{ kiriko: "あげないンゴ" },
							"まだ、何も言ってません！",
						],
						["ゼロは、ここで数えてます。\n帰りは、同じ船です"],
					],
				},
				// サブ機の プロト・レンも いっしょに 数えて いる（3機で 1つの 仕事）
				{
					name: "プロト",
					sprite: "sa:KxS5YZ",
					voice: "proto",
					self: "zero",
					talks: [
						[
							"パン兵の歩幅、平均41cmゼロ。\n食パンの耳と同じ長さゼロ",
							{ kiriko: "測ってどうするンゴ？" },
							"……記録するゼロ",
						],
						[
							"ここには味噌汁がないゼロ。\nパンしかないゼロ",
							{ kiriko: "パンを味噌汁にひたすンゴ？" },
							"……検討するゼロ",
						],
					],
				},
				{
					name: "レン",
					sprite: "pub:sprites/zero_ren.png",
					voice: "ren",
					self: "zero",
					talks: [
						[
							"ここの国歌、2番からパンなの！\nレン、もう覚えた〜♪",
							{ kiriko: "1番は、なにンゴ？" },
							"君が代だよ〜♪",
						],
						[
							"独立記念ライブ、やりたいな〜",
							{ kiriko: "客は何人ンゴ？" },
							"パン兵31人！満員だよ〜♪",
						],
					],
				},
			],
		},
		boss: {
			monster: "boss_panhei",
			rescue: "escort",
			cheer: "えっさ",
			lines: [
				"どこからかパン松の号令がひびいた！",
				"パン兵たちが{hero}をかつぎあげた",
				"「おんJ民は帰れ！」入口まで運び出された",
			],
			cause: "パン兵長をたおした",
			// 本気の 相手（STORY.md §4.9「本当に 独立したい だけ」）。パン板に 残ったのは、飽きて 帰らなかった おんJ民
			// （§1 植民地）。冒頭の やきう「勝手に 旗立てて、勝手に 飽きて 帰った」を 向こう側から 言う。笑いは 入れない
			talk: [
				"おんJ民か。……旗は、おろさん",
				"12年前、みんなで旗を立てた。\nみんな飽きて帰った。ワイらは残った",
				"残ったもんの板や。\n独立は、遊びやない",
				{
					kiriko: "……広場は、返してほしいンゴ",
					roze: "広場は、みんなの物アル。\n……返すのが常識アル",
					zero: [
						"広場の人数、ずっと0人です。\n……返してください",
						"広場の利用者、0人ゼロ。\n……返却を求めるゼロ",
						"広場で歌えないの、\nさびしいよ〜。……返して",
					],
				},
				"ほな、取り返してみい",
			],
		},
		// パン松は やきうが きらい（ピッチャーは 追い出した）。にょっす牛（前の名前 まんぜう軍＝まんじゅう）は パンの なかま。
		// 寝落ち民は 入門の 板では 少なめ（2026-10-03 ボットで パン板の 死因の 6割・B2 に 固まった）
		// ゾンJ民は B3（パレードの 階）に まれに だけ（ふつうの 重みでは 倒れた 冒険の 8割が ゾンJ民。2026-10-18 ボット）
		foes: { pumpkin: 2, pitcher: 0, neochi: 0.4, zonj: 0.35 },
		floors: 4,
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
			depth: 3,
			name: "独立記念パレード",
			monster: "panhei",
			line: "パン兵「観覧無料や！持ち物は置いてけ」",
			count: [9, 12],
		},
		trapsFrom: 3,
		firstWeapon: true,
		unlockAfter: null,
		reliefAfter: null,
	},
	main: {
		id: "main",
		sale: 2,
		// 坑道：深くなるほど 長い 坑（横長・縦長の 中部屋）と 入り組んだ 通路が ふえる
		layouts: [
			{ to: 4, shapes: { grid: 3, hall: 1 } },
			{ shapes: { grid: 4, hall: 2, vhall: 1, twin: 1, broad: 1, maze: 1 } },
		],
		// 42℃派の 番頭と 本気の 勝負（STORY.md §4.9）
		objective: "boss",
		// 露天の 源泉：シヨが 先回りして 湯温を 測って いる（ライバルの 先回り）
		rests: [
			{
				depth: 7,
				name: "露天の源泉",
				map: BATH_SPRING,
				// 湯に つかって ほっとする 曲
				bgm: "yofukashi",
				folk: [
					{
						name: "シヨ",
						sprite: "sa:y8Kr53",
						voice: "shiyo",
						talks: [
							[
								"べ、べつに先回りしてないわよ",
								{ kiriko: "髪が湯気でしっとりンゴ" },
								"……3時間前に来ただけよ",
							],
							["42℃は熱い。41℃はぬるいわ。\n……41.5℃なら、入ってあげる"],
							[
								"温度計、5本持ってきたの",
								{ kiriko: "多すぎるンゴ" },
								"5本とも、ちがう数字なのよ！",
							],
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
			// 42℃派が 立てこもった 銭湯（番頭の 持ち場なので 大部屋で 待つ）。キリコが どっちつかずなのが 火種
			arena: {
				name: "銭湯の大浴場",
				map: BATH_HALL,
				talk: [
					"あら、41℃派の方？\nここは42℃の湯でしてよ",
					{
						kiriko: "吾輩、ぬるいのも\n熱いのも入るンゴ",
						roze: "ぬるいのも熱いのも、\n入るのが常識アル",
						zero: [
							"41℃も42℃も、\nどっちも記録します",
							"41℃も42℃も、\n等しく計測するゼロ",
							"どっちのお湯でも、\nいい声が響くよ〜♪",
						],
					},
					// 3枚目は 脅し（本気の 相手。笑いで 落とさない）
					"どっちつかずが、いちばん\n許せませんの。源泉ごと、沈めます",
				],
			},
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
		// パン板（4階）から いきなり 12階に ならないよう、きのこ板（5階）を はさむ。
		// きのこ板で 倒れつづけた ときの 救いは 倉庫の 封鎖を 解く こと（data/town/incidents.ts の reliefAfter）
		unlockAfter: "kinoko",
		reliefAfter: null,
		// 湯治：150 → 100（1.5倍）
		regenStep: 100,
		// 源泉の 通る 硫黄の 坑道：あちこちに 湯が わいて いる
		pools: [1, 3],
	},
	deep: {
		id: "deep",
		sale: 4,
		// 鉄塔：格子（小部屋だらけ）と 吹き抜け・はしご（縦長の 中部屋）。上るほど 多い
		layouts: [
			{ to: 4, shapes: { grid: 3, dense: 1 } },
			{ shapes: { grid: 3, dense: 2, vhall: 2, ladder: 2, elbow: 1, ring: 1 } },
		],
		noCarry: true,
		// 底で 14年 町を 盛り上げて きた 名無し（やきう）と 戦う（STORY.md §4.9 の 結）
		objective: "boss",
		boss: {
			monster: "boss_yakiu",
			rescue: "escort",
			cheer: "おつかれ",
			lines: [
				"やきう「【悲報】ワイ、負ける。盛れんわ」",
				"電池ニキが発電機を回しなおした",
				"明かりの道を、入口まで送ってもらった",
			],
			cause: "やきうをたおした",
			// てっぺんに いるのが やきうだと わかるのは 会った とき（目的の 文では 名前を 言わない）
			goalName: "てっぺんの名無し",
			// ゲームで いちばん 本気の 一場面（STORY.md §0「シリアスは 本気の 相手の 一言」）：階の 曲を 止めた 窓で、
			// やきうの 立ち絵が 笑いなしに 理由を 言い、脅して 戦いへ。やきうは 14年 ひとりで 町を 盛り上げて きた
			// 名無しで、キリコに 毎回 上を 行かれ、いちばん 大きい 騒ぎを 自分で やろうと 主電源を ふさぐ（ライバル化。
			// 2026-10-19 に「見出しの 正体」の 線を やめて 組み直した）。笑いは 負けた あとの lines で もどる
			talk: [
				"……来たか。\nこの町は、14年ワイが盛り上げてきた",
				{
					kiriko: "……ひとりでンゴ？",
					roze: "……ひとりでアル？",
					zero: [
						"……ひとりで、ですか",
						"……ひとりと記録するゼロ",
						"……ひとりで〜？",
					],
				},
				"人が来んでも、スレは立てた。\n毎晩ひとりで保守して、盛った",
				"お前が来てから、毎回ワイの上を行きよる。\n町も、日本も、世界も",
				"人は来た。……まだ足らん。\nいちばん大きい騒ぎは、ワイがやる",
				"主電源は、わたさん。\n……どけ",
				{
					kiriko: "どかないンゴ",
					roze: "どかないアル",
					zero: ["どきません", "どかないゼロ", "どかないよ〜"],
				},
			],
			voice: "nanj",
			// 山場の 専用の ボス曲（曲名は 盛られた見出しの まま。BGM.md：悲壮・決戦）。掛け合いは 無音、始まりの 音から この 曲
			bgm: "lastboss",
		},
		// 見学コース：電池ニキ（ひとりで 電気を 送って きた 最後の 住人）と、先回りした フェリス
		rests: [
			{
				depth: 8,
				name: "発電所の見学コース",
				map: DENCHI_PLANT_TOUR,
				// 見学者0人の 発電所：エレピの 夜の 曲
				bgm: "deq_laundry",
				folk: [
					{
						name: "電池ニキ",
						sprite: "sa:pm3kvS",
						talks: [
							[
								"見学者0人や。あんたで1人目や",
								// 先回りした フェリスへの ツッコミ
								{ kiriko: "柵の上にも、1人いるンゴ" },
								"そっちの子は柵越えや。数えへん",
							],
							[
								"売店のパン、持っていき。\n売れ残りや",
								{ kiriko: "いつのパンンゴ？" },
								"電気は腐らんのや！\nパンは知らん！",
							],
							// ひとりで 送って きた 電気の 落ち（電気代は だれも 払って いない。転の ロゼの ツッコミと 対）
							// 本気の 1枚（止めたら 町が 消える）→ キリコ → 落ち（201 の 型：本気の あとに 落とす）
							[
								"人が来んでも、電気だけは送っとった。\n止めたら、町が消えるからや",
								{
									kiriko: "えらいンゴ！",
									roze: "えらいアル！常識アル",
									zero: [
										"えらいです！記録します！",
										"えらいゼロ。記録するゼロ",
										"えらいね〜！",
									],
								},
								"電気代は、\nだれも払っとらん！",
							],
							["てっぺんで、名無しが待っとるで"],
						],
					},
					{
						name: "フェリス",
						sprite: "sa:4KtOzD",
						voice: "feris",
						talks: [
							[
								"先に来ちゃった〜。\n1人目は私〜",
								{ kiriko: "数えてもらえてないンゴ" },
								"柵の上だから、0.5人〜",
							],
							["また燃えようよ〜"],
							["消えかけでも、\n何回でも復活できるよ〜"],
						],
					},
					// 案内係の デンちゃん（電池板の マスコット。電池板を 持ち帰ると 町に 越してくる：data/story/arrivals.ts）。
					// 体の 中で 発電して いて、ゴム手袋を して いる。外の でんちゃん（敵）に つきまとわれて いる
					{
						name: "デンちゃん",
						sprite: "sa:nfxqra",
						talks: [
							[
								"見学コースの案内係、\nデンちゃんです！",
								{
									kiriko: "手袋、ぶあついンゴ",
									roze: "手袋、ぶあついアル",
									zero: [
										"手袋が、ぶあついです",
										"手袋の厚さを記録するゼロ",
										"手袋ぶあつ〜い！",
									],
								},
								"体の中で発電してるので！\n素手だと見学者が光ります",
							],
							[
								"外のでんちゃんたち、\nしつこく追いかけてくるんです",
								{
									kiriko: "敵のほうンゴ？",
									roze: "敵のほうアル？",
									zero: ["敵のほうですか", "敵と記録するゼロ", "敵のほう〜？"],
								},
								"{+'w'-]って顔で、\n漏電しながら来ます！",
							],
							["てっぺんが片づいたら、\nあなたの町に遊びに行きたいなぁ"],
						],
					},
				],
				// 見学コースの 売店の 売れのこりと、作業員の 置きわすれ（持ちこめない 板の 中ほどの 補給。のろいなし）
				gifts: [
					"f_large",
					"f_large",
					"f_bread",
					"f_bread",
					"h_heal",
					"steel",
					"steelsh",
				],
			},
		],
		// 時間との 競争：4ターンに 1つ 余分に レスが つく（1000 まで 約 4/5 の 時間）
		rushEvery: 4,
		// 機械と 回線の 敵が 多い
		// 機械と 回線の 敵（この 板の 強さで 出る ものだけ）。拾い画UFO は 床の 食べものを 持っていくので 少なめ
		foes: { ksk: 1.5, ufo: 0.5 },
		floors: 16,
		items: DEEP_ITEMS,
		perFloor: [5, 8],
		// 風呂板と 同じく 序盤を ゆるく（曲がり 1.3）。祭りは B5 から、はじめの 1つは B6〜8 に
		// 曲がり 1.6：B12〜15 が 9〜13（自演くん・鋼メンタルが 出る 階の 山を ならす。2026-10-17 の 分析）
		level: ramp(16, DEEP_TOP, 1.6),
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
		// きのこ：菌輪（まん中が 壁で ぐるりと 回る）が よく 出る。斜めの 帯は 菌糸
		layouts: [{ shapes: { grid: 3, ring: 2, band: 1 } }],
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
			// 本気の 相手（STORY.md §4.9「11年ごしの 仕返し」）。笑いは この あとの intro（プロトの 数え）で もどる
			talk: [
				"[ｷ・Д・ﾉ]　11年、待っとった",
				"パン板は、ワイらを忘れた。\n町は、ワイらを通り道にした",
				{
					kiriko: "……町を空き地にしたのは、\n吾輩ンゴ",
					roze: "空き地にしたのは、キリコアル。\n……わたしも見てたアル",
					zero: [
						"空き地になった町、\nゼロも見てました",
						"空き地になった町、\n記録済みゼロ",
						"空き地になった町、\nレンも見てたよ〜",
					],
				},
				"ほな、お前も通り道や",
			],
			// ゼロの サブ機が 先回りして 行進を 数えて いた（ライバルの 先回り。STORY.md §4.9）。本気の 掛け合いの 直後に 落とす
			intro: [
				"プロト「数えました。行進は128本です」",
				"プロト「先に着いたのはゼロ。{hero}さんは2番です」",
			],
			// はじめての ボス：着いた 部屋に 薬草（2026-10-17 ボット：底に 着いても 親玉に 勝てるのは 68%）
			supply: {
				items: ["h_heal"],
				line: "足もとにプロトのメモ『先に数えました。薬草は数えたあまりです』",
			},
			// ゼロで 潜ると 先回りする 人は いない（数えるのは 主人公の 本人）
			asHero: {
				zero: {
					intro: ["{hero}は行進を数えた。128本"],
					lines: [
						"数えなおすと、127本になっていた",
						"きのこが伸びだした！「たけのこより速いやろ」",
						"きのこに押し上げられて、地上まで運ばれた",
					],
					supplyLine: "足もとに薬草が落ちていた",
				},
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
		// 島：小さな 部屋が ぽつぽつ、あいだの 道が 長い。斜めの 帯は 砂州
		layouts: [{ shapes: { isles: 3, grid: 1, band: 1 } }],
		noCarry: true,
		// 押しかけてきた 島民を 島の 山の てっぺんまで 送り返す（STORY.md §4.9）
		objective: "deliver",
		// てっぺんは 島の 集落。長に 話すと 送り届けた ことに なる
		settlement: {
			name: "山の上の集落",
			map: ISLAND_HAMLET,
			// 島の 暮らしの のどかな 曲
			bgm: "kumori",
			folk: [
				{
					name: "島民の長",
					sprite: "pub:sprites/natsuko.png",
					talks: [
						["なんで1人だけ\n送ってもらっとるんや", "……まあ、おかえり"],
						[
							"総島民6人。……今日は7人や",
							{ kiriko: "吾輩は帰るンゴ" },
							"……6人や",
						],
					],
					key: true,
				},
				{
					name: "島民",
					sprite: "pub:sprites/natsuko.png",
					talks: [
						[
							"先に泳いで帰ってきたで",
							{ kiriko: "送った意味がないンゴ！" },
							"浜、また行きたいな",
						],
					],
				},
				{
					name: "島民",
					sprite: "pub:sprites/natsuko.png",
					talks: [
						[
							"総島民6人や",
							{ kiriko: "さっきも聞いたンゴ" },
							"大事なことやからな",
						],
					],
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
				"ほかの5人は、先に泳いで帰っていた",
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
		sale: 1.75,
		// 雑居ビル：小部屋だらけの 階と、廊下（横長の 中部屋）の 階、ロビー（広場）の 階
		layouts: [{ shapes: { grid: 2, dense: 2, hall: 1, twin: 1, plaza: 1 } }],
		// たこパの お誘い（STORY.md §4.9）：最上階の たこパ会場で 粉もん奉行に 話せば 帰れる
		objective: "event",
		settlement: {
			name: "最上階のたこパ会場",
			map: TAKO_ROOFTOP,
			// 屋上の 夜市みたいな にぎわい
			bgm: "kimchi",
			folk: [
				{
					name: "粉もん奉行",
					sprite: "sa:pmnkIf",
					talks: [["来たな。返しを見せてみい"], ["たこパに勝ち負けはない😡"]],
					key: true,
				},
				{
					name: "たこ民",
					sprite: "sa:pmnkIf",
					talks: [
						["😡はタコの顔やで", { kiriko: "怒ってる顔ンゴ" }, "怒ってへん😡"],
						["青のり、かけ放題や"],
					],
				},
				{
					name: "たこ民",
					sprite: "sa:pmnkIf",
					talks: [
						[
							"招待状、届いたか？",
							{ kiriko: "ポストに入ってたンゴ" },
							"128通出したからな",
						],
					],
				},
			],
		},
		event: {
			goal: "最上階の招待に応じる",
			rescue: "escort",
			cheer: "まいど",
			lines: [
				"最上階は、たこパ会場だった。",
				"粉もん奉行「同点や。たこパに勝ち負けはない😡」",
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
		// （1階から 怒るので、素手の Lv1 で 3発 かかる 霊が 怒って 2回ずつ なぐり、1階で 倒れる 冒険が 19% あった → 5%。2026-10-04 ボット）。
		// 顔真っ赤たちは 本編の 20階より 深い 強さだが、寄り道の 板なので 1階から 出す（core/floor.ts の foeTable。2026-10-20 作者：
		// 「出す方に倒して。本筋以外の ダンジョンは あまり バランス 考えなくて よい」）
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
		sale: 3.5,
		// 祭り：露店の ならぶ 参道（横長の 中部屋・2列）が 多い。やぐらの 広場と、まわりを 回る 階も
		layouts: [{ shapes: { hall: 3, twin: 1, plaza: 2, grid: 1, ring: 1 } }],
		// やぐらから 降りられない 親分を 入口まで 連れ帰る（STORY.md §4.9）
		objective: "bring",
		// てっぺんは やぐら広場と 夜店。親分に 話すと 加わる
		settlement: {
			name: "やぐら広場",
			map: FESTIVAL_YAGURA,
			// 板の 曲（やぐらの太鼓）から、広場の ざわざわに かえる
			bgm: "piropiro",
			folk: [
				{
					name: "祭りの親分",
					sprite: "pub:sprites/mashii.png",
					talks: [["そこの、手ぇ貸してくれ"], ["太鼓が、まだ止まらん"]],
					key: true,
				},
				{
					name: "夜店の人",
					sprite: "sa:8DXRgk",
					talks: [
						[
							"金魚すくい、やってくで",
							{ kiriko: "金魚、どこンゴ？" },
							"……ぜんぶ、すくわれた",
						],
						["太鼓、止まらんな"],
					],
				},
				{
					name: "夜店の人",
					sprite: "sa:f6k97v",
					talks: [
						[
							"わたあめ、焼きそば、ラムネ",
							{ kiriko: "どれにするか、迷うンゴ" },
							"ラムネしか残ってへん",
						],
					],
				},
			],
		},
		bring: {
			guest: "oyabun",
			goal: "親分を連れ帰る",
			lines: [
				"やぐらの上に、親分がいた。",
				"親分「降りたら、祭りが終わってまうやろ」",
			],
			cause: "親分を連れ帰った",
		},
		boss: {
			monster: "boss_mashii",
			rescue: "escort",
			lines: [
				"野次馬たちがわっしょいと集まってきた！",
				"だれかが「スレ立て確定！」と叫んだ",
				"神輿にのせられて、やぐらの下まで運ばれた",
			],
			cause: "祭りの親分マシーをたおした",
		},
		// 野次馬（コピペ）・群れ（VIPPER）・炎上。VIPPER・炎上案件は 本編の 13階より 深い 強さだが、寄り道の 板なので 1階から 出す
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
		sale: 3,
		// 層ごとに 形が かわる（見た目の 層は data/story/story.ts の HIDDEN_ZONES）：浅瀬は 3×3 だけ、
		// 石室は 長い 部屋、埋もれた dat は 菌輪と 通路だらけ、苔むした スレ跡は 小部屋と 島、底は なんでも
		layouts: [
			{ to: 20, shapes: { grid: 1 } },
			{ to: 40, shapes: { grid: 2, hall: 1, vhall: 1, twin: 1, ladder: 1 } },
			{ to: 60, shapes: { grid: 1, ring: 1, maze: 1, band: 1, elbow: 1 } },
			{ to: 80, shapes: { grid: 1, dense: 1, isles: 1, plaza: 1, broad: 1 } },
			{
				shapes: {
					grid: 2,
					hall: 1,
					vhall: 1,
					dense: 1,
					isles: 1,
					ring: 1,
					maze: 1,
					twin: 1,
					ladder: 1,
					elbow: 1,
					plaza: 1,
					band: 1,
					broad: 1,
				},
			},
		],
		noCarry: true,
		rests: [20, 40, 60, 80].map((depth) => ({
			depth,
			name: "静かな石室",
			map: HIDDEN_STONE_ROOM,
			// 雪の ように 静かな 回想の 曲
			bgm: "shallow3",
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
	// ボカロ作り避難所：束音ロゼの 競争（engine/heroes.ts・core/race.ts）。ボカロ制作スレが 荒らされた とき、ロゼが 一時
	// 逃げこんだ 避難所。底に ロゼの 原音設定が 残って いる。挑戦を 受けると 開く（知らせは
	// 積まない：engine/heroes.ts の acceptQuest が 直に 開き、ロゼが 場所を 言う）。荒らしが 追いかけて きて いる：コピペが 多い
	vocalo: {
		id: "vocalo",
		// 避難所：隠れる 通路が 多く、部屋は 小さい。L字の 曲がり角も
		layouts: [{ shapes: { grid: 2, maze: 2, dense: 1, elbow: 1 } }],
		objective: "fetch",
		hidden: true,
		foes: { copipe: 2.5 },
		floors: 6,
		items: VOCALO_ITEMS,
		perFloor: [4, 6],
		level: ramp(6, 7, SIDE_CURVE),
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
	// 6階・1階に 8〜10個・祭りと ふつうの 罠は 無し（安価の罠は どの 板とも 同じ：core/anka.ts）・敵は 8割5分（顔ぶれは 本筋なみ）
	mercury: {
		id: "mercury",
		// ほのぼの：広い 通り（横長の 中部屋）や 広場・広間に 置き土産が ころがる
		layouts: [{ shapes: { grid: 2, hall: 2, plaza: 1, broad: 1 } }],
		objective: "fetch",
		floors: 6,
		items: MAIN_ITEMS.filter((e) => e.kind !== "s_escape"),
		perFloor: [8, 10],
		level: ramp(6, 9, SIDE_CURVE),
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
		sparse: 0.85,
	},
	// なんでも実況（ムー大陸）＝おんMu：「呑気な おんJを 求めて 作られた 板」（デフォルトネーム ムーミン谷の名無し）。
	// 「相変わらず 廃墟やのぅ」の 過疎。沈んだ 大陸へ 潜る。大陸の 沈みかたが 毎回 ちがうので、底の 深さは
	// 潜るたびに 7〜17階から 決まる（randomFloors。強さは 底が n階なら 本編の n+1階ぶんまで）
	onmu: {
		id: "onmu",
		sale: 3.5,
		// 沈んだ 大陸：島と 環礁（菌輪の 形）と 砂州（斜めの 帯）
		layouts: [{ shapes: { isles: 3, ring: 2, band: 2, grid: 1 } }],
		objective: "fetch",
		foes: { hitodama: 2, funamushi: 2, kaso: 1.5, ninja: 0 },
		floors: 17,
		randomFloors: {
			min: 7,
			max: 17,
			level: (n) => ramp(n, n + 1, SIDE_CURVE),
		},
		items: MAIN_ITEMS.filter((e) => e.kind !== "s_escape"),
		perFloor: [4, 6],
		level: ramp(17, 18, SIDE_CURVE),
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
		sale: 4,
		// 最前線：塹壕（通路だらけ・縦に 2本）と 小部屋の 陣地
		layouts: [{ shapes: { grid: 2, dense: 2, maze: 2, ladder: 1 } }],
		objective: "fetch",
		// 公安（特定班）・連投荒らし・VIPPER は 本編の 13階より 深い 強さだが、寄り道の 板なので 1階から 出す
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
		sale: 3,
		// 闇の 塔：上るほど 吹き抜け（縦長の 中部屋）・格子・通路だらけが ふえ、3×3 は 消える
		layouts: [
			{ to: 10, shapes: { grid: 3, vhall: 1 } },
			{ to: 30, shapes: { grid: 2, vhall: 2, ladder: 1, dense: 1, maze: 1 } },
			{ shapes: { vhall: 2, ladder: 2, dense: 2, maze: 2, elbow: 1, ring: 1 } },
		],
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
		level: ramp(50, 32, 1),
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
/** 持ち帰った 品の 買い取りの 倍率（Dungeon.sale）。 */
export const saleRate = (d: DungeonId): number => dungeonById(d).sale ?? 1;

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
