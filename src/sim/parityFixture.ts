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
			"m5,m7,m7,m6,m6,m6,m6,m0,m0,m6,m0,m0,m0,a6,m6,m6,m6,m6,m6,m6,m6,a6,a6,w,w,w,w,w,m6,m0,m0,m1,a1,m0,m1,m3,a5,w,w,w,w,m5,m5,m6,m6,m1,m1,m2,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,m1,m2,#u52s9q,m2,a2,a2,w,w,w,w,w,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m2,m6,m0,m0,m6,m6,m5,m5,m6,m1,a2,a2,m5,m6,m6,m6,m6,m6,m6,m6,m6,m7,a6,m6,a6,m6,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m5,m5,m6,a7,a7,#c5ea8s,m6,a6,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m1,m3,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m3,m4,m2,m2,m2,m2,m1,m2,m2,m2,m2,m2,m2,m2,m2,m3,m3,m2,m2,#15elo23,m2,m2,m4,m2,m2,m2,m1,m3,m3,m4,m4,m2,m2,m2,m2,m2,m2,m4,m4,m4,m3,e7,m4,u2,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m6,m6,m6,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,#142nmzb,m6,m5,m5,m5,m7,S,m1,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m0,a0,m0,m6,m6,m7,m6,m6,m0,m6,m6,m4,m4,m4,u18.4,m6,m6,m4,m4,m2,m4,m4,m4,m4,m5,a5,a5,a5,m5,m6,m6,m4,m4,m6,m4,m4,m4,m4,m4,#1uhd356,m3,a4,m4,m5,m5,m1,m3,m3,m3,m2,m2,m2,m2,m2,m2,a0,m0,m0,m0,m0,a0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m3,m4,m2,m3,u20,m0,m0,m7,m0,a0,a0,m0,m6,m0,m0,m0,m0,m1,m2,m2,m2,m0,m2,m2,m2,m0,m1,e21,m2,m2,m2,m2,#qyb3a6,m2,m2,m2,m3,m3,m3,m3,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m0,m0,m0,m2,m2,a2,m2,m2,m2,m2,m2,m2,m2,m2,a2,m2,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m7,m6,m6,m6,m4,m6,m6,m6,#1dk5tjg,m5,m7,m7,m0,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m0,m0,t2,T23.2,m1,m1,m2,m2,m2,m2,m2,m3,m3,m2,m2,m0,m2,m2,m2,m6,m6,m6,m4,a6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m6,m6,m0,m6,m6,m4,m5,m5,S,m5,m5,#ttfjgo,m5,m6,m6,m6,m0,m6,m6,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,a6,m6,a0,m0,m0,a1,m0,m0,m0,m0,m1,m1,m2,m2,m2,m2,m2,m3,m2,m2,m4,m4,m4,m2,m2,m2,m2,a3,m3,m1,m1,m1,m1,m2,m3,m3,m3,e39,m1,m1,u35.1,m4,m4,#1fwk5h4,m2,m2,m2,m2,m0,m0,m0,m2,m2,m2,m2,m2,m2,m3,a3,a3,m6,m7,m6,m6,m6,m6,m6,m4,m4,m4,m6,m6,m6,m6,m5,m5,m6,m6,m6,m6,m6,m6,m6,m7,m7,m6,m6,a6,m6,a6,a6,m6,u36,m0,m0,m0,m6,m6,m5,m5,m5,m5,m5,m6,m6,m6,m4,m4,#11a0d1q,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,m2,m2,m4,m2,m2,m1,m5,a6,m1,m1,m3,a3,a3,m1,m1,m2,m2,m2,m2,m3,m3,m3,m4,m4,m4,m4,m4,m4,m4,m4,m4,m4,m6,m6,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,#qlgi3o,m6,m6,m6,m5,m5,m7,m7,a7,m1,m2,m2,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m2,m2,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m2,m2,m2,m2,m0,m0,m2,m2,m2,m3,m3,m3,m3,m4,m4,m6,m6,m6,m6,m6,m4,m4,#1ms1gtd,m4,m4,m4,m4,m0,m0,m0,m0,m0,m0,m2,m2,m2,m2,m2,m0,m0,m6,m7,m7,m7,m7,m6,m6,m4,m4,m6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m4,m4,m4,m4,m6,m6,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m5,S,m3,#1k53zf6,m4,m5,u53,m1",
		digest: "195y3b0",
		state: "1lsbzuu",
		turn: 832,
		depth: 4,
	},
	{
		seed: "golden-2",
		replay:
			"m4,m4,m4,m4,m4,m2,m2,m2,m2,m2,m4,m4,m4,a4,a4,w,w,w,w,w,w,w,w,w,w,w,w,m4,m2,m2,m2,a2,a2,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m3,u5.1,m0,m5,#iozla,m5,m6,m6,m7,m2,m3,m4,m4,m2,a2,a2,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,a6,a6,a6,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m2,m2,m4,m4,m5,m5,m5,m5,#btvfqk,m6,m6,m6,m6,m6,m7,m1,m1,m1,m2,m2,u4,m2,m2,m3,m3,m3,m3,m2,m2,m2,m2,m2,m2,a0,a0,m1,m1,m1,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m2,m2,m2,m2,m0,m0,m0,m0,m0,m0,m0,#tvxxr9,m0,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,a4,m4,e3,m5,m5,m6,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m0,m0,m0,m7,m6,m6,m6,m6,m6,m6,m4,m4,m6,m2,m0,m0,m2,m2,m2,m2,m2,m2,#pebcf4,m1,a0,m2,m3,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m5,m6,m6,m4,m4,m2,m2,m2,m2,m2,m2,m4,m4,m3,m3,#osks06,m3,m4,m4,S,m5,m6,m6,m6,m7,m7,m6,m7,m6,m6,m4,a6,m6,m6,m5,m6,m6,m6,m7,m7,a7,m5,m7,m1,m1,m2,m0,m0,m6,m6,m6,m6,m6,m0,m0,m0,m0,m1,m1,m3,m1,a0,m1,m3,m3,m5,m6,m6,m6,m6,m6,m7,m7,m7,m6,m6,m4,m4,m4,m6,#1o5ddeg,m6,m6,m0,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m0,m0,m4,m4,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,m4,m4,m4,m4,m6,m6,m6,m6,m4,m4,m4,m5,m5,a7,m1,m1,m0,m0,m0,m2,m2,m2,m2,m0,m0,m2,m2,a2,m2,m0,m0,m0,m2,m2,#yuzr7c,m3,m3,m4,m4,m4,m4,m4,m2,m2,m2,m2,m2,m4,m4,m2,m2,m3,m3,m3,m2,m2,m0,m2,m2,a0,m0,m0,m0,m0,m0,m2,m2,m2,m0,m0,a0,m1,m1,m2,m2,m0,m0,m0,m0,m0,m2,m2,m0,m0,m0,m0,m0,m0,a1,m0,m6,m6,m6,m6,m6,m6,m6,m6,m0,#1reznhk,m6,m6,m6,m6,m6,m6,m5,m5,m5,a6,m6,m7,m7,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m2,m2,m2,m2,m2,m2,m2,m2,m3,m5,m4,m4,m4,m4,m4,m6,m6,m4,m4,m4,m4,m4,m5,m5,m6,m6,m4,m4,m6,m6,m6,m4,m4,m4,m4,m4,m6,m6,#ir6w8,m4,m6,m6,m5,m7,m7,m7,m7,m0,m0,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m7,m7,m6,m6,m4,m4,m4,m6,m6,m6,m0,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,m6,m7,m7,S,m3,m2,m2,m0,m2,m2,m2,m2,m2,m2,m2,#hd8ldg,m1,m1,m2,m2,m2,m2,m3,m3,u40,m0,m1,m0,m0,m0,m6,m6,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m1,t2,T21.2,m5,m6,m7,m7,m6,m6,m6,m6,m6,m6,m7,m5,e38,m5,m5,m5,m6,m2,m3,m4,m0,m6,m7,m7,u25,m0,m4,m1,m1,m4,m4,m4,m4,m2,m2,#1djtude,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,a2,m2,m2,m1,t2,T21.2,m1,m3,a3,m1,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m4,m4,m4,m6,m2,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m6,#8uzh9b,m0,m0,m6,m7,m7,m7,m7",
		digest: "16i5bib",
		state: "aemviy",
		turn: 771,
		depth: 3,
	},
	{
		seed: "golden-3",
		replay:
			"m1,m3,m6,m6,m6,m6,m6,m6,m6,m4,m4,a2,a2,m2,w,a4,w,w,w,m4,m4,m0,m0,m6,m0,m0,m0,m7,m7,m6,m6,m6,m6,m6,m6,m4,m4,m6,m6,m6,m5,m6,m6,m6,m4,m4,m4,m4,m2,m2,m2,m2,m2,m4,a4,a4,m4,m4,m4,a4,a4,m4,m4,m4,#mb4v1f,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m2,m3,a3,a3,m3,m4,m1,m1,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m2,m2,m3,m1,m2,#1h7nt7k,m2,m0,m0,m2,m2,m2,m2,m2,m2,m0,a0,w,a0,w,w,w,m0,u5,m0,m0,m0,m6,m6,m6,m6,m6,m6,u4.1,m0,m7,m0,m0,m0,m6,m6,m6,m0,m0,m0,m4,m4,m4,m2,m2,m2,m4,m4,m4,m2,m2,m2,m2,m2,m3,m3,m4,m4,m4,m4,m4,m6,m6,m6,m6,#ppf3xq,m6,m6,m4,m4,m5,m5,m7,m7,m6,m6,m4,a4,m4,m4,a4,a4,a4,w,w,w,w,w,w,w,w,w,w,w,w,w,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m5,m5,S,m1,m3,m4,m4,m4,#1v7ozlw,m4,m6,m6,m6,m6,m6,m4,m4,m3,m3,m3,a5,m7,m7,m7,m0,m0,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m7,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m2,m2,m2,m2,m4,m4,m4,m4,m4,m4,#12zi9ol,a4,a4,m5,m6,m4,m5,m4,m4,m4,m6,m6,m6,m4,m4,m4,v,m4,m5,a6,a6,t2,T21.2,T21.2,T21.2,a2,a2,m5,m6,m1,m1,m2,m2,m3,m2,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m2,m2,m6,m6,m4,m4,m4,m6,m6,m6,#s7p0b9,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m2,m2,m2,a2,m2,m2,m2,m2,m1,m1,m2,m2,m0,m0,m0,m0,m2,m2,m2,m0,m0,m0,m7,m7,m6,m6,m6,m6,m6,m6,m0,m0,m6,m6,m6,m6,#3x8ora,m4,m5,m5,m5,m0,m1,m1,m1,m2,m2,u18.8,m2,m2,a4,a6,m4,m4,m2,m2,m2,m2,m2,m2,m1,m1,m1,a2",
		digest: "1xeybgt",
		state: "13yi3si",
		turn: 473,
		depth: 2,
	},
];
