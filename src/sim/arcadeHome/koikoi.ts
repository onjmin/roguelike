// 花札 こいこい（data/arcade/home/koikoi.ts）の 試験。
import {
	KK,
	type KkState,
	kkCpuKoi,
	kkCpuPick,
	kkCpuPlay,
	kkFlip,
	kkId,
	kkKind,
	kkKoi,
	kkNext,
	kkOver,
	kkPick,
	kkPlay,
	kkPts,
	kkScore,
	kkStart,
	kkYaku,
} from "../../data/arcade/home/koikoi";
import { type HomeGameTest, ok, seeded } from "./kit";

const names = (take: number[]): string =>
	kkYaku(take)
		.map((y) => `${y.name}${y.pts}`)
		.join(",");

/** 札が ぜんぶで 48枚 あるか（手札・場・山・取った 札・待ちの 札）。 */
const total = (s: KkState): number =>
	s.deck.length +
	s.field.length +
	s.side[0].hand.length +
	s.side[1].hand.length +
	s.side[0].take.length +
	s.side[1].take.length +
	(s.pending >= 0 ? 1 : 0);

/** 打った あとの 番・段階（代入で 型が 絞られないように 関数で 読む）。 */
const phase = (s: KkState): string => s.phase;
const turn = (s: KkState): number => s.turn;

export const tests: HomeGameTest[] = [
	{
		name: "花札は 48枚で 光5・タネ9・短冊10・カス24",
		run: () => {
			const n = { hikari: 0, tane: 0, tan: 0, kasu: 0 };
			for (let i = 0; i < 48; i++) n[kkKind(i)]++;
			ok(
				n.hikari === 5 && n.tane === 9 && n.tan === 10 && n.kasu === 24,
				`枚数が ちがう（${JSON.stringify(n)}）`,
			);
		},
	},
	{
		name: "花札の 役：光・猪鹿蝶・一杯・赤短・青短・枚数の 役",
		run: () => {
			const L = [0, 2, 7, 10, 11].map((m) => kkId(m, 0));
			ok(names(L) === "五光10", `五光（${names(L)}）`);
			ok(names(L.filter((c) => c !== kkId(10, 0))) === "四光8", "四光");
			ok(names(L.filter((c) => c !== kkId(0, 0))) === "雨四光7", "雨四光");
			ok(names([L[0], L[1], L[4]] as number[]) === "三光5", "三光");
			ok(kkPts([L[0], L[1], L[3]] as number[]) === 0, "雨入りの 3枚は 役なし");
			ok(names([kkId(6, 0), kkId(9, 0), kkId(5, 0)]) === "猪鹿蝶5", "猪鹿蝶");
			ok(
				names([kkId(2, 0), kkId(8, 0)]) === "花見で一杯5",
				`花見（${names([kkId(2, 0), kkId(8, 0)])}）`,
			);
			ok(names([kkId(7, 0), kkId(8, 0)]) === "月見で一杯5", "月見");
			ok(names([kkId(0, 1), kkId(1, 1), kkId(2, 1)]) === "赤短5", "赤短");
			ok(names([kkId(5, 1), kkId(8, 1), kkId(9, 1)]) === "青短5", "青短");
			// 赤短＋短冊 2枚 → 赤短と 短冊（5枚で 1）
			const tan = [kkId(0, 1), kkId(1, 1), kkId(2, 1), kkId(3, 1), kkId(4, 1)];
			ok(names(tan) === "赤短5,短冊1", `短冊（${names(tan)}）`);
			const tane = [1, 3, 4, 5, 6].map((m) => kkId(m, 0));
			ok(names(tane) === "タネ1", `タネ（${names(tane)}）`);
			const kasu = Array.from({ length: 11 }, (_, i) =>
				kkId(Math.floor(i / 2), 2 + (i % 2)),
			);
			ok(names(kasu) === "カス2", `カス（${names(kasu)}）`);
			ok(kkPts(kasu.slice(0, 9)) === 0, "カス 9枚は 役なし");
		},
	},
	{
		name: "花札は 同じ 月を 取り、なければ 場に 置き、2枚なら えらぶ",
		run: () => {
			const s = kkStart(seeded(3));
			s.turn = 0;
			s.phase = "hand";
			s.field = [kkId(0, 2), kkId(1, 2), kkId(1, 3), kkId(2, 2)];
			s.side[0].hand = [kkId(0, 0), kkId(1, 0), kkId(4, 0)];
			s.deck = [kkId(5, 2), kkId(2, 3), kkId(9, 2)];
			const r = kkPlay(s, 0);
			ok(r?.took.length === 2, "松を 取る");
			ok(
				s.side[0].take.includes(kkId(0, 0)) && phase(s) === "flip",
				"取って 山へ",
			);
			const r2 = kkFlip(s);
			ok(r2 && !r2.took.length && s.field.includes(kkId(5, 2)), "牡丹は 場に");
			ok(turn(s) === 1 && phase(s) === "hand", "名無しの 番");
			// 名無しが 梅を 出す → 場に 梅 2枚 → えらぶ
			s.side[1].hand = [kkId(1, 1)];
			kkPlay(s, 0);
			ok(phase(s) === "pickHand" && s.picks.length === 2, "2枚から えらぶ");
			ok(!kkPick(s, kkId(2, 2)), "ちがう 札は えらべない");
			kkPick(s, kkId(1, 3));
			ok(
				s.side[1].take.includes(kkId(1, 3)) && s.field.includes(kkId(1, 2)),
				"えらんだ ほうを 取る",
			);
			ok(phase(s) === "flip", "山へ");
		},
	},
	{
		name: "花札は 場に 3枚 あれば 4枚 まとめて 取る",
		run: () => {
			const s = kkStart(seeded(4));
			s.turn = 0;
			s.phase = "hand";
			s.field = [kkId(7, 1), kkId(7, 2), kkId(7, 3)];
			s.side[0].hand = [kkId(7, 0), kkId(11, 1)];
			const r = kkPlay(s, 0);
			ok(r?.took.length === 4 && s.field.length === 0, "4枚 取る");
		},
	},
	{
		name: "花札は 役が できると こいこいを 聞き、相手の こいこい後の あがりは 2倍",
		run: () => {
			const s = kkStart(seeded(5));
			s.turn = 1;
			s.phase = "hand";
			s.side[1].take = [kkId(6, 0), kkId(9, 0)];
			s.side[1].hand = [kkId(5, 0), kkId(11, 1)];
			s.field = [kkId(5, 2)];
			s.deck = [kkId(3, 2), kkId(4, 2)];
			kkPlay(s, 0);
			kkFlip(s);
			ok(phase(s) === "koi" && turn(s) === 1, "猪鹿蝶で こいこいを 聞く");
			kkKoi(s, false);
			ok(
				s.side[1].koi === 1 && s.side[1].base === 5 && turn(s) === 0,
				"こいこい",
			);
			// キリコが 赤短で あがる → 2倍
			s.side[0].take = [kkId(0, 1), kkId(1, 1)];
			s.side[0].hand = [kkId(2, 1), kkId(10, 3)];
			s.field = [kkId(2, 3)];
			s.deck = [kkId(9, 3)];
			kkPlay(s, 0);
			kkFlip(s);
			ok(phase(s) === "koi" && turn(s) === 0, "赤短で 聞く");
			kkKoi(s, true);
			ok(
				phase(s) === "end" && s.roundWin === 0 && s.roundPts === 10,
				`2倍（${s.roundPts}）`,
			);
			ok(s.pts[0] === 10, "点が 入る");
		},
	},
	{
		name: "花札の 名無しは 光を 取り、相手が 近いと こいこいしない",
		run: () => {
			const s = kkStart(seeded(6));
			s.turn = 1;
			s.phase = "hand";
			s.field = [kkId(0, 0), kkId(3, 2)];
			s.side[1].hand = [kkId(3, 3), kkId(0, 2), kkId(11, 2)];
			ok(kkCpuPlay(s, seeded(1)) === 1, "松に 鶴を 取りに いく");
			s.field = [kkId(1, 2), kkId(1, 0)];
			s.side[1].hand = [kkId(1, 3)];
			kkPlay(s, 0);
			ok(kkCpuPick(s) === kkId(1, 0), "鶯の ほうを 取る");
			// こいこいの 見きわめ
			const t = kkStart(seeded(7));
			t.turn = 1;
			t.side[1].take = [
				kkId(1, 0),
				kkId(3, 0),
				kkId(4, 0),
				kkId(5, 0),
				kkId(6, 0),
			];
			t.side[1].hand = [1, 2, 3, 4, 5].map((m) => kkId(m, 3));
			t.side[0].take = [];
			ok(kkCpuKoi(t), "役が 小さく 相手が 遠い なら こいこい");
			t.side[0].take = [kkId(0, 1), kkId(1, 1)];
			ok(!kkCpuKoi(t), "赤短 あと 1枚 なら あがる");
		},
	},
	{
		name: "花札は 名無しどうしで 3か月 打ちきれ、札が なくならない",
		run: () => {
			for (let seed = 1; seed <= 20; seed++) {
				const r = seeded(seed);
				const s = kkStart(r);
				for (let k = 0; k < 400 && !kkOver(s); k++) {
					ok(total(s) === 48, `札の 数が ${total(s)}枚`);
					if (phase(s) === "end") kkNext(s, r);
					else if (phase(s) === "hand") kkPlay(s, kkCpuPlay(s, r));
					else if (phase(s) === "flip") kkFlip(s);
					else if (phase(s) === "koi") kkKoi(s, !kkCpuKoi(s));
					else kkPick(s, kkCpuPick(s));
				}
				ok(kkOver(s), "3か月で おわらない");
				ok(s.month === KK.months - 1, "月の 数");
				const sc = kkScore(s);
				ok(
					sc === s.pts[0] * KK.unit + (s.pts[0] > s.pts[1] ? KK.winBonus : 0),
					"スコア",
				);
			}
		},
	},
];
