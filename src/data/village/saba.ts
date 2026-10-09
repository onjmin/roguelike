// ホシュクラ：保守村の 南西の 海に 浮かぶ ブロックの 島（おーぷんの マイクラスレ「おんJで　マイクラやろうや」の パロディ。
// 鯖の 名前は ホシュクラ＝保守＋クラフト）。桟橋（x=20）の y=44 から 西へ 板の 橋。
// 段2 で 鯖が 立つ（でこぼこの 小島に 豆腐ハウスと >>1 の 看板と 鯖缶）→ 段3 整地（島が 広がって 平らに。ブラマイ場・
// 投票箱・初期スポの 看板・豚レース場・整地厨）→ 段4 初心者用アパート・共有畑・パン置き場・新規 →
// 段5 ウーパールーパーの 水槽と 湧き潰しの ジャック・オ・ランタン → 段6 謎の 上級者の 装置（トラップタワー・ランプ）→
// 段7 石の 橋。島は 段ごとに 1つの 施設（saba2〜saba7）で 建てかえ、アパートだけ 別の 施設（扉が 2つ 要る）。
// どれも 寄り道で、強さ・道具・売り上げ・段には ふれない。
//
// 置き場所の 決まり（src/sim/sabaTests.ts）：
// - 島は x0〜19・y41〜48。y48 は 崖（草ブロックの 横。通れない）。南の 口（20,51）の 前に 仲間が 並ぶ マスは
//   y48〜50 を 横に さがす（map.ts の lineupSpots）ので、島には y48 より 下に 歩ける マスを 作らない。
//   段2 の (16,46) も 崖（南の 口から 4マスの 内。呼んだ 仲間の 立つ 所に 選ばれない）。
// - 釣り場の 突堤（15〜20, y39）から 西の 海（y39〜40）は 海の まま。
// - 豚レース場の 走路（12〜16, y47）は 柵で かこって 豚だけ（台ごしに 話せる 柵 f）。豚と 夜の 匠は ui/saba.ts の sabaEvents。
// 絵は scripts/make-saba.mjs（public/sprites/saba.png・saba_takumi.png・src/data/sabaSheet.ts）。
// 文は data/sabaText.ts、遊び（ブラマイ・投票・朝やで・入居・お知らせ・水槽・匠）は ui/saba.ts。
// facilities.ts から 値を import しない（facilities.ts が この ファイルを 読むので 循環する）。

import { sb } from "../sabaSheet";
import { SABA_TEXT as X } from "../sabaText";
import type {
	Facility,
	FacilityRoom,
	OutdoorThing,
	RoomLook,
} from "./facilities";

const G = sb("grassTop");

/** 島の キー（下から 重ねる 絵。ground:"none" なので 地面も 自分で 敷く）。 */
const ISLE_KEYS: Record<string, readonly string[]> = {
	g: [G], // 草ブロックの 上
	p: [sb("pathTop")], // 草の 道（島の 通り）
	b: [sb("planks")], // 板の 橋
	B: [sb("stoneBrick")], // 石レンガの 橋（段7）
	j: [G, sb("torch")], // 湧き潰しの 松明（通れる）
	c: [sb("grassSide")], // 島の 崖（草ブロックの 横）
	k: [sb("grassSide")], // でっぱり（整地の 残りの 1マス）
	o: [G, sb("cobble")], // 丸石の でっぱり（段2）
	O: [G, sb("logTop")], // 原木の 切り株
	T: [sb("white")], // 豆腐ハウス（白い コンクリート）
	W: [sb("white"), sb("glass")],
	t: [sb("white"), sb("doorTop")],
	D: [sb("white"), sb("doorBottom")],
	S: [G, sb("sign")], // >>1 の 看板
	N: [G, sb("townSign")], // 初期スポの 看板（命名投票の 名前）
	H: [sb("cobble"), sb("hole"), sb("ladder")], // ブラマイ場の 縦穴
	h: [G, sb("post")], // 立て札
	V: [G, sb("ballot")], // 投票箱
	f: [G, sb("fence")], // 豚レース場の 柵（台ごしに 豚に 話せる）
	F: [G, sb("fence")], // 柵の はし（通れない だけ）
	l: [sb("dirt")], // 豚レース場の 走路（豚だけ。キリコは 入れない）
	w: [sb("farmland"), sb("wheat")], // 共有畑
	C: [G, sb("chest")], // パン置き場
	A: [sb("water"), sb("glass")], // ウーパールーパーの 水槽（段5〜。からっぽ）
	J: [G, sb("jack")], // ジャック・オ・ランタン（湧き潰し）
	X: [sb("stoneBrick"), sb("spawner")], // トラップタワーの 上（スポナーは すけるので 石レンガの 上）
	x: [sb("stoneBrick")], // トラップタワー
	I: [sb("ironBlock")], // 謎の 装置
	L: [sb("lampOn")],
};

/** 島の 行（左上 = 地図の (0,41)。x0〜19 × y41〜48。" " は 海の まま）。 */
export const ISLE_ROWS: Record<2 | 3 | 4 | 5 | 6 | 7, readonly string[]> = {
	// 鯖が 立った：でこぼこの 小島（x8〜16）・豆腐ハウス・看板・切り株・橋
	2: [
		"            gTTTO   ",
		"         gkggWtWO   ",
		"        gggogTDTS   ",
		"        gggggggggbbb",
		"        kgggggjgg   ",
		"        cggkggggc   ",
		"         cggggggc   ",
		"          cccccc    ",
	],
	// 整地：島が 広がって 平ら（でっぱりは 1マス だけ 残る）・通り・初期スポの 看板・投票箱・ブラマイ場・立て札・豚レース場
	3: [
		"gggggggggggggTTTO   ",
		"gggggggggggggWtWO   ",
		"gggggggggggNgTDTS   ",
		"pppppppppppppppppbbb",
		"ggggggggjggggggjg   ",
		"gggggggVgHhhfffff   ",
		"ggggggggggkFlllll   ",
		"ccccccccccccccccc   ",
	],
	// 町：共有畑・パン置き場（アパートは 別の 施設 saba_apart が 7〜10 × 41〜43 に 重なる）
	4: [
		"gggggggggggggTTTO   ",
		"gggggggggggggWtWO   ",
		"gggggggggggNgTDTS   ",
		"pppppppppppppppppbbb",
		"ggggggggjggggggjg   ",
		"ggwwwCgVgHhhfffff   ",
		"ggwwwgggggkFlllll   ",
		"ccccccccccccccccc   ",
	],
	// ウーパールーパーの 水槽（3〜5 × 41〜43）・湧き潰しの ジャック・オ・ランタン
	5: [
		"ggJAAAJggggJgTTTO   ",
		"gggAAAgggggggWtWO   ",
		"gggAAAgggggNgTDTS   ",
		"pppppppppppppppppbbb",
		"ggggggggjggggggjg   ",
		"ggwwwCgVgHhhfffff   ",
		"ggwwwgggggkFlllll   ",
		"ccccccccccccccccc   ",
	],
	// 謎の 上級者：トラップタワー（0〜1 × 41〜43）・装置（0〜1 × 46〜47）
	6: [
		"XXJAAAJggggJgTTTO   ",
		"xxgAAAgggggggWtWO   ",
		"xxgAAAgggggNgTDTS   ",
		"pppppppppppppppppbbb",
		"ggggggggjggggggjg   ",
		"IIwwwCgVgHhhfffff   ",
		"LLwwwgggggkFlllll   ",
		"ccccccccccccccccc   ",
	],
	// 都市：橋が 石レンガに
	7: [
		"XXJAAAJggggJgTTTO   ",
		"xxgAAAgggggggWtWO   ",
		"xxgAAAgggggNgTDTS   ",
		"pppppppppppppppppBBB",
		"ggggggggjggggggjg   ",
		"IIwwwCgVgHhhfffff   ",
		"LLwwwgggggkFlllll   ",
		"ccccccccccccccccc   ",
	],
};

/** 島の 物（地図の 座標）。どれも play:"saba"（読んだ あと ui/saba.ts：日・帰りで かわる 1窓・夜の 匠）。 */
const thing = (
	id: string,
	at: readonly [number, number],
	lines: readonly string[],
): OutdoorThing => ({
	id,
	at,
	lines,
	play: "saba",
});
const isleThings = (st: 2 | 3 | 4 | 5 | 6 | 7): OutdoorThing[] => [
	thing("rules", [16, 43], X.rules),
	// 鯖缶（RPGEN「職人」）
	{
		...thing("sabakan", [12, 45], X.sabakan[st]),
		sprite: "sa:aChtC8",
		dir: "up",
		name: "鯖缶",
	},
	...(st >= 3
		? [
				// 整地厨（RPGEN「一般系男性」）
				{
					...thing("seichi", [2, 45], X.seichi[st >= 6 ? 6 : st >= 4 ? 4 : 3]),
					sprite: "sa:Dz9P3N",
					dir: "down" as const,
					name: "整地厨",
				},
				thing("town", [11, 43], X.town),
				thing("vote", [7, 46], X.vote),
				thing("mine", [9, 46], X.mine),
				thing("mine_sign", [10, 46], X.mineSign),
				thing("race", [11, 46], X.race),
				thing("bump", [10, 47], X.bump),
			]
		: []),
	...(st >= 4
		? [
				// 新規（RPGEN「キャンプボーイ」）
				{
					...thing("shinki", [6, 45], X.shinki[st >= 6 ? 6 : 4]),
					sprite: "sa:4EaOzr",
					dir: "up" as const,
					name: "新規",
				},
				thing("farm", [3, 46], X.farm),
				thing("bread", [5, 46], X.bread),
			]
		: []),
	...(st >= 5
		? [thing("tank", [4, 43], X.tank), thing("jack", [11, 41], X.jack)]
		: []),
	...(st >= 6
		? [
				// 謎の 上級者（RPGEN の 白い 人）
				{
					...thing("joukyu", [0, 45], X.joukyu),
					sprite: "sa:ohUlqd",
					dir: "right" as const,
					name: "謎の　上級者",
				},
				thing("tower", [1, 43], X.tower),
				thing("machine", [1, 46], X.machine),
			]
		: []),
];

const look = (
	floor: string,
	floorColor: string,
	wall: string,
	wallColor: string,
): RoomLook => ({
	floor,
	floorColor,
	up: wall,
	low: wall,
	wallColor,
});

/** 豆腐ハウスの 中（9×8。中も 白い。ベッドで 朝やで）。 */
const TOFU_ROOM: FacilityRoom = {
	look: look(sb("planks"), "#9c7a48", sb("white"), "#e6e6e2"),
	rows: [
		"#########",
		"#HHWHHjH#",
		"#hhhhhhh#",
		"#B.....C#",
		"#.......#",
		"#K.....F#",
		"#.......#",
		"####DD###",
	],
	tiles: (k) => ({
		W: k.up(sb("glass")),
		j: k.up(sb("torch")),
		B: k.on(sb("bed")),
		C: k.on(sb("chest")),
		K: k.on(sb("craftTop")),
		F: k.on(sb("furnaceLit")),
	}),
	things: {
		W: "window",
		j: "torch",
		B: "bed",
		C: "chest",
		K: "craft",
		F: "furnace",
	},
	lines: X.tofuRoom,
	plays: { bed: "saba" },
};

/** 初心者用アパートの 中（14×9。北の 壁に 部屋の 扉 4つ・共有チェスト・ジュークボックス）。 */
const APART_ROOM: FacilityRoom = {
	look: look(sb("planks"), "#9c7a48", sb("stoneBrick"), "#7a7a78"),
	rows: [
		"##############",
		"#HHHHHWHHHHHW#",
		"#hhmhhhhhhhhh#",
		"#1..2..3..4..#",
		"#............#",
		"#C..........P#",
		"#............#",
		"#............#",
		"######DD######",
	],
	tiles: (k) => ({
		"1": k.on(sb("doorTop", 2)),
		"2": k.on(sb("doorTop", 2)),
		"3": k.on(sb("doorTop", 2)),
		"4": k.on(sb("doorTop", 2)),
		C: k.on(sb("chest")),
		P: k.on(sb("jukebox")),
		W: k.up(sb("glass")),
		m: k.low(sb("sign")),
	}),
	things: {
		"1": "room101",
		"2": "room102",
		"3": "room103",
		"4": "room104",
		C: "chest",
		P: "jukebox",
		W: "window",
		m: "board",
	},
	lines: X.apartRoom,
	plays: { room102: "saba", chest: "saba" },
};

const STAGES = [2, 3, 4, 5, 6, 7] as const;

export const SABA_FACILITIES: readonly Facility[] = [
	...STAGES.map(
		(st): Facility => ({
			id: `saba${st}`,
			name: X.names.tofu,
			from: st,
			...(st < 7 ? { until: st + 1 } : {}),
			at: [0, 41],
			look: {
				kind: "grid",
				ground: "none",
				shadow: false,
				rows: ISLE_ROWS[st],
				door: "D",
				floor: "gpbBjl",
				counter: "f",
				keys: ISLE_KEYS,
			},
			door: X.door.tofu,
			room: TOFU_ROOM,
			outdoor: isleThings(st),
		}),
	),
	// 初心者用アパート（段4〜。島の 通りの 北。石レンガに 濃い 板の 屋根。影は 落とさない）
	{
		id: "saba_apart",
		name: X.names.apart,
		from: 4,
		at: [7, 41],
		look: {
			kind: "grid",
			ground: "none",
			shadow: false,
			rows: ["aaaa", "etwe", "eDne"],
			door: "D",
			keys: {
				a: [sb("darkPlanks")],
				e: [sb("stoneBrick")],
				t: [sb("stoneBrick"), sb("doorTop")],
				w: [sb("stoneBrick"), sb("glass")],
				D: [sb("stoneBrick"), sb("doorBottom")],
				n: [sb("stoneBrick"), sb("plate")],
			},
		},
		door: X.door.apart,
		room: APART_ROOM,
		outdoor: [thing("plate", [9, 43], X.plate)],
	},
];
