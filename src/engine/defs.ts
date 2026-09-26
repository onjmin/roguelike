// 歩ける村（保守村）のデータ（マップ・イベント）と、イベントのスクリプトから使う命令（Story）の型。
// rpg の engine/defs.ts から、村で使う物だけを残した（戦闘・仲間・なかよし度・セーブは無い）。
// 村のデータは src/data/village/、スクリプトは src/ui/villageEvents.ts に書く。

import type { DungeonId, Item, RunState } from "../core/types";
import type { Speaker } from "../data/quotes";
import type { SavedReplay } from "./save";
import type { Dir } from "./types";

// ───────────────── マップ ─────────────────

export type TileDef = {
	/** 下から順に重ねる画像参照（`pub:assets/rpg-reze/Base.png#x,y,w,h` 等。engine/assets.ts の resolveRef）。 */
	layers: string[];
	/** 画像が読めないときの塗り色。 */
	color: string;
	/** 通れるか。 */
	passable: boolean;
	/** キャラより手前に描く画像（木の葉・屋根のひさし等）。 */
	above?: string[];
	/** カウンター（向こう側の人に話しかけられる）。 */
	counter?: boolean;
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
	/** マップに入るたびに走るスクリプト。 */
	onEnter?: Script;
	/** マップの外側の色。 */
	outside?: string;
	/** キャラの上に重ねて描く動く飾り（灯り・煙など）。ox・oy はカメラの位置（ソース画素）、t はミリ秒。 */
	decor?: (
		g: CanvasRenderingContext2D,
		ox: number,
		oy: number,
		t: number,
	) => void;
};

// ───────────────── 村を出るとき ─────────────────

/** 村を出て 冒険へ（main.ts が受け取る。旧タイトルの TitleChoice と同じ形）。 */
export type VillageExit =
	| { kind: "new"; dungeon: DungeonId; carry: Item[] }
	| { kind: "continue"; state: RunState }
	| { kind: "replay"; replay: SavedReplay };

// ───────────────── シナリオ API ─────────────────

export type Script = (s: Story) => Promise<void>;

export type SayOptions = {
	/** 名前欄を差し替える（モブ・「？？？」等）。 */
	name?: string;
	/** 立ち絵を出さない。 */
	noPortrait?: boolean;
};

export type Story = {
	readonly state: VState;
	/** セリフ。who は 仲間（data/cast.ts）か null（地の文。name を渡せばモブ）。キリコは しゃべらない。 */
	say(who: Speaker | null, text: string, opt?: SayOptions): Promise<void>;
	/** 地の文。 */
	narrate(text: string): Promise<void>;
	/** 選択肢。選ばれた番号を返す（cancel があれば B・外のタップで その番号）。 */
	choose(options: string[], opt?: { cancel?: number }): Promise<number>;
	/** 窓を隠して待つ。 */
	wait(ms: number): Promise<void>;
	fadeOut(ms?: number): Promise<void>;
	fadeIn(ms?: number): Promise<void>;
	/** BGM を切り替える（null で止める）。 */
	bgm(name: string | null): void;
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
	face(target: string, dir: Dir | "player"): void;
	/** イベントを出す／消す（村を出るまで）。 */
	show(eventId: string): void;
	hide(eventId: string): void;
	/** イベントの位置を変える（見た目だけ。村を建て直すと元に戻る）。 */
	place(eventId: string, x: number, y: number, dir?: Dir): void;
	/** 画面の上に 短い知らせ。 */
	toast(text: string): void;
	/** 町の段・開いたダンジョンを 読み直して 村を建て直す（キリコは 同じマスのまま）。暗転の中で呼ぶ。 */
	rebuild(): Promise<void>;
	/** 村を出る（いちばん外のスクリプトが終わってから 暗転して 出る）。 */
	exit(choice: VillageExit): void;
};
