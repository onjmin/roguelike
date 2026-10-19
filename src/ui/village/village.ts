// 歩ける村（おんJタウン）。ダンジョンの外で キリコが 歩きまわる 1枚のマップ。
// rpg の engine/game.ts（Game）から、戦闘・仲間・隊列・セーブを のぞいて 移したもの。
//
// - 4方向で 1マスずつ歩く（十字キー・キーボード。斜めは 縦を先に 試して、だめなら 横へ すべる）。
//   画面を タップすると そこまで 歩く（人・看板なら 前まで行って 話す。カウンターの 向こうの人も。
//   ダンジョンの口を タップすれば 口まで 歩いて もぐるか きく。前に 人が 立って ふさいでいる口なら その人と 話す）。
//   画面を 押さえつづけると 指の方へ 歩きつづける。
// - A で 目の前の 人・物を 調べる（カウンター越しも）。目の前が 踏む 所（扉・出口）なら 1歩 踏みこむ。
//   B・☰ で 村の メニュー（ui/village/villageEvents.ts）。
// - 窓（会話・選択肢・メニュー）が 開いている間は 歩かない（input.busy）。
// - 地図は 村（village）と おんJ 本館の 中（hall。ui/village/hallEvents.ts）と 建物の 中（喫茶・小屋・常識堂の 奥・倉庫。
//   ui/village/cafe.ts・ui/village/rooms.ts）。扉・出口の マットで Story.warp（暗転の 中で
//   地図を かえる。rpg の Game.loadMap と 同じ）。warp では 入る ときの 場面（prepare・onEnter）は 走らせない。
// - 入るたびに onEnter（帰ってきた場面・開いた知らせ・持ち帰った物。ui/village/villageReturn.ts）。その間は 歩かない・
//   うろうろ しない（scene）。場面では カメラを 人や 建物に 向ける（look）。
// - 場面で 歩かせる 道（Story.goto）が 長いと、キリコ 以外は 画面に 映らない ところを とばす（engine/longWalk.ts。
//   地図が 87×52 に 広がって、遠くの 人が 来るまで 長く 待った）。映らない マスへ 置きなおして 画面の はしの
//   すぐ 外から 歩いて 入る・画面の 外へ 出ていったら 行き先へ。カメラが ついていく 人は 短い 暗転で 道の 先へ。
//   noWarp なら ぜんぶ 歩く（ROM専の 行列）。
//   道が なければ（台の うしろの ロゼ・シヨ、キリコが ふさぐ 細道の 先）、キリコ 以外は いちばん せまい すきまを
//   とびこえる（近ければ 弧を えがいて とぶ。遠ければ 映らない うちに 置きなおす。engine/longWalk.ts の hopRoute）。
// - 村の 地図には 街の 人通り（ui/village/villageCrowd.ts。町の 段と 時刻で 流れが かわる）。通行人は すりぬけられる。
// - start() は 村を出ると（もぐる・冒険に　もどる・リプレイ）VillageExit で 解決する。
//   冒険（Play）と 同じ canvas・入力を使うので、出る前に rAF を止めて タップの受け口を外す。

import { type Dir8, DX, DY, isDiagonal } from "../../core/geom";
import type { DungeonId, Objective } from "../../core/types";
import { HIT_SE } from "../../data/audio/sfx";
import { CAST, heroWalk, KIRIKO, KIRIKO_WALK } from "../../data/people/cast";
import type { KirikoMode, Speaker } from "../../data/story/quotes";
import {
	advanceClock,
	nowHour,
	nowMinute,
	openMode,
	RETURN_HOURS,
	today,
} from "../../data/town/calendar";
import { modesHeld, modeText } from "../../data/town/openModes";
import { type Surface, surfaceOfMap } from "../../data/town/surface";
import { timeBand } from "../../data/village/crowd";
import {
	BAND_NAME,
	clockLine,
	daylightAt,
	lightOf,
	windowLit,
} from "../../data/village/daylight";
import { type Facility, facilityOfMap } from "../../data/village/facilities";
import { exitFor, VILLAGE_SPOTS, villageRows } from "../../data/village/map";
import { isRoom, type RoomId } from "../../data/village/rooms";
import { preloadImages } from "../../engine/assets";
import { chipsOwned } from "../../engine/chips";
import type {
	EventDef,
	LightRule,
	RoamStep,
	SayOptions,
	Script,
	Story,
	VillageExit,
	VState,
} from "../../engine/defs";
import type { Emote, Gesture, Hit } from "../../engine/emote";
import { Actor, Field } from "../../engine/field";
import { chosenHero } from "../../engine/heroes";
import { dir4Candidates } from "../../engine/input";
import {
	findRoute,
	hopRoute,
	mayWarp,
	type Open,
	type Seen,
	type WalkStep,
	walkRoute,
} from "../../engine/longWalk";
import { loadProgress } from "../../engine/save";
import type { Screen } from "../../engine/screen";
import { settings } from "../../engine/settings";
import {
	clamp,
	DIR_VEC,
	type Dir,
	OPPOSITE,
	sleep,
	TILE,
} from "../../engine/types";
import { walletYen, yen } from "../../engine/wallet";
import { showBootTitle } from "../boot";
import type { Ctx } from "../ctx";
import { el, nextFrame } from "../dom";
import { drawEquip, equipSheet } from "../dungeon/equip";
import type { Hud } from "../dungeon/hud";
import { ChoiceWindow, MessageWindow, type PortraitSpec } from "../message";
import { dueArrival, playArrival } from "./arrivals";
import { buildCafe } from "./cafe";
import { buildFacility } from "./facilities";
import { buildHall } from "./hallEvents";
import { MoneyPops } from "./moneyPop";
import { Overhear } from "./overhear";
import { buildRoom } from "./rooms";
import { drawChalk, setChalkTown } from "./sceneChalk";
import { drawMarksAbove, drawMarksBelow, setMarksTown } from "./sceneMarks";
import { drawShrooms, SHROOM_LEFT, setShroomTown } from "./sceneShrooms";
import {
	BLACKOUT_TINT,
	blackoutShown,
	outsideNow,
	sceneLit,
	sceneMinute,
	sceneSky,
	setSceneSky,
	setTownSky,
	skitSky,
	skyBand,
	skyPinned,
	townSkyNow,
} from "./sceneSky";
import { nearSkit, playNearSkit, skitAfterEvent } from "./skits";
import { Crowd } from "./villageCrowd";
import {
	buildSurface,
	buildVillage,
	departAnywhere,
	villageMenu,
	villageSceneView,
} from "./villageEvents";
import { openingBlackout, openingHoldsGuide } from "./villageOpening";
import { villageView } from "./villageReturn";
import { drawZanki, setZankiTown } from "./zankiTag";

/**
 * 節目の 音（台本の s.se）を 鳴らしたら、次の 文まで おく 間（ms）。victory は 完走・勝ち、
 * townUp は 町が 育つ、join は 仲間が 加わる、keyItem は 家の 鍵、chapter は 鐘（板が 開く・999）。ほかの 音は 待たない。
 */
const BEAT_SE_MS: Record<string, number> = {
	victory: 600,
	townUp: 450,
	join: 450,
	keyItem: 450,
	chapter: 350,
};
/** 1マス歩く ms（rpg は 170。2026-10-13 作者「気持ちよい タイミングに」で 少し 速く）。うろうろする人は この 1.6倍。 */
const WALK_MS = 150;
/** うろうろ 歩く 人を 押しのける：2回 続けて 押す 間（ms）と、押しつづける 長さ（ms）。 */
const SWAP_DOUBLE_MS = 400;
const SWAP_HOLD_MS = 450;
/** ダッシュで 歩く 速さ（WALK_MS の 何倍か）。 */
const DASH_SPEED = 2.5;
/**
 * タップした 道が これより 長ければ 走る（着く 2歩 手前で 歩きに もどる）。
 * 押しっぱなしでは ひとりでに 走りださない（作者「キモい」）。走るのは ダッシュを 押しながら。
 */
const RUN_PATH = 8;
/** 1文字あたりの ms（rpg の 既定は 28。2026-10-13 に 少し 速く）。 */
const TEXT_MS = 24;
/** 場面で 人を とばす とき、画面の はしから これだけ（マス）外までは 映る ことに する（歩く 絵は マスより 大きい）。 */
const SEEN_MARGIN = 2;
/** カメラが ついていく 人を 道の 先へ とばす 暗転の ms（片道）。 */
const CUT_FADE_MS = 200;
/** 画面の はしから これだけ（マス）外の 人・物まで 描く（大きな 絵・頭の 上の 記号が 画面に はみ出す ぶん）。 */
const DRAW_MARGIN = 6;
/** 停電の 屋内の 暗さ（multiply。キリコから 離れた ところの 色）。 */
const INDOOR_BLACKOUT = "rgb(46, 48, 78)";
/** 道の ない すきまを 弧を えがいて とびこえるのは これだけ（マス）まで（台・キリコの 1マス ごし）。 */
const HOP_JUMP = 2;
/** とびこえる のに かける ms（これより 短くは しない。歩く 速さで 1マス ぶんずつ）。 */
const JUMP_MS = 320;

/** 出口への 道を 何歩 先まで たどって 矢印の 向きに するか（曲がり角の 手前で 斜めに なる）。 */
const GUIDE_AHEAD = 5;
/** 出口を さす 矢印の ドット絵（上向き・11×11。# ふち、o 地、h 光）。 */
const GUIDE_ARROW_UP = [
	".....#.....",
	"....#h#....",
	"...#hoo#...",
	"..#hoooo#..",
	".#hoooooo#.",
	"#hoooooooo#",
	"####hoo####",
	"...#hoo#...",
	"...#hoo#...",
	"...#hoo#...",
	"...#####...",
] as const;
/** 右上向き（GUIDE_ARROW_UP と 同じ 大きさ・同じ 書き方）。 */
const GUIDE_ARROW_UR = [
	"...........",
	"....######.",
	"...#hooooo#",
	"....#hoooo#",
	".....#hooo#",
	"....#hoooo#",
	"...#hoo#ho#",
	"..#hoo#.#h#",
	".#hoo#...#.",
	".#ho#......",
	"..##.......",
] as const;
const GUIDE_COLORS: Record<string, string | undefined> = {
	"#": "#3a2600",
	o: "#ffd75e",
	h: "#fff3b8",
};

/** 冒険から どう もどってきたか（村での 立ち位置と、入ったときの 場面を 決める）。 */
export type Arrival =
	| {
			kind: "clear" | "escape" | "dead";
			dungeon: DungeonId;
			/** 目的（ボスを たおして 帰ったなら boss。無ければ 持ち帰り）。 */
			objective?: Objective;
	  }
	| { kind: "suspend" }
	| { kind: "replay" }
	| null;

type Spot = { x: number; y: number; dir: Dir };
/** 地図（村・本館・建物の 中・施設の 中 `f_<id>`）。 */
type MapId = "village" | "hall" | RoomId | `f_${string}` | `s_${string}`;

/**
 * 街灯の 光（ドット。内から 3段、いちばん 外は 市松の ディザ。ぼかさない：作者「光表現は ファジーでは なく ドットに」）。
 * 段は 足し算で かさなるので、内側ほど 明るい。
 */
const LAMP_RINGS = [
	{ r: 6, a: 0.32, dither: false },
	{ r: 13, a: 0.2, dither: false },
	{ r: 21, a: 0.16, dither: true },
] as const;
const LAMP_R = 21;

export class Village {
	private readonly ctx: Ctx;
	private readonly screen: Screen;
	private readonly hud: Hud;
	private readonly msg: MessageWindow;
	private readonly choice: ChoiceWindow;
	private readonly fadeEl: HTMLDivElement;
	private readonly toastEl: HTMLDivElement;
	private field: Field | null = null;
	/** 街の 人通り（村の 地図だけ。ui/village/villageCrowd.ts）。 */
	private crowd: Crowd | null = null;
	/** いま 描いている 地図。村に 入る たびに village から（リプレイから もどった ときは 見る 前の 地図）。 */
	private mapId: MapId = "village";
	private player = new Actor("player", 0, 0, "down", KIRIKO_WALK, null);
	/** キリコの位置と その場かぎりの印（村を 出ても 残す。ページを 閉じれば 消える）。 */
	private state: VState = { x: 0, y: 0, dir: "down", flags: {} };
	private scriptDepth = 0;
	/** 操作で歩き始めた1歩が まだ着いていない（着いたら 踏むイベントを 調べる）。 */
	private stepPending = false;
	private path: Dir[] = [];
	private pathTalk: Actor | null = null;
	/** タップで 話しに 行って、着いたら 相手が ずれていたので もう 1度 近づいた（2度目は あきらめて その場で 話す）。 */
	private talkRetried = false;
	/**
	 * うろうろ 歩く 人（ぷゆゆ・フェリス など）に つっかえた とき（押しのけるのは 2回 続けて 押すか 長押し。
	 * 1回 押しただけでは 向かい合う：向き合って 話したい ときも あるので。作者の 指示）。
	 */
	private bump: {
		who: Actor;
		dir: Dir;
		/** 押しつづけ はじめた 時刻。 */
		since: number;
		/** 最後に 押した 時刻。 */
		last: number;
	} | null = null;
	/** タップした 道が 長い（走る）。 */
	private pathRun = false;
	/** タップした 物が onBumpThing の 物（着いたら 話さずに そちらを 起こす）。 */
	private pathBump = false;
	/** 十字キーで つっかえて いる マス（押しっぱなしで ぶつかり つづけても onBumpThing は 1回だけ）。 */
	private blockedAt: string | null = null;
	private marker: { x: number; y: number; t: number } | null = null;
	/** まだ 1度も もぐっていない（村の 出口に 矢印を 出す。はじめての 人が 出口を さがさないように）。 */
	private guideExit = false;
	/** 停電の あいだの 町の 屋内（本館・小屋など。電気が 来ないので 暗く、キリコの 手もとだけ 見える）。 */
	private indoorDark = false;
	private time = 0;
	private last = 0;
	/** お金の 出入りの 金額（ui/village/moneyPop.ts）。 */
	private moneyPops = new MoneyPops();
	/** 立ち聞きの 吹き出し（ui/village/overhear.ts）。 */
	private overhear = new Overhear({
		actors: () => this.field?.actors ?? [],
		player: () => this.player,
		walkers: () => this.crowd?.walkers() ?? [],
		paused: () => !this.idle,
	});
	/** 描くときの カメラ（画面の 画素に 丸めた）。 */
	private camX = 0;
	private camY = 0;
	/** 丸める前の カメラ（なめらかに 動かすとき）。 */
	private camFX = 0;
	private camFY = 0;
	/** カメラが 見る先（人の ID か マス。null なら キリコ）。 */
	private lookAt: string | readonly [number, number] | null = null;
	/**
	 * カメラを 見る先へ 動かしている 途中（出だしの 位置・たった 時間・かかる 時間）。null なら 見る先に ぴったり つく。
	 * 遠くても 近くても 同じ 速さで 寄せると、遠い 所へは 一瞬で 飛んで どこを 見たのか わからないので、
	 * 長さは 道のりで きめ、出だしと 着く ところを ゆるめる。
	 */
	private pan: { x: number; y: number; t: number; ms: number } | null = null;
	/** 入ったときの 場面の 最中（歩かない・うろうろ しない）。 */
	private scene = false;
	/** 帰りの 寸劇の 最中（通行人を 出さない。寸劇の おわりの 建て直しで 町に 置く）。 */
	private skit = false;
	private running = false;
	private rafId = 0;
	private arrival: Arrival = null;
	/** 村を出ると 決まった（いちばん外の スクリプトが 終わったら 出る）。 */
	private exitChoice: VillageExit | null = null;
	private leaving = false;
	private resolveStart: ((c: VillageExit) => void) | null = null;
	/** 最後に いた 地図と マス（リプレイを 見て もどったとき。本館の 映写機の 前）。 */
	private lastSpot: (Spot & { map: MapId }) | null = null;

	constructor(ctx: Ctx, screen: Screen, hud: Hud) {
		this.ctx = ctx;
		this.screen = screen;
		this.hud = hud;
		// 文送りと 選択肢の決定は、鳴らしたばかりの 効果音の 区切りまで 待つ（audio.ts）
		this.msg = new MessageWindow(
			ctx.ui,
			ctx.input,
			() => TEXT_MS,
			() => ctx.audio.seSettled(),
		);
		// 感情の 記号の 添え音（間引きは audio.ts の emoteSe）
		this.msg.onEmote = (e) => ctx.audio.emoteSe(e);
		this.choice = new ChoiceWindow(ctx.ui, ctx.input, () => ctx.audio.seHeld);
		this.fadeEl = el("div", { class: "fade" });
		this.toastEl = el("div", { class: "toast" });
		ctx.ui.append(this.fadeEl, this.toastEl);
	}

	// ───────────────── 入る・出る ─────────────────

	/**
	 * 村に入る。boot なら 起動の札（村へ／冒険に　もどる）を 重ねる。
	 * 村を出ると（もぐる・冒険に　もどる・リプレイ）その行き先で 解決する。
	 */
	start(o: { boot: boolean; arrival: Arrival }): Promise<VillageExit> {
		return new Promise((resolve) => {
			this.resolveStart = resolve;
			void this.open(o);
		});
	}

	private async open(o: { boot: boolean; arrival: Arrival }): Promise<void> {
		this.exitChoice = null;
		this.leaving = false;
		this.scriptDepth = 0;
		this.arrival = o.arrival;
		// ダンジョンから 帰ったら 村の 時計を すすめる（data/town/calendar.ts）
		const k = o.arrival?.kind;
		if (k === "clear" || k === "escape" || k === "dead")
			advanceClock(RETURN_HOURS * 60);
		// 持ち帰りの 寸劇は 朝（村の 時計に かかわらず。場面の おわりに 時計へ：ui/village/villageReturn.ts の returnScene）
		if (k === "clear" || k === "escape") setSceneSky(skitSky());
		this.skit = k === "clear" || k === "escape";
		// 起動の札の うしろでは 村が 動いている（うろうろ する。場面は 札を 閉じてから）
		this.scene = !o.boot;
		this.lookAt = null;
		this.pan = null;
		this.fadeEl.style.transition = "none";
		this.fadeEl.style.opacity = "1";
		// リプレイを 見おえたら、見る 前に いた 地図の 同じ マスへ（本館の 中なら 中のまま）
		const back = o.arrival?.kind === "replay" ? this.lastSpot : null;
		this.mapId = back?.map ?? "village";
		this.guideExit = loadProgress().intro.length === 0;
		await this.build(back ?? this.spotFor(o.arrival));
		// 幕が 上がる前に 並べる（帰ってきた場面：口の前で 待つ 仲間）
		this.field?.def.prepare?.(this.story);
		const input = this.ctx.input;
		input.onFieldTap = (x, y) => this.onTap(x, y);
		// 前の画面で 押したキー・向きは 捨てる
		input.clearField();
		input.takeDirPress();
		this.running = true;
		this.last = performance.now();
		cancelAnimationFrame(this.rafId);
		this.rafId = requestAnimationFrame((t) => this.frame(t));
		if (o.boot) {
			// 起動の札の うしろで 村が 動いている。札を 閉じるまで ボタンは 出さない
			this.hud.root.classList.add("hidden");
			void this.fadeIn(600);
			const c = await showBootTitle(this.ctx, (c) =>
				c.kind === "start" && openingBlackout() ? this.fadeOut(500) : null,
			);
			this.scene = true;
			if (c.kind === "continue") {
				await this.leave({ kind: "continue", state: c.state });
				return;
			}
			this.hud.root.classList.remove("hidden");
		} else {
			this.hud.root.classList.remove("hidden");
			await this.fadeIn(400);
		}
		const def = this.field?.def;
		// 持ち帰ったときは 終わりの札の 曲（ending）のまま。語りの あとで 村の曲へ（ui/village/villageReturn.ts）
		if (def?.bgm !== undefined && o.arrival?.kind !== "clear")
			this.ctx.audio.bgm(def.bgm);
		if (def) this.toast(def.name);
		this.runEnter();
	}

	/** 村に入ったときの 立ち位置。 */
	private spotFor(a: Arrival): Spot {
		const [bx, by] = VILLAGE_SPOTS.boot;
		// 起きたとき・倒れて もどったときは 蓄音機の前（トルネコが 家で 目をさますように）
		const boot: Spot = { x: bx, y: by, dir: "up" };
		if (!a) return boot;
		// 植民地の 方角の 出口から 入ってくる（onEnter で 1歩 村へ）
		if (a.kind === "clear" || a.kind === "escape") {
			const e = exitFor(a.dungeon);
			return { x: e.cell[0], y: e.cell[1], dir: e.inward };
		}
		return boot;
	}

	/** いまの 地図（mapId）を 組み立てて キリコを 置く（画像も 先に読む。読めなくても 進む）。 */
	private async build(spot: Spot): Promise<void> {
		const v = villageView();
		const def =
			this.mapId === "hall"
				? buildHall(v, this.ctx)
				: this.mapId === "cafe"
					? buildCafe(v, this.ctx)
					: isRoom(this.mapId)
						? buildRoom(this.mapId, v, this.ctx)
						: facilityOfMap(this.mapId)
							? buildFacility(
									facilityOfMap(this.mapId) as Facility,
									v,
									this.ctx,
									departAnywhere(this.ctx),
								)
							: surfaceOfMap(this.mapId)
								? buildSurface(surfaceOfMap(this.mapId) as Surface, this.ctx)
								: buildVillage(v, this.ctx, { arrival: this.arrival });
		// 停電の あいだは 町じゅう 明かりの ない 夜（ui/village/sceneSky.ts）
		setTownSky(this.mapId === "village" ? townSkyNow() : null);
		this.indoorDark =
			this.mapId !== "village" && !surfaceOfMap(this.mapId) && blackoutShown();
		this.field?.dispose();
		const field = new Field(def);
		this.field = field;
		setZankiTown(v.cleared);
		setShroomTown(
			this.mapId === "village" ? v : null,
			(x, y) => field.canEnter(x, y),
			this.state.flags[SHROOM_LEFT],
		);
		// 広場の チョークの 国境線（パン板の 広場が 生き返ってから。ui/village/sceneChalk.ts）
		setChalkTown(
			this.mapId === "village" ? villageSceneView(v, this.arrival) : null,
		);
		// 生き返った 通りに 残る 物（銭湯の 湯けむり・鉄板の 焦げ・島の 跡。ui/village/sceneMarks.ts）
		const marked =
			this.mapId === "village" ? villageSceneView(v, this.arrival) : null;
		const seaRows = marked ? villageRows(marked) : [];
		setMarksTown(marked, (x, y) => seaRows[y]?.[x] === "う");
		// 板の 地上（入口まで 歩く 所）では 選んだ 探索者の 絵。村の 中は いつも キリコ
		this.player = new Actor(
			"player",
			spot.x,
			spot.y,
			spot.dir,
			surfaceOfMap(this.mapId) ? heroWalk({ hero: chosenHero() }) : KIRIKO_WALK,
			null,
		);
		this.player.through = false;
		this.syncState();
		this.crowd = null;
		this.refreshActors();
		this.crowd = def.crowd ? this.makeCrowd(field, def.crowd) : null;
		this.overhear.reset();
		this.stepPending = false;
		this.path = [];
		this.pathTalk = null;
		this.marker = null;
		const refs = [
			...field.imageRefs(),
			...field.actors.map((a) => a.sprite),
			...(this.crowd ? Crowd.sprites() : []),
			this.player.sprite,
			// 頭の きのこ・服の パンくず・髪の ソース（Story.wear）
			...(["kinoko", "crumbs", "sauce"] as const).map(equipSheet),
		];
		await Promise.race([preloadImages(refs.filter(Boolean)), sleep(2500)]);
		this.updateCamera();
	}

	/** 町の段・開いたダンジョンを 読み直して 建て直す（キリコは 同じマスのまま）。暗転の中で呼ぶ。 */
	async rebuild(): Promise<void> {
		this.skit = false;
		await this.build({
			x: this.player.x,
			y: this.player.y,
			dir: this.player.dir,
		});
	}

	/**
	 * べつの 地図へ 移る（村 ⇔ 本館の 中）。暗転の 中で 呼ぶ。入る ときの 場面（prepare・onEnter）は
	 * 走らせない（村の onEnter は 帰ってきた 場面。本館から もどる たびに 場面を くり返さない）。
	 * 曲は 地図に 決まって いれば かえる（同じ 曲なら 続ける）。地名の 札を 出す。
	 */
	private async warp(map: string, spot: Spot): Promise<void> {
		this.mapId =
			map === "hall" || isRoom(map)
				? map
				: facilityOfMap(map)
					? (map as `f_${string}`)
					: surfaceOfMap(map)
						? (map as `s_${string}`)
						: "village";
		// 前の 地図の 人・マスを 見ていた カメラは キリコに もどす
		this.lookAt = null;
		this.pan = null;
		await this.build(spot);
		const def = this.field?.def;
		if (def?.bgm !== undefined) this.ctx.audio.bgm(def.bgm);
		if (def) this.toast(def.name);
	}

	/** 暗転して 村を出る。 */
	private async leave(c: VillageExit): Promise<void> {
		if (this.leaving) return;
		this.leaving = true;
		this.exitChoice = null;
		void this.ctx.audio.fadeBgm(400);
		await this.fadeOut(400);
		this.stop();
		const resolve = this.resolveStart;
		this.resolveStart = null;
		resolve?.(c);
	}

	private stop(): void {
		this.running = false;
		cancelAnimationFrame(this.rafId);
		this.ctx.input.onFieldTap = null;
		this.msg.close();
		// 読み上げは 村の 会話だけ（ダンジョンへ 持ちこまない）
		this.ctx.audio.stopSpeech();
		this.toastEl.classList.remove("shown");
		this.lastSpot = {
			map: this.mapId,
			x: this.player.x,
			y: this.player.y,
			dir: this.player.dir,
		};
		this.field?.dispose();
		this.field = null;
		this.crowd = null;
		// 冒険の画面に 村が 一瞬 見えないよう、黒く ぬってから 幕を あげる（冒険は 自分の 幕を 持っている）
		const g = this.screen.begin();
		g.fillStyle = "#000";
		g.fillRect(0, 0, this.screen.width, this.screen.height);
		this.fadeEl.style.transition = "none";
		this.fadeEl.style.opacity = "0";
	}

	// ───────────────── イベント ─────────────────

	/** 印の 名前（地図ごと。本館の 中で 同じ id を 使っても ぶつからない）。 */
	private flagKey(kind: "done" | "hide", id: string, map = this.mapId): string {
		return `${kind}:${map}:${id}`;
	}

	private eventActive(e: EventDef): boolean {
		const f = this.state.flags;
		if (e.once && f[this.flagKey("done", e.id)]) return false;
		if (f[this.flagKey("hide", e.id)]) return false;
		if (e.when && !e.when(this.state)) return false;
		return true;
	}

	/** イベントの出現状態を 反映する（スクリプトの あとなどに 呼ぶ）。 */
	private refreshActors(): void {
		const field = this.field;
		if (!field) return;
		const keep: Actor[] = [];
		for (const e of field.def.events ?? []) {
			if (!this.eventActive(e)) continue;
			keep.push(
				field.actors.find((a) => a.def === e) ??
					new Actor(e.id, e.x, e.y, e.dir ?? "down", e.sprite ?? "", e),
			);
		}
		// 街の 通行人は 地図の イベントでは ないので そのまま 残す
		const crowd = this.crowd;
		if (crowd) keep.push(...field.actors.filter((a) => crowd.owns(a)));
		field.actors = keep;
	}

	/** 街の 人通り（data/village/crowd.ts の 流れで 人を 歩かせる。ui/village/villageCrowd.ts）。 */
	private makeCrowd(
		field: Field,
		plan: NonNullable<Field["def"]["crowd"]>,
	): Crowd {
		return new Crowd({
			field,
			nodes: plan.nodes,
			cost: plan.cost,
			stage: plan.stage,
			player: this.player,
			clock: () => {
				const w = today().w;
				return { hour: nowHour(), weekend: w === 0 || w === 6 };
			},
			// 窓が 開いている あいだ（会話・選択肢）と、帰りの 寸劇・知らせの 場面の あいだは 歩きださない
			// （場面の 人の 走り・カメラの 間に 通行人が 横切らない。出てくる 人も 止める）
			paused: () => this.ctx.input.busy || this.leaving || this.scene,
			hidden: () => this.skit,
			target: () => this.pathTalk,
			talk: (persona, line) => async (s) => {
				await s.say("nanj", line, { name: persona.label });
			},
		});
	}

	private syncState(): void {
		this.state.x = this.player.x;
		this.state.y = this.player.y;
		this.state.dir = this.player.dir;
	}

	// ───────────────── メインループ ─────────────────

	private frame(t: number): void {
		if (!this.running) return;
		const dt = Math.min(50, t - this.last);
		this.last = t;
		this.time += dt;
		this.update(dt);
		this.render();
		this.tickClock(dt);
		this.rafId = requestAnimationFrame((tt) => this.frame(tt));
	}

	/** ベッドに 寝ころぶ 前に いた マス（Story の lie）。 */
	private lieFrom: { x: number; y: number; dir: Dir } | null = null;

	/** 村の 時計の 文（かわった ときだけ 書く。data/village/daylight.ts）。 */
	private clockText = "";
	/** 村の 時計の 端数（ms。現実の 1秒で 1分 すすむ。data/town/calendar.ts）。 */
	private clockMs = 0;
	private tickClock(dt: number): void {
		// 場面の 空の あいだは 時計を 止める（解けたら その 時刻から すすむ。ui/village/sceneSky.ts）
		if (skyPinned()) this.clockMs = 0;
		else this.clockMs += dt;
		if (this.clockMs >= 1000) {
			advanceClock(Math.floor(this.clockMs / 1000));
			this.clockMs %= 1000;
		}
		const h = nowHour();
		// 場面の 空の あいだは 時刻を 出さず「夜」「朝」だけ（ui/village/sceneSky.ts。色と 食いちがわない ように）
		const sky = sceneSky();
		const text = sky
			? BAND_NAME[skyBand(sky)]
			: clockLine(h, nowMinute(), timeBand(h));
		this.tickMoney(dt);
		if (text === this.clockText) return;
		this.clockText = text;
		this.hud.clock.textContent = text;
	}

	/** 時計の 下の 財布の 文（カジノの 中は チップも。かわった ときだけ 書く。0.2秒ごとに 見る）。 */
	private moneyText = "";
	private moneyMs = Number.POSITIVE_INFINITY;
	private tickMoney(dt: number): void {
		this.moneyMs += dt;
		if (this.moneyMs < 200) return;
		this.moneyMs = 0;
		const chips =
			facilityOfMap(this.mapId)?.id === "casino"
				? `　チップ ${chipsOwned().toLocaleString("ja-JP")}枚`
				: "";
		const text = `財布 ${yen(walletYen())}${chips}`;
		if (text === this.moneyText) return;
		this.moneyText = text;
		this.hud.money.textContent = text;
	}

	private get idle(): boolean {
		return (
			this.scriptDepth === 0 &&
			!this.scene &&
			!this.ctx.input.busy &&
			!this.leaving
		);
	}

	private update(dt: number): void {
		const field = this.field;
		if (!field) return;
		const wasMoving = this.player.moving;
		this.player.update(dt);
		// 操作で歩いて1マス着いたら、次の1歩を 始める前に ここで 踏むイベントを 調べる
		// （歩きの Promise の続きは 次のマイクロタスクなので、押しっぱなしだと 先に 次のマスへ 進んでしまう）
		if (wasMoving && !this.player.moving && this.stepPending) {
			this.stepPending = false;
			this.syncState();
			if (this.scriptDepth === 0) this.afterStep();
		}
		for (const a of field.actors) {
			a.update(dt);
			// 自分で する ことを 決める 人（キリコの 家に 招いた 人）
			if (a.def?.roam) {
				if (this.scriptDepth === 0 && !this.scene && a !== this.pathTalk) {
					if (!a.moving) this.roamTick(a, dt);
				} else if (this.roams.has(a)) {
					// 話しかけられたら 過ごし方の 記号と 動きを 消して、話の あとで する ことを 決めなおす
					// （会話の 1行の 記号は 消さない）
					if (a.emoteLoop) a.showEmote(null);
					if (a.gestureLoop) a.showGesture(null);
					this.roams.delete(a);
				}
				continue;
			}
			// 話しかけに 向かっている 相手は 待っている
			if (
				a.def?.wander &&
				!a.moving &&
				this.scriptDepth === 0 &&
				!this.scene &&
				a !== this.pathTalk
			) {
				a.wanderWait -= dt;
				if (a.wanderWait <= 0) {
					a.wanderWait = 1200 + Math.random() * 2500;
					const dirs: Dir[] = ["up", "right", "down", "left"];
					const d = dirs[Math.floor(Math.random() * 4)];
					const nx = a.x + DIR_VEC[d].dx;
					const ny = a.y + DIR_VEC[d].dy;
					// 元の位置から 2マスより 離れない（場面で 遠くへ 来た 人は 近づく 向きに だけ 歩き、
					// うろうろ しながら もどる。お弁当の ぷゆゆが 扉の 前に 立ちっぱなしに ならない）。
					// キリコの 行き先にも 入らない
					const home = a.def;
					const far = (x: number, y: number) =>
						Math.max(Math.abs(x - home.x), Math.abs(y - home.y));
					if (
						(far(nx, ny) <= 2 || far(nx, ny) < far(a.x, a.y)) &&
						field.canEnter(nx, ny, a) &&
						!(nx === this.player.x && ny === this.player.y) &&
						!this.onPath(nx, ny)
					) {
						void a.walk(d, WALK_MS * 1.6);
					} else {
						a.dir = d;
					}
				}
			}
		}
		this.crowd?.update(dt);
		this.overhear.update(dt);
		if (this.idle && !this.player.moving) this.control();
		this.updateCamera(dt);
	}

	/** roam で いま して いる こと（人ごと。歩く 残りの 道・着いたか・残りの 時間・次に 向きを かえるまで）。 */
	private roams = new WeakMap<
		Actor,
		{
			step: RoamStep;
			path: Dir[];
			arrived: boolean;
			wait: number;
			turn: number;
		}
	>();

	/** roam の 1コマ：道を 1歩ずつ 歩き、着いたら 向いて 記号を 出し、時間が たったら 次を 決める。 */
	private roamTick(a: Actor, dt: number): void {
		const field = this.field;
		const roam = a.def?.roam;
		if (!field || !roam) return;
		let r = this.roams.get(a);
		if (!r) {
			const step = roam({ x: a.x, y: a.y });
			const to = step.to;
			const path =
				to && (to[0] !== a.x || to[1] !== a.y)
					? (field.findPath(a.x, a.y, to[0], to[1], a, false, undefined, 400) ??
						[])
					: [];
			r = { step, path, arrived: false, wait: step.wait, turn: 600 };
			this.roams.set(a, r);
			a.showEmote(null);
			a.showGesture(null);
		}
		const d = r.path[0];
		if (d) {
			const nx = a.x + DIR_VEC[d].dx;
			const ny = a.y + DIR_VEC[d].dy;
			// キリコや 人が 道に 立ったら そこで 止まる（着いた ことに する）
			if (
				field.canEnter(nx, ny, a) &&
				!(nx === this.player.x && ny === this.player.y) &&
				!this.onPath(nx, ny)
			) {
				r.path.shift();
				void a.walk(d, WALK_MS * (r.step.walk ?? 1.6));
				return;
			}
			r.path = [];
		}
		if (!r.arrived) {
			r.arrived = true;
			if (r.step.face) a.dir = r.step.face;
			a.showEmote(r.step.emote ?? null, true);
			if (r.step.gesture) a.showGesture(r.step.gesture, true);
		}
		r.wait -= dt;
		if (r.step.look) {
			r.turn -= dt;
			if (r.turn <= 0) {
				r.turn = 700 + Math.random() * 900;
				const dirs: Dir[] = ["up", "right", "down", "left"];
				a.dir = dirs[Math.floor(Math.random() * 4)];
			}
		}
		if (r.wait <= 0) {
			a.showEmote(null);
			a.showGesture(null);
			this.roams.delete(a);
		}
	}

	/** タップで決めた 道の上か（うろうろする人が 道を ふさがないように）。 */
	private onPath(x: number, y: number): boolean {
		let px = this.player.x;
		let py = this.player.y;
		for (const d of this.path) {
			px += DIR_VEC[d].dx;
			py += DIR_VEC[d].dy;
			if (px === x && py === y) return true;
		}
		return false;
	}

	private control(): void {
		const field = this.field;
		if (!field) return;
		const input = this.ctx.input;
		const key = input.takeField();
		if (key === "b" || key === "menu") {
			this.clearPath();
			void this.runScript((s) => villageMenu(this.ctx, s));
			return;
		}
		if (key === "a") {
			this.clearPath();
			this.talkFront();
			return;
		}
		// ほかのキー（足元・地図・矢…）は 村では 使わない
		const held = input.heldDir();
		// キーボードの 斜め（2つ同時押し）を 少しだけ 待つ
		if (input.heldFor() < 45 && (held !== null || input.pendingDirPress))
			return;
		// 押しっぱなしでなくても、短く押した向きには 1歩 進む
		const pressed = input.takeDirPress();
		const dir = held ?? pressed;
		if (dir !== null) {
			this.clearPath();
			this.stepToward(dir, pressed !== null);
			return;
		}
		// 画面を 押さえつづけたら、指の方へ 歩きつづける
		const hold = input.fieldHold();
		if (hold) {
			this.clearPath();
			const d = input.fieldHoldDir((x, y) => this.dirFromScreen(x, y));
			if (d !== null) this.stepToward(d, false);
			return;
		}
		this.blockedAt = null;
		if (this.path.length) {
			const d = this.path.shift() as Dir;
			const v = DIR_VEC[d];
			if (
				!field.canEnter(this.player.x + v.dx, this.player.y + v.dy, this.player)
			) {
				// うろうろ 歩いている 人なら 入れかわって 道の まま 進む
				if (this.swapPast(d)) return;
				// 人が 前に 来た：その場で 道を 引き直す（だめなら あきらめる）
				const goal = this.marker;
				const talk = this.pathTalk;
				const bump = this.pathBump;
				this.clearPath();
				this.player.dir = d;
				if (goal) this.walkTo(goal.x, goal.y, talk);
				this.pathBump = bump && !!this.pathTalk;
				return;
			}
			// 話しかけるのは 最後の 1歩が 着いてから（下）。途中で 口などを 踏んだら afterStep が 道を 消す
			// 長い 道は 走る（着く 2歩 手前で 歩きに もどる）
			void this.tryStep(d, this.pathRun && this.path.length >= 2);
			return;
		}
		if (this.pathTalk) {
			const target = this.pathTalk;
			this.pathTalk = null;
			this.marker = null;
			// タップした ときに 1歩 歩いていた 人は、着いたら となりに いない ことが ある：1度だけ 近づきなおす
			// （となりで 止まって 何も 言わず、「タップで 話せる」と 習ったのに 話せなかった）
			const dx = target.x - this.player.x;
			const dy = target.y - this.player.y;
			const dist = Math.abs(dx) + Math.abs(dy);
			// カウンターの 向こうの 人とは 2マス 離れて 話す
			const acrossCounter =
				dist === 2 &&
				(dx === 0 || dy === 0) &&
				!!this.field?.tileAt(
					this.player.x + Math.sign(dx),
					this.player.y + Math.sign(dy),
				).counter;
			if (dist !== 1 && !acrossCounter && !this.talkRetried) {
				this.talkRetried = true;
				this.walkTo(target.x, target.y, target);
				return;
			}
			this.faceTo(this.player, target.x, target.y);
			const bump = this.pathBump;
			this.pathBump = false;
			if (!bump || !this.bumpFront()) this.talkFront();
		}
	}

	/** 目の前の onBumpThing の 物を 起こす（あれば true）。 */
	private bumpFront(): boolean {
		const field = this.field;
		if (!field || this.scriptDepth > 0 || this.leaving) return false;
		const v = DIR_VEC[this.player.dir];
		const run = field.def.onBumpThing?.(
			this.player.x + v.dx,
			this.player.y + v.dy,
		);
		if (!run) return false;
		void this.runScript(run);
		return true;
	}

	private clearPath(): void {
		this.path = [];
		this.pathBump = false;
		this.pathTalk = null;
		this.marker = null;
	}

	/**
	 * 8方向の入力で 1歩（4方向。斜めは 縦 → 横の順に 試す。どちらも だめなら 向くだけ）。
	 * press は この コマで 新しく 押した（押しっぱなしの 続きでは ない）。
	 */
	private stepToward(d8: Dir8, press: boolean): void {
		const field = this.field;
		if (!field) return;
		const tries = dir4Candidates(d8);
		for (const d of tries) {
			const v = DIR_VEC[d];
			if (
				field.canEnter(this.player.x + v.dx, this.player.y + v.dy, this.player)
			) {
				this.bump = null;
				this.blockedAt = null;
				void this.tryStep(d);
				return;
			}
		}
		// うろうろ 歩いている 人（お弁当の ぷゆゆ・フェリス など）が ふさいで いれば、2回 続けて 押すか
		// 長押しで 入れかわって 通る。1回 押した だけなら 向かい合う（そのまま A で 話せる）
		const first = tries[0];
		if (first && this.bumpInto(first, press)) return;
		// つっかえたら 向くだけ（横へ ずれて 回りこまない。物の 前で そちらを 向いて 調べたい）
		// 持ち場に 立つ 人に ぶつかっても その 人は よけない（作者「逃げるのは やめて」）
		this.player.dir = tries[0];
		// ぶつかると 起きる 物（キリコの 家の ベッド）：つっかえ はじめた ときに 1回
		const v = DIR_VEC[tries[0]];
		const at = `${this.player.x + v.dx},${this.player.y + v.dy}`;
		if (this.blockedAt === at) return;
		this.blockedAt = at;
		this.bumpFront();
	}

	/**
	 * 十字キー・長押しで うろうろ 歩く 人に つっかえた。押しのけて 入れかわったら true
	 * （2回目の 押しが SWAP_DOUBLE_MS 以内か、押しつづけて SWAP_HOLD_MS たった とき）。
	 */
	private bumpInto(d: Dir, press: boolean): boolean {
		const field = this.field;
		if (!field) return false;
		const v = DIR_VEC[d];
		const a = field.blockerAt(
			this.player.x + v.dx,
			this.player.y + v.dy,
			this.player,
		);
		if (!a?.def?.wander) {
			this.bump = null;
			return false;
		}
		const now = performance.now();
		const b = this.bump;
		if (!b || b.who !== a || b.dir !== d) {
			this.bump = { who: a, dir: d, since: now, last: press ? now : -1e9 };
			return false;
		}
		if (press) {
			const double = now - b.last < SWAP_DOUBLE_MS;
			b.last = now;
			// はなして から 押しなおした（2回目では ない）：長押しの 数えも はじめから
			if (!double) {
				b.since = now;
				return false;
			}
		} else if (now - b.since < SWAP_HOLD_MS) return false;
		if (!this.swapPast(d)) return false;
		this.bump = null;
		return true;
	}

	/**
	 * d の 先に うろうろ 歩いている 人（def.wander。お弁当を 持ってきた ぷゆゆ など）が 立っていて
	 * 道を ふさいで いれば、押しのけて 入れかわる（その 人は キリコの いた マスへ）。入れかわったら true。
	 * 持ち場に 立つ 人・場面の 途中・歩いている 途中の 人は 入れかわらない。
	 */
	private swapPast(d: Dir): boolean {
		const field = this.field;
		if (!field || this.scriptDepth > 0 || this.scene) return false;
		const v = DIR_VEC[d];
		const tx = this.player.x + v.dx;
		const ty = this.player.y + v.dy;
		if (!field.tileAt(tx, ty).passable) return false;
		const a = field.blockerAt(tx, ty, this.player);
		if (!a?.def?.wander || a.moving || a.x !== tx || a.y !== ty) return false;
		// 入れかわった あと しばらくは その場で 待つ（すぐ また 前に 出てこないように）
		a.wanderWait = 2500 + Math.random() * 1500;
		void a.walk(OPPOSITE[d], WALK_MS);
		this.player.dir = d;
		this.stepPending = true;
		void this.player.walk(d, WALK_MS);
		return true;
	}

	/**
	 * 場面で 人が 道に して よい マス。地形だけを 見て、ほかの人は すりぬける（場面の 人どうしが
	 * ふさぎあわないように）。avoid なら ほかの人・置物も よける。キリコの マスは よける。
	 */
	private openFor(a: Actor, avoid: boolean): Open {
		const field = this.field;
		const me = this.player;
		return (x, y) =>
			!!field &&
			field.tileAt(x, y).passable &&
			(!avoid || field.canEnter(x, y, a)) &&
			(a === me || x !== me.x || y !== me.y);
	}

	/** 場面で 人を 歩かせる 道（幅優先。openFor の マスだけ。engine/longWalk.ts の findRoute）。 */
	private routeTo(
		a: Actor,
		tx: number,
		ty: number,
		avoid = false,
	): Dir[] | null {
		const field = this.field;
		if (!field?.inBounds(tx, ty)) return null;
		return findRoute(
			field.w,
			field.h,
			this.openFor(a, avoid),
			[a.x, a.y],
			[tx, ty],
		);
	}

	/**
	 * 場面（Story.goto）で 歩かせる 道。道が なければ（台の うしろ・キリコが ふさぐ 細道の 先）、キリコ 以外は
	 * いちばん せまい すきまを とびこえる 道に する（engine/longWalk.ts の hopRoute）。
	 * キリコ と avoid（村の 子の 小さな しぐさ）は 歩ける 道だけ。
	 */
	private sceneRoute(
		a: Actor,
		tx: number,
		ty: number,
		avoid = false,
	): WalkStep[] | null {
		const route = this.routeTo(a, tx, ty, avoid);
		const field = this.field;
		if (route || avoid || a === this.player || !field) return route;
		return hopRoute(
			field.w,
			field.h,
			this.openFor(a, false),
			[a.x, a.y],
			[tx, ty],
		);
	}

	/**
	 * 道の ない すきまを こえて (x, y) へ（hopRoute の とびこえる マス）。映らなければ その場で 置きなおす。
	 * 映っていて 近ければ 弧を えがいて とぶ（台を とびこえる）。遠ければ 短い 暗転で（窓が キー待ちなら そのまま）。
	 */
	private async hopOver(
		a: Actor,
		x: number,
		y: number,
		ms: number,
	): Promise<void> {
		const gap = Math.abs(x - a.x) + Math.abs(y - a.y);
		const seen = this.seenCells();
		const shown = !!seen && (seen(a.x, a.y) || seen(x, y));
		if (shown && gap <= HOP_JUMP)
			await a.jump(x, y, Math.max(JUMP_MS, ms * gap));
		else if (shown && !this.ctx.input.busy) await this.cutWalk(a, x, y);
		else a.setPos(x, y);
	}

	/**
	 * いま 画面に 映る マス（場面の 長い 道を とばす ときに 見る。engine/longWalk.ts）。いまの カメラと、
	 * 寄せている 途中なら 行き先の どちらかで 映れば 映る。ボタンの 下にも 地図は 描くので 高さは 画面 ぜんぶ。
	 * 画面の 大きさが わからなければ null。
	 */
	private seenCells(): Seen {
		const c = this.camTarget();
		const w = this.screen.width;
		const h = this.screen.height;
		if (!c || !w || !h) return null;
		const m = SEEN_MARGIN * TILE;
		const views = [
			[this.camX, this.camY],
			[c.tx, c.ty],
		];
		return (x, y) =>
			views.some(
				([ox, oy]) =>
					(x + 1) * TILE > ox - m &&
					x * TILE < ox + w + m &&
					(y + 1) * TILE > oy - m &&
					y * TILE < oy + h + m,
			);
	}

	/** 場面で 歩く 人を 置きなおして よい マスか（人・置物・キリコの いない マス）。 */
	private freeFor(a: Actor, x: number, y: number): boolean {
		return (
			!!this.field?.canEnter(x, y, a) &&
			!(x === this.player.x && y === this.player.y)
		);
	}

	/** カメラが ついていく 人を 短い 暗転で (x, y) へ（もう 暗ければ 暗いまま 置く）。 */
	private async cutWalk(a: Actor, x: number, y: number): Promise<void> {
		const dark = this.fadeEl.style.opacity === "1";
		if (!dark) await this.fadeOut(CUT_FADE_MS);
		a.setPos(x, y);
		this.pan = null;
		this.updateCamera();
		if (!dark) await this.fadeIn(CUT_FADE_MS);
	}

	private faceTo(a: Actor, x: number, y: number): void {
		const dx = x - a.x;
		const dy = y - a.y;
		if (dx === 0 && dy === 0) return;
		a.dir =
			Math.abs(dx) > Math.abs(dy)
				? dx > 0
					? "right"
					: "left"
				: dy > 0
					? "down"
					: "up";
	}

	/**
	 * キリコを 1歩 進める（通れなければ 向きだけ 変える）。ダッシュ（X・Shift・画面の ボタン）は 走る。
	 * run は タップした 道（長い 道は 走る）。
	 */
	private async tryStep(d: Dir, run = false): Promise<void> {
		const field = this.field;
		if (!field) return;
		const v = DIR_VEC[d];
		this.player.dir = d;
		if (
			!field.canEnter(this.player.x + v.dx, this.player.y + v.dy, this.player)
		)
			return;
		// 着いたときの判定は update() が行う（stepPending）
		this.stepPending = true;
		const fast = this.ctx.input.mods().dash || run;
		const ms = fast ? WALK_MS / DASH_SPEED : WALK_MS;
		await this.player.walk(d, ms);
	}

	/** そのマスの 踏むイベント（ダンジョンの口）。 */
	private touchAt(x: number, y: number): Actor | undefined {
		return this.field?.actors.find(
			(a) => a.def?.trigger === "touch" && a.x === x && a.y === y && a.def.run,
		);
	}

	/** 1歩 着いたとき：踏むイベント（ダンジョンの口）。 */
	private afterStep(): void {
		const touch = this.touchAt(this.player.x, this.player.y);
		if (touch?.def) {
			this.clearPath();
			void this.runEvent(touch.def);
			return;
		}
		const step = this.field?.def.onStep?.(this.player.x, this.player.y);
		if (step && !this.leaving) {
			this.clearPath();
			void this.runScript(step);
			return;
		}
		// 町はずれで 越してくる 住人に 会う 場面（ui/village/arrivals.ts。場所の 寸劇より 先）
		const arrival = this.leaving
			? null
			: dueArrival(this.mapId, this.player.x, this.player.y);
		if (arrival) {
			this.clearPath();
			void this.runScript((s) => playArrival(s, arrival));
			return;
		}
		// ある 場所に はじめて 来た ときの 寸劇（ui/village/skits.ts）
		const sk = this.leaving
			? null
			: nearSkit(this.mapId, this.player.x, this.player.y);
		if (sk) {
			this.clearPath();
			void this.runScript((s) => playNearSkit(s, sk));
		}
	}

	/** 目の前の 人・物に 話しかける（カウンター越しも）。 */
	private talkFront(): void {
		const field = this.field;
		if (!field) return;
		const v = DIR_VEC[this.player.dir];
		let tx = this.player.x + v.dx;
		let ty = this.player.y + v.dy;
		const talkAt = (x: number, y: number) =>
			field.actors.find(
				(a) => a.x === x && a.y === y && a.def?.trigger === "talk",
			);
		let target = talkAt(tx, ty);
		// 目の前が 踏む 所（本館の 扉・出口の マット・村の 出口）なら、A でも 1歩 踏みこむ
		if (!target && this.touchAt(tx, ty)) {
			void this.tryStep(this.player.dir);
			return;
		}
		if (!target && field.tileAt(tx, ty).counter) {
			tx += v.dx;
			ty += v.dy;
			target = talkAt(tx, ty);
		}
		// 何も ない マス（キリコの 家の 床に 家具を 置く。ui/village/myhome.ts）
		if (!target && !field.actors.some((a) => a.x === tx && a.y === ty)) {
			const empty = field.def.onTalkEmpty?.(tx, ty);
			if (empty && this.scriptDepth === 0 && !this.leaving)
				void this.runScript(empty);
			return;
		}
		if (!target?.def?.run) return;
		// 掲示板や 立て札は、裏（北どなりから 下を向いて）からは 調べられない
		if (
			target.x === this.player.x &&
			target.y === this.player.y + 1 &&
			field.hasBack(target)
		)
			return;
		if (!target.def.fixedDir && !target.still)
			target.dir = OPPOSITE[this.player.dir];
		void this.runEvent(target.def);
	}

	/** x・y は canvas の左上から数えた CSS 画素。 */
	private onTap(x: number, y: number): void {
		const field = this.field;
		if (!field || !this.idle) return;
		this.talkRetried = false;
		const p = this.screen.cssToSource(x, y);
		const tx = Math.floor((p.x + this.camX) / TILE);
		let ty = Math.floor((p.y + this.camY) / TILE);
		if (!field.inBounds(tx, ty)) return;
		const talkAt = (x: number, y: number) =>
			field.actors.find(
				(a) => a.x === x && a.y === y && a.def?.trigger === "talk" && a.visible,
			) ?? null;
		// キリコを タップ：目の前の 何も ない マスで A と 同じ（キリコの 家で 家具を 置く。ui/village/myhome.ts）
		if (tx === this.player.x && ty === this.player.y && field.def.onTalkEmpty) {
			this.clearPath();
			this.talkFront();
			return;
		}
		let talk = talkAt(tx, ty);
		// ぶつかると 起きる 物（キリコの 家の ベッド）：となりなら すぐ、遠ければ 歩いて 着いたら 起こす
		if (talk && field.def.onBumpThing?.(tx, ty)) {
			if (Math.abs(tx - this.player.x) + Math.abs(ty - this.player.y) === 1) {
				this.clearPath();
				this.faceTo(this.player, tx, ty);
				this.bumpFront();
				return;
			}
			this.clearPath();
			this.walkTo(tx, ty, talk);
			this.pathBump = !!this.pathTalk;
			return;
		}
		// 前に 人が 立って ふさいでいる 口（本編が 開くまでの やきう）を タップしたら、その人に 話しかける
		if (!talk && this.touchAt(tx, ty)) {
			const guard = talkAt(tx, ty + 1);
			if (guard && !guard.through) {
				ty += 1;
				talk = guard;
			}
		}
		// 背の 高い 物（立て札・掲示板）の 頭（上の マス）を タップしても その 物に。
		// 頭の マスへ 歩いて 裏に 回り、裏からは 読めないので 何も 起きなかった
		if (!talk) {
			const below = talkAt(tx, ty + 1);
			if (below && field.hasBack(below)) {
				ty += 1;
				talk = below;
			}
		}
		// となりの人・物を タップしたら、そちらを向いて 話す（掲示板などの 裏からなら 表へ 回りこむ）
		if (
			talk &&
			Math.abs(tx - this.player.x) + Math.abs(ty - this.player.y) === 1 &&
			!(this.player.y === ty - 1 && field.hasBack(talk))
		) {
			this.clearPath();
			this.faceTo(this.player, tx, ty);
			this.talkFront();
			return;
		}
		this.walkTo(tx, ty, talk);
	}

	/**
	 * (tx, ty) へ 歩く道を 決める（着いたら talk に 話しかける）。
	 * 人・物が 相手なら、その となり（カウンターの 向こうの人なら カウンターの 手前）の うち
	 * いちばん近い マスまで。踏むと もぐる 口には 立たない（口の となりの 立て札を 読みに行って、
	 * もぐるか きかれないように）。掲示板などの 裏（北どなり）にも 立たない。
	 * 行き先で ない 扉・出口・口は 踏まずに 回りこむ（遠くを タップして、通りすがりに 倉庫や
	 * 常識堂の 奥へ 入って しまった）。よけて 行けない ときだけ 踏む（銭湯の 湯の 中など）。
	 */
	private walkTo(tx: number, ty: number, talk: Actor | null): void {
		const avoid = (x: number, y: number) => !!this.touchAt(x, y);
		// うろうろ 歩く 人（ぷゆゆ・フェリス）で ふさがって 道が 無ければ、その 人を 押しのけて 通る 道
		// （スマホの タップでは 2回 押し・長押しが しにくい。歩く 途中で swapPast が 入れかわる）
		const wander = (x: number, y: number) =>
			!!this.field?.tileAt(x, y).passable &&
			!!this.field.blockerAt(x, y, this.player)?.def?.wander;
		const path =
			this.route(tx, ty, talk, avoid) ??
			this.route(tx, ty, talk) ??
			this.route(tx, ty, talk, avoid, wander) ??
			this.route(tx, ty, talk, undefined, wander);
		if (!path) return;
		this.path = path;
		this.pathRun = path.length >= RUN_PATH;
		this.pathTalk = talk;
		this.marker = path.length ? { x: tx, y: ty, t: this.time } : null;
	}

	/** walkTo の 道（avoid の マスは 行き先の ほかは 通らない）。 */
	private route(
		tx: number,
		ty: number,
		talk: Actor | null,
		avoid?: (x: number, y: number) => boolean,
		pass?: (x: number, y: number) => boolean,
	): Dir[] | null {
		const field = this.field;
		if (!field) return null;
		const me = this.player;
		const noBack = !!talk && field.hasBack(talk);
		let path: Dir[] | null = null;
		if (talk) {
			for (const d of ["up", "down", "left", "right"] as Dir[]) {
				if (noBack && d === "up") continue;
				let sx = tx + DIR_VEC[d].dx;
				let sy = ty + DIR_VEC[d].dy;
				if (field.tileAt(sx, sy).counter) {
					sx += DIR_VEC[d].dx;
					sy += DIR_VEC[d].dy;
				}
				const here = sx === me.x && sy === me.y;
				if (!here && (!field.canEnter(sx, sy, me) || this.touchAt(sx, sy)))
					continue;
				const p = here
					? []
					: field.findPath(
							me.x,
							me.y,
							sx,
							sy,
							me,
							false,
							avoid,
							undefined,
							pass,
						);
				if (p && (!path || p.length < path.length)) path = p;
			}
		}
		// 立てる マスが 無ければ、相手の となりの どこかまで
		return (
			path ??
			field.findPath(me.x, me.y, tx, ty, me, noBack, avoid, undefined, pass)
		);
	}

	/** 画面の点（canvas の CSS 画素）が、キリコから見て どの向きか（8方向）。キリコの上なら null。 */
	private dirFromScreen(cssX: number, cssY: number): Dir8 | null {
		const k = this.screen.tileCss / TILE;
		const px = (this.player.fx * TILE + TILE / 2 - this.camX) * k;
		const py = (this.player.fy * TILE + TILE / 2 - this.camY) * k;
		const dx = cssX - px;
		const dy = cssY - py;
		if (Math.hypot(dx, dy) < this.screen.tileCss * 0.6) return null;
		return ((Math.round(Math.atan2(dx, -dy) / (Math.PI / 4)) + 8) % 8) as Dir8;
	}

	/** カメラが 見る 人・マス（マス単位・小数）。 */
	private focus(): { fx: number; fy: number } {
		const t = this.lookAt;
		if (t === null) return this.player;
		if (typeof t === "string") return this.actorFor(t) ?? this.player;
		return { fx: t[0], fy: t[1] };
	}

	/**
	 * カメラ。キリコ（場面では 見る先）を 下の ボタン（十字キー・A/B）より 上の まんなかに 置き、地図の はしで 止める。
	 * 地図が 画面に 収まる向きは まんなかに 置く（高さは ボタンより 上の 部分で）。
	 * 見る先を かえたら panTo で なめらかに 寄せる（着いたら また ぴったり ついていく）。
	 */
	private updateCamera(dt = 0): void {
		const c = this.camTarget();
		if (!c) return;
		const { tx, ty } = c;
		const sc = this.screen;
		const pan = this.pan;
		if (!pan) {
			this.camFX = tx;
			this.camFY = ty;
		} else {
			pan.t += dt;
			const p = Math.min(1, pan.t / pan.ms);
			const e = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
			// 見る先が 歩いても 行き先に あわせて 寄せる
			this.camFX = pan.x + (tx - pan.x) * e;
			this.camFY = pan.y + (ty - pan.y) * e;
			if (p >= 1) this.pan = null;
		}
		this.camX = sc.snap(this.camFX);
		this.camY = sc.snap(this.camFY);
	}

	/**
	 * カメラの 見る先を かえて、今の 位置から 寄せはじめる（null で キリコ）。着くまでの ミリ秒を かえす。
	 * 長さは 道のりの 平方根（となりの 人なら 0.4秒、村の はしから はしでも 1.2秒まで）。
	 */
	private panTo(target: string | readonly [number, number] | null): number {
		this.lookAt = target;
		const c = this.camTarget();
		const d = c ? Math.hypot(c.tx - this.camFX, c.ty - this.camFY) : 0;
		if (d < 0.5) {
			this.pan = null;
			return 0;
		}
		const ms = Math.min(1200, 250 + 42 * Math.sqrt(d));
		this.pan = { x: this.camFX, y: this.camFY, t: 0, ms };
		return ms;
	}

	/**
	 * カメラの 行き先（左上・ソース画素）と、ボタンより 上に 見えている 幅・高さ。
	 * focus を わたすと その 見る先で（話す 人が 画面に 入るかを はかる）。
	 */
	private camTarget(
		f = this.focus(),
	): { tx: number; ty: number; w: number; hv: number } | null {
		const field = this.field;
		if (!field) return null;
		const sc = this.screen;
		const cssPerSrc = sc.tileCss / TILE;
		const bottomCss = document.documentElement.classList.contains(
			"short-landscape",
		)
			? 40
			: 200;
		const w = sc.width;
		// ボタンより 上に 見えている 高さ（ソース画素）
		const hv = Math.max(TILE * 4, sc.height - bottomCss / cssPerSrc);
		const mw = field.w * TILE;
		const mh = field.h * TILE;
		// いちばん上の段（崖）も タップできるよう、上に 半マス あける
		const topPad = TILE / 2;
		const cx = f.fx * TILE + TILE / 2 - w / 2;
		const cy = f.fy * TILE + TILE / 2 - hv / 2;
		const tx = mw <= w ? (mw - w) / 2 : clamp(cx, 0, mw - w);
		const ty = mh + topPad <= hv ? -(hv - mh) / 2 : clamp(cy, -topPad, mh - hv);
		return { tx, ty, w, hv };
	}

	/**
	 * 話す 人が 画面（カメラの 行き先）の 外なら、その 人に カメラを 向けてから 話す
	 * （場面で 見る先と 話す 人が ずれて、見えない 人の 声だけが 飛んでくるのを ふせぐ 網）。
	 */
	private async showSpeaker(id: string): Promise<void> {
		const a = this.actorFor(id);
		const c = this.camTarget();
		if (!a?.visible || !c) return;
		const x = a.fx * TILE;
		const y = a.fy * TILE;
		const inside =
			x >= c.tx + TILE / 2 &&
			x + TILE <= c.tx + c.w - TILE / 2 &&
			y >= c.ty &&
			y + TILE <= c.ty + c.hv;
		if (inside) return;
		console.warn(
			`[say] ${id} が 画面の 外で 話そうと したので カメラを 向けます`,
		);
		await sleep(this.panTo(id) + 80);
	}

	private render(): void {
		const g = this.screen.begin();
		const field = this.field;
		g.fillStyle = field?.def.outside ?? "#000";
		g.fillRect(0, 0, this.screen.width, this.screen.height);
		if (!field) return;
		const ox = this.camX;
		const oy = this.camY;
		field.drawBelow(g, ox, oy);
		if (this.marker && this.path.length) {
			const a = 0.5 + 0.3 * Math.sin((this.time - this.marker.t) / 120);
			g.strokeStyle = `rgba(255,255,255,${a})`;
			g.lineWidth = 1;
			g.strokeRect(
				this.marker.x * TILE - ox + 1.5,
				this.marker.y * TILE - oy + 1.5,
				TILE - 3,
				TILE - 3,
			);
		}
		// 停電の 場面は 場面に 出る 人と 明かりの 灯った 所の 人だけ 外に（ui/village/sceneSky.ts。見えない 人は 道も ふさがない。
		// 向きの ない 絵の 置物は そのまま）
		for (const a of field.actors)
			a.visible = a.still || outsideNow(a.id, a.x, a.y);
		// 広場の チョークの 国境線・地図の きのこ（人の 下。ui/village/sceneChalk.ts・sceneShrooms.ts）
		if (this.mapId === "village") {
			drawChalk(g, ox, oy);
			drawShrooms(g, ox, oy);
			drawMarksBelow(g, ox, oy);
		}
		// 画面の 外の 人・物は 描かない（町には 150 ほど いる。大きな 絵・吹き出しが はみ出す ぶん まわりも 描く）
		const sw = this.screen.width;
		const sh = this.screen.height;
		const m = DRAW_MARGIN * TILE;
		const actors = [...field.actors, this.player]
			.filter((a) => {
				const px = a.fx * TILE - ox;
				const py = a.fy * TILE - oy;
				return px > -m && px < sw + m && py > -m && py < sh + m;
			})
			.sort((a, b) => a.fy - b.fy);
		for (const a of actors) a.draw(g, ox, oy, this.time);
		// やきうの 頭の 上の「残機：1」（ui/village/zankiTag.ts）
		drawZanki(g, field.actor("nanj"), ox, oy);
		field.drawAbove(g, ox, oy);
		// 屋根と 海から 立つ 湯気（ui/village/sceneMarks.ts）
		if (this.mapId === "village") drawMarksAbove(g, ox, oy);
		// 掲示板・木などの 裏に ほとんど隠れた 人は 薄く見せる（キリコも 村の人も）。
		// 向きの ない 絵（置物・看板）は 地形の 一部なので 透かさない
		field.drawHidden(
			g,
			actors.filter((a) => a === this.player || !a.still),
			ox,
			oy,
			this.time,
		);
		field.def.decor?.(g, ox, oy, this.time, {
			x: this.player.x,
			y: this.player.y,
			dir: this.player.dir,
		});
		if (this.guideExit && this.mapId === "village" && !openingHoldsGuide())
			this.drawExitGuide(g, ox, oy, this.scene);
		// 時間帯の 色（外の 村と 板の 地上だけ。人通りと 同じ 時計。data/village/daylight.ts）
		let tint: string | null = null;
		if (this.mapId === "village" || this.mapId.startsWith("s_")) {
			// 日付の 日の 出・日の 入りに 合わせて 少しずつ 色を うつす（data/village/daylight.ts の daylightAt。秒の 端数も 足す）
			// 明かりの 場面は 時計に かかわらず 夜（ui/village/sceneSky.ts。dark は 明かりも 消す。
			// 場面で 灯す 明かりが あれば その 板の ぶんだけ 灯す）
			const { m, d } = today();
			const sky = sceneSky();
			const on = sceneLit();
			const lit = daylightAt(
				sky
					? sceneMinute(sky)
					: nowHour() * 60 + nowMinute() + this.clockMs / 1000,
				m,
				d,
			);
			const day = sky === "dark" && !on ? { ...lit, lamp: 0, windows: 0 } : lit;
			const rule =
				on && field.def.lights?.scene
					? field.def.lights.scene(on.boards, on.homes)
					: field.def.lights;
			tint = day.tint;
			if (day.tint) {
				g.save();
				g.globalCompositeOperation = "multiply";
				g.fillStyle = day.tint;
				g.fillRect(0, 0, this.screen.width, this.screen.height);
				// 停電の 夜は もう1段 暗く（明かりの 坂で 灯る 明かりが 浮かぶ）
				if (sky === "dark") {
					g.fillStyle = BLACKOUT_TINT;
					g.fillRect(0, 0, this.screen.width, this.screen.height);
				}
				g.restore();
			}
			this.drawLights(g, field, rule, ox, oy, day);
		} else if (this.indoorDark) {
			// 停電の 屋内：明かりの ない 部屋（キリコの まわりだけ うっすら 見える）
			const px = this.player.fx * TILE - ox + TILE / 2;
			const py = this.player.fy * TILE - oy + TILE / 2;
			const grad = g.createRadialGradient(px, py, TILE, px, py, TILE * 5);
			grad.addColorStop(0, "rgb(200, 196, 210)");
			grad.addColorStop(1, INDOOR_BLACKOUT);
			g.save();
			g.globalCompositeOperation = "multiply";
			g.fillStyle = grad;
			g.fillRect(0, 0, this.screen.width, this.screen.height);
			g.restore();
			tint = INDOOR_BLACKOUT;
		}
		// 吹き出しと お金の 出入り（頭の 上に ＋／−の 金額）は 夜の 色を かぶらない よう 最後に。
		// 吹き出しは 字が 読める ぶんだけ 時間帯の 色を 薄めて 重ねる
		this.overhear.draw(g, ox, oy, this.screen.width, tint);
		this.moneyPops.draw(
			g,
			Math.round(this.player.fx * TILE - ox),
			Math.round(this.player.fy * TILE - oy),
			this.time,
		);
	}

	/** 夜の 明かりの マス（地図ごとに 1回 さがす）。 */
	private lightCells: {
		field: Field;
		rule: LightRule | undefined;
		lamps: [number, number][];
		windows: [number, number][];
	} | null = null;

	/** 夕方から 街灯と 窓に 明かり（色を 重ねた あとに 足し算で。data/village/daylight.ts の BAND_LIGHT）。 */
	private drawLights(
		g: CanvasRenderingContext2D,
		field: Field,
		rule: LightRule | undefined,
		ox: number,
		oy: number,
		k: { lamp: number; windows: number },
	): void {
		if (k.lamp < 0.01 && k.windows < 0.01) return;
		// 生き返って いない 建物の 窓は 灯らない・街灯は 町の 明かり（電池板）から（data/town/revival.ts）
		if (this.lightCells?.field !== field || this.lightCells.rule !== rule) {
			const W = field.def.rows[0]?.length ?? 0;
			this.lightCells = {
				field,
				rule,
				lamps:
					rule && !rule.lamps
						? []
						: field.cellsWhere((t) => lightOf(t.layers) === "lamp"),
				windows: field
					.cellsWhere((t) => lightOf(t.layers) === "window")
					.filter(([x, y]) => !rule?.unlit.has(y * W + x)),
			};
		}
		const { lamps, windows } = this.lightCells;
		const W = this.screen.width;
		const H = this.screen.height;
		const seen = (px: number, py: number, r: number) =>
			px > -r && py > -r && px < W + r && py < H + r;
		g.save();
		g.globalCompositeOperation = "lighter";
		// 窓：ガラスの ところを あたたかい 色で（灯る 窓は マスごとに 決まる）
		g.fillStyle = `rgba(255, 196, 110, ${0.55 * (k.windows ? 1 : 0)})`;
		for (const [x, y] of windows) {
			if (!windowLit(x, y, k.windows)) continue;
			const px = x * TILE - ox;
			const py = y * TILE - oy;
			if (!seen(px, py, TILE)) continue;
			g.fillRect(px + 4, py + 4, TILE - 8, TILE - 7);
		}
		// 開いて いる 店の 看板（ui/village/signboards.ts の signboardGlow）
		rule?.glow?.(g, ox, oy, Math.max(k.lamp, k.windows));
		// 街灯：頭（1マス 上）の まわりに 段の ついた 丸い 光（ドット。ぼかさない：作者「光表現は ファジーでは なく
		// ドットに」）。内から 3段、いちばん 外の 段は 市松（ディザ）。1画素ずつ 行で 塗る
		// うつりかわりの あいだは 強さが 少しずつ かわるので 20段に まるめる（絵は 段ごとに 1枚）
		const glow = this.lampGlow(Math.round(k.lamp * 20) / 20);
		const R = LAMP_R;
		for (const [x, y] of lamps) {
			const cx = Math.round(x * TILE - ox + TILE / 2);
			const cy = Math.round(y * TILE - oy - 10);
			if (!seen(cx, cy, R + 1)) continue;
			g.drawImage(glow, cx - R, cy - R);
		}
		g.restore();
	}

	/** 街灯の 光の 絵（強さごとに 1枚 作って 使いまわす。毎コマ 画素を 塗ると 重い）。 */
	private lampGlows = new Map<number, HTMLCanvasElement>();
	private lampGlow(strength: number): HTMLCanvasElement {
		const hit = this.lampGlows.get(strength);
		if (hit) return hit;
		const R = LAMP_R;
		const c = document.createElement("canvas");
		c.width = R * 2 + 1;
		c.height = R * 2 + 1;
		const g = c.getContext("2d");
		if (g)
			for (const ring of LAMP_RINGS) {
				g.fillStyle = `rgba(255, 226, 150, ${ring.a * strength})`;
				for (let dy = -ring.r; dy <= ring.r; dy++) {
					const half = Math.floor(Math.sqrt(ring.r * ring.r - dy * dy));
					if (!ring.dither) {
						g.fillRect(R - half, R + dy, half * 2 + 1, 1);
						continue;
					}
					// 市松（街灯の 中心は いつも 偶数の 画素なので、地図の 上でも 模様は そろう）
					for (let dx = -half; dx <= half; dx++)
						if ((dx + dy) % 2 === 0) g.fillRect(R + dx, R + dy, 1, 1);
				}
			}
		this.lampGlows.set(strength, c);
		return c;
	}

	/** 出口への 道の 先（キリコの マスごとに 覚える）。 */
	private guideMemo: { key: string; dx: number; dy: number } | null = null;

	/**
	 * 出口へ 歩く 向き（マス）。出口の 方角では なく、歩ける 道を GUIDE_AHEAD 歩 先まで たどった 向き
	 * （出口は 右上でも、本館の 前の 道では 右へ 回る。方角だけだと 本館の 扉を さした）。
	 * 道が 曲がる 手前では 斜めに なる。
	 * 道が なければ 出口の 方角。
	 */
	private guideHeading(ex: number, ey: number): [number, number] {
		const p = this.player;
		const key = `${this.mapId}:${p.x},${p.y}`;
		if (this.guideMemo?.key !== key) {
			const route = this.routeTo(p, ex, ey) ?? [];
			let dx = ex - p.x;
			let dy = ey - p.y;
			if (route.length) {
				dx = 0;
				dy = 0;
				for (const d of route.slice(0, GUIDE_AHEAD)) {
					dx += DIR_VEC[d].dx;
					dy += DIR_VEC[d].dy;
				}
			}
			this.guideMemo = { key, dx, dy };
		}
		return [this.guideMemo.dx, this.guideMemo.dy];
	}

	/**
	 * 村の 出口（北の 崖の 切れ目の 先）を さす 矢印。画面に 出口が あれば その 1マス半 下で 上を さし（出口は 地図の いちばん上なので 1マス下だと 🔊 よけの 余白に 入る）、
	 * 外なら キリコの そばで 出口へ 歩く 向きを 8方向で さす（
	 * 画面の はしに 寄せると、起きる 所からは 右上の 🔊 の 真下で そちらを さし、
	 * タイトルの「音は　右上の　🔊」と あわせて 音の ボタンを さして 見えた）。
	 * 場面の 中では 出口が 映った ときだけ（カメラで 出口を 見せる ところ）。
	 * まわりの 絵に あわせて ドットで 描く（なめらかな 線だと 1つだけ 浮く）。
	 */
	private drawExitGuide(
		g: CanvasRenderingContext2D,
		ox: number,
		oy: number,
		inViewOnly: boolean,
	): void {
		const c = this.camTarget();
		if (!c) return;
		const [ex, ey] = VILLAGE_SPOTS.exit;
		const tx = ex * TILE + TILE / 2 - ox;
		const ty = ey * TILE + TILE / 2 - oy;
		// 上の はしの 2マスは 右上の 音の ボタンと かさなるので 外あつかい
		const m = TILE * 0.9;
		const below = ty + TILE * 1.5;
		const inView =
			tx >= m && tx <= c.w - m && below >= TILE * 2.2 && below <= c.hv - m;
		if (!inView && inViewOnly) return;
		let x = tx;
		let y = below;
		let dir: Dir8 = 0;
		if (!inView) {
			const p = this.player;
			const px = p.fx * TILE + TILE / 2 - ox;
			const py = p.fy * TILE + TILE / 2 - oy;
			const [hx, hy] = this.guideHeading(ex, ey);
			dir = ((Math.round(Math.atan2(hx, -hy) / (Math.PI / 4)) + 8) % 8) as Dir8;
			const [ux, uy] = [DX[dir], DY[dir]];
			// 斜めは 1マスの 角の 外（たて・よこと 同じくらい 離す）
			const r = isDiagonal(dir) ? TILE * 0.95 : TILE * 1.2;
			x = px + ux * r;
			y = py + uy * r;
			// たて・よこの 矢印の 下が 地形か 置物（起きる 所では 蓄音機）なら、出口の 側へ 1マス ずらす
			// （真上に 重なると「蓄音機を 調べろ」に 見える）
			const f = this.field;
			const blocked = (cx: number, cy: number): boolean =>
				!f?.tileAt(cx, cy).passable || !!f.blockerAt(cx, cy, p)?.still;
			if (!isDiagonal(dir) && blocked(p.x + ux, p.y + uy)) {
				const sx = ux === 0 ? Math.sign(ex - p.x) || 1 : 0;
				const sy = uy === 0 ? Math.sign(ey - p.y) || 1 : 0;
				if (!blocked(p.x + ux + sx, p.y + uy + sy)) {
					x += sx * TILE;
					y += sy * TILE;
				}
			}
		}
		// 1画素ずつ 前後に はねる（0→1→2→1）
		const bob = [0, 1, 2, 1][Math.floor(this.time / 140) % 4];
		const cx = Math.round(x + DX[dir] * bob);
		const cy = Math.round(y + DY[dir] * bob);
		// 上向き・右上向きの 絵を 90度ずつ まわす（まんなかが 0）
		const art = isDiagonal(dir) ? GUIDE_ARROW_UR : GUIDE_ARROW_UP;
		const turns = Math.floor(dir / 2);
		for (let r = 0; r < art.length; r++) {
			const row = art[r];
			for (let i = 0; i < row.length; i++) {
				const col = GUIDE_COLORS[row[i]];
				if (!col) continue;
				let u = i - 5;
				let v = r - 5;
				for (let k = 0; k < turns; k++) [u, v] = [-v, u];
				g.fillStyle = col;
				g.fillRect(cx + u, cy + v, 1, 1);
			}
		}
	}

	// ───────────────── スクリプト ─────────────────

	private runEnter(): void {
		const enter = this.field?.def.onEnter;
		if (!enter) {
			this.scene = false;
			this.ctx.input.clearField();
			this.ctx.input.takeDirPress();
			this.checkAuto();
			return;
		}
		void this.runScript(async (s) => {
			try {
				await enter(s);
			} finally {
				this.scene = false;
				this.skit = false;
			}
		});
	}

	/** 条件を満たした 自動イベントを 始める。 */
	private checkAuto(): void {
		const field = this.field;
		if (!field || this.scriptDepth > 0 || this.leaving) return;
		const auto = field.actors.find(
			(a) => a.def?.trigger === "auto" && a.def.run,
		);
		if (auto?.def) void this.runEvent(auto.def);
	}

	/** 話しかけて いる 相手（名前を かえた 声の 記号を 出す 人。runEvent の あいだ）。 */
	private talking: EventDef | null = null;

	private async runEvent(e: EventDef): Promise<void> {
		// ほかのスクリプトが 動いている間は 始めない（二重起動の防止）
		if (!e.run || this.scriptDepth > 0 || this.leaving) return;
		const run = e.run;
		// 扉で 地図が かわっても、印は 始めた 地図に つける
		const map = this.mapId;
		this.talking = e;
		try {
			await this.runScript(async (s) => {
				await run(s);
				if (e.once) this.state.flags[this.flagKey("done", e.id, map)] = true;
				// 建物に はじめて 入った・物を はじめて 調べた ときの 寸劇（ui/village/skits.ts）
				if (!this.exitChoice && !this.leaving)
					await skitAfterEvent(s, { from: map, to: this.mapId, thing: e.id });
			});
		} finally {
			this.talking = null;
		}
	}

	/** スクリプトを 実行する。村を出ると 決まったら、いちばん外の スクリプトの 終わりで 出る。 */
	private async runScript(fn: Script): Promise<void> {
		this.scriptDepth++;
		this.ctx.input.clearField();
		try {
			await fn(this.story);
		} catch (e) {
			console.error("[village]", e);
		} finally {
			if (this.scriptDepth > 0) this.scriptDepth--;
		}
		if (this.scriptDepth > 0 || !this.running) return;
		this.msg.close();
		// カメラを 人や 建物に 向けたままなら キリコへ もどす
		if (this.lookAt !== null) this.panTo(null);
		if (this.exitChoice) {
			await this.leave(this.exitChoice);
			return;
		}
		this.refreshActors();
		// 場面の すき間（人が 歩く・暗転）で 押した キー・向きは 捨てる（終わった とたんに 1歩 出ないように）。
		// 押しっぱなしの 向きは 残る（そのまま 歩きだす）
		this.ctx.input.clearField();
		this.ctx.input.takeDirPress();
		this.checkAuto();
	}

	// ───────────────── 演出 ─────────────────

	private async fadeOut(ms = 300): Promise<void> {
		// 窓と 立ち絵は 暗転の 前に 片付ける（明けたときに 前の セリフが 残らないように）
		this.msg.close();
		this.fadeEl.style.background = "#000";
		this.fadeEl.style.transition = `opacity ${ms}ms linear`;
		await nextFrame();
		this.fadeEl.style.opacity = "1";
		await sleep(ms);
	}

	private async fadeIn(ms = 300): Promise<void> {
		this.fadeEl.style.transition = `opacity ${ms}ms linear`;
		await nextFrame();
		this.fadeEl.style.opacity = "0";
		await sleep(ms);
	}

	private toast(text: string): void {
		this.toastEl.textContent = text;
		this.toastEl.classList.remove("shown");
		void this.toastEl.offsetWidth;
		this.toastEl.classList.add("shown");
	}

	private portraitOf(who: Speaker): PortraitSpec | null {
		const c = CAST[who];
		if (!c.portrait) return null;
		return { id: who, name: c.name, color: c.color, ...c.portrait };
	}

	private say(
		who: Speaker | null,
		text: string,
		opt: SayOptions = {},
	): Promise<void> {
		const c = who ? CAST[who] : undefined;
		// おーぷんの 日替わり（2/22 猫の日・4/1 強制博多弁・10/31 トリック。data/town/openModes.ts）。話す 人の 窓だけ：
		// 地の文・キリコ（sayKiriko）・入った ときの 場面（スレタイと >>1。2017年の 博多弁と 同じ）・
		// 住人の はじめましてと 節目（rawModes。ui/village/villageMobs.ts）には かけない。名前欄は かえない
		const mode =
			!this.scene && (who || opt.name) && !modesHeld() ? openMode() : null;
		const shown = mode ? modeText(text, mode) : text;
		// 声の ある 人（data/people/cast.ts の voice・MOB_VOICE）だけ 読み上げる（ボイスが ON のとき。rpg の Game.say と 同じ）
		// 絵文字は 読み上げの 側で 落とす（engine/audio.ts）
		const voice = opt.tts ?? c?.voice;
		// 感情の 記号・体の 動き（engine/emote.ts）：話す 人の 頭に。名前を かえた 声（住人・来客）は 話しかけた 相手
		if (opt.emote || opt.gesture) {
			const who2 = opt.speaker ?? (who && !opt.name ? who : this.talking?.id);
			const a = who2 ? this.actorFor(who2) : undefined;
			if (a?.visible) {
				if (opt.emote) a.showEmote(opt.emote, false);
				if (opt.gesture) a.showGesture(opt.gesture, false);
			}
		}
		// 暗転した ままの 文は 幕の 上に（幕の 下だと 真っ暗な まま 送りを 待つ だけに なる）
		this.msg.overFade(this.fadeEl.style.opacity === "1");
		return this.msg.show({
			// 場面の 地の文・名無しの 窓では 立ち絵を 下げる（語りが 言う 島・舟・湯気を 立ち絵で 隠さない）
			clearPortraits: this.scene,
			name: opt.name ?? c?.label ?? c?.name,
			color: opt.color ?? c?.color,
			text: shown,
			// 立ち絵の 頭の 横にも 手書き風の 記号（村に 立って いない 人でも）
			emote: opt.emote,
			onShow:
				voice && settings.voice
					? (leadMs) => this.ctx.audio.speak(shown, voice, leadMs)
					: undefined,
			portrait: opt.noPortrait
				? null
				: opt.portrait
					? {
							id: opt.portrait.id,
							name: opt.name ?? c?.name ?? "",
							color: opt.portrait.color ?? opt.color ?? c?.color ?? "#b8b8c8",
							src: opt.portrait.src,
							side: "right",
						}
					: who
						? this.portraitOf(who)
						: null,
		});
	}

	/**
	 * キリコの ことば。独白は （　）で かこみ、声なし（村の だれにも 聞こえない）。
	 * 声（voice。村の 雑談と 喫茶だけ）は （　）が 外れ、rpg と 同じ uc で 読み上げる。立ち絵は 左（rpg と 同じ）。
	 */
	private sayKiriko(
		text: string,
		mode: KirikoMode,
		emote?: Emote,
	): Promise<void> {
		const voice = mode === "voice" ? KIRIKO.voice : undefined;
		this.msg.overFade(this.fadeEl.style.opacity === "1");
		return this.msg.show({
			name: KIRIKO.name,
			color: KIRIKO.color,
			text: mode === "think" ? `（${text}）` : text,
			emote,
			onShow:
				voice && settings.voice
					? (leadMs) => this.ctx.audio.speak(text, voice, leadMs)
					: undefined,
			portrait: {
				id: "kiriko",
				name: KIRIKO.name,
				color: KIRIKO.color,
				src: KIRIKO.portrait,
				side: "left",
			},
		});
	}

	private actorFor(target: string): Actor | undefined {
		if (target === "player") return this.player;
		return this.field?.actor(target);
	}

	/** 節目の 音の あと、次の 文を 出さずに 待つ 時刻（BEAT_SE_MS）。 */
	private holdUntil = 0;

	/**
	 * 節目の 音を 鳴らした 直後なら、その 間が すぎるまで 待つ（画面を 止めて 鳴らし、それから 文）。
	 * ファンファーレと 同時に 文が 出ると、大事な ところが 流れて しまう。
	 */
	private async beatHold(): Promise<void> {
		const left = this.holdUntil - performance.now();
		this.holdUntil = 0;
		if (left > 0) await sleep(left);
	}

	/**
	 * 行の 間（pause）と ツッコミの 音（hit。engine/emote.ts）。間は 前の 窓を 閉じて 黙る。音は 窓の 前に 鳴り、
	 * 突かれた 人（target。"player" は キリコ。null なら だれも）が びくっと する。ずっこけ（zukko）は 場に いる
	 * 仲間も いっしょに 沈む。
	 */
	private async beatAndHit(
		c: { pause?: number; hit?: Hit } | undefined,
		target: string | null,
	): Promise<void> {
		if (c?.pause) {
			this.msg.close();
			await sleep(c.pause);
		}
		if (!c?.hit) return;
		this.ctx.audio.se(HIT_SE[c.hit]);
		const g: Gesture = c.hit === "zukko" ? "slump" : "startle";
		if (c.hit === "zukko") {
			for (const a of this.field?.actors ?? [])
				if (a.visible && !a.still) a.showGesture(g, false);
			this.player.showGesture(g, false);
			return;
		}
		if (c.hit === "sting") return;
		if (target === "player") this.player.showGesture(g, false);
		else if (target) this.actorFor(target)?.showGesture(g, false);
	}

	/** Story API（イベントの スクリプトから 使う 命令）。 */
	private readonly story: Story = this.makeStory();

	private makeStory(): Story {
		const v = this;
		return {
			get state(): VState {
				return v.state;
			},
			say: async (who, text, opt) => {
				await this.beatHold();
				// 見せ場の 間と ツッコミの 音（突かれるのは キリコ）
				await this.beatAndHit(opt, "player");
				// 名前を かえた 声（住人・来客）は 声の 持ち主が 話す 人では ないので 見ない
				if (who && !opt?.name) await this.showSpeaker(who);
				return this.say(who, text, opt);
			},
			narrate: async (text) => {
				await this.beatHold();
				return this.say(null, text);
			},
			kiriko: async (text, mode, cue) => {
				await this.beatHold();
				// 見せ場の 間と ツッコミの 音（キリコが 突く 相手は 話しかけて いる 人）
				await this.beatAndHit(cue, this.talking?.id ?? null);
				// キリコの 頭に 感情の 記号・動き（engine/emote.ts）
				if (cue?.emote) this.player.showEmote(cue.emote, false);
				if (cue?.gesture) this.player.showGesture(cue.gesture, false);
				return this.sayKiriko(text, mode, cue?.emote);
			},
			choose: async (options, opt) => {
				await this.beatHold();
				return this.choice.choose(
					options,
					opt?.cancel,
					(name) => this.ctx.audio.se(name),
					opt?.start,
				);
			},
			wait: (ms) => {
				// 窓と 立ち絵を 片付ける（一覧・歩く 場面の 前に。立ち絵が 人を 隠さないように）
				this.msg.close();
				return sleep(ms);
			},
			fadeOut: (ms) => this.fadeOut(ms),
			fadeIn: (ms) => this.fadeIn(ms),
			bgm: (name) => this.ctx.audio.bgm(name),
			fadeBgm: (ms) => this.ctx.audio.fadeBgm(ms),
			preloadSe: (names) => this.ctx.audio.preloadSe(names),
			se: (name) => {
				this.ctx.audio.se(name);
				// 節目の 音（ファンファーレ・鐘）の あとは 間を おいてから 次の 文（beatHold）
				const ms = BEAT_SE_MS[name];
				if (ms)
					this.holdUntil = Math.max(this.holdUntil, performance.now() + ms);
			},
			flag: (name) => this.state.flags[name],
			set: (name, value = true) => {
				this.state.flags[name] = value;
			},
			move: async (target, route, opt) => {
				const a = this.actorFor(target);
				if (!a) {
					console.warn(`[move] ${target} が いません`);
					return;
				}
				const ms = WALK_MS / (opt?.speed ?? 1);
				const map: Record<string, Dir> = {
					u: "up",
					d: "down",
					l: "left",
					r: "right",
				};
				for (const ch of route) {
					if (ch === "w") {
						await sleep(250);
						continue;
					}
					const face = map[ch.toLowerCase()];
					if (!face) continue;
					if (ch === ch.toUpperCase()) {
						a.dir = face;
						await sleep(120);
						continue;
					}
					const dv = DIR_VEC[face];
					if (
						!opt?.through &&
						this.field &&
						!this.field.canEnter(a.x + dv.dx, a.y + dv.dy, a)
					) {
						a.dir = face;
						await sleep(ms);
						continue;
					}
					await a.walk(face, ms);
				}
				if (a === this.player) this.syncState();
			},
			goto: async (target, x, y, opt) => {
				const a = this.actorFor(target);
				// 道が なければ すきまを とびこえる 道（キリコ・avoid は 歩ける 道だけ。sceneRoute）
				const route = a ? this.sceneRoute(a, x, y, opt?.avoid) : null;
				if (!a || !route) {
					console.warn(`[goto] ${target} は (${x},${y}) へ 行けません`);
					return;
				}
				const ms = WALK_MS / (opt?.speed ?? 1);
				// 長い 道は 映らない ところを とばす（キリコ・noWarp は ぜんぶ 歩く。engine/longWalk.ts）
				await walkRoute([a.x, a.y], route, {
					warp: mayWarp(target, route.length, opt),
					follow: () => this.lookAt === target,
					// 窓が キー待ちなら 暗転しない（暗転は 窓を 閉じるので 読みかけの 文が 消える）
					mayCut: () => !this.ctx.input.busy,
					seen: () => this.seenCells(),
					free: (cx, cy) => this.freeFor(a, cx, cy),
					place: ([cx, cy]) => a.setPos(cx, cy),
					cut: ([cx, cy]) => this.cutWalk(a, cx, cy),
					step: (d) => a.walk(d, ms),
					hop: ([cx, cy]) => this.hopOver(a, cx, cy, ms),
				});
				if (a === this.player) this.syncState();
			},
			look: async (target, opt) => {
				if (opt?.instant) {
					this.lookAt = target;
					this.pan = null;
					this.updateCamera();
					return;
				}
				// 着いてから 少し 止めて 見せる（近くても 前と 同じ 0.45秒は 待つ）。所（建った 所・出口）は
				// 見て わかるまで 長めに、人は すぐ 歩きだす ことが 多いので 短く
				const hold = Array.isArray(target) ? 450 : 150;
				await sleep(Math.max(450, this.panTo(target) + hold));
			},
			face: (target, dir) => {
				const a = this.actorFor(target);
				if (!a) return;
				if (dir === "player") this.faceTo(a, this.player.x, this.player.y);
				else a.dir = dir;
			},
			near: (id, r) => {
				const a = this.actorFor(id);
				if (!a || a === this.player || !a.visible) return false;
				return (
					Math.max(
						Math.abs(a.x - this.player.x),
						Math.abs(a.y - this.player.y),
					) <= r
				);
			},
			show: (id) => {
				if (id === "player") {
					this.player.visible = true;
					return;
				}
				delete this.state.flags[this.flagKey("hide", id)];
				this.refreshActors();
			},
			hide: (id) => {
				if (id === "player") {
					this.player.visible = false;
					return;
				}
				this.state.flags[this.flagKey("hide", id)] = true;
				this.refreshActors();
			},
			place: (id, x, y, dir) => {
				const a = this.actorFor(id);
				if (!a) return;
				a.setPos(x, y);
				if (dir) a.dir = dir;
				if (a === this.player) this.syncState();
			},
			wear: (target, prop) => {
				const a = this.actorFor(target);
				if (!a) return;
				// 湯気は 動く 粒、ほかは 装備の 重ね描きと 同じ（public/sprites/equip/<種類>.png を 向きと
				// 足踏みの コマで 重ねる）
				a.aura = prop === "steam" ? "steam" : null;
				a.over =
					prop && prop !== "steam"
						? (ctx, dir, frame, x, y) =>
								drawEquip(
									ctx,
									{ weapon: null, shield: null, head: prop },
									dir,
									frame,
									x,
									y,
									"over",
								)
						: null;
			},
			spores: (target) => this.actorFor(target)?.puffSpores(),
			toast: (text) => this.toast(text),
			rebuild: () => this.rebuild(),
			warp: (map, x, y, dir) =>
				this.warp(map, { x, y, dir: dir ?? this.player.dir }),
			lie: (at) => {
				const p = this.player;
				if (at) {
					this.lieFrom ??= { x: p.x, y: p.y, dir: p.dir };
					p.setPos(at.x, at.y);
					// 枕に 頭が のるよう 4px 下げる（下の マスの 掛け布団を かぶせる。顔は 布団の 上に 出る。engine/field.ts）
					p.fy = at.y + 0.25;
					p.dir = "down";
					p.blanket = at.blanket;
				} else {
					p.blanket = null;
					const f = this.lieFrom;
					this.lieFrom = null;
					if (f) {
						p.setPos(f.x, f.y);
						p.dir = f.dir;
					}
				}
				this.syncState();
			},
			exit: (choice) => {
				this.exitChoice = choice;
			},
		};
	}
}
