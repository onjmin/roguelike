// 寸劇（きっかけつきで 1回きり。動かすのは ui/village/skits.ts）。
// きっかけは 5つ：建物に 入った（enter）・物を 調べた（look）・ある 場所に 来た（near）・
// ある 死に方で 帰ってきて その 住人に はじめて 話しかけた（death。前の冒険への 反応を かねる）・その 店で 払った（buy）。
// 踏めば かならず 起きる ものに しない（2026-10-22 作者）：見こみ（chance。帰りごとに 1度 決める）・
// つづきもの（follows）・期間限定（window）を 重ねる。村ぜんぶで 1回の 帰りに 1本まで。
// 立ち位置（stage）：話す 相手が 地図に 立って いる なら、キリコは その 前へ 歩いて から 始める（入口で 遠くの 店員と 話さない）。
// 1本は 3〜5窓（ふだんの 話しかけより 長い。1回きりなので）。201 の 型：同じ 形で 3段 大きく して、
// 最後に キリコか 本人が つっこむ（STORY.md「201級の 笑い」）。
// 地の文で 画面に 見えない 出来事（物が ふえた・人が 来た）を 言わない。話す 人の 口で 言わせる。
// 期間限定（window）は 本筋の 話の あいだ だけ 起きて、先へ 進むと 二度と 出ない（現実の 日付には つながない）。
// ほかより 先に 選ぶ（並びの いちばん 上）。

import type { DungeonId } from "../../core/types";
import type { Cue } from "../../engine/emote";
import type { HeadProp } from "../../engine/headProp";
import type { SceneFx } from "../../engine/sceneFx";
import type { Dir } from "../../engine/types";
import type { MobId } from "../people/mobs";
import { NANASHI_WALK } from "../village/hall";

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
	/** この 窓の 前に カメラを 向ける マス（null で キリコへ）。 */
	look?: readonly [number, number] | null;
	/** fx を 出す 所：地図の マス（爆発する 家の 上 など）か 人の id（"mob" は その 住人。歩いても 追う）。無ければ 画面の まんなか。 */
	fxAt?: readonly [number, number] | string;
	/** この 窓の 前に 鳴らす 効果音（data/audio/sfx.ts）。 */
	se?: string;
	/** この 窓の 前に キリコが その マスまで 吹っとぶ（速く すべり、画面が ゆれる）。 */
	fling?: readonly [number, number] | "far";
	/** この 窓の 前に キリコの 顔の カットイン（驚き・ツッコミの 瞬間）。 */
	cutin?: true;
	/** この 窓の 前に 地図の 人・場面の 人（ID）を 消す（床の 下へ 沈んだ など。"player" は キリコ。寸劇の 終わりに もどる）。 */
	hide?: string;
	/** この 窓の 前に 場面の 人（SkitExtra の id。いくつでも いっしょに）を 出す（later の 人。来かたは come）。消した 人なら その場に もどる。 */
	show?: string | readonly string[];
	/** この 窓の 前に キリコを その マスへ 置く（海・池の 中 など 歩いて 入れない 所。終わりに もとの マスへ）。 */
	put?: readonly [number, number];
};

/**
 * 場面だけの 人（寸劇の 名無し・客・おまわりさん など。台詞で 話す 人は 画面に 出す）。
 * 寸劇の あいだだけ いて、終わると 消える。話しかけられない。
 */
export type SkitExtra = {
	id: string;
	/** 歩行グラ（sa: など）。 */
	sprite: string;
	/** 立つ マス。"near" は キリコの そばの あいた マス（村の どこでも 起きる 寸劇）、"kiriko" は キリコの マスに 重なる。 */
	at: readonly [number, number] | "near" | "kiriko";
	/** 向き（無ければ キリコの ほう）。 */
	face?: Dir;
	/** はじめは いない（窓の show で 出る）。 */
	later?: true;
	/** 出る ときの 来かた：walk＝少し はなれた 所から 歩いて くる・drop＝上から 落ちて くる・マス＝そこから 歩いて くる。無ければ その場に。 */
	come?: "walk" | "drop" | readonly [number, number];
	/** 頭の 物（頭に きのこ）。 */
	wear?: HeadProp;
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
	| { k: "death"; mob: MobId; cause: string }
	/** その 地図で お金を 払った（買った・遊んだ）。thing が あれば その 人・物（イベントの id の 頭）で 払った ときだけ。 */
	| { k: "buy"; map: string; thing?: string };

/** 起きる あいだ（本筋の 話。after を 持ち帰った あとで、before を まだ 持ち帰って いない とき）。 */
export type SkitWindow = { after?: DungeonId; before?: DungeonId };

/** 寸劇の 立ち位置（話す 相手の 前へ キリコが 歩いて から 始める）。 */
export type SkitStage = {
	/** キリコが 立つ マスと 向き（無ければ その 場で。調べた 物・払った 物の 前に もう 立って いる とき）。 */
	at?: readonly [number, number];
	face?: Dir;
	/** 名前つきの 人の 窓の 記号・動きを 出す 地図の 人（名前 → イベントの id）。 */
	cast?: Readonly<Record<string, string>>;
	/** 寸劇の 前に 持ち場へ 歩く 人（終わったら home へ もどる）。 */
	walk?: readonly {
		id: string;
		to: readonly [number, number];
		face: Dir;
		home: readonly [number, number];
		homeFace: Dir;
	}[];
};

export type Skit = {
	key: string;
	on: SkitOn;
	lines: readonly SkitLine[];
	/** 期間限定（話の その あいだ だけ。先へ 進むと 二度と 出ない）。 */
	window?: SkitWindow;
	/** 起きる 見こみ（0〜1）。1回の 帰りに 1度 だけ 決める（はずれた 帰りは きっかけを 踏んでも 起きない。次の 帰りに また 決める）。 */
	chance?: number;
	/** この 寸劇を 見た あとでだけ 起きる（つづきもの）。 */
	follows?: string;
	stage?: SkitStage;
	/** 場面だけの 人（話す 人を 画面に 出す。名前は stage.cast で つなぐ）。 */
	extras?: readonly SkitExtra[];
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
const police = by("おまわりさん");

/** 場面に 出す 名無し（本館の 名無しと 同じ 絵）。 */
const NANASHI_A = NANASHI_WALK[0];
const NANASHI_B = NANASHI_WALK[3];
/** きのこ（町の 事件の きのこ軍と 同じ 絵）。 */
const KINOKO = "pub:sprites/kinonyan.png";
/** 秘密結社の 首領と 構成員（家の 前に 出て きて いる）。 */
const KESSHA: readonly SkitExtra[] = [
	{ id: "x_boss", sprite: "sa:pMxknZ", at: "near" },
	{ id: "x_member", sprite: "sa:RMEetu", at: "near" },
];
/** そばに 歩いて くる 名無し（村の どこでも 起きる 寸劇の 話し手）。 */
const walkIn = (id: string, sprite = NANASHI_A): SkitExtra => ({
	id,
	sprite,
	at: "near",
	come: "walk",
});

export const SKITS: readonly Skit[] = [
	// ───── 期間限定（話の あいだ だけ。その あいだに 村を 歩いたら。先へ 進むと 二度と 出ない） ─────
	// 本筋は パン板（shallow）→ きのこ板（kinoko）→ 風呂板（main）→ 電池板（deep）→ 後日談（hidden）。
	// いまの 話の ようすに ふれる（STORY.md の 各話の 事件。町の 人数・停電と 食いちがわない 人に 言わせる）。
	// 毒（2026-10-21 作者）：ボケは 真顔で 押し通し、状況が 壊れるまで やめない。キリコは ときどき 一緒に 狂う
	// パン板の 前：町には やきう・ぷゆゆ・原住民 だけで、広場は パン兵に 占領されて いる。原住民は もう 寝返り、キリコを 確保する。
	// 話すのは 西の 空き地に すわって いる 原住民（data/people/mobs.ts の shobon）：その そばに 来たら
	{
		key: "window_pan",
		window: { before: "shallow" },
		on: { k: "near", map: "village", x: [6, 10], y: [19, 23], face: [8, 21] },
		stage: { cast: { 原住民: "mob_shobon" } },
		lines: [
			native("広場、パン兵に\n占領されちゃったね！"),
			native("でもね、毎朝パンが配られるし、\n税金もパンで払えるよ！"),
			native("ぼく、きのうパン兵に\n志願したよ！"),
			{
				...e({ emote: "驚", hit: "slap" }, k("寝返りが早いンゴ！")),
				cutin: true,
			},
			{
				...e(
					{ auto: 800, hit: "punch" },
					native("隊長命令だよ。\nキリコ、確保！"),
				),
				fling: "far",
			},
			e({ auto: 1200, emote: "花" }, k("（もぐもぐ）……吾輩も、\n志願するンゴ")),
		],
	},
	// 第一話の あと：町じゅう 独立した。消しゴムが 攻めて きて、名無しは 消されて、書きなおされる
	{
		key: "window_dokuritsu",
		window: { after: "shallow", before: "kinoko" },
		on: ANYWHERE,
		extras: [walkIn("x_nanashi")],
		stage: { cast: { 名無し: "x_nanashi" } },
		lines: [
			nanashi("ワイの家も、\n独立したで"),
			nanashi("ワイの消しゴムは、\n国連に加盟したで"),
			e({ emote: "驚", hit: "slap" }, k("独立しすぎンゴ！")),
			nanashi("ほんで、さっき消しゴムに\n宣戦布告された"),
			{
				...e({ auto: 1300 }, n("名無しは、消された。")),
				hide: "x_nanashi",
				fx: "ko",
				caption: "名無しは　消された",
			},
			{
				...e({ auto: 1100 }, nanashi("……書きなおしたで")),
				show: "x_nanashi",
				calm: true,
			},
		],
	},
	// 第二話の あと：頭に 生えた きのこの ほうが 本体。名無しは 抜かれて、付き添いに もどる
	{
		key: "window_kinoko",
		window: { after: "kinoko", before: "main" },
		on: ANYWHERE,
		// 頭に きのこの 名無し。抜けると きのこ（きのこ軍の 絵）が となりに 立つ
		extras: [
			{ ...walkIn("x_nanashi"), wear: "kinoko" },
			{ id: "x_kinoko", sprite: KINOKO, at: "near", later: true },
			// 抜かれて 起きあがった 名無し（頭に もう きのこは ない）
			{ id: "x_nanashi2", sprite: NANASHI_A, at: "near", later: true },
		],
		stage: { cast: { 名無し: "x_nanashi", きのこ: "x_nanashi" } },
		lines: [
			nanashi("頭のきのこ、\nまだ抜けへんねん"),
			nanashi("医者に見せたら、\nきのこのほうを診察された"),
			nanashi("ワイは、付き添いの人やて"),
			{
				...e({ emote: "驚", hit: "whack" }, k("本体はどっちンゴ！？")),
				cutin: true,
			},
			e({ pause: 400 }, kinoko("わたしです")),
			e({ auto: 900 }, kinoko("この人は、もう\n抜いてええで")),
			{
				...e({ auto: 1300 }, n("名無しが、抜けた。")),
				hide: "x_nanashi",
				show: "x_kinoko",
				fx: "ko",
				caption: "名無しは　抜かれた",
			},
			{
				...e({ auto: 1100 }, nanashi("（むくり）……\n付き添いに、もどるわ")),
				show: "x_nanashi2",
				calm: true,
			},
		],
	},
	// 第三話の あと〜最終話：電池板が 開いて 町は 停電（data/town/revival.ts の inBlackout）。
	// 停電の 夜（story.ts の TEN_NEWS）で キリコが 蓄音機で 豆電球を 割った 天丼。割った キリコが 朝まで 回させられる。
	// 見える ものだけで 運ぶ：暗い 町（停電の 空）・回る キリコ・頭の 上に ともる 豆電球（fx の bulb）・割れる 音と 暗転。
	// 名無しは 暗い 中を 歩いて くる。画面に 無い 物（自転車・発電機）や 数（町じゅうで 何台）は 言わない
	{
		key: "window_teiden",
		window: { after: "main", before: "deep" },
		on: ANYWHERE,
		extras: [walkIn("x_nanashi")],
		stage: { cast: { 名無し: "x_nanashi" } },
		lines: [
			nanashi("停電や！\nだれか、発電してくれ！"),
			e({ gesture: "spin" }, k("吾輩が、蓄音機を\n回すンゴ！")),
			{
				...e({ pause: 300 }, nanashi("\n……豆電球、ついたで！")),
				fx: "bulb",
			},
			e({ gesture: "spin", auto: 700 }, k("もっと回すンゴ！")),
			{
				...nanashi("あっ"),
				se: "glassBreak",
				fx: "blackout",
			},
			{
				...e(
					{ emote: "冷", pause: 400 },
					nanashi("……キリコ、\n朝まで回しとけ"),
				),
				calm: true,
			},
			{
				...e(
					{ gesture: "spin", auto: 1300 },
					k("（ぐるぐる）……豆電球、\nもう1個ついたンゴ"),
				),
				fx: "bulb",
			},
		],
	},
	// 最終話の あと（後日談の 前）：てっぺんに いたのは やきうだった。出て いた キリコが いちばん ネタバレで、
	// 殴られた あとは 殴りあいに なる（歩いて きた 名無し 2人）
	{
		key: "window_midashi",
		window: { after: "deep", before: "hidden" },
		on: ANYWHERE,
		extras: [walkIn("x_a"), walkIn("x_b", NANASHI_B)],
		stage: { cast: { 名無し: "x_a" } },
		lines: [
			nanashi("最終話、見たか？"),
			nanashi("見た。\nまさか、やきうが……"),
			e({ emote: "怒", hit: "punch" }, nanashi("ネタバレすな！")),
			k("吾輩、最終話に\n出てたンゴ"),
			{
				...e(
					{ emote: "怒", hit: "whack", pause: 400 },
					nanashi("ネタバレすな！！"),
				),
				fling: "far",
			},
			e({ auto: 500, hit: "punch" }, nanashi("いま、言うたな！")),
			e({ auto: 500, hit: "punch" }, nanashi("お前もや！")),
			e({ auto: 1100 }, nanashi("……で、最終話どうなったん")),
		],
	},
	// ───── 建物に はじめて 入った（2026-10-21 作者「文字だけで なく 演出を 使って 店舗を 改善」） ─────
	// 見せ方の 道具（engine/sceneFx.ts・ui/village/skits.ts）：auto＝押さずに 畳みかけ、cutin＝キリコの 顔の カットイン、
	// freeze＝止め絵と 名札（値札・看板。言われた あとの 行に）、fling＝吹っとぶ、heat＝温められる、slowmo＝スロー、
	// trailer＝予告編、ko＝たおれた（すぐ 起きる）、mosaic＝服が 飛んだ 人を 隠す。freeze の あとに fling を 置かない。
	// 毒（2026-10-21 作者）：ボケは 真顔で 押し通し、状況が 壊れるまで やめない。暴力・すぐ 死ぬ・服が 飛ぶ は よい、
	// 汚い・下品は 入れない。キリコは ときどき 一緒に 狂う（ツッコまずに 乗る）。
	// 銭湯（開くのは 風呂板を 持ち帰って から。決着は 41.5℃。0.1℃でも 文句を 言えば 沈める）
	{
		key: "enter_bath",
		on: { k: "enter", map: "bath" },
		stage: { at: [8, 13], face: "up", cast: { 番台: "bandai" } },
		lines: [
			banndai("いらっしゃい！\nうちの湯は41.5℃や！"),
			e({ gesture: "hop" }, k("決着したンゴ！")),
			banndai("42℃派も41℃派も出禁や。\n文句言うたら、沈める"),
			e({ emote: "得" }, k("……ちょっと\nぬるいンゴ")),
			{ ...e({ auto: 700 }, banndai("沈めます")), se: "bubble", fling: "far" },
			{
				...e({ pause: 500 }, banndai("平和やろ？")),
				fx: "freeze",
				caption: "本日の客　0人（1人 沈没）",
			},
		],
	},
	// レジで 贈り物を 買った あと。温められて、こんがり たおれても、店員は 真顔で 接客を 続ける。
	// キリコは 起きて 袋を もらう（一緒に 狂う）
	{
		key: "buy_konbini",
		on: { k: "buy", map: "f_konbini", thing: "konbini_clerk" },
		stage: { at: [2, 8], face: "up", cast: { 店員: "konbini_clerk" } },
		lines: [
			clerk("お買い上げ、ありがとう\nございますー。温めますか？"),
			k("それ、プレゼントンゴ"),
			clerk("温めますね"),
			{
				...e({ emote: "驚", hit: "slap" }, k("吾輩を温めたンゴ！？")),
				fx: "heat",
				cutin: true,
			},
			e({ auto: 450 }, clerk("袋、おつけしますか？")),
			e({ auto: 450 }, clerk("お箸、おつけしますか？")),
			e({ auto: 500 }, clerk("もう1分、温めますね")),
			{
				...e({ auto: 1300 }, n("キリコは、こんがりたおれた。")),
				se: "chiin",
				fx: "ko",
				caption: "キリコは　たおれた",
			},
			{
				...e({ pause: 600 }, clerk("……袋、\nおつけしますか？")),
				calm: true,
			},
			e({ gesture: "hop", auto: 1100 }, k("（むくり）\n……つけるンゴ")),
		],
	},
	// 何を 売って いるか わからない 質屋：キリコに 値札、その場で 客が 買って 運んで いく
	{
		key: "enter_pawn",
		extras: [
			{
				id: "x_guest",
				sprite: NANASHI_B,
				at: [5, 6],
				come: [4, 7],
				later: true,
			},
		],
		on: { k: "enter", map: "f_pawn" },
		chance: 0.5,
		stage: {
			at: [6, 6],
			face: "up",
			cast: { 店主: "pawn_owner", 客: "x_guest" },
		},
		lines: [
			owner("いらっしゃい。\nうちはなんでも売っとるで"),
			k("なにを売ってるンゴ？"),
			owner("ちなみに、あんたも売り物や。\n30円"),
			{
				...e({ emote: "驚", hit: "whack", pause: 400 }, k("安いンゴ！！")),
				fx: "freeze",
				caption: "蓄音キリコ　30円",
				cutin: true,
			},
			{
				...e({ auto: 700 }, guest("これください")),
				show: "x_guest",
				calm: true,
			},
			{ ...e({ auto: 1200 }, owner("まいど")), fling: "far" },
		],
	},
	// 質屋の 金庫（中で なにか 鳴いて いる）：中の 人が 真顔で 注文を 足し、店主は 真顔で 売る 気で いる
	{
		key: "look_pawn_safe",
		on: { k: "look", thing: "safe", map: "f_pawn" },
		// 店主に「なんでも売っとる」と 聞いた あと
		follows: "enter_pawn",
		stage: { at: [10, 4], face: "up", cast: { 店主: "pawn_owner" } },
		lines: [
			k("鳴いてる金庫、\n開けてみるンゴ"),
			e({ emote: "!" }, owner("あかん！")),
			e({ pause: 400 }, safeMan("……閉めてもろて")),
			{ ...e({ emote: "驚", hit: "slap" }, k("だれンゴ！？")), cutin: true },
			owner("質に入っとる、となりの\nおっさんや。流れたら、売る"),
			e({ auto: 900 }, safeMan("……あと、電気も\n消してもろて")),
		],
	},
	// 海上レストラン「1000」：2人で 全席を 回り、キリコの 席まで 取る。キリコも 席を 取りに 回る
	{
		key: "enter_restaurant",
		on: { k: "enter", map: "f_restaurant" },
		chance: 0.5,
		stage: {
			at: [9, 7],
			face: "up",
			cast: { 給仕: "rest_waiter", 客: "rest_guest_b" },
		},
		lines: [
			waiter("いらっしゃいませ。\n本日は満席でございます"),
			k("お客さん、\n2人しかいないンゴ"),
			waiter("はい。あちらの2名さまが、\n全席ご予約です"),
			e({ auto: 400 }, guest("ここも、ワイらの席や")),
			e({ auto: 400 }, guest("ここもや")),
			{ ...e({ auto: 700 }, guest("そこもや")), fling: "far" },
			e({ pause: 400 }, waiter("本日、49卓目でございます")),
			e({ auto: 1100, gesture: "hop" }, k("……ここは、\n吾輩の席ンゴ")),
		],
	},
	// 1回 遊んだ あと。連コインの 先は 両替機。言われても やめない。キリコも 美学に 乗る
	// （格ゲーの 名無しが 両替機の 前へ 歩いて いき、キリコも その となりへ）
	{
		key: "buy_arcade",
		extras: [
			{
				id: "x_clerk",
				sprite: NANASHI_WALK[1],
				at: [2, 10],
				come: [8, 10],
				later: true,
			},
		],
		on: { k: "buy", map: "f_arcade" },
		stage: {
			at: [1, 10],
			face: "up",
			cast: { 名無し: "arcade_a", 店員: "x_clerk" },
			walk: [
				{
					id: "arcade_a",
					to: [2, 9],
					face: "left",
					home: [6, 4],
					homeFace: "left",
				},
			],
		},
		lines: [
			nanashi("連コインは、\n男の美学や"),
			{ ...e({ auto: 300 }, nanashi("（ちゃりん）")), se: "arcCoin" },
			{ ...e({ auto: 300 }, nanashi("（ちゃりん）")), se: "arcCoin" },
			{ ...e({ auto: 300 }, nanashi("（ちゃりん）")), se: "arcCoin" },
			{
				...e({ pause: 400 }, clerk("お客さま、そちらは\n両替機です")),
				show: "x_clerk",
			},
			{
				...e({ emote: "冷" }, nanashi("……知っとる。美学や")),
				fx: "freeze",
				caption: "連コインの相手：両替機",
			},
			{ ...e({ auto: 400 }, k("（ちゃりん）")), se: "arcCoin", calm: true },
			{ ...e({ auto: 400 }, k("（ちゃりん）")), se: "arcCoin" },
			e({ auto: 1100, emote: "得" }, k("……美学ンゴ")),
		],
	},
	// sage と 言った トレーナーは 本当に 床の 下まで 沈み、床下から 指導を 続ける
	{
		key: "enter_gym",
		on: { k: "enter", map: "f_gym" },
		chance: 0.5,
		stage: { at: [4, 5], face: "right", cast: { トレーナー: "gym_trainer" } },
		lines: [
			trainer("ようこそageジムへ！\nまずはスクワットや！"),
			{ ...trainer("しゃがんで……"), fx: "slowmo" },
			{ ...e({ emote: "冷", pause: 400 }, trainer("sageや")), calm: true },
			{
				...e({ auto: 800 }, n("トレーナーは、床の下へ\n沈んでいった。")),
				se: "fall",
				hide: "gym_trainer",
			},
			e({ auto: 1000 }, trainer("（床の下から）\n……そのまま、あと100回")),
			{
				...e({ emote: "驚", hit: "whack" }, k("ジムで下がらないでンゴ！")),
				cutin: true,
			},
		],
	},
	// 1000杯目で 店ごと 次スレへ（暗転して また 同じ あいさつ）。キリコも 1001杯目を 飲む
	{
		key: "enter_bar",
		// カウンターで 飲んで いる 名無し
		extras: [{ id: "x_nanashi", sprite: NANASHI_A, at: [2, 5], face: "up" }],
		on: { k: "enter", map: "f_bar" },
		// 座る 前（カウンターの 椅子の うしろ）
		stage: {
			at: [3, 6],
			face: "up",
			cast: { マスター: "bar_master", 名無し: "x_nanashi" },
		},
		lines: [
			master("いらっしゃい。\n次スレへようこそや"),
			master("1000杯目が出たら、\n店ごと次スレや"),
			{ ...nanashi("（ごくっ）……1000杯目"), fx: "blackout" },
			{ ...master("いらっしゃい。\n次スレへようこそや"), calm: true },
			{
				...e({ emote: "驚", hit: "slap" }, k("吾輩、まだ座っても\nないンゴ！")),
				cutin: true,
			},
			{ ...e({ auto: 1000 }, k("（ごくっ）……1001杯目ンゴ")), fx: "blackout" },
		],
	},
	// 何を 言われても「乙」。店が 燃えても「乙」
	{
		key: "enter_ramen",
		on: { k: "enter", map: "f_ramen" },
		chance: 0.5,
		// カウンターの 席で 頼む
		stage: { at: [4, 6], face: "up", cast: { 店主: "ramen_master" } },
		lines: [
			owner("へいらっしゃい！\n麺のかたさは？"),
			k("ふつうンゴ"),
			e({ auto: 350, emote: "!" }, owner("乙！")),
			e({ auto: 350 }, owner("乙！")),
			{ ...e({ emote: "驚" }, k("スープしか\n入ってないンゴ！")), cutin: true },
			e({ emote: "得", pause: 400 }, owner("乙（おつゆ）一丁！")),
			{
				...e({ auto: 800 }, n("厨房の鍋から、火が出た。")),
				fx: "fire",
				fxAt: [1, 4],
			},
			{
				...e({ auto: 900 }, n("火は、キリコに燃えうつった。")),
				fx: "heat",
				fling: "far",
			},
			e({ auto: 1200 }, owner("乙！")),
		],
	},
	// 2009年からの 上映：客席の シーッが だんだん 大きく なり、最後は キリコを つまみ出す
	{
		key: "enter_cinema",
		on: { k: "enter", map: "f_cinema" },
		chance: 0.5,
		stage: {
			at: [2, 3],
			face: "left",
			cast: { 係員: "cinema_staff", 客: "x_g3" },
		},
		// 客席（スクリーンの ほうを 向いて すわって いる）
		extras: [
			{ id: "x_g1", sprite: NANASHI_A, at: [3, 4], face: "up", later: true },
			{ id: "x_g2", sprite: NANASHI_B, at: [5, 5], face: "up", later: true },
			{
				id: "x_g3",
				sprite: NANASHI_WALK[2],
				at: [3, 7],
				face: "up",
				later: true,
			},
		],
		lines: [
			usher("本日の上映は、\nスレ1本まるごとです"),
			usher("上映時間は、\nおよそ3年です"),
			e({ gesture: "shake" }, k("長いンゴ！")),
			usher("なお、いま上映中の回は、\n2009年からです"),
			{
				...e({ pause: 400, auto: 500 }, guest("（ヒゲの名無し）\n……シーッ")),
				show: "x_g1",
			},
			{
				...e({ auto: 400 }, guest("（もっとヒゲの名無し）\nシーッ")),
				show: "x_g2",
			},
			{
				...e(
					{ auto: 1000 },
					guest("（ヒゲしか見えない名無し）\nシーーーッ！！"),
				),
				show: "x_g3",
				hit: "punch",
				fling: "far",
			},
		],
	},
	// 常連は 真顔で 来世まで 借りて いる
	{
		key: "enter_casino",
		on: { k: "enter", map: "f_casino" },
		chance: 0.5,
		stage: {
			at: [4, 6],
			face: "up",
			cast: { ディーラー: "casino_dealer", 常連: "x_regular" },
		},
		extras: [{ id: "x_regular", sprite: NANASHI_B, at: [5, 5], face: "left" }],
		lines: [
			dealer("いらっしゃいませ。\n当店の勝率は、5割です"),
			dealer("……お店の、です"),
			dealer("なお、常連さまは通算\n3勝1万2千敗です"),
			{
				...e(
					{ emote: "得", pause: 400 },
					regular("あと1万1997勝で、\nトントンや"),
				),
				fx: "freeze",
				caption: "常連　3勝　1万2千敗",
			},
			{
				...e({ auto: 900 }, dealer("お支払いは、\n来世でけっこうです")),
				calm: true,
			},
			e({ auto: 1200 }, regular("来世のぶんも、\nもう借りとる")),
		],
	},
	// ───── 建物の オチ（爆発は 直しては 爆発させる リサイクル屋と 秘密結社の 1回目だけ。ほかは 暗転・チーン・草で 落とす） ─────
	// 地図は こわさない。煙が 晴れたら（calm）建物は 元通りで、本人たちも 気に しない。元通りに なった ことは
	// 言わない（見れば わかる）。
	// ドリンクバーで 1杯 飲んだ あと。ドリンクバーに 店長。キリコは 払って おかわりする（一緒に 狂う）
	{
		key: "buy_famires",
		on: { k: "buy", map: "f_famires", thing: "drinkbar" },
		stage: { cast: { 店員: "famires_clerk" } },
		lines: [
			clerk("ドリンクバーは、\nおかわり自由です"),
			k("つぎは、ぜんぶ混ぜるンゴ"),
			{ ...manager("（グラスの中から）\nごぼごぼ……"), se: "bubble" },
			{
				...e({ emote: "驚", hit: "slap" }, k("店長が入ってるンゴ！？")),
				cutin: true,
			},
			e({ pause: 400 }, clerk("店長は、追加料金です")),
			e({ auto: 1100, emote: "花" }, k("……払うンゴ。\nおかわりンゴ")),
		],
	},
	// 爆発で キリコは 店の 奥まで 吹っとび、服も 飛ぶ。店主は 服も 直して 売る
	{
		key: "enter_recycle",
		on: { k: "enter", map: "f_recycle" },
		chance: 0.5,
		stage: { at: [9, 8], face: "up", cast: { 店主: "recycle_clerk" } },
		lines: [
			owner("うちは何でも\n直して売るよ"),
			owner("直したやつは、\nだいたい爆発するけどな"),
			e({ gesture: "shake" }, k("売っちゃだめンゴ！")),
			{
				...e({ auto: 800 }, owner("……ほら、いま1台")),
				fx: "boom",
				// 爆発するのは 店の まんなかの ブラウン管
				fxAt: [7, 4],
				fling: "far",
			},
			{
				...e({ emote: "青", hit: "sting" }, k("服が、飛んだンゴ……")),
				// 煙が 晴れてから 自主規制
				calm: true,
				fx: "mosaic",
			},
			e({ pause: 400 }, owner("（アフロで）よし。\nその服も、直して売るよ")),
		],
	},
	// 見本の 一撃は スローで、割れたのは 拳。次は 頭で いって 頭が 割れても、真顔で 稽古を 続ける
	{
		key: "enter_dojo",
		on: { k: "enter", map: "f_dojo" },
		chance: 0.5,
		stage: { at: [5, 6], face: "up", cast: { 師範: "dojo_master" } },
		lines: [
			sensei("気合いだ！\n気合いで瓦を割れ！"),
			{ ...sensei("見本を見せる！\nちぇすとーーっ！！"), fx: "slowmo" },
			{
				...e({ emote: "冷", pause: 400 }, sensei("……拳が、割れた")),
				fx: "chiin",
			},
			{ ...e({ auto: 700 }, sensei("頭でいく！")), se: "hit_fist", calm: true },
			{
				...e({ auto: 1300 }, n("ゴッ。")),
				fx: "ko",
				caption: "師範は　たおれた",
			},
			{
				...e(
					{ emote: "得", pause: 500 },
					sensei("（むくり）……よし。\n次は1枚からな"),
				),
				calm: true,
			},
		],
	},
	// 演目は 予告編で 大きく。台本は「暗転」の 1行だけ。キリコも 出演する
	{
		key: "enter_theater",
		on: { k: "enter", map: "f_theater" },
		// 客席の 前から 舞台を 見る
		stage: { at: [6, 6], face: "up", cast: { 役者: "theater_actor" } },
		lines: [
			{
				...actor("本日の演目は、\n『やきう物語』！"),
				fx: "trailer",
				caption: "やきう物語",
			},
			{ ...actor("……なんやけど、\n台本が1行しかない"), calm: true },
			{ ...actor("『暗転』"), fx: "blackout" },
			{ ...actor("本日は、2回公演です"), calm: true },
			{ ...e({ pause: 400, auto: 900 }, actor("『暗転』")), fx: "blackout" },
			{ ...e({ auto: 1100 }, k("『暗転』ンゴ")), calm: true, fx: "blackout" },
		],
	},
	// ───── 村の 物を はじめて 調べた ─────
	// 秘密結社の 本部（分譲住宅の 青い 家。表札を 出して いる）。テロは スレの 埋め立てで、最後は 自分の 家で 爆発。
	// 2回目は 爆発の 天丼を ずらす（よその 家＝構成員の 実家を、首領は 真顔で 選んで いた）。見た 帰りの 次から
	{
		key: "look_kessha",
		on: { k: "look", thing: "fthing_house_b" },
		extras: KESSHA,
		stage: { cast: { 首領: "x_boss", 構成員: "x_member" } },
		lines: [
			boss("作戦を発表する。\n今夜、おんJの全スレを1000にする"),
			member("それ、毎晩だれかが\nやっとることですやん"),
			boss("……作戦変更や。\nまず、この家を爆破する"),
			{
				...e({ emote: "驚", hit: "whack" }, k("自分の家ンゴ！？")),
				cutin: true,
			},
			// 爆発は 家の 上で、爆風で キリコは 下の 路地まで 吹っとぶ
			{ who: null, text: "", fx: "boom", fxAt: [60, 5], fling: [56, 16] },
			e({ auto: 500 }, member("ゲホッ")),
			e({ auto: 500 }, member("ゲホゲホッ")),
			e({ auto: 700 }, member("首領、髪が……")),
			{ ...e({ pause: 500 }, boss("……作戦は、成功や")), calm: true },
		],
	},
	{
		key: "look_kessha2",
		on: { k: "look", thing: "fthing_house_b" },
		extras: KESSHA,
		stage: { cast: { 首領: "x_boss", 構成員: "x_member" } },
		lines: [
			boss("作戦その2を発表する"),
			member("どうせまた、\nこの家を爆破するんでしょ"),
			boss("せえへん。\n今回は、となりの家や"),
			member("……となり、\nうちの実家ですけど"),
			{
				...e({ emote: "冷", pause: 600 }, boss("せやから、選んだんや")),
				fx: "chiin",
			},
			e({ auto: 1200 }, member("……おかんに、\n電話してきます")),
		],
	},
	// ROM専の 神さまは 上に いた（1人では ない）。天井から 降って きて、キリコは つぶれる
	{
		key: "look_shrine",
		on: { k: "look", thing: "shrine" },
		extras: [
			{ id: "x_r1", sprite: NANASHI_A, at: "near", come: "drop", later: true },
			{ id: "x_r2", sprite: NANASHI_B, at: "near", come: "drop", later: true },
			{
				id: "x_r3",
				sprite: NANASHI_WALK[2],
				at: "kiriko",
				come: "drop",
				later: true,
			},
		],
		lines: [
			e({ gesture: "startle" }, k("見られてる気がするンゴ！\n……そこンゴ！")),
			n("だれもいない。"),
			k("……上ンゴ！"),
			nanashi("（上から）……バレたか"),
			e({ auto: 400 }, nanashi("（上から）ワイも")),
			e({ auto: 400 }, nanashi("（上から）ワイも")),
			{
				...e({ auto: 1300, hit: "zukko" }, n("名無しが、ぜんぶ降ってきた。")),
				show: ["x_r1", "x_r2", "x_r3"],
				fx: "ko",
				caption: "キリコは　つぶれた",
			},
			{
				...e({ auto: 1100 }, nanashi("（キリコの上で）\n……ROMっとるだけや")),
				calm: true,
			},
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
	// 道ばたの 自販機で 買った あと（おつりが 下へ 転がる）。自販機の 下には 名無しが 住んで いる。
	// キリコは 家賃を 払って しまう（一緒に 狂う）
	{
		key: "buy_vend",
		on: { k: "buy", map: "village", thing: "fthing_vend" },
		chance: 0.5,
		lines: [
			k("おつりが、自販機の下に\n転がったンゴ"),
			k("……手、とどかないンゴ"),
			e({ pause: 400 }, nanashi("（下から）とったらあかん。\nワイの家や")),
			e({ emote: "驚", hit: "slap" }, k("住んでるンゴ！？")),
			nanashi("（下から）家賃、10円や"),
			{ ...e({ auto: 800 }, k("……はい、10円ンゴ")), se: "arcCoin" },
			e({ auto: 1200 }, nanashi("（下から）まいど。\n……ほな、あんたも住み")),
		],
	},
	// ───── ある 場所に はじめて 来た ─────
	// 広場の 南東の 噴水（パン板の あとから 水が 出る）。下から 打たれて、キリコは 打ち上がる
	{
		key: "near_fountain",
		chance: 0.5,
		window: { after: "shallow" },
		on: { k: "near", map: "village", x: [23, 30], y: [29, 30], face: [25, 25] },
		lines: [
			k("噴水ンゴ"),
			k("打たれたら、吾輩も\n強くなれるンゴ？"),
			n("……噴水は、\n下から打ってくる。"),
			{
				...e({ auto: 700 }, n("噴水が、キリコを\n打ち上げた。")),
				se: "bubble",
				fling: "far",
			},
			{
				...e(
					{ gesture: "startle", hit: "slap" },
					k("おしりしか\n鍛えられないンゴ！"),
				),
				cutin: true,
			},
		],
	},
	// 広場の 南の 池の ほとり：池の 精の 話の 裏返し。本当に 沈めて、浮いて こないので 正直者に される
	{
		key: "near_pond",
		chance: 0.5,
		on: { k: "near", map: "village", x: [10, 17], y: [30, 31], face: [13, 27] },
		// 池の 精（池に つかった おっさん）
		extras: [
			{
				id: "x_spirit",
				sprite: "sa:lPbiIr",
				at: [13, 28],
				face: "down",
				later: true,
			},
		],
		stage: { cast: { 池の精: "x_spirit" } },
		lines: [
			k("池ンゴ！"),
			{
				...spirit("おぬしが落としたのは、\n金の蓄音機か？銀か？"),
				show: "x_spirit",
				se: "bubble",
			},
			k("なにも落としてないンゴ"),
			e({ pause: 400 }, spirit("では、おぬしを沈めて、\n正直かどうか確かめる")),
			{ ...e({ emote: "青", hit: "sting" }, k("魔女裁判ンゴ！")), cutin: true },
			{
				...e({ auto: 1300 }, spirit("沈めます")),
				se: "bubble",
				put: [13, 29],
				hide: "player",
				fx: "ko",
				caption: "キリコは　沈んだ",
			},
			{
				...e({ auto: 1100 }, spirit("……浮いてこない。\n正直者じゃ")),
				calm: true,
			},
		],
	},
	// 浜の 東の はし（桟橋からは 遠い）。沖に 遠泳中の 名無し。キリコも 泳ぎだす（一緒に 狂う）
	{
		key: "near_beach",
		chance: 0.5,
		on: { k: "near", map: "village", x: [40, 62], y: [33, 36], face: [50, 38] },
		extras: [{ id: "x_swim", sprite: "sa:bOmZ55", at: [50, 39], face: "up" }],
		stage: { cast: { 名無し: "x_swim" } },
		lines: [
			e({ gesture: "hop" }, k("全部の板を\n回るンゴーー！！")),
			nanashi("（沖から）うるさい！\nこっちは遠泳中や！"),
			e({ emote: "驚" }, k("沖に人いたンゴ！？")),
			e({ pause: 400 }, nanashi("（沖から）ハワイまで、\nあと6000キロや")),
			{
				...e({ auto: 900 }, k("……吾輩も、\n泳ぐンゴ")),
				se: "bubble",
				put: [49, 38],
			},
			e({ auto: 1200 }, nanashi("（沖から）……ついてくんな")),
		],
	},
	// ───── ある 死に方で 帰ってきた ─────
	// 地雷 → あさコンロ：張りあって、自分で 踏む
	{
		key: "death_mine",
		on: { k: "death", mob: "asakonro", cause: "地雷" },
		lines: [
			m("地雷ふんだって聞いたもん！\nよく焼けた？"),
			k("焼けたンゴ。\nこんがりンゴ"),
			e({ emote: "汗" }, m("……うちより\n焼けてるもん……")),
			e({ emote: "得" }, m("うちも踏んでくるもん！\n負けないもん！")),
			{
				...e({ auto: 900 }, n("どかーん。")),
				se: "explosion",
				fx: "heat",
				fxAt: "mob",
			},
			e({ auto: 1200, emote: "花" }, m("……こんがり、だもん")),
		],
	},
	// 落とし穴 → ひなりー：真顔で 発表を 続け、再現まで する
	{
		key: "death_pit",
		on: { k: "death", mob: "hinary", cause: "落とし穴" },
		lines: [
			m("落とし穴の調査結果を\n発表します"),
			m("穴は、下に向かって\nあいている模様です"),
			m("落ちた人は、下に向かって\n落ちた模様です"),
			{
				...e(
					{ emote: "驚", hit: "whack" },
					k("知ってるンゴ！\n落ちたの吾輩ンゴ！"),
				),
				cutin: true,
			},
			{
				...e({ auto: 900 }, m("では、再現します")),
				se: "fall",
				hide: "player",
			},
			e({ auto: 1200 }, m("再現は、成功した模様です")),
		],
	},
	// 自演くん → おんす：中身も わたくし。自演の 声が 増えて いく
	{
		key: "death_jien",
		on: { k: "death", mob: "onsu", cause: "自演くん" },
		lines: [
			m("自演くんに\nやられたのぉ？"),
			m("あの子、わたくしの板にも\n毎日来るのよぉ！"),
			e({ gesture: "shake" }, k("それ、ほぼ\n自演くんの板ンゴ！")),
			e(
				{ emote: "得", pause: 400 },
				m("ちなみに自演くんの中身も、\nわたくしよぉ"),
			),
			e({ auto: 500 }, m("（自演くんの声で）\nせやせや")),
			e({ auto: 500 }, m("（もう1人の自演くんの声で）\nせやせや")),
			e({ auto: 1100 }, m("……多数決で、\nわたくしの勝ちよぉ")),
		],
	},
	// ピッチャー → ややポジ：ピッチャーの 味方だった うえに、自分も 投げて くる
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
			{
				...e({ emote: "青", hit: "sting" }, k("味方が\nいなかったンゴ！")),
				cutin: true,
			},
			{
				...e(
					{ auto: 1000, hit: "punch" },
					m("いまから、ぼくも\nピッチャーなんだ"),
				),
				fling: "far",
			},
		],
	},
	// コピペは キリコに うつる。記録係の プロトにも
	{
		key: "death_copipe",
		on: { k: "death", mob: "proto", cause: "コピペ" },
		lines: [
			m("コピペにたおされたと\n記録したゼロ"),
			m("コピペにたおされたと\n記録したゼロ"),
			m("コピペにたおされたと\n記録したゼロ"),
			e({ emote: "驚", hit: "slap" }, k("3回言ったンゴ！")),
			e({ emote: "青", pause: 400 }, k("3回言ったンゴ！")),
			e({ auto: 500 }, k("3回言ったンゴ！")),
			e({ auto: 1100 }, m("……感染を、記録したゼロ\n感染を、記録したゼロ")),
		],
	},
	// 置物 → ショボン：本気で 動いたら、たおれる
	{
		key: "death_okimono",
		on: { k: "death", mob: "shobon", cause: "置物" },
		lines: [
			m("置物にやられたの？\nあれ、動かないでしょ"),
			k("動かないのに\nやられたンゴ！"),
			m("(´・ω・｀)おれも、\n置物ってよく言われるよ"),
			e({ gesture: "hop" }, m("ちょっと本気で\n動いてみようかな")),
			{
				...e({ auto: 1300 }, n("ショボンは、1歩でたおれた。")),
				fx: "ko",
				caption: "ショボンは　たおれた",
			},
			{
				...e({ auto: 1100 }, m("(´・ω・｀)（むくり）\n……置物にもどるよ")),
				calm: true,
			},
		],
	},
	// 粘着アンチ（ンゴ姉は フェリスへの 粘着を 愛と 呼ぶ。フェリスの 名前は 出さない）。通報されても 愛
	{
		key: "death_nenchaku",
		on: { k: "death", mob: "ngoane", cause: "粘着アンチ" },
		extras: [
			{
				id: "x_police",
				sprite: "sa:3TLWSw",
				at: "near",
				come: "walk",
				later: true,
			},
		],
		stage: { cast: { おまわりさん: "x_police" } },
		lines: [
			m("粘着アンチに\nやられたンゴねぇ……"),
			m("粘着は、愛がないと\nだめンゴねぇ"),
			k("……実感こもってるンゴ"),
			e(
				{ emote: "♥", pause: 400 },
				m("愛があれば、通報されても\n平気ンゴねぇ"),
			),
			{
				...e({ auto: 900 }, police("ちょっと、\n署まで来てもらおか")),
				show: "x_police",
			},
			e({ auto: 1200, emote: "♥" }, m("……署まで、\n愛ンゴねぇ")),
		],
	},
];
