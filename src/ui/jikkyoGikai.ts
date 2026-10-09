// 議会中継（見るだけの 実況番組）の 板と 村の 入口。中身と 時間割は data/jikkyo/gikai.ts、エンジンは core/jikkyo.ts
// （interactive:false）、番組表は data/jikkyo/schedule.ts、議会の 日は data/civic.ts。
// - 板：題・TV（議場の 絵と 話し手の テロップ）・ヘッダー（中継・レス・勢い）・スレ（議長の 発言は 上に 止める。
//   2行の 発言は 2行で）・ノート・ヒント。A で 早送り（×3 と ふつうを 切りかえ）、B 1回で 閉じる。
// - 村：町役場・市役所の 中継モニター（議会の 日だけ。ほかの 日は 部屋の 文）、本館の 実況モニターの 月曜。
//   2窓（番組名と 見どころ）→ 見る？ → 板。1回の 帰りに 新しい 話 1つ、全部 見たら 再放送。
// - 保存は kiriko-roguelike/jikkyo の gikai（見た 話）だけ。開発用の 下見の あいだは 書かない。強さには 何も 効かない。

import {
	type JkEv,
	type JkLine,
	type JkView,
	jkStart,
	jkStep,
	jkView,
} from "../core/jikkyo";
import { today } from "../data/calendar";
import { inSession } from "../data/civic";
import {
	GIKAI_EPISODES,
	GIKAI_TEXT,
	type GikaiData,
	type GikaiEpisode,
	type GikaiMemo,
	type GikaiPlace,
	gikaiEpisodeFor,
	gikaiProgram,
	gikaiWatched,
} from "../data/jikkyo/gikai";
import { programSlot } from "../data/jikkyo/schedule";
import { MOBS, type MobId, movedIn } from "../data/mobs";
import { devEvent } from "../data/objectives";
import { SPEAKERS } from "../data/quotes";
import { stepOf, type VillageView } from "../data/village/map";
import type { Story } from "../engine/defs";
import { el } from "./dom";
import { returnAt } from "./guests";
import { loadJikkyo, saveJikkyo } from "./jikkyo";
import { clamp01, person, text } from "./jikkyoScenes";
import type { UiCtx } from "./list";
import { tick } from "./minigameBoard";
import { previewStage } from "./villageReturn";

const previewing = (): boolean =>
	previewStage() !== null || devEvent() !== null;

const fill = (s: string, v: Record<string, string | number>): string =>
	s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));

const comma = (n: number) => Math.round(n).toLocaleString("en-US");

// ───────────────── 保存（見た 話） ─────────────────

const EMPTY_MEMO: GikaiMemo = { seen: [], at: -1 };

/** 見た 話の 記録（壊れて いれば はじめから）。 */
export const gikaiMemo = (): GikaiMemo => {
	const g = loadJikkyo().gikai as Partial<GikaiMemo> | undefined;
	if (!g || typeof g !== "object") return EMPTY_MEMO;
	return {
		seen: Array.isArray(g.seen)
			? g.seen.filter((x): x is string => typeof x === "string")
			: [],
		at: typeof g.at === "number" ? g.at : -1,
		...(typeof g.ep === "string" ? { ep: g.ep } : {}),
		...(typeof g.rerun === "boolean" ? { rerun: g.rerun } : {}),
	};
};

const saveGikai = (m: GikaiMemo, noSave: boolean): void => {
	const j = loadJikkyo();
	j.gikai = {
		seen: [...m.seen],
		at: m.at,
		...(m.ep ? { ep: m.ep } : {}),
		...(m.rerun !== undefined ? { rerun: m.rerun } : {}),
	};
	saveJikkyo(j, noSave);
};

// ───────────────── 話し手 ─────────────────

/** 話し手の 札（エンジンの who → 字と 色）。名無しの レスは 札なし。 */
const whoTag = (who: string): { text: string; color: string } | null => {
	if (who === "chair") return { text: GIKAI_TEXT.chair, color: "#c0a030" };
	if (!who.startsWith("cast:")) return null;
	const id = who.slice(5);
	if (id === "roze")
		return { text: SPEAKERS.roze.name, color: SPEAKERS.roze.color };
	const def = MOBS[id as MobId];
	return def ? { text: def.name, color: "#7fb0ff" } : null;
};

// ───────────────── TV（議場） ─────────────────

type G = CanvasRenderingContext2D;

/** 議場の 絵（塗るだけ）：奥の 壁と 旗・議長席・演壇・議席、話し手に 光、下に テロップ。 */
const gikaiTv = (
	canvas: HTMLCanvasElement,
	opt: { reduced: boolean; rerun: boolean; place: GikaiPlace },
) => {
	canvas.width = 480;
	canvas.height = 270;
	const g0 = canvas.getContext("2d");
	if (!g0) throw new Error("canvas");
	const g: G = g0;
	let speaker: { who: string; at: number } = { who: "res", at: 0 };
	return {
		onEv: (ev: JkEv, now: number) => {
			if ((ev.t === "line" || ev.t === "pin") && ev.line.who !== "nanashi")
				speaker = { who: ev.line.who, at: now };
		},
		draw: (now: number, v: JkView) => {
			g.setTransform(2, 0, 0, 2, 0, 0);
			g.imageSmoothingEnabled = false;
			// 奥の 壁・床
			g.fillStyle = "#e8e0cc";
			g.fillRect(0, 0, 240, 135);
			g.fillStyle = "#8a6a3a";
			g.fillRect(0, 56, 240, 79);
			g.fillStyle = "#6a4a2a";
			for (let x = 0; x < 240; x += 16) g.fillRect(x, 56, 1, 79);
			// 旗（町・市の 旗：>>1 の 字）
			g.fillStyle = "#3a6ab0";
			g.fillRect(106, 6, 28, 18);
			text(g, ">>1", 120, 10, 9, "#ffffff");
			// 議長席（台）
			g.fillStyle = "#5a3a20";
			g.fillRect(86, 40, 68, 14);
			g.fillStyle = "#7a5230";
			g.fillRect(86, 40, 68, 3);
			// 演壇
			g.fillStyle = "#5a3a20";
			g.fillRect(110, 70, 20, 12);
			// 議席（2列）
			for (const [y, xs] of [
				[92, [20, 50, 80, 150, 180, 210]],
				[108, [10, 40, 70, 160, 190, 220]],
			] as const)
				for (const x of xs) {
					g.fillStyle = "#4a3018";
					g.fillRect(x, y + 10, 14, 5);
					person(g, x + 4, y, "#3a4a6a", "#2a2018");
				}
			// 話し手に 光（議長は 議長席、住人は 演壇）
			const chair = speaker.who === "chair";
			const sy = chair ? 28 : 58;
			const glow = opt.reduced ? 1 : 0.75 + 0.25 * Math.sin(now / 300);
			if (speaker.who !== "res") {
				g.globalAlpha = 0.35 * glow;
				g.fillStyle = "#fff6c0";
				g.beginPath();
				g.ellipse(120, sy + 8, 16, 12, 0, 0, Math.PI * 2);
				g.fill();
				g.globalAlpha = 1;
			}
			person(g, 117, 28, "#2a2a36", "#c0c0c0");
			if (!chair && speaker.who !== "res")
				person(g, 117, 58, "#7a3a5a", "#3a2a1a");
			// テロップ（議題と 話し手）
			const data = (v.seg?.data ?? null) as GikaiData | null;
			g.fillStyle = "rgba(10, 14, 40, 0.85)";
			g.fillRect(0, 117, 240, 18);
			const tag = whoTag(speaker.who);
			const fresh = clamp01((now - speaker.at) / 300);
			if (tag && speaker.who !== "res") {
				g.globalAlpha = opt.reduced ? 1 : fresh;
				g.fillStyle = tag.color;
				g.fillRect(4, 120, 46, 12);
				text(g, tag.text, 27, 121, 9, "#111", {});
				g.globalAlpha = 1;
			}
			text(g, data?.title ?? "", 140, 121, 9, "#ffffff");
			// LIVE（再放送）
			g.fillStyle = opt.rerun ? "#6a6a8a" : "#d03030";
			g.fillRect(4, 4, opt.rerun ? 34 : 24, 11);
			text(
				g,
				opt.rerun ? "再放送" : "LIVE",
				opt.rerun ? 21 : 16,
				5,
				8,
				"#ffffff",
			);
		},
	};
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
 * 議会中継の 板で 1話（見るだけ）。最後まで 流れたら true、B で 閉じたら false。
 * onchan は 議長が おんちゃんか（名無しの 議長は 口ぐせの ない 文）。
 */
export const playGikai = async (
	ctx: UiCtx,
	ep: GikaiEpisode,
	o: { onchan: boolean; rerun: boolean; place: GikaiPlace; speed?: number },
): Promise<boolean> => {
	const reduced = reducedMotion();
	const { tl, rules, pools } = gikaiProgram(ep, o);
	const st = jkStart(tl, rules, pools, { rand: Math.random, reduced });
	let speed = o.speed ?? 1;

	const titleEl = el("div", { class: "jk-title" });
	const tvCanvas = el("canvas", { class: "jk-tv" });
	const part = el("span", { class: "jk-part" });
	const resEl = el("span", { class: "jk-resno" });
	const ikioiEl = el("span", { class: "jk-ikioi" });
	const headTitle = el("span", { class: "jk-headtitle" });
	const head = el("div", { class: "jk-head" }, [
		headTitle,
		part,
		resEl,
		ikioiEl,
	]);
	const thread = el("div", { class: "jk-thread" });
	thread.setAttribute("aria-hidden", "true");
	const pinBar = el("div", { class: "jk-pinbar" });
	const board = el("div", { class: "jk-board" }, [thread, pinBar]);
	const note = el("div", { class: "jk-note" });
	note.setAttribute("aria-live", "polite");
	const root = el("div", { class: "mgame jk jk-prog jk-gikai window" }, [
		titleEl,
		tvCanvas,
		head,
		board,
		el("div", { class: "jk-noterow" }, [note]),
		el("div", { class: "mgame-hint", text: GIKAI_TEXT.hint }),
	]);
	if (reduced) root.classList.add("still");
	ctx.ui.appendChild(root);
	const tv = gikaiTv(tvCanvas, { reduced, rerun: o.rerun, place: o.place });

	let quit = false;
	const pop = ctx.input.push(
		(k, repeat) => {
			if (repeat) return;
			if (k === "b" || k === "menu") quit = true;
			else if (k === "a") {
				speed = speed > 1 ? 1 : 3;
				note.textContent = speed > 1 ? GIKAI_TEXT.fast : GIKAI_TEXT.normal;
			}
		},
		{ tap: "a" },
	);
	let pinTimer = 0;

	const addLine = (l: JkLine) => {
		const row = el("div", { class: "jk-res" });
		if (l.cls === "title") row.classList.add("jk-titleline");
		if (l.cls === "pin") row.classList.add("jk-pinline");
		if (l.text.includes("\n")) row.classList.add("jk-two");
		row.append(
			el("b", { class: "jk-no", text: l.no === null ? "" : String(l.no) }),
		);
		const tag = whoTag(l.who);
		if (tag) {
			const t = el("i", { class: "jk-who", text: tag.text });
			t.style.setProperty("--c", tag.color);
			t.style.setProperty("--fg", "#111");
			row.append(t);
		}
		row.append(document.createTextNode(l.text));
		thread.append(row);
		while (thread.childElementCount > MAX_LINES)
			thread.firstElementChild?.remove();
		const rows = thread.children;
		for (let k = 0; k < rows.length; k++)
			rows[k].classList.toggle("old", k < rows.length - 8);
	};
	const setPin = (l: JkLine, ms: number) => {
		const tag = whoTag(l.who);
		pinBar.textContent = `${l.no ?? ""}　${tag ? `${tag.text}　` : ""}${l.text}`;
		pinBar.classList.add("on");
		window.clearTimeout(pinTimer);
		pinTimer = window.setTimeout(
			() => pinBar.classList.remove("on"),
			ms / speed,
		);
	};

	try {
		let last = await tick();
		for (;;) {
			const now = await tick();
			let dt = Math.min(100, now - last);
			last = now;
			if (document.hidden && !(import.meta.env.DEV && hasRaf())) dt = 0;
			const evs = jkStep(st, dt * speed, quit ? { quit: true } : undefined);
			for (const ev of evs) {
				tv.onEv(ev, now);
				if (ev.t === "line") addLine(ev.line);
				else if (ev.t === "pin") {
					addLine(ev.line);
					setPin(ev.line, ev.ms);
				}
			}
			const v = jkView(st);
			titleEl.textContent = v.title;
			headTitle.textContent = v.title;
			part.textContent = v.label;
			resEl.textContent = `レス　${Math.min(v.no, 1000)}`;
			ikioiEl.textContent = `勢い　${comma(v.ikioi)}`;
			tv.draw(now, v);
			const end = evs.find((e) => e.t === "end");
			if (end && end.t === "end") {
				if (end.result) {
					note.textContent = GIKAI_TEXT.closed;
					const t0 = performance.now();
					while (performance.now() - t0 < 1200 && !quit) await tick();
				}
				return !!end.result;
			}
		}
	} finally {
		pop();
		window.clearTimeout(pinTimer);
		root.remove();
	}
};

// ───────────────── 村の 入口 ─────────────────

/** 越してきた 住人。 */
const movedOf = (v: VillageView): MobId[] => movedIn(stepOf(v), v.cleared);

/** この 帰りの 話を 選ぶ（議長が おんちゃんかも）。流せる 話が なければ null。 */
const pickEpisode = (v: VillageView, at: number) => {
	const moved = movedOf(v);
	const got = gikaiEpisodeFor(gikaiMemo(), at, moved);
	return got ? { ...got, onchan: moved.includes("onchan") } : null;
};

/** 番組名と 見どころの 2窓 → 見る？（menu の 番号を 返す）。 */
const pitch = async (
	s: Story,
	ep: GikaiEpisode,
	rerun: boolean,
	menu: readonly string[],
	first?: string,
): Promise<number> => {
	await s.narrate(
		first ??
			fill(rerun ? GIKAI_TEXT.onRerun : GIKAI_TEXT.on, { title: ep.title }),
	);
	await s.narrate(ep.pitch);
	return s.choose([...menu], { cancel: menu.length - 1 });
};

/** 1話 見る（板 → 見た 印）。 */
const watchOnce = async (
	ctx: UiCtx,
	s: Story,
	got: { ep: GikaiEpisode; rerun: boolean; onchan: boolean },
	place: GikaiPlace,
	at: number,
): Promise<void> => {
	await s.wait(0);
	saveGikai(gikaiWatched(gikaiMemo(), at, got.ep, got.rerun), previewing());
	await playGikai(ctx, got.ep, { ...got, place });
};

/**
 * 町役場・市役所の 中継モニター。議会の 日は 2窓 → 見る？ → 板。ほかの 日は 部屋の 文（閉会中・自分が 映った）。
 * off は 議会の ない 日の 文。
 */
export const watchGikai = async (
	ctx: UiCtx,
	s: Story,
	place: "townhall" | "cityhall",
	v: VillageView,
	off: readonly string[],
	at: number = returnAt(),
): Promise<void> => {
	const slot = programSlot(place, today(), v.stage, new Date().getFullYear(), {
		session: inSession(today(), at),
	});
	const got = slot?.main.program === "gikai" ? pickEpisode(v, at) : null;
	if (!got) {
		for (const t of off) await s.narrate(t);
		return;
	}
	const n = await pitch(s, got.ep, got.rerun, GIKAI_TEXT.menuSimple);
	if (n !== 0) return;
	await watchOnce(ctx, s, got, place, at);
};

/**
 * 本館の 実況モニターの 月曜（議会中継が はじめの チャンネル）。見たら "watched"、チャンネルを かえたら "channel"
 * （ナイターの 録画へ）、やめたら "quit"。流せる 話が なければ "channel"。
 */
export const hallGikai = async (
	ctx: UiCtx,
	s: Story,
	v: VillageView,
	at: number = returnAt(),
): Promise<"watched" | "channel" | "quit"> => {
	const got = pickEpisode(v, at);
	if (!got) return "channel";
	const n = await pitch(
		s,
		got.ep,
		got.rerun,
		GIKAI_TEXT.menu,
		GIKAI_TEXT.hallOn,
	);
	if (n === 1) return "channel";
	if (n !== 0) return "quit";
	await watchOnce(ctx, s, got, "hall", at);
	return "watched";
};

// ───────────────── 開発用 ─────────────────

if (import.meta.env.DEV && typeof window !== "undefined")
	(
		window as unknown as {
			__gikai: (
				id?: string,
				o?: { rerun?: boolean; onchan?: boolean; speed?: number },
			) => Promise<boolean>;
		}
	).__gikai = async (id = "yane", o = {}) => {
		const v = (window as unknown as { __village?: { ctx?: UiCtx } }).__village;
		const ctx = v?.ctx;
		const ep = GIKAI_EPISODES.find((e) => e.id === id);
		if (!ctx || !ep) throw new Error("__gikai: no village or episode");
		return playGikai(ctx, ep, {
			onchan: o.onchan ?? true,
			rerun: o.rerun ?? false,
			place: "cityhall",
			speed: o.speed,
		});
	};
