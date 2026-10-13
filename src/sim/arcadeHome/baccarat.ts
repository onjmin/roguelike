// 「バカラ」（data/arcade/home/baccarat.ts）の 試験。

import {
	BC,
	bcBankerDraws,
	bcDeal,
	bcPay,
	bcStart,
	bcStep,
	bcTotal,
} from "../../data/arcade/home/baccarat";
import type { Card } from "../../data/arcade/home/poker";
import { type HomeGameTest, ok, seeded } from "./kit";

const cs = (...rs: number[]): Card[] => rs.map((r) => ({ r, s: 0 }));

export const tests: HomeGameTest[] = [
	{
		name: "バカラは 3枚目の 決まり（表）どおりに 引く",
		run: () => {
			ok(bcTotal(cs(13, 9)) === 9 && bcTotal(cs(7, 8)) === 5, "points");
			// PLAYER が 止まった とき
			ok(bcBankerDraws(5, null) && !bcBankerDraws(6, null), "banker stand");
			// PLAYER の 3枚目で かわる
			ok(bcBankerDraws(3, 7) && !bcBankerDraws(3, 8), "b3");
			ok(
				bcBankerDraws(4, 2) && !bcBankerDraws(4, 1) && !bcBankerDraws(4, 8),
				"b4",
			);
			ok(bcBankerDraws(5, 4) && !bcBankerDraws(5, 3), "b5");
			ok(bcBankerDraws(6, 6) && !bcBankerDraws(6, 5), "b6");
			ok(!bcBankerDraws(7, 0) && bcBankerDraws(2, 9), "b7 b2");
			// 山を 決めて 配る（後ろから 引く：P1 B1 P2 B2 P3 B3）
			const deck = (...rs: number[]): Card[] => cs(...rs).reverse();
			const nat = bcDeal(deck(8, 2, 1, 3, 5, 5), seeded(1));
			ok(
				nat.player.length === 2 && nat.banker.length === 2,
				"natural stops both",
			);
			// P=2+3=5 引く（8）、B=4+0=4、P3=8 なので B は 引かない
			const a = bcDeal(deck(2, 4, 3, 10, 8, 9), seeded(1));
			ok(
				a.player.length === 3 && a.banker.length === 2,
				"banker 4 vs 8 stands",
			);
			// P=6 止まる、B=3 引く
			const b = bcDeal(deck(3, 1, 3, 2, 4), seeded(1));
			ok(
				b.player.length === 2 && b.banker.length === 3,
				"player 6 stands, banker 3 draws",
			);
			ok(b.order.join("") === "pbpbb", `order ${b.order.join("")}`);
		},
	},
	{
		name: "バカラは PLAYER 1倍・BANKER 0.95倍・TIE 8倍で 払い、TIE は 賭けが もどる",
		run: () => {
			ok(bcPay("player", "player", 4) === 8, "player");
			ok(
				bcPay("banker", "banker", 5) === 9 &&
					bcPay("banker", "banker", 1) === 1,
				"banker",
			);
			ok(bcPay("tie", "tie", 2) === 18, "tie");
			ok(
				bcPay("player", "tie", 3) === 3 && bcPay("banker", "tie", 3) === 3,
				"push",
			);
			ok(
				bcPay("player", "banker", 3) === 0 && bcPay("tie", "player", 3) === 0,
				"lose",
			);
			// 回して 勘定を みる
			const rnd = seeded(5);
			const s = bcStart();
			let guard = 0;
			while (!s.over && guard++ < 20000) {
				const before = s.chips;
				const bet = s.bet;
				bcStep(s, 0.1, { side: "banker", deal: true, bet: 1 }, rnd);
				if (s.phase !== "deal") continue;
				while (s.phase === "deal") bcStep(s, BC.flip, {}, rnd);
				ok(s.shown === s.order.length, "all shown");
				ok(
					s.chips ===
						before - Math.min(BC.maxBet, bet + 1, before) + s.lastWin ||
						s.chips === BC.cap,
					"chips",
				);
			}
			ok(s.over || s.chips > 0, "ends");
		},
	},
];
