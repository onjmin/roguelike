// ゲームセンターの 筐体の 遊び（data/arcade/*・ui/arcade/arcade*.ts・ゲームセンター「連コ」の 部屋の 物）の 試験（pnpm test）。
// 板（canvas）は 出さない：決まりは 種つきの 乱数と 決まった 手で 回し、窓の 流れは ui/arcade/arcade.ts の setArcadeHooks で 見る。

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOWN_STAGES } from "../core/town";
import {
	BALLS_PER_CHIP,
	CASHIER,
	CASINO_TABLE,
	CHIP_YEN,
	chipDiff,
} from "../data/arcade/casino";
import { bcStart } from "../data/arcade/home/baccarat";
import { bjStart } from "../data/arcade/home/blackjack";
import { pcStart } from "../data/arcade/home/pachinko";
import { pkStart } from "../data/arcade/home/poker";
import {
	BM,
	bmStart,
	bmStep,
	PF,
	pfStart,
	pfStep,
} from "../data/arcade/homeLogic";
import {
	AW,
	BK,
	bkLayout,
	bkRect,
	bkStart,
	bkStep,
	DR,
	drPickup,
	drScore,
	drStart,
	drStep,
	FT_FOES,
	ftInPerfect,
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
	rnSpeed,
	rnStart,
	rnStep,
	SH,
	SL,
	SL_PAY,
	SL_REELS,
	SL_SYMS,
	shMult,
	shStart,
	shStep,
	slAt,
	slLine,
	slSpeed,
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
	gcToCeiling,
	gsPoints,
	gsStart,
	gsStep,
	gsStopX,
	HL,
	hlCash,
	hlJudge,
	hlLeft,
	hlMult,
	hlScore,
	hlStart,
	hlStep,
	RL,
	RL_BETS,
	RL_PAY,
	RL_RED,
	RL_WHEEL,
	rlColorOf,
	rlLeft,
	rlNumber,
	rlPayout,
	rlStart,
	rlStep,
	rlTotal,
	rlWins,
	SK_H,
	SK_W,
	SW,
	swDistance,
	swStart,
	swStep,
	swTrollRate,
	swTruth,
} from "../data/arcade/parlor";
import {
	ARCADE,
	ARCADE_BOARD,
	ARCADE_PLAY_YEN,
	ARCADE_TEXT,
} from "../data/arcade/text";
import { ARCADE_GAMES, ARCADE_HOME, isArcadeGame } from "../data/arcade/types";
import { sfx } from "../data/audio/sfx";
import {
	type Facility,
	facilityById,
	facilityRoomPlaces,
} from "../data/village/facilities";
import type { VillageView } from "../data/village/map";
import {
	addChips,
	ballsKept,
	chipsOwned,
	forgetChipMemo,
} from "../engine/chips";
import type { Story } from "../engine/defs";
import { forgetWalletMemo, walletYen, yen } from "../engine/wallet";
import {
	arcadePlay,
	arcadeScript,
	forgetArcadeMemo,
	loadArcade,
	saveArcade,
	setArcadeHooks,
} from "../ui/arcade/arcade";
import { cashChipsAt } from "../ui/arcade/casinoChips";
import type { Ctx } from "../ui/ctx";
import { buildFacility } from "../ui/village/facilities";
import { HOME_GAME_TESTS } from "./arcadeHome";
import { HomeFail } from "./arcadeHome/kit";
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
	/落ちる|落ちた|落ちない|黄色|きいろ|山吹|114514|1919|810|うんこ|うんち|オセロ|ガイジ|アスペ|チー牛|原カス|淫夢/;
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
	forgetChipMemo();
	try {
		await run(store);
	} finally {
		setArcadeHooks(null);
		forgetArcadeMemo();
		forgetChipMemo();
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

/** おわった あとの「もう一回（100円）／やめる」。 */
const payAgain = (): string =>
	`choose: ${ARCADE.payAgain.map((x) => fill(x, { price: yen(ARCADE_PLAY_YEN) })).join("/")}`;
/** ゲームセンターの 筐体の 品書き（1プレイ 100円）。 */
const payMenu = (): string =>
	ARCADE.payMenu.map((x) => fill(x, { price: yen(ARCADE_PLAY_YEN) })).join("/");
/** 町の 売り上げを 置く（財布の 元。engine/wallet.ts）。 */
const setTownYen = (store: Map<string, string>, points: number): void => {
	store.set(
		"kiriko-roguelike/town",
		JSON.stringify({
			points,
			stage: 0,
			storage: [],
			pending: null,
			returned: [],
		}),
	);
	forgetWalletMemo();
};

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
	// キリコの 家の ゲームは 家具（data/village/myhome.ts の FURNITURE_GAME）。部屋の 物では ない
	for (const g of ARCADE_GAMES.filter((x) => ARCADE_HOME[x] !== "myhome")) {
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
			if (play === "arcade" && !(id === "casino" && kind === "cashier"))
				ok(isArcadeGame(kind) && ARCADE_HOME[kind] === id, `${id}.${kind}`);
	}
	// カジノの 換金所（チップの 購入・換金は ここだけ。2026-10-15）
	ok(fac("casino").room?.plays?.cashier === "arcade", "casino cashier");
	ok(
		fac("casino").room?.lines.rule?.[0]?.includes("換金所"),
		"rule points to the cashier",
	);
	// カジノの 台は どれも 遊べる（文だけの 台は ない）。チップは ほんまの お金（2026-10-14 から 財布で 買う）
	const casino = fac("casino").room;
	for (const k of ["slot", "cards", "cooler"])
		ok(!casino?.lines[k], `no old ${k} line`);
	ok(
		casino?.people
			?.find((p) => p.id === "casino_dealer")
			?.lines[0]?.includes("ほんまの　お金"),
		"dealer",
	);
	for (const t of [
		...(casino?.lines.rule ?? []),
		...(casino?.lines.cashier ?? []),
	])
		ok(
			!/遊びの|お貸し|販売は|終了|各台で|立たれる/.test(t),
			`old casino line ${t}`,
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

test("つなぎ: 部屋の 物を 調べると 文 → 品書き（ui/village/facilities.ts → ui/arcade/arcade.ts）", async () => {
	await withStore(async () => {
		const view: VillageView = {
			stage: TOWN_STAGES - 1,
			unlocked: ["shallow"],
			cleared: [],
		};
		for (const g of ARCADE_GAMES.filter((x) => ARCADE_HOME[x] !== "myhome")) {
			const events = buildFacility(fac(ARCADE_HOME[g]), view, CTX).events ?? [];
			const ev = events.find((e) => e.id === `${g}_0`);
			ok(ev?.run, `event ${g}`);
			if (!ev?.run) continue;
			const r = recorder([2]);
			await ev.run(r.s);
			same(
				r.log,
				[
					`narrate: ${ARCADE_TEXT[g].line}`,
					`choose: ${["arcade", "umi", "bar"].includes(ARCADE_HOME[g]) ? payMenu() : ARCADE.menu.join("/")}`,
				],
				g,
			);
		}
	});
});

test("つなぎ: カジノの 換金所は 台の うしろの 受付と 話しても、台を 調べても 同じ 窓", async () => {
	await withStore(async () => {
		const view: VillageView = {
			stage: TOWN_STAGES - 1,
			unlocked: ["shallow"],
			cleared: [],
		};
		const f = fac("casino");
		const who = f.room?.people?.find((p) => p.id === "casino_cashier");
		ok(who?.play === "cashier", "receptionist");
		// 受付の 前（上）は 換金所の 台の まんなか（物に しない：台ごしに 受付と 話す）、両はしは 換金所
		const row = f.room?.rows[(who?.at[1] ?? 0) - 1] ?? "";
		const x = who?.at[0] ?? 0;
		ok(row[x] === "=" && !f.room?.things["="], `counter ${row[x]}`);
		ok(
			f.room?.things[row[x - 1] ?? ""] === "cashier" &&
				f.room?.things[row[x + 1] ?? ""] === "cashier",
			"counter ends",
		);
		const events = buildFacility(f, view, CTX).events ?? [];
		const status = `narrate: ${fill(CASHIER.status, { chips: 0, have: yen(0) })}`;
		for (const id of ["casino_cashier", "cashier_0"]) {
			const ev = events.find((e) => e.id === id);
			ok(ev?.run, `event ${id}`);
			if (!ev?.run) continue;
			const r = recorder([2]);
			await ev.run(r.s);
			ok(r.log.includes(status), `${id}: ${r.log.join(" / ")}`);
			ok(r.log.at(-1) === `choose: ${CASHIER.menu.join("/")}`, `${id} menu`);
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
	for (const m of [
		...ARCADE.again,
		...ARCADE.payAgain.map((x) => fill(x, { price: yen(ARCADE_PLAY_YEN) })),
	])
		ok(width(m) <= 9, `again ${m}`);
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
	for (const t of ARCADE_BOARD.swGaya) {
		fits("swGaya", t, 22, 1);
		ok(width(ARCADE_BOARD.swNanashi) + width(t) <= 12.5, `swGaya "${t}"`);
	}
	for (const t of Object.values(ARCADE_BOARD.rlBets))
		ok(width(t) <= 3, `rlBets ${t}`);
	for (const t of ARCADE_TEXT.gacha.rule.split("\n")) ok(width(t) <= 22, t);
});

test("音: 板と 窓で 鳴らす 効果音は どれも data/audio/sfx.ts に ある", () => {
	const root = join(process.cwd(), "src/ui/arcade");
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

test("シューティング: 撃たないと 残機が なくなる・よく 撃つと しのいで クリア、自演を 倒すと その場で クリア", () => {
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
	ok(
		s.over && s.lives > 0 && (s.beat || s.t >= SH.time - 0.05),
		`clear (t=${s.t}, lives=${s.lives})`,
	);
	ok(s.bossSeen, "boss shows up");
	ok(kills > 30 && s.score > kills * 10, `kills ${kills} score ${s.score}`);
	// 下まで 来そうな 荒らしを 先に 撃ち、あとは 自演の 真下で 撃つと 時間 内に 倒せる
	s = shStart();
	rnd = seeded(12);
	s.t = SH.bossAt - 0.01;
	shStep(s, 0.02, { fire: false }, rnd);
	ok(s.boss && s.boss.hp === SH.bossHp, "boss");
	for (let i = 0; i < (SH.time - SH.bossAt) * 30 && !s.over; i++) {
		const low = [...s.foes]
			.filter((f) => f.y > 60)
			.sort((a, b) => b.y - a.y)[0];
		const target = low?.x ?? s.boss?.x ?? s.x;
		shStep(s, 1 / 30, { target, fire: true }, rnd);
	}
	ok(s.over && s.beat && s.lives > 0, `beat boss (lives ${s.lives})`);
	ok(s.score >= SH.bossBonus, `boss bonus ${s.score}`);
	// コピペは 2つに 割れる・続けて 倒すと 倍率
	s = shStart();
	s.foes.push({ x: 120, y: 60, kind: "kopipe", hp: 1, vy: 0, ph: 0, flash: 0 });
	s.shots.push({ x: 120, y: 62, vx: 0 });
	const ev = shStep(s, 0.001, { fire: false }, rnd);
	ok(ev.includes("split") && s.foes.length >= 2, `split ${s.foes.length}`);
	s.chain = SH.chainStep;
	ok(shMult(s) === 2, "mult");
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
					!drPickup(o.kind) &&
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
			if (!drPickup(o.kind)) rows.set(o.y, (rows.get(o.y) ?? 0) + 1);
		for (const n of rows.values()) ok(n <= 2, "a lane is always open");
	}
	ok(drScore(s) > idle * 3, `dodging ${drScore(s)} vs idle ${idle}`);
	// 保守は 続けて 拾うと 上がる・age の あいだは はね飛ばせる
	s = drStart();
	for (const kind of ["hoshu", "hoshu", "age", "car"] as const) {
		s.things.push({ lane: s.lane, y: DR.carY, kind });
		drStep(s, 0.001, 0, rnd);
	}
	ok(
		s.streak === 2 && s.bonus === DR.pickup * 3 + DR.smash && !s.over,
		`streak ${s.streak} bonus ${s.bonus}`,
	);
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
	// 面ごとに 並びが かわり、濃い 札が ある
	ok(
		bkLayout(2).some((hp) => hp === 2),
		"hard bricks",
	);
	ok(JSON.stringify(bkLayout(2)) !== JSON.stringify(bkLayout(3)), "layouts");
	for (let w = 1; w <= 8; w++)
		ok(
			bkLayout(w).some((hp) => hp > 0),
			"not empty",
		);
	// 濃い 札は 2回、貫く 球は 1回で
	s = bkStart();
	s.bricks = s.bricks.map(() => 0);
	s.bricks[0] = 2;
	s.bricks[1] = 1;
	const [x0, y0, w0, h0] = bkRect(0);
	s.held = false;
	s.ball = { x: x0 + w0 / 2, y: y0 + h0 + 3, vx: 0, vy: -100 };
	ok(
		bkStep(s, 0.05, { launch: false }, rnd).includes("dent") &&
			s.bricks[0] === 1,
		"dent",
	);
	s.pierce = BK.pierce;
	s.ball = { x: x0 + w0 / 2, y: y0 + h0 + 3, vx: 0, vy: -100 };
	bkStep(s, 0.05, { launch: false }, rnd);
	ok(s.bricks[0] === 0 && s.ball.vy < 0, "pierce goes through");
});

test("もぐらたたき: 30秒で おわる、イッチ 以外を たたくと 点（続けると 倍率）、イッチを たたくと 減る", () => {
	const rnd = seeded(7);
	const s = mlStart();
	const seen = new Set<string>();
	let fever = false;
	for (let i = 0; i < 31 * 30 && !s.over; i++) {
		const hits = s.holes
			.map((h, j) => (h.kind && h.kind !== "icchi" ? j : -1))
			.filter((j) => j >= 0);
		for (const h of s.holes) if (h.kind) seen.add(h.kind);
		if (mlStep(s, 1 / 30, hits, rnd).includes("fever")) fever = true;
	}
	ok(s.over && s.t >= ML.time - 0.05, "time up");
	ok(s.hits > 20 && s.score > s.hits * ML.rom, `hits ${s.hits} ${s.score}`);
	ok(seen.size === 4, `kinds ${[...seen]}`);
	ok(fever, "fever");
	// たたかないと 点は 入らない
	const idle = mlStart();
	for (let i = 0; i < 31 * 30 && !idle.over; i++) mlStep(idle, 1 / 30, [], rnd);
	ok(idle.score === 0, "idle");
	const t = mlStart();
	t.holes[0] = { kind: "icchi", hp: 1, left: 1, bonk: 0, bonkKind: null };
	t.holes[1] = { kind: "ara", hp: 2, left: 1, bonk: 0, bonkKind: null };
	t.score = 20;
	t.combo = 7;
	ok(mlStep(t, 0, [0], rnd)[0] === "ouch" && t.score === 0, "icchi costs");
	ok(t.combo === 0, "icchi breaks the combo");
	ok(mlStep(t, 0, [8], rnd)[0] === "whiff", "empty hole");
	ok(mlStep(t, 0, [1], rnd)[0] === "armor" && t.score === 0, "ara 1");
	ok(mlStep(t, 0, [1], rnd)[0] === "bonk" && t.score === ML.ara, "ara 2");
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
	// ぎりぎりで 返すと 完全論破（2つ 減る）、それでも 5人 勝ちぬける
	s = ftStart();
	rnd = seeded(13);
	let perfect = 0;
	let chained = false;
	for (let i = 0; i < 600 * 60 && !s.over; i++) {
		if (s.chained && s.phase === "wind") chained = true;
		const ev = ftStep(s, 1 / 60, ftInPerfect(s), rnd);
		perfect += ev.filter((e) => e === "perfect").length;
	}
	ok(s.clear && perfect > 5, `perfect ${perfect}`);
	ok(chained, "後半の 相手は すぐ もう 1発");
	const one = FT_FOES[0];
	s = ftStart();
	s.phase = "wind";
	s.t = (one?.wind ?? 0) - 0.01;
	ok(ftStep(s, 0, true, rnd)[0] === "perfect" && s.foeHp === 1, "perfect -2");
	// 押した 時刻で はかる：こまの はじめは はばの 前でも、押したのが こまの おわりなら 返せる
	const at = (ago: number) => {
		const t = ftStart();
		t.phase = "wind";
		t.dur = (one?.wind ?? 0) + 0.06;
		t.t = (one?.wind ?? 0) - (one?.guard ?? 0) - 0.01;
		return ftStep(t, 1 / 60, ago, rnd)[0];
	};
	ok(at(0) === "counter", `pressed at the end of the frame: ${at(0)}`);
	ok(
		at(1 / 60) === "early",
		`pressed at the start of the frame: ${at(1 / 60)}`,
	);
	ok(at(5) === "early", "ago is clamped to the frame");
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
	// 777 で BIG：次の 3回は 払いだし 2倍
	ok(s.big === SL.big, `big ${s.big}`);
	for (let i = 0; i < 60; i++) slStep(s, 1 / 30, false);
	slStep(s, 0, true);
	ok(s.bonus && s.big === SL.big - 1, "big spin");
	// 持つ ほど リールが 速い
	const rich = slStart();
	rich.medals = 500;
	ok(
		slSpeed(rich) > slSpeed(slStart()) && slSpeed(rich) <= SL.maxSpin,
		"speed",
	);
});

test("なんJラン: 跳ばないと ぶつかる、石の 手前で 跳ぶと 長く 走れる、煽は くぐれる", () => {
	let s = rnStart();
	let rnd = seeded(10);
	for (let i = 0; i < 60 * 60 && !s.over; i++) rnStep(s, 1 / 60, false, rnd);
	ok(s.over, "idle crashes");
	const idle = rnScore(s);
	s = rnStart();
	rnd = seeded(11);
	let birds = 0;
	for (let i = 0; i < 90 * 60 && !s.over; i++) {
		// 石 だけ 跳ぶ（煽は 地面で くぐる）
		const next = s.rocks.find(
			(r) => r.kind === "rock" && r.x + r.w > RN.x - RN.w / 2,
		);
		const v = rnSpeed(s.t);
		const press = !!next && next.x - (RN.x + RN.w / 2) < v * 0.12;
		if (s.rocks.some((r) => r.kind === "bird")) birds++;
		rnStep(s, 1 / 60, press, rnd);
	}
	ok(!s.over && rnScore(s) > idle * 10, `ran ${rnScore(s)} vs ${idle}`);
	ok(birds > 0 && s.mile > 0, `birds ${birds} mile ${s.mile}`);
	// 煽は 跳ぶと 当たる
	const b = rnStart();
	b.y = 20;
	b.vy = 1;
	b.rocks.push({
		x: RN.x - 4,
		w: RN.birdW,
		h: RN.birdH,
		kind: "bird",
		alt: RN.birdAlt,
	});
	ok(rnStep(b, 0.001, false, rnd).includes("crash"), "bird hits a jumper");
	// 草は 跳んで 拾う
	const c = rnStart();
	c.y = 25;
	c.vy = 1;
	c.coins.push({ x: RN.x, y: 32 });
	ok(
		rnStep(c, 0.001, false, rnd).includes("coin") && c.bonus === RN.coin,
		"coin",
	);
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

test("ガチャスロット: 1枚で 引き、3つ そろうと 表の 払いだし・左 2つで 1枚、なくなったら おわり、リーチは SR 以上、天井で SSR 確定・確変、予告", () => {
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
	for (let i = 0; i < 2_000_000 && !s.over; i++) {
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
	// 天井：SSR 以上が そろわないまま GC.ceiling 回 → 次は SSR 確定、そのあと 確変（N が 出ない）
	s = gcStart();
	s.since = GC.ceiling;
	ok(gcToCeiling(s) === 0, "ceiling is next");
	let ev = gcStep(s, 0, true, rnd);
	ok(ev.includes("ceiling") && s.reels.every((x) => x === "SSR"), "ceiling");
	ev = [];
	for (let i = 0; i < 200 && s.phase !== "idle"; i++)
		ev.push(...gcStep(s, 0.05, false, rnd));
	ok(
		ev.includes("fever") && s.fever === GC.fever && s.since === 0,
		`fever ${ev}`,
	);
	ok(s.chips === GC.start - 1 + GC_PAY.SSR, `ceiling pays ${s.chips}`);
	for (let k = 0; k < GC.fever; k++) {
		gcStep(s, 0, true, rnd);
		ok(s.feverPull && !s.reels.includes("N"), `fever pull ${s.reels}`);
		for (let i = 0; i < 200 && s.phase !== "idle"; i++)
			gcStep(s, 0.05, false, rnd);
	}
	// 予告は 大当たりで よく 出て、はずれでは まれ（ガセ）
	let omenBig = 0;
	let big = 0;
	let omenElse = 0;
	let other = 0;
	s = gcStart();
	for (let i = 0; i < 6000; i++) {
		s.chips = 100;
		s.phase = "idle";
		s.since = 0;
		s.fever = 0;
		gcStep(s, 0, true, rnd);
		if (gcPayout(s.reels) >= GC_PAY.SR) {
			big++;
			if (s.omen) omenBig++;
		} else {
			other++;
			if (s.omen) omenElse++;
		}
	}
	ok(
		big > 0 && omenBig / big > 0.3 && omenElse / other < 0.06,
		`omen ${omenBig}/${big} ${omenElse}/${other}`,
	);
});

test("ハイ＆ロー: 当たれば 倍率（当たりにくい ほど 高い）・同じ 数は そのまま・はずれは なくなる、降りると 手もとへ、10連勝で 自動で 降りる、得な 札は ない", () => {
	ok(
		hlJudge(5, 9, "high") === "win" && hlJudge(5, 2, "high") === "lose",
		"high",
	);
	ok(hlJudge(5, 2, "low") === "win" && hlJudge(5, 5, "low") === "push", "low");
	// 倍率：当たる 札が ない 方は 0、遠い ほど 高い、どの 札でも 平均は 賭けより 少し 少ない
	ok(hlMult(1, "low") === 0 && hlMult(13, "high") === 0, "no way");
	ok(hlMult(7, "high") > hlMult(3, "high") && hlMult(2, "low") > 10, "odds");
	let avg = 0;
	for (let c = 1; c <= 13; c++) {
		let best = 0;
		for (const d of ["high", "low"] as const) {
			const w = d === "high" ? 13 - c : c - 1;
			const e = (w / 13) * hlMult(c, d) + 1 / 13;
			ok(hlMult(c, d) === 0 || e < 1.05, `ev ${c} ${d} ${e}`);
			best = Math.max(best, hlMult(c, d) > 0 ? e : 0);
		}
		avg += best / 13;
	}
	ok(avg < 0.97, `avg ev ${avg}`);
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
	// 端の 札だけ 続ける 作戦でも 平均は 減る（チップが 湧かない）
	let gain = 0;
	for (let k = 0; k < 20000; k++) {
		s = hlStart(rnd);
		s.chips = 1000;
		hlStep(s, 0, null, rnd, 10);
		for (let i = 0; i < 100; i++) {
			if (s.phase === "reveal") {
				hlStep(s, 1, null, rnd);
				continue;
			}
			if (i > 0 && s.pot === 0) break;
			const d = s.card >= 7 ? "low" : "high";
			const w = d === "high" ? 13 - s.card : s.card - 1;
			if (i > 0 && (w / 13) * hlMult(s.card, d) + 1 / 13 < 1) {
				hlStep(s, 0, "take", rnd);
				break;
			}
			hlStep(s, 0, d, rnd);
		}
		gain += s.chips + hlCash(s.pot) - 1000;
	}
	ok(gain < 0, `edge strategy gains ${gain / 20000}`);
	// 当たる 札の ない 方は 言えない
	s = hlStart(rnd);
	s.card = 1;
	ok(hlStep(s, 0, "low", rnd).length === 0 && s.pot === 0, "can't go lower");
	// 賭ける 枚数を えらび、倍率が かかる
	s = hlStart(() => 0.5);
	s.card = 7;
	hlStep(s, 0, null, rnd, 10);
	ok(s.bet === 10, "bet 10");
	hlStep(s, 0, "high", () => 0.99);
	const pot = 10 * hlMult(7, "high");
	ok(
		s.chips === HL.start - 10 && s.pot === pot && s.streak === 1,
		`mult ${s.pot}`,
	);
	ok(hlScore(s) === HL.start - 10 + hlCash(pot), "score counts the pot");
	hlStep(s, 0, null, rnd, 1);
	ok(s.bet === 10, "can't change the bet while betting");
	hlStep(s, 1, null, rnd);
	hlStep(s, 0, "take", rnd);
	ok(s.chips === HL.start - 10 + hlCash(pot) && s.pot === 0, "take");
	// 10連勝で 自動
	s = hlStart(rnd);
	let want = 1;
	for (let i = 0; i < HL.maxStreak; i++) {
		s.card = 7;
		want *= hlMult(7, "high");
		hlStep(s, 0, "high", () => 0.99);
		hlStep(s, 1, null, rnd);
	}
	ok(
		s.pot === 0 && s.chips === HL.start - 1 + hlCash(want),
		`auto take ${s.chips}`,
	);
});

test("ルーレット: 37の ポケット・赤 18・黒 18・緑 1、止まった 数で 払いもどし、なくなったら おわり", () => {
	ok(RL_WHEEL.length === 37 && new Set(RL_WHEEL).size === 37, "wheel");
	ok(RL_RED.size === 18 && rlColorOf(0) === "green", "colors");
	ok(RL_WHEEL.filter((n) => rlColorOf(n) === "black").length === 18, "black");
	// どの 札も 数の 半分・3分の1 などを 正しく 当て、払いもどしの 平均は どれも 36/37
	for (let n = 1; n <= 36; n++) {
		const hit = (bs: readonly string[]) =>
			bs.filter((b) => rlWins(b as (typeof RL_BETS)[number], n)).length;
		ok(
			hit(["red", "black"]) === 1 &&
				hit(["odd", "even"]) === 1 &&
				hit(["low", "high"]) === 1 &&
				hit(["d1", "d2", "d3"]) === 1 &&
				!rlWins("zero", n),
			`bets on ${n}`,
		);
		ok(rlWins("red", n) === (rlColorOf(n) === "red"), `red ${n}`);
	}
	ok(
		RL_BETS.every((b) => rlWins(b, 0) === (b === "zero")),
		"only zero on 0",
	);
	for (const b of RL_BETS) {
		let p = 0;
		for (let n = 0; n <= 36; n++) if (rlWins(b, n)) p += RL_PAY[b];
		ok(p === 36, `ev ${b} ${p}/37`);
	}
	const rnd = seeded(14);
	let s = rlStart();
	let spins = 0;
	for (let i = 0; i < 200000 && !s.over; i++) {
		const before = s.chips;
		const ip = { place: "red", amount: 5, spin: true } as const;
		const ev = rlStep(s, 1 / 30, ip, rnd);
		if (ev.includes("spin")) {
			spins++;
			ok(s.chips === before - rlTotal(s.bets), "bet");
		}
		if (ev.includes("win") || ev.includes("lose")) {
			const n = rlNumber(s);
			ok(n === RL_WHEEL[s.result], "the wheel stops on the result");
			ok(ev.includes("win") === (rlColorOf(n) === "red"), `pay ${n}`);
			ok(s.lastWin === rlPayout(s.bets, n), "payout");
			ok(s.history[0] === n, "history");
		}
	}
	ok(s.over && s.chips === 0 && spins > 5, `spins ${spins}`);
	// 0 は 36倍、いくつも 置ける、戻す、何も 置かずに 回すと 前と 同じ
	s = rlStart();
	rlStep(s, 0, { amount: 10, place: "zero", spin: false }, rnd);
	rlStep(s, 0, { place: "d1", spin: false }, rnd);
	rlStep(s, 0, { amount: 1, place: "odd", spin: false }, rnd);
	ok(s.chips === RL.start - 21 && rlTotal(s.bets) === 21, `bets ${s.chips}`);
	rlStep(s, 0, { clear: true, spin: false }, rnd);
	ok(s.chips === RL.start && rlTotal(s.bets) === 0, "clear");
	rlStep(s, 0, { amount: 10, place: "zero", spin: true }, () => 0);
	for (let i = 0; i < 200 && s.phase !== "bet"; i++)
		rlStep(s, 0.05, { spin: false }, rnd);
	ok(rlNumber(s) === 0 && s.chips === 20 + 360, `zero ${s.chips}`);
	ok(rlTotal(s.bets) === 0 && s.lastBets.zero === 10, "bets clear");
	rlStep(s, 0, { spin: true }, () => 0);
	ok(s.phase === "spin" && s.bets.zero === 10 && s.chips === 370, "again");
	// 1回に 置ける 合計は RL.maxBet まで
	s = rlStart();
	s.chips = 500;
	for (let i = 0; i < 30; i++)
		rlStep(s, 0, { amount: 10, place: "red", spin: false }, rnd);
	ok(rlTotal(s.bets) === RL.maxBet, `max ${rlTotal(s.bets)}`);
});

test("スイカ割り: 声は ほんとうの 方（荒らしは 逆、進むほど 多い）、真上で ふると 割れて 次の スイカ、空ぶりは ふらつく、40秒で おわる", () => {
	const rnd = seeded(15);
	let s = swStart(rnd);
	ok(swDistance(s) >= 4, "the watermelon is away");
	ok(s.sx >= 0 && s.sx < SK_W && s.sy >= 0 && s.sy < SK_H, "on the beach");
	ok(swTrollRate(0) < swTrollRate(3) && swTrollRate(99) < 0.5, "trolls grow");
	// 声の とおりに 歩く（荒らしは 無視）と いくつも 割れる
	let lies = 0;
	let gaya = 0;
	for (let i = 0; i < SW.time * 30 + 5 && !s.over; i++) {
		const h = s.hints[s.hints.length - 1];
		const truth = swTruth(s);
		let move: "up" | "down" | "left" | "right" | undefined;
		if (h && h.who === "troll") {
			lies++;
			ok(h.dir !== truth.dir, "a troll lies");
		}
		if (h && h.who === "gaya") {
			gaya++;
			ok(h.dir === null, "chatter has no direction");
		}
		if (i % 8 === 0 && truth.dir) move = truth.dir;
		const swing = truth.dir === null;
		const ev = swStep(s, 1 / 30, { move, swing }, rnd);
		if (ev.includes("hit")) {
			ok(swDistance(s) >= 4, "the next one is away");
			ok(s.lastPts > SW.hit, `quick bonus ${s.lastPts}`);
		}
	}
	ok(s.over && s.melons >= 3, `melons ${s.melons} ${s.score}`);
	ok(s.score > s.melons * SW.hit, `score ${s.score}`);
	ok(lies > 0 && gaya > 0, `lies ${lies} gaya ${gaya}`);
	// となり → かすり（点なし・少し ふらつく）、遠い → 空ぶり（長く ふらつく）、ふらつく あいだは 歩けない
	s = swStart(rnd);
	s.x = s.sx === 0 ? 1 : s.sx - 1;
	s.y = s.sy;
	swStep(s, 0, { swing: true }, rnd);
	ok(s.result === "near" && s.score === 0 && s.stun > 0, "near");
	const x = s.x;
	swStep(s, 0.01, { move: "up", swing: false }, rnd);
	swStep(s, 0.01, { move: "down", swing: false }, rnd);
	ok(s.x === x && s.stun > 0, "stunned");
	s = swStart(rnd);
	swStep(s, 0, { swing: true }, rnd);
	ok(s.result === "miss" && s.stun >= SW.missStun - 0.01, "miss");
	// 何もしない → 時間ぎれ
	s = swStart(rnd);
	for (let i = 0; i < (SW.time + 5) * 30 && !s.over; i++)
		swStep(s, 1 / 30, { swing: false }, rnd);
	ok(s.over && s.melons === 0 && s.score === 0, "time up");
});

test("グラス滑らせ: 力で 止まる 所が きまり、ぴったりで 100点・続くと ボーナス、はしを 越えると 割れて 0点、酔っぱらいは ゆれる、6杯で おわる", () => {
	ok(gsStopX(0) > GS.startX && gsStopX(1) > GS.endX, "range");
	ok(gsPoints(150, 150) === 100 && gsPoints(153, 150) === 100, "exact");
	ok(gsPoints(160, 150) < 100 && gsPoints(200, 150) === 0, "far");
	// ちょうどの 力で 押す（酔っぱらいは 押した あとも ゆれるので 外れる ことも ある）
	const rnd = seeded(16);
	let s = gsStart(rnd);
	let drunk = 0;
	for (let i = 0; i < 60 * 60 && !s.over; i++) {
		const press =
			s.phase === "aim" && Math.abs(gsStopX(s.power) - s.target) < 5;
		const before = s.target;
		gsStep(s, 1 / 120, press, rnd);
		if (s.drunk && s.phase === "aim" && s.target !== before) drunk++;
		if (s.round < GS.drunkFrom) ok(!s.drunk, "no drunk early");
	}
	ok(s.over && s.round === GS.rounds && s.score >= 300, `good ${s.score}`);
	ok(drunk > 0, "a drunk guest sways");
	// ぴったりが 3つ 続くと 100 ＋ 150 ＋ 200
	s = gsStart(rnd);
	for (let k = 0; k < 3; k++) {
		s.drunk = false;
		s.base = gsStopX(0.5);
		s.target = s.base;
		s.power = 0.5;
		gsStep(s, 0, true, rnd);
		for (let i = 0; i < 2000 && s.phase === "slide"; i++)
			gsStep(s, 1 / 120, false, rnd);
		ok(s.last === 100 && s.combo === k + 1, `exact ${k} ${s.last}`);
		for (let i = 0; i < 2000 && s.phase === "result"; i++)
			gsStep(s, 1 / 30, false, rnd);
	}
	ok(s.score === 100 + 150 + 200, `combo ${s.score}`);
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
		setTownYen(store, 1000);
		const t = ARCADE_TEXT.shooter;
		setArcadeHooks({ shooter: async () => ({ score: 120 }) });
		played.length = 0;
		let r = recorder([0]);
		await arcadeScript(CTX, r.s, "shooter");
		same(
			r.log,
			[
				`choose: ${payMenu()}`,
				`narrate: ${t.rule}`,
				`narrate: ${fill(ARCADE.after, { score: 120, unit: t.unit })}`,
				`narrate: ${ARCADE.newBest}`,
				payAgain(),
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
		r = recorder([1, 0]);
		await arcadeScript(CTX, r.s, "shooter");
		same(
			r.log,
			[
				`choose: ${payMenu()}`,
				`narrate: ${fill(ARCADE.record, { best: 120, unit: t.unit })}`,
				`choose: ${payMenu()}`,
				`narrate: ${fill(ARCADE.after, { score: 50, unit: t.unit })}`,
				payAgain(),
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
		r = recorder([2]);
		await arcadeScript(CTX, r.s, "slot");
		same(r.log, [`choose: ${payMenu()}`], "cancel");
		ok(!loadArcade().tutored.includes("slot"), "no rule yet");
		// 1プレイ 100円：3回 遊んで 300円（品書きで やめた 分は 払わない）
		ok(walletYen() === 700, `wallet ${walletYen()}`);
		// お金が なければ 遊べない
		// （使った 300円は 残るので、売り上げ 350円 → 手もと 50円）
		setTownYen(store, 350);
		setArcadeHooks({ shooter: async () => ({ score: 999 }) });
		r = recorder([0]);
		await arcadeScript(CTX, r.s, "shooter");
		same(
			r.log,
			[
				`choose: ${payMenu()}`,
				`narrate: ${fill(ARCADE.short, { price: yen(ARCADE_PLAY_YEN), have: yen(50) })}`,
			],
			"short",
		);
		ok(loadArcade().best.shooter === 120, "not played");
	});
});

test("窓: おわったら「もう一回」で すぐ また 遊ぶ（毎回 払う・払えなければ 聞かない・カジノは 同じ 枚数）", async () => {
	await withStore(async (store) => {
		// 250円：1回目 → もう一回（100円）→ 2回目 → 手もと 50円なので もう 聞かない
		setTownYen(store, 250);
		let n = 0;
		setArcadeHooks({ shooter: async () => ({ score: ++n * 10 }) });
		let r = recorder([0, 0]);
		await arcadeScript(CTX, r.s, "shooter");
		ok(n === 2, `played ${n}`);
		ok(walletYen() === 50, `wallet ${walletYen()}`);
		ok(r.log.filter((l) => l === payAgain()).length === 1, "asked once");
		ok(
			r.log.at(-1)?.startsWith("narrate: ") === true,
			`no ask when short ${r.log.at(-1)}`,
		);
		ok(loadArcade().plays.shooter === 2, "both counted");
		// 途中で やめたら 聞かない
		setTownYen(store, 1000);
		setArcadeHooks({ shooter: async () => null });
		r = recorder([0]);
		await arcadeScript(CTX, r.s, "shooter");
		ok(r.log.at(-1) === `narrate: ${ARCADE.quit}`, "quit: no ask");
		// 家の 台は ただ
		const home = ARCADE_GAMES.find((g) => ARCADE_HOME[g] === "myhome");
		ok(home, "a home game");
		if (home) {
			n = 0;
			setArcadeHooks({ [home]: async () => ({ score: ++n }) });
			r = recorder([0, 0, 0, 1]);
			await arcadeScript(CTX, r.s, home);
			ok(n === 3, `home played ${n}`);
			ok(r.log.at(-1) === `choose: ${ARCADE.again.join("/")}`, "free ask");
		}
		// カジノ：同じ 枚数を チップ入れから また 出す（25枚 持って 10枚 → 0枚 → もう一回 10枚 → 0枚。
		// のこり 5枚では 10枚 出せないので もう 聞かない）。財布は へらない
		setTownYen(store, 10_000);
		addChips(25);
		const stakes: number[] = [];
		setArcadeHooks({
			gacha: async (stake) => {
				stakes.push(stake ?? -1);
				return { score: 1, cash: 0 };
			},
		});
		const before = walletYen();
		r = recorder([0, 0, 0]);
		await arcadeScript(CTX, r.s, "gacha");
		same(stakes.map(String), ["10", "10"], "same stake");
		ok(walletYen() === before, `casino wallet ${walletYen()}`);
		ok(chipsOwned() === 5, `chips ${chipsOwned()}`);
		ok(
			r.log.filter(
				(l) =>
					l ===
					`choose: ${fill(CASINO_TABLE.again, { n: 10 })}/${ARCADE.again[1]}`,
			).length === 1,
			"casino asked once",
		);
		ok(r.log.at(-1)?.startsWith("narrate: ") === true, "no ask when short");
	});
});

// ───────────────── カジノの チップ（2026-10-15 から 換金所で 一元的に。台では チップ入れから 出すだけ）─────────────────

test("カジノ: 換金所で チップを 買う・換金する（財布と チップ入れ。払える ものだけ、全部、読みなおしても 同じ）", async () => {
	await withStore(async (store) => {
		setTownYen(store, 6000);
		const C = CASHIER;
		const status = (chips: number, have: number) =>
			`narrate: ${fill(C.status, { chips, have: yen(have) })}`;
		const buyOpts = (ns: readonly number[]) =>
			`choose: ${[...ns.map((n) => fill(C.option, { n, price: yen(n * CHIP_YEN) })), "やめる"].join("/")}`;
		// 買う → 50枚（5,000円）→ やめる
		let r = recorder([0, 1, 2]);
		await arcadePlay(CTX, r.s, "cashier");
		same(
			r.log,
			[
				status(0, 6000),
				`choose: ${C.menu.join("/")}`,
				`narrate: ${fill(C.buyAsk, { have: yen(6000) })}`,
				buyOpts([10, 50]),
				`narrate: ${fill(C.bought, { n: 50, price: yen(5000), chips: 50 })}`,
				status(50, 1000),
				`choose: ${C.menu.join("/")}`,
			],
			"buy",
		);
		ok(chipsOwned() === 50 && walletYen() === 1000, "bought 50");
		// 換金する → 10枚 → 全部（40枚）→ 換金する（もう ない）→ やめる
		r = recorder([1, 0, 1, 1, 1, 2]);
		await arcadePlay(CTX, r.s, "cashier");
		ok(
			r.log.includes(
				`choose: ${[fill(C.cashOption, { n: 10 }), fill(C.all, { n: 50 }), "やめる"].join("/")}`,
			),
			`cash opts ${r.log[3]}`,
		);
		ok(
			r.log.includes(
				`narrate: ${fill(C.cashed, { n: 40, price: yen(4000), chips: 0 })}`,
			),
			"cashed all",
		);
		ok(r.log.includes(`narrate: ${C.noChips}`), "no chips");
		ok(chipsOwned() === 0 && walletYen() === 6000, `back ${walletYen()}`);
		// 1,000円 ない → 買えない
		setTownYen(store, 500);
		r = recorder([0, 2]);
		await arcadePlay(CTX, r.s, "cashier");
		ok(
			r.log[2] ===
				`narrate: ${fill(C.short, { price: yen(1000), have: yen(500) })}`,
			`short ${r.log[2]}`,
		);
		// 保存：チップ入れは kiriko-roguelike/chips、読みなおしても 同じ
		setTownYen(store, 60_000);
		r = recorder([0, 3, 2]);
		await arcadePlay(CTX, r.s, "cashier");
		ok(chipsOwned() === 500, `500 ${chipsOwned()}`);
		ok(
			JSON.parse(store.get("kiriko-roguelike/chips") ?? "{}").chips === 500,
			"saved",
		);
		forgetChipMemo();
		ok(chipsOwned() === 500, "reloaded");
		store.set("kiriko-roguelike/chips", '{"v":1,"chips":-3,"balls":"x"}');
		forgetChipMemo();
		ok(chipsOwned() === 0 && ballsKept() === 0, "broken");
		ok(cashChipsAt(5, true) === 0, "can't cash what you don't have");
	});
});

test("カジノ: 台では チップ入れから 出して 遊び、のこりは チップ入れに もどる（円の やり取りは しない）", async () => {
	await withStore(async (store) => {
		setTownYen(store, 3000);
		addChips(45);
		const T = CASINO_TABLE;
		let got = -1;
		// 30枚 出して 42枚で おわる → 42枚 もどる（+12枚）。財布は そのまま
		setArcadeHooks({
			gacha: async (stake) => {
				got = stake ?? -1;
				return { score: 45, cash: 42 };
			},
		});
		let r = recorder([0, 1, 1]);
		await arcadeScript(CTX, r.s, "gacha");
		ok(got === 30, `stake ${got}`);
		same(
			r.log,
			[
				`choose: ${ARCADE.menu.join("/")}`,
				`narrate: ${fill(T.ask, { chips: 45 })}`,
				`choose: ${[fill(T.option, { n: 10 }), fill(T.option, { n: 30 }), fill(T.all, { n: 45 }), "やめる"].join("/")}`,
				`narrate: ${ARCADE_TEXT.gacha.rule}`,
				`narrate: ${fill(ARCADE.after, { score: 45, unit: "枚" })}`,
				`narrate: ${ARCADE.newBest}`,
				`narrate: ${fill(T.back, { n: 42, chips: 57, diff: chipDiff(12) })}`,
				`choose: ${fill(T.again, { n: 30 })}/${ARCADE.again[1]}`,
			],
			"gacha",
		);
		ok(chipsOwned() === 57 && walletYen() === 3000, `chips ${chipsOwned()}`);
		// 全部 出して 0枚 → のこらない（−57枚）
		setArcadeHooks({ highlow: async () => ({ score: 10, cash: 0 }) });
		r = recorder([0, 2]);
		await arcadeScript(CTX, r.s, "highlow");
		ok(
			r.log.at(-1) ===
				`narrate: ${fill(T.lost, { chips: 0, diff: chipDiff(-57) })}`,
			`lost ${r.log.at(-1)}`,
		);
		// チップが ない → 換金所へ（遊ばない）
		r = recorder([0]);
		await arcadeScript(CTX, r.s, "blackjack");
		same(
			r.log,
			[`choose: ${ARCADE.menu.join("/")}`, `narrate: ${T.none}`],
			"none",
		);
		ok(loadArcade().plays.blackjack === 0, "not played");
		// 出す 窓で やめると 遊ばない・へらない
		addChips(5);
		got = -1;
		r = recorder([0, 1]);
		await arcadeScript(CTX, r.s, "gacha");
		ok(got === -1 && chipsOwned() === 5, "cancel bring");
		// cash が なければ スコアを 手もとと みる
		setArcadeHooks({ roulette: async () => ({ score: 5 }) });
		r = recorder([0, 0]);
		await arcadeScript(CTX, r.s, "roulette");
		ok(r.log.at(-2)?.includes(chipDiff(0)), `even ${r.log.at(-2)}`);
		ok(chipsOwned() === 5, "even");
	});
});

test("カジノ: パチンコは チップ 1枚 ＝ 玉 25発で 座り、立つと 25発ごとに チップ、はんぱの 玉は あずかって 次に 足す", async () => {
	await withStore(async (store) => {
		setTownYen(store, 0);
		ok(BALLS_PER_CHIP * 4 === CHIP_YEN, "1発 4円");
		addChips(20);
		const T = CASINO_TABLE;
		const stakes: number[] = [];
		let left = 0;
		setArcadeHooks({
			pachinko: async (stake) => {
				stakes.push(stake ?? -1);
				return { score: left, cash: left };
			},
		});
		// 10枚（250発）→ 310発 → 12枚（+2枚）と はんぱ 10発
		left = 310;
		let r = recorder([0, 0, 1]);
		await arcadePlay(CTX, r.s, "pachinko");
		ok(stakes[0] === 250, `balls ${stakes[0]}`);
		ok(r.log[1] === `narrate: ${fill(T.ballAsk, { chips: 20 })}`, "ball ask");
		ok(
			r.log.includes(`narrate: ${fill(T.balls, { n: 10, b: 250 })}`),
			"to balls",
		);
		ok(
			r.log.includes(
				`narrate: ${fill(T.ballBack, { b: 310, n: 12, chips: 22, diff: chipDiff(2) })}`,
			),
			"back",
		);
		ok(r.log.includes(`narrate: ${fill(T.keep, { r: 10 })}`), "keep");
		ok(chipsOwned() === 22 && ballsKept() === 10, `kept ${ballsKept()}`);
		// 次は あずかった 10発も 足して 260発。立って 20発 → はんぱ 20発（まだ 25発に ならない）
		left = 20;
		r = recorder([0, 0, 1]);
		await arcadePlay(CTX, r.s, "pachinko");
		ok(stakes[1] === 260, `balls ${stakes[1]}`);
		ok(
			r.log.includes(`narrate: ${fill(T.ballsKept, { n: 10, b: 260, r: 10 })}`),
			"kept added",
		);
		ok(chipsOwned() === 12 && ballsKept() === 20, `${chipsOwned()}`);
		// 財布は 動かない
		ok(walletYen() === 0, "wallet");
	});
});

test("カジノ: どの 台も 出した 枚数で はじまり（既定は もとの 枚数）、やめた ときの 手もとは 賭けて いる 分も ふくむ", () => {
	const rnd = seeded(7);
	ok(gcStart().chips === GC.start && gcStart(100).chips === 100, "gacha");
	ok(gcStart(100).best === 100, "gacha best");
	ok(hlStart(rnd).chips === HL.start && hlStart(rnd, 10).chips === 10, "hl");
	ok(rlStart().chips === RL.start && rlStart(30).chips === 30, "rl");
	ok(pkStart().chips === 20 && pkStart(100).chips === 100, "poker");
	ok(bjStart().chips === 20 && bjStart(10).chips === 10, "blackjack");
	ok(bcStart().chips === 20 && bcStart(30).chips === 30, "baccarat");
	ok(pcStart().balls === 200 && pcStart(1250).balls === 1250, "pachinko");
	// ルーレット：回す 前に 置いた 分は もどる
	const rl = rlStart(30);
	rlStep(rl, 0, { place: "red", spin: false }, rnd);
	ok(rl.chips === 29 && rlLeft(rl) === 30, `rl left ${rlLeft(rl)}`);
	// ハイ＆ロー：賭けて いる 分は 降りたのと 同じ
	const hl = hlStart(rnd, 10);
	hl.chips = 9;
	hl.pot = 2.5;
	ok(hlLeft(hl) === 11, `hl left ${hlLeft(hl)}`);
	// 文（換金所と 台の 窓）
	const C = CASHIER;
	const T = CASINO_TABLE;
	const big = 9_999_999;
	for (const m of C.menu) ok(width(m) <= 9, `cashier menu ${m}`);
	for (const n of [...C.buyins, ...C.cashOuts, ...T.bring]) {
		for (const o of [
			fill(C.option, { n, price: yen(n * CHIP_YEN) }),
			fill(C.cashOption, { n }),
			fill(T.option, { n }),
		])
			ok(width(o) <= 9, `option ${o}`);
	}
	for (const o of [
		fill(C.all, { n: big }),
		fill(T.all, { n: big }),
		// もう一回は 10万枚（1,000万円）まで
		fill(T.again, { n: 99_999 }),
	])
		ok(width(o) <= 9, `button ${o}`);
	fits("status", fill(C.status, { chips: big, have: yen(big) }));
	fits("buyAsk", fill(C.buyAsk, { have: yen(big) }));
	fits("short", fill(C.short, { price: yen(1000), have: yen(big) }));
	fits("bought", fill(C.bought, { n: 500, price: yen(50_000), chips: big }));
	fits("cashAsk", fill(C.cashAsk, { chips: big }));
	fits(
		"cashed",
		fill(C.cashed, { n: 99_999, price: yen(9_999_900), chips: big }),
	);
	fits("noChips", C.noChips);
	const v = { n: 99_999, b: 999_999, r: 24, chips: big, diff: chipDiff(-big) };
	for (const k of [
		"none",
		"ask",
		"ballAsk",
		"balls",
		"ballsKept",
		"back",
		"lost",
		"ballBack",
		"keep",
	] as const)
		fits(k, fill(T[k], v));
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

// ───────────────── キリコの 家の ゲーム（data/arcade/homeLogic.ts） ─────────────────

/** 横スクロールの 平らな コース（地面 2段だけ。敵・足場・🥺 なし）。 */
const flatPf = () => {
	const s = pfStart(() => 0.9);
	s.tiles = s.tiles.map((col) => col.map((_, r) => (r < 2 ? 1 : 0)));
	s.enemies = [];
	s.lifts = [];
	s.coins = [];
	return s;
};
const puyuAt = (x: number) => ({
	kind: "puyu" as const,
	x,
	y: 0,
	vx: 0.001,
	vy: 0,
	ground: true,
	hopT: 9,
	dead: 0,
	awake: true,
});

test("家の ゲーム: 横スクロールは 穴で 残機が 減り、3回で おわり", () => {
	const a = flatPf();
	a.tiles = a.tiles.map((col, i) => (i < 8 ? col : col.map(() => 0)));
	let ev: string[] = [];
	for (let i = 0; i < 2000 && !a.over; i++)
		ev = ev.concat(pfStep(a, 0.05, { dir: 1, jump: false }));
	ok(a.over && !a.clear && a.lives === 0, `lives ${a.lives}`);
	ok(ev.filter((e) => e === "fall").length === PF.lives, `ev ${ev.slice(-3)}`);
});

test("家の ゲーム: 横スクロールは 上から 踏むと たおせて、続けて 踏むと 点が 倍", () => {
	const b = flatPf();
	b.enemies = [puyuAt(b.x), puyuAt(b.x + 200)];
	b.y = 8;
	b.vy = -50;
	b.ground = false;
	const e1 = pfStep(b, 0.02, { dir: 0, jump: false });
	ok(e1.includes("stomp") && b.points === 50 && !b.over, `stomp ${e1}`);
	// 着地せずに もう 1体
	b.enemies[1].x = b.x;
	b.y = 8;
	b.vy = -50;
	pfStep(b, 0.02, { dir: 0, jump: false });
	ok(b.stomps === 2 && b.points === 150, `chain ${b.points}`);
	// 横から ぶつかると 残機が 減り、再開の あとは 無敵
	const h = flatPf();
	h.enemies = [{ ...puyuAt(h.x + 20), vx: -40 }];
	let ev: string[] = [];
	for (let i = 0; i < 40 && !ev.includes("hit"); i++)
		ev = ev.concat(pfStep(h, 0.05, { dir: 0, jump: false }));
	ok(ev.includes("hit") && h.lives === PF.lives - 1, `hit ${ev}`);
	for (let i = 0; i < 30; i++) pfStep(h, 0.05, { dir: 0, jump: false });
	ok(!h.over && h.deadT <= 0, "respawned");
});

test("家の ゲーム: 横スクロールは ？ブロックを 下から たたくと 🥺、旗は 高いほど 点", () => {
	const d = flatPf();
	const mx = Math.floor(d.x / PF.cell);
	d.tiles[mx][3 + 2] = 3;
	let ev: string[] = pfStep(d, 0.02, { dir: 0, jump: true });
	for (let i = 0; i < 60; i++)
		ev = ev.concat(pfStep(d, 0.02, { dir: 0, jump: false }));
	ok(ev.includes("bump") && d.coinsGot === 1, `bump ${ev}`);
	ok(d.tiles[mx][3 + 2] === 4 && d.ground, "used block");
	// 平らな コースを 走りきると 旗（地面の 高さ＝いちばん 下の 点）
	const c = flatPf();
	for (let i = 0; i < 4000 && !c.over; i++)
		pfStep(c, 0.05, { dir: 1, jump: false });
	ok(c.clear && c.points === 100, `goal ${c.x} pts ${c.points}`);
	// 階段の 上から 跳ぶと 高く つかまる
	const t = pfStart(() => 0.9);
	t.enemies = [];
	t.x = (PF.length - 8 - 4) * PF.cell;
	t.y = 60;
	for (let i = 0; i < 4000 && !t.over; i++) {
		const edge = t.x > (PF.length - 8 - 2) * PF.cell - 6;
		pfStep(t, 0.02, { dir: 1, jump: edge && t.ground });
	}
	ok(t.clear && t.flagY >= 66, `flag ${t.flagY}`);
});

test("家の ゲーム: 横スクロールの コースは どの 種でも 跳べる 穴と 旗が ある", () => {
	for (let seed = 1; seed <= 40; seed++) {
		const s = pfStart(seeded(seed));
		const hole = s.tiles.map((col) => col[1] === 0);
		for (let x = 0; x < hole.length; ) {
			if (!hole[x]) {
				x++;
				continue;
			}
			let w = 0;
			while (hole[x + w]) w++;
			// 4マスより 広い 穴には 動く 足場
			ok(
				w <= 4 ||
					s.lifts.some(
						(l) =>
							l.x0 <= (x + 1) * PF.cell && l.x1 + l.w >= (x + w - 1) * PF.cell,
					),
				`seed ${seed}: hole ${x}+${w}`,
			);
			x += w;
		}
		ok(!hole[3] && !hole[Math.floor(s.check / PF.cell)], `seed ${seed} start`);
		const kinds = new Set(s.tiles.flat());
		ok(kinds.has(3) && kinds.has(6), `seed ${seed} blocks`);
		ok(s.enemies.length >= 8, `seed ${seed} foes ${s.enemies.length}`);
	}
});

/** 動かない 荒らし。 */
const idleFoe = (x: number, y: number) => ({
	kind: "arashi" as const,
	x,
	y,
	t: 999,
	d: 0,
	alive: true,
});

test("家の ゲーム: ボンバーは 爆風で レスと 荒らしを 吹きとばし、巻きこまれると 残機が 減る", () => {
	const s = bmStart(() => 0.5);
	// 遠くで 動かない 荒らしを 1体（いなければ すぐ クリアに なる）
	s.enemies = [idleFoe(17, 9)];
	s.items = [];
	s.grid[1][3] = "r";
	s.grid[1][2] = ".";
	// 置いて すぐ 下へ 逃げる（1,1 → 1,4。爆風は 2マス）
	bmStep(s, 0.01, { dx: 0, dy: 0, bomb: true }, () => 0);
	for (const y of [2, 3, 4]) s.grid[y][1] = ".";
	for (let i = 0; i < 3; i++)
		bmStep(s, 0.2, { dx: 0, dy: 1, bomb: false }, () => 0);
	ok(s.py === 4, `ran to ${s.px},${s.py}`);
	for (let i = 0; i < 40; i++)
		bmStep(s, 0.05, { dx: 0, dy: 0, bomb: false }, () => 0);
	ok(
		(s.grid[1][3] as string) === "." && s.broken === 1 && !s.over,
		`broke ${s.broken}`,
	);
	// 爆弾の 上に 立ったまま → 巻きこまれて 残機が 減る。3回で おわり
	const t = bmStart(() => 0.5);
	t.enemies = [idleFoe(17, 9)];
	let dead = 0;
	for (let n = 0; n < 3; n++) {
		for (let i = 0; i < 80 && t.inv > 0; i++)
			bmStep(t, 0.05, { dx: 0, dy: 0, bomb: false }, () => 0);
		bmStep(t, 0.01, { dx: 0, dy: 0, bomb: true }, () => 0);
		for (let i = 0; i < 80 && !t.over && t.deadT <= 0; i++)
			if (
				bmStep(t, 0.05, { dx: 0, dy: 0, bomb: false }, () => 0).includes("dead")
			)
				dead++;
		for (let i = 0; i < 40 && t.deadT > 0; i++)
			bmStep(t, 0.05, { dx: 0, dy: 0, bomb: false }, () => 0);
	}
	ok(dead === BM.lives && t.over && !t.clear, `dead ${dead} over ${t.over}`);
	ok(BM.cols * BM.cell <= 240, "the maze fits the board");
});

test("家の ゲーム: ボンバーは レスの 下の 力を 拾うと 強くなり、まとめて たおすと 倍", () => {
	const s = bmStart(() => 0.5);
	s.enemies = [idleFoe(17, 9)];
	// 右の レスに 火を かくす → 爆ぜて 出たら 拾う
	s.grid[1][2] = ".";
	s.grid[1][3] = "r";
	s.items = [{ x: 3, y: 1, kind: "fire", shown: false }];
	for (const y of [2, 3, 4]) s.grid[y][1] = ".";
	bmStep(s, 0.01, { dx: 0, dy: 0, bomb: true }, () => 0);
	for (let i = 0; i < 3; i++)
		bmStep(s, 0.2, { dx: 0, dy: 1, bomb: false }, () => 0);
	for (let i = 0; i < 50; i++)
		bmStep(s, 0.05, { dx: 0, dy: 0, bomb: false }, () => 0);
	ok(s.items[0]?.shown, "revealed");
	s.px = 2;
	s.py = 1;
	const ev = bmStep(s, 0.2, { dx: 1, dy: 0, bomb: false }, () => 0);
	ok(ev.includes("power") && s.range === BM.range + 1, `range ${s.range}`);
	// 爆風の 中の 2体 → 100＋200
	const t = bmStart(() => 0.5);
	t.enemies = [idleFoe(5, 5), idleFoe(5, 6), idleFoe(17, 9)];
	const p0 = t.points;
	t.blasts = [
		{ x: 5, y: 5, t: 1 },
		{ x: 5, y: 6, t: 1 },
	];
	bmStep(t, 0.01, { dx: 0, dy: 0, bomb: false }, () => 0);
	ok(t.killed === 2 && t.points - p0 === 300, `pts ${t.points - p0}`);
	// のこりを たおすと 次の 面
	t.blasts = [{ x: 17, y: 9, t: 1 }];
	const e2 = bmStep(t, 0.01, { dx: 0, dy: 0, bomb: false }, () => 0);
	ok(e2.includes("clear") && !t.over && t.pause > 0, `clear ${e2}`);
	let e3: string[] = [];
	for (let i = 0; i < 60 && !e3.includes("stage"); i++)
		e3 = bmStep(t, 0.05, { dx: 0, dy: 0, bomb: false }, () => 0.5);
	ok(t.stage === 2 && t.enemies.some((e) => e.kind === "nenchaku"), "stage 2");
	// 5面めを クリアすると おわり
	t.stage = BM.stages;
	t.enemies = [idleFoe(17, 9)];
	t.blasts = [{ x: 17, y: 9, t: 1 }];
	bmStep(t, 0.01, { dx: 0, dy: 0, bomb: false }, () => 0);
	ok(t.over && t.clear, "all clear");
});

for (const c of HOME_GAME_TESTS) test(`家の ゲーム: ${c.name}`, c.run);

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
				reason:
					e instanceof Fail || e instanceof HomeFail ? e.message : String(e),
			});
		}
	}
	return out;
};
