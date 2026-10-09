// 台本の 番組の 板と 入口（映画館の 実況上映：金曜ロード保守『空飛ぶ鯖』・保守劇場の 紅白スレ合戦・
// 束の 番組＝銭湯の 大相撲・カジノの 競馬 ほか 14本。data/jikkyo/packs.ts、TV は ui/jikkyoTvs.ts の 一覧）。
// 会場に 番組が 2つ 以上 あれば（映画館の 夜の部と 昼の部 など）、入口で 番組を 選ぶ。
// エンジンは core/jikkyo.ts（overlay の 窓・Cue・950 の 当番・切れ目・黙る 窓・名前欄）、台本は data/jikkyo/sora.ts・kohaku.ts、
// 番組表は data/jikkyo/schedule.ts、TV は ui/jikkyoScenes.ts（映画館）・ui/jikkyoKohakuTv.ts（劇場）、
// 選ぶ 部品は ui/minigamePicker.ts。板の 形と 色は 野球と 同じ .mgame.jk（style.css）に 少し 足す。
// - 紅白：ヘッダーの 右は 勢いの かわりに キリコの 名前欄（0時までは「新年まで＠HH:MM:SS」、0時の あとは おみくじ）。
//   キリコの レスにも 名前欄を 小さく つける。除夜の 鐘で 黙って いれば「◎　だまって　聞いた」。
// - 入口 watchProgram：番組表で 枠を 引く → 「見る／やめる」→ はじめての 1回だけ 遊び方 → 席に つく 地の文 →
//   曲を 止めて 板（区切りの 曲）→ 村の 曲に もどす → 結果の 窓（のびた ★・完走・神エイム）。
// - 板：題（いまの スレタイ）・TV・ヘッダー（★・レス・勢い・目標への バー）・スレ（上に 止める 1行・切れ目・洪水・鯖が 重い）・
//   候補の 引き出し（山場は 大きな 1語の ボタンと 合図の 点）・ノート・ヒント。入力は 野球と 同じ（↑↓・A・←→・数字・タップ）。
//   B は 2回で 出る（罰なし）。
// - 保存は kiriko-roguelike/jikkyo の prog（番組ごとの 最高の ★・完走・神エイム・回数・遊び方を 見た・係員が 言った）。
//   開発用の 下見（?stage=・?event=）の あいだは 書かない。冒険には 何も 効かない。
// - 試験は setWatchHook で 板を 差しかえて 流れだけ 回す（src/sim/jikkyoTests.ts）。

import {
	compileScript,
	type JkEv,
	type JkInput,
	type JkLine,
	type JkOpt,
	type JkResult,
	type JkScript,
	type JkSlot,
	type JkView,
	jkStart,
	jkStep,
	jkView,
	scriptGoal,
} from "../core/jikkyo";
import { today } from "../data/calendar";
import { PROGRAMS } from "../data/jikkyo/index";
import { PACKS } from "../data/jikkyo/packs";
import { programMenuName, programSlots } from "../data/jikkyo/schedule";
import {
	JK_PROG_MSG,
	JK_PROG_RESULT,
	JK_PROG_TV,
	progMsg,
	STAFF_ONCE,
} from "../data/jikkyo/text";
import { devEvent } from "../data/objectives";
import type { Story } from "../engine/defs";
import { el } from "./dom";
import { type JikkyoMemo, loadJikkyo, saveJikkyo } from "./jikkyo";
import { soraTv } from "./jikkyoScenes";
import { PROGRAM_TVS } from "./jikkyoTvs";
import { markOpened, onTap, type UiCtx } from "./list";
import { tick } from "./minigameBoard";
import { picker } from "./minigamePicker";
import { villageSong } from "./villageMusic";
import { previewStage } from "./villageReturn";

/** 開発用の 下見（?stage=・?event=）の あいだ（保存は 書かない）。 */
const previewing = (): boolean =>
	previewStage() !== null || devEvent() !== null;

const fill = (s: string, v: Record<string, string | number>): string =>
	s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));

const comma = (n: number) => Math.round(n).toLocaleString("en-US");

// ───────────────── 保存（番組ごと） ─────────────────

/** 番組の id（sora・kohaku と 束の 番組。data/jikkyo/index.ts の PROGRAMS の 鍵）。 */
type ProgId = string;
type ProgMemo = NonNullable<NonNullable<JikkyoMemo["prog"]>[ProgId]>;

const progOf = (m: JikkyoMemo, id: ProgId): ProgMemo => {
	const p = m.prog?.[id];
	return {
		best: typeof p?.best === "number" ? p.best : 0,
		kanso: typeof p?.kanso === "number" ? p.kanso : 0,
		kami: !!p?.kami,
		plays: typeof p?.plays === "number" ? p.plays : 0,
		howto: !!p?.howto,
		said: Array.isArray(p?.said)
			? p.said.filter((x): x is string => typeof x === "string")
			: [],
		...(typeof p?.rerun === "number" ? { rerun: p.rerun } : {}),
	};
};

/** 番組の 記録（いまの 写し）。 */
export const programMemo = (id: ProgId): ProgMemo => progOf(loadJikkyo(), id);

const saveProg = (id: ProgId, p: ProgMemo, noSave: boolean): void => {
	const m = loadJikkyo();
	m.prog = { ...m.prog, [id]: p };
	saveJikkyo(m, noSave);
};

/** 1回の 上映の 記録（★ は 届いた スレ番）。新しい 最高なら true。 */
export const recordProgram = (
	id: ProgId,
	r: JkResult,
	slot: JkSlot,
	noSave = false,
): boolean => {
	const p = progOf(loadJikkyo(), id);
	const newBest = p.best > 0 && r.part > p.best;
	p.best = Math.max(p.best, r.part);
	p.plays += 1;
	p.howto = true;
	if (r.kanso) p.kanso += 1;
	if (r.cue === "kami") p.kami = true;
	if (!slot.live) {
		p.rerun = r.part;
		p.said = p.said.filter((k) => k !== "rerun");
	}
	saveProg(id, p, noSave);
	return newBest;
};

/** 遊び方を 見た 印（はじめての 1回だけ 窓を 出す）。 */
const markHowto = (id: ProgId, noSave: boolean): void => {
	const p = progOf(loadJikkyo(), id);
	if (p.howto) return;
	p.howto = true;
	saveProg(id, p, noSave);
};

/** 施設の 人 → 番組の id（1回だけの 1行を 持つ 人。束の 番組は 束の staffOnce）。 */
const ONCE_PROG: Readonly<Record<string, ProgId>> = {
	cinema: "sora",
	theater: "kohaku",
};

/** その 会場の 人が 1回だけ 言う 1行の 候補（前からの 表 → 束の 番組の 順）。 */
const onceOf = (
	fid: string,
	who: string,
): {
	id: ProgId;
	lines: Readonly<Partial<Record<"kami" | "rerun", string>>>;
}[] => {
	const out: {
		id: ProgId;
		lines: Readonly<Partial<Record<"kami" | "rerun", string>>>;
	}[] = [];
	const legacy = ONCE_PROG[fid];
	const ll = STAFF_ONCE[fid]?.[who];
	if (legacy && ll) out.push({ id: legacy, lines: ll });
	for (const p of PACKS) {
		const lines = p.staffOnce?.[who];
		if (!p.draft && p.venue === fid && lines)
			out.push({ id: p.script.id, lines });
	}
	return out;
};

/**
 * 会場の 人が 1回だけ 言う 1行（無ければ null）。言ったら 覚える（下見の あいだは 書かない）。
 * 神エイムの あとの 1行を 先に、再上映の あとの 1行（のびた ★）を 次に。
 */
export const staffOnceLine = (
	fid: string,
	who: string,
	noSave = previewing(),
): string | null => {
	for (const { id, lines } of onceOf(fid, who)) {
		const p = progOf(loadJikkyo(), id);
		let key: string | null = null;
		let text: string | null = null;
		if (p.kami && lines.kami && !p.said.includes("kami")) {
			key = "kami";
			text = lines.kami;
		} else if (p.rerun && lines.rerun && !p.said.includes("rerun")) {
			key = "rerun";
			text = fill(lines.rerun, { n: p.rerun });
		}
		if (!key || !text) continue;
		p.said.push(key);
		saveProg(id, p, noSave);
		return text;
	}
	return null;
};

// ───────────────── 板 ─────────────────

const reducedMotion = (): boolean =>
	typeof matchMedia === "function" &&
	matchMedia("(prefers-reduced-motion: reduce)").matches;

const hasRaf = (): boolean =>
	typeof location !== "undefined" &&
	new URLSearchParams(location.search).has("raf");

const MAX_LINES = 40;

/**
 * 番組の 板で 1回の 上映（B 2回で 出たら null）。終わったら 結果カードを 出して、A・B・タップで 閉じる。
 * 記録は ここで 書く（noSave なら 書かない）。bgm は 区切りの 曲を 鳴らす 手（村の Story の bgm）。
 */
export const playProgram = async (
	ctx: UiCtx,
	script: JkScript,
	slot: JkSlot,
	opt: {
		noSave?: boolean;
		speed?: number;
		/** 開発用：◎ を 0.8秒で 書き、山場は ちょうどで 押す（window.__jikkyo の 確かめ だけ）。 */
		auto?: boolean;
		bgm?: (name: string | null) => void;
	} = {},
): Promise<JkResult | null> => {
	if (watchHook) return watchHook(script, slot);
	const speed = opt.speed ?? 1;
	const reduced = reducedMotion();
	const id = script.id as ProgId;
	const best0 = progOf(loadJikkyo(), id).best;
	const { tl, rules, pools } = compileScript(script, slot, Math.random);
	const st = jkStart(tl, rules, pools, { rand: Math.random, reduced });
	const goal = rules.goal;

	// ── DOM
	const titleEl = el("div", { class: "jk-title" });
	const tvCanvas = el("canvas", { class: "jk-tv" });
	const part = el("span", { class: "jk-part" });
	const resEl = el("span", { class: "jk-resno" });
	const ikioiEl = el("span", { class: "jk-ikioi" });
	const fillEl = el("i", { class: "jk-fill" });
	const stars = Array.from({ length: Math.max(0, goal - 1) }, (_, k) => {
		const s = el("i", { class: "jk-star" });
		s.style.left = `${((k + 1) / goal) * 100}%`;
		return s;
	});
	// せまい 画面では 題を ヘッダーに たたむ（.jk-headtitle）
	const headTitle = el("span", { class: "jk-headtitle" });
	const head = el("div", { class: "jk-head" }, [
		headTitle,
		part,
		resEl,
		ikioiEl,
		el("div", { class: "jk-bar" }, [fillEl, ...stars]),
	]);
	const thread = el("div", { class: "jk-thread" });
	thread.setAttribute("aria-hidden", "true");
	const pinBar = el("div", { class: "jk-pinbar" });
	const flood = el("div", { class: "jk-flood" });
	const stall = el("div", { class: "jk-stall", text: JK_PROG_TV.stall });
	const picks = el("div", { class: "jk-picks" });
	const board = el("div", { class: "jk-board" }, [
		thread,
		flood,
		pinBar,
		stall,
		picks,
	]);
	const note = el("div", { class: "jk-note" });
	note.setAttribute("aria-live", "polite");
	const combo = el("div", { class: "jk-combo" });
	const root = el("div", { class: "mgame jk jk-prog window" }, [
		titleEl,
		tvCanvas,
		head,
		board,
		el("div", { class: "jk-noterow" }, [note, combo]),
		el("div", { class: "mgame-hint", text: JK_PROG_TV.hint }),
	]);
	if (reduced) root.classList.add("still");
	ctx.ui.appendChild(root);

	// ── 入力（候補・山場・B。1歩に 1つ）
	let kind: "pick" | "duty" | "cue" | null = null;
	const queue: { kind: "pick" | "press" | "b"; i: number; at: number }[] = [];
	const pk = picker(ctx, picks, {
		digits: true,
		edges: true,
		aria: JK_PROG_TV.picks,
		onPick: (i, at) =>
			queue.push({ kind: kind === "cue" ? "press" : "pick", i, at }),
		onB: (at) => queue.push({ kind: "b", i: -1, at }),
	});
	const takeInput = (): JkInput | undefined => {
		const q = queue.shift();
		if (!q) return undefined;
		const ago = Math.max(0, performance.now() - q.at) * speed;
		if (q.kind === "b") return { quit: true };
		if (q.kind === "press") return { press: true, ago };
		return { pick: q.i, ago };
	};

	const tv = (PROGRAM_TVS[id] ?? soraTv)(tvCanvas, {
		reduced,
		live: slot.live,
	});
	let noteTimer = 0;
	let pinTimer = 0;
	const say = (t: string, ms = 1400) => {
		note.textContent = t;
		window.clearTimeout(noteTimer);
		if (ms > 0)
			noteTimer = window.setTimeout(() => {
				note.textContent = "";
			}, ms);
	};

	// ── スレ
	const addLine = (l: JkLine) => {
		const row = el("div", { class: "jk-res" });
		if (l.cls === "me") row.classList.add("jk-me");
		if (l.cls === "anc") row.classList.add("jk-anc");
		if (l.cls === "over") row.classList.add("jk-over");
		if (l.cls === "title") row.classList.add("jk-titleline");
		if (l.cls === "pin") row.classList.add("jk-pinline");
		if (l.who === "sys" && l.cls !== "over") row.classList.add("jk-sys");
		row.append(
			el("b", { class: "jk-no", text: l.no === null ? "" : String(l.no) }),
		);
		if (l.who === "me") {
			const tag = el("i", { class: "jk-who", text: "★" });
			tag.style.setProperty("--c", "#ffe060");
			tag.style.setProperty("--fg", "#111");
			row.append(tag);
			// 名前欄（紅白の 時計・おみくじ）
			if (l.name) row.append(el("i", { class: "jk-name", text: l.name }));
		}
		row.append(document.createTextNode(l.text));
		thread.append(row);
		while (thread.childElementCount > MAX_LINES)
			thread.firstElementChild?.remove();
		const rows = thread.children;
		for (let k = 0; k < rows.length; k++)
			rows[k].classList.toggle("old", k < rows.length - 10);
	};
	const setPin = (l: JkLine, ms: number) => {
		pinBar.textContent = `${l.no ?? ""}　${l.text}`;
		pinBar.classList.add("on");
		pinBar.classList.toggle("over", l.cls === "over");
		window.clearTimeout(pinTimer);
		pinTimer = window.setTimeout(
			() => pinBar.classList.remove("on"),
			ms / speed,
		);
	};

	// ── ヘッダー
	const renderHead = (v: JkView) => {
		titleEl.textContent = v.title;
		headTitle.textContent = v.title;
		part.textContent = v.label;
		resEl.textContent = fill(JK_PROG_TV.res, { no: Math.min(v.no, 1000) });
		// 紅白は 名前欄（新年までの 時計・おみくじ）。無ければ 勢い
		ikioiEl.textContent =
			v.name ?? fill(JK_PROG_TV.ikioi, { ikioi: comma(v.ikioi) });
		ikioiEl.classList.toggle("jk-clock", v.name !== null);
		const G = Math.max(1, v.G);
		const left = Math.max(0, (v.total - v.t) / 1000);
		fillEl.style.width = `${Math.min(100, (v.res / G) * 100)}%`;
		fillEl.classList.toggle("ok", v.res + v.pace * left >= G);
		combo.textContent =
			v.combo >= 2 ? fill(JK_PROG_TV.combo, { c: v.combo }) : "";
		board.classList.toggle("stall", v.stall);
		if (v.win && !v.win.reveal) {
			const frac = v.win.left / Math.max(1, v.win.open);
			picks.style.setProperty("--left", `${(frac * 100).toFixed(1)}%`);
			picks.classList.toggle("warn", v.win.kind !== "cue" && v.win.left < 1000);
		} else picks.style.setProperty("--left", "0%");
	};

	// ── 出来事
	let lastOpts: readonly JkOpt[] = [];
	let dots: HTMLElement[] = [];
	const autoPick = (win: { opts: readonly JkOpt[] }) => {
		const best = win.opts.findIndex((o) => o.fit === "best");
		window.setTimeout(
			() => queue.push({ kind: "pick", i: best, at: performance.now() }),
			800 / speed,
		);
	};
	const onEvs = (evs: JkEv[], now: number) => {
		for (const ev of evs) {
			tv.onEv(ev, now);
			switch (ev.t) {
				case "line":
					addLine(ev.line);
					break;
				case "pin":
					addLine(ev.line);
					setPin(ev.line, ev.ms);
					break;
				case "roll":
					thread.replaceChildren();
					break;
				case "scene":
					if (ev.seg.bgm !== undefined) opt.bgm?.(ev.seg.bgm);
					break;
				case "open": {
					const v = jkView(st);
					kind = v.win?.kind ?? "pick";
					picks.classList.remove("cue", "duty");
					if (ev.win.type === "cue") {
						lastOpts = [];
						pk.setLabels([ev.win.word]);
						picks.classList.add("cue");
						dots = Array.from({ length: ev.win.pulses + 1 }, () => el("i"));
						picks.append(el("div", { class: "jk-cuedots" }, dots));
						say(JK_PROG_TV.cue, 2400);
						if (opt.auto) {
							const exactIn = v.win?.cue?.exactIn ?? 0;
							window.setTimeout(
								() =>
									queue.push({ kind: "press", i: 0, at: performance.now() }),
								Math.max(0, exactIn) / speed,
							);
						}
					} else {
						lastOpts = ev.win.opts;
						pk.setLabels(ev.win.opts.map((o) => o.text));
						if (kind === "duty") {
							picks.classList.add("duty");
							say(JK_PROG_TV.duty, 2000);
						}
						if (opt.auto) autoPick(ev.win);
					}
					picks.classList.add("open");
					markOpened(picks);
					ctx.se("cursor");
					break;
				}
				case "pulse":
					dots[ev.i]?.classList.add("on");
					ctx.se("cursor");
					break;
				case "grade": {
					dots.at(-1)?.classList.add("on", "exact");
					const g = JK_PROG_TV.grade[ev.grade];
					say(
						ev.grade === "none"
							? g
							: fill(JK_PROG_TV.gradeNote, { g, gain: ev.gain }),
						1800,
					);
					const fit =
						ev.grade === "kami"
							? "best"
							: ev.grade === "flying"
								? "miss"
								: ev.grade === "none"
									? null
									: "ok";
					pk.mark([fit], ev.grade === "none" ? null : 0);
					ctx.se(
						ev.grade === "kami"
							? "critical"
							: ev.grade === "flying"
								? "miss"
								: ev.grade === "none"
									? "cancel"
									: "decide",
					);
					break;
				}
				case "reveal": {
					pk.mark(
						lastOpts.map((o) => o.fit),
						ev.chosen,
					);
					if (ev.fit === null) {
						ctx.se("cancel");
						say(JK_PROG_TV.late);
						break;
					}
					// 黙って いる ことが 答えの 窓（紅白の 除夜の 鐘）
					if (ev.chosen === null) {
						ctx.se(ev.fit === "miss" ? "miss" : "critical");
						say(fill(JK_PROG_TV.silent, { g: ev.gain }));
						break;
					}
					ctx.se("decide");
					if (ev.fit === "best" || ev.fast) ctx.se("critical");
					if (ev.fit === "miss") ctx.se("miss");
					const t = fill(JK_PROG_TV[ev.fit], { g: ev.gain });
					say(ev.fast ? `${t}　${JK_PROG_TV.fast}` : t);
					break;
				}
				case "close":
					kind = null;
					picks.classList.remove("open", "cue", "duty");
					pk.close();
					break;
				case "combo":
					if (ev.combo === 5 || ev.combo === 10) ctx.se("levelup");
					break;
				case "kanso":
					ctx.se("victory");
					break;
				case "gap":
					board.classList.toggle("gap", ev.on);
					if (ev.on) say(JK_PROG_TV.gap, 1500);
					break;
				case "flood":
					board.classList.toggle("flood", ev.on);
					// ちょうどの 拍（押して いなくても 光らせる）
					if (ev.on) dots.at(-1)?.classList.add("on", "exact");
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
		const newBest = recordProgram(id, result, slot, !!opt.noSave);
		await showResult(
			ctx,
			root,
			board,
			result,
			goal,
			Math.max(best0, result.part),
			newBest,
			pk,
		);
		return result;
	} finally {
		pk.stop();
		window.clearTimeout(noteTimer);
		window.clearTimeout(pinTimer);
		root.remove();
	}
};

/** 結果カード（A・B・タップで 閉じる）。 */
const showResult = async (
	ctx: UiCtx,
	root: HTMLElement,
	board: HTMLElement,
	r: JkResult,
	goal: number,
	best: number,
	newBest: boolean,
	pk: { stop(): void },
): Promise<void> => {
	pk.stop();
	const R = JK_PROG_RESULT;
	const lines = [
		r.kanso ? fill(R.kanso, { goal }) : fill(R.over, { n: r.part }),
		fill(R.res, { res: comma(r.res) }),
		fill(R.ikioi, { ikioi: comma(r.ikioiMax) }),
		fill(R.combo, { c: r.comboMax }),
		fill(R.fits, {
			x: r.counts.best,
			y: r.counts.ok,
			z: r.counts.miss,
			w: r.counts.none,
		}),
		...(r.cue ? [fill(R.cue, { g: JK_PROG_TV.grade[r.cue] })] : []),
		fill(R.best, { best }),
		...(newBest ? [R.new] : []),
	];
	const close = el("button", { class: "jk-close", text: JK_PROG_TV.close });
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

// ───────────────── 入口 ─────────────────

/** 試験用：板の かわりに 結果を 返す 手（null で もどす）。 */
let watchHook:
	| ((script: JkScript, slot: JkSlot) => Promise<JkResult | null>)
	| null = null;
export const setWatchHook = (h: typeof watchHook): void => {
	watchHook = h;
};

/**
 * 場所の 番組を 見る（調べる 物の 文の あとで 呼ぶ）。番組が 無ければ 何も しない。
 * 「見る／やめる」→ はじめての 1回だけ 遊び方 → 席に つく → 板 → 結果の 窓。
 */
export const watchProgram = async (
	ctx: UiCtx,
	s: Story,
	venue: string,
	stage: number,
): Promise<void> => {
	const slots = programSlots(
		venue,
		today(),
		stage,
		new Date().getFullYear(),
	).filter((x) => PROGRAMS[x.program]);
	if (!slots.length) return;
	// 番組が 2つ 以上 ある 会場（映画館の 夜の部と 昼の部 など）は 番組を 選ぶ
	let slot = slots[0];
	if (slots.length > 1) {
		const names = slots.map((x) => programMenuName(x.program));
		const k = await s.choose([...names, JK_PROG_MSG.menu[1]], {
			cancel: names.length,
		});
		if (k < 0 || k >= names.length) return;
		slot = slots[k];
	}
	const script = PROGRAMS[slot.program];
	if (!script) return;
	const M = progMsg(script.id);
	if (slots.length === 1) {
		const n = await s.choose([...M.menu], { cancel: 1 });
		if (n !== 0) return;
	}
	const id = script.id as ProgId;
	const noSave = previewing();
	if (!progOf(loadJikkyo(), id).howto) {
		await s.narrate(fill(M.howto, { n: scriptGoal(script, slot) }));
		markHowto(id, noSave);
	}
	await s.narrate(M.seat);
	await s.wait(0);
	s.bgm(null);
	let r: JkResult | null = null;
	try {
		r = await playProgram(ctx, script, slot, {
			noSave,
			bgm: (b) => s.bgm(b),
		});
	} finally {
		s.bgm(villageSong());
	}
	if (!r) {
		await s.narrate(M.left);
		return;
	}
	await s.narrate(fill(M.over, { n: r.part }));
	if (r.kanso) await s.narrate(M.kanso);
	if (r.cue === "kami") await s.narrate(M.kami);
};

// ───────────────── 開発用 ─────────────────

if (import.meta.env.DEV && typeof window !== "undefined")
	(
		window as unknown as {
			__jikkyoShow: (
				id?: string,
				o?: {
					live?: boolean;
					mode?: "reha" | "rec";
					speed?: number;
					auto?: boolean;
				},
			) => Promise<JkResult | null>;
		}
	).__jikkyoShow = async (id = "sora", o = {}) => {
		const v = (window as unknown as { __village?: { ctx?: UiCtx } }).__village;
		const ctx = v?.ctx;
		const script = PROGRAMS[id];
		if (!ctx || !script) throw new Error("__jikkyoShow: no village or program");
		const y = new Date().getFullYear();
		const slot: JkSlot = o.mode
			? {
					program: id,
					live: false,
					mode: o.mode,
					y: o.mode === "rec" ? y - 1 : y,
				}
			: { program: id, live: o.live ?? true, y };
		return playProgram(ctx, script, slot, {
			noSave: true,
			speed: o.speed,
			auto: o.auto,
		});
	};
