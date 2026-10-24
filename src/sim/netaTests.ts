// ネタスレの 遊び（data/neta/*・ui/neta/neta*.ts・グラウンド／碁会所／おんJ道場／ageジム／ゲームセンターの 物）の 試験（pnpm test）。
// 板（canvas）は 出さない：ui/neta/neta.ts の setNetaHooks で 結果を わたし、窓の 流れと 記録だけ 見る。
// 決まり（ランダム野球・オセロ・コンマ・!sk・ID）は 種つきの 乱数で 何度でも 同じ 結果。

import { TOWN_STAGES } from "../core/town";
import {
	COMMA_DENY,
	commaOf,
	isNearZoro,
	isZoro,
	wallClock,
	zeroClock,
	zeroDeny,
	zeroJudge,
	zeroOpen,
	zeroText,
} from "../data/neta/comma";
import {
	DENY_REPS,
	DENY_WORD,
	FUKKIN_SOTTOJI,
	fukkinReps,
	kirikoId,
} from "../data/neta/id";
import {
	BLACK,
	type Color,
	countDiscs,
	flipsOf,
	legalMoves,
	type OBoard,
	othelloAi,
	othelloOver,
	othelloPlay,
	othelloStart,
	WHITE,
} from "../data/neta/othello";
import { skColumns, skReelAt, skSentence } from "../data/neta/sk";
import {
	COMMA,
	FUKKIN,
	KABE_NAME,
	KABE_TALK,
	OTHELLO,
	SK,
	YAKYU,
} from "../data/neta/text";
import {
	YAKYU_INNINGS,
	YAKYU_MAX_INNINGS,
	YAKYU_ROUND,
	type YakyuState,
	yakyuBatted,
	yakyuCard,
	yakyuKind,
	yakyuSim,
	yakyuStart,
	yakyuStep,
} from "../data/neta/yakyu";
import { type Facility, facilityById } from "../data/village/facilities";
import type { VillageView } from "../data/village/map";
import type { Story } from "../engine/defs";
import type { Ctx } from "../ui/ctx";
import {
	commaScript,
	forgetNetaMemo,
	fukkinScript,
	kabeScript,
	loadNeta,
	saveNeta,
	setNetaHooks,
} from "../ui/neta/neta";
import { twoB } from "../ui/neta/netaBoard";
import { buildFacility, outdoorScript } from "../ui/village/facilities";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};
const CASES: { name: string; run: () => void | Promise<void> }[] = [];
const test = (name: string, run: () => void | Promise<void>) =>
	CASES.push({ name, run });

/** 決まった 乱数（試験を くり返しても 同じ）。 */
const seeded = (seed: number) => {
	let s = seed >>> 0 || 1;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
};
const fill = (t: string, v: Record<string, string | number>) =>
	t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

/** 地の文・セリフ・選ぶ だけを 記録する 台本の 相手（選ぶ ときは picks を 順に 返す）。 */
const recorder = (picks: number[] = []) => {
	const log: string[] = [];
	const s = new Proxy({} as Story, {
		get: (_t, k) => {
			if (k === "narrate")
				return async (t: string) => {
					log.push(`narrate: ${t}`);
				};
			if (k === "say")
				return async (_w: unknown, t: string, o?: { name?: string }) => {
					log.push(`say(${o?.name ?? ""}): ${t}`);
				};
			if (k === "choose")
				return async (opts: string[]) => {
					log.push(`choose: ${opts.join("/")}`);
					return picks.shift() ?? opts.length - 1;
				};
			if (k === "then") return undefined;
			return () => undefined;
		},
	});
	return { s, log };
};

/** localStorage を 試験の あいだだけ 差しかえる（記録の memo も 忘れる）。 */
const withStore = async (
	run: (store: Map<string, string>) => Promise<void> | void,
): Promise<void> => {
	const store = new Map<string, string>();
	const prev = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => {
				store.set(k, v);
			},
			removeItem: (k: string) => {
				store.delete(k);
			},
			key: (i: number) => [...store.keys()][i] ?? null,
			get length() {
				return store.size;
			},
		},
		configurable: true,
		writable: true,
	});
	forgetNetaMemo();
	try {
		await run(store);
	} finally {
		setNetaHooks(null);
		forgetNetaMemo();
		if (prev) Object.defineProperty(globalThis, "localStorage", prev);
		else delete (globalThis as { localStorage?: unknown }).localStorage;
	}
};

const CTX = {} as Ctx;
const fac = (id: string): Facility => {
	const f = facilityById(id);
	if (!f) throw new Fail(`no facility ${id}`);
	return f;
};
const thing = (fid: string, tid: string) => {
	const f = fac(fid);
	const t = f.outdoor?.find((x) => x.id === tid);
	if (!t) throw new Fail(`no ${fid}.${tid}`);
	return { f, t };
};
/** 部屋の 物の 台本（buildFacility → ui/village/facilities.ts の 振りわけ → ui/neta/neta.ts）。 */
const roomEvent = (fid: string, id: string) => {
	const view: VillageView = {
		stage: TOWN_STAGES - 1,
		unlocked: ["shallow"],
		cleared: [],
	};
	const ev = (buildFacility(fac(fid), view, CTX).events ?? []).find(
		(e) => e.id === id,
	);
	if (!ev?.run) throw new Fail(`no event ${fid}/${id}`);
	return ev.run;
};
const same = (log: string[], want: string[], what: string) =>
	ok(
		JSON.stringify(log) === JSON.stringify(want),
		`${what}:\n${log.join("\n")}\n--- want ---\n${want.join("\n")}`,
	);

// ───────────────── 置き場所 ─────────────────

const VIEWS: VillageView[] = [];
for (let stage = 0; stage < TOWN_STAGES; stage++)
	for (const unlocked of [
		["shallow"],
		["shallow", "main"],
		["shallow", "main", "deep"],
	] as const)
		VIEWS.push({
			stage,
			unlocked: [...unlocked],
			cleared: unlocked.slice(0, -1),
		});

// ───────────────── 文 ─────────────────

// ───────────────── ID・ランダム野球・オセロ・コンマ・!sk の 決まり ─────────────────

test("ID: 4文字・帰りごとに 同じ・休み（数字なし）は 4〜6割・淫夢の 数と 悪い 字の 並びは 出ない", () => {
	let rest = 0;
	const N = 20000;
	for (let i = 0; i < N; i++) {
		const at = 1_760_000_000_000 + i * 3_600_123;
		const id = kirikoId(at);
		ok(/^[0-9A-Za-z]{4}$/.test(id), id);
		ok(kirikoId(at) === id, "same return, same ID");
		const n = fukkinReps(id);
		if (n === null) rest++;
		else ok(!DENY_REPS.has(n), `${id} → ${n}`);
		ok(!DENY_WORD.test(id), id);
	}
	ok(rest / N > 0.4 && rest / N < 0.6, `rest ${rest / N}`);
	ok(
		fukkinReps("3y9n") === 39 &&
			fukkinReps("baka") === null &&
			fukkinReps("9800") === 9800,
		"template examples",
	);
	ok(fukkinReps("a0bc") === 0 && fukkinReps("0a5x") === 5, "zeros");
});

test("ランダム野球: ルールA の 目の 境目", () => {
	const want: [number, string][] = [
		[0, "tp"],
		[1, "hr"],
		[2, "dp"],
		[10, "dp"],
		[11, "out"],
		[64, "out"],
		[65, "wp"],
		[66, "wp"],
		[67, "bb"],
		[70, "bb"],
		[71, "sac"],
		[74, "sac"],
		[75, "h1"],
		[88, "h1"],
		[89, "h2"],
		[95, "h2"],
		[96, "h3"],
		[98, "h3"],
		[99, "fine"],
		[100, "hr"],
	];
	for (const [n, k] of want)
		ok(yakyuKind(n) === k, `${n} → ${yakyuKind(n)} (want ${k})`);
});

const at = (bases: [boolean, boolean, boolean], outs = 0): YakyuState => {
	const st = yakyuStart();
	st.bases = [...bases];
	st.outs = outs;
	return st;
};
test("ランダム野球: 1つずつの 進み方（三重殺・併殺・暴投・押し出し・犠打・二塁打・満塁弾）と 見え方", () => {
	// 【0】は いつでも 3アウトで チェンジ（塁が 空でも、0アウトでも）
	for (const bases of [
		[false, false, false],
		[true, false, false],
		[true, true, true],
	] as [boolean, boolean, boolean][]) {
		const st = at(bases);
		const r = yakyuStep(st, 0);
		ok(
			r.change &&
				r.label === "tp" &&
				r.outs === 3 &&
				!st.top &&
				st.score.away === 0,
			`tp with ${bases} → 3 outs, change`,
		);
	}
	let st = at([true, false, false]);
	let r = yakyuStep(st, 5);
	ok(
		st.outs === 2 && !st.bases[0] && !r.change && r.label === "dp",
		"dp: batter and runner on 1st",
	);
	st = at([false, false, false]);
	r = yakyuStep(st, 5);
	ok(
		st.outs === 1 && r.outs === 1 && r.label === "out",
		"dp with nobody on → 1 out, shown as an out",
	);
	st = at([false, true, false], 2);
	r = yakyuStep(st, 5);
	ok(r.change && r.label === "out", "dp with 2 outs → change, shown as out");
	st = at([false, false, true]);
	r = yakyuStep(st, 65);
	ok(
		r.runs === 1 && st.batter.away === 0 && !st.bases[2] && r.label === "wp",
		"wp: runner scores, same batter",
	);
	st = at([false, false, false]);
	r = yakyuStep(st, 66);
	ok(
		r.label === "wpEmpty" && st.batter.away === 0 && st.outs === 0,
		"wp with empty bases → the batter rolls again",
	);
	st = at([true, true, true]);
	r = yakyuStep(st, 68);
	ok(r.runs === 1 && st.bases.every(Boolean), "bb loaded → push");
	st = at([false, false, false]);
	r = yakyuStep(st, 72);
	ok(r.label === "sacOut" && st.outs === 1, "sac without runners → out");
	st = at([false, true, false], 2);
	r = yakyuStep(st, 72);
	ok(r.change && r.runs === 0, "sac for the 3rd out → no advance");
	st = at([true, false, true]);
	r = yakyuStep(st, 90);
	ok(
		r.runs === 1 && st.bases[1] && st.bases[2] && !st.bases[0],
		"h2 with 1st & 3rd",
	);
	st = at([true, true, true]);
	r = yakyuStep(st, 100);
	ok(r.runs === 4, "grand slam");
});

test("ランダム野球: 打者 一巡は 9人 打ちおえて チェンジで ない とき（暴投は 数えない）", () => {
	const st = yakyuStart();
	let pa = 0;
	let rounds = 0;
	// 暴投 2つ ＋ ヒット 9本：一巡は 9本目の あと 1回だけ
	for (const n of [65, 80, 80, 66, 80, 80, 80, 80, 80, 80, 80]) {
		const r = yakyuStep(st, n);
		pa = yakyuBatted(pa, r);
		if (pa === YAKYU_ROUND && r.kind !== "wp") rounds++;
	}
	ok(pa === YAKYU_ROUND && rounds === 1, `pa ${pa} rounds ${rounds}`);
	const r = yakyuStep(st, 0);
	ok(r.change && yakyuBatted(pa, r) === 0, "change resets");
});

test("ランダム野球: 2000試合 — かならず おわり、5〜7回、サヨナラは 5回以降の 裏だけ、引き分けは 7回だけ、後攻の 勝ちは 4〜5.5割", () => {
	const rand = seeded(2026);
	let home = 0;
	let draw = 0;
	let maxRolls = 0;
	for (let g = 0; g < 2000; g++) {
		const { st, rolls } = yakyuSim(rand);
		ok(st.over, `game ${g} did not end`);
		maxRolls = Math.max(maxRolls, rolls);
		ok(
			st.inning >= YAKYU_INNINGS && st.inning <= YAKYU_MAX_INNINGS,
			`inning ${st.inning}`,
		);
		if (st.sayonara)
			ok(st.over === "home" && st.inning >= YAKYU_INNINGS, "sayonara");
		if (st.over === "draw")
			ok(
				st.inning === YAKYU_MAX_INNINGS && st.score.home === st.score.away,
				"draw",
			);
		else ok(st.score.home !== st.score.away, "no winner by a tie");
		if (st.over === "home") home++;
		if (st.over === "draw") draw++;
	}
	ok(maxRolls < 200, `rolls ${maxRolls}`);
	ok(draw / 2000 > 0.03 && draw / 2000 < 0.12, `draw ${draw / 2000}`);
	ok(home / 2000 > 0.4 && home / 2000 < 0.55, `home ${home / 2000}`);
});

test("リバーシ: はじめの 手・返す 石・おわり", () => {
	const b = othelloStart();
	ok(
		JSON.stringify(legalMoves(b, BLACK)) === "[19,26,37,44]",
		`${legalMoves(b, BLACK)}`,
	);
	ok(JSON.stringify(flipsOf(b, 19, BLACK)) === "[27]", "19 flips 27");
	ok(
		flipsOf(b, 0, BLACK).length === 0 && flipsOf(b, 27, BLACK).length === 0,
		"illegal",
	);
	const after = othelloPlay(b, 19, BLACK);
	ok(countDiscs(after).black === 4 && countDiscs(after).white === 1, "4-1");
	ok(othelloOver(new Array(64).fill(BLACK)), "full board is over");
});

const play = (
	black: (b: OBoard, me: Color) => number | null,
	rand: () => number,
) => {
	let b: OBoard = othelloStart();
	let me: Color = BLACK;
	let passes = 0;
	let moves = 0;
	while (passes < 2 && moves < 80) {
		const mv = me === BLACK ? black(b, me) : othelloAi(b, me, rand);
		if (mv === null) passes++;
		else {
			ok(flipsOf(b, mv, me).length > 0, `illegal ${mv}`);
			passes = 0;
			b = othelloPlay(b, mv, me);
			moves++;
		}
		me = me === BLACK ? WHITE : BLACK;
	}
	ok(othelloOver(b), "ended without both passing");
	return countDiscs(b);
};
test("リバーシ: 常連は でたらめには 7割 勝ち、多く 返す だけの 打ち方には 1.5割 以上 負ける、角は 取る", () => {
	const rand = seeded(9);
	const randomMover = (b: OBoard, me: Color) => {
		const m = legalMoves(b, me);
		return m.length ? m[Math.floor(rand() * m.length)] : null;
	};
	const greedy = (b: OBoard, me: Color) => {
		const m = legalMoves(b, me);
		if (!m.length) return null;
		return m.reduce((a, x) =>
			flipsOf(b, x, me).length > flipsOf(b, a, me).length ? x : a,
		);
	};
	let aiWins = 0;
	for (let g = 0; g < 300; g++) {
		const c = play(randomMover, rand);
		if (c.white > c.black) aiWins++;
	}
	ok(aiWins / 300 >= 0.7, `vs random ${aiWins / 300}`);
	let humanWins = 0;
	for (let g = 0; g < 300; g++) {
		const c = play(greedy, rand);
		if (c.black > c.white) humanWins++;
	}
	ok(humanWins / 300 >= 0.15, `greedy wins ${humanWins / 300}`);
	const b = new Array(64).fill(0) as (0 | 1 | 2)[];
	b[9] = BLACK;
	b[18] = WHITE;
	b[1] = BLACK;
	b[2] = WHITE;
	ok(othelloAi(b, WHITE, () => 0) === 0, "takes the corner");
});

test("コンマ: ミリ秒・ゾロ目・惜しい・出さない 数／0時ちょうど: 時刻の 字と 判定と 開く 時刻", () => {
	ok(commaOf(1_760_000_000_992) === 992 && commaOf(-1) === 999, "commaOf");
	for (const z of [0, 111, 222, 333, 444, 555, 666, 777, 888, 999])
		ok(isZoro(z), `zoro ${z}`);
	ok(!isZoro(110) && !isZoro(1000), "not zoro");
	ok(
		isNearZoro(110) && isNearZoro(121) && !isNearZoro(123) && !isNearZoro(444),
		"near",
	);
	for (let ms = 0; ms < 1000; ms++)
		ok(!COMMA_DENY.has(commaOf(1_760_000_000_000 + ms)), `deny ${ms}`);
	ok(
		zeroText(-1) === "23:59:59.999" &&
			zeroText(40) === "00:00:00.040" &&
			zeroText(1234) === "00:00:01.234",
		"text",
	);
	const want: [number, string][] = [
		[-1, "early"],
		[0, "god"],
		[0.9, "god"],
		[1, "exact"],
		[9, "exact"],
		[10, "record"],
		[40, "record"],
		[41, "close"],
		[200, "close"],
		[201, "late"],
	];
	for (const [d, j] of want) ok(zeroJudge(d) === j, `${d} → ${zeroJudge(d)}`);
	ok(zeroOpen(23) && zeroOpen(0) && !zeroOpen(22) && !zeroOpen(1), "hours");
	// 0時ちょうども 淫夢の ミリ秒は 出さない（0時より 前も 後も。板の 回る 時計も 書きこみも zeroClock）、
	// 判定は かわらない
	for (let d = -5000; d <= 3000; d++) {
		const t = zeroClock(d);
		ok(t === zeroText(zeroDeny(d)), `zeroClock ${d}`);
		ok(!COMMA_DENY.has(Number(t.slice(-3))), `zero ${d} → ${t}`);
		ok(zeroJudge(zeroDeny(d)) === zeroJudge(d), `judge ${d}`);
	}
	for (const d of [-4190.5, -2636.2, 514.9, 810.4, 931.99])
		ok(!COMMA_DENY.has(Number(zeroClock(d).slice(-3))), `zero ${d}`);
	ok(
		zeroText(zeroDeny(810)) === "00:00:00.811" &&
			zeroText(zeroDeny(-190)) === "23:59:59.811" &&
			zeroDeny(40) === 40,
		"zeroDeny",
	);
	// 時刻の 11:45:14 は 11:45:15 に（端末の 時計。ミリ秒は commaOf）
	ok(
		wallClock(new Date(2026, 9, 10, 11, 45, 14, 500).getTime()) ===
			"11:45:15.500" &&
			wallClock(new Date(2026, 9, 10, 11, 45, 13, 992).getTime()) ===
				"11:45:13.992",
		"wallClock",
	);
});

test("!sk: 文・縦の 列・目の 回り", () => {
	ok(skSentence(0, 0, 0) === "名無しが銭湯で起きた。", skSentence(0, 0, 0));
	ok(skSentence(5, 0, 1) === "ぷゆゆが銭湯で寝た。", skSentence(5, 0, 1));
	ok(
		JSON.stringify(skColumns(5, 0, 1)) ===
			JSON.stringify(["ぷゆゆが", "銭湯で", "寝た。"]),
		"columns",
	);
	ok(
		skReelAt(0, 0, 8, 3) === 3 &&
			skReelAt(0, 110, 8, 3) === 4 &&
			skReelAt(0, 110 * 5, 8, 3) === 0,
		"reel",
	);
});

test("板の 入力: B を 1.5秒 以内に 2回で やめる、過ぎたら 1度だけ「もどす」合図（次の B は また 1回目）", () => {
	const q = twoB(1500);
	ok(!q.lapsed(0), "nothing pressed");
	ok(!q.press(1000) && q.press(2400), "two within 1.5 s");
	ok(!q.lapsed(9000), "no lapse after a quit");
	ok(!q.press(10_000), "first again");
	ok(!q.lapsed(11_500) && q.lapsed(11_501), "lapse after 1.5 s");
	ok(!q.lapsed(12_000), "lapse only once");
	ok(!q.press(12_100) && !q.lapsed(13_000) && q.press(13_100), "re-armed");
});

// ───────────────── 窓の 流れ と 記録 ─────────────────

test("記録: こわれた 保存は はじめの 値・?stage= の ときは 書かない・キーは kiriko-roguelike/neta", async () => {
	await withStore((store) => {
		store.set("kiriko-roguelike/neta", "{oops");
		ok(loadNeta().yakyu.w === 0, "garbage → fresh");
		forgetNetaMemo();
		store.set(
			"kiriko-roguelike/neta",
			JSON.stringify({ v: 1, yakyu: { w: -3, l: "x", d: 2 }, sk: { last: 5 } }),
		);
		const m = loadNeta();
		ok(
			m.yakyu.w === 0 && m.yakyu.l === 0 && m.yakyu.d === 2 && m.sk.last === "",
			"fields",
		);
		store.clear();
		forgetNetaMemo();
		const n = loadNeta();
		n.yakyu.w = 3;
		saveNeta(n, true);
		ok(
			!store.has("kiriko-roguelike/neta") && loadNeta().yakyu.w === 3,
			"preview: memo only",
		);
		saveNeta(n, false);
		ok(store.has("kiriko-roguelike/neta"), "saved");
	});
});

test("グラウンド: 三塁側の ベンチ → 文 → ランダム野球／やめる（やめるなら 板なし）、1勝 1敗で 5割の壁が 動く", async () => {
	await withStore(async () => {
		const { f, t } = thing("ground", "bench_r");
		let r = recorder([2]);
		await outdoorScript(CTX, f, t)(r.s);
		same(
			r.log,
			[
				...t.lines.map((l) => `narrate: ${l}`),
				`choose: ${YAKYU.menu.join("/")}`,
			],
			"quit",
		);
		const cards: string[] = [];
		const results = ["home", "away"] as const;
		setNetaHooks({
			yakyu: async (card) => {
				cards.push(`${card.home}-${card.away}`);
				const w = results[cards.length - 1];
				return {
					home: w === "home" ? 3 : 1,
					away: w === "home" ? 1 : 3,
					winner: w,
					innings: 5,
					sayonara: false,
				};
			},
		});
		r = recorder([0]);
		await outdoorScript(CTX, f, t)(r.s);
		same(
			r.log,
			[
				...t.lines.map((l) => `narrate: ${l}`),
				`choose: ${YAKYU.menu.join("/")}`,
				`narrate: ${YAKYU.rule}`,
				`narrate: ${fill(YAKYU.after, { w: 1, l: 0, d: 0 })}`,
			],
			"1st game",
		);
		// 2回目は ハイスコア（戦績）を 見てから 遊ぶ
		r = recorder([1, 0]);
		await outdoorScript(CTX, f, t)(r.s);
		same(
			r.log,
			[
				...t.lines.map((l) => `narrate: ${l}`),
				`choose: ${YAKYU.menu.join("/")}`,
				`narrate: ${fill(YAKYU.record, { w: 1, l: 0, d: 0 })}`,
				`choose: ${YAKYU.menu.join("/")}`,
				`narrate: ${fill(YAKYU.after, { w: 1, l: 1, d: 0 })}`,
				`narrate: ${YAKYU.kabeHint}`,
			],
			"2nd game",
		);
		const c0 = yakyuCard(0);
		const c1 = yakyuCard(1);
		ok(
			cards.join() === `${c0.home}-${c0.away},${c1.home}-${c1.away}`,
			`cards ${cards}`,
		);
	});
});

test("5割の壁: 5割で ない ときは「……」だけ、5割なら しゃべった 帰りが かわるたびに 次の 1つ（順に、6つ目の あとは はじめから）", async () => {
	await withStore(async () => {
		const { f, t } = thing("ground", "kabe");
		let r = recorder();
		await outdoorScript(CTX, f, t)(r.s);
		same(r.log, [`say(${KABE_NAME}): ……`], "silent");
		const m = loadNeta();
		m.yakyu = { ...m.yakyu, w: 1, l: 1 };
		saveNeta(m, true);
		// 物から（帰りは まだ ない ＝ 0）：はじめの 1つ、同じ 帰りは 何度でも 同じ
		for (let i = 0; i < 2; i++) {
			r = recorder();
			await outdoorScript(CTX, f, t)(r.s);
			same(
				r.log,
				[`say(${KABE_NAME}): ……`, `say(${KABE_NAME}): ${KABE_TALK[0]}`],
				`5割 ${i}`,
			);
		}
		// 帰りが かわるたびに 次の 1つ（6つ目の「……1つ　勝ったら、また　だまる。」の あとは はじめから）
		const heard: string[] = [];
		for (const ret of [10, 10, 20, 30, 40, 50, 60]) {
			r = recorder();
			await kabeScript(r.s, ret);
			heard.push(r.log.join());
		}
		const want = [1, 1, 2, 3, 4, 5, 0].map(
			(i) => `say(${KABE_NAME}): ${KABE_TALK[i]}`,
		);
		same(heard, want, "order");
		ok(KABE_TALK[5].includes("まただまる"), "the last line closes the loop");
		// 2勝1敗（5割で ない）に なったら また「……」だけ
		const n = loadNeta();
		n.yakyu = { ...n.yakyu, w: 2, l: 1 };
		saveNeta(n, true);
		r = recorder();
		await outdoorScript(CTX, f, t)(r.s);
		same(r.log, [`say(${KABE_NAME}): ……`], "left 5割");
		r = recorder();
		await kabeScript(r.s, 70);
		same(r.log, [], "kabeScript is silent off 5割");
	});
});

test("碁会所: リバーシ盤 → 対局（はじめだけ 決まりの 1窓）→ 勝ち・負け・引き分けの 1窓、投了は 1窓、記録に 残る", async () => {
	await withStore(async () => {
		const run = roomEvent("go", "othello_0");
		const line = fac("go").room?.lines.othello ?? [];
		setNetaHooks({ othello: async () => ({ black: 40, white: 24 }) });
		let r = recorder([0]);
		await run(r.s);
		same(
			r.log,
			[
				...line.map((l) => `narrate: ${l}`),
				`choose: ${OTHELLO.menu.join("/")}`,
				`narrate: ${OTHELLO.rule}`,
				`narrate: ${fill(OTHELLO.afterWin, { b: 40, w: 24 })}`,
			],
			"win",
		);
		ok(loadNeta().othello.w === 1 && loadNeta().othello.best === 16, "record");
		setNetaHooks({ othello: async () => null });
		r = recorder([0]);
		await run(r.s);
		same(
			r.log,
			[
				...line.map((l) => `narrate: ${l}`),
				`choose: ${OTHELLO.menu.join("/")}`,
				`narrate: ${OTHELLO.resigned}`,
			],
			"resign",
		);
		setNetaHooks({ othello: async () => ({ black: 20, white: 44 }) });
		r = recorder([0]);
		await run(r.s);
		same(
			r.log,
			[
				...line.map((l) => `narrate: ${l}`),
				`choose: ${OTHELLO.menu.join("/")}`,
				`narrate: ${fill(OTHELLO.afterLose, { b: 20, w: 44 })}`,
			],
			"lose",
		);
		setNetaHooks({ othello: async () => ({ black: 32, white: 32 }) });
		r = recorder([1, 0]);
		await run(r.s);
		same(
			r.log,
			[
				...line.map((l) => `narrate: ${l}`),
				`choose: ${OTHELLO.menu.join("/")}`,
				`narrate: ${fill(OTHELLO.record, { w: 1, l: 1, d: 0 })}`,
				`choose: ${OTHELLO.menu.join("/")}`,
				`narrate: ${fill(OTHELLO.afterDraw, { b: 32, w: 32 })}`,
			],
			"draw",
		);
		const o = loadNeta().othello;
		ok(o.w === 1 && o.l === 1 && o.d === 1 && o.best === 16, "record 1-1-1");
	});
});

test("おんJ道場: 文机 → 書く → 半紙を 乾かす（師範たちの 1窓は 順に）、次は 前の 半紙から", async () => {
	await withStore(async () => {
		const run = roomEvent("dojo", "shuji_0");
		const line = fac("dojo").room?.lines.shuji ?? [];
		setNetaHooks({ sk: async () => ({ a: 5, b: 0, c: 1 }) });
		let r = recorder([0]);
		await run(r.s);
		same(
			r.log,
			[
				...line.map((l) => `narrate: ${l}`),
				`choose: ${SK.menu.join("/")}`,
				`narrate: ${SK.dried}`,
				`narrate: ${SK.react[0]}`,
			],
			"first",
		);
		r = recorder([1]);
		await run(r.s);
		same(
			r.log,
			[
				...line.map((l) => `narrate: ${l}`),
				`narrate: ${fill(SK.last, { text: "ぷゆゆが銭湯で寝た。" })}`,
				`choose: ${SK.menu.join("/")}`,
			],
			"second",
		);
	});
});

/** ID の 回数が want を 満たす いちばん 小さい 帰り（1 から 数える）。 */
const findReturn = (want: (reps: number | null) => boolean): number => {
	for (let at = 1; at < 2_000_000; at++)
		if (want(fukkinReps(kirikoId(at)))) return at;
	throw new Fail("no such return");
};

test("ageジム: 腹筋台（1窓）→ 書きこむ（はじめだけ 決まりの 1窓）→ ID と 回数の 1窓 → 腹筋 → そっ閉じ・つづき・完走、完走した 帰りは「もうおわっている」、休み・0回・1000回 以上", async () => {
	await withStore(async () => {
		const run = roomEvent("gym", "fukkin_0");
		const line = fac("gym").room?.lines.fukkin ?? [];
		ok(line.length === 1, "the thing reads 1 window");
		const id = kirikoId(0);
		const reps = fukkinReps(id);
		ok(reps !== null && reps > 0 && reps < 1000, `ID for return 0: ${id}`);
		if (reps === null) return;
		let give = Math.floor(reps / 2);
		setNetaHooks({ fukkin: async () => ({ done: give }) });
		let r = recorder([0, 0]);
		await run(r.s);
		same(
			r.log,
			[
				...line.map((l) => `narrate: ${l}`),
				`choose: ${FUKKIN.menu.join("/")}`,
				`narrate: ${FUKKIN.rule}`,
				`narrate: ${fill(FUKKIN.posted, { id, n: reps })}`,
				`choose: ${FUKKIN.menu2.join("/")}`,
				`narrate: ${fill(FUKKIN.stopped, { done: give, total: give })}`,
			],
			"half",
		);
		const half = give;
		give = reps;
		r = recorder([0, 0]);
		await run(r.s);
		same(
			r.log,
			[
				...line.map((l) => `narrate: ${l}`),
				`choose: ${FUKKIN.menuResume.join("/")}`,
				`narrate: ${fill(FUKKIN.postedLeft, { id, n: reps, left: reps - half })}`,
				`choose: ${FUKKIN.menu2.join("/")}`,
				`narrate: ${fill(FUKKIN.finish, { n: reps, total: reps })}`,
			],
			"finish",
		);
		r = recorder();
		await run(r.s);
		same(
			r.log,
			[...line.map((l) => `narrate: ${l}`), `narrate: ${FUKKIN.doneToday}`],
			"done today",
		);
		// 数字の ない ID の 帰り（休み）
		const restAt = findReturn((n) => n === null);
		r = recorder([0]);
		await fukkinScript(CTX, r.s, restAt);
		same(
			r.log,
			[
				`choose: ${FUKKIN.menu.join("/")}`,
				`narrate: ${fill(FUKKIN.rest, { id: kirikoId(restAt) })}`,
				`narrate: ${FUKKIN.restRes}`,
			],
			"rest",
		);
		// 数字が 0 だけの ID（0回）
		const zeroAt = findReturn((n) => n === 0);
		r = recorder([0]);
		await fukkinScript(CTX, r.s, zeroAt);
		same(
			r.log,
			[
				`choose: ${FUKKIN.menu.join("/")}`,
				`narrate: ${fill(FUKKIN.zero, { id: kirikoId(zeroAt) })}`,
			],
			"zero",
		);
		// 1000回 以上：トレーナーの「……そっ閉じ定期や」の あと、そっ閉じを 選べば 板は 出ない
		const bigAt = findReturn((n) => n !== null && n >= FUKKIN_SOTTOJI);
		const big = fukkinReps(kirikoId(bigAt)) ?? 0;
		let boards = 0;
		setNetaHooks({
			fukkin: async () => {
				boards++;
				return { done: 0 };
			},
		});
		r = recorder([0, 1]);
		await fukkinScript(CTX, r.s, bigAt);
		same(
			r.log,
			[
				`choose: ${FUKKIN.menu.join("/")}`,
				`narrate: ${fill(FUKKIN.posted, { id: kirikoId(bigAt), n: big })}`,
				`narrate: ${FUKKIN.sottoji}`,
				`choose: ${FUKKIN.menu2.join("/")}`,
			],
			"sottoji",
		);
		ok(boards === 0, "そっ閉じ → no board");
		// つづきは「つづける」で、トレーナーの 1窓は くり返さない
		setNetaHooks({ fukkin: async (o) => ({ done: o.done + 5 }) });
		r = recorder([0, 0]);
		await fukkinScript(CTX, r.s, bigAt);
		r = recorder([0, 0]);
		await fukkinScript(CTX, r.s, bigAt);
		same(
			r.log,
			[
				`choose: ${FUKKIN.menuResume.join("/")}`,
				`narrate: ${fill(FUKKIN.postedLeft, { id: kirikoId(bigAt), n: big, left: big - 5 })}`,
				`choose: ${FUKKIN.menu2.join("/")}`,
				`narrate: ${fill(FUKKIN.stopped, { done: 10, total: reps + 10 })}`,
			],
			"resume big",
		);
	});
});

test("ゲームセンター: コンマの 台 → 昼は コンマだけ・夜（23時・0時台）は 0時ちょうども、はじめての ゾロ目で ▲第一当選者、0時ちょうどの 記録", async () => {
	await withStore(async () => {
		// 部屋の 物から（時刻は 端末しだい：どちらかの 品書きで やめる）
		const run = roomEvent("arcade", "comma_0");
		let r = recorder();
		await run(r.s);
		ok(
			r.log[1] === `choose: ${COMMA.menu.join("/")}` ||
				r.log[1] === `choose: ${COMMA.menuNight.join("/")}`,
			r.log.join("\n"),
		);
		// はじめに 0時ちょうどを 選んでも ゾロ目の 決まりは 出ない。B で やめたら 窓なし
		setNetaHooks({ zero: async () => null });
		r = recorder([1]);
		await commaScript(CTX, r.s, 23);
		same(r.log, [`choose: ${COMMA.menuNight.join("/")}`], "zero quit");
		ok(!loadNeta().comma.tutored, "no rule for 0時");
		setNetaHooks({ comma: async () => ({ stamps: [111, 234] }) });
		r = recorder([0]);
		await commaScript(CTX, r.s, 12);
		same(
			r.log,
			[
				`choose: ${COMMA.menu.join("/")}`,
				`narrate: ${COMMA.rule}`,
				`narrate: ${COMMA.zoroAfter}`,
				`narrate: ${COMMA.titleGot}`,
			],
			"first zoro",
		);
		ok(loadNeta().comma.title && loadNeta().comma.posts === 2, "title");
		setNetaHooks({ comma: async () => ({ stamps: [123] }) });
		r = recorder([0]);
		await commaScript(CTX, r.s, 12);
		same(
			r.log,
			[`choose: ${COMMA.menu.join("/")}`, `narrate: ${COMMA.noZoro}`],
			"no zoro",
		);
		// はじめての 1回は いちばんの 窓なし（いちばんに 決まって いる）、前の いちばんを 超えたら 出る
		let diff: number | null = 200;
		setNetaHooks({ zero: async () => ({ diff }) });
		r = recorder([1]);
		await commaScript(CTX, r.s, 0);
		same(
			r.log,
			[
				`choose: ${COMMA.menuNight.join("/")}`,
				`narrate: ${fill(COMMA.zeroAfter, { time: "00:00:00.200", judge: COMMA.judge.close })}`,
			],
			"zero first",
		);
		ok(loadNeta().comma.best0 === 200, "first best0");
		diff = 40;
		r = recorder([1]);
		await commaScript(CTX, r.s, 0);
		same(
			r.log,
			[
				`choose: ${COMMA.menuNight.join("/")}`,
				`narrate: ${fill(COMMA.zeroAfter, { time: "00:00:00.040", judge: COMMA.judge.record })}`,
				`narrate: ${fill(COMMA.zeroBest, { best: "00:00:00.040" })}`,
			],
			"zero best",
		);
		diff = -5;
		r = recorder([1]);
		await commaScript(CTX, r.s, 23);
		same(
			r.log,
			[
				`choose: ${COMMA.menuNight.join("/")}`,
				`narrate: ${fill(COMMA.zeroAfter, { time: "23:59:59.995", judge: COMMA.judge.early })}`,
			],
			"early",
		);
		diff = null;
		r = recorder([1]);
		await commaScript(CTX, r.s, 0);
		same(
			r.log,
			[`choose: ${COMMA.menuNight.join("/")}`, `narrate: ${COMMA.zeroNone}`],
			"none",
		);
		// 淫夢の ミリ秒は 窓にも 出さない（.810 → .811）
		diff = 810;
		r = recorder([1]);
		await commaScript(CTX, r.s, 0);
		same(
			r.log,
			[
				`choose: ${COMMA.menuNight.join("/")}`,
				`narrate: ${fill(COMMA.zeroAfter, { time: "00:00:00.811", judge: COMMA.judge.late })}`,
			],
			"deny ms",
		);
		ok(loadNeta().comma.best0 === 40, "best0");
		// 名無しの 返しは 判定で 1つ（スレ 1791385105 の 原文）
		ok(
			COMMA.posts.zero.god === "まじか" &&
				COMMA.posts.zero.close === "おしい" &&
				COMMA.posts.zero.late === "そういや重いんだったな" &&
				COMMA.posts.zero.early === "あーむりか",
			"zero replies",
		);
	});
});

export const runNetaTests = async (): Promise<TestResult[]> => {
	const out: TestResult[] = [];
	for (const c of CASES) {
		try {
			await c.run();
			out.push({ id: "neta", name: c.name, ok: true });
		} catch (e) {
			out.push({
				id: "neta",
				name: c.name,
				ok: false,
				reason: e instanceof Fail ? e.message : String(e),
			});
		}
	}
	return out;
};
