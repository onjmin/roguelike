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
			"m1,m1,m2,m2,m2,m2,m3,m3,m3,m4,m4,m4,m4,m4,m6,m4,m4,m2,m2,m2,m4,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,a2,a2,a2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,a0,m0,a0,a1,a1,w,w,w,w,w,#x3io45,w,w,w,w,w,m2,m3,u4,m1,m1,m2,m0,m0,m0,m2,m2,m2,m0,m0,m0,m0,a1,m6,a6,a6,m6,m6,m6,m6,m6,m6,m6,m6,m7,u2,m4,m1,m1,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m0,m0,m0,m0,m0,m0,m0,m0,m7,m5,m6,m6,m6,m6,m6,m6,#1s5ohpu,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m6,m6,m6,m6,m6,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,#1fgug2c,m3,m3,m4,m4,m4,a4,m4,m4,m4,a6,m6,m6,m6,m4,m4,m2,m3,m3,m4,m4,m4,m4,m6,m6,m6,m4,m4,m4,m5,m5,m5,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m6,m6,m6,#asqx24,m5,m6,a7,a7,m1,m2,m0,m0,m2,m0,m0,m0,m0,m0,m1,m2,m2,m2,m2,m2,m2,a2,m2,u7.6,m2,m2,a3,m1,m2,m3,m5,m6,m7,m6,m6,m6,m6,m6,m6,a6,a6,m6,m6,m6,m5,m4,m4,m4,m4,m4,m6,m4,m4,m5,m5,a5,a5,m7,S,m5,m5,m6,m4,m4,#1cdrgav,m2,m2,m2,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m6,m6,m6,m6,m6,m5,m6,m7,a7,m0,a7,u23,m1,m1,m1,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m7,m0,m0,m2,m2,m2,m2,m2,a2,m2,m2,m2,m0,a0,m0,#9v302y,m0,m7,m7,m7,m3,m3,m5,S,m3,m4,u36,m1,m3,m3,m3,m6,m4,m4,m6,m6,m6,m4,m4,m4,m4,m4,m4,m2,m2,m2,m2,m2,a2,m2,m2,m2,a2,a2,a2,a2,w,w,w,w,w,w,w,w,w,m2,m4,m4,m4,m2,m2,m2,m2,m0,m0,a0,m1,m1,m1,a2,#1ahe44p,a2,m2,m2,m2,m0,m0,m0,m0,m6,m6,m6,m6,m0,m0,m0,a0,m0,m0,m0,m1,m2,m2,m3,m3,m5,m5,m5,m6,m6,m4,m4,m2,m2,m2,m2,m4,m4,m4,m4,m5,m5,m5,m5,m5,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,#59js96,m4,m4,m2,m2,m2,m4,m4,m4,m4,m2,m2,m2,m2,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,a2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m1,m1,m1,m0,m0,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m1,m1,m1,#62p2l8,m0,m0,m6,m0,m0,m0,m6,m6,a6,m7,m7,m2,m2,m3,m3,m4,m4,m4,m2,m4,m4,m4,m4,m5,m5,m5,m4,m4,m4,m2,m2,m2,m2,m2,m2,m4,m4,m4,m5,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,#1rweygk,m6,m6,m6,m6,m0,m7,m7,S,m5,m7,m5,m7,m2,m2,m3,m3,m4,m4,m2,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m3,e49,u3,m0,m7,m7,m2,u50,m2,m0,m0,m2,m2,m0,m0,m0,m0,m6,m6,#5iuju7,m6,m6,m6,m6,m6,a6,m6,a6,a6,m0,m0,m0,a7,m7,m3,m4,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m7,m0,m0,m0,m6,m6,m6,m0,m0,m0,m0,m6,m6,m1,m1,m3,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,#hm7lr4,m4,m4,m4,m4,m2,m2,m2,m2,m4,m4,m4,m3,m3,m4,m4,a4,a4,a4,m5,m6,m6,m1,m2,m3,m4,m4,m4,m4,m6,m6,m4,m4,m3,m4,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m1,m2,m2,m2,a2,m5,m6,m7,m0,m0,m2,m2,m2,m2,m0,m0,m0,m0,#110jo3h,m7,m7,m0,m0",
		digest: "9aa20h",
		state: "sut43n",
		turn: 837,
		depth: 4,
	},
	{
		seed: "golden-2",
		replay:
			"m5,m5,m7,m7,m6,m6,m6,m4,m6,m6,m6,m6,m5,m6,m7,m7,m0,m0,m0,m2,m2,m2,m0,m0,m0,m0,m4,m4,m4,m4,m6,m6,m6,m4,m4,m4,m5,m5,m5,m5,m7,m7,m7,m6,m6,m4,m4,m6,m6,m5,a7,m0,a7,w,w,w,w,w,w,m5,m5,m6,m6,m6,#1k8smwd,m6,m6,a7,a7,w,w,w,w,w,w,w,w,w,w,w,m0,m0,m0,m7,e5,m6,m7,m7,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,a0,m0,a6,a6,m5,m6,m7,a7,a7,m1,m2,m2,m0,m0,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,#169uv2g,m4,m4,m4,m4,m2,m2,m2,m2,m2,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m2,m2,m2,m2,m2,m3,a2,m5,m4,m4,m2,m2,m2,m2,m4,m4,m4,m4,m3,m3,m5,m5,m7,m7,m7,m5,m1,m1,m2,m2,m0,#bi02ra,m0,u2,u6.1,a4,m0,m0,m6,m6,m6,m6,a0,a2,a0,a2,m0,m0,m0,m0,m6,m6,m6,m6,m6,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m3,a5,m4,a4,a4,m5,m4,m4,m4,m4,m6,m6,m6,#1hk4lop,m6,m6,m6,m6,m6,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m3,m3,m3,m3,m2,m2,m0,m0,m2,m2,m3,m3,a4,m4,a4,a4,m5,S,m1,m1,m2,m0,m0,m0,m0,m6,m0,m0,m6,m7,m7,m7,m0,a0,a0,a0,m0,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,#h276gc,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m4,m4,m3,m3,m2,m3,m4,m4,m2,m4,m4,m4,m4,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,a1,a1,m0,m0,m0,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m0,a0,m0,m7,m7,m0,m0,m6,m6,m0,m0,m2,m2,m2,#5tr4b8,m2,m2,m2,m2,m2,m0,m0,a0,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,a4,m2,m2,m3,m3,m3,m3,m4,m5,m6,m6,m6,m6,m6,u20,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m2,m2,m4,#l5mkgm,m4,m3,m3,m3,a5,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m2,m2,m2,m2,m2,m2,m2,m1,m1,m2,m2,m5,m5,m5,m7,m6,m6,m6,m6,m6,m6,m6,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m5,m4,m4,m4,m4,m4,m6,m6,m6,m6,m6,#rudjap,m4,m4,m2,m2,m3,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,a4,m4,m4,m4,m2,m2,m2,m0,m0,m1,m1,m3,m3,m3,m3,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,S,u23,m5,m5,m6,m7,m7,m3,m4,m5,#1a7m3vr,m6,m6,m0,m0,m6,m6,m6,m4,m5,a4,a4,a6,a6,m0,m7,e36,m5,m5,m5,m5,m6,m7,m7,m1,m1,m0,m0,m6,m0,m0,m0,m0,m0,m7,m7,m7,m3,m3,m3,m3,m5,m4,m4,m4,m2,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m2,m2,m1,m1,m1,#nm3giz,m2,m0,m0,m0,m2,m2,m2,m2,m2,m2,m0,m0,m6,a6,m0,m5,m6,m0,a7,m0,m0,m1,m1,m2,m2,m3,m2,m2,u39,m4,m4,m4,m4,m4,m2,m2,m4,m4,m2,m4,m4,m4,m4,m4,m4,m0,m0,m0,m0,m0,m0,m6,m0,m0,m1,m1,m2,m2,m2,m2,m0,m0,m2,m0,#1enk44t,m0,m0,m0,m0,m0,m0,m0,m0,m0,m4,m4,m4,m4,m4,m4,m4,m4,m4,m4,m6,m4,m4,m5,m5,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m6,m6,m5,m5,m5,m5,m6,m6,m6,m6,m7,m7,m7,m7,m7,m0,m0,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m1,a1,#1c2ny6i,m5,m7,m7,m6,m6,m6,m6",
		digest: "1cz8wyg",
		state: "1r2ho2y",
		turn: 772,
		depth: 3,
	},
	{
		seed: "golden-3",
		replay:
			"m6,m6,m6,m6,m6,m6,m6,m6,m7,m1,m1,m1,m2,m3,m3,m3,m3,m4,m4,m4,m4,m4,m2,m2,m2,m2,m4,m4,m4,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m5,m7,m6,m6,m4,m4,m4,m4,m4,m6,m6,m6,m0,m0,m7,m5,m5,m5,m6,#hc9mxl,m6,m6,m6,m6,m6,m6,m6,a7,m7,m6,m6,m0,m0,m6,m6,v,a5,m5,m6,a7,a7,m6,m7,m0,m0,m2,m0,m0,a0,a0,a0,w,w,w,a0,w,a0,m0,u5,m0,m0,m6,m6,m6,m7,u4,m0,m0,m7,m0,m0,m6,m0,m0,m0,m1,m1,m1,m1,m2,m2,m2,m3,m2,#kaajx3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m3,m3,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m4,m4,m4,m6,m6,m6,m6,m4,m4,m4,m4,m0,#1fn8oud,m0,m0,m0,m2,m2,m2,m2,m0,m0,m0,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m6,m6,m6,m6,m6,m7,m7,m6,m6,m6,m6,m6,m6,m6,m5,#fs0tv7,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m2,m4,m4,m2,m3,m3,m3,m3,m4,m4,m4,m4,m4,m6,m4,m4,m2,m2,m2,m2,m2,m2,m4,m4,m2,m2,m2,m3,S,m1,m1,m2,m3,m3,m3,m2,m2,m2,m2,m2,m0,m0,m0,m0,a0,a0,m0,m2,m2,m2,#jnzroc,m2,m2,m2,m0,a0,a0,w,w,m0,m6,m6,m6,m0,T8.0,T8.0,m0,a1,a4,a1,a4,m0,t1,T8.1,m0,a1,T8.1,m1,m2,m5,m5,m6,m7,m7,e19,m6,m6,m6,m4,m4,m6,m2,m0,m0,m2,m2,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m2,m2,m2,m2,#sm3smu,m2,m2,m2,m1,m2,m3,m4,m4,m4,m4,m2,m2,m4,m4,m4,m4,m4,m5,m5,m4,m4,m2,m2,m2,m4,m4,m3,m3,m4,m5,m6,m6,m6,m6,m6,m6,m6,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m6,m6,#o9dcz8,m6,m6,m0,m0,m0,m0,m0,m2,m2,m2,m0,m4,m6,m6,m6,m4,m4,m4,m4,m4,m2,m2,m2,m2,m0,m0,m0",
		digest: "1w8odl5",
		state: "10i9nhs",
		turn: 473,
		depth: 2,
	},
];
