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
	/** この 窓の 前に 出す エフェクト（engine/sceneFx.ts。boom は 爆発の 音も）。calm か 寸劇の 終わりまで 残る（爆発の 煙は その 前に ひとりでに 晴れる）。 */
	fx?: SceneFx;
	/** fx の 字（止め絵の 名札・予告編の 大きな 字）。 */
	caption?: string;
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
			/** 話の もと（噴水・池・海）の マス。あれば キリコが そちらを 向き、カメラも 向く（ui/village/skits.ts）。 */
			face?: readonly [number, number];
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

const kinoko = by("きのこ");
const safeMan = by("金庫の中の人");
const guest = by("客");
const manager = by("店長");
const regular = by("常連");
const spirit = by("池の精");

export const SKITS: readonly Skit[] = [
	// ───── 期間限定（話の あいだ だけ。その あいだに 村を 歩いたら。先へ 進むと 二度と 出ない） ─────
	// 本筋は パン板（shallow）→ きのこ板（kinoko）→ 風呂板（main）→ 電池板（deep）→ 後日談（hidden）。
	// いまの 話の ようすに ふれる（STORY.md の 各話の 事件。町の 人数・停電と 食いちがわない 人に 言わせる）
	// パン板の 前：町には やきう・ぷゆゆ・原住民 だけで、広場は パン兵に 占領されて いる。原住民は もう 寝返る
	{
		key: "window_pan",
		window: { before: "shallow" },
		on: ANYWHERE,
		lines: [
			native("広場、パン兵に\n占領されちゃったね！"),
			native("でもね、毎朝パンが配られるし、\n税金もパンで払えるよ！"),
			native("ぼく、きのうパン兵に\n志願したよ！"),
			e({ emote: "驚", hit: "slap" }, k("寝返りが早いンゴ！")),
			e({ pause: 400 }, native("あしたは、隊長だよ！")),
		],
	},
	// 第一話の あと：町じゅう 独立した。ツッコミの あとで ボケが もう一段（消しゴムが 攻めてくる）
	{
		key: "window_dokuritsu",
		window: { after: "shallow", before: "kinoko" },
		on: ANYWHERE,
		lines: [
			nanashi("ワイの家も、\n独立したで"),
			nanashi("ワイの消しゴムは、\n国連に加盟したで"),
			e({ emote: "驚", hit: "slap" }, k("独立しすぎンゴ！")),
			nanashi("ほんで、さっき消しゴムに\n宣戦布告された"),
			{
				...e({ pause: 400 }, nanashi("ワイの家、半分\n消されてもうた")),
				fx: "chiin",
			},
		],
	},
	// 第二話の あと：きのこの 行進は 片づいたが、頭に 生えた ままの 名無しが いる（本体は きのこの ほう）
	{
		key: "window_kinoko",
		window: { after: "kinoko", before: "main" },
		on: ANYWHERE,
		lines: [
			nanashi("頭のきのこ、\nまだ抜けへんねん"),
			nanashi("医者に見せたら、\nきのこのほうを診察された"),
			nanashi("ワイは、付き添いの人やて"),
			e({ emote: "驚", hit: "whack" }, k("本体はどっちンゴ！？")),
			e({ pause: 400 }, kinoko("わたしです")),
		],
	},
	// 第三話の あと〜最終話：電池板が 開いて 町は 停電（data/town/revival.ts の inBlackout）。
	// 停電の 夜（story.ts の TEN_NEWS）で キリコが 蓄音機で 豆電球を 割った 天丼
	{
		key: "window_teiden",
		window: { after: "main", before: "deep" },
		on: ANYWHERE,
		lines: [
			nanashi("停電や！町じゅうで1000台、\n自転車こいで発電や！"),
			nanashi("（ぜぇ……ぜぇ……）\n……豆電球1個、ついたで！"),
			e({ gesture: "hop" }, k("吾輩も手伝うンゴ！\n蓄音機を回すンゴ！")),
			{ ...nanashi("あっ"), fx: "blackout" },
			e({ emote: "冷" }, nanashi("……もっぺん、1000台や")),
		],
	},
	// 最終話の あと（後日談の 前）：てっぺんに いたのは やきうだった。出ていた キリコが いちばん ネタバレ
	{
		key: "window_midashi",
		window: { after: "deep", before: "hidden" },
		on: ANYWHERE,
		lines: [
			nanashi("最終話、見たか？"),
			nanashi("見た。\nまさか、やきうが……"),
			e({ emote: "怒", hit: "punch" }, nanashi("ネタバレすな！")),
			k("吾輩、最終話に\n出てたンゴ"),
			e({ emote: "怒", hit: "whack", pause: 400 }, nanashi("ネタバレすな！！")),
		],
	},
	// 銭湯（開くのは 風呂板を 持ち帰って から。決着は 41.5℃。どっちの 派も 出禁）
	{
		key: "enter_bath",
		on: { k: "enter", map: "bath" },
		lines: [
			banndai("いらっしゃい！\nうちの湯は41.5℃や！"),
			e({ gesture: "hop" }, k("決着したンゴ！")),
			banndai("せや。42℃派も41℃派も、\nどっちも出禁にした"),
			banndai("客は、0人や"),
			e({ emote: "得", pause: 400 }, banndai("平和やろ？")),
		],
	},
	// ───── 建物に はじめて 入った ─────
	{
		key: "enter_konbini",
		on: { k: "enter", map: "f_konbini" },
		lines: [
			clerk("いらっしゃいませー。\n温めますか？"),
			k("まだなにも\n持ってないンゴ"),
			clerk("温めますね"),
			e({ emote: "驚", hit: "slap" }, k("吾輩を温めたンゴ！？")),
			e({ pause: 400 }, clerk("袋、おつけしますか？")),
		],
	},
	// 何を 売って いるか わからない 質屋（店主も わかって いない）。売られた ことより 値段に 怒る
	{
		key: "enter_pawn",
		on: { k: "enter", map: "f_pawn" },
		lines: [
			owner("いらっしゃい。\nうちはなんでも売っとるで"),
			k("なにを売ってるンゴ？"),
			owner("……それは、\nワイにもわからん"),
			owner("ちなみに、あんたも売り物や。\n30円"),
			e({ emote: "驚", hit: "whack", pause: 400 }, k("安いンゴ！！")),
		],
	},
	// 質屋の 金庫（中で なにか 鳴いて いる）：中の 人が 真顔
	{
		key: "look_pawn_safe",
		on: { k: "look", thing: "safe", map: "f_pawn" },
		lines: [
			k("鳴いてる金庫、\n開けてみるンゴ"),
			e({ emote: "!" }, owner("あかん！")),
			e({ pause: 400 }, safeMan("……閉めてもろて")),
			e({ gesture: "startle" }, k("だれンゴ！？")),
			owner("質に入っとる、\nとなりのおっさんや"),
		],
	},
	// 海上レストラン「1000」：客は 2人なのに 満席（2人で 全席を 予約して、1卓ずつ 回って いる）
	{
		key: "enter_restaurant",
		on: { k: "enter", map: "f_restaurant" },
		lines: [
			waiter("いらっしゃいませ。\n本日は満席でございます"),
			k("お客さん、\n2人しかいないンゴ"),
			waiter("はい。あちらの2名さまが、\n全席ご予約です"),
			guest("（となりの席へ移って）\nここも、ワイらの席や"),
			e({ pause: 400 }, waiter("本日、48卓目でございます")),
		],
	},
	// 連コインの 先は 両替機だった
	{
		key: "enter_arcade",
		on: { k: "enter", map: "f_arcade" },
		lines: [
			nanashi("連コインは、\n男の美学や"),
			nanashi("（ちゃりん）（ちゃりん）\n（ちゃりん）（ちゃりん）"),
			nanashi("……まだ始まらんな"),
			e({ pause: 400 }, clerk("お客さま、そちらは\n両替機です")),
			e({ emote: "冷" }, nanashi("……美学や")),
		],
	},
	{
		key: "enter_gym",
		on: { k: "enter", map: "f_gym" },
		lines: [
			trainer("ようこそageジムへ！\nまずはスクワットや！"),
			trainer("しゃがんで……"),
			k("……立たないンゴ？"),
			e({ emote: "冷", pause: 400 }, trainer("sageや")),
			e({ hit: "whack" }, k("ジムで下がらないでンゴ！")),
		],
	},
	// 1000杯目で 店ごと 次スレへ（暗転して また 同じ あいさつ）
	{
		key: "enter_bar",
		on: { k: "enter", map: "f_bar" },
		lines: [
			master("いらっしゃい。\n次スレへようこそや"),
			master("1000杯目が出たら、\n店ごと次スレや"),
			{ ...nanashi("（ごくっ）……1000杯目"), fx: "blackout" },
			{ ...master("いらっしゃい。\n次スレへようこそや"), calm: true },
			e({ emote: "驚", hit: "slap" }, k("吾輩、まだ座っても\nないンゴ！")),
		],
	},
	// 何を 言われても「乙」で 返す 店（出てくるのは おつゆだけ）
	{
		key: "enter_ramen",
		on: { k: "enter", map: "f_ramen" },
		lines: [
			owner("へいらっしゃい！\n麺のかたさは？"),
			k("ふつうンゴ"),
			e({ emote: "!" }, owner("乙！")),
			e({ emote: "驚" }, k("スープしか\n入ってないンゴ！")),
			e({ emote: "得", pause: 400 }, owner("乙（おつゆ）一丁！")),
		],
	},
	{
		key: "enter_cinema",
		on: { k: "enter", map: "f_cinema" },
		lines: [
			usher("本日の上映は、\nスレ1本まるごとです"),
			usher("上映時間は、\nおよそ3年です"),
			e({ gesture: "shake" }, k("長いンゴ！")),
			usher("なお、いま上映中の回は、\n2009年からです"),
			e({ pause: 400 }, guest("（ヒゲの名無し）\n……シーッ")),
		],
	},
	{
		key: "enter_casino",
		on: { k: "enter", map: "f_casino" },
		lines: [
			dealer("いらっしゃいませ。\n当店の勝率は、5割です"),
			dealer("……お店の、です"),
			dealer("なお、常連さまは通算\n3勝1万2千敗です"),
			e({ emote: "得", pause: 400 }, regular("あと1万1997勝で、\nトントンや")),
		],
	},
	// ───── 建物の オチ（爆発は 直しては 爆発させる リサイクル屋と 秘密結社の 1回目だけ。ほかは 暗転・チーン・草で 落とす） ─────
	// 地図は こわさない。煙が 晴れたら（calm）建物は 元通りで、本人たちも 気に しない。元通りに なった ことは
	// 言わない（見れば わかる）。
	{
		key: "enter_famires",
		on: { k: "enter", map: "f_famires" },
		lines: [
			clerk("ドリンクバーは、\nおかわり自由です"),
			k("ぜんぶ混ぜるンゴ"),
			manager("（グラスの中から）\nごぼごぼ……"),
			e({ emote: "驚", hit: "slap" }, k("店長が入ってるンゴ！？")),
			e({ pause: 400 }, clerk("店長は、追加料金です")),
		],
	},
	{
		key: "enter_recycle",
		on: { k: "enter", map: "f_recycle" },
		lines: [
			owner("うちは何でも\n直して売るよ"),
			owner("直したやつは、\nだいたい爆発するけどな"),
			e({ gesture: "shake" }, k("売っちゃだめンゴ！")),
			{ ...owner("……ほら、いま1台"), fx: "boom" },
			{ ...owner("（アフロで）よし。\nワイも直せる"), calm: true },
		],
	},
	{
		key: "enter_dojo",
		on: { k: "enter", map: "f_dojo" },
		lines: [
			sensei("気合いだ！\n気合いで瓦を割れ！"),
			sensei("見本を見せる！\nちぇすとーーっ！！"),
			{
				...e({ emote: "冷", pause: 400 }, sensei("……拳が、割れた")),
				fx: "chiin",
			},
			{
				...e({ emote: "得" }, sensei("瓦を割らぬ優しさも、\nまた武道だ")),
				calm: true,
			},
		],
	},
	// 台本は「暗転」の 1行だけ。2回公演で もう一度 暗転
	{
		key: "enter_theater",
		on: { k: "enter", map: "f_theater" },
		lines: [
			actor("本日の演目は、\n『やきう物語』！"),
			actor("……なんやけど、\n台本が1行しかない"),
			{ ...actor("『暗転』"), fx: "blackout" },
			{ ...actor("本日は、2回公演です"), calm: true },
			{ ...e({ pause: 400 }, actor("『暗転』")), fx: "blackout" },
		],
	},
	// ───── 村の 物を はじめて 調べた ─────
	// 秘密結社の 本部（分譲住宅の 青い 家。表札を 出して いる）。テロは スレの 埋め立てで、最後は 自分の 家で 爆発。
	// 2回目は 爆発の 天丼を ずらす（よその 家を ねらって、爆発させずに 中止）。見た 帰りの 次から
	{
		key: "look_kessha",
		on: { k: "look", thing: "fthing_house_b" },
		lines: [
			boss("作戦を発表する。\n今夜、おんJの全スレを1000にする"),
			member("それ、毎晩だれかが\nやっとることですやん"),
			boss("……作戦変更や。\nまず、この家を爆破する"),
			{ ...e({ emote: "驚" }, k("自分の家ンゴ！？")), fx: "boom" },
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
			member("……となり、\nうちの実家ですけど"),
			{ ...boss("……作戦は、中止や"), fx: "chiin" },
		],
	},
	// ROM専の 神さまは 上に いた（1人では ない）。キリコは ツッコまない
	{
		key: "look_shrine",
		on: { k: "look", thing: "shrine" },
		lines: [
			e({ gesture: "startle" }, k("見られてる気がするンゴ！\n……そこンゴ！")),
			n("だれもいない。"),
			k("……上ンゴ！"),
			nanashi("（上から）……バレたか"),
			e({ pause: 400 }, nanashi("（上から）ワイも\n（上から）ワイも")),
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
	// 自販機の 下には 名無しが 住んで いる
	{
		key: "look_vend",
		on: { k: "look", thing: "fthing_vend" },
		lines: [
			k("自販機の下に、\nなにか光ってるンゴ"),
			k("……手、とどかないンゴ"),
			e({ pause: 400 }, nanashi("（下から）とったらあかん。\nワイの家や")),
			e({ emote: "驚", hit: "slap" }, k("住んでるンゴ！？")),
			nanashi("（下から）家賃、10円や"),
		],
	},
	// ───── ある 場所に はじめて 来た ─────
	// 広場の 南東の 噴水（パン板の あとから 水が 出る）
	{
		key: "near_fountain",
		window: { after: "shallow" },
		on: { k: "near", map: "village", x: [23, 30], y: [29, 30], face: [25, 25] },
		lines: [
			k("噴水ンゴ"),
			k("打たれたら、吾輩も\n強くなれるンゴ？"),
			n("……噴水は、\n下から打ってくる。"),
			e(
				{ gesture: "startle", hit: "slap" },
				k("おしりしか\n鍛えられないンゴ！"),
			),
		],
	},
	// 広場の 南の 池の ほとり：池の 精の 話の 裏返し（道具は わたさない）
	{
		key: "near_pond",
		on: { k: "near", map: "village", x: [10, 17], y: [30, 31], face: [13, 27] },
		lines: [
			k("池ンゴ！"),
			spirit("おぬしが落としたのは、\n金の蓄音機か？銀か？"),
			k("なにも落としてないンゴ"),
			e({ pause: 400 }, spirit("では、おぬしを沈めて、\n正直かどうか確かめる")),
			e({ emote: "青", hit: "sting" }, k("魔女裁判ンゴ！")),
		],
	},
	// 浜の 東の はし（桟橋からは 遠い）。沖に 遠泳中の 名無し
	{
		key: "near_beach",
		on: { k: "near", map: "village", x: [40, 62], y: [33, 36], face: [50, 38] },
		lines: [
			e({ gesture: "hop" }, k("全部の板を\n回るンゴーー！！")),
			nanashi("（沖から）うるさい！\nこっちは遠泳中や！"),
			e({ emote: "驚" }, k("沖に人いたンゴ！？")),
			e({ pause: 400 }, nanashi("（沖から）ハワイまで、\nあと6000キロや")),
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
			e({ emote: "得" }, m("明日から『地雷焼き』\n出すもん！試食係だもん！")),
			e({ emote: "青", hit: "sting" }, k("また踏むンゴ！？")),
		],
	},
	{
		key: "death_pit",
		on: { k: "death", mob: "hinary", cause: "落とし穴" },
		lines: [
			m("落とし穴の調査結果を\n発表します"),
			m("穴は、下に向かって\nあいている模様です"),
			m("落ちた人は、下に向かって\n落ちた模様です"),
			e({ emote: "驚", hit: "whack" }, k("知ってるンゴ！\n落ちたの吾輩ンゴ！")),
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
			e(
				{ emote: "得", pause: 400 },
				m("ちなみに自演くんの中身も、\nわたくしよぉ"),
			),
		],
	},
	{
		key: "death_pitcher",
		on: { k: "death", mob: "yayapoji", cause: "ピッチャー" },
		lines: [
			m("ピッチャーに\n負けたんだ"),
			k("くやしいンゴ！"),
			e(
				{ emote: "花", pause: 400 },
				m("ぼく、ピッチャーのほうを\n応援してたんだ"),
			),
			e({ emote: "青", hit: "sting" }, k("味方が\nいなかったンゴ！")),
		],
	},
	// コピペは キリコに うつる
	{
		key: "death_copipe",
		on: { k: "death", mob: "proto", cause: "コピペ" },
		lines: [
			m("コピペにたおされたと\n記録したゼロ"),
			m("コピペにたおされたと\n記録したゼロ"),
			m("コピペにたおされたと\n記録したゼロ"),
			e({ emote: "驚", hit: "slap" }, k("3回言ったンゴ！")),
			e({ emote: "青", pause: 400 }, k("3回言ったンゴ！")),
		],
	},
	{
		key: "death_okimono",
		on: { k: "death", mob: "shobon", cause: "置物" },
		lines: [
			m("置物にやられたの？\nあれ、動かないでしょ"),
			k("動かないのに\nやられたンゴ！"),
			m("(´・ω・｀)おれも、\n置物ってよく言われるよ"),
			e({ gesture: "hop" }, m("ちょっと本気で\n動いてみようかな")),
			e({ pause: 400 }, m("(´・ω・｀)……つかれた")),
		],
	},
	// 粘着アンチ（ンゴ姉は フェリスへの 粘着を 愛と 呼ぶ。フェリスの 名前は 出さない）
	{
		key: "death_nenchaku",
		on: { k: "death", mob: "ngoane", cause: "粘着アンチ" },
		lines: [
			m("粘着アンチに\nやられたンゴねぇ……"),
			m("粘着は、愛がないと\nだめンゴねぇ"),
			k("……実感こもってるンゴ"),
			e(
				{ emote: "♥", pause: 400 },
				m("愛があれば、通報されても\n平気ンゴねぇ"),
			),
		],
	},
];
