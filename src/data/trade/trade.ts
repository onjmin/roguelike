// おんJ証券（2026-10-14 作者：「株・デイトレード・FX や その他 金策も 導入したい。デイトレ・FX は ミニゲーム化」
// 「FX は ハイレバ・ロスカットも 入れると 没入感 上がりそう」）。
// - 株：村の 店の 株（STOCKS）を 1株から 買って 持ち、売る。値は 冒険から 帰る たびに 1回 動く（priceStep）。
//   ニュースが 出た 銘柄は 大きく 動く。配当の ある 銘柄は 帰る たびに 持ち株に 応じて 少し 入る。
// - デイトレ：銘柄を 1つ えらんで 元手を 入れ、場（60秒）の あいだに 買って 売る（ui/trade/dayTrade.ts）。
// - FX：ドル円。レバレッジ（1〜1000倍）と 証拠金を えらび、買い・売りで 持って 決済（ui/trade/fx.ts）。
//   証拠金維持率が LOSSCUT を 下まわると 強制決済（ロスカット）。急な 動きで 証拠金より 負けても ゼロカット（口座は マイナスに しない）。
// - 口座（2026-10-15 作者：「本物っぽく するなら 証券口座の 開設から」）：おんJ証券 商店街支店の
//   窓口で 開設（ACCOUNT_MSG）。お金は 財布（engine/wallet.ts）と 口座の あいだを おんJマートの ATM か 窓口で
//   入れ・出す。売り買いは 端末（家の パソコン・ネットカフェ・支店の 端末）で 口座の お金で する。
//   配当・売った お金・デイトレと FX の のこりは 口座へ。強さには 何も 効かない。
// ここは 形と 数と 文だけ（DOM も 保存も 使わない）。保存・場面は ui/trade/。
// 1行は 全角22字・2行まで。

export type StockId =
	| "joshiki"
	| "puyu"
	| "pan"
	| "hoshu"
	| "zero"
	| "kyudan"
	| "kusa";

export type StockDef = {
	name: string;
	/** 一覧の 短い 名前（板の 帯）。 */
	short: string;
	/** はじめの 株価（円）。 */
	start: number;
	/** 1回の 帰りの ゆれ（標準偏差。0.05 ＝ 5%）。 */
	vol: number;
	/** 1回の 帰りの 配当（株価に 対する 割合）。 */
	dividend?: number;
	/** 説明（一覧の 2行目）。 */
	note: string;
	/** 上げの ニュース・下げの ニュース。 */
	up: readonly string[];
	down: readonly string[];
};

export const STOCKS: Record<StockId, StockDef> = {
	joshiki: {
		name: "常識堂ホールディングス",
		short: "常識堂",
		start: 820,
		vol: 0.04,
		dividend: 0.003,
		note: "ロゼの店。麻婆豆腐は毎日同じ味",
		up: ["常識堂、麻婆豆腐の\n冷凍版が品切れ続出"],
		down: ["常識堂、花椒の仕入れ値が\n高騰。……辛さはそのまま"],
	},
	puyu: {
		name: "ぷゆゆトイズ",
		short: "ぷゆゆ",
		start: 340,
		vol: 0.09,
		note: "ぬいぐるみ。当たるとでかい",
		up: ["ぷゆゆトイズ、金のぷゆゆ\nぬいぐるみが海外で大人気"],
		down: ["ぷゆゆトイズ、新作が\n「顔がちがう」と炎上"],
	},
	pan: {
		name: "パン松製パン",
		short: "パン松",
		start: 610,
		vol: 0.05,
		dividend: 0.002,
		note: "六枚切りの食パン。手堅い",
		up: ["パン松製パン、麻婆食パンが\nコンビニで定番入り"],
		down: ["パン松製パン、八枚切りと\n六枚切りの袋をまちがえる"],
	},
	hoshu: {
		name: "保守電力",
		short: "保守電",
		start: 1500,
		vol: 0.02,
		dividend: 0.005,
		note: "村の電気。ほとんど動かない",
		up: ["保守電力、発電所の点検が\n予定より早く終わる"],
		down: ["保守電力、送電線に\nカラスの巣。一時停電"],
	},
	zero: {
		name: "ゼロ会計システム",
		short: "ゼロ会計",
		start: 950,
		vol: 0.07,
		note: "帳簿のソフト。新しもの好き向け",
		up: ["ゼロ会計、帳簿ソフトの\n新版が好評。「数えるのが楽」"],
		down: ["ゼロ会計、新版にバグ。\n「おかえり」がゼロになる"],
	},
	kyudan: {
		name: "おんJ球団",
		short: "球団",
		start: 480,
		vol: 0.1,
		note: "勝てば上がる。負ければ……",
		up: ["おんJ球団、10連勝。\nファンの実況スレが1000"],
		down: ["おんJ球団、10連敗。\n実況スレがお通夜"],
	},
	kusa: {
		name: "草コイン「ンゴ」",
		short: "ンゴ",
		start: 12,
		vol: 0.3,
		note: "仮想通貨。だれも中身を知らない",
		up: ["ンゴ、なぜか急騰。\n「ガチホ勝利」の書きこみ"],
		down: ["ンゴ、なぜか暴落。\n「養分乙」の書きこみ"],
	},
};

export const STOCK_IDS = Object.keys(STOCKS) as StockId[];

/** 株価の 下限（円。0には ならない）。 */
export const STOCK_FLOOR = 1;
/** ニュースの 出る 帰りの 割合と、出た ときの 動き（割合）。 */
export const NEWS_CHANCE = 0.6;
export const NEWS_MOVE = [0.12, 0.3] as const;
/** 履歴に 残す 帰りの 数（グラフ）。 */
export const STOCK_HISTORY = 24;
/** 何回 ぶんまで まとめて 動かすか（長く 来なかった とき）。 */
export const STOCK_CATCHUP = 12;

/** 0〜1 の 乱数（mulberry32）。 */
export const rng = (seed: number): (() => number) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** ふつうの 分布の 乱数（Box-Muller）。 */
export const gauss = (r: () => number): number => {
	const u = Math.max(1e-9, r());
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
};

export type StockNews = { id: StockId; up: boolean; text: string };

/**
 * 1回の 帰りぶん 株価を 動かす（seed は 帰りの 番号。同じ 帰りは 同じ 動き）。
 * ふだんは 平均 0 の ゆれ（vol）、ニュースの 銘柄は さらに NEWS_MOVE の 幅で 上か 下へ。
 */
export const priceStep = (
	prices: Record<StockId, number>,
	seed: number,
): { prices: Record<StockId, number>; news: StockNews | null } => {
	const r = rng(seed * 7919 + 17);
	const out = { ...prices };
	for (const id of STOCK_IDS) {
		const d = STOCKS[id];
		// 平均が 0 に なる よう −vol²/2 を 足す（長く 持っても 増えも 減りも しない）
		const k = Math.exp(gauss(r) * d.vol - (d.vol * d.vol) / 2);
		out[id] = Math.max(STOCK_FLOOR, Math.round(prices[id] * k));
	}
	let news: StockNews | null = null;
	if (r() < NEWS_CHANCE) {
		const id = STOCK_IDS[Math.floor(r() * STOCK_IDS.length)] ?? "puyu";
		const up = r() < 0.5;
		const m = NEWS_MOVE[0] + r() * (NEWS_MOVE[1] - NEWS_MOVE[0]);
		out[id] = Math.max(
			STOCK_FLOOR,
			Math.round(out[id] * (up ? 1 + m : 1 / (1 + m))),
		);
		const list = up ? STOCKS[id].up : STOCKS[id].down;
		news = { id, up, text: list[Math.floor(r() * list.length)] ?? "" };
	}
	return { prices: out, news };
};

export const startPrices = (): Record<StockId, number> =>
	Object.fromEntries(STOCK_IDS.map((id) => [id, STOCKS[id].start])) as Record<
		StockId,
		number
	>;

// ───────────────── デイトレ ─────────────────

export const DAY = {
	/** 場の 長さ（秒）。9時〜15時を 縮めた もの。 */
	seconds: 60,
	/** 値が 動く 間隔（秒）。 */
	tick: 0.25,
	/** 1tick の ゆれ（割合）。 */
	vol: 0.006,
	/** 流れ（上げ・下げ）が かわる 平均の 秒。 */
	regime: 8,
	/** 流れの 強さ（1tick あたりの 割合）。 */
	drift: 0.001,
	/** 材料（急な 動き）の 出る 割合（1秒あたり）と 幅。 */
	jump: 0.03,
	jumpSize: [0.03, 0.08] as const,
	/** 1回の 売買の 手数料（円）。 */
	fee: 50,
	/** 元手の えらびかた（円）。 */
	stakes: [5000, 20000, 100000] as const,
};

// ───────────────── FX ─────────────────

export const FX = {
	/** はじめの レート（ドル円）。帰りごとに 少し ずれる。 */
	start: 150,
	/** 場の 長さ（秒）。 */
	seconds: 90,
	tick: 0.2,
	/** 1tick の ゆれ（円）。 */
	vol: 0.018,
	regime: 10,
	drift: 0.0015,
	/** 指標発表（雇用統計）：場の なかほどで 1回、大きく 動く（円）。 */
	shock: [0.6, 1.8] as const,
	/** 指標の 出る 秒（の 幅）。 */
	shockAt: [30, 70] as const,
	/** スプレッド（円。買いと 売りの 差）。 */
	spread: 0.004,
	/** 証拠金維持率が これを 下まわると ロスカット（割合）。 */
	losscut: 0.5,
	/** レバレッジ（倍）。100倍より 上は 海外口座（ゼロカット）。 */
	levers: [1, 5, 25, 100, 1000] as const,
	/** 証拠金（円）。 */
	margins: [5000, 20000, 100000] as const,
};

// ───────────────── 文 ─────────────────

export const TRADE_MSG = {
	/** 端末（家の パソコン・ネットカフェ・支店の 端末）。{cash} 口座の 残高。 */
	terminal: "おんJ証券につないだ。（口座　{cash}）\n「投資は自己責任で」",
	/** 口座が まだ ない ときの 端末。 */
	noAccount: "「口座をお持ちでない方は\n商店街支店で開設を」",
	/** はじめて つないだ ときだけ（株価は 冒険から 帰る たびに 動く）。 */
	howPrices: "株価は、冒険から帰るたびに動く。\n配当もそのとき口座に入る。",
	menu: ["株", "デイトレ", "FX", "やめる"],
	// 株
	stockTitle: "株（持ち株の評価　{value}）",
	/** 一覧の 2行目（{pl} 買った ときからの 含み損益の 合計）。 */
	stockSub: "口座　{cash}　含み　{pl}",
	/** 一覧の 行の 下（持っている 銘柄）。 */
	stockHeld: "{n}株含み　{pl}",
	/** ニュースの 前置き（次の 窓が ニュースの 文）。 */
	news: "【おんJ証券ニュース】",
	dividend: "配当が口座に入った。（+{price}）",
	stockAsk: "{name}　{price}／株\n持ち株　{n}株",
	/** 持っている ときの stockAsk（{cost} 買値の 平均・{pl} 含み損益）。 */
	stockAskHeld: "{name}　{price}／株\n{n}株買値　{cost}　含み　{pl}",
	stockMenu: ["買う", "売る", "やめる"],
	buyHow: "何株買う？（口座　{have}）",
	sellHow: "何株売る？（{n}株持っている）",
	bought: "{name}を{n}株買った。（−{price}）",
	sold: "{name}を{n}株売った。（+{price}）\n{net}",
	short: "口座のお金がたりない。（{have}）\n入金はATMか支店の窓口で。",
	none: "持っていない。",
	gain: "買ったときより　{price}の得。",
	loss: "買ったときより　{price}の損。",
	even: "とんとん。",
	// デイトレ・FX の 前
	pickStock: "どの銘柄でデイトレ？",
	stakeAsk: "元手はいくら？（口座　{have}）",
	stakeShort: "口座のお金がたりない。\n（{price}から。口座　{have}）",
	leverAsk: "レバレッジは？\n（100倍より上は海外口座）",
	marginAsk: "証拠金はいくら？（口座　{have}）",
	high: "……ハイレバ。\n1円動けば証拠金が消える。",
	// おわり
	result: "{head}\n差し引き　{net}",
	win: "{price}の勝ち",
	lose: "{price}の負け",
	zero: "±0",
	losscut: "とちゅうでロスカットされた。\n……ハイレバはこわい。",
	zerocut: "ゼロカット。\n……証拠金はぜんぶとけた。",
	back: "口座に{price}もどった。",
} as const;

/** 入れる・出す 額の 候補（円。手もと・口座に ある 分だけ 出す。ほかに のこり ぜんぶも 選べる）。 */
export const CASH_STEPS = [1000, 5000, 10000, 50000, 100000] as const;

/**
 * 口座（商店街支店の 窓口で 開設。おんJマートの ATM と 窓口で 入金・出金。ui/trade/trade.ts）。
 * {cash} 口座の 残高・{have} 手もと・{price} 額・{value} 持ち株の 評価。
 */
export const ACCOUNT_MSG = {
	/** 窓口（口座が まだ ない）。 */
	welcome: "「いらっしゃいませ。\nおんJ証券商店街支店です」",
	openAsk: "「口座の開設ですか？\n手数料はかかりません」",
	openMenu: ["口座を作る", "やめる"],
	idCheck: "「本人確認の書類をお願いします」\n……キリコは住民票を出した。",
	careerAsk: "「投資のご経験は？」",
	careerMenu: ["ない", "ある", "スレで見た"],
	/** careerMenu の 答えごと。 */
	career: [
		"「はじめての方も大歓迎です」",
		"「それは心づよいです」",
		"「……スレはご経験に入りません」",
	],
	risk: "「株・FXは元本割れの\nおそれがあります。よろしいですか」",
	agreeMenu: ["同意する", "やめる"],
	opened: "口座ができた。\nキャッシュカードを受けとった。",
	nevermind: "「またのお越しを」",
	/** 窓口（口座が ある）。 */
	window: "「いらっしゃいませ。\n入金・出金うけたまわります」",
	/** ATM（おんJマート）。 */
	atm: "ATM。\n「おんJ証券提携入金・出金」",
	noCard: "キャッシュカードがない。\n（口座は商店街支店で作れる）",
	menu: ["入金", "出金", "残高", "やめる"],
	depositAsk: "いくら入れる？（手もと　{have}）",
	withdrawAsk: "いくら出す？（口座　{cash}）",
	all: "ぜんぶ　{price}",
	noWallet: "手もとにお金がない。",
	noCash: "口座にお金がない。",
	deposited: "{price}　入金した。\n口座　{cash}",
	withdrew: "{price}　出金した。\n口座　{cash}",
	balance: "口座　{cash}\n持ち株の評価　{value}",
} as const;

/**
 * はじめての 人への 説明（2026-10-15 作者：「はじめて 利用する 初心者の ために ガイドとか 必要そう」）。
 * 口座を 作った すぐ あとの 係の 流れ・支店の パンフの 棚（いつでも 読める）・デイトレと FX を はじめて 遊ぶ 前（1回だけ）。
 */
export const TRADE_GUIDE = {
	/** 口座を 作った すぐ あとの 係（入金 → 売り買い の 流れ）。 */
	afterOpen: [
		"「まずATMかこの窓口で\n口座にお金を入れてください」",
		"「売り買いはこの店の端末・\nネットカフェ・お家のパソコンで」",
		"「わからないときは入口の\nパンフレットをどうぞ」",
	],
	/** パンフの 棚（調べると topics から えらぶ）。 */
	topics: ["口座とお金", "株", "デイトレ", "FX", "やめる"],
	/** topics の 順の 中身（窓ごと）。 */
	pages: [
		[
			"【口座とお金】\n売り買いは口座のお金でする。",
			"入金・出金はおんJマートのATMか\n支店の窓口で。財布とはべつ。",
			"損をしてもへるのは口座だけ。\n冒険の強さには関係ない。",
		],
		[
			"【株】\n村の店の株を1株から買える。",
			"株価は冒険から帰るたびに動く。\nニュースが出ると大きく動く。",
			"常識堂・パン松・保守電は配当つき。\n持っていると帰るたびに口座へ。",
		],
		[
			"【デイトレ】\n銘柄を1つえらんで60秒の勝負。",
			"A　で買って、もう1回A　で売る。\n安く買って高く売れば勝ち。",
			"売り買い1回ごとに手数料50円。\n動かしすぎるとへっていく。",
		],
		[
			"【FX】\nドルと円の90秒の勝負。",
			"上がると思えば→で買い、\n下がると思えば←で売り。Aで決済。",
			"レバレッジは証拠金の何倍で\n勝負するか。大きいほどゆれも大きい。",
			"維持率が50%を切るとロスカット。\n……はじめは1倍か5倍で。",
		],
	],
	/** デイトレを はじめて 遊ぶ 前（1回だけ）。 */
	firstDay: [
		"……はじめてのデイトレ。\n60秒で買って売る勝負だ。",
		"A　で買い、もう1回A　で売る。\n1回ごとに手数料50円。",
	],
	/** FX を はじめて 遊ぶ 前（1回だけ）。 */
	firstFx: [
		"……はじめてのFX。\n→で買い、←で売り、Aで決済。",
		"倍率が高いほどすぐロスカット。\nはじめは1倍か5倍が無難。",
	],
} as const;

/** デイトレの 板の 文（帯は 13字・下の 行は 22字まで）。 */
export const DAY_TEXT = {
	title: "デイトレ",
	hint: "A／タップ買う・売るB×2　やめる",
	note: "安く買って、高く売る。",
	open: "寄り付き",
	close: "大引け",
	bought: "買い！　{price}",
	sold: "売り！　{net}",
	hold: "持ち株　{n}株",
	cash: "余力",
	jumpUp: "材料キター！",
	jumpDown: "悪材料……",
} as const;

/** FX の 板の 文。 */
export const FX_TEXT = {
	title: "FX　ドル円",
	hint: "←売り→買いA決済B×2やめる",
	note: "←で売り、→で買い、A　で決済。",
	long: "買い　{lot}",
	short: "売り　{lot}",
	none: "ノーポジ",
	shock: "【指標発表】米雇用統計",
	losscut: "ロスカット！",
	zerocut: "ゼロカット！",
	ratio: "維持率",
	lever: "{lever}倍",
} as const;

/** 板の 横の ひとこと（2ch の 実況ふう。ときどき 下の 行に 出る）。 */
export const TRADE_CHATTER = {
	up: ["ガチホ勝利", "握力つよすぎ", "全力イナゴ", "ほぼストップ高"],
	down: ["養分乙", "損切りできない民", "含み損は損じゃない", "ナンピンや"],
	flat: ["動かんな", "ヨコヨコ", "様子見"],
} as const;
