// 実況の 番組の 試験（pnpm test で いっしょに 動く）。
// いまは A 節：映画館の 演出（曜日で かわる 会場の 文・スクリーンと 客席の 飾り。data/jikkyo/text.ts・ui/cinemaDecor.ts）。
// 形は townTests と 同じ（Fail・ok・{ id, name, ok, reason }）。id の 頭は 節の 字。

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
