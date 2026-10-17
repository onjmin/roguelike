// キリコの 家の パソコンの「ネット」の スレ（手で 書いた 架空の スレ。町の うわさ・やきう・保守・ぷゆゆ・遊び場）。
// - 書きこみは 1つ 1〜2行（短く）。先頭の「@」は イッチ（>>1 と 同じ ID）。「>>3」は 安価（その スレの 前の レスだけ）。
//   「http://〜」は ほかの 架空の ページへの リンク（後ろは 全角の 空白か 行の おわり。data/net/site.ts が 切り出す）。
// - from は 町の 段（その 段から 立つ）、need は 施設（data/village/facilities.ts の id。建ってから 立つ）。
// - 名前の 決まり：村の 野球民は「やきう」（フェリスだけ「やきうくん」）、解音ゼロは メインさん（サブ機 プロト・レンは 村の 住人）。
//   実在の 人の 名前・製品の 名前は 出さない。スレは 沈む（落ちる とは 言わない）。キリコは 書きこまない（うわさに 出るだけ）。

import { BATH_FROM, CAFE_FROM, SHRINE_FROM } from "../village/map";

export type BoardId = "livejupiter" | "mcj" | "jikkyo";

export type ThreadDef = {
	/** ほかと かぶらない 名（ID・スレの 番号の 種）。 */
	key: string;
	board: BoardId;
	title: string;
	posts: readonly string[];
	from?: number;
	need?: string;
};

export const BOARDS: readonly {
	id: BoardId;
	title: string;
	/** 板の 名前の 欄の 既定。 */
	nanashi: string;
	/** 板の 上の ひとこと。 */
	head: string;
	/** この 段から 開く。 */
	from: number;
	/** 1日に 並ぶ スレの 数。 */
	live: number;
}[] = [
	{
		id: "livejupiter",
		title: "おんJ",
		nanashi: "風吹けば名無し",
		head: "おんJタウンの雑談はここで。保守はほどほどに。",
		from: 0,
		live: 8,
	},
	{
		id: "mcj",
		title: "おんJ　マイクラ部",
		nanashi: "名無しの鯖民",
		head: "南西の島の鯖の板。>>1　を読んでから入ってな。",
		from: 2,
		live: 3,
	},
	{
		id: "jikkyo",
		title: "実況ch",
		nanashi: "名無しの実況民",
		head: "テレビと草野球の実況。ネタバレはほどほどに。",
		from: 1,
		live: 3,
	},
];

export const THREADS: readonly ThreadDef[] = [
	// ── おんJ ──
	{
		key: "hoshu",
		board: "livejupiter",
		title: "【悲報】ワイ、保守しすぎて手がつる",
		posts: [
			"@保守しすぎて右手がつった\nもう保守できん",
			"保守",
			"保守",
			">>1　左手で保守しろ",
			"@>>4　天才か",
			"保守しとくで",
			"このスレも保守がいるやろ",
			"保守",
		],
	},
	{
		key: "kaeri",
		board: "livejupiter",
		title: "キリコまた帰ってきたらしいな",
		posts: [
			"@広場で見た\nなんかいっぱい持っとった",
			"ほんまよう帰ってくるな",
			">>1　登録者どうなん",
			"ヒナリーが毎回発表しとるで",
			"ジェイトルマンのとこでまた売っとった",
			"@>>5　目利きの練習台やな",
			"あいつンゴンゴうるさいけどええやつや",
		],
	},
	{
		key: "yakiu",
		board: "livejupiter",
		title: "やきう今日もグラウンドにおる",
		need: "ground",
		posts: [
			"@朝からずっと素振りしとる",
			"やきうはやきうやからな",
			"フェリスにやきうくんって呼ばれとった",
			">>3　うらやま",
			"ランダム野球また負けたわ",
			"@>>5　!random　に祈れ",
		],
	},
	{
		key: "puyu",
		board: "livejupiter",
		title: "ぷゆゆかわいすぎ問題",
		posts: [
			"@広場の下をうろうろしとるあの子",
			"ぷゆゆパンもろたで",
			">>2　ワイも",
			"ぴえんの顔すき",
			"@>>4　わかる",
			"守りたいこのぴえん",
		],
	},
	{
		key: "renko",
		board: "livejupiter",
		title: "ゲームセンター「連コ」で1日つぶした",
		need: "arcade",
		posts: [
			"@1プレイ100円は良心的",
			"連コイン禁止ってはり紙あるやん",
			"@>>2　見なかったことにした",
			"ハイスコア出したら名前残るんか？",
			"スネークむずすぎ",
			">>5　しっぽを見ろ",
		],
	},
	{
		key: "gacha",
		board: "livejupiter",
		title: "カジノ「ガチャ」行ったやつおる？",
		need: "casino",
		posts: [
			"@ブラックジャックで21　きた",
			"バカラずっとバンカーに張っとる",
			"パチンコ1回も当たらん",
			">>3　沼るなよ",
			"@>>4　もう遅い",
			"メダルは景品にかえとけ",
		],
	},
	{
		key: "tenki",
		board: "livejupiter",
		title: "【朗報】今日の天気、ええらしい",
		posts: [
			"@http://tenki.onj.local/\nここ見てきた",
			"外でやきうできるやん",
			"洗濯もの干したろ",
			">>1　当たるんかそれ",
			"@>>4　当たらんでもええやろ",
		],
	},
	{
		key: "jiten",
		board: "livejupiter",
		title: "2ch語がわからんやつおる？",
		posts: [
			"@スレとかレスとか\nhttp://dic.onj.local/　読めばええで",
			"安価ってなんや",
			">>2　>>1　の辞典にのっとる",
			"わかりやすい",
			"辞典作ったやつ有能",
		],
	},
	{
		key: "tatemono",
		board: "livejupiter",
		title: "町の建物ふえすぎやろ",
		from: 1,
		posts: [
			"@気づいたら新しい建物建っとる\nhttp://news.onj.local/",
			"キリコが売上出すと町が育つらしい",
			">>2　ほんまか",
			"工事の音で起きた",
			"@>>4　昼まで寝とるからや",
		],
	},
	{
		key: "zero",
		board: "livejupiter",
		title: "メインさん帳簿つけるの早すぎ",
		posts: [
			"@電卓より早い",
			"解音ゼロは3体おるらしいな",
			">>2　プロトとレンやろ",
			"サブ機も村におるで",
			"@>>4　知らんかった",
		],
	},
	{
		key: "roze",
		board: "livejupiter",
		title: "ロゼ壁すり抜けてなかった？",
		posts: [
			"@見まちがいか？",
			"束音ロゼはすり抜けるで",
			">>2　こわ",
			"ドアの意味とは",
			"@>>4　草",
		],
	},
	{
		key: "tsuri",
		board: "livejupiter",
		title: "釣り場で鯖が釣れた",
		posts: [
			"@今夜はしめ鯖や",
			">>1　マイクラの鯖か",
			"@>>2　魚のほうや",
			"突堤の先がええで",
			"ワイは長靴しか釣れん",
		],
	},
	{
		key: "cafe",
		board: "livejupiter",
		title: "喫茶「おんJ」のコーヒーうまい",
		from: CAFE_FROM,
		posts: [
			"@ナポリタンもある",
			"キリコいつも窓ぎわにおる",
			">>2　見とるんか",
			"@>>3　たまたまや",
			"マスターのひとことしみる",
		],
	},
	{
		key: "sento",
		board: "livejupiter",
		title: "銭湯行ってきた",
		from: BATH_FROM,
		posts: [
			"@お湯が熱すぎ",
			"風呂あがりに牛乳飲んだ",
			">>2　わかっとるな",
			"銭湯のあとの夜風すき",
		],
	},
	{
		key: "omikuji",
		board: "livejupiter",
		title: "おんJ神社でおみくじ引いた",
		from: SHRINE_FROM,
		posts: [
			"@大吉出た",
			">>1　つまらん",
			"@>>2　なんでや",
			"ワイ凶",
			">>4　保守したれ",
		],
	},
	{
		key: "feris",
		board: "livejupiter",
		title: "フェリスにあいさつされた",
		posts: [
			"@今日も1日がんばろうなて",
			"ええ子や",
			"やきうくん呼びはやきうだけの特権",
			">>3　ずるい",
			"@>>4　せやな",
		],
	},
	{
		key: "shiyo",
		board: "livejupiter",
		title: "シヨの店の値段の決め方",
		posts: [
			"@毎回ちがう気がする",
			"気分やろ",
			">>2　商売に気分持ちこむな",
			"倉庫は使いやすい",
			"@>>4　それはある",
		],
	},
	{
		key: "anka",
		board: "livejupiter",
		title: "安価で今日の晩飯決める",
		posts: [
			"@>>5",
			"カレー",
			"ラーメン",
			"芋煮",
			"たこ焼き",
			"@>>5　たこ焼きかええな",
			"安価は絶対",
		],
	},

	// ── 実況ch ──
	{
		key: "kusayakyu",
		board: "jikkyo",
		title: "【実況】おんJタウン草野球",
		need: "ground",
		posts: [
			"@プレイボール",
			"いけ",
			"打った",
			"ゲッツー",
			"あかん",
			"@>>4　ここでそれはあかん",
			"やきうナイス",
		],
	},
	{
		key: "sumo",
		board: "jikkyo",
		title: "【実況】午後の相撲を見るスレ",
		posts: ["@はっけよい", "のこった", "長い", "まわし待った", "@>>4　草"],
	},
	{
		key: "asadora",
		board: "jikkyo",
		title: "【実況】朝の連続ドラマ",
		posts: [
			"@今日から新章",
			"主題歌すき",
			">>2　わかる",
			"15分早すぎ",
			"@>>4　また明日",
		],
	},
];
