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
			"m5,m7,m7,m6,m6,m6,m6,m0,m0,m6,m0,m0,m0,a6,m6,m6,m6,m6,m6,m6,m6,a6,a6,w,w,w,w,w,m6,m0,m0,m1,a1,m0,t2,T4.2,m5,m5,m1,m1,m2,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,T4.2,m2,a4,m1,m2,m2,m2,m2,m2,#1euvipw,m2,m2,m2,m2,m2,m2,m2,m4,a4,a4,m4,m2,m6,m0,m0,m6,m6,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m6,m6,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m5,m6,m6,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m3,m4,m2,m2,m2,m2,#1gej1wi,a3,a3,m3,a4,w,w,w,m1,m1,m2,m2,m2,m2,m2,m2,m3,m3,m2,m2,m2,m2,m4,m2,m2,m2,m1,m3,m3,m4,m4,m2,m2,m2,m2,m2,m2,m4,m4,m4,m3,e7,m4,u2,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m6,m6,m6,m4,a4,a4,a4,a4,w,m4,#16gpb2s,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m5,m5,m5,m7,S,m5,m5,m5,m6,m6,m7,m7,m7,m4,m5,m5,u24,m0,m0,m7,m6,m6,m6,m6,m6,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,#19odhuq,m6,m6,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,a2,m2,a3,a3,w,w,w,m3,m2,m2,m2,m4,m2,m2,m2,m2,m2,m2,m2,m1,m3,m4,m4,a4,a4,m4,m4,m4,m4,m4,m4,m4,m3,m5,m0,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,#1b38bwv,T4.2,T4.2,m2,m0,m0,m1,m0,m0,m0,m0,a6,a6,m6,m0,m0,m1,m2,m3,m0,m0,m0,m0,m1,m5,m7,m0,m0,m2,m2,m2,m2,m2,m0,T4.0,T4.0,m0,m6,T4.6,T4.6,m2,m4,m4,m6,m6,m6,m6,m6,m4,m4,m3,m4,m5,m5,m5,m4,m4,m2,m4,m4,m4,m4,a3,m3,a1,#1vde2e8,a1,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m2,m2,m2,m2,m2,m2,m1,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m1,m0,m0,m0,m0,m6,m0,m0,m0,m0,m1,m1,S,#1rp0es3,m5,m5,m6,m6,m6,m6,u43.5,m6,m6,u46,m0,m0,m0,m0,m0,m0,m0,m0,a2,a2,w,w,m2,m0,a0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m4,m4,m6,m6,m7,m5,m7,m7,m6,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,a6,m6,m4,m4,m4,m6,m6,#1b9ri9y,m6,m6,m4,m4,m4,m4,m3,m4,a5,a5,m5,m5,m7,m2,m3,u6,a4,a4,m4,m0,m5,m5,m7,m7,u41,m2,m3,m3,m3,S,m0,m0,m3,m3,m3,m4,m5,m4,m4,m4,m4,m3,m3,m4,m2,a2,a2,w,w,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,a3,m3,d20,m1,#1t2z7hk,m1,m1,m3,m3,d21,m5,m7,T4.7,m1,m3,d21,m3,m3,e60,m6,m6,m7,m7,m7,m7,m7,m0,m0,m6,m0,m0,m0,m1,m1,a3,a3,m1,m1,m0,m0,m0,m0,m4,m4,m4,m4,m5,m5,m6,m7,m7,m6,m6,m4,m4,m4,m0,m0,m0,m2,m2,m3,m3,m4,m5,m4,m4,m4,m2,#xeedxk,m4,m4,m4,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,a6,m6,m0,m7,a7,m5,m5,m5,m6,m6,m6,m6,m6,m0,m0,m6,m6,m6,m6,m6,T4.6,m5,m5,m7,m7,e57,m1,m0,m0,m2,m2,m2,m2,m0,m0,m0,m0,m0,m0,m7,m7,m0,m0,m6,m6,m6,m6,m6,m6,#ysxsr7,m6,m6,m0,m0,m0,m1,m1,m1,m1,m1,m1,m3,m2,m2,m2,m0,m2,m2,m2,m2,m2,m2,m6,m6,m6,m6,m6,m6,m4,m6,m6,m6,m5,m5,m5,m5,m5,m6,m6,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,a2,m2,m4,m4,m5,m5,m5,S,m0,m7,m0,m0,m0,m6,m6,#rgivhv,m0,m0,m1,m3,u77,m6,m6,m6,m6,m6,m0,m0,a0,m0,m0,m0,m6,m6,m6,m5,m5,m5,a6,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m1,m1,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,m2,T4.2,m2,m4,m4,m4,m2,m2,m4,m4,m4,m4,m2,m3,m2,m2,m2,#b3nddr,m2,m2,m2,m2",
		digest: "14sfq7e",
		state: "6b3khe",
		turn: 830,
		depth: 5,
	},
	{
		seed: "golden-2",
		replay:
			"m4,m4,m4,m4,m4,m2,m2,m2,m2,m2,m4,m4,m4,a4,a4,w,w,w,w,w,w,w,w,w,w,w,w,m4,m2,m2,m2,a2,a2,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m3,u5,m0,m5,#17993it,m5,m6,m6,m7,m2,m3,m4,m4,m2,m2,m2,m4,m4,m5,m6,a6,a6,m4,m4,m4,m5,u4,m5,m6,m6,m6,m6,m6,m7,m1,m1,m1,m2,m2,m2,m3,m3,m2,m3,m3,m2,m2,m2,m2,m2,m2,a0,a0,m1,m1,m1,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,a2,m2,#cn361o,m2,m2,m2,m2,m2,m2,m2,a2,a2,m2,m4,m4,m4,m4,m2,m2,m2,m2,m0,m0,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m4,a5,m6,a7,m4,e3,m5,m6,m0,m0,m0,m0,m0,m0,#p4w9j0,m0,m1,m1,m1,m1,m0,m0,m6,m6,m6,m0,m0,m6,m6,m6,m6,a6,m1,m1,m2,m0,m0,m0,m0,m6,m6,m6,m6,m6,m0,m0,m0,m0,m1,m1,m1,m1,m1,m1,m3,m3,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m3,m4,m4,m4,m2,m2,m2,m2,m6,m6,#188jmpj,m6,m6,m0,m0,m1,m1,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m5,m6,w,w,w,w,w,w,w,w,w,w,w,#c6ef5h,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m5,m5,m5,m6,m4,m4,m4,m4,m2,m2,m2,m2,m4,m4,m3,m4,m4,m4,m5,u20,m5,m6,m4,m4,m4,m4,m3,m3,m3,m4,a5,m6,m7,m7,m7,m7,m2,m2,m2,m2,m2,m3,m2,m2,m2,m4,m4,m4,#24mn7e,m4,m4,m2,m2,m2,m2,m2,m2,m1,m5,m6,m6,m2,m6,a2,m2,m6,a2,w,a2,w,w,m2,m2,m1,m1,m1,m2,u1,m3,e33,m7,m2,m2,m2,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m2,m2,#1ykjjm6,m2,m2,m1,a2,m2,m3,m3,m4,m4,m4,m4,m4,m2,a3,m5,m5,m6,m2,m3,m3,m3,m3,e25,m1,m1,m1,m5,m6,m7,m7,m7,m7,m0,m0,m0,m0,m0,m0,m1,m0,m0,m0,m6,m0,m0,m0,m0,m6,m7,m7,m7,m6,m6,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,#r8ek9x,m6,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m2,m2,m2,m3,m3,m3,m4,m4,m4,m4,m2,m4,m4,m4,m5,m5,m6,m6,m7,m6,m6,m6,m6,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m5,m6,m7,S,m2,m2,m2,m2,m2,m2,m2,m2,a4,m4,m2,m2,m2,a0,#1aed3zc,m1,m2,m2,m2,m3,u38,m5,m6,m6,m7,m7,m0,m0,m0,m0,m0,m0,m2,m0,m0,m7,m7,m0,m0,m1,m0,m0,m6,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m6,m6,m5,m5,m5,m6,m7,m7,m1,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,#1a81ge3,m4,m4,m2,m2,m2,m2,m2,m1,m2,m3,m4,m4,m2,m4,m4,m3,m3,m3,m5,m5,m4,m4,m6,m4,m4,m4,m4,m4,m4,m4,m6,m6,m6,m0,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,a6,m6,m6,m6,m6,m6,m0,m0,m0,a0,m4,m6,m6,m6,m6,m6,m6,#1kzq3wv,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m2,m6,m2,a6,m6,m2,m6,m2,m6,m2,m6,m2,m6,m2,m6,m2,m6,m2,m6,m2,m6,m2,m6,m2,m6,m2,w,a6,a6,m6,m6,m5,m6,m7,m2,m2,m0,m0,m2,m2,m2,m2,m0,m0,m0,m6,m6,m6,a6,m1,m2,#1a875z8,m3,m4,m4,m4,m6,m6,m6",
		digest: "tncrp3",
		state: "1p3g233",
		turn: 774,
		depth: 3,
	},
	{
		seed: "golden-3",
		replay:
			"m1,m3,m6,m6,m6,m6,m6,m6,m6,m4,m4,a2,a2,m2,w,a4,w,w,w,m4,m4,m0,m0,m6,m0,m0,m0,m7,m7,m6,m6,m6,m6,m6,m6,m4,m4,m6,m6,m6,m5,m6,m6,m6,m4,m4,m4,m4,m2,m2,m2,m2,m2,m4,a4,a4,m4,m4,m4,a4,a4,m4,m4,m4,#mb4v1f,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m2,m3,a3,a3,m3,m4,m1,m1,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m2,m2,m3,m1,m2,#1h7nt7k,m2,m0,m0,m2,m2,m2,m2,m2,m2,m0,a0,w,a0,w,w,w,m0,u5,m0,m0,m0,m6,m6,m6,m6,m6,m6,u4,m0,m7,m0,m0,m0,m6,m6,m6,m0,m0,m0,m4,m4,m4,m2,m2,m2,m4,m4,m4,m2,m2,m2,m2,m2,m3,m3,m4,m4,m4,m4,m4,m6,m6,m6,m6,#1rhgvws,m6,m6,m4,m4,m5,m5,m7,m7,m6,m6,m4,a4,a0,a0,m4,m4,a4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m5,m5,S,m1,m1,m1,m2,m2,m2,m2,m2,m0,m0,m6,m0,m0,m0,m0,m0,m2,m2,#3e8p8f,m2,m2,m2,m0,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m2,m4,m4,m4,m4,m4,m4,m2,m2,m2,m2,m2,m3,a2,m2,a2,m2,m0,m2,m2,m2,m2,m2,m0,m0,m0,m2,m2,m2,m0,m0,m0,m1,m1,m3,m5,m6,m6,m4,m4,m4,m6,m6,m6,m4,m4,m4,m6,m6,#1q0p9ap,m6,m6,m6,m4,m6,m6,m5,m6,m6,t7,T8.7,T8.7,T8.7,T8.7,T8.7,m1,m1,m3,m2,m2,a6,m6,T8.6,T8.6,m6,m6,m5,m6,a0,m7,a0,a0,e22,m7,m4,m7,a0,m0,m4,m2,m2,m5,m7,m0,m0,m0,m0,m0,m0,m6,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m4,a6,m6,#1qdhdzz,m6,m6,m6,m6,m0,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m0,a0,m0,m0,m0,m4,m4,m0,m4,m0,m4,a0,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,w,a0,w,w,w,w,w,w,m0,m0,t2,T8.2,m1,m3,m1,m1,m2,m2,m2,m2,m2,m2,m2,#1rdgn41,m4,m4,m4,a2,a2,a2,m2,m2,m1,m1,m1,m2,m2,m2,m2,m2,m2,m2,m3,m3,m2,m2,m4,m4,m2,m2,m2",
		digest: "15dfkng",
		state: "1sl54d3",
		turn: 472,
		depth: 2,
	},
];
