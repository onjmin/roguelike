// ゲームセンターの 筐体の 遊びの 文（村の 窓は 22字×2行、板の 1行は 22字まで、選ぶ ボタンは 9字まで。
// src/sim/arcadeTests.ts が 測る）。キリコは しゃべらない。
// 置き字：{score} スコア、{best} ハイスコア、{unit} 単位、{n} 数。

import type { ArcadeGame } from "./types";

/** どの 台でも 同じ 文。 */
export const ARCADE = {
	menu: ["遊ぶ", "やめる"],
	record: "ハイスコア　{best}{unit}。",
	after: "スコア　{score}{unit}。",
	newBest: "ハイスコアを　こえた！\nランキングの　1位に「キリコ」。",
	quit: "……途中で　席を　立った。",
	// 板（1行）
	ready: "READY",
	over: "GAME OVER",
	clear: "CLEAR!",
	quit1: "もう　1回で　やめる",
} as const;

export type ArcadeText = {
	/** 部屋の 物の 文（調べた とき）。 */
	line: string;
	/** はじめて 遊ぶ ときの 決まり。 */
	rule: string;
	/** 板の 題。 */
	title: string;
	/** 板の 下の 押し方。 */
	hint: string;
	unit: string;
};

export const ARCADE_TEXT: Record<ArcadeGame, ArcadeText> = {
	shooter: {
		line: "シューティングの　台。\n画面に「荒らし撃退」の　文字。",
		rule: "降りてくる　荒らしを　撃つ。\n下まで　通すと　残機が　減る。",
		title: "荒らし撃退",
		hint: "←→／タップで　動く　A／タップで　撃つ",
		unit: "点",
	},
	drive: {
		line: "レースゲームの　台。\n画面に「保守ドライブ」の　文字。",
		rule: "コーンと　車を　よけて　走る。\n「保守」の　札は　拾うと　点。",
		title: "保守ドライブ",
		hint: "←→／左右を　タップで　車線を　かえる",
		unit: "点",
	},
	breakout: {
		line: "ブロックくずしの　台。\n画面に「スレ崩し」の　文字。",
		rule: "球を　はね返して　スレを　崩す。\n球を　3回　のがすと　おわり。",
		title: "スレ崩し",
		hint: "←→／タップで　動く　A／タップで　打つ",
		unit: "点",
	},
	mole: {
		line: "もぐらたたきの　台。\n画面に「ROMたたき」の　文字。",
		rule: "顔を　出した　ROM専を　たたく。\nイッチは　たたいたら　あかん。",
		title: "ROMたたき",
		hint: "十字キー＋A／穴を　タップで　たたく",
		unit: "点",
	},
	fighter: {
		line: "格ゲーの　対戦台。\n画面に「レスバトル」の　文字。",
		rule: "相手が「！」で　構えたら、\nなぐられる　直前に　A　で　返す。",
		title: "レスバトル",
		hint: "A／タップで　返す　早すぎると　スキ",
		unit: "点",
	},
	slot: {
		line: "メダルゲームの　台。\n画面に「メダルスロット」の　文字。",
		rule: "メダル　10枚から。A　で　回して、\nA　で　1つずつ　止める。",
		title: "メダルスロット",
		hint: "A／タップで　回す・止める　B／外で　やめる",
		unit: "枚",
	},
	runner: {
		line: "アクションゲームの　台。\n画面に「なんJラン」の　文字。",
		rule: "走る　キリコを　跳ばせて、\n荒らしの　石を　よける。",
		title: "なんJラン",
		hint: "A／タップで　跳ぶ",
		unit: "点",
	},
	rhythm: {
		line: "音ゲーの　台。\nランキングの　1位は「>>1」。",
		rule: "札が　線に　重なったら　たたく。\n←↓↑→　か　道を　タップ。",
		title: "保守ビート",
		hint: "←↓↑→／道を　タップで　たたく",
		unit: "点",
	},
	// ── カジノ「ガチャ」（店が 貸す 遊びの チップ。お金は 賭けない）
	gacha: {
		line: "スロット台。\n画面に「ガチャスロット」の　文字。",
		rule: "遊びの　チップを　30枚　借りた。\nA　で　1枚　入れて　引く。",
		title: "ガチャスロット",
		hint: "A／タップで　引く　B／外を　2回で　やめる",
		unit: "枚",
	},
	highlow: {
		line: "カードの　台。\nディーラーが　じっと　見ている。",
		rule: "遊びの　チップを　20枚　借りた。\n次の　カードは　高いか　低いか。",
		title: "ハイ＆ロー",
		hint: "←ロー　→ハイ　A　降りる　B／外2回　やめる",
		unit: "枚",
	},
	roulette: {
		line: "ルーレット。\n赤か　黒か。……緑も　ある。",
		rule: "遊びの　チップを　30枚　借りた。\n赤・黒は　2倍、緑は　14倍。",
		title: "ルーレット",
		hint: "←→色　↑↓枚数　A　回す　B／外2回",
		unit: "枚",
	},
	// ── 海の家「age」・バー「次スレ」
	suika: {
		line: "クーラーボックス。\nスイカが　まるごと　冷やしてある。",
		rule: "目かくしで　スイカを　割る。\n名無しの　声を　たよりに　歩け。",
		title: "スイカ割り",
		hint: "十字キー／タップで　歩く　A　棒を　ふる",
		unit: "点",
	},
	glassSlide: {
		line: "台の　上の　グラス。\nマスターが「滑らせて　みるか」と。",
		rule: "カウンターで　グラスを　滑らせ、\n客の　前で　止める。5杯。",
		title: "グラス滑らせ",
		hint: "A／タップで　力を　決める",
		unit: "点",
	},
};

/** 板の 中の 字（スコアの 帯・判定）。 */
export const ARCADE_BOARD = {
	score: "SCORE",
	hi: "HI",
	lives: "残機",
	time: "TIME",
	medals: "メダル",
	slotWin: "{n}枚　払いだし！",
	slotBust: "メダルが　なくなった",
	breakoutLaunch: "A／タップで　球を　打つ",
	breakoutWave: "WAVE {n}",
	moleBonk: "書けや",
	moleOuch: "イッチや！",
	driveCrash: "CRASH!",
	fighterYou: "キリコ",
	fighterCounter: "論破！",
	fighterEarly: "スキあり",
	fighterHit: "被弾",
	fighterKo: "K.O.",
	fighterNext: "次の　相手：{name}",
	rhythmJudge: {
		perfect: "PERFECT",
		great: "GREAT",
		good: "GOOD",
		miss: "MISS",
	},
	rhythmCombo: "{n} COMBO",
	rhythmFull: "FULL COMBO!",
	// カジノ
	chips: "チップ",
	gachaReach: "リーチ！",
	gachaWin: "{n}枚！",
	gachaUr: "UR　確定！",
	gachaPair: "1枚　もどった",
	bust: "チップが　なくなった",
	hlPot: "賭け　{n}枚",
	hlHigh: "ハイ",
	hlLow: "ロー",
	hlTake: "降りる",
	hlWin: "当たり！",
	hlPush: "同じ　数",
	hlLose: "はずれ",
	hlTook: "{n}枚　手もとへ",
	rlRed: "赤",
	rlBlack: "黒",
	rlGreen: "緑",
	rlSpin: "回す",
	rlWin: "{n}枚　払いもどし！",
	rlLose: "はずれ",
	// スイカ割り（名無しの 声。{dir} は 方）
	swDirs: { up: "前", down: "うしろ", left: "左", right: "右" },
	swNear: [
		"そこや！割れ！",
		"{dir}！あと1歩！",
		"{dir}や！ちかい！",
		"{dir}！まだまだ！",
	],
	swNanashi: "名無し",
	swTroll: "荒らし",
	swHit: "割れた！",
	swNear1: "かすった……",
	swMiss: "空ぶり",
	swTimeup: "時間ぎれ",
	// グラス滑らせ
	gsRound: "{n}杯目",
	gsExact: "ぴったり！",
	gsPoints: "{n}点",
	gsBreak: "割れた……",
	gsPower: "力",
} as const;
