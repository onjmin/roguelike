// 本編（過去ログの底）の動きが変わっていないことを確かめる基準。
// ボットに遊ばせたコマンドの列と、そのあとの状態の指紋。入れなおして同じになるかを replayTests で見る。
// ボットが変わっても この基準は変わらない（コマンドの列を そのまま入れなおすので）。
// ゲームの中身をわざと変えたときだけ、作りなおす（本編の遊びが変わった、ということなので コミットに 説明を添えて）。
// 動き（digest・turn・depth・64手ごとの指紋）が そのままで 記録の文（log）や 状態の形だけ 変わったなら state の指紋だけ、
// 動きが 変わって 前の コマンドの列では ずれるなら、同じ 手数を ボットで 遊びなおして 作りなおす。

export type ParityCase = {
	seed: string;
	replay: string;
	digest: string;
	/** serializeRun から v と dungeon を除いた文字の指紋。 */
	state: string;
	turn: number;
	depth: number;
};

export const MAIN_PARITY: ParityCase[] = [
	{
		seed: "golden-1",
		replay:
			"m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,a2,a2,a2,a2,w,w,w,w,w,w,w,w,w,w,w,m2,m2,m2,m2,m2,m2,m3,m6,m7,m0,m0,m2,m0,m0,m6,m6,m6,m6,m6,m6,m0,a6,m6,m6,m6,m6,m6,m0,m4,#gxcwh7,m2,m2,u6.3,a6,m2,m2,m2,m4,m2,m2,m2,m2,m2,m2,m4,a4,a4,a4,m4,m6,m4,m4,m3,a5,m5,m0,a2,m0,a0,u3,m0,m0,a4,a4,a4,a4,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m4,m4,m2,m2,m2,#1y61wcj,m2,m3,m3,m3,m4,m4,m4,m4,m4,m4,m6,m6,m6,m4,m4,m4,m0,m0,m0,m2,m2,m2,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m5,m5,m5,a6,m6,a6,m7,#sb876f,m6,m6,m4,m6,m6,m6,m6,m6,e4,m2,m2,m2,m2,m2,m0,m2,m2,m1,m1,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m7,m7,m0,m0,m6,m6,m6,m6,m6,m0,m0,a0,#1hy6tss,m0,m7,m7,m3,m3,m4,m4,m4,u7,m2,m2,m2,m2,m2,m4,m4,m2,m2,m2,m2,m2,m2,a2,a2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m0,m0,m6,m6,m6,m6,m6,m6,m0,m6,m6,m6,m6,m6,m7,S,m1,m1,m2,#85htb5,m2,m2,m2,m2,m5,m5,m7,a7,m7,a0,a0,w,w,w,w,w,w,w,w,w,w,w,w,w,m5,m5,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m1,m1,m1,m1,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,#1l43cna,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m7,m7,m6,m6,m6,m6,m6,m4,m4,m4,m6,m6,m6,m6,m6,m6,m2,m2,m2,m2,m2,m2,m0,m0,m0,m2,m2,m2,m2,m2,m3,m3,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,a2,m2,m4,m4,#57jfck,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m6,m6,m6,m6,m6,m6,m7,m7,m2,m3,m3,m2,m2,m2,m2,m2,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,m4,m4,m4,m4,m4,m4,m2,m2,a2,a2,m2,m2,m2,m2,m0,#18sxwvu,m0,m2,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,a0,a0,a0,m0,m6,m0,m0,m0,m0,m0,m3,m5,m4,m4,a0,m0,m0,a6,a0,m0,m1,m1,m1,m1,m2,m2,m2,a5,m2,m2,m5,m5,m7,S,m0,m0,m6,m6,m6,m6,m6,m0,a0,a0,m0,m1,m1,m5,a5,a5,w,m1,#1s8d3s4,m2,m3,m0,m1,m2,m2,m2,m2,m4,m4,m2,m2,m2,m1,m1,m2,m3,m3,m4,m4,m4,m4,m6,m6,a4,m4,m4,m4,m5,m6,m6,m0,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m4,m4,m2,m5,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m1,#2pylql,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m3,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,u32,m6,m7,m7,m7,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,#1d6o7if,m6,m0,m0,m6,m7,m7,m7,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m4,m4,m5,m5,m5,m5,m4,m4,m4,m0,m0,m0,m1,S,m2,m5,m6,m7,m7,m7,m0,m0,m2,m2,m2,m2,m2,m2,m0,m0,m0,m2,m2,m2,m0,m0,m0,m0,m0,m2,m2,m2,m2,m2,m3,a4,m1,#19iv486,m2,m2,m2,m2,m3,m3,m3,m2,m2,m2,m0,m0,m0,m2,m2,m2,m4,m4,m4,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,t3,T47.3,m4,a2,m0,m4,m3,m3,m5,m5,m5,m5,m6,m6,m6,m7,m0,m0,m0,m0,m7,m3,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,#kvre8g,m6,m6,m6,m6",
		digest: "19qi6bp",
		state: "ibakce",
		turn: 832,
		depth: 4,
	},
	{
		seed: "golden-2",
		replay:
			"m1,m2,m2,m3,m3,e7,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m6,m6,m6,m5,a6,m5,a0,m5,m5,m5,m5,a7,a7,w,w,w,w,w,w,m1,m1,m1,m3,m3,e6,m0,m0,m7,m7,m7,m0,m0,m2,m2,m2,m2,m0,m0,m4,m4,a0,m0,#37kkww,m0,a6,a6,m2,m2,m2,m2,m2,m1,m1,m2,m3,a0,m1,m1,m2,m2,m0,u5,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m0,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,m7,m7,m5,m5,m6,m6,m6,m6,m6,m6,m6,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,#mg0cn6,m4,m4,m4,m4,m4,m4,m4,m4,m4,m5,m5,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,a6,m6,m6,m6,a6,m6,m6,a6,m6,m6,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m0,m0,m0,m7,m3,m3,m3,m4,m5,m5,m4,m4,m4,m4,m2,m2,#5m8tct,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m6,m6,a6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m0,m0,m0,m0,m0,m0,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m2,m2,m2,m2,m2,m1,m2,m3,m3,m2,m2,m2,m2,m2,m1,m2,#1c3kawa,S,m5,m5,m5,m4,m4,m2,m2,m4,m4,m3,m3,m3,m3,m3,m3,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m2,m2,a2,m3,m3,m3,m4,m2,m2,m2,m2,m2,m0,m0,m0,a0,m0,m2,m2,m2,m2,m2,m2,m3,m3,m5,m0,m0,m1,m0,m0,m0,m0,m2,m2,m2,#nyq11z,m2,m2,m2,m0,m0,m7,m7,m7,m7,m2,m2,m2,m2,m2,m0,m0,m0,m6,m6,m6,m6,m6,m0,m0,m7,m7,m6,m7,m6,m6,m6,m4,m0,m2,m2,m2,m2,m3,m3,m3,m4,m4,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,m4,m5,m4,m4,m6,m6,m6,m6,m6,m6,m4,m4,#poyq9,m4,m4,a2,m2,m2,m2,m2,m2,m3,m3,m3,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m1,m2,m2,m2,m2,m2,m2,m2,m3,a3,m5,m5,a6,m0,m1,m1,m0,m0,m0,m6,m0,m0,a7,m0,m0,m0,m0,m0,m0,m0,m6,m0,m0,m6,m7,m7,a7,m2,m1,e20,m5,m6,#1384kaf,m7,m2,m3,m3,m3,m4,m4,m2,a4,m4,m4,m3,a2,m3,m4,m5,m5,m4,m4,m2,m4,m4,m4,m5,m5,m5,m5,m5,m7,m7,m7,m7,m6,m6,m6,m6,m6,m6,m4,m4,m6,m6,m6,m5,m5,m5,m6,m7,m7,m7,m7,m7,m7,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m6,#yiba74,m6,m6,m6,m6,m5,m5,m6,S,m5,m6,m6,m6,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m5,m5,m6,m7,m7,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,a0,m0,m0,m0,m6,m6,m6,m6,m6,u38,m0,m0,m0,#1ni5ep4,m0,m6,m0,m0,m0,m1,m1,m1,m3,m4,m4,m2,m2,m2,m0,m0,m0,m0,m2,m2,a2,m2,m2,m2,m2,m2,m3,m3,m3,m3,m4,m4,a4,m4,m6,m6,m6,m4,m4,m3,u41,m3,m5,m5,m7,m6,m6,m0,m4,m2,m2,m3,m3,m4,m4,m4,m4,m2,m2,m6,m6,m0,m0,m0,#z8p3e3,m1,m1,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m2,m2,m1,m1,m3,m3,m3,m4,m4,m6,m6,m6,m6,m6,m4,m4,m0,m0,m2,m2,m2,m2,m2,m0,m0,m6,m6,m6,m6,m7,m6,m6,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m7,m7,m0,m0,m2,#43pxqn,m2,m2,m0,m0,m0,m7,m7,a7,m1,m1,m2,m2,m2,m2,m4,m2,m2,m2,m2,m2,m2,a2,a2,a2,a2,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m2,m2,m3,m3,m6,m7,m7,m6,m6,m6,m6,m6,m6,m6,m0,m6,m6,m4,m4,m5,#14wj7ub,m5,m4,m4,m4,m6,m6,m6",
		digest: "1awtrly",
		state: "1gev1yz",
		turn: 777,
		depth: 3,
	},
	{
		seed: "golden-3",
		replay:
			"m0,m0,m0,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,m4,m4,m4,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m4,m4,m4,m4,m4,m2,m2,m2,m2,m2,m4,m4,m6,m6,m6,m6,m6,m4,m4,m4,m6,m6,m6,m6,m6,m6,#1fuszvv,m6,m6,m6,m2,m6,m2,m6,m2,w,a6,w,a6,m6,m2,a6,w,w,w,a6,w,w,a6,a6,w,w,w,w,w,a6,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m6,u5,m2,m6,m6,m0,m0,m0,m7,m5,m6,m7,#1pbwj7j,m7,m0,m0,m2,m2,m0,m0,m0,m1,m1,u4,m5,m7,m0,m0,m2,m0,m0,m0,m4,m4,m4,m6,m4,m4,m3,m4,m5,m4,m4,m6,a6,a6,m6,m4,m4,m3,m3,m3,a2,m5,m7,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,a5,m0,a2,m0,m0,m0,m0,#1s1fmrf,m6,m6,m6,m0,m0,m1,a2,m1,a0,m5,m5,m5,m5,m6,m7,m7,m3,m3,m4,m4,m4,m2,m2,m2,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,#1yrq5cq,w,w,w,w,w,w,w,w,w,w,w,m1,m1,m1,m1,m1,m1,m2,m2,m2,m2,m0,m0,m0,m0,m0,m2,m2,a2,m2,m0,m0,m0,m2,m2,m2,m2,m2,m2,m4,m2,m2,m2,m2,e24,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m2,m2,m1,t2,T8.2,T8.2,T8.2,T8.2,m5,#8hezur,m6,m6,m2,T8.2,m6,a2,m2,m2,a4,m2,m3,m3,m0,m1,m1,m6,m5,m5,m6,m7,m6,m6,m4,m6,m6,m6,m6,m6,m6,m6,m4,m5,m5,m4,m4,m4,m4,m6,m6,m6,m6,m6,m4,m4,m4,m2,m2,m2,a3,m3,m5,m5,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,#1pxrt5w,m6,m6,m6,m6,m0,m0,m0,m0,m0,m2,m2,m2,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m1,m1,w,w,w,w,w,w,w,w,w,w,m3,m7,m1,m1,m1,m2,m2,m2,m2,m2,m2,m2,m3,m3,m1,t2,T8.2,m1,#d5jwie,a2,u39,m2,m2,m2,m4,m5,m5,m5,m1,m1,m1,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m3,u23,m5,m5,m5",
		digest: "dpsk29",
		state: "4au1mh",
		turn: 473,
		depth: 2,
	},
];
