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
		head: "おんJタウンの　雑談は　ここで。　保守は　ほどほどに。",
		from: 0,
		live: 8,
	},
	{
		id: "mcj",
		title: "おんJ　マイクラ部",
		nanashi: "名無しの鯖民",
		head: "南西の　島の　鯖の　板。　>>1　を　読んでから　入ってな。",
		from: 2,
		live: 3,
	},
	{
		id: "jikkyo",
		title: "実況ch",
		nanashi: "名無しの実況民",
		head: "テレビと　草野球の　実況。　ネタバレは　ほどほどに。",
		from: 1,
		live: 3,
	},
];

export const THREADS: readonly ThreadDef[] = [
	// ── おんJ ──
	{
		key: "hoshu",
		board: "livejupiter",
		title: "【悲報】ワイ、保守しすぎて　手が　つる",
		posts: [
			"@保守しすぎて　右手が　つった\nもう　保守できん",
			"保守",
			"保守",
			">>1　左手で　保守しろ",
			"@>>4　天才か",
			"保守　しとくで",
			"このスレも　保守が　いるやろ",
			"保守",
		],
	},
	{
		key: "kaeri",
		board: "livejupiter",
		title: "キリコ　また　帰ってきたらしいな",
		posts: [
			"@広場で　見た\nなんか　いっぱい　持っとった",
			"ほんま　よう　帰ってくるな",
			">>1　売上　どうなん",
			"メインさんが　帳簿　つけとるで",
			"シヨの　店で　また　売っとった",
			"@>>5　商売上手やな",
			"あいつ　しゃべらんけど　ええやつや",
		],
	},
	{
		key: "yakiu",
		board: "livejupiter",
		title: "やきう　今日も　グラウンドに　おる",
		need: "ground",
		posts: [
			"@朝から　ずっと　素振り　しとる",
			"やきうは　やきうやからな",
			"フェリスに　やきうくん　って　呼ばれとった",
			">>3　うらやま",
			"ランダム野球　また　負けたわ",
			"@>>5　!random　に　祈れ",
		],
	},
	{
		key: "puyu",
		board: "livejupiter",
		title: "ぷゆゆ　かわいすぎ問題",
		posts: [
			"@広場の　下を　うろうろ　しとる　あの子",
			"ぷゆゆパン　もろたで",
			">>2　ワイも",
			"ぴえんの　顔　すき",
			"@>>4　わかる",
			"守りたい　この　ぴえん",
		],
	},
	{
		key: "renko",
		board: "livejupiter",
		title: "ゲームセンター「連コ」で　1日　つぶした",
		need: "arcade",
		posts: [
			"@1プレイ　100円は　良心的",
			"連コイン　禁止　って　はり紙　あるやん",
			"@>>2　見なかった　ことに　した",
			"ハイスコア　出したら　名前　残るんか？",
			"スネーク　むずすぎ",
			">>5　しっぽを　見ろ",
		],
	},
	{
		key: "gacha",
		board: "livejupiter",
		title: "カジノ「ガチャ」　行った　やつ　おる？",
		need: "casino",
		posts: [
			"@ブラックジャックで　21　きた",
			"バカラ　ずっと　バンカーに　張っとる",
			"パチンコ　1回も　当たらん",
			">>3　沼るなよ",
			"@>>4　もう　遅い",
			"メダルは　景品に　かえとけ",
		],
	},
	{
		key: "tenki",
		board: "livejupiter",
		title: "【朗報】今日の　天気、ええらしい",
		posts: [
			"@http://tenki.onj.local/\nここ　見てきた",
			"外で　やきう　できるやん",
			"洗濯もの　干したろ",
			">>1　当たるんか　それ",
			"@>>4　当たらんでも　ええやろ",
		],
	},
	{
		key: "jiten",
		board: "livejupiter",
		title: "2ch語が　わからん　やつ　おる？",
		posts: [
			"@スレ　とか　レス　とか\nhttp://dic.onj.local/　読めば　ええで",
			"安価って　なんや",
			">>2　>>1　の　辞典に　のっとる",
			"わかりやすい",
			"辞典　作った　やつ　有能",
		],
	},
	{
		key: "tatemono",
		board: "livejupiter",
		title: "町の　建物　ふえすぎやろ",
		from: 1,
		posts: [
			"@気づいたら　新しい　建物　建っとる\nhttp://news.onj.local/",
			"キリコが　売上　出すと　町が　育つ　らしい",
			">>2　ほんまか",
			"工事の　音で　起きた",
			"@>>4　昼まで　寝とるからや",
		],
	},
	{
		key: "zero",
		board: "livejupiter",
		title: "メインさん　帳簿　つけるの　早すぎ",
		posts: [
			"@電卓より　早い",
			"解音ゼロは　3体　おるらしいな",
			">>2　プロトと　レンやろ",
			"サブ機も　村に　おるで",
			"@>>4　知らんかった",
		],
	},
	{
		key: "roze",
		board: "livejupiter",
		title: "ロゼ　壁　すり抜けて　なかった？",
		posts: [
			"@見まちがいか？",
			"束音ロゼは　すり抜けるで",
			">>2　こわ",
			"ドアの　意味　とは",
			"@>>4　草",
		],
	},
	{
		key: "tsuri",
		board: "livejupiter",
		title: "釣り場で　鯖が　釣れた",
		posts: [
			"@今夜は　しめ鯖や",
			">>1　マイクラの　鯖か",
			"@>>2　魚の　ほうや",
			"突堤の　先が　ええで",
			"ワイは　長靴しか　釣れん",
		],
	},
	{
		key: "cafe",
		board: "livejupiter",
		title: "喫茶「おんJ」の　コーヒー　うまい",
		from: CAFE_FROM,
		posts: [
			"@ナポリタンも　ある",
			"キリコ　いつも　窓ぎわに　おる",
			">>2　見とるんか",
			"@>>3　たまたまや",
			"マスターの　ひとこと　しみる",
		],
	},
	{
		key: "sento",
		board: "livejupiter",
		title: "銭湯　行ってきた",
		from: BATH_FROM,
		posts: [
			"@お湯が　熱すぎ",
			"風呂あがりに　牛乳　飲んだ",
			">>2　わかっとるな",
			"銭湯の　あとの　夜風　すき",
		],
	},
	{
		key: "omikuji",
		board: "livejupiter",
		title: "おんJ神社で　おみくじ　引いた",
		from: SHRINE_FROM,
		posts: [
			"@大吉　出た",
			">>1　つまらん",
			"@>>2　なんでや",
			"ワイ　凶",
			">>4　保守したれ",
		],
	},
	{
		key: "feris",
		board: "livejupiter",
		title: "フェリスに　あいさつ　された",
		posts: [
			"@今日も　1日　がんばろうな　て",
			"ええ子や",
			"やきうくん　呼びは　やきうだけの　特権",
			">>3　ずるい",
			"@>>4　せやな",
		],
	},
	{
		key: "shiyo",
		board: "livejupiter",
		title: "シヨの　店の　値段の　決め方",
		posts: [
			"@毎回　ちがう　気が　する",
			"気分やろ",
			">>2　商売に　気分　持ちこむな",
			"倉庫は　使いやすい",
			"@>>4　それは　ある",
		],
	},
	{
		key: "anka",
		board: "livejupiter",
		title: "安価で　今日の　晩飯　決める",
		posts: [
			"@>>5",
			"カレー",
			"ラーメン",
			"芋煮",
			"たこ焼き",
			"@>>5　たこ焼きか　ええな",
			"安価は　絶対",
		],
	},

	// ── 実況ch ──
	{
		key: "kusayakyu",
		board: "jikkyo",
		title: "【実況】おんJタウン　草野球",
		need: "ground",
		posts: [
			"@プレイボール",
			"いけ",
			"打った",
			"ゲッツー",
			"あかん",
			"@>>4　ここで　それは　あかん",
			"やきう　ナイス",
		],
	},
	{
		key: "sumo",
		board: "jikkyo",
		title: "【実況】午後の　相撲を　見る　スレ",
		posts: ["@はっけよい", "のこった", "長い", "まわし　待った", "@>>4　草"],
	},
	{
		key: "asadora",
		board: "jikkyo",
		title: "【実況】朝の　連続ドラマ",
		posts: [
			"@今日から　新章",
			"主題歌　すき",
			">>2　わかる",
			"15分　早すぎ",
			"@>>4　また　明日",
		],
	},
];
