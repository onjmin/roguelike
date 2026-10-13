// デイトレ（data/trade/trade.ts の DAY・DAY_TEXT）。銘柄を 1つ えらび、元手で 場（60秒）の あいだ 売り買い する。
// A か 板の タップで「持っていなければ 買えるだけ 買う／持っていれば ぜんぶ 売る」。1回ごとに 手数料。
// 値は 流れ（上げ・下げ。ときどき かわる）と ゆれと 材料（急な 動き）で 動く。見た目の 乱数なので Math.random。
// 大引け（時間切れ）か B×2 で やめたら 持ち株は その 値で 売る。

import {
	DAY,
	DAY_TEXT,
	gauss,
	STOCKS,
	type StockId,
	TRADE_CHATTER,
} from "../../data/trade/trade";
import type { UiCtx } from "../list";
import { BW, type G, txt } from "../neta/netaBoard";
import { fill } from "../village/villageTalk";
import { drawLine, hud, runTrade } from "./tradeBoard";

type Day = {
	id: StockId;
	price: number;
	hist: number[];
	t: number;
	next: number;
	cash: number;
	shares: number;
	/** 買った 値（建値）。 */
	cost: number;
	trend: number;
	chat: number;
	flash: { text: string; t: number } | null;
	done: boolean;
};

const SLOTS = Math.round(DAY.seconds / DAY.tick) + 1;
const pick = <T>(list: readonly T[]): T =>
	list[Math.floor(Math.random() * list.length)] as T;

/** 円の 書き方（100円より 安い 株は 小数 1けた）。 */
const px = (v: number): string =>
	v < 100 ? v.toFixed(1) : Math.round(v).toLocaleString("ja-JP");
const signed = (v: number): string =>
	`${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v)).toLocaleString("ja-JP")}`;

const buyOrSell = (
	s: Day,
	se: (n: string) => void,
	say: (t: string) => void,
) => {
	if (s.shares > 0) {
		const got = s.shares * s.price;
		const net = got - s.shares * s.cost - DAY.fee;
		s.cash += got - DAY.fee;
		s.shares = 0;
		se(net >= 0 ? "arcCoin" : "miss");
		say(fill(DAY_TEXT.sold, { net: `${signed(net)}円` }));
		return;
	}
	const n = Math.floor((s.cash - DAY.fee) / s.price);
	if (n <= 0) return;
	s.shares = n;
	s.cost = s.price;
	s.cash -= n * s.price + DAY.fee;
	se("put");
	say(fill(DAY_TEXT.bought, { price: `${px(s.price)}円` }));
};

/** 場を 回して、終わった ときの 現金（円）を 返す。 */
export const playDayTrade = async (
	ctx: UiCtx,
	id: StockId,
	open: number,
	stake: number,
): Promise<number> => {
	const s = await runTrade<Day>(ctx, {
		title: `${DAY_TEXT.title}　${STOCKS[id].short}`,
		hint: DAY_TEXT.hint,
		note: DAY_TEXT.note,
		start: () => ({
			id,
			price: open,
			hist: [open],
			t: 0,
			next: DAY.tick,
			cash: stake,
			shares: 0,
			cost: 0,
			trend: Math.random() < 0.5 ? 1 : -1,
			chat: 4,
			flash: null,
			done: false,
		}),
		step: (s, f) => {
			if (s.done) return;
			for (const e of f.evs)
				if (("k" in e && e.k === "a") || "tap" in e) buyOrSell(s, f.se, f.say);
			s.t += f.dt;
			while (s.t >= s.next && s.hist.length < SLOTS) {
				s.next += DAY.tick;
				if (Math.random() < DAY.tick / DAY.regime) s.trend = -s.trend;
				let k = Math.exp(gauss(Math.random) * DAY.vol + s.trend * DAY.drift);
				if (Math.random() < DAY.jump * DAY.tick) {
					const up = Math.random() < 0.5;
					const m =
						DAY.jumpSize[0] +
						Math.random() * (DAY.jumpSize[1] - DAY.jumpSize[0]);
					k *= up ? 1 + m : 1 / (1 + m);
					s.flash = { text: up ? DAY_TEXT.jumpUp : DAY_TEXT.jumpDown, t: s.t };
					f.se(up ? "levelup" : "miss");
				}
				s.price = Math.max(1, s.price * k);
				s.hist.push(s.price);
			}
			s.chat -= f.dt;
			if (s.chat <= 0) {
				s.chat = 5 + Math.random() * 4;
				const d =
					s.price / (s.hist[Math.max(0, s.hist.length - 20)] ?? s.price);
				f.say(
					pick(
						d > 1.01
							? TRADE_CHATTER.up
							: d < 0.99
								? TRADE_CHATTER.down
								: TRADE_CHATTER.flat,
					),
				);
			}
			if (s.hist.length >= SLOTS) {
				if (s.shares > 0) buyOrSell(s, f.se, f.say);
				s.done = true;
			}
		},
		draw: (g: G, s) => {
			g.fillStyle = "#05070c";
			g.fillRect(0, 0, BW, 150);
			const left = Math.max(0, Math.ceil(DAY.seconds - s.t));
			hud(g, `${STOCKS[s.id].short}　${px(s.price)}円`, `のこり　${left}秒`);
			drawLine(
				g,
				s.hist,
				{ x: 4, y: 18, w: 232, h: 92, slots: SLOTS },
				s.shares > 0 ? [{ v: s.cost, ink: "#f0c040" }] : [],
			);
			const value = s.cash + s.shares * s.price;
			txt(
				g,
				`${DAY_TEXT.cash}　${Math.round(s.cash).toLocaleString("ja-JP")}円`,
				4,
				114,
				8,
				"#c8c8d8",
			);
			txt(
				g,
				s.shares > 0 ? fill(DAY_TEXT.hold, { n: s.shares }) : "ノーポジ",
				4,
				126,
				8,
				s.shares > 0 ? "#f0c040" : "#8890a0",
			);
			txt(
				g,
				`評価　${Math.round(value).toLocaleString("ja-JP")}円`,
				4,
				138,
				8,
				"#e8e8f0",
			);
			// ボタン
			g.fillStyle = s.shares > 0 ? "#c03838" : "#2a8a50";
			g.fillRect(150, 116, 86, 30);
			txt(g, s.shares > 0 ? "売る" : "買う", 193, 123, 16, "#ffffff", "center");
			if (s.flash && s.t - s.flash.t < 1.5) {
				g.fillStyle = "rgba(0,0,0,0.6)";
				g.fillRect(40, 50, 160, 22);
				txt(g, s.flash.text, BW / 2, 55, 12, "#ffe060", "center");
			}
		},
		over: (s) => s.done,
		end: () => DAY_TEXT.close,
		quit: (s) => {
			if (s.shares > 0) {
				s.cash += s.shares * s.price - DAY.fee;
				s.shares = 0;
			}
			s.done = true;
		},
	});
	return Math.max(0, Math.floor(s.cash));
};
