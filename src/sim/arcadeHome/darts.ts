// ダーツ の 試験（data/arcade/home/darts.ts）。

import {
	DT,
	dtCheckout,
	dtLand,
	dtScore,
	dtScoreAt,
	dtStart,
	dtStep,
} from "../../data/arcade/home/darts";
import { type HomeGameTest, ok, seeded } from "./kit";

/** 上から 右まわりの 角度（度）と 半径の 点。 */
const at = (deg: number, r: number): readonly [number, number] => {
	const a = (deg * Math.PI) / 180;
	return [Math.sin(a) * r, -Math.cos(a) * r];
};

export const tests: HomeGameTest[] = [
	{
		name: "ダーツは 的の 区画と 輪の 点が ただしい（T20・D20・S6・S3・BULL・25・はずれ）",
		run: () => {
			const mid = (DT.tripleIn + DT.tripleOut) / 2;
			const dbl = (DT.doubleIn + DT.doubleOut) / 2;
			const cases: [readonly [number, number], number, string][] = [
				[at(0, mid), 60, "T20"],
				[at(0, dbl), 40, "D20"],
				[at(90, 20), 6, "S6"],
				[at(180, 20), 3, "S3"],
				[at(18 * 19, mid), 15, "T5"],
				[[0, 0], 50, "BULL"],
				[at(45, 4), 25, "25"],
				[at(0, DT.doubleOut + 2), 0, "out"],
			];
			for (const [[x, y], pts, label] of cases) {
				const got = dtScoreAt(x, y);
				ok(got.pts === pts, `${label}: got ${got.label} ${got.pts}`);
			}
		},
	},
	{
		name: "ダーツは 0 を こえると バースト（ラウンドの はじめに もどる）、ちょうど 0 で あがり",
		run: () => {
			const rnd = seeded(4);
			const s = dtStart();
			s.remain = 50;
			s.roundStart = 50;
			dtLand(s, ...at(90, 20));
			ok(s.remain === 44, `remain ${s.remain}`);
			const ev = dtLand(s, ...at(0, (DT.tripleIn + DT.tripleOut) / 2));
			ok(
				ev.includes("bust") && s.remain === 50 && s.bust,
				`bust ${ev} ${s.remain}`,
			);
			// バーストしたら 3本 投げきらずに 次の ラウンド
			for (let i = 0; i < 200 && s.round === 1; i++)
				dtStep(s, 1 / 30, false, rnd);
			ok(s.round === 2 && s.hits.length === 0 && !s.bust, `round ${s.round}`);
			const fin = dtLand(s, 0, 0);
			ok(fin.includes("finish") && s.remain === 0, `finish ${fin}`);
			for (let i = 0; i < 60 && !s.over; i++) dtStep(s, 1 / 30, false, rnd);
			ok(s.over && dtScore(s) === 1000 - 2 * 50, `score ${dtScore(s)}`);
		},
	},
	{
		name: "ダーツは A 2回で 矢が 飛び、ねらいの 道すじで あがれる",
		run: () => {
			const rnd = seeded(5);
			const s = dtStart();
			dtStep(s, 0.1, false, rnd);
			dtStep(s, 0.1, true, rnd);
			ok(s.phase === "y", `phase ${s.phase}`);
			dtStep(s, 0.1, true, rnd);
			ok(s.phase === "fly", `phase ${s.phase}`);
			for (let i = 0; i < 20 && s.phase === "fly"; i++)
				dtStep(s, 1 / 30, false, rnd);
			ok(
				s.hits.length === 1 && s.remain === DT.start - (s.hits[0]?.pts ?? 0),
				"one dart landed",
			);
			// 道すじの 点を たすと のこりに なる
			const val = (l: string): number =>
				l === "BULL"
					? 50
					: l === "25"
						? 25
						: Number(l.slice(1)) * ({ S: 1, D: 2, T: 3 }[l[0] as "S"] ?? 0);
			for (const n of [170, 121, 99, 41, 23, 7]) {
				const r = dtCheckout(n, 3);
				ok(r.reduce((a, l) => a + val(l), 0) === n, `${n}: ${r.join(" ")}`);
			}
		},
	},
	{
		name: "ダーツは 押した 時刻の ゆれで 止まる（こまの おわりより 前に 押したら その 所）",
		run: () => {
			const a = dtStart();
			const b = dtStart();
			dtStep(a, 0.2, false, seeded(6));
			dtStep(b, 0.2, false, seeded(6));
			const ax0 = a.ax;
			// a は こまの はじめに 押した（ago＝こまの 長さ）：前の こまで 見えて いた 所で 止まる
			dtStep(a, 0.05, 0.05, seeded(6));
			dtStep(b, 0.05, true, seeded(6));
			ok(a.phase === "y" && b.phase === "y", `phase ${a.phase} ${b.phase}`);
			ok(Math.abs(a.ax - ax0) < 1e-9, `stopped at ${a.ax}, saw ${ax0}`);
			ok(Math.abs(a.ax - b.ax) > 1e-6, "ago does not change the stop");
			const c = dtStart();
			dtStep(c, 0.2, false, seeded(6));
			dtStep(c, 0.05, 9, seeded(6));
			ok(Math.abs(c.ax - ax0) < 1e-9, "ago is not clamped to the frame");
		},
	},
];
