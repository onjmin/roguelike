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
// 2026-09-27：本編を 27階に（トルネコ1の 不思議のダンジョンと 同じ）。敵の 出る階を トルネコ1の 値に 戻し、山札を 164枚に した。
// 顔ぶれと 配られる札が 変わり 前の コマンドの列では ずれるので、golden-1・2・3 は 同じ 手数を ボットで 遊びなおして 作りなおした
// （golden-1 は 991手目で 倒れて 終わる）。
// 2026-09-27：草の 名前を おんJの ことばに（あぼーん草→アク禁草・誘導草→バルス草・カオス草→安価草・復旧草→水分補給草、
// カオスの杖→安価の杖。目つぶし・混乱の 記録の文も）。動きは そのままで、golden-1・2・3 の state の 指紋だけ 作りなおした。

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
			"m5,m5,m5,m5,m5,m7,m7,u4,m0,m1,m1,m2,m6,m5,m7,m2,m2,m2,m2,m5,m7,m5,m7,m2,m2,m2,m2,m5,m7,m0,m0,m0,m0,m0,m0,a2,m1,a2,m1,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m0,m2,m2,m2,m2,m4,m4,#1a6irf,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m2,m2,m2,m2,m2,m2,m2,m2,m5,m6,m6,m4,m4,m4,m4,m4,m4,m3,m3,m5,m4,m4,m4,m4,m4,m6,m4,m4,m2,m2,m2,m3,a3,a3,m3,u6,m1,m1,m2,m5,m5,m5,m5,m5,m6,m7,m7,#1mgbu04,m7,m6,m6,m6,m6,m6,m6,a6,a6,m6,m6,a7,a7,a1,m3,m5,m7,a7,a7,a7,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m3,m4,m7,m7,m7,m7,m7,m5,m5,m5,m7,m7,w,w,w,w,#1do1rm6,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m5,m6,m7,m7,#1repphn,m7,m7,m7,e22,m5,m5,m6,m7,m6,m6,m6,m6,m0,m6,m6,m5,m5,m5,m5,m6,m7,m7,m7,m7,m5,m5,m5,m6,m6,m6,m0,m6,m6,m6,m6,m6,m6,m6,m6,m5,m5,m4,m4,m6,m6,m6,m4,m4,m4,m3,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,#t5hgrn,m2,m2,m2,m2,m2,m2,m2,m1,m2,m2,m2,m2,m2,a3,a3,m3,a4,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m6,m7,m0,m0,m2,m2,m2,m2,m2,m2,m0,m4,m6,m6,m6,m6,m6,m6,m4,m4,m5,m5,m7,a7,m5,m7,m6,m6,m6,m6,m6,m6,m6,#nunpbu,m6,m6,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m4,m2,m2,m4,m4,m4,m2,m2,m2,m2,m2,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m3,m3,m3,m3,m3,m0,m1,m1,m1,m2,m2,m0,m2,m2,m2,m2,m2,#1qobrek,m2,m3,m1,m2,m2,m2,m2,m2,m5,m6,m6,m7,m0,m0,m0,m2,m0,m4,m6,m4,m4,m4,m5,m5,m6,m6,m6,m7,m7,m6,m6,m4,m6,m6,m5,m5,m5,m6,m7,m7,m7,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,a4,a4,w,w,w,w,#d6xwfb,w,w,w,a4,a4,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m4,m4,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,a1,m7,S,m2,m3,m7,m7,m0,m0,m0,m0,m2,m2,a6,a6,w,w,w,w,w,w,w,#1mfy01d,w,w,w,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,a2,m2,m2,m1,m2,m3,m4,m4,m4,m4,m2,m2,m2,m2,m4,m4,m4,m4,m3,m3,m4,m5,e33,m0,m0,m0,m7,m0,m0,m0,m0,m6,m6,m6,m6,m0,m0,m0,m0,m1,m1,m2,m0,a0,a0,w,#3svlbf,w,w,w,w,w,w,a0,w,a0,w,m4,m5,a7,a7,w,w,w,w,w,w,m1,a0,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m0,m0,m0,m2,m2,m0,m0,m0,m6,m7,m7,m7,m6,m6,m6,m6,m6,#5zg8w3,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,m6,m2,m2,u36.2,m2,m2,m4,a4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,#1rhjf2j,m2,m2,m3,m3,m3,m4,m4,m4,m6,m6,m4,m4,m4,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,a6,m6,m6,m5,m5,m0,a0,m5,m5,m5,m5,m5,m6,m6,m6,#1hrtgd1,m6,m6,m4,m4,m2,m2,m2,m2,m2,m2,m4,m4,m2,m3,m3,e34,m3,m4,S,m5,m5,m6,m6,m6,m6,m4,m4,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,m4,m3,m3,a4,a4,a4,m4,m0,m7,u1,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,#1nvq641,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m7,m7,m7,m7,m0,m0,m0,m2,m2,m2,m2,m0,m0,m0,m1,a3,a3,a3,a2,a2,a2,a0,a0,#18md2d4,u2,t1,u2,t0,u2,t1,u2,m5,m4,m4,w,w,w,w,w,w,w,w,a0,u5,u7,u38,w,w,w,w,w,w,m6,m7,u18",
		digest: "1k37ptg",
		state: "1xato2n",
		turn: 989,
		depth: 4,
	},
	{
		seed: "golden-2",
		replay:
			"m0,m1,e4,m1,m3,m5,m5,m6,m6,m6,m6,m4,m4,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m3,m3,m4,m4,m6,m6,m6,m6,a6,a6,m6,m6,m6,m6,m4,a4,w,w,w,w,w,w,w,w,w,w,w,w,m4,m4,m4,m4,m3,m4,m4,m5,m1,m1,m1,m1,u6,#iko3cz,m2,m2,m2,m3,m5,m5,m5,m6,m6,m6,m6,m7,m7,m7,m6,m6,m4,m4,m6,m6,m6,m6,m6,m5,t7,T2.7,a7,m6,m7,m7,m7,a7,a7,m1,m2,m2,m2,m2,u7.3,m5,m5,m5,m5,m5,m6,m7,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m6,m6,T2.6,#1rthpvk,T2.6,m5,m5,a6,a6,m0,m0,m0,m0,m6,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m2,m2,m2,m2,m0,m0,m1,m2,m3,m2,m2,m2,m4,m2,m2,m2,m2,m0,m0,m0,a0,m1,m3,m3,m3,m2,m2,m2,m2,m2,m2,m2,m2,a2,m2,m0,m2,m2,m2,m3,m3,#10qwhkn,m3,m4,m4,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m5,m5,m6,m6,m6,m6,m7,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,a3,m3,a4,m3,m4,m4,m6,m6,m6,m6,m6,m6,m6,#1joonxz,m6,m2,m2,m2,m2,m6,m6,m6,m6,m4,m4,m4,m4,m4,m5,a6,m6,m6,m6,m4,m4,m6,m6,m6,m6,m6,m5,m5,m6,m6,m6,m6,m7,S,m3,m3,m3,m5,e22,m5,m7,m7,m6,m6,m0,m6,m6,m6,m6,a6,m6,m6,m6,m6,m6,m6,m5,m6,m7,m0,m0,m0,m6,m0,#n3h99j,m0,m0,m6,m7,a7,a7,m1,m1,m1,a2,m4,m5,m1,m1,m1,m3,m3,m1,m3,m3,m2,m2,m2,m2,a0,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m3,m3,m5,m6,m6,m6,m6,m6,m6,m4,m4,m2,m2,m2,m2,m2,m4,m4,m4,m4,m2,m2,t3,T2.3,T2.3,m5,t2,T2.2,t3,#7e5jc,T2.3,T2.3,m1,m3,m3,m1,m1,m2,m2,m4,m4,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,a2,a2,m2,m0,m0,m0,m0,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m7,m1,m1,m2,m3,m3,m3,m4,m4,m4,#6wigfe,m4,m4,m4,m2,m2,m2,m2,m2,m4,m4,m4,m4,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m4,m5,m5,m0,m6,m6,m6,m6,m6,m6,m4,m6,m6,m6,m6,m0,m0,m0,m0,m2,m0,m0,m0,m4,m4,m4,m6,m4,m4,m4,m4,m6,m6,m6,m0,m0,#1tamh08,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m0,m2,m2,m2,m2,m2,m2,m1,m2,m0,m0,m0,m0,m0,m0,#1tifhkh,m0,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m1,m2,S,m1,m1,m1,m1,m1,m2,m2,m2,m5,m5,m5,m5,m5,m7,m7,m7,m6,m6,m6,m6,m6,m6,a6,m6,m0,m0,m6,t5,T2.5,m6,m4,m4,a5,m5,e46,#zfl4rz,m0,m0,m1,m2,m6,m5,m7,m0,m0,m0,m2,m2,m2,m0,m0,m0,m0,m0,a7,m1,m3,m2,m2,m2,m2,m2,m4,m4,m4,m4,m2,m2,m6,m6,m0,m0,m0,m0,m6,m6,m6,m6,m6,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m6,a6,m6,m5,#em8e20,m6,m6,m6,m6,m4,m4,m2,m2,m2,m2,m4,m4,m3,m4,m4,m5,m5,m5,m4,m4,m6,m4,m4,m4,m5,m5,m0,m1,m1,m0,m0,m2,m0,m0,m0,m0,m0,m0,m1,m1,m0,m0,a6,m6,m6,m6,m6,m0,m0,m1,m1,m1,m3,m3,m2,m2,m0,m0,m2,m2,m2,m1,m1,m1,#qza2l2,m2,m2,m2,m2,m3,m3,m3",
		digest: "6t7m4z",
		state: "14gq28i",
		turn: 768,
		depth: 3,
	},
	{
		seed: "golden-3",
		replay:
			"m3,m3,m4,m4,m2,m2,m2,m2,m4,m4,m4,a4,a4,w,w,w,w,w,w,w,w,w,m4,a4,a4,a4,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m4,w,m4,a2,a2,w,w,w,#keaqzf,w,w,w,w,w,w,w,w,w,w,w,w,w,a2,a2,a2,w,w,m0,w,w,w,w,w,a0,w,a0,m0,m4,m4,m2,m2,m2,m4,m4,m2,m2,m1,m1,m2,m2,m2,m2,m0,m0,m0,m0,m2,m0,m0,m0,m0,m6,m6,m6,m7,m1,m1,m2,m2,m2,m2,m3,m3,#1q87clq,m3,u2.3,m6,m6,m6,m6,m6,m6,m6,m6,m6,a7,a7,m6,m6,m7,m6,m2,m1,m1,m2,m2,m3,m3,m3,m4,m4,m4,m4,m6,m4,m4,m4,m4,m2,m2,m3,m3,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m4,m0,m0,m0,m0,m0,m0,m0,m2,#m8ju6h,m2,m2,m2,m2,m2,m2,m2,m2,m0,a0,a0,m0,a7,w,w,w,w,w,w,w,w,w,w,w,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m6,m6,m6,m4,m4,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,a2,m2,m2,m3,a2,m4,m5,#1ix7b5z,m5,m5,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m1,m2,m2,m2,m2,m0,m0,m0,m0,m6,m6,m6,m6,m6,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m1,m1,m2,m0,m0,m0,m0,#1eki7ux,m0,m6,m6,m6,m6,m0,m0,m6,m7,m7,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,a7,m4,m4,a5,m4,m5,m0,m0,m0,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m3,m3,m3,m4,m4,m2,m2,m2,m2,m4,m4,m4,m4,m4,m4,m4,S,m0,m7,m7,e24,m7,m7,m0,#1p9fz40,m0,m2,m0,m0,m6,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,m6,a6,m6,m7,m5,m7,m0,m0,m0,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m0,m2,m2,m2,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,a0,m2,m3,m3,m4,m4,#3k019a,m4,m2,m6,m0,m0,m0,m6,m7,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m6,m6,m6,m4,m4,m4,m4,m4,m4,m4,m2,m2,m2,m2,m4,m4,m4,m5,m5,m6,m6,a6,a6,a6,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,#13lrrf5,w,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m6,m6,m6,m6,m7,m0,m0,m2,m0,m0,m0,m1,m1,a1,m1,m5,m5,m5,m4,m4,m4,m6,m4,m4,m3,m4,m5,m5,m5,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m3,m4,m4,m2,m2,m2,m2,#vm5ql8,m2,m2,m2,m2,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m7,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m1,m2,m3,S,m3,m4,m4,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,m5,m5,m5,m5,m6,m6,m6,m6,m6,m7,m6,m6,m6,m6,m6,m6,m6,#1we11be,m6,m6,m6,m6,m6,m6,m6,u41,m6,m4,m4,m4,m2,m2,m2,m2,m4,a4,a4,m4,e37,m2,m3,m3,a2,m2,a2,m2,m0,m2,m2,m2,m2,m2,m2,m1,m2,m2,m2,m2,m2,m2,m3,m3,m1,m1,m5,m5,m5,m5,m5,m5,m7,m7,m7,m7,m7,m6,m6,m6,m6,m6,m6,m4,#ipppa3,m6,m6,m5,m5,m6,m7,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m6,m6,m0,m0,m0,m0,m0,m0,m0,m0,m0,m1,m1,m5,a1,m5,a1,m4,m4,a0,m0,m0,t2,T20.2,a2,a2,m1,m3,m0,m0,m1,m1,m0,m0,m0,m0,m0,m0,m0,#1xty83i,m6,m0,m0,m0,m0,a0,m1,m2,m2,m3,m3,m2,m2,m4,m2,m2,m1,m1,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m6,m5,m5,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m7,m6,m6,m0,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m2,m4,m4,m4,m4,m4,m4,#n21j1z,m4,m5,m5,m5,m7,m7,a7,m1,m2,m2,m2,m2,m3,m3,m3,m3,m2,m2,m0,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m7,S,m6,m6,m6,m7,m7,e55,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m6,u6,m6,m6,t7,T20.7,T20.7,a7,m6,m6,m6,m7,#8t8wsg,T20.7,T20.7,a7,a7,T20.7,m0,m6,m0,T20.0,m3,m3,m5,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m6,m6,m6,m0,m6,m6,m6,m6,m6,m6,m6,m6,m7,m6,m7,m0,m0,m0,m2,m0,m0,m1,m0,m0,m0,a1,m0,m0,m0,m0,m6,m6,m0,m0,m6,t7,T20.7,#99j1uz,T20.7,a7,a7,w,w,w,w,w,w,w,w,w,w,m1,m1,m1,m1,m1,m1,m2,m2,m2,m3,m0,m2,m2,m2,m4,m4,m4,m2,m2,m2,m1,m3,m1,t3,T20.3,T20.3,m3,a3,a3,u52,w,m1,m1,m1,m3,m3,m3,m5,m5,m5,m6,m6,m6,m6,m7,m7,m7,m6,m6,m6,m0,#vwyzo7,m0,m0,m6,m6,m6,m5,m5,m5,m5,m5,m6,m7,m7,S,m0,m6,m6,m6,m4,m4,m6,m6,m6,m6,m6,m6,m7,u78,m5,m7,m7,m7,m0,m0,m0,m0,m0,m0,m0,m0,m6,m0,m0,m1,m1,a2,a2,a2,w,w,w,m3,u77,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m4,#hi5yqg,m4,m4,m4,m2,m2,m2,m2,m2,m2,m1,m2,m2,m3,a3,m5,m6,m4,m4,m4,m4,m6,m6,m6,m4,m4,m4,m4,m3,m5,a7,a7,m4,m4,m4,a0,m4,m4,m4,m2,m6,a0,a0,w,m2,m4,m4,m6,m6,m6,m6,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,#1fgzwdj,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m6,m6,m6,m5,m5,m6,m7,m7,m0,m0,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m0,m0,m0,m6,m6,m0,m0,m0,m0,m1,m1,m1,m2,m3,m3,m1,m2,m3,m3,m2,m2,m2,m0,m4,m6,m6,a2,m6,m6,m6,m6,m6,#17dwqw4,m6,m6,m6,m6,m6,m6,S,m2,m2,m2,m2,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m1,m3,m4,m4,m4,m4,m4,m2,m2,m4,m0,m4,m0,m4,m0,a4,m4,m0,a4,a4,a4,a4,a4,a4",
		digest: "lcuk9w",
		state: "1uvgxd7",
		turn: 1268,
		depth: 6,
	},
];
