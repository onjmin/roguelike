// 「CRおんJタウン」（data/arcade/home/pachinko.ts）の 試験。

import {
	PC,
	type PcState,
	pcSpinEnd,
	pcStart,
	pcStep,
} from "../../data/arcade/home/pachinko";
import { type HomeGameTest, ok, seeded } from "./kit";

const ballAt = (s: PcState, x: number, y: number): void => {
	s.flying.push({ x, y, vx: 0, vy: 20, age: 0 });
};

export const tests: HomeGameTest[] = [
	{
		name: "CRおんJタウンは 打った 玉と もどった 玉の 勘定が あい、玉が 尽きると おわる",
		run: () => {
			const rnd = seeded(21);
			const s = pcStart();
			let t = 0;
			while (!s.over && t < 2000) {
				pcStep(s, 1 / 30, { fire: true, power: 0.7 }, rnd);
				ok(
					s.balls === PC.start - s.shot + s.paid,
					`t ${t.toFixed(1)} accounting`,
				);
				t += 1 / 30;
			}
			ok(s.over && s.balls === 0 && !s.flying.length, `over ${s.balls} ${t}`);
			ok(s.shot > PC.start && s.paid > 0, `shot ${s.shot} paid ${s.paid}`);
		},
	},
	{
		name: "CRおんJタウンは ヘソで 3発 もどって 回り、大当たりで アタッカーが 開く",
		run: () => {
			const s = pcStart();
			ballAt(s, PC.hesoX, PC.hesoY - 3);
			let heso = 0;
			for (let i = 0; i < 10; i++)
				for (const e of pcStep(s, 1 / 30, {}, () => 0.5))
					if (e === "heso") heso++;
			ok(heso === 1 && s.paid === PC.hesoBack, `heso ${heso} paid ${s.paid}`);
			ok(s.spin !== null && !s.spin.hit, "spin started");
			// 乱数 0 は 大当たり
			const j = pcStart();
			j.queue = 1;
			pcStep(j, 1 / 30, {}, () => 0);
			ok(j.spin?.hit === true, "jackpot roll");
			const end = j.spin ? pcSpinEnd(j.spin) : 0;
			let got = false;
			for (let t = 0; t < end + 0.5; t += 1 / 30)
				for (const e of pcStep(j, 1 / 30, {}, () => 0.5))
					if (e === "jackpot") got = true;
			ok(got && j.bonus !== null, "attacker open");
			const [ax, ay, aw] = PC.attacker;
			ballAt(j, ax + aw / 2, ay - 3);
			for (let i = 0; i < 10; i++) pcStep(j, 1 / 30, {}, () => 0.5);
			ok(
				j.paid === PC.attackerBack && j.bonus?.count === 1,
				`attacker ${j.paid}`,
			);
			// 時間で 閉じる
			for (let t = 0; t < PC.attackerTime + 1; t += 1 / 30)
				pcStep(j, 1 / 30, {}, () => 0.5);
			ok(
				j.bonus === null && j.lastBonus === PC.attackerBack,
				"attacker closed",
			);
		},
	},
];
