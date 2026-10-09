// 保守村の 小さな 名物（folk。data/folk.ts・data/village/folk.ts・ui/folk.ts）の 試験（pnpm test で いっしょに 動く）。
// 文の 幅・帰りごとに 1つ 進む 決まり・置き場所（どの 段でも 道を ふさがず 遠回りに させず 話せる）・本館／図書館／銭湯の すみ・
// 歩行グラが ほかと かぶらない こと・下見で 保存を 書かない こと を 見る。

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MONSTERS } from "../core/data/monsters";
import { TOWN_STAGES } from "../core/town";
import type { DungeonId } from "../core/types";
import { CAST, YAJI_WALK } from "../data/cast";
import { YORIAI_SPOTS } from "../data/civic";
import {
	BALUS,
	BALUS_BEATS,
	balusBeat,
	balusLvAfter,
	balusName,
	EGG_THEORIES,
	eggTheory,
	FOLK_NAMES,
	GRAVE,
	HIRA,
	HIRA_AVOID,
	HIRA_BOTTOM,
	HIRA_FORGOT,
	HIRA_RANKS,
	HIRA_WHY,
	hiraEndless,
	hiraEntry,
	hiraForgot,
	IDEA,
	IDEA_ASKS,
	ideaAfter,
	ideaOk,
	ideaText,
	kusaShown,
	MOFU,
	MUSEUM,
	mofuTag,
	museumPick,
	NAZO,
	nazoPick,
	nazoResult,
	ODORU,
	odoruAwake,
	RIDDLES,
	riddleAnswer,
	rolliLine,
} from "../data/folk";
import { MOBS } from "../data/mobs";
import { ROOM_MSG } from "../data/rooms";
import { crowdNodes, PERSONAS } from "../data/village/crowd";
import { FACILITIES, facilityById } from "../data/village/facilities";
import {
	BOCHI_FROM,
	FOLK_ART,
	FOLK_FROM,
	FOLK_SPOTS,
	FOLK_WALK,
	GRAVES,
	MONUMENT,
	mofuWalk,
} from "../data/village/folk";
import {
	hallEntry,
	hallPalette,
	hallPlaces,
	hallRows,
	hallTierOf,
	NANASHI_WALK,
} from "../data/village/hall";
import {
	VILLAGE_H,
	VILLAGE_SPOTS,
	VILLAGE_W,
	type VillageView,
	villagePalette,
	villagePlaces,
	villageRows,
} from "../data/village/map";
import {
	BOOKS_BROWSE,
	BOOKS_KEEPER,
	roomEntry,
	roomMats,
	roomPalette,
	roomPlaces,
	roomRows,
} from "../data/village/rooms";
import type { Story, TileDef } from "../engine/defs";
import {
	balusScript,
	folkEvent,
	forgetFolkMemo,
	graveScript,
	hiraScript,
	IDEA_AT,
	ideaScript,
	loadFolk,
	nazoScript,
} from "../ui/folk";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

const CASES: { name: string; run: () => void | Promise<void> }[] = [];
const test = (name: string, run: () => void | Promise<void>) =>
	CASES.push({ name, run });

// ───────────────── 道具 ─────────────────

/** 全角=1・半角=0.5 で 数えた 幅（villageTests と 同じ）。 */
const width = (line: string): number =>
	[...line].reduce((w, ch) => w + (/[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);
const EMOJI = /\p{Extended_Pictographic}/u;

/** 村の 窓（全角22字・2行。絵文字の 行は 21字）に 収まるか。 */
const fits = (where: string, t: string): void => {
	const lines = t.split("\n");
	ok(lines.length <= 2, `${where}: ${lines.length} lines`);
	for (const l of lines) {
		const max = EMOJI.test(l) ? 21 : 22;
		ok(width(l) <= max, `${where}: "${l}" is ${width(l)} wide`);
	}
	ok(!t.includes("️") && !t.includes("‍"), `${where}: FE0F/ZWJ`);
};

const ALL_UNLOCKS: DungeonId[][] = [
	["shallow"],
	["shallow", "main"],
	["shallow", "main", "deep"],
];
const VIEWS: VillageView[] = [];
for (let stage = 0; stage < TOWN_STAGES; stage++)
	for (const unlocked of ALL_UNLOCKS)
		VIEWS.push({ stage, unlocked, cleared: unlocked.slice(0, -1) });
/** 原住民が 越してきた 村（灯台を 持ち帰った あと。villageTests の VIEWS には ない）。 */
const OWNER_VIEWS: VillageView[] = Array.from(
	{ length: TOWN_STAGES },
	(_, stage) => ({
		stage,
		unlocked: ["shallow", "main", "deep", "isle1", "isle2", "isle3", "opunu"],
		cleared: ["shallow", "main", "deep", "isle1", "isle2", "isle3", "opunu"],
	}),
);

type Spot = { x: number; y: number; trigger?: string; sprite?: string };
const STEPS = [
	[0, -1],
	[1, 0],
	[0, 1],
	[-1, 0],
] as const;

/** 地図を 引く（start から 歩ける マス・話せるか）。blocked は 人の 立つ マス。 */
const survey = (
	rows: readonly string[],
	tiles: Record<string, TileDef>,
	places: readonly Spot[],
	start: readonly [number, number],
	blocked: readonly (readonly [number, number])[] = [],
) => {
	const grid = rows.map((r) => [...r]);
	const tile = (x: number, y: number) => tiles[grid[y]?.[x] ?? ""];
	const occ = new Set([
		...places.filter((p) => p.sprite).map((p) => `${p.x},${p.y}`),
		...blocked.map(([x, y]) => `${x},${y}`),
	]);
	const touch = new Set(
		places.filter((p) => p.trigger === "touch").map((p) => `${p.x},${p.y}`),
	);
	const canEnter = (x: number, y: number) =>
		!!tile(x, y)?.passable && !occ.has(`${x},${y}`);
	const reach = new Set<string>();
	const q: [number, number][] = [];
	if (canEnter(start[0], start[1])) {
		reach.add(`${start[0]},${start[1]}`);
		q.push([start[0], start[1]]);
	}
	while (q.length) {
		const [x, y] = q.shift() as [number, number];
		for (const [dx, dy] of STEPS) {
			const k = `${x + dx},${y + dy}`;
			if (reach.has(k) || !canEnter(x + dx, y + dy)) continue;
			reach.add(k);
			q.push([x + dx, y + dy]);
		}
	}
	const standable = (x: number, y: number) =>
		reach.has(`${x},${y}`) && !touch.has(`${x},${y}`);
	/** 背の 高い 物（絵が 上の マスへ はみ出す）は 北どなり（裏）から 読まない（engine/field.ts の hasBack）。 */
	const tall = (x: number, y: number) =>
		(tile(x, y)?.layers ?? []).some((r) => Number(r.split(",")[3]) > 16);
	const talkable = (p: { x: number; y: number }) =>
		STEPS.some(([dx, dy]) => {
			const cx = p.x - dx;
			const cy = p.y - dy;
			if (tile(cx, cy)?.counter) return standable(cx - dx, cy - dy);
			if (dx === 0 && dy === 1 && tall(p.x, p.y)) return false;
			return standable(cx, cy);
		});
	return { tile, canEnter, reach, talkable, tall };
};

const villageSurvey = (v: VillageView) =>
	survey(
		villageRows(v),
		villagePalette(v),
		villagePlaces(v),
		VILLAGE_SPOTS.boot,
	);

/** 村の 歩数（start から。blocked の マスは 通れない。start 自身は 壁でも よい＝扉・出口）。 */
const distances = (
	pass: (x: number, y: number) => boolean,
	start: readonly [number, number],
	blocked: ReadonlySet<string>,
): Int32Array => {
	const d = new Int32Array(VILLAGE_W * VILLAGE_H).fill(-1);
	const q: [number, number][] = [[start[0], start[1]]];
	d[start[1] * VILLAGE_W + start[0]] = 0;
	for (let h = 0; h < q.length; h++) {
		const [x, y] = q[h];
		for (const [dx, dy] of STEPS) {
			const nx = x + dx;
			const ny = y + dy;
			if (nx < 0 || ny < 0 || nx >= VILLAGE_W || ny >= VILLAGE_H) continue;
			const i = ny * VILLAGE_W + nx;
			if (d[i] >= 0 || !pass(nx, ny) || blocked.has(`${nx},${ny}`)) continue;
			d[i] = d[y * VILLAGE_W + x] + 1;
			q.push([nx, ny]);
		}
	}
	return d;
};

/** folk の 人が 立っても、どの 道も この 歩数より 遠く ならない（池の 南の くぼみ (16,29) が おどちゃんで +4）。 */
const DETOUR_MAX = 4;

// 保存は 入れものに（localStorage を 試験の あいだだけ かえる）
const swapStorage = (): (() => void) => {
	const mem = new Map<string, string>();
	const store = {
		getItem: (k: string) => mem.get(k) ?? null,
		setItem: (k: string, v: string) => void mem.set(k, String(v)),
		removeItem: (k: string) => void mem.delete(k),
		clear: () => mem.clear(),
		key: (i: number) => [...mem.keys()][i] ?? null,
		get length() {
			return mem.size;
		},
	};
	const prev = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		value: store,
		configurable: true,
		writable: true,
	});
	forgetFolkMemo();
	return () => {
		if (prev) Object.defineProperty(globalThis, "localStorage", prev);
		else delete (globalThis as { localStorage?: unknown }).localStorage;
		forgetFolkMemo();
	};
};
const withStorage = async (fn: () => Promise<void>): Promise<void> => {
	const restore = swapStorage();
	try {
		await fn();
	} finally {
		restore();
	}
};
/** 試験の あいだだけ location.search を かえる（jikkyoTests の swapLocation と 同じ）。 */
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

/** 冒険から 帰った（記録の 時刻。新しい 順。ui/guests.ts の returnAt が いちばん 新しい 時刻を 読む）。 */
const comeBack = (...ats: number[]): void => {
	localStorage.setItem(
		"kiriko-roguelike/records",
		JSON.stringify(
			ats.map((at) => ({
				at,
				kind: "dead",
				cause: "名無し",
				depth: 1,
				maxDepth: 1,
				lv: 1,
				turn: 1,
				kills: 0,
				returning: false,
			})),
		),
	);
};

/** した ことを 1行ずつ 記録する Story（picks は 選択肢で 選ぶ 番号の 順。尽きたら cancel を 選ぶ）。 */
const fakeStory = (picks: number[] = []) => {
	const log: string[] = [];
	const flags: Record<string, boolean | number | string> = {};
	const s = {
		state: { x: 0, y: 0, dir: "up", flags },
		say: async (_who: unknown, text: string, opt?: { name?: string }) => {
			log.push(`say ${opt?.name ?? ""}: ${text}`);
		},
		narrate: async (text: string) => {
			log.push(`narrate: ${text}`);
		},
		choose: async (options: string[], opt?: { cancel?: number }) => {
			log.push(`choose ${options.join("/")}`);
			return picks.length ? (picks.shift() as number) : (opt?.cancel ?? 0);
		},
		se: (name: string) => {
			log.push(`se ${name}`);
		},
		flag: (name: string) => flags[name],
		set: (name: string, value: boolean | number | string = true) => {
			flags[name] = value;
		},
		face: () => {},
		wait: async () => {},
	} as unknown as Story;
	return { s, log };
};

// ───────────────── 文 ─────────────────

test("F1 文: every folk window fits 22×2 (emoji lines 21), choices fit 9, name boxes are short, ≤3 windows per talk", () => {
	const all: [string, string][] = [];
	const add = (
		where: string,
		...texts: readonly (string | readonly string[])[]
	) => {
		for (const [i, t] of texts.flat().entries())
			all.push([`${where}[${i}]`, t]);
	};
	for (const [k, t] of Object.entries(HIRA)) add(`HIRA.${k}`, t);
	for (const [k, t] of Object.entries(HIRA_WHY))
		add(`HIRA_WHY.${k}`, `選出理由\n・${t}`);
	add("HIRA_FORGOT", ...HIRA_FORGOT.one, ...HIRA_FORGOT.two);
	for (const n of [
		...Array.from({ length: 60 }, (_, i) => i),
		1000,
		5000,
		1e6,
	]) {
		const e = hiraEntry(n);
		ok(e.length >= 1 && e.length <= 3, `hiraEntry(${n}): ${e.length} windows`);
		add(`hiraEntry(${n})`, ...e);
	}
	for (const [k, t] of Object.entries(NAZO)) add(`NAZO.${k}`, t);
	for (const [i, r] of RIDDLES.entries()) {
		add(`RIDDLES[${i}]`, r.q, r.why, ...(r.odd ? [r.odd] : []));
		for (let k = 0; k <= 3; k++) add(`nazo ${i}/${k}`, ...nazoResult(r, k));
		for (const o of r.options)
			ok(width(o) <= 9, `RIDDLES[${i}] choice "${o}" is ${width(o)} wide`);
	}
	for (const [i, b] of BALUS_BEATS.entries()) {
		ok(b.lines.length <= 3, `BALUS_BEATS[${i}]: ${b.lines.length} windows`);
		add(`BALUS_BEATS[${i}]`, ...b.lines.map((l) => l.text));
	}
	add("BALUS.again", BALUS.again);
	for (const [k, t] of Object.entries(IDEA)) add(`IDEA.${k}`, t);
	for (const [i, a] of IDEA_ASKS.entries()) {
		add(`ideaText(${i})`, ideaText(i));
		for (const o of a.options)
			ok(width(o) <= 9, `IDEA_ASKS[${i}] choice "${o}" is ${width(o)} wide`);
	}
	add("ODORU", ODORU.first, ODORU.main, ...ODORU.more);
	for (let st = 0; st < TOWN_STAGES; st++) add(`mofuTag(${st})`, mofuTag(st));
	add("MOFU", MOFU.owner, ...MOFU.more);
	for (const [k, v] of Object.entries(GRAVE)) add(`GRAVE.${k}`, v);
	for (const n of [1, 9, 10, 13, 19, 20, 99, 9999])
		add(`kusaShown(${n})`, GRAVE.kusaNow.replace("{w}", kusaShown(n)));
	add("EGG_THEORIES", ...EGG_THEORIES);
	for (const [i, c] of MUSEUM.entries())
		add(`MUSEUM[${i}]`, ...c.map(([a, b]) => `${a}\n${b}`));
	add("ROOM_MSG", ROOM_MSG.bath.egg[0], ROOM_MSG.library.museum[0]);
	for (const [where, t] of all) fits(where, t);
	for (const c of GRAVE.kusaMenu) ok(width(c) <= 9, `kusa menu ${c}`);
	for (const n of [...Object.values(FOLK_NAMES), balusName(3)])
		ok(width(n) <= 10, `name box ${n} is ${width(n)} wide`);
	for (const [where, t] of all) {
		// スレは 落ちない（沈む）
		ok(!/落ち[るたない]/.test(t), `${where}: 落ちる`);
		// 避ける 数字（淫夢 など）は どの 文にも 出ない
		for (const w of HIRA_AVOID) ok(!t.includes(w), `${where}: ${w}`);
	}
	// 🎭 は なぞなぞ仮面の 判定と 名乗りだけ（ほかの 窓・地の文には 絵文字を つけない）
	for (const [where, t] of all)
		if (EMOJI.test(t))
			ok(
				where.startsWith("NAZO.") ||
					where.startsWith("nazo ") ||
					where.startsWith("RIDDLES["),
				`${where}: emoji outside the mask`,
			);
	for (const k of ["again", "flee", "rerun", "robaTrap"] as const)
		ok(!EMOJI.test(NAZO[k]), `NAZO.${k} has an emoji`);
});

// ───────────────── 決まり ─────────────────

test("F2 ひらがなニキ: 1位から 48位（2位は ぷ の 言いかけ）と 選出理由、そのあとは 10の23乗位の う・ぅ、番号だけ 上がって 終わらない", () => {
	const ranks = [...HIRA_RANKS];
	ok(ranks.length === 48, `${ranks.length} ranks`);
	ok(new Set(ranks).size === 48, "a kana twice");
	ok(
		ranks.every((c) => /^[ぁ-ゖ]$/.test(c)),
		"not hiragana",
	);
	for (const k of Object.keys(HIRA_WHY).map(Number))
		ok(k >= 1 && k <= 48 && k !== 20 && k !== 22, `why for rank ${k}`);
	ok(hiraEntry(0)[0].startsWith("第1位　ぬ"), hiraEntry(0)[0]);
	ok(hiraEntry(0)[1] === `選出理由\n・${HIRA_WHY[1]}`, hiraEntry(0).join());
	ok(
		hiraEntry(1).join() === [HIRA.pu, HIRA.retract].join(),
		hiraEntry(1).join(),
	);
	ok(HIRA.retract.includes("半濁音は　除外"), "ぷ is not retracted");
	ok(hiraEntry(2)[0].startsWith("第2位　ね"), hiraEntry(2)[0]);
	ok(hiraEntry(2).at(-1) === HIRA.from48, "no 48位から");
	for (let n = 3; n < 48; n++)
		ok(
			hiraEntry(n)[0].startsWith(`第${n}位　${HIRA_RANKS[n - 1]}\n`),
			hiraEntry(n)[0],
		);
	ok(hiraEntry(47).at(-1) === HIRA.ahead, "no 最下位 発表");
	ok(
		hiraEntry(48)[0] === HIRA.last && hiraEntry(48).at(-1) === HIRA.manyo,
		hiraEntry(48).join(),
	);
	ok(HIRA.last.startsWith("第48位　ひ"), HIRA.last);
	ok(hiraEntry(49)[0].startsWith(`第${HIRA_BOTTOM}位　う`), hiraEntry(49)[0]);
	ok(
		hiraEntry(50)[0].startsWith(`第${HIRA_BOTTOM - 1n}位　ぅ`),
		hiraEntry(50)[0],
	);
	// 終わらない 番号：1つずつ 上がり（同じ 番号は 出ない）、避ける 数字を 含まない
	let prev = HIRA_BOTTOM - 1n;
	for (let i = 0; i < 5000; i++) {
		const r = hiraEndless(i);
		ok(r < prev, `endless ${i}: ${r} after ${prev}`);
		for (const w of HIRA_AVOID)
			ok(!String(r).includes(w), `endless ${i}: ${r}`);
		prev = r;
	}
	ok(hiraEndless(0) === HIRA_BOTTOM - 2n, `${hiraEndless(0)}`);
	ok(
		[51, 52, 400].every((n) => !/位　\S/.test(hiraEntry(n)[0])),
		"the countdown names a kana",
	);
	ok(hiraForgot(0, 0) === null && hiraForgot(-1, 0) === null, "forgot 0");
	ok(
		hiraForgot(1, 0) === HIRA_FORGOT.one[0] &&
			hiraForgot(3, 1) === HIRA_FORGOT.two[1],
		"forgot lines",
	);
});

test("F3 なぞなぞ仮面: 3つの ちがう 答え、正解と まっすぐ（ロバでは わな）は 別、外すと 答えを 言う、1問めは 元スレの 問題", () => {
	ok(RIDDLES.length >= 10, `${RIDDLES.length} riddles`);
	ok(RIDDLES.filter((r) => r.roba).length >= 2, "no ロバ");
	ok(riddleAnswer(RIDDLES[0]) === "ウェッティングケーキ", "not the original");
	for (const [i, r] of RIDDLES.entries()) {
		ok(new Set(r.options).size === 3, `riddle ${i}: same options`);
		ok(r.answer !== r.plain, `riddle ${i}: answer is plain`);
		ok(
			nazoPick(r, r.answer) === "right" && nazoPick(r, 3) === "quit",
			`riddle ${i}: picks`,
		);
		const answer = riddleAnswer(r);
		for (let k = 0; k < 3; k++) {
			if (k === r.answer) continue;
			ok(
				nazoResult(r, k).some((t) => t.includes(`『${answer}』`)),
				`riddle ${i}: a wrong pick (${k}) does not tell the answer`,
			);
		}
		// 芋煮会は 季節の パッケージの もの（なぞなぞには 出さない）
		ok(!r.options.includes("芋煮会"), `riddle ${i}: 芋煮会`);
	}
	// 正解の 場所は ばらける
	ok(
		new Set(RIDDLES.map((r) => r.answer)).size === 3,
		"the answer is always in one place",
	);
});

test("F4 バルス失敗ニキ: 1回目は 初出、あとは 5つを くり返し、一度も 成功しない。レベルの 数が 合う", () => {
	ok(balusBeat(0) === BALUS_BEATS[0], "first");
	for (let n = 1; n < 30; n++)
		ok(balusBeat(n) === BALUS_BEATS[1 + ((n - 1) % 5)], `beat ${n}`);
	for (const b of BALUS_BEATS)
		for (const l of b.lines)
			ok(!l.text.includes("発動！"), `succeeded: ${l.text}`);
	ok(
		BALUS_BEATS.filter((b) => b.lines.some((l) => l.sys)).length >= 4,
		"few failures",
	);
	// レベル不足は lv 3 未満で、名前欄と 同じ 数。part の 罪状は 1 下がり、次の 回は その レベルから
	for (let n = 0; n < 12; n++) {
		const b = balusBeat(n);
		for (const l of b.lines.filter((x) => x.sys)) {
			if (l.text.includes("レベル　不足")) {
				ok(b.lv < 3, `beat ${n}: lv ${b.lv} is enough`);
				ok(l.text.includes(`（lv:${b.lv}）`), `beat ${n}: ${l.text}`);
			} else {
				ok(l.text.includes("【罪状】"), l.text);
				ok(b.lv >= 3, `beat ${n}: 罪状 at lv ${b.lv}`);
				ok(l.text.includes(`(lv:${b.lv} →${b.lv - 1})`), l.text);
				ok(balusBeat(n + 1).lv === b.lv - 1, `beat ${n + 1} level`);
				ok(balusLvAfter(b) === b.lv - 1, `beat ${n}: level after`);
			}
			// 空飛ぶ鯖と 同じ あけ方
			ok(l.text.startsWith("禁断呪文　バルス　発動失敗。。"), l.text);
		}
	}
});

test("F5 人工無能ニキ・墓・温泉卵・博物館: 10個で 構想10年、返事は 入れかわる、ロリードは 入れかわり、草は きうりに、説は 5つめで 答えなし、展示は 帰りで きまる", () => {
	ok(IDEA_ASKS.length === 10, "ten asks");
	ok(ideaAfter(10) === IDEA.ten && ideaAfter(9) === null, "構想10年");
	ok(
		new Set([0, 1, 2].map(ideaOk)).size === 3 && ideaOk(3) === ideaOk(0),
		"なるほど",
	);
	ok(
		rolliLine(0) !== rolliLine(1) && rolliLine(1) !== rolliLine(2),
		"ロリード",
	);
	ok(rolliLine(3) === rolliLine(1), "ロリード cycles");
	ok(kusaShown(3) === "ｗｗｗ", kusaShown(3));
	ok(kusaShown(10) === "きうり　1本", kusaShown(10));
	ok(kusaShown(23) === "きうり　2本と、ｗｗｗ", kusaShown(23));
	ok(
		GRAVE.kusaTen.includes("きうり") && !GRAVE.kusaTen.includes("絵"),
		GRAVE.kusaTen,
	);
	ok(
		eggTheory(4) === EGG_THEORIES[4] && eggTheory(5) === EGG_THEORIES[0],
		"egg",
	);
	ok(
		EGG_THEORIES[4].includes("答え") &&
			!EGG_THEORIES.some((t) => t.includes("隠語")),
		"egg theories",
	);
	ok(ROOM_MSG.bath.egg[0].includes("滑稽"), "no 滑稽 on the wall");
	for (const at of [0, 1, 1760000000000, 1760000000001])
		for (const k of [0, 1]) {
			const a = museumPick(at, k);
			ok(MUSEUM[k].includes(a) && museumPick(at, k) === a, `museum ${at} ${k}`);
		}
	ok(
		odoruAwake(20) && odoruAwake(3) && !odoruAwake(5) && !odoruAwake(12),
		"night",
	);
	// ピアノ機能は 音楽室の 供養の 札（data/rooms.ts）に あるので 墓に しない
	ok(!GRAVES.some((g) => g.id === "piano"), "piano grave");
	ok(
		!GRAVE.balus.join().includes("成功して") &&
			GRAVE.balus[0].includes("再開てすと中"),
		"balus grave",
	);
});

// ───────────────── 置き場所 ─────────────────

test("F6 村: 名無したちは 段1 から（段0 は ぷゆゆと やきうだけ）、墓場は 段2 から。どの 段でも 通れる マスに 立ち、話せて、道を ふさがず、遠回りも させない", () => {
	const RESERVED = [
		[27, 12],
		[24, 12],
		[17, 11],
		[30, 20],
		[7, 15],
		[7, 16],
		[7, 17],
		[7, 18],
		// 西の 空き地 → 西口の 乗り場・図書館・碁会所の 近道（map.ts で 片づけた マス）
		[7, 22],
		[6, 22],
		[6, 23],
		[4, 23],
		[16, 17],
		[25, 17],
		[26, 20],
		[29, 20],
		[9, 19],
		[33, 21],
		[19, 11],
		[20, 11],
	].map(([x, y]) => `${x},${y}`);
	for (const v of [...VIEWS, ...OWNER_VIEWS]) {
		const places = villagePlaces(v);
		const folk = places.filter((p) => p.id.startsWith("folk_"));
		const graves = folk.filter((p) => p.id.startsWith("folk_grave_"));
		ok(
			v.stage >= FOLK_FROM || folk.length === 0,
			`stage ${v.stage}: ${folk.length} folk`,
		);
		ok(
			graves.length === (v.stage >= BOCHI_FROM ? GRAVES.length : 0),
			`stage ${v.stage}: ${graves.length} graves`,
		);
		const s = villageSurvey(v);
		const nodes = new Set(crowdNodes(v).map((n) => `${n.at[0]},${n.at[1]}`));
		// 扉・出口・トロッコの 乗り場の となりには 立たない
		const near = new Set<string>();
		for (const p of places)
			if (p.trigger === "touch" || p.id.startsWith("trolley_"))
				for (const [dx, dy] of [[0, 0], ...STEPS])
					near.add(`${p.x + dx},${p.y + dy}`);
		for (const p of folk) {
			ok(s.talkable(p), `stage ${v.stage}: cannot talk to ${p.id}`);
			ok(!RESERVED.includes(`${p.x},${p.y}`), `${p.id} on a reserved path`);
			if (!p.sprite) continue;
			const k = `${p.x},${p.y}`;
			ok(s.tile(p.x, p.y)?.passable, `${p.id} on a wall`);
			ok(!nodes.has(k), `stage ${v.stage}: ${p.id} on a crowd stop`);
			ok(!near.has(k), `stage ${v.stage}: ${p.id} next to a door/exit/trolley`);
			ok(p.y < 49, `${p.id} on the lineup rows`);
			// すぐ 下の 木の 葉（above）や 背の 高い 物（街灯。絵が 上の マスへ はみ出す）に 体が かくれない
			// （engine/field.ts の drawHidden で 薄く なる）
			ok(
				!s.tile(p.x, p.y + 1)?.above?.length,
				`stage ${v.stage}: ${p.id} hides under the tree at ${p.x},${p.y + 1}`,
			);
			ok(
				!s.tall(p.x, p.y + 1),
				`stage ${v.stage}: ${p.id} hides behind the tall thing at ${p.x},${p.y + 1}`,
			);
		}
		// 人が いても いなくても 歩ける マスは かわらない（人の マスの ほかは）
		const bare = survey(
			villageRows(v),
			villagePalette(v),
			places.filter((p) => !(p.id.startsWith("folk_") && p.sprite)),
			VILLAGE_SPOTS.boot,
		);
		const people = new Set(
			folk.filter((p) => p.sprite).map((p) => `${p.x},${p.y}`),
		);
		for (const k of bare.reach)
			ok(
				people.has(k) || s.reach.has(k),
				`stage ${v.stage}: folk cut off ${k}`,
			);
		// 遠回り：起きる所・扉・出口・乗り場・人通りの 立ちどまる 所から、どの マスへも 歩数が DETOUR_MAX より ふえない
		const rows = villageRows(v).map((r) => [...r]);
		const pal = villagePalette(v);
		const pass = (x: number, y: number) => !!pal[rows[y]?.[x] ?? ""]?.passable;
		const others = new Set(
			places
				.filter((p) => p.sprite && !p.id.startsWith("folk_"))
				.map((p) => `${p.x},${p.y}`),
		);
		const withFolk = new Set([...others, ...people]);
		const sources: (readonly [number, number])[] = [VILLAGE_SPOTS.boot];
		for (const p of places) {
			if (p.trigger === "touch") sources.push([p.x, p.y]);
			if (p.id.startsWith("trolley_"))
				for (const [dx, dy] of STEPS)
					if (pass(p.x + dx, p.y + dy)) sources.push([p.x + dx, p.y + dy]);
		}
		for (const n of crowdNodes(v)) sources.push([n.at[0], n.at[1]]);
		for (const src of sources) {
			const a = distances(pass, src, others);
			const b = distances(pass, src, withFolk);
			for (let i = 0; i < a.length; i++) {
				if (a[i] < 0 || (b[i] >= 0 && b[i] - a[i] <= DETOUR_MAX)) continue;
				const k = `${i % VILLAGE_W},${Math.floor(i / VILLAGE_W)}`;
				if (people.has(k)) continue;
				ok(
					false,
					`stage ${v.stage}: folk make ${src} → ${k} ${b[i] < 0 ? "unreachable" : `${b[i] - a[i]} steps longer`}`,
				);
			}
		}
		// 原住民が いる 村でも 原住民と モフちゃんに 話せる
		const owner = places.find((p) => p.id === "mob_shobon");
		if (owner) ok(s.talkable(owner), `stage ${v.stage}: 原住民 is walled in`);
	}
	ok(
		OWNER_VIEWS.some((v) =>
			villagePlaces(v).some((p) => p.id === "mob_shobon"),
		),
		"no 原住民",
	);
	ok(
		mofuWalk(0) !== mofuWalk(7) && mofuWalk(99) === mofuWalk(7),
		"モフちゃん by stage",
	);
	ok(
		FOLK_SPOTS.mofu[0] !== 7 || FOLK_SPOTS.mofu[1] !== 22,
		"モフちゃん on the shortcut",
	);
});

test("F7 機能の 墓場: 段2 から 神社の 上（x1〜7, y1〜3）。墓は 通れず、玉砂利は 通れ、(5,4)(7,4) から 入れる", () => {
	const f = facilityById("bochi");
	ok(f && f.from === BOCHI_FROM && f.at[0] === 1 && f.at[1] === 1, "no bochi");
	for (let stage = BOCHI_FROM; stage < TOWN_STAGES; stage++) {
		const v: VillageView = { stage, unlocked: ["shallow"], cleared: [] };
		const s = villageSurvey(v);
		for (const g of GRAVES)
			ok(
				!s.tile(g.at[0], g.at[1])?.passable,
				`stage ${stage}: grave ${g.id} is open`,
			);
		ok(!s.tile(MONUMENT[0], MONUMENT[1])?.passable, "monument is open");
		for (let x = 1; x <= 7; x++)
			ok(s.reach.has(`${x},2`), `stage ${stage}: path (${x},2) cut off`);
		for (const [x, y] of [
			[5, 3],
			[7, 3],
			[5, 4],
			[7, 4],
		])
			ok(s.reach.has(`${x},${y}`), `stage ${stage}: (${x},${y}) not reachable`);
	}
	const v1: VillageView = { stage: 1, unlocked: ["shallow"], cleared: [] };
	ok(
		!villagePlaces(v1).some((p) => p.id.startsWith("folk_grave_")),
		"graves at 1",
	);
	for (const ref of Object.values(FOLK_ART)) ok(ref.startsWith("pub:"), ref);
	for (const ref of [FOLK_WALK.odoru, FOLK_WALK.hira, mofuWalk(3)])
		ok(ref.startsWith("pub:") && !ref.includes("#"), ref);
});

test("F8 本館: バルス失敗ニキは レンガ館（段3〜5）と 本館（段6〜7）の すみ。寄り合いの 日も みんなに 届く", () => {
	for (let stage = 0; stage < TOWN_STAGES; stage++) {
		const v: VillageView = { stage, unlocked: ["shallow"], cleared: [] };
		const tier = hallTierOf(v);
		const places = hallPlaces(v);
		const b = places.find((p) => p.id === "balus");
		ok(!!b === tier >= 1, `stage ${stage}: balus ${!!b}`);
		if (!b) continue;
		ok(b.sprite === FOLK_WALK.balus, "balus looks like a 名無し");
		const yoriai = (YORIAI_SPOTS[tier] ?? []).map((p) => [p.x, p.y] as const);
		ok(!yoriai.some(([x, y]) => x === b.x && y === b.y), "on a yoriai spot");
		// バルス失敗ニキが いても いなくても 届く 物は かわらない（寄り合いの 日に 住人が 立っても）
		const others = places.filter((p) => p.id !== "balus");
		for (const i of [0, 1])
			for (const crowd of [[], yoriai]) {
				const s = survey(
					hallRows(tier),
					hallPalette(tier),
					places,
					hallEntry(tier, i),
					crowd,
				);
				const w = survey(
					hallRows(tier),
					hallPalette(tier),
					others,
					hallEntry(tier, i),
					crowd,
				);
				for (const p of places)
					if (p.trigger === "talk")
						ok(
							s.talkable(p) === (p.id === "balus" ? true : w.talkable(p)),
							`stage ${stage}: balus hides ${p.id} (entrance ${i}, ${crowd.length} at the 寄り合い)`,
						);
				if (!crowd.length)
					for (const p of places)
						if (p.trigger === "talk")
							ok(s.talkable(p), `stage ${stage}: cannot reach ${p.id}`);
			}
	}
});

test("F9 図書館・銭湯: 人工無能ニキと 2つの ガラスケース、番台の 左の メモ。人が みんな いても 物と 出口に 届く", () => {
	const rows = roomRows("library");
	const places = roomPlaces("library");
	const cases = places.filter((p) => p.id.startsWith("museum_"));
	ok(cases.length === 4, `${cases.length} case cells`);
	// 司書の 机の 前（机の 左）は あけておく
	const keeper = BOOKS_KEEPER.library;
	ok(
		roomPalette("library")[rows[keeper.y][keeper.x - 2]]?.passable,
		"the front of the 司書's desk is blocked",
	);
	const people: (readonly [number, number])[] = [
		[keeper.x, keeper.y],
		[12, 7],
		...BOOKS_BROWSE.library.map((p) => [p.x, p.y] as const),
		[IDEA_AT.x, IDEA_AT.y],
	];
	const keys = new Set(people.map(([x, y]) => `${x},${y}`));
	ok(keys.size === people.length, "two people on one cell");
	for (const p of places)
		ok(!keys.has(`${p.x},${p.y}`), `${p.id} under a person`);
	const e = roomEntry("library");
	// 人工無能ニキが いても いなくても、話せる 物は かわらない（立ち読みの 住人が 本棚の 前を ふさぐのは もとから）
	const without = survey(
		rows,
		roomPalette("library"),
		places,
		[e.x, e.y],
		people.slice(0, -1),
	);
	const s = survey(rows, roomPalette("library"), places, [e.x, e.y], people);
	ok(s.canEnter(IDEA_AT.x, IDEA_AT.y) === false, "idea seat is free");
	for (const p of places)
		if (p.trigger === "talk")
			ok(
				s.talkable(p) === without.talkable(p),
				`library: 人工無能ニキ hides ${p.id}`,
			);
	for (const p of cases) ok(s.talkable(p), `library: cannot reach ${p.id}`);
	for (const [mx, my] of roomMats("library"))
		ok(s.reach.has(`${mx},${my}`), "mat");
	for (const [x, y] of people)
		ok(s.talkable({ x, y }), `cannot talk to the one at ${x},${y}`);
	const egg = roomPlaces("bath").find((p) => p.id.startsWith("egg_"));
	ok(egg && egg.x === 7 && egg.y === 11, `egg at ${egg?.x},${egg?.y}`);
});

test("F10 歩行グラ: ダジャレニキは 通行人に いて「そうそう…やないかーい」。folk の 絵は どれも ほかの 人・敵・店番・通行人と かぶらない", () => {
	const p = PERSONAS.find((q) => q.id === "dajare");
	ok(p, "no dajare");
	for (const l of [
		...(p?.lines ?? []),
		...Object.values(p?.bandLines ?? {}).flat(),
	])
		ok(l.includes("やないかーい") && l.startsWith("そうそう"), l);
	const mine = [
		...Object.values(FOLK_WALK),
		...Array.from({ length: 8 }, (_, i) => mofuWalk(i)),
		...(p?.sprites ?? []),
	];
	ok(new Set(mine).size === mine.length, "folk sheets repeat");
	const named = [
		...Object.values(MONSTERS).map((m) => m.sprite),
		...Object.values(CAST).map((c) => c.walk),
		...Object.values(MOBS).map((m) => m.sprite),
		...NANASHI_WALK,
		...YAJI_WALK,
	];
	// 施設の 店番・外の 人（ほかの パッケージの 部室・店も ここに 入る）と ほかの 通行人
	const elsewhere = JSON.stringify([
		named,
		FACILITIES,
		PERSONAS.filter((q) => q.id !== "dajare").map((q) => q.sprites),
	]);
	for (const sheet of mine)
		ok(!elsewhere.includes(`"${sheet}"`), `${sheet} is someone else's too`);
});

// ───────────────── 話し方 ─────────────────

test("F11 帰りごとに 1つ：ひらがなニキ・なぞなぞ仮面・バルス失敗ニキ・人工無能ニキは 帰ると 次へ、同じ 帰りは みじかく", async () => {
	await withStorage(async () => {
		const H = FOLK_NAMES.hira;
		comeBack(1000);
		// ひらがなニキ
		let t = fakeStory();
		await hiraScript("folk_hira", "left")(t.s);
		ok(
			t.log.join("\n") ===
				[HIRA.intro, ...hiraEntry(0)].map((l) => `say ${H}: ${l}`).join("\n"),
			t.log.join("\n"),
		);
		t = fakeStory();
		await hiraScript("folk_hira", "left")(t.s);
		ok(t.log.join() === `say ${H}: ${HIRA.again}`, t.log.join("\n"));
		comeBack(2000, 1000);
		t = fakeStory();
		await hiraScript("folk_hira", "left")(t.s);
		ok(
			t.log.join("\n") ===
				hiraEntry(1)
					.map((l) => `say ${H}: ${l}`)
					.join("\n"),
			t.log.join("\n"),
		);
		comeBack(3000, 2000, 1000);
		await hiraScript("folk_hira", "left")(fakeStory().s);
		// 2回 帰って 1回だけ 話した → 「忘れたンゴ……」の あと 3位
		comeBack(5000, 4000, 3000, 2000, 1000);
		t = fakeStory();
		await hiraScript("folk_hira", "left")(t.s);
		ok(
			t.log[0] === `say ${H}: ${hiraForgot(1, 3)}` &&
				t.log[1] === `say ${H}: ${hiraEntry(3)[0]}`,
			t.log.join("\n"),
		);
		ok(loadFolk().hira === 4, `hira ${loadFolk().hira}`);
		// なぞなぞ仮面：やめると 同じ 帰りは 同じ 問題、答えると again
		comeBack(6000);
		t = fakeStory([3]);
		await nazoScript("folk_nazo", "up")(t.s);
		ok(
			t.log.includes(`say ${FOLK_NAMES.nazo}: ${NAZO.intro}`),
			t.log.join("\n"),
		);
		ok(
			t.log.includes(`say ${FOLK_NAMES.nazo}: ${NAZO.flee}`),
			t.log.join("\n"),
		);
		const r = RIDDLES[0];
		t = fakeStory([r.answer]);
		await nazoScript("folk_nazo", "up")(t.s);
		ok(
			t.log[0] === `say ${FOLK_NAMES.nazo}: ${r.q}` &&
				t.log.includes("se critical"),
			t.log.join("\n"),
		);
		ok(
			loadFolk().nazo === 1 && loadFolk().nazoDone,
			JSON.stringify(loadFolk()),
		);
		t = fakeStory();
		await nazoScript("folk_nazo", "up")(t.s);
		ok(
			t.log.join() === `say ${FOLK_NAMES.nazo}: ${NAZO.again}`,
			t.log.join("\n"),
		);
		comeBack(7000);
		t = fakeStory([RIDDLES[1].plain]);
		await nazoScript("folk_nazo", "up")(t.s);
		ok(
			t.log.includes(
				`say ${FOLK_NAMES.nazo}: ${nazoResult(RIDDLES[1], RIDDLES[1].plain)[0]}`,
			) && t.log.some((l) => l.includes("🎭不正解")),
			t.log.join("\n"),
		);
		// バルス失敗ニキ：帰りごとに 1回、同じ 帰りは「……てすや」
		t = fakeStory();
		await balusScript("balus", "left")(t.s);
		ok(
			t.log[0] === `say ${balusName(1)}: ${BALUS_BEATS[0].lines[0].text}`,
			t.log.join("\n"),
		);
		ok(
			t.log.some((l) => l.startsWith("narrate: 禁断呪文")),
			t.log.join("\n"),
		);
		t = fakeStory();
		await balusScript("balus", "left")(t.s);
		ok(
			t.log.join() === `say ${balusName(1)}: ${BALUS.again}`,
			t.log.join("\n"),
		);
		comeBack(8000);
		t = fakeStory();
		await balusScript("balus", "left")(t.s);
		ok(
			t.log[0] === `say ${balusName(2)}: ${BALUS_BEATS[1].lines[0].text}`,
			t.log.join("\n"),
		);
		// 人工無能ニキ：返事は 入れかわり、10個で 構想10年
		for (let i = 0; i < 10; i++) {
			comeBack(10000 + i);
			t = fakeStory([i % 3]);
			await ideaScript("folk_idea", "up")(t.s);
			ok(
				t.log.includes(`say ${FOLK_NAMES.idea}: ${ideaOk(i)}`),
				t.log.join("\n"),
			);
			ok(
				t.log.filter((l) => l.startsWith("say")).length <= 3,
				t.log.join("\n"),
			);
		}
		ok(
			t.log.at(-1) === `say ${FOLK_NAMES.idea}: ${IDEA.ten}`,
			t.log.join("\n"),
		);
		ok(loadFolk().idea === 10, "ideas");
	});
});

test("F12 墓場：ロリードは 調べる たびに 入れかわり、草ボタンは やめるまで 押せて 10回目で きうり、村の イベントは 墓と 人を 組む", async () => {
	await withStorage(async () => {
		const t = fakeStory();
		for (let i = 0; i < 3; i++) await graveScript("rolli")(t.s);
		ok(
			t.log.join("\n") ===
				[0, 1, 2].map((k) => `narrate: ${rolliLine(k)}`).join("\n"),
			t.log.join("\n"),
		);
		const k = fakeStory([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
		await graveScript("kusa")(k.s);
		ok(loadFolk().kusa === 10, `kusa ${loadFolk().kusa}`);
		ok(k.log.includes(`narrate: ${GRAVE.kusaTen}`), k.log.join("\n"));
		ok(k.log.filter((l) => l.startsWith("choose")).length === 11, "menu");
		const again = fakeStory();
		await graveScript("kusa")(again.s);
		ok(
			again.log[0] ===
				`narrate: ${GRAVE.kusaNow.replace("{w}", "きうり　1本")}`,
			again.log.join("\n"),
		);
		const v: VillageView = { stage: 7, unlocked: ["shallow"], cleared: [] };
		for (const p of villagePlaces(v).filter((q) => q.id.startsWith("folk_"))) {
			const e = folkEvent(p, v);
			ok(e.id === p.id && typeof e.run === "function", `${p.id} has no script`);
			ok(!!e.when === (p.id === "folk_odoru"), `${p.id} when`);
			ok((e.sprite ?? "") === (p.sprite ?? ""), `${p.id} sprite`);
		}
		ok(
			FOLK_SPOTS.odoru[0] === 16 &&
				villagePlaces(v).find((p) => p.id === "folk_odoru")?.wander === true,
			"おどちゃん does not dance",
		);
	});
});

test("F13 下見（?stage=）: 進んでも 保存は 書かない", async () => {
	await withStorage(async () => {
		comeBack(1000);
		const restore = swapLocation("?debug&stage=3");
		try {
			await hiraScript("folk_hira", "left")(fakeStory().s);
			ok(loadFolk().hira === 1, "the preview forgot");
			ok(
				localStorage.getItem("kiriko-roguelike/folk") === null,
				"the preview wrote the save",
			);
		} finally {
			restore();
		}
		forgetFolkMemo();
		ok(loadFolk().hira === 0, "the preview stuck");
	});
});

test("F14 絵: folk.png は 96x16、ひらがなニキ・モフちゃん（段 0〜7）・おどちゃんは 32x64 の 歩行グラ（scripts/make-folk.mjs）", () => {
	const size = (file: string): [number, number] => {
		const b = readFileSync(join(process.cwd(), "public", file));
		return [b.readUInt32BE(16), b.readUInt32BE(20)];
	};
	const [w, h] = size("sprites/folk.png");
	ok(w === 96 && h === 16, `folk.png is ${w}x${h}`);
	for (const ref of Object.values(FOLK_ART)) {
		const [x, y, cw, ch] = ref.split("#")[1].split(",").map(Number);
		ok(
			x + cw <= w && y + ch <= h && cw === 16 && ch === 16,
			`${ref} is outside`,
		);
	}
	for (const ref of [
		...Array.from({ length: 8 }, (_, i) => mofuWalk(i)),
		FOLK_WALK.odoru,
		FOLK_WALK.hira,
	]) {
		const [sw, sh] = size(ref.slice("pub:".length));
		ok(sw === 32 && sh === 64, `${ref} is ${sw}x${sh}`);
	}
});

export const runFolkTests = async (): Promise<TestResult[]> => {
	const out: TestResult[] = [];
	for (const c of CASES) {
		try {
			await c.run();
			out.push({ id: "folk", name: c.name, ok: true });
		} catch (e) {
			out.push({
				id: "folk",
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			});
		}
	}
	return out;
};
