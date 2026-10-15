// おんJ銀行の 窓口（定期預金と 家の ローンの 繰り上げ返済。決まりと 文は data/trade/bank.ts）。
// 預金は 別の 保存場所（kiriko-roguelike/bank）。利息は 冒険から 帰った 回数（runStats().runs）だけ、
// 窓口に 来た ときに まとめて つける（BANK_CATCHUP まで）。財布と 預金の あいだは spendYen・earnYen だけ。

import {
	BANK_CAP,
	BANK_CATCHUP,
	BANK_MSG,
	BANK_RATE,
} from "../../data/trade/bank";
import { CASH_STEPS } from "../../data/trade/trade";
import { HOME_MONTHLY, LOAN_MONTHS } from "../../data/village/myhome";
import type { Story } from "../../engine/defs";
import { runStats } from "../../engine/save";
import { earnYen, spendYen, walletYen, yen } from "../../engine/wallet";
import { loadHome, paidMonths, prepayLoan } from "../village/myhome";
import { previewing } from "../village/pay";
import { fill } from "../village/villageTalk";

const KEY = "kiriko-roguelike/bank";

type BankMemo = {
	v: 1;
	/** 利息を つけた ときの 冒険の 回数。 */
	runs: number;
	/** 定期預金（円）。 */
	saved: number;
	/** これまでの 利息の 合計（円）。 */
	earned: number;
};

let memo: BankMemo | null = null;

const count = (x: unknown): number =>
	typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0;

export const loadBank = (): BankMemo => {
	if (memo) return { ...memo };
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
		if (raw && raw.v === 1)
			return {
				v: 1,
				runs: count(raw.runs),
				saved: count(raw.saved),
				earned: count(raw.earned),
			};
	} catch {
		// 読めなければ はじめから
	}
	return { v: 1, runs: runStats().runs, saved: 0, earned: 0 };
};

const saveBank = (m: BankMemo): void => {
	memo = { ...m };
	if (previewing()) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(m));
	} catch {
		// 保存できなくても この 回は 覚えている
	}
};

/** 試験用。 */
export const forgetBankMemo = (): void => {
	memo = null;
};

/** 1回の 帰りの 利息（円）。 */
export const interestOf = (saved: number): number =>
	Math.floor(Math.min(saved, BANK_CAP) * BANK_RATE);

/** 帰った ぶんの 利息を つける（ついた 額を 返す）。runs は 試験で わたす。 */
export const syncBank = (runs = runStats().runs): number => {
	const m = loadBank();
	const steps = Math.min(BANK_CATCHUP, Math.max(0, runs - m.runs));
	let got = 0;
	for (let i = 0; i < steps; i++) {
		const d = interestOf(m.saved);
		m.saved += d;
		got += d;
	}
	m.earned += got;
	m.runs = Math.max(m.runs, runs);
	saveBank(m);
	return got;
};

/** 預ける（財布 → 定期）。財布が 足りなければ false。 */
export const bankDeposit = (n: number): boolean => {
	if (n <= 0 || !spendYen(n, previewing())) return false;
	const m = loadBank();
	m.saved += n;
	saveBank(m);
	return true;
};

/** 引き出す（定期 → 財布）。定期が 足りなければ false。 */
export const bankWithdraw = (n: number): boolean => {
	const m = loadBank();
	if (n <= 0 || m.saved < n) return false;
	m.saved -= n;
	saveBank(m);
	if (!previewing()) earnYen(n);
	return true;
};

/** 額を えらぶ（CASH_STEPS の うち max まで ＋ のこり ぜんぶ。やめたら null）。 */
const pickAmount = async (
	s: Story,
	ask: string,
	max: number,
): Promise<number | null> => {
	const list = CASH_STEPS.filter((x) => x < max);
	await s.narrate(ask);
	const i = await s.choose(
		[
			...list.map((x) => yen(x)),
			fill(BANK_MSG.all, { price: yen(max) }),
			"やめる",
		],
		{ cancel: list.length + 1 },
	);
	if (i === list.length) return max;
	return list[i] ?? null;
};

const savings = async (s: Story): Promise<void> => {
	await s.narrate(fill(BANK_MSG.rate, { rate: `${BANK_RATE * 100}%` }));
	await s.narrate(fill(BANK_MSG.cap, { cap: yen(BANK_CAP) }));
	for (;;) {
		const n = await s.choose([...BANK_MSG.saveMenu], { cancel: 3 });
		if (n === 0) {
			const have = walletYen();
			if (have <= 0) {
				await s.narrate(BANK_MSG.noWallet);
				continue;
			}
			const x = await pickAmount(
				s,
				fill(BANK_MSG.depositAsk, { have: yen(have) }),
				have,
			);
			if (x === null || !bankDeposit(x)) continue;
			s.se("pay");
			await s.narrate(
				fill(BANK_MSG.deposited, {
					price: yen(x),
					saved: yen(loadBank().saved),
				}),
			);
		} else if (n === 1) {
			const saved = loadBank().saved;
			if (saved <= 0) {
				await s.narrate(BANK_MSG.noSaved);
				continue;
			}
			const x = await pickAmount(
				s,
				fill(BANK_MSG.withdrawAsk, { saved: yen(saved) }),
				saved,
			);
			if (x === null || !bankWithdraw(x)) continue;
			s.se("arcCoin");
			await s.narrate(
				fill(BANK_MSG.withdrew, {
					price: yen(x),
					saved: yen(loadBank().saved),
				}),
			);
		} else if (n === 2) {
			const m = loadBank();
			await s.narrate(
				fill(BANK_MSG.balance, {
					saved: yen(m.saved),
					earned: yen(m.earned),
				}),
			);
		} else return;
	}
};

const loan = async (s: Story): Promise<void> => {
	const home = loadHome();
	if (!home.owned) {
		await s.narrate(BANK_MSG.noHome);
		return;
	}
	const left = LOAN_MONTHS - paidMonths(home);
	if (left <= 0) {
		await s.narrate(BANK_MSG.loanDone);
		return;
	}
	await s.narrate(
		fill(BANK_MSG.loanLeft, { n: left, price: yen(left * HOME_MONTHLY) }),
	);
	if (home.late > 0) await s.narrate(fill(BANK_MSG.late, { n: home.late }));
	await s.narrate(BANK_MSG.prepayAsk);
	const steps = [12, 60, left];
	const n = await s.choose(
		BANK_MSG.prepayMenu.map((t) =>
			fill(t, {
				y1: yen(Math.min(12, left) * HOME_MONTHLY),
				y5: yen(Math.min(60, left) * HOME_MONTHLY),
				all: yen(left * HOME_MONTHLY),
			}),
		),
		{ cancel: 3 },
	);
	const want = steps[n];
	if (want === undefined) return;
	const months = Math.min(want, left);
	if (walletYen() < months * HOME_MONTHLY) {
		await s.narrate(BANK_MSG.short);
		return;
	}
	const paid = prepayLoan(months);
	if (paid <= 0) return;
	s.se("pay");
	await s.narrate(
		fill(BANK_MSG.prepaid, {
			price: yen(paid * HOME_MONTHLY),
			n: LOAN_MONTHS - paidMonths(loadHome()),
		}),
	);
};

/** 窓口（あいさつ → 前に 来てから ついた 利息 → 定期預金・ローン）。 */
export const bankWindow = async (s: Story): Promise<void> => {
	await s.narrate(BANK_MSG.welcome);
	const got = syncBank();
	if (got > 0) await s.narrate(fill(BANK_MSG.interest, { price: yen(got) }));
	for (;;) {
		const n = await s.choose([...BANK_MSG.menu], { cancel: 2 });
		if (n === 0) await savings(s);
		else if (n === 1) await loan(s);
		else return;
	}
};
