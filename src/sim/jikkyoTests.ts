// 実況の 番組の 試験（pnpm test で いっしょに 動く）。
// A 節：映画館の 演出（曜日で かわる 会場の 文・スクリーンと 客席の 飾り。data/jikkyo/text.ts・ui/cinemaDecor.ts）と
// 劇場の 12月・1月の 文。
// E 節：実況の エンジン（core/jikkyo.ts）を ボットで 1歩ずつ 回す。Y 節：ナイター実況（core/jikkyoYakyu.ts・data/jikkyo/yakyu.ts）。
// S 節：映画館の『空飛ぶ鯖』（data/jikkyo/sora.ts）。K 節：劇場の 紅白スレ合戦（data/jikkyo/kohaku.ts）。D 節：番組表。
// 形は townTests と 同じ（Fail・ok・{ id, name, ok, reason }）。id の 頭は 節の 字。

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	compileScript,
	gradeCue,
	type JkCueGrade,
	type JkEv,
	type JkInput,
	type JkLine,
	type JkOptions,
	type JkPick,
	type JkReq,
	type JkResult,
	type JkRules,
	type JkScript,
	type JkSlot,
	type JkSt,
	type JkTimeline,
	jkResult,
	jkStart,
	jkStep,
	jkView,
	OVER_TEXT,
	scriptGoal,
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
	GIKAI_CLOSE,
	GIKAI_EPISODES,
	GIKAI_OPEN,
	GIKAI_RERUN,
	GIKAI_TEXT,
	GIKAI_YAJI,
	type GikaiEpisode,
	type GikaiMemo,
	gikaiAvailable,
	gikaiEpisodeFor,
	gikaiProgram,
	gikaiWatched,
} from "../data/jikkyo/gikai";
import { PROGRAMS } from "../data/jikkyo/index";
import {
	KOHAKU,
	KOHAKU_ART,
	KOHAKU_CARDS,
	KOHAKU_CUE,
	KOHAKU_EXACT,
	KOHAKU_NAMES,
	KOHAKU_POOLS,
	KOHAKU_SAY,
	KOHAKU_SCENES,
	KOHAKU_THREAD,
	type KohakuData,
	kohakuCards,
	kohakuClock,
	kohakuKai,
	kohakuLeft,
	kohakuName,
} from "../data/jikkyo/kohaku";
import { isVenue, programSlot } from "../data/jikkyo/schedule";
import {
	SORA,
	SORA_ART,
	SORA_POOLS,
	SORA_PREVIEW,
	SORA_SCENES,
	SORA_THREAD,
	SORA_WORD,
} from "../data/jikkyo/sora";
import {
	type DayLines,
	isRoadshowNight,
	JK_PROG_MSG,
	JK_PROG_MSGS,
	JK_PROG_RESULT,
	JK_PROG_TV,
	kohakuMode,
	ONJ_PHRASES,
	progMsg,
	STAFF_LINES,
	STAFF_ONCE,
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
import type { MobId } from "../data/mobs";
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
import { programMemo, recordProgram, setWatchHook } from "../ui/jikkyoWatch";
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
export const width = (line: string): number =>
	[...line].reduce((w, ch) => w + (/[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);

/** 村の 窓（全角 22字 × 2行）に 収まるか。 */
export const fitsWindow = (where: string, text: string): void => {
	const lines = text.split("\n");
	ok(lines.length <= 2, `${where}: ${lines.length} lines`);
	for (const l of lines)
		ok(width(l) <= 22, `${where}: "${l}" is ${width(l)} wide`);
};

/** 試験の あいだだけ location.search を かえる（villageTests と 同じ）。もどす 手を 返す。 */
export const swapLocation = (search: string): (() => void) => {
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

/** 会場の 文の 表（物と 人）を 平らに（{kai} は いちばん 長い 回 40 で 埋める）。 */
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
						text: text.replaceAll("{kai}", "40"),
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

test(
	"A3",
	"10月は 映画館の ほかの 施設に 文の 上書きが なく、飾りは 映画館 だけ",
	() => {
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
	},
);

/** 描いた 命令を 記録する だけの canvas（色・透明度・文字も 記録）。 */
export const stubCanvas = () => {
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
export const NG_NAMES = [
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
export const HOSHU_NAMES = [
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

/** 地の文・セリフ・選ぶ だけを 記録する 台本の 相手（選ぶ ときは pick を 返す）。 */
export const recorder = (pick = 0) => {
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
					return pick;
				};
			if (k === "then") return undefined;
			return () => undefined;
		},
	});
	return { s, log };
};

test(
	"A6",
	"映画館で 調べる・話す と その 曜日の 文が 出て、スクリーンと 客席だけ 番組を 見るか 聞く（金曜と 火曜）",
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
		const { restore: unstore } = swapStorage();
		forgetJikkyoMemo();
		// 板は 出さない（やめるを 選ぶ 相手で 回す）
		setWatchHook(async () => null);
		try {
			for (const t of [FRI, TUE]) {
				const restore = swapLocation(`?debug&wday=${t.w}`);
				try {
					const events = buildFacility(f, view, {} as Ctx).events ?? [];
					const run = async (id: string, play: boolean): Promise<string[]> => {
						const ev = events.find((e) => e.id === id);
						ok(ev?.run, `wday ${t.w}: no ${id}`);
						const r = recorder(1);
						await ev?.run?.(r.s);
						ok(
							r.log.includes("choose") === play,
							`wday ${t.w}: ${id} play ${r.log.includes("choose")}`,
						);
						return r.log.filter((l) => l !== "choose");
					};
					for (const kind of ["screen", "poster", "seat"]) {
						const want = (
							venueLines("cinema", kind, t) ?? room.lines[kind]
						).map((l) => `narrate: ${l}`);
						const got = await run(`${kind}_0`, kind !== "poster");
						ok(
							got.join("\n") === want.join("\n"),
							`wday ${t.w} ${kind}:\n${got.join("\n")}`,
						);
					}
					const want = (staffLines("cinema", staff.id, t) ?? staff.lines).map(
						(l) => `say: ${l}`,
					);
					const got = await run(staff.id, false);
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
		} finally {
			setWatchHook(null);
			forgetJikkyoMemo();
			unstore();
		}
	},
);

/** 月日（曜日は 決め打ち）。 */
const date = (m: number, d: number): Today => ({ m, d, w: 3 });
/** 劇場の 日付の 見本（本番・公開リハ・録画・番組なし）。 */
const THEATER_DAYS: readonly [Today, "live" | "reha" | "rec" | null][] = [
	[date(12, 31), "live"],
	[date(12, 1), "reha"],
	[date(12, 15), "reha"],
	[date(12, 30), "reha"],
	[date(1, 1), "rec"],
	[date(1, 3), "rec"],
	[date(1, 7), "rec"],
	[date(1, 8), null],
	[date(6, 15), null],
	[date(11, 30), null],
];

test(
	"A7",
	"劇場の 文：12/31 は 第{回}回 の 本番、12月は 公開リハ、1/1〜7 は 録画、ほかの 日は いつもの 文（どれも 22字 × 2行）",
	() => {
		for (const [t, mode] of THEATER_DAYS) {
			const at = `${t.m}/${t.d}`;
			ok(kohakuMode(t) === mode, `${at}: mode ${kohakuMode(t)}`);
			const stage = venueLines("theater", "stage", t, 2026);
			const actor = staffLines("theater", "theater_actor", t, 2026);
			const bill = venueLines("theater", "playbill", t, 2026);
			if (mode === null) {
				ok(stage === null && actor === null && bill === null, `${at}: lines`);
				continue;
			}
			ok(stage?.length && actor?.length && bill?.length, `${at}: no lines`);
			const s = stage?.join() ?? "";
			ok(
				mode === "live"
					? s.includes("第15回")
					: mode === "reha"
						? s.includes("公開リハ")
						: s.includes("録画"),
				`${at}: stage ${s}`,
			);
			for (const l of [...(stage ?? []), ...(actor ?? []), ...(bill ?? [])])
				fitsWindow(`${at} theater`, l);
		}
		// 回は 年で 決まる（2051年で 第40回）
		const far =
			venueLines("theater", "stage", date(12, 31), 2051)?.join() ?? "";
		ok(far.includes("第40回"), `2051: ${far}`);
		fitsWindow("2051 stage", far);
		// 12月の 役者の 1行（公開リハの あいだ）
		ok(
			staffLines("theater", "theater_actor", date(12, 15), 2026)?.join() ===
				"大みそかの　夜は、\n『紅白スレ合戦』の　本番やで",
			"the December actor line",
		);
	},
);

// ───────────────── E・Y の 道具：ボットで 回す ─────────────────

export type BotName =
	| "kami"
	| "jouzu"
	| "shoshin"
	| "futsuu"
	| "random"
	| "miru";
type BotAns = { fit: "best" | "ok" | "miss"; ms: number } | null;

const pickFit = (r: () => number, pb: number, po: number) => {
	const x = r();
	return x < pb ? "best" : x < pb + po ? "ok" : "miss";
};
/** ボット（tune2.mjs と 同じ ふるまい）。 */
export const BOTS: Record<BotName, (r: () => number) => BotAns> = {
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

export const seeded = (s: string) => {
	const g = Rng.fromSeed(s);
	return () => g.float();
};

/** 記録した 出来事（実際の 時刻と、1000 の 行の ときの 点）。番組は 名目の 時刻と res も。 */
export type Rec = {
	ev: JkEv;
	wall: number;
	score?: readonly [number, number];
	open?: JkPick | null;
	t?: number;
	res?: number;
};

export type Played = {
	result: JkResult | null;
	log: Rec[];
	wall: number;
};

/**
 * 時間割を ボット（または ms と fit を 決め打ちの 答え）で 最後まで 回す。窓が 開いたら ボットが 決めた ms に
 * 答える（ago は 押してから その 歩の 終わりまで）。keep なら 出来事を ぜんぶ 残す。
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
				input = { pick: i, ago: el + dt - a.ms };
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
export const swapStorage = (): {
	store: Map<string, string>;
	restore: () => void;
} => {
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
export const resultFor = (
	res: number,
	opt: Partial<JkResult> = {},
): JkResult => ({
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

// ───────────────── S 金曜ロード保守『空飛ぶ鯖』 ─────────────────

const LIVE: JkSlot = { program: "sora", live: true, y: 2026 };
const RERUN: JkSlot = { program: "sora", live: false, y: 2026 };
const SLOTS = [LIVE, RERUN] as const;

/** 山場の ずれ（ボットの 速さから。kami ±80・jouzu ±200・shoshin ±400・random は 一様・miru は 押さない）。 */
const CUE_BOT: Record<BotName, (r: () => number) => number | null> = {
	kami: (r) => (r() * 2 - 1) * 80,
	jouzu: (r) => (r() * 2 - 1) * 200,
	shoshin: (r) => (r() * 2 - 1) * 400,
	futsuu: (r) => (r() < 0.1 ? null : (r() * 2 - 1) * 500),
	random: (r) => (r() < 0.15 ? null : -2400 + r() * 3600),
	miru: () => null,
};

export type Shown = Played & { tl: JkTimeline; G: number };

/**
 * 台本を ボットで 最後まで 回す（overlay の 窓・当番・山場）。窓ごとに ボットが 決めた ms に 答え、
 * 山場は ちょうど ＋ ずれ で 押す（ago は 押してから その 歩の 終わりまで）。2択に その 合いが なければ もう一方。
 * 答えない ことが ボットの 合いと 同じ 窓（timeoutFit）では 何も 押さない。
 */
export const playShow = (
	slot: JkSlot,
	bot: BotName,
	seed: string,
	opt: {
		keep?: boolean;
		dt?: number;
		reduced?: boolean;
		cue?: (r: () => number) => number | null;
		extra?: (k: number) => JkInput | undefined;
		script?: JkScript;
	} = {},
): Shown => {
	const dt = opt.dt ?? 100;
	const r = seeded(`bot:${seed}`);
	const { tl, rules, pools } = compileScript(
		opt.script ?? SORA,
		slot,
		seeded(`tl:${seed}`),
	);
	const st = jkStart(tl, rules, pools, {
		rand: seeded(`eng:${seed}`),
		reduced: opt.reduced,
	});
	const answer = BOTS[bot];
	const cueOff = opt.cue ?? CUE_BOT[bot];
	const log: Rec[] = [];
	type Plan = {
		w: unknown;
		a?: BotAns;
		off?: number | null;
		done?: boolean;
	};
	let plan = null as Plan | null;
	let open: JkPick | null = null;
	for (let k = 0; k < 200000; k++) {
		const v = jkView(st);
		let input = opt.extra?.(k);
		const w = v.win;
		if (!input && w && !w.reveal) {
			if (plan?.w !== w.w) plan = null;
			if (w.kind === "cue") {
				plan ??= { w: w.w, off: cueOff(r) };
				if (plan.off != null && !plan.done) {
					const target = (w.cue?.exactIn ?? 0) + plan.off;
					if (target <= dt) {
						input = { press: true, ago: Math.max(0, dt - Math.max(0, target)) };
						plan.done = true;
					}
				}
			} else if (w.w.type === "pick") {
				plan ??= { w: w.w, a: answer(r) };
				const el = w.open - w.left;
				const a = plan.a;
				if (a && !plan.done && el >= a.ms) {
					plan.done = true;
					// 黙る ことが その 合いの 窓（紅白の 鐘）では 書かない
					if (a.fit !== w.w.timeoutFit) {
						const opts = w.w.opts;
						let i = opts.findIndex((o) => o.fit === a.fit);
						if (i < 0)
							i = opts.findIndex(
								(o) => o.fit === (a.fit === "miss" ? "ok" : "miss"),
							);
						input = { pick: i, ago: el + dt - a.ms };
					}
				}
			}
		}
		const evs = jkStep(st, dt, input);
		for (const ev of evs) {
			if (ev.t === "open" && ev.win.type === "pick") open = ev.win;
			if (ev.t === "reveal" || ev.t === "close") open = null;
			if (!opt.keep && ev.t !== "end") continue;
			log.push({ ev, wall: st.wall, open, t: st.t, res: Math.floor(st.res) });
		}
		if (evs.some((e) => e.t === "end")) break;
	}
	return { result: jkResult(st), log, wall: st.wall, tl, G: st.G };
};

/** スレの 行（ふつうの 行と 上に 止めた 行）。 */
export const showLines = (p: Played): { line: JkLine; rec: Rec }[] =>
	p.log.flatMap((rec) =>
		rec.ev.t === "line" || rec.ev.t === "pin"
			? [{ line: rec.ev.line, rec }]
			: [],
	);

/** kami・jouzu の 上映（本放送・再上映 × 12 の 種。出来事を 残す）。 */
let showsCache: Shown[] | null = null;
const shows = (): Shown[] => {
	showsCache ??= SLOTS.flatMap((slot) =>
		(["kami", "jouzu", "shoshin", "random"] as const).flatMap((b) =>
			Array.from({ length: 6 }, (_, i) =>
				playShow(slot, b, `show:${slot.live}:${b}:${i}`, { keep: true }),
			),
		),
	);
	return showsCache;
};

/** 台本の 時間割（その 枠・種で）。 */
const soraTl = (slot: JkSlot, seed: string) =>
	SORA.timeline(seeded(seed), slot);

const TRAPS = [/今北産業/, /確率【\d+】%/, /が一言↓/];

test(
	"S1",
	"時間割：区切りが 並び 160秒 以内、組は ◎ 1つの 3択、窓と 山場が 重ならず、場面は 絵の 鍵、釣り札 2つまで、× の 半分 以上は 別の 時の ◎",
	() => {
		ok(SORA.length <= 160000, `length ${SORA.length}`);
		const words = new Set<string>();
		const bests = new Set<string>();
		const misses: string[] = [];
		let traps = 0;
		const previews = new Set<string>();
		for (const slot of SLOTS)
			for (const seed of ["s1:a", "s1:b", "s1:c", "s1:d"]) {
				const x = soraTl(slot, seed);
				const at = x.segments.map((s) => s.at);
				ok(at[0] === 0, "the first segment is not at 0");
				ok(
					at.every((a, i) => i === 0 || a > at[i - 1]),
					`segments out of order: ${at}`,
				);
				ok(
					at.every((a) => a < SORA.length),
					"a segment past the end",
				);
				for (const s of x.segments)
					ok(
						(SORA_SCENES as readonly string[]).includes(s.scene),
						`scene ${s.scene} has no picture`,
					);
				const wins: [number, number][] = [];
				for (const p of x.picks) {
					ok(p.sets.length >= 1 && p.sets.length <= 3, `${p.at}: sets`);
					if (p.at !== 131000)
						ok(p.sets.length >= 2, `${p.at}: only ${p.sets.length} set`);
					else previews.add(JSON.stringify(p.sets));
					for (const set of p.sets) {
						ok(set.length === 3, `${p.at}: ${set.length} options`);
						ok(
							set.filter((o) => o.fit === "best").length === 1,
							`${p.at}: not one ◎`,
						);
						ok(
							new Set(set.map((o) => o.text)).size === set.length,
							`${p.at}: same text twice`,
						);
						if (set.some((o) => TRAPS.some((t) => t.test(o.text)))) traps++;
						for (const o of set) {
							if (o.fit === "best") bests.add(o.text);
							if (o.fit === "miss") misses.push(o.text);
						}
					}
					wins.push([p.at, p.at + (p.open ?? 4000) + 800]);
				}
				for (const c of x.cues) {
					words.add(c.word);
					wins.push([c.at, c.at + (c.pulses + 1.5) * c.beat]);
				}
				wins.sort((a, b) => a[0] - b[0]);
				for (let i = 1; i < wins.length; i++)
					ok(wins[i][0] >= wins[i - 1][1], `windows overlap at ${wins[i][0]}`);
				const { tl } = compileScript(SORA, slot, seeded(seed));
				ok(tl.P === x.picks.length + 2, `P ${tl.P}`);
				ok(tl.total === SORA.length, "total");
			}
		// 釣り札は 番組に 2つまで（組の どれかに 出る pick の 数）
		ok(traps / (SLOTS.length * 4) <= 2, `traps ${traps}`);
		ok(previews.size === SORA_PREVIEW.length, "the preview does not vary");
		const elsewhere = misses.filter((t) => bests.has(t) || words.has(t));
		ok(
			elsewhere.length * 2 >= misses.length,
			`× that are ◎ elsewhere: ${elsewhere.length}/${misses.length}`,
		);
	},
);

/** かな・漢字が 6字 以上 つづく ところ（おんJの 決まり文句を のぞく）。 */
export const longRun = (s: string): string | null => {
	const bare = ONJ_PHRASES.reduce((t, p) => t.replaceAll(p, "　"), s);
	return /[ぁ-んァ-ヶー一-龠々]{6,}/.exec(bare)?.[0] ?? null;
};

/** 『空飛ぶ鯖』の 文（種類ごと）。 */
const soraTexts = () => {
	const fillN = (s: string) =>
		s.replaceAll("{n}", "999").replaceAll("{m}", "13");
	const tls = SLOTS.flatMap((slot) =>
		["w:a", "w:b", "w:c"].map((seed) => soraTl(slot, seed)),
	);
	const opts = [
		...tls.flatMap((x) =>
			x.picks.flatMap((p) => p.sets.flatMap((s) => s.map((o) => o.text))),
		),
		...SORA_PREVIEW.flatMap((p) => p.set.map((o) => o.text)),
		...SORA.duty.first.map((o) => o.text),
		...SORA.duty.variants.flatMap((v) => v.opts.map((o) => o.text)),
		...tls.flatMap((x) => x.cues.map((c) => c.word)),
	];
	const crowd = Object.values(SORA_POOLS).flatMap((l) => l.map(fillN));
	const titles = [1, 2, 5, 12].flatMap((n) => [
		...SLOTS.map((slot) => SORA.title(n, slot)),
		...Object.entries(SORA_THREAD)
			.filter(([k]) => /^(live|rerun)/.test(k))
			.map(([, v]) => v.replace("{n}", String(n))),
	]);
	const short = [
		...tls.flatMap((x) =>
			x.segments.flatMap((s) => [
				...(s.caption ? [s.caption] : []),
				...(s.pin ? [s.pin] : []),
				...(s.posts ?? []).map((p) => p.text),
				...(s.react ?? []).flatMap((r) => (r.text ? [r.text] : [])),
			]),
		),
		...[SORA.duty.pin, ...SORA.duty.variants.map((v) => v.pin)].map(fillN),
		...Object.values(SORA_THREAD).map(fillN),
		...[
			SORA_ART.logo,
			SORA_ART.title,
			SORA_ART.soon,
			SORA_ART.end,
			SORA_ART.hut,
			SORA_ART.kisei,
			SORA_ART.anchor,
			SORA_ART.sign,
			SORA_ART.oldest,
			SORA_ART.trip,
			SORA_ART.command,
			SORA_ART.flash,
			SORA_ART.akukin,
			SORA_ART.cmTag,
			...SORA_ART.cm.flatMap((c) => [c.shop, c.line]),
			...SORA_ART.staff,
			...SORA_PREVIEW.map((p) => p.card),
		],
		SORA.at1000(1, LIVE),
	];
	return { opts: [...new Set(opts)], crowd, titles, short };
};

test(
	"S2",
	"文：レス 12・候補 10・スレタイ・字幕・pin 22、分かち書き、実在の 名前なし、キリコの 候補に「保守」なし、「保守」は 固有名詞の 中だけ",
	() => {
		const { opts, crowd, titles, short } = soraTexts();
		for (const t of crowd) ok(width(t) <= 12, `res "${t}" is ${width(t)} wide`);
		for (const t of opts) ok(width(t) <= 10, `option "${t}" is ${width(t)}`);
		for (const t of [...titles, ...short])
			ok(width(t) <= 22, `"${t}" is ${width(t)} wide`);
		for (const t of [...crowd, ...opts]) {
			const run = longRun(t);
			ok(run === null, `"${t}": write "${run}" with a full-width space`);
		}
		const all = [...opts, ...crowd, ...titles, ...short];
		for (const t of all) {
			for (const ng of NG_NAMES) ok(!t.includes(ng), `"${ng}" in ${t}`);
			ok(!/[{}]/.test(t), `an unfilled {…} in ${t}`);
			const bare = HOSHU_NAMES.reduce((s, n) => s.replaceAll(n, ""), t);
			ok(!bare.includes("保守"), `a bare 保守 in ${t}`);
		}
		for (const t of opts)
			for (const w of ["保守", "立てといた", "立てたる", "立てたで"])
				ok(!t.includes(w), `Kiriko can write "${w}": ${t}`);
		// バルスは 映画館の 鍵（sora・会場・係員の 1回）だけ。番組の 板の 字には 出さない
		const ui = JSON.stringify([JK_PROG_MSG, JK_PROG_TV, JK_PROG_RESULT]);
		ok(!ui.includes("バルス"), "バルス in the program board texts");
		for (const [fid, people] of Object.entries(STAFF_ONCE))
			for (const lines of Object.values(people))
				for (const t of Object.values(lines)) {
					fitsWindow(`${fid} once`, t.replace("{n}", "12"));
					ok(fid === "cinema" || !t.includes("バルス"), "バルス outside");
					for (const ng of NG_NAMES) ok(!t.includes(ng), `"${ng}" in ${t}`);
				}
		for (const t of Object.values(JK_PROG_MSG).flat())
			fitsWindow("program window", t.replace("{n}", "12"));
		for (const t of [
			...Object.values(JK_PROG_TV).filter((x) => typeof x === "string"),
			...Object.values(JK_PROG_TV.grade),
			...Object.values(JK_PROG_RESULT),
		])
			ok(width(String(t)) <= 22, `"${t}" is wide`);
	},
);

test(
	"S3",
	"帯（400 の 種）：見るだけ 中央 0.52〜0.60G・上手 完走 65〜80%・初心者 25〜45%・random 10% 未満・神 中央 1.08G 以上（本放送・再上映）",
	() => {
		const N: Partial<Record<BotName, number>> = {
			kami: 40,
			jouzu: 400,
			shoshin: 400,
			random: 200,
			miru: 20,
		};
		const out: string[] = [];
		for (const slot of SLOTS)
			for (const [bot, n] of Object.entries(N) as [BotName, number][]) {
				const rs: number[] = [];
				let done = 0;
				for (let i = 0; i < n; i++) {
					const p = playShow(slot, bot, `s3:${slot.live}:${bot}:${i}`);
					rs.push((p.result?.res ?? 0) / p.G);
					if (p.result?.kanso) done++;
				}
				rs.sort((a, b) => a - b);
				const p50 = rs[Math.floor(rs.length / 2)];
				const k = done / n;
				const kb = SORA.bands.kanso?.[bot];
				const pb = SORA.bands.p50?.[bot];
				out.push(
					`${slot.live ? "L" : "R"} ${bot} ${(k * 100).toFixed(0)}% ${p50.toFixed(3)}`,
				);
				if (kb)
					ok(k >= kb[0] && k <= kb[1], `${out.at(-1)} kanso out of ${kb}`);
				if (pb)
					ok(p50 >= pb[0] && p50 <= pb[1], `${out.at(-1)} p50 out of ${pb}`);
			}
	},
);

test("S4", "2つの 種で pick の 文が ちがう（pick の 1/3 以上）", () => {
	for (const slot of SLOTS) {
		const a = compileScript(SORA, slot, seeded("s4:a")).tl.overlays;
		const b = compileScript(SORA, slot, seeded("s4:b")).tl.overlays;
		const key = (w: (typeof a)[number]["win"]) =>
			w.type === "pick"
				? w.opts
						.map((o) => o.text)
						.sort()
						.join("|")
				: w.id;
		const diff = a.filter((o, i) => key(o.win) !== key(b[i].win)).length;
		const picks = a.filter((o) => o.win.type === "pick").length;
		ok(diff * 3 >= picks, `only ${diff}/${picks} picks differ`);
		// ボタンの 並びも まざる（◎ が いつも 同じ 位置 では ない）
		const pos = new Set(
			a.flatMap((o) =>
				o.win.type === "pick"
					? [o.win.opts.findIndex((x) => x.fit === "best")]
					: [],
			),
		);
		ok(pos.size >= 2, "◎ is always at the same place");
	}
});

/** 台本の 番組の ボットの 上映の 組（S 節と K 節で 同じ 試験を 回す）。 */
export type ShowSet = {
	readonly script: JkScript;
	readonly slots: readonly JkSlot[];
	readonly list: () => Shown[];
	readonly get1000: string;
	readonly flood: readonly string[];
	/** 見るだけの 上映の 種。 */
	readonly miruSeed: (slot: JkSlot) => string;
};

const SORA_SET: ShowSet = {
	script: SORA,
	slots: SLOTS,
	list: () => shows(),
	get1000: SORA_THREAD.get1000,
	flood: SORA_POOLS.flood,
	miruSeed: (slot) => `s5:${slot.live}`,
};

/** 950 の 当番と 切れ目（上映ごとに 2回まで・山場と 次の 窓の 前は 出ない・切れ目の 長さ・見るだけでも 出る）。 */
export const checkDuty = (set: ShowSet): void => {
	const cues = compileScript(
		set.script,
		set.slots[0],
		seeded("x"),
	).tl.overlays.filter((o) => o.win.type === "cue");
	const seen = new Set<number>();
	for (const p of set.list()) {
		const opens = p.log.filter(
			(r) => r.ev.t === "open" && r.ev.win.id.startsWith("duty"),
		);
		ok(opens.length <= 2, `${opens.length} duties`);
		for (const r of opens) {
			const t = r.t ?? 0;
			for (const c of cues)
				if (c.win.type === "cue")
					ok(
						t < c.at - 6000 ||
							t > c.at + (c.win.pulses + 1.5) * c.win.beat + 6000,
						`a duty near the cue at ${t}`,
					);
			const next = p.tl.overlays.find(
				(o) => o.win.type === "pick" && o.at >= t,
			);
			ok(
				!next || next.at - t >= 4500,
				`a duty ${next && next.at - t}ms before a pick`,
			);
		}
		// 切れ目の 長さ（スレごとに 当番の 答えから）
		let shown = false;
		let fit: string | null = null;
		let ans = 0;
		let gapOn: number | null = null;
		let inDuty = false;
		for (const r of p.log) {
			const ev = r.ev;
			if (ev.t === "open") inDuty = ev.win.id.startsWith("duty");
			if (ev.t === "open" && inDuty) {
				shown = true;
				fit = null;
			}
			if (ev.t === "reveal" && inDuty) {
				fit = ev.fit ?? "none";
				ans = r.wall;
			}
			if (ev.t === "gap" && ev.on) gapOn = r.wall;
			if (ev.t === "gap" && !ev.on && gapOn !== null) {
				const len = r.wall - gapOn;
				const G = { best: 300, ok: 1500, miss: 2500, none: 2500 };
				const want = !shown
					? 800
					: fit === null
						? 2500
						: Math.min(
								2500,
								Math.max(0, ans - gapOn) + G[fit as keyof typeof G],
							);
				ok(
					// 答えは 歩の はじめに 数えるので 1歩（100ms）早く なる ことが ある
					len >= want - 101 && len <= Math.max(want, 250) + 101,
					`gap ${len}ms, want ${want} (duty ${shown} ${fit})`,
				);
				seen.add(
					want === 800 ? 800 : fit === null ? 2500 : G[fit as keyof typeof G],
				);
				shown = false;
				fit = null;
				gapOn = null;
			}
		}
	}
	for (const w of [300, 800, 2500])
		ok(seen.has(w), `no ${w}ms gap in the runs (${[...seen]})`);
	// 見るだけ（群衆だけ）でも 当番が 1回は 出る
	for (const slot of set.slots) {
		const m = playShow(slot, "miru", set.miruSeed(slot), {
			keep: true,
			script: set.script,
		});
		ok(
			m.log.some((r) => r.ev.t === "open" && r.ev.win.id.startsWith("duty")),
			`miru ${JSON.stringify(slot)}: no duty`,
		);
	}
};

test(
	"S5",
	"950 の 当番：上映ごとに 2回まで・山場の 前後 6秒と 次の 窓の 4.5秒 以内に 出ない・切れ目は ◎ 0.3／○ 1.5／× と 見送り 2.5秒（出さない スレは 0.8秒）・見るだけでも 1回は 出る",
	() => checkDuty(SORA_SET),
);

test(
	"S6",
	"山場の 判定：beat 400・800・1000 で ちょうど・早い・遅い・押さない（0.22／0.55 × beat）、上映でも 押した 時の ずれで 決まり、神エイムには 返しが つく",
	() => {
		for (const beat of [400, 800, 1000]) {
			const c = { beat };
			const g = (d: number | null) =>
				gradeCue(c, 5000, d === null ? null : 5000 + d);
			ok(
				g(0) === "kami" &&
					g(0.2 * beat) === "kami" &&
					g(-0.2 * beat) === "kami",
				`${beat}: kami`,
			);
			ok(
				g(0.4 * beat) === "oshii" && g(-0.4 * beat) === "oshii",
				`${beat}: oshii`,
			);
			ok(
				g(-0.7 * beat) === "flying" && g(-2 * beat) === "flying",
				`${beat}: flying`,
			);
			ok(g(0.7 * beat) === "late" && g(1.4 * beat) === "late", `${beat}: late`);
			ok(g(null) === "none", `${beat}: none`);
		}
		const cases: [number | null, string][] = [
			[0, "kami"],
			[150, "kami"],
			[-320, "oshii"],
			[320, "oshii"],
			[-600, "flying"],
			[700, "late"],
			[null, "none"],
		];
		for (const [off, want] of cases) {
			const p = playShow(LIVE, "kami", `s6:${off}`, {
				keep: true,
				cue: () => off,
			});
			ok(p.result?.cue === want, `offset ${off}: ${p.result?.cue}`);
			const ls = showLines(p).map((x) => x.line);
			const k = ls.findIndex((l) => l.who === "me" && l.text === SORA_WORD);
			ok(k >= 0 === (off !== null), `offset ${off}: Kiriko's word ${k}`);
			const praise = ls.findIndex((l) => /神エイム/.test(l.text));
			if (want === "kami") {
				ok(praise > k, `offset ${off}: no praise`);
				const floodAt = p.log.findIndex((r) => r.ev.t === "flood" && r.ev.on);
				const after = showLines({ ...p, log: p.log.slice(floodAt) });
				const pi = after.findIndex((x) => /神エイム/.test(x.line.text));
				ok(pi >= 0 && pi < 10, `praise is line ${pi} of the flood`);
				ok(
					ls[praise].text ===
						SORA_THREAD.praise.replace("{n}", String(ls[k].no)),
					`praise ${ls[praise].text}`,
				);
			} else ok(praise < 0, `offset ${off}: praised`);
		}
	},
);

/** 番号（1000・1001 の ほかに 1000 以上なし・キリコは 999 まで・999 は 1つ・roll の あとは >>1 から）。 */
export const checkNumbers = (set: ShowSet): void => {
	for (const p of set.list()) {
		let part = -1;
		let last = 0;
		let rolled = false;
		const n999 = new Map<number, number>();
		for (const rec of p.log) {
			if (rec.ev.t === "roll") {
				ok(rec.ev.part === part + 1, `roll to ${rec.ev.part} from ${part}`);
				rolled = true;
				continue;
			}
			if (rec.ev.t !== "line" && rec.ev.t !== "pin") continue;
			const l = rec.ev.line;
			if (part < 0) part = l.part;
			if (rolled) {
				ok(
					l.part === part + 1 && l.no === 1 && l.cls === "title",
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
					(l.no === 1000 && l.text === set.get1000) ||
						(l.no === 1001 && l.cls === "over" && l.text === OVER_TEXT),
					`no ${l.no}: ${l.text}`,
				);
			if (l.who === "me") ok(l.no <= 999, `kiriko at ${l.no}`);
			ok(l.no > last, `numbers go back: ${last} → ${l.no} (${l.text})`);
			last = l.no;
			if (l.no === 999) n999.set(l.part, (n999.get(l.part) ?? 0) + 1);
		}
		for (const [pt, n] of n999) ok(n === 1, `part ${pt}: ${n} lines at 999`);
		const r = p.result;
		if (r)
			ok(
				r.part === r.part0 + Math.floor(r.res / 1000),
				`part ${r.part} res ${r.res}`,
			);
	}
};

test(
	"S7",
	"番号：1000・1001 の ほかに 1000 以上は なく、キリコは 999 まで、1つの スレに 999 は 1つ、roll の あとは 次の ★ の >>1 から",
	() => checkNumbers(SORA_SET),
);

/** 窓の 候補は 群衆に 出ず、直近 4行に 同じ 文が ない（選んだ ◎ を かさねる 行・洪水を のぞく）。 */
export const checkRepeats = (set: ShowSet): void => {
	const flood = new Set<string>(set.flood);
	for (const p of set.list()) {
		let lastBest: string | null = null;
		const recent: string[] = [];
		for (const rec of p.log) {
			const ev = rec.ev;
			if (ev.t === "open" && ev.win.type === "pick")
				lastBest = ev.win.opts.find((o) => o.fit === "best")?.text ?? null;
			if (ev.t !== "line" && ev.t !== "pin") continue;
			const l = ev.line;
			const w = rec.open;
			if (w && l.who !== "me")
				ok(!w.opts.some((o) => o.text === l.text), `"${l.text}" while open`);
			// 書き手が 覚える 行（題・1001・洪水の ほか ぜんぶ。キリコの 行も）と 同じ 窓で 見る
			if (
				l.cls === "title" ||
				l.cls === "over" ||
				(l.who !== "me" && flood.has(l.text))
			)
				continue;
			if (l.who !== "me" && l.text !== lastBest)
				ok(!recent.includes(l.text), `"${l.text}" again within 4 lines`);
			recent.push(l.text);
			if (recent.length > 4) recent.shift();
		}
	}
};

test(
	"S8",
	"窓が 開いて いる あいだ その 候補の 文は 群衆に 出ず、直近 4行に 同じ 文が ない（選んだ ◎ を かさねる 行・洪水を のぞく）",
	() => checkRepeats(SORA_SET),
);

test("S9", "B：1回で ノート、1.5秒 以内の 2回目で 出る（null）", () => {
	const quitAt = (ks: number[]) => (k: number) =>
		ks.includes(k) ? ({ quit: true } as const) : undefined;
	const p = playShow(LIVE, "miru", "s9", {
		keep: true,
		extra: quitAt([40, 50]),
	});
	const notes = p.log.filter((r) => r.ev.t === "note");
	ok(
		notes.length === 1 &&
			notes[0].ev.t === "note" &&
			notes[0].ev.text === SORA_THREAD.quit,
		`notes ${notes.length}`,
	);
	ok(p.result === null && p.wall < 6000, `did not quit: ${p.wall}`);
});

test(
	"S10",
	"表示の 速さ：1秒の 群衆の 行が 4を こえず（答えの あとは 6、洪水は 14、動きを へらす 設定では 4）",
	() => {
		for (const reduced of [false, true]) {
			const p = playShow(LIVE, "kami", `s10:${reduced}`, {
				keep: true,
				dt: 16,
				reduced,
			});
			const marks = (t: string) =>
				p.log
					.filter(
						(r) =>
							r.ev.t === t || (t === "flood" && r.ev.t === "flood" && r.ev.on),
					)
					.map((r) => r.wall);
			const reveals = [...marks("reveal"), ...marks("grade")];
			let floodOn: [number, number][] = [];
			let on = -1;
			for (const r of p.log)
				if (r.ev.t === "flood") {
					if (r.ev.on) on = r.wall;
					else floodOn = [...floodOn, [on, r.wall]];
				}
			const walls = p.log
				.filter(
					// 群衆の 行（1000 の 流れ・>>1・切れ目の 番号なしは 決まった 並びなので のぞく）
					(r) =>
						r.ev.t === "line" &&
						r.ev.line.who !== "me" &&
						!isFlowLine(r.ev.line),
				)
				.map((r) => r.wall);
			for (let k = 0; k < walls.length; k++) {
				const w = walls[k];
				const inSec = walls.filter((x) => x > w - 1000 && x <= w).length;
				const flood = floodOn.some(([a, b]) => w - 1000 < b + 1 && w >= a);
				const burst = reveals.some((r) => r <= w && w - r < 3000);
				const cap = reduced ? 4 : flood ? 14 : burst ? 6 : 4;
				ok(
					inSec <= cap + 1,
					`reduced ${reduced}: ${inSec} lines in 1s at ${w} (cap ${cap})`,
				);
			}
		}
	},
);

test(
	"S11",
	"鯖が　重い の あいだは 行が 止まり 数は 進む。スレタイは 【バルス用】 が 次の 1本だけ、反省会で すぐ かわる。完走の 印は 1000 の 行で 1回",
	() => {
		const p = playShow(LIVE, "kami", "s11", { keep: true });
		const stallSeg = p.log.find((r) => r.ev.t === "scene" && r.ev.seg.stall);
		ok(stallSeg, "no stall segment");
		if (stallSeg?.ev.t === "scene") {
			const w0 = stallSeg.wall;
			const stall = stallSeg.ev.seg.stall ?? 0;
			const inStall = p.log.filter(
				(r) =>
					(r.ev.t === "line" || r.ev.t === "pin") &&
					r.wall > w0 &&
					r.wall < w0 + stall - 1,
			);
			ok(!inStall.length, `${inStall.length} lines while the server is slow`);
			const after = p.log.find((r) => r.wall >= w0 + stall);
			ok(
				(after?.res ?? 0) > (stallSeg.res ?? 0) + 20,
				"res did not grow while slow",
			);
		}
		const rolls = p.log.filter((r) => r.ev.t === "roll");
		const barusu = rolls.filter(
			(r) => r.ev.t === "roll" && r.ev.title.includes("【バルス用】"),
		);
		const first = rolls.find((r) => (r.t ?? 0) >= 70000);
		ok(barusu.length <= 1, `${barusu.length} バルス用 threads`);
		if (first && (first.t ?? 0) < 102000)
			ok(barusu[0] === first, "the バルス用 title is not the next roll");
		for (const r of rolls)
			if ((r.t ?? 0) >= 102000 && r.ev.t === "roll")
				ok(
					!r.ev.title.includes("【バルス用】"),
					`バルス用 after the climax: ${r.ev.title}`,
				);
		const re = p.log.filter((r) => r.ev.t === "retitle");
		ok(
			re.length === 1 &&
				re[0].ev.t === "retitle" &&
				re[0].ev.title.includes("反省会"),
			"no 反省会 retitle",
		);
		ok(p.result?.kanso && p.result.cue === "kami", "kami did not complete");
		ok(p.log.filter((r) => r.ev.t === "kanso").length === 1, "kanso once");
		const k = p.log.findIndex((r) => r.ev.t === "kanso");
		const prev = p.log
			.slice(0, k)
			.reverse()
			.find((r) => r.ev.t === "line");
		ok(
			prev?.ev.t === "line" && prev.ev.line.no === 1000,
			"kanso is not at a 1000 line",
		);
	},
);

test(
	"S12",
	"映画館の スクリーン：見る → はじめての 1回だけ 遊び方（金曜 ★4・ほかの 日 ★2）→ 席 → 板 → 結果の 窓。やめる なら 何も しない。係員は 神エイムと 再上映の あと 1回だけ",
	async () => {
		const f = cinema();
		const staff = f.room?.people?.find((p) => p.id === "cinema_staff");
		if (!staff) throw new Fail("no cinema_staff");
		const view: VillageView = {
			stage: TOWN_STAGES - 1,
			unlocked: ["shallow"],
			cleared: [],
		};
		const { store, restore } = swapStorage();
		let slot: JkSlot | null = null;
		let fake: JkResult | null = null;
		setWatchHook(async (_s, sl) => {
			slot = sl;
			return fake;
		});
		try {
			for (const t of [FRI, TUE]) {
				const loc = swapLocation(`?debug&wday=${t.w}`);
				try {
					store.clear();
					forgetJikkyoMemo();
					const events = buildFacility(f, view, {} as Ctx).events ?? [];
					const run = async (id: string, pick = 0) => {
						const r = recorder(pick);
						await events.find((e) => e.id === id)?.run?.(r.s);
						return r.log;
					};
					const goal = t.w === 5 ? 4 : 2;
					const screen = venueLines("cinema", "screen", t) ?? [];
					fake = resultFor(4321, {
						part: 5,
						part0: 1,
						kanso: true,
						cue: "kami",
					});
					const a = await run("screen_0");
					const want = [
						...screen.map((l) => `narrate: ${l}`),
						"choose",
						`narrate: ${JK_PROG_MSG.howto.replace("{n}", String(goal))}`,
						`narrate: ${JK_PROG_MSG.seat}`,
						`narrate: ${JK_PROG_MSG.over.replace("{n}", "5")}`,
						`narrate: ${JK_PROG_MSG.kanso}`,
						`narrate: ${JK_PROG_MSG.kami}`,
					];
					ok(a.join("\n") === want.join("\n"), `wday ${t.w}:\n${a.join("\n")}`);
					const sl = slot as JkSlot | null;
					ok(
						sl?.program === "sora" && sl.live === (t.w === 5),
						`slot ${JSON.stringify(sl)}`,
					);
					// 2回目は 遊び方なし。客席からも 見られる。途中で 出たら 1窓
					fake = null;
					const b = await run("seat_0");
					ok(
						!b.some((l) => l.includes(JK_PROG_MSG.howto.slice(0, 6))),
						"howto twice",
					);
					ok(b.at(-1) === `narrate: ${JK_PROG_MSG.left}`, `left: ${b.at(-1)}`);
					// やめる
					const c = await run("screen_0", 1);
					ok(c.at(-1) === "choose", `quit: ${c.join("|")}`);
				} finally {
					loc();
				}
			}
			// 係員：再上映で のびた ★ と 神エイムの あと、1回ずつ
			const loc = swapLocation("?debug&wday=2");
			try {
				forgetJikkyoMemo();
				const talk = async () => {
					const r = recorder();
					await buildFacility(f, view, {} as Ctx)
						.events?.find((e) => e.id === staff.id)
						?.run?.(r.s);
					return r.log.join("\n");
				};
				const usual = staff.lines.map((l) => `say: ${l}`).join("\n");
				ok((await talk()) === usual, "a once line before any show");
				recordProgram(
					"sora",
					resultFor(2600, { part: 3, kanso: true, cue: "oshii" }),
					RERUN,
				);
				const once = STAFF_ONCE.cinema.cinema_staff;
				ok(
					(await talk()) === `say: ${once.rerun.replace("{n}", "3")}`,
					"no rerun line",
				);
				ok((await talk()) === usual, "the rerun line twice");
				recordProgram(
					"sora",
					resultFor(4100, { part: 5, kanso: true, cue: "kami" }),
					LIVE,
				);
				ok((await talk()) === `say: ${once.kami}`, "no kami line");
				ok((await talk()) === usual, "the kami line twice");
				const m = programMemo("sora");
				ok(
					m.best === 5 && m.plays === 2 && m.kanso === 2 && m.kami,
					`memo ${JSON.stringify(m)}`,
				);
			} finally {
				loc();
			}
		} finally {
			setWatchHook(null);
			forgetJikkyoMemo();
			restore();
		}
	},
);

// ───────────────── D 番組表 ─────────────────

test(
	"D1",
	"番組表：映画館は 段7 から、金曜は 本放送・ほかの 日は 再上映。本館は 段6 から ナイター",
	() => {
		for (const w of WEEK) {
			const s = programSlot("cinema", day(w), 7, 2026);
			ok(
				s?.main.program === "sora" && s.main.live === (w === 5),
				`wday ${w}: ${JSON.stringify(s)}`,
			);
			ok(
				programSlot("cinema", day(w), 6, 2026) === null,
				`wday ${w}: cinema at stage 6`,
			);
			// 本館は 月曜だけ 議会中継（D3）、ほかの 日は ナイター
			for (const st of [6, 7])
				ok(
					programSlot("hall", day(w), st, 2026)?.main.program ===
						(w === 1 ? "gikai" : "yakyu"),
					`hall ${st}`,
				);
			ok(programSlot("hall", day(w), 5, 2026) === null, "hall at stage 5");
		}
		ok(
			isVenue("cinema") &&
				isVenue("hall") &&
				isVenue("theater") &&
				!isVenue("bar"),
			"isVenue",
		);
		// 映画館の スクリーンと 客席・劇場の 舞台と、束の 番組の 会場の テレビだけが 番組（ほかの 施設に jikkyo は ない）
		const plays: string[] = [];
		for (const f of FACILITIES)
			for (const [k, v] of Object.entries(f.room?.plays ?? {}))
				if (v === "jikkyo") plays.push(`${f.id}.${k}`);
		ok(
			plays.sort().join() ===
				"arcade.tv,casino.tv,cinema.screen,cinema.seat,go.tv,repair.tv,station.tv,theater.stage,umi.tv",
			`jikkyo plays ${plays}`,
		);
		ok(PROGRAMS.sora === SORA, "sora is not in PROGRAMS");
		ok(scriptGoal(SORA, LIVE) === 4 && scriptGoal(SORA, RERUN) === 2, "goals");
	},
);

// ───────────────── E12 答えない ことが 正解の 窓 ─────────────────

test(
	"E12",
	"timeoutFit：答えないと その 合い（速さ 1.0）で コンボ +1、キリコは 書かない。blocking の 窓では まだ 使えない",
	() => {
		const o = (text: string, fit: "best" | "ok" | "miss") => ({ text, fit });
		// ★1 の 小さな 番組（950 にも 1000 にも 届かない）
		const script: JkScript = {
			...KOHAKU,
			length: 30000,
			goal: { live: 1, rerun: 1 },
			timeline: () => ({
				segments: [{ at: 0, scene: "wait", pool: "wait", rate: 1 }],
				picks: [
					{
						at: 2000,
						sets: [[o("31", "best"), o("はよ", "ok"), o("乙", "miss")]],
					},
					{
						at: 10000,
						open: 5000,
						timeoutFit: "best",
						cheer: "bellOk",
						sets: [[o("うおおお", "miss"), o("ゴーン", "ok")]],
					},
				],
				cues: [],
			}),
		};
		const { tl, rules, pools } = compileScript(script, K_LIVE, seeded("e12"));
		const st = jkStart(tl, rules, pools, { rand: seeded("e12:eng") });
		const log: JkEv[] = [];
		let answered = false;
		for (let k = 0; k < 1000 && !st.ended; k++) {
			const v = jkView(st);
			let input: JkInput | undefined;
			if (
				!answered &&
				v.win &&
				!v.win.reveal &&
				v.win.open - v.win.left >= 900
			) {
				input = {
					pick:
						v.win.w.type === "pick"
							? v.win.w.opts.findIndex((x) => x.fit === "best")
							: 0,
					// 押したのは この 歩の はじめ（ago は 歩の 長さ ぶん）
					ago: 100,
				};
				answered = true;
			}
			log.push(...jkStep(st, 100, input));
		}
		const reveals = log.filter((e) => e.t === "reveal");
		ok(reveals.length === 2, `${reveals.length} reveals`);
		const r2 = reveals[1];
		const want = Math.round(((rules.post * st.G) / tl.P) * rules.fit.best);
		ok(
			r2?.t === "reveal" &&
				r2.chosen === null &&
				r2.fit === "best" &&
				r2.gain === want,
			`silent reveal ${JSON.stringify(r2)} want gain ${want}`,
		);
		const combos = log.flatMap((e) => (e.t === "combo" ? [e.combo] : []));
		ok(combos.join() === "1,2", `combos ${combos}`);
		const k2 = log.indexOf(r2 as JkEv);
		const mine = log
			.slice(k2)
			.filter((e) => e.t === "line" && e.line.who === "me");
		ok(!mine.length, "Kiriko wrote at the silent window");
		const after = log
			.slice(k2)
			.flatMap((e) => (e.t === "line" ? [e.line.text] : []))
			.slice(0, 6);
		ok(
			after.some((t) => (KOHAKU_POOLS.bellOk as readonly string[]).includes(t)),
			`no cheer after the silence: ${after}`,
		);
		const res = jkResult(st);
		ok(
			res?.counts.best === 2 && res.counts.none === 0,
			`counts ${JSON.stringify(res?.counts)}`,
		);
		// blocking の 窓の timeoutFit は まだ 投げる
		const g = gameOf(1);
		const tl2 = tinyTl(4, 2);
		const bad = {
			...tl2,
			segs: tl2.segs.map((s) =>
				s.win ? { ...s, win: { ...s.win, timeoutFit: "best" as const } } : s,
			),
		};
		let threw = false;
		try {
			jkStart(bad, yakyuRules(g), YAKYU_POOLS, { rand: seeded("e12:b") });
		} catch {
			threw = true;
		}
		ok(threw, "a blocking timeoutFit did not throw");
	},
);

// ───────────────── E13 答えの 速さは 押した 時で ─────────────────

test(
	"E13",
	"答えの 速さは 押した 時（その 歩の 終わり − ago）で 測る：歩の 終わりに 押せば 1歩 ぶん 遅く、神速の 境を こえる（overlay・blocking の どちらも）",
	() => {
		const o = (text: string, fit: "best" | "ok" | "miss") => ({ text, fit });
		const script: JkScript = {
			...KOHAKU,
			length: 30000,
			goal: { live: 1, rerun: 1 },
			timeline: () => ({
				segments: [{ at: 0, scene: "wait", pool: "wait", rate: 1 }],
				picks: [
					{
						at: 2000,
						sets: [[o("31", "best"), o("はよ", "ok"), o("乙", "miss")]],
					},
				],
				cues: [],
			}),
		};
		const g = gameOf(1);
		const starts: [string, () => JkSt][] = [
			[
				"overlay",
				() => {
					const c = compileScript(script, K_LIVE, seeded("e13"));
					return jkStart(c.tl, c.rules, c.pools, { rand: seeded("e13:eng") });
				},
			],
			[
				"blocking",
				() =>
					jkStart(tinyTl(4, 2), yakyuRules(g), YAKYU_POOLS, {
						rand: seeded("e13:b"),
						tutored: true,
					}),
			],
		];
		const dt = 100;
		for (const [mode, start] of starts)
			for (const ago of [0, dt]) {
				const st = start();
				const lim = st.rules.speed[0]?.[0] ?? 0;
				let el = -1;
				let rev: JkEv | undefined;
				for (let k = 0; k < 2000 && !st.ended && !rev; k++) {
					const v = jkView(st);
					let input: JkInput | undefined;
					// 窓の 中の 時が 境の 手前で、この 歩の 終わりには 境を こえる 歩に 押す
					if (el < 0 && v.win && !v.win.reveal) {
						const now = v.win.open - v.win.left;
						if (now + dt > lim && v.win.w.type === "pick") {
							el = now;
							input = {
								pick: v.win.w.opts.findIndex((x) => x.fit === "best"),
								ago,
							};
						}
					}
					rev = jkStep(st, dt, input).find((e) => e.t === "reveal");
				}
				ok(
					rev?.t === "reveal" && el >= 0 && el <= lim,
					`${mode} ago ${ago}: no reveal (at ${el})`,
				);
				// ago 0 は 歩の 終わり（el ＋ dt ＞ 境）で 遅い、ago dt は 歩の はじめ（el ≦ 境）で 神速
				ok(
					rev?.t === "reveal" && rev.fast === (ago === dt),
					`${mode} ago ${ago}: fast ${rev?.t === "reveal" && rev.fast} at ${el}`,
				);
			}
	},
);

// ───────────────── K 紅白スレ合戦 → 年越し ─────────────────

const K_LIVE: JkSlot = { program: "kohaku", live: true, y: 2026 };
const K_REHA: JkSlot = {
	program: "kohaku",
	live: false,
	mode: "reha",
	y: 2026,
};
const K_REC: JkSlot = { program: "kohaku", live: false, mode: "rec", y: 2025 };
const K_SLOTS = [K_LIVE, K_REHA, K_REC] as const;
const kTag = (s: JkSlot) =>
	s.live ? "LIVE" : s.mode === "rec" ? "REC" : "REHA";

const kohakuTl = (slot: JkSlot, seed: string) =>
	KOHAKU.timeline(seeded(seed), slot);

/** 審査の 窓（言いきりの 組を 持つ pick）。 */
const isShinsa = (p: { sets: readonly (readonly { text: string }[])[] }) =>
	p.sets.some((s) =>
		s.some((o) => o.text === KOHAKU_SAY.aka || o.text === KOHAKU_SAY.shiro),
	);

test(
	"K1",
	"時間割：区切りが 並び 160秒 以内、組は ◎ 1つの 3択（審査は 1組、鐘は ◎ なしの 2択で 黙れば ◎）、窓と 山場が 重ならず、場面は 絵の 鍵、釣り札 2つまで、× の 半分 以上は 別の 時の ◎",
	() => {
		ok(KOHAKU.length <= 160000, `length ${KOHAKU.length}`);
		const words = new Set<string>();
		const bests = new Set<string>();
		const misses: string[] = [];
		let traps = 0;
		for (const slot of K_SLOTS)
			for (const seed of ["k1:a", "k1:b", "k1:c", "k1:d"]) {
				const x = kohakuTl(slot, seed);
				const at = x.segments.map((s) => s.at);
				ok(at[0] === 0, "the first segment is not at 0");
				ok(
					at.every((a, i) => i === 0 || a > at[i - 1]),
					`segments out of order: ${at}`,
				);
				ok(
					at.every((a) => a < KOHAKU.length),
					"a segment past the end",
				);
				for (const s of x.segments)
					ok(
						(KOHAKU_SCENES as readonly string[]).includes(s.scene),
						`scene ${s.scene} has no picture`,
					);
				const wins: [number, number][] = [];
				let bells = 0;
				for (const p of x.picks) {
					ok(p.sets.length >= 1 && p.sets.length <= 3, `${p.at}: sets`);
					if (!isShinsa(p))
						ok(p.sets.length >= 2, `${p.at}: only ${p.sets.length} set`);
					else ok(p.sets.length === 1, `${p.at}: the judging has sets`);
					if (p.timeoutFit) {
						bells++;
						ok(p.timeoutFit === "best", `${p.at}: timeoutFit ${p.timeoutFit}`);
						ok((p.open ?? 4000) === 5000, `${p.at}: the bell is not 5s`);
					}
					for (const set of p.sets) {
						const n = (f: string) => set.filter((o) => o.fit === f).length;
						if (p.timeoutFit)
							ok(
								set.length === 2 &&
									n("best") === 0 &&
									n("ok") === 1 &&
									n("miss") === 1,
								`${p.at}: the bell set ${set.map((o) => o.text)}`,
							);
						else {
							ok(set.length === 3, `${p.at}: ${set.length} options`);
							ok(n("best") === 1 && n("ok") === 1, `${p.at}: not ◎○×`);
						}
						ok(
							new Set(set.map((o) => o.text)).size === set.length,
							`${p.at}: same text twice`,
						);
						if (set.some((o) => TRAPS.some((t) => t.test(o.text)))) traps++;
						for (const o of set) {
							if (o.fit === "best") bests.add(o.text);
							if (o.fit === "miss") misses.push(o.text);
						}
					}
					wins.push([p.at, p.at + (p.open ?? 4000) + 800]);
				}
				ok(bells === 1, `${bells} bells`);
				for (const c of x.cues) {
					words.add(c.word);
					wins.push([c.at, c.at + (c.pulses + 1.5) * c.beat]);
				}
				wins.sort((a, b) => a[0] - b[0]);
				for (let i = 1; i < wins.length; i++)
					ok(wins[i][0] >= wins[i - 1][1], `windows overlap at ${wins[i][0]}`);
				const { tl } = compileScript(KOHAKU, slot, seeded(seed));
				ok(tl.P === x.picks.length + 2, `P ${tl.P}`);
				ok(tl.total === KOHAKU.length, "total");
			}
		ok(traps / (K_SLOTS.length * 4) <= 2, `traps ${traps}`);
		// 審査の 勝ち組は 種で かわる（どちらの 言いきりも ◎ に なる）
		for (let i = 0; i < 20; i++)
			for (const p of kohakuTl(K_LIVE, `k1:w${i}`).picks.filter(isShinsa))
				for (const o of p.sets[0]) if (o.fit === "best") bests.add(o.text);
		ok(
			bests.has(KOHAKU_SAY.aka) && bests.has(KOHAKU_SAY.shiro),
			"the judging never varies",
		);
		const elsewhere = misses.filter((t) => bests.has(t) || words.has(t));
		ok(
			elsewhere.length * 2 >= misses.length,
			`× that are ◎ elsewhere: ${elsewhere.length}/${misses.length}`,
		);
	},
);

/** 紅白の 文（種類ごと）。 */
const kohakuTexts = () => {
	const fillN = (s: string) =>
		s
			.replaceAll("{n}", "999")
			.replaceAll("{m}", "13")
			.replaceAll("{kai}", "40")
			.replaceAll("{c}", "04:45:00");
	const tls = K_SLOTS.flatMap((slot) =>
		["kw:a", "kw:b", "kw:c"].map((seed) => ({ slot, x: kohakuTl(slot, seed) })),
	);
	const opts = [
		...tls.flatMap(({ x }) =>
			x.picks.flatMap((p) => p.sets.flatMap((s) => s.map((o) => o.text))),
		),
		...KOHAKU.duty.first.map((o) => o.text),
		...KOHAKU.duty.variants.flatMap((v) => v.opts.map((o) => o.text)),
		...tls.flatMap(({ x }) => x.cues.map((c) => c.word)),
		...Object.values(KOHAKU_SAY),
	];
	const crowd = Object.values(KOHAKU_POOLS).flatMap((l) => l.map(fillN));
	const titles = [
		...[1, 2, 5, 12].flatMap((n) =>
			[2026, 2051].flatMap((y) =>
				K_SLOTS.map((s) => KOHAKU.title(n, { ...s, y })),
			),
		),
		...tls.flatMap(({ slot, x }) =>
			x.segments.flatMap((s) =>
				s.title?.later
					? [1, 12].map((n) => s.title?.later?.(n, slot) ?? "")
					: [],
			),
		),
	];
	const short = [
		...tls.flatMap(({ x }) =>
			x.segments.flatMap((s) => [
				...(s.caption ? [s.caption] : []),
				...(s.pin ? [s.pin] : []),
				...(s.posts ?? []).map((p) => p.text),
				...(s.react ?? []).flatMap((r) => (r.text ? [r.text] : [])),
			]),
		),
		...[KOHAKU.duty.pin, ...KOHAKU.duty.variants.map((v) => v.pin)].map(fillN),
		...Object.values(KOHAKU_THREAD).map(fillN),
		KOHAKU_ART.soon,
		KOHAKU_ART.aka,
		KOHAKU_ART.shiro,
		KOHAKU_ART.baton,
		KOHAKU_ART.board,
		...Object.values(KOHAKU_ART.win),
		KOHAKU_ART.bell,
		KOHAKU_ART.newYear,
		KOHAKU_ART.akeome,
		KOHAKU_ART.kari,
		KOHAKU_ART.end,
		KOHAKU.at1000(1, K_LIVE),
	];
	const names = [
		...Object.values(KOHAKU_NAMES),
		...K_SLOTS.flatMap((s) =>
			[0, 50000, KOHAKU_EXACT].map((t) => kohakuName(t, s) ?? ""),
		),
	];
	return { opts: [...new Set(opts)], crowd, titles, short, names };
};

test(
	"K2",
	"文：レス 12・候補 10・スレタイ（回 15〜51・★1〜12）・字幕・pin 22・名前欄 12、分かち書き、実在の 名前なし、キリコの 候補に「保守」なし、バルスなし、劇場の 窓は 22字 × 2行",
	() => {
		const { opts, crowd, titles, short, names } = kohakuTexts();
		for (const t of crowd) ok(width(t) <= 12, `res "${t}" is ${width(t)} wide`);
		for (const t of opts) ok(width(t) <= 10, `option "${t}" is ${width(t)}`);
		for (const t of [...titles, ...short])
			ok(width(t) <= 22, `"${t}" is ${width(t)} wide`);
		for (const t of names)
			ok(t && width(t) <= 12, `name "${t}" is ${width(t)}`);
		ok(new Set(Object.values(KOHAKU_NAMES)).size === 5, "omikuji names repeat");
		for (const t of [...crowd, ...opts]) {
			const run = longRun(t);
			ok(run === null, `"${t}": write "${run}" with a full-width space`);
		}
		for (const t of [...opts, ...crowd, ...titles, ...short, ...names]) {
			for (const ng of NG_NAMES) ok(!t.includes(ng), `"${ng}" in ${t}`);
			ok(!/[{}]/.test(t), `an unfilled {…} in ${t}`);
			const bare = HOSHU_NAMES.reduce((s, n) => s.replaceAll(n, ""), t);
			ok(!bare.includes("保守"), `a bare 保守 in ${t}`);
			ok(!t.includes("バルス"), `バルス in ${t}`);
		}
		for (const t of opts)
			for (const w of ["保守", "立てといた", "立てたる", "立てたで"])
				ok(!t.includes(w), `Kiriko can write "${w}": ${t}`);
		// 劇場の 村の 窓（番組ごとの 上書き）と 役者の 1回だけの 1行
		for (const [id, m] of Object.entries(JK_PROG_MSGS))
			for (const t of Object.values(m)) {
				fitsWindow(`${id} window`, t.replace("{n}", "12"));
				for (const ng of NG_NAMES) ok(!t.includes(ng), `"${ng}" in ${t}`);
			}
		const km = progMsg("kohaku");
		ok(km.menu.join() === JK_PROG_MSG.menu.join(), "kohaku menu");
		ok(
			km.over !== JK_PROG_MSG.over && km.howto === JK_PROG_MSG.howto,
			"kohaku messages",
		);
		for (const t of Object.values(STAFF_ONCE.theater?.theater_actor ?? {})) {
			fitsWindow("theater once", t);
			ok(!t.includes("バルス"), "バルス in the theater");
		}
		ok(width(JK_PROG_TV.silent.replace("{g}", "999")) <= 22, "silent note");
	},
);

test(
	"K3",
	"帯（400 の 種）：見るだけ 中央 0.52〜0.60G・上手 完走 65〜80%・初心者 25〜45%・random 10% 未満・神 中央 1.08G 以上（本番・公開リハ・録画）",
	() => {
		const N: Partial<Record<BotName, number>> = {
			kami: 40,
			jouzu: 400,
			shoshin: 400,
			random: 200,
			miru: 20,
		};
		for (const slot of K_SLOTS)
			for (const [bot, n] of Object.entries(N) as [BotName, number][]) {
				const rs: number[] = [];
				let done = 0;
				for (let i = 0; i < n; i++) {
					const p = playShow(slot, bot, `k3:${kTag(slot)}:${bot}:${i}`, {
						script: KOHAKU,
					});
					rs.push((p.result?.res ?? 0) / p.G);
					if (p.result?.kanso) done++;
				}
				rs.sort((a, b) => a - b);
				const p50 = rs[Math.floor(rs.length / 2)];
				const k = done / n;
				const kb = KOHAKU.bands.kanso?.[bot];
				const pb = KOHAKU.bands.p50?.[bot];
				const tag = `${kTag(slot)} ${bot} ${(k * 100).toFixed(1)}% ${p50.toFixed(3)}`;
				if (kb) ok(k >= kb[0] && k <= kb[1], `${tag} kanso out of ${kb}`);
				if (pb) ok(p50 >= pb[0] && p50 <= pb[1], `${tag} p50 out of ${pb}`);
			}
	},
);

/** 鐘の 窓まで 回す（choose は 鐘で えらぶ 合い。null は 黙る）。 */
const bellRun = (seed: string, choose: "ok" | "miss" | null) => {
	const { tl, rules, pools } = compileScript(
		KOHAKU,
		K_LIVE,
		seeded(`tl:${seed}`),
	);
	const st = jkStart(tl, rules, pools, { rand: seeded(`eng:${seed}`) });
	const log: { ev: JkEv; t: number }[] = [];
	for (let k = 0; k < 2000 && st.t < 93000; k++) {
		const v = jkView(st);
		let input: JkInput | undefined;
		const w = v.win;
		if (
			choose &&
			w &&
			!w.reveal &&
			w.w.type === "pick" &&
			w.w.timeoutFit &&
			w.open - w.left >= 1000
		)
			// 押したのは この 歩の はじめ（ago は 歩の 長さ ぶん）
			input = { pick: w.w.opts.findIndex((o) => o.fit === choose), ago: 100 };
		for (const ev of jkStep(st, 100, input)) log.push({ ev, t: st.t });
	}
	const open = log.findIndex(
		(r) =>
			r.ev.t === "open" && r.ev.win.type === "pick" && !!r.ev.win.timeoutFit,
	);
	const rest = log.slice(open);
	const reveal = rest.find((r) => r.ev.t === "reveal")?.ev;
	const combo = rest.find((r) => r.ev.t === "combo")?.ev;
	const before = log
		.slice(0, open)
		.reverse()
		.find((r) => r.ev.t === "combo")?.ev;
	const mine = rest.filter((r) => r.ev.t === "line" && r.ev.line.who === "me");
	return { open, reveal, combo, before, mine, rest };
};

test(
	"K4",
	"除夜の 鐘：黙れば ◎（コンボ +1・キリコは 書かない・群衆が 静かに）、「ゴーン」は ○、さわぐと ×（コンボ 0）。上に「静かに　見よ」",
	() => {
		for (const seed of ["k4:a", "k4:b", "k4:c"]) {
			const quiet = bellRun(seed, null);
			ok(quiet.open >= 0, `${seed}: no bell`);
			const r = quiet.reveal;
			ok(
				r?.t === "reveal" &&
					r.chosen === null &&
					r.fit === "best" &&
					r.gain > 0,
				`${seed}: silent ${JSON.stringify(r)}`,
			);
			const c0 = quiet.before?.t === "combo" ? quiet.before.combo : 0;
			ok(
				quiet.combo?.t === "combo" && quiet.combo.combo === c0 + 1,
				`${seed}: combo ${JSON.stringify(quiet.combo)} from ${c0}`,
			);
			ok(!quiet.mine.length, `${seed}: Kiriko wrote in the bell`);
			const calm = quiet.rest
				.flatMap((x) => (x.ev.t === "line" ? [x.ev.line.text] : []))
				.slice(0, 8);
			ok(
				calm.some((t) =>
					(KOHAKU_POOLS.bellOk as readonly string[]).includes(t),
				),
				`${seed}: the crowd is not calm: ${calm}`,
			);
			const ok2 = bellRun(seed, "ok");
			ok(
				ok2.reveal?.t === "reveal" &&
					ok2.reveal.fit === "ok" &&
					ok2.reveal.chosen !== null,
				`${seed}: ゴーン`,
			);
			ok(ok2.mine.length === 1, `${seed}: ゴーン lines ${ok2.mine.length}`);
			const bad = bellRun(seed, "miss");
			ok(
				bad.reveal?.t === "reveal" && bad.reveal.fit === "miss",
				`${seed}: うおおお`,
			);
			ok(
				bad.combo?.t === "combo" && bad.combo.combo === 0,
				`${seed}: うおおお combo`,
			);
			const said = bad.mine[0]?.ev;
			ok(
				said?.t === "line" &&
					["うおおお", "あけおめ", "くるぞ…"].includes(said.line.text),
				`${seed}: said ${said?.t === "line" ? said.line.text : ""}`,
			);
		}
		// 鐘の 区切りの 頭で「静かに　見よ」を 上に 止める
		const p = playShow(K_LIVE, "kami", "k4:pin", {
			script: KOHAKU,
			keep: true,
		});
		const pin = p.log.find(
			(r) => r.ev.t === "pin" && r.ev.line.text === KOHAKU_THREAD.quiet,
		);
		ok(
			pin && (pin.t ?? 0) >= 80000 && (pin.t ?? 0) < 84000,
			`pin at ${pin?.t}`,
		);
		ok(pin?.ev.t === "pin" && pin.ev.ms >= 5000, "the pin is short");
	},
);

test(
	"K5",
	"時計：04:45:00 から だんだん へり、0時の 10秒 前から 1秒＝1秒（合図で 00:00:03・02・01、ちょうどで 00:00:00）、0時の あとは 出さない。名前欄は「新年まで＠」（公開リハは「仮の0時まで＠」）",
	() => {
		const E = KOHAKU_EXACT;
		ok(kohakuClock(0) === "04:45:00", `start ${kohakuClock(0)}`);
		let prev = Number.POSITIVE_INFINITY;
		for (let t = 0; t <= E; t += 250) {
			const s = kohakuLeft(t);
			ok(s !== null && s <= prev, `${t}: ${s} after ${prev}`);
			prev = s ?? prev;
			if (t >= E - 10000)
				ok(s === Math.ceil((E - t) / 1000 - 1e-9), `${t}: real time ${s}`);
			else ok((s ?? 0) >= 10, `${t}: ${s} before the last 10s`);
		}
		ok(
			kohakuLeft(E - 10001) !== null && (kohakuLeft(E - 10001) ?? 0) >= 10,
			"10s edge",
		);
		const pulses = [0, 1, 2].map((i) =>
			kohakuClock(KOHAKU_CUE.at + i * KOHAKU_CUE.beat),
		);
		ok(pulses.join() === "00:00:03,00:00:02,00:00:01", `pulses ${pulses}`);
		ok(kohakuClock(E) === "00:00:00", `exact ${kohakuClock(E)}`);
		ok(
			kohakuClock(E + 1) === null && kohakuLeft(E + 500) === null,
			"after 0時",
		);
		ok(
			kohakuName(0, K_LIVE) === "新年まで＠04:45:00",
			`${kohakuName(0, K_LIVE)}`,
		);
		ok(kohakuName(E - 3000, K_REC) === "新年まで＠00:00:03", "rec name");
		ok(kohakuName(E - 1000, K_REHA) === "仮の0時まで＠00:00:01", "reha name");
		ok(kohakuName(E + 100, K_LIVE) === null, "a name after 0時");
	},
);

test(
	"K6",
	"おみくじの 名前欄：0時までの キリコの レスは 時計、山場の 判定の あとは 神エイム＝大吉・おしい＝吉・おくれた＝小吉・フライング＝まだ　去年や・見てただけ＝末吉",
	() => {
		const cases: [number | null, JkCueGrade][] = [
			[0, "kami"],
			[-320, "oshii"],
			[700, "late"],
			[-600, "flying"],
			[null, "none"],
		];
		for (const [off, want] of cases) {
			const p = playShow(K_LIVE, "kami", `k6:${off}`, {
				script: KOHAKU,
				keep: true,
				cue: () => off,
			});
			ok(p.result?.cue === want, `offset ${off}: ${p.result?.cue}`);
			const kg = p.log.findIndex((r) => r.ev.t === "grade");
			ok(kg > 0, `offset ${off}: no grade`);
			const mine = (from: number, to: number) =>
				p.log
					.slice(from, to)
					.flatMap((r) =>
						r.ev.t === "line" && r.ev.line.who === "me" ? [r.ev.line] : [],
					);
			const before = mine(0, kg);
			ok(
				before.length >= 5,
				`offset ${off}: ${before.length} lines before 0時`,
			);
			for (const l of before)
				ok(
					/^新年まで＠\d\d:\d\d:\d\d$/.test(l.name ?? ""),
					`offset ${off}: before "${l.name}"`,
				);
			const after = mine(kg, p.log.length);
			ok(after.length >= 2, `offset ${off}: ${after.length} lines after`);
			for (const l of after)
				ok(
					l.name === KOHAKU_NAMES[want],
					`offset ${off}: after "${l.name}" (${l.text})`,
				);
			const word = after.find((l) => l.text === KOHAKU_ART.akeome);
			ok(!!word === (off !== null), `offset ${off}: the word ${word?.text}`);
		}
	},
);

test(
	"K7",
	"審査：勝ち組は 乱数（9枚の うち 5〜6）、7割は はじめの 3枚が 勝ち組に 2対1、窓の ◎ は 勝ち組の 言いきり・× は 負け組、窓が 開いて 2秒で 5枚、閉じる 前に 9枚",
	() => {
		let lean = 0;
		const wins = { aka: 0, shiro: 0 };
		const N = 1000;
		for (let i = 0; i < N; i++) {
			const { winner, cards } = kohakuCards(seeded(`k7:${i}`));
			ok(cards.length === KOHAKU_CARDS, `${i}: ${cards.length} cards`);
			const w = cards.filter((c) => c === winner).length;
			ok(w === 5 || w === 6, `${i}: the winner has ${w}`);
			const f = cards.slice(0, 3).filter((c) => c === winner).length;
			ok(f === 2 || f === 1, `${i}: first three ${f}`);
			if (f === 2) lean++;
			wins[winner]++;
		}
		ok(lean / N >= 0.65 && lean / N <= 0.75, `lean ${lean / N}`);
		ok(
			wins.aka > N * 0.4 && wins.shiro > N * 0.4,
			`winners ${JSON.stringify(wins)}`,
		);
		for (const seed of ["k7:a", "k7:b", "k7:c", "k7:d", "k7:e"]) {
			const x = kohakuTl(K_LIVE, seed);
			const seg = x.segments.find((s) => s.scene === "shinsa");
			const d = seg?.data as KohakuData | undefined;
			const pick = x.picks.find(isShinsa);
			ok(d?.winner && d.cards && pick, `${seed}: no judging`);
			if (!d?.winner || !d.cards || !pick || d.countAt === undefined || !d.step)
				continue;
			const loser = d.winner === "aka" ? "shiro" : "aka";
			const set = pick.sets[0];
			ok(
				set.find((o) => o.fit === "best")?.text === KOHAKU_SAY[d.winner] &&
					set.find((o) => o.fit === "miss")?.text === KOHAKU_SAY[loser],
				`${seed}: ${set.map((o) => `${o.text}${o.fit}`)}`,
			);
			const { countAt, step } = d;
			const shownAt = (t: number) =>
				t < countAt
					? 0
					: Math.min(KOHAKU_CARDS, Math.floor((t - countAt) / step) + 1);
			ok(shownAt(pick.at) === 0, `${seed}: cards before the window`);
			ok(
				shownAt(pick.at + 2000) === 5,
				`${seed}: ${shownAt(pick.at + 2000)} at 2s`,
			);
			ok(
				shownAt(pick.at + (pick.open ?? 4000) - 1) === KOHAKU_CARDS,
				`${seed}: not all cards by the close`,
			);
		}
	},
);

test(
	"K8",
	"2つの 種で pick の 文が ちがう（pick の 1/3 以上）、◎ の 位置も まざる",
	() => {
		for (const slot of K_SLOTS) {
			const a = compileScript(KOHAKU, slot, seeded("k8:a")).tl.overlays;
			const b = compileScript(KOHAKU, slot, seeded("k8:b")).tl.overlays;
			const key = (w: (typeof a)[number]["win"]) =>
				w.type === "pick"
					? w.opts
							.map((o) => o.text)
							.sort()
							.join("|")
					: w.id;
			const diff = a.filter((o, i) => key(o.win) !== key(b[i].win)).length;
			const picks = a.filter((o) => o.win.type === "pick").length;
			ok(diff * 3 >= picks, `only ${diff}/${picks} picks differ`);
			const pos = new Set(
				a.flatMap((o) =>
					o.win.type === "pick"
						? [o.win.opts.findIndex((x) => x.fit === "best")]
						: [],
				),
			);
			ok(pos.size >= 2, "◎ is always at the same place");
		}
	},
);

test(
	"K9",
	"スレタイ：本番は スレごとに 回を 1つ 足し（第15回 → 第16回）、ことよろの 区切りの あとは 年越し→初日の出 ★n が ずっと。公開リハ・録画は その 名前。名前の すぐ かえは ない",
	() => {
		for (const slot of K_SLOTS) {
			const p = playShow(slot, "kami", `k9:${kTag(slot)}`, {
				script: KOHAKU,
				keep: true,
			});
			const first = p.log.find(
				(r) => r.ev.t === "line" && r.ev.line.cls === "title",
			);
			ok(
				first?.ev.t === "line" && first.ev.line.text === KOHAKU.title(1, slot),
				`${kTag(slot)}: first title ${first?.ev.t === "line" ? first.ev.line.text : ""}`,
			);
			ok(!p.log.some((r) => r.ev.t === "retitle"), `${kTag(slot)}: retitle`);
			const rolls = p.log.flatMap((r) =>
				r.ev.t === "roll"
					? [{ part: r.ev.part, title: r.ev.title, t: r.t ?? 0 }]
					: [],
			);
			ok(rolls.length >= 2, `${kTag(slot)}: ${rolls.length} rolls`);
			if (slot.live)
				ok(
					rolls.some((r) => r.t >= 109000),
					`${kTag(slot)}: no roll after the new year`,
				);
			for (const r of rolls) {
				const want =
					r.t >= 109000
						? (s: number) =>
								KOHAKU_THREAD[
									slot.live
										? "liveNew"
										: slot.mode === "rec"
											? "recNew"
											: "rehaNew"
								].replace("{n}", String(s))
						: (s: number) => KOHAKU.title(s, slot);
				ok(
					r.title === want(r.part),
					`${kTag(slot)}: roll ${r.part} at ${r.t}: ${r.title}`,
				);
			}
			if (slot.live) {
				const kai = kohakuKai(slot.y);
				ok(KOHAKU.title(1, slot).includes(`第${kai}回`), "kai 15");
				const early = rolls.find((r) => r.t < 107000);
				ok(
					early?.title.includes(`第${kai + early.part - 1}回`),
					`kai of ${early?.title}`,
				);
			}
		}
	},
);

test(
	"K10",
	"劇場の 舞台：12/31 は 本番（★5）・12/15 は 公開リハ（★3）・1/3 は 去年の 録画（★2）を 見るか 聞き、結果は 幕の 窓。6/15 は いつもの 文だけ。役者は 12月の 1行と 0時の 神エイムの あと 1回だけ",
	async () => {
		const f = facilityById("theater");
		if (!f?.room) throw new Fail("no theater");
		const actor = f.room.people?.find((p) => p.id === "theater_actor");
		if (!actor) throw new Fail("no theater_actor");
		const view: VillageView = {
			stage: TOWN_STAGES - 1,
			unlocked: ["shallow"],
			cleared: [],
		};
		const { store, restore } = swapStorage();
		let slot: JkSlot | null = null;
		let fake: JkResult | null = null;
		setWatchHook(async (_s, sl) => {
			slot = sl;
			return fake;
		});
		const year = new Date().getFullYear();
		const M = progMsg("kohaku");
		try {
			const days: [string, Today, JkSlot | null, number][] = [
				["1231", date(12, 31), { program: "kohaku", live: true, y: year }, 5],
				[
					"1215",
					date(12, 15),
					{ program: "kohaku", live: false, mode: "reha", y: year },
					3,
				],
				[
					"0103",
					date(1, 3),
					{ program: "kohaku", live: false, mode: "rec", y: year - 1 },
					2,
				],
				["0615", date(6, 15), null, 0],
			];
			for (const [q, t, want, goal] of days) {
				const loc = swapLocation(`?debug&date=${q}`);
				try {
					store.clear();
					forgetJikkyoMemo();
					slot = null;
					const events = buildFacility(f, view, {} as Ctx).events ?? [];
					const run = async (id: string, pick = 0) => {
						const r = recorder(pick);
						await events.find((e) => e.id === id)?.run?.(r.s);
						return r.log;
					};
					const stage = (
						venueLines("theater", "stage", t) ?? f.room.lines.stage
					).map((l) => `narrate: ${l}`);
					fake = resultFor(5600, {
						part: 6,
						part0: 1,
						kanso: true,
						cue: "kami",
					});
					const a = await run("stage_0");
					if (!want) {
						ok(a.join("\n") === stage.join("\n"), `${q}: ${a.join("|")}`);
						ok(slot === null, `${q}: a show`);
						continue;
					}
					const wantLog = [
						...stage,
						"choose",
						`narrate: ${M.howto.replace("{n}", String(goal))}`,
						`narrate: ${M.seat}`,
						`narrate: ${M.over.replace("{n}", "6")}`,
						`narrate: ${M.kanso}`,
						`narrate: ${M.kami}`,
					];
					ok(a.join("\n") === wantLog.join("\n"), `${q}:\n${a.join("\n")}`);
					ok(
						JSON.stringify(slot) === JSON.stringify(want),
						`${q}: slot ${JSON.stringify(slot)}`,
					);
					const sl = slot as JkSlot | null;
					ok(sl && scriptGoal(KOHAKU, sl) === goal, `${q}: goal`);
					// とちゅうで 出たら 幕の 窓
					fake = null;
					const b = await run("stage_0");
					ok(b.at(-1) === `narrate: ${M.left}`, `${q}: left ${b.at(-1)}`);
				} finally {
					loc();
				}
			}
			// 役者：12月の 1行 → 神エイムの あと 1回だけ → また 12月の 1行
			const loc = swapLocation("?debug&date=1215");
			try {
				forgetJikkyoMemo();
				const talk = async () => {
					const r = recorder();
					await buildFacility(f, view, {} as Ctx)
						.events?.find((e) => e.id === actor.id)
						?.run?.(r.s);
					return r.log.join("\n");
				};
				const dec = (staffLines("theater", actor.id, date(12, 15)) ?? [])
					.map((l) => `say: ${l}`)
					.join("\n");
				ok((await talk()) === dec, "no December line");
				recordProgram(
					"kohaku",
					resultFor(5100, { part: 6, kanso: true, cue: "kami" }),
					K_LIVE,
				);
				ok(
					(await talk()) === `say: ${STAFF_ONCE.theater?.theater_actor?.kami}`,
					"no kami line",
				);
				ok((await talk()) === dec, "the kami line twice");
			} finally {
				loc();
			}
		} finally {
			setWatchHook(null);
			forgetJikkyoMemo();
			restore();
		}
	},
);

/** kami・jouzu・shoshin・random の 上映（本番・公開リハ・録画 × 3 の 種。出来事を 残す）。 */
let kShowsCache: Shown[] | null = null;
const kShows = (): Shown[] => {
	kShowsCache ??= K_SLOTS.flatMap((slot) =>
		(["kami", "jouzu", "shoshin", "random"] as const).flatMap((b) =>
			Array.from({ length: 3 }, (_, i) =>
				playShow(slot, b, `kshow:${kTag(slot)}:${b}:${i}`, {
					keep: true,
					script: KOHAKU,
				}),
			),
		),
	);
	return kShowsCache;
};

const KOHAKU_SET: ShowSet = {
	script: KOHAKU,
	slots: K_SLOTS,
	list: kShows,
	get1000: KOHAKU_THREAD.get1000,
	flood: KOHAKU_POOLS.flood,
	miruSeed: (slot) => `k11:${kTag(slot)}`,
};

test(
	"K11",
	"950 の 当番（紅白）：上映ごとに 2回まで・0時の 山場の 前後 6秒と 次の 窓の 4.5秒 以内に 出ない・切れ目の 長さ・見るだけでも 1回は 出る",
	() => checkDuty(KOHAKU_SET),
);

test(
	"K12",
	"番号（紅白）：1000・1001 の ほかに 1000 以上は なく、キリコは 999 まで、999 は 1つ、roll の あとは >>1 から",
	() => checkNumbers(KOHAKU_SET),
);

test(
	"K13",
	"窓が 開いて いる あいだ その 候補の 文は 群衆に 出ず、直近 4行に 同じ 文が ない（紅白）",
	() => checkRepeats(KOHAKU_SET),
);

test(
	"D2",
	"番組表：劇場は 段7 から、12/31 本番・12/1〜30 公開リハ・1/1〜7 録画（去年）、ほかの 日は 番組なし",
	() => {
		for (const [t, mode] of THEATER_DAYS) {
			const at = `${t.m}/${t.d}`;
			const s = programSlot("theater", t, 7, 2026);
			ok(
				programSlot("theater", t, 6, 2026) === null,
				`${at}: theater at stage 6`,
			);
			if (mode === null) {
				ok(s === null, `${at}: ${JSON.stringify(s)}`);
				continue;
			}
			const want: JkSlot =
				mode === "live"
					? { program: "kohaku", live: true, y: 2026 }
					: mode === "reha"
						? { program: "kohaku", live: false, mode: "reha", y: 2026 }
						: { program: "kohaku", live: false, mode: "rec", y: 2025 };
			ok(
				JSON.stringify(s?.main) === JSON.stringify(want),
				`${at}: ${JSON.stringify(s)}`,
			);
			ok(
				scriptGoal(KOHAKU, want) === { live: 5, reha: 3, rec: 2 }[mode],
				`${at}: goal`,
			);
		}
		ok(PROGRAMS.kohaku === KOHAKU, "kohaku is not in PROGRAMS");
		// 映画館と 本館は 12月も かわらない
		ok(
			programSlot("cinema", date(12, 31), 7, 2026)?.main.program === "sora",
			"cinema on 12/31",
		);
		ok(
			programSlot("hall", date(12, 31), 7, 2026)?.main.program === "yakyu",
			"hall on 12/31",
		);
	},
);

// ───────────────── G 議会中継（見るだけ） ─────────────────

/** 1話を 最後まで（入力なし）か、quitAt ms で B 1回。 */
const runGikai = (
	ep: GikaiEpisode,
	o: { onchan: boolean; rerun: boolean },
	seed: number,
	quitAt?: number,
) => {
	const { tl, rules, pools } = gikaiProgram(ep, { ...o, place: "cityhall" });
	const r = Rng.fromSeed(`gikai:${seed}`);
	const st = jkStart(tl, rules, pools, { rand: () => r.float() });
	const evs: JkEv[] = [];
	let t = 0;
	for (let k = 0; k < 4000 && !st.ended; k++) {
		const input: JkInput | undefined =
			quitAt !== undefined && t >= quitAt ? { quit: true } : undefined;
		evs.push(...jkStep(st, 100, input));
		t += 100;
	}
	return { st, evs };
};

test(
	"G1",
	"議会中継：窓を 出さず（open なし）、議長・住人・名無しの 発言が 台本の 順に 2行で 流れ、ヤジは 1回ずつ、最後まで 流れて 終わる。B 1回で 閉じる",
	() => {
		for (const ep of GIKAI_EPISODES)
			for (const onchan of [true, false])
				for (const rerun of [false, true]) {
					const { st, evs } = runGikai(ep, { onchan, rerun }, ep.id.length);
					ok(st.ended && jkResult(st) !== null, `${ep.id}: did not finish`);
					ok(!evs.some((e) => e.t === "open"), `${ep.id}: a window opened`);
					const lines = evs.flatMap((e) =>
						e.t === "line" || e.t === "pin" ? [e.line] : [],
					);
					const want = [
						...GIKAI_OPEN,
						...(rerun ? [{ who: "res" as const, text: GIKAI_RERUN }] : []),
						...ep.lines,
						...GIKAI_CLOSE,
					].map((l) =>
						l.who === "chair" && !onchan ? (l.plain ?? l.text) : l.text,
					);
					// 台本の 発言は ぜんぶ 順に 出る（あいだに ヤジ）
					let k = 0;
					for (const l of lines) if (l.text === want[k]) k++;
					ok(
						k === want.length,
						`${ep.id} onchan ${onchan}: posted ${k}/${want.length}`,
					);
					// 議長は 名無しなら 口ぐせの「おん」なし
					if (!onchan)
						ok(
							!lines.some(
								(l) => l.who === "chair" && /おん$|だおん/.test(l.text),
							),
							`${ep.id}: the nanashi chair talks like onchan`,
						);
					// ヤジは 1回ずつ・ほかの 話し手は 台本の 住人と 議長
					const yaji = lines.filter((l) => GIKAI_YAJI.includes(l.text));
					ok(
						new Set(yaji.map((l) => l.text)).size === yaji.length,
						`${ep.id}: a heckle twice`,
					);
					for (const l of lines)
						ok(
							["nanashi", "chair", "sys"].includes(l.who) ||
								(l.who.startsWith("cast:") &&
									[...ep.cast, "roze"].includes(l.who.slice(5))),
							`${ep.id}: ${l.who} speaks`,
						);
					// 数は 1000 に 届かない（見た目だけ）
					ok(st.part === st.part0 && jkView(st).no < 999, `${ep.id}: rolled`);
				}
		// B 1回で 閉じる（ノートなし）
		const { st, evs } = runGikai(
			GIKAI_EPISODES[0],
			{ onchan: true, rerun: false },
			3,
			5000,
		);
		ok(st.ended && jkResult(st) === null, "B did not close");
		ok(!evs.some((e) => e.t === "note"), "B asked twice");
		// 窓の ある 見るだけの 番組は 作れない
		const bad = gikaiProgram(GIKAI_EPISODES[0], {
			onchan: true,
			rerun: false,
			place: "cityhall",
		});
		let threw = false;
		try {
			jkStart(
				{
					...bad.tl,
					overlays: [
						{
							at: 1000,
							win: {
								type: "pick",
								id: "x",
								opts: [{ text: "a", fit: "best" }],
								open: 4000,
								weight: 1,
							},
						},
					],
				},
				bad.rules,
				bad.pools,
				{ rand: () => 0.5 },
			);
		} catch {
			threw = true;
		}
		ok(threw, "a view-only program with a window started");
	},
);

test(
	"G2",
	"議会中継の 話：1回の 帰りに 新しい 話 1つ（同じ 帰りなら 同じ）、全部 見たら 再放送、出る 住人が そろって いる 話だけ。書きこみは 18字 × 2行、やきうは 出ない",
	() => {
		const all = [...new Set(GIKAI_EPISODES.flatMap((e) => e.cast))];
		let memo: GikaiMemo = { seen: [], at: -1 };
		const order: string[] = [];
		for (let at = 1; at <= GIKAI_EPISODES.length; at++) {
			const got = gikaiEpisodeFor(memo, at, all);
			ok(got && !got.rerun, `return ${at}: ${JSON.stringify(got)}`);
			if (!got) continue;
			order.push(got.ep.id);
			memo = gikaiWatched(memo, at, got.ep, got.rerun);
			const again = gikaiEpisodeFor(memo, at, all);
			ok(
				again?.ep.id === got.ep.id,
				`return ${at}: changed in the same return`,
			);
		}
		ok(new Set(order).size === GIKAI_EPISODES.length, `episodes ${order}`);
		const re = gikaiEpisodeFor(memo, 99, all);
		ok(re?.rerun === true, "no rerun after all");
		// 段4 の 住人だけ（おんちゃん・ジェイトルマン・レン・アル・ミャウミャウ・ヤヤポジ は まだ）
		const early: MobId[] = [
			"nichie",
			"panmatsu",
			"ngoane",
			"mujje",
			"proto",
			"hinary",
			"onsu",
			"asakonro",
		];
		const ok4 = GIKAI_EPISODES.filter((e) => gikaiAvailable(e, early)).map(
			(e) => e.id,
		);
		ok(ok4.join() === "toban,mabo,rom", `stage 4 episodes ${ok4}`);
		ok(
			gikaiEpisodeFor({ seen: [], at: -1 }, 1, []) === null,
			"an episode with nobody",
		);
		// 書きこみの 幅・やきうは 出ない
		const texts = [
			...GIKAI_OPEN,
			...GIKAI_CLOSE,
			...GIKAI_EPISODES.flatMap((e) => e.lines),
		].flatMap((l) => [l.text, ...(l.plain ? [l.plain] : [])]);
		for (const t of [...texts, GIKAI_RERUN, ...GIKAI_YAJI]) {
			const ls = t.split("\n");
			ok(ls.length <= 2, `"${t}": ${ls.length} lines`);
			for (const l of ls) ok(width(l) <= 18, `"${l}" is ${width(l)} wide`);
			ok(!t.includes("やきう"), `"${t}" has やきう`);
		}
		for (const e of GIKAI_EPISODES) {
			ok(
				!e.cast.some((c) => (c as string) === "nanj"),
				`${e.id}: やきう in the cast`,
			);
			fitsWindow(`${e.id} pitch`, e.pitch);
			fitsWindow(`${e.id} on`, GIKAI_TEXT.on.replace("{title}", e.title));
			fitsWindow(
				`${e.id} rerun`,
				GIKAI_TEXT.onRerun.replace("{title}", e.title),
			);
			for (const l of e.lines)
				if (l.who !== "chair" && l.who !== "res" && l.who !== "roze")
					ok(e.cast.includes(l.who), `${e.id}: ${l.who} is not in the cast`);
		}
		for (const t of [GIKAI_TEXT.hallOn, GIKAI_TEXT.record, GIKAI_TEXT.closed])
			fitsWindow("gikai", t);
		for (const p of ["townhall", "cityhall"] as const)
			ok(width(GIKAI_TEXT.title[p]) <= 22, `title ${p}`);
	},
);

test(
	"D3",
	"番組表：本館は 段6〜 の 月曜だけ 議会中継（チャンネルを かえると ナイター）、町役場（段4〜6）・市役所（段7）は 議会の 日だけ",
	() => {
		for (const w of WEEK) {
			const h = programSlot("hall", day(w), 7, 2026);
			if (w === 1)
				ok(
					h?.main.program === "gikai" && h.alt?.program === "yakyu",
					`Monday hall ${JSON.stringify(h)}`,
				);
			else ok(h?.main.program === "yakyu" && !h.alt, `wday ${w} hall`);
		}
		for (let stage = 0; stage < TOWN_STAGES; stage++)
			for (const session of [true, false]) {
				const th = programSlot("townhall", day(3), stage, 2026, { session });
				const ch = programSlot("cityhall", day(3), stage, 2026, { session });
				ok(
					(th?.main.program === "gikai") ===
						(session && stage >= 4 && stage < 7),
					`townhall ${stage} ${session}`,
				);
				ok(
					(ch?.main.program === "gikai") === (session && stage >= 7),
					`cityhall ${stage} ${session}`,
				);
			}
		ok(isVenue("townhall") && isVenue("cityhall"), "civic venues");
	},
);

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
