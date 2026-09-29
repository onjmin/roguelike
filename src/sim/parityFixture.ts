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
// 2026-09-28：やはり 装備すると その 1本の 修正値と のろいが わかるように（トルネコ1と 同じ）。golden-1・3 の state の 指紋を 前に 戻した。
// 2026-09-27：たおしたとき「Nポイントの　経験値を　かせいだ」を 記録に 出す。動きは そのままで、golden-1・2・3 の state の 指紋だけ 作りなおした。
// 2026-09-27：笑い草を 草に した。動きは そのままで、記録の文（log）の 名前だけ 変わったので、golden-1・3 の state の 指紋だけ 作りなおした。
// 2026-09-28：やはり 装備すると その 1本の 修正値と のろいが わかるように（トルネコ1と 同じ）。golden-1・3 の state の 指紋を 前に 戻した。
// 2026-09-27：本編を 27階に（トルネコ1の 不思議のダンジョンと 同じ）。敵の 出る階を トルネコ1の 値に 戻し、山札を 164枚に した。
// 顔ぶれと 配られる札が 変わり 前の コマンドの列では ずれるので、golden-1・2・3 は 同じ 手数を ボットで 遊びなおして 作りなおした
// （golden-1 は 991手目で 倒れて 終わる）。
// 2026-09-27：草の 名前を おんJの ことばに（あぼーん草→アク禁草・誘導草→バルス草・カオス草→安価草・復旧草→水分補給草、
// カオスの杖→安価の杖。目つぶし・混乱の 記録の文も）。動きは そのままで、golden-1・2・3 の state の 指紋だけ 作りなおした。
// 2026-09-27：山札を やめ、道具は トルネコ1と 同じく 階ごとに 重みの表から 引くように した。配られる道具が 変わり
// 前の コマンドの列では ずれるので、golden-1・2・3 は 同じ 手数を ボットで 遊びなおして 作りなおした。
// 2026-09-27：ばらつきで 飢えやすく なったぶん ぷゆゆパンの 重みを 3→4 に。golden-1・2・3 を 同じく 作りなおした。
// 2026-09-28：武器・盾を 装備しても 修正値が わからないように（トルネコ1と 同じ）。動きは そのままで、golden-1・3 の state の 指紋だけ 作りなおした。
// 2026-09-28：やはり 装備すると その 1本の 修正値と のろいが わかるように（トルネコ1と 同じ）。golden-1・3 の state の 指紋を 前に 戻した。
// 2026-09-30：板の 階数を 縮めた（風呂板 27 → 20 階。階ごとの 強さも 20階で 27 まで 上がる ramp に）。顔ぶれが 変わり
// 前の コマンドの列では ずれるので、golden-1・2・3 は 同じ 手数を ボットで 遊びなおして 作りなおした。

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
			"m1,m1,m2,m3,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m2,m4,m4,m4,m4,m6,m4,m4,m4,m4,m4,m2,a3,a3,m3,m5,m6,a6,m6,m6,m6,a1,m6,m6,m6,m6,m6,m7,m6,m6,m6,m6,m6,a6,a6,m2,m2,m2,m2,m2,m1,m2,#zcf1zd,m2,a5,m5,e7,m1,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m2,m0,m0,m0,m0,m6,m6,m6,m6,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m5,m6,m6,m6,m6,m6,m7,m7,m7,m0,m0,m0,m0,m0,m2,m2,m2,m0,m0,m0,m1,m1,m1,m2,m2,#kg5lhr,m2,m2,m3,m2,m2,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m2,m2,m2,m2,m1,m2,m2,m2,m3,m3,m5,m6,m6,m6,m4,m4,m4,m4,m6,m6,m6,m6,m6,m4,m4,m4,m4,m3,m3,m3,m3,#1g9odd1,m5,m4,m4,m4,m2,m2,m2,m2,m4,m4,m2,a2,a2,w,w,w,w,w,m3,m4,m4,m5,u6,m0,m0,m0,m7,m0,m0,m6,m6,m6,m6,m0,m0,m0,m0,m0,m7,m7,m7,m0,m0,m0,m0,m2,m2,m2,m2,m2,m0,m0,m0,m0,m7,m7,m6,m6,m6,m6,m4,m4,m4,m4,#1jwuxw7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m6,m6,m5,m5,m6,m6,m6,m6,m6,m6,m4,m4,m4,m6,m6,m6,m4,m4,m4,m4,m4,m2,m2,m2,m2,a3,a3,a3,w,w,w,w,w,w,w,w,m2,m2,m2,m3,#1bo61ix,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m2,m4,m4,m4,m4,m6,m4,m4,m4,m4,m4,a5,m5,m5,m6,m6,m6,m6,m6,m6,m7,m6,m6,m6,m6,m6,m6,m5,m6,S,m1,m2,m2,m2,m2,m2,m2,m2,m0,m0,m6,m0,m0,m0,m0,m1,#1lttdt0,u18,m6,m7,m7,m7,m0,m0,m0,m0,m0,m6,m0,m0,m0,m0,m0,u20,m1,m2,S,m1,m2,m3,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m2,m2,m2,m3,m4,m4,m4,m4,m4,m6,m6,m4,m4,m4,m6,m6,m4,m4,m4,m6,m6,m6,a6,m6,m6,m6,m6,m5,m6,#1drxjc4,m7,m7,m0,m0,m0,m2,m0,m4,m6,m4,m4,m4,m5,m6,m6,m6,m6,m6,m6,a6,m6,m6,m6,m6,m6,m6,m6,m6,m6,a6,m6,m4,m4,a4,w,w,a4,w,w,m4,m4,m4,m4,a6,a6,a6,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,m6,#2e78ao,m6,m6,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,m2,m2,m1,m1,m1,m3,m3,m1,m1,m2,m3,u33,m3,m3,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m7,m6,m6,m0,m0,#1aoyl4e,m0,m0,m6,m6,m5,m5,m5,m6,m6,m6,m6,m6,m7,m7,u1,m3,e42,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m2,m2,m2,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m2,m2,m2,m2,m0,m0,m0,m6,m6,m6,m6,m7,m7,m1,m1,m3,#zka3a7,m3,m3,m3,m4,m4,m4,m6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m4,m4,m4,m4,m6,m6,m6,m4,m4,m4,m2,a2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m1,m2,m2,m2,m2,m2,m2,m2,m2,m2,a2,m2,m2,m4,m4,m4,m4,m2,m2,m1,m1,a2,m1,#113q1uu,m1,m1,m2,m3,m3,m3,m3,m3,m3,S,m0,m0,m0,m0,m2,m0,m0,m0,m0,m6,m7,m7,m6,m6,m6,m6,m6,m6,m6,m6,m6,m5,m5,m5,m7,m1,m1,a2,m1,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m3,m3,m2,m2,m4,m2,m2,m1,m1,#1t7ulg3,m1,m2,m1,m2,m3,m3,m3,a3,a3,w,w,w,m0,m0,m1,u46,m3,m3,m3,m4,m4,m5,m4,m4,m6,m6,m6,m6,m4,a4,m4,m4,m5,m6,m6,m6,t7,T2.7,m6,m6,m7,m6,m6,m4,m4,m0,m0,m2,m2,m4,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,m4,m4,m4,m4,#1sa0qty,m4,m4,m4,a2,m6,m2,m3,m3,m3,m5,m6,m6,m6,m6,m6,m6,m6,m7,m7,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,m6,m0,m0,m2,m2,m6,m6,m4,m4,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,#14hhgkh,m0,m0,m0,m0,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m2,m2,m2,m2,m6,m6,m6,m6,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,m6,m4,m4,m4,m4,m4,m4,m4,m4,m4,m5,S,m1,m0,m0,m0,m6,m6,m6,m6,m6,m6,m0,m0,m0,T2.0,m4,#6x8hxg,a0,m0,m4,a0,a0,a0,a0,u41,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w,w",
		digest: "m42jg5",
		state: "puw8ho",
		turn: 986,
		depth: 5,
	},
	{
		seed: "golden-2",
		replay:
			"m2,m3,m4,m4,m4,m4,m6,m6,m6,m6,m4,m4,m4,m3,m4,m5,m1,m1,m3,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m0,m6,m6,m6,m0,m0,m0,m0,m0,m0,m6,m6,m0,m6,m6,m6,m6,m6,m6,m2,m2,#1kiilc9,m2,m2,m2,m2,m4,m2,m2,m4,m4,m4,m4,m4,m4,m2,m2,m2,m4,m4,m4,m4,m4,m4,m4,m4,a4,a0,a4,a0,w,w,w,m4,e2,m4,m4,m4,a2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m0,m1,m2,m2,m2,m2,m2,m2,m3,m3,m3,a3,a3,u3,w,#11nh225,w,w,w,w,m5,m7,m7,e8,m5,m5,m7,m7,m7,m7,m0,m0,m0,m2,m2,m2,m2,m2,m2,m0,m0,m0,a0,a0,m0,m0,m0,m6,m6,m0,m0,m0,m0,m0,m0,m0,m1,m2,m3,m6,m7,m7,a6,m7,a6,m7,u4,m1,m2,m2,m3,m3,m5,m5,m5,m4,m4,m4,m4,m4,#y2wdwc,m4,m4,m2,m2,m4,m4,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m4,m4,m4,m2,m2,m2,m2,m2,m2,m2,S,m3,m3,m4,m5,m4,m4,a4,a4,m4,m4,m6,m6,m6,m6,m6,m6,m4,m4,m5,m6,m7,m5,m6,m6,m0,m0,m0,m6,m6,m6,m6,m5,m5,m5,m5,m5,m6,#nhqzpd,m6,u20,m0,m0,m0,m0,m7,m6,m6,m6,m6,m6,m4,m4,m4,m6,m6,m6,m0,a7,m5,m5,m5,m6,m7,m5,m5,m6,m6,m6,m4,m4,m4,m4,m2,a2,a3,m2,m2,m2,m3,m3,m3,m2,m2,m2,m2,m2,m2,m2,m1,m1,m2,m2,m2,m2,m2,m2,m3,m3,a3,m2,m3,m2,#s6to2i,m2,m2,m4,m2,m2,m2,m1,m1,m2,t3,T6.3,a3,m3,m5,m1,m2,m3,m1,m1,m2,m0,m0,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m0,m0,m0,m0,m0,m6,m6,m0,m0,m0,m6,m6,t5,T6.5,m6,m6,m4,m5,a6,m0,m1,m2,m2,m6,m6,m4,m4,m4,m4,m5,#n8vi05,m4,m4,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,#9qyw7z,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,#1g3h4hz,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m0,m0,m0,m0,m0,m0,m1,m2,m2,m2,m2,m4,m4,t2,T6.2,m4,m2,T6.2,T6.2,m6,m0,m0,m0,m6,m6,m6,m6,m4,m4,m4,m4,m5,m4,m4,#a1llsb,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,#1o0sp67,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,#1y3y2dy,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,m4,m0,#c9z71u,m4,m0,m4,m0,m4,m0,m4",
		digest: "1b948bv",
		state: "4v53wl",
		turn: 770,
		depth: 2,
	},
	{
		seed: "golden-3",
		replay:
			"m1,m1,m3,m2,m2,m2,m4,m4,m2,m2,m2,m2,m1,m1,m1,m1,m1,m2,u5,m5,m7,m0,m0,m2,m0,m0,m0,m0,e6,a0,a0,a0,a2,w,w,w,w,m1,m1,e4,m0,m1,m0,m0,m0,m0,m2,m2,m2,m2,m0,m0,m6,m6,m6,m6,m7,m6,m6,m6,m6,m0,m6,m6,#ibssnp,m6,m6,m6,m6,m6,m6,m5,a5,a5,a5,w,w,w,w,w,m5,m5,m6,m6,m7,a7,a7,a7,w,w,m5,m6,m7,m7,m5,m5,m6,m6,m6,m6,m0,m0,m6,m6,m4,m4,m4,m4,m4,m2,m4,m4,m4,m4,m3,a5,a5,m4,a5,m5,m6,m6,m6,m6,m6,m6,m6,m4,m4,#1xepvs0,m4,m2,m2,m2,m2,m4,m0,m6,m6,m6,m6,m0,m0,m0,m1,m1,m1,m2,m2,m2,m2,m0,a0,m0,m0,m0,m6,m0,m0,m0,m0,m0,m2,m2,m4,m4,m2,m2,m2,m2,m1,m1,m1,m2,m3,m1,m1,m2,m3,m3,a3,a3,m5,m5,m6,m4,m4,m6,m6,m6,m6,m6,m6,m4,#1koc8kq,m4,m4,a4,m4,a4,m4,m5,e3,m1,m2,m2,m2,m2,m2,m3,m3,m3,m4,m4,m4,m6,m6,m6,m6,m6,m2,m2,m2,m2,m2,m0,m0,m0,m1,m1,m2,m3,m2,m2,m6,m6,m5,m6,m6,m6,m6,m6,m6,m6,m6,m7,m7,m7,m0,m0,m0,m0,m0,m2,m2,m2,m2,m2,m2,#dgwted,m0,m0,m0,S,u2.1,m1,m2,m3,m2,m2,m2,m2,m2,m4,m4,m4,m2,a2,m2,m1,m5,a6,m1,m1,m2,m2,m2,m2,m2,m3,m1,m2,m2,m0,m2,m2,m2,m2,m2,m2,m3,a5,a5,m1,m1,m2,m2,m2,m2,m5,m5,m5,m6,m6,m7,m7,m6,m6,m6,m6,m6,m6,m4,m6,#isezpk,m6,m5,m5,m6,m6,m6,m6,m6,m6,m6,m6,m6,m0,m0,m0,m6,m6,m6,m6,m6,m5,m6,m6,m6,a0,m6,a1,m6,m6,m6,m4,m4,m2,m2,m2,m2,m2,m4,m4,m4,m4,m4,m4,m5,m5,m4,m4,m4,m2,m2,m2,m2,m2,m2,m4,m4,m4,m0,m0,m0,m6,m6,m6,m6,#1r372pu,m6,m6,m0,m0,m0,m1,m1,m1,m2,m3,m3,m3,m2,m2,m2,m2,m2,m2,m2,m2,m2,m2,m1,m2,a2,m2,m2,m2,m2,m3,m2,m2,m2,m0,m0,m2,m2,m2,m1,m3,a3,m4,m3,m3,m5,m4,m4,m4,m2,m2,m2,m4,m4,T19.4,a4,m6,m5,m5,a6,m5,m5,m6,m7,m7,#12vqbkd,m6,m6,m6,m6,m4,m4,m4,m4,m6,m6,m6,m6,m6,m6,m6,m6,u17,m1,m3,m2,m2,m2,m2,m2,m2,m0,m0",
		digest: "7rm77n",
		state: "1rul6su",
		turn: 474,
		depth: 2,
	},
];
