// 実況の 板（本館の 実況モニターの 別ゲー『ナイター実況』）。エンジンは core/jikkyo.ts、試合は core/jikkyoYakyu.ts、
// 文と 組み立ては data/jikkyo/yakyu.ts、TV は ui/jikkyoYakyuTv.ts、選ぶ 部品は ui/minigamePicker.ts。
// - 板：題・TV・ヘッダー（Part・レス・勢い・進み具合の バー）・スレ（DOM 40行まで）・候補の 引き出し・ノート・ヒント。
//   画面の 形（.narrow・.short-landscape）と 動きを へらす 設定は style.css の .mgame.jk。
// - 回す ループ：minigameBoard の tick で 1歩ずつ（dt は 100ms で 頭打ち）。画面が 隠れたら 止める
//   （開発の ?raf の ときだけ 止めない）。押した 時刻から ago を 出して エンジンへ わたす。
// - 保存は localStorage の kiriko-roguelike/jikkyo だけ（自己ベスト・回数・はじめての 印・最後の 試合・聞いた 実況民）。
//   開発用の 下見（?stage=・?event=）の あいだは 書かない。読めない・書けない ときは この回だけ 覚えて いる。
// - 冒険には 何も 効かない（ダンジョンの 力・持ち物・お金・旗なし）。試合の 種は ここで 作る（冒険の 乱数には 触らない）。
// - 開発ビルドだけ window.__jikkyo("yakyu", { seed, home, away, watch, speed }) で すぐ 開ける。

import {
	type JkEv,
	type JkFit,
	type JkInput,
	type JkLine,
	type JkResult,
	type JkView,
	jkStart,
	jkStep,
	jkView,
} from "../core/jikkyo";
import type { JkGame, JkTeamId } from "../core/jikkyoYakyu";
import { Rng } from "../core/rng";
import { today } from "../data/calendar";
import { HALL_MSG, JIKKYO } from "../data/hall";
import { GIKAI_TEXT } from "../data/jikkyo/gikai";
import { programSlot } from "../data/jikkyo/schedule";
import {
	JIKKYO_AFTER,
	JIKKYO_MENU,
	JIKKYO_MSG,
	JK_FEEDBACK,
	JK_RESULT,
	JK_TV,
	teamByChar,
	teamChar,
	YAKYU_POOLS,
	yakyuCard,
	yakyuGame,
	yakyuRules,
	yakyuTimeline,
	yakyuWho,
} from "../data/jikkyo/yakyu";
import { devEvent } from "../data/objectives";
import type { Script, Story } from "../engine/defs";
import { loadTown } from "../engine/save";
import { el } from "./dom";
import { hallGikai } from "./jikkyoGikai";
import { yakyuTv } from "./jikkyoYakyuTv";
import { markOpened, onTap, type UiCtx } from "./list";
import { tick } from "./minigameBoard";
import { picker } from "./minigamePicker";
import { previewStage, villageView } from "./villageReturn";

// ───────────────── 保存（kiriko-roguelike/jikkyo） ─────────────────

const KEY = "kiriko-roguelike/jikkyo";

export type JikkyoLast = {
	/** 試合の 種（かわったら heard を 空に）。 */
	id: string;
	home: JkTeamId;
	away: JkTeamId;
	h: number;
	a: number;
	winner: JkTeamId | null;
	star: string | null;
	kanso: boolean;
	part: number;
	next: number;
	at: number;
};

export type JikkyoMemo = {
	v: 1;
	best: { res: number; combo: number; ikioi: number };
	plays: number;
	kanso: number;
	tutored: boolean;
	last: JikkyoLast | null;
	/** 試合後の 1窓を もう 言った 本館の 人。 */
	heard: string[];
	/**
	 * 番組ごとの 記録（映画館・劇場。ui/jikkyoWatch.ts）。best は 届いた ★、rerun は 再上映で 届いた ★、
	 * said は 係員が もう 言った 1行の 鍵。
	 */
	prog?: Partial<
		Record<
			string,
			{
				best: number;
				kanso: number;
				kami: boolean;
				plays: number;
				howto: boolean;
				said: string[];
				rerun?: number;
			}
		>
	>;
	/** 議会中継の 見た 話・いちばん 新しく 見た 帰りと その 話（再放送か）。ui/jikkyoGikai.ts。 */
	gikai?: { seen: string[]; at: number; ep?: string; rerun?: boolean };
};

const EMPTY = (): JikkyoMemo => ({
	v: 1,
	best: { res: 0, combo: 0, ikioi: 0 },
	plays: 0,
	kanso: 0,
	tutored: false,
	last: null,
	heard: [],
});

let memo: JikkyoMemo | null = null;

const num = (x: unknown, d = 0): number =>
	typeof x === "number" && Number.isFinite(x) ? Math.max(0, x) : d;

/** 読む（壊れた JSON・足りない 欄は 初期値。prog・gikai が 無い 古い 形も 読める）。 */
export const loadJikkyo = (): JikkyoMemo => {
	if (memo) return structuredClone(memo);
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
		if (raw && typeof raw === "object" && raw.v === 1) {
			const e = EMPTY();
			return {
				...e,
				best: {
					res: num(raw.best?.res),
					combo: num(raw.best?.combo),
					ikioi: num(raw.best?.ikioi),
				},
				plays: num(raw.plays),
				kanso: num(raw.kanso),
				tutored: !!raw.tutored,
				last:
					raw.last && typeof raw.last === "object"
						? (raw.last as JikkyoLast)
						: null,
				heard: Array.isArray(raw.heard)
					? raw.heard.filter((x: unknown) => typeof x === "string")
					: [],
				...(raw.prog && typeof raw.prog === "object" ? { prog: raw.prog } : {}),
				...(raw.gikai && typeof raw.gikai === "object"
					? { gikai: raw.gikai }
					: {}),
			};
		}
	} catch {
		// 読めなければ はじめから
	}
	return EMPTY();
};

/** 書く（noSave なら この回だけ 覚える）。 */
export const saveJikkyo = (m: JikkyoMemo, noSave = false): void => {
	memo = structuredClone(m);
	if (noSave) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(m));
	} catch {
		// 保存できなくても この回は memo で 覚えている
	}
};

/** 試験用：覚えている 写しを 捨てる。 */
export const forgetJikkyoMemo = (): void => {
	memo = null;
};

/** 1試合の 記録（見るだけは best・plays・kanso に 数えない。last は 残す）。新しい 自己ベストなら true。 */
export const recordJikkyo = (
	game: JkGame,
	r: JkResult,
	opt: { noSave?: boolean; at?: number } = {},
): boolean => {
	const m = loadJikkyo();
	let newBest = false;
	if (!r.watch) {
		m.plays += 1;
		m.tutored = true;
		if (r.kanso) m.kanso += 1;
		if (r.res > m.best.res) {
			newBest = m.best.res > 0;
			m.best.res = r.res;
		}
		m.best.combo = Math.max(m.best.combo, r.comboMax);
		m.best.ikioi = Math.max(m.best.ikioi, r.ikioiMax);
	}
	if (m.last?.id !== game.seed) m.heard = [];
	m.last = {
		id: game.seed,
		home: game.home,
		away: game.away,
		h: game.final[1],
		a: game.final[0],
		winner: game.winner,
		star: game.star,
		kanso: r.kanso,
		part: r.part0,
		next: r.part,
		at: opt.at ?? Date.now(),
	};
	saveJikkyo(m, opt.noSave);
	return newBest;
};

const fill = (s: string, v: Record<string, string | number>): string =>
	s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));

/**
 * 本館の 実況民の 試合後の 1窓（まだ 聞いて いなければ）。jikkyo_<id> は 自分の 球団が 勝った・負けた・ほかの 試合、
 * nanashi_0 は 完走したか 止まったか。無ければ null。
 */
export const jikkyoAfterLine = (npcId: string): string | null => {
	const m = loadJikkyo();
	const last = m.last;
	if (!last || m.heard.includes(npcId)) return null;
	if (npcId === "nanashi_0") {
		const t = JIKKYO_AFTER.nanashi_0?.[last.kanso ? "kanso" : "stopped"];
		return t ? fill(t, { m: last.next }) : null;
	}
	if (!npcId.startsWith("jikkyo_")) return null;
	const key = npcId.slice("jikkyo_".length);
	const lines = JIKKYO_AFTER[key];
	const char = JIKKYO[key]?.team;
	if (!lines || !char) return null;
	const team = teamByChar(char);
	const played = team === last.home || team === last.away;
	const kind =
		!played || !last.winner ? "other" : last.winner === team ? "win" : "lose";
	const t = lines[kind];
	const star = last.star ?? (last.winner ? teamChar(last.winner) : char);
	return t ? fill(t, { star, m: last.next }) : null;
};

/** 試合後の 1窓を 言った 印。 */
export const markJikkyoHeard = (npcId: string, noSave = previewing()): void => {
	const m = loadJikkyo();
	if (!m.heard.includes(npcId)) m.heard.push(npcId);
	saveJikkyo(m, noSave);
};

/** 開発用の 下見（?stage=・?event=）の あいだ（保存は 書かない）。 */
const previewing = (): boolean =>
	previewStage() !== null || devEvent() !== null;

// ───────────────── 板 ─────────────────

export type JikkyoOutcome = {
	result: JkResult;
	game: JkGame;
	newBest: boolean;
};

const reducedMotion = (): boolean =>
	typeof matchMedia === "function" &&
	matchMedia("(prefers-reduced-motion: reduce)").matches;

const hasRaf = (): boolean =>
	typeof location !== "undefined" &&
	new URLSearchParams(location.search).has("raf");

const comma = (n: number) => Math.round(n).toLocaleString("en-US");

/** 札の 字の 色（地の 明るさで 黒か 白）。 */
const inkOn = (hex: string): string => {
	const [r, g, b] = [1, 3, 5].map((i) =>
		Number.parseInt(hex.slice(i, i + 2), 16),
	);
	return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111" : "#fff";
};

const MAX_LINES = 40;

/**
 * ナイター実況の 板で 1試合（B 2回で やめたら null。見るだけは B 1回で 閉じて null）。
 * 終わったら 結果カードを 出して、A・B・タップで 閉じる。記録は ここで 書く（noSave なら 書かない）。
 */
export const playJikkyo = async (
	ctx: UiCtx,
	game: JkGame,
	opt: {
		watch?: boolean;
		noSave?: boolean;
		speed?: number;
		/** 開発用：◎ を 0.8秒で 書く（window.__jikkyo の 確かめ だけ）。 */
		auto?: boolean;
	} = {},
): Promise<JikkyoOutcome | null> => {
	const watch = !!opt.watch;
	const speed = opt.speed ?? 1;
	const reduced = reducedMotion();
	const memo0 = loadJikkyo();
	const who = yakyuWho(game);
	const H = teamChar(game.home);
	const A = teamChar(game.away);
	const rules = yakyuRules(game);
	const tl = yakyuTimeline(game, Math.random);
	const st = jkStart(tl, rules, YAKYU_POOLS, {
		rand: Math.random,
		watch,
		tutored: memo0.tutored,
		reduced,
		part: game.part,
	});

	// ── DOM
	const tvCanvas = el("canvas", { class: "jk-tv" });
	const part = el("span", { class: "jk-part" });
	const resEl = el("span", { class: "jk-resno" });
	const ikioiEl = el("span", { class: "jk-ikioi" });
	const fillEl = el("i", { class: "jk-fill" });
	const ghost = el("i", { class: "jk-ghost" });
	const ghostLabel = el("span", { class: "jk-ghost-label" });
	const head = el("div", { class: "jk-head" }, [
		el("span", { class: "jk-headtitle", text: `${H}－${A}` }),
		part,
		resEl,
		ikioiEl,
		el("div", { class: "jk-bar" }, [fillEl, ghost, ghostLabel]),
	]);
	const thread = el("div", { class: "jk-thread" });
	thread.setAttribute("aria-hidden", "true");
	const picks = el("div", { class: "jk-picks" });
	const board = el("div", { class: "jk-board" }, [thread, picks]);
	const note = el("div", { class: "jk-note" });
	note.setAttribute("aria-live", "polite");
	const combo = el("div", { class: "jk-combo" });
	const root = el("div", { class: "mgame jk window" }, [
		el("div", {
			class: "jk-title",
			text: fill(JK_TV.board, { home: H, away: A }),
		}),
		tvCanvas,
		head,
		board,
		el("div", { class: "jk-noterow" }, [note, combo]),
		el("div", {
			class: "mgame-hint",
			text: watch ? JK_TV.hintWatch : JK_TV.hint,
		}),
	]);
	if (reduced) root.classList.add("still");
	ctx.ui.appendChild(root);

	// ── 入力（候補と B。1歩に 1つ）
	const queue: { kind: "pick" | "b"; i: number; at: number }[] = [];
	const pk = picker(ctx, picks, {
		digits: true,
		edges: true,
		aria: JK_TV.picks,
		onPick: (i, at) => queue.push({ kind: "pick", i, at }),
		onB: (at) => queue.push({ kind: "b", i: -1, at }),
	});
	const takeInput = (): JkInput | undefined => {
		const q = queue.shift();
		if (!q) return undefined;
		const ago = Math.max(0, performance.now() - q.at) * speed;
		return q.kind === "b" ? { quit: true } : { pick: q.i, ago };
	};

	const tv = yakyuTv(tvCanvas, game, { reduced });
	let noteTimer = 0;
	const say = (t: string, ms = 1200) => {
		note.textContent = t;
		window.clearTimeout(noteTimer);
		if (ms > 0)
			noteTimer = window.setTimeout(() => {
				note.textContent = "";
			}, ms);
	};

	// ── スレ
	const addLine = (l: JkLine) => {
		const style = who(l.who);
		const row = el("div", { class: "jk-res" });
		if (l.cls === "me") row.classList.add("jk-me");
		if (l.cls === "anc") row.classList.add("jk-anc");
		if (l.cls === "over") row.classList.add("jk-over");
		if (l.cls === "title") row.classList.add("jk-titleline");
		row.append(
			el("b", { class: "jk-no", text: l.no === null ? "" : String(l.no) }),
		);
		if (style.char) {
			const tag = el("i", { class: "jk-who", text: style.char });
			tag.style.setProperty("--c", style.color);
			tag.style.setProperty("--fg", inkOn(style.color));
			row.append(tag);
		}
		row.append(document.createTextNode(l.text));
		thread.append(row);
		while (thread.childElementCount > MAX_LINES)
			thread.firstElementChild?.remove();
		const rows = thread.children;
		for (let k = 0; k < rows.length; k++)
			rows[k].classList.toggle("old", k < rows.length - 10);
	};

	// ── ヘッダー
	const best = memo0.best.res;
	let kansoDone = false;
	const renderHead = (v: JkView) => {
		part.textContent = v.label;
		resEl.textContent = fill(JK_TV.res, { no: Math.min(v.no, 1000) });
		ikioiEl.textContent = fill(JK_TV.ikioi, { ikioi: comma(v.ikioi) });
		const target = !kansoDone
			? 1000
			: best > v.res
				? best
				: (Math.floor(v.res / 1000) + 1) * 1000;
		const left = Math.max(0, (v.total - v.t) / 1000);
		const okPace = v.res + v.pace * left >= target;
		fillEl.style.width = `${Math.min(100, (v.res / target) * 100)}%`;
		fillEl.classList.toggle("ok", okPace);
		const showGhost = kansoDone && best > 0 && best >= v.res * 0.5;
		ghost.style.display = showGhost ? "" : "none";
		ghostLabel.style.display = showGhost ? "" : "none";
		if (showGhost) {
			ghost.style.left = `${Math.min(100, (best / target) * 100)}%`;
			ghostLabel.textContent = fill(JK_FEEDBACK.ghost, { best: comma(best) });
		}
		combo.textContent =
			v.combo >= 2 ? fill(JK_FEEDBACK.combo, { c: v.combo }) : "";
		if (v.win && !v.win.reveal && !v.win.untimed) {
			const frac = v.win.left / v.win.open;
			picks.style.setProperty("--left", `${(frac * 100).toFixed(1)}%`);
			picks.classList.toggle("warn", v.win.left < 1000);
		} else picks.style.setProperty("--left", v.win?.untimed ? "100%" : "0%");
	};

	// ── 出来事
	let lastOpts: readonly { text: string; fit: JkFit }[] = [];
	const onEvs = (evs: JkEv[], now: number) => {
		for (const ev of evs) {
			tv.onEv(ev, now);
			switch (ev.t) {
				case "line":
					addLine(ev.line);
					break;
				case "roll":
					thread.replaceChildren();
					break;
				case "scene": {
					// 本塁打・サヨナラの 窓（打球が 柵を こえて 歓喜の 場面に なる ところ）
					const top = (ev.seg.data as { winTop?: string } | undefined)?.winTop;
					if (ev.seg.win && (top === "HR" || top === "walkoff"))
						ctx.se("hit_bat");
					if (watch && ev.seg.win) say(JK_FEEDBACK.rom, 1500);
					break;
				}
				case "open":
					if (ev.win.type !== "pick") break;
					lastOpts = ev.win.opts;
					pk.setLabels(ev.win.opts.map((o) => o.text));
					picks.classList.add("open");
					markOpened(picks);
					ctx.se("cursor");
					if (ev.untimed) say(JK_FEEDBACK.tutor, 0);
					if (opt.auto) {
						const best = ev.win.opts.findIndex((o) => o.fit === "best");
						window.setTimeout(
							() =>
								queue.push({ kind: "pick", i: best, at: performance.now() }),
							800 / speed,
						);
					}
					break;
				case "reveal": {
					pk.mark(
						lastOpts.map((o) => o.fit),
						ev.chosen,
					);
					if (ev.fit === null) {
						ctx.se("cancel");
						say(JK_FEEDBACK.late);
						break;
					}
					ctx.se("decide");
					if (ev.fit === "best" || ev.fast) ctx.se("critical");
					if (ev.fit === "miss") ctx.se("miss");
					const t = fill(JK_FEEDBACK[ev.fit], { g: ev.gain });
					say(ev.fast ? `${t}　${JK_FEEDBACK.fast}` : t);
					break;
				}
				case "close":
					picks.classList.remove("open");
					pk.close();
					break;
				case "combo":
					if (ev.combo === 5 || ev.combo === 10) ctx.se("levelup");
					break;
				case "kanso":
					kansoDone = true;
					ctx.se("victory");
					break;
				case "note":
					say(ev.text, 1500);
					break;
			}
		}
	};

	let result: JkResult | null = null;
	try {
		await tv.load();
		let last = await tick();
		for (;;) {
			const now = await tick();
			let dt = Math.min(100, now - last);
			last = now;
			if (document.hidden && !(import.meta.env.DEV && hasRaf())) dt = 0;
			const evs = jkStep(st, dt * speed, takeInput());
			onEvs(evs, now);
			const v = jkView(st);
			renderHead(v);
			tv.draw(now, v);
			const end = evs.find((e) => e.t === "end");
			if (end && end.t === "end") {
				result = end.result;
				break;
			}
		}
		if (!result) return null;
		// 見るだけも last は 残す（本館の 実況民が 感想を 言う）。best・plays・kanso には 数えない
		const newBest = recordJikkyo(game, result, { noSave: opt.noSave });
		await showResult(ctx, root, board, game, result, newBest, pk);
		return { result, game, newBest };
	} finally {
		pk.stop();
		window.clearTimeout(noteTimer);
		root.remove();
	}
};

/** 結果カード（A・B・タップで 閉じる）。 */
const showResult = async (
	ctx: UiCtx,
	root: HTMLElement,
	board: HTMLElement,
	game: JkGame,
	r: JkResult,
	newBest: boolean,
	pk: { stop(): void },
): Promise<void> => {
	pk.stop();
	const [a, h] = game.final;
	const best = Math.max(loadJikkyo().best.res, r.watch ? 0 : r.res);
	const lines = [
		fill(JK_RESULT.score, {
			home: teamChar(game.home),
			away: teamChar(game.away),
			h,
			a,
		}),
		r.kanso
			? fill(JK_RESULT.kanso, { n: r.part0, m: r.part })
			: fill(JK_RESULT.stopped, { res: comma(r.res) }),
		fill(JK_RESULT.ikioi, { ikioi: comma(r.ikioiMax) }),
		...(r.watch
			? []
			: [
					fill(JK_RESULT.combo, { c: r.comboMax }),
					fill(JK_RESULT.fits, {
						x: r.counts.best,
						y: r.counts.ok,
						z: r.counts.miss,
						w: r.counts.none,
					}),
					fill(JK_RESULT.best, { best: comma(best) }),
				]),
		...(newBest ? [JK_RESULT.new] : []),
	];
	const close = el("button", { class: "jk-close", text: JK_TV.close });
	close.type = "button";
	const box = el("div", { class: "jk-result" }, [
		...lines.map((t) => el("div", { text: t })),
		close,
	]);
	board.replaceChildren(box);
	root.classList.add("done");
	markOpened(box);
	await new Promise<void>((done) => {
		let finished = false;
		const end = () => {
			if (finished) return;
			finished = true;
			pop();
			done();
		};
		const pop = ctx.input.push(
			(k, repeat) => {
				if (!repeat && (k === "a" || k === "b" || k === "menu")) end();
			},
			{ tap: null },
		);
		onTap(close, box, end);
	});
};

// ───────────────── 本館の 実況モニター ─────────────────

/** 試合の 種（冒険の 乱数には 触らない）。 */
const newSeed = (): string => `jk:${Date.now()}${Math.random()}`;

/** メッセージ窓を 隠す（板を 出す 前に）。 */
const hideMsg = (s: Story) => s.wait(0);

/** カードを 引いて 試合を 作る（同じ 種なら 同じ カードと 試合）。 */
export const newYakyuGame = (seed = newSeed()): JkGame => {
	const { home, away } = yakyuCard(Rng.fromSeed(seed));
	return yakyuGame(seed, home, away);
};

/**
 * 本館の 実況モニター：カードの 窓 → 『実況する／チャンネルを　かえる／見るだけ／やめる』。
 * チャンネルを かえると 種を 作りなおす（何回でも）。はじめての 1回は 遊び方の 窓。終わったら 完走か 止まったかの 1窓。
 */
export const hallMonitor =
	(ctx: UiCtx): Script =>
	async (s) => {
		// 番組表（data/jikkyo/schedule.ts）で 本館の 枠を 引く。月曜は 議会中継が はじめの チャンネル
		// （ui/jikkyoGikai.ts。チャンネルを かえると ナイターの 録画）
		const stage = previewStage() ?? loadTown().stage;
		const slot = programSlot("hall", today(), stage, new Date().getFullYear());
		if (slot?.main.program === "gikai") {
			const r = await hallGikai(ctx, s, villageView());
			if (r !== "channel") return;
			await s.narrate(GIKAI_TEXT.record);
		} else {
			await s.narrate(HALL_MSG.monitor[0]);
			if (slot?.main.program !== "yakyu") {
				await s.narrate(HALL_MSG.monitor[1]);
				return;
			}
		}
		let game = newYakyuGame();
		for (;;) {
			const [a, h] = game.pre.score;
			await s.narrate(
				fill(JIKKYO_MSG.card, {
					home: teamChar(game.home),
					away: teamChar(game.away),
					h,
					a,
				}),
			);
			const n = await s.choose([...JIKKYO_MENU], { cancel: 3 });
			if (n === 1) {
				await s.narrate(JIKKYO_MSG.channel);
				game = newYakyuGame();
				continue;
			}
			if (n !== 0 && n !== 2) break;
			const watch = n === 2;
			if (!watch && !loadJikkyo().tutored) await s.narrate(JIKKYO_MSG.howto);
			await hideMsg(s);
			const out = await playJikkyo(ctx, game, { watch, noSave: previewing() });
			if (out)
				await s.narrate(
					out.result.kanso
						? JIKKYO_MSG.kanso
						: fill(JIKKYO_MSG.stopped, { n: out.result.res }),
				);
			return;
		}
		await s.narrate(HALL_MSG.monitor[1]);
	};

// ───────────────── 開発用 ─────────────────

if (import.meta.env.DEV && typeof window !== "undefined")
	(
		window as unknown as {
			__jikkyo: (
				id?: string,
				o?: {
					seed?: string;
					home?: JkTeamId;
					away?: JkTeamId;
					watch?: boolean;
					speed?: number;
					auto?: boolean;
				},
			) => Promise<JikkyoOutcome | null>;
		}
	).__jikkyo = async (_id = "yakyu", o = {}) => {
		const v = (window as unknown as { __village?: { ctx?: UiCtx } }).__village;
		const ctx = v?.ctx;
		if (!ctx) throw new Error("__jikkyo: no village");
		const seed = o.seed ?? newSeed();
		const card = yakyuCard(Rng.fromSeed(seed));
		const home = o.home ?? card.home;
		const away = o.away ?? (card.away === home ? card.home : card.away);
		const game = yakyuGame(seed, home, away);
		return playJikkyo(ctx, game, {
			watch: o.watch,
			noSave: true,
			speed: o.speed,
			auto: o.auto,
		});
	};
