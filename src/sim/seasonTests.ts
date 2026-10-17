// 季節の 行事の 試験（pnpm test で いっしょに 動く。TOWN.md 季節の 行事）。
// 日替わり（data/town/openModes.ts）・おんJ芋煮会（data/town/imoni.ts・ui/minigames/imoni.ts・data/village/season.ts）・
// 日付・年・帰りは みな 引数で 渡す（端末の 日付・時刻に よらない。10月でも 8/5 でも 同じ 結果）。
// 形は ほかの 試験と 同じ（Fail・ok・{ id, name, ok, reason }）。id の 頭は S。

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DungeonId } from "../core/types";
import * as cafeTexts from "../data/cafe/cafe";
import * as cafeMobTexts from "../data/cafe/cafeMobs";
import * as pianoTexts from "../data/minigames/piano";
import * as guestTexts from "../data/people/guests";
import * as mobTexts from "../data/people/mobs";
import * as quoteTexts from "../data/story/quotes";
import * as storyTexts from "../data/story/story";
import * as tipTexts from "../data/story/tips";
import * as bathTexts from "../data/town/bath";
import { openModeOf, seasonOf, type Today } from "../data/town/calendar";
import * as eateryTexts from "../data/town/eateries";
import * as facilityTexts from "../data/town/facilities";
import * as hallTexts from "../data/town/hall";
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
} from "../data/town/imoni";
import {
	EMOJI_LINE_WIDTH,
	modesHeld,
	modeText,
	rawModes,
	TRICK_SWEETS,
	WINDOW_WIDTH,
	windowWidth,
} from "../data/town/openModes";
import * as roomTexts from "../data/town/rooms";
import * as townTexts from "../data/town/town";
import * as crowdTexts from "../data/village/crowd";
import * as villageFacilityTexts from "../data/village/facilities";
import {
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
import type { Story, VState } from "../engine/defs";
import type { Ctx } from "../ui/ctx";
import {
	type ImoniEnv,
	imoniBoardMenu,
	imoniBoardScript,
	imoniDecor,
	imoniPot,
	imoniStaff,
} from "../ui/minigames/imoni";
import { buildVillage } from "../ui/village/villageEvents";
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
	return {
		store,
		restore: () => {
			forgetImoniMemo();
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

/** 村の 文の 出どころ（ui/village/village.ts の say を 通る 文を もつ もの）。 */
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
	["guests", guestTexts],
	["bath", bathTexts],
	["rooms", roomTexts],
	["story", storyTexts],
	["quotes", quoteTexts],
	["tips", tipTexts],
	["piano", pianoTexts],
];

test(
	"S1",
	"日替わり：村の 文 ぜんぶ 猫の日・博多弁・トリックで 行の 数が かわらず、22字に 収まる 行は 収まった まま",
	() => {
		const strings = new Map<string, string>();
		for (const [name, mod] of TEXT_MODULES) collect(mod, name, strings);
		collect(IMONI, "IMONI", strings);
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
	["neko", "これなおせないのか", "これにゃおせにゃいのかにゃ"],
	["neko", "かわいいわよね", "かわいいわよねにゃ"],
	["neko", "いもわ？🥺", "いもわにゃ？🥺"],
	["neko", "ナイター見たいから中止です", "ニャイター見たいから中止ですにゃ"],
	["neko", "……", "……"],
	["neko", "……(´・ω・｀)", "……(´・ω・｀)にゃ"],
	[
		"neko",
		"おなかすいてたおれたの。\n……(´；ω；｀)",
		"おにゃかすいてたおれたの。\n……(´；ω；｀)にゃ",
	],
	[
		"neko",
		"はり紙。\n『おんJ芋煮会中止のお知らせ』",
		"はり紙。\n『おんJ芋煮会中止のお知らせ』にゃ",
	],
	[
		"neko",
		"粋な計らい（好感度上げとく）",
		"粋にゃ計らい（好感度上げとく）にゃ",
	],
	["neko", "草ｗｗ", "草にゃｗｗ"],
	[
		"neko",
		"あいうえおかきくけこさしすせそたちつてとなに",
		"あいうえおかきくけこさしすせそたちつてとなに",
	],
	["hakata", "おはよう", "おはようしゃん"],
	["hakata", "うるさい", "しぇからしか"],
	["hakata", "さとるのフケや", "さっとるのフケばい"],
	["hakata", "こんな村", "こぎゃん村"],
	["hakata", "本当にええ村や", "ほんまにええ村ばい"],
	["hakata", "お前、どこのスレのもんや", "貴様、どこのスレのもんばい"],
	["hakata", "ロゼさん、ええよ", "ロゼしゃん、ええクサ"],
	["hakata", "キリコをよろしく", "キリコばよろしく"],
	["hakata", "しょうがない", "しょうがなか"],
	["hakata", "そんなことならいい", "そげんことならよか"],
	["hakata", "雨は降るなよ", "雨は降るなよ"],
	["hakata", "かわいい", "かわいい"],
	["hakata", "まだ", "まだ"],
	[
		"hakata",
		"……胸のあたりに、計算できない\n値があるゼロ",
		"……胸のあたりに、計算できない\n値があるゼロ",
	],
	["hakata", "……いっしょにぽわぽわ\nしよ〜", "……いっしょにぽわぽわ\nしよ〜"],
	["hakata", "はっや。……なんや、その顔。", "はっや。……なんや、その顔。"],
	["trick", "ええ村や", "ええ村や🍪"],
	["trick", "……いも、あったゆ🥺", "……いも、あったゆ🥺🍫"],
	["trick", "参加費は、あとで請求します", "参加費は、あとで請求します🍬"],
	["trick", "雨は降るなよ\nええ村や", "雨は降るなよ\nええ村や🍪"],
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

/**
 * 出荷する 文に 出さない 語：実在の 政党・政治家・政治の 決まり文句・争点・実在の 宗教と 習わし・婚姻・戸籍・
 * 本籍・植民の 図・集団を 消す 言い回し・色の 派・差別語ほか。スレが「落ちる」も 書かない（おんJには dat落ちが ない）。
 */
const NG = [
	"自民",
	"立憲",
	"維新",
	"共産",
	"公明",
	"れいわ",
	"参政",
	"社民",
	"国民民主",
	"N国",
	"安倍",
	"石破",
	"岸田",
	"菅",
	"麻生",
	"蓮舫",
	"稲田",
	"高市",
	"小泉",
	"河野",
	"枝野",
	"野田",
	"玉木",
	"山本太郎",
	"百田",
	"立花",
	"橋下",
	"小池",
	"ひろゆき",
	"トランプ",
	"今村",
	"ヒトラー",
	"金正恩",
	"保守派",
	"保守党",
	"保守系",
	"革新",
	"リベラル",
	"右派",
	"左派",
	"右翼",
	"左翼",
	"与党",
	"野党",
	"政党",
	"ネトウヨ",
	"パヨク",
	"ブサヨ",
	"売国",
	"反日",
	"極左",
	"非国民",
	"政教分離",
	"靖国",
	"神社本庁",
	"日本会議",
	"天皇",
	"皇室",
	"改憲",
	"護憲",
	"9条",
	"憲法",
	"同性婚",
	"夫婦別姓",
	"参政権",
	"外国人",
	"増税",
	"消費税",
	"自衛隊",
	"死刑",
	"移民",
	"原発",
	"ワクチン",
	"領土",
	"印象操作",
	"ご飯論法",
	"丁寧に説明",
	"真摯に",
	"検討を",
	"スピード感",
	"全く問題ない",
	"指摘は当たらない",
	"セクシー",
	"2位じゃ",
	"お気持ち",
	"記憶にございません",
	"遺憾",
	"仏教",
	"神道",
	"キリスト",
	"イスラム",
	"創価",
	"統一教会",
	"幸福の科学",
	"エホバ",
	"オウム",
	"天理",
	"大川",
	"聖戦",
	"ジハード",
	"十字軍",
	"異教徒",
	"神社",
	"参道",
	"御利益",
	"おみくじ",
	"絵馬",
	"賽銭",
	"婚姻",
	"戸籍",
	"本籍",
	"同性",
	"部落",
	"在日",
	"支那",
	"シナ",
	"チョン",
	"植民地",
	"原住民",
	"侵略",
	"民よ",
	"消えろ",
	"消えるがいい",
	"滅び",
	"駆除",
	"出ていけ",
	"追放",
	"赤派",
	"青派",
	"ガイジ",
	"アスペ",
	"キチガイ",
	"池沼",
	"チンパン",
	"土人",
	"チー牛",
	"ジャップ",
	"アメカス",
	"さとる",
	"矢野",
	"落ちた",
	"落ちる",
	"落ちない",
];

/** 出荷の 文に 使わない 語（NG に 足す。この 包みの 元ネタに 近い 語）。 */
const SEASON_NG = [
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
	"芋煮会：窓は 2行・22字、えらぶ 字は 10字まで、ぷゆゆは 🥺 1つで 21字まで、絵文字は ほかに なし、使わない 語なし",
	() => {
		const texts: [string, string][] = [];
		const all = new Map<string, string>();
		collect(IMONI, "IMONI", all);
		for (const [t, where] of all)
			if (!/\{\w+\}/.test(t)) texts.push([where, t]);
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
	"S17",
	"季節：保存（kiriko-roguelike/imoni。壊れた 中身は 初期値。下見は 覚える だけ）",
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
			eq([...store.keys()].sort(), ["kiriko-roguelike/imoni"], "keys");
			const bad = (k: string, v: string) => {
				store.set(k, v);
				forgetImoniMemo();
			};
			for (const v of [
				"{broken",
				"null",
				"[]",
				JSON.stringify({ ...r, v: 2 }),
			]) {
				bad("kiriko-roguelike/imoni", v);
				eq(loadImoni(), emptyImoni(), `imoni ${v}`);
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
		});
		await withStorage((store) => {
			const r = rec({ held: Y, heldAt: A, kon: "in", ever: true });
			saveImoni(r, true);
			ok(store.size === 0, "preview wrote imoni");
			eq(loadImoni(), r, "imoni memo");
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
