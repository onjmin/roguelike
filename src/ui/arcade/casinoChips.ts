// カジノ「ガチャ」の チップを 買う・換金する 窓（2026-10-14 作者：「「お金を 賭けない」という 方針は 撤廃して 良い」）。
// ui/arcade/arcade.ts の arcadeScript が カジノの 台（data/arcade/casino.ts の isCasinoGame）で 使う：
// 品書き「チップを　買う」→ 枚数を えらぶ（財布で 払える ものだけ。spendYen）→ 買った 枚数で 板 →
// おわるか B で やめたら 手もとの 枚数を 同じ 値段で 換金（earnYen）と 差し引き。
// 値段と 文は data/arcade/casino.ts。

import { CASINO, CASINO_NET, casinoKind } from "../../data/arcade/casino";
import type { ArcadeGame } from "../../data/arcade/types";
import type { Story } from "../../engine/defs";
import { earnYen, spendYen, walletYen, yen } from "../../engine/wallet";
import type { UiCtx } from "../list";
import { fill } from "../village/villageTalk";

/** 品書き（遊ぶ 項目が「〜を　買う」）。 */
export const casinoMenu = (game: ArcadeGame): string[] => [
	CASINO[casinoKind(game)].buy,
	"ハイスコアを　見る",
	"やめる",
];

/** 払う（足りなければ false）。noSave は 下見。 */
export const casinoBuy = (
	game: ArcadeGame,
	n: number,
	noSave = false,
): boolean => spendYen(n * CASINO[casinoKind(game)].rate, noSave);

/** 換金する（もどった 円）。noSave は 下見。 */
export const casinoCash = (
	game: ArcadeGame,
	left: number,
	noSave = false,
): number => {
	const got = Math.max(0, Math.floor(left)) * CASINO[casinoKind(game)].rate;
	earnYen(got, noSave);
	return got;
};

/** 買う 枚数を えらんで 払う（やめた・買えない ときは null）。 */
export const buyChips = async (
	ctx: UiCtx,
	s: Story,
	game: ArcadeGame,
	noSave = false,
): Promise<number | null> => {
	const c = CASINO[casinoKind(game)];
	const have = walletYen();
	const can = c.buyins.filter((n) => n * c.rate <= have);
	if (!can.length) {
		await s.narrate(
			fill(c.short, {
				price: yen((c.buyins[0] ?? 0) * c.rate),
				have: yen(have),
			}),
		);
		return null;
	}
	await s.narrate(fill(c.ask, { have: yen(have) }));
	const opts = [
		...can.map((n) => fill(c.option, { n, price: yen(n * c.rate) })),
		"やめる",
	];
	const k = await s.choose(opts, { cancel: can.length });
	const n = can[k];
	if (n === undefined || !casinoBuy(game, n, noSave)) return null;
	ctx.se("arcCoin");
	await s.narrate(fill(c.bought, { n, price: yen(n * c.rate) }));
	return n;
};

/** 手もとの 枚数を 換金して、差し引きを 言う。 */
export const cashOut = async (
	s: Story,
	game: ArcadeGame,
	bought: number,
	left: number,
	noSave = false,
): Promise<void> => {
	const c = CASINO[casinoKind(game)];
	const n = Math.max(0, Math.floor(left));
	const got = casinoCash(game, n, noSave);
	const net = got - bought * c.rate;
	const head = n > 0 ? fill(c.cashed, { n, price: yen(got) }) : c.none;
	const tail =
		net > 0
			? fill(CASINO_NET.win, { price: yen(net) })
			: net < 0
				? fill(CASINO_NET.lose, { price: yen(-net) })
				: CASINO_NET.even;
	await s.narrate(`${head}\n${tail}`);
};
