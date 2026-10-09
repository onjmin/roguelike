// 部室棟の 遊べる 物（data/village/bushitsu.ts の room.plays の "bushitsu"。物の id で 分ける）。
// どれも 寄り道で、強さ・冒険の 乱数・記録・売り上げ・段には 何も 効かない。見た目の 乱数は Math.random。
// - 机（人狼部）：ワードウルフ（6人）の 板と、そろわない 人狼（10人）。
// - イーゼル（お糸会かき部）：うろ覚えお糸会かき大会の 板。
// - ON AIR の ランプ・ラジカセ・放送日誌（放送部）：ぬとらじ。土日は 昔話を 帰りに 1つ ずつ。
// - 部員募集の はり紙：遊べる 物を 使った 帰りの 数で 部と 番号が かわる。
// - おんｊボカロ一覧の 額と ボカロ部の パソコン：村に いる 子の 名前と、安価キャラメイク（帰りに 1回）で 足した 子。
// 「帰り」は いちばん 新しい 記録の 時刻（保守神社の おみくじ・保守当番と 同じ）。
// 保存は kiriko-roguelike/bushitsu だけ（開発用の 下見 ?stage=・?event= の あいだは 書かない）。

import {
	BS_MSG,
	BS_STAFF,
	boshuLine,
	fillText,
	MUKASHI,
	madeWindow,
	nisshiWindows,
	nutoMukashiDay,
	nutoOnAir,
	pick3,
	rosterNames,
	rosterWindows,
	WW_BUCHO,
} from "../data/bushitsu";
import { nowHour, today } from "../data/calendar";
import { MOBS } from "../data/mobs";
import { devEvent } from "../data/objectives";
import type { Facility } from "../data/village/facilities";
import { stepOf, type VillageView } from "../data/village/map";
import type { Story } from "../engine/defs";
import { loadRecords } from "../engine/save";
import {
	type OeResult,
	playOekaki,
	playWordWolf,
	type WwResult,
} from "./bushitsuBoards";
import type { Ctx } from "./ctx";
import type { UiCtx } from "./list";
import { previewStage } from "./villageReturn";

// ───────────────── 試験の 差しかえ ─────────────────

/** 試験用：板の かわりに 結果を 返す（無い 欄は 本物の 板）。 */
export type BushitsuBoards = {
	wordwolf?: () => Promise<WwResult | null>;
	oekaki?: () => Promise<OeResult | null>;
};
let boards: BushitsuBoards = {};
export const setBushitsuBoards = (b: BushitsuBoards | null): void => {
	boards = b ?? {};
};

/** 時刻・曜日・帰り（記録の 時刻）・乱数。 */
type Env = {
	w: () => number;
	h: () => number;
	returnAt: () => number;
	rand: () => number;
};
const REAL: Env = {
	w: () => today().w,
	h: () => nowHour(),
	returnAt: () => loadRecords()[0]?.at ?? 0,
	rand: Math.random,
};
let env: Env = REAL;
/** 試験用：時刻・曜日・帰り・乱数を 差しかえる（null で もとに もどす）。 */
export const setBushitsuEnv = (e: Partial<Env> | null): void => {
	env = e ? { ...REAL, ...e } : REAL;
};

// ───────────────── 保存（kiriko-roguelike/bushitsu） ─────────────────

const KEY = "kiriko-roguelike/bushitsu";

export type BushitsuMemo = {
	v: 1;
	/** 部室棟の 遊べる 物を 使った 帰りの 数（部員募集の 番号・10人の 1度きり）。 */
	visits: number;
	/** 数えた 帰り（loadRecords()[0].at。はじめは -1）。 */
	visitAt: number;
	ww: {
		plays: number;
		wins: number;
		/** 1周目で 当てた 数。 */
		first: number;
		streak: number;
		best: number;
		howto: boolean;
		/** 10人 そろいかけた（1度きり）。 */
		ten: boolean;
	};
	oe: { plays: number; best: number; perfect: number; howto: boolean };
	/** best は 息の つかいかた（しめた 長さ ÷ 息の 長さ、千分率）。 */
	kk: { plays: number; best: number; falls: number; howto: boolean };
	/** 聞いた 昔話の 数と、最後に 聞いた 帰り。 */
	nt: { heard: number; heardAt: number };
	/** 安価キャラメイク（made は 新しいのが うしろ。5人まで）。 */
	vc: {
		made: { name: string; look: string; tic: string }[];
		eta: number;
		madeAt: number;
		kiriko: boolean;
	};
};

const EMPTY = (): BushitsuMemo => ({
	v: 1,
	visits: 0,
	visitAt: -1,
	ww: {
		plays: 0,
		wins: 0,
		first: 0,
		streak: 0,
		best: 0,
		howto: false,
		ten: false,
	},
	oe: { plays: 0, best: 0, perfect: 0, howto: false },
	kk: { plays: 0, best: 0, falls: 0, howto: false },
	nt: { heard: 0, heardAt: -1 },
	vc: { made: [], eta: 0, madeAt: -1, kiriko: false },
});

/** 安価で 作った 子の 数の 上限。 */
const MADE_MAX = 5;

let memo: BushitsuMemo | null = null;

/** 開発用の 下見（?stage=・?event=）の あいだ（保存は 書かない）。 */
const previewing = (): boolean =>
	previewStage() !== null || devEvent() !== null;

const count = (x: unknown): number =>
	typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0;
const stampOf = (x: unknown): number =>
	typeof x === "number" && Number.isFinite(x) && x >= -1 ? x : -1;
const flag = (x: unknown): boolean => x === true;
const rec = (x: unknown): Record<string, unknown> =>
	x && typeof x === "object" ? (x as Record<string, unknown>) : {};

/** 読む（壊れた JSON・足りない 欄は 初期値）。 */
export const loadBushitsu = (): BushitsuMemo => {
	if (memo) return structuredClone(memo);
	try {
		const raw = rec(JSON.parse(localStorage.getItem(KEY) ?? "null"));
		if (raw.v === 1) {
			const ww = rec(raw.ww);
			const oe = rec(raw.oe);
			const kk = rec(raw.kk);
			const nt = rec(raw.nt);
			const vc = rec(raw.vc);
			const made = Array.isArray(vc.made)
				? vc.made
						.map(rec)
						.filter(
							(m) =>
								typeof m.name === "string" &&
								typeof m.look === "string" &&
								typeof m.tic === "string",
						)
						.map((m) => ({
							name: String(m.name),
							look: String(m.look),
							tic: String(m.tic),
						}))
						.slice(-MADE_MAX)
				: [];
			return {
				v: 1,
				visits: count(raw.visits),
				visitAt: stampOf(raw.visitAt),
				ww: {
					plays: count(ww.plays),
					wins: count(ww.wins),
					first: count(ww.first),
					streak: count(ww.streak),
					best: count(ww.best),
					howto: flag(ww.howto),
					ten: flag(ww.ten),
				},
				oe: {
					plays: count(oe.plays),
					best: count(oe.best),
					perfect: count(oe.perfect),
					howto: flag(oe.howto),
				},
				kk: {
					plays: count(kk.plays),
					best: count(kk.best),
					falls: count(kk.falls),
					howto: flag(kk.howto),
				},
				nt: { heard: count(nt.heard), heardAt: stampOf(nt.heardAt) },
				vc: {
					made,
					eta: count(vc.eta),
					madeAt: stampOf(vc.madeAt),
					kiriko: flag(vc.kiriko),
				},
			};
		}
	} catch {
		// 読めなければ はじめから
	}
	return EMPTY();
};

/** 書く（noSave なら この回だけ 覚える）。 */
export const saveBushitsu = (m: BushitsuMemo, noSave = previewing()): void => {
	memo = structuredClone(m);
	if (noSave) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(m));
	} catch {
		// 保存できなくても この回は memo で 覚えている
	}
};

/** 試験用：覚えている 写しを 捨てる（localStorage から 読みなおす）。 */
export const forgetBushitsuMemo = (): void => {
	memo = null;
};

/** この 帰りに はじめて 遊べる 物を 使ったら 数える。 */
const touchVisit = (): BushitsuMemo => {
	const m = loadBushitsu();
	const at = env.returnAt();
	if (m.visitAt !== at) {
		m.visits++;
		m.visitAt = at;
		saveBushitsu(m);
	}
	return m;
};

// ───────────────── 遊べる 物 ─────────────────

/** 部長の ひとこと（名前欄つき）。 */
const say = (s: Story, who: keyof typeof BS_STAFF, t: string) =>
	s.say("nanj", t, { name: BS_STAFF[who].name });

/** 人狼部の 机：ワードウルフ（6人）・人狼（10人。そろわない）・やめる。 */
const wordWolfScript = async (ctx: Ctx, s: Story): Promise<void> => {
	const M = BS_MSG.ww;
	const n = await s.choose([...M.menu], { cancel: 2 });
	if (n === 2) return;
	if (n === 1) {
		// 人狼は 10人から。……10回目の 帰りより あとに 1度だけ、そろいかけて 1人 抜ける
		const m = loadBushitsu();
		if (m.visits >= 10 && !m.ww.ten) {
			await s.narrate(M.ten[0]);
			await s.narrate(M.ten[1]);
			m.ww.ten = true;
			saveBushitsu(m);
		} else await s.narrate(M.tenNin);
		await say(s, "jinro", M.jiki);
		return;
	}
	const first = loadBushitsu();
	if (!first.ww.howto) {
		for (const t of M.howto) await s.narrate(t);
		first.ww.howto = true;
		saveBushitsu(first);
	}
	await s.wait(0);
	const r = await (boards.wordwolf ?? (() => playWordWolf(ctx)))();
	if (!r) return;
	const m = loadBushitsu();
	const miss = r.verdict === "miss";
	m.ww.plays++;
	if (miss) m.ww.streak = 0;
	else {
		m.ww.wins++;
		m.ww.streak++;
		m.ww.best = Math.max(m.ww.best, m.ww.streak);
		if (r.verdict === "first") m.ww.first++;
	}
	saveBushitsu(m);
	await s.narrate(
		r.verdict === "first" ? M.win1 : r.verdict === "second" ? M.win2 : M.lose,
	);
	if (!miss && m.ww.streak >= 2)
		await s.narrate(fillText(M.streak, { n: m.ww.streak }));
	const me = r.wolfSeat === WW_BUCHO;
	await say(
		s,
		"jinro",
		me ? (miss ? M.byeMeWon : M.byeMeFound) : miss ? M.byeLose : M.byeWin,
	);
};

/** お糸会かき部の イーゼル：うろ覚えお糸会かき大会。 */
const oekakiScript = async (ctx: Ctx, s: Story): Promise<void> => {
	const M = BS_MSG.oe;
	if ((await s.choose([...M.menu], { cancel: 1 })) !== 0) return;
	const first = loadBushitsu();
	if (!first.oe.howto) {
		for (const t of M.howto) await s.narrate(t);
		first.oe.howto = true;
		saveBushitsu(first);
	}
	await s.wait(0);
	const r = await (boards.oekaki ?? (() => playOekaki(ctx)))();
	if (!r) return;
	const m = loadBushitsu();
	m.oe.plays++;
	m.oe.best = Math.max(m.oe.best, r.hits);
	if (r.hits === 3) m.oe.perfect++;
	saveBushitsu(m);
	await s.narrate(
		r.hits === 3
			? M.res3
			: r.hits === 0
				? M.res0
				: fillText(M.resN, { n: r.hits }),
	);
	await say(s, "oekaki", M.bye);
};

/** 放送部の ラジカセ：ぬとらじ（夜と 土日。土日は 昔話を 帰りに 1つ）。 */
const radioScript = async (s: Story): Promise<void> => {
	const M = BS_MSG.nt;
	const h = env.h();
	const w = env.w();
	if (!nutoOnAir(h, w)) {
		await s.narrate(M.off);
		return;
	}
	await s.narrate(fillText(M.title, { title: M.titles[w] }));
	if (!nutoMukashiDay(w)) {
		await say(s, "hoso", M.host[w]);
		return;
	}
	const m = loadBushitsu();
	const at = env.returnAt();
	if (m.nt.heardAt === at && m.nt.heard > 0) {
		await say(s, "hoso", M.again);
		return;
	}
	const fact = MUKASHI[m.nt.heard % MUKASHI.length];
	await say(s, "hoso", fact.lines[0]);
	m.nt.heard++;
	m.nt.heardAt = at;
	saveBushitsu(m);
};

/** おんｊボカロ一覧の 額：村に いる 子の 名前 → はじめて なら キリコの ひとこと、あとは 安価で 足した 子。 */
const rosterScript = async (s: Story, v: VillageView): Promise<void> => {
	const names = rosterNames(stepOf(v), MOBS.rino.from, MOBS.aru.from);
	for (const t of rosterWindows(names)) await s.narrate(t);
	const m = loadBushitsu();
	if (!m.vc.kiriko) {
		await s.narrate(BS_MSG.vc.kiriko);
		m.vc.kiriko = true;
		saveBushitsu(m);
		return;
	}
	const made = madeWindow(m.vc.made, m.vc.eta);
	if (made) await s.narrate(made);
};

/** ボカロ部の パソコン：安価キャラメイク（帰りに 1回。名前・見た目・口ぐせの 3択 → 6割で 原音設定、のこりは エター）。 */
const vocaMakeScript = async (s: Story): Promise<void> => {
	const M = BS_MSG.vm;
	if ((await s.choose([...M.menu], { cancel: 1 })) !== 0) return;
	const m = loadBushitsu();
	const at = env.returnAt();
	if (m.vc.madeAt === at) {
		await s.narrate(M.done);
		return;
	}
	const taken = new Set(m.vc.made.map((x) => x.name));
	const pools: [readonly string[], readonly string[]][] = [
		[M.names.filter((n) => !taken.has(n)), M.names],
		[M.looks, M.looks],
		[M.tics, M.tics],
	];
	const got: string[] = [];
	for (const [i, [pool, all]] of pools.entries()) {
		await s.narrate(M.q[i]);
		const opts = pick3(pool, all, env.rand);
		const k = await s.choose([...opts, M.stop], { cancel: opts.length });
		if (k >= opts.length) return;
		got.push(opts[k]);
	}
	const [name, look, tic] = got;
	await s.narrate(M.wait);
	s.se("mix");
	const ok = env.rand() < 0.6;
	m.vc.madeAt = at;
	if (ok) {
		m.vc.made = [...m.vc.made, { name, look, tic }].slice(-MADE_MAX);
		saveBushitsu(m);
		await s.narrate(M.ok[0]);
		await s.narrate(fillText(M.made, { name, look, tic }));
		await s.narrate(M.ok[1]);
		return;
	}
	m.vc.eta++;
	saveBushitsu(m);
	for (const t of M.eta) await s.narrate(t);
};

/** room.plays の "bushitsu"（buildFacility が 物の 文を 読んだ あと。物の id で 分ける）。 */
export const bushitsuThing = async (
	ctx: Ctx,
	s: Story,
	_f: Facility,
	kind: string,
	v: VillageView,
): Promise<void> => {
	touchVisit();
	if (kind === "table") await wordWolfScript(ctx, s);
	else if (kind === "easel") await oekakiScript(ctx, s);
	else if (kind === "onair")
		await s.narrate(
			nutoOnAir(env.h(), env.w()) ? BS_MSG.nt.lampOn : BS_MSG.nt.lampOff,
		);
	else if (kind === "radio") await radioScript(s);
	else if (kind === "nisshi")
		for (const t of nisshiWindows(loadBushitsu().nt.heard)) await s.narrate(t);
	else if (kind === "roster") await rosterScript(s, v);
	else if (kind === "pc") await vocaMakeScript(s);
	else if (kind === "boshu") await s.narrate(boshuLine(loadBushitsu().visits));
};

// ───────────────── 開発用 ─────────────────

if (import.meta.env.DEV && typeof window !== "undefined") {
	const ctxOf = (): UiCtx => {
		const v = (window as unknown as { __village?: { ctx?: UiCtx } }).__village;
		if (!v?.ctx) throw new Error("__bushitsu: no village");
		return v.ctx;
	};
	(
		window as unknown as {
			__bushitsu: {
				ww: () => Promise<WwResult | null>;
				oe: () => Promise<OeResult | null>;
			};
		}
	).__bushitsu = {
		ww: () => playWordWolf(ctxOf()),
		oe: () => playOekaki(ctxOf()),
	};
}
