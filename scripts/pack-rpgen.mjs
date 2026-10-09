// RPGEN の 部品を まとめる（node scripts/pack-rpgen.mjs → public/sprites/rpgen-modern.png・
// public/sprites/rpgen-interior.png・public/sprites/rpgen-food.png と src/data/village/rpgenArt.ts）。
//
// 絵は RPGEN（https://rpgen.us/）の スプライトセット「現代 外装」「現代 建物」「和風の建物」「窓/ドア」「看板,貼り紙」
// 「標識」「駅」「夏祭り素材集」「金銀屋根」「食べ物/飲み物」「鉢植」「近代柵」「絨毯」から 選んだ 16x16 の 部品
// （検索: https://rpgen-search.pages.dev/）。施設の 外観・自販機・止まっている 車・バス停に 使う
// （data/village/facilities.ts の GridLook）。赤い 灯りと 赤十字の 2つだけ ここで 手描き（drawn）。
// 群は Base.png の マスを 切って 加工する ことも できる（base: [列, 行]。のれん・日よけの 色がえ）。
// 施設の 部屋の 家具・小物（ROOM_PIECES）は べつの 1枚 rpgen-interior.png に まとめる（facilities.ts の ri・riCell）。
// こちらは「テーブル・椅子」「家具」「空室改造セット」「テレビ」「音楽関係」「箱・壺・樽」「囲碁・将棋」「屋内床・タイル」
// 「夏祭り素材集」などから 選び、台の 上の 家電など 少しは 同梱の Base.png から 切って 詰める。
// 飲食店で 出てきた 一品の 絵（FOOD）は「食べ物/飲み物」「食べ物２」「夏祭り素材集」から rpgen-food.png に
// （data/eateries.ts・ui/eat.ts。たこ焼きだけ 手描き）。
//
// ゲームは CDN を 見ない（村の 絵は 同梱の 画像だけ）。部品は 作る ときに CDN から 取る：
//   https://rpgen-search.pages.dev/data/images/sprites/<id>.png（認証 なし）
//   node scripts/pack-rpgen.mjs                    … CDN から 取って 書き出す
//   node scripts/pack-rpgen.mjs --cache <dir>      … <dir>/<id>.png が あれば それを 使い、無ければ 取って そこへ 置く
//
// 群（GROUPS）は 部品の 並び（行ごと）。アトラス（幅 16 マス）の 中でも 群は くっつけて 置く（群の 順に、
// 上から 最初に 入る 所へ）ので、自販機 2x2・車 4x2 などは 1枚の 絵として 切り出せる。
// 加工（op）: flip（群ごと 左右反転。並びも 逆に なる）・hue:<度>（彩度 0.15 以上の 画素の 色相を 回す。
// 灰色は そのまま）・tint:<rrggbb>（明るさ × 1.35 × 色）・gray:<度>-<度>（その 色相の 色だけ 灰に）。
// + で つなぐと 順に かける（flip+hue:200）。
//
// 依存なし（zlib だけ）。PNG の 書き方は make-street.mjs と 同じ。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PNG = join(HERE, "../public/sprites/rpgen-modern.png");
const OUT_ROOM_PNG = join(HERE, "../public/sprites/rpgen-interior.png");
const OUT_FOOD_PNG = join(HERE, "../public/sprites/rpgen-food.png");
const OUT_TS = join(HERE, "../src/data/village/rpgenArt.ts");
const BASE_PNG = join(HERE, "../public/assets/rpg-reze/Base.png");
const CDN = "https://rpgen-search.pages.dev/data/images/sprites/";

// ───────────────── 部品の 一覧（コメントは 出どころ：セットの 番号と その 中の 番号） ─────────────────

const GROUPS = {
	// 屋上（set 24 現代 建物）。平らな 屋根の 上の ふち 3・下の ふち 3、コンクリート、天窓、給水タンク
	roofFlat: {
		ids: [
			["FLa4GNd", "voeAmJt", "Dzb6PB0"],
			["ARxtsDP", "Bf7Zj2p", "ml6pxKd"],
		],
	}, // 24: 6 7 8 / 46 47 48
	concrete: { ids: [["FnkGK2"]] }, // 24: 21
	roofSlab: {
		ids: [
			["57HQdZ", "3iOW4r", "3i4Wx0"],
			["7cOdIm", "EgBh8O", "515QfM"],
		],
	}, // 24: 0 1 2 / 40 41 42
	skylight: { ids: [["cYqnurR"]] }, // 24: 64
	waterTank: { ids: [["NdpzjX"]] }, // 24: 184
	// 屋根（set 24・21）。軒（列0 赤・列1 青。上段・下段）、寄棟（赤・青）、和の 大屋根 5x2、切妻 3x2
	eave: {
		ids: [
			["Rgr6eY", "j9ZNwK"],
			["DzADPjm", "RgyUeO5"],
		],
	}, // 24: 154 155 / 174 175
	hipRed: {
		ids: [
			["BfbYjnq", "YBH2EE5", "EjVchBo"],
			["2hgPYeC", "q0DM3AR", "Zqo6Mjb"],
		],
	}, // 24: 128 129 130 / 148 149 150
	hipBlue: {
		ids: [
			["4aEXOMy", "VZvKXnv", "bnxkZJl"],
			["arjbtzF", "EjVxhyO", "VZvGXI5"],
		],
	}, // 24: 131 132 133 / 151 152 153
	jpRoof: {
		ids: [
			["j9UpweI", "j9ULwuJ", "kQ88K7d", "FLKkGiT", "CvovSey"],
			["ARg8sDm", "HbMHV1y", "14JT7Dy", "TdOW1ym", "bn3HZFk"],
		],
	}, // 21: 9〜13 / 21〜25
	jpGable: {
		ids: [
			["voPXmoG", "TdaL1S", "Q8glAbI"],
			["XMWwba5", "voPAmUI", "p58okgk"],
		],
	}, // 21: 0 1 2 / 18 19 20
	// 壁（set 24・21・25）
	white: {
		ids: [
			["7OGcdo4", "07fDTmm", "cYqAuN"],
			["wF4Hfdd", "KAI355M", "uE352jl"],
			["nWhCqOQ", "EjTQhBs", "VZc4XqW"],
		],
	}, // 24: 12 13 14 / 32 33 34 / 52 53 54
	gray: {
		ids: [
			["fU89hB", "hfKBMe", "8gMRgI"],
			["RH1eyq", "bqaZYk", "OyiJAg"],
		],
	}, // 24: 71 72 73 / 86 87 88
	beige: {
		ids: [
			["FLEuG4z", "dJ7r47C", "3TVeW5Z"],
			["voa7mUP", "uEc92id", "7Ongdk"],
		],
	}, // 24: 29 30 31 / 49 50 51
	// 白い 漆喰に 木の 腰（蔵・和の 家）
	shin: {
		ids: [
			["6yog2x", "VSiXCD", "mUQxhy"],
			["7chdZc", "BVMjna", "D5sP4w"],
		],
	}, // 24: 68 69 70 / 83 84 85
	// 赤レンガ・黒レンガ・灰の 石・ガラスブロック・鉄板・格子
	wallTex: {
		ids: [["EWhWfx", "0JNThb", "Q86PA7D", "q0n3vW", "LKLpjw", "uERw2jt"]],
	}, // 24: 109 111 112 113 114 115
	// ガラス（紫・水色・灰）
	glass: { ids: [["kQTsKOv", "JKZaGM", "KAt25Y8"]] }, // 24: 156 157 158
	shutter: { ids: [["M3hNnJI", "Q8xtA3S"]] }, // 24: 102 103
	shutterRed: { ids: [["M3hNnJI", "Q8xtA3S"]], op: "tint:c83228" }, // 24: 102 103
	// 開いた 車庫の 口（暗い）
	bay: { ids: [["nWFlqom", "OtGXJAA"]] }, // 24: 107 108
	// 和の 壁（上段・店先・入口・板壁）
	jpLow: {
		ids: [["YBaCEfL", "kQDzKqS", "HbjfV5y", "3TpkWqu", "kQDDKGO"]],
	}, // 21: 60〜64
	jpFront: {
		ids: [["M30Vno5", "6VbAgu", "gXZAHtD", "Uk5BLPn", "eHXk6p8"]],
	}, // 21: 33〜37
	jpEnt: { ids: [["07JcTbs", "M31lnrA", "p58TkI4"]] }, // 21: 45 46 47
	jpWood: { ids: [["07JATni", "q0dk3y0"]] }, // 21: 58 59
	// 板壁（上・下）・よしず（set 25 現代 外装）
	plank: { ids: [["rI2fCj5"], ["DzG5PXF"]] }, // 25: 0 / 20
	reed: { ids: [["HbLAVrZ"]] }, // 25: 21
	// 平らな 帯（set 175 金銀屋根。行0 青・行1 だいだい・行2 紫・行3 金・行4 桃の しま）
	band: {
		ids: [
			["vzirm9f", "hL9cBbn", "INlrvfz"],
			["wKLXfpx", "xuNLoNm", "8ZVaRbh"],
			["n4dKqeK", "u9fr2ME", "Kg6Y5mE"],
			["jGhmwID", "h9YSB53", "043QTSh"],
			["oz1mlhm", "BGvhjMj", "0Os0TuS"],
		],
	}, // 175: 87 88 89 / 84 85 86 / 90 91 92 / 9 10 11 / 72 73 74
	// 窓（白枠・黄枠の 店の 窓・木の 窓 2）
	win24: { ids: [["p5JNk7z", "3T2QW4k", "rIB3CE", "07D7T7w"]] }, // 24: 176 177 134 136
	// 窓（set 108 窓/ドア。青い 窓・小窓 2・灯りの 窓・格子窓・格子・障子）
	win108: {
		ids: [
			["cBwvuQM", "j9yTwZR", "uBaf2ZC", "NuUpzu1", "UkEcLAL", "uERw2jt", "arvntSG"],
		],
	}, // 108: 23 74 75 4 3 16 49
	shopGlass: { ids: [["fLvj9H", "P27DNNG", "0450T3k"]] }, // 108: 40 41 42
	autoDoor: {
		ids: [
			["VMT9XwX", "4tv6Oo0"],
			["rvDXCCF", "9LAlFwI"],
		],
	}, // 108: 62 63 / 81 82
	curtainBig: {
		ids: [
			["14mA7pO", "M3tGnYq", "6V1Eg1d"],
			["BfAtjnK", "ySzerRS", "Q8niA2q"],
		],
	}, // 108: 45 46 47 / 64 65 66
	winPink: {
		ids: [
			["uhkv2UE", "zYLIcKv"],
			["MWyRnSr", "9L62FSc"],
		],
	}, // 108: 57 58 / 76 77
	flowerBox: { ids: [["86YIRfp", "Nudgzf"]] }, // 108: 33 34
	// 扉（鉄・赤い 飾り扉・だいだい）
	door108: { ids: [["oNQTlVG", "6bmPgz8", "yvU5rMf"]] }, // 108: 87 89 90
	archTall: { ids: [["7OoDd20"], ["NuUpzu1"]] }, // 25: 4 / 24
	pillar: { ids: [["Tdv01c9"], ["xiBvotF"], ["6V18gY0"]] }, // 25: 19 / 39 / 59
	// 看板（set 92 看板,貼り紙・98 駅・25・109 夏祭り・102 標識・35 食べ物）
	led: { ids: [["Ef1Phcw", "ZWE6Mjj", "IletvXx", "7aUWdA3"]] }, // 92: 91〜94
	ledGray: { ids: [["8HiIRTh", "SoR5If5", "pAStk7E", "fLJd9UK"]] }, // 92: 81〜84
	banner: { ids: [["YB18E4t", "SmeBIhr"]] }, // 92: 48 49（心技体）
	// 非常口・青い 掲示板・額の 絵 3
	sign92: { ids: [["o1YlXX", "p5Slkwn", "p5SCkbm", "uE0U213", "Wef0N9"]] }, // 92: 43 8 45 47 80
	// 駅の 発車の 板
	depart: { ids: [["8HiIRTh", "SoR5If5", "pAStk7E", "fLJd9UK"]] }, // 98: 0〜3
	// SHOP・青い 札・丸い 時計
	sign25: { ids: [["mlgsxhH", "gXc3Hum", "ySUsrWo"]] }, // 25: 60 42 104
	kooriFlag: { ids: [["Nh9czgx"]] }, // 109: 24
	lanternStone: { ids: [["vDjbmUF"]] }, // 109: 36
	caution: { ids: [["0OcuTmk"]] }, // 102: 0
	// 屋台の 日よけ（行0 青・行1 赤）
	canopy: {
		ids: [
			["XW7sb4q", "n7Jeqrx", "EFplhyf"],
			["F58BG3W", "DYjvP1f", "kRHfKM3"],
		],
	}, // 109: 12 13 14 / 15 16 17
	ramenBowl: { ids: [["rIp9Cjm"]] }, // 35: 62
	// ── 飲食店（data/village/eateries.ts）
	// 屋台の 柱（左に ラムネの 氷水・右に 鉄板）と 台（109 夏祭り素材集）
	stallPole: { ids: [["ClNrSo9", "Y9pjEj"]] }, // 109: 26 28
	stallCounter: { ids: [["eZWT6o", "V37dXCq", "hGKKBMq"]] }, // 109: 40 41 42
	// 脚つきの 品書き・黄色い 看板（だいだい・赤は 色相を 回す）・木の 立て札 2（set 92）
	menuStand: { ids: [["KAmb5FK"]] }, // 92: 9
	signYellow: { ids: [["arntMO"]] }, // 92: 0
	signOrange: { ids: [["arntMO"]], op: "hue:-15" }, // 92: 0
	signRed: { ids: [["arntMO"]], op: "hue:-35" }, // 92: 0
	boardWood: { ids: [["GKnVU3N", "XqI9bTq"]] }, // 92: 14 15
	// 格子と 障子（上段 4・下段 4。set 108・21）
	lattice: {
		ids: [
			["p58EkbE", "arvntSG", "TdaR1Sr", "rIoMCK1"],
			["Smi0IO1", "XMWpb4x", "07JATni", "q0dk3y0"],
		],
	}, // 108: 48 / 21: 42 43 / 108: 51 // 108: 67 68 69 70
	yellowWindow: { ids: [["5sDJQCG"]] }, // 108: 73
	// のれん（同梱の Base.png の 紺の のれんの 色相を 回す：赤・茶）と だいだいの 日よけ（Base.png の 紅白の 日よけ）
	norenRed: { base: [4, 297], op: "hue:160" },
	norenBrown: { base: [4, 297], op: "hue:200" },
	awningOrange: { base: [1, 366], op: "hue:25" },
	// 街の 小物（set 25）。自販機（赤。青は 色相を 回す）・バス停・郵便受けほか
	vend: {
		ids: [
			["BfW6jCF", "seId8x5"],
			["XMPybTd", "Sm5hIOj"],
		],
	}, // 25: 63 64 / 83 84
	vendBlue: {
		ids: [
			["BfW6jCF", "seId8x5"],
			["XMPybTd", "Sm5hIOj"],
		],
		op: "hue:210",
	}, // 25: 63 64 / 83 84
	busStop: { ids: [["uwu2Mv"], ["mzoxyh"]] }, // 25: 78 / 98
	// 郵便受け・消火器・木箱・木の 手すり
	small25: { ids: [["lPpZiF8", "q0cB3Uj", "MeEnS1", "iNMFDSL"]] }, // 25: 40 74 124 44
	bike: { ids: [["ZqhvMFS", "tCAEynU"]] }, // 25: 184 185
	// 鉢（黄の 花・桃の 花・観葉植物・ヤシ・赤い 花）
	pot: { ids: [["j90awu4", "lPebik6", "KAyy5dw", "Zq04MnD", "IxMsvFo"]] }, // 25: 6 7 10 11 47
	box: { ids: [["uE0W20i", "W1h90Vs"]] }, // 25: 100 101
	planter: { ids: [["0dBBTLN", "N2XZzNR", "2BnMYfX"]] }, // 80: 13 14 15
	fence: { ids: [["oeElvL", "LaApqw", "OGvJb2"]] }, // 25: 175 176 177
	rope: { ids: [["EFZxhkl", "56afQbj"]] }, // 125: 12 13
	redCarpet: { ids: [["AVhesgo"]] }, // 210: 4
	// 車（set 25。正面 2x2・横向き 4x2。W は 左向き・E は 右向き）
	carFront: {
		ids: [
			["9kiFOq", "UQPLm4"],
			["wLifQc", "psukMy"],
		],
	}, // 25: 106 107 / 126 127
	sedanE: {
		ids: [
			["Tv31I3", "LV9pUy", "xBCouY", "xBroMV"],
			["sWR8cS", "upu2V6", "S2CIq5", "kbLKix"],
		],
		op: "flip",
	}, // 25: 143〜146 / 163〜166
	sedanBlueW: {
		ids: [
			["Tv31I3", "LV9pUy", "xBCouY", "xBroMV"],
			["sWR8cS", "upu2V6", "S2CIq5", "kbLKix"],
		],
		op: "hue:200",
	}, // 25: 143〜146 / 163〜166
	// 白い ワゴン（黄色い 車体だけ 灰に）
	wagonWhiteW: {
		ids: [
			["F6cG6Z", "IY1vbe", "WSR0Bc", "nyQqBg"],
			["F6EGaJ", "AqGsI1", "MtRnE6", "cLvu4s"],
		],
		op: "gray:25-75",
	}, // 25: 147〜150 / 167〜170
	wagonE: {
		ids: [
			["F6cG6Z", "IY1vbe", "WSR0Bc", "nyQqBg"],
			["F6EGaJ", "AqGsI1", "MtRnE6", "cLvu4s"],
		],
		op: "flip",
	}, // 25: 147〜150 / 167〜170
	// 手描き（下の drawn）
	redLamp: { drawn: "redLamp" },
	redCross: { drawn: "redCross" },
};

// ───────────────── 施設の 部屋の 部品（public/sprites/rpgen-interior.png。facilities.ts の ri・riCell） ─────────────────
// 1つの 物は 1つの 群（2x2 の 棚・4x2 の 車も 1つ）。並べ方は 外観と 同じ（群の 順に、上から 最初に 入る 所へ）。
//   ids    部品の 並び（行ごと）
//   lift   台の 上に のせる 小物は 何px 上へ ずらして 詰める（下の すき間を 台の 天板に 合わせる。上に 出た 分は 切れる）
//   base   同梱の Base.png の [列, 行, 幅, 高さ] を 切って 詰める（台の 上の 家電など。lift と 組む）
//   parts  部品を 重ねて 1マスに（[id か Base.png の [列, 行], 右へ dx, 下から 上へ dy, 倍率]。倍率は 最近傍で 縮める）
// コメントは 出どころ（セットの 番号: その 中の 番号。「105#35」は セット 105 の 35 番）。
const ROOM_PIECES = {
	// 25: 61 62 / 81 82。白い 金属の 棚に 品物（2x2）
	shelfGoods: { ids: [["seiN8k2", "wFJtfx6"], ["OtK5JKg", "07FFTdM"]] },
	// 25: 65 / 85。飲み物の 冷蔵ケース（1x2）
	drinkCase: { ids: [["BfdTj3t"], ["OtkGJi"]] },
	// 106: 100 101。アイスの 冷凍ケース（2x1）
	iceChest: { ids: [["07gdTS3", "nW8WqEv"]] },
	// 106: 92 93。白い レジ台（2x1）
	whiteCounter: { ids: [["RgPKe9L", "2hTiYrs"]] },
	// 106: 94 95。黄色い 灯りの ケース（ホットスナック）
	yellowCounter: { ids: [["07F5TSj", "LKSlpqX"]] },
	// 106: 96 97。白い 低い 棚（2x1）
	lowShelf: { ids: [["seiN8k2", "wFJtfx6"]] },
	// 106: 112 113
	lowShelfB: { ids: [["OtK5JKg", "07FFTdM"]] },
	// 106: 110 111。木枠の ガラスケース（2x1）
	glassCase: { ids: [["YB1JEfi", "ySs6rTR"]] },
	// 106: 114
	safe: { ids: [["sgid89n"]] },
	// 25: 86。画面と ボタンの 機械（ATM・券売機）
	atm: { ids: [["p5Slkwn"]] },
	// 25: 125。画面つきの レジ（台の 上）
	register: { ids: [["GoZU5Y"]], lift: 5 },
	// 25: 100 / 120。段ボール（黄）
	boxes: { ids: [["uE0W20i"], ["Ix6RvUJ"]] },
	// 25: 101 / 121。段ボール（茶）
	boxesB: { ids: [["W1h90Vs"], ["hwW7BeC"]] },
	// 165: 24
	crate: { ids: [["q0xf3QN"]] },
	// 25: 124
	crateB: { ids: [["MeEnS1"]] },
	// 98: 16。分別ゴミ箱（缶・ペット・燃える）
	binCans: { ids: [["049kTUS"]] },
	// 98: 17
	binPet: { ids: [["YwTaES3"]] },
	// 98: 18
	binBurn: { ids: [["DuZ1Pg"]] },
	// 25: 94
	trash: { ids: [["dJwj453"]] },
	// 25: 74
	extinguisher: { ids: [["q0cB3Uj"]] },
	// 25: 76 / 96。公衆電話（1x2）
	payphone: { ids: [["j93ywdO"], ["HboEVhr"]] },
	// 92: 85 86 87 / 95 96 97。掲示板（3x2・壁）
	corkBoard: { ids: [["U5dkLYT", "ZWPnM1S", "dtjK46I"], ["6bvegYf", "NY6Dzu4", "yvGJr8l"]] },
	// 98: 0 1 2 3 / 8 9 10 11。発車標（4x2・壁）
	departures: { ids: [["8HiIRTh", "SoR5If5", "pAStk7E", "fLJd9UK"], ["Ef1Phcw", "ZWE6Mjj", "IletvXx", "7aUWdA3"]] },
	// 98: 4 5 / 12 13。コインロッカー（2x2）
	lockers: { ids: [["1JGL7Ze", "LQCvpy8"], ["JCKsaK2", "M0h9nSK"]] },
	// 98: 19。点字ブロック（床）
	braille: { ids: [["aS5HtSO"]] },
	// 92: 33
	memo: { ids: [["i4TDG5"]] },
	// 92: 34
	notice: { ids: [["oDYwlAW"]] },
	// 92: 37
	poster: { ids: [["2hZXYM2"]] },
	// 92: 38
	posterB: { ids: [["TdFh1Az"]] },
	// 92: 48 49。横断幕「心技体」（2x1）
	banner: { ids: [["YB18E4t", "SmeBIhr"]] },
	// 92: 53。掛け軸
	scroll: { ids: [["3BmWAf"]] },
	// 92: 58 / 71。体重計（1x2）
	scale: { ids: [["hfpzBpS"], ["58VUQjp"]] },
	// 25: 55。男女の お手洗いの 札
	signRestroom: { ids: [["DVAP5Y"]] },
	// 96: 0
	tvSmall: { ids: [["dtjE4bd"]] },
	// 96: 2 3
	tvBig: { ids: [["fLWE9id", "9p0BFuc"]] },
	// 96: 7
	tvCrt: { ids: [["wUWqf0E"]] },
	// 96: 8
	tvCrtB: { ids: [["uBb2Ml"]] },
	// 95: 2
	console: { ids: [["YwGEml"]] },
	// 201: 3
	guitar: { ids: [["9S1Fw6"]] },
	// 201: 5
	guitarB: { ids: [["c7ZuPV"]] },
	// 201: 14
	records: { ids: [["3dANW5P"]] },
	// 24: 161
	ecg: { ids: [["BbtjiU"]] },
	// 24: 181
	medPanel: { ids: [["VvhXOb"]] },
	// 24: 182
	medPanelB: { ids: [["EV3hjU"]] },
	// 24: 184
	stoolWhite: { ids: [["NdpzjX"]] },
	// 165: 27
	cooler: { ids: [["FL1OGbG"]] },
	// 165: 42
	bucket: { ids: [["dJwj453"]] },
	// 165: 45
	cabinetGreyB: { ids: [["YwTaES3"]] },
	// 24: 146 147。木の 長いす（2x1）
	bench: { ids: [["9UnaFUN", "PcAZNWo"]] },
	// 105: 40 41 42。長い 木の カウンター（3x1）
	counterLong: { ids: [["Jy24ago", "LKqFp8d", "YBRzEfW"]] },
	// 105: 46 47 48
	tableLong: { ids: [["W19A0QY", "86DhRbH", "HbufVOh"]] },
	// 105: 13 14 15
	deskDark: { ids: [["kQYpKqy", "eHF86Ug", "2hIzYWj"]] },
	// 105: 32 33 34
	counterDark: { ids: [["eHib6pH", "5sIRQaE", "4aUtOjj"]] },
	// 105: 51
	roundTable: { ids: [["arYVtwA"]] },
	// 105: 87
	stoolRed: { ids: [["VZ4FXF4"]] },
	// 105: 88
	stoolBrown: { ids: [["RgG3e6A"]] },
	// 105: 62
	chairDarkDown: { ids: [["j93jwZ7"]] },
	// 105: 63
	chairDarkUp: { ids: [["oDsxlAG"]] },
	// 105: 66 67
	sofaWhite: { ids: [["z23VcBZ", "HbuoVav"]] },
	// 105: 68。背中から 見た ひじかけ いす（映画館の 席）
	seatBack: { ids: [["rIstCjf"]] },
	// 80: 3
	bonsai: { ids: [["j9KDwc"]] },
	// 125: 1
	fenceIron: { ids: [["2f8TYSM"]] },
	// 210: 22
	runner: { ids: [["u9wM2hP"]] },
	// 173: 135 136
	stove: { ids: [["yS5brRh", "wFdvfCW"]] },
	// 173: 140 141
	sink: { ids: [["arkbtEe", "j97mw6P"]] },
	// 173: 155 156 157
	cabNavy: { ids: [["86ocR6", "VZzhXCr", "SmsgIbM"]] },
	// 173: 169 170 171
	cabWood: { ids: [["2hWUY6J", "uESe21j", "14FC7A"]] },
	// 173: 89 90 / 109 110
	winBlue: { ids: [["uECS2iG", "sejj8YD"], ["07R8T7B", "HbUFVhc"]] },
	// 209: 14
	flWhite: { ids: [["PjeSNLN"]] },
	// 209: 15
	flBlue: { ids: [["q0n3vW"]] },
	// 209: 18
	flGrey: { ids: [["0OjJTbn"]] },
	// 209: 6
	flRed: { ids: [["9kLF1d"]] },
	// 210: 13。金の 模様の 赤い じゅうたん（まんなかの 1マス）
	flCarpet: { ids: [["9kLF1d"]] },
	// 35: 4
	ramen: { ids: [["KYA5zE"]], lift: 5 },
	// 35: 84。火に かけた 寸胴（コンロの 上）
	potFire: { ids: [["LKvgp8V"]], lift: 2 },
	// 35: 44
	gyoza: { ids: [["14BJ78G"]], lift: 4 },
	// 35: 16
	yakitori: { ids: [["86IqRgq"]], lift: 3 },
	// 35: 5
	sakeSet: { ids: [["VZZEXY7"]], lift: 4 },
	// 35: 21
	sakeBottle: { ids: [["5st4QP5"]], lift: 5 },
	// 35: 20
	condiments: { ids: [["hwneBp8"]], lift: 5 },
	// 109: 56
	yakisoba: { ids: [["TaSP1L1"]], lift: 4 },
	// 35: 85
	beer: { ids: [["FL9FGi4"]], lift: 5 },
	// 35: 117
	wine: { ids: [["16a712"]], lift: 5 },
	// 109: 59
	ramune: { ids: [["uwU62aV"]], lift: 5 },
	// 109: 54
	ramuneTub: { ids: [["i2jLDZl"]] },
	// 109: 24。「氷」の のぼり（壁）
	iceFlag: { ids: [["Nh9czgx"]] },
	// 109: 53
	kakigoriMachine: { ids: [["Hq1aVhJ"]], lift: 4 },
	// 108: 22。白い 枠の 水色の 窓（壁の 上段）
	winModern: { ids: [["p5JNk7z"]] },
	// 108: 14。水色の ガラス（鏡の 壁）
	mirror: { ids: [["JKZaGM"]] },
	// 92: 17。脚つきの 白い 札
	standSign: { ids: [["KR1354f"]] },
	// 25: 143 144 145 146 / 163 164 165 166。赤い セダン（横向き 4x2）
	sedan: { ids: [["Tv31I3", "LV9pUy", "xBCouY", "xBroMV"], ["sWR8cS", "upu2V6", "S2CIq5", "kbLKix"]] },
	// 25: 147 148 149 150 / 167 168 169 170
	wagon: { ids: [["F6cG6Z", "IY1vbe", "WSR0Bc", "nyQqBg"], ["F6EGaJ", "AqGsI1", "MtRnE6", "cLvu4s"]] },
	// 25: 184 185
	bike: { ids: [["ZqhvMFS", "tCAEynU"]] },
	// 25: 63 64 / 83 84
	vend: { ids: [["BfW6jCF", "seId8x5"], ["XMPybTd", "Sm5hIOj"]] },
	// 24: 185
	jerrycan: { ids: [["N4izSX"]] },
	// 35: 93
	kettle: { ids: [["Nu3azlI"]], lift: 5 },
	// 106: 18。呼び鈴（台の 上）
	bell: { ids: [["6VUsgrw"]], lift: 4 },
	// 201: 15
	taiko: { ids: [["nOcNqyS"]] },
	// 24: 126 127。シャッター（2x1・壁の 下段）
	shutter: { ids: [["ZqfvM1i", "Bf0vjMO"]] },
	// 165: 28
	toolboxTop: { ids: [["p5Orkv8"]], lift: 5 },
	// 165: 16
	pcTop: { ids: [["BGzCjOu"]], lift: 4 },
	// 201: 10
	turntableTop: { ids: [["LAz4pc0"]], lift: 5 },
	// 201: 6
	radioTop: { ids: [["ouc9lk0"]], lift: 4 },
	// 105: 25
	podium: { ids: [["KAax5F0"]] },
	// 102: 21 / 22
	pole: { ids: [["rxFnCCT"], ["YfVIEbv"]] },
	// 105#35 17#33 17#32 17#33 17#32
	goban: { parts: [["AeSsDg", 0, 0], ["se6m8ki", 3, 8, 0.375], ["kQAyKOC", 7, 9, 0.375], ["se6m8ki", 9, 7, 0.375], ["kQAyKOC", 5, 6, 0.375]] },
	// base base base base
	dumbbells: { parts: [[[2, 108], 0, 0], [[0, 342], 1, 7, 0.5], [[0, 342], 8, 7, 0.5], [[1, 342], 4, 9, 0.5]] },
	// 105#36 17#30 17#29
	shogiban: { parts: [["MWXnQk", 0, 0], ["Pcu3NWE", 3, 8, 0.5], ["bkPZxC", 8, 6, 0.5]] },
	// Base.png
	laptop: { base: [4, 396], lift: 5 },
	// Base.png
	kettleBase: { base: [6, 138], lift: 5 },
	// Base.png
	phone: { base: [5, 394], lift: 4 },
	// Base.png
	riceCooker: { base: [0, 396], lift: 4 },
	// Base.png
	coffeeMaker: { base: [6, 394], lift: 3 },
	// ── ファミレス（窓ぎわの ボックス席・ドリンクバー）
	// 105: 55。背もたれが 左の ソファ（右を 向いて すわる）
	boothR: { ids: [["YBT2ESN"]] },
	// 105: 56。背もたれが 右の ソファ（左を 向いて すわる）
	boothL: { ids: [["3TwMWS7"]] },
	// 105: 24。ボックス席の 机
	tableBeige: { ids: [["ksiPKOV"]] },
	// 35: 3。鉄板の ハンバーグ（机の 上）
	hamburg: { ids: [["DJNP1D"]], lift: 3 },
	// 35: 1。オムライス（机の 上）
	omurice: { ids: [["qPJ3UQ"]], lift: 3 },
	// 35: 42。空の グラス 2つ（机・台の 上）
	glasses: { ids: [["Rgvge6h"]], lift: 3 },
	// 196: 60。ショートケーキ（机の 上）
	cake: { ids: [["9OZF4f"]], lift: 3 },
	// 35: 120。メロンソーダ（台の 上）
	melonSoda: { ids: [["VZYYXqZ"]], lift: 4 },
	// 209: 7。明るい 板の 床
	flWoodLight: { ids: [["uFsw2GE"]] },
	// ── 飲食店（data/village/eateries.ts。立ち食いそば・牛丼・居酒屋・寿司・中華）
	// 173: 137 138。黒い ガスコンロ（2x1）
	stoveBlack: { ids: [["Pcb7NwJ", "yS5Hr8E"]] },
	// 173: 148 149。広い 流し（2x1）
	sink2: { ids: [["ml6oxp9", "86o8RE7"]] },
	// 173: 157 158 159。紺の 戸棚（引き出し）
	cabNavyB: { ids: [["SmsgIbM", "p5rvkv1", "Tdf91TW"]] },
	// 173: 162 163 164。赤い 戸棚
	cabRed: { ids: [["eHiR6wk", "OtLdJAC", "2h3zYAz"]] },
	// 106: 98
	fridgeWhite: { ids: [["4ykuOVt"]] },
	// 106: 115
	fridgeSilver: { ids: [["JCfazN"]] },
	// 106: 10。重ねた 皿（台の 上）
	plateStack: { ids: [["oD4clAM"]], lift: 3 },
	// 106: 51 52。酒瓶の 棚（2x1）
	shelfBottles: { ids: [["iNhnDvV", "hwp7BpN"]] },
	// 106: 59 / 64。本棚 2
	bookshelf: { ids: [["YFbES4", "2hq6YeP"]] },
	// 96: 9 10。台に のった 大きな テレビ（2x1）
	tvGame: { ids: [["fLWY9Jb", "TOYZ1S2"]] },
	// 105: 90
	stoolOrange: { ids: [["JrUaKI"]] },
	// 105: 52
	stoolSmall: { ids: [["TdDf1T2"]] },
	// 105: 73
	chairRed: { ids: [["eH1a6Rm"]] },
	// 92: 36。字の 書いた 紙（壁）
	paperNote: { ids: [["Dz6gPb0"]] },
	// 109: 46 47 48。生け簀（3x1）
	fishTank: { ids: [["V31gXkC", "ocEvlvo", "drv044t"]] },
	// 165: 70
	barrel: { ids: [["wFI4fnh"]] },
	// 165: 28。ビールケース（床）
	bottleCrate: { ids: [["p5Orkv8"]] },
	// 209: 0。濃い 板の 床
	flDarkWood: { ids: [["lPgqiKQ"]] },
	// 209: 2。白い 格子の タイル
	flBeige: { ids: [["z2rncZX"]] },
	// 209: 11。畳（小上がり）
	flTatami: { ids: [["OyaJmV"]] },
	// 130: 26。たぬきそば（台の 上）
	tanuki: { ids: [["l2VXiKn"]], lift: 4 },
	// 130: 25。きつねそば（台の 上）
	kitsune: { ids: [["rlAACtA"]], lift: 4 },
	// 130: 22。コロッケ（台の 上）
	korokke: { ids: [["1yFw7V3"]], lift: 3 },
	// 35: 63。牛丼（台の 上）
	gyudon: { ids: [["SmKUI2f"]], lift: 4 },
	// 130: 24。みその 鉢（台の 上）
	motsu: { ids: [["0afwTul"]], lift: 4 },
	// 35: 118。ジョッキ（台の 上）
	beerMug: { ids: [["wlpfnP"]], lift: 3 },
	// 35: 57。握り（台の 上）
	maguro: { ids: [["voQfmH7"]], lift: 4 },
	// 35: 26。枝豆（台の 上）
	edamame: { ids: [["5stVQbQ"]], lift: 4 },
	// 35: 7。エビチリ（台の 上）
	ebichili: { ids: [["14E17GG"]], lift: 3 },
	// 130: 28。麻婆豆腐（台の 上）
	mabo: { ids: [["VWcYXYR"]], lift: 4 },
	// 35: 11。チャーハン（台の 上）
	chahan: { ids: [["ySUvrWF"]], lift: 4 },
};

// ───────────────── 飲食店の 品（public/sprites/rpgen-food.png。data/eateries.ts の 出てきた 一品の 絵） ─────────────────
// 台に のせない ので ずらさない（ui/eat.ts が 大きく 描く）。たこ焼きは RPGEN に ないので 手描き（drawn）。
const FOOD = {
	takoyaki: { drawn: "takoyaki" },
	ramune: { ids: [["uwU62aV"]] }, // 109: 59
	kake: { ids: [["ndhYqrs"]] }, // 130: 23
	kitsune: { ids: [["rlAACtA"]] }, // 130: 25
	tanuki: { ids: [["l2VXiKn"]] }, // 130: 26
	tsukimi: { ids: [["zjnVcAU"]] }, // 130: 20
	korokke: { ids: [["1yFw7V3"]] }, // 130: 22
	ramen: { ids: [["rIp9Cjm"]] }, // 35: 62
	ramenRed: { ids: [["KYA5zE"]] }, // 35: 4
	gyoza: { ids: [["14BJ78G"]] }, // 35: 44
	gyudon: { ids: [["SmKUI2f"]] }, // 35: 63
	motsu: { ids: [["0afwTul"]] }, // 130: 24
	yakitori: { ids: [["86IqRgq"]] }, // 35: 16
	edamame: { ids: [["5stVQbQ"]] }, // 35: 26
	fried: { ids: [["ZqDbMHE"]] }, // 35: 6
	orange: { ids: [["dJkd4GE"]] }, // 35: 110
	saba: { ids: [["ZqNmM14"]], op: "hue:190" }, // 35: 60（中トロを 青い 鯖色に）
	ikura: { ids: [["z2VAcup"]] }, // 35: 59
	uni: { ids: [["cYXAuu1"]] }, // 35: 58
	maguro: { ids: [["voQfmH7"]] }, // 35: 57
	mabo: { ids: [["VWcYXYR"]] }, // 130: 28
	chahan: { ids: [["ySUvrWF"]] }, // 35: 11
	ebichili: { ids: [["14E17GG"]] }, // 35: 7
	tenshin: { ids: [["FQaCGmc"]] }, // 130: 29
};

// ───────────────── 最小 PNG（書き: RGBA 8bit。読み: 非インターレースの 灰・RGB・パレット・灰＋α・RGBA） ─────────────────

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
const crc32 = (buf) => {
	let c = 0xffffffff;
	for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(td));
	return Buffer.concat([len, td, crc]);
};
const encodePng = (w, h, rgba) => {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0);
	ihdr.writeUInt32BE(h, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	const raw = Buffer.alloc((w * 4 + 1) * h);
	for (let y = 0; y < h; y++) {
		raw[y * (w * 4 + 1)] = 0;
		rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
};
const paeth = (a, b, c) => {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
/** 色の 形 → 1画素の 値の 数（0 灰・2 RGB・3 パレット・4 灰＋α・6 RGBA）。 */
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const decodePng = (buf, name) => {
	let p = 8;
	let w = 0;
	let h = 0;
	let depth = 0;
	let ctype = 0;
	let plte = null;
	let trns = null;
	const idat = [];
	while (p < buf.length) {
		const len = buf.readUInt32BE(p);
		const type = buf.toString("ascii", p + 4, p + 8);
		const data = buf.subarray(p + 8, p + 8 + len);
		if (type === "IHDR") {
			w = data.readUInt32BE(0);
			h = data.readUInt32BE(4);
			depth = data[8];
			ctype = data[9];
			if (data[12]) throw new Error(`${name}: インターレースは 読めません`);
		} else if (type === "PLTE") plte = data;
		else if (type === "tRNS") trns = data;
		else if (type === "IDAT") idat.push(data);
		p += 12 + len;
	}
	const chans = CHANNELS[ctype];
	const subByte = ctype === 0 || ctype === 3;
	if (!chans || depth > 8 || (!subByte && depth !== 8))
		throw new Error(`${name}: 色の 形 ${ctype}/${depth} は 読めません`);
	const bpp = Math.max(1, (chans * depth) >> 3);
	const stride = Math.ceil((w * chans * depth) / 8);
	const raw = inflateSync(Buffer.concat(idat));
	const lines = Buffer.alloc(stride * h);
	for (let y = 0; y < h; y++) {
		const f = raw[y * (stride + 1)];
		const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
		const cur = lines.subarray(y * stride, (y + 1) * stride);
		const prev = y ? lines.subarray((y - 1) * stride, y * stride) : null;
		for (let i = 0; i < stride; i++) {
			const a = i >= bpp ? cur[i - bpp] : 0;
			const b = prev ? prev[i] : 0;
			const c = prev && i >= bpp ? prev[i - bpp] : 0;
			const add = [0, a, b, (a + b) >> 1, paeth(a, b, c)][f];
			cur[i] = (src[i] + add) & 255;
		}
	}
	// 1バイトに 満たない 値（1・2・4bit）は 左の 画素から 上の ビットに 詰まっている
	const sample = (line, x) => {
		if (depth === 8) return line[x];
		const per = 8 / depth;
		return (
			(line[Math.floor(x / per)] >> (8 - depth * ((x % per) + 1))) &
			((1 << depth) - 1)
		);
	};
	const maxV = (1 << depth) - 1;
	const rgba = Buffer.alloc(w * h * 4);
	for (let y = 0; y < h; y++) {
		const line = lines.subarray(y * stride, (y + 1) * stride);
		for (let x = 0; x < w; x++) {
			const o = (y * w + x) * 4;
			if (ctype === 3) {
				const idx = sample(line, x);
				plte.copy(rgba, o, idx * 3, idx * 3 + 3);
				rgba[o + 3] = trns && idx < trns.length ? trns[idx] : 255;
			} else if (ctype === 0) {
				const v = sample(line, x);
				const g = Math.round((v * 255) / maxV);
				rgba[o] = g;
				rgba[o + 1] = g;
				rgba[o + 2] = g;
				// tRNS は 透明に する 灰の 値（2バイト）
				rgba[o + 3] = trns && trns.readUInt16BE(0) === v ? 0 : 255;
			} else if (ctype === 2) {
				line.copy(rgba, o, x * 3, x * 3 + 3);
				// tRNS は 透明に する 色（R・G・B 2バイトずつ）
				const key =
					trns &&
					trns.readUInt16BE(0) === line[x * 3] &&
					trns.readUInt16BE(2) === line[x * 3 + 1] &&
					trns.readUInt16BE(4) === line[x * 3 + 2];
				rgba[o + 3] = key ? 0 : 255;
			} else if (ctype === 4) {
				rgba[o] = line[x * 2];
				rgba[o + 1] = line[x * 2];
				rgba[o + 2] = line[x * 2];
				rgba[o + 3] = line[x * 2 + 1];
			} else line.copy(rgba, o, x * 4, x * 4 + 4);
		}
	}
	return { w, h, rgba };
};

// ───────────────── 加工 ─────────────────

/** 16x16 の 絵（RGBA）。 */
const CELL = 16;
const blank = (w, h) => ({ w, h, rgba: Buffer.alloc(w * h * 4) });
/** 上に 重ねる（α で まぜる。dst の 外に 出た 分は 切る）。 */
const paste = (dst, src, dx, dy) => {
	for (let y = 0; y < src.h; y++)
		for (let x = 0; x < src.w; x++) {
			const s = (y * src.w + x) * 4;
			const a = src.rgba[s + 3];
			if (!a) continue;
			const tx = dx + x;
			const ty = dy + y;
			if (tx < 0 || ty < 0 || tx >= dst.w || ty >= dst.h) continue;
			const d = (ty * dst.w + tx) * 4;
			if (a === 255) {
				src.rgba.copy(dst.rgba, d, s, s + 4);
				continue;
			}
			const da = dst.rgba[d + 3];
			const oa = a + (da * (255 - a)) / 255;
			for (let k = 0; k < 3; k++)
				dst.rgba[d + k] = Math.round(
					(src.rgba[s + k] * a +
						(dst.rgba[d + k] * da * (255 - a)) / 255) /
						oa,
				);
			dst.rgba[d + 3] = Math.round(oa);
		}
};
/** 切り出す（x, y, w, h は 画素）。 */
const crop = (img, x0, y0, w, h) => {
	const out = blank(w, h);
	for (let y = 0; y < h; y++)
		img.rgba.copy(
			out.rgba,
			y * w * 4,
			((y0 + y) * img.w + x0) * 4,
			((y0 + y) * img.w + x0 + w) * 4,
		);
	return out;
};
/** 最近傍で n×n に 縮める（画素の まんなかで 拾う。Python の Pillow の NEAREST と 同じ 画素を 拾う）。 */
const shrink = (img, n) => {
	const out = blank(n, n);
	const sx = img.w / n;
	const sy = img.h / n;
	for (let y = 0; y < n; y++)
		for (let x = 0; x < n; x++) {
			const s = (Math.floor((y + 0.5) * sy) * img.w + Math.floor((x + 0.5) * sx)) * 4;
			img.rgba.copy(out.rgba, (y * n + x) * 4, s, s + 4);
		}
	return out;
};
const flip = (img) => {
	const out = blank(img.w, img.h);
	for (let y = 0; y < img.h; y++)
		for (let x = 0; x < img.w; x++)
			img.rgba.copy(
				out.rgba,
				(y * img.w + (img.w - 1 - x)) * 4,
				(y * img.w + x) * 4,
				(y * img.w + x) * 4 + 4,
			);
	return out;
};
// 色相の 計算は Python の colorsys（HLS）と 同じ（下見の 絵と そろえる）
const rgbToHls = (r, g, b) => {
	const mx = Math.max(r, g, b);
	const mn = Math.min(r, g, b);
	const l = (mx + mn) / 2;
	if (mx === mn) return [0, l, 0];
	const range = mx - mn;
	const s = l <= 0.5 ? range / (mx + mn) : range / (2 - mx - mn);
	const rc = (mx - r) / range;
	const gc = (mx - g) / range;
	const bc = (mx - b) / range;
	const h = r === mx ? bc - gc : g === mx ? 2 + rc - bc : 4 + gc - rc;
	return [(((h / 6) % 1) + 1) % 1, l, s];
};
const hlsV = (m1, m2, hue) => {
	const h = ((hue % 1) + 1) % 1;
	if (h < 1 / 6) return m1 + (m2 - m1) * h * 6;
	if (h < 0.5) return m2;
	if (h < 2 / 3) return m1 + (m2 - m1) * (2 / 3 - h) * 6;
	return m1;
};
const hlsToRgb = (h, l, s) => {
	if (s === 0) return [l, l, l];
	const m2 = l <= 0.5 ? l * (1 + s) : l + s - l * s;
	const m1 = 2 * l - m2;
	return [hlsV(m1, m2, h + 1 / 3), hlsV(m1, m2, h), hlsV(m1, m2, h - 1 / 3)];
};
const eachPixel = (img, fn) => {
	const out = blank(img.w, img.h);
	img.rgba.copy(out.rgba);
	for (let o = 0; o < out.rgba.length; o += 4) {
		if (!out.rgba[o + 3]) continue;
		const c = fn(out.rgba[o], out.rgba[o + 1], out.rgba[o + 2]);
		if (!c) continue;
		out.rgba[o] = c[0];
		out.rgba[o + 1] = c[1];
		out.rgba[o + 2] = c[2];
	}
	return out;
};
const hue = (img, deg) =>
	eachPixel(img, (r, g, b) => {
		const [h, l, s] = rgbToHls(r / 255, g / 255, b / 255);
		if (s < 0.15) return null;
		return hlsToRgb((h + deg / 360) % 1, l, s).map((v) => Math.trunc(v * 255));
	});
const tint = (img, hex) => {
	const c = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
	return eachPixel(img, (r, g, b) => {
		const l = Math.min(1, ((r * 0.3 + g * 0.59 + b * 0.11) / 255) * 1.35);
		return c.map((v) => Math.trunc(v * l));
	});
};
/** 色相が from〜to 度の 色だけ 灰に（明るさは 少し 上げる。黄色い 車を 白く する）。 */
const gray = (img, from, to) =>
	eachPixel(img, (r, g, b) => {
		const [h, l, s] = rgbToHls(r / 255, g / 255, b / 255);
		const d = h * 360;
		if (s < 0.15 || d < from || d > to) return null;
		const v = Math.min(255, Math.trunc(l * 255 * 1.25));
		return [v, v, Math.min(255, v + 4)];
	});
/** 加工（「flip+hue:30」の ように + で つなぐと 順に かける）。 */
const applyOp = (img, op) => {
	if (!op) return img;
	return op.split("+").reduce((im, o) => {
		if (o === "flip") return flip(im);
		if (o.startsWith("hue:")) return hue(im, Number(o.slice(4)));
		if (o.startsWith("tint:")) return tint(im, o.slice(5));
		if (o.startsWith("gray:")) {
			const [from, to] = o.slice(5).split("-").map(Number);
			return gray(im, from, to);
		}
		throw new Error(`知らない 加工: ${o}`);
	}, img);
};

// ───────────────── 手描き ─────────────────

const rgb = (hex) => [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const dot = (img, x, y, hex) => {
	const o = (y * img.w + x) * 4;
	const [r, g, b] = rgb(hex);
	img.rgba[o] = r;
	img.rgba[o + 1] = g;
	img.rgba[o + 2] = b;
	img.rgba[o + 3] = 255;
};
const DRAWN = {
	/** 赤い 灯り（交番・警察署・消防の 壁に 付ける 丸い ランプ。下に 金具）。 */
	redLamp: () => {
		const img = blank(CELL, CELL);
		const rows = { 3: [6, 9], 4: [5, 10], 5: [4, 11], 6: [4, 11], 7: [4, 11], 8: [5, 10] };
		for (const [y, [a, b]] of Object.entries(rows))
			for (let x = a; x <= b; x++) dot(img, x, Number(y), "d2201c");
		for (let x = 5; x <= 10; x++) dot(img, x, 9, "6e1010");
		for (const [x, y] of [
			[4, 8],
			[11, 8],
			[4, 7],
			[11, 7],
		])
			dot(img, x, y, "6e1010");
		for (const [x, y] of [
			[6, 4],
			[6, 5],
			[7, 4],
		])
			dot(img, x, y, "ff8c78");
		for (let x = 6; x <= 9; x++) dot(img, x, 10, "8c8c94");
		for (const y of [11, 12]) for (const x of [7, 8]) dot(img, x, y, "5a5a62");
		for (let x = 5; x <= 10; x++) dot(img, x, 13, "5a5a62");
		return img;
	},
	/** 赤十字（病院。白い 板に 赤い 十字）。 */
	redCross: () => {
		const img = blank(CELL, CELL);
		for (let y = 2; y <= 13; y++)
			for (let x = 2; x <= 13; x++)
				dot(img, x, y, x === 2 || x === 13 || y === 2 || y === 13 ? "96969e" : "f6f6f6");
		for (let y = 4; y <= 11; y++) for (let x = 6; x <= 9; x++) dot(img, x, y, "d42424");
		for (let y = 6; y <= 9; y++) for (let x = 4; x <= 11; x++) dot(img, x, y, "d42424");
		for (let x = 6; x <= 9; x++) dot(img, x, 11, "a01616");
		for (const x of [4, 5, 10, 11]) dot(img, x, 9, "a01616");
		return img;
	},
	/** たこ焼き（舟皿に 6こ。ソース・マヨ・青のり）。 */
	takoyaki: () => {
		const img = blank(CELL, CELL);
		const pal = {
			k: "402412",
			b: "e2be80",
			B: "b88e56",
			o: "cc782c",
			O: "f4b860",
			s: "602e14",
			m: "fcf6e6",
			g: "489c34",
		};
		const rows = [
			"",
			"",
			"",
			".kkk..kkk..kkk..",
			"kOsmkkOsmkkOsmk.",
			"kssskkssskksssk.",
			"kokkkkokkkkokkk.",
			".kOsmkkOsmkkOsmk",
			".kssskkssskksssk",
			".kogokkogokkogok",
			"..kkk..kkk..kkk.",
			"kbbbbbbbbbbbbbbk",
			"kBBBBBBBBBBBBBBk",
			".kkkkkkkkkkkkkk.",
		];
		rows.forEach((r, y) => {
			[...r].forEach((c, x) => {
				if (pal[c]) dot(img, x, y, pal[c]);
			});
		});
		return img;
	},
};

// ───────────────── 取りこみ ─────────────────

const arg = (name) => {
	const i = process.argv.indexOf(name);
	return i >= 0 ? process.argv[i + 1] : undefined;
};
const cacheDir = arg("--cache") ? resolve(arg("--cache")) : undefined;
if (cacheDir) mkdirSync(cacheDir, { recursive: true });

const fetchPiece = async (id) => {
	const local = cacheDir && join(cacheDir, `${id}.png`);
	if (local && existsSync(local)) return readFileSync(local);
	const res = await fetch(`${CDN}${id}.png`);
	if (!res.ok) throw new Error(`${id}: ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	if (local) writeFileSync(local, buf);
	return buf;
};

/** 部屋の 部品が 使う RPGEN の id（ids と parts の 中の 文字列）。 */
const roomIds = (p) => [
	...(p.ids ? p.ids.flat().filter(Boolean) : []),
	...(p.parts ?? []).map((q) => q[0]).filter((s) => typeof s === "string"),
];
const ids = [
	...new Set([
		...Object.values(GROUPS).flatMap((g) => (g.ids ? g.ids.flat() : [])),
		...Object.values(ROOM_PIECES).flatMap(roomIds),
		...Object.values(FOOD).flatMap((g) => (g.ids ? g.ids.flat() : [])),
	]),
];
const pieces = new Map();
for (let i = 0; i < ids.length; i += 16)
	await Promise.all(
		ids.slice(i, i + 16).map(async (id) => {
			const img = decodePng(await fetchPiece(id), id);
			if (img.w !== CELL || img.h !== CELL)
				throw new Error(`${id}: ${img.w}x${img.h}（16x16 では ない）`);
			pieces.set(id, img);
		}),
	);
const BASE = decodePng(readFileSync(BASE_PNG), "Base.png");
/** Base.png の (c, r) マスから w×h マス。 */
const baseCut = (c, r, w = 1, h = 1) =>
	crop(BASE, c * CELL, r * CELL, w * CELL, h * CELL);

// ───────────────── 詰める ─────────────────

const COLS = 16;
/**
 * 群を アトラスに 置く（群の 順に、上から・左から 最初に 入る 所へ）。size は 群の [幅, 高さ]（マス）、
 * draw は 群の 絵。返すのは 群の 名前 → [列, 行, 幅, 高さ] と アトラスの 絵。
 */
const packAtlas = (groups, size, draw) => {
	const used = [];
	const free = (c, r, w, h) => {
		for (let y = r; y < r + h; y++) {
			while (used.length <= y) used.push(new Array(COLS).fill(false));
			for (let x = c; x < c + w; x++) if (x >= COLS || used[y][x]) return false;
		}
		return true;
	};
	const cells = {};
	for (const [name, g] of Object.entries(groups)) {
		const [w, h] = size(g);
		let spot = null;
		for (let r = 0; !spot; r++)
			for (let c = 0; c < COLS && !spot; c++) if (free(c, r, w, h)) spot = [c, r];
		const [c, r] = spot;
		for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) used[y][x] = true;
		cells[name] = [c, r, w, h];
	}
	const atlas = blank(COLS * CELL, used.length * CELL);
	for (const [name, g] of Object.entries(groups)) {
		const [c, r, w, h] = cells[name];
		paste(atlas, draw(g, w, h), c * CELL, r * CELL);
	}
	return { cells, atlas };
};

/** 部品の 並び（行ごと）を 1枚に（lift px 上へ ずらす。上に 出た 分は 切れる）。 */
const drawIds = (rows, w, h, lift = 0) => {
	const img = blank(w * CELL, h * CELL);
	rows.forEach((row, y) => {
		row.forEach((id, x) => {
			if (id) paste(img, pieces.get(id), x * CELL, y * CELL - lift);
		});
	});
	return img;
};

/** 外観・品の 群の 絵（手描き・Base.png から 切る・部品の 並び。どれも 加工 op を かけられる）。 */
const groupSize = (g) =>
	g.ids ? [Math.max(...g.ids.map((r) => r.length)), g.ids.length] : [1, 1];
const drawGroup = (g, w, h) => {
	if (g.drawn) return DRAWN[g.drawn]();
	if (g.base) return applyOp(baseCut(...g.base), g.op);
	return applyOp(drawIds(g.ids, w, h), g.op);
};
const modern = packAtlas(GROUPS, groupSize, drawGroup);
const food = packAtlas(FOOD, groupSize, drawGroup);
const room = packAtlas(
	ROOM_PIECES,
	(p) => {
		if (p.base) return [p.base[2] ?? 1, p.base[3] ?? 1];
		if (p.parts) return [1, 1];
		return [Math.max(...p.ids.map((r) => r.length)), p.ids.length];
	},
	(p, w, h) => {
		if (p.ids) return drawIds(p.ids, w, h, p.lift);
		const img = blank(w * CELL, h * CELL);
		if (p.base) {
			paste(img, baseCut(...p.base), 0, -(p.lift ?? 0));
			return img;
		}
		// 部品を 重ねる（下はしを マスの 下から dy 上に そろえる）
		for (const [src, dx, dy, scale = 1] of p.parts) {
			let part = typeof src === "string" ? pieces.get(src) : baseCut(src[0], src[1]);
			if (scale !== 1) part = shrink(part, Math.trunc(CELL * scale));
			paste(img, part, dx, CELL - part.h - dy);
		}
		return img;
	},
);
mkdirSync(dirname(OUT_PNG), { recursive: true });
writeFileSync(OUT_PNG, encodePng(modern.atlas.w, modern.atlas.h, modern.atlas.rgba));
writeFileSync(OUT_ROOM_PNG, encodePng(room.atlas.w, room.atlas.h, room.atlas.rgba));
writeFileSync(OUT_FOOD_PNG, encodePng(food.atlas.w, food.atlas.h, food.atlas.rgba));

// ───────────────── 索引（TS） ─────────────────

const cellList = (cells) =>
	Object.entries(cells)
		.map(([n, v]) => `\t${n}: [${v.join(", ")}],`)
		.join("\n");
const ts = `// scripts/pack-rpgen.mjs が 書き出す（手で 書きかえない。部品を かえる ときは pack-rpgen.mjs の GROUPS・ROOM_PIECES・FOOD）。
// 絵は RPGEN（https://rpgen.us/）の スプライトセットから 選んで まとめた もの
// （検索: https://rpgen-search.pages.dev/）。赤い 灯り・赤十字・たこ焼きの 3つだけ 手描き。
// 部屋の 絵の 少し（台の 上の 家電・ダンベル）と 外観の のれん・日よけの 色がえは 同梱の Base.png から 切って 詰めた もの。

/** まとめた 絵（public/sprites/rpgen-modern.png。${modern.atlas.w}x${modern.atlas.h}）。施設の 外観・街の 物。 */
export const RPGEN_IMG = "pub:sprites/rpgen-modern.png";
export const RPGEN_SIZE = [${modern.atlas.w}, ${modern.atlas.h}] as const;

/** 群の 名前 → [列, 行, 幅, 高さ]（アトラスの マス）。 */
export const RPGEN_CELLS = {
${cellList(modern.cells)}
} as const;

export type RpgenName = keyof typeof RPGEN_CELLS;

/**
 * 群の 中の (x, y) マスから w×h マス。縦に 2マスの 物は h=2 で 16x32 に 切る
 * （下端そろえで 上の マスへ はみ出す。data/village/tiles.ts の 書き方と 同じ）。
 */
export const art = (name: RpgenName, x = 0, y = 0, w = 1, h = 1): string => {
\tconst [c, r] = RPGEN_CELLS[name];
\treturn \`\${RPGEN_IMG}#\${(c + x) * 16},\${(r + y) * 16},\${w * 16},\${h * 16}\`;
};

/** 部屋の 家具・小物を まとめた 絵（public/sprites/rpgen-interior.png。${room.atlas.w}x${room.atlas.h}）。施設の 中。 */
export const ROOM_IMG = "pub:sprites/rpgen-interior.png";
export const ROOM_SIZE = [${room.atlas.w}, ${room.atlas.h}] as const;

/** 物の 名前 → [列, 行, 幅, 高さ]（アトラスの マス）。 */
export const ROOM_CELLS = {
${cellList(room.cells)}
} as const;

export type RoomArtName = keyof typeof ROOM_CELLS;

/**
 * 物の col 列目を 下まで 1本（16 × 物の 高さ）。背の 高い 物（冷蔵ケース・ロッカー）は 下端そろえで
 * 上の マスへ はみ出して 描かれる（壁ぎわに 置くと 壁の 上段に 立つ）。
 */
export const ri = (name: RoomArtName, col = 0): string => {
\tconst [c, r, , h] = ROOM_CELLS[name];
\treturn \`\${ROOM_IMG}#\${(c + col) * 16},\${r * 16},16,\${h * 16}\`;
};

/** 物の (col, row) の 1マス（16x16）。幅の ある 物（台・車）は マスごとに 置く（となりへ はみ出さない）。 */
export const riCell = (name: RoomArtName, col: number, row: number): string => {
\tconst [c, r] = ROOM_CELLS[name];
\treturn \`\${ROOM_IMG}#\${(c + col) * 16},\${(r + row) * 16},16,16\`;
};

/** 飲食店の 品（public/sprites/rpgen-food.png。${food.atlas.w}x${food.atlas.h}）。出てきた 一品の 絵（ui/eat.ts）。たこ焼きは 手描き。 */
export const FOOD_IMG = "pub:sprites/rpgen-food.png";
export const FOOD_SIZE = [${food.atlas.w}, ${food.atlas.h}] as const;

/** 品の 名前 → [列, 行, 幅, 高さ]（アトラスの マス）。 */
export const FOOD_CELLS = {
${cellList(food.cells)}
} as const;

export type FoodName = keyof typeof FOOD_CELLS;

/** 品の 絵（16x16）。 */
export const food = (name: FoodName): string => {
\tconst [c, r] = FOOD_CELLS[name];
\treturn \`\${FOOD_IMG}#\${c * 16},\${r * 16},16,16\`;
};
`;
writeFileSync(OUT_TS, ts);
console.log(
	`${OUT_PNG}（${modern.atlas.w}x${modern.atlas.h}・群 ${Object.keys(modern.cells).length}）`,
);
console.log(
	`${OUT_ROOM_PNG}（${room.atlas.w}x${room.atlas.h}・物 ${Object.keys(room.cells).length}）`,
);
console.log(
	`${OUT_FOOD_PNG}（${food.atlas.w}x${food.atlas.h}・品 ${Object.keys(food.cells).length}）`,
);
console.log(`部品 ${ids.length}`);
console.log(OUT_TS);
