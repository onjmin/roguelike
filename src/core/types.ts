// ゲームの状態と定義の型。core は DOM に触らない（Node の自動プレイでも動く）。
//
// 状態（RunState）はそのまま JSON にして中断セーブに入れる。
// マップの配列は保存するときだけ文字列にする（serial.ts）。

import type { Dir8, Pos } from "./geom";
import type { Layout } from "./mapgen";
import type { RngState } from "./rng";

/** ダンジョン＝おんJの 植民地（data/dungeons.ts）。 */
export type DungeonId =
	| "shallow"
	| "main"
	| "deep"
	| "kinoko"
	| "tropical"
	| "konamono"
	| "festival"
	| "hidden";

/**
 * 冒険の 目的。fetch：いちばん底の 品を 拾って 入口まで 持ち帰る。
 * boss：いちばん底に いる ボス（品を 持っている）を たおすと、その場で 入口へ 帰れる。
 */
export type Objective = "fetch" | "boss";

/**
 * ボスを たおした あと、一瞬で 入口へ 帰る わけ（画面の 演出の 種類）。
 * sprout：きのこが 伸びて 押し上げる・escort：住人に 送ってもらう・
 * eruption：噴火の 熱風で 吹き飛ぶ・geyser：源泉の 湯柱で 押し上げられる。
 */
export type RescueKind = "sprout" | "escort" | "eruption" | "geyser";

// ───────────────────────── 道具 ─────────────────────────

export type ItemCat =
	| "weapon"
	| "shield"
	| "ring"
	| "herb"
	| "scroll"
	| "staff"
	| "arrow"
	| "food"
	| "goal";

/** 持ち物の 整理の順（分類）。 */
export const CAT_ORDER: readonly ItemCat[] = [
	"weapon",
	"shield",
	"ring",
	"herb",
	"scroll",
	"staff",
	"arrow",
	"food",
	"goal",
];

/** 名前が冒険ごとに入れかわる（未識別になる）種類。 */
export const UNIDENTIFIED_CATS: readonly ItemCat[] = [
	"ring",
	"herb",
	"scroll",
	"staff",
];

export type ItemDef = {
	id: string;
	cat: ItemCat;
	name: string;
	/** 説明（全角スペースで区切る。一覧の2行目に出す）。 */
	desc: string;
	/** ひとこと（皮肉の きいた 1文。「せつめい」の窓に 出す）。 */
	flavor: string;
	/**
	 * 見えない 道具（トルネコ1の パルプンテの巻物）。見透し草を 飲んだ 階でしか 床に 見えず、読めない
	 * （拾うことは できる）。
	 */
	invisible?: boolean;
	/** 武器・矢の強さ。 */
	atk?: number;
	/** 盾の強さ。 */
	def?: number;
	/** 武器の音（振った・当たった。data/sfx.ts の名前）。無ければ 素手と同じ。 */
	sound?: { swing: string; hit: string };
	/** 杖の回数（配るときにこの範囲で決める）。 */
	charges?: [number, number];
	/** 図鑑の並び順。 */
	order: number;
	/** めずらしい道具：未識別の分類でも はじめから 正体が わかり、見た目も 専用（メタルぷゆゆの 落とし物）。 */
	rare?: true;
	/** 専用の 絵（目的の品。床・持ち物・投げたとき）。無ければ カテゴリの 絵（ui/icons.ts）。 */
	icon?: string;
};

/** 床・持ち物・モンスターの持ち物に置かれる、1つ1つの道具。 */
export type Item = {
	uid: number;
	kind: string;
	/** 武器・盾・剛力の指輪の修正値（+1 など）。 */
	plus: number;
	cursed: boolean;
	/** 杖の残り回数。 */
	charges: number;
	/** 修正値・呪い・残り回数がわかっているか（装備するか識別すると true。装備で わかるのは その 1つだけ）。 */
	known: boolean;
	/** 矢の本数（矢以外は 1）。 */
	count: number;
	/** 錆びない（防錆スレ）。 */
	rustproof?: boolean;
};

// ───────────────────────── モンスター ─────────────────────────

/** モンスターの特技（トルネコ1の役割。資源を奪うものが中心）。 */
export type Ability =
	| { k: "steal"; rate: number } // 持ち物を盗んでワープする（倒せば取り返せる）
	| { k: "swap"; rate: number } // はじめから パンを 持ち、なぐる かわりに 持ち物と 取りかえて 逃げる（1体 1回だけ。倒せば 持っている 物を 落とす）
	| { k: "pickup" } // 床の道具を拾って持ち歩く
	| { k: "rust"; rate: number } // 盾の修正値を下げる
	| { k: "poison"; rate: number } // ちからを下げる
	| { k: "drainLv"; rate: number } // レベルを下げる
	| { k: "drainMax"; rate: number } // 最大HP か 最大ちからを下げる
	| { k: "sleepSpell"; rate: number } // 眠らせる呪文
	| { k: "gaze"; rate: number } // にらんで混乱させる
	| { k: "ranged"; rate: number; atk: number; verb: string } // まっすぐ撃つ
	| {
			k: "breath";
			rate: number;
			dmg: [number, number];
			/** 吐く 物（既定は 炎）。 */
			what?: string;
	  } // 炎を吐く
	| { k: "split"; rate: number } // なぐられると分裂する
	| { k: "warpPlayer"; rate: number } // なぐった相手をワープさせる
	| { k: "fastMove" } // 倍速で動く（攻撃は1回）
	| { k: "fastAct" } // 倍速で行動する（2回攻撃）
	| { k: "random" } // ふらふら動く
	| { k: "mimic" } // 道具に化けている
	| { k: "explode" } // HP が減ると爆発する
	| { k: "grab" } // 動かない。となりにいる相手をつかむ
	| { k: "statue" } // 近づくまで動かない
	| { k: "pack" } // 4体の群れで出てくる
	| { k: "invisible" } // 見えない
	| { k: "metal" } // 逃げる・ダメージは最大1・なぐられるとワープ
	| { k: "slow" } // 2ターンに1回しか動かない
	| { k: "shy" } // 近づくと逃げる（追いつめられると戦う）
	| { k: "accel"; after: number } // となりに after ターンいると倍速になる
	| { k: "revive" } // たおしても一度だけ起き上がる（投げた薬草・封印で防げる）
	| { k: "retreat" } // 弱ると逃げて回復する
	| { k: "armor" } // なぐる攻撃のダメージが半分
	| { k: "knockback"; rate: number } // なぐった相手を吹きとばす
	| { k: "berserk" } // HP が半分を切ると怒って倍速になる
	| { k: "curse"; rate: number }; // なぐった相手の装備をのろう

export type MonsterTag = "dragon" | "undead" | "plant" | "doll" | "metal";

export type MonsterDef = {
	id: string;
	name: string;
	/** 歩行グラの参照（`sa:<id>` か `pub:sprites/...`）。 */
	sprite: string;
	/**
	 * 動いていない ときの 絵（置物。`pub:sprites/...png#0,0,16,16` の 1コマ。歩かず いつも 前向き）。
	 * あれば、動きだす まで 階に 置く ただの 置物（Floor.statues）と 同じ 見た目に なる。
	 */
	still?: string;
	hp: number;
	atk: number;
	def: number;
	exp: number;
	/** 出てくる階（両端を含む）。 */
	floors: [number, number];
	/** 出やすさ（同じ階の中での重み）。 */
	weight: number;
	abilities: Ability[];
	tags?: MonsterTag[];
	/** 出てきたときに眠っているか（既定は半々）。"deep" は なぐられるまで起きない。 */
	sleep?: "never" | "always" | "deep";
	/** たおすと 必ず落とす道具（メタルぷゆゆ → 成長の実。トルネコ1の しあわせのたね）。 */
	drop?: string;
	/** その植民地（板）だけの 敵（ほかの 板には 出ない。改変の杖でも ならない）。 */
	board?: DungeonId;
	/**
	 * ボス（その板の いちばん底に 1体だけ。ふつうの 階の 表・変化の杖・置物には 出ない。
	 * 変化・分裂・論破・諸刃・まどわし・!skスレの 全滅/道具/メタルが 効かず、爆風でも 即死しない）。
	 * 見分けは これで（封印で 消える とくぎ（has）では 見ない）。
	 */
	boss?: true;
	/** 絵の 倍率（ボスは 大きく 描く。無ければ 1）。 */
	scale?: number;
	/** 図鑑の一言。 */
	desc: string;
	/** ひとこと（皮肉の きいた 1文。図鑑の「せつめい」に 出す）。 */
	flavor: string;
};

export type MonsterStatus = {
	/** 眠り（ターン）。DEEP は なぐられるまで、DOZE は 近くに来ると起きる。 */
	sleep: number;
	confuse: number;
	/** 金縛り（ターン。HOLD は なぐられるまで）。 */
	paralyze: number;
	slow: number;
	fast: number;
	blind: boolean;
	sealed: boolean;
	/** 動き出していない置物。 */
	dormant: boolean;
};

export const DOZE = 9000;
export const DEEP = 9999;
export const HOLD = 9999;

export type Monster = {
	uid: number;
	kind: string;
	x: number;
	y: number;
	dir: Dir8;
	hp: number;
	maxHp: number;
	/** 行動できる時刻（半ターン単位）。 */
	nextAt: number;
	status: MonsterStatus;
	/** 持っている道具（倒すと落とす）。盗んだ道具・拾った道具もここ。 */
	carry: Item | null;
	/** さまよう先。 */
	goal: Pos | null;
	/** 最後にプレイヤーを見た位置。 */
	lastSeen: Pos | null;
	/** 見失ったあと、向いている方へ通路をたどっている（あと何歩たどるか。0 なら たどっていない）。 */
	hunt?: number;
	/** 進めなかったターン数（続けて）。 */
	stuck?: number;
	/** stuck を最後に数えた時刻（1ターンに1回だけ数える）。 */
	stuckAt?: number;
	/** 化けている道具の種類（見破られたら null）。 */
	disguise: string | null;
	/** 盗んだあと逃げている。 */
	fleeing?: boolean;
	/** 持ち物と パンを 取りかえた（swap は 1体 1回だけ）。 */
	swapped?: boolean;
	/** 爆発しかけ（HP が減って動かなくなった）。 */
	fuse?: boolean;
	/** キリコのとなりにいたターン数（加速する敵）。 */
	seenTurns?: number;
	/** 一度 起き上がった（よみがえる敵）。 */
	revived?: boolean;
	/** 弱って逃げている（回復したら戻る）。 */
	retreating?: boolean;
	/** 怒った（顔真っ赤）。 */
	enraged?: boolean;
};

// ───────────────────────── 罠 ─────────────────────────

export type TrapKind =
	| "bear" // トラばさみ
	| "acid" // 酸（盾−1）
	| "sleep" // 眠りガス
	| "trip" // 転び石
	| "mine" // 地雷
	| "arrow" // 矢
	| "dart" // 毒矢
	| "warp" // 転移床
	| "pit"; // 落とし穴

export type Trap = { x: number; y: number; kind: TrapKind; found: boolean };

// ───────────────────────── プレイヤー ─────────────────────────

export type PlayerStatus = {
	sleep: number;
	confuse: number;
	blind: number;
	/** まどわし（ターン）。敵が キリコの姿に、床の道具が お花に 見える。 */
	daze: number;
	fast: number;
	/** トラばさみ（ターン）。 */
	trapped: number;
	/** つかまれている相手の uid。 */
	heldBy: number | null;
};

export type Player = {
	x: number;
	y: number;
	dir: Dir8;
	hp: number;
	maxHp: number;
	str: number;
	maxStr: number;
	lv: number;
	exp: number;
	/** 満腹度 ×20（1/20% 単位。トルネコと同じく 1行動で 2 減る）。 */
	hunger: number;
	/** 自然回復の端数（最大HP を足して 150 ごとに 1 回復）。 */
	regenAcc: number;
	weapon: number | null;
	shield: number | null;
	ring: number | null;
	/** 装備した矢（撃つで 1本ずつ 向いている方へ。トルネコ1と同じ。前の版の中断セーブには無い）。 */
	arrow?: number | null;
	items: Item[];
	status: PlayerStatus;
	nextAt: number;
};

// ───────────────────────── 階 ─────────────────────────

export type FloorItem = { x: number; y: number; item: Item };

export type Floor = {
	depth: number;
	layout: Layout;
	stairs: Pos;
	items: FloorItem[];
	traps: Trap[];
	monsters: Monster[];
	/** 踏破した（見たことのある）マス。 */
	seen: Uint8Array;
	/** 結界のマス（idx）。 */
	wards: number[];
	/** モンスターハウスの部屋 id（無ければ -1）。 */
	house: number;
	/** モンスターハウスに入った。 */
	houseAwake: boolean;
	/** この階に来てからのターン数（湧き）。 */
	turns: number;
	/** この階（スレ）の レス数。1000 で dat落ち（balance.ts の RES_LIMIT）。 */
	res: number;
	/** 出した レスの 知らせの 段（0：まだ・1：950・2：980・3：1000）。 */
	resWarned: number;
	/** 安価が 来る レス数（来ない・もう来た なら -1。core/anka.ts）。 */
	ankaAt?: number;
	/** いま 出ている 安価。 */
	anka?: Anka | null;
	/** 気配スレ：敵の位置がわかる。 */
	senseMonsters: boolean;
	/** 宝探しスレ：道具の位置がわかる。 */
	senseItems: boolean;
	/** 聖地巡礼スレを 読んだ：あとから ふえた 罠（釣りスレ）も はじめから 見える。 */
	mapped?: boolean;
	/** 見透し草：罠と見えない敵が見える。 */
	sight: boolean;
	/** ただの 置物（通れない 地形。idx）。置物の 敵が 出る 階だけ（core/floor.ts の placeStatues）。 */
	statues?: number[];
	/** 生きている ボスの uid（目的が boss の いちばん底だけ。たおしたら 消す）。 */
	boss?: number;
	/** ボスを 見た（目を さまして 待ちかまえていた。画面の 曲と HP の ゲージ）。 */
	bossSeen?: true;
};

// ───────────────────────── 冒険（1回の挑戦） ─────────────────────────

/** 安価の お題（core/anka.ts）。 */
export type AnkaKind =
	| "herb"
	| "scroll"
	| "throw"
	| "eat"
	| "kill"
	| "sleep"
	| "hit";

export type Anka = {
	kind: AnkaKind;
	/** こなす 回数。 */
	need: number;
	done: number;
	/** この レス数までに。 */
	due: number;
};

export type IdTable = {
	/** 種類 → 未識別の名前。 */
	fake: Record<string, string>;
	/** 識別ずみの種類。 */
	known: Record<string, true>;
	/** プレイヤーがつけた名前（種類 → 名前）。 */
	named: Record<string, string>;
};

export type Ending = {
	/**
	 * 倒れた・持ち帰った（目的の品。目的が boss なら ボスを たおして 品ごと 一瞬で 帰った）・
	 * 帰還スレで地上へもどった。
	 */
	kind: "dead" | "clear" | "escape";
	cause: string;
	depth: number;
	turn: number;
};

export type RunState = {
	v: number;
	seed: string;
	/** どのダンジョンか。 */
	dungeon: DungeonId;
	/**
	 * 目的（村で 決めて Run.create に 渡す）。fetch のときは 書かない（無ければ fetch。
	 * 前の 版の 中断セーブ・リプレイ・parity の 基準が そのまま 通るように）。
	 */
	objective?: Objective;
	rng: RngState;
	depth: number;
	turn: number;
	/** 時刻（半ターン単位。倍速・鈍足の順番に使う）。 */
	time: number;
	player: Player;
	floor: Floor;
	/** モンスターハウスのある階。 */
	houses: number[];
	/** 見た道具の uid（地図に 出す）。 */
	seen: number[];
	ids: IdTable;
	nextUid: number;
	log: string[];
	/** 倒したモンスター（記録・図鑑用）。 */
	kills: Record<string, number>;
	/** 帰り道（目的の品を持って上っている）。 */
	returning: boolean;
	/** 終わった（倒れた・持ち帰った）。 */
	end: Ending | null;
	stats: {
		maxDepth: number;
		itemsUsed: number;
	};
	/**
	 * リプレイの記録（入れたコマンドを短い文字にしてカンマでつないだもの。core/replay.ts）。
	 * この仕組みより前の中断セーブから続けた冒険は null（記録できない）。
	 */
	replay?: string | null;
	/** 記録したコマンドの数。 */
	replayN?: number;
	/** 遊んだ版（ゲームの中身の版。中断をはさんで版が変わったら 足していく。UI が入れる）。 */
	builds?: string[];
	/** 蓄音機に 録った 声（最後に たおした 敵の 種類。再生すると 消える）。 */
	voice?: string | null;
	/** この 冒険で 拾った「最後の レス」の id（core/data/lastRes.ts。拾ったら 足す。無ければ まだ 無い）。 */
	lastRes?: string[];
	/** ぷゆゆの お弁当（始めの持ち物）を 持たずに 出た（リプレイで 同じに 始めるため）。 */
	noLunch?: boolean;
	/** 倉庫から持ちこんだ道具（はじめの形。リレミトならぬ 帰還スレで持ち帰った道具を、次の冒険へ。リプレイで同じに始めるため）。 */
	carriedIn?: Item[];
};

// ───────────────────────── コマンドとイベント ─────────────────────────

export type Command =
	| { c: "move"; dir: Dir8; noPickup?: boolean }
	| { c: "attack"; dir?: Dir8 }
	| { c: "turn"; dir: Dir8 }
	| { c: "wait" }
	| { c: "pickup" }
	| { c: "use"; item: number; target?: number }
	| { c: "throw"; item: number; dir?: Dir8 }
	| { c: "drop"; item: number }
	| { c: "equip"; item: number }
	| { c: "unequip"; item: number }
	| { c: "swap"; item: number }
	| { c: "stairs" }
	| { c: "sort" }
	| { c: "shoot" }
	| { c: "play" }
	| { c: "name"; kind: string; text: string };

/** 表示側（UI）に知らせる出来事。UI はこれを順に演出し、最後の状態を描く。 */
export type GameEvent =
	| { t: "msg"; text: string; tone?: "warn" | "good" }
	| { t: "se"; name: string }
	| { t: "move"; id: number; from: Pos; to: Pos; dir: Dir8 }
	| { t: "turn"; id: number; dir: Dir8 }
	| { t: "attack"; id: number; dir: Dir8 }
	| { t: "hurt"; id: number; pos: Pos; amount: number; hp?: number }
	| { t: "heal"; id: number; pos: Pos; amount: number; hp?: number }
	| { t: "miss"; id: number; pos: Pos }
	| { t: "die"; id: number; pos: Pos }
	/** 敵が ふえた（from は もとの敵の マス。そこから 分かれて 出てくる）。 */
	| { t: "appear"; id: number; pos: Pos; from?: Pos }
	| {
			t: "bolt";
			from: Pos;
			to: Pos;
			kind: "item" | "staff" | "arrow" | "fire";
			icon?: string;
	  }
	| { t: "warp"; id: number; from: Pos; to: Pos }
	/**
	 * r：爆発が 巻きこむ まわりの マス数（地雷 1・炎上案件 2。画面の 火の玉の 大きさ）。
	 * at：炎上スレで 焼かれる 敵の いる マス（それぞれに 火の玉を 出す）。
	 */
	| { t: "fx"; kind: string; pos: Pos; r?: number; at?: Pos[] }
	| { t: "floor"; depth: number; up: boolean }
	/** レベルが 上がった（上がった あとの レベル・HP。画面の ステータスは この 行で 追いつく）。 */
	| { t: "levelup"; lv: number; hp: number; maxHp: number }
	/** 床に 道具が 置かれた（落とした・置いた・投げて 落ちた など。画面は ここで 床に 出す）。 */
	| { t: "item"; uid: number; pos: Pos }
	/** 安価が 来た・こなした・守らなかった（画面の ステータスの 安価は、これに 続く 行で 追いつく）。 */
	| { t: "anka" }
	| { t: "house" }
	/** 眠った・目が さめた（キリコ。画面の Z）。 */
	| { t: "sleep"; id: number; on: boolean }
	/** 眠っている あいだの 1ターンの 始まり（画面は ここで 区切って 1ターンずつ 見せる）。 */
	| { t: "doze" }
	| { t: "quake"; level: number }
	/** 地図に 載る ことが わかった（聖地巡礼スレ・ヲチスレ・発掘スレ。地図を 閉じていれば 画面が ひとこと 添える）。 */
	| { t: "reveal" }
	| { t: "goal" }
	/** ボスを はじめて 見た（目を さました。id は その uid。続く 行で「待ちかまえていた！」）。 */
	| { t: "boss"; id: number }
	/** ボスを たおして、入口へ 帰る（kind は 帰り方。続く 行が その わけ。このあと end）。 */
	| { t: "rescue"; kind: RescueKind }
	| { t: "end" };

/** プレイヤーの id（イベントの id）。モンスターは uid（1 以上）。 */
export const PLAYER_ID = 0;
