// 討論会（模擬議会の カンペ係）の 板と 村の 入口。中身と 採点は data/debate.ts、選ぶ 部品は ui/minigamePicker.ts、
// 回す 道具は ui/minigameBoard.ts の tick・sleep。
// - 板：題・canvas（ROM の 支持ゲージ・ラウンド・前の 2件の 見出し・両方の「顔真っ赤」）・いまの 書きこみ（DOM の 字）・
//   カンペ 6枚・ノート（ROM の 反応・判定）・ヒント。B は 2回押しで タオル（1回目は ノートに「もう一度　Bで　タオル」）。
// - キリコは 書きこまない（カンペを わたすだけ。地の文「キリコは　うなずいた。」）。
// - 村の 入口：はじめての 1回は 議会事務局の 3窓 → 唐揚げ → 派 → 味方の ひとこと → うなずく → 板。
//   2回目からは お題 → 派 → 板 → 板の 外は 1窓だけ（仲直りか、負けた 味方の ひとこと）。
// - 見分け方の はり紙（選んで 1窓）。
// - 保存は kiriko-roguelike/civic だけ（はじめての 印・回数）。開発用の 下見（?stage=・?event=）の あいだは 書かない。
//   強さ・冒険の 乱数・記録・リプレイには 何も 効かない。見た目の 乱数なので Math.random。

import {
	ACTS,
	BOARD,
	bestOf,
	type Card,
	cardText,
	claimOf,
	DEBATE_MSG,
	type DebateSt,
	debateStart,
	type FaithSide,
	fillDebate,
	KIBEN,
	KIBEN_TITLE,
	MINUTES,
	NANASHI_LINES,
	OUTSIDE_TEXT,
	type Outcome,
	PAGE,
	PAGES,
	type PolicySide,
	pagesOf,
	postText,
	type Rand,
	roundAnswer,
	roundStart,
	TOPICS,
	type Topic,
	VERDICT,
} from "../data/debate";
import { MOBS, type MobId, movedIn } from "../data/mobs";
import { devEvent } from "../data/objectives";
import { stepOf, type VillageView } from "../data/village/map";
import type { Story } from "../engine/defs";
import { el } from "./dom";
import { listWindow, markOpened, onTap, type UiCtx } from "./list";
import { sleep, tick } from "./minigameBoard";
import { picker } from "./minigamePicker";
import { sayAs } from "./villageMobs";
import { previewStage } from "./villageReturn";

// ───────────────── 保存（kiriko-roguelike/civic） ─────────────────

const KEY = "kiriko-roguelike/civic";

export type CivicMemo = {
	v: 1;
	debate: {
		/** はじめての 1回（議会事務局の 前置き）を 見た。 */
		tutored: boolean;
		plays: number;
		/** 議事録の 書かれた 号（`お題:決着`。data/debate.ts の PAGES）。 */
		pages: string[];
	};
};

const EMPTY = (): CivicMemo => ({
	v: 1,
	debate: { tutored: false, plays: 0, pages: [] },
});

let memo: CivicMemo | null = null;

/** 開発用の 下見（?stage=・?event=）の あいだ（保存は 書かない）。 */
const previewing = (): boolean =>
	previewStage() !== null || devEvent() !== null;

/** 読む（壊れた JSON・足りない 欄は 初期値）。 */
export const loadCivic = (): CivicMemo => {
	if (memo) return structuredClone(memo);
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
		if (raw && typeof raw === "object" && raw.v === 1) {
			const d = raw.debate ?? {};
			return {
				v: 1,
				debate: {
					tutored: d.tutored === true,
					plays:
						typeof d.plays === "number" && Number.isFinite(d.plays)
							? Math.max(0, d.plays)
							: 0,
					pages: Array.isArray(d.pages)
						? d.pages.filter(
								(x: unknown): x is string =>
									typeof x === "string" && PAGES.some((p) => p.key === x),
							)
						: [],
				},
			};
		}
	} catch {
		// 読めなければ はじめから
	}
	return EMPTY();
};

/** 書く（noSave なら この回だけ 覚える）。 */
export const saveCivic = (m: CivicMemo, noSave = previewing()): void => {
	memo = structuredClone(m);
	if (noSave) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(m));
	} catch {
		// 保存できなくても この回は memo で 覚えている
	}
};

/** 試験用：覚えている 写しを 捨てる。 */
export const forgetCivicMemo = (): void => {
	memo = null;
};

// ───────────────── 名前 ─────────────────

/** 派で 戦う 人の 名前欄（越してきた 住人なら その 名前、まだなら「{派}の　名無し」）。 */
export const fighterOf = (
	side: PolicySide | FaithSide,
	v: VillageView,
): { mob: MobId | null; name: string } => {
	const id = side.fighter;
	if (id && movedIn(stepOf(v), v.cleared).includes(id))
		return { mob: id, name: MOBS[id].name };
	return { mob: null, name: fillDebate(BOARD.nanashi, { side: side.name }) };
};

/** 書きこむ 人の ID（8字。単発の 荒らしは 毎回 ちがう）。 */
const newId = (r: Rand): string => {
	const A = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
	return Array.from({ length: 8 }, () => A[Math.floor(r() * A.length)]).join(
		"",
	);
};

// ───────────────── 板 ─────────────────

type Who = "ally" | "opp" | "op" | "rom" | "arashi";

type Res = {
	no: number;
	who: Who;
	name: string;
	id: string;
	text: string;
	/** 自演（同じ ID の 名無し）。 */
	nushi?: boolean;
};

const INK = {
	bg: "#14121c",
	ally: "#ffd060",
	opp: "#7fb0ff",
	mid: "#3a3850",
	text: "#e8e6f0",
	dim: "#8a8aa0",
	red: "#ff5a4a",
	pink: "#ff9ab0",
	off: "#4a4858",
} as const;

const FONT = (px: number) => `${px}px 'DotGothic16', monospace`;

/** 顔真っ赤の 数 → ID の 色（白 → 桃 → 赤）。 */
const heatInk = (n: number): string =>
	n >= 2 ? INK.red : n === 1 ? INK.pink : INK.text;

const reducedMotion = (): boolean =>
	typeof matchMedia === "function" &&
	matchMedia("(prefers-reduced-motion: reduce)").matches;

export type DebateResult = { outcome: Outcome; jien: boolean };

/** 試験用：板の かわりに 結果を 返す 手（null で もどす）。 */
let debateHook:
	| ((
			topic: Topic,
			us: 0 | 1,
			who: { ally: Fighter; opp: Fighter },
	  ) => Promise<DebateResult>)
	| null = null;
export const setDebateHook = (h: typeof debateHook): void => {
	debateHook = h;
};

/** 派で 戦う 人（越してきた 住人か、mob: null の 名無し）。 */
export type Fighter = { mob: MobId | null; name: string };

/**
 * 討論の 板で 1試合（5 ラウンド。約 1分半）。判定と「なお〜」を 板の 中で 出して、A・B・タップで 閉じる。
 * who は 味方と 相手（村の 住人か 名無し。名無しは 口ぐせの ない 文）。
 */
export const playDebate = async (
	ctx: UiCtx,
	topic: Topic,
	us: 0 | 1,
	who: { ally: Fighter; opp: Fighter },
	opt: { speed?: number } = {},
): Promise<DebateResult> => {
	if (debateHook) return debateHook(topic, us, who);
	const speed = opt.speed ?? 1;
	const r: Rand = Math.random;
	const nameless = { ally: !who.ally.mob, opp: !who.opp.mob };
	const names = { ally: who.ally.name, opp: who.opp.name };
	const st: DebateSt = debateStart(topic, us, r, nameless);
	const reduced = reducedMotion();
	const faith = topic.mode === "faith";
	const v = st.vars;

	// ── DOM
	const canvas = el("canvas", { class: "mgame-canvas db-canvas" });
	canvas.width = 480;
	canvas.height = 192;
	const g0 = canvas.getContext("2d");
	if (!g0) throw new Error("canvas");
	const g = g0;
	const nameEl = el("div", { class: "db-name" });
	const textEl = el("div", { class: "db-text" });
	const post = el("div", { class: "db-post" }, [nameEl, textEl]);
	const cards = el("div", { class: "jk-picks db-cards" });
	const note = el("div", { class: "mgame-note db-note" });
	note.setAttribute("aria-live", "polite");
	const root = el("div", { class: "mgame db window" }, [
		el("div", {
			class: "mgame-title",
			text: fillDebate(BOARD.title, { title: topic.title }),
		}),
		canvas,
		post,
		cards,
		note,
		el("div", { class: "mgame-hint", text: BOARD.hint }),
	]);
	if (reduced) root.classList.add("still");
	ctx.ui.appendChild(root);

	// ── 入力（カンペ・B 2回で タオル）
	let picked: ((i: number) => void) | null = null;
	let towel = false;
	let lastB = -1e9;
	const pk = picker(ctx, cards, {
		digits: false,
		edges: false,
		aria: BOARD.aria,
		onPick: (i) => picked?.(i),
		onB: (at) => {
			if (towel) return;
			if (at - lastB <= 1500) {
				towel = true;
				picked?.(-1);
				return;
			}
			lastB = at;
			say(BOARD.quit1);
		},
	});
	let noteTimer = 0;
	const say = (t: string, ms = 0) => {
		note.textContent = t;
		window.clearTimeout(noteTimer);
		if (ms > 0)
			noteTimer = window.setTimeout(() => {
				note.textContent = "";
			}, ms);
	};
	/** 待つ（タオルが 投げこまれたら すぐ）。 */
	const wait = async (ms: number) => {
		const end = performance.now() + ms / speed;
		while (!towel && performance.now() < end) await tick();
	};

	// ── 書きこみ
	const ids = { ally: newId(r), opp: newId(r), op: newId(r) };
	let nushi = false;
	let no = 0;
	const history: Res[] = [];
	const write = (who: Who, text: string, o: { nushi?: boolean } = {}) => {
		no += 1;
		const name =
			who === "ally"
				? names.ally
				: who === "opp"
					? names.opp
					: who === "op"
						? BOARD.op1
						: BOARD.rom;
		// 名無しの ROM と 荒らしは 1レスごとに ちがう ID（単発）。自演は 味方と 同じ ID
		const id =
			who === "ally" || o.nushi
				? ids.ally
				: who === "opp"
					? ids.opp
					: who === "op"
						? ids.op
						: newId(r);
		const mark = !!o.nushi || (who === "ally" && nushi);
		const res: Res = { no, who, name, id, text, nushi: mark };
		history.push(res);
		nameEl.replaceChildren(
			el("b", { class: "db-no", text: String(no) }),
			document.createTextNode(`　${name}　`),
		);
		const idEl = el("span", { class: "db-id", text: `ID:${id}` });
		const heat =
			who === "ally" || o.nushi ? st.heat : who === "opp" ? st.opp : 0;
		idEl.style.color = heatInk(heat);
		nameEl.append(idEl);
		if (mark)
			nameEl.append(el("span", { class: "db-nushi", text: BOARD.nushi }));
		textEl.textContent = text;
		post.classList.toggle("ally", who === "ally" || !!o.nushi);
		post.classList.toggle("opp", who === "opp" || who === "arashi");
		draw();
	};

	// ── canvas（240×96 を 2倍で）
	let shown = st.support;
	const draw = () => {
		g.setTransform(2, 0, 0, 2, 0, 0);
		g.imageSmoothingEnabled = false;
		g.fillStyle = INK.bg;
		g.fillRect(0, 0, 240, 96);
		g.textBaseline = "top";
		// 名前と ラウンド
		g.font = FONT(9);
		g.fillStyle = INK.ally;
		g.textAlign = "left";
		g.fillText(names.ally, 6, 2, 96);
		g.fillStyle = INK.opp;
		g.textAlign = "right";
		g.fillText(names.opp, 234, 2, 96);
		g.fillStyle = INK.text;
		g.textAlign = "center";
		g.fillText(
			fillDebate(BOARD.round, { r: String(Math.max(1, st.r)) }),
			120,
			2,
		);
		// 支持ゲージ（左 味方・右 相手。目盛りは 判定の さかい）
		const x0 = 8;
		const w = 224;
		const fillW = Math.round((w * shown) / 100);
		g.fillStyle = INK.opp;
		g.fillRect(x0, 15, w, 8);
		g.fillStyle = INK.ally;
		g.fillRect(x0, 15, fillW, 8);
		g.fillStyle = INK.bg;
		for (const p of faith ? [40, 70] : [40, 80])
			g.fillRect(x0 + Math.round((w * p) / 100), 13, 1, 12);
		g.fillStyle = INK.text;
		g.fillRect(x0 + w / 2, 24, 1, 2);
		// 前の 2件の 見出し（いまの 書きこみは 下の 字）
		const prev = history.slice(-3, -1);
		prev.forEach((h, i) => {
			const y = 30 + i * 18;
			g.textAlign = "left";
			g.font = FONT(8);
			g.fillStyle = INK.dim;
			g.fillText(
				`${h.no} ${h.name}${h.nushi ? BOARD.nushi : ""} ID:${h.id}`,
				6,
				y,
				228,
			);
			g.font = FONT(9);
			g.fillStyle =
				h.who === "ally"
					? INK.ally
					: h.who === "opp" || h.who === "arashi"
						? INK.opp
						: INK.text;
			g.fillText(h.text.replace("\n", ""), 6, y + 8, 228);
		});
		// 顔真っ赤
		g.font = FONT(9);
		const dots = (n: number) =>
			`${BOARD.red} ${"●".repeat(Math.min(3, n))}${"○".repeat(Math.max(0, 3 - n))}`;
		g.textAlign = "left";
		g.fillStyle = st.heat ? heatInk(st.heat) : INK.dim;
		g.fillText(dots(st.heat), 6, 82);
		if (!faith) {
			g.textAlign = "right";
			g.fillStyle = st.opp ? heatInk(st.opp) : INK.dim;
			g.fillText(dots(st.opp), 234, 82);
		}
	};
	/** ゲージを 動かす（動きを へらす 設定では すぐ）。 */
	const ease = async () => {
		const to = st.support;
		if (reduced) {
			shown = to;
			draw();
			return;
		}
		const from = shown;
		const t0 = performance.now();
		for (;;) {
			const k = Math.min(1, (performance.now() - t0) / (400 / speed));
			shown = from + (to - from) * k;
			draw();
			if (k >= 1) break;
			await tick();
		}
	};

	const allySide = topic.sides[us];
	const oppSide = topic.sides[us === 0 ? 1 : 0];
	let outcome: Outcome | null = null;
	let defended = false;
	try {
		// >>1（立て逃げ）と 味方の 言い切り
		write("op", fillDebate(BOARD.op, { title: topic.title }));
		await wait(1300);
		if (!towel) {
			write("ally", claimOf(topic, us, nameless));
			await wait(1300);
		}
		while (!towel) {
			const { post: kind, cards: hand } = roundStart(st, r);
			const text = postText(st, kind, r);
			write(kind.startsWith("a_") ? "arashi" : "opp", text);
			await wait(500);
			if (towel) break;
			// カンペを 開いて 待つ（時計なし）
			const i = await new Promise<number>((done) => {
				picked = done;
				pk.setLabels(
					hand.map((c) => cardText(st, c)),
					0,
				);
				say("");
				ctx.se("cursor");
			});
			picked = null;
			if (i < 0 || towel) break;
			const c: Card = hand[i];
			const best = hand.indexOf(bestOf(kind));
			const got = roundAnswer(st, kind, c);
			// 答え合わせ：いちばん 良い 札に ◎、選んだ 札は 増減の 色
			pk.mark(
				hand.map((_, k) =>
					k === best ? "best" : k === i ? (got.d > 0 ? "ok" : "miss") : null,
				),
				i,
			);
			ctx.se("decide");
			if (got.d >= 15) ctx.se("critical");
			else if (got.d < 0) ctx.se("miss");
			say(got.rom);
			// 味方の 書きこみ（スルーは 書かない。自演は 同じ ID の 名無し）
			if (c === "self_jien") {
				write("rom", ACTS.self_jien, { nushi: true });
				nushi = true;
			} else if (c === "self_long") write("ally", ACTS.self_long);
			else if (c !== "through") write("ally", cardText(st, c));
			await ease();
			// 良スレ判定：荒らしの あと、相手の 住人が かばう（1回だけ）
			if (faith && kind.startsWith("a_") && !defended && !got.end) {
				defended = true;
				await wait(900);
				if (!towel)
					write(
						"opp",
						nameless.opp ? NANASHI_LINES.defend : (oppSide as FaithSide).defend,
					);
			}
			await wait(1300);
			if (got.end) {
				outcome = got.end;
				break;
			}
		}
		pk.close();
		if (towel) {
			outcome = "towel";
			ctx.se("cancel");
			write("rom", BOARD.towelRom);
			await sleep(900 / speed);
		}
		const end = outcome ?? "draw";
		// 決着（KO は 相手の 発狂、顔真っ赤 3 は 味方の 逃げ）
		if (end === "ko") {
			write(
				"opp",
				nameless.opp ? NANASHI_LINES.poem : (oppSide as PolicySide).poem,
			);
			await sleep(1300 / speed);
			write("rom", BOARD.koRom);
			await sleep(900 / speed);
		} else if ((end === "tko" || end === "arete") && st.heat >= 3) {
			write("ally", nameless.ally ? NANASHI_LINES.flee : allySide.flee);
			await sleep(1300 / speed);
			write("rom", BOARD.tkoRom);
			await sleep(900 / speed);
		}
		say(fillDebate(VERDICT[end], v));
		ctx.se(
			end === "ko" || end === "win" || end === "ryosure"
				? "victory"
				: end === "towel"
					? "cancel"
					: "decide",
		);
		await sleep(700 / speed);
		write("rom", topic.nao);
		await sleep(1300 / speed);
		write("rom", BOARD.tateNige);
		await closeBoard(ctx, root, pk);
		return { outcome: end, jien: st.jien };
	} finally {
		pk.stop();
		window.clearTimeout(noteTimer);
		root.remove();
	}
};

/** 板を 閉じる 合図を 待つ（A・B・タップ・とじる）。 */
const closeBoard = async (
	ctx: UiCtx,
	root: HTMLElement,
	pk: { stop(): void },
): Promise<void> => {
	pk.stop();
	const close = el("button", { class: "jk-close db-close", text: BOARD.close });
	close.type = "button";
	root.append(close);
	root.classList.add("done");
	markOpened(root);
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
		onTap(close, root, end);
	});
};

// ───────────────── 村の 入口 ─────────────────

/** 住人か 名無しの 1窓。 */
const sayBy = async (s: Story, who: Fighter, text: string): Promise<void> => {
	if (who.mob) await sayAs(s, who.mob, text);
	else await s.say("nanj", text, { name: who.name });
};

/** 板の 外の 1窓（仲直り・負けた 味方の ひとこと・良スレの ひとこと、ほかは 地の文）。 */
const outsideLine = async (
	s: Story,
	topic: Topic,
	us: 0 | 1,
	v: VillageView,
	outcome: Outcome,
): Promise<void> => {
	const allySide = topic.sides[us];
	const oppSide = topic.sides[us === 0 ? 1 : 0];
	const a = fighterOf(allySide, v);
	const o = fighterOf(oppSide, v);
	if (outcome === "ko" || outcome === "win") {
		await sayBy(
			s,
			o,
			o.mob ? (oppSide as PolicySide).sorry : NANASHI_LINES.sorry,
		);
		return;
	}
	if (outcome === "lose" || outcome === "tko") {
		await sayBy(
			s,
			a,
			a.mob ? (allySide as PolicySide).shrug : NANASHI_LINES.shrug,
		);
		return;
	}
	if (outcome === "ryosure") {
		await sayBy(s, o, o.mob ? (oppSide as FaithSide).good : NANASHI_LINES.good);
		return;
	}
	await s.narrate(OUTSIDE_TEXT[outcome]);
};

/** 遊べる お題（並びは 議事録の 順）。 */
export const debateTopics = (): readonly Topic[] => TOPICS;

/**
 * 演壇（模擬議会）。はじめての 1回は 議会事務局の 前置き → 唐揚げ → 派 → 味方の ひとこと → うなずく → 板。
 * 2回目からは お題 → 派 → 板 → 板の 外の 1窓。何度でも。結果は 強さに 何も 効かない。
 */
export const debateScript = async (
	ctx: UiCtx,
	s: Story,
	v: VillageView,
): Promise<DebateResult | null> => {
	const m = loadCivic();
	const first = !m.debate.tutored;
	let topic: Topic | undefined;
	if (first) {
		for (const t of DEBATE_MSG.intro)
			await s.say("nanj", t, { name: DEBATE_MSG.staff });
		topic = TOPICS[0];
	} else {
		const list = debateTopics();
		await s.narrate(DEBATE_MSG.pickTopic);
		const n = await s.choose([...list.map((t) => t.title), DEBATE_MSG.quit], {
			cancel: list.length,
		});
		topic = list[n];
	}
	if (!topic) return null;
	await s.narrate(DEBATE_MSG.pickSide);
	const k = await s.choose(
		[topic.sides[0].name, topic.sides[1].name, DEBATE_MSG.quit],
		{ cancel: 2 },
	);
	if (k !== 0 && k !== 1) return null;
	const us = k as 0 | 1;
	const ally = fighterOf(topic.sides[us], v);
	const opp = fighterOf(topic.sides[us === 0 ? 1 : 0], v);
	if (first) {
		await sayBy(s, ally, DEBATE_MSG.ally);
		await s.narrate(DEBATE_MSG.nod);
	}
	await s.wait(0);
	const res = await playDebate(ctx, topic, us, { ally, opp });
	const m2 = loadCivic();
	m2.debate.tutored = true;
	m2.debate.plays += 1;
	for (const k of pagesOf(topic, res.outcome, res.jien))
		if (!m2.debate.pages.includes(k)) m2.debate.pages.push(k);
	saveCivic(m2);
	await outsideLine(s, topic, us, v, res.outcome);
	return res;
};

/** 議事録の 号の 1ページ（窓の 文。まだの 号は 白紙）。 */
export const pageText = (n: number, pages: readonly string[]): string => {
	const p = PAGES.find((x) => x.n === n);
	const t = p && TOPICS.find((x) => x.id === p.topic);
	if (!p || !t || !pages.includes(p.key))
		return fillDebate(MINUTES.blank, { n: String(n) });
	return fillDebate(MINUTES.page, {
		n: String(n),
		title: t.title,
		kind: PAGE[p.kind],
	});
};

/**
 * 議事録（町役場・市役所の 議事録、裁判所の 判例集）。模擬議会の 号の 一覧（お題 × 決着の 30ページ。まだの 号は
 * 白紙）から 選んで 1窓。やめるまで。
 */
export const minutesScript = async (ctx: UiCtx, s: Story): Promise<void> => {
	const pages = loadCivic().debate.pages;
	let start = 0;
	for (;;) {
		await s.wait(0);
		const id = await listWindow(
			ctx,
			fillDebate(MINUTES.title, {
				n: String(pages.length),
				all: String(PAGES.length),
			}),
			PAGES.map((p) => {
				const t = TOPICS.find((x) => x.id === p.topic);
				const done = pages.includes(p.key);
				return {
					label: fillDebate(MINUTES.label, { n: String(p.n) }),
					sub: done ? `${t?.title ?? ""}・${PAGE[p.kind]}` : MINUTES.none,
					value: String(p.n),
				};
			}),
			{ start },
		);
		if (id === null) return;
		const n = Number(id);
		start = Math.max(0, n - 1);
		await s.narrate(pageText(n, pages));
	}
};

/** はり紙『ずるい　理屈の　見分け方』（選んで 1窓。やめるまで）。 */
export const kibenScript = async (ctx: UiCtx, s: Story): Promise<void> => {
	let start = 0;
	for (;;) {
		await s.wait(0);
		const id = await listWindow(
			ctx,
			KIBEN_TITLE,
			KIBEN.map((k, i) => ({ label: k.label, value: String(i) })),
			{ start },
		);
		if (id === null) return;
		const i = Number(id);
		const k = KIBEN[i];
		if (!k) return;
		start = i;
		await s.narrate(k.text);
	}
};

// ───────────────── 開発用 ─────────────────

if (import.meta.env.DEV && typeof window !== "undefined")
	(
		window as unknown as {
			__debate: (
				topic?: string,
				us?: 0 | 1,
				o?: { speed?: number },
			) => Promise<DebateResult | null>;
		}
	).__debate = async (topic = "yuon", us = 0, o = {}) => {
		const v = (window as unknown as { __village?: { ctx?: UiCtx } }).__village;
		const ctx = v?.ctx;
		const t = TOPICS.find((x) => x.id === topic);
		if (!ctx || !t) throw new Error("__debate: no village or topic");
		const view: VillageView = { stage: 7, unlocked: ["shallow"], cleared: [] };
		return playDebate(
			ctx,
			t,
			us,
			{
				ally: fighterOf(t.sides[us], view),
				opp: fighterOf(t.sides[us === 0 ? 1 : 0], view),
			},
			o,
		);
	};
