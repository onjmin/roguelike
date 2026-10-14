// カジノ「ガチャ」の チップの 窓（換金所と 台）。値段と 文は data/arcade/casino.ts、チップ入れは engine/chips.ts。
// 2026-10-15 作者：「換金所が 設定され、そこで 一元的に 換金の やり取りが できると わかりやすい。
// ゲームを やる 場所で やる ものじゃない」：
// - 換金所（部屋の 窓口。data/village/facilities.ts の plays で "arcade"、物の 名前 "cashier" → ui/arcade/arcade.ts の
//   arcadePlay が cashierScript を 呼ぶ）：財布の お金で チップを 買う・チップを 円に もどす。
// - 台（ui/arcade/arcade.ts の arcadeScript）：bringChips で 持って いる チップから 何枚 出すか えらび、
//   遊んだ あと returnChips で のこりを チップ入れに もどす（円には しない）。
// - パチンコは 出した チップを 玉に かえて 座り（1枚 25発）、立つと 25発ごとに チップに もどす。はんぱは あずかる。

import {
	BALLS_PER_CHIP,
	CASHIER,
	CASINO_TABLE,
	CHIP_YEN,
	chipDiff,
	usesBalls,
} from "../../data/arcade/casino";
import type { ArcadeGame } from "../../data/arcade/types";
import {
	addChips,
	ballsKept,
	chipsOwned,
	keepBalls,
	takeChips,
} from "../../engine/chips";
import type { Story } from "../../engine/defs";
import { earnYen, spendYen, walletYen, yen } from "../../engine/wallet";
import type { UiCtx } from "../list";
import { fill } from "../village/villageTalk";

/** 換金所の 物の 名前（data/village/facilities.ts の カジノの things）。 */
export const CASHIER_THING = "cashier";

/** チップを 買う（払えなければ false）。noSave は 下見。 */
export const buyChipsAt = (n: number, noSave = false): boolean => {
	if (!spendYen(n * CHIP_YEN, noSave)) return false;
	addChips(n, noSave);
	return true;
};

/** チップを 円に もどす（足りなければ 0）。もどった 円。noSave は 下見。 */
export const cashChipsAt = (n: number, noSave = false): number => {
	const k = Math.max(0, Math.floor(n));
	if (!k || !takeChips(k, noSave)) return 0;
	earnYen(k * CHIP_YEN, noSave);
	return k * CHIP_YEN;
};

/** 換金所の 窓口（買う・換金する を 何度でも。やめるまで）。 */
export const cashierScript = async (
	ctx: UiCtx,
	s: Story,
	noSave = false,
): Promise<void> => {
	const C = CASHIER;
	for (;;) {
		await s.narrate(
			fill(C.status, { chips: chipsOwned(), have: yen(walletYen()) }),
		);
		const k = await s.choose([...C.menu], { cancel: C.menu.length - 1 });
		if (k === 0) {
			const have = walletYen();
			const can = C.buyins.filter((n) => n * CHIP_YEN <= have);
			if (!can.length) {
				await s.narrate(
					fill(C.short, {
						price: yen((C.buyins[0] ?? 0) * CHIP_YEN),
						have: yen(have),
					}),
				);
				continue;
			}
			await s.narrate(fill(C.buyAsk, { have: yen(have) }));
			const opts = [
				...can.map((n) => fill(C.option, { n, price: yen(n * CHIP_YEN) })),
				"やめる",
			];
			const n = can[await s.choose(opts, { cancel: can.length })];
			if (n === undefined || !buyChipsAt(n, noSave)) continue;
			ctx.se("arcCoin");
			await s.narrate(
				fill(C.bought, {
					n,
					price: yen(n * CHIP_YEN),
					chips: chipsOwned(),
				}),
			);
		} else if (k === 1) {
			const own = chipsOwned();
			if (own <= 0) {
				await s.narrate(C.noChips);
				continue;
			}
			await s.narrate(fill(C.cashAsk, { chips: own }));
			const ns = [...C.cashOuts.filter((n) => n < own), own];
			const opts = [
				...ns.map((n, i) =>
					fill(i === ns.length - 1 ? C.all : C.cashOption, { n }),
				),
				"やめる",
			];
			const n = ns[await s.choose(opts, { cancel: ns.length })];
			if (n === undefined) continue;
			const got = cashChipsAt(n, noSave);
			if (!got) continue;
			ctx.se("arcCoin");
			await s.narrate(
				fill(C.cashed, { n, price: yen(got), chips: chipsOwned() }),
			);
		} else return;
	}
};

/** 台に 出す チップ（出した 枚数と、板に わたす はじめの 枚数／玉）。 */
export type Bring = { chips: number; stake: number };

/** チップ（パチンコは 玉）に して 台に 出す。出した ぶん チップ入れから へる。 */
export const sitWith = (
	game: ArcadeGame,
	n: number,
	noSave = false,
): Bring | null => {
	if (n <= 0 || !takeChips(n, noSave)) return null;
	if (!usesBalls(game)) return { chips: n, stake: n };
	const kept = ballsKept();
	if (kept) keepBalls(0, noSave);
	return { chips: n, stake: n * BALLS_PER_CHIP + kept };
};

/** 何枚 出すかを えらんで 台に 出す（やめた・1枚も ない ときは null）。 */
export const bringChips = async (
	s: Story,
	game: ArcadeGame,
	noSave = false,
): Promise<Bring | null> => {
	const T = CASINO_TABLE;
	const own = chipsOwned();
	if (own <= 0) {
		await s.narrate(T.none);
		return null;
	}
	await s.narrate(fill(usesBalls(game) ? T.ballAsk : T.ask, { chips: own }));
	const ns = [...T.bring.filter((n) => n < own), own];
	const opts = [
		...ns.map((n, i) => fill(i === ns.length - 1 ? T.all : T.option, { n })),
		"やめる",
	];
	const n = ns[await s.choose(opts, { cancel: ns.length })];
	if (n === undefined) return null;
	const kept = ballsKept();
	const b = sitWith(game, n, noSave);
	if (b && usesBalls(game))
		await s.narrate(
			fill(kept ? T.ballsKept : T.balls, { n, b: b.stake, r: kept }),
		);
	return b;
};

/** 台を 立つ：のこった チップ（玉）を チップ入れに もどす。もどった 枚数。 */
export const leaveWith = (
	game: ArcadeGame,
	left: number,
	noSave = false,
): number => {
	const k = Math.max(0, Math.floor(left));
	if (!usesBalls(game)) {
		addChips(k, noSave);
		return k;
	}
	const n = Math.floor(k / BALLS_PER_CHIP);
	addChips(n, noSave);
	keepBalls(ballsKept() + (k % BALLS_PER_CHIP), noSave);
	// あずかりが 25発に なったら チップに
	const more = Math.floor(ballsKept() / BALLS_PER_CHIP);
	if (more) {
		addChips(more, noSave);
		keepBalls(ballsKept() % BALLS_PER_CHIP, noSave);
	}
	return n + more;
};

/** 台を 立って、もどった 枚数と 増減を 言う。 */
export const returnChips = async (
	s: Story,
	game: ArcadeGame,
	bring: Bring,
	left: number,
	noSave = false,
): Promise<void> => {
	const T = CASINO_TABLE;
	const k = Math.max(0, Math.floor(left));
	const n = leaveWith(game, k, noSave);
	const v = {
		n,
		b: k,
		chips: chipsOwned(),
		diff: chipDiff(n - bring.chips),
	};
	if (usesBalls(game) && k > 0) {
		await s.narrate(fill(T.ballBack, v));
		const r = ballsKept();
		if (r > 0) await s.narrate(fill(T.keep, { r }));
	} else await s.narrate(fill(n > 0 ? T.back : T.lost, v));
};
