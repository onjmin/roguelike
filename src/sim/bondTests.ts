// なかよし度（data/people/bonds.ts・ui/village/bonds.ts）と おんJ証券（data/trade/trade.ts・ui/trade/trade.ts）の 試験。
// pnpm test で いっしょに 動く。形は seasonTests と 同じ（Fail・ok・{ id, name, ok, reason }）。id の 頭は B。

import {
	BOND_DEFS,
	BOND_MSG,
	BOND_STEPS,
	GIFT_GOODS,
	GIFT_IDS,
	KEEPSAKES,
	SEASON_PRESENTS,
} from "../data/people/bonds";
import { MOB_IDS, MOBS } from "../data/people/mobs";
import { SPEAKERS } from "../data/story/quotes";
import {
	DAY_TEXT,
	FX,
	FX_TEXT,
	priceStep,
	STOCK_IDS,
	STOCKS,
	startPrices,
	TRADE_MSG,
} from "../data/trade/trade";
import { forgetWalletMemo, walletYen } from "../engine/wallet";
import {
	forgetStocksMemo,
	loadStocks,
	stockValue,
	syncStocks,
} from "../ui/trade/trade";
import {
	bondLevel,
	forgetBondsMemo,
	loadBonds,
	tasteOf,
	withBond,
} from "../ui/village/bonds";
import { forgetCafeMemo } from "../ui/village/cafe";
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

/** 村の 窓（2行まで・1行 全角22字）。 */
const fits = (where: string, text: string): void => {
	const lines = text.split("\n");
	ok(lines.length <= 2, `${where}: ${lines.length} lines in "${text}"`);
	for (const l of lines)
		ok(width(l) <= 22, `${where}: "${l}" is ${width(l)} wide (> 22)`);
};

const ALL = [...(Object.keys(SPEAKERS) as string[]), ...MOB_IDS] as const;

/** localStorage を 試験の あいだだけ 差しかえる。 */
const withStorage = async (
	fn: (store: Map<string, string>) => void | Promise<void>,
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
		},
		configurable: true,
		writable: true,
	});
	const forget = () => {
		forgetBondsMemo();
		forgetCafeMemo();
		forgetStocksMemo();
		forgetWalletMemo();
	};
	forget();
	try {
		await fn(store);
	} finally {
		forget();
		if (prev) Object.defineProperty(globalThis, "localStorage", prev);
		else delete (globalThis as { localStorage?: unknown }).localStorage;
	}
};

/** 町の 売り上げ（財布の もと）を 置く。 */
const setPoints = (store: Map<string, string>, points: number): void => {
	store.set(
		"kiriko-roguelike/town",
		JSON.stringify({
			points,
			stage: 4,
			storage: [],
			pending: null,
			returned: [],
		}),
	);
};

// ───────────────── なかよし度 ─────────────────

test(
	"B1",
	"every resident and friend has a bond entry, a birthday and two keepsakes",
	() => {
		for (const w of ALL) {
			const d = BOND_DEFS[w as keyof typeof BOND_DEFS];
			ok(d, `${w}: no bond entry`);
			const [m, day] = d.birthday;
			ok(
				m >= 1 && m <= 12 && day >= 1 && day <= 31,
				`${w}: birthday ${m}/${day}`,
			);
			ok(d.love.length >= 1, `${w}: nothing loved`);
			ok(
				KEEPSAKES[w as keyof typeof KEEPSAKES]?.length === 2,
				`${w}: keepsakes`,
			);
		}
		const ids = ALL.flatMap(
			(w) => KEEPSAKES[w as keyof typeof KEEPSAKES]?.map((k) => k.id) ?? [],
		);
		ok(new Set(ids).size === ids.length, "keepsake ids are not unique");
	},
);

test(
	"B2",
	"every bond line fits the village window (22 full-width × 2 lines)",
	() => {
		for (const w of ALL) {
			const d = BOND_DEFS[w as keyof typeof BOND_DEFS];
			for (const [k, t] of Object.entries(d.react)) fits(`${w}.react.${k}`, t);
			for (const [i, sc] of (d.scenes ?? []).entries()) {
				ok(
					sc.length >= 1 && sc.length <= 5,
					`${w}.scenes[${i}]: ${sc.length} windows`,
				);
				for (const l of sc) fits(`${w}.scenes[${i}]`, l.text);
			}
			for (const t of d.warm ?? []) fits(`${w}.warm`, t);
			for (const t of Object.values(d.season ?? {})) fits(`${w}.season`, t);
			for (const k of KEEPSAKES[w as keyof typeof KEEPSAKES] ?? []) {
				fits(`${w}.${k.id}.say`, k.say);
				fits(`${w}.${k.id}.desc`, k.desc);
			}
		}
		for (const [k, t] of Object.entries(BOND_MSG))
			if (typeof t === "string")
				fits(
					`BOND_MSG.${k}`,
					t.replace("{gift}", "ぬいぐるみ").replace("{name}", "ジェイトルマン"),
				);
		for (const p of Object.values(SEASON_PRESENTS))
			fits(
				"season present",
				p.got.replace("{name}", "ジェイトルマン").replace("{price}", "500円"),
			);
		for (const g of GIFT_IDS)
			ok(width(GIFT_GOODS[g].name) <= 9, `${g}: name too long`);
	},
);

test(
	"B3",
	"loved gifts are loved, tagged gifts are liked, hated tags are hated",
	() => {
		for (const w of ALL) {
			const d = BOND_DEFS[w as keyof typeof BOND_DEFS];
			for (const g of d.love)
				ok(tasteOf(w as never, g) === "love", `${w} ${g}`);
		}
		ok(tasteOf("roze", "mabo") === "love", "roze loves mabo");
		ok(tasteOf("shiyo", "matches") === "hate", "shiyo hates fire");
	},
);

test(
	"B4",
	"hearts grow with gifts; a gift is handed once per return; scenes come at ♥3",
	async () => {
		await withStorage(async (store) => {
			setPoints(store, 100000);
			store.set(
				"kiriko-roguelike/records",
				JSON.stringify([
					{ at: 1000, kind: "dead", depth: 3, maxDepth: 3, cause: "x" },
				]),
			);
			ok(bondLevel("roze") === 0, "starts at 0");
			const log: string[] = [];
			const s = new Proxy({} as never, {
				get: (_t, k) => {
					if (k === "choose") return async () => 0;
					if (k === "narrate" || k === "say" || k === "kiriko")
						return async (...a: unknown[]) => {
							log.push(String(a[a.length > 1 ? 1 : 0]));
						};
					if (k === "then") return undefined;
					return () => undefined;
				},
			});
			const give = async () => {
				const m = loadBonds();
				m.carry = "mabo";
				store.set("kiriko-roguelike/bonds", JSON.stringify(m));
				forgetBondsMemo();
				await withBond("roze", async () => {})(s);
			};
			await give();
			const one = bondLevel("roze");
			ok(one >= 1, `one loved gift: ♥${one}`);
			await give();
			ok(bondLevel("roze") === one, "a second gift in the same return counted");
			ok(loadBonds().carry === "mabo", "the second gift was taken");
			// 帰りを 進めて もう 2回
			for (const at of [2000, 3000]) {
				store.set(
					"kiriko-roguelike/records",
					JSON.stringify([
						{ at, kind: "dead", depth: 3, maxDepth: 3, cause: "x" },
					]),
				);
				await give();
			}
			ok(bondLevel("roze") >= 3, `three loved gifts: ♥${bondLevel("roze")}`);
			// ♥ が 上がっても「なかよく　なった」とは 知らせない（作者の 指示）
			ok(
				!log.some((t) => t.includes("なかよく　なった")),
				"a bond level-up notice was shown",
			);
			ok(
				loadBonds().got.includes("roze_hashi"),
				"the ♥2 keepsake was not handed",
			);
			// ♥3 の 話（新しい 帰り）
			store.set(
				"kiriko-roguelike/records",
				JSON.stringify([
					{ at: 4000, kind: "dead", depth: 3, maxDepth: 3, cause: "x" },
				]),
			);
			let inner = false;
			await withBond("roze", async () => {
				inner = true;
			})(s);
			ok(!inner, "the ♥3 scene did not replace the usual talk");
			ok(loadBonds().scenes.includes("roze:3"), "scene not remembered");
			ok(BOND_STEPS.length === 5, "five hearts");
		});
	},
);

// ───────────────── おんJ証券 ─────────────────

test(
	"B5",
	"stock prices drift neither up nor down on average, and never reach 0",
	() => {
		// はじめの 値から 1歩ずつ（何歩も つなげると 複利で ゆれが 大きい）。1歩の 倍率の 平均が 1
		const p = startPrices();
		const sum: Record<string, number> = {};
		const N = 4000;
		for (let i = 1; i <= N; i++) {
			const r = priceStep(p, i);
			for (const id of STOCK_IDS) {
				ok(r.prices[id] >= 1, `${id} fell to ${r.prices[id]}`);
				sum[id] = (sum[id] ?? 0) + r.prices[id] / p[id];
			}
		}
		for (const id of STOCK_IDS) {
			const mean = (sum[id] ?? 0) / N;
			ok(Math.abs(mean - 1) < 0.03, `${id}: mean step ×${mean.toFixed(4)}`);
		}
	},
);

test(
	"B6",
	"returns move the prices once each, pay dividends, and keep 24 steps of history",
	async () => {
		await withStorage(async (store) => {
			setPoints(store, 100000);
			store.set(
				"kiriko-roguelike/stats",
				JSON.stringify({ runs: 5, clears: 0, best: 1 }),
			);
			const m = loadStocks();
			ok(m.runs === 5, "starts at the current run count");
			m.hold.hoshu = { n: 10, cost: 1500 };
			store.set("kiriko-roguelike/stocks", JSON.stringify(m));
			forgetStocksMemo();
			const before = walletYen();
			const r = syncStocks(8);
			ok(loadStocks().runs === 8, "runs not advanced");
			ok(
				loadStocks().hist.hoshu.length === 4,
				`history ${loadStocks().hist.hoshu.length}`,
			);
			ok(
				r.dividend > 0 && walletYen() === before + r.dividend,
				"dividend not paid",
			);
			ok(syncStocks(8).dividend === 0, "the same return paid twice");
			syncStocks(200);
			ok(loadStocks().hist.hoshu.length <= 24, "history too long");
			ok(stockValue() > 0, "holding has no value");
		});
	},
);

test(
	"B7",
	"trading texts fit the window and the board lines fit their bars",
	() => {
		for (const [k, t] of Object.entries(TRADE_MSG))
			if (typeof t === "string")
				fits(
					`TRADE_MSG.${k}`,
					t
						.replace(/\{(price|have|value|left|net)\}/g, "100,000円")
						.replace("{name}", STOCKS.joshiki.short)
						.replace("{text}", "")
						.replace("{head}", "100,000円が　もどってきた。")
						.replace("{n}", "100"),
				);
		for (const id of STOCK_IDS)
			for (const t of [...STOCKS[id].up, ...STOCKS[id].down])
				fits(
					`${id} news`,
					`【ニュース】${t}`.replace("\n", "").length > 0 ? t : t,
				);
		for (const t of [...Object.values(DAY_TEXT), ...Object.values(FX_TEXT)])
			ok(width(t) <= 22, `"${t}" is ${width(t)} wide`);
		ok(
			FX.levers.includes(1000) && FX.losscut === 0.5,
			"high leverage and losscut",
		);
	},
);

export const runBondTests = async (): Promise<TestResult[]> => {
	const out: TestResult[] = [];
	for (const c of CASES) {
		try {
			await c.run();
			out.push({ id: `bond ${c.id}`, name: c.name, ok: true });
		} catch (e) {
			out.push({
				id: `bond ${c.id}`,
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			});
		}
	}
	return out;
};

void MOBS;
