// 保守村の 小さな 名物（folk）：村の はしの 名無したち・機能の 墓場・本館／図書館／銭湯の すみの 小ネタの 文と 決まり。
// DOM も 保存も 使わない（src/sim/folkTests.ts が そのまま 読む）。置き場所は data/village/folk.ts、
// 話し方（帰りごとに 1つ 進む・保存）は ui/folk.ts。どれも 寄り道で、強さ・道具・売上・町の 段には ふれない。
//
// 出どころ（おんJwiki 3代目 https://w.atwiki.jp/openj3/pages/N.html と おーぷんの 過去ログ。書きこみは パブリックドメイン）：
//   ひらがなニキ     … pages/159。完走版「ワイの好きなひらがなランキングｗｗｗｗｗｗ」（livejupiter/1472221715）の 1〜48位と
//                      毎日の「選出理由」（短く した）・忘れた 日の「また忘れたンゴ……」・>>185「次は好きな万葉仮名ランキング」。
//                      2位の「ぷ」は >>6 の べつの 人の まね（>>9 で イッチが「濁音半濁音は除外」と 言った）を イッチの
//                      言いまちがいに した。48位の あとは 元祖「…TOP100000000000000000000000」（2016/5/20）の「う」「ぅ」
//                      （イッチも >>20 で「うに親を殺されたニキ」と 元祖を 知っている）
//   なぞなぞ仮面     … 「なぞなぞ仮面ワイからの挑戦」（livejupiter/1791466138）の 1問め（ずぶ濡れの ケーキ）と 型
//                      （🎭不正解・🎭？・だめだ 発表する）、ロバの なぞなぞ（livejupiter/1790859776）の 型。ほかの 問題は 新しく 書いた
//   人工無能ニキ     … pages/285（アイディアを 欲しがるが 形に しない・良いね／それいいかもしれない／なるほど／うーん・
//                      ワイは天才・パクられると嫌なので公開しない・連載完結は 最低10年後）
//   バルス失敗ニキ   … pages/391・393（忍法帖の レベル不足・【罪状】partスレは バルスできぬいの刑（レベルが 1 下がる）・
//                      2024/5 削除 → 2026/8/20 復活「再開てすと中」）。空飛ぶ鯖（data/jikkyo/sora.ts）の 字の あけ方に そろえた
//   おどるほうせき   … pages/25（(の)ヮ(の)・おどちゃん・語尾 みゃあ・口ぐせ 神は私の力です（はじめは きうり）・流行らなかった）
//   モフちゃん       … pages/245（板トップの ドット絵。きうりを かじる。ファイル名 mohu.v2・日に日に 少しずつ かわる）
//   機能の墓場       … pages/157（冒頭の 一文・ロリード・草ボタン・タグ機能の 弔辞・弾幕機能の 版・GPS・イイ！ボタン・
//                      バルス・!okpic）。ピアノ機能（kome）は 音楽室の 供養の 札（data/rooms.ts）に あるので 墓に しない
//   温泉卵           … pages/312（七不思議レス >>1「くそ滑稽ｗ」>>2「温泉卵的な？」と 考察 >>20・>>27・>>30・>>38。答えは 出ない）
//   1レス博物館      … pages/20（1レスおんＪ＝糞スレ博物館）。展示の 題は 新しく 書いた
//   ダジャレニキ     … pages/59 の 型「そうそう〇〇……って それは ××やないかーい！ｗｗ」。だじゃれは 新しく 書いた（data/village/crowd.ts）
//
// 文の 決まり：1行 全角22字（半角 0.5）・2行まで。絵文字の 行は 21字まで。キリコは しゃべらない（地の文・選択肢だけ）。
// スレは 沈む（落ちない）。実在の 人・会社・製品・サイト名は 出さない（管理人の 名も 出さない）。

// ───────────────── 名前欄 ─────────────────

export const FOLK_NAMES = {
	hira: "ひらがなニキ",
	nazo: "なぞなぞ仮面",
	odoru: "おどちゃん",
	idea: "人工無能ニキ",
} as const;

/** バルス失敗ニキの 名前欄（忍法帖の レベルを 出す）。 */
export const balusName = (lv: number): string => `■忍法帖【Lv=${lv}】`;

// ───────────────── ひらがなニキ（帰りごとに 1つ） ─────────────────

/** 完走版の 順位（1位 → 48位）。 */
export const HIRA_RANKS =
	"ぬねきしるあとみよもすゆれのうたくめけへてにかまつらせおそなはろむふりゑやほちわいゐこえんさをひ";

/** 元祖の スレの 1位（10の 23乗位）。 */
export const HIRA_BOTTOM = 10n ** 23n;

export const HIRA = {
	/** いちばん はじめに 話した とき（1回だけ）。 */
	intro: "ワイの　好きな　ひらがな\nランキング、発表していくで",
	/** 同じ 帰りに もう一度。 */
	again: "今日は　ここまで　言うたやろ",
	/** 2位の「ぷ」（言いかけて やめる）。 */
	pu: "第2位　ぷ……",
	/** 2位の 取り消し（濁音・半濁音は 数えない。元スレ >>9）。 */
	retract: "……ちゃうわ、半濁音は　除外やった。\n今日は　ここまで",
	/** 2位の ね の あとに（1位から 発表した。元スレの >>14）。 */
	from48: "……48位から　発表した　ほうが\nよかったかな",
	/** 47位の あとに（元スレの >>178）。 */
	ahead: "いよいよ　明日は　最下位　発表やで！",
	/** 48位（元スレの >>180 の まま）。 */
	last: "第48位　ひ\n今日は……というか　このスレは　ここまで",
	/** 48位の あとに（元スレの >>185）。 */
	manyo: "……次は　好きな　万葉仮名\nランキングでも　やったるかな",
	/** 元祖の「う」の あとに。 */
	afterU: "……「う」に　恨みは　ない。\nほんまや",
} as const;

/** 毎日の 選出理由（元スレの まま 短く した もの。20位 へ・22位 に は 出さない）。 */
export const HIRA_WHY: Readonly<Record<number, string>> = {
	1: "『め』かと　思ったら　最後に　トラップ",
	2: "トラップを　かいくぐる　メンタルが　好き",
	3: "裏返しても　読みまちがえない",
	4: "行書だと　縦線1本。シンプル",
	5: "『ろ』との　トラップが　高評価",
	6: "適当に　書いても　バランスが　とれる",
	7: "『〜というと？』に　引っかけられそう",
	8: "形が　かわいいから",
	9: "形が　ひ『よ』こみたいで　可愛いから",
	10: "丸っこくて　抱きたく　なる　形",
	11: "すらすら　書きやすい（個人の　感想です）",
	12: "『す』と　同様（個人の　感想です）",
	13: "左下と　右上の　バランスが　いい　感じ",
	14: "なんとなく　かわE",
	15: "『う』を　言う　ときの　顔に　似ている",
	16: "なんとなく　バランスが　いい　感じ",
	17: "くの字・くノ一……自虐ネタが　ピカイチ",
	18: "なんとなく　目の　形に　見えるから",
	19: "簡単に　書けて　バランスも　取りやすい",
	21: "なんとなく『手』相の　形に　似てるから",
	23: "書いてて　楽しい",
	24: "3画目に　ひねる　ところが　辛うじて　好き",
	25: "なんとなく『つ』り針っぽいから",
	26: "書き方に　よっては『ろ』と　紛らわしい",
	27: "なんとなく　書くのが　めんどくさい",
	28: "おんJでも　おまけスレなどで　活躍中",
	29: "1画か　2画か　はっきり　せいや",
	30: "右上の　点の　せいで　バランスが　悪い",
	31: "『は？』と　書くと　煽りに　見える",
	32: "手で　書くと『3』と　紛らわしい",
	33: "書く　時の　バランスが　とりにくい",
	34: "もふもふ　可愛いのに　書きにくいんじゃあ",
	35: "急いでいると『い』と　間違いやすい",
	36: "形が　特徴的で　間違いにくい",
	37: "読んだ　時の　響きが『嫌』",
	38: "発音しにくい",
	39: "『さ』の　裏返しに　見える……ことも　ある",
	40: "書き方に　よっては『ゆ』と　紛らわしい",
	41: "『り』にも『11』にも　似ている",
	42: "下の　ほうに　間延び　してしまう",
	43: "『て』や『二』と　紛らわしい",
	44: "書いている　うちに『之』に　なってしまう",
	45: "いろいろ　言いたい　ことは　ある",
	46: "なんで　2画目と　3画目　離したり　すんねん",
	47: "形が　キモい",
	48: "書きにくいし　何の　とりえも　ない",
};

/** 話しかけずに 帰りを 飛ばした あとの ひとこと（元スレ >>133・>>154・>>166・>>171）。 */
export const HIRA_FORGOT = {
	one: ["昨日　忘れたンゴ……", "また　忘れたンゴ……"],
	two: [
		"ワイと　した　ことが\n2日連続で　忘れるとは……",
		"まーた　2日連続で\n忘れて　しまったンゴねぇ",
	],
} as const;

/** 飛ばした 帰りの 数（missed）→ ひとこと（k で 入れかわる。0 なら 無し）。 */
export const hiraForgot = (missed: number, k: number): string | null => {
	if (!(missed >= 1)) return null;
	const list = missed >= 2 ? HIRA_FORGOT.two : HIRA_FORGOT.one;
	return list[Math.abs(Math.floor(k)) % list.length];
};

const rankLine = (rank: string, ch: string): string =>
	`第${rank}位　${ch}\n……今日は　ここまで`;
const whyLine = (rank: number): string[] =>
	HIRA_WHY[rank] ? [`選出理由\n・${HIRA_WHY[rank]}`] : [];

/** 終わらない 番号に 出さない 数字（ほかの 意味に 読める もの）。 */
export const HIRA_AVOID = ["810", "1919", "114514", "0721", "4545", "893"];
const ENDLESS: bigint[] = [];
/** ぅ の あとの i 番目（0 から）の 番号（10の23乗 − 2 から 1つずつ 上がる。HIRA_AVOID を 含む 番号は とばす）。 */
export const hiraEndless = (i: number): bigint => {
	const want = Math.max(0, Math.min(Math.floor(i) || 0, 99999));
	let k = ENDLESS.length ? HIRA_BOTTOM - (ENDLESS.at(-1) as bigint) : 1n;
	while (ENDLESS.length <= want) {
		k += 1n;
		const r = HIRA_BOTTOM - k;
		if (!HIRA_AVOID.some((w) => String(r).includes(w))) ENDLESS.push(r);
	}
	return ENDLESS[want];
};

/**
 * n 回目（0 から）の 発表（窓ごと。1〜3窓）。0〜48 は 完走版（1 は「ぷ」の 言いかけ）で、選出理由が つく。
 * 49 は 元祖の「う」、50 は「ぅ」、そのあとは 番号だけ 1つずつ 上がって、字は 言わずに 終わる（終わらない）。
 */
export const hiraEntry = (n: number): string[] => {
	if (n <= 0) return [rankLine("1", HIRA_RANKS[0]), ...whyLine(1)];
	if (n === 1) return [HIRA.pu, HIRA.retract];
	if (n < 48) {
		const out = [rankLine(String(n), HIRA_RANKS[n - 1]), ...whyLine(n)];
		if (n === 2) out.push(HIRA.from48);
		if (n === 47) out.push(HIRA.ahead);
		return out;
	}
	if (n === 48) return [HIRA.last, ...whyLine(48), HIRA.manyo];
	if (n === 49) return [rankLine(String(HIRA_BOTTOM), "う"), HIRA.afterU];
	if (n === 50) return [rankLine(String(HIRA_BOTTOM - 1n), "ぅ")];
	return [`第${hiraEndless(n - 51)}位……\n……やっぱ　今日は　ここまで`];
};

// ───────────────── なぞなぞ仮面（帰りごとに 1問） ─────────────────

/**
 * ふつうの 問題は 洒落が 正解（pun）・まっすぐな 答えが 不正解（plain）・変な 答え（odd）。
 * ロバの 型（roba）は 洒落が わな（plain の 位置に 置く 洒落）で、ふつうの 答えが 正解。
 * options は 窓に 出す 順（正解の 場所を ばらす）。
 */
export type Riddle = {
	q: string;
	/** 選択肢（3つ。9字まで）。 */
	options: readonly [string, string, string];
	/** 正解の 番号。 */
	answer: number;
	/** 正解を 言う ときの 名前（選択肢に 入りきらない とき。無ければ 選択肢の まま）。 */
	say?: string;
	/** まっすぐな 答え（ふつうの 問題）・洒落の わな（ロバの 型）の 番号。 */
	plain: number;
	/** 正解の あとの ひとこと（「……〇〇　だけに」）。 */
	why: string;
	/** ロバの 型（洒落を えらぶと「〜だと 思った そこの お前」）。 */
	roba?: true;
	/** 変な 答えを えらんだ ときの 1窓（{answer} に 正解。無ければ NAZO.odd）。 */
	odd?: string;
};

export const RIDDLES: readonly Riddle[] = [
	{
		// 元スレの 1問め（>>1・>>3「🎭不正解」・>>11「🎭？」・>>19「だめだ　発表する」・>>23）
		q: "ずぶ濡れの　ケーキって\nな〜んだ？",
		options: ["ショートケーキ", "ウェッティング", "ずぶ濡れケーキ"],
		answer: 1,
		say: "ウェッティングケーキ",
		plain: 0,
		why: "……ウェット（ずぶ濡れ）だけに",
		odd: "🎭？……そんな　ケーキは　ない\n正解は『{answer}』",
	},
	{
		q: "1000レスまで　行った　スレが\nいちばん　好きな　おやつは？",
		options: ["お祝いの　ケーキ", "乾燥いも", "ぷゆゆパン"],
		answer: 1,
		plain: 0,
		why: "……完走（かんそう）だけに",
	},
	{
		q: "スレを　沈ませない　人が\nいちばん　好きな　料理は？",
		options: ["揚げ物", "保存食", "温泉卵"],
		answer: 0,
		plain: 1,
		why: "……age（あげ）だけに",
		odd: "🎭？……温泉卵的な？\n正解は『{answer}』",
	},
	{
		q: "すぐ　アク禁に　される\n野菜は？",
		options: ["トマト", "きうり", "ごぼう"],
		answer: 2,
		plain: 0,
		why: "……アクが　強い　だけに",
		odd: "🎭？……きうりに　アクは　ない\n正解は『{answer}』",
	},
	{
		q: "中身が　ないのに　のびている\nスレに　生える　植物は？",
		options: ["草", "サボテン", "コケ"],
		answer: 1,
		plain: 0,
		why: "……中身は　サボってん",
		roba: true,
	},
	{
		q: "1000レスを　さいごまで\n見とどけた　鳥は？",
		options: ["焼き鳥", "フクロウ", "チドリ"],
		answer: 2,
		plain: 1,
		why: "……千（ち）だけに",
	},
	{
		q: "スレ立てが　いちばん\n多い　季節は？",
		options: ["立春", "夏休み", "こたつ"],
		answer: 0,
		plain: 1,
		why: "……立つ　だけに",
	},
	{
		q: "おーぷんの　サーバーの\n中に　住んでいる　魚は？",
		options: ["サバ", "マグロ", "鯖缶"],
		answer: 2,
		plain: 0,
		why: "……鯖の　中に　住んどる　からな",
		roba: true,
	},
	{
		q: "スレに　書きこむのが\n大好きな　海の　生き物は？",
		options: ["カキ", "タコ", "きうり"],
		answer: 0,
		plain: 1,
		why: "……カキコ　だけに",
		odd: "🎭？……それは　畑や\n正解は『{answer}』",
	},
	{
		q: "キリ番を　ふんだ　人が\nもらえる　ものは？",
		options: ["キリコ", "キリ", "おめでとう"],
		answer: 2,
		plain: 1,
		why: "……ふつうに　めでたい",
		roba: true,
		odd: "🎭？……それは　お前や\n正解は『{answer}』",
	},
];

export const NAZO = {
	/** いちばん はじめ（1回だけ）。 */
	intro: "🎭なぞなぞ仮面　参上。\n……ワイからの　挑戦や",
	/** 2周め（問題が ひとまわり した あとの 1問め）。 */
	rerun: "……ネタ切れ　ちゃうで。\n再放送や",
	/** 答えた あとの 同じ 帰り。 */
	again: "次の　なぞなぞは、\nまた　こんど",
	/** やめた（同じ 帰りなら また 同じ 問題）。 */
	flee: "……逃げるのか。\nまた　来たまえ",
	/** まっすぐな 答え（外れ。答えも 言う）。 */
	wrong: "🎭不正解。……だめだ　発表する。\n正解は『{answer}』",
	/** 変な 答え（外れ。答えも 言う）。 */
	odd: "🎭？　……だめだ　発表する。\n正解は『{answer}』",
	right: "🎭正解！\n{why}",
	/** ロバの 型で 洒落を えらんだ（2窓）。 */
	robaTrap: "『{trap}』だと　思った\nそこの　お前……",
	robaTell: "🎭残念！　正解は『{answer}』\n{why}",
	/** ロバの 型で 正解を えらんだ。 */
	robaRight: "🎭……正解。なんで　わかったんや\n{why}",
	quit: "やめる",
} as const;

export type NazoPick = "right" | "plain" | "odd" | "quit";

/** 選んだ 番号 → 正解・まっすぐ（ロバでは わな）・変・やめる。 */
export const nazoPick = (r: Riddle, k: number): NazoPick =>
	k === r.answer
		? "right"
		: k === r.plain
			? "plain"
			: k >= 0 && k < r.options.length
				? "odd"
				: "quit";

const fillIn = (t: string, v: Record<string, string>): string =>
	t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");

/** 正解の 名前（窓で 言う 形）。 */
export const riddleAnswer = (r: Riddle): string => r.say ?? r.options[r.answer];

/**
 * 答えた あとの 窓（なぞなぞ仮面の セリフ）。どれも 1窓。ロバの 型で 洒落の わなを えらんだ ときだけ
 * 「〜だと 思った そこの お前……」の 間を おいて 2窓。外れたら かならず 正解を 言う。
 */
export const nazoResult = (r: Riddle, k: number): string[] => {
	const pick = nazoPick(r, k);
	const v = { answer: riddleAnswer(r), why: r.why };
	if (pick === "quit") return [NAZO.flee];
	if (pick === "right")
		return [fillIn(r.roba ? NAZO.robaRight : NAZO.right, v)];
	if (r.roba && pick === "plain")
		return [
			fillIn(NAZO.robaTrap, { trap: r.options[r.plain] }),
			fillIn(NAZO.robaTell, v),
		];
	if (pick === "plain") return [fillIn(NAZO.wrong, v)];
	return [fillIn(r.odd ?? NAZO.odd, v)];
};

// ───────────────── バルス失敗ニキ（本館の すみ。帰りごとに 1つ） ─────────────────

/** 1回分（lv は 名前欄の レベル。sys は 掲示板の 知らせ＝地の文）。 */
export type BalusBeat = {
	lv: number;
	lines: readonly { text: string; sys?: true }[];
};

/** レベル 3 未満の 失敗（pages/393 の 文を 空飛ぶ鯖と 同じ あけ方で）。 */
const FAIL_LV = (lv: number) =>
	`禁断呪文　バルス　発動失敗。。\n忍法帖の　レベル　不足。（lv:${lv}）`;
/** part の 入った スレの 失敗（レベルが 1 下がる。pages/393）。 */
const FAIL_PART = (lv: number) =>
	`禁断呪文　バルス　発動失敗。。【罪状】\npartスレは　バルス　できぬいの刑(lv:${lv} →${lv - 1})`;

/**
 * 0 は 初出の まね。1〜5 を くり返す（レベル 2 で 失敗 → 3 で part の 罪状（3→2）→ part を 消して また
 * レベル不足 → バルスが 消えて 待つ → 復活して また レベル不足）。一度も 成功しない。
 */
export const BALUS_BEATS: readonly BalusBeat[] = [
	{
		lv: 1,
		lines: [
			{ text: "うっそぴょ〜〜ん！！\nおまいら　新参か？" },
			{ text: "半年　ROMれ！\n……！バルス" },
			{ text: FAIL_LV(1), sys: true },
		],
	},
	{
		lv: 2,
		lines: [
			{ text: "……てすや" },
			{ text: "ほな　もう一回。\n……！バルス" },
			{ text: FAIL_LV(2), sys: true },
		],
	},
	{
		lv: 3,
		lines: [
			{ text: "レベル3や。\n……！バルス" },
			{ text: FAIL_PART(3), sys: true },
		],
	},
	{
		lv: 2,
		lines: [
			{ text: "スレの　名前から\npart　を　消したった" },
			{ text: "……！バルス" },
			{ text: FAIL_LV(2), sys: true },
		],
	},
	{
		lv: 2,
		lines: [
			{ text: "……バルス、いったん\n消えた　らしいな" },
			{ text: "消えても　ワイは　待つで。\n……てすや" },
		],
	},
	{
		lv: 2,
		lines: [
			{ text: "復活　しとる！\n……！バルス" },
			{ text: FAIL_LV(2), sys: true },
		],
	},
];

/** n 回目（0 から）の 回。0 の あとは 1〜5 を くり返す。 */
export const balusBeat = (n: number): BalusBeat =>
	BALUS_BEATS[n <= 0 ? 0 : 1 + ((n - 1) % (BALUS_BEATS.length - 1))];

/** その 回の あとの レベル（part の 罪状で 1 下がる。同じ 帰りの「……てすや」の 名前欄）。 */
export const balusLvAfter = (b: BalusBeat): number =>
	b.lines.some((l) => l.sys && l.text.includes("【罪状】")) ? b.lv - 1 : b.lv;

export const BALUS = {
	/** 同じ 帰りに もう一度（こつこつ レベル上げ）。 */
	again: "……てすや",
} as const;

// ───────────────── 人工無能ニキ（図書館。帰りごとに 1つ） ─────────────────

export type IdeaAsk = {
	ask: string;
	options: readonly [string, string, string];
};

/** 聞く 順（ひとまわり したら また 主人公から）。選択肢は 9字まで。 */
export const IDEA_ASKS: readonly IdeaAsk[] = [
	{
		ask: "主人公は？",
		options: ["ロボットの　少女", "しゃべる　蓄音機", "名無しの　整備士"],
	},
	{
		ask: "舞台は？",
		options: ["沈みかけの　板", "海の　上の　鯖", "1000年後の　村"],
	},
	{ ask: "敵は？", options: ["荒らし", "スクリプト", "しめきり"] },
	{ ask: "必殺技は？", options: ["1000取り", "全レス返し", "ageパンチ"] },
	{ ask: "相棒は？", options: ["ネコ", "古い　ラジオ", "ぷゆゆ"] },
	{ ask: "口ぐせは？", options: ["〜ンゴ", "〜ですぞ", "〜みゃあ"] },
	{
		ask: "山場は？",
		options: ["合体する", "記憶が　もどる", "雨の　中で　泣く"],
	},
	{ ask: "題名は？", options: ["鉄の　ンゴ", "スレの　果て", "ロボと　ワイ"] },
	{
		ask: "最終回は？",
		options: ["ぜんぶ　夢", "1000レスで　完走", "次スレへ　つづく"],
	},
	{ ask: "続編は？", options: ["2", "前日譚", "完結編"] },
];

export const IDEA = {
	/** いちばん はじめ（1回だけ）。 */
	intro: "ロボットの　小説を　書くんや。\nワイは　天才やからな",
	/** 帰りごとの はじめ（{ask} は 聞く こと）。 */
	ask: "アイディアを　ください。\n……{ask}",
	/** えらんだ とき（pages/285 の 返事を 順に。どれも 何も 言って いない）。 */
	ok: ["……なるほど", "……良いね", "……それ　いいかも　しれない"],
	/** やめた とき。 */
	no: "……うーん",
	/** 10個 たまった。 */
	ten: "構想　10年や。……中身は　言わんで。\nパクられると　嫌やからな",
	/** 10個 より あと（5個ごと）。 */
	later: "……連載は　10年後や",
	/** 同じ 帰りに もう一度。 */
	again: "……いま、構想を　ねっとる",
	quit: "やめる",
} as const;

export const ideaAsk = (n: number): IdeaAsk => IDEA_ASKS[n % IDEA_ASKS.length];

/** n 個目（0 から）を もらった ときの 返事。 */
export const ideaOk = (n: number): string =>
	IDEA.ok[Math.max(0, Math.floor(n)) % IDEA.ok.length];

/** n 個目（1 から）を もらった あとの ひとこと（無ければ null）。 */
export const ideaAfter = (n: number): string | null =>
	n === 10 ? IDEA.ten : n > 10 && n % 5 === 0 ? IDEA.later : null;

export const ideaText = (n: number): string =>
	fillIn(IDEA.ask, { ask: ideaAsk(n).ask });

// ───────────────── おどちゃん（夜の 池の 南） ─────────────────

/** 夜（20時〜翌4時台）だけ 踊っている。 */
export const odoruAwake = (hour: number): boolean => hour >= 20 || hour < 5;

export const ODORU = {
	/** 村に いる あいだ はじめて 話した とき（地の文）。 */
	first: "宝石が　踊っている。\n……顔が　ある。(の)ヮ(の)",
	main: "神は　私の　力です……みゃあ",
	/** 2回目から 順に。 */
	more: [
		"星が　出てると、\n体が　かってに　動く　みゃあ",
		"きうり……じゃなかった。\n神は　私の　力です　みゃあ",
		"流行らなかった　みゃあ。\n……でも　踊る　みゃあ",
	],
} as const;

// ───────────────── モフちゃん（西の 空き地の すみ） ─────────────────

export const MOFU = {
	/** {v} は 札の 版（町の 段 + 1）。 */
	tag: "首の　札に『mohu.v{v}』。\n……きうりを　かじっている。",
	/** 原住民（きうりアーマーの 飼い主。pages/245）が 越してきた あと。 */
	owner: "……原住民が　来てから、\nきうりが　1本　ふえた。",
	/** 2回目から 順に（村に いる あいだ）。 */
	more: [
		"……きうりを　ひとくち、\nこちらへ　さしだした。",
		"……触角が　ゆれた。",
	],
} as const;

export const mofuTag = (stage: number): string =>
	fillIn(MOFU.tag, { v: String(Math.max(0, Math.floor(stage)) + 1) });

// ───────────────── 機能の 墓場（神社の 上の 森。段2 から） ─────────────────

export type GraveId =
	| "tag"
	| "rolli"
	| "kusa"
	| "gps"
	| "balus"
	| "danmaku"
	| "iine"
	| "okpic";

export const GRAVE = {
	monument: [
		"供養碑。『機能の　墓場』",
		"『掲示板の　発展に　犠牲は\n　つきもの　である。』",
	],
	/** お盆（8/13〜16）だけ 供養碑で。 */
	obon: "お盆。……どの　墓にも、\n線香が　1本ずつ　立っている。",
	tag: [
		"墓石。『タグ機能　2014-2016』",
		"供えた　札。『タグ機能たん、2年もの間、\nお疲れ様でした。m(_ _)m』",
	],
	/** お盆だけ タグ機能の 墓に 足す。 */
	tagObon: "札の　となりに、新しい　札。\n『m(_ _)m』",
	/** ロリード（村に いる あいだ 調べる たびに 入れかわる）。 */
	rolli: [
		"墓石。『ロリード　ここに　眠る』",
		"墓石。『リロード　ここに　眠る』\n……さっきは　ロリード　だった　気が　する。",
		"墓石。『ロリード　ここに　眠る』\n……もしかして　こっちが　本当なのか。",
	],
	kusa: "墓石に　ボタンが　ついている。\n『草ボタン』",
	/** 押した 数を 見せる（{w} は ｗ や きうり）。 */
	kusaNow: "墓石に　ボタン。『草ボタン』\n{w}",
	kusaMenu: ["押す", "やめる"],
	kusaPush: "ｗ　が　ひとつ　ふえた。\n{w}",
	/** ちょうど 10回目（ｗの 数が きうりの 絵に かわる。pages/157）。 */
	kusaTen: "ｗが　10こ　たまって、\nきうり　1本に　なった。",
	gps: ["墓石。『GPS機能』\n『居場所を　見せる　ためだけに』"],
	balus: [
		"墓石。『バルス　2018-2024』\n札が　かかっている。『再開てすと中』",
		"札の　字は　新しい。\n……どこかで、だれかが　唱えている。",
	],
	danmaku: [
		"墓石。『弾幕機能　2018.12.14-15』\n裏に　小さく　字が　ならんでいる。",
		"『Ver.1.0　＠が　プカプカ』……\n『そして　伝説へ…』",
	],
	iine: [
		"墓石。『イイ！ボタン』\n札が　かかっている。『イクナイ』",
		"……1日で　消えて、もどって、\nまた　消えた。",
	],
	okpic: [
		"新しい　墓石。『!okpic』\n『2026.8　その日の　うちに』",
		"……花が　まだ　しおれて　いない。",
	],
} as const;

/** お盆（8/13〜16）。 */
export const isObon = (m: number, d: number): boolean =>
	m === 8 && d >= 13 && d <= 16;

/** ロリードの 墓の 文（k は 村に いる あいだに 調べた 回数。0 から）。 */
export const rolliLine = (k: number): string =>
	k <= 0 ? GRAVE.rolli[0] : GRAVE.rolli[1 + ((k - 1) % 2)];

/** 草ボタンの ｗ（10ごとに きうり 1本）。 */
export const kusaShown = (n: number): string => {
	if (n <= 0) return "";
	if (n < 10) return "ｗ".repeat(n);
	const k = Math.floor(n / 10);
	return n % 10 ? `きうり　${k}本と、${"ｗ".repeat(n % 10)}` : `きうり　${k}本`;
};

// ───────────────── 温泉卵（銭湯の 七不思議） ─────────────────

/**
 * 調べる たびに 1つずつ（村に いる あいだ。5回目は 答えが ない）。最初の 窓は data/rooms.ts の ROOM_MSG.bath.egg。
 * 元スレ pages/312 の >>20・>>27・>>30・>>38（下品な 元スレの 題・>>1 の 全文・>>35 は 使わない）。
 */
export const EGG_THEORIES: readonly string[] = [
	"下に　ちがう　字で　書きたし。\n『ウコッケイを　思い出したんでしょ』",
	"さらに　ちがう　字。\n『なんで　ウコッケイから　温泉卵なんや』",
	"さらに　ちがう　字。\n『滑稽→コッケイ→コケコッコー→卵』",
	"さらに　ちがう　字。\n『コケコッコー→卵　わからない』",
	"……答えは、どこにも　書いて　いない。",
];

export const eggTheory = (k: number): string =>
	EGG_THEORIES[
		((k % EGG_THEORIES.length) + EGG_THEORIES.length) % EGG_THEORIES.length
	];

// ───────────────── 1レス博物館（図書館の ガラスケース） ─────────────────

/** ケースごとの 展示（帰りごとに 1つ。[題, 説明]）。最初の 窓は data/rooms.ts の ROOM_MSG.library.museum。 */
export const MUSEUM: readonly (readonly (readonly [string, string])[])[] = [
	[
		["『保守』", "……だれも　つづかなかった。"],
		["『ワイ、ついに　早起きに　成功』", "……立った　時刻は　14:02。"],
		["『みんな　何してる？』", "……返事は、ない。"],
	],
	[
		["『1000まで　いけるかな』", "……>>1で　止まっている。"],
		["『今夜の　晩飯　当ててみ』", "……答えを　知る　人は　いない。"],
		["『ここだけ　時間が　止まってる　スレ』", "……ほんとうに　止まった。"],
	],
];

/** 帰りの 時刻から 展示を 決める（同じ 帰りなら 同じ）。 */
export const museumPick = (
	at: number,
	kase: number,
): readonly [string, string] => {
	const list = MUSEUM[kase % MUSEUM.length];
	let h = (Math.floor(at) ^ (kase * 0x9e3779b1)) >>> 0;
	h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
	return list[((h ^ (h >>> 16)) >>> 0) % list.length];
};

export const museumText = (at: number, kase: number): string => {
	const [title, note] = museumPick(at, kase);
	return `${title}\n${note}`;
};
