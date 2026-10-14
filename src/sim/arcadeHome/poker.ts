// 「ポーカー」（data/arcade/home/poker.ts）の 試験。

import {
	type Card,
	newDeck,
	PK,
	pkEval,
	pkPay,
	pkStart,
	pkStep,
} from "../../data/arcade/home/poker";
import { type HomeGameTest, ok, seeded } from "./kit";

/** "AS KH 10D" の ような 字から 札。 */
const hand = (s: string): Card[] =>
	s.split(" ").map((t) => {
		const r = t.slice(0, -1);
		const n =
			r === "A"
				? 1
				: r === "J"
					? 11
					: r === "Q"
						? 12
						: r === "K"
							? 13
							: Number(r);
		return { r: n, s: "SHDC".indexOf(t.slice(-1)) };
	});

export const tests: HomeGameTest[] = [
	{
		name: "ポーカーは 役を 見分ける",
		run: () => {
			const cases: [string, ReturnType<typeof pkEval>][] = [
				["10S JS QS KS AS", "royal"],
				["5H 6H 7H 8H 9H", "sf"],
				["AD 2D 3D 4D 5D", "sf"],
				["9C 9D 9H 9S 2C", "four"],
				["3C 3D 3H KS KC", "full"],
				["2C 7C 9C JC KC", "flush"],
				["10D JS QH KC AS", "straight"],
				["AD 2S 3H 4C 5S", "straight"],
				["QD KS AH 2C 3S", null],
				["7C 7D 7H 2S KC", "three"],
				["4C 4D 9H 9S KC", "two"],
				["JC JD 3H 7S 9C", "jacks"],
				["AC AD 3H 7S 9C", "jacks"],
				["10C 10D 3H 7S 9C", null],
				["2C 5D 8H JS KC", null],
			];
			for (const [h, want] of cases) {
				const got = pkEval(hand(h));
				ok(got === want, `${h}: ${got} != ${want}`);
			}
			ok(pkPay("royal", 5) === 4000 && pkPay("royal", 4) === 1000, "royal pay");
			ok(pkPay("jacks", 3) === 3 && pkPay(null, 5) === 0, "pay");
			const d = newDeck(seeded(3));
			ok(new Set(d.map((c) => c.r * 4 + c.s)).size === 52, "deck 52");
		},
	},
	{
		name: "ポーカーは 賭けて 配り、残した 札は かわらず、チップが なくなると おわる",
		run: () => {
			const rnd = seeded(11);
			const s = pkStart();
			pkStep(s, 0.1, { bet: 1 }, rnd);
			pkStep(s, 0.1, { bet: 1 }, rnd);
			ok(s.bet === 3, `bet ${s.bet}`);
			pkStep(s, 0.1, { go: true }, rnd);
			ok(
				s.phase === "hold" && s.hand.length === 5 && s.chips === PK.start - 3,
				"deal",
			);
			const keep = s.hand[2];
			pkStep(s, 0.1, { toggle: 2 }, rnd);
			pkStep(s, 0.1, { go: true }, rnd);
			ok(s.phase === "bet" && s.hand[2] === keep, "held card stays");
			ok(s.chips === PK.start - 3 + s.lastWin, "accounting");
			// 賭けつづけて 使いきる
			let guard = 0;
			while (!s.over && guard++ < 5000) {
				pkStep(s, 0.5, { bet: 1, go: true }, rnd);
				if (s.phase === "hold") pkStep(s, 0.5, { go: true }, rnd);
			}
			ok(s.over && s.chips === 0, `over ${s.chips} ${guard}`);
		},
	},
];
