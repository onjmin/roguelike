// おんJ高校の 部室棟（data/village/bushitsu.ts）の 文と、遊びの 決まり（DOM・保存・絵は 使わない）。
// 窓は 2行・1行 22 幅まで（全角 1・半角 0.5）。板の 文は 1行 22 幅まで。説明しすぎない。スレは 沈む。
// - ワードウルフ（人狼部）：名無し 4人と 部長。お題が 1人だけ ちがう。1周目・2周目の ひとこと（wwDeal）。
// - うろ覚えお糸会かき大会（お糸会かき部）：お題を くずした 絵 3枚から いちばん 似てる 1枚（oeRound）。
// - ぬとらじ（放送部）：毎晩 20〜2時と 土日。土日は おんJ年表の 昔話を 帰りに 1つ（MUKASHI）。
// - 部員募集の はり紙：来るたびに 部が かわり、番号が ふえる（boshuLine）。
// - おんｊボカロ一覧（ボカロ部）：村に いる 子と、安価キャラメイク（帰りに 1回。名前・見た目・口ぐせ）で 足した 子。
// - 校歌　斉唱（合唱部）：さいごの「あ」を 伸ばせるだけ 伸ばす。キリコが 息の 切れる 前に しめる（KK・kouka〜）。
// - テストプレイ（ゲーム制作部）：99% から 進まない（板だけ。決まりは 無い）。
// 部室の 人の 歩行グラ（BS_STAFF の walk）は ここにだけ 書く（ほかで 使わない。bushitsuTests B5）。

/** 乱数（0 以上 1 未満）。見た目だけなので 遊ぶ ときは Math.random。 */
export type Rand = () => number;

// ───────────────── 文 ─────────────────

/** 扉の 文（村に いる あいだ 1回）。 */
export const BS_DOOR = "おんJ高校の部室棟。\n……上ばきのにおい。";

/** 外の 物（外観の 壁。地図の マス）。 */
export const BS_OUTDOOR = {
	kosatsu: ["校札。\n「県立おんJ高校部室棟」", "……校舎は見あたらない。"],
	poster: ["部員募集のポスター。\n「どの部も1人から」"],
	mado: ["小窓。\n……中から「あげ」と聞こえる。"],
	rakugaki: ["壁の落書き。\n「やきう部つくれ」"],
} as const;

/** 部屋の 調べる 物（物の id → 窓ごとの 文。遊べる 物は このあと ui/bushitsu/bushitsu.ts が 続ける）。 */
export const BS_THING_LINES: Record<string, readonly string[]> = {
	aikotoba: ["はり紙。\n「部屋名：おんｊ村合言葉：age」"],
	plate_jinro: ["部室の札。\n「人狼部」"],
	table: ["机の上にカードが6枚。"],
	plate_oekaki: ["部室の札。\n「お糸会かき部」"],
	kokuban: ["黒板に落書き。\n……ねこ？たぬき？"],
	painting: ["額の絵。\n題は「力作」。"],
	easel: ["イーゼル。\nまっしろな画用紙。"],
	palette: ["パレット。\n絵の具がかぴかぴになっている。"],
	plate_hoso: ["部室の札。\n「放送部（ぬとらじ）」"],
	onair: ["ON AIR のランプ。"],
	nisshi: ["放送日誌。"],
	mixer: ["ミキサー。\nつまみがぜんぶまんなか。"],
	radio: ["ラジカセ。\nブースにつながっている。"],
	plate_voca: ["部室の札。\n「ボカロ部」"],
	roster: ["額。\n「おんｊボカロ一覧」"],
	speaker: ["スピーカー。\n……ずっと「あ」が鳴っている。"],
	synth: ["キーボード。\nドの鍵盤だけすりへっている。"],
	pc: ["ボカロ部のパソコン。\n原音設定の画面。"],
	gakufu: ["楽譜の束。\n歌詞のらんはぜんぶ「安価」。"],
	plate_game: ["部室の札。\n「ゲーム制作部」"],
	eta: [
		"壁の札。\n赤いはんこで「エター」。",
		"「キリ番ハンター（仮）」\n「次スレ物語（仮）」ほか多数",
	],
	gamepc: ["パソコン。\n画面に「タイトル未定」。"],
	cabinet: ["手作りの筐体。\n「テストプレイ募集中」。"],
	kouka: [
		"額。\n「県立おんJ高校校歌」",
		"作詞おんJ民作曲おんJ民\n※演奏が終わるまで伸ばす",
	],
	bukatsu: [
		"部活一覧。\n人狼部（1）お糸会かき部（1）",
		"放送部（1）ボカロ部（1）\nゲーム制作部（1）合唱部（1）",
		"帰宅部（1）\n……やきう部が無い。",
	],
	boshu: ["部員募集のはり紙。"],
	fumendai: ["譜面台の楽譜。\nさいごの音にフェルマータが10個。"],
	getabako: ["下駄箱。\n靴が7足。……ほかは空っぽ。"],
	sink: ["手洗い場。\n蛇口が1つゆるい。"],
	fire: ["消火器。\n……これだけ新品。"],
};

/**
 * 部室の 人（部員は どこも 1人＝部長。話すと lines を ぜんぶ）。
 * walk は ほかで 使われていない RPGEN の 歩行グラ（ここ だけに 書く）。
 */
export const BS_STAFF = {
	jinro: {
		name: "人狼部部長",
		walk: "sa:TvO1jb",
		lines: [
			"人狼は10人から。\nワードウルフは6人からはじめるで",
			"……今日もあと5人足りん",
		],
	},
	oekaki: {
		name: "お糸会かき部部長",
		walk: "sa:V3hX3J",
		lines: ["お題を出したら\nうろ覚えで描く。", "……検索は禁止や"],
	},
	hoso: {
		name: "放送部部長",
		walk: "sa:LVqpjo",
		lines: ["夜と土日にぬとらじやっとる。\n……聞くだけでええ"],
	},
	voca: {
		name: "ボカロ部部長",
		walk: "sa:Lrop6w",
		lines: ["この世におんJ出身を\nもう1人ふやしたいねん"],
	},
	game: {
		name: "ゲーム制作部部長",
		walk: "sa:GJ3UBM",
		lines: ["テストプレイ、たのむで。\n……感想はやさしめにな"],
	},
	gassho: {
		name: "合唱部部長",
		walk: "sa:EZnhBf",
		lines: ["さいごの「あ」は\n伸ばせるだけ伸ばす伝統や"],
	},
	kitaku: {
		name: "帰宅部部長",
		walk: "sa:RMUeVS",
		lines: ["チャイムが鳴ったら帰る。\n……まだいっぺんも鳴っとらん"],
	},
} as const;

/** 遊べる 物の 窓（村の 窓。{n} などは fillText で 埋める）。 */
export const BS_MSG = {
	ww: {
		menu: ["ワードウルフ（6人）", "人狼（10人）", "ハイスコアを見る", "やめる"],
		/** ハイスコア（{p} 遊んだ・{w} 見やぶった・{b} 最長の 連勝）。 */
		record: "これまで{p}回、{w}回見やぶった。\n最長　{b}連勝。",
		tenNin: "……10人はそろわない。",
		/** 10回目の 帰りより あとに 1度だけ（人狼が そろいかけて 1人 抜ける）。 */
		ten: ["……10人そろった。", "……1人抜けた。"],
		jiki: "今は時期が悪い",
		howto: [
			"名無しが4人と部長。\nお題が1人だけちがう。",
			"ちがうお題の1人に\n投票する。",
			// 投票の 回りかた（2026-10-15 ガイドの 洗い出し）
			"キリコのお題は多いほう。人狼は\n5人のだれか。部長のこともある。",
			"1周目は両方に合うことも多い。\n聞いたら投票か「もう1周」をえらぶ。",
			"1周目で当てたら◎、2周目なら○。\n2周目はふつう自分のお題のこと。",
		],
		win1: "……1周目で人狼を当てた。",
		win2: "……人狼を当てた。",
		lose: "……人狼はほかにいた。",
		streak: "……{n}回つづけて当てた。",
		byeWin: "見事や。\n……またあげしといて",
		byeLose: "人狼の勝ちや。\n……またあげしといて",
		/** 部長が 人狼だった とき。 */
		byeMeFound: "……ばれたか。\n……またあげしといて",
		byeMeWon: "ワイが人狼や。\n……またあげしといて",
	},
	oe: {
		menu: ["参加する", "ハイスコアを見る", "やめる"],
		/** ハイスコア（{p} 遊んだ・{b} いちばん 当てた・{x} ぜんぶ 当てた）。 */
		record: "これまで{p}回。いちばんは{b}問。\nぜんぶ当てたのは{x}回。",
		howto: [
			"名無しが3人、\nうろ覚えでお題を描く。",
			"いちばん似てる1枚を選ぶ。",
		],
		res3: "……3枚とも見ぬいた。",
		resN: "……{n}枚見ぬいた。",
		res0: "……どれもちがった。",
		bye: "次のお題、考えとくわ",
	},
	nt: {
		off: "……いまは何も流れていない。",
		lampOn: "……赤くついている。",
		lampOff: "……消えている。",
		title: "「{title}」",
		/** 曜日（0 日〜6 土）。日・土は 昔話の 回（一日じゅう。host は 使わない）。 */
		titles: [
			"おんJの昔話をするぬとらじ",
			"おシラフぬとらじ",
			"カラオケぬとらじ",
			"漫画を描くだけぬとらじ",
			"会話苦手なワイのぬとらじ",
			"愛のあるぬとらじ",
			"おんJの昔話をするぬとらじ",
		],
		host: [
			"",
			"今日はしらふや。\n……なんもしゃべることない",
			"十八番いきます。\n……音程は気にせんといて",
			"いまコマ割りしとる。\n……音だけですまん",
			"……あの、その。\n今日はええ天気でしたね",
			"聞いてくれてありがとう。\nみんなすこやで",
			"",
		],
		again: "……さっきの話の続きは\nまたこんどな",
		nisshiNone: "……まだ白紙。",
		nisshiHead: "昔話の回：{n}回ぶん",
	},
	vc: {
		/**
		 * おんｊボカロ一覧に ある 名前の うち、この 村に いる 子だけ（一覧の 順。春音リノ・響化アルは 越してきてから。
		 * ほかは 安価キャラメイクで 足した 子）。
		 */
		official: [
			"束音ロゼ",
			"解音ゼロ",
			"革命シヨ",
			"春音リノ",
			"蓄音キリコ",
			"響化アル",
		],
		kiriko: "……キリコの名前もある。",
		madeName: "（安価）{name}",
		rest: "ほか　{n}人",
		eta: "すみに「エター{n}人」",
	},
	vm: {
		menu: ["安価で作る", "やめる"],
		done: "……今日の安価はもうしめきった。",
		q: ["まず名前>>5", "見た目>>8", "口ぐせ>>12"],
		stop: "やめる",
		names: [
			"乙音サンイチ",
			"草音ワラ",
			"鯖音ラグ",
			"芋音キヌ",
			"灯音アゲ",
			"凪音ロム",
			"鍵音コテ",
			"札音キリバン",
			"粥音ホカ",
		],
		looks: [
			"ネコミミ",
			"メガネ",
			"ジャージ",
			"ツインテール",
			"白衣",
			"学ラン",
			"着物",
			"ヘッドホン",
			"マント",
		],
		tics: [
			"〜ンゴ",
			"〜やで",
			"〜ですわ",
			"〜ナリ",
			"〜っす",
			"〜じゃけえ",
			"〜でござる",
			"〜ぞい",
		],
		wait: "……絵師を待つ。",
		ok: ["原音設定完了。", "名簿に1行ふえた。"],
		made: "「{name}」　{look}　{tic}",
		eta: ["……絵師が来ない。\nスレは沈んだ。", "名簿のすみに「エター」。"],
	},
	boshu: {
		part: "「{club}　部員募集part{n}」\n……名前のらんに1人だけ。",
		hane: "「お糸会かき部部員募集　{n}羽目」\n……名前のらんに1人だけ。",
	},
	kk: {
		menu: ["指揮をする", "ハイスコアを見る", "やめる"],
		/** ハイスコア（{p} 遊んだ・{b} いちばんの しめかた）。 */
		record: "これまで{p}回。\nいちばんのしめかたは{b}%。",
		howto: [
			"Aで合唱部の部長が\n「あ」を伸ばしはじめる。",
			"もう一度Aでしめる。\n息が切れる前にしめる。",
		],
		cut: "……{s}秒伸ばした。",
		best: "……{s}秒。いちばんぎりぎり。",
		fall: "……声がかすれて消えた。",
		byeGood: "……2番、はじまらんかったな",
		byeShort: "息、まだのこっとるやろ",
		byeFall: "……ひゅう。",
	},
	tp: { menu: ["遊ぶ", "やめる"], after: "……エター。" },
} as const;

/**
 * 板の 文（題・下の 1行・手引き。1行 22 まで）。板の 外を タップすると B（スマホでも やめられる）。
 */
export const BS_BOARD = {
	end: "A：とじる",
	next: "A：つぎ",
	quit1: "もう一度B／外でやめる",
	ww: {
		title: "人狼部「おんｊ村」",
		hint: "↑↓A／2回タップで投票B／外でやめる",
		gather: "人がそろうまであげ",
		full: "6人そろった",
		dealt: "お題がくばられた",
		/** 席の 名（名無しは ID、まん中の 席は 部長）。 */
		id: "ID:{id}",
		bucho: "部長",
		/** 席の ひとこと（{who}・{hint}）。 */
		turn: "{who}「{hint}」",
		ask: "人狼はだれ？",
		vote: "{who}に投票",
		r1: "◎1周目で当たり",
		r2: "○当たり",
		rx: "×はずれ",
		/** 名無しが 集まる ときの 吹き出し（席 0・1・3・4。スレの「あげ」連打。顔文字は スレの まま）。 */
		ages: ["あげ", "age", "(´∀｀∩)↑age↑", "あげ！"],
		more: "もう1周",
		round: ["1周目", "2周目", "投票"],
		card: "お題：{word}",
		wolf: "人狼：{word}",
	},
	oe: {
		title: "うろ覚えお糸会かき大会",
		hint: "←→A／タップで決めるB／外でやめる",
		start: "お題：{name}　検索禁止",
		draw: "描いてる……",
		ask: "いちばん似てるのは？",
		answer: "正解はこちら",
		ok: ["力作ぞろい", "画伯やな", "うまいとてもうまいです"],
		jitter: "虫やん",
		drop: "なんかたりん",
		extra: "なんかふえとる",
		extraEar: "突起は2つ",
		extraEye: "目は2つ",
		color: "色がちゃう",
		stretch: "そんな顔長かったんか",
		stretchThing: "そんな長かったんか",
		answerLabel: "正解",
	},
	kk: {
		title: "校歌斉唱",
		hint: "A／タップはじめる・しめるB／外でやめる",
		ready: "さん、はい",
		/** 歌っている あいだ（その 秒を 過ぎたら）。 */
		marks: [
			[6000, "まだ伸ばすんか"],
			[12000, "2番まだ？"],
			[18000, "前奏がはじまらない"],
		],
		fell: "息が切れた",
		/** しめた ときの 1行（koukaGrade の 番号）。 */
		cut: ["{s}秒まだいけた", "{s}秒ええのびや", "{s}秒伝統を守った"],
		/** そのあと 息の のこりを 見せる。 */
		margin: "あと{d}秒いけた",
	},
	tp: {
		title: "テストプレイ",
		hint: "A／B／タップでとじる",
		loading: "NOW LOADING",
		stall: "99%　から進まない",
	},
} as const;

/** ぬとらじの 昔話（おんJwiki「おんJ年表」pages/74 から。1回の 帰りに 1つ。どれも 1 窓）。 */
export const MUKASHI: readonly { year: number; lines: readonly string[] }[] = [
	{ year: 2012, lines: ["2012年の6月7日。\nこの板ができた日や"] },
	{
		year: 2012,
		lines: ["2012年の6月のはじめ。\n書きこみはだれのものでもなくなった"],
	},
	{
		year: 2013,
		lines: ["2013年はだれもおらんかった。\n人っ子ひとりおらん板や"],
	},
	{ year: 2013, lines: ["2013年の春、\nお絵かきの機能がついた"] },
	{
		year: 2014,
		lines: ["2014年の3月。\nよその板からみんな越してきた"],
	},
	{ year: 2014, lines: ["2014年の3月13日。\nはじめてスレが完走した"] },
	{
		year: 2014,
		lines: ["3番目に完走したスレは\nお絵かきスレやったらしい"],
	},
	{ year: 2015, lines: ["2015年の3月19日。\n!random ができた日や"] },
	{ year: 2015, lines: ["2015年の開幕戦。\n1日で3万レスをこえた"] },
	{
		year: 2017,
		lines: ["2017年の3月。\n1日の書きこみが10万をこえた"],
	},
	{
		year: 2018,
		lines: ["2018年の11月。\n管理人が機能をどんどん足した"],
	},
	{
		year: 2019,
		lines: ["2019年の5月。\nアイコンがつけられるようになった"],
	},
	{ year: 2021, lines: ["2021年の2月3日。\nこのぬとらじができた日や"] },
	{
		year: 2024,
		lines: ["2024年の7月。\n安価で作ったボカロでもりあがった"],
	},
	{ year: 2025, lines: ["2025年の12月。\nピアノの機能がついた"] },
];

/** 部員募集の はり紙（来るたびに 次の 部・番号が 1つ ふえる）。お糸会かき部だけ「羽目」で 数える。 */
export const BS_CLUBS: readonly { name: string; base: number; hane?: true }[] =
	[
		{ name: "人狼部", base: 30 },
		{ name: "お糸会かき部", base: 36, hane: true },
		{ name: "放送部", base: 2 },
		{ name: "ボカロ部", base: 11 },
		{ name: "ゲーム制作部", base: 7 },
		{ name: "合唱部", base: 1 },
		{ name: "帰宅部", base: 99 },
	];

/** 部員募集の 番号に 出さない 並び（別の 意味に 読める 数字）。当たったら 1つ 進める。 */
export const BS_BAD_NUMBER = /114|514|810|1919|364|893|4545/;

// ───────────────── 文の 道具 ─────────────────

/** 全角=1・半角=0.5 で 数えた 幅（villageTests と 同じ）。 */
export const textWidth = (s: string): number =>
	[...s].reduce((n, ch) => n + (/[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);

/** {name} などを 埋める。 */
export const fillText = (
	t: string,
	v: Record<string, string | number>,
): string => t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

/** 語を「　」で つないで 22 幅までの 行に 分ける。 */
export const packLines = (words: readonly string[], max = 22): string[] => {
	const out: string[] = [];
	let cur = "";
	for (const w of words) {
		const next = cur ? `${cur}　${w}` : w;
		if (cur && textWidth(next) > max) {
			out.push(cur);
			cur = w;
		} else cur = next;
	}
	if (cur) out.push(cur);
	return out;
};

/** 2行ずつの 窓。 */
export const pairWindows = (lines: readonly string[]): string[] => {
	const out: string[] = [];
	for (let i = 0; i < lines.length; i += 2)
		out.push(lines.slice(i, i + 2).join("\n"));
	return out;
};

// ───────────────── ぬとらじ・部員募集 ─────────────────

/** 土日は 昔話の 日（一日じゅう 流れる）。 */
export const nutoMukashiDay = (w: number): boolean => w === 0 || w === 6;

/** ON AIR（毎晩 20〜2時と、土日は 一日じゅう）。 */
export const nutoOnAir = (h: number, w: number): boolean =>
	nutoMukashiDay(w) || h >= 20 || h < 3;

/** 日誌：まだ なければ 白紙、あれば「昔話の　回：{n}回　ぶん」＋ 聞いた 年（22 幅で 折る）。 */
export const nisshiWindows = (heard: number): string[] => {
	if (heard <= 0) return [BS_MSG.nt.nisshiNone];
	const years = [
		...new Set(
			MUKASHI.slice(0, Math.min(heard, MUKASHI.length)).map((f) =>
				String(f.year),
			),
		),
	];
	return pairWindows([
		fillText(BS_MSG.nt.nisshiHead, { n: heard }),
		...packLines(years),
	]);
};

/** 部員募集の 番号（別の 意味に 読める 並びは とばす）。 */
export const boshuNumber = (n: number): number => {
	let k = n;
	while (BS_BAD_NUMBER.test(String(k))) k++;
	return k;
};

/** 部員募集の はり紙の 文（来た 回数 visits。1 から）。 */
export const boshuLine = (visits: number): string => {
	const v = Math.max(1, visits);
	const c = BS_CLUBS[(v - 1) % BS_CLUBS.length];
	const n = boshuNumber(c.base + v);
	return c.hane
		? fillText(BS_MSG.boshu.hane, { n })
		: fillText(BS_MSG.boshu.part, { club: c.name, n });
};

// ───────────────── おんｊボカロ一覧 ─────────────────

/** 安価で 作った 子。 */
export type VocaMade = { name: string; look: string; tic: string };

/** 一覧の 名前（町に いる 子 ぜんぶ）。 */
export const rosterNames = (): string[] => [...BS_MSG.vc.official];

/** 一覧の 窓（名前を「　」で つないで 2行ずつ）。 */
export const rosterWindows = (names: readonly string[]): string[] =>
	pairWindows(packLines(names));

/** 安価で 作った 子（新しい 2人まで）と エター の 数の 1窓（どちらも 無ければ null）。 */
export const madeWindow = (
	made: readonly { name: string }[],
	eta: number,
): string | null => {
	const latest = [...made]
		.reverse()
		.map((m) => fillText(BS_MSG.vc.madeName, { name: m.name }));
	let l1 = latest[0] ?? "";
	let shown = latest.length ? 1 : 0;
	if (latest[1] && textWidth(`${l1}　${latest[1]}`) <= 22) {
		l1 = `${l1}　${latest[1]}`;
		shown = 2;
	}
	const tail = [
		made.length > shown
			? fillText(BS_MSG.vc.rest, { n: made.length - shown })
			: "",
		eta > 0 ? fillText(BS_MSG.vc.eta, { n: eta }) : "",
	]
		.filter(Boolean)
		.join("　");
	if (!l1 && !tail) return null;
	return [l1, tail].filter(Boolean).join("\n");
};

// ───────────────── 乱数の 道具 ─────────────────

/** まぜた 写し（Fisher–Yates）。 */
const shuffle = <T>(a: readonly T[], rand: Rand): T[] => {
	const b = [...a];
	for (let i = b.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[b[i], b[j]] = [b[j], b[i]];
	}
	return b;
};

/** ちがう n 個を 取る。 */
const pickN = <T>(pool: readonly T[], n: number, rand: Rand): T[] => {
	const p = [...pool];
	const out: T[] = [];
	while (out.length < n && p.length)
		out.push(p.splice(Math.floor(rand() * p.length), 1)[0]);
	return out;
};

/** 安価の 3択（ちがう 3つ。pool が 3つ に 足りなければ all から）。 */
export const pick3 = <T>(
	pool: readonly T[],
	all: readonly T[],
	rand: Rand,
): T[] => pickN(pool.length >= 3 ? pool : all, 3, rand);

// ───────────────── ワードウルフ（人狼部「おんｊ村」） ─────────────────

/** お題の 組（common は どちらにも 合う・own[0] は a だけ・own[1] は b だけ。どれも 8 幅まで）。 */
export type WwPair = {
	id: string;
	a: string;
	b: string;
	common: readonly string[];
	own: readonly [readonly string[], readonly string[]];
};

/** ワードウルフの お題。 */
export const WW_PAIRS: readonly WwPair[] = [
	{
		id: "tako",
		a: "たこ焼き",
		b: "お好み焼き",
		common: ["ソースをかける", "鉄板で焼く", "青のりがのる"],
		own: [
			["まるい", "ようじで食う", "中があつい", "具は1つ"],
			["ヘラで切る", "キャベツが多い", "ひっくり返す", "平べったい"],
		],
	},
	{
		id: "nighter",
		a: "ナイター",
		b: "デーゲーム",
		common: ["球場で見る", "ビールがうまい", "応援歌がある"],
		own: [
			["照明がつく", "仕事のあと", "夜風がさむい", "星が見える"],
			["日焼けする", "昼から飲む", "まぶしい", "帽子がいる"],
		],
	},
	{
		id: "soba",
		a: "立ち食いそば",
		b: "牛丼",
		common: ["すぐ出てくる", "安い", "朝もやってる"],
		own: [
			["すする", "天かすを入れる", "立って食う", "わかめ"],
			["つゆだく", "紅しょうが", "どんぶり", "肉がのる"],
		],
	},
	{
		id: "sento",
		a: "銭湯",
		b: "海水浴",
		common: ["水に入る", "タオルがいる", "はだしになる"],
		own: [
			["湯があつい", "番台がある", "牛乳を飲む", "富士山の絵"],
			["しょっぱい", "砂がつく", "浮き輪", "日焼けする"],
		],
	},
	{
		id: "kiriban",
		a: "1000取り",
		b: "2ゲット",
		common: ["スレの番号", "早い者勝ち", "書いたら勝ち"],
		own: [
			["スレの最後", "次スレへ", "埋まるころ", "梅がならぶ"],
			["スレの最初", "立った直後", ">>1のすぐ下", "ズサー"],
		],
	},
	{
		id: "age",
		a: "age",
		b: "sage",
		common: ["メール欄に書く", "スレの順番", "1レスで効く"],
		own: [
			["上に上がる", "人を呼ぶ", "目立つ", "連打される"],
			["上がらない", "こっそり", "目立たない", "空気を読む"],
		],
	},
	{
		id: "jikkyo",
		a: "実況スレ",
		b: "雑談スレ",
		common: ["書きこむ", "人が集まる", "スレが立つ"],
		own: [
			["試合中だけ", "次スレが早い", "速すぎる", "得点でわく"],
			["いつでも立つ", "のんびり", "長く続く", "話がそれる"],
		],
	},
	{
		id: "kote",
		a: "コテハン",
		b: "名無し",
		common: ["書きこむ", "スレにいる", "IDが出る"],
		own: [
			["名前で呼ばれる", "◆がつく", "目立つ", "あいさつされる"],
			["だれでもない", "みんな同じ", "気楽", "まぎれる"],
		],
	},
	{
		id: "kissa",
		a: "喫茶店",
		b: "ファミレス",
		common: ["席で待つ", "コーヒーがある", "長居できる"],
		own: [
			["マスターがいる", "ナポリタン", "古いレコード", "カウンター"],
			["ドリンクバー", "ボタンで呼ぶ", "夜中も開いてる", "お子様ランチ"],
		],
	},
	{
		id: "tsuri",
		a: "釣り",
		b: "虫とり",
		common: ["夏休みにやる", "網を使う", "待つのが大事"],
		own: [
			["竿をたらす", "エサをつける", "海や川", "ボウズ"],
			["木に登る", "かごに入れる", "森でさがす", "カブトムシ"],
		],
	},
	{
		id: "matsuri",
		a: "夏祭り",
		b: "初詣",
		common: ["屋台が出る", "人が多い", "神社に行く"],
		own: [
			["浴衣を着る", "夜にやる", "金魚すくい", "花火"],
			["さむい", "年のはじめ", "おみくじ", "おさいせん"],
		],
	},
	{
		id: "yuki",
		a: "雪だるま",
		b: "かまくら",
		common: ["雪で作る", "冬にやる", "手がつめたい"],
		own: [
			["顔をつける", "バケツをかぶる", "外に立ってる", "2段"],
			["中に入る", "甘酒を飲む", "穴をほる", "ろうそく"],
		],
	},
	{
		id: "gakki",
		a: "ピアノ",
		b: "ギター",
		common: ["弾く", "練習がいる", "楽譜を見る"],
		own: [
			["鍵盤", "白と黒", "ふたを開ける", "重い"],
			["弦をはじく", "ピック", "肩にかける", "指が痛くなる"],
		],
	},
];

/** 名無しの ID（4文字。数字の 並びで 別の 意味に ならない もの）。 */
export const WW_IDS = [
	"Ab3x",
	"Qm7T",
	"kZ2p",
	"Hn8c",
	"Wd4R",
	"tL6v",
	"Ye9s",
	"Rk5M",
	"uJ3f",
	"Gx7n",
	"Cb2w",
	"pV8e",
] as const;

/** 1回分の 配り。 */
export type WwDeal = {
	pair: WwPair;
	/** キリコと 村人の お題（0 = a・1 = b）。人狼は もう 片方。 */
	major: 0 | 1;
	/** 人狼の 席（0〜4。2 は 部長）。 */
	wolf: number;
	/** 席の ID（5つ、ちがう もの。ids[WW_BUCHO] は 使わない）。 */
	ids: readonly string[];
	/** 1周目・2周目の ひとこと（席ごと）。 */
	hints: readonly [readonly string[], readonly string[]];
};

export const WW_SEATS = 5;
/** まん中の 席は 人狼部の 部長（板では ID の かわりに「部長」）。 */
export const WW_BUCHO = 2;
/** 1周目に どちらにも 合う ことを 言う 割合（人狼は 隠れたいので 多め）。 */
export const WW_WOLF_COMMON = 0.75;
export const WW_VILLAGER_COMMON = 0.5;
/** 2周目：人狼が ぼかす 割合・村人 1人が ぼかす 割合。 */
export const WW_WOLF_COMMON2 = 0.25;
export const WW_VILLAGER_NOISE2 = 0.25;

/**
 * 配る。1周目は どちらにも 合う ことか 自分の お題だけの こと（人狼は どちらにも 合う ことが 多め）。
 * 2周目は ふつう 自分の お題だけの こと。人狼は WW_WOLF_COMMON2 で、村人 1人は WW_VILLAGER_NOISE2 で ぼかす。
 * 1つの 周で 同じ ことは 言わない。2周目は 1周目と ちがう こと。
 */
export const wwDeal = (rand: Rand): WwDeal => {
	const pair = WW_PAIRS[Math.floor(rand() * WW_PAIRS.length)];
	const major: 0 | 1 = rand() < 0.5 ? 0 : 1;
	const minor = major === 0 ? 1 : 0;
	const wolf = Math.floor(rand() * WW_SEATS);
	const ids = shuffle(WW_IDS, rand).slice(0, WW_SEATS);
	const ownOf = (i: number) => (i === wolf ? pair.own[minor] : pair.own[major]);
	// 1周目
	const r1: string[] = [];
	const used = new Set<string>();
	for (let i = 0; i < WW_SEATS; i++) {
		const first =
			rand() < (i === wolf ? WW_WOLF_COMMON : WW_VILLAGER_COMMON)
				? pair.common
				: ownOf(i);
		const second = first === pair.common ? ownOf(i) : pair.common;
		const pick =
			[...shuffle(first, rand), ...shuffle(second, rand)].find(
				(h) => !used.has(h),
			) ?? first[0];
		used.add(pick);
		r1.push(pick);
	}
	// 2周目
	const vague = new Set<number>();
	if (rand() < WW_WOLF_COMMON2) vague.add(wolf);
	if (rand() < WW_VILLAGER_NOISE2) {
		const vs = [0, 1, 2, 3, 4].filter((i) => i !== wolf);
		vague.add(vs[Math.floor(rand() * vs.length)]);
	}
	let r2: string[] | null = null;
	for (let tries = 0; tries < 20 && !r2; tries++) {
		const used2 = new Set<string>();
		const out: string[] = [];
		for (let i = 0; i < WW_SEATS; i++) {
			const pool = vague.has(i) ? pair.common : ownOf(i);
			const pick = shuffle(pool, rand).find(
				(h) => !used2.has(h) && h !== r1[i],
			);
			if (!pick) break;
			used2.add(pick);
			out.push(pick);
		}
		if (out.length === WW_SEATS) r2 = out;
	}
	const round2 =
		r2 ??
		Array.from(
			{ length: WW_SEATS },
			(_, i) => shuffle(vague.has(i) ? pair.common : ownOf(i), rand)[0],
		);
	return { pair, major, wolf, ids, hints: [r1, round2] };
};

export type WwVerdict = "first" | "second" | "miss";

/** 投票の 結果（1周目で 当てた・2周目で 当てた・はずれ）。 */
export const wwVerdict = (d: WwDeal, vote: number, round: 1 | 2): WwVerdict =>
	vote !== d.wolf ? "miss" : round === 1 ? "first" : "second";

/** その 席の お題（人狼なら もう 片方）。 */
export const wwWord = (d: WwDeal, seat: number | "kiriko"): string => {
	const side = seat === d.wolf ? 1 - d.major : d.major;
	return side === 0 ? d.pair.a : d.pair.b;
};

/** 席の 名（名無しは ID、まん中の 席は 部長）。 */
export const wwWho = (d: WwDeal, seat: number): string =>
	seat === WW_BUCHO
		? BS_BOARD.ww.bucho
		: fillText(BS_BOARD.ww.id, { id: d.ids[seat] });

// ───────────────── うろ覚えお糸会かき大会（お糸会かき部） ─────────────────

/** 48×48 の 箱の 中の 形（disc 塗った 楕円・ring 輪郭の 楕円・rect 四角・tri 三角・line 折れ線）。tag は くずし方の 目じるし。 */
export type OePart =
	| {
			k: "disc" | "ring";
			x: number;
			y: number;
			r: number;
			ry?: number;
			c: string;
			tag?: string;
	  }
	| {
			k: "rect";
			x: number;
			y: number;
			w: number;
			h: number;
			c: string;
			tag?: string;
	  }
	| { k: "tri" | "line"; pts: readonly number[]; c: string; tag?: string };

export type OeTopic = {
	id: string;
	name: string;
	/** 色を かえる・消さない 部分。 */
	main: string;
	/** 色ちがいの 色（無い お題は 色ちがいに しない。自販機は 色が いろいろ あるので 無し）。 */
	wrong?: string;
	/** 1つ ふやす 部分と ずらし。 */
	extra: { tag: string; dx: number; dy: number };
	/** 消して よい 大きな 部分（main は 入れない。extra.tag 以外が 1つは ある）。 */
	drops: readonly string[];
	/** 顔（のびると「そんな　顔　長かったんか」）。 */
	face?: true;
	/** ふやした ときの 名無しの ひとこと（無ければ extra）。 */
	extraNote?: "extraEar" | "extraEye";
	parts: readonly OePart[];
};

/** お題（48×48 の 箱の 座標。色は そのまま 塗る）。 */
export const OE_TOPICS: readonly OeTopic[] = [
	{
		id: "puyu",
		name: "ぷゆゆ",
		main: "face",
		wrong: "#60c060",
		face: true,
		extraNote: "extraEye",
		extra: { tag: "eye", dx: 0, dy: -9 },
		drops: ["eye", "mouth"],
		parts: [
			{ k: "disc", x: 24, y: 26, r: 18, c: "#f8d040", tag: "face" },
			{ k: "ring", x: 24, y: 26, r: 18, c: "#a07010" },
			{ k: "disc", x: 17, y: 25, r: 5, ry: 6, c: "#ffffff", tag: "eye" },
			{ k: "disc", x: 31, y: 25, r: 5, ry: 6, c: "#ffffff", tag: "eye" },
			{ k: "disc", x: 17, y: 26, r: 3, ry: 4, c: "#402010", tag: "eye" },
			{ k: "disc", x: 31, y: 26, r: 3, ry: 4, c: "#402010", tag: "eye" },
			{ k: "line", pts: [12, 17, 19, 15], c: "#402010", tag: "brow" },
			{ k: "line", pts: [36, 17, 29, 15], c: "#402010", tag: "brow" },
			{ k: "line", pts: [21, 36, 24, 34, 27, 36], c: "#402010", tag: "mouth" },
		],
	},
	{
		id: "neko",
		name: "ねこ",
		main: "face",
		wrong: "#5080e0",
		face: true,
		extraNote: "extraEar",
		extra: { tag: "ear", dx: 11, dy: -3 },
		drops: ["ear", "whisker"],
		parts: [
			{ k: "tri", pts: [9, 20, 13, 6, 21, 15], c: "#e0a050", tag: "ear" },
			{ k: "tri", pts: [39, 20, 35, 6, 27, 15], c: "#e0a050", tag: "ear" },
			{ k: "disc", x: 24, y: 27, r: 16, ry: 14, c: "#e0a050", tag: "face" },
			{ k: "disc", x: 18, y: 25, r: 2, c: "#202020", tag: "eye" },
			{ k: "disc", x: 30, y: 25, r: 2, c: "#202020", tag: "eye" },
			{ k: "disc", x: 24, y: 30, r: 1.5, c: "#d04060" },
			{ k: "line", pts: [6, 29, 15, 30], c: "#202020", tag: "whisker" },
			{ k: "line", pts: [6, 34, 15, 32], c: "#202020", tag: "whisker" },
			{ k: "line", pts: [42, 29, 33, 30], c: "#202020", tag: "whisker" },
			{ k: "line", pts: [42, 34, 33, 32], c: "#202020", tag: "whisker" },
		],
	},
	{
		id: "vend",
		name: "自販機",
		main: "body",
		extra: { tag: "slot", dx: 0, dy: -12 },
		drops: ["drink", "slot"],
		parts: [
			{ k: "rect", x: 10, y: 4, w: 28, h: 42, c: "#d03030", tag: "body" },
			{ k: "rect", x: 13, y: 7, w: 22, h: 16, c: "#f0f0f0", tag: "panel" },
			{ k: "rect", x: 15, y: 9, w: 4, h: 5, c: "#3060d0", tag: "drink" },
			{ k: "rect", x: 22, y: 9, w: 4, h: 5, c: "#f0c020", tag: "drink" },
			{ k: "rect", x: 29, y: 9, w: 4, h: 5, c: "#40a040", tag: "drink" },
			{ k: "rect", x: 15, y: 16, w: 4, h: 5, c: "#e06020", tag: "drink" },
			{ k: "rect", x: 22, y: 16, w: 4, h: 5, c: "#8040c0", tag: "drink" },
			{ k: "rect", x: 29, y: 16, w: 4, h: 5, c: "#3060d0", tag: "drink" },
			{ k: "rect", x: 14, y: 36, w: 20, h: 5, c: "#202020", tag: "slot" },
		],
	},
	{
		id: "post",
		name: "郵便ポスト",
		main: "body",
		wrong: "#3060d0",
		extra: { tag: "slot", dx: 0, dy: 9 },
		drops: ["slot", "label"],
		parts: [
			{ k: "disc", x: 24, y: 12, r: 12, ry: 6, c: "#d82828", tag: "body" },
			{ k: "rect", x: 12, y: 12, w: 24, h: 30, c: "#d82828", tag: "body" },
			{ k: "rect", x: 16, y: 16, w: 16, h: 3, c: "#202020", tag: "slot" },
			{ k: "rect", x: 18, y: 24, w: 12, h: 8, c: "#f4f4f0", tag: "label" },
			{ k: "rect", x: 20, y: 42, w: 8, h: 5, c: "#404040", tag: "leg" },
		],
	},
	{
		id: "torokko",
		name: "トロッコ",
		main: "body",
		wrong: "#d050a0",
		extra: { tag: "wheel", dx: 9, dy: 0 },
		drops: ["rail", "wheel"],
		parts: [
			{ k: "line", pts: [2, 42, 46, 42], c: "#806040", tag: "rail" },
			{ k: "tri", pts: [6, 14, 42, 14, 36, 34], c: "#8a5a30", tag: "body" },
			{ k: "tri", pts: [6, 14, 12, 34, 36, 34], c: "#8a5a30", tag: "body" },
			{ k: "line", pts: [6, 14, 42, 14], c: "#4a2a10" },
			{ k: "disc", x: 15, y: 37, r: 4, c: "#303030", tag: "wheel" },
			{ k: "disc", x: 33, y: 37, r: 4, c: "#303030", tag: "wheel" },
		],
	},
	{
		id: "gramo",
		name: "蓄音機",
		main: "horn",
		wrong: "#40a0e0",
		extra: { tag: "horn", dx: -14, dy: 6 },
		drops: ["box", "record"],
		parts: [
			{ k: "rect", x: 8, y: 30, w: 30, h: 14, c: "#8a5a30", tag: "box" },
			{ k: "disc", x: 23, y: 30, r: 11, ry: 2, c: "#202020", tag: "record" },
			{ k: "line", pts: [26, 29, 32, 18], c: "#c0a040", tag: "arm" },
			{ k: "tri", pts: [30, 20, 44, 4, 46, 18], c: "#e0b030", tag: "horn" },
			{ k: "disc", x: 45, y: 11, r: 3, ry: 7, c: "#c09020", tag: "horn" },
		],
	},
	{
		id: "takoyaki",
		name: "たこ焼き",
		main: "ball",
		wrong: "#f0f0f0",
		extra: { tag: "ball", dx: 0, dy: -9 },
		drops: ["tray", "sauce"],
		parts: [
			{ k: "tri", pts: [4, 30, 44, 30, 38, 42], c: "#f0e0b0", tag: "tray" },
			{ k: "tri", pts: [4, 30, 10, 42, 38, 42], c: "#f0e0b0", tag: "tray" },
			{ k: "disc", x: 14, y: 28, r: 7, c: "#b06a30", tag: "ball" },
			{ k: "disc", x: 25, y: 26, r: 7, c: "#b06a30", tag: "ball" },
			{ k: "disc", x: 35, y: 29, r: 7, c: "#b06a30", tag: "ball" },
			{
				k: "line",
				pts: [10, 24, 18, 23, 22, 25, 30, 22, 38, 25],
				c: "#4a2010",
				tag: "sauce",
			},
			{ k: "line", pts: [28, 12, 34, 30], c: "#e8d090", tag: "pick" },
		],
	},
	{
		id: "onigiri",
		name: "おにぎり",
		main: "rice",
		wrong: "#e070a0",
		extra: { tag: "nori", dx: 0, dy: -18 },
		drops: ["nori", "edge"],
		parts: [
			{ k: "tri", pts: [24, 4, 4, 42, 44, 42], c: "#fafaf4", tag: "rice" },
			{
				k: "line",
				pts: [24, 4, 4, 42, 44, 42, 24, 4],
				c: "#a0a0a0",
				tag: "edge",
			},
			{ k: "rect", x: 16, y: 30, w: 16, h: 12, c: "#203020", tag: "nori" },
		],
	},
];

export type OeKind =
	| "wobble"
	| "jitter"
	| "drop"
	| "extra"
	| "color"
	| "stretch";

/** くずし方の 重み（正解から どれだけ 遠いか）。 */
export const OE_WEIGHT: Record<OeKind, number> = {
	wobble: 1,
	jitter: 3,
	drop: 3,
	extra: 2,
	color: 2,
	stretch: 2,
};

/** かける 順（extra は drop より 先。同じ 絵の drop は extra の 部分を 消さない）。 */
export const OE_ORDER: readonly OeKind[] = [
	"wobble",
	"jitter",
	"extra",
	"drop",
	"color",
	"stretch",
];

/** 軽い くずし方（color は wrong の ある お題だけ）。 */
export const oeMild = (t: OeTopic): OeKind[] => [
	"extra",
	"stretch",
	...(t.wrong ? (["color"] as const) : []),
];

/** 遠い 絵に 使える くずし方 ぜんぶ。 */
export const oeFar = (t: OeTopic): OeKind[] => ["jitter", "drop", ...oeMild(t)];

export type OeDrawing = { parts: OePart[]; kinds: OeKind[]; error: number };

/** 形を ずらす。 */
const movePart = (p: OePart, dx: number, dy: number): OePart =>
	"pts" in p
		? { ...p, pts: p.pts.map((v, i) => v + (i % 2 ? dy : dx)) }
		: { ...p, x: p.x + dx, y: p.y + dy };

/** 縦に のばす（(24, 24) を 中心に 横 0.8・縦 1.45）。 */
const STRETCH_X = 0.8;
const STRETCH_Y = 1.45;
const stretchPart = (p: OePart): OePart => {
	const sx = (v: number) => 24 + (v - 24) * STRETCH_X;
	const sy = (v: number) => 24 + (v - 24) * STRETCH_Y;
	if ("pts" in p)
		return { ...p, pts: p.pts.map((v, i) => (i % 2 ? sy(v) : sx(v))) };
	if (p.k === "rect")
		return {
			...p,
			x: sx(p.x),
			y: sy(p.y),
			w: p.w * STRETCH_X,
			h: p.h * STRETCH_Y,
		};
	return {
		...p,
		x: sx(p.x),
		y: sy(p.y),
		r: p.r * STRETCH_X,
		ry: (p.ry ?? p.r) * STRETCH_Y,
	};
};

/** くずし方を 1つ かける（kinds は この 絵に かける ぜんぶ）。 */
const applyKind = (
	parts: OePart[],
	kind: OeKind,
	t: OeTopic,
	kinds: readonly OeKind[],
	rand: Rand,
): OePart[] => {
	if (kind === "wobble" || kind === "jitter") {
		// 整数の ずれ（wobble は −1〜1、jitter は −5〜5）
		const d = kind === "wobble" ? 1 : 5;
		return parts.map((p) => {
			const dx = Math.round((rand() * 2 - 1) * d);
			const dy = Math.round((rand() * 2 - 1) * d);
			return movePart(p, dx, dy);
		});
	}
	if (kind === "drop") {
		const tags = t.drops.filter(
			(g) => !(kinds.includes("extra") && g === t.extra.tag),
		);
		const g = tags[Math.floor(rand() * tags.length)];
		return parts.filter((p) => p.tag !== g);
	}
	if (kind === "extra") {
		const src = parts.find((p) => p.tag === t.extra.tag);
		return src ? [...parts, movePart(src, t.extra.dx, t.extra.dy)] : parts;
	}
	if (kind === "color")
		return parts.map((p) =>
			p.tag === t.main && t.wrong ? { ...p, c: t.wrong } : p,
		);
	return parts.map(stretchPart);
};

/** kinds を OE_ORDER の 順に そろえて かける。error は 重みの 合計。 */
export const oeDrawing = (
	t: OeTopic,
	kinds: readonly OeKind[],
	rand: Rand,
): OeDrawing => {
	const ks = OE_ORDER.filter((k) => kinds.includes(k));
	let parts: OePart[] = t.parts.map((p) => ({ ...p }));
	for (const k of ks) parts = applyKind(parts, k, t, ks, rand);
	return { parts, kinds: ks, error: ks.reduce((n, k) => n + OE_WEIGHT[k], 0) };
};

/**
 * 1問（3枚。まぜて 返す。best は いちばん 近い 1枚で、必ず 1つだけ）。
 * 1問目：近い 1枚は wobble だけ、遠い 2枚は くずし方 2つずつ。
 * 2問目：近い 1枚にも 軽い くずれ 1つ（x）、遠い 2枚は 2つずつ（数を くらべる）。
 * 3問目：3枚とも x が あり、遠い 2枚は さらに 1つずつ（別々）。
 */
export const oeRound = (
	t: OeTopic,
	round: 0 | 1 | 2,
	rand: Rand,
): { drawings: OeDrawing[]; best: number } => {
	const far = oeFar(t);
	let sets: OeKind[][];
	if (round === 0) {
		const a = pickN(far, 2, rand);
		const b = pickN(
			far.filter((k) => k !== a[0]),
			2,
			rand,
		);
		sets = [[], a, b];
	} else {
		const x = pickN(oeMild(t), 1, rand)[0];
		if (round === 1) sets = [[x], pickN(far, 2, rand), pickN(far, 2, rand)];
		else {
			const [y, z] = pickN(
				far.filter((k) => k !== x),
				2,
				rand,
			);
			sets = [[x], [x, y], [x, z]];
		}
	}
	const set = shuffle(
		sets.map((ks) => oeDrawing(t, ["wobble", ...ks], rand)),
		rand,
	);
	const best = set.reduce((bi, d, i) => (d.error < set[bi].error ? i : bi), 0);
	return { drawings: set, best };
};

/** 1回分の お題 3つ（ちがう もの）。 */
export const oeSession = (rand: Rand): OeTopic[] => pickN(OE_TOPICS, 3, rand);

/** 選んだ 1枚への 名無しの ひとこと（正解なら ほめる、ちがえば 正解に ない くずし方の うち 最初の もの）。 */
export const oeReaction = (
	t: OeTopic,
	chosen: OeDrawing,
	best: OeDrawing,
	rand: Rand,
): string => {
	const B = BS_BOARD.oe;
	if (chosen === best) return B.ok[Math.floor(rand() * B.ok.length)];
	const k = chosen.kinds.find((x) => x !== "wobble" && !best.kinds.includes(x));
	if (k === "extra") return B[t.extraNote ?? "extra"];
	if (k === "stretch") return t.face ? B.stretch : B.stretchThing;
	if (k === "jitter") return B.jitter;
	if (k === "color") return B.color;
	return B.drop;
};

// ───────────────── 校歌　斉唱（合唱部） ─────────────────

/**
 * 校歌の さいごの「あ」。息の 長さ（cap。8〜22秒）は 見せず、顔色で 知らせる（青ざめる・もっと 青い）。
 * A で 歌いだし、もう一度 A で しめる。息が 切れる 前に しめれば 長いほど よい（伸ばせるだけ 伸ばす 伝統）。
 */
export const KK = {
	capMin: 8000,
	capMax: 22000,
	pale: 0.6,
	blue: 0.85,
	cueMs: 1200,
	stepMs: 500,
} as const;

export type KoukaSt = {
	cap: number;
	t: number;
	state: "ready" | "hold" | "cut" | "fell";
};

export const koukaStart = (rand: Rand): KoukaSt => ({
	cap: KK.capMin + Math.floor(rand() * (KK.capMax - KK.capMin)),
	t: 0,
	state: "ready",
});

/** 歌いだす。 */
export const koukaPress = (st: KoukaSt): void => {
	if (st.state === "ready") st.state = "hold";
};

/** dt ms 伸ばす（息が 切れたら fell）。 */
export const koukaTick = (st: KoukaSt, dt: number): void => {
	if (st.state !== "hold") return;
	st.t += dt;
	if (st.t >= st.cap) {
		st.t = st.cap;
		st.state = "fell";
	}
};

/** しめる（指揮の しめ）。 */
export const koukaCut = (st: KoukaSt): void => {
	if (st.state === "hold") st.state = "cut";
};

/** 顔色（0 ふつう・1 青ざめ・2 もっと 青い）。息の 残りは 見せず、顔で 知らせる。 */
export const koukaFace = (st: KoukaSt): 0 | 1 | 2 =>
	st.t < st.cap * KK.pale ? 0 : st.t < st.cap * KK.blue ? 1 : 2;

/** のばした 長さ（0.1秒。息が 切れたら 0）。 */
export const koukaTenths = (st: KoukaSt): number =>
	st.state === "cut" ? Math.floor(st.t / 100) : 0;

/** 息の つかいかた（千分率。しめた ときだけ）。 */
export const koukaRatio = (st: KoukaSt): number =>
	st.state === "cut" ? Math.floor((1000 * st.t) / st.cap) : 0;

/** のこりの 息（0.1秒）。 */
export const koukaMargin = (st: KoukaSt): number =>
	Math.max(0, Math.floor((st.cap - st.t) / 100));

/** 吹き出しの「あ〜〜」（500ms ごとに 〜 が 1つ。見せるのは うしろ 12字）。 */
export const koukaBubble = (st: KoukaSt): string =>
	`あ${"〜".repeat(Math.floor(st.t / KK.stepMs))}`.slice(-12);

/** しめた ときの 1行（BS_BOARD.kk.cut の 番号）。 */
export const koukaGrade = (st: KoukaSt): 0 | 1 | 2 => koukaFace(st);
