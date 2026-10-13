// ぷゆゆ なでなで（data/arcade/home/clicker.ts）の 試験。

import {
	CK,
	CK_SHOP,
	ckBuy,
	ckClick,
	ckCost,
	ckPower,
	ckRate,
	ckScore,
	ckStart,
	ckStep,
} from "../../data/arcade/home/clicker";
import { type HomeGameTest, ok } from "./kit";

export const tests: HomeGameTest[] = [
	{
		name: "なでなでは なでると ふえ・買うと 値が 上がり 毎秒 ふえる",
		run: () => {
			const s = ckStart();
			ok(!ckBuy(s, 1), "まだ 買えない");
			for (let i = 0; i < CK_SHOP[1].cost; i++) ckClick(s);
			const c0 = ckCost(s, 1);
			ok(ckBuy(s, 1) && s.puyu === 0, `buy ${s.puyu}`);
			ok(ckCost(s, 1) > c0 && ckRate(s) === CK_SHOP[1].rate, "rate");
			ckStep(s, 2);
			ok(Math.abs(s.puyu - 2 * CK_SHOP[1].rate) < 1e-9, `idle ${s.puyu}`);
			ok(ckScore(s) === CK_SHOP[1].cost + 2 * CK_SHOP[1].rate, "total");
		},
	},
	{
		name: "なでなでは 毎秒 6回 なでて 安い 順に 買うと 数千匹で 60秒で おわる",
		run: () => {
			const s = ckStart();
			const dt = 1 / 6;
			while (!s.over) {
				ckClick(s);
				// いちばん 値の 割に ふえる 品を 買う（手袋は なでる 数×6 を 毎秒と みる）
				let best = -1;
				let val = 0;
				CK_SHOP.forEach((it, i) => {
					const r = it.glove ? 6 : it.rate;
					const v = r / ckCost(s, i);
					if (v > val) [best, val] = [i, v];
				});
				if (best >= 0) ckBuy(s, best);
				ckStep(s, dt);
			}
			ok(s.t >= CK.time, "time");
			ok(ckPower(s) > 1, `power ${ckPower(s)}`);
			ok(ckScore(s) > 1500 && ckScore(s) < 100000, `score ${ckScore(s)}`);
		},
	},
];
