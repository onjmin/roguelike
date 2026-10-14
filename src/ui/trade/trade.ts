// おんJ証券の 端末（家の パソコン・おんJマートの ATM）。株・デイトレ・FX（決まりと 文は data/trade/trade.ts）。
// 株価と 持ち株は 別の 保存場所（kiriko-roguelike/stocks）。中断セーブ・記録・町には ふれない。
// 株価は 冒険から 帰った 回数（runStats().runs）だけ 動く（端末を 開いた ときに まとめて。STOCK_CATCHUP まで）。
// 配当は そのとき 持ち株に 応じて 財布へ。
// デイトレ・FX は 元手・証拠金を 先に 財布から 出し（spendYen）、終わったら のこりを もどす（earnYen）。

import {
	DAY,
	FX,
	priceStep,
	rng,
	STOCK_CATCHUP,
	STOCK_HISTORY,
	STOCK_IDS,
	STOCKS,
	type StockId,
	type StockNews,
	startPrices,
	TRADE_MSG,
} from "../../data/trade/trade";
import type { Story } from "../../engine/defs";
import { addFlag, hasFlag, runStats } from "../../engine/save";
import { earnYen, spendYen, walletYen, yen } from "../../engine/wallet";
import type { Ctx } from "../ctx";
import { listWindow } from "../list";
import { previewing } from "../village/pay";
import { fill } from "../village/villageTalk";
import { playDayTrade } from "./dayTrade";
import { playFx } from "./fx";

const KEY = "kiriko-roguelike/stocks";

/** 株価が いつ 動くかを 言った（Progress.flags）。 */
const TRADE_TOLD = "toldTrade";

type Holding = { n: number; cost: number };

type StockMemo = {
	v: 1;
	/** 株価を 動かした ときの 冒険の 回数。 */
	runs: number;
	prices: Record<StockId, number>;
	hist: Record<StockId, number[]>;
	hold: Partial<Record<StockId, Holding>>;
	/** いちばん 新しい ニュース。 */
	news: StockNews | null;
};

let memo: StockMemo | null = null;

const fresh = (): StockMemo => {
	const prices = startPrices();
	return {
		v: 1,
		runs: runStats().runs,
		prices,
		hist: Object.fromEntries(
			STOCK_IDS.map((id) => [id, [prices[id]]]),
		) as Record<StockId, number[]>,
		hold: {},
		news: null,
	};
};

export const loadStocks = (): StockMemo => {
	if (memo) return JSON.parse(JSON.stringify(memo)) as StockMemo;
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
		if (raw && raw.v === 1 && typeof raw.runs === "number") {
			const base = fresh();
			for (const id of STOCK_IDS) {
				const p = raw.prices?.[id];
				if (typeof p === "number" && p > 0) base.prices[id] = p;
				const h = raw.hist?.[id];
				if (Array.isArray(h))
					base.hist[id] = h.filter((x: unknown) => typeof x === "number");
				const o = raw.hold?.[id];
				if (o && typeof o.n === "number" && o.n > 0)
					base.hold[id] = { n: Math.floor(o.n), cost: Number(o.cost) || 0 };
			}
			base.runs = raw.runs;
			base.news = raw.news ?? null;
			return base;
		}
	} catch {
		// 読めなければ はじめから
	}
	return fresh();
};

const saveStocks = (m: StockMemo): void => {
	memo = JSON.parse(JSON.stringify(m)) as StockMemo;
	if (previewing()) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(m));
	} catch {
		// 保存できなくても この 回は 覚えている
	}
};

/** 試験用。 */
export const forgetStocksMemo = (): void => {
	memo = null;
};

/**
 * 冒険から 帰った ぶん 株価を 動かす（配当の 合計と 新しい ニュースを 返す）。runs は 試験で わたす。
 */
export const syncStocks = (
	runs = runStats().runs,
): { dividend: number; news: StockNews | null } => {
	const m = loadStocks();
	const steps = Math.min(STOCK_CATCHUP, Math.max(0, runs - m.runs));
	let dividend = 0;
	let news: StockNews | null = null;
	for (let i = 0; i < steps; i++) {
		const seed = runs - steps + i + 1;
		const r = priceStep(m.prices, seed);
		m.prices = r.prices;
		if (r.news) news = r.news;
		for (const id of STOCK_IDS) {
			m.hist[id] = [...(m.hist[id] ?? []), m.prices[id]].slice(-STOCK_HISTORY);
			const h = m.hold[id];
			const d = STOCKS[id].dividend;
			if (h && d) dividend += Math.floor(h.n * m.prices[id] * d);
		}
	}
	m.runs = Math.max(m.runs, runs);
	if (news) m.news = news;
	saveStocks(m);
	if (dividend > 0 && !previewing()) earnYen(dividend);
	return { dividend, news };
};

/** 持ち株の 評価（円）。 */
export const stockValue = (m: StockMemo = loadStocks()): number =>
	STOCK_IDS.reduce((a, id) => a + (m.hold[id]?.n ?? 0) * m.prices[id], 0);

/** 小さな グラフ（▁▂▃▄▅▆▇█）。 */
const spark = (h: readonly number[]): string => {
	const v = h.slice(-12);
	if (v.length < 2) return "";
	const lo = Math.min(...v);
	const hi = Math.max(...v);
	const bars = "▁▂▃▄▅▆▇█";
	return v
		.map((x) => bars[hi === lo ? 3 : Math.round(((x - lo) / (hi - lo)) * 7)])
		.join("");
};

const change = (h: readonly number[]): string => {
	const a = h[h.length - 2];
	const b = h[h.length - 1];
	if (!a || !b) return "";
	const p = ((b - a) / a) * 100;
	return p === 0 ? "±0%" : `${p > 0 ? "▲" : "▼"}${Math.abs(p).toFixed(1)}%`;
};

/** 端末（家の パソコン・ATM）。 */
export const tradeTerminal = async (ctx: Ctx, s: Story): Promise<void> => {
	const r = syncStocks();
	await s.narrate(TRADE_MSG.terminal);
	// 株価が いつ 動くかを はじめの 1回だけ（端末を 開きなおしても 動かない）
	if (!hasFlag(TRADE_TOLD)) {
		await s.narrate(TRADE_MSG.howPrices);
		if (!previewing()) addFlag(TRADE_TOLD);
	}
	if (r.dividend > 0)
		await s.narrate(fill(TRADE_MSG.dividend, { price: yen(r.dividend) }));
	if (r.news) {
		await s.narrate(TRADE_MSG.news);
		await s.narrate(r.news.text);
	}
	for (;;) {
		const n = await s.choose([...TRADE_MSG.menu], { cancel: 3 });
		if (n === 0) await stockDesk(ctx, s);
		else if (n === 1) await dayDesk(ctx, s);
		else if (n === 2) await fxDesk(ctx, s);
		else return;
	}
};

// ───────────────── 株 ─────────────────

const stockDesk = async (ctx: Ctx, s: Story): Promise<void> => {
	let start = 0;
	for (;;) {
		const m = loadStocks();
		await s.wait(0);
		const v = await listWindow(
			ctx,
			`${fill(TRADE_MSG.stockTitle, { value: yen(stockValue(m)) })}<br><small>手もと　${yen(walletYen())}</small>`,
			STOCK_IDS.map((id) => {
				const h = m.hold[id];
				return {
					label: STOCKS[id].name,
					sub: `${yen(m.prices[id])}　${change(m.hist[id] ?? [])}`,
					desc: `${spark(m.hist[id] ?? [])}　${h ? `${h.n}株` : STOCKS[id].note}`,
					value: id,
				};
			}),
			{ closeLabel: "もどる", start },
		);
		if (!v || !(STOCK_IDS as string[]).includes(v)) return;
		const id = v as StockId;
		start = STOCK_IDS.indexOf(id);
		await trade(s, id);
	}
};

const trade = async (s: Story, id: StockId): Promise<void> => {
	const m = loadStocks();
	const price = m.prices[id];
	const held = m.hold[id]?.n ?? 0;
	await s.narrate(
		fill(TRADE_MSG.stockAsk, {
			name: STOCKS[id].short,
			price: yen(price),
			n: held,
		}),
	);
	const k = await s.choose([...TRADE_MSG.stockMenu], { cancel: 2 });
	if (k === 0) {
		const have = walletYen();
		const max = Math.floor(have / price);
		if (max <= 0) {
			await s.narrate(fill(TRADE_MSG.short, { have: yen(have) }));
			return;
		}
		const sizes = [...new Set([1, 10, 100, max].filter((x) => x <= max))].sort(
			(a, b) => a - b,
		);
		await s.narrate(fill(TRADE_MSG.buyHow, { have: yen(have) }));
		const i = await s.choose(
			[...sizes.map((x) => `${x}株　${yen(x * price)}`), "やめる"],
			{ cancel: sizes.length },
		);
		const q = sizes[i];
		if (!q || !spendYen(q * price, previewing())) return;
		const m2 = loadStocks();
		const h = m2.hold[id] ?? { n: 0, cost: 0 };
		m2.hold[id] = {
			n: h.n + q,
			cost: (h.cost * h.n + price * q) / (h.n + q),
		};
		saveStocks(m2);
		s.se("arcCoin");
		await s.narrate(
			fill(TRADE_MSG.bought, {
				name: STOCKS[id].short,
				n: q,
				price: yen(q * price),
			}),
		);
		return;
	}
	if (k === 1) {
		if (held <= 0) {
			await s.narrate(TRADE_MSG.none);
			return;
		}
		const sizes = [
			...new Set([1, 10, 100, held].filter((x) => x <= held)),
		].sort((a, b) => a - b);
		await s.narrate(fill(TRADE_MSG.sellHow, { n: held }));
		const i = await s.choose(
			[...sizes.map((x) => `${x}株　${yen(x * price)}`), "やめる"],
			{ cancel: sizes.length },
		);
		const q = sizes[i];
		if (!q) return;
		const m2 = loadStocks();
		const h = m2.hold[id];
		if (!h) return;
		const got = q * price;
		const net = Math.round((price - h.cost) * q);
		h.n -= q;
		if (h.n <= 0) delete m2.hold[id];
		saveStocks(m2);
		if (!previewing()) earnYen(got);
		s.se("arcCoin");
		await s.narrate(
			fill(TRADE_MSG.sold, {
				name: STOCKS[id].short,
				n: q,
				price: yen(got),
				net:
					net > 0
						? fill(TRADE_MSG.gain, { price: yen(net) })
						: net < 0
							? fill(TRADE_MSG.loss, { price: yen(-net) })
							: TRADE_MSG.even,
			}),
		);
	}
};

// ───────────────── デイトレ・FX ─────────────────

/** 元手を えらんで 払う（やめた・足りない ときは null）。 */
const stake = async (
	s: Story,
	ask: string,
	list: readonly number[],
): Promise<number | null> => {
	const have = walletYen();
	const can = list.filter((x) => x <= have);
	if (!can.length) {
		await s.narrate(
			fill(TRADE_MSG.stakeShort, { price: yen(list[0] ?? 0), have: yen(have) }),
		);
		return null;
	}
	await s.narrate(fill(ask, { have: yen(have) }));
	const i = await s.choose([...can.map((x) => yen(x)), "やめる"], {
		cancel: can.length,
	});
	const x = can[i];
	if (!x || !spendYen(x, previewing())) return null;
	s.se("arcCoin");
	return x;
};

/** 終わった あと：のこりを 財布へ もどして 差し引きを 言う。 */
const settle = async (
	s: Story,
	paid: number,
	back: number,
	head: string,
): Promise<void> => {
	if (back > 0 && !previewing()) earnYen(back);
	const net = back - paid;
	await s.narrate(
		fill(TRADE_MSG.result, {
			head,
			net:
				net > 0
					? fill(TRADE_MSG.win, { price: yen(net) })
					: net < 0
						? fill(TRADE_MSG.lose, { price: yen(-net) })
						: TRADE_MSG.zero,
		}),
	);
};

const dayDesk = async (ctx: Ctx, s: Story): Promise<void> => {
	const m = loadStocks();
	await s.narrate(TRADE_MSG.pickStock);
	const i = await s.choose(
		[
			...STOCK_IDS.map((id) => `${STOCKS[id].short}　${yen(m.prices[id])}`),
			"やめる",
		],
		{ cancel: STOCK_IDS.length },
	);
	const id = STOCK_IDS[i];
	if (!id) return;
	const paid = await stake(s, TRADE_MSG.stakeAsk, DAY.stakes);
	if (paid === null) return;
	await s.wait(0);
	const back = await playDayTrade(ctx, id, m.prices[id], paid);
	await settle(s, paid, back, fill(TRADE_MSG.back, { price: yen(back) }));
};

/** その 帰りの はじめの レート（帰りごとに 140〜160 の どこか）。 */
const fxOpen = (): number => {
	const r = rng(runStats().runs * 131 + 7);
	return Math.round((FX.start - 10 + r() * 20) * 1000) / 1000;
};

const fxDesk = async (ctx: Ctx, s: Story): Promise<void> => {
	await s.narrate(TRADE_MSG.leverAsk);
	const li = await s.choose([...FX.levers.map((x) => `${x}倍`), "やめる"], {
		cancel: FX.levers.length,
	});
	const lever = FX.levers[li];
	if (!lever) return;
	if (lever >= 100) await s.narrate(TRADE_MSG.high);
	const paid = await stake(s, TRADE_MSG.marginAsk, FX.margins);
	if (paid === null) return;
	await s.wait(0);
	const r = await playFx(ctx, fxOpen(), lever, paid);
	if (r.cut === "zerocut" && r.left <= 0) {
		await s.narrate(TRADE_MSG.zerocut);
		await settle(s, paid, 0, fill(TRADE_MSG.back, { price: yen(0) }));
		return;
	}
	if (r.cut === "losscut") await s.narrate(TRADE_MSG.losscut);
	await settle(s, paid, r.left, fill(TRADE_MSG.back, { price: yen(r.left) }));
};
