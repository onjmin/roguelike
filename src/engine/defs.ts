// 歩ける村（保守村）のデータ（マップ・イベント）と、イベントのスクリプトから使う命令（Story）の型。
// rpg の engine/defs.ts から、村で使う物だけを残した（戦闘・仲間・なかよし度・セーブは無い）。
// 村のデータは src/data/village/、スクリプトは src/ui/villageEvents.ts に書く（おんJ 本館の 中は ui/hallEvents.ts）。

import type { DungeonId, Item, Objective, RunState } from "../core/types";
import type { KirikoMode, Speaker } from "../data/quotes";
import type { CrowdNode, PedCost } from "../data/village/crowd";
import type { SavedReplay } from "./save";
import type { Dir } from "./types";

// ───────────────── マップ ─────────────────

export type TileDef = {
	/**
	 * 下から順に重ねる画像参照（`pub:assets/rpg-reze/Base.png#x,y,w,h` 等。engine/assets.ts の resolveRef）。
	 * マスより上へはみ出した部分（16x32 の扉・掲示板の上半分など）はキャラより手前に描く。
	 */
	layers: string[];
	/** 画像が読めないときの塗り色。 */
	color: string;
	/** 通れるか。 */
	passable: boolean;
	/** キャラより手前に描く画像（木の葉・屋根のひさし等）。 */
	above?: string[];
	/** カウンター（向こう側の人に話しかけられる）。 */
	counter?: boolean;
	/**
	 * オートタイル（layers の上に重ねる）。16x80 の 縦長の 切り出しで、上から 外の角・左右の岸・
	 * 上下の岸・内の角・まんなか（WOLF RPG エディターと 同じ）。同じ auto の マスどうしで つながる。
	 */
	auto?: string;
};

export type EventTrigger =
	/** A ボタン／タップで話しかける。 */
	| "talk"
	/** 上に乗ったとき（ダンジョンの口など）。 */
	| "touch"
	/** 条件を満たしたら自動で始まる（カットシーン）。`once` と併用が基本。 */
	| "auto";

/** 村の いまの状態（イベントの出現条件で見る）。キリコの位置と、その場かぎりの印。 */
export type VState = {
	x: number;
	y: number;
	dir: Dir;
	flags: Record<string, boolean | number | string>;
};

export type EventDef = {
	id: string;
	x: number;
	y: number;
	/** 見た目（`sa:<id>` の歩行グラ／`pub:<path>`・`#sx,sy,sw,sh` 付きは向きのない置物）。省略すると見えないイベント。 */
	sprite?: string;
	dir?: Dir;
	trigger: EventTrigger;
	/** 通り抜けられる（見えない踏みイベントなど）。見た目なしなら既定で true。 */
	through?: boolean;
	/** うろうろ歩く。 */
	wander?: boolean;
	/** 向きを変えない（看板・置物）。 */
	fixedDir?: boolean;
	/** 出現条件。偽の間はマップに居ない扱い。 */
	when?: (s: VState) => boolean;
	/** 1回だけ実行する（実行後 `done:<map>:<id>` が立ち、以後は消える）。 */
	once?: boolean;
	run?: Script;
};

export type MapDef = {
	id: string;
	/** 画面に出す地名。 */
	name: string;
	/** BGM 名（data/bgm.ts）。null なら無音、省略なら前の曲を続ける。 */
	bgm?: string | null;
	/** 行の各文字 → タイル。 */
	tiles: Record<string, TileDef>;
	/** マップ本体（1文字 = 1マス）。全行同じ長さにする。 */
	rows: string[];
	events?: EventDef[];
	/**
	 * 入るとき、幕が 上がる前に 1回だけ 呼ぶ（人を 置く・隠すだけ。待たない）。
	 * 帰ってきた場面で 仲間を 口の前に 並べておく（ui/villageReturn.ts）。
	 */
	prepare?: (s: Story) => void;
	/** マップに入るたびに走るスクリプト（幕が 上がってから）。 */
	onEnter?: Script;
	/** マップの外側の色。 */
	outside?: string;
	/** 街の 人通り（村の 地図だけ。data/village/crowd.ts・ui/villageCrowd.ts）。 */
	crowd?: { stage: number; nodes: readonly CrowdNode[]; cost: PedCost };
	/** タイルの ほかに 使う 画像（decor で 描く 絵など。入る 前に 先読みする）。 */
	images?: string[];
	/** キャラの上に重ねて描く動く飾り（灯り・煙など）。ox・oy はカメラの位置（ソース画素）、t はミリ秒。 */
	decor?: (
		g: CanvasRenderingContext2D,
		ox: number,
		oy: number,
		t: number,
	) => void;
};

// ───────────────── 村を出るとき ─────────────────

/** 村を出て 冒険へ（main.ts が受け取る）。objective は 村で 行き先を 決めた ときの 目的（data/objectives.ts）。 */
export type VillageExit =
	| {
			kind: "new";
			dungeon: DungeonId;
			carry: Item[];
			objective: Objective;
			/** ぷゆゆの お弁当を 持って 出る。 */
			lunch: boolean;
	  }
	| { kind: "continue"; state: RunState }
	| { kind: "replay"; replay: SavedReplay };

// ───────────────── シナリオ API ─────────────────

export type Script = (s: Story) => Promise<void>;

/** 読み上げの声（data/cast.ts の voice。rpg の VoiceDef と 同じ）。 */
export type VoiceDef = {
	/** dtm の koe 音源キーワード（roze / shiyo …）。 */
	model: string;
	pitchOffset?: number;
	emotion?: "neutral" | "happy" | "sad" | "angry";
	style?: "neutral" | "calm" | "lively";
};

export type SayOptions = {
	/** 名前欄を差し替える（モブ・「？？？」等）。 */
	name?: string;
	/** 立ち絵を出さない。 */
	noPortrait?: boolean;
	/** 仲間でない人の 立ち絵（public/ からの パス。無ければ 「立ち絵（仮）」の ダミー）。 */
	portrait?: { id: string; src: string; color?: string };
	/** 名前欄の 色（仲間でない人。無ければ who の 色）。 */
	color?: string;
	/** 読み上げの 声（仲間でない人。無ければ who の 声）。 */
	tts?: VoiceDef;
};

export type Story = {
	readonly state: VState;
	/** セリフ。who は 仲間（data/cast.ts）か null（地の文。name を渡せばモブ）。キリコは kiriko で。 */
	say(who: Speaker | null, text: string, opt?: SayOptions): Promise<void>;
	/**
	 * キリコの ことば。think は 独白（（　）で かこむ・声なし・村の だれにも 聞こえない）、
	 * voice は 声（村の 雑談と 喫茶だけ。uc で 読み上げる）。data/quotes.ts の KirikoMode。
	 */
	kiriko(text: string, mode: KirikoMode): Promise<void>;
	/** 地の文。 */
	narrate(text: string): Promise<void>;
	/** 選択肢。選ばれた番号を返す（cancel があれば B・外のタップで その番号。start は はじめの カーソル）。 */
	choose(
		options: string[],
		opt?: { cancel?: number; start?: number },
	): Promise<number>;
	/** 窓と 立ち絵を 片付けて 待つ（一覧の窓・人が 歩く 前に）。 */
	wait(ms: number): Promise<void>;
	/** 暗転する（会話の窓と 立ち絵は 先に 片付ける）。 */
	fadeOut(ms?: number): Promise<void>;
	fadeIn(ms?: number): Promise<void>;
	/** BGM を切り替える（null で止める）。 */
	bgm(name: string | null): void;
	/** 鳴っている BGM を ms かけて 絞って 止める。 */
	fadeBgm(ms: number): Promise<void>;
	/** 効果音（data/sfx.ts の名前）。 */
	se(name: string): void;
	flag(name: string): boolean | number | string | undefined;
	set(name: string, value?: boolean | number | string): void;
	/**
	 * 歩かせる。target は "player" かイベント ID。
	 * route は "uuddlr" のような文字列（u/d/l/r = 1歩, U/D/L/R = その方向を向くだけ, w = 少し待つ）。
	 */
	move(
		target: string,
		route: string,
		opt?: { speed?: number; through?: boolean },
	): Promise<void>;
	/**
	 * (x, y) まで 歩かせる（道は 地形だけで 決める。ほかの人は すりぬけ、キリコの マスは よける）。
	 * avoid なら ほかの人・置物も よける（村の 子の 小さな しぐさ。data/mobs.ts の Beat）。着いたら 解決する。
	 * 道が なければ（台の うしろ・キリコが ふさぐ 細道の 先）、キリコ 以外は 歩ける ところまで 歩いて
	 * いちばん せまい すきまを とびこえる（engine/longWalk.ts の hopRoute）。キリコ と avoid は 行けなければ 何もしない。
	 * 行き先に 入れなければ（通れない マス・キリコの マス）だれでも 何もしない。
	 * 道が 長い（engine/longWalk.ts の LONG_WALK 歩より 先）と、キリコ 以外は 画面に 映らない ところを とばす
	 * （映らない マスへ 置きなおしてから 歩く。カメラが ついていく 人は 短い 暗転で 道の 先へ）。
	 * noWarp なら とばさず ぜんぶ 歩いて 見せる（ROM専の 行列）。
	 */
	goto(
		target: string,
		x: number,
		y: number,
		opt?: { speed?: number; avoid?: boolean; noWarp?: boolean },
	): Promise<void>;
	face(target: string, dir: Dir | "player"): void;
	/** 人（イベント ID）が 見えていて、キリコから r マス以内（たて・よこ・ななめの 大きい方）に いるか。 */
	near(target: string, r: number): boolean;
	/**
	 * カメラを 人（イベント ID。歩けば ついていく）か マスに 向ける。null で キリコに もどす。
	 * ゆっくり 動いて 着いたら 解決する。instant なら すぐ（暗転の 中で）。
	 * いちばん外の スクリプトが 終われば キリコに もどる。
	 */
	look(
		target: string | readonly [number, number] | null,
		opt?: { instant?: boolean },
	): Promise<void>;
	/** イベントを出す／消す（村を出るまで）。"player" は キリコ（村に 入りなおすまで）。 */
	show(eventId: string): void;
	hide(eventId: string): void;
	/** イベントの位置を変える（見た目だけ。村を建て直すと元に戻る）。 */
	place(eventId: string, x: number, y: number, dir?: Dir): void;
	/** 画面の上に 短い知らせ。 */
	toast(text: string): void;
	/** 町の段・開いたダンジョンを 読み直して 村を建て直す（キリコは 同じマスのまま）。暗転の中で呼ぶ。 */
	rebuild(): Promise<void>;
	/**
	 * べつの 地図へ 移る（村 "village" ⇔ おんJ 本館 "hall"。rpg の story.warp と 同じ）。キリコは (x, y) に
	 * dir を 向いて 立つ（省けば 今の 向き）。暗転の 中で 呼ぶ。移った 先の 入る ときの 場面（prepare・onEnter）は 走らせない。
	 */
	warp(map: string, x: number, y: number, dir?: Dir): Promise<void>;
	/** 村を出る（いちばん外のスクリプトが終わってから 暗転して 出る）。 */
	exit(choice: VillageExit): void;
};
