// おんJグランプリ（ゲームセンター「連コ」の テレビ。PROGRAMS §1.6「LAP1〜3 と 数える・雨・セーフティカーで 荒れる」）。
// 架空の 自動車レースの 決勝の 中継。スレは LAP で 数える（スレタイ「【実況】おんJグランプリ　LAP{n}」、ヘッダーも LAP{n}）。
// 流れ：グリッド → スタート（赤い 灯が 5つ ついて 消える。4つめ・5つめ・消える 前が 合図、消える 拍で「スタート！」＝Cue）
// → 序盤（静か）→ 雨が 降りだす → ピット（レーダーの 雨の 強さを 読んで タイヤ交換の 判断を 当てる。乱数で 小雨／大雨）
// → セーフティカー（コースに 落ちた 部品を 拾う あいだ だけ）→ リスタート → 審議（おとがめ なし）
// → 最終ラップの 抜きつ抜かれつ（乱数で 逆転／守りきる。どちらに なったかを 読む 窓）→ チェッカー → 表彰台 → 反省会。
// - チーム・車は 架空（板の 語：チーム次スレ・ageモータース・sageレーシング・名無しワークス・過去ログ。番号と 単色の 車）。
//   実在の チーム・メーカー・ドライバー・サーキット・局の 名前は 出さない（deny）。事故・けがの 話は しない
//   （セーフティカーは 落ちた 部品で 出る だけ）。賭けの 話も しない。
// - キリコが 書ける 文（候補・当番・山場の 1語）に「保守」「立てといた」「立てたる」「立てたで」を 入れない。
//   群衆・題・字幕の「保守」は 固有名詞（おんJグランプリ）の 中だけ。
// - 日：日曜は 決勝（LAP3）、ほかの 日は 再放送（LAP2。群衆に「再放送　乙」が まざる）。中身は 曜日で 閉じない。
// - 勢いは 低め（目標の LAP が 少ない。静かな 序盤は 群衆を 少なく、スタート・最終周・チェッカーで わく）。
// 束の 形は data/jikkyo/pack.ts、試験は src/sim/jikkyoProgTests.ts、TV は ui/jikkyo/jikkyoF1Tv.ts（絵に 出す 文は F1_ART）。

import type {
	JkFit,
	JkOpt,
	JkScript,
	JkScriptSeg,
	JkSlot,
} from "../../core/jikkyo";
import { type JkPack, liveOr, onWeekdays } from "./pack";

const o = (text: string, fit: JkFit): JkOpt => ({ text, fit });
const B = (t: string) => o(t, "best");
const K = (t: string) => o(t, "ok");
const X = (t: string) => o(t, "miss");

/** 場面の 鍵（TV が 描く）。 */
export const F1_SCENES = [
	"card",
	"grid",
	"start",
	"race",
	"pit",
	"sc",
	"checker",
	"podium",
] as const;

/** 車（番号・チーム・単色の 車体と 影の 色）。前から グリッドの 順。 */
export const F1_CARS = [
	{ no: 1, team: "チーム次スレ", body: "#2fa860", dark: "#1b6a3a" },
	{ no: 7, team: "ageモータース", body: "#e0482c", dark: "#8a2818" },
	{ no: 5, team: "sageレーシング", body: "#3a5ab8", dark: "#202f68" },
	{ no: 3, team: "名無しワークス", body: "#e8c838", dark: "#86701c" },
	{ no: 10, team: "過去ログ", body: "#a0a0aa", dark: "#58585f" },
] as const;

export const f1Car = (no: number) =>
	F1_CARS.find((c) => c.no === no) ?? F1_CARS[0];

/** 場面の 小さな 中身（TV が 読む）。 */
export type F1Data = {
	/** card：まもなく・おわり／start：前・合図・発進。 */
	readonly phase?: "soon" | "end" | "pre" | "cue" | "go";
	/** card の 大きな 文。 */
	readonly card?: string;
	/** start：灯が 消える ちょうどの 名目の ms。 */
	readonly exact?: number;
	/** race・pit・sc：周回（LAP n／30）。 */
	readonly lap?: number;
	/** 雨（0 晴れ・1 小雨・2 大雨）。 */
	readonly rain?: 0 | 1 | 2;
	/** race・sc：順位（前から 車の 番号）。 */
	readonly order?: readonly number[];
	/**
	 * race の 見せ場（スタート直後に 2位が 抜く・団子から ばらける・審議・最終周の 逆転／守りきる）。
	 * start・pass・hold は order の 前の 2台の 抜きあい。
	 */
	readonly event?: "start" | "restart" | "shingi" | "pass" | "hold";
	/** checker・podium：勝った 車の 番号。 */
	readonly win?: number;
	/** pit・shingi：判断・裁定が 出る 時（区切りの 頭からの 名目の ms）。 */
	readonly decideAt?: number;
};

/** 絵に 出す 文（どれも 全角 22字まで）。 */
export const F1_ART = {
	logo: "おんJグランプリ",
	sub: "決勝",
	rerun: "再放送",
	soon: "まもなくスタート",
	end: "本日の中継はおわりました",
	laps: 30,
	lap: "LAP",
	sc: "SC",
	light: "小雨",
	heavy: "大雨",
	radar: "雨雲",
	box: "BOX",
	stay: "STAY",
	shingi: "審議中",
	clear: "おとがめなし",
	final: "ファイナルラップ",
	win: "優勝",
	/** コースの 看板（村の 店だけ）。 */
	ads: ["おんJマート", "ageジム", "海の家「age」"],
} as const;

/** 群衆の 文（手で 書いた 白い 一覧。レスは 全角 12字まで）。 */
export const F1_POOLS = {
	wait: [
		"31",
		"サンイチ",
		"たておつ",
		"待機",
		"はよ",
		"日曜はこれや",
		"夜ふかし確定",
		"グリッドまだ？",
	],
	grid: [
		"ポールおめ",
		"緊張する",
		"晴れとるな",
		"次スレポールか",
		"age　2番手",
		"sage　3番手",
		"タイヤどれや",
		"グリッドきれい",
	],
	lights: [
		"くるぞ…",
		"息止めろ",
		"赤ランプ",
		"ドキドキ",
		"はよ消えろ",
		"指かまえた",
	],
	flood: ["スタート！", "スタート", "いったあ", "はやすぎ", "おそかった"],
	go: [
		"1コーナー",
		"ごちゃごちゃ",
		"age　速い",
		"いいスタート",
		"次スレ出遅れ",
		"鯖が重い",
		"生きてる？",
	],
	lap1: [
		"抜いた！",
		"age　トップ",
		"次スレ2番手",
		"いいスタート",
		"ええぞ",
		"1周目おわり",
	],
	joban: [
		"静かやな",
		"眠い",
		"ぐるぐる",
		"単調や",
		"トレインや",
		"抜けへん",
		"まだ20周",
		"寝るわ",
	],
	ame: [
		"雨や！",
		"降ってきた",
		"荒れるで",
		"雨来た",
		"ステイか",
		"タイヤもたん",
		"雨雲でかい",
	],
	pit: [
		"ステイか",
		"インター履け",
		"ピット入れ",
		"タイヤもたん",
		"どうする",
		"判断むずい",
		"BOX　BOX",
	],
	sc: [
		"SC　来た",
		"部品落ちとる",
		"マーシャル乙",
		"拾え",
		"詰まるな",
		"SCや",
		"また団子や",
	],
	restart: [
		"リスタート",
		"いけ！",
		"並べ",
		"うまい",
		"攻めろ",
		"抜いた！",
		"ここから",
	],
	shingi: [
		"ペナルティ出る？",
		"審議か",
		"コース外や",
		"セーフやろ",
		"5秒やろ",
		"どうなる",
	],
	final: [
		"ファイナルラップ",
		"並んだ！",
		"いけ！",
		"うおおお",
		"守れ",
		"あと1周",
		"抜け！",
	],
	checker: [
		"チェッカー！",
		"優勝や！",
		"8888",
		"おめでとう",
		"ええレース",
		"泣ける",
	],
	podium: [
		"おめでとう",
		"8888",
		"表彰台や",
		"ええレース",
		"トロフィーでかい",
		"雨やんだな",
	],
	hansei: [
		"乙",
		"反省会や",
		"ほな",
		"おやすみ",
		"寝る",
		"来週も見るで",
		"月曜つらい",
	],
	rerun: [
		"再放送乙",
		"結果知っとる",
		"ネタバレすな",
		"何回見てもええ",
		"録画勢",
	],
	gap: ["次スレどこ？", "乱立すな", "950ちうい", "誰か踏め"],
	open: ["31", "サンイチ", "たておつ", "スレ立て乙"],
	boo: ["は？", "なんて？", "見とらんやろ"],
	booStart: ["はじまったばっかや", "まだ早い"],
	booLate: ["もう走っとる", "は？"],
	"reply:best": [">>{n}　わかる", ">>{n}　それな", ">>{n}　ほんまそれ"],
	"reply:ok": [">>{n}　せやな", ">>{n}　まあな"],
	"reply:miss": [">>{n}　は？", ">>{n}　なんて？", ">>{n}　どこ見とるんや"],
	/** 1000 の 流れの 予備（群衆の 区切りが ない とき）。 */
	nanashi: ["くるぞ…", "はよ"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** スレの 決まり文句。 */
export const F1_THREAD = {
	live: "【実況】おんJグランプリLAP{n}",
	rerun: "【再放送】おんJグランプリLAP{n}",
	liveHansei: "【反省会】おんJグランプリLAP{n}",
	rerunHansei: "【再放送・反省会】おんJグランプリLAP{n}",
	get1000: "1000なら次スレ優勝",
	praise: ">>{n}　反応はやすぎ",
	crossGap: "次スレでスタート",
	crossFresh: "新スレでスタートできた",
	sc: "【速報】SC　導入",
	shingi: "【速報】#5　審議",
	clear: "【速報】#5　おとがめなし",
	quit: "もう一度Bで出る",
} as const;

const fillN = (s: string, n: number) => s.replace("{n}", String(n));

/** スタートの 1語（赤い 灯が 消える 拍に あわせて 書く）。 */
export const F1_WORD = "スタート！";

/** スタートの 合図（4つめ・5つめの 灯と 消える 前の 拍）・拍・ちょうど（名目の ms）。1つめ・2つめの 灯は その 前の 拍。 */
export const F1_CUE = { at: 22000, beat: 1000, pulses: 3 } as const;
export const F1_EXACT = F1_CUE.at + F1_CUE.pulses * F1_CUE.beat;

/** グリッドから 序盤までの 順位（スタートで ageが 次スレを 抜く）。 */
const ORDER = [7, 1, 5, 3, 10] as const;

/** 台本（146秒。pick 13 ＋ Cue）。 */
const f1Timeline: JkScript["timeline"] = (rand, slot) => {
	const live = slot.live;
	const hansei = (n: number) =>
		fillN(live ? F1_THREAD.liveHansei : F1_THREAD.rerunHansei, n);
	// 雨の 強さ（ピットの 判断）と 最終周（逆転するか）は 乱数。TV が 読める ように 描く
	const heavy = rand() < 0.5;
	const pass = rand() < 0.5;
	const rain: 1 | 2 = heavy ? 2 : 1;
	const win = pass ? 1 : 7;
	const winCar = f1Car(win);
	const segments: JkScriptSeg[] = [
		{
			at: 0,
			scene: "card",
			pool: "wait",
			rate: 0.5,
			bgm: null,
			caption: F1_ART.soon,
			data: { phase: "soon", card: F1_ART.soon } satisfies F1Data,
		},
		{
			at: 6000,
			scene: "grid",
			pool: "grid",
			rate: 0.9,
			bgm: "title",
			caption: "ポールは#1　チーム次スレ",
		},
		{
			at: 16000,
			scene: "start",
			pool: "lights",
			rate: 1.3,
			bgm: "tense",
			caption: "シグナルに注目",
			data: { phase: "pre", exact: F1_EXACT } satisfies F1Data,
		},
		{
			at: 21000,
			scene: "start",
			pool: "lights",
			rate: 3.5,
			bgm: null,
			data: { phase: "cue", exact: F1_EXACT } satisfies F1Data,
		},
		{
			at: 26500,
			scene: "start",
			pool: "go",
			rate: 1.4,
			bgm: "battle",
			stall: 1200,
			data: { phase: "go", exact: F1_EXACT } satisfies F1Data,
		},
		{
			at: 31000,
			scene: "race",
			pool: "lap1",
			rate: 1.2,
			caption: "ageモータースがトップに",
			data: { lap: 1, rain: 0, order: ORDER } satisfies F1Data,
		},
		{
			at: 42000,
			scene: "race",
			pool: "joban",
			rate: 0.6,
			bgm: "field",
			caption: "レースはしずかに進む",
			data: { lap: 9, rain: 0, order: ORDER } satisfies F1Data,
		},
		{
			at: 54000,
			scene: "race",
			pool: "ame",
			rate: 1.2,
			bgm: "kumori",
			caption: "雨が降りだした",
			data: { lap: 17, rain: 1, order: ORDER } satisfies F1Data,
		},
		{
			at: 64000,
			scene: "pit",
			pool: "pit",
			rate: 1.3,
			bgm: "tense",
			caption: "タイヤをかえるか",
			data: { lap: 20, rain, order: ORDER, decideAt: 8000 } satisfies F1Data,
		},
		{
			at: 75000,
			scene: "sc",
			pool: "sc",
			rate: 1.2,
			bgm: "deep_kisei",
			caption: "コースに部品SC　導入",
			pin: F1_THREAD.sc,
			data: { lap: 22, rain, order: ORDER } satisfies F1Data,
		},
		{
			at: 86000,
			scene: "race",
			pool: "restart",
			rate: 1.4,
			bgm: "battle",
			caption: "SCが入ってリスタート",
			data: {
				lap: 25,
				rain,
				order: ORDER,
				event: "restart",
			} satisfies F1Data,
		},
		{
			at: 96000,
			scene: "race",
			pool: "shingi",
			rate: 1,
			bgm: "tense",
			caption: "#5の抜き方が審議に",
			pin: F1_THREAD.shingi,
			posts: [{ at: 8500, who: "nanashi", text: F1_THREAD.clear, pin: 2500 }],
			data: {
				lap: 27,
				rain,
				order: ORDER,
				event: "shingi",
				decideAt: 8500,
			} satisfies F1Data,
		},
		{
			at: 106000,
			scene: "race",
			pool: "final",
			rate: 1.8,
			bgm: "boss",
			caption: F1_ART.final,
			data: {
				lap: 30,
				rain,
				order: ORDER,
				event: pass ? "pass" : "hold",
			} satisfies F1Data,
		},
		{
			at: 117000,
			scene: "checker",
			pool: "checker",
			rate: 2.2,
			bgm: "title",
			caption: `#${win}　${winCar.team}　${F1_ART.win}`,
			data: { win } satisfies F1Data,
		},
		{
			at: 129500,
			scene: "podium",
			pool: "podium",
			rate: 0.8,
			bgm: "ending",
			caption: "表彰式",
			data: { win } satisfies F1Data,
		},
		{
			at: 137500,
			scene: "card",
			pool: "hansei",
			rate: 0.5,
			caption: F1_ART.end,
			title: { now: hansei },
			data: { phase: "end", card: F1_ART.end } satisfies F1Data,
		},
	];
	return {
		segments,
		picks: [
			{
				at: 2000,
				boo: "booStart",
				sets: [
					[B("31"), K("はよ"), X("チェッカー！")],
					[B("待機"), K("くるぞ…"), X("乙")],
					[B("夜ふかし確定"), K("はよ"), X("おやすみ")],
				],
			},
			{
				at: 10000,
				boo: "boo",
				sets: [
					[B("ポールおめ"), K("緊張する"), X("優勝や！")],
					[B("グリッドきれい"), K("晴れとるな"), X("SC　来た")],
					[B("次スレポール"), K("緊張する"), X("8888")],
				],
			},
			{
				at: 33000,
				boo: "booLate",
				sets: [
					[B("抜いた！"), K("いいスタート"), X(F1_WORD)],
					[B("age　速い"), K("ええぞ"), X("静かやな")],
					[B("抜いた！"), K("age　速い"), X("待機")],
				],
			},
			{
				at: 45000,
				boo: "boo",
				sets: [
					[B("静かやな"), K("眠い"), X("抜いた！")],
					[B("トレインや"), K("抜けへん"), X("SC　来た")],
					[B("眠い"), K("単調や"), X("優勝や！")],
				],
			},
			{
				at: 57000,
				boo: "boo",
				sets: [
					[B("雨や！"), K("降ってきた"), X("眠い")],
					[B("荒れるで"), K("雨来た"), X("静かやな")],
					[B("降ってきた"), K("荒れるで"), X("ポールおめ")],
				],
			},
			// ピット：レーダーの 雨の 強さを 読む（小雨は ステイ、大雨は インターへ 交換）
			{
				at: 67000,
				boo: "boo",
				sets: heavy
					? [
							[B("インター履け"), K("タイヤもたん"), X("ステイや")],
							[B("ピット入れ"), K("タイヤもたん"), X("ステイや")],
						]
					: [
							[B("ステイや"), K("まだいける"), X("インター履け")],
							[B("ステイや"), K("様子見や"), X("ピット入れ")],
						],
			},
			{
				at: 78000,
				boo: "boo",
				sets: [
					[B("SC　来た"), K("部品落ちとる"), X("抜いた！")],
					[B("部品落ちとる"), K("SC　来た"), X("いけ！")],
					[B("マーシャル乙"), K("SC　来た"), X(F1_WORD)],
				],
			},
			{
				at: 91000,
				boo: "boo",
				sets: [
					[B("いけ！"), K("並べ"), X("SC　来た")],
					[B("リスタート"), K("攻めろ"), X("静かやな")],
					[B("いけ！"), K("うまい"), X("眠い")],
				],
			},
			{
				at: 99000,
				boo: "boo",
				sets: [
					[B("ペナルティ出る？"), K("審議か"), X("優勝や！")],
					[B("審議か"), K("コース外や"), X("雨や！")],
					[B("ペナルティ出る？"), K("セーフやろ"), X("ステイや")],
				],
			},
			// 最終周：次スレが ageを 抜くか、ageが 守りきるか（乱数。TV で 読む）
			{
				at: 110000,
				boo: "boo",
				sets: pass
					? [
							[B("抜いた！"), K("並んだ！"), X("守りきった")],
							[B("逆転や！"), K("いけ！"), X("守りきった")],
						]
					: [
							[B("守りきった"), K("おしい"), X("抜いた！")],
							[B("守りきった"), K("並んだ！"), X("逆転や！")],
						],
			},
			// チェッカー（線を 越えて 旗が ふられる あいだ。越える ころに 950 の 当番が 出せる ように 少し あと）
			{
				at: 125000,
				boo: "boo",
				sets: [
					[B("チェッカー！"), K("おつかれ"), X("インター履け")],
					[B("優勝や！"), K("8888"), X("SC　来た")],
					[B("チェッカー！"), K("優勝や！"), X("リスタート")],
				],
			},
			{
				at: 132000,
				boo: "booLate",
				sets: [
					[B("おめでとう"), K("8888"), X("SC　来た")],
					[B("8888"), K("表彰台や"), X("雨や！")],
					[B("ええレース"), K("おめでとう"), X("待機")],
				],
			},
			{
				at: 140000,
				boo: "booLate",
				sets: [
					[B("乙"), K("反省会や"), X("31")],
					[B("おやすみ"), K("月曜つらい"), X(F1_WORD)],
					[B("ほな"), K("来週も見るで"), X("ポールおめ")],
				],
			},
		],
		cues: [
			{
				...F1_CUE,
				word: F1_WORD,
				flood: "flood",
				praise: F1_THREAD.praise,
				cross: { gap: F1_THREAD.crossGap, fresh: F1_THREAD.crossFresh },
			},
		],
	};
};

/** おんJグランプリ（決勝の 中継）。 */
export const F1: JkScript = {
	id: "f1",
	venue: "arcade",
	length: 146000,
	goal: { live: 3, rerun: 2 },
	pools: F1_POOLS,
	title: (n, slot) => fillN(slot.live ? F1_THREAD.live : F1_THREAD.rerun, n),
	label: (n) => `LAP${n}`,
	at1000: () => F1_THREAD.get1000,
	open: "open",
	gapPool: "gap",
	duty: {
		pin: "950ちうい",
		first: [B("立ててくる"), K("誰か踏め"), X("ksk")],
		variants: [
			{
				pin: "スレ立て規制中です",
				opts: [B("誰か頼む"), K("誰か踏め"), X("立ててくる")],
			},
			{
				pin: "LAP{m}できたで",
				opts: [B("たておつ"), K("乙"), X("立ててくる")],
			},
			{
				pin: "LAP{m}が2つあるぞ",
				opts: [B("誘導しとく"), K("どっちや"), X("両方に書く")],
			},
		],
	},
	replies: {
		best: { pool: "reply:best", n: [1, 2] },
		ok: { pool: "reply:ok", n: [1, 1] },
		miss: { pool: "reply:miss", n: [1, 1] },
	},
	echoN: [1, 2],
	extra: [{ pool: "rerun", p: 0.15, when: (slot: JkSlot) => !slot.live }],
	quitNote: F1_THREAD.quit,
	// 帯（P4 の 種）：空飛ぶ鯖と 同じ 形で、コンボを 少し 強く した。決勝は LAP3 なので スレの 切れ目と 当番が 1つ 多く、
	// 上手と 初心者の 差が 開きやすい（初心者の 下の はばを 0.22 に 広げた）。
	// 決勝 上手 75%・初心者 25%、再放送 75%・31%（見るだけ 0.57G・神 1.42G・random 3% まで）。
	tune: { post: 0.1, boost: 3.25, comboMin: 20 },
	bands: {
		p50: { miru: [0.52, 0.6], kami: [1.08, 99] },
		kanso: { jouzu: [0.65, 0.8], shoshin: [0.22, 0.45], random: [0, 0.099] },
	},
	timeline: f1Timeline,
};

/** 日曜は 決勝、ほかの 日は 再放送。 */
const isRaceDay = onWeekdays(0);
/** 決勝の 前の 日（会場の 文だけ かえる）。 */
const isRaceEve = onWeekdays(6);
const anyDay = () => true;

/** おんJグランプリ（ゲームセンターの テレビ。会場の 文は 決勝の 日・前の 日・再放送の 日）。 */
export const F1_PACK: JkPack = {
	script: F1,
	venue: "arcade",
	from: 7,
	menu: "おんJグランプリ",
	slot: liveOr(isRaceDay),
	scenes: F1_SCENES,
	venueLines: {
		tv: [
			{
				when: isRaceDay,
				lines: [
					"ゲーセンのテレビ。レースゲームの音。\n今夜は『おんJグランプリ』の決勝。",
				],
			},
			{
				when: isRaceEve,
				lines: [
					"ゲーセンのテレビ。レースゲームの音。\n明日の夜は『おんJグランプリ』の決勝。",
				],
			},
			{
				when: anyDay,
				lines: [
					"ゲーセンのテレビ。レースゲームの音。\n『おんJグランプリ』の再放送。",
				],
			},
		],
	},
	staffLines: {
		arcade_a: [
			{
				when: isRaceDay,
				lines: [
					"今夜はおんJグランプリの決勝や。\n……湾岸の筐体も、今日は満席や",
				],
			},
			{
				when: isRaceEve,
				lines: ["明日はおんJグランプリの決勝や。\n今日は再放送を流しとる"],
			},
			{
				when: anyDay,
				lines: ["日曜の夜はおんJグランプリの決勝や。\n今日は再放送を流しとる"],
			},
		],
	},
	staffOnce: {
		arcade_a: {
			kami: "この前のスタート、\nシグナルとぴったりやったな",
			rerun: "この前はLAP{n}までのびたな。\n日曜の夜は、もっとのびるで",
		},
	},
	msgs: {
		howto: "見せ場に合うレスをえらぶと、\nスレがのびる。目標：LAP{n}　完走",
		seat: "キリコはレースゲームのいすにすわった。\n……エンジン音。実況スレをひらく。",
		over: "チェッカーがふられた。\n実況はLAP{n}までのびた。",
		kami: "あのひとことは、\nシグナルが消える一瞬だった。",
		left: "……レースのとちゅうで、\nそっといすを立った。",
	},
	art: [
		F1_ART.logo,
		F1_ART.sub,
		F1_ART.rerun,
		F1_ART.soon,
		F1_ART.end,
		F1_ART.lap,
		F1_ART.sc,
		F1_ART.light,
		F1_ART.heavy,
		F1_ART.radar,
		F1_ART.box,
		F1_ART.stay,
		F1_ART.shingi,
		F1_ART.clear,
		F1_ART.final,
		F1_ART.win,
		...F1_ART.ads,
		...F1_CARS.map((c) => `#${c.no}　${c.team}`),
	],
	deny: [
		"フェラーリ",
		"Ferrari",
		"レッドブル",
		"Red Bull",
		"メルセデス",
		"マクラーレン",
		"ウィリアムズ",
		"ホンダ",
		"HONDA",
		"トヨタ",
		"鈴鹿",
		"モナコ",
		"フェルスタッペン",
		"ハミルトン",
		"シューマッハ",
		"アロンソ",
		"角田",
		"FIA",
		"F1",
		"フォーミュラ",
		"フジテレビ",
		"DAZN",
	],
	names: ["おんJグランプリ"],
};
