// ダンジョンの画面：入力 → run.act → 出来事の演出 → 描画 をまわす。
//
// - core の状態は1回の act で一気に変わる。画面は出来事（GameEvent）を順に再生して、
//   キャラの表示位置（Disp）を動かしていく。再生が終わったら状態に合わせなおす。
// - 押しっぱなしで歩き続ける（トルネコと同じ）。キーボードは斜めの同時押しを少し待つ。
// - ダッシュ・タップ移動は、何かあったら止まる（敵が見えた・道具・階段・分かれ道・部屋の出入り）。

import { HUNGER_UNIT } from "../core/balance";
import {
	DIRS8,
	type Dir8,
	dirOf,
	dist,
	isDiagonal,
	type Pos,
	step,
} from "../core/geom";
import { defOf } from "../core/item";
import { isFloor, roomAt } from "../core/mapgen";
import { mdef } from "../core/monster";
import { digest, parseReplay, type ReplayStep } from "../core/replay";
import type { Run } from "../core/run";
import {
	type Command,
	type Floor,
	type GameEvent,
	PLAYER_ID,
	type RunState,
} from "../core/types";
import { loadImage } from "../engine/assets";
import {
	DEBUG_SEED,
	loadBook,
	markSeenMonster,
	type SavedReplay,
	saveRun,
} from "../engine/save";
import type { Screen } from "../engine/screen";
import { settings } from "../engine/settings";
import { TILE } from "../engine/types";
import type { Ctx } from "./ctx";
import { el, nextFrame } from "./dom";
import { hpInk } from "./hpInk";
import type { Hud } from "./hud";
import { itemIcon } from "./icons";
import { esc } from "./itemText";
import { listWindow } from "./list";
import {
	type MenuAction,
	openFootMenu,
	openInventory,
	openMainMenu,
	pickItem,
} from "./menu";
import { showRunEnd } from "./records";
import {
	drawMap,
	type Figure,
	FloorView,
	GRAVE,
	mapTileAt,
	type Projectile,
} from "./render";
import { openSettings } from "./settings";
import { zoneFor } from "./theme";

const KIRIKO = "pub:sprites/kiriko.png";
/** 武器を振る長さ（振りかぶる → ななめ → 前 の3つの形）。 */
const SWING_MS = 180;
/** 長押しの足踏みの間（ms。1秒に 10回ほど）。 */
const REST_GAP_MS = 100;
/** 敵が ふえるとき、もとの マスから 分かれ出る 時間（ms）。 */
const SPLIT_MS = 260;
/**
 * ログの1行ごとの 最短の間（ms）。1ターンに いくつも起きたとき、行が 一度に 流れて 読めないように
 * （トルネコ1の メッセージ窓のように 1行ずつ 送る。そのあいだ 出来事の再生も 待つ）。
 */
const LOG_GAP_MS = { normal: 350, fast: 180, replay: 40 } as const;

type Disp = Figure & {
	/** 行き先（マス）。 */
	tx: number;
	ty: number;
	/**
	 * 動きの道のり：通るマスと、そこに着く時刻。この間を線でつなぐ。
	 * 倍速の2歩は2つの点になる（角をすり抜けて見えないように）。
	 * 押しっぱなしで歩くときは、次の1歩を後ろに足す（止まって見える絵をはさまない）。
	 */
	keys: { x: number; y: number; t: number }[];
	lungeT0: number;
	fadeT0: number;
	dying: boolean;
};

/** 祭り（モンスターハウス）の曲。名無し155さんの アップテンポな曲（オクターブを直した版）。 */
const HOUSE_BGM = "retro2";

/** 階ごとの BGM（層ごとに変わる。帰り道は原盤を持ち帰る曲）。 */
const floorBgm = (run: Run): string => {
	if (run.f.houseAwake) return HOUSE_BGM;
	if (run.s.returning) return "title";
	return zoneFor(run.s.dungeon, run.s.depth).bgm;
};

export class Play {
	private run: Run;
	private readonly ctx: Ctx;
	private readonly screen: Screen;
	private readonly hud: Hud;
	private view = new FloorView();
	private disp = new Map<number, Disp>();
	private projectiles: Projectile[] = [];
	private camX = 0;
	private camY = 0;
	private busy = false;
	/** キリコが 眠っていると 見せる（sleep の 出来事を 流している あいだ）。 */
	private sleepShown = false;
	private raf = 0;
	private stopped = false;
	private logEl: HTMLElement;
	/** 最後に ログの行を 出した時刻（performance.now()）。 */
	private lastLogAt = 0;
	/**
	 * まだ 出していない ログの行（1行ずつ 間を空けて 出す）。出すのを 待っても 歩きは 止めない
	 * （待つと 行が 出るたびに 次の 1歩が つっかかった）。
	 */
	private logQueue: { text: string; tone?: "warn" | "good"; fast: boolean }[] =
		[];
	private logTimer = 0;
	private popsEl: HTMLElement;
	private mapEl: HTMLCanvasElement;
	private mapOn = false;
	private fadeEl: HTMLElement;
	private lastStepAt = 0;
	private lastSavedTurn = -1;
	private resolveEnd: (() => void) | null = null;
	/** タップ移動の行き先。 */
	private travel: Pos | null = null;
	/**
	 * 出来事を流しているあいだ、まだ映している前の階（落とし穴・地震で 下の階へ 移っても、
	 * 階の札が出るまでは 前の階のまま見せる）。落ちなかったときは null。
	 */
	private shownFloor: Floor | null = null;
	/** 長押しの足踏みを 止めている（指を離すまで）。 */
	private restHalt = false;
	/** 押さえて歩くのを 止めている（傷ついた。指を離すか 押しなおすまで）。 */
	private walkHalt = false;
	/**
	 * この階で もう 見た敵（uid）。長押しの 足踏みを 止めるのは、はじめて 見えた敵だけ
	 * （見えていた敵が 暗い通路・入口の 外へ 出て また 見えただけでは 止めない。同時に 動く敵で 止まりつづけた）。
	 */
	private spotted = new Set<number>();
	private spottedOn: Floor | null = null;
	/** 自動で歩きだしたときの 入力の番号（そのあと 何かに さわったら 止める）。 */
	private autoSerial = -1;
	/** 地図で タップして選んだ 行き先（閉じる前に 一瞬 光らせる）。 */
	private mapMark: Pos | null = null;
	/** 途中で止まった 自動の歩きの 行き先（地図に 印を出し、そこを タップすれば 続きを 歩く）。 */
	private lastTravel: Pos | null = null;
	/** 向きを変えたあと、方向がはなされるのを待っている。 */
	private waitRelease = false;
	/** 食べる・飲む・読むときに キリコの頭の上に出す道具。 */
	private useFx: UseFx | null = null;
	/** 倒れた所に立てる墓（倒れたときの演出）。 */
	private grave: { x: number; y: number; t0: number } | null = null;
	/** 倒れたときの「キリコは たおれた」の画面（途中で閉じたときに消すため）。 */
	private deathEl: HTMLElement | null = null;
	/** 図鑑に載っている敵（毎フレーム保存を読まないように覚えておく）。 */
	private bookSeen = new Set(loadBook().seen);
	private statusKey = "";
	/** リプレイを見ているとき（入力の代わりに 記録のコマンドを入れる）。 */
	private rp: ReplayDriver | null = null;

	constructor(
		run: Run,
		ctx: Ctx,
		screen: Screen,
		hud: Hud,
		opts: { replay?: SavedReplay } = {},
	) {
		this.run = run;
		if (opts.replay) {
			const steps = parseReplay(opts.replay.text);
			this.rp = {
				replay: opts.replay,
				steps,
				i: 0,
				done: 0,
				total: steps.filter((x) => x.kind === "cmd").length,
				paused: false,
				speed: 1,
				nextAt: 0,
				bar: null,
				drift: false,
				skip: false,
			};
		}
		this.ctx = ctx;
		this.screen = screen;
		this.hud = hud;
		this.logEl = el("div", { class: "log" });
		this.popsEl = el("div", { class: "pops" });
		this.mapEl = el("canvas", { class: "mapview" });
		this.fadeEl = el("div", { class: "fade" });
		ctx.ui.append(this.mapEl, this.popsEl, this.logEl, this.fadeEl);
	}

	/** 冒険を始めて、終わる（倒れた・持ち帰った・中断した）まで待つ。 */
	start(): Promise<"end" | "suspend"> {
		return new Promise((resolve) => {
			let suspended = false;
			this.resolveEnd = () => resolve(suspended ? "suspend" : "end");
			this.onSuspend = () => {
				suspended = true;
			};
			// 前の冒険（やめたリプレイ）の色抜けが残っていても消す
			this.screen.canvas.classList.remove("dead");
			this.syncDisp(true);
			void loadImage(GRAVE);
			this.ctx.audio.bgm(floorBgm(this.run));
			if (this.rp) {
				this.ctx.input.onFieldTap = null;
				this.mountReplayBar();
			} else {
				this.ctx.input.onFieldTap = (x, y) => this.onTap(x, y);
				// 遊んだ版を覚える（リプレイを見返すとき、版が変わっていないかを見る）
				const s = this.run.s;
				const builds = s.builds ?? [];
				if (builds[builds.length - 1] !== __CORE_VERSION__)
					s.builds = [...builds, __CORE_VERSION__];
			}
			// 最初の札のあいだは操作を受けない（村で押したキーも捨てる）
			this.ctx.input.clearField();
			this.ctx.input.takeDirPress();
			this.busy = true;
			void this.floorCard(true).finally(() => {
				this.busy = false;
			});
			const frame = (t: number) => {
				if (this.stopped) return;
				this.update(t);
				this.draw(t);
				this.raf = requestAnimationFrame(frame);
			};
			this.raf = requestAnimationFrame(frame);
			document.addEventListener("visibilitychange", this.onHide);
			window.addEventListener("pagehide", this.onHide);
		});
	}

	private onSuspend: () => void = () => {};

	private onHide = (): void => {
		if (document.visibilityState === "hidden" || !document.hasFocus())
			this.save(true);
	};

	private stop(): void {
		this.stopped = true;
		this.logQueue = [];
		clearTimeout(this.logTimer);
		this.ctx.input.fieldHoldEnabled = true;
		this.screen.canvas.classList.remove("dead");
		this.deathEl?.remove();
		this.rp?.bar?.remove();
		this.hud.root.classList.remove("replay", "on-stairs");
		const foot = this.hud.root.querySelector(".mini-foot");
		if (foot) foot.textContent = "足元";
		this.ctx.ui.classList.remove("replaying");
		cancelAnimationFrame(this.raf);
		this.ctx.input.onFieldTap = null;
		document.removeEventListener("visibilitychange", this.onHide);
		window.removeEventListener("pagehide", this.onHide);
		this.logEl.remove();
		this.popsEl.remove();
		this.mapEl.remove();
		this.fadeEl.remove();
		this.hud.status.innerHTML = "";
		this.view.dispose();
		const resolve = this.resolveEnd;
		this.resolveEnd = null;
		resolve?.();
	}

	/** 終わった冒険を もう記録した（演出の途中で タブを隠しても、二度 記録しない）。 */
	private endSaved = false;

	/** 終わった冒険を 一度だけ記録する（saveRun が記録して 中断セーブを消し、町へ 持ち帰る）。 */
	private saveEnd(): void {
		if (this.rp || this.endSaved) return;
		this.endSaved = true;
		saveRun(this.run.s);
	}

	private save(force = false): void {
		if (this.rp) return; // 見ているだけ（保存も記録もしない）
		const s = this.run.s;
		if (s.end) {
			this.saveEnd();
			return;
		}
		if (!force && s.turn - this.lastSavedTurn < 8) return;
		this.lastSavedTurn = s.turn;
		saveRun(s);
	}

	// ───────────────── 表示位置 ─────────────────

	/** 表示位置を状態に合わせる（再生のあと・階が変わったとき）。 */
	private syncDisp(reset = false): void {
		const run = this.run;
		const now = performance.now();
		const keep = new Set<number>([PLAYER_ID]);
		const put = (
			id: number,
			sprite: string,
			x: number,
			y: number,
			dir: Dir8,
		) => {
			keep.add(id);
			const d = this.disp.get(id);
			if (!d || reset) {
				this.disp.set(id, {
					id,
					sprite,
					fx: x,
					fy: y,
					tx: x,
					ty: y,
					keys: [{ x, y, t: 0 }],
					dir,
					lunge: 0,
					lungeT0: 0,
					flashUntil: 0,
					fade: 0,
					fadeT0: 0,
					dying: false,
				});
				return;
			}
			d.sprite = sprite;
			d.dir = dir;
			if (d.tx !== x || d.ty !== y) {
				d.tx = x;
				d.ty = y;
				d.keys = [{ x, y, t: now }];
				d.fx = x;
				d.fy = y;
			}
		};
		put(PLAYER_ID, KIRIKO, run.p.x, run.p.y, run.p.dir);
		for (const m of run.f.monsters) put(m.uid, mdef(m).sprite, m.x, m.y, m.dir);
		for (const id of [...this.disp.keys()]) {
			const d = this.disp.get(id);
			if (!keep.has(id) && d && !d.dying) this.disp.delete(id);
		}
	}

	private update(t: number): void {
		// 先に入力を見る（押しっぱなしの次の1歩を、この絵から動かしはじめる）
		if (!this.busy) {
			if (this.rp) this.replayTick(t);
			else this.control(t);
		}
		for (const d of this.disp.values()) {
			const at = posAt(d.keys, t);
			d.fx = at.x;
			d.fy = at.y;
			const lk = (t - d.lungeT0) / 150;
			d.lunge = lk >= 0 && lk < 1 ? Math.sin(lk * Math.PI) : 0;
			if (d.dying) {
				d.fade = Math.min(1, (t - d.fadeT0) / 320);
				if (d.fade >= 1) this.disp.delete(d.id);
			}
		}
		this.noteSeen();
		this.updateCamera();
		this.updateStatus();
		if (this.mapOn) {
			const vis = this.run.f.monsters.filter(
				(m) => this.run.monsterVisible(m) && !m.disguise,
			);
			drawMap(this.mapEl, this.run.s, {
				visibleMonsters: vis,
				mark: this.mapMark,
				resume: this.lastTravel,
			});
		}
	}

	/** 見えた敵を図鑑に載せる（はじめて会ったときだけ保存する）。 */
	private noteSeen(): void {
		const run = this.run;
		if (run.s.seed.startsWith(DEBUG_SEED) || this.rp) return;
		for (const m of run.f.monsters) {
			if (this.bookSeen.has(m.kind) || m.disguise || !run.monsterVisible(m))
				continue;
			this.bookSeen.add(m.kind);
			markSeenMonster(m.kind);
		}
	}

	private updateCamera(): void {
		const pd = this.disp.get(PLAYER_ID);
		if (!pd) return;
		const sc = this.screen;
		const cssPerSrc = sc.tileCss / TILE;
		// 上のステータス行と下のボタンの間の、まんなかにキリコを置く
		const topCss = 56;
		const bottomCss = document.documentElement.classList.contains(
			"short-landscape",
		)
			? 40
			: 260;
		const hCss = sc.height * cssPerSrc;
		const centerCss = topCss + Math.max(40, hCss - topCss - bottomCss) / 2;
		const cx = pd.fx * TILE + TILE / 2 - sc.width / 2;
		const cy = pd.fy * TILE + TILE / 2 - centerCss / cssPerSrc;
		this.camX = sc.snap(cx);
		this.camY = sc.snap(cy);
	}

	private draw(t: number): void {
		const run = this.run;
		// 落ちている途中は、階の札まで 前の階を キリコの見えている位置から映す（敵は もう いない）
		const shown = this.shownFloor;
		const pd = this.disp.get(PLAYER_ID);
		const s: RunState =
			shown && pd
				? {
						...run.s,
						floor: shown,
						depth: shown.depth,
						player: { ...run.s.player, x: pd.tx, y: pd.ty },
					}
				: run.s;
		const figs: Figure[] = [];
		const fakeItems: { x: number; y: number; kind: string }[] = [];
		for (const d of this.disp.values()) {
			if (d.id === PLAYER_ID) {
				// 装備している武器・盾を重ねて描く。攻撃の踏みこみに合わせて振る
				const k = (t - d.lungeT0) / SWING_MS;
				figs.push({
					...d,
					asleep: this.sleepShown || run.p.status.sleep > 0,
					equip: {
						weapon: run.weapon()?.kind ?? null,
						shield: run.shield()?.kind ?? null,
					},
					swing: k >= 0 && k < 1 ? k : -1,
				});
				continue;
			}
			if (d.dying) {
				figs.push(d);
				continue;
			}
			if (s !== run.s) continue;
			const m = run.f.monsters.find((x) => x.uid === d.id);
			if (!m) continue;
			if (m.disguise) {
				if (run.playerSees(m))
					fakeItems.push({ x: m.x, y: m.y, kind: m.disguise });
				continue;
			}
			if (!run.monsterVisible(m)) continue;
			figs.push({ ...d, asleep: m.status.sleep > 0 || m.status.paralyze > 0 });
		}
		this.view.draw(
			this.screen,
			s,
			run.dungeon.floors,
			figs,
			this.projectiles,
			this.camX,
			this.camY,
			t,
			itemIcon,
			fakeItems,
			{
				strong: this.ctx.input.mods().turn,
				travel: this.travel,
				aim: this.ctx.input.mods().turn ? this.aimLine() : null,
				edge: this.edgeThreats(),
				overhead: this.useFx && overheadPose(this.useFx, t),
				grave: this.grave && {
					x: this.grave.x,
					y: this.grave.y,
					drop: (t - this.grave.t0) / GRAVE_DROP_MS,
				},
			},
		);
	}

	// ───────────────── ステータス行 ─────────────────

	private updateStatus(): void {
		const run = this.run;
		// 矢を装備していれば A の横に「矢」ボタン（のこりの本数つき）
		const arrows = run.arrows();
		const hasArrow = !!arrows && !this.rp;
		if (this.hud.root.classList.contains("has-arrow") !== hasArrow)
			this.hud.root.classList.toggle("has-arrow", hasArrow);
		const count = this.hud.root.querySelector(".btn-shoot small");
		const n = arrows ? String(arrows.count) : "";
		if (count && count.textContent !== n) count.textContent = n;
		// 使える階段の上では、足元ボタンを「階段」にして光らせる（聞かれたのを閉じても 降りられるように）
		const onStairs = this.onUsableStairs() && !this.rp;
		if (this.hud.root.classList.contains("on-stairs") !== onStairs) {
			this.hud.root.classList.toggle("on-stairs", onStairs);
			const foot = this.hud.root.querySelector(".mini-foot");
			// 文字だけ かえる（PC の すみの キーは 残す）
			const label = foot?.firstChild;
			if (label) label.textContent = onStairs ? "階段" : "足元";
		}
		const p = run.p;
		const hunger = Math.ceil(p.hunger / HUNGER_UNIT);
		const left = run.s.returning ? -1 : run.cardsLeft();
		const st = p.status;
		const badges = [
			st.sleep > 0 ? "眠り" : "",
			st.confuse > 0 ? "混乱" : "",
			st.blind > 0 ? "盲目" : "",
			st.fast > 0 ? "倍速" : "",
			st.trapped > 0 ? "はさまれ" : "",
			st.heldBy !== null ? "つかまれ" : "",
		].filter(Boolean);
		const key = `${this.shownFloor?.depth ?? run.s.depth}|${p.lv}|${p.hp}|${p.maxHp}|${hunger}|${left}|${badges.join()}|${run.s.returning}`;
		if (key === this.statusKey) return;
		this.statusKey = key;
		// HP が 半分を 切ったら、ログの 字・HP の 数字・バーを 黄色 → 赤へ（減るほど 赤く）
		const ink = hpInk(p.hp, p.maxHp);
		if (ink) this.logEl.style.setProperty("--ink", ink);
		else this.logEl.style.removeProperty("--ink");
		this.hud.status.style.cssText = ink ? `--ink:${ink}` : "";
		const depthLabel = `${run.s.returning ? "↑" : ""}B${this.shownFloor?.depth ?? run.s.depth}`;
		this.hud.status.innerHTML =
			`<div class="st-row"><span class="st-depth">${depthLabel}</span><span>Lv${p.lv}</span>` +
			`<span class="st-hp${ink ? " inked" : ""}">HP ${p.hp}/${p.maxHp}</span></div>` +
			`<div class="st-bar${ink ? " inked" : ""}"><i style="width:${Math.round((p.hp / p.maxHp) * 100)}%"></i></div>` +
			`<div class="st-row"><span class="st-hunger${hunger <= 10 ? " low" : ""}">満腹 ${hunger}%</span>` +
			(left >= 0
				? `<span class="st-cards">のこり札 ${left}</span>`
				: `<span class="st-cards">帰り道</span>`) +
			(badges.length
				? `<span class="st-hp low">${badges.join(" ")}</span>`
				: "") +
			"</div>";
	}

	// ───────────────── ログ ─────────────────

	/** たまった ログを 間を空けて 1行ずつ 出す（たまりすぎたら 間を つめる）。 */
	private pumpLog(): void {
		clearTimeout(this.logTimer);
		while (this.logQueue.length) {
			const q = this.logQueue[0];
			const gap =
				q.fast || this.logQueue.length > 3
					? LOG_GAP_MS.replay
					: settings.speed === "fast"
						? LOG_GAP_MS.fast
						: LOG_GAP_MS.normal;
			const since = performance.now() - this.lastLogAt;
			if (since < gap) {
				this.logTimer = window.setTimeout(() => this.pumpLog(), gap - since);
				return;
			}
			this.logQueue.shift();
			this.addLog(q.text, q.tone);
			this.lastLogAt = performance.now();
		}
	}

	private addLog(text: string, tone?: "warn" | "good"): void {
		const line = el("div", {
			class: `log-line${tone ? ` ${tone}` : ""}`,
			text,
		});
		this.logEl.appendChild(line);
		// 残す行数：縦に 余裕のある画面（スマホの縦持ち など）は 4行、ほかは 3行
		const keep = window.innerHeight >= 640 ? 4 : 3;
		const lines = [...this.logEl.children];
		for (const l of lines.slice(0, Math.max(0, lines.length - keep)))
			l.remove();
		for (const l of [...this.logEl.children].slice(0, -1))
			l.classList.add("old");
		setTimeout(() => line.classList.add("gone"), 4200);
		setTimeout(() => line.remove(), 5000);
	}

	private pop(pos: Pos, text: string, cls: string): void {
		const sc = this.screen;
		const cssPerSrc = sc.tileCss / TILE;
		const x = (pos.x * TILE + TILE / 2 - this.camX) * cssPerSrc;
		const y = (pos.y * TILE - this.camY) * cssPerSrc;
		const p = el("div", { class: `pop ${cls}`, text });
		p.style.left = `${x}px`;
		p.style.top = `${y}px`;
		this.popsEl.appendChild(p);
		setTimeout(() => p.remove(), 850);
	}

	// ───────────────── 入力 ─────────────────

	private control(t: number): void {
		const input = this.ctx.input;
		if (input.busy) return;
		if (!input.restHeld()) this.restHalt = false;
		// 自動で歩いている（タップ・地図のタップ）あいだに 何かに さわったら 止める。
		// さわった入力は 捨てる（止めるつもりの 十字キーで 1歩・A で 空振り、に ならないように）
		if (this.travel && input.serial !== this.autoSerial) {
			this.lastTravel = this.travel;
			this.travel = null;
			this.swallowInput();
			return;
		}
		const key = input.takeField();
		if (key) {
			this.travel = null;
			void this.onKey(key);
			return;
		}
		const held = input.heldDir();
		// 押さえて歩いている途中で 新しい敵が見えた・傷ついたら、指を離すまで 止まる（押しなおせば 歩ける）
		if (this.walkHalt) {
			if (input.pendingDirPress) this.walkHalt = false;
			else if (held === null && !input.fieldHold()) this.walkHalt = false;
			else return;
		}
		// 向きを変えたあとは、方向を一度はなすまで歩かない
		// （向きボタンをはなした瞬間に、押したままの方へ歩きださないように）
		if (this.waitRelease) {
			if (held === null && !input.pendingDirPress) this.waitRelease = false;
			else if (!input.mods().turn) {
				input.takeDirPress();
				return;
			}
		}
		// キーボードの斜め（2つ同時押し）を少しだけ待つ
		if (input.heldFor() < 45 && (held !== null || input.pendingDirPress))
			return;
		// 押しっぱなしの歩きは 1歩の動き（playEvents の stepMs）が終わりしだい続ける。ここは連打の間隔だけ
		const gap = settings.speed === "fast" ? 50 : 80;
		if (t - this.lastStepAt < gap && (held !== null || input.pendingDirPress))
			return;
		// 押しっぱなしでなくても、短く押した向きには1歩進む
		const pressed = input.takeDirPress();
		const dir = held ?? pressed;
		if (dir !== null) {
			this.travel = null;
			const mods = input.mods();
			if (mods.turn) {
				// その場で向きだけ変える（時間は進まない）
				if (this.run.p.dir !== dir) void this.exec({ c: "turn", dir });
				input.useMod("turn");
				this.waitRelease = true;
				return;
			}
			if (mods.diag && !isDiagonal(dir)) return;
			this.lastStepAt = t;
			if (mods.dash) void this.dash(dir);
			else void this.walkStep(mods.diag ? dir : this.slideDir(dir));
			return;
		}
		// 十字キーの まん中を 長押し：足踏み（押さえているあいだ 続ける。トルネコの A＋B 押しっぱなし）
		if (input.restHeld()) {
			if (this.restHalt || t - this.lastStepAt < REST_GAP_MS) return;
			this.travel = null;
			this.lastStepAt = t;
			void this.restStep();
			return;
		}
		// 画面を押さえつづけたら、その方へ歩きつづける（どこでも十字キー）
		const hold = input.fieldHold();
		if (hold) {
			this.travel = null;
			const want = input.fieldHoldDir((x, y) => this.dirFromScreen(x, y));
			if (want === null || t - this.lastStepAt < gap) return;
			const mods = input.mods();
			if (mods.turn) {
				if (this.run.p.dir !== want) void this.exec({ c: "turn", dir: want });
				return;
			}
			if (mods.diag && !isDiagonal(want)) return;
			// 敵がいる向きは そのまま（向くだけ）。いなければ 近い歩ける向きへ
			const ahead = step(this.run.p, want);
			const m = this.run.monsterAt(ahead.x, ahead.y);
			const dir =
				m && this.run.monsterVisible(m)
					? want
					: (this.passableNear(want, 1) ?? want);
			this.lastStepAt = t;
			void this.walkStep(dir);
			return;
		}
		if (this.travel) void this.travelStep();
	}

	/**
	 * となりの敵に なぐられたら そちらを向く（シレンと 同じ。A で すぐ なぐり返せるように）。
	 * 規則（core）は かえず、ふつうの「向く」コマンドとして 出す（時間は 進まない。リプレイにも 残るので
	 * 前の リプレイも そのまま 再生できる）。何匹かに なぐられたら 最後の 敵。
	 */
	private async faceAttacker(ev: readonly GameEvent[]): Promise<void> {
		const run = this.run;
		const p = run.p;
		for (let i = ev.length - 1; i >= 0; i--) {
			const e = ev[i];
			if (e.t !== "attack" || e.id === PLAYER_ID) continue;
			const m = run.f.monsters.find((x) => x.uid === e.id);
			if (!m || !run.monsterVisible(m) || m.disguise || dist(p, m) !== 1)
				continue;
			const d = dirOf(m.x - p.x, m.y - p.y);
			if (d === null || d === p.dir) return;
			await this.playEvents(run.act({ c: "turn", dir: d }), true);
			this.syncDisp();
			return;
		}
	}

	/**
	 * 斜めが 壁・角で 進めないとき、たて・よこの 片方だけ 進めるなら そちらへ（壁に そって すべる）。
	 * 進めない 斜めは もともと 何も 起きない（時間も 進まない）ので、そのかわり。どちらも・どちらも だめなら そのまま。
	 * 敵の いる 向きは かえない（向く・なぐるの じゃまを しない）。
	 */
	private slideDir(dir: Dir8): Dir8 {
		const run = this.run;
		if (!isDiagonal(dir) || run.p.status.confuse > 0) return dir;
		const ahead = step(run.p, dir);
		const m = run.monsterAt(ahead.x, ahead.y);
		if (run.canStepTerrain(run.p, dir) || (m && run.monsterVisible(m)))
			return dir;
		const open = [((dir + 7) % 8) as Dir8, ((dir + 1) % 8) as Dir8].filter(
			(c) => {
				const n = step(run.p, c);
				return run.canStepTerrain(run.p, c) && !run.monsterAt(n.x, n.y);
			},
		);
		return open.length === 1 ? open[0] : dir;
	}

	/** 自動で歩くのを止めた入力を 捨てる（十字キーは 一度はなすまで 歩かない）。 */
	private swallowInput(): void {
		const input = this.ctx.input;
		input.takeDirPress();
		input.clearField();
		this.waitRelease = true;
	}

	/** 自動で歩きだす（タップ・地図のタップ）。このあと 何かに さわったら 止まる。 */
	private startTravel(to: Pos): void {
		this.travel = to;
		this.lastTravel = null;
		this.autoSerial = this.ctx.input.serial;
	}

	/** 向いている先の マス（壁か 見えている敵まで。敵がいれば hit）。向きを変えるあいだの ねらいの線。 */
	private aimLine(): {
		cells: Pos[];
		hit: Pos | null;
	} {
		const run = this.run;
		const cells: Pos[] = [];
		let at: Pos = { x: run.p.x, y: run.p.y };
		for (let i = 0; i < 12; i++) {
			const nx = step(at, run.p.dir);
			if (!isFloor(run.f.layout, nx.x, nx.y)) break;
			const m = run.monsterAt(nx.x, nx.y);
			if (m && run.monsterVisible(m) && !m.disguise) return { cells, hit: nx };
			cells.push(nx);
			at = nx;
		}
		return { cells, hit: null };
	}

	/** 見えている敵と、画面の 見える所（上のステータス・下のボタンを のぞく）の 上下（ソース画素）。 */
	private edgeThreats(): {
		threats: Pos[];
		top: number;
		bottom: number;
	} | null {
		if (this.rp) return null;
		const run = this.run;
		const threats = run.f.monsters
			.filter((m) => run.monsterVisible(m) && !m.disguise)
			.map((m) => ({ x: m.x, y: m.y }));
		if (!threats.length) return null;
		const k = this.screen.tileCss / TILE;
		const controls = this.hud.root.classList.contains("hidden")
			? 0
			: Number.parseFloat(
					getComputedStyle(this.hud.root).getPropertyValue("--controls-h"),
				) || 0;
		return {
			threats,
			top: 56 / k,
			bottom: this.screen.height - controls / k,
		};
	}

	/**
	 * 押さえて歩く 1歩。傷ついたら、指を離すまで 止める。
	 * 敵が 見えただけでは 止めない（トルネコ1の 歩きと 同じ。止まるのは ダッシュだけ。
	 * 画面の 外の 敵は ふちの 印で わかる）。
	 */
	private async walkStep(dir: Dir8): Promise<void> {
		const run = this.run;
		const hp = run.p.hp;
		await this.exec({ c: "move", dir });
		if (run.p.hp < hp) this.walkHalt = true;
	}

	/** いま 見えている敵のうち、この階で はじめて 見えた敵が いたか（見たと 覚える）。 */
	private spotNew(): boolean {
		const run = this.run;
		if (this.spottedOn !== run.s.floor) {
			this.spottedOn = run.s.floor;
			this.spotted.clear();
		}
		let fresh = false;
		for (const m of run.f.monsters)
			if (run.monsterVisible(m) && !this.spotted.has(m.uid)) {
				this.spotted.add(m.uid);
				fresh = true;
			}
		return fresh;
	}

	/**
	 * 長押しの足踏み 1回。敵が新しく見えた・傷ついた・階が変わったら、指を離すまで 止める
	 * （押さえたまま なぐられつづけないように）。
	 */
	private async restStep(): Promise<void> {
		const run = this.run;
		this.spotNew();
		const hp = run.p.hp;
		const floor = run.s.floor;
		await this.exec({ c: "wait" });
		if (run.p.hp < hp || run.s.floor !== floor || this.spotNew())
			this.restHalt = true;
	}

	private async onKey(key: string): Promise<void> {
		const run = this.run;
		switch (key) {
			case "a":
				await this.exec({ c: "attack" });
				return;
			case "b":
				// 道具は ワンタップで もちものへ（メニューを はさまない）
				await this.menu(openInventory(this.ctx, run));
				return;
			case "menu":
				await this.menu(openMainMenu(this.ctx, run));
				return;
			case "wait":
				await this.exec({ c: "wait" });
				return;
			case "foot":
				// 階段の上では そのまま「降りますか？」
				if (this.onUsableStairs()) await this.askStairs();
				else await this.menu(openFootMenu(this.ctx, run));
				return;
			case "map":
				this.toggleMap();
				return;
			case "stairs":
				if (run.onStairs()) await this.exec({ c: "stairs" });
				return;
			case "sort":
				// 持ち物の 整理（PC の O キー。時間は 進まない）
				if (run.p.items.length > 1) await this.exec({ c: "sort" });
				return;
			case "shoot":
				// 装備した矢を 向いている方へ 1本（トルネコ1と同じ）
				await this.exec({ c: "shoot" });
				return;
			case "throw": {
				const uid = await pickItem(
					this.ctx,
					run,
					"なにを　投げる？",
					() => true,
				);
				if (uid !== null) await this.exec({ c: "throw", item: uid });
				return;
			}
		}
	}

	private toggleMap(): void {
		this.mapOn = !this.mapOn;
		this.mapEl.classList.toggle("shown", this.mapOn);
		// 地図を開いているあいだは 画面を押さえても 歩かない（ゆっくり押しても タップになる）
		this.ctx.input.fieldHoldEnabled = !this.mapOn;
		this.ctx.se("cursor");
	}

	private async menu(p: Promise<MenuAction>): Promise<void> {
		this.busy = true;
		let a: MenuAction;
		try {
			a = await p;
		} finally {
			this.busy = false;
		}
		switch (a.kind) {
			case "command":
				await this.exec(a.cmd);
				if (a.reopen === "items" && !this.run.s.end && !this.stopped)
					await this.menu(openInventory(this.ctx, this.run));
				return;
			case "map":
				this.toggleMap();
				return;
			case "settings":
				this.busy = true;
				await openSettings(this.ctx);
				this.busy = false;
				return;
			case "suspend":
				this.save(true);
				this.ctx.se("save");
				this.onSuspend();
				this.stop();
				return;
			case "none":
				return;
		}
	}

	/**
	 * 地図を開いているときの タップ：そのマス（少しずれても 近くの 知っている床）まで 自動で歩く。
	 * 歩きだしたら 地図は閉じる（まわりを見ながら 歩けるように。敵が見えたら 止まるのは タップ移動と同じ）。
	 */
	private mapTap(cssX: number, cssY: number): void {
		const run = this.run;
		const r = this.screen.canvas.getBoundingClientRect();
		const at = mapTileAt(this.mapEl, run.s, r.left + cssX, r.top + cssY);
		const p = run.p;
		if (!at || (at.x === p.x && at.y === p.y)) {
			this.toggleMap();
			return;
		}
		// 小さい地図では 階段や道具の点に ぴったり触れないので、指の幅（約 20 CSS 画素）の中の 階段・道具に 寄せる
		const target =
			this.mapPoint(at.x, at.y, Math.max(1, Math.ceil(20 / at.cellCss))) ??
			this.nearKnownFloor(at.x, at.y, 2);
		if (!target) {
			this.ctx.se("cancel");
			return;
		}
		// 選んだ所を 一瞬 光らせてから 閉じて 歩きだす
		this.ctx.se("cursor");
		this.mapMark = target;
		setTimeout(() => {
			this.mapMark = null;
			if (this.stopped) return;
			if (this.mapOn) this.toggleMap();
			this.startTravel(target);
		}, 170);
	}

	/** 地図の (x, y) のまわり radius マスで いちばん近い 階段か 見えている道具（自分のいるマスは のぞく）。 */
	private mapPoint(x: number, y: number, radius: number): Pos | null {
		const run = this.run;
		const f = run.f;
		const l = f.layout;
		const p = run.p;
		const seenItem = new Set(run.s.seen);
		const pts: Pos[] = [];
		if (this.lastTravel) pts.push(this.lastTravel);
		if (f.seen[f.stairs.y * l.w + f.stairs.x]) pts.push(f.stairs);
		for (const fi of f.items)
			if (
				f.senseItems ||
				(f.seen[fi.y * l.w + fi.x] && seenItem.has(fi.item.uid))
			)
				pts.push(fi);
		let best: Pos | null = null;
		let bd = 99;
		for (const q of pts) {
			if (q.x === p.x && q.y === p.y) continue;
			const d = Math.max(Math.abs(q.x - x), Math.abs(q.y - y));
			if (d <= radius && d < bd) {
				bd = d;
				best = { x: q.x, y: q.y };
			}
		}
		return best;
	}

	/** 画面の点（canvas の CSS 画素）が、十字キー・A/B・小さいボタンの まわり 24 画素の中か。 */
	private nearControls(cssX: number, cssY: number): boolean {
		const r = this.screen.canvas.getBoundingClientRect();
		const cx = r.left + cssX;
		const cy = r.top + cssY;
		const pad = 24;
		for (const e of this.hud.root.querySelectorAll<HTMLElement>(
			".pad, .ab .btn, .minis .mini",
		)) {
			if (!e.offsetParent) continue; // 隠れている
			const b = e.getBoundingClientRect();
			if (
				cx >= b.left - pad &&
				cx <= b.right + pad &&
				cy >= b.top - pad &&
				cy <= b.bottom + pad
			)
				return true;
		}
		return false;
	}

	/** 見えている敵が n マス以内にいるか。 */
	private enemyWithin(n: number): boolean {
		const run = this.run;
		return run.f.monsters.some(
			(m) => run.monsterVisible(m) && !m.disguise && dist(m, run.p) <= n,
		);
	}

	/** (x, y) か、そのまわり radius マスの中で いちばん近い 知っている床（自分のいるマスは のぞく）。 */
	private nearKnownFloor(x: number, y: number, radius: number): Pos | null {
		const run = this.run;
		const p = run.p;
		const l = run.f.layout;
		const known = (tx: number, ty: number) =>
			tx >= 0 &&
			ty >= 0 &&
			tx < l.w &&
			ty < l.h &&
			isFloor(l, tx, ty) &&
			!!run.f.seen[ty * l.w + tx] &&
			(tx !== p.x || ty !== p.y);
		if (known(x, y)) return { x, y };
		let best = 99;
		let target: Pos | null = null;
		for (let dy = -radius; dy <= radius; dy++)
			for (let dx = -radius; dx <= radius; dx++) {
				if (!known(x + dx, y + dy)) continue;
				const dd = Math.abs(dx) + Math.abs(dy);
				if (dd < best) {
					best = dd;
					target = { x: x + dx, y: y + dy };
				}
			}
		return target;
	}

	private onTap(cssX: number, cssY: number): void {
		if (this.busy) return;
		if (this.mapOn) {
			this.mapTap(cssX, cssY);
			return;
		}
		// 下のボタン（十字キー・A/B・小さいボタン）の すぐそばの タップは、敵が近くにいれば 歩かない
		// （A を押しそこねて 敵のそばで 歩きだす・走りだす のを ふせぐ）
		if (this.nearControls(cssX, cssY) && this.enemyWithin(3)) {
			this.ctx.se("cancel");
			return;
		}
		const sc = this.screen;
		const src = sc.cssToSource(cssX, cssY);
		const x = Math.floor((src.x + this.camX) / TILE);
		const y = Math.floor((src.y + this.camY) / TILE);
		const run = this.run;
		const p = run.p;
		if (x === p.x && y === p.y) {
			void this.menu(openFootMenu(this.ctx, run));
			return;
		}
		const d = dirOf(x - p.x, y - p.y);
		if (dist(p, { x, y }) === 1 && d !== null) {
			const m = run.monsterAt(x, y);
			// となりの敵をタップ：まず そちらを向く。向いていれば なぐる
			if (m && run.monsterVisible(m) && !m.disguise) {
				void this.exec(
					p.dir === d ? { c: "attack", dir: d } : { c: "turn", dir: d },
				);
				return;
			}
		}
		// 離れた敵をタップしたら 歩かない。まっすぐ 並んでいれば そちらを向く
		// （時間は進まない。矢・杖・投げるの ねらいに。敵の 解説は 出さない。図鑑で 見られる）
		const far = run.monsterAt(x, y);
		if (far && run.monsterVisible(far) && !far.disguise && dist(p, far) > 1) {
			const dx = far.x - p.x;
			const dy = far.y - p.y;
			if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) {
				const fd = dirOf(Math.sign(dx), Math.sign(dy));
				if (fd !== null && fd !== p.dir) void this.exec({ c: "turn", dir: fd });
			}
			return;
		}
		// まだ見ていない所（暗い通路の先など）を 2マス以上 先にタップしたら、その方へ 何かあるまで走る
		// （近くの 知っている床＝となりのマス に寄せると 1マスずつしか 進めないので）
		const lay = run.f.layout;
		const seenTap =
			x >= 0 && y >= 0 && x < lay.w && y < lay.h && !!run.f.seen[y * lay.w + x];
		if (!seenTap && dist(p, { x, y }) >= 2) {
			const toward = this.dirFromScreen(cssX, cssY);
			const first = toward === null ? null : this.passableNear(toward, 2);
			if (first !== null) {
				void this.dash(first);
				return;
			}
		}
		// 知っている床ならそこへ。少しずれて壁をタップしたときは、となりの知っている床に寄せる
		const target = this.nearKnownFloor(x, y, 1);
		if (target) {
			const td = dirOf(target.x - p.x, target.y - p.y);
			if (dist(p, target) === 1 && td !== null) {
				void this.exec({ c: "move", dir: td });
				return;
			}
			this.startTravel(target);
			return;
		}
		// 見ていない所（通路の先など）をタップしたら、その方へ 何かあるまで走る（通路の角はついていく）
		const toward = this.dirFromScreen(cssX, cssY);
		const first = toward === null ? null : this.passableNear(toward, 2);
		if (first !== null) void this.dash(first);
	}

	/** 画面の点（canvas の CSS 画素）が、キリコから見てどの向きか。キリコの上なら null。 */
	private dirFromScreen(cssX: number, cssY: number): Dir8 | null {
		const pd = this.disp.get(PLAYER_ID);
		if (!pd) return null;
		const k = this.screen.tileCss / TILE;
		const px = (pd.fx * TILE + TILE / 2 - this.camX) * k;
		const py = (pd.fy * TILE + TILE / 2 - this.camY) * k;
		const dx = cssX - px;
		const dy = cssY - py;
		if (Math.hypot(dx, dy) < this.screen.tileCss * 0.6) return null;
		return ((Math.round(Math.atan2(dx, -dy) / (Math.PI / 4)) + 8) % 8) as Dir8;
	}

	/**
	 * d に近い向きのうち、歩ける向き（まず d、つぎに ±45°、spread が 2 なら ±90° まで）。
	 * 通路の入口を少しずれてタップ・押さえても、通路へ入れるように。どこも歩けなければ null。
	 */
	private passableNear(d: Dir8, spread: 1 | 2): Dir8 | null {
		const run = this.run;
		const order = spread === 2 ? [0, 1, -1, 2, -2] : [0, 1, -1];
		for (const o of order) {
			const c = ((((d + o) % 8) + 8) % 8) as Dir8;
			if (run.canStepTerrain(run.p, c)) return c;
		}
		return null;
	}

	// ───────────────── 実行と演出 ─────────────────

	/** コマンドを実行して、出来事を演出する。 */
	async exec(cmd: Command, fast = false): Promise<GameEvent[]> {
		if (this.busy || this.stopped) return [];
		this.busy = true;
		const run = this.run;
		const wasOnStairs = run.onStairs();
		const before = { x: run.p.x, y: run.p.y };
		let ev: GameEvent[] = [];
		// 使う道具（食べる・飲む・読む演出のため、使う前に見ておく）
		const using =
			cmd.c === "use"
				? (run.findItem(cmd.item) ??
					run.f.items.find((fi) => fi.item.uid === cmd.item)?.item)
				: undefined;
		const turn0 = run.s.turn;
		const floor0 = run.s.floor;
		try {
			ev = run.act(cmd);
			if (run.s.floor !== floor0) this.shownFloor = floor0;
			// 倒れた（持ち帰った）その場で中断セーブを片づける（演出の途中で閉じても やり直せないように）
			if (run.s.end) this.saveEnd();
			// 使えたら（時間が進んだら）、効き目を出す前に 食べる・飲む・読む
			if (using && run.s.turn !== turn0) await this.useAnim(using.kind);
			await this.playEvents(ev, fast);
			if (this.stopped) return ev;
			// 倒したら、演出中に 押しておいた 次の 攻撃は 捨てる（相手の いない 空振りに ならないように）
			if (!this.rp && ev.some((e) => e.t === "die"))
				this.ctx.input.clearField();
			this.syncDisp();
			if (!this.rp && !run.s.end) await this.faceAttacker(ev);
			// スレの「どれに？」（メニューを通さずに来たとき）
			const pick = ev.find((e) => e.t === "fx" && e.kind.startsWith("pick:"));
			// （リプレイでは 次のコマンドに えらんだ相手が入っている）
			if (pick && pick.t === "fx" && cmd.c === "use" && !this.rp) {
				this.busy = false;
				const staffOnly = pick.kind === "pick:staff";
				const uid = await pickItem(
					this.ctx,
					run,
					"どれに　つかう？",
					(it) =>
						it.uid !== cmd.item && (!staffOnly || it.kind.startsWith("w_")),
				);
				if (uid !== null)
					return this.exec({ c: "use", item: cmd.item, target: uid });
				return ev;
			}
			// 帰還スレ：「地上へ もどる？」
			const confirm = ev.some(
				(e) => e.t === "fx" && e.kind === "confirm:escape",
			);
			if (confirm && cmd.c === "use" && !this.rp) {
				this.busy = false;
				const v = await listWindow(
					this.ctx,
					"地上へ　もどりますか？<br><small>持ち物を　持って　帰れる。冒険は　ここで　おわる</small>",
					[
						{ label: "もどる", value: "go" },
						{ label: "やめる", value: "stay" },
					],
					{ start: 1 },
				);
				if (v === "go")
					return this.exec({ c: "use", item: cmd.item, target: 0 });
				return ev;
			}
			if (run.s.end) {
				await this.ending();
				return ev;
			}
			this.save();
			// 階段に乗ったら聞く（ダッシュ・タップ移動の途中では聞かない）
			const moved = before.x !== run.p.x || before.y !== run.p.y;
			if (
				!this.rp &&
				!fast &&
				moved &&
				this.onUsableStairs() &&
				!wasOnStairs &&
				!ev.some((e) => e.t === "floor")
			) {
				this.busy = false;
				await this.askStairs();
			}
		} finally {
			this.shownFloor = null;
			this.busy = false;
		}
		return ev;
	}

	/**
	 * 食べる・飲む・読む演出：キリコが こちらを向き、頭の上に道具を出して動かす。
	 * パンは3口 もぐもぐ（ひと口ごとに小さくなる）、草は持ち上げて傾ける、スレは浮かんで消える。
	 */
	private async useAnim(kind: string): Promise<void> {
		const style = USE_STYLE[defOf(kind).cat];
		if (!style) return;
		const k = settings.speed === "fast" ? 0.6 : 1;
		const dur = USE_MS[style] * k;
		const pd = this.disp.get(PLAYER_ID);
		if (pd) pd.dir = 4;
		this.useFx = {
			icon: itemIcon(kind),
			style,
			t0: performance.now(),
			dur,
		};
		if (style === "eat") {
			for (let i = 0; i < 3; i++) {
				this.ctx.audio.se("eat");
				await wait(dur / 3);
			}
		} else {
			this.ctx.audio.se(style);
			await wait(dur);
		}
		this.useFx = null;
		if (pd) pd.dir = this.run.p.dir;
	}

	// ───────────────── リプレイ ─────────────────

	/** リプレイの操作（下の帯）：一時停止・速さ・次の階へ・やめる。十字キー・キーでも。 */
	private mountReplayBar(): void {
		const rp = this.rp;
		if (!rp) return;
		this.hud.root.classList.add("replay");
		this.ctx.ui.classList.add("replaying");
		const btn = (cls: string, text: string, fn: () => void) => {
			const b = el("button", { class: `rp-btn ${cls}`, text });
			b.addEventListener("pointerdown", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.ctx.audio.unlock();
				fn();
			});
			return b;
		};
		const bar = el("div", { class: "replay-bar" }, [
			el("div", { class: "rp-head" }, [
				el("span", { class: "rp-label", text: "リプレイ" }),
				el("span", { class: "rp-where" }),
			]),
			el("div", { class: "rp-prog" }, [el("i")]),
			el("div", { class: "rp-btns" }, [
				btn("rp-play", "⏸", () => this.replayToggle()),
				btn("rp-speed", "×1", () => this.replaySpeed(1)),
				btn("rp-next", "次の階へ", () => this.replayRequestSkip()),
				btn("rp-quit", "やめる", () => void this.replayQuit()),
			]),
		]);
		rp.bar = bar;
		this.ctx.ui.appendChild(bar);
		this.updateReplayBar();
	}

	private updateReplayBar(): void {
		const rp = this.rp;
		if (!rp?.bar) return;
		const q = (c: string) => rp.bar?.querySelector(c) as HTMLElement;
		q(".rp-play").textContent = rp.paused ? "▶" : "⏸";
		q(".rp-speed").textContent = `×${rp.speed}`;
		q(".rp-where").textContent =
			`B${this.run.s.depth}　${this.run.s.turn}ターン`;
		(q(".rp-prog i") as HTMLElement).style.width =
			`${rp.total ? (rp.done / rp.total) * 100 : 100}%`;
	}

	private replayToggle(): void {
		const rp = this.rp;
		if (!rp || this.stopped) return;
		rp.paused = !rp.paused;
		this.ctx.se("cursor");
		this.updateReplayBar();
	}

	/** 速さを変える（1 → 2 → 4 → 8 → 1。step が −1 なら遅く）。 */
	private replaySpeed(step: 1 | -1): void {
		const rp = this.rp;
		if (!rp) return;
		const list = [1, 2, 4, 8];
		const i = list.indexOf(rp.speed);
		rp.speed =
			step > 0 ? list[(i + 1) % list.length] : list[Math.max(0, i - 1)];
		this.ctx.se("cursor");
		this.updateReplayBar();
	}

	/** 次のコマンドを1つ取る（あいだの指紋は ここで確かめる）。無くなった・ずれたら null。 */
	private replayNext(): Command | null {
		const rp = this.rp;
		if (!rp) return null;
		while (rp.i < rp.steps.length) {
			const st = rp.steps[rp.i++];
			if (st.kind === "cmd") {
				rp.done++;
				return st.cmd;
			}
			if (digest(this.run.s) !== st.digest) {
				rp.drift = true;
				return null;
			}
		}
		return null;
	}

	/** 毎コマ：入力の代わりに、記録のコマンドを1つずつ入れる。 */
	private replayTick(t: number): void {
		const rp = this.rp;
		if (!rp || this.stopped) return;
		const input = this.ctx.input;
		const key = input.takeField();
		if (key === "a" || key === "wait") this.replayToggle();
		else if (key === "b" || key === "menu") void this.replayQuit();
		else if (key === "map") this.toggleMap();
		const d = input.takeDirPress();
		if (d === 2) this.replaySpeed(1);
		else if (d === 6) this.replaySpeed(-1);
		else if (d === 4) this.replayRequestSkip();
		if (rp.skip) {
			rp.skip = false;
			void this.replaySkipFloor();
			return;
		}
		if (rp.paused || t < rp.nextAt) return;
		const cmd = this.replayNext();
		if (!cmd) {
			void this.replayEnd();
			return;
		}
		const fast = rp.speed >= 4;
		void this.exec(cmd, fast).then(() => {
			rp.nextAt = performance.now() + REPLAY_GAP / rp.speed;
			this.updateReplayBar();
		});
	}

	/** 「次の階へ」：再生中の1手が終わってから とばす（毎コマの replayTick が拾う）。 */
	private replayRequestSkip(): void {
		if (!this.rp || this.stopped) return;
		this.rp.skip = true;
		this.ctx.se("cursor");
	}

	/** 次の階まで（演出なしで）とばす。 */
	private async replaySkipFloor(): Promise<void> {
		const rp = this.rp;
		if (!rp || this.busy || this.stopped) return;
		this.busy = true;
		const run = this.run;
		// 階が変わるまで（原盤を拾って帰り道になるのは 同じ階の中なので とめない）
		const depth = run.s.depth;
		try {
			while (!run.s.end && run.s.depth === depth) {
				const cmd = this.replayNext();
				if (!cmd) break;
				run.act(cmd);
			}
			this.logQueue = [];
			this.logEl.innerHTML = "";
			this.syncDisp(true);
			this.view.invalidate();
			this.updateReplayBar();
			if (run.s.end) {
				await this.ending();
				return;
			}
			if (run.s.depth !== depth) {
				this.ctx.se("stairs");
				await this.floorCard(false);
			} else await this.replayEnd();
		} finally {
			this.busy = false;
		}
	}

	private async replayQuit(): Promise<void> {
		if (!this.rp || this.stopped) return;
		this.ctx.se("cancel");
		void this.ctx.audio.fadeBgm(300);
		this.stop();
	}

	/** リプレイの終わり（最後まで見た・ずれて止まった）。タップで 村へ。 */
	private async replayEnd(): Promise<void> {
		const rp = this.rp;
		if (!rp || this.stopped) return;
		this.busy = true;
		rp.paused = true;
		this.updateReplayBar();
		const r = rp.replay;
		const end = this.run.s.end;
		const line = rp.drift
			? "ここから先は　今の版では　同じに　ならないため、見られません<br><small>（リプレイを残したあとで ゲームの中身が 変わった）</small>"
			: end
				? end.kind === "clear"
					? `${defOf(this.run.dungeon.goal).name}を　持ち帰った<br><small>${this.run.s.turn}ターン</small>`
					: `${this.run.s.returning ? "帰り道の　" : ""}B${end.depth}で　${esc(end.cause)}`
				: `記録は　ここまで<br><small>（B${r.depth}で　${esc(r.cause)}）</small>`;
		const card = el("div", { class: "replay-end" }, [
			el("div", { class: "rp-end-title", text: "リプレイ　おわり" }),
			el("div", { class: "rp-end-line", html: line }),
			el("div", { class: "rp-end-hint", text: "タップで　もどる" }),
		]);
		this.ctx.ui.appendChild(card);
		await nextFrame();
		card.classList.add("shown");
		await waitOrSkip(60_000, 600);
		card.remove();
		this.ctx.input.clearField();
		this.ctx.input.takeDirPress();
		void this.ctx.audio.fadeBgm(300);
		this.stop();
	}

	/** 使える階段の上にいるか（いちばん底は、原盤を拾うまで階段が無い）。 */
	private onUsableStairs(): boolean {
		const run = this.run;
		return run.onStairs() && !run.atBottom;
	}

	private async askStairs(): Promise<void> {
		const run = this.run;
		if (this.stopped || run.s.end || !this.onUsableStairs()) return;
		const up = run.s.returning;
		// トルネコ1と同じく 聞くだけ（この階に残っている札の数は 山札の表で見られる）
		const title = up ? "階段を　上りますか？" : "階段を　降りますか？";
		this.busy = true;
		const v = await listWindow(
			this.ctx,
			title,
			[
				{ label: up ? "上る" : "降りる", value: "go" },
				{ label: "そのまま", value: "stay" },
			],
			{ cls: "main-menu" },
		);
		this.busy = false;
		if (v === "go") await this.exec({ c: "stairs" });
	}

	private async playEvents(ev: GameEvent[], fast: boolean): Promise<void> {
		const speed = settings.speed === "fast" || fast ? 0.55 : 1;
		// 1歩の 動き（ms）。軽く 歩けるように 短め
		const stepMs = (fast ? 45 : 95) * (settings.speed === "fast" ? 0.7 : 1);
		let i = 0;
		let combat = false;
		// 途中で閉じたら（リプレイの「やめる」）残りの出来事は流さない
		while (i < ev.length && !this.stopped) {
			const e = ev[i];
			// 続けて動く出来事はまとめて同時に動かす（倍速の2歩も、同じ時間の中で 通るマスをたどる）
			if (e.t === "move") {
				const now = performance.now();
				let j = i;
				const paths = new Map<number, Pos[]>();
				let shown = false;
				while (j < ev.length && (ev[j].t === "move" || ev[j].t === "turn")) {
					const m = ev[j];
					if (m.t !== "move" && m.t !== "turn") break;
					const d = this.disp.get(m.id);
					if (d) d.dir = m.dir;
					if (m.t === "move") {
						const path = paths.get(m.id) ?? [];
						path.push(m.to);
						paths.set(m.id, path);
						if (this.moveShown(m.id)) shown = true;
					}
					j++;
				}
				let end = now;
				for (const [id, path] of paths) {
					const d = this.disp.get(id);
					if (!d) continue;
					// 前の1歩の終わりぎわに続けて動くなら、その道のりの後ろに足す。そうでなければ 今の所から
					const last = d.keys[d.keys.length - 1];
					const lag = now - last.t;
					const t0 = d.keys.length > 1 && lag > -25 && lag < 50 ? last.t : now;
					const keys =
						t0 === now
							? [{ x: d.fx, y: d.fy, t: now }]
							: d.keys.filter(
									(_, i, a) => i === a.length - 1 || a[i + 1].t > now - 50,
								);
					path.forEach((q, i) => {
						keys.push({
							x: q.x,
							y: q.y,
							t: t0 + (stepMs * (i + 1)) / path.length,
						});
					});
					d.keys = keys;
					d.tx = path[path.length - 1].x;
					d.ty = path[path.length - 1].y;
					if (this.moveShown(id)) end = Math.max(end, t0 + stepMs);
				}
				// 見えない所の動きは待たない。見える動きも 1コマぶん早めに次へ進める（次の1歩が 続きから動けるように）
				if (shown) await wait(end - performance.now() - FRAME_MS);
				i = j;
				continue;
			}
			i++;
			switch (e.t) {
				case "msg":
					// 前の行から 間を空けて 1行ずつ 出す（読めるように。待つのは ログだけで、次の 1歩は 待たない）
					this.logQueue.push({ text: e.text, tone: e.tone, fast });
					this.pumpLog();
					break;
				case "se":
					// 全滅の音は、倒れる演出で 墓が落ちたときに鳴らす
					if (e.name === "wipeout" && this.run.s.end?.kind === "dead") break;
					this.ctx.audio.se(e.name);
					break;
				case "turn": {
					const d = this.disp.get(e.id);
					if (d) d.dir = e.dir;
					break;
				}
				case "attack": {
					const d = this.disp.get(e.id);
					if (d) {
						d.dir = e.dir;
						d.lungeT0 = performance.now();
					}
					combat = true;
					await wait(90 * speed);
					break;
				}
				case "hurt": {
					const d = this.disp.get(e.id);
					if (d) d.flashUntil = performance.now() + 260;
					if (this.isShown(e.id, e.pos))
						this.pop(
							e.pos,
							String(e.amount),
							e.id === PLAYER_ID ? "hurt-player" : "",
						);
					combat = true;
					await wait(70 * speed);
					break;
				}
				case "heal":
					this.pop(e.pos, `+${e.amount}`, "heal");
					break;
				case "miss":
					if (this.isShown(e.id, e.pos)) this.pop(e.pos, "ミス", "miss");
					combat = true;
					await wait(60 * speed);
					break;
				case "die": {
					const d = this.disp.get(e.id);
					if (d) {
						d.dying = true;
						d.fadeT0 = performance.now();
					}
					await wait(120 * speed);
					break;
				}
				case "appear": {
					// ふえた敵だけ足す（ほかのキャラの動きの途中を崩さない）
					const m = this.run.f.monsters.find((x) => x.uid === e.id);
					if (m && !this.disp.has(e.id)) {
						// 見えていれば もとの敵の マスから 光って 分かれ出る（コピペ。ふえたのが わかるように）
						const from = e.from && this.run.monsterVisible(m) ? e.from : null;
						const now = performance.now();
						this.disp.set(e.id, {
							id: e.id,
							sprite: mdef(m).sprite,
							fx: from?.x ?? e.pos.x,
							fy: from?.y ?? e.pos.y,
							tx: e.pos.x,
							ty: e.pos.y,
							keys: from
								? [
										{ x: from.x, y: from.y, t: now },
										{ x: e.pos.x, y: e.pos.y, t: now + SPLIT_MS },
									]
								: [{ x: e.pos.x, y: e.pos.y, t: 0 }],
							dir: m.dir,
							lunge: 0,
							lungeT0: 0,
							flashUntil: from ? now + SPLIT_MS + 260 : 0,
							fade: 0,
							fadeT0: 0,
							dying: false,
						});
						if (from) {
							const orig = [...this.disp.values()].find(
								(d) => d.id !== e.id && d.tx === from.x && d.ty === from.y,
							);
							if (orig) orig.flashUntil = now + SPLIT_MS + 260;
							this.pop(from, "コピペ", "dup");
							await wait(SPLIT_MS + 60);
						}
					}
					break;
				}
				case "warp": {
					const d = this.disp.get(e.id);
					if (d) {
						d.tx = d.fx = e.to.x;
						d.ty = d.fy = e.to.y;
						d.keys = [{ x: e.to.x, y: e.to.y, t: 0 }];
					}
					await wait(80 * speed);
					break;
				}
				case "bolt":
					await this.flyBolt(e, speed);
					break;
				case "fx":
					if (e.kind === "explosion" || e.kind === "blast")
						await this.flash("rgba(255,160,60,0.6)", 220);
					break;
				case "floor":
					await this.floorCard(false);
					break;
				case "levelup":
					break;
				case "house":
					this.ctx.audio.bgm(HOUSE_BGM);
					break;
				case "sleep":
					if (e.id === PLAYER_ID) {
						// 眠っている あいだの ターンは 一気に 進むので、Z を 出したまま 少し 見せてから 起こす
						if (e.on) this.sleepShown = true;
						if (!fast) await wait((e.on ? 400 : 600) * speed);
						if (!e.on) this.sleepShown = false;
					}
					break;
				case "quake":
					document.body.classList.add("shake");
					await wait(e.level >= 3 ? 700 : 400);
					document.body.classList.remove("shake");
					if (e.level >= 3)
						await this.overThread(
							ev.slice(i).some((x) => x.t === "floor"),
							fast,
						);
					break;
				case "goal":
					this.ctx.audio.bgm(floorBgm(this.run));
					break;
				case "end":
					break;
			}
		}
		// 戦いの音が鳴っていたら、その区切りまで次の行動を待つ（連打で音が重ならないように）
		if (combat && !fast) await this.ctx.audio.seSettled();
	}

	/** その動きが画面に見えているか（見えない敵・視界の外は待たない）。 */
	private moveShown(id: number): boolean {
		if (id === PLAYER_ID) return true;
		const m = this.run.f.monsters.find((x) => x.uid === id);
		return !!m && !m.disguise && this.run.monsterVisible(m);
	}

	private isShown(id: number, pos: Pos): boolean {
		if (id === PLAYER_ID) return true;
		return this.run.playerSees(pos);
	}

	private async flyBolt(
		e: Extract<GameEvent, { t: "bolt" }>,
		speed: number,
	): Promise<void> {
		const n = Math.max(1, dist(e.from, e.to));
		const fire = e.kind === "fire";
		// 炎は 帯なので となりでも 見える 長さに（矢・杖は 今までどおり）
		const ms =
			(fire ? Math.min(480, 220 + n * 40) : Math.min(420, n * 38)) * speed;
		const proj: Projectile = {
			x: e.from.x,
			y: e.from.y,
			icon: e.kind === "item" && e.icon ? itemIcon(e.icon) : null,
			color:
				e.kind === "fire"
					? "#ff7a3a"
					: e.kind === "staff"
						? "#a8e0ff"
						: "#f4f1ff",
			flame: fire ? { x: e.from.x, y: e.from.y, alpha: 1 } : undefined,
		};
		this.projectiles.push(proj);
		const t0 = performance.now();
		// 炎は 先が 早く 伸びきって、しばらく 燃えてから 消える
		const reach = fire ? ms * 0.45 : ms;
		for (;;) {
			const elapsed = performance.now() - t0;
			const k = Math.min(1, elapsed / reach);
			proj.x = e.from.x + (e.to.x - e.from.x) * k;
			proj.y = e.from.y + (e.to.y - e.from.y) * k;
			if (proj.flame)
				proj.flame.alpha =
					elapsed < ms * 0.7
						? 1
						: Math.max(0, 1 - (elapsed - ms * 0.7) / (ms * 0.3));
			if (elapsed >= ms) break;
			await nextFrameP();
		}
		this.projectiles = this.projectiles.filter((p) => p !== proj);
	}

	private async flash(color: string, ms: number): Promise<void> {
		const f = el("div", { class: "flash" });
		f.style.background = color;
		this.ctx.ui.appendChild(f);
		await wait(ms);
		f.remove();
	}

	/** 階の札（〇階）。 */
	/**
	 * 地震の3回目：2ch の 1001 のように「このスレッドは1000を超えました」が書きこまれ、
	 * もう書けないので 下の階へ 落ちる（画面ごと 沈んで 暗くなり、つぎの階の札へ）。
	 */
	private async overThread(falls: boolean, fast: boolean): Promise<void> {
		const post = el("div", { class: "over1000" }, [
			el("div", { class: "over1000-head" }, [
				"1001 ：",
				el("b", { text: "１００１" }),
				"：Over 1000 Thread",
			]),
			el("div", {
				class: "over1000-body",
				text: "このスレッドは１０００を超えました。",
			}),
			el("div", {
				class: "over1000-body",
				text: falls
					? "もう書けないので、下の階へ落ちます。。。"
					: "もう書けませんが、これより下は　ありません。。。",
			}),
		]);
		this.ctx.ui.appendChild(post);
		await nextFrame();
		post.classList.add("shown");
		await wait(fast ? 500 : 1600);
		if (this.stopped) {
			post.remove();
			return;
		}
		if (falls) {
			post.classList.add("falling");
			this.fadeEl.style.transition = "opacity 0.45s";
			this.fadeEl.style.opacity = "1";
		} else post.classList.remove("shown");
		await wait(460);
		post.remove();
	}

	private async floorCard(first: boolean): Promise<void> {
		const run = this.run;
		this.shownFloor = null;
		this.lastTravel = null;
		this.view.invalidate();
		this.syncDisp(true);
		this.travel = null;
		this.fadeEl.style.transition = "none";
		this.fadeEl.style.opacity = "1";
		const up = run.s.returning;
		const card = el("div", { class: "chapter shown" }, [
			el("div", {
				class: "chapter-label",
				text: `${up ? "帰り道　" : ""}${zoneFor(run.s.dungeon, run.s.depth).name}`,
			}),
			el("div", { class: "chapter-title", text: `地下　${run.s.depth}階` }),
			el("div", {
				class: "chapter-sub",
				text: up
					? "上り階段を　さがそう"
					: run.s.depth >= run.dungeon.floors
						? "いちばん　底"
						: "",
			}),
		]);
		this.ctx.ui.appendChild(card);
		if (!first) await this.ctx.audio.fadeBgm(300);
		await wait(first ? 900 : 1100);
		if (this.stopped) {
			card.remove();
			return;
		}
		this.ctx.audio.bgm(floorBgm(run));
		card.classList.remove("shown");
		this.fadeEl.style.transition = "opacity 0.35s";
		await nextFrame();
		this.fadeEl.style.opacity = "0";
		await wait(360);
		card.remove();
		this.save(true);
	}

	private async ending(): Promise<void> {
		const s = this.run.s;
		this.busy = true;
		if (s.end?.kind === "dead") await this.deathScene();
		else await wait(700);
		if (this.rp) {
			await this.replayEnd();
			return;
		}
		await showRunEnd(this.ctx, s);
		this.stop();
	}

	/**
	 * 倒れたときの演出：キリコが くるくる回って消え、その場に墓が落ちてくる。
	 * 画面の色が抜けて、どこで何に倒されたかを出す。タップ・キーで先へ。
	 */
	private async deathScene(): Promise<void> {
		const run = this.run;
		const end = run.s.end;
		if (!end) return;
		void this.ctx.audio.fadeBgm(600);
		const pd = this.disp.get(PLAYER_ID);
		await wait(250);
		if (pd) {
			pd.flashUntil = performance.now() + 420;
			for (const d of [4, 6, 0, 2, 4, 6, 0, 2, 4] as Dir8[]) {
				pd.dir = d;
				await wait(65);
			}
			pd.dying = true;
			pd.fadeT0 = performance.now();
		}
		this.grave = { x: run.p.x, y: run.p.y, t0: performance.now() + 120 };
		await wait(120 + GRAVE_DROP_MS * 0.7);
		// リプレイを「やめる」で閉じたあとなら ここで終わる（村の上に出さない・色を抜かない）
		if (this.stopped) return;
		this.ctx.audio.se("wipeout");
		this.screen.canvas.classList.add("dead");
		const scene = el("div", { class: "death" }, [
			el("div", { class: "death-title", text: "キリコは　たおれた" }),
			el("div", {
				class: "death-cause",
				text: `${end.depth === 0 ? "" : `${run.s.returning ? "帰り道の　" : ""}地下${end.depth}階で　`}${end.cause}`,
			}),
		]);
		this.ctx.ui.appendChild(scene);
		this.deathEl = scene;
		await nextFrame();
		scene.classList.add("shown");
		await waitOrSkip(3200, 900);
		this.ctx.input.clearField();
		this.ctx.input.takeDirPress();
		scene.remove();
	}

	// ───────────────── ダッシュ・タップ移動 ─────────────────

	/** 何かあったら止まるかどうか（ダッシュ・タップ移動）。 */
	private shouldStop(
		before: { monsters: number; room: number },
		ev: GameEvent[],
		dash = true,
	): boolean {
		const run = this.run;
		if (run.s.end) return true;
		if (ev.some((e) => e.t === "msg" && e.tone === "warn")) return true;
		if (ev.some((e) => e.t === "hurt" || e.t === "floor" || e.t === "warp"))
			return true;
		const p = run.p;
		if (run.itemAt(p.x, p.y) || this.onUsableStairs()) return true;
		const vis = run.f.monsters.filter(
			(m) => run.monsterVisible(m) && !m.disguise,
		).length;
		if (vis > before.monsters) return true;
		// 敵に ねらわれた（なぐられた・撃たれた）ら止まる。はずれても止まる
		if (
			ev.some(
				(e) =>
					(e.t === "attack" && e.id !== PLAYER_ID) ||
					(e.t === "miss" && e.id === PLAYER_ID),
			)
		)
			return true;
		// ダッシュは部屋の出入りで止まる（行き先を決めたタップ移動は止まらない）
		const room = roomAt(run.f.layout, p.x, p.y);
		if (dash && room !== before.room) return true;
		if (p.hp <= p.maxHp / 3) return true;
		return false;
	}

	private snapshot(): { monsters: number; room: number } {
		const run = this.run;
		return {
			monsters: run.f.monsters.filter(
				(m) => run.monsterVisible(m) && !m.disguise,
			).length,
			room: roomAt(run.f.layout, run.p.x, run.p.y),
		};
	}

	/** d の向きに、何かあるまで走る。階段に乗って止まったら 聞く。 */
	private async dash(d: Dir8): Promise<void> {
		const wasOnStairs = this.onUsableStairs();
		await this.dashSteps(d);
		if (
			!wasOnStairs &&
			this.onUsableStairs() &&
			!this.stopped &&
			!this.run.s.end
		)
			await this.askStairs();
	}

	private async dashSteps(d: Dir8): Promise<void> {
		const run = this.run;
		// 混乱しているときは走らない（1歩だけ）
		if (run.p.status.confuse > 0) {
			await this.exec({ c: "move", dir: d });
			return;
		}
		let dir = d;
		const serial = this.ctx.input.serial;
		for (let n = 0; n < 60; n++) {
			if (this.stopped) return;
			// 走っているあいだに 何かに さわったら 止まる（さわった入力は 捨てる）
			if (n > 0 && this.ctx.input.serial !== serial) {
				this.swallowInput();
				return;
			}
			const snap = this.snapshot();
			if (n > 0 && snap.monsters > 0) return;
			if (
				!run.canStepTerrain(run.p, dir) ||
				run.monsterAt(step(run.p, dir).x, step(run.p, dir).y)
			) {
				// 通路の曲がり角はついていく
				if (n === 0 || roomAt(run.f.layout, run.p.x, run.p.y) >= 0) return;
				const ways = DIRS8.filter(
					(x) =>
						x !== (dir + 4) % 8 &&
						run.canStepTerrain(run.p, x) &&
						!isDiagonal(x),
				);
				if (ways.length !== 1) return;
				dir = ways[0];
			}
			const ev = await this.exec({ c: "move", dir }, true);
			if (!ev.length || this.shouldStop(snap, ev)) break;
			// 通路の分かれ道で止まる
			if (roomAt(run.f.layout, run.p.x, run.p.y) < 0) {
				const ways = DIRS8.filter(
					(x) => !isDiagonal(x) && run.canStepTerrain(run.p, x),
				).length;
				if (ways > 2) break;
			}
		}
	}

	/** タップした所へ1歩進む（知っている床だけを通る）。 */
	private async travelStep(): Promise<void> {
		const run = this.run;
		const to = this.travel;
		if (!to) return;
		if (to.x === run.p.x && to.y === run.p.y) {
			this.travel = null;
			await this.askStairs();
			return;
		}
		// 混乱しているとき・敵が見えているときは、タップした方へ1歩だけ
		const snap = this.snapshot();
		const d = this.pathStep(to);
		if (d === null) {
			this.travel = null;
			return;
		}
		if (run.p.status.confuse > 0 || snap.monsters > 0) this.travel = null;
		const wasOnStairs = this.onUsableStairs();
		const ev = await this.exec({ c: "move", dir: d }, true);
		if (this.stopped || run.s.end) {
			this.travel = null;
			return;
		}
		// 階段に乗ったら、行き先の途中でも・敵がいても 聞く（なぐられた1歩でも）
		if (
			!wasOnStairs &&
			this.onUsableStairs() &&
			ev.some((e) => e.t === "move" && e.id === PLAYER_ID)
		) {
			this.travel = null;
			await this.askStairs();
			return;
		}
		if (!ev.length || this.shouldStop(snap, ev, false)) {
			const arrived = run.p.x === to.x && run.p.y === to.y;
			this.travel = null;
			this.lastTravel = arrived ? null : to;
			if (arrived || snap.monsters === 0) await this.askStairs();
		}
	}

	private pathStep(to: Pos): Dir8 | null {
		const run = this.run;
		const f = run.f;
		const l = f.layout;
		const w = l.w;
		const start = run.p.y * w + run.p.x;
		const goal = to.y * w + to.x;
		const prev = new Int32Array(l.w * l.h).fill(-2);
		prev[start] = -1;
		const q = [start];
		const traps = new Set(
			f.traps.filter((t) => t.found).map((t) => t.y * w + t.x),
		);
		for (let h = 0; h < q.length; h++) {
			const i = q[h];
			if (i === goal) break;
			const x = i % w;
			const y = (i - x) / w;
			for (const d of DIRS8) {
				const n = step({ x, y }, d);
				if (!isFloor(l, n.x, n.y)) continue;
				const ni = n.y * w + n.x;
				if (prev[ni] !== -2 || !f.seen[ni]) continue;
				if (!run.cornerOk({ x, y }, d)) continue;
				if (traps.has(ni) && ni !== goal) continue;
				const m = run.monsterAt(n.x, n.y);
				if (m && run.monsterVisible(m)) continue;
				prev[ni] = i;
				q.push(ni);
			}
		}
		if (prev[goal] === -2) return null;
		let cur = goal;
		while (prev[cur] !== start && prev[cur] >= 0) cur = prev[cur];
		const x = cur % w;
		const y = (cur - x) / w;
		return dirOf(x - run.p.x, y - run.p.y);
	}
}

/** 道のり keys の、時刻 t の位置。 */
const posAt = (keys: Disp["keys"], t: number): Pos => {
	const a = keys[0];
	if (keys.length === 1 || t <= a.t) return { x: a.x, y: a.y };
	for (let i = 1; i < keys.length; i++) {
		const b = keys[i];
		if (t < b.t) {
			const p0 = keys[i - 1];
			const u = (t - p0.t) / (b.t - p0.t);
			return { x: p0.x + (b.x - p0.x) * u, y: p0.y + (b.y - p0.y) * u };
		}
	}
	const z = keys[keys.length - 1];
	return { x: z.x, y: z.y };
};

/** リプレイを見ているときの 再生の様子。 */
type ReplayDriver = {
	replay: SavedReplay;
	steps: ReplayStep[];
	/** 次に入れる こま。 */
	i: number;
	/** 入れたコマンドの数。 */
	done: number;
	total: number;
	paused: boolean;
	/** 速さ（1・2・4・8 倍）。 */
	speed: number;
	/** 次のコマンドを入れてよい時刻。 */
	nextAt: number;
	bar: HTMLElement | null;
	/** 今の版では同じにならなかった（指紋が合わない）。 */
	drift: boolean;
	/** 「次の階へ」を押された（再生中の1手が終わったら とばす）。 */
	skip: boolean;
};

/** コマンドとコマンドの間（ms。1倍のとき）。 */
const REPLAY_GAP = 160;

/** 食べる・飲む・読む演出。 */
type UseFx = {
	icon: string;
	style: "eat" | "drink" | "read";
	t0: number;
	dur: number;
};

/** 道具の区分ごとの演出（ほかの区分は演出なし）。 */
const USE_STYLE: Record<string, UseFx["style"] | undefined> = {
	food: "eat",
	herb: "drink",
	scroll: "read",
};

const USE_MS: Record<UseFx["style"], number> = {
	eat: 900,
	drink: 650,
	read: 650,
};

/** 演出の途中の、頭の上の道具の形。 */
const overheadPose = (u: UseFx, t: number) => {
	const k = Math.max(0, Math.min(1, (t - u.t0) / u.dur));
	// 出るときは ぽんと大きくなり、終わりぎわに消える
	const pop = Math.min(1, 0.4 + k * 6);
	const alpha = k > 0.82 ? 1 - (k - 0.82) / 0.18 : 1;
	switch (u.style) {
		case "eat": {
			// 3口。口ごとに はねて、ひと口ぶん小さくなる
			const bite = Math.min(2, Math.floor(k * 3));
			const ph = (k * 3) % 1;
			return {
				icon: u.icon,
				dy: Math.abs(Math.sin(ph * Math.PI)) * 3,
				scale: pop * (1 - bite * 0.2),
				angle: 0,
				alpha,
			};
		}
		case "drink": {
			// 持ち上げて、口もとへ傾ける
			const lift = Math.sin(Math.min(1, k * 1.8) * (Math.PI / 2));
			return {
				icon: u.icon,
				dy: lift * 4,
				scale: pop,
				angle: -lift * 0.7,
				alpha,
			};
		}
		case "read":
			// ふわっと浮かんで 消える
			return { icon: u.icon, dy: k * 6, scale: pop, angle: 0, alpha };
	}
};

/** 墓が落ちてくる時間（7割で着地して、残りで少しはねる）。 */
const GRAVE_DROP_MS = 600;

/** ms たつか、after ms より後に 画面に触れる・キーを押すまで待つ。 */
const waitOrSkip = (ms: number, after: number): Promise<void> =>
	new Promise((resolve) => {
		let done = false;
		const finish = () => {
			if (done) return;
			done = true;
			clearTimeout(tid);
			window.removeEventListener("pointerdown", finish, true);
			window.removeEventListener("keydown", finish, true);
			resolve();
		};
		const tid = setTimeout(finish, ms);
		setTimeout(() => {
			if (done) return;
			window.addEventListener("pointerdown", finish, true);
			window.addEventListener("keydown", finish, true);
		}, after);
	});

/** 1コマ（60fps）の長さ。 */
const FRAME_MS = 17;

const wait = (ms: number): Promise<void> =>
	new Promise((r) => setTimeout(r, Math.max(0, ms)));

const nextFrameP = (): Promise<void> =>
	new Promise((r) => requestAnimationFrame(() => r()));
