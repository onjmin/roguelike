// 実況の 番組の 試験（pnpm test で いっしょに 動く）。
// A 節：映画館の 演出（曜日で かわる 会場の 文・スクリーンと 客席の 飾り。data/jikkyo/text.ts・ui/cinemaDecor.ts）。
// E 節：実況の エンジン（core/jikkyo.ts）を ボットで 1歩ずつ 回す。Y 節：ナイター実況（core/jikkyoYakyu.ts・data/jikkyo/yakyu.ts）。
// 形は townTests と 同じ（Fail・ok・{ id, name, ok, reason }）。id の 頭は 節の 字。

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	type JkEv,
	type JkInput,
	type JkLine,
	type JkOptions,
	type JkPick,
	type JkReq,
	type JkResult,
	type JkRules,
	type JkTimeline,
	jkResult,
	jkStart,
	jkStep,
	jkView,
	OVER_TEXT,
} from "../core/jikkyo";
import {
	JK_MS,
	JK_MUST,
	JK_SHOW,
	JK_TEAM_IDS,
	type JkGame,
	yakyuSegs,
} from "../core/jikkyoYakyu";
import { Rng } from "../core/rng";
import { TOWN_STAGES } from "../core/town";
import type { Today } from "../data/calendar";
import {
	type DayLines,
	isRoadshowNight,
	STAFF_LINES,
	staffLines,
	VENUE_LINES,
	venueLines,
} from "../data/jikkyo/text";
import {
	candidates,
	deltaE,
	fanColor,
	fanReqs,
	fitOf,
	freshUsed,
	JIKKYO_AFTER,
	JIKKYO_MENU,
	JIKKYO_MSG,
	JK_FAN_ANY,
	JK_FANS,
	JK_FEEDBACK,
	JK_GENERIC,
	JK_NANASHI,
	JK_OK,
	JK_REPLIES,
	JK_RES,
	JK_RESULT,
	JK_TAUNTS,
	JK_TELOP,
	JK_THREAD,
	NANASHI_COLOR,
	PRAISE_POOLS,
	subjectOf,
	telopOf,
	YAKYU_BANDS,
	YAKYU_POOLS,
	type YData,
	yakyuCard,
	yakyuGame,
	yakyuRules,
	yakyuTimeline,
} from "../data/jikkyo/yakyu";
import { JK_TEAMS } from "../data/jikkyo/yakyuRoster";
import {
	FACILITIES,
	type Facility,
	facilityById,
	facilityRoomRows,
} from "../data/village/facilities";
import type { VillageView } from "../data/village/map";
import type { Story } from "../engine/defs";
import { facilityDecor } from "../ui/cinemaDecor";
import type { Ctx } from "../ui/ctx";
import { buildFacility } from "../ui/facilities";
import {
	forgetJikkyoMemo,
	jikkyoAfterLine,
	loadJikkyo,
	markJikkyoHeard,
	recordJikkyo,
} from "../ui/jikkyo";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

const CASES: { id: string; name: string; run: () => void | Promise<void> }[] =
	[];
const test = (id: string, name: string, run: () => void | Promise<void>) =>
	CASES.push({ id, name, run });

/** 全角=1・半角=0.5 で 数えた 幅（villageTests と 同じ）。 */
const width = (line: string): number =>
	[...line].reduce((w, ch) => w + (/[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);

/** 村の 窓（全角 22字 × 2行）に 収まるか。 */
const fitsWindow = (where: string, text: string): void => {
	const lines = text.split("\n");
	ok(lines.length <= 2, `${where}: ${lines.length} lines`);
	for (const l of lines)
		ok(width(l) <= 22, `${where}: "${l}" is ${width(l)} wide`);
};

/** 試験の あいだだけ location.search を かえる（villageTests と 同じ）。もどす 手を 返す。 */
const swapLocation = (search: string): (() => void) => {
	const prev = Object.getOwnPropertyDescriptor(globalThis, "location");
	Object.defineProperty(globalThis, "location", {
		value: { search },
		configurable: true,
		writable: true,
	});
	return () => {
		if (prev) Object.defineProperty(globalThis, "location", prev);
		else delete (globalThis as { location?: unknown }).location;
	};
};

/** その 曜日の 日（月・日は 10/9 で 決め打ち）。 */
const day = (w: number): Today => ({ m: 10, d: 9, w });
const WEEK = [0, 1, 2, 3, 4, 5, 6];
const FRI = day(5);
const TUE = day(2);

/** 会場の 文の 表（物と 人）を 平らに。 */
const tableLines = (): { where: string; fid: string; text: string }[] =>
	(
		[
			["venue", VENUE_LINES],
			["staff", STAFF_LINES],
		] as const
	).flatMap(([tag, table]) =>
		Object.entries(table).flatMap(([fid, keys]) =>
			Object.entries(keys).flatMap(([key, rules]: [string, DayLines]) =>
				rules.flatMap((r, i) =>
					r.lines.map((text) => ({
						where: `${tag}.${fid}.${key}[${i}]`,
						fid,
						text,
					})),
				),
			),
		),
	);

/** 施設の 調べる 物の id と 人の id。 */
const kindsOf = (f: Facility): string[] => [
	...new Set(Object.values(f.room?.things ?? {})),
];
const peopleOf = (f: Facility): string[] =>
	(f.room?.people ?? []).map((p) => p.id);

const cinema = (): Facility => {
	const f = facilityById("cinema");
	if (!f) throw new Fail("no cinema");
	return f;
};

// ───────────────── A 映画館の 演出 ─────────────────

test(
	"A1",
	"会場の 文は どの 曜日も 村の 窓（22字 × 2行）に 収まり、物と 人は その 施設に ある",
	() => {
		for (const l of tableLines()) fitsWindow(l.where, l.text);
		for (const [table, of] of [
			[VENUE_LINES, kindsOf],
			[STAFF_LINES, peopleOf],
		] as const)
			for (const [fid, keys] of Object.entries(table)) {
				const f = facilityById(fid);
				ok(f?.room, `${fid}: no such facility with a room`);
				if (!f) continue;
				for (const key of Object.keys(keys))
					ok(of(f).includes(key), `${fid}: no ${key} to read or talk to`);
			}
		// 曜日ごとに 引いても 窓に 収まる。スクリーンと ポスターは 毎日 文が ある
		for (const w of WEEK) {
			for (const kind of ["screen", "poster", "seat"]) {
				const ls = venueLines("cinema", kind, day(w));
				if (kind !== "seat") ok(ls?.length, `wday ${w}: no ${kind} line`);
				for (const t of ls ?? []) fitsWindow(`wday ${w} ${kind}`, t);
			}
			for (const t of staffLines("cinema", "cinema_staff", day(w)) ?? [])
				fitsWindow(`wday ${w} cinema_staff`, t);
		}
	},
);

test(
	"A2",
	"金曜（実況上映）と ほかの 日で 文が かわり、ほかの 日の 客席と 係員は いつもの 文",
	() => {
		ok(
			WEEK.filter((w) => isRoadshowNight(day(w))).join() === "5",
			"the roadshow night is not only Friday",
		);
		const said = (ls: readonly string[] | null) => JSON.stringify(ls);
		for (const kind of ["screen", "poster", "seat"])
			ok(
				said(venueLines("cinema", kind, FRI)) !==
					said(venueLines("cinema", kind, TUE)),
				`${kind}: the same on Friday and Tuesday`,
			);
		ok(
			said(staffLines("cinema", "cinema_staff", FRI)) !==
				said(staffLines("cinema", "cinema_staff", TUE)),
			"cinema_staff: the same on Friday and Tuesday",
		);
		ok(venueLines("cinema", "seat", TUE) === null, "Tuesday seat is not null");
		ok(
			staffLines("cinema", "cinema_staff", TUE) === null,
			"Tuesday cinema_staff is not null",
		);
		// 金曜の ほかは どの 日も 同じ
		for (const w of WEEK.filter((w) => w !== 5)) {
			for (const kind of kindsOf(cinema()))
				ok(
					said(venueLines("cinema", kind, day(w))) ===
						said(venueLines("cinema", kind, TUE)),
					`wday ${w} ${kind}: not the same as Tuesday`,
				);
			ok(
				said(staffLines("cinema", "cinema_staff", day(w))) ===
					said(staffLines("cinema", "cinema_staff", TUE)),
				`wday ${w} cinema_staff: not the same as Tuesday`,
			);
		}
	},
);

test("A3", "映画館の ほかの 施設は 文の 上書きも 飾りも ない", () => {
	for (const f of FACILITIES) {
		const rows = facilityRoomRows(f);
		const isCinema = f.id === "cinema";
		for (const t of [FRI, TUE]) {
			ok(
				(typeof facilityDecor(f, rows, t) === "function") === isCinema,
				`${f.id}: decor ${typeof facilityDecor(f, rows, t)}`,
			);
			if (isCinema) continue;
			for (const k of kindsOf(f))
				ok(venueLines(f.id, k, t) === null, `${f.id}.${k}: overridden`);
			for (const p of peopleOf(f))
				ok(staffLines(f.id, p, t) === null, `${f.id}.${p}: overridden`);
		}
	}
});

/** 描いた 命令を 記録する だけの canvas（色・透明度・文字も 記録）。 */
const stubCanvas = () => {
	const calls: string[] = [];
	const styles: string[] = [];
	const alphas: number[] = [];
	const props: Record<string | symbol, unknown> = {};
	const g = new Proxy(props, {
		get: (target, k) =>
			k in target
				? target[k]
				: (...a: unknown[]) => {
						calls.push(k === "fillText" ? `fillText ${a[0]}` : String(k));
					},
		set: (target, k, v) => {
			if (k === "fillStyle") styles.push(String(v));
			if (k === "globalAlpha") alphas.push(Number(v));
			target[k] = v;
			return true;
		},
	}) as unknown as CanvasRenderingContext2D;
	return { g, calls, styles, alphas };
};

/** 飾りを いくつかの 時刻で 描く（金曜の ロゴの 間も 入る）。 */
const TIMES = [0, 700, 1499, 1500, 3000, 5999, 6100, 12345, 98765];

test(
	"A4",
	"映画館の 飾りは 塗るだけ（絵の 参照を 増やさない）で、save と restore が 釣りあい、金曜は ロゴの 間に 番組名",
	() => {
		const f = cinema();
		const view: VillageView = {
			stage: TOWN_STAGES - 1,
			unlocked: ["shallow"],
			cleared: [],
		};
		const def = buildFacility(f, view, {} as Ctx);
		ok(typeof def.decor === "function", "the cinema map has no decor");
		ok(!def.images?.length, `the cinema loads images: ${def.images}`);
		const rows = facilityRoomRows(f);
		for (const t of [FRI, TUE]) {
			const decor = facilityDecor(f, rows, t);
			if (!decor) throw new Fail(`wday ${t.w}: no decor`);
			const c = stubCanvas();
			for (const ms of TIMES) decor(c.g, 0, 0, ms);
			const n = (k: string) => c.calls.filter((x) => x === k).length;
			ok(n("save") === n("restore"), `wday ${t.w}: save/restore unbalanced`);
			ok(n("clip") === TIMES.length, `wday ${t.w}: the screen is not clipped`);
			ok(!n("drawImage"), `wday ${t.w}: draws an image`);
			for (const s of c.styles)
				ok(
					/^#[0-9a-f]{6}$/.test(s) || /^rgba\(\d+, \d+, \d+, [\d.]+\)$/.test(s),
					`wday ${t.w}: odd color ${s}`,
				);
			// ロゴは 6秒ごとに 1.5秒
			const logo = c.calls.filter((x) => x.startsWith("fillText"));
			const logoTimes = TIMES.filter((ms) => ms % 6000 < 1500).length;
			ok(
				t.w === 5
					? logo.length === logoTimes &&
							logo.every((x) => x === "fillText 金曜ロード保守")
					: logo.length === 0,
				`wday ${t.w}: logo text ${logo.join(",")}`,
			);
			// 金曜は 上映中で 場内を 暗く（スクリーンの ほか）
			ok(
				n("fill") > 0 === (t.w === 5),
				`wday ${t.w}: dims the room ${n("fill")}`,
			);
		}
		// 動きを へらす 設定では スマホの 光が 明滅しない
		const prev = Object.getOwnPropertyDescriptor(globalThis, "matchMedia");
		Object.defineProperty(globalThis, "matchMedia", {
			value: () => ({ matches: true }),
			configurable: true,
			writable: true,
		});
		try {
			const decor = facilityDecor(f, rows, FRI);
			const c = stubCanvas();
			for (const ms of TIMES) decor?.(c.g, 0, 0, ms);
			ok(
				new Set(c.alphas.filter((a) => a !== 1)).size === 1,
				`reduced motion still blinks: ${[...new Set(c.alphas)].join(",")}`,
			);
		} finally {
			if (prev) Object.defineProperty(globalThis, "matchMedia", prev);
			else delete (globalThis as { matchMedia?: unknown }).matchMedia;
		}
	},
);

/** 会場の 文に 出さない 名前（実在の 番組・局・映画・ゲーム・競馬・ドラマ）。ここ だけに 置く。 */
const NG_NAMES = [
	"金曜ロードショー",
	"ロードショー",
	"金ロー",
	"ロードSHOW",
	"紅白歌合戦",
	"歌合戦",
	"ゆく年くる年",
	"行く年来る年",
	"NHK",
	"日テレ",
	"日本テレビ",
	"ラピュタ",
	"ジブリ",
	"天空の",
	"飛行石",
	"竜の巣",
	"ドーラ",
	"ゴリアテ",
	"ロボット兵",
	"ムスカ",
	"シータ",
	"パズー",
	"君をのせて",
	"トトロ",
	"コナン",
	"8番出口",
	"任天堂",
	"Nintendo",
	"ニンダイ",
	"ダイレクト",
	"Direct",
	"JRA",
	"有馬",
	"ダービー",
	"豊臣",
];
/** 「保守」を 入れて よい 固有名詞（キリコが 書く 文には どれも 入れない）。 */
const HOSHU_NAMES = [
	"金曜ロード保守",
	"金保守",
	"保守劇場",
	"保守村",
	"保守町",
	"保守市",
];

test(
	"A5",
	"会場の 文に 実在の 名前が なく、「保守」は 固有名詞の 中だけ、バルスは 映画館の 文 だけ",
	() => {
		const all = [
			...tableLines(),
			...Object.values(cinema().room?.lines ?? {}).flatMap((ls) =>
				ls.map((text) => ({ where: "cinema room", fid: "cinema", text })),
			),
		];
		for (const l of all) {
			for (const ng of NG_NAMES)
				ok(!l.text.includes(ng), `${l.where}: "${ng}" in ${l.text}`);
			const bare = HOSHU_NAMES.reduce((t, n) => t.replaceAll(n, ""), l.text);
			ok(!bare.includes("保守"), `${l.where}: a bare 保守 in ${l.text}`);
			ok(
				l.fid === "cinema" || !l.text.includes("バルス"),
				`${l.where}: バルス outside the cinema`,
			);
			ok(!/[{}]/.test(l.text), `${l.where}: an unfilled {…} in ${l.text}`);
		}
	},
);

/** 地の文・セリフ・選ぶ だけを 記録する 台本の 相手。 */
const recorder = () => {
	const log: string[] = [];
	const s = new Proxy({} as Story, {
		get: (_t, k) => {
			if (k === "narrate")
				return async (t: string) => {
					log.push(`narrate: ${t}`);
				};
			if (k === "say")
				return async (_w: unknown, t: string) => {
					log.push(`say: ${t}`);
				};
			if (k === "choose")
				return async () => {
					log.push("choose");
					return 0;
				};
			if (k === "then") return undefined;
			return () => undefined;
		},
	});
	return { s, log };
};

test(
	"A6",
	"映画館で 調べる・話す と その 曜日の 文が 出て、遊びは まだ 出ない（金曜と 火曜）",
	async () => {
		const f = cinema();
		const room = f.room;
		if (!room) throw new Fail("the cinema has no room");
		const staff = room.people?.find((p) => p.id === "cinema_staff");
		if (!staff) throw new Fail("no cinema_staff");
		const view: VillageView = {
			stage: TOWN_STAGES - 1,
			unlocked: ["shallow"],
			cleared: [],
		};
		for (const t of [FRI, TUE]) {
			const restore = swapLocation(`?debug&wday=${t.w}`);
			try {
				const events = buildFacility(f, view, {} as Ctx).events ?? [];
				const run = async (id: string): Promise<string[]> => {
					const ev = events.find((e) => e.id === id);
					ok(ev?.run, `wday ${t.w}: no ${id}`);
					const r = recorder();
					await ev?.run?.(r.s);
					ok(!r.log.includes("choose"), `wday ${t.w}: ${id} offers a play`);
					return r.log;
				};
				for (const kind of ["screen", "poster", "seat"]) {
					const want = (venueLines("cinema", kind, t) ?? room.lines[kind]).map(
						(l) => `narrate: ${l}`,
					);
					const got = await run(`${kind}_0`);
					ok(
						got.join("\n") === want.join("\n"),
						`wday ${t.w} ${kind}:\n${got.join("\n")}`,
					);
				}
				const want = (staffLines("cinema", staff.id, t) ?? staff.lines).map(
					(l) => `say: ${l}`,
				);
				const got = await run(staff.id);
				ok(
					got.join("\n") === want.join("\n"),
					`wday ${t.w} staff:\n${got.join("\n")}`,
				);
				// 火曜の 客席と 係員は いつもの 文
				if (t.w === 2)
					ok(
						got.join() === staff.lines.map((l) => `say: ${l}`).join(),
						"Tuesday staff is not the usual line",
					);
			} finally {
				restore();
			}
		}
	},
);

// ───────────────── E・Y の 道具：ボットで 回す ─────────────────

type BotName = "kami" | "jouzu" | "shoshin" | "futsuu" | "random" | "miru";
type BotAns = { fit: "best" | "ok" | "miss"; ms: number } | null;

const pickFit = (r: () => number, pb: number, po: number) => {
	const x = r();
	return x < pb ? "best" : x < pb + po ? "ok" : "miss";
};
/** ボット（tune2.mjs と 同じ ふるまい）。 */
const BOTS: Record<BotName, (r: () => number) => BotAns> = {
	kami: () => ({ fit: "best", ms: 800 }),
	jouzu: (r) => ({ fit: pickFit(r, 0.75, 0.2), ms: 1200 + r() * 1000 }),
	shoshin: (r) => ({ fit: pickFit(r, 0.55, 0.3), ms: 1500 + r() * 1500 }),
	futsuu: (r) =>
		r() < 0.1
			? null
			: { fit: pickFit(r, 0.4 / 0.9, 0.3 / 0.9), ms: 1500 + r() * 2000 },
	random: (r) =>
		r() < 0.15
			? null
			: { fit: pickFit(r, 1 / 3, 1 / 3), ms: 1000 + r() * 3000 },
	miru: () => null,
};

const seeded = (s: string) => {
	const g = Rng.fromSeed(s);
	return () => g.float();
};

/** 記録した 出来事（実際の 時刻と、1000 の 行の ときの 点）。 */
type Rec = {
	ev: JkEv;
	wall: number;
	score?: readonly [number, number];
	open?: JkPick | null;
};

type Played = {
	result: JkResult | null;
	log: Rec[];
	wall: number;
};

/**
 * 時間割を ボット（または ms と fit を 決め打ちの 答え）で 最後まで 回す。窓が 開いたら ボットが 決めた ms に
 * 答える（ago は 押してから その 歩までの ずれ）。keep なら 出来事を ぜんぶ 残す。
 */
const playTl = (
	tl: JkTimeline,
	rules: JkRules,
	bot: (r: () => number) => BotAns,
	seed: string,
	opt: Partial<JkOptions> = {},
	keep = false,
	dt = 100,
	extra?: (k: number) => JkInput | undefined,
): Played => {
	const r = seeded(`bot:${seed}`);
	const st = jkStart(tl, rules, YAKYU_POOLS, {
		rand: seeded(`eng:${seed}`),
		tutored: true,
		...opt,
	});
	const log: Rec[] = [];
	let plan: { a: BotAns; done?: boolean } | null = null;
	let open: JkPick | null = null;
	for (let k = 0; k < 200000; k++) {
		const v = jkView(st);
		let input: JkInput | undefined = extra?.(k);
		if (!input && v.win && !v.win.reveal && v.seg?.win) {
			const el = v.win.open - v.win.left;
			if (!plan) plan = { a: bot(r) };
			const a = plan.a;
			if (a && !plan.done && el >= a.ms) {
				const opts = v.seg.win.opts;
				let i = opts.findIndex((o) => o.fit === a.fit);
				if (i < 0) i = opts.findIndex((o) => o.fit === "miss");
				input = { pick: i, ago: el - a.ms };
				plan.done = true;
			}
		} else if (!v.win) plan = null;
		const evs = jkStep(st, dt, input);
		for (const ev of evs) {
			if (ev.t === "open" && ev.win.type === "pick") open = ev.win;
			if (ev.t === "reveal") open = null;
			if (!keep && ev.t !== "end") continue;
			const rec: Rec = { ev, wall: st.wall, open };
			if (ev.t === "line" && ev.line.no === 1000) {
				const d = jkView(st).seg?.data as YData | undefined;
				rec.score = d?.score;
			}
			log.push(rec);
		}
		if (evs.some((e) => e.t === "end")) break;
	}
	return { result: jkResult(st), log, wall: st.wall };
};

/** 試合 i（カードも 種から）。 */
const gameOf = (i: number): JkGame => {
	const { home, away } = yakyuCard(Rng.fromSeed(`card:${i}`));
	return yakyuGame(`g:${i}`, home, away);
};

const playGame = (
	game: JkGame,
	bot: BotName | ((r: () => number) => BotAns),
	seed: string,
	opt: Partial<JkOptions> = {},
	keep = false,
	dt = 100,
): Played =>
	playTl(
		yakyuTimeline(game, seeded(`tl:${seed}`)),
		yakyuRules(game),
		typeof bot === "string" ? BOTS[bot] : bot,
		seed,
		{ part: game.part, watch: false, ...opt },
		keep,
		dt,
	);

const GAMES = 300;
let gamesCache: JkGame[] | null = null;
const games = (): JkGame[] => {
	gamesCache ??= Array.from({ length: GAMES }, (_, i) => gameOf(i));
	return gamesCache;
};

/** 300試合 × 6ボットの 結果（kami・jouzu は 出来事も 残す）。 */
let runsCache: Record<BotName, Played[]> | null = null;
const runs = (): Record<BotName, Played[]> => {
	if (runsCache) return runsCache;
	const out = {} as Record<BotName, Played[]>;
	for (const b of Object.keys(BOTS) as BotName[])
		out[b] = games().map((g, i) =>
			playGame(g, b, `${b}:${i}`, {}, b === "kami" || b === "jouzu"),
		);
	runsCache = out;
	return out;
};

const linesOf = (p: Played): { line: JkLine; wall: number; rec: Rec }[] =>
	p.log.flatMap((rec) =>
		rec.ev.t === "line" ? [{ line: rec.ev.line, wall: rec.wall, rec }] : [],
	);

/** 1行の 本文 だけの 決まり文句（1000 の 流れ・>>1）。 */
const isFlowLine = (l: JkLine) =>
	l.cls === "title" ||
	l.cls === "over" ||
	l.no === null ||
	(l.no ?? 0) >= 999 ||
	l.text === JK_THREAD.took999;

// ───────────────── E 実況の エンジン ─────────────────

test("E1", "同じ 種・同じ ボットなら 同じ res と 同じ 行", () => {
	for (const i of [0, 7, 42]) {
		const g = gameOf(i);
		for (const b of ["kami", "shoshin", "miru"] as const) {
			const a = playGame(g, b, `e1:${i}`, {}, true);
			const c = playGame(g, b, `e1:${i}`, {}, true);
			ok(a.result?.res === c.result?.res, `game ${i} ${b}: res differs`);
			const la = linesOf(a).map((x) => `${x.line.no} ${x.line.text}`);
			const lc = linesOf(c).map((x) => `${x.line.no} ${x.line.text}`);
			ok(la.join("\n") === lc.join("\n"), `game ${i} ${b}: lines differ`);
		}
	}
});

test(
	"E2",
	"番号：1000・1001 の ほかに 1000 以上は なく、キリコは 999 まで、1つの スレに 999 は 1つ、roll の あとは 次の Part の 1 から",
	() => {
		for (const p of [...runs().kami, ...runs().jouzu]) {
			let part = -1;
			let last = 0;
			const n999 = new Map<number, number>();
			let rolled = false;
			for (const rec of p.log) {
				if (rec.ev.t === "roll") {
					ok(rec.ev.part === part + 1, `roll to ${rec.ev.part} from ${part}`);
					rolled = true;
					continue;
				}
				if (rec.ev.t !== "line") continue;
				const l = rec.ev.line;
				if (part < 0) part = l.part;
				if (rolled) {
					ok(
						l.part === part + 1 && l.no === 1,
						`after roll: ${l.part} ${l.no}`,
					);
					part = l.part;
					last = 0;
					rolled = false;
				}
				ok(l.part === part, `line part ${l.part} in ${part}`);
				if (l.no === null) continue;
				if (l.no >= 1000)
					ok(
						(l.no === 1000 && l.cls !== "over") ||
							(l.no === 1001 && l.cls === "over" && l.text === OVER_TEXT),
						`no ${l.no}: ${l.text}`,
					);
				if (l.who === "me") ok(l.no <= 999, `kiriko at ${l.no}`);
				ok(l.no > last, `numbers go back: ${last} → ${l.no} (${l.text})`);
				last = l.no;
				if (l.no === 999) n999.set(l.part, (n999.get(l.part) ?? 0) + 1);
			}
			for (const [pt, n] of n999) ok(n === 1, `part ${pt}: ${n} lines at 999`);
		}
	},
);

test("E3", "1000 の 行は 勝って いる 側の 実況民（同点なら ホーム）", () => {
	let seen = 0;
	runs().kami.forEach((p, i) => {
		const g = games()[i];
		for (const x of linesOf(p)) {
			if (x.line.no !== 1000) continue;
			seen++;
			const sc = x.rec.score;
			ok(sc, `game ${i}: no score at 1000`);
			if (!sc) continue;
			const lead = sc[0] > sc[1] ? g.away : g.home;
			ok(
				x.line.who === `fan:${lead}`,
				`game ${i}: 1000 by ${x.line.who}, ${sc}`,
			);
			ok(
				x.line.text ===
					JK_THREAD.get1000.replace("{team}", JK_TEAMS[lead].char),
				`game ${i}: ${x.line.text}`,
			);
		}
	});
	ok(seen >= GAMES, `only ${seen} 1000 lines`);
});

test(
	"E4",
	"窓が 開いて いる あいだ、その 窓の 候補の 文は スレに 出ない",
	() => {
		for (const p of [...runs().kami, ...runs().jouzu])
			for (const x of linesOf(p)) {
				const w = x.rec.open;
				if (!w || x.line.who === "me") continue;
				ok(
					!w.opts.some((o) => o.text === x.line.text),
					`"${x.line.text}" while the window is open`,
				);
			}
	},
);

test(
	"E5",
	"直近 12行に 同じ 文が なく、実況民は 1試合 3回・名無しは 4回まで",
	() => {
		for (const p of [...runs().kami, ...runs().jouzu]) {
			const ls = linesOf(p).map((x) => x.line);
			const count = new Map<string, number>();
			ls.forEach((l, k) => {
				// キリコの 書きこみは 書き手が 選ばない（ボタンの 文）
				if (isFlowLine(l) || l.who === "me") return;
				const prev = ls
					.slice(Math.max(0, k - 12), k)
					.filter((x) => !isFlowLine(x));
				ok(
					!prev.some((x) => x.text === l.text),
					`"${l.text}" again within 12 lines`,
				);
				const type = l.who.split(":")[0];
				if (type !== "fan" && type !== "nanashi") return;
				const key = `${type}|${l.text}`;
				count.set(key, (count.get(key) ?? 0) + 1);
				ok(
					(count.get(key) ?? 0) <= (type === "fan" ? 3 : 4),
					`${key} said ${count.get(key)} times`,
				);
			});
		}
	},
);

test("E6", "早じまいで 損を しない：0.9秒の ◎ ≥ 3.5秒の ◎（同じ 試合）", () => {
	games()
		.slice(0, 100)
		.forEach((g, i) => {
			const fast = playGame(g, () => ({ fit: "best", ms: 900 }), `e6:${i}`);
			const slow = playGame(g, () => ({ fit: "best", ms: 3500 }), `e6:${i}`);
			ok(
				(fast.result?.res ?? 0) >= (slow.result?.res ?? 0),
				`game ${i}: fast ${fast.result?.res} < slow ${slow.result?.res}`,
			);
			ok(fast.wall < slow.wall, `game ${i}: fast is not shorter`);
		});
});

test(
	"E7",
	"見るだけは 601（560〜720）で 完走しない。答えない ボットも 完走 0%",
	() => {
		games().forEach((g, i) => {
			const w = playGame(g, "miru", `e7:${i}`, { watch: true });
			ok(w.result?.watch, `game ${i}: not a watch result`);
			ok(w.result?.res === 601, `game ${i}: watch ${w.result?.res}`);
			const [lo, hi] = YAKYU_BANDS.miru.res;
			ok((w.result?.res ?? 0) >= lo && (w.result?.res ?? 0) <= hi, "band");
		});
		ok(!runs().miru.some((p) => p.result?.kanso), "miru completed a thread");
		ok(
			runs().miru.every((p) => (p.result?.res ?? 0) === 601),
			`miru res ${runs()
				.miru.map((p) => p.result?.res)
				.find((r) => r !== 601)}`,
		);
	},
);

test(
	"E8",
	"B：1回で ノート、1.5秒 以内の 2回目で null。見るだけは 1回で null",
	() => {
		const g = gameOf(3);
		const quitAt = (ks: number[]) => (k: number) =>
			ks.includes(k) ? ({ quit: true } as const) : undefined;
		const twice = playTl(
			yakyuTimeline(g, seeded("e8")),
			yakyuRules(g),
			BOTS.miru,
			"e8",
			{},
			true,
			100,
			quitAt([50, 60]),
		);
		const notes = twice.log.filter((r) => r.ev.t === "note");
		ok(notes.length === 1, `${notes.length} notes`);
		ok(
			notes[0]?.ev.t === "note" && notes[0].ev.text === JK_FEEDBACK.quit,
			"quit note text",
		);
		ok(
			twice.result === null && twice.wall < 7000,
			`did not quit: ${twice.wall}`,
		);
		const slow = playTl(
			yakyuTimeline(g, seeded("e8")),
			yakyuRules(g),
			BOTS.miru,
			"e8",
			{},
			true,
			100,
			quitAt([50, 70, 80]),
		);
		ok(
			slow.log.filter((r) => r.ev.t === "note").length === 2,
			"late second B is not a note again",
		);
		ok(
			slow.result === null && slow.wall >= 8000 && slow.wall < 8300,
			`third B: ${slow.wall}`,
		);
		const watch = playTl(
			yakyuTimeline(g, seeded("e8")),
			yakyuRules(g),
			BOTS.miru,
			"e8",
			{ watch: true },
			true,
			100,
			quitAt([30]),
		);
		ok(
			watch.result === null && watch.wall < 3200,
			`watch did not close: ${watch.wall}`,
		);
		ok(!watch.log.some((r) => r.ev.t === "note"), "watch shows the note");
	},
);

test(
	"E9",
	"表示の 速さ：1秒の 行が 6を こえず（閉じた 直後は 12、動きを へらす 設定では 4）",
	() => {
		const g = gameOf(11);
		for (const reduced of [false, true]) {
			const p = playGame(g, "kami", `e9:${reduced}`, { reduced }, true, 16);
			const reveals = p.log
				.filter((r) => r.ev.t === "reveal")
				.map((r) => r.wall);
			const walls = linesOf(p)
				.filter((x) => x.line.who !== "me" && !isFlowLine(x.line))
				.map((x) => x.wall);
			for (let k = 0; k < walls.length; k++) {
				const inSec = walls.filter(
					(w) => w > walls[k] - 1000 && w <= walls[k],
				).length;
				const burst = reveals.some((r) => r <= walls[k] && walls[k] - r < 3000);
				const cap = reduced ? 4 : burst ? 12 : 6;
				ok(
					inSec <= cap,
					`reduced ${reduced}: ${inSec} lines in 1s at ${walls[k]} (cap ${cap})`,
				);
			}
		}
	},
);

/** 決まった 数だけ 流れる 小さな 時間割（見るだけで res が 1 + idle·G）。 */
const tinyTl = (segs: number, win?: number): JkTimeline => {
	const out = Array.from({ length: segs }, (_, i) => ({
		start: i * 5000,
		dur: 5000,
		w: 1,
		filler: [
			{ who: "nanashi", pool: "nanashi", p: 1 },
			{ who: "fan:tora", pool: "fan:tora:cheer", p: 1 },
			{ who: "fan:g", pool: "fan:g:cheer", p: 1 },
			{ who: "fan:koi", pool: "lurk:koi", p: 1 },
		],
		data: { score: [0, 0] } as unknown,
		...(win === i
			? {
					dur: 4800,
					win: {
						type: "pick",
						id: "w",
						opts: [
							{ text: "打った！", fit: "best" },
							{ text: "せやな", fit: "ok" },
							{ text: "CM　長すぎ", fit: "miss" },
						],
						open: 4000,
						weight: 1,
					} satisfies JkPick,
				}
			: {}),
	}));
	let t = 0;
	const fixed = out.map((s) => {
		const x = { ...s, start: t };
		t += s.dur;
		return x;
	});
	return { segs: fixed, overlays: [], total: t, P: win === undefined ? 0 : 1 };
};

test(
	"E10",
	"998〜999 で 終われば 1000 の 流れは 出ず、999 まで 出して 止まる",
	() => {
		const g = gameOf(5);
		for (const idle of [0.9975, 0.9985]) {
			const rules = { ...yakyuRules(g), idle };
			const p = playTl(
				tinyTl(30),
				rules,
				BOTS.miru,
				`e10:${idle}`,
				{ watch: true },
				true,
			);
			const res = p.result?.res ?? 0;
			ok(res >= 998 && res <= 999, `res ${res}`);
			const ls = linesOf(p).map((x) => x.line);
			ok(!ls.some((l) => (l.no ?? 0) >= 1000), "a 1000 line");
			ok(!p.log.some((r) => r.ev.t === "roll" || r.ev.t === "kanso"), "rolled");
			ok(
				ls.at(-1)?.no === res,
				`the last line is ${ls.at(-1)?.no} (res ${res})`,
			);
			ok(!p.result?.kanso, "kanso at 999");
		}
	},
);

test(
	"E11",
	"blocking の 窓の あいだに 1000 に 届いたら、1000 の 流れは 閉じた あと",
	() => {
		const g = gameOf(6);
		// 窓の 前で 990 ほど、答えの 波で 1000 を こえる
		const rules = { ...yakyuRules(g), idle: 0.995, post: 0.05 };
		const p = playTl(
			tinyTl(12, 10),
			rules,
			() => ({ fit: "best", ms: 900 }),
			"e11",
			{},
			true,
		);
		const k1000 = p.log.findIndex(
			(r) => r.ev.t === "line" && r.ev.line.no === 1000,
		);
		const kReveal = p.log.findIndex((r) => r.ev.t === "reveal");
		const kClose = p.log.findIndex((r) => r.ev.t === "close");
		ok(k1000 > 0 && kReveal > 0 && kClose > 0, `${k1000} ${kReveal} ${kClose}`);
		ok(k1000 > kClose, "the 1000 flow came before the window closed");
		// 300試合 でも 窓の あいだに 1000 の 行は 出ない
		for (const q of [...runs().kami, ...runs().jouzu]) {
			let inWin = false;
			for (const r of q.log) {
				if (r.ev.t === "open") inWin = true;
				if (r.ev.t === "close") inWin = false;
				if (r.ev.t === "line" && r.ev.line.no === 1000)
					ok(!inWin, "1000 inside a window");
			}
		}
	},
);

// ───────────────── Y ナイター実況 ─────────────────

test("Y1", "試合は 同じ 種なら 同じ、ちがう 種なら ちがう", () => {
	for (let i = 0; i < 20; i++) {
		const a = gameOf(i);
		const b = gameOf(i);
		ok(JSON.stringify(a) === JSON.stringify(b), `game ${i} differs`);
	}
	const c = yakyuGame("y1:a", "tora", "g");
	const d = yakyuGame("y1:b", "tora", "g");
	ok(
		JSON.stringify(c.plays) !== JSON.stringify(d.plays),
		"different seeds, same game",
	);
});

test(
	"Y2",
	"試合の 形：7回表から・アウトは 3まで・ホームが リードなら 9回裏なし・サヨナラで 終わる・生中継は 10回まで・点が 合う・死球なし",
	() => {
		for (let i = 0; i < 500; i++) {
			const g = gameOf(1000 + i);
			const first = g.plays.find((p) => p.kind !== "cm" && p.kind !== "lucky7");
			ok(first?.inn === 7 && first.top, `game ${i}: starts at ${first?.inn}`);
			ok(
				Math.abs(g.pre.score[0] - g.pre.score[1]) <= 4 ||
					g.seed.endsWith(":r5"),
				`game ${i}: pre ${g.pre.score}`,
			);
			const runs: [number, number] = [g.pre.score[0], g.pre.score[1]];
			for (const p of g.plays) {
				ok(p.outs >= 0 && p.outs <= 3, `game ${i}: outs ${p.outs}`);
				ok(!/HBP|死球/.test(p.kind), "hit by pitch");
				ok(p.bases === undefined || p.bases.length === 3, "bases");
				if (p.runs) runs[p.top ? 0 : 1] += p.runs;
				if (p.kind === "walkoff") {
					const k = g.plays.indexOf(p);
					ok(
						g.plays.slice(k + 1).every((x) => x.kind === "gameset"),
						`game ${i}: plays after a walkoff`,
					);
				}
			}
			ok(
				runs[0] === g.final[0] && runs[1] === g.final[1],
				`game ${i}: ${runs} vs ${g.final}`,
			);
			const top9 = g.plays
				.filter((p) => p.inn === 9 && p.top && p.kind !== "cm")
				.at(-1);
			if (top9 && top9.score[1] > top9.score[0])
				ok(
					!g.plays.some((p) => p.inn === 9 && !p.top && p.kind !== "gameset"),
					`game ${i}: 9th bottom while home leads`,
				);
			const ys = yakyuSegs(g);
			ok(
				ys.segs.every(
					(s) => !s.play || s.play.kind === "gameset" || s.play.inn <= 10,
				),
				`game ${i}: live past the 10th`,
			);
			ok(g.cut === ys.segs.some((s) => s.kind === "chukei"), `game ${i}: cut`);
			if (g.lastInn >= 11) ok(g.cut, `game ${i}: 11th inning on air`);
		}
	},
);

/** 名前（どれかの nick）。 */
const NICKS = JK_TEAM_IDS.flatMap((id) => {
	const t = JK_TEAMS[id];
	return [...t.lineup, ...t.bench, ...t.pitchers].flatMap((p) =>
		p.nick ? [p.nick] : [],
	);
});
const POS_WORDS = [
	"ピッチャー",
	"キャッチャー",
	"ファースト",
	"セカンド",
	"サード",
	"ショート",
	"レフト",
	"センター",
	"ライト",
];
const PRAISE_TELOP = new Set([
	"HR",
	"fine",
	"laser",
	"steal",
	"caught",
	"closer",
	"relief",
	"pinch",
	"defsub",
]);

test(
	"Y3",
	"名誉：名前が 入るのは ほめる 形だけ、エラーに 名前も 守備位置も なく、刺したは 捕手だけ",
	() => {
		const check = (
			reqs: readonly JkReq[],
			p: JkGame["plays"][number],
			where: string,
		) => {
			for (const r of reqs) {
				if (!r.fill?.nick) continue;
				ok(PRAISE_POOLS.has(r.pool ?? ""), `${where}: ${r.pool} with a name`);
				ok(p.kind !== "E", `${where}: a name on an error`);
				if (r.pool === "gen:nextUp")
					ok(r.fill.nick === p.next, `${where}: nextUp ${r.fill.nick}`);
				if (p.kind === "caught")
					ok(
						r.fill.nick === p.f || r.pool === "gen:respect",
						`${where}: caught ${r.fill.nick}`,
					);
			}
		};
		games().forEach((g, i) => {
			const r = seeded(`y3:${i}`);
			for (const p of g.plays) {
				check(fanReqs(p, g, r, 8), p, `game ${i} ${p.kind}`);
				const tel = telopOf(p, g);
				const named = NICKS.filter((n) => tel.includes(n));
				if (named.length)
					ok(
						PRAISE_TELOP.has(p.kind),
						`game ${i}: telop "${tel}" names on ${p.kind}`,
					);
				if (p.kind === "E")
					ok(!POS_WORDS.some((w) => tel.includes(w)), `E telop ${tel}`);
				if (p.kind === "caught" && p.f)
					ok(
						named.every((n) => n === p.f),
						`caught telop ${tel}`,
					);
			}
			const tl = yakyuTimeline(g, seeded(`y3t:${i}`));
			for (const s of tl.segs) {
				const d = s.data as YData;
				for (const reqs of [s.react, s.win?.held, s.win?.quick])
					if (reqs && d.play) check(reqs, d.play, `game ${i} seg`);
				for (const q of s.win?.quick ?? []) ok(!q.fill, "quick with a name");
				if (d.play?.kind === "E")
					for (const reqs of [s.react, s.win?.held])
						for (const q of reqs ?? []) ok(!q.fill?.nick, "E with a name");
			}
		});
	},
);

test(
	"Y4",
	"時間割：90〜240秒・P 4〜24・最後の 窓は gameset・練習は 6秒 以内・窓の 間は 18秒 以内・サヨナラの 窓に walkoff",
	() => {
		for (let i = 0; i < 500; i++) {
			const g = gameOf(2000 + i);
			const ys = yakyuSegs(g);
			ok(ys.total >= 90000 && ys.total <= 240000, `game ${i}: ${ys.total}`);
			ok(ys.P >= 4 && ys.P <= 24, `game ${i}: P ${ys.P}`);
			const wins = ys.segs.filter((s) => s.prompt);
			ok(
				wins[0]?.prompt?.practice && wins[0].start <= 6000,
				`game ${i}: practice`,
			);
			ok(
				wins.at(-1)?.prompt?.top === "gameset",
				`game ${i}: last window ${wins.at(-1)?.prompt?.top}`,
			);
			for (let k = 1; k < wins.length; k++) {
				const gap = wins[k].start - (wins[k - 1].start + wins[k - 1].dur);
				ok(gap <= 18000, `game ${i}: ${gap}ms between windows`);
			}
			// 半イニングの 上限（必ず 出す 種類と 間が あいた ときを のぞく）
			const perHalf = new Map<string, number>();
			let lastClose = 0;
			for (const s of ys.segs) {
				if (!s.prompt || s.prompt.practice) {
					if (s.prompt) lastClose = s.start + s.dur;
					continue;
				}
				const top = s.prompt.top;
				const gap = s.start - lastClose;
				lastClose = s.start + s.dur;
				if (JK_MUST.has(top) || gap >= JK_SHOW.GAP || !s.play) continue;
				ok(
					gap >= JK_SHOW.MIN_GAP - JK_MS.pa - JK_MS.inPlay,
					`game ${i}: ${top} after ${gap}`,
				);
				const key = `${s.play.inn}${s.play.top}`;
				perHalf.set(key, (perHalf.get(key) ?? 0) + 1);
				ok(
					(perHalf.get(key) ?? 0) <= JK_SHOW.HALF_CAP,
					`game ${i}: ${key} has ${perHalf.get(key)}`,
				);
			}
			const wo = g.plays.some((p) => p.kind === "walkoff");
			if (wo && !g.cut)
				ok(
					wins.some((s) => s.prompt?.kinds.includes("walkoff")),
					`game ${i}: walkoff without a window`,
				);
		}
	},
);

test(
	"Y5",
	"バランス：神 100%・上手 ≥95%・初心者 ≥75%・適当 ≤30%・見るだけ 0%、初心者の P の 帯の 差 ≤10pt",
	() => {
		const R = runs();
		const rate = (b: BotName) =>
			R[b].filter((p) => p.result?.kanso).length / R[b].length;
		const B = YAKYU_BANDS;
		const fmt = (b: BotName) => `${b} ${(rate(b) * 100).toFixed(0)}%`;
		ok(rate("kami") >= B.kami.kanso[0], fmt("kami"));
		ok(rate("jouzu") >= B.jouzu.kanso[0], fmt("jouzu"));
		ok(rate("shoshin") >= B.shoshin.kanso[0], fmt("shoshin"));
		ok(rate("random") <= B.random.kanso[1], fmt("random"));
		ok(rate("miru") === 0, fmt("miru"));
		const bands = new Map<string, { n: number; k: number }>();
		R.shoshin.forEach((p, i) => {
			const P = yakyuSegs(games()[i]).P;
			const band = P <= 8 ? "≤8" : P <= 11 ? "9-11" : P <= 14 ? "12-14" : "15+";
			const b = bands.get(band) ?? { n: 0, k: 0 };
			b.n++;
			if (p.result?.kanso) b.k++;
			bands.set(band, b);
		});
		const rates = [...bands.values()]
			.filter((b) => b.n >= 15)
			.map((b) => b.k / b.n);
		ok(
			Math.max(...rates) - Math.min(...rates) <= B.pSpread,
			`shoshin by P: ${[...bands].map(([k, b]) => `${k} ${((b.k / b.n) * 100).toFixed(0)}% (${b.n})`).join(", ")}`,
		);
	},
);

/** いちばん 長い 名前。 */
const LONGEST = [...NICKS].sort((a, b) => width(b) - width(a))[0];

test(
	"Y6",
	"候補：◎○× 1つずつ・3つとも ちがう・× は 当てはまる kind の ◎ でない・○ は どの ◎ でもない・名前つきは 主語が ある ときだけ",
	() => {
		for (const [k, r] of Object.entries(JK_RES)) {
			ok(r.best.length >= 2 && r.miss.length >= 2, `${k}: pool size`);
			for (const m of r.miss)
				ok(
					Object.values(JK_RES).some((x) => x.best.includes(m)),
					`${k}: × "${m}" names no event`,
				);
		}
		for (const o of JK_OK)
			ok(
				!Object.values(JK_RES).some((x) => x.best.includes(o)),
				`○ "${o}" is ◎ somewhere`,
			);
		const nickForms = new Set(
			Object.values(JK_RES).flatMap((r) => (r.nick ? [r.nick] : [])),
		);
		for (let i = 0; i < 500; i++) {
			const g = gameOf(3000 + i);
			const used = freshUsed();
			const r = seeded(`y6:${i}`);
			for (const s of yakyuSegs(g).segs) {
				if (!s.prompt) continue;
				const { kinds, top, play } = s.prompt;
				const subject = subjectOf(top, play);
				const opts = candidates(kinds, top, subject, r, used);
				ok(opts.length === 3, "3 options");
				ok(
					new Set(opts.map((o) => o.text)).size === 3,
					`same text: ${opts.map((o) => o.text)}`,
				);
				ok(
					["best", "ok", "miss"].every(
						(f) => opts.filter((o) => o.fit === f).length === 1,
					),
					"one of each fit",
				);
				for (const o of opts)
					ok(
						fitOf(o.text, kinds, subject) === o.fit,
						`${top}: "${o.text}" is ${fitOf(o.text, kinds, subject)} not ${o.fit}`,
					);
				const named = opts.find((o) => NICKS.some((n) => o.text.includes(n)));
				if (named) {
					ok(
						subject && named.text.includes(subject),
						`${top}: "${named.text}" without its subject`,
					);
					ok(
						[...nickForms].some(
							(f) => f.replace("{nick}", subject ?? "") === named.text,
						),
						`named not from a form: ${named.text}`,
					);
				}
			}
		}
	},
);

/** スレの 行（{nick} は いちばん 長い 名前、{n}=999、{team}・{m}）。 */
const FILL = {
	nick: LONGEST,
	n: "999",
	team: "虎",
	m: "13",
	home: "虎",
	away: "兎",
	star: LONGEST,
};
const fillAll = (s: string) =>
	s.replace(
		/\{(\w+)\}/g,
		(m, k: string) => (FILL as Record<string, string>)[k] ?? m,
	);

test(
	"Y7",
	"幅：候補 12・スレの 行 18・テロップ 20・村の 窓 22×2・メニュー 12・結果 22",
	() => {
		for (const [k, r] of Object.entries(JK_RES))
			for (const s of [...r.best, ...r.miss, ...(r.nick ? [r.nick] : [])])
				ok(
					width(fillAll(s)) <= 12,
					`${k}: "${fillAll(s)}" ${width(fillAll(s))}`,
				);
		const thread = [
			...Object.values(JK_FANS).flatMap((f) => Object.values(f).flat()),
			...Object.values(JK_FAN_ANY).flat(),
			...Object.values(JK_TAUNTS),
			...Object.values(JK_GENERIC).flat(),
			...JK_NANASHI,
			...Object.values(JK_REPLIES).flat(),
			...Object.values(JK_THREAD),
		];
		for (const s of thread)
			ok(
				width(fillAll(s)) <= 18,
				`thread: "${fillAll(s)}" ${width(fillAll(s))}`,
			);
		for (const v of Object.values(YAKYU_POOLS).flat())
			ok(width(fillAll(v)) <= 18, `pool: "${fillAll(v)}"`);
		const TEL = {
			...FILL,
			order: "9",
			dir: "センター",
			pos: "ファースト",
			outs: "ワンアウト",
			bases: "一・二塁",
			h: "10",
			a: "10",
		};
		for (const [k, s] of Object.entries(JK_TELOP))
			for (const x of [s].flat()) {
				const f = x.replace(
					/\{(\w+)\}/g,
					(m, q: string) => (TEL as Record<string, string>)[q] ?? m,
				);
				ok(width(f) <= 20 && !/[{}]/.test(f), `telop ${k}: "${f}" ${width(f)}`);
			}
		for (const g of games().slice(0, 100))
			for (const p of g.plays)
				ok(width(telopOf(p, g)) <= 20, `telop "${telopOf(p, g)}"`);
		for (const s of Object.values(JIKKYO_MSG))
			fitsWindow(
				"JIKKYO_MSG",
				fillAll(String(s)).replace(/\{h\}|\{a\}/g, "10"),
			);
		for (const [id, a] of Object.entries(JIKKYO_AFTER))
			for (const s of Object.values(a)) fitsWindow(`after ${id}`, fillAll(s));
		for (const m of JIKKYO_MENU) ok(width(m) <= 12, `menu ${m}`);
		const RES = {
			...FILL,
			h: "10",
			a: "10",
			res: "999",
			ikioi: "1,910,677",
			c: "10",
			x: "12",
			y: "12",
			z: "12",
			w: "12",
			best: "1,999",
		};
		for (const s of Object.values(JK_RESULT)) {
			const f = s.replace(
				/\{(\w+)\}/g,
				(m, k: string) => (RES as Record<string, string>)[k] ?? m,
			);
			ok(width(f) <= 22 && !/[{}]/.test(f), `result "${f}"`);
		}
	},
);

/** src の 中の ゲームの 名前（name: "…"）。 */
const gameNames = (): Set<string> => {
	const names = new Set<string>();
	const walk = (d: string) => {
		for (const f of readdirSync(d)) {
			const p = join(d, f);
			if (statSync(p).isDirectory()) walk(p);
			else if (p.endsWith(".ts") && !p.includes("jikkyo"))
				for (const m of readFileSync(p, "utf8").matchAll(/name: "([^"]+)"/g))
					names.add(m[1]);
		}
	};
	walk(join(process.cwd(), "src"));
	for (const x of [
		"キリコ",
		"ゼロ",
		"ロゼ",
		"フェリス",
		"シヨ",
		"やきう",
		"リノ",
		"アル",
		"マスター",
		"釣り",
		"役者",
		"レイ",
		"テト",
		"さとる",
		"封印",
	])
		names.add(x);
	return names;
};

test(
	"Y8",
	"ロースター：12球団・打順 9・ace・cl 1・名無しの 野手 2人 以上・role 5種・名前は 重ならず 1〜6字・球団の 字なし・ゲームの 名前と 重ならない",
	() => {
		const chars = JK_TEAM_IDS.map((id) => JK_TEAMS[id].char).join("");
		ok(chars === "虎兎竜鯉燕星鷹公鴎檻猫鷲", `team chars ${chars}`);
		for (const id of JK_TEAM_IDS) {
			const t = JK_TEAMS[id];
			ok(t.id === id, `${id}: id`);
			ok(t.lineup.length === 9, `${id}: lineup`);
			ok(
				t.pitchers.some((p) => p.role === "ace"),
				`${id}: ace`,
			);
			ok(t.pitchers.filter((p) => p.role === "cl").length === 1, `${id}: cl`);
			for (const p of t.pitchers)
				ok(
					["ace", "sp", "su", "rp", "cl"].includes(p.role),
					`${id}: role ${p.role}`,
				);
			ok(
				t.lineup.filter((p) => !p.nick && !p.pitcherSlot).length >= 2,
				`${id}: nanashi fielders`,
			);
		}
		ok(new Set(NICKS).size === NICKS.length, "duplicate nicks");
		// 名前が 決まった 文の 中に まぎれない（「レーザービーム！」が 選手を 名指しに 見えない ように）
		const fixed = [
			...Object.values(YAKYU_POOLS).flat(),
			...Object.values(JK_RES).flatMap((r) => [...r.best, ...r.miss]),
			...JK_OK,
		].filter((s) => !s.includes("{nick}"));
		for (const n of NICKS)
			ok(
				!fixed.some((s) => s.includes(n)),
				`${n} inside "${fixed.find((s) => s.includes(n))}"`,
			);
		const names = gameNames();
		for (const n of NICKS) {
			ok(width(n) >= 1 && width(n) <= 6, `${n}: width`);
			if (n !== "ミスター燕")
				ok(
					![...n].some((c) => "虎兎竜鯉燕星鷹公鴎檻猫鷲".includes(c)),
					`${n}: team char`,
				);
			ok(
				![...names].some(
					(x) => x === n || (x.length >= 2 && n.includes(x) && x !== "ンゴ"),
				),
				`${n}: collides with a game name`,
			);
		}
	},
);

/** ナイター実況の 文に 出さない 語。 */
const YAKYU_DENY = [
	"保守",
	"立てといた",
	"立てたる",
	"立てたで",
	"落ち",
	"ハゲ",
	"デブ",
	"チビ",
	"クビ",
	"年俸",
	"戦犯",
	"無能",
	"A級",
	"逮捕",
	"不倫",
	"ケガ",
	"故障",
	"引退",
	"カス",
	"ガイジ",
	"池沼",
	"外人",
	"劇場",
	"炎上",
	"ザル",
	"ノーコン",
	"老害",
	"ポンコツ",
	"嫁",
	"女子アナ",
	"結婚",
	"離婚",
	"薬",
	"賭博",
	"八百長",
	"乱闘",
	"退場",
	"死ね",
	"氏ね",
	"クソ",
	"糞",
	"顔",
	"豚",
	"アレや",
];

test(
	"Y9",
	"使わない 語が 文・名前・試合後の 1窓・テロップの どこにも ない",
	() => {
		const all = [
			JSON.stringify([
				JK_OK,
				JK_RES,
				JK_FANS,
				JK_FAN_ANY,
				JK_TAUNTS,
				JK_GENERIC,
				JK_NANASHI,
				JK_REPLIES,
				JK_THREAD,
				JK_TELOP,
				JIKKYO_MSG,
				JIKKYO_MENU,
				JK_RESULT,
				JK_FEEDBACK,
			]),
			...Object.values(JIKKYO_AFTER).flatMap((a) =>
				Object.values(a).map(fillAll),
			),
			...NICKS,
			...games()
				.slice(0, 100)
				.flatMap((g) => g.plays.map((p) => telopOf(p, g))),
		].join("\n");
		for (const w of YAKYU_DENY) ok(!all.includes(w), `deny word: ${w}`);
		for (const w of NG_NAMES) ok(!all.includes(w), `NG name: ${w}`);
		ok(
			!/[{]\w+[}]/.test(
				games()
					.slice(0, 50)
					.flatMap((g) => g.plays.map((p) => telopOf(p, g)))
					.join(),
			),
			"unfilled telop",
		);
	},
);

/** 試験の あいだだけ localStorage を かえる（Map で 持つ）。もどす 手を 返す。 */
const swapStorage = (): { store: Map<string, string>; restore: () => void } => {
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
		},
		configurable: true,
		writable: true,
	});
	return {
		store,
		restore: () => {
			if (prev) Object.defineProperty(globalThis, "localStorage", prev);
			else delete (globalThis as { localStorage?: unknown }).localStorage;
		},
	};
};

const JK_KEY_SAVE = "kiriko-roguelike/jikkyo";

/** 決め打ちの 結果。 */
const resultFor = (res: number, opt: Partial<JkResult> = {}): JkResult => ({
	res,
	part0: 12,
	part: 12 + Math.floor(res / 1000),
	kanso: res >= 1000,
	comboMax: 5,
	ikioiMax: 1234567,
	counts: { best: 5, ok: 2, miss: 1, none: 1 },
	cue: null,
	watch: false,
	...opt,
});

test(
	"Y10",
	"保存：壊れた JSON は 初期値・noSave で 書かない・best は 大きい ときだけ・heard は 1試合 1回・見るだけは best を かえない・古い 形も 読める",
	() => {
		const { store, restore } = swapStorage();
		const loc = swapLocation("");
		try {
			// 壊れた JSON
			store.set(JK_KEY_SAVE, "{broken");
			forgetJikkyoMemo();
			const e = loadJikkyo();
			ok(
				e.v === 1 &&
					e.plays === 0 &&
					e.best.res === 0 &&
					!e.tutored &&
					e.last === null,
				"broken JSON",
			);
			// noSave（下見）では 書かない
			store.clear();
			forgetJikkyoMemo();
			const g1 = gameOf(1);
			recordJikkyo(g1, resultFor(900), { noSave: true });
			ok(!store.has(JK_KEY_SAVE), "noSave wrote");
			ok(loadJikkyo().plays === 1, "noSave did not remember this time");
			// best は 大きい ときだけ。新しい 自己ベストは 前の ベストが ある とき
			store.clear();
			forgetJikkyoMemo();
			ok(!recordJikkyo(g1, resultFor(900)), "first record is NEW");
			ok(!recordJikkyo(g1, resultFor(800)), "lower is NEW");
			ok(loadJikkyo().best.res === 900, `best ${loadJikkyo().best.res}`);
			ok(recordJikkyo(g1, resultFor(1200)), "higher is not NEW");
			const m1 = JSON.parse(store.get(JK_KEY_SAVE) ?? "{}");
			ok(
				m1.best.res === 1200 && m1.plays === 3 && m1.kanso === 1 && m1.tutored,
				`saved ${JSON.stringify(m1)}`,
			);
			// 見るだけは best・plays・kanso に 数えない。last は 残す
			const g2 = gameOf(2);
			recordJikkyo(g2, resultFor(601, { watch: true, kanso: false }));
			const m2 = loadJikkyo();
			ok(
				m2.best.res === 1200 && m2.plays === 3 && m2.kanso === 1,
				"watch changed the records",
			);
			ok(m2.last?.id === g2.seed, "watch did not keep last");
			// heard：1試合に 1回、last.id が かわれば 空
			const npc = "jikkyo_tora";
			const line = jikkyoAfterLine(npc);
			ok(line, `${npc}: no after line`);
			if (line) fitsWindow(`${npc} after`, line);
			markJikkyoHeard(npc, false);
			ok(jikkyoAfterLine(npc) === null, "said twice");
			ok(jikkyoAfterLine("nanashi_0") !== null, "nanashi_0 has nothing to say");
			recordJikkyo(gameOf(3), resultFor(1100));
			ok(loadJikkyo().heard.length === 0, "heard not cleared for a new game");
			const kanso = jikkyoAfterLine("nanashi_0");
			ok(kanso?.includes("Part13"), `nanashi_0 kanso: ${kanso}`);
			ok(
				jikkyoAfterLine("nanashi_1") === null,
				"nanashi_1 talks about the game",
			);
			// 勝ち・負け・ほかの 試合
			for (let i = 0; i < 40; i++) {
				const g = gameOf(100 + i);
				recordJikkyo(g, resultFor(700));
				for (const id of [
					"tora",
					"tora2",
					"g",
					"ryu",
					"koi",
					"taka",
					"hoshi",
				]) {
					const t = jikkyoAfterLine(`jikkyo_${id}`);
					ok(t && !/[{}]/.test(t), `jikkyo_${id}: ${t}`);
					if (t) fitsWindow(`jikkyo_${id}`, t);
					const team = id === "tora2" ? "tora" : id;
					const played = team === g.home || team === g.away;
					const kind =
						!played || !g.winner ? "other" : g.winner === team ? "win" : "lose";
					const want = JIKKYO_AFTER[id][kind].split("{star}")[0];
					ok(t?.startsWith(want), `jikkyo_${id} ${kind}: ${t}`);
				}
			}
			// prog・gikai の ない 古い 形も 読め、ある ときは 残す
			const old = {
				v: 1,
				best: { res: 5, combo: 1, ikioi: 2 },
				plays: 1,
				kanso: 0,
				tutored: true,
				last: null,
				heard: [],
			};
			store.set(JK_KEY_SAVE, JSON.stringify(old));
			forgetJikkyoMemo();
			ok(
				loadJikkyo().best.res === 5 && loadJikkyo().prog === undefined,
				"old shape",
			);
			store.set(
				JK_KEY_SAVE,
				JSON.stringify({
					...old,
					prog: { sora: { best: 3 } },
					gikai: { seen: ["a"], at: 1 },
				}),
			);
			forgetJikkyoMemo();
			ok(
				loadJikkyo().prog?.sora?.best === 3 &&
					loadJikkyo().gikai?.seen[0] === "a",
				"prog/gikai lost",
			);
		} finally {
			forgetJikkyoMemo();
			loc();
			restore();
		}
	},
);

test(
	"Y11",
	"スレの 完走：Part n → n+1、合計は 続けて 数え、完走の 印は 1回",
	() => {
		runs().kami.forEach((p, i) => {
			const r = p.result;
			ok(r?.kanso, `game ${i}: kami did not complete`);
			if (!r) return;
			ok(
				r.part === r.part0 + Math.floor(r.res / 1000),
				`game ${i}: part ${r.part0}→${r.part} res ${r.res}`,
			);
			ok(r.part0 === games()[i].part, "starting part");
			ok(p.log.filter((x) => x.ev.t === "kanso").length === 1, "kanso once");
			const k = p.log.findIndex((x) => x.ev.t === "kanso");
			const prev = p.log
				.slice(0, k)
				.reverse()
				.find((x) => x.ev.t === "line");
			ok(
				prev?.ev.t === "line" && prev.ev.line.no === 1000,
				"kanso is not at the 1000 line",
			);
		});
	},
);

test(
	"Y12",
	"くりかえし（300試合）：表示した 8行に 同じ 文なし・実況民 3回・名無し 4回まで・窓の あいだ 候補なし",
	() => {
		for (const p of runs().jouzu) {
			const ls = linesOf(p)
				.map((x) => x.line)
				.filter((l) => !isFlowLine(l));
			for (let k = 0; k < ls.length; k++) {
				if (ls[k].who === "me") continue;
				const prev = ls.slice(Math.max(0, k - 7), k).map((l) => l.text);
				ok(!prev.includes(ls[k].text), `repeat in 8 lines: ${ls[k].text}`);
			}
		}
	},
);

test("Y13", "色：132の 組で ΔE76 ≥30、名無しの 札とも ≥20", () => {
	for (const h of JK_TEAM_IDS)
		for (const a of JK_TEAM_IDS) {
			if (h === a) continue;
			const c = fanColor(h, a);
			ok(
				deltaE(c.home, c.away) >= 30,
				`${h}-${a}: ΔE ${deltaE(c.home, c.away).toFixed(1)}`,
			);
			ok(
				deltaE(c.home, NANASHI_COLOR) >= 20 &&
					deltaE(c.away, NANASHI_COLOR) >= 20,
				`${h}-${a}: near 名無し`,
			);
		}
});

export const runJikkyoTests = async (): Promise<TestResult[]> => {
	const out: TestResult[] = [];
	for (const c of CASES) {
		try {
			await c.run();
			out.push({ id: `jikkyo ${c.id}`, name: c.name, ok: true });
		} catch (e) {
			out.push({
				id: `jikkyo ${c.id}`,
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			});
		}
	}
	return out;
};
