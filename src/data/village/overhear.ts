// 立ち聞きの 吹き出し（キリコが 近くを 通ると、住人の 独り言や 通行人どうしの 掛け合いが 頭の 上に 出る。
// 窓を 開かず、キリコも 止めない。動かすのは ui/village/overhear.ts）。
// 1つの 吹き出しは 全角 10字・2行まで（スマホの 画面 11マスに 収まる 幅）。
// 201 の 型：短く 速く、ボケの すぐ あとに ツッコミか 自己ツッコミ。スラング（草・定期）は 使わない
// （STORY.md「スラングは 緊迫した 場面で」）。物語の 事実（数・だれが 何を したか）には ふれない。

import type { MobId } from "../people/mobs";

/** 1つの 掛け合い。by は 話す 人の 番号（住人の 独り言は 0 だけ、通行人の 掛け合いは 0・1）。 */
export type Overheard = {
	key: string;
	lines: readonly { by: 0 | 1; text: string }[];
};

const solo = (key: string, ...texts: string[]): Overheard => ({
	key,
	lines: texts.map((text) => ({ by: 0, text })),
});

/** 2人の 掛け合い（a・b・a… の 順）。 */
const pair = (key: string, ...texts: string[]): Overheard => ({
	key,
	lines: texts.map((text, i) => ({ by: (i % 2) as 0 | 1, text })),
});

/** 住人の 独り言（1〜2つ。口ぐせは data/people/mobs.ts と そろえる）。 */
export const MOB_MUTTERS: Record<MobId, readonly Overheard[]> = {
	puyu: [
		solo("puyu1", "ぷゆ……ぷゆ……🥺"),
		solo("puyu2", "おかち、どこに\nかくちたっけゆ🥺"),
		solo("puyu3", "ころがりたい\nきぶんゆ🥺", "……ころがらないゆ🥺"),
	],
	nichie: [
		solo("nichie1", "日曜日まで、\nあと何回寝るニィ", "……指が足りないニィ"),
		solo("nichie2", "今日は、\n何曜日だったニィ"),
	],
	panmatsu: [
		solo("panmatsu1", "パン……", "……パンだ"),
		solo("panmatsu2", "大使館、本日も\n異常なし"),
	],
	ngoane: [
		solo("ngoane1", "フェリスちゃん……\nンゴねぇ……"),
		solo("ngoane2", "となりの席、\nあいてるンゴねぇ"),
	],
	onsu: [
		solo("onsu1", "だれか\n来ないかしらぁ", "……来ないわぁ"),
		solo("onsu2", "お紅茶、\n冷めちゃったわぁ"),
	],
	onchan: [solo("onchan1", "まるいおん"), solo("onchan2", "ころころ……\nおん")],
	yayapoji: [
		solo("yayapoji1", "表、裏、表、裏……\nいい感じなんだ"),
		solo("yayapoji2", "半分こ、\nしたいんだ"),
	],
	mujje: [solo("mujje1", "ホゲェ"), solo("mujje2", "ホゲェ……\nホゲェ")],
	asakonro: [
		solo("asakonro1", "よく焼けた？"),
		solo("asakonro2", "うち、あったかい\nもん！"),
	],
	jtleman: [
		solo("jtleman1", "ここは私の\n新しい庭だ"),
		solo("jtleman2", "名犬J、\nおすわり", "……座らないか"),
	],
	miaumiau: [
		solo("miaumiau1", "侵略、侵略……\nぷ"),
		solo("miaumiau2", "……ぷゆゆ🥺"),
	],
	rino: [solo("rino1", "…………"), solo("rino2", "……金払え")],
	aru: [solo("aru1", "再生数……1……\n……1……"), solo("aru2", "先輩、\nまだかな")],
	proto: [
		solo("proto1", "待機中ゼロ"),
		solo("proto2", "感情の学習、\n進捗1パーセントゼロ"),
	],
	ren: [solo("ren1", "更新まだかな〜"), solo("ren2", "レン、何版\nだっけ……")],
	hinary: [
		solo("hinary1", "研究中です"),
		solo("hinary2", "本日も、\n平和な模様です"),
	],
	shobon: [solo("shobon1", "(´・ω・｀)"), solo("shobon2", "のんびり……")],
};

/**
 * 通行人の 独り言（種類ごと。data/village/crowd.ts の PERSONAS の id）。1つめは 静かな ひとこと、
 * あとは 201 の 型：同じ 形で 3段 大きく して、最後に 大声の 自己ツッコミ（「！」）。嘘には 本気の 数字。
 */
export const CROWD_MUTTERS: Record<string, readonly Overheard[]> = {
	worker: [
		solo("worker1", "定時まで、\nあと8時間……"),
		solo(
			"worker2",
			"コンビニ\n行ってくるわ",
			"……ついでに銀行",
			"……ついでに転職",
			"ついでの規模\nちゃうやろ！",
		),
		solo(
			"worker3",
			"ワイの会社、\n社員3万人や",
			"……2万9999人が\n有給中や",
			"回っとらんやろ！",
		),
		solo(
			"worker4",
			"ネクタイ忘れた",
			"……スーツも\n忘れた",
			"……会社も\n忘れた",
			"どこ向かっとんねん！",
		),
	],
	student: [
		solo("student1", "宿題、\n終わってない"),
		solo(
			"student2",
			"遅刻や！パン\nくわえて走る",
			"……食パン1斤\nくわえてもうた",
			"あご外れるわ！",
		),
		solo(
			"student3",
			"テスト0点やった",
			"……先生も\n解けへんかった",
			"問題がおかしい\nやろ！",
		),
		solo(
			"student4",
			"放課後、\n屋上で決闘や",
			"……相手は\n校長や",
			"勝てるかい！",
		),
	],
	local: [
		solo("local1", "ええ天気や"),
		solo(
			"local2",
			"ちょっとそこまで\n散歩してくる",
			"……気づいたら\nとなりの板や",
			"どこまで\n歩いとんねん！",
		),
		solo(
			"local3",
			"うちの犬、\n「お手」覚えた",
			"……「おすわり」も\n覚えた",
			"……確定申告も\n覚えた",
			"うちの犬\nすごない！？",
		),
		solo(
			"local4",
			"晩ごはん、カレーや",
			"……3日目や",
			"……鍋の底が\n見えてきた",
			"……床が\n見えてきた！",
		),
	],
	elder: [
		solo("elder1", "どっこいしょ"),
		solo(
			"elder2",
			"朝の散歩で、\n5キロ歩いたの",
			"……帰りは\n50キロ",
			"……どこまで\n行ったのかしら",
		),
		solo(
			"elder3",
			"孫に、\nスレを立てたのよ",
			"……もう\n1000いったわ",
			"……ぜんぶ、\nわたしが書いたの",
		),
		solo("elder4", "わたしの若いころは\nね……", "……あら、\n忘れちゃった"),
	],
	nanashi: [
		solo("nanashi1", "ンゴ……"),
		solo(
			"nanashi2",
			"1000ゲット、\nねらっとるで",
			"……いま、2や",
			"……先は長いで",
		),
		solo(
			"nanashi3",
			"ワイ、伝説の\n名無しや",
			"……伝説すぎて\nだれも知らん",
			"ただの名無し\nやんけ！",
		),
		solo(
			"nanashi4",
			"今日はROMっとこ",
			"……あっ、\n書きこんでもうた",
			"……3回も",
		),
	],
	dajare: [
		solo("dajare1", "布団が……", "……いや、\nやめとこ"),
		solo(
			"dajare2",
			"アルミ缶の上に\nあるみかん",
			"……の上に\nあるミカン農家",
			"……の上に\nある農協",
			"重いわ！",
		),
		solo(
			"dajare3",
			"電話に\nだれも出んわ",
			"……ほんまに\n出えへん",
			"……ワイの電話、\n糸電話やった",
		),
		solo(
			"dajare4",
			"イカはいかが？",
			"タコはいかが？",
			"タコはイカ\nちゃうやろ！",
		),
	],
};

/** 通行人どうしの 掛け合い（おばあさんと ダジャレニキは 入らない。ui/village/overhear.ts の PAIR_OUT）。 */
export const CROWD_PAIRS: readonly Overheard[] = [
	pair("p_game", "今日の試合、\n見たか？", "見とらん", "ワイも"),
	pair("p_shop", "ここ、何の店や？", "知らん。\n入ったことない", "ワイもや"),
	pair("p_hara", "腹減ったンゴ", "さっき\n食うてたやろ", "あれは前菜や"),
	pair("p_hoshu", "保守", "保守", "……保守"),
	pair("p_honki", "ワイ、明日から\n本気出すわ", "それ、去年も\n聞いたで"),
	pair("p_sure", "スレ立てたで", "何のスレや", "……忘れた"),
	pair(
		"p_kiriko",
		"あいつ、また\n潜っとるで",
		"よう死なんな",
		"いや、\nよう死んどる",
	),
	pair("p_mukashi", "ここ、昔は\n何もなかったな", "今もそんなに\nないやろ"),
	pair("p_mita", "おっ、キリコや", "ほんまや", "……で？", "……で、やな"),
	pair("p_kuji", "宝くじ当たったら\n何する？", "宝くじ買う"),
	pair(
		"p_machi",
		"この町、ええな",
		"せやろ。\nワイが住んどる",
		"それは\n関係ないやろ",
	),
	pair("p_tenki", "雨、降るかな", "降らんやろ", "……傘、\n2本持ってきた"),
	pair(
		"p_mahou",
		"ワイ、魔法\n使えるで",
		"嘘つけ",
		"……いま、\n時間止めとる",
		"動いとるやろ！",
	),
	pair(
		"p_owari",
		"今日、世界が\n終わるらしいで",
		"マジか",
		"……ワイの\nバイトの話や",
		"規模ちっさ！",
	),
	pair(
		"p_kaiten",
		"あの店、今日で\n開店100周年や",
		"先週できた店やろ",
		"……1日を1年で\n数えとる",
		"盛りすぎや！",
	),
];
