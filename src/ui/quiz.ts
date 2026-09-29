// もどせない 操作の 前の 計算問題（押しまちがいで 決めないように）。冒険を すてる（ui/villageEvents.ts）・
// セーブデータを 消す（ui/settings.ts）で 使う。その場で 作る 2けたの たし算・ひき算を、答えの まわりの 数を まぜた
// 4つから 選ぶ。見た目の 乱数なので Math.random（冒険の 乱数は 使わない）。

export type Quiz = {
	/** 問題の 式（「27　＋　15」）。 */
	text: string;
	answer: number;
	/** 選択肢（答えを ふくむ 4つ。並びは ばらばら）。 */
	options: number[];
};

export const makeQuiz = (): Quiz => {
	const r = (lo: number, hi: number) =>
		lo + Math.floor(Math.random() * (hi - lo + 1));
	const add = Math.random() < 0.5;
	const a = r(11, 49);
	const b = r(3, add ? 49 : a - 1);
	const answer = add ? a + b : a - b;
	const opts = new Set([answer]);
	while (opts.size < 4) opts.add(Math.max(0, answer + r(-10, 10)));
	return {
		text: `${a}　${add ? "＋" : "－"}　${b}`,
		answer,
		options: [...opts].sort(() => Math.random() - 0.5),
	};
};
