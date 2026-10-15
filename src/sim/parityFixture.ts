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
			"m0,m0,m1,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m2,m2,m2,m1,m1,m2,a2,m5,a2,m1,m2,a2,a2,w,m3,m3,m3,u5,m1,m3,m0,m0,m2,m2,m2,m2,m2,m0,m0,m0,m2,m2,m0,m0,m0,a2,a2,m6,a6,a6,w,w,w,w,w,w,w,w,#1ix3y1j,w,w,w,w,w,w,w,w,m7,m6,m6,m6,m0,m6,m6,m6,m6,m5,m7,m5,m6,m6,m6,m6,a6,m1,m1,m1,m3,m5,m5,m6,m6,m6,m6,m6,m7,m6,m6,m6,m0,m0,m6,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m0,m7,a0,a0,m7,#1ljztzx,u3.4,u4,m2,m2,m2,m2,m2,m2,m2,m3,u2,m1,m3,m3,m2,m2,m4,m2,m2,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m2,m2,m2,m2,m2,m2,m2,m2,m6,m6,m6,m6,m6,m6,m6,m6,m4,m6,m6,m6,m6,m5,m5,a6,m6,m6,m6,a0,m6,#aw38kl,a0,m6,m6,m6,m6,m7,m6,m6,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m2,m4,m4,m2,m2,m2,m1,m1,m2,m2,m2,m2,m2,m2,m2,m3,m3,m2,m2,m2,m2,m4,m2,m2,m2,m1,m2,#1y0pmct,m2,m2,m2,m2,m2,m2,m2,m3,S,m6,m4,m4,m4,m2,m2,m2,m4,m4,m4,m5,m6,m1,m2,m0,m0,m0,m6,m6,m6,m0,m0,m0,a1,a1,m1,m1,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m1,m1,m1,m1,m2,m3,m3,m2,m2,m0,m0,m2,m2,m2,#7jzs1l,m2,m2,m3,m3,a3,m1,a2,m1,m2,m3,m3,m3,m3,u23.1,m4,m4,m4,m4,m4,m2,m2,m2,m4,m0,m6,m6,m6,m0,m0,m0,m0,m0,m7,m7,m7,m7,m0,m0,m0,m0,m0,m0,m2,m2,m2,m0,m0,m4,m4,m6,m6,m6,m4,m4,m4,m4,m4,m4,m3,t4,T7.4,a4,a4,a4,#e17t2,a4,a4,m4,e25,m5,m5,m7,m7,m7,m7,a6,m6,m6,a6,m6,m6,m6,m4,m4,m6,m6,m4,m4,m4,m4,m4,m2,m4,m4,m4,m2,m5,m5,m5,m6,m6,m6,m6,e24,u6,m1,m1,m1,m2,m2,m2,m0,m0,m0,m6,m0,m0,m0,m6,m6,m7,m7,m7,m7,m0,m0,m6,m6,m6,#1pexgw6,m0,m0,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,m6,a7,a7,m0,m7,a7,m5,m5,m6,m4,m4,m4,m4,m6,m4,m4,m4,m4,m3,m3,m4,a4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m1,m1,m1,m1,S,m3,m5,m6,m6,m6,m7,m0,m0,m0,m6,m6,m6,#lqe13h,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m4,m4,m4,m2,m2,a2,a2,a2,a2,a2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,#cri83x,m6,m6,m6,a0,m0,m0,m6,m6,m6,m6,m7,m7,m2,m2,m2,m0,m0,m0,m6,m6,m0,m0,m0,m0,m0,a1,m0,m7,m0,m0,m6,m6,m0,m0,t6,T7.6,m7,m4,m6,m6,m6,u39,m6,m6,m7,m1,m1,m1,m1,m3,m3,m3,m3,m2,m2,m2,m2,m2,m2,m0,m2,m2,m2,m2,#i46r7o,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m6,m6,m6,m6,m6,m6,m5,m4,m4,m2,m2,m4,m4,#17kqif4,a5,m5,m5,m5,a4,m5,m7,m7,S,m0,m0,m7,m5,m5,m5,m4,m4,m6,m6,m4,m4,m4,m3,m5,m5,m5,m6,m6,m6,m6,a0,a0,m0,m6,m6,m6,m6,m6,m6,m6,t0,T7.0,m5,m5,m6,m0,m0,m1,m1,m1,m0,m0,m6,m6,m0,m0,m0,m7,m7,m7,m1,m2,m2,m2,#f06sg2,m2,m2,a0,m0,u55,m0,m6,m6,m6,m6,m6,m0,m0,m0,m0,m1,m1,m1,m3,u57,m2,m2,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m3,m3,m3,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,T7.2,T7.2,a2,m2,m2,m2,m3,m3,m4,m5,#1yhssvi,m4,m4,m6,m6",
		digest: "ysvrpz",
		state: "149cgl6",
		turn: 830,
		depth: 4,
	},
	{
		seed: "golden-2",
		replay:
			"m5,m5,m6,m7,m7,m7,m7,m7,m3,m3,m3,m3,m4,m4,m4,m6,m4,m4,m5,m5,m7,m4,m5,m5,m6,m6,m0,m0,m6,m6,m6,m6,a6,m6,u6,m5,m5,m6,m0,m0,m0,m7,m0,m0,m6,m6,m6,m6,m6,m0,m0,m0,m1,m1,m1,m1,m3,a3,a3,a3,m5,m5,m6,m7,#j52dyh,m7,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,S,m3,m4,m4,m2,m4,m4,m4,m4,m5,m5,a5,a5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,a2,a2,a2,m6,m0,m0,m6,m6,m6,m6,m0,m0,m0,#87dovc,m0,m0,m0,m0,m0,m7,u16,m7,m6,m6,m6,m6,m4,m4,m6,m6,m5,a7,a7,m6,m7,a7,a7,m5,m4,m4,m6,m6,m6,m6,m4,m4,m3,m3,m4,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m2,m2,m2,m2,m0,m0,m0,m0,m0,m0,m0,m0,m1,m1,m1,#33r9l6,m0,m0,m0,m0,m6,m6,m0,m0,m0,m6,m6,m6,m6,m4,m6,m6,a6,m6,m6,m6,m6,m6,m6,m1,m2,m3,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,a3,m3,m3,m3,m3,m1,m2,m3,m3,m2,m2,m0,m0,m2,m2,m2,m2,m1,m2,m2,m2,m2,m3,m3,m2,m2,#1fize2g,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m1,m2,m2,m0,m0,m0,m0,m6,m6,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m4,m4,m6,m6,m6,m6,m5,m5,m5,m6,m6,m6,m4,m4,m2,m2,m4,m4,m4,m4,m2,m3,S,m3,m3,m3,m4,m1,m3,m2,#1xlwzcc,m2,m2,m2,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m1,m2,m3,a3,m3,a4,u31,m4,m4,m4,m4,m4,m4,m4,m5,m5,m6,m7,m7,m6,m6,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,a6,a6,m0,m5,m5,m7,m7,#14pf14g,m7,m7,m0,m0,m0,m0,m6,m6,m6,m6,m6,m0,m0,m1,m1,a3,m1,m2,m2,m2,m2,a2,m4,m1,m2,m2,m0,m0,m6,m0,m0,m0,m0,m0,a6,m7,m7,m7,m7,e35,m3,m3,m3,m3,m4,m4,m4,m4,m4,m2,m4,m4,m3,m4,m2,m2,m2,m2,m4,m4,m4,m2,m2,m2,#1rc5om9,m0,m1,m1,m1,m0,m0,m0,m6,m6,m0,m0,m0,m0,m0,m1,m1,m1,m2,m3,m3,m3,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,m1,m2,m2,m2,m2,m2,m2,m2,m3,u33,m5,m5,m6,m4,m4,m4,m4,m6,m6,m6,m4,m4,m4,m3,m5,m0,m0,m0,m4,m3,m3,m4,a4,#1l7erj0,m4,m4,m4,m4,m4,m4,m4,m5,m5,m7,m7,S,m1,m2,m3,m2,m2,m2,m2,m2,m2,m2,m0,m2,m2,m2,m2,m2,m2,m2,m2,m6,m6,m6,m6,m6,m6,m6,m6,m4,m6,m6,m6,m6,m6,m6,m6,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m6,m6,#8ltc7h,m6,m6,m5,m5,m6,a7,m7,u49.1,m1,m1,m5,m5,m5,m6,m6,m1,m1,m1,m2,m2,m2,a0,m0,a0,m0,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,a0,m0,m0,e51,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,#17axmec,m2,m2,m2,a3,m2,m2,m2,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m0,m0,m0,m1,m1,m1,m2,m2,m2,m4,m2,m2,m2,m2,m2,m6,m6,m6,m6,m6,m0,m6,m6,m6,m5,m5,m5,m6,m6,m6,m7,m7,m7,m7,m6,m6,m6,m4,m4,m6,m6,a6,a6,a6,a6,w,w,#1iyqcfv,w,w,w,w,w,w,m6,m5,m6,m6,m6,m6,m6,m6,m6,m6,m7,m1,m1,m2,m3,m3,m3,m4,m4,u46,m4,m4,m4,m6,m6,m6,m4,m4,m4,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m2,m2,m2,m2,t3,T50.3,m2,m2,m2,m2,m2,#i9lgni,m2,m2,m2,m3,m3,m3,m3",
		digest: "1c5f9lx",
		state: "le87lc",
		turn: 770,
		depth: 4,
	},
	{
		seed: "golden-3",
		replay:
			"m2,m2,m3,u5,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,a0,a0,m6,m7,m6,m6,m6,m6,a4,a4,w,w,w,w,w,w,w,w,w,w,w,m4,m6,m6,a6,a6,w,w,w,a6,w,a6,w,w,w,w,w,w,w,w,w,w,w,w,w,#g9ivp9,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m6,e2,m6,m5,m6,m6,m4,m4,m6,m6,m6,m6,m4,m4,m4,m5,m5,m7,a7,a7,m4,m5,m5,m6,m6,m0,m0,m6,m6,m5,m6,m6,a6,m2,m4,m4,m4,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,#12zldy2,m4,m0,m0,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,m0,m0,m0,m1,m2,m2,m2,m4,m4,m2,m2,m1,m1,m1,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,m4,m2,m2,m2,m1,m1,m1,m1,m1,m3,m3,m3,m3,m3,m4,m4,m4,m4,m6,m6,#ep1les,m6,m6,m6,m4,m4,m4,m5,m5,m6,m6,m6,m0,m0,m6,m6,m6,m6,m6,m2,m2,m2,m2,m2,m4,m4,m2,m2,m2,m0,m1,m1,m0,m0,m2,m2,m2,m2,m2,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m6,m6,m5,#b8e5ft,m5,m5,m5,m7,m7,m7,m7,m0,m0,m0,m2,m2,m2,m2,m0,m0,m0,m0,a1,m0,m6,m6,m6,m6,a6,a6,w,w,w,w,w,w,w,w,w,m6,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,u3,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,#1t4b8w7,m0,m2,m2,m2,m2,m2,m3,m4,m5,m4,m4,m6,m6,m6,m6,m4,m4,m4,m5,m5,m5,m5,m6,m6,m6,m0,m0,m6,m6,m5,m6,m4,m4,m4,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m4,m2,m2,m2,m2,S,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,#1vb769z,m4,m2,m2,m4,m4,m4,m4,m4,m6,m6,m6,m6,m4,m6,m6,m6,m6,m5,m7,m7,m0,m0,m0,m0,m6,m6,m0,m4,m0,m4,m0,m4,m0,m4,w,a0,w,a0,a0,w,m0,a0,e19,w,w,w,m0,m6,m6,m6,m7,m1,m2,m2,m2,m2,m2,m0,m0,m0,m6,m6,m6,m6,#130370l,m6,m6,m0,m0,m0,m0,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,m2,m2,a2,a2,m2,m0",
		digest: "11wfl20",
		state: "t7rwb",
		turn: 474,
		depth: 2,
	},
];
