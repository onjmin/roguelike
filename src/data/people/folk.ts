// おんJタウンの 小さな 名物（folk）：村の はしの 名無したち・本館／図書館／銭湯の すみの 小ネタの 文と 決まり。
// DOM も 保存も 使わない（src/sim/folkTests.ts が そのまま 読む）。置き場所は data/village/folk.ts、
// 話し方（帰りごとに 1つ 進む・保存）は ui/village/folk.ts。どれも 寄り道で、強さ・道具・売上・町の 段には ふれない。
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
//   温泉卵           … pages/312（七不思議レス >>1「くそ滑稽ｗ」>>2「温泉卵的な？」と 考察 >>20・>>27・>>30・>>38。答えは 出ない）
//   1レス博物館      … pages/20（1レスおんＪ＝糞スレ博物館）。展示の 題は 新しく 書いた
//   ダジャレニキ     … pages/59 の 型「そうそう〇〇……って それは ××やないかーい！ｗｗ」。だじゃれは 新しく 書いた（data/village/crowd.ts）
//
// 文の 決まり：1行 全角22字（半角 0.5）・2行まで。絵文字の 行は 21字まで。キリコも 話してよい（吾輩・ンゴ）。
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
	intro: "ワイの好きなひらがな\nランキング、発表していくで",
	/** 同じ 帰りに もう一度。 */
	again: "今日はここまで言うたやろ",
	/** 2位の「ぷ」（言いかけて やめる）。 */
	pu: "第2位ぷ……",
	/** 2位の 取り消し（濁音・半濁音は 数えない。元スレ >>9）。 */
	retract: "……ちゃうわ、半濁音は除外やった。\n今日はここまで",
	/** 2位の ね の あとに（1位から 発表した。元スレの >>14）。 */
	from48: "……48位から発表したほうが\nよかったかな",
	/** 47位の あとに（元スレの >>178）。 */
	ahead: "いよいよ明日は最下位発表やで！",
	/** 48位（元スレの >>180 の まま）。 */
	last: "第48位ひ\n今日は……というかこのスレはここまで",
	/** 48位の あとに（元スレの >>185）。 */
	manyo: "……次は好きな万葉仮名\nランキングでもやったるかな",
	/** 元祖の「う」の あとに。 */
	afterU: "……「う」に恨みはない。\nほんまや",
} as const;

/** 毎日の 選出理由（元スレの まま 短く した もの。20位 へ・22位 に は 出さない）。 */
export const HIRA_WHY: Readonly<Record<number, string>> = {
	1: "『め』かと思ったら最後にトラップ",
	2: "トラップをかいくぐるメンタルが好き",
	3: "裏返しても読みまちがえない",
	4: "行書だと縦線1本。シンプル",
	5: "『ろ』とのトラップが高評価",
	6: "適当に書いてもバランスがとれる",
	7: "『〜というと？』に引っかけられそう",
	8: "形がかわいいから",
	9: "形がひ『よ』こみたいで可愛いから",
	10: "丸っこくて抱きたくなる形",
	11: "すらすら書きやすい（個人の感想です）",
	12: "『す』と同様（個人の感想です）",
	13: "左下と右上のバランスがいい感じ",
	14: "なんとなくかわE",
	15: "『う』を言うときの顔に似ている",
	16: "なんとなくバランスがいい感じ",
	17: "くの字・くノ一……自虐ネタがピカイチ",
	18: "なんとなく目の形に見えるから",
	19: "簡単に書けてバランスも取りやすい",
	21: "なんとなく『手』相の形に似てるから",
	23: "書いてて楽しい",
	24: "3画目にひねるところが辛うじて好き",
	25: "なんとなく『つ』り針っぽいから",
	26: "書き方によっては『ろ』と紛らわしい",
	27: "なんとなく書くのがめんどくさい",
	28: "おんJでもおまけスレなどで活躍中",
	29: "1画か2画かはっきりせいや",
	30: "右上の点のせいでバランスが悪い",
	31: "『は？』と書くと煽りに見える",
	32: "手で書くと『3』と紛らわしい",
	33: "書く時のバランスがとりにくい",
	34: "もふもふ可愛いのに書きにくいんじゃあ",
	35: "急いでいると『い』と間違いやすい",
	36: "形が特徴的で間違いにくい",
	37: "読んだ時の響きが『嫌』",
	38: "発音しにくい",
	39: "『さ』の裏返しに見える……こともある",
	40: "書き方によっては『ゆ』と紛らわしい",
	41: "『り』にも『11』にも似ている",
	42: "下のほうに間延びしてしまう",
	43: "『て』や『二』と紛らわしい",
	44: "書いているうちに『之』になってしまう",
	45: "いろいろ言いたいことはある",
	46: "なんで2画目と3画目離したりすんねん",
	47: "形がキモい",
	48: "書きにくいし何のとりえもない",
};

/** 話しかけずに 帰りを 飛ばした あとの ひとこと（元スレ >>133・>>154・>>166・>>171）。 */
export const HIRA_FORGOT = {
	one: ["昨日忘れたンゴ……", "また忘れたンゴ……"],
	two: [
		"ワイとしたことが\n2日連続で忘れるとは……",
		"まーた2日連続で\n忘れてしまったンゴねぇ",
	],
} as const;

/** 飛ばした 帰りの 数（missed）→ ひとこと（k で 入れかわる。0 なら 無し）。 */
export const hiraForgot = (missed: number, k: number): string | null => {
	if (!(missed >= 1)) return null;
	const list = missed >= 2 ? HIRA_FORGOT.two : HIRA_FORGOT.one;
	return list[Math.abs(Math.floor(k)) % list.length];
};

const rankLine = (rank: string, ch: string): string =>
	`第${rank}位　${ch}\n……今日はここまで`;
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
	return [`第${hiraEndless(n - 51)}位……\n……やっぱ今日はここまで`];
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
		q: "ずぶ濡れのケーキって\nな〜んだ？",
		options: ["ショートケーキ", "ウェッティング", "ずぶ濡れケーキ"],
		answer: 1,
		say: "ウェッティングケーキ",
		plain: 0,
		why: "……ウェット（ずぶ濡れ）だけに",
		odd: "🎭？……そんなケーキはない\n正解は『{answer}』",
	},
	{
		q: "1000レスまで行ったスレが\nいちばん好きなおやつは？",
		options: ["お祝いのケーキ", "乾燥いも", "ぷゆゆパン"],
		answer: 1,
		plain: 0,
		why: "……完走（かんそう）だけに",
	},
	{
		q: "スレを沈ませない人が\nいちばん好きな料理は？",
		options: ["揚げ物", "保存食", "温泉卵"],
		answer: 0,
		plain: 1,
		why: "……age（あげ）だけに",
		odd: "🎭？……温泉卵的な？\n正解は『{answer}』",
	},
	{
		q: "すぐアク禁にされる\n野菜は？",
		options: ["トマト", "きうり", "ごぼう"],
		answer: 2,
		plain: 0,
		why: "……アクが強いだけに",
		odd: "🎭？……きうりにアクはない\n正解は『{answer}』",
	},
	{
		q: "中身がないのにのびている\nスレに生える植物は？",
		options: ["草", "サボテン", "コケ"],
		answer: 1,
		plain: 0,
		why: "……中身はサボってん",
		roba: true,
	},
	{
		q: "1000レスをさいごまで\n見とどけた鳥は？",
		options: ["焼き鳥", "フクロウ", "チドリ"],
		answer: 2,
		plain: 1,
		why: "……千（ち）だけに",
	},
	{
		q: "スレ立てがいちばん\n多い季節は？",
		options: ["立春", "夏休み", "こたつ"],
		answer: 0,
		plain: 1,
		why: "……立つだけに",
	},
	{
		q: "おーぷんのサーバーの\n中に住んでいる魚は？",
		options: ["サバ", "マグロ", "鯖缶"],
		answer: 2,
		plain: 0,
		why: "……鯖の中に住んどるからな",
		roba: true,
	},
	{
		q: "スレに書きこむのが\n大好きな海の生き物は？",
		options: ["カキ", "タコ", "きうり"],
		answer: 0,
		plain: 1,
		why: "……カキコだけに",
		odd: "🎭？……それは畑や\n正解は『{answer}』",
	},
	{
		q: "キリ番をふんだ人が\nもらえるものは？",
		options: ["キリコ", "キリ", "おめでとう"],
		answer: 2,
		plain: 1,
		why: "……ふつうにめでたい",
		roba: true,
		odd: "🎭？……それはお前や\n正解は『{answer}』",
	},
];

export const NAZO = {
	/** いちばん はじめ（1回だけ）。 */
	intro: "🎭なぞなぞ仮面参上。\n……ワイからの挑戦や",
	/** 2周め（問題が ひとまわり した あとの 1問め）。 */
	rerun: "……ネタ切れちゃうで。\n再放送や",
	/** 答えた あとの 同じ 帰り。 */
	again: "次のなぞなぞは、\nまたこんど",
	/** やめた（同じ 帰りなら また 同じ 問題）。 */
	flee: "……逃げるのか。\nまた来たまえ",
	/** まっすぐな 答え（外れ。答えも 言う）。 */
	wrong: "🎭不正解。……だめだ発表する。\n正解は『{answer}』",
	/** 変な 答え（外れ。答えも 言う）。 */
	odd: "🎭？……だめだ発表する。\n正解は『{answer}』",
	right: "🎭正解！\n{why}",
	/** ロバの 型で 洒落を えらんだ（2窓）。 */
	robaTrap: "『{trap}』だと思った\nそこのお前……",
	robaTell: "🎭残念！正解は『{answer}』\n{why}",
	/** ロバの 型で 正解を えらんだ。 */
	robaRight: "🎭……正解。なんでわかったんや\n{why}",
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
	`禁断呪文バルス発動失敗。。\n忍法帖のレベル不足。（lv:${lv}）`;
/** part の 入った スレの 失敗（レベルが 1 下がる。pages/393）。 */
const FAIL_PART = (lv: number) =>
	`禁断呪文バルス発動失敗。。【罪状】\npartスレはバルスできぬいの刑(lv:${lv} →${lv - 1})`;

/**
 * 0 は 初出の まね。1〜5 を くり返す（レベル 2 で 失敗 → 3 で part の 罪状（3→2）→ part を 消して また
 * レベル不足 → バルスが 消えて 待つ → 復活して また レベル不足）。一度も 成功しない。
 */
export const BALUS_BEATS: readonly BalusBeat[] = [
	{
		lv: 1,
		lines: [
			{ text: "うっそぴょ〜〜ん！！\nおまいら新参か？" },
			{ text: "半年ROMれ！\n……！バルス" },
			{ text: FAIL_LV(1), sys: true },
		],
	},
	{
		lv: 2,
		lines: [
			{ text: "……てすや" },
			{ text: "ほなもう一回。\n……！バルス" },
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
			{ text: "スレの名前から\npart　を消したった" },
			{ text: "……！バルス" },
			{ text: FAIL_LV(2), sys: true },
		],
	},
	{
		lv: 2,
		lines: [
			{ text: "……バルス、いったん\n消えたらしいな" },
			{ text: "消えてもワイはレベル上げや！\n……てすや" },
		],
	},
	{
		lv: 2,
		lines: [
			{ text: "復活しとる！\n……！バルス" },
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
		options: ["ロボットの少女", "しゃべる蓄音機", "名無しの整備士"],
	},
	{
		ask: "舞台は？",
		options: ["沈みかけの板", "海の上の鯖", "1000年後の村"],
	},
	{ ask: "敵は？", options: ["荒らし", "スクリプト", "しめきり"] },
	{ ask: "必殺技は？", options: ["1000取り", "全レス返し", "ageパンチ"] },
	{ ask: "相棒は？", options: ["ネコ", "古いラジオ", "ぷゆゆ"] },
	{ ask: "口ぐせは？", options: ["〜ンゴ", "〜ですぞ", "〜みゃあ"] },
	{
		ask: "山場は？",
		options: ["合体する", "記憶がもどる", "雨の中で泣く"],
	},
	{ ask: "題名は？", options: ["鉄のンゴ", "スレの果て", "ロボとワイ"] },
	{
		ask: "最終回は？",
		options: ["ぜんぶ夢", "1000レスで完走", "次スレへつづく"],
	},
	{ ask: "続編は？", options: ["2", "前日譚", "完結編"] },
];

export const IDEA = {
	/** いちばん はじめ（1回だけ）。 */
	intro: "ロボットの小説を書くんや。\nワイは天才やからな",
	/** 帰りごとの はじめ（{ask} は 聞く こと）。 */
	ask: "アイディアをください。\n……{ask}",
	/** えらんだ とき（pages/285 の 返事を 順に。どれも 何も 言って いない）。 */
	ok: ["……なるほど", "……良いね", "……それいいかもしれない"],
	/** やめた とき。 */
	no: "……うーん",
	/** 10個 たまった。 */
	ten: "構想10年や。……中身は言わんで。\nパクられると嫌やからな",
	/** 10個 より あと（5個ごと）。 */
	later: "……連載は10年後や",
	/** 同じ 帰りに もう一度。 */
	again: "……いま、構想をねっとる",
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
	first: "宝石が踊っている。\n……顔がある。(の)ヮ(の)",
	main: "神は私の力です……みゃあ",
	/** 2回目から 順に。 */
	more: [
		"星が出てると、\n体がかってに動くみゃあ",
		"きうり……じゃなかった。\n神は私の力ですみゃあ",
		"流行らなかったみゃあ！\nだから踊って流行らせるみゃあ！",
	],
} as const;

// ───────────────── モフちゃん（西の 空き地の すみ） ─────────────────

export const MOFU = {
	/** {v} は 札の 版（町の 段 + 1）。 */
	tag: "首の札に『mohu.v{v}』。\n……きうりをかじっている。",
	/** 原住民（きうりアーマーの 飼い主。pages/245）が 越してきた あと。 */
	owner: "……原住民のそばでは、\nきうりが1本多い。",
	/** 2回目から 順に（村に いる あいだ）。 */
	more: [
		"きうりをひとくち、こちらへ\nさしだした。……食べかけだ。",
		"触角がぶんぶん回った。\nどこかの星と通信している。",
	],
} as const;

export const mofuTag = (stage: number): string =>
	fillIn(MOFU.tag, { v: String(Math.max(0, Math.floor(stage)) + 1) });

// ───────────────── 温泉卵（銭湯の 七不思議） ─────────────────

/**
 * 調べる たびに 1つずつ（村に いる あいだ。5回目は 答えが ない）。最初の 窓は data/town/rooms.ts の ROOM_MSG.bath.egg。
 * 元スレ pages/312 の >>20・>>27・>>30・>>38（下品な 元スレの 題・>>1 の 全文・>>35 は 使わない）。
 */
export const EGG_THEORIES: readonly string[] = [
	"下にちがう字で書きたし。\n『ウコッケイを思い出したんでしょ』",
	"さらにちがう字。\n『なんでウコッケイから温泉卵なんや』",
	"さらにちがう字。\n『滑稽→コッケイ→コケコッコー→卵』",
	"さらにちがう字。\n『コケコッコー→卵わからない』",
	"さらにちがう字。\n『答えは温泉卵本人に聞け』",
];

export const eggTheory = (k: number): string =>
	EGG_THEORIES[
		((k % EGG_THEORIES.length) + EGG_THEORIES.length) % EGG_THEORIES.length
	];

// ───────────────── 1レス博物館（図書館の ガラスケース） ─────────────────

/** ケースごとの 展示（帰りごとに 1つ。[題, 説明]）。最初の 窓は data/town/rooms.ts の ROOM_MSG.library.museum。 */
export const MUSEUM: readonly (readonly (readonly [string, string])[])[] = [
	[
		["『保守』", "……自分で保守して、自分で沈んだ。"],
		["『ワイ、ついに早起きに成功』", "……立った時刻は14:02。"],
		["『みんな何してる？』", "……返事のかわりに殿堂入りした。"],
	],
	[
		["『1000までいけるかな』", "……>>1で止まっている。"],
		["『今夜の晩飯当ててみ』", "……イッチ本人も忘れた。"],
		["『ここだけ時間が止まってるスレ』", "……ほんとうに止まった。"],
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
