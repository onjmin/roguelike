// 束の 番組（data/jikkyo/packs.ts。銭湯の 大相撲・カジノの 競馬 ほか）の 試験。どの 番組にも 同じ 試験を かける。
// 映画館の『空飛ぶ鯖』（S 節）・劇場の 紅白（K 節）は src/sim/jikkyoTests.ts の まま。道具も そこから 借りる。
// - P1 時間割・P2 文・P3 番組表と 会場・P4 帯・P5 950 の 当番と 切れ目・P6 番号と 繰りかえし・P7 TV・P8 入口。
// - 作りかけ（draft）の 番組は 形だけ（P1・P2・P3・P7）。帯（P4）と 当番（P5）と 番号（P6）と 入口（P8）は 見ない。
// - 1つの 番組だけ 回すには 環境の JK_ONLY=sumo（, で いくつか）。scripts/test-jikkyo.mjs は この 節だけ 回す。

import { compileScript, type JkResult, type JkSlot } from "../core/jikkyo";
import { TOWN_STAGES } from "../core/town";
import type { Today } from "../data/calendar";
import type { JkPack } from "../data/jikkyo/pack";
import { PACKS } from "../data/jikkyo/packs";
import { packOpen, programSlots } from "../data/jikkyo/schedule";
import {
	JK_PROG_MSG,
	progMsg,
	staffLines,
	venueLines,
} from "../data/jikkyo/text";
import { FACILITIES } from "../data/village/facilities";
import { isRoom, roomPlaces } from "../data/village/rooms";
import { forgetJikkyoMemo } from "../ui/jikkyo";
import { PROGRAM_TVS } from "../ui/jikkyoTvs";
import { setWatchHook, watchProgram } from "../ui/jikkyoWatch";
import type { UiCtx } from "../ui/list";
import {
	type BotName,
	checkDuty,
	checkNumbers,
	checkRepeats,
	fitsWindow,
	HOSHU_NAMES,
	longRun,
	NG_NAMES,
	playShow,
	recorder,
	resultFor,
	type Shown,
	type ShowSet,
	seeded,
	stubCanvas,
	swapLocation,
	swapStorage,
	width,
} from "./jikkyoTests";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

/** JK_ONLY（, で 区切った 番組の id）が あれば その 番組だけ。 */
const only = (): Set<string> | null => {
	const v = (
		globalThis as { process?: { env?: Record<string, string | undefined> } }
	).process?.env?.JK_ONLY;
	return v ? new Set(v.split(",").map((x) => x.trim())) : null;
};

const packs = (): readonly JkPack[] => {
	const o = only();
	return o ? PACKS.filter((p) => o.has(p.script.id)) : PACKS;
};

/** 2026年の 日（曜日つき）。 */
const dayOf = (m: number, d: number): Today => ({
	m,
	d,
	w: new Date(2026, m - 1, d).getDay(),
});
const YEAR: readonly Today[] = Array.from(
	{ length: 12 },
	(_, i) => i + 1,
).flatMap((m) =>
	Array.from({ length: new Date(2026, m, 0).getDate() }, (_, i) =>
		dayOf(m, i + 1),
	),
);

/** 本番の 日と 再放送の 日（1つずつ。無ければ null）。 */
const daysOf = (p: JkPack): { live: Today | null; rerun: Today | null } => ({
	live: YEAR.find((t) => p.slot(t)?.live) ?? null,
	rerun: YEAR.find((t) => p.slot(t) && !p.slot(t)?.live) ?? null,
});

/** 番組の 枠（本番・再放送。年は 2026）。 */
const slotsOf = (p: JkPack): JkSlot[] => {
	const out: JkSlot[] = [];
	const seen = new Set<string>();
	for (const t of YEAR) {
		const s = p.slot(t);
		if (!s) continue;
		const key = `${s.live}:${s.mode ?? ""}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ program: p.script.id, y: 2026, ...s });
	}
	return out;
};

const CASES: { id: string; name: string; run: () => void | Promise<void> }[] =
	[];
/** 番組ごとの 試験（P1 sumo など）。draftOk なら 作りかけでも 回す。 */
const each = (
	id: string,
	name: string,
	draftOk: boolean,
	run: (p: JkPack) => void | Promise<void>,
) => {
	for (const p of packs())
		if (draftOk || !p.draft)
			CASES.push({
				id: `${id} ${p.script.id}`,
				name,
				run: () => run(p),
			});
};

const TRAPS = [/今北産業/, /確率【\d+】%/, /が一言↓/];

// ───────────────── P1 時間割 ─────────────────

each(
	"P1",
	"時間割：区切りが 0 から 並び 160秒 以内・場面は 絵の 鍵・組は ◎ 1つの 2〜3択・窓と 山場が 重ならない・釣り札 2つまで・× の 半分 以上は 別の 時の ◎",
	true,
	(p) => {
		const S = p.script;
		ok(S.id === p.script.id && S.venue === p.venue, "id or venue");
		ok(S.length <= 160000, `length ${S.length}`);
		const slots = slotsOf(p);
		ok(slots.length > 0, "no day has a slot");
		const bests = new Set<string>();
		const misses: string[] = [];
		const words = new Set<string>();
		let traps = 0;
		let picks = 0;
		let multi = 0;
		for (const slot of slots)
			for (const seed of ["p1:a", "p1:b", "p1:c", "p1:d"]) {
				const x = S.timeline(seeded(seed), slot);
				const at = x.segments.map((s) => s.at);
				ok(at[0] === 0, "the first segment is not at 0");
				ok(
					at.every((a, i) => i === 0 || a > at[i - 1]),
					`segments out of order: ${at}`,
				);
				ok(
					at.every((a) => a < S.length),
					"a segment past the end",
				);
				for (const s of x.segments)
					ok(p.scenes.includes(s.scene), `scene ${s.scene} is not in scenes`);
				const wins: [number, number][] = [];
				for (const pk of x.picks) {
					picks++;
					if (pk.sets.length >= 2) multi++;
					ok(pk.sets.length >= 1 && pk.sets.length <= 3, `${pk.at}: sets`);
					for (const set of pk.sets) {
						ok(
							set.length >= 2 && set.length <= 3,
							`${pk.at}: ${set.length} options`,
						);
						const nb = set.filter((o) => o.fit === "best").length;
						ok(
							pk.timeoutFit ? nb <= 1 : nb === 1,
							`${pk.at}: ${nb} ◎ in a set`,
						);
						ok(
							new Set(set.map((o) => o.text)).size === set.length,
							`${pk.at}: same text twice`,
						);
						if (set.some((o) => TRAPS.some((t) => t.test(o.text)))) traps++;
						for (const o of set) {
							if (o.fit === "best") bests.add(o.text);
							if (o.fit === "miss") misses.push(o.text);
						}
					}
					ok(pk.at >= 0 && pk.at < S.length, `pick at ${pk.at}`);
					wins.push([pk.at, pk.at + (pk.open ?? 4000) + 800]);
				}
				for (const c of x.cues) {
					words.add(c.word);
					ok(c.pulses >= 2 && c.beat >= 400, `cue at ${c.at}`);
					wins.push([c.at, c.at + (c.pulses + 1.5) * c.beat]);
				}
				wins.sort((a, b) => a[0] - b[0]);
				for (let i = 1; i < wins.length; i++)
					ok(wins[i][0] >= wins[i - 1][1], `windows overlap at ${wins[i][0]}`);
				const { tl } = compileScript(S, slot, seeded(seed));
				ok(tl.total === S.length, "total");
			}
		ok(multi * 2 >= picks, `only ${multi}/${picks} picks have 2+ sets`);
		ok(traps / (slots.length * 4) <= 2, `traps ${traps}`);
		const elsewhere = misses.filter((t) => bests.has(t) || words.has(t));
		ok(
			p.draft || elsewhere.length * 2 >= misses.length,
			`× that are ◎ elsewhere: ${elsewhere.length}/${misses.length}`,
		);
	},
);

// ───────────────── P2 文 ─────────────────

/** 番組の 文（種類ごと）。 */
const textsOf = (p: JkPack) => {
	const S = p.script;
	const fillN = (s: string) =>
		s.replaceAll("{n}", "999").replaceAll("{m}", "13");
	const slots = slotsOf(p);
	const tls = slots.flatMap((slot) =>
		["w:a", "w:b", "w:c"].map((seed) => S.timeline(seeded(seed), slot)),
	);
	const opts = [
		...tls.flatMap((x) =>
			x.picks.flatMap((pk) => pk.sets.flatMap((s) => s.map((o) => o.text))),
		),
		...S.duty.first.map((o) => o.text),
		...S.duty.variants.flatMap((v) => v.opts.map((o) => o.text)),
		...tls.flatMap((x) => x.cues.map((c) => c.word)),
	];
	const crowd = Object.values(S.pools).flatMap((l) => l.map(fillN));
	const titles = [1, 2, 5, 12].flatMap((n) =>
		slots.flatMap((slot) => [
			S.title(n, slot),
			...(S.label ? [S.label(n, slot)] : []),
			...tls.flatMap((x) =>
				x.segments.flatMap((s) =>
					[s.title?.now, s.title?.next, s.title?.later].flatMap((f) =>
						f ? [f(n, slot)] : [],
					),
				),
			),
		]),
	);
	const short = [
		...tls.flatMap((x) =>
			x.segments.flatMap((s) => [
				...(s.caption ? [s.caption] : []),
				...(s.pin ? [s.pin] : []),
				...(s.posts ?? []).map((q) => q.text),
				...(s.react ?? []).flatMap((r) => (r.text ? [r.text] : [])),
			]),
		),
		...tls.flatMap((x) =>
			x.cues.flatMap((c) => [
				...(c.praise ? [fillN(c.praise)] : []),
				...(c.cross ? [c.cross.gap, c.cross.fresh] : []),
				...Object.values(c.names ?? {}),
			]),
		),
		...[S.duty.pin, ...S.duty.variants.map((v) => v.pin)].map(fillN),
		...(p.art ?? []).map(fillN),
		...slots.flatMap((slot) => [S.at1000(1, slot), S.at1000(12, slot)]),
		S.quitNote,
		...(S.name
			? slots.flatMap((slot) =>
					[0, 1000, 30000, S.length - 1].map((t) => S.name?.(t, slot) ?? ""),
				)
			: []),
	];
	const venue = [
		...Object.values(p.venueLines ?? {}).flatMap((d) =>
			d.flatMap((r) => r.lines),
		),
		...Object.values(p.staffLines ?? {}).flatMap((d) =>
			d.flatMap((r) => r.lines),
		),
		...Object.values(p.staffOnce ?? {}).flatMap((o) =>
			Object.values(o).map((t) => (t ?? "").replace("{n}", "12")),
		),
		...Object.values(p.msgs ?? {}).map((t) => (t ?? "").replace("{n}", "12")),
	];
	return { opts: [...new Set(opts)], crowd, titles, short, venue };
};

each(
	"P2",
	"文：レス 12・候補 10・スレタイ・字幕・pin・絵の 字 22・会場と 村の 窓 22×2・選ぶ 名前 10、分かち書き、実在の 名前なし、キリコの 候補に「保守」なし、「保守」は 固有名詞の 中だけ、{…} の 埋めのこし なし",
	true,
	(p) => {
		const { opts, crowd, titles, short, venue } = textsOf(p);
		for (const t of crowd) ok(width(t) <= 12, `res "${t}" is ${width(t)} wide`);
		for (const t of opts) ok(width(t) <= 10, `option "${t}" is ${width(t)}`);
		for (const t of [...titles, ...short])
			ok(width(t) <= 22, `"${t}" is ${width(t)} wide`);
		for (const t of venue) fitsWindow(`${p.script.id} venue`, t);
		ok(width(p.menu) <= 10, `menu "${p.menu}" is ${width(p.menu)}`);
		for (const t of [...crowd, ...opts]) {
			const run = longRun(t);
			ok(run === null, `"${t}": write "${run}" with a full-width space`);
		}
		const names = [...HOSHU_NAMES, ...(p.names ?? [])].sort(
			(a, b) => b.length - a.length,
		);
		const deny = [...NG_NAMES, ...(p.deny ?? [])];
		for (const t of [
			...opts,
			...crowd,
			...titles,
			...short,
			...venue,
			p.menu,
		]) {
			ok(!/[{}]/.test(t), `an unfilled {…} in ${t}`);
			// 番組の 固有名詞（保守名人戦 など）を のぞいた 文で 見る（deny に「名人戦」を 入れても「保守名人戦」は 通る）
			const bare = names.reduce((s, n) => s.replaceAll(n, "　"), t);
			for (const ng of deny) ok(!bare.includes(ng), `"${ng}" in ${t}`);
			ok(!bare.includes("保守"), `a bare 保守 in ${t}`);
			ok(!t.includes("バルス"), `バルス in ${t}`);
		}
		for (const t of opts)
			for (const w of ["保守", "立てといた", "立てたる", "立てたで"])
				ok(!t.includes(w), `Kiriko can write "${w}": ${t}`);
		for (const n of p.names ?? [])
			ok(n.includes("保守"), `name "${n}" has no 保守`);
		// 村の 窓（束の 上書き つき）
		const M = progMsg(p.script.id);
		ok(M.menu.join() === JK_PROG_MSG.menu.join(), "menu");
		for (const [k, t] of Object.entries(M))
			if (k !== "menu")
				fitsWindow(`${p.script.id} ${k}`, String(t).replace("{n}", "12"));
	},
);

// ───────────────── P3 番組表と 会場 ─────────────────

/** 会場で 調べる 物（施設の 部屋の 遊び・外の 物・部屋の テレビ）が あるか。 */
const hasVenue = (venue: string): boolean => {
	const f = FACILITIES.find((x) => x.id === venue);
	if (f)
		return (
			Object.values(f.room?.plays ?? {}).includes("jikkyo") ||
			(f.outdoor ?? []).some((t) => t.play === "jikkyo")
		);
	if (isRoom(venue))
		return roomPlaces(venue).some((q) => q.id.startsWith("tv_"));
	return false;
};

/** 会場が 建つ 段（施設の from。部屋は ROOM_FROM を 見ない：束の from を 信じる）。 */
const venueFrom = (venue: string): number =>
	FACILITIES.find((x) => x.id === venue)?.from ?? 0;

each(
	"P3",
	"番組表：本番の 日が 1日 以上・会場に 実況の 物が あり、会場が 建つ 段 以上で、段の 手前と 作りかけでは 出ない",
	true,
	(p) => {
		ok(hasVenue(p.venue), `${p.venue} has no jikkyo thing`);
		ok(p.from >= venueFrom(p.venue), `from ${p.from} < the venue`);
		const { live } = daysOf(p);
		ok(live, "no live day in the year");
		for (const t of YEAR) {
			const s = p.slot(t);
			if (s) ok(s.y === undefined || s.y >= 2000, `${t.m}/${t.d}: y ${s.y}`);
		}
		const t = live ?? dayOf(1, 1);
		const has = (stage: number) =>
			programSlots(p.venue, t, stage, 2026).some(
				(s) => s.program === p.script.id,
			);
		if (p.from > 0) ok(!has(p.from - 1), "shown before the stage");
		ok(
			has(TOWN_STAGES - 1) === packOpen(p, TOWN_STAGES - 1),
			"open at the top",
		);
		if (p.draft) ok(!has(TOWN_STAGES - 1), "a draft is shown");
		// 束の 会場の 文は その 日に だけ 出る（作りかけは 出さない）
		for (const [kind, d] of Object.entries(p.venueLines ?? {}))
			for (const r of d) {
				const day = YEAR.find((x) => r.when(x));
				if (!day || p.draft) continue;
				ok(venueLines(p.venue, kind, day, 2026), `${kind}: no line on a day`);
			}
		for (const [who, d] of Object.entries(p.staffLines ?? {}))
			for (const r of d) {
				const day = YEAR.find((x) => r.when(x));
				if (!day || p.draft) continue;
				ok(staffLines(p.venue, who, day, 2026), `${who}: no line on a day`);
			}
	},
);

// ───────────────── P4 帯 ─────────────────

const N: Partial<Record<BotName, number>> = {
	kami: 16,
	jouzu: 160,
	shoshin: 160,
	random: 80,
	miru: 10,
};

each(
	"P4",
	"帯（本番・再放送、種つきの ボット）：番組の bands の はばに 入る（上手と 初心者の 完走・見るだけ と 神の 中央・random の 完走）",
	false,
	(p) => {
		const B = p.script.bands;
		ok(
			B.kanso?.jouzu && B.kanso.shoshin && B.p50?.miru,
			"bands need kanso.jouzu・kanso.shoshin・p50.miru",
		);
		const out: string[] = [];
		const bad: string[] = [];
		for (const slot of slotsOf(p))
			for (const [bot, n] of Object.entries(N) as [BotName, number][]) {
				const rs: number[] = [];
				let done = 0;
				for (let i = 0; i < n; i++) {
					const r = playShow(slot, bot, `p4:${slot.live}:${bot}:${i}`, {
						script: p.script,
					});
					rs.push((r.result?.res ?? 0) / r.G);
					if (r.result?.kanso) done++;
				}
				rs.sort((a, b) => a - b);
				const p50 = rs[Math.floor(rs.length / 2)];
				const k = done / n;
				const tag = `${slot.live ? "L" : "R"} ${bot} ${(k * 100).toFixed(0)}% ${p50.toFixed(3)}`;
				out.push(tag);
				const kb = B.kanso?.[bot];
				const pb = B.p50?.[bot];
				if (kb && !(k >= kb[0] && k <= kb[1])) bad.push(`${tag} kanso ∉ ${kb}`);
				if (pb && !(p50 >= pb[0] && p50 <= pb[1]))
					bad.push(`${tag} p50 ∉ ${pb}`);
			}
		ok(bad.length === 0, `${bad.join("; ")} (all: ${out.join(", ")})`);
	},
);

// ───────────────── P5・P6 当番・番号・繰りかえし ─────────────────

const showsCache = new Map<string, Shown[]>();
const setOf = (p: JkPack): ShowSet => {
	const slots = slotsOf(p);
	const S = p.script;
	const flood = [
		...new Set(
			slots.flatMap((slot) =>
				S.timeline(seeded("f"), slot).cues.flatMap(
					(c) => S.pools[c.flood] ?? [],
				),
			),
		),
	];
	return {
		script: S,
		slots,
		list: () => {
			let v = showsCache.get(S.id);
			if (!v) {
				v = slots.flatMap((slot) =>
					(["kami", "jouzu", "shoshin", "random"] as const).flatMap((b) =>
						Array.from({ length: 4 }, (_, i) =>
							playShow(slot, b, `show:${S.id}:${slot.live}:${b}:${i}`, {
								keep: true,
								script: S,
							}),
						),
					),
				);
				showsCache.set(S.id, v);
			}
			return v;
		},
		get1000: S.at1000(1, slots[0]),
		flood,
		miruSeed: (slot) => `p5:${S.id}:${slot.live}`,
	};
};

each(
	"P5",
	"950 の 当番：上映ごとに 2回まで・山場の 前後 6秒と 次の 窓の 4.5秒 以内に 出ない・切れ目の 長さ・見るだけでも 1回は 出る",
	false,
	(p) => checkDuty(setOf(p)),
);

each(
	"P6",
	"番号（1000・1001 の ほかに 1000 以上なし・キリコは 999 まで）と、窓の 候補を 群衆が 書かない・同じ 行の 繰りかえし なし",
	false,
	(p) => {
		const set = setOf(p);
		checkNumbers(set);
		checkRepeats(set);
	},
);

// ───────────────── P7 TV ─────────────────

/** 描く だけの canvas（stubCanvas の 2d を 返す）。 */
const fakeCanvas = () => {
	const { g, calls } = stubCanvas();
	const canvas = {
		width: 0,
		height: 0,
		getContext: () => g,
	} as unknown as HTMLCanvasElement;
	return { canvas, calls };
};

each(
	"P7",
	"TV：場面の 鍵を ぜんぶ 描ける・どの 区切りでも 投げない（本番・再放送 × 動きを へらす 設定）",
	true,
	(p) => {
		const tv = PROGRAM_TVS[p.script.id] as
			| (((...a: never[]) => unknown) & { scenes?: readonly string[] })
			| undefined;
		ok(tv, "no TV in PROGRAM_TVS");
		if (tv?.scenes)
			for (const k of p.scenes)
				ok(tv.scenes.includes(k), `the TV cannot draw ${k}`);
		for (const slot of slotsOf(p))
			for (const reduced of [false, true]) {
				const { canvas, calls } = fakeCanvas();
				const make = PROGRAM_TVS[p.script.id];
				if (!make) continue;
				const t = make(canvas, { reduced, live: slot.live });
				const { tl, rules, pools } = compileScript(
					p.script,
					slot,
					seeded("tv"),
				);
				void rules;
				void pools;
				let now = 1000;
				for (const seg of tl.segs)
					for (const dt of [0, 400, seg.dur / 2, Math.max(0, seg.dur - 50)]) {
						now += 137;
						const v = {
							seg,
							t: seg.start + dt,
							total: tl.total,
							ended: false,
							flood: dt > 0,
							win: null,
						} as unknown as Parameters<typeof t.draw>[1];
						t.onEv({ t: "pulse" } as never, now);
						t.draw(now, v);
					}
				ok(calls.length > 0, "nothing was drawn");
			}
	},
);

// ───────────────── P8 入口 ─────────────────

each(
	"P8",
	"入口：本番の 日に 会場で 見る → 遊び方（はじめて だけ）→ 席の 文 → 結果の 窓、やめると 何も しない",
	false,
	async (p) => {
		const { live } = daysOf(p);
		if (!live) throw new Fail("no live day");
		const { restore } = swapStorage();
		const mmdd = `${String(live.m).padStart(2, "0")}${String(live.d).padStart(2, "0")}`;
		const loc = swapLocation(`?debug&date=${mmdd}&wday=${live.w}`);
		let slot: JkSlot | null = null;
		let fake: JkResult | null = resultFor(4321, {
			part: 5,
			part0: 1,
			kanso: true,
		});
		setWatchHook(async (_s, sl) => {
			slot = sl;
			return fake;
		});
		try {
			forgetJikkyoMemo();
			const stage = TOWN_STAGES - 1;
			const slots = programSlots(
				p.venue,
				live,
				stage,
				new Date().getFullYear(),
			);
			const k = slots.findIndex((s) => s.program === p.script.id);
			ok(k >= 0, `not on the live day ${mmdd}`);
			// 番組が 2つ 以上 なら 選ぶ 窓で その 番組を、1つなら「見る」を
			const pickAt = slots.length > 1 ? k : 0;
			const r = recorder(pickAt);
			await watchProgram({} as UiCtx, r.s, p.venue, stage);
			const M = progMsg(p.script.id);
			const sl = slot as JkSlot | null;
			ok(sl?.program === p.script.id && sl.live, `slot ${JSON.stringify(sl)}`);
			ok(
				r.log.some((l) => l.startsWith(`narrate: ${M.howto.slice(0, 8)}`)),
				`no howto: ${r.log.join("|")}`,
			);
			ok(r.log.includes(`narrate: ${M.seat}`), `no seat: ${r.log.join("|")}`);
			ok(
				r.log.includes(`narrate: ${M.over.replace("{n}", "5")}`),
				`no over: ${r.log.join("|")}`,
			);
			// 2回目は 遊び方なし、途中で 出たら 1窓
			fake = null;
			const r2 = recorder(pickAt);
			await watchProgram({} as UiCtx, r2.s, p.venue, stage);
			ok(
				!r2.log.some((l) => l.startsWith(`narrate: ${M.howto.slice(0, 8)}`)),
				"howto twice",
			);
			ok(r2.log.at(-1) === `narrate: ${M.left}`, `left: ${r2.log.at(-1)}`);
			// やめる（選ぶ 窓の いちばん 下）
			slot = null;
			const r3 = recorder(slots.length > 1 ? slots.length : 1);
			await watchProgram({} as UiCtx, r3.s, p.venue, stage);
			ok(
				slot === null && r3.log.at(-1) === "choose",
				`quit: ${r3.log.join("|")}`,
			);
		} finally {
			setWatchHook(null);
			forgetJikkyoMemo();
			loc();
			restore();
		}
	},
);

export const runJikkyoProgTests = async (): Promise<TestResult[]> => {
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
