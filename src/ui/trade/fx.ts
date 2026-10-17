// FX（ドル円。data/trade/trade.ts の FX・FX_TEXT）。レバレッジと 証拠金を えらんで、場（90秒）の あいだ
// ← で 売り（ショート）・→ で 買い（ロング）・A で 決済。板の タップは 左 3分の1 が 売り・右 3分の1 が 買い・まんなかが 決済。
// 持つ 量は「いまの 口座 × レバレッジ」。証拠金維持率（口座の 評価 ÷ 建てた ときの 口座）が FX.losscut を
// 下まわると ロスカット（その 値で 決済）。急な 動きで 口座が マイナスに なったら ゼロカット（0 で 終わり）。
// 場の なかほどで 1回 指標発表（雇用統計）が あり、大きく ゆれる。見た目の 乱数なので Math.random。

import { FX, FX_TEXT, gauss } from "../../data/trade/trade";
import type { UiCtx } from "../list";
import { BW, type G, txt } from "../neta/netaBoard";
import { fill } from "../village/villageTalk";
import { drawLine, hud, runTrade } from "./tradeBoard";

type Pos = { dir: 1 | -1; entry: number; units: number; base: number };

type Fx = {
	rate: number;
	hist: number[];
	t: number;
	next: number;
	lever: number;
	/** 口座（決済した あとの 残り）。 */
	bal: number;
	pos: Pos | null;
	trend: number;
	shockAt: number;
	shockLeft: number;
	shocked: boolean;
	flash: { text: string; t: number; ink: string } | null;
	cut: "losscut" | "zerocut" | null;
	done: boolean;
};

export type FxResult = { left: number; cut: Fx["cut"] };

const SLOTS = Math.round(FX.seconds / FX.tick) + 1;
const MIN_BAL = 100;

/** 買いは ask・売りは bid で 建てて、反対で 閉じる。 */
const bid = (s: Fx) => s.rate - FX.spread / 2;
const ask = (s: Fx) => s.rate + FX.spread / 2;

const unreal = (s: Fx): number => {
	const p = s.pos;
	if (!p) return 0;
	const exit = p.dir > 0 ? bid(s) : ask(s);
	return (exit - p.entry) * p.dir * p.units;
};
const equity = (s: Fx): number => s.bal + unreal(s);
/** 証拠金維持率（持っていなければ null）。 */
const ratio = (s: Fx): number | null =>
	s.pos ? equity(s) / Math.max(1, s.pos.base) : null;

const close = (s: Fx): number => {
	const pl = unreal(s);
	s.bal = Math.max(0, s.bal + pl);
	s.pos = null;
	return pl;
};

const open = (s: Fx, dir: 1 | -1): void => {
	if (s.bal < MIN_BAL) return;
	const entry = dir > 0 ? ask(s) : bid(s);
	s.pos = { dir, entry, units: (s.bal * s.lever) / entry, base: s.bal };
};

const yenStr = (v: number): string =>
	`${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v)).toLocaleString("ja-JP")}円`;

/** 場を 回して、のこった 口座（円）と ロスカットの 有無を 返す。 */
export const playFx = async (
	ctx: UiCtx,
	startRate: number,
	lever: number,
	margin: number,
): Promise<FxResult> => {
	const act = (
		s: Fx,
		a: "buy" | "sell" | "close",
		f: { se: (n: string) => void; say: (t: string) => void },
	) => {
		if (s.done) return;
		if (
			a === "close" ||
			(s.pos && (a === "buy" ? s.pos.dir < 0 : s.pos.dir > 0))
		) {
			if (!s.pos) return;
			const pl = close(s);
			f.se(pl >= 0 ? "arcCoin" : "miss");
			f.say(`決済　${yenStr(pl)}`);
			return;
		}
		if (s.pos) return;
		open(s, a === "buy" ? 1 : -1);
		const p = s.pos as Pos | null;
		if (p) {
			f.se("put");
			f.say(
				fill(a === "buy" ? FX_TEXT.long : FX_TEXT.short, {
					lot: `${Math.round(p.units).toLocaleString("ja-JP")}ドル`,
				}),
			);
		}
	};
	const s = await runTrade<Fx>(ctx, {
		title: `${FX_TEXT.title}　${fill(FX_TEXT.lever, { lever })}`,
		hint: FX_TEXT.hint,
		note: FX_TEXT.note,
		start: () => ({
			rate: startRate,
			hist: [startRate],
			t: 0,
			next: FX.tick,
			lever,
			bal: margin,
			pos: null,
			trend: Math.random() < 0.5 ? 1 : -1,
			shockAt: FX.shockAt[0] + Math.random() * (FX.shockAt[1] - FX.shockAt[0]),
			shockLeft: 0,
			shocked: false,
			flash: null,
			cut: null,
			done: false,
		}),
		step: (s, f) => {
			if (s.done) return;
			for (const e of f.evs) {
				if ("k" in e) {
					if (e.k === "left") act(s, "sell", f);
					else if (e.k === "right") act(s, "buy", f);
					else if (e.k === "a") act(s, "close", f);
				} else {
					const x = e.tap[0];
					act(s, x < BW / 3 ? "sell" : x > (BW * 2) / 3 ? "buy" : "close", f);
				}
			}
			s.t += f.dt;
			while (s.t >= s.next && s.hist.length < SLOTS && !s.done) {
				s.next += FX.tick;
				if (Math.random() < FX.tick / FX.regime) s.trend = -s.trend;
				let d = gauss(Math.random) * FX.vol + s.trend * FX.drift;
				if (!s.shocked && s.t >= s.shockAt) {
					s.shocked = true;
					const m = FX.shock[0] + Math.random() * (FX.shock[1] - FX.shock[0]);
					s.shockLeft = (Math.random() < 0.5 ? 1 : -1) * m;
					s.flash = { text: FX_TEXT.shock, t: s.t, ink: "#ffe060" };
					f.se("alert");
				}
				if (Math.abs(s.shockLeft) > 0.01) {
					const part = s.shockLeft * 0.35;
					s.shockLeft -= part;
					d += part + gauss(Math.random) * FX.vol * 3;
				}
				s.rate = Math.max(1, s.rate + d);
				s.hist.push(s.rate);
				// ロスカット・ゼロカット
				const r = ratio(s);
				if (r !== null && r < FX.losscut) {
					const eq = equity(s);
					close(s);
					if (eq <= 0) {
						s.cut = "zerocut";
						s.bal = 0;
						s.flash = { text: FX_TEXT.zerocut, t: s.t, ink: "#ff4040" };
					} else {
						s.cut = "losscut";
						s.flash = { text: FX_TEXT.losscut, t: s.t, ink: "#ff6060" };
					}
					f.se("miss");
					f.say(
						`${s.cut === "zerocut" ? FX_TEXT.zerocut : FX_TEXT.losscut}　口座　${Math.round(s.bal).toLocaleString("ja-JP")}円`,
					);
					if (s.bal < MIN_BAL) s.done = true;
				}
			}
			if (s.hist.length >= SLOTS) {
				if (s.pos) close(s);
				s.done = true;
			}
		},
		draw: (g: G, s) => {
			g.fillStyle = "#05070c";
			g.fillRect(0, 0, BW, 150);
			const left = Math.max(0, Math.ceil(FX.seconds - s.t));
			hud(g, `ドル円　${s.rate.toFixed(3)}`, `のこり　${left}秒`);
			drawLine(
				g,
				s.hist,
				{ x: 4, y: 18, w: 232, h: 88, slots: SLOTS },
				s.pos
					? [{ v: s.pos.entry, ink: s.pos.dir > 0 ? "#50a0ff" : "#ff8040" }]
					: [],
			);
			const eq = equity(s);
			const r = ratio(s);
			txt(
				g,
				`口座　${Math.round(eq).toLocaleString("ja-JP")}円`,
				4,
				110,
				8,
				"#e8e8f0",
			);
			const p = s.pos;
			txt(
				g,
				p
					? `${p.dir > 0 ? "買い" : "売り"}　${p.entry.toFixed(3)}　${yenStr(unreal(s))}`
					: FX_TEXT.none,
				4,
				121,
				8,
				p ? (unreal(s) >= 0 ? "#50e090" : "#ff6060") : "#8890a0",
			);
			// 維持率の 帯（50%で ロスカット）
			txt(g, FX_TEXT.ratio, 4, 133, 8, "#c8c8d8");
			g.fillStyle = "#202838";
			g.fillRect(30, 134, 80, 8);
			if (r !== null) {
				const w = Math.max(0, Math.min(1, r / 2)) * 80;
				g.fillStyle = r < 0.7 ? "#ff4040" : r < 1 ? "#f0c040" : "#50e090";
				g.fillRect(30, 134, w, 8);
				txt(g, `${Math.round(r * 100)}%`, 114, 133, 8, "#e8e8f0");
			}
			g.fillStyle = "#ff6060";
			g.fillRect(30 + 20, 132, 1, 12);
			// ボタン
			g.fillStyle = "#c04838";
			g.fillRect(148, 112, 28, 34);
			txt(g, "売", 162, 122, 12, "#ffffff", "center");
			g.fillStyle = "#505868";
			g.fillRect(178, 112, 28, 34);
			txt(g, "決済", 192, 124, 8, "#ffffff", "center");
			g.fillStyle = "#3870c8";
			g.fillRect(208, 112, 28, 34);
			txt(g, "買", 222, 122, 12, "#ffffff", "center");
			if (s.flash && s.t - s.flash.t < 2) {
				g.fillStyle = "rgba(0,0,0,0.65)";
				g.fillRect(30, 50, 180, 22);
				txt(g, s.flash.text, BW / 2, 55, 12, s.flash.ink, "center");
			}
		},
		over: (s) => s.done,
		end: (s) =>
			s.cut === "zerocut" && s.bal <= 0 ? FX_TEXT.zerocut : "クローズ",
		quit: (s) => {
			if (s.pos) close(s);
			s.done = true;
		},
	});
	return { left: Math.max(0, Math.floor(s.bal)), cut: s.cut };
};
