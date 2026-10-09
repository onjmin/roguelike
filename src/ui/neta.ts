// ネタスレの 遊び（グラウンド・碁会所・保守道場・ageジム・ゲームセンター。STORY.md §5.75「ネタスレの 遊び」）の 窓の がわ。
// 物（data/village/facilities.ts の plays・outdoor の play）を 調べると ui/facilities.ts が netaPlay を 呼ぶ。
//   yakyu   グラウンドの 三塁側の ベンチ：ランダム野球（ui/netaYakyu.ts）。勝ち負けは 記録に 残る。
//   kabe    グラウンドの 外野の 5割の壁：ランダム野球の 通算が ちょうど 5割（勝ち＝負け、1勝 以上）の ときだけ、
//           しゃべった 帰りが かわるたびに 次の 1つを 順に（同じ 帰りは 同じ 1つ）。ほかの ときは「……」だけ（物の 文）。
//   othello 碁会所の リバーシ盤：常連と 対局（ui/netaOthello.ts。画面は 一般名の リバーシ）。
//   sk      保守道場の 文机：!sk 習字（ui/netaSk.ts）。前に 書いた 半紙を 覚えている。
//   fukkin  ageジムの 腹筋台：ID腹筋（ui/netaFukkin.ts）。ID は 帰りごとに 1つ（data/neta/id.ts）、その 帰りの 回数を 覚える。
//           テンプレの 決まり（sageずに…）は はじめの 1回だけ。
//   comma   ゲームセンターの コンマの 台：コンマ（10回 書きこむ）・夜の 23時台と 0時台だけ「0時ちょうど」（ui/netaComma.ts）。
// どれも 寄り道で、強さ・道具・売上・町の 段には 何も 効かない。見た目の 乱数は Math.random（冒険の 乱数に さわらない）。
// 記録は localStorage の kiriko-roguelike/neta だけ（?stage= ・?event= の ときは 書かない。memo には 残る）。
// 試験は setNetaHooks で 板の かわりに 結果を わたす（src/sim/netaTests.ts）。

import type { JkTeamId } from "../core/jikkyoYakyu";
import { nowHour } from "../data/calendar";
import {
	isZoro,
	zeroDeny,
	zeroJudge,
	zeroOpen,
	zeroText,
} from "../data/neta/comma";
import { FUKKIN_SOTTOJI, fukkinReps, kirikoId } from "../data/neta/id";
import { skSentence } from "../data/neta/sk";
import {
	COMMA,
	FUKKIN,
	KABE_NAME,
	KABE_TALK,
	OTHELLO,
	SK,
	YAKYU,
} from "../data/neta/text";
import { isNetaPlay, type NetaPlay } from "../data/neta/types";
import { yakyuCard } from "../data/neta/yakyu";
import { devEvent } from "../data/objectives";
import type { Story } from "../engine/defs";
import { loadRecords } from "../engine/save";
import type { Ctx } from "./ctx";
import type { UiCtx } from "./list";
import {
	type CommaResult,
	playComma,
	playZero,
	type ZeroResult,
} from "./netaComma";
import { type FukkinResult, playFukkin } from "./netaFukkin";
import { type OthelloResult, playOthello } from "./netaOthello";
import { playSk, type SkResult } from "./netaSk";
import { playYakyu, type YakyuResult } from "./netaYakyu";
import { previewStage } from "./villageReturn";
import { fill } from "./villageTalk";

export { isNetaPlay };

// ───────────────── 記録 ─────────────────

const KEY = "kiriko-roguelike/neta";

type Record3 = { w: number; l: number; d: number };
export type NetaMemo = {
	v: 1;
	yakyu: Record3 & { tutored: boolean };
	othello: Record3 & { best: number; tutored: boolean };
	/** at＝その 帰り（記録の 時刻）、done＝その 帰りに した 回数、total＝通算、tutored＝テンプレの 決まりを 読んだ。 */
	fukkin: { at: number; done: number; total: number; tutored: boolean };
	/** best0＝0時ちょうどの いちばん 早い ずれ（ms。0時より 前は 数えない）。 */
	comma: {
		posts: number;
		zoro: number;
		title: boolean;
		best0: number | null;
		tutored: boolean;
	};
	sk: { n: number; last: string };
	/** 5割の壁：n＝しゃべった 帰りの 数（言う 行は KABE_TALK[(n − 1) % 6]）、at＝最後に しゃべった 帰り。 */
	kabe: { n: number; at: number };
};

const fresh = (): NetaMemo => ({
	v: 1,
	yakyu: { w: 0, l: 0, d: 0, tutored: false },
	othello: { w: 0, l: 0, d: 0, best: 0, tutored: false },
	fukkin: { at: -1, done: 0, total: 0, tutored: false },
	comma: { posts: 0, zoro: 0, title: false, best0: null, tutored: false },
	sk: { n: 0, last: "" },
	kabe: { n: 0, at: -1 },
});

let memo: NetaMemo | null = null;

const previewing = (): boolean =>
	previewStage() !== null || devEvent() !== null;

const nat = (v: unknown): number =>
	typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
const bool = (v: unknown): boolean => v === true;
const obj = (v: unknown): Record<string, unknown> =>
	v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** 読む（こわれた 所は はじめの 値に）。 */
export const loadNeta = (): NetaMemo => {
	if (memo) return structuredClone(memo);
	const m = fresh();
	try {
		const raw = obj(JSON.parse(localStorage.getItem(KEY) ?? "null"));
		if (raw.v === 1) {
			const y = obj(raw.yakyu);
			m.yakyu = {
				w: nat(y.w),
				l: nat(y.l),
				d: nat(y.d),
				tutored: bool(y.tutored),
			};
			const o = obj(raw.othello);
			m.othello = {
				w: nat(o.w),
				l: nat(o.l),
				d: nat(o.d),
				best: Math.min(64, nat(o.best)),
				tutored: bool(o.tutored),
			};
			const f = obj(raw.fukkin);
			m.fukkin = {
				at: typeof f.at === "number" && Number.isFinite(f.at) ? f.at : -1,
				done: Math.min(9999, nat(f.done)),
				total: nat(f.total),
				tutored: bool(f.tutored),
			};
			const c = obj(raw.comma);
			m.comma = {
				posts: nat(c.posts),
				zoro: nat(c.zoro),
				title: bool(c.title),
				best0:
					typeof c.best0 === "number" && c.best0 >= 0
						? Math.floor(c.best0)
						: null,
				tutored: bool(c.tutored),
			};
			const s = obj(raw.sk);
			m.sk = {
				n: nat(s.n),
				last: typeof s.last === "string" && s.last.length <= 40 ? s.last : "",
			};
			const k = obj(raw.kabe);
			m.kabe = {
				n: nat(k.n),
				at: typeof k.at === "number" && Number.isFinite(k.at) ? k.at : -1,
			};
		}
	} catch {
		// 読めない ときは はじめから
	}
	memo = m;
	return structuredClone(m);
};

/** 書く（開発の ?stage= ・?event= では 書かない。memo には 残す）。 */
export const saveNeta = (m: NetaMemo, noSave = previewing()): void => {
	memo = structuredClone(m);
	if (noSave) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(m));
	} catch {
		// 保存できなくても この回は memo で 覚えている
	}
};

/** 試験用：memo を 忘れる。 */
export const forgetNetaMemo = (): void => {
	memo = null;
};

// ───────────────── 試験の 差しこみ口 ─────────────────

export type NetaHooks = {
	yakyu?: (card: {
		home: JkTeamId;
		away: JkTeamId;
	}) => Promise<YakyuResult | null>;
	othello?: () => Promise<OthelloResult | null>;
	fukkin?: (o: {
		id: string;
		reps: number;
		done: number;
	}) => Promise<FukkinResult>;
	comma?: () => Promise<CommaResult | null>;
	zero?: () => Promise<ZeroResult>;
	sk?: () => Promise<SkResult | null>;
};
let hooks: NetaHooks | null = null;
/** 試験用：板を 出さずに 結果を わたす（null で もとに もどす）。 */
export const setNetaHooks = (h: NetaHooks | null): void => {
	hooks = h;
};

// ───────────────── 窓の がわ ─────────────────

/** いまの 帰り（いちばん 新しい 記録の 時刻。ui/guests.ts の returnAt と 同じ）。 */
const returnNow = (): number => loadRecords()[0]?.at ?? 0;
const games = (r: Record3): number => r.w + r.l + r.d;
const wld = (r: Record3) => ({ w: r.w, l: r.l, d: r.d });
/** ちょうど 5割（1勝 以上で 勝ち＝負け）。 */
export const isGoWari = (r: Record3): boolean => r.w >= 1 && r.w === r.l;

export const yakyuScript = async (ctx: UiCtx, s: Story): Promise<void> => {
	const m = loadNeta();
	if (games(m.yakyu) > 0) await s.narrate(fill(YAKYU.record, wld(m.yakyu)));
	if ((await s.choose([...YAKYU.menu], { cancel: 1 })) !== 0) return;
	if (!m.yakyu.tutored) {
		await s.narrate(YAKYU.rule);
		m.yakyu.tutored = true;
		saveNeta(m);
	}
	const card = yakyuCard(games(m.yakyu));
	await s.wait(0);
	const r = hooks?.yakyu ? await hooks.yakyu(card) : await playYakyu(ctx, card);
	if (!r) return;
	const was = isGoWari(m.yakyu);
	if (r.winner === "home") m.yakyu.w++;
	else if (r.winner === "away") m.yakyu.l++;
	else m.yakyu.d++;
	saveNeta(m);
	await s.narrate(fill(YAKYU.after, wld(m.yakyu)));
	if (!was && isGoWari(m.yakyu)) await s.narrate(YAKYU.kabeHint);
};

/**
 * 5割の壁（物の 文「……」の あと）。5割の ときだけ。しゃべった 帰りが かわるたびに 次の 1つ（順に。最後の
 * 「……1つ　勝ったら、また　だまる。」の あとは はじめから）。同じ 帰りは 何度 調べても 同じ 1つ。
 */
export const kabeScript = async (s: Story, at = returnNow()): Promise<void> => {
	const m = loadNeta();
	if (!isGoWari(m.yakyu)) return;
	if (m.kabe.n === 0 || m.kabe.at !== at) {
		m.kabe = { n: m.kabe.n + 1, at };
		saveNeta(m);
	}
	await s.say("nanj", KABE_TALK[(m.kabe.n - 1) % KABE_TALK.length], {
		name: KABE_NAME,
	});
};

export const othelloScript = async (ctx: UiCtx, s: Story): Promise<void> => {
	const m = loadNeta();
	if (games(m.othello) > 0)
		await s.narrate(fill(OTHELLO.record, wld(m.othello)));
	if ((await s.choose([...OTHELLO.menu], { cancel: 1 })) !== 0) return;
	if (!m.othello.tutored) {
		await s.narrate(OTHELLO.rule);
		m.othello.tutored = true;
		saveNeta(m);
	}
	await s.wait(0);
	const r = hooks?.othello ? await hooks.othello() : await playOthello(ctx);
	if (!r) {
		await s.narrate(OTHELLO.resigned);
		return;
	}
	const v = { b: r.black, w: r.white };
	if (r.black > r.white) {
		m.othello.w++;
		m.othello.best = Math.max(m.othello.best, r.black - r.white);
	} else if (r.black < r.white) m.othello.l++;
	else m.othello.d++;
	saveNeta(m);
	await s.narrate(
		fill(
			r.black > r.white
				? OTHELLO.afterWin
				: r.black < r.white
					? OTHELLO.afterLose
					: OTHELLO.afterDraw,
			v,
		),
	);
};

export const skScript = async (ctx: UiCtx, s: Story): Promise<void> => {
	const m = loadNeta();
	if (m.sk.last) await s.narrate(fill(SK.last, { text: m.sk.last }));
	if ((await s.choose([...SK.menu], { cancel: 1 })) !== 0) return;
	await s.wait(0);
	const r = hooks?.sk ? await hooks.sk() : await playSk(ctx);
	if (!r) return;
	m.sk = { n: m.sk.n + 1, last: skSentence(r.a, r.b, r.c) };
	saveNeta(m);
	await s.narrate(SK.dried);
	await s.narrate(SK.react[(m.sk.n - 1) % SK.react.length]);
};

export const fukkinScript = async (
	ctx: UiCtx,
	s: Story,
	at = returnNow(),
): Promise<void> => {
	const id = kirikoId(at);
	const reps = fukkinReps(id);
	const m = loadNeta();
	const done = m.fukkin.at === at ? m.fukkin.done : 0;
	if (reps !== null && reps > 0 && done >= reps) {
		await s.narrate(FUKKIN.doneToday);
		return;
	}
	if ((await s.choose([...FUKKIN.menu], { cancel: 1 })) !== 0) return;
	if (!m.fukkin.tutored) {
		await s.narrate(FUKKIN.rule);
		m.fukkin.tutored = true;
		saveNeta(m);
	}
	if (reps === null) {
		await s.narrate(fill(FUKKIN.rest, { id }));
		await s.narrate(FUKKIN.restRes);
		return;
	}
	if (reps === 0) {
		await s.narrate(fill(FUKKIN.zero, { id }));
		return;
	}
	await s.narrate(
		done > 0
			? fill(FUKKIN.postedLeft, { id, n: reps, left: reps - done })
			: fill(FUKKIN.posted, { id, n: reps }),
	);
	if (reps >= FUKKIN_SOTTOJI) await s.narrate(FUKKIN.sottoji);
	if ((await s.choose([...FUKKIN.menu2], { cancel: 1 })) !== 0) return;
	await s.wait(0);
	const o = { id, reps, done };
	const r = hooks?.fukkin
		? await hooks.fukkin(o)
		: await playFukkin(ctx, { ...o, title: m.comma.title });
	const now = Math.max(done, Math.min(reps, r.done));
	m.fukkin = {
		...m.fukkin,
		at,
		done: now,
		total: m.fukkin.total + (now - done),
	};
	saveNeta(m);
	await s.narrate(
		fill(now >= reps ? FUKKIN.finish : FUKKIN.stopped, {
			n: reps,
			done: now,
			total: m.fukkin.total,
		}),
	);
};

export const commaScript = async (
	ctx: UiCtx,
	s: Story,
	hour = nowHour(),
	at = returnNow(),
): Promise<void> => {
	const m = loadNeta();
	const menu = zeroOpen(hour) ? COMMA.menuNight : COMMA.menu;
	const n = await s.choose([...menu], { cancel: menu.length - 1 });
	if (n === menu.length - 1) return;
	if (!m.comma.tutored) {
		await s.narrate(COMMA.rule);
		m.comma.tutored = true;
		saveNeta(m);
	}
	await s.wait(0);
	const o = { id: kirikoId(at), title: m.comma.title };
	if (n === 0) {
		const r = hooks?.comma ? await hooks.comma() : await playComma(ctx, o);
		if (!r?.stamps.length) return;
		const zoro = r.stamps.filter(isZoro).length;
		const first = zoro > 0 && !m.comma.title;
		m.comma.posts += r.stamps.length;
		m.comma.zoro += zoro;
		if (first) m.comma.title = true;
		saveNeta(m);
		await s.narrate(zoro > 0 ? COMMA.zoroAfter : COMMA.noZoro);
		if (first) await s.narrate(COMMA.titleGot);
		return;
	}
	const r = hooks?.zero ? await hooks.zero() : await playZero(ctx, o);
	if (r.diff === null) {
		await s.narrate(COMMA.zeroNone);
		return;
	}
	// 板でも ずらして いるが、ここでも（見える ミリ秒に 淫夢の 数を 出さない）
	const diff = zeroDeny(r.diff);
	const ms = Math.floor(diff);
	const best = ms >= 0 && (m.comma.best0 === null || ms < m.comma.best0);
	if (best) m.comma.best0 = ms;
	saveNeta(m);
	await s.narrate(
		fill(COMMA.zeroAfter, {
			time: zeroText(diff),
			judge: COMMA.judge[zeroJudge(diff)],
		}),
	);
	if (best) await s.narrate(fill(COMMA.zeroBest, { best: zeroText(ms) }));
};

/** 物を 調べた あとの 遊び（ui/facilities.ts の outdoorScript・buildFacility から）。 */
export const netaPlay = async (
	ctx: Ctx,
	s: Story,
	play: NetaPlay,
): Promise<void> => {
	if (play === "yakyu") await yakyuScript(ctx, s);
	else if (play === "kabe") await kabeScript(s);
	else if (play === "othello") await othelloScript(ctx, s);
	else if (play === "sk") await skScript(ctx, s);
	else if (play === "fukkin") await fukkinScript(ctx, s);
	else await commaScript(ctx, s);
};

// 開発用（pnpm dev の とき だけ。本番の ?debug では 出ない）：__neta("othello") で 板だけ、
// __netaMemo({ yakyu: {…} }) で 記録を 書かずに 差しかえる
if (import.meta.env.DEV && typeof window !== "undefined")
	Object.assign(window, {
		__neta: (kind: NetaPlay | "zero") => {
			const ctx = (window as unknown as { __village?: { ctx?: UiCtx } })
				.__village?.ctx;
			if (!ctx) throw new Error("__neta: no village");
			const id = kirikoId(returnNow());
			if (kind === "yakyu") return playYakyu(ctx, yakyuCard(0));
			if (kind === "othello") return playOthello(ctx);
			if (kind === "sk") return playSk(ctx);
			if (kind === "fukkin")
				return playFukkin(ctx, { id, reps: 39, done: 0, title: false });
			if (kind === "zero") return playZero(ctx, { id, title: false });
			return playComma(ctx, { id, title: false });
		},
		__netaMemo: (patch: Partial<NetaMemo>) => {
			saveNeta({ ...loadNeta(), ...patch }, true);
			return loadNeta();
		},
	});
