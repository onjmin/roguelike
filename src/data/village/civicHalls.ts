// 町の 役所（町が 育つと 建つ 寄り道。CIVIC.md の 施設）。書き方は facilities.ts と 同じで、facilities.ts の
// FACILITIES の いちばん うしろ（飲食店の さらに うしろ）に 足す（外観の 字は 並び順で 割りふるので、いまの 字を ずらさない）。
//
//   段4〜6 保守町役場（北の 通りの 上 x63〜69。東の 縦の 大通りの 北の 突きあたり。扉 (66,7)）
//
// 置き場所：牛丼「つゆだく」（段5〜、x47〜51）が CIVIC の 予定地 x46〜52 を ふさいだので、段4〜7 に ずっと 空いて
// いる 7マスの 区画 x63〜69 y3〜7 に 置く（裁判所 x53〜62 の となり。三権の 並び）。
// 中の 物：演壇＝討論会（模擬議会の カンペ係。ui/debate.ts）・はり紙＝見分け方（ui/debate.ts）。
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
			"#hhxmMwkGghhe#",
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
			window: ["1番　窓口。転入届の　見本。\n『前の　住所：なんJ』"],
			chair_seat: ["議長席。\n木づちと、のど飴が　置いてある。"],
			podium: ["演壇。\n『模擬議会　カンペ係　募集中』"],
			bench: ["待合の　長いす。\n傍聴も　ここから。……ほぼ　ROM専。"],
			seat: ["議員の　机。\n名札の　ひとつに『ホゲェ』。"],
		},
		// 演壇で 討論会（模擬議会。いつでも 何度でも）、はり紙で 見分け方（ui/debate.ts）
		plays: { podium: "debate", kiben: "kiben" },
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

/** 町の 役所（FACILITIES の いちばん うしろに 足す）。 */
export const CIVIC_FACILITIES: readonly Facility[] = [TOWNHALL];
