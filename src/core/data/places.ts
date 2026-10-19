// 名所の 階と 底の 集落の 手づくりの 地図（core/data/dungeons.ts の rests・settlement の map）。
// 乱数で 作らず、字の 行で 描いた 大部屋 1つ（core/floor.ts の buildPlaceFloor）。床と 壁は 板の 見た目
// （ui/dungeon/theme.ts）、置物は この 表の 絵（ui/dungeon/render.ts）。地図は はじめから ぜんぶ 見える。
//
// 字：# 壁   （空白）外   . 床   @ 着く 所   > 階段   * 持ち帰る 品（集落には かならず。期間限定の 目的で fetch にも なる）
//     S 源泉（踏むと HP。かたまりで 1つの 湯だまりに 見える）   o 湯気の 立つ 湯だまり（見た目だけ。通れる）
//     1〜9 立って いる 人（folk の 順）   g 置いて ある 道具（gifts の 順）   ほかの 字は legend の 置物。
// 置物は 通れない（walk の 敷物だけ 通れる）。big の 置物は 同じ 字の つながった 長方形で 1つ（巨大な 像・建物・
// 屋台）で、絵は 長方形の 下の 中ほどに 合わせて scale 倍で 描く（上へ はみ出してよい）。big で ない 置物は 1マスに 1つ。
// どの 床も 1つに つながって いる こと（ワープで 閉じこめられない。src/sim/placeTests.ts で 調べる）。

/** 置物の 絵 1枚。 */
export type PlaceArt = {
	/** 絵（"pub:…#sx,sy,sw,sh" など。engine/assets.ts の 参照）。 */
	ref: string;
	/** 倍率（巨大な 像。既定 1）。 */
	scale?: number;
	/** 上へ ずらす 画素（台座の 上の 像）。 */
	lift?: number;
	/** 色の かけかた（canvas の filter。銅像 など）。 */
	filter?: string;
	/** 光って 明滅する（水晶・発電炉。color の 光の 輪と、1周の ミリ秒。phase で となりどうしを ずらす）。 */
	glow?: { color: string; period: number; phase?: number };
};

export type PlaceProp = {
	/** 下から 順に 重ねる 絵。 */
	art: readonly PlaceArt[];
	/** 通れる 敷物（床の 上に 描く）。 */
	walk?: true;
	/** 同じ 字の つながった 長方形で 1つ（巨大な 物）。 */
	big?: true;
};

export type PlaceMap = {
	rows: readonly string[];
	legend: Readonly<Record<string, PlaceProp>>;
};

// ── 絵の 切り出し ──
const cut = (img: string, c: number, r: number, w = 1, h = 1): string =>
	`${img}#${c * 16},${r * 16},${w * 16},${h * 16}`;
const BASE = "pub:assets/rpg-reze/Base.png";
const INTERIOR = "pub:sprites/rpgen-interior.png";
const FIELD = "pub:assets/rpg-reze/field.png";
const b = (c: number, r: number, w = 1, h = 1) => cut(BASE, c, r, w, h);
const i = (c: number, r: number, w = 1, h = 1) => cut(INTERIOR, c, r, w, h);
const fd = (c: number, r: number, w = 1, h = 1) => cut(FIELD, c, r, w, h);
/** 歩く 絵（32x64）の 正面 1コマ。 */
const front = (sheet: string) => `${sheet}#0,0,16,16`;

const one = (ref: string, more: Omit<PlaceArt, "ref"> = {}): PlaceProp => ({
	art: [{ ref, ...more }],
});
const big = (...art: PlaceArt[]): PlaceProp => ({ art, big: true });
const rug = (ref: string): PlaceProp => ({ art: [{ ref }], walk: true });

/** 銅像の 色（ui の canvas filter）。 */
const BRONZE = "sepia(1) saturate(3) brightness(0.55) contrast(1.3)";
const STONE = "grayscale(1) brightness(1.1)";

// 共通の 置物
const TREE = one(b(0, 591, 3, 3));
const BARREL = one(i(13, 15));
const CRATE = one(i(15, 0));
const FLOWERS = one(b(7, 133));
const LANTERN = one(b(2, 297));
const FENCE = one(i(9, 6));
const ROCK = one(b(1, 604, 2, 2));
const SAKURA = one(b(0, 292, 2, 2));
const PILLAR = one(b(2, 129, 1, 3));
const BREAD = b(6, 139);
/** 屋台の 台（3マス）。上に 品を 並べる。 */
const stall = (...goods: string[]): PlaceProp =>
	big({ ref: i(3, 5, 3, 1) }, ...goods.map((ref) => ({ ref, lift: 8 })));

/**
 * パン板の 底：パン王国の 城下町。北に 城、まんなかに 噴水、西に パン王の 銅像。
 * ロゼ（2）は 王の 左で 説教の 途中、ゼロ（5）は サブ機の プロト（6）・レン（7）と 南西で パン兵を 数えて いる
 * （先回りの 現場。data/story/restSkits.ts）。
 * 赤い じゅうたんの 先で パン王が 待ち、となりに 食パンの 国旗。
 */
export const PAN_CASTLE_TOWN: PlaceMap = {
	rows: [
		"###################################",
		"#T....U.U......CCCCC......X.X....T#",
		"#..............CCCCC..............#",
		"#..f...........CCCCC...........f..#",
		"#.............3..1*.4.............#",
		"#..............2,,,...............#",
		"#..LLL..........,,,..........MMM..#",
		"#...............,,,...............#",
		"#T.............,QQQ,.............T#",
		"#..............,QQQ,..............#",
		"#..KKK.........,QQQ,.........NNN..#",
		"#..KKK..........,,,...............#",
		"#.......7.......,,,...............#",
		"#T.....U.5......,,,........X.....T#",
		"#..........6....,,,...............#",
		"#................@.>..............#",
		"###################################",
	],
	legend: {
		T: TREE,
		U: BARREL,
		X: CRATE,
		f: FLOWERS,
		",": rug(i(15, 7)),
		// パン王国の 城（全体地図の 城を 2倍）
		C: big({ ref: fd(19, 8, 2, 2), scale: 2 }),
		// 噴水
		Q: big({ ref: b(0, 132, 3, 3) }),
		// パン王の 銅像（台座の 上）
		K: big(
			{ ref: b(2, 128, 2, 1), scale: 1.5 },
			{
				ref: front("pub:sprites/minors_panmatsu.png"),
				scale: 3,
				lift: 14,
				filter: BRONZE,
			},
		),
		// パンの 屋台
		L: stall(BREAD, BREAD, BREAD),
		M: stall(BREAD, i(8, 16), BREAD),
		N: stall(i(4, 9), BREAD, i(5, 9)),
	},
};

/** 風呂板 7階：露天の 源泉。岩の 湯船、北に 竹の 垣、東に 日本一の 大桶。足もとにも 湯が わく（o）。 */
export const BATH_SPRING: PlaceMap = {
	rows: [
		"################################",
		"#bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb#",
		"#Y.......l........l.........Y..#",
		"#.....R~~~~~~~~R...............#",
		"#....~~~~~~~~~~~~~.....OOOO....#",
		"#...R~~~~~~~~~~~~~R....OOOO....#",
		"#....~~~~~~~~~~~~~.............#",
		"#.....~~~~~~~~~~~.1............#",
		"#.......R~~~~~R.............oo.#",
		"#..l..ooo.............BB...looo#",
		"#....oooo.....@..........>..ooo#",
		"#Y...ooo....................Y..#",
		"################################",
	],
	legend: {
		b: one(b(0, 397, 1, 3)),
		Y: SAKURA,
		l: one(b(7, 301)),
		R: ROCK,
		"~": one("pub:assets/rpg-reze/pond.png#0,64,16,16"),
		// 日本一の 大桶（湯守の 桶を 4倍）
		O: big({ ref: b(0, 124), scale: 4 }),
		// 湯上がりの 長いす
		B: big({ ref: i(0, 5, 2, 1) }),
	},
};

/**
 * 風呂板の 底：42℃派が 立てこもった 銭湯の 大浴場（ボスの 大部屋）。湯船が 2つ（西が 42℃、東が 41℃）、
 * まんなかの 通路の 奥で 湯守が 待つ。湯船は 通れず 見通しも さえぎるので、陰に 入ると 熱い 湯を よけられる。
 * 南は 洗い場の 桶と 腰かけ。
 */
export const BATH_HALL: PlaceMap = {
	rows: [
		"##############################",
		"#P...........P..P...........P#",
		"#..~~~~~~~~~~....~~~~~~~~~~..#",
		"#..~~~~~~~~~~....~~~~~~~~~~..#",
		"#..R~~~~~~~~~.B..~~~~~~~~~R..#",
		"#............................#",
		"#..OO...u.u.u....u.u.u...OO..#",
		"#..OO..........@.........OO..#",
		"#...l....nn........nn....l...#",
		"#.......................>....#",
		"##############################",
	],
	legend: {
		P: PILLAR,
		R: ROCK,
		"~": one("pub:assets/rpg-reze/pond.png#0,64,16,16"),
		// 洗い場の 桶と、積んだ 大桶（湯守の 桶）
		u: one(b(0, 124)),
		O: big({ ref: b(0, 124), scale: 2 }),
		l: LANTERN,
		// 脱衣所から 出した 長いす
		n: big({ ref: i(0, 5, 2, 1) }),
	},
};

/**
 * 電池板 8階：発電所の 見学コース。柵の 向こうに 発電炉と 機械、手前は 見学の 通路と 売店。
 * フェリスは 柵の すきまに 立って いる（柵越え）。案内係の デンちゃんは 見学の 通路の まん中（3）。
 * 両はしに 関係者の 戸口（床は ぜんぶ つながる）。
 */
export const DENCHI_PLANT_TOUR: PlaceMap = {
	rows: [
		"####################################",
		"#........ZZZZZZ....................#",
		"#........ZZZZZZ............NN.nn...#",
		"#E.e.E...ZZZZZZ...E.e.E............#",
		"#.PP.....ZZZZZZ.....DD...pp...TT...#",
		"#........ZZZZZZ....................#",
		"#.hhhhhhhhhhhhhhhhhhhhhhhhhh2hhhhh.#",
		"#::::::::::::::::::::::::::::::::::#",
		"#:@::::::::::::::::::::::::::::::::#",
		"#....M.M......3..........gggggg....#",
		"#.......................g1KKKF.....#",
		"#>.................................#",
		"####################################",
	],
	legend: {
		// 光る 筒
		E: one(b(4, 458, 1, 3), { glow: { color: "255,190,80", period: 1400 } }),
		e: one(b(5, 458, 1, 3), {
			glow: { color: "255,190,80", period: 1400, phase: 700 },
		}),
		// 発電炉（2倍）
		Z: big({
			ref: b(0, 458, 3, 3),
			scale: 2,
			glow: { color: "255,170,60", period: 2400 },
		}),
		N: big({ ref: b(2, 482, 2, 2) }),
		n: big({ ref: b(2, 482, 2, 2) }),
		P: big({ ref: i(12, 17, 2, 2) }),
		p: big({ ref: i(12, 17, 2, 2) }),
		D: big({ ref: i(9, 17, 2, 2) }),
		T: big({ ref: i(8, 17, 2, 2) }),
		h: FENCE,
		":": rug(b(5, 469)),
		// 見学者の ための 画面
		M: one(b(0, 485, 2, 2)),
		// 売店（棚と レジ）
		K: big({ ref: i(0, 0, 2, 2) }, { ref: i(12, 0), lift: 0 }),
		F: one(i(2, 0, 1, 2)),
	},
};

/** 離島板の 底：山の 上の 集落。まんなかに 島の 御神木、まわりに 椰子と 焚き火。 */
export const ISLAND_HAMLET: PlaceMap = {
	rows: [
		"##############################",
		"#P.....GGGGGGGG.........P....#",
		"#......GGGGGGGG..............#",
		"#.R....GGGGGGGG.......R......#",
		"#............................#",
		"#...2......F......3.....P....#",
		"#P.........1*................#",
		"#.....U.U............R.......#",
		"#..R..........@...........P..#",
		"#P.......................>...#",
		"##############################",
	],
	legend: {
		// 御神木（しめ縄つき）
		G: big(
			{ ref: b(0, 384, 8, 3), lift: 16 },
			{ ref: b(2, 387, 4, 1) },
			{ ref: b(1, 302, 2, 2), lift: 14 },
		),
		P: one(b(0, 601, 2, 3)),
		R: ROCK,
		F: one(i(6, 8)),
		U: BARREL,
	},
};

/** おんたこの 底：最上階の たこパ会場（屋上）。巨大たこ焼きの 看板、鉄板の 長机、ちょうちん、柵。 */
export const TAKO_ROOFTOP: PlaceMap = {
	rows: [
		"##############################",
		"#hhhhhhhhhhhhhhhhhhhhhhhhhhhh#",
		"#c.....c.....AAAA.....c.....c#",
		"#............AAAA............#",
		"#..TTT....TTT....TTT....X.X..#",
		"#.......2.....1*....3........#",
		"#..TTT....TTT....TTT.........#",
		"#.......................X....#",
		"#c...........@..........>...c#",
		"#hhhhhhhhhhhhhhhhhhhhhhhhhhhh#",
		"##############################",
	],
	legend: {
		h: FENCE,
		c: LANTERN,
		// 巨大たこ焼きの 看板（4倍）
		A: big(
			{ ref: i(3, 5, 3, 1), scale: 4 / 3 },
			{ ref: "pub:sprites/items/takoyaki.png", scale: 4, lift: 10 },
		),
		// たこ焼き器の 長机
		T: big(
			{ ref: i(9, 5, 3, 1) },
			{ ref: "pub:sprites/items/takoyaki.png", lift: 8 },
		),
		X: one(i(14, 15)),
	},
};

/** お祭りの 底：やぐら広場。まんなかに やぐら、ちょうちんの 輪、夜店（金魚すくい・かき氷・ラムネ）。 */
export const FESTIVAL_YAGURA: PlaceMap = {
	rows: [
		"################################",
		"#..LLL....FFF.......KKK...WWW..#",
		"#..............................#",
		"#...._c____c____c____c_........#",
		"#....__________________........#",
		"#...._c______YYY_____c_..2.....#",
		"#....________YYY_______........#",
		"#...._c_______1*_____c_..3.....#",
		"#....__________________........#",
		"#...._c____c____c____c_........#",
		"#.............@..........>.....#",
		"################################",
	],
	legend: {
		// やぐら（木の 物見やぐらを 3倍）
		Y: big({ ref: fd(19, 10, 1, 2), scale: 3 }),
		c: LANTERN,
		// 踊りの 輪の 石だたみ
		_: rug(i(1, 16)),
		L: stall(i(4, 9), i(4, 9), i(0, 9)),
		F: big({ ref: i(10, 15, 3, 1) }),
		K: stall(i(10, 9), i(9, 9), i(10, 9)),
		W: stall(i(8, 9), i(7, 9), i(8, 9)),
	},
};

/** 過去ログの底の 一息：静かな 石室。まんなかに 巨大な 水晶、柱と 古い 石像、源泉。 */
export const HIDDEN_STONE_ROOM: PlaceMap = {
	rows: [
		"##########################",
		"#..I....I....I....I....I.#",
		"#........................#",
		"#.Gx..........x.......xG.#",
		"#..........CC............#",
		"#..........CC....SSSS....#",
		"#.Gx..........x..SSSS.xG.#",
		"#...........@.........>..#",
		"#..I....I....I....I....I.#",
		"##########################",
	],
	legend: {
		I: PILLAR,
		// 巨大な 水晶（4倍）
		C: big({
			ref: "sp:vjVm0U",
			scale: 4,
			glow: { color: "120,255,255", period: 3000 },
		}),
		x: one("sp:pMxknZ", {
			glow: { color: "120,255,255", period: 2200, phase: 1100 },
		}),
		G: one(b(5, 285, 1, 2), { filter: STONE }),
	},
};
