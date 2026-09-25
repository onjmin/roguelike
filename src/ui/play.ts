// ダンジョンの画面：入力 → run.act → 出来事の演出 → 描画 をまわす。
//
// - core の状態は1回の act で一気に変わる。画面は出来事（GameEvent）を順に再生して、
//   キャラの表示位置（Disp）を動かしていく。再生が終わったら状態に合わせなおす。
// - 押しっぱなしで歩き続ける（トルネコと同じ）。キーボードは斜めの同時押しを少し待つ。
// - ダッシュ・タップ移動は、何かあったら止まる（敵が見えた・道具・階段・分かれ道・部屋の出入り）。

import { HUNGER_UNIT, LAST_DEPTH } from "../core/balance";
import {
	DIRS8,
	type Dir8,
	dirOf,
	dist,
	isDiagonal,
	type Pos,
	step,
} from "../core/geom";
import { isFloor, roomAt } from "../core/mapgen";
import { mdef } from "../core/monster";
import type { Run } from "../core/run";
import { type Command, type GameEvent, PLAYER_ID } from "../core/types";
import { saveRun } from "../engine/save";
import type { Screen } from "../engine/screen";
import { settings } from "../engine/settings";
import { TILE } from "../engine/types";
import type { Ctx } from "./ctx";
import { el, nextFrame } from "./dom";
import type { Hud } from "./hud";
import { itemIcon } from "./icons";
import { listWindow } from "./list";
import { type MenuAction, openFootMenu, openMainMenu, pickItem } from "./menu";
import { showRunEnd } from "./records";
import { drawMap, type Figure, FloorView, type Projectile } from "./render";
import { openSettings } from "./settings";

const KIRIKO = "pub:sprites/kiriko.png";

type Disp = Figure & {
	/** 動きの始まり・終わり（マス）と時刻。 */
	sx: number;
	sy: number;
	tx: number;
	ty: number;
	t0: number;
	dur: number;
	lungeT0: number;
	fadeT0: number;
	dying: boolean;
};

/** 階ごとの BGM。 */
const floorBgm = (run: Run): string => {
	if (run.f.houseAwake) return "battle";
	if (run.s.returning) return "tense";
	const d = run.s.depth;
	if (d >= LAST_DEPTH) return "lastboss";
	if (d <= 7) return "dungeon";
	if (d <= 13) return "field2";
	return "tense";
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
	private raf = 0;
	private stopped = false;
	private logEl: HTMLElement;
	private popsEl: HTMLElement;
	private mapEl: HTMLCanvasElement;
	private mapOn = false;
	private fadeEl: HTMLElement;
	private lastStepAt = 0;
	private lastSavedTurn = -1;
	private resolveEnd: (() => void) | null = null;
	/** タップ移動の行き先。 */
	private travel: Pos | null = null;
	private statusKey = "";

	constructor(run: Run, ctx: Ctx, screen: Screen, hud: Hud) {
		this.run = run;
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
			this.syncDisp(true);
			this.ctx.audio.bgm(floorBgm(this.run));
			this.ctx.input.onFieldTap = (x, y) => this.onTap(x, y);
			void this.floorCard(true);
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
		cancelAnimationFrame(this.raf);
		this.ctx.input.onFieldTap = null;
		document.removeEventListener("visibilitychange", this.onHide);
		window.removeEventListener("pagehide", this.onHide);
		this.logEl.remove();
		this.popsEl.remove();
		this.mapEl.remove();
		this.fadeEl.remove();
		this.hud.status.innerHTML = "";
		this.resolveEnd?.();
	}

	private save(force = false): void {
		const s = this.run.s;
		if (s.end) return;
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
					sx: x,
					sy: y,
					tx: x,
					ty: y,
					t0: 0,
					dur: 0,
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
				d.sx = x;
				d.sy = y;
				d.tx = x;
				d.ty = y;
				d.fx = x;
				d.fy = y;
				d.t0 = now;
				d.dur = 0;
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
		for (const d of this.disp.values()) {
			if (d.dur > 0) {
				const k = Math.min(1, (t - d.t0) / d.dur);
				d.fx = d.sx + (d.tx - d.sx) * k;
				d.fy = d.sy + (d.ty - d.sy) * k;
			} else {
				d.fx = d.tx;
				d.fy = d.ty;
			}
			const lk = (t - d.lungeT0) / 150;
			d.lunge = lk >= 0 && lk < 1 ? Math.sin(lk * Math.PI) : 0;
			if (d.dying) {
				d.fade = Math.min(1, (t - d.fadeT0) / 320);
				if (d.fade >= 1) this.disp.delete(d.id);
			}
		}
		if (!this.busy) this.control(t);
		this.updateCamera();
		this.updateStatus();
		if (this.mapOn) {
			const vis = this.run.f.monsters.filter(
				(m) => this.run.monsterVisible(m) && !m.disguise,
			);
			drawMap(this.mapEl, this.run.s, { visibleMonsters: vis });
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
			: 230;
		const hCss = sc.height * cssPerSrc;
		const centerCss = topCss + Math.max(40, hCss - topCss - bottomCss) / 2;
		const cx = pd.fx * TILE + TILE / 2 - sc.width / 2;
		const cy = pd.fy * TILE + TILE / 2 - centerCss / cssPerSrc;
		this.camX = sc.snap(cx);
		this.camY = sc.snap(cy);
	}

	private draw(t: number): void {
		const run = this.run;
		const figs: Figure[] = [];
		const fakeItems: { x: number; y: number; kind: string }[] = [];
		for (const d of this.disp.values()) {
			if (d.id === PLAYER_ID) {
				figs.push({ ...d, asleep: run.p.status.sleep > 0 });
				continue;
			}
			if (d.dying) {
				figs.push(d);
				continue;
			}
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
			run.s,
			LAST_DEPTH,
			figs,
			this.projectiles,
			this.camX,
			this.camY,
			t,
			itemIcon,
			fakeItems,
		);
	}

	// ───────────────── ステータス行 ─────────────────

	private updateStatus(): void {
		const run = this.run;
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
		const key = `${run.s.depth}|${p.lv}|${p.hp}|${p.maxHp}|${hunger}|${left}|${badges.join()}|${run.s.returning}`;
		if (key === this.statusKey) return;
		this.statusKey = key;
		const low = p.hp <= p.maxHp / 4;
		const depthLabel = `${run.s.returning ? "↑" : ""}B${run.s.depth}`;
		this.hud.status.innerHTML =
			`<div class="st-row"><span class="st-depth">${depthLabel}</span><span>Lv${p.lv}</span>` +
			`<span class="st-hp${low ? " low" : ""}">HP ${p.hp}/${p.maxHp}</span></div>` +
			`<div class="st-bar${low ? " low" : ""}"><i style="width:${Math.round((p.hp / p.maxHp) * 100)}%"></i></div>` +
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

	private addLog(text: string, tone?: "warn" | "good"): void {
		const line = el("div", {
			class: `log-line${tone ? ` ${tone}` : ""}`,
			text,
		});
		this.logEl.appendChild(line);
		const lines = [...this.logEl.children];
		if (lines.length > 3)
			lines.slice(0, lines.length - 3).forEach((l) => l.remove());
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
		const key = input.takeField();
		if (key) {
			this.travel = null;
			void this.onKey(key);
			return;
		}
		const dir = input.heldDir();
		if (dir !== null) {
			this.travel = null;
			// キーボードの斜め（2つ同時押し）を少しだけ待つ
			if (input.heldFor() < 45) return;
			const mods = input.mods();
			if (mods.turn) {
				if (this.run.p.dir !== dir) void this.exec({ c: "turn", dir });
				return;
			}
			if (mods.diag && !isDiagonal(dir)) return;
			const gap = settings.speed === "fast" ? 70 : 115;
			if (t - this.lastStepAt < gap) return;
			this.lastStepAt = t;
			if (mods.dash) void this.dash(dir);
			else void this.exec({ c: "move", dir });
			return;
		}
		if (this.travel) void this.travelStep();
	}

	private async onKey(key: string): Promise<void> {
		const run = this.run;
		switch (key) {
			case "a":
				await this.exec({ c: "attack" });
				return;
			case "b":
				await this.menu(openMainMenu(this.ctx, run));
				return;
			case "wait":
				await this.exec({ c: "wait" });
				return;
			case "foot":
				await this.menu(openFootMenu(this.ctx, run));
				return;
			case "map":
				this.toggleMap();
				return;
			case "stairs":
				if (run.onStairs()) await this.exec({ c: "stairs" });
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

	private onTap(cssX: number, cssY: number): void {
		if (this.busy) return;
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
			if (m && (run.monsterVisible(m) || m.disguise)) {
				void this.exec({ c: "attack", dir: d });
				return;
			}
			void this.exec({ c: "move", dir: d });
			return;
		}
		const l = run.f.layout;
		if (x < 0 || y < 0 || x >= l.w || y >= l.h) return;
		if (!run.f.seen[y * l.w + x] || !isFloor(l, x, y)) return;
		this.travel = { x, y };
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
		try {
			ev = run.act(cmd);
			await this.playEvents(ev, fast);
			this.syncDisp();
			// 巻物の「どれに？」（メニューを通さずに来たとき）
			const pick = ev.find((e) => e.t === "fx" && e.kind.startsWith("pick:"));
			if (pick && pick.t === "fx" && cmd.c === "use") {
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
			if (run.s.end) {
				// 倒れた（持ち帰った）その場で中断セーブを片づける（閉じても やり直せないように）
				saveRun(run.s);
				await this.ending();
				return ev;
			}
			this.save();
			// 階段に乗ったら聞く（ダッシュ・タップ移動の途中では聞かない）
			const moved = before.x !== run.p.x || before.y !== run.p.y;
			if (
				!fast &&
				moved &&
				run.onStairs() &&
				!wasOnStairs &&
				!ev.some((e) => e.t === "floor")
			) {
				this.busy = false;
				await this.askStairs();
			}
		} finally {
			this.busy = false;
		}
		return ev;
	}

	private async askStairs(): Promise<void> {
		const run = this.run;
		if (run.s.depth >= LAST_DEPTH && !run.s.returning) {
			this.addLog("これより　下へは　行けないようだ");
			return;
		}
		const left = run.cardsLeft();
		const up = run.s.returning;
		const title = up
			? "階段を　上りますか？"
			: left > 0
				? `階段を　降りますか？<br><small>この階には　まだ　札が　${left}枚　あります</small>`
				: "階段を　降りますか？";
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
		const stepMs = (fast ? 45 : 110) * (settings.speed === "fast" ? 0.7 : 1);
		let i = 0;
		let combat = false;
		while (i < ev.length) {
			const e = ev[i];
			// 続けて動く出来事はまとめて同時に動かす
			if (e.t === "move") {
				const now = performance.now();
				let j = i;
				while (j < ev.length && (ev[j].t === "move" || ev[j].t === "turn")) {
					const m = ev[j];
					if (m.t === "move") {
						const d = this.disp.get(m.id);
						if (d) {
							d.sx = d.fx;
							d.sy = d.fy;
							d.tx = m.to.x;
							d.ty = m.to.y;
							d.t0 = now;
							d.dur = stepMs;
							d.dir = m.dir;
						}
					} else if (m.t === "turn") {
						const d = this.disp.get(m.id);
						if (d) d.dir = m.dir;
					}
					j++;
				}
				await wait(stepMs);
				i = j;
				continue;
			}
			i++;
			switch (e.t) {
				case "msg":
					this.addLog(e.text, e.tone);
					break;
				case "se":
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
				case "appear":
					this.syncDisp();
					break;
				case "warp": {
					const d = this.disp.get(e.id);
					if (d) {
						d.sx = d.tx = d.fx = e.to.x;
						d.sy = d.ty = d.fy = e.to.y;
						d.dur = 0;
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
					this.ctx.audio.bgm("battle");
					break;
				case "quake":
					document.body.classList.add("shake");
					await wait(e.level >= 3 ? 700 : 400);
					document.body.classList.remove("shake");
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

	private isShown(id: number, pos: Pos): boolean {
		if (id === PLAYER_ID) return true;
		return this.run.playerSees(pos);
	}

	private async flyBolt(
		e: Extract<GameEvent, { t: "bolt" }>,
		speed: number,
	): Promise<void> {
		const n = Math.max(1, dist(e.from, e.to));
		const ms = Math.min(420, n * 38) * speed;
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
		};
		this.projectiles.push(proj);
		const t0 = performance.now();
		for (;;) {
			const k = Math.min(1, (performance.now() - t0) / ms);
			proj.x = e.from.x + (e.to.x - e.from.x) * k;
			proj.y = e.from.y + (e.to.y - e.from.y) * k;
			if (k >= 1) break;
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
	private async floorCard(first: boolean): Promise<void> {
		const run = this.run;
		this.view.invalidate();
		this.syncDisp(true);
		this.travel = null;
		this.fadeEl.style.transition = "none";
		this.fadeEl.style.opacity = "1";
		const up = run.s.returning;
		const card = el("div", { class: "chapter shown" }, [
			el("div", {
				class: "chapter-label",
				text: up ? "帰り道" : "過去ログの底",
			}),
			el("div", { class: "chapter-title", text: `地下　${run.s.depth}階` }),
			el("div", {
				class: "chapter-sub",
				text: up
					? "上り階段を　さがそう"
					: run.s.depth >= LAST_DEPTH
						? "いちばん　底"
						: "",
			}),
		]);
		this.ctx.ui.appendChild(card);
		if (!first) await this.ctx.audio.fadeBgm(300);
		await wait(first ? 900 : 1100);
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
		await wait(700);
		this.busy = true;
		await showRunEnd(this.ctx, s);
		this.stop();
	}

	// ───────────────── ダッシュ・タップ移動 ─────────────────

	/** 何かあったら止まるかどうか（ダッシュ・タップ移動）。 */
	private shouldStop(
		before: { monsters: number; room: number },
		ev: GameEvent[],
	): boolean {
		const run = this.run;
		if (run.s.end) return true;
		if (ev.some((e) => e.t === "msg" && e.tone === "warn")) return true;
		if (ev.some((e) => e.t === "hurt" || e.t === "floor" || e.t === "warp"))
			return true;
		const p = run.p;
		if (run.itemAt(p.x, p.y) || run.onStairs()) return true;
		const vis = run.f.monsters.filter(
			(m) => run.monsterVisible(m) && !m.disguise,
		).length;
		if (vis > before.monsters) return true;
		const room = roomAt(run.f.layout, p.x, p.y);
		if (room !== before.room) return true;
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

	/** d の向きに、何かあるまで走る。 */
	private async dash(d: Dir8): Promise<void> {
		const run = this.run;
		let dir = d;
		for (let n = 0; n < 60; n++) {
			if (this.stopped) return;
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
		if (this.run.onStairs() && !this.stopped) await this.askStairs();
	}

	/** タップした所へ1歩進む（知っている床だけを通る）。 */
	private async travelStep(): Promise<void> {
		const run = this.run;
		const to = this.travel;
		if (!to) return;
		if (to.x === run.p.x && to.y === run.p.y) {
			this.travel = null;
			if (run.onStairs()) await this.askStairs();
			return;
		}
		const d = this.pathStep(to);
		if (d === null) {
			this.travel = null;
			return;
		}
		const snap = this.snapshot();
		const ev = await this.exec({ c: "move", dir: d }, true);
		if (!ev.length || this.shouldStop(snap, ev)) {
			const arrived = run.p.x === to.x && run.p.y === to.y;
			this.travel = null;
			if (run.onStairs() && (arrived || snap.monsters === 0))
				await this.askStairs();
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

const wait = (ms: number): Promise<void> =>
	new Promise((r) => setTimeout(r, Math.max(0, ms)));

const nextFrameP = (): Promise<void> =>
	new Promise((r) => requestAnimationFrame(() => r()));
