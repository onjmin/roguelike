// 町の 役所（町が 育つと 建つ 寄り道。CIVIC.md の 施設）。書き方は facilities.ts と 同じで、facilities.ts の
// FACILITIES の いちばん うしろ（飲食店の さらに うしろ）に 足す（外観の 字は 並び順で 割りふるので、いまの 字を ずらさない）。
//
//   段4〜6 保守町役場（北の 通りの 上 x63〜69。東の 縦の 大通りの 北の 突きあたり。扉 (66,7)）
//   段7   保守市役所（同じ 所で 建てかえ。奥が 市議会の 議場、手前が 窓口）
//
// 置き場所：牛丼「つゆだく」（段5〜、x47〜51）が CIVIC の 予定地 x46〜52 を ふさいだので、段4〜7 に ずっと 空いて
// いる 7マスの 区画 x63〜69 y3〜7 に 置く（裁判所 x53〜62 の となり。三権の 並び）。7マスの 空きは ここ だけなので、
// 段7 の 議事堂は 別の 建物に せず、市役所の 中の 議場に する（ENGINE.md §9）。
// 中の 物：演壇＝討論会（模擬議会の カンペ係）・はり紙＝見分け方・議事録＝模擬議会の 号（どれも ui/debate.ts）。
// 議題と 派閥は ぜんぶ 架空の 村の 話。保守神社は 出さない。強さには 何も 効かない。
// 絵は RPGEN の 部品（rpgenArt.ts の art・ri・riCell）と 同梱の Base.png。
// ここからは facilities.ts の 値を 読まない（facilities.ts が ここを 読むので、まわりこむと 読みこみの 順で こわれる）。

import type { Facility, RoomLook } from "./facilities";
import { art, ri, riCell } from "./rpgenArt";
import { base } from "./tiles";

/** 台（台ごしに 向こうの 人と 話せる。人の となりの 台には 調べる 物を 置かない）。 */
const ctr = <T extends object>(t: T) => ({ ...t, counter: true });
/** 名無し（本館の 中の 人と 同じ 絵）。 */
const NANASHI = ["sa:xjuotB", "sa:qPN3cT", "sa:C2hS8U", "sa:VaBXqn"] as const;
const look = (
	floor: string,
	floorColor: string,
	up: string,
	low: string,
	wallColor: string,
): RoomLook => ({ floor, floorColor, up, low, wallColor });
/** 白い 壁と 腰の 幅木（Base.png 507・508 行）。 */
const OFFICE = look(
	ri("flBeige"),
	"#c8b890",
	base(0, 507),
	base(0, 508),
	"#e8e8e4",
);
/** 壁の 丸い 時計（Base.png 507 行）。 */
const CLOCK = base(7, 507);
/** 実況モニター（本館と 同じ 2×2 の 大きな 画面。壁の 下段に かける）。 */
const MONITOR_L = base(0, 485, 1, 2);
const MONITOR_R = base(1, 485, 1, 2);
/** 旗（本館の 殿堂の 旗と 同じ 絵）。 */
const FLAG_L = base(3, 118, 1, 2);
const FLAG_R = base(4, 118, 1, 2);

/** 平らな 屋根の 2段（facilities.ts の ROOF_FLAT と 同じ 字。この 字は 屋根だけに 使う）。 */
const ROOF: Record<string, readonly string[]> = {
	"(": [art("concrete"), art("roofFlat")],
	"-": [art("concrete"), art("roofFlat", 1)],
	")": [art("concrete"), art("roofFlat", 2)],
	"[": [art("concrete"), art("roofFlat", 0, 1)],
	"=": [art("concrete"), art("roofFlat", 1, 1)],
	"]": [art("concrete"), art("roofFlat", 2, 1)],
	"*": [art("concrete"), art("roofFlat", 1), art("waterTank")],
	"%": [art("concrete"), art("roofFlat", 1, 1), art("skylight")],
};

/** 段4〜6：保守町役場（窓口と 小さな 議場が 1部屋。段7 で 同じ 所に 市役所が 建つ）。 */
const TOWNHALL: Facility = {
	id: "townhall",
	name: "保守町役場",
	from: 4,
	until: 7,
	at: [63, 4],
	// 白い 2階建て・屋上の 給水タンク・パラペットの 時計・窓・植えこみ・まんなかの 扉
	look: {
		kind: "grid",
		rows: ["(-*-*-)", "[==k==]", "awwwwwc", "l78D89e"],
		door: "D",
		keys: {
			...ROOF,
			k: [art("concrete"), art("roofFlat", 1, 1), CLOCK],
			a: [art("white", 0, 1), art("win24", 1)],
			w: [art("white", 1, 1), art("win24", 1)],
			c: [art("white", 2, 1), art("win24", 1)],
			l: [art("white", 0, 2)],
			"7": [art("white", 1, 2), art("planter")],
			"8": [art("white", 1, 2), art("planter", 1)],
			"9": [art("white", 1, 2), art("planter", 2)],
			D: [art("white", 1, 2), art("door108")],
			e: [art("white", 2, 2)],
		},
	},
	door: "保守町役場。\n窓口の　番号が、ピンポンと　鳴った。",
	// 中：白い 壁と 明るい 床。奥の 壁に 見分け方の はり紙・案内・中継モニター・時計・町の 旗・議会の 日程、
	// 左に 1番窓口（台の うしろに 窓口の 人）、右に 議長席（台の うしろに 議長）・演壇・議員の 机、手前に 待合の 長いす
	room: {
		look: OFFICE,
		rows: [
			"##############",
			"#HHWHHHHHHWHH#",
			"#hhxmMwkGghBe#",
			"#............#",
			"#[=].....qQr.#",
			"#............#",
			"#.........t..#",
			"#.jJ....v.v.v#",
			"#F...........#",
			"######DD######",
		],
		tiles: (k) => ({
			x: k.low(ri("poster")),
			M: k.low(MONITOR_L),
			w: k.low(MONITOR_R),
			k: k.low(CLOCK),
			G: k.low(FLAG_L),
			g: k.low(FLAG_R),
			B: k.low(ri("scroll")),
			e: k.low(ri("notice")),
			"[": ctr(k.on(riCell("whiteCounter", 0, 0), ri("bell"))),
			"=": ctr(k.on(riCell("whiteCounter", 1, 0))),
			"]": ctr(k.on(riCell("whiteCounter", 1, 0), ri("pcTop"))),
			q: ctr(k.on(riCell("counterDark", 0, 0))),
			Q: ctr(k.on(riCell("counterDark", 1, 0))),
			r: ctr(k.on(riCell("counterDark", 2, 0))),
			t: k.on(ri("podium")),
			j: k.on(riCell("bench", 0, 0)),
			J: k.on(riCell("bench", 1, 0)),
			v: k.on(ri("tableBeige")),
		}),
		things: {
			x: "kiben",
			m: "guide",
			M: "monitor",
			w: "monitor",
			k: "clock",
			G: "flag",
			g: "flag",
			B: "minutes",
			e: "agenda",
			"[": "window",
			"]": "window",
			q: "chair_seat",
			r: "chair_seat",
			t: "podium",
			j: "bench",
			J: "bench",
			v: "seat",
		},
		lines: {
			kiben: ["はり紙『ずるい　理屈の　見分け方』。\n……どれを　読む？"],
			guide: ["はり紙。\n『住民票・転入届は　1番　窓口』"],
			monitor: ["議会の　中継モニター。\n……今日は　閉会中。砂あらし。"],
			clock: ["時計。\n……議会は　だいたい　押す。"],
			flag: ["町の　旗。\n『>>1』の　字が　染めてある。"],
			agenda: ["議会の　日程。\n『定例会：月曜。ナイターの　ない　日』"],
			minutes: ["模擬議会の　議事録。\n……どの　号を　読む？"],
			window: ["1番　窓口。転入届の　見本。\n『前の　住所：なんJ』"],
			chair_seat: ["議長席。\n木づちと、のど飴が　置いてある。"],
			podium: ["演壇。\n『模擬議会　カンペ係　募集中』"],
			bench: ["待合の　長いす。\n傍聴も　ここから。……ほぼ　ROM専。"],
			seat: ["議員の　机。\n名札の　ひとつに『ホゲェ』。"],
		},
		// 演壇で 討論会（模擬議会。いつでも 何度でも）、はり紙で 見分け方（ui/debate.ts）
		plays: { podium: "debate", kiben: "kiben", minutes: "minutes" },
		people: [
			{
				id: "townhall_clerk",
				walk: NANASHI[1],
				at: [2, 3],
				dir: "down",
				name: "窓口",
				lines: ["転入ですか？\n……前の　住所は、だいたい　なんJ　です"],
			},
			{
				id: "townhall_chair",
				walk: NANASHI[3],
				at: [10, 3],
				dir: "down",
				name: "議長",
				lines: ["議長の　仕事は、\n『静粛に』と　言う　ことです"],
			},
			{
				id: "townhall_staff",
				walk: NANASHI[0],
				at: [12, 6],
				dir: "left",
				name: "議会事務局",
				lines: ["模擬議会、出て　みます？\n……カンペ係が　足りないんです"],
			},
		],
	},
};

/**
 * 段7：保守市役所（町役場を 同じ 所で 建てかえ。交番 → 警察署と 同じ）。北の 通りの 上に 7マスの 空きは
 * ここ だけなので、市議会の 議場は 市役所の 中（日本の 市議会は ふつう 市庁舎の 中）。奥が 議場、柵の 手前が 窓口。
 * 外観は 実在の 建物（国会の 塔など）を まねない：白い 壁・柱・平らな 屋根・時計だけ。
 */
const CITYHALL: Facility = {
	id: "cityhall",
	name: "保守市役所",
	from: 7,
	at: [63, 3],
	// 白い 3階建て・柱 2本・時計・窓・植えこみ・まんなかの 扉
	look: {
		kind: "grid",
		rows: ["(-*-*-)", "[==%==]", "aPwkwPc", "lQwwwQe", "mR8D8Rn"],
		door: "D",
		keys: {
			...ROOF,
			a: [art("white"), art("win24", 1)],
			P: [art("white", 1), art("pillar")],
			w: [art("white", 1), art("win24", 1)],
			k: [art("white", 1), CLOCK],
			c: [art("white", 2), art("win24", 1)],
			l: [art("white", 0, 1), art("win24", 1)],
			Q: [art("white", 1, 1), art("pillar", 0, 1)],
			e: [art("white", 2, 1), art("win24", 1)],
			m: [art("white", 0, 2)],
			R: [art("white", 1, 2), art("pillar", 0, 2)],
			"8": [art("white", 1, 2), art("planter", 1)],
			D: [art("white", 1, 2), art("door108")],
			n: [art("white", 2, 2)],
		},
	},
	door: "保守市役所。\n奥に　市議会の　議場。木づちの　音。",
	// 中：奥が 市議会の 議場（議事日程・議事録・中継モニター・市の 旗・時計・見分け方の はり紙、議長席・演壇・
	// 議席 8つ、金の じゅうたん）、傍聴席の 柵の 手前が 窓口（1 住民課・2 届出課・3 市民の 声）と 待合
	room: {
		look: look(ri("flGrey"), "#b0b0b0", base(0, 507), base(0, 508), "#e8e8e4"),
		rows: [
			"################",
			"#HHWHHHHHHHHWHH#",
			"#hmBhMwhGghkehh#",
			"#..............#",
			"#.....qQQR.....#",
			"#.......t......#",
			"#.vV.vV.-.vV.vV#",
			"#.......-......#",
			"#.vV.vV.-.vV.vV#",
			"#.......-......#",
			"#rrrrrr.-.rrrrr#",
			"#..............#",
			"#aAo.bOp..cCu..#",
			"#..............#",
			"#.jJ..x.-...jJ.#",
			"#F......-....yF#",
			"#######DD#######",
		],
		tiles: (k) => ({
			B: k.low(riCell("bookshelf", 0, 0)),
			M: k.low(MONITOR_L),
			w: k.low(MONITOR_R),
			G: k.low(FLAG_L),
			g: k.low(FLAG_R),
			k: k.low(CLOCK),
			e: k.low(ri("poster")),
			q: ctr(k.on(riCell("counterDark", 0, 0))),
			Q: ctr(k.on(riCell("counterDark", 1, 0))),
			R: ctr(k.on(riCell("counterDark", 2, 0))),
			r: k.on(ri("seatBack")),
			t: k.on(ri("podium")),
			v: k.on(riCell("deskDark", 0, 0), ri("laptop")),
			V: k.on(riCell("deskDark", 2, 0)),
			"-": k.floor(base(5, 47)),
			a: ctr(k.on(riCell("counterLong", 0, 0), ri("bell"))),
			A: ctr(k.on(riCell("counterLong", 1, 0))),
			o: ctr(k.on(riCell("counterLong", 2, 0))),
			b: ctr(k.on(riCell("counterLong", 0, 0), ri("bell"))),
			O: ctr(k.on(riCell("counterLong", 1, 0))),
			p: ctr(k.on(riCell("counterLong", 2, 0))),
			c: ctr(k.on(riCell("counterLong", 0, 0))),
			C: ctr(k.on(riCell("counterLong", 1, 0), ri("notice"))),
			u: ctr(k.on(riCell("counterLong", 2, 0))),
			j: k.on(riCell("bench", 0, 0)),
			J: k.on(riCell("bench", 1, 0)),
			x: k.on(ri("atm")),
			y: k.on(ri("standSign")),
		}),
		things: {
			m: "agenda",
			B: "minutes",
			M: "monitor",
			w: "monitor",
			G: "flag",
			g: "flag",
			k: "clock",
			e: "kiben",
			q: "chair_seat",
			R: "chair_seat",
			r: "gallery",
			t: "podium",
			v: "seat",
			a: "jumin",
			o: "jumin",
			b: "todoke",
			p: "todoke",
			c: "voice",
			C: "voice",
			u: "voice",
			j: "bench",
			J: "bench",
			x: "ticket",
			y: "guide",
		},
		lines: {
			agenda: [
				"議事日程の　はり紙。\n『定例会は　月曜。ナイターの　ない　日』",
			],
			minutes: [
				"市議会の　議事録。……模擬議会の\n号も　とじてある。どの　号を　読む？",
			],
			monitor: ["中継モニター。\n議場が　映っている。……自分が　映った。"],
			flag: ["市の　旗。\n町の　旗より、ひと回り　大きい。"],
			clock: [
				"時計。窓口は　5時まで。\n……スレには　閉まる　時間が　ない。",
				"議場は　質疑が　押して、\nもう　夜。",
			],
			kiben: ["はり紙『ずるい　理屈の　見分け方』。\n……どれを　読む？"],
			chair_seat: ["議長席。\n木づちが　すりへって　いる。"],
			podium: ["演壇。\n『模擬議会　出場者　募集中。カンペ係も』"],
			seat: ["議員の　机。\n名札の　ひとつに『ホゲェ』。"],
			gallery: ["傍聴席。\n『ヤジは　心の　中で』と　書いてある。"],
			jumin: [
				"1番　住民課。住民票の　見本。\n『住所：hayabusa　保守村』",
				"世帯主の　欄。\n……『名無し』で　受理　されている。",
			],
			todoke: [
				"2番　届出課。\n『スレの　出生届：親は　>>1』",
				"……下に　小さく\n『落ちる　前に　書きこんで』",
			],
			voice: [
				"3番　市民の　声。だれも　いない。\n投書箱に『sage　進行で』が　3枚。",
			],
			bench: ["待合の　いす。\n呼ばれるまで、みんな　スマホを　見ている。"],
			ticket: [
				"番号札の　機械。\n引くと『>>1000』。……書けない　番号だ。",
				"呼び出しの　表示は\n『ただいま　>>999番の　方』",
			],
			guide: [
				"フロアの　案内。\n1　住民課　2　届出課　3　市民の　声",
				"市長室の　札。\n『市長　募集中。……当番は　みんなで』",
			],
		},
		// 演壇で 討論会、議事録、見分け方の はり紙（ui/debate.ts）
		plays: { podium: "debate", kiben: "kiben", minutes: "minutes" },
		people: [
			{
				id: "cityhall_staff",
				walk: NANASHI[0],
				at: [1, 3],
				dir: "down",
				name: "議会事務局",
				lines: ["模擬議会の　カンペ係、\nやって　みませんか"],
			},
			{
				id: "cityhall_guard",
				walk: NANASHI[2],
				at: [14, 3],
				dir: "down",
				name: "衛視",
				lines: ["ヤジは　禁止です。\n……実況スレなら　ええけど"],
			},
			{
				id: "cityhall_watcher",
				walk: NANASHI[1],
				at: [9, 11],
				dir: "up",
				name: "傍聴人",
				lines: ["傍聴　しに　来た。\n……中継で　見るより　眠い"],
			},
			{
				id: "cityhall_clerk_a",
				walk: NANASHI[3],
				at: [2, 11],
				dir: "down",
				name: "住民課",
				lines: ["住民票ですか？　ROM専の　方も\n住民です。……書きこまなくても"],
			},
			{
				id: "cityhall_clerk_b",
				walk: NANASHI[1],
				at: [6, 11],
				dir: "down",
				name: "届出課",
				lines: ["届の　見届け人欄が、\n『ROM専　2名』……見届けては　いる"],
			},
			{
				id: "cityhall_waiting",
				walk: NANASHI[2],
				at: [9, 13],
				dir: "up",
				name: "名無し",
				lines: ["番号札、>>1000　引いたわ。\n……一生　呼ばれへん"],
			},
		],
	},
};

/** 町の 役所（FACILITIES の いちばん うしろに 足す）。 */
export const CIVIC_FACILITIES: readonly Facility[] = [TOWNHALL, CITYHALL];
