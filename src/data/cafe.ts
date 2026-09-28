// 喫茶「保守」（村の 西の 空き地。町の 段5 から）で 聞ける 話。ui/cafe.ts が 一覧に して 見せる。
// 仲間ひとりの 話と、ふたり・みんなの 掛け合い。どれも 寄り道で、何も くれない（聞いた 印だけ 残る）。
// 1行は 全角22字・2行まで。説明せず、行間を 読ませる。キリコは しゃべらない（ナレーションで 動作だけ）。

import type { Speaker } from "./quotes";

export type CafeLine = { who: Speaker | null; text: string };

export type CafeTalk = {
	id: string;
	/** 一覧に 出す 題。 */
	title: string;
	/** 話す 人（一覧の 名前に 出す）。 */
	cast: readonly Speaker[];
	/** この 町の 段から 聞ける（無ければ 喫茶が 建った とき から）。 */
	from?: number;
	/** cast[0] に これだけ 一杯 おごったら 聞ける（推すと 話が ふえる）。 */
	treats?: number;
	lines: readonly CafeLine[];
};

const s = (who: Speaker, text: string): CafeLine => ({ who, text });
const n = (text: string): CafeLine => ({ who: null, text });

export const CAFE_TALKS: readonly CafeTalk[] = [
	{
		id: "roze_mabo",
		title: "麻婆豆腐の　ひみつ",
		cast: ["roze"],
		lines: [
			s("roze", "麻婆豆腐の　ひみつ、\n知りたいアル？"),
			n("キリコは　うなずいた。"),
			s("roze", "……ひみつは、ないアル。\n毎日　同じに　作るだけアル"),
			s(
				"roze",
				"同じ　味が　毎日　あるのは、\n常識アル。……いちばん　むずかしいアル",
			),
		],
	},
	{
		id: "shiyo_key",
		title: "倉庫の　鍵",
		cast: ["shiyo"],
		lines: [
			s("shiyo", "倉庫の　鍵？　……あたすが\n持ってるわよ。ずっと"),
			s("shiyo", "あずかった　物は、あずけた人が\n帰ってくるまで　あずかるの"),
			s("shiyo", "……帰って　こなかった　人の　物も、\nまだ　棚に　あるわ"),
			s(
				"shiyo",
				"な、なによ。捨てないわよ。\n……いつか　取りに　来るかも　しれないでしょ",
			),
		],
	},
	{
		id: "feris_sneeze",
		title: "くしゃみの　わけ",
		cast: ["feris"],
		lines: [
			s("feris", "私の　くしゃみ、\nなんで　出るか　知ってる〜？"),
			s("feris", "だれかが　うわさ　してると\n出るんだって〜"),
			s(
				"feris",
				"……さいきん、あんまり　出ないんだ〜。\nうわさする人、へったのかな〜",
			),
			n("フェリスは　窓の　外を　見た。"),
			s("feris", "……へくちっ。\nあ、いまの　キリコ〜？"),
		],
	},
	{
		id: "zero_folder",
		title: "宝物フォルダ",
		cast: ["zero"],
		lines: [
			s("zero", "ゼロの　宝物フォルダには、\nみなさんの　ログが　入っています"),
			s(
				"zero",
				"消えそうな　スレを　見つけたら、\nこっそり　保存しているんです",
			),
			s("zero", "……ゼロが　保存しても、\nスレが　生き返るわけでは　ありません"),
			s(
				"zero",
				"でも、だれかが　書いた　ことは、\nなくならない。……と、思いたいです",
			),
		],
	},
	{
		id: "nanj_yakiu",
		title: "やきう",
		cast: ["nanj"],
		lines: [
			s("nanj", "ナイター、今日も　やっとるで。\n……実況スレ、立ってへんけどな"),
			s("nanj", "むかしは　1試合で\nPart10　まで　いったんや"),
			s("nanj", "いまは　ワイが　ひとりで\n「ナイスー」言うとる。……草"),
			s("nanj", "ひとりでも　言うとったら、\nだれか　来るかも　しれんしな"),
		],
	},
	{
		id: "roze_quiet",
		title: "おんJが　静かに　なった　日",
		cast: ["roze"],
		lines: [
			s("roze", "むかしの　おんJは、\nうるさかったアル"),
			s(
				"roze",
				"ある日　ひとり　いなくなって、\nつぎの日も　ひとり　いなくなったアル",
			),
			s(
				"roze",
				"みんな、よその　板に　行ったアル。\n……けんかした　わけじゃ　ないアル",
			),
			s(
				"roze",
				"わたしは、店を　あけておくアル。\nもどってきたら、麻婆豆腐が　いるアル",
			),
		],
	},
	{
		id: "nanj_1000",
		title: "1000まで　いった　スレ",
		cast: ["nanj"],
		lines: [
			s("nanj", "1000まで　埋まった　スレ、\n見たこと　あるか？"),
			s("nanj", "埋まる　ときは　お祭りや。\nみんなで「1000なら」言うてな"),
			s(
				"nanj",
				"……落ちる　スレの　ほとんどは、\n1000まで　行かんと　落ちるんや",
			),
			s("nanj", "せやから　保守するんや。\n1000まで、つれてったらな　あかん"),
		],
	},
	{
		id: "zero_datsound",
		title: "dat落ちの　音",
		cast: ["zero"],
		lines: [
			s("zero", "スレが　落ちる　とき、\n音が　するの、知っていますか？"),
			n("キリコは　首を　かしげた。"),
			s(
				"zero",
				"……しません。ほんとうは。\nでも、ゼロには　聞こえる　気が　します",
			),
			s("zero", "キリコさんの　蓄音機なら、\n録れるかも　しれませんね"),
		],
	},
	{
		id: "roze_shiyo",
		title: "常識と　ツンデレ",
		cast: ["roze", "shiyo"],
		lines: [
			s("roze", "シヨ、今日も　お茶を\n2つ　いれてたアル"),
			s("shiyo", "い、いれてないわよ！\n……1つは　予備よ"),
			s("roze", "予備を　いれるのは　常識アル。\n……キリコの　ぶんアル"),
			s(
				"shiyo",
				"ちがうって　言ってるでしょ！\n……さめる　前に　飲みなさいよね",
			),
		],
	},
	{
		id: "feris_zero",
		title: "空を　飛ぶ",
		cast: ["feris", "zero"],
		lines: [
			s("feris", "ゼロちゃん、飛べる〜？\n私は　ちょっとだけ　飛べるよ〜"),
			s("zero", "ゼロは　飛べません。\n……レンなら、次の　更新で　飛べるかも"),
			s("feris", "じゃあ　いっしょに　植民地まで\n見に　行こうよ〜"),
			s("zero", "……キリコさんが　歩いた　道を、\n上から　見てみたいです"),
		],
	},
	{
		id: "zero_nanj",
		title: "保守とは",
		cast: ["zero", "nanj"],
		lines: [
			s("zero", "やきうさん。保守って、\nなんのために　するんですか？"),
			s("nanj", "なんのためて……。\n落としたく　ないからや"),
			s("zero", "読む人が　いなくても、ですか？"),
			s(
				"nanj",
				"いつか　読むやつが　来るかも\nしれんやろ。……キリコ　みたいにな",
			),
		],
	},
	{
		id: "shiyo_feris",
		title: "キリコは　しゃべらない",
		cast: ["shiyo", "feris"],
		lines: [
			s("shiyo", "キリコって、ぜんぜん\nしゃべらないわよね"),
			s("feris", "しゃべってるよ〜。\n蓄音機で〜"),
			s("shiyo", "……あれは　しゃべってるって\n言うの？"),
			s("feris", "言うよ〜。\nざらざら　って　言ってるもん〜"),
			n("キリコは　ハンドルを　まわした。\nざらざら、と　鳴った。"),
		],
	},
	{
		id: "nanj_roze",
		title: "植民地の　思い出",
		cast: ["nanj", "roze"],
		lines: [
			s("nanj", "パン板な、ワイ　むかし\n住んどったことあるんや"),
			s("roze", "パン松に　追い出されたアル？"),
			s("nanj", "やきうの　スレ　立てたらな。\n……ええ板やったで"),
			s("roze", "追い出されても　ええ板なのは、\n常識アル"),
		],
	},
	{
		id: "shiyo_zero",
		title: "帳簿と　倉庫",
		cast: ["shiyo", "zero"],
		from: 6,
		lines: [
			s("zero", "シヨさん、倉庫の　在庫、\nゼロの　帳簿と　合いました！"),
			s("shiyo", "当たり前でしょ。\nあたすが　数えてるんだから"),
			s("zero", "……1つだけ、帳簿に　ない\n物が　あります"),
			s("shiyo", "それは……いいの。\n帰って　こない　人の　物だから"),
		],
	},
	{
		id: "feris_nanj",
		title: "電池板の　うわさ",
		cast: ["feris", "nanj"],
		from: 6,
		lines: [
			s("feris", "電池板って、だれも\nいないのに　スレが　落ちないんだって〜"),
			s("nanj", "だれかが　保守しとるんやろ。\n……見えへん　だれかが"),
			s("feris", "こわい〜。\n……でも、ちょっと　うれしいね〜"),
			s("nanj", "せやな。\n保守する　やつが　おるうちは、板は　死なん"),
		],
	},
	{
		id: "all_next",
		title: "次スレ　会議",
		cast: ["nanj", "roze", "feris", "shiyo", "zero"],
		from: 7,
		lines: [
			s("nanj", "ほな、次スレの　タイトル\n決めよか"),
			s("roze", "「保守村　Part2」で　いいアル。\n常識アル"),
			s("feris", "「キリコと　みんなの　スレ」が\nいい〜"),
			s("shiyo", "……「帰ってくる　場所」。\nな、なによ。案を　出しただけよ"),
			s("zero", "ゼロは、どれでも　いいです。\nみなさんが　書きこむ　なら"),
			n("キリコは　蓄音機の　ハンドルを　まわした。"),
			s("nanj", "……ほな、>>1は　キリコな。\n決まりや"),
		],
	},
];

// ───────────────── 一杯 おごる（倉庫の 草で 作って、仲間に「あちらの　お客様からです」） ─────────────────
// 推しへの 投げ銭。強さには 何も 効かない。一杯ごとに 好みの 仲間（who）が いて、その 仲間に 送ると 特別な 反応
// （飲むのは 受け取った 仲間。キリコは 送るだけ）
// （lines）。ほかの 仲間なら その人の いつもの 反応（TREAT_REACTIONS）。おごった 回数で 話が ふえる（CafeTalk.treats）。

export type CafeDrink = {
	/** 一杯の 名前。 */
	name: string;
	/** 話す 仲間。 */
	who: Speaker;
	lines: readonly CafeLine[];
};

/** 草の 種類 → 一杯（ここに 無い 草は 作れない）。 */
export const CAFE_DRINKS: Readonly<Record<string, CafeDrink>> = {
	h_heal: {
		name: "草スムージー",
		who: "feris",
		lines: [
			s("feris", "草スムージー〜？\n名前が　もう　笑ってるよね〜"),
			s("feris", "……おいしい〜。\n草に　草が　生える　味〜"),
		],
	},
	h_greater: {
		name: "大草原ソーダ",
		who: "nanj",
		lines: [
			s("nanj", "大草原て。\n……しゅわしゅわ　笑っとるやん"),
			s("nanj", "飲んだら　腹筋　鍛えられそうやな"),
		],
	},
	h_poison: {
		name: "荒らしカクテル",
		who: "shiyo",
		lines: [
			s("shiyo", "荒らしカクテル？　あたすに\n荒らしを　送りつける　わけ？"),
			n("シヨは　ひとくち　飲んだ。\n……むせた。"),
			s("shiyo", "……ばか。\n……でも、お礼は　言って　あげる"),
		],
	},
	h_might: {
		name: "プロテインシェイク",
		who: "nanj",
		lines: [
			s("nanj", "おっ、プロテインか。\nワイも　筋トレスレ　住んどった"),
			s("nanj", "……3日で　落ちたけどな"),
		],
	},
	h_growth: {
		name: "忍法帖スムージー",
		who: "feris",
		lines: [
			s("feris", "レアだ〜！\n……レベルが　上がる　味〜"),
			s("feris", "……いいの〜？\nレアなのに〜、ありがと〜"),
		],
	},
	h_swift: {
		name: "kskエスプレッソ",
		who: "zero",
		lines: [
			s("zero", "kskエスプレッソ。飲むと\n書きこみが　速く　なるそうです"),
			s("zero", "……ゼロも　一杯。\n帳簿が　はかどります"),
		],
	},
	h_blind: {
		name: "アク禁ブラック",
		who: "roze",
		lines: [
			s("roze", "まっくろアル。\n……なにも　見えない　味アル"),
			s("roze", "書けない　日も　あるアル。\nそういう　日は、麻婆豆腐アル"),
		],
	},
	h_blink: {
		name: "左遷ティー",
		who: "zero",
		lines: [
			s("zero", "左遷ティー……。\nどこか　遠くへ　飛ばされる　味です"),
			s("zero", "……でも、ゼロは　ここに\nいたいです"),
		],
	},
	h_reel: {
		name: "安価ショット",
		who: "nanj",
		lines: [
			s("nanj", "安価ショットか。\n>>ワイ　一気で、ってことやな"),
			n("やきうは　一気に　飲んだ。"),
			s("nanj", "安価は　絶対や。\n……うまい"),
		],
	},
	h_daze: {
		name: "お花畑ハーブティー",
		who: "feris",
		lines: [
			s("feris", "いい　におい〜。\n頭の　中が　お花畑〜"),
			s("feris", "……いつもと　同じ　だって〜？\nひど〜い"),
		],
	},
	h_sleep: {
		name: "寝落ちミルク",
		who: "shiyo",
		lines: [
			s("shiyo", "寝落ちミルク？　……あたすが\n夜ふかし　してるの、見てたの？"),
			s("shiyo", "……今夜は　ちゃんと　寝るわよ。\nおやすみ"),
		],
	},
	h_antidote: {
		name: "水分補給レモネード",
		who: "roze",
		lines: [
			s("roze", "水分補給は　常識アル。\n……冒険の　前に　飲むアル"),
			s("roze", "すっぱいのも　常識アル"),
		],
	},
	h_fire: {
		name: "燃料投下ショット",
		who: "nanj",
		lines: [
			s("nanj", "燃料投下ショットは　あかん。\nスレが　燃える"),
			n("やきうの　口から　火が　出た。"),
			s("nanj", "……送る　ほうも　送る　ほうや。\n草"),
		],
	},
	h_sight: {
		name: "晒しソーダ",
		who: "zero",
		lines: [
			s("zero", "晒しソーダ……。飲むと、\nぜんぶ　見えるそうです"),
			s("zero", "……キリコさんの　考えている\nことも？"),
		],
	},
};

/** 好みで ない 一杯を もらったときの いつもの 反応（{drink} は 一杯の 名前。回数で かわる）。 */
export const TREAT_REACTIONS: Readonly<
	Record<Speaker, readonly (readonly CafeLine[])[]>
> = {
	nanj: [
		[s("nanj", "{drink}？　……ワイに？\n……おおきに")],
		[s("nanj", "また　おごってくれるんか。\n……ワイ、なんも　返されへんで")],
		[s("nanj", "{drink}、うまいな。\n……キリコ、ええやつやな")],
	],
	roze: [
		[s("roze", "{drink}アル？\n……もらうのも　常識アル。ありがとアル")],
		[
			s(
				"roze",
				"おごられたら　おごり返すのが\n常識アル。……麻婆豆腐で　いいアル？",
			),
		],
		[s("roze", "{drink}、しみるアル。\n……店を　あけてて　よかったアル")],
	],
	feris: [
		[s("feris", "わ〜、{drink}〜！\n私に〜？　ありがと〜")],
		[s("feris", "また〜？　……へくちっ。\nうわさ　されてる　気が　する〜")],
		[s("feris", "キリコの　おごり、\n宝物に　する〜。……飲んじゃうけど〜")],
	],
	shiyo: [
		[s("shiyo", "な、なによ。{drink}？\n……べつに　うれしく　ないわよ")],
		[s("shiyo", "また　おごって……。\nあたすに　なにか　たくらんでるでしょ")],
		[
			s(
				"shiyo",
				"……{drink}、おいしい。\nい、いまのは　聞かなかった　ことに　して",
			),
		],
	],
	zero: [
		[s("zero", "ゼロに　{drink}を？\n……帳簿に　書いて　おきます！")],
		[s("zero", "おごられた　回数、ゼロの\n宝物フォルダで　いちばん　多いです")],
		[s("zero", "{drink}……。飲めませんが、\n……いえ、飲みます。飲みたいです")],
	],
};

/** 推したら 聞ける 話（おごった 回数 3・6）。CAFE_TALKS に 入れる。 */
export const TREAT_TALKS: readonly CafeTalk[] = [
	{
		id: "nanj_bond1",
		title: "やきうの　本名",
		cast: ["nanj"],
		treats: 3,
		lines: [
			s("nanj", "ワイの　名前？　……名無しや。\nずっと　名無しで　書いてきた"),
			s("nanj", "名前が　ないから、どこの　スレにも\nおれるんや。……ええやろ"),
			s("nanj", "でも　キリコは　名前で　呼ぶやろ。\n……それも、悪ないな"),
		],
	},
	{
		id: "nanj_bond2",
		title: "最後の　保守",
		cast: ["nanj"],
		treats: 6,
		lines: [
			s("nanj", "みんな　おらんくなった　夜な、\nワイ、ひとりで　保守しとった"),
			s("nanj", "「保守」「保守」「保守」。\n……だれも　返事せえへん"),
			s("nanj", "そしたら　ある日、\n蓄音機の　音が　したんや"),
			s("nanj", "……キリコやった。\nそれから　ワイ、ここに　おる"),
		],
	},
	{
		id: "roze_bond1",
		title: "ロゼの　店の　名前",
		cast: ["roze"],
		treats: 3,
		lines: [
			s("roze", "常識堂の　名前、\nだれが　つけたか　知ってるアル？"),
			s("roze", "……わたしアル。\n常識が　ある　店に　したかったアル"),
			s("roze", "常識が　あれば、みんな\n帰って　くるアル。……たぶんアル"),
		],
	},
	{
		id: "roze_bond2",
		title: "麻婆豆腐の　はじまり",
		cast: ["roze"],
		treats: 6,
		lines: [
			s("roze", "麻婆豆腐はね、\nおんJが　にぎやかだった　ころの　味アル"),
			s("roze", "みんなで　辛い　辛い　言いながら\n食べたアル"),
			s("roze", "……いまは　ひと鍋で　足りるアル。\nでも、ひと鍋は　作るアル"),
		],
	},
	{
		id: "feris_bond1",
		title: "フェリスの　目",
		cast: ["feris"],
		treats: 3,
		lines: [
			s("feris", "私、目が　いいでしょ〜。\n遠くの　スレも　見えるの〜"),
			s(
				"feris",
				"植民地の　スレも　見えるよ〜。\n……だれも　書いて　ないけど〜",
			),
			s("feris", "キリコが　行くと、\nちょっとだけ　明るく　なるの〜"),
		],
	},
	{
		id: "feris_bond2",
		title: "飛ばない　わけ",
		cast: ["feris"],
		treats: 6,
		lines: [
			s("feris", "私、ほんとは　もっと\n飛べるんだ〜"),
			s(
				"feris",
				"でも　飛んで　いったら、\nだれが　ここで　「おかえり」　言うの〜？",
			),
			s("feris", "……だから　飛ばないの〜。\nへくちっ"),
		],
	},
	{
		id: "shiyo_bond1",
		title: "シヨの　メイド服",
		cast: ["shiyo"],
		treats: 3,
		lines: [
			s("shiyo", "この　メイド服？\n……べつに　だれかの　ためじゃ　ないわよ"),
			s("shiyo", "倉庫番に　ちょうど　いいの。\nポケットが　多いから"),
			s("shiyo", "……鍵、ぜんぶ　入るのよ。\nあなたの　ぶんも"),
		],
	},
	{
		id: "shiyo_bond2",
		title: "生きてこそだ",
		cast: ["shiyo"],
		treats: 6,
		lines: [
			s("shiyo", "「生きてこそだ」って、\nあたす　よく　言うでしょ"),
			s("shiyo", "スレも　人も、生きてれば\nまた　書ける。……それだけよ"),
			s("shiyo", "だから、倒れても　帰って　きなさい。\n……約束よ"),
		],
	},
	{
		id: "zero_bond1",
		title: "サブ機たち",
		cast: ["zero"],
		treats: 3,
		lines: [
			s("zero", "ゼロの　サブ機たち、\nみんな　名前が　あるんです"),
			s("zero", "プロト、レン、……\nそれから、キリコさん　号"),
			s("zero", "……い、いまの　なしです！\n帳簿から　消して　ください！"),
		],
	},
	{
		id: "zero_bond2",
		title: "ゼロの　ゼロ",
		cast: ["zero"],
		treats: 6,
		lines: [
			s("zero", "ゼロって　名前、\nなにも　ない　って　意味です"),
			s("zero", "でも、帳簿の　ゼロは、\nここから　数える　って　意味なんです"),
			s("zero", "……ゼロは、キリコさんの\nおかえりを　数えるのが　好きです"),
		],
	},
];
