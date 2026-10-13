// 「ブラックジャック」（data/arcade/home/blackjack.ts）の 試験。

import {
	BJ,
	bjDealerHits,
	bjStart,
	bjStep,
	bjTotal,
} from "../../data/arcade/home/blackjack";
import type { Card } from "../../data/arcade/home/poker";
import { type HomeGameTest, ok, seeded } from "./kit";

const cs = (...rs: number[]): Card[] => rs.map((r) => ({ r, s: 0 }));

export const tests: HomeGameTest[] = [
	{
		name: "ブラックジャックは ソフトの 合計を 数え、親は 16で 引き ソフト17で 止まる",
		run: () => {
			const t = (rs: number[]) => bjTotal(cs(...rs));
			ok(t([1, 6]).total === 17 && t([1, 6]).soft, "A6 soft 17");
			ok(t([1, 1, 9]).total === 21 && t([1, 1, 9]).soft, "AA9 soft 21");
			ok(t([1, 6, 10]).total === 17 && !t([1, 6, 10]).soft, "A6T hard 17");
			ok(t([13, 12, 1]).total === 21, "KQA 21");
			ok(t([10, 6, 9]).total === 25, "bust 25");
			ok(bjDealerHits(cs(10, 6)), "hits hard 16");
			ok(!bjDealerHits(cs(1, 6)), "stands soft 17");
			ok(!bjDealerHits(cs(10, 7)), "stands 17");
			ok(bjDealerHits(cs(1, 5)), "hits soft 16");
		},
	},
	{
		name: "ブラックジャックは 勝ちで 2倍、BJ で 2.5倍（切りすて）が もどり、チップの 勘定が あう",
		run: () => {
			for (let seed = 1; seed <= 200; seed++) {
				const rnd = seeded(seed);
				const s = bjStart();
				pkBet(s, 3);
				const before = s.chips;
				bjStep(s, 0.1, { deal: true }, rnd);
				// 17 以上なら 止まる、それ 以下は 引く
				let guard = 0;
				while (s.phase !== "bet" && guard++ < 100) {
					const p = bjTotal(s.player).total;
					bjStep(
						s,
						BJ.dealerGap,
						p < 17 ? { hit: true } : { stand: true },
						rnd,
					);
				}
				ok(s.result !== null, `seed ${seed} no result`);
				const want =
					s.result === "bj"
						? 3 + 4
						: s.result === "win"
							? s.stake * 2
							: s.result === "push"
								? s.stake
								: 0;
				ok(s.lastWin === want, `seed ${seed} ${s.result} ${s.lastWin}`);
				ok(s.chips === before - s.stake + want, `seed ${seed} chips`);
				// 親が 引いた なら 17 以上で 止まって いる
				if (s.dealer.length > 2)
					ok(!bjDealerHits(s.dealer), `seed ${seed} dealer stopped early`);
			}
		},
	},
];

const pkBet = (s: ReturnType<typeof bjStart>, n: number): void => {
	for (let i = 1; i < n; i++) bjStep(s, 0.1, { bet: 1 }, seeded(1));
};
