// 本編（過去ログの底）の動きが変わっていないことを確かめる基準（生成：帰還スレを本編の道具に足したとき。
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
// 2026-09-27：山札を やめ、道具は トルネコ1と 同じく 階ごとに 重みの表から 引くように した。配られる道具が 変わり
// 前の コマンドの列では ずれるので、golden-1・2・3 は 同じ 手数を ボットで 遊びなおして 作りなおした。
// 2026-09-27：ばらつきで 飢えやすく なったぶん ぷゆゆパンの 重みを 3→4 に。golden-1・2・3 を 同じく 作りなおした。

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
			"m0,m7,m7,m7,m7,m6,m0,m0,m0,m6,a6,m6,m0,m0,a0,a0,m0,m0,m0,m7,m0,m0,m0,m0,m0,m6,m0,m0,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m1,m2,m2,m3,m3,m5,m3,m4,m4,a4,m4,m4,m4,m4,m5,m5,m5,m5,m6,#fc2x9k,m6,m6,m6,m2,m2,m2,m2,m3,m4,a4,m4,a4,m4,m2,m2,m2,m4,m4,m4,e5,m5,m5,m5,m6,m6,m6,m4,m6,m6,m6,m5,m6,m6,m6,m6,m6,m6,m6,m6,m7,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m6,m0,m0,m0,m0,m0,#1mt1hwm,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,m7,e4,m1,m1,m1,m1,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m2,m2,m2,m6,m6,m6,m0,m6,m2,m4,m2,m2,m2,m2,m2,m2,m4,#1yyydu2,m4,m4,m4,m4,m4,m2,m4,m4,m4,m4,m4,a5,m2,m2,m2,m3,m5,m6,m7,m7,m0,m0,m0,m0,m4,m0,m0,m6,m0,m0,m0,m4,m4,m4,m2,m4,m4,m4,m0,m0,m0,m6,m0,m0,m0,m0,m0,m0,m2,m2,m2,m6,m6,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,#rj5n6c,m2,m2,m3,m3,m6,m7,m7,m6,m6,m6,m6,m2,m2,m2,m2,m2,m3,m3,m3,m3,m4,m4,m4,m4,m4,a6,m3,m4,m5,m5,m5,m5,m4,m4,m2,m2,m2,m4,m4,m2,m3,m3,m3,m3,m3,S,m1,m1,m1,m3,m1,m2,m2,m2,m2,m3,m3,m4,m2,m2,m2,m2,m0,m0,#1tepj7x,m0,m2,m2,m2,m6,m6,m6,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,a1,m7,m6,m6,m6,m0,m0,m0,m0,m6,m6,a4,a4,w,a2,w,w,w,w,w,w,w,w,w,m4,a5,w,w,w,w,w,w,w,w,w,w,w,w,w,#wifl1w,w,w,w,m5,a0,m6,m6,m6,m6,m6,m6,m6,m6,m7,m1,m2,m2,m3,a3,a3,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m1,m2,m2,m3,m3,m4,m4,m4,m4,m4,m4,m4,m6,m6,m6,m4,#14onfus,m4,m3,a4,a4,a4,w,w,w,w,w,w,w,m3,m3,m2,m2,m0,m0,m0,m0,m2,m2,m2,m2,m3,u6.23,m1,m2,m2,m2,m3,m3,m2,m2,m2,m2,m2,m4,m2,m2,m2,m2,m2,m2,m2,m2,a0,a2,m1,m2,m3,m4,m4,m4,m4,m4,m4,m2,m2,m2,m2,m4,m4,m6,#o1jkft,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m6,m6,m5,m6,m6,m7,u22,m7,m0,a0,m0,m2,m2,m2,m0,m0,m0,m0,m0,a1,m0,m0,m0,m7,m0,m0,m2,m2,#1jazz2x,m2,m0,m0,m0,m0,m0,m0,m0,m7,S,m4,m5,m5,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,a0,m0,m0,m0,m7,m7,a7,m5,m6,u39,m1,m1,m1,m1,m2,u35,m3,m4,m4,m4,m2,m2,m2,m2,m2,m4,m2,m2,m2,m2,#hb8y9t,m2,m2,m2,m2,m2,m0,m0,m0,m0,m1,m0,m0,m0,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m5,m5,m5,m6,m7,a7,m1,m2,m3,m3,m6,m6,m6,m6,m6,m6,m6,m4,m4,m6,m2,m0,m0,m4,#yq1ufd,m0,m1,m5,m4,m4,m0,m0,m1,m5,m1,m1,m5,m5,m6,t7,T41.7,m1,m1,m1,m2,m5,m5,T41.5,m5,t4,T41.4,m4,m4,m6,m6,m6,m2,m2,m2,m0,m0,m6,t7,T41.7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m6,m6,m6,m6,m6,m7,a7,a7,a7,m5,m5,m7,m0,m7,m3,#16zm2gz,m3,m3,m4,m4,m4,m2,m4,m4,m4,m4,a6,m0,m0,m0,m0,m6,m0,m0,T41.0,m0,m1,m2,m2,m2,m2,m2,m2,m4,m2,m2,m2,m2,m2,m1,m1,m2,m3,m3,m4,m4,m6,m6,m6,m6,m4,m4,m4,m3,m3,m3,m3,m3,m4,m4,m4,m4,m4,m5,m6,m6,m6,m6,m6,m6,#u4f2yd,m6,m4,m6,m6,m2,m2,m0,m2,m2,m2,m2,m2,m1,m2,m2,m0,m0,m0,m0,m0,m7,m7,m7,m7,m7,m0,m0,m0,m2,m2,m2,m2,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m6,m6,m6,m6,m6,m5,m7,S,u37,m3,m5,m2,m2,m6,m6,m6,m4,m4,m6,#ql7keu,m6,m4,m4,m3,m4,m6,m6,m4,m4,m4,m4,m4,a4,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,a3,a3,m3,m2,m2,m2,m4,m4,m4,m2,m2,m1,m1,u21,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m1,m3,m2,m2,m2,m2,m2,#52s2ts,m2,m4,m2,m2,m2,m2,m2,m2,m1,m0,m0,m0,m0,m0,m2,m2,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6",
		digest: "1lyq5cd",
		state: "131osso",
		turn: 989,
		depth: 4,
	},
	{
		seed: "golden-2",
		replay:
			"m4,m6,m6,m6,m6,m6,m0,a0,m0,m0,a0,a0,a0,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m0,m6,m6,a4,m4,m5,m6,m6,m6,m6,m6,m6,m7,m7,m6,m6,m6,m6,m6,m0,m0,m6,m6,m6,#zde9v3,t4,T5.4,a4,m4,m4,m5,m5,m0,m0,m1,m1,m2,m2,m2,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m2,m2,m2,m2,m2,m0,m1,m1,m1,m1,m0,m0,m6,m6,m6,m6,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m5,#1tapes5,m6,m6,m7,m7,u3,m1,m2,m2,m2,m0,m0,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m1,m1,m2,m5,m5,m6,m6,m6,m6,m4,m4,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m2,m2,m2,m2,m4,m4,m5,#i420kb,m5,m5,m6,m6,m6,m6,m6,m6,m6,a6,m6,m6,m6,m6,m6,m0,m6,m6,a6,a0,m5,m6,m6,m6,u6.2,m6,m6,m6,m6,m7,m7,m1,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m4,m4,m2,m2,m2,m2,a6,a6,a6,w,#1oueox7,w,w,w,w,w,w,w,w,w,a6,w,a6,w,w,w,w,w,w,m2,a2,m2,m2,m2,m4,m4,m4,m4,m4,m3,m3,a5,a5,w,w,w,w,w,w,w,m2,m2,m4,m2,m2,m2,m2,m2,m2,m2,m1,m1,m1,m2,m2,m2,m2,m2,m0,m0,m6,m6,m6,m6,m0,#36k776,m0,m0,m0,m0,m0,m0,S,m3,m4,e25,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m6,m6,m6,a5,m5,m5,m7,a7,a7,a7,m3,m3,a4,a4,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,#qz7yv2,w,w,w,m5,m4,m4,m4,m2,m2,m4,m4,m4,m4,m3,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m6,a6,a6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m7,m0,m0,m0,m0,m6,m6,m0,m0,m0,m6,m6,m6,m6,m6,m6,m0,m0,m6,m6,m6,m6,m6,m6,m6,m7,#u26at3,m7,a7,m0,m1,m5,m6,m7,m0,m0,m0,m0,m0,m0,m6,m6,m7,m7,m2,m2,m2,m2,m2,m2,m2,m2,m3,a2,m2,m2,a2,a2,m2,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m6,m6,m6,m6,m6,m6,m6,m6,m6,#qxhxhu,m4,m4,m4,m6,m6,m6,m4,m4,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m5,m5,m5,m5,m6,m6,m6,m6,m0,m0,m6,m6,m6,m6,m6,m6,t0,T5.0,m0,m0,a7,a7,w,w,w,w,m4,m5,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,#1bnmm27,m2,m2,m2,m2,m2,m5,m5,m6,m7,m7,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m7,m7,m7,m7,m0,m0,m0,m0,m0,m0,m1,m1,m2,m2,m3,m2,m2,m2,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m2,m2,m2,m2,#1an4wbu,m2,m2,m2,m2,m2,m2,m1,m2,a1,S,m0,m0,m0,m2,m2,m2,m0,m0,m0,a7,m1,m1,m1,m1,m1,m2,m2,u43,m4,m2,m2,m2,m4,m4,m4,m4,m2,m2,m4,m4,m4,m4,m4,m4,m4,m4,m4,m4,m2,m2,m6,m6,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m6,m6,#wfq4it,m0,m0,m0,m0,m6,m6,m6,m5,m5,m5,m5,m5,m6,m7,m7,m7,m7,m7,m7,m6,m6,m6,m4,m6,m6,m6,m6,m6,m6,m6,t5,T5.5,m4,m5,a6,m6,m7,m4,m5,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m5,m1,m2,m3,m2,m2,m2,m4,m2,m2,#iiaygd,m2,m2,m2,m2,m2,m2,m2",
		digest: "1ps9tzn",
		state: "g7fi8b",
		turn: 770,
		depth: 4,
	},
	{
		seed: "golden-3",
		replay:
			"m2,m2,m0,m0,m6,m0,a0,a0,m0,e2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m2,m2,m1,m2,m3,u3,m2,m3,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m2,m2,m2,m6,a2,a2,m2,m2,a2,m6,m6,w,a2,a2,a2,w,w,w,w,w,w,w,w,w,w,#1m1nv7w,w,w,a2,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m2,m2,m0,m0,#9pm78z,m0,m0,m0,m1,m3,m3,m4,m5,m5,m5,m6,m6,m6,m6,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m5,m5,a7,m6,m6,a7,m2,m4,m4,m4,m4,m6,m4,m4,m4,m2,m2,m2,m2,m2,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,#1llfeso,m2,m4,m4,m4,m6,m6,m4,m0,m2,m2,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m5,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m3,m4,#r0pvui,u5,m1,m2,m3,m2,m2,m2,m2,m2,a4,m4,m4,a2,a0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m1,a2,a2,w,w,w,w,w,w,w,w,w,w,m1,m1,m1,m1,m2,m3,S,m6,m6,m7,m7,m7,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m6,m0,a0,a0,m0,m0,#13qf09y,m6,m6,m2,m0,m1,T4.1,m1,a1,m1,m0,m0,m2,m2,m2,m2,m2,m2,m0,a0,m0,m1,m1,m1,m2,m2,m2,a2,a2,a2,w,w,w,w,m2,m4,m4,m2,m2,m2,m0,m0,m1,m1,m1,m3,m3,m3,m1,m1,m2,m3,e18,m4,m5,m5,m5,m4,m4,m6,m6,m6,m4,m4,m5,#wcqcg0,m5,m5,m5,a7,a7,w,w,w,w,w,w,w,m1,m3,m3,m3,m4,m4,m2,m2,m4,m4,m0,m0,m6,m6,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m2,m2,m2,m0,m0,m6,m6,m6,m6,m6,m6,m7,m6,m6,m6,m0,m0,m6,m6,m6,m5,m5,m5,m6,m6,m6,m6,m6,#11r3u53,m6,t7,T4.7,T4.7,m7,m7,m7,a0,a0,a0,m7,m6,m6,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,u21,m1,m1,m2,m3,m3,m2,m2,m2,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m3,m3,m3,m3,m4,m4,m6,m6,m6,m6,m6,m6,m4,m4,m4,m5,m5,m5,m6,#128qmxj,m6,m0,m6,m6,m6,m4,m4,e19,m4,m4,m4,m4,m4,m0,m0,m0,m0,m0,m0,m0,m2,m2,m2,m4,m2,m2,m0,m1,m1,m1,m0,m0,m2,m2,m2,m2,m2,a2,m2,m0,m0,m6,m6,m6,m6,m6,m7,m7,m7,m7,m6,m6,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,#7w549a,m6,m6,m6,m6,S,m0,m2,m2,m2,m2,m2,m4,m2,m2,m2,m2,m1,m1,m1,t3,T4.3,a3,m3,m5,m5,m1,m1,m1,m2,m2,a3,a3,w,w,w,w,m3,e38,m1,m0,m0,m0,m0,m0,m1,m2,m5,m7,m6,m6,m6,m6,m6,m6,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,#qtgey2,a6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m6,m6,m6,t7,T4.7,T4.7,m0,a0,m6,m7,m5,m5,m6,m7,m7,m7,a7,m6,m1,m2,m2,m2,m2,m2,m0,m0,m0,m0,m2,m0,m0,m0,m0,m0,m6,m0,m1,e37,m3,m2,m2,m2,m2,m2,m2,m2,m2,a3,#2x414o,m4,m1,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m2,m2,m1,m2,m2,m3,m3,m6,m6,m6,m6,m7,m6,m6,m0,m0,m0,m6,m6,m6,m6,m6,m6,m6,m5,m5,m5,m6,m7,m7,m6,m6,m6,m6,m6,m6,m6,m5,m4,m4,m4,m4,m4,m6,m4,m4,m4,m4,#bhvk9u,m3,m3,m3,m4,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,a2,m2,m4,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,m4,m5,m5,m5,m5,m5,m6,m6,m7,m7,m6,m6,m6,m6,m0,m6,m6,m6,m6,m6,#9c16c1,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m2,m2,a6,m2,m2,m2,m2,m2,m2,m2,m1,m1,m1,m2,m2,m3,m2,m2,m2,m2,m2,m4,m2,m2,m2,m2,m1,m1,m1,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,u35,m0,m0,m6,m6,m6,m6,m6,m6,m0,#gk36mo,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m6,m6,m6,t0,T4.0,m5,m6,m6,m7,m7,m7,S,m4,m2,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,a4,m4,m4,m4,m4,a4,m0,#hj4xvt,a4,a4,a4,a4,a4,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m4,m4,m3,t5,T4.5,a5,a5,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m3,#12bt5fi,a3,a3,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m5,m5,t6,T4.6,m1,m1,m3,t7,T4.7,m2,m2,a6,a6,a6,a6,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m6,m6,m7,m7,m3,m3,w,w,w,w,m5,t7,T4.7,T4.7,T20.7,w,#889f3d,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m0,m0,a7,a7,a7,a7,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m3,m2,#17vums4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m6,m6,m6,m6,m6,m0,m0,m4,m4,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,m3,m5,m5,m4,m4,m6,m4,m4,m4,m0,m0,m0,m2,m0,m0,m0,m0,m7,m6,m6,m6,#wb3kgb,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m5,a7,m5,m6,m6,m6,m6,m6,m4,m4,m4,m2,m2,m2,m2,m2,m2,m4,m0,m4,m0,a4,a4,m4,a4,a4,a4,m4,m5,m5,m5,m5,m0,m7,m6,m6,m6,m6,m6,m4,m4,m4,m6,m6,m6,m6,m6",
		digest: "ze0ozp",
		state: "vqlkus",
		turn: 1267,
		depth: 4,
	},
];
