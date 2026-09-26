// 歩ける村（保守村）。ダンジョンの外で キリコが 歩きまわる 1枚のマップ。
// rpg の engine/game.ts（Game）から、戦闘・仲間・隊列・セーブを のぞいて 移したもの。
//
// - 4方向で 1マスずつ歩く（十字キー・キーボード。斜めは 縦を先に 試して、だめなら 横へ すべる）。
//   画面を タップすると そこまで 歩く（人・看板なら 前まで行って 話す。カウンターの 向こうの人も。
//   ダンジョンの口を タップすれば 口まで 歩いて もぐるか きく。前に 人が 立って ふさいでいる口なら その人と 話す）。
//   画面を 押さえつづけると 指の方へ 歩きつづける。
// - A で 目の前の 人・物を 調べる（カウンター越しも）。B・☰ で 村の メニュー（ui/villageEvents.ts）。
// - まだ 聞いていない 新しい話が ある人の 頭の上に「！」（EventDef.notice。スクリプトの あとに 見なおす）。
// - 窓（会話・選択肢・メニュー）が 開いている間は 歩かない（input.busy）。
// - 入るたびに onEnter（帰ってきた場面・開いた知らせ・持ち帰った物。ui/villageReturn.ts）。その間は 歩かない・
//   うろうろ しない・「！」を 出さない（scene）。場面では カメラを 人や 建物に 向ける（look）。
// - start() は 村を出ると（もぐる・つづきから・リプレイ）VillageExit で 解決する。
//   冒険（Play）と 同じ canvas・入力を使うので、出る前に rAF を止めて タップの受け口を外す。

import type { Dir8 } from "../core/geom";
import type { DungeonId } from "../core/types";
import { CAST, KIRIKO_WALK } from "../data/cast";
import type { Speaker } from "../data/quotes";
import { VILLAGE_SPOTS } from "../data/village/map";
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
import type { Screen } from "../engine/screen";
import {
	clamp,
	DIR_VEC,
	type Dir,
	OPPOSITE,
	sleep,
	TILE,
} from "../engine/types";
import { showBootTitle } from "./boot";
import type { Ctx } from "./ctx";
import { el, nextFrame } from "./dom";
import type { Hud } from "./hud";
import { ChoiceWindow, MessageWindow, type PortraitSpec } from "./message";
import { buildVillage, villageMenu } from "./villageEvents";
import { villageView } from "./villageReturn";

/** 1マス歩く ms（rpg と同じ）。うろうろする人は この 1.6倍。 */
const WALK_MS = 170;
/** 1文字あたりの ms（rpg の既定と同じ）。 */
const TEXT_MS = 28;

/** 冒険から どう もどってきたか（村での 立ち位置と、入ったときの 場面を 決める）。 */
export type Arrival =
	| { kind: "clear" | "escape" | "dead"; dungeon: DungeonId }
	| { kind: "suspend" }
	| { kind: "replay" }
	| null;

type Spot = { x: number; y: number; dir: Dir };

export class Village {
	private readonly ctx: Ctx;
	private readonly screen: Screen;
	private readonly hud: Hud;
	private readonly msg: MessageWindow;
	private readonly choice: ChoiceWindow;
	private readonly fadeEl: HTMLDivElement;
	private readonly toastEl: HTMLDivElement;
	private field: Field | null = null;
	private player = new Actor("player", 0, 0, "down", KIRIKO_WALK, null);
	/** キリコの位置と その場かぎりの印（村を 出ても 残す。ページを 閉じれば 消える）。 */
	private state: VState = { x: 0, y: 0, dir: "down", flags: {} };
	private scriptDepth = 0;
	/** 操作で歩き始めた1歩が まだ着いていない（着いたら 踏むイベントを 調べる）。 */
	private stepPending = false;
	private path: Dir[] = [];
	private pathTalk: Actor | null = null;
	private marker: { x: number; y: number; t: number } | null = null;
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
	/** カメラを なめらかに 動かしている（見る先を かえてから キリコに もどりきるまで）。 */
	private easing = false;
	/** 入ったときの 場面の 最中（歩かない・うろうろ しない・「！」を 出さない）。 */
	private scene = false;
	private running = false;
	private rafId = 0;
	private arrival: Arrival = null;
	/** 村を出ると 決まった（いちばん外の スクリプトが 終わったら 出る）。 */
	private exitChoice: VillageExit | null = null;
	private leaving = false;
	private resolveStart: ((c: VillageExit) => void) | null = null;
	/** 最後に 立っていた マス（リプレイを 見て もどったとき）。 */
	private lastSpot: Spot | null = null;
	/** 頭の上に「！」を出す人（まだ 聞いていない 新しい話が ある。スクリプトの あとに 見なおす）。 */
	private noticed = new Set<string>();

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
	 * 村に入る。boot なら 起動の札（はじめる／つづきから）を 重ねる。
	 * 村を出ると（もぐる・つづきから・リプレイ）その行き先で 解決する。
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
		this.easing = false;
		this.fadeEl.style.transition = "none";
		this.fadeEl.style.opacity = "1";
		await this.build(this.spotFor(o.arrival));
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
		// 口の中から 出てくる（onEnter で 1歩 下へ）。まだ 開いていない口（開発用の 冒険など）は
		// ふさがっていて 出られないので 蓄音機の前
		if (
			(a.kind === "clear" || a.kind === "escape") &&
			villageView().unlocked.includes(a.dungeon)
		) {
			const [mx, my] = VILLAGE_SPOTS.mouth[a.dungeon];
			return { x: mx, y: my, dir: "down" };
		}
		if (a.kind === "replay") return this.lastSpot ?? boot;
		return boot;
	}

	/** 地図を 組み立てて キリコを 置く（画像も 先に読む。読めなくても 進む）。 */
	private async build(spot: Spot): Promise<void> {
		const def = buildVillage(villageView(), this.ctx, {
			arrival: this.arrival,
		});
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
		this.refreshActors();
		this.stepPending = false;
		this.path = [];
		this.pathTalk = null;
		this.marker = null;
		const refs = [
			...field.imageRefs(),
			...field.actors.map((a) => a.sprite),
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
		this.toastEl.classList.remove("shown");
		this.lastSpot = {
			x: this.player.x,
			y: this.player.y,
			dir: this.player.dir,
		};
		this.field?.dispose();
		this.field = null;
		// 冒険の画面に 村が 一瞬 見えないよう、黒く ぬってから 幕を あげる（冒険は 自分の 幕を 持っている）
		const g = this.screen.begin();
		g.fillStyle = "#000";
		g.fillRect(0, 0, this.screen.width, this.screen.height);
		this.fadeEl.style.transition = "none";
		this.fadeEl.style.opacity = "0";
	}

	// ───────────────── イベント ─────────────────

	private eventActive(e: EventDef): boolean {
		const f = this.state.flags;
		if (e.once && f[`done:village:${e.id}`]) return false;
		if (f[`hide:village:${e.id}`]) return false;
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
		field.actors = keep;
		this.noticed = new Set(
			keep.filter((a) => a.def?.notice?.()).map((a) => a.id),
		);
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
			void this.tryStep(d);
			return;
		}
		if (this.pathTalk) {
			const target = this.pathTalk;
			this.pathTalk = null;
			this.marker = null;
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
		this.player.dir = tries[0];
	}

	/**
	 * 場面で 人を 歩かせる 道（幅優先）。地形だけを 見て、ほかの人は すりぬける（場面の 人どうしが
	 * ふさぎあわないように）。キリコの マスは よける。
	 */
	private routeTo(a: Actor, tx: number, ty: number): Dir[] | null {
		const field = this.field;
		if (!field?.inBounds(tx, ty)) return null;
		const me = this.player;
		const key = (x: number, y: number) => y * field.w + x;
		const prev = new Map<number, { k: number; d: Dir } | null>();
		prev.set(key(a.x, a.y), null);
		const queue: [number, number][] = [[a.x, a.y]];
		for (let head = 0; head < queue.length; head++) {
			const [x, y] = queue[head];
			if (x === tx && y === ty) {
				const route: Dir[] = [];
				let cur = prev.get(key(x, y));
				while (cur) {
					route.push(cur.d);
					cur = prev.get(cur.k) ?? null;
				}
				return route.reverse();
			}
			for (const d of ["up", "right", "down", "left"] as Dir[]) {
				const nx = x + DIR_VEC[d].dx;
				const ny = y + DIR_VEC[d].dy;
				const k = key(nx, ny);
				if (prev.has(k) || !field.tileAt(nx, ny).passable) continue;
				if (a !== me && nx === me.x && ny === me.y) continue;
				prev.set(k, { k: key(x, y), d });
				queue.push([nx, ny]);
			}
		}
		return null;
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

	/** キリコを 1歩 進める（通れなければ 向きだけ 変える）。 */
	private async tryStep(d: Dir): Promise<void> {
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
		await this.player.walk(d, WALK_MS);
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
		if (!target && field.tileAt(tx, ty).counter) {
			tx += v.dx;
			ty += v.dy;
			target = talkAt(tx, ty);
		}
		if (!target?.def?.run) return;
		if (!target.def.fixedDir && !target.still)
			target.dir = OPPOSITE[this.player.dir];
		// 話しはじめたら「！」は 消す（話し終わったら 見なおす）
		if (this.idle) this.noticed.delete(target.id);
		void this.runEvent(target.def);
	}

	/** x・y は canvas の左上から数えた CSS 画素。 */
	private onTap(x: number, y: number): void {
		const field = this.field;
		if (!field || !this.idle) return;
		const p = this.screen.cssToSource(x, y);
		const tx = Math.floor((p.x + this.camX) / TILE);
		let ty = Math.floor((p.y + this.camY) / TILE);
		if (!field.inBounds(tx, ty)) return;
		const talkAt = (x: number, y: number) =>
			field.actors.find(
				(a) => a.x === x && a.y === y && a.def?.trigger === "talk" && a.visible,
			) ?? null;
		let talk = talkAt(tx, ty);
		// 前に 人が 立って ふさいでいる 口（本編が 開くまでの おんJ民）を タップしたら、その人に 話しかける
		if (!talk && this.touchAt(tx, ty)) {
			const guard = talkAt(tx, ty + 1);
			if (guard && !guard.through) {
				ty += 1;
				talk = guard;
			}
		}
		// となりの人・物を タップしたら、そちらを向いて 話す
		if (
			talk &&
			Math.abs(tx - this.player.x) + Math.abs(ty - this.player.y) === 1
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
	 * もぐるか きかれないように）。
	 */
	private walkTo(tx: number, ty: number, talk: Actor | null): void {
		const field = this.field;
		if (!field) return;
		const me = this.player;
		let path: Dir[] | null = null;
		if (talk) {
			for (const d of ["up", "down", "left", "right"] as Dir[]) {
				let sx = tx + DIR_VEC[d].dx;
				let sy = ty + DIR_VEC[d].dy;
				if (field.tileAt(sx, sy).counter) {
					sx += DIR_VEC[d].dx;
					sy += DIR_VEC[d].dy;
				}
				const here = sx === me.x && sy === me.y;
				if (!here && (!field.canEnter(sx, sy, me) || this.touchAt(sx, sy)))
					continue;
				const p = here ? [] : field.findPath(me.x, me.y, sx, sy, me);
				if (p && (!path || p.length < path.length)) path = p;
			}
		}
		// 立てる マスが 無ければ、相手の となりの どこかまで
		path ??= field.findPath(me.x, me.y, tx, ty, me);
		if (!path) return;
		this.path = path;
		this.pathTalk = talk;
		this.marker = path.length ? { x: tx, y: ty, t: this.time } : null;
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
	 * 見る先を かえたら dt ごとに なめらかに 寄せる（キリコに もどりきったら また ぴったり ついていく）。
	 */
	private updateCamera(dt = 0): void {
		const field = this.field;
		if (!field) return;
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
		const f = this.focus();
		const cx = f.fx * TILE + TILE / 2 - w / 2;
		const cy = f.fy * TILE + TILE / 2 - hv / 2;
		const tx = mw <= w ? (mw - w) / 2 : clamp(cx, 0, mw - w);
		const ty = mh + topPad <= hv ? -(hv - mh) / 2 : clamp(cy, -topPad, mh - hv);
		if (!this.easing) {
			this.camFX = tx;
			this.camFY = ty;
		} else if (dt > 0) {
			const k = 1 - Math.exp(-dt / 110);
			this.camFX += (tx - this.camFX) * k;
			this.camFY += (ty - this.camFY) * k;
			if (Math.abs(tx - this.camFX) < 0.5 && Math.abs(ty - this.camFY) < 0.5) {
				this.camFX = tx;
				this.camFY = ty;
				if (this.lookAt === null) this.easing = false;
			}
		}
		this.camX = sc.snap(this.camFX);
		this.camY = sc.snap(this.camFY);
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
		field.def.decor?.(g, ox, oy, this.time);
		if (!this.scene)
			for (const a of field.actors)
				if (a.visible && this.noticed.has(a.id)) this.drawNotice(g, a, ox, oy);
	}

	/** 頭の上の「！」（白い ふきだしに 赤い！。ゆっくり 上下に ゆれる）。 */
	private drawNotice(
		g: CanvasRenderingContext2D,
		a: Actor,
		ox: number,
		oy: number,
	): void {
		const bob = Math.sin(this.time / 240) > 0 ? 0 : 1;
		const x = Math.round(a.fx * TILE - ox) + 5;
		const y = Math.round(a.fy * TILE - oy) - 12 + bob;
		g.fillStyle = "#000";
		g.fillRect(x - 1, y - 1, 8, 12);
		g.fillStyle = "#fff";
		g.fillRect(x, y, 6, 10);
		g.fillStyle = "#e0303a";
		g.fillRect(x + 2, y + 1, 2, 5);
		g.fillRect(x + 2, y + 7, 2, 2);
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
		await this.runScript(async (s) => {
			await run(s);
			if (e.once) this.state.flags[`done:village:${e.id}`] = true;
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
		if (this.lookAt !== null) {
			this.lookAt = null;
			this.easing = true;
		}
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
		return this.msg.show({
			name: opt.name ?? c?.name,
			color: c?.color,
			text,
			portrait: opt.noPortrait || !who ? null : this.portraitOf(who),
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
			say: (who, text, opt) => this.say(who, text, opt),
			narrate: (text) => this.say(null, text),
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
				const route = a ? this.routeTo(a, x, y) : null;
				if (!a || !route) {
					console.warn(`[goto] ${target} は (${x},${y}) へ 行けません`);
					return;
				}
				const ms = WALK_MS / (opt?.speed ?? 1);
				for (const d of route) await a.walk(d, ms);
				if (a === this.player) this.syncState();
			},
			look: async (target, opt) => {
				this.lookAt = target;
				if (opt?.instant) {
					this.easing = false;
					this.updateCamera();
					this.easing = target !== null;
					return;
				}
				this.easing = true;
				await sleep(450);
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
				delete this.state.flags[`hide:village:${id}`];
				this.refreshActors();
			},
			hide: (id) => {
				if (id === "player") {
					this.player.visible = false;
					return;
				}
				this.state.flags[`hide:village:${id}`] = true;
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
			exit: (choice) => {
				this.exitChoice = choice;
			},
		};
	}
}
