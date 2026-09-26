// 本編（過去ログの底）の動きが変わっていないことを確かめる基準（生成：帰還スレを本編の山札に足したとき。
// その前は ダンジョンを増やす前の版で作り、ダンジョンを増やしても 同じになることを確かめた）。
// ボットに遊ばせたコマンドの列と、そのあとの状態の指紋。入れなおして同じになるかを replayTests で見る。
// ボットが変わっても この基準は変わらない（コマンドの列を そのまま入れなおすので）。
// ゲームの中身をわざと変えたときだけ、作りなおす（本編の遊びが変わった、ということなので 説明を添えて）。
// 2026-09-26：道具・未識別名を 2ch のことばにした。動き（digest・turn・depth・64手ごとの指紋）は そのままで、
// 記録の文（log）と 未識別名だけが 変わったので、state の指紋だけ 作りなおした。
// 2026-09-26：眠りの呪文を となりに いるときだけに（トルネコ1の まどうしと 同じ）。golden-1 は 同じ コマンドの列で
// 1402ターンで 倒れるように なったので 作りなおした（golden-2・3 は そのまま）。
// 2026-09-26：草の 未識別名を 色に そろえた。動きは そのままで、state の指紋だけ 作りなおした。
// 2026-09-26：敵の とうすこ を ぷゆゆ（メタルも）に した。id・動きは そのままで、記録の文（log）の 名前だけ
// 変わったので、state の指紋だけ 作りなおした。
// 2026-09-26：食べものを パン・ぷゆゆパン・くさったパン（トルネコ1と 同じ 並び）に した。state の指紋だけ 作りなおした。
// 2026-09-26：トルネコ1の 解析値に 合わせた（矢の 本数・杖の 回数・敵の HP など）。golden-1・3 は 動き（digest・turn・depth）は
// そのままで、state の指紋だけ 変わったので 作りなおした。
// 2026-09-26：食べものの 名前を 片親パン・ぷゆゆパン・チギュリパン に した。動きは そのままで、state の指紋だけ 作りなおした。
// 2026-09-26：毒カボチャを まんぜう軍（冷笑の ひとことを 言う）に した。乱数は 使わないので 動きは そのままで、state の指紋だけ 作りなおした。
// 2026-09-26：ネットに ゆかりの ない 敵 16体の 名前を かえた（ひとだま → dat落ちの霊 など。id・絵・動きは そのまま）。
// 記録の文（log）の 名前だけ 変わったので、state の指紋だけ 作りなおした。
// 2026-09-27：強すぎる 敵 5体の 出る階を 1つ 遅らせた（寝落ち民・ゾンJ民・自演くん・鋼メンタル・ゴリラ）。
// 敵の 顔ぶれが 変わり 前の コマンドの列では ずれるので、golden-1・3 は 同じ 手数を ボットで 遊びなおして 作りなおした（golden-2 は そのまま）。
// 2026-09-27：眠っている あいだ 1ターンごとに「キリコは　眠っている」を 記録に 出す。動きは そのままで、golden-1・3 の state の 指紋だけ 作りなおした。
// 2026-09-27：たおしたとき「Nポイントの　経験値を　かせいだ」を 記録に 出す。動きは そのままで、golden-1・2・3 の state の 指紋だけ 作りなおした。
// 2026-09-27：笑い草を 草に した。動きは そのままで、記録の文（log）の 名前だけ 変わったので、golden-1 の state の 指紋だけ 作りなおした。

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
			"m5,m6,m6,m6,m6,m4,m6,m6,m6,m6,m6,m6,m5,m7,m7,m7,m7,m6,m6,m6,m6,m6,m4,m4,m4,m4,m6,m6,m6,m6,m1,m3,m7,m3,m2,m2,m6,m2,m6,m2,m6,m2,a6,a6,a6,a6,a6,a6,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,#1o9gxxv,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m6,e7,m6,m5,m6,m6,m6,m6,m6,m4,m4,m2,m2,m2,m4,m4,m4,m4,m3,m4,m5,m6,m6,m7,m7,m1,m2,m2,m2,m0,m0,m0,m0,m6,m6,m6,m0,m0,m1,m1,m1,m2,m3,m3,m2,#e2zhg9,m2,m0,m0,m0,m0,m2,m2,m2,m2,m2,m1,m3,m3,m3,m3,m2,m2,m2,m2,m2,m2,m0,m2,m2,m2,a2,a2,m2,m4,m4,m4,m4,m4,m4,m4,m2,m2,m4,m4,a5,a5,w,w,w,w,w,m3,m4,a4,m5,a4,m4,e3,m6,m6,m6,m6,m6,m0,m0,m0,m0,m6,m6,#x8qcmk,m6,m6,m5,m5,m5,m5,m6,m6,m7,m7,m0,m7,m3,m3,m3,m5,m4,m4,u9.6,m4,m2,m2,m4,m4,m5,m5,m5,m5,m7,m6,m6,m4,m6,m2,m0,m2,m2,m1,m1,m1,m2,m2,m0,m0,m6,m6,m0,m0,m0,m1,m1,m1,m1,m1,m2,m3,m2,m2,m2,m2,m4,m4,m4,m4,#1dgxfxf,m2,m2,m2,m2,m1,m1,m1,m1,m3,m3,m3,m3,m4,m4,m6,m6,m6,m4,m4,m2,m2,m2,m2,a3,m3,m5,m5,m7,m7,m7,m0,m0,m2,m2,m2,m0,m0,m6,m6,m6,m7,m7,m7,m7,m0,m0,m6,m6,m0,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m4,m6,m6,m6,m6,#lasp9p,m6,m6,m0,m0,S,m0,m0,m1,m1,e23,m4,m4,m5,m5,m4,m4,m6,m6,m4,m4,m4,m3,m3,m3,m4,m4,m4,m4,m4,m4,m4,m4,m4,a4,m4,m6,m6,m6,m6,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m1,m3,m2,m2,a6,a6,a6,a6,m6,m6,m0,#yd4tiw,m0,m0,m0,m7,u21,m5,m5,m5,m5,m5,m6,m7,m7,m7,m7,m7,m1,m2,m2,m2,m2,m2,m3,m3,m3,m3,m3,m3,m2,a2,a2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m2,m0,m0,m0,m0,m0,m0,m0,m0,m0,m1,m1,m1,m2,m2,m2,m2,m2,m2,#5nfshb,m2,m4,m4,m2,m2,m4,m4,m4,m4,m2,m2,m2,a4,a4,m4,m4,m4,m4,m4,m4,m5,m6,m7,m4,m5,u22,m1,m1,m2,m2,m2,m2,m2,m2,m3,m5,m6,m6,m7,m7,m0,m0,m0,m0,m0,m0,m6,m6,m6,m0,m0,m0,m0,m0,m1,m1,m1,m0,m0,m6,m6,m6,m6,m6,#1mlwulu,m0,m0,m4,m4,m2,m2,m2,m2,m2,m4,m4,m4,m5,m5,m5,m6,a2,m6,m0,m0,m6,m6,m6,m6,m6,m6,m5,t6,T4.6,a7,a7,m5,m7,m5,m5,m6,m6,m6,m6,m6,m6,m7,m6,m6,m6,m6,m6,m0,m6,m6,m6,m6,m6,m0,m0,m6,m6,m6,m6,m6,m0,m0,m0,m0,#1vj3iyt,m0,m0,m0,m0,a6,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m3,m3,m3,m3,m5,m4,m4,m6,m6,m4,m4,m4,m2,m2,m2,m2,m2,m2,m3,m2,m2,m2,m2,m2,m2,m4,m4,m2,m2,m0,m1,m1,m1,m0,m0,m6,m6,m6,#ijti6a,m6,m6,m0,m0,m0,m1,S,m1,m1,m3,m3,m3,m6,m6,m6,m4,m4,m4,m4,m4,m6,m6,m6,a4,m4,m4,m4,m5,m5,m6,m7,m7,m6,m6,m6,m0,m6,m6,m6,m6,m6,m6,m6,m5,m6,m6,m6,a6,a6,m2,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,#16tbv68,m4,m4,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m7,a7,m1,m1,m2,m2,m0,m0,m2,m2,m0,a0,a0,a0,w,w,w,w,w,w,w,w,w,w,w,w,w,m0,m0,m1,m1,m1,m2,m2,m0,m2,m2,m2,m2,m2,m2,m2,m3,m3,m3,m3,#ddg6n2,m4,m4,m4,m4,m4,m6,m6,m6,m4,m4,m4,m5,m5,m4,m4,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m3,m5,m5,m5,u39.1,m3,u43.25,m0,m0,m1,m1,m1,m2,m2,m2,m2,m4,m4,m4,m2,m2,m2,m0,a1,m1,t2,T4.2,m3,m7,m0,m0,m2,m2,m0,m0,m0,m0,m0,m0,#1s43czn,m0,m0,m0,m0,m0,m6,m6,m0,m4,m2,m2,m4,m4,m4,m4,m4,m4,m4,m4,m4,m4,m4,m6,m6,m4,m4,m4,m5,m6,m6,m6,m0,m0,m0,m6,m6,m6,m6,m6,S,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,u5,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m0,m3,#aaoo29,m5,m4,m4,a0,a0,a0,a0,w,w,w,w,w,w,w,w,w,m0,m0,m0,m1,m1,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,a0,a0,m0,e58,m6,m7,m7,u56,m0,m0,m0,m7,m2,m3,m3,m3,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m2,m2,m2,m2,m1,#ro3ifm,m1,a3,m0,u60,m3,m3,m4,m5,m4,m4,m2,m2,m4,m4,t5,T4.5,m5,m5,m5,t7,T4.7,T4.7,a7,m5,m5,m1,m2,m3,m3,m4,m4,m4,m4,m6,m6,m6,m6,m4,m4,m4,m2,m2,m2,m2,m3,m3,m2,m2,m2,m2,m2,m0,m0,a0,m0,m2,m2,m6,m6,m4,m4,m4,m6,m6,#wrkqce,m6,m6,m6,m5,m6,m6,m7,m7,m7,m0,m0,m0,m2,m2,m2,m2,m0,m0,m0,m0,m1,a2,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m6,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m7,m7,m0,m0,#fksx9f,m6,m6,m0,m0,m1,m1,t5,T4.5,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m6,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m5,m5,m6,m4,m4,m2,m2,m4,m4,m5,m5,m5,m5,m5,m5,m6,m6,m6,m7,m7,m6,m6,m6,m6,m6,#1yas3gg,m6,m6,m6,m2,m2,m2,m2,m2,m2,m2,m2,m1,m1,m1,m1,m3,m3,m3,m3,m3,m3,m4,m4,m4,m4,m6,m6,m6,m6,m4,m4,m4,m2,m2,m2,m2,m3,m3,m2,m2,m2,m2,m2,m0,m0,m0,m2,m2,a2,a2,w,w,w,w,w,w,w,w,w,w,w,w,w,w,#1tm9np7,w,w,w,w,w,w,w,w,w,w,w,m2,m2,m2,m2,m3,m3,m3,m3,S,m1,m2,m2,m3,m2,m2,m2,m4,m4,m2,a2,a2,m2,a2,a2,w,w,m2,m2,m2,m2,m2,m1,m2,m0,m0,m2,m2,m2,m0,m0,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,#pyy4nl,m6,m6,m6,m6,m6,m6,m6,t5,T4.5,m2,m2,a6,a6,a6,a6,a6,a6,a6,w,w,a6,a6,a6,a6,m6,m6,m5,m5,m5,t7,T4.7,m1,m1,m1,m2,m2,a6,a6,a6,a6,a6,a6,m6,m6,m5,m5,m5,m5,m6,m6,m6,m6,m6,m6,m6,m7,m6,m6,m6,m6,m4,m4,m4,m4,#1qd2d4s,m4,m4,m4,m4,m4,m4,m4,a4,a4,m4,m6,m6,m4,m4,m4,m3,m4,m2,m2,m2,m2,m2,m2,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,T4.2,m6,a2,a2,a2,m6,m6,m6,m6,m6,m4,m0",
		digest: "18xggb1",
		state: "e7foqn",
		turn: 1407,
		depth: 5,
	},
	{
		seed: "golden-2",
		replay:
			"m1,m1,m2,m3,m3,m3,u5,m1,m1,m1,m2,m2,m2,m2,m2,a2,a2,a2,m2,m2,m3,m5,m4,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m5,m5,m5,m6,m6,m6,m6,m7,m7,m7,m6,m6,m6,m6,m4,m6,m6,m6,m6,m6,m6,m6,m2,m6,#3ethj7,m6,m5,m5,m7,m7,m0,m0,m0,m0,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m5,m6,m6,m0,m7,m0,m0,m0,m0,m0,m0,m0,m1,m1,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m0,m0,m7,m7,a7,a7,a3,a3,a3,w,w,w,w,w,w,w,w,w,#ojf469,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m1,m1,m3,m3,m3,m3,m0,m1,m1,m2,m3,m3,m2,m6,m5,m1,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,#lug0kt,m2,m2,m2,m2,m2,m2,a3,a3,m2,m2,m2,m2,m2,m3,e4,m5,m5,m6,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m5,m5,m6,m6,m6,m6,m6,m7,m7,m6,m6,m6,m6,m6,m2,m2,m2,m2,m2,m3,m5,m4,m0,m4,m0,m0,m0,m6,m6,m6,m6,m6,#1ax2u8g,m6,m6,m5,m5,m5,m6,m6,m6,m6,m7,m7,m7,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,#1cepwhb,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m2,a3,a3,w,w,w,w,w,w,w,w,w,m6,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,#1vstfst,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,#m1oz79,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,#rs95ia,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m3,a4,a5,a4,a4,m7,m3,m7,m3,m7,m7,m3,m7,m3,m7,m3,m7,#46ppzy,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,#17f3pvg,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m7,m3,m3,m3,m4,#1d97185,m4,m4,m4,m6,m4,m4,m4,m4,a4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m5,m6,m7,a7,m7,m0,m0,m0,m0,m0,m4,m0,m4,a0,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,u6,u2,u3,m4,m4,m4,m4,m4,a0,#byefak,a0,a0,a0,a0,m0,m0,a2",
		digest: "1osi9um",
		state: "1sgntym",
		turn: 775,
		depth: 1,
	},
	{
		seed: "golden-3",
		replay:
			"m3,m5,m5,m5,m5,m4,m4,m2,m2,m2,m2,m4,a4,a4,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m4,m4,m5,m5,m5,m6,m6,m6,m0,m0,m0,m6,m6,m5,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,#jqzokb,m0,m0,m0,m6,m6,m6,m0,m0,m0,m0,m0,m2,m0,m0,m0,m0,m4,m4,m4,m4,m6,m4,m4,m4,m4,m4,m2,m2,m2,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m1,m1,m1,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m2,m2,m1,m1,m1,m1,m0,m0,#14nevtx,m6,m6,m6,m6,m0,m0,m0,a6,a6,m6,m6,m6,m6,m6,a2,a2,a2,m6,m6,m6,m0,m0,m6,m6,m6,m6,m6,m6,m6,m0,m0,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,a0,a0,m0,m1,m1,m3,m5,m7,m7,a7,m7,m7,m0,m6,m6,u6,u7,m6,m0,m6,m6,m6,m6,#77k172,m6,m6,m6,m6,m6,m6,m5,m5,m6,m7,m5,m5,m5,m6,m0,m0,m1,m1,m2,m2,m3,m3,m3,m3,u5.4,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m2,m2,m2,m2,m2,m3,m3,m3,m2,m2,a4,m4,m4,m2,m2,m2,m2,m1,m1,m1,m1,m2,m3,m3,#fjx8fn,m3,e3,m5,m6,m6,m6,a1,a1,m6,a1,m6,m6,m6,m6,m6,m6,m6,m0,m0,m6,m6,m5,S,m5,m5,m5,m7,u21,m3,m5,m4,e22,m1,m2,m3,m7,m7,m7,m6,m6,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m7,m7,m7,m7,m7,m0,m0,m2,a2,a2,m2,#1oxh41b,m0,m0,m0,m0,m0,m0,m7,m7,m0,m0,a2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m0,m0,m7,m2,m2,m2,m2,m3,a3,a3,m3,m3,m3,m2,m2,m0,m0,m0,m2,m6,m4,m4,m4,m6,m6,m5,m6,m6,m6,m6,m6,m6,m4,m4,m4,m6,m6,m6,m6,m4,m4,m6,m6,m6,#1qlrvlo,m4,m4,m4,m4,m4,m6,m6,m6,m5,m6,m6,m4,m4,m4,m4,m3,m4,m5,m0,m0,m0,a0,m0,m0,m0,m0,m0,m0,m0,m7,m7,m7,m0,m0,m0,m0,m6,m6,m6,m6,m6,m0,m4,m2,m2,m2,m2,m2,m4,m4,m4,m4,m2,m3,m3,m3,m3,m3,m2,m2,m2,m0,m0,m0,#12d7v3d,m0,m0,m2,m2,m3,m3,m3,m4,m4,m4,a4,a4,a4,m4,a4,w,w,w,w,w,m4,m6,m6,m4,m4,m2,m2,m2,m2,m3,m3,m2,m3,m3,m3,m3,m2,m2,m2,m2,m0,m0,m0,m2,m2,m1,m1,m1,m2,m2,m2,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m0,m0,m4,#k2rg3t,m4,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,m5,m5,m5,m5,m6,m7,m6,m6,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m7,m7,m7,m7,m7,m0,m0,m2,m2,m0,m0,m0,m0,m0,m7,m7,m7,m6,m6,m4,m4,m4,m4,m4,m6,m6,m6,m5,m7,S,m2,m0,#17j799f,m0,m6,m6,m6,m6,m6,m0,m0,m0,m0,m6,m6,m7,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m7,m7,m6,m6,m6,m6,m4,m4,m6,m6,m6,m6,m6,m6,T19.6,m6,a7,m5,a6,a6,m6,u35.1,m0,m0,e37,m2,m5,m5,m7,m5,m5,m6,m4,m4,m4,m2,m2,m2,#x5wdxq,m2,m2,m4,m4,m4,m4,m4,m4,m4,m4,m5,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m2,m2,m3,a3,a1,a1,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m1,m3,m3,m3,m2,m2,m2,m2,m2,m2,m2,m0,m2,m2,#tegojm,m2,m2,m3,m1,m1,m2,m2,m2,m2,m2,m3,m3,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,m0,m1,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,a7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m2,m2,m2,#1nksl0x,m2,m2,m2,m2,m2,m2,m4,m4,m4,m2,m2,m2,m1,m1,m1,m1,m3,m3,m3,m3,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m5,m6,m6,m4,m4,m6,m6,m6,m6,m6,m6,m5,m6,m6,m6,m6,m6,m6,m6,m7,m7,m6,m6,m6,m6,m4,m6,m6,m6,m6,#3qtagd,m6,m6,m6,m6,m6,m6,m6,m7,m7,m7,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,t6,T19.6,a7,m6,m6,m7,a5,a5,a5,m7,S,m4,m4,m4,m2,m2,m2,m2,a2,m2,m2,m4,m2,m2,m2,m2,m2,m2,m2,m0,u24,m1,a1,a1,a1,w,w,w,w,w,#119ay8z,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m1,m0,m0,m0,m2,m2,m2,m2,m0,m0,m0,m0,m0,m0,m0,m0,a0,m3,m3,m2,m2,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m3,m3,m3,m3,m3,m4,m4,m4,m4,a4,m4,m6,m6,m6,m6,m4,m4,m5,a6,#c640z7,m3,m3,m4,m6,m6,m6,m7,m6,m6,m6,m0,m0,m0,m6,m6,m6,a6,m6,m6,m6,m6,m5,m5,m5,m4,m4,m2,m2,m2,m2,m2,m2,m4,m4,m4,m3,m3,m4,m2,m2,m2,m4,m2,m2,m1,m2,m3,u54,m1,m1,m2,m2,m3,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,#16wglc1,m6,m6,m6,m0,m7,m7,m0,m0,m0,a6,a6,m6,m6,m6,m6,m6,m6,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m6,m6,m6,m6,m6,m6,m5,m6,m6,m4,m4,m2,m2,m2,m2,m4,m4,m4,m3,m3,m3,m5,m5,m0,m0,m0,m0,m7,m0,m0,m0,m6,m6,m6,m6,#frefj1,m0,m0,m0,m0,m0,m0,m7,m0,m0,m0,m0,m0,m1,m1,m1,m2,m2,m2,m2,m3,e57,m1,m3,m2,m2,m0,m4,m6,m6,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m3,m3,m3,m5,m5,m4,m4,m2,m2,m2,m2,m4,m4,m4,a3,a3,a3,w,w,w,#4ay02s,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m3,m4,S,m3,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m1,m1,m3,m2,m2,m2,m2,m0,m0,m0,m0,m2,m2,#1d0db4y,m2,m2,m2,m2,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m6,m6,m6,m6,m0,m0,m0,m7,m0,m0,m2,a2,a2,a2,w,w,w,w,w,w,w,w,w,w,w,w,w,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m0,m0,m0,m2,m2,m2,t1,T19.1,T19.1,m2,a2",
		digest: "jw2ug8",
		state: "1ho7idm",
		turn: 1275,
		depth: 5,
	},
];
