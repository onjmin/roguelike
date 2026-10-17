// おんJ銀行（2026-10-15 作者：「銀行という 建物施設も 欲しい」）。東の 商店街の 南（段5〜）。
// 財布の お金は 冒険で なくならないので、預かる だけの 銀行は 作らない。窓口で できる ことは 2つ：
// - 定期預金：預けた お金に 冒険から 帰る たび BANK_RATE の 利息（BANK_CAP まで）。引き出しは いつでも 手数料なし。
// - 家の ローン：繰り上げ返済（月の 返済は いつもどおり 帰りに 財布から。ui/village/myhome.ts）。
// 強さには 何も 効かない（財布の 使い道は 本編に 関係ない 物だけ。engine/wallet.ts）。決まりは ui/trade/bank.ts。

/** 1回の 帰りの 利息（預金に 対する 割合）。 */
export const BANK_RATE = 0.01;
/** 利息が つく 預金の 上限（円。これを こえた ぶんには つかない）。 */
export const BANK_CAP = 300000;
/** まとめて 数える 帰りの 上限（長く 来なかった ときの 利息）。 */
export const BANK_CATCHUP = 12;

export const BANK_MSG = {
	welcome: "「いらっしゃいませ。\nおんJ銀行です」",
	menu: ["定期預金", "家のローン", "やめる"],
	saveMenu: ["預ける", "引き出す", "残高", "やめる"],
	rate: "「定期預金は冒険からお帰りになる\nたびに{rate}の利息がつきます」",
	cap: "「利息がつくのは{cap}までの\nぶんです。引き出しはいつでもどうぞ」",
	interest: "「前にいらしてから\n利息が{price}つきました」",
	depositAsk: "いくら預ける？\n（財布　{have}）",
	deposited: "{price}　預けた。\n（定期　{saved}）",
	withdrawAsk: "いくら引き出す？\n（定期　{saved}）",
	withdrew: "{price}　引き出した。\n（定期　{saved}）",
	all: "ぜんぶ　{price}",
	noWallet: "財布がからっぽだ。",
	noSaved: "定期預金はまだない。",
	balance: "定期預金　{saved}。\nこれまでの利息　{earned}。",
	noHome: "「住宅ローンのご契約は\nございませんね」",
	loanDone: "「ローンは完済されています。\n……おめでとうございます」",
	loanLeft: "「ローンの残りは{n}か月、\n{price}です」",
	late: "「{n}か月ぶんとどこおっています。\nまずそちらからお返しします」",
	prepayAsk: "「繰り上げ返済なさいますか？」",
	prepayMenu: ["1年分　{y1}", "5年分　{y5}", "ぜんぶ　{all}", "やめる"],
	prepaid: "{price}　返した。\n残り　{n}か月。",
	short: "財布が足りない。",
} as const;
