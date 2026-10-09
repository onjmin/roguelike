// 歩ける村（保守村）。ダンジョンの外で キリコが 歩きまわる 1枚のマップ。
// rpg の engine/game.ts（Game）から、戦闘・仲間・隊列・セーブを のぞいて 移したもの。
//
// - 4方向で 1マスずつ歩く（十字キー・キーボード。斜めは 縦を先に 試して、だめなら 横へ すべる）。
//   画面を タップすると そこまで 歩く（人・看板なら 前まで行って 話す。カウンターの 向こうの人も。
//   ダンジョンの口を タップすれば 口まで 歩いて もぐるか きく。前に 人が 立って ふさいでいる口なら その人と 話す）。
//   画面を 押さえつづけると 指の方へ 歩きつづける。
// - A で 目の前の 人・物を 調べる（カウンター越しも）。目の前が 踏む 所（扉・出口）なら 1歩 踏みこむ。
//   B・☰ で 村の メニュー（ui/villageEvents.ts）。
// - 窓（会話・選択肢・メニュー）が 開いている間は 歩かない（input.busy）。
// - 地図は 村（village）と おんJ 本館の 中（hall。ui/hallEvents.ts）と 建物の 中（喫茶・小屋・常識堂の 奥・倉庫。
//   ui/cafe.ts・ui/rooms.ts）。扉・出口の マットで Story.warp（暗転の 中で
//   地図を かえる。rpg の Game.loadMap と 同じ）。warp では 入る ときの 場面（prepare・onEnter）は 走らせない。
// - 入るたびに onEnter（帰ってきた場面・開いた知らせ・持ち帰った物。ui/villageReturn.ts）。その間は 歩かない・
//   うろうろ しない（scene）。場面では カメラを 人や 建物に 向ける（look）。
// - 場面で 歩かせる 道（Story.goto）が 長いと、キリコ 以外は 画面に 映らない ところを とばす（engine/longWalk.ts。
//   地図が 87×52 に 広がって、遠くの 人が 来るまで 長く 待った）。映らない マスへ 置きなおして 画面の はしの
//   すぐ 外から 歩いて 入る・画面の 外へ 出ていったら 行き先へ。カメラが ついていく 人は 短い 暗転で 道の 先へ。
//   noWarp なら ぜんぶ 歩く（ROM専の 行列）。
//   道が なければ（台の うしろの ロゼ・シヨ、キリコが ふさぐ 細道の 先）、キリコ 以外は いちばん せまい すきまを
//   とびこえる（近ければ 弧を えがいて とぶ。遠ければ 映らない うちに 置きなおす。engine/longWalk.ts の hopRoute）。
// - 村の 地図には 街の 人通り（ui/villageCrowd.ts。町の 段と 時刻で 流れが かわる）。通行人は すりぬけられる。
// - start() は 村を出ると（もぐる・冒険に　もどる・リプレイ）VillageExit で 解決する。
//   冒険（Play）と 同じ canvas・入力を使うので、出る前に rAF を止めて タップの受け口を外す。

import { type Dir8, DX, DY, isDiagonal } from "../core/geom";
import type { DungeonId, Objective } from "../core/types";
import { nowHour, today } from "../data/calendar";
import { CAST, KIRIKO, KIRIKO_WALK } from "../data/cast";
import type { KirikoMode, Speaker } from "../data/quotes";
import { pedRoute } from "../data/village/crowd";
import { type Facility, facilityOfMap } from "../data/village/facilities";
import { exitFor, VILLAGE_SPOTS } from "../data/village/map";
import { isRoom, type RoomId } from "../data/village/rooms";
import { TROLLEY_CART } from "../data/village/trolley";
import { preloadImages } from "../engine/assets";
import type {
	EventDef,
	SayOptions,
	Script,
	Story,
	VillageExit,
	VState,
} from "../engine/defs";
import { Actor, Field } from "../engine/field";
import { dir4Candidates } from "../engine/input";
import {
	findRoute,
	hopRoute,
	mayWarp,
	type Open,
	type Seen,
	type WalkStep,
	walkRoute,
} from "../engine/longWalk";
import { loadProgress } from "../engine/save";
import type { Screen } from "../engine/screen";
import { settings } from "../engine/settings";
import {
	clamp,
	DIR_VEC,
	type Dir,
	OPPOSITE,
	sleep,
	TILE,
} from "../engine/types";
import { showBootTitle } from "./boot";
import { buildCafe } from "./cafe";
import type { Ctx } from "./ctx";
import { el, nextFrame } from "./dom";
import { buildFacility } from "./facilities";
import { buildHall } from "./hallEvents";
import type { Hud } from "./hud";
import { ChoiceWindow, MessageWindow, type PortraitSpec } from "./message";
import { buildRoom } from "./rooms";
import { Crowd } from "./villageCrowd";
import { buildVillage, departAnywhere, villageMenu } from "./villageEvents";
import { villageView } from "./villageReturn";

/** 1マス歩く ms（rpg と同じ）。うろうろする人は この 1.6倍。 */
const WALK_MS = 170;
/** ダッシュで 歩く 速さ（WALK_MS の 何倍か）。 */
const DASH_SPEED = 2.5;
/**
 * タップした 道が これより 長ければ 走る（着く 2歩 手前で 歩きに もどる）。
 * 押しっぱなしで ひとりでに 走りだすのは やめた（作者「キモい」）。走るのは ダッシュを 押しながら。
 */
const RUN_PATH = 8;
/** 1文字あたりの ms（rpg の既定と同じ）。 */
const TEXT_MS = 28;
/** 場面で 人を とばす とき、画面の はしから これだけ（マス）外までは 映る ことに する（歩く 絵は マスより 大きい）。 */
const SEEN_MARGIN = 2;
/** カメラが ついていく 人を 道の 先へ とばす 暗転の ms（片道）。 */
const CUT_FADE_MS = 200;
/** 道の ない すきまを 弧を えがいて とびこえるのは これだけ（マス）まで（台・キリコの 1マス ごし）。 */
const HOP_JUMP = 2;
/** とびこえる のに かける ms（これより 短くは しない。歩く 速さで 1マス ぶんずつ）。 */
const JUMP_MS = 320;

/**
 * 保守トロッコ（data/village/trolley.ts）の 速さ：かかる ms は RIDE_BASE_MS ＋ 1マス RIDE_STEP_MS
 * （遠い 乗り場でも 2秒 ほど）。1マスは RIDE_MIN_MS〜RIDE_MAX_MS。
 */
const RIDE_BASE_MS = 600;
const RIDE_STEP_MS = 16;
const RIDE_MIN_MS = 20;
const RIDE_MAX_MS = 60;

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
type MapId = "village" | "hall" | RoomId | `f_${string}`;

export class Village {
	private readonly ctx: Ctx;
	private readonly screen: Screen;
	private readonly hud: Hud;
	private readonly msg: MessageWindow;
	private readonly choice: ChoiceWindow;
	private readonly fadeEl: HTMLDivElement;
	private readonly toastEl: HTMLDivElement;
	private field: Field | null = null;
	/** 街の 人通り（村の 地図だけ。ui/villageCrowd.ts）。 */
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
	/** タップした 道が 長い（走る）。 */
	private pathRun = false;
	private marker: { x: number; y: number; t: number } | null = null;
	/** まだ 1度も もぐっていない（村の 出口に 矢印を 出す。はじめての 人が 出口を さがさないように）。 */
	private guideExit = false;
	private time = 0;
	private last = 0;
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
			const c = await showBootTitle(this.ctx);
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
		// 持ち帰ったときは 終わりの札の 曲（ending）のまま。語りの あとで 村の曲へ（ui/villageReturn.ts）
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
							: buildVillage(v, this.ctx, { arrival: this.arrival });
		this.field?.dispose();
		const field = new Field(def);
		this.field = field;
		this.player = new Actor(
			"player",
			spot.x,
			spot.y,
			spot.dir,
			KIRIKO_WALK,
			null,
		);
		this.player.through = false;
		this.syncState();
		this.crowd = null;
		this.refreshActors();
		this.crowd = def.crowd ? this.makeCrowd(field, def.crowd) : null;
		this.stepPending = false;
		this.path = [];
		this.pathTalk = null;
		this.marker = null;
		const refs = [
			...field.imageRefs(),
			...field.actors.map((a) => a.sprite),
			...(this.crowd ? Crowd.sprites() : []),
			this.player.sprite,
		];
		await Promise.race([preloadImages(refs.filter(Boolean)), sleep(2500)]);
		this.updateCamera();
	}

	/** 町の段・開いたダンジョンを 読み直して 建て直す（キリコは 同じマスのまま）。暗転の中で呼ぶ。 */
	async rebuild(): Promise<void> {
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

	/** 街の 人通り（data/village/crowd.ts の 流れで 人を 歩かせる。ui/villageCrowd.ts）。 */
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
			// 窓が 開いている あいだ（会話・選択肢）は 歩きださない
			paused: () => this.ctx.input.busy || this.leaving,
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
		this.rafId = requestAnimationFrame((tt) => this.frame(tt));
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
					// 元の位置から 2マスより 離れない。キリコの 行き先にも 入らない
					const home = a.def;
					if (
						Math.abs(nx - home.x) <= 2 &&
						Math.abs(ny - home.y) <= 2 &&
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
		if (this.idle && !this.player.moving) this.control();
		this.updateCamera(dt);
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
			this.stepToward(dir);
			return;
		}
		// 画面を 押さえつづけたら、指の方へ 歩きつづける
		const hold = input.fieldHold();
		if (hold) {
			this.clearPath();
			const d = input.fieldHoldDir((x, y) => this.dirFromScreen(x, y));
			if (d !== null) this.stepToward(d);
			return;
		}
		if (this.path.length) {
			const d = this.path.shift() as Dir;
			const v = DIR_VEC[d];
			if (
				!field.canEnter(this.player.x + v.dx, this.player.y + v.dy, this.player)
			) {
				// 人が 前に 来た：その場で 道を 引き直す（だめなら あきらめる）
				const goal = this.marker;
				const talk = this.pathTalk;
				this.clearPath();
				this.player.dir = d;
				if (goal) this.walkTo(goal.x, goal.y, talk);
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
			this.talkFront();
		}
	}

	private clearPath(): void {
		this.path = [];
		this.pathTalk = null;
		this.marker = null;
	}

	/** 8方向の入力で 1歩（4方向。斜めは 縦 → 横の順に 試す。どちらも だめなら 向くだけ）。 */
	private stepToward(d8: Dir8): void {
		const field = this.field;
		if (!field) return;
		const tries = dir4Candidates(d8);
		for (const d of tries) {
			const v = DIR_VEC[d];
			if (
				field.canEnter(this.player.x + v.dx, this.player.y + v.dy, this.player)
			) {
				void this.tryStep(d);
				return;
			}
		}
		// つっかえたら 向くだけ（横へ ずれて 回りこまない。物の 前で そちらを 向いて 調べたい）
		// 人に ぶつかっても その 人は よけない（作者「逃げるのは やめて」）
		this.player.dir = tries[0];
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
	 * いちばん せまい すきまを とびこえる 道に する（engine/longWalk.ts の hopRoute。前は 動かず 遠くから 話した）。
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

	/**
	 * 保守トロッコ（Story.ride）：トロッコに 乗って (x, y) まで 道なりに 速く 走る。人は すりぬけ、扉・口は 踏まない
	 * （曲がるのが 少ない 道。data/village/crowd.ts の pedRoute）。着く マスに 人が いれば となりの あいている マスへ。
	 * 道が なければ 短い 暗転で 置きなおす。カメラは キリコに ついていく。
	 */
	private async ride(x: number, y: number): Promise<void> {
		const field = this.field;
		const me = this.player;
		if (!field) return;
		const free = (cx: number, cy: number) =>
			field.canEnter(cx, cy, me) && !this.touchAt(cx, cy);
		const goal: [number, number] = free(x, y)
			? [x, y]
			: ((["down", "left", "right", "up"] as Dir[])
					.map((d): [number, number] => [x + DIR_VEC[d].dx, y + DIR_VEC[d].dy])
					.find(([cx, cy]) => free(cx, cy)) ?? [x, y]);
		const route = pedRoute(
			field.w,
			field.h,
			(cx, cy) =>
				field.tileAt(cx, cy).passable && !this.touchAt(cx, cy)
					? 1
					: Number.POSITIVE_INFINITY,
			[me.x, me.y],
			goal,
		);
		if (!route) {
			await this.cutWalk(me, goal[0], goal[1]);
		} else if (route.length) {
			const ms = clamp(
				(RIDE_BASE_MS + RIDE_STEP_MS * route.length) / route.length,
				RIDE_MIN_MS,
				RIDE_MAX_MS,
			);
			me.vehicle = TROLLEY_CART;
			try {
				for (const d of route) await me.walk(d, ms);
			} finally {
				me.vehicle = null;
			}
		}
		me.dir = "down";
		this.syncState();
	}

	/** トロッコで 走っている ときの 風の 線（うしろへ 3本）。 */
	private drawSpeedLines(
		g: CanvasRenderingContext2D,
		ox: number,
		oy: number,
	): void {
		const me = this.player;
		const v = DIR_VEC[me.dir];
		const cx = me.fx * TILE + TILE / 2 - ox;
		const cy = me.fy * TILE + TILE / 2 - oy;
		g.fillStyle = "rgba(255,255,255,0.75)";
		for (const [k, off] of [
			[0, -4],
			[1, 0],
			[2, 4],
		] as const) {
			const len = 5 + ((Math.floor(this.time / 60) + k) % 3) * 2;
			// うしろへ のびる 線（横に 走れば 横の 線、縦なら 縦の 線）
			const bx = cx - v.dx * (TILE / 2 + 2) - (v.dx > 0 ? len : 0);
			const by = cy - v.dy * (TILE / 2 + 2) - (v.dy > 0 ? len : 0);
			if (v.dx !== 0)
				g.fillRect(Math.round(bx), Math.round(by + off + 2), len, 1);
			else g.fillRect(Math.round(bx + off), Math.round(by), 1, len);
		}
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
		let talk = talkAt(tx, ty);
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
		const path = this.route(tx, ty, talk, avoid) ?? this.route(tx, ty, talk);
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
					: field.findPath(me.x, me.y, sx, sy, me, false, avoid);
				if (p && (!path || p.length < path.length)) path = p;
			}
		}
		// 立てる マスが 無ければ、相手の となりの どこかまで
		return path ?? field.findPath(me.x, me.y, tx, ty, me, noBack, avoid);
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
		const actors = [...field.actors, this.player].sort((a, b) => a.fy - b.fy);
		for (const a of actors) a.draw(g, ox, oy, this.time);
		field.drawAbove(g, ox, oy);
		// 掲示板・木などの 裏に ほとんど隠れた 人は 薄く見せる（キリコも 村の人も）。
		// 向きの ない 絵（置物・看板）は 地形の 一部なので 透かさない
		field.drawHidden(
			g,
			actors.filter((a) => a === this.player || !a.still),
			ox,
			oy,
			this.time,
		);
		field.def.decor?.(g, ox, oy, this.time);
		if (this.player.vehicle && this.player.moving)
			this.drawSpeedLines(g, ox, oy);
		if (this.guideExit && this.mapId === "village")
			this.drawExitGuide(g, ox, oy, this.scene);
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

	private async runEvent(e: EventDef): Promise<void> {
		// ほかのスクリプトが 動いている間は 始めない（二重起動の防止）
		if (!e.run || this.scriptDepth > 0 || this.leaving) return;
		const run = e.run;
		// 扉で 地図が かわっても、印は 始めた 地図に つける
		const map = this.mapId;
		await this.runScript(async (s) => {
			await run(s);
			if (e.once) this.state.flags[this.flagKey("done", e.id, map)] = true;
		});
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
		// 声の ある 人（data/cast.ts の voice・MOB_VOICE）だけ 読み上げる（ボイスが ON のとき。rpg の Game.say と 同じ）
		const voice = opt.tts ?? c?.voice;
		return this.msg.show({
			name: opt.name ?? c?.label ?? c?.name,
			color: opt.color ?? c?.color,
			text,
			onShow:
				voice && settings.voice
					? (leadMs) => this.ctx.audio.speak(text, voice, leadMs)
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
	private sayKiriko(text: string, mode: KirikoMode): Promise<void> {
		const voice = mode === "voice" ? KIRIKO.voice : undefined;
		return this.msg.show({
			name: KIRIKO.name,
			color: KIRIKO.color,
			text: mode === "think" ? `（${text}）` : text,
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

	/** Story API（イベントの スクリプトから 使う 命令）。 */
	private readonly story: Story = this.makeStory();

	private makeStory(): Story {
		const v = this;
		return {
			get state(): VState {
				return v.state;
			},
			say: async (who, text, opt) => {
				// 名前を かえた 声（住人・来客）は 声の 持ち主が 話す 人では ないので 見ない
				if (who && !opt?.name) await this.showSpeaker(who);
				return this.say(who, text, opt);
			},
			narrate: (text) => this.say(null, text),
			kiriko: (text, mode) => this.sayKiriko(text, mode),
			choose: (options, opt) =>
				this.choice.choose(
					options,
					opt?.cancel,
					(name) => this.ctx.audio.se(name),
					opt?.start,
				),
			wait: (ms) => {
				// 窓と 立ち絵を 片付ける（一覧・歩く 場面の 前に。立ち絵が 人を 隠さないように）
				this.msg.close();
				return sleep(ms);
			},
			fadeOut: (ms) => this.fadeOut(ms),
			fadeIn: (ms) => this.fadeIn(ms),
			bgm: (name) => this.ctx.audio.bgm(name),
			fadeBgm: (ms) => this.ctx.audio.fadeBgm(ms),
			se: (name) => this.ctx.audio.se(name),
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
			toast: (text) => this.toast(text),
			rebuild: () => this.rebuild(),
			warp: (map, x, y, dir) =>
				this.warp(map, { x, y, dir: dir ?? this.player.dir }),
			ride: (x, y) => this.ride(x, y),
			exit: (choice) => {
				this.exitChoice = choice;
			},
		};
	}
}
