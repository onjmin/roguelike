// 寸劇（きっかけつきで 1回きり。動かすのは ui/village/skits.ts）。
// きっかけは 4つ：建物に はじめて 入った（enter）・物を はじめて 調べた（look）・ある 場所に はじめて 来た（near）・
// ある 死に方で 帰ってきて その 住人に はじめて 話しかけた（death。前の冒険への 反応を かねる）。村ぜんぶで 1回の 帰りに 1本まで。
// 1本は 3〜5窓（ふだんの 話しかけより 長い。1回きりなので）。201 の 型：同じ 形で 3段 大きく して、
// 最後に キリコか 本人が つっこむ（STORY.md「201級の 笑い」）。
// 地の文で 画面に 見えない 出来事（物が ふえた・人が 来た）を 言わない。話す 人の 口で 言わせる。
// 期間限定（window）は 本筋の 話の あいだ だけ 起きて、先へ 進むと 二度と 出ない（現実の 日付には つながない）。
// ほかより 先に 選ぶ（並びの いちばん 上）。

import type { DungeonId } from "../../core/types";
import type { Cue } from "../../engine/emote";
import type { SceneFx } from "../../engine/sceneFx";
import type { MobId } from "../people/mobs";

/** 1窓。who は キリコ・地の文（null）・その 住人（mob。death だけ）・名前つきの 人（店員 など。立ち絵なし）。 */
export type SkitLine = Cue & {
	who: "kiriko" | "mob" | null | { name: string };
	text: string;
	/** この 窓の 前に 出す エフェクト（engine/sceneFx.ts。boom は 爆発の 音も）。calm か 寸劇の 終わりまで 残る。 */
	fx?: SceneFx;
	/** この 窓の 前に エフェクトを 消す（爆発の あと 元通りに なった ところ）。 */
	calm?: true;
};

export type SkitOn =
	/** 建物（施設は f_<施設の id>、銭湯などの 部屋は data/village/rooms.ts の id）に はじめて 入った。 */
	| { k: "enter"; map: string }
	/** 物（イベントの id が この 頭で はじまる）を はじめて 調べた。map が あれば その 地図の 物だけ（部屋の 物は「safe_0」など）。 */
	| { k: "look"; thing: string; map?: string }
	/** 地図（map）の この 四角（x・y の はしを 含む）に はじめて 来た。口への 道（桟橋）には 置かない。 */
	| {
			k: "near";
			map: string;
			x: readonly [number, number];
			y: readonly [number, number];
	  }
	/** この 死に方で 帰ってきて、mob に はじめて 話しかけた。 */
	| { k: "death"; mob: MobId; cause: string };

/** 起きる あいだ（本筋の 話。after を 持ち帰った あとで、before を まだ 持ち帰って いない とき）。 */
export type SkitWindow = { after?: DungeonId; before?: DungeonId };

export type Skit = {
	key: string;
	on: SkitOn;
	lines: readonly SkitLine[];
	/** 期間限定（話の その あいだ だけ。先へ 進むと 二度と 出ない）。 */
	window?: SkitWindow;
};

/** 村の どこでも（期間限定の 寸劇の きっかけ：その あいだに 村を 1歩 歩いたら）。 */
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
const trainer = by("トレーナー");
const master = by("マスター");
const usher = by("係員");
const dealer = by("ディーラー");
const banndai = by("番台");
const nanashi = by("名無し");
const native = by("原住民");
const waiter = by("給仕");
const actor = by("役者");
const boss = by("首領");
const member = by("構成員");
const sensei = by("師範");

export const SKITS: readonly Skit[] = [
	// ───── 期間限定（話の あいだ だけ。その あいだに 村を 歩いたら。先へ 進むと 二度と 出ない） ─────
	// 本筋は パン板（shallow）→ きのこ板（kinoko）→ 風呂板（main）→ 電池板（deep）→ 後日談（hidden）。
	// いまの 話の ようすに ふれる（STORY.md の 各話の 事件。町の 人数・停電と 食いちがわない 人に 言わせる）
	// パン板の 前：町には やきう・ぷゆゆ・原住民 だけで、広場は パン兵に 占領されて いる
	{
		key: "window_pan",
		window: { before: "shallow" },
		on: ANYWHERE,
		lines: [
			native("広場、パン兵に\n占領されちゃったね！"),
			native("2012年には、\nやきう民に占領されたよ！"),
			native("来年はたぶん、\n宇宙人に占領されるよ！"),
			e({ gesture: "shake" }, k("占領の予約\nしないでほしいンゴ！")),
		],
	},
	// 第一話の あと：町じゅう 独立したが、申請書の 1枚は パン板が 使って いて 片づいた
	{
		key: "window_dokuritsu",
		window: { after: "shallow", before: "kinoko" },
		on: ANYWHERE,
		lines: [
			nanashi("独立の申請書、\nもう1枚刷ったろか"),
			nanashi("ほな、ワイの家も\n独立や"),
			nanashi("ワイの部屋も\n独立や"),
			nanashi("ワイの消しゴムは\n国連に加盟したで！"),
			e({ emote: "汗", gesture: "shake" }, k("独立しすぎンゴ！！")),
		],
	},
	// 第二話の あと：きのこの 行進が 港まで 来て、摘んで 片づいた
	{
		key: "window_kinoko",
		window: { after: "kinoko", before: "main" },
		on: ANYWHERE,
		lines: [
			nanashi("きのこの行進、\nすごかったな！"),
			nanashi("ワイの頭にも\n生えとったで！"),
			nanashi("ワイのは、まだ生えとる。\nもう3メートルや"),
			e({ emote: "怒" }, nanashi("抜けや！\n電線にからまっとるやろ！")),
			e({ gesture: "shake" }, k("町のインフラまで\nきのこンゴ！")),
		],
	},
	// 第三話の あと〜最終話：電池板が 開いて 町は 停電（data/town/revival.ts の inBlackout）
	{
		key: "window_teiden",
		window: { after: "main", before: "deep" },
		on: ANYWHERE,
		lines: [
			nanashi("停電、まだ直らんな！\nほな、自転車こいで発電や！"),
			nanashi("ワイも！ワイも！\n町じゅうで1000台や！"),
			nanashi("……1000台こいで、\n豆電球1個ついたで！"),
			e({ gesture: "shake" }, k("効率が悪すぎるンゴ！")),
			e({ gesture: "hop" }, k("電池板に行って\n根っこから直すンゴ！")),
		],
	},
	// 最終話の あと（後日談の 前）：見出しの 名無しは やきうだった
	{
		key: "window_midashi",
		window: { after: "deep", before: "hidden" },
		on: ANYWHERE,
		lines: [
			nanashi("最終話、見たか？"),
			nanashi("見た。\nまさか、やきうが……"),
			e({ emote: "怒" }, nanashi("ネタバレすな！")),
			nanashi("この町に、\nまだ見とらんやつおるか！？"),
			k("みんな見てたンゴ！"),
		],
	},
	// 銭湯（開くのは 風呂板を 持ち帰って から。決着は 41.5℃）
	{
		key: "enter_bath",
		on: { k: "enter", map: "bath" },
		lines: [
			banndai("いらっしゃい！\nうちの湯は41.5℃や！"),
			banndai("42℃派の客には42℃、\n41℃派には41℃って言うとる！"),
			k("ほんとは何℃ンゴ？"),
			banndai("温度計の目もり、\n毎回書き直しとる！"),
			e({ gesture: "shake" }, k("決着した意味\nないンゴ！")),
		],
	},
	// ───── 建物に はじめて 入った ─────
	{
		key: "enter_konbini",
		on: { k: "enter", map: "f_konbini" },
		lines: [
			clerk("いらっしゃいませー。\nただいまポイント5倍デーです"),
			clerk("さらに今だけ、\nレシートが2枚出ます"),
			clerk("さらにさらに、\nレシートの裏にもレシートが！"),
			e({ gesture: "shake" }, k("レシートしか\nふえてないンゴ！")),
		],
	},
	// 何を 売って いるか わからない 質屋（店主も わかって いない）
	{
		key: "enter_pawn",
		on: { k: "enter", map: "f_pawn" },
		lines: [
			owner("いらっしゃい。\nうちはなんでも売っとるで"),
			k("なにを売ってるンゴ？"),
			owner("……それは、\nワイにもわからん"),
			owner("ちなみに、\nあんたも売り物や"),
			e({ emote: "汗", gesture: "startle" }, k("いつから\nンゴ！？")),
		],
	},
	// 質屋の 金庫（中で なにか 鳴いて いる）：主人公が 原因と、嘘に 本気の 数字
	{
		key: "look_pawn_safe",
		on: { k: "look", thing: "safe", map: "f_pawn" },
		lines: [
			k("鳴いてる金庫、\n開けてみるンゴ"),
			e({ emote: "!" }, owner("あかん！")),
			owner("……中身、いま\n町じゅうに逃げたで"),
			e({ gesture: "startle" }, k("吾輩のせいンゴ！？")),
			owner("請求は、\n1000万円や"),
		],
	},
	// 海上レストラン「1000」：客は 2人なのに 満席（真面目な 給仕は 本気）
	{
		key: "enter_restaurant",
		on: { k: "enter", map: "f_restaurant" },
		lines: [
			waiter("いらっしゃいませ。\n本日は満席でございます"),
			k("お客さん、\n2人しかいないンゴ"),
			waiter("はい。2名さまで\n満席でございます"),
			k("テーブル、\nほとんど空いてるンゴ！"),
			waiter("残りのお席は、1000日後の\nご予約のお客さまのものです"),
		],
	},
	{
		key: "enter_arcade",
		on: { k: "enter", map: "f_arcade" },
		lines: [
			nanashi("連コインは、\n男の美学や"),
			nanashi("（ちゃりん）"),
			nanashi("（ちゃりん）（ちゃりん）\n（ちゃりん）（ちゃりん）"),
			nanashi("……両替してくるわ"),
			e({ gesture: "shake" }, k("美学、すぐ\n尽きたンゴ！")),
		],
	},
	{
		key: "enter_gym",
		on: { k: "enter", map: "f_gym" },
		lines: [
			trainer("ようこそageジムへ！\nまずはスクワット10回！"),
			trainer("いや、100回！"),
			trainer("いや、スレが\n1000行くまで！"),
			e({ gesture: "shake" }, k("終わらないンゴ！")),
			e({ emote: "!" }, trainer("それがageや！")),
		],
	},
	{
		key: "enter_bar",
		on: { k: "enter", map: "f_bar" },
		lines: [
			master("いらっしゃい。\n次スレへようこそや"),
			master("前スレの客は、\nもう帰ったで"),
			master("前々スレの客は、\nまだ来とらん"),
			e({ emote: "?" }, k("順番が逆ンゴ！")),
		],
	},
	{
		key: "enter_ramen",
		on: { k: "enter", map: "f_ramen" },
		lines: [
			owner("へいらっしゃい！\n麺のかたさは？"),
			k("……ふつうンゴ"),
			e({ emote: "!" }, owner("乙！")),
			owner("うちは何を言われても\n「乙」で返す店や"),
			e({ emote: "?" }, k("注文、通ってるンゴ！？")),
		],
	},
	{
		key: "enter_cinema",
		on: { k: "enter", map: "f_cinema" },
		lines: [
			usher("本日の上映は、\nスレ1本まるごとです"),
			usher("上映時間は、\nおよそ3年です"),
			e({ gesture: "shake" }, k("長いンゴ！")),
			usher("なお、途中で次スレの\n劇場へお引っ越しいただきます"),
			e({ emote: "汗" }, k("劇場ごと\n引っ越すンゴ！？")),
		],
	},
	{
		key: "enter_casino",
		on: { k: "enter", map: "f_casino" },
		lines: [
			dealer("いらっしゃいませ。\n当店の勝率は、5割です"),
			dealer("……お店の、です"),
			dealer("なお、常連さまは通算\n3勝1万2千敗です"),
			e({ emote: "汗" }, k("常連、なんで\n来つづけてるンゴ！？")),
		],
	},
	// ───── 爆発オチ（201 の「困ったら 毎回 同じ 最終手段と 同じ 音」。どの 建物も 最後は 爆発） ─────
	// 地図は こわさない。煙が 晴れたら（calm）建物は 元通りで、本人たちも 気に しない。元通りに なった ことは
	// 言わない（見れば わかる）。爆発の 字（ドカーン）も 出さない（ui/village/skits.ts）
	{
		key: "enter_famires",
		on: { k: "enter", map: "f_famires" },
		lines: [
			clerk("ドリンクバーは、\nおかわり自由です"),
			k("ぜんぶ混ぜるンゴ"),
			n("コーラ、メロンソーダ、\nコーヒー、コーンスープ……"),
			{ ...clerk("混ぜるな危険です！"), fx: "boom" },
			{ ...clerk("……おかわりは、\n自由です"), calm: true },
		],
	},
	{
		key: "enter_recycle",
		on: { k: "enter", map: "f_recycle" },
		lines: [
			owner("うちは何でも\n直して売るよ"),
			owner("直したやつは、\nだいたい爆発するけどな"),
			e({ gesture: "shake" }, k("売っちゃだめンゴ！")),
			{ ...owner("……ほら、\nいま1台爆発した"), fx: "boom" },
			{ ...owner("よし。\nまた直せる"), calm: true },
		],
	},
	{
		key: "enter_dojo",
		on: { k: "enter", map: "f_dojo" },
		lines: [
			sensei("気合いだ！\n気合いで瓦を割れ！"),
			sensei("10枚！"),
			sensei("100枚！"),
			{ ...sensei("道場ごと！！"), fx: "boom" },
			{ ...sensei("……よし。\n次は10枚からな"), calm: true },
		],
	},
	{
		key: "enter_theater",
		on: { k: "enter", map: "f_theater" },
		lines: [
			actor("本日の演目は、\n『やきう物語』！"),
			actor("……なんやけど、\n台本が1行しかない"),
			k("なんて書いてあるンゴ？"),
			{ ...actor("『爆発』"), fx: "boom" },
			{ ...k("オチだけの劇ンゴ！"), calm: true },
		],
	},
	// ───── 村の 物を はじめて 調べた ─────
	// 秘密結社の 本部（分譲住宅の 青い 家。表札を 出して いる）。テロは スレの 埋め立てで、最後は 自分の 家で 爆発。
	// 2回目は 爆発の 天丼を ずらす（よその 家を ねらう）。見た 帰りの 次から
	{
		key: "look_kessha",
		on: { k: "look", thing: "fthing_house_b" },
		lines: [
			boss("作戦を発表する。\n今夜、おんJの全スレを1000にする"),
			member("それ、毎晩だれかが\nやっとることですやん"),
			boss("……作戦変更や。\nまず、この家を爆破する"),
			{ ...k("自分の家ンゴ！？"), fx: "boom" },
			{ ...boss("……作戦は、成功や"), calm: true },
		],
	},
	{
		key: "look_kessha2",
		on: { k: "look", thing: "fthing_house_b" },
		lines: [
			boss("作戦その2を発表する"),
			member("どうせまた、\nこの家を爆破するんでしょ"),
			boss("せえへん。\n今回は、となりの家や"),
			{ ...k("人の家ンゴ！！"), fx: "boom" },
			{ ...member("……となり、\nうちの実家ですけど"), calm: true },
		],
	},
	{
		key: "look_shrine",
		on: { k: "look", thing: "shrine" },
		lines: [
			k("見られてる気がするンゴ！\n……そこンゴ！"),
			n("だれもいない。"),
			e({ gesture: "startle" }, k("こっちンゴ！")),
			n("やっぱり、だれもいない。"),
			e({ emote: "汗" }, k("ROM専の神さま、\n隠れるのうますぎンゴ！")),
		],
	},
	// 古井戸の 底は 過去ログの底。いちばん 古い 層の「ふぇ…ふぇ……フェニックス！」（フェリスの 生まれ。STORY.md の 後日談）を
	// こだまに まぜて 先に 聞かせて おく。降りる ほうを 選んだ ときは 出さない（次に 調べた ときに 出る）
	{
		key: "look_well",
		on: { k: "look", thing: "well" },
		lines: [
			k("おーい、ンゴー！"),
			n("底から、少し遅れて\n「おーい」と返ってきた。"),
			n("もう少し遅れて、\n「……ふぇ」と聞こえた。"),
			e(
				{ emote: "?", gesture: "startle" },
				k("いまの、吾輩の声じゃ\nないンゴ！？"),
			),
		],
	},
	{
		key: "look_vend",
		on: { k: "look", thing: "fthing_vend" },
		lines: [
			n("自販機の下に、\nなにか光っている。"),
			n("……レシートだ。\nその奥に、もう1枚。"),
			n("その奥に、\nレシートの山脈。"),
			e({ gesture: "shake" }, k("レシートしか\nないンゴ！")),
		],
	},
	// ───── ある 場所に はじめて 来た ─────
	// 広場の 南東の 噴水（パン板の あとから 水が 出る）
	{
		key: "near_fountain",
		window: { after: "shallow" },
		on: { k: "near", map: "village", x: [23, 30], y: [29, 30] },
		lines: [
			k("噴水ンゴ"),
			k("打たれたら、吾輩も\n強くなれるンゴ？"),
			n("……噴水は、\n下から打ってくる。"),
			e({ gesture: "startle" }, k("修行の向きが\n逆ンゴ！")),
		],
	},
	// 広場の 南の 池の ほとり（キリコの 頭には 蓄音機の ラッパ）
	{
		key: "near_pond",
		on: { k: "near", map: "village", x: [10, 17], y: [30, 31] },
		lines: [
			k("池ンゴ！"),
			n("水面に、キリコの顔が\nうつっている。"),
			n("となりに、ラッパの形の\n顔もうつっている。"),
			e({ emote: "!", gesture: "startle" }, k("だれンゴ！？")),
			e({ emote: "汗" }, k("……吾輩の頭の\nラッパンゴ！")),
		],
	},
	// 浜の 東の はし（桟橋からは 遠い）
	{
		key: "near_beach",
		on: { k: "near", map: "village", x: [40, 62], y: [33, 36] },
		lines: [
			k("海ンゴ"),
			e({ gesture: "hop" }, k("全部の板を\n回るンゴーー！！")),
			n("波の音が、\n「保守」と聞こえた。"),
			e({ emote: "怒" }, k("返事が雑ンゴ！")),
		],
	},
	// ───── ある 死に方で 帰ってきた ─────
	{
		key: "death_mine",
		on: { k: "death", mob: "asakonro", cause: "地雷" },
		lines: [
			m("地雷ふんだって聞いたもん！\nよく焼けた？"),
			k("焼けたンゴ。\nこんがりンゴ"),
			e({ emote: "汗" }, m("……うちより\n焼けてるもん……")),
			e({ emote: "怒" }, m("くやしいもん！\n今夜は火力2倍だもん！")),
			e({ gesture: "shake" }, k("張りあわないで\nほしいンゴ！")),
		],
	},
	{
		key: "death_pit",
		on: { k: "death", mob: "hinary", cause: "落とし穴" },
		lines: [
			m("落とし穴の調査結果を\n発表します"),
			m("穴は、下に向かって\nあいている模様です"),
			m("落ちた人は、下に向かって\n落ちた模様です"),
			e({ emote: "怒" }, k("知ってるンゴ！\n落ちたの吾輩ンゴ！")),
			m("これで発表を終わりたいと\n思います"),
		],
	},
	{
		key: "death_jien",
		on: { k: "death", mob: "onsu", cause: "自演くん" },
		lines: [
			m("自演くんに\nやられたのぉ？"),
			m("あの子、わたくしの板にも\n毎日来るのよぉ！"),
			m("1人で100人ぶん\n書きこんでいくのよぉ！"),
			e({ gesture: "shake" }, k("それ、ほぼ\n自演くんの板ンゴ！")),
			e({ emote: "怒" }, m("ふ、ふん！\n板主はわたくしよぉ！")),
		],
	},
	{
		key: "death_pitcher",
		on: { k: "death", mob: "yayapoji", cause: "ピッチャー" },
		lines: [
			m("ピッチャーに\n負けたんだ"),
			m("キリコさん、これで\n何勝何敗なんだ？"),
			k("数えてないンゴ！"),
			e({ emote: "花" }, m("わからないなら、\n5割なんだ！")),
			e({ gesture: "shake" }, k("雑な計算で\n5割にしないでンゴ！")),
		],
	},
	{
		key: "death_copipe",
		on: { k: "death", mob: "proto", cause: "コピペ" },
		lines: [
			m("コピペにたおされたと\n記録したゼロ"),
			m("コピペにたおされたと\n記録したゼロ"),
			m("コピペにたおされたと\n記録したゼロ"),
			e({ gesture: "shake" }, k("3回言ったンゴ！")),
			e({ emote: "…" }, m("……うつったゼロ")),
		],
	},
	{
		key: "death_okimono",
		on: { k: "death", mob: "shobon", cause: "置物" },
		lines: [
			m("置物にやられたの？\nあれ、動かないでしょ"),
			k("動かないのに\nやられたンゴ！"),
			m("(´・ω・｀)おれも、\n置物ってよく言われるよ"),
			m("……ちょっと本気で\n動いてみようかな"),
			e(
				{ emote: "汗", gesture: "shake" },
				k("動いたら町が\n揺れるからやめるンゴ！"),
			),
		],
	},
	// 粘着アンチ（ンゴ姉は フェリスへの 粘着を 愛と 呼ぶ。フェリスの 名前は 出さない）
	{
		key: "death_nenchaku",
		on: { k: "death", mob: "ngoane", cause: "粘着アンチ" },
		lines: [
			m("粘着アンチに\nやられたンゴねぇ……"),
			m("粘着は、愛がないと\nだめンゴねぇ"),
			e({ emote: "♥" }, m("わたしの粘着は、\n愛ンゴねぇ……")),
			e({ gesture: "shake" }, k("自覚あったンゴ！？")),
		],
	},
];
