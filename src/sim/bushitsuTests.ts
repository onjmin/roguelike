// 部室棟の 試験（pnpm test で いっしょに 動く。spec-bushitsu §9）。形は civicTests と 同じ（Fail・ok・{ id, name, ok, reason }）。
// B1〜B5：置き場所・部屋・絵・人の 歩行グラ。B6：文の 幅と 使わない 語。B7〜B9：ワードウルフ・うろ覚え・校歌の 決まり。
// B10〜：村の 入口（ui/bushitsu/bushitsu.ts。板は 差しかえ）と 保存（kiriko-roguelike/bushitsu）。

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { TOWN_STAGES } from "../core/town";
import type { DungeonId } from "../core/types";
import {
	BS_BOARD,
	BS_MSG,
	BS_STAFF,
	BS_THING_LINES,
	boshuLine,
	fillText,
	type KoukaSt,
	koukaBubble,
	koukaCut,
	koukaFace,
	koukaMargin,
	koukaPress,
	koukaRatio,
	koukaStart,
	koukaTenths,
	koukaTick,
	MUKASHI,
	OE_TOPICS,
	type OeKind,
	oeDrawing,
	oeFar,
	oeMild,
	oeReaction,
	oeRound,
	oeSession,
	type Rand,
	rosterNames,
	rosterWindows,
	WW_BUCHO,
	type WwDeal,
	wwDeal,
	wwVerdict,
	wwWho,
	wwWord,
} from "../data/bushitsu/bushitsu";
import { facilityById } from "../data/village/facilities";
import {
	VILLAGE_SPOTS,
	type VillageView,
	villagePalette,
	villagePlaces,
	villageRows,
} from "../data/village/map";
import type { Story } from "../engine/defs";
import {
	forgetBushitsuMemo,
	loadBushitsu,
	saveBushitsu,
	setBushitsuBoards,
	setBushitsuEnv,
} from "../ui/bushitsu/bushitsu";
import type { KoukaResult } from "../ui/bushitsu/bushitsuBoards";
import type { Ctx } from "../ui/ctx";
import { buildFacility } from "../ui/village/facilities";
import { villageSong } from "../ui/village/villageMusic";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

const CASES: { id: string; name: string; run: () => void | Promise<void> }[] =
	[];
const test = (id: string, name: string, run: () => void | Promise<void>) =>
	CASES.push({ id, name, run });

/** 種つきの 乱数（線形合同法）。 */
const lcg =
	(seed: number): Rand =>
	() => {
		seed = (seed * 1664525 + 1013904223) >>> 0;
		return seed / 4294967296;
	};

const must = () => {
	const f = facilityById("bushitsu");
	if (!f?.room) throw new Fail("no bushitsu");
	return f;
};
const view = (stage: number, step?: number): VillageView => ({
	stage,
	unlocked: ["shallow"],
	cleared: [],
	...(step === undefined ? {} : { step }),
});

// ───────────────── B1〜B5 置き場所・部屋・絵 ─────────────────

/** 開き方 3通り（本編まで・もっとまで）。 */
const UNLOCKS: DungeonId[][] = [
	["shallow"],
	["shallow", "main"],
	["shallow", "main", "deep"],
];

test(
	"B2",
	"置き場所：段4〜7 で 扉・外の マス・外の 物 4つに 歩いて 行け、前の 通り（y4）は あいていて 歩いて 行ける。段0〜3 は 何も ない",
	() => {
		for (let stage = 0; stage < TOWN_STAGES; stage++)
			for (const unlocked of UNLOCKS) {
				const v: VillageView = {
					stage,
					unlocked,
					cleared: unlocked.slice(0, -1),
				};
				const where = `stage ${stage} [${unlocked}]`;
				const places = villagePlaces(v);
				const mine = places.filter(
					(p) =>
						p.id === "door_f_bushitsu" || p.id.startsWith("fthing_bushitsu_"),
				);
				if (stage < 4) {
					ok(!mine.length, `${where}: ${mine.map((p) => p.id)}`);
					continue;
				}
				ok(mine.length === 5, `${where}: places ${mine.map((p) => p.id)}`);
				const rows = villageRows(v).map((r) => [...r]);
				const tiles = villagePalette(v);
				const pass = (x: number, y: number) =>
					!!tiles[rows[y]?.[x] ?? ""]?.passable &&
					!places.some((p) => p.sprite && p.x === x && p.y === y);
				const reach = new Set<string>();
				const [bx, by] = VILLAGE_SPOTS.boot;
				const queue: [number, number][] = [[bx, by]];
				reach.add(`${bx},${by}`);
				while (queue.length) {
					const [x, y] = queue.shift() as [number, number];
					for (const [dx, dy] of [
						[0, -1],
						[1, 0],
						[0, 1],
						[-1, 0],
					]) {
						const k = `${x + dx},${y + dy}`;
						if (reach.has(k) || !pass(x + dx, y + dy)) continue;
						reach.add(k);
						queue.push([x + dx, y + dy]);
					}
				}
				const at = (x: number, y: number) => reach.has(`${x},${y}`);
				const door = mine.find((p) => p.id === "door_f_bushitsu");
				ok(
					door?.x === 14 && door.y === 3 && door.trigger === "touch",
					`${where}: door ${door?.x},${door?.y}`,
				);
				ok(at(14, 3) && at(14, 4), `${where}: door not reachable`);
				for (const p of mine.filter((q) => q.id.startsWith("fthing_"))) {
					ok(p.y === 3 && !p.sprite, `${where}: ${p.id} at ${p.x},${p.y}`);
					const near = [
						[0, -1],
						[1, 0],
						[0, 1],
						[-1, 0],
					].some(
						([dx, dy]) =>
							at(p.x + dx, p.y + dy) &&
							!places.some(
								(q) =>
									q.trigger === "touch" && q.x === p.x + dx && q.y === p.y + dy,
							),
					);
					ok(near, `${where}: ${p.id} has no reachable side`);
				}
				for (let x = 8; x <= 20; x++) {
					ok(pass(x, 4), `${where}: (${x},4) blocked`);
					ok(
						!places.some((p) => p.x === x && p.y === 4),
						`${where}: a place on (${x},4)`,
					);
				}
				for (let x = 8; x <= 20; x++)
					ok(at(x, 4), `${where}: (${x},4) not reachable`);
			}
	},
);

/** src の ファイル（再帰）。 */
const srcFiles = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory()
			? srcFiles(join(dir, e.name))
			: /\.(ts|js|mjs|json)$/.test(e.name)
				? [join(dir, e.name)]
				: [],
	);

/** 文字列の 葉を ぜんぶ（[道, 文]）。 */
const leaves = (o: unknown, path: string): [string, string][] =>
	typeof o === "string"
		? [[path, o]]
		: Array.isArray(o)
			? o.flatMap((x, i) => leaves(x, `${path}[${i}]`))
			: o && typeof o === "object"
				? Object.entries(o).flatMap(([k, x]) => leaves(x, `${path}.${k}`))
				: [];

// ───────────────── B7 ワードウルフ ─────────────────

/** 素直な 解き手（相手の お題だけの ことを 言った 席。いなければ あてずっぽう）・理づめ（自分の お題だけの 席も 外す）。 */
const winRate = (d: WwDeal, smart: boolean, rounds: number): number => {
	const minorOwn = d.pair.own[1 - d.major];
	const majorOwn = d.pair.own[d.major];
	const hs = d.hints.slice(0, rounds);
	const seats = [0, 1, 2, 3, 4];
	const flagged = seats.filter((i) => hs.some((r) => minorOwn.includes(r[i])));
	if (flagged.length) return flagged.includes(d.wolf) ? 1 / flagged.length : 0;
	const cands = smart
		? seats.filter((i) => !hs.some((r) => majorOwn.includes(r[i])))
		: seats;
	return cands.includes(d.wolf) ? 1 / cands.length : 0;
};

test(
	"B7",
	"ワードウルフ：配りと ひとことの 決まり・1周目で 当てる 見こみ 半分ほど・2周目で 8〜9割・部長が 人狼の 割合",
	() => {
		const rand = lcg(7);
		const N = 2000;
		let naive1 = 0;
		let naive2 = 0;
		let smart2 = 0;
		let bucho = 0;
		for (let n = 0; n < N; n++) {
			const d = wwDeal(rand);
			ok(d.wolf >= 0 && d.wolf < 5, `wolf ${d.wolf}`);
			ok(d.ids.length === 5 && new Set(d.ids).size === 5, `ids ${d.ids}`);
			const minor = 1 - d.major;
			const [r1, r2] = d.hints;
			ok(new Set(r1).size === 5 && new Set(r2).size === 5, "dup in a round");
			for (let i = 0; i < 5; i++) {
				const own = i === d.wolf ? d.pair.own[minor] : d.pair.own[d.major];
				ok(
					d.pair.common.includes(r1[i]) || own.includes(r1[i]),
					`r1 ${i} "${r1[i]}"`,
				);
				ok(
					d.pair.common.includes(r2[i]) || own.includes(r2[i]),
					`r2 ${i} "${r2[i]}"`,
				);
				ok(r2[i] !== r1[i], `seat ${i} repeats "${r1[i]}"`);
			}
			const vagueVillagers = [0, 1, 2, 3, 4].filter(
				(i) => i !== d.wolf && d.pair.common.includes(r2[i]),
			);
			ok(vagueVillagers.length <= 1, `r2 vague ${vagueVillagers}`);
			naive1 += winRate(d, false, 1);
			naive2 += winRate(d, false, 2);
			smart2 += winRate(d, true, 2);
			if (d.wolf === WW_BUCHO) bucho++;
		}
		const r = (x: number) => x / N;
		ok(r(naive1) >= 0.35 && r(naive1) <= 0.55, `naive after 1: ${r(naive1)}`);
		ok(r(naive2) >= 0.8 && r(naive2) <= 0.92, `naive after 2: ${r(naive2)}`);
		ok(r(smart2) >= 0.97, `smart after 2: ${r(smart2)}`);
		ok(r(bucho) >= 0.15 && r(bucho) <= 0.25, `bucho wolf ${r(bucho)}`);
		const d = wwDeal(lcg(3));
		const other = (d.wolf + 1) % 5;
		ok(wwVerdict(d, d.wolf, 1) === "first", "verdict first");
		ok(wwVerdict(d, d.wolf, 2) === "second", "verdict second");
		ok(wwVerdict(d, other, 1) === "miss", "verdict miss");
		ok(wwWord(d, d.wolf) !== wwWord(d, "kiriko"), "wolf word");
		ok(wwWord(d, other) === wwWord(d, "kiriko"), "villager word");
		ok(wwWho(d, 2) === "部長", `who 2 ${wwWho(d, 2)}`);
		for (const i of [0, 1, 3, 4])
			ok(/^ID:[A-Za-z0-9]{4}$/.test(wwWho(d, i)), `who ${i} ${wwWho(d, i)}`);
	},
);

// ───────────────── B8 うろ覚え ─────────────────

const same = (a: unknown, b: unknown) =>
	JSON.stringify(a) === JSON.stringify(b);

test(
	"B8",
	"うろ覚え：くずし方は どれも 絵を かえ、正解は いつも 1枚。問が 進むほど 近い 絵が ふえる。ひとことは 板の 文",
	() => {
		const rand = lcg(4242);
		const still = () => 0.5;
		const notes = new Set<string>(leaves(BS_BOARD.oe, "").map(([, t]) => t));
		for (const t of OE_TOPICS) {
			const mainCount = t.parts.filter((p) => p.tag === t.main).length;
			for (const k of oeFar(t)) {
				const d = oeDrawing(t, [k], k === "jitter" ? rand : still);
				ok(!same(d.parts, t.parts), `${t.id}: ${k} alone changes nothing`);
				if (k === "extra")
					ok(d.parts.length === t.parts.length + 1, `${t.id}: extra`);
				if (k === "drop")
					ok(
						d.parts.filter((p) => p.tag === t.main).length === mainCount,
						`${t.id}: drop removed main`,
					);
			}
			ok(!t.drops.includes(t.main), `${t.id}: main in drops`);
			ok(
				t.drops.some((g) => g !== t.extra.tag),
				`${t.id}: drop+extra impossible`,
			);
			for (const g of t.drops)
				ok(
					t.parts.some((p) => p.tag === g),
					`${t.id}: drop tag ${g}`,
				);
			for (let s = 0; s < 50; s++) {
				const d = oeDrawing(t, ["drop", "extra"], rand);
				ok(
					d.parts.some((p) => p.tag === t.extra.tag),
					`${t.id}: drop removed the extra`,
				);
				ok(d.parts.length <= t.parts.length, `${t.id}: drop+extra`);
			}
			for (const round of [0, 1, 2] as const)
				for (let s = 0; s < 300; s++) {
					const { drawings, best } = oeRound(t, round, rand);
					ok(drawings.length === 3, "3 drawings");
					const errs = drawings.map((d) => d.error);
					ok(
						errs.filter((e) => e === errs[best]).length === 1 &&
							Math.min(...errs) === errs[best],
						`${t.id} r${round}: min ${errs} best ${best}`,
					);
					const b = drawings[best];
					if (round === 0)
						ok(same(b.kinds, ["wobble"]), `${t.id} r0 best ${b.kinds}`);
					else
						ok(
							b.kinds.length === 2 &&
								b.kinds[0] === "wobble" &&
								oeMild(t).includes(b.kinds[1]),
							`${t.id} r${round} best ${b.kinds}`,
						);
					const added: OeKind[] = [];
					for (const [i, d] of drawings.entries()) {
						if (!t.wrong)
							ok(!d.kinds.includes("color"), `${t.id}: color without wrong`);
						ok(
							notes.has(oeReaction(t, d, b, rand)),
							`${t.id}: reaction for ${d.kinds}`,
						);
						if (i === best) continue;
						ok(d.error >= b.error + 2, `${t.id} r${round}: far ${d.error}`);
						const more = d.kinds.find(
							(k) => k !== "wobble" && !b.kinds.includes(k),
						);
						ok(more, `${t.id} r${round}: far has no extra defect`);
						if (more) added.push(more);
						if (round === 2)
							ok(
								b.kinds.every((k) => d.kinds.includes(k)),
								`${t.id} r2: far lacks the shared defect`,
							);
					}
					if (round === 2)
						ok(added[0] !== added[1], `${t.id} r2: same defect twice`);
				}
		}
		const ss = oeSession(rand);
		ok(ss.length === 3 && new Set(ss.map((t) => t.id)).size === 3, "session");
	},
);

// ───────────────── B9 校歌 ─────────────────

/** 歌いだして、顔色が stage に なってから react ms で しめる（16ms ごと）。stage 3 は しめない。 */
const koukaPolicy = (rand: Rand, stage: number, react: number): KoukaSt => {
	const st = koukaStart(rand);
	koukaPress(st);
	let seen: number | null = null;
	while (st.state === "hold") {
		koukaTick(st, 16);
		if (st.state !== "hold") break;
		if (seen === null && koukaFace(st) >= stage) seen = st.t;
		if (seen !== null && st.t - seen >= react) koukaCut(st);
	}
	return st;
};

test(
	"B9",
	"校歌：息は 8〜22秒・顔色の さかい・しめないと 息が 切れる・もっと 青く なって すぐ しめれば 切れずに 8割5分 以上",
	() => {
		const rand = lcg(99);
		for (let i = 0; i < 2000; i++) {
			const st = koukaStart(rand);
			ok(
				st.cap >= 8000 && st.cap < 22000 && st.state === "ready",
				`cap ${st.cap}`,
			);
		}
		const face = (t: number) => koukaFace({ cap: 10000, t, state: "hold" });
		ok(
			face(5999) === 0 &&
				face(6000) === 1 &&
				face(8499) === 1 &&
				face(8500) === 2,
			"face thresholds",
		);
		const runs = (stage: number, react: number) => {
			const r = lcg(99);
			const out = Array.from({ length: 2000 }, () =>
				koukaPolicy(r, stage, react),
			);
			const cut = out.filter((s) => s.state === "cut");
			return {
				fell: out.length - cut.length,
				mean:
					cut.reduce((n, s) => n + s.t / s.cap, 0) / Math.max(1, cut.length),
				out,
			};
		};
		const never = runs(3, 0);
		ok(never.fell === 2000, `never cut: ${never.fell} fell`);
		for (const s of never.out)
			ok(koukaTenths(s) === 0 && koukaRatio(s) === 0, "fell scores");
		const blue = runs(2, 300);
		ok(blue.fell === 0 && blue.mean >= 0.85, `blue: ${blue.fell} ${blue.mean}`);
		for (const s of blue.out) {
			ok(koukaRatio(s) < 1000 && koukaRatio(s) > 0, `ratio ${koukaRatio(s)}`);
			ok(koukaTenths(s) === Math.floor(s.t / 100), "tenths");
		}
		const pale = runs(1, 300);
		ok(pale.mean >= 0.55 && pale.mean <= 0.7, `pale: ${pale.mean}`);
		const st = koukaStart(() => 0.5);
		koukaCut(st);
		ok(st.state === "ready", "cut before press");
		koukaPress(st);
		for (let t = 0; t < 30000; t += 100) {
			koukaTick(st, 100);
			ok([...koukaBubble(st)].length <= 12, `bubble ${koukaBubble(st)}`);
		}
		ok(st.state === "fell" && st.t === st.cap, "fell at cap");
		ok(koukaMargin(st) === 0, "margin after fell");
	},
);

// ───────────────── B10〜 村の 入口と 保存 ─────────────────

/** 地の文・セリフ・選ぶ・待つ・音・曲を 記録する 台本の 相手（選ぶ ときは picks を 順に 返す）。 */
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
			if (k === "wait")
				return async () => {
					log.push("wait");
				};
			if (k === "se") return (x: string) => log.push(`se ${x}`);
			if (k === "bgm") return (x: string | null) => log.push(`bgm ${x}`);
			if (k === "then") return undefined;
			return () => undefined;
		},
	});
	return { s, log };
};

/** localStorage を 試験の あいだだけ 差しかえる。 */
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

const KEY = "kiriko-roguelike/bushitsu";
const saved = (store: Map<string, string>) =>
	JSON.parse(store.get(KEY) ?? "null");

/** 部屋の 物を 調べる（静かな 文 → 遊び）。 */
const examine = async (
	thing: string,
	picks: number[] = [],
	v: VillageView = view(4),
) => {
	const ev = (buildFacility(must(), v, {} as Ctx).events ?? []).find(
		(e) => e.id === `${thing}_0`,
	);
	ok(ev?.run, `no ${thing}_0`);
	const r = recorder(picks);
	await ev?.run?.(r.s);
	return r.log;
};
const narr = (t: string) => `narrate: ${t}`;
const sayOf = (who: keyof typeof BS_STAFF, t: string) =>
	`say(${BS_STAFF[who].name}): ${t}`;
const thingLines = (k: string) => (BS_THING_LINES[k] ?? []).map(narr);

/** 部室棟の 試験の 前後（保存を 差しかえ、板と 時刻を もどす）。 */
const sandbox = async (fn: (store: Map<string, string>) => Promise<void>) => {
	const { store, restore } = swapStorage();
	forgetBushitsuMemo();
	try {
		await fn(store);
	} finally {
		setBushitsuBoards(null);
		setBushitsuEnv(null);
		forgetBushitsuMemo();
		restore();
	}
};

test(
	"B10",
	"机：やめる・人狼（10人）・ワードウルフ（はじめは 手引き 2窓 → 板 → 当たり → 部長）。続けて 当てると 数える。部長が 人狼の ときの 別れの 文",
	() =>
		sandbox(async (store) => {
			const M = BS_MSG.ww;
			setBushitsuEnv({ returnAt: () => 1000 });
			const menu = `choose: ${M.menu.join("/")}`;
			const quit = await examine("table", [3]);
			ok(
				quit.join("\n") === [...thingLines("table"), menu].join("\n"),
				`quit:\n${quit.join("\n")}`,
			);
			const ten = await examine("table", [1]);
			ok(
				ten.join("\n") ===
					[
						...thingLines("table"),
						menu,
						narr(M.tenNin),
						sayOf("jinro", M.jiki),
					].join("\n"),
				`ten:\n${ten.join("\n")}`,
			);
			let boards = 0;
			setBushitsuBoards({
				wordwolf: async () => {
					boards++;
					return { verdict: "first", pairId: "tako", wolfSeat: 0 };
				},
			});
			const a = await examine("table", [0]);
			ok(
				a.join("\n") ===
					[
						...thingLines("table"),
						menu,
						...M.howto.map(narr),
						"wait",
						narr(M.win1),
						sayOf("jinro", M.byeWin),
					].join("\n"),
				`first:\n${a.join("\n")}`,
			);
			const m = saved(store);
			ok(
				m?.ww.plays === 1 &&
					m.ww.wins === 1 &&
					m.ww.first === 1 &&
					m.ww.streak === 1 &&
					m.ww.howto === true &&
					m.visits === 1,
				`memo ${JSON.stringify(m)}`,
			);
			const b = await examine("table", [0]);
			ok(!b.some((l) => M.howto.some((h) => l.includes(h))), "howto twice");
			ok(
				b.includes(narr(fillText(M.streak, { n: 2 }))) &&
					b.includes(narr("……2回つづけて当てた。")),
				`streak:\n${b.join("\n")}`,
			);
			ok(boards === 2, `boards ${boards}`);
			setBushitsuBoards({
				wordwolf: async () => ({ verdict: "miss", pairId: "age", wolfSeat: 2 }),
			});
			const c = await examine("table", [0]);
			ok(
				c.slice(-2).join("\n") ===
					[narr(M.lose), sayOf("jinro", M.byeMeWon)].join("\n"),
				`miss:\n${c.join("\n")}`,
			);
			ok(saved(store).ww.streak === 0, "streak not reset");
			setBushitsuBoards({
				wordwolf: async () => ({
					verdict: "second",
					pairId: "age",
					wolfSeat: 2,
				}),
			});
			const d = await examine("table", [0]);
			ok(
				d.slice(-2).join("\n") ===
					[narr(M.win2), sayOf("jinro", M.byeMeFound)].join("\n"),
				`second:\n${d.join("\n")}`,
			);
			// やめた 板（null）は 数えない
			setBushitsuBoards({ wordwolf: async () => null });
			const before = saved(store).ww.plays;
			const e = await examine("table", [0]);
			ok(e.at(-1) === "wait", `null board:\n${e.join("\n")}`);
			ok(saved(store).ww.plays === before, "a quit board was counted");
			ok(saved(store).visits === 1, "one return counted twice");
		}),
);

test(
	"B11",
	"人狼（10人）：10回目の 帰りより あとに 1度だけ そろいかけて 1人 抜ける。2度目からは そろわない",
	() =>
		sandbox(async (store) => {
			const M = BS_MSG.ww;
			const m = loadBushitsu();
			m.visits = 9;
			m.visitAt = 5;
			saveBushitsu(m, false);
			setBushitsuEnv({ returnAt: () => 6 });
			const a = await examine("table", [1]);
			ok(
				a.slice(-3).join("\n") ===
					[narr(M.ten[0]), narr(M.ten[1]), sayOf("jinro", M.jiki)].join("\n"),
				`ten:\n${a.join("\n")}`,
			);
			ok(saved(store).ww.ten === true && saved(store).visits === 10, "memo");
			const b = await examine("table", [1]);
			ok(
				b.slice(-2).join("\n") ===
					[narr(M.tenNin), sayOf("jinro", M.jiki)].join("\n"),
				`again:\n${b.join("\n")}`,
			);
		}),
);

test(
	"B12",
	"ぬとらじ：昼の 平日は 流れない・夜は 曜日の 回・土日は 一日じゅう 昔話（帰りに 1つ）・日誌に 聞いた 年",
	() =>
		sandbox(async () => {
			const M = BS_MSG.nt;
			setBushitsuEnv({ h: () => 12, w: () => 3, returnAt: () => 100 });
			let r = await examine("radio");
			ok(
				r.join("\n") === [...thingLines("radio"), narr(M.off)].join("\n"),
				`noon:\n${r.join("\n")}`,
			);
			r = await examine("onair");
			ok(r.at(-1) === narr(M.lampOff), `lamp off ${r}`);
			setBushitsuEnv({ h: () => 22, w: () => 2, returnAt: () => 100 });
			r = await examine("radio");
			ok(
				r.join("\n") ===
					[
						...thingLines("radio"),
						narr(fillText(M.title, { title: M.titles[2] })),
						sayOf("hoso", M.host[2]),
					].join("\n"),
				`karaoke:\n${r.join("\n")}`,
			);
			ok(r.length === 3, "radio windows");
			r = await examine("onair");
			ok(r.at(-1) === narr(M.lampOn), `lamp on ${r}`);
			r = await examine("nisshi");
			ok(r.at(-1) === narr(M.nisshiNone), `blank diary ${r}`);
			setBushitsuEnv({ h: () => 12, w: () => 6, returnAt: () => 100 });
			r = await examine("radio");
			ok(
				r.slice(-2).join("\n") ===
					[
						narr(fillText(M.title, { title: M.titles[6] })),
						sayOf("hoso", MUKASHI[0].lines[0]),
					].join("\n"),
				`mukashi 0:\n${r.join("\n")}`,
			);
			r = await examine("radio");
			ok(r.at(-1) === sayOf("hoso", M.again), `again ${r}`);
			setBushitsuEnv({ h: () => 12, w: () => 6, returnAt: () => 200 });
			r = await examine("radio");
			ok(r.at(-1) === sayOf("hoso", MUKASHI[1].lines[0]), `mukashi 1 ${r}`);
			r = await examine("nisshi");
			ok(r.at(-1) === narr("昔話の回：2回ぶん\n2012"), `diary ${r.at(-1)}`);
			setBushitsuEnv({ h: () => 1, w: () => 1, returnAt: () => 200 });
			r = await examine("onair");
			ok(r.at(-1) === narr(M.lampOn), `late night ${r}`);
		}),
);

test(
	"B13",
	"ボカロ一覧：町に いる 子 ぜんぶ（はじめから リノ・アルも）。安価キャラメイクは 帰りに 1回、原音設定か エター。作った 子は 一覧に のる",
	() =>
		sandbox(async (store) => {
			const C = BS_MSG.vc;
			const V = BS_MSG.vm;
			// 一覧に 載せるのは この 村に いる 子だけ（ほかの 名無しの ボカロは 載せない）
			ok(
				C.official.join("/") ===
					"束音ロゼ/解音ゼロ/革命シヨ/春音リノ/蓄音キリコ/響化アル",
				`official ${C.official}`,
			);
			for (const n of [
				"優音アイ",
				"葵音ゲイザー",
				"君野うしろ",
				"七草ハレ",
				"単音メフ",
			])
				ok(
					!leaves(BS_MSG, "").some(([, t]) => t.includes(n)),
					`${n} is listed`,
				);
			setBushitsuEnv({ returnAt: () => 50, rand: () => 0.1 });
			let r = await examine("roster", [], view(4, 18));
			const early = rosterWindows(rosterNames());
			ok(
				r.join("\n") ===
					[...thingLines("roster"), ...early.map(narr), narr(C.kiriko)].join(
						"\n",
					),
				`first roster:\n${r.join("\n")}`,
			);
			ok(
				r.some((l) => l.includes("春音リノ")) &&
					r.some((l) => l.includes("響化アル")),
				`rino/aru missing: ${r}`,
			);
			r = await examine("roster", [], view(7, 20));
			ok(
				r.some((l) => l.includes("春音リノ")) &&
					r.some((l) => l.includes("響化アル")),
				`late roster ${r}`,
			);
			ok(!r.includes(narr(C.kiriko)), "kiriko line twice");
			ok(r.length === 2, `no made window yet: ${r}`);
			// 原音設定（rand 0.1）
			const menu = `choose: ${V.menu.join("/")}`;
			r = await examine("pc", [0, 0, 0, 0]);
			const want = [
				...thingLines("pc"),
				menu,
				narr(V.q[0]),
				`choose: 乙音サンイチ/草音ワラ/鯖音ラグ/${V.stop}`,
				narr(V.q[1]),
				`choose: ネコミミ/メガネ/ジャージ/${V.stop}`,
				narr(V.q[2]),
				`choose: 〜ンゴ/〜やで/〜ですわ/${V.stop}`,
				narr(V.wait),
				"se mix",
				narr(V.ok[0]),
				narr("「乙音サンイチ」　ネコミミ　〜ンゴ"),
				narr(V.ok[1]),
			];
			ok(r.join("\n") === want.join("\n"), `make:\n${r.join("\n")}`);
			let m = saved(store);
			ok(
				m.vc.made.length === 1 &&
					m.vc.made[0].name === "乙音サンイチ" &&
					m.vc.madeAt === 50,
				`memo ${JSON.stringify(m.vc)}`,
			);
			r = await examine("pc", [0]);
			ok(r.at(-1) === narr(V.done), `same return ${r}`);
			// エター（rand 0.9。作った 子の 名前は もう 出ない）
			setBushitsuEnv({ returnAt: () => 60, rand: () => 0.9 });
			r = await examine("pc", [0, 0, 0, 0]);
			ok(!r.some((l) => l.startsWith("choose: 乙音サンイチ")), "name again");
			ok(
				r.slice(-2).join("\n") === V.eta.map(narr).join("\n"),
				`eta:\n${r.join("\n")}`,
			);
			m = saved(store);
			ok(m.vc.eta === 1 && m.vc.made.length === 1, `eta memo ${m.vc}`);
			// 途中で やめると 何も 書かない
			setBushitsuEnv({ returnAt: () => 70, rand: () => 0.5 });
			r = await examine("pc", [0, 0, 3]);
			ok(r.at(-1)?.startsWith("choose: "), `stop ${r}`);
			ok(saved(store).vc.madeAt === 60, "a stopped make was saved");
			// 一覧に 作った 子と エター
			r = await examine("roster");
			ok(
				r.length === 3 &&
					r.at(-1) === narr("（安価）乙音サンイチ\nすみに「エター1人」"),
				`roster with made:\n${r.join("\n")}`,
			);
		}),
);

test(
	"B14",
	"譜面台・筐体・部員募集：校歌は 曲を 止めて 板（投げても もどす）→ 秒と 部長。テストプレイは エター。部員募集は 帰りの 数で かわる",
	() =>
		sandbox(async (store) => {
			const K = BS_MSG.kk;
			setBushitsuEnv({ returnAt: () => 5 });
			let kk: KoukaResult = { tenths: 123, fell: false, t: 12300, cap: 14000 };
			setBushitsuBoards({ kouka: async () => kk });
			const song = villageSong();
			let r = await examine("fumendai", [0]);
			ok(
				r.join("\n") ===
					[
						...thingLines("fumendai"),
						`choose: ${K.menu.join("/")}`,
						...K.howto.map(narr),
						"wait",
						"bgm null",
						`bgm ${song}`,
						narr("……12.3秒。いちばんぎりぎり。"),
						sayOf("gassho", K.byeGood),
					].join("\n"),
				`best:\n${r.join("\n")}`,
			);
			ok(saved(store).kk.best === 878, `best ${saved(store).kk.best}`);
			kk = { tenths: 100, fell: false, t: 10000, cap: 20000 };
			r = await examine("fumendai", [0]);
			ok(!r.some((l) => K.howto.some((h) => l.includes(h))), "howto twice");
			ok(
				r.slice(-2).join("\n") ===
					[narr("……10.0秒伸ばした。"), sayOf("gassho", K.byeShort)].join("\n"),
				`short:\n${r.join("\n")}`,
			);
			ok(saved(store).kk.best === 878, "best overwritten");
			kk = { tenths: 0, fell: true, t: 9000, cap: 9000 };
			r = await examine("fumendai", [0]);
			ok(
				r.slice(-2).join("\n") ===
					[narr(K.fall), sayOf("gassho", K.byeFall)].join("\n"),
				`fell:\n${r.join("\n")}`,
			);
			ok(saved(store).kk.falls === 1 && saved(store).kk.plays === 3, "falls");
			// 板が 投げても 曲は もどる
			setBushitsuBoards({
				kouka: async () => {
					throw new Error("board");
				},
			});
			const t = recorder([0]);
			const ev = (buildFacility(must(), view(4), {} as Ctx).events ?? []).find(
				(e) => e.id === "fumendai_0",
			);
			let threw = false;
			try {
				await ev?.run?.(t.s);
			} catch {
				threw = true;
			}
			ok(threw && t.log.at(-1) === `bgm ${song}`, `throw:\n${t.log}`);
			// やめる
			r = await examine("fumendai", [1]);
			ok(!r.includes("bgm null"), "quit played");
			// テストプレイ
			let played = 0;
			setBushitsuBoards({
				testplay: async () => {
					played++;
				},
			});
			r = await examine("cabinet", [0]);
			ok(played === 1 && r.at(-1) === narr(BS_MSG.tp.after), `testplay ${r}`);
			r = await examine("cabinet", [1]);
			ok(played === 1 && !r.includes(narr(BS_MSG.tp.after)), "testplay quit");
			// 部員募集（帰りが かわるたびに 次の 部）
			setBushitsuBoards(null);
			forgetBushitsuMemo();
			store.delete(KEY);
			setBushitsuEnv({ returnAt: () => 10 });
			r = await examine("boshu");
			ok(
				r.join("\n") ===
					[...thingLines("boshu"), narr(boshuLine(1))].join("\n") &&
					boshuLine(1).includes("「人狼部　部員募集part31」"),
				`first:\n${r.join("\n")}`,
			);
			r = await examine("boshu");
			ok(r.at(-1) === narr(boshuLine(1)), "same return, same poster");
			setBushitsuEnv({ returnAt: () => 20 });
			r = await examine("boshu");
			ok(
				r.at(-1) === narr(boshuLine(2)) && boshuLine(2).includes("38羽目"),
				`second ${r.at(-1)}`,
			);
			ok(saved(store).visits === 2, "visits");
		}),
);

test(
	"B15",
	"下見の あいだ（noSave）は 保存に 書かず この回だけ 覚える。捨てると 保存から 読みなおす",
	() =>
		sandbox(async (store) => {
			const m = loadBushitsu();
			m.visits = 7;
			saveBushitsu(m, true);
			ok(!store.has(KEY), "written while previewing");
			ok(loadBushitsu().visits === 7, "not remembered");
			forgetBushitsuMemo();
			ok(loadBushitsu().visits === 0, "not forgotten");
			store.set(KEY, "{broken");
			ok(loadBushitsu().visits === 0, "broken json");
			store.set(KEY, JSON.stringify({ v: 1, visits: -3, ww: { plays: "x" } }));
			const bad = loadBushitsu();
			ok(bad.visits === 0 && bad.ww.plays === 0 && bad.visitAt === -1, "bad");
		}),
);

export const runBushitsuTests = async (): Promise<TestResult[]> => {
	const out: TestResult[] = [];
	for (const c of CASES) {
		try {
			await c.run();
			out.push({ id: `bushitsu ${c.id}`, name: c.name, ok: true });
		} catch (e) {
			out.push({
				id: `bushitsu ${c.id}`,
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			});
		}
	}
	return out;
};
