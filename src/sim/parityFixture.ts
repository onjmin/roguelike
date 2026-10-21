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
			"m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,a2,a2,a2,a2,w,w,w,w,w,w,w,w,w,w,w,m2,m2,m2,m2,m2,m2,m3,m6,m7,m0,m0,m2,m0,m0,m6,m6,m6,m6,m6,m6,m0,a6,m6,m6,m6,m6,m6,m0,m4,#gxcwh7,m2,m2,u6.3,a6,m2,m2,m2,m4,m2,m2,m2,m2,m2,m2,m4,a4,a4,a4,m4,m6,m4,m4,m3,a5,m5,m0,a2,m0,a0,u3,m0,m0,a4,a4,a4,a4,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m4,m4,m2,m2,m2,#1y61wcj,m2,m3,m3,m3,m4,m4,m4,m4,m4,m4,m6,m6,m6,m4,m4,m4,m0,m0,m0,m2,m2,m2,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m5,m5,m5,a6,m6,a6,m7,#sb876f,m6,m6,m4,m6,m6,m6,m6,m6,e4,m2,m2,m2,m2,m2,m0,m2,m2,m1,m1,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m7,m7,m0,m0,m6,m6,m6,m6,m6,m0,m0,a0,#1hy6tss,m0,m7,m7,m3,m3,m4,m4,m4,u7,m2,m2,m2,m2,m2,m4,m4,m2,m2,m2,m2,m2,m2,a2,a2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m0,m0,m6,m6,m6,m6,m6,m6,m0,m6,m6,m6,m6,m6,m7,S,m1,m2,m3,#9l61gs,m5,m5,m6,m6,m6,m6,m6,m6,m7,m7,m0,m7,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,a0,m0,m0,m0,m0,m0,m0,m0,m0,m0,a0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m1,m1,m1,m1,m3,m5,a4,m5,m5,m6,m7,m7,m7,m6,m6,a6,m6,m6,m6,#1l8he1o,m4,m4,m4,m6,m6,m6,m6,m6,m6,m2,m2,m2,m2,m2,m2,m0,m0,m0,m2,m2,m2,m2,m2,m3,a4,a4,w,w,w,m3,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m6,m6,m6,m6,m2,#1jum6il,m2,m2,m2,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,m4,m4,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,a2,a2,m5,m7,m0,m0,m2,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m6,m0,m0,m0,m1,a2,m1,m1,m1,m1,m2,#1iu1eh7,m4,S,m2,m2,m2,m2,m3,m4,m2,m2,m2,m4,m4,m2,m2,m2,m2,m2,m2,m2,m1,m2,m2,m2,a3,m2,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,T33.6,T33.6,a6,T33.6,a6,m6,m6,m6,T33.6,a6,#16uz4a9,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m7,m2,m2,m0,m0,m2,m0,m0,m0,m0,m0,m0,m0,m1,m2,u31,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m1,m1,m1,m2,#192boib,m2,a3,m3,m3,m2,m2,m4,m2,m2,m3,m5,m1,m1,m1,m2,m2,m2,m2,m2,m2,m2,m3,m3,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m7,m6,m6,m0,m6,m6,m5,m5,m6,m6,m6,m6,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m5,m5,m6,#9dj9u6,m6,m6,m4,m4,m4,m4,m4,m4,m4,m6,m4,m4,m2,m2,m2,m2,m2,m2,m3,m3,m1,m1,m2,m2,m2,a2,m5,m5,m6,m6,m6,m4,m4,m4,m4,m4,m6,m6,m6,m6,m4,m0,m2,m2,m2,m2,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m7,m7,m0,m0,m2,m0,m0,#xitxce,m0,m0,m0,m0,m0,m1,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m1,m1,m2,m3,S,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m2,m2,m2,m2,a2,a2,m2,a2,a2,a2,m2,m2,m2,m2,m2,m2,m2,m2,#2bcxek,m2,m2,m2,m0",
		digest: "kcmd3g",
		state: "1767gi7",
		turn: 833,
		depth: 4,
	},
	{
		seed: "golden-2",
		replay:
			"m1,m2,m2,m3,m3,e7,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m6,m6,m6,m5,a6,m5,a0,m5,m5,m5,m5,a7,a7,w,w,w,w,w,w,m1,m1,m1,m3,m3,e6,m0,m0,m7,m7,m7,m0,m0,m2,m2,m2,m2,m0,m0,m4,m4,a0,m0,#37kkww,m0,a6,a6,m2,m2,m2,m2,m2,m1,m1,m2,m3,a0,m1,m1,m2,m2,m0,u5,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m0,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,m7,m7,m5,m5,m6,m6,m6,m6,m6,m6,m6,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,#mg0cn6,m4,m4,m4,m4,m4,m4,m4,m4,m4,m5,m5,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,a6,m6,m6,m6,a6,m6,m6,a6,m6,m6,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m0,m0,m0,m7,m3,m3,m3,m4,m5,m5,m4,m4,m4,m4,m2,m2,#5m8tct,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m6,m6,a6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m0,m0,m0,m0,m0,m0,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m2,m2,m2,m2,m2,m1,m2,m3,m3,m2,m2,m2,m2,m2,m1,m2,#1c3kawa,S,m7,m7,m3,m3,m5,m5,m5,m4,m4,m2,m2,m4,m4,a3,m3,m3,a0,m5,m1,m3,m3,m3,m3,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m2,m3,m3,m3,m3,m2,m2,m2,m2,m2,m0,m0,m0,a0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m6,a0,m2,m2,#11ysjdg,m2,m5,m6,m7,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,m0,m0,m6,m7,m7,m7,m7,m2,m2,m2,m2,m2,m2,m0,m0,m0,m6,m6,m6,m6,m6,m0,m0,m6,m7,e20,m7,m7,m6,m6,m6,m4,m0,m2,m2,m2,m2,m3,m3,m3,m4,m4,m2,m2,m2,m2,m2,m4,m4,m4,#10qc7kt,m4,m4,m4,m5,m4,m4,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,a6,m2,m2,m2,m2,m2,m3,m3,m3,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m1,m2,m2,m2,m2,m2,m3,m1,m2,m0,m0,m0,m6,m0,m0,m0,m0,m0,m0,m0,m0,m0,m6,m0,m4,m2,m4,m4,#nv3noz,m3,m3,m4,m5,m5,m4,m4,m2,m4,m4,m4,m5,m5,m5,m5,m5,m7,m7,m7,m7,m6,m6,m6,m6,m6,m6,m4,m4,m6,m6,m6,m5,m5,m5,m6,m7,m7,m7,m7,m7,m7,m6,m6,m6,m6,m6,m6,m4,m4,a4,m4,m4,m6,m6,m6,m6,m6,m5,m5,m6,S,m6,m7,m7,#gwtre6,m7,m7,u35,m2,m2,m2,m2,m2,m0,m0,m0,m6,m0,m0,m0,m0,m0,m1,m1,m2,m2,m2,a2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m0,m0,m0,a2,m7,m7,m5,S,m6,m6,m6,m6,m6,m6,m7,m7,m7,m4,m6,m6,m4,m4,m4,m4,m4,m6,#1bn1nea,m6,m0,m7,m5,m5,m6,m6,m6,m6,m7,m7,m0,m0,m0,m0,m0,m0,m0,m2,m2,m0,m0,m0,m1,m1,m2,m2,m2,m2,m4,m2,m2,m2,m2,a2,m2,m1,a3,m2,m2,a2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m6,m6,m6,m6,m6,m0,m0,m0,m0,m7,m7,m6,m6,#1rimh4d,m4,m4,m4,m6,m6,m6,m6,m6,m6,m7,m5,m6,m6,m6,a7,m0,m0,m0,m7,m7,m2,m2,m2,m3,m3,m3,m3,m3,m2,m2,m2,m2,m2,m0,m0,m0,m2,m2,m3,m3,m3,m5,m4,m4,m2,m2,m2,m2,m2,m4,m4,m4,m4,m5,a6,m3,m4,m2,m2,m2,m0,m0,a0,m0,#263h2f,m2,m2,m2,m2,m2,m2,m1,m0,m0,m0,m2,m2,m2,m2,m2,m0,m0,m0,m4,m4,m4,u45,m6,m6,m6,m6,m6,m4,m4,m4,m2,m2,m3,m3,m3,m3,m3,m4,m4,m6,m6,m6,m6,m6,m6,m6,m4,m4,m5,m6,m6,m6,m6,m6,m2,m2,m2,m2,m2,m3,m3,m4,S,m6,#8ia689,m0,m0,m0,m0,m6,m6,m6",
		digest: "1y4bxsm",
		state: "8wa1dx",
		turn: 770,
		depth: 5,
	},
	{
		seed: "golden-3",
		replay:
			"m0,m0,m0,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,m4,m4,m4,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m4,m4,m4,m4,m4,m2,m2,m2,m2,m2,m4,m4,m6,m6,m6,m6,m6,m4,m4,m4,m6,m6,m6,m6,m6,m6,#1fuszvv,m6,m6,m6,m2,m6,m2,m6,m2,w,a6,w,a6,m6,m2,a6,w,w,w,a6,w,w,a6,a6,w,w,w,w,w,a6,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m6,u5,m2,m6,m6,m0,m0,m0,m7,m5,m6,m7,#1pbwj7j,m7,m0,m0,m2,m2,m0,m0,m0,m1,m1,u4,m5,m7,m0,m0,m2,m0,m0,m0,m4,m4,m4,m6,m4,m4,m3,m4,m5,m4,m4,m6,a6,a6,m6,m4,m4,m3,m3,m3,a2,m5,m7,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,a5,m0,a2,m0,m0,m0,m0,#1s1fmrf,m6,m6,m6,m0,m0,m1,a2,m1,a0,m5,m5,m5,m5,m6,m7,m7,m3,m3,m4,m4,m4,m2,m2,m2,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,#1kmvjvc,w,w,w,w,w,w,w,w,w,w,w,m1,m1,m1,m1,m1,m1,m2,m2,m2,m2,m0,m0,m0,m0,m0,m2,m2,m2,m0,m0,m0,m2,m2,m2,a2,a2,a2,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m2,m2,m2,m4,m2,m2,m0,#1n6l8o5,m0,m0,m0,m6,m6,m0,m0,m0,a2,m6,m6,m7,m0,m1,m1,m1,m3,m3,m4,m5,m5,m4,m4,m4,m2,m2,m4,m4,a4,m4,m4,m3,m3,m4,m4,m4,m4,m4,m6,m6,m6,m6,m6,m4,m4,m4,m2,T8.2,T8.2,T8.2,m2,m3,m3,u23,m0,m1,m2,m2,m2,m2,m5,m5,m5,m6,#lpp8fd,m6,m6,m6,m7,S,m1,m1,m1,m1,m1,m3,m3,m3,m2,m2,m0,m0,m2,m2,m1,m1,m2,m2,m0,m0,m2,a2,a2,w,w,w,w,w,w,w,w,m2,m2,m2,m0,m0,m0,m0,m1,m1,m2,m2,m2,m2,m2,a3,a3,a3,T8.3,m2,m2,m2,m2,m2,m2,m2,m2,a3,m5,#1m2h7ps,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6",
		digest: "imxen7",
		state: "2j7fha",
		turn: 474,
		depth: 3,
	},
];
