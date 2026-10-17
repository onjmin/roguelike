// 寸劇（きっかけつきで 1回きり。動かすのは ui/village/skits.ts）。
// きっかけは 4つ：建物に はじめて 入った（enter）・物を はじめて 調べた（look）・ある 場所に はじめて 来た（near）・
// ある 死に方で 帰ってきて その 住人に はじめて 話しかけた（death。前の冒険への 反応を かねる）。村ぜんぶで 1回の 帰りに 1本まで。
// 1本は 3〜5窓（ふだんの 話しかけより 長い。1回きりなので）。201 の 型：同じ 形で 3段 大きく して、
// 最後に キリコか 本人が つっこむ（STORY.md「201級の 笑い」）。
// 地の文で 画面に 見えない 出来事（物が ふえた・人が 来た）を 言わない。話す 人の 口で 言わせる。
// 期間限定（date）は 年まで 決めた 日だけ 起きて、見逃したら 二度と 出ない。ほかより 先に 選ぶ（並びの いちばん 上）。

import type { Cue } from "../../engine/emote";
import type { MobId } from "../people/mobs";

/** 1窓。who は キリコ・地の文（null）・その 住人（mob。death だけ）・名前つきの 人（店員 など。立ち絵なし）。 */
export type SkitLine = Cue & {
	who: "kiriko" | "mob" | null | { name: string };
	text: string;
};

export type SkitOn =
	/** 建物（施設は f_<施設の id>、銭湯などの 部屋は data/village/rooms.ts の id）に はじめて 入った。 */
	| { k: "enter"; map: string }
	/** 村の 物（イベントの id が この 頭で はじまる）を はじめて 調べた。 */
	| { k: "look"; thing: string }
	/** 地図（map）の この 四角（x・y の はしを 含む）に はじめて 来た。口への 道（桟橋）には 置かない。 */
	| {
			k: "near";
			map: string;
			x: readonly [number, number];
			y: readonly [number, number];
	  }
	/** この 死に方で 帰ってきて、mob に はじめて 話しかけた。 */
	| { k: "death"; mob: MobId; cause: string };

/** 起きる 期間（端末の 日付。y 年 m 月の d[0]〜d[1] 日。data/town/calendar.ts の today・nowYear）。 */
export type SkitDate = { y: number; m: number; d: readonly [number, number] };

export type Skit = {
	key: string;
	on: SkitOn;
	lines: readonly SkitLine[];
	/** 期間限定（その 年の その 日だけ。見逃したら 二度と 出ない）。 */
	date?: SkitDate;
};

/** 村の どこでも（期間限定の 寸劇の きっかけ：その 日に 村を 1歩 歩いたら）。 */
const ANYWHERE: SkitOn = {
	k: "near",
	map: "village",
	x: [0, 999],
	y: [0, 999],
};

const k = (text: string): SkitLine => ({ who: "kiriko", text });
const n = (text: string): SkitLine => ({ who: null, text });
const m = (text: string): SkitLine => ({ who: "mob", text });
/** 名前つきの 人の 1窓。 */
const by =
	(name: string) =>
	(text: string): SkitLine => ({ who: { name }, text });
const e = (cue: Cue, line: SkitLine): SkitLine => ({
	...line,
	...cue,
});

const clerk = by("店員");
const owner = by("店主");
const regular = by("常連");
const trainer = by("トレーナー");
const master = by("マスター");
const usher = by("係員");
const dealer = by("ディーラー");
const banndai = by("番台");
const nanashi = by("名無し");

export const SKITS: readonly Skit[] = [
	// ───── 期間限定（その 日に 村を 歩いたら。見逃したら 二度と 出ない） ─────
	{
		key: "date_2026_halloween",
		date: { y: 2026, m: 10, d: [31, 31] },
		on: ANYWHERE,
		lines: [
			nanashi("トリックオアトリート！"),
			k("……お菓子ないンゴ"),
			nanashi("じゃあイタズラや。\n今日一日、語尾がンゴになる"),
			k("……もとからンゴ"),
			e({ emote: "汗" }, nanashi("……イタズラ失敗や")),
		],
	},
	{
		key: "date_2026_zorome",
		date: { y: 2026, m: 11, d: [11, 11] },
		on: ANYWHERE,
		lines: [
			nanashi("今日は11月11日、\nゾロ目の日や"),
			nanashi("1111ゲットしたやつは、\n願いがかなうらしいで"),
			e({ gesture: "slump" }, nanashi("……ワイ、1110やった")),
			k("……おしいンゴ"),
		],
	},
	{
		key: "date_2026_xmas",
		date: { y: 2026, m: 12, d: [24, 25] },
		on: ANYWHERE,
		lines: [
			nanashi("ワイの家にも、\nサンタ来るかな"),
			nanashi("……煙突ないやろ"),
			nanashi("ほな、保守しとくわ"),
			k("……サンタは保守じゃ\n来ないンゴ"),
		],
	},
	{
		key: "date_2026_omisoka",
		date: { y: 2026, m: 12, d: [31, 31] },
		on: ANYWHERE,
		lines: [
			nanashi("今年最後のレスや"),
			nanashi("いや、ワイが最後や"),
			nanashi("ワイや"),
			k("……年が明けても\n続いてるンゴ"),
		],
	},
	{
		key: "date_2027_newyear",
		date: { y: 2027, m: 1, d: [1, 3] },
		on: ANYWHERE,
		lines: [
			nanashi("あけおめ"),
			nanashi("ことよろ"),
			nanashi("……去年のスレ、\nまだ1000いってへんで"),
			k("……今年もよろしくンゴ"),
		],
	},
	{
		key: "date_2027_neko",
		date: { y: 2027, m: 2, d: [22, 22] },
		on: ANYWHERE,
		lines: [
			nanashi("今日は猫の日や"),
			nanashi("ワイも猫になったる"),
			e({ emote: "♪" }, nanashi("……にゃーん")),
			k("……語尾はンゴのままンゴ"),
		],
	},
	{
		key: "date_2027_april",
		date: { y: 2027, m: 4, d: [1, 1] },
		on: ANYWHERE,
		lines: [
			nanashi("ワイ、今日でおんJ\nやめるわ"),
			nanashi("ワイも"),
			nanashi("ワイも"),
			k("……エイプリルフールンゴ？"),
			nanashi("……せや。\n明日も来るで"),
		],
	},
	// おんJの 開設日（2012年6月7日。はじめの 日は 20人。STORY.md の 原住民）
	{
		key: "date_2027_birthday",
		date: { y: 2027, m: 6, d: [7, 7] },
		on: ANYWHERE,
		lines: [
			nanashi("今日はおんJが\nできた日や"),
			nanashi("2012年の6月7日。\nもう15年前や"),
			nanashi("……最初の日は、\n20人おったらしいで"),
			k("……いまは、吾輩たちも\nいるンゴ"),
		],
	},
	{
		key: "date_2027_tanabata",
		date: { y: 2027, m: 7, d: [7, 7] },
		on: ANYWHERE,
		lines: [
			nanashi("短冊に、\n願いごと書いたで"),
			nanashi("なんて書いたんや"),
			nanashi("「スレが落ちませんように」"),
			k("……保守は自分で\nするンゴ"),
		],
	},
	// ───── 建物に はじめて 入った ─────
	{
		key: "enter_konbini",
		on: { k: "enter", map: "f_konbini" },
		lines: [
			clerk("いらっしゃいませー。\nただいまポイント5倍デーです"),
			clerk("……さらに今だけ、\nレシートが2枚出ます"),
			clerk("……さらにさらに、\nレシートの裏にもレシートが"),
			k("……レシートしか\nふえてないンゴ"),
		],
	},
	{
		key: "enter_pawn",
		on: { k: "enter", map: "f_pawn" },
		lines: [
			owner("うちは何でも買い取るよ"),
			k("……吾輩の蓄音機は\n売らないンゴ"),
			owner("じゃあ、その「売らない」って\n気持ちを買い取ろう"),
			owner("……5円でどうだ"),
			e({ emote: "怒" }, k("安いンゴ！")),
		],
	},
	{
		key: "enter_arcade",
		on: { k: "enter", map: "f_arcade" },
		lines: [
			regular("……連コインは、\n男の美学や"),
			regular("（ちゃりん）"),
			regular("（ちゃりん）（ちゃりん）\n（ちゃりん）"),
			regular("……両替してくるわ"),
			k("美学、すぐ尽きたンゴ"),
		],
	},
	{
		key: "enter_gym",
		on: { k: "enter", map: "f_gym" },
		lines: [
			trainer("ようこそageジムへ！\nまずはスクワット10回！"),
			trainer("……いや、100回！"),
			trainer("……いや、スレが\n1000行くまで！"),
			k("……終わらないンゴ"),
			e({ emote: "!" }, trainer("それがageや！")),
		],
	},
	{
		key: "enter_bar",
		on: { k: "enter", map: "f_bar" },
		lines: [
			master("……いらっしゃい。\n次スレへようこそ"),
			master("前スレのお客さんは、\nもう帰ったよ"),
			master("……前々スレのお客さんは、\nまだそこで寝てる"),
			k("……起こしてあげるンゴ"),
		],
	},
	{
		key: "enter_ramen",
		on: { k: "enter", map: "f_ramen" },
		lines: [
			owner("へいらっしゃい！\n麺のかたさは？"),
			k("……ふつうンゴ"),
			e({ emote: "!" }, owner("乙！")),
			owner("……うちは何を言われても\n「乙」で返す店や"),
			k("……注文、通ってるンゴ？"),
		],
	},
	{
		key: "enter_cinema",
		on: { k: "enter", map: "f_cinema" },
		lines: [
			usher("本日の上映は\n『スレ立てから1000まで』です"),
			usher("上映時間は、\nおよそ3年です"),
			k("……長いンゴ"),
			usher("なお、途中で落ちる\nこともございます"),
		],
	},
	{
		key: "enter_casino",
		on: { k: "enter", map: "f_casino" },
		lines: [
			dealer("いらっしゃいませ。\n当店の勝率は、5割です"),
			dealer("……お店の、です"),
			k("……吾輩のは何割ンゴ？"),
			dealer("それは、回してからの\nお楽しみです"),
		],
	},
	// 銭湯「ゆ」（data/village/rooms.ts の bath。入口の 上に 番台）
	{
		key: "enter_bath",
		on: { k: "enter", map: "bath" },
		lines: [
			banndai("いらっしゃい。\nうちの湯は42℃だよ"),
			banndai("……41℃派のお客さんには、\n41℃って言ってる"),
			k("……ほんとは何℃ンゴ？"),
			banndai("……測ったことないねぇ"),
		],
	},
	// ───── 村の 物を はじめて 調べた ─────
	{
		key: "look_shrine",
		on: { k: "look", thing: "shrine" },
		lines: [
			k("……吾輩、さっきから\n見られてる気がするンゴ"),
			n("ふりかえっても、\nだれもいない。"),
			n("……もう一度ふりかえっても、\nやっぱりだれもいない。"),
			e({ emote: "汗" }, k("……ROM専の神さまンゴ？")),
		],
	},
	// 古井戸の 底は 過去ログの底。いちばん 古い 層の「ふぇ…ふぇ……フェニックス！」（フェリスの 生まれ。STORY.md の 後日談）を
	// こだまに まぜて 先に 聞かせて おく。降りる ほうを 選んだ ときは 出さない（次に 調べた ときに 出る）
	{
		key: "look_well",
		on: { k: "look", thing: "well" },
		lines: [
			k("……おーい、ンゴ"),
			n("底から、少し遅れて\n「……おーい」と返ってきた。"),
			n("……もう少し遅れて、\n「……ふぇ」と聞こえた。"),
			e({ emote: "?" }, k("……いまの、吾輩の声じゃ\nないンゴ")),
		],
	},
	{
		key: "look_vend",
		on: { k: "look", thing: "fthing_vend" },
		lines: [
			n("自販機の下に、\nなにか光っている。"),
			n("……10円玉だ。\nその奥に、もう1枚。"),
			n("……その奥に、\nレシートが1枚。"),
			k("……最後のだけ\nいらないンゴ"),
		],
	},
	// ───── ある 場所に はじめて 来た ─────
	// 広場の 南東の 滝（段2 から）の 下
	{
		key: "near_falls",
		on: { k: "near", map: "village", x: [23, 30], y: [29, 30] },
		lines: [
			k("……滝ンゴ"),
			k("打たれたら、吾輩も\n強くなれるンゴ？"),
			n("……キリコは、指を1本だけ\n入れてみた。"),
			e({ gesture: "shiver" }, k("……冷たいンゴ。\n修行は今日はここまでンゴ")),
		],
	},
	// 広場の 南の 池の ほとり
	{
		key: "near_pond",
		on: { k: "near", map: "village", x: [10, 17], y: [30, 31] },
		lines: [
			k("……池ンゴ"),
			n("水面に、キリコの顔が\nうつっている。"),
			n("……となりに、ラッパの形の\n顔もうつっている。"),
			k("……それ、吾輩の\n蓄音機ンゴ"),
		],
	},
	// 浜の 東の はし（桟橋からは 遠い）
	{
		key: "near_beach",
		on: { k: "near", map: "village", x: [40, 62], y: [33, 36] },
		lines: [
			k("……海ンゴ"),
			k("この海のむこうに、\n板がたくさんあるンゴ"),
			k("……ぜんぶ回ったら、\n吾輩、日焼けするンゴ"),
			n("波の音が、\n「保守」と聞こえた。"),
		],
	},
	// ───── ある 死に方で 帰ってきた ─────
	{
		key: "death_mine",
		on: { k: "death", mob: "asakonro", cause: "地雷" },
		lines: [
			m("地雷ふんだって聞いたもん！\n……よく焼けた？"),
			k("……焼けたンゴ。\nこんがりンゴ"),
			e({ emote: "汗" }, m("……うちより\n焼けてるもん……")),
			e({ emote: "怒" }, m("くやしいもん！\n今夜は火力2倍だもん！")),
			k("……張りあわないでほしいンゴ"),
		],
	},
	{
		key: "death_pit",
		on: { k: "death", mob: "hinary", cause: "落とし穴" },
		lines: [
			m("落とし穴の調査結果を\n発表します"),
			m("穴は、下に向かって\nあいている模様です"),
			m("……落ちた人は、下に向かって\n落ちた模様です"),
			k("……知ってるンゴ。\n落ちたの吾輩ンゴ"),
			m("これで発表を終わりたいと\n思います"),
		],
	},
	{
		key: "death_jien",
		on: { k: "death", mob: "onsu", cause: "自演くん" },
		lines: [
			m("自演くんに\nやられたのぉ？"),
			m("……あの子、わたくしの板にも\nよく来るのよぉ"),
			e({ emote: "汗" }, m("……来るのは、\nあの子だけなのよぉ")),
			k("……常連ンゴ"),
			e({ emote: "怒" }, m("ふ、ふん。\n常連は大事よぉ！")),
		],
	},
	{
		key: "death_pitcher",
		on: { k: "death", mob: "yayapoji", cause: "ピッチャー" },
		lines: [
			m("ピッチャーに\n負けたんだ"),
			m("……キリコさん、これで\n何勝何敗なんだ"),
			k("……数えてないンゴ"),
			e({ emote: "花" }, m("わからないなら、\n5割なんだ")),
		],
	},
	{
		key: "death_copipe",
		on: { k: "death", mob: "proto", cause: "コピペ" },
		lines: [
			m("コピペにたおされたと\n記録したゼロ"),
			m("コピペにたおされたと\n記録したゼロ"),
			m("……コピペにたおされたと\n記録したゼロ"),
			k("……3回言ったンゴ"),
			e({ emote: "…" }, m("……うつったゼロ")),
		],
	},
	{
		key: "death_okimono",
		on: { k: "death", mob: "shobon", cause: "置物" },
		lines: [
			m("置物にやられたの？\n……あれ、動かないでしょ"),
			k("……動かないのに\nやられたンゴ"),
			m("(´・ω・｀)　おれも、\n置物ってよく言われるよ"),
			m("……動かないのに、\nだれもやっつけてないけど"),
		],
	},
	{
		key: "death_furo",
		on: { k: "death", mob: "ngoane", cause: "風呂キャンセル" },
		lines: [
			m("風呂キャンセル界隈に\nやられたンゴねぇ……"),
			m("……弟も、きのう\nお風呂キャンセルしたンゴねぇ"),
			e({ emote: "怒" }, m("……姉として、\n湯船に沈めてきたンゴねぇ")),
			k("……弟、無事ンゴ？"),
		],
	},
];
