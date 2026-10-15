// おんJ証券。端末（家の パソコン・ネットカフェ・新市街支店の 端末）で 株・デイトレ・FX、
// 支店の 窓口で 口座の 開設と 入金・出金、おんJマートの ATM で 入金・出金（決まりと 文は data/trade/trade.ts）。
// 株価・持ち株・口座は 別の 保存場所（kiriko-roguelike/stocks）。中断セーブ・記録・町には ふれない。
// 株価は 冒険から 帰った 回数（runStats().runs）だけ 動く（端末を 開いた ときに まとめて。STOCK_CATCHUP まで）。
// 配当は そのとき 持ち株に 応じて 口座へ。
// 売り買いは 口座の お金（cash）で する。デイトレ・FX は 元手・証拠金を 先に 口座から 出し、終わったら のこりを もどす。
// 財布（engine/wallet.ts）と 口座の あいだは 入金（spendYen）・出金（earnYen）だけ。

import {
	ACCOUNT_MSG,
	CASH_STEPS,
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
	TRADE_GUIDE,
	TRADE_MSG,
} from "../../data/trade/trade";
import type { Story } from "../../engine/defs";
import { addFlag, hasFlag, runStats } from "../../engine/save";
import { earnYen, spendYen, walletYen, yen } from "../../engine/wallet";
import type { Ctx } from "../ctx";
import { readGuide } from "../guide";
import { listWindow } from "../list";
import { previewing } from "../village/pay";
import { fill } from "../village/villageTalk";
import { playDayTrade } from "./dayTrade";
import { playFx } from "./fx";

const KEY = "kiriko-roguelike/stocks";

/** 株価が いつ 動くかを 言った（Progress.flags）。 */
const TRADE_TOLD = "toldTrade";
/** デイトレ・FX の はじめての 説明を 言った（Progress.flags）。 */
const DAY_TOLD = "toldDayTrade";
const FX_TOLD = "toldFx";

/** はじめての ときだけ 説明を 読む（下見では 覚えない）。 */
const tellOnce = async (
	s: Story,
	flag: string,
	lines: readonly string[],
): Promise<void> => {
	if (hasFlag(flag)) return;
	for (const t of lines) await s.narrate(t);
	if (!previewing()) addFlag(flag);
};

/** 支店の パンフの 棚（口座・株・デイトレ・FX の 説明。いつでも 読める）。 */
export const guideRack = (s: Story): Promise<void> => readGuide(s, TRADE_GUIDE);

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
	/** 口座を 作ったか（新市街支店の 窓口）。 */
	open: boolean;
	/** 口座の お金（円）。 */
	cash: number;
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
		open: false,
		cash: 0,
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
			// open の ない 保存は、持ち株か 端末を 使った 印が あれば 口座が ある ことに（お金は 0円から）
			base.open =
				typeof raw.open === "boolean"
					? raw.open
					: Object.keys(base.hold).length > 0 || hasFlag(TRADE_TOLD);
			const cash = Number(raw.cash);
			base.cash = Number.isFinite(cash) ? Math.max(0, Math.floor(cash)) : 0;
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
	m.cash += dividend;
	saveStocks(m);
	return { dividend, news };
};

/** 口座の お金を ふやす・へらす（へらす ときは 足りなければ 何も せず false）。 */
const moveCash = (d: number): boolean => {
	const m = loadStocks();
	if (m.cash + d < 0) return false;
	m.cash += d;
	saveStocks(m);
	return true;
};

/** 口座の お金（円）。 */
export const accountYen = (): number => loadStocks().cash;

/** 口座を 作る（新市街支店の 窓口）。 */
export const openAccount = (): void => {
	const m = loadStocks();
	m.open = true;
	saveStocks(m);
};

/** 入金（財布 → 口座）。手もとが 足りなければ 何も せず false。 */
export const deposit = (yen: number): boolean => {
	if (!spendYen(yen, previewing())) return false;
	moveCash(yen);
	return true;
};

/** 出金（口座 → 財布）。口座が 足りなければ 何も せず false。 */
export const withdraw = (yen: number): boolean => {
	if (!moveCash(-yen)) return false;
	if (!previewing()) earnYen(yen);
	return true;
};

/** 持ち株の 評価（円）。 */
export const stockValue = (m: StockMemo = loadStocks()): number =>
	STOCK_IDS.reduce((a, id) => a + (m.hold[id]?.n ?? 0) * m.prices[id], 0);

/** 買った ときからの 含み損益（円。持っていなければ 0）。 */
const holdPl = (m: StockMemo, id: StockId): number => {
	const h = m.hold[id];
	return h ? Math.round((m.prices[id] - h.cost) * h.n) : 0;
};

/** 損益の 字（+1,200円・−1,200円・±0）。 */
const plText = (n: number): string =>
	n > 0 ? `+${yen(n)}` : n < 0 ? `−${yen(-n)}` : "±0";

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

/** 端末（家の パソコン・ネットカフェ・新市街支店の 端末）。口座が なければ 支店を すすめるだけ。 */
export const tradeTerminal = async (ctx: Ctx, s: Story): Promise<void> => {
	if (!loadStocks().open) {
		await s.narrate(TRADE_MSG.noAccount);
		return;
	}
	const r = syncStocks();
	await s.narrate(fill(TRADE_MSG.terminal, { cash: yen(accountYen()) }));
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
			`${fill(TRADE_MSG.stockTitle, { value: yen(stockValue(m)) })}<br><small>${fill(
				TRADE_MSG.stockSub,
				{
					cash: yen(m.cash),
					pl: plText(STOCK_IDS.reduce((a, id) => a + holdPl(m, id), 0)),
				},
			)}</small>`,
			STOCK_IDS.map((id) => {
				const h = m.hold[id];
				return {
					label: STOCKS[id].name,
					sub: `${yen(m.prices[id])}　${change(m.hist[id] ?? [])}`,
					desc: `${spark(m.hist[id] ?? [])}　${h ? fill(TRADE_MSG.stockHeld, { n: h.n, pl: plText(holdPl(m, id)) }) : STOCKS[id].note}`,
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
		fill(held > 0 ? TRADE_MSG.stockAskHeld : TRADE_MSG.stockAsk, {
			name: STOCKS[id].short,
			price: yen(price),
			n: held,
			cost: yen(Math.round(m.hold[id]?.cost ?? 0)),
			pl: plText(holdPl(m, id)),
		}),
	);
	const k = await s.choose([...TRADE_MSG.stockMenu], { cancel: 2 });
	if (k === 0) {
		const have = m.cash;
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
		if (!q || !moveCash(-q * price)) return;
		const m2 = loadStocks();
		const h = m2.hold[id] ?? { n: 0, cost: 0 };
		m2.hold[id] = {
			n: h.n + q,
			cost: (h.cost * h.n + price * q) / (h.n + q),
		};
		saveStocks(m2);
		s.se("pay");
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
		const cost = m.hold[id]?.cost ?? price;
		const i = await s.choose(
			[
				...sizes.map(
					(x) =>
						`${x}株　${yen(x * price)}（${plText(Math.round((price - cost) * x))}）`,
				),
				"やめる",
			],
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
		m2.cash += got;
		saveStocks(m2);
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

/** 元手を えらんで 口座から 出す（やめた・足りない ときは null）。 */
const stake = async (
	s: Story,
	ask: string,
	list: readonly number[],
): Promise<number | null> => {
	const have = accountYen();
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
	if (!x || !moveCash(-x)) return null;
	s.se("pay");
	return x;
};

/** 終わった あと：のこりを 口座へ もどして 差し引きを 言う。 */
const settle = async (
	s: Story,
	paid: number,
	back: number,
	head: string,
): Promise<void> => {
	if (back > 0) moveCash(back);
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
	await tellOnce(s, DAY_TOLD, TRADE_GUIDE.firstDay);
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
	await tellOnce(s, FX_TOLD, TRADE_GUIDE.firstFx);
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

// ───────────────── 口座（窓口・ATM） ─────────────────

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
			fill(ACCOUNT_MSG.all, { price: yen(max) }),
			"やめる",
		],
		{ cancel: list.length + 1 },
	);
	if (i === list.length) return max;
	return list[i] ?? null;
};

/** 入金・出金・残高（ATM と 口座の ある 窓口）。 */
const cashDesk = async (s: Story): Promise<void> => {
	for (;;) {
		const n = await s.choose([...ACCOUNT_MSG.menu], { cancel: 3 });
		if (n === 0) {
			const have = walletYen();
			if (have <= 0) {
				await s.narrate(ACCOUNT_MSG.noWallet);
				continue;
			}
			const x = await pickAmount(
				s,
				fill(ACCOUNT_MSG.depositAsk, { have: yen(have) }),
				have,
			);
			if (x === null || !deposit(x)) continue;
			s.se("pay");
			await s.narrate(
				fill(ACCOUNT_MSG.deposited, {
					price: yen(x),
					cash: yen(accountYen()),
				}),
			);
		} else if (n === 1) {
			const cash = accountYen();
			if (cash <= 0) {
				await s.narrate(ACCOUNT_MSG.noCash);
				continue;
			}
			const x = await pickAmount(
				s,
				fill(ACCOUNT_MSG.withdrawAsk, { cash: yen(cash) }),
				cash,
			);
			if (x === null || !withdraw(x)) continue;
			s.se("arcCoin");
			await s.narrate(
				fill(ACCOUNT_MSG.withdrew, {
					price: yen(x),
					cash: yen(accountYen()),
				}),
			);
		} else if (n === 2) {
			syncStocks();
			await s.narrate(
				fill(ACCOUNT_MSG.balance, {
					cash: yen(accountYen()),
					value: yen(stockValue()),
				}),
			);
		} else return;
	}
};

/** おんJマートの ATM（ATM の 文の あと。口座が なければ カードが ない）。 */
export const atmDesk = async (s: Story): Promise<void> => {
	if (!loadStocks().open) {
		await s.narrate(ACCOUNT_MSG.noCard);
		return;
	}
	await cashDesk(s);
};

/** 新市街支店の 窓口（口座が なければ 開設、あれば 入金・出金）。 */
export const shokenWindow = async (s: Story): Promise<void> => {
	if (loadStocks().open) {
		await s.narrate(ACCOUNT_MSG.window);
		await cashDesk(s);
		return;
	}
	await s.narrate(ACCOUNT_MSG.welcome);
	await s.narrate(ACCOUNT_MSG.openAsk);
	if ((await s.choose([...ACCOUNT_MSG.openMenu], { cancel: 1 })) !== 0) {
		await s.narrate(ACCOUNT_MSG.nevermind);
		return;
	}
	await s.narrate(ACCOUNT_MSG.idCheck);
	await s.narrate(ACCOUNT_MSG.careerAsk);
	const c = await s.choose([...ACCOUNT_MSG.careerMenu], { cancel: 0 });
	await s.narrate(ACCOUNT_MSG.career[c] ?? ACCOUNT_MSG.career[0]);
	await s.narrate(ACCOUNT_MSG.risk);
	if ((await s.choose([...ACCOUNT_MSG.agreeMenu], { cancel: 1 })) !== 0) {
		await s.narrate(ACCOUNT_MSG.nevermind);
		return;
	}
	openAccount();
	await s.narrate(ACCOUNT_MSG.opened);
	for (const t of TRADE_GUIDE.afterOpen) await s.narrate(t);
};

/** 支店の 株価ボード（いまの 株価と 前の 帰りからの 動き。2銘柄ずつ）。 */
export const stockBoard = async (s: Story): Promise<void> => {
	syncStocks();
	const m = loadStocks();
	const rows = STOCK_IDS.map((id) =>
		[STOCKS[id].short, yen(m.prices[id]), change(m.hist[id] ?? [])]
			.filter(Boolean)
			.join("　"),
	);
	for (let i = 0; i < rows.length; i += 2)
		await s.narrate(rows.slice(i, i + 2).join("\n"));
};
