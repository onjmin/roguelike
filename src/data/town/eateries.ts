// 飲食店の 品書きと 注文の 文（ui/minigames/eat.ts）。店の 形と 調べる 物の 文は data/village/eateries.ts
// （麺屋「乙」は data/village/facilities.ts）。キーは 施設の id。
// 村の 窓と 同じ 決まり：1行は 全角22字・2行まで。キリコも 話してよい（吾輩・ンゴで 短く）。
// 食べても 何も 持ちこまない（満腹度・道具・強さ・記録には ふれない）。
// 村に いる あいだの 店ごとの 1回目は 店番が「お代は　ええ」（町が 育ったのは キリコの おかげ）。
// 2回目からは 品の 値段を キリコの 財布から 払う（2026-10-14 作者：「他の 有料に して いい」。
// 1回の 冒険で 数千円 稼ぐ ので、町の 飲食店くらいの 値段）。足りなければ 店番の short で 断られる。
import type { Emote, Gesture } from "../../engine/emote";
import { diner } from "../village/dinerSheet";
import { food } from "../village/rpgenArt";

/**
 * 品（選択肢の 名前・出てきた 一品の 絵・食べる 窓。cold は 冷たい 品＝湯気を 出さない）。
 * price は 円（2回目からの お代）。品書きは「名前　値段」で、長い 名前は label（品書きだけの 短い 名前）。
 */
export type Dish = {
	name: string;
	label?: string;
	price: number;
	art?: string;
	cold?: boolean;
	/** 出す 前の 店番の ひとこと（メイド喫茶の おまじない。頭に 感情の 記号・体の 動き。engine/emote.ts）。 */
	magic?: readonly Cue[];
	eat: readonly string[];
};

/** 店番の ひとことと 感情の 記号。 */
export type Cue = { text: string; emote?: Emote; gesture?: Gesture };

/** 店の 品書き（話すのは 店番。名前欄は keeper）。 */
export type EatMenu = {
	keeper: string;
	/** 食べた あとに また 話しかけた ときの ひとこと（店番の セリフの かわり。村に いる あいだ）。 */
	again: string;
	/** 注文を 受けた ひとこと（{dish}）。 */
	order: string;
	/** 食べおわった あと（村に いる あいだ 1回目だけ。お代は いらない わけ）。 */
	free: string;
	/** やめた とき。 */
	no: string;
	/** 2回目から お金が 足りない とき（{price} は その 品の 値段）。 */
	short: string;
	/** ツケが きく 店（居酒屋「草」だけ。2026-10-14 作者：「居酒屋は ツケも できる ように」。ui/minigames/eat.ts）。 */
	tab?: EatTab;
	dishes: readonly Dish[];
};

/** ツケの 文（{price} 品の 値段・{tab} たまった ツケ）。 */
export type EatTab = {
	/** 足りない とき「ツケに　する？」。 */
	ask: string;
	menu: readonly [string, string];
	/** 足りる とき「払う？　ツケ？」（{price}）。 */
	choice: string;
	choiceMenu: readonly [string, string, string];
	/** ツケに した。 */
	put: string;
	/** 上限まで たまって いて もう ツケに できない。 */
	full: string;
	/** 来た とき ツケが あって 払える：「払って　く？」。 */
	payAsk: string;
	payMenu: readonly [string, string];
	paid: string;
	later: string;
};

/** ツケの 上限（円）。 */
export const TAB_CAP = 5000;

export const EAT_MENUS: Record<string, EatMenu> = {
	// たこ焼き屋台「たこ八」（浜。タコは 店番が 突堤で 釣ってくる）
	tako: {
		keeper: "屋台の　兄ちゃん",
		again: "まだ　食うんか！\nええ　食いっぷりや",
		order: "{dish}、まいど！\n……熱いから　気ぃつけや",
		free: "お代？　ええて　ええて。\n町が　にぎやかなんは　あんたの　おかげや",
		no: "ほな、また　焼きたて　食べに　来てや",
		short: "{price}や。……あれ、たりへんな。\nまた　稼いで　おいで",
		dishes: [
			{
				name: "たこ焼き",
				price: 500,
				art: food("takoyaki"),
				eat: [
					"はふ、はふ。\n……外は　カリッ、中は　とろっ。",
					"タコが　大きい。\n……釣ってきた　話は、本当らしい。",
				],
			},
			{
				name: "ねぎだこ",
				price: 600,
				art: food("takoyaki"),
				eat: ["ねぎが　山もり。\n……しょうゆと　ねぎの　香りが　抜ける。"],
			},
			{
				name: "焼きそば",
				price: 500,
				art: food("yakisoba"),
				eat: [
					"ソースの　こげた　ところが　うまい。\n……海の家のと、どっちが　うまいか。",
				],
			},
			{
				name: "ラムネ",
				price: 150,
				art: food("ramune"),
				cold: true,
				eat: ["ビー玉を　押しこむ。しゅわっ。\n……のどの　奥が　ぱちぱちする。"],
			},
		],
	},
	// 立ち食いそば「2げと」（北の 峠の 道。出かける 前の 一杯）
	soba: {
		keeper: "店主",
		again: "おかわりか。\n……若いのは　ええな",
		order: "{dish}、一丁！\n……はい、お待ち",
		free: "お代は　ええ。\nこの　峠を　にぎやかに　してくれた　礼や",
		no: "ほな、いってらっしゃい。\n気ぃつけてな",
		short: "{price}や。……足りんな。\nまた　峠を　越える　ときに　な",
		dishes: [
			{
				name: "かけそば",
				price: 350,
				art: food("kake"),
				eat: ["ずるずる、と　すする。\n……だしが　体の　芯まで　しみる。"],
			},
			{
				name: "きつねそば",
				price: 450,
				art: food("kitsune"),
				eat: ["甘い　油揚げを　かじる。\n……じゅわっと　だしが　あふれた。"],
			},
			{
				name: "たぬきそば",
				price: 420,
				art: food("tanuki"),
				eat: ["天かすが　つゆを　吸って　ふやける。\n……これが　いい。"],
			},
			{
				name: "月見そば",
				price: 450,
				art: food("tsukimi"),
				eat: [
					"月を　くずすか、最後まで　残すか。\n……キリコは　最後まで　残した。",
				],
			},
			{
				name: "コロッケそば",
				label: "コロッケ",
				price: 480,
				art: food("korokke"),
				eat: [
					"コロッケを　つゆに　しずめる。\n……衣が　ほどけて、じゃがいもの　味。",
				],
			},
		],
	},
	// 麺屋「乙」（線路の 東。鶏ガラ しょうゆ。券売機の 3つと 台の 餃子）
	ramen: {
		keeper: "店主",
		again: "まだ　いくんか。\n……ええ　根性や",
		order: "{dish}、あいよ。\n……チャッ、チャッ（湯切りの　音）",
		free: "お代は　ええ。\n町が　育つと　客も　ふえる。……礼や",
		no: "……おう。\nまた　来いや",
		short: "{price}や。……足りんな。\n稼いでから　来いや",
		dishes: [
			{
				name: "ラーメン",
				price: 800,
				art: food("ramen"),
				eat: [
					"すき通った　しょうゆの　スープ。\n……鶏ガラの　香りが　ふわっと　立つ。",
				],
			},
			{
				name: "替え玉",
				price: 150,
				art: food("ramen"),
				eat: ["かため　で　たのんだ。\n……麺が　スープを　また　吸っていく。"],
			},
			{
				name: "保守（大盛）",
				label: "保守大盛",
				price: 1000,
				art: food("ramenRed"),
				eat: [
					"どんぶりが　ずしりと　重い。\n……食べても　食べても　落ちない。",
					"スレも　どんぶりも、\n保守すれば　なかなか　落ちない。",
				],
			},
			{
				name: "ぎょうざ",
				price: 350,
				art: food("gyoza"),
				eat: ["パリッと　焼けた　羽根。\n……肉汁が　あつい。"],
			},
		],
	},
	// 牛丼「つゆだく」（新市街の 北の 通り。いつも ワンオペ）
	gyudon: {
		keeper: "店員",
		again: "おかわりですね。\n……よく　食べますね",
		order: "{dish}、入りまーす。\n……はい、お待たせしました",
		free: "お代は……店長が　ええって。\n町の　恩人やから、だそうです",
		no: "ありがとうございましたー。\n……また　どうぞ",
		short: "{price}に　なります。\n……あ、たりないですね",
		dishes: [
			{
				name: "牛丼　並",
				price: 450,
				art: food("gyudon"),
				eat: ["甘い　つゆが　ごはんに　しみている。\n……紅しょうがを　のせた。"],
			},
			{
				name: "牛丼　大盛り",
				label: "牛丼　大盛",
				price: 600,
				art: food("gyudon"),
				eat: ["どんぶりが　ずしりと　重い。\n……食べても　食べても　へらない。"],
			},
			{
				name: "つゆだく",
				price: 450,
				art: food("gyudon"),
				eat: ["つゆが　ひたひた。\n……ごはんが　つゆを　吸って　ほどける。"],
			},
			{
				name: "ねぎだく　ギョク",
				label: "ねぎギョク",
				price: 550,
				art: food("gyudon"),
				eat: [
					"ねぎ　多めに　生卵を　のせる。\n……通の　たのみ方、らしい。",
					"となりの　客が「これ　最強」と\nうなずいた。",
				],
			},
			{
				name: "豚汁",
				price: 200,
				art: food("motsu"),
				eat: [
					"大きな　具が　ごろごろ。\n……豚汁は、なんで　こんなに　落ちつくのか。",
				],
			},
		],
	},
	// 居酒屋「草」（浜の 西。釣り帰りの 客と ナイター中継）
	izakaya: {
		keeper: "大将",
		again: "まだ　いけるんか！\n……草",
		order: "{dish}、あいよ！\n……へい、お待ち！",
		free: "お代？　ええて！\n町の　ために　潜っとる　子から　取れるかい",
		no: "ほな　またな！\n……次は　勝っとる　とき　来てや",
		short: "{price}や！　……足りんがな！\nツケも　もう　いっぱいや",
		tab: {
			ask: "{price}や！　……足りんな。\nほな　ツケに　しとこか？",
			menu: ["ツケで　たのむ", "やめとく"],
			choice: "{price}や。\n今　払うか、ツケに　しとくか？",
			choiceMenu: ["払う（{price}）", "ツケで　たのむ", "やめとく"],
			put: "ツケ　{tab}。\nあるとき　払いで　ええで",
			full: "ツケが　{tab}　たまっとる。\nまず　それ　払てからや",
			payAsk: "ツケが　{tab}　あるで。\n払ってくか？",
			payMenu: ["払う（{tab}）", "また　今度"],
			paid: "毎度！\nツケ、きれいに　なったで",
			later: "ええよ、ええよ。\n……逃げたら　あかんで",
		},
		dishes: [
			{
				name: "焼き鳥",
				price: 400,
				art: food("yakitori"),
				eat: ["タレが　こげて、照りが　光る。\n……ねぎまの　ねぎが　あまい。"],
			},
			{
				name: "枝豆",
				price: 300,
				art: food("edamame"),
				eat: [
					"さやを　押すと　豆が　とんだ。\n……もう1つ、もう1つ、と　止まらない。",
				],
			},
			{
				name: "もつ煮",
				price: 450,
				art: food("motsu"),
				eat: ["やわらかい　もつが　みそに　とける。\n……七味を　ふった。"],
			},
			{
				name: "アジフライ",
				price: 500,
				art: food("fried"),
				eat: ["釣りたての　アジ。サクッ。\n……身が　ふわっと　ほどける。"],
			},
			{
				name: "オレンジジュース",
				label: "オレンジ",
				price: 250,
				art: food("juice"),
				cold: true,
				eat: ["ストローで　すする。\n……となりの　J民が　乾杯を　求めてきた。"],
			},
		],
	},
	// 寿司「鯖」（港。鯖＝サーバー。ネタは 全体マップの 島の 名前＝板の サーバー）
	sushi: {
		keeper: "大将",
		again: "まだ　入るかい。\n……うれしいねえ",
		order: "{dish}、へい。\n……どうぞ",
		free: "お代は　いらねえ。\nこの　港が　あるのは　あんたの　おかげだ",
		no: "毎度。\n……また　どうぞ",
		short: "{price}だ。……足りねえな。\nまた　稼いだら　おいで",
		dishes: [
			{
				name: "しめ鯖",
				price: 300,
				art: food("saba"),
				cold: true,
				eat: ["ほどよい　酢と　脂。\n……鯖、という　名に　はじない　味。"],
			},
			{
				name: "ikura",
				price: 400,
				art: food("ikura"),
				cold: true,
				eat: ["いくら。\n……口の　中で、ぷちぷち　はじける。"],
			},
			{
				name: "uni",
				price: 600,
				art: food("uni"),
				cold: true,
				eat: ["うに。\n……とろっと　甘い。海の　味が　広がる。"],
			},
			{
				name: "awabi",
				price: 600,
				art: food("awabi"),
				cold: true,
				eat: ["あわび。\n……こりっ、こりっ。かむほど　うまい。"],
			},
			{
				name: "特上「hayabusa」",
				label: "特上",
				price: 2500,
				art: food("maguro"),
				cold: true,
				eat: [
					"おまかせの　盛り合わせ。\n……この　島の　名前を　もらった　握りだ。",
					"hayabusa……鳥の　名前だ。\n……魚は、ちゃんと　入っていた。",
				],
			},
		],
	},
	// 中華「炎上」（港。麻婆豆腐は ロゼ直伝）
	chuka: {
		keeper: "大将",
		again: "まだ　食うんか！\n……ええで、なんぼでも　炎上させたる",
		order: "{dish}、いっちょう！\n……ほい、お待ち！",
		free: "お代は　ええ！\n町が　育ったんは　あんたの　おかげや",
		no: "まいど！\n……また　来てな！",
		short: "{price}や！　……足りんで！\nまた　稼いで　来てな",
		dishes: [
			{
				name: "麻婆豆腐",
				price: 800,
				art: food("mabo"),
				eat: [
					"ひとくち。……からい！\n……あとから、ほんのり　あまい。",
					"ロゼの　鍋と　同じ　味が　する。\n……ほんの　ちょっとだけ、ちがう。",
				],
			},
			{
				name: "チャーハン",
				price: 700,
				art: food("chahan"),
				eat: ["パラパラの　ごはん。\n……れんげが　すすむ。"],
			},
			{
				name: "ぎょうざ",
				price: 400,
				art: food("gyoza"),
				eat: ["羽根つき。\n……酢と　こしょうで　さっぱり。"],
			},
			{
				name: "エビチリ",
				price: 900,
				art: food("ebichili"),
				eat: ["ぷりっぷりの　エビ。\n……甘からい　ソースが　ごはんを　呼ぶ。"],
			},
			{
				name: "天津飯",
				price: 700,
				art: food("tenshin"),
				eat: ["ふわふわの　卵に　あんが　とろり。\n……やさしい　味。"],
			},
		],
	},
	// バーガー「ワイバーガー」（新市街の 北の 中庭。安い・早い。ageポテトは 揚げたて＝age）
	burger: {
		keeper: "店員",
		again: "まだ　食べるんですか？\n……ありがとう　ございます！",
		order: "{dish}、ですね！\n……はい、お待たせしました！",
		free: "お代は　けっこうです。\n店長が「町の　恩人や」って",
		no: "ありがとう　ございましたー！",
		short: "{price}に　なります。\n……あ、ちょっと　たりないですね",
		dishes: [
			{
				name: "ワイバーガー",
				label: "バーガー",
				price: 300,
				art: diner("burger"),
				eat: [
					"ぱくっ。\n……肉と　ケチャップと　ピクルスの　味。",
					"安い。早い。うまい。\n……ワイらの　味方や、と　となりの　客。",
				],
			},
			{
				name: "草バーガー",
				price: 380,
				art: diner("kusaBurger"),
				eat: [
					"レタスが　山もり。\n……草に　草を　はさんでいる。",
					"食べても　食べても　レタス。\n……大草原。",
				],
			},
			{
				name: "ageポテト",
				price: 250,
				art: diner("fries"),
				eat: [
					"揚げたて。さくっ、ほくっ。\n……塩が　ちょうどいい。",
					"1本　食べると、もう1本。\n……ageたら　止まらない。",
				],
			},
			{
				name: "ナゲット",
				price: 280,
				art: diner("nugget"),
				eat: ["ソースに　つけて　ひとくち。\n……5こ　あったのに、もう　ない。"],
			},
			{
				name: "シェイク",
				price: 200,
				art: diner("shake"),
				cold: true,
				eat: ["ストローが　かたい。\n……吸っても　なかなか　のぼってこない。"],
			},
			{
				name: "ワイセット",
				price: 650,
				art: diner("set"),
				eat: [
					"バーガー・ポテト・ドリンク。\n……トレーの　上が　にぎやかだ。",
					"セットの　ほうが　安い。\n……と　言われると、たのんでしまう。",
				],
			},
		],
	},
	// メイド喫茶「メイドの土産」（新市街の 南の 中庭。お嬢さまを お出迎え。オムライスには おまじない）
	maid: {
		keeper: "メイドの　ここあ",
		again: "まだ　召しあがるんですか？\n……ここあ、うれしいです♪",
		order: "{dish}、かしこまりました♪\n少々　お待ちくださいませ",
		free: "お代は　いただけません。\nこの　町の　お嬢さまですもの",
		no: "いってらっしゃいませ、\nお嬢さま！",
		short: "{price}で　ございます。\n……あら、お財布が　さみしいですね",
		dishes: [
			{
				name: "萌えオムライス",
				label: "オムライス",
				price: 900,
				art: diner("omurice"),
				magic: [
					{
						text: "仕上げに　おまじないを\nかけますね。ごいっしょに♪",
						emote: "♪",
					},
					{
						text: "おいしく　なあれ、\nもえもえ……きゅん♥",
						emote: "♥",
						gesture: "spin",
					},
				],
				eat: [
					"ケチャップの　ハートを　くずす。\n……ふわとろ。ちゃんと　おいしい。",
					"おまじないの　分だけ、\n……ほんの　すこし　あまい　気が　した。",
				],
			},
			{
				name: "いちごパフェ",
				label: "パフェ",
				price: 800,
				art: diner("parfait"),
				cold: true,
				magic: [
					{
						text: "いちごを　のせて……\nはい、かわいく　なあれ♥",
						emote: "♥",
					},
				],
				eat: [
					"グラスの　底まで　スプーンを　のばす。\n……フレークが　まだ　さくさく。",
				],
			},
			{
				name: "クリームソーダ",
				label: "ソーダ",
				price: 600,
				art: diner("creamSoda"),
				cold: true,
				eat: ["アイスが　ソーダに　とけて\n……しゅわっと　あまい。"],
			},
			{
				name: "ハートの　ラテ",
				label: "ラテ",
				price: 500,
				art: diner("latte"),
				magic: [
					{
						text: "泡で　ハートを　描きますね。\n……できました♥",
						emote: "♥",
					},
				],
				eat: ["ハートを　こわさないように\n……そっと　すすった。"],
			},
			{
				name: "ショートケーキ",
				label: "ケーキ",
				price: 500,
				art: diner("shortcake"),
				cold: true,
				eat: [
					"いちごは　最後に　とっておく。\n……メイドさんが　にっこり　うなずいた。",
				],
			},
		],
	},
};
