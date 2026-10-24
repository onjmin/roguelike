// なかよし度（data/people/bonds.ts・ui/village/bonds.ts）と おんJ証券（data/trade/trade.ts・ui/trade/trade.ts）・
// おんJ銀行（data/trade/bank.ts・ui/trade/bank.ts）の 試験。
// pnpm test で いっしょに 動く。形は seasonTests と 同じ（Fail・ok・{ id, name, ok, reason }）。id の 頭は B。

import { BOND_STEPS } from "../data/people/bonds";
import { MOBS } from "../data/people/mobs";
import { BANK_CAP, BANK_CATCHUP, BANK_RATE } from "../data/trade/bank";
import { priceStep, STOCK_IDS, STOCKS, startPrices } from "../data/trade/trade";
import { HOME_MONTHLY, LOAN_MONTHS } from "../data/village/myhome";
import { forgetWalletMemo, walletYen } from "../engine/wallet";
import {
	bankDeposit,
	bankWithdraw,
	forgetBankMemo,
	interestOf,
	loadBank,
	syncBank,
} from "../ui/trade/bank";
import {
	accountYen,
	deposit,
	forgetStocksMemo,
	loadStocks,
	openAccount,
	stockValue,
	syncStocks,
	withdraw,
} from "../ui/trade/trade";
import {
	bondLevel,
	forgetBondsMemo,
	loadBonds,
	withBond,
} from "../ui/village/bonds";
import { forgetCafeMemo } from "../ui/village/cafe";
import {
	forgetHomeMemo,
	loadHome,
	prepayLoan,
	saveHome,
} from "../ui/village/myhome";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

const CASES: { id: string; name: string; run: () => void | Promise<void> }[] =
	[];
const test = (id: string, name: string, run: () => void | Promise<void>) =>
	CASES.push({ id, name, run });

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
		forgetBankMemo();
		forgetHomeMemo();
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
				!log.some((t) => t.includes("なかよくなった")),
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
	"stock prices rise by about their growth on average (sweeter than real), and never reach 0",
	() => {
		// はじめの 値から 1歩ずつ（何歩も つなげると 複利で ゆれが 大きい）。1歩の 倍率の 平均が 1＋growth ほど（上げに 寄る ニュースの ぶん 少し 上）
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
			const g = STOCKS[id].growth;
			ok(
				mean > 1 && Math.abs(mean - 1 - g) < 0.03,
				`${id}: mean step ×${mean.toFixed(4)}`,
			);
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
				r.dividend > 0 && loadStocks().cash === r.dividend,
				"dividend not paid into the account",
			);
			ok(walletYen() === before, "dividend went to the wallet");
			ok(syncStocks(8).dividend === 0, "the same return paid twice");
			syncStocks(200);
			ok(loadStocks().hist.hoshu.length <= 24, "history too long");
			ok(stockValue() > 0, "holding has no value");
		});
	},
);

test(
	"B8",
	"the account: deposit and withdraw move yen between the wallet and the account, never below 0",
	async () => {
		await withStorage(async (store) => {
			setPoints(store, 10000);
			ok(!loadStocks().open, "a new player already has an account");
			openAccount();
			ok(loadStocks().open, "the account did not open");
			ok(deposit(3000), "deposit failed");
			ok(walletYen() === 7000 && accountYen() === 3000, "deposit did not move");
			ok(!deposit(8000), "deposited more than the wallet");
			ok(!withdraw(4000), "withdrew more than the account");
			ok(withdraw(1000), "withdraw failed");
			ok(
				walletYen() === 8000 && accountYen() === 2000,
				"withdraw did not move",
			);
		});
		// 口座が できる 前に 株を 持っていた 人は 口座が ある ことに
		await withStorage(async (store) => {
			setPoints(store, 0);
			const m = loadStocks();
			const { open: _o, cash: _c, ...old } = m;
			old.hold.hoshu = { n: 1, cost: 100 };
			store.set("kiriko-roguelike/stocks", JSON.stringify(old));
			forgetStocksMemo();
			ok(loadStocks().open, "an old holder has no account");
			ok(loadStocks().cash === 0, "an old holder got free cash");
		});
	},
);

test(
	"B9",
	"the bank: time deposits earn interest once per return (up to the cap), and the counter prepays the house loan",
	async () => {
		await withStorage(async (store) => {
			setPoints(store, 500000);
			store.set(
				"kiriko-roguelike/stats",
				JSON.stringify({ runs: 3, clears: 0, best: 1 }),
			);
			ok(!bankDeposit(600000), "deposited more than the wallet");
			ok(bankDeposit(100000), "deposit failed");
			ok(walletYen() === 400000, "deposit did not leave the wallet");
			ok(syncBank(3) === 0, "interest without a return");
			// 2回目は 1回目の 利息にも つく
			const one = interestOf(100000);
			ok(
				syncBank(5) === one + interestOf(100000 + one),
				"2 returns, wrong interest",
			);
			ok(syncBank(5) === 0, "the same return paid twice");
			const saved = loadBank().saved;
			ok(saved === 100000 + loadBank().earned, "interest not added");
			ok(bankDeposit(300000), "second deposit failed");
			ok(
				interestOf(loadBank().saved) === BANK_CAP * BANK_RATE,
				"interest above the cap",
			);
			ok(
				syncBank(5 + 100) === BANK_CATCHUP * BANK_CAP * BANK_RATE,
				"catch-up not limited",
			);
			ok(!bankWithdraw(loadBank().saved + 1), "withdrew more than saved");
			const w = walletYen();
			ok(bankWithdraw(5000), "withdraw failed");
			ok(walletYen() === w + 5000, "withdraw did not reach the wallet");
		});
		await withStorage(async (store) => {
			setPoints(store, 15 * HOME_MONTHLY);
			ok(prepayLoan(12) === 0, "prepaid without a house");
			const h = loadHome();
			h.owned = true;
			h.late = 2;
			saveHome(h, false);
			ok(prepayLoan(12) === 12, "prepay failed");
			ok(walletYen() === 3 * HOME_MONTHLY, "prepay cost");
			ok(loadHome().paid === 12 && loadHome().late === 0, "late not cleared");
			ok(prepayLoan(12) === 0, "prepaid beyond the wallet");
			const done = loadHome();
			done.paid = LOAN_MONTHS - 1;
			saveHome(done, false);
			ok(prepayLoan(60) === 1, "prepaid past the end of the loan");
		});
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
