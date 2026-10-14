// おんJ証券（2026-10-14 作者：「株・デイトレード・FX や その他 金策も 導入したい。デイトレ・FX は ミニゲーム化」
// 「FX は ハイレバ・ロスカットも 入れると 没入感 上がりそう」）。
// - 株：村の 店の 株（STOCKS）を 1株から 買って 持ち、売る。値は 冒険から 帰る たびに 1回 動く（priceStep）。
//   ニュースが 出た 銘柄は 大きく 動く。配当の ある 銘柄は 帰る たびに 持ち株に 応じて 少し 入る。
// - デイトレ：銘柄を 1つ えらんで 元手を 入れ、場（60秒）の あいだに 買って 売る（ui/trade/dayTrade.ts）。
// - FX：ドル円。レバレッジ（1〜1000倍）と 証拠金を えらび、買い・売りで 持って 決済（ui/trade/fx.ts）。
//   証拠金維持率が LOSSCUT を 下まわると 強制決済（ロスカット）。急な 動きで 証拠金より 負けても ゼロカット（財布は マイナスに しない）。
// お金は 財布（engine/wallet.ts）から 出して、終わったら もどす。強さには 何も 効かない。
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
		note: "ロゼの　店。麻婆豆腐は　毎日　同じ　味",
		up: ["常識堂、麻婆豆腐の\n冷凍版が　品切れ　続出"],
		down: ["常識堂、花椒の　仕入れ値が\n高騰。……辛さは　そのまま"],
	},
	puyu: {
		name: "ぷゆゆトイズ",
		short: "ぷゆゆ",
		start: 340,
		vol: 0.09,
		note: "ぬいぐるみ。当たると　でかい",
		up: ["ぷゆゆトイズ、金の　ぷゆゆ\nぬいぐるみが　海外で　大人気"],
		down: ["ぷゆゆトイズ、新作が\n「顔が　ちがう」と　炎上"],
	},
	pan: {
		name: "パン松製パン",
		short: "パン松",
		start: 610,
		vol: 0.05,
		dividend: 0.002,
		note: "六枚切りの　食パン。手堅い",
		up: ["パン松製パン、麻婆食パンが\nコンビニで　定番入り"],
		down: ["パン松製パン、八枚切りと\n六枚切りの　袋を　まちがえる"],
	},
	hoshu: {
		name: "保守電力",
		short: "保守電",
		start: 1500,
		vol: 0.02,
		dividend: 0.005,
		note: "村の　電気。ほとんど　動かない",
		up: ["保守電力、発電所の　点検が\n予定より　早く　終わる"],
		down: ["保守電力、送電線に\nカラスの　巣。一時　停電"],
	},
	zero: {
		name: "ゼロ会計システム",
		short: "ゼロ会計",
		start: 950,
		vol: 0.07,
		note: "帳簿の　ソフト。新しもの好き　向け",
		up: ["ゼロ会計、帳簿ソフトの\n新版が　好評。「数えるのが　楽」"],
		down: ["ゼロ会計、新版に　バグ。\n「おかえり」が　ゼロに　なる"],
	},
	kyudan: {
		name: "おんJ球団",
		short: "球団",
		start: 480,
		vol: 0.1,
		note: "勝てば　上がる。負ければ……",
		up: ["おんJ球団、10連勝。\nファンの　実況スレが　1000"],
		down: ["おんJ球団、10連敗。\n実況スレが　お通夜"],
	},
	kusa: {
		name: "草コイン「ンゴ」",
		short: "ンゴ",
		start: 12,
		vol: 0.3,
		note: "仮想通貨。だれも　中身を　知らない",
		up: ["ンゴ、なぜか　急騰。\n「ガチホ　勝利」の　書きこみ"],
		down: ["ンゴ、なぜか　暴落。\n「養分　乙」の　書きこみ"],
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
	/** 端末（家の パソコン・おんJマートの ATM）。 */
	terminal: "おんJ証券に　つないだ。\n「投資は　自己責任で」",
	/** はじめて つないだ ときだけ（株価は 冒険から 帰る たびに 動く）。 */
	howPrices: "株価は、冒険から　帰る　たびに　動く。\n配当も　そのとき　入る。",
	menu: ["株", "デイトレ", "FX", "やめる"],
	// 株
	stockTitle: "株　（持ち株の　評価　{value}）",
	/** ニュースの 前置き（次の 窓が ニュースの 文）。 */
	news: "【おんJ証券　ニュース】",
	dividend: "配当が　入った。（+{price}）",
	stockAsk: "{name}　{price}／株\n持ち株　{n}株",
	stockMenu: ["買う", "売る", "やめる"],
	buyHow: "何株　買う？（手もと　{have}）",
	sellHow: "何株　売る？（{n}株　持っている）",
	bought: "{name}を　{n}株　買った。（−{price}）",
	sold: "{name}を　{n}株　売った。（+{price}）\n{net}",
	short: "お金が　たりない。（手もと　{have}）",
	none: "持っていない。",
	gain: "買った　ときより　{price}の　得。",
	loss: "買った　ときより　{price}の　損。",
	even: "とんとん。",
	// デイトレ・FX の 前
	pickStock: "どの　銘柄で　デイトレ？",
	stakeAsk: "元手は　いくら？（手もと　{have}）",
	stakeShort: "お金が　たりない。\n（{price}から。手もと　{have}）",
	leverAsk: "レバレッジは？\n（100倍より　上は　海外口座）",
	marginAsk: "証拠金は　いくら？（手もと　{have}）",
	high: "……ハイレバ。\n1円　動けば　証拠金が　消える。",
	// おわり
	result: "{head}\n差し引き　{net}",
	win: "{price}の　勝ち",
	lose: "{price}の　負け",
	zero: "±0",
	losscut: "とちゅうで　ロスカット　された。\n……ハイレバは　こわい。",
	zerocut: "ゼロカット。\n……証拠金は　ぜんぶ　とけた。",
	back: "{price}が　もどってきた。",
} as const;

/** デイトレの 板の 文（帯は 13字・下の 行は 22字まで）。 */
export const DAY_TEXT = {
	title: "デイトレ",
	hint: "A／タップ　買う・売る　B×2　やめる",
	note: "安く　買って、高く　売る。",
	open: "寄り付き",
	close: "大引け",
	bought: "買い！　{price}",
	sold: "売り！　{net}",
	hold: "持ち株　{n}株",
	cash: "余力",
	jumpUp: "材料　キター！",
	jumpDown: "悪材料……",
} as const;

/** FX の 板の 文。 */
export const FX_TEXT = {
	title: "FX　ドル円",
	hint: "←売り　→買い　A決済　B×2やめる",
	note: "←で　売り、→で　買い、A　で　決済。",
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
	up: ["ガチホ　勝利", "握力　つよすぎ", "全力　イナゴ", "ほぼ　ストップ高"],
	down: [
		"養分　乙",
		"損切り　できない　民",
		"含み損は　損じゃない",
		"ナンピン　や",
	],
	flat: ["動かんな", "ヨコヨコ", "様子見"],
} as const;
