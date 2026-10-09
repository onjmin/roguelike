// 季節の 行事の 試験（pnpm test で いっしょに 動く。STORY.md §5.75 季節の 行事）。
// 日替わり（data/openModes.ts）・おんJ芋煮会（data/imoni.ts・ui/imoni.ts・data/village/season.ts）・
// どすこいポイント（data/dosukoi.ts・ui/dosukoi.ts）。
// 日付・年・帰りは みな 引数で 渡す（端末の 日付・時刻に よらない。10月でも 8/5 でも 同じ 結果）。
// 形は civicTests と 同じ（Fail・ok・{ id, name, ok, reason }）。id の 頭は S。

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DungeonId } from "../core/types";
import * as bathTexts from "../data/bath";
import * as cafeTexts from "../data/cafe";
import * as cafeMobTexts from "../data/cafeMobs";
import { openModeOf, seasonOf, type Today } from "../data/calendar";
import * as civicTexts from "../data/civic";
import {
	DOSUKOI,
	DOSUKOI_GAINS,
	DOSUKOI_SHOW_MAX,
	type DosukoiRec,
	dosukoiStep,
	emptyDosukoi,
	forgetDosukoiMemo,
	loadDosukoi,
	saveDosukoi,
} from "../data/dosukoi";
import * as eateryTexts from "../data/eateries";
import * as facilityTexts from "../data/facilities";
import * as guestTexts from "../data/guests";
import * as hallTexts from "../data/hall";
import {
	emptyImoni,
	forgetImoniMemo,
	IMONI,
	IMONI_ART,
	IMONI_OPEN_DAY,
	IMONI_OPEN_RETURN,
	IMONI_POT,
	IMONI_POT_THING,
	IMONI_SCENE,
	IMONI_STAFF,
	type ImoniKon,
	type ImoniPhase,
	type ImoniRec,
	imoniForce,
	imoniKon,
	imoniPhase,
	imoniReason,
	imoniReturns,
	imoniVisit,
	imoniWeek,
	loadImoni,
	saveImoni,
} from "../data/imoni";
import * as mobTexts from "../data/mobs";
import {
	EMOJI_LINE_WIDTH,
	modesHeld,
	modeText,
	rawModes,
	TRICK_SWEETS,
	WINDOW_WIDTH,
	windowWidth,
} from "../data/openModes";
import * as pianoTexts from "../data/piano";
import * as quoteTexts from "../data/quotes";
import * as roomTexts from "../data/rooms";
import * as scrapTexts from "../data/scraps";
import * as storyTexts from "../data/story";
import * as tipTexts from "../data/tips";
import * as townTexts from "../data/town";
import * as crowdTexts from "../data/village/crowd";
import * as villageFacilityTexts from "../data/village/facilities";
import {
	FACILITIES,
	type Facility,
	facilityBlock,
	facilityById,
	outdoorId,
} from "../data/village/facilities";
import * as villageHallTexts from "../data/village/hall";
import {
	type Cell,
	lineupSpots,
	VILLAGE_EXITS,
	VILLAGE_SPOTS,
	type VillageView,
	villagePalette,
	villagePlaces,
	villageRows,
} from "../data/village/map";
import * as trolleyTexts from "../data/village/trolley";
import type { Story, VState } from "../engine/defs";
import type { Ctx } from "../ui/ctx";
import { dosukoiWindow } from "../ui/dosukoi";
import {
	type ImoniEnv,
	imoniBoardMenu,
	imoniBoardScript,
	imoniDecor,
	imoniPot,
	imoniStaff,
} from "../ui/imoni";
import { buildVillage } from "../ui/villageEvents";
import { fill } from "../ui/villageTalk";
import { NG } from "./civicTests";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};
const eq = (got: unknown, want: unknown, why: string): void =>
	ok(
		JSON.stringify(got) === JSON.stringify(want),
		`${why}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`,
	);

const CASES: { id: string; name: string; run: () => void | Promise<void> }[] =
	[];
const test = (id: string, name: string, run: () => void | Promise<void>) =>
	CASES.push({ id, name, run });

/** 全角=1・半角=0.5 で 数えた 幅（villageTests と 同じ）。 */
const width = (line: string): number =>
	[...line].reduce((w, ch) => w + (/[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);

/** 村の 窓（2行まで・1行 全角22字）。埋めて いない {…} も だめ。 */
const fitsWindow = (where: string, text: string): void => {
	const lines = text.split("\n");
	ok(lines.length <= 2, `${where}: ${lines.length} lines in "${text}"`);
	for (const l of lines)
		ok(width(l) <= 22, `${where}: "${l}" is ${width(l)} wide (> 22)`);
	ok(!/\{\w+\}/.test(text), `${where}: an unfilled {…} in "${text}"`);
};

/** ★ 以外の 絵文字。 */
const EMOJI = /(?!★)\p{Extended_Pictographic}/u;
const EMOJI_G = /(?!★)\p{Extended_Pictographic}/gu;
const emojiCount = (s: string): number => (s.match(EMOJI_G) ?? []).length;

/** 文字列を ぜんぶ 拾う（日本語を ふくむ もの。絵の 指定は のぞく）。 */
const collect = (root: unknown, label: string, out: Map<string, string>) => {
	const seen = new Set<unknown>();
	const walk = (v: unknown, where: string, depth: number): void => {
		if (depth > 12 || v === null || v === undefined) return;
		if (typeof v === "string") {
			if (
				/\P{ASCII}/u.test(v) &&
				!v.startsWith("pub:") &&
				!v.startsWith("sa:") &&
				!out.has(v)
			)
				out.set(v, where);
			return;
		}
		if (typeof v !== "object" || seen.has(v)) return;
		seen.add(v);
		if (Array.isArray(v))
			for (const [i, x] of v.entries()) walk(x, `${where}[${i}]`, depth + 1);
		else
			for (const [k, x] of Object.entries(v as Record<string, unknown>))
				walk(x, `${where}.${k}`, depth + 1);
	};
	walk(root, label, 0);
};

/** 地の文・セリフ・選ぶ・音・歩く・暗転を 記録する 台本の 相手（選ぶ ときは picks を 順に 返す）。 */
const recorder = (picks: number[] = [], at: Cell = [1, 34]) => {
	const log: string[] = [];
	const p = [...picks];
	const state: VState = { x: at[0], y: at[1], dir: "down", flags: {} };
	const s = new Proxy({} as Story, {
		get: (_t, k) => {
			if (k === "state") return state;
			if (k === "narrate")
				return async (t: string) => {
					log.push(`narrate: ${t}`);
				};
			if (k === "say")
				return async (w: unknown, t: string, o?: { name?: string }) => {
					log.push(`say(${o?.name ?? String(w)}): ${t}`);
				};
			if (k === "choose")
				return async (opts: string[]) => {
					log.push(`choose: ${opts.join("/")}`);
					return p.shift() ?? 0;
				};
			if (k === "se")
				return (n: string) => {
					log.push(`se ${n}`);
				};
			if (k === "goto")
				return async (id: string, x: number, y: number) => {
					log.push(`goto ${id} ${x},${y}`);
				};
			if (k === "fadeOut" || k === "fadeIn" || k === "rebuild")
				return async () => {
					log.push(String(k));
				};
			if (k === "then") return undefined;
			return () => undefined;
		},
	});
	return { s, log };
};

/** localStorage を 試験の あいだだけ 差しかえる（覚えている 写しも 前後で 捨てる）。 */
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
	forgetImoniMemo();
	forgetDosukoiMemo();
	return {
		store,
		restore: () => {
			forgetImoniMemo();
			forgetDosukoiMemo();
			if (prev) Object.defineProperty(globalThis, "localStorage", prev);
			else delete (globalThis as { localStorage?: unknown }).localStorage;
		},
	};
};

/** 差しかえた 保存の 中で fn を 動かす。 */
const withStorage = async (
	fn: (store: Map<string, string>) => void | Promise<void>,
): Promise<void> => {
	const { store, restore } = swapStorage();
	try {
		await fn(store);
	} finally {
		restore();
	}
};

/** 試験の 年と 帰り（端末の 年には よらない）。 */
const Y = 2031;
const A = 4242;
const day = (m: number, d: number): Today => ({ m, d, w: 0 });

/** 一品の 板を 記録に 書く 試験の 環境。 */
const env = (log: string[], o: Partial<ImoniEnv> = {}): ImoniEnv => ({
	year: Y,
	at: A,
	phase: "open",
	noSave: false,
	yakiuHere: true,
	show: async (art, t) => {
		log.push(`show ${art} ${t}`);
	},
	...o,
});

const rec = (o: Partial<ImoniRec> = {}): ImoniRec => ({
	...emptyImoni(),
	...o,
});

/** 段0〜7 × 開いた ダンジョン（浅い・本線・深い。持ち帰りは 最後の 1つ 以外）。 */
const UNLOCKS: readonly (readonly DungeonId[])[] = [
	["shallow"],
	["shallow", "main"],
	["shallow", "main", "deep"],
];
const VIEWS: VillageView[] = [];
for (let stage = 0; stage < 8; stage++)
	for (const unlocked of UNLOCKS)
		VIEWS.push({ stage, unlocked, cleared: unlocked.slice(0, -1) });
const label = (v: VillageView): string => `stage ${v.stage} [${v.unlocked}]`;

const key = (x: number, y: number): string => `${x},${y}`;
const D4: readonly Cell[] = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
];
const POT_CELLS: readonly Cell[] = [
	[IMONI_POT[0], IMONI_POT[1]],
	[IMONI_POT[0] + 1, IMONI_POT[1]],
	[IMONI_POT[0], IMONI_POT[1] + 1],
	[IMONI_POT[0] + 1, IMONI_POT[1] + 1],
];
const STAFF_CELLS: readonly Cell[] = [
	IMONI_STAFF.chair,
	IMONI_STAFF.pro,
	IMONI_STAFF.anti,
];
const SCENE_CELLS: readonly Cell[] = [IMONI_SCENE.puyu, IMONI_SCENE.yakiu];

/** その 村で、壁（かまど・名無し・見える 人や 物 ぜんぶ）を よけて 歩ける マス。 */
const walkMap = (v: VillageView) => {
	const rows = villageRows(v).map((r) => [...r]);
	const pal = villagePalette(v);
	const places = villagePlaces(v);
	const walls = new Set<string>(
		[
			...POT_CELLS,
			...STAFF_CELLS,
			...places.filter((p) => p.sprite).map((p) => [p.x, p.y] as Cell),
		].map(([x, y]) => key(x, y)),
	);
	const open = (x: number, y: number): boolean =>
		!!pal[rows[y]?.[x] ?? ""]?.passable && !walls.has(key(x, y));
	const reach = (sx: number, sy: number): Set<string> => {
		const seen = new Set([key(sx, sy)]);
		const q: Cell[] = [[sx, sy]];
		for (let i = 0; i < q.length; i++) {
			const [x, y] = q[i];
			for (const [dx, dy] of D4) {
				const k = key(x + dx, y + dy);
				if (seen.has(k) || !open(x + dx, y + dy)) continue;
				seen.add(k);
				q.push([x + dx, y + dy]);
			}
		}
		return seen;
	};
	return { rows, pal, places, open, reach };
};

const mustImoni = (): Facility => {
	const f = facilityById("imoni");
	if (!f) throw new Fail("no imoni facility");
	return f;
};

// ───────────────── 日替わり ─────────────────

/** 村の 文の 出どころ（ui/village.ts の say を 通る 文を もつ もの）。 */
const TEXT_MODULES: readonly [string, unknown][] = [
	["town", townTexts],
	["mobs", mobTexts],
	["cafeMobs", cafeMobTexts],
	["cafe", cafeTexts],
	["village/facilities", villageFacilityTexts],
	["eateries", eateryTexts],
	["facilities", facilityTexts],
	["village/crowd", crowdTexts],
	["village/hall", villageHallTexts],
	["hall", hallTexts],
	["civic", civicTexts],
	["guests", guestTexts],
	["bath", bathTexts],
	["rooms", roomTexts],
	["story", storyTexts],
	["quotes", quoteTexts],
	["tips", tipTexts],
	["scraps", scrapTexts],
	["piano", pianoTexts],
	["village/trolley", trolleyTexts],
];

test(
	"S1",
	"日替わり：村の 文 ぜんぶ 猫の日・博多弁・トリックで 行の 数が かわらず、22字に 収まる 行は 収まった まま",
	() => {
		const strings = new Map<string, string>();
		for (const [name, mod] of TEXT_MODULES) collect(mod, name, strings);
		collect(IMONI, "IMONI", strings);
		collect(DOSUKOI, "DOSUKOI", strings);
		const changed = { neko: 0, hakata: 0, trick: 0 };
		for (const mode of ["neko", "hakata", "trick"] as const)
			for (const [t, where] of strings) {
				const out = modeText(t, mode);
				const at = `${mode} ${where}`;
				const a = t.split("\n");
				const b = out.split("\n");
				ok(a.length === b.length, `${at}: lines ${JSON.stringify(out)}`);
				for (let i = 0; i < a.length; i++) {
					const wa = windowWidth(a[i]);
					const wb = windowWidth(b[i]);
					ok(
						wa > WINDOW_WIDTH || wb <= WINDOW_WIDTH,
						`${at}: "${b[i]}" is ${wb} wide`,
					);
					ok(wa <= WINDOW_WIDTH || a[i] === b[i], `${at}: touched "${a[i]}"`);
				}
				ok(!out.includes("\u0001"), `${at}: marker left`);
				ok(!/にゃ[)）]/.test(out), `${at}: にゃ inside a bracket "${out}"`);
				ok(!out.includes("なクサ"), `${at}: なクサ in "${out}"`);
				if (mode === "trick" && out !== t) {
					ok(
						TRICK_SWEETS.some((s) => out === `${t}${s}`),
						`${at}: not one sweet at the end "${out}"`,
					);
					const last = a[a.length - 1];
					const lastOut = b[b.length - 1];
					ok(
						windowWidth(lastOut) + emojiCount(last) <= EMOJI_LINE_WIDTH,
						`${at}: emoji line too wide "${lastOut}"`,
					);
				}
				if (mode !== "trick")
					ok(
						emojiCount(out) === emojiCount(t),
						`${at}: emoji count changed "${out}"`,
					);
				if (out !== t) changed[mode]++;
			}
		ok(changed.neko >= 3000, `neko changed only ${changed.neko}`);
		ok(changed.hakata >= 1000, `hakata changed only ${changed.hakata}`);
		ok(changed.trick >= 3000, `trick changed only ${changed.trick}`);
	},
);

/** 見本（おんJwiki 632・258・595 と 2025/10/31 の スレの 形）。 */
const GOLDEN: readonly (readonly [
	"neko" | "hakata" | "trick",
	string,
	string,
])[] = [
	["neko", "これ　なおせないのか", "これ　にゃおせにゃいのかにゃ"],
	["neko", "かわいいわよね", "かわいいわよねにゃ"],
	["neko", "いもわ？🥺", "いもわにゃ？🥺"],
	[
		"neko",
		"ナイター　見たいから　中止です",
		"ニャイター　見たいから　中止ですにゃ",
	],
	["neko", "……", "……"],
	["neko", "……(´・ω・｀)", "……(´・ω・｀)にゃ"],
	[
		"neko",
		"おなか　すいて　たおれたの。\n……(´；ω；｀)",
		"おにゃか　すいて　たおれたの。\n……(´；ω；｀)にゃ",
	],
	[
		"neko",
		"はり紙。\n『おんJ芋煮会　中止の　お知らせ』",
		"はり紙。\n『おんJ芋煮会　中止の　お知らせ』にゃ",
	],
	[
		"neko",
		"粋な　計らい（好感度上げとく）",
		"粋にゃ　計らい（好感度上げとく）にゃ",
	],
	["neko", "草ｗｗ", "草にゃｗｗ"],
	[
		"neko",
		"あいうえおかきくけこさしすせそたちつてとなに",
		"あいうえおかきくけこさしすせそたちつてとなに",
	],
	["hakata", "おはよう", "おはようしゃん"],
	["hakata", "うるさい", "しぇからしか"],
	["hakata", "さとるの　フケや", "さっとるの　フケばい"],
	["hakata", "こんな　村", "こぎゃん　村"],
	["hakata", "本当に　ええ　村や", "ほんまに　ええ　村ばい"],
	["hakata", "お前、どこの　スレの　もんや", "貴様、どこの　スレの　もんばい"],
	["hakata", "ロゼさん、ええよ", "ロゼしゃん、ええクサ"],
	["hakata", "キリコを　よろしく", "キリコば　よろしく"],
	["hakata", "しょうがない", "しょうがなか"],
	["hakata", "そんな　ことなら　いい", "そげん　ことなら　よか"],
	["hakata", "雨は　降るなよ", "雨は　降るなよ"],
	["hakata", "かわいい", "かわいい"],
	["hakata", "まだ", "まだ"],
	[
		"hakata",
		"……胸の　あたりに、計算できない\n値が　あるゼロ",
		"……胸の　あたりに、計算できない\n値が　あるゼロ",
	],
	[
		"hakata",
		"……いっしょに　ぽわぽわ\nしよ〜",
		"……いっしょに　ぽわぽわ\nしよ〜",
	],
	["hakata", "はっや。……なんや、その　顔。", "はっや。……なんや、その　顔。"],
	["trick", "ええ　村や", "ええ　村や🎃"],
	["trick", "……いも、あったゆ🥺", "……いも、あったゆ🥺🍫"],
	["trick", "参加費は、あとで　請求します", "参加費は、あとで　請求します🍪"],
	["trick", "雨は　降るなよ\nええ　村や", "雨は　降るなよ\nええ　村や🍪"],
	[
		"trick",
		"あいうえおかきくけこさしすせそたちつてとな",
		"あいうえおかきくけこさしすせそたちつてとな",
	],
];

test("S2", "日替わり：見本 32組（猫の日・強制博多弁・トリック）", () => {
	ok(GOLDEN.length === 32, `${GOLDEN.length} goldens`);
	for (const [mode, t, want] of GOLDEN)
		eq(modeText(t, mode), want, `${mode} "${t}"`);
});

test(
	"S3",
	"日替わり：2/22 猫の日・4/1 博多弁・10/31 トリック だけ。期間限定の 日は そのまま",
	() => {
		eq(
			[openModeOf(2, 22), openModeOf(4, 1), openModeOf(10, 31)],
			["neko", "hakata", "trick"],
			"open modes",
		);
		for (const [m, d] of [
			[2, 14],
			[1, 1],
			[10, 30],
			[2, 21],
			[4, 2],
			[11, 1],
		])
			ok(openModeOf(m, d) === null, `${m}/${d} has a mode`);
		ok(seasonOf(4, 1) === "april", "4/1 is still april");
		ok(seasonOf(10, 31) === "halloween", "10/31 is still halloween");
	},
);

test(
	"S4",
	"日替わり：住人の はじめましてと 節目（rawModes）の あいだだけ 止まる。入れ子・投げても もどる",
	async () => {
		ok(!modesHeld(), "held before");
		const got = await rawModes(async () => {
			ok(modesHeld(), "not held inside");
			await rawModes(async () => {
				ok(modesHeld(), "not held when nested");
			});
			ok(modesHeld(), "released by the nested one");
			return 7;
		});
		ok(got === 7, "rawModes does not pass the value through");
		ok(!modesHeld(), "held after");
		let threw = false;
		try {
			await rawModes(async () => {
				throw new Error("x");
			});
		} catch {
			threw = true;
		}
		ok(threw, "rawModes swallowed the error");
		ok(!modesHeld(), "held after a throw");
	},
);

// ───────────────── 文 ─────────────────

/** 出荷の 文に 使わない 語（civicTests の NG に 足す。この 包みの 元ネタに 近い 語）。 */
const SEASON_NG = [
	"マイクラ",
	"Minecraft",
	"クリーパー",
	"オセロ",
	"うんこ",
	"うんち",
	"114514",
	"1919",
	"810",
	"国技館",
	"レターパック",
	"WBC",
	"山形",
	"頭プルプル",
	"🖕",
];

test(
	"S5",
	"芋煮会・どすこい：窓は 2行・22字、えらぶ 字は 10字まで、ぷゆゆは 🥺 1つで 21字まで、絵文字は ほかに なし、使わない 語なし",
	() => {
		const texts: [string, string][] = [];
		const all = new Map<string, string>();
		collect(IMONI, "IMONI", all);
		collect(DOSUKOI, "DOSUKOI", all);
		for (const [t, where] of all)
			if (!/\{\w+\}/.test(t)) texts.push([where, t]);
		for (const g of DOSUKOI_GAINS)
			texts.push([`gain ${g}`, DOSUKOI.gain.replace("{n}", String(g))]);
		for (const where of ["窓口", "住民課"]) {
			for (const n of [170, DOSUKOI_SHOW_MAX])
				texts.push([
					`balance ${where} ${n}`,
					fill(DOSUKOI.balance, { where, n }),
				]);
			for (const l of DOSUKOI.lapse)
				texts.push([`lapse ${where}`, fill(l, { where })]);
		}
		for (const [w, t] of texts) {
			fitsWindow(w, t);
			for (const n of [...NG, ...SEASON_NG])
				ok(!t.includes(n), `${w}: "${n}" in "${t}"`);
			ok(!/アカ(?!ウント)/.test(t), `${w}: アカ in "${t}"`);
			for (const m of t.matchAll(/保守(.?)/g))
				ok(
					m[1] !== undefined && m[1] !== "" && "町市村地".includes(m[1]),
					`${w}: 保守 is not a place name in "${t}"`,
				);
		}
		for (const o of [
			IMONI.board.menu,
			...IMONI.open.options,
			...IMONI.open.more,
			...DOSUKOI.options,
		])
			ok(width(o) <= 10, `"${o}" is too wide for a choice`);
		const puyu = new Set<string>(IMONI.open.puyu);
		for (const [w, t] of texts) {
			if (puyu.has(t)) {
				ok(
					emojiCount(t) === 1 && t.endsWith("🥺") && !t.includes("\n"),
					`${w}: ぷゆゆ needs one 🥺 at the end "${t}"`,
				);
				ok(width(t) <= 21, `${w}: ぷゆゆ line too wide "${t}"`);
			} else ok(!EMOJI.test(t), `${w}: emoji in "${t}"`);
		}
	},
);

// ───────────────── 芋煮会：日と 帰り ─────────────────

test(
	"S6",
	"芋煮会：週と 10月の 帰りの 数え・段階（中止の はり紙 → 4回目の 帰りか 22日から 強行開催 → 来年の 中止）・中止の わけ",
	() => {
		for (const [d, w] of [
			[1, 0],
			[7, 0],
			[8, 1],
			[14, 1],
			[15, 2],
			[21, 2],
			[31, 2],
		])
			ok(imoniWeek(d) === w, `imoniWeek(${d}) = ${imoniWeek(d)}`);
		// 10月の 帰りを 数える
		const r0 = rec();
		ok(imoniVisit(r0, day(9, 30), Y, A) === r0, "September counted");
		const r1 = imoniVisit(r0, day(10, 1), Y, A);
		eq([r1.octYear, r1.octN, r1.octAt], [Y, 1, A], "first October return");
		ok(imoniVisit(r1, day(10, 2), Y, A) === r1, "same return counted twice");
		const r2 = imoniVisit(r1, day(10, 2), Y, A + 1);
		eq([r2.octYear, r2.octN, r2.octAt], [Y, 2, A + 1], "second return");
		const r3 = imoniVisit(r2, day(10, 1), Y + 1, A + 2);
		eq([r3.octYear, r3.octN, r3.octAt], [Y + 1, 1, A + 2], "a new year");
		ok(imoniReturns(r2, Y) === 2 && imoniReturns(r2, Y + 1) === 0, "returns");
		// 段階
		const fresh = rec();
		ok(imoniPhase(day(9, 30), Y, fresh, A) === "off", "9/30");
		ok(imoniPhase(day(11, 1), Y, fresh, A) === "off", "11/1");
		ok(imoniPhase(day(10, 1), Y, fresh, A) === "notice", "10/1");
		ok(imoniPhase(day(10, 21), Y, fresh, A) === "notice", "10/21");
		ok(
			imoniPhase(day(10, IMONI_OPEN_DAY), Y, fresh, A) === "open",
			"10/22 is not open",
		);
		const third = rec({ octYear: Y, octN: IMONI_OPEN_RETURN - 1, octAt: A });
		const fourth = rec({ octYear: Y, octN: IMONI_OPEN_RETURN, octAt: A });
		ok(imoniPhase(day(10, 1), Y, third, A) === "notice", "3rd return");
		ok(imoniPhase(day(10, 1), Y, fourth, A) === "open", "4th return");
		ok(
			imoniPhase(day(10, 1), Y + 1, fourth, A) === "notice",
			"last year's returns count",
		);
		const held = rec({ held: Y, heldAt: A, kon: "in", ever: true });
		ok(imoniPhase(day(10, 25), Y, held, A) === "open", "same return → open");
		ok(imoniPhase(day(10, 25), Y, held, A + 1) === "done", "later → done");
		ok(imoniPhase(day(11, 2), Y, held, A + 1) === "off", "November → off");
		ok(imoniPhase(day(10, 3), Y + 1, held, A + 1) === "notice", "next year");
		ok(imoniKon(held, Y) === "in" && imoniKon(held, Y + 1) === null, "kon");
		// 中止の わけ（週か、帰りの 回数の 進んだ 方）
		for (const [d, want] of [
			[1, 0],
			[8, 1],
			[15, 2],
			[31, 2],
		])
			ok(imoniReason(day(10, d), Y, fresh) === want, `reason on 10/${d}`);
		for (const [n, want] of [
			[1, 0],
			[2, 1],
			[3, 2],
			[9, 2],
		])
			ok(
				imoniReason(day(10, 1), Y, rec({ octYear: Y, octN: n })) === want,
				`reason after ${n} returns`,
			);
		ok(
			imoniReason(day(10, 1), Y, rec({ octYear: Y - 1, octN: 3 })) === 0,
			"last year's returns move the reason",
		);
	},
);

// ───────────────── 芋煮会：置き場所 ─────────────────

test(
	"S7",
	"芋煮会：浜の すみの かまど（段0〜、2x2、影なし）と 大鍋・名無しの マス。鍋は (1,34)・(2,35) から だけ 読める。並ぶ マス・場面の マスを ふさがない",
	() => {
		const f = mustImoni();
		const i = FACILITIES.indexOf(f);
		const ch = FACILITIES.findIndex((x) => x.id === "cityhall");
		ok(ch >= 0 && i > ch, `imoni (${i}) is not after cityhall (${ch})`);
		ok(f.from === 0, `from ${f.from}`);
		ok(!f.room, "the pot has a room");
		ok(
			f.look.kind === "grid" &&
				f.look.shadow === false &&
				f.look.rows.length === 2 &&
				f.look.rows.every((r) => r.length === 2),
			"look is not a 2x2 grid without shadow",
		);
		eq(f.at, IMONI_POT, "at");
		const things = new Map((f.outdoor ?? []).map((t) => [t.id, t]));
		eq([...things.keys()], ["pot", "chair", "pro", "anti"], "outdoor things");
		eq(things.get("pot")?.at, IMONI_POT_THING, "pot thing");
		ok(!things.get("pot")?.when && !things.get("pot")?.sprite, "pot hidden");
		for (const id of ["chair", "pro", "anti"] as const) {
			const t = things.get(id);
			eq(t?.at, IMONI_STAFF[id], `${id} at`);
			ok(t?.sprite?.startsWith("sa:") && t.when && t.name, `${id} keeper`);
			ok(t?.play === "imoni", `${id} play`);
		}
		const block = facilityBlock(f);
		for (const v of VIEWS) {
			const { rows, places, open, pal } = walkMap(v);
			for (let dy = 0; dy < 2; dy++)
				for (let dx = 0; dx < 2; dx++)
					ok(
						rows[IMONI_POT[1] + dy][IMONI_POT[0] + dx] === block[dy][dx],
						`${label(v)}: the pot is not at (${IMONI_POT[0] + dx},${IMONI_POT[1] + dy})`,
					);
			const byId = new Map(places.map((p) => [p.id, p]));
			for (const t of f.outdoor ?? []) {
				const p = byId.get(outdoorId(f, t));
				ok(
					p && p.x === t.at[0] && p.y === t.at[1],
					`${label(v)}: no place ${outdoorId(f, t)}`,
				);
			}
			const reads = D4.map(
				([dx, dy]) =>
					[IMONI_POT_THING[0] + dx, IMONI_POT_THING[1] + dy] as Cell,
			).filter(([x, y]) => open(x, y));
			eq(
				reads.map(([x, y]) => key(x, y)).sort(),
				["1,34", "2,35"],
				`${label(v)}: cells that read the pot`,
			);
			for (const [x, y] of SCENE_CELLS) {
				ok(
					!!pal[rows[y][x]]?.passable,
					`${label(v)}: scene cell (${x},${y}) is not passable`,
				);
				ok(
					!places.some((p) => p.x === x && p.y === y),
					`${label(v)}: scene cell (${x},${y}) is taken`,
				);
			}
			const ours = new Set(
				[...POT_CELLS, ...STAFF_CELLS, ...SCENE_CELLS].map(([x, y]) =>
					key(x, y),
				),
			);
			for (const e of VILLAGE_EXITS)
				for (const [x, y] of lineupSpots(v, 6, e))
					ok(
						!ours.has(key(x, y)),
						`${label(v)}: lineup ${e.side} on (${x},${y})`,
					);
		}
	},
);

test(
	"S8",
	"芋煮会：場面の あとは 暗転して 建てなおす（鍋を 読んだ マスから 起きる 所と 出口 ぜんぶへ 出られる）",
	async () => {
		for (const v of VIEWS) {
			const { reach } = walkMap(v);
			for (const [x, y] of [
				[1, 34],
				[2, 35],
			] as const) {
				const r = reach(x, y);
				ok(
					r.has(key(...VILLAGE_SPOTS.boot)),
					`${label(v)}: (${x},${y}) does not reach boot`,
				);
				for (const e of VILLAGE_EXITS)
					ok(
						r.has(key(...e.cell)),
						`${label(v)}: (${x},${y}) does not reach exit ${e.side}`,
					);
			}
		}
		for (const [pick, at] of [
			[0, [2, 35]],
			[1, [1, 34]],
		] as const)
			for (const yakiuHere of [true, false])
				await withStorage(async () => {
					const a = recorder([pick], at);
					await imoniPot(a.s, env(a.log, { yakiuHere }));
					eq(
						a.log.slice(-3),
						["fadeOut", "rebuild", "fadeIn"],
						`pick ${pick} yakiu ${yakiuHere}: tail`,
					);
					ok(
						a.log.filter((l) => l === "rebuild").length === 1,
						"rebuilt twice",
					);
				});
	},
);

test(
	"S9",
	"芋煮会：強行開催の 日の 村を 組める（絵を 読みこまない）。名無し 3人は その日だけ 出る",
	async () => {
		await withStorage(() => {
			const st: VState = { x: 0, y: 0, dir: "down", flags: {} };
			const staffOf = (v: VillageView) =>
				(buildVillage(v, {} as Ctx).events ?? []).filter((e) =>
					/^fthing_imoni_(chair|pro|anti)$/.test(e.id),
				);
			try {
				imoniForce.phase = "open";
				for (let stage = 0; stage < 8; stage++) {
					const v: VillageView = { stage, unlocked: ["shallow"], cleared: [] };
					const def = buildVillage(v, {} as Ctx);
					ok(typeof def.decor === "function", `stage ${stage}: no decor`);
					const staff = staffOf(v);
					ok(staff.length === 3, `stage ${stage}: ${staff.length} staff`);
					for (const e of staff)
						ok(e.when?.(st) === true, `stage ${stage}: ${e.id} is hidden`);
				}
				imoniForce.phase = "off";
				for (const e of staffOf({
					stage: 3,
					unlocked: ["shallow"],
					cleared: [],
				}))
					ok(e.when?.(st) === false, `off: ${e.id} is shown`);
			} finally {
				imoniForce.phase = null;
			}
		});
		ok(imoniDecor("off") === undefined, "decor when off");
		ok(imoniDecor("notice") === undefined, "decor on notice");
		ok(imoniDecor("done") === undefined, "decor when done");
		ok(typeof imoniDecor("open", "in") === "function", "decor when open");
		ok(typeof imoniDecor("open", null) === "function", "decor before eating");
	},
);

// ───────────────── 芋煮会：はり紙・大鍋・名無し ─────────────────

test(
	"S10",
	"芋煮会：まとめ掲示板の はり紙（10月だけ。中止の わけと 請求書・強行開催と けむり・来年の 中止）",
	async () => {
		ok(imoniBoardMenu("off") === null, "menu when off");
		for (const p of ["notice", "open", "done"] as const)
			ok(imoniBoardMenu(p) === IMONI.board.menu, `menu ${p}`);
		const b = IMONI.board;
		const run = async (phase: ImoniPhase, reason = 0): Promise<string[]> => {
			const a = recorder();
			await imoniBoardScript(a.s, phase, reason);
			return a.log;
		};
		for (const r of [0, 1, 2])
			eq(
				await run("notice", r),
				[b.title, b.reasons[r], b.invoice].map((t) => `narrate: ${t}`),
				`notice ${r}`,
			);
		eq(
			await run("open"),
			[b.title, b.open, b.smoke].map((t) => `narrate: ${t}`),
			"open",
		);
		eq(
			await run("done"),
			[b.doneTitle, b.doneReply].map((t) => `narrate: ${t}`),
			"done",
		);
		eq(await run("off"), [], "off");
	},
);

test(
	"S11",
	"芋煮会：強行開催（こんにゃく論争 → 芋煮 → ぷゆゆと やきう → 暗転）・おかわり・ふだんの 鍋・次の 年・下見は 書かない",
	async () => {
		const O = IMONI.open;
		const N = IMONI.names;
		const P = IMONI.pot;
		const puyuDef = mobTexts.MOBS.puyu;
		const puyu = puyuDef.label ?? puyuDef.name;
		const head = [
			`say(${N.pro}): ${O.pro}`,
			`say(${N.anti}): ${O.anti}`,
			`say(${N.pro}): ${O.pro2}`,
			`choose: ${O.options.join("/")}`,
		];
		const tail = ["fadeOut", "rebuild", "fadeIn"];
		await withStorage(async (store) => {
			// 10月の 帰りは もう 4回 数えてある
			saveImoni(rec({ octYear: Y, octN: 4, octAt: A }), false);
			const a = recorder([0], [2, 35]);
			await imoniPot(a.s, env(a.log));
			eq(
				a.log,
				[
					`narrate: ${O.first}`,
					...head,
					"se bubble",
					`narrate: ${O.putIn}`,
					`say(${N.pro}): ${O.won}`,
					`show ${IMONI_ART.bowlKon} ${O.dish}`,
					"se eat",
					`narrate: ${O.eat[0]}`,
					`goto mob_puyu ${IMONI_SCENE.puyu.join(",")}`,
					`say(${puyu}): ${O.puyu[0]}`,
					`goto nanj ${IMONI_SCENE.yakiu.join(",")}`,
					`say(nanj): ${O.yakiu[0]}`,
					...tail,
				],
				"open, put it in",
			);
			const saved = JSON.parse(store.get("kiriko-roguelike/imoni") ?? "null");
			eq(
				saved,
				{
					v: 1,
					held: Y,
					heldAt: A,
					kon: "in",
					ever: true,
					octYear: Y,
					octN: 4,
					octAt: A,
				},
				"record",
			);
			// 同じ 帰りに もう 一度：おかわり
			const b = recorder([0]);
			await imoniPot(b.s, env(b.log));
			eq(
				b.log,
				[
					`narrate: ${O.boil}`,
					`choose: ${O.more.join("/")}`,
					`show ${IMONI_ART.bowlKon} ${O.dish}`,
					"se eat",
					`narrate: ${O.refill}`,
				],
				"おかわり",
			);
			const c = recorder([1]);
			await imoniPot(c.s, env(c.log));
			eq(
				c.log,
				[`narrate: ${O.boil}`, `choose: ${O.more.join("/")}`],
				"やめる",
			);
			// ほかの 段階の 鍋
			const look = async (phase: ImoniPhase): Promise<string[]> => {
				const r = recorder();
				await imoniPot(r.s, env(r.log, { phase }));
				return r.log;
			};
			eq(
				await look("done"),
				[`narrate: ${P.look}`, `narrate: ${P.warm}`],
				"done",
			);
			eq(
				await look("notice"),
				[`narrate: ${P.look}`, `narrate: ${P.flyer}`],
				"notice",
			);
			eq(
				await look("off"),
				[`narrate: ${P.look}`, `narrate: ${P.soot}`],
				"soot",
			);
		});
		await withStorage(async () => {
			const r = recorder();
			await imoniPot(r.s, env(r.log, { phase: "off" }));
			eq(r.log, [`narrate: ${P.look}`, `narrate: ${P.never}`], "never lit");
			// 入れない（やきうは 村に いない）
			const a = recorder([1], [1, 34]);
			await imoniPot(a.s, env(a.log, { yakiuHere: false }));
			eq(
				a.log,
				[
					`narrate: ${O.first}`,
					...head,
					`narrate: ${O.leaveOut}`,
					`say(${N.anti}): ${O.won}`,
					`show ${IMONI_ART.bowl} ${O.dish}`,
					"se eat",
					`narrate: ${O.eat[1]}`,
					`goto mob_puyu ${IMONI_SCENE.puyu.join(",")}`,
					`say(${puyu}): ${O.puyu[0]}`,
					...tail,
				],
				"open, leave it out",
			);
			eq(loadImoni().kon, "out", "kon out");
			// 次の 年（もう 一度 開かれた ことが ある）
			const n = recorder([0]);
			await imoniPot(n.s, env(n.log, { year: Y + 1, at: A + 9 }));
			ok(
				n.log[0] === `narrate: ${O.again}`,
				`next year opens with "${n.log[0]}"`,
			);
			ok(n.log.includes(`say(${puyu}): ${O.puyu[1]}`), "ぷゆゆ next year");
			ok(n.log.includes(`say(nanj): ${O.yakiu[1]}`), "やきう next year");
			eq(n.log.slice(-3), tail, "next year tail");
			const r2 = loadImoni();
			eq(
				[r2.held, r2.heldAt, r2.kon],
				[Y + 1, A + 9, "in"],
				"next year record",
			);
		});
		await withStorage(async (store) => {
			const a = recorder([0]);
			await imoniPot(a.s, env(a.log, { noSave: true }));
			ok(!store.has("kiriko-roguelike/imoni"), "preview wrote the record");
			const r = loadImoni();
			eq([r.held, r.heldAt, r.kon, r.ever], [Y, A, "in", true], "memo");
		});
	},
);

test(
	"S12",
	"芋煮会：実行委員と 名無し 2人の セリフ（食べる 前・入れた あと・入れない あと）と 名前",
	async () => {
		const st = IMONI.staff;
		const N = IMONI.names;
		const want: Record<
			"none" | ImoniKon,
			Record<"chair" | "pro" | "anti", readonly string[]>
		> = {
			none: {
				chair: st.chair.before,
				pro: st.pro.before,
				anti: st.anti.before,
			},
			in: { chair: st.chair.after, pro: st.pro.in, anti: st.anti.in },
			out: { chair: st.chair.after, pro: st.pro.out, anti: st.anti.out },
		};
		for (const k of ["none", "in", "out"] as const)
			await withStorage(async () => {
				if (k !== "none")
					saveImoni(rec({ held: Y, heldAt: A, kon: k, ever: true }), false);
				else
					saveImoni(
						rec({ held: Y - 1, heldAt: A, kon: "in", ever: true }),
						false,
					);
				for (const id of ["chair", "pro", "anti"] as const) {
					const a = recorder();
					await imoniStaff(a.s, { id, name: N[id] }, { year: Y });
					eq(
						a.log,
						want[k][id].map((l) => `say(${N[id]}): ${l}`),
						`${id} ${k}`,
					);
				}
			});
	},
);

test(
	"S13",
	"芋煮会：絵は public/sprites/season.png（128x32）の 16 刻みの 中を 指す",
	() => {
		const png = readFileSync(join(process.cwd(), "public/sprites/season.png"));
		ok(png.toString("ascii", 12, 16) === "IHDR", "not a PNG");
		const w = png.readUInt32BE(16);
		const h = png.readUInt32BE(20);
		ok(w === 128 && h === 32, `season.png is ${w}x${h}`);
		const refs = [
			...IMONI_ART.pot,
			IMONI_ART.lit,
			IMONI_ART.litKon,
			IMONI_ART.bowl,
			IMONI_ART.bowlKon,
		];
		for (const ref of refs) {
			const m = /^pub:sprites\/season\.png#(\d+),(\d+),(\d+),(\d+)$/.exec(ref);
			ok(m, `${ref}: not a season.png cut`);
			if (!m) continue;
			const [x, y, cw, ch] = m.slice(1).map(Number);
			ok(x % 16 === 0 && y % 16 === 0, `${ref}: not on the 16 grid`);
			ok(x + cw <= w && y + ch <= h, `${ref}: outside the sheet`);
		}
		const look = mustImoni().look;
		ok(look.kind === "grid", "look");
		if (look.kind === "grid")
			eq(
				["a", "b", "c", "d"].map((k) => look.keys[k]),
				IMONI_ART.pot.map((r) => [r]),
				"facility keys",
			);
	},
);

// ───────────────── どすこいポイント ─────────────────

test(
	"S14",
	"どすこい：建物に 入ると 帰りに 1回だけ ふえる（数は スレの 順に 回る）。8/5 は 廃止の 札、8/6 は 年に 1回 詫びの ＋500",
	() => {
		const steps: [Today, number][] = [
			[day(1, 1), 1],
			[day(1, 1), 1],
			[day(1, 2), 2],
			[day(8, 5), 3],
			[day(8, 6), 4],
			[day(8, 6), 5],
			[day(8, 6), 6],
			[day(9, 1), 7],
		];
		const gain = (n: number) => DOSUKOI.gain.replace("{n}", String(n));
		const want = [
			gain(170),
			null,
			gain(500),
			DOSUKOI.gone,
			DOSUKOI.wabi,
			gain(600),
			gain(200),
			gain(100),
		];
		let r: DosukoiRec = emptyDosukoi();
		const toasts: (string | null)[] = [];
		for (const [t, at] of steps) {
			const next = dosukoiStep(r, t, Y, at);
			ok(next.rec.pts >= r.pts, `points went down at ${at}`);
			toasts.push(next.toast);
			r = next.rec;
		}
		eq(toasts, want, "toasts");
		eq([r.pts, r.n, r.wabi, r.at], [2070, 5, Y, 7], "record");
		// 次の 年の 8/6 は また 詫び
		const w2 = dosukoiStep(r, day(8, 6), Y + 1, 8);
		ok(w2.toast === DOSUKOI.wabi && w2.rec.pts === 2570, "wabi next year");
		// 数は DOSUKOI_GAINS を 順に 回る
		let c = emptyDosukoi();
		for (let i = 0; i < DOSUKOI_GAINS.length * 2; i++) {
			const next = dosukoiStep(c, day(3, 3), Y, 100 + i);
			const g = DOSUKOI_GAINS[i % DOSUKOI_GAINS.length];
			ok(next.toast === gain(g), `step ${i}: ${next.toast}`);
			ok(next.rec.pts === c.pts + g, `step ${i}: points`);
			c = next.rec;
		}
	},
);

test(
	"S15",
	"どすこい：町役場の 窓口・市役所の 住民課で 照会（6けたまで・8/5 は 失効の 画面・8/6 は 詫びの 一言）",
	async () => {
		const opts = `choose: ${DOSUKOI.options.join("/")}`;
		const run = async (
			pts: number,
			facility: string,
			t: Today,
			picks: number[] = [0],
			wabi = 0,
		): Promise<string[]> => {
			let log: string[] = [];
			await withStorage(async () => {
				saveDosukoi({ v: 1, pts, at: 1, wabi, n: 3 }, false);
				const a = recorder(picks);
				await dosukoiWindow(a.s, facility, t, Y);
				log = a.log;
			});
			return log;
		};
		const balance = (where: string, n: number) =>
			`narrate: ${fill(DOSUKOI.balance, { where, n })}`;
		eq(
			await run(1190, "townhall", day(1, 10)),
			[opts, balance("窓口", 1190), `say(窓口): ${DOSUKOI.shrug}`],
			"townhall",
		);
		eq(
			await run(1190, "cityhall", day(1, 10)),
			[opts, balance("住民課", 1190), `say(住民課): ${DOSUKOI.shrug}`],
			"cityhall",
		);
		eq(
			await run(1234567, "cityhall", day(1, 10)),
			[opts, balance("住民課", 999999), `say(住民課): ${DOSUKOI.shrug}`],
			"6 digits",
		);
		const lapse = [
			opts,
			...DOSUKOI.lapse.map((l) => `narrate: ${fill(l, { where: "窓口" })}`),
			`say(窓口): ${DOSUKOI.back}`,
		];
		eq(await run(1190, "townhall", day(8, 5)), lapse, "8/5");
		eq(await run(0, "townhall", day(8, 5)), lapse, "8/5 with no points");
		eq(
			await run(1190, "townhall", day(8, 6), [0], Y),
			[opts, balance("窓口", 1190), `say(窓口): ${DOSUKOI.wabiNote}`],
			"8/6",
		);
		eq(
			await run(1190, "townhall", day(8, 6), [0], Y - 1),
			[opts, balance("窓口", 1190), `say(窓口): ${DOSUKOI.shrug}`],
			"8/6 without this year's wabi",
		);
		eq(await run(1190, "townhall", day(1, 10), [1]), [opts], "やめる");
		eq(await run(0, "townhall", day(1, 10)), [], "no points");
	},
);

test("S16", "どすこい：照会は 町役場の 1番窓口と 市役所の 住民課 だけ", () => {
	ok(
		facilityById("townhall")?.room?.plays?.window === "dosukoi",
		"townhall window",
	);
	ok(
		facilityById("cityhall")?.room?.plays?.jumin === "dosukoi",
		"cityhall jumin",
	);
	const users = FACILITIES.flatMap((f) =>
		Object.entries(f.room?.plays ?? {})
			.filter(([, p]) => p === "dosukoi")
			.map(([k]) => `${f.id}.${k}`),
	);
	eq(users, ["townhall.window", "cityhall.jumin"], "dosukoi plays");
});

test(
	"S17",
	"季節：保存（kiriko-roguelike/imoni・dosukoi。壊れた 中身は 初期値。下見は 覚える だけ）",
	async () => {
		await withStorage((store) => {
			const r = rec({
				held: Y,
				heldAt: A,
				kon: "out",
				ever: true,
				octYear: Y,
				octN: 2,
				octAt: A,
			});
			saveImoni(r, false);
			forgetImoniMemo();
			eq(loadImoni(), r, "imoni round trip");
			const d: DosukoiRec = { v: 1, pts: 1190, at: A, wabi: Y, n: 4 };
			saveDosukoi(d, false);
			forgetDosukoiMemo();
			eq(loadDosukoi(), d, "dosukoi round trip");
			eq(
				[...store.keys()].sort(),
				["kiriko-roguelike/dosukoi", "kiriko-roguelike/imoni"],
				"keys",
			);
			const bad = (k: string, v: string) => {
				store.set(k, v);
				forgetImoniMemo();
				forgetDosukoiMemo();
			};
			for (const v of [
				"{broken",
				"null",
				"[]",
				JSON.stringify({ ...r, v: 2 }),
			]) {
				bad("kiriko-roguelike/imoni", v);
				eq(loadImoni(), emptyImoni(), `imoni ${v}`);
				bad("kiriko-roguelike/dosukoi", v);
				eq(loadDosukoi(), emptyDosukoi(), `dosukoi ${v}`);
			}
			bad(
				"kiriko-roguelike/imoni",
				JSON.stringify({
					v: 1,
					held: -5,
					heldAt: 2.5,
					kon: "maybe",
					ever: "yes",
					octYear: "2031",
					octN: -2,
					octAt: Number.NaN,
				}),
			);
			eq(loadImoni(), emptyImoni(), "imoni bad fields");
			bad(
				"kiriko-roguelike/dosukoi",
				JSON.stringify({ v: 1, pts: -5, at: 2.5, wabi: -1, n: 1.5 }),
			);
			eq(loadDosukoi(), emptyDosukoi(), "dosukoi bad fields");
		});
		await withStorage((store) => {
			const r = rec({ held: Y, heldAt: A, kon: "in", ever: true });
			saveImoni(r, true);
			ok(store.size === 0, "preview wrote imoni");
			eq(loadImoni(), r, "imoni memo");
			saveDosukoi({ v: 1, pts: 170, at: A, wabi: 0, n: 1 }, true);
			ok(store.size === 0, "preview wrote dosukoi");
			ok(loadDosukoi().pts === 170, "dosukoi memo");
		});
	},
);

export const runSeasonTests = async (): Promise<TestResult[]> => {
	const out: TestResult[] = [];
	for (const c of CASES) {
		try {
			await c.run();
			out.push({ id: `season ${c.id}`, name: c.name, ok: true });
		} catch (e) {
			out.push({
				id: `season ${c.id}`,
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			});
		} finally {
			imoniForce.phase = null;
		}
	}
	return out;
};
