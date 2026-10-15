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
			"m1,m1,m2,m2,m2,m2,m3,m3,m3,m4,m4,m4,m4,m4,m6,m4,m4,m2,m2,m2,m4,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,a2,a2,a2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,a0,m0,a0,a1,a1,w,w,w,w,w,#x3io45,w,w,w,w,w,m2,m3,u4,m1,m1,m2,m0,m0,m0,m2,m2,m2,m0,m0,m0,m0,a1,m6,a6,a6,m6,m6,m6,m6,m6,m6,m6,m6,m7,u2,m4,m1,m1,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m0,m0,m0,m0,m0,m0,m0,m0,m7,m5,m6,m6,m6,m6,m6,m6,#1s5ohpu,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m6,m6,m6,m6,m6,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,#1fgug2c,m3,m3,m4,m4,m4,a4,m4,m4,m4,a6,m6,m6,m6,m4,m4,m2,m3,m3,m4,m4,m4,m4,m6,m6,m6,m4,m4,m4,m5,m5,m5,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m6,m6,m6,#asqx24,m5,m6,a7,a7,m1,m2,m0,m0,m2,m0,m0,m0,m0,m0,m1,m2,m2,m2,m2,m2,m2,a2,m2,u7.6,m2,m2,a3,m1,m2,m3,m5,m6,m7,m6,m6,m6,m6,m6,m6,a6,a6,m6,m6,m6,m5,m4,m4,m4,m4,m4,m6,m4,m4,m5,m5,a5,a5,m7,S,m5,m5,m6,m4,m4,#1cdrgav,m2,m2,m2,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m6,m6,m6,m6,m6,m5,m6,m7,a7,m0,a7,u23,m1,m1,m1,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m7,m0,m0,m2,m2,m2,m2,m2,a2,m2,m2,m2,m0,a0,m0,#9v302y,m0,m7,m7,m7,m6,m6,m6,m6,m6,m6,m6,m0,m6,m6,m6,a6,a6,m6,m4,m4,m4,m4,m4,m6,m6,m6,m6,m6,m4,m4,m4,m4,m5,m5,m0,m1,m1,m0,m0,m0,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m2,m2,m2,m2,m4,m2,m2,m2,m2,m2,m2,m2,m1,m2,#1k72p92,m3,m3,m2,m2,m2,m2,m2,m4,m4,m2,m2,m1,m1,a2,a2,m5,m5,m6,m6,m0,m0,m6,m6,m6,m6,m6,m4,m5,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m3,m4,m4,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m5,m5,m5,m5,a7,m7,#17h10zl,m0,a0,m5,a6,m5,m6,m6,m6,m6,m6,m6,m6,m0,m6,m6,m6,m6,m6,m2,m2,m2,m2,m2,m4,m2,m2,m2,m2,m2,m2,m1,m1,m1,m1,m2,m2,m2,m2,m0,m0,a6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m7,m0,m0,m2,m2,m2,m2,m2,m2,#9vqn7o,m2,m2,m0,m0,m0,m6,m6,S,m0,m0,m1,m2,m2,m0,a0,m0,m6,m6,m6,m6,m6,m0,m0,a0,m6,m7,m7,m7,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,a6,m6,m6,m6,m6,m6,m6,m4,m4,m5,m6,m6,m6,m6,m6,m7,#ey0zj8,a0,m7,a0,m7,m2,m2,m2,m2,m2,m3,m3,m3,m4,m4,m4,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,a3,a3,a4,m3,m5,m4,m4,m6,m4,m4,m4,m3,m3,m4,m1,m1,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m2,m2,m1,m2,m2,m2,m2,m2,a3,m3,m1,#qpc38l,m3,m3,m2,m2,m2,m2,m1,m1,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m0,m0,m6,m6,m6,m6,m6,m6,m6,m7,m7,u39,m5,m5,m5,m6,m6,m6,m6,m7,m7,m7,m7,m6,m6,m6,m4,m4,m4,m4,m6,m6,m6,m6,m6,#we3bc1,m6,m5,m6,m6,m4,m4,m6,m4,m4,m4,m4,m5,S,m0,u57,m3,m4,m5,m1,m1,m1,m2,m2,m2,m2,m2,m2,m3,m3,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m2,m2,m4,m4,m4,m4,m6,m4,m4,m4,m2,m2,m2,m2,m2,m2,m3,m3,u58.1,m5,m5,m5,m6,m6,m6,#7vcfvn,m6,m6,m6,m7",
		digest: "1o2xvvg",
		state: "1crh7cl",
		turn: 833,
		depth: 4,
	},
	{
		seed: "golden-2",
		replay:
			"m5,m5,m7,m7,m6,m6,m6,m4,m6,m6,m6,m6,m5,m6,m7,m7,m0,m0,m0,m2,m2,m2,m0,m0,m0,m0,m4,m4,m4,m4,m6,m6,m6,m4,m4,m4,m5,m5,m5,m5,m7,m7,m7,m6,m6,m4,m4,m6,m6,m5,a7,m0,a7,w,w,w,w,w,w,m5,m5,m6,m6,m6,#1k8smwd,m6,m6,a7,a7,w,w,w,w,w,w,w,w,w,w,w,m0,m0,m0,m7,e5,m6,m7,m7,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,a0,m0,a6,a6,m5,m6,m7,a7,a7,m1,m2,m2,m0,m0,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,#169uv2g,m4,m4,m4,m4,m2,m2,m2,m2,m2,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m2,m2,m2,m2,m2,m3,a2,m5,m4,m4,m2,m2,m2,m2,m4,m4,m4,m4,m3,m3,m5,m5,m7,m7,m7,m5,m1,m1,m2,m2,m0,#bi02ra,m0,u2.6,m0,m0,m6,m6,m6,m6,m0,m0,a0,a4,a0,a4,a0,m0,m0,m6,m6,m6,m6,m6,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m3,a4,m4,m5,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,#1vwbl6h,m6,m6,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m3,m3,m3,m3,m2,m2,m0,m0,m2,m2,m3,a4,a4,m1,m1,a3,a3,a3,w,w,w,m3,m4,m5,m5,m5,S,m0,m0,m0,m6,m6,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,#1dbixqy,m0,m0,m0,m0,m2,m2,m0,m0,m0,m0,m0,m0,m0,a0,m3,m3,m5,m6,m6,m6,m7,m6,m6,u20,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,a6,a6,m1,m3,m4,m4,m4,m4,m4,m4,m6,m6,m6,m6,m4,m4,m4,m4,m3,m4,m4,m2,m2,m2,m2,m2,m2,m2,#1pgdxdy,m2,m2,m2,m6,m6,m6,m2,m2,m2,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m7,m0,m0,m0,m0,m2,m2,m2,m2,m0,m0,m0,m0,m0,m0,m2,m2,m2,m2,m2,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m6,m6,m6,m6,m4,m4,m4,m4,m3,m4,m4,m2,#1pe50om,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m2,m2,m0,m0,m0,m0,m0,m0,m0,m0,m7,m7,m0,m0,m0,a2,m2,a2,m2,m0,m0,m6,a6,a6,m0,m0,m7,m6,m6,m6,m6,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m2,m6,#r1aur,m2,m2,m2,m6,m2,m6,m2,a6,a6,a6,w,a6,a6,m6,a6,m6,m6,m6,m6,m6,m7,m7,m7,m1,m1,m3,m3,m3,m3,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m2,m2,m2,m2,m3,m3,m4,m4,m4,m6,m6,m4,m4,m4,m3,m3,m3,m3,m5,m5,m4,#13q1kzu,m4,m4,m4,m6,m6,m4,m4,m4,m4,a4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,a2,m2,m2,m2,m2,m0,m0,m0,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m1,a3,m1,m2,m3,u21,m1,m3,m3,m6,m6,m7,#1dfdupg,m7,m0,m0,m0,m0,m0,m0,m4,m4,m4,m4,m4,m4,m2,m2,m2,m3,m3,S,m2,m2,m3,m3,m4,m4,m4,m2,m2,m4,m4,m3,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m2,m0,m0,m0,m6,m6,m6,m6,m6,m6,m0,m0,#7rlbm,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m5,m5,m6,m6,m7,m5,m6,m6,m6,m7,a7,u36,m4,m4,m4,m4,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m2,m2,m2,m2,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,#147rok6,m2,m2,m4,m4,m4,m6,m6",
		digest: "1w5v2un",
		state: "124bo6d",
		turn: 773,
		depth: 3,
	},
	{
		seed: "golden-3",
		replay:
			"m6,m6,m6,m6,m6,m6,m6,m6,m7,m1,m1,m1,m2,m3,m3,m3,m3,m4,m4,m4,m4,m4,m2,m2,m2,m2,m4,m4,m4,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m5,m7,m6,m6,m4,m4,m4,m4,m4,m6,m6,m6,m0,m0,m7,m5,m5,m5,m6,#hc9mxl,m6,m6,m6,m6,m6,m6,m6,a7,m7,m6,m6,m0,m0,m6,m6,v,a5,m5,m6,a7,a7,m6,m7,m0,m0,m2,m0,m0,a0,a0,a0,w,w,w,a0,w,a0,m0,u5,m0,m0,m6,m6,m6,m7,u4.8,m0,m0,m7,m0,m0,m6,m0,m0,m0,m1,m1,m1,m1,m2,m2,m2,m3,m2,#1bs659e,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m3,m3,m4,m4,m4,m6,m6,m6,m6,m4,m4,m4,m4,m0,m0,m0,m0,m2,m2,m2,m2,m0,m0,m0,m6,m6,m6,m6,m6,m7,m7,m6,m6,m6,m6,m6,m6,m6,m5,m5,m5,m6,m6,m6,m6,m6,m4,m4,m4,m2,m4,m4,m2,#10ccyx0,m3,m3,m3,m3,m4,m4,m4,m4,m4,m6,a4,m4,m4,m2,m2,m2,m2,m2,m2,m4,m4,m2,m2,m2,m3,S,m1,u21,m6,m0,m0,m2,m0,m0,m0,m6,m7,a7,a7,m0,m0,m0,m0,e23,m3,m3,m5,m5,m5,m6,m6,m6,m6,m0,m0,m0,m0,a0,a0,a0,w,w,w,w,#pnurta,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m5,m6,m7,m7,e17,m3,m3,m3,a4,a4,a4,m4,m5,m0,m7,S,m6,m6,m7,m6,m7,m7,m7,m6,m6,m4,m4,m4,m6,m6,m6,m6,m6,m4,m4,m4,m2,m2,m4,m4,m5,m5,a6,a6,m3,m3,m4,m4,m4,m6,m6,#1mzhtmc,m4,m4,m4,m4,m4,m2,m3,m2,m2,m2,a2,a2,m2,m4,m2,m2,m6,m6,m0,m6,m6,m6,m6,m5,m6,m6,m6,m6,m6,m6,m6,m4,m6,m6,m6,m6,m6,m6,m6,m6,m5,m7,m7,m7,m7,m7,m7,m0,m0,m0,m6,m0,m0,m7,m0,m1,m1,m0,m0,u35.2,m6,m6,m0,m0,#1u65o7o,m0,m1,m1,m1,m2,m2,m2,m2,m0,m2,m2,m2,m2,m2,m2,m2,m2,m1,m2,m2,m2,m2,m2,m2,m3,m3,m3,m3,m2,m2,m0,m0,m0,m2,m2,m1,m2,m2,m3,m3,m3,m1,m1,m1,m3,m3,a3,a3,m5,m5,m5,m4,m4,m6,m6,m6,m4,m0,m2,m2,m2,m0,m0,m6,#xwgjik,m6,m6,m6,m7,m7,m7,m7,m6,m6,m4,m4,m4,m6,m6,m7,m7,m7,S,m4,m5,m4,m4,m4,m4,m2,m2,m4",
		digest: "1pkpjp4",
		state: "8aivq2",
		turn: 472,
		depth: 4,
	},
];
