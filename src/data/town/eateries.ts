// 飲食店の 品書きと 注文の 文（ui/minigames/eat.ts）。店の 形と 調べる 物の 文は data/village/eateries.ts
// （麺屋「乙」は data/village/facilities.ts）。キーは 施設の id。
// 村の 窓と 同じ 決まり：1行は 全角22字・2行まで。キリコも 話してよい（吾輩・ンゴ）。
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
		keeper: "屋台の兄ちゃん",
		again: "まだ食うんか！\nええ食いっぷりや！",
		order: "{dish}、まいど！\n熱いから気ぃつけや！",
		free: "お代？ええてええて！\n町がにぎやかなんはあんたのおかげや",
		no: "ほな、また焼きたて食べに来てや！",
		short: "{price}や！……あれ、たりへんな！\nまた稼いでおいで！",
		dishes: [
			{
				name: "たこ焼き",
				price: 500,
				art: food("takoyaki"),
				eat: [
					"はふ、はふ！\n熱すぎて口から湯気が出た！",
					"タコが大きい！\n……足が8本とも入っている！",
				],
			},
			{
				name: "ねぎだこ",
				price: 600,
				art: food("takoyaki"),
				eat: ["ねぎが山もり！\nねぎの山で前が見えない！"],
			},
			{
				name: "焼きそば",
				price: 500,
				art: food("yakisoba"),
				eat: ["ソースのこげたところがうまい！\n……青のりが歯に全部ついた！"],
			},
			{
				name: "ラムネ",
				price: 150,
				art: food("ramune"),
				cold: true,
				eat: ["ビー玉を押しこむ。しゅわっ！\n……ビー玉ごと飲みかけた！"],
			},
		],
	},
	// 立ち食いそば「2げと」（北の 峠の 道。出かける 前の 一杯）
	soba: {
		keeper: "店主",
		again: "おかわりか！\n若いのはええな！",
		order: "{dish}、一丁！\nはい、お待ち！（3秒）",
		free: "お代はええ！\nこの峠をにぎやかにしてくれた礼や",
		no: "ほな、いってらっしゃい！\n気ぃつけてな！",
		short: "{price}や！……足りんな！\nまた峠を越えるときにな",
		dishes: [
			{
				name: "かけそば",
				price: 350,
				art: food("kake"),
				eat: ["ずるずるっ！\nすする音が峠の向こうまで響いた！"],
			},
			{
				name: "きつねそば",
				price: 450,
				art: food("kitsune"),
				eat: ["甘い油揚げをかじる！\nだしが噴水みたいにあふれた！"],
			},
			{
				name: "たぬきそば",
				price: 420,
				art: food("tanuki"),
				eat: ["天かすがつゆを吸ってふくらむ！\n……丼からあふれてきた！"],
			},
			{
				name: "月見そば",
				price: 450,
				art: food("tsukimi"),
				eat: ["月をくずすか、最後まで残すか！\n……3分悩んで、そばがのびた！"],
			},
			{
				name: "コロッケそば",
				label: "コロッケ",
				price: 480,
				art: food("korokke"),
				eat: ["コロッケをつゆにしずめる！\n……とけて、もう見つからない！"],
			},
		],
	},
	// 麺屋「乙」（線路の 東。鶏ガラ しょうゆ。券売機の 3つと 台の 餃子）
	ramen: {
		keeper: "店主",
		again: "まだいくんか！\nええ根性や！",
		order: "{dish}、あいよ！\nチャッ、チャッ（湯切りの音）",
		free: "お代はええ！\n町が育つと客もふえる。礼や！",
		no: "乙！\n（また来いや、の意味）",
		short: "{price}や！……足りんな！\n稼いでから来いや！",
		dishes: [
			{
				name: "ラーメン",
				price: 800,
				art: food("ramen"),
				eat: [
					"すき通ったしょうゆのスープ！\n店主「乙！」……まだ何も言ってない！",
				],
			},
			{
				name: "替え玉",
				price: 150,
				art: food("ramen"),
				eat: ["かためでたのんだ！\n店主「乙！」……通じたらしい！"],
			},
			{
				name: "保守（大盛）",
				label: "保守大盛",
				price: 1000,
				art: food("ramenRed"),
				eat: [
					"どんぶりがずしりと重い！\n食べても食べても底が見えない！",
					"麺の下から、また麺！\n保守するたびに麺がふえる！",
				],
			},
			{
				name: "ぎょうざ",
				price: 350,
				art: food("gyoza"),
				eat: ["パリッと焼けた羽根！\n……羽根が大きすぎて飛びそう！"],
			},
		],
	},
	// 居酒屋「草」（浜の 西。釣り帰りの 客と ナイター中継）
	izakaya: {
		keeper: "大将",
		again: "まだいけるんか！\n草！",
		order: "{dish}、あいよ！\nへい、お待ち！",
		free: "お代？ええて！\n町のために潜っとる子から取れるかい",
		no: "ほなまたな！\n次は虎が勝っとるとき来てや！",
		short: "{price}や！……足りんがな！\nツケももういっぱいや",
		tab: {
			ask: "{price}や！……足りんな。\nほなツケにしとこか？",
			menu: ["ツケでたのむ", "やめとく"],
			choice: "{price}や。\n今払うか、ツケにしとくか？",
			choiceMenu: ["払う（{price}）", "ツケでたのむ", "やめとく"],
			put: "ツケ　{tab}。\nあるとき払いでええで",
			full: "ツケが{tab}たまっとる。\nまずそれ払てからや",
			payAsk: "ツケが{tab}あるで。\n払ってくか？",
			payMenu: ["払う（{tab}）", "また今度"],
			paid: "毎度！\nツケ、きれいになったで",
			later: "ええよ、ええよ！\n……逃げたら地の果てまで追うで！",
		},
		dishes: [
			{
				name: "焼き鳥",
				price: 400,
				art: food("yakitori"),
				eat: ["タレがこげて、照りが光る！\n……まぶしくて目があけられない！"],
			},
			{
				name: "枝豆",
				price: 300,
				art: food("edamame"),
				eat: ["さやを押すと豆がとんだ！\n……天井に3つ刺さった！"],
			},
			{
				name: "もつ煮",
				price: 450,
				art: food("motsu"),
				eat: [
					"やわらかいもつがみそにとける！\n七味をふったら、ふたごと落ちた！",
				],
			},
			{
				name: "アジフライ",
				price: 500,
				art: food("fried"),
				eat: ["釣りたてのアジ。サクッ！\n……さっき海にかえしたアジでは？"],
			},
			{
				name: "オレンジジュース",
				label: "オレンジ",
				price: 250,
				art: food("juice"),
				cold: true,
				eat: ["ストローですする！\nとなりのJ民が乾杯を求めてきた！"],
			},
		],
	},
	// メイド喫茶「メイドの土産」（東の 商店街。お嬢さまを お出迎え。オムライスには おまじない）
	maid: {
		keeper: "メイドのここあ",
		again: "まだ召しあがるんですか？\nここあ、うれしいです♪",
		order: "{dish}、かしこまりました♪\n少々お待ちくださいませ",
		free: "お代はいただけません。\nこの町のお嬢さまですもの",
		no: "いってらっしゃいませ、\nお嬢さま！",
		short: "{price}でございます！\nあら、お財布が過疎ってますね♪",
		dishes: [
			{
				name: "萌えオムライス",
				label: "オムライス",
				price: 900,
				art: diner("omurice"),
				magic: [
					{
						text: "仕上げにおまじないを\nかけますね。ごいっしょに♪",
						emote: "♪",
					},
					{
						text: "おいしくなあれ、\nもえもえ……きゅん♥",
						emote: "♥",
						gesture: "spin",
					},
				],
				eat: [
					"ケチャップのハートをくずす！\nふわとろ！ちゃんとおいしい！",
					"おまじないの分だけ、\n……カロリーも倍になった気がした！",
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
						text: "いちごをのせて……\nはい、かわいくなあれ♥",
						emote: "♥",
					},
				],
				eat: ["グラスの底までスプーンをのばす！\n……スプーンより底が深い！"],
			},
			{
				name: "クリームソーダ",
				label: "ソーダ",
				price: 600,
				art: diner("creamSoda"),
				cold: true,
				eat: ["アイスがソーダにとけて、\nしゅわしゅわが止まらない！"],
			},
			{
				name: "ハートのラテ",
				label: "ラテ",
				price: 500,
				art: diner("latte"),
				magic: [
					{
						text: "泡でハートを描きますね。\n……できました♥",
						emote: "♥",
					},
				],
				eat: ["ハートをこわさないように\nそっとすすった。……割れた！"],
			},
			{
				name: "ショートケーキ",
				label: "ケーキ",
				price: 500,
				art: diner("shortcake"),
				cold: true,
				eat: [
					"いちごは最後にとっておく！\n……メイドさんがいちごを見つめている！",
				],
			},
		],
	},
};
