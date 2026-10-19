// スタッフロール（最終話「盛るまでもない」を はじめて 持ち帰った ときの 語りの あと。ui/village/villageReturn.ts の returnScene）。
// 前半は 町の 配役（役は 最終話の 祭りに 来た 人と 町の 人）、後半は README.md の「クレジット」と 同じ 中身。
// README の クレジットを 書きかえたら ここも 合わせる。やきうは 名乗らない（STORY.md §4.9「……名無しの　や」）ので 見出しは 名無し。
// 締めは 後日談（古井戸の 板。底に フェリスの 生まれの レスが 眠る）への 音だけ（STORY.md「最終話 → 後日談は 古井戸の 音で 足りる」）。

/** ロールの 1かたまり（見出しと 名前。役の ない かたまりは 名前だけ）。 */
export type StaffBlock = { role?: string; names: readonly string[] };

export const STAFF_TITLE = "蓄音キリコの板めぐり";

export const STAFF_ROLL: readonly StaffBlock[] = [
	{ role: "主演", names: ["蓄音キリコ"] },
	{
		role: "共演",
		names: [
			"束音ロゼ",
			"革命シヨ",
			"解音ゼロ（メインさん・プロト・レン）",
			"フェリス",
		],
	},
	{ role: "書きこみ", names: ["名無し"] },
	{ role: "パン", names: ["ぷゆゆ"] },
	{ role: "倉庫", names: ["ンゴ姉"] },
	{ role: "買い取り", names: ["ジェイトルマン"] },
	{
		role: "祭りに来た人",
		names: ["パン兵", "きのこ軍", "42℃の番頭", "電池ニキ"],
	},
	{ role: "鯖代", names: ["管理人（払い忘れ）"] },
	{
		role: "蓄音キリコ",
		names: [
			"© おーぷん2ちゃんねる有志",
			"音声：野良",
			"キャラクター：釣りンゴ",
			"ロゴ：ロゴ太郎",
		],
	},
	{ role: "束音ロゼ", names: ["音声：面倒ミル", "キャラクター：wQ8G"] },
	{
		role: "革命シヨ",
		names: ["© おんJ／おーぷん2ちゃんねる有志", "（安価スレ生まれ）"],
	},
	{
		role: "解音ゼロ",
		names: [
			"© おんJ／おーぷん2ちゃんねる有志",
			"メインさん：手描き",
			"プロト・レン：AI生成",
		],
	},
	{
		role: "春音リノ",
		names: ["© おんJ／おーぷん2ちゃんねる有志", "（安価で作ったONJLOID）"],
	},
	{
		role: "響化アル",
		names: ["音声：アルトカ", "キャラクター：しと ほか", "ロゴ：ロゴ太郎"],
	},
	{ role: "フェリス・やきう", names: ["なんJ・おんJのみんな"] },
	{
		role: "原案・ディレクター",
		names: ["キャラクターイラスト・音楽", "このゲームの作者"],
	},
	{
		role: "シナリオ・ゲームデザイン",
		names: [
			"プログラム・デバッグ",
			"Claude Code（Claude Opus 5.5・Claude Fable 5.1）",
		],
	},
	{ role: "素材提供", names: ["RPGEN（rpgen-search）"] },
	{ role: "音楽・音声合成", names: ["@onjmin/dtm", "koe UtauTTS"] },
	{ role: "フォント", names: ["DotGothic16"] },
	{ names: ["そして、書きこんでくれた", "名無しのみんな"] },
];

/** 題の 下に 出る 締めの 一行（後日談の 古井戸）。 */
export const STAFF_AFTER = "古井戸の底から、「ふぇ…」と聞こえた。";
