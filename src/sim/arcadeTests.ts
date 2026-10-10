// ゲームセンターの 筐体の 遊び（data/arcade/*・ui/arcade*.ts・ゲームセンター「連コ」の 部屋の 物）の 試験（pnpm test）。
// 板（canvas）は 出さない：決まりは 種つきの 乱数と 決まった 手で 回し、窓の 流れは ui/arcade.ts の setArcadeHooks で 見る。

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOWN_STAGES } from "../core/town";
import {
	AW,
	BK,
	bkStart,
	bkStep,
	DR,
	drScore,
	drStart,
	drStep,
	FT_FOES,
	ftInWindow,
	ftStart,
	ftStep,
	ML,
	mlStart,
	mlStep,
	RH,
	RN,
	rhChart,
	rhJudgeOf,
	rhStart,
	rhStep,
	rnScore,
	rnStart,
	rnStep,
	SH,
	SL,
	SL_PAY,
	SL_REELS,
	SL_SYMS,
	shStart,
	shStep,
	slAt,
	slLine,
	slStart,
	slStep,
} from "../data/arcade/logic";
import {
	GC,
	GC_PAY,
	GC_SYMS,
	GS,
	gcPayout,
	gcRoll,
	gcStart,
	gcStep,
	gsPoints,
	gsStart,
	gsStep,
	gsStopX,
	HL,
	hlJudge,
	hlScore,
	hlStart,
	hlStep,
	RL_PAY,
	RL_RED,
	RL_WHEEL,
	rlColorOf,
	rlNumber,
	rlStart,
	rlStep,
	SK_H,
	SK_W,
	SW,
	swDistance,
	swStart,
	swStep,
	swTruth,
} from "../data/arcade/parlor";
import { ARCADE, ARCADE_BOARD, ARCADE_TEXT } from "../data/arcade/text";
import { ARCADE_GAMES, ARCADE_HOME, isArcadeGame } from "../data/arcade/types";
import { sfx } from "../data/sfx";
import {
	type Facility,
	facilityById,
	facilityRoomPlaces,
} from "../data/village/facilities";
import type { VillageView } from "../data/village/map";
import type { Story } from "../engine/defs";
import {
	arcadeScript,
	forgetArcadeMemo,
	loadArcade,
	saveArcade,
	setArcadeHooks,
} from "../ui/arcade";
import type { Ctx } from "../ui/ctx";
import { buildFacility } from "../ui/facilities";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};
const CASES: { name: string; run: () => void | Promise<void> }[] = [];
const test = (name: string, run: () => void | Promise<void>) =>
	CASES.push({ name, run });

const seeded = (seed: number) => {
	let s = seed >>> 0 || 1;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
};
/** netaTests.ts の BANNED と 同じ（画面に 出さない 語）。 */
const BANNED =
	/落ちる|落ちた|落ちない|黄色|きいろ|山吹|114514|1919|810|うんこ|うんち|マイクラ|オセロ|ガイジ|アスペ|チー牛|原カス|淫夢/;
const width = (s: string) =>
	[...s].reduce((n, c) => n + (/[\x20-\x7e｡-ﾟ]/.test(c) ? 0.5 : 1), 0);
const fits = (where: string, s: string, w = 22, lines = 2) => {
	const ls = s.split("\n");
	ok(ls.length <= lines, `${where}: ${ls.length} lines`);
	for (const l of ls) ok(width(l) <= w, `${where}: "${l}" is ${width(l)} wide`);
	ok(!/\p{Extended_Pictographic}/u.test(s), `${where}: emoji`);
	ok(!BANNED.test(s), `${where}: banned word`);
};
const fill = (t: string, v: Record<string, string | number>) =>
	t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

const recorder = (picks: number[] = []) => {
	const log: string[] = [];
	const s = new Proxy({} as Story, {
		get: (_t, k) => {
			if (k === "narrate")
				return async (t: string) => {
					log.push(`narrate: ${t}`);
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
	forgetArcadeMemo();
	try {
		await run(store);
	} finally {
		setArcadeHooks(null);
		forgetArcadeMemo();
		if (prev) Object.defineProperty(globalThis, "localStorage", prev);
		else delete (globalThis as { localStorage?: unknown }).localStorage;
	}
};

const played: string[] = [];
const CTX = {
	se: (n: string) => {
		played.push(n);
	},
} as unknown as Ctx;
const fac = (id: string): Facility => {
	const f = facilityById(id);
	if (!f) throw new Fail(`no facility ${id}`);
	return f;
};
const same = (log: string[], want: string[], what: string) =>
	ok(
		JSON.stringify(log) === JSON.stringify(want),
		`${what}:\n${log.join("\n")}\n--- want ---\n${want.join("\n")}`,
	);

// ───────────────── 置き場所・つなぎ ─────────────────

test("置き場所: 筐体 7台と 音ゲーの 台は それぞれ 別の ゲーム（同じ ゲームは 1台だけ）", () => {
	const room = fac("arcade").room;
	ok(room, "arcade has a room");
	if (!room) return;
	// 部屋の 字ごとの ゲーム（音ゲーは 2マスで 1台）
	const byChar: Record<string, string> = {};
	for (const [ch, kind] of Object.entries(room.things))
		if (isArcadeGame(kind)) byChar[ch] = kind;
	const cabinets = ["A", "b", "C", "K", "E", "G", "I"];
	for (const ch of cabinets)
		ok(isArcadeGame(byChar[ch]), `cabinet ${ch} has a game`);
	const games = cabinets.map((ch) => byChar[ch]);
	ok(new Set(games).size === cabinets.length, `one game per cabinet: ${games}`);
	ok(byChar.v === "rhythm" && byChar.V === "rhythm", "the rhythm machine");
	ok(
		JSON.stringify([...new Set(Object.values(byChar))].sort()) ===
			JSON.stringify(
				ARCADE_GAMES.filter((g) => ARCADE_HOME[g] === "arcade").sort(),
			),
		"every game has a machine",
	);
	// 古い「cabinet」の 文は もう ない
	ok(!room.lines.cabinet, "no generic cabinet line");
});

test("置き場所: どの ゲームも 決まった 施設の 物に あり（plays は arcade・文・調べる 所）、ほかの 施設には ない", () => {
	for (const g of ARCADE_GAMES) {
		const f = fac(ARCADE_HOME[g]);
		const room = f.room;
		if (!room) throw new Fail(`${f.id} has no room`);
		ok(Object.values(room.things).includes(g), `${g} is a thing in ${f.id}`);
		ok(room.plays?.[g] === "arcade", `${g} plays arcade`);
		ok(room.lines[g]?.[0] === ARCADE_TEXT[g].line, `${g} line`);
		ok(
			facilityRoomPlaces(f).some(
				(p) => p.id === `${g}_0` && p.trigger === "talk",
			),
			`${g} place`,
		);
	}
	for (const id of ["arcade", "casino", "umi", "bar", "go", "gym", "cinema"]) {
		const room = fac(id).room;
		for (const [kind, play] of Object.entries(room?.plays ?? {}))
			if (play === "arcade")
				ok(isArcadeGame(kind) && ARCADE_HOME[kind] === id, `${id}.${kind}`);
	}
	// カジノの 台は どれも 遊べる（文だけの 台は ない）。チップは 遊びの チップ
	const casino = fac("casino").room;
	for (const k of ["slot", "cards", "cooler"])
		ok(!casino?.lines[k], `no old ${k} line`);
	ok(
		casino?.people
			?.find((p) => p.id === "casino_dealer")
			?.lines[0]?.includes("遊びの　チップ"),
		"dealer",
	);
});

test("置き場所: 筐体の 前に 人が 立たない（乱入待ちの 名無しは 格ゲーの 台の 横）", () => {
	const f = fac("arcade");
	const room = f.room;
	if (!room) throw new Fail("no room");
	const a = room.people?.find((p) => p.id === "arcade_a");
	ok(a && a.at[0] === 6 && a.at[1] === 4 && a.dir === "left", "arcade_a");
	ok(room.things[room.rows[3]?.[5] ?? ""] === "fighter", "fighter by him");
	// 奥の 5台の 前（1つ下の マス）は あいて いる
	for (let x = 1; x <= 5; x++)
		ok(
			!room.people?.some((p) => p.at[0] === x && p.at[1] === 4),
			`front of (${x},3) is free`,
		);
});

test("つなぎ: 部屋の 物を 調べると 文 → 品書き（ui/facilities.ts → ui/arcade.ts）", async () => {
	await withStore(async () => {
		const view: VillageView = {
			stage: TOWN_STAGES - 1,
			unlocked: ["shallow"],
			cleared: [],
		};
		for (const g of ARCADE_GAMES) {
			const events = buildFacility(fac(ARCADE_HOME[g]), view, CTX).events ?? [];
			const ev = events.find((e) => e.id === `${g}_0`);
			ok(ev?.run, `event ${g}`);
			if (!ev?.run) continue;
			const r = recorder([1]);
			await ev.run(r.s);
			same(
				r.log,
				[`narrate: ${ARCADE_TEXT[g].line}`, `choose: ${ARCADE.menu.join("/")}`],
				g,
			);
		}
	});
});

// ───────────────── 文・音 ─────────────────

test("文: 窓は 22×2、板の 題と 押し方は 1行 22、ボタン 9", () => {
	for (const g of ARCADE_GAMES) {
		const t = ARCADE_TEXT[g];
		fits(`${g}.line`, t.line);
		fits(`${g}.rule`, t.rule);
		fits(`${g}.title`, t.title, 22, 1);
		fits(`${g}.hint`, t.hint, 22, 1);
		fits(`${g}.record`, fill(ARCADE.record, { best: 9_999_999, unit: t.unit }));
		fits(`${g}.after`, fill(ARCADE.after, { score: 9_999_999, unit: t.unit }));
	}
	for (const k of ["newBest", "quit"] as const) fits(`ARCADE.${k}`, ARCADE[k]);
	for (const k of ["ready", "over", "clear", "quit1"] as const)
		fits(`ARCADE.${k}`, ARCADE[k], 22, 1);
	for (const m of ARCADE.menu) ok(width(m) <= 9, `menu ${m}`);
	for (const [k, v] of Object.entries(ARCADE_BOARD))
		if (typeof v === "string")
			fits(`ARCADE_BOARD.${k}`, fill(v, { n: 999, name: "レスバ常勝" }), 22, 1);
	for (const f of FT_FOES) ok(width(f.name) <= 6, `foe name ${f.name}`);
	// スイカ割りの 声（名前 ＋ 本文が 板の 右の 欄＝7px の 字で 96px に 入る：13字まで）
	for (const n of ARCADE_BOARD.swNear)
		for (const d of Object.values(ARCADE_BOARD.swDirs))
			for (const who of [ARCADE_BOARD.swNanashi, ARCADE_BOARD.swTroll]) {
				const t = fill(n, { dir: d });
				fits("swNear", t, 22, 1);
				ok(width(who) + width(t) <= 12.5, `swNear "${who} ${t}"`);
			}
	for (const t of ARCADE_TEXT.gacha.rule.split("\n")) ok(width(t) <= 22, t);
});

test("音: 板と 窓で 鳴らす 効果音は どれも data/sfx.ts に ある", () => {
	const root = join(process.cwd(), "src/ui");
	const names = new Set<string>(["victory", "miss"]);
	for (const file of [
		"arcade.ts",
		"arcadeKit.ts",
		"arcadeAction.ts",
		"arcadeTiming.ts",
		"arcadeParlor.ts",
	]) {
		const src = readFileSync(join(root, file), "utf8");
		for (const m of src.matchAll(/se\("([A-Za-z_]+)"\)/g))
			if (m[1]) names.add(m[1]);
	}
	ok(names.size >= 15, `found ${names.size} sounds`);
	for (const n of names) ok(sfx[n], `no sound file for ${n}`);
});

// ───────────────── 決まり ─────────────────

test("シューティング: 撃たないと 残機が なくなる・よく 撃つと 60秒 しのいで ボーナス", () => {
	let s = shStart();
	let rnd = seeded(1);
	for (let i = 0; i < 60 * 30 && !s.over; i++)
		shStep(s, 1 / 30, { fire: false }, rnd);
	ok(s.over && s.lives === 0 && s.score === 0, "idle loses");
	// いちばん 下の 荒らしの 真下へ 行って 撃ちつづける
	s = shStart();
	rnd = seeded(2);
	let kills = 0;
	for (let i = 0; i < 61 * 30 && !s.over; i++) {
		const low = [...s.foes].sort((a, b) => b.y - a.y)[0];
		const ev = shStep(s, 1 / 30, { target: low?.x ?? AW / 2, fire: true }, rnd);
		kills += ev.filter((e) => e === "kill").length;
	}
	ok(s.over && s.t >= SH.time - 0.05, `time up (t=${s.t}, lives=${s.lives})`);
	ok(kills > 30 && s.score > kills * 10, `kills ${kills} score ${s.score}`);
});

test("レースゲーム: 動かないと ぶつかる・空いた 車線へ よけると 長く 走れる、どの 列も 1車線は 空く", () => {
	let s = drStart();
	let rnd = seeded(3);
	for (let i = 0; i < 120 * 30 && !s.over; i++) drStep(s, 1 / 30, 0, rnd);
	ok(s.over, "idle crashes");
	const idle = drScore(s);
	s = drStart();
	rnd = seeded(4);
	for (let i = 0; i < 90 * 30 && !s.over; i++) {
		// 前に いちばん 近い じゃまの ない 車線へ
		const danger = (lane: number) =>
			s.things.some(
				(o) =>
					o.lane === lane &&
					o.kind !== "hoshu" &&
					o.y > DR.carY - 70 &&
					o.y < DR.carY + 12,
			);
		let move: -1 | 0 | 1 = 0;
		if (danger(s.lane)) {
			if (s.lane > 0 && !danger(s.lane - 1)) move = -1;
			else if (s.lane < 2 && !danger(s.lane + 1)) move = 1;
		}
		drStep(s, 1 / 30, move, rnd);
		// 同じ 高さの じゃまは 2つまで
		const rows = new Map<number, number>();
		for (const o of s.things)
			if (o.kind !== "hoshu") rows.set(o.y, (rows.get(o.y) ?? 0) + 1);
		for (const n of rows.values()) ok(n <= 2, "a lane is always open");
	}
	ok(drScore(s) > idle * 3, `dodging ${drScore(s)} vs idle ${idle}`);
});

test("ブロックくずし: 板で 追えば 1面 くずせる（次の 面へ）、追わないと 3球で おわり", () => {
	let s = bkStart();
	let rnd = seeded(5);
	bkStep(s, 1 / 60, { launch: true }, rnd);
	for (let i = 0; i < 600 * 60 && !s.over; i++) {
		bkStep(s, 1 / 60, { target: s.pad, launch: false }, rnd);
		if (s.held) bkStep(s, 1 / 60, { launch: true }, rnd);
	}
	ok(s.over && s.lives === 0, "idle loses");
	s = bkStart();
	rnd = seeded(6);
	// 球の 下へ（はね返す たびに 当てる 所を ずらして 角度を かえる）
	const aim = seeded(60);
	let off = 0;
	for (let i = 0; i < 300 * 60 && !s.over && s.wave === 1; i++) {
		const ev = bkStep(
			s,
			1 / 60,
			{ target: s.ball.x + off, launch: s.held },
			rnd,
		);
		if (ev.includes("paddle")) off = (Math.floor(aim() * 5) - 2) * 6;
	}
	ok(s.wave === 2, `cleared wave 1 (score ${s.score}, lives ${s.lives})`);
	ok(s.score >= BK.cols * BK.rows * BK.brick + BK.waveBonus, "score");
});

test("もぐらたたき: 30秒で おわる、ROM だけ たたくと 点、イッチを たたくと 減る", () => {
	const rnd = seeded(7);
	const s = mlStart();
	let icchi = 0;
	for (let i = 0; i < 31 * 30 && !s.over; i++) {
		const hits = s.holes
			.map((h, j) => (h.kind === "rom" ? j : -1))
			.filter((j) => j >= 0);
		icchi += s.holes.filter((h) => h.kind === "icchi").length > 0 ? 1 : 0;
		mlStep(s, 1 / 30, hits, rnd);
	}
	ok(s.over && s.t >= ML.time - 0.05, "time up");
	ok(s.hits > 20 && s.score === s.hits * ML.rom, `hits ${s.hits}`);
	ok(icchi > 0, "icchi shows up");
	const t = mlStart();
	t.holes[0] = { kind: "icchi", left: 1, bonk: 0, bonkKind: null };
	t.score = 20;
	ok(mlStep(t, 0, [0], rnd)[0] === "ouch" && t.score === 0, "icchi costs");
	ok(mlStep(t, 0, [8], rnd)[0] === "whiff", "empty hole");
});

test("格ゲー: 返せる はばで 押すと 5人 勝ちぬき、押さないと 負け、早押しは スキ", () => {
	let s = ftStart();
	let rnd = seeded(8);
	for (let i = 0; i < 300 * 60 && !s.over; i++) ftStep(s, 1 / 60, false, rnd);
	ok(s.over && !s.clear && s.hp === 0 && s.score === 0, "idle loses");
	s = ftStart();
	rnd = seeded(9);
	for (let i = 0; i < 600 * 60 && !s.over; i++)
		ftStep(s, 1 / 60, ftInWindow(s), rnd);
	ok(s.over && s.clear && s.ko === FT_FOES.length, `clear ko=${s.ko}`);
	ok(s.hp === 5 && s.score > FT_FOES.length * 500, `score ${s.score}`);
	s = ftStart();
	ok(ftStep(s, 0.01, true, rnd)[0] === "early" && s.hp === 4, "early");
	// フェイントは 返せる はばより 前に やめる
	for (const f of FT_FOES)
		ok(f.wind * 0.4 < f.wind - f.guard, `${f.name}: feint before the window`);
});

test("メダルスロット: 3つ そろうと 払いだし、なくなったら おわり、目押しで 7 が そろう", () => {
	ok(
		SL_REELS.every(
			(r) => r.length === 12 && r.filter((x) => x === "7").length === 1,
		),
		"reels",
	);
	for (const sym of SL_SYMS) ok(SL_PAY[sym] > 0, `pay ${sym}`);
	// 毎回 すぐ 止める（そろわない ことが 多い）→ いつか おわる
	let s = slStart();
	for (let i = 0; i < 20000 && !s.over; i++) slStep(s, 1 / 30, true);
	ok(s.over && (s.medals === 0 || s.medals >= SL.cap), `bust ${s.medals}`);
	ok(s.best >= SL.start, "best");
	// 7 が まんなかに 来た ときに 止める
	s = slStart();
	slStep(s, 0, true);
	ok(s.phase === "spin" && s.medals === SL.start - 1, "bet");
	for (let reel = 0; reel < 3; reel++) {
		for (let i = 0; i < 300; i++) {
			if (slAt(reel, s.pos[reel] ?? 0) === "7") break;
			slStep(s, 1 / 60, false);
		}
		slStep(s, 0, true);
	}
	ok(
		slLine(s).every((x) => x === "7") &&
			s.medals === SL.start - 1 + SL_PAY["7"] &&
			s.best === s.medals,
		`777 ${slLine(s)} ${s.medals}`,
	);
});

test("なんJラン: 跳ばないと ぶつかる、石の 手前で 跳ぶと 長く 走れる", () => {
	let s = rnStart();
	let rnd = seeded(10);
	for (let i = 0; i < 60 * 60 && !s.over; i++) rnStep(s, 1 / 60, false, rnd);
	ok(s.over, "idle crashes");
	const idle = rnScore(s);
	s = rnStart();
	rnd = seeded(11);
	for (let i = 0; i < 90 * 60 && !s.over; i++) {
		const next = s.rocks.find((r) => r.x + r.w > RN.x - RN.w / 2);
		const v = Math.min(210, 90 + s.t * 3.5);
		const press = !!next && next.x - (RN.x + RN.w / 2) < v * 0.12;
		rnStep(s, 1 / 60, press, rnd);
	}
	ok(!s.over && rnScore(s) > idle * 10, `ran ${rnScore(s)} vs ${idle}`);
});

test("音ゲー: 譜面は 毎回 同じ・ぜんぶ ちょうどで 押すと FULL COMBO、押さないと ぜんぶ MISS", () => {
	const chart = rhChart();
	ok(JSON.stringify(chart) === JSON.stringify(rhChart()), "same chart");
	ok(chart.length >= 50 && chart.length <= 120, `notes ${chart.length}`);
	for (const n of chart) ok(n.lane >= 0 && n.lane < RH.lanes, "lane");
	ok(
		rhJudgeOf(0.02) === "perfect" &&
			rhJudgeOf(-0.08) === "great" &&
			rhJudgeOf(0.14) === "good" &&
			rhJudgeOf(0.2) === null,
		"judge",
	);
	let s = rhStart();
	const dt = 1 / 60;
	while (!s.over) {
		const hits = s.notes
			.filter((n) => !n.judged && n.at >= s.t && n.at < s.t + dt)
			.map((n) => ({ lane: n.lane, at: n.at }));
		rhStep(s, dt, hits);
	}
	ok(
		s.counts.miss === 0 &&
			s.counts.perfect === chart.length &&
			s.maxCombo === chart.length &&
			s.score === chart.length * 100 + RH.fullCombo,
		`full combo ${JSON.stringify(s.counts)} ${s.score}`,
	);
	s = rhStart();
	while (!s.over) rhStep(s, dt, []);
	ok(s.counts.miss === chart.length && s.score === 0, "all miss");
	// 別の 道を たたいても 当たらない
	s = rhStart();
	const first = s.notes[0];
	if (!first) throw new Fail("no notes");
	rhStep(s, 0, [{ lane: (first.lane + 1) % RH.lanes, at: first.at }]);
	ok(first.judged === null, "wrong lane");
});

test("ガチャスロット: 1枚で 引き、3つ そろうと 表の 払いだし・左 2つで 1枚、なくなったら おわり、リーチは SR 以上", () => {
	ok(gcPayout(["UR", "UR", "UR"]) === GC_PAY.UR, "UR");
	ok(gcPayout(["N", "N", "R"]) === GC.pair, "pair");
	ok(gcPayout(["N", "R", "R"]) === 0, "right pair pays nothing");
	const rnd = seeded(12);
	const seen = new Set(Array.from({ length: 2000 }, () => gcRoll(rnd)));
	ok(
		GC_SYMS.every((x) => seen.has(x)),
		"every symbol shows up",
	);
	let s = gcStart();
	let reach = 0;
	let wins = 0;
	for (let i = 0; i < 200000 && !s.over; i++) {
		const ev = gcStep(s, 1 / 30, true, rnd);
		if (ev.includes("reach")) {
			reach++;
			ok(
				s.reels[0] === s.reels[1] &&
					["UR", "SSR", "SR"].includes(s.reels[0] ?? ""),
				"reach",
			);
		}
		if (ev.includes("win")) wins++;
		if (ev.includes("pull")) ok(s.chips >= 0, "never below 0");
	}
	ok(s.over && s.chips === 0 && s.best >= GC.start, `bust after ${s.pulls}`);
	ok(
		s.pulls > GC.start && wins > 0,
		`pulls ${s.pulls} wins ${wins} reach ${reach}`,
	);
	// リールは 左から 止まる
	s = gcStart();
	gcStep(s, 0, true, rnd);
	const stops: number[] = [];
	for (let t = 0; t < 3 && s.phase === "spin"; t += 0.05)
		if (gcStep(s, 0.05, false, rnd).includes("stop")) stops.push(s.stopped);
	ok(JSON.stringify(stops) === "[1,2,3]", `stops ${stops}`);
});

test("ハイ＆ロー: 当たれば 倍・同じ 数は そのまま・はずれは なくなる、降りると 手もとへ、10連勝で 自動で 降りる", () => {
	ok(
		hlJudge(5, 9, "high") === "win" && hlJudge(5, 2, "high") === "lose",
		"high",
	);
	ok(hlJudge(5, 2, "low") === "win" && hlJudge(5, 5, "low") === "push", "low");
	const rnd = seeded(13);
	let s = hlStart(rnd);
	// いつも 有利な ほう（7より 上なら ロー）を 言い、3連勝で 降りる
	let takes = 0;
	for (let i = 0; i < 20000 && !s.over; i++) {
		let c: "high" | "low" | "take" | null = null;
		if (s.phase === "guess")
			c = s.streak >= 3 ? "take" : s.card >= 7 ? "low" : "high";
		const ev = hlStep(s, 1 / 30, c, rnd);
		if (ev.includes("take")) takes++;
		ok(s.chips >= 0 && s.pot >= 0, "never negative");
	}
	ok(takes > 3, `takes ${takes}`);
	ok(hlScore(s) >= HL.start, "score");
	// 賭けが 倍に なる
	s = hlStart(() => 0.5);
	s.card = 2;
	hlStep(s, 0, "high", () => 0.99);
	ok(s.chips === HL.start - 1 && s.pot === 2 && s.streak === 1, "double");
	ok(hlScore(s) === HL.start + 1, "score counts the pot");
	hlStep(s, 1, null, rnd);
	hlStep(s, 0, "take", rnd);
	ok(s.chips === HL.start + 1 && s.pot === 0, "take");
	// 10連勝で 自動
	s = hlStart(rnd);
	s.card = 1;
	for (let i = 0; i < HL.maxStreak; i++) {
		s.card = 1;
		hlStep(s, 0, "high", () => 0.99);
		hlStep(s, 1, null, rnd);
	}
	ok(
		s.pot === 0 && s.chips === HL.start - 1 + 2 ** HL.maxStreak,
		`auto take ${s.chips}`,
	);
});

test("ルーレット: 37の ポケット・赤 18・黒 18・緑 1、止まった 数で 払いもどし、なくなったら おわり", () => {
	ok(RL_WHEEL.length === 37 && new Set(RL_WHEEL).size === 37, "wheel");
	ok(RL_RED.size === 18 && rlColorOf(0) === "green", "colors");
	ok(RL_WHEEL.filter((n) => rlColorOf(n) === "black").length === 18, "black");
	const rnd = seeded(14);
	let s = rlStart();
	let spins = 0;
	for (let i = 0; i < 200000 && !s.over; i++) {
		const before = s.chips;
		const ev = rlStep(s, 1 / 30, { color: "red", amount: 5, spin: true }, rnd);
		if (ev.includes("spin")) {
			spins++;
			ok(s.chips === before - s.amount, "bet");
		}
		if (ev.includes("win") || ev.includes("lose")) {
			const n = rlNumber(s);
			ok(n === RL_WHEEL[s.result], "the wheel stops on the result");
			ok(ev.includes("win") === (rlColorOf(n) === "red"), `pay ${n}`);
			if (ev.includes("win")) ok(s.lastWin === s.amount * RL_PAY.red, "x2");
		}
	}
	ok(s.over && s.chips === 0 && spins > 5, `spins ${spins}`);
	// 緑は 14倍
	s = rlStart();
	rlStep(s, 0, { color: "green", amount: 10, spin: true }, () => 0);
	for (let i = 0; i < 200 && s.phase === "spin"; i++)
		rlStep(s, 0.05, { spin: false }, rnd);
	ok(rlNumber(s) === 0 && s.chips === 20 + 140, `green ${s.chips}`);
});

test("スイカ割り: 声は ほんとうの 方（荒らしは 逆）、真上で ふると 当たり、となりは かすり、25秒で おわる", () => {
	const rnd = seeded(15);
	let s = swStart(rnd);
	ok(swDistance(s) >= 4, "the watermelon is away");
	ok(s.sx >= 0 && s.sx < SK_W && s.sy >= 0 && s.sy < SK_H, "on the beach");
	// 声の とおりに 歩く（荒らしは 無視）と たどりつく
	let lies = 0;
	for (let i = 0; i < 25 * 30 && !s.over; i++) {
		const h = s.hints[s.hints.length - 1];
		const truth = swTruth(s);
		let move: "up" | "down" | "left" | "right" | undefined;
		if (h && h.who === "troll") {
			lies++;
			ok(h.dir !== truth.dir, "a troll lies");
		}
		if (i % 10 === 0 && truth.dir) move = truth.dir;
		const swing = truth.dir === null;
		swStep(s, 1 / 30, { move, swing }, rnd);
	}
	ok(s.result === "hit" && s.score > SW.hit, `hit ${s.result} ${s.score}`);
	// となり → かすり、遠い → 空ぶり、何もしない → 時間ぎれ
	s = swStart(rnd);
	s.x = s.sx === 0 ? 1 : s.sx - 1;
	s.y = s.sy;
	swStep(s, 0, { swing: true }, rnd);
	ok(s.result === "near" && s.score === SW.near, "near");
	s = swStart(rnd);
	for (let i = 0; i < 30 * 30 && !s.over; i++)
		swStep(s, 1 / 30, { swing: false }, rnd);
	ok(s.over && s.result === "miss" && s.score === 0, "time up");
	ok(lies >= 0, "lies counted");
});

test("グラス滑らせ: 力で 止まる 所が きまり、ぴったりで 100点、はしを 越えると 割れて 0点、5杯で おわる", () => {
	ok(gsStopX(0) > GS.startX && gsStopX(1) > GS.endX, "range");
	ok(gsPoints(150, 150) === 100 && gsPoints(153, 150) === 100, "exact");
	ok(gsPoints(160, 150) < 100 && gsPoints(200, 150) === 0, "far");
	// ちょうどの 力で 押す
	const rnd = seeded(16);
	let s = gsStart(rnd);
	for (let i = 0; i < 60 * 60 && !s.over; i++) {
		const press =
			s.phase === "aim" && Math.abs(gsStopX(s.power) - s.target) < 5;
		gsStep(s, 1 / 120, press, rnd);
	}
	ok(s.over && s.round === GS.rounds && s.score >= 400, `good ${s.score}`);
	// いちばん 強く → 割れる
	s = gsStart(rnd);
	let broke = 0;
	for (let i = 0; i < 60 * 60 && !s.over; i++) {
		const press = s.phase === "aim" && s.power > 0.98;
		if (gsStep(s, 1 / 120, press, rnd).includes("break")) broke++;
	}
	ok(broke === GS.rounds && s.score === 0, `broke ${broke}`);
});

// ───────────────── 窓の 流れ・記録 ─────────────────

test("窓: はじめは 決まり → スコア → ハイスコア、2回目は 決まりなし・記録を 見せる、やめたら 記録しない", async () => {
	await withStore(async (store) => {
		const t = ARCADE_TEXT.shooter;
		setArcadeHooks({ shooter: async () => ({ score: 120 }) });
		played.length = 0;
		let r = recorder([0]);
		await arcadeScript(CTX, r.s, "shooter");
		same(
			r.log,
			[
				`choose: ${ARCADE.menu.join("/")}`,
				`narrate: ${t.rule}`,
				`narrate: ${fill(ARCADE.after, { score: 120, unit: t.unit })}`,
				`narrate: ${ARCADE.newBest}`,
			],
			"first",
		);
		ok(played.includes("arcBest"), "best jingle");
		ok(loadArcade().best.shooter === 120, "best saved");
		ok(
			store.get("kiriko-roguelike/arcade")?.includes('"shooter":120'),
			"stored",
		);
		// 2回目：低い スコア（ハイスコアの 窓なし）
		setArcadeHooks({ shooter: async () => ({ score: 50 }) });
		r = recorder([0]);
		await arcadeScript(CTX, r.s, "shooter");
		same(
			r.log,
			[
				`narrate: ${fill(ARCADE.record, { best: 120, unit: t.unit })}`,
				`choose: ${ARCADE.menu.join("/")}`,
				`narrate: ${fill(ARCADE.after, { score: 50, unit: t.unit })}`,
			],
			"second",
		);
		// やめた
		setArcadeHooks({ shooter: async () => null });
		r = recorder([0]);
		await arcadeScript(CTX, r.s, "shooter");
		ok(r.log.at(-1) === `narrate: ${ARCADE.quit}`, "quit");
		const m = loadArcade();
		ok(m.best.shooter === 120 && m.plays.shooter === 2, "quit is not counted");
		// 品書きで やめる
		r = recorder([1]);
		await arcadeScript(CTX, r.s, "slot");
		same(r.log, [`choose: ${ARCADE.menu.join("/")}`], "cancel");
		ok(!loadArcade().tutored.includes("slot"), "no rule yet");
	});
});

test("記録: こわれた 中身は 初期値、台ごとに 別、?stage= の ときは 書かない", async () => {
	await withStore(async (store) => {
		store.set(
			"kiriko-roguelike/arcade",
			JSON.stringify({
				v: 1,
				best: { shooter: -5, slot: 77, rhythm: "x", drive: 1e12 },
				plays: { slot: 3 },
				tutored: ["slot", "nope", 3],
			}),
		);
		const m = loadArcade();
		ok(m.best.shooter === 0 && m.best.slot === 77, "best");
		ok(m.best.rhythm === 0 && m.best.drive === 9_999_999, "clamped");
		ok(m.plays.slot === 3 && m.plays.mole === 0, "plays");
		ok(JSON.stringify(m.tutored) === '["slot"]', "tutored");
		forgetArcadeMemo();
		store.set("kiriko-roguelike/arcade", "{broken");
		ok(loadArcade().best.slot === 0, "broken");
		const n = loadArcade();
		n.best.mole = 300;
		saveArcade(n, true);
		ok(loadArcade().best.mole === 300, "memo keeps it");
		ok(store.get("kiriko-roguelike/arcade") === "{broken", "not written");
	});
});

export const runArcadeTests = async (): Promise<TestResult[]> => {
	const out: TestResult[] = [];
	for (const c of CASES) {
		try {
			await c.run();
			out.push({ id: "arcade", name: c.name, ok: true });
		} catch (e) {
			out.push({
				id: "arcade",
				name: c.name,
				ok: false,
				reason: e instanceof Fail ? e.message : String(e),
			});
		}
	}
	return out;
};
